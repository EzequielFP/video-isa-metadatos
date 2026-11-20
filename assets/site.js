import { setupCharts } from "./charts.js";
import { readCsv } from "./csv.js";

const find = (id) => document.getElementById(id);
const list = find("results");
const search = find("search");
const filters = [find("video-filter"), find("format-filter"), find("access-filter")];
const clear = find("clear-filters");
const more = find("show-more");
const dialog = find("resource-dialog");
const preview = find("detail-preview");
const pageSize = 12;
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const formatLabel = (format) => ({ GEOJSON: "GeoJSON", GEOTIFF: "GeoTIFF", WEB: "Página web", SHP: "Shapefile ZIP" })[format] ?? format;
const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
let entries = [];
let drive = {};
let limit = pageSize;
let detailRequest = 0;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function link(label, url, { download = false, className = "" } = {}) {
  const node = element("a", label, className);
  node.href = url;
  if (download) node.download = "";
  return node;
}

async function readJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  return response.json();
}

function driveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com" ? url.href : "";
  } catch {
    return "";
  }
}

function resourceDrive(entry) {
  return driveUrl(drive.datos?.[entry.videos.join("-")]);
}

function primaryAction(entry, className) {
  if (entry.path) return link("Descargar", entry.path, { download: true, className });
  if (entry.storage === "source") return link("Abrir fuente", entry.sourceUrl, { className });
  const url = resourceDrive(entry);
  return url ? link("Abrir carpeta de datos", url, { className }) : null;
}

function resourceCard(entry) {
  const card = element("article", null, "resource");
  const title = element("h3", entry.title);
  const labels = entry.videos.length === 1 ? `Video ${entry.videos[0]}` : `Videos ${entry.videos.join(" y ")}`;
  card.append(
    element("p", `${labels} · ${formatLabel(entry.format)}`, "resource-type"),
    title,
    element("p", entry.description),
  );
  const actions = element("div", null, "resource-actions");
  const button = element("button", "Ver ficha", "link-button");
  button.type = "button";
  button.setAttribute("aria-label", `Ver ficha de ${entry.title}`);
  button.addEventListener("click", () => showDetail(entry));
  actions.append(button);
  const action = primaryAction(entry);
  actions.append(action ?? element("span", "Enlace de Drive pendiente", "storage-label"));
  card.append(actions);
  return card;
}

function filteredResults() {
  const [video, format, access] = filters.map((filter) => filter.value);
  const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  return entries.filter((entry) =>
    (!video || entry.videos.includes(Number(video))) &&
    (!format || entry.format === format) &&
    (!access || entry.storage === access) &&
    words.every((word) => entry.searchText.includes(word)),
  );
}

function render({ append = false } = {}) {
  const matched = filteredResults();
  const page = matched.slice(append ? list.children.length : 0, limit).map(resourceCard);
  if (append) list.append(...page);
  else list.replaceChildren(...page);
  const shown = Math.min(limit, matched.length);
  const summary = matched.length
    ? `Mostrando ${shown} de ${matched.length} ${matched.length === 1 ? "recurso" : "recursos"}.`
    : "Ningún recurso coincide con estos filtros.";
  find("result-count").textContent = summary;
  more.hidden = shown >= matched.length;
  more.textContent = `Mostrar ${Math.min(pageSize, matched.length - shown)} más`;
  clear.hidden = !search.value && filters.every((filter) => !filter.value);
  return page;
}

function resetPage() {
  limit = pageSize;
  render();
}

function sizeLabel(bytes) {
  const [value, unit] = bytes >= 1e9 ? [bytes / 1e9, "GB"]
    : bytes >= 1e6 ? [bytes / 1e6, "MB"] : [bytes / 1e3, "KB"];
  return `${number.format(value)} ${unit}`;
}

