import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "@/infrastructure/ai/providers/anthropic-provider";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AnthropicProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("testConnectionはAPIキーが正しければ成功する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { content: [{ type: "text", text: "OK" }] })),
    );
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-valid-key");
    expect(result.ok).toBe(true);
  });

  it("testConnectionは403でforbiddenを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "forbidden" })));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("ネットワークエラー時はnetworkエラーを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("network");
  });

  it("429の場合はrate_limitedを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, { error: "rate limited" })));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("rate_limited");
  });

  it("5xxの場合はserver_errorを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(503, { error: "service unavailable" })),
    );
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("server_error");
  });

  it("500の場合もserver_errorを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "internal" })));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("server_error");
  });

  it("空の応答はinvalid_responseを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.message).not.toContain("sk-ant-key");
    }
  });

  it("壊れたJSONはinvalid_responseを返す(通信エラーにしない)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("{not-json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
    );
    const provider = new AnthropicProvider();
    const result = await provider.extractInquiry(
      { text: "x", catalogItems: [] },
      "sk-ant-unique-leak-token",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.message).not.toContain("sk-ant-unique-leak-token");
    }
  });

  it("タイムアウト(30秒応答なし)の場合はtimeoutを返す", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );
    const provider = new AnthropicProvider();
    const resultPromise = provider.testConnection("sk-ant-key");
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeout");
    vi.useRealTimers();
  });

  it("巨大な応答でもクラッシュせず処理できる", async () => {
    const manyItems = Array.from({ length: 5000 }, (_, index) => ({
      source_text: `明細${index}`.repeat(20),
      normalized_name: `商品${index}`,
      quantity: 1,
      unit: "個",
      catalog_candidates: [],
      questions: [],
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: [
            {
              type: "tool_use",
              name: "submit_inquiry_extraction",
              input: { summary: "大量の明細", items: manyItems, global_questions: [] },
            },
          ],
        }),
      ),
    );
    const provider = new AnthropicProvider();
    const result = await provider.extractInquiry({ text: "x", catalogItems: [] }, "sk-ant-key");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items).toHaveLength(5000);
  });

  it("extractInquiryはtool_useブロックを検証して構造化データを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: [
            {
              type: "tool_use",
              name: "submit_inquiry_extraction",
              input: {
                summary: "動画編集の依頼",
                requested_due_date: null,
                items: [
                  {
                    source_text: "動画編集を3本",
                    normalized_name: "動画編集",
                    quantity: 3,
                    unit: "本",
                    catalog_candidates: [{ catalog_item_id: 1, confidence: 0.9, reason: "一致" }],
                    questions: [],
                  },
                ],
                global_questions: [],
              },
            },
          ],
        }),
      ),
    );
    const provider = new AnthropicProvider();
    const result = await provider.extractInquiry(
      {
        text: "動画編集を3本お願いします",
        catalogItems: [{ id: 1, name: "動画編集", aliases: [], unit: "本" }],
      },
      "sk-ant-key",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.status).toBe("matched");
    }
  });

  it("tool_useブロックがない場合はinvalid_responseを返す(壊れたJSON相当)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { content: [{ type: "text", text: "うまく整理できませんでした" }] }),
        ),
    );
    const provider = new AnthropicProvider();
    const result = await provider.extractInquiry(
      { text: "曖昧な依頼", catalogItems: [] },
      "sk-ant-key",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_response");
  });

  it("スキーマに合わないtool_use入力もinvalid_responseになる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: [
            { type: "tool_use", name: "submit_inquiry_extraction", input: { unexpected: true } },
          ],
        }),
      ),
    );
    const provider = new AnthropicProvider();
    const result = await provider.extractInquiry({ text: "x", catalogItems: [] }, "sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_response");
  });

  it("既にキャンセルされたsignalを渡すとcancelledを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const abortError = new DOMException("Aborted", "AbortError");
        return Promise.reject(abortError);
      }),
    );
    const provider = new AnthropicProvider();
    const controller = new AbortController();
    controller.abort();
    const result = await provider.testConnection("sk-ant-key", { signal: controller.signal });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("cancelled");
  });
});
