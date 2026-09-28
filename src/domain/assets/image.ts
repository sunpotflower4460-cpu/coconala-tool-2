export type ImageMimeType = "image/png" | "image/jpeg";

/** 縮小後のロゴ画像の上限(バックアップや発行済み書類の表示を重くしないため)。 */
export const MAX_LOGO_BYTES = 300_000;
/** ロゴを縮小するときの最大の幅・高さ(px)。 */
export const LOGO_MAX_DIMENSION = 600;

/**
 * 先頭のバイト列(マジックナンバー)から画像形式を判定する。拡張子は信用しない。
 * SVG等のスクリプトを含みうる形式は受け付けない。
 */
export function detectImageMimeType(bytes: Uint8Array): ImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}
