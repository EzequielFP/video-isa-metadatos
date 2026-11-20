import { readCsv } from "./csv.js";

const colors = ["#d0f47d", "#6cdbc4"];
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const daily = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const monthly = new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric", timeZone: "UTC" });
const day = (value) => daily.format(new Date(value));
const month = (value) => monthly.format(new Date(`${value}-01`));
const hour = (value) => `${value.padStart(2, "0")}:00`;
const asNumber = (value) => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : null;

const charts = {
  agua: {
    title: "Volumen útil de los embalses",
    file: "archivos/video-1/01_embalse_agregado_diario.csv",
    period: "2026",
    group: (row) => row.fecha.slice(0, 4),
    point: (row) => day(row.fecha),
    unit: "%",
    series: [{ label: "Volumen útil", field: "vol_util_pct" }],
    maximum: 100,
    step: 25,
    note: "Porcentaje de la capacidad útil del SIN. La serie llega al 9 de noviembre de 2026.",
  },
  solar: {
    title: "Generación solar y demanda",
    file: "archivos/video-2/perfil_dia_tipo.csv",
    period: "2026-10",
    periodLabel: { "2024": "2024", "2026-10": "Oct. 2026" },
    group: (row) => row.periodo,
    point: (row) => hour(row.hora),
    unit: "MWh",
    series: [
      { label: "Demanda", field: "demanda_MWh", coverage: "n_demanda_MWh" },
      { label: "Generación solar", field: "solar_MWh", coverage: "n_solar_MWh" },
    ],
    step: 3000,
    note: "Promedios por hora de Colombia. La disponibilidad de observaciones cambia según la hora y la variable.",
  },
  red: {
    title: "Intercambios internacionales",
    file: "archivos/video-3/intercambios_mensuales.csv",
    period: "2024",
    group: (row) => row.mes.slice(0, 4),
    point: (row) => month(row.mes),
    unit: "GWh",
    series: [
      { label: "Exportaciones", field: "ExpoEner_GWh_observados", coverage: "ExpoEner_GWh_observados_dias" },
      { label: "Importaciones", field: "ImpoEner_GWh_observados", coverage: "ImpoEner_GWh_observados_dias" },
    ],
    step: 100,
    note: "Totales físicos observados de XM. La cobertura cuenta días con al menos un dato. Noviembre de 2026 es parcial.",
  },
};

