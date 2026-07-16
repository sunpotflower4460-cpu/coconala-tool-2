import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteCatalogItem } from "@/application/commands/catalog-item.commands";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import type { CatalogItem } from "@/domain/catalog/types";
import { useDatabase } from "@/infrastructure/database/use-database";
import { formatYen } from "@/lib/formatting/money";

const TAX_CATEGORY_LABELS: Record<CatalogItem["taxCategory"], string> = {
  taxable_10: "10%",
  taxable_8: "8%(軽減税率)",
  tax_exempt: "非課税",
};

export function CatalogListPage() {
  const db = useDatabase();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const reload = useCallback(
    (query: string) => {
      listCatalogItems(db, { search: query })
        .then(setItems)
        .catch(() => setErrorMessage("価格表の取得に失敗しました"));
    },
    [db],
  );

  useEffect(() => {
    reload(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchChange(value: string) {
    setSearch(value);
    reload(value);
  }

  async function handleDelete() {
    if (pendingDeleteId === null) return;
    const result = await deleteCatalogItem(db, pendingDeleteId);
    setPendingDeleteId(null);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    reload(search);
  }

  return (
    <div>
      <h1>価格表</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <div style={{ display: "flex", justifyContent: "space-between", margin: "1rem 0" }}>
        <input
          type="search"
          aria-label="商品名で検索"
          placeholder="商品名で検索"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
        <Link to="/catalog/new">
          <button type="button">新しい商品を登録</button>
        </Link>
      </div>

      {items.length === 0 ? (
        <p>登録されている商品がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>商品名</th>
              <th>単価</th>
              <th>単位</th>
              <th>税区分</th>
              <th>状態</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{formatYen(item.unitPriceYen)}</td>
                <td>{item.unit ?? "-"}</td>
                <td>{TAX_CATEGORY_LABELS[item.taxCategory]}</td>
                <td>{item.isActive ? "有効" : "無効"}</td>
                <td>
                  <Link to={`/catalog/${item.id}/edit`}>編集</Link>{" "}
                  <button type="button" onClick={() => setPendingDeleteId(item.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="この商品を削除しますか?"
        description="削除すると元に戻せません。過去の書類には影響しません。"
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
