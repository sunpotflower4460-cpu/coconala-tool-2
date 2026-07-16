import { describe, expect, it } from "vitest";
import { decodeCsvBytes } from "@/domain/csv/encoding";

describe("decodeCsvBytes", () => {
  it("UTF-8のバイト列を自動判定して復元する", () => {
    const bytes = new TextEncoder().encode("顧客名,担当者名\nサンプル株式会社,山田太郎\n");
    const { text, encoding } = decodeCsvBytes(bytes.buffer);
    expect(encoding).toBe("utf-8");
    expect(text).toContain("サンプル株式会社");
  });

  it("UTF-8 BOM付きでも正しく復元する", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode("a,b\n1,2\n");
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);
    const { text, encoding } = decodeCsvBytes(merged.buffer);
    expect(encoding).toBe("utf-8");
    expect(text.startsWith("﻿")).toBe(false);
  });

  it("forceEncodingで手動指定した場合はそれに従う", () => {
    const bytes = new TextEncoder().encode("a,b\n1,2\n");
    const { encoding } = decodeCsvBytes(bytes.buffer, "shift_jis");
    expect(encoding).toBe("shift_jis");
  });
});
