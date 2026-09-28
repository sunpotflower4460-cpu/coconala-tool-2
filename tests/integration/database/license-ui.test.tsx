import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { LicenseStatus, LicenseVerifierPort } from "@/application/ports/license";
import { DocumentPrintLayout } from "@/components/documents/DocumentPrintLayout";
import { LicenseBanner } from "@/features/license/LicenseBanner";
import { LicenseProvider } from "@/features/license/LicenseProvider";
import { VersionInfoPage } from "@/features/version-info/VersionInfoPage";
import { DatabaseContext } from "@/infrastructure/database/use-database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import { PDF_VISUAL_CASES } from "../../fixtures/pdf-visual/cases";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: () => Promise.resolve("0.1.0") }));
vi.mock("@/infrastructure/diagnostics/tauri-system-info-provider", () => ({
  tauriSystemInfoProvider: {
    get: () => Promise.resolve({ dbSchemaVersion: 5, os: "test", osArch: "x64" }),
  },
}));

const GOOD_KEY = "MDK1.eyJsaWQiOiJMLTEifQ.c2lnbmF0dXJl";

const fakeVerifier: LicenseVerifierPort = {
  verify(key: string): Promise<LicenseStatus> {
    return Promise.resolve(
      key === GOOD_KEY
        ? { state: "valid", licenseId: "L-2026-0001", issuedAt: "2026-10-01" }
        : { state: "invalid", reason: "bad_signature" },
    );
  },
};

function renderWithLicense(ui: React.ReactNode) {
  const db = createTestDatabase();
  render(
    <DatabaseContext.Provider value={{ status: "ready", db }}>
      <LicenseProvider verifier={fakeVerifier}>
        <MemoryRouter>
          <LicenseBanner />
          {ui}
        </MemoryRouter>
      </LicenseProvider>
    </DatabaseContext.Provider>,
  );
  return db;
}

describe("ライセンスキーの表示と登録", () => {
  it("印刷物: 未登録なら「未認証版」の透かしが入り、登録済みなら入らない", () => {
    const props = PDF_VISUAL_CASES[0]!.props;
    const { unmount } = render(<DocumentPrintLayout {...props} unlicensedWatermark />);
    expect(screen.getByText("未認証版")).toBeInTheDocument();
    expect(screen.getByText(/未認証版の見積・請求書デスクで作成/)).toBeInTheDocument();
    unmount();
    render(<DocumentPrintLayout {...props} />);
    expect(screen.queryByText("未認証版")).not.toBeInTheDocument();
  });

  it("未登録では案内帯を出し、正しいキーを登録すると案内帯が消える", async () => {
    const user = userEvent.setup();
    const db = renderWithLicense(<VersionInfoPage />);

    expect(await screen.findByText(/ライセンスキーが未登録です/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("ライセンスキー"), "MDK1.bad.key");
    await user.click(screen.getByRole("button", { name: "登録する" }));
    expect(await screen.findByText(/このライセンスキーは正しくありません/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("ライセンスキー"));
    await user.type(screen.getByLabelText("ライセンスキー"), GOOD_KEY);
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText(/ライセンス番号: L-2026-0001/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/ライセンスキーが未登録です/)).not.toBeInTheDocument(),
    );
    const rows = await db.select<{ license_key: string }>(
      "SELECT license_key FROM app_settings WHERE id = 1",
    );
    expect(rows[0]?.license_key).toBe(GOOD_KEY);
  });
});
