import { describe, expect, it } from "vitest";
import { notConfiguredUpdateCheck } from "@/infrastructure/updates/not-configured-update-check";

describe("notConfiguredUpdateCheck", () => {
  it("常にnot_configuredを返し、例外を投げない", async () => {
    const result = await notConfiguredUpdateCheck.check();
    expect(result).toEqual({ status: "not_configured" });
  });
});
