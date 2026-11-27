use core::ptr::{addr_of, addr_of_mut};

pub const CHUNK_W: usize = 16;
pub const WORLD_H: usize = 256;
pub const CHUNK_VOXELS: usize = CHUNK_W * WORLD_H * CHUNK_W; // 65536
pub const BLOCK_LUT_CAP: usize = 2048;
pub const MAX_TILES: usize = 1024;
pub const BORDER_LEN: usize = 4 * 4096 + 4 * 256; // 17408
pub const MAX_MESH_VERTS: usize = 65536;
pub const MAX_MESH_INDICES: usize = 98304;

pub static mut CHUNK_DATA: [u16; CHUNK_VOXELS] = [0; CHUNK_VOXELS];
static mut BORDER_BUF: [u16; BORDER_LEN] = [0; BORDER_LEN];
static mut AUTUMN_CELL: [u8; 16] = [0; 16];

static mut LUT_OPAQUE: [u8; BLOCK_LUT_CAP] = [0; BLOCK_LUT_CAP];
static mut LUT_FLAGS: [u16; BLOCK_LUT_CAP] = [0; BLOCK_LUT_CAP];
// [tile_top, tile_side, tile_bot, front_tile_or_0xffff, both_z_front]
static mut LUT_BLOCK_TILES: [u16; BLOCK_LUT_CAP * 5] = [0xffff; BLOCK_LUT_CAP * 5];
// [u0, u1, v0, v1]
static mut LUT_TILE_UV: [f32; MAX_TILES * 4] = [0.0; MAX_TILES * 4];

static mut SLICE_EMITTERS: [f32; crate::MAX_EMITTERS_LEN] = [0.0; crate::MAX_EMITTERS_LEN];

static mut MESH_POS: [f32; MAX_MESH_VERTS * 3] = [0.0; MAX_MESH_VERTS * 3];
static mut MESH_NORM: [f32; MAX_MESH_VERTS * 3] = [0.0; MAX_MESH_VERTS * 3];
static mut MESH_UV: [f32; MAX_MESH_VERTS * 2] = [0.0; MAX_MESH_VERTS * 2];
static mut MESH_COL: [f32; MAX_MESH_VERTS * 3] = [0.0; MAX_MESH_VERTS * 3];
static mut MESH_BL: [f32; MAX_MESH_VERTS * 3] = [0.0; MAX_MESH_VERTS * 3];
static mut MESH_IDX: [u32; MAX_MESH_INDICES] = [0; MAX_MESH_INDICES];
static mut SPECIAL_VOXELS: [u16; CHUNK_VOXELS] = [0; CHUNK_VOXELS];
// [v_count, i_count, special_count, overflow_flag]
static mut MESH_META: [u32; 4] = [0; 4];

const AO_LUT: [f32; 4] = [1.0, 0.84, 0.68, 0.50];

struct FaceSpec {
    dir: [i32; 3],
    tile_idx: usize,
    corners: [[f32; 3]; 4],
    u_axis: [i32; 3],
    v_axis: [i32; 3],
}

const FACES: [FaceSpec; 6] = [
    FaceSpec {
        dir: [0, 1, 0],
        tile_idx: 0,
        corners: [[0.0, 1.0, 1.0], [1.0, 1.0, 1.0], [1.0, 1.0, 0.0], [0.0, 1.0, 0.0]],
        u_axis: [1, 0, 0],
        v_axis: [0, 0, -1],
    },
    FaceSpec {
        dir: [0, -1, 0],
        tile_idx: 2,
        corners: [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [0.0, 0.0, 1.0]],
        u_axis: [1, 0, 0],
        v_axis: [0, 0, 1],
    },
    FaceSpec {
        dir: [1, 0, 0],
        tile_idx: 1,
        corners: [[1.0, 0.0, 1.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0], [1.0, 1.0, 1.0]],
        u_axis: [0, 0, -1],
        v_axis: [0, 1, 0],
    },
    FaceSpec {
        dir: [-1, 0, 0],
        tile_idx: 1,
        corners: [[0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0, 1.0], [0.0, 1.0, 0.0]],
        u_axis: [0, 0, 1],
        v_axis: [0, 1, 0],
    },
    FaceSpec {
        dir: [0, 0, 1],
        tile_idx: 1,
        corners: [[0.0, 0.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 1.0], [0.0, 1.0, 1.0]],
        u_axis: [1, 0, 0],
        v_axis: [0, 1, 0],
    },
    FaceSpec {
        dir: [0, 0, -1],
        tile_idx: 1,
        corners: [[1.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 0.0]],
        u_axis: [-1, 0, 0],
        v_axis: [0, 1, 0],
    },
];

