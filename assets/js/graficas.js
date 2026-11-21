import { canvasContext, clamp, dayLabel, monthLabel, number, numeric, palette, readCsv } from "./util.js";

const charts = {
  lluvia: {
    title: "Lluvia mensual en Colombia",
    file: "archivos/video-1/04_Lluvia_mensual_Colombia_vs_clima.csv",
    time: "mes", period: "2026", label: (row) => monthLabel(row.mes),
    unit: "mm", step: 100,
    series: [
      { field: "lluvia_mm", label: "Lluvia observada", color: palette.cobalt },
      { field: "clima_mm", label: "Promedio 1991–2020", color: palette.ink2, dash: [5, 5] },
    ],
    note: "CHIRPS · Comparación con el promedio del mismo mes. Los meses sin observación se muestran sin valor.",
  },
  embalses: {
    title: "Volumen útil de los embalses",
    file: "archivos/video-1/01_embalse_agregado_diario.csv",
    time: "fecha", period: "2026", label: (row) => dayLabel(row.fecha),
    unit: "%", step: 25, ceiling: 100,
    series: [{ field: "vol_util_pct", label: "Volumen útil nacional", color: palette.cobalt }],
    note: "XM · Porcentaje de la capacidad útil del SIN. Los datos publicados llegan al 9 de noviembre de 2026.",
  },
  generacion: {
    title: "Generación hidráulica y térmica",
    file: "archivos/video-1/05_generacion_por_tipo_diaria.csv",
    time: "fecha", period: "2026", label: (row) => dayLabel(row.fecha),
    unit: "GWh", step: 60,
    series: [
      { field: "HIDRAULICA", label: "Hidráulica", color: palette.cobalt },
      { field: "TERMICA", label: "Térmica", color: palette.coral },
    ],
    note: "XM · Energía diaria por tecnología. La categoría térmica incluye varios combustibles. La serie llega al 7 de noviembre de 2026.",
  },
  solar: {
    title: "Generación solar y demanda",
    file: "archivos/video-2/perfil_dia_tipo.csv",
    time: "periodo", period: "2026-10", periods: { "2024": "Año 2024", "2026-10": "Octubre de 2026" },
    label: (row) => `${row.hora.padStart(2, "0")}:00`,
    unit: "MWh", step: 3000, initial: 18,
    series: [
      { field: "demanda_MWh", label: "Demanda", color: palette.cobalt, coverage: "n_demanda_MWh" },
      { field: "solar_MWh", label: "Generación solar", color: "#f29a00", coverage: "n_solar_MWh" },
    ],
    note: "XM · Promedios por hora de Colombia. Los recuentos indican los días que aportaron observaciones.",
  },
  red: {
    title: "Intercambios internacionales",
    file: "archivos/video-3/intercambios_mensuales.csv",
    time: "mes", period: "2024", label: (row) => monthLabel(row.mes),
    unit: "GWh", step: 100, initial: 9, bars: true,
    series: [
      { field: "ExpoEner_GWh_observados", label: "Exportaciones", color: palette.cobalt, coverage: "ExpoEner_GWh_observados_dias" },
      { field: "ImpoEner_GWh_observados", label: "Importaciones", color: palette.lime, coverage: "ImpoEner_GWh_observados_dias" },
    ],
    note: "XM · Totales físicos observados. Noviembre de 2026 solo tiene datos publicados hasta el día 8.",
  },
};

const fileCache = new Map();
async function loadRows(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const { headers, rows } = await readCsv(file);
  const table = rows.map((row) => Object.fromEntries(headers.map((field, i) => [field, row[i]])));
  fileCache.set(file, table);
  return table;
}

