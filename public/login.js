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

// Fungsi helper untuk mendapatkan token dari Checkbox V2 (Hanya dipakai Login)
function getRecaptchaResponse() {
  const token = grecaptcha.getResponse();
  if (!token) {
    showToast('⚠️ Harap centang konfirmasi "Saya bukan robot"');
    return null;
  }
  return token;
}

// Login (Dengan reCAPTCHA)
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const recaptchaToken = getRecaptchaResponse();
  if (!recaptchaToken) return;

  try {
    const bodyData = formData(loginForm);
    bodyData.recaptchaToken = recaptchaToken; 
    
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message);
    loginForm.reset();
    grecaptcha.reset(); 
    setTimeout(() => { window.location.href = '/profile'; }, 600);
  } catch (error) {
    showToast('❌ ' + error.message);
    grecaptcha.reset(); 
  }
});

// Register (TANPA reCAPTCHA)
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const bodyData = formData(registerForm);
    // Tidak ada recaptchaToken yang disisipkan
    
    const data = await api('/api/register', { method: 'POST', body: JSON.stringify(bodyData) });
    showToast('✅ ' + data.message + ' Silakan login.');
    registerForm.reset();
    
    // Pindah ke tab Login secara otomatis setelah 1 detik
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
