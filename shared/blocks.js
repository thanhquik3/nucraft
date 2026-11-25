(function (root) {
  'use strict';
  const B = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, OAK_LOG: 4, OAK_LEAVES: 5,
    SAND: 6, PLANKS: 7, SNOW: 8, ICE: 9, SPRUCE_LOG: 10, WATER: 11,
    SPRUCE_LEAVES: 12, SAKURA_LOG: 13, SAKURA_LEAVES: 14, BIRCH_LOG: 15,
    CACTUS: 16, TERRACOTTA: 17, SANDSTONE: 18, GOLD_ORE: 19, FOOD: 20,
    DEEPSLATE: 21, BEDROCK: 22, COAL_ORE: 23, IRON_ORE: 24, DIAMOND_ORE: 25,
    LAVA: 26, APPLE: 27, ACACIA_LOG: 28, ACACIA_LEAVES: 29, BIRCH_LEAVES: 30,
    TORCH_BLOCK: 31, STONE_BRICK: 32, CRAFT_TABLE: 33, STICK: 34,
    WOOD_PICK: 35, STONE_PICK: 36, IRON_PICK: 37, DIAMOND_PICK: 38,
    WOOD_SWORD: 39, STONE_SWORD: 40, IRON_SWORD: 41, DIAMOND_SWORD: 42,
    WOOD_AXE: 43, STONE_AXE: 44, IRON_AXE: 45, DIAMOND_AXE: 46,
    STONE_SHOVEL: 47, GOLD_APPLE: 48,
    TALL_GRASS: 49, FLOWER_RED: 50, FLOWER_YELLOW: 51, SAKURA_PETALS: 52, SEAGRASS: 53,
    GLASS: 54, TNT: 55, FURNACE: 56, GUNPOWDER: 57, VOID_PEARL: 58, MAGMA_CORE: 59,
    BOW: 60, ARROW: 61, IRON_ARMOR: 62, DIAMOND_ARMOR: 63, FIRE_SWORD: 64,
    MUSHROOM_GLOW: 65, LILY_PAD: 66, GLOW_CRYSTAL: 67,
    NETHERRACK: 68, CRIMSON_NYLIUM: 69, WARPED_NYLIUM: 70, CRIMSON_STEM: 71, WARPED_STEM: 72,
    NETHER_WART_BLOCK: 73, WARPED_WART_BLOCK: 74, SHROOMLIGHT: 75, NETHER_BRICK: 76,
    SOUL_SAND: 77, OBSIDIAN: 78, END_STONE: 79, PURPUR_BLOCK: 80, CHORUS_PLANT: 81,
    CRIMSON_ROOTS: 82, WARPED_ROOTS: 83,
    PALM_LOG: 84, PALM_LEAVES: 85, COCONUT: 86,
    MANGROVE_LOG: 87, MANGROVE_ROOTS: 88, MANGROVE_LEAVES: 89, MUD: 90, MUD_BRICK: 91,
    COPPER_ROOF: 92, MARBLE_BRICK: 93, PRISMARINE: 94, SEA_LANTERN: 95,
    CORAL_PINK: 96, CORAL_BLUE: 97, CORAL_GOLD: 98,
    PACKED_ICE: 99, HAY_BALE: 100, SLIME_BLOCK: 101,
    BOOKSHELF: 102, ENCHANT_TABLE: 103, ANVIL: 104, CHEST: 105, BED: 106, CAMPFIRE: 107,
    BUCKET: 108, WATER_BUCKET: 109, LAVA_BUCKET: 110,
    FISHING_ROD: 111, BOAT_ITEM: 112, SPYGLASS: 113,
    RAW_FISH: 114, COOKED_FISH: 115, BREAD: 116, COCONUT_DRINK: 117, WATER_BREATH_POTION: 118,
    IRON_SHOVEL: 119, DIAMOND_SHOVEL: 120,
    LANTERN: 121, SHIELD: 122,
    IRON_HELMET: 123, IRON_LEGS: 124, IRON_BOOTS: 125,
    DIAMOND_HELMET: 126, DIAMOND_LEGS: 127, DIAMOND_BOOTS: 128,
    ASPHALT: 129, ROAD_LINE: 130, CONCRETE: 131, CRACKED_CONCRETE: 132, RUST_STEEL: 133, BROKEN_GLASS: 134, ELEVATOR_BLOCK: 135,
    BAMBOO: 136, MYCELIUM: 137, MUSHROOM_RED_CAP: 138, MUSHROOM_STEM: 139, BASALT: 140,
    FLOWER_LAVENDER: 141, LOTUS: 142, BERRY_BUSH: 143, FERN: 144, VINE: 145,
    COPPER_ORE: 146, TIN_ORE: 147, EMERALD_ORE: 148, RUBY_ORE: 149, TITANIUM_ORE: 150, ANCIENT_DEBRIS: 150,
    COPPER_PICK: 151, RUBY_PICK: 152, NETHERITE_PICK: 153, RUBY_SWORD: 154, NETHERITE_SWORD: 155,
    LEATHER_HELMET: 156, LEATHER_CHEST: 157, LEATHER_LEGS: 158, LEATHER_BOOTS: 159,
    GOLD_HELMET: 160, GOLD_ARMOR: 161, GOLD_LEGS: 162, GOLD_BOOTS: 163,
    RUBY_HELMET: 164, RUBY_CHEST: 165, RUBY_LEGS: 166, RUBY_BOOTS: 167,
    NETHERITE_HELMET: 168, NETHERITE_ARMOR: 169, NETHERITE_LEGS: 170, NETHERITE_BOOTS: 171,
    SUGAR_CANE: 172, BAMBOO_BLOCK: 173, BAMBOO_PLANKS: 174,
    OAK_FENCE: 175, SPRUCE_FENCE: 176, BIRCH_FENCE: 177, SAKURA_FENCE: 178, BAMBOO_FENCE: 179, NETHER_FENCE: 180,
    STONE_WALL: 181, STONE_BRICK_WALL: 182, DEEPSLATE_WALL: 183,
    BED_FOOT: 184, BAMBOO_SHOOT: 185, GLOW_VINES: 186, MOSS_BLOCK: 187,
    CRIMSON_MAPLE_LEAVES: 188, COBWEB: 189, RAIL: 190, END_CRYSTAL_BLOCK: 191,
    WHEAT_SEEDS: 192, WHEAT: 193, WHEAT_0: 194, WHEAT_1: 195, WHEAT_2: 196, WHEAT_3: 197, FARMLAND: 198,
    MELON_BLOCK: 199, MELON_SLICE: 200, PEACH: 201, MANGO: 202, BLUEBERRY: 203,
    AUTUMN_GRASS: 204, AUTUMN_BUSH: 205, AUTUMN_PODZOL: 206,
    IRON_INGOT: 207, GOLD_INGOT: 208, COPPER_INGOT: 209, SMOOTH_STONE: 210, LAPIS_ORE: 211, QUARTZ_ORE: 212,
    RAW_BEEF: 213, COOKED_BEEF: 214,
    BLAST_FURNACE: 215, SMOKER: 216,
    IRON_CHEST: 217, GOLD_CHEST: 218, DIAMOND_CHEST: 219, NETHERITE_CHEST: 220,
    OAK_DOOR: 221, SPRUCE_DOOR: 222, BIRCH_DOOR: 223, BAMBOO_DOOR: 224, IRON_DOOR: 225,
    OAK_TRAPDOOR: 226, SPRUCE_TRAPDOOR: 227, SAKURA_TRAPDOOR: 228, IRON_TRAPDOOR: 229,
    WHITE_WOOL: 230,
    SHEARS: 231, DIAMOND: 232, EMERALD: 233, RUBY: 234, TITANIUM_INGOT: 235, NETHERITE_INGOT: 235, COAL: 236,
    OAK_STAIRS_N: 237, OAK_STAIRS_S: 238, OAK_STAIRS_E: 239, OAK_STAIRS_W: 240,
    STONE_STAIRS_N: 241, STONE_STAIRS_S: 242, STONE_STAIRS_E: 243, STONE_STAIRS_W: 244,
    TERRACOTTA_STAIRS_N: 245, TERRACOTTA_STAIRS_S: 246, TERRACOTTA_STAIRS_E: 247, TERRACOTTA_STAIRS_W: 248,
    DEEPSLATE_STAIRS_N: 249, DEEPSLATE_STAIRS_S: 250, DEEPSLATE_STAIRS_E: 251, DEEPSLATE_STAIRS_W: 252,
    RAW_IRON: 253, RAW_GOLD: 254, RAW_COPPER: 255,
    CHAINMAIL_HELMET: 256, CHAINMAIL_CHEST: 257, CHAINMAIL_LEGS: 258, CHAINMAIL_BOOTS: 259,
    COPPER_HELMET: 260, COPPER_CHEST: 261, COPPER_LEGS: 262, COPPER_BOOTS: 263,
    TURTLE_HELMET: 264,
    ENDER_HELMET: 265, ENDER_CHEST: 266, ENDER_LEGS: 267, ENDER_BOOTS: 268,
    SOLARIS_HELMET: 269, SOLARIS_CHEST: 270, SOLARIS_LEGS: 271, SOLARIS_BOOTS: 272,
    CELESTIAL_HELMET: 273, CELESTIAL_CHEST: 274, CELESTIAL_LEGS: 275, CELESTIAL_BOOTS: 276,
    RAW_PORK: 277, COOKED_PORK: 278,
    RAW_CHICKEN: 279, COOKED_CHICKEN: 280,
    RAW_MUTTON: 281, COOKED_MUTTON: 282,
    RAW_RABBIT: 283, COOKED_RABBIT: 284,
    RAW_SALMON: 285, COOKED_SALMON: 286,
    CARROT: 287, GOLDEN_CARROT: 288,
    POTATO: 289, BAKED_POTATO: 290,
    BEETROOT: 291, SWEET_BERRIES: 292,
    COOKIE: 293, PUMPKIN_PIE: 294,
    CAKE_ITEM: 295, HONEY_BOTTLE: 296,
    GRAVEL: 297, FLINT: 298, FLINT_AND_STEEL: 299,
    NETHER_PORTAL: 300,
    ENDER_PEARL: 301, BLAZE_ROD: 302, BLAZE_POWDER: 303, ENDER_EYE: 304,
    END_PORTAL_FRAME: 305, END_PORTAL_FRAME_EYE: 306, END_PORTAL: 307,
    DREAM_PORTAL_FRAME: 308, DREAM_PORTAL: 309,
    SIFT_GRASS: 310, LULLABY_GRASS: 311, HUSK_SOIL: 312, SPORE_TURF: 313,
    SIFT_STONE: 314, SIFT_LOG: 315, SIFT_LEAVES: 316, LULLABY_LEAVES: 317,
    SIFT_FLOWER: 318, SIFT_BERRY_BUSH: 319, SPORE_SHROOM: 320,
    ICHOR_ORE: 321, AETHERIUM_ORE: 322,
    ICHOR_CRYSTAL: 323, AETHERIUM_INGOT: 324, DREAM_FRUIT: 325, ECHO_SHARD: 326,
    ICHOR_PICK: 327, ICHOR_SWORD: 328, ICHOR_AXE: 329,
    AETHERIUM_PICK: 330, AETHERIUM_SWORD: 331, AETHERIUM_AXE: 332,
    ICHOR_HELMET: 333, ICHOR_CHEST: 334, ICHOR_LEGS: 335, ICHOR_BOOTS: 336,
    AETHERIUM_HELMET: 337, AETHERIUM_CHEST: 338, AETHERIUM_LEGS: 339, AETHERIUM_BOOTS: 340,
    FIRE: 341,
    MOONSTONE_ORE: 342, NEBULA_ORE: 343, DREAM_PRISM_ORE: 344,
    MOONSTONE_GEM: 345, NEBULA_INGOT: 346, DREAM_PRISM_GEM: 347,
    MOONSTONE_PICK: 348, MOONSTONE_SWORD: 349, MOONSTONE_AXE: 350, MOONSTONE_SHOVEL: 351,
    NEBULA_PICK: 352, NEBULA_SWORD: 353, NEBULA_AXE: 354, NEBULA_SHOVEL: 355,
    DREAM_PRISM_PICK: 356, DREAM_PRISM_SWORD: 357, DREAM_PRISM_AXE: 358, DREAM_PRISM_SHOVEL: 359,
    EMERALD_HELMET: 360, EMERALD_CHEST: 361, EMERALD_LEGS: 362, EMERALD_BOOTS: 363,
    AMETHYST_HELMET: 364, AMETHYST_CHEST: 365, AMETHYST_LEGS: 366, AMETHYST_BOOTS: 367,
    OBSIDIAN_HELMET: 368, OBSIDIAN_CHEST: 369, OBSIDIAN_LEGS: 370, OBSIDIAN_BOOTS: 371,
    MOONSTONE_HELMET: 372, MOONSTONE_CHEST: 373, MOONSTONE_LEGS: 374, MOONSTONE_BOOTS: 375,
    NEBULA_HELMET: 376, NEBULA_CHEST: 377, NEBULA_LEGS: 378, NEBULA_BOOTS: 379,
    DREAM_PRISM_HELMET: 380, DREAM_PRISM_CHEST: 381, DREAM_PRISM_LEGS: 382, DREAM_PRISM_BOOTS: 383,
    COPPER_BOX_CHEST: 384, EMERALD_BOX_CHEST: 385, RUBY_BOX_CHEST: 386, DREAM_BOX_CHEST: 387,
    CHARCOAL: 388, NETHERITE_SCRAP: 389, SMITHING_TABLE: 390, NETHERITE_AXE: 391, NETHERITE_SHOVEL: 392,
    TEMPLATE_NETHERITE: 393, TRIM_WARD: 394, TRIM_COAST: 395, TRIM_WILD: 396, TRIM_DUNE: 397, TRIM_TIDE: 398, TRIM_SILENCE: 399,
    NETHERITE_BLOCK: 400, REDSTONE: 401,
    TRIM_SENTRY: 402, TRIM_VEX: 403, TRIM_RIB: 404, TRIM_SNOUT: 405, TRIM_EYE: 406, TRIM_SPIRE: 407,
    TRIM_FLOW: 408, TRIM_BOLT: 409, TRIM_WAYFINDER: 410, TRIM_RAISER: 411, TRIM_SHAPER: 412, TRIM_HOST: 413
  };

  const WOOL_COLORS = [
    { key: 'white',      vi: 'Trắng',        hex: '#f1f5f9', dark: '#cbd5e1', light: '#ffffff', hexInt: 0xf1f5f9, woolKey: 'WHITE_WOOL',      bedKey: 'WHITE_BED',      footKey: 'WHITE_BED_FOOT',      w: 22 },
    { key: 'light_gray', vi: 'Xám Nhạt',     hex: '#9ca3af', dark: '#6b7280', light: '#d1d5db', hexInt: 0x9ca3af, woolKey: 'LIGHT_GRAY_WOOL', bedKey: 'LIGHT_GRAY_BED', footKey: 'LIGHT_GRAY_BED_FOOT', w: 6 },
    { key: 'gray',       vi: 'Xám Đậm',      hex: '#4b5563', dark: '#374151', light: '#6b7280', hexInt: 0x4b5563, woolKey: 'GRAY_WOOL',       bedKey: 'GRAY_BED',       footKey: 'GRAY_BED_FOOT',       w: 5 },
    { key: 'black',      vi: 'Đen',          hex: '#1f2937', dark: '#111827', light: '#374151', hexInt: 0x1f2937, woolKey: 'BLACK_WOOL',      bedKey: 'BLACK_BED',      footKey: 'BLACK_BED_FOOT',      w: 5 },
    { key: 'brown',      vi: 'Nâu',          hex: '#7c4a26', dark: '#543118', light: '#9c6438', hexInt: 0x7c4a26, woolKey: 'BROWN_WOOL',      bedKey: 'BROWN_BED',      footKey: 'BROWN_BED_FOOT',      w: 6 },
    { key: 'red',        vi: 'Đỏ',           hex: '#dc2626', dark: '#991b1b', light: '#f87171', hexInt: 0xdc2626, woolKey: 'RED_WOOL',        bedKey: 'BED',            footKey: 'BED_FOOT',            w: 6 },
    { key: 'orange',     vi: 'Cam',          hex: '#f97316', dark: '#c2410c', light: '#fb923c', hexInt: 0xf97316, woolKey: 'ORANGE_WOOL',     bedKey: 'ORANGE_BED',     footKey: 'ORANGE_BED_FOOT',     w: 6 },
    { key: 'yellow',     vi: 'Vàng',         hex: '#facc15', dark: '#ca8a04', light: '#fef08a', hexInt: 0xfacc15, woolKey: 'YELLOW_WOOL',     bedKey: 'YELLOW_BED',     footKey: 'YELLOW_BED_FOOT',     w: 6 },
    { key: 'lime',       vi: 'Xanh Chanh',   hex: '#84cc16', dark: '#4d7c0f', light: '#bef264', hexInt: 0x84cc16, woolKey: 'LIME_WOOL',       bedKey: 'LIME_BED',       footKey: 'LIME_BED_FOOT',       w: 5 },
    { key: 'green',      vi: 'Xanh Lá',      hex: '#15803d', dark: '#14532d', light: '#22c55e', hexInt: 0x15803d, woolKey: 'GREEN_WOOL',      bedKey: 'GREEN_BED',      footKey: 'GREEN_BED_FOOT',      w: 5 },
    { key: 'cyan',       vi: 'Xanh Lục Lam', hex: '#0891b2', dark: '#155e75', light: '#22d3ee', hexInt: 0x0891b2, woolKey: 'CYAN_WOOL',       bedKey: 'CYAN_BED',       footKey: 'CYAN_BED_FOOT',       w: 5 },
    { key: 'light_blue', vi: 'Xanh Da Trời', hex: '#38bdf8', dark: '#0284c7', light: '#7dd3fc', hexInt: 0x38bdf8, woolKey: 'LIGHT_BLUE_WOOL', bedKey: 'LIGHT_BLUE_BED', footKey: 'LIGHT_BLUE_BED_FOOT', w: 5 },
    { key: 'blue',       vi: 'Xanh Dương',   hex: '#2563eb', dark: '#1e3a8a', light: '#60a5fa', hexInt: 0x2563eb, woolKey: 'BLUE_WOOL',       bedKey: 'BLUE_BED',       footKey: 'BLUE_BED_FOOT',       w: 5 },
    { key: 'purple',     vi: 'Tím',          hex: '#7e22ce', dark: '#581c87', light: '#a855f7', hexInt: 0x7e22ce, woolKey: 'PURPLE_WOOL',     bedKey: 'PURPLE_BED',     footKey: 'PURPLE_BED_FOOT',     w: 5 },
    { key: 'magenta',    vi: 'Hồng Tím',     hex: '#c026d3', dark: '#86198f', light: '#e879f9', hexInt: 0xc026d3, woolKey: 'MAGENTA_WOOL',    bedKey: 'MAGENTA_BED',    footKey: 'MAGENTA_BED_FOOT',    w: 5 },
    { key: 'pink',       vi: 'Hồng',         hex: '#f472b6', dark: '#be185d', light: '#fbcfe8', hexInt: 0xf472b6, woolKey: 'PINK_WOOL',       bedKey: 'PINK_BED',       footKey: 'PINK_BED_FOOT',       w: 6 }
  ];
  const WOOL_COLOR_TOTAL_W = WOOL_COLORS.reduce((s, c) => s + c.w, 0);
  const pickRandomWoolColor = () => {
    let r = Math.random() * WOOL_COLOR_TOTAL_W;
    for (const c of WOOL_COLORS) { r -= c.w; if (r <= 0) return c; }
    return WOOL_COLORS[0];
  };

  let _dynBlockId = 414;
  let _nextWoolTile = 386, _nextBedTopTile = 401, _nextBedSideTile = 416;
  const _DYN_COLORED_ENTRIES = [];
  for (const c of WOOL_COLORS) {
    if (B[c.woolKey] === undefined) {
      const id = _dynBlockId++;
      B[c.woolKey] = id;
      _DYN_COLORED_ENTRIES.push({ kind: 'wool', c, id, tile: _nextWoolTile++ });
    }
    const needHead = (B[c.bedKey] === undefined);
    const needFoot = (B[c.footKey] === undefined);
    if (needHead || needFoot) {
      const headId = needHead ? _dynBlockId++ : B[c.bedKey];
      const footId = needFoot ? _dynBlockId++ : B[c.footKey];
      B[c.bedKey] = headId;
      B[c.footKey] = footId;
      _DYN_COLORED_ENTRIES.push({ kind: 'bed', c, headId, footId, bTopTile: _nextBedTopTile++, bSideTile: _nextBedSideTile++ });
    }
  }

  const SLAB_SPECS = [
    { key: 'OAK_SLAB',           name: 'Phiến Gỗ Sồi',                   baseId: B.PLANKS,        craftId: B.PLANKS,        isWood: true, fuel: 7.5 },
    { key: 'SPRUCE_SLAB',        name: 'Phiến Gỗ Thông',                 baseId: B.SPRUCE_LOG,    craftId: B.SPRUCE_LOG,    isWood: true, fuel: 7.5 },
    { key: 'BIRCH_SLAB',         name: 'Phiến Gỗ Bạch Dương',            baseId: B.BIRCH_LOG,     craftId: B.BIRCH_LOG,     isWood: true, fuel: 7.5 },
    { key: 'SAKURA_SLAB',        name: 'Phiến Gỗ Anh Đào',               baseId: B.SAKURA_LOG,    craftId: B.SAKURA_LOG,    isWood: true, fuel: 7.5 },
    { key: 'ACACIA_SLAB',        name: 'Phiến Gỗ Keo',                   baseId: B.ACACIA_LOG,    craftId: B.ACACIA_LOG,    isWood: true, fuel: 7.5 },
    { key: 'PALM_SLAB',          name: 'Phiến Gỗ Dừa (Rừng Nhiệt Đới)',  baseId: B.PALM_LOG,      craftId: B.PALM_LOG,      isWood: true, fuel: 7.5 },
    { key: 'MANGROVE_SLAB',      name: 'Phiến Gỗ Đước',                  baseId: B.MANGROVE_LOG,  craftId: B.MANGROVE_LOG,  isWood: true, fuel: 7.5 },
    { key: 'BAMBOO_SLAB',        name: 'Phiến Gỗ Tre',                   baseId: B.BAMBOO_PLANKS, craftId: B.BAMBOO_PLANKS, isWood: true, fuel: 7.5 },
    { key: 'CRIMSON_SLAB',       name: 'Phiến Gỗ Đỏ Thẫm (Crimson)',     baseId: B.CRIMSON_STEM,  craftId: B.CRIMSON_STEM,  isWood: true, fuel: 0 },
    { key: 'WARPED_SLAB',        name: 'Phiến Gỗ Cong Vênh (Warped)',    baseId: B.WARPED_STEM,   craftId: B.WARPED_STEM,   isWood: true, fuel: 0 },
    { key: 'SIFT_WOOD_SLAB',     name: 'Phiến Gỗ Giấc Mơ (Sift)',        baseId: B.SIFT_LOG,      craftId: B.SIFT_LOG,      isWood: true, fuel: 7.5 },
    { key: 'PETRIFIED_OAK_SLAB', name: 'Phiến Gỗ Sồi Hóa Đá (Petrified)',baseId: B.PLANKS,        petrified: true, noCraft: true, fuel: 0 },
    { key: 'DIRT_SLAB',          name: 'Phiến Đất',                      baseId: B.DIRT },
    { key: 'GRASS_SLAB',         name: 'Phiến Cỏ Xanh',                  baseId: B.GRASS },
    { key: 'MUD_SLAB',           name: 'Phiến Đất Bùn',                  baseId: B.MUD },
    { key: 'MOSS_SLAB',          name: 'Phiến Rêu Xanh',                 baseId: B.MOSS_BLOCK },
    { key: 'SAND_SLAB',          name: 'Phiến Cát Vàng',                 baseId: B.SAND },
    { key: 'SNOW_SLAB',          name: 'Phiến Tuyết',                    baseId: B.SNOW },
    { key: 'STONE_SLAB',         name: 'Phiến Đá',                       baseId: B.STONE },
    { key: 'SMOOTH_STONE_SLAB',  name: 'Phiến Đá Mịn',                   baseId: B.SMOOTH_STONE },
    { key: 'STONE_BRICK_SLAB',   name: 'Phiến Gạch Đá',                  baseId: B.STONE_BRICK },
    { key: 'DEEPSLATE_SLAB',     name: 'Phiến Đá Phiến Sâu',             baseId: B.DEEPSLATE },
    { key: 'SANDSTONE_SLAB',     name: 'Phiến Đá Sa Thạch',              baseId: B.SANDSTONE },
    { key: 'TERRACOTTA_SLAB',    name: 'Phiến Đất Nung',                 baseId: B.TERRACOTTA },
    { key: 'MUD_BRICK_SLAB',     name: 'Phiến Gạch Bùn',                 baseId: B.MUD_BRICK },
    { key: 'MARBLE_BRICK_SLAB',  name: 'Phiến Đá Cẩm Thạch',             baseId: B.MARBLE_BRICK },
    { key: 'PRISMARINE_SLAB',    name: 'Phiến Đá Lăng Kính',             baseId: B.PRISMARINE },
    { key: 'COPPER_SLAB',        name: 'Phiến Đồng Xanh',                baseId: B.COPPER_ROOF },
    { key: 'BASALT_SLAB',        name: 'Phiến Đá Bazan',                 baseId: B.BASALT },
    { key: 'NETHERRACK_SLAB',    name: 'Phiến Đá Địa Ngục',              baseId: B.NETHERRACK },
    { key: 'NETHER_BRICK_SLAB',  name: 'Phiến Gạch Địa Ngục',            baseId: B.NETHER_BRICK },
    { key: 'END_STONE_SLAB',     name: 'Phiến Đá End',                   baseId: B.END_STONE },
    { key: 'PURPUR_SLAB',        name: 'Phiến Đá Purpur',                baseId: B.PURPUR_BLOCK },
    { key: 'CONCRETE_SLAB',      name: 'Phiến Bê Tông',                  baseId: B.CONCRETE },
    { key: 'ASPHALT_SLAB',       name: 'Phiến Đường Nhựa',               baseId: B.ASPHALT },
    { key: 'OBSIDIAN_SLAB',      name: 'Phiến Hắc Diện Thạch',           baseId: B.OBSIDIAN },
    { key: 'SIFT_STONE_SLAB',    name: 'Phiến Đá Giấc Mơ',               baseId: B.SIFT_STONE },
    { key: 'PACKED_ICE_SLAB',    name: 'Phiến Băng Nén',                 baseId: B.PACKED_ICE }
  ];
  for (const s of SLAB_SPECS) {
    s.botId = _dynBlockId++;
    s.topId = _dynBlockId++;
    B[s.key] = s.botId;
    B[s.key + '_TOP'] = s.topId;
  }

  B.GHAST_TEAR     = _dynBlockId++;
  B.BLUE_ORCHID    = _dynBlockId++;
  B.ALLIUM         = _dynBlockId++;
  B.OXEYE_DAISY    = _dynBlockId++;
  B.CLOVER_PATCH   = _dynBlockId++;
  B.CRIMSON_FUNGUS = _dynBlockId++;
  B.WARPED_FUNGUS  = _dynBlockId++;
  B.SHORT_GRASS    = _dynBlockId++;
  B.BUSH_GRASS     = _dynBlockId++;
  B.WILD_TALL_GRASS= _dynBlockId++;
  B.REDSTONE_ORE   = _dynBlockId++;
  B.AZURE_LOG      = _dynBlockId++;
  B.AZURE_LEAVES   = _dynBlockId++;
  B.COBALT_LEAVES  = _dynBlockId++;
  B.AZURE_PLANKS   = _dynBlockId++;
  B.BLUE_GRASS     = _dynBlockId++;
  B.TEAL_FERN      = _dynBlockId++;
  B.CATTAIL_REED   = _dynBlockId++;
  B.DARK_SLATE_ROOF= _dynBlockId++;
  B.SCULK               = _dynBlockId++;
  B.SCULK_VEIN          = _dynBlockId++;
  B.SCULK_CATALYST      = _dynBlockId++;
  B.SCULK_SENSOR        = _dynBlockId++;
  B.SCULK_SHRIEKER      = _dynBlockId++;
  B.REINFORCED_DEEPSLATE= _dynBlockId++;
  B.DEEPSLATE_BRICKS    = _dynBlockId++;
  B.DEEPSLATE_TILES     = _dynBlockId++;
  B.SOUL_LANTERN        = _dynBlockId++;
  B.SOUL_FIRE           = _dynBlockId++;
  B.CANDLE              = _dynBlockId++;
  B.ENDER_CHEST_BLOCK   = _dynBlockId++;
  B.NOTE_BLOCK          = _dynBlockId++;
  B.NIGHT_VISION_POTION = _dynBlockId++;
  B.TOTEM_UNDYING       = _dynBlockId++;
  B.SWIFT_SNEAK_BOOK    = _dynBlockId++;
  B.DISC_FRAGMENT_5     = _dynBlockId++;
  B.MUSIC_DISC_5        = _dynBlockId++;
  B.MUSIC_DISC_OTHERSIDE= _dynBlockId++;
  B.SNOWBALL            = _dynBlockId++;
  B.VOLCANIC_STONE      = _dynBlockId++;
  B.DRAGON_CRYSTAL_ORE  = _dynBlockId++;
  B.DRAGON_CRYSTAL      = _dynBlockId++;
  B.DRAGON_SCALE        = _dynBlockId++;
  B.DRAGON_BONE         = _dynBlockId++;
  B.DRAGON_SADDLE       = _dynBlockId++;
  B.DRAGON_EGG_FIRE     = _dynBlockId++;
  B.DRAGON_EGG_ICE      = _dynBlockId++;
  B.DRAGON_EGG_WATER    = _dynBlockId++;
  B.DRAGON_EGG_LEAF     = _dynBlockId++;
  B.DRAGON_EGG_TREE     = _dynBlockId++;
  B.DRAGON_HELMET       = _dynBlockId++;
  B.DRAGON_CHEST        = _dynBlockId++;
  B.DRAGON_LEGS         = _dynBlockId++;
  B.DRAGON_BOOTS        = _dynBlockId++;
  B.DRAGON_BONE_SWORD   = _dynBlockId++;
  B.DRAGON_BONE_AXE     = _dynBlockId++;
  B.DRAGON_BONE_PICK    = _dynBlockId++;
  B.DRAGON_BONE_BOW     = _dynBlockId++;
  B.WOOD_HOE            = _dynBlockId++;
  B.STONE_HOE           = _dynBlockId++;
  B.IRON_HOE            = _dynBlockId++;
  B.GOLD_HOE            = _dynBlockId++;
  B.DIAMOND_HOE         = _dynBlockId++;
  B.NETHERITE_HOE       = _dynBlockId++;
  B.END_GATEWAY         = _dynBlockId++;
  B.END_STONE_BRICKS    = _dynBlockId++;
  B.PURPUR_PILLAR       = _dynBlockId++;
  B.END_ROD             = _dynBlockId++;
  B.DRAGON_HEAD         = _dynBlockId++;
  B.ELYTRA              = _dynBlockId++;
  B.ENDER_DRAGON_EGG    = _dynBlockId++;
  B.WINDMILL_HUB        = _dynBlockId++;
  B.RED_SAND            = _dynBlockId++;
  B.TERRACOTTA_WHITE    = _dynBlockId++;
  B.TERRACOTTA_ORANGE   = _dynBlockId++;
  B.TERRACOTTA_YELLOW   = _dynBlockId++;
  B.TERRACOTTA_BROWN    = _dynBlockId++;
  B.TERRACOTTA_RED      = _dynBlockId++;
  B.DEAD_BUSH           = _dynBlockId++;
  B.GOLDEN_MAPLE_LEAVES = _dynBlockId++;
  B.ORANGE_MAPLE_LEAVES = _dynBlockId++;
  B.MANGROVE_PROPAGULE  = _dynBlockId++;

  const exported = {
    B, WOOL_COLORS, WOOL_COLOR_TOTAL_W, pickRandomWoolColor,
    _DYN_COLORED_ENTRIES, SLAB_SPECS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  if (root && typeof root === 'object') {
    root.NUCRAFT_SHARED = Object.assign(root.NUCRAFT_SHARED || {}, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
