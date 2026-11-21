// Mapa de corredores eléctricos entre Colombia y sus vecinos sobre un mapa base claro.
// Las líneas de OpenStreetMap se dibujan finas; el corredor elegido avanza con trazo animado.
import { canvasContext, fetchJson, palette } from "./util.js";

const routes = {
  ecuador: {
    title: "Jamondino–Pomasqui",
    description: "Corredor Colombia–Ecuador documentado a 230 kV. El límite de transferencia cambia con las condiciones operativas.",
    source: "https://www.xm.com.co/noticias/evento-en-el-sistema-interconectado-nacional",
    points: [[-77.26, 1.19], [-77.64, .83], [-78.12, .35], [-78.46, -.05]],
    color: palette.cobalt,
  },
  panama: {
    title: "Cerromatoso–Panamá II",
    description: "Proyecto de interconexión HVDC estudiado por Colombia y Panamá. La curva indica sus extremos de referencia.",
    source: "https://www.interconexioncp.com/descripcion-tecnica/",
    points: [[-75.50, 7.94], [-79.43, 9.10]],
    color: palette.coral,
    project: true,
  },
  venezuela: {
    title: "Cuestecitas–Cuatricentenario",
    description: "Corredor Colombia–Venezuela documentado en el diagnóstico técnico de UPME. El mapa muestra su ubicación regional de referencia.",
    source: "https://bdigital.upme.gov.co/bitstream/001/899/1/Informe%20final.pdf",
    points: [[-72.52, 11.23], [-71.71, 10.67]],
    color: "#7a2fd0",
  },
};

export async function setupRegion(root, { reduce }) {
  const canvas = root.querySelector("[data-region-map]");
  const status = root.querySelector("[data-region-status]");
  const text = root.querySelector("[data-route-description]");
  const heading = root.querySelector("[data-route-title]");
  const source = root.querySelector("[data-route-source]");
  const buttons = [...root.querySelectorAll("[data-route]")];
  let pathGroups = [];
  let selected = routes.ecuador;
  let dash = 0;
  let visible = false;

  function draw() {
    const box = canvasContext(canvas);
    if (!box) return;
    const { ctx, width, height } = box;
    // Extensión de la imagen base del proyecto de video: −84 a −62 de longitud, 16 a −8 de latitud.
    const project = ([lon, lat]) => [(lon + 84) * width / 22, (16 - lat) * height / 24];
    ctx.beginPath();
    ctx.strokeStyle = "rgba(25,116,74,.55)";
    ctx.lineWidth = 0.8;
    for (const group of pathGroups) {
      if (!group.length) continue;
      ctx.moveTo(...project(group[0]));
      for (let i = 1; i < group.length; i++) ctx.lineTo(...project(group[i]));
    }
    ctx.stroke();

    const origin = project(selected.points[0]);
    const destination = project(selected.points.at(-1));
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(...origin);
      if (selected.project) ctx.quadraticCurveTo((origin[0] + destination[0]) / 2, Math.min(origin[1], destination[1]) - width * .07, ...destination);
      else selected.points.slice(1).forEach((position) => ctx.lineTo(...project(position)));
    };
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 9;
    path();
    ctx.stroke();
    ctx.strokeStyle = selected.color;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -dash;
    path();
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of [origin, destination]) {
      ctx.fillStyle = selected.color;
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(...p, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.font = `700 ${width > 500 ? 13 : 10}px 'Azeret Mono', monospace`;
    ctx.textAlign = "center";
    for (const [label, lon, lat] of [["COLOMBIA", -73.6, 4], ["PANAMÁ", -80.6, 8.2],
      ["ECUADOR", -78.8, -1.6], ["VENEZUELA", -66.5, 7], ["PERÚ", -75.5, -5.6], ["BRASIL", -66.5, -1.5]]) {
      const p = project([lon, lat]);
      ctx.strokeStyle = "rgba(251,249,243,.95)";
      ctx.lineWidth = 4;
      ctx.strokeText(label, ...p);
      ctx.fillStyle = label === "COLOMBIA" ? palette.ink : palette.ink2;
      ctx.fillText(label, ...p);
    }
  }

  function tick() {
    if (!visible || reduce.matches) return;
    dash = (dash + 0.6) % 1000;
    draw();
    requestAnimationFrame(tick);
  }

  buttons.forEach((button) => button.addEventListener("click", () => {
    selected = routes[button.dataset.route];
    buttons.forEach((item) => item.setAttribute("aria-pressed", String(button === item)));
    heading.textContent = selected.title;
    text.textContent = selected.description;
    source.href = selected.source;
    draw();
  }));

  new ResizeObserver(draw).observe(canvas);
  new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting;
    if (visible && !wasVisible) requestAnimationFrame(tick);
  }).observe(canvas);
  draw();
  try {
    const { features } = await fetchJson("archivos/video-3/lineas_vecinos.geojson");
    pathGroups = features.flatMap(({ geometry }) => geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates);
    draw();
  } catch {
    status.textContent = "No se pudo cargar la capa de OpenStreetMap.";
  }
}
