// Comparadores Sentinel-2 (cortina, parpadeo y lupa), volumen útil semanal de XM
// y tarjetas de los cuatro embalses.
import { canvasContext, clamp, fetchJson, palette } from "./util.js";

const pct = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const weekFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
let volumeData = null;
const loadVolume = () => (volumeData ??= fetchJson("assets/media/embalses/volumen.json"));

const handleIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';

function curtain(root, onChange) {
  const view = root.querySelector(".cmp-view");
  const input = root.querySelector('input[type="range"]');
  const set = (value) => {
    const position = clamp(value, 0, 100);
    root.style.setProperty("--pos", `${position}%`);
    if (input) {
      input.value = position;
      input.setAttribute("aria-valuetext", `${Math.round(position)} % de la imagen de 2022 visible`);
    }
    onChange?.(position);
  };
  const fromEvent = (event) => {
    const box = view.getBoundingClientRect();
    set(((event.clientX - box.left) / box.width) * 100);
  };
  let dragging = false;
  view.addEventListener("pointerdown", (event) => {
    if (root.dataset.mode === "blink") return;
    dragging = true;
    view.setPointerCapture(event.pointerId);
    fromEvent(event);
  });
  view.addEventListener("pointermove", (event) => {
    if (dragging || (root.dataset.hover === "true" && event.pointerType === "mouse")) fromEvent(event);
  });
  const stop = () => { dragging = false; };
  view.addEventListener("pointerup", stop);
  view.addEventListener("pointercancel", stop);
  input?.addEventListener("input", () => set(Number(input.value)));
  return set;
}

export function setupCompare(root) {
  const view = root.querySelector(".cmp-view");
  const lens = root.querySelector(".cmp-lens");
  const [bottom, top] = view.querySelectorAll("img");
  root.querySelector(".cmp-handle b").innerHTML = handleIcon;
  let position = 50;
  const set = curtain(root, (value) => { position = value; });
  set(50);

  root.querySelectorAll("[data-cmp-mode]").forEach((button, _, all) => button.addEventListener("click", () => {
    root.dataset.mode = button.dataset.cmpMode;
    all.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  }));

  const zoom = 3;
  const lensButton = root.querySelector("[data-cmp-lens]");
  let lensOn = false;
  lensButton?.addEventListener("click", () => {
    lensOn = !lensOn;
    lensButton.setAttribute("aria-pressed", String(lensOn));
    if (!lensOn) lens.classList.remove("on");
  });
  view.addEventListener("pointermove", (event) => {
    if (!lensOn || event.pointerType !== "mouse") return;
    const box = view.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    const showTop = root.dataset.mode === "blink" ? getComputedStyle(top).opacity > 0.5 : (x / box.width) * 100 < position;
    lens.classList.add("on");
    lens.style.left = `${x}px`;
    lens.style.top = `${y}px`;
    lens.style.backgroundImage = `url("${(showTop ? top : bottom).currentSrc}")`;
    lens.style.backgroundSize = `${box.width * zoom}px ${box.height * zoom}px`;
    lens.style.backgroundPosition = `${-x * zoom + 95}px ${-y * zoom + 95}px`;
  });
  view.addEventListener("pointerleave", () => lens.classList.remove("on"));
}

function drawSeries(canvas, series, { highlight = [], marker = null, compact = false } = {}) {
  const box = canvasContext(canvas);
  if (!box || !series.length) return null;
  const { ctx, width, height } = box;
  const left = compact ? 2 : 38, right = compact ? 2 : 10, top = compact ? 4 : 12, bottom = compact ? 4 : 24;
  const start = Date.parse(series[0][0]), end = Date.parse(series.at(-1)[0]);
  const ceiling = 110;
  const x = (date) => left + ((Date.parse(date) - start) / (end - start)) * (width - left - right);
  const y = (value) => top + (1 - value / ceiling) * (height - top - bottom);
  for (const [from, to, color] of highlight) {
    ctx.fillStyle = color;
    ctx.fillRect(x(from), top, Math.max(2, x(to) - x(from)), height - top - bottom);
  }
  if (!compact) {
    ctx.font = "600 10px 'Azeret Mono', monospace";
    ctx.fillStyle = palette.ink2;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const value of [0, 25, 50, 75, 100]) {
      ctx.strokeStyle = value === 100 ? "rgba(19,20,26,.45)" : palette.rule;
      ctx.setLineDash(value === 100 ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(left, y(value));
      ctx.lineTo(width - right, y(value));
      ctx.stroke();
      ctx.fillText(`${value} %`, left - 6, y(value));
    }
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let year = new Date(start).getUTCFullYear() + 1; year <= new Date(end).getUTCFullYear(); year++) {
      ctx.fillText(String(year), x(`${year}-01-01`), height - bottom + 7);
    }
  }
  ctx.beginPath();
  series.forEach(([date, value], i) => (i ? ctx.lineTo(x(date), y(value)) : ctx.moveTo(x(date), y(value))));
  ctx.strokeStyle = palette.cobalt;
  ctx.lineWidth = compact ? 1.4 : 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  if (marker) {
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x(marker[0]), top);
    ctx.lineTo(x(marker[0]), height - bottom);
    ctx.stroke();
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(x(marker[0]), y(marker[1]), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  return { left, right, width };
}

