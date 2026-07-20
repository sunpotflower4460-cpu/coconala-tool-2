/**
 * ライセンス状態の抽象境界。
 *
 * 方針(docs/02_DEVELOPMENT_PHASES.md Phase5): 販売テスト中は常時オンライン認証のような
 * 複雑なライセンスチェックを行わない。ライセンスチェックの失敗・未導入が、既存の
 * 会社情報・顧客・価格表・見積書等のデータ閲覧を妨げることは絶対にあってはならない。
 * このポートは表示目的(バージョン情報画面での状態表示)にのみ使い、
 * 書類の読み書きを行うapplication/domain層のコマンド・クエリからは参照しないこと。
 */
export type LicenseStatus =
  | { state: "unlicensed" }
  | { state: "valid"; licensedTo: string | null }
  | { state: "invalid"; reason: string };

export interface LicensePort {
  check(): Promise<LicenseStatus>;
}
