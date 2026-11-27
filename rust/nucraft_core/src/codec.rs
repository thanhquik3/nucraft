use core::ptr::{addr_of, addr_of_mut};

pub const CODEC_CAP_BYTES: usize = 2_097_152;
pub const ENTRY_STRIDE: usize = 13; // dim(u8) + x(i32) + y(i16) + z(i32) + bid(u16)
pub const MAX_CODEC_ENTRIES: usize = CODEC_CAP_BYTES / ENTRY_STRIDE; // 161319

static mut CODEC_IN: [u8; CODEC_CAP_BYTES] = [0; CODEC_CAP_BYTES];
static mut CODEC_OUT: [u8; CODEC_CAP_BYTES] = [0; CODEC_CAP_BYTES];
static mut SORT_ORDER: [u32; MAX_CODEC_ENTRIES] = [0; MAX_CODEC_ENTRIES];

#[no_mangle]
pub extern "C" fn codec_in_ptr() -> *mut u8 {
    addr_of_mut!(CODEC_IN) as *mut u8
}

#[no_mangle]
pub extern "C" fn codec_out_ptr() -> *const u8 {
    addr_of!(CODEC_OUT) as *const u8
}

#[inline(always)]
unsafe fn read_entry_key(in_ptr: *const u8, idx: usize) -> (u8, i32, i16, i32, u16) {
    let base = idx * ENTRY_STRIDE;
    let dim = *in_ptr.add(base);
    let x = i32::from_le_bytes([
        *in_ptr.add(base + 1),
        *in_ptr.add(base + 2),
        *in_ptr.add(base + 3),
        *in_ptr.add(base + 4),
    ]);
    let y = i16::from_le_bytes([*in_ptr.add(base + 5), *in_ptr.add(base + 6)]);
    let z = i32::from_le_bytes([
        *in_ptr.add(base + 7),
        *in_ptr.add(base + 8),
        *in_ptr.add(base + 9),
        *in_ptr.add(base + 10),
    ]);
    let bid = u16::from_le_bytes([*in_ptr.add(base + 11), *in_ptr.add(base + 12)]);
    (dim, x, y, z, bid)
}

#[inline(always)]
unsafe fn write_entry(out_ptr: *mut u8, idx: usize, dim: u8, x: i32, y: i16, z: i32, bid: u16) {
    let base = idx * ENTRY_STRIDE;
    *out_ptr.add(base) = dim;
    let xb = x.to_le_bytes();
    let yb = y.to_le_bytes();
    let zb = z.to_le_bytes();
    let bb = bid.to_le_bytes();
    *out_ptr.add(base + 1) = xb[0];
    *out_ptr.add(base + 2) = xb[1];
    *out_ptr.add(base + 3) = xb[2];
    *out_ptr.add(base + 4) = xb[3];
    *out_ptr.add(base + 5) = yb[0];
    *out_ptr.add(base + 6) = yb[1];
    *out_ptr.add(base + 7) = zb[0];
    *out_ptr.add(base + 8) = zb[1];
    *out_ptr.add(base + 9) = zb[2];
    *out_ptr.add(base + 10) = zb[3];
    *out_ptr.add(base + 11) = bb[0];
    *out_ptr.add(base + 12) = bb[1];
}

#[inline(always)]
unsafe fn cmp_indices(in_ptr: *const u8, ia: u32, ib: u32) -> core::cmp::Ordering {
    let (da, xa, ya, za, _) = read_entry_key(in_ptr, ia as usize);
    let (db, xb, yb, zb, _) = read_entry_key(in_ptr, ib as usize);
    da.cmp(&db)
        .then_with(|| za.cmp(&zb))
        .then_with(|| ya.cmp(&yb))
        .then_with(|| xa.cmp(&xb))
        .then_with(|| ia.cmp(&ib))
}

