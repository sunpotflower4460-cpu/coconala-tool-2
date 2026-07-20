import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteClient } from "@/application/commands/client.commands";
import { listClients } from "@/application/queries/list-clients.query";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import type { Client } from "@/domain/clients/types";
import { useDatabase } from "@/infrastructure/database/use-database";

export function ClientListPage() {
  const db = useDatabase();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const reload = useCallback(
    (query: string) => {
      listClients(db, { search: query })
        .then(setClients)
        .catch(() => setErrorMessage("顧客一覧の取得に失敗しました"));
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
    const result = await deleteClient(db, pendingDeleteId);
    setPendingDeleteId(null);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    reload(search);
  }

  return (
    <div>
      <h1>顧客一覧</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <div style={{ display: "flex", justifyContent: "space-between", margin: "1rem 0" }}>
        <input
          type="search"
          aria-label="顧客名で検索"
          placeholder="顧客名で検索"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
        <Link to="/clients/new">
          <button type="button">新しい顧客を登録</button>
        </Link>
      </div>

      {clients.length === 0 ? (
        <p>登録されている顧客がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>顧客名</th>
              <th>担当者</th>
              <th>電話番号</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{client.contactName ?? "-"}</td>
                <td>{client.phone ?? "-"}</td>
                <td>
                  <Link to={`/clients/${client.id}/edit`}>編集</Link>{" "}
                  <button type="button" onClick={() => setPendingDeleteId(client.id)}>
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
        title="この顧客を削除しますか?"
        description="削除すると元に戻せません。"
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
