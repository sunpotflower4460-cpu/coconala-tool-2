// 販売者用: 本番のライセンス署名鍵ペアを作る(最初に1回だけ)。
//
//   pnpm license:keygen [--out <秘密鍵の保存先.pem>]
//
// - 秘密鍵はリポジトリの外(既定 ~/.mitsumori-desk-license/private.pem)にだけ保存する
// - 表示された公開鍵で src-tauri/license/public_key.b64 を置き換えてコミットする
// - 秘密鍵を失くすと新しいキーを発行できなくなる。USBメモリ等へ必ずバックアップする
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rawPublicKey } from "./license-format.mjs";
import { assertOutsideRepo, DEFAULT_LICENSE_DIR } from "./paths.mjs";

const outIndex = process.argv.indexOf("--out");
const outPath =
  outIndex >= 0
    ? path.resolve(process.argv[outIndex + 1] ?? "")
    : path.join(DEFAULT_LICENSE_DIR, "private.pem");

try {
  assertOutsideRepo(outPath);
  if (existsSync(outPath)) {
    throw new Error(
      `既に秘密鍵があります: ${outPath}\n上書きすると、これまで発行したキーと新しいアプリが合わなくなります。別の場所を --out で指定してください。`,
    );
  }
  const { privateKey } = generateKeyPairSync("ed25519");
  mkdirSync(path.dirname(outPath), { recursive: true, mode: 0o700 });
  writeFileSync(outPath, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
  const publicKeyBase64 = rawPublicKey(privateKey).toString("base64");
  console.log("秘密鍵を保存しました(絶対に他人へ渡さない・コミットしない・必ずバックアップする):");
  console.log(`  ${outPath}`);
  console.log("");
  console.log("次の公開鍵で src-tauri/license/public_key.b64 を置き換えてください:");
  console.log(`  ${publicKeyBase64}`);
} catch (error) {
  console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
