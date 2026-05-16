import { api, showToast, escapeHtml, initTopbar, showError } from '/app.js';

const snippetHeader = document.querySelector('#snippetHeader');
const snippetCodeBlock = document.querySelector('#snippetCodeBlock');
const copyBtn = document.querySelector('#copyBtn');
const rawBtn = document.querySelector('#rawBtn');
const shareBtn = document.querySelector('#shareBtn');
const commentAuthGate = document.querySelector('#commentAuthGate');
const commentForm = document.querySelector('#commentForm');
const commentInput = document.querySelector('#commentInput');
const commentList = document.querySelector('#commentList');
const commentCount = document.querySelector('#commentCount');

let currentCode = ''; let currentTitle = ''; let currentSession = null;
const params = new URLSearchParams(window.location.search);
const snippetId = params.get('id');

if (!snippetId) { showError(snippetHeader, 'Snippet tidak ditemukan.'); snippetCodeBlock.innerHTML = ''; }

// Load Snippet
async function loadSnippet() {
  try {
    const detail = await api(`/api/snippets/${snippetId}`);
    currentCode = detail.code; currentTitle = detail.title;
    const date = new Date(detail.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    const avatarSrc = detail.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(detail.username)}&background=9d5cff&color=f8f7ff&size=40&bold=true`;
    snippetHeader.innerHTML = `
      <div class="snippet-meta" style="margin-bottom:0.5rem;">
        <img src="${avatarSrc}" alt="${escapeHtml(detail.username)}" class="snippet-avatar-mini">
        <span>${escapeHtml(detail.username)}</span>
        <span class="badge">${escapeHtml(detail.language)}</span><span>${date}</span>
      </div>
      <h1>${escapeHtml(detail.title)}</h1><p class="muted">${escapeHtml(detail.description)}</p>
      <span class="stats" style="margin-top:0.75rem;display:block;">👁️ ${detail.views} views • 📋 ${detail.copies} salin</span>`;
    snippetCodeBlock.innerHTML = `<pre style="margin:0; padding:1.5rem; overflow-x:auto;"><code>${escapeHtml(detail.code)}</code></pre>`;
    rawBtn.href = `/api/raw/${snippetId}`;
    document.title = `${detail.title} — AndriCode`;
  } catch (error) { showError(snippetHeader, 'Gagal memuat snippet. Mungkin sudah dihapus.'); snippetCodeBlock.innerHTML = ''; }
}

// Copy Button
copyBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentCode); showToast('Kode berhasil disalin!'); api(`/api/snippets/${snippetId}/copy`, { method: 'POST', body: '{}' }).catch(() => {}); } catch { showToast('Gagal menyalin kode.'); }
});

// Share Button
shareBtn.addEventListener('click', async () => {
  const url = window.location.href;
  if (navigator.share) { try { await navigator.share({ title: currentTitle, text: `Cek snippet kode "${currentTitle}"`, url }); } catch (e) {} } 
  else { try { await navigator.clipboard.writeText(url); showToast('Link berhasil disalin!'); } catch { showToast('Gagal menyalin link.'); } }
});

// Comments Logic
async function initComments() {
  currentSession = await initTopbar();
  if (currentSession?.loggedIn) {
    commentForm.classList.remove('hidden');
  } else {
    commentAuthGate.classList.remove('hidden');
  }
  loadComments();
  // Real-time polling: cek komentar baru setiap 3 detik
  setInterval(loadComments, 3000);
}

async function loadComments() {
  if (!snippetId) return;
  try {
    const comments = await api(`/api/snippets/${snippetId}/comments`);
    commentCount.textContent = `(${comments.length})`;
    if (!comments.length) { commentList.innerHTML = '<p class="muted" style="font-size:0.9rem;">Belum ada komentar.</p>'; return; }
    commentList.innerHTML = comments.map(c => {
      const avatarSrc = c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.username)}&background=9d5cff&color=f8f7ff&size=32&bold=true`;
      const time = new Date(c.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="comment-item">
          <img src="${avatarSrc}" class="comment-avatar" alt="avatar">
          <div class="comment-body">
            <div class="comment-meta"><strong>${escapeHtml(c.username)}</strong> <span>${time}</span></div>
            <p>${escapeHtml(c.content)}</p>
          </div>
        </div>`;
    }).join('');
  } catch (error) { commentList.innerHTML = '<p class="muted">Gagal memuat komentar.</p>'; }
}

commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = commentInput.value.trim();
  if (!content) return;
  try {
    await api(`/api/snippets/${snippetId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    commentInput.value = '';
    loadComments(); // Langsung refresh
  } catch (error) { showToast(error.message); }
});

if (snippetId) { loadSnippet(); initComments(); }
