use core::ptr::{addr_of, addr_of_mut};

use crate::codec::{CODEC_CAP_BYTES, CODEC_IN};
use crate::mesher::{BLOCK_LUT_CAP, CHUNK_DATA, LUT_FLAGS};
use crate::{ATLAS_BUMP_BUF, ATLAS_RGBA_BUF, MAX_ATLAS_BYTES};

pub const SCAN_MAX_EMIT_ENTRIES: usize = 160;
pub const SCAN_MAX_SPEC_ENTRIES: usize = 96;
pub const RT_VOL_BYTES: usize = 512 * 256 * 4;
pub const ITEM_MAX_VERTS: usize = 6144;
pub const ITEM_MAX_INDICES: usize = 9216;

// [r, g, b, rad2] per block id
static mut LUT_EMIT_INFO: [f32; BLOCK_LUT_CAP * 4] = [0.0; BLOCK_LUT_CAP * 4];
// bits 0..1: 0=none, 1=primary, 2=secondary, 3=sampled_lava; bit 2 (0x04)=candle_0.45y; bit 3 (0x08)=spec_node
static mut LUT_EMIT_META: [u8; BLOCK_LUT_CAP] = [0; BLOCK_LUT_CAP];
static mut LUT_MAP_U32: [u32; BLOCK_LUT_CAP] = [0; BLOCK_LUT_CAP];
static mut LUT_RT_PACK: [u8; BLOCK_LUT_CAP * 4] = [0; BLOCK_LUT_CAP * 4];

// [lx+0.5, ly+y_off, lz+0.5, r, g, b, rad2, bid_f32]
static mut SCAN_EMITTERS_OUT: [f32; SCAN_MAX_EMIT_ENTRIES * 8] = [0.0; SCAN_MAX_EMIT_ENTRIES * 8];
static mut SCAN_SEC_TMP: [f32; 96 * 8] = [0.0; 96 * 8];
// [lx, ly, lz, bid_f32]
static mut SCAN_SPEC_OUT: [f32; SCAN_MAX_SPEC_ENTRIES * 4] = [0.0; SCAN_MAX_SPEC_ENTRIES * 4];
static mut SCAN_TOPMAP_H: [i16; 256] = [0; 256];
static mut SCAN_MINIMAP_U32: [u32; 256] = [0; 256];
// [primary_count, combined_emit_count, spec_count, non_empty_cols]
static mut SCAN_META_OUT: [u32; 4] = [0; 4];

static mut RT_VOL_OUT: [u8; RT_VOL_BYTES] = [0; RT_VOL_BYTES];

static mut ITEM_RGBA_IN: [u8; 16 * 16 * 4] = [0; 16 * 16 * 4];
static mut ITEM_POS_OUT: [f32; ITEM_MAX_VERTS * 3] = [0.0; ITEM_MAX_VERTS * 3];
static mut ITEM_NORM_OUT: [f32; ITEM_MAX_VERTS * 3] = [0.0; ITEM_MAX_VERTS * 3];
static mut ITEM_COL_OUT: [f32; ITEM_MAX_VERTS * 3] = [0.0; ITEM_MAX_VERTS * 3];
static mut ITEM_IDX_OUT: [u32; ITEM_MAX_INDICES] = [0; ITEM_MAX_INDICES];
static mut ITEM_META_OUT: [u32; 2] = [0; 2];

#[no_mangle]
pub extern "C" fn lut_emit_info_ptr() -> *mut f32 {
    addr_of_mut!(LUT_EMIT_INFO) as *mut f32
}
#[no_mangle]
pub extern "C" fn lut_emit_meta_ptr() -> *mut u8 {
    addr_of_mut!(LUT_EMIT_META) as *mut u8
}
#[no_mangle]
pub extern "C" fn lut_map_u32_ptr() -> *mut u32 {
    addr_of_mut!(LUT_MAP_U32) as *mut u32
}
#[no_mangle]
pub extern "C" fn lut_rt_pack_ptr() -> *mut u8 {
    addr_of_mut!(LUT_RT_PACK) as *mut u8
}
#[no_mangle]
pub extern "C" fn scan_emitters_out_ptr() -> *const f32 {
    addr_of!(SCAN_EMITTERS_OUT) as *const f32
}
#[no_mangle]
pub extern "C" fn scan_spec_out_ptr() -> *const f32 {
    addr_of!(SCAN_SPEC_OUT) as *const f32
}
#[no_mangle]
pub extern "C" fn scan_topmap_h_ptr() -> *const i16 {
    addr_of!(SCAN_TOPMAP_H) as *const i16
}
#[no_mangle]
pub extern "C" fn scan_minimap_u32_ptr() -> *const u32 {
    addr_of!(SCAN_MINIMAP_U32) as *const u32
}
#[no_mangle]
pub extern "C" fn scan_meta_out_ptr() -> *const u32 {
    addr_of!(SCAN_META_OUT) as *const u32
}
#[no_mangle]
pub extern "C" fn rt_vol_out_ptr() -> *const u8 {
    addr_of!(RT_VOL_OUT) as *const u8
}
#[no_mangle]
pub extern "C" fn item_rgba_in_ptr() -> *mut u8 {
    addr_of_mut!(ITEM_RGBA_IN) as *mut u8
}
#[no_mangle]
pub extern "C" fn item_pos_out_ptr() -> *const f32 {
    addr_of!(ITEM_POS_OUT) as *const f32
}
#[no_mangle]
pub extern "C" fn item_norm_out_ptr() -> *const f32 {
    addr_of!(ITEM_NORM_OUT) as *const f32
}
#[no_mangle]
pub extern "C" fn item_col_out_ptr() -> *const f32 {
    addr_of!(ITEM_COL_OUT) as *const f32
}
#[no_mangle]
pub extern "C" fn item_idx_out_ptr() -> *const u32 {
    addr_of!(ITEM_IDX_OUT) as *const u32
}
#[no_mangle]
pub extern "C" fn item_meta_out_ptr() -> *const u32 {
    addr_of!(ITEM_META_OUT) as *const u32
}

