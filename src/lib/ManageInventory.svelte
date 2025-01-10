<script>
  import { currentPage, paginationStore, filterStore, apiConfig } from './stores.js';
  import { onMount, onDestroy } from 'svelte';

  let items = [];
  let newItem = {
    delenummer: '',
    navn: '',
    beskrivelse: '',
    lokasjon: '',
    inn_pris: '',
    ut_pris: '',
    antall: ''
  };
  let editing = null;
  let searchTimeout;
  let loading = false;
  let eventSource;

  // Subscribe to stores
  $: ({ currentPage: pageNum, itemsPerPage, totalItems, totalPages } = $paginationStore);
  $: ({ searchQuery, searchInput, sortBy, sortOrder } = $filterStore);

  // Computed properties for pagination
  $: startItem = (pageNum - 1) * itemsPerPage + 1;
  $: endItem = Math.min(pageNum * itemsPerPage, totalItems);
  $: pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Watch for changes in pagination or filter settings
  $: {
    if (pageNum || itemsPerPage || searchQuery || sortBy || sortOrder) {
      fetchItems();
    }
  }

  onMount(() => {
    fetchItems();
    setupSSE();
  });

  onDestroy(() => {
    if (eventSource) {
      eventSource.close();
    }
  });

  function setupSSE() {
    eventSource = new EventSource(`http://${$apiConfig.host}:${$apiConfig.port}/api/updates`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'update') {
        fetchItems(); // Refresh data when we receive an update
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
      // Retry connection after 5 seconds
      setTimeout(setupSSE, 5000);
    };
  }

  async function fetchItems() {
    try {
      loading = true;
      const params = new URLSearchParams({
        page: pageNum.toString(),
        itemsPerPage: itemsPerPage.toString(),
        searchQuery,
        sortBy,
        sortOrder
      });

      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory?${params}`);
      const data = await response.json();
      items = data.items;
      paginationStore.set(data.pagination);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterStore.update(state => ({ 
        ...state, 
        searchQuery: $filterStore.searchInput,
        currentPage: 1 
      }));
      paginationStore.update(state => ({ ...state, currentPage: 1 }));
    }, 300);
  }

  function handleSort(column) {
    filterStore.update(state => ({
      ...state,
      sortBy: column,
      sortOrder: state.sortBy === column && state.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  }

  function changePage(page) {
    if (page >= 1 && page <= totalPages) {
      paginationStore.update(state => ({ ...state, currentPage: page }));
    }
  }

  async function addItem() {
    try {
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          inn_pris: parseFloat(newItem.inn_pris),
          ut_pris: parseFloat(newItem.ut_pris),
          antall: parseInt(newItem.antall)
        })
      });
      if (response.ok) {
        newItem = {
          delenummer: '',
          navn: '',
          beskrivelse: '',
          lokasjon: '',
          inn_pris: '',
          ut_pris: '',
          antall: ''
        };
      }
    } catch (error) {
      console.error('Error adding item:', error);
    }
  }

  async function updateItem(item) {
    try {
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (response.ok) {
        editing = null;
      }
    } catch (error) {
      console.error('Error updating item:', error);
    }
  }

  async function deleteItem(id) {
    if (confirm('Er du sikker på at du vil slette denne varen?')) {
      try {
        await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${id}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  }

  function startEdit(item) {
    editing = { ...item };
  }

  function cancelEdit() {
    editing = null;
  }

  function goToList() {
    currentPage.set('list');
  }
</script>

<main>
  <div class="header">
    <h2>Administrer Lager</h2>
    <div class="header-controls">
      <div class="search-container">
        <input 
          type="text" 
          bind:value={$filterStore.searchInput} 
          on:input={handleSearch}
          placeholder="Søk etter delenummer eller navn..."
          class="search-input"
        />
      </div>
      <button class="back-button" on:click={goToList}>Tilbake til Liste</button>
    </div>
  </div>

  <div class="controls">
    <div class="pagination">
      <span class="pagination-info">
        Viser {startItem}-{endItem} av {totalItems} varer
      </span>
      <div class="pagination-controls">
        <button
          disabled={pageNum === 1}
          on:click={() => changePage(pageNum - 1)}
        >
          ←
        </button>
        {#each pages as page}
          <button
            class:active={page === pageNum}
            on:click={() => changePage(page)}
          >
            {page}
          </button>
        {/each}
        <button
          disabled={pageNum === totalPages}
          on:click={() => changePage(pageNum + 1)}
        >
          →
        </button>
      </div>
    </div>
  </div>

  <div class="excel-table">
    <div class="table-header">
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('lokasjon')}
        on:keydown={e => e.key === 'Enter' && handleSort('lokasjon')}
        role="columnheader"
        aria-sort={sortBy === 'lokasjon' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Plassering</span>
        {#if sortBy === 'lokasjon'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('delenummer')}
        on:keydown={e => e.key === 'Enter' && handleSort('delenummer')}
        role="columnheader"
        aria-sort={sortBy === 'delenummer' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Delenummer</span>
        {#if sortBy === 'delenummer'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('navn')}
        on:keydown={e => e.key === 'Enter' && handleSort('navn')}
        role="columnheader"
        aria-sort={sortBy === 'navn' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Navn</span>
        {#if sortBy === 'navn'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('beskrivelse')}
        on:keydown={e => e.key === 'Enter' && handleSort('beskrivelse')}
        role="columnheader"
        aria-sort={sortBy === 'beskrivelse' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Beskrivelse</span>
        {#if sortBy === 'beskrivelse'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('inn_pris')}
        on:keydown={e => e.key === 'Enter' && handleSort('inn_pris')}
        role="columnheader"
        aria-sort={sortBy === 'inn_pris' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Innkjøpspris</span>
        {#if sortBy === 'inn_pris'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('ut_pris')}
        on:keydown={e => e.key === 'Enter' && handleSort('ut_pris')}
        role="columnheader"
        aria-sort={sortBy === 'ut_pris' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Utsalgspris</span>
        {#if sortBy === 'ut_pris'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <button 
        class="header-cell sortable" 
        on:click={() => handleSort('antall')}
        on:keydown={e => e.key === 'Enter' && handleSort('antall')}
        role="columnheader"
        aria-sort={sortBy === 'antall' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span class="header-text">Antall</span>
        {#if sortBy === 'antall'}
          <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        {/if}
      </button>
      <div class="header-cell">
        <span class="header-text">Handlinger</span>
      </div>
    </div>

    <!-- New Item Row -->
    <div class="table-row new-row">
      <div class="table-cell">
        <input bind:value={newItem.lokasjon} placeholder="Plassering" />
      </div>
      <div class="table-cell">
        <input bind:value={newItem.delenummer} placeholder="Delenummer" />
      </div>
      <div class="table-cell">
        <input bind:value={newItem.navn} placeholder="Navn" />
      </div>
      <div class="table-cell">
        <input bind:value={newItem.beskrivelse} placeholder="Beskrivelse" />
      </div>
      <div class="table-cell">
        <input type="number" step="0.01" bind:value={newItem.inn_pris} placeholder="Innkjøpspris" />
      </div>
      <div class="table-cell">
        <input type="number" step="0.01" bind:value={newItem.ut_pris} placeholder="Utsalgspris" />
      </div>
      <div class="table-cell">
        <input type="number" bind:value={newItem.antall} placeholder="Antall" />
      </div>
      <div class="table-cell">
        <button class="add-button" on:click={addItem}>Legg til</button>
      </div>
    </div>

    {#if loading}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    {/if}

    <!-- Existing Items -->
    {#each items as item}
      <div class="table-row">
        {#if editing && editing.id === item.id}
          <div class="table-cell">
            <input bind:value={editing.lokasjon} />
          </div>
          <div class="table-cell">
            <input bind:value={editing.delenummer} />
          </div>
          <div class="table-cell">
            <input bind:value={editing.navn} />
          </div>
          <div class="table-cell">
            <input bind:value={editing.beskrivelse} />
          </div>
          <div class="table-cell">
            <input type="number" step="0.01" bind:value={editing.inn_pris} />
          </div>
          <div class="table-cell">
            <input type="number" step="0.01" bind:value={editing.ut_pris} />
          </div>
          <div class="table-cell">
            <input type="number" bind:value={editing.antall} />
          </div>
          <div class="table-cell actions">
            <button on:click={() => updateItem(editing)}>Lagre</button>
            <button on:click={cancelEdit}>Avbryt</button>
          </div>
        {:else}
          <div class="table-cell">{item.lokasjon}</div>
          <div class="table-cell">{item.delenummer}</div>
          <div class="table-cell">{item.navn}</div>
          <div class="table-cell">{item.beskrivelse}</div>
          <div class="table-cell">{item.inn_pris?.toFixed(2)}</div>
          <div class="table-cell">{item.ut_pris?.toFixed(2)}</div>
          <div class="table-cell">{item.antall}</div>
          <div class="table-cell actions">
            <button on:click={() => startEdit(item)}>Rediger</button>
            <button on:click={() => deleteItem(item.id)}>Slett</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</main>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .header-controls {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .search-container {
    position: relative;
  }

  .search-input {
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
    width: 300px;
    transition: all 0.15s ease-in-out;
    background-color: #f8f9fa;
    color: #212529;
  }

  .search-input:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
  }

  .search-input::placeholder {
    color: #6c757d;
  }

  .controls {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 20px;
    gap: 20px;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .pagination-info {
    color: #6c757d;
    font-size: 14px;
  }

  .pagination-controls {
    display: flex;
    gap: 4px;
  }

  .pagination-controls button {
    padding: 6px 12px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    color: #212529;
    cursor: pointer;
  }

  .pagination-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-controls button.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }

  h2 {
    margin: 0;
    color: #212529;
  }

  .back-button {
    background: linear-gradient(180deg, #6c757d 0%, #5a6268 100%);
  }

  .back-button:hover {
    background: linear-gradient(180deg, #5a6268 0%, #545b62 100%);
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .excel-table {
    position: relative;
    border: 1px solid #c6c6c6;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: white;
    width: 100%;
    border-collapse: collapse;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    font-size: 14px;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr;
    background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
    color: #212529;
    font-weight: bold;
    position: relative;
  }

  .header-cell {
    padding: 10px 12px;
    border-right: 1px solid #dee2e6;
    font-weight: 600;
    border-bottom: 2px solid #c6c6c6;
    user-select: none;
    position: relative;
  }

  .header-cell.sortable {
    cursor: pointer;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    font-weight: 600;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-text {
    color: #212529;
  }

  .header-cell.sortable:hover {
    background: #e9ecef;
  }

  .header-cell.sortable:focus {
    outline: none;
    background: #e9ecef;
    box-shadow: inset 0 0 0 2px #007bff;
  }

  .sort-indicator {
    margin-left: 4px;
    color: #007bff;
  }

  .header-cell::after {
    content: '';
    position: absolute;
    right: 0;
    top: 25%;
    height: 50%;
    width: 1px;
    background: #c6c6c6;
  }

  .table-row {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr;
    min-height: 32px;
    background: white;
    border-bottom: 1px solid #dee2e6;
    transition: background-color 0.15s ease-in-out;
  }

  .table-row:nth-child(even) {
    background: #f8f9fa;
  }

  .table-row:hover {
    background: #e8f4fc;
  }

  .table-row:active {
    background: #cce5ff;
  }

  .table-cell {
    padding: 8px 12px;
    border-right: 1px solid #dee2e6;
    display: flex;
    align-items: center;
    color: #212529;
    line-height: 1.4;
  }

  input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.15s ease-in-out;
    background: transparent;
    color: #212529;
  }

  input:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    background: white;
  }

  .new-row input {
    background: white;
  }

  button {
    padding: 6px 12px;
    margin: 0 4px;
    background: linear-gradient(180deg, #4CAF50 0%, #45a049 100%);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s ease-in-out;
  }

  button:hover {
    background: linear-gradient(180deg, #45a049 0%, #3d8b40 100%);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .actions button:last-child {
    background: linear-gradient(180deg, #dc3545 0%, #c82333 100%);
  }

  .actions button:last-child:hover {
    background: linear-gradient(180deg, #c82333 0%, #bd2130 100%);
  }

  .new-row {
    background: #f8f9fa;
    border-bottom: 2px solid #dee2e6;
  }

  .new-row:hover {
    background: #e9ecef;
  }

  .add-button {
    width: 100%;
  }
</style>
