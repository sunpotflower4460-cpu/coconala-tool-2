import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  assertSafeOutputPath,
  isAppConfigPath,
  parseSeedArgs,
  runSeedStressMain,
  STRESS_PROFILES,
} from "../../../scripts/seed-stress.mjs";
import { envWithStressSeedAllowed } from "../../../scripts/run-seed-stress.mjs";
import {
  assertSqlxMigratorWouldAccept,
  loadSqlxMigrations,
  SQLX_MIGRATION_COLUMNS,
} from "../../../scripts/sqlx-migrations.mjs";

describe("seed-stress", () => {
  it("本番アプリデータパスを検出する", () => {
    expect(isAppConfigPath("/home/user/.config/com.mitsumoridesk.desktop/stress.db")).toBe(true);
    expect(
      isAppConfigPath(
        "C:\\Users\\user\\AppData\\Roaming\\com.mitsumoridesk.desktop\\mitsumori-desk.db",
      ),
    ).toBe(true);
    expect(isAppConfigPath("/tmp/stress-test.db")).toBe(false);
  });

  it("本番アプリデータパスへの書き込みを拒否する", () => {
    expect(() => assertSafeOutputPath("/tmp/com.mitsumoridesk.desktop/stress.db")).toThrow(
      /本番アプリのデータフォルダ/,
    );
  });

  it("--allow-app-config は拒否する", () => {
    const result = runSeedStressMain(["--allow-app-config", "--profile=ci"], {
      MITSUMORI_ALLOW_STRESS_SEED: "1",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("--allow-app-config");
  });

  it("許可フラグなしでは実行できない", () => {
    const result = runSeedStressMain(["--profile=ci"], { MITSUMORI_ALLOW_STRESS_SEED: "" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("開発専用");
  });

  it("launcher は環境変数を POSIX 記法なしで付与する", () => {
    const env = envWithStressSeedAllowed({ MITSUMORI_ALLOW_STRESS_SEED: "", PATH: "/usr/bin" });
    expect(env.MITSUMORI_ALLOW_STRESS_SEED).toBe("1");
    expect(env.PATH).toBe("/usr/bin");
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.scripts["seed:stress"]).toBe("node scripts/run-seed-stress.mjs");
    expect(pkg.scripts["seed:stress:ci"]).toBe("node scripts/run-seed-stress.mjs --profile=ci");
    expect(pkg.scripts["seed:stress"]).not.toMatch(/^[A-Z_]+=/);
  });

  it("後から指定したプロファイルが優先される", () => {
    const parsed = parseSeedArgs(["--profile=full", "--profile=ci", "--out", "/tmp/x.db"]);
    expect(parsed.profileName).toBe("ci");
    expect(parsed.out).toBe("/tmp/x.db");
  });

  it("full プロファイルの件数定義を持つ(生成そのものは CI 必須にしない)", () => {
    expect(STRESS_PROFILES.full).toEqual({
      clients: 1000,
      catalogItems: 5000,
      documents: 10000,
    });
  });

  it("ci プロファイルで顧客・価格表・帳票を SQLx 互換 DB として生成する", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-stress-"));
    const out = join(dir, "ci.db");
    try {
      const result = runSeedStressMain(["--profile=ci", "--out", out], {
        MITSUMORI_ALLOW_STRESS_SEED: "1",
      });
      expect(result.ok, result.message).toBe(true);
      const db = new Database(out, { readonly: true });
      const clients = db.prepare("SELECT COUNT(*) AS n FROM clients").get().n;
      const items = db.prepare("SELECT COUNT(*) AS n FROM catalog_items").get().n;
      const documents = db.prepare("SELECT COUNT(*) AS n FROM documents").get().n;
      const columns = db
        .prepare("PRAGMA table_info(_sqlx_migrations)")
        .all()
        .map((row) => row.name);
      const schema = db.prepare("SELECT MAX(version) AS n FROM _sqlx_migrations").get().n;
      const migrations = loadSqlxMigrations();
      assertSqlxMigratorWouldAccept(db, migrations);
      db.close();
      expect(clients).toBe(STRESS_PROFILES.ci.clients);
      expect(items).toBe(STRESS_PROFILES.ci.catalogItems);
      expect(documents).toBe(STRESS_PROFILES.ci.documents);
      expect(schema).toBe(migrations[migrations.length - 1].version);
      expect(result.result.schemaVersion).toBe(schema);
      for (const column of SQLX_MIGRATION_COLUMNS) {
        expect(columns).toContain(column);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("既存ファイルの上書きを禁止する", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-stress-exists-"));
    const out = join(dir, "ci.db");
    try {
      const first = runSeedStressMain(["--profile=ci", "--out", out], {
        MITSUMORI_ALLOW_STRESS_SEED: "1",
      });
      expect(first.ok, first.message).toBe(true);
      const second = runSeedStressMain(["--profile=ci", "--out", out], {
        MITSUMORI_ALLOW_STRESS_SEED: "1",
      });
      expect(second.ok).toBe(false);
      expect(second.message).toContain("既に存在");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("version 列だけの _sqlx_migrations は SQLx migrator 相当の検査で失敗する", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE _sqlx_migrations (version INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO _sqlx_migrations (version) VALUES (1)");
    expect(() => assertSqlxMigratorWouldAccept(db, loadSqlxMigrations())).toThrow(
      /_sqlx_migrations/,
    );
    db.close();
  });
});
