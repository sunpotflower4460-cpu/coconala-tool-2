import { describe, expect, it } from "vitest";
import { formatDocumentNumber, nextDocumentSequence } from "@/domain/documents";

describe("formatDocumentNumber", () => {
  it("プレフィックス-年-4桁連番の形式にする", () => {
    expect(formatDocumentNumber("EST", 2026, 1)).toBe("EST-2026-0001");
    expect(formatDocumentNumber("EST", 2026, 42)).toBe("EST-2026-0042");
  });
});

describe("nextDocumentSequence", () => {
  it("既存番号がなければ1から始まる", () => {
    expect(nextDocumentSequence([], "EST", 2026)).toBe(1);
  });

  it("同じプレフィックス・年の最大値+1を返す", () => {
    const existing = ["EST-2026-0001", "EST-2026-0002", "EST-2025-0009", "INV-2026-0005"];
    expect(nextDocumentSequence(existing, "EST", 2026)).toBe(3);
  });

  it("年またはプレフィックスが異なる番号は無視する", () => {
    const existing = ["EST-2025-0099", "INV-2026-0099"];
    expect(nextDocumentSequence(existing, "EST", 2026)).toBe(1);
  });
});
