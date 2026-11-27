use core::ptr::{addr_of, addr_of_mut};

const CAVE_GRID_X: usize = 5;
const CAVE_GRID_Y: usize = 65;
const CAVE_GRID_Z: usize = 5;
const COARSE_LEN: usize = CAVE_GRID_X * CAVE_GRID_Y * CAVE_GRID_Z; // 1625
const MAX_EMITTERS_LEN: usize = 3584; // up to 512 emitters * 7 floats

static mut COARSE_GRID: [f32; COARSE_LEN] = [0.0; COARSE_LEN];
static mut EMITTERS_BUF: [f32; MAX_EMITTERS_LEN] = [0.0; MAX_EMITTERS_LEN];
static mut LIGHT_OUT: [f32; 3] = [0.0; 3];

#[inline(always)]
fn js_floor(x: f64) -> i32 {
    x.floor() as i32
}

#[inline(always)]
fn hash2i_f64(x: i32, z: i32, seed: i32) -> f64 {
    let mut h = x
        .wrapping_mul(374761393)
        .wrapping_add(z.wrapping_mul(668265263))
        .wrapping_add(seed.wrapping_mul(1442695041));
    h ^= ((h as u32) >> 13) as i32;
    h = h.wrapping_mul(1274126177);
    let u = (h as u32) ^ ((h as u32) >> 16);
    (u as f64) * 2.3283064365386963e-10
}

#[inline(always)]
fn hash3i_f64(x: i32, y: i32, z: i32, seed: i32) -> f64 {
    let mut h = x
        .wrapping_mul(374761393)
        .wrapping_add(y.wrapping_mul(668265263))
        .wrapping_add(z.wrapping_mul(2147483647))
        .wrapping_add(seed.wrapping_mul(1442695041));
    h ^= ((h as u32) >> 13) as i32;
    h = h.wrapping_mul(1274126177);
    let u = (h as u32) ^ ((h as u32) >> 16);
    (u as f64) * 2.3283064365386963e-10
}

#[no_mangle]
pub extern "C" fn wasm_abi_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn coarse_grid_ptr() -> *const f32 {
    addr_of!(COARSE_GRID) as *const f32
}

#[no_mangle]
pub extern "C" fn emitters_buf_ptr() -> *mut f32 {
    addr_of_mut!(EMITTERS_BUF) as *mut f32
}

#[no_mangle]
pub extern "C" fn light_out_ptr() -> *const f32 {
    addr_of!(LIGHT_OUT) as *const f32
}

#[no_mangle]
pub extern "C" fn value_noise_2d(x: f64, z: f64, seed: i32) -> f64 {
    let xi = js_floor(x);
    let zi = js_floor(z);
    let xf = x - (xi as f64);
    let zf = z - (zi as f64);
    let u = xf * xf * (3.0 - 2.0 * xf);
    let v = zf * zf * (3.0 - 2.0 * zf);
    let a = hash2i_f64(xi, zi, seed);
    let b = hash2i_f64(xi + 1, zi, seed);
    let c = hash2i_f64(xi, zi + 1, seed);
    let d = hash2i_f64(xi + 1, zi + 1, seed);
    let ab = a + (b - a) * u;
    let cd = c + (d - c) * u;
    ab + (cd - ab) * v
}

