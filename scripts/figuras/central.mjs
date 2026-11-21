// Figura isométrica del capítulo 1: el embalse y la central hidráulica junto a una
// turbina térmica, movidos mes a mes por los datos reales de XM y NOAA (ene-2023 a oct-2026).
//
//   node scripts/figuras/central.mjs [--preview <ruta.html>]
//
// Escribe assets/figuras/central.js. El kit (kit/*.mjs) es de Anatomy, licencia MIT:
// github.com/wheresryan22/anatomy
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as T from "./kit/tube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "..");
const kitSource = readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");

// ---------- Verdad: datos mensuales de los archivos publicados ----------
function readCsv(file) {
  const lines = readFileSync(join(SITE, "archivos", "video-1", file), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const head = lines.shift().split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [head[i], v])));
}
const monthly = new Map();
const slot = (m) => monthly.get(m) ?? monthly.set(m, { vol: [], ap: 0, media: 0, hyd: 0, ter: 0, total: 0, days: 0 }).get(m);
for (const r of readCsv("01_embalse_agregado_diario.csv")) slot(r.fecha.slice(0, 7)).vol.push(Number(r.vol_util_pct));
for (const r of readCsv("02_aportes_diario.csv")) { const s = slot(r.fecha.slice(0, 7)); s.ap += Number(r.aportes_GWh); s.media += Number(r.media_historica_GWh); }
for (const r of readCsv("05_generacion_por_tipo_diaria.csv")) {
  const s = slot(r.fecha.slice(0, 7));
  s.hyd += Number(r.HIDRAULICA || 0); s.ter += Number(r.TERMICA || 0); s.total += Number(r.total_GWh || 0); s.days += 1;
}
const nino = JSON.parse(readFileSync(join(SITE, "assets", "media", "pacifico", "serie.json"), "utf8")).frames;
const MONTHS = nino.map((frame) => {
  const s = monthly.get(frame.month);
  const daysIn = new Date(Date.UTC(Number(frame.month.slice(0, 4)), Number(frame.month.slice(5)), 0)).getUTCDate();
  if (!s || s.days !== daysIn || s.vol.length !== daysIn || frame.value === null) throw new Error(`mes incompleto ${frame.month}`);
  return {
    m: frame.month,
    nino: Math.round(frame.value * 100) / 100,
    ap: Math.round((100 * s.ap) / s.media),
    vol: Math.round((s.vol.reduce((a, b) => a + b, 0) / s.vol.length) * 10) / 10,
    hyd: Math.round(s.hyd / s.days),
    ter: Math.round(s.ter / s.days),
    hydPct: Math.round((1000 * s.hyd) / s.total) / 10,
    terPct: Math.round((1000 * s.ter) / s.total) / 10,
  };
});
// Comprobación contra las cifras verificadas del guion (XM, corte 11-nov-2026).
const check = (m, key, value) => { const row = MONTHS.find((r) => r.m === m); if (row[key] !== value) throw new Error(`${m} ${key}: ${row[key]} ≠ ${value}`); };
check("2026-01", "hydPct", 80.7); check("2026-01", "terPct", 11.6); check("2026-02", "ap", 181);
check("2026-08", "ap", 75); check("2026-09", "ap", 66); check("2026-10", "ap", 61); check("2026-10", "nino", 3.43);
const recursos = readCsv("09_listado_recursos.csv").filter((r) => r.Values_Type === "TERMICA");
const THERMAL_TOTAL = recursos.length;
const THERMAL_GAS = recursos.filter((r) => r.Values_EnerSource === "GAS").length;
const THERMAL_COAL = recursos.filter((r) => r.Values_EnerSource === "CARBON").length;

// ---------- Mundo ----------
const WIDTH = 680;
const HEIGHT = 430;
const PLATE = { x: -186, y: -84, w: 372, d: 154, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const BASIN = { x: -152, y: -68, w: 108, d: 60 };
const WALL_TOP = 56;
const DEAD_TOP = 12;
const FULL = 52;
const levelOf = (vol) => DEAD_TOP + (vol / 100) * (FULL - DEAD_TOP);
const WATER = { x: -148, y: -64, w: 92, d: 54, r: 0.4 };
const TOWER = [-66, -38];
const TURBINE = [-8, -51];
const PH = { x: -22, y: -64, w: 28, d: 26 };
const TR = { x: 116, y: -56, w: 24, d: 20, r: 1.5 };
const BUSHINGS = [120, 128, 136];
const BUSH_Y = -44;
const GANTRY_X = [154, 176];
const INSULATORS = [160, 167, 174];
const THERMO = [-172, 31];
const T_MIN = -2;
const T_MAX = 4;
const tempZ = (t) => 12 + ((t - T_MIN) / (T_MAX - T_MIN)) * 46;
const DIALS = { ap: [-112, 26], hyd: [-6, 24], ter: [50, 24] };
const DIAL_R = 11;
const DIAL_Z = 18;
const DIAL_TOP = DIAL_Z + 5;
const DIAL_MAX = { ap: 200, hyd: 250, ter: 250 };
const RULE_FROM = -144;
const RULE_TO = 144;
const STEP = (RULE_TO - RULE_FROM) / (MONTHS.length - 1);

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [92, -52, 75], [-186, -50, 63], [THERMO[0], THERMO[1], 62], [GANTRY_X[1] + 6, -46, 68]],
  WIDTH, HEIGHT, { pad: 28, azimuth: 55 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const f1 = (n) => Math.round(n * 10) / 10;
const pathOf = (points, closed) => "M" + points.map((p) => at(p).map(f1).join(" ")).join("L") + (closed ? "Z" : "");
const seg = (a, b) => pathOf([a, b]);
const faceY = (x0, x1, z0, z1, y) => pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true);
const slab = (plan, z, h, tone = "mid", steps = 3, bevel = 0.4, extra = {}) => S(k.slabOf({ r: 0.5, ...plan }, z, h, P, steps, bevel), { tone, ...extra });
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const flowLine = (points, key) => `<path class="iso-line fig-flow" data-flow data-route="${key}" d="${pathOf(points)}"/>`;
const wire = (points, key) => k.wireSvg(at(points[0]), at(points.at(-1)), { via: points.slice(1, -1).map(at), tone: "lo", size: 1 }) + (key ? flowLine(points, key) : "");

