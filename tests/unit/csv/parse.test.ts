import { describe, expect, it } from "vitest";
import { parseCsv } from "@/domain/csv/parse";

describe("parseCsv", () => {
  it("単純なCSVを行・列に分解する", () => {
    const rows = parseCsv("顧客名,担当者名\nサンプル株式会社,山田太郎\n");
    expect(rows).toEqual([
      ["顧客名", "担当者名"],
      ["サンプル株式会社", "山田太郎"],
    ]);
  });

  it("引用符で囲まれたフィールド内のカンマ・改行・二重引用符を正しく扱う", () => {
    const rows = parseCsv('名前,備考\n"サンプル,株式会社","改行あり\n二重引用符""内側"""\n');
    expect(rows[1]).toEqual(["サンプル,株式会社", '改行あり\n二重引用符"内側"']);
  });

  it("CRLF改行にも対応する", () => {
    const rows = parseCsv("a,b\r\nc,d\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("末尾に改行がない最終行も取りこぼさない", () => {
    const rows = parseCsv("a,b\nc,d");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("空行は無視する", () => {
    const rows = parseCsv("顧客名,担当者名\n\nサンプル株式会社,山田太郎\n\n");
    expect(rows).toEqual([
      ["顧客名", "担当者名"],
      ["サンプル株式会社", "山田太郎"],
    ]);
  });

  it("空文字列は空配列を返す", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
