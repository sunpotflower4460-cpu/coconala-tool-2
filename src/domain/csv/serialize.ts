export type CsvCell = string | number | null | undefined;

const UTF8_BOM = "﻿";
// Excel・スプレッドシートで式として実行されうる先頭文字(CSVインジェクション対策)
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return "";
    return String(cell);
  }
  // 文字列の先頭が式の記号なら ' を付けて文字として扱わせる(数値列はこの関数に数値で渡す)
  const text = FORMULA_TRIGGER.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV文字列を作る。Excelで文字化けしないよう UTF-8 BOM 付き、改行は CRLF。
 * 文字列セルは式として実行されないよう、先頭が = + - @ タブ なら ' を付ける。
 */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(","));
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}
