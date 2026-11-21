// Figura isométrica del capítulo 2: un sistema de baterías del tamaño de La Arenosa
// (45 MW / 45 MWh) conectado a la red, que guarda energía del mediodía para el anochecer.
//
//   node scripts/figuras/bateria.mjs [--preview <ruta.html>]
//
// Escribe assets/figuras/bateria.js, un módulo que inserta la figura y la anima.
// Con --preview escribe además una página suelta para revisarla con las
// herramientas de verificación de Anatomy (capture.mjs, lines.mjs).
// El kit (kit/iso-kit.mjs) es de Anatomy, licencia MIT: github.com/wheresryan22/anatomy
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "..");
const kitSource = readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");

// ---------- Verdad: XM, perfil horario de octubre de 2026, y el proyecto ----------
const csv = readFileSync(join(SITE, "archivos", "video-2", "perfil_dia_tipo.csv"), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
const head = csv.shift().split(",");
const rows = csv.map((line) => Object.fromEntries(line.split(",").map((v, i) => [head[i], v]))).filter((r) => r.periodo === "2026-10");
rows.sort((a, b) => Number(a.hora) - Number(b.hora));
const SOLAR = rows.map((r) => Math.round(Number(r.solar_MWh)));
const DEMAND = rows.map((r) => Math.round(Number(r.demanda_MWh)));
if (SOLAR.length !== 24) throw new Error("perfil horario incompleto");
const POWER = 45;
const ENERGY = 45;
// Carga repartida en las tres horas de más sol y entrega a potencia plena en la hora de más demanda.
const sunHours = SOLAR.map((v, h) => [v, h]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, h]) => h).sort((a, b) => a - b);
const peakHour = DEMAND.indexOf(Math.max(...DEMAND));
const CHARGE_FROM = sunHours[0];
const CHARGE_TO = sunHours[2] + 1;
const CHARGE_MW = ENERGY / (CHARGE_TO - CHARGE_FROM);
if (CHARGE_TO - CHARGE_FROM !== 3) throw new Error("las horas de más sol no son consecutivas");

// ---------- Mundo (unidades ≈ 1 px; x a lo largo, y hacia el lector, z arriba) ----------
const WIDTH = 640;
const HEIGHT = 390;
const PLATE = { x: -166, y: -72, w: 338, d: 140, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const FLOOR = 6;
const WALL_TOP = 44;
const RACKS = 5;
const MODULES = 8;
const RACK_W = 16.5;
const RACK_STEP = 18.3;
const RACK_X0 = -146.85;
const RACK_Y = -47.5;
const RACK_D = 14;
const RACK_FRONT = RACK_Y + RACK_D;
const MOD_Z0 = 8.5;
const MOD_H = 4;

const PCS = { x: -38, y: -44, w: 22, d: 26, r: 1 };
const TR = { x: -6, y: -44, w: 26, d: 24, r: 1.5 };
const BUSHINGS = [-1, 7, 15];
const BUSH_Y = -30;
const GANTRY_X = [46, 72];
const INSULATORS = [54, 61, 68];
const POLE = [152, -50];
const POLE_INS = [144, 152, 160];
const DIAL = [-8, 32];
const DIAL_R = 12;
const DIAL_Z = 20;
const DIAL_TOP = DIAL_Z + 6;
const RULE_FROM = -144;
const RULE_TO = 144;
const HOUR_W = (RULE_TO - RULE_FROM) / 24;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [GANTRY_X[0], -34, 74], [GANTRY_X[1] + 4, -30, 74], [POLE[0] + 12, POLE[1], 70], [-153, -51.5, 47]],
  WIDTH, HEIGHT, { pad: 30, azimuth: 55 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const f1 = (n) => Math.round(n * 10) / 10;
const pathOf = (points, closed) => "M" + points.map((p) => at(p).map(f1).join(" ")).join("L") + (closed ? "Z" : "");
const seg = (a, b) => pathOf([a, b]);
const faceY = (x0, x1, z0, z1, y) => pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true);
const faceX = (y0, y1, z0, z1, x) => pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], true);
const slab = (plan, z, h, tone = "mid", steps = 3, bevel = 0.4, extra = {}) => S(k.slabOf(plan, z, h, P, steps, bevel), { tone, ...extra });
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

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
  const label = { x: -150, y: 22, w: 34, d: 14, r: 1 };
  out.push(slab(label, 0, 0.8, "lo", 4, 0));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[-146, 26.5, 22], [-146, 29.5, 16], [-146, 32.5, 19]].forEach(([x, y, w]) => out.push(L(k.lineOnTop([x, y], [x + w, y], 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([-147.6, 24, 0.8]), at([-118.4, 24, 0.8])], { size: 0.4 }));
  return out.join("");
}

