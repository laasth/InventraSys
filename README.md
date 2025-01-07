# InventraSys - Inventory Management System

A modern inventory management system built with Svelte and Express, featuring real-time updates and search capabilities.

## Features

- **Real-time Inventory Management**
  - Live updates using Server-Sent Events (SSE)
  - Add, edit, and delete inventory items
  - Adjust quantities with increment/decrement controls

- **Advanced Search**
  - Instant search functionality
  - Filter by part number (Delenummer) or product name (Navn)
  - Case-insensitive search

- **User-Friendly Interface**
  - Clean, Excel-like table layout
  - Responsive design
  - Intuitive controls

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd InventraSys
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

The application supports customizable host and port settings through environment variables:

- `HOST` - The host address to bind to (defaults to 'localhost')
- `PORT` - The port number to use (defaults to 3000)

### Running the Application

#### Development Mode

For development with hot reloading:

```bash
npm run dev
```

This will start a single server that handles both the frontend and API, with hot reloading enabled.

#### Production Mode

1. Build and start the application:
```bash
npm run build
npm start
```

This will:
- Build the frontend into optimized static files
- Serve the built files and API from a single server
- Import initial data from Telleliste.csv (if the database is empty)

The application will be available at `http://localhost:3000` (or your configured host/port).

#### Custom Configuration

To use different host/port settings:

##### Windows (PowerShell)
```powershell
# Example: Run on a different port
$env:PORT="3001"; node server.js

# Example: Run on a specific host and port
$env:HOST="192.168.1.100"; $env:PORT="8080"; node server.js
```

##### Linux/macOS (Bash)
```bash
# Example: Run on a different port
PORT=3001 node server.js

# Example: Run on a specific host and port
HOST=192.168.1.100 PORT=8080 node server.js

# Example: Export variables for reuse in current session
export HOST=192.168.1.100
export PORT=8080
node server.js
```


## Project Structure

```
InventraSys/
├── src/                    # Frontend source files
│   ├── lib/               # Svelte components
│   ├── assets/           # Static assets
│   ├── App.svelte        # Main application component
│   └── main.js           # Application entry point
├── public/                # Public static files
├── server.js             # Express server with integrated Vite (dev) and static file serving (prod)
├── vite.config.js        # Vite configuration
└── inventory.db          # SQLite database
```

## Features in Detail

### Inventory Management
- View all inventory items in a table format
- Add new items with details like part number, name, description, etc.
- Edit existing items
- Delete items
- Adjust quantities using + and - buttons

### Search Functionality
- Real-time filtering as you type
- Searches across:
  - Part numbers (Delenummer)
  - Product names (Navn)
- Case-insensitive matching
- Instant results update

### Data Persistence
- SQLite database for reliable data storage
- Initial data import from CSV
- Real-time synchronization across clients

## API Endpoints

- `GET /api/inventory` - Get all inventory items
- `POST /api/inventory` - Add a new item
- `PUT /api/inventory/:id` - Update an item
- `DELETE /api/inventory/:id` - Delete an item
- `GET /api/updates` - SSE endpoint for real-time updates

## Technologies Used

- **Frontend**
  - Svelte
  - Vite
  - SSE for real-time updates

- **Backend**
  - Express.js with integrated Vite middleware
  - SQLite (better-sqlite3)
