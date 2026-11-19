// In-memory stand-in for expo-secure-store; remembers the options of the last write.
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
export const store = new Map<string, string>();
export const lastOptions: { value: unknown } = { value: undefined };
export const getItemAsync = async (key: string) => store.get(key) ?? null;
export const setItemAsync = async (key: string, value: string, options?: unknown) => { lastOptions.value = options; store.set(key, value); };
export const deleteItemAsync = async (key: string) => { store.delete(key); };
