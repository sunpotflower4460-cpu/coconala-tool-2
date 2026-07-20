/**
 * 整数の合計値`total`を、`weights`の比率で整数按分する(最大剰余法)。
 * 端数は剰余が大きい項目から1円ずつ割り当てるため、合計は必ず`total`と一致する。
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  if (weightSum === 0) {
    return weights.map(() => 0);
  }

  const floors = weights.map((weight) => Math.floor((total * weight) / weightSum));
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: total * weight - floors[index]! * weightSum,
  }));

  const distributed = floors.reduce((sum, value) => sum + value, 0);
  let remainingUnits = total - distributed;

  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const result = [...floors];
  for (let i = 0; i < remainders.length && remainingUnits > 0; i++) {
    const { index } = remainders[i]!;
    result[index] = (result[index] ?? 0) + 1;
    remainingUnits--;
  }

  return result;
}