#[no_mangle]
pub extern "C" fn scan_chunk_emitters_and_topmap(
    max_ly: u32,
    max_entries: u32,
    blk_cross_flag: u32,
    default_map_u32: u32,
) -> u32 {
    let top_cap = (max_ly as usize).min(255);
    let cap_entries = (max_entries as usize).min(SCAN_MAX_EMIT_ENTRIES);
    let data = addr_of!(CHUNK_DATA) as *const u16;
    let flags = addr_of!(LUT_FLAGS) as *const u16;
    let emit_info = addr_of!(LUT_EMIT_INFO) as *const f32;
    let emit_meta = addr_of!(LUT_EMIT_META) as *const u8;
    let map_u32 = addr_of!(LUT_MAP_U32) as *const u32;
    let prim_out = addr_of_mut!(SCAN_EMITTERS_OUT) as *mut f32;
    let sec_tmp = addr_of_mut!(SCAN_SEC_TMP) as *mut f32;
    let spec_out = addr_of_mut!(SCAN_SPEC_OUT) as *mut f32;
    let top_h_out = addr_of_mut!(SCAN_TOPMAP_H) as *mut i16;
    let map_out = addr_of_mut!(SCAN_MINIMAP_U32) as *mut u32;
    let meta_out = addr_of_mut!(SCAN_META_OUT) as *mut u32;

    let mut prim_cnt: usize = 0;
    let mut sec_cnt: usize = 0;
    let mut spec_cnt: usize = 0;
    let mut non_empty: u32 = 0;
    let cross_mask = blk_cross_flag as u16;

    let mut lz: usize = 0;
    while lz < 16 {
        let z_off = lz << 4;
        let mut lx: usize = 0;
        while lx < 16 {
            let col_base = z_off | lx;
            let mut found_top = false;
            let mut top_y: i16 = 0;
            let mut col_color: u32 = default_map_u32;

            let mut ly: i32 = top_cap as i32;
            while ly >= 0 {
                let uly = ly as usize;
                let bid = unsafe { *data.add((uly << 8) | col_base) } as usize;
                if bid != 0 && bid < BLOCK_LUT_CAP {
                    if !found_top {
                        let f = unsafe { *flags.add(bid) };
                        if (f & cross_mask) == 0 {
                            found_top = true;
                            top_y = uly as i16;
                            col_color = unsafe { *map_u32.add(bid) };
                            non_empty += 1;
                        }
                    }
                    let em_m = unsafe { *emit_meta.add(bid) };
                    if em_m != 0 {
                        if (em_m & 0x08) != 0 && spec_cnt < SCAN_MAX_SPEC_ENTRIES {
                            let sb = spec_cnt * 4;
                            unsafe {
                                *spec_out.add(sb) = lx as f32;
                                *spec_out.add(sb + 1) = uly as f32;
                                *spec_out.add(sb + 2) = lz as f32;
                                *spec_out.add(sb + 3) = bid as f32;
                            }
                            spec_cnt += 1;
                        }
                        let mode = em_m & 0x03;
                        let sampled_ok = mode == 1
                            || mode == 2
                            || (mode == 3 && (lx & 3) == 0 && (lz & 3) == 0 && (uly & 1) == 0);
                        if sampled_ok {
                            let y_off = if (em_m & 0x04) != 0 { 0.45 } else { 0.5 };
                            let ei = bid * 4;
                            unsafe {
                                let rad2 = *emit_info.add(ei + 3);
                                if rad2 > 0.0 {
                                    let r = *emit_info.add(ei);
                                    let g = *emit_info.add(ei + 1);
                                    let b = *emit_info.add(ei + 2);
                                    if mode == 1 && prim_cnt < cap_entries {
                                        let o = prim_cnt * 8;
                                        *prim_out.add(o) = (lx as f32) + 0.5;
                                        *prim_out.add(o + 1) = (uly as f32) + y_off;
                                        *prim_out.add(o + 2) = (lz as f32) + 0.5;
                                        *prim_out.add(o + 3) = r;
                                        *prim_out.add(o + 4) = g;
                                        *prim_out.add(o + 5) = b;
                                        *prim_out.add(o + 6) = rad2;
                                        *prim_out.add(o + 7) = bid as f32;
                                        prim_cnt += 1;
                                    } else if mode >= 2 && sec_cnt < 96 {
                                        let o = sec_cnt * 8;
                                        *sec_tmp.add(o) = (lx as f32) + 0.5;
                                        *sec_tmp.add(o + 1) = (uly as f32) + y_off;
                                        *sec_tmp.add(o + 2) = (lz as f32) + 0.5;
                                        *sec_tmp.add(o + 3) = r;
                                        *sec_tmp.add(o + 4) = g;
                                        *sec_tmp.add(o + 5) = b;
                                        *sec_tmp.add(o + 6) = rad2;
                                        *sec_tmp.add(o + 7) = bid as f32;
                                        sec_cnt += 1;
                                    }
                                }
                            }
                        }
                    }
                }
                ly -= 1;
            }
            unsafe {
                *top_h_out.add(col_base) = top_y;
                *map_out.add(col_base) = col_color;
            }
            lx += 1;
        }
        lz += 1;
    }

    let mut total = prim_cnt;
    let mut si: usize = 0;
    while si < sec_cnt && total < cap_entries {
        let src = si * 8;
        let dst = total * 8;
        unsafe {
            let mut k = 0;
            while k < 8 {
                *prim_out.add(dst + k) = *sec_tmp.add(src + k);
                k += 1;
            }
        }
        total += 1;
        si += 1;
    }

    unsafe {
        *meta_out.add(0) = prim_cnt as u32;
        *meta_out.add(1) = total as u32;
        *meta_out.add(2) = spec_cnt as u32;
        *meta_out.add(3) = non_empty;
    }
    total as u32
}

