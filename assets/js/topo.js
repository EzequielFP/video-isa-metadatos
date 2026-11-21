// Portada: curvas de nivel del relieve real de Peñol–Guatapé dibujadas en WebGL2.
// El agua del embalse se detecta en el modelo de alturas (lámina plana a ~1900 m)
// y el cursor abre una "linterna" que muestra la imagen Sentinel-2 de 2026.
import { clamp, emitGeo, fetchJson, geoLabel, loadImage } from "./util.js";

const vertex = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform sampler2D uHeight, uWater, uSat;
uniform vec2 uRes, uOrigin, uScale, uTexel, uElev, uMouse;
uniform float uTime, uScan, uIntro, uLens, uRadius, uDpr;
out vec4 color;

float hgt(vec2 uv) { return texture(uHeight, uv).r; }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = uOrigin + frag / uRes * uScale;
  float h = hgt(uv);
  float e = mix(uElev.x, uElev.y, h);

  vec3 paper = vec3(0.949, 0.933, 0.894);
  vec3 ink = vec3(0.075, 0.078, 0.102);
  vec3 cobalt = vec3(0.169, 0.231, 1.0);
  vec3 coral = vec3(1.0, 0.357, 0.227);

  // Sombreado del relieve con luz desde el noroeste.
  float dx = hgt(uv + vec2(uTexel.x, 0.0)) - hgt(uv - vec2(uTexel.x, 0.0));
  float dy = hgt(uv + vec2(0.0, uTexel.y)) - hgt(uv - vec2(0.0, uTexel.y));
  vec3 n = normalize(vec3(-dx * 26.0, -dy * 26.0, 1.0));
  float light = dot(n, normalize(vec3(-0.55, -0.6, 0.6)));
  vec3 col = paper * mix(0.9, 1.035, clamp(light, 0.0, 1.0));
  col = mix(col, vec3(0.925, 0.89, 0.82), smoothstep(0.55, 0.0, h) * 0.35);

  // Curvas cada 25 m y curvas maestras cada 100 m.
  float c = e / 25.0;
  float fc = fwidth(c);
  float minor = 1.0 - smoothstep(0.0, fc * 1.1 * uDpr, abs(fract(c - 0.5) - 0.5));
  float ci = e / 100.0;
  float fi = fwidth(ci);
  float major = 1.0 - smoothstep(fi * 0.5 * uDpr, fi * 1.7 * uDpr, abs(fract(ci - 0.5) - 0.5));
  float lines = max(minor * 0.24, major * 0.52) * uIntro;

  // Barrido de altitud: una franja de curvas se enciende y recorre el relieve.
  float scanE = mix(uElev.x - 60.0, uElev.y + 60.0, uScan);
  float band = exp(-pow((e - scanE) / 38.0, 2.0));
  col = mix(col, ink, lines);
  col = mix(col, coral, max(minor, major) * band * uIntro);

  // Lámina de agua con oleaje sutil y orilla marcada.
  float w = texture(uWater, uv).r;
  float water = smoothstep(0.42, 0.58, w) * smoothstep(0.0, 0.6, uIntro);
  float wave = sin(dot(uv, vec2(520.0, 340.0)) + uTime * 1.1 + 2.6 * sin(uv.y * 120.0 + uTime * 0.4));
  vec3 waterCol = mix(cobalt, vec3(0.45, 0.55, 1.0), smoothstep(0.93, 1.0, wave) * 0.55);
  col = mix(col, waterCol, water);
  float shore = 1.0 - smoothstep(0.0, 0.16, abs(w - 0.5));
  col = mix(col, ink, shore * 0.85 * uIntro);

  // Linterna satelital.
  float d = length(frag - uMouse);
  float r = uRadius * uLens;
  float inside = 1.0 - smoothstep(r - 1.5 * uDpr, r + 0.5 * uDpr, d);
  col = mix(col, texture(uSat, uv).rgb, inside);
  float ring = 1.0 - smoothstep(0.8 * uDpr, 2.2 * uDpr, abs(d - r));
  col = mix(col, ink, ring * step(0.02, uLens));
  float cross = max(1.0 - smoothstep(0.4 * uDpr, 1.2 * uDpr, abs(frag.x - uMouse.x)),
                    1.0 - smoothstep(0.4 * uDpr, 1.2 * uDpr, abs(frag.y - uMouse.y)));
  col = mix(col, ink, cross * 0.14 * uLens * (1.0 - inside));

  color = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function texture(gl, unit, setup) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  setup();
  return tex;
}

