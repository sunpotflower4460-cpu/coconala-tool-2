import { describe, expect, it } from "vitest";
import { canConvertDocument, isConvertibleStatus } from "@/domain/documents";

describe("canConvertDocument", () => {
  it("見積書は請求書・納品書へ変換できる", () => {
    expect(canConvertDocument("estimate", "invoice")).toBe(true);
    expect(canConvertDocument("estimate", "delivery_note")).toBe(true);
  });

  it("請求書は領収書へ変換できる", () => {
    expect(canConvertDocument("invoice", "receipt")).toBe(true);
  });

  it("許可されていない組み合わせはfalseになる", () => {
    expect(canConvertDocument("estimate", "receipt")).toBe(false);
    expect(canConvertDocument("delivery_note", "invoice")).toBe(false);
    expect(canConvertDocument("receipt", "invoice")).toBe(false);
  });
});

describe("isConvertibleStatus", () => {
  it("下書きは変換できない", () => {
    expect(isConvertibleStatus("draft")).toBe(false);
  });

  it("発行済み・承認済みは変換できる", () => {
    expect(isConvertibleStatus("issued")).toBe(true);
    expect(isConvertibleStatus("approved")).toBe(true);
  });

  it("却下・取消は変換できない", () => {
    expect(isConvertibleStatus("rejected")).toBe(false);
    expect(isConvertibleStatus("cancelled")).toBe(false);
  });
});
