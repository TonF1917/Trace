import { useStore } from '../store';

/**
 * Robust JSON extraction and cleaning helper.
 * Handles markdown backticks, embedded JSON blocks, trailing commas, and unescaped characters.
 */
export function cleanAndParseJson(text) {
  if (typeof text !== 'string') return text;
  let cleaned = text.trim();

  // Extract content from ```json ... ``` or ``` ... ``` codeblock if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Extract starting from first { or [ to last } or ]
  const firstBrace = cleaned.search(/[\{\[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      // Fix unescaped newlines within string values
      const fixedNewlines = cleaned.replace(/([^\\])\n/g, '$1\\n');
      return JSON.parse(fixedNewlines);
    } catch (e2) {
      console.error('JSON parsing failed:', cleaned, err);
      throw new Error(`Failed to parse LLM JSON output. Raw snippet: ${cleaned.slice(0, 120)}...`);
    }
  }
}

async function callLLM(systemPrompt, userPrompt, temperature = 0.1, expectJson = true) {
  const { apiConfig } = useStore.getState();
  
  const currentApiKey = apiConfig.apiKey || (apiConfig.provider === 'freellmapi' ? 'freellmapi-96146ee70cfe916f131303a9dee491c45f5c979f6e9fe93c' : '');
  
  if (!currentApiKey && !['lmstudio', 'ollama'].includes(apiConfig.provider)) {
    throw new Error('API Key is missing. Please configure it in Settings.');
  }

  let url, headers, body;
  const provider = apiConfig.provider || 'freellmapi';

  if (provider === 'lmstudio') {
    url = apiConfig.baseUrl || 'http://localhost:1234/v1/chat/completions';
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      model: apiConfig.model || 'local-model',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4096,
      temperature,
      ...(expectJson ? { response_format: { type: "json_object" } } : {})
    });
  } else if (provider === 'anthropic') {
    url = apiConfig.baseUrl || 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': currentApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerously-allow-browser': 'true'
    };
    body = JSON.stringify({
      model: apiConfig.model || 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
  } else if (provider === 'gemini') {
    const baseUrl = apiConfig.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models/';
    const model = apiConfig.model || 'gemini-1.5-pro';
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    url = cleanBaseUrl.includes(':generateContent') 
      ? `${cleanBaseUrl}?key=${currentApiKey}` 
      : `${cleanBaseUrl}/${model}:generateContent?key=${currentApiKey}`;
      
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: systemPrompt + "\n\n" + userPrompt }]
      }],
      generationConfig: {
        temperature,
        ...(expectJson ? { responseMimeType: "application/json" } : {})
      }
    });
  } else {
    // FreeLLMAPI or OpenAI & Compatible
    const defaultUrl = provider === 'freellmapi' ? 'http://localhost:8000/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    let cleanUrl = (apiConfig.baseUrl || defaultUrl).trim();
    // Auto-append /chat/completions if the user only provided the Base URL
    if (!cleanUrl.includes('/chat/completions') && !cleanUrl.includes('/completions') && !cleanUrl.includes('/api/chat')) {
      cleanUrl = cleanUrl.replace(/\/$/, '') + '/chat/completions';
    }
    url = cleanUrl;
    
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentApiKey}`
    };
    const requestBody = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: 4096,
      ...(expectJson ? { response_format: { type: "json_object" } } : {})
    };

    if (apiConfig.model && apiConfig.model.toLowerCase() !== 'auto') {
      requestBody.model = apiConfig.model;
    }

    body = JSON.stringify(requestBody);
  }

  // Auto-fix missing http/https
  let finalUrl = url.trim();
  if (finalUrl !== '/api/chat' && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl;
  }

  let response;
  
  // Try using the built-in local CORS proxy first (runs as a Vite plugin during dev)
  const proxyUrl = '/proxy';
  let proxyFailed = false;

  try {
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: finalUrl,
        headers: headers,
        body: JSON.parse(body),
        systemProxy: apiConfig.systemProxy || ''
      })
    });
    
    // If we are on a static deployment (like GitHub Pages), the /proxy route won't exist and returns 404
    if (response.status === 404) {
      proxyFailed = true;
    } else if (response.status === 500) {
      // If the proxy responds with a 500 error related to Node.js network failure
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error === 'Proxy Request Failed') {
          throw new Error(`Proxy Backend Network Error: ${errorData.details}. ${errorData.cause ? '(' + errorData.cause + ')' : ''}`);
        }
      } catch (e) {
        // Not a JSON proxy error
      }
    }
  } catch (proxyError) {
    if (proxyError.message.includes('Failed to fetch') || proxyFailed) {
      // Local proxy server is completely dead/unreachable. Fallback to direct browser fetch.
      proxyFailed = true;
    } else {
      // A genuine connection error from the proxy (e.g. ECONNREFUSED to target API)
      throw proxyError;
    }
  }

  // Fallback to direct browser fetch if the local proxy isn't running
  if (proxyFailed) {
    try {
      response = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body
      });
    } catch (networkError) {
      throw new Error(`Network Error (获取失败): Failed to connect to ${finalUrl}. 
      This usually happens because:
      1) If using an overseas API (like OpenAI/Claude), your VPN is not configured to proxy browser requests.
      2) The API provider blocks direct browser requests (CORS policy). 👉 Highly recommended: Install the "Allow CORS" browser extension!
      3) If using local models (LM Studio/Ollama), the software is not running or CORS is not enabled.
      4) The domain name is typed incorrectly.
      [Underlying error: ${networkError.message}]`);
    }
  }

  const responseText = await response.text();
  const htmlSnippet = responseText.substring(0, 150).replace(/\n/g, '');

  if (!response.ok) {
    if (responseText.trim().toLowerCase().startsWith('<')) {
      throw new Error(`API Error (${response.status}) at ${finalUrl}: The server returned an HTML error page. Response snippet: ${htmlSnippet} ... Please check your API Base URL.`);
    }
    throw new Error(`API Error (${response.status}): ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    if (responseText.trim().toLowerCase().startsWith('<')) {
      if (htmlSnippet.includes('@vite/client') || htmlSnippet.includes('Vite')) {
        throw new Error(`API Configuration Error: The request was sent to the local Vite Dev Server (${finalUrl}) instead of an external API, returning the local index.html. Did you forget to enter a complete API Base URL starting with https://?`);
      }
      throw new Error(`API Proxy Error at ${finalUrl}: The server returned an HTML page instead of JSON. Response snippet: ${htmlSnippet} ... If you are using a proxy, it may have blocked the request or timed out.`);
    }
    throw new Error(`Failed to parse JSON response: ${responseText.substring(0, 100)}...`);
  }
  let jsonString = '';

  try {
    if (provider === 'anthropic') {
      jsonString = data.content[0].text;
    } else if (provider === 'gemini') {
      jsonString = data.candidates[0].content.parts[0].text;
    } else {
      jsonString = data.choices[0].message.content;
    }
    
    if (!expectJson) return jsonString.trim();
    
    return cleanAndParseJson(jsonString);
  } catch (e) {
    if (e.message.includes('Failed to parse LLM JSON output')) throw e;
    throw new Error('Failed to parse LLM response. If expecting JSON, ensure the model supports JSON output.');
  }
}

