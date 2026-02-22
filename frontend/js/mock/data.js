/* ═══ Mock Data — Complete Templates & Projects ═══ */

const MOCK_TEMPLATES = {
  software_dev: {
    type_key: 'software_dev', name: '开发系统', icon: '💻',
    description: '从需求到上线的完整开发流程',
    phase_count: 6,
    phases: [
      { id:'t1-p1', seq:1, name:'需求分析', icon:'📋', role:'AI-BA', desc:'明确做什么、为谁做、核心功能是什么', ai_action:'生成 PRD（产品需求文档）', user_action:'审批 PRD', output_type:'document' },
      { id:'t1-p2', seq:2, name:'架构设计', icon:'🏗️', role:'AI-Arch', desc:'确定技术方案、数据库、API 接口', ai_action:'生成 ADD（架构设计文档）', user_action:'审批架构方案', output_type:'document' },
      { id:'t1-p3', seq:3, name:'开发实现', icon:'💻', role:'AI-Dev', desc:'编写代码、单元测试', ai_action:'按模块逐步实现代码', user_action:'审查代码产出', output_type:'code' },
      { id:'t1-p4', seq:4, name:'测试验收', icon:'✅', role:'AI-QA', desc:'功能验证、Bug 修复', ai_action:'生成测试计划并执行', user_action:'确认测试通过', output_type:'document' },
      { id:'t1-p5', seq:5, name:'部署上线', icon:'🚀', role:'AI-Ops', desc:'部署到生产环境', ai_action:'生成部署方案并执行', user_action:'确认上线成功', output_type:'document' },
      { id:'t1-p6', seq:6, name:'运维监控', icon:'🔧', role:'AI-Ops', desc:'持续监控、问题修复、迭代优化', ai_action:'监控 + 修复', user_action:'决定后续迭代', output_type:'document' },
    ]
  },
  short_video: {
    type_key: 'short_video', name: '拍摄短视频', icon: '🎬',
    description: '从选题到发布的完整制作流程',
    phase_count: 6,
    phases: [
      { id:'t2-p1', seq:1, name:'选题策划', icon:'💡', role:'AI-BA', desc:'确定视频主题、目标受众、核心卖点', ai_action:'生成选题方案（含竞品分析、热点趋势、推荐选题）', user_action:'选定选题方向', output_type:'document' },
      { id:'t2-p2', seq:2, name:'脚本撰写', icon:'📝', role:'AI-Writer', desc:'编写分镜脚本、台词、画面描述', ai_action:'生成分镜脚本（含镜号、画面描述、台词/旁白、时长）', user_action:'审批脚本', output_type:'document' },
      { id:'t2-p3', seq:3, name:'拍摄筹备', icon:'🎬', role:'AI-PM', desc:'准备场地、道具、设备、人员安排', ai_action:'生成拍摄清单（场景列表、道具/服装、设备需求）', user_action:'确认筹备就绪', output_type:'checklist' },
      { id:'t2-p4', seq:4, name:'拍摄执行', icon:'🎥', role:'AI-PM', desc:'按分镜拍摄素材', ai_action:'生成拍摄日志模板（镜号 checklist）', user_action:'标记拍摄完成', output_type:'checklist' },
      { id:'t2-p5', seq:5, name:'后期制作', icon:'🎞️', role:'AI-Writer', desc:'剪辑、配音、字幕、特效、调色', ai_action:'生成剪辑脚本（EDL 时间线、字幕文稿、BGM 推荐）', user_action:'审批成片', output_type:'document' },
      { id:'t2-p6', seq:6, name:'发布运营', icon:'📱', role:'AI-PM', desc:'发布到平台、推广、数据追踪', ai_action:'生成发布计划（平台选择、发布时间、标题/标签）', user_action:'确认发布', output_type:'document' },
    ]
  },
  new_store: {
    type_key: 'new_store', name: '开设新门店', icon: '🏪',
    description: '从选址到开业的完整开店流程',
    phase_count: 7,
    phases: [
      { id:'t3-p1', seq:1, name:'选址调研', icon:'📍', role:'AI-BA', desc:'商圈分析、竞品调研、人流量评估', ai_action:'生成选址报告（商圈分析、竞品分布、推荐方案）', user_action:'选定店址', output_type:'document' },
      { id:'t3-p2', seq:2, name:'商务签约', icon:'📄', role:'AI-PM', desc:'租赁谈判、证照办理、预算确认', ai_action:'生成签约 checklist（租约要点、证照清单）', user_action:'确认签约完成', output_type:'checklist' },
      { id:'t3-p3', seq:3, name:'装修设计', icon:'🎨', role:'AI-Arch', desc:'门店平面布局、风格定义、施工方案', ai_action:'生成装修方案（平面布局、风格参考、材料清单）', user_action:'审批装修方案', output_type:'document' },
      { id:'t3-p4', seq:4, name:'施工采购', icon:'🔨', role:'AI-PM', desc:'装修施工、设备采购、陈列布置', ai_action:'生成施工排期 + 采购清单', user_action:'确认施工完成', output_type:'checklist' },
      { id:'t3-p5', seq:5, name:'招聘培训', icon:'👥', role:'AI-BA', desc:'招募员工、岗位培训、试岗', ai_action:'生成招聘方案 + 培训手册', user_action:'确认团队就位', output_type:'document' },
      { id:'t3-p6', seq:6, name:'试营业', icon:'🧪', role:'AI-QA', desc:'软开业、流程跑通、收集反馈', ai_action:'生成试营业检查清单', user_action:'确认可以正式开业', output_type:'checklist' },
      { id:'t3-p7', seq:7, name:'正式开业', icon:'🎉', role:'AI-PM', desc:'开业活动、推广营销、正常运营', ai_action:'生成开业方案（活动策划、促销方案）', user_action:'确认开业', output_type:'document' },
    ]
  }
};

