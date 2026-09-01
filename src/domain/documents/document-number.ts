const SEQUENCE_DIGITS = 4;

export function formatDocumentNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
}

/** プレフィックスは利用者が設定できるため、正規表現メタ文字をリテラルとして扱う。 */
export function escapeDocumentNumberPrefix(prefix: string): string {
  return prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 同一プレフィックス・年の既存書類番号から、次に採番すべき連番を求める。
 * 既存番号がなければ1から開始する。
 */
export function nextDocumentSequence(
  existingNumbers: string[],
  prefix: string,
  year: number,
): number {
  const pattern = new RegExp(`^${escapeDocumentNumberPrefix(prefix)}-${year}-(\\d+)$`);
  const usedSequences = existingNumbers
    .map((number) => pattern.exec(number)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);

  return usedSequences.length === 0 ? 1 : Math.max(...usedSequences) + 1;
}
