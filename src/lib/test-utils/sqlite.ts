import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { DatabasePort, TransactionStatement } from "@/application/ports/database";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(currentDir, "../../../src-tauri/migrations");

export function loadMigrationSql(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8"));
}

/**
 * Tauri SQL pluginと同じmigrationファイルを、Node上の実SQLiteエンジン(better-sqlite3)へ
 * 適用したテスト用DatabasePort。integration testでSQL文そのものを検証するために使う。
 */
export function createTestDatabase(dbPath = ":memory:"): DatabasePort {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const alreadyMigrated = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'")
    .get();
  if (!alreadyMigrated) {
    for (const sql of loadMigrationSql()) {
      db.exec(sql);
    }
  }

  return {
    execute(sql, params = []) {
      const info = db.prepare(sql).run(...params);
      return Promise.resolve({
        rowsAffected: info.changes,
        lastInsertId: Number(info.lastInsertRowid),
      });
    },
    select<T>(sql: string, params: unknown[] = []) {
      return Promise.resolve(db.prepare(sql).all(...params) as T[]);
    },
    executeTransaction(statements: TransactionStatement[]) {
      const runAll = db.transaction((stmts: TransactionStatement[]) => {
        const results: { rowsAffected: number; lastInsertId: number }[] = [];
        for (const statement of stmts) {
          const resolvedParams = (statement.params ?? []).map((param) => {
            if (param !== null && typeof param === "object" && "$ref" in param) {
              const index = (param as { $ref: number }).$ref;
              return results[index]?.lastInsertId ?? null;
            }
            return param;
          });
          const info = db.prepare(statement.sql).run(...resolvedParams);
          results.push({ rowsAffected: info.changes, lastInsertId: Number(info.lastInsertRowid) });
        }
        return results;
      });
      // db.transaction()は例外を同期的に投げるため、Promiseの拒否として伝播させる。
      return Promise.resolve().then(() => runAll(statements));
    },
  };
}