// AI output mock texts per phase
const MOCK_AI_OUTPUTS = {
  '需求分析': {
    title: '产品需求文档 (PRD)',
    summary: '基于用户需求分析，系统采用 B/S 架构，核心功能包括用户认证、项目管理、AI 对话交互三大模块。目标用户为独立开发者和小团队负责人。MVP 版本聚焦于项目创建向导和 AI 辅助工作流。',
    content: '# 产品需求文档 (PRD)\n\n## 1. 产品概述\n本系统旨在为独立开发者和小团队提供 AI 驱动的项目协作平台...\n\n## 2. 目标用户\n- 独立开发者\n- 小团队负责人（5人以下）\n\n## 3. 核心功能\n- **用户认证**: JWT 令牌认证\n- **项目管理**: 创建、查看、推进项目\n- **AI 对话**: 上下文感知的智能对话\n\n## 4. 非功能性需求\n- 响应时间 < 2s\n- 支持移动端访问'
  },
  '架构设计': {
    title: '架构设计文档 (ADD)',
    summary: '采用前后端分离架构，后端使用 FastAPI + PostgreSQL，前端 Vanilla JS SPA。通过 Nginx 反向代理统一入口。AI 能力由 AI Gateway 提供，PCC Core 负责业务编排。',
    content: '# 架构设计文档\n\n## 技术选型\n- **后端**: FastAPI + SQLAlchemy + PostgreSQL\n- **前端**: Vanilla JS SPA\n- **AI服务**: AI Gateway (MCP)\n- **认证**: JWT RS256\n\n## 部署架构\nNginx :8888 → Auth :16001 / PCC :16003 / AI Gateway :16002'
  },
  '选题策划': {
    title: '短视频选题方案',
    summary: '基于当前热点趋势和目标受众分析，推荐 3 个选题方向：1) 产品功能演示（转化率高）；2) 幕后故事（增强品牌认同）；3) 用户痛点解决方案（传播性强）。建议优先选择方案 1。',
    content: '# 短视频选题方案\n\n## 推荐选题 1: 产品功能亮点演示\n预计播放量: 5000-10000\n目标: 提高产品认知度...'
  },
  '选址调研': {
    title: '门店选址调研报告',
    summary: '经过对 3 个候选商圈的综合评估，推荐朝阳区望京 SOHO 商圈。日均人流量 8.5 万人，目标客群占比 42%，月租金 ¥15,000/50㎡，竞品密度低。',
    content: '# 选址调研报告\n\n## 候选方案对比\n| 商圈 | 日人流 | 月租金 | 竞品数 |\n| 望京SOHO | 8.5万 | 1.5万 | 2 |...'
  }
};

// Generate a default output for any phase
function getMockOutput(phaseName) {
  return MOCK_AI_OUTPUTS[phaseName] || {
    title: `${phaseName} — AI 产出文档`,
    summary: `${phaseName}阶段的 AI 分析已完成。文档包含详细的方案建议、风险评估和实施步骤。请查看完整文档并进行审批。`,
    content: `# ${phaseName}\n\n文档内容已生成，包含完整的分析和建议...`
  };
}

// Mock chat responses per role
const MOCK_CHAT_RESPONSES = {
  'AI-BA': [
    '根据需求分析，我建议将核心功能分为 3 个优先级层次。P0 级功能确保 MVP 可用，P1 级功能提升用户体验。',
    '这个需求的实现复杂度中等，预计需要 2-3 天开发时间。我已经在文档中标注了技术风险点。',
    '用户画像分析显示，目标用户群体更倾向于简洁的操作流程。建议将注册步骤从 5 步缩减为 3 步。'
  ],
  'AI-Arch': [
    '考虑到事务一致性需求，PostgreSQL 比 MongoDB 更合适。关系型数据库在复杂查询和 ACID 事务方面有明显优势。',
    '架构方案采用了微服务思路，但考虑到当前团队规模，建议先以单体应用启动，后续根据需要拆分。',
    'API 接口设计遵循 RESTful 规范，状态码使用标准 HTTP 语义。认证采用 JWT RS256 非对称加密。'
  ],
  'AI-Dev': ['代码已按模块组织，遵循 PEP 8 规范。核心业务逻辑在 services/ 层，路由层保持轻量。'],
  'AI-QA': ['测试用例覆盖了 85% 的核心路径。发现 2 个中等优先级问题，已记录在测试报告中。'],
  'AI-Ops': ['部署方案采用 systemd 服务管理，支持零停机重启。监控使用 structlog 结构化日志。'],
  'AI-PM': ['项目排期已更新，关键路径上的任务没有延误风险。建议下周三前完成第一轮验收。'],
  'AI-Writer': ['分镜脚本已完成，共 12 个镜头，预计总时长 90 秒。已标注每个镜头的运镜方式和转场效果。']
};

function getMockChatResponse(role) {
  const responses = MOCK_CHAT_RESPONSES[role] || MOCK_CHAT_RESPONSES['AI-BA'];
  return responses[Math.floor(Math.random() * responses.length)];
}

window.MOCK_TEMPLATES = MOCK_TEMPLATES;
window.getMockOutput = getMockOutput;
window.getMockChatResponse = getMockChatResponse;
