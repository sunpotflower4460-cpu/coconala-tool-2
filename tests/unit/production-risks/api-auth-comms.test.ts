import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteApiKey } from "@/application/commands/delete-api-key.command";
import { saveApiKey } from "@/application/commands/save-api-key.command";
import { testAiConnection } from "@/application/commands/test-ai-connection.command";
import { runInquiryExtraction } from "@/application/commands/run-inquiry-extraction.command";
import { AI_API_KEY_SECRET_NAME } from "@/application/ports/secret-store";
import { AnthropicProvider } from "@/infrastructure/ai/providers/anthropic-provider";
import { createAiProvider } from "@/infrastructure/ai/create-ai-provider";
import { inquiryExtractionSchema } from "@/infrastructure/ai/schemas/inquiry-extraction.schema";
import { mapExtractionResponse } from "@/infrastructure/ai/map-extraction-response";
import { createFakeSecretStore } from "@/lib/test-utils/fake-secret-store";
import { FakeAiProvider } from "@/lib/test-utils/fake-ai-provider";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import { err, ok } from "@/lib/result";

const API_URL = "https://api.anthropic.com/v1/messages";
const LEAK_KEY = "sk-ant-api03-LEAKSCANKEYVALUE1234567890ABCD";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("API-01 許可していないホストへはリクエストしない", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AnthropicProviderは api.anthropic.com のみを呼ぶ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await new AnthropicProvider().testConnection("sk-ant-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(API_URL);
  });
});

describe("API-02 HTTPエラーは日本語の安全なコードへ写像する", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [400, "unknown"],
    [401, "invalid_api_key"],
    [404, "unknown"],
    [408, "unknown"],
    [502, "server_error"],
  ] as const)("HTTP %s は %s になる", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, { error: "raw" })));
    const result = await new AnthropicProvider().testConnection(LEAK_KEY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
    expect(JSON.stringify(result.error)).not.toContain(LEAK_KEY);
    expect(result.error.message).not.toMatch(/anthropic|stack|ECONN/i);
  });
});

describe("API-03 HTMLや非JSONの応答でクラッシュしない", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("text/html の200応答は invalid_response になる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>gateway error</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const result = await new AnthropicProvider().extractInquiry(
      { text: "動画編集", catalogItems: [] },
      LEAK_KEY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_response");
  });
});

describe("AUTH-01 APIキー未設定・空文字・削除後は実行できない", () => {
  it("空のAPIキーは保存できない", async () => {
    const store = createFakeSecretStore();
    const result = await saveApiKey(store, "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_api_key");
    expect(await store.get(AI_API_KEY_SECRET_NAME)).toBeNull();
  });

  it("削除後は接続確認も抽出もできない", async () => {
    const store = createFakeSecretStore();
    await saveApiKey(store, "sk-ant-test");
    await deleteApiKey(store);
    expect(await store.get(AI_API_KEY_SECRET_NAME)).toBeNull();

    const provider = new FakeAiProvider({
      extractionResult: ok({
        summary: "x",
        requestedDueDate: null,
        items: [],
        globalQuestions: [],
      }),
    });
    const connection = await testAiConnection(provider, store);
    expect(connection.ok).toBe(false);
    if (!connection.ok) expect(connection.error.code).toBe("no_api_key");

    const extraction = await runInquiryExtraction(
      createTestDatabase(),
      provider,
      store,
      "動画編集を3本",
      null,
    );
    expect(extraction.ok).toBe(false);
    if (!extraction.ok) expect(extraction.error.code).toBe("no_api_key");
  });
});

describe("AUTH-02 資格情報ストア障害は帳票データを消さない", () => {
  it("保存失敗時は日本語エラーになり、例外を投げない", async () => {
    const store = {
      get: () => Promise.resolve(null),
      set: () => Promise.reject(new Error("keyring unavailable")),
      delete: () => Promise.resolve(),
    };
    const result = await saveApiKey(store, "sk-ant-test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("APIキーの保存に失敗しました");
      expect(result.error.message).not.toContain("keyring");
    }
  });
});

describe("COMMS-01 AI無効時は外部通信しない", () => {
  it("aiEnabled=false なら NoAiProvider になり、手動案内を返す", async () => {
    const provider = createAiProvider({ aiEnabled: false, aiModel: "claude-sonnet-5" });
    expect(provider.id).toBe("none");
    const result = await provider.extractInquiry({ text: "x", catalogItems: [] }, "sk-ant-unused");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("手動で見積");
  });
});

describe("COMMS-02 抽出失敗はDBへ書かず、再試行しても既存データを壊さない", () => {
  it("ネットワークエラー後も ai_extractions は空のまま", async () => {
    const db = createTestDatabase();
    const store = createFakeSecretStore();
    await store.set(AI_API_KEY_SECRET_NAME, "sk-ant-test");
    const provider = new FakeAiProvider({
      extractionResult: err({ code: "network", message: "通信に失敗しました。" }),
    });
    const first = await runInquiryExtraction(db, provider, store, "依頼文", null);
    const second = await runInquiryExtraction(db, provider, store, "依頼文", null);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    expect(await db.select("SELECT * FROM ai_extractions")).toHaveLength(0);
  });
});

describe("API-04 AIが金額や不正数量を返しても確定しない", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unit_price_yen などの余分な金額フィールドは捨て、出力に yen を含めない", () => {
    const parsed = inquiryExtractionSchema.parse({
      summary: "依頼",
      items: [
        {
          source_text: "動画編集",
          normalized_name: "動画編集",
          quantity: 3,
          unit: "本",
          unit_price_yen: 999999,
          catalog_candidates: [
            { catalog_item_id: 1, confidence: 0.9, reason: "一致", unit_price_yen: 1 },
          ],
        },
      ],
    });
    const mapped = mapExtractionResponse(parsed, [
      { id: 1, name: "動画編集", aliases: [], unit: "本" },
    ]);
    expect(JSON.stringify(mapped)).not.toMatch(/yen|999999/i);
    expect(mapped.items[0]?.status).toBe("matched");
  });

  it("Infinity の数量は schema 上 null になり、自動確定しない", () => {
    const parsed = inquiryExtractionSchema.parse({
      summary: "依頼",
      items: [
        {
          source_text: "大量発注",
          normalized_name: "動画編集",
          quantity: Number.POSITIVE_INFINITY,
          unit: "本",
          catalog_candidates: [{ catalog_item_id: 1, confidence: 0.99, reason: "一致" }],
        },
      ],
    });
    expect(parsed.items[0]?.quantity).toBeNull();
    const mapped = mapExtractionResponse(parsed, [
      { id: 1, name: "動画編集", aliases: [], unit: "本" },
    ]);
    expect(mapped.items[0]?.status).toBe("review");
  });

  it("Infinity の信頼度は invalid_response として保存しない", async () => {
    // JSON.stringify(Infinity) は null になるため、JSON.parse で Infinity になるリテラルを使う
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            `{"content":[{"type":"tool_use","name":"submit_inquiry_extraction","input":{"summary":"依頼","items":[{"source_text":"x","normalized_name":"x","catalog_candidates":[{"catalog_item_id":1,"confidence":1e309}]}]}}]}`,
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
    );
    const result = await new AnthropicProvider().extractInquiry(
      { text: "x", catalogItems: [{ id: 1, name: "x", aliases: [], unit: "本" }] },
      LEAK_KEY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_response");
  });
});
