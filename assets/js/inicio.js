// Cifras de la portada calculadas con los archivos publicados del atlas.
import { countUp } from "./app.js";
import { fetchJson, monthLabel } from "./util.js";

const percent = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export async function setupStats(root) {
  const stat = (key) => root.querySelector(`[data-stat="${key}"]`);
  const label = (key) => root.querySelector(`[data-stat-label="${key}"]`);
  const [pacific, volume, catalog] = await Promise.allSettled([
    fetchJson("assets/media/pacifico/serie.json"),
    fetchJson("assets/media/embalses/volumen.json"),
    fetchJson("metadatos/catalogo.json"),
  ]);
  if (pacific.status === "fulfilled") {
    const frames = pacific.value.frames;
    const peak = frames.reduce((best, frame) => (frame.value ?? -99) > (best.value ?? -99) ? frame : best);
    countUp(stat("nino"), peak.value, { decimals: 2, sign: true, suffix: "<small>°C</small>" });
    label("nino").textContent = monthLabel(peak.month);
    countUp(stat("meses"), frames.length);
  }
  if (volume.status === "fulfilled") {
    const { penol } = volume.value.periods;
    countUp(stat("penol"), penol["2026"], { decimals: 1, suffix: "<small>%</small>" });
    label("penol").textContent = `${percent.format(penol["2022"])} %`;
    root.querySelector("[data-stat-bar]").style.setProperty("--v", `${Math.min(penol["2026"], 100)}%`);
  }
  if (catalog.status === "fulfilled") countUp(stat("recursos"), catalog.value.length);
}
