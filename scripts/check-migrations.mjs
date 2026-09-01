#!/usr/bin/env node
// migrations/*.sqlが実SQLiteエンジンへ適用できるか、番号・登録・schema versionが同期しているかを検証する。
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";
import { collectMigrationCheckFindings } from "./migration-checks.mjs";
import {
  applySqlxCompatibleMigrations,
  loadSqlxMigrations,
  SQLX_MIGRATION_COLUMNS,
} from "./sqlx-migrations.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const findings = collectMigrationCheckFindings(rootDir);
if (findings.length > 0) {
  console.error("migration同期チェックに失敗しました:");
  for (const finding of findings) {
    console.error(`  - ${finding}`);
  }
  process.exit(1);
}

const migrations = loadSqlxMigrations();
const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
try {
  applySqlxCompatibleMigrations(db, migrations);
} catch (error) {
  console.error("SQLx互換migrationの適用に失敗しました");
  console.error(error);
  process.exit(1);
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((row) => row.name);
const sqlxColumns = db
  .prepare("PRAGMA table_info(_sqlx_migrations)")
  .all()
  .map((row) => row.name);

console.log("作成されたテーブル:", tables.join(", "));
console.log("_sqlx_migrations 列:", sqlxColumns.join(", "));
if (SQLX_MIGRATION_COLUMNS.some((column) => !sqlxColumns.includes(column))) {
  console.error("SQLx互換の _sqlx_migrations 列が不足しています");
  process.exit(1);
}

console.log(
  `すべてのmigration(${migrations.length}件)が正常に適用され、schema version=${migrations[migrations.length - 1].version} と同期しています。`,
);