export function setupCharts() {
  const find = (id) => document.getElementById(id);
  const tabs = [...document.querySelectorAll("[data-chart]")];
  const period = find("chart-period");
  const canvas = find("chart");
  const plot = find("plot");
  const status = find("chart-status");
  const note = find("chart-note");
  const selector = find("chart-point");
  const values = find("chart-values");
  const cache = new Map();
  const selectedPeriods = new Map();
  let config = charts.agua;
  let grouped = new Map();
  let rows = [];
  let currentRequest = 0;
  const left = 44;
  const right = 10;

  function draw() {
    if (!rows.length) return;
    const width = plot.clientWidth;
    const height = plot.clientHeight;
    if (width <= left + right || height < 50) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = 13;
    const bottom = height - 22;
    const highest = Math.max(0, ...rows.flatMap((row) => config.series.map(({ field }) => asNumber(row[field]) ?? 0)));
    const step = Math.max(config.step, Math.ceil(highest / (config.step * 5)) * config.step);
    const maximum = config.maximum ?? Math.max(step, Math.ceil(highest / step) * step);
    const x = (i) => left + i / Math.max(1, rows.length - 1) * (width - left - right);
    const y = (v) => bottom - v / maximum * (bottom - top);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#c7ded3";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let tick = 0; tick <= maximum; tick += step) {
      const position = y(tick);
      ctx.strokeStyle = "#ffffff26";
      ctx.beginPath();
      ctx.moveTo(left, position);
      ctx.lineTo(width - right, position);
      ctx.stroke();
      ctx.fillText(number.format(tick), left - 5, position);
    }

    const tickCount = Math.min(width > 415 ? 5 : 3, rows.length);
    ctx.textBaseline = "top";
    for (let tick = 0; tick < tickCount; tick += 1) {
      const index = Math.round(tick / Math.max(1, tickCount - 1) * (rows.length - 1));
      ctx.textAlign = tick === 0 ? "left" : tick === tickCount - 1 ? "right" : "center";
      ctx.fillText(config.point(rows[index]), x(index), bottom + 6);
    }

    const selected = Number(selector.value);
    ctx.strokeStyle = "#eefbee82";
    ctx.beginPath();
    ctx.moveTo(x(selected), top);
    ctx.lineTo(x(selected), bottom);
    ctx.stroke();

    config.series.forEach(({ field }, index) => {
      ctx.strokeStyle = colors[index];
      ctx.lineWidth = 2.3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let previous = false;
      rows.forEach((row, i) => {
        const value = asNumber(row[field]);
        if (value !== null) {
          if (previous) ctx.lineTo(x(i), y(value));
          else ctx.moveTo(x(i), y(value));
        }
        previous = value !== null;
      });
      ctx.stroke();

      const current = asNumber(rows[selected][field]);
      if (current !== null) {
        ctx.fillStyle = colors[index];
        ctx.beginPath();
        ctx.arc(x(selected), y(current), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function selectPoint(index) {
    const row = rows[index];
    if (!row) return;
    selector.value = index;
    const date = document.createElement("strong");
    date.textContent = config.point(row);
    const series = config.series.map(({ label, field, coverage }) => {
      const element = document.createElement("span");
      const value = asNumber(row[field]);
      const count = coverage && asNumber(row[coverage]);
      let detail = value === null ? "sin dato" : `${number.format(value)} ${config.unit}`;
      if (count != null && count !== false) detail += ` · ${count} días`;
      element.textContent = `${label}: ${detail}`;
      return element;
    });
    values.replaceChildren(date, ...series);
    selector.setAttribute("aria-valuetext", [date, ...series].map((element) => element.textContent).join(". "));
    draw();
  }

  function choosePeriod() {
    selectedPeriods.set(config.file, period.value);
    rows = grouped.get(period.value) ?? [];
    selector.max = Math.max(0, rows.length - 1);
    selector.disabled = rows.length < 2;
    const solarPeak = config === charts.solar ? rows.findIndex((row) => row.hora === "18") : -1;
    selectPoint(solarPeak >= 0 ? solarPeak : rows.length - 1);
  }

  async function loadChart(key) {
    const request = ++currentRequest;
    config = charts[key];
    tabs.forEach((tab) => tab.setAttribute("aria-pressed", tab.dataset.chart === key));
    rows = [];
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    status.textContent = "Cargando datos de XM…";
    status.hidden = false;
    find("chart-title").textContent = config.title;
    find("chart-download").href = config.file;
    const legend = config.series.map(({ label }, index) => {
      const item = document.createElement("span");
      const chip = document.createElement("i");
      chip.style.backgroundColor = colors[index];
      item.append(chip, label);
      return item;
    });
    find("chart-legend").replaceChildren(...legend);
    values.replaceChildren();
    note.textContent = config.note;
    period.disabled = true;
    selector.disabled = true;

    try {
      if (!cache.has(key)) {
        const { headers, rows: rawRows } = await readCsv(config.file);
        cache.set(key, rawRows.map((row) => Object.fromEntries(headers.map((field, index) => [field, row[index]]))));
      }
      if (request !== currentRequest) return;
      grouped = new Map();
      for (const row of cache.get(key)) {
        const group = config.group(row);
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(row);
      }
      period.replaceChildren(...[...grouped.keys()].reverse().map((group) =>
        new Option(config.periodLabel?.[group] ?? group, group),
      ));
      period.value = selectedPeriods.get(config.file) ?? config.period;
      period.disabled = false;
      status.hidden = true;
      choosePeriod();
    } catch {
      if (request === currentRequest) status.textContent = "No se pudo cargar la gráfica. Puedes descargar el CSV.";
    }
  }

  function onPointer(event) {
    if (!rows.length) return;
    const x = (event.offsetX - left) / (canvas.clientWidth - left - right);
    selectPoint(Math.round(Math.max(0, Math.min(1, x)) * (rows.length - 1)));
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => loadChart(tab.dataset.chart)));
  period.addEventListener("change", choosePeriod);
  selector.addEventListener("input", () => selectPoint(Number(selector.value)));
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") onPointer(event);
  });
  canvas.addEventListener("pointerdown", onPointer);
  new ResizeObserver(draw).observe(plot);
  loadChart("agua");
}
