/* ═══ Chat Page — Free AI Conversation ═══ */
const ChatPage = {
  _messages: [],
  _sending: false,

  render() {
    Shell.setBreadcrumb([{ label: '💬 AI 对话', path: '/chat' }]);
    this._messages = AppState.get('free_chat', []);
    // Ensure chronological order on load
    this._messages.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    this._renderFull();
  },

  _renderFull() {
    const hasMessages = this._messages.length > 0;
    Shell.setContent(`
      <div class="chat-page">
        <div class="chat-messages" id="chatPageMsgs">
          ${!hasMessages ? `
            <div class="chat-welcome">
              <div class="chat-welcome-icon">🤖</div>
              <h2>DevPilot AI 助手</h2>
              <p>你可以在这里自由对话，讨论项目规划、技术问题或任何想法</p>
            </div>
          ` : this._messages.map(m => this._renderMsg(m)).join('')}
        </div>
        <div class="chat-input-area">
          <div class="chat-input-wrap">
            <textarea id="chatPageInput" placeholder="输入消息..." rows="1"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ChatPage.send()}"
              oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,160)+'px'"></textarea>
            <button class="chat-send-btn" onclick="ChatPage.send()" title="发送">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      </div>
    `);
    this._scrollBottom();
    setTimeout(() => document.getElementById('chatPageInput')?.focus(), 100);
  },

  _renderMsg(m) {
    const isAI = m.role === 'ai';
    return `
      <div class="chat-full-msg ${isAI ? 'ai' : 'user'}">
        <div class="chat-full-avatar">${isAI ? '🤖' : '👤'}</div>
        <div class="chat-full-bubble">${_esc(m.text)}</div>
      </div>
    `;
  },

  async send() {
    if (this._sending) return;
    const input = document.getElementById('chatPageInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    input.style.height = 'auto';

    this._messages.push({ role: 'user', text: msg, time: new Date().toISOString() });
    this._sending = true;

    const msgsEl = document.getElementById('chatPageMsgs');
    // Remove welcome if present
    const welcome = msgsEl.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Add user msg — use insertAdjacentHTML to avoid destroying existing DOM nodes
    msgsEl.insertAdjacentHTML('beforeend', this._renderMsg({ role: 'user', text: msg }));

    // Add typing indicator
    msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-full-msg ai" id="chatPageTyping">
      <div class="chat-full-avatar">🤖</div>
      <div class="chat-full-bubble typing-cursor">思考中</div>
    </div>`);
    this._scrollBottom();

    try {
      const resp = await API.sendFreeChat(msg);
      document.getElementById('chatPageTyping')?.remove();

      // Type out response
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-full-msg ai';
      wrapper.innerHTML = `<div class="chat-full-avatar">🤖</div><div class="chat-full-bubble" id="chatPageTypeTarget"></div>`;
      msgsEl.appendChild(wrapper);

      await this._typeText('chatPageTypeTarget', resp.text);

      this._messages.push({ role: 'ai', text: resp.text, time: new Date().toISOString() });
      AppState.set('free_chat', this._messages);
    } catch(e) {
      document.getElementById('chatPageTyping')?.remove();
      Shell.toast(e.message, 'error');
    } finally {
      this._sending = false;
    }
    this._scrollBottom();
  },

  async _typeText(elId, text) {
    const el = document.getElementById(elId);
    if (!el) return;
    for (let i = 0; i < text.length; i++) {
      el.textContent = text.slice(0, i + 1);
      if (i < text.length - 1) await new Promise(r => setTimeout(r, 12 + Math.random() * 20));
      if (i % 20 === 0) this._scrollBottom();
    }
  },

  _scrollBottom() {
    const el = document.getElementById('chatPageMsgs');
    if (el) el.scrollTop = el.scrollHeight;
  }
};
window.ChatPage = ChatPage;
