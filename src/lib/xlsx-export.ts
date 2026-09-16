type XlsxSheet = { name: string; rows: string[][] };

const XML_ESCAPE_RE = /[&<>"']/g;
const XML_ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (value: string) => value.replace(XML_ESCAPE_RE, (char) => XML_ESCAPE_MAP[char]);

const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = false;
      } else cell += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\r") { row.push(cell); rows.push(row); row = []; cell = ""; if (csv[i + 1] === "\n") i += 1; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
};

const columnName = (index: number) => {
  let n = index + 1;
  let result = "";
  while (n > 0) { const remainder = (n - 1) % 26; result = String.fromCharCode(65 + remainder) + result; n = Math.floor((n - 1) / 26); }
  return result;
};

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
};
const writeU16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const writeU32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

const zipStore = (files: Array<{ name: string; data: Uint8Array }>) => {
  const encoder = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const file of files) {
    const name = encoder.encode(file.name); const data = file.data; const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length); const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50); writeU16(localView, 4, 20); writeU16(localView, 6, 0x0800); writeU16(localView, 8, 0); writeU16(localView, 10, dosTime); writeU16(localView, 12, dosDate); writeU32(localView, 14, checksum); writeU32(localView, 18, data.length); writeU32(localView, 22, data.length); writeU16(localView, 26, name.length); writeU16(localView, 28, 0); local.set(name, 30); parts.push(local, data);
    const entry = new Uint8Array(46 + name.length); const entryView = new DataView(entry.buffer);
    writeU32(entryView, 0, 0x02014b50); writeU16(entryView, 4, 20); writeU16(entryView, 6, 20); writeU16(entryView, 8, 0x0800); writeU16(entryView, 10, 0); writeU16(entryView, 12, dosTime); writeU16(entryView, 14, dosDate); writeU32(entryView, 16, checksum); writeU32(entryView, 20, data.length); writeU32(entryView, 24, data.length); writeU16(entryView, 28, name.length); writeU16(entryView, 30, 0); writeU16(entryView, 32, 0); writeU16(entryView, 34, 0); writeU16(entryView, 36, 0); writeU32(entryView, 38, 0); writeU32(entryView, 42, offset); entry.set(name, 46); central.push(entry); offset += local.length + data.length;
  }
  const centralOffset = offset; const centralSize = central.reduce((total, entry) => total + entry.length, 0); const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50); writeU16(endView, 4, 0); writeU16(endView, 6, 0); writeU16(endView, 8, files.length); writeU16(endView, 10, files.length); writeU32(endView, 12, centralSize); writeU32(endView, 16, centralOffset); writeU16(endView, 20, 0);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const makeWorksheetXml = (rows: string[][]) => {
  const rowXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value ?? ""))}</t></is></c>`).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
};

export const csvToXlsxBlob = (csv: string, extraSheets: XlsxSheet[] = []) => {
  const sheets: XlsxSheet[] = [{ name: "Registrations", rows: parseCsv(csv) }, ...extraSheets];
  const encoder = new TextEncoder();
  const files: Array<{ name: string; data: Uint8Array }> = [];
  const sheetOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  files.push({ name: "[Content_Types].xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}</Types>`) });
  files.push({ name: "_rels/.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) });
  const sheetsXml = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  files.push({ name: "xl/workbook.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets></workbook>`) });
  const rels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  files.push({ name: "xl/_rels/workbook.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`) });
  sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: encoder.encode(makeWorksheetXml(sheet.rows)) }));
  return zipStore(files);
};
