// ReadSmart AI - Multi-Tab Summary Popup

let allTabs = [];
let selectedTabs = [];
let summaryResults = [];
let progressPollInterval = null;

// Initialize popup
async function init() {
  if (window.READSMART_DEBUG?.enabled) {
    console.log('[ReadSmart Popup] Initializing...');
  }

  // Restore previous state from storage
  await restoreState();

  // Check for ongoing batch process
  await checkBatchProgress();

  // Load tabs
  await loadTabs();

  // Setup event listeners
  document.getElementById('select-all-btn').addEventListener('click', toggleSelectAll);
  document.getElementById('summarize-btn').addEventListener('click', summarizeSelected);
  document.getElementById('export-btn')?.addEventListener('click', showExportMenu);
  document.getElementById('clear-btn')?.addEventListener('click', clearResults);
}

// Check for ongoing batch progress
async function checkBatchProgress() {
  const response = await chrome.runtime.sendMessage({ action: 'getBatchProgress' });

  if (response.success && response.progress) {
    const progress = response.progress;

    if (progress.status === 'running') {
      if (window.READSMART_DEBUG?.enabled) {
        console.log('[ReadSmart Popup] Resuming batch progress display');
      }
      startProgressPolling();
    } else if (progress.status === 'completed') {
      if (window.READSMART_DEBUG?.enabled) {
        console.log('[ReadSmart Popup] Batch completed, loading results');
      }
      summaryResults = progress.results;
    }
  }
}

