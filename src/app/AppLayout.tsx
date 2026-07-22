import { NavLink, Outlet } from "react-router-dom";
import { RequireDatabase } from "@/infrastructure/database/RequireDatabase";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

// 「作成」「帳票」「マスタ」「設定」でカテゴリ化し、次に何をすればいいかが
// 分かりやすいようにする。ホームのみ見出しなしで先頭に置く。
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ to: "/", label: "ホーム", end: true }],
  },
  {
    label: "作成",
    items: [
      { to: "/estimates/new", label: "新しい見積を作る" },
      { to: "/inquiries", label: "問い合わせ読み取り" },
    ],
  },
  {
    label: "帳票",
    items: [
      { to: "/estimates", label: "見積書" },
      { to: "/invoices", label: "請求書" },
      { to: "/deliveries", label: "納品書" },
      { to: "/receipts", label: "領収書" },
    ],
  },
  {
    label: "マスタ",
    items: [
      { to: "/clients", label: "顧客" },
      { to: "/catalog", label: "価格表" },
      { to: "/csv-import", label: "CSV取り込み" },
    ],
  },
  {
    label: "設定",
    items: [
      { to: "/settings/company", label: "会社情報" },
      { to: "/settings/ai", label: "AI設定" },
      { to: "/settings/data", label: "データ管理" },
      { to: "/help", label: "ヘルプ" },
      { to: "/version", label: "バージョン情報" },
    ],
  },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="メインメニュー">
        {NAV_GROUPS.map((group, index) => (
          <div className="app-nav-group" key={group.label ?? `group-${index}`}>
            {group.label && <h2 className="app-nav-group-label">{group.label}</h2>}
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <main className="app-main">
        <RequireDatabase>
          <Outlet />
        </RequireDatabase>
      </main>
    </div>
  );
}
