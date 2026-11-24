// Reproductor vertical. Lee metadatos/videos.json: cada clave ("final", "1", "2", "3")
// puede tener src, poster, titulo y descripcion. Sin src muestra el aviso de video en edición.
import { fetchJson } from "./util.js";

const icons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5v17l15-8.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h5v18H5zM14 3h5v18h-5z" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l6-5v16l-6-5H3z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l6-5v16l-6-5H3z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
};
const players = new Set();
let config = null;

function time(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export async function setupPlayer(root) {
  config ??= fetchJson("metadatos/videos.json").catch(() => ({}));
  const entry = (await config)[root.dataset.player] ?? {};
  const poster = entry.poster || root.dataset.poster || "assets/media/penol-blender.jpg";
  const text = document.querySelector(`[data-video-text="${root.dataset.player}"]`);
  if (entry.descripcion && text) text.textContent = entry.descripcion;

  if (!entry.src) {
    root.innerHTML = `<img class="poster" src="${poster}" alt=""><div class="player-empty"><span class="tag">En edición</span><strong>El video final llega pronto.</strong><p>Mientras tanto, recorre los capítulos y sus datos.</p></div>`;
    return;
  }

  root.classList.add("has-video");
  root.innerHTML = `
    <video playsinline preload="metadata" poster="${poster}"></video>
    <button class="player-big" type="button">${icons.play}<span>Reproducir</span><small data-big-time></small></button>
    <div class="player-bar">
      <button type="button" data-act="play" aria-label="Reproducir">${icons.play}</button>
      <input class="range" type="range" min="0" max="1000" value="0" step="1" aria-label="Posición del video">
      <span class="player-time" aria-hidden="true">0:00</span>
      <button type="button" data-act="mute" aria-label="Silenciar">${icons.sound}</button>
      <button type="button" data-act="full" aria-label="Pantalla completa">${icons.full}</button>
    </div>`;
  const video = root.querySelector("video");
  video.src = entry.src;
  if (entry.titulo) video.setAttribute("aria-label", entry.titulo);
  const big = root.querySelector(".player-big");
  const play = root.querySelector('[data-act="play"]');
  const mute = root.querySelector('[data-act="mute"]');
  const full = root.querySelector('[data-act="full"]');
  const seek = root.querySelector(".range");
  const clock = root.querySelector(".player-time");
  const duration = document.querySelector("[data-video-duration]");
  players.add(video);

  const toggle = () => (video.paused ? video.play() : video.pause());
  function paint() {
    const playing = !video.paused;
    root.classList.toggle("is-playing", playing);
    root.classList.toggle("is-paused-mid", !playing && video.currentTime > 0);
    play.innerHTML = playing ? icons.pause : icons.play;
    play.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  }
  function tick() {
    if (!seek.matches(":active")) seek.value = Math.round((video.currentTime / (video.duration || 1)) * 1000);
    seek.style.background = `linear-gradient(90deg, var(--accent) ${seek.value / 10}%, transparent 0)`;
    clock.textContent = `${time(video.currentTime)} / ${time(video.duration)}`;
    if (!video.paused) requestAnimationFrame(tick);
  }
  big.addEventListener("click", () => video.play());
  play.addEventListener("click", toggle);
  video.addEventListener("click", toggle);
  video.addEventListener("play", () => {
    for (const other of players) if (other !== video) other.pause();
    paint();
    tick();
  });
  video.addEventListener("pause", paint);
  video.addEventListener("ended", () => { video.currentTime = 0; paint(); tick(); });
  video.addEventListener("loadedmetadata", () => {
    if (duration) duration.textContent = time(video.duration);
    big.querySelector("[data-big-time]").textContent = time(video.duration);
    tick();
  });
  seek.addEventListener("input", () => {
    video.currentTime = (seek.value / 1000) * (video.duration || 0);
    tick();
  });
  mute.addEventListener("click", () => {
    video.muted = !video.muted;
    mute.innerHTML = video.muted ? icons.mute : icons.sound;
    mute.setAttribute("aria-label", video.muted ? "Activar sonido" : "Silenciar");
  });
  full.addEventListener("click", () => {
    if (document.fullscreenElement === root) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.();
  });
  // En pantalla completa el marco ocupa toda la pantalla (horizontal en PC): la clase is-full
  // hace que el video vertical se vea entero, sin recorte (ver .phone.is-full en atlas.css).
  document.addEventListener("fullscreenchange", () => root.classList.toggle("is-full", document.fullscreenElement === root));
  new IntersectionObserver(([item]) => { if (!item.isIntersecting) video.pause(); }, { threshold: 0.15 }).observe(root);
}
