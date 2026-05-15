import { api, showToast, formData, escapeHtml, initTopbar, requireAuth, showSkeleton, showEmpty, showError } from '/app.js';

const adminForm = document.querySelector('#adminForm');
const statsGrid = document.querySelector('#statsGrid');
const adminSnippets = document.querySelector('#adminSnippets');

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
    // Reload halaman setelah login berhasil agar session tersinkronisasi
    setTimeout(() => window.location.reload(), 600);
  } catch (error) {
    showToast(error.message);
  }
});

async function loadDashboard() {
  showSkeleton(adminSnippets, 4);
  
  try {
    const data = await api('/api/admin/stats');

    // Render Stats
    statsGrid.innerHTML = `
      <div class="stat-box"><strong>${data.totals.users}</strong><span>Users</span></div>
      <div class="stat-box"><strong>${data.totals.snippets}</strong><span>Snippets</span></div>
      <div class="stat-box"><strong>${data.totals.views}</strong><span>Views</span></div>
      <div class="stat-box"><strong>${data.totals.copies}</strong><span>Salin</span></div>
    `;

    // Render Snippet List
    if (!data.snippets.length) {
      showEmpty(adminSnippets, 'Belum ada snippet untuk dimoderasi.');
      return;
    }

    adminSnippets.innerHTML = data.snippets.map((s) => `
      <div class="admin-row" data-id="${s.id}">
        <div style="min-width:0;">
          <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.title)}</strong>
          <p class="muted" style="margin:0.2rem 0 0;font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(s.language)} • ${escapeHtml(s.username)} • 👁️ ${s.views} • 📋 ${s.copies}
          </p>
        </div>
        <button class="btn danger sm delete-btn" data-id="${s.id}" style="flex-shrink:0;">Hapus</button>
      </div>
    `).join('');

    // Wire Delete Buttons
    adminSnippets.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Yakin ingin menghapus snippet ini secara permanen?')) return;
        try {
          btn.textContent = 'Menghapus...';
          btn.disabled = true;
          await api(`/api/admin/snippets/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Snippet berhasil dihapus.');
          loadDashboard(); // Refresh data
        } catch (error) {
          showToast(error.message);
          btn.textContent = 'Hapus';
          btn.disabled = false;
        }
      });
    });
  } catch (error) {
    showError(adminSnippets, 'Gagal memuat data dashboard.');
  }
}

checkAndLoad();
