import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { detectImageMimeType, MAX_LOGO_BYTES } from "@/domain/assets/image";
import { err, ok, type Result } from "@/lib/result";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 画像(PNG/JPEG)を保存し、内容のSHA-256を返す。同じ画像は1件だけ保存する。
 * 発行済み書類のスナップショットがこのSHA-256を参照するため、保存した画像は削除しない。
 */
export async function storeImageAsset(
  db: DatabasePort,
  bytes: Uint8Array,
): Promise<Result<{ sha256: string }, AppError>> {
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    return err({
      code: "unsupported_image",
      message: "PNG または JPEG の画像を選んでください。",
    });
  }
  if (bytes.length > MAX_LOGO_BYTES) {
    return err({
      code: "image_too_large",
      message: "画像が大きすぎます。もう少し小さい画像を選んでください。",
    });
  }
  try {
    const sha256 = await sha256Hex(bytes);
    await db.execute(
      `INSERT OR IGNORE INTO app_assets (sha256, mime_type, data_base64, byte_size, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [sha256, mimeType, toBase64(bytes), bytes.length, new Date().toISOString()],
    );
    return ok({ sha256 });
  } catch (error) {
    return err(toAppError(error, "画像の保存に失敗しました。"));
  }
}
