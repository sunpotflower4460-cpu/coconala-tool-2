import type { FileExportPort } from "@/application/ports/file-export";

export function createFakeFileExport(): FileExportPort & {
  saved: { path: string; content: string }[];
} {
  const saved: { path: string; content: string }[] = [];
  return {
    saved,
    saveTextFile(defaultFileName: string, content: string) {
      const path = `/tmp/${defaultFileName}`;
      saved.push({ path, content });
      return Promise.resolve(path);
    },
  };
}