function boxBlur(source, width, height, radius) {
  const tmp = new Float32Array(source.length);
  const out = new Float32Array(source.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += source[y * width + clamp(x + k, 0, width - 1)];
      tmp[y * width + x] = sum / span;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[clamp(y + k, 0, height - 1) * width + x];
      out[y * width + x] = sum / span;
    }
  }
  return out;
}

export async function loadPenol() {
  const base = new URL("../media/penol/", import.meta.url);
  const meta = await fetchJson(new URL("penol.json", base));
  const buffer = await fetch(new URL(meta.grid.file, base)).then((response) => {
    if (!response.ok) throw new Error("altura.bin");
    return response.arrayBuffer();
  });
  const { width, height } = meta.grid;
  const [low, high] = meta.elevation;
  const raw = new Uint16Array(buffer);
  const meters = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) meters[i] = low + raw[i] / 65535 * (high - low);
  // Agua: celdas casi planas alrededor de la lámina del embalse (1897–1908 m en este modelo).
  const water = new Float32Array(raw.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = (meters[i + 1] - meters[i - 1]) / 2;
      const gy = (meters[i + width] - meters[i - width]) / 2;
      water[i] = meters[i] > 1896 && meters[i] < 1909 && Math.hypot(gx, gy) < 0.9 ? 1 : 0;
    }
  }
  return { meta, base, width, height, meters, water: boxBlur(boxBlur(water, width, height, 1), width, height, 1) };
}

