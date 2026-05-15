import { api, showToast, escapeHtml, initTopbar, requireAuth } from '/app.js';

const profileAvatar = document.querySelector('#profileAvatar');
const profileName = document.querySelector('#profileName');
const profileJoined = document.querySelector('#profileJoined');
const statSnippets = document.querySelector('#statSnippets');
const statViews = document.querySelector('#statViews');
const statCopies = document.querySelector('#statCopies');
const mySnippets = document.querySelector('#mySnippets');

async function loadProfile() {
  try {
    const profile = await api('/api/user/profile');

    profileAvatar.textContent = profile.username.charAt(0).toUpperCase();
    profileName.textContent = profile.username;

    const date = new Date(profile.created_at);
    profileJoined.textContent = `Bergabung ${date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`;

    statSnippets.textContent = profile.stats.total_snippets;
    statViews.textContent = profile.stats.total_views;
    statCopies.textContent = profile.stats.total_copies;
  } catch (error) {
    showToast('Gagal memuat profil.');
  }
}

async function loadMySnippets() {
  try {
    const snippets = await api('/api/user/snippets');

    if (!snippets.length) {
      mySnippets.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>Belum ada snippet. <a href="/upload" style="color:var(--primary-2)">Upload sekarang!</a></p>
        </div>`;
      return;
    }

    mySnippets.innerHTML = snippets.map((s) => `
      <article class="snippet-card" data-id="${s.id}">
        <div>
          <div class="snippet-meta">
            <span class="badge">${escapeHtml(s.language)}</span>
            <span>${new Date(s.created_at).toLocaleDateString('id-ID')}</span>
          </div>
          <h3>${escapeHtml(s.title)}</h3>
          <p class="muted">${escapeHtml(s.description)}</p>
        </div>
        <div class="card-actions">
          <span class="stats">👁️ ${s.views} • 📋 ${s.copies} salin</span>
          <button class="btn danger sm delete-btn" data-id="${s.id}">Hapus</button>
        </div>
      </article>
    `).join('');

    // Wire delete buttons
    mySnippets.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Yakin ingin menghapus snippet ini?')) return;
        try {
          await api(`/api/user/snippets/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Snippet dihapus.');
          loadProfile();
          loadMySnippets();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  } catch (error) {
    mySnippets.innerHTML = `<div class="empty-state"><p>Gagal memuat snippet.</p></div>`;
  }
}

requireAuth('user').then((session) => {
  if (session) {
    initTopbar();
    loadProfile();
    loadMySnippets();
  }
});
