export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Load hidden environment variables (configured in Vercel dashboard or local .env file)
  const apiKey = process.env.CUSTOM_API_KEY;
  const baseUrl = process.env.CUSTOM_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  const defaultModel = process.env.CUSTOM_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: CUSTOM_API_KEY is not set.' });
  }

  try {
    // Extract payload from client request
    const { messages, model, temperature, response_format } = req.body;

    const targetPayload = {
      model: model || defaultModel,
      messages: messages,
      temperature: temperature || 0.1,
      response_format: response_format || { type: "json_object" }
    };

    // Forward the request to the upstream LLM provider securely
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(targetPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Upstream API Error: ${errText}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Proxy Error:', error);
    return res.status(500).json({ error: 'Internal server error while proxying request.' });
  }
}
