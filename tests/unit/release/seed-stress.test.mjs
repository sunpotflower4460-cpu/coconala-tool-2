import { mkdtempSync, rmSync } from "node:fs";
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

describe("seed-stress", () => {
  it("本番アプリデータパスを検出する", () => {
    expect(isAppConfigPath("/home/user/.config/com.mitsumoridesk.desktop/stress.db")).toBe(true);
    expect(isAppConfigPath("/tmp/stress-test.db")).toBe(false);
  });

  it("本番アプリデータパスへの書き込みを拒否する", () => {
    expect(() => assertSafeOutputPath("/tmp/com.mitsumoridesk.desktop/stress.db")).toThrow(
      /本番アプリのデータフォルダ/,
    );
  });

  it("許可フラグなしでは実行できない", () => {
    const result = runSeedStressMain(["--profile=ci"], { MITSUMORI_ALLOW_STRESS_SEED: "" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("MITSUMORI_ALLOW_STRESS_SEED");
  });

  it("後から指定したプロファイルが優先される", () => {
    const parsed = parseSeedArgs(["--profile=full", "--profile=ci", "--out", "/tmp/x.db"]);
    expect(parsed.profileName).toBe("ci");
    expect(parsed.out).toBe("/tmp/x.db");
  });

  it("ci プロファイルで顧客・価格表・帳票を生成する", () => {
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
      const schema = db.prepare("SELECT MAX(version) AS n FROM _sqlx_migrations").get().n;
      db.close();
      expect(clients).toBe(STRESS_PROFILES.ci.clients);
      expect(items).toBe(STRESS_PROFILES.ci.catalogItems);
      expect(documents).toBe(STRESS_PROFILES.ci.documents);
      expect(schema).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
