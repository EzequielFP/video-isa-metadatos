// Empaqueta las librerías de terceros que usa el sitio en dos módulos ES
// minificados, a partir de copias locales de los repositorios.
//
//   node scripts/construir_vendor.mjs <carpeta Diseno_WEB> <ruta a esbuild>
//
// <carpeta Diseno_WEB> contiene GSAP-master, lenis-main y three.js-dev.
// esbuild se instala aparte (npm install esbuild) y no forma parte del sitio.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [repos, esbuild] = process.argv.slice(2).map((value) => resolve(value));
if (!repos || !esbuild) {
  console.error("Uso: node scripts/construir_vendor.mjs <carpeta Diseno_WEB> <ruta a esbuild>");
  process.exit(1);
}
const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = join(site, "assets", "vendor");
const temp = join(site, "scripts", ".vendor-entradas");
mkdirSync(temp, { recursive: true });
const posix = (path) => path.replaceAll("\\", "/");

const gsap = posix(join(repos, "GSAP-master", "esm"));
const lenis = posix(join(repos, "lenis-main", "packages", "core", "index.ts"));
const three = posix(join(repos, "three.js-dev", "src", "Three.js"));
const orbit = posix(join(repos, "three.js-dev", "examples", "jsm", "controls", "OrbitControls.js"));

const entries = {
  "motion.js": `
export { gsap } from "${gsap}/index.js";
export { ScrollTrigger } from "${gsap}/ScrollTrigger.js";
export { SplitText } from "${gsap}/SplitText.js";
export { default as Lenis } from "${lenis}";
`,
  "three-lite.js": `
export { WebGLRenderer, Scene, PerspectiveCamera, Vector2, Vector3, PlaneGeometry, BufferGeometry,
  BufferAttribute, Mesh, Group, ShaderMaterial, TextureLoader, LinearMipmapLinearFilter,
  ClampToEdgeWrapping, DoubleSide, NoToneMapping, Raycaster } from "${three}";
export { OrbitControls } from "${orbit}";
`,
};

for (const [name, source] of Object.entries(entries)) {
  const entry = join(temp, name);
  writeFileSync(entry, source);
  execFileSync(esbuild, [
    entry, "--bundle", "--format=esm", "--minify", "--target=es2020",
    `--alias:three=${three}`, "--legal-comments=inline",
    `--outfile=${join(vendor, name)}`,
  ], { stdio: "inherit" });
}
rmSync(temp, { recursive: true, force: true });
