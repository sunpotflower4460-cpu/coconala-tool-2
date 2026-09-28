import { describe, expect, it } from "vitest";
import { detectImageMimeType } from "@/domain/assets/image";
import { addDaysToIsoDate, localTodayIsoDate } from "@/domain/documents/dates";
import {
  isValidInvoiceRegistrationNumber,
  normalizeInvoiceRegistrationNumber,
} from "@/domain/shared/invoice-registration";

describe("登録番号(適格請求書発行事業者)", () => {
  it("全角・小文字・ハイフン・空白を整えてから検査する", () => {
    expect(normalizeInvoiceRegistrationNumber("ｔ１２３４-５６７８ ９０１２３")).toBe(
      "T1234567890123",
    );
    expect(isValidInvoiceRegistrationNumber("T1234567890123")).toBe(true);
  });

  it("Tなし・桁数違いは無効", () => {
    expect(isValidInvoiceRegistrationNumber("1234567890123")).toBe(false);
    expect(isValidInvoiceRegistrationNumber("T123456789012")).toBe(false);
    expect(isValidInvoiceRegistrationNumber("T12345678901234")).toBe(false);
  });
});

describe("日付の計算", () => {
  it("月末・年末・うるう年をまたいで日数を足せる", () => {
    expect(addDaysToIsoDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToIsoDate("2026-12-25", 30)).toBe("2027-01-24");
    expect(addDaysToIsoDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("今日の日付を地域時刻の YYYY-MM-DD で返す", () => {
    expect(localTodayIsoDate(new Date(2026, 8, 5, 23, 59))).toBe("2026-09-05");
  });
});

describe("画像形式の判定", () => {
  it("PNG・JPEG をマジックナンバーで判定し、それ以外は拒否する", () => {
    expect(
      detectImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageMimeType(new TextEncoder().encode("<svg/>"))).toBeNull();
  });
});
