import { DomainError } from "@/domain/shared/errors";

/** 円の整数金額であることを確認する。小数・非数・無限大は許可しない。 */
export function assertYen(value: number, context: string): number {
  if (!Number.isInteger(value)) {
    throw new DomainError(
      `${context}は円の整数である必要があります: ${value}`,
      "invalid_yen_amount",
    );
  }
  return value;
}

export function sumYen(values: number[]): number {
  return values.reduce((total, value) => total + assertYen(value, "金額"), 0);
}

/** 0円未満にならないよう切り下げる。 */
export function clampToZeroYen(value: number): number {
  return Math.max(0, value);
}
