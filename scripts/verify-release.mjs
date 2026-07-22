#!/usr/bin/env node
// リリース前に、バージョン番号の一致と、購入者向け成果物に残っている未確定情報
// (プレースホルダー・publisher/copyright未設定)を検出する。
//
// 既定(非strict)では未確定情報を警告として表示するのみで、通常のCIやPR上では
// 失敗させない(_DRAFT下書きが残っている開発中は当然の状態のため)。
// `--strict`(または環境変数 RELEASE_STRICT=1)を付けて実行した場合のみ、
// 未確定情報が1つでも残っていればエラー終了する。正式タグ(vX.Y.Z、rcを含まない)の
// リリースワークフローではこのstrictモードを使うこと(docs/RELEASE_GATES.md参照)。
//
// 本番の署名・成果物検証(ハッシュ照合等)は、実際のGitHub Release作成後に
// docs/RELEASE_PROCESS.mdの手順に従って人間が確認する。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict") || process.env.RELEASE_STRICT === "1";

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8"));
  return pkg.version;
}

function readTauriConf() {
  return JSON.parse(readFileSync(path.join(rootDir, "src-tauri/tauri.conf.json"), "utf-8"));
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

// [ ... ] 形式のプレースホルダー(利用規約・免責事項の下書きで使われている記法)を検出する。
// 直後に "(" が続く場合はMarkdownリンク記法([文言](URL))とみなして除外する。
const BRACKET_PLACEHOLDER = /\[[^[\]\n]*\S[^[\]\n]*\](?!\()/g;

function findBracketPlaceholders(relativePath) {
  const text = readFileSync(path.join(rootDir, relativePath), "utf-8");
  const matches = text.match(BRACKET_PLACEHOLDER) ?? [];
  return [...new Set(matches)];
}

// 利用規約・免責事項は、専門家レビュー確定後にファイル名から_DRAFTが外れる運用
// (docs/MANUAL_STEPS.md参照)。どちらの名前が存在するかを実行時に解決することで、
// リネーム後にreadFileSyncがENOENTでスクリプトごと落ちることを防ぐ。
const LEGAL_DOCS = [
  {
    label: "利用規約",
    draftPath: "docs/TERMS_OF_SERVICE_DRAFT.md",
    finalPath: "docs/TERMS_OF_SERVICE.md",
  },
  {
    label: "免責事項",
    draftPath: "docs/DISCLAIMER_DRAFT.md",
    finalPath: "docs/DISCLAIMER.md",
  },
];

function resolveLegalDoc(doc) {
  if (existsSync(path.join(rootDir, doc.finalPath))) {
    return { relativePath: doc.finalPath, isDraft: false };
  }
  if (existsSync(path.join(rootDir, doc.draftPath))) {
    return { relativePath: doc.draftPath, isDraft: true };
  }
  return null;
}

const versionErrors = [];
const placeholderFindings = [];

const packageVersion = readPackageVersion();
const tauriConf = readTauriConf();
const cargoVersion = readCargoVersion();

const versions = {
  "package.json": packageVersion,
  "tauri.conf.json": tauriConf.version,
  "Cargo.toml": cargoVersion,
};
const uniqueVersions = new Set(Object.values(versions));

if (uniqueVersions.size !== 1) {
  versionErrors.push("バージョン番号が一致していません。");
  for (const [file, version] of Object.entries(versions)) {
    versionErrors.push(`  ${file}: ${version}`);
  }
} else {
  console.log(`OK  バージョン番号が一致しています(${packageVersion})`);
}

if (!checkChangelogMentionsVersion(packageVersion)) {
  versionErrors.push(
    `CHANGELOG.mdに [${packageVersion}] または [Unreleased] セクションが見つかりません。`,
  );
} else {
  console.log("OK  CHANGELOG.mdにバージョンの記載があります");
}

// 利用規約・免責事項がどちらの名前で存在するかを解決し、下書き(_DRAFT)のままなら記録する。
const legalDocPaths = [];
for (const doc of LEGAL_DOCS) {
  const resolved = resolveLegalDoc(doc);
  if (!resolved) {
    placeholderFindings.push(`${doc.label}: ${doc.finalPath} も ${doc.draftPath} も見つかりません`);
    continue;
  }
  legalDocPaths.push(resolved.relativePath);
  if (resolved.isDraft) {
    placeholderFindings.push(
      `${resolved.relativePath}: ファイル名が_DRAFTのままです(専門家レビュー未確定)`,
    );
  }
}

// LICENSE / 利用規約 / 免責事項の [ ... ] プレースホルダー
for (const relativePath of ["LICENSE", ...legalDocPaths]) {
  const placeholders = findBracketPlaceholders(relativePath);
  if (placeholders.length > 0) {
    placeholderFindings.push(`${relativePath}: ${placeholders.join(", ")}`);
  }
}

// publisher / copyright 未設定
if (!tauriConf.bundle?.publisher) {
  placeholderFindings.push("src-tauri/tauri.conf.json: bundle.publisher が未設定です");
}
if (!tauriConf.bundle?.copyright) {
  placeholderFindings.push("src-tauri/tauri.conf.json: bundle.copyright が未設定です");
}

if (placeholderFindings.length > 0) {
  const label = strict ? "エラー" : "警告";
  console[strict ? "error" : "warn"](
    `${label}: 購入者向け成果物に未確定情報が残っています(${placeholderFindings.length}件)`,
  );
  for (const finding of placeholderFindings) {
    console[strict ? "error" : "warn"](`  - ${finding}`);
  }
  if (!strict) {
    console.warn(
      "  (正式タグのリリースではこれらを解消し、`pnpm check:release -- --strict` を通過させること。docs/RELEASE_GATES.md参照)",
    );
  }
} else {
  console.log("OK  未確定情報(プレースホルダー・publisher/copyright)は見つかりませんでした");
}

if (versionErrors.length > 0) {
  console.error("エラー:");
  for (const line of versionErrors) {
    console.error(`  ${line}`);
  }
}

if (versionErrors.length > 0 || (strict && placeholderFindings.length > 0)) {
  process.exit(1);
}
