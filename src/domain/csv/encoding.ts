export type CsvEncoding = "utf-8" | "shift_jis";

const UTF8_BOM = [0xef, 0xbb, 0xbf];

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  );
}

// UTF-8として厳密デコードできればUTF-8、できなければShift_JISとみなす簡易判定。
// 手動でエンコーディングを指定したい場合はforceEncodingを渡す。
export function decodeCsvBytes(
  buffer: ArrayBuffer,
  forceEncoding?: CsvEncoding,
): { text: string; encoding: CsvEncoding } {
  const bytes = new Uint8Array(buffer);
  const withoutBom = hasUtf8Bom(bytes) ? bytes.slice(3) : bytes;

  if (forceEncoding === "shift_jis") {
    return { text: new TextDecoder("shift_jis").decode(bytes), encoding: "shift_jis" };
  }
  if (forceEncoding === "utf-8") {
    return { text: new TextDecoder("utf-8").decode(withoutBom), encoding: "utf-8" };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(withoutBom);
    return { text, encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("shift_jis").decode(bytes), encoding: "shift_jis" };
  }
}
