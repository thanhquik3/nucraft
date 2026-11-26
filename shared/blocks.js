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
  B.PALE_LOG            = _dynBlockId++;
  B.PALE_PLANKS         = _dynBlockId++;
  B.PALE_LEAVES         = _dynBlockId++;
  B.PALE_MOSS           = _dynBlockId++;
  B.NIGHTMARE_LOG       = _dynBlockId++;
  B.NIGHTMARE_LEAVES    = _dynBlockId++;
  B.NIGHTMARE_MOSS      = _dynBlockId++;
  B.ELYTRA_PHOENIX      = _dynBlockId++;
  B.DRAGON_EGG_EARTH    = _dynBlockId++;
  B.DRAGON_SCALE_FIRE   = _dynBlockId++;
  B.DRAGON_SCALE_ICE    = _dynBlockId++;
  B.DRAGON_SCALE_EARTH  = _dynBlockId++;
  B.DRAGON_SCALE_WATER  = _dynBlockId++;
  B.DRAGON_SCALE_LEAF   = _dynBlockId++;
  B.DRAGON_SCALE_ENDER  = _dynBlockId++;
  B.DRAGON_FIRE_HELMET  = _dynBlockId++;
  B.DRAGON_FIRE_CHEST   = _dynBlockId++;
  B.DRAGON_FIRE_LEGS    = _dynBlockId++;
  B.DRAGON_FIRE_BOOTS   = _dynBlockId++;
  B.DRAGON_ICE_HELMET   = _dynBlockId++;
  B.DRAGON_ICE_CHEST    = _dynBlockId++;
  B.DRAGON_ICE_LEGS     = _dynBlockId++;
  B.DRAGON_ICE_BOOTS    = _dynBlockId++;
  B.DRAGON_EARTH_HELMET = _dynBlockId++;
  B.DRAGON_EARTH_CHEST  = _dynBlockId++;
  B.DRAGON_EARTH_LEGS   = _dynBlockId++;
  B.DRAGON_EARTH_BOOTS  = _dynBlockId++;
  B.DRAGON_WATER_HELMET = _dynBlockId++;
  B.DRAGON_WATER_CHEST  = _dynBlockId++;
  B.DRAGON_WATER_LEGS   = _dynBlockId++;
  B.DRAGON_WATER_BOOTS  = _dynBlockId++;
  B.DRAGON_LEAF_HELMET  = _dynBlockId++;
  B.DRAGON_LEAF_CHEST   = _dynBlockId++;
  B.DRAGON_LEAF_LEGS    = _dynBlockId++;
  B.DRAGON_LEAF_BOOTS   = _dynBlockId++;
  B.DRAGON_ENDER_HELMET = _dynBlockId++;
  B.DRAGON_ENDER_CHEST  = _dynBlockId++;
  B.DRAGON_ENDER_LEGS   = _dynBlockId++;
  B.DRAGON_ENDER_BOOTS  = _dynBlockId++;

  // v129: Warden 5th Dimension Blocks, Tier-6+ Ores, Materials, Mob Drops, Bows, Tools & 3 Armor Sets
  B.SOUL_FLINT_AND_STEEL = _dynBlockId++;
  B.WARDEN_PORTAL        = _dynBlockId++;
  B.WARDEN_SCULK_STONE   = _dynBlockId++;
  B.SCULK_LOG            = _dynBlockId++;
  B.SCULK_PLANKS         = _dynBlockId++;
  B.SCULK_LEAVES         = _dynBlockId++;
  B.UMBRA_ORE            = _dynBlockId++;
  B.RESONANT_ORE         = _dynBlockId++;
  B.SOULFORGED_ORE       = _dynBlockId++;
  B.UMBRA_INGOT          = _dynBlockId++;
  B.SCULK_RESONANT_GEM   = _dynBlockId++;
  B.SOULFORGED_INGOT     = _dynBlockId++;
  B.WARDEN_CHITIN        = _dynBlockId++;
  B.SOUL_RESONATOR       = _dynBlockId++;
  B.SCULK_HEART          = _dynBlockId++;
  B.SCULK_CHITIN_SWORD   = _dynBlockId++;
  B.SCULK_CHITIN_PICK    = _dynBlockId++;
  B.SCULK_CHITIN_AXE     = _dynBlockId++;
  B.SCULK_ECHO_BOW       = _dynBlockId++;
  B.RESONANT_SWORD       = _dynBlockId++;
  B.RESONANT_PICK        = _dynBlockId++;
  B.RESONANT_AXE         = _dynBlockId++;
  B.DEEP_SONIC_BOW       = _dynBlockId++;
  B.SOULFORGED_SWORD     = _dynBlockId++;
  B.SOULFORGED_PICK      = _dynBlockId++;
  B.SOULFORGED_AXE       = _dynBlockId++;
  B.SOUL_HARBINGER_BOW   = _dynBlockId++;
  B.WARDEN_CHITIN_HELMET = _dynBlockId++;
  B.WARDEN_CHITIN_CHEST  = _dynBlockId++;
  B.WARDEN_CHITIN_LEGS   = _dynBlockId++;
  B.WARDEN_CHITIN_BOOTS  = _dynBlockId++;
  B.RESONANT_HELMET      = _dynBlockId++;
  B.RESONANT_CHEST       = _dynBlockId++;
  B.RESONANT_LEGS        = _dynBlockId++;
  B.RESONANT_BOOTS       = _dynBlockId++;
  B.SOULFORGED_HELMET    = _dynBlockId++;
  B.SOULFORGED_CHEST     = _dynBlockId++;
  B.SOULFORGED_LEGS      = _dynBlockId++;
  B.SOULFORGED_BOOTS     = _dynBlockId++;

  // v141: Complete Wood Families, Stripped Logs, Saplings, Jungle/Dark Oak Logs & Bone/Fossil Blocks
  B.JUNGLE_LOG    = _dynBlockId++;
  B.JUNGLE_LEAVES = _dynBlockId++;
  B.DARK_OAK_LOG  = _dynBlockId++;
  B.DARK_OAK_LEAVES = _dynBlockId++;
  B.BONE          = _dynBlockId++;
  B.BONE_MEAL     = _dynBlockId++;
  B.BONE_BLOCK    = _dynBlockId++;

  const BONE_TILES = { bone: 577, meal: 578, blockSide: 579, blockTop: 580 };
  const JUNGLE_LOG_TILES   = { top: 581, side: 582, leaves: 583 };
  const DARK_OAK_LOG_TILES = { top: 584, side: 585, leaves: 586 };

  let _nextTile = 587;
  const _allocPlank = (existing) => existing !== undefined ? existing : _dynBlockId++;
  const _allocStairs4 = (nKey, existingN) => {
    if (existingN !== undefined) return existingN;
    const base = _dynBlockId;
    B[nKey + '_N'] = _dynBlockId++;
    B[nKey + '_S'] = _dynBlockId++;
    B[nKey + '_E'] = _dynBlockId++;
    B[nKey + '_W'] = _dynBlockId++;
    return base;
  };
  const WOOD_FAMILIES = [
    { key: 'oak',       tier: 'oak',       vn: 'Sồi',          en: 'Oak',       log: B.OAK_LOG,       leaves: B.OAK_LEAVES,       planks: B.PLANKS,        stairsKey: 'OAK_STAIRS',       stairsN: B.OAK_STAIRS_N, slabKey: 'OAK_SLAB',       fence: B.OAK_FENCE,     door: B.OAK_DOOR,     trapdoor: B.OAK_TRAPDOOR,     saplingKey: 'OAK_SAPLING',       treeStyle: 'apple',          fuel: 15, mapColor: '#b98952', tPlank: 8,   tDoor: 240, tTrap: 245, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#674c2a', b:'#946e3e', B:'#876335', m:'#ae834c', M:'#a37844', h:'#c49a5d', H:'#d0a86a' }, stripPal: { a:'#b59058', b:'#a17d47', c:'#c5a16a', d:'#846334', core:'#d4b27a', ring:'#94713d' }, doorPal: { frame:0x8d6c3b, panel:0xad884e, dark:0x674c26, hi:0xc29e62, knob:0x525862, win:true,  mode:'open' } },
    { key: 'spruce',    tier: 'spruce',    vn: 'Thông',        en: 'Spruce',    log: B.SPRUCE_LOG,    leaves: B.SPRUCE_LEAVES,    planksKey: 'SPRUCE_PLANKS',    stairsKey: 'SPRUCE_STAIRS',    slabKey: 'SPRUCE_SLAB',    fence: B.SPRUCE_FENCE,  door: B.SPRUCE_DOOR,  trapdoor: B.SPRUCE_TRAPDOOR,  saplingKey: 'SPRUCE_SAPLING',    treeStyle: 'pine',           fuel: 15, mapColor: '#725330', tPlank: _nextTile++, tDoor: 241, tTrap: 246, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#4a3219', b:'#6b4b29', B:'#604223', m:'#7e5932', M:'#73502b', h:'#8e673b', H:'#9c7445' }, stripPal: { a:'#745532', b:'#634728', c:'#85643e', d:'#50371d', core:'#8c6940', ring:'#5b3f22' }, doorPal: { frame:0x4b341b, panel:0x6d4e2d, dark:0x3b2814, hi:0x7e5d38, knob:0xbec5cd, win:false, mode:'spruce' } },
    { key: 'birch',     tier: 'birch',     vn: 'Bạch Dương',   en: 'Birch',     log: B.BIRCH_LOG,     leaves: B.BIRCH_LEAVES,     planksKey: 'BIRCH_PLANKS',     stairsKey: 'BIRCH_STAIRS',     slabKey: 'BIRCH_SLAB',     fence: B.BIRCH_FENCE,   door: B.BIRCH_DOOR,   trapKey: 'BIRCH_TRAPDOOR',   saplingKey: 'BIRCH_SAPLING',     treeStyle: 'sculpted_birch', fuel: 15, mapColor: '#d7cb8d', tPlank: _nextTile++, tDoor: 242, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#9e905e', b:'#c4b67d', B:'#b9aa72', m:'#d7c98f', M:'#cdbf85', h:'#e3d7a0', H:'#ece1ad' }, stripPal: { a:'#c7b881', b:'#b4a56e', c:'#d6c792', d:'#9c8d57', core:'#ded09d', ring:'#a89962' }, doorPal: { frame:0xc5b580, panel:0xddd0a0, dark:0xa6945f, hi:0xebe0b6, knob:0x3f444c, win:false, mode:'birch' } },
    { key: 'jungle',    tier: 'jungle',    vn: 'Rừng Nhiệt Đới',en: 'Jungle',   log: B.JUNGLE_LOG,    leaves: B.JUNGLE_LEAVES,    planksKey: 'JUNGLE_PLANKS',    stairsKey: 'JUNGLE_STAIRS',    slabKey: 'JUNGLE_SLAB',    fenceKey: 'JUNGLE_FENCE',   doorKey: 'JUNGLE_DOOR',   trapKey: 'JUNGLE_TRAPDOOR',   saplingKey: 'JUNGLE_SAPLING',    treeStyle: 'canopy_jungle',  fuel: 15, mapColor: '#a87653', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#6e4931', b:'#9a6a4a', B:'#8e5f41', m:'#b27c58', M:'#a5714e', h:'#c48d67', H:'#d09b75' }, stripPal: { a:'#b3825c', b:'#9c6c48', c:'#c4936c', d:'#815636', core:'#cba078', ring:'#8d613f' }, doorPal: { frame:0x8c5b3b, panel:0xae7652, dark:0x664026, hi:0xc48b66, knob:0x4b4036, win:true,  mode:'jungle' } },
    { key: 'acacia',    tier: 'acacia',    vn: 'Keo',          en: 'Acacia',    log: B.ACACIA_LOG,    leaves: B.ACACIA_LEAVES,    planksKey: 'ACACIA_PLANKS',    stairsKey: 'ACACIA_STAIRS',    slabKey: 'ACACIA_SLAB',    fenceKey: 'ACACIA_FENCE',   doorKey: 'ACACIA_DOOR',   trapKey: 'ACACIA_TRAPDOOR',   saplingKey: 'ACACIA_SAPLING',    treeStyle: 'acacia',         fuel: 15, mapColor: '#b56134', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#6e3214', b:'#9d4c23', B:'#90441e', m:'#b55c2e', M:'#a85327', h:'#c76c3a', H:'#d67a48' }, stripPal: { a:'#b05832', b:'#994826', c:'#c26840', d:'#7c3719', core:'#c96f45', ring:'#883f20' }, doorPal: { frame:0x8e421e, panel:0xb55d30, dark:0x672d12, hi:0xcc7142, knob:0x3f2e25, win:true,  mode:'acacia' } },
    { key: 'dark_oak',  tier: 'dark_oak',  vn: 'Sồi Đen',      en: 'Dark Oak',  log: B.DARK_OAK_LOG,  leaves: B.DARK_OAK_LEAVES,  planksKey: 'DARK_OAK_PLANKS',  stairsKey: 'DARK_OAK_STAIRS',  slabKey: 'DARK_OAK_SLAB',  fenceKey: 'DARK_OAK_FENCE', doorKey: 'DARK_OAK_DOOR', trapKey: 'DARK_OAK_TRAPDOOR', saplingKey: 'DARK_OAK_SAPLING',  treeStyle: 'dark_oak',       fuel: 15, mapColor: '#432b16', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#211308', b:'#372210', B:'#2f1c0c', m:'#462c16', M:'#3e2713', h:'#56381e', H:'#634225' }, stripPal: { a:'#4b331d', b:'#3b2614', c:'#593e25', d:'#2c1b0c', core:'#5e4329', ring:'#352110' }, doorPal: { frame:0x36210f, panel:0x4b2f17, dark:0x221407, hi:0x5e3d21, knob:0xd4af37, win:false, mode:'dark_oak' } },
    { key: 'mangrove',  tier: 'mangrove',  vn: 'Đước Đỏ',      en: 'Mangrove',  log: B.MANGROVE_LOG,  leaves: B.MANGROVE_LEAVES,  planksKey: 'MANGROVE_PLANKS',  stairsKey: 'MANGROVE_STAIRS',  slabKey: 'MANGROVE_SLAB',  fenceKey: 'MANGROVE_FENCE', doorKey: 'MANGROVE_DOOR', trapKey: 'MANGROVE_TRAPDOOR', sapling: B.MANGROVE_PROPAGULE,   treeStyle: 'mangrove',       fuel: 15, mapColor: '#773334', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: 528,        tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#47191b', b:'#6b272a', B:'#5f2124', m:'#7e3437', M:'#732c2f', h:'#914043', H:'#a14c4f' }, stripPal: { a:'#7a3133', b:'#662426', c:'#8b3d3f', d:'#50191b', core:'#8e3f42', ring:'#5e2123' }, doorPal: { frame:0x602426, panel:0x7d3336, dark:0x441618, hi:0x944346, knob:0xb5894b, win:true,  mode:'mangrove' } },
    { key: 'sakura',    tier: 'sakura',    vn: 'Hoa Anh Đào',  en: 'Cherry',    log: B.SAKURA_LOG,    leaves: B.SAKURA_LEAVES,    planksKey: 'SAKURA_PLANKS',    stairsKey: 'SAKURA_STAIRS',    slabKey: 'SAKURA_SLAB',    fence: B.SAKURA_FENCE,  doorKey: 'SAKURA_DOOR',   trapdoor: B.SAKURA_TRAPDOOR,  saplingKey: 'SAKURA_SAPLING',    treeStyle: 'sakura',         fuel: 15, mapColor: '#ebb1c2', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: 247, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#b87c8d', b:'#dc9fb1', B:'#d393a6', m:'#eab2c2', M:'#e2a7b8', h:'#f4c4d2', H:'#fad5e0' }, stripPal: { a:'#d896a9', b:'#c48094', c:'#e7a9bb', d:'#a6677a', core:'#efc4d2', ring:'#b87689' }, doorPal: { frame:0xd48ca1, panel:0xf1b9c9, dark:0xb06d82, hi:0xfbd3df, knob:0x8a485c, win:true,  mode:'sakura' } },
    { key: 'bamboo',    tier: 'bamboo',    vn: 'Tre Vàng',     en: 'Bamboo',    log: B.BAMBOO_BLOCK,  leaves: null,               planks: B.BAMBOO_PLANKS, stairsKey: 'BAMBOO_STAIRS',    slabKey: 'BAMBOO_SLAB',    fence: B.BAMBOO_FENCE,  door: B.BAMBOO_DOOR,  trapKey: 'BAMBOO_TRAPDOOR',  sapling: B.BAMBOO_SHOOT,         treeStyle: 'bamboo',         fuel: 15, mapColor: '#cbb653', tPlank: 191, tDoor: 243, tTrap: _nextTile++, tSapling: 192,        tStripTop: _nextTile++, tStripSide: _nextTile++, plankQty: 2, plankPal: { d:'#877428', b:'#b39d3d', B:'#a69135', m:'#cab64e', M:'#beaa46', h:'#dcc860', H:'#e8d672' }, stripPal: { a:'#cbb64a', b:'#b5a03b', c:'#dbc659', d:'#927f2a', core:'#e3cf6c', ring:'#9e8b32' }, doorPal: { frame:0xa68c32, panel:0xdbc35c, dark:0x7e681f, hi:0xe9d678, knob:0x4a3d14, win:true,  mode:'bamboo' } },
    { key: 'crimson',   tier: 'crimson',   vn: 'Nấm Đỏ Thẫm',  en: 'Crimson',   log: B.CRIMSON_STEM,  leaves: B.NETHER_WART_BLOCK,planksKey: 'CRIMSON_PLANKS',   stairsKey: 'CRIMSON_STAIRS',   slabKey: 'CRIMSON_SLAB',   fenceKey: 'CRIMSON_FENCE',  doorKey: 'CRIMSON_DOOR',  trapKey: 'CRIMSON_TRAPDOOR',  sapling: B.CRIMSON_FUNGUS,       treeStyle: 'crimson_fungus', fuel: 0,  mapColor: '#6d314b', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: 436,        tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#45182c', b:'#632742', B:'#59213a', m:'#773352', M:'#6d2c4a', h:'#8a4061', H:'#994c6f' }, stripPal: { a:'#7d3153', b:'#692544', c:'#8e3d62', d:'#521a33', core:'#9a486d', ring:'#5e213c' }, doorPal: { frame:0x572139, panel:0x753150, dark:0x3f1528, hi:0x8a4061, knob:0x4a382c, win:false, mode:'slat_h' } },
    { key: 'warped',    tier: 'warped',    vn: 'Nấm Biến Dị',  en: 'Warped',    log: B.WARPED_STEM,   leaves: B.WARPED_WART_BLOCK,planksKey: 'WARPED_PLANKS',    stairsKey: 'WARPED_STAIRS',    slabKey: 'WARPED_SLAB',    fenceKey: 'WARPED_FENCE',   doorKey: 'WARPED_DOOR',   trapKey: 'WARPED_TRAPDOOR',   sapling: B.WARPED_FUNGUS,        treeStyle: 'warped_fungus',  fuel: 0,  mapColor: '#2a6f73', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: 437,        tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#144346', b:'#226165', B:'#1c575b', m:'#2d787b', M:'#266d71', h:'#398c8f', H:'#459fa2' }, stripPal: { a:'#317f82', b:'#256a6d', c:'#3d9295', d:'#194f52', core:'#479ea1', ring:'#1e5a5d' }, doorPal: { frame:0x1b5357, panel:0x2b7478, dark:0x113a3d, hi:0x398c8f, knob:0x2c4244, win:false, mode:'slat_h' } },
    { key: 'pale',      tier: 'pale',      vn: 'Sồi Nhợt',     en: 'Pale Oak',  log: B.PALE_LOG,      leaves: B.PALE_LEAVES,      planks: B.PALE_PLANKS,   stairsKey: 'PALE_STAIRS',      slabKey: 'PALE_SLAB',      fenceKey: 'PALE_FENCE',     doorKey: 'PALE_DOOR',     trapKey: 'PALE_TRAPDOOR',     saplingKey: 'PALE_SAPLING',      treeStyle: 'pale_oak',       fuel: 15, mapColor: '#d4d5db', tPlank: 531, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, stripPal: { a:'#d1d3d8', b:'#bec1c7', c:'#e2e4e8', d:'#9ea2aa', core:'#e7e9ed', ring:'#a9adb4' }, doorPal: { frame:0xb0b3ba, panel:0xd4d6dc, dark:0x8a8e96, hi:0xe8eaef, knob:0x4b5563, win:true,  mode:'open' } },
    { key: 'palm',      tier: 'palm',      vn: 'Dừa Nhiệt Đới',en: 'Palm',      log: B.PALM_LOG,      leaves: B.PALM_LEAVES,      planksKey: 'PALM_PLANKS',      stairsKey: 'PALM_STAIRS',      slabKey: 'PALM_SLAB',      fenceKey: 'PALM_FENCE',     doorKey: 'PALM_DOOR',     trapKey: 'PALM_TRAPDOOR',     saplingKey: 'PALM_SAPLING',      treeStyle: 'palm',           fuel: 15, mapColor: '#c99c5f', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#825c30', b:'#b08249', B:'#a3763f', m:'#c7985a', M:'#ba8d50', h:'#d6aa6b', H:'#e2ba7c' }, stripPal: { a:'#c7995d', b:'#b08349', c:'#d7aa6e', d:'#8d6535', core:'#deb67d', ring:'#9b723f' }, doorPal: { frame:0x9c6e38, panel:0xc7985a, dark:0x734e23, hi:0xd9ad6e, knob:0x4a351e, win:true,  mode:'acacia' } },
    { key: 'azure',     tier: 'azure',     vn: 'Xanh Lam',     en: 'Azure',     log: B.AZURE_LOG,     leaves: B.AZURE_LEAVES,     planks: B.AZURE_PLANKS,  stairsKey: 'AZURE_STAIRS',     slabKey: 'AZURE_SLAB',     fenceKey: 'AZURE_FENCE',    doorKey: 'AZURE_DOOR',    trapKey: 'AZURE_TRAPDOOR',    saplingKey: 'AZURE_SAPLING',     treeStyle: 'azure_tree',     fuel: 15, mapColor: '#4c7fb8', tPlank: 452, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, stripPal: { a:'#5c8ec4', b:'#4b78ab', c:'#6fa2d8', d:'#385c87', core:'#86b8eb', ring:'#3f6996' }, doorPal: { frame:0x3c5e88, panel:0x527bb0, dark:0x2b4466, hi:0x7aa9e0, knob:0xdbeafe, win:true,  mode:'open' } },
    { key: 'sift',      tier: 'sift',      vn: 'Giấc Mơ Sift', en: 'Sift',      log: B.SIFT_LOG,      leaves: B.SIFT_LEAVES,      planksKey: 'SIFT_PLANKS',      stairsKey: 'SIFT_STAIRS',      slabKey: 'SIFT_WOOD_SLAB', fenceKey: 'SIFT_FENCE',     doorKey: 'SIFT_DOOR',     trapKey: 'SIFT_TRAPDOOR',     saplingKey: 'SIFT_SAPLING',      treeStyle: 'sift_giant',     fuel: 15, mapColor: '#4fa39b', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#275c58', b:'#3b807a', B:'#33726d', m:'#4d9992', M:'#448b84', h:'#60b0a8', H:'#74c4bc' }, stripPal: { a:'#5da69f', b:'#498c86', c:'#74bdb6', d:'#336b66', core:'#8ad4cd', ring:'#3c7a74' }, doorPal: { frame:0x367570, panel:0x4e9c95, dark:0x24524e, hi:0x72c2ba, knob:0xa7f3d0, win:true,  mode:'sakura' } },
    { key: 'nightmare', tier: 'nightmare', vn: 'Ác Mộng',      en: 'Nightmare', log: B.NIGHTMARE_LOG, leaves: B.NIGHTMARE_LEAVES, planksKey: 'NIGHTMARE_PLANKS', stairsKey: 'NIGHTMARE_STAIRS', slabKey: 'NIGHTMARE_SLAB', fenceKey: 'NIGHTMARE_FENCE',doorKey: 'NIGHTMARE_DOOR',trapKey: 'NIGHTMARE_TRAPDOOR',saplingKey: 'NIGHTMARE_SAPLING', treeStyle: 'nightmare_tree', fuel: 0,  mapColor: '#56213c', tPlank: _nextTile++, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, plankPal: { d:'#260c1b', b:'#42172f', B:'#381227', m:'#54203d', M:'#491b35', h:'#692a4d', H:'#7a345c' }, stripPal: { a:'#5c2443', b:'#491a34', c:'#6e2e52', d:'#330f23', core:'#7a375d', ring:'#3e152c' }, doorPal: { frame:0x3d142a, panel:0x592240, dark:0x260a19, hi:0x753156, knob:0xf43f5e, win:false, mode:'dark_oak' } },
    { key: 'sculk',     tier: 'sculk',     vn: 'Sculk Cổ Đại', en: 'Sculk',     log: B.SCULK_LOG,     leaves: B.SCULK_LEAVES,     planks: B.SCULK_PLANKS,  stairsKey: 'SCULK_STAIRS',     slabKey: 'SCULK_SLAB',     fenceKey: 'SCULK_FENCE',    doorKey: 'SCULK_DOOR',    trapKey: 'SCULK_TRAPDOOR',    saplingKey: 'SCULK_SAPLING',     treeStyle: 'sculk_tree',     fuel: 0,  mapColor: '#1a4250', tPlank: 550, tDoor: _nextTile++, tTrap: _nextTile++, tSapling: _nextTile++, tStripTop: _nextTile++, tStripSide: _nextTile++, stripPal: { a:'#164d5e', b:'#103a47', c:'#1e6275', d:'#0a2730', core:'#22d3ee', ring:'#0e4554' }, doorPal: { frame:0x0e3442, panel:0x155166, dark:0x09202b, hi:0x227c99, knob:0x22d3ee, win:true,  mode:'slat_h' } }
  ];

  for (const wf of WOOD_FAMILIES) {
    const uKey = wf.key.toUpperCase();
    wf.planks = _allocPlank(wf.planks);
    if (wf.planksKey) B[wf.planksKey] = wf.planks;
    wf.stripped = _dynBlockId++;
    B['STRIPPED_' + (wf.key === 'bamboo' ? 'BAMBOO_BLOCK' : ((wf.key === 'crimson' || wf.key === 'warped') ? uKey + '_STEM' : uKey + '_LOG'))] = wf.stripped;
    wf.stairsN = _allocStairs4(wf.stairsKey, wf.stairsN);
    if (wf.fence === undefined) { wf.fence = _dynBlockId++; B[wf.fenceKey] = wf.fence; }
    if (wf.door === undefined) { wf.door = _dynBlockId++; B[wf.doorKey] = wf.door; }
    if (wf.trapdoor === undefined) { wf.trapdoor = _dynBlockId++; B[wf.trapKey] = wf.trapdoor; }
    if (wf.sapling === undefined) { wf.sapling = _dynBlockId++; B[wf.saplingKey] = wf.sapling; }

    let slab = SLAB_SPECS.find(s => s.key === wf.slabKey);
    if (slab) {
      slab.baseId = wf.planks;
      slab.craftId = wf.planks;
      slab.fuel = wf.fuel > 0 ? 7.5 : 0;
    } else {
      slab = { key: wf.slabKey, name: 'Phiến Gỗ ' + wf.vn, baseId: wf.planks, craftId: wf.planks, isWood: true, fuel: wf.fuel > 0 ? 7.5 : 0 };
      slab.botId = _dynBlockId++;
      slab.topId = _dynBlockId++;
      B[slab.key] = slab.botId;
      B[slab.key + '_TOP'] = slab.topId;
      SLAB_SPECS.push(slab);
    }
    wf.slabBot = slab.botId;
    wf.slabTop = slab.topId;
  }

  const exported = {
    B, WOOL_COLORS, WOOL_COLOR_TOTAL_W, pickRandomWoolColor,
    _DYN_COLORED_ENTRIES, SLAB_SPECS, WOOD_FAMILIES,
    BONE_TILES, JUNGLE_LOG_TILES, DARK_OAK_LOG_TILES, WOOD_NEXT_TILE: _nextTile
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  if (root && typeof root === 'object') {
    root.NUCRAFT_SHARED = Object.assign(root.NUCRAFT_SHARED || {}, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
