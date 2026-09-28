export interface FileTypeFilter {
  name: string;
  extensions: string[];
}

// nullは、保存先ダイアログでユーザーがキャンセルしたことを示す。
export interface FileExportPort {
  /** filter を省略した場合は JSON(診断ファイル)として保存ダイアログを出す。 */
  saveTextFile(
    defaultFileName: string,
    content: string,
    filter?: FileTypeFilter,
  ): Promise<string | null>;
}
