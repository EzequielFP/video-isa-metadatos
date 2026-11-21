"""Prepara el terreno de Peñol–Guatapé y las imágenes de los embalses para el sitio.

    python scripts/preparar_terreno.py <carpeta VIDEO_ISA>

Entradas (dentro del proyecto de producción):
- PRODUCCION_3D/blender/data/penol_height.png: alturas de 16 bits de la escena de Blender,
  caja -75,30 a -75,00 de longitud y 6,10 a 6,40 de latitud, de 1003,09 a 2572,20 m.
- VIDEO1/PRODUCCION/proyecto/assets/s2_penol_{antes,ahora}.webp: composiciones Sentinel-2
  de la exportación 08 de GEE, caja -75,25 a -75,05 y 6,15 a 6,36.
- VIDEO1/PRODUCCION/proyecto/assets/s2_thumb_*.webp: miniaturas de los otros embalses.
- archivos/video-1/03_embalses_individuales.csv: volumen útil diario de XM.

Salidas en assets/media/penol y assets/media/embalses:
- altura.bin: rejilla Uint16 little-endian recortada a la caja de Sentinel-2.
- penol.json: tamaño de la rejilla, caja, rango de alturas y lugares de referencia.
- s2-2022.webp y s2-2026.webp: las dos composiciones para el comparador y el modelo 3D.
- volumen.json: media semanal del volumen útil de cuatro embalses desde 2019.
"""

from pathlib import Path
import csv
import json
import shutil
import sys
from collections import defaultdict
from datetime import date

import numpy as np
from PIL import Image

root = Path(sys.argv[1]).resolve()
site = Path(__file__).resolve().parents[1]
out = site / "assets" / "media" / "penol"
reservoirs_out = site / "assets" / "media" / "embalses"
out.mkdir(parents=True, exist_ok=True)
reservoirs_out.mkdir(parents=True, exist_ok=True)

# Caja completa de la escena de Blender y caja de la exportación Sentinel-2.
FULL = (-75.30, 6.10, -75.00, 6.40)
CROP = (-75.25, 6.15, -75.05, 6.36)
ELEV = (1003.0921630859375, 2572.197509765625)
GRID = (400, 420)

height = np.array(Image.open(root / "PRODUCCION_3D/blender/data/penol_height.png")).astype(np.float64)
per_degree = height.shape[1] / (FULL[2] - FULL[0])
x0, x1 = round((CROP[0] - FULL[0]) * per_degree), round((CROP[2] - FULL[0]) * per_degree)
y0, y1 = round((FULL[3] - CROP[3]) * per_degree), round((FULL[3] - CROP[1]) * per_degree)
meters = ELEV[0] + height[y0:y1, x0:x1] / 65535 * (ELEV[1] - ELEV[0])

grid = np.array(Image.fromarray(meters.astype(np.float32)).resize(GRID, Image.BILINEAR), dtype=np.float64)
low, high = float(grid.min()), float(grid.max())
encoded = np.round((grid - low) / (high - low) * 65535).astype("<u2")
(out / "altura.bin").write_bytes(encoded.tobytes())


def locate(lon, lat, search=0):
    """Fila y columna de la rejilla; con search busca el punto más alto cercano."""
    col = (lon - CROP[0]) / (CROP[2] - CROP[0]) * (GRID[0] - 1)
    row = (CROP[3] - lat) / (CROP[3] - CROP[1]) * (GRID[1] - 1)
    r, c = int(round(row)), int(round(col))
    if search:
        window = grid[r - search:r + search + 1, c - search:c + search + 1]
        dr, dc = np.unravel_index(np.argmax(window), window.shape)
        r, c = r - search + dr, c - search + dc
    lon = CROP[0] + c / (GRID[0] - 1) * (CROP[2] - CROP[0])
    lat = CROP[3] - r / (GRID[1] - 1) * (CROP[3] - CROP[1])
    return round(lon, 5), round(lat, 5), round(float(grid[r, c]))


rock = locate(-75.1794, 6.2203, search=4)
places = [
    {"name": "Piedra del Peñol", "lon": rock[0], "lat": rock[1], "elev": rock[2], "kind": "peak"},
    {"name": "Guatapé", "lon": -75.1614, "lat": 6.2339, "elev": locate(-75.1614, 6.2339)[2], "kind": "town"},
    {"name": "El Peñol", "lon": -75.2428, "lat": 6.2192, "elev": locate(-75.2428, 6.2192)[2], "kind": "town"},
]
meta = {
    "grid": {"width": GRID[0], "height": GRID[1], "file": "altura.bin", "encoding": "uint16-le"},
    "bbox": list(CROP),
    "elevation": [round(low, 1), round(high, 1)],
    "places": places,
    "textures": {
        "2022": {"file": "s2-2022.webp", "period": "junio a diciembre de 2022"},
        "2026": {"file": "s2-2026.webp", "period": "agosto a octubre de 2026"},
    },
    "sources": "Alturas de la escena de Blender de la producción · Sentinel-2 SR, mediana de bandas B4, B3 y B2",
}
(out / "penol.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")

assets = root / "VIDEO1/PRODUCCION/proyecto/assets"
for period, name in (("2022", "antes"), ("2026", "ahora")):
    Image.open(assets / f"s2_penol_{name}.webp").convert("RGB").save(out / f"s2-{period}.webp", quality=80, method=6)
for reservoir in ("guavio", "betania", "urra"):
    for period, name in (("2022", "antes"), ("2026", "ahora")):
        shutil.copyfile(assets / f"s2_thumb_{reservoir}_{name}.webp", reservoirs_out / f"{reservoir}-{period}.webp")

# Volumen útil: media semanal (lunes) desde 2019 para los cuatro embalses del comparador.
names = {"PENOL": "penol", "GUAVIO": "guavio", "BETANIA": "betania", "URRA1": "urra"}
weekly = defaultdict(lambda: defaultdict(list))
with open(site / "archivos/video-1/03_embalses_individuales.csv", encoding="utf-8-sig") as handle:
    for row in csv.DictReader(handle):
        key = names.get(row["embalse"])
        if not key or row["fecha"] < "2019-01-01" or not row["vol_util_pct"]:
            continue
        day = date.fromisoformat(row["fecha"])
        monday = date.fromordinal(day.toordinal() - day.weekday())
        weekly[key][monday.isoformat()].append(float(row["vol_util_pct"]))

volume = {"source": "XM · Volumen útil diario por embalse, media semanal", "series": {}}
for key, weeks in weekly.items():
    volume["series"][key] = [[week, round(sum(values) / len(values), 1)] for week, values in sorted(weeks.items())]
    for label, start, end in (("2022", "2022-06-01", "2022-12-31"), ("2026", "2026-08-01", "2026-10-31")):
        values = [v for week, vs in weeks.items() if start <= week <= end for v in vs]
        volume.setdefault("periods", {}).setdefault(key, {})[label] = round(sum(values) / len(values), 1)
(reservoirs_out / "volumen.json").write_text(json.dumps(volume, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print("rejilla", GRID, "alturas", round(low), round(high), "m")
print("lugares", places)
print("volumen medio", volume["periods"])