export async function analyzeArticle(articleText, customFrames, customTones, customRelations, targetNodeCount = 10) {
  const systemPrompt = `You are an expert academic research assistant specializing in framing analysis and political communication.
Your task is to analyze the provided news text and extract its narrative structure based strictly on the provided custom ontology.

CUSTOM FRAMES: ${customFrames.join(', ')}
CUSTOM TONES: ${customTones.join(', ')}
CUSTOM RELATION TYPES: ${customRelations.join(', ')}

Return ONLY a valid JSON object with the following structure:
{
  "keywords": ["3-5 thematic keywords for the overall text"],
  "relationships": [
    {
      "date": "Extract the exact date this specific event/conflict occurred (YYYY-MM-DD). If no event date exists, use the publication date.",
      "main_actor": "The primary entity driving the action or making the claim. Prioritize MAIN/CORE entities first.",
      "blame_target": "The specific entity targeted, influenced, or interacting with the main actor.",
      "relation_type": "Select exactly 1 relation type from the CUSTOM RELATION TYPES list that best describes how the main_actor interacts with the target.",
      "frames": ["Select 1 to 3 frames from the CUSTOM FRAMES list that best apply"],
      "tone": "Select 1 tone from the CUSTOM TONES list",
      "quote": "A short, exact quote from the text that proves this relationship",
      "rationale": "A brief 1-sentence explanation of why these frames and targets were chosen."
    }
  ]
}

CRITICAL RULES:
1. Extract EXACTLY up to ${targetNodeCount} relationships.
2. Ensure BOTH 'main_actor' and 'blame_target' are concise and standardized names.
3. HIERARCHY RULES: You MUST merge fragmented concepts into their core entities (e.g., merge "NEP's complexity" into "NEP"). 
4. If you extract specific factions or individuals (e.g. Trotsky, Left Opposition), you MUST also extract a "Belongs To" relationship linking them to their overarching group (e.g. Bolsheviks).
5. Ensure 'date' is specific to the relationship.`;

  const userPrompt = `Analyze the following text:\n\n${articleText}`;
  return callLLM(systemPrompt, userPrompt);
}

