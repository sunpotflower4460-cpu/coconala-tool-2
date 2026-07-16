#!/usr/bin/env node
// リリース前に、バージョン番号が3箇所で一致していることを確認する。
// 本番の署名・成果物検証(ハッシュ照合等)は、実際のGitHub Release作成後に
// docs/RELEASE_PROCESS.mdの手順に従って人間が確認する。

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8"));
  return pkg.version;
}

function readTauriConfVersion() {
  const conf = JSON.parse(readFileSync(path.join(rootDir, "src-tauri/tauri.conf.json"), "utf-8"));
  return conf.version;
}

function readCargoVersion() {
  const cargoToml = readFileSync(path.join(rootDir, "src-tauri/Cargo.toml"), "utf-8");
  const match = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  if (!match) {
    throw new Error("src-tauri/Cargo.tomlからversionを読み取れませんでした");
  }
  return match[1];
}

function checkChangelogMentionsVersion(version) {
  const changelog = readFileSync(path.join(rootDir, "CHANGELOG.md"), "utf-8");
  return changelog.includes(`[${version}]`) || changelog.includes("[Unreleased]");
}

const packageVersion = readPackageVersion();
const tauriVersion = readTauriConfVersion();
const cargoVersion = readCargoVersion();

const versions = {
  "package.json": packageVersion,
  "tauri.conf.json": tauriVersion,
  "Cargo.toml": cargoVersion,
};
const uniqueVersions = new Set(Object.values(versions));

let hasError = false;

if (uniqueVersions.size !== 1) {
  hasError = true;
  console.error("エラー: バージョン番号が一致していません。");
  for (const [file, version] of Object.entries(versions)) {
    console.error(`  ${file}: ${version}`);
  }
} else {
  console.log(`OK  バージョン番号が一致しています(${packageVersion})`);
}

if (!checkChangelogMentionsVersion(packageVersion)) {
  hasError = true;
  console.error(
    `エラー: CHANGELOG.mdに [${packageVersion}] または [Unreleased] セクションが見つかりません。`,
  );
} else {
  console.log("OK  CHANGELOG.mdにバージョンの記載があります");
}

if (hasError) {
  process.exit(1);
}
