// リリースゲート用の純粋な検査関数。scripts/verify-release.mjs から使う。
// 人間確認(実機・署名・公証・実API・β)を「完了」とみなす検査は置かない。

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const LEGAL_DOCS = [
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

export const SUPPORT_CONTACT_PENDING = "support-contact: PENDING";
export const SUPPORT_CONTACT_CONFIRMED = "support-contact: CONFIRMED";

const SUPPORT_CONTACT_FILES = [
  "README.md",
  "docs/USER_MANUAL.md",
  "src/features/help/HelpPage.tsx",
];

const UPDATER_DOC_HINTS = ["自動更新は未設定", "更新は販売ページから手動", "tauri-plugin-updater"];

const SECRET_LIKE_PATTERNS = [
  { name: "Anthropic APIキー", pattern: /sk-ant-[a-zA-Z0-9_-]{10,}/ },
  { name: "一般的なAPIキー", pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: "Google APIキー", pattern: /AIza[0-9A-Za-z_-]{35}/ },
];

const ALLOWED_EMAIL_DOMAINS = ["example.com", "example.org", "example.jp"];
const EMAIL_PATTERN = /[\w.+-]+@([\w-]+\.[a-zA-Z]{2,})/g;

const SKIP_SECRET_SCAN_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "target",
  "test-results",
  "playwright-report",
  "coverage",
]);

const SKIP_SECRET_SCAN_FILES = new Set([
  "pnpm-lock.yaml",
  "Cargo.lock",
  "package-lock.json",
  "yarn.lock",
]);

const SECRET_SCAN_ROOTS = ["LICENSE", "README.md", "CONTRIBUTING.md", "CLAUDE.md"];
const SECRET_SCAN_DIRS = ["docs", "src", "src-tauri/src", "src-tauri/capabilities", "scripts"];

export function parseMode(argv, env = process.env) {
  if (argv.includes("--strict") || env.RELEASE_STRICT === "1") return "strict";
  if (argv.includes("--rc") || env.RELEASE_RC === "1") return "rc";
  return "basic";
}

export function classifyGitTag(tagName) {
  if (!tagName) return "none";
  if (/^v\d+\.\d+\.\d+$/.test(tagName)) return "strict";
  if (/^v\d+\.\d+\.\d+-rc\.\d+$/.test(tagName)) return "rc";
  return "basic";
}

export function readPackageVersion(rootDir) {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8"));
  return pkg.version;
}

export function readTauriConf(rootDir) {
  return JSON.parse(readFileSync(path.join(rootDir, "src-tauri/tauri.conf.json"), "utf-8"));
}

export function readCargoVersion(rootDir) {
  const cargoToml = readFileSync(path.join(rootDir, "src-tauri/Cargo.toml"), "utf-8");
  const match = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  if (!match) {
    throw new Error("src-tauri/Cargo.tomlからversionを読み取れませんでした");
  }
  return match[1];
}

export function cargoHasUpdaterPlugin(cargoTomlText) {
  return /^\s*tauri-plugin-updater\s*=/m.test(cargoTomlText);
}

export function changelogHasExactVersion(changelog, version) {
  return changelog.includes(`[${version}]`);
}

export function changelogHasUnreleasedOrVersion(changelog, version) {
  return changelog.includes("[Unreleased]") || changelogHasExactVersion(changelog, version);
}

