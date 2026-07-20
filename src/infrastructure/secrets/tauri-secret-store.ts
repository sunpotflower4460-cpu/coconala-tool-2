import { invoke } from "@tauri-apps/api/core";
import type { SecretStore } from "@/application/ports/secret-store";

export const tauriSecretStore: SecretStore = {
  async get(key: string): Promise<string | null> {
    return invoke<string | null>("secret_get", { key });
  },
  async set(key: string, value: string): Promise<void> {
    await invoke("secret_set", { key, value });
  },
  async delete(key: string): Promise<void> {
    await invoke("secret_delete", { key });
  },
};
