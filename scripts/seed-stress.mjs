#!/usr/bin/env node
// 開発専用の大量データ生成。本番アプリのコマンドや画面からは呼ばない。
//
//   pnpm seed:stress
//   pnpm seed:stress:ci
//   node scripts/run-seed-stress.mjs --profile=ci --out=./tmp/stress-ci.db
//
// 既定の出力先はリポジトリ内の tmp/stress-test.db。購入者の本番DBへは書かない。
// 安全ガード(本番パス拒否・既存ファイル上書き禁止・明示フラグ)は維持する。
// package.json から呼ぶ場合は run-seed-stress.mjs がフラグを付ける。

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  applySqlxCompatibleMigrations,
  assertSqlxMigratorWouldAccept,
  loadSqlxMigrations,
} from "./sqlx-migrations.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const STRESS_PROFILES = {
  ci: { clients: 100, catalogItems: 200, documents: 50 },
  full: { clients: 1000, catalogItems: 5000, documents: 10000 },
};

export function parseSeedArgs(argv) {
  let profileName = "full";
  let out = path.join(rootDir, "tmp", "stress-test.db");
  let requestedAllowAppConfig = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--profile=")) {
      profileName = arg.slice("--profile=".length);
    } else if (arg === "--profile") {
      profileName = argv[index + 1] ?? profileName;
      index += 1;
    } else if (arg.startsWith("--out=")) {
      out = path.resolve(arg.slice("--out=".length));
    } else if (arg === "--out") {
      out = path.resolve(argv[index + 1] ?? out);
      index += 1;
    } else if (arg === "--allow-app-config") {
      requestedAllowAppConfig = true;
    }
  }
  return { profileName, out, requestedAllowAppConfig };
}

export function isAppConfigPath(targetPath) {
  const normalized = targetPath.replaceAll("\\", "/");
  return /(^|\/)com\.mitsumoridesk\.desktop(\/|$)/.test(normalized);
}

export function assertSafeOutputPath(targetPath) {
  if (isAppConfigPath(targetPath)) {
    throw new Error(
      "本番アプリのデータフォルダへは書き込みません。開発用の一時ファイルを --out で指定してください。",
    );
  }
}

export function runRealMigrations(db) {
  const migrations = loadSqlxMigrations();
  applySqlxCompatibleMigrations(db, migrations);
  assertSqlxMigratorWouldAccept(db, migrations);
  return migrations;
}

export function insertStressFixtures(db, counts, { now = "2026-08-31T00:00:00.000Z" } = {}) {
  db.exec(`
    INSERT OR IGNORE INTO companies (
      id, display_name, estimate_valid_days, payment_due_days, created_at, updated_at
    ) VALUES (1, '負荷試験用工房', 30, 30, '${now}', '${now}');
  `);

  const insertClient = db.prepare(`
    INSERT INTO clients (name, contact_name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertCatalog = db.prepare(`
    INSERT INTO catalog_items (
      name, unit, unit_price_yen, tax_category, is_active, created_at, updated_at
    ) VALUES (?, '式', ?, 'taxable_10', 1, ?, ?)
  `);
  const insertDocument = db.prepare(`
    INSERT INTO documents (
      document_type, status, client_id, pricing_type, rounding_mode,
      discount_yen, subtotal_yen, tax_yen, total_yen, created_at, updated_at
    ) VALUES ('estimate', 'draft', ?, 'tax_exclusive', 'floor', 0, 1000, 100, 1100, ?, ?)
  `);
  const insertLine = db.prepare(`
    INSERT INTO document_lines (
      document_id, sort_order, name, quantity, unit_price_yen, tax_category, line_discount_yen, amount_yen
    ) VALUES (?, 0, '負荷試験明細', 1, 1000, 'taxable_10', 0, 1000)
  `);

  const tx = db.transaction(() => {
    for (let index = 0; index < counts.clients; index += 1) {
      insertClient.run(`負荷試験顧客${index}`, `担当${index}`, now, now);
    }
    for (let index = 0; index < counts.catalogItems; index += 1) {
      insertCatalog.run(`負荷試験商品${index}`, 1000 + (index % 100), now, now);
    }
    const clientId = 1;
    for (let index = 0; index < counts.documents; index += 1) {
      const result = insertDocument.run(clientId, now, now);
      insertLine.run(Number(result.lastInsertRowid));
    }
  });
  tx();
}

export function createStressDatabase(dbPath, counts, options = {}) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  const migrations = runRealMigrations(db);
  const started = Date.now();
  insertStressFixtures(db, counts, options);
  const elapsedMs = Date.now() - started;
  const schemaVersion = db.prepare("SELECT MAX(version) AS n FROM _sqlx_migrations").get().n;
  db.close();
  return { dbPath, counts, elapsedMs, schemaVersion, migrationCount: migrations.length };
}

export function seedStressDatabase(dbPath, counts, options = {}) {
  return createStressDatabase(dbPath, counts, options);
}

export function runSeedStressMain(argv, env) {
  if (env.MITSUMORI_ALLOW_STRESS_SEED !== "1") {
    return {
      ok: false,
      message:
        "開発専用コマンドです。本番アプリからは実行できません。`pnpm seed:stress` を使ってください。",
    };
  }

  const args = parseSeedArgs(argv);
  if (args.requestedAllowAppConfig) {
    return {
      ok: false,
      message:
        "--allow-app-config は削除しました。本番データパスへは書き込めません。開発用の一時ファイルを --out で指定し、必要な場合だけ手動でコピーしてください。",
    };
  }
  const counts = STRESS_PROFILES[args.profileName];
  if (!counts) {
    return { ok: false, message: `不明なプロファイルです: ${args.profileName} (ci | full)` };
  }
  try {
    assertSafeOutputPath(args.out);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  if (existsSync(args.out)) {
    return { ok: false, message: `出力先が既に存在します: ${args.out}` };
  }

  const result = createStressDatabase(args.out, counts);
  return { ok: true, result, profileName: args.profileName };
}

const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const outcome = runSeedStressMain(process.argv.slice(2), process.env);
  if (!outcome.ok) {
    console.error(outcome.message);
    process.exit(1);
  }
  const { result, profileName } = outcome;
  console.warn(
    `seed:stress ${profileName}: clients=${result.counts.clients} catalog=${result.counts.catalogItems} documents=${result.counts.documents} elapsedMs=${result.elapsedMs} path=${result.dbPath}`,
  );
}
