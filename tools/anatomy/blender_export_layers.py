"""
Ekspor model Z-Anatomy (Blender) menjadi file .glb per lapisan untuk menu Anatomi 3D.

Pemakaian (Blender 3.6 / 4.x):
    blender Z-Anatomy.blend --background --python tools/anatomy/blender_export_layers.py -- \
        --out ./anatomy-glb --decimate 0.5

Hasil: skeleton.glb, joints.glb, muscles.glb, nerves.glb, arteries.glb, veins.glb,
organs.glb, skin.glb (lapisan tanpa mesh dilewati). Unggah semuanya ke bucket Supabase
`anatomy-3d`. Lihat docs/ANATOMI_3D_SETUP.md.

Aturan klasifikasi nama sama dengan src/lib/anatomy3d/layers.js; nama koleksi (collection)
Z-Anatomy dipakai sebagai petunjuk tambahan.
"""
import argparse
import os
import re
import sys

import bpy

RULES = [
    ("nerves", r"\b(nerve|nervus|nervi|plexus|ganglion|spinal cord|medulla spinalis|cauda equina|rootlet)\b"),
    ("arteries", r"\b(artery|arteria|arteriae|aorta|aortic)\b"),
    ("veins", r"\b(vein|vena|venae|venous|saphenous)\b"),
    ("joints", r"\b(ligament|ligamentum|ligamenta|cartilage|cartilago|menisc(?:us|i)|labrum|intervertebral dis[ck]|discus|annulus|nucleus pulposus|joint capsule|capsula|bursa|syndesmosis|symphysis|retinacul(?:um|a))\b"),
    ("muscles", r"\b(muscle|musculus|musculi|tendon|tendo|aponeuros[ie]s|fascia|diaphragm)\b"),
    ("skin", r"\b(skin|cutis|integument)\b"),
    ("organs", r"\b(heart|lung|liver|kidney|stomach|intestin|colon|spleen|pancreas|bladder|brain|cerebr|cerebell|esophag|trachea|bronch|thyroid|eye)\b"),
    ("skeleton", r"\b(bone|os|ossa|vertebra|vertebrae|femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|clavicula|patella|pelvis|sacrum|coccyx|rib|costa|sternum|skull|cranium|mandible|maxilla|carpal|metacarpal|phalan|tarsal|metatarsal|calcaneus|talus|ilium|ischium|pubis)\b"),
]
# Petunjuk dari nama koleksi Z-Anatomy (mis. "Skeletal system", "Muscular system").
COLLECTION_HINTS = [
    ("nerves", r"nerv"), ("arteries", r"arter"), ("veins", r"vein|venous"),
    ("joints", r"joint|ligament|articul"), ("muscles", r"muscul|muscle"),
    ("skeleton", r"skelet|bone"), ("skin", r"skin|integument"),
    ("organs", r"organ|visceral|digest|respirat|urin|cardio|brain|sense"),
]
LAYERS = ["skeleton", "joints", "muscles", "nerves", "arteries", "veins", "organs", "skin"]


def normalize(name):
    n = re.sub(r"[_]+", " ", name or "")
    n = re.sub(r"\.(?:l|r|left|right|\d{3})$", "", n, flags=re.I)
    return re.sub(r"\s+", " ", n).strip().lower()


def classify(obj):
    n = normalize(obj.name)
    for key, rx in RULES:
        if re.search(rx, n):
            return key
    for col in obj.users_collection:
        c = col.name.lower()
        for key, rx in COLLECTION_HINTS:
            if re.search(rx, c):
                return key
    return None


def unhide_all(layer_coll):
    layer_coll.exclude = False
    layer_coll.hide_viewport = False
    layer_coll.collection.hide_viewport = False
    for child in layer_coll.children:
        unhide_all(child)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="anatomy-glb")
    ap.add_argument("--decimate", type=float, default=0.5, help="rasio decimate 0–1 (1 = tanpa pengurangan)")
    ap.add_argument("--min-faces", type=int, default=3000, help="hanya decimate mesh di atas jumlah face ini")
    args = ap.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)

    unhide_all(bpy.context.view_layer.layer_collection)
    groups = {k: [] for k in LAYERS}
    skipped = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        layer = classify(obj)
        if not layer:
            skipped += 1
            continue
        obj.hide_set(False)
        obj.hide_viewport = False
        if args.decimate < 1 and len(obj.data.polygons) > args.min_faces:
            mod = obj.modifiers.new("anatomy_decimate", "DECIMATE")
            mod.ratio = args.decimate
        groups[layer].append(obj)

    print(f"[anatomy] dilewati (tidak terklasifikasi): {skipped}")
    for layer, objs in groups.items():
        if not objs:
            print(f"[anatomy] {layer}: kosong, dilewati")
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        path = os.path.join(args.out, f"{layer}.glb")
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_materials="NONE",
            export_normals=True,
            export_texcoords=False,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=7,
            export_yup=True,
        )
        size = os.path.getsize(path) / 1e6
        print(f"[anatomy] {layer}: {len(objs)} mesh -> {path} ({size:.1f} MB)")


main()