#[no_mangle]
pub extern "C" fn value_noise_3d(x: f64, y: f64, z: f64, seed: i32) -> f64 {
    let xi = js_floor(x);
    let yi = js_floor(y);
    let zi = js_floor(z);
    let xf = x - (xi as f64);
    let yf = y - (yi as f64);
    let zf = z - (zi as f64);
    let u = xf * xf * (3.0 - 2.0 * xf);
    let v = yf * yf * (3.0 - 2.0 * yf);
    let w = zf * zf * (3.0 - 2.0 * zf);

    let x00 = hash3i_f64(xi, yi, zi, seed)
        + (hash3i_f64(xi + 1, yi, zi, seed) - hash3i_f64(xi, yi, zi, seed)) * u;
    let x10 = hash3i_f64(xi, yi + 1, zi, seed)
        + (hash3i_f64(xi + 1, yi + 1, zi, seed) - hash3i_f64(xi, yi + 1, zi, seed)) * u;
    let x01 = hash3i_f64(xi, yi, zi + 1, seed)
        + (hash3i_f64(xi + 1, yi, zi + 1, seed) - hash3i_f64(xi, yi, zi + 1, seed)) * u;
    let x11 = hash3i_f64(xi, yi + 1, zi + 1, seed)
        + (hash3i_f64(xi + 1, yi + 1, zi + 1, seed) - hash3i_f64(xi, yi + 1, zi + 1, seed)) * u;

    let y0 = x00 + (x10 - x00) * v;
    let y1 = x01 + (x11 - x01) * v;
    y0 + (y1 - y0) * w
}

#[no_mangle]
pub extern "C" fn fbm_2d(
    x: f64,
    z: f64,
    octaves: i32,
    persistence: f64,
    lacunarity: f64,
    seed: i32,
) -> f64 {
    let mut val = 0.0;
    let mut amp = 1.0;
    let mut freq = 1.0;
    let mut max_amp = 0.0;
    let mut i = 0;
    while i < octaves {
        val += value_noise_2d(x * freq, z * freq, seed.wrapping_add(i.wrapping_mul(97))) * amp;
        max_amp += amp;
        amp *= persistence;
        freq *= lacunarity;
        i += 1;
    }
    if max_amp > 0.0 {
        val / max_amp
    } else {
        0.0
    }
}

#[no_mangle]
pub extern "C" fn compute_coarse_cave_grid(
    wx0: i32,
    wz0: i32,
    ox: f64,
    oy: f64,
    oz: f64,
    c1: i32,
    c2: i32,
    c3: i32,
    c4: i32,
    d_off: i32,
    min_y: i32,
) -> u32 {
    let grid_ptr = addr_of_mut!(COARSE_GRID) as *mut f32;
    let mut p: usize = 0;
    for gy in 0..CAVE_GRID_Y {
        let wy = min_y + (gy as i32) * 4;
        let true_y = (wy - d_off) as f64;
        let depth_boost = ((-true_y - 12.0) * 0.00038).max(0.0).min(0.13);
        let strata_morph = value_noise_3d(
            ((wx0 as f64) + ox) * 0.006,
            true_y * 0.009,
            ((wz0 as f64) + oz) * 0.006,
            c3,
        );
        let scale_mod = 0.84 + strata_morph * 0.36;

        for gz in 0..CAVE_GRID_Z {
            let wz = (wz0 + (gz as i32) * 4) as f64;
            for gx in 0..CAVE_GRID_X {
                let wx = (wx0 + (gx as i32) * 4) as f64;
                let warp_x = (value_noise_3d(
                    (wx + ox) * 0.019,
                    (true_y + oy) * 0.024,
                    (wz + oz) * 0.019,
                    c4,
                ) - 0.5)
                    * 16.0;
                let warp_y = (value_noise_3d(
                    (wx + ox) * 0.016 - 23.4,
                    (true_y + oy) * 0.020,
                    (wz + oz) * 0.016 + 31.1,
                    c2.wrapping_add(13),
                ) - 0.5)
                    * 9.0;
                let warp_z = (value_noise_3d(
                    (wx + ox) * 0.019 + 47.3,
                    (true_y + oy) * 0.024 - 19.7,
                    (wz + oz) * 0.019 + 11.2,
                    c4.wrapping_add(31),
                ) - 0.5)
                    * 16.0;

                let qx = (wx + warp_x) * scale_mod + ox * 0.5;
                let qy = (true_y + warp_y) + oy * 0.5;
                let qz = (wz + warp_z) * scale_mod + oz * 0.5;

                let ch1 = value_noise_3d(qx * 0.025, qy * 0.035, qz * 0.025, c1);
                let ch2 = value_noise_3d(
                    qx * 0.054 + 19.2,
                    qy * 0.068 - 11.4,
                    qz * 0.054 + 7.8,
                    c1.wrapping_add(43),
                );
                let cheese = ch1 * 0.72 + ch2 * 0.28;
                let pillar = value_noise_2d((wx + ox) * 0.095, (wz + oz) * 0.095, c3);
                let cheese_val = if pillar > 0.76 {
                    cheese - (pillar - 0.76) * 1.25
                } else {
                    cheese
                };

                let sp_a = (value_noise_3d(qx * 0.044, qy * 0.056, qz * 0.044, c2) - 0.5).abs();
                let sp_b = (value_noise_3d(
                    qx * 0.047 + 73.1,
                    qy * 0.055 - 41.9,
                    qz * 0.047 + 29.4,
                    c3,
                ) - 0.5)
                    .abs();
                let spaghetti = (1.0 - (sp_a + sp_b) * 5.0).max(0.0);

                let rav_mask = value_noise_3d(
                    (wx + ox) * 0.009,
                    (true_y + oy) * 0.008,
                    (wz + oz) * 0.009,
                    c1.wrapping_add(77),
                );
                let rav_line =
                    (value_noise_2d(qx * 0.024, qz * 0.024, c2.wrapping_add(53)) - 0.5).abs();
                let ravine = if rav_mask > 0.55 && rav_line < 0.048 {
                    0.88 - rav_line * 5.6
                } else {
                    0.0
                };

                let noodle = value_noise_3d(
                    qx * 0.072,
                    qy * 0.088,
                    qz * 0.072,
                    c4.wrapping_add(19),
                );

                let a = cheese_val * 0.96 + noodle * 0.15 + depth_boost;
                let b = spaghetti * 0.94 + noodle * 0.13 + depth_boost * 0.65;
                let v = a.max(b).max(ravine);
                // Safe bounds: COARSE_GRID has 5 * 65 * 5 = 1625 elements, p increments 0..1624
                unsafe {
                    *grid_ptr.add(p) = v as f32;
                }
                p += 1;
            }
        }
    }
    COARSE_LEN as u32
}

