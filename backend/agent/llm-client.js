/**
 * LLM API client — supports OpenAI and Anthropic APIs.
 * Falls back to template mode when no API key is configured.
 */

let config = {
  provider: 'openai',
  apiKey: null,
  model: 'gpt-4o',
  baseUrl: null,
};

export function configureLLM(opts = {}) {
  if (opts.provider) config.provider = opts.provider;
  if (opts.apiKey) config.apiKey = opts.apiKey;
  if (opts.model) config.model = opts.model;
  if (opts.baseUrl) config.baseUrl = opts.baseUrl;

  config.apiKey = config.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!config.apiKey) {
    console.log('[LLM] No API key — using template fallback mode');
  }

  if (config.provider === 'anthropic' && !config.model.startsWith('claude')) {
    config.model = 'claude-sonnet-4-20250514';
  } else if (config.provider === 'openai' && !config.model.startsWith('gpt') && !config.model.startsWith('o')) {
    config.model = 'gpt-4o';
  }
}

export function getLLMConfig() {
  return { ...config };
}

/**
 * Send a chat completion request.
 * Falls back to template mode on failure or when no API key is set.
 */
export async function chat(systemPrompt, userPrompt, temperature = 0.3, maxTokens = 4096) {
  if (!config.apiKey) {
    throw new Error('LLM not configured — no API key');
  }

  try {
    if (config.provider === 'anthropic') {
      return await chatAnthropic(systemPrompt, userPrompt, temperature, maxTokens);
    }
    return await chatOpenAI(systemPrompt, userPrompt, temperature, maxTokens);
  } catch (err) {
    console.error('[LLM] API call failed:', err.message);
    throw err;
  }
}

async function chatOpenAI(systemPrompt, userPrompt, temperature, maxTokens) {
  const url = config.baseUrl || 'https://api.openai.com/v1';
  const resp = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`OpenAI API ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

async function chatAnthropic(systemPrompt, userPrompt, temperature, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`Anthropic API ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.content[0].text.trim();
}

