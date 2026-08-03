import bpy
import os
import math

# --- 1. MŰTEREM TISZTÍTÁSA ---
bpy.ops.wm.read_factory_settings(use_empty=True)

# --- 2. KAMERA ÉS BEVILÁGÍTÁS BEÁLLÍTÁSA ---
# Kamera létrehozása
cam_data = bpy.data.cameras.new(name='Kamera')
cam_object = bpy.data.objects.new(name='Kamera', object_data=cam_data)
bpy.context.scene.collection.objects.link(cam_object)
bpy.context.scene.camera = cam_object

# Kamera pozíciója (45 fokos szögben, kicsit magasabbról)
cam_object.location = (4, -4, 3)
cam_object.rotation_euler = (math.radians(60), 0, math.radians(45))

# Főfény (Warm Studio Light)
light_data = bpy.data.lights.new(name='Fofeny', type='SUN')
light_data.energy = 3.5
light_object = bpy.data.objects.new(name='Fofeny', object_data=light_data)
bpy.context.scene.collection.objects.link(light_object)
light_object.rotation_euler = (math.radians(45), math.radians(30), math.radians(45))

# --- 3. SÖTÉT GULUMEN HÁTTÉR BEÁLLÍTÁSA ---
world = bpy.data.worlds.new("GulumenWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    # Sötét, elegáns mélyszürke/fehéres-szórt háttérszín
    bg_node.inputs[0].default_value = (0.05, 0.05, 0.07, 1.0)

# --- 4. RENDER BEÁLLÍTÁSOK ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'  # Vagy 'BLENDER_EEVEE' a villámgyors rendereléshez
scene.render.resolution_x = 1080
scene.render.resolution_y = 1080

# Mappa útvonala (Blender --python alatt __file__ nem mindig elérhető)
try:
    mappa_utvonal = os.path.dirname(os.path.abspath(__file__))
except NameError:
    mappa_utvonal = os.path.dirname(os.path.abspath(bpy.context.space_data.text.filepath)) if bpy.context.space_data and getattr(bpy.context.space_data, "text", None) else os.getcwd()

# Ha CLI-ből futtatjuk: blender --python script.py -- /út/a/mappához
import sys
if "--" in sys.argv:
    args = sys.argv[sys.argv.index("--") + 1:]
    if args:
        mappa_utvonal = os.path.abspath(args[0])

# Headless / VM: kevesebb sample a gyorsabb Cycles renderhez
scene.cycles.samples = 64
scene.cycles.use_denoising = True

print("--- GULUMEN 3D AUTOMATA RENDERELÉS INDUL ---")
print(f"Mappa: {mappa_utvonal}")

# --- 5. AUTOMATIKUS MODELL-FELDOLGOZÁS ---
for fajlnev in sorted(os.listdir(mappa_utvonal)):
    if fajlnev.endswith(".stl") or fajlnev.endswith(".3mf"):
        fajl_utvonal = os.path.join(mappa_utvonal, fajlnev)
        print(f"Feldolgozás: {fajlnev}")

        # Importálás típus alapján
        bpy.ops.object.select_all(action='DESELECT')
        if fajlnev.endswith(".stl"):
            bpy.ops.wm.stl_import(filepath=fajl_utvonal)
        elif fajlnev.endswith(".3mf"):
            # Pythonban a "3mf_import" attribútumnév érvénytelen → getattr
            threemf_import = getattr(bpy.ops.wm, "3mf_import", None) or getattr(bpy.ops.import_mesh, "threemf", None)
            if threemf_import is None:
                print(f"  FIGYELEM: nincs 3MF import operátor, kihagyva: {fajlnev}")
                continue
            threemf_import(filepath=fajl_utvonal)

        # A betöltött tárgy kijelölése és középre igazítása
        imported_objs = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
        if not imported_objs:
            # Fallback: legutóbb létrejött mesh
            imported_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        if imported_objs:
            obj = imported_objs[0]
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
            obj.location = (0, 0, 0)

            # Kép kimentése
            kimeneti_kep = os.path.join(mappa_utvonal, f"{os.path.splitext(fajlnev)[0]}.png")
            scene.render.filepath = kimeneti_kep
            bpy.ops.render.render(write_still=True)
            print(f"  Mentve: {kimeneti_kep}")

            # Tárgy törlése a következő előtt
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.ops.object.delete()
        else:
            print(f"  FIGYELEM: nem sikerült mesh-et importálni: {fajlnev}")

print("--- KÉSZ! A képek a mappában vannak. ---")
