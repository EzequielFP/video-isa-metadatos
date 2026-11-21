# De Watts a Wow · Atlas interactivo

[Abre el atlas](https://ezequielfp.github.io/video-isa-metadatos/)

La portada presenta la serie sobre un mapa topográfico vivo: las curvas de nivel son las del relieve real de Peñol–Guatapé y el cursor abre una linterna con la imagen Sentinel-2 de 2026. Debajo están el video final, los tres capítulos y las cifras principales, calculadas en el navegador con los archivos publicados.

1. [El Niño y la luz](https://ezequielfp.github.io/video-isa-metadatos/agua.html). Cronología mensual del Pacífico, modelo 3D de Peñol–Guatapé con cortina 2022/2026 sobre el relieve, comparador Sentinel-2 con lupa y parpadeo, volumen útil de XM, una figura isométrica del embalse, la central hidráulica y la térmica movida por los datos mensuales, y series de lluvia, embalses y generación.
2. [Guardar el sol para la noche](https://ezequielfp.github.io/video-isa-metadatos/solar.html). Reloj horario de XM, comparador día y noche del Caribe y una figura isométrica interactiva de una batería de red del tamaño de La Arenosa.
3. [La red que cruza fronteras](https://ezequielfp.github.io/video-isa-metadatos/fronteras.html). Intercambios observados de XM, corredores regionales y contexto ecuatoriano.

- [Catálogo de datos](https://ezequielfp.github.io/video-isa-metadatos/datos.html), también como [CSV](metadatos/catalogo.csv) y [JSON](metadatos/catalogo.json)
- [Metadatos y metodología](metadatos/)
- [Archivos descargables](archivos/)

Los enlaces antiguos a `./?video=N#catalogo` y a las escenas del primer capítulo en la raíz redirigen a las páginas nuevas.

## Agregar el video final

El reproductor vertical de la portada y de cada capítulo lee [metadatos/videos.json](metadatos/videos.json). La clave `final` es la portada; `1`, `2` y `3` son los capítulos. Sin `src`, el reproductor muestra el aviso de video en edición.

```
python scripts/preparar_video.py <video editado.mp4> final --titulo "..." --descripcion "..."
```

El script usa ffmpeg para dejar el video a 720 px de ancho en H.264, con arranque rápido, guarda un póster y actualiza `videos.json`. GitHub rechaza archivos de más de 100 MB; si el resultado se acerca a ese límite, sube `--crf` (por ejemplo, a 27).

## Enlazar las carpetas de Google Drive

Sube `VERSION_FINAL/VIDEO1`, `VERSION_FINAL/VIDEO2` y `VERSION_FINAL/VIDEO3` a Google Drive. En cada carpeta, configura el acceso que quieres dar a los visitantes. Para acceso público, elige **Cualquier persona con el enlace → Lector** y comprueba el enlace en una ventana privada.

Edita [metadatos/drive.json](metadatos/drive.json) y pega los tres enlaces dentro de `videos`, en las claves `"1"`, `"2"` y `"3"`. Los botones aparecen en la página de datos.

El bloque opcional `datos` acepta enlaces independientes para los GeoTIFF de mayor tamaño. Usa `"1"` para las exportaciones grandes del Video 1 y `"2-3"` para las dos capas VIIRS compartidas.

## Ver localmente

Desde la raíz de este repositorio, ejecuta `python -m http.server 8000` y abre [localhost:8000](http://localhost:8000/). El sitio usa HTML, CSS y módulos de JavaScript sin paso de compilación y se publica desde la raíz de `main` en GitHub Pages.

## Estructura

- `assets/css/atlas.css`: sistema visual (papel claro, tinta, colores por capítulo y láminas con marcas de coordenadas).
- `assets/js/app.js`: scroll suave, cortinas de color entre páginas, revelado de títulos, marquesina, contadores, tarjetas apiladas y carga diferida de cada escena.
- `assets/js/topo.js`: portada en WebGL2 con curvas cada 25 m, maestras cada 100 m, barrido de altitud, lámina de agua y linterna satelital.
- `assets/js/terreno.js`: maqueta 3D con laterales estratificados, imagen 2022 o 2026, relieve hipsométrico, curvas de nivel, cortina antes/después, sonda de coordenadas, etiquetas y recorrido de cámara.
- `assets/js/comparador.js`: comparadores Sentinel-2, volumen útil semanal y tarjetas de Peñol–Guatapé, Guavio, Betania y Urrá.
- `assets/js/reproductor.js`, `pacifico.js`, `graficas.js`, `region.js`, `catalogo.js`, `inicio.js`: video, Pacífico, series, mapa regional, catálogo y cifras de la portada.

## Procedencia de las escenas

- [Terreno de Peñol–Guatapé](scripts/preparar_terreno.py). Recorta el mapa de alturas de 16 bits de la escena de Blender a la caja de la exportación Sentinel-2 de GEE (75,05–75,25° O, 6,15–6,36° N), lo guarda como rejilla de 400 × 420 y copia las composiciones de 2022 y 2026. También resume el volumen útil diario de XM por semana para los cuatro embalses del comparador. La lámina de agua se detecta en el navegador como la superficie casi plana alrededor de 1900 m del modelo de alturas.
- [Mapa regional claro](scripts/preparar_region.py). Recolorea el mapa base del Video 3.
- [Agua y térmica](scripts/figuras/central.mjs). Figura isométrica del capítulo 1 hecha con el mismo kit. Escribe `assets/figuras/central.js` con `node scripts/figuras/central.mjs`. Calcula los promedios mensuales de enero de 2023 a octubre de 2026 a partir de los archivos de XM del video 1 (volumen útil del SIN, aportes frente a la media histórica y generación por tecnología) y de la serie Niño 3.4, y se detiene si no coinciden con las cifras verificadas del guion. El nivel del agua es proporcional al volumen útil y una sola turbina representa toda la generación térmica.
- [Batería de red](scripts/figuras/bateria.mjs). Figura isométrica hecha con el kit de [Anatomy](https://github.com/wheresryan22/anatomy) (MIT, copiado en `scripts/figuras/kit`). Escribe `assets/figuras/bateria.js` con `node scripts/figuras/bateria.mjs`. Usa La Arenosa (45 MW / 45 MWh, UPME) y el perfil horario de XM de octubre de 2026: carga en las tres horas de más sol y entrega en la hora de más demanda; la operación es ilustrativa y sin pérdidas.
- [Exportación de Blender](scripts/exportar_penol.py). Renderiza la vista panorámica `penol-blender.jpg` de la escena original `vuelo_penol.blend`.
- [Cronología del Pacífico](scripts/preparar_pacifico.py). Genera 46 mapas de enero de 2023 a octubre de 2026 con las bandas del GeoTIFF OISST v2.1 y la costa de Natural Earth.
- [Clips web](scripts/preparar_clips.py). Usa los renders de Blender del proyecto y dos clips de Google Flow de la producción original, identificados en las páginas como recreaciones generadas con IA.

## Librerías y créditos

- [Librerías empaquetadas](scripts/construir_vendor.mjs): Three.js 0.187.0 con OrbitControls (`three-lite.js`), GSAP 3.15.1 con ScrollTrigger y SplitText, y Lenis 1.3.27 para el scroll suave (`motion.js`). Se construyen con esbuild a partir de las copias locales de los repositorios. [Licencia estándar de GSAP](https://gsap.com/standard-license/) · [Licencia de Three.js](assets/vendor/three.LICENSE)
- Tipografías Overused Grotesk, Azeret Mono y Barlow Condensed, con licencia SIL OFL. Detalle en [assets/vendor/fonts](assets/vendor/fonts/LICENCIAS.txt).
- Efectos inspirados en [React Bits](https://reactbits.dev) (fondo Topography, ScrollVelocity, SplitText, Magnet, VariableProximity y ScrollStack), reescritos en JavaScript sin React.
- Todo el movimiento respeta la preferencia de movimiento reducido del sistema.
