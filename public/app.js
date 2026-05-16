const toastEl = document.querySelector('#toast');
let toastTimer;

export function showToast(message) { if (!toastEl) return; clearTimeout(toastTimer); toastEl.textContent = message; toastEl.classList.add('show'); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000); }
export async function api(path, options = {}) { const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Terjadi kesalahan.'); return data; }
export function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

export async function initTopbar() {
  const container = document.querySelector('#topbarAuth');
  if (!container) return;
  try {
    const session = await api('/api/session');
    if (session.loggedIn) {
      const initial = session.username.charAt(0).toUpperCase();
      const profileHref = session.role === 'admin' ? '/dashboard' : '/profile';
      const profileTitle = session.role === 'admin' ? 'Admin Dashboard' : 'Profil';
      container.innerHTML = `<div class="auth-user"><a href="${profileHref}" class="auth-avatar" title="${profileTitle}">${initial}</a><span class="auth-name">${escapeHtml(session.username)}</span><button class="btn-logout" id="logoutBtn">Logout</button></div>`;
      const logoutBtn = document.querySelector('#logoutBtn');
      if (logoutBtn) { logoutBtn.addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST', body: '{}' }); showToast('Logout berhasil.'); setTimeout(() => window.location.reload(), 500); } catch { showToast('Gagal logout.'); } }); }
    } else { container.innerHTML = `<a href="/login" class="auth-link">Login</a>`; }
    return session;
  } catch (error) { container.innerHTML = `<a href="/login" class="auth-link">Login</a>`; return { loggedIn: false }; }
}

export async function requireAuth(role = 'user') {
  const gate = document.querySelector('#authGate'); const content = document.querySelector('#protectedContent');
  try {
    const session = await api('/api/session');
    if (!session.loggedIn) { if (gate) gate.classList.remove('hidden'); if (content) content.classList.add('hidden'); return null; }
    if (role === 'admin' && session.role !== 'admin') { if (gate) { gate.classList.remove('hidden'); gate.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><h2>Akses Ditolak</h2><p>Halaman ini hanya untuk admin.</p><a class="btn primary" href="/">Kembali ke Home</a>`; } if (content) content.classList.add('hidden'); return null; }
    if (gate) gate.classList.add('hidden'); if (content) content.classList.remove('hidden'); return session;
  } catch (error) { if (gate) gate.classList.remove('hidden'); if (content) content.classList.add('hidden'); return null; }
}

export function snippetCardHtml(snippet) {
  const time = new Date(snippet.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const avatarSrc = snippet.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.username)}&background=9d5cff&color=f8f7ff&size=40&bold=true`;
  return `
    <article class="snippet-card" data-id="${snippet.id}">
      <div>
        <div class="snippet-meta">
          <img src="${avatarSrc}" alt="${escapeHtml(snippet.username)}" class="snippet-avatar-mini">
          <span>${escapeHtml(snippet.username)}</span>
          <span class="badge">${escapeHtml(snippet.language)}</span>
          <span>${time}</span>
        </div>
        <h3><a href="/snippet.html?id=${snippet.id}" class="snippet-link">${escapeHtml(snippet.title)}</a></h3>
        <p class="muted">${escapeHtml(snippet.description)}</p>
      </div>
      <div class="card-actions">
        <span class="stats">👁️ ${snippet.views} • 📋 ${snippet.copies} salin</span>
        <a href="/snippet.html?id=${snippet.id}" class="btn primary sm">Lihat Kode</a>
      </div>
    </article>`;
}

// ═══════════════════════════════════════════
// GLOBAL SITE SETTINGS (THEME & FONTS)
// ═══════════════════════════════════════════

export function applySiteSettings() {
  const savedTheme = localStorage.getItem('ac-theme') || 'dark';
  const savedFont = localStorage.getItem('ac-font') || "'Inter', sans-serif";
  const savedSize = localStorage.getItem('ac-fontSize') || '16';

  // Apply Theme Colors
  const root = document.documentElement;
  if (savedTheme === 'ocean') {
    root.style.setProperty('--bg', '#0b1120'); 
    root.style.setProperty('--primary', '#3b82f6'); 
    root.style.setProperty('--primary-2', '#06b6d4');
  } else if (savedTheme === 'purple') {
    root.style.setProperty('--bg', '#130a1e'); 
    root.style.setProperty('--primary', '#d946ef'); 
    root.style.setProperty('--primary-2', '#a855f7');
  } else if (savedTheme === 'terminal') {
    root.style.setProperty('--bg', '#020603'); 
    root.style.setProperty('--primary', '#22c55e'); 
    root.style.setProperty('--primary-2', '#4ade80');
  } else { // dark (default)
    root.style.setProperty('--bg', '#050507'); 
    root.style.setProperty('--primary', '#8b5cf6'); 
    root.style.setProperty('--primary-2', '#06b6d4');
  }

  // Apply Font Family
  document.body.style.fontFamily = savedFont;

  // Apply Font Size
  document.documentElement.style.fontSize = `${savedSize}px`;
}

// Jalankan secara otomatis saat halaman apapun dimuat
applySiteSettings();

export function showSkeleton(container, count = 3) { if (!container) return; container.innerHTML = Array.from({ length: count }, () => '<div class="skeleton skeleton-card"></div>').join(''); }
export function showEmpty(container, message, linkHref, linkText) { if (!container) return; let linkHtml = linkHref && linkText ? ` <a href="${linkHref}" style="color:var(--primary-2);font-weight:700">${linkText}</a>` : ''; container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>${message}${linkHtml}</p></div>`; }
export function showError(container, message = 'Gagal memuat data.') { if (!container) return; container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><p>${message}</p></div>`; }
