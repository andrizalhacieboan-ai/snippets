import { api, showToast, formData, initTopbar, requireAuth } from '/app.js';

const snippetForm = document.querySelector('#snippetForm');
const uploadBtn = document.querySelector('#uploadBtn');

// Cek auth dan inisialisasi topbar
async function initPage() {
  const session = await requireAuth('user');
  if (session) {
    await initTopbar();
  }
}

// Event listener submit form
snippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ambil teks asli tombol untuk mengembalikan nanti
  const originalBtnContent = uploadBtn.innerHTML;
  
  try {
    // Ubah state tombol jadi Loading
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
      <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Mengupload...`;
    
    // Kirim data ke API
    const data = await api('/api/snippets', { 
      method: 'POST', 
      body: JSON.stringify(formData(snippetForm)) 
    });
    
    // Jika berhasil
    showToast('✅ ' + data.message);
    snippetForm.reset();
    
    // Arahkan ke halaman profil setelah 1.5 detik
    setTimeout(() => { 
      window.location.href = '/profile'; 
    }, 1500);

  } catch (error) {
    // Jika gagal
    showToast('❌ Gagal: ' + error.message);
    
    // Kembalikan tombol ke keadaan semula
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = originalBtnContent;
  }
});

// Jalankan init
initPage();
