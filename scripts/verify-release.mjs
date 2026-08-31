#!/usr/bin/env node
// リリース前に、バージョン番号の一致と、購入者向け成果物に残っている未確定情報
// (プレースホルダー・publisher/copyright未設定・サポート窓口・秘密情報・OS表記の矛盾)を検出する。
//
// モード:
//   既定(basic)  : 未確定情報は警告。通常のCIやPRでは失敗させない。
//   --rc         : RCタグ(vX.Y.Z-rc.N)用。バージョン一致・秘密情報・OS表記・
//                  自動更新の未実装明記を必須にする。規約DRAFTやpublisher空は許容する。
//   --strict     : 正式タグ(vX.Y.Z)用。RCの検査に加え、プレースホルダー・DRAFT・
//                  publisher/copyright・サポート窓口・CHANGELOGの正式セクションも必須。
//
// 人間確認(macOS実機・署名・公証・PDF目視・実API・β)をGitHub Actionsだけで
// 「完了」と判断しない。それらは docs/RELEASE_EVIDENCE.md の人間確認欄へ記録する。

import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectReleaseFindings, parseMode, shouldFail } from "./release-checks.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = parseMode(process.argv, process.env);
const findings = collectReleaseFindings(rootDir, mode);
const failLogger = mode === "basic" ? console.warn : console.error;
const placeholderLogger = mode === "strict" ? console.error : console.warn;

if (findings.versionErrors.length === 0) {
  console.log(`OK  バージョン番号が一致しています(${findings.packageVersion})`);
} else {
  console.error("エラー: バージョン番号");
  for (const line of findings.versionErrors) {
    console.error(`  ${line}`);
  }
}

if (mode === "strict") {
  console.log("モード: strict(正式タグ)。CHANGELOGの正式セクションと未確定情報ゼロが必須です");
} else if (mode === "rc") {
  console.log(
    "モード: rc。規約DRAFT・publisher空は許容し、秘密情報・OS表記・更新未実装の明記は必須です",
  );
} else {
  console.log("モード: basic。未確定情報は警告のみです");
}

if (findings.placeholderFindings.length > 0) {
  const label = mode === "strict" ? "エラー" : "警告";
  placeholderLogger(
    `${label}: 購入者向け成果物に未確定情報が残っています(${findings.placeholderFindings.length}件)`,
  );
  for (const finding of findings.placeholderFindings) {
    placeholderLogger(`  - ${finding}`);
  }
  if (mode !== "strict") {
    console.warn(
      "  (正式タグではこれらを解消し、`pnpm check:release -- --strict` を通過させること。docs/RELEASE_GATES.md参照)",
    );
  }
} else {
  console.log(
    "OK  未確定情報(プレースホルダー・publisher/copyright・サポート窓口)は見つかりませんでした",
  );
}

if (findings.updater.implemented) {
  console.log("OK  自動更新プラグインがCargo依存に含まれています");
} else if (findings.updater.documented) {
  console.log("OK  自動更新は未実装であり、そのことが文書に明記されています");
} else {
  failLogger("自動更新が未実装なのに、購入者向け文書へ未設定である旨がありません");
}

if (findings.rcRequiredFindings.length === 0) {
  console.log("OK  販売OSの記載と自動更新の説明に矛盾はありません");
} else {
  const label = mode === "basic" ? "警告" : "エラー";
  failLogger(`${label}: RC以上で必須の品質項目`);
  for (const finding of findings.rcRequiredFindings) {
    failLogger(`  - ${finding}`);
  }
}

if (findings.secretHits.length === 0) {
  console.log("OK  検査対象の本番成果物に秘密情報らしき文字列は見つかりませんでした");
} else {
  console.error(`エラー: 秘密情報らしき文字列(${findings.secretHits.length}件)`);
  for (const hit of findings.secretHits) {
    console.error(`  - ${hit.message}`);
  }
}

console.log(
  "注記: このコマンドは人間確認(実機・署名・公証・PDF目視・実API・β)を完了扱いにしません。docs/RELEASE_EVIDENCE.mdを参照してください。",
);

if (shouldFail(mode, findings)) {
  process.exit(1);
}
