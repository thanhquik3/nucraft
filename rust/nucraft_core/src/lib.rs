use core::ptr::{addr_of, addr_of_mut};

mod mesher;
mod terrain;
mod codec;
mod lod;
mod ops;
mod pixelfx;

const CAVE_GRID_X: usize = 5;
const CAVE_GRID_Y: usize = 65;
const CAVE_GRID_Z: usize = 5;
const COARSE_LEN: usize = CAVE_GRID_X * CAVE_GRID_Y * CAVE_GRID_Z; // 1625
pub(crate) const MAX_EMITTERS_LEN: usize = 3584; // up to 512 emitters * 7 floats
const FRAME_OUT_LEN: usize = 16;
pub(crate) const MAX_PARTICLES: usize = 512;
pub(crate) const PARTICLE_STRIDE: usize = 8; // x, y, z, vx, vy, vz, grav, life
const MAX_SPHERES: usize = 256;
pub(crate) const MAX_ATLAS_BYTES: usize = 1_048_576; // fits up to 128 x 1664 x 4 RGBA8888 atlas
const MAX_TILES: usize = 1024;

static mut COARSE_GRID: [f32; COARSE_LEN] = [0.0; COARSE_LEN];
pub(crate) static mut EMITTERS_BUF: [f32; MAX_EMITTERS_LEN] = [0.0; MAX_EMITTERS_LEN];
static mut LIGHT_OUT: [f32; 3] = [0.0; 3];
static mut FRAME_OUT: [f32; FRAME_OUT_LEN] = [0.0; FRAME_OUT_LEN];
pub(crate) static mut PARTICLE_BUF: [f32; MAX_PARTICLES * PARTICLE_STRIDE] = [0.0; MAX_PARTICLES * PARTICLE_STRIDE];
static mut SPHERE_IN: [f32; MAX_SPHERES * 4] = [0.0; MAX_SPHERES * 4];
static mut SPHERE_OUT: [u8; MAX_SPHERES] = [0; MAX_SPHERES];
pub(crate) static mut ATLAS_RGBA_BUF: [u8; MAX_ATLAS_BYTES] = [0; MAX_ATLAS_BYTES];
pub(crate) static mut ATLAS_BUMP_BUF: [u8; MAX_ATLAS_BYTES] = [0; MAX_ATLAS_BYTES];
static mut TILE_MODE_BUF: [u8; MAX_TILES] = [0; MAX_TILES];

#[inline(always)]
fn js_floor(x: f64) -> i32 {
    x.floor() as i32
}

#[inline(always)]
pub(crate) fn sin_approx(x: f64) -> f64 {
    const PI: f64 = 3.14159265358979323846;
    const TWO_PI: f64 = 6.28318530717958647692;
    let mut t = x - (x / TWO_PI).round() * TWO_PI;
    if t > PI * 0.5 {
        t = PI - t;
    } else if t < -PI * 0.5 {
        t = -PI - t;
    }
    let t2 = t * t;
    t * (1.0 - t2 * (1.0 / 6.0 - t2 * (1.0 / 120.0 - t2 * (1.0 / 5040.0 - t2 / 362880.0))))
}

#[inline(always)]
pub(crate) fn cos_approx(x: f64) -> f64 {
    sin_approx(x + 1.5707963267948966)
}

