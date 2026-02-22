/* ═══ Chat Page v5.0 — RoleTree Editor + InteractionLog ═══
 *
 * Changelog v5.0:
 *   LAYOUT: 岗位树+提示词编辑器 替代原 AI 对话界面（中间区域）
 *   NEW: 中间区域 = 岗位树浏览 + 系统提示词/Skill模板 可编辑
 *   NEW: PromptStore 持久化（localStorage + JSON 导出/导入）
 *   KEEP: 右侧 InteractionLog 面板不变
 *   REMOVE: 左侧 RolePanel（功能合并到中间区域）
 *   REMOVE: 对话/会话/发送消息等功能（移至 workspace.js）
 *
 * Layout: [RoleTreeEditor flex:1] [InteractionLog 320px]
 */
const ChatPage = {
  // ── State ──
  _selectedRole: null,
  _selectedSkill: null,
  _editMode: false,
  _dirty: false,
  _initialized: false,
  _expandedRoles: {},

  // ══════════════════════════════════════════════════════
  //  INIT & RENDER
  // ══════════════════════════════════════════════════════
  async init() {
    if (this._initialized) return;
    this._initialized = true;
  },

  async render() {
    Shell.setBreadcrumb([{ label: '🤖 AI 岗位管理', path: '/chat' }]);
    await this.init();

    InteractionLog.clear();
    const rightPanel = InteractionLog.renderHTML();

    Shell.setContent(`
      <div class="chat-page chat-two-col">
        <div class="role-editor-main" id="roleEditorMain">
          ${this._renderToolbar()}
          <div class="role-editor-body">
            <div class="role-tree-pane" id="roleTreePane">
              ${this._renderRoleTree()}
            </div>
            <div class="role-detail-pane" id="roleDetailPane">
              ${this._renderDetailWelcome()}
            </div>
          </div>
        </div>
        ${rightPanel}
      </div>
    `);

    if (this._selectedRole) {
      this._onSelectRole(this._selectedRole, false);
    }
  },

  // ══════════════════════════════════════════════════════
  //  TOOLBAR
  // ══════════════════════════════════════════════════════
  _renderToolbar() {
    return `
      <div class="role-editor-toolbar">
        <div class="role-editor-toolbar-left">
          <span class="role-editor-toolbar-title">🤖 AI 岗位提示词管理</span>
          <span class="role-editor-toolbar-sub">管理 9 个 AI 岗位的系统提示词和 Skill 模板</span>
        </div>
        <div class="role-editor-toolbar-right">
          <button class="btn btn-sm btn-ghost" onclick="ChatPage.importPrompts()" title="导入">📥 导入</button>
          <button class="btn btn-sm btn-ghost" onclick="PromptStore.downloadJSON()" title="导出">📤 导出</button>
          <button class="btn btn-sm btn-ghost btn-danger" onclick="ChatPage.resetAllPrompts()" title="重置全部">🔄 重置</button>
          <input type="file" id="promptImportInput" accept=".json" style="display:none" onchange="ChatPage.handleImportFile(this.files)">
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════
  //  ROLE TREE
  // ══════════════════════════════════════════════════════
  _renderRoleTree() {
    const roles = getRoleList();
    let html = '<div class="rt-list">';
    for (const role of roles) {
      const expanded = this._expandedRoles[role.id];
      const selected = this._selectedRole === role.id && !this._selectedSkill;
      const hasCustom = PromptStore.hasCustom(role.id);
      html += `
        <div class="rt-role-node ${expanded ? 'expanded' : ''} ${selected ? 'selected' : ''}" data-role="${_esc(role.id)}">
          <div class="rt-role-header" onclick="ChatPage.selectRole('${_esc(role.id)}')">
            <span class="rt-role-arrow" onclick="event.stopPropagation();ChatPage.toggleRole('${_esc(role.id)}')">▶</span>
            <span class="rt-role-icon">${role.icon}</span>
            <span class="rt-role-name">${_esc(role.name)}</span>
            ${hasCustom ? '<span class="rt-custom-badge" title="已自定义">✏️</span>' : ''}
            <span class="rt-role-badge">${role.skills.length}</span>
          </div>
          <div class="rt-skill-list">
            ${role.skills.map(skill => {
              const skillSelected = this._selectedRole === role.id && this._selectedSkill === skill.id;
              const skillCustom = PromptStore.hasCustom(role.id, skill.id);
              return `
                <div class="rt-skill-item ${skillSelected ? 'selected' : ''}"
                     onclick="ChatPage.selectSkill('${_esc(role.id)}','${_esc(skill.id)}')"
                     title="${_esc(skill.description)}">
                  <span class="rt-skill-name">${_esc(skill.name)}</span>
                  ${skillCustom ? '<span class="rt-custom-dot" title="已自定义">●</span>' : ''}
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }
    html += '</div>';
    return html;
  },

  toggleRole(roleId) {
    this._expandedRoles[roleId] = !this._expandedRoles[roleId];
    const node = document.querySelector(`.rt-role-node[data-role="${roleId}"]`);
    if (node) node.classList.toggle('expanded', this._expandedRoles[roleId]);
  },

  selectRole(roleId) {
    if (!this._expandedRoles[roleId]) this._expandedRoles[roleId] = true;
    this._onSelectRole(roleId, true);
  },

  selectSkill(roleId, skillId) {
    this._selectedRole = roleId;
    this._selectedSkill = skillId;
    this._editMode = false;
    this._dirty = false;
    this._refreshTree();
    this._renderDetail();
  },

  _onSelectRole(roleId, refresh) {
    this._selectedRole = roleId;
    this._selectedSkill = null;
    this._editMode = false;
    this._dirty = false;
    if (refresh) this._refreshTree();
    this._renderDetail();
  },

  _refreshTree() {
    const el = document.getElementById('roleTreePane');
    if (el) el.innerHTML = this._renderRoleTree();
  },

  // ══════════════════════════════════════════════════════
  //  DETAIL PANE
  // ══════════════════════════════════════════════════════
  _renderDetail() {
    const el = document.getElementById('roleDetailPane');
    if (!el) return;
    if (!this._selectedRole) { el.innerHTML = this._renderDetailWelcome(); return; }
    el.innerHTML = this._selectedSkill ? this._renderSkillDetail() : this._renderRoleDetail();
  },

  _renderDetailWelcome() {
    return `
      <div class="rd-welcome">
        <div class="rd-welcome-icon">🤖</div>
        <h3>AI 岗位提示词管理</h3>
        <p>从左侧选择一个岗位查看和编辑系统提示词，<br>或展开岗位选择具体 Skill 编辑模板。</p>
        <div class="rd-welcome-stats">
          <span>📊 共 ${getRoleList().length} 个岗位</span>
          <span>🛠️ 共 ${getRoleList().reduce((n, r) => n + r.skills.length, 0)} 个 Skill</span>
          <span>✏️ ${this._countCustom()} 项自定义</span>
        </div>
      </div>
    `;
  },

  _countCustom() {
    let count = 0;
    try {
      const data = JSON.parse(localStorage.getItem('devpilot_prompts') || '{}');
      for (const rdata of Object.values(data)) {
        if (rdata.systemPrompt !== undefined) count++;
        if (rdata.skills) count += Object.keys(rdata.skills).length;
      }
    } catch {}
    return count;
  },

  // ── Role Detail ──
  _renderRoleDetail() {
    const role = AI_ROLES[this._selectedRole];
    if (!role) return '<div class="rd-empty">岗位未找到</div>';
    const currentPrompt = PromptStore.getSystemPrompt(role.id);
    const hasCustom = PromptStore.hasCustom(role.id);

    return `
      <div class="rd-header">
        <div class="rd-header-info">
          <span class="rd-header-icon">${role.icon}</span>
          <div><h3 class="rd-header-title">${_esc(role.name)}</h3><span class="rd-header-sub">${_esc(role.title)}</span></div>
        </div>
        <div class="rd-header-actions">
          ${hasCustom ? `<button class="btn btn-sm btn-ghost" onclick="ChatPage.resetRolePrompt('${_esc(role.id)}')">🔄 恢复默认</button>` : ''}
          <button class="btn btn-sm ${this._editMode ? 'btn-primary' : 'btn-ghost'}" onclick="ChatPage.toggleEditMode()">
            ${this._editMode ? '👁️ 查看' : '✏️ 编辑'}
          </button>
        </div>
      </div>
      <div class="rd-section">
        <div class="rd-label">📝 描述</div>
        <p class="rd-text">${_esc(role.description)}</p>
      </div>
      <div class="rd-section rd-section-grow">
        <div class="rd-label">🧠 系统提示词 ${hasCustom ? '<span class="rd-custom-tag">已自定义</span>' : '<span class="rd-default-tag">默认</span>'}</div>
        ${this._editMode
          ? `<textarea class="rd-prompt-editor" id="rdPromptEditor" oninput="ChatPage._onPromptEdit()" placeholder="输入系统提示词...">${_esc(currentPrompt)}</textarea>
             <div class="rd-editor-actions">
               <span class="rd-char-count" id="rdCharCount">${currentPrompt.length} 字</span>
               <button class="btn btn-sm btn-ghost" onclick="ChatPage.cancelEdit()">取消</button>
               <button class="btn btn-sm btn-primary" onclick="ChatPage.saveSystemPrompt()" id="rdSaveBtn" ${this._dirty ? '' : 'disabled'}>💾 保存</button>
             </div>`
          : `<pre class="rd-prompt-view">${_esc(currentPrompt)}</pre>`}
      </div>
      <div class="rd-section">
        <div class="rd-label">🛠️ 职责列表 (${role.skills.length})</div>
        <div class="rd-skill-grid">
          ${role.skills.map(s => `
            <div class="rd-skill-card" onclick="ChatPage.selectSkill('${_esc(role.id)}','${_esc(s.id)}')">
              <div class="rd-skill-card-name">${_esc(s.name)} ${PromptStore.hasCustom(role.id, s.id) ? '✏️' : ''}</div>
              <div class="rd-skill-card-trigger">${_esc(s.trigger)}</div>
            </div>`).join('')}
        </div>
      </div>
    `;
  },

  // ── Skill Detail ──
  _renderSkillDetail() {
    const role = AI_ROLES[this._selectedRole];
    const skillDef = role?.skills?.find(s => s.id === this._selectedSkill);
    if (!role || !skillDef) return '<div class="rd-empty">Skill 未找到</div>';
    const currentTemplate = PromptStore.getSkillTemplate(role.id, skillDef.id);
    const hasCustom = PromptStore.hasCustom(role.id, skillDef.id);

    return `
      <div class="rd-header">
        <div class="rd-header-info">
          <span class="rd-header-icon">${role.icon}</span>
          <div><h3 class="rd-header-title">${_esc(skillDef.name)}</h3><span class="rd-header-sub">${_esc(role.name)} · ${_esc(skillDef.trigger)}</span></div>
        </div>
        <div class="rd-header-actions">
          <button class="btn btn-sm btn-ghost" onclick="ChatPage.selectRole('${_esc(role.id)}')">⬅ 返回</button>
          ${hasCustom ? `<button class="btn btn-sm btn-ghost" onclick="ChatPage.resetSkillTemplate('${_esc(role.id)}','${_esc(skillDef.id)}')">🔄 恢复默认</button>` : ''}
          <button class="btn btn-sm ${this._editMode ? 'btn-primary' : 'btn-ghost'}" onclick="ChatPage.toggleEditMode()">
            ${this._editMode ? '👁️ 查看' : '✏️ 编辑'}
          </button>
        </div>
      </div>
      <div class="rd-section">
        <div class="rd-label">📝 描述</div>
        <p class="rd-text">${_esc(skillDef.description)}</p>
      </div>
      <div class="rd-section rd-section-grow">
        <div class="rd-label">📄 Skill 模板 ${hasCustom ? '<span class="rd-custom-tag">已自定义</span>' : '<span class="rd-default-tag">默认</span>'}</div>
        ${this._editMode
          ? `<textarea class="rd-prompt-editor" id="rdPromptEditor" oninput="ChatPage._onPromptEdit()" placeholder="输入 Skill 模板...">${_esc(currentTemplate)}</textarea>
             <div class="rd-editor-actions">
               <span class="rd-char-count" id="rdCharCount">${currentTemplate.length} 字</span>
               <button class="btn btn-sm btn-ghost" onclick="ChatPage.cancelEdit()">取消</button>
               <button class="btn btn-sm btn-primary" onclick="ChatPage.saveSkillTemplate()" id="rdSaveBtn" ${this._dirty ? '' : 'disabled'}>💾 保存</button>
             </div>`
          : `<pre class="rd-prompt-view rd-prompt-template">${_esc(currentTemplate)}</pre>`}
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════
  //  EDIT ACTIONS
  // ══════════════════════════════════════════════════════
  toggleEditMode() {
    this._editMode = !this._editMode;
    this._dirty = false;
    this._renderDetail();
    if (this._editMode) {
      setTimeout(() => { const ed = document.getElementById('rdPromptEditor'); if (ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); } }, 50);
    }
  },

  _onPromptEdit() {
    this._dirty = true;
    const btn = document.getElementById('rdSaveBtn');
    if (btn) btn.disabled = false;
    const ed = document.getElementById('rdPromptEditor');
    const cc = document.getElementById('rdCharCount');
    if (ed && cc) cc.textContent = ed.value.length + ' 字';
  },

  cancelEdit() { this._editMode = false; this._dirty = false; this._renderDetail(); },

  saveSystemPrompt() {
    const ed = document.getElementById('rdPromptEditor');
    if (!ed || !this._selectedRole) return;
    PromptStore.setSystemPrompt(this._selectedRole, ed.value);
    this._editMode = false; this._dirty = false;
    Shell.toast('系统提示词已保存', 'success');
    this._refreshTree(); this._renderDetail();
  },

  saveSkillTemplate() {
    const ed = document.getElementById('rdPromptEditor');
    if (!ed || !this._selectedRole || !this._selectedSkill) return;
    PromptStore.setSkillTemplate(this._selectedRole, this._selectedSkill, ed.value);
    this._editMode = false; this._dirty = false;
    Shell.toast('Skill 模板已保存', 'success');
    this._refreshTree(); this._renderDetail();
  },

  resetRolePrompt(roleId) {
    if (!confirm(`确定恢复 ${AI_ROLES[roleId]?.name || roleId} 的所有自定义为默认值？`)) return;
    PromptStore.resetRole(roleId);
    Shell.toast('已恢复默认', 'success');
    this._refreshTree(); this._renderDetail();
  },

  resetSkillTemplate(roleId, skillId) {
    if (!confirm('确定恢复此 Skill 模板为默认值？')) return;
    const data = JSON.parse(localStorage.getItem('devpilot_prompts') || '{}');
    if (data[roleId]?.skills) {
      delete data[roleId].skills[skillId];
      if (Object.keys(data[roleId].skills).length === 0) delete data[roleId].skills;
      if (!data[roleId].systemPrompt && !data[roleId].skills) delete data[roleId];
      localStorage.setItem('devpilot_prompts', JSON.stringify(data));
    }
    Shell.toast('已恢复默认', 'success');
    this._refreshTree(); this._renderDetail();
  },

  resetAllPrompts() {
    if (!confirm('确定重置所有自定义提示词为默认值？此操作不可撤销。')) return;
    PromptStore.resetAll();
    Shell.toast('所有自定义已重置', 'success');
    this._refreshTree(); this._renderDetail();
  },

  // ══════════════════════════════════════════════════════
  //  IMPORT / EXPORT
  // ══════════════════════════════════════════════════════
  importPrompts() { document.getElementById('promptImportInput')?.click(); },

  async handleImportFile(files) {
    if (!files?.length) return;
    try {
      await PromptStore.importFromFile(files[0]);
      Shell.toast('提示词导入成功', 'success');
      this._refreshTree(); this._renderDetail();
    } catch (e) { Shell.toast('导入失败：' + e.message, 'error'); }
    const input = document.getElementById('promptImportInput');
    if (input) input.value = '';
  },
};

window.ChatPage = ChatPage;
