use core::ptr::{addr_of, addr_of_mut};

use crate::terrain;

pub const LOD_MASK_CAP: usize = 4096;
pub const LOD_GRID_MAX: usize = 81;
pub const LOD_MAX_VERTS: usize = 49152;
pub const LOD_MAX_INDICES: usize = 73728;

static mut LOD_LOADED_MASK: [u8; LOD_MASK_CAP] = [0; LOD_MASK_CAP];
static mut LOD_CELL_H: [i16; LOD_GRID_MAX * LOD_GRID_MAX] = [0; LOD_GRID_MAX * LOD_GRID_MAX];
static mut LOD_CELL_B: [u8; LOD_GRID_MAX * LOD_GRID_MAX] = [0; LOD_GRID_MAX * LOD_GRID_MAX];
static mut LOD_CELL_SKIP: [u8; LOD_GRID_MAX * LOD_GRID_MAX] = [0; LOD_GRID_MAX * LOD_GRID_MAX];

static mut LOD_POS: [f32; LOD_MAX_VERTS * 3] = [0.0; LOD_MAX_VERTS * 3];
static mut LOD_NORM: [f32; LOD_MAX_VERTS * 3] = [0.0; LOD_MAX_VERTS * 3];
static mut LOD_COL: [f32; LOD_MAX_VERTS * 3] = [0.0; LOD_MAX_VERTS * 3];
static mut LOD_IDX: [u32; LOD_MAX_INDICES] = [0; LOD_MAX_INDICES];
static mut LOD_META: [u32; 4] = [0; 4];

#[no_mangle]
pub extern "C" fn lod_mask_ptr() -> *mut u8 {
    addr_of_mut!(LOD_LOADED_MASK) as *mut u8
}
#[no_mangle]
pub extern "C" fn lod_pos_ptr() -> *const f32 {
    addr_of!(LOD_POS) as *const f32
}
#[no_mangle]
pub extern "C" fn lod_norm_ptr() -> *const f32 {
    addr_of!(LOD_NORM) as *const f32
}
#[no_mangle]
pub extern "C" fn lod_col_ptr() -> *const f32 {
    addr_of!(LOD_COL) as *const f32
}
#[no_mangle]
pub extern "C" fn lod_idx_ptr() -> *const u32 {
    addr_of!(LOD_IDX) as *const u32
}
#[no_mangle]
pub extern "C" fn lod_meta_ptr() -> *const u32 {
    addr_of!(LOD_META) as *const u32
}