function container() {
  const out = [];
  for (const [x, y] of byDepth([[-152, -50], [-60, -50], [-152, -16], [-60, -16]])) out.push(slab({ x, y, w: 8, d: 6, r: 0.6 }, 0, 3, "lo"));
  out.push(slab({ x: -152, y: -50, w: 100, d: 40, r: 1 }, 3, 3, "mid", 3, 0.6));
  out.push(slab({ x: -152, y: -50, w: 100, d: 2.5, r: 0.4 }, FLOOR, WALL_TOP - FLOOR, "mid", 2, 0));
  for (let x = -146; x < -54; x += 6) out.push(L(seg([x, -47.5, FLOOR], [x, -47.5, WALL_TOP]), { tone: "faint" }));
  out.push(slab({ x: -152, y: -50, w: 2.5, d: 40, r: 0.4 }, FLOOR, WALL_TOP - FLOOR, "mid", 2, 0));
  out.push(L(seg([-149.5, -47.5, FLOOR], [-149.5, -12, FLOOR]), { tone: "faint" }));
  for (let r = 0; r < RACKS; r++) {
    const x0 = RACK_X0 + r * RACK_STEP;
    const plan = { x: x0, y: RACK_Y, w: RACK_W, d: RACK_D, r: 0.6 };
    const seams = Array.from({ length: MODULES }, (_, j) => k.sideSeam(plan, MOD_Z0 + j * MOD_H, P, 3)).join("");
    out.push(S(k.slabOf(plan, FLOOR + 0.5, 34, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(seams, { tone: "lo" }) }));
    const cells = [];
    for (let j = 0; j < MODULES; j++) {
      const z = MOD_Z0 + j * MOD_H;
      cells.push(`<path class="fig-cell" data-cell="${r * MODULES + j}" d="${faceY(x0 + 1.2, x0 + RACK_W - 2.6, z + 0.6, z + MOD_H - 0.6, RACK_FRONT)}"/>`);
    }
    out.push(cells.join(""));
    out.push(D(Array.from({ length: MODULES }, (_, j) => at([x0 + RACK_W - 1.3, RACK_FRONT, MOD_Z0 + j * MOD_H + MOD_H / 2])), { size: 0.45, tone: "mid" }));
    out.push(L(seg([x0 + RACK_W - 2.6, RACK_FRONT, MOD_Z0], [x0 + RACK_W - 2.6, RACK_FRONT, MOD_Z0 + MODULES * MOD_H]), { tone: "faint" }));
  }
  out.push(slab({ x: -147.5, y: RACK_FRONT - 1.5, w: 91, d: 1.5, r: 0.3 }, FLOOR + 34.5, 1.6, "mid", 2, 0));
  out.push(D(Array.from({ length: RACKS }, (_, r) => at([RACK_X0 + r * RACK_STEP + RACK_W / 2, RACK_FRONT - 0.75, FLOOR + 36.1])), { size: 0.45 }));
  out.push(slab({ x: -54.5, y: -50, w: 2.5, d: 40, r: 0.4 }, FLOOR, WALL_TOP - FLOOR, "mid", 2, 0));
  out.push(slab({ x: -152, y: -13, w: 3, d: 3, r: 0.5 }, FLOOR, WALL_TOP - FLOOR, "mid", 2, 0.3));
  out.push(slab({ x: -149, y: -12.5, w: 94.5, d: 2.5, r: 0.4 }, FLOOR, 2, "mid", 2, 0.3));
  out.push(slab({ x: -55, y: -13, w: 3, d: 3, r: 0.5 }, FLOOR, WALL_TOP - FLOOR, "mid", 2, 0.3));
  const roof = { x: -153.5, y: -51.5, w: 103, d: 43, r: 1 };
  out.push(slab(roof, WALL_TOP, 2.5, "mid", 3, 0.8));
  out.push(L(Array.from({ length: 13 }, (_, i) => k.lineOnTop([-146 + i * 7.5, -51.5], [-146 + i * 7.5, -8.5], WALL_TOP + 2.5, P)).join(""), { tone: "faint" }));
  const hvac = { x: -52, y: -42, w: 7, d: 24, r: 1 };
  out.push(slab(hvac, 16, 20, "mid", 3, 0.6));
  out.push(L(k.sideRing([-45, -30, 26], 7, "x", P, 32) + k.sideRing([-45, -30, 26], 5.2, "x", P, 28), { tone: "lo" }));
  out.push(L(k.sideRing([-45, -30, 26], 1.6, "x", P, 16), { tone: "mid" }));
  out.push(D([at([-45, -40, 18]), at([-45, -20, 18]), at([-45, -40, 34]), at([-45, -20, 34])], { size: 0.4 }));
  return out.join("");
}

