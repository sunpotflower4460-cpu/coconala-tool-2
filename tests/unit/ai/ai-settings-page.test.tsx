import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiSettingsPage } from "@/features/ai-settings/AiSettingsPage";
import { DatabaseContext } from "@/infrastructure/database/use-database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("AiSettingsPage", () => {
  it("AIは任意であること・料金は購入者負担・結果は最終決定ではないことを示す", () => {
    const db = createTestDatabase();
    render(
      <DatabaseContext.Provider value={{ status: "ready", db }}>
        <AiSettingsPage />
      </DatabaseContext.Provider>,
    );
    expect(screen.getByText(/利用しない場合でも/)).toBeInTheDocument();
    expect(screen.getByText(/購入者\(あなた\)のご負担/)).toBeInTheDocument();
    expect(screen.getByText(/AIの結果は最終決定ではありません/)).toBeInTheDocument();
    expect(screen.getByText(/金額は発行前に必ずご自身で確認/)).toBeInTheDocument();
  });
});
