import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { clickNav, createAppSession, ensureOnboarded, waitForRootText } from "../helpers/flows.mjs";

test("UTF-8の顧客CSVを画面から取り込める", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await ensureOnboarded(client);

  const csvPath = path.join(tmpdir(), "mitsumori-e2e-clients.csv");
  writeFileSync(csvPath, "顧客名,担当者名\nCSV取り込み顧客,花子\n", "utf8");

  await clickNav(client, "CSV取り込み");
  await waitForRootText(client, /ステップ1/, 10000);
  const fileInput = await client.$("#csv-file");
  await fileInput.setValue(csvPath);
  await waitForRootText(client, /ステップ2/, 10000);
  await client.$("button=取り込む(自動でバックアップを作成してから実行します)").click();
  await waitForRootText(client, /取り込み完了/, 20000);

  await clickNav(client, "顧客");
  await waitForRootText(client, /CSV取り込み顧客/, 10000);
  const listText = await client.$("#root").getText();
  assert.match(listText, /CSV取り込み顧客/, "取り込んだ顧客が一覧に出る");
});