unsafe fn heapsort_indices(in_ptr: *const u8, ord: *mut u32, n: usize) {
    if n < 2 {
        return;
    }
    let mut start = n / 2;
    while start > 0 {
        start -= 1;
        sift_down(in_ptr, ord, start, n);
    }
    let mut end = n;
    while end > 1 {
        end -= 1;
        let tmp = *ord.add(end);
        *ord.add(end) = *ord.add(0);
        *ord.add(0) = tmp;
        sift_down(in_ptr, ord, 0, end);
    }
}

#[inline]
unsafe fn sift_down(in_ptr: *const u8, ord: *mut u32, mut root: usize, end: usize) {
    loop {
        let child = root * 2 + 1;
        if child >= end {
            break;
        }
        let mut swap = root;
        if cmp_indices(in_ptr, *ord.add(swap), *ord.add(child)) == core::cmp::Ordering::Less {
            swap = child;
        }
        if child + 1 < end
            && cmp_indices(in_ptr, *ord.add(swap), *ord.add(child + 1)) == core::cmp::Ordering::Less
        {
            swap = child + 1;
        }
        if swap == root {
            break;
        }
        let tmp = *ord.add(root);
        *ord.add(root) = *ord.add(swap);
        *ord.add(swap) = tmp;
        root = swap;
    }
}

#[inline(always)]
fn zigzag_encode(v: i32) -> u32 {
    ((v << 1) ^ (v >> 31)) as u32
}

#[inline(always)]
fn zigzag_decode(v: u32) -> i32 {
    ((v >> 1) as i32) ^ -((v & 1) as i32)
}

#[inline(always)]
unsafe fn write_varint(out: *mut u8, pos: &mut usize, mut v: u32) -> bool {
    loop {
        if *pos >= CODEC_CAP_BYTES {
            return false;
        }
        let b = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            *out.add(*pos) = b;
            *pos += 1;
            return true;
        } else {
            *out.add(*pos) = b | 0x80;
            *pos += 1;
        }
    }
}

#[inline(always)]
unsafe fn read_varint(inp: *const u8, pos: &mut usize, len: usize) -> Option<u32> {
    let mut res = 0u32;
    let mut shift = 0u32;
    while *pos < len && shift < 35 {
        let b = *inp.add(*pos);
        *pos += 1;
        res |= ((b & 0x7f) as u32) << shift;
        if (b & 0x80) == 0 {
            return Some(res);
        }
        shift += 7;
    }
    None
}

