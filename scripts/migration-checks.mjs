// migration 番号・lib.rs の登録・TypeScript の schema version を同期検査する。
import { readFileSync } from "node:fs";
import path from "node:path";
import { latestMigrationVersion, loadSqlxMigrations } from "./sqlx-migrations.mjs";

export function parseRegisteredMigrations(libRsText) {
  const blocks = [];
  const pattern = /Migration\s*\{([^}]+)\}/g;
  let match = pattern.exec(libRsText);
  while (match) {
    const body = match[1];
    const version = Number(body.match(/version:\s*(\d+)/)?.[1]);
    const description = body.match(/description:\s*"([^"]+)"/)?.[1] ?? null;
    const sqlFile = body.match(/include_str!\("\.\.\/migrations\/([^"]+)"\)/)?.[1] ?? null;
    blocks.push({ version, description, sqlFile });
    match = pattern.exec(libRsText);
  }
  return blocks;
}

export function parseTypescriptSchemaVersion(sourceText) {
  const match = sourceText.match(/export const CURRENT_SCHEMA_VERSION = (\d+);/);
  if (!match) {
    throw new Error("src/domain/shared/schema-version.ts から CURRENT_SCHEMA_VERSION を読めません");
  }
  return Number(match[1]);
}

export function findDuplicateVersions(versions) {
  const seen = new Set();
  const duplicates = [];
  for (const version of versions) {
    if (seen.has(version)) {
      duplicates.push(version);
    }
    seen.add(version);
  }
  return duplicates;
}

export function findNumberingGaps(versions) {
  const unique = [...new Set(versions)].sort((left, right) => left - right);
  const gaps = [];
  if (unique[0] !== 1) {
    gaps.push(`先頭が1ではありません(先頭=${unique[0] ?? "なし"})`);
  }
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] !== unique[index - 1] + 1) {
      gaps.push(`${unique[index - 1]} の次が ${unique[index]} です`);
    }
  }
  return gaps;
}

export function assertSchemaCeilingMatchesLatest(latestVersion, schemaCeiling) {
  if (latestVersion !== schemaCeiling) {
    return `CURRENT_SCHEMA_VERSION(${schemaCeiling}) が最新 migration(${latestVersion}) と一致しません。TypeScript定数を更新してください。`;
  }
  return null;
}

export function collectMigrationCheckFindings(rootDir) {
  const errors = [];
  const migrationsDir = path.join(rootDir, "src-tauri/migrations");
  let migrations;
  try {
    migrations = loadSqlxMigrations(migrationsDir);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  if (migrations.length === 0) {
    return ["migrationファイルが見つかりません"];
  }

  const versions = migrations.map((migration) => migration.version);
  for (const duplicate of findDuplicateVersions(versions)) {
    errors.push(`migration version ${duplicate} が重複しています`);
  }
  for (const gap of findNumberingGaps(versions)) {
    errors.push(`migration 番号が連続していません: ${gap}`);
  }

  const libRsText = readFileSync(path.join(rootDir, "src-tauri/src/lib.rs"), "utf8");
  const registered = parseRegisteredMigrations(libRsText);
  if (registered.length !== migrations.length) {
    errors.push(
      `lib.rs の Migration 件数(${registered.length})が SQL ファイル数(${migrations.length})と一致しません`,
    );
  }
  const count = Math.min(registered.length, migrations.length);
  for (let index = 0; index < count; index += 1) {
    const file = migrations[index];
    const rust = registered[index];
    if (rust.version !== file.version) {
      errors.push(
        `lib.rs の version(${rust.version}) が ${file.file} の version(${file.version}) と一致しません`,
      );
    }
    if (rust.description !== file.description) {
      errors.push(
        `lib.rs の description("${rust.description}") が ${file.file} の description("${file.description}") と一致しません`,
      );
    }
    if (rust.sqlFile !== file.file) {
      errors.push(
        `lib.rs の include_str が ${rust.sqlFile} ですが、対応ファイルは ${file.file} です`,
      );
    }
  }

  const schemaSource = readFileSync(
    path.join(rootDir, "src/domain/shared/schema-version.ts"),
    "utf8",
  );
  let typescriptVersion;
  try {
    typescriptVersion = parseTypescriptSchemaVersion(schemaSource);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return errors;
  }
  const ceilingError = assertSchemaCeilingMatchesLatest(
    latestMigrationVersion(migrations),
    typescriptVersion,
  );
  if (ceilingError) {
    errors.push(ceilingError);
  }

  const hardcodedSqlxVersions = readFileSync(path.join(rootDir, "scripts/seed-stress.mjs"), "utf8");
  if (hardcodedSqlxVersions.includes("INSERT OR IGNORE INTO _sqlx_migrations (version) VALUES")) {
    errors.push(
      "scripts/seed-stress.mjs が _sqlx_migrations の version を手動列挙しています。migration ファイルから導出してください。",
    );
  }

  const backupSource = readFileSync(path.join(rootDir, "src-tauri/src/commands/backup.rs"), "utf8");
  if (/const CURRENT_SCHEMA_VERSION:\s*i64\s*=\s*\d+/.test(backupSource)) {
    errors.push(
      "backup.rs の CURRENT_SCHEMA_VERSION が固定値です。registered migrations から導出してください。",
    );
  }

  return errors;
}
