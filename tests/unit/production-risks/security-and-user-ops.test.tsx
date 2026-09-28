import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { saveDiagnosticsReport } from "@/application/commands/save-diagnostics-report.command";
import { getLicenseStatus } from "@/application/queries/get-license-status.query";
import { activateLicense } from "@/application/commands/license.commands";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import { notConfiguredUpdateCheck } from "@/infrastructure/updates/not-configured-update-check";
import { CATALOG_ITEM_CSV_FIELDS, guessColumnMapping } from "@/domain/csv/fields";
import { parseCsv } from "@/domain/csv/parse";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import { createFakeFileExport } from "@/lib/test-utils/fake-file-export";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");

describe("SEC-01 CSPは Anthropic 以外の connect-src を許可しない", () => {
  it("tauri.conf.json の connect-src が許可リストである", () => {
    const config = JSON.parse(
      readFileSync(path.join(repoRoot, "src-tauri/tauri.conf.json"), "utf-8"),
    ) as { app: { security: { csp: string } } };
    const csp = config.app.security.csp;
    expect(csp).toContain("connect-src");
    expect(csp).toContain("https://api.anthropic.com");
    expect(csp).not.toMatch(/connect-src[^;]*\*/);
    expect(csp).not.toContain("https://api.openai.com");
  });
});

describe("SEC-02 Tauri権限に任意Shell実行がない", () => {
  it("default capability は shell execute を含まない", () => {
    const capability = JSON.parse(
      readFileSync(path.join(repoRoot, "src-tauri/capabilities/default.json"), "utf-8"),
    ) as { permissions: string[] };
    expect(capability.permissions.some((permission) => permission.startsWith("shell:"))).toBe(
      false,
    );
    expect(capability.permissions).toContain("sql:allow-execute");
  });
});

describe("SEC-03 診断保存は秘密情報パターンで中止する", () => {
  it("APIキーらしき文字列が混ざるとファイルを書かない", async () => {
    const fileExport = createFakeFileExport();
    const result = await saveDiagnosticsReport(fileExport, {
      generatedAt: "2026-09-01T00:00:00.000Z",
      appVersion: "0.1.0",
      os: "linux",
      osArch: "x64",
      dbSizeBytes: 1,
      dbSchemaVersion: 5,
      currentSchemaVersion: 5,
      aiEnabled: true,
      counts: { clients: 0, catalogItems: 0, documents: 0 },
      // 型上は無いが、混入経路を模して余分なフィールドを付ける
      leaked: "sk-ant-api03-abcdefghijklmnopqrstuvwx",
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsafe_diagnostics_content");
    expect(fileExport.saved).toHaveLength(0);
  });
});

describe("SEC-04 ライセンス・更新確認の障害で帳票が開けなくならない", () => {
  it("キー未登録でも、検証器が壊れていても例外を投げない", async () => {
    const db = createTestDatabase();
    const brokenVerifier = { verify: () => Promise.reject(new Error("IPC broken")) };
    await expect(getLicenseStatus(db, brokenVerifier)).resolves.toEqual({ state: "unlicensed" });
    await db.execute("UPDATE app_settings SET license_key = 'MDK1.a.b' WHERE id = 1");
    await expect(getLicenseStatus(db, brokenVerifier)).resolves.toEqual({
      state: "invalid",
      reason: "verifier_unavailable",
    });
    await expect(notConfiguredUpdateCheck.check()).resolves.toEqual({ status: "not_configured" });
  });

  it("正しくないキーは保存せず、登録済みの正しいキーを上書きしない", async () => {
    const db = createTestDatabase();
    const verifier = {
      verify: (key: string) =>
        Promise.resolve(
          key === "MDK1.good.sig"
            ? ({ state: "valid", licenseId: "L-1", issuedAt: "2026-10-01" } as const)
            : ({ state: "invalid", reason: "bad_signature" } as const),
        ),
    };
    expect((await activateLicense(db, verifier, " MDK1.good.sig\n")).ok).toBe(true);
    expect((await activateLicense(db, verifier, "MDK1.forged.sig")).ok).toBe(false);
    const rows = await db.select<{ license_key: string }>(
      "SELECT license_key FROM app_settings WHERE id = 1",
    );
    expect(rows[0]?.license_key).toBe("MDK1.good.sig");
  });

  it("書類・マスターのコマンド/クエリと domain はライセンスを参照しない(データをロックしない)", () => {
    const roots = ["src/application/commands", "src/application/queries", "src/domain"].map((dir) =>
      path.join(repoRoot, dir),
    );
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of readdirSync(root, { recursive: true }) as string[]) {
        if (!/\.(ts|tsx)$/.test(file) || /license/i.test(file)) continue;
        const text = readFileSync(path.join(root, file), "utf-8");
        if (/license/i.test(text)) offenders.push(path.join(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("USER-CSV-01 小数・負数・式の単価は取り込まない", () => {
  it("Excel式・小数・負の単価はエラー行になり、正常行だけ残る", () => {
    const rows = parseCsv(
      [
        "商品名,単位,単価",
        "正常商品,本,15000",
        "式インジェクション,本,=CMD|' /C calc'!A0",
        "小数,本,15000.5",
        "負数,本,-1",
      ].join("\n"),
    );
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const okRows = validated.filter((row) => row.errors.length === 0);
    const failed = validated.filter((row) => row.errors.length > 0);
    expect(okRows).toHaveLength(1);
    expect(okRows[0]?.data?.name).toBe("正常商品");
    expect(failed).toHaveLength(3);
  });
});

describe("USER-CSV-02 商品名にSQL断片があってもパラメータとして扱える前提の検証", () => {
  it("名前のセルはエラーにせずデータとして残す(実行はSQLパラメータ側)", () => {
    const rows = parseCsv(`商品名,単位,単価\n"'; DROP TABLE catalog_items;--",本,1000\n`);
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    expect(validated[0]?.errors).toEqual([]);
    expect(validated[0]?.data?.name).toContain("DROP TABLE");
  });
});

describe("USER-DIALOG-01 確認ダイアログの連打で二重実行しない", () => {
  it("処理中は確定ボタンが無効になり、onConfirmは1回だけ呼ばれる", async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    render(
      <ConfirmDialog
        open
        title="発行しますか?"
        confirmLabel="発行する"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );
    const confirm = screen.getByRole("button", { name: "発行する" });
    await user.click(confirm);
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    await act(async () => {
      resolveConfirm();
      await Promise.resolve();
    });
  });
});
