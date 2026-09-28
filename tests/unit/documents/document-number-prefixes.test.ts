import { describe, expect, it } from "vitest";
import { validateDocumentNumberPrefixes } from "@/domain/documents/document-number";

const ok = { estimate: "EST", invoice: "INV", delivery: "DEL", receipt: "REC" };

describe("書類番号の記号の検査", () => {
  it("既定の記号は問題なし", () => {
    expect(validateDocumentNumberPrefixes(ok)).toEqual([]);
  });

  it("同じ記号(大文字小文字違いを含む)は認めない", () => {
    expect(validateDocumentNumberPrefixes({ ...ok, invoice: "est" })).toHaveLength(1);
  });

  it("空・記号・全角・長すぎは認めない", () => {
    expect(validateDocumentNumberPrefixes({ ...ok, estimate: "" }).length).toBeGreaterThan(0);
    expect(validateDocumentNumberPrefixes({ ...ok, estimate: "EST(" }).length).toBeGreaterThan(0);
    expect(validateDocumentNumberPrefixes({ ...ok, estimate: "見積" }).length).toBeGreaterThan(0);
    expect(
      validateDocumentNumberPrefixes({ ...ok, estimate: "ABCDEFGHIJK" }).length,
    ).toBeGreaterThan(0);
  });
});
