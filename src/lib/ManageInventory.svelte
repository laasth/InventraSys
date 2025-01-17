<script>
  import { currentPage, apiConfig, paginationStore, filterStore, languageStore, usernameStore } from './stores.js';
  import { t, availableLanguages } from './i18n/index.js';
  import { onMount, onDestroy } from 'svelte';
  import { formatDateTime } from './utils.js';
  import { Logger } from './logger.js';

  // Reactive statement to check if any field has data
  $: hasData = Object.values(newItem).some(value => value !== '');

  let items = [];
  let newItem = {
    part_number: '',
    name: '',
    description: '',
    location: '',
    purchase_price: '',
    sale_price: '',
    quantity: ''
  };
  let editing = null;
  let searchTimeout;
  let loading = false;
  let showAddDialog = false;
  let eventSource;

  function openAddDialog() {
    showAddDialog = true;
    Logger.info('Add item dialog opened');
  }

  function closeAddDialog() {
    showAddDialog = false;
    newItem = {
      part_number: '',
      name: '',
      description: '',
      location: '',
      purchase_price: '',
      sale_price: '',
      quantity: ''
    };
    Logger.info('Add item dialog closed');
  }

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

  onMount(async () => {
    Logger.info('ManageInventory component mounted');
    if ($usernameStore) {
      await fetchItems();
    }
    setupSSE();
  });

  // Watch for username changes
  $: if ($usernameStore) {
    fetchItems();
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
        fetchItems();
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
        return;
      }
      loading = true;
      Logger.info('Fetching inventory items', {
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

  function clearSearch() {
    Logger.info('Search cleared');
    filterStore.update(state => ({
      ...state,
      searchInput: '',
      searchQuery: '',
      currentPage: 1
    }));
    paginationStore.update(state => ({ ...state, currentPage: 1 }));
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

  function changePage(page) {
    if (page >= 1 && page <= totalPages) {
      Logger.info('Page changed', { page, totalPages });
      paginationStore.update(state => ({ ...state, currentPage: page }));
    }
  }

  async function addItem() {
    try {
      Logger.info('Adding new item', { ...newItem });
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Username': $usernameStore
        },
        body: JSON.stringify({
          ...newItem,
          purchase_price: parseFloat(newItem.purchase_price),
          sale_price: parseFloat(newItem.sale_price),
          quantity: parseInt(newItem.quantity)
        })
      });
      if (response.ok) {
        Logger.info('Item added successfully');
        newItem = {
          part_number: '',
          name: '',
          description: '',
          location: '',
          purchase_price: '',
          sale_price: '',
          quantity: ''
        };
      }
    } catch (error) {
      Logger.error('Error adding item', { error: error.toString() });
    }
  }

  async function updateItem(item) {
    try {
      Logger.info('Updating item', { itemId: item.id });
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${item.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Username': $usernameStore
        },
        body: JSON.stringify({
          id: item.id,
          part_number: item.part_number,
          name: item.name,
          description: item.description,
          location: item.location,
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          quantity: item.quantity
        })
      });
      if (response.ok) {
        Logger.info('Item updated successfully', { itemId: item.id });
        editing = null;
      }
    } catch (error) {
      Logger.error('Error updating item', { error: error.toString(), itemId: item.id });
    }
  }

  async function deleteItem(id) {
    if (confirm($t('confirmations.deleteItem'))) {
      try {
        Logger.info('Deleting item', { itemId: id });
        await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${id}`, {
          method: 'DELETE',
          headers: {
            'X-Username': $usernameStore
          }
        });
        Logger.info('Item deleted successfully', { itemId: id });
      } catch (error) {
        Logger.error('Error deleting item', { error: error.toString(), itemId: id });
      }
    }
  }

  function startEdit(item) {
    editing = { ...item };
    Logger.info('Started editing item', { itemId: item.id });
  }

  function cancelEdit() {
    Logger.info('Cancelled editing item', { itemId: editing?.id });
    editing = null;
  }

  function goToList() {
    currentPage.set('list');
    Logger.info('Navigated back to list view');
  }

  function handleLogout() {
    Logger.info('User logged out', { username: $usernameStore });
    // Clear the cookie
    document.cookie = 'username=; path=/; max-age=0';
    // Reset the store
    usernameStore.set(null);
    // Go back to main page
    currentPage.set('list');
  }
</script>

<main>
  <div class="header">
    <div class="title-container">
      <div class="user-section">
        <div class="username">{$usernameStore}</div>
        <button class="logout-button" on:click={handleLogout}>{$t('dialog.logout')}</button>
      </div>
      <h2>{$t('header.title')}</h2>
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
        {#if $filterStore.searchInput}
          <button class="clear-search-button" on:click={clearSearch}>×</button>
        {/if}
      </div>
      <button class="back-button" on:click={goToList}>{$t('header.backToList')}</button>
    </div>
  </div>

  <div class="controls">
    <div class="left-controls">
      <button class="add-button" on:click={openAddDialog}>{$t('actions.add')}</button>
      <button class="stock-count-button" on:click={() => currentPage.set('stockCount')}>{$t('actions.stockCount')}</button>
      <button class="audit-log-button" on:click={() => currentPage.set('auditLog')}>{$t('auditLog.viewAuditLog')}</button>
      <button class="report-button" on:click={() => currentPage.set('report')}>{$t('report.viewReport')}</button>
    </div>
    <div class="pagination">
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
  </div>

  <div class="excel-table">
    <div class="table-container">
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
        <div class="header-cell">
          <span class="header-text">{$t('columns.lastModified')}</span>
        </div>
        <div class="header-cell">
          <span class="header-text">{$t('columns.actions')}</span>
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
              <input bind:value={editing.location} />
            </div>
            <div class="table-cell">
              <input bind:value={editing.part_number} />
            </div>
            <div class="table-cell">
              <input bind:value={editing.name} />
            </div>
            <div class="table-cell">
              <input bind:value={editing.description} />
            </div>
            <div class="table-cell">
              <input type="number" step="0.01" bind:value={editing.purchase_price} />
            </div>
            <div class="table-cell">
              <input type="number" step="0.01" bind:value={editing.sale_price} />
            </div>
            <div class="table-cell">
              <input type="number" bind:value={editing.quantity} />
            </div>
            <div class="table-cell datetime-cell">
              {formatDateTime(editing.last_modified, $t)}
            </div>
            <div class="table-cell actions">
              <button on:click={() => updateItem(editing)}>{$t('actions.save')}</button>
              <button on:click={cancelEdit}>{$t('actions.cancel')}</button>
            </div>
          {:else}
            <div class="table-cell">{item.location}</div>
            <div class="table-cell">{item.part_number}</div>
            <div class="table-cell">{item.name}</div>
            <div class="table-cell">{item.description}</div>
            <div class="table-cell">{item.purchase_price?.toFixed(2)}</div>
            <div class="table-cell">{item.sale_price?.toFixed(2)}</div>
            <div class="table-cell">{item.quantity}</div>
            <div class="table-cell datetime-cell">{formatDateTime(item.last_modified, $t)}</div>
            <div class="table-cell actions">
              <button on:click={() => startEdit(item)}>{$t('actions.edit')}</button>
              <button class="delete-button" on:click={() => deleteItem(item.id)}>{$t('actions.delete')}</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Add Item Dialog -->
  {#if showAddDialog}
    <div class="dialog-overlay">
      <div class="dialog">
        <h3>{$t('dialog.addItem')}</h3>
        <div class="dialog-content">
          <div class="form-group">
            <label for="location">{$t('columns.location')}</label>
            <input id="location" bind:value={newItem.location} />
          </div>
          <div class="form-group">
            <label for="part_number">{$t('columns.partNumber')}</label>
            <input id="part_number" bind:value={newItem.part_number} />
          </div>
          <div class="form-group">
            <label for="name">{$t('columns.name')}</label>
            <input id="name" bind:value={newItem.name} />
          </div>
          <div class="form-group">
            <label for="description">{$t('columns.description')}</label>
            <input id="description" bind:value={newItem.description} />
          </div>
          <div class="form-group">
            <label for="purchase_price">{$t('columns.purchasePrice')}</label>
            <input id="purchase_price" type="number" step="0.01" bind:value={newItem.purchase_price} />
          </div>
          <div class="form-group">
            <label for="sale_price">{$t('columns.salePrice')}</label>
            <input id="sale_price" type="number" step="0.01" bind:value={newItem.sale_price} />
          </div>
          <div class="form-group">
            <label for="quantity">{$t('columns.quantity')}</label>
            <input id="quantity" type="number" bind:value={newItem.quantity} />
          </div>
        </div>
        <div class="dialog-actions">
          <button class="cancel-button" on:click={closeAddDialog}>{$t('dialog.cancel')}</button>
          <button class="confirm-button" on:click={() => { addItem(); closeAddDialog(); }} disabled={!hasData}>{$t('actions.add')}</button>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  /* Previous styles remain unchanged up to the button styles */

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

  button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: linear-gradient(180deg, #cccccc 0%, #bbbbbb 100%);
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

  .dialog-content {
    margin-bottom: 24px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #495057;
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #dee2e6;
  }

  .cancel-button {
    background: linear-gradient(180deg, #6c757d 0%, #5a6268 100%);
  }

  .cancel-button:hover {
    background: linear-gradient(180deg, #5a6268 0%, #545b62 100%);
  }

  .confirm-button {
    background: linear-gradient(180deg, #28a745 0%, #218838 100%);
  }

  .confirm-button:hover {
    background: linear-gradient(180deg, #218838 0%, #1e7e34 100%);
  }

  .confirm-button:disabled {
    background: linear-gradient(180deg, #cccccc 0%, #bbbbbb 100%);
  }

  .delete-button {
    background: linear-gradient(180deg, #dc3545 0%, #c82333 100%);
  }

  .delete-button:hover {
    background: linear-gradient(180deg, #c82333 0%, #bd2130 100%);
  }

  .add-button {
    background: linear-gradient(180deg, #28a745 0%, #218838 100%);
  }

  .add-button:hover {
    background: linear-gradient(180deg, #218838 0%, #1e7e34 100%);
  }

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

  .logout-button {
    font-size: 12px;
    padding: 2px 8px;
    margin: 0;
    background: linear-gradient(180deg, #dc3545 0%, #c82333 100%);
  }

  .logout-button:hover {
    background: linear-gradient(180deg, #c82333 0%, #bd2130 100%);
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

  .search-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .clear-search-button {
    padding: 4px 8px;
    margin: 0;
    background: linear-gradient(180deg, #6c757d 0%, #5a6268 100%);
    min-width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .clear-search-button:hover {
    background: linear-gradient(180deg, #5a6268 0%, #545b62 100%);
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
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .left-controls {
    display: flex;
    gap: 12px;
  }

  .stock-count-button {
    background: linear-gradient(180deg, #17a2b8 0%, #138496 100%);
  }

  .stock-count-button:hover {
    background: linear-gradient(180deg, #138496 0%, #117a8b 100%);
  }

  .audit-log-button {
    background: linear-gradient(180deg, #6f42c1 0%, #6610f2 100%);
  }

  .audit-log-button:hover {
    background: linear-gradient(180deg, #6610f2 0%, #520dc2 100%);
  }

  .report-button {
    background: linear-gradient(180deg, #fd7e14 0%, #e96b02 100%);
  }

  .report-button:hover {
    background: linear-gradient(180deg, #e96b02 0%, #d66002 100%);
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

  .table-container {
    width: 100%;
    overflow-x: auto;
    min-width: 1040px;
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
    grid-template-columns: 120px 120px 150px 150px 100px 100px 80px 120px 160px;
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
    grid-template-columns: 120px 120px 150px 150px 100px 100px 80px 120px 160px;
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

  .actions {
    gap: 4px;
    padding: 8px 6px;
  }

  .datetime-cell {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  input {
    width: 90%;
    padding: 6px 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
    color: #212529;
    background-color: #f8f9fa;
  }

  input:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
  }
</style>
