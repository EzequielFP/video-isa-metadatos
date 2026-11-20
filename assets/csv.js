export async function readCsv(path, limit = Infinity) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  const content = await response.text();
  const rows = parseCsv(content.replace(/^\uFEFF/, ""), limit + 1);
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function parseCsv(content, limit) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < content.length && rows.length < limit; i += 1) {
    const char = content[i];
    if (char === '"') {
      if (quoted && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && content[i + 1] === "\n") i += 1;
    } else {
      field += char;
    }
  }

  if (rows.length < limit && (row.length || field)) rows.push([...row, field]);
  return rows;
}
