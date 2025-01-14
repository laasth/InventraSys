import { writable } from 'svelte/store';

// Username store with cookie persistence
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function setCookie(name, value) {
  // Set cookie that never expires
  document.cookie = `${name}=${value}; path=/; max-age=31536000000`;
}

const storedUsername = typeof document !== 'undefined' ? getCookie('username') : null;
export const usernameStore = writable(storedUsername);

// Subscribe to username changes to persist in cookie
if (typeof document !== 'undefined') {
  usernameStore.subscribe(value => {
    if (value) setCookie('username', value);
  });
}

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
