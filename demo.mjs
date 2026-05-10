/**
 * 完整演示脚本 — Requirement AI Agent 全流程
 * Run: node demo.mjs
 */

const BASE = 'http://localhost:8000';

async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

function hr(title) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(62));
}

function print(label, obj) {
  console.log(`\n📌 ${label}:`);
  console.log(JSON.stringify(obj, null, 2).slice(0, 600));
  if (JSON.stringify(obj).length > 600) console.log('  ...(截断)');
}

// ═══════════════════════════════════════════════════════════════
async function main() {
  console.clear();
  console.log('━'.repeat(62));
  console.log('  🧠 Requirement AI Agent — 完整功能演示');
  console.log('  「需求不清、沟通反复、任务拆解慢 → AI 自动处理」');
  console.log('━'.repeat(62));

  // ── Step 1: 创建项目 ─────────────────────────────────────────
  hr('Step 1/7: 创建项目');
  const project = await api('POST', '/api/projects', {
    name: '用户权限系统升级',
    description: '从角色级权限 → RBAC+ABAC 混合细粒度权限控制',
  });
  const projectId = project.data.id;
  print('项目已创建', project.data);

  // ── Step 2: 添加会议纪要 ─────────────────────────────────────
  hr('Step 2/7: 添加会议纪要 (自动解析参会人/决策/待办)');
  const meeting = await api('POST', `/api/projects/${projectId}/documents`, {
    title: '需求评审会议 - 权限系统升级',
    doc_type: 'meeting_minutes',
    content: `# 需求评审会议纪要

日期: 2026-04-15
参会人员: 张三(产品), 李四(研发), 王五(测试), 赵六(架构)

## 议题
1. 用户权限系统升级方案评审
2. 细粒度权限控制需求讨论
3. 排期和资源评估

## 讨论内容
### 权限系统现状
当前权限模型只支持角色级别控制，无法满足业务线自定义权限的需求。
部分业务线需要精确到按钮级别的权限控制。

### 需求确认
- 需要支持自定义角色创建
- 需要支持资源级别的权限配置
- 需要兼容现有权限体系
- 权限变更需要有审计日志

### 技术方案
赵六提出可以采用 RBAC + ABAC 混合方案：
RBAC 层保留现有角色权限模型，ABAC 层新增属性级权限判断，
通过策略引擎统一管理权限规则。

### 决策
- 确认采用 RBAC + ABAC 混合方案
- 第一期先实现 RBAC 增强 + 基础 ABAC 能力
- 需要预先定义好权限模型的数据结构

### 待办事项
- 张三: 输出详细的权限配置界面原型 (周五前)
- 赵六: 输出 ABAC 策略引擎的技术方案 (下周三前)
- 李四: 评估 DB 改造工作量

## 遗留问题
1. 现有用户数据迁移方案未定
2. 权限缓存的失效策略需要进一步讨论`,
  });
  print('文档已添加 | 解析结果', meeting.data.parsed);

  // ── Step 3: 添加需求文档 ─────────────────────────────────────
  hr('Step 3/7: 添加需求文档 (自动提取功能需求/验收标准)');
  const reqDoc = await api('POST', `/api/projects/${projectId}/documents`, {
    title: '权限系统升级 - 产品需求 v1.0',
    doc_type: 'requirement_doc',
    content: `# 用户权限系统升级需求文档

## 1. 项目背景
当前权限系统仅支持角色级控制，业务线需要按钮/API 级别的细粒度权限。

## 2. 目标
- 建设细粒度权限控制系统，支持业务线自定义配置
- 权限变更实时生效
- 完整审计追溯

## 3. 功能需求

### FR-001: 自定义角色管理
支持创建自定义角色，配置不同权限组合，包括菜单权限、按钮权限和 API 权限

### FR-002: 资源级权限配置
支持按菜单、按钮、API 等资源粒度配置权限，支持批量授权和回收

### FR-003: 审计日志
记录所有权限变更操作，包括创建、修改、删除、授权，支持按时间/操作人/资源筛选

### FR-004: 权限模板
提供权限模板快速配置，减少重复配置工作

## 4. 非功能需求
- NFR-001: 权限变更实时生效，端到端延迟不超过 3 秒
- NFR-002: 支持 10 万级并发用户
- NFR-003: 权限校验接口 P99 < 50ms

## 5. 约束条件
- 必须兼容现有权限体系，不能影响线上用户
- 权限数据需要支持冷热分离存储

## 6. 验收标准
- 用户可创建自定义角色并在 3 秒内生效
- 管理员可配置按钮/API 级别权限
- 所有权限变更可审计追溯`,
  });
  print('文档已添加 | 解析结果', reqDoc.data.parsed);

  // ── Step 4: 添加聊天记录 ─────────────────────────────────────
  hr('Step 4/7: 添加聊天记录 (自动提取讨论/共识/待办)');
  const chatDoc = await api('POST', `/api/projects/${projectId}/documents`, {
    title: '企微讨论 - 权限系统技术细节',
    doc_type: 'chat_record',
    content: `张三: @所有人 关于权限系统升级，大家看下技术方案
李四: 看了赵六的 RBAC+ABAC 方案，整体可行
王五: 我担心权限缓存这块，如果策略复杂，缓存命中率可能很低
赵六: 可以用多级缓存，先查角色权限再查属性权限
李四: 性能方面呢？每次请求都要做两次判断的话
赵六: 可以预计算，在登录时生成用户的完整权限快照
张三: 这样权限变更是不是就不实时了？
赵六: 需要加个权限刷新机制，管理员修改权限后主动推送刷新
李四: WebSocket 推送方案？
赵六: 对，push + 客户端轮询兜底
张三: OK，这个方案可以。@李四 数据迁移方案什么时候出？
李四: 预计下周三，需要先确认支持哪些权限类型
张三: 先把第一期需要的列出来，后期可扩展就行`,
  });
  print('文档已添加 | 解析结果', chatDoc.data.parsed);

  // ── Step 5: 运行需求分析 ─────────────────────────────────────
  hr('Step 5/7: 运行需求分析 (提炼目标/风险/缺失信息/待确认问题)');
  const analysis = await api('POST', `/api/projects/${projectId}/analyze`, {
    document_ids: [2, 3, 4],
  });
  const analysisId = analysis.data.analysis_id;
  print('分析结果', analysis.data.result);
  console.log(`\n  ⚠️  needs_clarification: ${analysis.data.result.needs_clarification}`);

  // ── Step 6: 生成 PRD ─────────────────────────────────────────
  hr('Step 6/7: 生成结构化 PRD');
  const prd = await api('POST', `/api/projects/${projectId}/prd`, {
    analysis_id: analysisId,
    project_id: projectId,
  });
  const prdId = prd.data.prd_id;
  print('PRD 已生成', {
    title: prd.data.result.title,
    version: prd.data.result.version,
    background: prd.data.result.background,
    goals: prd.data.result.goals,
    functional_count: prd.data.result.functional_requirements?.length,
    user_stories_count: prd.data.result.user_stories?.length,
    open_issues: prd.data.result.open_issues,
  });

  // ── Step 7: 拆解研发任务 ─────────────────────────────────────
  hr('Step 7/7: 拆解研发任务 (Milestone + 任务 + 子任务)');
  const tasks = await api('POST', `/api/projects/${projectId}/tasks`, {
    prd_id: prdId,
    project_id: projectId,
  });
  const t = tasks.data.result;
  print('任务拆解结果', {
    summary: t.summary,
    total_hours: t.total_estimated_hours,
    milestones: t.milestones,
    task_count: t.tasks?.length,
    tasks: t.tasks?.map(task => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      hours: task.estimated_hours,
      phase: task.phase,
      dependencies: task.dependencies,
      sub_tasks: task.sub_tasks?.map(st => `${st.title} (${st.estimated_hours}h / ${st.assignee_role})`),
    })),
  });

  // ── Done ──────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(62));
  console.log('  ✅ 全流程演示完成');
  console.log('═'.repeat(62));
  console.log(`
  管道流程:
    📄 3 份文档 ──▶ 🔍 分析 ──▶ 📋 PRD ──▶ ✅ 研发任务

  时间压缩:
    原来多人反复确认 → 小时级
    Agent 自动处理   → 分钟级

  打开浏览器访问:  http://localhost:8000
  查看 API 文档: 运行 node demo.mjs 即可复现
  `);
}

main().catch(err => {
  console.error('演示失败:', err.message);
  process.exit(1);
});