#[no_mangle]
pub extern "C" fn rt_vol_clear() -> u32 {
    unsafe {
        core::ptr::write_bytes(addr_of_mut!(RT_VOL_OUT) as *mut u8, 0, RT_VOL_BYTES);
    }
    RT_VOL_BYTES as u32
}

#[no_mangle]
pub extern "C" fn pack_rt_chunk_into_vol(
    wx_base: i32,
    wz_base: i32,
    min_y: i32,
    ox: i32,
    oy: i32,
    oz: i32,
    max_wy_cap: i32,
) -> u32 {
    let x0 = if ox > wx_base { ox } else { wx_base };
    let x1 = if ox + 63 < wx_base + 15 { ox + 63 } else { wx_base + 15 };
    let z0 = if oz > wz_base { oz } else { wz_base };
    let z1 = if oz + 63 < wz_base + 15 { oz + 63 } else { wz_base + 15 };
    if x0 > x1 || z0 > z1 {
        return 0;
    }
    let min_wy = if min_y + 1 > oy { min_y + 1 } else { oy };
    let hi_cap = oy + 31;
    let max_wy = if hi_cap < max_wy_cap { hi_cap } else { max_wy_cap };
    if min_wy > max_wy {
        return 0;
    }

    let data = addr_of!(CHUNK_DATA) as *const u16;
    let lut = addr_of!(LUT_RT_PACK) as *const u8;
    let out = addr_of_mut!(RT_VOL_OUT) as *mut u8;
    let mut active: u32 = 0;

    let mut wy = min_wy;
    while wy <= max_wy {
        let ly = (wy - min_y) as usize;
        let vy = (wy - oy) as usize;
        if ly < 256 && vy < 32 {
            let tile_x = vy & 7;
            let tile_y = vy >> 3;
            let ly_off = ly << 8;
            let base_tex_x = tile_x * 64 + ((x0 - ox) as usize);
            let base_tex_y = tile_y * 64;
            let mut wz = z0;
            while wz <= z1 {
                let lz = (wz - wz_base) as usize;
                let vz = (wz - oz) as usize;
                let c_row = ly_off | (lz << 4);
                let mut p_idx = ((base_tex_y + vz) * 512 + base_tex_x) * 4;
                let mut wx = x0;
                while wx <= x1 {
                    let bid = unsafe { *data.add(c_row | ((wx - wx_base) as usize)) } as usize;
                    if bid != 0 && bid < BLOCK_LUT_CAP {
                        let lo = bid * 4;
                        unsafe {
                            let kind = *lut.add(lo + 3);
                            if kind != 0 {
                                *out.add(p_idx) = *lut.add(lo);
                                *out.add(p_idx + 1) = *lut.add(lo + 1);
                                *out.add(p_idx + 2) = *lut.add(lo + 2);
                                *out.add(p_idx + 3) = kind;
                                active += 1;
                            }
                        }
                    }
                    p_idx += 4;
                    wx += 1;
                }
                wz += 1;
            }
        }
        wy += 1;
    }
    active
}