#[inline(always)]
fn biome_lod_rgb(biome: u8, h: i32, water_level: i32) -> (f32, f32, f32) {
    if h <= water_level {
        return match biome {
            terrain::B_ABYSS_TRENCH => (0.11, 0.25, 0.56),
            terrain::B_DEEP_OCEAN => (0.15, 0.36, 0.70),
            terrain::B_SWAMP | terrain::B_MANGROVE_SWAMP => (0.18, 0.38, 0.34),
            terrain::B_SULFUR_SPRINGS => (0.12, 0.68, 0.72),
            _ => (0.18, 0.44, 0.78),
        };
    }
    match biome {
        terrain::B_DESERT | terrain::B_BEACH_PALM => (0.86, 0.78, 0.54),
        terrain::B_SNOW | terrain::B_SNOWY_PLAINS => (0.90, 0.94, 0.98),
        terrain::B_MEGA_SNOW_PEAKS => if h >= 36 { (0.89, 0.93, 0.98) } else { (0.38, 0.48, 0.42) },
        terrain::B_CLOUD_PEAKS | terrain::B_ALPINE_PEAKS => {
            if h >= 22 { (0.88, 0.92, 0.97) } else { (0.37, 0.54, 0.34) }
        }
        terrain::B_SAKURA => (0.74, 0.55, 0.67),
        terrain::B_AUTUMN | terrain::B_AUTUMN_GOLDEN | terrain::B_AUTUMN_DEEP | terrain::B_DAPPLED_FOREST => (0.72, 0.44, 0.22),
        terrain::B_MESA | terrain::B_BADLANDS_SPIRES | terrain::B_BADLANDS_CRATER => (0.72, 0.38, 0.25),
        terrain::B_MUSHROOM_ISLAND | terrain::B_GLOWSHROOM_GROVE => (0.45, 0.40, 0.52),
        terrain::B_VOLCANIC_BASALT => (0.24, 0.24, 0.27),
        terrain::B_ABANDONED_CITY => (0.42, 0.44, 0.48),
        terrain::B_GRAND_RUINS => (0.46, 0.50, 0.45),
        terrain::B_BLUE_FOREST => (0.19, 0.60, 0.62),
        terrain::B_WHEAT_VALLEY => (0.82, 0.66, 0.24),
        terrain::B_PALE_GARDEN => (0.58, 0.61, 0.66),
        terrain::B_NIGHTMARE_WOODS => (0.22, 0.14, 0.24),
        terrain::B_DARK_FOREST | terrain::B_TAIGA | terrain::B_REDWOOD_ANCIENT | terrain::B_PINE_VALLEY => (0.20, 0.39, 0.21),
        terrain::B_BAMBOO_JUNGLE | terrain::B_GIANT_JUNGLE | terrain::B_LUSH_GROVE | terrain::B_GIANT_TREES => (0.24, 0.55, 0.23),
        terrain::B_LAVENDER_MEADOW => (0.46, 0.52, 0.58),
        terrain::B_SULFUR_SPRINGS => (0.76, 0.68, 0.22),
        _ => (0.34, 0.60, 0.27),
    }
}

#[inline(always)]
#[allow(clippy::too_many_arguments)]
unsafe fn emit_lod_quad(
    pos_ptr: *mut f32,
    norm_ptr: *mut f32,
    col_ptr: *mut f32,
    idx_ptr: *mut u32,
    v_count: &mut usize,
    i_count: &mut usize,
    p: [[f32; 3]; 4],
    n: [f32; 3],
    c: [f32; 3],
) -> bool {
    if *v_count + 4 > LOD_MAX_VERTS || *i_count + 6 > LOD_MAX_INDICES {
        return false;
    }
    let vc = *v_count;
    let vp = vc * 3;
    for k in 0..4usize {
        let o = vp + k * 3;
        *pos_ptr.add(o) = p[k][0];
        *pos_ptr.add(o + 1) = p[k][1];
        *pos_ptr.add(o + 2) = p[k][2];
        *norm_ptr.add(o) = n[0];
        *norm_ptr.add(o + 1) = n[1];
        *norm_ptr.add(o + 2) = n[2];
        *col_ptr.add(o) = c[0];
        *col_ptr.add(o + 1) = c[1];
        *col_ptr.add(o + 2) = c[2];
    }
    let vc32 = vc as u32;
    let ip = *i_count;
    *idx_ptr.add(ip) = vc32;
    *idx_ptr.add(ip + 1) = vc32 + 1;
    *idx_ptr.add(ip + 2) = vc32 + 2;
    *idx_ptr.add(ip + 3) = vc32;
    *idx_ptr.add(ip + 4) = vc32 + 2;
    *idx_ptr.add(ip + 5) = vc32 + 3;
    *v_count = vc + 4;
    *i_count = ip + 6;
    true
}