#[no_mangle]
pub extern "C" fn chunk_data_ptr() -> *mut u16 {
    addr_of_mut!(CHUNK_DATA) as *mut u16
}
#[no_mangle]
pub extern "C" fn border_buf_ptr() -> *mut u16 {
    addr_of_mut!(BORDER_BUF) as *mut u16
}
#[no_mangle]
pub extern "C" fn autumn_cell_ptr() -> *mut u8 {
    addr_of_mut!(AUTUMN_CELL) as *mut u8
}
#[no_mangle]
pub extern "C" fn lut_opaque_ptr() -> *mut u8 {
    addr_of_mut!(LUT_OPAQUE) as *mut u8
}
#[no_mangle]
pub extern "C" fn lut_flags_ptr() -> *mut u16 {
    addr_of_mut!(LUT_FLAGS) as *mut u16
}
#[no_mangle]
pub extern "C" fn lut_block_tiles_ptr() -> *mut u16 {
    addr_of_mut!(LUT_BLOCK_TILES) as *mut u16
}
#[no_mangle]
pub extern "C" fn lut_tile_uv_ptr() -> *mut f32 {
    addr_of_mut!(LUT_TILE_UV) as *mut f32
}
#[no_mangle]
pub extern "C" fn mesh_pos_ptr() -> *const f32 {
    addr_of!(MESH_POS) as *const f32
}
#[no_mangle]
pub extern "C" fn mesh_norm_ptr() -> *const f32 {
    addr_of!(MESH_NORM) as *const f32
}
#[no_mangle]
pub extern "C" fn mesh_uv_ptr() -> *const f32 {
    addr_of!(MESH_UV) as *const f32
}
#[no_mangle]
pub extern "C" fn mesh_col_ptr() -> *const f32 {
    addr_of!(MESH_COL) as *const f32
}
#[no_mangle]
pub extern "C" fn mesh_bl_ptr() -> *const f32 {
    addr_of!(MESH_BL) as *const f32
}
#[no_mangle]
pub extern "C" fn mesh_idx_ptr() -> *const u32 {
    addr_of!(MESH_IDX) as *const u32
}
#[no_mangle]
pub extern "C" fn special_voxels_ptr() -> *const u16 {
    addr_of!(SPECIAL_VOXELS) as *const u16
}
#[no_mangle]
pub extern "C" fn mesh_meta_ptr() -> *const u32 {
    addr_of!(MESH_META) as *const u32
}

#[inline(always)]
unsafe fn is_opaque_id(opaque_ptr: *const u8, id: u16) -> u8 {
    let idx = id as usize;
    if idx < BLOCK_LUT_CAP {
        *opaque_ptr.add(idx)
    } else {
        0
    }
}

#[inline(always)]
unsafe fn sample_in_bounds(
    data: *const u16,
    border: *const u16,
    lx: i32,
    ly: usize,
    lz: i32,
) -> u16 {
    if lx >= 0 && lx < 16 && lz >= 0 && lz < 16 {
        return *data.add((ly << 8) | ((lz as usize) << 4) | (lx as usize));
    }
    if lx == 16 && lz >= 0 && lz < 16 {
        return *border.add((ly << 4) | (lz as usize));
    }
    if lx == -1 && lz >= 0 && lz < 16 {
        return *border.add(4096 + ((ly << 4) | (lz as usize)));
    }
    if lz == 16 && lx >= 0 && lx < 16 {
        return *border.add(8192 + ((ly << 4) | (lx as usize)));
    }
    if lz == -1 && lx >= 0 && lx < 16 {
        return *border.add(12288 + ((ly << 4) | (lx as usize)));
    }
    if lx == 16 && lz == 16 {
        return *border.add(16384 + ly);
    }
    if lx == 16 && lz == -1 {
        return *border.add(16640 + ly);
    }
    if lx == -1 && lz == 16 {
        return *border.add(16896 + ly);
    }
    if lx == -1 && lz == -1 {
        return *border.add(17152 + ly);
    }
    0
}

