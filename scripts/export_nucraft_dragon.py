"""Export d:\\mine2\\dragon.blend into an optimized NUCRAFT game GLB (assets/models/dragon_wyvern.glb).

- Deduplicates Dragon_Atlas into 1 single packed 256x256 image.
- Renames rigid bone-parented mesh objects (*_Geo) so no mesh shares a Bone name.
- Attaches a toggleable vertex-colored 3D Dragon_Saddle_Geo rigidly to the Body bone.
- Exports all 5 cyclic actions with optimized track pruning & 30 Hz sampling for small size.
Does NOT overwrite d:\\mine2\\dragon.blend.
"""

import os
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = r"d:\mine2"
sys.path.insert(0, ROOT)
import build_dragon as bd  # noqa: E402
import build_dragon_armor as bda  # noqa: E402

PX = bd.PX
BLEND_PATH = os.path.join(ROOT, "dragon.blend")
OUT_GLB = os.path.join(ROOT, "assets", "models", "dragon_wyvern.glb")


def add_saddle_to_body(arm_obj):
    """Create Dragon_Saddle_Geo with vertex colors, rigidly bone-parented to Body."""
    mat = bpy.data.materials.new("Dragon_Saddle")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.28
    vc_node = nt.nodes.new("ShaderNodeVertexColor")
    vc_node.layer_name = "Col"
    vc_node.location = (-280, 180)
    nt.links.new(vc_node.outputs["Color"], bsdf.inputs["Base Color"])

    bm, uv = bd.new_bm()
    vcol = bm.loops.layers.color.new("Col")

    c_seat = bd.hex_to_linear("#7F1D1D")
    c_trim = bd.hex_to_linear("#D6A81E")
    c_strap = bd.hex_to_linear("#261812")

    def add_col_box(p0, p1, wy, hz, rgba, cull=None, up_hint=Vector((0.0, 0.0, 1.0))):
        faces = bd.add_oriented_box(bm, uv, p0, p1, wy, hz, bd.UV_BODY_RED, 0, up_hint=up_hint, cull_ends=cull)
        for f in faces:
            for loop in f.loops:
                loop[vcol] = rgba

    # Sleek proportional rider saddle placed cleanly between Body dorsal spike #1 (-5.1) and #2 (-2.0)
    add_col_box(Vector((-4.2, 0.0, 16.72)) * PX, Vector((-2.2, 0.0, 16.72)) * PX, 3.2 * PX, 0.44 * PX, c_seat)
    # Slim golden pommel (front) and cantle (back)
    add_col_box(Vector((-4.32, 0.0, 17.08)) * PX, Vector((-3.98, 0.0, 17.08)) * PX, 3.2 * PX, 0.28 * PX, c_trim, cull={"bottom"})
    add_col_box(Vector((-2.42, 0.0, 17.10)) * PX, Vector((-2.08, 0.0, 17.10)) * PX, 3.2 * PX, 0.32 * PX, c_trim, cull={"bottom"})

    # Slim contoured leather saddle flaps & dark girth strap hugging torso flanks
    for s in (-1.0, 1.0):
        add_col_box(Vector((-3.9, s * 6.08, 13.6)) * PX, Vector((-2.5, s * 6.08, 13.6)) * PX, 0.28 * PX, 4.4 * PX, c_seat)
        add_col_box(
            Vector((-3.2, s * 6.08, 6.25)) * PX, Vector((-3.2, s * 6.08, 11.40)) * PX,
            0.28 * PX, 0.72 * PX, c_strap, up_hint=Vector((1.0, 0.0, 0.0)),
        )
    add_col_box(Vector((-3.6, 0.0, 6.25)) * PX, Vector((-2.8, 0.0, 6.25)) * PX, 11.2 * PX, 0.36 * PX, c_strap)

    saddle_obj = bd.finalize_bmesh_object("Dragon_Saddle_Geo", bm, [mat], bpy.context.scene.collection)
    pb_body = arm_obj.pose.bones["Body"]
    saddle_obj.parent = arm_obj
    saddle_obj.parent_type = "BONE"
    saddle_obj.parent_bone = "Body"
    tail_mat = arm_obj.matrix_world @ pb_body.matrix @ Matrix.Translation((0.0, pb_body.bone.length, 0.0))
    saddle_obj.matrix_parent_inverse = tail_mat.inverted()
    bpy.context.view_layer.update()
    return saddle_obj


