// ═══════════════════ CHAT ═══════════════════
async function sendMessage() {
  const text = $('inputBox').value.trim();
  if (!text || !token || isStreaming) return;
  const w = $('welcome'); if (w) w.remove();
  addMsg('user', text);
  $('inputBox').value = '';
  $('inputBox').style.height = 'auto';
  isStreaming = true;
  $('sendBtn').disabled = true;

  const url = baseUrl() + '/chat/chat/completions';
  const body = {message: text};
  if (currentSession) body.session_key = currentSession;
  const aiEl = addMsg('assistant', '', true);

  try {
    const res = await tf(url, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error && err.error.message ? err.error.message : err.detail || 'HTTP ' + res.status);
    }

    const newKey = res.headers.get('x-session-key');
    if (newKey && !currentSession) { currentSession = newKey; updateHint(); loadSessions(); }

    // Create SSE monitor entry
    const sp = url.replace(/https?:\/\/[^/]+/, '');
    const se = Mon.add({
      type: 'sse', method: 'POST', url: url, path: sp,
      status: res.status, sseActive: true, sseEvts: [],
      reqB: body, dur: null
    });
    const t0 = performance.now();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buf += decoder.decode(value, {stream: true});
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          let evtType = 'data';
          try { const p = JSON.parse(raw); evtType = p.type || 'data'; } catch(ex) {}
          Mon.pushSSE(se.id, {t: evtType, d: raw.substring(0, 150)});

          if (raw === '[DONE]') continue;
          try {
            const d = JSON.parse(raw);
            if (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content) {
              full += d.choices[0].delta.content; updMsg(aiEl, full); scrollBottom();
            } else if (d.type === 'delta' || d.type === 'thinking') {
              full += d.text || ''; updMsg(aiEl, full); scrollBottom();
            } else if (d.type === 'error') {
              full += '\n\u26A0\uFE0F ' + (d.message || 'error'); updMsg(aiEl, full);
            }
          } catch(ex) {}
        } else if (line.startsWith('event: ')) {
          Mon.pushSSE(se.id, {t: line.slice(7), d: ''});
        }
      }
    }

    Mon.update(se.id, {sseActive: false, dur: Math.round(performance.now() - t0)});
    if (!full) updMsg(aiEl, '(无回复 — 查看 Monitor 面板)');
  } catch(e) {
    updMsg(aiEl, '\u26A0\uFE0F ' + e.message);
    toast(e.message, 'error');
  } finally {
    isStreaming = false;
    $('sendBtn').disabled = false;
    rmThink(aiEl);
    scrollBottom();
  }
}
