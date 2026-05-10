/**
 * Task breaker — decomposes PRD into executable R&D tasks.
 */

import { chat } from './llm-client.js';

const TASK_SYSTEM_PROMPT = `你是一个专业的研发任务拆分专家。请根据PRD内容，将需求拆分为可执行的任务。

返回严格的JSON格式，包含以下字段：
{
  "project_name": "项目名称",
  "summary": "整体任务拆分的描述和说明",
  "total_estimated_hours": 0,
  "milestones": [{"name": "M1-里程碑名", "description": "描述"}],
  "tasks": [
    {
      "id": "T-001",
      "title": "任务标题",
      "description": "详细描述",
      "priority": "P0/P1/P2/P3",
      "status": "todo",
      "estimated_hours": 8,
      "phase": "需求/设计/开发/测试/部署",
      "dependencies": [],
      "sub_tasks": [
        {"id": "ST-001", "title": "子任务标题", "description": "描述", "estimated_hours": 4, "assignee_role": "研发工程师", "dependencies": []}
      ]
    }
  ]
}

要求：
1. 任务拆分遵循"可交付、可验收"原则
2. 每个任务最好在 1-3 天内完成
3. 明确任务间的依赖关系
4. 按开发阶段组织`;

export async function breakDownTasks(prd, projectName) {
  try {
    const prdJSON = JSON.stringify({
      title: prd.title,
      background: prd.background,
      goals: prd.goals,
      functional_requirements: (prd.functional_requirements || []).map(fr => ({
        id: fr.id, title: fr.title, description: fr.description, priority: fr.priority,
      })),
      user_stories: (prd.user_stories || []).map(us => ({
        id: us.id, as_a: us.as_a, i_want: us.i_want, acceptance_criteria: us.acceptance_criteria,
      })),
      risks: (prd.risks || []).map(r => ({ risk: r.risk, severity: r.severity })),
    }, null, 2);

    const userPrompt = `项目名称: ${projectName}\n\nPRD内容:\n${prdJSON}\n\n请将以上PRD拆分为可执行的研发任务和子任务（JSON格式）。`;
    const response = await chat(TASK_SYSTEM_PROMPT, userPrompt, 0.3);
    const parsed = parseJSONResponse(response);
    if (parsed) return parsed;
    return fallbackBreakdown(prd, projectName);
  } catch (err) {
    console.error('[TaskBreaker] Breakdown failed:', err.message);
    return fallbackBreakdown(prd, projectName);
  }
}

function parseJSONResponse(response) {
  try {
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(response.slice(start, end + 1));
    return JSON.parse(response);
  } catch {
    return null;
  }
}

function fallbackBreakdown(prd, projectName) {
  const tasks = [];
  let totalHours = 0;
  let taskCounter = 0;
  let subCounter = 0;

  for (const req of (prd.functional_requirements || [])) {
    taskCounter++;
    const tid = `T-${String(taskCounter).padStart(3, '0')}`;
    const est = 16;
    totalHours += est;

    const subTasks = [
      { id: `ST-${String(++subCounter).padStart(3, '0')}`, title: '设计评审', description: `完成${req.title}的技术方案设计和评审`, estimated_hours: 4, assignee_role: '技术负责人', dependencies: [] },
      { id: `ST-${String(++subCounter).padStart(3, '0')}`, title: '编码实现', description: `实现${req.title}`, estimated_hours: 8, assignee_role: '研发工程师', dependencies: [] },
      { id: `ST-${String(++subCounter).padStart(3, '0')}`, title: '自测联调', description: `完成${req.title}的自测和联调`, estimated_hours: 4, assignee_role: '研发工程师', dependencies: [] },
    ];

    tasks.push({
      id: tid,
      title: req.title,
      description: req.description,
      priority: req.priority || 'P2',
      status: 'todo',
      estimated_hours: est,
      phase: '开发',
      dependencies: taskCounter === 1 ? [] : [`T-${String(taskCounter - 1).padStart(3, '0')}`],
      sub_tasks: subTasks,
    });
  }

  taskCounter++;
  tasks.push({
    id: `T-${String(taskCounter).padStart(3, '0')}`,
    title: '集成测试与验收',
    description: '完成所有功能的集成测试、回归测试和验收测试',
    priority: 'P1',
    status: 'todo',
    estimated_hours: 24,
    phase: '测试',
    dependencies: [`T-${String(taskCounter - 1).padStart(3, '0')}`],
    sub_tasks: [
      { id: `ST-${String(++subCounter).padStart(3, '0')}`, title: '测试用例编写', description: '编写集成测试用例', estimated_hours: 8, assignee_role: '测试工程师', dependencies: [] },
      { id: `ST-${String(++subCounter).padStart(3, '0')}`, title: '集成测试执行', description: '执行集成测试并记录问题', estimated_hours: 12, assignee_role: '测试工程师', dependencies: [] },
      { id: `ST-${String(++subCounter).padStart(3, '0')}`, title: '验收测试', description: '与PM一起完成验收测试', estimated_hours: 4, assignee_role: '测试工程师', dependencies: [] },
    ],
  });
  totalHours += 24;

  return {
    project_name: projectName,
    summary: `已将PRD拆分为 ${taskCounter} 个任务，预估总工时 ${totalHours} 小时。涵盖设计、开发、测试全流程。`,
    total_estimated_hours: totalHours,
    milestones: [
      { name: 'M1-需求确认', description: '完成需求澄清和 PRD 评审' },
      { name: 'M2-技术设计', description: '完成技术方案设计和评审' },
      { name: 'M3-开发完成', description: '完成所有功能开发' },
      { name: 'M4-测试验收', description: '完成测试并交付' },
    ],
    tasks,
  };
}
