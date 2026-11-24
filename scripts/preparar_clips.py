"""Compress web excerpts from the original renders and the generated Flow clips."""

import argparse
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

site = Path(__file__).resolve().parents[1]
production = site.parents[1] / "PRODUCCION_3D"
output = site / "assets" / "media"
output.mkdir(parents=True, exist_ok=True)


def ffmpeg(*arguments):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, arguments)], check=True)


def video(source, name, filters, start=0):
    ffmpeg("-ss", start, "-i", source, "-t", "7.2", "-an", "-vf", filters, "-c:v", "libx264",
           "-crf", 24, "-preset", "fast", "-g", 6, "-pix_fmt", "yuv420p", "-movflags", "+faststart",
           output / f"{name}.mp4")


def still(source, name, seconds, filters):
    ffmpeg("-ss", seconds, "-i", source, "-frames:v", 1, "-vf", filters,
           "-c:v", "libwebp", "-quality", 85, output / f"{name}.webp")


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--flow-dir", type=Path, required=True)
parser.add_argument("--penol-frames", type=Path, required=True)
args = parser.parse_args()

with TemporaryDirectory() as scratch:
    concat = Path(scratch) / "penol.ffconcat"
    frames = sorted(args.penol_frames.glob("penol-*.jpg"))
    if len(frames) != 71:
        raise ValueError(f"Se esperaban 71 fotogramas de Blender, se encontraron {len(frames)}")
    lines = ["ffconcat version 1.0"]
    for frame in frames:
        lines += [f"file '{frame.as_posix()}'", "duration 0.10"]
    lines.append(f"file '{frames[-1].as_posix()}'")
    concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
    ffmpeg("-f", "concat", "-safe", "0", "-i", concat, "-vf", "fps=20",
           "-c:v", "libx264", "-crf", "21", "-preset", "fast", "-g", 5, "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", output / "penol-vuelo.mp4")

premium = production / "vuelos_premium"
plane = "crop=iw:trunc(iw*9/16/2)*2:0:(ih-oh)*0.46,scale=1080:-2"
vertical = "scale=540:-2"
video(premium / "D1_sol_caribe.mp4", "caribe-vuelo", f"{plane},fps=24")
still(premium / "D1_sol_caribe.mp4", "caribe-portada", 2.1, plane)
video(premium / "D4_frontera_noche.mp4", "frontera-vuelo", f"{plane},fps=24")
still(premium / "D4_frontera_noche.mp4", "frontera-portada", 2.3, plane)
for moment, second in [("dia", 0.6), ("noche", 7.3)]:
    still(premium / "D2_caribe_dia_noche.mp4", f"caribe-{moment}", second, vertical)

for basename, flow_number in [("flow-arenosa", "09"), ("flow-ecuador", "11")]:
    source = args.flow_dir / f"scene-{flow_number}.mp4"
    video(source, basename, f"{vertical},fps=24", 0.3)
    still(source, basename, 1.2, vertical)
