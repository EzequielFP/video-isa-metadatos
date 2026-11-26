// Capítulo 05 · Seis horas de luz. Escenas interactivas con los datos del video
// (assets/datos/luz.json, generado por scripts/preparar_cap45.py).
import { palette } from "./util.js";
import { datos, fmt, reloj, proyeccion, contorno, lienzo, bucle, etiqueta, puntero } from "./mapa.js";

const URL = "assets/datos/luz.json";
const LUZ = "#ffb21c", APAGADO = "rgba(160,170,180,.38)", VIOLETA = "#7b5cff";
// horario ilustrativo: el servicio se centra en las 9 p. m. (la telemetría da las horas, no el horario)
const prendida = (h, hd) => hd >= 23.5 || Math.abs((((h - 21) % 24) + 36) % 24 - 12) <= hd / 2;

/* ---------------- El horario: 162 localidades ---------------- */
export async function setupHorario(root, { reduce }) {
  const D = await datos(URL);
  const mapa = root.querySelector("[data-mapa]"), hist = root.querySelector("[data-hist]");
  const range = root.querySelector("[data-hora]"), lectura = root.querySelector("[data-lectura]"), boton = root.querySelector("[data-play]");
  const tip = etiqueta(root.querySelector(".lab-fig"));
  const LOC = D.localidades.map(([lon, lat, h, n]) => ({ lon, lat, h, n }));
  let h = Number(range.value), jugando = !reduce.matches, puntos = [], encendidas = 0;
  const M = lienzo(mapa, ({ ctx, width: w, height: hgt }) => {
    ctx.fillStyle = "#0d1220"; ctx.fillRect(0, 0, w, hgt);
    const p = proyeccion(w, hgt, [-79.6, -4.4, -66.6, 13.6], 16);
    contorno(ctx, D.colombia, p, { fill: "rgba(80,100,140,.16)", stroke: "rgba(220,230,255,.35)" });
    puntos = [];
    let n = 0;
    for (const l of LOC) {
      const [x, y] = p(l.lon, l.lat), on = prendida(h, l.h);
      if (on) n++;
      if (on) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
        g.addColorStop(0, l.h >= 23.5 ? "rgba(120,200,255,.55)" : "rgba(255,178,28,.6)"); g.addColorStop(1, "rgba(255,178,28,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = on ? (l.h >= 23.5 ? "#9fd8ff" : LUZ) : APAGADO;
      ctx.beginPath(); ctx.arc(x, y, on ? 3.6 : 2.4, 0, Math.PI * 2); ctx.fill();
      puntos.push({ l, x, y });
    }
    ctx.fillStyle = "#fff"; ctx.font = "800 44px Barlow Condensed, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(reloj(h), 18, 52);
    ctx.font = "600 12px Azeret Mono, monospace"; ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillText(`${n} de ${LOC.length} localidades con luz`, 18, 74);
    encendidas = n;
  });
  const Hs = lienzo(hist, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const bins = new Array(12).fill(0);
    LOC.forEach((l) => bins[Math.min(11, Math.floor(l.h / 2))]++);
    const max = Math.max(...bins), m0 = { l: 8, r: 8, t: 26, b: 22 }, bw = (w - m0.l - m0.r) / 12;
    ctx.font = "600 11px Azeret Mono, monospace"; ctx.fillStyle = palette.ink2; ctx.textAlign = "left";
    ctx.fillText(`Horas de luz al día · mediana ${fmt(D.cifras.mediana_h, 1)} h`, m0.l, 14);
    bins.forEach((v, i) => {
      const bh = (v / max) * (hgt - m0.t - m0.b), x = m0.l + i * bw;
      ctx.fillStyle = i < 6 ? LUZ : palette.aqua; ctx.fillRect(x + 2, hgt - m0.b - bh, bw - 4, bh);
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 1; ctx.strokeRect(x + 2, hgt - m0.b - bh, bw - 4, bh);
      if (i % 2 === 0) { ctx.fillStyle = palette.muted; ctx.textAlign = "center"; ctx.fillText(`${i * 2} h`, x + bw / 2, hgt - 6); }
    });
  });
  const pintar = () => {
    M.pintar();
    range.value = h.toFixed(2);
    lectura.innerHTML = `<b>${reloj(h)}</b> · ${encendidas} de ${LOC.length} localidades con luz · <b>${D.cifras.menos12}</b> tienen menos de 12 horas al día`;
  };
  range.addEventListener("input", () => { h = Number(range.value); jugando = false; boton.setAttribute("aria-pressed", "false"); boton.textContent = "Reproducir"; pintar(); });
  boton.addEventListener("click", () => { jugando = !jugando; boton.setAttribute("aria-pressed", String(jugando)); boton.textContent = jugando ? "Pausar" : "Reproducir"; });
  boton.textContent = jugando ? "Pausar" : "Reproducir";
  mapa.addEventListener("pointermove", (ev) => {
    const [x, y] = puntero(mapa, ev);
    let mejor = null, dmin = 10;
    for (const p of puntos) { const d = Math.hypot(x - p.x, y - p.y); if (d < dmin) { dmin = d; mejor = p; } }
    if (mejor) tip.mostrar(`<b>${mejor.l.n}</b><br>${fmt(mejor.l.h, 1)} horas de luz al día (promedio)`, x, y); else tip.ocultar();
  });
  mapa.addEventListener("pointerleave", () => tip.ocultar());
  bucle(root, (dt) => { if (jugando) { h = (h + dt * 1.8) % 24; pintar(); } }, { reduce });
  pintar(); Hs.pintar();
}

