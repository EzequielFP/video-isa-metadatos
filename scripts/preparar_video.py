"""Comprime un video final para la web y lo registra en metadatos/videos.json.

    python scripts/preparar_video.py <video de entrada> <clave> [--titulo "..."] [--descripcion "..."]

<clave> es "final" (portada) o "1" a "5" (capítulos). Requiere ffmpeg en el PATH.

Salidas:
- assets/video/<clave>.mp4: H.264 de 720 px de ancho, CRF 24, AAC 128 kb/s y arranque rápido,
  para mantener el archivo muy por debajo del límite de 100 MB de GitHub.
- assets/video/<clave>.webp: póster tomado del segundo 2.
"""

from pathlib import Path
import argparse
import json
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("entrada", type=Path)
parser.add_argument("clave", choices=["final", "1", "2", "3", "4", "5"])
parser.add_argument("--titulo", default=None)
parser.add_argument("--descripcion", default=None)
parser.add_argument("--crf", type=int, default=24)
args = parser.parse_args()

site = Path(__file__).resolve().parents[1]
out_dir = site / "assets" / "video"
out_dir.mkdir(parents=True, exist_ok=True)
video = out_dir / f"{args.clave}.mp4"
poster = out_dir / f"{args.clave}.webp"

subprocess.run([
    "ffmpeg", "-y", "-i", str(args.entrada),
    "-vf", "scale=720:-2:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf),
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    "-movflags", "+faststart", str(video),
], check=True)
subprocess.run([
    "ffmpeg", "-y", "-ss", "2", "-i", str(video), "-frames:v", "1", "-vf", "scale=540:-2",
    "-c:v", "libwebp", "-quality", "82", str(poster),
], check=True)

config_path = site / "metadatos" / "videos.json"
config = json.loads(config_path.read_text(encoding="utf-8"))
entry = config.setdefault(args.clave, {})
entry["src"] = f"assets/video/{video.name}"
entry["poster"] = f"assets/video/{poster.name}"
if args.titulo is not None:
    entry["titulo"] = args.titulo
if args.descripcion is not None:
    entry["descripcion"] = args.descripcion
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{video.relative_to(site)}: {video.stat().st_size / 1e6:.1f} MB")
