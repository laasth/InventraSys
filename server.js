import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;

const app = express();
const db = new Database('inventory.db');

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
setupVite().catch(console.error);

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

  return {
    items,
    pagination: {
      currentPage: page,
      itemsPerPage,
      totalItems: count,
      totalPages: Math.ceil(count / itemsPerPage)
    }
  };
}

// SSE endpoint for real-time updates
app.get('/api/updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial data
  const data = JSON.stringify({ type: 'update', count: db.prepare('SELECT COUNT(*) as count FROM inventory').get().count });
  res.write(`data: ${data}\n\n`);

  // Add client to list
  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };
  clients.push(newClient);

  // Remove client on connection close
  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

// Function to notify all clients of updates
function notifyClients() {
  const data = JSON.stringify({ 
    type: 'update',
    count: db.prepare('SELECT COUNT(*) as count FROM inventory').get().count
  });
  clients.forEach(client => {
    client.res.write(`data: ${data}\n\n`);
  });
}

// Create table if it doesn't exist
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
  )
`);

// Get items with pagination
app.get('/api/inventory', (req, res) => {
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
  
  // Datetime fields are handled by SQLite, no validation needed
  
  return errors;
}

function validateId(id) {
  const numId = parseInt(id);
  return !isNaN(numId) && numId > 0 && Number.isInteger(numId);
}

// Add new item
app.post('/api/inventory', (req, res) => {
  try {
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
    notifyClients();
    res.json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error in POST /api/inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update item
app.put('/api/inventory/:id', (req, res) => {
  try {
    console.log('PUT /api/inventory/:id - Request received:', {
      id: req.params.id,
      body: req.body,
      last_stock_count: req.body.last_stock_count // Log the last_stock_count specifically
    });

    const id = req.params.id;
    if (!validateId(id)) {
      console.log('PUT /api/inventory/:id - Invalid ID format:', id);
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const data = {
      id: parseInt(id),
      part_number: req.body.part_number === null ? null : String(req.body.part_number || ''),
      name: req.body.name === null ? null : String(req.body.name || ''),
      description: req.body.description === null ? null : String(req.body.description || ''),
      location: String(req.body.location || ''),
      purchase_price: Number(req.body.purchase_price || 0),
      sale_price: Number(req.body.sale_price || 0),
      quantity: parseInt(req.body.quantity || 0),
      // Include last_stock_count from request body if provided
      last_stock_count: req.body.last_stock_count || null
    };

    console.log('PUT /api/inventory/:id - Processing data:', {
      ...data,
      last_stock_count_received: req.body.last_stock_count,
      last_stock_count_processed: data.last_stock_count
    });
    const validationErrors = validateInventoryData(data);
    if (validationErrors.length > 0) {
      console.log('PUT /api/inventory/:id - Validation errors:', {
        errors: validationErrors,
        data: data
      });
      return res.status(400).json({ errors: validationErrors });
    }

    // Get current item data before update
    console.log('PUT /api/inventory/:id - Fetching current item data for ID:', data.id);
    const currentItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(data.id);
    if (!currentItem) {
      console.log('PUT /api/inventory/:id - Item not found:', data.id);
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log('PUT /api/inventory/:id - Current item before update:', currentItem);

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
    
    console.log('PUT /api/inventory/:id - Executing update query');
    const result = stmt.run(data);
    if (result.changes === 0) {
      console.log('PUT /api/inventory/:id - No rows updated for ID:', data.id);
      return res.status(404).json({ error: 'Item not found' });
    }
    
    console.log('PUT /api/inventory/:id - Update successful:', {
      id: data.id,
      changes: result.changes
    });
    
    notifyClients();
    res.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/inventory/:id:', {
      error: error.message,
      stack: error.stack,
      data: data
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete item
app.delete('/api/inventory/:id', (req, res) => {
  try {
    const id = req.params.id;
    if (!validateId(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
    const result = stmt.run(parseInt(id));
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    notifyClients();
    res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/inventory/:id:', error);
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

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