const bands = [["2022-06-01", "2022-12-31", "rgba(22,191,174,.22)"], ["2026-08-01", "2026-10-31", "rgba(255,91,58,.24)"]];

export async function setupVolume(root) {
  const key = root.dataset.volume;
  const data = await loadVolume();
  const series = data.series[key];
  const canvas = root.querySelector("canvas");
  const dateLabel = root.querySelector("[data-vol-date]");
  const valueLabel = root.querySelector("[data-vol-value]");
  for (const period of ["2022", "2026"]) {
    const el = document.querySelector(`[data-vol="${period}"]`);
    if (el) el.innerHTML = `${pct.format(data.periods[key][period])}<small>%</small>`;
  }
  let marker = null;
  let geometry = null;
  const draw = () => { geometry = drawSeries(canvas, series, { highlight: bands, marker }); };
  function pick(event) {
    if (!geometry) return;
    const box = canvas.getBoundingClientRect();
    const ratio = clamp((event.clientX - box.left - geometry.left) / (geometry.width - geometry.left - geometry.right), 0, 1);
    marker = series[Math.round(ratio * (series.length - 1))];
    dateLabel.textContent = `Semana del ${weekFormat.format(new Date(`${marker[0]}T00:00:00Z`))}`;
    valueLabel.textContent = `${pct.format(marker[1])} %`;
    draw();
  }
  canvas.addEventListener("pointermove", pick);
  canvas.addEventListener("pointerdown", pick);
  new ResizeObserver(draw).observe(canvas);
  draw();
}

const reservoirs = [
  { key: "penol", name: "Peñol–Guatapé", region: "Antioquia", a: "assets/media/penol/s2-2022.webp", b: "assets/media/penol/s2-2026.webp" },
  { key: "guavio", name: "Guavio", region: "Cundinamarca", a: "assets/media/embalses/guavio-2022.webp", b: "assets/media/embalses/guavio-2026.webp" },
  { key: "betania", name: "Betania", region: "Huila", a: "assets/media/embalses/betania-2022.webp", b: "assets/media/embalses/betania-2026.webp" },
  { key: "urra", name: "Urrá", region: "Córdoba", a: "assets/media/embalses/urra-2022.webp", b: "assets/media/embalses/urra-2026.webp" },
];

export async function setupReservoirs(root) {
  const data = await loadVolume();
  for (const item of reservoirs) {
    const card = document.createElement("article");
    card.className = "res-card";
    card.innerHTML = `
      <div class="cmp" data-hover="true">
        <div class="cmp-view">
          <img src="${item.b}" alt="" loading="lazy">
          <img class="cmp-top" src="${item.a}" alt="" loading="lazy">
          <span class="cmp-handle" aria-hidden="true"><i></i><b>${handleIcon}</b></span>
        </div>
      </div>
      <div class="res-body">
        <h4></h4>
        <p class="fine"></p>
        <div class="res-vals"><span class="a"></span><span aria-hidden="true">→</span><span class="b"></span></div>
        <canvas class="res-spark" aria-hidden="true"></canvas>
      </div>`;
    card.querySelector("h4").textContent = item.name;
    card.querySelector(".fine").textContent = `${item.region} · Sentinel-2 2022 / 2026`;
    const periods = data.periods[item.key];
    card.querySelector(".a").textContent = `${pct.format(periods["2022"])} %`;
    card.querySelector(".b").textContent = `${pct.format(periods["2026"])} %`;
    card.querySelector(".res-vals").setAttribute("aria-label", `Volumen útil medio: ${pct.format(periods["2022"])} % en junio a diciembre de 2022 y ${pct.format(periods["2026"])} % en agosto a octubre de 2026`);
    const imgs = card.querySelectorAll("img");
    imgs[0].alt = `${item.name}, agosto a octubre de 2026`;
    imgs[1].alt = `${item.name}, junio a diciembre de 2022`;
    root.append(card);
    const set = curtain(card.querySelector(".cmp"));
    set(50);
    card.querySelector(".cmp-view").addEventListener("pointerleave", () => set(50));
    const spark = card.querySelector(".res-spark");
    const series = data.series[item.key];
    new ResizeObserver(() => drawSeries(spark, series, { highlight: bands, compact: true })).observe(spark);
  }
}
