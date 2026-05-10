/**
 * 启动脚本 — 一键启动 Requirement AI Agent
 *
 * Usage:
 *   node start.js
 *
 * With API key:
 *   OPENAI_API_KEY=sk-... node start.js
 *   ANTHROPIC_API_KEY=sk-ant-... node start.js
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, 'backend', 'server.js');

console.log('Starting Requirement AI Agent...\n');

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env },
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});
