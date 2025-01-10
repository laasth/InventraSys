import { writable } from 'svelte/store';

// Get stored language preference or default to Norwegian
const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null;
export const languageStore = writable(storedLang || 'no');

// Subscribe to language changes to persist in localStorage
if (typeof localStorage !== 'undefined') {
  languageStore.subscribe(value => {
    localStorage.setItem('language', value);
  });
}

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
  sortBy: 'part_number',
  sortOrder: 'asc'
});

// API configuration store
export const apiConfig = writable({
  host: window.location.hostname,
  port: window.location.port || '3000'
});
