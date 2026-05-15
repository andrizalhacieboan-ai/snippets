import { api, showToast, formData, initTopbar } from '/app.js';

const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const tabs = document.querySelectorAll('.login-tab');

// Tab switching
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    if (tab.dataset.tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    }
  });
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify(formData(loginForm)) });
    showToast(data.message);
    loginForm.reset();
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast(error.message);
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/register', { method: 'POST', body: JSON.stringify(formData(registerForm)) });
    showToast(data.message);
    registerForm.reset();
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast(error.message);
  }
});

// Jika sudah login, redirect ke profil
initTopbar().then((session) => {
  if (session?.loggedIn && session.role === 'user') {
    window.location.href = '/profile';
  }
});
