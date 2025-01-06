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

### Running the Application

Start both the backend server and frontend development server:

```bash
npm run dev
```

This will:
- Start the Express backend server on port 3000
- Launch the Vite development server for the frontend
- Import initial data from Telleliste.csv (if the database is empty)

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Project Structure

```
InventraSys/
├── src/                    # Frontend source files
│   ├── lib/               # Svelte components
│   ├── assets/           # Static assets
│   ├── App.svelte        # Main application component
│   └── main.js           # Application entry point
├── public/                # Public static files
├── server.js             # Express backend server
├── inventory.db          # SQLite database
└── Telleliste.csv        # Initial inventory data
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
  - Express.js
  - SQLite (better-sqlite3)
  - CORS for cross-origin support

## License

[Your chosen license]
