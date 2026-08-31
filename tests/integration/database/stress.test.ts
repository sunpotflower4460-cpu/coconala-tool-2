import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { listClients } from "@/application/queries/list-clients.query";
import { listDocuments } from "@/application/queries/list-documents.query";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

const CI_COUNTS = { clients: 100, catalogItems: 200, documents: 50 };
const SCRIPT = join(process.cwd(), "scripts/seed-stress.mjs");
const tempDirs: string[] = [];

function seedCiDatabase(): string {
  const dir = mkdtempSync(join(tmpdir(), "stress-int-"));
  tempDirs.push(dir);
  const out = join(dir, "ci.db");
  const result = spawnSync(process.execPath, [SCRIPT, "--profile=ci", "--out", out], {
    encoding: "utf8",
    env: { ...process.env, MITSUMORI_ALLOW_STRESS_SEED: "1" },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "seed-stress failed");
  }
  return out;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("大量データ（ci プロファイル）", () => {
  it("起動・一覧・検索・見積作成がクラッシュせず、所要時間を記録する", async () => {
    const timings: Record<string, number> = {};
    const mark = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      const started = performance.now();
      const value = await fn();
      timings[label] = Math.round(performance.now() - started);
      return value;
    };

    const dbPath = seedCiDatabase();
    const openStarted = performance.now();
    const db = createTestDatabase(dbPath);
    timings.open = Math.round(performance.now() - openStarted);

    const listedClients = await mark("listClients", () => listClients(db));
    const listedItems = await mark("listCatalogItems", () => listCatalogItems(db));
    const listedDocuments = await mark("listDocuments", () => listDocuments(db));
    const searchedClients = await mark("searchClients", () =>
      listClients(db, { search: "負荷試験顧客1" }),
    );
    const searchedItems = await mark("searchCatalogItems", () =>
      listCatalogItems(db, { search: "負荷試験商品" }),
    );
    await mark("getAppSettings", () => getAppSettings(db));
    const created = await mark("createEstimate", () =>
      saveEstimateDraft(db, {
        id: null,
        clientId: listedClients[0]?.id ?? null,
        issueDate: "2026-08-31",
        dueDate: null,
        validUntil: null,
        pricingType: "tax_exclusive",
        discountYen: 0,
        note: "大量データ後の見積",
        lines: [
          {
            catalogItemId: listedItems[0]?.id ?? null,
            name: listedItems[0]?.name ?? "商品",
            description: null,
            unit: listedItems[0]?.unit ?? "式",
            quantity: 1,
            unitPriceYen: listedItems[0]?.unitPriceYen ?? 1000,
            taxCategory: listedItems[0]?.taxCategory ?? "taxable_10",
            lineDiscountYen: 0,
          },
        ],
      }),
    );

    expect(listedClients).toHaveLength(CI_COUNTS.clients);
    expect(listedItems).toHaveLength(CI_COUNTS.catalogItems);
    expect(listedDocuments).toHaveLength(CI_COUNTS.documents);
    expect(searchedClients.length).toBeGreaterThan(0);
    expect(searchedItems.length).toBeGreaterThan(0);
    expect(created.ok).toBe(true);
    console.warn("[stress-timings-ms]", JSON.stringify(timings));
  });
});
