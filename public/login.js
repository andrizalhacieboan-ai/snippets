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

// Fungsi helper untuk mendapatkan token dari Checkbox V2
function getRecaptchaResponse() {
  // grecaptcha.getResponse() akan return string token jika dicentang, atau string kosong jika belum
  const token = grecaptcha.getResponse();
  if (!token) {
    showToast('⚠️ Harap centang konfirmasi "Saya bukan robot"');
    return null;
  }
  return token;
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ambil token dari checkbox
  const recaptchaToken = getRecaptchaResponse();
  if (!recaptchaToken) return;

  try {
    const bodyData = formData(loginForm);
    bodyData.recaptchaToken = recaptchaToken; // Sisipkan token ke payload
    
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message);
    loginForm.reset();
    grecaptcha.reset(); // Reset checkbox setelah submit
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast('❌ ' + error.message);
    grecaptcha.reset(); // Reset juga jika gagal, agar bisa coba lagi
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ambil token dari checkbox
  const recaptchaToken = getRecaptchaResponse();
  if (!recaptchaToken) return;

  try {
    const bodyData = formData(registerForm);
    bodyData.recaptchaToken = recaptchaToken; // Sisipkan token ke payload
    
    const data = await api('/api/register', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message);
    registerForm.reset();
    grecaptcha.reset(); // Reset checkbox setelah submit
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast('❌ ' + error.message);
    grecaptcha.reset(); // Reset juga jika gagal
  }
});

// Jika sudah login, redirect ke profil
initTopbar().then((session) => {
  if (session?.loggedIn && session.role === 'user') {
    window.location.href = '/profile';
  }
});
