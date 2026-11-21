// Modelo 3D de Peñol–Guatapé: maqueta con laterales estratificados, imagen Sentinel-2
// de 2022 o 2026, cortina antes/después sobre el propio relieve, curvas de nivel,
// sonda de coordenadas y recorrido de cámara.
import * as T from "../vendor/three-lite.js";
import { gsap } from "../vendor/motion.js";
import { clamp, emitGeo, geoLabel } from "./util.js";
import { loadPenol, sampleGrid } from "./topo.js";

const KM = 1.1; // kilómetros por unidad del mundo
const BASE = 900; // altitud de la base de la maqueta (m)
const FLOOR = -0.55; // fondo de la maqueta en unidades

const terrainVertex = `
attribute float aElev;
attribute vec2 aGrad;
attribute float aWater;
uniform float uExag;
varying vec2 vUv;
varying float vElev;
varying float vWater;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec3 p = position;
  p.y = (aElev - ${BASE.toFixed(1)}) / 1000.0 / ${KM.toFixed(2)} * uExag;
  float k = uExag / 1000.0 / ${KM.toFixed(2)};
  vNormal = normalize(vec3(-aGrad.x * k, 1.0, -aGrad.y * k));
  vUv = uv;
  vElev = aElev;
  vWater = aWater;
  vWorld = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const terrainFragment = `
uniform sampler2D uTex22;
uniform sampler2D uTex26;
uniform float uMode;      // 0 = 2026, 1 = 2022, 2 = relieve
uniform float uSplit;     // píxel de la cortina; negativo si está apagada
uniform float uContours;
uniform float uReveal;
uniform float uTime;
uniform vec3 uLight;
uniform vec3 uCam;
uniform vec3 uProbe;      // x, z, encendido
uniform vec2 uElev;
uniform vec3 uFog;
varying vec2 vUv;
varying float vElev;
varying float vWater;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vDepth;

vec3 hypso(float t) {
  vec3 a = vec3(0.18, 0.42, 0.31);
  vec3 b = vec3(0.56, 0.72, 0.42);
  vec3 c = vec3(0.91, 0.86, 0.6);
  vec3 d = vec3(0.83, 0.6, 0.37);
  vec3 e = vec3(0.96, 0.94, 0.9);
  if (t < 0.25) return mix(a, b, t / 0.25);
  if (t < 0.5) return mix(b, c, (t - 0.25) / 0.25);
  if (t < 0.72) return mix(c, d, (t - 0.5) / 0.22);
  return mix(d, e, (t - 0.72) / 0.28);
}

