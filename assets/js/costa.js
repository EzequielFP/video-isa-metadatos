// Capítulo 04 · La costa no duerme. Escenas interactivas con los datos del video
// (assets/datos/costa.json, generado por scripts/preparar_cap45.py).
import { palette } from "./util.js";
import { datos, fmt, reloj, proyeccion, contorno, lienzo, bucle, etiqueta, puntero, horario, rampa } from "./mapa.js";

const URL = "assets/datos/costa.json";
const COLOR = { "Cali-Yumbo": "#f29a00", "Bogotá-Cundinamarca": palette.cobalt, "Antioquia": palette.aqua, "Caribe": palette.coral };
const TRES = ["Cali-Yumbo", "Bogotá-Cundinamarca", "Caribe"];
const PAL_KWH = [[0.2, "#1d4e7a"], [0.8, "#2f7fa8"], [1.3, "#3fb5bd"], [1.9, "#e8b923"], [2.6, "#ff7a2a"], [3.4, "#d8341f"]];
const PAL_ACCESO = [[0, "#5a0d2e"], [30, "#a3204a"], [60, "#e8713c"], [85, "#e8b923"], [100, "#16a39a"]];

/* ---------------- El reloj del país ---------------- */
export async function setupReloj(root, { reduce }) {
  const D = await datos(URL);
  const M = D.mercados.filter((m) => TRES.includes(m.id)).map((m) => ({ ...m, max: Math.max(...m.mwh), color: COLOR[m.id] }));
  const dial = root.querySelector("[data-dial]"), mapa = root.querySelector("[data-mapa]");
  const range = root.querySelector("[data-hora]"), lectura = root.querySelector("[data-lectura]"), boton = root.querySelector("[data-play]");
  let h = Number(range.value), jugando = !reduce.matches;
  const noche = (hh) => { const x = ((hh % 24) + 24) % 24; return x >= 19 || x < 5 ? 1 : x >= 17.5 ? (x - 17.5) / 1.5 : x < 6.5 ? 1 - (x - 5) / 1.5 : 0; };

  const D1 = lienzo(dial, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const cx = w / 2, cy = hgt / 2, R = Math.min(w, hgt) / 2 - 34;
    const ang = (hh) => (hh / 24) * Math.PI * 2 - Math.PI / 2;
    // noche sombreada
    ctx.fillStyle = "rgba(19,20,26,.06)";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R + 18, ang(18.5), ang(30)); ctx.closePath(); ctx.fill();
    // anillos de referencia
    ctx.strokeStyle = "rgba(19,20,26,.12)"; ctx.lineWidth = 1;
    for (const p of [0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * (0.42 + (p - 0.5) * 1.1), 0, Math.PI * 2); ctx.stroke(); }
    ctx.font = "600 11px Azeret Mono, monospace"; ctx.fillStyle = palette.muted; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k < 24; k += 3) {
      const a = ang(k);
      ctx.fillText(String(k).padStart(2, "0"), cx + Math.cos(a) * (R + 20), cy + Math.sin(a) * (R + 20));
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); ctx.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10)); ctx.stroke();
    }
    const rad = (pct) => R * (0.42 + (pct - 0.5) * 1.1);
    for (const m of M) {
      ctx.beginPath();
      for (let k = 0; k <= 240; k++) {
        const hh = k / 10, r = rad(horario(m.mwh, hh) / m.max), a = ang(hh);
        k ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = m.color + "14"; ctx.fill();
      ctx.strokeStyle = m.color; ctx.lineWidth = 2.6; ctx.stroke();
      const ap = ang(m.pico), rp = rad(1);
      ctx.fillStyle = m.color; ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ap) * rp, cy + Math.sin(ap) * rp, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // manecilla
    const a = ang(h);
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8)); ctx.stroke();
    for (const m of M) {
      const r = rad(horario(m.mwh, h) / m.max);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = m.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // centro
    ctx.fillStyle = "rgba(251,249,243,.92)"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = palette.ink; ctx.font = `800 ${Math.round(R * 0.2)}px Barlow Condensed, sans-serif`;
    ctx.fillText(reloj(h), cx, cy - R * 0.02);
    const enPico = M.find((m) => Math.abs((((h - m.pico) % 24) + 24) % 24) < 0.6 || Math.abs((((m.pico - h) % 24) + 24) % 24) < 0.4);
    ctx.font = "600 11px Azeret Mono, monospace"; ctx.fillStyle = enPico ? enPico.color : palette.muted;
    ctx.fillText(enPico ? `PICO · ${enPico.nombre.toUpperCase()}` : (noche(h) > 0.5 ? "NOCHE" : "DÍA"), cx, cy + R * 0.14);
  });

  const D2 = lienzo(mapa, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const n = noche(h);
    const p = proyeccion(w, hgt, [-79.3, -4.4, -66.7, 15.6], 18);   // margen arriba para la columna del Caribe
    contorno(ctx, D.colombia, p, { fill: n > 0.5 ? "rgba(19,20,26,.86)" : `rgba(19,20,26,${0.05 + 0.8 * n})`, stroke: "rgba(19,20,26,.6)" });
    const rotulos = [];
    ctx.font = "700 12px Overused Grotesk, sans-serif";
    for (const m of [...M].sort((a, b) => b.lat - a.lat)) {
      const v = horario(m.mwh, h), pct = v / m.max;
      const alto = 18 + 150 * Math.pow(Math.max(0, (pct - 0.5) / 0.5), 1.3);
      const [x, y] = p(m.lon, m.lat);
      const g = ctx.createLinearGradient(0, y - alto, 0, y);
      g.addColorStop(0, m.color + "00"); g.addColorStop(0.6, m.color); g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g; ctx.fillRect(x - 7, y - alto, 14, alto);
      ctx.fillStyle = m.color; ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      if (pct > 0.985) { ctx.strokeStyle = m.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 24, 9, 0, 0, Math.PI * 2); ctx.stroke(); }
      const texto = `${fmt(v)} MWh`, ancho = ctx.measureText(texto).width;
      rotulos.push({ texto, ancho, x: x + 12 + ancho > w - 4 ? x - 12 - ancho : x + 12, y: y - alto + 10, color: m.color });
    }
    // rótulos sin choques: de arriba abajo, cada uno baja si pisa a uno ya puesto
    rotulos.sort((a, b) => a.y - b.y);
    const puestos = [];
    for (const r of rotulos) {
      r.y = Math.max(16, r.y);
      for (const q of puestos) if (r.x < q.x + q.ancho + 14 && q.x < r.x + r.ancho + 14 && Math.abs(r.y - q.y) < 20) r.y = q.y + 20;
      puestos.push(r);
      // pastilla clara: se lee igual sobre el mapa de día, de noche o sobre una columna
      ctx.fillStyle = "rgba(251,249,243,.94)"; ctx.fillRect(r.x - 9, r.y - 12, r.ancho + 15, 17);
      ctx.fillStyle = r.color; ctx.fillRect(r.x - 9, r.y - 12, 3, 17);
      ctx.fillStyle = palette.ink; ctx.textAlign = "left";
      ctx.fillText(r.texto, r.x, r.y);
    }
  });

  const pintar = () => {
    D1.pintar(); D2.pintar();
    range.value = h.toFixed(2);
    lectura.innerHTML = `<strong>${reloj(h)}</strong>` + M.map((m) => { const v = horario(m.mwh, h); return `<span style="--series:${m.color}">${m.nombre} <strong>${fmt(v)} MWh</strong> (${fmt(100 * v / m.max)} %)</span>`; }).join("");
  };
  range.addEventListener("input", () => { h = Number(range.value); jugando = false; boton.setAttribute("aria-pressed", "false"); boton.textContent = "Reproducir"; pintar(); });
  boton.addEventListener("click", () => { jugando = !jugando; boton.setAttribute("aria-pressed", String(jugando)); boton.textContent = jugando ? "Pausar" : "Reproducir"; });
  boton.textContent = jugando ? "Pausar" : "Reproducir";
  bucle(root, (dt) => { if (jugando) { h = (h + dt * 1.6) % 24; pintar(); } }, { reduce });
  pintar();
}

