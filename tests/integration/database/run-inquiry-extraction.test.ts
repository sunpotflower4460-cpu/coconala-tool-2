import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogItem } from "@/application/commands/catalog-item.commands";
import { confirmInquiryExtraction } from "@/application/commands/confirm-inquiry-extraction.command";
import { buildDiagnosticsReport } from "@/application/commands/build-diagnostics-report.command";
import { runInquiryExtraction } from "@/application/commands/run-inquiry-extraction.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import type { DatabasePort } from "@/application/ports/database";
import { AI_API_KEY_SECRET_NAME, type SecretStore } from "@/application/ports/secret-store";
import { createFakeSecretStore } from "@/lib/test-utils/fake-secret-store";
import { FakeAiProvider } from "@/lib/test-utils/fake-ai-provider";
import { createFakeSystemInfoProvider } from "@/lib/test-utils/fake-system-info-provider";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import { err, ok } from "@/lib/result";

describe("runInquiryExtraction", () => {
  let db: DatabasePort;
  let secretStore: SecretStore;

  beforeEach(() => {
    db = createTestDatabase();
    secretStore = createFakeSecretStore();
  });

  it("APIキーが未設定なら実行できない", async () => {
    const provider = new FakeAiProvider();
    const result = await runInquiryExtraction(db, provider, secretStore, "動画編集を3本", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_api_key");
  });

  it("問い合わせ文が空なら実行できない", async () => {
    await secretStore.set(AI_API_KEY_SECRET_NAME, "sk-ant-test");
    const provider = new FakeAiProvider();
    const result = await runInquiryExtraction(db, provider, secretStore, "  ", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("empty_text");
  });

  it("成功時はai_extractionsに保存され、金額(yen)を一切含まない", async () => {
    await secretStore.set(AI_API_KEY_SECRET_NAME, "sk-ant-test");
    const item = await createCatalogItem(db, {
      name: "動画編集",
      description: null,
      unit: "本",
      unitPriceYen: 30000,
      costPriceYen: null,
      taxCategory: "taxable_10",
      minQuantity: null,
      isActive: true,
    });
    if (!item.ok) throw new Error("unexpected");

    const provider = new FakeAiProvider({
      extractionResult: ok({
        summary: "動画編集の依頼",
        requestedDueDate: null,
        items: [
          {
            sourceText: "動画編集を3本",
            normalizedName: "動画編集",
            quantity: 3,
            unit: "本",
            catalogCandidates: [{ catalogItemId: item.value.id, confidence: 0.9, reason: "一致" }],
            status: "matched",
            questions: [],
          },
        ],
        globalQuestions: [],
      }),
    });

    const result = await runInquiryExtraction(
      db,
      provider,
      secretStore,
      "動画編集を3本",
      "claude-sonnet-5",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // AIの出力(および保存されたJSON)にyen金額が一切含まれないことを確認する
    const resultJson = JSON.stringify(result.value.extraction);
    expect(resultJson).not.toMatch(/yen|price|amount/i);

    const rows = await db.select<{ confirmed: number; result_json: string }>(
      "SELECT confirmed, result_json FROM ai_extractions WHERE id = ?",
      [result.value.extractionId],
    );
    expect(rows[0]?.confirmed).toBe(0);
    const savedExtraction = JSON.parse(rows[0]!.result_json) as typeof result.value.extraction;
    expect(savedExtraction.items[0]?.catalogCandidates[0]?.catalogItemId).toBe(item.value.id);
  });

  it("AIがエラーを返した場合、ai_extractionsへは何も保存されない(不正な結果を保存しない)", async () => {
    await secretStore.set(AI_API_KEY_SECRET_NAME, "sk-ant-test");
    const provider = new FakeAiProvider({
      extractionResult: err({ code: "invalid_response", message: "AIの応答形式が不正でした。" }),
    });

    const result = await runInquiryExtraction(db, provider, secretStore, "動画編集を3本", null);
    expect(result.ok).toBe(false);

    const rows = await db.select("SELECT * FROM ai_extractions");
    expect(rows).toHaveLength(0);
  });

  it("承認すると抽出記録が確認済みになり、書類と紐づく", async () => {
    await secretStore.set(AI_API_KEY_SECRET_NAME, "sk-ant-test");
    const provider = new FakeAiProvider({
      extractionResult: ok({
        summary: "依頼",
        requestedDueDate: null,
        items: [],
        globalQuestions: [],
      }),
    });
    const extraction = await runInquiryExtraction(db, provider, secretStore, "テスト", null);
    if (!extraction.ok) throw new Error("unexpected");

    const draft = await saveEstimateDraft(db, {
      id: null,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [],
    });
    if (!draft.ok) throw new Error("unexpected");

    const confirmed = await confirmInquiryExtraction(
      db,
      extraction.value.extractionId,
      draft.value.header.id!,
    );
    expect(confirmed.ok).toBe(true);

    const rows = await db.select<{ confirmed: number; document_id: number }>(
      "SELECT confirmed, document_id FROM ai_extractions WHERE id = ?",
      [extraction.value.extractionId],
    );
    expect(rows[0]?.confirmed).toBe(1);
    expect(rows[0]?.document_id).toBe(draft.value.header.id);
  });
});

describe("APIキーの混入防止", () => {
  it("抽出成功後もSQLiteと診断JSONにAPIキーが含まれない", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-key-scan-"));
    const dbPath = join(dir, "app.db");
    try {
      const db = createTestDatabase(dbPath);
      const secretStore = createFakeSecretStore();
      const apiKey = "sk-ant-api03-LEAKSCANKEYVALUE1234567890ABCD";
      await secretStore.set(AI_API_KEY_SECRET_NAME, apiKey);
      const provider = new FakeAiProvider({
        extractionResult: ok({
          summary: "依頼",
          requestedDueDate: null,
          items: [],
          globalQuestions: [],
        }),
      });
      const result = await runInquiryExtraction(db, provider, secretStore, "テスト依頼文", null);
      expect(result.ok).toBe(true);

      const sqliteBytes = readFileSync(dbPath);
      expect(sqliteBytes.includes(Buffer.from(apiKey, "utf8"))).toBe(false);

      const report = await buildDiagnosticsReport(db, createFakeSystemInfoProvider());
      expect(report.ok).toBe(true);
      if (report.ok) {
        const serialized = JSON.stringify(report.value);
        expect(serialized).not.toContain(apiKey);
        expect(serialized).not.toContain("sk-ant");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
