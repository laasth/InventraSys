# InventraSys - Inventory Management System

A modern inventory management system built with Svelte and Express, featuring real-time updates and search capabilities.

## Features

- **User Management**
  - Username-based authentication
  - Persistent login with cookie storage
  - Username display in main views
  - Logout functionality in Manage Inventory

- **Real-time Inventory Management**
  - Live updates using Server-Sent Events (SSE)
  - Add, edit, and delete inventory items
  - Adjust quantities with increment/decrement controls

- **Advanced Search and Pagination**
  - Instant search functionality
  - Filter by part number or product name
  - Case-insensitive search
  - Search state persists between views
  - Server-side pagination (25 items per page)
  - Efficient handling of large datasets

- **User-Friendly Interface**
  - Clean, Excel-like table layout
  - Responsive design
  - Intuitive controls
  - Sortable columns with keyboard navigation
  - Consistent search bar positioning across views
  - Loading states for better user feedback
  - Multi-language support (English and Norwegian)

- **Stock Management Tools**
  - Dedicated stock counting interface
  - CSV import functionality for bulk data management
  - Easy-to-use stock adjustment controls

- **Audit Log**
  - Track all inventory changes
  - View who made changes and when
  - See detailed before/after values
  - Expandable change details

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/laasth/InventraSys.git
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
│   │   ├── stores.js     # Shared state management
│   │   ├── ManageInventory.svelte  # Inventory management view
│   │   ├── StockCount.svelte      # Stock counting interface
│   │   ├── AuditLog.svelte       # Change history view
│   │   ├── csvImporter.js        # CSV import utility
│   │   ├── i18n/               # Internationalization
│   │   │   ├── en.js         # English translations
│   │   │   └── no.js         # Norwegian translations
│   ├── assets/           # Static assets
│   ├── App.svelte        # Main application component
│   └── main.js           # Application entry point
├── public/                # Public static files
├── server.js             # Express server with integrated Vite (dev) and static file serving (prod)
├── vite.config.js        # Vite configuration
└── db/                   # Database directory
    └── inventory.db      # SQLite database
```

## Features in Detail

### User Management
- Username-based authentication
- First-time login dialog
- Username stored in cookie for persistence
- Username displayed in main inventory list and manage inventory views
- Logout functionality available in manage inventory view

### Inventory Management
- View all inventory items in a table format
- Add new items with details like part number, name, description, etc.
- Edit existing items
- Delete items
- Adjust quantities using + and - buttons
- Sort items by any column
- Keyboard navigation support

### Search and Pagination
- Real-time filtering as you type
- Search state persists between views
- Searches across:
  - Part numbers
  - Product names
- Case-insensitive matching
- Instant results update
- Server-side pagination
- 25 items per page for optimal performance
- Maintains search and sort state during navigation

### Audit Log
- Comprehensive change tracking
- View all modifications to inventory
- See who made each change
- Timestamp for each modification
- Detailed before/after values
- Expandable change details
- Paginated history view

### Data Persistence
- SQLite database for reliable data storage
- Initial data import from CSV
- Real-time synchronization across clients
- Efficient handling of large datasets

### State Management
- Shared state between views using Svelte stores
- Persistent search and sort preferences
- Dynamic API configuration
- Loading state management
- Language preference persistence
- Username persistence with cookies

### Internationalization
- Full support for English and Norwegian
- Easily extensible translation system
- Language switching without page reload
- Persistent language preferences

### Data Import/Export
- CSV import functionality for bulk data updates
- Support for importing stock counts
- Flexible data mapping for CSV imports

## API Endpoints

- `GET /api/inventory` - Get paginated inventory items
  - Query parameters:
    - page: Page number
    - itemsPerPage: Items per page (default: 25)
    - searchQuery: Search term
    - sortBy: Column to sort by
    - sortOrder: Sort direction (asc/desc)
- `POST /api/inventory` - Add a new item
- `PUT /api/inventory/:id` - Update an item
- `DELETE /api/inventory/:id` - Delete an item
- `GET /api/updates` - SSE endpoint for real-time updates
- `GET /api/audit-logs` - Get paginated audit log entries

## Technologies Used

- **Frontend**
  - Svelte
  - Vite
  - SSE for real-time updates
  - Svelte stores for state management
  - Cookie-based user persistence

- **Backend**
  - Express.js with integrated Vite middleware
  - SQLite (better-sqlite3)
  - Server-side pagination
  - Dynamic configuration
