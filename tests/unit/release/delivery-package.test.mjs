import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deliveryDocumentPlan,
  markdownToHtml,
} from "../../../scripts/delivery/build-delivery-docs.mjs";
import {
  assertUtf8FileNames,
  assertWithinAttachmentLimit,
  COCONALA_ATTACHMENT_LIMIT_BYTES,
  deliveryFileList,
  deliveryZipName,
  packageDelivery,
} from "../../../scripts/delivery/package-delivery.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function fakeDocsDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "delivery-docs-"));
  for (const os of ["mac", "windows"]) {
    mkdirSync(path.join(dir, os), { recursive: true });
    writeFileSync(path.join(dir, os, "はじめにお読みください.pdf"), "%PDF-1.4");
  }
  mkdirSync(path.join(dir, "common"), { recursive: true });
  for (const name of ["クイックスタートガイド", "ユーザーマニュアル", "利用規約", "免責事項"]) {
    writeFileSync(path.join(dir, "common", `${name}.pdf`), "%PDF-1.4");
  }
  return dir;
}

describe("ココナラ納品zip", () => {
  it("署名していないMac版は zip 名に -unsigned を付ける", () => {
    expect(deliveryZipName({ version: "1.0.0", os: "mac", unsigned: true })).toBe(
      "MitsumoriDesk_1.0.0_mac-unsigned.zip",
    );
    expect(deliveryZipName({ version: "1.0.0", os: "windows", unsigned: false })).toBe(
      "MitsumoriDesk_1.0.0_windows.zip",
    );
  });

  it("インストーラー・説明書PDF・規約・サンプルCSVを同梱する", () => {
    const files = deliveryFileList({
      os: "mac",
      installerPath: "/x/MitsumoriDesk_1.0.0_universal.dmg",
      docsDir: "/docs",
      rootDir: root,
    }).map(([, name]) => name);
    expect(files).toEqual(
      expect.arrayContaining([
        "MitsumoriDesk_1.0.0_universal.dmg",
        "はじめにお読みください.pdf",
        "クイックスタートガイド.pdf",
        "ユーザーマニュアル.pdf",
        "利用規約.pdf",
        "免責事項.pdf",
        "samples/顧客サンプル.csv",
        "samples/価格表サンプル.csv",
      ]),
    );
  });

  it("200MB を超える場合は失敗させる", () => {
    expect(() =>
      assertWithinAttachmentLimit(COCONALA_ATTACHMENT_LIMIT_BYTES, "a.zip"),
    ).not.toThrow();
    expect(() => assertWithinAttachmentLimit(COCONALA_ATTACHMENT_LIMIT_BYTES + 1, "a.zip")).toThrow(
      /200MB/,
    );
  });

  it("作った zip は日本語のファイル名に UTF-8 フラグが付いている(Windowsで文字化けしない)", () => {
    const docsDir = fakeDocsDir();
    const outDir = mkdtempSync(path.join(tmpdir(), "delivery-out-"));
    const installer = path.join(outDir, "MitsumoriDesk_0.0.0_x64-setup.exe");
    writeFileSync(installer, "MZ");
    const result = packageDelivery({
      os: "windows",
      installerPath: installer,
      docsDir,
      outDir,
      unsigned: false,
      rootDir: root,
    });
    expect(path.basename(result.zipPath)).toMatch(/^MitsumoriDesk_.*_windows\.zip$/);
    expect(() => assertUtf8FileNames(result.zipPath)).not.toThrow();
    rmSync(docsDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });
});

describe("購入者向けPDFの元原稿", () => {
  it("OSごとの「はじめにお読みください」と共通の説明書・規約を作る", () => {
    const outputs = deliveryDocumentPlan(root).map((item) => item.output);
    expect(outputs).toEqual(
      expect.arrayContaining([
        "mac/はじめにお読みください.pdf",
        "windows/はじめにお読みください.pdf",
        "common/クイックスタートガイド.pdf",
        "common/ユーザーマニュアル.pdf",
        "common/利用規約.pdf",
        "common/免責事項.pdf",
      ]),
    );
  });

  it("規約が下書きのままなら、PDFにも下書きと表示する", () => {
    const legal = deliveryDocumentPlan(root).filter((item) => item.output.includes("利用規約"));
    expect(legal[0]?.draft).toBe(true);
  });

  it("開発者向けのHTMLコメントはPDFに出さない", () => {
    expect(markdownToHtml("<!-- support-contact: PENDING -->\n# 見出し")).not.toContain(
      "support-contact",
    );
  });
});
