/**
 * Simple JSON file-based data store.
 * Stored in backend/data.json — initialized on first use.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, 'data.json');

function defaultStore() {
  return {
    nextId: 1,
    projects: [],
    documents: [],
    analyses: [],
    prds: [],
    taskBreakdowns: [],
  };
}

export function readStore() {
  try {
    if (!existsSync(DATA_PATH)) {
      return defaultStore();
    }
    const raw = readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultStore();
  }
}

export function writeStore(store) {
  try {
    mkdirSync(dirname(DATA_PATH), { recursive: true });
    writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to write:', err.message);
  }
}
