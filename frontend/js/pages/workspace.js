/* ═══ Project Workspace — Phase Strip + Detail Panel ═══ */
const WorkspacePage = {
  _project: null,
  _selectedPhaseId: null,
  _chatSending: false,

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
      <div class="page-container">
        <div class="ws-header">
          <h1>${p.type_icon} ${_esc(p.name)} <span class="ws-header-type">${p.type_name}</span></h1>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/')">← 返回总览</button>
        </div>
        <div class="phase-strip">${p.phases.map((ph, i) => this._renderPhaseCard(ph, i, p)).join('')}</div>
        <div class="ws-detail">${this._renderDetail(sel, p)}</div>
      </div>
    `);
  },

  _renderPhaseCard(ph, i, p) {
    const isCurrent = i === p.current_phase_index;
    const isSelected = ph.id === this._selectedPhaseId;
    let cls = 'phase-card';
    if (ph.status === 'approved') cls += ' approved';
    else if (ph.status === 'ai_working') cls += ' ai-working';
    else if (ph.status === 'awaiting_approval') cls += ' awaiting-approval';
    else if (ph.status === 'rejected') cls += ' rejected';
    else if (isCurrent && ph.status === 'pending') cls += ' current-pending';
    else cls += ' pending';
    if (isSelected) cls += ' selected';

    const statusMap = {
      pending: isCurrent ? '⬜ 待开始' : '待前序完成',
      ai_working: '🤖 生成中...',
      awaiting_approval: '⏳ 待审批',
      approved: '✅ ' + (ph.completed_at ? new Date(ph.completed_at).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}) + '完成' : '已完成'),
      rejected: '↩️ 已驳回'
    };

    let action = '';
    if (isCurrent && ph.status === 'pending') action = '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();WorkspacePage.triggerPhase(\''+ph.id+'\')">▶ 开始</button>';
    else if (isCurrent && ph.status === 'rejected') action = '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();WorkspacePage.triggerPhase(\''+ph.id+'\')">▶ 重新开始</button>';
    else if (ph.status === 'approved') action = '<span style="font-size:11px;color:var(--text-muted)">查看</span>';

    return `
      <div class="${cls}" onclick="WorkspacePage.selectPhase('${ph.id}')">
        <div class="ph-icon">${ph.icon}</div>
        <div class="ph-name">${ph.name}</div>
        <div class="ph-role">${ph.role}</div>
        <div class="ph-status">${statusMap[ph.status] || ph.status}</div>
        <div class="ph-action">${action}</div>
      </div>
      ${i < p.phases.length - 1 ? '<div class="phase-connector">→</div>' : ''}
    `;
  },

  _renderDetail(phase, p) {
    if (!phase) return '';
    const isCurrent = p.phases.indexOf(phase) === p.current_phase_index;

    // Header
    let html = `<div class="ws-detail-header">
      <div class="ws-detail-title">${phase.icon} ${phase.name}</div>
      <div class="ws-detail-meta">AI 角色: @${phase.role}</div>
    </div>`;

    // AI Working state
    if (phase.status === 'ai_working') {
      html += `<div class="ws-working">
        <div class="ws-working-anim"></div>
        <p>🤖 @${phase.role} 正在执行「${phase.ai_action}」...</p>
        <div class="ws-working-preview typing-cursor">正在分析需求并生成文档</div>
      </div>`;
      return html;
    }

    // Pending state
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

    // Rejected state
    if (phase.status === 'rejected') {
      html += `<div style="padding:var(--space-2xl);text-align:center">
        <div style="font-size:48px;margin-bottom:var(--space-md)">↩️</div>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-lg)">此阶段已被驳回，可以重新开始</p>
        <button class="btn btn-primary btn-lg" onclick="WorkspacePage.triggerPhase('${phase.id}')">▶ 重新开始</button>
      </div>`;
      return html;
    }

    // AI Output (for awaiting_approval and approved)
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

    // Action bar (awaiting_approval only)
    if (phase.status === 'awaiting_approval') {
      html += `<div class="ws-actions">
        <button class="btn btn-success" onclick="WorkspacePage.approve('${phase.id}')">✅ 审批通过</button>
        <button class="btn btn-danger" onclick="WorkspacePage.reject('${phase.id}')">↩️ 驳回重做</button>
        <button class="btn btn-secondary" onclick="WorkspacePage.showRegen('${phase.id}')">🔄 补充要求后重新生成</button>
      </div>`;
    }

    // Completed badge
    if (phase.status === 'approved') {
      html += `<div style="padding:var(--space-sm) var(--space-lg)">
        <div class="ws-completed-badge">✅ 此阶段已审批通过</div>
        <div class="ws-readonly-notice">以下对话记录为只读</div>
      </div>`;
    }

    // Chat section
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

    // Input (only for active phases)
    if (!isReadonly && (phase.status === 'awaiting_approval' || phase.status === 'ai_working')) {
      html += `<div class="ws-chat-input">
        <textarea id="wsChatInput" placeholder="输入消息与 @${phase.role} 讨论..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();WorkspacePage.sendChat('${phase.id}')}"></textarea>
        <button class="ws-chat-send" onclick="WorkspacePage.sendChat('${phase.id}')">发送</button>
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
      // Move selection to next phase
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
    const content = document.getElementById('shellContent');
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

  async sendChat(phaseId) {
    if (this._chatSending) return;
    const input = document.getElementById('wsChatInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    this._chatSending = true;

    // Add user message immediately — use insertAdjacentHTML to preserve existing DOM
    const msgsEl = document.getElementById('wsChatMsgs');
    msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-user"><div class="chat-msg-avatar">👤</div><div class="chat-msg-bubble">${_esc(msg)}</div></div>`);
    msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-ai" id="chatTyping"><div class="chat-msg-avatar">🤖</div><div class="chat-msg-bubble typing-cursor">思考中</div></div>`);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const resp = await API.sendChat(this._project.id, phaseId, msg);
      document.getElementById('chatTyping')?.remove();
      // Typing effect
      const bubble = document.createElement('div');
      bubble.className = 'chat-msg chat-msg-ai';
      bubble.innerHTML = `<div class="chat-msg-avatar">🤖</div><div class="chat-msg-bubble" id="typeTarget"></div>`;
      msgsEl.appendChild(bubble);
      await this._typeText('typeTarget', resp.text);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    } catch(e) {
      document.getElementById('chatTyping')?.remove();
      Shell.toast(e.message, 'error');
    } finally {
      this._chatSending = false;
    }
  },

  async _typeText(elId, text) {
    const el = document.getElementById(elId);
    if (!el) return;
    for (let i = 0; i < text.length; i++) {
      el.textContent = text.slice(0, i + 1);
      if (i < text.length - 1) await new Promise(r => setTimeout(r, 15 + Math.random() * 25));
    }
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
