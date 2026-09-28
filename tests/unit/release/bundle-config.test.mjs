import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf-8"));

// Tauriのテンプレートに含まれる既定アイコン(icon.png)のハッシュ。販売物に残してはいけない。
const TAURI_DEFAULT_ICON_SHA256 =
  "273cd669e07c455ad1c7c095890a37984652157cee73128a867300067dfb80e7";

describe("配布物の製品情報(tauri.conf.json ほか)", () => {
  const base = readJson("src-tauri/tauri.conf.json");

  it("identifier は発売後も変えない(変えると購入者のデータ保存先が変わる)", () => {
    expect(base.identifier).toBe("com.mitsumoridesk.desktop");
  });

  it("productName はインストーラー名に使うためASCIIにする", () => {
    expect(base.productName).toBe("MitsumoriDesk");
    expect(base.productName).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("ウィンドウとmacOSの表示名は日本語", () => {
    expect(base.app.windows[0].title).toBe("見積・請求書デスク");
    const plist = readFileSync(path.join(root, "src-tauri/Info.plist"), "utf-8");
    expect(plist).toContain("<string>見積・請求書デスク</string>");
    const strings = readFileSync(
      path.join(root, "src-tauri/macos/ja.lproj/InfoPlist.strings"),
      "utf-8",
    );
    expect(strings).toContain('CFBundleDisplayName = "見積・請求書デスク";');
    expect(base.bundle.macOS.files["Resources/ja.lproj/InfoPlist.strings"]).toBe(
      "macos/ja.lproj/InfoPlist.strings",
    );
  });

  it("macOS は dmg を作り、印刷機能の要件である 11.0 以上を下限にする", () => {
    const mac = readJson("src-tauri/tauri.macos.conf.json");
    expect(mac.bundle.targets).toEqual(["app", "dmg"]);
    const [major] = base.bundle.macOS.minimumSystemVersion.split(".").map(Number);
    expect(major).toBeGreaterThanOrEqual(11);
  });

  it("Windows は日本語のNSISインストーラーで、管理者権限なしで入れられる", () => {
    const win = readJson("src-tauri/tauri.windows.conf.json");
    expect(win.bundle.targets).toEqual(["nsis"]);
    expect(win.bundle.windows.nsis.languages).toEqual(["Japanese"]);
    expect(win.bundle.windows.nsis.installMode).toBe("currentUser");
    expect(win.bundle.windows.webviewInstallMode.type).toBe("embedBootstrapper");
  });

  it("アイコンがTauriの既定の絵のままではない", () => {
    const icon = readFileSync(path.join(root, "src-tauri/icons/icon.png"));
    const hash = createHash("sha256").update(icon).digest("hex");
    expect(hash).not.toBe(TAURI_DEFAULT_ICON_SHA256);
  });

  it("Cargo.toml にテンプレートのままの説明・作者が残っていない", () => {
    const cargo = readFileSync(path.join(root, "src-tauri/Cargo.toml"), "utf-8");
    expect(cargo).not.toContain('description = "A Tauri App"');
    expect(cargo).not.toContain('authors = ["you"]');
  });
});
