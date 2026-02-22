/* ═══ Mock API — Full CRUD + AI Simulator ═══ */

const MockAPI = {
  // ── Auth ──
  async login(username, password) {
    await this._delay(500);
    if (!username || !password) throw new Error('请输入用户名和密码');
    if (password.length < 3) throw new Error('密码错误');
    const isAdmin = username.toLowerCase() === 'admin';
    return {
      token: 'mock_jwt_' + Date.now(),
      user: { id: 'u_' + username, username, email: username + '@devpilot.ai', role: isAdmin ? 'admin' : 'user', is_active: true },
      expires_at: new Date(Date.now() + 86400000).toISOString()
    };
  },

  async register(username, password, email) {
    await this._delay(600);
    if (!username || username.length < 3) throw new Error('用户名至少3个字符');
    if (!password || password.length < 8) throw new Error('密码至少8个字符');
    return {
      token: 'mock_jwt_' + Date.now(),
      user: { id: 'u_' + username, username, email: email || username + '@devpilot.ai', role: 'user', is_active: true },
      expires_at: new Date(Date.now() + 86400000).toISOString()
    };
  },

  // ── Templates ──
  async getTemplateTypes() {
    await this._delay(200);
    return Object.values(MOCK_TEMPLATES).map(t => ({
      type_key: t.type_key, name: t.name, icon: t.icon,
      description: t.description, phase_count: t.phase_count
    }));
  },

  async getTemplatePhases(typeKey) {
    await this._delay(200);
    const tmpl = MOCK_TEMPLATES[typeKey];
    if (!tmpl) throw new Error('Unknown template type');
    return tmpl.phases;
  },

  // ── Projects ──
  async getProjects() {
    await this._delay(150);
    return AppState.projects;
  },

  async getProject(id) {
    await this._delay(150);
    const p = AppState.projects.find(p => p.id === id);
    if (!p) throw new Error('Project not found');
    return p;
  },

  async createProject(data) {
    await this._delay(400);
    const tmpl = MOCK_TEMPLATES[data.type_key];
    if (!tmpl) throw new Error('Invalid template type');

    const projectId = 'proj_' + Date.now();
    const phases = tmpl.phases.map((ph, i) => ({
      id: projectId + '_ph' + (i + 1),
      phase_template_id: ph.id,
      sequence_order: ph.seq,
      name: ph.name,
      icon: ph.icon,
      role: ph.role,
      desc: ph.desc,
      ai_action: ph.ai_action,
      user_action: ph.user_action,
      status: i === 0 ? 'pending' : 'pending', // first phase is active pending
      ai_output: null,
      chat_history: [],
      started_at: null,
      completed_at: null,
    }));

    const project = {
      id: projectId,
      name: data.name,
      description: data.description || '',
      type_key: data.type_key,
      type_name: tmpl.name,
      type_icon: tmpl.icon,
      phases,
      current_phase_index: 0,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const projects = [...AppState.projects, project];
    AppState.projects = projects;
    return project;
  },

  // ── Phase Lifecycle ──
  async triggerPhase(projectId, phaseId) {
    await this._delay(300);
    const project = this._findProject(projectId);
    const phase = project.phases.find(p => p.id === phaseId);
    if (!phase) throw new Error('Phase not found');
    if (phase.status !== 'pending' && phase.status !== 'rejected') {
      throw new Error('Phase cannot be triggered in current status');
    }

    phase.status = 'ai_working';
    phase.started_at = new Date().toISOString();
    phase.ai_output = null;
    this._saveProjects();

    // Simulate AI work (async completion after delay)
    setTimeout(() => {
      const output = getMockOutput(phase.name);
      phase.status = 'awaiting_approval';
      phase.ai_output = {
        title: output.title,
        summary: output.summary,
        url: '#', // Mock Notion URL
        generated_at: new Date().toISOString(),
      };
      // Add initial AI message
      phase.chat_history.push({
        role: 'ai', sender: phase.role,
        text: `${output.title}已生成完毕。${output.summary}\n\n如有疑问请随时与我讨论。`,
        time: new Date().toISOString()
      });
      this._saveProjects();
      EventBus.emit('phase:updated', { projectId, phaseId, status: 'awaiting_approval' });
    }, 3000 + Math.random() * 2000);

    return { status: 'ai_working' };
  },

  async approvePhase(projectId, phaseId) {
    await this._delay(300);
    const project = this._findProject(projectId);
    const phase = project.phases.find(p => p.id === phaseId);
    if (!phase || phase.status !== 'awaiting_approval') throw new Error('Cannot approve');

    phase.status = 'approved';
    phase.completed_at = new Date().toISOString();

    // Advance to next phase
    const idx = project.phases.indexOf(phase);
    if (idx < project.phases.length - 1) {
      project.current_phase_index = idx + 1;
      // Next phase remains 'pending' — user must manually trigger
    } else {
      project.status = 'completed';
    }
    this._saveProjects();
    EventBus.emit('phase:updated', { projectId, phaseId, status: 'approved' });
    return { status: 'approved' };
  },

  async rejectPhase(projectId, phaseId) {
    await this._delay(300);
    const project = this._findProject(projectId);
    const phase = project.phases.find(p => p.id === phaseId);
    if (!phase || phase.status !== 'awaiting_approval') throw new Error('Cannot reject');

    phase.status = 'rejected';
    phase.ai_output = null;
    phase.chat_history = [];
    this._saveProjects();
    EventBus.emit('phase:updated', { projectId, phaseId, status: 'rejected' });
    return { status: 'rejected' };
  },

  async regeneratePhase(projectId, phaseId, additionalReq) {
    await this._delay(300);
    const project = this._findProject(projectId);
    const phase = project.phases.find(p => p.id === phaseId);
    if (!phase || phase.status !== 'awaiting_approval') throw new Error('Cannot regenerate');

    // Keep chat history, add user's additional request
    phase.chat_history.push({
      role: 'user', text: `补充要求：${additionalReq}`, time: new Date().toISOString()
    });
    phase.status = 'ai_working';
    phase.ai_output = null;
    this._saveProjects();

    // Simulate regeneration
    setTimeout(() => {
      const output = getMockOutput(phase.name);
      phase.status = 'awaiting_approval';
      phase.ai_output = {
        title: output.title + ' (修订版)',
        summary: '已根据您的补充要求重新生成。' + output.summary,
        url: '#',
        generated_at: new Date().toISOString(),
      };
      phase.chat_history.push({
        role: 'ai', sender: phase.role,
        text: `已根据您的要求重新生成了文档。主要调整了以下方面：\n1. 补充了您提到的需求\n2. 优化了方案细节\n\n请查看更新后的文档。`,
        time: new Date().toISOString()
      });
      this._saveProjects();
      EventBus.emit('phase:updated', { projectId, phaseId, status: 'awaiting_approval' });
    }, 3000 + Math.random() * 2000);

    return { status: 'ai_working' };
  },

  // ── Chat ──
  async sendChat(projectId, phaseId, message) {
    const project = this._findProject(projectId);
    const phase = project.phases.find(p => p.id === phaseId);
    if (!phase) throw new Error('Phase not found');

    phase.chat_history.push({ role: 'user', text: message, time: new Date().toISOString() });
    this._saveProjects();

    // Simulate AI response with delay
    await this._delay(1000 + Math.random() * 1500);
    const response = getMockChatResponse(phase.role);
    phase.chat_history.push({
      role: 'ai', sender: phase.role, text: response, time: new Date().toISOString()
    });
    this._saveProjects();
    return { role: 'ai', sender: phase.role, text: response };
  },

  async sendFreeChat(message) {
    await this._delay(1000 + Math.random() * 1500);
    const responses = [
      '我理解你的问题。作为 DevPilot AI 助手，我可以帮助你规划项目、分析需求、设计架构等。你想从哪个方面开始？',
      '这是一个很好的问题。让我从专业角度分析一下...\n\n根据行业最佳实践，建议采用渐进式迭代的方式推进，先确定核心功能，再逐步扩展。',
      '收到！我来帮你整理一下思路。首先我们需要明确目标用户群体，然后定义核心使用场景，最后确定技术可行性。',
    ];
    return { role: 'ai', sender: 'DevPilot', text: responses[Math.floor(Math.random() * responses.length)] };
  },

  // ── Helpers ──
  _findProject(id) {
    const p = AppState.projects.find(p => p.id === id);
    if (!p) throw new Error('Project not found');
    return p;
  },
  _saveProjects() {
    AppState.projects = [...AppState.projects]; // trigger save
  },
  _delay(ms) { return new Promise(r => setTimeout(r, ms)); },
};

window.MockAPI = MockAPI;
