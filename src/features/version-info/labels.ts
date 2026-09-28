import type { LicenseInvalidReason, LicenseStatus } from "@/application/ports/license";
import type { UpdateCheckResult } from "@/application/ports/update-check";

// 表示用ラベル。LicenseVerifierPort/UpdateCheckPortが返す状態値そのものは変更しない(ADR 0008/0009)。
export const LICENSE_LABELS: Record<LicenseStatus["state"], string> = {
  unlicensed: "未登録(ライセンスキーを登録してください)",
  valid: "登録済み(買い切り版)",
  invalid: "確認できません(ライセンスキーを登録し直してください)",
};

export const LICENSE_INVALID_REASON_LABELS: Record<LicenseInvalidReason, string> = {
  malformed: "キーの形式が正しくありません(途中で切れている可能性があります)",
  bad_signature: "このアプリ用の正しいキーではありません",
  unsupported_version: "このバージョンでは使えないキーです。最新版をご利用ください",
  wrong_product: "別の商品のキーです",
  verifier_unavailable: "キーを確認できませんでした。アプリを再起動してください",
};

export function updateResultLabel(result: UpdateCheckResult): string {
  switch (result.status) {
    case "not_configured":
      return "新しい版は、ココナラのメッセージでお届けします(自動更新はありません)";
    case "up_to_date":
      return "最新バージョンです";
    case "available":
      return `新しいバージョン(${result.version})が利用可能です`;
    case "error":
      return `更新確認に失敗しました: ${result.message}`;
  }
}
