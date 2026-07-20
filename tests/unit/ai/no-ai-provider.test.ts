import { describe, expect, it } from "vitest";
import { NoAiProvider } from "@/infrastructure/ai/providers/no-ai-provider";

describe("NoAiProvider", () => {
  it("常にエラーを返す(AI未設定案内)", async () => {
    const provider = new NoAiProvider();
    const connection = await provider.testConnection("");
    expect(connection.ok).toBe(false);

    const extraction = await provider.extractInquiry({ text: "x", catalogItems: [] }, "");
    expect(extraction.ok).toBe(false);
  });
});