void main() {
  vec3 n = normalize(vNormal);
  float lambert = max(dot(n, normalize(uLight)), 0.0);
  float t = clamp((vElev - uElev.x) / (uElev.y - uElev.x), 0.0, 1.0);
  vec3 s26 = texture2D(uTex26, vUv).rgb;
  vec3 s22 = texture2D(uTex22, vUv).rgb;
  vec3 sat = uMode < 0.5 ? s26 : s22;
  if (uSplit > 0.0) sat = gl_FragCoord.x < uSplit ? s22 : s26;
  vec3 relief = hypso(t) * (0.45 + 0.7 * lambert);
  vec3 satLit = sat * (0.78 + 0.38 * lambert);
  bool showRelief = uMode > 1.5 && uSplit < 0.0;
  vec3 col = showRelief ? relief : satLit;

  // Agua: azul en modo relieve, destello especular sobre la imagen satelital.
  vec3 view = normalize(uCam - vWorld);
  vec3 h = normalize(normalize(uLight) + view);
  float spec = pow(max(dot(vec3(0.0, 1.0, 0.0), h), 0.0), 90.0);
  float ripple = 0.5 + 0.5 * sin(vWorld.x * 18.0 + vWorld.z * 11.0 + uTime * 1.4);
  if (showRelief) col = mix(col, vec3(0.17, 0.23, 1.0), smoothstep(0.35, 0.7, vWater));
  col += vec3(1.0, 0.97, 0.9) * spec * smoothstep(0.4, 0.8, vWater) * (0.55 + 0.45 * ripple);

  // Curvas de nivel cada 50 m y maestras cada 250 m.
  float c = vElev / 50.0;
  float line = 1.0 - smoothstep(0.0, fwidth(c) * 1.2, abs(fract(c - 0.5) - 0.5));
  float cm = vElev / 250.0;
  float major = 1.0 - smoothstep(0.0, fwidth(cm) * 1.6, abs(fract(cm - 0.5) - 0.5));
  vec3 lineCol = showRelief ? vec3(0.08) : vec3(1.0, 0.98, 0.92);
  float lines = max(line * 0.55, major * 0.9) * (1.0 - smoothstep(0.4, 0.8, vWater));
  col = mix(col, lineCol, lines * max(uContours, 1.0 - uReveal));

  // Sonda: anillo en el punto bajo el cursor.
  float d = length(vWorld.xz - uProbe.xy);
  float ring = (1.0 - smoothstep(0.012, 0.03, abs(d - 0.32))) * uProbe.z;
  col = mix(col, vec3(1.0, 0.36, 0.23), ring);
  col = mix(col, vec3(1.0, 0.36, 0.23), (1.0 - smoothstep(0.03, 0.06, d)) * uProbe.z);

  // Aparición: primero el relieve en papel con curvas, luego la imagen.
  col = mix(vec3(0.96, 0.95, 0.92) * (0.6 + 0.45 * lambert), col, uReveal);
  col = mix(col, uFog, smoothstep(30.0, 70.0, vDepth) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

const sideVertex = `
attribute float aElev;
attribute float aBottom;
uniform float uExag;
varying float vElev;
varying float vShade;
varying float vBottom;
void main() {
  vec3 p = position;
  p.y = aBottom > 0.5 ? ${FLOOR.toFixed(2)} : (aElev - ${BASE.toFixed(1)}) / 1000.0 / ${KM.toFixed(2)} * uExag;
  vElev = aBottom > 0.5 ? ${BASE.toFixed(1)} + ${FLOOR.toFixed(2)} * 1000.0 * ${KM.toFixed(2)} / uExag : aElev;
  vShade = dot(normalize(normal), normalize(vec3(-0.5, 0.4, 0.7))) * 0.5 + 0.5;
  vBottom = aBottom;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const sideFragment = `
varying float vElev;
varying float vShade;
varying float vBottom;
void main() {
  float band = mod(floor(vElev / 100.0), 2.0);
  vec3 a = vec3(0.95, 0.93, 0.88);
  vec3 b = vec3(0.89, 0.86, 0.78);
  vec3 col = mix(a, b, band);
  float c = vElev / 100.0;
  float line = 1.0 - smoothstep(0.0, fwidth(c) * 1.3, abs(fract(c - 0.5) - 0.5));
  col = mix(col, vec3(0.075, 0.078, 0.1), line * 0.35);
  col *= 0.78 + 0.26 * vShade;
  gl_FragColor = vec4(col, 1.0);
}`;

function buildSides(grid, sizeX, sizeZ) {
  const { width, height, meters } = grid;
  const edges = [
    { count: width, at: (i) => [i, 0], normal: [0, 0, -1] },
    { count: height, at: (i) => [width - 1, i], normal: [1, 0, 0] },
    { count: width, at: (i) => [width - 1 - i, height - 1], normal: [0, 0, 1] },
    { count: height, at: (i) => [0, height - 1 - i], normal: [-1, 0, 0] },
  ];
  const positions = [], elevs = [], bottoms = [], normals = [], index = [];
  for (const edge of edges) {
    const start = positions.length / 3;
    for (let i = 0; i < edge.count; i++) {
      const [gx, gy] = edge.at(i);
      const x = (gx / (width - 1) - 0.5) * sizeX;
      const z = (gy / (height - 1) - 0.5) * sizeZ;
      const elev = meters[gy * width + gx];
      positions.push(x, 0, z, x, 0, z);
      elevs.push(elev, elev);
      bottoms.push(0, 1);
      normals.push(...edge.normal, ...edge.normal);
      if (i > 0) {
        const a = start + (i - 1) * 2, b = start + i * 2;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new T.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("aElev", new T.BufferAttribute(new Float32Array(elevs), 1));
  geometry.setAttribute("aBottom", new T.BufferAttribute(new Float32Array(bottoms), 1));
  return geometry;
}

export async function setupTerrain(root, { reduce, fine }) {
  const host = root.querySelector(".t3d-canvas");
  const status = root.querySelector("[data-t3d-status]");
  const probeTip = root.querySelector(".t3d-probe");
  const labelsLayer = root.querySelector(".t3d-labels");
  const splitEl = root.querySelector(".t3d-split");
  const compass = root.querySelector(".compass svg");
  status.textContent = "Cargando relieve y texturas…";

  const grid = await loadPenol();
  const { meta, width, height, meters, water } = grid;
  const [west, south, east, north] = meta.bbox;
  const [low, high] = meta.elevation;
  const lat0 = (north + south) / 2 * Math.PI / 180;
  const sizeX = (east - west) * 111.32 * Math.cos(lat0) / KM;
  const sizeZ = (north - south) * 110.57 / KM;

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = T.NoToneMapping;
  const loader = new T.TextureLoader();
  const loadTexture = (period) => loader.loadAsync(new URL(meta.textures[period].file, grid.base).href).then((texture) => {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    return texture;
  });
  const [tex26, tex22] = await Promise.all([loadTexture("2026"), loadTexture("2022")]);

  // Malla del relieve: misma rejilla que altura.bin, fila 0 al norte (−z).
  const geometry = new T.PlaneGeometry(sizeX, sizeZ, width - 1, height - 1);
  geometry.rotateX(-Math.PI / 2);
  const grad = new Float32Array(width * height * 2);
  const cellX = sizeX / (width - 1), cellZ = sizeZ / (height - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const xl = meters[y * width + Math.max(x - 1, 0)], xr = meters[y * width + Math.min(x + 1, width - 1)];
      const zu = meters[Math.max(y - 1, 0) * width + x], zd = meters[Math.min(y + 1, height - 1) * width + x];
      grad[i * 2] = (xr - xl) / (cellX * ((x > 0) + (x < width - 1)));
      grad[i * 2 + 1] = (zd - zu) / (cellZ * ((y > 0) + (y < height - 1)));
    }
  }
  geometry.setAttribute("aElev", new T.BufferAttribute(meters, 1));
  geometry.setAttribute("aGrad", new T.BufferAttribute(grad, 2));
  geometry.setAttribute("aWater", new T.BufferAttribute(water, 1));

  const uniforms = {
    uTex22: { value: tex22 }, uTex26: { value: tex26 }, uMode: { value: 0 }, uSplit: { value: -1 },
    uContours: { value: 0 }, uReveal: { value: reduce.matches ? 1 : 0 }, uTime: { value: 0 },
    uLight: { value: new T.Vector3(-0.55, 0.75, -0.35) }, uCam: { value: new T.Vector3() },
    uProbe: { value: new T.Vector3(0, 0, 0) }, uElev: { value: new T.Vector2(low, high) },
    uFog: { value: new T.Vector3(0.9, 0.93, 0.95) }, uExag: { value: reduce.matches ? 2 : 0.05 },
  };
  const terrainMaterial = new T.ShaderMaterial({ uniforms, vertexShader: terrainVertex, fragmentShader: terrainFragment });
  const sideMaterial = new T.ShaderMaterial({ uniforms: { uExag: uniforms.uExag }, vertexShader: sideVertex, fragmentShader: sideFragment, side: T.DoubleSide });
  const scene = new T.Scene();
  const model = new T.Group();
  for (const mesh of [new T.Mesh(geometry, terrainMaterial), new T.Mesh(buildSides(grid, sizeX, sizeZ), sideMaterial)]) {
    mesh.frustumCulled = false;
    model.add(mesh);
  }
  scene.add(model);

  const camera = new T.PerspectiveCamera(30, 1, 0.1, 200);
  const home = { position: new T.Vector3(10, 24, 35), target: new T.Vector3(-3.2, -0.4, 1.2) };
  camera.position.copy(reduce.matches ? home.position : new T.Vector3(0, 46, 0.5));
  host.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Modelo 3D del embalse de Peñol–Guatapé");
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enableZoom = false;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 4;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.autoRotateSpeed = -0.35;
  controls.update();

  // Exageración y coordenadas del mundo.
  const world = (lon, lat) => [((lon - west) / (east - west) - 0.5) * sizeX, ((north - lat) / (north - south) - 0.5) * sizeZ];
  const yOf = (m) => (m - BASE) / 1000 / KM * uniforms.uExag.value;
  const elevAt = (x, z) => sampleGrid(meters, width, height, x / sizeX + 0.5, z / sizeZ + 0.5);

  // Etiquetas de lugares.
  const labels = meta.places.map((place) => {
    const el = document.createElement("div");
    el.className = `t3d-label ${place.kind}`;
    el.innerHTML = `<b></b><i style="height:${place.kind === "peak" ? 28 : 56}px"></i>`;
    el.querySelector("b").textContent = place.name;
    if (place.kind === "peak") {
      const small = document.createElement("small");
      small.textContent = `${place.elev.toLocaleString("es-CO")} m`;
      el.querySelector("b").append(small);
    }
    labelsLayer.append(el);
    const [x, z] = world(place.lon, place.lat);
    return { el, x, z, elev: place.elev, place };
  });
  const projected = new T.Vector3();

  let viewW = 1, viewH = 1;
  function resize() {
    viewW = host.clientWidth;
    viewH = host.clientHeight;
    if (!viewW || !viewH) return;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.fov = viewW < 700 ? 44 : 30;
    camera.updateProjectionMatrix();
    if (split.on) setSplit(split.ratio);
  }

  function placeLabels() {
    for (const label of labels) {
      projected.set(label.x, yOf(label.elev) + 0.08, label.z).project(camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
      label.el.style.opacity = visible ? 1 : 0;
      label.el.style.transform = `translate(${(projected.x * 0.5 + 0.5) * viewW}px, ${(-projected.y * 0.5 + 0.5) * viewH}px) translate(-50%, -100%)`;
    }
  }

  // Sonda: marcha del rayo sobre la rejilla de alturas.
  const raycaster = new T.Raycaster();
  const ndc = new T.Vector2();
  function pick(clientX, clientY) {
    const box = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const { origin, direction } = raycaster.ray;
    const top = yOf(high) + 0.01;
    if (direction.y >= 0 && origin.y > top) return null;
    let t = origin.y > top ? (top - origin.y) / direction.y : 0;
    const step = 0.04;
    let prev = null;
    for (let i = 0; i < 1600; i++, t += step) {
      const x = origin.x + direction.x * t, y = origin.y + direction.y * t, z = origin.z + direction.z * t;
      if (y < FLOOR) return null;
      if (Math.abs(x) <= sizeX / 2 && Math.abs(z) <= sizeZ / 2) {
        if (y <= yOf(elevAt(x, z))) {
          let a = prev ?? t - step, b = t;
          for (let k = 0; k < 8; k++) {
            const m = (a + b) / 2;
            const my = origin.y + direction.y * m;
            if (my <= yOf(elevAt(origin.x + direction.x * m, origin.z + direction.z * m))) b = m; else a = m;
          }
          return { x: origin.x + direction.x * b, z: origin.z + direction.z * b };
        }
        prev = t;
      }
    }
    return null;
  }
  let probeTarget = 0;
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.buttons) return;
    const hit = pick(event.clientX, event.clientY);
    probeTarget = hit ? 1 : 0;
    probeTip.classList.toggle("on", Boolean(hit));
    if (!hit) return;
    const u = hit.x / sizeX + 0.5, v = hit.z / sizeZ + 0.5;
    const lon = west + u * (east - west), lat = north - v * (north - south);
    const elev = elevAt(hit.x, hit.z);
    const wet = sampleGrid(water, width, height, u, v) > 0.5;
    uniforms.uProbe.value.set(hit.x, hit.z, uniforms.uProbe.value.z);
    const [la, lo] = geoLabel(lat, lon);
    probeTip.textContent = `${la} · ${lo} · ${Math.round(elev).toLocaleString("es-CO")} m${wet ? " · agua" : ""}`;
    const box = root.getBoundingClientRect();
    probeTip.style.transform = `translate(${event.clientX - box.left + 16}px, ${event.clientY - box.top + 16}px)`;
    emitGeo({ lat, lon, elev });
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    probeTarget = 0;
    probeTip.classList.remove("on");
    emitGeo({});
  });

  // Cortina antes/después sobre el modelo.
  const split = { on: false, ratio: 0.5 };
  function setSplit(ratio) {
    split.ratio = clamp(ratio, 0.04, 0.96);
    splitEl.style.transform = `translateX(${split.ratio * viewW}px)`;
    uniforms.uSplit.value = split.on ? split.ratio * viewW * renderer.getPixelRatio() : -1;
  }
  const splitHandle = splitEl.querySelector("button");
  splitHandle.addEventListener("pointerdown", (event) => {
    splitHandle.setPointerCapture(event.pointerId);
    const move = (e) => setSplit((e.clientX - host.getBoundingClientRect().left) / viewW);
    const up = () => {
      splitHandle.removeEventListener("pointermove", move);
      splitHandle.removeEventListener("pointerup", up);
    };
    splitHandle.addEventListener("pointermove", move);
    splitHandle.addEventListener("pointerup", up);
  });
  splitHandle.addEventListener("keydown", (event) => {
    const delta = { ArrowLeft: -0.03, ArrowRight: 0.03 }[event.key];
    if (delta) { event.preventDefault(); setSplit(split.ratio + delta); }
  });

  // Controles de la interfaz.
  const modeButtons = [...root.querySelectorAll("[data-t3d-mode]")];
  const legend = root.querySelector("[data-t3d-legend]");
  modeButtons.forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.t3dMode;
    modeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    uniforms.uMode.value = mode === "2026" ? 0 : mode === "2022" ? 1 : 2;
    legend.hidden = mode !== "relieve";
    if (split.on) toggleSplit(false);
  }));
  function toggleSplit(force) {
    split.on = force ?? !split.on;
    splitEl.hidden = !split.on;
    root.querySelector('[data-t3d-toggle="split"]').setAttribute("aria-pressed", String(split.on));
    if (split.on) {
      modeButtons.forEach((item) => item.setAttribute("aria-pressed", "false"));
      legend.hidden = true;
    } else if (!modeButtons.some((item) => item.getAttribute("aria-pressed") === "true")) {
      modeButtons[0].setAttribute("aria-pressed", "true");
      uniforms.uMode.value = 0;
    }
    setSplit(split.ratio);
  }
  root.querySelectorAll("[data-t3d-toggle]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.t3dToggle === "split") toggleSplit();
    else {
      const on = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(on));
      gsap.to(uniforms.uContours, { value: on ? 1 : 0, duration: 0.6 });
    }
  }));
  const exagInput = root.querySelector("[data-t3d-exag]");
  const exagLabel = root.querySelector("[data-t3d-exag-label]");
  const exagFormat = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  exagInput.addEventListener("input", () => {
    gsap.to(uniforms.uExag, { value: Number(exagInput.value), duration: 0.5, ease: "power2.out" });
    exagLabel.textContent = `×${exagFormat.format(Number(exagInput.value))}`;
  });

  let tour = null;
  function stopTour() {
    tour?.kill();
    tour = null;
    controls.enabled = !root.classList.contains("is-touch") || root.classList.contains("is-active");
    root.querySelector('[data-t3d-act="tour"]').setAttribute("aria-pressed", "false");
  }
  function fly(position, target, duration = 2.2) {
    return gsap.timeline()
      .to(camera.position, { ...position, duration, ease: "power2.inOut" }, 0)
      .to(controls.target, { ...target, duration, ease: "power2.inOut" }, 0);
  }
  function dolly(factor) {
    stopTour();
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
    const distance = clamp(offset.length(), controls.minDistance, controls.maxDistance);
    offset.setLength(distance);
    gsap.to(camera.position, { x: controls.target.x + offset.x, y: controls.target.y + offset.y, z: controls.target.z + offset.z, duration: 0.6, ease: "power2.out" });
  }
  const spot = (name, dx, dy, dz) => {
    const label = labels.find((item) => item.place.name === name) ?? labels[0];
    const y = yOf(label.elev);
    return [{ x: label.x + dx, y: y + dy, z: label.z + dz }, { x: label.x, y, z: label.z }];
  };
  const actions = {
    tour() {
      if (tour) { stopTour(); return; }
      controls.enabled = false;
      controls.autoRotate = false;
      root.querySelector('[data-t3d-act="tour"]').setAttribute("aria-pressed", "true");
      const rock = spot("Piedra del Peñol", 2.6, 2.2, 3.6);
      const town = spot("Guatapé", -3.2, 2.4, 3.2);
      const pueblo = spot("El Peñol", 3.5, 3, -3.5);
      tour = gsap.timeline({ onComplete: stopTour })
        .add(fly({ x: 0, y: 26, z: 9 }, { x: -1.5, y: 0.6, z: -0.5 }, 2))
        .add(fly(...rock, 2.6), "+=0.4")
        .add(fly(...town, 2.4), "+=1.2")
        .add(fly(...pueblo, 2.8), "+=1.2")
        .add(fly(home.position, home.target, 2.6), "+=1.2");
    },
    in: () => dolly(0.75),
    out: () => dolly(1.3),
    reset() { stopTour(); fly(home.position, home.target, 1.6); },
  };
  root.querySelectorAll("[data-t3d-act]").forEach((button) => button.addEventListener("click", () => actions[button.dataset.t3dAct]()));
  renderer.domElement.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    dolly(event.deltaY > 0 ? 1.12 : 0.89);
  }, { passive: false });

  // Táctil: el modelo no captura el dedo hasta que la persona lo activa.
  const touch = !fine.matches;
  const activate = root.querySelector("[data-t3d-activate]");
  root.classList.toggle("is-touch", touch);
  controls.enabled = !touch;
  activate.addEventListener("click", () => {
    const on = !root.classList.contains("is-active");
    root.classList.toggle("is-active", on);
    controls.enabled = on;
    activate.textContent = on ? "Listo, volver al scroll" : "Tocar para explorar en 3D";
  });

  // Giro automático en reposo.
  let idle = 0;
  controls.addEventListener("start", () => { controls.autoRotate = false; idle = 0; stopTour(); });
  controls.addEventListener("end", () => { idle = performance.now(); });

  // Bucle de render solo cuando la escena está en pantalla.
  let visible = false;
  let running = false;
  const startTime = performance.now();
  function frame() {
    if (!visible) { running = false; return; }
    requestAnimationFrame(frame);
    const time = (performance.now() - startTime) / 1000;
    uniforms.uTime.value = reduce.matches ? 0 : time;
    uniforms.uProbe.value.z += (probeTarget - uniforms.uProbe.value.z) * 0.2;
    uniforms.uCam.value.copy(camera.position);
    if (!tour && !reduce.matches && idle && performance.now() - idle > 5000) controls.autoRotate = true;
    controls.update();
    compass.style.transform = `rotate(${(controls.getAzimuthalAngle() * 180) / Math.PI}deg)`;
    placeLabels();
    renderer.render(scene, camera);
  }
  function start() {
    if (running || !visible) return;
    running = true;
    requestAnimationFrame(frame);
  }
  let introPlayed = reduce.matches;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
    if (visible && !introPlayed && entry.intersectionRatio > 0.35) {
      introPlayed = true;
      gsap.timeline({ onComplete: () => { idle = performance.now(); } })
        .to(uniforms.uExag, { value: 2, duration: 2.4, ease: "expo.out" }, 0.1)
        .to(camera.position, { ...home.position, duration: 3.2, ease: "power3.inOut" }, 0)
        .to(uniforms.uReveal, { value: 1, duration: 1.6, ease: "power2.inOut" }, 1.3);
    }
  }, { threshold: [0, 0.35] }).observe(root);
  new ResizeObserver(resize).observe(host);
  resize();
  if (reduce.matches) { uniforms.uExag.value = 2; idle = 0; }
  root.classList.add("is-ready");
  status.textContent = "";
  start();
}
