# Metadatos de los cinco videos

[Portal interactivo](https://ezequielfp.github.io/video-isa-metadatos/) · [Catálogo CSV](catalogo.csv) · [Catálogo JSON](catalogo.json)

Cada ficha incluye título, video, descripción, formato, tipo de acceso y fuente. Cuando el archivo se sirve desde este repositorio, la ficha registra la ruta, el tamaño y el SHA-256. Las fichas CSV incluyen columnas y filas de datos. Las fichas GeoJSON incluyen el número de entidades. El campo `storage` indica descarga directa (`github`), enlace de Drive configurable (`drive`) o fuente original (`source`).

## Gráficas y cobertura

| Video | Archivo que alimenta la gráfica | Interpretación |
| --- | --- | --- |
| 1 · Embalses | [Volumen útil diario](../archivos/video-1/01_embalse_agregado_diario.csv) | `vol_util_pct` es el porcentaje de capacidad útil agregada del SIN; último dato al 9 de noviembre de 2026. |
| 2 · Solar y demanda | [Perfil del día tipo](../archivos/video-2/perfil_dia_tipo.csv) | Medias en MWh por hora de inicio, en hora de Colombia. Compara el año 2024 con octubre de 2026. Las columnas `n_*` indican los días con observación para cada serie. |
| 3 · Intercambios | [Intercambios mensuales](../archivos/video-3/intercambios_mensuales.csv) | `ExpoEner_GWh_observados` e `ImpoEner_GWh_observados` suman los flujos físicos disponibles. Las columnas terminadas en `_observados_dias` indican los días con algún dato. Noviembre de 2026 tiene datos físicos publicados hasta el día 8. |
| 4 · Costa | [Demanda por hora de cuatro mercados](../archivos/video-4/demanda_horaria_mercados_2024-01.csv) | Promedio por hora de la demanda comercial regulada de enero de 2024, en MWh y hora de Colombia. La página muestra cada curva en porcentaje de su propio máximo. |
| 4 · Costa | [Consumo, cobertura y calor por municipio](../archivos/video-4/municipios_consumo_cobertura_temperatura.csv) | `kwh_persona_dia` es el consumo residencial facturado de enero y febrero de 2024 dividido por la población del DANE. `temp_03h_C` es la media ERA5-Land de las 3 a. m. muestreada en la cabecera. `icee_pct` vacío significa sin dato. |
| 5 · Luz | [Distancia a la red y viviendas sin servicio](../archivos/video-5/municipios_distancia_subestacion.csv) | El 89,7 % es la suma de `viviendas_rurales_sin_servicio` de los municipios con `km_cabecera_subestacion` menor que 50, dividida por el total. |
| 5 · Luz | [Costo de la energía en 25 cabeceras](../archivos/video-5/cabeceras_hibrido_solar.csv) | Modelo propio hora por hora con la radiación de NASA POWER. `linea_COP_kWh` vacío significa que no se evaluó una línea a la red. |

Los campos vacíos se conservan. Para fechas y unidades de los demás archivos, consulta su ficha. Los documentos de referencia conservan el periodo de la edición citada.

## Procedencia

- XM · [Auditoría de la extracción horaria](xm-horario-auditoria.json) y [verificación de la entrega original](xm-horario-verificacion.json). La auditoría de esta publicación omite una ruta local. Para verificar los archivos publicados, usa los SHA-256 del catálogo.
- Earth Engine · [Script de exportación del Video 1](gee-video-1.js) y [script de los videos 2 y 3](gee-videos-2-3.js). En cada ficha se enlaza el producto de origen.
- Cartografía regional · [Procedencia de OpenStreetMap](../archivos/video-3/procedencia.json) y [verificación parcial](osm-verificacion-parcial.json). Las capas están bajo ODbL 1.0 y el inventario de subestaciones de Venezuela tiene cobertura parcial. [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright)

Los datos y documentos de terceros conservan los términos de sus respectivas fuentes.
