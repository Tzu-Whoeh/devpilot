/* ═══ SkillModal v1.0 — Role/Skill Prompt Viewer ═══
 *
 * UREQ-DEVPILOT-FE-001: 弹窗展示岗位系统提示词和职责Skill提示词
 *
 * Two modes:
 *   showRole(role)       — 显示岗位概览 + 系统提示词
 *   showSkill(role,skill) — 显示具体 Skill 模板 (MD 格式)
 */
const SkillModal = {
  /**
   * 显示岗位系统提示词
   */
  showRole(role) {
    const html = `
      <div class="skill-modal-overlay" id="skillModal" onclick="if(event.target===this)SkillModal.close()">
        <div class="skill-modal">
          <div class="skill-modal-header">
            <div class="skill-modal-icon">${role.icon}</div>
            <div class="skill-modal-title-wrap">
              <h3 class="skill-modal-title">${_esc(role.name)}</h3>
              <span class="skill-modal-subtitle">${_esc(role.title)}</span>
            </div>
            <button class="skill-modal-close" onclick="SkillModal.close()">✕</button>
          </div>
          <div class="skill-modal-body">
            <div class="skill-modal-section">
              <div class="skill-modal-label">📝 描述</div>
              <p class="skill-modal-text">${_esc(role.description)}</p>
            </div>
            <div class="skill-modal-section">
              <div class="skill-modal-label">🧠 系统提示词</div>
              <pre class="skill-modal-prompt">${_esc(role.systemPrompt)}</pre>
            </div>
            <div class="skill-modal-section">
              <div class="skill-modal-label">🛠️ 职责列表 (${role.skills.length})</div>
              <div class="skill-modal-skill-list">
                ${role.skills.map(s => `
                  <div class="skill-modal-skill-item" onclick="SkillModal.showSkill(AI_ROLES['${_esc(role.id)}'], getSkillTemplate('${_esc(role.id)}','${_esc(s.id)}'))">
                    <span class="skill-modal-skill-name">${_esc(s.name)}</span>
                    <span class="skill-modal-skill-trigger">${_esc(s.trigger)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this._inject(html);
  },

  /**
   * 显示 Skill 模板
   */
  showSkill(role, skill) {
    const html = `
      <div class="skill-modal-overlay" id="skillModal" onclick="if(event.target===this)SkillModal.close()">
        <div class="skill-modal">
          <div class="skill-modal-header">
            <div class="skill-modal-icon">${role.icon}</div>
            <div class="skill-modal-title-wrap">
              <h3 class="skill-modal-title">${_esc(skill.name)}</h3>
              <span class="skill-modal-subtitle">${_esc(role.name)} · ${_esc(skill.trigger)}</span>
            </div>
            <button class="skill-modal-close" onclick="SkillModal.close()">✕</button>
          </div>
          <div class="skill-modal-body">
            <div class="skill-modal-section">
              <div class="skill-modal-label">📝 描述</div>
              <p class="skill-modal-text">${_esc(skill.description)}</p>
            </div>
            <div class="skill-modal-section">
              <div class="skill-modal-label">📄 Skill 模板</div>
              <pre class="skill-modal-prompt skill-modal-template">${_esc(skill.template)}</pre>
            </div>
          </div>
          <div class="skill-modal-footer">
            <button class="btn btn-secondary btn-sm" onclick="SkillModal.close()">关闭</button>
            <button class="btn btn-primary btn-sm" onclick="SkillModal.copyTemplate('${_esc(role.id)}','${_esc(skill.id)}')">📋 复制模板</button>
          </div>
        </div>
      </div>
    `;
    this._inject(html);
  },

  /**
   * 关闭弹窗
   */
  close() {
    document.getElementById('skillModal')?.remove();
  },

  /**
   * 复制 Skill 模板到剪贴板
   */
  copyTemplate(roleId, skillId) {
    const skill = getSkillTemplate(roleId, skillId);
    if (!skill) return;
    navigator.clipboard?.writeText(skill.template).then(() => {
      Shell.toast('模板已复制到剪贴板', 'success');
    }).catch(() => {
      Shell.toast('复制失败，请手动选择复制', 'error');
    });
  },

  _inject(html) {
    document.getElementById('skillModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }
};

window.SkillModal = SkillModal;