function showDetail(entry) {
  find("detail-type").textContent = formatLabel(entry.format);
  find("detail-title").textContent = entry.title;
  find("detail-description").textContent = entry.description;
  const fields = [
    ["Fuente", entry.source],
    ["Cobertura", entry.period],
    ["Archivo", entry.filename],
    ["Acceso", entry.path ? "Descarga directa" : entry.storage === "drive"
      ? (resourceDrive(entry) ? "Carpeta de datos en Drive" : "Enlace de Drive pendiente") : "Fuente original"],
    ["Tamaño", entry.bytes === undefined ? null : sizeLabel(entry.bytes)],
    ["Filas", entry.rows === undefined ? null : number.format(entry.rows)],
    ["Entidades", entry.features === undefined ? null : number.format(entry.features)],
    ["Columnas", entry.columns?.join(", ")],
    ["SHA-256", entry.sha256],
  ];
  find("detail-meta").replaceChildren(...fields.filter(([, value]) => value != null).flatMap(([label, value]) =>
    [element("dt", label), element("dd", value)],
  ));

  const notes = find("detail-notes");
  notes.textContent = entry.notes ?? "";
  notes.hidden = !entry.notes;
  const actions = find("detail-actions");
  const action = primaryAction(entry, "button primary");
  actions.replaceChildren(...(action ? [action] : []));
  if (entry.storage !== "source") actions.append(link("Consultar fuente", entry.sourceUrl));
  if (entry.format === "CSV" && entry.path) {
    const button = element("button", "Ver primeras filas", "link-button");
    button.type = "button";
    button.addEventListener("click", () => previewCsv(entry, button));
    actions.append(button);
  }
  preview.replaceChildren();
  preview.hidden = true;
  detailRequest += 1;
  dialog.showModal();
}

async function previewCsv(entry, button) {
  const request = ++detailRequest;
  button.disabled = true;
  const status = element("p", "Cargando muestra…");
  status.setAttribute("role", "status");
  preview.hidden = false;
  preview.replaceChildren(status);
  try {
    const { headers, rows } = await readCsv(entry.path, 8);
    if (request !== detailRequest || !dialog.open) return;
    const wrap = element("div", null, "table-wrap");
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-label", "Muestra desplazable del archivo");
    const table = element("table");
    const head = table.createTHead().insertRow();
    for (const header of headers) {
      const cell = element("th", header);
      cell.scope = "col";
      head.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      headers.forEach((_, index) => tr.append(element("td", row[index] || "—")));
    }
    wrap.append(table);
    status.textContent = `${rows.length} primeras filas`;
    preview.append(wrap);
  } catch {
    if (request === detailRequest) {
      status.textContent = "No se pudo abrir la muestra. La descarga sigue disponible.";
      button.disabled = false;
    }
  }
}

async function setupCatalog() {
  try {
    const data = await readJson("metadatos/catalogo.json");
    entries = data.map((entry) => ({
      ...entry,
      searchText: normalize([entry.title, entry.description, entry.source, entry.format, entry.filename, entry.period, ...(entry.columns ?? [])].filter(Boolean).join(" ")),
    }));
    const formats = [...new Set(entries.map((entry) => entry.format))];
    formats.sort((a, b) => formatLabel(a).localeCompare(formatLabel(b), "es"));
    filters[1].append(...formats.map((format) => new Option(formatLabel(format), format)));
    resetPage();
    search.addEventListener("input", resetPage);
    filters.forEach((filter) => filter.addEventListener("change", resetPage));
    clear.addEventListener("click", () => {
      search.value = "";
      filters.forEach((filter) => { filter.value = ""; });
      search.focus();
      resetPage();
    });
    more.addEventListener("click", () => {
      limit += pageSize;
      const newCards = render({ append: true });
      newCards[0]?.querySelector("button")?.focus({ preventScroll: true });
    });
    document.querySelectorAll("[data-video]").forEach((link) => {
      link.addEventListener("click", () => {
        search.value = "";
        filters[0].value = link.dataset.video;
        filters[1].value = "";
        filters[2].value = "";
        resetPage();
      });
    });
  } catch {
    find("result-count").textContent = "No se pudo cargar el catálogo. Puedes descargar el CSV o el JSON.";
  }
}

async function setupDrive() {
  try {
    drive = await readJson("metadatos/drive.json");
    document.querySelectorAll("[data-drive]").forEach((status) => {
      const url = driveUrl(drive.videos?.[status.dataset.drive]);
      if (url) status.replaceWith(link("Abrir carpeta de Drive", url));
    });
    if (entries.length) render();
  } catch {
    // El acceso a los archivos directos permanece disponible.
  }
}

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
setupCharts();
setupCatalog();
setupDrive();
