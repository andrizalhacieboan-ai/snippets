import { api, showToast, escapeHtml, initTopbar, snippetCardHtml, showEmpty, showError } from '/app.js';

const snippetList = document.querySelector('#snippetList');
const announcementBanner = document.querySelector('#announcementBanner');

async function loadAnnouncements() {
  try {
    const anns = await api('/api/announcements');
    if (anns.length > 0) {
      const ann = anns[0]; // Ambil pengumuman terbaru
      
      // Cek apakah user sudah menutup notifikasi ini (gunakan sessionStorage agar hilang saat tab ditutup)
      if (sessionStorage.getItem('ann_dismissed') === String(ann.id)) {
        announcementBanner.classList.add('hidden');
        return;
      }

      announcementBanner.innerHTML = `
        <div class="announcement-card glass-panel">
          <div class="announcement-header">
            <div class="announcement-icon">🔔</div>
            <h3>${escapeHtml(ann.title)}</h3>
            <button class="btn-icon close-ann-btn" title="Tutup">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <p>${escapeHtml(ann.content)}</p>
        </div>
      `;
      announcementBanner.classList.remove('hidden');

      // Event tutup notifikasi
      announcementBanner.querySelector('.close-ann-btn').addEventListener('click', () => {
        sessionStorage.setItem('ann_dismissed', ann.id);
        announcementBanner.classList.add('hidden');
      });
    }
  } catch (error) {
    // Abaikan error jika gagal muat pengumuman
  }
}

async function loadSnippets() {
  try {
    const snippets = await api('/api/snippets');
    if (!snippets.length) {
      showEmpty(snippetList, 'Belum ada snippet. Jadilah uploader pertama!', '/upload', 'Upload Sekarang');
      return;
    }
    snippetList.innerHTML = snippets.map(snippetCardHtml).join('');
  } catch (error) {
    showError(snippetList, 'Gagal memuat snippet.');
  }
}

initTopbar();
loadAnnouncements(); // Panggil fungsi pengumuman
loadSnippets();