#[no_mangle]
pub extern "C" fn eval_light_slice(lx: f32, ly: f32, lz: f32, slice_len: u32) -> f32 {
    let n = (slice_len as usize).min(MAX_EMITTERS_LEN);
    let em_ptr = addr_of!(EMITTERS_BUF) as *const f32;
    let out_ptr = addr_of_mut!(LIGHT_OUT) as *mut f32;
    let mut r: f32 = 0.0;
    let mut g: f32 = 0.0;
    let mut b: f32 = 0.0;
    let mut i: usize = 0;
    while i + 6 < n {
        unsafe {
            let rad2 = *em_ptr.add(i + 6);
            let dy = ly - *em_ptr.add(i + 1);
            let dy2 = dy * dy;
            if dy2 < rad2 {
                let dx = lx - *em_ptr.add(i);
                let dxy2 = dy2 + dx * dx;
                if dxy2 < rad2 {
                    let dz = lz - *em_ptr.add(i + 2);
                    let d2 = dxy2 + dz * dz;
                    if d2 < rad2 {
                        let u = 1.0 - d2 / rad2;
                        let att2 = u * (0.58 + 0.42 * u);
                        r += *em_ptr.add(i + 3) * att2;
                        g += *em_ptr.add(i + 4) * att2;
                        b += *em_ptr.add(i + 5) * att2;
                    }
                }
            }
        }
        i += 7;
    }
    let sr = (r / (1.0 + r * 0.32)).min(1.35);
    let sg = (g / (1.0 + g * 0.32)).min(1.35);
    let sb = (b / (1.0 + b * 0.32)).min(1.35);
    unsafe {
        *out_ptr.add(0) = sr;
        *out_ptr.add(1) = sg;
        *out_ptr.add(2) = sb;
    }
    sr
}