export function sampleGrid(data, width, height, u, v) {
  const x = clamp(u, 0, 1) * (width - 1);
  const y = clamp(v, 0, 1) * (height - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0, fy = y - y0;
  const top = data[y0 * width + x0] * (1 - fx) + data[y0 * width + x1] * fx;
  const bottom = data[y1 * width + x0] * (1 - fx) + data[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

export async function setupTopo(root, { reduce, fine }) {
  const canvas = root.querySelector(".topo-canvas");
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return;
  const probe = root.querySelector("[data-probe]");
  const terrain = await loadPenol();
  const { meta, width, height, meters } = terrain;
  const sat = await loadImage(new URL(meta.textures["2026"].file, terrain.base).href);
  const [west, south, east, north] = meta.bbox;
  const [low, high] = meta.elevation;
  const aspect = ((east - west) * Math.cos((north + south) / 2 * Math.PI / 180)) / (north - south);

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const smooth = boxBlur(boxBlur(meters, width, height, 1), width, height, 1);
  const normalized = new Float32Array(smooth.length);
  for (let i = 0; i < smooth.length; i++) normalized[i] = (smooth[i] - low) / (high - low);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  texture(gl, 0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.FLOAT, normalized));
  const waterBytes = new Uint8Array(terrain.water.length);
  for (let i = 0; i < waterBytes.length; i++) waterBytes[i] = Math.round(terrain.water[i] * 255);
  texture(gl, 1, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, waterBytes));
  texture(gl, 2, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sat));

  const uniform = Object.fromEntries(["uHeight", "uWater", "uSat", "uRes", "uOrigin", "uScale", "uTexel", "uElev", "uMouse",
    "uTime", "uScan", "uIntro", "uLens", "uRadius", "uDpr"].map((name) => [name, gl.getUniformLocation(program, name)]));
  gl.uniform1i(uniform.uHeight, 0);
  gl.uniform1i(uniform.uWater, 1);
  gl.uniform1i(uniform.uSat, 2);
  gl.uniform2f(uniform.uTexel, 1 / width, 1 / height);
  gl.uniform2f(uniform.uElev, low, high);

  const state = { dpr: 1, w: 1, h: 1, mouse: [-999, -999], target: [-999, -999], lens: 0, lensTarget: 0, intro: reduce.matches ? 1 : 0,
    origin: [0, 0], scale: [1, 1], scroll: 0, visible: true, start: performance.now(), drift: [0, 0] };

  function resize() {
    state.dpr = Math.min(devicePixelRatio || 1, 1.5);
    state.w = canvas.clientWidth;
    state.h = canvas.clientHeight;
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function view(time) {
    // Encuadre tipo "cover" centrado en el embalse, con deriva lenta y zoom al hacer scroll.
    const screen = state.w / state.h;
    const zoom = 1.12 + state.scroll * 0.35;
    let sx = 1 / zoom, sy = 1 / zoom;
    if (screen > aspect) sy = (aspect / screen) / zoom;
    else sx = (screen / aspect) / zoom;
    const t = reduce.matches ? 0 : time / 1000;
    const cx = 0.4 + Math.sin(t * 0.045) * 0.06 + state.drift[0];
    const cy = 0.46 + Math.cos(t * 0.037) * 0.05 + state.drift[1];
    state.scale = [sx, sy];
    state.origin = [clamp(cx - sx / 2, 0, 1 - sx), clamp(cy - sy / 2, 0, 1 - sy)];
  }

  function readout(x, y) {
    const u = state.origin[0] + (x / state.w) * state.scale[0];
    const v = state.origin[1] + (y / state.h) * state.scale[1];
    const lon = west + u * (east - west);
    const lat = north - v * (north - south);
    const elev = sampleGrid(meters, width, height, u, v);
    const inWater = sampleGrid(terrain.water, width, height, u, v) > 0.5;
    if (probe) {
      const [la, lo] = geoLabel(lat, lon);
      probe.querySelector("[data-lat]").textContent = la;
      probe.querySelector("[data-lon]").textContent = lo;
      probe.querySelector("[data-elev]").textContent = `${Math.round(elev).toLocaleString("es-CO")} m`;
      probe.querySelector("[data-cover]").textContent = inWater ? "Agua del embalse" : "Tierra firme";
    }
    emitGeo({ lat, lon, elev });
  }

  function draw(now) {
    const time = now - state.start;
    view(time);
    state.lens += (state.lensTarget - state.lens) * 0.12;
    for (const i of [0, 1]) state.mouse[i] += (state.target[i] - state.mouse[i]) * (fine.matches ? 0.22 : 1);
    if (!reduce.matches) state.intro = Math.min(1, state.intro + 0.012);
    const scan = reduce.matches ? 0.55 : (Math.sin(time / 1000 * 0.42 - 1.4) * 0.5 + 0.5);
    gl.uniform2f(uniform.uRes, canvas.width, canvas.height);
    gl.uniform2f(uniform.uOrigin, ...state.origin);
    gl.uniform2f(uniform.uScale, ...state.scale);
    gl.uniform2f(uniform.uMouse, state.mouse[0] * state.dpr, state.mouse[1] * state.dpr);
    gl.uniform1f(uniform.uTime, reduce.matches ? 0 : time / 1000);
    gl.uniform1f(uniform.uScan, scan);
    gl.uniform1f(uniform.uIntro, state.intro);
    gl.uniform1f(uniform.uLens, state.lens);
    gl.uniform1f(uniform.uRadius, Math.min(150, state.w * 0.16) * state.dpr);
    gl.uniform1f(uniform.uDpr, state.dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let frame = 0;
  function loop(now) {
    frame = 0;
    if (!state.visible || document.hidden) return;
    draw(now);
    if (!reduce.matches || Math.abs(state.lens - state.lensTarget) > 0.01) frame = requestAnimationFrame(loop);
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };

  root.addEventListener("pointermove", (event) => {
    const box = canvas.getBoundingClientRect();
    state.target = [event.clientX - box.left, event.clientY - box.top];
    if (state.mouse[0] < -900) state.mouse = [...state.target];
    state.lensTarget = event.pointerType === "mouse" ? 1 : 0.8;
    state.drift = [(state.target[0] / state.w - 0.5) * -0.02, (state.target[1] / state.h - 0.5) * -0.02];
    readout(...state.target);
    wake();
  });
  root.addEventListener("pointerleave", () => {
    state.lensTarget = 0;
    emitGeo({});
    wake();
  });
  addEventListener("scroll", () => {
    state.scroll = clamp(scrollY / Math.max(root.offsetHeight, 1), 0, 1);
    wake();
  }, { passive: true });
  new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    wake();
  }).observe(root);
  document.addEventListener("visibilitychange", wake);
  new ResizeObserver(() => { resize(); wake(); }).observe(canvas);
  resize();
  readout(state.w * 0.62, state.h * 0.5);
  emitGeo({});
  root.classList.add("topo-ready");
  wake();
}