#[inline(always)]
pub(crate) fn hash2i_f64(x: i32, z: i32, seed: i32) -> f64 {
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
pub(crate) fn hash3i_f64(x: i32, y: i32, z: i32, seed: i32) -> f64 {
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
    6
}

#[no_mangle]
pub extern "C" fn atlas_rgba_ptr() -> *mut u8 {
    addr_of_mut!(ATLAS_RGBA_BUF) as *mut u8
}

#[no_mangle]
pub extern "C" fn atlas_bump_ptr() -> *mut u8 {
    addr_of_mut!(ATLAS_BUMP_BUF) as *mut u8
}

#[no_mangle]
pub extern "C" fn tile_mode_ptr() -> *mut u8 {
    addr_of_mut!(TILE_MODE_BUF) as *mut u8
}

#[no_mangle]
pub extern "C" fn frame_out_ptr() -> *const f32 {
    addr_of!(FRAME_OUT) as *const f32
}

#[no_mangle]
pub extern "C" fn particle_buf_ptr() -> *mut f32 {
    addr_of_mut!(PARTICLE_BUF) as *mut f32
}

#[no_mangle]
pub extern "C" fn sphere_in_ptr() -> *mut f32 {
    addr_of_mut!(SPHERE_IN) as *mut f32
}

#[no_mangle]
pub extern "C" fn sphere_out_ptr() -> *const u8 {
    addr_of!(SPHERE_OUT) as *const u8
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

#[no_mangle]
pub extern "C" fn step_env_wind_state(
    time: f32,
    weather: f32,
    px: f32,
    py: f32,
    pz: f32,
    lx: f32,
    ly: f32,
    lz: f32,
    sh_rad: f32,
    sh_size: f32,
) -> u32 {
    let t = time as f64;
    let w = weather as f64;
    let amp = 0.065 * (1.0 + w * 1.45);
    let wind_x = (amp * (sin_approx(t * 1.35) + 0.42 * sin_approx(t * 2.9 + 1.1))) as f32;
    let wind_z = (amp * (cos_approx(t * 1.12) + 0.38 * sin_approx(t * 2.45))) as f32;
    let gust = ((0.5 + 0.5 * sin_approx(t * 0.65)) * (0.4 + 0.6 * w)) as f32;

    // Orthonormal light-space texel snapping eliminates shadow shimmer on pan/rotation
    let ldx = lx as f64;
    let ldy = ly as f64;
    let ldz = lz as f64;
    let llen = (ldx * ldx + ldy * ldy + ldz * ldz).sqrt().max(1e-6);
    let fx = ldx / llen;
    let fy = ldy / llen;
    let fz = ldz / llen;
    let (ux_ref, uy_ref, uz_ref) = if fy.abs() > 0.98 { (0.0, 0.0, 1.0) } else { (0.0, 1.0, 0.0) };
    let mut rx = uy_ref * fz - uz_ref * fy;
    let mut ry = uz_ref * fx - ux_ref * fz;
    let mut rz = ux_ref * fy - uy_ref * fx;
    let rlen = (rx * rx + ry * ry + rz * rz).sqrt().max(1e-6);
    rx /= rlen;
    ry /= rlen;
    rz /= rlen;
    let ux = fy * rz - fz * ry;
    let uy = fz * rx - fx * rz;
    let uz = fx * ry - fy * rx;

    let texel = ((sh_rad as f64) * 2.0) / (sh_size as f64).max(1.0);
    let p_x = px as f64;
    let p_y = py as f64;
    let p_z = pz as f64;
    let p_r = p_x * rx + p_y * ry + p_z * rz;
    let p_u = p_x * ux + p_y * uy + p_z * uz;
    let p_l = p_x * fx + p_y * fy + p_z * fz;
    let s_r = (p_r / texel).round() * texel;
    let s_u = (p_u / texel).round() * texel;
    let snap_x = (rx * s_r + ux * s_u + fx * p_l) as f32;
    let snap_y = (ry * s_r + uy * s_u + fy * p_l) as f32;
    let snap_z = (rz * s_r + uz * s_u + fz * p_l) as f32;

    let out_ptr = addr_of_mut!(FRAME_OUT) as *mut f32;
    unsafe {
        *out_ptr.add(0) = wind_x;
        *out_ptr.add(1) = wind_z;
        *out_ptr.add(2) = gust;
        *out_ptr.add(3) = snap_x;
        *out_ptr.add(4) = snap_y;
        *out_ptr.add(5) = snap_z;
    }
    1
}

#[no_mangle]
pub extern "C" fn step_particles_batch(count: u32, dt: f32) -> u32 {
    let n = (count as usize).min(MAX_PARTICLES);
    let ptr = addr_of_mut!(PARTICLE_BUF) as *mut f32;
    let mut i = 0;
    while i < n {
        let base = i * PARTICLE_STRIDE;
        unsafe {
            let grav = *ptr.add(base + 6);
            let vy = *ptr.add(base + 4) - grav * dt;
            let x = *ptr.add(base + 0) + *ptr.add(base + 3) * dt;
            let y = *ptr.add(base + 1) + vy * dt;
            let z = *ptr.add(base + 2) + *ptr.add(base + 5) * dt;
            let life = *ptr.add(base + 7) - dt;
            *ptr.add(base + 0) = x;
            *ptr.add(base + 1) = y;
            *ptr.add(base + 2) = z;
            *ptr.add(base + 4) = vy;
            *ptr.add(base + 7) = life;
        }
        i += 1;
    }
    n as u32
}

#[no_mangle]
pub extern "C" fn cull_spheres_batch(
    count: u32,
    cam_x: f32,
    cam_y: f32,
    cam_z: f32,
    fwd_x: f32,
    fwd_y: f32,
    fwd_z: f32,
    max_dist: f32,
    cos_half_fov: f32,
) -> u32 {
    let n = (count as usize).min(MAX_SPHERES);
    let in_ptr = addr_of!(SPHERE_IN) as *const f32;
    let out_ptr = addr_of_mut!(SPHERE_OUT) as *mut u8;
    let mut visible: u32 = 0;
    let mut i = 0;
    while i < n {
        let base = i * 4;
        unsafe {
            let cx = *in_ptr.add(base + 0);
            let cy = *in_ptr.add(base + 1);
            let cz = *in_ptr.add(base + 2);
            let rad = *in_ptr.add(base + 3);
            let dx = cx - cam_x;
            let dy = cy - cam_y;
            let dz = cz - cam_z;
            let d2 = dx * dx + dy * dy + dz * dz;
            let max_r = max_dist + rad;
            let vis = if d2 > max_r * max_r {
                0u8
            } else if d2 <= rad * rad * 2.25 + 64.0 {
                1u8
            } else {
                let dot = dx * fwd_x + dy * fwd_y + dz * fwd_z;
                let dist = d2.sqrt();
                if dot + rad * 1.15 >= dist * cos_half_fov { 1u8 } else { 0u8 }
            };
            *out_ptr.add(i) = vis;
            visible += vis as u32;
        }
        i += 1;
    }
    visible
}

#[inline(always)]
fn boost_cartoon(r: f64, g: f64, b: f64, sat: f64, gain: f64, rich: f64) -> (u8, u8, u8) {
    let rc = (r / 255.0).max(0.0).min(1.0);
    let gc = (g / 255.0).max(0.0).min(1.0);
    let bc = (b / 255.0).max(0.0).min(1.0);
    let r2 = rc * (1.0 - rich * (1.0 - rc));
    let g2 = gc * (1.0 - rich * (1.0 - gc));
    let b2 = bc * (1.0 - rich * (1.0 - bc));
    let lum = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
    let nr = ((lum + (r2 - lum) * sat) * gain * 255.0).round().max(0.0).min(255.0) as u8;
    let ng = ((lum + (g2 - lum) * sat) * gain * 255.0).round().max(0.0).min(255.0) as u8;
    let nb = ((lum + (b2 - lum) * sat) * gain * 255.0).round().max(0.0).min(255.0) as u8;
    (nr, ng, nb)
}

#[no_mangle]
pub extern "C" fn build_bump_map_rgba(pixel_count: u32) -> u32 {
    let max_px = MAX_ATLAS_BYTES / 4;
    let n = (pixel_count as usize).min(max_px);
    let src = addr_of!(ATLAS_RGBA_BUF) as *const u8;
    let dst = addr_of_mut!(ATLAS_BUMP_BUF) as *mut u8;
    let mut i: usize = 0;
    while i < n {
        let off = i * 4;
        unsafe {
            let r = *src.add(off) as u32;
            let g = *src.add(off + 1) as u32;
            let b = *src.add(off + 2) as u32;
            let lum = ((r * 77 + g * 151 + b * 28) >> 8).min(255) as u8;
            *dst.add(off) = lum;
            *dst.add(off + 1) = lum;
            *dst.add(off + 2) = lum;
            *dst.add(off + 3) = 255;
        }
        i += 1;
    }
    n as u32
}

#[no_mangle]
pub extern "C" fn stylize_atlas_cartoon(
    width: u32,
    height: u32,
    tile_px: u32,
    cols: u32,
    num_tiles: u32,
) -> u32 {
    let w = width as usize;
    let h = height as usize;
    let tp = tile_px as usize;
    let c = cols as usize;
    let byte_len = w.saturating_mul(h).saturating_mul(4);
    if byte_len == 0 || byte_len > MAX_ATLAS_BYTES || tp < 4 || c == 0 {
        return 0;
    }
    let data = addr_of_mut!(ATLAS_RGBA_BUF) as *mut u8;
    let modes = addr_of!(TILE_MODE_BUF) as *const u8;
    let t_count = (num_tiles as usize).min(MAX_TILES);
    let mut painted: u32 = 0;

    let mut t_idx = 0usize;
    while t_idx < t_count {
        let mode = unsafe { *modes.add(t_idx) };
        if mode == 0 {
            t_idx += 1;
            continue;
        }
        let tx = (t_idx % c) * tp;
        let ty = (t_idx / c) * tp;
        if tx + tp > w || ty + tp > h {
            t_idx += 1;
            continue;
        }

        if mode == 1 || mode == 2 {
            let mut tr = 0.0f64;
            let mut tg = 0.0f64;
            let mut tb = 0.0f64;
            let mut tcnt = 0.0f64;
            if mode == 2 {
                let mut yy = 0usize;
                while yy < tp {
                    let mut xx = 0usize;
                    while xx < tp {
                        let i0 = ((ty + yy) * w + (tx + xx)) * 4;
                        unsafe {
                            if *data.add(i0 + 3) > 60 {
                                tr += *data.add(i0) as f64;
                                tg += *data.add(i0 + 1) as f64;
                                tb += *data.add(i0 + 2) as f64;
                                tcnt += 1.0;
                            }
                        }
                        xx += 1;
                    }
                    yy += 1;
                }
                if tcnt > 0.0 {
                    tr /= tcnt;
                    tg /= tcnt;
                    tb /= tcnt;
                }
            }

            let mut by = 0usize;
            while by + 3 < tp {
                let mut bx = 0usize;
                while bx + 3 < tp {
                    let mut sr = 0.0f64;
                    let mut sg = 0.0f64;
                    let mut sb = 0.0f64;
                    let mut cnt = 0usize;
                    let mut yy = 0usize;
                    while yy < 4 {
                        let mut xx = 0usize;
                        while xx < 4 {
                            let idx = ((ty + by + yy) * w + (tx + bx + xx)) * 4;
                            unsafe {
                                if *data.add(idx + 3) > 60 {
                                    sr += *data.add(idx) as f64;
                                    sg += *data.add(idx + 1) as f64;
                                    sb += *data.add(idx + 2) as f64;
                                    cnt += 1;
                                }
                            }
                            xx += 1;
                        }
                        yy += 1;
                    }
                    if mode == 2 {
                        let br = if cnt > 0 { sr / (cnt as f64) } else { tr * 0.88 };
                        let bg = if cnt > 0 { sg / (cnt as f64) } else { tg * 0.88 };
                        let bb = if cnt > 0 { sb / (cnt as f64) } else { tb * 0.88 };
                        let tone = if (((bx >> 2) + (by >> 2)) & 1) == 1 { 1.08 } else { 0.94 };
                        let (nr, ng, nb) = boost_cartoon(br, bg, bb, 1.38, 1.05 * tone, 0.14);
                        let mut y2 = 0usize;
                        while y2 < 4 {
                            let mut x2 = 0usize;
                            while x2 < 4 {
                                let idx = ((ty + by + y2) * w + (tx + bx + x2)) * 4;
                                unsafe {
                                    *data.add(idx) = nr;
                                    *data.add(idx + 1) = ng;
                                    *data.add(idx + 2) = nb;
                                    *data.add(idx + 3) = 255;
                                }
                                x2 += 1;
                            }
                            y2 += 1;
                        }
                    } else if cnt >= 3 {
                        let cf = cnt as f64;
                        let (qr, qg, qb) = boost_cartoon(sr / cf, sg / cf, sb / cf, 1.35, 1.06, 0.12);
                        let nr = ((qr / 6) * 6).min(255);
                        let ng = ((qg / 6) * 6).min(255);
                        let nb = ((qb / 6) * 6).min(255);
                        let mut y2 = 0usize;
                        while y2 < 4 {
                            let mut x2 = 0usize;
                            while x2 < 4 {
                                let idx = ((ty + by + y2) * w + (tx + bx + x2)) * 4;
                                unsafe {
                                    if *data.add(idx + 3) > 60 {
                                        *data.add(idx) = nr;
                                        *data.add(idx + 1) = ng;
                                        *data.add(idx + 2) = nb;
                                    }
                                }
                                x2 += 1;
                            }
                            y2 += 1;
                        }
                    }
                    bx += 4;
                }
                by += 4;
            }
            painted += 1;
        } else if mode == 3 {
            let mut by = 0usize;
            while by + 1 < tp {
                let mut bx = 0usize;
                while bx + 1 < tp {
                    let mut sr = 0.0f64;
                    let mut sg = 0.0f64;
                    let mut sb = 0.0f64;
                    let mut cnt = 0usize;
                    let mut yy = 0usize;
                    while yy < 2 {
                        let mut xx = 0usize;
                        while xx < 2 {
                            let idx = ((ty + by + yy) * w + (tx + bx + xx)) * 4;
                            unsafe {
                                if *data.add(idx + 3) > 60 {
                                    sr += *data.add(idx) as f64;
                                    sg += *data.add(idx + 1) as f64;
                                    sb += *data.add(idx + 2) as f64;
                                    cnt += 1;
                                }
                            }
                            xx += 1;
                        }
                        yy += 1;
                    }
                    if cnt >= 2 {
                        let cf = cnt as f64;
                        let (nr, ng, nb) = boost_cartoon(sr / cf, sg / cf, sb / cf, 1.40, 1.07, 0.12);
                        let mut y2 = 0usize;
                        while y2 < 2 {
                            let mut x2 = 0usize;
                            while x2 < 2 {
                                let idx = ((ty + by + y2) * w + (tx + bx + x2)) * 4;
                                unsafe {
                                    if *data.add(idx + 3) > 60 {
                                        *data.add(idx) = nr;
                                        *data.add(idx + 1) = ng;
                                        *data.add(idx + 2) = nb;
                                        *data.add(idx + 3) = 255;
                                    } else {
                                        *data.add(idx + 3) = 0;
                                    }
                                }
                                x2 += 1;
                            }
                            y2 += 1;
                        }
                    }
                    bx += 2;
                }
                by += 2;
            }
            painted += 1;
        } else if mode == 4 {
            let mut yy = 0usize;
            while yy < tp {
                let mut xx = 0usize;
                while xx < tp {
                    let idx = ((ty + yy) * w + (tx + xx)) * 4;
                    unsafe {
                        let a = *data.add(idx + 3);
                        if a > 12 {
                            let (nr, ng, nb) = boost_cartoon(
                                *data.add(idx) as f64,
                                *data.add(idx + 1) as f64,
                                *data.add(idx + 2) as f64,
                                1.26,
                                1.06,
                                0.06,
                            );
                            *data.add(idx) = nr;
                            *data.add(idx + 1) = ng;
                            *data.add(idx + 2) = nb;
                        }
                    }
                    xx += 1;
                }
                yy += 1;
            }
            painted += 1;
        } else if mode == 5 {
            let mut br = 0.0f64;
            let mut bg = 0.0f64;
            let mut bb = 0.0f64;
            let mut bcnt = 0.0f64;
            let mut yy = 0usize;
            while yy < tp {
                let mut xx = 0usize;
                while xx < tp {
                    if xx == 0 || yy == 0 || xx + 1 == tp || yy + 1 == tp {
                        let idx = ((ty + yy) * w + (tx + xx)) * 4;
                        unsafe {
                            if *data.add(idx + 3) > 60 {
                                br += *data.add(idx) as f64;
                                bg += *data.add(idx + 1) as f64;
                                bb += *data.add(idx + 2) as f64;
                                bcnt += 1.0;
                            }
                        }
                    }
                    xx += 1;
                }
                yy += 1;
            }
            if bcnt > 0.0 {
                br /= bcnt;
                bg /= bcnt;
                bb /= bcnt;
            }
            let (s_r, s_g, s_b) = boost_cartoon(br, bg, bb, 1.15, 1.03, 0.10);
            let mut by = 0usize;
            while by + 1 < tp {
                let mut bx = 0usize;
                while bx + 1 < tp {
                    let mut gr = 0.0f64;
                    let mut gg = 0.0f64;
                    let mut gb = 0.0f64;
                    let mut gcnt = 0usize;
                    let mut y2 = 0usize;
                    while y2 < 2 {
                        let mut x2 = 0usize;
                        while x2 < 2 {
                            let idx = ((ty + by + y2) * w + (tx + bx + x2)) * 4;
                            unsafe {
                                if *data.add(idx + 3) > 60 {
                                    let r = *data.add(idx) as f64;
                                    let g = *data.add(idx + 1) as f64;
                                    let b = *data.add(idx + 2) as f64;
                                    let diff = (r - br).abs() + (g - bg).abs() + (b - bb).abs();
                                    if diff >= 80.0 {
                                        gr += r;
                                        gg += g;
                                        gb += b;
                                        gcnt += 1;
                                    }
                                }
                            }
                            x2 += 1;
                        }
                        y2 += 1;
                    }
                    let (fr, fg, fb) = if gcnt >= 1 {
                        let gf = gcnt as f64;
                        boost_cartoon(gr / gf, gg / gf, gb / gf, 1.45, 1.08, 0.10)
                    } else {
                        (s_r, s_g, s_b)
                    };
                    let mut y3 = 0usize;
                    while y3 < 2 {
                        let mut x3 = 0usize;
                        while x3 < 2 {
                            let idx = ((ty + by + y3) * w + (tx + bx + x3)) * 4;
                            unsafe {
                                if *data.add(idx + 3) > 60 {
                                    *data.add(idx) = fr;
                                    *data.add(idx + 1) = fg;
                                    *data.add(idx + 2) = fb;
                                }
                            }
                            x3 += 1;
                        }
                        y3 += 1;
                    }
                    bx += 2;
                }
                by += 2;
            }
            painted += 1;
        }
        t_idx += 1;
    }
    painted
}
