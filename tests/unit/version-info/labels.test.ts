import { describe, expect, it } from "vitest";
import { LICENSE_LABELS, updateResultLabel } from "@/features/version-info/labels";

describe("LICENSE_LABELS", () => {
  it("開発用語をそのまま出さず、未登録のときは登録を案内する", () => {
    for (const label of Object.values(LICENSE_LABELS)) {
      expect(label).not.toMatch(/unlicensed|invalid|valid/i);
    }
    expect(LICENSE_LABELS.unlicensed).toMatch(/未登録/);
    expect(LICENSE_LABELS.valid).toMatch(/買い切り/);
  });
});

describe("updateResultLabel", () => {
  it("not_configuredのとき、新しい版はココナラのメッセージで届くことと自動更新がないことを明示する", () => {
    const label = updateResultLabel({ status: "not_configured" });
    expect(label).toMatch(/ココナラのメッセージ/);
    expect(label).toMatch(/自動更新はありません/);
  });

  it("availableのとき新バージョン番号を表示する", () => {
    expect(updateResultLabel({ status: "available", version: "1.2.0", notes: null })).toContain(
      "1.2.0",
    );
  });
});
