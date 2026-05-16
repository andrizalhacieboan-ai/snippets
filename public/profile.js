import { api, showToast, escapeHtml, initTopbar, requireAuth, snippetCardHtml, showEmpty, showError } from '/app.js';

// Elements
const profileAvatarImg = document.querySelector('#profileAvatarImg');
const avatarOverlay = document.querySelector('#avatarOverlay');
const avatarInput = document.querySelector('#avatarInput');
const profileName = document.querySelector('#profileName');
const profileJoined = document.querySelector('#profileJoined');
const editNameBtn = document.querySelector('#editNameBtn');
const editNameForm = document.querySelector('#editNameForm');
const newUsernameInput = document.querySelector('#newUsernameInput');
const cancelEditBtn = document.querySelector('#cancelEditBtn');
const statSnippets = document.querySelector('#statSnippets');
const statViews = document.querySelector('#statViews');
const statCopies = document.querySelector('#statCopies');
const mySnippets = document.querySelector('#mySnippets');

let currentUsername = '';

// Init
async function init() {
  const session = await requireAuth('user');
  if (session) {
    await initTopbar();
    loadProfile();
    loadMySnippets();
  }
}

// Load Profile Data
async function loadProfile() {
  try {
    const profile = await api('/api/user/profile');
    currentUsername = profile.username;
    
    // Set Avatar
    if (profile.avatar_url) {
      profileAvatarImg.src = profile.avatar_url;
    } else {
      profileAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=9d5cff&color=f8f7ff&size=128&bold=true`;
    }

    // Set Name & Date
    profileName.textContent = profile.username;
    const date = new Date(profile.created_at);
    profileJoined.textContent = `Bergabung ${date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}`;

    // Set Stats
    statSnippets.textContent = profile.stats.total_snippets;
    statViews.textContent = profile.stats.total_views;
    statCopies.textContent = profile.stats.total_copies;
  } catch (error) {
    showToast('Gagal memuat profil.');
  }
}

// Load My Snippets
async function loadMySnippets() {
  try {
    const snippets = await api('/api/user/snippets');
    if (!snippets.length) {
      showEmpty(mySnippets, 'Belum ada snippet.', '/upload', 'Upload sekarang!');
      return;
    }
    mySnippets.innerHTML = snippets.map((s) => `
      <article class="snippet-card" data-id="${s.id}">
        <div>
          <div class="snippet-meta">
            <span class="badge">${escapeHtml(s.language)}</span>
            <span>${new Date(s.created_at).toLocaleDateString('id-ID')}</span>
          </div>
          <h3><a href="/snippet.html?id=${s.id}" class="snippet-link">${escapeHtml(s.title)}</a></h3>
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
    showError(mySnippets, 'Gagal memuat snippet.');
  }
}

// Edit Name Logic
editNameBtn.addEventListener('click', () => {
  editNameForm.classList.remove('hidden');
  editNameBtn.classList.add('hidden');
  newUsernameInput.value = currentUsername;
  newUsernameInput.focus();
});

cancelEditBtn.addEventListener('click', () => {
  editNameForm.classList.add('hidden');
  editNameBtn.classList.remove('hidden');
});

editNameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newName = newUsernameInput.value.trim();
  if (!newName || newName === currentUsername) {
    cancelEditBtn.click();
    return;
  }

  try {
    const res = await api('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ username: newName })
    });
    showToast('✅ ' + res.message);
    currentUsername = newName;
    profileName.textContent = newName;
    profileAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=9d5cff&color=f8f7ff&size=128&bold=true`;
    cancelEditBtn.click();
    initTopbar(); // Refresh topbar name
  } catch (error) {
    showToast('❌ ' + error.message);
  }
});

// Avatar Upload Logic
avatarOverlay.addEventListener('click', () => avatarInput.click());

avatarInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) { // 2MB limit
    return showToast('Ukuran gambar maksimal 2MB.');
  }

  // Resize and convert to Base64 using Canvas
  const reader = new FileReader();
  reader.onload = async (event) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const maxSize = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const base64Data = canvas.toDataURL('image/jpeg', 0.8);

      try {
        avatarOverlay.innerHTML = `<div class="spinner" style="width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></div>`;
        await api('/api/user/avatar', {
          method: 'POST',
          body: JSON.stringify({ avatar: base64Data })
        });
        profileAvatarImg.src = base64Data;
        showToast('✅ Avatar berhasil diubah!');
        avatarOverlay.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      } catch (error) {
        showToast('❌ Gagal upload avatar.');
        avatarOverlay.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

init();
