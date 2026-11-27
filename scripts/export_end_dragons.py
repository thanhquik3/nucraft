"""Generate two upgraded End-Realm Dragon GLBs cloned from build_dragon.py:
- assets/models/dragon_end_fierce.glb    (Upgraded Fierce End-Realm Dragon)
- assets/models/dragon_boss_sovereign.glb (Colossal Sovereign Dragon Boss)

Reuses build_dragon.py armature, bone weights, smooth looping animations, and atlas.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

ROOT = r"d:\mine2"
sys.path.insert(0, ROOT)
import build_dragon as bd  # noqa: E402

PX = bd.PX
OUT_DIR = os.path.join(ROOT, "assets", "models")


def _edit_mesh_add(obj, mats_to_ensure, fn):
    for m in mats_to_ensure:
        if m.name not in [sm.name for sm in obj.data.materials if sm]:
            obj.data.materials.append(m)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.verify()
    fn(bm, uv)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _box_dir(bm, uv, p0, dir_v, length_px, wy_px, hz_px, uv_rect, mat_idx=0, taper=(0.55, 0.55), cull=None):
    d = Vector(dir_v).normalized()
    return bd.add_oriented_box(
        bm, uv, p0, p0 + d * (length_px * PX),
        wy_px * PX, hz_px * PX, uv_rect, mat_idx,
        cull_ends=cull or {"start"}, taper_end=taper,
    )


def _upgrade_common_fierce(objs, mats, boss=False):
    rb, rm, bt, eo = mats["Red_Body"], mats["Red_Wing_Membrane"], mats["Bone_Tan"], mats["Eye_Orange"]
    hm = Euler((0.0, bd.HEAD_PITCH_RAD, 0.0), "XYZ").to_matrix()
    h_orig = bd.NECK_JOINTS_PX[-1] * PX
    jaw_orig = h_orig + hm @ (Vector((-7.8, 0.0, -1.7)) * PX)
    sc = 1.38 if boss else 1.12

    # 1) Head: triple swept crown horns, menacing brow fins, nasal crest & larger serrated fangs
    def _up_head(bm, uv):
        for s in (-1.0, 1.0):
            # Extended jagged outer royal horn extension
            p_base = h_orig + hm @ (Vector((4.8, s * 4.4, 8.6)) * PX)
            d1 = hm @ Vector((0.78, s * 0.28, 0.56))
            _box_dir(bm, uv, p_base, d1, (7.5 if boss else 4.8) * sc, 1.15 * sc, 1.25 * sc, bd.UV_TAN_TIP, 1, taper=(0.28, 0.28))

            # Secondary inner dorsal crown horns sweeping up & back
            p_in0 = h_orig + hm @ (Vector((-2.2, s * 1.45, 3.6)) * PX)
            d_in = hm @ Vector((0.68, s * 0.16, 0.72))
            _box_dir(bm, uv, p_in0, d_in, (6.2 if boss else 4.0) * sc, 1.10 * sc, 1.18 * sc, bd.UV_TAN_MID, 1, taper=(0.32, 0.32))

            # Sharp armored brow flare & cheek spike
            p_br = h_orig + hm @ (Vector((-7.2, s * 3.1, 2.25)) * PX)
            _box_dir(bm, uv, p_br, hm @ Vector((0.86, s * 0.42, 0.28)), 4.2 * sc, 0.85 * sc, 0.90 * sc, bd.UV_TAN_TIP, 1, taper=(0.25, 0.25))
            p_ck = h_orig + hm @ (Vector((-4.0, s * 4.1, -1.6)) * PX)
            _box_dir(bm, uv, p_ck, hm @ Vector((0.72, s * 0.65, -0.18)), 3.6 * sc, 0.78 * sc, 0.78 * sc, bd.UV_TAN_TIP, 1, taper=(0.22, 0.22))

            # Extra vicious twin saber-fangs
            for fx, fl in ((-15.6, 1.55), (-13.1, 1.15)):
                pf = h_orig + hm @ (Vector((fx, s * 2.02, -2.1)) * PX)
                _box_dir(bm, uv, pf, hm @ Vector((-0.08, 0.0, -1.0)), fl * sc, 0.48, 0.52, bd.UV_TEETH, 1, taper=(0.28, 0.28))

        # Forehead / snout obsidian ridge horn (+ royal glowing crown gem for Sovereign Boss)
        p_nh = h_orig + hm @ (Vector((-14.2, 0.0, 2.2)) * PX)
        _box_dir(bm, uv, p_nh, hm @ Vector((0.55, 0.0, 0.84)), (3.8 if boss else 2.4) * sc, 1.05, 1.05, bd.UV_TAN_TIP, 1, taper=(0.22, 0.22))
        if boss:
            p_cr = h_orig + hm @ (Vector((-4.8, 0.0, 4.4)) * PX)
            _box_dir(bm, uv, p_cr, hm @ Vector((0.42, 0.0, 0.90)), 5.4, 1.35, 1.35, bd.UV_TAN_TIP, 1, taper=(0.25, 0.25))
            p_gem = h_orig + hm @ (Vector((-8.4, 0.0, 3.0)) * PX)
            _box_dir(bm, uv, p_gem, hm @ Vector((-0.25, 0.0, 0.96)), 1.65, 1.25, 1.25, bd.UV_BODY_RED, 2, taper=(0.7, 0.7), cull=set())

    _edit_mesh_add(objs["Head"], [rb, bt, eo], _up_head)

    # 2) Jaw: jagged under-chin obsidian beard spikes + larger front fangs
    def _up_jaw(bm, uv):
        for cx, l_px in ((-2.2, 3.0), (-4.4, 2.4), (-6.4, 1.8)):
            p_ch = jaw_orig + hm @ (Vector((cx, 0.0, -1.8)) * PX)
            _box_dir(bm, uv, p_ch, hm @ Vector((0.62, 0.0, -0.78)), l_px * sc, 0.82, 0.82, bd.UV_TAN_TIP, 1, taper=(0.22, 0.22))
        for s in (-1.0, 1.0):
            pf = jaw_orig + hm @ (Vector((-7.1, s * 1.92, -0.15)) * PX)
            _box_dir(bm, uv, pf, hm @ Vector((-0.08, 0.0, 1.0)), 1.25 * sc, 0.46, 0.46, bd.UV_TEETH, 1, taper=(0.28, 0.28))

    _edit_mesh_add(objs["Jaw"], [rb, bt, eo], _up_jaw)

    # 3) Body: armored spiked shoulder bastions, ventral crystal keel & boss sternum core
    def _up_body(bm, uv):
        for s in (-1.0, 1.0):
            for ox, oz, l_px in ((-4.2, 14.2, 3.8), (-1.4, 14.0, 3.2), (7.6, 13.8, 3.0)):
                ps = Vector((ox, s * 5.3, oz)) * PX
                _box_dir(bm, uv, ps, Vector((0.45, s * 0.55, 0.70)), l_px * sc, 1.15 * sc, 1.15 * sc, bd.UV_TAN_TIP, 1, taper=(0.24, 0.24))
        # Fierce chest keel spike + glowing Sovereign Boss sternum core
        pk = Vector((-6.2, 0.0, 7.8)) * PX
        _box_dir(bm, uv, pk, Vector((-0.55, 0.0, -0.82)), (3.4 if boss else 2.2) * sc, 1.25, 1.25, bd.UV_DARK_BONE, 0, taper=(0.30, 0.30))
        if boss:
            pc = Vector((-7.6, 0.0, 10.6)) * PX
            _box_dir(bm, uv, pc, Vector((-1.0, 0.0, -0.15)), 1.9, 3.4, 2.8, bd.UV_BODY_RED, 2, taper=(0.82, 0.82), cull=set())

    _edit_mesh_add(objs["Body"], [rb, bt, eo], _up_body)

    # 4) Glowing Crystalline Dorsal Spines (Spikes_Body, Spikes_Neck_*, Spikes_Tail_*)
    def _up_spikes_body(bm, uv):
        for sx, sz in [(-5.1, 16.35), (-2.0, 16.30), (1.4, 16.22), (4.8, 16.12), (8.6, 15.98)]:
            h_sp = (3.4 if boss else 2.55)
            bd.add_dorsal_spike(bm, uv, (sx, 0.0, sz), tilt_deg=-26.0, width_y=1.18 if boss else 1.04, length_x=1.65, height_z=h_sp)
            for s in (-1.0, 1.0):
                p_lat = Vector((sx, s * 1.45, sz - 0.35)) * PX
                _box_dir(bm, uv, p_lat, Vector((0.36, s * 0.42, 0.83)), (2.8 if boss else 2.0), 0.78, 0.92, bd.UV_TAN_TIP, 0, taper=(0.22, 0.22))

    _edit_mesh_add(objs["Spikes_Body"], [bt], _up_spikes_body)

    for i in range(5):
        nkey = f"Spikes_Neck_{i + 1:02d}"
        mid = 0.5 * (bd.NECK_JOINTS_PX[i] + bd.NECK_JOINTS_PX[i + 1])
        hz = [6.8, 6.1, 5.5, 4.9, 4.4][i]

        def _up_neck_sp(bm, uv, m_pt=mid, h_z=hz, idx=i):
            bd.add_dorsal_spike(
                bm, uv, (m_pt.x, 0.0, m_pt.z + 0.47 * h_z),
                tilt_deg=-28.0, width_y=(1.05 if boss else 0.92),
                length_x=1.45 - idx * 0.04, height_z=(2.9 if boss else 2.15) - idx * 0.10,
            )

        _edit_mesh_add(objs[nkey], [bt], _up_neck_sp)

    for i in range(10):
        tkey = f"Spikes_Tail_{i + 1:02d}"
        p0 = bd.TAIL_PTS_PX[i]
        p1 = bd.TAIL_PTS_PX[i + 1]
        mx, mz = 0.5 * (p0[0] + p1[0]), 0.5 * (p0[1] + p1[1]) + 1.8 - i * 0.10

        def _up_tail_sp(bm, uv, tx=mx, tz=mz, end_pt=p1, idx=i):
            if idx == 9:
                # Bladed crescent tail-axe & mace spikes
                pe = Vector((end_pt[0], 0.0, end_pt[1])) * PX
                for s in (-1.0, 1.0):
                    _box_dir(bm, uv, pe, Vector((0.45, s * 0.88, 0.12)), (5.2 if boss else 3.6), 1.35 if boss else 0.95, 0.65, bd.UV_TAN_TIP, 0, taper=(0.18, 0.18))
                if boss:
                    _box_dir(bm, uv, pe, Vector((0.88, 0.0, 0.46)), 5.8, 1.25, 1.25, bd.UV_TAN_TIP, 0, taper=(0.15, 0.15))
            else:
                bd.add_dorsal_spike(
                    bm, uv, (tx, 0.0, tz),
                    tilt_deg=-26.0, width_y=(0.95 if boss else 0.82),
                    length_x=1.35 - idx * 0.03, height_z=(2.65 if boss else 2.05) - idx * 0.06,
                )

        _edit_mesh_add(objs[tkey], [bt], _up_tail_sp)

    # 5) Wings: serrated elbow spurs, armored wrist triple-claws & longer finger talons
    for w_name, s in (("Near", -1.0), ("Far", 1.0)):
        p_sh_px, p_el_px, p_wr_px, tips_px = bd.wing_landmarks_px(s)
        p_el, p_wr, p_tip0 = p_el_px * PX, p_wr_px * PX, tips_px[0] * PX

        def _up_arm(bm, uv, pe=p_el, side=s):
            _box_dir(bm, uv, pe, Vector((0.72, side * 0.56, 0.40)), (3.8 if boss else 2.8), 1.05, 1.05, bd.UV_TAN_TIP, 1, taper=(0.22, 0.22))

        _edit_mesh_add(objs[f"Wing_{w_name}_Arm"], [rb, bt], _up_arm)

        def _up_fa(bm, uv, pw=p_wr, side=s):
            for ang in (-0.32, 0.38):
                cd = Vector((-0.82, side * (0.52 + ang * 0.4), ang * 0.55)).normalized()
                _box_dir(bm, uv, pw, cd, (4.8 if boss else 3.4) * sc, 1.10 * sc, 1.10 * sc, bd.UV_TAN_TIP, 1, taper=(0.22, 0.22))

        _edit_mesh_add(objs[f"Wing_{w_name}_Forearm"], [rb, bt], _up_fa)

        def _up_f0(bm, uv, pt=p_tip0, pw=p_wr, side=s):
            fd = (pt - pw).normalized()
            _box_dir(bm, uv, pt - fd * (0.6 * PX), fd + Vector((-0.3, side * 0.2, 0.1)), 3.6 * sc, 1.15, 1.15, bd.UV_TAN_TIP, 1, taper=(0.18, 0.18))

        _edit_mesh_add(objs[f"Wing_{w_name}_Finger_01"], [rb, bt], _up_f0)


def _optimize_and_export(arm_obj, out_glb):
    # Rename rigid bone-parented mesh objects (*_Geo) to prevent mesh/bone name collision
    bone_names = set(arm_obj.data.bones.keys())
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj.name in bone_names:
            obj.name = f"{obj.name}_Geo"

    atlas = bpy.data.images["Dragon_Atlas"]
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        nt = mat.node_tree
        for node in nt.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                if node.image.name.startswith("Dragon_Atlas"):
                    node.image = atlas
                node.interpolation = "Closest"
            elif node.type == "BSDF_PRINCIPLED" and mat.name != "Eye_Orange":
                for sock_name in ("Roughness", "Normal", "Emission Color"):
                    if sock_name in node.inputs:
                        for lk in list(node.inputs[sock_name].links):
                            nt.links.remove(lk)
                if mat.name == "Red_Body":
                    node.inputs["Roughness"].default_value = 0.60
                elif mat.name == "Bone_Tan":
                    node.inputs["Roughness"].default_value = 0.55
                elif mat.name == "Red_Wing_Membrane":
                    node.inputs["Roughness"].default_value = 0.62
                    if "Emission Strength" in node.inputs:
                        node.inputs["Emission Strength"].default_value = 0.0

    for o in bpy.data.objects:
        if o.type == "MESH":
            assert o.name not in bone_names, f"Mesh/Bone name collision: {o.name}"

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

    os.makedirs(os.path.dirname(out_glb), exist_ok=True)
    rna_keys = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    export_kwargs = dict(
        filepath=out_glb,
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
    sz = os.path.getsize(out_glb)
    assert sz > 50000, f"Exported GLB too small: {out_glb} ({sz} bytes)"
    print(f"Exported NUCRAFT End Dragon GLB cleanly: {out_glb} ({sz} bytes)")


def build_variant(out_name, boss=False):
    bd.clear_scene()
    mats = bd.create_materials()
    objs, skin_weights = bd.build_dragon_meshes(mats)
    _upgrade_common_fierce(objs, mats, boss=boss)
    arm_obj = bd.build_armature_and_bind(objs, skin_weights)
    bd.build_animations_and_nla(arm_obj)
    bd.play("Rest_Pose")
    bpy.context.view_layer.update()
    _optimize_and_export(arm_obj, os.path.join(OUT_DIR, out_name))


def main():
    build_variant("dragon_end_fierce.glb", boss=False)
    build_variant("dragon_boss_sovereign.glb", boss=True)


if __name__ == "__main__":
    main()
