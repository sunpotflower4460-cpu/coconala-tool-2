import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPayload,
  devKeyPair,
  formatLicenseKey,
  normalizeLicenseKey,
  verifyLicenseKey,
} from "../../../scripts/license/license-format.mjs";
import { assertOutsideRepo } from "../../../scripts/license/paths.mjs";

describe("ライセンスキーの形式(販売者スクリプト)", () => {
  const { privateKey, publicKeyBase64 } = devKeyPair();

  it("発行したキーを検証でき、個人情報を含まない", () => {
    const key = formatLicenseKey(
      buildPayload({ licenseId: "L-2026-0001", issuedAt: "2026-10-01" }),
      privateKey,
    );
    expect(key.startsWith("MDK1.")).toBe(true);
    const result = verifyLicenseKey(`${key.slice(0, 10)}\n ${key.slice(10)}`, publicKeyBase64);
    expect(result).toEqual({
      ok: true,
      payload: { v: 1, prod: "mitsumori-desk", lid: "L-2026-0001", iat: "2026-10-01" },
    });
  });

  it("中身を書き換えたキーは署名検証で失敗する", () => {
    const key = formatLicenseKey(
      buildPayload({ licenseId: "L-1", issuedAt: "2026-10-01" }),
      privateKey,
    );
    const [prefix, , signature] = key.split(".");
    const forged = Buffer.from(
      JSON.stringify({ v: 1, prod: "mitsumori-desk", lid: "FREE", iat: "2026-10-01" }),
    ).toString("base64url");
    expect(verifyLicenseKey(`${prefix}.${forged}.${signature}`, publicKeyBase64)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("ライセンス番号・日付の形式を検査する(メールアドレス等は入れられない)", () => {
    expect(() => buildPayload({ licenseId: "taro@example.com", issuedAt: "2026-10-01" })).toThrow();
    expect(() => buildPayload({ licenseId: "L-1", issuedAt: "2026/10/01" })).toThrow();
  });

  it("全角スペースや改行を取り除く", () => {
    expect(normalizeLicenseKey("MDK1.a　.b\n")).toBe("MDK1.a.b");
  });

  it("秘密鍵・台帳をリポジトリの中に置かせない", () => {
    const repo = path.resolve("/tmp/repo-root");
    expect(() => assertOutsideRepo("/tmp/repo-root/private.pem", repo)).toThrow();
    expect(() => assertOutsideRepo("/tmp/repo-root", repo)).toThrow();
    expect(() => assertOutsideRepo("/tmp/elsewhere/private.pem", repo)).not.toThrow();
  });
});
