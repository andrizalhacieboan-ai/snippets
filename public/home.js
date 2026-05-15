import { api, showToast, escapeHtml, initTopbar, snippetCardHtml, showEmpty, showError } from '/app.js';

const snippetList = document.querySelector('#snippetList');

async function loadSnippets() {
  try {
    const snippets = await api('/api/snippets');

    if (!snippets.length) {
      showEmpty(snippetList, 'Belum ada snippet. Jadilah uploader pertama!', '/upload', 'Upload Sekarang');
      return;
    }

    snippetList.innerHTML = snippets.map(snippetCardHtml).join('');
  } catch (error) {
    showError(snippetList, 'Gagal memuat snippet.');
  }
}

initTopbar();
loadSnippets();
