import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const QUOTA_FILE = path.resolve(__dirname, 'quota_usage.json');
export const UPSTREAM_CHAT_URL = 'http://127.0.0.1:8045/v1/chat/completions';
export const UPSTREAM_AUTH = 'Bearer sk-18c47b145b9048c096ea8d81906a253c';
export const DEFAULT_MODEL = 'gemini-3.8-flash-high';
export const TOTAL_ALLOCATED = 20000000;

export function getQuota() {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const raw = fs.readFileSync(QUOTA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const total = typeof data.total_allocated === 'number' ? data.total_allocated : TOTAL_ALLOCATED;
      const used = typeof data.used_tokens === 'number' ? data.used_tokens : 0;
      return {
        total_allocated: total,
        used_tokens: used,
        remaining_tokens: Math.max(0, total - used),
        updated_at: data.updated_at || new Date().toISOString()
      };
    }
  } catch (err) {
    console.error('[QuotaManager] Error reading quota file:', err.message);
  }

  const initial = {
    total_allocated: TOTAL_ALLOCATED,
    used_tokens: 0,
    remaining_tokens: TOTAL_ALLOCATED,
    updated_at: new Date().toISOString()
  };
  saveQuota(initial);
  return initial;
}

export function saveQuota(quota) {
  const tmpFile = `${QUOTA_FILE}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(quota, null, 2), 'utf-8');
    fs.renameSync(tmpFile, QUOTA_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota, null, 2), 'utf-8');
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch (fallbackErr) {
      console.error('[QuotaManager] Critical: Failed to save quota file:', fallbackErr.message);
    }
  }
}

export function isQuotaExhausted() {
  const quota = getQuota();
  return quota.used_tokens >= quota.total_allocated;
}

export function consumeTokens(tokens) {
  if (typeof tokens !== 'number' || tokens <= 0) {
    return getQuota();
  }
  const quota = getQuota();
  quota.used_tokens += tokens;
  quota.remaining_tokens = Math.max(0, quota.total_allocated - quota.used_tokens);
  quota.updated_at = new Date().toISOString();
  saveQuota(quota);
  console.log(`[QuotaManager] Consumed ${tokens} tokens. Used: ${quota.used_tokens} / ${quota.total_allocated} (Remaining: ${quota.remaining_tokens})`);
  return quota;
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function handleRelayChatCompletions(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: { message: 'Method Not Allowed' } }));
  }

  // Check Quota
  if (isQuotaExhausted()) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: {
        message: 'Trace 20M token allocation exhausted.',
        type: 'insufficient_quota',
        code: 429
      }
    }));
  }

  try {
    const clientBody = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const forwardPayload = { ...clientBody };

    // Enforce model gemini-3.8-flash-high if model is not set or set to auto or gemini-3.8-flash-high
    if (!forwardPayload.model || forwardPayload.model === 'auto' || forwardPayload.model === DEFAULT_MODEL) {
      forwardPayload.model = DEFAULT_MODEL;
    } else {
      forwardPayload.model = DEFAULT_MODEL;
    }

    const response = await fetch(UPSTREAM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': UPSTREAM_AUTH
      },
      body: JSON.stringify(forwardPayload)
    });

    const status = response.status;
    const responseText = await response.text();

    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');

    if (!response.ok) {
      return res.end(responseText);
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return res.end(responseText);
    }

    // Extract token usage and deduct
    const usage = parsed?.usage;
    if (usage) {
      const consumed = typeof usage.total_tokens === 'number'
        ? usage.total_tokens
        : ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));

      if (consumed > 0) {
        consumeTokens(consumed);
      }
    }

    return res.end(JSON.stringify(parsed));
  } catch (error) {
    console.error('[QuotaManager] Upstream Relay Error:', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: {
        message: 'Trace Relay failed to communicate with upstream Antigravity server.',
        details: error.message
      }
    }));
  }
}

export function handleQuotaStatus(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const quota = getQuota();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(quota));
}

export function handleModelsList(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({
    object: 'list',
    data: [
      {
        id: DEFAULT_MODEL,
        object: 'model',
        created: 1706745600,
        owned_by: 'trace-pool'
      }
    ]
  }));
}
