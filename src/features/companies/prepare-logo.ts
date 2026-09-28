import { LOGO_MAX_DIMENSION } from "@/domain/assets/image";

/**
 * 選ばれた画像を最大 LOGO_MAX_DIMENSION px に縮小し、PNGへ変換したバイト列を返す。
 * 再エンコードにより、撮影位置などのメタデータ(EXIF)も取り除かれる。
 * ブラウザ(WebView)の canvas を使うため、画面側に置く。
 */
export async function prepareLogoPng(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を処理できませんでした");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("画像を処理できませんでした");
  return new Uint8Array(await blob.arrayBuffer());
}
