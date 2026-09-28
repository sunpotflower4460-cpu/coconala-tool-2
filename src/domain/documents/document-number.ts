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

export const MAX_DOCUMENT_NUMBER_PREFIX_LENGTH = 10;

/**
 * 書類番号のプレフィックス(4種類)を検査する。問題がなければ空配列。
 * 英数字とアンダースコアのみ・10文字以内・4種類すべて異なること。
 */
export function validateDocumentNumberPrefixes(prefixes: {
  estimate: string;
  invoice: string;
  delivery: string;
  receipt: string;
}): string[] {
  const errors: string[] = [];
  const labels = { estimate: "見積書", invoice: "請求書", delivery: "納品書", receipt: "領収書" };
  for (const [key, value] of Object.entries(prefixes) as [keyof typeof labels, string][]) {
    if (!/^[A-Za-z0-9_]+$/.test(value)) {
      errors.push(`${labels[key]}の記号は半角英数字(と _ )で入力してください`);
    } else if (value.length > MAX_DOCUMENT_NUMBER_PREFIX_LENGTH) {
      errors.push(
        `${labels[key]}の記号は${MAX_DOCUMENT_NUMBER_PREFIX_LENGTH}文字以内にしてください`,
      );
    }
  }
  const values = Object.values(prefixes).map((value) => value.toUpperCase());
  if (new Set(values).size !== values.length) {
    errors.push("4種類の書類で、それぞれ別の記号にしてください(同じだと番号が区別できません)");
  }
  return errors;
}