// Binary NCW1 format:
//   Header (10 bytes): "NCW1" (4) | version=1 (u16 LE) | unique_count (u32 LE)
//   Stream of groups:
//     if first byte >= 0x80? No, use tag varint:
//       tag = (run_len << 1) | same_header_flag?
//     Even simpler: for each item / run:
//       write varint(run_len) [>=1]
//       if run_len == 1 and shares (dim, z, y) and dx == 1? No, RLE collapses those into run_len > 1!
//       For each group (run_len entries with consecutive x, same dim, z, y, bid):
//         varint(run_len)
//         u8 dim (if dim != prev_dim? Keep dim delta varint or just u8 + flags byte!)
//     Cleanest compact group encoding:
//       flags u8: bit0=dim_changed, bit1=z_changed, bit2=y_changed, bit3=bid_changed, bit4=has_run(>1)
//       + optional dim u8 (if bit0)
//       + optional zigzag varint(dz) (if bit1)
//       + optional zigzag varint(dy) (if bit2)
//       + zigzag varint(dx)
//       + optional varint(bid) (if bit3)
//       + optional varint(run_len - 2) (if bit4, meaning run_len = 2 + extra)
#[no_mangle]
pub extern "C" fn encode_world_mods_bin(count: u32) -> u32 {
    let n = count as usize;
    if n > MAX_CODEC_ENTRIES {
        return 0;
    }
    let in_ptr = addr_of!(CODEC_IN) as *const u8;
    let out_ptr = addr_of_mut!(CODEC_OUT) as *mut u8;
    let ord_ptr = addr_of_mut!(SORT_ORDER) as *mut u32;

    unsafe {
        for i in 0..n {
            *ord_ptr.add(i) = i as u32;
        }
        heapsort_indices(in_ptr, ord_ptr, n);

        // Deduplicate sorted stream in-place into SORT_ORDER[0..uniq], keeping the last (highest original idx) entry for identical (dim, x, y, z)
        let mut uniq = 0usize;
        let mut i = 0usize;
        while i < n {
            let mut keep_ord = *ord_ptr.add(i);
            let (d0, x0, y0, z0, _) = read_entry_key(in_ptr, keep_ord as usize);
            while i + 1 < n {
                let next_ord = *ord_ptr.add(i + 1);
                let (d1, x1, y1, z1, _) = read_entry_key(in_ptr, next_ord as usize);
                if d0 == d1 && x0 == x1 && y0 == y1 && z0 == z1 {
                    keep_ord = next_ord;
                    i += 1;
                } else {
                    break;
                }
            }
            *ord_ptr.add(uniq) = keep_ord;
            uniq += 1;
            i += 1;
        }

        // Write 10-byte NCW1 header
        *out_ptr.add(0) = b'N';
        *out_ptr.add(1) = b'C';
        *out_ptr.add(2) = b'W';
        *out_ptr.add(3) = b'1';
        let ver_b = 1u16.to_le_bytes();
        *out_ptr.add(4) = ver_b[0];
        *out_ptr.add(5) = ver_b[1];
        let cnt_b = (uniq as u32).to_le_bytes();
        *out_ptr.add(6) = cnt_b[0];
        *out_ptr.add(7) = cnt_b[1];
        *out_ptr.add(8) = cnt_b[2];
        *out_ptr.add(9) = cnt_b[3];

        let mut pos = 10usize;
        let mut prev_dim = 0xffu8;
        let mut prev_x = 0i32;
        let mut prev_y = 0i16;
        let mut prev_z = 0i32;
        let mut prev_bid = 0xffffu16;

        let mut u = 0usize;
        while u < uniq {
            let (dim, x, y, z, bid) = read_entry_key(in_ptr, *ord_ptr.add(u) as usize);
            let mut run_len = 1usize;
            while u + run_len < uniq {
                let (nd, nx, ny, nz, nbid) = read_entry_key(in_ptr, *ord_ptr.add(u + run_len) as usize);
                if nd == dim && nz == z && ny == y && nbid == bid && nx == x.wrapping_add(run_len as i32) {
                    run_len += 1;
                } else {
                    break;
                }
            }

            let mut flags = 0u8;
            if dim != prev_dim { flags |= 1; }
            if z != prev_z || prev_dim == 0xff { flags |= 2; }
            if y != prev_y || prev_dim == 0xff { flags |= 4; }
            if bid != prev_bid { flags |= 8; }
            if run_len > 1 { flags |= 16; }

            if pos >= CODEC_CAP_BYTES { return 0; }
            *out_ptr.add(pos) = flags;
            pos += 1;

            if (flags & 1) != 0 {
                if pos >= CODEC_CAP_BYTES { return 0; }
                *out_ptr.add(pos) = dim;
                pos += 1;
            }
            if (flags & 2) != 0 && !write_varint(out_ptr, &mut pos, zigzag_encode(z.wrapping_sub(prev_z))) {
                return 0;
            }
            if (flags & 4) != 0 && !write_varint(out_ptr, &mut pos, zigzag_encode((y as i32) - (prev_y as i32))) {
                return 0;
            }
            if !write_varint(out_ptr, &mut pos, zigzag_encode(x.wrapping_sub(prev_x))) {
                return 0;
            }
            if (flags & 8) != 0 && !write_varint(out_ptr, &mut pos, bid as u32) {
                return 0;
            }
            if (flags & 16) != 0 && !write_varint(out_ptr, &mut pos, (run_len - 2) as u32) {
                return 0;
            }

            prev_dim = dim;
            prev_z = z;
            prev_y = y;
            prev_x = x.wrapping_add((run_len - 1) as i32);
            prev_bid = bid;
            u += run_len;
        }
        pos as u32
    }
}

