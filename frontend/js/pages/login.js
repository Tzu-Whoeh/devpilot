/* ═══ Login Page ═══ */
const LoginPage = {
  render() {
    const authScreen = document.getElementById('authScreen');
    authScreen.classList.add('active');
    // Bind events
    setTimeout(() => this._bind(), 0);
  },

  hide() {
    document.getElementById('authScreen')?.classList.remove('active');
  },

  _bind() {
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');
    if (loginForm) loginForm.onsubmit = (e) => this._doLogin(e);
    if (regForm) regForm.onsubmit = (e) => this._doRegister(e);
  },

  switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('loginForm')?.classList.toggle('active', tab === 'login');
    document.getElementById('registerForm')?.classList.toggle('active', tab === 'register');
    const err = document.getElementById('authError');
    if (err) err.classList.remove('show');
  },

  async _doLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('authError');
    errEl.classList.remove('show');
    btn.disabled = true; btn.textContent = '登录中...';

    try {
      const username = document.getElementById('loginUser').value;
      const password = document.getElementById('loginPass').value;
      const data = await API.login(username, password);
      AppState.token = data.token;
      AppState.user = data.user;
      this.hide();
      Shell.init();
      Router.navigate('/');
      Shell.toast('登录成功', 'success');
    } catch(err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = '登录';
    }
  },

  async _doRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('regBtn');
    const errEl = document.getElementById('authError');
    errEl.classList.remove('show');
    btn.disabled = true; btn.textContent = '注册中...';

    try {
      const username = document.getElementById('regUser').value;
      const password = document.getElementById('regPass').value;
      const email = document.getElementById('regEmail')?.value;
      const data = await API.register(username, password, email);
      AppState.token = data.token;
      AppState.user = data.user;
      this.hide();
      Shell.init();
      Router.navigate('/');
      Shell.toast('注册成功！', 'success');
    } catch(err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = '注册';
    }
  }
};
window.LoginPage = LoginPage;
