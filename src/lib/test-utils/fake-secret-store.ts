import type { SecretStore } from "@/application/ports/secret-store";

export function createFakeSecretStore(): SecretStore {
  const store = new Map<string, string>();
  return {
    get(key) {
      return Promise.resolve(store.get(key) ?? null);
    },
    set(key, value) {
      store.set(key, value);
      return Promise.resolve();
    },
    delete(key) {
      store.delete(key);
      return Promise.resolve();
    },
  };
}
