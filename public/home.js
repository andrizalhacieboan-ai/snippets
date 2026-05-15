import { api, showToast, escapeHtml, initTopbar, snippetCardHtml } from '/app.js';

const snippetList = document.querySelector('#snippetList');

async function loadSnippets() {
  try {
    const snippets = await api('/api/snippets');

    if (!snippets.length) {
      snippetList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>Belum ada snippet. Jadilah uploader pertama!</p>
        </div>`;
      return;
    }

    snippetList.innerHTML = snippets.map(snippetCardHtml).join('');

    // Load detail untuk setiap card
    for (const card of snippetList.querySelectorAll('.snippet-card')) {
      const id = card.dataset.id;
      try {
        const detail = await api(`/api/snippets/${id}`);
        card.querySelector('code').textContent = detail.code;
        card.querySelector('.view-count').textContent = detail.views;

        card.querySelector('.copy-btn').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(detail.code);
            const copyResult = await api(`/api/snippets/${id}/copy`, { method: 'POST', body: '{}' });
            card.querySelector('.copy-count').textContent = copyResult.copies;
            showToast('Kode berhasil disalin.');
          } catch {
            showToast('Gagal menyalin kode.');
          }
        });
      } catch {
        card.querySelector('code').textContent = 'Gagal memuat kode.';
      }
    }
  } catch (error) {
    snippetList.innerHTML = `<div class="empty-state"><p>Gagal memuat snippet.</p></div>`;
  }
}

initTopbar();
loadSnippets();
