/* ═══ Mock Data v2.0 — Standard Templates (UREQ-DEVPILOT-FE-001) ═══
 *
 * 3 standard task types:
 *   - new_project: 新项目开发 (6 phases)
 *   - feature: 功能迭代 (4 phases)
 *   - bugfix: Bug修复 (3 phases)
 */

const MOCK_TEMPLATES = {
  new_project: {
    type_key: 'new_project', name: '新项目开发', icon: '🚀',
    description: '从需求到上线的完整开发流程',
    phase_count: 6,
    phases: [
      { id:'np-p1', seq:1, name:'需求分析', icon:'📋', role:'AI-BA', desc:'明确做什么、为谁做、核心功能', ai_action:'生成 PRD（产品需求文档）', user_action:'审批 PRD', output_type:'document' },
      { id:'np-p2', seq:2, name:'架构设计', icon:'🏗️', role:'AI-Arch', desc:'确定技术方案、数据库、API 接口', ai_action:'生成 ADD（架构设计文档）', user_action:'审批架构方案', output_type:'document' },
      { id:'np-p3', seq:3, name:'开发实现', icon:'💻', role:'AI-Dev', desc:'编写代码、单元测试', ai_action:'按模块逐步实现代码', user_action:'审查代码产出', output_type:'code' },
      { id:'np-p4', seq:4, name:'测试验收', icon:'✅', role:'AI-QA', desc:'功能验证、Bug 修复', ai_action:'生成测试计划并执行', user_action:'确认测试通过', output_type:'document' },
      { id:'np-p5', seq:5, name:'部署上线', icon:'🚀', role:'AI-Ops', desc:'部署到生产环境', ai_action:'生成部署方案并执行', user_action:'确认上线成功', output_type:'document' },
      { id:'np-p6', seq:6, name:'运维监控', icon:'🔧', role:'AI-Ops', desc:'持续监控、问题修复、迭代优化', ai_action:'监控 + 修复', user_action:'决定后续迭代', output_type:'document' },
    ]
  },
  feature: {
    type_key: 'feature', name: '功能迭代', icon: '✨',
    description: '在已有系统上新增或改进功能',
    phase_count: 4,
    phases: [
      { id:'ft-p1', seq:1, name:'需求分析', icon:'📋', role:'AI-BA', desc:'分析迭代需求、影响范围评估', ai_action:'生成迭代需求文档', user_action:'审批需求', output_type:'document' },
      { id:'ft-p2', seq:2, name:'设计实现', icon:'💻', role:'AI-Dev', desc:'方案设计 + 代码实现', ai_action:'生成设计方案并实现代码', user_action:'审查代码', output_type:'code' },
      { id:'ft-p3', seq:3, name:'测试验收', icon:'✅', role:'AI-QA', desc:'回归测试、新功能验证', ai_action:'生成测试用例并执行', user_action:'确认测试通过', output_type:'document' },
      { id:'ft-p4', seq:4, name:'发布上线', icon:'🚀', role:'AI-Ops', desc:'灰度发布、全量上线', ai_action:'生成发布方案', user_action:'确认发布', output_type:'document' },
    ]
  },
  bugfix: {
    type_key: 'bugfix', name: 'Bug修复', icon: '🐛',
    description: '快速定位并修复线上问题',
    phase_count: 3,
    phases: [
      { id:'bf-p1', seq:1, name:'问题分析', icon:'🔍', role:'AI-Dev', desc:'定位 Bug 根因、影响范围分析', ai_action:'生成问题分析报告', user_action:'确认分析结果', output_type:'document' },
      { id:'bf-p2', seq:2, name:'修复验证', icon:'🔧', role:'AI-Dev', desc:'编写修复代码、回归测试', ai_action:'生成修复补丁和测试用例', user_action:'审查修复代码', output_type:'code' },
      { id:'bf-p3', seq:3, name:'热修上线', icon:'🚀', role:'AI-Ops', desc:'紧急部署修复补丁', ai_action:'生成热修部署方案', user_action:'确认修复上线', output_type:'document' },
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
  '问题分析': {
    title: 'Bug 分析报告',
    summary: '经过日志分析和代码审查，确认问题根因为数据库连接池耗尽导致超时。影响范围涉及所有写操作。建议修复方案：调整连接池参数 + 添加重试机制。',
    content: '# Bug 分析报告\n\n## 问题现象\n用户反馈页面偶发 504 超时\n\n## 根因分析\n数据库连接池默认 5 个连接，高峰期不够用\n\n## 修复建议\n1. 调大连接池至 20\n2. 添加连接获取超时重试'
  },
  '设计实现': {
    title: '迭代设计方案',
    summary: '本次迭代新增用户偏好设置模块，涉及前端设置页面改造、后端 API 新增 3 个端点、数据库新增 user_preferences 表。预计开发工时 16h。',
    content: '# 迭代设计方案\n\n## 变更范围\n- 前端: 设置页新增偏好面板\n- 后端: 新增 CRUD API\n- 数据库: 新增表\n\n## API 设计\n- GET /api/preferences\n- PUT /api/preferences\n- DELETE /api/preferences/:key'
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
  'AI-Dev': [
    '代码已按模块组织，遵循 PEP 8 规范。核心业务逻辑在 services/ 层，路由层保持轻量。',
    '修复补丁已准备好，包含 3 个文件的改动。已添加对应的单元测试，覆盖率达到 92%。'
  ],
  'AI-QA': ['测试用例覆盖了 85% 的核心路径。发现 2 个中等优先级问题，已记录在测试报告中。'],
  'AI-Ops': ['部署方案采用 systemd 服务管理，支持零停机重启。监控使用 structlog 结构化日志。'],
  'AI-PM': ['项目排期已更新，关键路径上的任务没有延误风险。建议下周三前完成第一轮验收。'],
  'AI-Writer': ['API 文档已生成，覆盖全部 15 个端点。每个端点包含请求示例和响应示例。'],
  'AI-Reviewer': ['代码审查完成，发现 3 个改进建议：1) 提取重复逻辑 2) 添加输入校验 3) 优化 SQL 查询。'],
  'AI-PMO': ['当前有 3 个活跃项目，资源分配合理。建议将"Bug修复"项目优先级提升至 P0。']
};

function getMockChatResponse(role) {
  const responses = MOCK_CHAT_RESPONSES[role] || MOCK_CHAT_RESPONSES['AI-BA'];
  return responses[Math.floor(Math.random() * responses.length)];
}

window.MOCK_TEMPLATES = MOCK_TEMPLATES;
window.getMockOutput = getMockOutput;
window.getMockChatResponse = getMockChatResponse;
