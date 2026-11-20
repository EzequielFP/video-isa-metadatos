import { setupPacific } from "./pacific.js";
import { setupObservatory } from "./charts.js";
import { setupRegion } from "./regional.js";
import { clamp, fetchJson } from "./visual.js";

const motion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");

function scrollFilm(hero) {
  const film = hero.querySelector("[data-scroll-video]");
  let queued = false;
  let desired = 0;

  function queue() {
    if (queued || motion.matches || hero.getBoundingClientRect().bottom < 0) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const top = hero.getBoundingClientRect().top;
      if (!film.src && -top > 12) {
        film.src = film.dataset.src;
        film.preload = "auto";
      }
      if (!Number.isFinite(film.duration)) return;
      desired = clamp(-top / (hero.offsetHeight * 0.63), 0, 0.98) * film.duration;
      seek();
    });
  }
  function seek() {
    if (!film.seeking && Math.abs(film.currentTime - desired) > 0.05) film.currentTime = desired;
  }
  film.addEventListener("loadedmetadata", queue);
  film.addEventListener("seeked", () => {
    if (!motion.matches) {
      film.classList.add("ready");
      seek();
    }
  });
  film.addEventListener("error", () => film.classList.remove("ready"));
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  hero.addEventListener("pointermove", (event) => {
    if (motion.matches || !finePointer.matches) return;
    const bounds = hero.getBoundingClientRect();
    hero.style.setProperty("--camera-x", `${(event.clientX / bounds.width - 0.5) * -1.4}%`);
    hero.style.setProperty("--camera-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * -1.4}%`);
  });
  hero.addEventListener("pointerleave", () => {
    hero.style.removeProperty("--camera-x");
    hero.style.removeProperty("--camera-y");
  });
  motion.addEventListener("change", () => {
    if (motion.matches) film.classList.remove("ready");
    else queue();
  });
  queue();
}

function setupTerrain(root) {
  const button = root.querySelector("[data-terrain-open]");
  const status = root.querySelector("[data-terrain-status]");
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Cargando relieve y textura…";
    try {
      const { openTerrain } = await import("./terrain.js");
      await openTerrain(root);
      status.textContent = "";
    } catch {
      status.textContent = "El modelo no se pudo abrir en este navegador. La imagen de Blender sigue disponible.";
      button.disabled = false;
    }
  });
}

function setupBattery() {
  const diagram = document.querySelector("[data-battery-visual]");
  if (!diagram) return;
  const buttons = [...document.querySelectorAll("[data-battery]")];
  const label = document.querySelector("[data-battery-state]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const stage = button.dataset.battery;
      buttons.forEach((item) => item.setAttribute("aria-pressed", item === button));
      diagram.dataset.batteryVisual = stage;
      label.textContent = stage === "carga" ? "La batería absorbe energía de la red para guardarla."
        : "La batería devuelve a la red parte de la energía que almacenó.";
    });
  });
}

async function setupDrive() {
  try {
    const { videos } = await fetchJson("metadatos/drive.json");
    for (const placeholder of document.querySelectorAll("[data-drive]")) {
      const url = URL.parse(videos?.[placeholder.dataset.drive] || "");
      if (url?.protocol === "https:" && url.hostname === "drive.google.com") {
        const link = document.createElement("a");
        link.className = "button primary";
        link.href = url.href;
        link.textContent = "Abrir carpeta de Drive";
        placeholder.replaceWith(link);
      }
    }
  } catch {
    // The other chapter links remain available independently of Drive.
  }
}

document.querySelectorAll("[data-hero]").forEach(scrollFilm);
document.querySelectorAll("[data-pacific]").forEach((root) => setupPacific(root, motion));
document.querySelectorAll("[data-terrain]").forEach(setupTerrain);
document.querySelectorAll("[data-observatory]").forEach(setupObservatory);
document.querySelectorAll("[data-region]").forEach(setupRegion);
document.querySelectorAll("[data-compare]").forEach((root) => {
  const slider = root.querySelector('input[type="range"]');
  slider.addEventListener("input", () => root.style.setProperty("--position", `${slider.value}%`));
});
setupBattery();
setupDrive();
