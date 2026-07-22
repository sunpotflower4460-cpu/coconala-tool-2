import { describe, expect, it } from "vitest";
import {
  determineMatchStatus,
  reconcileCatalogCandidates,
  reconcileExtractedItem,
} from "@/domain/inquiries/reconcile";

describe("reconcileCatalogCandidates", () => {
  it("実在する価格表IDのみ残す(AIの幻覚IDを破棄する)", () => {
    const validIds = new Set([1, 2]);
    const result = reconcileCatalogCandidates(
      [
        { catalogItemId: 1, confidence: 0.9, reason: "一致" },
        { catalogItemId: 999, confidence: 0.95, reason: "存在しないID" },
      ],
      validIds,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.catalogItemId).toBe(1);
  });

  it("信頼度の降順に並べ替える", () => {
    const validIds = new Set([1, 2]);
    const result = reconcileCatalogCandidates(
      [
        { catalogItemId: 1, confidence: 0.5, reason: "" },
        { catalogItemId: 2, confidence: 0.9, reason: "" },
      ],
      validIds,
    );
    expect(result.map((c) => c.catalogItemId)).toEqual([2, 1]);
  });

  it("信頼度を0〜1の範囲に丸める(AIが範囲外を返した場合)", () => {
    const result = reconcileCatalogCandidates(
      [{ catalogItemId: 1, confidence: 1.5, reason: "" }],
      new Set([1]),
    );
    expect(result[0]?.confidence).toBe(1);
  });
});

describe("determineMatchStatus", () => {
  it("候補が0件ならunresolved", () => {
    expect(determineMatchStatus([], 1, "本")).toBe("unresolved");
  });

  it("数量が不明ならreview", () => {
    expect(
      determineMatchStatus([{ catalogItemId: 1, confidence: 0.95, reason: "" }], null, "本"),
    ).toBe("review");
  });

  it("数量が0ならreview(AIが誤って0を返しても自動確定しない)", () => {
    expect(
      determineMatchStatus([{ catalogItemId: 1, confidence: 0.95, reason: "" }], 0, "本"),
    ).toBe("review");
  });

  it("数量が負数ならreview", () => {
    expect(
      determineMatchStatus([{ catalogItemId: 1, confidence: 0.95, reason: "" }], -3, "本"),
    ).toBe("review");
  });

  it("単位が不明(null)ならreview", () => {
    expect(
      determineMatchStatus([{ catalogItemId: 1, confidence: 0.95, reason: "" }], 3, null),
    ).toBe("review");
  });

  it("単一の高信頼度候補ならmatched", () => {
    expect(determineMatchStatus([{ catalogItemId: 1, confidence: 0.9, reason: "" }], 3, "本")).toBe(
      "matched",
    );
  });

  it("信頼度が閾値未満ならreview", () => {
    expect(determineMatchStatus([{ catalogItemId: 1, confidence: 0.5, reason: "" }], 3, "本")).toBe(
      "review",
    );
  });

  it("複数候補が僅差ならreview(利用者に選ばせる)", () => {
    const candidates = [
      { catalogItemId: 1, confidence: 0.8, reason: "" },
      { catalogItemId: 2, confidence: 0.78, reason: "" },
    ];
    expect(determineMatchStatus(candidates, 3, "本")).toBe("review");
  });
});

describe("reconcileExtractedItem", () => {
  it("AI自身が申告したstatusを無視し、DB照合結果から再計算する", () => {
    const validIds = new Set([1]);
    const result = reconcileExtractedItem(
      {
        sourceText: "動画編集を3本",
        normalizedName: "動画編集",
        quantity: 3,
        unit: "本",
        catalogCandidates: [{ catalogItemId: 999, confidence: 0.99, reason: "AIは高信頼度と主張" }],
        questions: [],
      },
      validIds,
    );
    // 候補IDがDBに存在しないため、AIの主張に関わらずunresolvedになる
    expect(result.status).toBe("unresolved");
    expect(result.catalogCandidates).toHaveLength(0);
  });
});
