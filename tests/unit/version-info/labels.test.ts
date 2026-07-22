import { describe, expect, it } from "vitest";
import { LICENSE_LABELS, updateResultLabel } from "@/features/version-info/labels";

describe("LICENSE_LABELS", () => {
  it("unlicensedを購入者向けに不安を与えない文言で表示する(買い切り商品であることが分かる)", () => {
    expect(LICENSE_LABELS.unlicensed).not.toMatch(/unlicensed/i);
    expect(LICENSE_LABELS.unlicensed).toMatch(/買い切り|ライセンス認証不要/);
  });
});

describe("updateResultLabel", () => {
  it("not_configuredのとき、更新は販売ページから手動で提供されることを明示する", () => {
    expect(updateResultLabel({ status: "not_configured" })).toMatch(/販売ページ.*手動/);
  });

  it("availableのとき新バージョン番号を表示する", () => {
    expect(updateResultLabel({ status: "available", version: "1.2.0", notes: null })).toContain(
      "1.2.0",
    );
  });
});