function pcs() {
  const out = [slab(k.insetPlan(PCS, -1.5), 0, 2, "lo", 3, 0)];
  const front = PCS.y + PCS.d;
  out.push(S(k.slabOf(PCS, 2, 32, P, 3, 1), { tone: "mid", inner: L(k.sideSeam(PCS, 30, P, 3), { tone: "faint" }) }));
  out.push(L(seg([-27, front, 2], [-27, front, 34]), { tone: "lo" }));
  out.push(L(faceY(-35, -29.5, 22, 29, front) + faceY(-35, -29.5, 6, 10, front) + faceY(-24.5, -19, 6, 10, front), { tone: "lo" }));
  out.push(L(faceY(-24.5, -19, 14, 27, front), { tone: "faint" }));
  out.push(slab({ x: -28.6, y: front, w: 1.2, d: 1.4, r: 0.4 }, 15, 6, "mid", 2, 0));
  out.push(slab({ x: -26.6, y: front, w: 1.2, d: 1.4, r: 0.4 }, 15, 6, "mid", 2, 0));
  out.push(slab({ x: -34, y: -40, w: 14, d: 12, r: 1 }, 34, 3, "mid", 3, 0.5));
  out.push(L(k.planOutline({ x: -32, y: -38, w: 10, d: 8, r: 0.8 }, 37, P, 3), { tone: "faint" }));
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

function transformer() {
  const out = [slab(k.insetPlan(TR, -1.5), 0, 2, "lo", 3, 0)];
  out.push(S(k.slabOf(TR, 2, 24, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(TR, 8, P, 4), { tone: "faint" }) }));
  for (let i = 0; i < 5; i++) out.push(slab({ x: TR.x + TR.w, y: TR.y + 3 + i * 4.4, w: 6, d: 1.4, r: 0.3 }, 5, 18, "mid", 2, 0));
  out.push(slab(k.insetPlan(TR, -1), 26, 2, "mid", 4, 0.6));
  out.push(D(k.corners(k.insetPlan(TR, -1), 2.2).map(([x, y]) => at([x, y, 28])), { size: 0.45 }));
  for (const x of [0, 14]) out.push(S(k.cylinder(x, -41.2, 0.8, 28, 3, P, 12), { tone: "mid", crease: "none" }));
  out.push(slab({ x: -4, y: -44, w: 22, d: 5.6, r: 2.6 }, 31, 5, "mid", 8, 0.4));
  for (const x of BUSHINGS) {
    out.push(bushing(x, BUSH_Y, 28, 12));
    out.push(S(k.cylinder(x, BUSH_Y, 0.9, 40, 1.5, P, 12), { tone: "hi" }));
  }
  out.push(slab({ x: 2, y: TR.y + TR.d, w: 8, d: 0.6, r: 0.2 }, 16, 5, "lo", 2, 0));
  return out.join("");
}

function trench() {
  const plan = { x: -66, y: -3, w: 84, d: 11, r: 1 };
  return slab(plan, 0, 0.5, "lo", 3, 0) + L(k.planOutline(k.insetPlan(plan, 1.2), 0.5, P, 3), { tone: "faint" });
}

