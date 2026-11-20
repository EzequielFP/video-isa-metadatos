export const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
export const temperature = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
const dateFormat = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
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
