import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEATURE_FLAGS,
  parseFeatureFlags,
  serializeFeatureFlags,
} from "@/domain/shared/feature-flags";

describe("parseFeatureFlags", () => {
  it("正常なJSONを既定値とマージして解釈する", () => {
    const flags = parseFeatureFlags(JSON.stringify({ updateCheckEnabled: true }));
    expect(flags.updateCheckEnabled).toBe(true);
  });

  it("空オブジェクトは既定値になる", () => {
    expect(parseFeatureFlags("{}")).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it("壊れたJSONは既定値にフォールバックする(起動不能にしない)", () => {
    expect(parseFeatureFlags("not json")).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it("配列やnullなど非オブジェクトも既定値にフォールバックする", () => {
    expect(parseFeatureFlags("null")).toEqual(DEFAULT_FEATURE_FLAGS);
    expect(parseFeatureFlags("[1,2,3]")).toEqual(DEFAULT_FEATURE_FLAGS);
  });
});

describe("serializeFeatureFlags", () => {
  it("parseFeatureFlagsと往復できる", () => {
    const flags = { updateCheckEnabled: true };
    expect(parseFeatureFlags(serializeFeatureFlags(flags))).toEqual(flags);
  });
});
