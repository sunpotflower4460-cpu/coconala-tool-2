// nullは、保存先ダイアログでユーザーがキャンセルしたことを示す。
export interface FileExportPort {
  saveTextFile(defaultFileName: string, content: string): Promise<string | null>;
}
