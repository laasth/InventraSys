import { writable } from 'svelte/store';

export const currentPage = writable('list'); // 'list' or 'manage'
