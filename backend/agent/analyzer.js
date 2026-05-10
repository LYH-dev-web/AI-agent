/**
 * Requirement analyzer — extracts goals, missing info, risks, and questions.
 */

import { chat } from './llm-client.js';
import { parseDocument } from './document-parser.js';

const ANALYSIS_SYSTEM_PROMPT = `你是专业的研发需求分析(analysis)助手。你的任务是从产品需求文档、会议纪要、聊天记录等材料中提取结构化信息。

请返回严格的JSON格式，包含以下字段：
{
  "summary": "整体分析总结",
  "core_goals": [{"description": "目标描述", "priority": "high/medium/low"}],
  "missing_info": [{"field": "缺失信息字段", "description": "为什么需要", "suggested_question": "建议提问"}],
  "risk_points": [{"risk": "风险描述", "severity": "high/medium/low", "mitigation": "缓解措施"}],
  "pending_questions": [{"question": "问题", "target": "目标角色", "reason": "为何重要"}],
  "needs_clarification": true/false
}

注意：
1. 分析要具体，不要泛泛而谈
2. 如果信息不足，needs_clarification 设为 true
3. 识别出真正的风险点
4. 核心目标要分层级`;

export async function analyzeDocuments(documents) {
  let combinedText = '';

  for (const doc of documents) {
    const parsed = parseDocument(doc.title, doc.content, doc.docType || doc.doc_type);
    combinedText += `\n\n## Document: ${doc.title}\n\n${doc.content}\n`;
    combinedText += `\n--- Parsed: ${JSON.stringify(parsed).slice(0, 500)}\n`;
  }

  try {
    const userPrompt = `请分析以下研发需求相关文档，提取结构化信息。\n\n文档内容：\n${combinedText.slice(0, 15000)}\n\n请返回 JSON 格式的分析结果。`;
    const response = await chat(ANALYSIS_SYSTEM_PROMPT, userPrompt, 0.3);
    return parseJSONResponse(response) || fallbackAnalysis(documents, combinedText);
  } catch (err) {
    console.error('[Analyzer] LLM analysis failed:', err.message);
    return fallbackAnalysis(documents, combinedText);
  }
}

function parseJSONResponse(response) {
  try {
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(response.slice(start, end + 1));
    }
    return JSON.parse(response);
  } catch {
    return null;
  }
}

function fallbackAnalysis(docs, rawText) {
  const goals = [];
  const risks = [];
  const missing = [];
  const questions = [];
  let totalLen = rawText.length;

  const allParticipants = new Set();
  const allReqs = new Set();

  for (const doc of docs) {
    const parsed = parseDocument(doc.title, doc.content, doc.docType || doc.doc_type);
    if (parsed.requirementsMentioned) parsed.requirementsMentioned.forEach(r => allReqs.add(r));
    if (parsed.participants) parsed.participants.forEach(p => allParticipants.add(p));
  }

  if (allReqs.size > 0) {
    let count = 0;
    for (const req of allReqs) {
      if (count >= 3) break;
      goals.push({ description: req.slice(0, 100), priority: 'high' });
      count++;
    }
  } else {
    goals.push({ description: '根据文档内容提炼的核心目标', priority: 'high' });
  }

  if (allParticipants.size === 0) {
    missing.push({ field: '相关人员', description: '未识别到项目参与人', suggested_question: '该需求的负责人和相关干系人是谁？' });
  }

  if (totalLen < 200) {
    missing.push({ field: '需求细节', description: '文档内容过短，缺少详细需求描述', suggested_question: '请补充详细的需求描述和使用场景？' });
  }

  risks.push({ risk: '需求描述不够具体，缺少明确的功能点清单', severity: 'high', mitigation: '建议与需求方逐条对齐功能清单' });
  risks.push({ risk: '需求可能存在范围蔓延风险', severity: 'medium', mitigation: '建议在 PRD 中定义明确的 In/Out Scope' });

  questions.push({ question: '该需求的优先级和期望上线时间是什么？', target: '产品经理', reason: '影响研发排期和资源分配决策' });
  questions.push({ question: '是否有对其他团队或系统的依赖？', target: '技术负责人', reason: '影响技术方案设计和开发计划' });
  questions.push({ question: '需求的验收标准和成功指标是什么？', target: '产品经理', reason: '明确可量化的验收标准以避免交付偏差' });

  const needsInfo = missing.length > 0 || totalLen < 500;

  return {
    summary: `分析了 ${docs.length} 个文档，共 ${totalLen} 字内容。识别到 ${goals.length} 个核心目标、${risks.length} 个风险点、${missing.length} 项信息缺失。${needsInfo ? '需要进一步澄清需求细节。' : '信息较为完整。'}`,
    core_goals: goals,
    missing_info: missing,
    risk_points: risks,
    pending_questions: questions,
    needs_clarification: needsInfo,
  };
}
