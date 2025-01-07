<script>
  import { onMount, onDestroy } from 'svelte';
  import { currentPage } from './lib/stores.js';
  import ManageInventory from './lib/ManageInventory.svelte';

  let items = [];
  let searchTerm = '';
  
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

  async function updateQuantity(item, change) {
    const newQuantity = Math.max(0, item.antall + change);
    await fetch(`http://localhost:3000/api/inventory/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, antall: newQuantity })
    });
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
            <button class="quantity-btn minus" on:click={() => updateQuantity(item, -1)}>-</button>
            <span class="quantity">{item.antall}</span>
            <button class="quantity-btn plus" on:click={() => updateQuantity(item, 1)}>+</button>
          </div>
        </div>
      {/each}
    </div>
  </main>
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

  .quantity-btn.plus {
    background: linear-gradient(180deg, #28a745 0%, #218838 100%);
  }

  .quantity-btn.plus:hover {
    background: linear-gradient(180deg, #218838 0%, #1e7e34 100%);
  }
</style>
