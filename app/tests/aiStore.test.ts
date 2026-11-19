import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteKey, getKey, loadAiPrefs, modelOf, saveAiPrefs, setKey,
} from '@/ai/keyStore';
import { PROVIDERS } from '@/ai/providers';
import '@/shared'; // installs the storage adapter
import { lastOptions, store } from './stubSecureStore';

describe('API key storage', () => {
  beforeEach(() => store.clear());

  it('goes to the secure store, per provider, trimmed, this device only', async () => {
    await setKey('openai', '  sk-abc  ');
    expect(await getKey('openai')).toBe('sk-abc');
    expect(await getKey('gemini')).toBe('');
    expect(lastOptions.value).toEqual({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
    await deleteKey('openai');
    expect(await getKey('openai')).toBe('');
  });

  it('never lands in the normal (synced) storage or in the preferences', async () => {
    await setKey('anthropic', 'sk-ant-SECRET');
    saveAiPrefs({ ...loadAiPrefs(), provider: 'anthropic' });
    const { sharedStorage } = await import('@/storage');
    for (const k of ['hitfilan.ai', 'hitfilan.settings']) {
      expect(sharedStorage.getItem(k) ?? '').not.toContain('SECRET');
    }
  });
});

describe('AI preferences and chat', () => {
  beforeEach(async () => {
    const { sharedStorage } = await import('@/storage');
    for (const k of ['hitfilan.ai']) sharedStorage.removeItem(k);
  });

  it('defaults, model fallback and consent per provider', () => {
    const p = loadAiPrefs();
    expect(p.provider).toBe('gemini');
    expect(p.sendContext).toBe(true);
    expect(modelOf(p)).toBe(PROVIDERS.gemini.defaultModel);
    saveAiPrefs({ ...p, models: { gemini: ' gemini-x ' }, consented: ['gemini'], sendContext: false });
    const q = loadAiPrefs();
    expect(modelOf(q)).toBe('gemini-x');
    expect(q.consented).toEqual(['gemini']);
    expect(q.sendContext).toBe(false);
  });

  it('survives junk preferences', async () => {
    const { sharedStorage } = await import('@/storage');
    sharedStorage.setItem('hitfilan.ai', 'not json');
    expect(loadAiPrefs().provider).toBe('gemini');
  });
});