/* ---------------- Cerca de la red: anillos de distancia ---------------- */
export async function setupAnillos(root, { reduce }) {
  const D = await datos(URL);
  const canvas = root.querySelector("canvas"), range = root.querySelector("[data-km]"), lectura = root.querySelector("[data-lectura]");
  const KM = D.municipios_km, TOTAL = KM.reduce((s, m) => s + m[1], 0);
  const cuota = (r) => (100 * KM.reduce((s, m) => s + (m[0] < r ? m[1] : 0), 0)) / TOTAL;
  let km = reduce.matches ? 50 : 0, animando = !reduce.matches;
  const L = lienzo(canvas, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const p = proyeccion(w, hgt, [-79.6, -4.4, -66.6, 13.6], 14);
    contorno(ctx, D.colombia, p, { fill: "rgba(19,20,26,.05)", stroke: "rgba(19,20,26,.5)" });
    const r = km * p.kmPx;
    if (r > 0.5) {
      ctx.fillStyle = "rgba(43,59,255,.05)"; ctx.strokeStyle = "rgba(43,59,255,.32)"; ctx.lineWidth = 1;
      for (const [lon, lat] of D.subestaciones) { const [x, y] = p(lon, lat); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    for (const pt of D.puntos) {
      const [x, y] = p(pt[0], pt[1]), dentro = pt[2] < km;
      ctx.fillStyle = dentro ? "#f29a00" : "rgba(19,20,26,.35)";
      ctx.beginPath(); ctx.arc(x, y, dentro ? 2.3 : 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = palette.cobalt;
    for (const [lon, lat] of D.subestaciones) { const [x, y] = p(lon, lat); ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2); }
  });
  const pintar = () => {
    L.pintar();
    range.value = Math.round(km);
    lectura.innerHTML = `Radio <b>${fmt(km)} km</b> · <b>${fmt(cuota(km), 1)} %</b> de las viviendas rurales sin servicio está en municipios cuya cabecera queda dentro de ese radio`;
  };
  range.addEventListener("input", () => { km = Number(range.value); animando = false; pintar(); });
  bucle(root, (dt) => { if (animando) { km = Math.min(50, km + dt * 22); if (km >= 50) animando = false; pintar(); } }, { reduce });
  pintar();
}

/* ---------------- El sol cambia la cuenta: 25 cabeceras ---------------- */
export async function setupDiesel(root, { reduce }) {
  const D = await datos(URL);
  const canvas = root.querySelector("canvas"), tip = etiqueta(root.querySelector(".lab-fig"));
  const C = [...D.cabeceras].sort((a, b) => b.diesel - a.diesel);
  let u = reduce.matches ? 1 : 0, filas = [];
  const L = lienzo(canvas, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const m0 = { l: w < 520 ? 124 : 150, r: 24, t: 30, b: 30 }, fh = (hgt - m0.t - m0.b) / C.length;
    const X = (v) => m0.l + (v / 2200) * (w - m0.l - m0.r);
    ctx.font = "500 11px Azeret Mono, monospace"; ctx.fillStyle = palette.muted; ctx.strokeStyle = "rgba(19,20,26,.1)";
    for (const v of [0, 500, 1000, 1500, 2000]) { ctx.beginPath(); ctx.moveTo(X(v), m0.t - 6); ctx.lineTo(X(v), hgt - m0.b); ctx.stroke(); ctx.textAlign = "center"; ctx.fillText(fmt(v), X(v), hgt - 10); }
    ctx.textAlign = "right"; ctx.fillText("pesos por kWh →", w - m0.r, m0.t - 12);
    filas = [];
    C.forEach((c, i) => {
      const y = m0.t + fh * (i + 0.5), pch = c.mejor === "Diésel", linea = c.mejor.startsWith("Línea");
      const destino = linea ? c.linea : c.hib, xD = X(c.diesel), xH = X(c.diesel + (destino - c.diesel) * u);
      ctx.fillStyle = c.n === "Mitú" ? palette.ink : palette.ink2; ctx.font = `${c.n === "Mitú" ? 800 : 600} ${w < 520 ? 12 : 13}px Overused Grotesk, sans-serif`; ctx.textAlign = "right";
      ctx.fillText(w < 520 ? c.n.replace("El Litoral Del San Juan", "Litoral San Juan") : c.n, m0.l - 12, y + 4);
      if (!pch) {
        ctx.strokeStyle = linea ? palette.aqua : "#e0a100"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(xD, y); ctx.lineTo(xH, y); ctx.stroke();
      }
      ctx.fillStyle = "#8a5a12"; ctx.beginPath(); ctx.arc(xD, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pch ? "#9aa3ad" : linea ? palette.aqua : LUZ; ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(xH, y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      filas.push({ c, y, xD, xH });
    });
  });
  canvas.addEventListener("pointermove", (ev) => {
    const [x, y] = puntero(canvas, ev);
    const f = filas.find((f) => Math.abs(f.y - y) < 12);
    if (!f) { tip.ocultar(); return; }
    const c = f.c;
    tip.mostrar(`<b>${c.n}</b><br>Diésel hoy: ${fmt(c.diesel)} $/kWh<br>${c.mejor === "Diésel" ? "Genera sobre todo con la PCH Mutatá" : `Híbrido solar: ${fmt(c.hib)} $/kWh · ${fmt(100 * c.solar)} % solar`}${c.linea ? `<br>Línea a la red: ${fmt(c.linea)} $/kWh` : ""}<br>${fmt(c.galones)} galones al año menos`, x, y);
  });
  canvas.addEventListener("pointerleave", () => tip.ocultar());
  bucle(root, (dt) => { if (u < 1) { u = Math.min(1, u + dt * 0.45); L.pintar(); } }, { reduce });
}

/* ---------------- La cuenta del diésel: subsidio año por año ---------------- */
export async function setupSubsidio(root) {
  const D = await datos(URL);
  const max = Math.max(...D.facturacion.map((f) => f.subsidio + f.usuario));
  root.innerHTML = D.facturacion.map((f) => `<div class="fila-sub"><span class="num">${f.anio}</span><div class="barra-sub"><i class="u" style="--w:${(100 * f.usuario) / max}%"></i><i class="s" style="--w:${(100 * f.subsidio) / max}%"></i></div><span class="fine">${fmt(f.usuario)} + <b>${fmt(f.subsidio)}</b> $/kWh</span></div>`).join("")
    + `<p class="fine leyenda-sub"><span class="u"></span> lo que paga el usuario · <span class="s"></span> lo que pone el Estado en subsidio</p>`;
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); root.classList.add("on"); } }, { threshold: 0.4 });
  io.observe(root);
}
