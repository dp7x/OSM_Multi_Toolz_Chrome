// watchlist.js

// --- Localization ---
async function loadLocale() {
  let lang = navigator.language.slice(0, 2).toLowerCase();
  if (!['it', 'en', 'sk'].includes(lang)) lang = 'en';
  const res = await fetch(`LOCALES/${lang}.json`);
  return await res.json();
}

// --- Export JSON Function ---
async function exportWatchlistJSON() {
  const { watchlist = [] } = await chrome.storage.local.get("watchlist");
  const L = await loadLocale();
  
  if (watchlist.length === 0) {
    alert(L.watchlist_empty || "Watchlist is empty");
    return;
  }

  const content = JSON.stringify(watchlist, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'watchlist-export.json';
  a.click();
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// --- Import JSON Function ---
async function importWatchlistJSON() {
  const L = await loadLocale();
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      // Validate the imported data structure
      if (!Array.isArray(importedData)) {
        throw new Error(L.import_invalid_format || "Invalid file format");
      }
      
      // Basic validation of items
      const isValid = importedData.every(item => 
        item && typeof item === 'object' && 
        item.id && item.user && item.comment && item.link
      );
      
      if (!isValid) {
        throw new Error(L.import_invalid_data || "Invalid data structure");
      }
      
      // Ask for confirmation before overwriting
      const currentData = await chrome.storage.local.get("watchlist");
      const currentCount = currentData.watchlist ? currentData.watchlist.length : 0;
      const importCount = importedData.length;
      
      const message = currentCount > 0 
        ? L.import_confirm_replace?.replace('{current}', currentCount).replace('{new}', importCount) 
          || `Current watchlist has ${currentCount} items. Replace with ${importCount} items?`
        : L.import_confirm?.replace('{count}', importCount) 
          || `Import ${importCount} items?`;
      
      if (!confirm(message)) return;
      
      // Save imported data
      await chrome.storage.local.set({ watchlist: importedData });
      alert(L.import_success?.replace('{count}', importCount) || `Successfully imported ${importCount} items!`);
      
      // Reload the watchlist
      loadWatchlist();
      
    } catch (error) {
      alert(L.import_error || "Import error: " + error.message);
    }
  };
  
  input.click();
}

// --- Modified loadWatchlist function ---
async function loadWatchlist() {
  const L = await loadLocale();
  const { watchlist = [] } = await chrome.storage.local.get("watchlist");
  const listDiv = document.getElementById("watchlist");
  listDiv.innerHTML = "";

  document.title = L.watchlist_title;

  // Add export/import buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "buttons-container";
  buttonsContainer.innerHTML = `
    <button class="export-btn" id="exportBtn">${L.export_json}</button>
    <button class="import-btn" id="importBtn">${L.import_json}</button>
  `;
  
  listDiv.appendChild(buttonsContainer);

  // Add event listeners
  document.getElementById("exportBtn").addEventListener('click', exportWatchlistJSON);
  document.getElementById("importBtn").addEventListener('click', importWatchlistJSON);

  if (watchlist.length === 0) {
    listDiv.innerHTML += `<p>${L.watchlist_empty}</p>`;
    return;
  }

  // Add items count
  const countDiv = document.createElement("div");
  countDiv.className = "watchlist-count";
  countDiv.innerHTML = `<p><strong>${L.total_items}: ${watchlist.length}</strong></p>`;
  listDiv.appendChild(countDiv);

  // Watchlist items
  watchlist.forEach(entry => {
    const item = document.createElement("div");
    item.className = "watchlist-item";
    item.innerHTML = `
      <span><b>${entry.user}</b> | ${entry.comment} | 
      <a href="${entry.link}" target="_blank">${entry.id}</a></span>
      <button class="removeBtn" title="${L.btn_remove}">❌</button>
    `;

    item.querySelector(".removeBtn").addEventListener("click", async () => {
      const newList = watchlist.filter(e => e.id !== entry.id);
      await chrome.storage.local.set({ watchlist: newList });
      loadWatchlist();
    });

    listDiv.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", loadWatchlist);