#[inline(always)]
unsafe fn item_is_opaque(px_in: *const u8, x: i32, y: i32) -> bool {
    if x < 0 || x >= 16 || y < 0 || y >= 16 {
        return false;
    }
    *px_in.add(((y as usize) * 16 + (x as usize)) * 4 + 3) > 32
}

#[inline(always)]
unsafe fn item_is_interior(px_in: *const u8, x: i32, y: i32, bevel: f32) -> bool {
    bevel > 0.0
        && item_is_opaque(px_in, x, y)
        && item_is_opaque(px_in, x - 1, y)
        && item_is_opaque(px_in, x + 1, y)
        && item_is_opaque(px_in, x, y - 1)
        && item_is_opaque(px_in, x, y + 1)
}

#[allow(clippy::too_many_arguments)]
#[inline(always)]
unsafe fn push_item_quad(
    pos_out: *mut f32,
    norm_out: *mut f32,
    col_out: *mut f32,
    idx_out: *mut u32,
    vc: &mut u32,
    ic: &mut u32,
    a: [f32; 3],
    b: [f32; 3],
    c: [f32; 3],
    d: [f32; 3],
    n: [f32; 3],
    r: f32,
    g: f32,
    bl: f32,
) {
    let base_v = *vc as usize;
    let base_f = base_v * 3;
    let pts = [a, b, c, d];
    let mut k = 0usize;
    while k < 4 {
        let f = base_f + k * 3;
        *pos_out.add(f) = pts[k][0];
        *pos_out.add(f + 1) = pts[k][1];
        *pos_out.add(f + 2) = pts[k][2];
        *norm_out.add(f) = n[0];
        *norm_out.add(f + 1) = n[1];
        *norm_out.add(f + 2) = n[2];
        *col_out.add(f) = r;
        *col_out.add(f + 1) = g;
        *col_out.add(f + 2) = bl;
        k += 1;
    }
    let io = *ic as usize;
    let v0 = *vc;
    *idx_out.add(io) = v0;
    *idx_out.add(io + 1) = v0 + 1;
    *idx_out.add(io + 2) = v0 + 2;
    *idx_out.add(io + 3) = v0;
    *idx_out.add(io + 4) = v0 + 2;
    *idx_out.add(io + 5) = v0 + 3;
    *vc += 4;
    *ic += 6;
}

#[no_mangle]
pub extern "C" fn extrude_voxel_item_16x16(px: f32, half_d: f32, bevel: f32) -> u32 {
    let px_in = addr_of!(ITEM_RGBA_IN) as *const u8;
    let pos_out = addr_of_mut!(ITEM_POS_OUT) as *mut f32;
    let norm_out = addr_of_mut!(ITEM_NORM_OUT) as *mut f32;
    let col_out = addr_of_mut!(ITEM_COL_OUT) as *mut f32;
    let idx_out = addr_of_mut!(ITEM_IDX_OUT) as *mut u32;
    let meta_out = addr_of_mut!(ITEM_META_OUT) as *mut u32;

    let mut vc: u32 = 0;
    let mut ic: u32 = 0;
    let nb_dx: [i32; 4] = [0, 0, 1, -1];
    let nb_dy: [i32; 4] = [-1, 1, 0, 0];

    let mut y: i32 = 0;
    while y < 16 {
        let mut x: i32 = 0;
        while x < 16 {
            unsafe {
                if !item_is_opaque(px_in, x, y) {
                    x += 1;
                    continue;
                }
                let pi = ((y as usize) * 16 + (x as usize)) * 4;
                let r = (*px_in.add(pi) as f32) / 255.0;
                let g = (*px_in.add(pi + 1) as f32) / 255.0;
                let bl = (*px_in.add(pi + 2) as f32) / 255.0;
                let intr = item_is_interior(px_in, x, y, bevel);
                let x0 = ((x - 8) as f32) * px;
                let x1 = x0 + px;
                let y0 = ((8 - y - 1) as f32) * px;
                let y1 = y0 + px;
                let depth = half_d + if intr { bevel } else { 0.0 };
                let z0 = -depth;
                let z1 = depth;

                push_item_quad(
                    pos_out, norm_out, col_out, idx_out, &mut vc, &mut ic,
                    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
                    [0.0, 0.0, 1.0], r, g, bl,
                );
                push_item_quad(
                    pos_out, norm_out, col_out, idx_out, &mut vc, &mut ic,
                    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0],
                    [0.0, 0.0, -1.0], r * 0.95, g * 0.95, bl * 0.95,
                );

                let emit_side = |dir: usize, z_lo: f32, z_hi: f32, vc: &mut u32, ic: &mut u32| {
                    if dir == 0 {
                        push_item_quad(
                            pos_out, norm_out, col_out, idx_out, vc, ic,
                            [x0, y1, z_hi], [x1, y1, z_hi], [x1, y1, z_lo], [x0, y1, z_lo],
                            [0.0, 1.0, 0.0],
                            if r * 1.06 < 1.0 { r * 1.06 } else { 1.0 },
                            if g * 1.06 < 1.0 { g * 1.06 } else { 1.0 },
                            if bl * 1.06 < 1.0 { bl * 1.06 } else { 1.0 },
                        );
                    } else if dir == 1 {
                        push_item_quad(
                            pos_out, norm_out, col_out, idx_out, vc, ic,
                            [x0, y0, z_lo], [x1, y0, z_lo], [x1, y0, z_hi], [x0, y0, z_hi],
                            [0.0, -1.0, 0.0], r * 0.78, g * 0.78, bl * 0.78,
                        );
                    } else if dir == 2 {
                        push_item_quad(
                            pos_out, norm_out, col_out, idx_out, vc, ic,
                            [x1, y0, z_hi], [x1, y0, z_lo], [x1, y1, z_lo], [x1, y1, z_hi],
                            [1.0, 0.0, 0.0], r * 0.90, g * 0.90, bl * 0.90,
                        );
                    } else {
                        push_item_quad(
                            pos_out, norm_out, col_out, idx_out, vc, ic,
                            [x0, y0, z_lo], [x0, y0, z_hi], [x0, y1, z_hi], [x0, y1, z_lo],
                            [-1.0, 0.0, 0.0], r * 0.86, g * 0.86, bl * 0.86,
                        );
                    }
                };

                let mut d: usize = 0;
                while d < 4 {
                    let nx = x + nb_dx[d];
                    let ny = y + nb_dy[d];
                    if !item_is_opaque(px_in, nx, ny) {
                        emit_side(d, z0, z1, &mut vc, &mut ic);
                    } else if intr && !item_is_interior(px_in, nx, ny, bevel) {
                        emit_side(d, half_d, z1, &mut vc, &mut ic);
                        emit_side(d, z0, -half_d, &mut vc, &mut ic);
                    }
                    d += 1;
                }
            }
            x += 1;
        }
        y += 1;
    }

    unsafe {
        *meta_out.add(0) = vc;
        *meta_out.add(1) = ic;
    }
    ic
}