export async function extractMoreRelationships(articleText, customFrames, customTones, customRelations, existingRelationships, targetNodeCount = 10) {
  const systemPrompt = `You are an expert academic research assistant specializing in framing analysis and political communication.
Your task is to re-read the provided news text and perform a DEEP EXTRACTION of micro-narratives, class conflicts, and entity interactions based strictly on the provided custom ontology.

CUSTOM FRAMES: ${customFrames.join(', ')}
CUSTOM TONES: ${customTones.join(', ')}
CUSTOM RELATION TYPES: ${customRelations.join(', ')}

IMPORTANT CONTEXT:
The user has ALREADY extracted the following relationships from this text:
${existingRelationships.map((r, i) => `[${i+1}] Actor: ${r.actor} | Target: ${r.target} | Relation: ${r.relation_type || 'Unknown'} | Quote: "${r.quote}"`).join('\n')}

YOUR MISSION:
Find ANY OTHER relationships (Actor interacting with Target) that are NOT in the list above. Look for deeper, less obvious, or secondary factional conflicts, financial ties, or political alliances.

Return ONLY a valid JSON object with the following structure:
{
  "relationships": [
    {
      "date": "Exact date this specific event/conflict occurred (YYYY-MM-DD)",
      "main_actor": "Entity making the claim or performing the action.",
      "blame_target": "Entity being targeted or interacted with.",
      "relation_type": "Select exactly 1 relation type from the CUSTOM RELATION TYPES list that best describes how the main_actor interacts with the target.",
      "frames": ["Select 1 to 3 frames from the CUSTOM FRAMES list that best apply"],
      "tone": "Select 1 tone from the CUSTOM TONES list",
      "quote": "Direct quote proving this relationship.",
      "rationale": "Why this was selected."
    }
  ]
}

CRITICAL RULES:
1. Extract EXACTLY up to ${targetNodeCount} NEW relationships.
2. Order them by significance (most important hidden relationship first).
3. Ensure 'date' is specific to the relationship.
4. If absolutely no new relationships can be found, return {"relationships": []}.`;

  const userPrompt = `Please deep-extract new relationships from the following text:\n\n${articleText}`;
  return callLLM(systemPrompt, userPrompt);
}

export async function connectExistingEntities(articleText, customFrames, customTones, customRelations, existingEntities, existingRelationshipsContext, targetNodeCount = 10) {
  const systemPrompt = `You are an expert academic research assistant specializing in framing analysis and political communication.
Your task is to re-read the provided news text and extract entity interactions based strictly on the provided custom ontology.

CUSTOM FRAMES: ${customFrames.join(', ')}
CUSTOM TONES: ${customTones.join(', ')}
CUSTOM RELATION TYPES: ${customRelations.join(', ')}

IMPORTANT CONTEXT:
The user is ONLY interested in relationships between the following EXISTING entities:
${existingEntities.join(', ')}

You have ALREADY extracted these relationships:
${existingRelationshipsContext}

YOUR MISSION:
Find any NEW relationships (Actor interacting with Target) where BOTH the Actor and the Target are from the EXISTING entities list provided above.
You MAY infer implicit structural relationships (e.g. 'Belongs To', 'Supports / Allies', 'Influences / Controls') based on the broader context of the text, even without a direct explicit quote, as long as both entities are in the list.
Do NOT extract relationships involving new, unlisted entities.
Do NOT extract relationships that are already listed in the 'ALREADY extracted' list.

Return ONLY a valid JSON object with the following structure:
{
  "relationships": [
    {
      "date": "Exact date this specific event/conflict occurred (YYYY-MM-DD)",
      "main_actor": "Entity making the claim or performing the action (MUST be from the existing entities list).",
      "blame_target": "Entity being targeted or interacted with (MUST be from the existing entities list).",
      "relation_type": "Select exactly 1 relation type from the CUSTOM RELATION TYPES list that best describes how the main_actor interacts with the target.",
      "frames": ["Select 1 to 3 frames from the CUSTOM FRAMES list that best apply"],
      "tone": "Select 1 tone from the CUSTOM TONES list",
      "quote": "Direct quote proving this relationship.",
      "rationale": "Why this was selected."
    }
  ]
}

CRITICAL RULES:
1. Extract EXACTLY up to ${targetNodeCount} NEW relationships.
2. BOTH 'main_actor' and 'blame_target' MUST be chosen strictly from the EXISTING entities list.
3. HIERARCHY RULES: If entities logically belong to each other (e.g., an individual belonging to a sub-faction, and that sub-faction belonging to a larger party), you MUST create 'Belongs To' relationships linking them. Build a complete hierarchy if possible (e.g., Person -> Belongs To -> Faction -> Belongs To -> Party), even if not explicitly stated in the text.
4. Ensure 'date' is specific to the relationship.
5. If no relationships can be found between the listed entities, return {"relationships": []}.`;

  const userPrompt = `Please extract relationships ONLY between the specified existing entities from the following text:\n\n${articleText}`;
  return callLLM(systemPrompt, userPrompt, 0.5, true);
}

