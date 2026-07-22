import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// APIキー等の秘密情報は、OSの資格情報ストア(keyring)にのみ保存し、通常のSQLite DBには
// 一切保存しない設計(docs/SECURITY.md)。migrationファイルに、それらしき列名を追加する
// 変更が紛れ込んでいないかを機械的に検査する回帰テスト。
// SQLの列名はアンダースコア区切りが基本のため、`\b`(アンダースコアは単語構成文字として
// 扱われ境界にならない)ではなく、英数字のみを境界としない前後読みを使う。これにより
// `anthropic_api_key`のような接頭辞付きの列名も正しく検出できる。
const SECRET_COLUMN_PATTERN =
  /(?<![a-z0-9])(api_?key|secret|password|credential|access_?token)(?![a-z0-9])/i;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentDir, "../../../src-tauri/migrations");

describe("migrations", () => {
  it("APIキー・秘密情報らしき列名を追加していない", () => {
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);

    const offending: string[] = [];
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
      if (SECRET_COLUMN_PATTERN.test(sql)) {
        offending.push(file);
      }
    }
    expect(offending).toEqual([]);
  });
});

describe("SECRET_COLUMN_PATTERN", () => {
  it("接頭辞付きの列名(例: anthropic_api_key)も検出する", () => {
    for (const columnName of [
      "api_key",
      "anthropic_api_key",
      "openai_secret_key",
      "user_password",
      "access_token_value",
      "encrypted_api_key",
    ]) {
      expect(
        SECRET_COLUMN_PATTERN.test(`ALTER TABLE app_settings ADD COLUMN ${columnName} TEXT`),
      ).toBe(true);
    }
  });

  it("無関係な列名は誤検知しない", () => {
    for (const columnName of [
      "invoice_registration_number",
      "catalog_item_id",
      "estimate_valid_days",
      "bank_account_number",
    ]) {
      expect(
        SECRET_COLUMN_PATTERN.test(`ALTER TABLE companies ADD COLUMN ${columnName} TEXT`),
      ).toBe(false);
    }
  });
});
