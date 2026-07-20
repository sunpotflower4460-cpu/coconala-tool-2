import type { LicensePort, LicenseStatus } from "@/application/ports/license";

// 初期販売はライセンスチェックを行わない(docs/02_DEVELOPMENT_PHASES.md Phase5方針)。
// 将来ライセンスサーバーを導入する場合も、チェック失敗が既存の帳票データの閲覧を
// 妨げない設計を維持すること(このポートはUI表示にのみ使う)。
export const noLicenseCheck: LicensePort = {
  check(): Promise<LicenseStatus> {
    return Promise.resolve({ state: "unlicensed" });
  },
};
