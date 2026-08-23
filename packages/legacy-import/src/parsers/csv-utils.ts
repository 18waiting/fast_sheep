// M11 CSV utilities (clean-room). Proper CSV parsing: quoted commas, BOM, CRLF,
// empty rows. Never comma-split manually.
export interface CsvTable { headers: string[]; rows: Record<string, string>[] }

export function parseCsv(content: string): CsvTable {
  const text = content.replace(/^\uFEFF/, "");
  const rows = splitCsvRows(text);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(rows[0]);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].trim() === "") continue;
    const cells = parseCsvLine(rows[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cells[j] ?? "";
    out.push(row);
  }
  return { headers, rows: out };
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      cur += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      rows.push(cur);
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur !== "") rows.push(cur);
  return rows;
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.replace(/^"(.*)"$/s, "$1"));
}
