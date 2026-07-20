export type DuplicatePolicy = "skip" | "overwrite";

export interface CsvImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}
