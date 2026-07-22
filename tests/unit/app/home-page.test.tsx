import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { updateAppSettings } from "@/application/commands/update-app-settings.command";
import { HomePage } from "@/app/HomePage";
import { DatabaseContext } from "@/infrastructure/database/use-database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

async function renderHomePage(onboardingCompleted: boolean) {
  const db = createTestDatabase();
  await updateAppSettings(db, { onboardingCompleted });
  render(
    <DatabaseContext.Provider value={{ status: "ready", db }}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </DatabaseContext.Provider>,
  );
}

describe("HomePage", () => {
  it("初回設定完了後は「今日やること」の4つのクイックアクションを表示する", async () => {
    await renderHomePage(true);
    expect(await screen.findByRole("heading", { name: "今日やること" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新しい見積を作る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "問い合わせを読み取る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "顧客を追加" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "価格表を取り込む" })).toBeInTheDocument();
  });

  it("初回設定が未完了の場合はクイックアクションを表示しない", async () => {
    await renderHomePage(false);
    expect(await screen.findByText("まだ初回設定が完了していません。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "今日やること" })).not.toBeInTheDocument();
  });
});
