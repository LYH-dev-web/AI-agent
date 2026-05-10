/**
 * PRD Generator — transforms analysis results into structured PRD documents.
 */

import { chat } from './llm-client.js';

const PRD_SYSTEM_PROMPT = `你是一个专业的产品需求文档（PRD）撰写专家。请根据分析结果生成结构化的PRD。

返回严格的JSON格式，包含以下字段：
{
  "title": "PRD标题",
  "version": "1.0",
  "background": "背景和上下文描述",
  "goals": [{"description": "目标", "priority": "high/medium/low"}],
  "scope_in": ["范围内功能1"],
  "scope_out": ["范围外功能1"],
  "functional_requirements": [{"id": "FR-001", "title": "标题", "description": "详细描述", "priority": "P1"}],
  "non_functional_requirements": [{"id": "NFR-001", "title": "标题", "description": "详细描述", "metric": "指标"}],
  "user_stories": [{"id": "US-001", "as_a": "角色", "i_want": "功能", "so_that": "价值", "acceptance_criteria": ["AC1"]}],
  "risks": [{"risk": "风险描述", "severity": "high/medium/low", "mitigation": "缓解措施"}],
  "open_issues": ["待解决问题1"]
}`;

export async function generatePRD(analysis, projectName, projectDescription = '') {
  try {
    const analysisJSON = JSON.stringify({
      summary: analysis.summary,
      core_goals: analysis.core_goals,
      risk_points: analysis.risk_points,
      missing_info: analysis.missing_info,
    }, null, 2);

    const userPrompt = `项目名称: ${projectName}\n项目描述: ${projectDescription}\n\n分析结果:\n${analysisJSON}\n\n请基于以上分析结果，生成一份完整的结构化PRD文档(JSON格式)。`;
    const response = await chat(PRD_SYSTEM_PROMPT, userPrompt, 0.4);
    const parsed = parseJSONResponse(response);
    if (parsed) return parsed;
    return fallbackPRD(analysis, projectName);
  } catch (err) {
    console.error('[PRD] Generation failed:', err.message);
    return fallbackPRD(analysis, projectName);
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

function fallbackPRD(analysis, projectName) {
  const funcReqs = (analysis.core_goals || []).map((goal, i) => ({
    id: `FR-${String(i + 1).padStart(3, '0')}`,
    title: goal.description.slice(0, 50),
    description: `实现目标：${goal.description}。具体细节需进一步确认。`,
    priority: goal.priority === 'high' ? 'P1' : 'P2',
  }));

  if (funcReqs.length === 0) {
    funcReqs.push({ id: 'FR-001', title: '核心功能实现', description: '根据需求实现核心业务功能。', priority: 'P1' });
  }

  const userStories = funcReqs.slice(0, 5).map((req, i) => ({
    id: `US-${String(i + 1).padStart(3, '0')}`,
    as_a: '用户',
    i_want: req.title,
    so_that: '完成业务目标',
    acceptance_criteria: [`${req.title} 功能可正常使用`, '覆盖主要业务场景', '异常情况有合理处理'],
  }));

  return {
    title: `${projectName} - 产品需求文档`,
    version: '1.0',
    background: `项目 ${projectName} 的需求文档。${(analysis.summary || '').slice(0, 200)}`,
    goals: analysis.core_goals || [],
    scope_in: (analysis.core_goals || []).map(g => g.description.slice(0, 80)),
    scope_out: ['待与产品方确认'],
    functional_requirements: funcReqs,
    non_functional_requirements: [
      { id: 'NFR-001', title: '系统可用性', description: '系统需保持高可用', metric: '可用性 > 99.9%' },
      { id: 'NFR-002', title: '响应性能', description: '页面响应需在可接受范围内', metric: '核心接口 < 200ms' },
    ],
    user_stories: userStories,
    risks: analysis.risk_points || [],
    open_issues: (analysis.pending_questions || []).map(q => q.question).slice(0, 5),
  };
}
