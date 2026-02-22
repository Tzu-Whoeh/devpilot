/* ═══ Project Workspace v4.0 — Vertical Phase Nav + SSE Chat (D5/D8) ═══
 *
 * Layout: [Left: Phase Nav] [Right: Detail Panel]
 * Chat: SSE streaming via API.streamChat (replaces _typeText simulation)
 * Phase status: 5-state machine (pending/ai_working/awaiting_approval/approved/rejected)
 */
const WorkspacePage = {
  _project: null,
  _selectedPhaseId: null,
  _chatSending: false,
  _abortCtrl: null,

  async render(params) {
    try { this._project = await API.getProject(params.id); }
    catch(e) {
      Shell.setContent('<div class="page-container"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">项目不存在</div></div></div>');
      return;
    }
    Shell.setBreadcrumb([
      { label: '📊 项目总览', path: '/' },
      { label: this._project.type_icon + ' ' + this._project.name, path: '/projects/' + this._project.id }
    ]);
    const curIdx = this._project.current_phase_index;
    this._selectedPhaseId = this._project.phases[curIdx]?.id;
    this._renderFull();
    this._unsub = EventBus.on('phase:updated', (data) => {
      if (data.projectId === this._project?.id) {
        API.getProject(this._project.id).then(p => { this._project = p; this._renderFull(); });
      }
    });
  },

  _renderFull() {
    const p = this._project;
    const sel = p.phases.find(ph => ph.id === this._selectedPhaseId) || p.phases[p.current_phase_index];
    Shell.setContent(`
      <div class="ws-layout">
        <aside class="ws-phase-nav">
          <div class="ws-nav-header">
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/')">← 返回</button>
            <h2>${p.type_icon} ${_esc(p.name)}</h2>
            <span class="ws-nav-type">${p.type_name}</span>
          </div>
          <div class="ws-nav-list">${p.phases.map((ph, i) => this._renderPhaseNav(ph, i, p)).join('')}</div>
        </aside>
        <main class="ws-detail">${this._renderDetail(sel, p)}</main>
      </div>
    `);
  },

  /** Vertical phase navigation item */
  _renderPhaseNav(ph, i, p) {
    const isCurrent = i === p.current_phase_index;
    const isSelected = ph.id === this._selectedPhaseId;
    const statusIcon = { pending:'⬜', ai_working:'🤖', awaiting_approval:'⏳', approved:'✅', rejected:'↩️' }[ph.status] || '⬜';
    let cls = 'ws-nav-item';
    if (isSelected) cls += ' selected';
    if (ph.status === 'approved') cls += ' done';
    else if (ph.status === 'ai_working') cls += ' working';
    else if (ph.status === 'awaiting_approval') cls += ' awaiting';
    else if (ph.status === 'rejected') cls += ' rejected';
    else if (isCurrent && ph.status === 'pending') cls += ' current';

    return `
      <div class="${cls}" onclick="WorkspacePage.selectPhase('${ph.id}')">
        <span class="ws-nav-num">${i + 1}</span>
        <span class="ws-nav-icon">${ph.icon}</span>
        <div class="ws-nav-info">
          <div class="ws-nav-name">${ph.name}</div>
          <div class="ws-nav-status">${statusIcon} ${this._statusText(ph.status, isCurrent)}</div>
        </div>
      </div>
    `;
  },

  _statusText(status, isCurrent) {
    const map = { pending: isCurrent ? '待开始' : '待前序完成', ai_working:'AI 工作中', awaiting_approval:'待审批', approved:'已完成', rejected:'已驳回' };
    return map[status] || status;
  },

  _renderDetail(phase, p) {
    if (!phase) return '';
    const isCurrent = p.phases.indexOf(phase) === p.current_phase_index;

    let html = `<div class="ws-detail-header">
      <div class="ws-detail-title">${phase.icon} ${phase.name}</div>
      <div class="ws-detail-meta">AI 角色: @${phase.role}</div>
    </div>`;

    // AI Working
    if (phase.status === 'ai_working') {
      html += `<div class="ws-working">
        <div class="ws-working-anim"></div>
        <p>🤖 @${phase.role} 正在执行「${phase.ai_action}」...</p>
        <div class="ws-working-preview typing-cursor">正在分析需求并生成文档</div>
      </div>`;
      return html;
    }

    // Pending
    if (phase.status === 'pending') {
      if (isCurrent) {
        html += `<div style="padding:var(--space-2xl);text-align:center">
          <div style="font-size:48px;margin-bottom:var(--space-md);opacity:0.5">⬜</div>
          <p style="color:var(--text-secondary);margin-bottom:var(--space-lg)">点击「▶ 开始」触发 @${phase.role} 执行「${phase.ai_action}」</p>
          <button class="btn btn-primary btn-lg" onclick="WorkspacePage.triggerPhase('${phase.id}')">▶ 开始此阶段</button>
        </div>`;
      } else {
        html += `<div style="padding:var(--space-2xl);text-align:center">
          <div style="font-size:48px;margin-bottom:var(--space-md);opacity:0.3">🔒</div>
          <p style="color:var(--text-muted)">需要完成前序阶段后才能开始</p>
        </div>`;
      }
      return html;
    }

    // Rejected
    if (phase.status === 'rejected') {
      html += `<div style="padding:var(--space-2xl);text-align:center">
        <div style="font-size:48px;margin-bottom:var(--space-md)">↩️</div>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-lg)">此阶段已被驳回，可以重新开始</p>
        <button class="btn btn-primary btn-lg" onclick="WorkspacePage.triggerPhase('${phase.id}')">▶ 重新开始</button>
      </div>`;
      return html;
    }

    // AI Output
    if (phase.ai_output) {
      html += `<div class="ws-output">
        <div class="ws-output-card">
          <div class="ws-output-label">📄 AI 产出物</div>
          <div class="ws-output-title">${_esc(phase.ai_output.title)}</div>
          <div class="ws-output-time">@${phase.role} 生成于 ${this._timeAgo(phase.ai_output.generated_at)}</div>
          <div class="ws-output-summary">${_esc(phase.ai_output.summary)}</div>
          <a class="ws-output-link" href="#" onclick="event.preventDefault();Shell.toast('Mock 模式下无实际 Notion 链接','info')">📄 在 Notion 中查看完整文档 →</a>
        </div>
      </div>`;
    }

    // Action bar
    if (phase.status === 'awaiting_approval') {
      html += `<div class="ws-actions">
        <button class="btn btn-success" onclick="WorkspacePage.approve('${phase.id}')">✅ 审批通过</button>
        <button class="btn btn-danger" onclick="WorkspacePage.reject('${phase.id}')">↩️ 驳回重做</button>
        <button class="btn btn-secondary" onclick="WorkspacePage.showRegen('${phase.id}')">🔄 补充要求后重新生成</button>
      </div>`;
    }

    if (phase.status === 'approved') {
      html += `<div style="padding:var(--space-sm) var(--space-lg)">
        <div class="ws-completed-badge">✅ 此阶段已审批通过</div>
        <div class="ws-readonly-notice">以下对话记录为只读</div>
      </div>`;
    }

    html += this._renderChat(phase);
    return html;
  },

  _renderChat(phase) {
    const isReadonly = phase.status === 'approved';
    const msgs = phase.chat_history || [];

    let html = `<div class="ws-chat">
      <div class="ws-chat-label">💬 与 @${phase.role} 对话${isReadonly ? '（历史记录）' : ''}</div>
      <div class="ws-chat-messages" id="wsChatMsgs">`;

    if (msgs.length === 0) {
      html += `<div style="text-align:center;padding:var(--space-lg);color:var(--text-muted);font-size:13px">
        ${isReadonly ? '此阶段无对话记录' : '触发 AI 后可在此与 AI 讨论'}
      </div>`;
    } else {
      msgs.forEach(m => {
        const isAI = m.role === 'ai';
        html += `<div class="chat-msg ${isAI ? 'chat-msg-ai' : 'chat-msg-user'}">
          <div class="chat-msg-avatar">${isAI ? '🤖' : '👤'}</div>
          <div class="chat-msg-bubble">${_esc(m.text)}</div>
        </div>`;
      });
    }
    html += '</div>';

    if (!isReadonly && (phase.status === 'awaiting_approval' || phase.status === 'ai_working')) {
      html += `<div class="ws-chat-input">
        <textarea id="wsChatInput" placeholder="输入消息与 @${phase.role} 讨论..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();WorkspacePage.sendChat('${phase.id}')}"></textarea>
        <button class="ws-chat-send" id="wsSendBtn" onclick="WorkspacePage.sendChat('${phase.id}')">发送</button>
      </div>`;
    }

    html += '</div>';
    return html;
  },

  // ── Actions ──
  selectPhase(phaseId) {
    this._selectedPhaseId = phaseId;
    this._renderFull();
  },

  async triggerPhase(phaseId) {
    try {
      await API.triggerPhase(this._project.id, phaseId);
      this._project = await API.getProject(this._project.id);
      this._renderFull();
      Shell.toast('AI 已开始工作', 'info');
    } catch(e) { Shell.toast(e.message, 'error'); }
  },

  async approve(phaseId) {
    try {
      await API.approvePhase(this._project.id, phaseId);
      this._project = await API.getProject(this._project.id);
      const idx = this._project.phases.findIndex(p => p.id === phaseId);
      if (idx < this._project.phases.length - 1) {
        this._selectedPhaseId = this._project.phases[idx + 1].id;
      }
      this._renderFull();
      Shell.toast('阶段审批通过！', 'success');
    } catch(e) { Shell.toast(e.message, 'error'); }
  },

  async reject(phaseId) {
    if (!confirm('确定要驳回吗？这将清空产出物和对话历史。')) return;
    try {
      await API.rejectPhase(this._project.id, phaseId);
      this._project = await API.getProject(this._project.id);
      this._renderFull();
      Shell.toast('已驳回，可重新开始', 'info');
    } catch(e) { Shell.toast(e.message, 'error'); }
  },

  showRegen(phaseId) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:var(--bg-overlay);z-index:500;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:var(--space-xl);width:480px;max-width:90vw">
        <h3 style="margin-bottom:var(--space-md)">🔄 补充要求后重新生成</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-md)">请输入补充要求，AI 将基于已有上下文和新要求重新生成产出物。对话历史将保留。</p>
        <textarea class="input textarea" id="regenInput" placeholder="请描述需要调整的内容..." autofocus></textarea>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button class="btn btn-secondary" onclick="this.closest('div[style]').remove()">取消</button>
          <button class="btn btn-primary" id="regenBtn" onclick="WorkspacePage._doRegen('${phaseId}')">🔄 重新生成</button>
        </div>
      </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('regenInput')?.focus(), 100);
  },

  async _doRegen(phaseId) {
    const input = document.getElementById('regenInput');
    const text = input?.value?.trim();
    if (!text) { Shell.toast('请输入补充要求', 'error'); return; }
    const btn = document.getElementById('regenBtn');
    btn.disabled = true; btn.textContent = '处理中...';
    try {
      await API.regeneratePhase(this._project.id, phaseId, text);
      document.querySelector('div[style*="position:fixed"]')?.remove();
      this._project = await API.getProject(this._project.id);
      this._renderFull();
      Shell.toast('AI 正在重新生成', 'info');
    } catch(e) { Shell.toast(e.message, 'error'); btn.disabled = false; btn.textContent = '🔄 重新生成'; }
  },

  /** D8: SSE streaming chat (replaces _typeText simulation) */
  async sendChat(phaseId) {
    if (this._chatSending) return;
    const input = document.getElementById('wsChatInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    this._chatSending = true;
    const sendBtn = document.getElementById('wsSendBtn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

    const msgsEl = document.getElementById('wsChatMsgs');
    msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-user"><div class="chat-msg-avatar">👤</div><div class="chat-msg-bubble">${_esc(msg)}</div></div>`);
    msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-ai" id="wsTyping"><div class="chat-msg-avatar">🤖</div><div class="chat-msg-bubble typing-cursor" id="wsStreamTarget"></div></div>`);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    this._abortCtrl = new AbortController();
    let fullText = '';

    try {
      // Try SSE streaming first, fall back to regular API
      if (typeof API.streamChat === 'function') {
        await API.streamChat(
          this._project.id, phaseId, msg,
          (delta) => {
            fullText += delta;
            const target = document.getElementById('wsStreamTarget');
            if (target) { target.textContent = fullText; target.classList.remove('typing-cursor'); }
            msgsEl.scrollTop = msgsEl.scrollHeight;
          },
          () => { this._finishChat(fullText, msgsEl); },
          (err) => { this._errorChat(err, fullText, msgsEl); },
          this._abortCtrl.signal
        );
      } else {
        // Fallback: non-streaming
        const resp = await API.sendChat(this._project.id, phaseId, msg);
        fullText = resp.text || '';
        this._finishChat(fullText, msgsEl);
      }
    } catch(e) {
      this._errorChat(e, fullText, msgsEl);
    }
  },

  _finishChat(fullText, msgsEl) {
    const typing = document.getElementById('wsTyping');
    if (typing) {
      typing.removeAttribute('id');
      const target = typing.querySelector('.chat-msg-bubble');
      if (target) { target.textContent = fullText; target.classList.remove('typing-cursor'); target.removeAttribute('id'); }
    }
    this._chatSending = false;
    this._abortCtrl = null;
    const sendBtn = document.getElementById('wsSendBtn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
    msgsEl.scrollTop = msgsEl.scrollHeight;
  },

  _errorChat(err, fullText, msgsEl) {
    document.getElementById('wsTyping')?.remove();
    if (fullText) {
      msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-ai"><div class="chat-msg-avatar">🤖</div><div class="chat-msg-bubble">${_esc(fullText)}<br><em style="color:var(--warning)">⚠ 回复不完整</em></div></div>`);
    } else if (err?.name !== 'AbortError') {
      Shell.toast('对话失败: ' + err.message, 'error');
    }
    this._chatSending = false;
    this._abortCtrl = null;
    const sendBtn = document.getElementById('wsSendBtn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
  },

  _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + ' 分钟前';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' 小时前';
    return Math.floor(hrs / 24) + ' 天前';
  }
};
window.WorkspacePage = WorkspacePage;
