"""Prepare monthly NOAA OISST frames for the film site from the published GeoTIFF.

Usage: python scripts/preparar_pacifico.py <Natural Earth land shapefile>
"""

import csv
import json
from collections import defaultdict
from pathlib import Path
import sys

import fiona
import numpy as np
from PIL import Image
import rasterio
from rasterio.features import geometry_mask
from scipy.ndimage import distance_transform_edt, gaussian_filter


site = Path(__file__).resolve().parents[1]
video = site / "archivos" / "video-1"
output = site / "assets" / "media" / "pacifico"
output.mkdir(parents=True, exist_ok=True)
monthly = defaultdict(list)
with (video / "02_Nino34_anomalia_diaria.csv").open(encoding="utf-8-sig") as stream:
    for row in csv.DictReader(stream):
        if row["anom_nino34_C"]:
            monthly[row["fecha"][:7]].append(float(row["anom_nino34_C"]))

palette = [
    (-3, (7, 26, 81)), (-2, (19, 70, 142)), (-1, (57, 124, 188)),
    (-0.5, (140, 190, 208)), (0, (219, 224, 215)), (0.5, (251, 200, 136)),
    (1.5, (240, 119, 66)), (2.5, (191, 48, 51)), (4.5, (100, 13, 44)),
]
values, shades = np.asarray([v for v, _ in palette]), np.asarray([rgb for _, rgb in palette])
ocean_dark = np.array([15, 33, 51])
land_dark = np.array([12, 25, 38])
coast_glow = np.array([49, 98, 109])
frames = []
with rasterio.open(video / "01_SST_anomalia_mensual_C.tif") as source, fiona.open(sys.argv[1]) as coast:
    scale = 3
    width, height = source.width * scale, source.height * scale
    bounds = tuple(source.bounds)
    transform = source.transform * source.transform.scale(1 / scale)
    land = geometry_mask(
        [feature.geometry for feature in coast.filter(bbox=bounds)],
        out_shape=(height, width), transform=transform, invert=True,
    )
    edge = gaussian_filter(land.astype(float), 1.5)
    land_color = land_dark + (4 * edge * (1 - edge))[..., None] * coast_glow
    for index, band in enumerate(source.descriptions, start=1):
        month = f"{band[1:5]}-{band[6:8]}"
        sea = source.read(index, masked=True).filled(np.nan)
        valid = np.isfinite(sea) & (abs(sea) < 20)
        nearest = distance_transform_edt(~valid, return_distances=False, return_indices=True)
        filled = sea[tuple(nearest)]
        grid = np.asarray(Image.fromarray(filled).resize((width, height), Image.Resampling.BICUBIC))
        valid_large = np.asarray(Image.fromarray(valid).resize((width, height), Image.Resampling.NEAREST))
        image = np.stack([np.interp(grid, values, shades[:, i]) for i in range(3)], axis=-1)
        image[~valid_large] = ocean_dark
        image[land] = land_color[land]
        name = f"{month}.webp"
        Image.fromarray(image.astype(np.uint8)).save(output / name, quality=83, method=6)
        observations = monthly[month]
        frames.append({
            "month": month,
            "image": name,
            "value": round(sum(observations) / len(observations), 3) if observations else None,
            "days": len(observations),
        })

    details = {"width": width, "height": height, "bounds": bounds, "frames": frames}
    (output / "serie.json").write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
