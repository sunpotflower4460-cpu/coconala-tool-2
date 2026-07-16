import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments, type DocumentSummary } from "@/application/queries/list-documents.query";
import { useDatabase } from "@/infrastructure/database/use-database";
import { formatYen } from "@/lib/formatting/money";

const STATUS_LABELS: Record<DocumentSummary["status"], string> = {
  draft: "下書き",
  issued: "発行済み",
  approved: "承認済み",
  rejected: "却下",
  invoiced: "請求済み",
  paid: "入金済み",
  cancelled: "取消",
};

export function EstimateListPage() {
  const db = useDatabase();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  useEffect(() => {
    void listDocuments(db, { documentType: "estimate" }).then(setDocuments);
  }, [db]);

  return (
    <div>
      <h1>見積書一覧</h1>
      <div style={{ margin: "1rem 0" }}>
        <Link to="/estimates/new">
          <button type="button">新しい見積書を作成</button>
        </Link>
      </div>

      {documents.length === 0 ? (
        <p>まだ見積書がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>書類番号</th>
              <th>顧客</th>
              <th>状態</th>
              <th>合計金額</th>
              <th>更新日時</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{document.documentNumber ?? "(下書き)"}</td>
                <td>{document.clientName ?? "-"}</td>
                <td>{STATUS_LABELS[document.status]}</td>
                <td>{formatYen(document.totalYen)}</td>
                <td>{new Date(document.updatedAt).toLocaleString("ja-JP")}</td>
                <td>
                  <Link to={`/estimates/${document.id}`}>開く</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
