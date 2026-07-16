// 新しいフラグを追加する場合はここへ追記する(スキーマ変更は不要、JSON列に保存される)。
export interface FeatureFlags {
  updateCheckEnabled: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  updateCheckEnabled: false,
};

export function parseFeatureFlags(json: string): FeatureFlags {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_FEATURE_FLAGS };
    }
    return { ...DEFAULT_FEATURE_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
}

export function serializeFeatureFlags(flags: FeatureFlags): string {
  return JSON.stringify(flags);
}
