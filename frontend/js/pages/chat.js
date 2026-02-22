/* ═══ Chat Page v2.0 — Agent Tree + SSE + File Upload ═══ */
const ChatPage = {
  // ── State ──
  _agents: {},           // { id: {name, description} }
  _agentIcons: { main:'📎', coder:'💻', pm:'📋', ba:'📊', architect:'🏗️', 'investment-assistant':'💰' },
  _sessions: {},         // { sessionId: { agentId, title, titleLocked, messages:[], created } }
  _activeSession: null,  // current sessionId
  _expandedAgents: {},   // { agentId: true/false }
  _sending: false,
  _abortCtrl: null,
  _attachments: [],      // [{ file, name, size, type, dataUrl, base64, isImage }]

  // Greeting words to detect trivial first message
  _greetings: new Set([
    '你好','hi','hello','hey','嗨','在吗','在不在','在','您好','哈喽',
    'hola','yo','sup','嘿','请问','你好呀','hi there','hello there'
  ]),

  // ══════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════
  async render() {
    Shell.setBreadcrumb([{ label: '💬 AI 对话', path: '/chat' }]);
    this._loadState();
    Shell.setContent(`
      <div class="chat-page">
        <div class="chat-sidebar" id="chatSidebar">
          <div class="chat-sidebar-header">
            <button class="chat-new-btn" onclick="ChatPage.showAgentPicker()">+ 新对话</button>
          </div>
          <div class="chat-tree" id="chatTree"></div>
        </div>
        <div class="chat-main" id="chatMain">
          <div class="chat-drag-overlay" id="chatDragOverlay">📎 拖放文件到此处</div>
          <div class="chat-messages" id="chatMsgs">
            <div class="chat-welcome">
              <div class="chat-welcome-icon">🤖</div>
              <h2>DevPilot AI 助手</h2>
              <p>点击左侧 Agent 或「+ 新对话」开始对话</p>
            </div>
          </div>
          <div class="chat-input-area">
            <div class="chat-input-container">
              <div class="chat-attachments" id="chatAttachments"></div>
              <div class="chat-input-wrap">
                <button class="chat-attach-btn" onclick="document.getElementById('chatFileInput').click()" title="上传文件/图片">📎</button>
                <input type="file" id="chatFileInput" multiple accept="image/*,.pdf,.txt,.md,.json,.csv,.html" style="display:none" onchange="ChatPage.handleFiles(this.files)">
                <textarea id="chatInput" placeholder="输入消息..." rows="1"
                  onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ChatPage.send()}"
                  oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,160)+'px'"></textarea>
                <button class="chat-send-btn" id="chatSendBtn" onclick="ChatPage.send()" title="发送">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
    this._bindDragDrop();
    await this._loadAgents();
    this._renderTree();
    // Restore last active session
    if (this._activeSession && this._sessions[this._activeSession]) {
      this._switchSession(this._activeSession);
    }
  },

  // ══════════════════════════════════════════════════════
  //  AGENTS
  // ══════════════════════════════════════════════════════
  async _loadAgents() {
    try {
      this._agents = await API.getAgents();
    } catch (e) {
      // Fallback static list
      this._agents = {
        main: { name: '主 Agent', description: '通用助手（默认）' },
        coder: { name: '编码助手', description: '阿宇 - 编程专家' },
        pm: { name: '项目管理', description: '安然 - 项目管理' },
        ba: { name: '业务分析', description: '小鹿 - 业务分析' },
        architect: { name: '架构师', description: '老张 - 架构设计' },
      };
      console.warn('Failed to load agents, using fallback:', e.message);
    }
  },

  // ══════════════════════════════════════════════════════
  //  AGENT → SESSION TREE
  // ══════════════════════════════════════════════════════
  _renderTree() {
    const tree = document.getElementById('chatTree');
    if (!tree) return;
    // Group sessions by agentId
    const grouped = {};
    for (const [sid, s] of Object.entries(this._sessions)) {
      if (!grouped[s.agentId]) grouped[s.agentId] = [];
      grouped[s.agentId].push({ ...s, id: sid });
    }
    // Sort sessions by created desc
    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    }

    let html = '';
    for (const [agentId, agent] of Object.entries(this._agents)) {
      const sessions = grouped[agentId] || [];
      const expanded = this._expandedAgents[agentId] || sessions.some(s => s.id === this._activeSession);
      const icon = this._agentIcons[agentId] || '🤖';
      const count = sessions.length;
      html += `
        <div class="chat-agent-node ${expanded ? 'expanded' : ''}" data-agent="${_esc(agentId)}">
          <div class="chat-agent-header" onclick="ChatPage.toggleAgent('${_esc(agentId)}')">
            <span class="chat-agent-arrow">▶</span>
            <span class="chat-agent-icon">${icon}</span>
            <span class="chat-agent-name">${_esc(agent.name)}</span>
            ${count ? `<span class="chat-agent-badge">${count}</span>` : ''}
          </div>
          <div class="chat-session-list">
            ${sessions.map(s => `
              <div class="chat-session-item ${s.id === this._activeSession ? 'active' : ''}"
                   onclick="ChatPage.switchSession('${s.id}')" data-sid="${s.id}">
                <span class="chat-session-title">${_esc(s.title || '新对话')}</span>
                <span class="chat-session-time">${this._fmtTime(s.created)}</span>
                <span class="chat-session-del" onclick="event.stopPropagation();ChatPage.deleteSession('${s.id}')" title="删除">✕</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    tree.innerHTML = html;
  },

  toggleAgent(agentId) {
    const sessions = Object.values(this._sessions).filter(s => s.agentId === agentId);
    if (sessions.length === 0) {
      // No sessions — create one directly
      this._createSession(agentId);
      return;
    }
    this._expandedAgents[agentId] = !this._expandedAgents[agentId];
    this._renderTree();
  },

  // ══════════════════════════════════════════════════════
  //  AGENT PICKER MODAL
  // ══════════════════════════════════════════════════════
  showAgentPicker() {
    const existing = document.getElementById('chatAgentPicker');
    if (existing) existing.remove();
    let html = `<div class="chat-agent-picker" id="chatAgentPicker" onclick="if(event.target===this)this.remove()">
      <div class="chat-agent-picker-inner">
        <h3>选择 Agent 开始新对话</h3>
        <div class="chat-agent-picker-list">`;
    for (const [id, a] of Object.entries(this._agents)) {
      const icon = this._agentIcons[id] || '🤖';
      html += `<div class="chat-agent-picker-item" onclick="ChatPage.pickAgent('${_esc(id)}')">
        <span class="ap-icon">${icon}</span>
        <div class="ap-info">
          <div class="ap-name">${_esc(a.name)}</div>
          <div class="ap-desc">${_esc(a.description)}</div>
        </div>
      </div>`;
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
      agentId,
      title: '新对话',
      titleLocked: false,
      messages: [],
      created: new Date().toISOString(),
    };
    this._expandedAgents[agentId] = true;
    this._switchSession(sid);
    this._saveState();
  },

  _switchSession(sid) {
    this._activeSession = sid;
    this._attachments = [];
    this._renderTree();
    this._renderMessages();
    this._saveState();
    setTimeout(() => document.getElementById('chatInput')?.focus(), 50);
  },

  switchSession(sid) {
    if (sid === this._activeSession) return;
    this._switchSession(sid);
  },

  deleteSession(sid) {
    delete this._sessions[sid];
    if (this._activeSession === sid) {
      this._activeSession = null;
      this._renderMessages();
    }
    this._renderTree();
    this._saveState();
  },

  // ══════════════════════════════════════════════════════
  //  MESSAGE RENDERING
  // ══════════════════════════════════════════════════════
  _renderMessages() {
    const el = document.getElementById('chatMsgs');
    if (!el) return;
    const session = this._sessions[this._activeSession];
    if (!session || session.messages.length === 0) {
      const agent = this._agents[session?.agentId] || {};
      const icon = this._agentIcons[session?.agentId] || '🤖';
      el.innerHTML = `<div class="chat-welcome">
        <div class="chat-welcome-icon">${session ? icon : '🤖'}</div>
        <h2>${session ? _esc(agent.name || 'AI 助手') : 'DevPilot AI 助手'}</h2>
        <p>${session ? _esc(agent.description || '开始对话吧') : '点击左侧 Agent 或「+ 新对话」开始对话'}</p>
      </div>`;
      return;
    }
    el.innerHTML = session.messages.map(m => this._renderMsg(m)).join('');
    this._scrollBottom();
  },

  _renderMsg(m) {
    const isAI = m.role === 'ai';
    const session = this._sessions[this._activeSession];
    const icon = this._agentIcons[session?.agentId] || '🤖';
    let attachHtml = '';
    if (m.attachments?.length) {
      attachHtml = m.attachments.map(a => {
        if (a.isImage && a.dataUrl) {
          return `<div class="chat-msg-attachment"><img src="${a.dataUrl}" alt="${_esc(a.name)}"></div>`;
        }
        return `<div class="chat-msg-attachment">📄 ${_esc(a.name)} (${this._fmtSize(a.size)})</div>`;
      }).join('');
    }
    return `
      <div class="chat-full-msg ${isAI ? 'ai' : 'user'}">
        <div class="chat-full-avatar">${isAI ? icon : '👤'}</div>
        <div class="chat-full-bubble">${attachHtml}${isAI ? this._renderMarkdown(m.text) : _esc(m.text)}</div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════
  //  SEND MESSAGE (SSE STREAMING)
  // ══════════════════════════════════════════════════════
  async send() {
    if (this._sending) return;
    const input = document.getElementById('chatInput');
    const text = input?.value?.trim();
    if (!text && !this._attachments.length) return;

    // Ensure we have a session
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

    // Add user message
    const userMsg = { role: 'user', text: text || '', time: new Date().toISOString(), attachments: attachments.length ? attachments.map(a => ({ name: a.name, size: a.size, type: a.type, isImage: a.isImage, dataUrl: a.isImage ? a.dataUrl : null })) : undefined };
    session.messages.push(userMsg);
    this._updateSessionTitle(session, text);

    const msgsEl = document.getElementById('chatMsgs');
    // Remove welcome
    const welcome = msgsEl?.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    // Append user bubble
    msgsEl?.insertAdjacentHTML('beforeend', this._renderMsg(userMsg));

    // Add typing indicator
    msgsEl?.insertAdjacentHTML('beforeend', `<div class="chat-full-msg ai" id="chatTyping">
      <div class="chat-full-avatar">${this._agentIcons[session.agentId] || '🤖'}</div>
      <div class="chat-full-bubble typing-cursor" id="chatStreamTarget"></div>
    </div>`);
    this._scrollBottom();

    // Prepare abort controller
    this._abortCtrl = new AbortController();
    let fullText = '';

    const onDelta = (delta) => {
      fullText += delta;
      const target = document.getElementById('chatStreamTarget');
      if (target) {
        target.innerHTML = this._renderMarkdown(fullText);
        target.classList.remove('typing-cursor');
      }
      this._scrollBottom();
    };

    const onDone = () => {
      document.getElementById('chatTyping')?.removeAttribute('id');
      const target = document.getElementById('chatStreamTarget');
      if (target) {
        target.removeAttribute('id');
        target.classList.remove('typing-cursor');
        target.innerHTML = this._renderMarkdown(fullText);
      }
      session.messages.push({ role: 'ai', text: fullText, time: new Date().toISOString() });
      this._saveState();
      this._sending = false;
      this._updateSendBtn();
      this._scrollBottom();
    };

    const onError = (err) => {
      document.getElementById('chatTyping')?.remove();
      if (fullText) {
        // Show partial response
        msgsEl?.insertAdjacentHTML('beforeend', `<div class="chat-full-msg ai">
          <div class="chat-full-avatar">${this._agentIcons[session.agentId] || '🤖'}</div>
          <div class="chat-full-bubble">${this._renderMarkdown(fullText)}<br><em style="color:var(--warning)">⚠ 回复不完整（连接中断）</em></div>
        </div>`);
        session.messages.push({ role: 'ai', text: fullText + '\n\n⚠ 回复不完整', time: new Date().toISOString() });
      } else {
        Shell.toast('AI 回复失败: ' + err.message, 'error');
      }
      this._saveState();
      this._sending = false;
      this._updateSendBtn();
    };

    try {
      if (attachments.length > 0) {
        // Use Responses API for file/image
        const inputArr = [];
        // Add text
        if (text) {
          inputArr.push({ type: 'message', role: 'user', content: text });
        }
        // Add files/images
        for (const att of attachments) {
          if (att.isImage) {
            inputArr.push({
              type: 'message', role: 'user',
              content: [{ type: 'input_image', image_url: att.dataUrl }]
            });
          } else {
            inputArr.push({
              type: 'message', role: 'user',
              content: [{ type: 'input_file', filename: att.name, file_data: att.base64 }]
            });
          }
        }
        // Also prepend history (last 10 messages, text only)
        const historyInput = this._buildHistoryForResponses(session, 10);
        await API.streamResponses({
          model: session.agentId,
          input: [...historyInput, ...inputArr],
          user: this._activeSession,
          signal: this._abortCtrl.signal,
          onDelta, onDone, onError,
        });
      } else {
        // Pure text — Chat Completions API
        const messages = this._buildHistory(session, 20);
        messages.push({ role: 'user', content: text });
        await API.streamChat({
          model: session.agentId,
          messages,
          user: this._activeSession,
          signal: this._abortCtrl.signal,
          onDelta, onDone, onError,
        });
      }
    } catch (e) {
      onError(e);
    }
  },

  _buildHistory(session, maxTurns) {
    const msgs = session.messages.slice(-(maxTurns * 2));
    return msgs.filter(m => m.text && !m.attachments?.length).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));
  },

  _buildHistoryForResponses(session, maxTurns) {
    const msgs = session.messages.slice(-(maxTurns * 2), -1); // exclude the message we're about to send
    return msgs.filter(m => m.text && !m.attachments?.length).map(m => ({
      type: 'message',
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));
  },

  // ══════════════════════════════════════════════════════
  //  SESSION TITLE LOGIC
  // ══════════════════════════════════════════════════════
  _updateSessionTitle(session, text) {
    if (session.titleLocked) return;
    if (!text) return;
    const normalized = text.replace(/[!！?？。，,.\s]/g, '').toLowerCase();
    if (this._greetings.has(normalized)) {
      // Still trivial, keep "新对话"
      return;
    }
    // Meaningful message — set title and lock
    session.title = text.length > 20 ? text.slice(0, 20) + '…' : text;
    session.titleLocked = true;
    this._renderTree();
    this._saveState();
  },

  // ══════════════════════════════════════════════════════
  //  FILE UPLOAD
  // ══════════════════════════════════════════════════════
  handleFiles(fileList) {
    if (!fileList?.length) return;
    for (const file of fileList) {
      // Validate size
      const isImage = file.type.startsWith('image/');
      const maxSize = isImage ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        Shell.toast(`文件 "${file.name}" 超过${isImage ? '10' : '5'}MB 限制`, 'error');
        continue;
      }
      // Validate type
      const allowed = ['image/jpeg','image/png','image/gif','image/webp',
        'application/pdf','text/plain','text/markdown','text/html','text/csv',
        'application/json'];
      if (!allowed.includes(file.type) && !file.name.match(/\.(txt|md|json|csv|html|pdf)$/i)) {
        Shell.toast(`不支持的文件类型: ${file.type || file.name}`, 'error');
        continue;
      }
      this._readFile(file, isImage);
    }
    // Reset input
    const fi = document.getElementById('chatFileInput');
    if (fi) fi.value = '';
  },

  _readFile(file, isImage) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      this._attachments.push({
        file, name: file.name, size: file.size, type: file.type,
        dataUrl, base64, isImage,
      });
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
      </div>
    `).join('');
  },

  removeAttach(i) {
    this._attachments.splice(i, 1);
    this._renderAttachments();
  },

  _bindDragDrop() {
    const main = document.getElementById('chatMain');
    if (!main) return;
    let dragCount = 0;
    main.addEventListener('dragenter', (e) => {
      e.preventDefault(); dragCount++;
      main.classList.add('dragging');
    });
    main.addEventListener('dragleave', (e) => {
      e.preventDefault(); dragCount--;
      if (dragCount <= 0) { main.classList.remove('dragging'); dragCount = 0; }
    });
    main.addEventListener('dragover', (e) => e.preventDefault());
    main.addEventListener('drop', (e) => {
      e.preventDefault(); dragCount = 0;
      main.classList.remove('dragging');
      if (e.dataTransfer?.files?.length) this.handleFiles(e.dataTransfer.files);
    });
  },

  // ══════════════════════════════════════════════════════
  //  MARKDOWN RENDERING (lightweight, no deps)
  // ══════════════════════════════════════════════════════
  _renderMarkdown(text) {
    if (!text) return '';
    let html = _esc(text);
    // Code blocks: ```lang\n...\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang || 'text'}">${code}</code></pre>`);
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  },

  // ══════════════════════════════════════════════════════
  //  PERSISTENCE (localStorage via AppState)
  // ══════════════════════════════════════════════════════
  _saveState() {
    // Save sessions without dataUrl blobs (too large)
    const cleaned = {};
    for (const [sid, s] of Object.entries(this._sessions)) {
      cleaned[sid] = {
        ...s,
        messages: s.messages.map(m => ({
          ...m,
          attachments: m.attachments?.map(a => ({ name: a.name, size: a.size, type: a.type, isImage: a.isImage })) || undefined,
        })),
      };
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
  //  HELPERS
  // ══════════════════════════════════════════════════════
  _updateSendBtn() {
    const btn = document.getElementById('chatSendBtn');
    if (btn) btn.disabled = this._sending;
  },

  _scrollBottom() {
    const el = document.getElementById('chatMsgs');
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  },

  _uuid() {
    return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  },

  _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toTimeString().slice(0, 5);
    }
    return (d.getMonth() + 1) + '/' + d.getDate();
  },

  _fmtSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  },
};

window.ChatPage = ChatPage;
