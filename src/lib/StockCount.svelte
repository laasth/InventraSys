<script>
  import { currentPage, apiConfig } from './stores.js';
  import { t } from './i18n/index.js';
  import { onMount } from 'svelte';
  import { formatDateTime } from './utils.js';

  let items = [];
  let currentItemIndex = 0;
  let loading = false;
  let quantityInput = '';
  let message = '';

  onMount(async () => {
    await fetchItems();
  });

  async function fetchItems() {
    try {
      loading = true;
      // Request all items and sort by last_stock_count (oldest first)
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory?itemsPerPage=10000`);
      const data = await response.json();
      // Sort items: null last_stock_count first, then by oldest date
      items = data.items.sort((a, b) => {
        // If both are null or both have dates, compare them
        if ((!a.last_stock_count && !b.last_stock_count) || (a.last_stock_count && b.last_stock_count)) {
          return (a.last_stock_count || '').localeCompare(b.last_stock_count || '');
        }
        // If only one is null, null should come first
        return a.last_stock_count ? 1 : -1;
      });
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      loading = false;
    }
  }

  async function deleteCurrentItem() {
    if (!items[currentItemIndex]) return;
    
    const item = items[currentItemIndex];
    
    if (!confirm($t('stockCount.confirmDelete', { values: { name: item.name } }))) {
      return;
    }

    try {
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${item.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        message = $t('stockCount.deleted');
        // Remove item from array
        items = items.filter((_, index) => index !== currentItemIndex);
        // Adjust current index if we're at the end
        if (currentItemIndex >= items.length) {
          currentItemIndex = Math.max(0, items.length - 1);
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      message = $t('stockCount.error');
    }
  }

  async function updateStockCount() {
    if (!items[currentItemIndex]) return;
    
    const item = items[currentItemIndex];
    const newQuantity = parseInt(quantityInput);
    
    if (isNaN(newQuantity)) {
      message = $t('stockCount.invalidQuantity');
      return;
    }

    try {
      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/inventory/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          quantity: newQuantity,
          last_stock_count: new Date().toISOString()
        })
      });

      if (response.ok) {
        message = $t('stockCount.updated');
        // Move to next item
        if (currentItemIndex < items.length - 1) {
          currentItemIndex++;
          quantityInput = items[currentItemIndex].quantity.toString();
        } else {
          message = $t('stockCount.completed');
        }
      }
    } catch (error) {
      console.error('Error updating stock count:', error);
      message = $t('stockCount.error');
    }
  }

  function confirmCurrentQuantity() {
    if (!items[currentItemIndex]) return;
    
    // Use current quantity as the update
    quantityInput = items[currentItemIndex].quantity.toString();
    updateStockCount();
  }

  function goToInventory() {
    currentPage.set('inventory');
  }

  $: currentItem = items[currentItemIndex] || null;
  $: quantityInput = currentItem?.quantity?.toString() || '';
</script>

<main>
  <div class="header">
    <h2>{$t('stockCount.title')}</h2>
    <button class="back-button" on:click={goToInventory}>{$t('header.backToInventory')}</button>
  </div>

  {#if loading}
    <div class="loading">
      <div class="loading-spinner"></div>
    </div>
  {:else if currentItem}
    <div class="stock-count-container">
      <div class="item-details">
        <h3>{currentItem.name}</h3>
        <p class="location">{$t('columns.location')}: {currentItem.location}</p>
        <p class="part-number">{$t('columns.partNumber')}: {currentItem.part_number}</p>
        <p class="description">{currentItem.description}</p>
        <p class="last-count">{$t('stockCount.lastCounted')}: {currentItem.last_stock_count ? formatDateTime(currentItem.last_stock_count, $t) : '-'}</p>
      </div>

      <div class="count-section">
        <div class="quantity-input">
          <label for="quantity">{$t('stockCount.enterQuantity')}</label>
          <input 
            id="quantity"
            type="number"
            bind:value={quantityInput}
            min="0"
            placeholder={$t('stockCount.quantityPlaceholder')}
          />
        </div>

        <div class="actions">
          <button class="confirm-button" on:click={confirmCurrentQuantity}>
            {$t('stockCount.confirmCurrent')}
          </button>
          <button class="update-button" on:click={updateStockCount}>
            {$t('stockCount.update')}
          </button>
          <button class="delete-button" on:click={deleteCurrentItem}>
            {$t('stockCount.delete')}
          </button>
        </div>

        {#if message}
          <div class="message" class:error={message.includes('error')}>
            {message}
          </div>
        {/if}

        <div class="progress">
          {currentItemIndex + 1} / {items.length} {$t('stockCount.items')}
        </div>
      </div>
    </div>
  {:else}
    <div class="no-items">
      {$t('stockCount.noItems')}
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }

  .back-button {
    background: linear-gradient(180deg, #6c757d 0%, #5a6268 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .back-button:hover {
    background: linear-gradient(180deg, #5a6268 0%, #545b62 100%);
  }

  .stock-count-container {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 20px;
  }

  .item-details {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid #dee2e6;
  }

  .item-details h3 {
    margin: 0 0 12px 0;
    color: #212529;
  }

  .location, .part-number, .last-count {
    color: #6c757d;
    margin: 4px 0;
  }

  .description {
    margin: 8px 0;
    color: #212529;
  }

  .count-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .quantity-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quantity-input label {
    color: #495057;
    font-weight: 500;
  }

  .quantity-input input {
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 16px;
    width: 200px;
  }

  .quantity-input input:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .confirm-button, .update-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: white;
  }

  .confirm-button {
    background: linear-gradient(180deg, #28a745 0%, #218838 100%);
  }

  .confirm-button:hover {
    background: linear-gradient(180deg, #218838 0%, #1e7e34 100%);
  }

  .delete-button {
    background: linear-gradient(180deg, #dc3545 0%, #c82333 100%);
  }

  .delete-button:hover {
    background: linear-gradient(180deg, #c82333 0%, #bd2130 100%);
  }

  .update-button {
    background: linear-gradient(180deg, #007bff 0%, #0056b3 100%);
  }

  .update-button:hover {
    background: linear-gradient(180deg, #0056b3 0%, #004085 100%);
  }

  .message {
    padding: 12px;
    border-radius: 4px;
    background: #d4edda;
    color: #155724;
  }

  .message.error {
    background: #f8d7da;
    color: #721c24;
  }

  .progress {
    text-align: center;
    color: #6c757d;
    font-size: 14px;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
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

  .no-items {
    text-align: center;
    color: #6c757d;
    padding: 40px;
  }
</style>
