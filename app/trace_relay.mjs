import express from 'express';
import cors from 'cors';
import {
  handleRelayChatCompletions,
  handleQuotaStatus,
  handleModelsList,
  getQuota,
  TOTAL_ALLOCATED,
  DEFAULT_MODEL,
  UPSTREAM_CHAT_URL
} from './quota_manager.mjs';

const app = express();
const PORT = process.env.PORT || 8046;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  const quota = getQuota();
  res.json({
    status: 'healthy',
    service: 'trace-relay',
    port: PORT,
    upstream: UPSTREAM_CHAT_URL,
    default_model: DEFAULT_MODEL,
    quota: {
      total: quota.total_allocated,
      used: quota.used_tokens,
      remaining: quota.remaining_tokens
    }
  });
});

// Quota endpoints
app.all('/quota', handleQuotaStatus);
app.all('/api/trace-relay/quota', handleQuotaStatus);

// Models endpoints
app.all('/v1/models', handleModelsList);
app.all('/models', handleModelsList);
app.all('/api/trace-relay/v1/models', handleModelsList);
app.all('/api/trace-relay/models', handleModelsList);

// Chat completions endpoints
app.all('/v1/chat/completions', handleRelayChatCompletions);
app.all('/chat/completions', handleRelayChatCompletions);
app.all('/api/trace-relay/v1/chat/completions', handleRelayChatCompletions);
app.all('/api/trace-relay/chat/completions', handleRelayChatCompletions);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`[Trace Relay] Standalone server listening on port ${PORT}`);
  console.log(`[Trace Relay] Upstream Target: ${UPSTREAM_CHAT_URL}`);
  console.log(`[Trace Relay] Enforced Model: ${DEFAULT_MODEL}`);
  console.log(`[Trace Relay] Quota Allocation: ${TOTAL_ALLOCATED.toLocaleString()} tokens`);
  console.log(`=======================================================`);
});

export default server;
