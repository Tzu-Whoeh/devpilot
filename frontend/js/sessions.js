// ═══════════════════ SESSIONS ═══════════════════
async function loadSessions() {
  if (!token) return;
  try {
    const res = await tf(baseUrl() + '/chat/sessions');
    const data = await res.json();
    const sessions = Array.isArray(data) ? data : (data.sessions || data.data || []);
    const list = $('sessionList');
    list.innerHTML = '';
    sessions.forEach(s => {
      const key = typeof s === 'string' ? s : (s.session_key || s.key || s.sessionKey || '');
      const name = typeof s === 'string' ? s : (s.display_name || s.displayName || key);
      if (!key) return;
      const el = document.createElement('div');
      el.className = 'session-item' + (key === currentSession ? ' active' : '');
      el.textContent = name;
      el.onclick = () => selectSession(key);
      list.appendChild(el);
    });
  } catch(e) {
    console.error('[Sessions] load failed:', e);
    toast('会话加载失败: ' + e.message, 'error');
    setStatus('err', '服务异常');
  }
}

function selectSession(key) {
  currentSession = key;
  updateHint();
  $('messages').innerHTML = '';
  document.querySelectorAll('.session-item').forEach(el => {
    el.classList.toggle('active', el.textContent === key || el.textContent.includes(key));
  });
  loadHistory();
}

async function newSession() {
  if (!token) return;
  try {
    const res = await tf(baseUrl() + '/chat/sessions', {
      method: 'POST', headers: {'Content-Type': 'application/json'}
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error && data.error.message ? data.error.message : 'Failed');
    const key = data.session_key || data.sessionKey || '';
    if (key) {
      currentSession = key;
      $('messages').innerHTML = '';
      toast('新会话已创建', 'success');
      await loadSessions();
      updateHint();
    }
  } catch(e) { toast('创建失败: ' + e.message, 'error'); }
}

async function loadHistory() {
  if (!token || !currentSession) return;
  try {
    const res = await tf(baseUrl() + '/chat/chat/history/' + encodeURIComponent(currentSession));
    const data = await res.json();
    const msgs = data.messages || data || [];
    $('messages').innerHTML = '';
    if (Array.isArray(msgs)) {
      // Sort by timestamp to ensure chronological order
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      msgs.forEach(m => {
        const role = m.role || (m.type === 'user' ? 'user' : 'assistant');
        const raw = m.content || m.text || m.message || '';
        const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(b => b.text || b.content || '').join('') : String(raw);
        if (text) addMsg(role, text);
      });
    }
    scrollBottom();
  } catch(e) { console.error('[History] load failed:', e); }
}

function updateHint() {
  $('inputHint').textContent = currentSession
    ? '会话: ' + currentSession.substring(0, 20) + '...'
    : token ? '未选择会话 — 发送消息将自动创建' : '';
}
