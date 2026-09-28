#!/usr/bin/env node
// ココナラ納品用の購入者向けPDFを、リポジトリ内のMarkdownから作る。
//
//   node scripts/delivery/build-delivery-docs.mjs [--out delivery-out/docs]
//
// 出力:
//   <out>/common/クイックスタートガイド.pdf / ユーザーマニュアル.pdf / 利用規約.pdf / 免責事項.pdf
//   <out>/mac/はじめにお読みください.pdf      (README_FIRST + Macのインストール手順)
//   <out>/windows/はじめにお読みください.pdf  (README_FIRST + Windowsのインストール手順)
//
// 日本語フォントはOSのもの(CIでは fonts-noto-cjk)を使う。Chromiumの場所は
// PLAYWRIGHT_CHROMIUM_EXECUTABLE で指定できる(未指定ならPlaywright既定)。
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const LEGAL_SOURCES = [
  {
    title: "利用規約",
    finalPath: "docs/TERMS_OF_SERVICE.md",
    draftPath: "docs/TERMS_OF_SERVICE_DRAFT.md",
  },
  { title: "免責事項", finalPath: "docs/DISCLAIMER.md", draftPath: "docs/DISCLAIMER_DRAFT.md" },
];

/** 生成するPDFの一覧(テストからも使う)。 */
export function deliveryDocumentPlan(rootDir = ROOT) {
  const plan = [
    {
      output: "common/クイックスタートガイド.pdf",
      title: "クイックスタートガイド",
      sources: ["docs/QUICK_START_GUIDE.md"],
      draft: false,
    },
    {
      output: "common/ユーザーマニュアル.pdf",
      title: "ユーザーマニュアル",
      sources: ["docs/USER_MANUAL.md"],
      draft: false,
    },
    {
      output: "mac/はじめにお読みください.pdf",
      title: "はじめにお読みください(Mac)",
      sources: ["delivery/README_FIRST.md", "docs/INSTALL_GUIDE_MAC.md"],
      draft: false,
    },
    {
      output: "windows/はじめにお読みください.pdf",
      title: "はじめにお読みください(Windows)",
      sources: ["delivery/README_FIRST.md", "docs/INSTALL_GUIDE_WINDOWS.md"],
      draft: false,
    },
  ];
  for (const legal of LEGAL_SOURCES) {
    const isFinal = existsSync(path.join(rootDir, legal.finalPath));
    plan.push({
      output: `common/${legal.title}.pdf`,
      title: legal.title,
      sources: [isFinal ? legal.finalPath : legal.draftPath],
      // 専門家レビュー前の下書きは、PDFにも「下書き」と明示する
      draft: !isFinal,
    });
  }
  return plan;
}

/** 開発者向けのHTMLコメント(support-contact の標識など)を除いてからHTMLにする。 */
export function markdownToHtml(markdown) {
  const cleaned = markdown.replace(/<!--[\s\S]*?-->/g, "");
  return marked.parse(cleaned, { async: false });
}

export function buildHtmlDocument({ title, bodyHtml, draft }) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
         font-size: 10.5pt; line-height: 1.75; color: #111; }
  h1 { font-size: 18pt; border-bottom: 2px solid #1f6feb; padding-bottom: 4px; margin-top: 0; }
  h2 { font-size: 13.5pt; margin-top: 1.6em; border-left: 4px solid #1f6feb; padding-left: 8px; }
  h3 { font-size: 11.5pt; margin-top: 1.2em; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
  th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
  th { background: #eef3fb; }
  code { font-family: "Noto Sans Mono CJK JP", monospace; background: #f3f3f3; padding: 0 3px; }
  h1, h2, h3 { break-after: avoid; }
  tr, li { break-inside: avoid; }
  .draft { border: 2px solid #c0392b; color: #c0392b; padding: 6px 10px; font-weight: bold; margin-bottom: 1em; }
  .page-break { break-before: page; }
</style></head>
<body>
${draft ? '<p class="draft">この文書は下書きです。販売開始前に内容を確定します。</p>' : ""}
${bodyHtml}
</body></html>`;
}

async function launchBrowser() {
  const { chromium } = await import("@playwright/test");
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
  return chromium.launch(executablePath ? { executablePath } : {});
}

export async function buildDeliveryDocs(outDir, rootDir = ROOT) {
  const browser = await launchBrowser();
  const written = [];
  try {
    const page = await browser.newPage();
    for (const item of deliveryDocumentPlan(rootDir)) {
      const bodyHtml = item.sources
        .map((source, index) => {
          const html = markdownToHtml(readFileSync(path.join(rootDir, source), "utf-8"));
          return index === 0 ? html : `<div class="page-break"></div>${html}`;
        })
        .join("\n");
      await page.setContent(buildHtmlDocument({ title: item.title, bodyHtml, draft: item.draft }), {
        waitUntil: "load",
      });
      const target = path.join(outDir, item.output);
      mkdirSync(path.dirname(target), { recursive: true });
      await page.pdf({
        path: target,
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#666;">
          見積・請求書デスク ${item.title} — <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
        margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      });
      written.push(target);
    }
  } finally {
    await browser.close();
  }
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf("--out");
  const outDir = path.resolve(
    outIndex >= 0 ? (process.argv[outIndex + 1] ?? "") : path.join(ROOT, "delivery-out/docs"),
  );
  buildDeliveryDocs(outDir)
    .then((files) => {
      for (const file of files) console.log(`作成: ${path.relative(ROOT, file)}`);
    })
    .catch((error) => {
      console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
