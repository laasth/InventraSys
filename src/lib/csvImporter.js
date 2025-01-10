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
      delenummer TEXT NOT NULL,
      navn TEXT NOT NULL,
      beskrivelse TEXT,
      lokasjon TEXT,
      inn_pris REAL,
      ut_pris REAL,
      antall INTEGER DEFAULT 0
    )
  `);

  try {
    // Check if table is empty
    const count = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
    if (count.count > 0) {
      console.log('Database already contains data, skipping import');
      return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
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

// Run as standalone program if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = process.argv[2] || 'inventory.db';
  const csvPath = process.argv[3] || 'Telleliste.csv';
  
  console.log(`Importing CSV data from ${csvPath} into database ${dbPath}`);
  importCsvData(dbPath, csvPath);
}