// [ ... ] 形式のプレースホルダー。直後に "(" が続く場合はMarkdownリンクとみなして除外する。
const BRACKET_PLACEHOLDER = /\[[^[\]\n]*\S[^[\]\n]*\](?!\()/g;

export function findBracketPlaceholders(text) {
  const matches = text.match(BRACKET_PLACEHOLDER) ?? [];
  return [...new Set(matches)];
}

export function resolveLegalDoc(rootDir, doc) {
  if (existsSync(path.join(rootDir, doc.finalPath))) {
    return { relativePath: doc.finalPath, isDraft: false };
  }
  if (existsSync(path.join(rootDir, doc.draftPath))) {
    return { relativePath: doc.draftPath, isDraft: true };
  }
  return null;
}

export function detectSupportContactState(texts) {
  const joined = texts.join("\n");
  const hasConfirmed = joined.includes(SUPPORT_CONTACT_CONFIRMED);
  const hasPending = joined.includes(SUPPORT_CONTACT_PENDING);
  if (hasConfirmed && !hasPending) return "confirmed";
  if (hasPending) return "pending";
  return "missing";
}

export function updaterDocumentationOk({ cargoTomlText, documentationText }) {
  if (cargoHasUpdaterPlugin(cargoTomlText)) {
    return { implemented: true, documented: true };
  }
  const documented = UPDATER_DOC_HINTS.some((hint) => documentationText.includes(hint));
  return { implemented: false, documented };
}

export function loadSupportedPlatforms(rootDir) {
  const file = path.join(rootDir, "docs/supported-platforms.json");
  return JSON.parse(readFileSync(file, "utf-8"));
}

export function findOsClaimConflicts(platforms, fileContents) {
  const conflicts = [];
  const official = new Set(platforms.firstSale ?? []);
  const forbidden = platforms.forbiddenOfficialClaims ?? {};

  for (const [platform, phrases] of Object.entries(forbidden)) {
    if (official.has(platform)) continue;
    for (const phrase of phrases) {
      for (const { relativePath, text } of fileContents) {
        if (text.includes(phrase)) {
          conflicts.push({
            platform,
            phrase,
            relativePath,
            message: `${relativePath}: 「${phrase}」は ${platform} が初回販売対象になるまで使えません(docs/SUPPORTED_PLATFORMS.md)`,
          });
        }
      }
    }
  }
  return conflicts;
}

export function findSecretLikeHits(text, relativePath) {
  const hits = [];
  for (const { name, pattern } of SECRET_LIKE_PATTERNS) {
    const cloned = new RegExp(pattern.source, pattern.flags);
    if (cloned.test(text)) {
      hits.push({ relativePath, name, message: `${relativePath}: ${name}らしき文字列` });
    }
  }
  const emails = text.matchAll(EMAIL_PATTERN);
  for (const match of emails) {
    const domain = match[1]?.toLowerCase() ?? "";
    const allowed = ALLOWED_EMAIL_DOMAINS.some(
      (candidate) => domain === candidate || domain.endsWith(`.${candidate}`),
    );
    if (allowed) {
      continue;
    }
    hits.push({
      relativePath,
      name: "メールアドレス",
      message: `${relativePath}: 本番向け成果物に実在しうるメールアドレス(${match[0]})`,
    });
  }
  return hits;
}

function shouldSkipSecretScanFile(relativePath) {
  const base = path.basename(relativePath);
  if (SKIP_SECRET_SCAN_FILES.has(base)) return true;
  if (/\.(test|spec)\.(ts|tsx|js|mjs|rs)$/.test(base)) return true;
  if (relativePath.includes(`${path.sep}tests${path.sep}`) || relativePath.startsWith("tests/")) {
    return true;
  }
  return false;
}

function walkFiles(absDir, relativeDir, files) {
  if (!existsSync(absDir)) return;
  for (const entry of readdirSync(absDir)) {
    if (SKIP_SECRET_SCAN_DIR_NAMES.has(entry)) continue;
    const abs = path.join(absDir, entry);
    const rel = path.join(relativeDir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walkFiles(abs, rel, files);
      continue;
    }
    if (!stat.isFile()) continue;
    if (shouldSkipSecretScanFile(rel)) continue;
    if (!/\.(md|ts|tsx|js|mjs|rs|json|yml|yaml|toml|txt)$/i.test(entry)) continue;
    files.push(rel.split(path.sep).join("/"));
  }
}

export function listSecretScanTargets(rootDir) {
  const files = [];
  for (const relative of SECRET_SCAN_ROOTS) {
    if (existsSync(path.join(rootDir, relative))) files.push(relative);
  }
  for (const dir of SECRET_SCAN_DIRS) {
    walkFiles(path.join(rootDir, dir), dir, files);
  }
  return files;
}

export function collectReleaseFindings(rootDir, mode) {
  const versionErrors = [];
  const placeholderFindings = [];
  const rcRequiredFindings = [];

  const packageVersion = readPackageVersion(rootDir);
  const tauriConf = readTauriConf(rootDir);
  const cargoTomlText = readFileSync(path.join(rootDir, "src-tauri/Cargo.toml"), "utf-8");
  const cargoVersion = readCargoVersion(rootDir);
  const changelog = readFileSync(path.join(rootDir, "CHANGELOG.md"), "utf-8");

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
  }

  if (mode === "strict") {
    if (!changelogHasExactVersion(changelog, packageVersion)) {
      versionErrors.push(
        `CHANGELOG.mdに正式版セクション [${packageVersion}] が見つかりません(Unreleasedだけでは不足です)。`,
      );
    }
  } else if (!changelogHasUnreleasedOrVersion(changelog, packageVersion)) {
    versionErrors.push(
      `CHANGELOG.mdに [${packageVersion}] または [Unreleased] セクションが見つかりません。`,
    );
  }

  const legalDocPaths = [];
  for (const doc of LEGAL_DOCS) {
    const resolved = resolveLegalDoc(rootDir, doc);
    if (!resolved) {
      placeholderFindings.push(
        `${doc.label}: ${doc.finalPath} も ${doc.draftPath} も見つかりません`,
      );
      continue;
    }
    legalDocPaths.push(resolved.relativePath);
    if (resolved.isDraft) {
      placeholderFindings.push(
        `${resolved.relativePath}: ファイル名が_DRAFTのままです(専門家レビュー未確定)`,
      );
    }
  }

  for (const relativePath of ["LICENSE", ...legalDocPaths]) {
    const text = readFileSync(path.join(rootDir, relativePath), "utf-8");
    const placeholders = findBracketPlaceholders(text);
    if (placeholders.length > 0) {
      placeholderFindings.push(`${relativePath}: ${placeholders.join(", ")}`);
    }
  }

  if (!tauriConf.bundle?.publisher) {
    placeholderFindings.push("src-tauri/tauri.conf.json: bundle.publisher が未設定です");
  }
  if (!tauriConf.bundle?.copyright) {
    placeholderFindings.push("src-tauri/tauri.conf.json: bundle.copyright が未設定です");
  }

  const supportTexts = SUPPORT_CONTACT_FILES.filter((relativePath) =>
    existsSync(path.join(rootDir, relativePath)),
  ).map((relativePath) => readFileSync(path.join(rootDir, relativePath), "utf-8"));
  const supportState = detectSupportContactState(supportTexts);
  if (supportState !== "confirmed") {
    placeholderFindings.push(
      `サポート窓口が未確定です(購入者向け文書に \`${SUPPORT_CONTACT_CONFIRMED}\` がなく、\`${SUPPORT_CONTACT_PENDING}\` のまま、または標識がありません)`,
    );
  }

  const documentationText = [
    readFileSync(path.join(rootDir, "README.md"), "utf-8"),
    existsSync(path.join(rootDir, "docs/USER_MANUAL.md"))
      ? readFileSync(path.join(rootDir, "docs/USER_MANUAL.md"), "utf-8")
      : "",
    existsSync(path.join(rootDir, "docs/ADR/0008-license-and-update-boundaries.md"))
      ? readFileSync(path.join(rootDir, "docs/ADR/0008-license-and-update-boundaries.md"), "utf-8")
      : "",
    existsSync(path.join(rootDir, "src/features/version-info/labels.ts"))
      ? readFileSync(path.join(rootDir, "src/features/version-info/labels.ts"), "utf-8")
      : "",
  ].join("\n");

  const updater = updaterDocumentationOk({ cargoTomlText, documentationText });
  if (!updater.implemented && !updater.documented) {
    rcRequiredFindings.push(
      "自動更新が未実装なのに、そのことがREADME・マニュアル・ADR 0008・バージョン情報ラベルのいずれにも明記されていません",
    );
  }

  const platforms = loadSupportedPlatforms(rootDir);
  const buyerFacingContents = (platforms.buyerFacingFiles ?? [])
    .filter((relativePath) => existsSync(path.join(rootDir, relativePath)))
    .map((relativePath) => ({
      relativePath,
      text: readFileSync(path.join(rootDir, relativePath), "utf-8"),
    }));
  for (const conflict of findOsClaimConflicts(platforms, buyerFacingContents)) {
    rcRequiredFindings.push(conflict.message);
  }

  const secretHits = [];
  for (const relativePath of listSecretScanTargets(rootDir)) {
    const abs = path.join(rootDir, relativePath);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf-8");
    secretHits.push(...findSecretLikeHits(text, relativePath));
  }

  return {
    packageVersion,
    versions,
    versionErrors,
    placeholderFindings,
    rcRequiredFindings,
    secretHits,
    updater,
    supportState,
    platforms,
  };
}

export function shouldFail(mode, findings) {
  if (findings.versionErrors.length > 0) return true;
  if (findings.secretHits.length > 0) return true;
  if (findings.rcRequiredFindings.length > 0 && mode !== "basic") return true;
  if (mode === "strict" && findings.placeholderFindings.length > 0) return true;
  return false;
}