// Recorridos de cable (puntos del mundo) y su sentido "hacia la red".
const ROUTES = {
  dc: [[-62, -11.25, 8], [-62, 1, 0.5], [-30, 1, 0.5], [-30, PCS.y + PCS.d, 5]],
  ac: [[-22, PCS.y + PCS.d, 5], [-22, 5, 0.5], [10, 5, 0.5], [10, TR.y + TR.d, 5]],
  hv: BUSHINGS.map((x, i) => [[x, BUSH_Y, 41.5], [INSULATORS[i], -32, 60]]),
  line: INSULATORS.map((x, i) => [[x, -32, 60], [POLE_INS[i], POLE[1], 67]]),
  solar: [[[84, 22, 11.5], [84, -4, 11.5]], [[84, -4, 11.5], [81, -27, 9]], [[77, -28, 9], [77, -28, 68]]],
};
const wire = (points) => k.wireSvg(at(points[0]), at(points.at(-1)), { via: points.slice(1, -1).map(at), tone: "lo", size: 1 });
const flowLine = (points, key, dir) => `<path class="iso-line fig-flow" data-flow data-route="${key}" data-dir="${dir}" d="${pathOf(dir === "out" ? points : [...points].reverse())}"/>`;
const flows = (key, list, dirs = ["out", "in"]) => list.map((points) => dirs.map((dir) => flowLine(points, key, dir)).join("")).join("");

function gantry() {
  const out = [];
  for (const x of GANTRY_X) {
    out.push(slab({ x: x - 2, y: -36, w: 8, d: 8, r: 0.6 }, 0, 1.5, "lo", 2, 0));
    out.push(S(k.slabOf({ x, y: -34, w: 4, d: 4, r: 0.4 }, 1.5, 72.5, P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam({ x, y: -34, w: 4, d: 4, r: 0.4 }, 40, P, 2), { tone: "faint" }) }));
  }
  out.push(slab({ x: 44, y: -35, w: 34, d: 6, r: 0.6 }, 68, 4, "mid", 2, 0.4));
  out.push(D([48, 74].map((x) => at([x, -32, 72])), { size: 0.45 }));
  for (const x of INSULATORS) out.push(bushing(x, -32, 60, 8, { shed: 2.2, core: 1.1, sheds: 3 }));
  out.push(slab({ x: 76, y: -32, w: 6, d: 6, r: 0.6 }, 0, 9, "mid", 3, 0.5));
  out.push(L(faceY(77.5, 80.5, 3, 7, -26), { tone: "lo" }));
  out.push(wire(ROUTES.solar[2]));
  out.push(flows("solar", [ROUTES.solar[2]], ["out"]));
  return out.join("");
}

function dial() {
  const out = [];
  const [x, y] = DIAL;
  const base = { x: x - 8, y: y - 6, w: 16, d: 12, r: 1.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(base, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(slab(base, 0, 5, "mid", 4, 0.6));
  out.push(D(k.corners(base, 2.4).map(([px, py]) => at([px, py, 5])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 1.8, 5, DIAL_Z - 5, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, 6, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 2.6, DIAL_TOP, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 2.6, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 1.8, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.4, 18, 2, DIAL_TOP, [1.1, 2.4], P, -0.75 * Math.PI, 1.5 * Math.PI);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 6], DIAL_TOP, P, "x"), "MWh", { size: 2.2, tone: "lo", anchor: "middle" }));
  out.push(L(k.ring(x, y, 1.4, DIAL_TOP, P, 16), { tone: "mid" }));
  return out.join("");
}

const needleAt = (share) => {
  const angle = -0.75 * Math.PI + share * 1.5 * Math.PI;
  return k.lineOnTop([DIAL[0] - Math.sin(angle) * 2.6, DIAL[1] + Math.cos(angle) * 2.6], [DIAL[0] + Math.sin(angle) * (DIAL_R - 3.2), DIAL[1] - Math.cos(angle) * (DIAL_R - 3.2)], DIAL_TOP + 0.2, P);
};

function solarRow(y) {
  const out = [];
  for (const x of [96, 122, 148]) {
    out.push(S(k.cylinder(x, y + 10, 2.2, 0, 1, P, 16), { tone: "lo" }));
    out.push(S(k.cylinder(x, y + 10, 1.2, 1, 10, P, 14), { tone: "mid", crease: "none" }));
  }
  out.push(slab({ x: 84, y: y + 9.2, w: 70, d: 1.6, r: 0.6 }, 11, 1.6, "mid", 3, 0));
  for (let i = 0; i < 4; i++) {
    const panel = { x: 90 + i * 16, y, w: 15.2, d: 20, r: 0.3 };
    out.push(slab(panel, 12.6, 1, "mid", 2, 0.3));
    const inner = k.insetPlan(panel, 0.8);
    const grid = [k.planOutline(inner, 13.6, P, 2)];
    for (const gy of [inner.y + inner.d / 3, inner.y + (2 * inner.d) / 3]) grid.push(k.lineOnTop([inner.x, gy], [inner.x + inner.w, gy], 13.6, P));
    grid.push(k.lineOnTop([inner.x + inner.w / 2, inner.y], [inner.x + inner.w / 2, inner.y + inner.d], 13.6, P));
    out.push(L(grid.join(""), { tone: "faint" }));
  }
  return out.join("");
}

