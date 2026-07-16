import { describe, expect, it } from "vitest";
import { containsSecretLikeContent } from "@/domain/diagnostics/secret-scan";

describe("containsSecretLikeContent", () => {
  it("通常の診断情報(件数・バージョン等)は検出しない", () => {
    const safe = JSON.stringify({
      appVersion: "0.1.0",
      os: "linux",
      counts: { clients: 3, catalogItems: 5, documents: 2 },
    });
    expect(containsSecretLikeContent(safe)).toBe(false);
  });

  it("AnthropicのAPIキー形式を検出する", () => {
    expect(containsSecretLikeContent("sk-ant-api03-abcdefghijklmnopqrstuvwx")).toBe(true);
  });

  it("メールアドレスを検出する", () => {
    expect(containsSecretLikeContent("担当者: taro@example.com")).toBe(true);
  });

  it("長いbase64風の文字列を検出する", () => {
    expect(containsSecretLikeContent("a".repeat(50))).toBe(true);
  });
});
