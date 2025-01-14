<script>
  import { onMount, onDestroy } from 'svelte';
  import { currentPage, paginationStore, filterStore, apiConfig, languageStore, usernameStore } from './lib/stores.js';
  import { t, availableLanguages } from './lib/i18n/index.js';
  import { Logger } from './lib/logger.js';
  import ManageInventory from './lib/ManageInventory.svelte';
  import StockCount from './lib/StockCount.svelte';
  import AuditLog from './lib/AuditLog.svelte';

  const isDev = import.meta.env.DEV;

  let items = [];
  let selectedItem = null;
  let showDialog = false;
  let showUsernameDialog = false;
  let usernameInput = '';
  let removeQuantity = 1;
  let loading = false;
  let searchTimeout;
  let eventSource;

  // Subscribe to stores
  $: ({ currentPage: pageNum, itemsPerPage, totalItems, totalPages } = $paginationStore);
  $: ({ searchQuery, searchInput, sortBy, sortOrder } = $filterStore);

  // Computed properties for pagination
  $: startItem = (pageNum - 1) * itemsPerPage + 1;
  $: endItem = Math.min(pageNum * itemsPerPage, totalItems);
  $: pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  function changePage(page) {
    if (page >= 1 && page <= totalPages) {
      paginationStore.update(state => ({ ...state, currentPage: page }));
      Logger.info('Page changed', { page, totalPages });
    }
  }

  // Watch for changes in pagination or filter settings
  $: {
    if (pageNum || itemsPerPage || searchQuery || sortBy || sortOrder) {
      fetchItems();
    }
  }

  onMount(() => {
    Logger.info('App component mounted');
    if (!$usernameStore) {
      if (isDev) {
        // In development mode, automatically set username to "develop"
        usernameStore.set('develop');
        Logger.info('Development mode: username set to develop');
      } else {
        showUsernameDialog = true;
        Logger.info('Username dialog shown');
      }
    }
    fetchItems();
    setupSSE();
  });

  async function handleUsernameSubmit() {
    if (usernameInput.trim()) {
      usernameStore.set(usernameInput.trim());
      Logger.info('Username set', { username: usernameInput.trim() });
      showUsernameDialog = false;
      // Fetch items after username is set
      await fetchItems();
    }
  }

  onDestroy(() => {
    if (eventSource) {
      eventSource.close();
      Logger.info('SSE connection closed');
    }
  });

  function setupSSE() {
    Logger.info('Setting up SSE connection');
    eventSource = new EventSource(`http://${$apiConfig.host}:${$apiConfig.port}/api/updates`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'update') {
        Logger.info('SSE update received', { data });
        fetchItems(); // Refresh data when we receive an update
      }
    };

    eventSource.onerror = (error) => {
      Logger.error('SSE connection error', { error: error.toString() });
      eventSource.close();
      // Retry connection after 5 seconds
      setTimeout(setupSSE, 5000);
    };
  }

  async function fetchItems() {
    try {
      if (!$usernameStore) {
        if (!isDev) {
          showUsernameDialog = true;
          Logger.info('Username dialog shown due to missing username');
        }
        return;
      }

      loading = true;
      Logger.info('Fetching items', { 
        page: pageNum, 
        itemsPerPage, 
        searchQuery, 
        sortBy, 
        sortOrder 
      });

      const params = new URLSearchParams({
        page: pageNum.toString(),
        itemsPerPage: itemsPerPage.toString(),
        searchQuery,
        sortBy,
        sortOrder
      });

      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory?${params}`, {
        headers: {
          'X-Username': $usernameStore
        }
      });
      const data = await response.json();
      items = data.items;
      paginationStore.set(data.pagination);
      Logger.info('Items fetched successfully', { itemCount: items.length });
    } catch (error) {
      Logger.error('Error fetching items', { error: error.toString() });
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      Logger.info('Search query updated', { query: $filterStore.searchInput });
      filterStore.update(state => ({ 
        ...state, 
        searchQuery: $filterStore.searchInput,
        currentPage: 1 
      }));
      paginationStore.update(state => ({ ...state, currentPage: 1 }));
    }, 300);
  }

  function handleSort(column) {
    const newOrder = $filterStore.sortBy === column && $filterStore.sortOrder === 'asc' ? 'desc' : 'asc';
    Logger.info('Sort changed', { column, order: newOrder });
    filterStore.update(state => ({
      ...state,
      sortBy: column,
      sortOrder: newOrder
    }));
  }

  function showRemoveDialog(item) {
    selectedItem = item;
    removeQuantity = 1;
    showDialog = true;
    Logger.info('Remove dialog shown', { 
      itemId: item.id, 
      itemName: item.name 
    });
  }

  async function confirmRemove() {
    if (!selectedItem) return;
    
    try {
      const newQuantity = Math.max(0, selectedItem.quantity - removeQuantity);
      Logger.info('Updating item quantity', { 
        itemId: selectedItem.id,
        oldQuantity: selectedItem.quantity,
        newQuantity,
        change: -removeQuantity
      });

      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Username': $usernameStore
        },
        body: JSON.stringify({ ...selectedItem, quantity: newQuantity })
      });
      
      if (response.ok) {
        showDialog = false;
        selectedItem = null;
        removeQuantity = 1;
        Logger.info('Item quantity updated successfully');
        await fetchItems();
      }
    } catch (error) {
      Logger.error('Error updating quantity', { 
        error: error.toString(),
        itemId: selectedItem?.id,
        quantity: removeQuantity 
      });
    }
  }

  function cancelRemove() {
    showDialog = false;
    selectedItem = null;
    removeQuantity = 1;
    Logger.info('Remove dialog cancelled');
  }

  function goToManage() {
    currentPage.set('manage');
    Logger.info('Navigation to manage inventory');
  }
</script>

{#if $currentPage === 'manage'}
  <ManageInventory />
{:else if $currentPage === 'stockCount'}
  <StockCount />
{:else if $currentPage === 'auditLog'}
  <AuditLog />
{:else}
  <main>
    <div class="header">
      <div class="title-container">
        <div class="user-section">
          <div class="username">{$usernameStore}</div>
        </div>
        <h2>{$t('header.listTitle')}</h2>
      </div>
      <div class="header-controls">
        <select 
          bind:value={$languageStore}
          class="language-select"
        >
          {#each availableLanguages as lang}
            <option value={lang.code}>{lang.name}</option>
          {/each}
        </select>
        <div class="search-container">
          <input 
            type="text" 
            bind:value={$filterStore.searchInput} 
            on:input={handleSearch}
            placeholder={$t('header.search')}
            class="search-input"
          />
        </div>
        <button class="manage-button" on:click={goToManage}>{$t('header.manageInventory')}</button>
      </div>
    </div>

    <div class="controls">
      <span class="pagination-info">
        {$t('pagination.showing')} {startItem}-{endItem} {$t('pagination.of')} {totalItems} {$t('pagination.items')}
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

    <div class="excel-table">
      {#if loading}
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
        </div>
      {/if}

      <div class="table-header">
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('location')}
          on:keydown={e => e.key === 'Enter' && handleSort('location')}
          role="columnheader"
          aria-sort={sortBy === 'location' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.location')}</span>
          {#if sortBy === 'location'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('part_number')}
          on:keydown={e => e.key === 'Enter' && handleSort('part_number')}
          role="columnheader"
          aria-sort={sortBy === 'part_number' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.partNumber')}</span>
          {#if sortBy === 'part_number'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('name')}
          on:keydown={e => e.key === 'Enter' && handleSort('name')}
          role="columnheader"
          aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.name')}</span>
          {#if sortBy === 'name'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('description')}
          on:keydown={e => e.key === 'Enter' && handleSort('description')}
          role="columnheader"
          aria-sort={sortBy === 'description' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.description')}</span>
          {#if sortBy === 'description'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('purchase_price')}
          on:keydown={e => e.key === 'Enter' && handleSort('purchase_price')}
          role="columnheader"
          aria-sort={sortBy === 'purchase_price' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.purchasePrice')}</span>
          {#if sortBy === 'purchase_price'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('sale_price')}
          on:keydown={e => e.key === 'Enter' && handleSort('sale_price')}
          role="columnheader"
          aria-sort={sortBy === 'sale_price' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.salePrice')}</span>
          {#if sortBy === 'sale_price'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
        <button 
          class="header-cell sortable" 
          on:click={() => handleSort('quantity')}
          on:keydown={e => e.key === 'Enter' && handleSort('quantity')}
          role="columnheader"
          aria-sort={sortBy === 'quantity' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span class="header-text">{$t('columns.quantity')}</span>
          {#if sortBy === 'quantity'}
            <span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          {/if}
        </button>
      </div>

      <!-- Existing Items -->
      {#each items as item}
        <div class="table-row">
          <div class="table-cell">{item.location}</div>
          <div class="table-cell">{item.part_number}</div>
          <div class="table-cell">{item.name}</div>
          <div class="table-cell">{item.description}</div>
          <div class="table-cell">{item.purchase_price?.toFixed(2)}</div>
          <div class="table-cell">{item.sale_price?.toFixed(2)}</div>
          <div class="table-cell quantity-cell">
            <button class="quantity-btn minus" on:click={() => showRemoveDialog(item)}>-</button>
            <span class="quantity">{item.quantity}</span>
          </div>
        </div>
      {/each}
    </div>
  </main>
{/if}

{#if showUsernameDialog}
  <div class="dialog-overlay">
    <div class="dialog">
      <h3>{$t('dialog.welcome')}</h3>
      <p>{$t('dialog.enterUsername')}</p>
      <div class="dialog-content">
        <input 
          type="text" 
          bind:value={usernameInput}
          placeholder={$t('dialog.usernamePlaceholder')}
          class="username-input"
          on:keydown={e => e.key === 'Enter' && handleUsernameSubmit()}
        />
      </div>
      <div class="dialog-buttons">
        <button class="confirm-btn" on:click={handleUsernameSubmit}>{$t('dialog.submit')}</button>
      </div>
    </div>
  </div>
{/if}

{#if showDialog}
  <div class="dialog-overlay">
    <div class="dialog">
      <h3>{$t('dialog.removeFromInventory')}</h3>
      <p>{$t('dialog.removeUnits').replace('{name}', selectedItem?.name)}</p>
      <div class="dialog-content">
        <input 
          type="number" 
          bind:value={removeQuantity} 
          min="1" 
          max={selectedItem?.quantity} 
          class="quantity-input"
        />
      </div>
      <div class="dialog-buttons">
        <button class="cancel-btn" on:click={cancelRemove}>{$t('dialog.cancel')}</button>
        <button class="confirm-btn" on:click={confirmRemove}>{$t('dialog.confirm')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .title-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .username {
    font-size: 12px;
    color: #6c757d;
  }

  .header-controls {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .language-select {
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
    background-color: #f8f9fa;
    color: #212529;
    cursor: pointer;
  }

  .language-select:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
  }

  .controls {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 20px;
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

  h2 {
    margin: 0;
    color: #212529;
  }

  .manage-button {
    background: linear-gradient(180deg, #007bff 0%, #0056b3 100%);
    padding: 8px 16px;
  }

  .manage-button:hover {
    background: linear-gradient(180deg, #0056b3 0%, #004085 100%);
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 40px;
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
    grid-template-columns: 1fr 1.2fr 1.5fr 1.5fr 1fr 1fr 0.8fr;
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
    grid-template-columns: 1fr 1.2fr 1.5fr 1.5fr 1fr 1fr 0.8fr;
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

  .quantity-cell {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .quantity {
    min-width: 30px;
    text-align: center;
    font-weight: bold;
  }

  .quantity-btn {
    padding: 2px 8px;
    margin: 0;
    font-size: 16px;
    font-weight: bold;
    min-width: 28px;
  }

  .quantity-btn.minus {
    background: linear-gradient(180deg, #dc3545 0%, #c82333 100%);
  }

  .quantity-btn.minus:hover {
    background: linear-gradient(180deg, #c82333 0%, #bd2130 100%);
  }

  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 100%;
    max-width: 400px;
  }

  .dialog h3 {
    margin: 0 0 16px 0;
    color: #212529;
  }

  .dialog p {
    margin: 0 0 16px 0;
    color: #495057;
  }

  .dialog-content {
    margin-bottom: 24px;
  }

  .quantity-input,
  .username-input {
    width: 120px;
    padding: 6px 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
    color: #212529;
    background-color: #f8f9fa;
    margin: 0 auto;
    display: block;
  }

  .quantity-input:focus,
  .username-input:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
  }

  .username-input {
    width: 100%;
  }

  .dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .cancel-btn {
    background: #6c757d;
    color: white;
  }

  .cancel-btn:hover {
    background: #5a6268;
  }

  .confirm-btn {
    background: #dc3545;
    color: white;
  }

  .confirm-btn:hover {
    background: #c82333;
  }
</style>