function pole() {
  const out = [];
  const [x, y] = POLE;
  out.push(S(k.cylinder(x, y, 4, 0, 2, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2.2, 2, 64, P, 20), { tone: "mid", crease: "none" }));
  out.push(L([20, 40].map((z) => k.sideArc(x, y, 2.2, z, P, 12)).join(""), { tone: "faint" }));
  out.push(slab({ x: x - 12, y: y - 1.5, w: 24, d: 3, r: 0.5 }, 60, 3, "mid", 2, 0.3));
  for (const ix of POLE_INS) out.push(bushing(ix, y, 63, 4, { shed: 1.8, core: 0.9, sheds: 2 }));
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
  const ticks = k.topTicks(RULE_FROM, RULE_TO, HOUR_W, 6, strip.y + 0.8, 0.6, [2.2, 4.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  return out.join("");
}

function rider() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -6, y: 41, w: 12, d: 10, r: 2 }, 3, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(slab({ x: -6, y: 41, w: 12, d: 10, r: 2 }, 3, 4.5, "mid", 4, 0.5));
  out.push(slab({ x: -1, y: 51, w: 2, d: 5, r: 0.5 }, 1.2, 1, "hi", 2, 0, { lit: true }));
  out.push(S(k.cylinder(0, 46, 3, 7.5, 3.5, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(0, 46, 3, 7.5, 11, 24, P), { tone: "lo" }));
  out.push(L(k.ring(0, 46, 1.6, 11, P, 16), { tone: "hi" }));
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: `Un sistema de baterías sobre una placa: un contenedor abierto con cinco bastidores de ocho módulos cada uno, un inversor, un transformador, un pórtico de subestación y un poste que lleva la energía a la red. Detrás del pórtico, paneles solares representan la generación solar conectada a la red. Una regla de 24 horas al frente marca la hora; los módulos se llenan de color según la energía guardada, de 0 a ${ENERGY} MWh, y el reloj de carátula la muestra.`,
  body: [
    plate(),
    container(),
    pcs(),
    transformer(),
    trench(),
    wire(ROUTES.dc), flows("dc", [ROUTES.dc]),
    wire(ROUTES.ac), flows("ac", [ROUTES.ac]),
    gantry(),
    ROUTES.hv.map(wire).join(""), flows("hv", ROUTES.hv),
    pole(),
    ROUTES.line.map(wire).join(""), flows("line", ROUTES.line, ["out"]),
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.2"/>`,
    solarRow(-14), solarRow(12),
    wire(ROUTES.solar[0]), wire(ROUTES.solar[1]), flows("solar", ROUTES.solar.slice(0, 2), ["out"]),
    rule(),
    `<g data-part="rider" transform="${k.translateAlong(P, [RULE_FROM + 18 * HOUR_W, 0, 0])}">${rider()}</g>`,
  ].join(""),
});

const caption = `La figura representa un sistema de almacenamiento del tamaño de La Arenosa (Atlántico): ${POWER} MW y ${ENERGY} MWh, ion-litio, en desarrollo con entrada estimada en 2027 (UPME, boletín enero–marzo de 2026). Un contenedor representa todo el sistema. La operación es ilustrativa y sin pérdidas: carga ${CHARGE_MW} MW en las tres horas de más sol de octubre de 2026 (${CHARGE_FROM}:00 a ${CHARGE_TO}:00) y entrega ${POWER} MW en la hora de más demanda (${peakHour}:00), según el perfil horario de XM. Los paneles representan la generación solar de la red; la batería no está junto a una granja solar.`;

