import express from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
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
function getPaginatedData(page = 1, itemsPerPage = 25, searchQuery = '', sortBy = 'delenummer', sortOrder = 'ASC') {
  const offset = (page - 1) * itemsPerPage;
  
  // Build search condition
  const searchCondition = searchQuery 
    ? `WHERE delenummer LIKE ? OR navn LIKE ? OR beskrivelse LIKE ? OR lokasjon LIKE ?`
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

// Function to import CSV data
function importCsvData() {
  try {
    // Check if table is empty
    const count = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
    if (count.count > 0) {
      console.log('Database already contains data, skipping import');
      return;
    }

    const csvContent = fs.readFileSync('Telleliste.csv', 'utf-8');
    const lines = csvContent.split('\n');
    
    // Skip header row
    const dataRows = lines.slice(1);
    
    const insertStmt = db.prepare(`
      INSERT INTO inventory (delenummer, navn, beskrivelse, lokasjon, inn_pris, ut_pris, antall)
      VALUES (@delenummer, @navn, @beskrivelse, @lokasjon, @inn_pris, @ut_pris, @antall)
    `);

    db.transaction(() => {
      for (const row of dataRows) {
        if (!row.trim()) continue; // Skip empty lines
        
        const [lokasjon, delenummer, navn, antall, inn_pris, ut_pris, beskrivelse] = row.split(',').map(field => field.trim());
        
        insertStmt.run({
          delenummer: delenummer || '',
          navn: navn?.replace(/^"|"$/g, '') || '', // Remove quotes if present
          beskrivelse: beskrivelse || '',
          lokasjon: lokasjon || '',
          inn_pris: parseFloat(inn_pris) || 0,
          ut_pris: parseFloat(ut_pris) || 0,
          antall: parseInt(antall) || 0
        });
      }
    })();

    console.log('CSV data imported successfully');
  } catch (error) {
    console.error('Error importing CSV data:', error);
  }
}

// Create table if it doesn't exist and import data
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delenummer TEXT NOT NULL,
    navn TEXT NOT NULL,
    beskrivelse TEXT,
    lokasjon TEXT,
    inn_pris REAL,
    ut_pris REAL,
    antall INTEGER DEFAULT 0
  )
`);

// Get items with pagination
app.get('/api/inventory', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 25;
  const searchQuery = req.query.searchQuery || '';
  const sortBy = req.query.sortBy || 'delenummer';
  const sortOrder = (req.query.sortOrder || 'asc').toUpperCase();
  
  // Validate sort column to prevent SQL injection
  const validColumns = ['delenummer', 'navn', 'beskrivelse', 'lokasjon', 'inn_pris', 'ut_pris', 'antall'];
  if (!validColumns.includes(sortBy)) {
    return res.status(400).json({ error: 'Invalid sort column' });
  }

  const result = getPaginatedData(page, itemsPerPage, searchQuery, sortBy, sortOrder);
  res.json(result);
});

// Add new item
app.post('/api/inventory', (req, res) => {
  const stmt = db.prepare(`
    INSERT INTO inventory (delenummer, navn, beskrivelse, lokasjon, inn_pris, ut_pris, antall)
    VALUES (@delenummer, @navn, @beskrivelse, @lokasjon, @inn_pris, @ut_pris, @antall)
  `);
  const result = stmt.run(req.body);
  notifyClients();
  res.json({ id: result.lastInsertRowid });
});

// Update item
app.put('/api/inventory/:id', (req, res) => {
  const stmt = db.prepare(`
    UPDATE inventory 
    SET delenummer = @delenummer,
        navn = @navn,
        beskrivelse = @beskrivelse,
        lokasjon = @lokasjon,
        inn_pris = @inn_pris,
        ut_pris = @ut_pris,
        antall = @antall
    WHERE id = @id
  `);
  stmt.run({ ...req.body, id: req.params.id });
  notifyClients();
  res.json({ success: true });
});

// Delete item
app.delete('/api/inventory/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
  stmt.run(req.params.id);
  notifyClients();
  res.json({ success: true });
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
  importCsvData(); // Import CSV data when server starts
});
