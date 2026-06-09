import { api, showToast, formData, escapeHtml, initTopbar, requireAuth, showSkeleton, showEmpty, applySiteSettings, applyThemeWithSlide, reobserveCards } from '/app.js';

const adminForm = document.querySelector('#adminForm');
const statsGrid = document.querySelector('#statsGrid');
const adminUsers = document.querySelector('#adminUsers');
const adminSnippets = document.querySelector('#adminSnippets');
const adminAnnouncements = document.querySelector('#adminAnnouncements');
const announcementForm = document.querySelector('#announcementForm');
const scriptForm = document.querySelector('#scriptForm');
const adminScriptsList = document.querySelector('#adminScriptsList');

// Edit Modal Elements
const editModal = document.querySelector('#editModal');
const closeModalBtn = document.querySelector('#closeModalBtn');
const editSnippetForm = document.querySelector('#editSnippetForm');

// Settings Elements
const themeBtns = document.querySelectorAll('.theme-btn');
const fontSelect = document.getElementById('fontSelect');
const fontSizeRange = document.getElementById('fontSizeRange');
const fontSizeLabel = document.getElementById('fontSizeLabel');

async function loadAdminScripts() {
  showSkeleton(adminScriptsList, 2);
  try {
    const scripts = await api('/api/scripts');
    if (!scripts.length) { showEmpty(adminScriptsList, 'Belum ada script.'); return; }
    adminScriptsList.innerHTML = scripts.map(s => `
      <div class="admin-row glass-panel" style="flex-direction:column; gap:0.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(s.title)}</strong>
          <button class="btn danger sm delete-script-btn" data-id="${s.id}">Hapus</button>
        </div>
        <p class="muted" style="font-size:0.85rem; margin:0;">Kategori: ${escapeHtml(s.category)} • ⬇️ ${s.downloads} downloads</p>
      </div>
    `).join('');
    
    adminScriptsList.querySelectorAll('.delete-script-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus script ini?')) return;
        try { await api(`/api/admin/scripts/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Script dihapus.'); loadAdminScripts(); } catch (e) { showToast(e.message); }
      });
    });
  } catch (error) { showEmpty(adminScriptsList, 'Gagal memuat script.'); }
}

scriptForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('scriptTitle').value,
    category: document.getElementById('scriptCategory').value,
    image_url: document.getElementById('scriptImage').value,
    download_url: document.getElementById('scriptDownloadUrl').value,
    description: document.getElementById('scriptDesc').value
  };
  try {
    await api('/api/admin/scripts', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Script berhasil ditambahkan!');
    scriptForm.reset();
    loadAdminScripts();
  } catch (error) { showToast(error.message); }
});

async function checkAndLoad() {
  const session = await requireAuth('admin');
  if (session) {
    initTopbar();
    loadDashboard();
    loadUsers();
    loadSnippets();
    loadAnnouncements();
    initSettingsUI();
    loadAdminScripts(); 
  } else {
    initTopbar();
  }
}

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(formData(adminForm)) });
    showToast(data.message);
    setTimeout(() => window.location.reload(), 600);
  } catch (error) { showToast(error.message); }
});

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
    reobserveCards(statsGrid);
  } catch (error) { showToast('Gagal memuat stats.'); }
}

async function loadUsers() {
  showSkeleton(adminUsers, 3);
  try {
    const users = await api('/api/admin/users');
    if (!users.length) { showEmpty(adminUsers, 'Tidak ada user terdaftar.'); return; }
    adminUsers.innerHTML = users.map(u => `
      <div class="admin-row glass-panel"><div style="min-width:0;"><strong>${escapeHtml(u.username)}</strong><p class="muted" style="font-size:0.8rem; margin-top:0.2rem;">Bergabung: ${new Date(u.created_at).toLocaleDateString('id-ID')}</p></div><button class="btn danger sm delete-user-btn" data-id="${u.id}">Hapus</button></div>
    `).join('');
    adminUsers.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => { if (!confirm('Hapus user dan snippetnya?')) return; try { await api(`/api/admin/users/${btn.dataset.id}`, { method: 'DELETE' }); showToast('User dihapus.'); loadUsers(); loadDashboard(); loadSnippets(); } catch (error) { showToast(error.message); } });
    });
  } catch (error) { showEmpty(adminUsers, 'Gagal memuat user.'); }
}

async function loadSnippets() {
  showSkeleton(adminSnippets, 3);
  try {
    const data = await api('/api/admin/stats');
    if (!data.snippets.length) { showEmpty(adminSnippets, 'Tidak ada snippet.'); return; }
    adminSnippets.innerHTML = data.snippets.map(s => `
      <div class="admin-row glass-panel" style="flex-direction:column; align-items:stretch; gap:0.75rem;"><div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;"><div style="min-width:0;"><strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${escapeHtml(s.title)}</strong><p class="muted" style="font-size:0.8rem; margin-top:0.2rem;">oleh ${escapeHtml(s.username)} • ${escapeHtml(s.language)}</p></div><div style="display:flex; gap:0.5rem; flex-shrink:0;"><button class="btn ghost sm edit-snippet-btn" data-id="${s.id}">Edit</button><button class="btn danger sm delete-snippet-btn" data-id="${s.id}">Hapus</button></div></div></div>
    `).join('');
    adminSnippets.querySelectorAll('.delete-snippet-btn').forEach(btn => { btn.addEventListener('click', async () => { if (!confirm('Hapus snippet?')) return; try { await api(`/api/admin/snippets/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Snippet dihapus.'); loadSnippets(); loadDashboard(); } catch (error) { showToast(error.message); } }); });
    adminSnippets.querySelectorAll('.edit-snippet-btn').forEach(btn => { btn.addEventListener('click', async () => { try { const snippet = await api(`/api/snippets/${btn.dataset.id}`); document.getElementById('editId').value = snippet.id; document.getElementById('editTitle').value = snippet.title; document.getElementById('editLang').value = snippet.language; document.getElementById('editDesc').value = snippet.description; document.getElementById('editCode').value = snippet.code; editModal.classList.remove('hidden'); } catch (error) { showToast('Gagal memuat detail snippet.'); } }); });
  } catch (error) { showEmpty(adminSnippets, 'Gagal memuat snippet.'); }
}

async function loadAnnouncements() {
  showSkeleton(adminAnnouncements, 2);
  try {
    const anns = await api('/api/announcements');
    if (!anns.length) { showEmpty(adminAnnouncements, 'Belum ada pengumuman.'); return; }
    adminAnnouncements.innerHTML = anns.map(a => `
      <div class="admin-row glass-panel" style="flex-direction:column; align-items:stretch; gap:0.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(a.title)}</strong>
          <button class="btn danger sm delete-ann-btn" data-id="${a.id}">Hapus</button>
        </div>
        <p class="muted" style="font-size:0.9rem; margin:0;">${escapeHtml(a.content)}</p>
        <p class="muted" style="font-size:0.75rem; margin:0;">${new Date(a.created_at).toLocaleString('id-ID')}</p>
      </div>
    `).join('');
    
    adminAnnouncements.querySelectorAll('.delete-ann-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus pengumuman ini?')) return;
        try { await api(`/api/admin/announcements/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Pengumuman dihapus.'); loadAnnouncements(); } catch (error) { showToast(error.message); }
      });
    });
  } catch (error) { showEmpty(adminAnnouncements, 'Gagal memuat pengumuman.'); }
}

announcementForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('annTitle').value;
  const content = document.getElementById('annContent').value;
  try {
    await api('/api/admin/announcements', { method: 'POST', body: JSON.stringify({ title, content }) });
    showToast('Pengumuman berhasil dikirim!');
    announcementForm.reset();
    loadAnnouncements();
  } catch (error) { showToast(error.message); }
});

// ── Edit Modal Logic ──
closeModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.classList.add('hidden'); });
editSnippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const payload = { title: document.getElementById('editTitle').value, language: document.getElementById('editLang').value, description: document.getElementById('editDesc').value, code: document.getElementById('editCode').value };
  try { await api(`/api/admin/snippets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast('Snippet diupdate!'); editModal.classList.add('hidden'); loadSnippets(); } catch (error) { showToast(error.message); }
});

// ── Settings Logic ──
function initSettingsUI() {
  const savedTheme = localStorage.getItem('ac-theme') || 'dark';
  const savedFont  = localStorage.getItem('ac-font')  || "'Inter', sans-serif";
  const savedSize  = localStorage.getItem('ac-fontSize') || '16';

  themeBtns.forEach(btn => {
    if (btn.dataset.theme === savedTheme) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  fontSelect.value = savedFont;
  fontSizeRange.value = savedSize;
  fontSizeLabel.textContent = `${savedSize}px`;

  // ── Theme buttons with sliding animation ──
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTheme = btn.dataset.theme;
      const currentTheme = localStorage.getItem('ac-theme') || 'dark';
      if (targetTheme === currentTheme) return;

      // Start slide animation, apply theme at midpoint
      applyThemeWithSlide(targetTheme, () => {
        localStorage.setItem('ac-theme', targetTheme);
        applySiteSettings();
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast(`Tema "${targetTheme}" aktif ✨`);
      });
    });
  });

  fontSelect.addEventListener('change', (e) => {
    localStorage.setItem('ac-font', e.target.value);
    applySiteSettings();
  });
  fontSizeRange.addEventListener('input', (e) => {
    const size = e.target.value;
    localStorage.setItem('ac-fontSize', size);
    fontSizeLabel.textContent = `${size}px`;
    applySiteSettings();
  });
}

checkAndLoad();
