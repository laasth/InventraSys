<script>
  import { currentPage, apiConfig, usernameStore } from './stores.js';
  import { t } from './i18n/index.js';
  import { onMount } from 'svelte';
  import { Logger } from './logger.js';

  let totalValue = 0;
  let totalItems = 0;
  let items = [];
  let loading = false;

  import { formatDateTime } from './utils.js';

  onMount(async () => {
    Logger.info('Report component mounted');
    if ($usernameStore) {
      await fetchReportData();
    }
  });

  async function fetchReportData() {
    try {
      loading = true;
      Logger.info('Fetching report data');

      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/report`, {
        headers: {
          'X-Username': $usernameStore
        }
      });
      const data = await response.json();
      totalValue = data.totalValue;
      totalItems = data.totalItems;
      items = data.items;
      Logger.info('Report data fetched successfully');
    } catch (error) {
      Logger.error('Error fetching report data', { error: error.toString() });
    } finally {
      loading = false;
    }
  }

  function goBack() {
    currentPage.set('manageInventory');
    Logger.info('Navigated back to inventory management');
  }
</script>

<main>
  <div class="header">
    <h2>{$t('report.title')}</h2>
    <button class="back-button" on:click={goBack}>{$t('header.backToInventory')}</button>
  </div>

  {#if loading}
    <div class="loading">
      <div class="loading-spinner"></div>
    </div>
  {:else}
    <div class="report-container">
      <div class="report-card">
        <h3>{$t('report.totalValue')}</h3>
        <p class="value">{totalValue.toFixed(2)} kr</p>
      </div>
      <div class="report-card">
        <h3>{$t('report.totalItems')}</h3>
        <p class="value">{totalItems}</p>
      </div>
    </div>

    <div class="inventory-list">
      <h3>{$t('report.inventoryList')}</h3>
      <div class="table-container">
        <div class="table-header">
          <div class="header-cell">{$t('columns.location')}</div>
          <div class="header-cell">{$t('columns.partNumber')}</div>
          <div class="header-cell">{$t('columns.name')}</div>
          <div class="header-cell">{$t('columns.description')}</div>
          <div class="header-cell">{$t('columns.purchasePrice')}</div>
          <div class="header-cell">{$t('columns.quantity')}</div>
          <div class="header-cell">{$t('columns.lastModified')}</div>
        </div>
        {#each items as item}
          <div class="table-row">
            <div class="table-cell">{item.location}</div>
            <div class="table-cell">{item.part_number}</div>
            <div class="table-cell">{item.name}</div>
            <div class="table-cell">{item.description}</div>
            <div class="table-cell">{item.purchase_price?.toFixed(2)}</div>
            <div class="table-cell">{item.quantity}</div>
            <div class="table-cell">{formatDateTime(item.last_modified, $t)}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 40px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 40px;
  }

  h2 {
    margin: 0;
    color: #212529;
  }

  .back-button {
    padding: 8px 16px;
    background: linear-gradient(180deg, #6c757d 0%, #5a6268 100%);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s ease-in-out;
  }

  .back-button:hover {
    background: linear-gradient(180deg, #5a6268 0%, #545b62 100%);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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

  .report-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    margin-top: 20px;
  }

  .report-card {
    background: #f8f9fa;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    text-align: center;
  }

  .report-card h3 {
    margin: 0 0 16px 0;
    color: #495057;
    font-size: 18px;
  }

  .value {
    font-size: 32px;
    font-weight: bold;
    color: #28a745;
    margin: 0;
  }

  .inventory-list {
    margin-top: 40px;
  }

  .inventory-list h3 {
    margin: 0 0 20px 0;
    color: #495057;
    font-size: 18px;
  }

  .table-container {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1.5fr 2fr 1fr 1fr 1.5fr;
    background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
    font-weight: bold;
  }

  .header-cell {
    padding: 12px;
    border-right: 1px solid #dee2e6;
    border-bottom: 2px solid #dee2e6;
    color: #495057;
  }

  .table-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1.5fr 2fr 1fr 1fr 1.5fr;
    border-bottom: 1px solid #dee2e6;
  }

  .table-row:nth-child(even) {
    background: #f8f9fa;
  }

  .table-cell {
    padding: 12px;
    border-right: 1px solid #dee2e6;
    color: #212529;
  }
</style>
