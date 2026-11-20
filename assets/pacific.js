import { canvasContext, clamp, fetchJson, monthLabel, temperature } from "./visual.js";

const directory = new URL("./media/pacifico/", import.meta.url);
const descriptions = {
  "2023-01": "En 2023, la anomalía pasa de valores negativos a un máximo en noviembre.",
  "2024-01": "La anomalía pierde fuerza durante 2024 y llega a valores negativos a comienzos de 2025.",
  "2026-01": "En 2026, la anomalía vuelve a ser positiva en marzo y aumenta hasta octubre.",
};

export async function setupPacific(root, motion) {
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
  const hint = root.querySelector("[data-pacific-hint]");
  const cache = new Map();
  let entries;
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
    const x = (i) => 4 + i * (width - 8) / (entries.length - 1);
    const y = (v) => 4 + (4 - v) / 7 * (height - 8);
    ctx.strokeStyle = "#ffffff40";
    ctx.beginPath();
    ctx.moveTo(0, y(0));
    ctx.lineTo(width, y(0));
    ctx.stroke();
    ctx.strokeStyle = "#ffb887";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let hasPrevious = false;
    entries.forEach((entry, i) => {
      if (entry.value !== null) {
        if (hasPrevious) ctx.lineTo(x(i), y(entry.value));
        else ctx.moveTo(x(i), y(entry.value));
      }
      hasPrevious = entry.value !== null;
    });
    ctx.stroke();
    if (entries[current].value !== null) {
      ctx.fillStyle = "#fff3d8";
      ctx.beginPath();
      ctx.arc(x(current), y(entries[current].value), 3, 0, Math.PI * 2);
      ctx.fill();
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
  await select(0);
  updateCapabilities();
  document.fonts.ready.then(updateCapabilities);
}
