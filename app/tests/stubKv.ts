const data = new Map<string, string>();
export default {
  getItemSync: (key: string) => data.get(key) ?? null,
  setItemSync: (key: string, value: string) => { data.set(key, value); },
  removeItemSync: (key: string) => data.delete(key),
};