#[no_mangle]
pub extern "C" fn decode_world_mods_bin(byte_len: u32) -> u32 {
    let len = byte_len as usize;
    if len < 10 || len > CODEC_CAP_BYTES {
        return 0xFFFF_FFFF;
    }
    let in_ptr = addr_of!(CODEC_IN) as *const u8;
    let out_ptr = addr_of_mut!(CODEC_OUT) as *mut u8;

    unsafe {
        if *in_ptr.add(0) != b'N'
            || *in_ptr.add(1) != b'C'
            || *in_ptr.add(2) != b'W'
            || *in_ptr.add(3) != b'1'
        {
            return 0xFFFF_FFFF;
        }
        let ver = u16::from_le_bytes([*in_ptr.add(4), *in_ptr.add(5)]);
        if ver != 1 {
            return 0xFFFF_FFFF;
        }
        let uniq = u32::from_le_bytes([
            *in_ptr.add(6),
            *in_ptr.add(7),
            *in_ptr.add(8),
            *in_ptr.add(9),
        ]) as usize;
        if uniq > MAX_CODEC_ENTRIES {
            return 0xFFFF_FFFF;
        }

        let mut pos = 10usize;
        let mut out_cnt = 0usize;
        let mut dim = 0u8;
        let mut x = 0i32;
        let mut y = 0i16;
        let mut z = 0i32;
        let mut bid = 0u16;

        while out_cnt < uniq {
            if pos >= len {
                return 0xFFFF_FFFF;
            }
            let flags = *in_ptr.add(pos);
            pos += 1;
            if (flags & 0xe0) != 0 {
                return 0xFFFF_FFFF;
            }
            if (flags & 1) != 0 {
                if pos >= len {
                    return 0xFFFF_FFFF;
                }
                dim = *in_ptr.add(pos);
                pos += 1;
            }
            if (flags & 2) != 0 {
                let dz = match read_varint(in_ptr, &mut pos, len) {
                    Some(v) => zigzag_decode(v),
                    None => return 0xFFFF_FFFF,
                };
                z = z.wrapping_add(dz);
            }
            if (flags & 4) != 0 {
                let dy = match read_varint(in_ptr, &mut pos, len) {
                    Some(v) => zigzag_decode(v),
                    None => return 0xFFFF_FFFF,
                };
                y = ((y as i32).wrapping_add(dy)) as i16;
            }
            let dx = match read_varint(in_ptr, &mut pos, len) {
                Some(v) => zigzag_decode(v),
                None => return 0xFFFF_FFFF,
            };
            x = x.wrapping_add(dx);
            if (flags & 8) != 0 {
                let nb = match read_varint(in_ptr, &mut pos, len) {
                    Some(v) => v,
                    None => return 0xFFFF_FFFF,
                };
                if nb > 65535 {
                    return 0xFFFF_FFFF;
                }
                bid = nb as u16;
            }
            let run_len = if (flags & 16) != 0 {
                let extra = match read_varint(in_ptr, &mut pos, len) {
                    Some(v) => v as usize,
                    None => return 0xFFFF_FFFF,
                };
                2 + extra
            } else {
                1
            };
            if out_cnt + run_len > uniq {
                return 0xFFFF_FFFF;
            }
            for r in 0..run_len {
                let cx = x.wrapping_add(r as i32);
                write_entry(out_ptr, out_cnt, dim, cx, y, z, bid);
                out_cnt += 1;
            }
            x = x.wrapping_add((run_len - 1) as i32);
        }
        if pos != len {
            return 0xFFFF_FFFF;
        }
        out_cnt as u32
    }
}
