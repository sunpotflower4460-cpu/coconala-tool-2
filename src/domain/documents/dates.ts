/** "YYYY-MM-DD" の日付に日数を足す(タイムゾーンの影響を受けないようUTCで計算する)。 */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day || !Number.isInteger(days)) {
    throw new Error(`日付の形式が正しくありません: ${isoDate}`);
  }
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** 利用者のPCの地域時刻での今日("YYYY-MM-DD")。 */
export function localTodayIsoDate(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
