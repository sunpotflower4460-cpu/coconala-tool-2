/** 貼り付け時に混ざる改行・空白を取り除く(JSの \s は全角スペースも含む)。Rust側と同じ規則。 */
export function normalizeLicenseKey(raw: string): string {
  return raw.replace(/\s/g, "");
}

/** 形式だけの事前確認(署名の検証はRust側で行う)。 */
export function looksLikeLicenseKey(normalized: string): boolean {
  return /^MDK1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(normalized) && normalized.length <= 1024;
}
