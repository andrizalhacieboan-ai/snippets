import { api, showToast, formData, initTopbar, requireAuth } from '/app.js';

const snippetForm = document.querySelector('#snippetForm');
const uploadBtn = document.querySelector('#uploadBtn');

async function initPage() {
  const session = await requireAuth('user');
  if (session) {
    await initTopbar();
  }
}

snippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const originalBtnContent = uploadBtn.innerHTML;
  
  try {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Mengupload...`;
    
    const data = await api('/api/snippets', { 
      method: 'POST', 
      body: JSON.stringify(formData(snippetForm)) 
    });
    
    showToast('✅ ' + data.message);
    snippetForm.reset();
    
    setTimeout(() => { window.location.href = '/profile'; }, 1200);

  } catch (error) {
    showToast('❌ Gagal: ' + error.message);
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = originalBtnContent;
  }
});

initPage();
