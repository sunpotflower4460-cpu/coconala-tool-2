import { describe, expect, it } from "vitest";
import { noLicenseCheck } from "@/infrastructure/license/no-license-check";

describe("noLicenseCheck", () => {
  it("常にunlicensedを返し、例外を投げない(帳票データの閲覧を妨げない)", async () => {
    const status = await noLicenseCheck.check();
    expect(status).toEqual({ state: "unlicensed" });
  });
});