#[no_mangle]
pub extern "C" fn build_far_lod_mesh(
    center_cx: i32,
    center_cz: i32,
    seed: i32,
    water_level: i32,
    step_in: u32,
    outer_radius_in: u32,
    mask_radius_in: u32,
) -> u32 {
    let step1 = (step_in as i32).max(4).min(32);
    let r1 = (outer_radius_in as i32).max(step1 * 4).min(step1 * ((LOD_GRID_MAX as i32) / 2 - 1));
    let mask_r = (mask_radius_in as i32).max(0).min(30);
    let mask_w = mask_r * 2 + 1;

    let step2 = (step1 * 3).min(48);
    let r2 = r1 * 3;
    let inner_cut_r = (r1 - step1).max(0);
    let inner_cut_r2 = (inner_cut_r * inner_cut_r) as i64;

    let mask_ptr = addr_of!(LOD_LOADED_MASK) as *const u8;
    let h_ptr = addr_of_mut!(LOD_CELL_H) as *mut i16;
    let b_ptr = addr_of_mut!(LOD_CELL_B) as *mut u8;
    let skip_ptr = addr_of_mut!(LOD_CELL_SKIP) as *mut u8;
    let pos_ptr = addr_of_mut!(LOD_POS) as *mut f32;
    let norm_ptr = addr_of_mut!(LOD_NORM) as *mut f32;
    let col_ptr = addr_of_mut!(LOD_COL) as *mut f32;
    let idx_ptr = addr_of_mut!(LOD_IDX) as *mut u32;
    let meta_ptr = addr_of_mut!(LOD_META) as *mut u32;

    let mut v_count: usize = 0;
    let mut i_count: usize = 0;
    let mut cells_emitted: u32 = 0;
    let center_wx = center_cx * 16 + 8;
    let center_wz = center_cz * 16 + 8;
    let wl_f = water_level as f32;

    unsafe {
        // Shared emitter for Ring 1 (near-far, skips loaded chunks) and Ring 2 (mega horizon out to r2=768)
        let mut emit_ring = |step: i32, outer_r: i32, y_bias: f32, extra_skirt: f32, is_outer: bool| {
            let snap_x = center_wx.div_euclid(step) * step;
            let snap_z = center_wz.div_euclid(step) * step;
            let half_cells = (outer_r / step).min((LOD_GRID_MAX as i32 - 1) / 2);
            let grid_n = (half_cells * 2 + 1) as usize;
            let orig_x = snap_x - half_cells * step;
            let orig_z = snap_z - half_cells * step;
            let outer_r2 = (outer_r * outer_r) as i64;
            let step_f = step as f32;

            for gz in 0..grid_n {
                let wz0 = orig_z + (gz as i32) * step;
                let wz_mid = wz0 + (step >> 1);
                let dz_c = (wz_mid - snap_z) as i64;
                for gx in 0..grid_n {
                    let wx0 = orig_x + (gx as i32) * step;
                    let wx_mid = wx0 + (step >> 1);
                    let dx_c = (wx_mid - snap_x) as i64;
                    let idx = gz * grid_n + gx;

                    if dx_c * dx_c + dz_c * dz_c > outer_r2 {
                        *skip_ptr.add(idx) = 2;
                        continue;
                    }

                    let mut covered;
                    if !is_outer {
                        covered = true;
                        for &(ox, oz) in &[(0, 0), (step - 1, 0), (0, step - 1), (step - 1, step - 1)] {
                            let ccx = (wx0 + ox).div_euclid(16) - center_cx;
                            let ccz = (wz0 + oz).div_euclid(16) - center_cz;
                            if ccx.abs() > mask_r || ccz.abs() > mask_r {
                                covered = false;
                                break;
                            }
                            let mi = ((ccz + mask_r) * mask_w + (ccx + mask_r)) as usize;
                            if mi >= LOD_MASK_CAP || *mask_ptr.add(mi) == 0 {
                                covered = false;
                                break;
                            }
                        }
                    } else {
                        covered = true;
                        for &(ox, oz) in &[(0, 0), (step, 0), (0, step), (step, step)] {
                            let dx = (wx0 + ox - snap_x) as i64;
                            let dz = (wz0 + oz - snap_z) as i64;
                            if dx * dx + dz * dz > inner_cut_r2 {
                                covered = false;
                                break;
                            }
                        }
                    }
                    *skip_ptr.add(idx) = if covered { 1 } else { 0 };

                    let bio = terrain::get_overworld_biome_at(wx_mid, wz_mid, seed);
                    let raw_h = terrain::get_overworld_raw_height(wx_mid, wz_mid, bio, seed, water_level).floor() as i32;
                    let clamped_h = raw_h.max(-44).min(180);
                    *h_ptr.add(idx) = clamped_h as i16;
                    *b_ptr.add(idx) = bio;
                }
            }

            let h_at_norm = |gx: isize, gz: isize, fallback: i32| -> i32 {
                if gx < 0 || gz < 0 || gx >= grid_n as isize || gz >= grid_n as isize {
                    return fallback;
                }
                let ni = (gz as usize) * grid_n + (gx as usize);
                if *skip_ptr.add(ni) == 2 {
                    return fallback;
                }
                *h_ptr.add(ni) as i32
            };

            let neighbor_y = |nx: isize, nz: isize| -> (f32, bool) {
                if nx < 0 || nz < 0 || nx >= grid_n as isize || nz >= grid_n as isize {
                    return ((water_level - 20) as f32, true);
                }
                let ni = (nz as usize) * grid_n + (nx as usize);
                if *skip_ptr.add(ni) == 2 {
                    return ((water_level - 20) as f32, true);
                }
                let nh = *h_ptr.add(ni) as i32;
                let ny = if nh <= water_level { wl_f + 0.72 + y_bias } else { (nh as f32) + 0.82 + y_bias };
                (ny, false)
            };

            for gz in 0..grid_n {
                let z0 = (orig_z + (gz as i32) * step) as f32;
                let z1 = z0 + step_f;
                for gx in 0..grid_n {
                    let idx = gz * grid_n + gx;
                    if *skip_ptr.add(idx) != 0 {
                        continue;
                    }
                    let x0 = (orig_x + (gx as i32) * step) as f32;
                    let x1 = x0 + step_f;
                    let h = *h_ptr.add(idx) as i32;
                    let bio = *b_ptr.add(idx);
                    let is_water = h <= water_level;
                    let top_y = if is_water { wl_f + 0.72 + y_bias } else { (h as f32) + 0.82 + y_bias };

                    let (mut r, mut g, mut b) = biome_lod_rgb(bio, h, water_level);
                    if !is_water && h >= 42
                        && bio != terrain::B_DESERT
                        && bio != terrain::B_MESA
                        && bio != terrain::B_BADLANDS_SPIRES
                        && bio != terrain::B_BADLANDS_CRATER
                        && bio != terrain::B_VOLCANIC_BASALT
                    {
                        let snow_t = (((h - 42) as f32) * 0.045).min(0.82);
                        r = r + (0.90 - r) * snow_t;
                        g = g + (0.94 - g) * snow_t;
                        b = b + (0.98 - b) * snow_t;
                    }
                    let grain = (crate::hash2i_f64(gx as i32, gz as i32, seed.wrapping_add(if is_outer { 271 } else { 131 })) - 0.5) * 0.07;
                    r = (r + grain as f32).max(0.05).min(0.98);
                    g = (g + grain as f32).max(0.05).min(0.98);
                    b = (b + grain as f32).max(0.05).min(0.98);

                    let gx_i = gx as isize;
                    let gz_i = gz as isize;
                    let top_norm = if is_water {
                        [0.0, 1.0, 0.0]
                    } else {
                        let hx = (h_at_norm(gx_i - 1, gz_i, h) - h_at_norm(gx_i + 1, gz_i, h)) as f32;
                        let hz = (h_at_norm(gx_i, gz_i - 1, h) - h_at_norm(gx_i, gz_i + 1, h)) as f32;
                        let hy = 2.0 * step_f;
                        let inv_len = 1.0 / (hx * hx + hy * hy + hz * hz).sqrt();
                        [hx * inv_len, hy * inv_len, hz * inv_len]
                    };

                    if !emit_lod_quad(
                        pos_ptr, norm_ptr, col_ptr, idx_ptr, &mut v_count, &mut i_count,
                        [[x0, top_y, z1], [x1, top_y, z1], [x1, top_y, z0], [x0, top_y, z0]],
                        top_norm,
                        [r, g, b],
                    ) {
                        return;
                    }
                    cells_emitted += 1;

                    let sr = (r * 0.74).min(0.84);
                    let sg = (g * 0.72).min(0.84);
                    let sb = (b * 0.74).min(0.84);

                    let (y_xp, b_xp) = neighbor_y(gx_i + 1, gz_i);
                    if top_y > y_xp + 0.05 {
                        let bot = if b_xp { (top_y - extra_skirt).max((water_level - 24) as f32) } else { y_xp.max(top_y - extra_skirt) };
                        let _ = emit_lod_quad(
                            pos_ptr, norm_ptr, col_ptr, idx_ptr, &mut v_count, &mut i_count,
                            [[x1, bot, z1], [x1, bot, z0], [x1, top_y, z0], [x1, top_y, z1]],
                            [1.0, 0.0, 0.0],
                            [sr, sg, sb],
                        );
                    }
                    let (y_xm, b_xm) = neighbor_y(gx_i - 1, gz_i);
                    if top_y > y_xm + 0.05 {
                        let bot = if b_xm { (top_y - extra_skirt).max((water_level - 24) as f32) } else { y_xm.max(top_y - extra_skirt) };
                        let _ = emit_lod_quad(
                            pos_ptr, norm_ptr, col_ptr, idx_ptr, &mut v_count, &mut i_count,
                            [[x0, bot, z0], [x0, bot, z1], [x0, top_y, z1], [x0, top_y, z0]],
                            [-1.0, 0.0, 0.0],
                            [sr, sg, sb],
                        );
                    }
                    let (y_zp, b_zp) = neighbor_y(gx_i, gz_i + 1);
                    if top_y > y_zp + 0.05 {
                        let bot = if b_zp { (top_y - extra_skirt).max((water_level - 24) as f32) } else { y_zp.max(top_y - extra_skirt) };
                        let _ = emit_lod_quad(
                            pos_ptr, norm_ptr, col_ptr, idx_ptr, &mut v_count, &mut i_count,
                            [[x0, bot, z1], [x1, bot, z1], [x1, top_y, z1], [x0, top_y, z1]],
                            [0.0, 0.0, 1.0],
                            [sr * 0.94, sg * 0.94, sb * 0.94],
                        );
                    }
                    let (y_zm, b_zm) = neighbor_y(gx_i, gz_i - 1);
                    if top_y > y_zm + 0.05 {
                        let bot = if b_zm { (top_y - extra_skirt).max((water_level - 24) as f32) } else { y_zm.max(top_y - extra_skirt) };
                        let _ = emit_lod_quad(
                            pos_ptr, norm_ptr, col_ptr, idx_ptr, &mut v_count, &mut i_count,
                            [[x1, bot, z0], [x0, bot, z0], [x0, top_y, z0], [x1, top_y, z0]],
                            [0.0, 0.0, -1.0],
                            [sr * 0.94, sg * 0.94, sb * 0.94],
                        );
                    }
                }
            }
        };

        // Pass 1+2: Ring 1 (near-far detail, drops slightly at rim to seal Ring 1 -> Ring 2 edge)
        emit_ring(step1, r1, 0.0, 44.0, false);
        // Pass 3+4: Ring 2 (mega horizon up to r2=768, sunk -0.35m so overlap never z-fights)
        emit_ring(step2, r2, -0.35, 56.0, true);

        *meta_ptr.add(0) = v_count as u32;
        *meta_ptr.add(1) = i_count as u32;
        *meta_ptr.add(2) = cells_emitted;
        *meta_ptr.add(3) = r2 as u32;
        v_count as u32
    }
}
