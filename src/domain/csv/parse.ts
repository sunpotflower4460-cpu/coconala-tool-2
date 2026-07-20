// RFC4180に近い最小限のCSVパーサー。引用符で囲まれたフィールド内の改行・カンマ・二重引用符(escaped "")に対応する。
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let hasContent = false;
  let index = 0;
  const length = text.length;

  while (index < length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      hasContent = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      hasContent = true;
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      hasContent = false;
      index += 1;
      continue;
    }
    field += char;
    hasContent = true;
    index += 1;
  }

  if (hasContent || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
}
