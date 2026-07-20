export type ColumnMapping = Record<string, number | null>;

export interface CsvRowIssue<T> {
  rowIndex: number;
  raw: string[];
  data: T | null;
  errors: string[];
}

function cell(row: string[], mapping: ColumnMapping, key: string): string | null {
  const index = mapping[key];
  if (index === null || index === undefined) return null;
  const value = row[index];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function readCell(row: string[], mapping: ColumnMapping, key: string): string | null {
  return cell(row, mapping, key);
}
