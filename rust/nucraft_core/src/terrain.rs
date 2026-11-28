use core::ptr::{addr_of, addr_of_mut};

// Biome IDs matching src/data/items.js BIOMES
pub const B_PLAINS: u8 = 0;
pub const B_FOREST: u8 = 1;
pub const B_DESERT: u8 = 2;
pub const B_SNOW: u8 = 3;
pub const B_SAKURA: u8 = 4;
pub const B_SWAMP: u8 = 5;
pub const B_MESA: u8 = 6;
pub const B_AUTUMN: u8 = 7;
pub const B_LUSH_GROVE: u8 = 8;
pub const B_FLOWER_MEADOW: u8 = 9;
pub const B_TAIGA: u8 = 10;
pub const B_BEACH_PALM: u8 = 15;
pub const B_MANGROVE_SWAMP: u8 = 16;
pub const B_ALPINE_PEAKS: u8 = 17;
pub const B_HIGHLAND_PLATEAU: u8 = 18;
pub const B_DEEP_OCEAN: u8 = 19;
pub const B_BAMBOO_JUNGLE: u8 = 20;
pub const B_MUSHROOM_ISLAND: u8 = 21;
pub const B_LAVENDER_MEADOW: u8 = 22;
pub const B_VOLCANIC_BASALT: u8 = 23;
pub const B_ABANDONED_CITY: u8 = 24;
pub const B_REDWOOD_ANCIENT: u8 = 25;
pub const B_WEEPING_GROVE: u8 = 26;
pub const B_BIRCH_ANCIENT: u8 = 27;
pub const B_AUTUMN_GOLDEN: u8 = 28;
pub const B_AUTUMN_DEEP: u8 = 29;
pub const B_ABYSS_TRENCH: u8 = 30;
pub const B_GLOWSHROOM_GROVE: u8 = 31;
pub const B_DAPPLED_FOREST: u8 = 32;
pub const B_BADLANDS_SPIRES: u8 = 33;
pub const B_BADLANDS_CRATER: u8 = 34;
pub const B_MARSH_RUINS: u8 = 35;
pub const B_TROPICAL_COAST: u8 = 36;
pub const B_GIANT_TREES: u8 = 37;
pub const B_MANOR_GARDEN: u8 = 38;
pub const B_BLUE_FOREST: u8 = 50;
pub const B_WHEAT_VALLEY: u8 = 51;
pub const B_PINE_VALLEY: u8 = 52;
pub const B_GIANT_JUNGLE: u8 = 53;
pub const B_CLOUD_PEAKS: u8 = 54;
pub const B_DARK_FOREST: u8 = 55;
pub const B_PALE_GARDEN: u8 = 56;
pub const B_NIGHTMARE_WOODS: u8 = 57;
pub const B_MEGA_SNOW_PEAKS: u8 = 58;
pub const B_LUSH_STEPPE: u8 = 59;
pub const B_GREEN_PLAINS: u8 = 68;
pub const B_SNOWY_PLAINS: u8 = 69;
pub const B_GRAND_RUINS: u8 = 72;
pub const B_SULFUR_SPRINGS: u8 = 78;

// Underground Biome IDs matching Chunk.js UNDERGROUND_BIOMES
const UB_LUSH_CAVE: u8 = 0;
const UB_CRYSTAL_CAVERN: u8 = 1;
const UB_DRIPSTONE_CAVE: u8 = 2;
const UB_GLOWSHROOM_GROTTO: u8 = 3;
const UB_ICE_CAVERN: u8 = 4;
const UB_DEEP_DARK: u8 = 5;
const UB_MAGMA_CAVERN: u8 = 6;
const UB_SUBTERRANEAN_JUNGLE: u8 = 7;
const UB_ANCIENT_MINES: u8 = 8;
const UB_SULFUR_CAVE: u8 = 9;

// Slot indices in TERRAIN_BIDS
const T_GRASS: usize = 1;
const T_DIRT: usize = 2;
const T_STONE: usize = 3;
const T_SAND: usize = 4;
const T_SNOW: usize = 5;
const T_ICE: usize = 6;
const T_WATER: usize = 7;
const T_TERRACOTTA: usize = 8;
const T_SANDSTONE: usize = 9;
const T_GOLD_ORE: usize = 10;
const T_DEEPSLATE: usize = 11;
const T_BEDROCK: usize = 12;
const T_COAL_ORE: usize = 13;
const T_IRON_ORE: usize = 14;
const T_DIAMOND_ORE: usize = 15;
const T_LAVA: usize = 16;
const T_GLOW_CRYSTAL: usize = 17;
const T_MUD: usize = 18;
const T_PACKED_ICE: usize = 19;
const T_MYCELIUM: usize = 20;
const T_BASALT: usize = 21;
const T_COPPER_ORE: usize = 22;
const T_TIN_ORE: usize = 23;
const T_EMERALD_ORE: usize = 24;
const T_RUBY_ORE: usize = 25;
const T_MOSS_BLOCK: usize = 26;
const T_FARMLAND: usize = 27;
const T_AUTUMN_PODZOL: usize = 28;
const T_LAPIS_ORE: usize = 29;
const T_GRAVEL: usize = 30;
const T_REDSTONE_ORE: usize = 31;
const T_BLUE_GRASS: usize = 32;
const T_SCULK: usize = 33;
const T_RED_SAND: usize = 34;
const T_TERRACOTTA_WHITE: usize = 35;
const T_TERRACOTTA_ORANGE: usize = 36;
const T_TERRACOTTA_YELLOW: usize = 37;
const T_TERRACOTTA_BROWN: usize = 38;
const T_TERRACOTTA_RED: usize = 39;
const T_PALE_MOSS: usize = 40;
const T_NIGHTMARE_MOSS: usize = 41;
const T_SNOWY_DIRT: usize = 42;
const T_SULFUR_BLOCK: usize = 43;
const T_SULFUR_ORE: usize = 44;
const T_CINNABAR_STONE: usize = 45;
const T_TRAVERTINE_STONE: usize = 46;
const T_THERMAL_CRUST: usize = 47;
const T_STONE_BRICK: usize = 48;

static mut TERRAIN_BIDS: [u16; 64] = [0; 64];
static mut AC_COORDS: [i32; 8] = [0; 8];
static mut COL_HEIGHTS: [i16; 256] = [0; 256];
static mut COL_BIOMES: [u8; 256] = [0; 256];
static mut TERRAIN_META: [u32; 4] = [0; 4];

#[no_mangle]
pub extern "C" fn terrain_bids_ptr() -> *mut u16 {
    addr_of_mut!(TERRAIN_BIDS) as *mut u16
}
#[no_mangle]
pub extern "C" fn ac_coords_ptr() -> *mut i32 {
    addr_of_mut!(AC_COORDS) as *mut i32
}
#[no_mangle]
pub extern "C" fn col_heights_ptr() -> *const i16 {
    addr_of!(COL_HEIGHTS) as *const i16
}
#[no_mangle]
pub extern "C" fn col_biomes_ptr() -> *const u8 {
    addr_of!(COL_BIOMES) as *const u8
}
#[no_mangle]
pub extern "C" fn terrain_meta_ptr() -> *const u32 {
    addr_of!(TERRAIN_META) as *const u32
}

#[inline(always)]
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

#[inline(always)]
fn is_wheat_mega_plain(wx: i32, wz: i32) -> bool {
    (9000..11000).contains(&wx) && (9000..11000).contains(&wz)
}

#[inline(always)]
fn is_abandoned_city(wx: i32, wz: i32) -> bool {
    (2000..=7000).contains(&wx) && (2000..=7000).contains(&wz)
}

#[inline(always)]
fn is_grand_ruins(wx: i32, wz: i32) -> bool {
    (-3504..=-2497).contains(&wx) && (-3504..=-2497).contains(&wz)
}

