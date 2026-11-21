// Núcleo del atlas: scroll suave, cortinas entre páginas, revelados, contadores
// y carga diferida de cada escena interactiva.
import { gsap, ScrollTrigger, SplitText, Lenis } from "../vendor/motion.js";
import { clamp, geoLabel } from "./util.js";

gsap.registerPlugin(ScrollTrigger, SplitText);
const html = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const motionOk = () => !reduce.matches;
html.classList.toggle("no-motion", reduce.matches);
html.classList.remove("no-js");

/* ---------- Scroll suave ---------- */
let lenis = null;
if (motionOk()) {
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
export const scroller = { lenis, gsap, ScrollTrigger, motionOk, fine };
window.atlas = scroller;

function topOffset() {
  return document.querySelector(".topbar")?.offsetHeight ?? 64;
}
function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { offset: -topOffset() + 1, duration: 1.4 });
  else target.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto" });
}

/* ---------- Cortina entre páginas ---------- */
const themes = {
  "index.html": { color: "#13141a", ink: "#f2eee4", num: "00", label: "Portada" },
  "agua.html": { color: "#2b3bff", ink: "#ffffff", num: "01", label: "Agua · El Niño y la luz" },
  "solar.html": { color: "#ffc21c", ink: "#13141a", num: "02", label: "Sol · Guardar el sol" },
  "fronteras.html": { color: "#c8f04c", ink: "#13141a", num: "03", label: "Red · Cruzar fronteras" },
  "datos.html": { color: "#13141a", ink: "#f2eee4", num: "→", label: "Datos abiertos" },
};
const curtain = document.createElement("div");
curtain.className = "curtain";
curtain.setAttribute("aria-hidden", "true");
curtain.innerHTML = "<span></span>".repeat(5);
const curtainLabel = document.createElement("div");
curtainLabel.className = "curtain-label";
curtainLabel.setAttribute("aria-hidden", "true");
document.body.append(curtain, curtainLabel);
const panels = [...curtain.children];

function pageOf(url) {
  const name = url.pathname.split("/").pop();
  return name === "" ? "index.html" : name;
}
function paintCurtain(theme) {
  curtain.style.setProperty("--curtain", theme.color);
  curtainLabel.style.setProperty("--curtain-ink", theme.ink);
  curtainLabel.innerHTML = `<span class="num"></span><small></small>`;
  curtainLabel.querySelector(".num").textContent = theme.num;
  curtainLabel.querySelector("small").textContent = theme.label;
}

function arrive() {
  let theme = null;
  try { theme = JSON.parse(sessionStorage.getItem("atlas-cortina") || "null"); } catch { /* sin almacenamiento */ }
  try { sessionStorage.removeItem("atlas-cortina"); } catch { /* sin almacenamiento */ }
  if (!theme || !motionOk()) {
    html.classList.remove("is-arriving");
    return;
  }
  paintCurtain(theme);
  gsap.set(panels, { scaleY: 1, transformOrigin: "50% 0%" });
  gsap.set(curtainLabel, { opacity: 1 });
  html.classList.remove("is-arriving");
  gsap.timeline({ delay: 0.12 })
    .to(curtainLabel, { opacity: 0, y: -30, duration: 0.45, ease: "power2.in" })
    .to(panels, { scaleY: 0, duration: 0.8, ease: "expo.inOut", stagger: 0.06 }, "<0.1");
}

function leave(url) {
  const theme = themes[pageOf(url)] ?? themes["index.html"];
  try { sessionStorage.setItem("atlas-cortina", JSON.stringify(theme)); } catch { /* sin almacenamiento */ }
  paintCurtain(theme);
  lenis?.stop();
  gsap.set(panels, { transformOrigin: "50% 100%" });
  gsap.timeline({ onComplete: () => { location.href = url.href; } })
    .fromTo(panels, { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: "expo.inOut", stagger: 0.05 })
    .fromTo(curtainLabel, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, "-=0.3");
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.target && link.target !== "_self") return;
  if (link.hasAttribute("download")) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  const samePage = url.pathname === location.pathname && url.search === location.search;
  if (samePage && url.hash) {
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) {
      event.preventDefault();
      history.pushState(null, "", url.hash);
      scrollToTarget(target);
      closeMenu();
    }
    return;
  }
  if (!/\.html$|\/$/.test(url.pathname) || !motionOk()) return;
  event.preventDefault();
  leave(url);
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    gsap.set(panels, { scaleY: 0 });
    gsap.set(curtainLabel, { opacity: 0 });
    lenis?.start();
  }
});

