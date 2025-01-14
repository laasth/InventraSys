<script>
  import { currentPage, apiConfig, paginationStore, usernameStore } from './stores.js';
  let selectedLog = null;
  let showDetailsDialog = false;
  import { t } from './i18n/index.js';
  import { formatDateTime } from './utils.js';
  import { onMount } from 'svelte';

  let logs = [];
  let loading = false;

  // Subscribe to pagination store
  $: ({ currentPage: pageNum, itemsPerPage, totalItems, totalPages } = $paginationStore);

  // Computed properties for pagination
  $: startItem = (pageNum - 1) * itemsPerPage + 1;
  $: endItem = Math.min(pageNum * itemsPerPage, totalItems);
  $: pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  onMount(async () => {
    await fetchLogs();
  });

  async function fetchLogs() {
    try {
      loading = true;
      const params = new URLSearchParams({
        page: pageNum.toString(),
        itemsPerPage: itemsPerPage.toString()
      });

      const response = await fetch(`http://${$apiConfig.host}:${$apiConfig.port}/api/audit-logs?${params}`);
      const data = await response.json();
      logs = data.logs;
      paginationStore.set(data.pagination);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      loading = false;
    }
  }

  function changePage(page) {
    if (page >= 1 && page <= totalPages) {
      paginationStore.update(state => ({ ...state, currentPage: page }));
    }
  }

  function formatValue(value, truncate = true) {
    if (!value) return '-';
    try {
      const parsed = JSON.parse(value);
      const formatted = Object.entries(parsed)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');
      return truncate ? formatted : Object.entries(parsed)
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n');
    } catch {
      return value;
    }
  }

  function showDetails(log) {
    selectedLog = log;
    showDetailsDialog = true;
  }

  function closeDetails() {
    showDetailsDialog = false;
    selectedLog = null;
  }

  function goToInventory() {
    currentPage.set('manage');
  }
</script>

<main>
  <div class="header">
    <div class="title-container">
      <h2>{$t('auditLog.title')}</h2>
    </div>
    <button class="back-button" on:click={goToInventory}>{$t('header.backToInventory')}</button>
  </div>

  <p class="description">{$t('auditLog.description')}</p>

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

  <div class="audit-table">
    {#if loading}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    {/if}

    <div class="table-header">
      <div class="header-cell">{$t('auditLog.timestamp')}</div>
      <div class="header-cell">{$t('auditLog.username')}</div>
      <div class="header-cell">{$t('auditLog.action')}</div>
      <div class="header-cell">{$t('auditLog.itemName')}</div>
      <div class="header-cell">{$t('auditLog.partNumber')}</div>
      <div class="header-cell">{$t('auditLog.oldValue')}</div>
      <div class="header-cell">{$t('auditLog.newValue')}</div>
    </div>

    {#if logs.length === 0}
      <div class="no-logs">{$t('auditLog.noLogs')}</div>
    {:else}
      {#each logs as log}
        <div class="table-row">
          <div class="table-cell">{formatDateTime(log.timestamp, $t)}</div>
          <div class="table-cell">{log.username}</div>
          <div class="table-cell">{log.action}</div>
          <div class="table-cell">{log.item_name || '-'}</div>
          <div class="table-cell">{log.item_part_number || '-'}</div>
          <div class="table-cell value-cell clickable" on:click={() => showDetails(log)} title={$t('auditLog.viewDetails')}>
            {formatValue(log.old_value)}
          </div>
          <div class="table-cell value-cell clickable" on:click={() => showDetails(log)} title={$t('auditLog.viewDetails')}>
            {formatValue(log.new_value)}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</main>

{#if showDetailsDialog && selectedLog}
  <div class="dialog-overlay">
    <div class="dialog">
      <h3>{$t('auditLog.valueDetails')}</h3>
      <div class="dialog-content">
        <div class="value-section">
          <h4>{$t('auditLog.oldValue')}</h4>
          <pre>{formatValue(selectedLog.old_value, false)}</pre>
        </div>
        <div class="value-section">
          <h4>{$t('auditLog.newValue')}</h4>
          <pre>{formatValue(selectedLog.new_value, false)}</pre>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="close-button" on:click={closeDetails}>{$t('auditLog.closeDetails')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .title-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .clickable {
    cursor: pointer;
  }

  .clickable:hover {
    background-color: #e9ecef;
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
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .dialog h3 {
    margin: 0 0 16px 0;
    color: #212529;
  }

  .dialog h4 {
    margin: 0 0 8px 0;
    color: #495057;
    font-size: 14px;
  }

  .dialog-content {
    margin-bottom: 24px;
  }

  .value-section {
    margin-bottom: 16px;
  }

  .value-section:last-child {
    margin-bottom: 0;
  }

  pre {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 4px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: monospace;
    font-size: 13px;
    color: #212529;
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #dee2e6;
  }

  .close-button {
    background: linear-gradient(180deg, #6c757d 0%, #5a6268 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .close-button:hover {
    background: linear-gradient(180deg, #5a6268 0%, #545b62 100%);
  }

  .description {
    color: #6c757d;
    margin: 0 0 20px 0;
    font-size: 14px;
    line-height: 1.5;
  }

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
    margin-bottom: 20px;
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

  .audit-table {
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
    grid-template-columns: 150px 120px 100px 150px 120px 1fr 1fr;
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
  }

  .table-row {
    display: grid;
    grid-template-columns: 150px 120px 100px 150px 120px 1fr 1fr;
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

  .table-cell {
    padding: 8px 12px;
    border-right: 1px solid #dee2e6;
    display: flex;
    align-items: center;
    color: #212529;
    line-height: 1.4;
  }

  .value-cell {
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-logs {
    padding: 20px;
    text-align: center;
    color: #6c757d;
    grid-column: 1 / -1;
  }
</style>
