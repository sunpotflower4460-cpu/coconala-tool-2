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

  it("testConnectionは401でinvalid_api_keyを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "unauthorized" })));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_api_key");
  });

  it("ネットワークエラー時はnetworkエラーを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const provider = new AnthropicProvider();
    const result = await provider.testConnection("sk-ant-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("network");
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
