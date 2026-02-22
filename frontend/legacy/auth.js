// ═══════════════════ AUTH ═══════════════════
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('loginForm').classList.toggle('active', tab === 'login');
  $('registerForm').classList.toggle('active', tab === 'register');
  $('authError').classList.remove('show');
}

function showAuthError(msg) { $('authError').textContent = msg; $('authError').classList.add('show'); }

async function doLogin(e) {
  if (e) e.preventDefault();
  $('authError').classList.remove('show');
  const btn = $('loginBtn'); btn.disabled = true; btn.textContent = '登录中...';
  try {
    const res = await fetch(baseUrl() + '/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: $('loginUser').value, password: $('loginPass').value})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error && data.error.message ? data.error.message : 'HTTP ' + res.status);
    token = data.token; currentUser = data.user;
    saveSession(data.expires_at);
    enterChat();
  } catch(err) { showAuthError(err.message); }
  finally { btn.disabled = false; btn.textContent = '登录'; }
  return false;
}

async function doRegister(e) {
  if (e) e.preventDefault();
  $('authError').classList.remove('show');
  const btn = $('regBtn'); btn.disabled = true; btn.textContent = '注册中...';
  try {
    const body = {username: $('regUser').value, password: $('regPass').value};
    const email = $('regEmail').value.trim();
    if (email) body.email = email;
    const res = await fetch(baseUrl() + '/auth/register', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error && data.error.message ? data.error.message : 'HTTP ' + res.status);
    token = data.token; currentUser = data.user;
    saveSession(data.expires_at);
    enterChat();
    toast('注册成功！', 'success');
  } catch(err) { showAuthError(err.message); }
  finally { btn.disabled = false; btn.textContent = '注册'; }
  return false;
}

function saveSession(expiresAt) {
  const exp = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 86400000;
  localStorage.setItem('claw_session', JSON.stringify({token, user: currentUser, exp, baseUrl: baseUrl()}));
}

function doLogout() {
  token = ''; currentUser = null; currentSession = '';
  localStorage.removeItem('claw_session');
  $('chatScreen').classList.remove('active');
  $('chatScreen').style.display = 'none';
  $('authScreen').style.display = '';
  $('messages').innerHTML = '';
  $('sessionList').innerHTML = '';
  $('inputBox').value = '';
}

function enterChat() {
  $('authScreen').style.display = 'none';
  $('chatScreen').style.display = '';
  $('chatScreen').classList.add('active');
  $('sendBtn').disabled = false;
  $('inputBox').focus();
  const name = currentUser ? (currentUser.username || 'user') : 'user';
  $('userDisplay').textContent = name;
  $('userAvatar').textContent = name.charAt(0).toUpperCase();
  setStatus('ok', '已连接');
  updateHint();
  loadSessions();
  // Auto-open monitor on first login
  if (!$('chatScreen').classList.contains('monitor-open')) toggleMonitor();
}

// User Settings Modal
function openUserSettings() { 
  console.log('openUserSettings called');
  const modal = document.getElementById('userSettingsModal');
  console.log('modal:', modal);
  const usernameInput = document.getElementById('settingsUsername');
  const user = getCurrentUser();
  if (user) {
    usernameInput.value = user.username;
  }
  modal.classList.add("show");
}

// 点击背景关闭
document.getElementById("userSettingsModal").addEventListener("click", function(e) {
  if (e.target === this) closeUserSettings();
});

function closeUserSettings() {
  const modal = document.getElementById("userSettingsModal"); modal.classList.remove("show"); modal.classList.remove("show");
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('settingsMsg').textContent = '';
}

async function changePassword() {
  const oldPwd = document.getElementById('oldPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  const msg = document.getElementById('settingsMsg');
  
  if (!oldPwd || !newPwd) {
    msg.textContent = '请填写所有字段';
    msg.style.color = 'var(--error)';
    return;
  }
  
  if (newPwd.length < 8) {
    msg.textContent = '新密码至少8位';
    msg.style.color = 'var(--error)';
    return;
  }
  
  const token = localStorage.getItem('token');
  if (!token) {
    msg.textContent = '请先登录';
    msg.style.color = 'var(--error)';
    return;
  }
  
  try {
    const res = await fetch(baseUrl + '/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({old_password: oldPwd, new_password: newPwd})
    });
    const data = await res.json();
    
    if (res.ok && data.ok) {
      msg.textContent = '密码修改成功！';
      msg.style.color = 'var(--success)';
      setTimeout(closeUserSettings, 1500);
    } else {
      msg.textContent = data.error?.message || '修改失败';
      msg.style.color = 'var(--error)';
    }
  } catch(err) {
    msg.textContent = '请求失败';
    msg.style.color = 'var(--error)';
  }
}
// Fix close function
function closeUserSettings() {
  var modal = document.getElementById('userSettingsModal');
  if (modal) {
    modal.classList.remove("show");
    console.log('Modal closed');
  }
}

// Add ESC key to close
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeUserSettings();
  }
});

// Click outside to close
document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('userSettingsModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeUserSettings();
      }
    });
  }
});
