import { api, showToast, escapeHtml, initTopbar, showEmpty, showError } from '/app.js';

const scriptList = document.querySelector('#scriptList');

async function loadScripts() {
  try {
    const scripts = await api('/api/scripts');
    if (!scripts.length) {
      showEmpty(scriptList, 'Belum ada script yang tersedia.');
      return;
    }

    scriptList.innerHTML = scripts.map(s => `
      <article class="script-card glass-panel" data-id="${s.id}">
        <div class="script-image">
          ${s.image_url ? `<img src="${escapeHtml(s.image_url)}" alt="${escapeHtml(s.title)}" loading="lazy">` : `<div class="script-placeholder">📦</div>`}
        </div>
        <div class="script-body">
          <span class="badge">${escapeHtml(s.category)}</span>
          <h3>${escapeHtml(s.title)}</h3>
          <p class="muted">${escapeHtml(s.description)}</p>
          <div class="script-actions">
            <span class="stats">⬇️ <span class="download-count">${s.downloads}</span> downloads</span>
            <div class="script-btns">
              <button class="btn-icon share-script-btn" data-id="${s.id}" title="Share">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
              <button class="btn primary sm download-script-btn" data-id="${s.id}" data-url="${escapeHtml(s.download_url)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </button>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    // Wire Download Buttons
    scriptList.querySelectorAll('.download-script-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const url = btn.dataset.url;
        
        // Ganti teks tombol jadi animasi 3 titik
        btn.disabled = true;
        btn.innerHTML = `<div class="dot-loading"><span></span><span></span><span></span></div>`;

        // Tunggu 1.5 detik untuk efek animasi
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Buka link download
        window.open(url, '_blank');

        // Update hitungan download real-time
        try {
          const res = await api(`/api/scripts/${id}/download`, { method: 'POST', body: '{}' });
          const countEl = btn.closest('.script-card').querySelector('.download-count');
          if (countEl) countEl.textContent = res.downloads;
        } catch (e) { /* Abaikan error count */ }

        // Kembalikan tombol ke semula
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;
      });
    });

    // Wire Share Buttons
    scriptList.querySelectorAll('.share-script-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = window.location.href;
        if (navigator.share) {
          try { await navigator.share({ title: 'Download Script AndriCode', url }); } catch (e) {}
        } else {
          try { await navigator.clipboard.writeText(url); showToast('Link berhasil disalin!'); } catch {}
        }
      });
    });

  } catch (error) {
    showError(scriptList, 'Gagal memuat daftar script.');
  }
}

initTopbar();
loadScripts();
