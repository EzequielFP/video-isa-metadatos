# De Watts a Wow · Datos y fuentes

[Abre el portal de datos](https://ezequielfp.github.io/video-isa-metadatos/)

Material de consulta para los videos **El embalse que se llena con gas**, **Guardar el sol para la noche** y **La red que cruza fronteras**. El portal incluye gráficas interactivas, filtros por video y formato, muestras de tablas CSV y fichas con las fuentes.

- [Metadatos y metodología](metadatos/)
- [Catálogo CSV](metadatos/catalogo.csv) y [catálogo JSON](metadatos/catalogo.json)
- [Archivos descargables](archivos/)

## Enlazar las carpetas de Google Drive

Sube `VERSION_FINAL/VIDEO1`, `VERSION_FINAL/VIDEO2` y `VERSION_FINAL/VIDEO3` a Google Drive. En cada carpeta, configura el acceso que quieres dar a los visitantes. Para acceso público, elige **Cualquier persona con el enlace → Lector** y comprueba el enlace en una ventana privada.

Edita [metadatos/drive.json](metadatos/drive.json) y pega los tres enlaces dentro de `videos`, en las claves `"1"`, `"2"` y `"3"`. Al guardar el cambio en `main`, GitHub Pages actualiza los botones.

El bloque opcional `datos` acepta enlaces independientes para los GeoTIFF de mayor tamaño. Usa `"1"` para las exportaciones grandes del Video 1 y `"2-3"` para las dos capas VIIRS compartidas. Conserva sus nombres de archivo para que coincidan con las fichas.

## Ver localmente

Desde la raíz de este repositorio, ejecuta `python -m http.server 8000` y abre [localhost:8000](http://localhost:8000/). El portal usa HTML, CSS y JavaScript y se publica desde la raíz de `main` en GitHub Pages.
