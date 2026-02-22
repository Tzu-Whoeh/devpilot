/* ═══ PromptStore v1.0 — Prompt Persistence Layer ═══
 *
 * 提示词持久化存储（localStorage + JSON导出/导入）
 *
 * Storage key: 'devpilot_prompts'
 * Format: { "AI-PM": { systemPrompt: "...", skills: { "task_decomposition": "..." } }, ... }
 *
 * API:
 *   getSystemPrompt(roleId)        — 获取岗位系统提示词（优先自定义，回退默认）
 *   setSystemPrompt(roleId, text)   — 保存自定义系统提示词
 *   getSkillTemplate(roleId, skillId) — 获取Skill模板
 *   setSkillTemplate(roleId, skillId, text) — 保存自定义Skill模板
 *   resetRole(roleId)               — 重置岗位所有自定义为默认
 *   resetAll()                       — 重置全部
 *   hasCustom(roleId, skillId?)      — 是否有自定义修改
 *   exportJSON()                     — 导出全部自定义为JSON
 *   importJSON(json)                 — 导入JSON覆盖自定义
 *   downloadJSON()                   — 触发浏览器下载
 */
const PromptStore = {
  _STORAGE_KEY: 'devpilot_prompts',

  /** 读取全部自定义数据 */
  _load() {
    try {
      return JSON.parse(localStorage.getItem(this._STORAGE_KEY) || '{}');
    } catch { return {}; }
  },

  /** 写入全部自定义数据 */
  _save(data) {
    localStorage.setItem(this._STORAGE_KEY, JSON.stringify(data));
  },

  /**
   * 获取系统提示词（优先自定义，回退 AI_ROLES 默认值）
   */
  getSystemPrompt(roleId) {
    const custom = this._load();
    if (custom[roleId]?.systemPrompt !== undefined) {
      return custom[roleId].systemPrompt;
    }
    return AI_ROLES[roleId]?.systemPrompt || '';
  },

  /**
   * 保存自定义系统提示词
   */
  setSystemPrompt(roleId, text) {
    const data = this._load();
    if (!data[roleId]) data[roleId] = {};
    data[roleId].systemPrompt = text;
    this._save(data);
  },

  /**
   * 获取Skill模板（优先自定义，回退默认）
   */
  getSkillTemplate(roleId, skillId) {
    const custom = this._load();
    if (custom[roleId]?.skills?.[skillId] !== undefined) {
      return custom[roleId].skills[skillId];
    }
    const role = AI_ROLES[roleId];
    const skill = role?.skills?.find(s => s.id === skillId);
    return skill?.template || '';
  },

  /**
   * 保存自定义Skill模板
   */
  setSkillTemplate(roleId, skillId, text) {
    const data = this._load();
    if (!data[roleId]) data[roleId] = {};
    if (!data[roleId].skills) data[roleId].skills = {};
    data[roleId].skills[skillId] = text;
    this._save(data);
  },

  /**
   * 检测是否有自定义修改
   */
  hasCustom(roleId, skillId) {
    const data = this._load();
    if (!data[roleId]) return false;
    if (skillId) return data[roleId]?.skills?.[skillId] !== undefined;
    return data[roleId]?.systemPrompt !== undefined ||
           (data[roleId]?.skills && Object.keys(data[roleId].skills).length > 0);
  },

  /**
   * 重置单个岗位
   */
  resetRole(roleId) {
    const data = this._load();
    delete data[roleId];
    this._save(data);
  },

  /**
   * 重置全部
   */
  resetAll() {
    localStorage.removeItem(this._STORAGE_KEY);
  },

  /**
   * 导出为 JSON 字符串
   */
  exportJSON() {
    return JSON.stringify(this._load(), null, 2);
  },

  /**
   * 导入 JSON
   */
  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (typeof data !== 'object' || data === null) throw new Error('Invalid format');
      this._save(data);
      return true;
    } catch (e) {
      console.error('PromptStore import failed:', e);
      return false;
    }
  },

  /**
   * 触发浏览器下载
   */
  downloadJSON() {
    const blob = new Blob([this.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devpilot-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  },

  /**
   * 从文件导入（配合 file input）
   */
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const ok = this.importJSON(reader.result);
        ok ? resolve() : reject(new Error('Invalid JSON format'));
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  }
};

window.PromptStore = PromptStore;