export async function consolidateEntities(entitiesList) {
  const systemPrompt = `You are an expert academic knowledge graph editor.
The user has extracted a list of entities (actors and targets) from a corpus of academic literature.
Due to variations in language, the same historical figure, organization, or concept may have been extracted under slightly different names.

YOUR TASK:
Identify entities that refer to the EXACT SAME real-world person, organization, or highly specific concept, and group them under a single "Standardized Name".

RULES:
1. ONLY group entities if you are absolutely certain they are the same (e.g., "Lenin" and "Vladimir I. Lenin", "NEP" and "New Economic Policy").
2. DO NOT group conceptually related but historically distinct entities (e.g., DO NOT group "NEP" and "NEPmen" - one is a policy, the other is a social class).
3. The standardized name should be the most formal, commonly accepted academic term among the variations.
4. Only return mappings for entities that actually need changing. If an entity is already standard or has no duplicates, you may omit it or map it to itself.

OUTPUT FORMAT:
You MUST return a valid JSON object with a single key "mappings", containing an array of objects.
Example:
{
  "mappings": [
    { "original": "Lenin", "standardized": "Vladimir Lenin" },
    { "original": "Vladimir I. Lenin", "standardized": "Vladimir Lenin" },
    { "original": "NEP", "standardized": "New Economic Policy" }
  ]
}`;

  const userPrompt = `Here is the list of unique entities extracted from the project:
${entitiesList.join('\n')}

Please analyze them and return the JSON mappings to consolidate variations.`;

  return callLLM(systemPrompt, userPrompt, 0.2, true);
}

export async function generateTextForTopic(topic) {
  const systemPrompt = `You are an expert academic researcher and political historian. The user will provide a topic or event.
Your task is to write a highly detailed, comprehensive analytical essay (approx 800-1500 words) detailing the key events, factions, conflicts, and blame attributions regarding this topic.
Be highly specific with names, groups, and actions. This text will be used for structural framing analysis.

Return ONLY a valid JSON object with the following structure:
{
  "text": "The full analytical essay...",
  "source_name": "Provide the actual primary source or origin of this information (e.g., 'Journal of Soviet History, Vol 4', 'Pravda Archives, 1921', 'Declassified CIA Briefing'). DO NOT output 'AI Researcher'."
}`;
  const userPrompt = `Topic: ${topic}\nPlease generate the comprehensive analysis text.`;
  return callLLM(systemPrompt, userPrompt, 0.5, true); // true for expectJson
}

export async function generateProjectOntology(sourceText) {
  const systemPrompt = `You are an expert in media studies, journalism, and political communication. 
The user will provide a text (e.g., a news article, a Wikipedia summary, or an event description).
Your task is to analyze the text and automatically design a framing analysis project for it.

Return ONLY a valid JSON object with the following structure (do not include markdown blocks or any other text):
{
  "name": "A concise, academic-sounding name for the event/topic (e.g., '2023 US-China Chip War')",
  "description": "A 1-2 sentence description of the core event and why it is significant.",
  "frames": ["4-6 custom framing categories that are highly relevant to this specific topic (e.g. Geopolitics, Victimhood, Economic Impact, National Security)"],
  "tones": ["3-5 emotional tones relevant to how media might report this (e.g. Alarmist, Neutral, Patriotic, Critical)"]
}`;

  const userPrompt = `Please design an ontology for the following event based on this text:\n\n${sourceText}`;
  return callLLM(systemPrompt, userPrompt);
}