#[no_mangle]
pub extern "C" fn build_solid_atlas_rgba(width: u32, height: u32, tile_px: u32) -> u32 {
    let w = width as usize;
    let h = height as usize;
    let tp = tile_px as usize;
    let total_bytes = w * h * 4;
    if tp == 0 || total_bytes == 0 || total_bytes > MAX_ATLAS_BYTES {
        return 0;
    }
    let src = addr_of!(ATLAS_RGBA_BUF) as *const u8;
    let dst = addr_of_mut!(ATLAS_BUMP_BUF) as *mut u8;
    unsafe {
        core::ptr::copy_nonoverlapping(src, dst, total_bytes);
    }

    let mut tiles_filled: u32 = 0;
    let mut ty: usize = 0;
    while ty + tp <= h {
        let mut tx: usize = 0;
        while tx + tp <= w {
            let mut r0: u32 = 0;
            let mut g0: u32 = 0;
            let mut b0: u32 = 0;
            let mut n: u32 = 0;
            let mut y: usize = 0;
            while y < tp {
                let mut x: usize = 0;
                while x < tp {
                    let i = ((ty + y) * w + (tx + x)) * 4;
                    unsafe {
                        if *dst.add(i + 3) > 40 {
                            r0 += *dst.add(i) as u32;
                            g0 += *dst.add(i + 1) as u32;
                            b0 += *dst.add(i + 2) as u32;
                            n += 1;
                        }
                    }
                    x += 1;
                }
                y += 1;
            }
            if n > 0 {
                let nf = n as f32;
                let ar = ((r0 as f32) / nf * 0.62) as u8;
                let ag = ((g0 as f32) / nf * 0.66) as u8;
                let ab = ((b0 as f32) / nf * 0.62) as u8;
                let mut y2: usize = 0;
                while y2 < tp {
                    let mut x2: usize = 0;
                    while x2 < tp {
                        let i = ((ty + y2) * w + (tx + x2)) * 4;
                        unsafe {
                            if *dst.add(i + 3) <= 40 {
                                *dst.add(i) = ar;
                                *dst.add(i + 1) = ag;
                                *dst.add(i + 2) = ab;
                                *dst.add(i + 3) = 255;
                            }
                        }
                        x2 += 1;
                    }
                    y2 += 1;
                }
                tiles_filled += 1;
            }
            tx += tp;
        }
        ty += tp;
    }
    tiles_filled
}

#[no_mangle]
pub extern "C" fn crc32_bytes(len: u32) -> u32 {
    let n = (len as usize).min(CODEC_CAP_BYTES);
    let ptr = addr_of!(CODEC_IN) as *const u8;
    let mut crc: u32 = 0xFFFF_FFFF;
    let mut i: usize = 0;
    while i < n {
        let b = unsafe { *ptr.add(i) } as u32;
        crc ^= b;
        let mut bit = 0;
        while bit < 8 {
            crc = if (crc & 1) != 0 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
            bit += 1;
        }
        i += 1;
    }
    !crc
}

