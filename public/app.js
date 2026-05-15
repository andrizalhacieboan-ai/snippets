
// ═══════════════════════════════════════════
// AndriCode — Shared Utilities
// ═══════════════════════════════════════════

const toastEl = document.querySelector('#toast');
let toastTimer;

/**
 * Tampilkan toast notification singkat
 */
export function showToast(message) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

/**
 * Fetch wrapper ke API backend
 */
export async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Terjadi kesalahan.');
  return data;
}

/**
 * Escape karakter HTML berbahaya untuk mencegah XSS
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[c]));
}

/**
 * Ambil data dari form sebagai plain object
 */
export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/**
 * Format angka dengan pemisah ribuan
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('id-ID');
}

/**
 * Format tanggal ke format Indonesia
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format tanggal relatif (contoh: "2 jam yang lalu")
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'Baru saja';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  if (weeks < 5) return `${weeks} minggu lalu`;
  if (months < 12) return `${months} bulan lalu`;
  return formatDate(dateStr);
}

// ── Topbar Auth Status ──

/**
 * Render status auth di topbar (avatar + nama + logout / link login)
 */
export async function initTopbar() {
  const container = document.querySelector('#topbarAuth');
  if (!container) return;

  try {
    const session = await api('/api/session');

    if (session.loggedIn) {
      const initial = session.username.charAt(0).toUpperCase();

      if (session.role === 'admin') {
        container.innerHTML = `
          <div class="auth-user">
            <a href="/dashboard" class="auth-avatar" title="Admin Dashboard">${initial}</a>
            <span class="auth-name">${escapeHtml(session.username)}</span>
            <button class="btn-logout" id="logoutBtn">Logout</button>
          </div>`;
      } else {
        container.innerHTML = `
          <div class="auth-user">
            <a href="/profile" class="auth-avatar" title="Profil">${initial}</a>
            <span class="auth-name">${escapeHtml(session.username)}</span>
            <button class="btn-logout" id="logoutBtn">Logout</button>
          </div>`;
      }

      const logoutBtn = document.querySelector('#logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await api('/api/logout', { method: 'POST', body: '{}' });
            showToast('Logout berhasil.');
            setTimeout(() => window.location.reload(), 500);
          } catch {
            showToast('Gagal logout.');
          }
        });
      }
    } else {
      container.innerHTML = `<a href="/login" class="auth-link">Login</a>`;
    }

    return session;
  } catch (error) {
    container.innerHTML = `<a href="/login" class="auth-link">Login</a>`;
    return { loggedIn: false };
  }
}

// ── Auth Gate ──

/**
 * Cek apakah user sudah login dengan role yang sesuai.
 * Tampilkan auth gate jika belum, tampilkan konten jika sudah.
 * Returns session object atau null.
 */
export async function requireAuth(role = 'user') {
  const gate = document.querySelector('#authGate');
  const content = document.querySelector('#protectedContent');

  try {
    const session = await api('/api/session');

    // Belum login sama sekali
    if (!session.loggedIn) {
      if (gate) gate.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return null;
    }

    // Login sebagai user tapi halaman butuh admin
    if (role === 'admin' && session.role !== 'admin') {
      if (gate) gate.classList.remove('hidden');
      if (content) content.classList.add('hidden');

      // Update gate message untuk user yang bukan admin
      if (gate) {
        gate.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <h2>Akses Ditolak</h2>
          <p>Halaman ini hanya untuk admin. Kamu login sebagai user biasa.</p>
          <a class="btn primary" href="/">Kembali ke Home</a>`;
      }
      return null;
    }

    // Auth valid
    if (gate) gate.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    return session;

  } catch (error) {
    if (gate) gate.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    return null;
  }
}

// ── Snippet Card HTML ──

/**
 * Render HTML kartu snippet publik (untuk halaman home)
 */
export function snippetCardHtml(snippet) {
  return `
    <article class="snippet-card" data-id="${snippet.id}">
      <div>
        <div class="snippet-meta">
          <span class="badge">${escapeHtml(snippet.language)}</span>
          <span>oleh ${escapeHtml(snippet.username)}</span>
        </div>
        <h3>${escapeHtml(snippet.title)}</h3>
        <p class="muted">${escapeHtml(snippet.description)}</p>
      </div>
      <pre class="snippet-code"><code>Memuat kode...</code></pre>
      <div class="card-actions">
        <span class="stats">👁️ <span class="view-count">${formatNumber(snippet.views)}</span> • 📋 <span class="copy-count">${formatNumber(snippet.copies)}</span> salin</span>
        <button class="btn primary sm copy-btn">Salin</button>
      </div>
    </article>`;
}

/**
 * Wire interaksi copy pada snippet cards yang sudah di-render
 */
export async function wireSnippetCards(container) {
  const cards = container.querySelectorAll('.snippet-card');
  const loadQueue = [];

  for (const card of cards) {
    const id = card.dataset.id;
    loadQueue.push(loadSnippetDetail(card, id));
  }

  await Promise.allSettled(loadQueue);
}

async function loadSnippetDetail(card, id) {
  try {
    const detail = await api(`/api/snippets/${id}`);
    const codeEl = card.querySelector('code');
    if (codeEl) codeEl.textContent = detail.code;

    const viewCount = card.querySelector('.view-count');
    if (viewCount) viewCount.textContent = formatNumber(detail.views);

    // Wire copy button
    const copyBtn = card.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(detail.code);
          const copyResult = await api(`/api/snippets/${id}/copy`, {
            method: 'POST',
            body: '{}',
          });
          const copyCount = card.querySelector('.copy-count');
          if (copyCount) copyCount.textContent = formatNumber(copyResult.copies);
          showToast('Kode berhasil disalin.');
        } catch {
          // Fallback jika clipboard API gagal (misalnya HTTP tanpa HTTPS)
          try {
            const textArea = document.createElement('textarea');
            textArea.value = detail.code;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            const copyResult = await api(`/api/snippets/${id}/copy`, {
              method: 'POST',
              body: '{}',
            });
            const copyCount = card.querySelector('.copy-count');
            if (copyCount) copyCount.textContent = formatNumber(copyResult.copies);
            showToast('Kode berhasil disalin.');
          } catch {
            showToast('Gagal menyalin kode.');
          }
        }
      });
    }
  } catch {
    const codeEl = card.querySelector('code');
    if (codeEl) codeEl.textContent = 'Gagal memuat kode.';
  }
}

// ── Skeleton Loading ──

/**
 * Tampilkan skeleton placeholder saat loading
 */
export function showSkeleton(container, count = 3) {
  if (!container) return;
  container.innerHTML = Array.from(
    { length: count },
    () => '<div class="skeleton skeleton-card"></div>'
  ).join('');
}

/**
 * Tampilkan empty state
 */
export function showEmpty(container, message, linkHref, linkText) {
  if (!container) return;
  let linkHtml = '';
  if (linkHref && linkText) {
    linkHtml = `<a href="${linkHref}" style="color:var(--primary-2);font-weight:700">${linkText}</a>`;
  }
  container.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p>${message}${linkHtml ? ' ' + linkHtml : ''}</p>
    </div>`;
}

/**
 * Tampilkan error state
 */
export function showError(container, message = 'Gagal memuat data.') {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <p>${message}</p>
    </div>`;
}
