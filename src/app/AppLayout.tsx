import { NavLink, Outlet } from "react-router-dom";
import { RequireDatabase } from "@/infrastructure/database/RequireDatabase";

const NAV_ITEMS = [
  { to: "/", label: "ホーム", end: true },
  { to: "/clients", label: "顧客" },
  { to: "/catalog", label: "価格表" },
  { to: "/csv-import", label: "CSV取り込み" },
  { to: "/estimates", label: "見積書" },
  { to: "/invoices", label: "請求書" },
  { to: "/deliveries", label: "納品書" },
  { to: "/receipts", label: "領収書" },
  { to: "/inquiries", label: "問い合わせ読み取り" },
  { to: "/settings/company", label: "会社情報" },
  { to: "/settings/ai", label: "AI設定" },
  { to: "/settings/data", label: "データ管理" },
  { to: "/help", label: "ヘルプ" },
  { to: "/version", label: "バージョン情報" },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="メインメニュー">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="app-main">
        <RequireDatabase>
          <Outlet />
        </RequireDatabase>
      </main>
    </div>
  );
}
