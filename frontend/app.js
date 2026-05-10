/**
 * Requirement AI Agent — Frontend Application
 * Handles all UI interactions and API communication.
 */

const API = '/api';

// ── State ──────────────────────────────────────────────────────────
let state = {
  projects: [],
  currentProjectId: null,
  documents: [],
  analysisId: null,
  analysisResult: null,
  prdId: null,
  prdResult: null,
  breakdownId: null,
  taskResult: null,
};

// ── API Helpers ────────────────────────────────────────────────────
async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.message || 'Request failed');
  return json;
}

function showLoading(msg = '处理中...') {
  document.getElementById('loadingMessage').textContent = msg;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

// ── Project Management ─────────────────────────────────────────────
async function loadProjects() {
  try {
    const res = await apiCall('GET', '/projects');
    state.projects = res.data || [];
    renderProjectList();
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
}

function renderProjectList() {
  const list = document.getElementById('projectList');
  if (!state.projects.length) {
    list.innerHTML = '<div class="empty-state">暂无项目，点击上方按钮创建</div>';
    return;
  }
  list.innerHTML = state.projects.map(p => `
    <div class="project-item ${p.id === state.currentProjectId ? 'active' : ''}"
         onclick="switchProject(${p.id})">
      <span class="project-name">${escHtml(p.name)}</span>
      <span class="project-status">${p.status}</span>
    </div>
  `).join('');
}

async function switchProject(id) {
  state.currentProjectId = id;
  state.analysisId = null;
  state.analysisResult = null;
  state.prdId = null;
  state.prdResult = null;
  state.breakdownId = null;
  state.taskResult = null;

  renderProjectList();
  await loadProjectDetail();
  await loadDocuments();
  showScreen('projectScreen');
}

async function loadProjectDetail() {
  try {
    const res = await apiCall('GET', `/projects/${state.currentProjectId}`);
    const p = res.data;
    document.getElementById('projectName').textContent = p.name;
    document.getElementById('projectDesc').textContent = p.description || '暂无描述';
    document.getElementById('projectStatus').textContent = p.status;
  } catch (e) {
    console.error('Failed to load project:', e);
  }
}

// ── Documents ──────────────────────────────────────────────────────
async function loadDocuments() {
  try {
    const res = await apiCall('GET', `/projects/${state.currentProjectId}/documents`);
    state.documents = res.data || [];
    renderDocuments();
    updatePipelineStatus();
  } catch (e) {
    console.error('Failed to load documents:', e);
  }
}

function renderDocuments() {
  const list = document.getElementById('docList');
  document.getElementById('docCount').textContent = state.documents.length;

  if (!state.documents.length) {
    list.innerHTML = '<div class="empty-state">暂无文档，请添加或加载示例</div>';
    return;
  }

  const typeLabels = {
    meeting_minutes: '会议纪要',
    chat_record: '聊天记录',
    requirement_doc: '需求文档',
    other: '其他',
  };

  const typeIcons = {
    meeting_minutes: '📝',
    chat_record: '💬',
    requirement_doc: '📄',
    other: '📎',
  };

  list.innerHTML = state.documents.map(d => `
    <div class="doc-item" onclick="viewDocument(${d.id})">
      <span class="doc-icon">${typeIcons[d.doc_type] || '📎'}</span>
      <div class="doc-info">
        <h4>${escHtml(d.title)}</h4>
        <p>${escHtml(d.content_preview || '')}</p>
      </div>
      <span class="doc-type-badge">${typeLabels[d.doc_type] || d.doc_type}</span>
    </div>
  `).join('');
}

async function addDocument(title, content, docType) {
  try {
    await apiCall('POST', `/projects/${state.currentProjectId}/documents`, {
      title,
      content,
      doc_type: docType,
      source: 'manual',
    });
    await loadDocuments();
    updatePipelineStatus();
  } catch (e) {
    alert('添加文档失败: ' + e.message);
  }
}

// ── Analysis ───────────────────────────────────────────────────────
async function runAnalysis() {
  if (!state.documents.length) {
    alert('请先添加文档再进行分析');
    return;
  }

  const docIds = state.documents.map(d => d.id);
  showLoading('AI 正在分析需求文档...');

  try {
    const res = await apiCall('POST', `/projects/${state.currentProjectId}/analyze`, {
      document_ids: docIds,
    });

    state.analysisId = res.data.analysis_id;
    state.analysisResult = res.data.result;
    renderAnalysisResult(res.data.result);
    updatePipelineStatus();
    hideLoading();
  } catch (e) {
    hideLoading();
    alert('分析失败: ' + e.message);
  }
}

function renderAnalysisResult(result) {
  const container = document.getElementById('analysisResult');
  const empty = document.getElementById('analysisEmpty');
  container.classList.remove('hidden');
  empty.classList.add('hidden');

  document.getElementById('analysisSummary').textContent = result.summary || '分析完成';

  // Goals
  const goalsList = document.getElementById('goalsList');
  if (result.core_goals && result.core_goals.length) {
    goalsList.innerHTML = result.core_goals.map(g =>
      `<li><strong>${escHtml(g.priority)}:</strong> ${escHtml(g.description)}</li>`
    ).join('');
  } else {
    goalsList.innerHTML = '<li class="text-muted">未识别到明确目标</li>';
  }

  // Risks
  const risksList = document.getElementById('risksList');
  if (result.risk_points && result.risk_points.length) {
    risksList.innerHTML = result.risk_points.map(r =>
      `<li><strong>[${escHtml(r.severity)}]</strong> ${escHtml(r.risk)}${r.mitigation ? `<br><span class="text-muted">缓解: ${escHtml(r.mitigation)}</span>` : ''}</li>`
    ).join('');
  } else {
    risksList.innerHTML = '<li class="text-muted">未识别到风险点</li>';
  }

  // Missing info
  const missingList = document.getElementById('missingList');
  if (result.missing_info && result.missing_info.length) {
    missingList.innerHTML = result.missing_info.map(m =>
      `<li><strong>${escHtml(m.field)}:</strong> ${escHtml(m.description)}<br><span class="text-muted">💡 ${escHtml(m.suggested_question)}</span></li>`
    ).join('');
  } else {
    missingList.innerHTML = '<li class="text-muted">信息较完整</li>';
  }

  // Questions
  const questionsList = document.getElementById('questionsList');
  if (result.pending_questions && result.pending_questions.length) {
    questionsList.innerHTML = result.pending_questions.map(q =>
      `<li><strong>${escHtml(q.target)}:</strong> ${escHtml(q.question)}<br><span class="text-muted">原因: ${escHtml(q.reason)}</span></li>`
    ).join('');
  } else {
    questionsList.innerHTML = '<li class="text-muted">无待确认问题</li>';
  }

  // Clarification section
  const clarSection = document.getElementById('clarificationSection');
  if (result.needs_clarification && result.pending_questions && result.pending_questions.length) {
    clarSection.classList.remove('hidden');
    const form = document.getElementById('clarificationForm');
    form.innerHTML = result.pending_questions.map((q, i) => `
      <div class="clarification-question">
        <div class="q-text">${i + 1}. ${escHtml(q.question)}</div>
        <div class="q-reason">🎯 ${escHtml(q.target)} — ${escHtml(q.reason)}</div>
        <textarea data-idx="${i}" placeholder="请输入补充信息..."></textarea>
      </div>
    `).join('');
  } else {
    clarSection.classList.add('hidden');
  }
}

async function submitClarification() {
  const textareas = document.querySelectorAll('#clarificationForm textarea');
  const answers = [];
  const result = state.analysisResult;

  textareas.forEach(ta => {
    const idx = parseInt(ta.dataset.idx);
    const val = ta.value.trim();
    if (val && result.pending_questions && result.pending_questions[idx]) {
      answers.push({
        question: result.pending_questions[idx].question,
        answer: val,
      });
    }
  });

  if (!answers.length) {
    alert('请至少填写一条补充信息');
    return;
  }

  showLoading('正在处理补充信息...');
  try {
    await apiCall('POST', `/analyses/${state.analysisId}/clarify`, { answers });
    hideLoading();
    alert('补充信息已提交，可以继续生成 PRD');
    document.getElementById('clarificationSection').classList.add('hidden');
  } catch (e) {
    hideLoading();
    alert('提交失败: ' + e.message);
  }
}

// ── PRD ────────────────────────────────────────────────────────────
async function generatePRD() {
  if (!state.analysisId) {
    alert('请先运行需求分析');
    return;
  }

  showLoading('AI 正在生成 PRD...');
  try {
    const res = await apiCall('POST', `/projects/${state.currentProjectId}/prd`, {
      analysis_id: state.analysisId,
      project_id: state.currentProjectId,
    });

    state.prdId = res.data.prd_id;
    state.prdResult = res.data.result;
    renderPRD(res.data.result);
    updatePipelineStatus();
    hideLoading();
  } catch (e) {
    hideLoading();
    alert('PRD 生成失败: ' + e.message);
  }
}

function renderPRD(prd) {
  const container = document.getElementById('prdResult');
  const empty = document.getElementById('prdEmpty');
  container.classList.remove('hidden');
  empty.classList.add('hidden');

  document.getElementById('prdTitle').textContent = prd.title || 'PRD';
  document.getElementById('prdVersion').textContent = `v${prd.version || '1.0'}`;
  document.getElementById('prdBackground').textContent = prd.background || '';

  // Goals
  const goalsEl = document.getElementById('prdGoals');
  goalsEl.innerHTML = (prd.goals || []).map(g =>
    `<li>🎯 <strong>[${escHtml(g.priority)}]</strong> ${escHtml(g.description)}</li>`
  ).join('');

  // Scope
  document.getElementById('prdScopeIn').innerHTML = (prd.scope_in || []).map(s =>
    `<li>✅ ${escHtml(s)}</li>`
  ).join('');
  document.getElementById('prdScopeOut').innerHTML = (prd.scope_out || []).map(s =>
    `<li>❌ ${escHtml(s)}</li>`
  ).join('');

  // Functional requirements
  const frEl = document.getElementById('prdFunctionalReqs');
  frEl.innerHTML = (prd.functional_requirements || []).map(fr => `
    <div class="task-card">
      <div class="task-header">
        <span class="task-priority priority-${fr.priority}">${fr.priority}</span>
        <h4>${escHtml(fr.id)}: ${escHtml(fr.title)}</h4>
      </div>
      <p class="task-desc">${escHtml(fr.description)}</p>
    </div>
  `).join('');

  // Non-functional requirements
  const nfrEl = document.getElementById('prdNonFunctionalReqs');
  nfrEl.innerHTML = (prd.non_functional_requirements || []).map(nfr => `
    <div class="task-card">
      <div class="task-header">
        <h4>${escHtml(nfr.id)}: ${escHtml(nfr.title)}</h4>
      </div>
      <p class="task-desc">${escHtml(nfr.description)}${nfr.metric ? `<br><span class="text-muted">指标: ${escHtml(nfr.metric)}</span>` : ''}</p>
    </div>
  `).join('');

  // User stories
  const usEl = document.getElementById('prdUserStories');
  usEl.innerHTML = (prd.user_stories || []).map(us => `
    <div class="task-card">
      <h4>${escHtml(us.id)}</h4>
      <p class="task-desc">
        <strong>作为</strong> ${escHtml(us.as_a)}<br>
        <strong>想要</strong> ${escHtml(us.i_want)}<br>
        <strong>以便</strong> ${escHtml(us.so_that)}
      </p>
      ${us.acceptance_criteria && us.acceptance_criteria.length ? `
        <div class="sub-tasks">
          <h5>验收标准:</h5>
          ${us.acceptance_criteria.map(ac => `<div class="sub-task-item">${escHtml(ac)}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Risks
  document.getElementById('prdRisks').innerHTML = (prd.risks || []).map(r =>
    `<li>⚠️ <strong>[${escHtml(r.severity)}]</strong> ${escHtml(r.risk)}${r.mitigation ? ` — ${escHtml(r.mitigation)}` : ''}</li>`
  ).join('');

  // Open issues
  const issuesEl = document.getElementById('prdIssues');
  if (prd.open_issues && prd.open_issues.length) {
    issuesEl.innerHTML = prd.open_issues.map(i =>
      `<li>❓ ${escHtml(i)}</li>`
    ).join('');
  } else {
    issuesEl.innerHTML = '';
  }
}

// ── Task Breakdown ─────────────────────────────────────────────────
async function breakDownTasks() {
  if (!state.prdId) {
    alert('请先生成 PRD');
    return;
  }

  showLoading('AI 正在拆解研发任务...');
  try {
    const res = await apiCall('POST', `/projects/${state.currentProjectId}/tasks`, {
      prd_id: state.prdId,
      project_id: state.currentProjectId,
    });

    state.breakdownId = res.data.breakdown_id;
    state.taskResult = res.data.result;
    renderTaskBreakdown(res.data.result);
    updatePipelineStatus();
    hideLoading();
  } catch (e) {
    hideLoading();
    alert('任务拆解失败: ' + e.message);
  }
}

function renderTaskBreakdown(result) {
  const container = document.getElementById('taskResult');
  const empty = document.getElementById('taskEmpty');
  container.classList.remove('hidden');
  empty.classList.add('hidden');

  document.getElementById('taskSummary').textContent = result.summary || '';
  document.getElementById('taskTotalCount').textContent = (result.tasks || []).length;
  document.getElementById('taskTotalHours').textContent = result.total_estimated_hours || 0;

  // Milestones
  const milestonesEl = document.getElementById('milestonesList');
  if (result.milestones && result.milestones.length) {
    milestonesEl.innerHTML = result.milestones.map(m => `
      <div class="milestone-item">
        <div>
          <div class="m-name">${escHtml(m.name)}</div>
          <div class="m-desc">${escHtml(m.description)}${m.deadline ? ` — ${escHtml(m.deadline)}` : ''}</div>
        </div>
      </div>
    `).join('');
  } else {
    milestonesEl.innerHTML = '<div class="text-muted">暂无里程碑定义</div>';
  }

  // Tasks
  const tasksEl = document.getElementById('tasksList');
  tasksEl.innerHTML = (result.tasks || []).map(t => `
    <div class="task-card">
      <div class="task-header">
        <span class="task-priority priority-${t.priority}">${t.priority}</span>
        <h4>${escHtml(t.id)}: ${escHtml(t.title)}</h4>
      </div>
      <p class="task-desc">${escHtml(t.description)}</p>
      <div class="task-meta">
        ${t.estimated_hours ? `<span>⏱ ${t.estimated_hours}h</span>` : ''}
        ${t.phase ? `<span>📌 ${escHtml(t.phase)}</span>` : ''}
        ${t.dependencies && t.dependencies.length ? `<span>⬆ 依赖: ${t.dependencies.join(', ')}</span>` : ''}
      </div>
      ${t.sub_tasks && t.sub_tasks.length ? `
        <div class="sub-tasks">
          <h5>子任务:</h5>
          ${t.sub_tasks.map(st => `
            <div class="sub-task-item">
              ${escHtml(st.title)}${st.estimated_hours ? ` (${st.estimated_hours}h)` : ''}
              ${st.assignee_role ? `<span class="text-muted">— ${escHtml(st.assignee_role)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// ── Pipeline Status ────────────────────────────────────────────────
function updatePipelineStatus() {
  const steps = [
    { id: 'step1Status', done: state.documents.length > 0 },
    { id: 'step2Status', done: !!state.analysisResult },
    { id: 'step3Status', done: !!state.prdResult },
    { id: 'step4Status', done: !!state.taskResult },
  ];

  steps.forEach((s, i) => {
    const el = document.getElementById(s.id);
    const stepEl = document.querySelector(`.pipeline-step[data-step="${i + 1}"]`);
    if (s.done) {
      el.textContent = '✅ 已完成';
      stepEl.classList.add('completed');
      stepEl.classList.remove('active');
    } else {
      const prevDone = i === 0 || steps[i - 1].done;
      if (prevDone) {
        el.textContent = '🔵 待处理';
        stepEl.classList.add('active');
      } else {
        el.textContent = '⏳ 等待前置';
        stepEl.classList.remove('active');
      }
      stepEl.classList.remove('completed');
    }
  });
}

// ── Sample Data ────────────────────────────────────────────────────
const SAMPLE_DATA = {
  meeting: {
    title: '需求评审会议 - 用户权限系统升级',
    type: 'meeting_minutes',
    content: `# 需求评审会议纪要

日期: 2026-04-15
参会人员: 张三(产品), 李四(研发), 王五(测试), 赵六(架构)

## 议题
1. 用户权限系统升级方案评审
2. 细粒度权限控制需求讨论
3. 排期和资源评估

## 讨论内容

### 1. 权限系统现状
当前权限模型只支持角色级别控制，无法满足业务线自定义权限的需求。
部分业务线需要精确到按钮级别的权限控制。

### 2. 需求确认
- 需要支持自定义角色创建
- 需要支持资源级别的权限配置
- 需要兼容现有权限体系
- 权限变更需要有审计日志

### 3. 技术方案讨论
赵六提出可以采用 RBAC + ABAC 混合方案：
- RBAC 层保留现有角色权限模型
- ABAC 层新增属性级权限判断
- 通过策略引擎统一管理权限规则

### 4. 决策
- 确认采用 RBAC + ABAC 混合方案
- 第一期先实现 RBAC 增强 + 基础 ABAC 能力
- 需要预先定义好权限模型的数据结构

### 5. 待办事项
- 张三负责输出详细的权限配置界面原型 (周五前)
- 赵六负责输出 ABAC 策略引擎的技术方案 (下周三前)
- 李四负责评估 DB 改造工作量
- 王五准备测试方案和测试用例框架

## 遗留问题
1. 现有用户数据迁移方案未定
2. 权限缓存的失效策略需要进一步讨论
3. 三方系统的权限对接方案待确认`,
  },
  chat: {
    title: '企业微信讨论 - 报表导出功能',
    type: 'chat_record',
    content: `张三: @所有人 关于报表导出功能，大家看下这个需求
张三: 用户需要支持大数据量导出，目前单表最大可能到50万行
李四: 50万行直接导出Excel会有性能问题吧？
王五: 之前测试过，超过10万行 poi 就 OOM 了
李四: 可以考虑分批导出或者异步生成
赵六: 建议做成异步任务 + 文件服务的方式
赵六: 用户提交导出请求，后台异步生成，生成后通过消息通知用户下载
张三: 这个方案可以，用户侧体验怎么样？
李四: 前端加个导出任务中心，用户可以查看导出进度和下载历史文件
张三: 好的，那确认采用异步导出方案
张三: 支持格式方面呢？Excel 和 CSV 都要吗？
王五: CSV 对大数量支持更好，但用户习惯用 Excel
李四: 都要支持吧，让用户自己选
张三: +1，两种格式都支持
张三: @李四 开发周期大概多久？
李四: 后端异步任务 + 文件服务大概 5-7天，前端 3-4天
张三: 需要和现有的权限系统对接吗？
李四: 需要，导出的数据要按照用户权限过滤
赵六: 对，权限过滤必须在服务端做，不能依赖前端
张三: 收到，那我把这个需求的优先级提到 P1
张三: 大家还有什么问题？
王五: 导出的文件存储周期怎么定？
李四: 保留 7 天，过期自动清理吧
张三: OK，就按 7 天`,
  },
  requirement: {
    title: '消息中心 - 产品需求文档 v0.2',
    type: 'requirement_doc',
    content: `# 消息中心产品需求文档 v0.2

## 1. 项目背景
目前系统内的消息分散在各个模块，用户需要登录不同页面查看不同消息。
为提升用户体验，需要建立统一的消息中心。

## 2. 目标
- 建设统一消息中心，聚合所有类型的系统消息
- 支持消息的实时推送和已读/未读管理
- 提供消息分类和筛选功能

## 3. 功能需求

### FR-001: 消息聚合
- 聚合系统内所有消息类型：审批通知、任务提醒、系统公告、@我的消息
- 支持按类型筛选和查看
- 支持消息搜索

### FR-002: 实时推送
- 支持 WebSocket 实时推送新消息
- 浏览器标签页显示未读消息数
- 支持声音提醒

### FR-003: 消息管理
- 支持标记已读/未读
- 支持一键全部已读
- 支持批量删除消息
- 消息列表支持分页加载

### FR-004: 消息设置
- 用户可配置各类型消息的推送方式
- 支持免打扰时段设置

## 4. 非功能需求
- NFR-001: 消息推送延迟不超过 3 秒
- NFR-002: 支持 10 万并发用户在线
- NFR-003: 消息保存周期 90 天
- NFR-004: 页面加载时间不超过 2 秒

## 5. 约束条件
- 必须与现有用户权限系统集成
- 消息数据需要支持冷热分离存储
- 需要兼容 Chrome、Firefox、Safari

## 6. 验收标准
- 用户可以在消息中心查看到所有类型的消息
- 实时推送延迟满足 NFR-001
- 消息已读/未读状态同步延迟 < 1 秒
- 可对每种消息类型独立配置推送方式`,
  },
};

function loadSample(type) {
  const data = SAMPLE_DATA[type];
  if (!data) return;
  document.getElementById('docType').value = data.type;
  document.getElementById('docTitle').value = data.title;
  document.getElementById('docContent').value = data.content;
  document.getElementById('docForm').classList.remove('hidden');
}

// ── Tab Switching ──────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ── Screen Management ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Utility ────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Event Bindings ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

  // --- Welcome / New Project ---
  document.getElementById('btnStartNew').addEventListener('click', () => {
    document.getElementById('btnNewProject').click();
  });

  document.getElementById('btnNewProject').addEventListener('click', async () => {
    const name = prompt('请输入项目名称:', '新项目');
    if (!name || !name.trim()) return;
    showLoading('正在创建项目...');
    try {
      await apiCall('POST', '/projects', { name: name.trim(), description: '' });
      await loadProjects();
      // Switch to the newly created project (first in list)
      if (state.projects.length > 0) {
        await switchProject(state.projects[0].id);
      }
      hideLoading();
    } catch (e) {
      hideLoading();
      alert('创建项目失败: ' + e.message);
    }
  });

  // --- Documents ---
  document.getElementById('btnAddDoc').addEventListener('click', () => {
    const form = document.getElementById('docForm');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('docTitle').focus();
    }
  });

  document.getElementById('btnCancelDoc').addEventListener('click', () => {
    document.getElementById('docForm').classList.add('hidden');
    document.getElementById('docTitle').value = '';
    document.getElementById('docContent').value = '';
  });

  document.getElementById('btnSaveDoc').addEventListener('click', async () => {
    const title = document.getElementById('docTitle').value.trim();
    const content = document.getElementById('docContent').value.trim();
    const docType = document.getElementById('docType').value;

    if (!title) { alert('请输入文档标题'); return; }
    if (!content) { alert('请输入文档内容'); return; }

    await addDocument(title, content, docType);
    document.getElementById('docTitle').value = '';
    document.getElementById('docContent').value = '';
    document.getElementById('docForm').classList.add('hidden');
  });

  // --- Sample Data ---
  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      loadSample(btn.dataset.sample);
    });
  });

  // --- Analysis ---
  document.getElementById('btnRunAnalysis').addEventListener('click', runAnalysis);
  document.getElementById('btnSubmitClarification').addEventListener('click', submitClarification);

  // --- PRD ---
  document.getElementById('btnGeneratePRD').addEventListener('click', generatePRD);

  // --- Tasks ---
  document.getElementById('btnBreakTasks').addEventListener('click', breakDownTasks);

  // --- Tabs ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // --- LLM Config ---
  document.getElementById('btnSaveConfig').addEventListener('click', async () => {
    const provider = document.getElementById('llmProvider').value;
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelInput').value.trim();

    const config = { provider };
    if (apiKey) config.api_key = apiKey;
    if (model) config.model = model;

    showLoading('正在保存配置...');
    try {
      await apiCall('POST', '/configure', config);
      const statusEl = document.getElementById('configStatus');
      statusEl.textContent = '✅ 配置已保存';
      statusEl.style.color = '#22c55e';
      hideLoading();
    } catch (e) {
      hideLoading();
      const statusEl = document.getElementById('configStatus');
      statusEl.textContent = '❌ 配置失败: ' + e.message;
      statusEl.style.color = '#ef4444';
    }
  });

  // --- Load initial data ---
  loadProjects();

  // --- Keyboard shortcut: Ctrl+Enter to save doc ---
  document.getElementById('docContent').addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      document.getElementById('btnSaveDoc').click();
    }
  });
});

// --- Make functions globally accessible for onclick handlers ---
window.switchProject = switchProject;
window.viewDocument = function(id) {
  // Show document detail
  const doc = state.documents.find(d => d.id === id);
  if (doc) {
    alert(`文档: ${doc.title}\n\n类型: ${doc.doc_type}\n\n内容预览: ${doc.content_preview || '(无)'}`);
  }
};
window.loadSample = loadSample;
