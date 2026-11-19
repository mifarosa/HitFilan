// Where the AI settings live.
//  - The API key: the phone's secure storage (iOS Keychain / Android Keystore), this device only (not in iCloud
//    backups), never in the app's normal storage, never synced, never logged.
//  - Provider, model, consent and the "send context" choice: device storage `hitfilan.ai` (not synced to Firebase).
//  - The coach chat: device storage `hitfilan.coach` (last 30 messages, not synced).
import * as SecureStore from 'expo-secure-store';
import { sharedStorage } from '@/storage';
import { PROVIDERS, type Msg, type Provider } from './providers';

const keyName = (p: Provider) => `hitfilan.aikey.${p}`;

export async function getKey(p: Provider): Promise<string> {
  try { return (await SecureStore.getItemAsync(keyName(p))) ?? ''; } catch { return ''; }
}

export async function setKey(p: Provider, key: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(p), key.trim(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function deleteKey(p: Provider): Promise<void> {
  try { await SecureStore.deleteItemAsync(keyName(p)); } catch { /* nothing stored */ }
}

export interface AiPrefs {
  provider: Provider;
  models: Partial<Record<Provider, string>>;
  sendContext: boolean;
  consented: Provider[];
}

const PREFS = 'hitfilan.ai';
const CHAT = 'hitfilan.coach';
export const MAX_CHAT = 30;

export function loadAiPrefs(): AiPrefs {
  const base: AiPrefs = { provider: 'gemini', models: {}, sendContext: true, consented: [] };
  try {
    const raw = JSON.parse(sharedStorage.getItem(PREFS) ?? 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      provider: raw.provider in PROVIDERS ? raw.provider : base.provider,
      models: typeof raw.models === 'object' && raw.models ? raw.models : {},
      sendContext: raw.sendContext !== false,
      consented: Array.isArray(raw.consented) ? raw.consented.filter((p: string) => p in PROVIDERS) : [],
    };
  } catch { return base; }
}

export function saveAiPrefs(prefs: AiPrefs): void {
  sharedStorage.setItem(PREFS, JSON.stringify(prefs));
}

export const modelOf = (prefs: AiPrefs, p: Provider = prefs.provider) => prefs.models[p]?.trim() || PROVIDERS[p].defaultModel;

export function loadChat(): Msg[] {
  try {
    const raw = JSON.parse(sharedStorage.getItem(CHAT) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string').slice(-MAX_CHAT)
      : [];
  } catch { return []; }
}

export function saveChat(msgs: Msg[]): void {
  sharedStorage.setItem(CHAT, JSON.stringify(msgs.slice(-MAX_CHAT)));
}

export function clearChat(): void {
  sharedStorage.removeItem(CHAT);
}
