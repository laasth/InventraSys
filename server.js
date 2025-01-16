#!/usr/bin/env node
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import fs from 'fs';
import { logger, logAPIRequest, logAPIError, logDBOperation, logSystemEvent } from './src/lib/serverLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const app = express();
const db = new Database('db/inventory.db');

const isDev = process.env.NODE_ENV !== 'production';

// Setup Vite middleware in development mode
async function setupVite() {
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: __dirname
    });
    
    // Use vite's connect instance as middleware
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
  }
}

// Initialize Vite
setupVite().catch((error) => {
  logger.error('Failed to initialize Vite', { error: error.toString(), stack: error.stack });
});

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Store connected clients
let clients = [];

// Helper function to get paginated and filtered data
function getPaginatedData(page = 1, itemsPerPage = 25, searchQuery = '', sortBy = 'part_number', sortOrder = 'ASC') {
  const offset = (page - 1) * itemsPerPage;
  
  // Build search condition
  const searchCondition = searchQuery 
    ? `WHERE part_number LIKE ? OR name LIKE ? OR description LIKE ? OR location LIKE ?`
    : '';
  const searchParams = searchQuery 
    ? [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]
    : [];

  try {
    // Get total count
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM inventory 
      ${searchCondition}
    `);
    const { count } = countStmt.get(...searchParams);

    // Get paginated results
    const stmt = db.prepare(`
      SELECT * 
      FROM inventory 
      ${searchCondition}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `);
    
    const items = stmt.all(...searchParams, itemsPerPage, offset);

    logDBOperation('query', {
      operation: 'getPaginatedData',
      page,
      itemsPerPage,
      searchQuery,
      sortBy,
      sortOrder,
      resultCount: items.length
    });

    return {
      items,
      pagination: {
        currentPage: page,
        itemsPerPage,
        totalItems: count,
        totalPages: Math.ceil(count / itemsPerPage)
      }
    };
  } catch (error) {
    logDBOperation('error', {
      operation: 'getPaginatedData',
      error: error.toString(),
      stack: error.stack
    });
    throw error;
  }
}

// SSE endpoint for real-time updates
app.get('/api/updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Send initial data
    const count = db.prepare('SELECT COUNT(*) as count FROM inventory').get().count;
    const data = JSON.stringify({ type: 'update', count });
    res.write(`data: ${data}\n\n`);

    // Add client to list
    const clientId = Date.now();
    const newClient = {
      id: clientId,
      res
    };
    clients.push(newClient);

    logAPIRequest(req, 'SSE client connected', { clientId });

    // Remove client on connection close
    req.on('close', () => {
      clients = clients.filter(client => client.id !== clientId);
      logAPIRequest(req, 'SSE client disconnected', { clientId });
    });
  } catch (error) {
    logAPIError(req, error, 'Error in SSE connection');
    res.end();
  }
});

// Function to notify all clients of updates
function notifyClients() {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM inventory').get().count;
    const data = JSON.stringify({ 
      type: 'update',
      count
    });
    clients.forEach(client => {
      client.res.write(`data: ${data}\n\n`);
    });
    logSystemEvent('Notified clients of update', { clientCount: clients.length });
  } catch (error) {
    logger.error('Error notifying clients', { error: error.toString(), stack: error.stack });
  }
}

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT,
    name TEXT,
    description TEXT,
    location TEXT,
    purchase_price REAL,
    sale_price REAL,
    quantity INTEGER DEFAULT 0,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_stock_count DATETIME
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper function to log audit events
function logAuditEvent(username, action, oldValue, newValue) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_log (username, action, old_value, new_value)
      VALUES (@username, @action, @oldValue, @newValue)
    `);
    
    stmt.run({
      username,
      action,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null
    });

    logDBOperation('audit', {
      username,
      action,
      oldValue,
      newValue
    });
  } catch (error) {
    logger.error('Error logging audit event', {
      error: error.toString(),
      stack: error.stack,
      username,
      action
    });
    throw error;
  }
}

