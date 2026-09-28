/**
 * ライセンス状態の抽象境界(ADR 0008 / 0009)。
 *
 * オフラインのライセンスキー(Ed25519署名)を検証する。検証結果は
 * 「バージョン情報・案内帯の表示」と「印刷物の『未認証版』透かし」にだけ使う。
 * ライセンスが無い・壊れている・検証できないことを理由に、会社情報・顧客・価格表・
 * 書類の閲覧・編集・発行・バックアップを止めてはいけない。
 * 書類の読み書きを行う application/commands・queries(ライセンス専用のものを除く)と
 * domain からは参照しないこと(tests/unit/production-risks の SEC-04 で検査)。
 */
export type LicenseInvalidReason =
  "malformed" | "bad_signature" | "unsupported_version" | "wrong_product" | "verifier_unavailable";

export type LicenseStatus =
  | { state: "unlicensed" }
  | { state: "valid"; licenseId: string; issuedAt: string }
  | { state: "invalid"; reason: LicenseInvalidReason };

export interface LicenseVerifierPort {
  /** キー文字列を検証する。例外を投げず、失敗は invalid で返すこと。 */
  verify(key: string): Promise<LicenseStatus>;
}
