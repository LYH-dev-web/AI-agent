/**
 * Core Agent — orchestrates: ingest → analyze → PRD → task breakdown.
 */

import { parseDocument, DOC_TYPES } from './document-parser.js';
import { analyzeDocuments } from './analyzer.js';
import { generatePRD } from './prd-generator.js';
import { breakDownTasks } from './task-breaker.js';
import { readStore, writeStore } from '../store.js';

export class RequirementAgent {
  // ── Project Management ──────────────────────────────────────────

  createProject(name, description = '') {
    const store = readStore();
    const now = new Date().toISOString();
    const project = {
      id: store.nextId++,
      name,
      description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    store.projects.push(project);
    writeStore(store);
    return project;
  }

  getProject(id) {
    return readStore().projects.find(p => p.id === id) || null;
  }

  listProjects() {
    return readStore().projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  // ── Document Management ─────────────────────────────────────────

  addDocument(projectId, title, content, docType = 'other', source = 'manual') {
    const store = readStore();
    if (!store.projects.find(p => p.id === projectId)) return null;

    // Auto-detect doc type
    if (docType === 'other' || docType === DOC_TYPES.OTHER) {
      const detected = detectDocType(content);
      if (detected) docType = detected;
    }

    const now = new Date().toISOString();
    const doc = {
      id: store.nextId++,
      projectId,
      title,
      content,
      docType,
      source,
      createdAt: now,
    };
    store.documents.push(doc);
    writeStore(store);

    const parsed = parseDocument(title, content, docType);
    return { id: doc.id, title, docType, parsed };
  }

  getDocument(id) {
    const store = readStore();
    const doc = store.documents.find(d => d.id === id);
    if (!doc) return null;
    return {
      ...doc,
      content_preview: doc.content.slice(0, 200),
    };
  }

  listDocuments(projectId) {
    return readStore().documents
      .filter(d => d.projectId === projectId)
      .map(d => ({
        id: d.id,
        projectId: d.projectId,
        title: d.title,
        content_preview: d.content.slice(0, 200),
        docType: d.docType,
        source: d.source,
        createdAt: d.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ── Analysis Pipeline ───────────────────────────────────────────

  async analyze(projectId, documentIds) {
    const store = readStore();
    const docs = store.documents.filter(d => documentIds.includes(d.id) && d.projectId === projectId);
    if (docs.length === 0) return { error: 'No valid documents found', status: 'failed' };

    const now = new Date().toISOString();
    const analysis = {
      id: store.nextId++,
      projectId,
      documentIds,
      status: 'processing',
      result: null,
      createdAt: now,
    };
    store.analyses.push(analysis);
    writeStore(store);

    try {
      const result = await analyzeDocuments(docs);
      analysis.status = 'completed';
      analysis.result = result;
    } catch (err) {
      console.error('[Core] Analysis failed:', err);
      analysis.status = 'failed';
    }

    // Update store
    const idx = store.analyses.findIndex(a => a.id === analysis.id);
    store.analyses[idx] = analysis;
    writeStore(store);

    return { analysis_id: analysis.id, result: analysis.result, needs_clarification: analysis.result?.needs_clarification };
  }

  getAnalysis(id) {
    const store = readStore();
    const a = store.analyses.find(a => a.id === id);
    if (!a) return null;
    return { ...a, result_json: a.result ? JSON.stringify(a.result) : null };
  }

  getClarificationQuestions(analysisId) {
    const store = readStore();
    const a = store.analyses.find(a => a.id === analysisId);
    return a?.result?.pending_questions || [];
  }

  submitClarification(analysisId, answers) {
    const store = readStore();
    const a = store.analyses.find(a => a.id === analysisId);
    if (!a) return { error: 'Analysis not found' };

    a.result.clarification_answers = answers;
    a.result.needs_clarification = false;
    writeStore(store);

    return { analysis_id: analysisId, status: 'clarified', message: `已收到 ${answers.length} 条补充信息，可以继续生成 PRD` };
  }

  // ── PRD Generation ──────────────────────────────────────────────

  async generatePRD(projectId, analysisId) {
    const store = readStore();
    const project = store.projects.find(p => p.id === projectId);
    const analysis = store.analyses.find(a => a.id === analysisId);
    if (!project || !analysis) return { error: 'Project or analysis not found' };
    if (!analysis.result) return { error: 'Analysis result is empty' };

    try {
      const prdResult = await generatePRD(analysis.result, project.name, project.description || '');
      const now = new Date().toISOString();
      const prd = { id: store.nextId++, projectId, analysisId, result: prdResult, version: '1.0', createdAt: now };
      store.prds.push(prd);
      writeStore(store);
      return { prd_id: prd.id, result: prdResult };
    } catch (err) {
      console.error('[Core] PRD generation failed:', err);
      return { error: err.message };
    }
  }

  getPRD(id) {
    const store = readStore();
    const prd = store.prds.find(p => p.id === id);
    if (!prd) return null;
    return { ...prd, result_json: prd.result ? JSON.stringify(prd.result) : null };
  }

  // ── Task Breakdown ──────────────────────────────────────────────

  async breakDownTasks(projectId, prdId) {
    const store = readStore();
    const project = store.projects.find(p => p.id === projectId);
    const prd = store.prds.find(p => p.id === prdId);
    if (!project || !prd) return { error: 'Project or PRD not found' };
    if (!prd.result) return { error: 'PRD result is empty' };

    try {
      const taskResult = await breakDownTasks(prd.result, project.name);
      const now = new Date().toISOString();
      const tb = { id: store.nextId++, projectId, prdId, result: taskResult, createdAt: now };
      store.taskBreakdowns.push(tb);
      writeStore(store);
      return { breakdown_id: tb.id, result: taskResult };
    } catch (err) {
      console.error('[Core] Task breakdown failed:', err);
      return { error: err.message };
    }
  }

  getTaskBreakdown(id) {
    const store = readStore();
    const tb = store.taskBreakdowns.find(t => t.id === id);
    if (!tb) return null;
    return { ...tb, result_json: tb.result ? JSON.stringify(tb.result) : null };
  }
}

function detectDocType(content) {
  const lower = content.toLowerCase();
  if (/会议|meeting|minutes|agenda|议题|参会|attendee|讨论/i.test(lower)) return DOC_TYPES.MEETING_MINUTES;
  if (/@|说：|说:|chat|聊天|聊天记录/i.test(lower)) return DOC_TYPES.CHAT_RECORD;
  if (/需求|requirement|功能|feature|spec|用户故事|验收|acceptance/i.test(lower)) return DOC_TYPES.REQUIREMENT_DOC;
  return null;
}

// Singleton
let _agent = null;
export function getAgent() {
  if (!_agent) _agent = new RequirementAgent();
  return _agent;
}
