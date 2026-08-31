import { describe, expect, it } from "vitest";
import { toAppError } from "@/application/errors";
import { DomainError } from "@/domain/shared/errors";

describe("toAppError", () => {
  it("DomainErrorの日本語メッセージはそのまま返す", () => {
    const error = toAppError(
      new DomainError("数量が不正です", "invalid_quantity"),
      "保存に失敗しました",
    );
    expect(error).toEqual({ code: "invalid_quantity", message: "数量が不正です" });
  });

  it("SQLITE_BUSY などのエンジンコードは購入者向け文言へ置き換える", () => {
    const error = toAppError(
      new DomainError("database is locked (SQLITE_BUSY)", "db_locked"),
      "データを保存できませんでした。少し時間を置いてもう一度お試しください。",
    );
    expect(error.code).toBe("db_locked");
    expect(error.message).toBe(
      "データを保存できませんでした。少し時間を置いてもう一度お試しください。",
    );
    expect(error.message).not.toContain("SQLITE_BUSY");
  });

  it("未知の例外は fallback のみを返し、例外本文を出さない", () => {
    const error = toAppError(
      new Error("panic occurred in rusqlite"),
      "データを保存できませんでした。",
    );
    expect(error.code).toBe("unknown_error");
    expect(error.message).toBe("データを保存できませんでした。");
    expect(error.message).not.toContain("rusqlite");
  });
});
