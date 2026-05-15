import { api, showToast, escapeHtml, initTopbar, showError } from '/app.js';

const snippetHeader = document.querySelector('#snippetHeader');
const snippetCodeBlock = document.querySelector('#snippetCodeBlock');
const copyBtn = document.querySelector('#copyBtn');
const rawBtn = document.querySelector('#rawBtn');
const shareBtn = document.querySelector('#shareBtn');

let currentCode = '';
let currentTitle = '';

// Ambil ID dari URL (?id=1)
const params = new URLSearchParams(window.location.search);
const snippetId = params.get('id');

if (!snippetId) {
  showError(snippetHeader, 'Snippet tidak ditemukan.');
  snippetCodeBlock.innerHTML = '';
}

async function loadSnippet() {
  try {
    const detail = await api(`/api/snippets/${snippetId}`);
    
    currentCode = detail.code;
    currentTitle = detail.title;

    const date = new Date(detail.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    snippetHeader.innerHTML = `
      <div class="snippet-meta" style="margin-bottom:0.5rem;">
        <span class="badge">${escapeHtml(detail.language)}</span>
        <span>oleh ${escapeHtml(detail.username)}</span>
        <span>${date}</span>
      </div>
      <h1>${escapeHtml(detail.title)}</h1>
      <p class="muted">${escapeHtml(detail.description)}</p>
      <span class="stats" style="margin-top:0.75rem;display:block;">👁️ ${detail.views} views • 📋 ${detail.copies} salin</span>
    `;

    snippetCodeBlock.innerHTML = `
      <pre style="margin:0; padding:1.5rem; overflow-x:auto; -webkit-overflow-scrolling:touch;"><code>${escapeHtml(detail.code)}</code></pre>
    `;

    // Set Raw Link
    rawBtn.href = `/api/raw/${snippetId}`;

    // Set Page Title
    document.title = `${detail.title} — AndriCode`;

  } catch (error) {
    showError(snippetHeader, 'Gagal memuat snippet. Mungkin sudah dihapus.');
    snippetCodeBlock.innerHTML = '';
  }
}

// Copy Button
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentCode);
    showToast('Kode berhasil disalin!');
    
    // Update copy count di background
    api(`/api/snippets/${snippetId}/copy`, { method: 'POST', body: '{}' }).catch(() => {});
  } catch {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = currentCode;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Kode berhasil disalin!');
  }
});

// Share Button (Web Share API untuk Android/iOS)
shareBtn.addEventListener('click', async () => {
  const url = window.location.href;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: currentTitle,
        text: `Cek snippet kode "${currentTitle}" di AndriCode!`,
        url: url,
      });
    } catch (error) {
      // User cancel share dialog
    }
  } else {
    // Fallback untuk desktop: salin link
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link berhasil disalin!');
    } catch {
      showToast('Gagal menyalin link.');
    }
  }
});

initTopbar();
if (snippetId) loadSnippet();
