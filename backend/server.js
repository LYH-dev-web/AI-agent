import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAgent } from './agent/core.js';
import { configureLLM, getLLMConfig } from './agent/llm-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Try auto-configure LLM ───────────────────────────────────────
configureLLM();
const llmConfig = getLLMConfig();
if (llmConfig.apiKey) {
  console.log(`[Server] LLM configured: ${llmConfig.provider}/${llmConfig.model}`);
} else {
  console.log('[Server] No API key — running in template fallback mode');
}

// ── Health ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'requirement-agent' });
});

// ── LLM Configuration ────────────────────────────────────────────
app.post('/api/configure', (req, res) => {
  try {
    configureLLM(req.body);
    res.json({ success: true, message: 'LLM configured successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Projects ──────────────────────────────────────────────────────
app.post('/api/projects', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  const agent = getAgent();
  const project = agent.createProject(name, description);
  res.json({ success: true, data: project });
});

app.get('/api/projects', (req, res) => {
  const agent = getAgent();
  res.json({ success: true, data: agent.listProjects() });
});

app.get('/api/projects/:id', (req, res) => {
  const agent = getAgent();
  const project = agent.getProject(parseInt(req.params.id));
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  res.json({ success: true, data: project });
});

// ── Documents ─────────────────────────────────────────────────────
app.post('/api/projects/:projectId/documents', (req, res) => {
  const agent = getAgent();
  const { title, content, doc_type = 'other', source = 'manual' } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });

  const doc = agent.addDocument(parseInt(req.params.projectId), title, content, doc_type, source);
  if (!doc) return res.status(404).json({ success: false, message: 'Project not found' });
  res.json({ success: true, data: doc, message: 'Document added' });
});

app.get('/api/projects/:projectId/documents', (req, res) => {
  const agent = getAgent();
  const docs = agent.listDocuments(parseInt(req.params.projectId));
  res.json({ success: true, data: docs });
});

app.get('/api/documents/:id', (req, res) => {
  const agent = getAgent();
  const doc = agent.getDocument(parseInt(req.params.id));
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
  res.json({ success: true, data: doc });
});

// ── Analysis ──────────────────────────────────────────────────────
app.post('/api/projects/:projectId/analyze', async (req, res) => {
  const agent = getAgent();
  const result = await agent.analyze(parseInt(req.params.projectId), req.body.document_ids || []);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, data: result });
});

app.get('/api/analyses/:id', (req, res) => {
  const agent = getAgent();
  const a = agent.getAnalysis(parseInt(req.params.id));
  if (!a) return res.status(404).json({ success: false, message: 'Analysis not found' });
  res.json({ success: true, data: a });
});

app.get('/api/analyses/:id/questions', (req, res) => {
  const agent = getAgent();
  const questions = agent.getClarificationQuestions(parseInt(req.params.id));
  res.json({ success: true, data: questions });
});

app.post('/api/analyses/:id/clarify', (req, res) => {
  const agent = getAgent();
  const result = agent.submitClarification(parseInt(req.params.id), req.body.answers || []);
  res.json({ success: true, data: result });
});

// ── PRD ───────────────────────────────────────────────────────────
app.post('/api/projects/:projectId/prd', async (req, res) => {
  const agent = getAgent();
  const result = await agent.generatePRD(parseInt(req.params.projectId), req.body.analysis_id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, data: result });
});

app.get('/api/prds/:id', (req, res) => {
  const agent = getAgent();
  const prd = agent.getPRD(parseInt(req.params.id));
  if (!prd) return res.status(404).json({ success: false, message: 'PRD not found' });
  res.json({ success: true, data: { ...prd, result_json: undefined } });
});

// ── Task Breakdown ────────────────────────────────────────────────
app.post('/api/projects/:projectId/tasks', async (req, res) => {
  const agent = getAgent();
  const result = await agent.breakDownTasks(parseInt(req.params.projectId), req.body.prd_id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, data: result });
});

app.get('/api/task-breakdowns/:id', (req, res) => {
  const agent = getAgent();
  const tb = agent.getTaskBreakdown(parseInt(req.params.id));
  if (!tb) return res.status(404).json({ success: false, message: 'Task breakdown not found' });
  res.json({ success: true, data: { ...tb, result_json: undefined } });
});

// ── Serve Frontend ────────────────────────────────────────────────
const frontendPath = join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ success: false, message: 'Not found' });
  res.sendFile(join(frontendPath, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  🧠 Requirement AI Agent');
  console.log('  面向研发团队的 AI 需求澄清与任务拆解助手');
  console.log('='.repeat(60));
  console.log(`\n  服务启动: http://localhost:${PORT}`);
  console.log(`\n  提示: 未配置 API Key 时运行在模版模式`);
  console.log(`        在页面右下角配置 OpenAI / Anthropic API Key 启用 AI 功能`);
  console.log(`\n  按 Ctrl+C 停止服务`);
  console.log('='.repeat(60));
});