export async function aiCompressText(text, onProgress, chunkCount = 4) {
  if (!text || text.length <= 5000) return text;
  
  const chunkSize = Math.ceil(text.length / chunkCount);
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  
  let combinedSummary = '';
  
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    
    const systemPrompt = `You are an expert summarizer. Your task is to extract the core narrative, key actors, main events, and underlying themes from the provided text segment.
Return ONLY a valid JSON object with the following structure:
{
  "summary": "A detailed and highly concentrated summary of the text segment, preserving key terminology, themes, and narrative elements."
}`;
    const userPrompt = `Please summarize this text segment:\n\n${chunks[i]}`;
    
    try {
      const result = await callLLM(systemPrompt, userPrompt);
      if (result && result.summary) {
        combinedSummary += `[Segment ${i + 1} Summary]:\n${result.summary}\n\n`;
      }
    } catch (err) {
      // If the error is a critical API error (like 429 All models exhausted or 401), abort the whole compression process!
      if (err.message.includes('API Error')) {
        throw err;
      }
      
      combinedSummary += `[Segment ${i + 1} Summary (Timeout Fallback)]: ${chunks[i].slice(0, 5000)}...\n\n`;
    }
  }
  
  return combinedSummary;
}

/**
 * Generates a comprehensive analytical briefing report in Markdown based on graph topology.
 */
export async function generateTopologyReport(project, metrics) {
  const customSystemPrompt = useStore.getState().apiConfig.customSystemPrompt;
  
  const systemPrompt = customSystemPrompt || `You are a world-class academic political scientist and computational media analyst.
Your task is to produce a comprehensive, publication-grade analytical briefing report (in Markdown format) based on the topological graph metrics of a media framing and blame network.

Report Structure to follow:
# 📊 ${project.name} - 拓扑网络深度分析与叙事归因报告

## 1. 网络全局特征与张力概览 (Network Overview)
- 简述网络规模（节点数 ${metrics.numNodes}、关系数 ${metrics.numLinks}、网络密度 ${metrics.density} 及社群数量 ${metrics.communityCount}）。
- 阐述该话题的核心对抗焦点与叙事张力。

## 2. 关键节点与权力中心分析 (Key Power Centers & Targets)
- **主要归因/指责焦点 (Top Targets - High In-Degree)**: 谁是被集中的批判或归因对象？
- **主要叙事发起方 (Top Accusers - High Out-Degree)**: 谁在主导议题和推动指责？
- **跨阵营枢纽/桥梁角色 (Key Bridges - High Betweenness Centrality)**: 哪些实体连接了不同的叙事群体？

## 3. 社群阵营与叙事分化 (Louvain Community Clusters)
- 逐一剖析每个主要社群的核心成员与主要关系框架。

## 4. 学术研判与策略结论 (Academic Insights & Takeaways)
- 提炼该舆情/事件中的核心叙事陷阱或舆论裂隙。

规则：
1. 必须使用标准 Markdown 格式输出。
2. 语言必须严谨、客观且具备学术深度。
3. 请依据传入的网络指标数据进行深度推演。`;

  const topHubsStr = metrics.topHubs.map(h => `${h.name} (Degree: ${h.degree}, In: ${h.inDegree}, Out: ${h.outDegree})`).join('; ');
  const topBridgesStr = metrics.topBridges.map(b => `${b.name} (Betweenness: ${b.betweenness})`).join('; ');
  const topTargetsStr = metrics.topTargets.map(t => `${t.name} (In-Degree: ${t.inDegree})`).join('; ');
  const communitiesStr = metrics.communities.map(c => `[Community ${c.id + 1} (${c.members.length} members)]: ${c.members.join(', ')}`).join('\n');

  const userPrompt = `Project Context:
Project Name: ${project.name}
Description: ${project.description || 'N/A'}

Graph Metrics:
- Total Nodes: ${metrics.numNodes}
- Total Edges: ${metrics.numLinks}
- Network Density: ${metrics.density}
- Avg Degree: ${metrics.avgDegree}
- Community Count: ${metrics.communityCount}

Key Node Rankings:
- Top Overall Hubs: ${topHubsStr}
- Top Bridge Actors (Betweenness): ${topBridgesStr}
- Top Blame Targets (In-Degree): ${topTargetsStr}

Community Clusters (Louvain):
${communitiesStr}

Please generate the complete Markdown analysis report.`;

  return callLLM(systemPrompt, userPrompt, 0.4, false);
}

