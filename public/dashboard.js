import { api, showToast, formData, escapeHtml, initTopbar, requireAuth, showSkeleton, showEmpty, applySiteSettings } from '/app.js';

const adminForm = document.querySelector('#adminForm');
const statsGrid = document.querySelector('#statsGrid');
const adminUsers = document.querySelector('#adminUsers');
const adminSnippets = document.querySelector('#adminSnippets');

// Edit Modal Elements
const editModal = document.querySelector('#editModal');
const closeModalBtn = document.querySelector('#closeModalBtn');
const editSnippetForm = document.querySelector('#editSnippetForm');

// Settings Elements
const themeBtns = document.querySelectorAll('.theme-btn');
const fontSelect = document.getElementById('fontSelect');
const fontSizeRange = document.getElementById('fontSizeRange');
const fontSizeLabel = document.getElementById('fontSizeLabel');

async function checkAndLoad() {
  const session = await requireAuth('admin');
  if (session) {
    initTopbar();
    loadDashboard();
    loadUsers();
    loadSnippets();
    initSettingsUI(); // Inisialisasi UI Pengaturan
  } else {
    initTopbar();
  }
}

// ── Admin Login ──
adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(formData(adminForm)) });
    showToast(data.message);
    setTimeout(() => window.location.reload(), 600);
  } catch (error) { showToast(error.message); }
});

// ── Tab Navigation ──
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// ── Load Data Functions ──
async function loadDashboard() {
  try {
    const data = await api('/api/admin/stats');
    statsGrid.innerHTML = `
      <div class="stat-box glass-panel"><strong>${data.totals.users}</strong><span>Users</span></div>
      <div class="stat-box glass-panel"><strong>${data.totals.snippets}</strong><span>Snippets</span></div>
      <div class="stat-box glass-panel"><strong>${data.totals.views}</strong><span>Views</span></div>
      <div class="stat-box glass-panel"><strong>${data.totals.copies}</strong><span>Salin</span></div>
    `;
  } catch (error) { showToast('Gagal memuat stats.'); }
}

async function loadUsers() {
  showSkeleton(adminUsers, 3);
  try {
    const users = await api('/api/admin/users');
    if (!users.length) { showEmpty(adminUsers, 'Tidak ada user terdaftar.'); return; }
    adminUsers.innerHTML = users.map(u => `
      <div class="admin-row glass-panel">
        <div style="min-width:0;">
          <strong>${escapeHtml(u.username)}</strong>
          <p class="muted" style="font-size:0.8rem; margin-top:0.2rem;">Bergabung: ${new Date(u.created_at).toLocaleDateString('id-ID')}</p>
        </div>
        <button class="btn danger sm delete-user-btn" data-id="${u.id}">Hapus</button>
      </div>
    `).join('');

    adminUsers.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Peringatan: Menghapus user akan menghapus semua snippet & sesi mereka. Lanjutkan?')) return;
        try {
          await api(`/api/admin/users/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('User berhasil dihapus.');
          loadUsers(); loadDashboard(); loadSnippets();
        } catch (error) { showToast(error.message); }
      });
    });
  } catch (error) { showEmpty(adminUsers, 'Gagal memuat data user.'); }
}

async function loadSnippets() {
  showSkeleton(adminSnippets, 3);
  try {
    const data = await api('/api/admin/stats');
    if (!data.snippets.length) { showEmpty(adminSnippets, 'Tidak ada snippet.'); return; }
    adminSnippets.innerHTML = data.snippets.map(s => `
      <div class="admin-row glass-panel" style="flex-direction:column; align-items:stretch; gap:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <div style="min-width:0;">
            <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${escapeHtml(s.title)}</strong>
            <p class="muted" style="font-size:0.8rem; margin-top:0.2rem;">oleh ${escapeHtml(s.username)} • ${escapeHtml(s.language)}</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-shrink:0;">
            <button class="btn ghost sm edit-snippet-btn" data-id="${s.id}">Edit</button>
            <button class="btn danger sm delete-snippet-btn" data-id="${s.id}">Hapus</button>
          </div>
        </div>
      </div>
    `).join('');

    // Delete Snippet
    adminSnippets.querySelectorAll('.delete-snippet-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Yakin hapus snippet ini?')) return;
        try {
          await api(`/api/admin/snippets/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Snippet dihapus.');
          loadSnippets(); loadDashboard();
        } catch (error) { showToast(error.message); }
      });
    });

    // Edit Snippet
    adminSnippets.querySelectorAll('.edit-snippet-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const snippet = await api(`/api/snippets/${btn.dataset.id}`);
          document.getElementById('editId').value = snippet.id;
          document.getElementById('editTitle').value = snippet.title;
          document.getElementById('editLang').value = snippet.language;
          document.getElementById('editDesc').value = snippet.description;
          document.getElementById('editCode').value = snippet.code;
          editModal.classList.remove('hidden');
        } catch (error) { showToast('Gagal memuat detail snippet.'); }
      });
    });
  } catch (error) { showEmpty(adminSnippets, 'Gagal memuat data snippet.'); }
}

// ── Edit Modal Logic ──
closeModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.classList.add('hidden'); });

editSnippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const payload = {
    title: document.getElementById('editTitle').value,
    language: document.getElementById('editLang').value,
    description: document.getElementById('editDesc').value,
    code: document.getElementById('editCode').value
  };
  try {
    await api(`/api/admin/snippets/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    showToast('Snippet berhasil diupdate!');
    editModal.classList.add('hidden');
    loadSnippets();
  } catch (error) { showToast(error.message); }
});

// ── Settings Logic (Theme & Font) ──
function initSettingsUI() {
  const savedTheme = localStorage.getItem('ac-theme') || 'dark';
  const savedFont = localStorage.getItem('ac-font') || "'Inter', sans-serif";
  const savedSize = localStorage.getItem('ac-fontSize') || '16';

  // Sinkronkan UI dengan data yang tersimpan saat pertama load
  themeBtns.forEach(btn => {
    if (btn.dataset.theme === savedTheme) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  fontSelect.value = savedFont;
  fontSizeRange.value = savedSize;
  fontSizeLabel.textContent = `${savedSize}px`;

  // Event Listener untuk Tema
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem('ac-theme', btn.dataset.theme);
      applySiteSettings(); // Panggil fungsi global dari app.js
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Event Listener untuk Font
  fontSelect.addEventListener('change', (e) => {
    localStorage.setItem('ac-font', e.target.value);
    applySiteSettings(); // Panggil fungsi global dari app.js
  });

  // Event Listener untuk Ukuran Font
  fontSizeRange.addEventListener('input', (e) => {
    const size = e.target.value;
    localStorage.setItem('ac-fontSize', size);
    fontSizeLabel.textContent = `${size}px`;
    applySiteSettings(); // Panggil fungsi global dari app.js
  });
}

// Jalankan aplikasi
checkAndLoad();
