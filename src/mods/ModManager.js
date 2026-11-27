// NUCRAFT Module: src/mods/ModManager.js — IndexedDB Mod & Minecraft Add-on (.mcpack/.mcaddon/.zip/.json/.js) Loader

  const MOD_DB_NAME = 'nucraft_mods_db_v1';
  const MOD_STORE = 'packs';
  const MAX_MOD_BYTES = 64 * 1024 * 1024;
  let _modDbPromise = null;
  let _installedMods = [];
  let _baseAtlasBackup = null;
  let _baseBlockDefsBackup = null;
  let _baseMobStatsBackup = null;
  let _baseSmeltBackup = null;
  const _baseSoundBackup = new Map();
  const _modSoundEntries = new Map(); // sfxKey -> Array<{ bytes: Uint8Array, buf: AudioBuffer|null, decoding: boolean }>
  const _modCommands = new Map();
  const _modTickHandlers = [];

  const MC_ID_TO_B = {
    air: 0, stone: B.STONE, cobblestone: B.STONE, granite: B.STONE, andesite: B.STONE, diorite: B.STONE,
    deepslate: B.DEEPSLATE, cobbled_deepslate: B.DEEPSLATE, grass: B.GRASS, grass_block: B.GRASS,
    dirt: B.DIRT, coarse_dirt: B.DIRT, farmland: B.FARMLAND, podzol: B.AUTUMN_PODZOL, mycelium: B.MYCELIUM,
    moss_block: B.MOSS_BLOCK, gravel: B.GRAVEL, clay: B.TERRACOTTA,
    oak_planks: B.PLANKS, planks: B.PLANKS, spruce_planks: B.SPRUCE_PLANKS || B.PLANKS, birch_planks: B.BIRCH_PLANKS || B.PLANKS,
    jungle_planks: B.JUNGLE_PLANKS || B.PLANKS, dark_oak_planks: B.DARK_OAK_PLANKS || B.PLANKS,
    cherry_planks: B.SAKURA_PLANKS || B.PLANKS, bamboo_planks: B.BAMBOO_PLANKS || B.PLANKS,
    oak_log: B.OAK_LOG, log: B.OAK_LOG, spruce_log: B.SPRUCE_LOG, birch_log: B.BIRCH_LOG,
    jungle_log: B.JUNGLE_LOG || B.OAK_LOG, dark_oak_log: B.DARK_OAK_LOG || B.SPRUCE_LOG, cherry_log: B.SAKURA_LOG,
    oak_leaves: B.OAK_LEAVES, leaves: B.OAK_LEAVES, spruce_leaves: B.SPRUCE_LEAVES, birch_leaves: B.BIRCH_LEAVES,
    cherry_leaves: B.SAKURA_LEAVES, snow: B.SNOW, snow_block: B.SNOW, ice: B.ICE, packed_ice: B.PACKED_ICE,
    sand: B.SAND, red_sand: B.RED_SAND || B.SAND, sandstone: B.SANDSTONE, glass: B.GLASS, obsidian: B.OBSIDIAN,
    terracotta: B.TERRACOTTA, netherrack: B.NETHERRACK, end_stone: B.END_STONE, bedrock: B.BEDROCK,
    stone_bricks: B.STONE_BRICK, bricks: B.STONE_BRICK, brick_block: B.STONE_BRICK,
    magma: B.MAGMA_BLOCK, magma_block: B.MAGMA_BLOCK, prismarine: B.PRISMARINE, purpur_block: B.PURPUR_BLOCK,
    coal_ore: B.COAL_ORE, iron_ore: B.IRON_ORE, gold_ore: B.GOLD_ORE, copper_ore: B.COPPER_ORE,
    diamond_ore: B.DIAMOND_ORE, emerald_ore: B.EMERALD_ORE, lapis_ore: B.LAPIS_ORE, redstone_ore: B.REDSTONE_ORE,
    nether_quartz_ore: B.QUARTZ_ORE, ancient_debris: B.ANCIENT_DEBRIS,
    diamond_block: B.DIAMOND_BLOCK || B.DIAMOND, iron_block: B.IRON_BLOCK || B.IRON_INGOT,
    gold_block: B.GOLD_BLOCK || B.GOLD_INGOT, emerald_block: B.EMERALD_BLOCK || B.EMERALD,
    white_wool: B.WOOL_WHITE, red_wool: B.WOOL_RED, blue_wool: B.WOOL_BLUE, green_wool: B.WOOL_GREEN,
    yellow_wool: B.WOOL_YELLOW, black_wool: B.WOOL_BLACK, wool: B.WOOL_WHITE,
    stick: B.STICK, coal: B.COAL, charcoal: B.CHARCOAL, iron_ingot: B.IRON_INGOT, gold_ingot: B.GOLD_INGOT,
    copper_ingot: B.COPPER_INGOT, diamond: B.DIAMOND, emerald: B.EMERALD, lapis_lazuli: B.LAPIS || B.DIAMOND,
    redstone: B.REDSTONE, flint: B.FLINT, quartz: B.QUARTZ || B.DIAMOND, netherite_ingot: B.NETHERITE_INGOT,
    netherite_scrap: B.NETHERITE_SCRAP, raw_iron: B.RAW_IRON, raw_gold: B.RAW_GOLD, raw_copper: B.RAW_COPPER,
    gunpowder: B.GUNPOWDER, sugar: B.WHEAT, wheat: B.WHEAT, wheat_seeds: B.WHEAT_SEEDS, bread: B.BREAD,
    apple: B.APPLE, golden_apple: B.GOLD_APPLE, hay_block: B.HAY_BALE, cookie: B.COOKIE,
    carrot: B.CARROT, golden_carrot: B.GOLDEN_CARROT, potato: B.POTATO, baked_potato: B.BAKED_POTATO,
    beetroot: B.BEETROOT, sweet_berries: B.SWEET_BERRIES, melon_slice: B.MELON_SLICE, melon_block: B.MELON_BLOCK,
    pumpkin: B.PUMPKIN || B.MELON_BLOCK, pumpkin_pie: B.PUMPKIN_PIE, cake: B.CAKE_ITEM,
    cooked_beef: B.COOKED_BEEF, beef: B.RAW_BEEF, porkchop: B.RAW_PORK, cooked_porkchop: B.COOKED_PORK,
    chicken: B.RAW_CHICKEN || B.RAW_BEEF, cooked_chicken: B.COOKED_CHICKEN || B.COOKED_BEEF,
    torch: B.TORCH_BLOCK, lantern: B.LANTERN, soul_lantern: B.SOUL_LANTERN, campfire: B.CAMPFIRE,
    crafting_table: B.CRAFT_TABLE, furnace: B.FURNACE, chest: B.CHEST, tnt: B.TNT, bookshelf: B.BOOKSHELF,
    anvil: B.ANVIL, enchanting_table: B.ENCHANT_TABLE, ladder: B.LADDER,
    oak_fence: B.OAK_FENCE, cobblestone_wall: B.STONE_WALL, oak_door: B.OAK_DOOR, sugar_cane: B.SUGAR_CANE,
    wooden_pickaxe: B.WOOD_PICK, stone_pickaxe: B.STONE_PICK, iron_pickaxe: B.IRON_PICK, golden_pickaxe: B.GOLD_PICK, diamond_pickaxe: B.DIAMOND_PICK, netherite_pickaxe: B.NETHERITE_PICK,
    wooden_sword: B.WOOD_SWORD, stone_sword: B.STONE_SWORD, iron_sword: B.IRON_SWORD, golden_sword: B.GOLD_SWORD, diamond_sword: B.DIAMOND_SWORD, netherite_sword: B.NETHERITE_SWORD,
    wooden_axe: B.WOOD_AXE, stone_axe: B.STONE_AXE, iron_axe: B.IRON_AXE, golden_axe: B.GOLD_AXE, diamond_axe: B.DIAMOND_AXE, netherite_axe: B.NETHERITE_AXE,
    wooden_shovel: B.WOOD_SHOVEL, stone_shovel: B.STONE_SHOVEL, iron_shovel: B.IRON_SHOVEL, golden_shovel: B.GOLD_SHOVEL, diamond_shovel: B.DIAMOND_SHOVEL, netherite_shovel: B.NETHERITE_SHOVEL,
    wooden_hoe: B.WOOD_HOE, stone_hoe: B.STONE_HOE, iron_hoe: B.IRON_HOE, golden_hoe: B.GOLD_HOE, diamond_hoe: B.DIAMOND_HOE, netherite_hoe: B.NETHERITE_HOE,
    shears: B.SHEARS, bow: B.BOW, arrow: B.ARROW, shield: B.SHIELD, fishing_rod: B.FISHING_ROD,
    bucket: B.BUCKET, water_bucket: B.WATER_BUCKET, lava_bucket: B.LAVA_BUCKET, flint_and_steel: B.FLINT_STEEL,
    ender_pearl: B.ENDER_PEARL, blaze_rod: B.BLAZE_ROD, blaze_powder: B.BLAZE_POWDER, ender_eye: B.ENDER_EYE,
    totem_of_undying: B.TOTEM_UNDYING, water: B.WATER, lava: B.LAVA
  };

  // Minecraft Java & Bedrock texture stems -> NUCRAFT { key: B-symbol, role: 'all'|'top'|'side'|'bot'|'front'|'item' }
  const TEX_ALIAS_TO_B = {
    grass_top: { k: 'GRASS', r: 'top', mt: 'grass_block_top' },
    grass_block_top: { k: 'GRASS', r: 'top', mt: 'grass_block_top' },
    grass_carried: { k: 'GRASS', r: 'top', mt: 'grass_block_top' },
    grass_side: { k: 'GRASS', r: 'side', mt: 'grass_block_side' },
    grass_block_side: { k: 'GRASS', r: 'side', mt: 'grass_block_side' },
    grass_side_carried: { k: 'GRASS', r: 'side', mt: 'grass_block_side' },
    dirt: { k: 'DIRT', r: 'all' }, stone: { k: 'STONE', r: 'all' }, cobblestone: { k: 'STONE', r: 'all' },
    bedrock: { k: 'BEDROCK', r: 'all' }, sand: { k: 'SAND', r: 'all' }, red_sand: { k: 'RED_SAND', r: 'all' },
    gravel: { k: 'GRAVEL', r: 'all' }, glass: { k: 'GLASS', r: 'all' }, obsidian: { k: 'OBSIDIAN', r: 'all' },
    netherrack: { k: 'NETHERRACK', r: 'all' }, end_stone: { k: 'END_STONE', r: 'all' },
    deepslate: { k: 'DEEPSLATE', r: 'all' }, deepslate_top: { k: 'DEEPSLATE', r: 'top' },
    snow: { k: 'SNOW', r: 'all' }, ice: { k: 'ICE', r: 'all' }, packed_ice: { k: 'PACKED_ICE', r: 'all' },
    moss_block: { k: 'MOSS_BLOCK', r: 'all' }, mycelium_top: { k: 'MYCELIUM', r: 'top' }, mycelium_side: { k: 'MYCELIUM', r: 'side' },
    podzol_top: { k: 'AUTUMN_PODZOL', r: 'top' }, podzol_side: { k: 'AUTUMN_PODZOL', r: 'side' },
    hardened_clay: { k: 'TERRACOTTA', r: 'all' }, terracotta: { k: 'TERRACOTTA', r: 'all' },
    sandstone_normal: { k: 'SANDSTONE', r: 'all' }, sandstone_top: { k: 'SANDSTONE', r: 'top' }, sandstone: { k: 'SANDSTONE', r: 'side' }, sandstone_bottom: { k: 'SANDSTONE', r: 'bot' },
    planks_oak: { k: 'PLANKS', r: 'all' }, oak_planks: { k: 'PLANKS', r: 'all' },
    planks_spruce: { k: 'SPRUCE_PLANKS', r: 'all' }, spruce_planks: { k: 'SPRUCE_PLANKS', r: 'all' },
    planks_birch: { k: 'BIRCH_PLANKS', r: 'all' }, birch_planks: { k: 'BIRCH_PLANKS', r: 'all' },
    planks_jungle: { k: 'JUNGLE_PLANKS', r: 'all' }, jungle_planks: { k: 'JUNGLE_PLANKS', r: 'all' },
    planks_big_oak: { k: 'DARK_OAK_PLANKS', r: 'all' }, dark_oak_planks: { k: 'DARK_OAK_PLANKS', r: 'all' },
    log_oak_top: { k: 'OAK_LOG', r: 'top' }, oak_log_top: { k: 'OAK_LOG', r: 'top' },
    log_oak: { k: 'OAK_LOG', r: 'side' }, oak_log: { k: 'OAK_LOG', r: 'side' },
    log_spruce_top: { k: 'SPRUCE_LOG', r: 'top' }, spruce_log_top: { k: 'SPRUCE_LOG', r: 'top' },
    log_spruce: { k: 'SPRUCE_LOG', r: 'side' }, spruce_log: { k: 'SPRUCE_LOG', r: 'side' },
    log_birch_top: { k: 'BIRCH_LOG', r: 'top' }, birch_log_top: { k: 'BIRCH_LOG', r: 'top' },
    log_birch: { k: 'BIRCH_LOG', r: 'side' }, birch_log: { k: 'BIRCH_LOG', r: 'side' },
    cherry_log_top: { k: 'SAKURA_LOG', r: 'top' }, cherry_log: { k: 'SAKURA_LOG', r: 'side' },
    leaves_oak: { k: 'OAK_LEAVES', r: 'all' }, oak_leaves: { k: 'OAK_LEAVES', r: 'all' }, leaves_oak_carried: { k: 'OAK_LEAVES', r: 'all' },
    leaves_spruce: { k: 'SPRUCE_LEAVES', r: 'all' }, spruce_leaves: { k: 'SPRUCE_LEAVES', r: 'all' },
    leaves_birch: { k: 'BIRCH_LEAVES', r: 'all' }, birch_leaves: { k: 'BIRCH_LEAVES', r: 'all' },
    cherry_leaves: { k: 'SAKURA_LEAVES', r: 'all' }, sakura_leaves: { k: 'SAKURA_LEAVES', r: 'all' },
    coal_ore: { k: 'COAL_ORE', r: 'all' }, iron_ore: { k: 'IRON_ORE', r: 'all' }, gold_ore: { k: 'GOLD_ORE', r: 'all' },
    copper_ore: { k: 'COPPER_ORE', r: 'all' }, diamond_ore: { k: 'DIAMOND_ORE', r: 'all' },
    emerald_ore: { k: 'EMERALD_ORE', r: 'all' }, lapis_ore: { k: 'LAPIS_ORE', r: 'all' }, redstone_ore: { k: 'REDSTONE_ORE', r: 'all' },
    tnt_top: { k: 'TNT', r: 'top' }, tnt_side: { k: 'TNT', r: 'side' }, tnt_bottom: { k: 'TNT', r: 'bot' },
    crafting_table_top: { k: 'CRAFT_TABLE', r: 'top' }, crafting_table_side: { k: 'CRAFT_TABLE', r: 'side' }, crafting_table_front: { k: 'CRAFT_TABLE', r: 'front' },
    furnace_top: { k: 'FURNACE', r: 'top' }, furnace_side: { k: 'FURNACE', r: 'side' }, furnace_front_off: { k: 'FURNACE', r: 'front' }, furnace_front: { k: 'FURNACE', r: 'front' },
    bookshelf: { k: 'BOOKSHELF', r: 'side' }, stonebrick: { k: 'STONE_BRICK', r: 'all' }, stone_bricks: { k: 'STONE_BRICK', r: 'all' },
    brick: { k: 'STONE_BRICK', r: 'all' }, bricks: { k: 'STONE_BRICK', r: 'all' },
    magma: { k: 'MAGMA_BLOCK', r: 'all' }, hay_block_side: { k: 'HAY_BALE', r: 'side' }, hay_block_top: { k: 'HAY_BALE', r: 'top' },
    wheat_stage_7: { k: 'WHEAT_3', r: 'all' }, wheat_stage7: { k: 'WHEAT_3', r: 'all' },
    farmland_wet: { k: 'FARMLAND', r: 'top' }, farmland_dry: { k: 'FARMLAND', r: 'top' },
    water_still: { k: 'WATER', r: 'all' }, lava_still: { k: 'LAVA', r: 'all' },
    torch_on: { k: 'TORCH_BLOCK', r: 'all' }, torch: { k: 'TORCH_BLOCK', r: 'all' },
    lantern: { k: 'LANTERN', r: 'all' }, soul_lantern: { k: 'SOUL_LANTERN', r: 'all' },
    wool_colored_white: { k: 'WOOL_WHITE', r: 'all' }, white_wool: { k: 'WOOL_WHITE', r: 'all' },
    wool_colored_red: { k: 'WOOL_RED', r: 'all' }, red_wool: { k: 'WOOL_RED', r: 'all' },
    wool_colored_blue: { k: 'WOOL_BLUE', r: 'all' }, blue_wool: { k: 'WOOL_BLUE', r: 'all' },
    wool_colored_green: { k: 'WOOL_GREEN', r: 'all' }, green_wool: { k: 'WOOL_GREEN', r: 'all' },
    wool_colored_yellow: { k: 'WOOL_YELLOW', r: 'all' }, yellow_wool: { k: 'WOOL_YELLOW', r: 'all' },
    wool_colored_black: { k: 'WOOL_BLACK', r: 'all' }, black_wool: { k: 'WOOL_BLACK', r: 'all' },
    wood_pickaxe: { k: 'WOOD_PICK', r: 'item' }, wooden_pickaxe: { k: 'WOOD_PICK', r: 'item' },
    stone_pickaxe: { k: 'STONE_PICK', r: 'item' }, iron_pickaxe: { k: 'IRON_PICK', r: 'item' },
    gold_pickaxe: { k: 'GOLD_PICK', r: 'item' }, golden_pickaxe: { k: 'GOLD_PICK', r: 'item' },
    diamond_pickaxe: { k: 'DIAMOND_PICK', r: 'item' }, netherite_pickaxe: { k: 'NETHERITE_PICK', r: 'item' },
    wood_sword: { k: 'WOOD_SWORD', r: 'item' }, wooden_sword: { k: 'WOOD_SWORD', r: 'item' },
    stone_sword: { k: 'STONE_SWORD', r: 'item' }, iron_sword: { k: 'IRON_SWORD', r: 'item' },
    gold_sword: { k: 'GOLD_SWORD', r: 'item' }, golden_sword: { k: 'GOLD_SWORD', r: 'item' },
    diamond_sword: { k: 'DIAMOND_SWORD', r: 'item' }, netherite_sword: { k: 'NETHERITE_SWORD', r: 'item' },
    wood_axe: { k: 'WOOD_AXE', r: 'item' }, wooden_axe: { k: 'WOOD_AXE', r: 'item' },
    stone_axe: { k: 'STONE_AXE', r: 'item' }, iron_axe: { k: 'IRON_AXE', r: 'item' },
    gold_axe: { k: 'GOLD_AXE', r: 'item' }, golden_axe: { k: 'GOLD_AXE', r: 'item' },
    diamond_axe: { k: 'DIAMOND_AXE', r: 'item' }, netherite_axe: { k: 'NETHERITE_AXE', r: 'item' },
    wood_shovel: { k: 'WOOD_SHOVEL', r: 'item' }, wooden_shovel: { k: 'WOOD_SHOVEL', r: 'item' },
    stone_shovel: { k: 'STONE_SHOVEL', r: 'item' }, iron_shovel: { k: 'IRON_SHOVEL', r: 'item' },
    gold_shovel: { k: 'GOLD_SHOVEL', r: 'item' }, golden_shovel: { k: 'GOLD_SHOVEL', r: 'item' },
    diamond_shovel: { k: 'DIAMOND_SHOVEL', r: 'item' }, netherite_shovel: { k: 'NETHERITE_SHOVEL', r: 'item' },
    wood_hoe: { k: 'WOOD_HOE', r: 'item' }, wooden_hoe: { k: 'WOOD_HOE', r: 'item' },
    stone_hoe: { k: 'STONE_HOE', r: 'item' }, iron_hoe: { k: 'IRON_HOE', r: 'item' },
    gold_hoe: { k: 'GOLD_HOE', r: 'item' }, golden_hoe: { k: 'GOLD_HOE', r: 'item' },
    diamond_hoe: { k: 'DIAMOND_HOE', r: 'item' }, netherite_hoe: { k: 'NETHERITE_HOE', r: 'item' },
    bow_standby: { k: 'BOW', r: 'item' }, bow: { k: 'BOW', r: 'item' }, arrow: { k: 'ARROW', r: 'item' },
    apple: { k: 'APPLE', r: 'item' }, apple_golden: { k: 'GOLD_APPLE', r: 'item' }, golden_apple: { k: 'GOLD_APPLE', r: 'item' },
    bread: { k: 'BREAD', r: 'item' }, wheat_seeds: { k: 'WHEAT_SEEDS', r: 'item' }, wheat: { k: 'WHEAT', r: 'item' },
    iron_ingot: { k: 'IRON_INGOT', r: 'item' }, gold_ingot: { k: 'GOLD_INGOT', r: 'item' }, copper_ingot: { k: 'COPPER_INGOT', r: 'item' },
    diamond: { k: 'DIAMOND', r: 'item' }, emerald: { k: 'EMERALD', r: 'item' }, coal: { k: 'COAL', r: 'item' }, charcoal: { k: 'CHARCOAL', r: 'item' },
    stick: { k: 'STICK', r: 'item' }, beef_raw: { k: 'RAW_BEEF', r: 'item' }, beef_cooked: { k: 'COOKED_BEEF', r: 'item' },
    porkchop_raw: { k: 'RAW_PORK', r: 'item' }, porkchop_cooked: { k: 'COOKED_PORK', r: 'item' },
    shears: { k: 'SHEARS', r: 'item' }, flint_and_steel: { k: 'FLINT_STEEL', r: 'item' },
    bucket_empty: { k: 'BUCKET', r: 'item' }, bucket_water: { k: 'WATER_BUCKET', r: 'item' }, bucket_lava: { k: 'LAVA_BUCKET', r: 'item' },
    ender_pearl: { k: 'ENDER_PEARL', r: 'item' }, ender_eye: { k: 'ENDER_EYE', r: 'item' },
    totem: { k: 'TOTEM_UNDYING', r: 'item' }, totem_of_undying: { k: 'TOTEM_UNDYING', r: 'item' }
  };
  let _dynTexReg = null;
  function _getDynTexRegistry() {
    if (_dynTexReg || typeof B === 'undefined' || typeof BLOCK_DEF === 'undefined') return _dynTexReg || new Map();
    const reg = new Map();
    const pushTarget = (stem, tgt) => {
      const k = String(stem || '').toLowerCase();
      if (!k || !tgt) return;
      let arr = reg.get(k);
      if (!arr) { arr = []; reg.set(k, arr); }
      arr.push(tgt);
    };
    const pushForDef = (bKey, id, role, explicitMcTex) => {
      const d = BLOCK_DEF[id];
      if (!d) return;
      const tiles = new Set();
      if (role === 'item' && d.itemTile !== undefined) tiles.add(d.itemTile);
      else if (role === 'top' && d.tiles && d.tiles[0] !== undefined) tiles.add(d.tiles[0]);
      else if (role === 'side' && d.tiles && d.tiles[1] !== undefined) tiles.add(d.tiles[1]);
      else if (role === 'bot' && d.tiles && d.tiles[2] !== undefined) tiles.add(d.tiles[2]);
      else if (role === 'front' && d.frontTile !== undefined) tiles.add(d.frontTile);
      else if (Array.isArray(d.tiles)) {
        for (const t of d.tiles) if (typeof t === 'number') tiles.add(t);
        if (d.frontTile !== undefined) tiles.add(d.frontTile);
        if (d.itemTile !== undefined) tiles.add(d.itemTile);
      }
      const mcBundle = (typeof window !== 'undefined' && window.MC_ICONS_BUNDLE) ? window.MC_ICONS_BUNDLE : null;
      const mcItemKey = (mcBundle && mcBundle.items && mcBundle.items[bKey]) ? bKey : null;
      const mcTexKeys = [];
      if (explicitMcTex) mcTexKeys.push(explicitMcTex);
      else if (mcBundle && mcBundle.blocks && Array.isArray(mcBundle.blocks[bKey])) {
        const sp = mcBundle.blocks[bKey];
        if (role === 'top' && sp[0]) mcTexKeys.push(sp[0]);
        else if (role === 'side' && (sp[1] || sp[0])) mcTexKeys.push(sp[1] || sp[0]);
        else if (role === 'front' && (sp[2] || sp[1] || sp[0])) mcTexKeys.push(sp[2] || sp[1] || sp[0]);
        else if (role === 'bot' && (sp[3] || sp[0])) mcTexKeys.push(sp[3] || sp[0]);
        else for (const tk of sp) if (tk && !mcTexKeys.includes(tk)) mcTexKeys.push(tk);
      }
      return { blockId: id, bKey, tiles: Array.from(tiles), mcItemKey, mcTexKeys };
    };
    for (const [bKey, id] of Object.entries(B)) {
      if (!id || typeof id !== 'number' || !BLOCK_DEF[id]) continue;
      const d = BLOCK_DEF[id];
      const tgt = pushForDef(bKey, id, d.tool || d.food ? 'item' : 'all');
      if (tgt) {
        pushTarget(bKey.toLowerCase(), tgt);
        if (d.nameEn) pushTarget(String(d.nameEn).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), tgt);
      }
    }
    for (const [stem, spec] of Object.entries(TEX_ALIAS_TO_B)) {
      const id = B[spec.k];
      if (!id || !BLOCK_DEF[id]) continue;
      const tgt = pushForDef(spec.k, id, spec.r, spec.mt);
      if (tgt) pushTarget(stem, tgt);
    }
    _dynTexReg = reg;
    return reg;
  }

  function resolveMcItemId(raw) {
    if (typeof raw === 'number' && BLOCK_DEF[raw]) return raw;
    if (!raw || typeof raw !== 'string') return 0;
    const norm = raw.trim().toLowerCase().replace(/^minecraft:/, '').replace(/^#/, '').replace(/:.*$/, '');
    if (norm === 'planks') return B.PLANKS || 0;
    if (norm === 'logs' || norm === 'logs_that_burn') return B.OAK_LOG || 0;
    if (norm === 'stone_crafting_materials' || norm === 'stone_tool_materials') return B.STONE || 0;
    if (norm === 'coals') return B.COAL || 0;
    if (MC_ID_TO_B[norm] !== undefined) return MC_ID_TO_B[norm];
    const upper = norm.toUpperCase();
    return (typeof B[upper] === 'number') ? B[upper] : 0;
  }

  function openModsDb() {
    if (_modDbPromise) return _modDbPromise;
    _modDbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB không khả dụng')); return; }
      const req = indexedDB.open(MOD_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MOD_STORE)) db.createObjectStore(MOD_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    });
    return _modDbPromise;
  }

  async function dbPutMod(rec) {
    const db = await openModsDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(MOD_STORE, 'readwrite');
      tx.objectStore(MOD_STORE).put(rec);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function dbDeleteMod(id) {
    const db = await openModsDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(MOD_STORE, 'readwrite');
      tx.objectStore(MOD_STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function dbGetAllMods() {
    try {
      const db = await openModsDb();
      return await new Promise((res, rej) => {
        const tx = db.transaction(MOD_STORE, 'readonly');
        const req = tx.objectStore(MOD_STORE).getAll();
        req.onsuccess = () => res(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => rej(req.error);
      });
    } catch (_) {
      return [];
    }
  }

  function readU16LE(u8, o) { return u8[o] | (u8[o + 1] << 8); }
  function readU32LE(u8, o) { return (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0; }
  function crc32Bytes(u8) {
    const wc = (typeof window !== 'undefined' && typeof window._getNucraftWasmCore === 'function') ? window._getNucraftWasmCore() : null;
    if (wc && wc.exports && wc.exports.crc32_bytes && wc.codecIn && u8.length <= wc.codecIn.length) {
      wc.codecIn.set(u8, 0);
      wc.state.crcCalls = (wc.state.crcCalls || 0) + 1;
      return wc.exports.crc32_bytes(u8.length >>> 0) >>> 0;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < u8.length; i++) {
      crc ^= u8[i];
      for (let b = 0; b < 8; b++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) : (crc >>> 1);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function inflateDeflateRaw(u8) {
    if (typeof DecompressionStream !== 'function') throw new Error('Trình duyệt không hỗ trợ giải nén DEFLATE');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }

  async function unzipEntries(bufOrU8, depth = 0) {
    const u8 = bufOrU8 instanceof Uint8Array ? bufOrU8 : new Uint8Array(bufOrU8);
    let eocd = -1;
    const minOff = Math.max(0, u8.length - 65558);
    for (let i = u8.length - 22; i >= minOff; i--) {
      if (readU32LE(u8, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('File ZIP / MCPACK không hợp lệ');
    const cdCount = readU16LE(u8, eocd + 10);
    const cdOffset = readU32LE(u8, eocd + 16);
    const dec = new TextDecoder('utf-8', { fatal: false });
    const files = new Map();
    let ptr = cdOffset;
    for (let i = 0; i < cdCount && ptr + 46 <= u8.length; i++) {
      if (readU32LE(u8, ptr) !== 0x02014b50) break;
      const method = readU16LE(u8, ptr + 10);
      const compSize = readU32LE(u8, ptr + 20);
      const nameLen = readU16LE(u8, ptr + 28);
      const extraLen = readU16LE(u8, ptr + 30);
      const cmtLen = readU16LE(u8, ptr + 32);
      const lfhOff = readU32LE(u8, ptr + 42);
      const rawName = dec.decode(u8.subarray(ptr + 46, ptr + 46 + nameLen)).replace(/\\/g, '/').replace(/^\/+/, '');
      ptr += 46 + nameLen + extraLen + cmtLen;
      if (!rawName || rawName.endsWith('/') || rawName.includes('..')) continue;
      if (readU32LE(u8, lfhOff) !== 0x04034b50) continue;
      const lfNameLen = readU16LE(u8, lfhOff + 26);
      const lfExtraLen = readU16LE(u8, lfhOff + 28);
      const dataStart = lfhOff + 30 + lfNameLen + lfExtraLen;
      const comp = u8.subarray(dataStart, dataStart + compSize);
      if (method === 0) files.set(rawName, new Uint8Array(comp));
      else if (method === 8) files.set(rawName, await inflateDeflateRaw(comp));
    }
    // Flatten nested .mcpack / .zip bundles inside .mcaddon archives (up to 2 levels deep)
    if (depth < 2) {
      const nestedKeys = Array.from(files.keys()).filter((k) => /\.(mcpack|zip)$/i.test(k));
      for (const nk of nestedKeys) {
        try {
          const sub = await unzipEntries(files.get(nk), depth + 1);
          const subBase = nk.replace(/\.(mcpack|zip)$/i, '').split('/').pop();
          for (const [sk, sv] of sub.entries()) files.set(`${subBase}/${sk}`, sv);
        } catch (_) {}
      }
    }
    return files;
  }

  function buildStoreZip(entriesMap) {
    const enc = new TextEncoder();
    const parts = [];
    const cd = [];
    let offset = 0;
    for (const [name, content] of entriesMap.entries()) {
      const nameB = enc.encode(name);
      const dataB = typeof content === 'string' ? enc.encode(content) : new Uint8Array(content);
      const crc = crc32Bytes(dataB);
      const lfh = new Uint8Array(30 + nameB.length);
      const dv = new DataView(lfh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint32(14, crc, true);
      dv.setUint32(18, dataB.length, true); dv.setUint32(22, dataB.length, true); dv.setUint16(26, nameB.length, true);
      lfh.set(nameB, 30);
      parts.push(lfh, dataB);
      const cde = new Uint8Array(46 + nameB.length);
      const cv = new DataView(cde.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, dataB.length, true); cv.setUint32(24, dataB.length, true);
      cv.setUint16(28, nameB.length, true); cv.setUint32(42, offset, true);
      cde.set(nameB, 46);
      cd.push(cde);
      offset += lfh.length + dataB.length;
    }
    const cdLen = cd.reduce((s, a) => s + a.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, cd.length, true); ev.setUint16(10, cd.length, true);
    ev.setUint32(12, cdLen, true); ev.setUint32(16, offset, true);
    const total = new Uint8Array(offset + cdLen + 22);
    let pos = 0;
    for (const p of parts) { total.set(p, pos); pos += p.length; }
    for (const c of cd) { total.set(c, pos); pos += c.length; }
    total.set(eocd, pos);
    return total;
  }

  function ensureBaseSnapshots() {
    if (!_baseAtlasBackup && typeof atlasCtx !== 'undefined' && typeof atlasCanvas !== 'undefined') {
      _baseAtlasBackup = atlasCtx.getImageData(0, 0, atlasCanvas.width, atlasCanvas.height);
    }
    if (!_baseBlockDefsBackup && typeof BLOCK_DEF !== 'undefined') {
      _baseBlockDefsBackup = new Map();
      for (const [k, d] of Object.entries(BLOCK_DEF)) {
        _baseBlockDefsBackup.set(Number(k), { name: d.name, hard: d.hard, dmg: d.dmg, heal: d.heal, feed: d.feed, emissive: d.emissive, light: d.light, mapColor: d.mapColor });
      }
    }
    if (!_baseMobStatsBackup && typeof MOB_STATS !== 'undefined') {
      _baseMobStatsBackup = new Map();
      for (const [k, s] of Object.entries(MOB_STATS)) {
        _baseMobStatsBackup.set(k, { hp: s.hp, speed: s.speed, dmg: s.dmg });
      }
    }
    if (!_baseSmeltBackup && typeof SMELT_RECIPES !== 'undefined') {
      _baseSmeltBackup = Object.assign({}, SMELT_RECIPES);
    }
  }

  function refreshWorldVisualsAfterMods() {
    if (typeof atlasCtx !== 'undefined' && typeof atlasCanvas !== 'undefined' && typeof atlasTex !== 'undefined') {
      atlasTex.needsUpdate = true;
      if (typeof window._rebuildAtlasBumpMap === 'function') window._rebuildAtlasBumpMap();
      if (typeof window._invalidateAtlasSolidTex === 'function') window._invalidateAtlasSolidTex();
      if (typeof window._invalidateRtLut === 'function') window._invalidateRtLut();
    }
    if (typeof _oreThumb3DCache !== 'undefined') _oreThumb3DCache.clear();
    if (typeof terrainMat !== 'undefined' && terrainMat) {
      const toonOn = typeof envUniforms !== 'undefined' && envUniforms.uCartoonMode && envUniforms.uCartoonMode.value > 0.5;
      terrainMat.bumpScale = toonOn ? 0.0 : 0.058;
    }
    if (typeof window._invalidateModVisualCaches === 'function') window._invalidateModVisualCaches();
    if (typeof _rcGridBuiltSig !== 'undefined') _rcGridBuiltSig = '';
    if (typeof window._syncWasmBlockLuts === 'function') window._syncWasmBlockLuts(true);
    if (typeof markAllLoadedChunksDirty === 'function' && typeof chunks !== 'undefined' && chunks.size) markAllLoadedChunksDirty(true);
    if (typeof renderHotbar === 'function') renderHotbar();
  }

  // Built-in Bare Bones Cartoon Resource Pack (Rust WASM accelerated): flat graphic 2-tone blocks, solid lush/cherry leaf cubes, & trailer palette
  function applyCartoonBareBonesPack() {
    if (typeof window !== 'undefined') window._cartoonAddonActive = true;
    if (typeof envUniforms !== 'undefined' && envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = 1.0;
    if (typeof atlasCtx === 'undefined' || typeof atlasCanvas === 'undefined') return 0;
    const cols = typeof ATLAS_COLS !== 'undefined' ? ATLAS_COLS : 8;
    const rows = typeof ATLAS_ROWS !== 'undefined' ? ATLAS_ROWS : 104;
    const px = typeof TILE_PX !== 'undefined' ? TILE_PX : 16;
    const numTiles = Math.min(1024, cols * rows);
    const tileModes = new Uint8Array(numTiles);
    if (typeof BLOCK_DEF !== 'undefined') {
      const modePrio = [0, 1, 5, 2, 3, 4]; // Priority: leaf(2) > ore(5) > glass(4) > plant/cutout(3) > solid(1)
      for (const [idStr, d] of Object.entries(BLOCK_DEF)) {
        const id = Number(idStr);
        if (!id || !d || d.itemOnly || d.tool || d.armorSlot || d.food || d.bow || d.spawnEgg || d.voxelItem || d.liquid || d.portal) continue;
        let mode = 1;
        if (d.solid && d.foliage && !d.cross && !d.glass) mode = 2;
        else if (d.oreBlock) mode = 5;
        else if (d.glass) mode = 4;
        else if (!d.solid || d.cross || d.torch || d.bamboo || d.rootCage || d.door || d.trapdoor || d.subBlock || (d.trans && !d.isLog && !d.isPlanks && !d.stairs && !d.slab && !d.fence)) mode = 3;
        const addTile = (t) => {
          if (typeof t === 'number' && t >= 0 && t < numTiles && modePrio[mode] > modePrio[tileModes[t]]) {
            tileModes[t] = mode;
          }
        };
        if (Array.isArray(d.tiles)) for (const t of d.tiles) addTile(t);
        addTile(d.frontTile);
        addTile(d.bedBlanketTile);
        addTile(d.bedSideTile);
      }
    }
    let painted = 0;
    const shiftHex = (hex, amt) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
      if (!m) return '#888888';
      const n = parseInt(m[1], 16);
      const ch = (v) => {
        const out = amt >= 0 ? Math.round(v + (255 - v) * amt) : Math.round(v * (1 + amt));
        return Math.max(0, Math.min(255, out)).toString(16).padStart(2, '0');
      };
      return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
    };
    const fillRectTile = (tIdx, col) => {
      if (tIdx < 0 || tIdx >= numTiles) return;
      const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
      atlasCtx.fillStyle = col;
      atlasCtx.fillRect(tx, ty, px, px);
    };
    const pxTile = (tIdx, x, y, w, h, col) => {
      if (tIdx < 0 || tIdx >= numTiles) return;
      const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
      atlasCtx.fillStyle = col;
      atlasCtx.fillRect(tx + x, ty + y, w, h);
    };
    const drawMapTile = (tIdx, rowsMap, pal) => {
      if (tIdx < 0 || tIdx >= numTiles) return;
      const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
      for (let y = 0; y < Math.min(px, rowsMap.length); y++) {
        const rStr = rowsMap[y];
        for (let x = 0; x < Math.min(px, rStr.length); x++) {
          const col = pal[rStr[x]];
          if (!col) continue;
          atlasCtx.fillStyle = col;
          atlasCtx.fillRect(tx + x, ty + y, 1, 1);
        }
      }
    };

    // 1. Stylize ALL block/plant/ore tiles in Rust WASM (with pure-JS fallback if WASM not loaded yet)
    const W = atlasCanvas.width, H = atlasCanvas.height;
    const img = atlasCtx.getImageData(0, 0, W, H);
    const d = img.data;
    const wCore = (typeof window._getNucraftWasmCore === 'function') ? window._getNucraftWasmCore() : null;
    if (wCore && wCore.exports && wCore.exports.stylize_atlas_cartoon && wCore.atlasRgba && wCore.tileModes && d.length <= wCore.atlasRgba.length) {
      wCore.atlasRgba.set(d);
      wCore.tileModes.fill(0);
      wCore.tileModes.set(tileModes);
      painted = wCore.exports.stylize_atlas_cartoon(W, H, px, cols, numTiles) | 0;
      d.set(wCore.atlasRgba.subarray(0, d.length));
      if (wCore.state) wCore.state.atlasCalls = (wCore.state.atlasCalls || 0) + 1;
    } else {
      const boostJs = (r, g, b, sat, gain, rich) => {
        const rc = Math.min(1, Math.max(0, r / 255)), gc = Math.min(1, Math.max(0, g / 255)), bc = Math.min(1, Math.max(0, b / 255));
        const r2 = rc * (1 - rich * (1 - rc)), g2 = gc * (1 - rich * (1 - gc)), b2 = bc * (1 - rich * (1 - bc));
        const lum = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
        return [
          Math.min(255, Math.max(0, Math.round((lum + (r2 - lum) * sat) * gain * 255))),
          Math.min(255, Math.max(0, Math.round((lum + (g2 - lum) * sat) * gain * 255))),
          Math.min(255, Math.max(0, Math.round((lum + (b2 - lum) * sat) * gain * 255)))
        ];
      };
      for (let tIdx = 0; tIdx < numTiles; tIdx++) {
        const mode = tileModes[tIdx];
        if (!mode) continue;
        const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
        if (tx + px > W || ty + px > H) continue;
        if (mode === 1 || mode === 2) {
          let tr = 0, tg = 0, tb = 0, tcnt = 0;
          if (mode === 2) {
            for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
              const i0 = ((ty + yy) * W + (tx + xx)) * 4;
              if (d[i0 + 3] > 60) { tr += d[i0]; tg += d[i0 + 1]; tb += d[i0 + 2]; tcnt++; }
            }
            if (tcnt > 0) { tr /= tcnt; tg /= tcnt; tb /= tcnt; }
          }
          for (let by = 0; by < px; by += 4) for (let bx = 0; bx < px; bx += 4) {
            let sr = 0, sg = 0, sb = 0, cnt = 0;
            for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
              const idx = ((ty + by + yy) * W + (tx + bx + xx)) * 4;
              if (d[idx + 3] > 60) { sr += d[idx]; sg += d[idx + 1]; sb += d[idx + 2]; cnt++; }
            }
            if (mode === 2) {
              const tone = (((bx >> 2) + (by >> 2)) & 1) ? 1.08 : 0.94;
              const [nr, ng, nb] = boostJs(cnt > 0 ? sr / cnt : tr * 0.88, cnt > 0 ? sg / cnt : tg * 0.88, cnt > 0 ? sb / cnt : tb * 0.88, 1.38, 1.05 * tone, 0.14);
              for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
                const idx = ((ty + by + yy) * W + (tx + bx + xx)) * 4;
                d[idx] = nr; d[idx + 1] = ng; d[idx + 2] = nb; d[idx + 3] = 255;
              }
            } else if (cnt >= 3) {
              const [qr, qg, qb] = boostJs(sr / cnt, sg / cnt, sb / cnt, 1.35, 1.06, 0.12);
              const nr = ((qr / 6) | 0) * 6, ng = ((qg / 6) | 0) * 6, nb = ((qb / 6) | 0) * 6;
              for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
                const idx = ((ty + by + yy) * W + (tx + bx + xx)) * 4;
                if (d[idx + 3] > 60) { d[idx] = nr; d[idx + 1] = ng; d[idx + 2] = nb; }
              }
            }
          }
          painted++;
        } else if (mode === 3 || mode === 5) {
          for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
            const idx = ((ty + yy) * W + (tx + xx)) * 4;
            if (d[idx + 3] > 60) {
              const [nr, ng, nb] = boostJs(d[idx], d[idx + 1], d[idx + 2], mode === 5 ? 1.42 : 1.38, 1.06, 0.10);
              d[idx] = nr; d[idx + 1] = ng; d[idx + 2] = nb; d[idx + 3] = 255;
            }
          }
          painted++;
        }
      }
    }
    atlasCtx.putImageData(img, 0, 0);

    // 2. Signature Bare Bones Trailer Hero Overlays across ALL trees (incl. Autumn), logs, planks, turf, stone & ores
    const paintTurf = (topTile, sideTile, topCol, dirtCol, skipTop = false) => {
      const hiTop = shiftHex(topCol, 0.14), shTop = shiftHex(topCol, -0.22);
      const shDirt = shiftHex(dirtCol, -0.14), hiDirt = shiftHex(dirtCol, 0.16);
      if (!skipTop && topTile >= 0) {
        fillRectTile(topTile, topCol);
        pxTile(topTile, 2, 2, 4, 4, hiTop); pxTile(topTile, 10, 8, 4, 4, hiTop); pxTile(topTile, 4, 11, 3, 2, shTop);
      }
      if (sideTile >= 0) {
        fillRectTile(sideTile, dirtCol);
        pxTile(sideTile, 0, 0, 16, 4, topCol);
        pxTile(sideTile, 0, 4, 4, 2, topCol); pxTile(sideTile, 8, 4, 4, 2, topCol); pxTile(sideTile, 14, 4, 2, 1, topCol);
        pxTile(sideTile, 0, 4, 16, 1, shTop);
        pxTile(sideTile, 2, 9, 4, 3, shDirt); pxTile(sideTile, 10, 11, 4, 3, hiDirt);
      }
    };
    const paintLogTop = (tIdx, barkCol, heartCol) => {
      fillRectTile(tIdx, heartCol);
      pxTile(tIdx, 0, 0, 16, 2, barkCol); pxTile(tIdx, 0, 14, 16, 2, barkCol);
      pxTile(tIdx, 0, 0, 2, 16, barkCol); pxTile(tIdx, 14, 0, 2, 16, barkCol);
      pxTile(tIdx, 5, 5, 6, 6, shiftHex(heartCol, -0.14));
    };
    const paintLogSide = (tIdx, barkCol, isStripped = false) => {
      const shCol = shiftHex(barkCol, -0.20), hiCol = shiftHex(barkCol, 0.16);
      fillRectTile(tIdx, barkCol);
      if (isStripped) {
        pxTile(tIdx, 2, 0, 2, 16, shCol); pxTile(tIdx, 11, 0, 2, 16, shCol);
        pxTile(tIdx, 6, 2, 3, 12, hiCol);
      } else {
        pxTile(tIdx, 2, 0, 3, 16, shCol); pxTile(tIdx, 9, 0, 3, 16, shCol); pxTile(tIdx, 6, 0, 2, 16, hiCol);
      }
    };
    const paintPlanks = (tIdx, baseCol) => {
      const seamCol = shiftHex(baseCol, -0.26), hiCol = shiftHex(baseCol, 0.15);
      fillRectTile(tIdx, baseCol);
      for (const yRow of [0, 4, 8, 12]) pxTile(tIdx, 0, yRow + 3, 16, 1, seamCol);
      pxTile(tIdx, 2, 1, 6, 2, hiCol); pxTile(tIdx, 9, 9, 5, 2, hiCol);
    };
    const paintLeaf = (tIdx, baseCol, hiCol = shiftHex(baseCol, 0.16), shCol = shiftHex(baseCol, -0.20)) => {
      fillRectTile(tIdx, baseCol);
      pxTile(tIdx, 0, 0, 4, 4, hiCol); pxTile(tIdx, 8, 4, 4, 4, hiCol); pxTile(tIdx, 12, 12, 4, 4, hiCol);
      pxTile(tIdx, 4, 10, 4, 4, shCol); pxTile(tIdx, 12, 0, 4, 4, shCol);
    };

    // Grass, Dirt, Autumn Podzol & Biome Turfs
    paintTurf(0, 1, '#4ad420', '#c47c34');
    fillRectTile(2, '#c47c34');
    pxTile(2, 2, 2, 5, 4, '#ab6724'); pxTile(2, 9, 9, 5, 4, '#ab6724'); pxTile(2, 11, 3, 3, 3, '#d68f45');
    paintTurf(9, 10, '#f2f8ff', '#c47c34');
    if (typeof V142_TILES !== 'undefined') paintTurf(9, V142_TILES.snowyDirtSide, '#f2f8ff', '#c47c34', true);
    paintTurf(218, 219, '#d26a22', '#ab6724'); // B.AUTUMN_PODZOL
    paintTurf(197, -1, '#4db824', '#4db824');  // B.MOSS_BLOCK
    paintTurf(290, 291, '#34d399', '#947656'); // B.SIFT_GRASS
    paintTurf(292, 293, '#f472b6', '#947656'); // B.LULLABY_GRASS
    paintTurf(295, -1, '#8b5cf6', '#8b5cf6');  // B.SPORE_TURF
    paintTurf(453, 454, '#24b5a6', '#a8703c'); // B.BLUE_GRASS
    paintTurf(73, 74, '#b8252f', '#822828');   // B.CRIMSON_NYLIUM
    paintTurf(75, 76, '#18a697', '#822828');   // B.WARPED_NYLIUM
    paintTurf(533, -1, '#8d97a4', '#8d97a4');  // B.PALE_MOSS
    paintTurf(536, -1, '#381c45', '#381c45');  // B.NIGHTMARE_MOSS
    if (typeof V153_TILES !== 'undefined') paintTurf(V153_TILES.endMossTop, V153_TILES.endMossSide, '#7c3aed', '#34136e');

    // Clean Blue-Gray Stone, Deepslate, Stone Bricks, Cactus & Giant Mushroom
    fillRectTile(3, '#838d9c');
    pxTile(3, 1, 2, 6, 4, '#727c8b'); pxTile(3, 8, 8, 6, 5, '#727c8b'); pxTile(3, 9, 2, 4, 3, '#959fae');
    fillRectTile(22, '#4b5260');
    pxTile(22, 1, 2, 6, 3, '#3d4350'); pxTile(22, 8, 9, 6, 4, '#3d4350'); pxTile(22, 3, 10, 5, 3, '#5a6272');
    fillRectTile(33, '#8a94a3');
    pxTile(33, 0, 7, 16, 1, '#6b7585'); pxTile(33, 0, 15, 16, 1, '#6b7585');
    pxTile(33, 7, 0, 1, 7, '#6b7585'); pxTile(33, 15, 8, 1, 7, '#6b7585');
    // Cactus (184 top, 17 side)
    fillRectTile(184, '#43a82c'); pxTile(184, 3, 3, 10, 10, '#58c43e');
    fillRectTile(17, '#43a82c');
    for (const cxC of [0, 4, 8, 12]) { pxTile(17, cxC, 0, 1, 16, '#297a19'); pxTile(17, cxC + 2, 0, 1, 16, '#5cd142'); }
    // Giant Red Mushroom Cap (150) & Stem (151) + Nether Wart Caps (79, 80)
    fillRectTile(150, '#df3131');
    pxTile(150, 2, 2, 4, 3, '#f7efe3'); pxTile(150, 10, 5, 3, 4, '#f7efe3'); pxTile(150, 4, 10, 4, 3, '#f7efe3');
    fillRectTile(151, '#eae3d3'); pxTile(151, 3, 3, 4, 4, '#dad0bd'); pxTile(151, 9, 10, 5, 3, '#dad0bd');
    paintLeaf(79, '#b51d2d');
    paintLeaf(80, '#16b3a3');

    // ALL Logs & Stripped Logs (every tree family including Autumn Acacia 29, Oak 4/5, Spruce 12, Sakura 14, Birch 16, Jungle, Dark Oak, Pale, Nightmare, Sculk, Void, etc.)
    const LEAF_PAL_OVERRIDES = {
      6:   ['#3ab520', '#4dc92c', '#2d9916'],
      13:  ['#237830', '#2e8f3c', '#1a6124'],
      30:  ['#f06a1a', '#ff8e38', '#c7480a'], // Autumn Acacia / Red-Orange
      31:  ['#54c428', '#68d63a', '#41a81c'],
      92:  ['#43ba22', '#58cf32', '#319c16'],
      96:  ['#328c22', '#42a62e', '#247017'],
      199: ['#dc2626', '#f24b4b', '#9e1717'], // Crimson Maple
      299: ['#35c9b5', '#5eead4', '#229688'], // Sift
      300: ['#9ee3dc', '#c6f4ef', '#6cbdb7'], // Lullaby
      450: ['#2b96f6', '#60b8ff', '#1668bd'], // Azure
      451: ['#1b6be0', '#428ef5', '#0f47a1'], // Cobalt
      526: ['#f0b814', '#ffd845', '#bd8708'], // Golden Maple
      527: ['#eb6414', '#ff8838', '#b84208'], // Orange Maple
      532: ['#9fa8b4', '#bdc5d0', '#79828f'], // Pale Oak
      535: ['#7c2444', '#a1385e', '#54142b'], // Nightmare
      551: ['#159bb5', '#29c4de', '#0c6d80']  // Sculk
    };
    if (typeof JUNGLE_LOG_TILES !== 'undefined') LEAF_PAL_OVERRIDES[JUNGLE_LOG_TILES.leaves] = ['#3ec21e', '#52d62e', '#2ea314'];
    if (typeof DARK_OAK_LOG_TILES !== 'undefined') LEAF_PAL_OVERRIDES[DARK_OAK_LOG_TILES.leaves] = ['#297d19', '#379424', '#1d6110'];
    if (typeof V153_TILES !== 'undefined') LEAF_PAL_OVERRIDES[V153_TILES.voidLeaves] = ['#a855f7', '#d88aff', '#7626bd'];

    const LOG_BARK_OVERRIDES = {
      5: '#6b4120', 12: '#4a2f1a', 29: '#6e655b', 77: '#7d2240', 78: '#246175',
      91: '#9c7853', 94: '#5c342e', 298: '#9eaec2', 448: '#4a6285', 530: '#8a9199',
      534: '#32193d', 549: '#173f4e'
    };
    if (typeof JUNGLE_LOG_TILES !== 'undefined') LOG_BARK_OVERRIDES[JUNGLE_LOG_TILES.side] = '#5e4c29';
    if (typeof DARK_OAK_LOG_TILES !== 'undefined') LOG_BARK_OVERRIDES[DARK_OAK_LOG_TILES.side] = '#3b2615';
    if (typeof V153_TILES !== 'undefined') LOG_BARK_OVERRIDES[V153_TILES.voidLogSide] = '#4c1d95';

    // Shared Oak ring top (4) + bespoke Sakura bark (14/90) & Birch bark (16) & Bamboo block (189/190)
    paintLogTop(4, '#6b4120', '#dfb46e');
    paintLogTop(90, '#4a2335', '#f2b8cf');
    fillRectTile(14, '#4a2335');
    pxTile(14, 3, 2, 5, 2, '#7d445d'); pxTile(14, 9, 7, 5, 2, '#7d445d'); pxTile(14, 2, 12, 6, 2, '#361726');
    fillRectTile(16, '#f2ede2');
    pxTile(16, 2, 3, 5, 2, '#3d4147'); pxTile(16, 10, 7, 4, 2, '#3d4147'); pxTile(16, 3, 12, 6, 2, '#3d4147');
    paintLogTop(189, '#4c8022', '#70ad34');
    fillRectTile(190, '#6aa62e'); pxTile(190, 0, 4, 16, 1, '#4c8022'); pxTile(190, 0, 12, 16, 1, '#4c8022');

    if (typeof BLOCK_DEF !== 'undefined') {
      for (const [idStr, d] of Object.entries(BLOCK_DEF)) {
        const id = Number(idStr);
        if (!id || !d || !Array.isArray(d.tiles)) continue;
        if (d.solid && d.foliage && !d.cross && !d.glass) {
          const lt = d.tiles[0];
          if (lt === 15) continue; // Sakura keeps blossom map below
          const ov = LEAF_PAL_OVERRIDES[lt];
          if (ov) paintLeaf(lt, ov[0], ov[1], ov[2]);
          else paintLeaf(lt, d.mapColor || '#3ab520');
        } else if (d.isLog) {
          const tTop = d.tiles[0], tSide = d.tiles[1];
          if (tTop !== 4 && tTop !== 90 && tTop !== 189 && tTop !== tSide) {
            paintLogTop(tTop, LOG_BARK_OVERRIDES[tSide] || d.mapColor || '#6b4120', shiftHex(d.mapColor || '#dfb46e', 0.34));
          }
          if (tSide !== 14 && tSide !== 16 && tSide !== 190) {
            paintLogSide(tSide, LOG_BARK_OVERRIDES[tSide] || d.mapColor || '#6b4120', !!d.isStripped);
          }
        } else if (d.isPlanks) {
          paintPlanks(d.tiles[0], d.mapColor || '#d49b52');
        }
      }
    }
    paintPlanks(8, '#d49b52'); // Oak Planks signature warm tone
    if (typeof WOOD_FAMILIES !== 'undefined') {
      for (const wf of WOOD_FAMILIES) {
        if (wf && wf.tPlank > 0 && wf.key !== 'oak') paintPlanks(wf.tPlank, wf.mapColor || '#c99352');
        if (wf && wf.tStripSide > 0) paintLogSide(wf.tStripSide, wf.mapColor || '#c99352', true);
        if (wf && wf.tStripTop > 0) paintLogTop(wf.tStripTop, wf.mapColor || '#b58045', shiftHex(wf.mapColor || '#c99352', 0.25));
      }
    }

    // Crafting Table (34 top, 35 & 442 side)
    fillRectTile(34, '#6b4120'); pxTile(34, 1, 1, 14, 14, '#d49b52');
    for (const o of [4, 9]) { pxTile(34, o, 2, 1, 12, '#855228'); pxTile(34, 2, o, 12, 1, '#855228'); }
    fillRectTile(35, '#d49b52'); pxTile(35, 0, 0, 16, 2, '#6b4120'); pxTile(35, 0, 14, 16, 2, '#6b4120');
    pxTile(35, 3, 4, 4, 4, '#7f8998'); pxTile(35, 5, 8, 2, 4, '#6b4120'); pxTile(35, 9, 5, 4, 3, '#949eab'); pxTile(35, 10, 8, 2, 4, '#6b4120');
    fillRectTile(442, '#d49b52'); pxTile(442, 0, 0, 16, 2, '#6b4120'); pxTile(442, 0, 14, 16, 2, '#6b4120');
    pxTile(442, 3, 5, 4, 7, '#6b4120'); pxTile(442, 9, 5, 4, 7, '#6b4120');

    // Exact Image 4 Sakura Cherry Blossom Leaves: soft pastel pink base + crisp 4-petal white/blush blossoms + rose accents
    drawMapTile(15, [
      '..H....DD......W',
      '.HWH......L...WW',
      '..H..DD..LWL..W.',
      '..........L..DD.',
      '....L.......H...',
      '.DD.LWL....HWH..',
      '..DD.L..DD..H...',
      '..H........L....',
      '.HWH..DD..LWL.DD',
      '..H.......LL....',
      '.....H.........H',
      'DD..HWH...DD..HW',
      '.....H..L......H',
      '..L....LWL.DD...',
      '.LWL....L...H...',
      '..L..DD....HWH..'
    ], { '.': '#f58ac0', L: '#ffb4da', H: '#ffd6ec', W: '#fff0f8', D: '#dd5a9a' });

    fillRectTile(7, '#f4de82'); pxTile(7, 3, 3, 5, 3, '#e5cb6a'); pxTile(7, 9, 10, 5, 3, '#e5cb6a');
    const drawOre = (tIdx, gemMain, gemHi, stoneHex = '#7f8998') => {
      fillRectTile(tIdx, stoneHex);
      pxTile(tIdx, 3, 3, 3, 3, gemMain); pxTile(tIdx, 3, 3, 2, 1, gemHi);
      pxTile(tIdx, 10, 4, 3, 2, gemMain); pxTile(tIdx, 10, 4, 2, 1, gemHi);
      pxTile(tIdx, 4, 10, 3, 3, gemMain); pxTile(tIdx, 4, 10, 2, 1, gemHi);
      pxTile(tIdx, 9, 10, 4, 3, gemMain); pxTile(tIdx, 9, 10, 2, 1, gemHi);
    };
    drawOre(20, '#f8c61c', '#ffea64');
    drawOre(24, '#23272e', '#3d434f');
    drawOre(25, '#e8b896', '#fce0c8');
    drawOre(26, '#2be4ff', '#a6f9ff');
    drawOre(158, '#eb7538', '#ff9e66');
    drawOre(159, '#cbd5e1', '#f1f5f9');
    drawOre(160, '#1ce05e', '#82ffaa');
    drawOre(161, '#f43f5e', '#fda4af');
    drawOre(224, '#2563eb', '#60a5fa');
    drawOre(447, '#dc2626', '#fca5a5');
    if (typeof V156_TILES !== 'undefined') drawOre(V156_TILES.sulfurOre, '#facc15', '#fef08a', '#7e7668');
    if (typeof window !== 'undefined') window._cartoonLastPainted = painted;
    return painted;
  }

  function normalizeSpriteToCanvas(imgOrCanvas) {
    if (!imgOrCanvas) return null;
    const w = imgOrCanvas.naturalWidth || imgOrCanvas.width || 0;
    const h = imgOrCanvas.naturalHeight || imgOrCanvas.height || 0;
    if (w <= 0 || h <= 0) return null;
    // Minecraft animated sprite sheets stack square frames vertically (e.g. 16x64): take top square frame cleanly
    const cropH = (h > w && h % w === 0) ? w : h;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = cropH;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(imgOrCanvas, 0, 0, w, cropH, 0, 0, w, cropH);
    cv.complete = true;
    cv.naturalWidth = w;
    cv.naturalHeight = cropH;
    return cv;
  }

  function decodeTgaToCanvas(u8) {
    if (!u8 || u8.length < 18) return null;
    const idLen = u8[0], colorMapType = u8[1], imgType = u8[2];
    const w = u8[12] | (u8[13] << 8), h = u8[14] | (u8[15] << 8);
    const bpp = u8[16], desc = u8[17];
    if (colorMapType !== 0 || (imgType !== 2 && imgType !== 10) || (bpp !== 24 && bpp !== 32) || !w || !h || w > 512 || h > 2048) return null;
    const bytesPerPx = bpp >> 3;
    const totalPx = w * h;
    const rgba = new Uint8ClampedArray(totalPx * 4);
    let ptr = 18 + idLen;
    let pxIdx = 0;
    if (imgType === 2) {
      while (pxIdx < totalPx && ptr + bytesPerPx <= u8.length) {
        const o = pxIdx * 4;
        rgba[o] = u8[ptr + 2]; rgba[o + 1] = u8[ptr + 1]; rgba[o + 2] = u8[ptr];
        rgba[o + 3] = bytesPerPx === 4 ? u8[ptr + 3] : 255;
        ptr += bytesPerPx; pxIdx++;
      }
    } else {
      while (pxIdx < totalPx && ptr < u8.length) {
        const hdr = u8[ptr++];
        const count = (hdr & 0x7f) + 1;
        if (hdr & 0x80) {
          if (ptr + bytesPerPx > u8.length) break;
          const r = u8[ptr + 2], g = u8[ptr + 1], b = u8[ptr], a = bytesPerPx === 4 ? u8[ptr + 3] : 255;
          ptr += bytesPerPx;
          for (let k = 0; k < count && pxIdx < totalPx; k++, pxIdx++) {
            const o = pxIdx * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
          }
        } else {
          for (let k = 0; k < count && pxIdx < totalPx && ptr + bytesPerPx <= u8.length; k++, pxIdx++, ptr += bytesPerPx) {
            const o = pxIdx * 4;
            rgba[o] = u8[ptr + 2]; rgba[o + 1] = u8[ptr + 1]; rgba[o + 2] = u8[ptr];
            rgba[o + 3] = bytesPerPx === 4 ? u8[ptr + 3] : 255;
          }
        }
      }
    }
    const topOrigin = (desc & 0x20) !== 0;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const idata = ctx.createImageData(w, h);
    if (topOrigin) {
      idata.data.set(rgba);
    } else {
      const rowBytes = w * 4;
      for (let y = 0; y < h; y++) idata.data.set(rgba.subarray((h - 1 - y) * rowBytes, (h - y) * rowBytes), y * rowBytes);
    }
    ctx.putImageData(idata, 0, 0);
    return normalizeSpriteToCanvas(cv);
  }

  function drawPngTileOnAtlas(tileIdx, imgOrCanvas) {
    if (typeof atlasCtx === 'undefined' || !imgOrCanvas) return false;
    const cols = typeof ATLAS_COLS !== 'undefined' ? ATLAS_COLS : 8;
    const px = typeof TILE_PX !== 'undefined' ? TILE_PX : 16;
    const tx = (tileIdx % cols) * px, ty = Math.floor(tileIdx / cols) * px;
    const sw = imgOrCanvas.naturalWidth || imgOrCanvas.width || px;
    const sh = imgOrCanvas.naturalHeight || imgOrCanvas.height || px;
    const cropH = (sh > sw && sh % sw === 0) ? sw : sh;
    atlasCtx.save();
    atlasCtx.imageSmoothingEnabled = false;
    atlasCtx.clearRect(tx, ty, px, px);
    atlasCtx.drawImage(imgOrCanvas, 0, 0, sw, cropH, tx, ty, px, px);
    atlasCtx.restore();
    return true;
  }

  function decodeImageFromBytes(u8, mime = 'image/png') {
    if (mime === 'image/x-tga') {
      const tga = decodeTgaToCanvas(u8);
      return tga ? Promise.resolve(tga) : Promise.reject(new Error('TGA decode fail'));
    }
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([u8], { type: mime }));
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(normalizeSpriteToCanvas(im) || im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image decode fail')); };
      im.src = url;
    });
  }

  // Strip UTF-8 BOM, JSON5 // & /* */ comments (outside string literals) + trailing commas
  function stripJsonComments(str) {
    let s = String(str || '');
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    let noCmt = '', inStr = false, qCh = '"', esc = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i], nx = s[i + 1];
      if (inStr) {
        noCmt += ch;
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === qCh) inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; qCh = ch; noCmt += ch; continue; }
      if (ch === '/' && nx === '/') {
        while (i < s.length && s[i] !== '\n') i++;
        noCmt += '\n';
        continue;
      }
      if (ch === '/' && nx === '*') {
        i += 2;
        while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
        i++;
        continue;
      }
      noCmt += ch;
    }
    // Second pass strips trailing commas before ] or } outside strings
    let out = ''; inStr = false; esc = false;
    for (let i = 0; i < noCmt.length; i++) {
      const ch = noCmt[i];
      if (inStr) {
        out += ch;
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; out += ch; continue; }
      if (ch === ',') {
        let j = i + 1;
        while (j < noCmt.length && /\s/.test(noCmt[j])) j++;
        if (noCmt[j] === '}' || noCmt[j] === ']') continue;
      }
      out += ch;
    }
    return out;
  }

  function _resolveIngId(raw) {
    if (!raw) return 0;
    if (typeof raw === 'string') return resolveMcItemId(raw);
    if (Array.isArray(raw)) {
      for (const el of raw) { const id = _resolveIngId(el); if (id > 0) return id; }
      return 0;
    }
    if (typeof raw === 'object') return resolveMcItemId(raw.item || raw.id || raw.tag);
    return 0;
  }

  function registerShapedOrShapelessRecipe(jsonObj) {
    if (!jsonObj) return 0;
    const furnace = jsonObj['minecraft:recipe_furnace'] || (jsonObj.type === 'minecraft:smelting' || jsonObj.type === 'minecraft:blasting' ? jsonObj : null);
    if (furnace && typeof SMELT_RECIPES !== 'undefined') {
      const inId = _resolveIngId(furnace.input || furnace.ingredient);
      const outRaw = furnace.output || furnace.result;
      const outId = resolveMcItemId(typeof outRaw === 'string' ? outRaw : (outRaw && (outRaw.item || outRaw.id)));
      if (inId > 0 && outId > 0 && BLOCK_DEF[outId]) {
        SMELT_RECIPES[inId] = { out: outId, kind: BLOCK_DEF[outId].food ? 'food' : 'misc', xp: Number(furnace.experience || 1), cookTime: Math.max(1, (Number(furnace.cookingtime || 200) / 20)) };
        return 1;
      }
      return 0;
    }
    if (typeof RECIPES === 'undefined') return 0;
    const shaped = jsonObj['minecraft:recipe_shaped'] || (jsonObj.type === 'minecraft:crafting_shaped' ? jsonObj : null);
    const shapeless = jsonObj['minecraft:recipe_shapeless'] || (jsonObj.type === 'minecraft:crafting_shapeless' ? jsonObj : null);
    const body = shaped || shapeless;
    if (!body) return 0;
    const resObj = Array.isArray(body.result) ? body.result[0] : body.result;
    const outId = resolveMcItemId(typeof resObj === 'string' ? resObj : (resObj && (resObj.item || resObj.id)));
    if (!outId || !BLOCK_DEF[outId]) return 0;
    const qty = Math.max(1, Number((resObj && (resObj.count || resObj.qty)) || 1) | 0);
    const grid = new Array(9).fill(0);
    const reqMap = new Map();
    const addReq = (bid) => { if (bid > 0) reqMap.set(bid, (reqMap.get(bid) || 0) + 1); };
    if (shaped && Array.isArray(body.pattern) && body.key) {
      for (let r = 0; r < Math.min(3, body.pattern.length); r++) {
        const row = String(body.pattern[r] || '');
        for (let c = 0; c < Math.min(3, row.length); c++) {
          const k = row[c];
          if (k === ' ') continue;
          const bid = _resolveIngId(body.key[k]);
          grid[r * 3 + c] = bid;
          addReq(bid);
        }
      }
    } else if (shapeless && Array.isArray(body.ingredients)) {
      for (let i = 0; i < Math.min(9, body.ingredients.length); i++) {
        const bid = _resolveIngId(body.ingredients[i]);
        grid[i] = bid;
        addReq(bid);
      }
    }
    const req = Array.from(reqMap.entries()).map(([id, q]) => ({ id, qty: q }));
    if (!req.length) return 0;
    const cat = BLOCK_DEF[outId].tool || BLOCK_DEF[outId].armorSlot ? 'tools' : (BLOCK_DEF[outId].food ? 'food' : (BLOCK_DEF[outId].solid ? 'blocks' : 'misc'));
    RECIPES.push({ cat, is2x2: req.reduce((s, r) => s + r.qty, 0) <= 4, out: outId, qty, req, grid, _isMod: true });
    return 1;
  }

  function applyBlockOrItemJsonPatch(jsonObj) {
    const blk = jsonObj && jsonObj['minecraft:block'];
    if (blk && blk.description && blk.description.identifier && typeof BLOCK_DEF !== 'undefined') {
      const id = resolveMcItemId(blk.description.identifier);
      const d = id ? BLOCK_DEF[id] : null;
      const c = blk.components || {};
      if (!d) return 0;
      const mine = c['minecraft:destructible_by_mining'];
      if (mine && typeof mine.seconds_to_destroy === 'number') d.hard = Math.max(0.05, mine.seconds_to_destroy);
      else if (typeof c['minecraft:destroy_time'] === 'number') d.hard = Math.max(0.05, c['minecraft:destroy_time']);
      const light = c['minecraft:light_emission'];
      if (typeof light === 'number') { d.light = light; if (light > 0) d.emissive = true; }
      const mc = c['minecraft:map_color'];
      if (typeof mc === 'string' && mc.startsWith('#')) d.mapColor = mc;
      return 1;
    }
    const itm = jsonObj && jsonObj['minecraft:item'];
    if (itm && itm.description && itm.description.identifier && typeof BLOCK_DEF !== 'undefined') {
      const id = resolveMcItemId(itm.description.identifier);
      const d = id ? BLOCK_DEF[id] : null;
      const c = itm.components || {};
      if (!d) return 0;
      if (c['minecraft:damage'] && typeof c['minecraft:damage'].value === 'number') d.dmg = Math.max(1, c['minecraft:damage'].value);
      else if (typeof c['minecraft:damage'] === 'number') d.dmg = Math.max(1, c['minecraft:damage']);
      if (c['minecraft:food'] && typeof c['minecraft:food'].nutrition === 'number') d.feed = Math.max(1, c['minecraft:food'].nutrition);
      return 1;
    }
    return 0;
  }

  function applyEntityJsonPatch(jsonObj) {
    const ent = jsonObj && jsonObj['minecraft:entity'];
    const ident = ent && ent.description && ent.description.identifier;
    if (!ident || typeof MOB_STATS === 'undefined') return 0;
    const key = String(ident).replace(/^minecraft:/, '').toLowerCase();
    const st = MOB_STATS[key];
    if (!st || !ent.components) return 0;
    const c = ent.components;
    if (c['minecraft:health'] && typeof c['minecraft:health'].max === 'number') st.hp = Math.max(1, c['minecraft:health'].max);
    if (c['minecraft:movement'] && typeof c['minecraft:movement'].value === 'number') st.speed = Math.max(0.2, c['minecraft:movement'].value * 9.5);
    if (c['minecraft:attack'] && typeof c['minecraft:attack'].damage === 'number') st.dmg = Math.max(0, c['minecraft:attack'].damage);
    return 1;
  }

  function _collectSoundTargets(lowPath) {
    const stem = lowPath.split('/').pop().replace(/\.(ogg|mp3|wav)$/i, '').replace(/\d+$/, '');
    const keys = new Set([lowPath.split('/').pop().replace(/\.(ogg|mp3|wav)$/i, ''), stem]);
    if (/\/dig\/|break|destroy/.test(lowPath)) { keys.add('dig'); keys.add('break'); }
    if (/place|step/.test(lowPath)) { keys.add('place'); if (/step/.test(lowPath)) keys.add('jump'); }
    if (/explode|tnt/.test(lowPath)) { keys.add('explode'); keys.add('mob_explode'); }
    if (/fuse|hiss|ignite/.test(lowPath)) keys.add('hiss');
    if (/hurt|damage|hit/.test(lowPath)) { keys.add('hurt'); keys.add('crit'); }
    if (/eat|burp/.test(lowPath)) keys.add('eat');
    if (/bow|shoot/.test(lowPath)) keys.add('bow');
    if (/pop|pickup|orb/.test(lowPath)) { keys.add('pickup'); keys.add('xp_orb'); }
    if (/levelup/.test(lowPath)) keys.add('levelup');
    if (/splash|water/.test(lowPath)) keys.add('splash');
    if (/fire|lava|fizz/.test(lowPath)) keys.add('burn');
    if (/roar|growl|zombie|ender|dragon/.test(lowPath)) keys.add('roar');
    if (/equip|armor|click/.test(lowPath)) keys.add('equip');
    return Array.from(keys).filter(Boolean);
  }

  window._playModSfx = (type, ctx, dest, vol = 1) => {
    const list = _modSoundEntries.get(type);
    if (!list || !list.length || !ctx) return false;
    const item = list[Math.floor(Math.random() * list.length)];
    if (!item) return false;
    if (item.buf) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = item.buf;
        const g = ctx.createGain();
        g.gain.value = Math.max(0.05, Math.min(1.0, vol * 0.65));
        src.connect(g); g.connect(dest || ctx.destination);
        src.start();
        return true;
      } catch (_) { return false; }
    }
    if (!item.decoding && item.bytes) {
      item.decoding = true;
      const ab = item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength);
      ctx.decodeAudioData(ab).then((b) => { item.buf = b; }).catch(() => {});
    }
    return false;
  };
  window._getModSoundKeys = () => Array.from(_modSoundEntries.keys());

  function _parseBedrockTexMapJson(bytes, outMap) {
    try {
      const obj = JSON.parse(stripJsonComments(new TextDecoder().decode(bytes)));
      const td = obj && obj.texture_data;
      if (!td || typeof td !== 'object') return;
      for (const [stem, info] of Object.entries(td)) {
        const texList = [];
        const tx = info && info.textures;
        if (typeof tx === 'string') texList.push(tx);
        else if (Array.isArray(tx)) for (const x of tx) texList.push(typeof x === 'string' ? x : x?.path);
        else if (tx && typeof tx === 'object' && tx.path) texList.push(tx.path);
        for (const p of texList) {
          if (!p) continue;
          const clean = String(p).toLowerCase().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(png|webp|tga)$/i, '');
          outMap.set(clean, stem.toLowerCase());
          const lastSeg = clean.split('/').pop();
          if (lastSeg) outMap.set(lastSeg, stem.toLowerCase());
        }
      }
    } catch (_) {}
  }

  window.NUCRAFT_MOD_API = {
    get B() { return typeof B !== 'undefined' ? B : {}; },
    get BLOCK_DEF() { return typeof BLOCK_DEF !== 'undefined' ? BLOCK_DEF : {}; },
    get RECIPES() { return typeof RECIPES !== 'undefined' ? RECIPES : []; },
    get SMELT_RECIPES() { return typeof SMELT_RECIPES !== 'undefined' ? SMELT_RECIPES : {}; },
    get MOB_STATS() { return typeof MOB_STATS !== 'undefined' ? MOB_STATS : {}; },
    get atlasCanvas() { return typeof atlasCanvas !== 'undefined' ? atlasCanvas : null; },
    registerRecipe(spec) {
      if (!spec || !spec.out || !Array.isArray(spec.req) || typeof RECIPES === 'undefined') return false;
      RECIPES.push(Object.assign({ cat: 'misc', qty: 1, grid: [0,0,0,0,0,0,0,0,0], _isMod: true }, spec));
      return true;
    },
    patchBlock(idOrKey, patch) {
      const id = resolveMcItemId(idOrKey);
      if (!id || !BLOCK_DEF[id] || !patch) return false;
      Object.assign(BLOCK_DEF[id], patch);
      return true;
    },
    patchMob(mobKey, patch) {
      if (!mobKey || typeof MOB_STATS === 'undefined' || !MOB_STATS[mobKey] || !patch) return false;
      Object.assign(MOB_STATS[mobKey], patch);
      return true;
    },
    registerCommand(cmd, fn) {
      if (typeof cmd === 'string' && typeof fn === 'function') _modCommands.set(cmd.toLowerCase(), fn);
    },
    onTick(fn) {
      if (typeof fn === 'function') _modTickHandlers.push(fn);
    },
    showToast(msg) { if (typeof showToast === 'function') showToast(String(msg)); }
  };

  window.runModCommand = (cmdStr) => {
    const k = String(cmdStr || '').trim().toLowerCase();
    const fn = _modCommands.get(k);
    if (!fn) return false;
    try { fn(cmdStr); return true; } catch (err) { console.error('[ModCmd]', err); return true; }
  };
  window.runModTickHooks = (dt) => {
    for (let i = _modTickHandlers.length - 1; i >= 0; i--) {
      try { _modTickHandlers[i](dt); }
      catch (err) { console.error('[ModTick disabled]', err); _modTickHandlers.splice(i, 1); }
    }
  };

  async function applyAllEnabledMods() {
    ensureBaseSnapshots();
    if (_baseAtlasBackup && typeof atlasCtx !== 'undefined') atlasCtx.putImageData(_baseAtlasBackup, 0, 0);
    if (typeof window !== 'undefined') window._cartoonAddonActive = false;
    if (typeof envUniforms !== 'undefined' && envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = 0.0;
    if (_baseBlockDefsBackup && typeof BLOCK_DEF !== 'undefined') {
      for (const [id, st] of _baseBlockDefsBackup.entries()) if (BLOCK_DEF[id]) Object.assign(BLOCK_DEF[id], st);
    }
    if (_baseMobStatsBackup && typeof MOB_STATS !== 'undefined') {
      for (const [k, st] of _baseMobStatsBackup.entries()) if (MOB_STATS[k]) Object.assign(MOB_STATS[k], st);
    }
    if (_baseSmeltBackup && typeof SMELT_RECIPES !== 'undefined') {
      for (const k of Object.keys(SMELT_RECIPES)) delete SMELT_RECIPES[k];
      Object.assign(SMELT_RECIPES, _baseSmeltBackup);
    }
    if (typeof RECIPES !== 'undefined') {
      for (let i = RECIPES.length - 1; i >= 0; i--) {
        if (RECIPES[i] && RECIPES[i]._isMod) RECIPES.splice(i, 1);
      }
    }
    _modCommands.clear();
    _modTickHandlers.length = 0;
    _modSoundEntries.clear();
    if (typeof luantiBuffers !== 'undefined') {
      for (const [k, orig] of _baseSoundBackup.entries()) {
        if (orig) luantiBuffers.set(k, orig); else luantiBuffers.delete(k);
      }
      _baseSoundBackup.clear();
    }

    const dynReg = _getDynTexRegistry();
    const modItemOverrides = new Map();
    const modTexOverrides = new Map();

    for (const pack of _installedMods) {
      if (!pack.enabled) continue;
      const stats = { tex: 0, recipe: 0, mob: 0, sound: 0, script: 0, warn: [] };
      try {
        if (pack.format === 'builtin-cartoon') {
          stats.tex += applyCartoonBareBonesPack();
        } else if (pack.format === 'nucraft-js') {
          const code = typeof pack.data === 'string' ? pack.data : new TextDecoder().decode(pack.data);
          new Function('API', code)(window.NUCRAFT_MOD_API);
          stats.script = 1;
        } else if (pack.format === 'nucraft-json') {
          const obj = JSON.parse(stripJsonComments(typeof pack.data === 'string' ? pack.data : new TextDecoder().decode(pack.data)));
          if (Array.isArray(obj.recipes)) for (const r of obj.recipes) if (window.NUCRAFT_MOD_API.registerRecipe({
            out: resolveMcItemId(r.out), qty: r.qty || 1,
            req: (r.req || []).map(x => ({ id: resolveMcItemId(x.id), qty: x.qty || 1 })).filter(x => x.id > 0),
            grid: (r.grid || [0,0,0,0,0,0,0,0,0]).map(resolveMcItemId)
          })) stats.recipe++;
          if (obj.blockPatches) for (const [bk, bp] of Object.entries(obj.blockPatches)) if (window.NUCRAFT_MOD_API.patchBlock(bk, bp)) stats.mob++;
          if (obj.mobPatches) for (const [mk, mp] of Object.entries(obj.mobPatches)) if (window.NUCRAFT_MOD_API.patchMob(mk, mp)) stats.mob++;
        } else {
          const entries = await unzipEntries(pack.data);
          let hasGeoOrJar = false;
          const packTexAliases = new Map();
          for (const [p, b] of entries.entries()) {
            const lp = p.toLowerCase();
            if (/\/?(terrain|item)_texture\.json$/i.test(lp)) _parseBedrockTexMapJson(b, packTexAliases);
          }
          for (const [path, bytes] of entries.entries()) {
            const low = path.toLowerCase();
            if (/\.jar$|\.geo\.json$/i.test(low)) { hasGeoOrJar = true; continue; }
            if (/\.(png|webp|tga)$/i.test(low) && (/textures\//i.test(low))) {
              const noExt = low.replace(/\.(png|webp|tga)$/i, '');
              const relTexIdx = noExt.indexOf('textures/');
              const relTex = relTexIdx >= 0 ? noExt.slice(relTexIdx) : noExt;
              const rawStem = noExt.split('/').pop();
              const isItemFolder = /\/items?\//i.test(low);
              const aliasStem = packTexAliases.get(relTex) || packTexAliases.get(rawStem) || null;
              const targets = dynReg.get(rawStem) || (aliasStem ? dynReg.get(aliasStem) : null) || null;
              if (targets && targets.length) {
                try {
                  const mime = low.endsWith('.webp') ? 'image/webp' : (low.endsWith('.tga') ? 'image/x-tga' : 'image/png');
                  const im = await decodeImageFromBytes(bytes, mime);
                  const drawnTiles = new Set();
                  for (const tgt of targets) {
                    if (!isItemFolder || !tgt.mcItemKey) {
                      for (const tIdx of tgt.tiles) {
                        if (!drawnTiles.has(tIdx) && drawPngTileOnAtlas(tIdx, im)) {
                          drawnTiles.add(tIdx);
                          stats.tex++;
                        }
                      }
                    }
                    if (tgt.mcItemKey && (isItemFolder || targets.length === 1)) {
                      modItemOverrides.set(tgt.mcItemKey, im);
                      if (isItemFolder) stats.tex++;
                    }
                    if (!isItemFolder && tgt.mcTexKeys) {
                      for (const mtk of tgt.mcTexKeys) modTexOverrides.set(mtk, im);
                    }
                  }
                } catch (_) {}
              }
            } else if (/\.json$/i.test(low)) {
              try {
                const jObj = JSON.parse(stripJsonComments(new TextDecoder().decode(bytes)));
                if (/(^|\/)recipes?\//i.test(low)) stats.recipe += registerShapedOrShapelessRecipe(jObj);
                else if (/(^|\/)entities\//i.test(low)) stats.mob += applyEntityJsonPatch(jObj);
                else if (/(^|\/)(blocks?|items?)\//i.test(low)) stats.mob += applyBlockOrItemJsonPatch(jObj);
              } catch (_) {}
            } else if (/\.js$/i.test(low) && (/(^|\/)scripts\//i.test(low) || /(^|\/)nucraft_mod\.js$/i.test(low)) && pack.scriptsAllowed) {
              try {
                const code = new TextDecoder().decode(bytes);
                new Function('API', code)(window.NUCRAFT_MOD_API);
                stats.script++;
              } catch (e) { console.error('[ModZipJS]', e); }
            } else if (/\.(ogg|mp3|wav)$/i.test(low)) {
              const sTargets = _collectSoundTargets(low);
              for (const sk of sTargets) {
                let arr = _modSoundEntries.get(sk);
                if (!arr) { arr = []; _modSoundEntries.set(sk, arr); }
                arr.push({ bytes, buf: null, decoding: false });
              }
              const sKey = low.split('/').pop().replace(/\.(ogg|mp3|wav)$/i, '');
              if (typeof audioCtx !== 'undefined' && audioCtx) {
                try {
                  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                  const buf = await audioCtx.decodeAudioData(ab);
                  for (const sk of sTargets) {
                    const arr = _modSoundEntries.get(sk);
                    if (arr && arr.length) arr[arr.length - 1].buf = buf;
                  }
                  if (typeof luantiBuffers !== 'undefined') {
                    if (!_baseSoundBackup.has(sKey)) _baseSoundBackup.set(sKey, luantiBuffers.get(sKey) || null);
                    luantiBuffers.set(sKey, buf);
                  }
                } catch (_) {}
              }
              stats.sound++;
            }
          }
          if (hasGeoOrJar) stats.warn.push('Bỏ qua file mô hình xương (.jar/.geo.json), đã nạp phần tương thích.');
        }
        const partsNote = [];
        if (stats.tex) partsNote.push(`${stats.tex} hình ảnh`);
        if (stats.recipe) partsNote.push(`${stats.recipe} công thức`);
        if (stats.sound) partsNote.push(`${stats.sound} âm thanh`);
        if (stats.mob) partsNote.push(`${stats.mob} mob/khối`);
        if (stats.script) partsNote.push(`Script ✓`);
        pack.runtimeNote = partsNote.length ? partsNote.join(' • ') : 'Đã nạp sẵn sàng';
        pack.warnings = stats.warn;
      } catch (err) {
        pack.enabled = false;
        pack.runtimeNote = `⚠️ Lỗi khi nạp mod (đã tự tắt an toàn): ${err.message || err}`;
        console.error('[ModManager]', err);
      }
    }
    if (typeof window._setModMcOverrides === 'function') window._setModMcOverrides(modItemOverrides, modTexOverrides);
    refreshWorldVisualsAfterMods();
    renderModManagerList();
    const cartoonActive = _installedMods.some(m => m.id === 'builtin_cartoon_barebones' && m.enabled);
    if (typeof window.syncCartoonExclusiveShaderUI === 'function') window.syncCartoonExclusiveShaderUI(cartoonActive);
    if (!_isImportingAccountMods && typeof window.scheduleAccountCloudSync === 'function') window.scheduleAccountCloudSync();
  }
  let _isImportingAccountMods = false;
  function _u8ToB64(u8) {
    let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function _b64ToU8(b64) {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  window.exportModsForAccountSync = () => _installedMods.map(m => {
    if (m.format === 'builtin-cartoon') {
      return { id: m.id, name: m.name, format: m.format, description: m.description, enabled: !!m.enabled, size: m.size || 4096, installedAt: m.installedAt || 0 };
    }
    const base = { id: m.id, name: m.name, fileName: m.fileName, version: m.version, format: m.format, description: m.description, enabled: !!m.enabled, size: m.size || 0, installedAt: m.installedAt || 0 };
    if (typeof m.data === 'string' && m.data.length <= 48000) base.dataStr = m.data;
    else if (m.data instanceof Uint8Array && m.data.byteLength <= 36000) base.dataB64 = _u8ToB64(m.data);
    else base.oversized = true;
    return base;
  });
  window.importModsFromAccountSync = async (arr) => {
    if (!Array.isArray(arr)) return;
    _isImportingAccountMods = true;
    try {
      const curIds = _installedMods.map(m => m.id);
      for (const id of curIds) if (id !== 'builtin_cartoon_barebones') await dbDeleteMod(id);
      const next = [];
      let cartoonEnabled = false;
      for (const item of arr) {
        if (!item || !item.id) continue;
        if (item.id === 'builtin_cartoon_barebones') { cartoonEnabled = !!item.enabled; continue; }
        const rec = {
          id: item.id, name: item.name || 'Mod', fileName: item.fileName || '', version: item.version || '1.0',
          format: item.format || 'nucraft-json', description: item.description || '', enabled: !!item.enabled,
          size: item.size || 0, installedAt: item.installedAt || Date.now(), runtimeNote: '', warnings: [],
          data: item.dataStr !== undefined ? item.dataStr : (item.dataB64 ? _b64ToU8(item.dataB64) : undefined)
        };
        if (rec.data === undefined) { rec.enabled = false; rec.runtimeNote = '⚠️ File >48KB cần cài lại thủ công trên thiết bị mới'; }
        next.push(rec);
        await dbPutMod(rec);
      }
      const defC = _installedMods.find(m => m.id === 'builtin_cartoon_barebones') || {
        id: 'builtin_cartoon_barebones',
        name: '🎨 Đồ Họa Hoạt Hình (Bare Bones Cartoon)',
        format: 'builtin-cartoon',
        description: 'Gói đồ họa Hoạt Hình (Bare Bones) tối ưu siêu nhẹ cho máy yếu: texture phẳng gọn, bỏ bump/bóng lá/phản chiếu nặng giúp tăng FPS tối đa.',
        size: 4096,
        enabled: false,
        installedAt: Date.now() - 1000
      };
      defC.description = 'Gói đồ họa Hoạt Hình (Bare Bones) tối ưu siêu nhẹ cho máy yếu: texture phẳng gọn, bỏ bump/bóng lá/phản chiếu nặng giúp tăng FPS tối đa.';
      defC.enabled = cartoonEnabled;
      next.unshift(defC);
      await dbPutMod(defC);
      _installedMods = next;
      await applyAllEnabledMods();
    } finally {
      _isImportingAccountMods = false;
    }
  };

  function _escMod(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderModManagerList() {
    const _t = (v, e) => (typeof tr === 'function' ? tr(v, e) : v);
    const cntEl = document.getElementById('lobbyModCount');
    if (cntEl) cntEl.textContent = String(_installedMods.filter(m => m.enabled).length);
    const cartoonBtn = document.getElementById('btnInstallCartoonAddon');
    if (cartoonBtn) {
      const activeC = _installedMods.some(m => m.id === 'builtin_cartoon_barebones' && m.enabled);
      cartoonBtn.textContent = activeC ? _t('🎨 Hoạt Hình: BẬT', '🎨 Cartoon: ON') : _t('🎨 Hoạt Hình', '🎨 Cartoon');
    }
    const listEl = document.getElementById('modListContainer');
    if (!listEl) return;
    if (!_installedMods.length) {
      listEl.innerHTML = `<div class="mod-empty-msg">${_t('Chưa có Mod hoặc Add-on nào. Bấm <b>+ Thêm Mod</b> hoặc <b>✨ Gói Mẫu</b> để cài!', 'No Mods installed yet. Click <b>+ Add Mod</b> or <b>✨ Sample</b> above!')}</div>`;
      return;
    }
    listEl.innerHTML = '';
    for (const pack of _installedMods) {
      const card = document.createElement('div');
      card.className = 'mod-card' + (pack.enabled ? ' enabled' : '');
      const kb = Math.max(1, Math.round((pack.size || 0) / 1024));
      card.innerHTML = `
        <div class="mod-card-info">
          <div class="mod-card-title">
            <span class="mod-badge">${_escMod(String(pack.format || '').toUpperCase())}</span>
            <span>${_escMod(pack.name || pack.fileName)}</span>
            <small style="color:#e2e8f0;font-weight:600;font-size:12px;">v${_escMod(pack.version || '1.0')} • ${kb}KB</small>
          </div>
          <div class="mod-card-desc">${_escMod(pack.description || _t('Gói mở rộng NUCRAFT / Voxel Add-on', 'NUCRAFT / Voxel Add-on Pack'))}</div>
          <div class="mod-card-meta">${_escMod(pack.runtimeNote || _t('Sẵn sàng áp dụng', 'Ready to apply'))}${(pack.warnings && pack.warnings.length) ? ' • ⚠️ ' + _escMod(pack.warnings[0]) : ''}</div>
        </div>
      `;
      const acts = document.createElement('div');
      acts.className = 'mod-card-actions';
      const btnTog = document.createElement('button');
      btnTog.type = 'button';
      btnTog.className = 'mc-java-btn ' + (pack.enabled ? 'mc-java-green' : '');
      btnTog.textContent = pack.enabled ? _t('ĐANG BẬT', 'ENABLED') : _t('ĐANG TẮT', 'DISABLED');
      btnTog.addEventListener('click', async () => {
        pack.enabled = !pack.enabled;
        await dbPutMod(pack);
        await applyAllEnabledMods();
      });
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'mc-btn mc-btn-red';
      btnDel.textContent = _t('🗑 Xóa', '🗑 Delete');
      btnDel.addEventListener('click', async () => {
        _installedMods = _installedMods.filter(m => m.id !== pack.id);
        await dbDeleteMod(pack.id);
        await applyAllEnabledMods();
      });
      acts.append(btnTog, btnDel);
      card.appendChild(acts);
      listEl.appendChild(card);
    }
  }

  async function installModBytes(fileName, bytesOrText) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    let format = ext;
    if (ext === 'js') format = 'nucraft-js';
    else if (ext === 'json') format = 'nucraft-json';
    else if (ext !== 'mcpack' && ext !== 'mcaddon' && ext !== 'zip') throw new Error('Định dạng không hỗ trợ: .' + ext);

    let name = fileName.replace(/\.(mcpack|mcaddon|zip|json|js)$/i, '');
    let description = 'Add-on / Mod từ máy người chơi';
    let version = '1.0';
    let stored = bytesOrText;
    let scriptsAllowed = false;

    if (format === 'nucraft-json') {
      const txt = typeof bytesOrText === 'string' ? bytesOrText : new TextDecoder().decode(bytesOrText);
      const parsed = JSON.parse(stripJsonComments(txt));
      if (parsed.name) name = String(parsed.name).slice(0, 48);
      if (parsed.description) description = String(parsed.description).slice(0, 140);
      if (parsed.version) version = String(parsed.version);
      stored = txt;
    } else if (format === 'nucraft-js') {
      const okMsg = (typeof tr === 'function')
        ? tr(
            `⚠️ Mod "${name}.js" chứa mã JavaScript chạy trực tiếp trong trình duyệt.\nChỉ cài đặt script từ nguồn bạn tin tưởng!\n\nTiếp tục cài "${name}.js"?`,
            `⚠️ Mod "${name}.js" contains JavaScript code that runs in your browser.\nOnly install scripts you trust!\n\nContinue installing "${name}.js"?`
          )
        : `Install local JS mod "${name}.js"? Only install scripts you trust.`;
      if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(okMsg)) return;
      const txt = typeof bytesOrText === 'string' ? bytesOrText : new TextDecoder().decode(bytesOrText);
      stored = txt;
      scriptsAllowed = true;
    } else {
      const u8 = bytesOrText instanceof Uint8Array ? bytesOrText : new Uint8Array(bytesOrText);
      if (u8.byteLength > MAX_MOD_BYTES) throw new Error('File vượt quá 64MB');
      const entries = await unzipEntries(u8);
      let hasScript = false;
      for (const [p, v] of entries.entries()) {
        if (/\.js$/i.test(p) && (/(^|\/)scripts\//i.test(p) || /(^|\/)nucraft_mod\.js$/i.test(p))) hasScript = true;
        if (/(^|\/)manifest\.json$/i.test(p)) {
          try {
            const mf = JSON.parse(stripJsonComments(new TextDecoder().decode(v)));
            if (mf.header && mf.header.name) name = String(mf.header.name).replace(/§./g, '').slice(0, 48);
            if (mf.header && mf.header.description) description = String(mf.header.description).replace(/§./g, '').slice(0, 140);
            if (mf.header && Array.isArray(mf.header.version)) version = mf.header.version.join('.');
          } catch (_) {}
        } else if (/(^|\/)pack\.mcmeta$/i.test(p)) {
          try {
            const pm = JSON.parse(stripJsonComments(new TextDecoder().decode(v)));
            if (pm.pack && pm.pack.description) description = String(pm.pack.description).replace(/§./g, '').slice(0, 140);
          } catch (_) {}
        }
      }
      if (hasScript && typeof window !== 'undefined' && typeof window.confirm === 'function') {
        scriptsAllowed = !!window.confirm(`⚠️ Gói "${name}" có kèm file script .js. Chỉ bật script nếu bạn tin tưởng nguồn tải!\nCho phép chạy script trong gói này?`);
      }
      stored = u8;
    }

    const rec = {
      id: 'mod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name, description, version, format, enabled: true, fileName, scriptsAllowed,
      size: typeof stored === 'string' ? stored.length : stored.byteLength,
      installedAt: Date.now(), runtimeNote: '', warnings: [], data: stored
    };
    _installedMods.unshift(rec);
    await dbPutMod(rec);
    await applyAllEnabledMods();
    if (typeof showToast === 'function') showToast(`🧩 Đã cài đặt "${rec.name}"!`);
    return rec;
  }

  async function installSampleMcpackAddon() {
    // Build a real in-memory .mcpack ZIP with custom golden-emerald ore texture + Golden Wheat Bread recipe
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    c.fillStyle = '#475569'; c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#facc15'; c.fillRect(3, 3, 4, 4); c.fillRect(9, 8, 5, 5);
    c.fillStyle = '#22d3ee'; c.fillRect(4, 4, 2, 2); c.fillRect(10, 9, 3, 3);
    const pngBytes = await new Promise((res) => cv.toBlob((bl) => bl.arrayBuffer().then(ab => res(new Uint8Array(ab))), 'image/png'));
    const entries = new Map();
    entries.set('manifest.json', JSON.stringify({
      format_version: 2,
      header: { name: 'NUCRAFT Sample Add-on', description: 'Gói Add-on .mcpack mẫu: Quặng Kim Cương Hoàng Kim + Công thức Bánh Mì Vàng', version: [1, 0, 5] }
    }));
    entries.set('textures/blocks/diamond_ore.png', pngBytes);
    entries.set('recipes/golden_wheat_bread.json', JSON.stringify({
      format_version: '1.12',
      'minecraft:recipe_shaped': {
        pattern: ['WGW'],
        key: { W: 'minecraft:wheat', G: 'minecraft:gold_ingot' },
        result: { item: 'minecraft:bread', count: 3 }
      }
    }));
    const zipBytes = buildStoreZip(entries);
    return installModBytes('nucraft_sample_addon.mcpack', zipBytes);
  }

  async function initModManager() {
    const pickBtn = document.getElementById('btnPickModFile');
    const inp = document.getElementById('inpModFile');
    const sampleBtn = document.getElementById('btnInstallSampleMod');
    const cartoonBtn = document.getElementById('btnInstallCartoonAddon');
    const drop = document.getElementById('modDropZone');
    const handleFiles = async (fileList) => {
      for (const f of Array.from(fileList || [])) {
        try {
          const isTxt = /\.(js|json)$/i.test(f.name);
          const payload = isTxt ? await f.text() : new Uint8Array(await f.arrayBuffer());
          await installModBytes(f.name, payload);
        } catch (err) {
          if (typeof showToast === 'function') showToast(`❌ Không thể nạp ${f.name}: ${err.message || err}`);
        }
      }
    };
    pickBtn?.addEventListener('click', () => inp?.click());
    inp?.addEventListener('change', (e) => { handleFiles(e.target.files); inp.value = ''; });
    sampleBtn?.addEventListener('click', () => installSampleMcpackAddon().catch(err => console.error(err)));
    const toggleCartoonBareBonesAddon = async (forceEnable = null) => {
      let pack = _installedMods.find(m => m.id === 'builtin_cartoon_barebones');
      if (!pack) {
        pack = {
          id: 'builtin_cartoon_barebones',
          name: '🎨 Đồ Họa Hoạt Hình (Bare Bones Cartoon)',
          format: 'builtin-cartoon',
          description: 'Gói đồ họa Hoạt Hình (Bare Bones) tối ưu siêu nhẹ cho máy yếu: texture phẳng gọn, bỏ bump/bóng lá/phản chiếu nặng giúp tăng FPS tối đa.',
          size: 4096,
          enabled: true,
          installedAt: Date.now()
        };
        _installedMods.unshift(pack);
      } else {
        pack.enabled = (forceEnable !== null) ? !!forceEnable : !pack.enabled;
      }
      await dbPutMod(pack);
      await applyAllEnabledMods();
      if (cartoonBtn) {
        const _t = (v, e) => (typeof tr === 'function' ? tr(v, e) : v);
        cartoonBtn.textContent = pack.enabled ? _t('🎨 Hoạt Hình: BẬT', '🎨 Cartoon: ON') : _t('🎨 Hoạt Hình', '🎨 Cartoon');
      }
      if (typeof showToast === 'function') {
        showToast(pack.enabled ? '🎨 Đã BẬT Add-on Đồ Họa Hoạt Hình (Bare Bones)!' : '🧩 Đã TẮT Add-on Đồ Họa Hoạt Hình — khôi phục đồ họa gốc!');
      }
      return pack.enabled;
    };
    cartoonBtn?.addEventListener('click', () => toggleCartoonBareBonesAddon(null).catch(err => console.error(err)));
    if (drop) {
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('dragover'); handleFiles(e.dataTransfer?.files); });
    }
    _installedMods = await dbGetAllMods();
    const existingCartoon = _installedMods.find(m => m.id === 'builtin_cartoon_barebones');
    if (existingCartoon) {
      existingCartoon.description = 'Gói đồ họa Hoạt Hình (Bare Bones) tối ưu siêu nhẹ cho máy yếu: texture phẳng gọn, bỏ bump/bóng lá/phản chiếu nặng giúp tăng FPS tối đa.';
    } else {
      const defCartoon = {
        id: 'builtin_cartoon_barebones',
        name: '🎨 Đồ Họa Hoạt Hình (Bare Bones Cartoon)',
        format: 'builtin-cartoon',
        description: 'Gói đồ họa Hoạt Hình (Bare Bones) tối ưu siêu nhẹ cho máy yếu: texture phẳng gọn, bỏ bump/bóng lá/phản chiếu nặng giúp tăng FPS tối đa.',
        size: 4096,
        enabled: false,
        installedAt: Date.now() - 1000
      };
      _installedMods.push(defCartoon);
      await dbPutMod(defCartoon);
    }
    _installedMods.sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));
    if (cartoonBtn) {
      const activeC = _installedMods.some(m => m.id === 'builtin_cartoon_barebones' && m.enabled);
      const _t = (v, e) => (typeof tr === 'function' ? tr(v, e) : v);
      cartoonBtn.textContent = activeC ? _t('🎨 Hoạt Hình: BẬT', '🎨 Cartoon: ON') : _t('🎨 Hoạt Hình', '🎨 Cartoon');
    }
    if (_installedMods.some(m => m.enabled)) await applyAllEnabledMods();
    else renderModManagerList();
    window.toggleCartoonBareBonesAddon = toggleCartoonBareBonesAddon;
  }
  window.initModManager = initModManager;
  window.renderModManagerList = renderModManagerList;
  window.installModBytes = installModBytes;
  window.installSampleMcpackAddon = installSampleMcpackAddon;
