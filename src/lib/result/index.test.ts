import { describe, expect, it } from "vitest";
import { err, isErr, isOk, mapErr, mapResult, ok, unwrapOr } from "@/lib/result";

describe("Result", () => {
  it("wraps a success value", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("wraps an error value", () => {
    const result = err("failure");
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("maps a success value", () => {
    const result = mapResult(ok(2), (n) => n * 2);
    expect(result).toEqual(ok(4));
  });

  it("does not map an error value", () => {
    const result = mapResult(err<string>("failure"), (n: number) => n * 2);
    expect(result).toEqual(err("failure"));
  });

  it("maps an error value", () => {
    const result = mapErr(err("failure"), (e) => `mapped:${e}`);
    expect(result).toEqual(err("mapped:failure"));
  });

  it("unwraps with fallback on error", () => {
    expect(unwrapOr(err("failure"), 0)).toBe(0);
    expect(unwrapOr(ok(5), 0)).toBe(5);
  });
});