function pipe(points, r, { flanges = [true, true], key } = {}) {
  const route = G.fillet(points, Math.max(3, 2.6 * r), 7, { P, tube: r });
  const pieces = T.tubePieces(route, r, P, { maxLength: 12 });
  pieces.sort((a, b) => G.dot3(a.mid, G.viewOf(P)) - G.dot3(b.mid, G.viewOf(P)));
  const out = pieces.map((piece) => T.tubeSvg(piece, { tone: "mid" }));
  const ends = [[points[0], G.unit3(G.sub3(points[1], points[0]))], [points.at(-1), G.unit3(G.sub3(points.at(-2), points.at(-1)))]];
  ends.forEach(([o, a], i) => { if (flanges[i]) out.push(S(G.disc(0, 1.2, r + 1.4, G.frameAlong(o, a), P), { tone: "mid" })); });
  if (key) out.push(flowLine(route, key));
  return out.join("");
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

// Canal elevado que trae los aportes por encima del muro izquierdo.
const FLUME = { x: -186, y: -48, w: 42, d: 12, r: 0.6 };
const LIP_X = FLUME.x + FLUME.w;
function flumeSupports() {
  const out = [slab({ x: -186, y: -50, w: 4, d: 16 }, 0, 62, "mid", 2, 0.4)];
  for (const x of [-176, -164]) out.push(slab({ x, y: -46, w: 3, d: 8 }, 0, 54, "mid", 2, 0.3));
  return out.join("");
}
function flume() {
  const out = [slab(FLUME, 54, 6, "mid", 2, 0.4)];
  const water = { x: FLUME.x + 4, y: FLUME.y + 2.2, w: FLUME.w - 6, d: FLUME.d - 4.4, r: 0.4 };
  out.push(`<g class="fig-water">${S(k.slabOf(water, 59.2, 0.8, P, 2), { tone: "hi", crease: "none" })}</g>`);
  out.push(L(k.planOutline(water, 60, P, 2), { tone: "lo" }));
  out.push(flowLine([[water.x + 1, -42, 60.1], [water.x + water.w - 0.6, -42, 60.1]], "river"));
  return out.join("");
}

function basinBack() {
  const out = [slab({ x: BASIN.x, y: BASIN.y, w: BASIN.w, d: BASIN.d, r: 1 }, 0, 4, "lo", 3, 0.6)];
  out.push(slab({ x: BASIN.x, y: BASIN.y, w: BASIN.w, d: 4, r: 0.5 }, 4, WALL_TOP - 4, "mid", 2, 0.4));
  return out.join("");
}
function basinSide() {
  const out = [slab({ x: BASIN.x, y: BASIN.y, w: 4, d: BASIN.d, r: 0.5 }, 4, WALL_TOP - 4, "mid", 2, 0.4)];
  const gauge = { x: -140, y: -64, w: 5, d: 0.8, r: 0.2 };
  out.push(slab(gauge, 6, 48, "hi", 2, 0));
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const z = levelOf(i * 10);
    ticks.push(seg([gauge.x, -63.2, z], [gauge.x + (i % 5 === 0 ? 3.6 : 2), -63.2, z]));
  }
  out.push(L(ticks.join(""), { tone: "mid" }));
  out.push(L(seg([gauge.x, -63.2, DEAD_TOP], [gauge.x + 5, -63.2, DEAD_TOP]), { tone: "hi" }));
  return out.join("");
}
function deadWater() {
  return `<g class="fig-water fig-dead">${S(k.slabOf(WATER, 4, DEAD_TOP - 4, P, 2, 0), { tone: "hi", crease: "none" })}</g>`;
}
function damAndGlass() {
  const out = [];
  out.push(slab({ x: -72, y: -40.5, w: 22, d: 5, r: 0.5 }, WALL_TOP, 2, "mid", 2, 0.3));
  const dam = { x: -56, y: BASIN.y, w: 12, d: BASIN.d, r: 0.6 };
  const lifts = [20, 36].map((z) => k.sideSeam(dam, z, P, 2)).join("");
  out.push(S(k.slabOf(dam, 4, WALL_TOP - 4, P, 2, 0.6), { tone: "mid", inner: L(lifts, { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(dam, 2), WALL_TOP, P, 2), { tone: "faint" }));
  const glass = { x: BASIN.x + 4, y: -10, w: 92, d: 1.6, r: 0.2 };
  out.push(`<g class="fig-glass">${S(k.slabOf(glass, 4, WALL_TOP - 4, P, 2, 0), { tone: "hi", crease: "none" })}</g>`);
  out.push(slab({ x: BASIN.x, y: -11, w: 4, d: 3, r: 0.5 }, 4, WALL_TOP - 4, "mid", 2, 0.3));
  out.push(slab({ x: BASIN.x + 4, y: -10.4, w: 92, d: 2.4, r: 0.4 }, 4, 2.5, "mid", 2, 0.3));
  return out.join("");
}

function powerhouse() {
  const out = [];
  out.push(slab({ x: PH.x, y: PH.y, w: PH.w, d: PH.d, r: 0.8 }, 0, 2, "lo", 3, 0.4));
  out.push(slab({ x: PH.x, y: PH.y, w: PH.w, d: 2.5 }, 2, 22, "mid", 2, 0));
  out.push(slab({ x: PH.x, y: PH.y, w: 2.5, d: PH.d }, 2, 22, "mid", 2, 0));
  out.push(pipe([[PH.x + 2.5, TURBINE[1], 5], [TURBINE[0] - 7.6, TURBINE[1], 5]], 2.4, { flanges: [false, true], key: "hydro" }));
  const [tx, ty] = TURBINE;
  out.push(S(k.cylinder(tx, ty, 8, 2, 6, P, 48, 0.5), { tone: "mid" }));
  out.push(L(k.sideArc(tx, ty, 8, 5, P, 32), { tone: "faint" }));
  out.push(S(k.cylinder(tx, ty, 1.3, 8, 2, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(tx, ty, 6.6, 10, 9, P, 48, 0.6), { tone: "hi", crease: "lo", lit: true }));
  out.push(L(k.knurl(tx, ty, 6.6, 12, 17, 40, P, 0.4), { tone: "faint" }));
  out.push(S(k.cylinder(tx, ty, 3, 19, 2, P, 24), { tone: "mid" }));
  out.push(slab({ x: PH.x + PH.w - 2.5, y: PH.y, w: 2.5, d: PH.d }, 2, 22, "mid", 2, 0));
  out.push(slab({ x: PH.x, y: PH.y + PH.d - 2, w: 2.5, d: 2 }, 2, 22, "mid", 2, 0.3));
  out.push(slab({ x: PH.x + 2.5, y: PH.y + PH.d - 2, w: PH.w - 5, d: 2 }, 2, 1.5, "mid", 2, 0.3));
  out.push(slab({ x: PH.x - 1, y: PH.y - 1, w: PH.w + 2, d: PH.d + 2, r: 0.8 }, 24, 2.5, "mid", 3, 0.6));
  out.push(L(Array.from({ length: 4 }, (_, i) => k.lineOnTop([PH.x - 1 + 6 + i * 6, PH.y - 1], [PH.x - 1 + 6 + i * 6, PH.y + PH.d + 1], 26.5, P)).join(""), { tone: "faint" }));
  const tail = { x: -14, y: PH.y + PH.d, w: 12, d: 26, r: 0.6 };
  out.push(slab(tail, 0, 2.5, "mid", 2, 0.3));
  const tw = { x: -12, y: PH.y + PH.d, w: 8, d: 24, r: 0.4 };
  out.push(`<g class="fig-water">${S(k.slabOf(tw, 2.2, 0.4, P, 2), { tone: "hi", crease: "none" })}</g>`);
  out.push(L(k.planOutline(tw, 2.6, P, 2), { tone: "lo" }));
  out.push(slab({ x: -15, y: tail.y + tail.d, w: 14, d: 2 }, 0, 4, "mid", 2, 0.3));
  out.push(flowLine([[-8, PH.y + PH.d + 1, 2.7], [-8, tail.y + tail.d - 1, 2.7]], "hydro"));
  return out.join("");
}

function thermal() {
  const out = [];
  out.push(pipe([[48, -84, 3], [48, -74, 3], [48, -62, 3]], 1.2, { flanges: [true, false] }));
  out.push(slab({ x: 44, y: -78, w: 8, d: 6, r: 0.6 }, 0, 6, "mid", 2, 0.4));
  out.push(S(k.cylinder(48, -75, 1.8, 6, 2.5, P, 16), { tone: "mid" }));
  out.push(slab({ x: 14, y: -58, w: 16, d: 12, r: 1 }, 0, 2, "lo", 3, 0));
  out.push(S(k.slabOf({ x: 14, y: -58, w: 16, d: 12, r: 1 }, 2, 12, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam({ x: 14, y: -58, w: 16, d: 12, r: 1 }, 8, P, 3), { tone: "faint" }) }));
  const skid = { x: 29, y: -61.5, w: 49, d: 19, r: 1 };
  out.push(slab(skid, 0, 2, "lo", 3, 0));
  const box = { x: 30, y: -60, w: 46, d: 16, r: 1 };
  out.push(S(k.slabOf(box, 2, 14, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(box, 9, P, 3), { tone: "faint" }) }));
  out.push(L([48, 60].map((x) => seg([x, -44, 2], [x, -44, 16])).join(""), { tone: "lo" }));
  out.push(D([at([54, -44, 9]), at([66, -44, 9])], { size: 0.5 }));
  const filter = { x: 30, y: -64, w: 14, d: 24, r: 1 };
  out.push(slab(filter, 16, 18, "mid", 3, 0.6));
  out.push(L([20, 25, 30].map((z) => faceY(32, 42, z - 1.6, z + 1.6, -40)).join(""), { tone: "lo" }));
  out.push(slab({ x: 74, y: -58, w: 12, d: 12, r: 0.8 }, 4, 14, "mid", 2, 0.5));
  out.push(S(k.cylinder(92, -52, 6.5, 0, 74, P, 40, 0.6), { tone: "mid", inner: L([30, 50].map((z) => k.sideArc(92, -52, 6.5, z, P, 32)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(92, -52, 8.2, 60, 1.5, P, 40), { tone: "mid" }));
  out.push(L(k.ring(92, -52, 5.4, 74, P, 40), { tone: "lo" }));
  return out.join("");
}

function bushing(x, y, z0, h, { shed = 2.6, core = 1.4, sheds = 3 } = {}) {
  const out = [];
  const step = h / (sheds + 1);
  for (let i = 0; i <= sheds; i++) {
    const z = z0 + i * step;
    out.push(S(k.cylinder(x, y, core, z, step - (i < sheds ? 0.7 : 0), P, 16), { tone: "mid", crease: "none" }));
    if (i < sheds) out.push(S(k.cylinder(x, y, shed, z + step - 0.7, 0.7, P, 20), { tone: "mid" }));
  }
  return out.join("");
}

function switchyard() {
  const out = [slab(k.insetPlan(TR, -1.5), 0, 2, "lo", 3, 0)];
  out.push(S(k.slabOf(TR, 2, 24, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(TR, 8, P, 4), { tone: "faint" }) }));
  for (let i = 0; i < 4; i++) out.push(slab({ x: TR.x + TR.w, y: TR.y + 3 + i * 4.4, w: 6, d: 1.4, r: 0.3 }, 5, 18, "mid", 2, 0));
  out.push(slab(k.insetPlan(TR, -1), 26, 2, "mid", 4, 0.6));
  for (const x of BUSHINGS) {
    out.push(bushing(x, BUSH_Y, 28, 12));
    out.push(S(k.cylinder(x, BUSH_Y, 0.9, 40, 1.5, P, 12), { tone: "hi" }));
  }
  for (const x of GANTRY_X) {
    out.push(slab({ x: x - 2, y: -52, w: 8, d: 8, r: 0.6 }, 0, 1.5, "lo", 2, 0));
    out.push(slab({ x, y: -50, w: 4, d: 4, r: 0.4 }, 1.5, 66.5, "mid", 2, 0.3));
  }
  out.push(slab({ x: 152, y: -51, w: 30, d: 6, r: 0.6 }, 64, 4, "mid", 2, 0.4));
  for (const x of INSULATORS) out.push(bushing(x, -48, 56, 8, { shed: 2.2, core: 1.1, sheds: 3 }));
  out.push(BUSHINGS.map((x, i) => wire([[x, BUSH_Y, 41.5], [INSULATORS[i], -48, 56]], "grid")).join(""));
  return out.join("");
}

function trench() {
  const plan = { x: 0, y: -9, w: 140, d: 10, r: 1 };
  const out = [slab(plan, 0, 0.5, "lo", 3, 0), L(k.planOutline(k.insetPlan(plan, 1.2), 0.5, P, 3), { tone: "faint" })];
  out.push(wire([[20, -46, 5], [20, -6, 0.5], [120, -6, 0.5], [120, TR.y + TR.d, 5]], "thermal"));
  out.push(wire([[4, PH.y + PH.d - 0.6, 3.5], [4, -2, 0.5], [132, -2, 0.5], [132, TR.y + TR.d, 5]], "hydro"));
  return out.join("");
}

function dial(key) {
  const [x, y] = DIALS[key];
  const out = [];
  const base = { x: x - 7, y: y - 5, w: 14, d: 10, r: 1.4 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(base, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(slab(base, 0, 4, "mid", 4, 0.5));
  out.push(D(k.corners(base, 2.2).map(([px, py]) => at([px, py, 4])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 1.6, 4, DIAL_Z - 4, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, 5, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 2.2, DIAL_TOP, 64, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 2.2, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 1.6, DIAL_TOP, P, 64), { tone: "lo" }));
  const count = key === "ap" ? 20 : 25;
  const ticks = k.radialTicks(x, y, DIAL_R - 2.2, count, key === "ap" ? 5 : 5, DIAL_TOP, [1, 2.2], P, -0.75 * Math.PI, 1.5 * Math.PI);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  if (key === "ap") {
    const a = -0.75 * Math.PI + 0.5 * 1.5 * Math.PI;
    out.push(L(k.lineOnTop([x + Math.sin(a) * (DIAL_R - 6), y - Math.cos(a) * (DIAL_R - 6)], [x + Math.sin(a) * (DIAL_R - 2.2), y - Math.cos(a) * (DIAL_R - 2.2)], DIAL_TOP, P), { tone: "hi" }));
  }
  out.push(L(k.ring(x, y, 1.3, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 5.4], DIAL_TOP, P, "x"), { ap: "APORTES", hyd: "HIDRÁULICA", ter: "TÉRMICA" }[key], { size: 1.6, tone: "lo", anchor: "middle" }));
  out.push(`<path data-part="needle-${key}" class="iso-line" data-tone="hi" data-free="start" d="${needleAt(key, 0)}" style="stroke-width:1.15"/>`);
  return out.join("");
}
function needleAt(key, share) {
  const [x, y] = DIALS[key];
  const angle = -0.75 * Math.PI + Math.min(Math.max(share, 0), 1) * 1.5 * Math.PI;
  return k.lineOnTop([x - Math.sin(angle) * 2.2, y + Math.cos(angle) * 2.2], [x + Math.sin(angle) * (DIAL_R - 3), y - Math.cos(angle) * (DIAL_R - 3)], DIAL_TOP + 0.2, P);
}

function thermometer() {
  const [x, y] = THERMO;
  const out = [];
  const base = { x: x - 8, y: y - 6, w: 16, d: 11, r: 1.4 };
  out.push(slab(base, 0, 5, "mid", 4, 0.5));
  const board = { x: x - 6, y: y - 3.5, w: 12, d: 2, r: 0.4 };
  out.push(slab(board, 5, 57, "hi", 2, 0.3));
  const face = board.y + board.d;
  const ticks = { minor: [], major: [] };
  for (let t = T_MIN; t <= T_MAX + 1e-9; t += 0.5) {
    const z = tempZ(t);
    const major = Math.abs(t - Math.round(t)) < 1e-9;
    (major ? ticks.major : ticks.minor).push(seg([board.x, face, z], [board.x + (major ? 3.6 : 2.2), face, z]));
  }
  out.push(L(ticks.minor.join(""), { tone: "lo" }), L(ticks.major.join(""), { tone: "mid" }));
  out.push(L(seg([board.x, face, tempZ(0)], [board.x + 5, face, tempZ(0)]), { tone: "hi" }));
  out.push(`<path class="iso-line fig-mark" d="${seg([board.x, face, tempZ(0.5)], [board.x + 4.6, face, tempZ(0.5)])}"/>`);
  out.push(`<g data-part="thermo"></g>`);
  out.push(`<g class="fig-glass">${S(k.cylinder(x + 2, y, 2.3, 9, 52, P, 24), { tone: "hi", crease: "none" })}${S(k.cylinder(x + 2, y, 3.4, 5, 5, P, 24), { tone: "hi" })}</g>`);
  return out.join("");
}

function rule() {
  const out = [];
  out.push(slab({ x: -158, y: 42, w: 6, d: 8, r: 1 }, 0, 6, "mid", 3, 0.4));
  out.push(slab({ x: -150, y: 44, w: 300, d: 4, r: 1 }, 0, 3, "mid", 3, 0.4));
  out.push(slab({ x: 150, y: 42, w: 6, d: 8, r: 1 }, 0, 6, "mid", 3, 0.4));
  out.push(D([[-155, 46], [153, 46]].map(([x, yy]) => at([x, yy, 6])), { size: 0.45 }));
  const strip = { x: -152, y: 52, w: 304, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(RULE_FROM, RULE_TO + 0.01, STEP, 12, strip.y + 0.8, 0.6, [2, 4.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  return out.join("");
}
function rider() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: -6, y: 41, w: 12, d: 10, r: 2 }, 3, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(slab({ x: -6, y: 41, w: 12, d: 10, r: 2 }, 3, 4.5, "mid", 4, 0.5));
  out.push(slab({ x: -1, y: 51, w: 2, d: 5, r: 0.5 }, 1.2, 1, "hi", 2, 0, { lit: true }));
  out.push(S(k.cylinder(0, 46, 3, 7.5, 3.5, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(0, 46, 3, 7.5, 11, 24, P), { tone: "lo" }));
  out.push(L(k.ring(0, 46, 1.6, 11, P, 16), { tone: "hi" }));
  return out.join("");
}

const PENSTOCK = [[-44, TURBINE[1], 22], [-34, TURBINE[1], 22], [-34, TURBINE[1], 5], [PH.x, TURBINE[1], 5]];
const last = MONTHS.length - 1;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Una maqueta en corte sobre una placa. A la izquierda, un termómetro marca la anomalía de la temperatura del mar en la región Niño 3.4. Un canal elevado trae los aportes de los ríos a un embalse con frente de vidrio; el agua sube o baja con el volumen útil de los embalses de Colombia. Una tubería forzada lleva el agua desde la presa hasta una casa de máquinas con turbina y generador. A la derecha, una turbina térmica con su chimenea y un transformador conectado a un pórtico de la red. Tres carátulas marcan los aportes y la generación hidráulica y térmica, y una regla de meses al frente va de enero de 2023 a octubre de 2026.",
  body: [
    plate(),
    flumeSupports(),
    basinBack(),
    basinSide(),
    `<g data-part="tower-low"></g>`,
    deadWater(),
    `<g class="fig-water" data-part="water"></g>`,
    flume(),
    `<path class="iso-line fig-flow fig-spill" data-flow data-route="river" data-part="spill" d=""/>`,
    `<g data-part="tower-high"></g>`,
    damAndGlass(),
    pipe(PENSTOCK, 2.4, { key: "hydro" }),
    powerhouse(),
    thermal(),
    switchyard(),
    trench(),
    thermometer(),
    dial("ap"), dial("hyd"), dial("ter"),
    rule(),
    `<g data-part="rider" transform="${k.translateAlong(P, [RULE_FROM + last * STEP, 0, 0])}">${rider()}</g>`,
  ].join(""),
});

const caption = `Datos mensuales de enero de 2023 a octubre de 2026: volumen útil de los embalses del SIN, aportes hídricos frente a la media histórica y generación diaria promedio por tecnología (XM), y anomalía de la temperatura del mar en la región Niño 3.4 (NOAA OISST v2.1, media mensual; la marca de +0,5 °C es el umbral de El Niño que NOAA aplica a su índice trimestral ONI). Un embalse y una central representan todo el parque hidráulico del SIN, y una turbina representa toda la generación térmica, que en el listado de recursos de XM incluye ${THERMAL_GAS} plantas a gas y ${THERMAL_COAL} a carbón, entre ${THERMAL_TOTAL}. El nivel del agua es proporcional al volumen útil; la franja de volumen muerto no está a escala. La figura muestra los datos; no calcula cuánto del nivel de los embalses se debe a la generación térmica.`;

const plate_ = k.plateHtml({
  fig: "Fig 1",
  title: "Agua y térmica",
  hint: "Mueve el cursor o toca para cambiar el mes",
  readout: "",
  keys: [
    { mark: "raised", label: "Agua: volumen útil de los embalses, de 0 a 100 %" },
    { mark: "dim", label: "Franja oscura: volumen muerto, bajo el nivel mínimo técnico" },
    { mark: "dashed", label: "Agua y energía en movimiento: más rápido, más caudal o más generación" },
    { mark: "edge", label: "Carátulas: aportes (0–200 % de la media) y generación hidráulica y térmica (0–250 GWh por día)" },
  ],
  caption,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Mes: las flechas cambian el mes" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${last}">${svg}</div>`,
});
const markup = `<div class="iso fig-central" data-theme="light">${plate_}<p class="fig-data" data-fig-data></p></div>`;

const extraCss = `
.fig-central{--anatomy-card:#fbf9f3;--anatomy-paper:#fbf9f3;--anatomy-page:#f2eee4;--anatomy-text:#3b3d48;--anatomy-strong:#13141a;--anatomy-muted:#696a73;--anatomy-mono:"Azeret Mono",ui-monospace,monospace;--fig-flow:#1a23c4;--fig-warm:#ff5b3a;--fig-cold:#2b3bff}
.fig-central .iso-figure{margin:0}
.fig-central .iso-plate{box-shadow:0 0 0 1.5px #13141a;padding:52px 20px 48px}
.fig-central .iso-legend{padding:12px 2px 0;color:#3b3d48;font-size:.92rem;line-height:1.5}
.fig-central .iso-caption{display:block;margin-top:8px;max-width:82ch}
.fig-central .fig-water{--anatomy-paper:#9fb4ff;--anatomy-face:#b4c4ff;--anatomy-top:#c9d4ff;--anatomy-shade-0:#7f95f0;--anatomy-shade-1:#8ca1f5;--anatomy-shade-2:#97abfa;--anatomy-shade-3:#a3b5fc;--anatomy-hi:#2b3bff;opacity:.82}
.fig-central .fig-dead{--anatomy-paper:#5d6fd0;--anatomy-top:#6f80dc;--anatomy-shade-0:#4a5bbd;--anatomy-shade-1:#5263c5;--anatomy-shade-2:#5a6bcc;--anatomy-shade-3:#6273d2;opacity:.9}
.fig-central .fig-glass{opacity:.28}
.fig-central .fig-flow{stroke:var(--fig-flow);stroke-width:1.5;fill:none}
.fig-central .fig-spill{stroke-width:2}
.fig-central .fig-mark{stroke:var(--fig-warm);stroke-width:1.4}
.fig-central .fig-liquid{--anatomy-paper:var(--fig-cold);--anatomy-top:var(--fig-cold);--anatomy-shade-0:var(--fig-cold);--anatomy-shade-1:var(--fig-cold);--anatomy-shade-2:var(--fig-cold);--anatomy-shade-3:var(--fig-cold)}
.fig-central .fig-liquid[data-warm]{--anatomy-paper:var(--fig-warm);--anatomy-top:var(--fig-warm);--anatomy-shade-0:var(--fig-warm);--anatomy-shade-1:var(--fig-warm);--anatomy-shade-2:var(--fig-warm);--anatomy-shade-3:var(--fig-warm)}
.fig-central .iso-stage{outline-offset:4px;cursor:ew-resize}
.fig-central .fig-data{margin:10px 0 0;font:600 .76rem/1.5 var(--anatomy-mono);color:#3b3d48;display:flex;flex-wrap:wrap;gap:4px 18px}
.fig-central .fig-data b{color:#13141a}
@media (max-width:560px){.fig-central .iso-plate{padding:46px 6px 62px}.fig-central .iso-svg{width:118%;margin-left:-9%}}
`;

const live = `
function runCentral(root) {
const P = ${JSON.stringify(P)};
const MONTHS = ${JSON.stringify(MONTHS)};
const WATER = ${JSON.stringify(WATER)}, TOWER = ${JSON.stringify(TOWER)}, THERMO = ${JSON.stringify(THERMO)};
const DEAD_TOP = ${DEAD_TOP}, FULL = ${FULL}, T_MIN = ${T_MIN}, T_MAX = ${T_MAX}, LIP_X = ${LIP_X};
const DIALS = ${JSON.stringify(DIALS)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP}, DIAL_MAX = ${JSON.stringify(DIAL_MAX)};
const RULE_FROM = ${RULE_FROM}, STEP = ${STEP};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const water = part("water"), low = part("tower-low"), high = part("tower-high"), spill = part("spill"), thermo = part("thermo"), rider = part("rider");
const needles = { ap: part("needle-ap"), hyd: part("needle-hyd"), ter: part("needle-ter") };
const flows = [...svg.querySelectorAll(".fig-flow")];
const readout = root.querySelector("[data-readout]");
const data = root.querySelector("[data-fig-data]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dec = (n, d = 1) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + dec(Math.abs(n), 2);
const monthName = (m) => new Date(m + "-01T00:00:00Z").toLocaleDateString("es-CO", { month: "short", year: "numeric", timeZone: "UTC" }).replace(".", "").replace(" de ", " ");
const levelOf = (vol) => DEAD_TOP + (vol / 100) * (FULL - DEAD_TOP);
const tempZ = (t) => 12 + ((t - T_MIN) / (T_MAX - T_MIN)) * 46;
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const pathOf = (points) => "M" + points.map((p) => iso(p, P).map((n) => Math.round(n * 10) / 10).join(" ")).join("L");
const lerp = (a, b, t) => a + (b - a) * t;
function at(i) {
  const a = MONTHS[Math.floor(i)], b = MONTHS[Math.min(Math.ceil(i), MONTHS.length - 1)], t = i - Math.floor(i);
  const out = {};
  for (const key of ["nino", "ap", "vol", "hyd", "ter"]) out[key] = lerp(a[key], b[key], t);
  return out;
}
let index = MONTHS.length - 1, target = index, frame = 0, last = 0, touring = !still.matches, visible = false, idleTimer = 0, lastVol = -1, lastT = null, lastSpeeds = "";
function draw() {
  const v = at(index);
  const row = MONTHS[Math.round(index)];
  rider.setAttribute("transform", translateAlong(P, [RULE_FROM + index * STEP, 0, 0]));
  const zl = levelOf(clamp(v.vol, 0, 100));
  if (Math.abs(zl - lastVol) > 0.02) {
    lastVol = zl;
    water.innerHTML = solidSvg(slabOf(WATER, DEAD_TOP, zl - DEAD_TOP, P, 2, 0), { tone: "hi", crease: "none" });
    low.innerHTML = solidSvg(cylinder(TOWER[0], TOWER[1], 4, 4, zl - 4, P, 32), { tone: "mid", crease: "none" });
    high.innerHTML = solidSvg(cylinder(TOWER[0], TOWER[1], 4, zl, 60 - zl, P, 32, 0.4), { tone: "mid" }) + lineSvg(knurl(TOWER[0], TOWER[1], 4, zl, Math.min(zl + 6, 60), 28, P, 0.4), { tone: "faint" });
    spill.setAttribute("d", pathOf([[LIP_X - 0.6, -42, 59.2], [LIP_X + 1.6, -42, zl + 0.2]]));
  }
  const tz = tempZ(clamp(v.nino, T_MIN, T_MAX));
  if (lastT === null || Math.abs(tz - lastT) > 0.02) {
    lastT = tz;
    thermo.innerHTML = '<g class="fig-liquid"' + (v.nino > 0 ? " data-warm" : "") + ">" + solidSvg(cylinder(THERMO[0] + 2, THERMO[1], 2.4, 6, 3.6, P, 20), { tone: "hi", crease: "none" }) + solidSvg(cylinder(THERMO[0] + 2, THERMO[1], 1.3, 9, tz - 9, P, 16), { tone: "hi", crease: "none" }) + "</g>";
  }
  for (const key of ["ap", "hyd", "ter"]) needles[key].setAttribute("d", needleAt(key, v[key] / DIAL_MAX[key]));
  const speed = { river: v.ap / 100, hydro: v.hyd / 150, thermal: v.ter / 150, grid: (v.hyd + v.ter) / 300 };
  const key = Object.values(speed).map((s) => s.toFixed(2)).join("|");
  if (key !== lastSpeeds) {
    lastSpeeds = key;
    flows.forEach((line) => { const s = speed[line.dataset.route]; line.style.animationDuration = (1.6 / Math.max(s, 0.15)).toFixed(2) + "s"; line.style.opacity = s < 0.05 ? 0 : 1; });
  }
  const text = monthName(row.m) + " · embalses " + dec(row.vol) + " % · térmica " + dec(row.terPct) + " %";
  if (readout.textContent !== text) readout.textContent = text;
  const info = "<span>" + monthName(row.m) + "</span><span>Niño 3.4 <b>" + sign(row.nino) + " °C</b></span><span>Aportes <b>" + row.ap + " % de la media</b></span><span>Hidráulica <b>" + row.hyd + " GWh/día (" + dec(row.hydPct) + " %)</b></span><span>Térmica <b>" + row.ter + " GWh/día (" + dec(row.terPct) + " %)</b></span><span>XM · NOAA</span>";
  if (data.innerHTML !== info) data.innerHTML = info;
  stage.setAttribute("aria-valuenow", String(Math.round(index)));
  stage.setAttribute("aria-valuetext", text + ". Niño 3.4 " + sign(row.nino) + " °C, aportes " + row.ap + " % de la media, hidráulica " + row.hyd + " y térmica " + row.ter + " GWh por día");
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { target += dt / 0.55; if (target > MONTHS.length - 1) { target = 0; index = 0; } }
  index = still.matches ? target : index + (target - index) * (1 - Math.exp(-dt / (touring ? 0.08 : 0.22)));
  if (Math.abs(target - index) < 0.002) index = target;
  draw();
  frame = visible && (touring || index !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false; target = clamp(Math.round(next), 0, MONTHS.length - 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; run(); }, 5000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
const ends = [iso([RULE_FROM, 56, 0], P)[0], iso([RULE_FROM + (MONTHS.length - 1) * STEP, 56, 0], P)[0]];
const pick = (event) => {
  const box = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const x = view.x + ((event.clientX - box.left) / box.width) * view.width;
  steer(((x - ends[0]) / (ends[1] - ends[0])) * (MONTHS.length - 1));
};
stage.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse") pick(event); });
stage.addEventListener("pointerdown", pick);
stage.addEventListener("keydown", (event) => {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
  if (step) { event.preventDefault(); steer(Math.round(target) + step); }
  if (event.key === "Home") { event.preventDefault(); steer(0); }
  if (event.key === "End") { event.preventDefault(); steer(MONTHS.length - 1); }
});
if (still.matches) touring = false;
draw();
}
`;

const moduleCode = `// Generado por scripts/figuras/central.mjs. No editar a mano.
// Kit isométrico de Anatomy (MIT): github.com/wheresryan22/anatomy
${kitSource}
const MARKUP = ${JSON.stringify(markup)};
const EXTRA_CSS = ${JSON.stringify(extraCss)};
${live}
export function setupFigure(root) {
  if (!document.getElementById("iso-kit-css")) {
    const style = document.createElement("style");
    style.id = "iso-kit-css";
    style.textContent = ISO_CSS;
    document.head.append(style);
  }
  if (!document.getElementById("fig-central-css")) {
    const style = document.createElement("style");
    style.id = "fig-central-css";
    style.textContent = EXTRA_CSS;
    document.head.append(style);
  }
  root.innerHTML = MARKUP;
  runCentral(root.querySelector(".fig-central"));
}
`;
mkdirSync(join(SITE, "assets", "figuras"), { recursive: true });
writeFileSync(join(SITE, "assets", "figuras", "central.js"), moduleCode);
console.log("escrito assets/figuras/central.js", (moduleCode.length / 1024).toFixed(0), "KB ·", MONTHS.length, "meses ·", MONTHS[0].m, "a", MONTHS.at(-1).m, "· térmicas", THERMAL_GAS, "gas /", THERMAL_COAL, "carbón /", THERMAL_TOTAL);

const previewAt = process.argv.indexOf("--preview");
if (previewAt > -1) {
  const page = k.pageHtml({ title: "Agua y térmica", theme: "light", body: markup.replace('class="iso fig-central" data-theme="light"', 'class="fig-central"'), script: kitSource + live + "\nrunCentral(document.querySelector('.fig-central'));", width: 800 });
  writeFileSync(process.argv[previewAt + 1], page.replace("</style>", extraCss + "</style>"));
  console.log("vista previa", process.argv[previewAt + 1]);
}
