import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppLayout } from "@/app/AppLayout";

function renderAppLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  it("左ナビを「作成」「帳票」「マスタ」「設定」でカテゴリ化して表示する", () => {
    renderAppLayout();
    const nav = screen.getByRole("navigation", { name: "メインメニュー" });
    for (const groupLabel of ["作成", "帳票", "マスタ", "設定"]) {
      expect(screen.getByRole("heading", { name: groupLabel })).toBeInTheDocument();
    }
    expect(nav).toBeInTheDocument();
  });

  it("すべてのメニュー項目のリンクを保持している", () => {
    renderAppLayout();
    const expectedLinks: Array<[string, string]> = [
      ["ホーム", "/"],
      ["新しい見積を作る", "/estimates/new"],
      ["問い合わせ読み取り", "/inquiries"],
      ["見積書", "/estimates"],
      ["請求書", "/invoices"],
      ["納品書", "/deliveries"],
      ["領収書", "/receipts"],
      ["顧客", "/clients"],
      ["価格表", "/catalog"],
      ["CSV取り込み", "/csv-import"],
      ["会社情報", "/settings/company"],
      ["AI設定", "/settings/ai"],
      ["データ管理", "/settings/data"],
      ["ヘルプ", "/help"],
      ["バージョン情報", "/version"],
    ];
    for (const [label, href] of expectedLinks) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("ホームは見出しなしで先頭に表示する", () => {
    renderAppLayout();
    const homeLink = screen.getByRole("link", { name: "ホーム" });
    expect(homeLink.closest(".app-nav-group")?.querySelector("h2")).toBeNull();
  });
});
