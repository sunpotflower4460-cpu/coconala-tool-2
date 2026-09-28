#!/usr/bin/env node
// ココナラのトークルームへ添付する納品zipを作る(CIの Linux ジョブで実行する。python3 が必要)。
//
//   node scripts/delivery/package-delivery.mjs --os mac --installer <dmg> [--unsigned]
//   node scripts/delivery/package-delivery.mjs --os windows --installer <setup.exe>
//
// 中身: インストーラー / はじめにお読みください.pdf / クイックスタートガイド.pdf /
//       ユーザーマニュアル.pdf / 利用規約.pdf / 免責事項.pdf / samples/*.csv
// ココナラの添付上限(1ファイル200MB)を超えたら失敗する。
// 署名・公証していない Mac 版は、誤って販売しないよう zip 名に -unsigned を付ける。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** ココナラのトークルームに添付できる1ファイルの上限(余裕を見て 200,000,000 バイト)。 */
export const COCONALA_ATTACHMENT_LIMIT_BYTES = 200_000_000;

export function deliveryZipName({ version, os, unsigned }) {
  return `MitsumoriDesk_${version}_${os}${unsigned ? "-unsigned" : ""}.zip`;
}

/** zip に入れるファイルの一覧 [元のパス, zip内の名前]。 */
export function deliveryFileList({ os, installerPath, docsDir, rootDir = ROOT }) {
  const files = [
    [installerPath, path.basename(installerPath)],
    [path.join(docsDir, os, "はじめにお読みください.pdf"), "はじめにお読みください.pdf"],
  ];
  for (const name of [
    "クイックスタートガイド.pdf",
    "ユーザーマニュアル.pdf",
    "利用規約.pdf",
    "免責事項.pdf",
  ]) {
    files.push([path.join(docsDir, "common", name), name]);
  }
  const samplesDir = path.join(rootDir, "delivery/samples");
  for (const name of readdirSync(samplesDir)
    .filter((file) => file.endsWith(".csv"))
    .sort()) {
    files.push([path.join(samplesDir, name), `samples/${name}`]);
  }
  return files;
}

export function assertWithinAttachmentLimit(sizeBytes, label) {
  if (sizeBytes > COCONALA_ATTACHMENT_LIMIT_BYTES) {
    throw new Error(
      `${label} が ${(sizeBytes / 1_000_000).toFixed(1)}MB あり、ココナラの添付上限(200MB)を超えています`,
    );
  }
}

/**
 * zip の中央ディレクトリを読み、ASCII以外の名前に UTF-8 フラグ(bit 11)が付いているか確かめる。
 * 付いていないと、Windows で日本語のファイル名が文字化けする。
 */
export function assertUtf8FileNames(zipPath) {
  const buffer = readFileSync(zipPath);
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("zipの形式を読み取れませんでした");
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    const flags = buffer.readUInt16LE(offset + 8);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const hasNonAscii = nameBytes.some((byte) => byte > 0x7f);
    if (hasNonAscii && (flags & 0x0800) === 0) {
      throw new Error("zip内の日本語ファイル名にUTF-8フラグがありません(Windowsで文字化けします)");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

export function packageDelivery({ os, installerPath, docsDir, outDir, unsigned, rootDir = ROOT }) {
  if (os !== "mac" && os !== "windows") throw new Error("--os は mac か windows です");
  if (!installerPath || !existsSync(installerPath)) {
    throw new Error(`インストーラーが見つかりません: ${installerPath}`);
  }
  const version = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8")).version;
  const zipName = deliveryZipName({ version, os, unsigned });
  const stageDir = path.join(outDir, `stage-${os}`, zipName.replace(/\.zip$/, ""));
  rmSync(path.dirname(stageDir), { recursive: true, force: true });
  for (const [source, target] of deliveryFileList({ os, installerPath, docsDir, rootDir })) {
    if (!existsSync(source)) throw new Error(`同梱するファイルがありません: ${source}`);
    const destination = path.join(stageDir, target);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  const zipPath = path.join(outDir, zipName);
  rmSync(zipPath, { force: true });
  // -X: 余分な属性を入れない。フォルダごと入れて、展開すると1つのフォルダになるようにする。
  // Python の zipfile は、ASCII以外のファイル名に UTF-8 フラグを付ける
  // (Info-ZIP の zip は環境によって付けず、Windows のエクスプローラーで文字化けする)。
  execFileSync(
    "python3",
    [
      "-c",
      [
        "import os, sys, zipfile",
        "root, out = sys.argv[1], sys.argv[2]",
        "base = os.path.dirname(root)",
        "with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:",
        "    for d, _, files in sorted(os.walk(root)):",
        "        for f in sorted(files):",
        "            p = os.path.join(d, f)",
        "            z.write(p, os.path.relpath(p, base))",
      ].join("\n"),
      stageDir,
      zipPath,
    ],
    { env: { ...process.env, PYTHONUTF8: "1" } },
  );
  assertUtf8FileNames(zipPath);
  const size = statSync(zipPath).size;
  assertWithinAttachmentLimit(size, zipName);
  const sha256 = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
  return { zipPath, size, sha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  try {
    const result = packageDelivery({
      os: arg("--os"),
      installerPath: arg("--installer") && path.resolve(arg("--installer")),
      docsDir: path.resolve(arg("--docs") ?? path.join(ROOT, "delivery-out/docs")),
      outDir: path.resolve(arg("--out") ?? path.join(ROOT, "delivery-out")),
      unsigned: process.argv.includes("--unsigned"),
    });
    console.log(`作成: ${result.zipPath}`);
    console.log(`サイズ: ${(result.size / 1_000_000).toFixed(1)}MB(上限 200MB)`);
    console.log(`SHA-256: ${result.sha256}`);
  } catch (error) {
    console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
