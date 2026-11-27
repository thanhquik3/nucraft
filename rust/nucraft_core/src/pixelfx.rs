use core::ptr::addr_of_mut;

use crate::{
    cos_approx, hash2i_f64, sin_approx, ATLAS_RGBA_BUF, MAX_ATLAS_BYTES, MAX_PARTICLES,
    PARTICLE_BUF, PARTICLE_STRIDE,
};

const TAU: f64 = 6.28318530717958647692;

#[derive(Clone, Copy)]
struct Rgba(u8, u8, u8, u8);

struct StripCanvas {
    buf: *mut u8,
    strip_w: usize,
    frame_x0: usize,
    size: usize,
}

impl StripCanvas {
    #[inline(always)]
    fn put(&self, x: i32, y: i32, c: Rgba) {
        if x < 0 || y < 0 {
            return;
        }
        let ux = x as usize;
        let uy = y as usize;
        if ux >= self.size || uy >= self.size {
            return;
        }
        let off = (uy * self.strip_w + self.frame_x0 + ux) * 4;
        unsafe {
            *self.buf.add(off) = c.0;
            *self.buf.add(off + 1) = c.1;
            *self.buf.add(off + 2) = c.2;
            *self.buf.add(off + 3) = c.3;
        }
    }

    #[inline(always)]
    fn blend(&self, x: i32, y: i32, c: Rgba, alpha: f64) {
        if x < 0 || y < 0 || alpha <= 0.005 {
            return;
        }
        let ux = x as usize;
        let uy = y as usize;
        if ux >= self.size || uy >= self.size {
            return;
        }
        let a = alpha.clamp(0.0, 1.0) * (c.3 as f64 / 255.0);
        if a <= 0.004 {
            return;
        }
        let off = (uy * self.strip_w + self.frame_x0 + ux) * 4;
        unsafe {
            let da = (*self.buf.add(off + 3) as f64) / 255.0;
            let out_a = a + da * (1.0 - a);
            if out_a <= 0.001 {
                return;
            }
            let dr = *self.buf.add(off) as f64;
            let dg = *self.buf.add(off + 1) as f64;
            let db = *self.buf.add(off + 2) as f64;
            let inv = 1.0 / out_a;
            *self.buf.add(off) = (((c.0 as f64) * a + dr * da * (1.0 - a)) * inv).clamp(0.0, 255.0) as u8;
            *self.buf.add(off + 1) = (((c.1 as f64) * a + dg * da * (1.0 - a)) * inv).clamp(0.0, 255.0) as u8;
            *self.buf.add(off + 2) = (((c.2 as f64) * a + db * da * (1.0 - a)) * inv).clamp(0.0, 255.0) as u8;
            *self.buf.add(off + 3) = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }

    fn disc(&self, cx: f64, cy: f64, r: f64, c: Rgba) {
        let x0 = (cx - r - 1.0).floor() as i32;
        let x1 = (cx + r + 1.0).ceil() as i32;
        let y0 = (cy - r - 1.0).floor() as i32;
        let y1 = (cy + r + 1.0).ceil() as i32;
        let r2 = r * r;
        let mut y = y0;
        while y <= y1 {
            let mut x = x0;
            while x <= x1 {
                let dx = (x as f64) + 0.5 - cx;
                let dy = (y as f64) + 0.5 - cy;
                if dx * dx + dy * dy <= r2 {
                    self.put(x, y, c);
                }
                x += 1;
            }
            y += 1;
        }
    }
}

#[inline(always)]
fn pnoise_loop(phase: f64, freq: f64, seed: i32) -> f64 {
    let p = freq.round().max(1.0);
    let pi = p as i32;
    let x = phase * p;
    let i = x.floor() as i32;
    let f = x - (i as f64);
    let u = f * f * (3.0 - 2.0 * f);
    let w0 = i.rem_euclid(pi);
    let w1 = (i + 1).rem_euclid(pi);
    let a = hash2i_f64(w0, seed, 1337);
    let b = hash2i_f64(w1, seed, 1337);
    (a + (b - a) * u) * 2.0 - 1.0
}

#[inline(always)]
fn smoothstep(e0: f64, e1: f64, x: f64) -> f64 {
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[inline(always)]
fn bayer4(x: i32, y: i32) -> f64 {
    const M: [u8; 16] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    let idx = ((y.rem_euclid(4) as usize) << 2) | (x.rem_euclid(4) as usize);
    (M[idx] as f64 + 0.5) / 16.0
}

#[inline(always)]
fn mix_rgba(a: Rgba, b: Rgba, k: f64) -> Rgba {
    let t = k.clamp(0.0, 1.0);
    let inv = 1.0 - t;
    Rgba(
        (a.0 as f64 * inv + b.0 as f64 * t).round() as u8,
        (a.1 as f64 * inv + b.1 as f64 * t).round() as u8,
        (a.2 as f64 * inv + b.2 as f64 * t).round() as u8,
        (a.3 as f64 * inv + b.3 as f64 * t).round() as u8,
    )
}

const FIRE_PAL: [Rgba; 6] = [
    Rgba(255, 255, 255, 255), // #ffffff core
    Rgba(255, 243, 166, 255), // #fff3a6
    Rgba(255, 194, 61, 255),  // #ffc23d
    Rgba(255, 138, 42, 255),  // #ff8a2a
    Rgba(220, 38, 38, 255),   // #dc2626
    Rgba(127, 29, 29, 255),   // #7f1d1d crisp outer rim
];

const SOUL_PAL: [Rgba; 6] = [
    Rgba(255, 255, 255, 255), // #ffffff core
    Rgba(236, 254, 255, 255), // #ecfeff
    Rgba(103, 232, 249, 255), // #67e8f9
    Rgba(6, 182, 212, 255),   // #06b6d4
    Rgba(2, 132, 199, 255),   // #0284c7
    Rgba(12, 74, 110, 255),   // #0c4a6e crisp outer rim
];

fn draw_tongue(
    cv: &StripCanvas,
    x: f64,
    y: f64,
    h: f64,
    w: f64,
    sweep: f64,
    phase: f64,
    tseed: i32,
    pal: &[Rgba; 6],
    back: bool,
) {
    if h < 1.5 {
        return;
    }
    let layers: [(f64, f64, usize); 5] = if back {
        [
            (1.10, 1.03, 5),
            (0.95, 0.96, 4),
            (0.72, 0.80, 3),
            (0.48, 0.60, 2),
            (0.24, 0.36, 1),
        ]
    } else {
        [
            (1.12, 1.04, 5),
            (0.96, 0.96, 4),
            (0.74, 0.84, 3),
            (0.50, 0.66, 2),
            (0.26, 0.42, 0),
        ]
    };
    let steps = h.ceil() as i32;
    for &(lw, lh, ci) in layers.iter() {
        let l_h = h * lh;
        let col = pal[ci];
        let mut r = 0;
        while r <= steps {
            let rf = r as f64;
            if rf > l_h {
                break;
            }
            let u = rf / l_h.max(1.0);
            let jit = pnoise_loop(phase + rf * 0.08, 4.0, tseed + 11) * 0.48;
            let base_round = ((rf + 1.4) / 3.2).min(1.0);
            let half = w * lw * (1.0 - u).powf(0.85) * base_round + jit;
            if half >= 0.35 {
                let wob = pnoise_loop(phase, 3.0, tseed + 29) * u * 1.15;
                let cx = x + sweep * u * u * lh + wob;
                let py = (y - rf).round() as i32;
                let x0 = (cx - half).round() as i32;
                let x1 = (cx + half).round() as i32;
                let mut px = x0;
                while px <= x1 {
                    cv.put(px, py, col);
                    px += 1;
                }
            }
            r += 1;
        }
    }
}

fn render_flame_frame(cv: &StripCanvas, f: usize, frames: usize, seed: i32, pal: &[Rgba; 6]) {
    let sc = (cv.size as f64) / 24.0;
    let phase = (f as f64) / (frames as f64);
    let base_y = 20.5 * sc;
    let center_x = 11.5 * sc;
    let flicker = 0.86 + 0.14 * sin_approx(phase * TAU * 2.0 + (seed as f64) * 0.7);

    // [dx, dy, h, w, back]
    let tongues: [(f64, f64, f64, f64, bool); 5] = [
        (-2.8, -1.0, 12.8, 2.5, true),
        (2.9, -1.0, 12.2, 2.4, true),
        (-4.8, 0.2, 8.8, 2.0, false),
        (4.9, 0.2, 9.2, 2.0, false),
        (0.0, 0.0, 16.5, 3.6, false),
    ];

    for (idx, &(dx, dy, h, w, back)) in tongues.iter().enumerate() {
        if !back {
            continue;
        }
        let ts = seed + (idx as i32) * 37;
        let th = h * sc * (0.90 + 0.14 * pnoise_loop(phase, 3.0, ts)) * flicker;
        let sweep = pnoise_loop(phase, 2.0, ts + 5) * 2.2 * sc - dx * 0.28 * sc;
        draw_tongue(cv, center_x + dx * sc, base_y + dy * sc, th, w * sc, sweep, phase, ts, pal, true);
    }
    for (idx, &(dx, dy, h, w, back)) in tongues.iter().enumerate() {
        if back {
            continue;
        }
        let ts = seed + (idx as i32) * 37;
        let th = h * sc * (0.88 + 0.16 * pnoise_loop(phase, 3.0, ts)) * flicker;
        let sweep = pnoise_loop(phase, 2.0, ts + 5) * 2.4 * sc - dx * 0.24 * sc;
        draw_tongue(cv, center_x + dx * sc, base_y + dy * sc, th, w * sc, sweep, phase, ts, pal, false);
    }

    // Detached rising licks torn off tongue tips (looping cleanly across frames)
    let mut li = 0;
    while li < 4 {
        let born = hash2i_f64(li, seed + 201, 19);
        let age = (phase - born).rem_euclid(1.0);
        if age < 0.65 {
            let k = 1.0 - age / 0.65;
            let sx = center_x + (hash2i_f64(li, seed + 211, 23) - 0.5) * 8.0 * sc + sin_approx(age * 6.0 + li as f64) * 1.1 * sc;
            let sy = (10.5 - age * 11.5) * sc;
            let r = (0.7 + 0.9 * k) * sc;
            cv.disc(sx, sy, r + 0.5 * sc, pal[5]);
            cv.disc(sx, sy, r, if k > 0.55 { pal[2] } else { pal[3] });
        }
        li += 1;
    }

    // 1-px rising embers flickering around flame crown
    let mut ei = 0;
    while ei < 5 {
        let born = hash2i_f64(ei, seed + 307, 41);
        let age = (phase - born).rem_euclid(1.0);
        if (ei + (f as i32)) % 5 != 0 {
            let ex = (center_x + (hash2i_f64(ei, seed + 313, 47) - 0.5) * 12.0 * sc + sin_approx(age * TAU + ei as f64) * 1.4 * sc).round() as i32;
            let ey = ((13.0 - age * 12.5) * sc).round() as i32;
            let c = if age < 0.35 { pal[1] } else if age < 0.7 { pal[2] } else { pal[4] };
            cv.put(ex, ey, c);
        }
        ei += 1;
    }
}

struct CloudStyle {
    ramp: [Rgba; 5],
    under_hot: Rgba,
    under_warm: Rgba,
    has_underglow: bool,
}

const SULFUR_STYLE: CloudStyle = CloudStyle {
    ramp: [
        Rgba(255, 255, 255, 255), // bright top highlight
        Rgba(241, 245, 249, 255), // creamy steam
        Rgba(203, 213, 225, 255), // mid steam
        Rgba(148, 163, 184, 255), // cool shadow
        Rgba(100, 116, 139, 255), // crisp contour rim
    ],
    under_hot: Rgba(254, 240, 138, 255),  // #fef08a sulfur glow
    under_warm: Rgba(253, 224, 71, 255),  // #fde047
    has_underglow: true,
};

const CAMPFIRE_SMOKE_STYLE: CloudStyle = CloudStyle {
    ramp: [
        Rgba(226, 232, 240, 255), // silver-grey lit crest
        Rgba(148, 163, 184, 255), // slate light
        Rgba(100, 116, 139, 255), // slate body
        Rgba(71, 85, 105, 255),   // dark underside
        Rgba(51, 65, 85, 255),    // crisp contour
    ],
    under_hot: Rgba(249, 115, 22, 255),  // #f97316 ember under-tint
    under_warm: Rgba(251, 146, 60, 255), // #fb923c
    has_underglow: true,
};

const SMOKE_PUFF_STYLE: CloudStyle = CloudStyle {
    ramp: [
        Rgba(203, 213, 225, 255),
        Rgba(148, 163, 184, 255),
        Rgba(100, 116, 139, 255),
        Rgba(71, 85, 105, 255),
        Rgba(51, 65, 85, 255),
    ],
    under_hot: Rgba(148, 163, 184, 255),
    under_warm: Rgba(100, 116, 139, 255),
    has_underglow: false,
};

fn draw_cel_lobe(
    cv: &StripCanvas,
    cx: f64,
    cy: f64,
    r: f64,
    style: &CloudStyle,
    alpha: f64,
    depth_shift: usize,
    under_glow: f64,
    thin_frac: f64,
) {
    if r < 0.8 || alpha <= 0.01 {
        return;
    }
    let rim = 1.0 - (1.4 / r).min(0.32);
    let x0 = (cx - r - 0.5).floor() as i32;
    let x1 = (cx + r + 0.5).ceil() as i32;
    let y0 = (cy - r - 0.5).floor() as i32;
    let y1 = (cy + r + 0.5).ceil() as i32;
    let mut py = y0;
    while py <= y1 {
        let mut px = x0;
        while px <= x1 {
            let dx = ((px as f64) + 0.5 - cx) / r;
            let dy = ((py as f64) + 0.5 - cy) / r;
            let d2 = dx * dx + dy * dy;
            if d2 <= 1.0 {
                let d = d2.sqrt();
                if thin_frac > 0.08 && bayer4(px, py) < thin_frac * (0.45 + 0.55 * d) {
                    px += 1;
                    continue;
                }
                let nz = (1.0 - d2).sqrt();
                let lam = -0.42 * dx - 0.78 * dy + 0.46 * nz;
                let base_idx = if lam > 0.62 && d > 0.35 {
                    0
                } else if lam > 0.16 {
                    1
                } else if lam > -0.28 {
                    2
                } else if lam > -0.62 {
                    3
                } else {
                    4
                };
                let band = (base_idx + depth_shift).min(4);
                let mut col = style.ramp[band];
                if style.has_underglow && under_glow > 0.05 && dy > 0.10 {
                    let g = under_glow * ((dy - 0.10) / 0.90).clamp(0.0, 1.0) * (0.55 + 0.45 * nz);
                    if g > 0.48 {
                        col = mix_rgba(col, style.under_hot, 0.75);
                    } else if g > 0.22 {
                        col = mix_rgba(col, style.under_warm, 0.55);
                    }
                }
                let soft_edge = if d > rim { 0.68 } else { 1.0 };
                cv.blend(px, py, col, alpha * soft_edge);
            }
            px += 1;
        }
        py += 1;
    }
}

fn render_smoke_frame(
    cv: &StripCanvas,
    f: usize,
    frames: usize,
    seed: i32,
    style: &CloudStyle,
    is_steam: bool,
    is_compact: bool,
) {
    let sc = (cv.size as f64) / 24.0;
    let u = if frames > 1 {
        (f as f64) / ((frames - 1) as f64)
    } else {
        0.5
    };
    let bloom = 1.0 - (-u * 4.8).exp();
    let thin = smoothstep(0.68, 1.0, u);
    let base_alpha = (0.90 + 0.10 * smoothstep(0.0, 0.14, u)) * (1.0 - 0.56 * thin.powf(1.25));
    let curl_x = sin_approx(u * 4.2 + (seed as f64) * 0.4) * (if is_compact { 1.0 } else { 1.8 }) * sc;
    let cx = 11.5 * sc + curl_x * 0.45;
    let cy = (14.4 - u * (if is_compact { 2.8 } else { 4.0 })) * sc;

    // 6 overlapping spherical lobes sorted back-to-front: [ox, oy, r, z, dir_x, dir_y]
    let lobes: [(f64, f64, f64, f64, f64, f64); 6] = [
        (-2.4, -2.0, 3.8, -0.75, -0.7, -0.8),
        (2.5, -1.6, 3.6, -0.55, 0.7, -0.7),
        (-3.2, 1.4, 3.5, -0.15, -0.9, 0.2),
        (3.1, 1.6, 3.4, 0.15, 0.9, 0.2),
        (0.2, -2.4, 4.3, 0.45, 0.1, -0.9),
        (-0.2, 1.8, 4.2, 0.85, -0.1, 0.4),
    ];

    let max_glow_u = if is_steam { 0.42 } else { 0.25 };
    let glow_env = if style.has_underglow && u <= max_glow_u {
        1.0 - u / max_glow_u
    } else {
        0.0
    };

    for (idx, &(ox, oy, lr, z, dx, dy)) in lobes.iter().enumerate() {
        let jx = (hash2i_f64(idx as i32, seed, 53) - 0.5) * 1.1;
        let jy = (hash2i_f64(idx as i32, seed, 71) - 0.5) * 0.9;
        let spread = (0.62 + 0.62 * bloom + 0.62 * thin) * sc;
        let lx = cx + (ox + jx) * spread + dx * thin * 2.2 * sc;
        let ly = cy + (oy + jy) * spread + dy * thin * 1.6 * sc;
        let r = lr * sc * (0.68 + 0.50 * bloom) * (1.0 - 0.20 * thin);
        let depth_shift = if z < -0.35 { 1 } else { 0 } + if u > 0.76 { 1 } else { 0 };
        let under = if oy > 0.0 { glow_env } else { glow_env * 0.25 };
        let l_alpha = base_alpha * (if z < -0.35 { 0.90 } else { 1.0 });
        draw_cel_lobe(cv, lx, ly, r, style, l_alpha, depth_shift, under, thin * 0.65);
    }

    // Fraying detached pixel wisps around perimeter in late dissolution frames
    if u > 0.45 {
        let mut wi = 0;
        while wi < 5 {
            let a = (wi as f64) * 1.256 + hash2i_f64(wi, seed + 99, 17) * 0.8 + u * 0.9;
            let dist = (4.2 + u * 5.8) * sc;
            let wx = cx + cos_approx(a) * dist;
            let wy = cy + sin_approx(a) * dist * 0.85 - u * 1.2 * sc;
            let wr = (1.6 - u * 0.85).max(0.8) * sc;
            draw_cel_lobe(cv, wx, wy, wr, style, base_alpha * 0.82, 1, 0.0, thin * 0.6);
            wi += 1;
        }
    }
}

fn render_dragon_impact_frame(cv: &StripCanvas, f: usize, frames: usize, seed: i32) {
    let sc = (cv.size as f64) / 24.0;
    let phase = (f as f64) / (frames as f64);
    let ang = phase * TAU;
    let cx = 11.5 * sc;
    let cy = 11.5 * sc;

    let white = Rgba(255, 255, 255, 255);
    let hi_pink = Rgba(253, 244, 255, 255);
    let magenta = Rgba(240, 171, 252, 255);
    let orchid = Rgba(217, 70, 239, 255);
    let deep_purple = Rgba(126, 34, 206, 255);

    // Outer counter-rotating stepped pixel rune ring + radial corona rays
    let ring_r = (7.2 + 1.1 * sin_approx(ang * 2.0)) * sc;
    let mut y = 0;
    while y < cv.size as i32 {
        let mut x = 0;
        while x < cv.size as i32 {
            let dx = (x as f64) + 0.5 - cx;
            let dy = (y as f64) + 0.5 - cy;
            let d = (dx * dx + dy * dy).sqrt();
            if d < 11.2 * sc {
                // Counter-rotating rune ring segments
                if (d - ring_r).abs() < 0.78 * sc {
                    let a = dy.atan2(dx) - ang;
                    let seg = ((a / TAU * 8.0).rem_euclid(1.0) * 4.0) as i32;
                    if seg != 3 {
                        cv.put(x, y, if seg == 0 { magenta } else { orchid });
                    }
                }
                // Crisp 4-point + 4-diagonal rotating starburst arms
                let c0 = cos_approx(ang);
                let s0 = sin_approx(ang);
                let rx = dx * c0 + dy * s0;
                let ry = -dx * s0 + dy * c0;
                let ax = rx.abs();
                let ay = ry.abs();
                let arm_len = (7.8 + 1.4 * cos_approx(ang * 2.0)) * sc;
                if (ax < 1.05 * sc && ay < arm_len) || (ay < 1.05 * sc && ax < arm_len) {
                    let u = ax.max(ay) / arm_len;
                    cv.put(x, y, if u < 0.35 { white } else if u < 0.65 { hi_pink } else { orchid });
                }
                let diag_len = 5.6 * sc;
                let d1 = (rx - ry).abs() * 0.7071;
                let d2 = (rx + ry).abs() * 0.7071;
                if (d1 < 0.72 * sc && d < diag_len) || (d2 < 0.72 * sc && d < diag_len) {
                    cv.put(x, y, if d < 2.8 * sc { hi_pink } else { deep_purple });
                }
            }
            x += 1;
        }
        y += 1;
    }

    // Core hot diamond
    cv.disc(cx, cy, 3.0 * sc, orchid);
    cv.disc(cx, cy, 2.0 * sc, hi_pink);
    cv.disc(cx, cy, 1.1 * sc, white);

    // Orbiting pixel diamond sparks
    let mut sp = 0;
    while sp < 4 {
        let sa = -ang + (sp as f64) * 1.570796 + hash2i_f64(sp, seed, 88) * 0.5;
        let sd = (8.8 + sin_approx(ang * 2.0 + sp as f64)) * sc;
        let sx = (cx + cos_approx(sa) * sd).round() as i32;
        let sy = (cy + sin_approx(sa) * sd).round() as i32;
        cv.put(sx, sy, white);
        cv.put(sx + 1, sy, magenta);
        cv.put(sx - 1, sy, magenta);
        cv.put(sx, sy + 1, magenta);
        cv.put(sx, sy - 1, magenta);
        sp += 1;
    }
}

#[no_mangle]
pub extern "C" fn bake_pixelfx_strip_rgba(kind: u32, size: u32, frames: u32, seed: u32) -> u32 {
    if !(8..=64).contains(&size) || !(1..=16).contains(&frames) {
        return 0;
    }
    let sz = size as usize;
    let fr = frames as usize;
    let total_bytes = fr.saturating_mul(sz).saturating_mul(sz).saturating_mul(4);
    if total_bytes == 0 || total_bytes > MAX_ATLAS_BYTES {
        return 0;
    }

    let buf = addr_of_mut!(ATLAS_RGBA_BUF) as *mut u8;
    unsafe {
        core::ptr::write_bytes(buf, 0, total_bytes);
    }

    let strip_w = fr * sz;
    let s_i32 = seed as i32;
    let mut f = 0usize;
    while f < fr {
        let cv = StripCanvas {
            buf,
            strip_w,
            frame_x0: f * sz,
            size: sz,
        };
        match kind {
            0 => render_flame_frame(&cv, f, fr, s_i32, &FIRE_PAL),
            1 => render_flame_frame(&cv, f, fr, s_i32 + 17, &SOUL_PAL),
            2 => render_smoke_frame(&cv, f, fr, s_i32, &SULFUR_STYLE, true, false),
            3 => render_smoke_frame(&cv, f, fr, s_i32 + 31, &CAMPFIRE_SMOKE_STYLE, false, false),
            4 => render_smoke_frame(&cv, f, fr, s_i32 + 43, &SMOKE_PUFF_STYLE, false, true),
            5 => render_dragon_impact_frame(&cv, f, fr, s_i32),
            _ => return 0,
        }
        f += 1;
    }

    total_bytes as u32
}

#[no_mangle]
pub extern "C" fn step_pixelfx_plumes(
    count: u32,
    dt: f32,
    elapsed: f32,
    sway_amp: f32,
    drag_y: f32,
) -> u32 {
    let n = (count as usize).min(MAX_PARTICLES);
    let ptr = addr_of_mut!(PARTICLE_BUF) as *mut f32;
    let dt64 = dt as f64;
    let el64 = elapsed as f64;
    let amp64 = sway_amp as f64;
    let damp = 1.0 / (1.0 + (drag_y as f64) * dt64).max(1e-4);

    let mut i = 0usize;
    while i < n {
        let base = i * PARTICLE_STRIDE;
        unsafe {
            let mut x = *ptr.add(base) as f64;
            let mut y = *ptr.add(base + 1) as f64;
            let mut z = *ptr.add(base + 2) as f64;
            let vx = *ptr.add(base + 3) as f64;
            let mut vy = *ptr.add(base + 4) as f64;
            let vz = *ptr.add(base + 5) as f64;
            let phase = *ptr.add(base + 6) as f64;
            let life = *ptr.add(base + 7) - dt;

            let wx = sin_approx(el64 * 0.78 + phase) * amp64;
            let wz = cos_approx(el64 * 0.64 + phase * 1.3) * amp64;
            vy *= damp;
            x += (vx + wx) * dt64;
            y += vy * dt64;
            z += (vz + wz) * dt64;

            *ptr.add(base) = x as f32;
            *ptr.add(base + 1) = y as f32;
            *ptr.add(base + 2) = z as f32;
            *ptr.add(base + 4) = vy as f32;
            *ptr.add(base + 7) = life;
        }
        i += 1;
    }
    n as u32
}
