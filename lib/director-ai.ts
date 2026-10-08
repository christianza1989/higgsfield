import { AgentError } from './agent-plans';

export async function directorAI(messages: unknown[], maxTokens = 2000): Promise<Record<string, unknown>> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new AgentError('AI paruošimui reikia OpenRouter rakto. Patikrink serverio nustatymus.', 401);
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(90000), redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-4.1-mini', temperature: 0.2, max_tokens: maxTokens, response_format: { type: 'json_object' }, messages }),
    });
  } catch { throw new AgentError('AI paruošimo atsakymas negautas. Automatiškai nekartosime mokamos užklausos.', 502); }
  if (!res.ok) throw new AgentError(`AI paruošimas atmestas (${res.status}). Patikrink OpenRouter prieigą ir kreditus.`, 502);
  const data = await res.json();
  try {
    const value = JSON.parse(data.choices[0].message.content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new AgentError('AI grąžino netinkamą paruošimo formatą. Užklausa automatiškai nekartojama.', 502); }
}
