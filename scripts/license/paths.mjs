import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_LICENSE_DIR = path.join(os.homedir(), ".mitsumori-desk-license");

/** 秘密鍵・台帳をリポジトリ内に置かせない(誤コミット防止)。 */
export function assertOutsideRepo(target, repoRoot = REPO_ROOT) {
  const relative = path.relative(repoRoot, path.resolve(target));
  const inside = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (inside) {
    throw new Error(
      `安全のため、秘密鍵や台帳はリポジトリの外に置いてください: ${path.resolve(target)}`,
    );
  }
}
