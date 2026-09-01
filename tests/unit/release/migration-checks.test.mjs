import { describe, expect, it } from "vitest";
import {
  assertSchemaCeilingMatchesLatest,
  collectMigrationCheckFindings,
  findDuplicateVersions,
  findNumberingGaps,
  parseRegisteredMigrations,
  parseTypescriptSchemaVersion,
} from "../../../scripts/migration-checks.mjs";

describe("migration-checks", () => {
  it("番号の重複と欠番を検出する", () => {
    expect(findDuplicateVersions([1, 2, 2, 4])).toEqual([2]);
    expect(findNumberingGaps([1, 2, 4])).toEqual(["2 の次が 4 です"]);
    expect(findNumberingGaps([2, 3])).toEqual(["先頭が1ではありません(先頭=2)"]);
    expect(findNumberingGaps([1, 2, 3, 4])).toEqual([]);
  });

  it("schema ceiling の不一致を CI で失敗させる", () => {
    expect(assertSchemaCeilingMatchesLatest(5, 4)).toMatch(/CURRENT_SCHEMA_VERSION\(4\)/);
    expect(assertSchemaCeilingMatchesLatest(4, 4)).toBeNull();
  });

  it("lib.rs の Migration 登録をパースする", () => {
    const parsed = parseRegisteredMigrations(`
        Migration {
            version: 1,
            description: "initial",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
    `);
    expect(parsed).toEqual([{ version: 1, description: "initial", sqlFile: "0001_initial.sql" }]);
  });

  it("TypeScript の CURRENT_SCHEMA_VERSION をパースする", () => {
    expect(parseTypescriptSchemaVersion("export const CURRENT_SCHEMA_VERSION = 4;\n")).toBe(4);
  });

  it("リポジトリの migration / schema version / lib.rs が同期している", () => {
    const findings = collectMigrationCheckFindings(process.cwd());
    expect(findings).toEqual([]);
  });
});