#[inline(always)]
#[allow(clippy::too_many_arguments)]
unsafe fn get_fast_block(
    data: *const u16,
    border: *const u16,
    opaque_ptr: *const u8,
    min_y: i32,
    water_level: i32,
    d_off: i32,
    is_end: bool,
    water_id: u16,
    seagrass_id: u16,
    lava_id: u16,
    bedrock_id: u16,
    deepslate_id: u16,
    lx: i32,
    ly: i32,
    lz: i32,
) -> u16 {
    if ly < 0 {
        if is_end {
            return 0;
        }
        if d_off > 0 {
            let ty = (min_y + ly) - d_off;
            if ty <= -1001 {
                return bedrock_id;
            }
            let edge_b = sample_in_bounds(data, border, lx, 0, lz);
            if edge_b == water_id || edge_b == seagrass_id {
                return water_id;
            }
            if edge_b == lava_id {
                return lava_id;
            }
            if edge_b == 0 {
                return 0;
            }
            return deepslate_id;
        }
        return bedrock_id;
    }
    if ly >= WORLD_H as i32 {
        if d_off > 0 && !is_end {
            let ty = (min_y + ly) - d_off;
            let edge_b = sample_in_bounds(data, border, lx, WORLD_H - 1, lz);
            if ty <= water_level && (edge_b == water_id || edge_b == seagrass_id) {
                return water_id;
            }
            if is_opaque_id(opaque_ptr, edge_b) != 0 {
                return deepslate_id;
            }
        }
        return 0;
    }
    sample_in_bounds(data, border, lx, ly as usize, lz)
}

#[inline(always)]
unsafe fn eval_slice_light(
    lx: f32,
    ly: f32,
    lz: f32,
    slice_ptr: *const f32,
    slice_len: usize,
    fast_light: bool,
    s_min_x: f32,
    s_max_x: f32,
    s_min_z: f32,
    s_max_z: f32,
) -> (f32, f32, f32) {
    if slice_len == 0 || (fast_light && (lx < s_min_x || lx > s_max_x || lz < s_min_z || lz > s_max_z)) {
        return (0.0, 0.0, 0.0);
    }
    let mut r = 0.0f32;
    let mut g = 0.0f32;
    let mut b = 0.0f32;
    let mut i = 0usize;
    while i + 6 < slice_len {
        let rad2 = *slice_ptr.add(i + 6);
        let dy = ly - *slice_ptr.add(i + 1);
        let dy2 = dy * dy;
        if dy2 < rad2 {
            let dx = lx - *slice_ptr.add(i);
            let dxy2 = dy2 + dx * dx;
            if dxy2 < rad2 {
                let dz = lz - *slice_ptr.add(i + 2);
                let d2 = dxy2 + dz * dz;
                if d2 < rad2 {
                    let u = 1.0 - d2 / rad2;
                    let att2 = u * (0.58 + 0.42 * u);
                    r += *slice_ptr.add(i + 3) * att2;
                    g += *slice_ptr.add(i + 4) * att2;
                    b += *slice_ptr.add(i + 5) * att2;
                }
            }
        }
        i += 7;
    }
    (
        (r / (1.0 + r * 0.32)).min(1.35),
        (g / (1.0 + g * 0.32)).min(1.35),
        (b / (1.0 + b * 0.32)).min(1.35),
    )
}

