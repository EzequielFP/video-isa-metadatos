// Utilidades de los capítulos 04 y 05: datos en caché, mapa de Colombia en canvas,
// etiqueta flotante y bucle de animación que solo corre con la escena en pantalla.
import { canvasContext } from "./util.js";

const cache = new Map();
export function datos(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`No se pudo abrir ${url}`); return r.json(); }));
  return cache.get(url);
}

export const fmt = (v, d = 0) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const reloj = (h) => {
  const hh = ((h % 24) + 24) % 24;
  let hi = Math.floor(hh), m = Math.round((hh - hi) * 60);
  if (m === 60) { m = 0; hi = (hi + 1) % 24; }
  return `${String(hi).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/* Proyección equirectangular corregida por la latitud media, ajustada a una caja de lon/lat */
export function proyeccion(width, height, caja = [-79.3, -4.4, -66.7, 12.7], margen = 14) {
  const [x0, y0, x1, y1] = caja;
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const sx = (width - 2 * margen) / ((x1 - x0) * k);
  const sy = (height - 2 * margen) / (y1 - y0);
  const s = Math.min(sx, sy);
  const ox = (width - (x1 - x0) * k * s) / 2;
  const oy = (height - (y1 - y0) * s) / 2;
  const p = (lon, lat) => [ox + (lon - x0) * k * s, oy + (y1 - lat) * s];
  p.escala = s * k;              // px por grado de longitud
  p.kmPx = s / 111.32;           // px por km (dirección norte-sur)
  return p;
}

export function contorno(ctx, anillos, p, { fill = "rgba(19,20,26,.05)", stroke = "rgba(19,20,26,.55)", width = 1.2 } = {}) {
  ctx.beginPath();
  for (const anillo of anillos) {
    anillo.forEach(([lon, lat], i) => { const [x, y] = p(lon, lat); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

/* Lienzo que se redimensiona con su caja */
export function lienzo(canvas, dibujar) {
  let estado = null;
  const rehacer = () => { estado = canvasContext(canvas); if (estado) dibujar(estado); };
  new ResizeObserver(() => rehacer()).observe(canvas);
  rehacer();
  return { get estado() { return estado; }, pintar: () => estado && dibujar(estado), rehacer };
}

/* Bucle de animación activo solo cuando el elemento es visible y el usuario acepta movimiento */
export function bucle(el, paso, { reduce } = {}) {
  let activo = false, raf = 0, ultimo = 0;
  const tick = (t) => {
    if (!activo) return;
    const dt = ultimo ? Math.min(0.1, (t - ultimo) / 1000) : 0;
    ultimo = t;
    paso(dt);
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    const quiere = e.isIntersecting && !(reduce && reduce.matches);
    if (quiere && !activo) { activo = true; ultimo = 0; raf = requestAnimationFrame(tick); }
    if (!quiere) { activo = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.05 }).observe(el);
}

/* Etiqueta flotante dentro de una figura */
export function etiqueta(cont) {
  const el = document.createElement("div");
  el.className = "geo-tip";
  el.setAttribute("role", "status");
  cont.append(el);
  return {
    mostrar(html, x, y) {
      el.innerHTML = html;
      el.classList.add("on");
      const w = cont.clientWidth, ew = el.offsetWidth;
      el.style.transform = `translate(${Math.min(Math.max(8, x + 14), w - ew - 8)}px, ${Math.max(8, y - el.offsetHeight - 12)}px)`;
    },
    ocultar() { el.classList.remove("on"); },
  };
}

/* Coordenadas del puntero relativas al canvas */
export function puntero(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  const t = ev.touches?.[0] ?? ev;
  return [t.clientX - r.left, t.clientY - r.top];
}

/* Interpolación cíclica de 24 muestras horarias (Catmull-Rom) */
export function horario(arr, h) {
  const n = arr.length, f = ((h % n) + n) % n, i = Math.floor(f), u = f - i;
  const p0 = arr[(i + n - 1) % n], p1 = arr[i], p2 = arr[(i + 1) % n], p3 = arr[(i + 2) % n];
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}

export function rampa(v, puntos) {
  let i = 0;
  while (i < puntos.length - 2 && v > puntos[i + 1][0]) i++;
  const [a, ca] = puntos[i], [b, cb] = puntos[i + 1];
  const u = Math.max(0, Math.min(1, (v - a) / (b - a)));
  const h = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
  return `rgb(${[0, 1, 2].map((k) => Math.round(h(ca, k) + (h(cb, k) - h(ca, k)) * u)).join(",")})`;
}