// Save state to storage
async function saveState() {
  try {
    await chrome.storage.local.set({
      popupState: {
        selectedTabs,
        summaryResults,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[ReadSmart Popup] Error saving state:', error);
  }
}

// Restore state from storage
async function restoreState() {
  try {
    const { popupState } = await chrome.storage.local.get(['popupState']);

    if (popupState) {
      // Only restore if less than 30 minutes old
      const ageMinutes = (Date.now() - popupState.timestamp) / 60000;
      if (ageMinutes < 30) {
        selectedTabs = popupState.selectedTabs || [];
        summaryResults = popupState.summaryResults || [];
        if (window.READSMART_DEBUG?.enabled) {
          console.log('[ReadSmart Popup] Restored state:', selectedTabs.length, 'selected tabs,', summaryResults.length, 'results');
        }
      } else {
        if (window.READSMART_DEBUG?.enabled) {
          console.log('[ReadSmart Popup] State too old, starting fresh');
        }
      }
    }
  } catch (error) {
    console.error('[ReadSmart Popup] Error restoring state:', error);
  }
}

// Load all tabs
async function loadTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Filter for readable tabs (http/https only)
    allTabs = tabs.filter(tab =>
      tab.url &&
      (tab.url.startsWith('http://') || tab.url.startsWith('https://')) &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://')
    );

    if (window.READSMART_DEBUG?.enabled) {
      console.log('[ReadSmart Popup] Loaded', allTabs.length, 'tabs');
    }

    displayTabs();

  } catch (error) {
    console.error('[ReadSmart Popup] Error loading tabs:', error);
    showError('Failed to load tabs');
  }
}

// Display tabs in list
function displayTabs() {
  const loadingEl = document.getElementById('tabs-loading');
  const tabsList = document.getElementById('tabs-list');

  if (allTabs.length === 0) {
    loadingEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No readable tabs found.<br/>Open some web pages to summarize them.</div>
      </div>
    `;
    return;
  }

  loadingEl.style.display = 'none';
  tabsList.style.display = 'block';

  tabsList.innerHTML = '';

  allTabs.forEach(tab => {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.dataset.tabId = tab.id;

    // Check if this tab was previously selected
    const isSelected = selectedTabs.includes(tab.id);

    tabItem.innerHTML = `
      <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}" ${isSelected ? 'checked' : ''}>
      <img src="${tab.favIconUrl || chrome.runtime.getURL('icons/icon16.png')}" class="tab-favicon" alt="">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
        <div class="tab-url">${new URL(tab.url).hostname}</div>
      </div>
    `;

    if (isSelected) {
      tabItem.classList.add('selected');
    }

    // Click handler
    tabItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-checkbox')) return;
      const checkbox = tabItem.querySelector('.tab-checkbox');
      checkbox.checked = !checkbox.checked;
      toggleTabSelection(tab.id, checkbox.checked);
    });

    // Checkbox handler
    const checkbox = tabItem.querySelector('.tab-checkbox');
    checkbox.addEventListener('change', (e) => {
      toggleTabSelection(tab.id, e.target.checked);
    });

    tabsList.appendChild(tabItem);
  });

  updateStats();
  updateSummarizeButton();

  // Display results if they exist
  if (summaryResults.length > 0) {
    displayResults();
  }
}

// Toggle tab selection
function toggleTabSelection(tabId, selected) {
  if (selected) {
    if (!selectedTabs.includes(tabId)) {
      selectedTabs.push(tabId);
    }
  } else {
    selectedTabs = selectedTabs.filter(id => id !== tabId);
  }

  // Update UI
  const tabItem = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  if (tabItem) {
    if (selected) {
      tabItem.classList.add('selected');
    } else {
      tabItem.classList.remove('selected');
    }
  }

  updateStats();
  updateSummarizeButton();
  saveState(); // Save state when selection changes
}

// Toggle select all
function toggleSelectAll() {
  const allSelected = selectedTabs.length === allTabs.length;

  if (allSelected) {
    // Deselect all
    selectedTabs = [];
    document.querySelectorAll('.tab-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('selected'));
  } else {
    // Select all
    selectedTabs = allTabs.map(tab => tab.id);
    document.querySelectorAll('.tab-checkbox').forEach(cb => cb.checked = true);
    document.querySelectorAll('.tab-item').forEach(item => item.classList.add('selected'));
  }

  updateStats();
  updateSummarizeButton();
}

// Update stats
function updateStats() {
  document.getElementById('selected-count').textContent = selectedTabs.length;
  document.getElementById('articles-count').textContent = allTabs.length;

  // Update select all button text
  const selectAllBtn = document.getElementById('select-all-btn');
  if (selectedTabs.length === allTabs.length && allTabs.length > 0) {
    selectAllBtn.textContent = 'Deselect All';
  } else {
    selectAllBtn.textContent = 'Select All';
  }
}

// Update summarize button state
function updateSummarizeButton() {
  const btn = document.getElementById('summarize-btn');
  btn.disabled = selectedTabs.length === 0;

  if (selectedTabs.length > 0) {
    btn.innerHTML = `<span>📝 Summarize ${selectedTabs.length} Tab${selectedTabs.length > 1 ? 's' : ''}</span>`;
  } else {
    btn.innerHTML = `<span>📝 Summarize Selected Tabs</span>`;
  }
}

// Summarize selected tabs
async function summarizeSelected() {
  if (selectedTabs.length === 0) return;

  if (window.READSMART_DEBUG?.enabled) {
    console.log('[ReadSmart Popup] Starting batch summary for', selectedTabs.length, 'tabs');
  }

  // Clear previous results
  summaryResults = [];

  // Start the batch process in background
  const response = await chrome.runtime.sendMessage({
    action: 'startBatchSummary',
    tabIds: selectedTabs
  });

  if (response.success) {
    if (window.READSMART_DEBUG?.enabled) {
      console.log('[ReadSmart Popup] Batch summary started in background');
    }
    startProgressPolling();
  } else {
    showError('Failed to start batch summary');
  }
}

// Start polling for progress updates
function startProgressPolling() {
  const btn = document.getElementById('summarize-btn');
  btn.disabled = true;

  // Poll every 500ms
  if (progressPollInterval) {
    clearInterval(progressPollInterval);
  }

  progressPollInterval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ action: 'getBatchProgress' });

    if (response.success && response.progress) {
      const progress = response.progress;

      // Update button with progress
      btn.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></div>
          <span>Summarizing ${progress.current}/${progress.total}...</span>
        </div>
      `;

      // Check if completed
      if (progress.status === 'completed') {
        if (window.READSMART_DEBUG?.enabled) {
          console.log('[ReadSmart Popup] Batch summary completed!');
        }
        clearInterval(progressPollInterval);
        progressPollInterval = null;

        // Load results
        summaryResults = progress.results;

        // Display results
        displayResults();

        // Update stats
        const timeSaved = progress.total * 4; // ~4 min per article
        document.getElementById('time-saved').textContent = timeSaved;

        // Reset button
        btn.disabled = false;
        updateSummarizeButton();

        // Save state
        await saveState();
      }
    }
  }, 500);
}

// Display results
function displayResults() {
  const resultsSection = document.getElementById('results-section');
  const resultsContent = document.getElementById('results-content');

  resultsSection.style.display = 'block';
  resultsContent.innerHTML = '';

  summaryResults.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';

    const summary = result.error
      ? `<p style="color: #dc3545; font-style: italic;">${escapeHtml(result.summary)}</p>`
      : formatSummary(result.summary);

    resultItem.innerHTML = `
      <div class="result-header">
        <img src="${result.tab.favIconUrl || chrome.runtime.getURL('icons/icon16.png')}" class="result-favicon" alt="">
        <div class="result-title">${escapeHtml(result.tab.title || 'Untitled')}</div>
      </div>
      <div class="result-summary">${summary}</div>
    `;

    resultsContent.appendChild(resultItem);
  });

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Format summary
function formatSummary(summary) {
  // Convert bullet points to HTML list
  const lines = summary.split('\n').filter(line => line.trim());

  if (lines.length > 1 && lines.some(line => line.trim().startsWith('-') || line.trim().startsWith('•'))) {
    let html = '<ul>';
    lines.forEach(line => {
      const cleaned = line.trim().replace(/^[-•]\s*/, '');
      if (cleaned) {
        html += `<li>${escapeHtml(cleaned)}</li>`;
      }
    });
    html += '</ul>';
    return html;
  } else {
    return `<p>${escapeHtml(summary)}</p>`;
  }
}

