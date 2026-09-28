import type { DatabasePort } from "@/application/ports/database";
import type { FileExportPort, FileTypeFilter } from "@/application/ports/file-export";
import { toAppError, type AppError } from "@/application/errors";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { listClients } from "@/application/queries/list-clients.query";
import { toCsv, type CsvCell } from "@/domain/csv/serialize";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";
import type { TaxGroupTotal } from "@/domain/tax/types";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/formatting/document-labels";
import { formatTimestampLabel } from "@/lib/formatting/timestamp-label";
import { err, ok, type Result } from "@/lib/result";

const CSV_FILTER: FileTypeFilter = { name: "CSV", extensions: ["csv"] };

export type CsvExportKind = "clients" | "catalog" | "documents";

const FILE_PREFIX: Record<CsvExportKind, string> = {
  clients: "顧客一覧",
  catalog: "価格表",
  documents: "発行済み書類一覧",
};

/**
 * 顧客・価格表は、そのままCSV取り込みで読み戻せる列名(CLIENT_CSV_FIELDS / CATALOG_ITEM_CSV_FIELDS)
 * を先頭に置き、参考情報の列を後ろに足す。
 */
async function buildClientsCsv(db: DatabasePort): Promise<string> {
  const clients = await listClients(db);
  return toCsv(
    ["顧客名", "担当者名", "郵便番号", "住所", "電話番号", "メールアドレス", "備考"],
    clients.map((client) => [
      client.name,
      client.contactName,
      client.postalCode,
      client.address,
      client.phone,
      client.email,
      client.note,
    ]),
  );
}

async function buildCatalogCsv(db: DatabasePort): Promise<string> {
  const items = await listCatalogItems(db);
  return toCsv(
    ["商品名", "単位", "単価", "税区分", "説明", "原価", "最低数量", "使用中"],
    items.map((item) => [
      item.name,
      item.unit,
      item.unitPriceYen,
      item.taxCategory,
      item.description,
      item.costPriceYen,
      item.minQuantity,
      item.isActive ? "はい" : "いいえ",
    ]),
  );
}

interface IssuedDocumentRow {
  document_type: DocumentType;
  document_number: string | null;
  status: DocumentStatus;
  issue_date: string | null;
  due_date: string | null;
  client_name: string | null;
  subtotal_yen: number;
  tax_yen: number;
  total_yen: number;
  calculation_snapshot_json: string | null;
}

function breakdownAmount(
  breakdown: TaxGroupTotal[],
  category: TaxGroupTotal["taxCategory"],
  field: "taxableAmountYen" | "taxYen",
): CsvCell {
  return breakdown.find((group) => group.taxCategory === category)?.[field] ?? 0;
}

/** 発行済み以降の書類(練習データを除く)。顧客名・金額は発行時のスナップショットの値を使う。 */
async function buildDocumentsCsv(db: DatabasePort): Promise<string> {
  const rows = await db.select<IssuedDocumentRow>(
    `SELECT d.document_type, d.document_number, d.status, d.issue_date, d.due_date,
            COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client_name,
            d.subtotal_yen, d.tax_yen, d.total_yen, d.calculation_snapshot_json
     FROM documents d
     LEFT JOIN clients c ON c.id = d.client_id
     WHERE d.status != 'draft' AND d.is_practice_data = 0
     ORDER BY d.issue_date, d.document_number`,
  );
  return toCsv(
    [
      "書類番号",
      "種別",
      "状態",
      "発行日",
      "支払期限",
      "顧客名",
      "小計",
      "消費税",
      "合計",
      "10%対象",
      "10%消費税",
      "8%対象",
      "8%消費税",
      "非課税対象",
    ],
    rows.map((row) => {
      let breakdown: TaxGroupTotal[] = [];
      try {
        const snapshot = row.calculation_snapshot_json
          ? (JSON.parse(row.calculation_snapshot_json) as { taxBreakdown?: TaxGroupTotal[] })
          : null;
        breakdown = snapshot?.taxBreakdown ?? [];
      } catch {
        breakdown = [];
      }
      return [
        row.document_number,
        DOCUMENT_TYPE_LABELS[row.document_type],
        DOCUMENT_STATUS_LABELS[row.status],
        row.issue_date,
        row.due_date,
        row.client_name,
        row.subtotal_yen,
        row.tax_yen,
        row.total_yen,
        breakdownAmount(breakdown, "taxable_10", "taxableAmountYen"),
        breakdownAmount(breakdown, "taxable_10", "taxYen"),
        breakdownAmount(breakdown, "taxable_8", "taxableAmountYen"),
        breakdownAmount(breakdown, "taxable_8", "taxYen"),
        breakdownAmount(breakdown, "tax_exempt", "taxableAmountYen"),
      ];
    }),
  );
}

/**
 * CSVを書き出す。保存先は利用者が保存ダイアログで選ぶ。キャンセル時は ok(null)。
 * 顧客CSVにはメールアドレス等が含まれるため、診断ファイルの秘密情報検査は通さない
 * (利用者自身が自分のデータを取り出す操作のため)。
 */
export async function exportCsv(
  db: DatabasePort,
  fileExport: FileExportPort,
  kind: CsvExportKind,
  now: Date = new Date(),
): Promise<Result<string | null, AppError>> {
  try {
    const content =
      kind === "clients"
        ? await buildClientsCsv(db)
        : kind === "catalog"
          ? await buildCatalogCsv(db)
          : await buildDocumentsCsv(db);
    const path = await fileExport.saveTextFile(
      `${FILE_PREFIX[kind]}-${formatTimestampLabel(now)}.csv`,
      content,
      CSV_FILTER,
    );
    return ok(path);
  } catch (error) {
    return err(toAppError(error, "CSVの書き出しに失敗しました"));
  }
}