/* ---------------- Hogares con aire acondicionado ---------------- */
export async function setupWaffle(root) {
  const D = await datos(URL);
  const grupos = [["Caribe", D.calor.aire_caribe, palette.coral], ["Región Oriental", D.calor.aire_oriental, palette.cobalt]];
  root.innerHTML = grupos.map(([n, v, c]) => `<div class="waffle"><p class="num" style="color:${c}">${fmt(v)}<small>%</small></p><div class="waffle-grid" style="--c:${c}">${'<i></i>'.repeat(100)}</div><p class="fine">${n} · hogares con aire acondicionado</p></div>`).join("");
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    root.querySelectorAll(".waffle").forEach((w, k) => w.querySelectorAll("i").forEach((c, i) => { if (i < grupos[k][1]) setTimeout(() => c.classList.add("on"), 220 + i * 45); }));
  }, { threshold: 0.4 });
  io.observe(root);
}

/* ---------------- El bosque de la factura ---------------- */
export async function setupBosque(root, { reduce, fine }) {
  const D = await datos(URL);
  const canvas = root.querySelector("canvas"), tip = etiqueta(root.querySelector(".lab-fig"));
  const salida = root.querySelector("[data-par-texto]");
  const MUN = D.municipios.map((m) => ({ cod: m[0], n: m[1], dpto: m[2], lon: m[3], lat: m[4], kwh: m[5], icee: m[6], pob: m[7] }));
  const porCod = Object.fromEntries(MUN.map((m) => [m.cod, m]));
  const PARES = {
    barranquilla: ["08001", "08758"], bogota: ["11001", "25754"], pacifico: ["13001", "76109", "52835"], guajira: ["44001", "44847"],
  };
  let theta = -0.18, sel = null, dibujados = [], crece = reduce.matches ? 1 : 0, arrastre = null;
  const cLon = -74.3, cLat = 4.6;

  const L = lienzo(canvas, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const s = Math.min(w / 13.5, hgt / 15.5) * 1.02, k = Math.cos(4 * Math.PI / 180), comp = 0.58;
    const cx = w / 2, cy = hgt * 0.56;
    const ct = Math.cos(theta), st = Math.sin(theta);
    const proj = (lon, lat) => {
      const gx = (lon - cLon) * k * s, gy = -(lat - cLat) * s;
      const rx = gx * ct - gy * st, ry = gx * st + gy * ct;
      return [cx + rx, cy + ry * comp, ry];
    };
    // suelo
    ctx.beginPath();
    for (const anillo of D.colombia) { anillo.forEach(([lo, la], i) => { const [x, y] = proj(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }
    ctx.fillStyle = "rgba(19,20,26,.06)"; ctx.fill(); ctx.strokeStyle = "rgba(19,20,26,.45)"; ctx.lineWidth = 1.1; ctx.stroke();
    const elegidos = sel ? new Set(PARES[sel]) : null;
    dibujados = MUN.map((m) => { const [x, y, d] = proj(m.lon, m.lat); return { m, x, y, d }; }).sort((a, b) => a.d - b.d);
    const altoPor = s * 1.15;
    for (const c of dibujados) {
      const alto = c.m.kwh * altoPor * crece;
      const resaltado = elegidos?.has(c.m.cod);
      ctx.globalAlpha = elegidos ? (resaltado ? 1 : 0.16) : 0.92;
      ctx.strokeStyle = rampa(c.m.kwh, PAL_KWH);
      ctx.lineWidth = resaltado ? 7 : Math.max(2, s * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - alto); ctx.stroke();
      c.top = c.y - alto;
    }
    ctx.globalAlpha = 1;
    if (elegidos) {
      ctx.font = "700 13px Overused Grotesk, sans-serif"; ctx.textAlign = "left";
      for (const c of dibujados.filter((c) => elegidos.has(c.m.cod))) {
        ctx.fillStyle = "rgba(251,249,243,.92)";
        const t = `${c.m.n} · ${fmt(c.m.kwh, 2)}`;
        const tw = ctx.measureText(t).width;
        ctx.fillRect(c.x + 8, c.top - 22, tw + 12, 20);
        ctx.fillStyle = palette.ink; ctx.fillText(t, c.x + 14, c.top - 8);
      }
    }
  });

  const escribir = () => {
    if (!sel) { salida.textContent = "Cada columna es un municipio: su altura es el consumo residencial por persona al día. Elige una comparación o pasa el cursor sobre el mapa."; return; }
    const [a, ...otros] = PARES[sel].map((c) => porCod[c]);
    salida.innerHTML = otros.map((b) => `<b>${b.n}</b> consume ${fmt(b.kwh, 2)} kWh por persona al día: <b>${fmt(Math.abs(100 * (b.kwh / a.kwh - 1)))} % ${b.kwh < a.kwh ? "menos" : "más"}</b> que ${a.n} (${fmt(a.kwh, 2)}).`).join(" ");
  };
  root.querySelectorAll("[data-par]").forEach((b) => b.addEventListener("click", () => {
    sel = sel === b.dataset.par ? null : b.dataset.par;
    root.querySelectorAll("[data-par]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.par === sel)));
    escribir(); L.pintar();
  }));
  escribir();
  canvas.addEventListener("pointermove", (ev) => {
    const [x, y] = puntero(canvas, ev);
    if (arrastre) { theta = arrastre.t + (x - arrastre.x) / 260; L.pintar(); return; }
    let mejor = null, dmin = 14;
    for (const c of dibujados) { const d = Math.min(Math.hypot(x - c.x, y - c.y), Math.hypot(x - c.x, y - c.top)); if (d < dmin) { dmin = d; mejor = c; } }
    if (mejor) tip.mostrar(`<b>${mejor.m.n}</b> · ${mejor.m.dpto}<br>${fmt(mejor.m.kwh, 2)} kWh por persona al día${mejor.m.icee != null ? `<br>Cobertura ${fmt(mejor.m.icee)} %` : ""}`, x, y);
    else tip.ocultar();
  });
  canvas.addEventListener("pointerdown", (ev) => { const [x] = puntero(canvas, ev); arrastre = { x, t: theta }; canvas.setPointerCapture(ev.pointerId); });
  canvas.addEventListener("pointerup", () => { arrastre = null; });
  canvas.addEventListener("pointerleave", () => tip.ocultar());
  let tiempo = 0;
  bucle(root, (dt) => {
    tiempo += dt;
    if (crece < 1) crece = Math.min(1, crece + dt * 0.55);
    if (!arrastre) theta = -0.18 + 0.16 * Math.sin(tiempo * 0.25);
    L.pintar();
  }, { reduce });
}

/* ---------------- Calor y acceso ---------------- */
export async function setupCalor(root, { reduce }) {
  const D = await datos(URL);
  const canvas = root.querySelector("canvas"), tip = etiqueta(root.querySelector(".lab-fig"));
  const MUN = D.municipios.map((m) => ({ cod: m[0], n: m[1], dpto: m[2], kwh: m[5], icee: m[6], pob: m[7], t: m[8] }));
  const NOMBRES = { "08001": "Barranquilla", "13001": "Cartagena", "44001": "Riohacha", "44847": "Uribia", "76109": "Buenaventura", "52835": "Tumaco", "11001": "Bogotá", "25754": "Soacha" };
  let modo = "acceso", u = reduce.matches ? 1 : 0, puntos = [];
  const L = lienzo(canvas, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const m0 = { l: 58, r: 26, t: 18, b: 46 };
    const X = (t) => m0.l + ((t - 2) / (30 - 2)) * (w - m0.l - m0.r);
    const Y = (k) => hgt - m0.b - (Math.min(k, 4) / 4) * (hgt - m0.t - m0.b);
    ctx.strokeStyle = "rgba(19,20,26,.1)"; ctx.lineWidth = 1; ctx.font = "500 11px Azeret Mono, monospace"; ctx.fillStyle = palette.muted;
    for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(m0.l, Y(k)); ctx.lineTo(w - m0.r, Y(k)); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(fmt(k), m0.l - 8, Y(k) + 4); }
    for (let t = 5; t <= 30; t += 5) { ctx.textAlign = "center"; ctx.fillText(`${t} °C`, X(t), hgt - m0.b + 18); }
    ctx.textAlign = "left"; ctx.fillStyle = palette.ink2;
    ctx.fillText(w < 560 ? "Temperatura a las 3 a. m. →" : "Temperatura a las 3 a. m. (ERA5-Land, ene–feb 2024) →", m0.l, hgt - 8);
    ctx.save(); ctx.translate(14, m0.t + 4); ctx.rotate(Math.PI / 2); ctx.fillText("kWh por persona al día →", 0, 0); ctx.restore();
    puntos = [];
    for (const m of [...MUN].sort((a, b) => b.pob - a.pob)) {
      const x = X(m.t), yFin = Y(m.kwh), y = Y(0) + (yFin - Y(0)) * Math.min(1, Math.max(0, u * 1.6 - (m.t - 2) / 40));
      const r = Math.max(2.2, Math.sqrt(m.pob) / 120);
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = modo === "acceso" ? (m.icee == null ? "#999" : rampa(m.icee, PAL_ACCESO)) : rampa(m.kwh, PAL_KWH);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(19,20,26,.35)"; ctx.lineWidth = 0.6; ctx.stroke();
      puntos.push({ m, x, y, r });
    }
    if (u >= 1) {
      ctx.font = "700 12px Overused Grotesk, sans-serif"; ctx.textAlign = "left"; ctx.lineJoin = "round";
      const puestos = [];
      for (const p of puntos.filter((p) => NOMBRES[p.m.cod]).sort((a, b) => a.y - b.y)) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2); ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.4; ctx.stroke();
        // a la derecha del círculo; si no cabe, a la izquierda; si pisa otro rótulo, baja
        const texto = NOMBRES[p.m.cod], ancho = ctx.measureText(texto).width;
        const r = { x: p.x + p.r + 6 + ancho > w - 4 ? p.x - p.r - 6 - ancho : p.x + p.r + 6, y: p.y + 4, ancho };
        for (const q of puestos) if (r.x < q.x + q.ancho + 4 && q.x < r.x + r.ancho + 4 && Math.abs(r.y - q.y) < 14) r.y = q.y + 14;
        puestos.push(r);
        ctx.strokeStyle = "rgba(251,249,243,.92)"; ctx.lineWidth = 4; ctx.strokeText(texto, r.x, r.y);
        ctx.fillStyle = palette.ink; ctx.fillText(texto, r.x, r.y);
      }
    }
  });
  root.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    root.querySelectorAll("[data-modo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    root.querySelector("[data-leyenda]").dataset.leyenda = modo;
    L.pintar();
  }));
  canvas.addEventListener("pointermove", (ev) => {
    const [x, y] = puntero(canvas, ev);
    let mejor = null, dmin = 12;
    for (const p of puntos) { const d = Math.hypot(x - p.x, y - p.y) - p.r; if (d < dmin) { dmin = d; mejor = p; } }
    if (mejor) tip.mostrar(`<b>${mejor.m.n}</b> · ${mejor.m.dpto}<br>${fmt(mejor.m.t, 1)} °C a las 3 a. m. · ${fmt(mejor.m.kwh, 2)} kWh/persona/día${mejor.m.icee != null ? `<br>Cobertura de energía ${fmt(mejor.m.icee)} %` : ""}`, x, y);
    else tip.ocultar();
  });
  canvas.addEventListener("pointerleave", () => tip.ocultar());
  bucle(root, (dt) => { if (u < 1) { u = Math.min(1, u + dt * 0.7); L.pintar(); } }, { reduce });
}

