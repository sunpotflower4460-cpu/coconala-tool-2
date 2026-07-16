import { useMemo, useState } from "react";
import { createBackup } from "@/application/commands/create-backup.command";
import type { CsvImportSummary, DuplicatePolicy } from "@/application/commands/csv-import-summary";
import { importCatalogItemsCsv } from "@/application/commands/import-catalog-items-csv.command";
import { importClientsCsv } from "@/application/commands/import-clients-csv.command";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import {
  CATALOG_ITEM_CSV_FIELDS,
  CLIENT_CSV_FIELDS,
  buildSampleCsv,
  guessColumnMapping,
  type CsvFieldSpec,
} from "@/domain/csv/fields";
import { decodeCsvBytes, type CsvEncoding } from "@/domain/csv/encoding";
import { parseCsv } from "@/domain/csv/parse";
import type { ColumnMapping, CsvRowIssue } from "@/domain/csv/types";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import { validateClientRows } from "@/domain/csv/validate-client-rows";
import { tauriBackupStore } from "@/infrastructure/backup/tauri-backup-store";
import { useDatabase } from "@/infrastructure/database/use-database";

type Target = "clients" | "catalog_items";

const TARGET_FIELDS: Record<Target, CsvFieldSpec[]> = {
  clients: CLIENT_CSV_FIELDS,
  catalog_items: CATALOG_ITEM_CSV_FIELDS,
};

const SAMPLE_ROWS: Record<Target, string[]> = {
  clients: [
    "サンプル株式会社",
    "山田太郎",
    "100-0001",
    "東京都千代田区1-1-1",
    "03-1234-5678",
    "taro@example.com",
    "",
  ],
  catalog_items: ["動画編集(基本)", "本", "15000", "taxable_10"],
};

