// ═══════════════════ MONITOR ENGINE ═══════════════════
const Mon = {
  entries: [], sseN: 0, okN: 0, failN: 0, tab: 'all', filter: 'all', _id: 0,

  add(e) {
    e.id = ++this._id; e.ts = new Date(); this.entries.push(e);
    if (e.status >= 200 && e.status < 400) this.okN++;
    else if (e.status > 0) this.failN++;
    if (e.type === 'sse') this.sseN++;
    this._stats();
    if (this._vis(e)) this._render(e);
    return e;
  },

  _vis(e) {
    const t = this.tab;
    if (t === 'api' && e.type === 'sse') return false;
    if (t === 'sse' && e.type !== 'sse') return false;
    if (t === 'err' && e.status > 0 && e.status < 400) return false;
    if (this.filter !== 'all' && !(e.path || '').startsWith('/' + this.filter)) return false;
    return true;
  },

  _stats() {
    $('monTotal').textContent = this.entries.length;
    $('monOk').textContent = this.okN;
    $('monFail').textContent = this.failN;
    $('monSSE').textContent = this.sseN;
    $('tcAll').textContent = this.entries.length;
    $('tcApi').textContent = this.entries.filter(e => e.type !== 'sse').length;
    $('tcSse').textContent = this.sseN;
    $('tcErr').textContent = this.entries.filter(e => e.status >= 400 || e.status === 0).length;
  },

  _render(e) {
    const logs = $('monLogs');
    const el = document.createElement('div');
    const isErr = e.status >= 400 || e.status === 0;
    el.className = 'mon-entry' + (isErr ? ' merr' : '') + (e.type === 'sse' ? ' msse' : '');
    el.id = 'me-' + e.id;

    const mc = e.type === 'sse' ? 'sse' : isErr ? 'merr' : (e.method || 'get').toLowerCase();
    const sc = e.type === 'sse' ? 'st' : (e.status >= 200 && e.status < 400) ? 'ok' : 'fl';
    const sv = e.type === 'sse' ? (e.sseActive ? 'STREAM' : 'DONE') : (e.status || 'ERR');
    const ts = e.ts;
    const tStr = ts.toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})
                 + '.' + String(ts.getMilliseconds()).padStart(3, '0');

    el.innerHTML =
      '<div class="mon-row" onclick="monToggle(' + e.id + ')">' +
        '<span class="mon-m ' + mc + '">' + (e.type === 'sse' ? 'SSE' : esc(e.method || 'GET')) + '</span>' +
        '<span class="mon-p" title="' + esc(e.url || '') + '">' + esc(e.path || '') + '</span>' +
        '<span class="mon-s ' + sc + '" id="ms-' + e.id + '">' + sv + '</span>' +
        '<span class="mon-d" id="md-' + e.id + '">' + (e.dur != null ? e.dur + 'ms' : '...') + '</span>' +
        '<span class="mon-t">' + tStr + '</span>' +
      '</div>' +
      '<div class="mon-det" id="det-' + e.id + '">' + this._det(e) + '</div>';

    logs.appendChild(el);
    logs.scrollTop = logs.scrollHeight;
  },

  _det(e) {
    let h = '';
    // Request section
    if (e.reqH || e.reqB != null) {
      h += '<div class="mon-sec"><div class="mon-lbl">&#x25B6; REQUEST HEADERS</div>';
      if (e.reqH) h += '<div class="mon-dd">' + sHL(e.reqH) + '</div>';
      h += '</div>';
      if (e.reqB != null) {
        h += '<div class="mon-sec"><div class="mon-lbl">&#x25B6; REQUEST BODY</div>';
        h += '<div class="mon-dd">' + sHL(e.reqB) + '</div></div>';
      }
      h += '<hr class="mon-hr">';
    }
    // Response section
    h += '<div class="mon-sec">';
    h += '<div class="mon-lbl">&#x25C0; RESPONSE ' + (e.status || '') + '</div>';
    if (e.resH) h += '<div class="mon-dd">' + sHL(e.resH) + '</div>';
    if (e.resB != null) h += '<div class="mon-dd">' + sHL(e.resB) + '</div>';
    h += '</div>';
    // SSE events
    if (e.type === 'sse') {
      h += '<hr class="mon-hr"><div class="mon-sec">';
      h += '<div class="mon-lbl">&#x21AF; SSE EVENTS <span id="sc-' + e.id + '">' + (e.sseEvts ? e.sseEvts.length : 0) + '</span></div>';
      h += '<div class="mon-ssebox" id="sb-' + e.id + '">';
      if (e.sseEvts) {
        for (var i = 0; i < e.sseEvts.length; i++) {
          var ev = e.sseEvts[i];
          h += '<div class="mon-sseev"><span class="et">' + esc(ev.t || 'data') + '</span><span class="ed">' + esc(ev.d || '') + '</span></div>';
        }
      }
      h += '</div></div>';
    }
    return h;
  },

  update(id, u) {
    const e = this.entries.find(x => x.id === id);
    if (!e) return;
    Object.assign(e, u);
    const s = $('ms-' + id);
    if (s && u.sseActive === false) {
      s.className = 'mon-s ok'; s.textContent = 'DONE';
      const el = $('me-' + id);
      if (el) el.classList.remove('msse');
    } else if (s && u.status != null) {
      s.className = 'mon-s ' + ((u.status >= 200 && u.status < 400) ? 'ok' : 'fl');
      s.textContent = u.status;
    }
    const d = $('md-' + id);
    if (d && u.dur != null) d.textContent = u.dur + 'ms';
    if (u.status) {
      if (u.status >= 200 && u.status < 400) this.okN++;
      else if (u.status >= 400) this.failN++;
    }
    this._stats();
  },

  pushSSE(id, ev) {
    const e = this.entries.find(x => x.id === id);
    if (!e) return;
    if (!e.sseEvts) e.sseEvts = [];
    e.sseEvts.push(ev);
    const box = $('sb-' + id);
    if (box) {
      const d = document.createElement('div');
      d.className = 'mon-sseev';
      d.innerHTML = '<span class="et">' + esc(ev.t || 'data') + '</span><span class="ed">' + esc(ev.d || '') + '</span>';
      box.appendChild(d);
      box.scrollTop = box.scrollHeight;
    }
    const c = $('sc-' + id);
    if (c) c.textContent = e.sseEvts.length;
  },

  refreshAll() {
    $('monLogs').innerHTML = '';
    for (var i = 0; i < this.entries.length; i++) {
      if (this._vis(this.entries[i])) this._render(this.entries[i]);
    }
  },

  clear() {
    this.entries = []; this.sseN = 0; this.okN = 0; this.failN = 0;
    $('monLogs').innerHTML = '';
    this._stats();
  }
};