/* ---------- Barra superior, menú y progreso ---------- */
const topbar = document.querySelector(".topbar");
const menuButton = topbar?.querySelector(".menu-btn");
function closeMenu() {
  topbar?.classList.remove("menu-open");
  menuButton?.setAttribute("aria-expanded", "false");
}
menuButton?.addEventListener("click", () => {
  const open = !topbar.classList.contains("menu-open");
  topbar.classList.toggle("menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});
let lastY = scrollY;
function onScroll() {
  const y = scrollY;
  topbar?.classList.toggle("is-solid", y > 30 || !document.querySelector(".hero-topo, .ch-hero"));
  if (topbar && !topbar.classList.contains("menu-open")) topbar.classList.toggle("is-hidden", y > 420 && y > lastY + 2);
  if (y < lastY - 2) topbar?.classList.remove("is-hidden");
  lastY = y;
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();
const bar = document.createElement("div");
bar.className = "progress";
bar.innerHTML = "<span></span>";
document.body.append(bar);
gsap.to(bar.firstChild, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

/* ---------- Lectura de coordenadas en la barra ---------- */
const readout = document.querySelector("[data-geo-readout]");
const homeGeo = (document.body.dataset.geo || "").split(",").map(Number);
function showGeo({ lat, lon, elev } = {}) {
  if (!readout) return;
  if (lat === undefined) [lat, lon] = homeGeo;
  if (!Number.isFinite(lat)) return;
  const [la, lo] = geoLabel(lat, lon);
  readout.innerHTML = `<span><b>${la}</b></span><span><b>${lo}</b></span>` + (elev ? `<span>${Math.round(elev).toLocaleString("es-CO")} m</span>` : "");
}
addEventListener("atlas:geo", (event) => showGeo(event.detail));
showGeo();

/* ---------- Revelados ---------- */
function setupReveals() {
  if (!motionOk()) return;
  for (const el of document.querySelectorAll("[data-split]")) {
    const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-line" });
    gsap.from(split.lines, {
      yPercent: 108, duration: 1.05, ease: "expo.out", stagger: 0.09,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  }
  for (const el of document.querySelectorAll("[data-reveal]")) {
    gsap.fromTo(el, { opacity: 0, y: 36 }, {
      opacity: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  }
  for (const el of document.querySelectorAll("[data-parallax]")) {
    const amount = Number(el.dataset.parallax) || 12;
    gsap.fromTo(el, { yPercent: -amount }, { yPercent: amount, ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
  }
}
if (!motionOk()) document.querySelectorAll("[data-reveal]").forEach((el) => { el.style.opacity = 1; });

/* ---------- Títulos de portada: letras que suben y peso variable con el cursor ---------- */
function setupHeroTitle() {
  const title = document.querySelector("[data-hero-title]");
  if (!title) return;
  const split = SplitText.create(title.querySelectorAll(".row"), { type: "chars", charsClass: "char" });
  if (motionOk()) {
    gsap.from(split.chars, { yPercent: 115, rotate: 6, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.035, delay: 0.25 });
  }
  if (!fine.matches || !motionOk()) return;
  const chars = split.chars;
  const base = chars.map((char) => Number(getComputedStyle(char).fontWeight) || 860);
  let pointer = null;
  title.closest("section").addEventListener("pointermove", (event) => { pointer = [event.clientX, event.clientY]; });
  title.closest("section").addEventListener("pointerleave", () => { pointer = null; });
  gsap.ticker.add(() => {
    chars.forEach((char, i) => {
      const box = char.getBoundingClientRect();
      let target = base[i];
      if (pointer) {
        const d = Math.hypot(pointer[0] - (box.left + box.width / 2), pointer[1] - (box.top + box.height / 2));
        target = base[i] - clamp(1 - d / 260, 0, 1) * (base[i] - 320);
      }
      const now = Number(char.dataset.w || base[i]);
      const next = now + (target - now) * 0.14;
      if (Math.abs(next - now) > 0.4) {
        char.dataset.w = next;
        char.style.fontVariationSettings = `"wght" ${next.toFixed(0)}`;
      }
    });
  });
}

/* ---------- Botones magnéticos ---------- */
function setupMagnets() {
  if (!fine.matches || !motionOk()) return;
  for (const el of document.querySelectorAll("[data-magnet]")) {
    const strength = Number(el.dataset.magnet) || 0.3;
    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, .45)" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, .45)" });
    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      x((event.clientX - box.left - box.width / 2) * strength);
      y((event.clientY - box.top - box.height / 2) * strength);
    });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  }
}

/* ---------- Marquesina que responde a la velocidad del scroll ---------- */
function setupMarquees() {
  for (const root of document.querySelectorAll("[data-marquee]")) {
    const track = root.querySelector(".marquee-track");
    const item = track.firstElementChild;
    const copies = Math.max(2, Math.ceil((innerWidth * 2) / Math.max(item.offsetWidth, 1)));
    for (let i = 1; i < copies; i++) {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.append(clone);
    }
    if (!motionOk()) continue;
    const speed = Number(root.dataset.marquee) || 60;
    let offset = 0;
    let direction = 1;
    gsap.ticker.add((_, delta) => {
      const velocity = lenis ? lenis.velocity : 0;
      if (Math.abs(velocity) > 0.2) direction = Math.sign(velocity);
      const boost = clamp(Math.abs(velocity) * 0.6, 0, 22);
      offset -= direction * (speed + boost * 60) * (delta / 1000);
      const width = item.offsetWidth;
      if (width) offset = ((offset % width) - width) % width;
      track.style.transform = `translate3d(${offset}px,0,0)`;
    });
  }
}

/* ---------- Contadores ---------- */
export function countUp(el, value, { decimals = 0, prefix = "", suffix = "", sign = false } = {}) {
  const format = new Intl.NumberFormat("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, signDisplay: sign ? "exceptZero" : "auto" });
  const paint = (v) => { el.innerHTML = `${prefix}${format.format(v)}${suffix}`; };
  if (!motionOk()) { paint(value); return; }
  const state = { v: 0 };
  paint(0);
  ScrollTrigger.create({
    trigger: el, start: "top 92%", once: true,
    onEnter: () => gsap.to(state, { v: value, duration: 2, ease: "power3.out", onUpdate: () => paint(state.v) }),
  });
}
function setupCounters() {
  for (const el of document.querySelectorAll("[data-count]")) {
    countUp(el, Number(el.dataset.count), { decimals: Number(el.dataset.decimals || 0), prefix: el.dataset.prefix || "", suffix: el.dataset.suffix || "" });
  }
}

/* ---------- Tarjetas apiladas ---------- */
function setupStack() {
  if (!motionOk()) return;
  const cards = [...document.querySelectorAll(".stack-card")];
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.92, filter: "brightness(.82)", ease: "none",
      scrollTrigger: { trigger: next, start: "top bottom", end: "top top+=120", scrub: true },
    });
  });
}

/* ---------- Portada de capítulo que se expande ---------- */
function setupChapterHero() {
  const hero = document.querySelector("[data-expand]");
  if (!hero) return;
  const media = hero.querySelector(".ch-hero-media");
  const rows = hero.querySelectorAll(".ch-hero-title h1 .row");
  const kicker = hero.querySelector(".ch-hero-title .kicker");
  const sub = hero.querySelector(".ch-hero-sub");
  const film = hero.querySelector("video[data-src]");
  if (!motionOk()) {
    media.style.setProperty("--shade", 1);
    return;
  }
  const start = getComputedStyle(hero);
  const state = { cy: Number(start.getPropertyValue("--clip-y0")) || 31, cx: Number(start.getPropertyValue("--clip-x0")) || 28, r: 0, scale: 1.18, shade: 0 };
  const apply = () => {
    media.style.setProperty("--clip-y", `${state.cy}%`);
    media.style.setProperty("--clip-x", `${state.cx}%`);
    media.style.setProperty("--clip-r", `${state.r}px`);
    media.style.setProperty("--media-scale", state.scale);
    media.style.setProperty("--shade", state.shade);
  };
  apply();
  gsap.from(rows, { yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.12, delay: 0.3 });
  gsap.from(media, { opacity: 0, scale: 0.9, duration: 1.4, ease: "expo.out", delay: 0.15 });
  const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom bottom", scrub: 0.6 } });
  tl.to(state, { cy: 0, cx: 0, scale: 1, shade: 1, duration: 1, ease: "power2.inOut", onUpdate: apply }, 0)
    .to(rows[0], { xPercent: -60, opacity: 0, duration: 0.8, ease: "power2.in" }, 0.05)
    .to(rows[1], { xPercent: 60, opacity: 0, duration: 0.8, ease: "power2.in" }, 0.05)
    .to(kicker, { opacity: 0, duration: 0.3 }, 0)
    .fromTo(sub, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35 }, 0.75);
  if (!film) return;
  let loaded = false;
  ScrollTrigger.create({
    trigger: hero, start: "top top", end: "bottom bottom",
    onUpdate: (self) => {
      if (!loaded && self.progress > 0.01) {
        loaded = true;
        film.src = film.dataset.src;
        film.preload = "auto";
        film.addEventListener("loadeddata", () => film.classList.add("ready"), { once: true });
      }
      if (Number.isFinite(film.duration) && !film.seeking) film.currentTime = clamp(self.progress, 0, 0.98) * film.duration;
    },
  });
}

/* ---------- Escenas que se cargan al acercarse ---------- */
const FIGURES = {
  bateria: () => import("../figuras/bateria.js"),
  central: () => import("../figuras/central.js"),
};
const scenes = [
  ["[data-topo]", () => import("./topo.js"), "setupTopo"],
  ["[data-terrain3d]", () => import("./terreno.js"), "setupTerrain"],
  ["[data-compare]", () => import("./comparador.js"), "setupCompare"],
  ["[data-reservoirs]", () => import("./comparador.js"), "setupReservoirs"],
  ["[data-volume]", () => import("./comparador.js"), "setupVolume"],
  ["[data-player]", () => import("./reproductor.js"), "setupPlayer"],
  ["[data-pacific]", () => import("./pacifico.js"), "setupPacific"],
  ["[data-observatory]", () => import("./graficas.js"), "setupObservatory"],
  ["[data-region]", () => import("./region.js"), "setupRegion"],
  ["[data-catalog]", () => import("./catalogo.js"), "setupCatalog"],
  ["[data-home-stats]", () => import("./inicio.js"), "setupStats"],
  ["[data-figure]", (el) => FIGURES[el.dataset.figure]?.(), "setupFigure"],
];
function loadScenes() {
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      near.unobserve(entry.target);
      const { loader, name } = entry.target.__scene;
      Promise.resolve(loader(entry.target)).then((module) => module[name](entry.target, { reduce, fine, lenis }))
        .catch((error) => console.error(name, error))
        .finally(() => ScrollTrigger.refresh());
    }
  }, { rootMargin: "120% 0px" });
  for (const [selector, loader, name] of scenes) {
    for (const el of document.querySelectorAll(selector)) {
      el.__scene = { loader, name };
      near.observe(el);
    }
  }
}

arrive();
setupHeroTitle();
setupMarquees();
setupChapterHero();
setupStack();
setupMagnets();
loadScenes();
document.fonts.ready.then(() => {
  setupReveals();
  setupCounters();
  ScrollTrigger.refresh();
});
let bodyHeight = 0;
let refreshTimer = 0;
new ResizeObserver(([entry]) => {
  const height = Math.round(entry.contentRect.height);
  if (Math.abs(height - bodyHeight) < 3) return;
  bodyHeight = height;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
}).observe(document.body);
if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) setTimeout(() => scrollToTarget(target), 400);
}
