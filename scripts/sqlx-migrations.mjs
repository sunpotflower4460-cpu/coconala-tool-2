// Tauri(sqlx / tauri-plugin-sql)と同じ _sqlx_migrations 形状と checksum を、
// リポジトリ内の migration ファイルから自動導出する。
// SQL migration を追加したら、このモジュールはファイル一覧から追従する(手動の version 列挙はしない)。

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MIGRATIONS_DIR = path.resolve(currentDir, "../src-tauri/migrations");

export const SQLX_MIGRATION_COLUMNS = [
  "version",
  "description",
  "installed_on",
  "success",
  "checksum",
  "execution_time",
];

// sqlx-sqlite の Migrate::ensure_migrations_table と同じ DDL。整形しないこと。
export const SQLX_MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    checksum BLOB NOT NULL,
    execution_time BIGINT NOT NULL
);`;

const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export function parseMigrationFileName(fileName) {
  const match = fileName.match(MIGRATION_FILE_PATTERN);
  if (!match) {
    return null;
  }
  return {
    version: Number(match[1]),
    description: match[2],
  };
}

export function checksumSqlBytes(sqlBytes) {
  return createHash("sha384").update(sqlBytes).digest();
}

export function loadSqlxMigrations(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return files.map((file) => {
    const parsed = parseMigrationFileName(file);
    if (!parsed) {
      throw new Error(
        `migrationファイル名が不正です: ${file} (NNNN_short_description.sql 形式にしてください)`,
      );
    }
    const filePath = path.join(migrationsDir, file);
    const sqlBytes = readFileSync(filePath);
    return {
      file,
      filePath,
      version: parsed.version,
      description: parsed.description,
      sql: sqlBytes.toString("utf8"),
      sqlBytes,
      checksum: checksumSqlBytes(sqlBytes),
    };
  });
}

export function latestMigrationVersion(migrations) {
  return migrations.reduce((max, migration) => Math.max(max, migration.version), 0);
}

export function applySqlxCompatibleMigrations(db, migrations) {
  db.exec(SQLX_MIGRATIONS_TABLE_SQL);
  const insert = db.prepare(
    `INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time)
     VALUES (?, ?, 1, ?, ?)`,
  );
  for (const migration of migrations) {
    const started = process.hrtime.bigint();
    db.exec(migration.sql);
    const executionTime = Number(process.hrtime.bigint() - started);
    insert.run(migration.version, migration.description, migration.checksum, executionTime);
  }
}

function buffersEqual(left, right) {
  const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(left);
  const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && leftBuffer.equals(rightBuffer);
}

// sqlx migrator が起動時に行う ensure_migrations_table + checksum 照合を再現する。
// 不完全な _sqlx_migrations(version 列のみ等)はここで失敗する。
export function assertSqlxMigratorWouldAccept(db, migrations) {
  const columns = db
    .prepare("PRAGMA table_info(_sqlx_migrations)")
    .all()
    .map((row) => row.name);
  for (const column of SQLX_MIGRATION_COLUMNS) {
    if (!columns.includes(column)) {
      throw new Error(
        `SQLx互換の _sqlx_migrations に ${column} がありません(列: ${columns.join(", ")})`,
      );
    }
  }

  const rows = db
    .prepare(
      "SELECT version, description, success, checksum, execution_time FROM _sqlx_migrations ORDER BY version",
    )
    .all();
  if (rows.length !== migrations.length) {
    throw new Error(
      `_sqlx_migrations の件数(${rows.length})が migration ファイル数(${migrations.length})と一致しません`,
    );
  }
  for (let index = 0; index < migrations.length; index += 1) {
    const row = rows[index];
    const migration = migrations[index];
    if (Number(row.version) !== migration.version) {
      throw new Error(
        `_sqlx_migrations.version が一致しません: db=${row.version} file=${migration.version}`,
      );
    }
    if (row.success !== 1 && row.success !== true) {
      throw new Error(`migration version=${migration.version} が success=1 ではありません`);
    }
    if (!buffersEqual(row.checksum, migration.checksum)) {
      throw new Error(
        `migration version=${migration.version} の checksum が SQL ファイルの SHA-384 と一致しません`,
      );
    }
  }
}