// ===== ABI v6: Zero-GC 32x32 Chunk Queue Sorter, Multiplayer Entity Interpolator & Per-Tile Mip Baker =====
pub const MAX_CHUNK_QUEUE: usize = 2048;
pub const MAX_NET_ENTS: usize = 128;
pub const NET_ENT_STRIDE: usize = 12;

static mut CHUNK_Q_COORDS: [i32; MAX_CHUNK_QUEUE * 2] = [0; MAX_CHUNK_QUEUE * 2];
static mut CHUNK_Q_SCORES: [f32; MAX_CHUNK_QUEUE] = [0.0; MAX_CHUNK_QUEUE];
static mut CHUNK_Q_ORDER: [u32; MAX_CHUNK_QUEUE] = [0; MAX_CHUNK_QUEUE];
static mut NET_ENT_BUF: [f32; MAX_NET_ENTS * NET_ENT_STRIDE] = [0.0; MAX_NET_ENTS * NET_ENT_STRIDE];

#[no_mangle]
pub extern "C" fn chunk_q_coords_ptr() -> *mut i32 {
    addr_of_mut!(CHUNK_Q_COORDS) as *mut i32
}

#[no_mangle]
pub extern "C" fn chunk_q_order_ptr() -> *const u32 {
    addr_of!(CHUNK_Q_ORDER) as *const u32
}

#[no_mangle]
pub extern "C" fn net_ent_buf_ptr() -> *mut f32 {
    addr_of_mut!(NET_ENT_BUF) as *mut f32
}

/// Scores & sorts up to 2048 chunk coordinates in descending priority score
/// (so JS pops highest-priority lowest-score chunk from tail in O(1)).
#[no_mangle]
pub extern "C" fn sort_chunk_stream_queue(
    count: u32,
    pcx: i32,
    pcz: i32,
    fwd_x: f32,
    fwd_z: f32,
    acx: i32,
    acz: i32,
) -> u32 {
    let n = (count as usize).min(MAX_CHUNK_QUEUE);
    if n == 0 {
        return 0;
    }
    let coords = addr_of!(CHUNK_Q_COORDS) as *const i32;
    let scores = addr_of_mut!(CHUNK_Q_SCORES) as *mut f32;
    let order = addr_of_mut!(CHUNK_Q_ORDER) as *mut u32;

    let mut i: usize = 0;
    while i < n {
        let cx = unsafe { *coords.add(i * 2) };
        let cz = unsafe { *coords.add(i * 2 + 1) };
        let dx = (cx - pcx) as f32;
        let dz = (cz - pcz) as f32;
        let d2 = dx * dx + dz * dz;
        let mut sc = if d2 <= 2.0 {
            d2 * 0.25
        } else {
            let inv_len = 1.0 / (d2.sqrt() + 1e-5);
            let dot = (dx * fwd_x + dz * fwd_z) * inv_len;
            let cone = if dot >= 0.35 {
                0.52
            } else if dot >= -0.10 {
                0.84
            } else {
                1.48
            };
            d2 * cone
        };
        let adx = (cx - acx) as f32;
        let adz = (cz - acz) as f32;
        sc += (adx * adx + adz * adz) * 0.14;
        unsafe {
            *scores.add(i) = sc;
            *order.add(i) = i as u32;
        }
        i += 1;
    }

    // Shell sort (Ciura gaps) descending by score — zero allocation, ~0.04ms for 1089 chunks
    const GAPS: [usize; 8] = [701, 301, 132, 57, 23, 10, 4, 1];
    let mut g_idx = 0usize;
    while g_idx < GAPS.len() {
        let gap = GAPS[g_idx];
        let mut k = gap;
        while k < n {
            let cur_idx = unsafe { *order.add(k) };
            let cur_sc = unsafe { *scores.add(cur_idx as usize) };
            let mut j = k;
            while j >= gap {
                let prev_idx = unsafe { *order.add(j - gap) };
                let prev_sc = unsafe { *scores.add(prev_idx as usize) };
                if prev_sc >= cur_sc {
                    break;
                }
                unsafe {
                    *order.add(j) = prev_idx;
                }
                j -= gap;
            }
            unsafe {
                *order.add(j) = cur_idx;
            }
            k += 1;
        }
        g_idx += 1;
    }
    n as u32
}

#[inline(always)]
fn wrap_pi_f32(mut a: f32) -> f32 {
    const PI: f32 = 3.14159265;
    const TWO_PI: f32 = 6.28318530;
    while a > PI {
        a -= TWO_PI;
    }
    while a < -PI {
        a += TWO_PI;
    }
    a
}

