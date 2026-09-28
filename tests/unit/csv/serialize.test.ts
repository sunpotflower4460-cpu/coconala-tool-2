import { describe, expect, it } from "vitest";
import { parseCsv } from "@/domain/csv/parse";
import { toCsv } from "@/domain/csv/serialize";

describe("CSV書き出し(toCsv)", () => {
  it("UTF-8 BOM 付き・CRLF で、Excel で文字化けしない形にする", () => {
    const csv = toCsv(["名前", "金額"], [["山田", 1000]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿名前,金額\r\n山田,1000\r\n");
  });

  it("カンマ・ダブルクオート・改行を含むセルを正しく囲む", () => {
    const csv = toCsv(["備考"], [['A,B "C"\n改行']]);
    expect(csv).toContain('"A,B ""C""\n改行"');
    const parsed = parseCsv(csv.slice(1));
    expect(parsed[1]).toEqual(['A,B "C"\n改行']);
  });

  it("式として実行されうる文字列の先頭に ' を付ける(数値の列には付けない)", () => {
    const csv = toCsv(
      ["名前", "金額"],
      [
        ['=HYPERLINK("http://x")', -100],
        ["+81-3", 0],
        ["@SUM(A1)", 1],
        ["-特急-", 2],
      ],
    );
    const rows = parseCsv(csv.slice(1)).slice(1);
    expect(rows.map((row) => row[0])).toEqual([
      '\'=HYPERLINK("http://x")',
      "'+81-3",
      "'@SUM(A1)",
      "'-特急-",
    ]);
    expect(rows[0]?.[1]).toBe("-100");
  });

  it("null・undefined・非有限数は空欄にする", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, Number.NaN]])).toBe("﻿a,b,c\r\n,,\r\n");
  });
});