const plate_ = k.plateHtml({
  fig: "Fig 2",
  title: "Batería de red",
  hint: "Mueve el cursor o toca para cambiar la hora",
  readout: "",
  keys: [
    { mark: "raised", label: "Módulos de batería: el color es la energía guardada" },
    { mark: "dashed", label: "Sentido de la energía en los cables" },
    { mark: "lit", label: "Aguja: energía almacenada, de 0 a 45 MWh" },
  ],
  caption,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Hora del día: las flechas cambian la hora" aria-valuemin="0" aria-valuemax="24" aria-valuenow="18">${svg}</div>`,
});
const markup = `<div class="iso fig-bateria" data-theme="light">${plate_}<p class="fig-data" data-fig-data></p></div>`;

const extraCss = `
.fig-bateria{--anatomy-card:#fbf9f3;--anatomy-paper:#fbf9f3;--anatomy-page:#f2eee4;--anatomy-text:#3b3d48;--anatomy-strong:#13141a;--anatomy-muted:#696a73;--anatomy-mono:"Azeret Mono",ui-monospace,monospace;--fig-charge:#ffc21c;--fig-flow:#d27b00}
.fig-bateria .iso-figure{margin:0}
.fig-bateria .iso-plate{box-shadow:0 0 0 1.5px #13141a;padding:52px 20px 48px}
.fig-bateria .iso-legend{padding:12px 2px 0;color:#3b3d48;font-size:.92rem;line-height:1.5}
.fig-bateria .iso-caption{display:block;margin-top:8px;max-width:78ch}
.fig-bateria .fig-cell{fill:var(--fig-charge);stroke:none;opacity:0;transition:opacity .25s}
.fig-bateria .fig-flow{stroke:var(--fig-flow);stroke-width:1.6;fill:none;display:none}
.fig-bateria .fig-flow[data-on]{display:inline}
.fig-bateria .iso-stage{outline-offset:4px;cursor:ew-resize}
.fig-bateria .fig-data{margin:10px 0 0;font:600 .76rem/1.5 var(--anatomy-mono);color:#3b3d48;display:flex;flex-wrap:wrap;gap:4px 18px}
.fig-bateria .fig-data b{color:#13141a}
@media (max-width:560px){.fig-bateria .iso-plate{padding:46px 6px 62px}.fig-bateria .iso-svg{width:118%;margin-left:-9%}}
`;

