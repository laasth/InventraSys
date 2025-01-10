#!/usr/bin/env node
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

// Export for use as a module
export { importCsvData };

/**
 * Imports CSV data into the database if the inventory table is empty
 * @param {string} dbPath - Path to the SQLite database file
 * @param {string} csvPath - Path to the CSV file
 */
function importCsvData(dbPath, csvPath) {
  const db = new Database(dbPath);
  
  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      purchase_price REAL,
      sale_price REAL,
      quantity INTEGER DEFAULT 0,
      last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_stock_count DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    // Check if table is empty
    const result = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
    if (result && typeof result === 'object' && result !== null && 'count' in result && typeof result.count === 'number' && result.count > 0) {
      console.log('Database already contains data, skipping import');
      return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Skip header row
    const dataRows = lines.slice(1);
    
    const insertStmt = db.prepare(`
      INSERT INTO inventory (part_number, name, description, location, purchase_price, sale_price, quantity, last_modified, last_stock_count)
      VALUES (@part_number, @name, @description, @location, @purchase_price, @sale_price, @quantity, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    db.transaction(() => {
      for (const row of dataRows) {
        if (!row.trim()) continue; // Skip empty lines
        
        const [location, part_number, name, quantity, purchase_price, sale_price, description] = row.split(',').map(field => field.trim());
        
        insertStmt.run({
          part_number: part_number || '',
          name: name?.replace(/^"|"$/g, '') || '', // Remove quotes if present
          description: description || '',
          location: location || '',
          purchase_price: parseFloat(purchase_price) || 0,
          sale_price: parseFloat(sale_price) || 0,
          quantity: parseInt(quantity) || 0
        });
      }
    })();

    console.log('CSV data imported successfully');
  } catch (error) {
    console.error('Error importing CSV data:', error);
  }
}

// Run as standalone program if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = process.argv[2] || 'inventory.db';
  const csvPath = process.argv[3] || 'Telleliste.csv';
  
  console.log(`Importing CSV data from ${csvPath} into database ${dbPath}`);
  importCsvData(dbPath, csvPath);
}
