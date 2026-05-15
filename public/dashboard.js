import { api, showToast, formData, escapeHtml, initTopbar, requireAuth } from '/app.js';

const adminForm = document.querySelector('#adminForm');
const statsGrid = document.querySelector('#statsGrid');
const adminSnippets = document.querySelector('#adminSnippets');

// Cek apakah sudah admin, jika ya langsung tampilkan dashboard
async function checkAndLoad() {
  const session = await requireAuth('admin');
  if (session) {
    initTopbar();
    loadDashboard();
  } else {
    initTopbar();
  }
}

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(formData(adminForm)) });
    showToast(data.message);
    adminForm.reset();
    // Setelah login admin, reload halaman untuk refresh session
    setTimeout(() => window.location.reload(), 600);
  } catch (error) {
    showToast(error.message);
  }
});

async function loadDashboard() {
  try {
    const data = await api('/api/admin/stats');

    // Stats
    statsGrid.innerHTML = `
      <div class="stat-box"><strong>${data.totals.users}</strong><span>Users</span></div>
      <div class="stat-box"><strong>${data.totals.snippets}</strong><span>Snippets</span></div>
      <div class="stat-box"><strong>${data.totals.views}</strong><span>Views</span></div>
      <div class="stat-box"><strong>${data.totals.copies}</strong><span>Salin</span></div>
    `;

    // Snippet list
    if (!data.snippets.length) {
      adminSnippets.innerHTML = `<div class="empty-state"><p>Belum ada snippet untuk dimoderasi.</p></div>`;
      return;
    }

    adminSnippets.innerHTML = data.snippets.map((s) => `
      <div class="admin-row" data-id="${s.id}">
        <div>
          <strong>${escapeHtml(s.title)}</strong>
          <p class="muted">${escapeHtml(s.language)} • ${escapeHtml(s.username)} • 👁️ ${s.views} • 📋 ${s.copies}</p>
        </div>
        <button class="btn danger sm delete-btn" data-id="${s.id}">Hapus</button>
      </div>
    `).join('');

    adminSnippets.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Yakin ingin menghapus snippet ini?')) return;
        try {
          await api(`/api/admin/snippets/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Snippet dihapus.');
          loadDashboard();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  } catch (error) {
    showToast('Gagal memuat dashboard.');
  }
}

checkAndLoad();