/* ---------------- Seis años de demanda ---------------- */
export async function setupCrece(root, { reduce }) {
  const D = await datos(URL);
  const H = D.historia, canvas = root.querySelector("canvas"), tip = etiqueta(root.querySelector(".lab-fig"));
  const S = [["Caribe", palette.coral, 4], ["Antioquia", palette.aqua, 2], ["Cali-Yumbo", "#f29a00", 2], ["Bogotá-Cundinamarca", palette.cobalt, 3], ["Nacional", palette.ink, 2, [6, 5]]];
  let u = reduce.matches ? 1 : 0, hover = null;
  const L = lienzo(canvas, ({ ctx, width: w, height: hgt }) => {
    ctx.clearRect(0, 0, w, hgt);
    const m0 = { l: 46, r: 92, t: 16, b: 34 };
    const X = (i) => m0.l + (i / 5) * (w - m0.l - m0.r), Y = (v) => hgt - m0.b - ((v - 95) / 35) * (hgt - m0.t - m0.b);
    ctx.font = "500 11px Azeret Mono, monospace"; ctx.fillStyle = palette.muted; ctx.strokeStyle = "rgba(19,20,26,.1)";
    for (const v of [100, 110, 120, 130]) { ctx.beginPath(); ctx.moveTo(m0.l, Y(v)); ctx.lineTo(w - m0.r, Y(v)); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(v, m0.l - 8, Y(v) + 4); }
    H.anios.forEach((a, i) => { ctx.textAlign = "center"; ctx.fillText(a, X(i), hgt - 10); });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, m0.l + (w - m0.l - m0.r) * u + 2, hgt); ctx.clip();
    for (const [k, c, lw, dash] of S) {
      const v = H[k].map((x) => (100 * x) / H[k][0]);
      ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
      ctx.beginPath(); v.forEach((y, i) => (i ? ctx.lineTo(X(i), Y(y)) : ctx.moveTo(X(i), Y(y)))); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (u >= 1) {
      ctx.font = "700 12px Overused Grotesk, sans-serif"; ctx.textAlign = "left";
      for (const [k, c] of S) { const v = (100 * H[k][5]) / H[k][0]; ctx.fillStyle = c; ctx.fillText(`${k === "Bogotá-Cundinamarca" ? "Bogotá–Cund." : k.replace("-", "–")} +${fmt(v - 100, 1)} %`, X(5) + 8, Y(v) + 4); }
    }
    if (hover != null) { ctx.strokeStyle = palette.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(hover), m0.t); ctx.lineTo(X(hover), hgt - m0.b); ctx.stroke(); }
  });
  const { ScrollTrigger } = window.atlas;
  if (!reduce.matches && ScrollTrigger) ScrollTrigger.create({ trigger: root, start: "top 80%", end: "bottom 60%", scrub: 0.6, onUpdate: (st) => { u = st.progress; L.pintar(); } });
  canvas.addEventListener("pointermove", (ev) => {
    const [x, y] = puntero(canvas, ev);
    const w = canvas.clientWidth, i = Math.round(((x - 46) / (w - 46 - 92)) * 5);
    if (i < 0 || i > 5) { hover = null; tip.ocultar(); L.pintar(); return; }
    hover = i; L.pintar();
    tip.mostrar(`<b>${H.anios[i]}</b><br>` + S.map(([k, c]) => `<span style="color:${c}">●</span> ${k.replace("-", "–")} ${fmt(H[k][i], 1)} GWh/día`).join("<br>"), x, y);
  });
  canvas.addEventListener("pointerleave", () => { hover = null; tip.ocultar(); L.pintar(); });
  // anillo del 29,3 %
  const arco = root.closest("section")?.querySelector("[data-donut]");
  if (arco) {
    const c = 2 * Math.PI * 54, v = H.participacion / 100;
    arco.style.strokeDasharray = `0 ${c}`;
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); arco.style.transition = "stroke-dasharray 1.8s cubic-bezier(.22,1,.36,1)"; arco.style.strokeDasharray = `${c * v} ${c}`; } }, { threshold: 0.5 }).observe(arco);
  }
}
