#!/usr/bin/env node
// クロスプラットフォームな stress seed 起動。POSIX の `ENV=1 cmd` 記法に依存しない。
// 本番アプリや購入者向けUIからは呼ばない。安全ガード本体は seed-stress.mjs 側に残す。

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSeedStressMain } from "./seed-stress.mjs";

export function envWithStressSeedAllowed(env = process.env) {
  return {
    ...env,
    MITSUMORI_ALLOW_STRESS_SEED: "1",
  };
}

const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const outcome = runSeedStressMain(process.argv.slice(2), envWithStressSeedAllowed(process.env));
  if (!outcome.ok) {
    console.error(outcome.message);
    process.exit(1);
  }
  const { result, profileName } = outcome;
  console.warn(
    `seed:stress ${profileName}: clients=${result.counts.clients} catalog=${result.counts.catalogItems} documents=${result.counts.documents} elapsedMs=${result.elapsedMs} path=${result.dbPath}`,
  );
}
