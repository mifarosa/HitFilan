// Asks the user's own AI provider (Gemini, OpenAI or Anthropic) with the user's own key. The request goes
// straight from the phone to the provider: there is no server of ours in between. The key is only ever put
// in a request header, never in a URL, a log or an error message.

export type Provider = 'gemini' | 'openai' | 'anthropic';

export interface ProviderInfo {
  label: string;
  defaultModel: string;
  keyHint: string;
  keyUrl: string;
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', keyHint: 'AIza…', keyUrl: 'aistudio.google.com/apikey' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4.1-mini', keyHint: 'sk-…', keyUrl: 'platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic (Claude)', defaultModel: 'claude-haiku-5-5', keyHint: 'sk-ant-…', keyUrl: 'console.anthropic.com/settings/keys' },
};

export interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export type AiErrorCode = 'key' | 'limit' | 'network' | 'timeout' | 'aborted' | 'server' | 'bad' | 'empty';

const MESSAGES: Record<AiErrorCode, string> = {
  key: 'Anahtar geçersiz ya da bu modele izni yok. Ayarlar > Yapay zekâ bölümünden kontrol et.',
  limit: 'Kullanım sınırına ulaşıldı. Biraz sonra tekrar dene ya da sağlayıcındaki kotanı kontrol et.',
  network: 'Sağlayıcıya ulaşılamadı. İnternet bağlantını kontrol et.',
  timeout: 'Yanıt çok uzun sürdü. Tekrar dene.',
  aborted: 'İptal edildi.',
  server: 'Sağlayıcıda geçici bir sorun var. Biraz sonra tekrar dene.',
  bad: 'İstek reddedildi. Model adını kontrol et.',
  empty: 'Boş yanıt geldi. Tekrar dene.',
};

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code]);
    this.code = code;
  }
}

export interface AskArgs {
  provider: Provider;
  model: string;
  key: string;
  system: string;
  messages: Msg[];
  /** The reply should be JSON (the prompt says which shape); the provider's JSON mode is switched on when it has one. */
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface Built {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function build(a: AskArgs): Built {
  const max = a.maxTokens ?? 800;
  if (a.provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model)}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': a.key },
      body: {
        systemInstruction: { parts: [{ text: a.system }] },
        contents: a.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: max, ...(a.json ? { responseMimeType: 'application/json' } : {}) },
      },
    };
  }
  if (a.provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${a.key}` },
      body: {
        model: a.model,
        max_completion_tokens: max,
        messages: [{ role: 'system', content: a.system }, ...a.messages],
        ...(a.json ? { response_format: { type: 'json_object' } } : {}),
      },
    };
  }
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: { 'content-type': 'application/json', 'x-api-key': a.key, 'anthropic-version': '2023-06-01' },
    body: { model: a.model, max_tokens: max, system: a.system, messages: a.messages },
  };
}

// The reply text of each provider's response shape.
export function replyText(provider: Provider, data: any): string {
  if (provider === 'gemini') {
    return (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('').trim();
  }
  if (provider === 'openai') return String(data?.choices?.[0]?.message?.content ?? '').trim();
  return (data?.content ?? []).filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('').trim();
}

function errorFor(status: number, body: string, key: string): AiError {
  const text = body.split(key).join('***').slice(0, 160);
  if (status === 401 || status === 403) return new AiError('key');
  if (status === 400 && /api key|api_key|invalid.*key|authentication/i.test(body)) return new AiError('key');
  if (status === 429) return new AiError('limit');
  if (status >= 500) return new AiError('server');
  return new AiError('bad', `${status}: ${text}`);
}

/** Returns the reply text (a JSON string when `json` is set). Throws AiError. */
export async function ask(a: AskArgs): Promise<string> {
  if (!a.key.trim()) throw new AiError('key');
  const doFetch = a.fetchImpl ?? fetch;
  const { url, headers, body } = build(a);
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, a.timeoutMs ?? 30000);
  const onAbort = () => ctrl.abort();
  a.signal?.addEventListener('abort', onAbort);
  try {
    const res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw errorFor(res.status, await res.text().catch(() => ''), a.key);
    const text = replyText(a.provider, await res.json());
    if (!text) throw new AiError('empty');
    return text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (timedOut) throw new AiError('timeout');
    if (a.signal?.aborted) throw new AiError('aborted');
    throw new AiError('network');
  } finally {
    clearTimeout(timer);
    a.signal?.removeEventListener('abort', onAbort);
  }
}

/** Pulls a JSON value out of a reply (models sometimes wrap it in text or code fences). */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* look for it inside the text */ }
  const open = t.search(/[[{]/);
  if (open < 0) return null;
  const close = t[open] === '[' ? t.lastIndexOf(']') : t.lastIndexOf('}');
  if (close <= open) return null;
  try { return JSON.parse(t.slice(open, close + 1)); } catch { return null; }
}

/** One tiny request: does the key work with this model? */
export async function testConnection(provider: Provider, model: string, key: string, fetchImpl?: typeof fetch): Promise<void> {
  await ask({ provider, model, key, system: 'Sadece "tamam" yaz.', messages: [{ role: 'user', content: 'ping' }], maxTokens: 16, fetchImpl });
}
