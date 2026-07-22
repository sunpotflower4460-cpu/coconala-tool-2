import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// APIキー等の秘密情報は、OSの資格情報ストア(keyring)にのみ保存し、通常のSQLite DBには
// 一切保存しない設計(docs/SECURITY.md)。migrationファイルに、それらしき列名を追加する
// 変更が紛れ込んでいないかを機械的に検査する回帰テスト。
const SECRET_COLUMN_PATTERN = /\b(api_?key|secret|password|credential|access_?token)\b/i;

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