export function CsvImportPage() {
  const db = useDatabase();
  const [target, setTarget] = useState<Target>("clients");
  const [encodingOverride, setEncodingOverride] = useState<CsvEncoding | "auto">("auto");
  const [detectedEncoding, setDetectedEncoding] = useState<CsvEncoding | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("skip");
  const [showErrorRowsOnly, setShowErrorRowsOnly] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);

  const fields = TARGET_FIELDS[target];

  const validatedRows = useMemo<CsvRowIssue<unknown>[]>(() => {
    if (dataRows.length === 0) return [];
    if (target === "clients") return validateClientRows(dataRows, mapping);
    return validateCatalogItemRows(dataRows, mapping);
  }, [dataRows, mapping, target]);

  const errorCount = validatedRows.filter((row) => row.errors.length > 0).length;
  const visibleRows = showErrorRowsOnly
    ? validatedRows.filter((row) => row.errors.length > 0)
    : validatedRows;

  function resetFileState() {
    setHeader([]);
    setDataRows([]);
    setMapping({});
    setSummary(null);
    setErrorMessage(null);
  }

  function handleTargetChange(next: Target) {
    setTarget(next);
    resetFileState();
  }

  async function handleFileSelected(file: File) {
    resetFileState();
    const buffer = await file.arrayBuffer();
    const forced = encodingOverride === "auto" ? undefined : encodingOverride;
    const { text, encoding } = decodeCsvBytes(buffer, forced);
    setDetectedEncoding(encoding);
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setErrorMessage("CSVファイルが空です");
      return;
    }
    const [headerRow, ...rest] = rows;
    setHeader(headerRow!);
    setDataRows(rest);
    setMapping(guessColumnMapping(headerRow!, TARGET_FIELDS[target]));
  }

  function handleDownloadSample() {
    const sample = buildSampleCsv(fields, SAMPLE_ROWS[target]);
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = target === "clients" ? "顧客見本.csv" : "価格表見本.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const requiredFieldsMapped = fields
      .filter((field) => field.required)
      .every((field) => mapping[field.key] !== null && mapping[field.key] !== undefined);
    if (!requiredFieldsMapped) {
      setErrorMessage("必須項目の列マッピングが未設定です");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setSummary(null);

    const backupResult = await createBackup(tauriBackupStore);
    if (!backupResult.ok) {
      setBusy(false);
      setErrorMessage(
        `取り込み前のバックアップ作成に失敗したため中止しました: ${backupResult.error.message}`,
      );
      return;
    }

    if (target === "clients") {
      const rows = validateClientRows(dataRows, mapping);
      const result = await importClientsCsv(db, rows, duplicatePolicy);
      setSummary(result);
    } else {
      const rows = validateCatalogItemRows(dataRows, mapping);
      const result = await importCatalogItemsCsv(db, rows, duplicatePolicy);
      setSummary(result);
    }
    setBusy(false);
  }

  return (
    <div>
      <h1>CSV取り込み</h1>
      <p>顧客一覧・価格表を、表計算ソフトで作ったCSVファイルからまとめて登録できます。</p>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      <Field label="取り込み対象" htmlFor="csv-target">
        <select
          id="csv-target"
          value={target}
          onChange={(event) => handleTargetChange(event.target.value as Target)}
        >
          <option value="clients">顧客</option>
          <option value="catalog_items">価格表</option>
        </select>
      </Field>

      <button type="button" onClick={handleDownloadSample}>
        見本CSVをダウンロード
      </button>

      <Field
        label="文字コード"
        htmlFor="csv-encoding"
        hint="通常は自動判定で問題ありません。文字化けする場合のみ変更してください。"
      >
        <select
          id="csv-encoding"
          value={encodingOverride}
          onChange={(event) => setEncodingOverride(event.target.value as CsvEncoding | "auto")}
        >
          <option value="auto">自動判定</option>
          <option value="utf-8">UTF-8</option>
          <option value="shift_jis">Shift_JIS</option>
        </select>
      </Field>

      <Field label="CSVファイル" htmlFor="csv-file">
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />
      </Field>
      {detectedEncoding && <p className="hint">判定した文字コード: {detectedEncoding}</p>}

      {header.length > 0 && (
        <>
          <h2>列のマッピング</h2>
          {fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={`csv-map-${field.key}`}
              required={field.required}
            >
              <select
                id={`csv-map-${field.key}`}
                value={mapping[field.key] ?? ""}
                onChange={(event) =>
                  setMapping({
                    ...mapping,
                    [field.key]: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              >
                <option value="">(取り込まない)</option>
                {header.map((columnName, index) => (
                  <option key={index} value={index}>
                    {columnName || `列${index + 1}`}
                  </option>
                ))}
              </select>
            </Field>
          ))}

          <h2>
            プレビュー({dataRows.length}行中、エラー{errorCount}行)
          </h2>
          <Field label="エラー行だけ表示" htmlFor="csv-error-only">
            <input
              id="csv-error-only"
              type="checkbox"
              checked={showErrorRowsOnly}
              onChange={(event) => setShowErrorRowsOnly(event.target.checked)}
            />
          </Field>
          <table>
            <thead>
              <tr>
                <th>行</th>
                <th>内容</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.slice(0, 50).map((row) => (
                <tr key={row.rowIndex}>
                  <td>{row.rowIndex + 2}</td>
                  <td>{row.raw.join(" / ")}</td>
                  <td>{row.errors.length > 0 ? row.errors.join("、") : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>重複時の扱い</h2>
          <p>
            {target === "clients" ? "顧客名" : "商品名"}
            が完全一致するデータが既にある場合の扱いです。
          </p>
          <label>
            <input
              type="radio"
              name="duplicate-policy"
              checked={duplicatePolicy === "skip"}
              onChange={() => setDuplicatePolicy("skip")}
            />
            スキップする(既存データは変更しない)
          </label>
          <label style={{ marginLeft: "1rem" }}>
            <input
              type="radio"
              name="duplicate-policy"
              checked={duplicatePolicy === "overwrite"}
              onChange={() => setDuplicatePolicy("overwrite")}
            />
            上書きする
          </label>

          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              disabled={busy || dataRows.length === 0}
              onClick={() => {
                void handleImport();
              }}
            >
              取り込む(自動でバックアップを作成してから実行します)
            </button>
          </div>

          {summary && (
            <p role="status">
              取り込み完了: 新規{summary.imported}件 / 更新{summary.updated}件 / スキップ
              {summary.skipped}件 / 失敗{summary.failed}件
            </p>
          )}
        </>
      )}
    </div>
  );
}
