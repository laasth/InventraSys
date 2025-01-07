<script>
  import { onMount, onDestroy } from 'svelte';
  import { currentPage } from './lib/stores.js';
  import ManageInventory from './lib/ManageInventory.svelte';

  let items = [];
  let searchTerm = '';
  let selectedItem = null;
  let showDialog = false;
  let removeQuantity = 1;
  
  $: filteredItems = items.filter(item => {
    const search = searchTerm.toLowerCase();
    return search === '' || 
           item.delenummer.toLowerCase().includes(search) || 
           item.navn.toLowerCase().includes(search);
  });
  let eventSource;

  onMount(() => {
    // Set up SSE connection
    eventSource = new EventSource('http://localhost:3000/api/updates');
    
    eventSource.onmessage = (event) => {
      items = JSON.parse(event.data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
    };
  });

  onDestroy(() => {
    if (eventSource) {
      eventSource.close();
    }
  });

  function showRemoveDialog(item) {
    selectedItem = item;
    removeQuantity = 1;
    showDialog = true;
  }

  async function confirmRemove() {
    if (!selectedItem) return;
    
    const newQuantity = Math.max(0, selectedItem.antall - removeQuantity);
    await fetch(`http://localhost:3000/api/inventory/${selectedItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selectedItem, antall: newQuantity })
    });
    
    showDialog = false;
    selectedItem = null;
    removeQuantity = 1;
  }

  function cancelRemove() {
    showDialog = false;
    selectedItem = null;
    removeQuantity = 1;
  }

  function goToManage() {
    currentPage.set('manage');
  }
</script>

{#if $currentPage === 'manage'}
  <ManageInventory />
{:else}
  <main>
    <div class="header">
      <h2>Lagerliste</h2>
      <div class="header-controls">
        <div class="search-container">
          <input 
            type="text" 
            bind:value={searchTerm} 
            placeholder="Søk etter delenummer eller navn..."
            class="search-input"
          />
        </div>
        <button class="manage-button" on:click={goToManage}>Administrer Lager</button>
      </div>
    </div>

    <div class="excel-table">
      <div class="table-header">
        <div class="header-cell">Plassering</div>
        <div class="header-cell">Delenummer</div>
        <div class="header-cell">Navn</div>
        <div class="header-cell">Beskrivelse</div>
        <div class="header-cell">Innkjøpspris</div>
        <div class="header-cell">Utsalgspris</div>
        <div class="header-cell">Antall</div>
      </div>

      <!-- Existing Items -->
      {#each filteredItems as item}
        <div class="table-row">
          <div class="table-cell">{item.lokasjon}</div>
          <div class="table-cell">{item.delenummer}</div>
          <div class="table-cell">{item.navn}</div>
          <div class="table-cell">{item.beskrivelse}</div>
          <div class="table-cell">{item.inn_pris?.toFixed(2)}</div>
          <div class="table-cell">{item.ut_pris?.toFixed(2)}</div>
          <div class="table-cell quantity-cell">
            <button class="quantity-btn minus" on:click={() => showRemoveDialog(item)}>-</button>
            <span class="quantity">{item.antall}</span>
          </div>
        </div>
      {/each}
    </div>
  </main>
{/if}

{#if showDialog}
  <div class="dialog-overlay">
    <div class="dialog">
      <h3>Fjern fra lager</h3>
      <p>Hvor mange enheter vil du fjerne fra {selectedItem?.navn}?</p>
      <div class="dialog-content">
        <input 
          type="number" 
          bind:value={removeQuantity} 
          min="1" 
          max={selectedItem?.antall} 
          class="quantity-input"
        />
      </div>
      <div class="dialog-buttons">
        <button class="cancel-btn" on:click={cancelRemove}>Avbryt</button>
        <button class="confirm-btn" on:click={confirmRemove}>Bekreft</button>
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
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .excel-table {
    border: 1px solid #c6c6c6;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: white;
    width: 100%;
    border-collapse: collapse;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    font-size: 14px;
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

  .quantity-input {
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

  .quantity-input:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
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