// Syntax highlight for JSON
function sHL(v) {
  if (v == null) return '<span class="nv">null</span>';
  if (typeof v === 'object') { try { v = JSON.stringify(v, null, 2); } catch(ex) { v = String(v); } }
  if (typeof v !== 'string') v = String(v);
  var h = esc(v);
  h = h.replace(/&quot;([^&]*?)&quot;:/g, '<span class="k">&quot;$1&quot;</span>:');
  h = h.replace(/: &quot;(.*?)&quot;/g, ': <span class="sv">&quot;$1&quot;</span>');
  h = h.replace(/: (\d+\.?\d*)/g, ': <span class="nv">$1</span>');
  h = h.replace(/: (null|true|false)/g, ': <span class="nv">$1</span>');
  return h;
}

// Monitor UI functions
function monToggle(id) { const el = $('me-' + id); if (el) el.classList.toggle('open'); }
function monTab(t) {
  Mon.tab = t;
  document.querySelectorAll('.mon-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  Mon.refreshAll();
}
function monFilt(chip) {
  document.querySelectorAll('.mon-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  Mon.filter = chip.dataset.f;
  Mon.refreshAll();
}
function monClear() { Mon.clear(); }
function monExport() {
  const data = Mon.entries.map(e => ({
    time: e.ts ? e.ts.toISOString() : null,
    method: e.method, url: e.url, status: e.status, dur: e.dur,
    reqBody: e.reqB, resBody: e.resB, sseEvents: e.sseEvts ? e.sseEvts.length : 0
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'devpilot-monitor-' + new Date().toISOString().slice(0, 19) + '.json';
  a.click();
}
function toggleMonitor() {
  const on = $('chatScreen').classList.toggle('monitor-open');
  $('monitorBtn').classList.toggle('active', on);
}

// ═══════════════════ TRACED FETCH ═══════════════════
async function tf(url, opts) {
  opts = opts || {};
  const method = (opts.method || 'GET').toUpperCase();
  var reqBody = null;
  if (opts.body) { try { reqBody = JSON.parse(opts.body); } catch(ex) { reqBody = opts.body; } }

  const headers = Object.assign({}, opts.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;

  // Summarize headers for monitor (mask JWT)
  const rqH = {};
  for (const k in headers) {
    rqH[k] = k.toLowerCase() === 'authorization' ? headers[k].substring(0, 15) + '...[JWT]' : headers[k];
  }

  const shortPath = url.replace(/https?:\/\/[^/]+/, '');
  const t0 = performance.now();

  try {
    const res = await fetch(url, Object.assign({}, opts, {headers: headers}));
    const ms = Math.round(performance.now() - t0);
    const ct = res.headers.get('content-type') || '';

    // SSE streams: sendMessage handles detailed monitoring
    if (ct.includes('text/event-stream') || ct.includes('octet-stream')) {
      return res;
    }

    // Clone to read body without consuming
    const clone = res.clone();
    var resData;
    try { resData = await clone.json(); } catch(ex) { resData = await clone.text(); }

    // Capture response headers
    const rsH = {};
    res.headers.forEach((v, k) => { rsH[k] = v; });

    Mon.add({
      type: 'api', method: method, url: url, path: shortPath,
      status: res.status, dur: ms,
      reqH: rqH, reqB: reqBody,
      resH: rsH, resB: resData
    });

    if (res.status === 401) {
      toast('登录已过期，请重新登录', 'error');
      setTimeout(doLogout, 1500);
    }
    return res;
  } catch(e) {
    const ms = Math.round(performance.now() - t0);
    Mon.add({
      type: 'api', method: method, url: url, path: shortPath,
      status: 0, dur: ms,
      reqH: rqH, reqB: reqBody,
      resB: {error: e.message}
    });
    throw e;
  }
}
