/**
 * 適格請求書発行事業者の登録番号(「T」+数字13桁)を整える。
 * 全角英数字・空白・ハイフンを取り除き、小文字の t も受け付ける。
 */
export function normalizeInvoiceRegistrationNumber(raw: string): string {
  return raw
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-‐－ー]/g, "")
    .toUpperCase();
}

export function isValidInvoiceRegistrationNumber(normalized: string): boolean {
  return /^T\d{13}$/.test(normalized);
}
