import { api, showToast, formData, initTopbar, requireAuth } from '/app.js';

const snippetForm = document.querySelector('#snippetForm');

requireAuth('user').then((session) => {
  if (session) initTopbar();
});

snippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/snippets', { method: 'POST', body: JSON.stringify(formData(snippetForm)) });
    showToast(data.message);
    snippetForm.reset();
    setTimeout(() => { window.location.href = '/profile'; }, 800);
  } catch (error) {
    showToast(error.message);
  }
});