#[inline]
pub fn get_grand_ruins_surface_y(wx: i32, wz: i32, seed: i32) -> i32 {
    let edge_dist = (wx + 3504).min(-2497 - wx).min(wz + 3504).min(-2497 - wz) as f64;
    let edge_blend = (edge_dist / 64.0).max(0.0).min(1.0);
    let wxf = wx as f64;
    let wzf = wz as f64;
    let hill = crate::fbm_2d(wxf * 0.011, wzf * 0.011, 3, 0.52, 2.05, seed.wrapping_add(9203));
    let detail = crate::value_noise_2d(wxf * 0.052, wzf * 0.052, seed.wrapping_add(9209));
    (16.0 + (hill * 18.0 + detail * 3.0) * (0.35 + 0.65 * edge_blend)).floor() as i32
}

#[inline(always)]
fn spawn_continent_anchor(seed: i32) -> (i32, i32) {
    let s = if seed == 0 { 1u32 } else { seed as u32 };
    let a = (s ^ 0x9e3779b9).wrapping_mul(0x85ebca6b);
    let b = (s ^ 0xc2b2ae35).wrapping_mul(0x27d4eb2f);
    ((a % 3600) as i32 - 1800, (b % 3600) as i32 - 1800)
}

struct OceanMacro {
    is_ocean: bool,
    openness: f64,
    trench_factor: f64,
}

#[inline]
fn get_ocean_macro(wx: i32, wz: i32, seed: i32) -> OceanMacro {
    let (spx, spz) = spawn_continent_anchor(seed);
    let wxf = wx as f64;
    let wzf = wz as f64;
    let d_sp = (wxf - (spx as f64)).hypot(wzf - (spz as f64));
    let spawn_lift = if d_sp < 580.0 {
        (1.0 - d_sp / 580.0).max(0.0) * 0.44
    } else {
        0.0
    };
    // Keep the entire 1000x1000 Grand End Portal Ruins + surrounding border on solid dry mainland (NEVER ocean)
    let d_ruins = (wxf + 3000.0).hypot(wzf + 3000.0);
    let ruins_lift = if d_ruins < 1120.0 {
        (1.0 - (d_ruins - 780.0).max(0.0) / 340.0).max(0.0) * 0.56
    } else {
        0.0
    };
    let macro_v = crate::fbm_2d(wxf * 0.000105, wzf * 0.000105, 3, 0.52, 2.0, seed.wrapping_add(4111));
    let coast_jitter = (crate::fbm_2d(wxf * 0.0014, wzf * 0.0014, 2, 0.5, 2.0, seed.wrapping_add(411)) - 0.5) * 0.14;
    let sea_val = macro_v + coast_jitter + spawn_lift + ruins_lift;
    let is_ocean = sea_val < 0.47;
    let openness = if is_ocean {
        ((0.47 - sea_val) / 0.22).max(0.0).min(1.0)
    } else {
        0.0
    };
    let ridge = crate::fbm_2d(wxf * 0.0011, wzf * 0.0011, 2, 0.5, 2.0, seed.wrapping_add(4157));
    let trench_factor = (1.0 - (ridge - 0.5).abs() * 3.8).max(0.0);
    OceanMacro { is_ocean, openness, trench_factor }
}

struct OceanIsland {
    in_island: bool,
    in_seamount: bool,
    biome: u8,
    elev_y: i32,
    norm_dist: f64,
    is_atoll: bool,
}

fn get_ocean_island_info(wx: i32, wz: i32, openness: f64, seed: i32) -> Option<OceanIsland> {
    if openness <= 0.08 {
        return None;
    }
    const CELL: i32 = 224;
    let wxf = wx as f64;
    let wzf = wz as f64;
    let gx = (wxf / (CELL as f64)).floor() as i32;
    let gz = (wzf / (CELL as f64)).floor() as i32;
    if crate::hash2i_f64(gx, gz, seed.wrapping_add(6421)) > 0.38 {
        return None;
    }
    let ix = ((gx as f64) + 0.24 + crate::hash2i_f64(gx, gz, seed.wrapping_add(6427)) * 0.52) * (CELL as f64);
    let iz = ((gz as f64) + 0.24 + crate::hash2i_f64(gx, gz, seed.wrapping_add(6449)) * 0.52) * (CELL as f64);
    let rad = 16.0 + crate::hash2i_f64(gx, gz, seed.wrapping_add(6451)) * 24.0;
    let dist = (wxf - ix).hypot(wzf - iz);
    if dist > rad * 1.9 {
        return None;
    }
    let ang = (wzf - iz).atan2(wxf - ix);
    let shore_warp = (crate::value_noise_2d(wxf * 0.075, wzf * 0.075, seed.wrapping_add(6469)) - 0.5) * 0.26
        + (ang * 3.0 + (gx as f64)).sin() * 0.06;
    let norm_dist = dist / rad + shore_warp;
    if norm_dist > 1.65 {
        return None;
    }
    let kr = crate::hash2i_f64(gx, gz, seed.wrapping_add(6473));
    let (kind, biome) = if kr < 0.24 {
        (0u8, B_BEACH_PALM)
    } else if kr < 0.44 {
        (1u8, B_TROPICAL_COAST)
    } else if kr < 0.60 {
        (2u8, B_MUSHROOM_ISLAND)
    } else if kr < 0.74 {
        (3u8, B_VOLCANIC_BASALT)
    } else if kr < 0.88 {
        (4u8, B_SAKURA)
    } else {
        (5u8, B_BEACH_PALM)
    };
    let det = crate::value_noise_2d(wxf * 0.09, wzf * 0.09, seed.wrapping_add(6481));
    let in_island = norm_dist < 1.0;
    let mut elev_y = 1i32;
    if in_island {
        let dome = (1.0 - norm_dist * norm_dist).max(0.0);
        if kind == 5 {
            let ring = (1.0 - (norm_dist - 0.66).abs() * 3.4).max(0.0);
            elev_y = if norm_dist < 0.40 {
                -2
            } else {
                js_round(-1.0 + ring * 5.2 + det * 1.4) as i32
            };
        } else if kind == 3 {
            let rim = (1.0 - (norm_dist - 0.30).abs() * 2.8).max(0.0);
            elev_y = if norm_dist < 0.20 {
                6
            } else {
                js_round(1.0 + dome * 12.0 + rim * 10.0 + det * 2.0) as i32
            };
        } else {
            let amp = if kind == 2 { 11.0 } else { 8.5 };
            elev_y = js_round(1.0 + dome * amp + det * 2.2) as i32;
        }
    }
    Some(OceanIsland {
        in_island,
        in_seamount: !in_island,
        biome,
        elev_y,
        norm_dist,
        is_atoll: kind == 5,
    })
}

pub fn get_ocean_floor_true_y(wx: i32, wz: i32, biome: u8, seed: i32) -> i32 {
    let m = get_ocean_macro(wx, wz, seed);
    let isl = get_ocean_island_info(wx, wz, m.openness, seed);
    if let Some(ref is_i) = isl {
        if is_i.in_island {
            return is_i.elev_y;
        }
    }
    let wxf = wx as f64;
    let wzf = wz as f64;
    let cont = crate::fbm_2d(wxf * 0.011, wzf * 0.011, 2, 0.52, 2.05, seed);
    let det = crate::value_noise_2d(wxf * 0.052, wzf * 0.052, seed.wrapping_add(404));
    let mut floor_y = if m.openness < 0.14 {
        -5.0 - (m.openness / 0.14) * 27.0 + (cont - 0.5) * 6.0 + det * 2.0
    } else {
        let op = (m.openness - 0.14) / 0.86;
        let abyss = op.powf(1.05) * 428.0;
        let hadal = if m.trench_factor > 0.35 && op > 0.38 {
            ((m.trench_factor - 0.35) / 0.65).powf(1.15) * ((op - 0.38) / 0.62) * 255.0
        } else {
            0.0
        };
        -32.0 - abyss - hadal + (cont - 0.5) * 24.0 + det * 3.5
    };
    if !m.is_ocean && biome == B_DEEP_OCEAN {
        floor_y = floor_y.max(-26.0);
    }
    let mut fy_i = (js_round(floor_y) as i32).max(-700).min(-3);
    if let Some(ref is_i) = isl {
        if is_i.in_seamount {
            let t = ((is_i.norm_dist - 1.0) / 0.65).max(0.0).min(1.0);
            let sm = t * t * (3.0 - 2.0 * t);
            let sm_top = if is_i.is_atoll { -3.0 } else { -2.0 };
            fy_i = js_round(sm_top + ((fy_i as f64) - sm_top) * sm) as i32;
        }
    }
    fy_i.max(-700).min(-2)
}

