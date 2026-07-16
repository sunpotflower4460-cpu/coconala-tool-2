import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { buildDiagnosticsReport } from "@/application/commands/build-diagnostics-report.command";
import { saveDiagnosticsReport } from "@/application/commands/save-diagnostics-report.command";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import { createFakeSystemInfoProvider } from "@/lib/test-utils/fake-system-info-provider";
import { createFakeFileExport } from "@/lib/test-utils/fake-file-export";

describe("buildDiagnosticsReport / saveDiagnosticsReport", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("件数とバージョン情報のみを含む診断レポートを作る(顧客名は含まない)", async () => {
    await createClient(db, {
      name: "個人情報を含む顧客名株式会社",
      contactName: "秘密 太郎",
      postalCode: null,
      address: null,
      phone: null,
      email: "himitsu@example.com",
      note: null,
    });

    const systemInfoProvider = createFakeSystemInfoProvider();
    const result = await buildDiagnosticsReport(db, systemInfoProvider, new Date(2026, 6, 16));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.counts.clients).toBe(1);
    const serialized = JSON.stringify(result.value);
    expect(serialized).not.toContain("個人情報を含む顧客名株式会社");
    expect(serialized).not.toContain("himitsu@example.com");
  });

  it("正常なレポートはファイルとして保存できる", async () => {
    const systemInfoProvider = createFakeSystemInfoProvider();
    const report = await buildDiagnosticsReport(db, systemInfoProvider, new Date(2026, 6, 16));
    if (!report.ok) throw new Error("unexpected");

    const fileExport = createFakeFileExport();
    const saved = await saveDiagnosticsReport(fileExport, report.value, new Date(2026, 6, 16));
    expect(saved.ok).toBe(true);
    expect(fileExport.saved).toHaveLength(1);
  });

  it("何らかの理由で秘密情報らしき文字列が混入した場合は保存を拒否する", async () => {
    const systemInfoProvider = createFakeSystemInfoProvider();
    const report = await buildDiagnosticsReport(db, systemInfoProvider, new Date(2026, 6, 16));
    if (!report.ok) throw new Error("unexpected");

    const poisoned = { ...report.value, appVersion: "sk-ant-api03-leaked-secret-value-here" };
    const fileExport = createFakeFileExport();
    const saved = await saveDiagnosticsReport(fileExport, poisoned, new Date(2026, 6, 16));
    expect(saved.ok).toBe(false);
    expect(fileExport.saved).toHaveLength(0);
  });
});
