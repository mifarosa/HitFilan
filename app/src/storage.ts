// The shared store (../js/store.js) reads localStorage on the web; here it gets SQLite key-value storage.
// It is synchronous, so the shared code works unchanged.
import Storage from 'expo-sqlite/kv-store';

type SharedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const sharedStorage: SharedStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
  removeItem: (key: string) => {
    Storage.removeItemSync(key);
  },
} as SharedStorage;

(globalThis as { __hitfilanStorage?: SharedStorage }).__hitfilanStorage = sharedStorage;
