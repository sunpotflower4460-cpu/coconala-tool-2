// migrations/*.sqlが実SQLiteエンジンへ適用できるかを検証する。CIやコミット前に単独実行できる。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentDir, "../src-tauri/migrations");

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("migrationファイルが見つかりません:", migrationsDir);
  process.exit(1);
}

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");

for (const file of files) {
  const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
  try {
    db.exec(sql);
    console.log(`OK  ${file}`);
  } catch (error) {
    console.error(`NG  ${file}`);
    console.error(error);
    process.exit(1);
  }
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((row) => row.name);
console.log("作成されたテーブル:", tables.join(", "));

console.log(`すべてのmigration(${files.length}件)が正常に適用されました。`);
