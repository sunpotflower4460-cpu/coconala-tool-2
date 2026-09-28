// ライセンスキーの形式(販売者用スクリプトとテストで共有する)。
//
//   MDK1.<base64url(payload JSON)>.<base64url(Ed25519署名 64byte)>
//
// - 署名対象は "MDK1." + payload部分 の UTF-8 バイト列そのもの(JSONの並び順に依存しない)
// - payload: { v: 1, prod: "mitsumori-desk", lid: "L-2026-0001", iat: "2026-10-01" }
// - 個人情報(氏名・メール・ココナラのユーザー名など)は入れない。購入者との対応は
//   販売者の手元の台帳(リポジトリ外)で管理する
// - アプリ側の検証は Rust(src-tauri/src/commands/license.rs)。公開鍵は
//   src-tauri/license/public_key.b64 に埋め込む
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export const LICENSE_PREFIX = "MDK1";
export const PRODUCT_ID = "mitsumori-desk";

// 開発用の鍵ペア。種(seed)を公開しているので、誰でも同じ鍵を作れる = 販売には使えない。
// 正式版では keygen.mjs で本番鍵を作り、public_key.b64 を差し替える(release gateで強制)。
export const DEV_KEY_SEED_TEXT = "mitsumori-desk-dev-license-v1";

// Ed25519 の PKCS#8 / SPKI DER の固定ヘッダー(RFC 8410)
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

export function privateKeyFromSeed(seed32) {
  if (seed32.length !== 32) throw new Error("seed must be 32 bytes");
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed32]),
    format: "der",
    type: "pkcs8",
  });
}

export function rawPublicKey(privateOrPublicKey) {
  const publicKey =
    privateOrPublicKey.type === "private"
      ? createPublicKey(privateOrPublicKey)
      : privateOrPublicKey;
  const der = publicKey.export({ format: "der", type: "spki" });
  return Buffer.from(der.subarray(SPKI_ED25519_PREFIX.length));
}

export function publicKeyFromRaw(raw32) {
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw32]),
    format: "der",
    type: "spki",
  });
}

export function devKeyPair() {
  const seed = createHash("sha256").update(DEV_KEY_SEED_TEXT).digest();
  const privateKey = privateKeyFromSeed(seed);
  return { privateKey, publicKeyBase64: rawPublicKey(privateKey).toString("base64") };
}

const LICENSE_ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function buildPayload({ licenseId, issuedAt }) {
  if (!LICENSE_ID_PATTERN.test(licenseId)) {
    throw new Error("licenseId は英数字とハイフンのみ(40文字以内)にしてください");
  }
  if (!DATE_PATTERN.test(issuedAt)) {
    throw new Error("issuedAt は YYYY-MM-DD 形式にしてください");
  }
  return { v: 1, prod: PRODUCT_ID, lid: licenseId, iat: issuedAt };
}

export function formatLicenseKey(payload, privateKey) {
  const payloadPart = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signingInput = `${LICENSE_PREFIX}.${payloadPart}`;
  const signature = sign(null, Buffer.from(signingInput, "utf-8"), privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/** 貼り付け時に混ざる改行・空白(全角含む)を取り除く。アプリ側と同じ規則。 */
export function normalizeLicenseKey(raw) {
  return raw.replace(/\s/g, "");
}

/** テスト・確認用の検証(アプリ本体はRustで検証する)。 */
export function verifyLicenseKey(raw, publicKeyBase64) {
  const key = normalizeLicenseKey(raw);
  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) return { ok: false, reason: "malformed" };
  const publicKey = publicKeyFromRaw(Buffer.from(publicKeyBase64, "base64"));
  const signature = Buffer.from(parts[2], "base64url");
  const valid = verify(null, Buffer.from(`${parts[0]}.${parts[1]}`, "utf-8"), publicKey, signature);
  if (!valid) return { ok: false, reason: "bad_signature" };
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  if (payload.prod !== PRODUCT_ID) return { ok: false, reason: "wrong_product" };
  return { ok: true, payload };
}
