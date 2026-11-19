import { describe, expect, it, vi } from 'vitest';
import { AiError, ask, extractJson, replyText, testConnection, type Provider } from '@/ai/providers';

const KEY = 'sk-test-SECRET-123';
const ok = (data: unknown) => vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }));
const status = (code: number, body = '') => vi.fn(async () => new Response(body, { status: code }));
const base = { model: 'm', key: KEY, system: 'SYS', messages: [{ role: 'user' as const, content: 'merhaba' }] };

describe('request shapes (key only in a header)', () => {
  it('Gemini', async () => {
    const f = ok({ candidates: [{ content: { parts: [{ text: 'selam' }] } }] });
    expect(await ask({ ...base, provider: 'gemini', model: 'gemini-2.5-flash', json: true, fetchImpl: f as any })).toBe('selam');
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain(KEY);
    expect(init.headers['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents[0]).toEqual({ role: 'user', parts: [{ text: 'merhaba' }] });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(init.body).not.toContain(KEY);
  });

  it('OpenAI', async () => {
    const f = ok({ choices: [{ message: { content: 'selam' } }] });
    expect(await ask({ ...base, provider: 'openai', json: true, fetchImpl: f as any })).toBe('selam');
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(init.body).not.toContain(KEY);
  });

  it('Anthropic', async () => {
    const f = ok({ content: [{ type: 'text', text: 'selam' }] });
    expect(await ask({ ...base, provider: 'anthropic', fetchImpl: f as any })).toBe('selam');
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe(KEY);
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body);
    expect(body.system).toBe('SYS');
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(init.body).not.toContain(KEY);
  });
});

describe('errors', () => {
  const run = (provider: Provider, f: any): Promise<any> => ask({ ...base, provider, fetchImpl: f }).catch((e) => e as AiError);

  it('maps the common failures and never leaks the key', async () => {
    expect((await run('openai', status(401, `bad key ${KEY}`))).code).toBe('key');
    expect((await run('gemini', status(400, '{"error":{"message":"API key not valid"}}'))).code).toBe('key');
    expect((await run('anthropic', status(429))).code).toBe('limit');
    expect((await run('openai', status(503))).code).toBe('server');
    const bad = await run('openai', status(404, `model not found for ${KEY}`));
    expect(bad.code).toBe('bad');
    expect(bad.message).not.toContain(KEY);
    expect(bad.message).toContain('***');
  });

  it('network failure, empty reply and empty key', async () => {
    expect((await run('gemini', vi.fn(async () => { throw new TypeError('Network request failed'); }))).code).toBe('network');
    expect((await run('gemini', ok({ candidates: [] }))).code).toBe('empty');
    expect((await (ask({ ...base, provider: 'gemini', key: '  ' }).catch((e) => e) as Promise<any>)).code).toBe('key');
  });

  it('can be cancelled and times out', async () => {
    const hang = vi.fn((_u: string, init: any) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))));
    const ctrl = new AbortController();
    const pending = ask({ ...base, provider: 'openai', fetchImpl: hang as any, signal: ctrl.signal }).catch((e) => e);
    ctrl.abort();
    expect(((await pending) as any).code).toBe('aborted');
    expect(((await ask({ ...base, provider: 'openai', fetchImpl: hang as any, timeoutMs: 20 }).catch((e) => e)) as any).code).toBe('timeout');
  });
});

describe('helpers', () => {
  it('reads each reply shape', () => {
    expect(replyText('gemini', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe('ab');
    expect(replyText('openai', { choices: [{ message: { content: ' x ' } }] })).toBe('x');
    expect(replyText('anthropic', { content: [{ type: 'text', text: 'y' }, { type: 'tool_use' }] })).toBe('y');
    expect(replyText('openai', null)).toBe('');
  });

  it('extracts JSON from fences and from text around it', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n[{"name":"x","kcal":1}]\n```')).toEqual([{ name: 'x', kcal: 1 }]);
    expect(extractJson('İşte plan: {"a":[1,2]} umarım yardımcı olur')).toEqual({ a: [1, 2] });
    expect(extractJson('düz metin')).toBeNull();
  });

  it('testConnection sends one tiny request', async () => {
    const f = ok({ choices: [{ message: { content: 'tamam' } }] });
    await testConnection('openai', 'm', KEY, f as any);
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).max_completion_tokens).toBe(16);
  });
});
