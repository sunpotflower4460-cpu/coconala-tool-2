// 販売者用: 購入者ごとのライセンスキーを発行する。
//
//   pnpm license:issue --id L-2026-0001 [--key <秘密鍵.pem>] [--date 2026-10-01]
//   pnpm license:issue --id DEV-0001 --dev   (開発用の鍵で試す。販売には使えない)
//
// - キーには個人情報を入れない。どの購入者にどの番号を渡したかは、
//   リポジトリ外の台帳(既定 ~/.mitsumori-desk-license/ledger.csv)に追記される
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import path from "node:path";
import {
  buildPayload,
  devKeyPair,
  formatLicenseKey,
  rawPublicKey,
  verifyLicenseKey,
} from "./license-format.mjs";
import { assertOutsideRepo, DEFAULT_LICENSE_DIR } from "./paths.mjs";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const licenseId = arg("--id");
  if (!licenseId) throw new Error("--id でライセンス番号を指定してください(例: --id L-2026-0001)");
  const issuedAt = arg("--date") ?? new Date().toISOString().slice(0, 10);
  const dev = process.argv.includes("--dev");

  let privateKey;
  if (dev) {
    privateKey = devKeyPair().privateKey;
  } else {
    const keyPath = path.resolve(arg("--key") ?? path.join(DEFAULT_LICENSE_DIR, "private.pem"));
    assertOutsideRepo(keyPath);
    if (!existsSync(keyPath)) {
      throw new Error(`秘密鍵が見つかりません: ${keyPath}(先に pnpm license:keygen を実行)`);
    }
    privateKey = createPrivateKey(readFileSync(keyPath));
  }

  const key = formatLicenseKey(buildPayload({ licenseId, issuedAt }), privateKey);
  const publicKeyBase64 = rawPublicKey(privateKey).toString("base64");
  const check = verifyLicenseKey(key, publicKeyBase64);
  if (!check.ok) throw new Error("発行したキーの自己検証に失敗しました");

  if (!dev) {
    const ledger = path.join(DEFAULT_LICENSE_DIR, "ledger.csv");
    assertOutsideRepo(ledger);
    if (!existsSync(ledger)) writeFileSync(ledger, "license_id,issued_at,memo\n", { mode: 0o600 });
    appendFileSync(ledger, `${licenseId},${issuedAt},\n`);
    console.log(`台帳に追記しました: ${ledger}(memo欄に注文番号などを手で記入してください)`);
  } else {
    console.log("※ 開発用の鍵で発行しました。販売用のアプリでは使えません。");
  }
  console.log("");
  console.log("ライセンスキー(このまま購入者へ送る):");
  console.log(key);
} catch (error) {
  console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
