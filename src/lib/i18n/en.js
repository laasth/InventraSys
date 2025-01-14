export default {
  header: {
    title: 'Manage Inventory',
    listTitle: 'Inventory List',
    search: 'Search by part number or name...',
    backToList: 'Back to List',
    manageInventory: 'Manage Inventory',
    backToInventory: 'Back to Inventory'
  },
  pagination: {
    showing: 'Showing',
    of: 'of',
    items: 'items'
  },
  columns: {
    location: 'Location',
    partNumber: 'Part Number',
    name: 'Name',
    description: 'Description',
    purchasePrice: 'Purchase Price',
    salePrice: 'Sale Price',
    quantity: 'Quantity',
    lastModified: 'Last Modified',
    lastStockCount: 'Last Stock Count',
    actions: 'Actions'
  },
  actions: {
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    stockCount: 'Stock Count'
  },
  stockCount: {
    title: 'Stock Count',
    enterQuantity: 'Enter Quantity',
    quantityPlaceholder: 'Enter current quantity',
    confirmCurrent: 'Confirm Current',
    update: 'Update',
    updated: 'Stock count updated',
    completed: 'Stock count completed',
    error: 'Error updating stock count',
    invalidQuantity: 'Please enter a valid quantity',
    noItems: 'No items to count',
    items: 'items',
    lastCounted: 'Last counted',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete {name}?',
    deleted: 'Item deleted successfully'
  },
  confirmations: {
    deleteItem: 'Are you sure you want to delete this item?'
  },
  dialog: {
    removeFromInventory: 'Remove from Inventory',
    removeUnits: 'How many units do you want to remove from {name}?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    addItem: 'Add New Item',
    welcome: 'Welcome to InventraSys',
    enterUsername: 'Please enter your username to continue',
    usernamePlaceholder: 'Enter username',
    submit: 'Submit',
    logout: 'Logout'
  },
  time: {
    justNow: 'Just now',
    minutesAgo: '{minutes} minutes ago',
    hoursAgo: '{hours} hours ago',
    daysAgo: '{days} days ago'
  },
  auditLog: {
    title: 'Audit Log',
    action: 'Action',
    username: 'Username',
    timestamp: 'Timestamp',
    itemName: 'Item Name',
    partNumber: 'Part Number',
    oldValue: 'Old Value',
    newValue: 'New Value',
    noLogs: 'No audit logs found',
    viewAuditLog: 'View Audit Log',
    description: 'This log shows all changes made to the inventory, including who made the changes and when.',
    viewDetails: 'View Details',
    closeDetails: 'Close',
    valueDetails: 'Change Details'
  }
};