#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn mesh_chunk_solid(
    wx0: i32,
    wz0: i32,
    min_y: i32,
    water_level: i32,
    d_off: i32,
    max_ly_in: u32,
    em_len_in: u32,
    flags_bits: u32,
    grass_id: u16,
    autumn_podzol_id: u16,
    water_id: u16,
    seagrass_id: u16,
    lava_id: u16,
    bedrock_id: u16,
    deepslate_id: u16,
    blk_solid_flag: u16,
) -> u32 {
    let compute_ao = (flags_bits & 1) != 0;
    let cull_bottom_bedrock = (flags_bits & 2) != 0;
    let is_end = (flags_bits & 4) != 0;
    let is_overworld = (flags_bits & 8) != 0;
    let all_ocean_nbr = (flags_bits & 16) != 0;
    let has_fluid_levels = (flags_bits & 32) != 0;
    let fast_light = (flags_bits & 64) != 0;

    let max_ly = (max_ly_in as usize).min(WORLD_H - 1);
    let em_len = (em_len_in as usize).min(crate::MAX_EMITTERS_LEN);

    let data = addr_of!(CHUNK_DATA) as *const u16;
    let border = addr_of!(BORDER_BUF) as *const u16;
    let autumn_ptr = addr_of!(AUTUMN_CELL) as *const u8;
    let opaque_ptr = addr_of!(LUT_OPAQUE) as *const u8;
    let flags_ptr = addr_of!(LUT_FLAGS) as *const u16;
    let tiles_ptr = addr_of!(LUT_BLOCK_TILES) as *const u16;
    let uv_ptr = addr_of!(LUT_TILE_UV) as *const f32;
    let em_ptr = addr_of!(crate::EMITTERS_BUF) as *const f32;
    let slice_ptr = addr_of_mut!(SLICE_EMITTERS) as *mut f32;

    let pos_ptr = addr_of_mut!(MESH_POS) as *mut f32;
    let norm_ptr = addr_of_mut!(MESH_NORM) as *mut f32;
    let m_uv_ptr = addr_of_mut!(MESH_UV) as *mut f32;
    let col_ptr = addr_of_mut!(MESH_COL) as *mut f32;
    let bl_ptr = addr_of_mut!(MESH_BL) as *mut f32;
    let idx_ptr = addr_of_mut!(MESH_IDX) as *mut u32;
    let spec_ptr = addr_of_mut!(SPECIAL_VOXELS) as *mut u16;
    let meta_ptr = addr_of_mut!(MESH_META) as *mut u32;

    let mut v_count: usize = 0;
    let mut i_count: usize = 0;
    let mut spec_count: usize = 0;

    unsafe {
        let podzol_ok = (autumn_podzol_id as usize) < BLOCK_LUT_CAP
            && *tiles_ptr.add((autumn_podzol_id as usize) * 5) != 0xffff;

        for ly in 0..=max_ly {
            let wy = min_y + (ly as i32);
            let y_off = ly << 8;
            let uni_id = *data.add(y_off);
            if uni_id == 0
                || (uni_id == water_id
                    && all_ocean_nbr
                    && !has_fluid_levels
                    && ly > 0
                    && (wy - d_off) < water_level)
            {
                let mut all_same = true;
                let mut k = 1usize;
                while k < 256 {
                    if *data.add(y_off | k) != uni_id {
                        all_same = false;
                        break;
                    }
                    k += 1;
                }
                if all_same {
                    continue;
                }
            }

            let mut slice_len = 0usize;
            let mut s_min_x = 999.0f32;
            let mut s_max_x = -999.0f32;
            let mut s_min_z = 999.0f32;
            let mut s_max_z = -999.0f32;
            if em_len > 0 {
                let cy_mid = (ly as f32) + 0.5;
                let mut ei = 0usize;
                while ei + 6 < em_len {
                    let dy = cy_mid - *em_ptr.add(ei + 1);
                    let rad2 = *em_ptr.add(ei + 6);
                    if dy * dy <= rad2 + 48.0 {
                        let ex = *em_ptr.add(ei);
                        let ez = *em_ptr.add(ei + 2);
                        let r_pad = rad2.sqrt() + 1.5;
                        *slice_ptr.add(slice_len) = ex;
                        *slice_ptr.add(slice_len + 1) = *em_ptr.add(ei + 1);
                        *slice_ptr.add(slice_len + 2) = ez;
                        *slice_ptr.add(slice_len + 3) = *em_ptr.add(ei + 3);
                        *slice_ptr.add(slice_len + 4) = *em_ptr.add(ei + 4);
                        *slice_ptr.add(slice_len + 5) = *em_ptr.add(ei + 5);
                        *slice_ptr.add(slice_len + 6) = rad2;
                        slice_len += 7;
                        if ex - r_pad < s_min_x {
                            s_min_x = ex - r_pad;
                        }
                        if ex + r_pad > s_max_x {
                            s_max_x = ex + r_pad;
                        }
                        if ez - r_pad < s_min_z {
                            s_min_z = ez - r_pad;
                        }
                        if ez + r_pad > s_max_z {
                            s_max_z = ez + r_pad;
                        }
                    }
                    ei += 7;
                }
            }

            let in_y = ly > 0 && ly < WORLD_H - 1;
            let ly_i = ly as i32;
            let wy_f = wy as f32;

            for lz in 0..16usize {
                let z_off = y_off | (lz << 4);
                let wz_f = (wz0 + (lz as i32)) as f32;
                let in_z = lz > 0 && lz < 15;
                let lz_i = lz as i32;

                for lx in 0..16usize {
                    let c_idx = z_off | lx;
                    let id = *data.add(c_idx);
                    if id == 0 {
                        continue;
                    }
                    let id_u = id as usize;
                    let flags = if id_u < BLOCK_LUT_CAP {
                        *flags_ptr.add(id_u)
                    } else {
                        0
                    };
                    if flags != blk_solid_flag {
                        *spec_ptr.add(spec_count) = c_idx as u16;
                        spec_count += 1;
                        continue;
                    }
                    if id_u >= BLOCK_LUT_CAP || *tiles_ptr.add(id_u * 5) == 0xffff {
                        continue;
                    }

                    let lx_i = lx as i32;
                    let is_int = in_y && in_z && lx > 0 && lx < 15;
                    if is_int {
                        if is_opaque_id(opaque_ptr, *data.add(c_idx + 1)) != 0
                            && is_opaque_id(opaque_ptr, *data.add(c_idx - 1)) != 0
                            && is_opaque_id(opaque_ptr, *data.add(c_idx + 256)) != 0
                            && is_opaque_id(opaque_ptr, *data.add(c_idx - 256)) != 0
                            && is_opaque_id(opaque_ptr, *data.add(c_idx + 16)) != 0
                            && is_opaque_id(opaque_ptr, *data.add(c_idx - 16)) != 0
                        {
                            continue;
                        }
                    } else if is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, lx_i + 1, ly_i, lz_i)) != 0
                        && is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, lx_i - 1, ly_i, lz_i)) != 0
                        && is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, lx_i, ly_i + 1, lz_i)) != 0
                        && is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, lx_i, ly_i - 1, lz_i)) != 0
                        && is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, lx_i, ly_i, lz_i + 1)) != 0
                        && is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, lx_i, ly_i, lz_i - 1)) != 0
                    {
                        continue;
                    }

                    let use_id_u = if id == grass_id && is_overworld && podzol_ok {
                        let ac_idx = ((lz >> 2) << 2) | (lx >> 2);
                        if *autumn_ptr.add(ac_idx) == 1 {
                            autumn_podzol_id as usize
                        } else {
                            id_u
                        }
                    } else {
                        id_u
                    };
                    let tile_base = use_id_u * 5;
                    let front_tile = *tiles_ptr.add(tile_base + 3);
                    let both_z = *tiles_ptr.add(tile_base + 4) != 0;
                    let wx_f = (wx0 + lx_i) as f32;

                    for f in 0..6usize {
                        if f == 1 && ly == 0 && cull_bottom_bedrock {
                            continue;
                        }
                        let face = &FACES[f];
                        let dx = face.dir[0];
                        let dy = face.dir[1];
                        let dz = face.dir[2];
                        let nlx = lx_i + dx;
                        let nly = ly_i + dy;
                        let nlz = lz_i + dz;

                        let nb = if nlx >= 0 && nlx < 16 && nlz >= 0 && nlz < 16 && nly >= 0 && nly < WORLD_H as i32 {
                            *data.add(((nly as usize) << 8) | ((nlz as usize) << 4) | (nlx as usize))
                        } else {
                            get_fast_block(
                                data, border, opaque_ptr, min_y, water_level, d_off, is_end,
                                water_id, seagrass_id, lava_id, bedrock_id, deepslate_id,
                                nlx, nly, nlz,
                            )
                        };
                        if is_opaque_id(opaque_ptr, nb) != 0 {
                            continue;
                        }
                        if v_count + 4 > MAX_MESH_VERTS || i_count + 6 > MAX_MESH_INDICES {
                            *meta_ptr.add(0) = v_count as u32;
                            *meta_ptr.add(1) = i_count as u32;
                            *meta_ptr.add(2) = spec_count as u32;
                            *meta_ptr.add(3) = 1;
                            return 0xFFFF_FFFF;
                        }

                        let (lr, lg, lb) = eval_slice_light(
                            (nlx as f32) + 0.5,
                            (nly as f32) + 0.5,
                            (nlz as f32) + 0.5,
                            slice_ptr,
                            slice_len,
                            fast_light,
                            s_min_x,
                            s_max_x,
                            s_min_z,
                            s_max_z,
                        );

                        let mut ao0 = 1.0f32;
                        let mut ao1 = 1.0f32;
                        let mut ao2 = 1.0f32;
                        let mut ao3 = 1.0f32;
                        if compute_ao {
                            let uxa = face.u_axis[0];
                            let uya = face.u_axis[1];
                            let uza = face.u_axis[2];
                            let vxa = face.v_axis[0];
                            let vya = face.v_axis[1];
                            let vza = face.v_axis[2];
                            let nl_int = nlx > 0 && nlx < 15 && nlz > 0 && nlz < 15 && nly > 0 && nly < (WORLD_H as i32) - 1;
                            if nl_int {
                                let n_idx = (((nly as usize) << 8) | ((nlz as usize) << 4) | (nlx as usize)) as isize;
                                let u_off = ((uya << 8) + (uza << 4) + uxa) as isize;
                                let v_off = ((vya << 8) + (vza << 4) + vxa) as isize;
                                for c in 0..4usize {
                                    let su: isize = if c == 1 || c == 2 { 1 } else { -1 };
                                    let sv: isize = if c == 2 || c == 3 { 1 } else { -1 };
                                    let s1 = is_opaque_id(opaque_ptr, *data.offset(n_idx + u_off * su));
                                    let s2 = is_opaque_id(opaque_ptr, *data.offset(n_idx + v_off * sv));
                                    let cn = is_opaque_id(opaque_ptr, *data.offset(n_idx + u_off * su + v_off * sv));
                                    let ao = if s1 != 0 && s2 != 0 { 0.50 } else { AO_LUT[(s1 + s2 + cn) as usize] };
                                    match c {
                                        0 => ao0 = ao,
                                        1 => ao1 = ao,
                                        2 => ao2 = ao,
                                        _ => ao3 = ao,
                                    }
                                }
                            } else {
                                for c in 0..4usize {
                                    let su = if c == 1 || c == 2 { 1 } else { -1 };
                                    let sv = if c == 2 || c == 3 { 1 } else { -1 };
                                    let ux = uxa * su;
                                    let uy = uya * su;
                                    let uz = uza * su;
                                    let vx = vxa * sv;
                                    let vy = vya * sv;
                                    let vz = vza * sv;
                                    let s1 = is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, nlx + ux, nly + uy, nlz + uz));
                                    let s2 = is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, nlx + vx, nly + vy, nlz + vz));
                                    let cn = is_opaque_id(opaque_ptr, get_fast_block(data, border, opaque_ptr, min_y, water_level, d_off, is_end, water_id, seagrass_id, lava_id, bedrock_id, deepslate_id, nlx + ux + vx, nly + uy + vy, nlz + uz + vz));
                                    let ao = if s1 != 0 && s2 != 0 { 0.50 } else { AO_LUT[(s1 + s2 + cn) as usize] };
                                    match c {
                                        0 => ao0 = ao,
                                        1 => ao1 = ao,
                                        2 => ao2 = ao,
                                        _ => ao3 = ao,
                                    }
                                }
                            }
                        }

                        let vc = v_count;
                        let vp = vc * 3;
                        let dxf = dx as f32;
                        let dyf = dy as f32;
                        let dzf = dz as f32;
                        let aos = [ao0, ao1, ao2, ao3];
                        for c in 0..4usize {
                            let p_off = vp + c * 3;
                            let aoc = aos[c];
                            *pos_ptr.add(p_off) = wx_f + face.corners[c][0];
                            *pos_ptr.add(p_off + 1) = wy_f + face.corners[c][1];
                            *pos_ptr.add(p_off + 2) = wz_f + face.corners[c][2];
                            *norm_ptr.add(p_off) = dxf;
                            *norm_ptr.add(p_off + 1) = dyf;
                            *norm_ptr.add(p_off + 2) = dzf;
                            *col_ptr.add(p_off) = aoc;
                            *col_ptr.add(p_off + 1) = aoc;
                            *col_ptr.add(p_off + 2) = aoc;
                            *bl_ptr.add(p_off) = lr;
                            *bl_ptr.add(p_off + 1) = lg;
                            *bl_ptr.add(p_off + 2) = lb;
                        }

                        let tile = if front_tile != 0xffff && (dz == 1 || (both_z && dz == -1)) {
                            front_tile as usize
                        } else {
                            *tiles_ptr.add(tile_base + face.tile_idx) as usize
                        };
                        let t_off = (tile.min(MAX_TILES - 1)) * 4;
                        let u0 = *uv_ptr.add(t_off);
                        let u1 = *uv_ptr.add(t_off + 1);
                        let v0 = *uv_ptr.add(t_off + 2);
                        let v1 = *uv_ptr.add(t_off + 3);
                        let up = vc * 2;
                        *m_uv_ptr.add(up) = u0;
                        *m_uv_ptr.add(up + 1) = v1;
                        *m_uv_ptr.add(up + 2) = u1;
                        *m_uv_ptr.add(up + 3) = v1;
                        *m_uv_ptr.add(up + 4) = u1;
                        *m_uv_ptr.add(up + 5) = v0;
                        *m_uv_ptr.add(up + 6) = u0;
                        *m_uv_ptr.add(up + 7) = v0;

                        let vc32 = vc as u32;
                        let ip = i_count;
                        if ao0 + ao2 > ao1 + ao3 {
                            *idx_ptr.add(ip) = vc32;
                            *idx_ptr.add(ip + 1) = vc32 + 1;
                            *idx_ptr.add(ip + 2) = vc32 + 2;
                            *idx_ptr.add(ip + 3) = vc32;
                            *idx_ptr.add(ip + 4) = vc32 + 2;
                            *idx_ptr.add(ip + 5) = vc32 + 3;
                        } else {
                            *idx_ptr.add(ip) = vc32 + 1;
                            *idx_ptr.add(ip + 1) = vc32 + 2;
                            *idx_ptr.add(ip + 2) = vc32 + 3;
                            *idx_ptr.add(ip + 3) = vc32 + 1;
                            *idx_ptr.add(ip + 4) = vc32 + 3;
                            *idx_ptr.add(ip + 5) = vc32;
                        }
                        v_count = vc + 4;
                        i_count = ip + 6;
                    }
                }
            }
        }

        *meta_ptr.add(0) = v_count as u32;
        *meta_ptr.add(1) = i_count as u32;
        *meta_ptr.add(2) = spec_count as u32;
        *meta_ptr.add(3) = 0;
        v_count as u32
    }
}
