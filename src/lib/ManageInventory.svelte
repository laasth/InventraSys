<script>
  import { currentPage } from './stores.js';
  import { onMount, onDestroy } from 'svelte';

  let items = [];
  let eventSource;
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

  async function addItem() {
    const response = await fetch('http://localhost:3000/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newItem,
        inn_pris: parseFloat(newItem.inn_pris),
        ut_pris: parseFloat(newItem.ut_pris),
        antall: parseInt(newItem.antall)
      })
    });
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

  async function updateItem(item) {
    await fetch(`http://localhost:3000/api/inventory/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    editing = null;
  }

  async function deleteItem(id) {
    if (confirm('Er du sikker på at du vil slette denne varen?')) {
      await fetch(`http://localhost:3000/api/inventory/${id}`, {
        method: 'DELETE'
      });
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
    <button class="back-button" on:click={goToList}>Tilbake til Liste</button>
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
      <div class="header-cell">Handlinger</div>
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