pub fn get_overworld_biome_at(wx: i32, wz: i32, seed: i32) -> u8 {
    if is_wheat_mega_plain(wx, wz) {
        return B_WHEAT_VALLEY;
    }
    if is_abandoned_city(wx, wz) {
        return B_ABANDONED_CITY;
    }
    if is_grand_ruins(wx, wz) {
        return B_GRAND_RUINS;
    }
    let o_mac = get_ocean_macro(wx, wz, seed);
    if o_mac.is_ocean {
        if let Some(isl) = get_ocean_island_info(wx, wz, o_mac.openness, seed) {
            if isl.in_island {
                return isl.biome;
            }
        }
        return if o_mac.openness > 0.34 || o_mac.trench_factor > 0.55 {
            B_ABYSS_TRENCH
        } else {
            B_DEEP_OCEAN
        };
    }
    let wxf = wx as f64;
    let wzf = wz as f64;
    let warp_x = (crate::value_noise_2d(wxf * 0.0016, wzf * 0.0016, seed.wrapping_add(511)) - 0.5) * 140.0;
    let warp_z = (crate::value_noise_2d(wxf * 0.0016 + 19.7, wzf * 0.0016 - 23.1, seed.wrapping_add(523)) - 0.5) * 140.0;
    let bx = wxf + warp_x;
    let bz = wzf + warp_z;
    let coast = crate::fbm_2d(bx * 0.00055, bz * 0.00055, 2, 0.5, 2.0, seed.wrapping_add(411));
    let humid = crate::fbm_2d(bx * 0.00048 + 3.1, bz * 0.00048 - 2.7, 2, 0.5, 2.0, seed.wrapping_add(202));
    let heat = crate::fbm_2d(bx * 0.00045 - 4.3, bz * 0.00045 + 5.9, 2, 0.5, 2.0, seed.wrapping_add(101));
    let spooky_band = crate::fbm_2d(bx * 0.00095 + 11.1, bz * 0.00095 - 7.3, 2, 0.5, 2.0, seed.wrapping_add(677));

    if coast < 0.14 && humid > 0.62 { return B_MUSHROOM_ISLAND; }
    if coast < 0.14 { return B_DEEP_OCEAN; }
    if coast < 0.21 && humid > 0.60 { return B_MARSH_RUINS; }
    if coast < 0.23 { return B_DEEP_OCEAN; }
    if coast < 0.30 && heat > 0.60 { return B_TROPICAL_COAST; }
    if coast < 0.30 && heat > 0.35 { return B_BEACH_PALM; }

    let elev = crate::fbm_2d(bx * 0.00072, bz * 0.00072, 2, 0.5, 2.0, seed.wrapping_add(303));
    if elev > 0.78 { return B_MEGA_SNOW_PEAKS; }
    if elev > 0.71 { return B_CLOUD_PEAKS; }
    let plain_band = crate::fbm_2d(bx * 0.00058, bz * 0.00058, 2, 0.5, 2.0, seed.wrapping_add(641));
    if heat < 0.28 && elev > 0.50 {
        return if elev > 0.62 { B_MEGA_SNOW_PEAKS } else { B_ALPINE_PEAKS };
    }
    if heat < 0.29 {
        return if elev < 0.48 && plain_band > 0.42 { B_SNOWY_PLAINS } else { B_SNOW };
    }
    if heat < 0.36 && humid > 0.56 { return B_REDWOOD_ANCIENT; }
    if heat < 0.40 {
        if heat >= 0.31 && humid > 0.62 { return B_GIANT_TREES; }
        if heat >= 0.29 && humid >= 0.44 && humid <= 0.62 && elev < 0.56 { return B_PINE_VALLEY; }
        if humid > 0.48 { return B_TAIGA; }
        return if plain_band > 0.46 { B_SNOWY_PLAINS } else { B_SNOW };
    }
    if heat > 0.73 && elev > 0.62 { return B_VOLCANIC_BASALT; }
    if heat > 0.56 && heat <= 0.74 && humid >= 0.38 && humid <= 0.68 && elev >= 0.28 && elev <= 0.66 && spooky_band > 0.40 {
        return B_SULFUR_SPRINGS;
    }
    if heat > 0.70 && elev < 0.36 && humid < 0.37 { return B_BADLANDS_CRATER; }
    if heat > 0.68 && elev > 0.50 { return B_BADLANDS_SPIRES; }
    if heat > 0.65 && humid >= 0.38 && elev > 0.42 { return B_MESA; }
    if elev > 0.64 && humid >= 0.28 && humid <= 0.66 { return B_HIGHLAND_PLATEAU; }
    if heat > 0.60 && humid < 0.44 { return B_DESERT; }
    if heat > 0.66 {
        return if humid < 0.48 { B_DESERT } else { B_MESA };
    }
    if humid > 0.58 && elev > 0.44 {
        if spooky_band > 0.76 { return B_NIGHTMARE_WOODS; }
        if spooky_band > 0.58 { return B_PALE_GARDEN; }
        if spooky_band < 0.34 && heat >= 0.40 && heat <= 0.60 { return B_DARK_FOREST; }
    }
    if heat >= 0.47 && heat <= 0.61 && humid >= 0.30 && humid <= 0.42 && elev < 0.52 { return B_WHEAT_VALLEY; }
    if elev < 0.53 && heat >= 0.36 && heat <= 0.64 && (humid < 0.44 || (plain_band > 0.52 && humid < 0.60)) {
        return if plain_band > 0.68 { B_LUSH_STEPPE } else if plain_band > 0.50 { B_GREEN_PLAINS } else { B_PLAINS };
    }
    if heat > 0.57 && humid > 0.67 { return B_BAMBOO_JUNGLE; }
    if heat > 0.51 && heat <= 0.64 && humid > 0.62 && elev < 0.56 { return B_GIANT_JUNGLE; }
    if heat > 0.59 && heat <= 0.74 && humid > 0.60 { return B_DAPPLED_FOREST; }
    if heat > 0.56 && humid >= 0.44 && humid <= 0.60 {
        if elev > 0.57 { return B_AUTUMN_DEEP; }
        if humid > 0.52 { return B_AUTUMN_GOLDEN; }
        return B_AUTUMN;
    }
    if heat >= 0.40 && heat < 0.47 && humid > 0.55 && elev < 0.60 { return B_BLUE_FOREST; }
    if humid > 0.70 && elev > 0.55 { return B_GLOWSHROOM_GROVE; }
    if humid > 0.66 && elev >= 0.46 && elev < 0.56 { return B_WEEPING_GROVE; }
    if humid > 0.63 {
        if elev < 0.40 { return B_MANGROVE_SWAMP; }
        if elev < 0.47 { return B_SWAMP; }
        if elev < 0.58 { return B_LUSH_GROVE; }
        return B_FOREST;
    }
    if humid > 0.48 && heat > 0.45 && heat <= 0.57 { return B_SAKURA; }
    if humid > 0.42 && humid <= 0.52 && heat >= 0.40 && heat <= 0.47 { return B_BIRCH_ANCIENT; }
    if elev > 0.54 && humid > 0.48 { return B_LAVENDER_MEADOW; }
    if elev > 0.48 && elev <= 0.54 && humid > 0.44 && humid <= 0.53 && heat > 0.40 && heat <= 0.52 {
        return B_MANOR_GARDEN;
    }
    if elev > 0.52 && humid > 0.40 { return B_FLOWER_MEADOW; }
    if humid >= 0.52 { B_FOREST } else { B_PLAINS }
}

