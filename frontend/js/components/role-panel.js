/* ═══ RolePanel v1.0 — Left AI Role Panel (240px) ═══
 *
 * UREQ-DEVPILOT-FE-001 D9: 对话页三栏布局 - 左侧AI岗位面板
 *
 * Features:
 *   - 展示9个AI岗位及职责列表
 *   - 点击岗位名称：展开/收起职责列表
 *   - 点击岗位图标：弹出SkillModal查看系统提示词
 *   - 双击职责项：将Skill触发命令填充到输入框
 */
const RolePanel = {
  _expandedRoles: {},
  _onSkillDblClick: null,  // callback(trigger_text)

  /**
   * 渲染面板HTML
   * @param {Function} onSkillDblClick - 双击职责时的回调，参数为 trigger 文本
   * @returns {string} HTML string
   */
  renderHTML(onSkillDblClick) {
    this._onSkillDblClick = onSkillDblClick || null;
    const roles = getRoleList();

    let html = `<div class="role-panel" id="rolePanel">
      <div class="role-panel-header">
        <span class="role-panel-title">🤖 AI 岗位</span>
        <button class="role-panel-collapse" id="rolePanelCollapseBtn" onclick="RolePanel.togglePanel()" title="收起面板">◀</button>
      </div>
      <div class="role-panel-list" id="rolePanelList">`;

    for (const role of roles) {
      const expanded = this._expandedRoles[role.id];
      html += `
        <div class="rp-role-node ${expanded ? 'expanded' : ''}" data-role="${_esc(role.id)}">
          <div class="rp-role-header" onclick="RolePanel.toggleRole('${_esc(role.id)}')">
            <span class="rp-role-arrow">▶</span>
            <span class="rp-role-icon" onclick="event.stopPropagation();RolePanel.showRoleInfo('${_esc(role.id)}')" title="查看系统提示词">${role.icon}</span>
            <span class="rp-role-name">${_esc(role.name)}</span>
            <span class="rp-role-badge">${role.skills.length}</span>
          </div>
          <div class="rp-skill-list">
            ${role.skills.map(skill => `
              <div class="rp-skill-item"
                   onclick="RolePanel.showSkill('${_esc(role.id)}','${_esc(skill.id)}')"
                   ondblclick="RolePanel.fillSkill('${_esc(skill.trigger)}')"
                   title="单击查看 · 双击填充输入框">
                <span class="rp-skill-name">${_esc(skill.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    html += `</div></div>`;
    return html;
  },

  /**
   * 展开/收起岗位
   */
  toggleRole(roleId) {
    this._expandedRoles[roleId] = !this._expandedRoles[roleId];
    const node = document.querySelector(`.rp-role-node[data-role="${roleId}"]`);
    if (node) node.classList.toggle('expanded', this._expandedRoles[roleId]);
  },

  /**
   * 显示岗位系统提示词 (调用 SkillModal)
   */
  showRoleInfo(roleId) {
    const role = getRoleById(roleId);
    if (!role) return;
    SkillModal.showRole(role);
  },

  /**
   * 显示Skill模板 (调用 SkillModal)
   */
  showSkill(roleId, skillId) {
    const role = getRoleById(roleId);
    const skill = getSkillTemplate(roleId, skillId);
    if (!role || !skill) return;
    SkillModal.showSkill(role, skill);
  },

  /**
   * 双击职责 → 填充输入框
   */
  fillSkill(trigger) {
    if (this._onSkillDblClick) {
      this._onSkillDblClick(trigger);
    }
  },

  /**
   * 收起/展开面板
   */
  togglePanel() {
    const panel = document.getElementById('rolePanel');
    if (!panel) return;
    panel.classList.toggle('collapsed');
    const btn = document.getElementById('rolePanelCollapseBtn');
    if (btn) btn.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
  }
};

window.RolePanel = RolePanel;