/// Batch frame-rate-independent multiplayer remote player / mob smoother in Rust WASM.
/// Layout per entity (stride 12): [x, y, z, yaw, pitch, tx, ty, tz, tyaw, tpitch, vx, vz]
#[no_mangle]
pub extern "C" fn interp_net_entities(count: u32, dt: f32, max_snap_dist: f32) -> u32 {
    let n = (count as usize).min(MAX_NET_ENTS);
    if n == 0 {
        return 0;
    }
    let buf = addr_of_mut!(NET_ENT_BUF) as *mut f32;
    let safe_dt = if dt < 0.001 {
        0.001
    } else if dt > 0.1 {
        0.1
    } else {
        dt
    };
    // Critically-smooth frame-rate-independent exponential convergence (zero velocity-lead overshoot/rubberbanding)
    let pos_t = 1.0 - (-24.0 * safe_dt).exp();
    let rot_t = 1.0 - (-28.0 * safe_dt).exp();
    let max_d2 = max_snap_dist * max_snap_dist;
    let mut i: usize = 0;
    while i < n {
        let base = i * NET_ENT_STRIDE;
        unsafe {
            let x = *buf.add(base);
            let y = *buf.add(base + 1);
            let z = *buf.add(base + 2);
            let yaw = *buf.add(base + 3);
            let pitch = *buf.add(base + 4);
            let tx = *buf.add(base + 5);
            let ty = *buf.add(base + 6);
            let tz = *buf.add(base + 7);
            let tyaw = *buf.add(base + 8);
            let tpitch = *buf.add(base + 9);
            let _vx = *buf.add(base + 10);
            let _vz = *buf.add(base + 11);

            let dx = tx - x;
            let dy = ty - y;
            let dz = tz - z;
            let d2 = dx * dx + dy * dy + dz * dz;
            if d2 > max_d2 {
                *buf.add(base) = tx;
                *buf.add(base + 1) = ty;
                *buf.add(base + 2) = tz;
                *buf.add(base + 3) = tyaw;
                *buf.add(base + 4) = tpitch;
            } else if d2 < 1e-6 {
                *buf.add(base) = tx;
                *buf.add(base + 1) = ty;
                *buf.add(base + 2) = tz;
                *buf.add(base + 3) = wrap_pi_f32(yaw + wrap_pi_f32(tyaw - yaw) * rot_t);
                *buf.add(base + 4) = pitch + (tpitch - pitch) * rot_t;
            } else {
                *buf.add(base) = x + dx * pos_t;
                *buf.add(base + 1) = y + dy * pos_t;
                *buf.add(base + 2) = z + dz * pos_t;
                *buf.add(base + 3) = wrap_pi_f32(yaw + wrap_pi_f32(tyaw - yaw) * rot_t);
                *buf.add(base + 4) = pitch + (tpitch - pitch) * rot_t;
            }
        }
        i += 1;
    }
    n as u32
}

// ===== ABI v7: Batch Nearest-Player Mob Targeting & O(M^2) Crowd Separation in Rust WASM =====
pub const MAX_MOB_AI: usize = 128;
pub const MAX_PLAYERS_AI: usize = 16;
static mut MOB_AI_IN: [f32; MAX_MOB_AI * 4] = [0.0; MAX_MOB_AI * 4]; // [x, y, z, hitbox_r (<0 skips ground sep)]
static mut PLAYER_POS_IN: [f32; MAX_PLAYERS_AI * 3] = [0.0; MAX_PLAYERS_AI * 3]; // [px, py, pz]
static mut MOB_AI_OUT: [f32; MAX_MOB_AI * 4] = [0.0; MAX_MOB_AI * 4]; // [nearest_p_idx, nearest_d2_3d, sep_x, sep_z]

#[no_mangle]
pub extern "C" fn mob_ai_in_ptr() -> *mut f32 {
    addr_of_mut!(MOB_AI_IN) as *mut f32
}

#[no_mangle]
pub extern "C" fn player_pos_in_ptr() -> *mut f32 {
    addr_of_mut!(PLAYER_POS_IN) as *mut f32
}

#[no_mangle]
pub extern "C" fn mob_ai_out_ptr() -> *const f32 {
    addr_of!(MOB_AI_OUT) as *const f32
}

