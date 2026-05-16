import { api, showToast, formData, initTopbar } from '/app.js';

const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const tabs = document.querySelectorAll('.login-tab');

// Site Key reCAPTCHA Anda
const RECAPTCHA_SITE_KEY = '6LeAbe0sAAAAANyNb124Qv8eert55r62SxrK1HRN';

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

// Fungsi helper untuk mendapatkan token reCAPTCHA dari Google
async function getRecaptchaToken(action) {
  if (!RECAPTCHA_SITE_KEY) {
    showToast('reCAPTCHA Site Key belum dikonfigurasi!');
    return null;
  }
  try {
    // Panggil Google API untuk generate token
    const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
    return token;
  } catch (error) {
    console.error('reCAPTCHA error:', error);
    showToast('Gagal memuat verifikasi keamanan.');
    return null;
  }
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ambil token verifikasi bot
  const recaptchaToken = await getRecaptchaToken('login');
  if (!recaptchaToken) return; // Hentikan jika gagal ambil token

  try {
    const bodyData = formData(loginForm);
    bodyData.recaptchaToken = recaptchaToken; // Sisipkan token ke payload
    
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message);
    loginForm.reset();
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast('❌ ' + error.message);
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ambil token verifikasi bot
  const recaptchaToken = await getRecaptchaToken('register');
  if (!recaptchaToken) return; // Hentikan jika gagal ambil token

  try {
    const bodyData = formData(registerForm);
    bodyData.recaptchaToken = recaptchaToken; // Sisipkan token ke payload
    
    const data = await api('/api/register', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message);
    registerForm.reset();
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast('❌ ' + error.message);
  }
});

// Jika sudah login, redirect ke profil
initTopbar().then((session) => {
  if (session?.loggedIn && session.role === 'user') {
    window.location.href = '/profile';
  }
});
