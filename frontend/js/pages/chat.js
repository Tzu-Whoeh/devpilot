/* ═══ Chat Page v3.1 — Optimized: Dynamic Agents, SSE Events, Stop Button ═══
 *
 * Changelog v3.1 (UX-DEVPILOT-CHAT-001):
 *   Task-1: Fix Responses API file upload format (source object)
 *   Task-2: Session management — use server-side context via `user` field
 *   Task-4: Add stop-generation button
 *   Task-5: Dynamic agent list from server (remove hardcoded icons)
 */
const ChatPage = {
  // ── State ──
  _agents: {},
  _sessions: {},
  _activeSession: null,
  _expandedAgents: {},
  _sending: false,
  _abortCtrl: null,
  _attachments: [],
  _initialized: false,

  _greetings: new Set([
    '你好','hi','hello','hey','嗨','在吗','在不在','在','您好','哈喽',
    'hola','yo','sup','嘿','请问','你好呀','hi there','hello there'
  ]),

  // ══════════════════════════════════════════════════════
  //  Task-5: Dynamic agent icon mapping (replaces hardcoded _agentIcons)
  // ══════════════════════════════════════════════════════
  _getAgentIcon(agentId, agentData) {
    // Priority 1: server-provided icon field
    if (agentData?.icon) return agentData.icon;
    // Priority 2: keyword-based smart mapping
    const id = (agentId || '').toLowerCase();
    if (id.includes('code') || id.includes('dev') || id === 'coder') return '💻';
    if (id.includes('pm') || id.includes('manage')) return '📋';
    if (id.includes('ba') || id.includes('analy')) return '📊';
    if (id.includes('arch')) return '🏗️';
    if (id.includes('qa') || id.includes('test')) return '✅';
    if (id.includes('ops') || id.includes('deploy')) return '🚀';
    if (id.includes('write') || id.includes('doc')) return '✍️';
    if (id.includes('invest') || id.includes('financ')) return '💰';
    if (id.includes('review')) return '🔍';
    if (id === 'main' || id.includes('general') || id.includes('assist')) return '📎';
    // Priority 3: default
    return '🤖';
  },

  // ══════════════════════════════════════════════════════
  //  INIT (called once on app boot, loads agents for sidebar)
  // ══════════════════════════════════════════════════════
  async init() {
    if (this._initialized) return;
    this._loadState();
    await this._loadAgents();
    this._initialized = true;
  },

  // ══════════════════════════════════════════════════════
  //  RENDER (called when navigating to /chat) — 三栏布局 v2.0
  // ══════════════════════════════════════════════════════
  async render() {
    Shell.setBreadcrumb([{ label: '💬 AI 对话', path: '/chat' }]);
    await this.init();

    // 左侧面板：AI岗位 (RolePanel)
    const leftPanel = RolePanel.renderHTML((trigger) => {
      // 双击职责 → 填充输入框
      const input = document.getElementById('chatInput');
      if (input) { input.value = trigger + ' '; input.focus(); }
    });

    // 右侧面板：交互记录 (InteractionLog)
    InteractionLog.clear();
    const rightPanel = InteractionLog.renderHTML();

    Shell.setContent(`
      <div class="chat-page chat-three-col">
        ${leftPanel}
        <div class="chat-main" id="chatMain">
          <div class="chat-drag-overlay" id="chatDragOverlay">📎 拖放文件到此处</div>
          <div class="chat-messages" id="chatMsgs"></div>
          <div class="chat-input-area">
            <div class="chat-input-container">
              <div class="chat-attachments" id="chatAttachments"></div>
              <div class="chat-input-wrap">
                <button class="chat-attach-btn" onclick="document.getElementById('chatFileInput').click()" title="上传文件/图片">📎</button>
                <input type="file" id="chatFileInput" multiple accept="image/*,.pdf,.txt,.md,.json,.csv,.html" style="display:none" onchange="ChatPage.handleFiles(this.files)">
                <textarea id="chatInput" placeholder="输入消息，或双击左侧职责快速填充..." rows="1"
                  onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ChatPage.send()}"
                  oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,160)+'px'"></textarea>
                <button class="chat-send-btn" id="chatSendBtn" onclick="ChatPage.send()" title="发送">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        ${rightPanel}
      </div>
    `);
    this._bindDragDrop();
    this._renderMessages();
    if (this._activeSession) {
      setTimeout(() => document.getElementById('chatInput')?.focus(), 50);
    }
  },

  // ══════════════════════════════════════════════════════
  //  AGENTS
  // ══════════════════════════════════════════════════════
  async _loadAgents() {
    try {
      this._agents = await API.getAgents();
    } catch (e) {
      this._agents = {};
      console.error('Failed to load agents:', e.message);
      Shell.toast('⚠️ 无法加载 Agent 列表: ' + e.message, 'error');
    }
  },

  /** Task-5: Refresh agents from server */
  async refreshAgents() {
    try {
      this._agents = await API.getAgents();
      if (document.getElementById('chatAgentPicker')) this.showAgentPicker();
      Shell.toast('Agent 列表已刷新', 'success');
    } catch (e) {
      console.error('Agent refresh failed:', e);
      Shell.toast('刷新失败: ' + e.message, 'error');
    }
  },

  // ══════════════════════════════════════════════════════
  //  SIDEBAR TREE (rendered inside Shell sidebar)
  // ══════════════════════════════════════════════════════
  _renderSidebarTree(container) {
    const grouped = {};
    for (const [sid, s] of Object.entries(this._sessions)) {
      if (!grouped[s.agentId]) grouped[s.agentId] = [];
      grouped[s.agentId].push({ ...s, id: sid });
    }
    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    }

    let html = '';
    // Render agents from server list
    for (const [agentId, agent] of Object.entries(this._agents)) {
      const sessions = grouped[agentId] || [];
      const expanded = this._expandedAgents[agentId] || sessions.some(s => s.id === this._activeSession);
      const icon = this._getAgentIcon(agentId, agent);
      const count = sessions.length;
      html += `
        <div class="sb-agent-node ${expanded ? 'expanded' : ''}" data-agent="${_esc(agentId)}">
          <div class="sb-agent-header" onclick="ChatPage.toggleAgent('${_esc(agentId)}')">
            <span class="sb-agent-arrow">▶</span>
            <span class="sb-agent-icon">${icon}</span>
            <span class="sb-agent-name">${_esc(agent.name || agentId)}</span>
            ${count ? `<span class="sb-agent-badge">${count}</span>` : ''}
          </div>
          <div class="sb-session-list">
            ${sessions.map(s => `
              <div class="sb-session-item ${s.id === this._activeSession ? 'active' : ''}"
                   onclick="ChatPage.openSession('${s.id}')" data-sid="${s.id}">
                <span class="sb-session-title">${_esc(s.title || '新对话')}</span>
                <span class="sb-session-del" onclick="event.stopPropagation();ChatPage.deleteSession('${s.id}')" title="删除">✕</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Task-5: Show orphaned sessions (agent removed from server)
    for (const [agentId, sessions] of Object.entries(grouped)) {
      if (this._agents[agentId]) continue;
      const expanded = this._expandedAgents[agentId] || sessions.some(s => s.id === this._activeSession);
      html += `
        <div class="sb-agent-node ${expanded ? 'expanded' : ''}" data-agent="${_esc(agentId)}">
          <div class="sb-agent-header" onclick="ChatPage.toggleAgent('${_esc(agentId)}')" style="opacity:0.5" title="此 Agent 已不在服务端列表中">
            <span class="sb-agent-arrow">▶</span>
            <span class="sb-agent-icon">🤖</span>
            <span class="sb-agent-name">${_esc(agentId)} <small>(已移除)</small></span>
            <span class="sb-agent-badge">${sessions.length}</span>
          </div>
          <div class="sb-session-list">
            ${sessions.map(s => `
              <div class="sb-session-item ${s.id === this._activeSession ? 'active' : ''}"
                   onclick="ChatPage.openSession('${s.id}')" data-sid="${s.id}">
                <span class="sb-session-title">${_esc(s.title || '新对话')}</span>
                <span class="sb-session-del" onclick="event.stopPropagation();ChatPage.deleteSession('${s.id}')" title="删除">✕</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  toggleAgent(agentId) {
    const sessions = Object.values(this._sessions).filter(s => s.agentId === agentId);
    if (sessions.length === 0) {
      this._createSession(agentId);
      return;
    }
    this._expandedAgents[agentId] = !this._expandedAgents[agentId];
    this._saveState();
  },

  // ══════════════════════════════════════════════════════
  //  AGENT PICKER MODAL (Task-5: dynamic icons + refresh)
  // ══════════════════════════════════════════════════════
  showAgentPicker() {
    document.getElementById('chatAgentPicker')?.remove();
    let html = `<div class="chat-agent-picker" id="chatAgentPicker" onclick="if(event.target===this)this.remove()">
      <div class="chat-agent-picker-inner">
        <div class="chat-agent-picker-header">
          <h3>选择 Agent 开始新对话</h3>
          <button class="chat-agent-refresh-btn" onclick="event.stopPropagation();ChatPage.refreshAgents()" title="刷新 Agent 列表">🔄</button>
        </div>
        <div class="chat-agent-picker-list">`;
    for (const [id, a] of Object.entries(this._agents)) {
      const icon = this._getAgentIcon(id, a);
      html += `<div class="chat-agent-picker-item" onclick="ChatPage.pickAgent('${_esc(id)}')">
        <span class="ap-icon">${icon}</span>
        <div class="ap-info"><div class="ap-name">${_esc(a.name || id)}</div><div class="ap-desc">${_esc(a.description || '')}</div></div>
      </div>`;
    }
    if (Object.keys(this._agents).length === 0) {
      html += `<div style="text-align:center;color:var(--text-dim);padding:var(--space-lg)">暂无可用 Agent，请检查 AI Gateway 连接</div>`;
    }
    html += `</div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  pickAgent(agentId) {
    document.getElementById('chatAgentPicker')?.remove();
    this._createSession(agentId);
  },

  // ══════════════════════════════════════════════════════
  //  SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════
  _createSession(agentId) {
    const sid = 'dp:' + (AppState.user?.username || 'anon') + ':' + agentId + ':' + this._uuid();
    this._sessions[sid] = {
      agentId, title: '新对话', titleLocked: false,
      messages: [], created: new Date().toISOString(),
    };
    this._expandedAgents[agentId] = true;
    this.openSession(sid);
  },

  /** Open a session — navigate to /chat if needed, then switch */
  openSession(sid) {
    this._activeSession = sid;
    this._attachments = [];
    this._saveState();
    if (Router.current !== '/chat') {
      Router.navigate('/chat');
    } else {
      this._renderMessages();
      this._renderAttachments();
      setTimeout(() => document.getElementById('chatInput')?.focus(), 50);
    }
  },

  deleteSession(sid) {
    delete this._sessions[sid];
    if (this._activeSession === sid) {
      this._activeSession = null;
      if (Router.current === '/chat') this._renderMessages();
    }
    this._saveState();
  },

  // ══════════════════════════════════════════════════════
  //  MESSAGE RENDERING (Task-5: dynamic icons)
  // ══════════════════════════════════════════════════════
  _renderMessages() {
    const el = document.getElementById('chatMsgs');
    if (!el) return;
    const session = this._sessions[this._activeSession];
    if (!session || session.messages.length === 0) {
      const agent = this._agents[session?.agentId] || {};
      const icon = this._getAgentIcon(session?.agentId, agent);
      el.innerHTML = `<div class="chat-welcome">
        <div class="chat-welcome-icon">${session ? icon : '🤖'}</div>
        <h2>${session ? _esc(agent.name || 'AI 助手') : 'DevPilot AI 助手'}</h2>
        <p>${session ? _esc(agent.description || '开始对话吧') : '选择左侧 Agent 或点「+ 新对话」开始'}</p>
      </div>`;
      return;
    }
    el.innerHTML = session.messages.map(m => this._renderMsg(m)).join('');
    this._scrollBottom();
  },

  _renderMsg(m) {
    const isAI = m.role === 'ai';
    const session = this._sessions[this._activeSession];
    const agent = this._agents[session?.agentId] || {};
    const icon = this._getAgentIcon(session?.agentId, agent);
    let attachHtml = '';
    if (m.attachments?.length) {
      attachHtml = m.attachments.map(a => {
        if (a.isImage && a.dataUrl) return `<div class="chat-msg-attachment"><img src="${a.dataUrl}" alt="${_esc(a.name)}"></div>`;
        return `<div class="chat-msg-attachment">📄 ${_esc(a.name)} (${this._fmtSize(a.size)})</div>`;
      }).join('');
    }
    return `<div class="chat-full-msg ${isAI ? 'ai' : 'user'}">
      <div class="chat-full-avatar">${isAI ? icon : '👤'}</div>
      <div class="chat-full-bubble">${attachHtml}${isAI ? this._renderMarkdown(m.text) : _esc(m.text)}</div>
    </div>`;
  },

  // ══════════════════════════════════════════════════════
  //  SEND MESSAGE (Task-1: file format, Task-2: no history)
  // ══════════════════════════════════════════════════════
  async send() {
    if (this._sending) return;
    const input = document.getElementById('chatInput');
    const text = input?.value?.trim();
    if (!text && !this._attachments.length) return;
    if (!this._activeSession || !this._sessions[this._activeSession]) {
      Shell.toast('请先选择一个 Agent 开始对话', 'warning');
      return;
    }

    const session = this._sessions[this._activeSession];
    const attachments = [...this._attachments];
    this._attachments = [];
    this._renderAttachments();
    input.value = '';
    input.style.height = 'auto';
    this._sending = true;
    this._updateSendBtn();

    const userMsg = {
      role: 'user', text: text || '', time: new Date().toISOString(),
      attachments: attachments.length ? attachments.map(a => ({ name: a.name, size: a.size, type: a.type, isImage: a.isImage, dataUrl: a.isImage ? a.dataUrl : null })) : undefined,
    };
    session.messages.push(userMsg);
    this._updateSessionTitle(session, text);

    const msgsEl = document.getElementById('chatMsgs');
    const welcome = msgsEl?.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    msgsEl?.insertAdjacentHTML('beforeend', this._renderMsg(userMsg));

    const agent = this._agents[session.agentId] || {};
    const agentIcon = this._getAgentIcon(session.agentId, agent);
    msgsEl?.insertAdjacentHTML('beforeend', `<div class="chat-full-msg ai" id="chatTyping">
      <div class="chat-full-avatar">${agentIcon}</div>
      <div class="chat-full-bubble typing-cursor" id="chatStreamTarget"></div>
    </div>`);
    this._scrollBottom();

    this._abortCtrl = new AbortController();
    let fullText = '';
    const stepIdx = InteractionLog.addStep({ prompt: text || '[附件]', roleName: session.agentId });

    const onDelta = (delta) => {
      fullText += delta;
      InteractionLog.updateStepStream(stepIdx, delta);
      const target = document.getElementById('chatStreamTarget');
      if (target) { target.innerHTML = this._renderMarkdown(fullText); target.classList.remove('typing-cursor'); }
      this._scrollBottom();
    };
    const onDone = () => {
      document.getElementById('chatTyping')?.removeAttribute('id');
      const target = document.getElementById('chatStreamTarget');
      if (target) { target.removeAttribute('id'); target.classList.remove('typing-cursor'); target.innerHTML = this._renderMarkdown(fullText); }
      session.messages.push({ role: 'ai', text: fullText, time: new Date().toISOString() });
      InteractionLog.completeStep(stepIdx, { response: fullText, status: 'done' });
      this._saveState();
      this._sending = false;
      this._abortCtrl = null;
      this._updateSendBtn();
      this._scrollBottom();
    };
    const onError = (err) => {
      document.getElementById('chatTyping')?.remove();
      if (fullText) {
        msgsEl?.insertAdjacentHTML('beforeend', `<div class="chat-full-msg ai">
          <div class="chat-full-avatar">${agentIcon}</div>
          <div class="chat-full-bubble">${this._renderMarkdown(fullText)}<br><em style="color:var(--warning)">⚠ 回复不完整</em></div>
        </div>`);
        session.messages.push({ role: 'ai', text: fullText + '\n\n⚠ 回复不完整', time: new Date().toISOString() });
        InteractionLog.completeStep(stepIdx, { response: fullText, status: 'error' });
      } else if (err?.name !== 'AbortError') {
        Shell.toast('AI 回复失败: ' + err.message, 'error');
        InteractionLog.completeStep(stepIdx, { status: 'error' });
      } else {
        InteractionLog.completeStep(stepIdx, { response: fullText, status: 'stopped' });
      }
      this._saveState();
      this._sending = false;
      this._abortCtrl = null;
      this._updateSendBtn();
    };

    try {
      if (attachments.length > 0) {
        // ── Task-1: Fixed Responses API file upload format ──
        const inputArr = [];
        if (text) inputArr.push({ type: 'message', role: 'user', content: text });
        for (const att of attachments) {
          if (att.isImage) {
            inputArr.push({
              type: 'input_image',
              source: { type: 'base64', media_type: att.type || 'image/jpeg', data: att.base64 }
            });
          } else {
            inputArr.push({
              type: 'input_file',
              source: { type: 'base64', media_type: att.type || 'application/octet-stream', data: att.base64, filename: att.name }
            });
          }
        }
        // Task-2: Only send current input + user field (server maintains context)
        await API.streamResponses({ model: session.agentId, input: inputArr, user: this._activeSession, signal: this._abortCtrl.signal, onDelta, onDone, onError });
      } else {
        // Task-2: Only send current message + user field (no history)
        await API.streamChat({ model: session.agentId, message: text, user: this._activeSession, signal: this._abortCtrl.signal, onDelta, onDone, onError });
      }
    } catch (e) { onError(e); }
  },

  // Task-2: Keep history builders as fallback (not called by default)
  _buildHistory(session, maxTurns) {
    return session.messages.slice(-(maxTurns * 2)).filter(m => m.text && !m.attachments?.length).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user', content: m.text,
    }));
  },
  _buildHistoryForResponses(session, maxTurns) {
    return session.messages.slice(-(maxTurns * 2), -1).filter(m => m.text && !m.attachments?.length).map(m => ({
      type: 'message', role: m.role === 'ai' ? 'assistant' : 'user', content: m.text,
    }));
  },

  // ══════════════════════════════════════════════════════
  //  SESSION TITLE
  // ══════════════════════════════════════════════════════
  _updateSessionTitle(session, text) {
    if (session.titleLocked || !text) return;
    const n = text.replace(/[!！?？。，,.\s]/g, '').toLowerCase();
    if (this._greetings.has(n)) return;
    session.title = text.length > 20 ? text.slice(0, 20) + '…' : text;
    session.titleLocked = true;
    this._saveState();
  },

  // ══════════════════════════════════════════════════════
  //  FILE UPLOAD
  // ══════════════════════════════════════════════════════
  handleFiles(fileList) {
    if (!fileList?.length) return;
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','text/markdown','text/html','text/csv','application/json'];
    for (const file of fileList) {
      const isImage = file.type.startsWith('image/');
      const maxSize = isImage ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) { Shell.toast(`文件 "${file.name}" 超过${isImage ? '10' : '5'}MB 限制`, 'error'); continue; }
      if (!allowed.includes(file.type) && !file.name.match(/\.(txt|md|json|csv|html|pdf)$/i)) { Shell.toast(`不支持的类型: ${file.type || file.name}`, 'error'); continue; }
      this._readFile(file, isImage);
    }
    document.getElementById('chatFileInput') && (document.getElementById('chatFileInput').value = '');
  },
  _readFile(file, isImage) {
    const reader = new FileReader();
    reader.onload = () => {
      this._attachments.push({ file, name: file.name, size: file.size, type: file.type, dataUrl: reader.result, base64: reader.result.split(',')[1], isImage });
      this._renderAttachments();
    };
    reader.readAsDataURL(file);
  },
  _renderAttachments() {
    const el = document.getElementById('chatAttachments');
    if (!el) return;
    el.innerHTML = this._attachments.map((a, i) => `
      <div class="chat-attach-item">
        ${a.isImage ? `<img class="chat-attach-thumb" src="${a.dataUrl}" alt="">` : '<span>📄</span>'}
        <span class="chat-attach-name">${_esc(a.name)}</span>
        <span class="chat-attach-size">${this._fmtSize(a.size)}</span>
        <span class="chat-attach-remove" onclick="ChatPage.removeAttach(${i})">✕</span>
      </div>`).join('');
  },
  removeAttach(i) { this._attachments.splice(i, 1); this._renderAttachments(); },

  _bindDragDrop() {
    const main = document.getElementById('chatMain');
    if (!main) return;
    let dc = 0;
    main.addEventListener('dragenter', e => { e.preventDefault(); dc++; main.classList.add('dragging'); });
    main.addEventListener('dragleave', e => { e.preventDefault(); dc--; if (dc <= 0) { main.classList.remove('dragging'); dc = 0; } });
    main.addEventListener('dragover', e => e.preventDefault());
    main.addEventListener('drop', e => { e.preventDefault(); dc = 0; main.classList.remove('dragging'); if (e.dataTransfer?.files?.length) this.handleFiles(e.dataTransfer.files); });
  },

  // ══════════════════════════════════════════════════════
  //  MARKDOWN
  // ══════════════════════════════════════════════════════
  _renderMarkdown(text) {
    if (!text) return '';
    let h = _esc(text);
    h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="lang-${lang || 'text'}">${code}</code></pre>`);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/\n/g, '<br>');
    return h;
  },

  // ══════════════════════════════════════════════════════
  //  PERSISTENCE
  // ══════════════════════════════════════════════════════
  _saveState() {
    const cleaned = {};
    for (const [sid, s] of Object.entries(this._sessions)) {
      cleaned[sid] = { ...s, messages: s.messages.map(m => ({ ...m, attachments: m.attachments?.map(a => ({ name: a.name, size: a.size, type: a.type, isImage: a.isImage })) || undefined })) };
    }
    AppState.set('chat_sessions', cleaned);
    AppState.set('chat_active', this._activeSession);
    AppState.set('chat_expanded', this._expandedAgents);
  },
  _loadState() {
    this._sessions = AppState.get('chat_sessions', {});
    this._activeSession = AppState.get('chat_active', null);
    this._expandedAgents = AppState.get('chat_expanded', {});
    this._attachments = [];
  },

  // ══════════════════════════════════════════════════════
  //  HELPERS (Task-4: stop button)
  // ══════════════════════════════════════════════════════
  _updateSendBtn() {
    const b = document.getElementById('chatSendBtn');
    if (!b) return;
    if (this._sending) {
      b.classList.add('stop-mode');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      b.onclick = () => this.stopGeneration();
      b.disabled = false;
      b.title = '停止生成';
    } else {
      b.classList.remove('stop-mode');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
      b.onclick = () => this.send();
      b.disabled = false;
      b.title = '发送';
    }
  },

  /** Task-4: Stop generation */
  stopGeneration() {
    if (this._abortCtrl) {
      this._abortCtrl.abort();
      this._abortCtrl = null;
    }
  },

  _scrollBottom() { const el = document.getElementById('chatMsgs'); if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); },
  _uuid() { return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)); },
  _fmtTime(iso) { if (!iso) return ''; const d = new Date(iso), n = new Date(); return d.toDateString() === n.toDateString() ? d.toTimeString().slice(0, 5) : (d.getMonth()+1)+'/'+d.getDate(); },
  _fmtSize(bytes) { if (bytes < 1024) return bytes+'B'; if (bytes < 1048576) return (bytes/1024).toFixed(1)+'KB'; return (bytes/1048576).toFixed(1)+'MB'; },
};

window.ChatPage = ChatPage;