pub fn get_overworld_raw_height(wx: i32, wz: i32, biome: u8, seed: i32, water_level: i32) -> f64 {
    let wl = water_level as f64;
    if biome == B_ABANDONED_CITY { return 2.0; }
    if biome == B_GRAND_RUINS { return get_grand_ruins_surface_y(wx, wz, seed) as f64; }
    let wxf = wx as f64;
    let wzf = wz as f64;
    if is_wheat_mega_plain(wx, wz) {
        let hill = crate::fbm_2d(wxf * 0.0055, wzf * 0.0055, 2, 0.5, 2.0, seed.wrapping_add(881));
        let wave = crate::value_noise_2d(wxf * 0.018, wzf * 0.018, seed.wrapping_add(883));
        let edge_dist = (wx - 9000).min(11000 - wx).min(wz - 9000).min(11000 - wz) as f64;
        let edge_blend = (edge_dist / 48.0).max(0.0).min(1.0);
        return (2.5 + (hill * 3.8 + wave * 0.7) * edge_blend).max(2.0);
    }
    let o_mac = get_ocean_macro(wx, wz, seed);
    if o_mac.is_ocean {
        if let Some(isl) = get_ocean_island_info(wx, wz, o_mac.openness, seed) {
            if isl.in_island {
                return isl.elev_y as f64;
            }
        }
        return get_ocean_floor_true_y(wx, wz, biome, seed).max(-44) as f64;
    }
    let cont = crate::fbm_2d(wxf * 0.011, wzf * 0.011, 3, 0.52, 2.05, seed);
    let detail = crate::value_noise_2d(wxf * 0.052, wzf * 0.052, seed.wrapping_add(404));
    let mut h = -4.0 + cont * 17.0 + detail * 2.2;
    match biome {
        B_ABYSS_TRENCH | B_DEEP_OCEAN => {
            h = get_ocean_floor_true_y(wx, wz, biome, seed).max(-44) as f64;
        }
        B_PLAINS | B_GREEN_PLAINS => {
            let pond = crate::value_noise_2d(wxf * 0.028, wzf * 0.028, seed.wrapping_add(643));
            let amp = if biome == B_GREEN_PLAINS { 4.4 } else { 5.2 };
            h = if pond < 0.14 && cont < 0.36 { wl - 2.0 + pond * 6.0 } else { 1.5 + cont * amp + detail * 0.75 };
        }
        B_SNOWY_PLAINS => {
            let sn_bay = crate::value_noise_2d(wxf * 0.024, wzf * 0.024, seed.wrapping_add(649));
            h = if sn_bay < 0.15 && cont < 0.42 { wl - 2.0 + sn_bay * 5.5 } else { 1.5 + cont * 4.4 + detail * 0.65 };
        }
        B_MUSHROOM_ISLAND => h = 1.0 + cont * 9.0 + detail * 1.8,
        B_BEACH_PALM => h = -2.5 + cont * 7.2 + detail * 1.2,
        B_MANGROVE_SWAMP => h = -2.0 + cont * 4.5 + detail * 0.9,
        B_MEGA_SNOW_PEAKS => {
            let m_peak = (cont * 1.24 - 0.04).max(0.0).powf(1.38);
            let ridge = (crate::fbm_2d(wxf * 0.019, wzf * 0.019, 2, 0.5, 2.0, seed.wrapping_add(331)) - 0.5).abs() * 32.0;
            h = 54.0 + m_peak * 68.0 + ridge + detail * 4.5;
        }
        B_CLOUD_PEAKS => {
            let m_peak = (cont * 1.18 - 0.08).max(0.0).powf(1.32);
            let sharp = (crate::fbm_2d(wxf * 0.024, wzf * 0.024, 2, 0.5, 2.0, seed.wrapping_add(319)) - 0.5).abs() * 20.0;
            h = 26.0 + m_peak * 64.0 + sharp + detail * 4.2;
        }
        B_ALPINE_PEAKS => {
            let ridge = (cont * 1.15 - 0.10).max(0.0).powf(1.35);
            h = 16.0 + ridge * 52.0 + detail * 4.2;
        }
        B_HIGHLAND_PLATEAU => h = 14.0 + cont * 24.0 + detail * 2.4,
        B_LUSH_STEPPE => h = 2.0 + cont * 8.0 + detail * 1.2,
        B_DARK_FOREST => h = -1.0 + cont * 12.0 + detail * 2.0,
        B_PALE_GARDEN => h = 2.0 + cont * 14.0 + detail * 2.2,
        B_NIGHTMARE_WOODS => h = 3.0 + cont * 18.0 + (detail - 0.5).abs() * 6.0,
        B_VOLCANIC_BASALT => h = 1.0 + cont * 19.0 + detail * 3.0,
        B_SULFUR_SPRINGS => {
            let b_field = crate::fbm_2d(wxf * 0.038, wzf * 0.038, 2, 0.5, 2.0, seed.wrapping_add(7801));
            let ridge = crate::value_noise_2d(wxf * 0.016, wzf * 0.016, seed.wrapping_add(7803));
            if b_field < 0.39 { h = wl - 2.2; }
            else if b_field < 0.47 { h = wl + 1.0; }
            else if b_field < 0.55 { h = wl + 2.0 + (ridge * 2.0).floor(); }
            else { h = 2.0 + ((b_field - 0.55) * 26.0).floor() + ridge * 5.0; }
        }
        B_BAMBOO_JUNGLE => h = -1.0 + cont * 15.0 + detail * 2.2,
        B_REDWOOD_ANCIENT => h = 1.0 + cont * 18.0 + detail * 2.4,
        B_WEEPING_GROVE => h = -1.5 + cont * 10.0 + detail * 1.6,
        B_BIRCH_ANCIENT => h = cont * 13.0 + detail * 2.0,
        B_SWAMP => h = -2.4 + cont * 6.5 + detail * 1.2,
        B_LUSH_GROVE => h = -2.8 + cont * 12.0 + detail * 2.0,
        B_DESERT => h = -1.0 + cont * 13.0 + detail * 1.8,
        B_SNOW => h = 1.0 + cont * 22.0 + detail * 3.2,
        B_TAIGA => h = -1.0 + cont * 19.0 + detail * 2.8,
        B_AUTUMN | B_AUTUMN_GOLDEN | B_AUTUMN_DEEP => h = -2.0 + cont * 15.0 + detail * 2.2,
        B_FLOWER_MEADOW | B_LAVENDER_MEADOW => h = cont * 11.0 + detail * 1.6,
        B_MESA => {
            let m_plat = crate::fbm_2d(wxf * 0.015, wzf * 0.015, 2, 0.5, 2.0, seed.wrapping_add(733));
            let raw = 2.0 + (m_plat - 0.22).max(0.0) * 46.0;
            h = (raw / 3.0).floor() * 3.0 + (raw % 3.0) * 0.25 + detail * 1.0;
        }
        B_GLOWSHROOM_GROVE => h = -1.0 + cont * 13.0 + detail * 2.2,
        B_DAPPLED_FOREST => h = -2.0 + cont * 14.0 + detail * 2.0,
        B_BADLANDS_SPIRES => {
            let s_field = crate::fbm_2d(wxf * 0.036, wzf * 0.036, 2, 0.5, 2.0, seed.wrapping_add(719));
            let s_plat = crate::fbm_2d(wxf * 0.014, wzf * 0.014, 2, 0.5, 2.0, seed.wrapping_add(727));
            let spire = if s_field > 0.57 {
                ((s_field - 0.57) / 0.43).powf(1.15) * 38.0
            } else if s_plat > 0.62 {
                ((s_plat - 0.62) * 42.0).floor()
            } else {
                0.0
            };
            let sp2 = ((spire / 2.0).floor() * 2.0).min(46.0);
            h = 2.0 + sp2 + detail * 1.1;
        }
        B_BADLANDS_CRATER => h = -4.0 + cont * 7.0 + detail * 1.4,
        B_MARSH_RUINS => h = -2.6 + cont * 4.6 + detail * 1.0,
        B_TROPICAL_COAST => h = -1.5 + cont * 9.0 + detail * 1.6,
        B_GIANT_TREES => h = cont * 18.0 + detail * 2.6,
        B_MANOR_GARDEN => h = -1.0 + cont * 10.0 + detail * 1.4,
        B_BLUE_FOREST => {
            h = if cont < 0.25 && detail < 0.18 { wl - 1.0 } else { 0.5 + cont * 11.0 + detail * 1.6 };
        }
        B_WHEAT_VALLEY => h = 2.0 + cont * 4.0 + detail * 0.5,
        B_PINE_VALLEY => {
            h = if cont < 0.26 && detail < 0.22 { wl - 1.0 } else { -0.5 + cont * 12.0 + detail * 1.5 };
        }
        B_GIANT_JUNGLE => {
            let jr = (crate::fbm_2d(wxf * 0.0085, wzf * 0.0085, 2, 0.5, 2.0, seed.wrapping_add(743)) - 0.5).abs();
            h = if jr < 0.09 { wl - 2.4 } else { -0.5 + cont * 13.0 + detail * 2.0 };
        }
        _ => {}
    }
    h
}

