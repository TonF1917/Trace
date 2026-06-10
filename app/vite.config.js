import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import express from 'express'
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'

function localProxyPlugin() {
  return {
    name: 'local-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/proxy', express.json({ limit: '50mb' }));
      server.middlewares.use('/proxy', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const { targetUrl, headers, body, systemProxy } = req.body || {};
        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Missing targetUrl' }));
        }

        try {
          const agentConfig = {};
          if (systemProxy && systemProxy.trim() !== '') {
            const proxyAgent = new HttpsProxyAgent(systemProxy.trim());
            agentConfig.httpsAgent = proxyAgent;
            agentConfig.httpAgent = proxyAgent;
            agentConfig.proxy = false;
          }

          const cleanHeaders = { ...headers };
          delete cleanHeaders['Origin'];
          delete cleanHeaders['Referer'];
          delete cleanHeaders['host'];

          const response = await axios({
            method: 'POST',
            url: targetUrl,
            headers: cleanHeaders,
            data: body,
            timeout: 300000,
            ...agentConfig,
            validateStatus: () => true,
          });

          res.statusCode = response.status;
          for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
          }
          if (typeof response.data === 'object') {
            res.end(JSON.stringify(response.data));
          } else {
            res.end(response.data);
          }
        } catch (error) {
          console.error('Proxy Error:', error.message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            error: 'Proxy Request Failed', 
            details: error.message,
            cause: error.cause ? error.cause.message : 'Unknown network issue'
          }));
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localProxyPlugin()
  ],
})