// Show export menu
function showExportMenu() {
  const existingMenu = document.querySelector('.export-menu');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'export-menu';
  menu.innerHTML = `
    <button class="export-option" data-format="text">📄 Export as Text (.txt)</button>
    <button class="export-option" data-format="markdown">📝 Export as Markdown (.md)</button>
    <button class="export-option" data-format="html">🌐 Export as HTML (.html)</button>
  `;

  menu.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => {
      exportResults(btn.dataset.format);
      menu.remove();
    });
  });

  const exportBtn = document.getElementById('export-btn');
  exportBtn.parentElement.style.position = 'relative';
  exportBtn.parentElement.appendChild(menu);

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && e.target.id !== 'export-btn') {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Export results in different formats
function exportResults(format) {
  let content = '';
  let filename = `ReadSmart-Summary-${Date.now()}`;
  let mimeType = 'text/plain';

  const timestamp = new Date().toLocaleString();

  if (format === 'text') {
    content = `ReadSmart AI - Multi-Tab Summary\nGenerated: ${timestamp}\n\n`;
    summaryResults.forEach((result, index) => {
      content += `${index + 1}. ${result.tab.title}\n`;
      content += `   URL: ${result.tab.url}\n`;
      content += `   Summary:\n${result.summary}\n\n`;
    });
    filename += '.txt';
    mimeType = 'text/plain';
  } else if (format === 'markdown') {
    content = `# ReadSmart AI - Multi-Tab Summary\n\n*Generated: ${timestamp}*\n\n---\n\n`;
    summaryResults.forEach((result, index) => {
      content += `## ${index + 1}. ${result.tab.title}\n\n`;
      content += `**URL:** [${result.tab.url}](${result.tab.url})\n\n`;
      content += `**Summary:**\n\n${result.summary}\n\n---\n\n`;
    });
    filename += '.md';
    mimeType = 'text/markdown';
  } else if (format === 'html') {
    content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReadSmart AI - Multi-Tab Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
    }
    .summary-item {
      background: white;
      padding: 25px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .summary-item h2 {
      margin: 0 0 15px 0;
      color: #667eea;
      font-size: 20px;
    }
    .summary-item .url {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
      word-break: break-all;
    }
    .summary-item .url a {
      color: #667eea;
      text-decoration: none;
    }
    .summary-item .url a:hover {
      text-decoration: underline;
    }
    .summary-item .summary-content {
      color: #444;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✨ ReadSmart AI - Multi-Tab Summary</h1>
    <p>Generated: ${timestamp}</p>
  </div>
`;
    summaryResults.forEach((result, index) => {
      content += `
  <div class="summary-item">
    <h2>${index + 1}. ${escapeHtml(result.tab.title)}</h2>
    <div class="url">🔗 <a href="${result.tab.url}" target="_blank">${escapeHtml(result.tab.url)}</a></div>
    <div class="summary-content">${escapeHtml(result.summary)}</div>
  </div>
`;
    });
    content += `
</body>
</html>`;
    filename += '.html';
    mimeType = 'text/html';
  }

  // Download file
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  if (window.READSMART_DEBUG?.enabled) {
    console.log('[ReadSmart Popup] Exported as', format);
  }
}

// Clear results
async function clearResults() {
  // Stop polling if running
  if (progressPollInterval) {
    clearInterval(progressPollInterval);
    progressPollInterval = null;
  }

  // Cancel batch summary in background
  await chrome.runtime.sendMessage({ action: 'cancelBatchSummary' });

  summaryResults = [];
  selectedTabs = [];
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('time-saved').textContent = '0';

  // Deselect all checkboxes
  document.querySelectorAll('.tab-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('selected'));

  // Reset button
  const btn = document.getElementById('summarize-btn');
  btn.disabled = false;
  updateSummarizeButton();

  updateStats();
  saveState(); // Save cleared state
}

// Show error
function showError(message) {
  const loadingEl = document.getElementById('tabs-loading');
  loadingEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <div class="empty-state-text">${escapeHtml(message)}</div>
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (progressPollInterval) {
    clearInterval(progressPollInterval);
  }
});
