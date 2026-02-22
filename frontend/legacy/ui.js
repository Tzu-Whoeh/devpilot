// ═══════════════════ UI HELPERS ═══════════════════
function addMsg(role, text, streaming) {
  const el = document.createElement('div'); el.className = 'message';
  const u = role === 'user';
  const name = u ? (currentUser ? currentUser.username || '你' : '你') : 'DevPilot';
  const ava = u ? (currentUser && currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U') : 'AI';
  el.innerHTML =
    '<div class="msg-ava ' + (u ? 'user' : 'ai') + '">' + ava + '</div>' +
    '<div class="msg-body">' +
      '<div class="msg-role">' + esc(name) + '</div>' +
      '<div class="msg-text">' + esc(text) + '</div>' +
      (streaming ? '<div class="thinking"><div class="thinking-dots"><span></span><span></span><span></span></div><span>思考中...</span></div>' : '') +
    '</div>';
  $('messages').appendChild(el);
  scrollBottom();
  return el;
}

function updMsg(el, t) { const e = el.querySelector('.msg-text'); if (e) e.innerHTML = fmt(t); }
function rmThink(el) { const t = el.querySelector('.thinking'); if (t) t.remove(); }

function fmt(t) {
  var h = esc(t);
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return h;
}

function scrollBottom() { const e = $('messages'); requestAnimationFrame(() => { e.scrollTop = e.scrollHeight; }); }
function setStatus(s, t) { $('stDot').className = 'status-dot ' + s; $('stText').textContent = t; }

function toast(m, t) {
  t = t || 'info';
  const e = document.createElement('div'); e.className = 'toast ' + t;
  e.textContent = m; document.body.appendChild(e);
  setTimeout(() => e.remove(), 4000);
}

// ═══════════════════ EVENTS ═══════════════════
$('inputBox').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
$('inputBox').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 160) + 'px';
});