export function setupObservatory(root) {
  const canvas = root.querySelector("[data-data-plot]");
  const title = root.querySelector("[data-data-title]");
  const select = root.querySelector("[data-data-year]");
  const range = root.querySelector("[data-data-range]");
  const values = root.querySelector("[data-data-values]");
  const note = root.querySelector("[data-data-note]");
  const modes = [...root.querySelectorAll("[data-mode]")];
  const months = [...root.querySelectorAll("[data-month]")];
  const left = 54;
  const right = 14;
  let config;
  let rows = [];
  let grouped = new Map();
  let request = 0;

  function draw() {
    if (!rows.length) return;
    const box = canvasContext(canvas);
    if (!box) return;
    const { ctx, width, height } = box;
    const bottom = height - 28;
    const top = 14;
    const content = width - left - right;
    const highest = Math.max(0, ...rows.flatMap((row) =>
      config.series.map(({ field }) => numeric(row[field]) ?? 0)));
    const step = Math.max(config.step, Math.ceil(highest / (config.step * 6)) * config.step);
    const ceiling = config.ceiling ?? Math.max(step, Math.ceil(highest / step) * step);
    const count = rows.length - (config.bars ? 0 : 1);
    const x = (index) => left + (index + (config.bars ? 0.5 : 0)) * content / Math.max(count, 1);
    const y = (datum) => bottom - datum * (bottom - top) / ceiling;
    const chosen = Number(range.value);

    ctx.font = "600 11px 'Azeret Mono', monospace";
    ctx.fillStyle = palette.ink2;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (let datum = 0; datum <= ceiling; datum += step) {
      ctx.fillText(number.format(datum), left - 7, y(datum));
      ctx.strokeStyle = palette.rule;
      ctx.beginPath();
      ctx.moveTo(left, y(datum));
      ctx.lineTo(width - right, y(datum));
      ctx.stroke();
    }
    const ticks = Math.min(width > 620 ? 6 : 3, rows.length);
    ctx.textBaseline = "top";
    for (let i = 0; i < ticks; i++) {
      const index = Math.round(i * (rows.length - 1) / Math.max(ticks - 1, 1));
      const row = rows[index];
      const label = config.time === "mes" ? config.label(row).split(" ")[0].slice(0, 3) : config.label(row);
      ctx.textAlign = i === 0 ? "left" : i === ticks - 1 ? "right" : "center";
      ctx.fillText(label, x(index), bottom + 8);
    }

    ctx.strokeStyle = palette.ink;
    ctx.beginPath();
    ctx.moveTo(x(chosen), top);
    ctx.lineTo(x(chosen), bottom);
    ctx.stroke();

    config.series.forEach(({ field, color, dash }, i) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = config.bars ? 1 : 2.3;
      if (config.bars) {
        const bar = Math.min(19, content / rows.length / 2.65);
        rows.forEach((row, j) => {
          const datum = numeric(row[field]);
          if (datum === null) return;
          ctx.globalAlpha = j === chosen ? 1 : 0.55;
          ctx.fillRect(x(j) + (i === 0 ? -bar - 1 : 1), y(datum), bar, bottom - y(datum));
          if (j === chosen) {
            ctx.strokeStyle = palette.ink;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x(j) + (i === 0 ? -bar - 1 : 1), y(datum), bar, bottom - y(datum));
          }
        });
        ctx.globalAlpha = 1;
        return;
      }

      ctx.setLineDash(dash ?? []);
      ctx.beginPath();
      let previous = false;
      rows.forEach((row, j) => {
        const datum = numeric(row[field]);
        if (datum !== null) {
          if (previous) ctx.lineTo(x(j), y(datum));
          else ctx.moveTo(x(j), y(datum));
        }
        previous = datum !== null;
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const datum = numeric(rows[chosen]?.[field]);
      if (datum !== null) {
        ctx.beginPath();
        ctx.arc(x(chosen), y(datum), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  function point(index) {
    const row = rows[index];
    if (!row) return;
    range.value = index;
    const stamp = document.createElement("strong");
    stamp.textContent = config.label(row);
    const details = config.series.map(({ field, label, coverage, color }) => {
      const datum = numeric(row[field]);
      const count = numeric(coverage && row[coverage]);
      const item = document.createElement("span");
      item.style.setProperty("--series", color);
      item.textContent = `${label}: ${datum === null ? "sin dato" : `${number.format(datum)} ${config.unit}`}`
        + (count === null ? "" : ` · ${count} días`);
      return item;
    });
    values.replaceChildren(stamp, ...details);
    range.setAttribute("aria-valuetext", [stamp, ...details].map((item) => item.textContent).join(". "));
    months.forEach((button) => button.setAttribute("aria-pressed", button.dataset.month === row.mes));
    draw();
  }

  function choosePeriod() {
    rows = grouped.get(select.value) ?? [];
    range.min = 0;
    range.max = Math.max(0, rows.length - 1);
    range.disabled = rows.length < 2;
    point(Math.min(config.initial ?? rows.length - 1, rows.length - 1));
  }

  async function load(key) {
    const current = ++request;
    config = charts[key];
    modes.forEach((button) => button.setAttribute("aria-pressed", button.dataset.mode === key));
    const selected = config;
    title.textContent = selected.title;
    note.replaceChildren();
    const download = document.createElement("a");
    download.href = selected.file;
    download.download = "";
    download.textContent = "Descargar CSV";
    note.append(selected.note, " ", download);
    rows = [];
    canvasContext(canvas);
    values.textContent = "Cargando datos…";
    select.disabled = true;
    range.disabled = true;
    months.forEach((button) => { button.disabled = true; });
    try {
      const table = await loadRows(selected.file);
      if (request !== current) return;
      grouped = new Map();
      for (const row of table) {
        const period = key === "solar" ? row[selected.time] : row[selected.time].slice(0, 4);
        if (!grouped.has(period)) grouped.set(period, []);
        grouped.get(period).push(row);
      }
      select.replaceChildren(...[...grouped.keys()].reverse().map((period) =>
        new Option(selected.periods?.[period] ?? period, period)));
      select.value = selected.period;
      select.disabled = false;
      months.forEach((button) => { button.disabled = false; });
      choosePeriod();
    } catch {
      if (request === current) values.textContent = "No se pudo cargar la gráfica. El CSV está disponible debajo.";
    }
  }

  select.addEventListener("change", choosePeriod);
  range.addEventListener("input", () => point(Number(range.value)));
  modes.forEach((button) => button.addEventListener("click", () => load(button.dataset.mode)));
  months.forEach((button) => button.addEventListener("click", () => {
    if (select.value !== "2024") {
      select.value = "2024";
      choosePeriod();
    }
    point(rows.findIndex((row) => row.mes === button.dataset.month));
  }));
  function pointer(event) {
    if (!rows.length) return;
    const ratio = clamp((event.offsetX - left) / (canvas.clientWidth - left - right), 0, 1);
    point(config.bars ? Math.min(rows.length - 1, Math.floor(ratio * rows.length)) : Math.round(ratio * (rows.length - 1)));
  }
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && (event.buttons & 1)) pointer(event);
  });
  canvas.addEventListener("pointerdown", pointer);
  new ResizeObserver(draw).observe(canvas);
  load(root.dataset.observatory === "agua" ? "lluvia" : root.dataset.observatory);
}
