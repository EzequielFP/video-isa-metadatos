import { AmbientLight, Color, DirectionalLight, GLTFLoader, OrbitControls, PerspectiveCamera,
  Scene, SRGBColorSpace, Vector3, WebGLRenderer } from "./vendor/three-web.js";

export async function openTerrain(root) {
  const host = root.querySelector("[data-terrain-screen]");
  const view = new Scene();
  view.background = new Color("#142937");
  const camera = new PerspectiveCamera(45, 1, 0.1, 180);
  camera.position.set(0.5, 10.2, 13.4);
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.outputColorSpace = SRGBColorSpace;

  let terrain;
  try {
    terrain = await new GLTFLoader().loadAsync(new URL("./media/penol.glb", import.meta.url).href);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const sun = new DirectionalLight("#fff5de", 2.2);
  sun.position.set(-8, 10, -5);
  view.add(terrain.scene, sun, new AmbientLight("#b9dcf8", 1.55));

  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "Modelo del embalse. Usa las flechas para girar, más o menos para cambiar el zoom.");
  host.append(renderer.domElement);
  host.hidden = false;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-1.3, 1.5, -1.5);
  controls.enablePan = false;
  controls.minDistance = 5.5;
  controls.maxDistance = 42;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.update();
  controls.saveState();

  function draw() { renderer.render(view, camera); }
  function resize() {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }
  controls.addEventListener("change", draw);
  new ResizeObserver(resize).observe(host);
  resize();

  const axes = {
    left: [new Vector3(0, 1, 0), 0.18], right: [new Vector3(0, 1, 0), -0.18],
    up: [new Vector3(1, 0, 0), -0.1], down: [new Vector3(1, 0, 0), 0.1],
  };
  const movements = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    "+": "in", "=": "in", "-": "out", Home: "reset" };
  function move(action) {
    if (action === "reset") {
      controls.reset();
      return;
    }
    const relative = camera.position.clone().sub(controls.target);
    if (axes[action]) relative.applyAxisAngle(...axes[action]);
    else relative.multiplyScalar(action === "in" ? 0.82 : 1.22);
    camera.position.copy(controls.target).add(relative);
    controls.update();
    draw();
  }

  renderer.domElement.addEventListener("keydown", (event) => {
    const action = movements[event.key];
    if (action) {
      event.preventDefault();
      move(action);
    }
  });
  root.querySelectorAll("[data-terrain-action]").forEach((button) => {
    button.addEventListener("click", () => move(button.dataset.terrainAction));
  });
  root.querySelector("[data-terrain-tools]").hidden = false;
  root.classList.add("model-ready");
  renderer.domElement.focus({ preventScroll: true });
}
