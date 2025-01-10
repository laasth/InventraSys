import { writable } from 'svelte/store';

export const currentPage = writable('list'); // 'list' or 'manage'

// Pagination store
export const paginationStore = writable({
  currentPage: 1,
  itemsPerPage: 25,
  totalItems: 0,
  totalPages: 0
});

// Search and filter store
export const filterStore = writable({
  searchQuery: '',
  searchInput: '', // Add searchInput to maintain text between views
  sortBy: 'delenummer',
  sortOrder: 'asc'
});

// API configuration store
export const apiConfig = writable({
  host: window.location.hostname,
  port: window.location.port || '3000'
});
