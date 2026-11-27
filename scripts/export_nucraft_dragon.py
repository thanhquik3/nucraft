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

    # Compact human-proportioned rider saddle placed cleanly between Body dorsal spike #1 (-5.1) and #2 (-2.0)
    add_col_box(Vector((-3.9, 0.0, 16.58)) * PX, Vector((-2.5, 0.0, 16.58)) * PX, 1.45 * PX, 0.26 * PX, c_seat)
    # Slim low golden pommel (front) and cantle (back) that never clip or cover the rider
    add_col_box(Vector((-4.02, 0.0, 16.78)) * PX, Vector((-3.78, 0.0, 16.78)) * PX, 1.45 * PX, 0.16 * PX, c_trim, cull={"bottom"})
    add_col_box(Vector((-2.62, 0.0, 16.78)) * PX, Vector((-2.38, 0.0, 16.78)) * PX, 1.45 * PX, 0.16 * PX, c_trim, cull={"bottom"})

    # Flush thin girth straps hugging torso flanks with zero bulky protruding side flaps
    for s in (-1.0, 1.0):
        add_col_box(
            Vector((-3.2, s * 6.02, 6.25)) * PX, Vector((-3.2, s * 6.02, 11.40)) * PX,
            0.20 * PX, 0.56 * PX, c_strap, up_hint=Vector((1.0, 0.0, 0.0)),
        )
    add_col_box(Vector((-3.5, 0.0, 6.25)) * PX, Vector((-2.9, 0.0, 6.25)) * PX, 11.0 * PX, 0.30 * PX, c_strap)

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


def prepare_armor_from_blend(arm_obj):
    """If blend already holds Iron/Gold/Diamond armor suites, keep Iron as shared modular base & unhide it."""
    col = bpy.context.scene.collection
    iron_objs = [bpy.data.objects.get(f"Armor_Iron_{s}") for s in ("Head", "Neck", "Body", "Tail")]
    if all(o is not None for o in iron_objs):
        for tier in ("Gold", "Diamond"):
            for s in ("Head", "Neck", "Body", "Tail"):
                o = bpy.data.objects.get(f"Armor_{tier}_{s}")
                if o is not None:
                    bpy.data.objects.remove(o, do_unlink=True)
        for s, o in zip(("Head", "Neck", "Body", "Tail"), iron_objs):
            o.hide_viewport = False
            o.hide_render = False
            o.name = f"Armor_{s}_Geo"
        for src_m, dst_m in (("Armor_Iron_Metal", "Armor_Metal"), ("Armor_Iron_Trim", "Armor_Trim")):
            m = bpy.data.materials.get(src_m)
            if m:
                m.name = dst_m
        for img_name in ("Armor_Gold_Atlas", "Armor_Diamond_Atlas"):
            im = bpy.data.images.get(img_name)
            if im and im.users == 0:
                bpy.data.images.remove(im)
        return [bpy.data.objects.get(f"Armor_{s}_Geo") for s in ("Head", "Neck", "Body", "Tail")]
    return add_modular_armor(arm_obj)


def main():
    blend_path = BLEND_PATH
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        if "--blend" in extra:
            bi = extra.index("--blend")
            if bi + 1 < len(extra):
                blend_path = extra[bi + 1]
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    arm_obj = bpy.data.objects["Dragon_Armature"]
    if hasattr(bd, "ACTION_LENGTHS") and "Rest_Pose" in bd.ACTION_LENGTHS:
        bd.play("Rest_Pose")
    else:
        if arm_obj.animation_data:
            arm_obj.animation_data.action = None
            arm_obj.animation_data.use_nla = False
        for pb in arm_obj.pose.bones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            pb.rotation_euler = (0.0, 0.0, 0.0)
            pb.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()

    # 1. Attach toggleable vertex-colored riding saddle + 4 external skinned armor meshes onto Dragon_Armature
    bone_names = set(arm_obj.data.bones.keys())
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj.name in bone_names:
            obj.name = f"{obj.name}_Geo"

    if bpy.data.objects.get("Dragon_Saddle_Geo") is None:
        add_saddle_to_body(arm_obj)
    prepare_armor_from_blend(arm_obj)

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

    target_actions = {"Fly_Flap", "Glide", "Idle", "Roar_WingSpread", "Walk"}
    for act in bpy.data.actions:
        if act.name not in target_actions:
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
