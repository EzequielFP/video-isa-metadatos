"""Convierte el mapa base oscuro del Video 3 en la versión clara del sitio.

    python scripts/preparar_region.py

Entrada: assets/media/base-regional.webp (mar verde azulado y tierra oscura, de −84 a −62 de
longitud y de −8 a 16 de latitud). El canal verde separa el mar (≈80) de la tierra (≈20); los
límites intermedios quedan como líneas tenues sobre el papel.
Salida: assets/media/base-regional-clara.webp.
"""

from pathlib import Path

import numpy as np
from PIL import Image

media = Path(__file__).resolve().parents[1] / "assets" / "media"
dark = np.array(Image.open(media / "base-regional.webp").convert("RGB")).astype(float)
sea = np.clip((dark[..., 1] - 22) / (78 - 22), 0, 1)[..., None]
light = np.array([250, 247, 239.]) * (1 - sea) + np.array([190, 216, 240.]) * sea
Image.fromarray(light.astype("uint8")).save(media / "base-regional-clara.webp", quality=82, method=6)
