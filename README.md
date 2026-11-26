# De Watts a Wow · Atlas interactivo

[Abre el atlas](https://ezequielfp.github.io/video-isa-metadatos/)

La portada presenta la serie sobre un mapa topográfico vivo: las curvas de nivel son las del relieve real de Peñol–Guatapé y el cursor abre una linterna con la imagen Sentinel-2 de 2026. Debajo están el video final, los cinco capítulos y las cifras principales, calculadas en el navegador con los archivos publicados.

1. [El Niño y la luz](https://ezequielfp.github.io/video-isa-metadatos/agua.html). Cronología mensual del Pacífico, modelo 3D de Peñol–Guatapé con cortina 2022/2026 sobre el relieve, comparador Sentinel-2 con lupa y parpadeo, volumen útil de XM, una figura isométrica del embalse, la central hidráulica y la térmica movida por los datos mensuales, y series de lluvia, embalses y generación.
2. [Guardar el sol para la noche](https://ezequielfp.github.io/video-isa-metadatos/solar.html). Reloj horario de XM, comparador día y noche del Caribe y una figura isométrica interactiva de una batería de red del tamaño de La Arenosa.
3. [La red que cruza fronteras](https://ezequielfp.github.io/video-isa-metadatos/fronteras.html). Intercambios observados de XM, corredores regionales y contexto ecuatoriano.
4. [La costa no duerme](https://ezequielfp.github.io/video-isa-metadatos/costa.html). Reloj de 24 horas con la demanda de XM por mercado y columnas sobre el mapa, comparador de temperatura a las 3 a. m. y a las 2 p. m. (ERA5-Land), consumo por persona de 1.064 municipios en 3D, calor frente a consumo y cobertura, y el crecimiento 2021–2026.
5. [Seis horas de luz](https://ezequielfp.github.io/video-isa-metadatos/luz.html). Mapa nocturno de las 162 localidades con telemetría del IPSE que se encienden y apagan hora a hora, anillos alrededor de las 460 subestaciones de la UPME, lo que paga el usuario frente al subsidio, y el costo del diésel frente al híbrido solar en 25 cabeceras.

- [Catálogo de datos](https://ezequielfp.github.io/video-isa-metadatos/datos.html), también como [CSV](metadatos/catalogo.csv) y [JSON](metadatos/catalogo.json)
- [Metadatos y metodología](metadatos/)
- [Archivos descargables](archivos/)

Los enlaces antiguos a `./?video=N#catalogo` y a las escenas del primer capítulo en la raíz redirigen a las páginas nuevas.

## Agregar el video final

El reproductor vertical de la portada y de cada capítulo lee [metadatos/videos.json](metadatos/videos.json). La clave `final` es la portada; de `1` a `5` son los capítulos. Sin `src`, el reproductor muestra el aviso de video en edición.

```
python scripts/preparar_video.py <video editado.mp4> final --titulo "..." --descripcion "..."
```

Los videos 4 y 5 salen de `Nuevas_Ideas/VIDEOS_TERMINADOS/v2/04_La_costa_no_duerme.mp4` y `05_Seis_horas_de_luz.mp4` con la clave `4` o `5`.

El script usa ffmpeg para dejar el video a 720 px de ancho en H.264, con arranque rápido, guarda un póster y actualiza `videos.json`. GitHub rechaza archivos de más de 100 MB; si el resultado se acerca a ese límite, sube `--crf` (por ejemplo, a 27).

## Enlazar las carpetas de Google Drive

La carpeta de Drive se arma con `HERRAMIENTAS/organizar_drive.py` en `GRUPO_1/DE_WATTS_A_WOW_DRIVE` y se sincroniza con `H:/Mi unidad/DE_WATTS_A_WOW_DRIVE`. La carpeta raíz está compartida con **Cualquier persona con el enlace → Lector**, así que las subcarpetas heredan ese acceso. Comprueba cada enlace en una ventana privada.

Edita [metadatos/drive.json](metadatos/drive.json) y pega los enlaces de las carpetas `01_VIDEO_1…` a `05_VIDEO_5…` dentro de `videos`, en las claves de `"1"` a `"5"`. Los botones aparecen en la página de datos.

El bloque opcional `datos` acepta enlaces independientes para los GeoTIFF de mayor tamaño. Usa `"1"` para las exportaciones grandes del Video 1 (`06_DATOS/VIDEO_1`) y `"2-3"` para las dos capas VIIRS compartidas (`06_DATOS/VIDEOS_2_Y_3`).

## Ver localmente

Desde la raíz de este repositorio, ejecuta `python -m http.server 8000` y abre [localhost:8000](http://localhost:8000/). El sitio usa HTML, CSS y módulos de JavaScript sin paso de compilación y se publica desde la raíz de `main` en GitHub Pages.

## Estructura

- `assets/css/atlas.css`: sistema visual (papel claro, tinta, colores por capítulo y láminas con marcas de coordenadas).
- `assets/js/app.js`: scroll suave, cortinas de color entre páginas, revelado de títulos, marquesina, contadores, tarjetas apiladas y carga diferida de cada escena.
- `assets/js/topo.js`: portada en WebGL2 con curvas cada 25 m, maestras cada 100 m, barrido de altitud, lámina de agua y linterna satelital.
- `assets/js/terreno.js`: maqueta 3D con laterales estratificados, imagen 2022 o 2026, relieve hipsométrico, curvas de nivel, cortina antes/después, sonda de coordenadas, etiquetas y recorrido de cámara.
- `assets/js/comparador.js`: comparadores Sentinel-2, volumen útil semanal y tarjetas de Peñol–Guatapé, Guavio, Betania y Urrá.
- `assets/js/reproductor.js`, `pacifico.js`, `graficas.js`, `region.js`, `catalogo.js`, `inicio.js`: video, Pacífico, series, mapa regional, catálogo y cifras de la portada.
- `assets/js/costa.js`: escenas del capítulo 4 (reloj y mapa de demanda, waffle del calor, bosque 3D de municipios, dispersión calor-consumo y curvas de crecimiento).
- `assets/js/luz.js`: escenas del capítulo 5 (horario de las localidades, anillos de distancia a la red, subsidio y costo diésel frente a híbrido).
- `assets/js/mapa.js`: utilidades compartidas por los capítulos 4 y 5: proyección de Colombia en canvas, rótulos flotantes, interpolación horaria y bucles que solo corren con la escena en pantalla.

## Procedencia de las escenas

- [Terreno de Peñol–Guatapé](scripts/preparar_terreno.py). Recorta el mapa de alturas de 16 bits de la escena de Blender a la caja de la exportación Sentinel-2 de GEE (75,05–75,25° O, 6,15–6,36° N), lo guarda como rejilla de 400 × 420 y copia las composiciones de 2022 y 2026. También resume el volumen útil diario de XM por semana para los cuatro embalses del comparador. La lámina de agua se detecta en el navegador como la superficie casi plana alrededor de 1900 m del modelo de alturas.
- [Mapa regional claro](scripts/preparar_region.py). Recolorea el mapa base del Video 3.
- [Agua y térmica](scripts/figuras/central.mjs). Figura isométrica del capítulo 1 hecha con el mismo kit. Escribe `assets/figuras/central.js` con `node scripts/figuras/central.mjs`. Calcula los promedios mensuales de enero de 2023 a octubre de 2026 a partir de los archivos de XM del video 1 (volumen útil del SIN, aportes frente a la media histórica y generación por tecnología) y de la serie Niño 3.4, y se detiene si no coinciden con las cifras verificadas del guion. El nivel del agua es proporcional al volumen útil y una sola turbina representa toda la generación térmica.
- [Batería de red](scripts/figuras/bateria.mjs). Figura isométrica hecha con el kit de [Anatomy](https://github.com/wheresryan22/anatomy) (MIT, copiado en `scripts/figuras/kit`). Escribe `assets/figuras/bateria.js` con `node scripts/figuras/bateria.mjs`. Usa La Arenosa (45 MW / 45 MWh, UPME) y el perfil horario de XM de octubre de 2026: carga en las tres horas de más sol y entrega en la hora de más demanda; la operación es ilustrativa y sin pérdidas.
- [Exportación de Blender](scripts/exportar_penol.py). Renderiza la vista panorámica `penol-blender.jpg` de la escena original `vuelo_penol.blend`.
- [Cronología del Pacífico](scripts/preparar_pacifico.py). Genera 46 mapas de enero de 2023 a octubre de 2026 con las bandas del GeoTIFF OISST v2.1 y la costa de Natural Earth.
- [Capítulos 4 y 5](scripts/preparar_cap45.py). Lee las cifras verificadas de los videos (`Nuevas_Ideas/1_Consumo`, `Nuevas_Ideas/2_ZNI` y las capas de `VIDEO_v2`) y escribe `assets/datos/costa.json` y `luz.json`, las láminas comparativas, las portadas animadas a partir de los vuelos de Blender, los clips de Google Flow, las tablas de `archivos/video-4` y `archivos/video-5` y sus fichas en el catálogo. Se detiene si el consumo de Barranquilla y Soacha, el 89,7 % de viviendas a menos de 50 km de una subestación o el rango de temperaturas no coinciden con los videos. Con `--catalogo` solo rehace las tablas y las fichas.
- [Clips web](scripts/preparar_clips.py). Usa los renders de Blender del proyecto y dos clips de Google Flow de la producción original, identificados en las páginas como recreaciones generadas con IA.

## Librerías y créditos

- [Librerías empaquetadas](scripts/construir_vendor.mjs): Three.js 0.187.0 con OrbitControls (`three-lite.js`), GSAP 3.15.1 con ScrollTrigger y SplitText, y Lenis 1.3.27 para el scroll suave (`motion.js`). Se construyen con esbuild a partir de las copias locales de los repositorios. [Licencia estándar de GSAP](https://gsap.com/standard-license/) · [Licencia de Three.js](assets/vendor/three.LICENSE)
- Tipografías Overused Grotesk, Azeret Mono y Barlow Condensed, con licencia SIL OFL. Detalle en [assets/vendor/fonts](assets/vendor/fonts/LICENCIAS.txt).
- Efectos inspirados en [React Bits](https://reactbits.dev) (fondo Topography, ScrollVelocity, SplitText, Magnet, VariableProximity y ScrollStack), reescritos en JavaScript sin React.
- Música de los videos 4 y 5: «Artemis», de Scott Buckley, y «Run», de Kai Engel, ambas con licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). El crédito aparece en el pie de cada capítulo.
- Todo el movimiento respeta la preferencia de movimiento reducido del sistema.
