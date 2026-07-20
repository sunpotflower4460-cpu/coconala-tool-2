import { DomainError } from "@/domain/shared/errors";
import type { RoundingMode } from "@/domain/tax/types";

// 税率計算は浮動小数点演算を経由するため、丸め直前にごく僅かな誤差(1e-9未満)を補正する。
function correctFloatingPointNoise(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function roundYen(value: number, mode: RoundingMode): number {
  const corrected = correctFloatingPointNoise(value);
  switch (mode) {
    case "floor":
      return Math.floor(corrected);
    case "ceil":
      return Math.ceil(corrected);
    case "round":
      return Math.round(corrected);
    default: {
      const exhaustiveCheck: never = mode;
      throw new DomainError(
        `未知の端数処理方式です: ${String(exhaustiveCheck)}`,
        "invalid_rounding_mode",
      );
    }
  }
}