pub fn get_overworld_terrain_height(
    wx: i32,
    wz: i32,
    biome: u8,
    seed: i32,
    min_y: i32,
    max_y: i32,
    water_level: i32,
) -> i32 {
    if biome == B_ABANDONED_CITY { return 2; }
    if biome == B_GRAND_RUINS { return get_grand_ruins_surface_y(wx, wz, seed).max(min_y + 4).min(max_y - 8); }
    let bc = biome;
    let b1 = get_overworld_biome_at(wx + 8, wz, seed);
    let b2 = get_overworld_biome_at(wx - 8, wz, seed);
    let b3 = get_overworld_biome_at(wx, wz + 8, seed);
    let b4 = get_overworld_biome_at(wx, wz - 8, seed);
    let b5 = get_overworld_biome_at(wx + 20, wz, seed);
    let b6 = get_overworld_biome_at(wx - 20, wz, seed);
    let b7 = get_overworld_biome_at(wx, wz + 20, seed);
    let b8 = get_overworld_biome_at(wx, wz - 20, seed);
    let h = if b1 == bc && b2 == bc && b3 == bc && b4 == bc && b5 == bc && b6 == bc && b7 == bc && b8 == bc {
        get_overworld_raw_height(wx, wz, bc, seed, water_level)
    } else {
        (get_overworld_raw_height(wx, wz, bc, seed, water_level) * 4.0
            + get_overworld_raw_height(wx + 8, wz, b1, seed, water_level) * 1.25
            + get_overworld_raw_height(wx - 8, wz, b2, seed, water_level) * 1.25
            + get_overworld_raw_height(wx, wz + 8, b3, seed, water_level) * 1.25
            + get_overworld_raw_height(wx, wz - 8, b4, seed, water_level) * 1.25
            + get_overworld_raw_height(wx + 20, wz, b5, seed, water_level) * 0.75
            + get_overworld_raw_height(wx - 20, wz, b6, seed, water_level) * 0.75
            + get_overworld_raw_height(wx, wz + 20, b7, seed, water_level) * 0.75
            + get_overworld_raw_height(wx, wz - 20, b8, seed, water_level) * 0.75)
            / 12.0
    };
    (h.floor() as i32).max(min_y + 4).min(max_y - 8)
}

fn is_deep_dark_eligible_surface(wx: i32, wz: i32, seed: i32, min_y: i32, max_y: i32, water_level: i32) -> bool {
    if get_ocean_macro(wx, wz, seed).is_ocean {
        return false;
    }
    let b = get_overworld_biome_at(wx, wz, seed);
    if matches!(
        b,
        B_DEEP_OCEAN | B_ABYSS_TRENCH | B_SWAMP | B_MANGROVE_SWAMP | B_MARSH_RUINS
            | B_BEACH_PALM | B_TROPICAL_COAST | B_ABANDONED_CITY
    ) {
        return false;
    }
    if matches!(
        b,
        B_ALPINE_PEAKS | B_CLOUD_PEAKS | B_HIGHLAND_PLATEAU | B_SAKURA
            | B_SNOW | B_SNOWY_PLAINS | B_BADLANDS_SPIRES | B_VOLCANIC_BASALT
    ) {
        return true;
    }
    get_overworld_terrain_height(wx, wz, b, seed, min_y, max_y, water_level) >= 12
}

#[allow(clippy::too_many_arguments)]
fn get_underground_biome_id(
    wx: i32,
    true_y: i32,
    wz: i32,
    seed: i32,
    ox: f64,
    oy: f64,
    oz: f64,
    b1: i32,
    b2: i32,
    s1: i32,
    min_y: i32,
    max_y: i32,
    water_level: i32,
) -> u8 {
    if (-76..=-14).contains(&true_y) {
        let ac = unsafe { &*addr_of!(AC_COORDS) };
        for i in 0..4usize {
            if (wx - ac[i * 2]).abs() <= 72 && (wz - ac[i * 2 + 1]).abs() <= 72 {
                return UB_DEEP_DARK;
            }
        }
    }
    if (-96..=-4).contains(&true_y) && get_overworld_biome_at(wx, wz, seed) == B_SULFUR_SPRINGS {
        return UB_SULFUR_CAVE;
    }
    let sx = ((wx as f64) + ox * 0.25) * 0.0115;
    let sy = ((true_y as f64) + oy * 0.25) * 0.0185;
    let sz = ((wz as f64) + oz * 0.25) * 0.0115;
    let temp = crate::value_noise_3d(sx, sy, sz, b1) * 0.68
        + crate::value_noise_3d(sx * 2.3 + 13.7, sy * 2.1, sz * 2.3 - 9.4, b1.wrapping_add(17)) * 0.32;
    let humid = crate::value_noise_3d(sx * 1.17 + 31.7, sy * 0.96 - 17.3, sz * 1.17 + 19.1, b2) * 0.68
        + crate::value_noise_3d(sx * 2.4 - 7.1, sy * 2.2 + 5.3, sz * 2.4 + 21.8, b2.wrapping_add(29)) * 0.32;
    let weird = crate::value_noise_3d(sx * 1.45 - 23.1, sy * 1.55 + 41.2, sz * 1.45 + 11.9, s1.wrapping_add(73));
    if true_y <= -760 && temp > 0.32 { return UB_MAGMA_CAVERN; }
    if true_y <= -600 && temp > 0.54 { return UB_MAGMA_CAVERN; }
    if temp > 0.69 && true_y <= -40 { return UB_MAGMA_CAVERN; }
    if temp > 0.58 && weird > 0.52 && true_y > -140 { return UB_SULFUR_CAVE; }
    if temp < 0.28 && humid < 0.56 { return UB_ICE_CAVERN; }
    if true_y <= -30 && temp < 0.45 && humid > 0.55 && is_deep_dark_eligible_surface(wx, wz, seed, min_y, max_y, water_level) {
        return UB_DEEP_DARK;
    }
    if humid > 0.67 && weird > 0.52 { return UB_SUBTERRANEAN_JUNGLE; }
    if humid > 0.59 && temp >= 0.30 && temp <= 0.68 { return UB_LUSH_CAVE; }
    if weird > 0.62 && temp < 0.54 { return UB_CRYSTAL_CAVERN; }
    if humid > 0.50 && temp >= 0.44 { return UB_GLOWSHROOM_GROTTO; }
    if weird < 0.34 && true_y <= -30 { return UB_ANCIENT_MINES; }
    if true_y <= -110 && temp < 0.38 && is_deep_dark_eligible_surface(wx, wz, seed, min_y, max_y, water_level) {
        return UB_DEEP_DARK;
    }
    UB_DRIPSTONE_CAVE
}

#[inline(always)]
unsafe fn sample_cave_fast(coarse: *const f32, lx: usize, ly: usize, lz: usize) -> f64 {
    let gx = lx >> 2;
    let gy = ly >> 2;
    let gz = lz >> 2;
    if gy >= 64 {
        return 0.0;
    }
    let fx = ((lx & 3) as f64) * 0.25;
    let fy = ((ly & 3) as f64) * 0.25;
    let fz = ((lz & 3) as f64) * 0.25;
    let base = (gy * 5 + gz) * 5 + gx;
    const SY: usize = 25;
    const SZ: usize = 5;
    let c000 = *coarse.add(base) as f64;
    let c001 = *coarse.add(base + 1) as f64;
    let c010 = *coarse.add(base + SZ) as f64;
    let c011 = *coarse.add(base + SZ + 1) as f64;
    let c100 = *coarse.add(base + SY) as f64;
    let c101 = *coarse.add(base + SY + 1) as f64;
    let c110 = *coarse.add(base + SY + SZ) as f64;
    let c111 = *coarse.add(base + SY + SZ + 1) as f64;
    let x00 = c000 + (c001 - c000) * fx;
    let x01 = c010 + (c011 - c010) * fx;
    let x10 = c100 + (c101 - c100) * fx;
    let x11 = c110 + (c111 - c110) * fx;
    (x00 + (x01 - x00) * fz) + ((x10 + (x11 - x10) * fz) - (x00 + (x01 - x00) * fz)) * fy
}

