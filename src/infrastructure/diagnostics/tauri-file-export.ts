import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { FileExportPort } from "@/application/ports/file-export";

export const tauriFileExport: FileExportPort = {
  async saveTextFile(defaultFileName: string, content: string): Promise<string | null> {
    const path = await save({
      defaultPath: defaultFileName,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return null;
    await invoke("write_text_file", { path, content });
    return path;
  },
};
