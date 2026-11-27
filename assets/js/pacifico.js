import { canvasContext, clamp, fetchJson, monthLabel, palette, temperature } from "./util.js";

const directory = new URL("../media/pacifico/", import.meta.url);
const monthIndex = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
const oniColor = "#93949d";
const descriptions = {
  "2023-01": "En 2023, la anomalía pasa de valores negativos a un máximo en noviembre.",
  "2024-01": "La anomalía pierde fuerza durante 2024 y llega a valores negativos a comienzos de 2025.",
  "2026-01": "En 2026, la anomalía vuelve a ser positiva en marzo y aumenta hasta octubre.",
};

export async function setupPacific(root, { reduce: motion }) {
  const sticky = root.querySelector(".pacific-sticky");
  const layers = [...root.querySelectorAll("[data-sst-layer]")];
  const range = root.querySelector("[data-pacific-range]");
  const play = root.querySelector("[data-pacific-play]");
  const scroll = root.querySelector("[data-pacific-scroll]");
  const jumps = [...root.querySelectorAll("[data-pacific-jump]")];
  const phase = root.querySelector("[data-pacific-phase]");
  const value = root.querySelector("[data-pacific-value]");
  const date = root.querySelector("[data-pacific-date]");
  const days = root.querySelector("[data-pacific-days]");
  const graph = root.querySelector("[data-pacific-graph]");
  const historyButton = root.querySelector("[data-pacific-history]");
  const oniKey = root.querySelector("[data-pacific-oni]");
  const hint = root.querySelector("[data-pacific-hint]");
  const cache = new Map();
  let entries;
  let oni = [];
  let showHistory = true;
  let active = 0;
  let dissolve;
  let current = -1;
  let requested = -1;
  let timer;
  let sync = !motion.matches;
  let queued = false;

  function image(index) {
    if (!cache.has(index)) {
      const element = new Image();
      element.src = new URL(entries[index].image, directory).href;
      const loading = element.decode().then(() => element.src).catch((error) => {
        cache.delete(index);
        throw error;
      });
      cache.set(index, loading);
    }
    return cache.get(index);
  }

  function drawTrend() {
    if (current < 0) return;
    const sizing = canvasContext(graph);
    if (!sizing) return;
    const { ctx, width, height } = sizing;
    const full = showHistory && oni.length > 0;
    const first = monthIndex(full ? oni[0][0] : entries[0].month);
    const last = monthIndex(entries.at(-1).month);
    const x = (month) => 25 + (monthIndex(month) - first) * (width - 33) / (last - first);
    const y = (v) => 6 + (4 - v) / 7 * (height - 24);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = palette.muted;
    for (const v of [4, 2, 0, -2]) {
      ctx.strokeStyle = palette.rule;
      ctx.beginPath();
      ctx.moveTo(25, y(v));
      ctx.lineTo(width - 8, y(v));
      ctx.stroke();
      ctx.fillText(temperature.format(v), 2, y(v) + 3);
    }
    const firstYear = String(Math.floor(first / 12));
    ctx.fillText(firstYear, 25, height - 2);
    ctx.textAlign = "right";
    ctx.fillText(entries.at(-1).month.slice(0, 4), width - 8, height - 2);

    function trace(points, color, lineWidth) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let previous = null;
      for (const [month, anomaly] of points) {
        const index = monthIndex(month);
        if (index < first || index > last || anomaly === null) continue;
        if (previous === index - 1) ctx.lineTo(x(month), y(anomaly));
        else ctx.moveTo(x(month), y(anomaly));
        previous = index;
      }
      ctx.stroke();
    }

    trace(oni, oniColor, 1);
    trace(entries.map(({ month, value }) => [month, value]), palette.ink, 1.6);
    if (entries[current].value !== null) {
      ctx.fillStyle = entries[current].value < 0 ? palette.cobalt : palette.coral;
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x(entries[current].month), y(entries[current].value), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  async function select(index) {
    if (requested === index) return;
    requested = index;
    range.value = index;
    const entry = entries[index];
    const month = monthLabel(entry.month);
    range.setAttribute("aria-valuetext", month);
    try {
      const src = await image(index);
      if (requested !== index) return;
      dissolve?.cancel();
      const previous = layers[active];
      if (current !== -1) active = 1 - active;
      const next = layers[active];
      next.src = src;
      next.style.zIndex = "1";
      next.style.opacity = "1";
      if (previous !== next) {
        previous.style.zIndex = "0";
        if (!motion.matches) {
          dissolve = next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: "ease-out" });
          dissolve.onfinish = () => { previous.style.opacity = "0"; };
        } else {
          previous.style.opacity = "0";
        }
      }
      current = index;
      date.textContent = month[0].toUpperCase() + month.slice(1);
      value.textContent = entry.value === null ? "Sin datos" : `${temperature.format(entry.value)} °C`;
      value.dataset.tone = entry.value < 0 ? "cold" : "warm";
      if (entry.value !== null) root.style.setProperty("--heat", clamp((entry.value + 1) / 4.5, 0, 1).toFixed(3));
      days.textContent = `Media de ${entry.days} observaciones diarias.`;
      range.setAttribute("aria-valuetext", `${month}. ${value.textContent}`);
      const chapter = jumps.findLast((button) => button.dataset.phaseStart <= entry.month);
      jumps.forEach((button) => button.setAttribute("aria-pressed", button === chapter));
      phase.textContent = descriptions[chapter?.dataset.phaseStart] ?? "";
      drawTrend();
      for (const neighbor of [index + 1, index - 1]) {
        if (entries[neighbor]) image(neighbor).catch(() => {});
      }
    } catch {
      if (requested === index) {
        requested = -1;
        days.textContent = "No se pudo cargar el mapa de este mes.";
      }
    }
  }

  function onScroll() {
    if (!sync || !root.classList.contains("scroll-capable") || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!sync) return;
      const guide = parseFloat(getComputedStyle(sticky).top);
      const offset = guide - root.getBoundingClientRect().top;
      const travel = root.clientHeight - sticky.clientHeight;
      if (travel > 0) select(Math.round(clamp(offset / travel, 0, 1) * (entries.length - 1)));
    });
  }

  function updateCapabilities() {
    const header = document.querySelector("header").offsetHeight;
    const capable = !motion.matches && innerHeight > 670 && sticky.offsetHeight + header + 18 <= innerHeight;
    root.classList.toggle("scroll-capable", capable);
    scroll.hidden = !capable;
    scroll.disabled = !capable;
    scroll.setAttribute("aria-pressed", capable && sync);
    hint.textContent = capable
      ? "Sigue la mancha cálida en la franja ecuatorial. Desplázate por la página o mueve el control para cambiar de mes."
      : "Sigue la mancha cálida en la franja ecuatorial. Mueve el control o reproduce la secuencia para cambiar de mes.";
    if (capable) onScroll();
  }

  function syncToScroll(next) {
    sync = next;
    scroll.setAttribute("aria-pressed", sync);
    if (sync) onScroll();
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
    play.textContent = "Reproducir evolución";
    play.setAttribute("aria-pressed", "false");
  }

  try {
    ({ frames: entries } = await fetchJson(new URL("serie.json", directory)));
  } catch {
    days.textContent = "No se pudo abrir la secuencia. Puedes consultar los archivos originales debajo del mapa.";
    return;
  }

  range.max = entries.length - 1;
  range.disabled = false;
  play.disabled = false;
  play.setAttribute("aria-pressed", "false");
  function selectManually(index) {
    stop();
    syncToScroll(false);
    select(index);
  }
  range.addEventListener("input", () => selectManually(Number(range.value)));
  jumps.forEach((button) => {
    const index = entries.findIndex((item) => item.month === button.dataset.pacificJump);
    if (index < 0) return;
    button.disabled = false;
    button.addEventListener("click", () => selectManually(index));
  });
  play.addEventListener("click", () => {
    if (timer) {
      stop();
      return;
    }
    syncToScroll(false);
    if (requested >= entries.length - 1) select(0);
    play.textContent = "Pausar evolución";
    play.setAttribute("aria-pressed", "true");
    timer = setInterval(() => {
      if (requested !== current && requested !== -1) return;
      if (current >= entries.length - 1) stop();
      else select(current + 1);
    }, 260);
  });
  scroll.addEventListener("click", () => {
    stop();
    syncToScroll(!sync);
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateCapabilities);
  motion.addEventListener("change", updateCapabilities);
  new ResizeObserver(drawTrend).observe(graph);
  historyButton.addEventListener("click", () => {
    showHistory = !showHistory;
    historyButton.textContent = showHistory ? "Ver desde 2023" : "Ver desde 1981";
    drawTrend();
  });
  fetchJson(new URL("oni.json", directory)).then(({ values }) => {
    oni = values;
    historyButton.hidden = false;
    oniKey.hidden = false;
    drawTrend();
    updateCapabilities();
  }).catch(() => {});
  await select(0);
  updateCapabilities();
  document.fonts.ready.then(updateCapabilities);
}