#[no_mangle]
pub extern "C" fn overworld_biome_at(wx: i32, wz: i32, seed: i32) -> u32 {
    get_overworld_biome_at(wx, wz, seed) as u32
}

#[no_mangle]
pub extern "C" fn overworld_terrain_height(
    wx: i32,
    wz: i32,
    seed: i32,
    min_y: i32,
    max_y: i32,
    water_level: i32,
) -> i32 {
    let b = get_overworld_biome_at(wx, wz, seed);
    get_overworld_terrain_height(wx, wz, b, seed, min_y, max_y, water_level)
}

#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn generate_overworld_base_chunk(
    cx: i32,
    cz: i32,
    seed: i32,
    ox: f64,
    oy: f64,
    oz: f64,
    c1: i32,
    c2: i32,
    c3: i32,
    c4: i32,
    b1: i32,
    b2: i32,
    s1: i32,
    d_off: i32,
    min_y: i32,
    max_y: i32,
    water_level: i32,
) -> u32 {
    let wx0 = cx * 16;
    let wz0 = cz * 16;
    let data = addr_of_mut!(crate::mesher::CHUNK_DATA) as *mut u16;
    let bids = addr_of!(TERRAIN_BIDS) as *const u16;
    let ch_ptr = addr_of_mut!(COL_HEIGHTS) as *mut i16;
    let cb_ptr = addr_of_mut!(COL_BIOMES) as *mut u8;
    let meta_ptr = addr_of_mut!(TERRAIN_META) as *mut u32;

    unsafe {
        let bc0 = get_overworld_biome_at(wx0 + 8, wz0 + 8, seed);
        let is_uniform_biome = get_overworld_biome_at(wx0 - 12, wz0 - 12, seed) == bc0
            && get_overworld_biome_at(wx0 + 28, wz0 - 12, seed) == bc0
            && get_overworld_biome_at(wx0 - 12, wz0 + 28, seed) == bc0
            && get_overworld_biome_at(wx0 + 28, wz0 + 28, seed) == bc0
            && get_overworld_biome_at(wx0 + 8, wz0 - 12, seed) == bc0
            && get_overworld_biome_at(wx0 + 8, wz0 + 28, seed) == bc0
            && get_overworld_biome_at(wx0 - 12, wz0 + 8, seed) == bc0
            && get_overworld_biome_at(wx0 + 28, wz0 + 8, seed) == bc0;

        if is_uniform_biome && (bc0 == B_ABYSS_TRENCH || bc0 == B_DEEP_OCEAN) {
            let f_max = get_ocean_floor_true_y(wx0 + 8, wz0 + 8, bc0, seed)
                .max(get_ocean_floor_true_y(wx0, wz0, bc0, seed))
                .max(get_ocean_floor_true_y(wx0 + 15, wz0, bc0, seed))
                .max(get_ocean_floor_true_y(wx0, wz0 + 15, bc0, seed))
                .max(get_ocean_floor_true_y(wx0 + 15, wz0 + 15, bc0, seed));
            if f_max < min_y - 3 {
                let w_top_ly = (water_level - min_y).max(0).min(255) as usize;
                let fill_end = (w_top_ly + 1) << 8;
                let water_id = *bids.add(T_WATER);
                let mut i = 0usize;
                while i < fill_end {
                    *data.add(i) = water_id;
                    i += 1;
                }
                while i < crate::mesher::CHUNK_VOXELS {
                    *data.add(i) = 0;
                    i += 1;
                }
                *meta_ptr.add(0) = w_top_ly as u32;
                *meta_ptr.add(1) = 1;
                *meta_ptr.add(2) = bc0 as u32;
                *meta_ptr.add(3) = 1;
                return w_top_ly as u32;
            }
        }

        // Zero chunk buffer before populating
        let mut zi = 0usize;
        while zi < crate::mesher::CHUNK_VOXELS {
            *data.add(zi) = 0;
            zi += 1;
        }

        crate::compute_coarse_cave_grid(wx0, wz0, ox, oy, oz, c1, c2, c3, c4, d_off, min_y);
        let coarse = crate::coarse_grid_ptr();
        let mut max_ly: usize = 0;

        let mesa_strata = [
            *bids.add(T_TERRACOTTA),
            *bids.add(T_TERRACOTTA_ORANGE),
            *bids.add(T_TERRACOTTA_WHITE),
            *bids.add(T_TERRACOTTA),
            *bids.add(T_TERRACOTTA_YELLOW),
            *bids.add(T_TERRACOTTA_BROWN),
            *bids.add(T_TERRACOTTA_ORANGE),
            *bids.add(T_TERRACOTTA_RED),
            *bids.add(T_TERRACOTTA),
            *bids.add(T_TERRACOTTA_WHITE),
            *bids.add(T_TERRACOTTA_ORANGE),
            *bids.add(T_TERRACOTTA_BROWN),
            *bids.add(T_TERRACOTTA_YELLOW),
            *bids.add(T_TERRACOTTA_RED),
            *bids.add(T_TERRACOTTA_ORANGE),
            *bids.add(T_TERRACOTTA),
        ];

        for lz in 0..16usize {
            let wz = wz0 + (lz as i32);
            for lx in 0..16usize {
                let wx = wx0 + (lx as i32);
                let biome = if is_uniform_biome { bc0 } else { get_overworld_biome_at(wx, wz, seed) };
                let is_sea_col = biome == B_ABYSS_TRENCH || biome == B_DEEP_OCEAN;
                let ci = (lz << 4) | lx;

                let raw_sea_h = if is_sea_col {
                    Some(get_ocean_floor_true_y(wx, wz, biome, seed))
                } else {
                    None
                };

                if let Some(rsh) = raw_sea_h {
                    if rsh < min_y {
                        *ch_ptr.add(ci) = rsh as i16;
                        *cb_ptr.add(ci) = biome;
                        let w_top_ly = (water_level - min_y).max(0).min(255) as usize;
                        if w_top_ly > max_ly {
                            max_ly = w_top_ly;
                        }
                        let water_id = *bids.add(T_WATER);
                        for ly in 0..=w_top_ly {
                            *data.add((ly << 8) | ci) = water_id;
                        }
                        continue;
                    }
                }

                let h = if let Some(rsh) = raw_sea_h {
                    rsh.min(max_y - 8)
                } else if is_uniform_biome {
                    (get_overworld_raw_height(wx, wz, biome, seed, water_level).floor() as i32)
                        .max(min_y + 4)
                        .min(max_y - 8)
                } else {
                    get_overworld_terrain_height(wx, wz, biome, seed, min_y, max_y, water_level)
                };

                *ch_ptr.add(ci) = h as i16;
                *cb_ptr.add(ci) = biome;
                let top_ly = (h.max(water_level) - min_y).max(0).min(255) as usize;
                if top_ly > max_ly {
                    max_ly = top_ly;
                }

                let can_surface_cave = h >= water_level + 4
                    && !is_wheat_mega_plain(wx, wz)
                    && !matches!(
                        biome,
                        B_PLAINS | B_GREEN_PLAINS | B_SNOWY_PLAINS | B_WHEAT_VALLEY
                            | B_BEACH_PALM | B_TROPICAL_COAST | B_MANGROVE_SWAMP | B_SWAMP
                    )
                    && (wx.abs() > 20 || wz.abs() > 20);

                let is_mountain_bio = matches!(
                    biome,
                    B_CLOUD_PEAKS | B_ALPINE_PEAKS | B_HIGHLAND_PLATEAU | B_SNOW | B_BADLANDS_SPIRES
                );
                let is_badlands_bio = matches!(biome, B_MESA | B_BADLANDS_SPIRES | B_BADLANDS_CRATER);

                for ly in 0..=top_ly {
                    let wy = min_y + (ly as i32);
                    let true_y = wy - d_off;
                    let mut id_slot_or_neg: i32; // >=0 block id, -1 soil/surface

                    if (-1010..=-1001).contains(&true_y) {
                        id_slot_or_neg = *bids.add(T_BEDROCK) as i32;
                    } else if wy < h - 3 || (can_surface_cave && wy <= h) {
                        let c_raw = sample_cave_fast(coarse, lx, ly, lz);
                        let mut c_thresh = if wy >= h - 3 {
                            0.785
                        } else if wy < -16 {
                            0.68
                        } else if wy > 6 {
                            0.74
                        } else {
                            0.755
                        };
                        if wy < -16 && c_raw > 0.65 {
                            let ub = get_underground_biome_id(
                                wx, true_y, wz, seed, ox, oy, oz, b1, b2, s1, min_y, max_y, water_level,
                            );
                            c_thresh = match ub {
                                UB_CRYSTAL_CAVERN => 0.66,
                                UB_LUSH_CAVE => 0.67,
                                UB_MAGMA_CAVERN => 0.68,
                                UB_DRIPSTONE_CAVE => 0.70,
                                _ => 0.68,
                            };
                        }
                        if wy > min_y + 3
                            && (h > water_level + 2 || wy < (h - 5).min(water_level - 8))
                            && c_raw > c_thresh
                        {
                            id_slot_or_neg = if true_y <= -940 {
                                *bids.add(T_LAVA) as i32
                            } else {
                                0
                            };
                        } else if wy < h - 3 {
                            let ore_h = crate::hash3i_f64(wx, wy, wz, seed.wrapping_add(777));
                            if wy <= -16 {
                                id_slot_or_neg = if wy <= -32 && ore_h > 0.9986 {
                                    *bids.add(T_DIAMOND_ORE) as i32
                                } else if wy <= -24 && ore_h > 0.9993 {
                                    *bids.add(T_DIAMOND_ORE) as i32
                                } else if wy <= -28 && ore_h > 0.9978 && ore_h <= 0.9986 {
                                    *bids.add(T_RUBY_ORE) as i32
                                } else if is_mountain_bio && ore_h > 0.9968 && ore_h <= 0.9978 {
                                    *bids.add(T_EMERALD_ORE) as i32
                                } else if ore_h > 0.9950 && ore_h <= 0.9968 {
                                    *bids.add(T_REDSTONE_ORE) as i32
                                } else if ore_h > 0.9946 && ore_h <= 0.9950 {
                                    *bids.add(T_GLOW_CRYSTAL) as i32
                                } else if ore_h > 0.9935 && ore_h <= 0.9946 {
                                    *bids.add(T_GOLD_ORE) as i32
                                } else if ore_h > 0.9917 && ore_h <= 0.9935 {
                                    *bids.add(T_LAPIS_ORE) as i32
                                } else if ore_h > 0.9852 && ore_h <= 0.9917 {
                                    *bids.add(T_IRON_ORE) as i32
                                } else {
                                    *bids.add(T_DEEPSLATE) as i32
                                };
                            } else {
                                id_slot_or_neg = if is_badlands_bio && wy >= h - 18 && h > water_level + 4 {
                                    mesa_strata[(wy & 15) as usize] as i32
                                } else if is_mountain_bio && ore_h > 0.9988 {
                                    *bids.add(T_EMERALD_ORE) as i32
                                } else if (is_badlands_bio && wy <= 24 && ore_h > 0.9945) || (wy <= -6 && ore_h > 0.9974) {
                                    *bids.add(T_GOLD_ORE) as i32
                                } else if wy <= 4 && ore_h > 0.9956 && ore_h <= 0.9974 {
                                    *bids.add(T_LAPIS_ORE) as i32
                                } else if wy <= 2 && ore_h > 0.9942 && ore_h <= 0.9956 {
                                    *bids.add(T_REDSTONE_ORE) as i32
                                } else if (wy <= 18 || is_mountain_bio) && ore_h > 0.9888 && ore_h <= 0.9956 {
                                    *bids.add(T_IRON_ORE) as i32
                                } else if (-8..=24).contains(&wy) && ore_h > 0.9818 && ore_h <= 0.9888 {
                                    *bids.add(T_COPPER_ORE) as i32
                                } else if (-10..=14).contains(&wy) && ore_h > 0.9773 && ore_h <= 0.9818 {
                                    *bids.add(T_TIN_ORE) as i32
                                } else if (-8..=10000).contains(&wy) && ore_h > 0.9678 && ore_h <= 0.9773 {
                                    *bids.add(T_COAL_ORE) as i32
                                } else {
                                    *bids.add(T_STONE) as i32
                                };
                            }
                        } else {
                            id_slot_or_neg = -1;
                        }
                    } else {
                        id_slot_or_neg = -1;
                    }

                    if id_slot_or_neg == -1 {
                        if wy < h {
                            id_slot_or_neg = match biome {
                                B_DESERT | B_BEACH_PALM | B_TROPICAL_COAST => *bids.add(T_SANDSTONE) as i32,
                                B_MESA | B_BADLANDS_SPIRES | B_BADLANDS_CRATER => {
                                    if h <= water_level + 4 && wy >= h - 1 {
                                        *bids.add(T_RED_SAND) as i32
                                    } else {
                                        mesa_strata[(wy & 15) as usize] as i32
                                    }
                                }
                                B_MARSH_RUINS | B_MANGROVE_SWAMP => *bids.add(T_MUD) as i32,
                                B_ALPINE_PEAKS | B_CLOUD_PEAKS | B_MEGA_SNOW_PEAKS if wy >= 14 => {
                                    if (wy & 3) == 0 { *bids.add(T_PACKED_ICE) as i32 } else { *bids.add(T_STONE) as i32 }
                                }
                                B_HIGHLAND_PLATEAU if wy < h - 1 => *bids.add(T_STONE) as i32,
                                B_NIGHTMARE_WOODS => *bids.add(T_DEEPSLATE) as i32,
                                B_SULFUR_SPRINGS => {
                                    if (wy & 3) == 0 { *bids.add(T_CINNABAR_STONE) as i32 } else { *bids.add(T_TRAVERTINE_STONE) as i32 }
                                }
                                _ => *bids.add(T_DIRT) as i32,
                            };
                        } else if wy == h {
                            if h <= water_level {
                                id_slot_or_neg = if biome == B_SULFUR_SPRINGS {
                                    if crate::hash2i_f64(wx, wz, seed.wrapping_add(7823)) > 0.45 {
                                        *bids.add(T_TRAVERTINE_STONE) as i32
                                    } else {
                                        *bids.add(T_SULFUR_BLOCK) as i32
                                    }
                                } else if biome == B_MANGROVE_SWAMP || biome == B_SWAMP {
                                    *bids.add(T_MUD) as i32
                                } else if h <= -26 || biome == B_ABYSS_TRENCH {
                                    if crate::hash2i_f64(wx, wz, seed.wrapping_add(547)) > 0.45 {
                                        *bids.add(T_DEEPSLATE) as i32
                                    } else {
                                        *bids.add(T_BASALT) as i32
                                    }
                                } else if h <= -14 {
                                    if crate::hash2i_f64(wx, wz, seed.wrapping_add(549)) > 0.55 {
                                        *bids.add(T_STONE) as i32
                                    } else {
                                        *bids.add(T_SAND) as i32
                                    }
                                } else {
                                    *bids.add(T_SAND) as i32
                                };
                            } else {
                                id_slot_or_neg = match biome {
                                    B_SULFUR_SPRINGS => {
                                        let rim_n = crate::value_noise_2d((wx as f64) * 0.14, (wz as f64) * 0.14, seed.wrapping_add(7829));
                                        if h == water_level + 1 {
                                            if rim_n > 0.36 { *bids.add(T_TRAVERTINE_STONE) as i32 } else { *bids.add(T_SULFUR_BLOCK) as i32 }
                                        } else if h <= water_level + 4 {
                                            if rim_n > 0.62 { *bids.add(T_THERMAL_CRUST) as i32 }
                                            else if rim_n > 0.25 { *bids.add(T_SULFUR_BLOCK) as i32 }
                                            else { *bids.add(T_TRAVERTINE_STONE) as i32 }
                                        } else if crate::hash2i_f64(wx, wz, seed.wrapping_add(7831)) > 0.96 {
                                            *bids.add(T_SULFUR_ORE) as i32
                                        } else {
                                            let band = (wy + (rim_n * 3.0).floor() as i32).rem_euclid(5);
                                            if band == 0 { *bids.add(T_SULFUR_BLOCK) as i32 }
                                            else if band == 1 { *bids.add(T_THERMAL_CRUST) as i32 }
                                            else if band == 4 { *bids.add(T_TRAVERTINE_STONE) as i32 }
                                            else { *bids.add(T_CINNABAR_STONE) as i32 }
                                        }
                                    }
                                    B_DESERT | B_BEACH_PALM => *bids.add(T_SAND) as i32,
                                    B_MUSHROOM_ISLAND | B_GLOWSHROOM_GROVE => *bids.add(T_MYCELIUM) as i32,
                                    B_VOLCANIC_BASALT => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(527)) > 0.96 {
                                            *bids.add(T_LAVA) as i32
                                        } else {
                                            *bids.add(T_BASALT) as i32
                                        }
                                    }
                                    B_MANGROVE_SWAMP => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(521)) > 0.42 { *bids.add(T_MUD) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_MEGA_SNOW_PEAKS => {
                                        if h >= 62 {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(523)) > 0.72 { *bids.add(T_PACKED_ICE) as i32 } else { *bids.add(T_SNOW) as i32 }
                                        } else if h >= 34 {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(529)) > 0.35 { *bids.add(T_SNOW) as i32 } else { *bids.add(T_STONE) as i32 }
                                        } else {
                                            *bids.add(T_GRASS) as i32
                                        }
                                    }
                                    B_CLOUD_PEAKS => {
                                        if h >= 44 {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(523)) > 0.72 { *bids.add(T_PACKED_ICE) as i32 } else { *bids.add(T_SNOW) as i32 }
                                        } else if h >= 24 {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(529)) > 0.40 { *bids.add(T_STONE) as i32 } else { *bids.add(T_SNOW) as i32 }
                                        } else {
                                            *bids.add(T_GRASS) as i32
                                        }
                                    }
                                    B_ALPINE_PEAKS => {
                                        if h >= 28 && crate::hash2i_f64(wx, wz, seed.wrapping_add(523)) > 0.72 {
                                            *bids.add(T_PACKED_ICE) as i32
                                        } else if h >= 20 {
                                            *bids.add(T_SNOW) as i32
                                        } else {
                                            *bids.add(T_GRASS) as i32
                                        }
                                    }
                                    B_SNOW => *bids.add(T_SNOW) as i32,
                                    B_SNOWY_PLAINS => *bids.add(T_SNOWY_DIRT) as i32,
                                    B_PALE_GARDEN => *bids.add(T_PALE_MOSS) as i32,
                                    B_NIGHTMARE_WOODS => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(531)) > 0.85 { *bids.add(T_SCULK) as i32 } else { *bids.add(T_NIGHTMARE_MOSS) as i32 }
                                    }
                                    B_DARK_FOREST => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(533)) > 0.56 { *bids.add(T_AUTUMN_PODZOL) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_MESA | B_BADLANDS_SPIRES | B_BADLANDS_CRATER => {
                                        if h <= water_level + 4 { *bids.add(T_RED_SAND) as i32 } else { mesa_strata[(wy & 15) as usize] as i32 }
                                    }
                                    B_MARSH_RUINS => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(611)) > 0.42 { *bids.add(T_MUD) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_TROPICAL_COAST => {
                                        if h <= water_level + 2 { *bids.add(T_SAND) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_DAPPLED_FOREST => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(613)) > 0.25 { *bids.add(T_AUTUMN_PODZOL) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_REDWOOD_ANCIENT | B_GIANT_TREES => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(617)) > 0.76 { *bids.add(T_MOSS_BLOCK) as i32 }
                                        else if crate::hash2i_f64(wx, wz, seed.wrapping_add(618)) > 0.65 { *bids.add(T_AUTUMN_PODZOL) as i32 }
                                        else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_MANOR_GARDEN => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(619)) > 0.90 { *bids.add(T_STONE_BRICK) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_AUTUMN | B_AUTUMN_DEEP | B_AUTUMN_GOLDEN => {
                                        if crate::hash2i_f64(wx, wz, seed.wrapping_add(539)) > 0.25 { *bids.add(T_AUTUMN_PODZOL) as i32 } else { *bids.add(T_GRASS) as i32 }
                                    }
                                    B_BLUE_FOREST => {
                                        let trail_n = (crate::fbm_2d((wx as f64) * 0.045, (wz as f64) * 0.045, 2, 0.5, 2.0, seed.wrapping_add(811)) - 0.5).abs();
                                        if trail_n < 0.042 {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(813)) > 0.52 { *bids.add(T_SAND) as i32 }
                                            else if crate::hash2i_f64(wx, wz, seed.wrapping_add(815)) > 0.45 { *bids.add(T_STONE) as i32 }
                                            else { *bids.add(T_AUTUMN_PODZOL) as i32 }
                                        } else {
                                            *bids.add(T_BLUE_GRASS) as i32
                                        }
                                    }
                                    B_WHEAT_VALLEY => {
                                        let in_mega = is_wheat_mega_plain(wx, wz);
                                        let is_hero = in_mega && (wx - 10000).abs() <= 1 && (9970..=10008).contains(&wz);
                                        let w_trail = (crate::fbm_2d((wx as f64) * 0.022, (wz as f64) * 0.022, 2, 0.5, 2.0, seed.wrapping_add(823)) - 0.5).abs() < 0.028;
                                        let is_canal = !is_hero && !w_trail && ((wx & 31) == 15) && ((wz & 7) != 0) && h <= water_level + 3;
                                        if is_hero || w_trail {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(821)) > 0.38 { *bids.add(T_DIRT) as i32 } else { *bids.add(T_STONE_BRICK) as i32 }
                                        } else if is_canal {
                                            *bids.add(T_WATER) as i32
                                        } else {
                                            *bids.add(T_FARMLAND) as i32
                                        }
                                    }
                                    B_PINE_VALLEY => {
                                        let p_trail = (crate::fbm_2d((wx as f64) * 0.042, (wz as f64) * 0.042, 2, 0.5, 2.0, seed.wrapping_add(831)) - 0.5).abs();
                                        if p_trail < 0.042 {
                                            if crate::hash2i_f64(wx, wz, seed.wrapping_add(833)) > 0.50 { *bids.add(T_AUTUMN_PODZOL) as i32 } else { *bids.add(T_GRAVEL) as i32 }
                                        } else if crate::hash2i_f64(wx, wz, seed.wrapping_add(835)) > 0.86 {
                                            *bids.add(T_MUD) as i32
                                        } else {
                                            *bids.add(T_GRASS) as i32
                                        }
                                    }
                                    B_GIANT_JUNGLE => {
                                        if h <= water_level + 1 && crate::hash2i_f64(wx, wz, seed.wrapping_add(841)) > 0.52 {
                                            *bids.add(T_SAND) as i32
                                        } else {
                                            *bids.add(T_GRASS) as i32
                                        }
                                    }
                                    _ => *bids.add(T_GRASS) as i32,
                                };
                            }
                        } else {
                            id_slot_or_neg = 0;
                        }
                    }

                    let mut final_id = if id_slot_or_neg > 0 { id_slot_or_neg as u16 } else { 0 };
                    if wy > h && wy <= water_level {
                        final_id = if wy == water_level
                            && matches!(biome, B_SNOW | B_SNOWY_PLAINS | B_ALPINE_PEAKS | B_CLOUD_PEAKS)
                        {
                            *bids.add(T_ICE)
                        } else {
                            *bids.add(T_WATER)
                        };
                    }
                    *data.add((ly << 8) | ci) = final_id;
                }
            }
        }

        *meta_ptr.add(0) = max_ly as u32;
        *meta_ptr.add(1) = 0;
        *meta_ptr.add(2) = if is_uniform_biome { bc0 as u32 } else { 255 };
        *meta_ptr.add(3) = if is_uniform_biome { 1 } else { 0 };
        max_ly as u32
    }
}
