# De Watts a Wow · Datos y fuentes

[Abre la serie interactiva](https://ezequielfp.github.io/video-isa-metadatos/)

Tres recorridos visuales con escenas de la producción, controles de tiempo, mapas y fuentes descargables.

1. [El Niño y la luz](https://ezequielfp.github.io/video-isa-metadatos/) reúne la cronología de temperatura del Pacífico, el terreno 3D de Peñol–Guatapé, un comparador Sentinel-2 y las series de lluvia, embalses y generación.
2. [Guardar el sol para la noche](https://ezequielfp.github.io/video-isa-metadatos/solar.html) combina las curvas de XM con un comparador del Caribe y una escena sobre el almacenamiento.
3. [La red que cruza fronteras](https://ezequielfp.github.io/video-isa-metadatos/fronteras.html) permite explorar los intercambios observados de XM, los corredores regionales y el contexto ecuatoriano.

- [Metadatos y metodología](metadatos/)
- [Catálogo CSV](metadatos/catalogo.csv) y [catálogo JSON](metadatos/catalogo.json)
- [Archivos descargables](archivos/)

## Enlazar las carpetas de Google Drive

Sube `VERSION_FINAL/VIDEO1`, `VERSION_FINAL/VIDEO2` y `VERSION_FINAL/VIDEO3` a Google Drive. En cada carpeta, configura el acceso que quieres dar a los visitantes. Para acceso público, elige **Cualquier persona con el enlace → Lector** y comprueba el enlace en una ventana privada.

Edita [metadatos/drive.json](metadatos/drive.json) y pega los tres enlaces dentro de `videos`, en las claves `"1"`, `"2"` y `"3"`. Al guardar el cambio en `main`, GitHub Pages actualiza los botones.

El bloque opcional `datos` acepta enlaces independientes para los GeoTIFF de mayor tamaño. Usa `"1"` para las exportaciones grandes del Video 1 y `"2-3"` para las dos capas VIIRS compartidas. Conserva sus nombres de archivo para que coincidan con las fichas.

## Ver localmente

Desde la raíz de este repositorio, ejecuta `python -m http.server 8000` y abre [localhost:8000](http://localhost:8000/). El portal usa HTML, CSS y JavaScript y se publica desde la raíz de `main` en GitHub Pages.

## Procedencia de las escenas

- [Exportación de Blender](scripts/exportar_penol.py). Abre la escena original `vuelo_penol.blend`, renderiza la vista panorámica y exporta una malla para navegador con el mismo desplazamiento, coordenadas UV y textura. Admite `--frames` para renderizar la secuencia del vuelo.
- [Cronología del Pacífico](scripts/preparar_pacifico.py). Genera 46 mapas de enero de 2023 a octubre de 2026 con las bandas del GeoTIFF OISST v2.1 y la costa de Natural Earth. El valor visible de cada mes es la media del CSV diario Niño 3.4. El cambio entre mapas conserva las fechas de observación.
- [Clips web](scripts/preparar_clips.py). Usa los renders de Blender del proyecto y dos clips de Google Flow de la producción original, identificados en las páginas como recreaciones generadas con IA.
- El visor utiliza Three.js 0.187.0 y la tipografía Barlow Condensed. Sus licencias están en [assets/vendor](assets/vendor/).
- Las transiciones de escena y el progreso del recorrido usan GSAP 3.15.1 con ScrollTrigger. El módulo se sirve desde el sitio y respeta la preferencia de movimiento reducido. [Licencia estándar de GSAP](https://gsap.com/standard-license/)
- La iluminación de los enlaces entre capítulos toma como referencia el efecto [Spotlight Card de React Bits](https://reactbits.dev/components/spotlight-card) y usa CSS y eventos del navegador.
