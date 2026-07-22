import type { LicenseStatus } from "@/application/ports/license";
import type { UpdateCheckResult } from "@/application/ports/update-check";

// 表示用ラベル。LicensePort/UpdateCheckPortが返す状態値そのものは変更しない(ADR 0008)。
export const LICENSE_LABELS: Record<LicenseStatus["state"], string> = {
  unlicensed: "買い切り版(ライセンス認証不要)",
  valid: "有効",
  invalid: "無効",
};

export function updateResultLabel(result: UpdateCheckResult): string {
  switch (result.status) {
    case "not_configured":
      return "更新は販売ページから手動で提供します(自動更新は未設定です)";
    case "up_to_date":
      return "最新バージョンです";
    case "available":
      return `新しいバージョン(${result.version})が利用可能です`;
    case "error":
      return `更新確認に失敗しました: ${result.message}`;
  }
}
