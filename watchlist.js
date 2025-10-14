// watchlist.js

// --- Localization ---
async function loadLocale() {
  let lang = navigator.language.slice(0, 2).toLowerCase();
  if (!['it', 'en', 'sk'].includes(lang)) lang = 'en';
  const res = await fetch(`LOCALES/${lang}.json`);
  return await res.json();
}

async function loadWatchlist() {
  const L = await loadLocale();
  const { watchlist = [] } = await chrome.storage.local.get("watchlist");
  const listDiv = document.getElementById("watchlist");
  listDiv.innerHTML = "";

  document.title = L.watchlist_title;

  if (watchlist.length === 0) {
    listDiv.innerHTML = `<p>${L.watchlist_empty}</p>`;
    return;
  }

  watchlist.forEach(entry => {
    const item = document.createElement("div");
    item.className = "watchlist-item";
    item.innerHTML = `
      <span><b>${entry.user}</b> | ${entry.comment} | 
      <a href="${entry.link}" target="_blank">${entry.id}</a></span>
      <button class="removeBtn" title="${L.btn_remove}">❌</button>
    `;

    // Remove button
    item.querySelector(".removeBtn").addEventListener("click", async () => {
      const newList = watchlist.filter(e => e.id !== entry.id);
      await chrome.storage.local.set({ watchlist: newList });
      loadWatchlist();
    });

    listDiv.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", loadWatchlist);
