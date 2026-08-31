import { describe, expect, it } from "vitest";
import {
  cargoHasUpdaterPlugin,
  changelogHasExactVersion,
  changelogHasUnreleasedOrVersion,
  classifyGitTag,
  detectSupportContactState,
  findBracketPlaceholders,
  findOsClaimConflicts,
  findSecretLikeHits,
  parseMode,
  shouldFail,
  SUPPORT_CONTACT_CONFIRMED,
  SUPPORT_CONTACT_PENDING,
  updaterDocumentationOk,
} from "../../../scripts/release-checks.mjs";

describe("parseMode / classifyGitTag", () => {
  it("--strict または RELEASE_STRICT=1 は strict になる", () => {
    expect(parseMode(["--strict"], {})).toBe("strict");
    expect(parseMode([], { RELEASE_STRICT: "1" })).toBe("strict");
  });

  it("--rc または RELEASE_RC=1 は rc になる", () => {
    expect(parseMode(["--rc"], {})).toBe("rc");
    expect(parseMode([], { RELEASE_RC: "1" })).toBe("rc");
  });

  it("引数なしは basic", () => {
    expect(parseMode([], {})).toBe("basic");
  });

  it("正式タグとRCタグを区別し、人間確認をタグ名だけで完了扱いにしない", () => {
    expect(classifyGitTag("v1.0.0")).toBe("strict");
    expect(classifyGitTag("v0.9.0-rc.1")).toBe("rc");
    expect(classifyGitTag("v0.9.0-beta.1")).toBe("basic");
    expect(classifyGitTag("nightly")).toBe("basic");
  });
});

describe("changelog", () => {
  it("strict では Unreleased だけでは不足", () => {
    const text = "## [Unreleased]\n\n- 何か\n";
    expect(changelogHasUnreleasedOrVersion(text, "0.1.0")).toBe(true);
    expect(changelogHasExactVersion(text, "0.1.0")).toBe(false);
  });

  it("対象バージョンの見出しがあれば exact とみなす", () => {
    const text = "## [0.9.0-rc.1] - 2026-08-31\n";
    expect(changelogHasExactVersion(text, "0.9.0-rc.1")).toBe(true);
  });
});

describe("placeholders and support contact", () => {
  it("Markdownリンクはプレースホルダーとみなさない", () => {
    expect(findBracketPlaceholders("詳細は[利用規約](./TERMS.md)を参照")).toEqual([]);
  });

  it("[権利者名を記入] はプレースホルダー", () => {
    expect(findBracketPlaceholders("Copyright (c) 2026 [権利者名を記入]")).toEqual([
      "[権利者名を記入]",
    ]);
  });

  it("サポート窓口は CONFIRMED 標識が揃うまで未確定", () => {
    expect(detectSupportContactState([`// ${SUPPORT_CONTACT_PENDING}`])).toBe("pending");
    expect(detectSupportContactState(["窓口の記載なし"])).toBe("missing");
    expect(detectSupportContactState([`<!-- ${SUPPORT_CONTACT_CONFIRMED} -->`])).toBe("confirmed");
  });
});

describe("updater documentation", () => {
  it("プラグイン未導入なら文書への明記が必要", () => {
    expect(
      updaterDocumentationOk({
        cargoTomlText: 'tauri = { version = "2" }\n',
        documentationText: "特になし",
      }),
    ).toEqual({ implemented: false, documented: false });

    expect(
      updaterDocumentationOk({
        cargoTomlText: 'tauri = { version = "2" }\n',
        documentationText: "更新は販売ページから手動で提供します(自動更新は未設定です)",
      }),
    ).toEqual({ implemented: false, documented: true });
  });

  it("Cargo.toml の代入行だけをプラグイン導入とみなす", () => {
    expect(cargoHasUpdaterPlugin("# 将来 tauri-plugin-updater を入れる\n")).toBe(false);
    expect(cargoHasUpdaterPlugin('tauri-plugin-updater = "2"\n')).toBe(true);
  });
});

describe("OS claims", () => {
  const platforms = {
    firstSale: ["macos"],
    forbiddenOfficialClaims: {
      windows: ["macOS / Windows向け", "Windows正式対応"],
    },
  };

  it("初回販売対象外OSを正式対応と書くと衝突する", () => {
    const conflicts = findOsClaimConflicts(platforms, [
      { relativePath: "README.md", text: "macOS / Windows向け買い切りツールです。" },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.platform).toBe("windows");
  });

  it("実機確認前の表現(予定・対象外)は衝突しない", () => {
    const conflicts = findOsClaimConflicts(platforms, [
      {
        relativePath: "README.md",
        text: "初回販売の対象OSは macOS です。Windows版は実機確認が完了するまで正式対応としません。",
      },
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

describe("secret-like hits", () => {
  it("example.com のメールはサンプルとして許可する", () => {
    expect(findSecretLikeHits("担当: taro@example.com", "src/x.ts")).toEqual([]);
  });

  it("実在しうるメールとAPIキー形式は検出する", () => {
    const emailHits = findSecretLikeHits("連絡先: owner@real-domain.jp", "README.md");
    expect(emailHits.some((hit) => hit.name === "メールアドレス")).toBe(true);

    const keyHits = findSecretLikeHits("sk-ant-api03-abcdefghijklmnop", "src/leak.ts");
    expect(keyHits.some((hit) => hit.name === "Anthropic APIキー")).toBe(true);
  });
});

describe("shouldFail", () => {
  const clean = {
    versionErrors: [],
    placeholderFindings: ["LICENSE: [権利者名を記入]"],
    rcRequiredFindings: [],
    secretHits: [],
  };

  it("basic はプレースホルダーだけでは失敗しない", () => {
    expect(shouldFail("basic", clean)).toBe(false);
  });

  it("rc はプレースホルダーだけでは失敗しない", () => {
    expect(shouldFail("rc", clean)).toBe(false);
  });

  it("strict はプレースホルダーが残ると失敗する", () => {
    expect(shouldFail("strict", clean)).toBe(true);
  });

  it("秘密情報はどのモードでも失敗する", () => {
    expect(
      shouldFail("basic", {
        ...clean,
        placeholderFindings: [],
        secretHits: [{ message: "leak" }],
      }),
    ).toBe(true);
  });

  it("rc はOS矛盾で失敗する", () => {
    expect(
      shouldFail("rc", {
        ...clean,
        placeholderFindings: [],
        rcRequiredFindings: ["README.md: Windows正式対応"],
      }),
    ).toBe(true);
  });

  it("バージョン不一致はどのモードでも失敗する", () => {
    expect(shouldFail("basic", { ...clean, versionErrors: ["mismatch"] })).toBe(true);
  });
});
