export const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
export const temperature = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
const dateFormat = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const palette = {
  ink: "#13141a", ink2: "#3b3d48", muted: "#696a73", paper: "#fbf9f3", rule: "rgba(19,20,26,.12)",
  cobalt: "#2b3bff", coral: "#ff5b3a", sun: "#ffc21c", lime: "#9ccc1c", aqua: "#16bfae", sky: "#7fb3e6",
};
const degree = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
export function geoLabel(lat, lon) {
  return [`${degree.format(Math.abs(lat))}° ${lat >= 0 ? "N" : "S"}`, `${degree.format(Math.abs(lon))}° ${lon >= 0 ? "E" : "O"}`];
}
export function emitGeo(detail) {
  dispatchEvent(new CustomEvent("atlas:geo", { detail }));
}
export async function loadImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}
export const monthLabel = (value) => dateFormat.format(new Date(`${value}-01T00:00:00Z`));
export const dayLabel = (value) => dayFormat.format(new Date(`${value}T00:00:00Z`));
export const numeric = (value) => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : null;

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo abrir ${url}`);
  return response.json();
}

export function canvasContext(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { ctx, width, height };
}
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
