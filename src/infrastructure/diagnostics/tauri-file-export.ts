import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { FileExportPort, FileTypeFilter } from "@/application/ports/file-export";

const JSON_FILTER: FileTypeFilter = { name: "JSON", extensions: ["json"] };

export const tauriFileExport: FileExportPort = {
  async saveTextFile(
    defaultFileName: string,
    content: string,
    filter: FileTypeFilter = JSON_FILTER,
  ): Promise<string | null> {
    const path = await save({ defaultPath: defaultFileName, filters: [filter] });
    if (!path) return null;
    await invoke("write_text_file", { path, content });
    return path;
  },
};
