const yenFormatter = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

export function formatYen(value: number): string {
  return yenFormatter.format(value);
}