const live = `
function runBateria(root) {
const P = ${JSON.stringify(P)};
const SOLAR = ${JSON.stringify(SOLAR)}, DEMAND = ${JSON.stringify(DEMAND)};
const POWER = ${POWER}, ENERGY = ${ENERGY}, CHARGE_FROM = ${CHARGE_FROM}, CHARGE_TO = ${CHARGE_TO}, CHARGE_MW = ${CHARGE_MW}, PEAK = ${peakHour};
const RULE_FROM = ${RULE_FROM}, HOUR_W = ${HOUR_W}, CELLS = ${RACKS * MODULES};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const rider = svg.querySelector('[data-part="rider"]');
const needle = svg.querySelector('[data-part="needle"]');
const cells = [...svg.querySelectorAll(".fig-cell")].sort((a, b) => a.dataset.cell - b.dataset.cell);
const routes = [...svg.querySelectorAll(".fig-flow")];
const readout = root.querySelector("[data-readout]");
const data = root.querySelector("[data-fig-data]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = new Intl.NumberFormat("es-CO");
const dec = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
function model(h) {
  h = ((h % 24) + 24) % 24;
  let soc = 0, mw = 0;
  if (h >= CHARGE_FROM && h < CHARGE_TO) { soc = (h - CHARGE_FROM) * CHARGE_MW; mw = CHARGE_MW; }
  else if (h >= CHARGE_TO && h < PEAK) soc = ENERGY;
  else if (h >= PEAK && h < PEAK + 1) { soc = ENERGY - (h - PEAK) * POWER; mw = -POWER; }
  const hour = Math.floor(h);
  return { h, soc, mw, solar: SOLAR[hour], demand: DEMAND[hour], hour };
}
function flowsFor(m) {
  const on = new Set();
  if (m.solar > 50) on.add("solar:out");
  if (m.mw > 0) ["hv:in", "ac:in", "dc:in"].forEach((r) => on.add(r));
  if (m.mw < 0) ["dc:out", "ac:out", "hv:out", "line:out"].forEach((r) => on.add(r));
  if (m.solar > 50 && m.mw === 0) on.add("line:out");
  return on;
}
let hour = 18.5, target = hour, frame = 0, last = 0, touring = !still.matches, visible = false, idleTimer = 0, lastKey = "";
const pad = (n) => String(n).padStart(2, "0");
const clock = (h) => pad(Math.floor(h)) + ":" + pad(Math.floor((h % 1) * 4) * 15);
function draw() {
  const m = model(hour);
  rider.setAttribute("transform", translateAlong(P, [RULE_FROM + m.h * HOUR_W, 0, 0]));
  needle.setAttribute("d", needleAt(m.soc / ENERGY));
  const filled = (m.soc / ENERGY) * CELLS;
  cells.forEach((cell, i) => { const o = clamp(filled - i, 0, 1).toFixed(2); if (cell.style.opacity !== o) cell.style.opacity = o; });
  const on = flowsFor(m);
  const key = [...on].sort().join("|");
  if (key !== lastKey) { lastKey = key; routes.forEach((r) => r.toggleAttribute("data-on", on.has(r.dataset.route + ":" + r.dataset.dir))); }
  const state = m.mw > 0 ? "carga " + dec.format(m.mw) + " MW" : m.mw < 0 ? "entrega " + POWER + " MW" : m.soc >= ENERGY ? "llena, en espera" : "vacía, en espera";
  const text = clock(m.h) + " · " + state + " · " + dec.format(m.soc) + " MWh";
  if (readout.textContent !== text) readout.textContent = text;
  const info = "<span>XM · octubre de 2026 · " + pad(m.hour) + ":00–" + pad((m.hour + 1) % 24) + ":00</span><span>Sol en Colombia <b>" + num.format(m.solar) + " MWh</b></span><span>Demanda <b>" + num.format(m.demand) + " MWh</b></span>";
  if (data.innerHTML !== info) data.innerHTML = info;
  stage.setAttribute("aria-valuenow", String(Math.floor(m.h)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { target = (target + dt / 0.8) % 24; hour = target; }
  else hour = still.matches ? target : hour + (target - hour) * (1 - Math.exp(-dt / 0.25));
  if (Math.abs(target - hour) < 0.002) hour = target;
  draw();
  frame = visible && (touring || hour !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false; target = clamp(next, 0, 23.99);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; run(); }, 4000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
const ends = [iso([RULE_FROM, 56, 0], P)[0], iso([RULE_FROM + 24 * HOUR_W, 56, 0], P)[0]];
const pick = (event) => {
  const box = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const x = view.x + ((event.clientX - box.left) / box.width) * view.width;
  steer(((x - ends[0]) / (ends[1] - ends[0])) * 24);
};
stage.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse") pick(event); });
stage.addEventListener("pointerdown", pick);
stage.addEventListener("keydown", (event) => {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
  if (step) { event.preventDefault(); steer(Math.round(target) + step); }
  if (event.key === "Home") { event.preventDefault(); steer(0); }
  if (event.key === "End") { event.preventDefault(); steer(23); }
});
draw();
}
`;

const moduleCode = `// Generado por scripts/figuras/bateria.mjs. No editar a mano.
// Kit isométrico de Anatomy (MIT): github.com/wheresryan22/anatomy
${kitSource}
const MARKUP = ${JSON.stringify(markup)};
const EXTRA_CSS = ${JSON.stringify(extraCss)};
${live}
export function setupFigure(root) {
  if (!document.getElementById("iso-kit-css")) {
    const style = document.createElement("style");
    style.id = "iso-kit-css";
    style.textContent = ISO_CSS + EXTRA_CSS;
    document.head.append(style);
  }
  root.innerHTML = MARKUP;
  runBateria(root.querySelector(".fig-bateria"));
}
`;
mkdirSync(join(SITE, "assets", "figuras"), { recursive: true });
writeFileSync(join(SITE, "assets", "figuras", "bateria.js"), moduleCode);
console.log("escrito assets/figuras/bateria.js", (moduleCode.length / 1024).toFixed(0), "KB · carga", CHARGE_FROM + "–" + CHARGE_TO, "h · pico", peakHour, "h");

const previewAt = process.argv.indexOf("--preview");
if (previewAt > -1) {
  const page = k.pageHtml({ title: "Batería de red", theme: "light", body: markup.replace('class="iso fig-bateria" data-theme="light"', 'class="fig-bateria"'), script: kitSource + live + "\nrunBateria(document.querySelector('.fig-bateria'));", width: 760 });
  writeFileSync(process.argv[previewAt + 1], page.replace("</style>", extraCss + "</style>"));
  console.log("vista previa", process.argv[previewAt + 1]);
}