def add_modular_armor(arm_obj):
    """Attach 4 external skinned Dragon Armor meshes (Head, Neck, Body, Tail) using shared Iron atlas."""
    col = bpy.context.scene.collection
    mats = bda.create_tier_materials("Iron")
    builders = (
        ("Head", bda.build_head_armor),
        ("Neck", bda.build_neck_armor),
        ("Body", bda.build_body_armor),
        ("Tail", bda.build_tail_armor),
    )
    armor_pairs = []
    for slot, fn in builders:
        obj, vw = fn("Iron", mats, col)
        obj.name = f"Armor_{slot}_Geo"
        armor_pairs.append((obj, vw))
    bda.bind_armor_to_armature(arm_obj, armor_pairs)
    for m in mats:
        m.name = "Armor_Metal" if m.name.endswith("_Metal") else "Armor_Trim"
    return [o for o, _ in armor_pairs]


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    arm_obj = bpy.data.objects["Dragon_Armature"]
    bd.play("Rest_Pose")
    bpy.context.view_layer.update()

    # 1. Attach toggleable vertex-colored riding saddle + 4 external skinned armor meshes onto Dragon_Armature
    bone_names = set(arm_obj.data.bones.keys())
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj.name in bone_names:
            obj.name = f"{obj.name}_Geo"

    add_saddle_to_body(arm_obj)
    add_modular_armor(arm_obj)

    # 2. Deduplicate Dragon_Atlas & keep flat PBR inputs (no extra bump/roughness images exported)
    atlas = bpy.data.images["Dragon_Atlas"]
    armor_atlas = bpy.data.images.get("Armor_Iron_Atlas")
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        nt = mat.node_tree
        for node in nt.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                if node.image.name.startswith("Dragon_Atlas"):
                    node.image = atlas
                elif armor_atlas and node.image.name.startswith("Armor_"):
                    node.image = armor_atlas
                node.interpolation = "Closest"
            elif node.type == "BSDF_PRINCIPLED" and mat.name != "Eye_Orange":
                for sock_name in ("Roughness", "Normal", "Emission Color"):
                    if sock_name in node.inputs:
                        for lk in list(node.inputs[sock_name].links):
                            nt.links.remove(lk)
                if mat.name == "Red_Body":
                    node.inputs["Roughness"].default_value = 0.65
                elif mat.name == "Bone_Tan":
                    node.inputs["Roughness"].default_value = 0.74
                elif mat.name == "Red_Wing_Membrane":
                    node.inputs["Roughness"].default_value = 0.64
                    if "Emission Strength" in node.inputs:
                        node.inputs["Emission Strength"].default_value = 0.0
                elif mat.name == "Armor_Metal":
                    node.inputs["Roughness"].default_value = 0.34
                elif mat.name == "Armor_Trim":
                    node.inputs["Roughness"].default_value = 0.76

    for o in bpy.data.objects:
        if o.type == "MESH":
            assert o.name not in bone_names, f"Mesh/Bone name collision: {o.name}"

    # 4. Downsample locked 60-FPS keys 2:1 -> 30 Hz + prune constant tracks while keeping smooth loop closure
    arm_obj.animation_data.action = None
    arm_obj.animation_data.use_nla = False
    for trk in arm_obj.animation_data.nla_tracks:
        trk.mute = True

    for act in bpy.data.actions:
        if act.name not in bd.ACTION_LENGTHS:
            continue
        f_end = int(round(act.frame_end))
        for lay in act.layers:
            for st in lay.strips:
                for slot in act.slots:
                    cbag = st.channelbag(slot)
                    for fc in cbag.fcurves:
                        is_root = '"Root"' in fc.data_path
                        dp = fc.data_path
                        if dp.endswith(".scale") or (dp.endswith(".location") and not is_root):
                            kps = fc.keyframe_points
                            for idx in range(len(kps) - 2, 0, -1):
                                kps.remove(kps[idx], fast=True)
                            fc.update()
                            continue
                        kps = fc.keyframe_points
                        for idx in range(len(kps) - 2, 0, -1):
                            f_val = int(round(kps[idx].co.x))
                            if f_val % 2 == 0 and f_val != f_end:
                                kps.remove(kps[idx], fast=True)
                        for kp in kps:
                            kp.interpolation = "LINEAR"
                        fc.update()

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    rna_keys = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    export_kwargs = dict(
        filepath=OUT_GLB,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
    )
    for opt_k, opt_v in (
        ("export_optimize_animation_size", True),
        ("export_optimize_animation_keep_anim_armature", False),
        ("export_anim_slide_to_zero", True),
        ("export_force_sampling", False),
    ):
        if opt_k in rna_keys:
            export_kwargs[opt_k] = opt_v

    bpy.ops.export_scene.gltf(**export_kwargs)
    print(f"Exported NUCRAFT dragon GLB cleanly: {OUT_GLB} ({os.path.getsize(OUT_GLB)} bytes)")


if __name__ == "__main__":
    main()
