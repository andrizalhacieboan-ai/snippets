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

// Fungsi helper untuk mendapatkan token dari Checkbox hCaptcha
function getCaptchaResponse() {
  // Menggunakan hcaptcha.getResponse() sebagai pengganti grecaptcha
  const token = hcaptcha.getResponse();
  if (!token) {
    showToast('⚠️ Harap centang konfirmasi "I am human"');
    return null;
  }
  return token;
}

// Login (Dengan hCaptcha)
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const recaptchaToken = getCaptchaResponse();
  if (!recaptchaToken) return;

  try {
    const bodyData = formData(loginForm);
    bodyData.recaptchaToken = recaptchaToken; // Nama variabel tetap sama agar backend tidak perlu diubah valiasinya
    
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message);
    loginForm.reset();
    hcaptcha.reset(); // Reset widget hCaptcha
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast('❌ ' + error.message);
    hcaptcha.reset(); // Reset jika gagal
  }
});

// Register (TANPA Captcha)
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const bodyData = formData(registerForm);
    
    const data = await api('/api/register', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message + ' Silahkan login.');
    registerForm.reset();
    
    // Pindah ke tab Login
    setTimeout(() => {
      document.querySelector('[data-tab="login"]').click();
    }, 1000);

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
