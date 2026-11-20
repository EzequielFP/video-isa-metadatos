import { canvasContext, fetchJson } from "./visual.js";

const routes = {
  ecuador: {
    title: "Jamondino–Pomasqui",
    description: "Corredor Colombia–Ecuador documentado a 230 kV. El límite de transferencia cambia con las condiciones operativas.",
    source: "https://www.xm.com.co/noticias/evento-en-el-sistema-interconectado-nacional",
    points: [[-77.26, 1.19], [-77.64, .83], [-78.12, .35], [-78.46, -.05]],
    color: "#accffb",
  },
  panama: {
    title: "Cerromatoso–Panamá II",
    description: "Proyecto de interconexión HVDC estudiado por Colombia y Panamá. La curva indica sus extremos de referencia.",
    source: "https://www.interconexioncp.com/descripcion-tecnica/",
    points: [[-75.50, 7.94], [-79.43, 9.10]],
    color: "#ffca7e",
    project: true,
  },
  venezuela: {
    title: "Cuestecitas–Cuatricentenario",
    description: "Corredor Colombia–Venezuela documentado en el diagnóstico técnico de UPME. El mapa muestra su ubicación regional de referencia.",
    source: "https://bdigital.upme.gov.co/bitstream/001/899/1/Informe%20final.pdf",
    points: [[-72.52, 11.23], [-71.71, 10.67]],
    color: "#f5b3a9",
  },
};

export async function setupRegion(root) {
  const canvas = root.querySelector("[data-region-map]");
  const status = root.querySelector("[data-region-status]");
  const text = root.querySelector("[data-route-description]");
  const heading = root.querySelector("[data-route-title]");
  const source = root.querySelector("[data-route-source]");
  const buttons = [...root.querySelectorAll("[data-route]")];
  let pathGroups = [];
  let selected = routes.ecuador;

  function draw() {
    const box = canvasContext(canvas);
    if (!box) return;
    const { ctx, width, height } = box;
    // Extent of the regional base image from the video project.
    const project = ([lon, lat]) => [(lon + 84) * width / 22, (16 - lat) * height / 24];
    ctx.beginPath();
    ctx.strokeStyle = "#72d3b454";
    ctx.lineWidth = 0.75;
    for (const group of pathGroups) {
      if (!group.length) continue;
      ctx.moveTo(...project(group[0]));
      for (let i = 1; i < group.length; i++) ctx.lineTo(...project(group[i]));
    }
    ctx.stroke();

    const origin = project(selected.points[0]);
    const destination = project(selected.points.at(-1));
    ctx.strokeStyle = selected.color;
    ctx.lineWidth = 2.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(...origin);
    if (selected.project) ctx.quadraticCurveTo((origin[0] + destination[0]) / 2, Math.min(origin[1], destination[1]) - width * .07, ...destination);
    else selected.points.slice(1).forEach((position) => ctx.lineTo(...project(position)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = selected.color;
    for (const p of [origin, destination]) {
      ctx.beginPath();
      ctx.arc(...p, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = `700 ${width > 500 ? 13 : 10}px system-ui`;
    ctx.fillStyle = "#e3eefa";
    for (const [label, lon, lat] of [["Colombia", -74.2, 4], ["Panamá", -81.8, 9.8],
      ["Ecuador", -80.8, -1.7], ["Venezuela", -69.5, 8.4], ["Perú", -76, -5.9]]) {
      const p = project([lon, lat]);
      ctx.strokeStyle = "#0a1925";
      ctx.lineWidth = 3;
      ctx.strokeText(label, ...p);
      ctx.fillText(label, ...p);
    }
  }

  buttons.forEach((button) => button.addEventListener("click", () => {
    selected = routes[button.dataset.route];
    buttons.forEach((item) => item.setAttribute("aria-pressed", button === item));
    heading.textContent = selected.title;
    text.textContent = selected.description;
    source.href = selected.source;
    draw();
  }));

  new ResizeObserver(draw).observe(canvas);
  draw();
  try {
    const { features } = await fetchJson("archivos/video-3/lineas_vecinos.geojson");
    pathGroups = features.flatMap(({ geometry }) => geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates);
    draw();
  } catch {
    status.textContent = "No se pudo cargar la capa de OpenStreetMap.";
  }
}