/// Computes strictly nearest alive player (no hard target lock) AND soft crowd separation for up to 128 mobs in one zero-GC pass.
#[no_mangle]
pub extern "C" fn solve_mob_targets_and_sep(mob_count: u32, player_count: u32, do_sep: u32) -> u32 {
    let m_n = (mob_count as usize).min(MAX_MOB_AI);
    let p_n = (player_count as usize).min(MAX_PLAYERS_AI);
    if m_n == 0 {
        return 0;
    }
    let m_in = addr_of!(MOB_AI_IN) as *const f32;
    let p_in = addr_of!(PLAYER_POS_IN) as *const f32;
    let m_out = addr_of_mut!(MOB_AI_OUT) as *mut f32;
    let run_sep = do_sep != 0 && m_n <= 64;

    let mut i: usize = 0;
    while i < m_n {
        let mb = i * 4;
        unsafe {
            let mx = *m_in.add(mb);
            let my = *m_in.add(mb + 1);
            let mz = *m_in.add(mb + 2);
            let mr = *m_in.add(mb + 3);

            // 1) Nearest alive player across all players in same dimension
            let mut best_p: i32 = -1;
            let mut best_d2: f32 = 1.0e18;
            let mut pi: usize = 0;
            while pi < p_n {
                let pb = pi * 3;
                let dx = *p_in.add(pb) - mx;
                let dy = *p_in.add(pb + 1) - my;
                let dz = *p_in.add(pb + 2) - mz;
                let d2 = dx * dx + dy * dy + dz * dz;
                if d2 < best_d2 {
                    best_d2 = d2;
                    best_p = pi as i32;
                }
                pi += 1;
            }

            // 2) Soft horizontal crowd separation for ground mobs (mr > 0)
            let mut sep_x: f32 = 0.0;
            let mut sep_z: f32 = 0.0;
            if run_sep && mr > 0.0 {
                let min_crowd = if mr * 1.9 > 0.72 { mr * 1.9 } else { 0.72 };
                let min_crowd2 = min_crowd * min_crowd;
                let mut j: usize = 0;
                while j < m_n {
                    if j != i {
                        let ob = j * 4;
                        let orad = *m_in.add(ob + 3);
                        if orad > 0.0 {
                            let oy = *m_in.add(ob + 1);
                            let dy_o = my - oy;
                            if dy_o > -1.4 && dy_o < 1.4 {
                                let sdx = mx - *m_in.add(ob);
                                let sdz = mz - *m_in.add(ob + 2);
                                if sdx > -min_crowd && sdx < min_crowd && sdz > -min_crowd && sdz < min_crowd {
                                    let sd2 = sdx * sdx + sdz * sdz;
                                    if sd2 > 0.0004 && sd2 < min_crowd2 {
                                        let sd = sd2.sqrt();
                                        let push = ((min_crowd - sd) / min_crowd) * 1.55 / sd;
                                        sep_x += sdx * push;
                                        sep_z += sdz * push;
                                    }
                                }
                            }
                        }
                    }
                    j += 1;
                }
            }

            *m_out.add(mb) = best_p as f32;
            *m_out.add(mb + 1) = best_d2;
            *m_out.add(mb + 2) = sep_x;
            *m_out.add(mb + 3) = sep_z;
        }
        i += 1;
    }
    m_n as u32
}

/// Zero-bleed per-tile 2x2 alpha-weighted box filter downsampler for crisp Minecraft mipmaps.
/// Reads ATLAS_RGBA_BUF (src_w x src_h) and writes half-res RGBA into ATLAS_BUMP_BUF.
#[no_mangle]
pub extern "C" fn build_atlas_mip_rgba(src_w: u32, src_h: u32, tile_px: u32) -> u32 {
    let sw = src_w as usize;
    let sh = src_h as usize;
    let tp = tile_px as usize;
    if sw < 2 || sh < 2 || tp < 2 || (sw & 1) != 0 || (sh & 1) != 0 {
        return 0;
    }
    let src_bytes = sw * sh * 4;
    if src_bytes > MAX_ATLAS_BYTES {
        return 0;
    }
    let dw = sw >> 1;
    let dh = sh >> 1;
    let src = addr_of!(ATLAS_RGBA_BUF) as *const u8;
    let dst = addr_of_mut!(ATLAS_BUMP_BUF) as *mut u8;

    let mut dy: usize = 0;
    while dy < dh {
        let sy0 = dy << 1;
        let sy1 = sy0 + 1;
        let mut dx: usize = 0;
        while dx < dw {
            let sx0 = dx << 1;
            let sx1 = sx0 + 1;
            let p0 = (sy0 * sw + sx0) * 4;
            let p1 = (sy0 * sw + sx1) * 4;
            let p2 = (sy1 * sw + sx0) * 4;
            let p3 = (sy1 * sw + sx1) * 4;
            let mut r_sum: u32 = 0;
            let mut g_sum: u32 = 0;
            let mut b_sum: u32 = 0;
            let mut a_sum: u32 = 0;
            let mut w_sum: u32 = 0;
            for &p in &[p0, p1, p2, p3] {
                unsafe {
                    let a = *src.add(p + 3) as u32;
                    a_sum += a;
                    if a > 12 {
                        r_sum += (*src.add(p) as u32) * a;
                        g_sum += (*src.add(p + 1) as u32) * a;
                        b_sum += (*src.add(p + 2) as u32) * a;
                        w_sum += a;
                    }
                }
            }
            let out = (dy * dw + dx) * 4;
            unsafe {
                if w_sum > 0 {
                    *dst.add(out) = (r_sum / w_sum).min(255) as u8;
                    *dst.add(out + 1) = (g_sum / w_sum).min(255) as u8;
                    *dst.add(out + 2) = (b_sum / w_sum).min(255) as u8;
                } else {
                    *dst.add(out) = 0;
                    *dst.add(out + 1) = 0;
                    *dst.add(out + 2) = 0;
                }
                *dst.add(out + 3) = ((a_sum + 2) >> 2).min(255) as u8;
            }
            dx += 1;
        }
        dy += 1;
    }
    (dw * dh * 4) as u32
}