// Get audit logs with pagination
app.get('/api/audit-logs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 25;
  const offset = (page - 1) * itemsPerPage;

  try {
    logAPIRequest(req, 'Fetching audit logs', { page, itemsPerPage });

    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM audit_log');
    const { count } = countStmt.get();

    // Get paginated results with inventory item details
    const stmt = db.prepare(`
      SELECT 
        audit_log.*,
        CASE 
          WHEN audit_log.action = 'DELETE' THEN JSON_EXTRACT(old_value, '$.name')
          WHEN audit_log.action = 'CREATE' THEN JSON_EXTRACT(new_value, '$.name')
          ELSE JSON_EXTRACT(new_value, '$.name')
        END as item_name,
        CASE 
          WHEN audit_log.action = 'DELETE' THEN JSON_EXTRACT(old_value, '$.part_number')
          WHEN audit_log.action = 'CREATE' THEN JSON_EXTRACT(new_value, '$.part_number')
          ELSE JSON_EXTRACT(new_value, '$.part_number')
        END as item_part_number,
        CASE 
          WHEN audit_log.action = 'DELETE' THEN old_value
          WHEN audit_log.action = 'CREATE' THEN new_value
          ELSE json_object(
            'old', old_value,
            'new', new_value
          )
        END as value_content
      FROM audit_log
      ORDER BY audit_log.timestamp DESC
      LIMIT ? OFFSET ?
    `);
    
    const logs = stmt.all(itemsPerPage, offset);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        itemsPerPage,
        totalItems: count,
        totalPages: Math.ceil(count / itemsPerPage)
      }
    });
  } catch (error) {
    logAPIError(req, error, 'Error fetching audit logs');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/inventory', (req, res) => {
  try {
    logAPIRequest(req, 'Fetching inventory items');

    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 25;
    const searchQuery = req.query.searchQuery || '';
    const sortBy = req.query.sortBy || 'part_number';
    const sortOrder = (req.query.sortOrder || 'asc').toUpperCase();
    
    // Validate sort column to prevent SQL injection
    const validColumns = ['part_number', 'name', 'description', 'location', 'purchase_price', 'sale_price', 'quantity'];
    if (!validColumns.includes(sortBy)) {
      return res.status(400).json({ error: 'Invalid sort column' });
    }

    const result = getPaginatedData(page, itemsPerPage, searchQuery, sortBy, sortOrder);
    res.json(result);
  } catch (error) {
    logAPIError(req, error, 'Error fetching inventory items');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validation helper functions
function validateInventoryData(data) {
  const errors = [];
  
  // String fields with null validation
  if (data.part_number !== null && (typeof data.part_number !== 'string')) errors.push('Invalid part_number');
  if (data.name !== null && (typeof data.name !== 'string')) errors.push('Invalid name');
  
  // Other string fields with null validation
  if (data.description !== null && (typeof data.description !== 'string')) errors.push('Invalid description');
  if (data.location && typeof data.location !== 'string') errors.push('Invalid location');
  
  // Numeric fields
  if (typeof data.purchase_price !== 'number' || isNaN(data.purchase_price)) errors.push('Invalid purchase_price');
  if (typeof data.sale_price !== 'number' || isNaN(data.sale_price)) errors.push('Invalid sale_price');
  if (typeof data.quantity !== 'number' || !Number.isInteger(data.quantity)) errors.push('Invalid quantity');
  
  return errors;
}

function validateId(id) {
  const numId = parseInt(id);
  return !isNaN(numId) && numId > 0 && Number.isInteger(numId);
}

// Add new item
app.post('/api/inventory', (req, res) => {
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    logAPIRequest(req, 'Adding new inventory item');

    const data = {
      part_number: req.body.part_number === null ? null : String(req.body.part_number || ''),
      name: req.body.name === null ? null : String(req.body.name || ''),
      description: req.body.description === null ? null : String(req.body.description || ''),
      location: String(req.body.location || ''),
      purchase_price: Number(req.body.purchase_price || 0),
      sale_price: Number(req.body.sale_price || 0),
      quantity: parseInt(req.body.quantity || 0)
    };

    const validationErrors = validateInventoryData(data);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const stmt = db.prepare(`
      INSERT INTO inventory (part_number, name, description, location, purchase_price, sale_price, quantity, last_modified)
      VALUES (@part_number, @name, @description, @location, @purchase_price, @sale_price, @quantity, datetime('now'))
    `);
    
    const result = stmt.run(data);
    
    // Log the audit event
    logAuditEvent(
      username,
      'CREATE',
      null,
      data
    );
    
    notifyClients();
    res.json({ id: result.lastInsertRowid });
  } catch (error) {
    logAPIError(req, error, 'Error adding inventory item');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update item
app.put('/api/inventory/:id', (req, res) => {
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const id = req.params.id;
    if (!validateId(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    logAPIRequest(req, 'Updating inventory item', { itemId: id });

    const data = {
      id: parseInt(id),
      part_number: req.body.part_number === null ? null : String(req.body.part_number || ''),
      name: req.body.name === null ? null : String(req.body.name || ''),
      description: req.body.description === null ? null : String(req.body.description || ''),
      location: String(req.body.location || ''),
      purchase_price: Number(req.body.purchase_price || 0),
      sale_price: Number(req.body.sale_price || 0),
      quantity: parseInt(req.body.quantity || 0),
      last_stock_count: req.body.last_stock_count || null
    };

    const validationErrors = validateInventoryData(data);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    // Get current item data before update
    const currentItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(data.id);
    if (!currentItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const stmt = db.prepare(`
      UPDATE inventory 
      SET part_number = @part_number,
          name = @name,
          description = @description,
          location = @location,
          purchase_price = @purchase_price,
          sale_price = @sale_price,
          quantity = @quantity,
          last_modified = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'),
          last_stock_count = CASE 
            WHEN @last_stock_count = 'now' THEN strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
            ELSE last_stock_count
          END
      WHERE id = @id
    `);
    
    const result = stmt.run(data);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Log the audit event
    logAuditEvent(
      username,
      'UPDATE',
      currentItem,
      data
    );
    
    notifyClients();
    res.json({ success: true });
  } catch (error) {
    logAPIError(req, error, 'Error updating inventory item');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete item
app.delete('/api/inventory/:id', (req, res) => {
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const id = req.params.id;
    if (!validateId(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    logAPIRequest(req, 'Deleting inventory item', { itemId: id });

    // Get item data before deletion for audit log
    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(parseInt(id));
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Log the audit event before deletion
    logAuditEvent(
      username,
      'DELETE',
      item,
      null
    );

    const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
    const result = stmt.run(parseInt(id));
    
    notifyClients();
    res.json({ success: true });
  } catch (error) {
    logAPIError(req, error, 'Error deleting inventory item');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to receive frontend logs
app.post('/api/logs', (req, res) => {
  try {
    const logData = req.body;
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                    req.socket?.remoteAddress || 
                    'unknown';
    
    logger.info('Frontend log received', {
      ...logData,
      clientIP,
      userAgent: req.headers['user-agent']
    });
    
    res.sendStatus(200);
  } catch (error) {
    logAPIError(req, error, 'Error processing frontend log');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get report data
app.get('/api/report', (req, res) => {
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    logAPIRequest(req, 'Fetching report data');

    // Calculate total value and items
    // Get totals
    const totalsStmt = db.prepare(`
      SELECT 
        SUM(quantity * purchase_price) as totalValue,
        SUM(quantity) as totalItems
      FROM inventory
    `);
    
    const totals = totalsStmt.get();

    // Get all inventory items
    const itemsStmt = db.prepare(`
      SELECT 
        id, part_number, name, description, location,
        purchase_price, sale_price, quantity,
        last_modified, last_stock_count
      FROM inventory
      ORDER BY location, part_number
    `);
    
    const items = itemsStmt.all();
    
    res.json({
      totalValue: totals.totalValue || 0,
      totalItems: totals.totalItems || 0,
      items: items
    });
  } catch (error) {
    logAPIError(req, error, 'Error fetching report data');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
  } else if (!isDev) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

// Start server
app.listen(PORT, HOST, () => {
  logSystemEvent('Server started', { host: HOST, port: PORT, environment: isDev ? 'development' : 'production' });
});
