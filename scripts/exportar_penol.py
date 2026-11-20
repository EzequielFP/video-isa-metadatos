"""Export the production Blender terrain and render a wide cover for the site.

blender -b <vuelo_penol.blend> --python exportar_penol.py -- <media directory>
"""

from pathlib import Path
import sys

import bpy


output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
original = next(obj for obj in scene.objects if obj.type == "MESH")
source_dir = Path(bpy.data.filepath).parent / "data"
displacement = next(mod for mod in original.modifiers if mod.type == "DISPLACE")
material = original.data.materials[0]

for image in bpy.data.images:
    linked_path = source_dir / Path(bpy.path.abspath(image.filepath)).name
    if image.source == "FILE" and not image.packed_file and linked_path.is_file():
        image.filepath = str(linked_path)
        image.reload()

scene.frame_set(110)
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
scene.render.filepath = str(output / "penol-blender.jpg")
bpy.ops.render.render(write_still=True)

# Re-evaluate the same height map and UVs on a lighter grid for the browser.
size = max(corner[0] for corner in original.bound_box) - min(corner[0] for corner in original.bound_box)
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.mesh.primitive_grid_add(x_subdivisions=240, y_subdivisions=240, size=size)
terrain = bpy.context.object
terrain.name = "Relieve Peñol–Guatapé"
modifier = terrain.modifiers.new("Relieve de la escena de producción", "DISPLACE")
modifier.texture = displacement.texture
modifier.texture_coords = displacement.texture_coords
modifier.strength = displacement.strength
modifier.mid_level = displacement.mid_level
terrain.data.materials.append(material)
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.object.shade_smooth()
bpy.ops.export_scene.gltf(
    filepath=str(output / "penol.glb"),
    export_format="GLB",
    use_selection=True,
    export_image_format="JPEG",
    export_jpeg_quality=88,
    export_animations=False,
)

if "--frames" in sys.argv:
    frames = Path(sys.argv[sys.argv.index("--frames") + 1]).resolve()
    frames.mkdir(parents=True, exist_ok=True)
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.frame_start, scene.frame_end, scene.frame_step = 24, 234, 3
    scene.render.filepath = str(frames / "penol-")
    bpy.ops.render.render(animation=True)
