// NUCRAFT Module: src/data/items.js — Items, crafting/smelting recipes, armor trims & texture atlas

  // Furnace Smelting Recipes (Output, Kind: 'ore'|'food'|'misc', Exact Wiki cookTime in sec [Blast/Smoker = 0.5x], XP)
  // Note: DIAMOND_ORE is NOT smeltable (always mines directly into Diamond!). Ancient Debris smelts -> Netherite Scrap (2.0 XP).
  const SMELT_RECIPES = {
    [B.RAW_IRON]:       { out: B.IRON_INGOT,      kind: 'ore',  xp: 4,  cookTime: 10.0 },
    [B.RAW_GOLD]:       { out: B.GOLD_INGOT,      kind: 'ore',  xp: 6,  cookTime: 10.0 },
    [B.RAW_COPPER]:     { out: B.COPPER_INGOT,    kind: 'ore',  xp: 4,  cookTime: 10.0 },
    [B.IRON_ORE]:       { out: B.IRON_INGOT,      kind: 'ore',  xp: 4,  cookTime: 10.0 },
    [B.GOLD_ORE]:       { out: B.GOLD_INGOT,      kind: 'ore',  xp: 6,  cookTime: 10.0 },
    [B.COPPER_ORE]:     { out: B.COPPER_INGOT,    kind: 'ore',  xp: 4,  cookTime: 10.0 },
    [B.TIN_ORE]:        { out: B.IRON_INGOT,      kind: 'ore',  xp: 0,  cookTime: 10.0 },
    [B.REDSTONE_ORE]:   { out: B.REDSTONE,        kind: 'ore',  xp: 0,  cookTime: 8.0 },
    [B.ANCIENT_DEBRIS]: { out: B.NETHERITE_SCRAP, kind: 'ore',  xp: 12, cookTime: 10.0 },
    // Exclusive high-tier Sift/Dream ores scale logically above Ancient Debris (half in Blast Furnace)
    [B.MOONSTONE_ORE]:  { out: B.MOONSTONE_GEM,   kind: 'ore',  xp: 14, cookTime: 12.0 },
    [B.ICHOR_ORE]:      { out: B.ICHOR_CRYSTAL,   kind: 'ore',  xp: 16, cookTime: 13.0 },
    [B.NEBULA_ORE]:     { out: B.NEBULA_INGOT,    kind: 'ore',  xp: 18, cookTime: 14.0 },
    [B.AETHERIUM_ORE]:  { out: B.AETHERIUM_INGOT, kind: 'ore',  xp: 20, cookTime: 15.0 },
    [B.DREAM_PRISM_ORE]:{ out: B.DREAM_PRISM_GEM, kind: 'ore',  xp: 24, cookTime: 16.0 },
    [B.STONE]:          { out: B.SMOOTH_STONE,    kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.SAND]:           { out: B.GLASS,           kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.RAW_FISH]:       { out: B.COOKED_FISH,     kind: 'food', xp: 3,  cookTime: 10.0 },
    [B.RAW_BEEF]:       { out: B.COOKED_BEEF,     kind: 'food', xp: 4,  cookTime: 10.0 },
    [B.RAW_PORK]:       { out: B.COOKED_PORK,     kind: 'food', xp: 4,  cookTime: 10.0 },
    [B.RAW_CHICKEN]:    { out: B.COOKED_CHICKEN,  kind: 'food', xp: 3,  cookTime: 10.0 },
    [B.RAW_MUTTON]:     { out: B.COOKED_MUTTON,   kind: 'food', xp: 4,  cookTime: 10.0 },
    [B.RAW_RABBIT]:     { out: B.COOKED_RABBIT,   kind: 'food', xp: 3,  cookTime: 10.0 },
    [B.RAW_SALMON]:     { out: B.COOKED_SALMON,   kind: 'food', xp: 4,  cookTime: 10.0 },
    [B.POTATO]:         { out: B.BAKED_POTATO,    kind: 'food', xp: 3,  cookTime: 10.0 },
    // All Overworld tree logs smelt into Charcoal (Than Củi)
    [B.OAK_LOG]:        { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.SPRUCE_LOG]:     { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.BIRCH_LOG]:      { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.SAKURA_LOG]:     { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.ACACIA_LOG]:     { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.PALM_LOG]:       { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.MANGROVE_LOG]:   { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 },
    [B.AZURE_LOG]:      { out: B.CHARCOAL,        kind: 'misc', xp: 2,  cookTime: 10.0 }
  };
  // Exact Minecraft Wiki Fuel Burn Seconds (10s = 1 item in standard Furnace; Blast/Smoker burns 2x faster)
  const FUEL_VALUES = {
    [B.LAVA_BUCKET]: 1000, [B.BLAZE_ROD]: 120, [B.COAL]: 80, [B.CHARCOAL]: 80,
    [B.OAK_LOG]: 15, [B.SPRUCE_LOG]: 15, [B.BIRCH_LOG]: 15, [B.SAKURA_LOG]: 15,
    [B.ACACIA_LOG]: 15, [B.PALM_LOG]: 15, [B.MANGROVE_LOG]: 15, [B.AZURE_LOG]: 15,
    [B.PLANKS]: 15, [B.AZURE_PLANKS]: 15, [B.BAMBOO_PLANKS]: 15, [B.BAMBOO_BLOCK]: 15,
    [B.CRAFT_TABLE]: 15, [B.SMITHING_TABLE]: 15, [B.CHEST]: 15, [B.BOOKSHELF]: 15,
    [B.OAK_FENCE]: 15, [B.SPRUCE_FENCE]: 15, [B.BIRCH_FENCE]: 15, [B.SAKURA_FENCE]: 15, [B.BAMBOO_FENCE]: 15,
    [B.WOOD_PICK]: 10, [B.WOOD_SWORD]: 10, [B.WOOD_AXE]: 10, [B.WOOD_HOE]: 10, [B.BOAT_ITEM]: 10, [B.FISHING_ROD]: 10, [B.BOW]: 10,
    [B.OAK_DOOR]: 10, [B.SPRUCE_DOOR]: 10, [B.BIRCH_DOOR]: 10, [B.BAMBOO_DOOR]: 10,
    [B.OAK_TRAPDOOR]: 15, [B.SPRUCE_TRAPDOOR]: 15, [B.SAKURA_TRAPDOOR]: 15,
    [B.STICK]: 5, [B.WHITE_WOOL]: 5, [B.BAMBOO]: 2.5
  };
  // Colored wools (5s) + wooden slabs (7.5s = 0.75 items per Minecraft Wiki; Crimson/Warped/Petrified = 0)
  for (const e of _DYN_COLORED_ENTRIES) if (e.kind === 'wool') FUEL_VALUES[e.id] = 5;
  for (const s of SLAB_SPECS) if (s.fuel > 0) FUEL_VALUES[s.botId] = s.fuel;

  const RECIPES = [
    // ===================== CORE ESSENTIALS (2x2 BACKPACK RECIPES MARKED is2x2: true!) =====================
    { cat: 'blocks', is2x2: true, out: B.PLANKS,          qty: 4, req: [{ anyLog: true, qty: 1 }], grid: [0,0,0, 0,B.OAK_LOG,0, 0,0,0] },
    { cat: 'misc',   is2x2: true, out: B.STICK,           qty: 4, req: [{ id: B.PLANKS, qty: 2 }], grid: [0,0,0, 0,B.PLANKS,0, 0,B.PLANKS,0] },
    { cat: 'misc',   is2x2: true, out: B.STICK,           qty: 2, req: [{ id: B.BAMBOO, qty: 2 }], grid: [0,0,0, 0,B.BAMBOO,0, 0,B.BAMBOO,0] },
    { cat: 'food',   is2x2: true, out: B.COOKIE,          qty: 4, req: [{ id: B.WHEAT, qty: 2 }, { id: B.SWEET_BERRIES, qty: 1 }], grid: [0,0,0, B.WHEAT,B.SWEET_BERRIES,B.WHEAT, 0,0,0] },
    { cat: 'food',                out: B.GOLDEN_CARROT,   qty: 1, req: [{ id: B.CARROT, qty: 1 }, { id: B.GOLD_INGOT, qty: 1 }], grid: [0,B.GOLD_INGOT,0, B.GOLD_INGOT,B.CARROT,B.GOLD_INGOT, 0,B.GOLD_INGOT,0] },
    { cat: 'food',                out: B.PUMPKIN_PIE,     qty: 1, req: [{ id: B.WHEAT, qty: 2 }, { id: B.APPLE, qty: 1 }], grid: [0,0,0, B.WHEAT,B.APPLE,B.WHEAT, 0,0,0] },
    { cat: 'food',                out: B.CAKE_ITEM,       qty: 1, req: [{ id: B.WHEAT, qty: 3 }, { id: B.SWEET_BERRIES, qty: 2 }], grid: [B.SWEET_BERRIES,B.SWEET_BERRIES,0, B.WHEAT,B.WHEAT,B.WHEAT, 0,0,0] },
    { cat: 'misc',   is2x2: true, out: B.CRAFT_TABLE,     qty: 1, req: [{ id: B.PLANKS, qty: 4 }], grid: [B.PLANKS,B.PLANKS,0, B.PLANKS,B.PLANKS,0, 0,0,0] },
    { cat: 'misc',   is2x2: true, out: B.TORCH_BLOCK,     qty: 4, req: [{ anyCoal: true, qty: 1 }, { id: B.STICK, qty: 1 }], grid: [0,B.COAL,0, 0,B.STICK,0, 0,0,0] },
    { cat: 'blocks', is2x2: true, out: B.BAMBOO_PLANKS,   qty: 2, req: [{ id: B.BAMBOO_BLOCK, qty: 1 }], grid: [0,0,0, 0,B.BAMBOO_BLOCK,0, 0,0,0] },
    { cat: 'blocks', is2x2: true, out: B.BAMBOO_SHOOT,    qty: 2, req: [{ id: B.BAMBOO, qty: 1 }], grid: [0,0,0, 0,B.BAMBOO,0, 0,0,0] },
    { cat: 'food',   is2x2: true, out: B.MELON_SLICE,     qty: 4, req: [{ id: B.MELON_BLOCK, qty: 1 }], grid: [0,0,0, 0,B.MELON_BLOCK,0, 0,0,0] },
    { cat: 'blocks', is2x2: true, out: B.IRON_TRAPDOOR,   qty: 1, req: [{ id: B.IRON_INGOT, qty: 4 }], grid: [B.IRON_INGOT,B.IRON_INGOT,0, B.IRON_INGOT,B.IRON_INGOT,0, 0,0,0] },
    { cat: 'blocks', is2x2: true, out: B.MOSS_BLOCK,      qty: 4, req: [{ id: B.TALL_GRASS, qty: 2 }, { id: B.DIRT, qty: 2 }], grid: [B.TALL_GRASS,B.TALL_GRASS,0, B.DIRT,B.DIRT,0, 0,0,0] },
    { cat: 'blocks', is2x2: true, out: B.AZURE_PLANKS,    qty: 4, req: [{ id: B.AZURE_LOG, qty: 1 }], grid: [0,0,0, 0,B.AZURE_LOG,0, 0,0,0] },
    // ===================== 3x3 CRAFTING TABLE RECIPES (FURNACES, CHESTS, DOORS, TRAPDOORS, TOOLS & ARMOR!) =====================
    { cat: 'misc',   out: B.FURNACE,         qty: 1, req: [{ id: B.STONE, qty: 8 }],  grid: [B.STONE,B.STONE,B.STONE, B.STONE,0,B.STONE, B.STONE,B.STONE,B.STONE] },
    { cat: 'misc',   out: B.BLAST_FURNACE,   qty: 1, req: [{ id: B.IRON_INGOT, qty: 5 }, { id: B.FURNACE, qty: 1 }, { id: B.SMOOTH_STONE, qty: 3 }], grid: [B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, B.IRON_INGOT,B.FURNACE,B.IRON_INGOT, B.SMOOTH_STONE,B.SMOOTH_STONE,B.SMOOTH_STONE] },
    { cat: 'misc',   out: B.SMOKER,          qty: 1, req: [{ anyLog: true, qty: 4 }, { id: B.FURNACE, qty: 1 }], grid: [0,B.OAK_LOG,0, B.OAK_LOG,B.FURNACE,B.OAK_LOG, 0,B.OAK_LOG,0] },
    { cat: 'misc',   out: B.CHEST,             qty: 1, req: [{ id: B.PLANKS, qty: 8 }], grid: [B.PLANKS,B.PLANKS,B.PLANKS, B.PLANKS,0,B.PLANKS, B.PLANKS,B.PLANKS,B.PLANKS] },
    { cat: 'misc',   out: B.COPPER_BOX_CHEST,  qty: 1, req: [{ id: B.COPPER_INGOT, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT, B.COPPER_INGOT,B.CHEST,B.COPPER_INGOT, B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT] },
    { cat: 'misc',   out: B.IRON_CHEST,        qty: 1, req: [{ id: B.IRON_INGOT, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, B.IRON_INGOT,B.CHEST,B.IRON_INGOT, B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT] },
    { cat: 'misc',   out: B.GOLD_CHEST,        qty: 1, req: [{ id: B.GOLD_INGOT, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.GOLD_INGOT,B.GOLD_INGOT,B.GOLD_INGOT, B.GOLD_INGOT,B.CHEST,B.GOLD_INGOT, B.GOLD_INGOT,B.GOLD_INGOT,B.GOLD_INGOT] },
    { cat: 'misc',   out: B.DIAMOND_CHEST,     qty: 1, req: [{ id: B.DIAMOND, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.DIAMOND,B.DIAMOND,B.DIAMOND, B.DIAMOND,B.CHEST,B.DIAMOND, B.DIAMOND,B.DIAMOND,B.DIAMOND] },
    { cat: 'misc',   out: B.EMERALD_BOX_CHEST, qty: 1, req: [{ id: B.EMERALD, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.EMERALD,B.EMERALD,B.EMERALD, B.EMERALD,B.CHEST,B.EMERALD, B.EMERALD,B.EMERALD,B.EMERALD] },
    { cat: 'misc',   out: B.RUBY_BOX_CHEST,    qty: 1, req: [{ id: B.RUBY, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.RUBY,B.RUBY,B.RUBY, B.RUBY,B.CHEST,B.RUBY, B.RUBY,B.RUBY,B.RUBY] },
    { cat: 'misc',   out: B.NETHERITE_CHEST,   qty: 1, req: [{ id: B.TITANIUM_INGOT, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.TITANIUM_INGOT,B.TITANIUM_INGOT,B.TITANIUM_INGOT, B.TITANIUM_INGOT,B.CHEST,B.TITANIUM_INGOT, B.TITANIUM_INGOT,B.TITANIUM_INGOT,B.TITANIUM_INGOT] },
    { cat: 'misc',   out: B.DREAM_BOX_CHEST,   qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 8 }, { id: B.CHEST, qty: 1 }], grid: [B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,B.CHEST,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM] },
    // 5 Authentic Doors (6 Planks/Ingots -> 3 Doors!) & 4 Authentic Trapdoors (6 Planks -> 2 Trapdoors!)
    { cat: 'blocks', out: B.OAK_DOOR,        qty: 3, req: [{ id: B.PLANKS, qty: 6 }], grid: [B.PLANKS,B.PLANKS,0, B.PLANKS,B.PLANKS,0, B.PLANKS,B.PLANKS,0] },
    { cat: 'blocks', out: B.OAK_STAIRS_N,    qty: 4, req: [{ id: B.PLANKS, qty: 6 }], grid: [B.PLANKS,B.PLANKS,0, B.PLANKS,B.PLANKS,B.PLANKS, 0,0,0] },
    { cat: 'blocks', out: B.STONE_STAIRS_N,  qty: 4, req: [{ id: B.STONE_BRICK, qty: 6 }], grid: [B.STONE_BRICK,B.STONE_BRICK,0, B.STONE_BRICK,B.STONE_BRICK,B.STONE_BRICK, 0,0,0] },
    { cat: 'blocks', out: B.TERRACOTTA_STAIRS_N, qty: 4, req: [{ id: B.TERRACOTTA, qty: 6 }], grid: [B.TERRACOTTA,B.TERRACOTTA,0, B.TERRACOTTA,B.TERRACOTTA,B.TERRACOTTA, 0,0,0] },
    { cat: 'blocks', out: B.DEEPSLATE_STAIRS_N, qty: 4, req: [{ id: B.DEEPSLATE, qty: 6 }], grid: [B.DEEPSLATE,B.DEEPSLATE,0, B.DEEPSLATE,B.DEEPSLATE,B.DEEPSLATE, 0,0,0] },
    { cat: 'blocks', out: B.SPRUCE_DOOR,     qty: 3, req: [{ id: B.SPRUCE_LOG, qty: 6 }], grid: [B.SPRUCE_LOG,B.SPRUCE_LOG,0, B.SPRUCE_LOG,B.SPRUCE_LOG,0, B.SPRUCE_LOG,B.SPRUCE_LOG,0] },
    { cat: 'blocks', out: B.BIRCH_DOOR,      qty: 3, req: [{ id: B.BIRCH_LOG, qty: 6 }], grid: [B.BIRCH_LOG,B.BIRCH_LOG,0, B.BIRCH_LOG,B.BIRCH_LOG,0, B.BIRCH_LOG,B.BIRCH_LOG,0] },
    { cat: 'blocks', out: B.BAMBOO_DOOR,     qty: 3, req: [{ id: B.BAMBOO_PLANKS, qty: 6 }], grid: [B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,0, B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,0, B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,0] },
    { cat: 'blocks', out: B.IRON_DOOR,       qty: 3, req: [{ id: B.IRON_INGOT, qty: 6 }], grid: [B.IRON_INGOT,B.IRON_INGOT,0, B.IRON_INGOT,B.IRON_INGOT,0, B.IRON_INGOT,B.IRON_INGOT,0] },
    { cat: 'blocks', out: B.OAK_TRAPDOOR,    qty: 2, req: [{ id: B.PLANKS, qty: 6 }], grid: [0,0,0, B.PLANKS,B.PLANKS,B.PLANKS, B.PLANKS,B.PLANKS,B.PLANKS] },
    { cat: 'blocks', out: B.SPRUCE_TRAPDOOR, qty: 2, req: [{ id: B.SPRUCE_LOG, qty: 6 }], grid: [0,0,0, B.SPRUCE_LOG,B.SPRUCE_LOG,B.SPRUCE_LOG, B.SPRUCE_LOG,B.SPRUCE_LOG,B.SPRUCE_LOG] },
    { cat: 'blocks', out: B.SAKURA_TRAPDOOR, qty: 2, req: [{ id: B.SAKURA_LOG, qty: 6 }], grid: [0,0,0, B.SAKURA_LOG,B.SAKURA_LOG,B.SAKURA_LOG, B.SAKURA_LOG,B.SAKURA_LOG,B.SAKURA_LOG] },
    { cat: 'food',   out: B.BREAD,           qty: 1, req: [{ id: B.WHEAT, qty: 3 }], grid: [0,0,0, B.WHEAT,B.WHEAT,B.WHEAT, 0,0,0] },
    { cat: 'blocks', out: B.HAY_BALE,        qty: 1, req: [{ id: B.WHEAT, qty: 9 }], grid: [B.WHEAT,B.WHEAT,B.WHEAT, B.WHEAT,B.WHEAT,B.WHEAT, B.WHEAT,B.WHEAT,B.WHEAT] },
    { cat: 'blocks', out: B.MELON_BLOCK,     qty: 1, req: [{ id: B.MELON_SLICE, qty: 9 }], grid: [B.MELON_SLICE,B.MELON_SLICE,B.MELON_SLICE, B.MELON_SLICE,B.MELON_SLICE,B.MELON_SLICE, B.MELON_SLICE,B.MELON_SLICE,B.MELON_SLICE] },
    { cat: 'tools',  out: B.IRON_PICK,       qty: 1, req: [{ id: B.IRON_INGOT, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.IRON_SWORD,      qty: 1, req: [{ id: B.IRON_INGOT, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.IRON_INGOT,0, 0,B.IRON_INGOT,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.COPPER_PICK,     qty: 1, req: [{ id: B.COPPER_INGOT, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'misc',   out: B.BUCKET,          qty: 1, req: [{ id: B.IRON_INGOT, qty: 3 }], grid: [0,0,0, B.IRON_INGOT,0,B.IRON_INGOT, 0,B.IRON_INGOT,0] },
    { cat: 'misc',   out: B.LANTERN,         qty: 2, req: [{ id: B.TORCH_BLOCK, qty: 1 }, { id: B.IRON_INGOT, qty: 2 }], grid: [0,B.IRON_INGOT,0, 0,B.TORCH_BLOCK,0, 0,B.IRON_INGOT,0] },
    { cat: 'misc',   out: B.CAMPFIRE,        qty: 1, req: [{ anyLog: true, qty: 3 }, { anyCoal: true, qty: 1 }, { id: B.STICK, qty: 3 }], grid: [0,B.STICK,0, B.STICK,B.COAL,B.STICK, B.OAK_LOG,B.OAK_LOG,B.OAK_LOG] },
    { cat: 'misc',   out: B.SMITHING_TABLE,  qty: 1, req: [{ id: B.IRON_INGOT, qty: 2 }, { id: B.PLANKS, qty: 4 }], grid: [B.IRON_INGOT,B.IRON_INGOT,0, B.PLANKS,B.PLANKS,0, B.PLANKS,B.PLANKS,0] },
    { cat: 'misc',   out: B.NETHERITE_INGOT, qty: 1, req: [{ id: B.NETHERITE_SCRAP, qty: 4 }, { id: B.GOLD_INGOT, qty: 4 }], grid: [B.NETHERITE_SCRAP,B.NETHERITE_SCRAP,B.NETHERITE_SCRAP, B.NETHERITE_SCRAP,B.GOLD_INGOT,B.GOLD_INGOT, B.GOLD_INGOT,B.GOLD_INGOT,0] },
    ...WOOL_COLORS.map(c => {
      const wid = B[c.woolKey], bid = B[c.bedKey];
      return { cat: 'misc', out: bid, qty: 1, req: [{ id: wid, qty: 3 }, { anyPlanks: true, id: B.PLANKS, qty: 3 }], grid: [wid, wid, wid, B.PLANKS, B.PLANKS, B.PLANKS, 0, 0, 0] };
    }),
    { cat: 'misc',   out: B.BOOKSHELF,       qty: 1, req: [{ id: B.PLANKS, qty: 6 }, { id: B.STICK, qty: 3 }], grid: [B.PLANKS,B.PLANKS,B.PLANKS, B.STICK,B.STICK,B.STICK, B.PLANKS,B.PLANKS,B.PLANKS] },
    { cat: 'misc',   out: B.ENCHANT_TABLE,   qty: 1, req: [{ id: B.OBSIDIAN, qty: 4 }, { id: B.DIAMOND, qty: 2 }, { id: B.BOOKSHELF, qty: 1 }], grid: [0,B.BOOKSHELF,0, B.DIAMOND,B.OBSIDIAN,B.DIAMOND, B.OBSIDIAN,B.OBSIDIAN,B.OBSIDIAN] },
    { cat: 'misc',   out: B.ANVIL,           qty: 1, req: [{ id: B.IRON_INGOT, qty: 7 }], grid: [B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, 0,B.IRON_INGOT,0, B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT] },
    { cat: 'misc',   out: B.TNT,             qty: 2, req: [{ id: B.GUNPOWDER, qty: 2 }, { id: B.SAND, qty: 2 }], grid: [B.GUNPOWDER,B.SAND,B.GUNPOWDER, B.SAND,0,B.SAND, 0,0,0] },
    { cat: 'misc',   out: B.ELEVATOR_BLOCK,  qty: 1, req: [{ id: B.IRON_INGOT, qty: 4 }, { id: B.GLOW_CRYSTAL, qty: 1 }], grid: [0,B.IRON_INGOT,0, B.IRON_INGOT,B.GLOW_CRYSTAL,B.IRON_INGOT, 0,B.IRON_INGOT,0] },
    { cat: 'misc',   out: B.SEA_LANTERN,     qty: 2, req: [{ id: B.PRISMARINE, qty: 4 }, { id: B.GLOW_CRYSTAL, qty: 1 }], grid: [0,B.PRISMARINE,0, B.PRISMARINE,B.GLOW_CRYSTAL,B.PRISMARINE, 0,B.PRISMARINE,0] },
    { cat: 'misc',   out: B.SHROOMLIGHT,     qty: 2, req: [{ id: B.MUSHROOM_GLOW, qty: 4 }, { id: B.TORCH_BLOCK, qty: 1 }], grid: [0,B.MUSHROOM_GLOW,0, B.MUSHROOM_GLOW,B.TORCH_BLOCK,B.MUSHROOM_GLOW, 0,B.MUSHROOM_GLOW,0] },
    { cat: 'misc',   out: B.GLOW_CRYSTAL,    qty: 2, req: [{ id: B.GLASS, qty: 2 }, { id: B.GOLD_INGOT, qty: 2 }], grid: [0,B.GOLD_INGOT,0, B.GLASS,0,B.GLASS, 0,B.GOLD_INGOT,0] },
    { cat: 'misc',   out: B.SLIME_BLOCK,     qty: 1, req: [{ id: B.MUSHROOM_GLOW, qty: 4 }], grid: [B.MUSHROOM_GLOW,B.MUSHROOM_GLOW,0, B.MUSHROOM_GLOW,B.MUSHROOM_GLOW,0, 0,0,0] },
    { cat: 'misc',   out: B.GUNPOWDER,       qty: 3, req: [{ id: B.COAL, qty: 2 }, { id: B.SAND, qty: 1 }], grid: [0,B.COAL,0, B.SAND,B.COAL,0, 0,0,0] },
    { cat: 'misc',   out: B.VOID_PEARL,      qty: 1, req: [{ id: B.EMERALD, qty: 1 }, { id: B.OBSIDIAN, qty: 2 }], grid: [0,B.OBSIDIAN,0, 0,B.EMERALD,0, 0,B.OBSIDIAN,0] },

    // TOOLS, WEAPONS & UTILITY
    { cat: 'tools',  out: B.WOOD_PICK,       qty: 1, req: [{ id: B.PLANKS, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.PLANKS,B.PLANKS,B.PLANKS, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.STONE_PICK,      qty: 1, req: [{ id: B.STONE, qty: 3 }, { id: B.STICK, qty: 2 }],  grid: [B.STONE,B.STONE,B.STONE, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DIAMOND_PICK,    qty: 1, req: [{ id: B.DIAMOND, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.DIAMOND,B.DIAMOND,B.DIAMOND, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.RUBY_PICK,       qty: 1, req: [{ id: B.RUBY, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.RUBY,B.RUBY,B.RUBY, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.WOOD_AXE,        qty: 1, req: [{ id: B.PLANKS, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.PLANKS,B.PLANKS,0, B.PLANKS,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.STONE_AXE,       qty: 1, req: [{ id: B.STONE, qty: 3 }, { id: B.STICK, qty: 2 }],  grid: [B.STONE,B.STONE,0, B.STONE,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.IRON_AXE,        qty: 1, req: [{ id: B.IRON_INGOT, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.IRON_INGOT,B.IRON_INGOT,0, B.IRON_INGOT,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DIAMOND_AXE,     qty: 1, req: [{ id: B.DIAMOND, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.DIAMOND,B.DIAMOND,0, B.DIAMOND,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.STONE_SHOVEL,    qty: 1, req: [{ id: B.STONE, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [0,B.STONE,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.IRON_SHOVEL,     qty: 1, req: [{ id: B.IRON_INGOT, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [0,B.IRON_INGOT,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DIAMOND_SHOVEL,  qty: 1, req: [{ id: B.DIAMOND, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [0,B.DIAMOND,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.WOOD_HOE,        qty: 1, req: [{ id: B.PLANKS, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [B.PLANKS,B.PLANKS,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.STONE_HOE,       qty: 1, req: [{ id: B.STONE, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [B.STONE,B.STONE,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.IRON_HOE,        qty: 1, req: [{ id: B.IRON_INGOT, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [B.IRON_INGOT,B.IRON_INGOT,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.GOLD_HOE,        qty: 1, req: [{ id: B.GOLD_INGOT, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [B.GOLD_INGOT,B.GOLD_INGOT,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DIAMOND_HOE,     qty: 1, req: [{ id: B.DIAMOND, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [B.DIAMOND,B.DIAMOND,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.WOOD_SWORD,      qty: 1, req: [{ id: B.PLANKS, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.PLANKS,0, 0,B.PLANKS,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.STONE_SWORD,     qty: 1, req: [{ id: B.STONE, qty: 2 }, { id: B.STICK, qty: 1 }],  grid: [0,B.STONE,0, 0,B.STONE,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DIAMOND_SWORD,   qty: 1, req: [{ id: B.DIAMOND, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.DIAMOND,0, 0,B.DIAMOND,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.RUBY_SWORD,      qty: 1, req: [{ id: B.RUBY, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.RUBY,0, 0,B.RUBY,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.FIRE_SWORD,      qty: 1, req: [{ id: B.DIAMOND_SWORD, qty: 1 }, { id: B.MAGMA_CORE, qty: 1 }], grid: [0,B.MAGMA_CORE,0, 0,B.DIAMOND_SWORD,0, 0,0,0] },
    { cat: 'tools',  out: B.BOW,             qty: 1, req: [{ id: B.STICK, qty: 3 }, { id: B.IRON_INGOT, qty: 1 }], grid: [0,B.STICK,B.IRON_INGOT, B.STICK,0,B.IRON_INGOT, 0,B.STICK,0] },
    { cat: 'tools',  out: B.ARROW,           qty: 6, req: [{ id: B.STICK, qty: 2 }, { id: B.STONE, qty: 1 }], grid: [0,B.STONE,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.SHIELD,          qty: 1, req: [{ id: B.PLANKS, qty: 6 }, { id: B.IRON_INGOT, qty: 1 }], grid: [B.PLANKS,B.IRON_INGOT,B.PLANKS, B.PLANKS,B.PLANKS,B.PLANKS, 0,B.PLANKS,0] },
    { cat: 'tools',  is2x2: true, out: B.SHEARS, qty: 1, req: [{ id: B.IRON_INGOT, qty: 2 }], grid: [0,0,0, 0,B.IRON_INGOT,0, B.IRON_INGOT,0,0] },
    // Phôi quặng tinh luyện (quái rơi ra) -> nén lại thành khối quặng để dùng cho mọi công thức hiện có
    { cat: 'tools',  out: B.FISHING_ROD,     qty: 1, req: [{ id: B.STICK, qty: 3 }, { id: B.IRON_INGOT, qty: 1 }], grid: [0,0,B.STICK, 0,B.STICK,B.IRON_INGOT, B.STICK,0,0] },
    { cat: 'tools',  out: B.BOAT_ITEM,       qty: 1, req: [{ id: B.PLANKS, qty: 5 }], grid: [0,0,0, B.PLANKS,0,B.PLANKS, B.PLANKS,B.PLANKS,B.PLANKS] },
    { cat: 'tools',  out: B.WATER_BUCKET,    qty: 1, req: [{ id: B.BUCKET, qty: 1 }, { id: B.ICE, qty: 1 }], grid: [0,B.ICE,0, 0,B.BUCKET,0, 0,0,0] },
    { cat: 'tools',  out: B.LAVA_BUCKET,     qty: 1, req: [{ id: B.BUCKET, qty: 1 }, { id: B.MAGMA_CORE, qty: 1 }], grid: [0,B.MAGMA_CORE,0, 0,B.BUCKET,0, 0,0,0] },
    { cat: 'tools',  out: B.SPYGLASS,        qty: 1, req: [{ id: B.GOLD_INGOT, qty: 2 }, { id: B.GLASS, qty: 1 }], grid: [0,B.GLASS,0, 0,B.GOLD_INGOT,0, 0,B.GOLD_INGOT,0] },
    // ALL VANILLA-STYLE ARMOR SETS (CANONICAL 5/8/7/4 GRIDS) + NETHERITE UPGRADE RECIPES FOR SURVIVAL BOOK
    { cat: 'tools',  out: B.LEATHER_HELMET,  qty: 1, req: [{ id: B.FOOD, qty: 5 }], grid: [B.FOOD,B.FOOD,B.FOOD, B.FOOD,0,B.FOOD, 0,0,0] },
    { cat: 'tools',  out: B.LEATHER_CHEST,   qty: 1, req: [{ id: B.FOOD, qty: 8 }], grid: [B.FOOD,0,B.FOOD, B.FOOD,B.FOOD,B.FOOD, B.FOOD,B.FOOD,B.FOOD] },
    { cat: 'tools',  out: B.LEATHER_LEGS,    qty: 1, req: [{ id: B.FOOD, qty: 7 }], grid: [B.FOOD,B.FOOD,B.FOOD, B.FOOD,0,B.FOOD, B.FOOD,0,B.FOOD] },
    { cat: 'tools',  out: B.LEATHER_BOOTS,   qty: 1, req: [{ id: B.FOOD, qty: 4 }], grid: [0,0,0, B.FOOD,0,B.FOOD, B.FOOD,0,B.FOOD] },
    { cat: 'tools',  out: B.IRON_HELMET,     qty: 1, req: [{ id: B.IRON_INGOT, qty: 5 }], grid: [B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, B.IRON_INGOT,0,B.IRON_INGOT, 0,0,0] },
    { cat: 'tools',  out: B.IRON_ARMOR,      qty: 1, req: [{ id: B.IRON_INGOT, qty: 8 }], grid: [B.IRON_INGOT,0,B.IRON_INGOT, B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT] },
    { cat: 'tools',  out: B.IRON_LEGS,       qty: 1, req: [{ id: B.IRON_INGOT, qty: 7 }], grid: [B.IRON_INGOT,B.IRON_INGOT,B.IRON_INGOT, B.IRON_INGOT,0,B.IRON_INGOT, B.IRON_INGOT,0,B.IRON_INGOT] },
    { cat: 'tools',  out: B.IRON_BOOTS,      qty: 1, req: [{ id: B.IRON_INGOT, qty: 4 }], grid: [0,0,0, B.IRON_INGOT,0,B.IRON_INGOT, B.IRON_INGOT,0,B.IRON_INGOT] },
    { cat: 'tools',  out: B.GOLD_HELMET,     qty: 1, req: [{ id: B.GOLD_INGOT, qty: 5 }], grid: [B.GOLD_INGOT,B.GOLD_INGOT,B.GOLD_INGOT, B.GOLD_INGOT,0,B.GOLD_INGOT, 0,0,0] },
    { cat: 'tools',  out: B.GOLD_ARMOR,      qty: 1, req: [{ id: B.GOLD_INGOT, qty: 8 }], grid: [B.GOLD_INGOT,0,B.GOLD_INGOT, B.GOLD_INGOT,B.GOLD_INGOT,B.GOLD_INGOT, B.GOLD_INGOT,B.GOLD_INGOT,B.GOLD_INGOT] },
    { cat: 'tools',  out: B.GOLD_LEGS,       qty: 1, req: [{ id: B.GOLD_INGOT, qty: 7 }], grid: [B.GOLD_INGOT,B.GOLD_INGOT,B.GOLD_INGOT, B.GOLD_INGOT,0,B.GOLD_INGOT, B.GOLD_INGOT,0,B.GOLD_INGOT] },
    { cat: 'tools',  out: B.GOLD_BOOTS,      qty: 1, req: [{ id: B.GOLD_INGOT, qty: 4 }], grid: [0,0,0, B.GOLD_INGOT,0,B.GOLD_INGOT, B.GOLD_INGOT,0,B.GOLD_INGOT] },
    { cat: 'tools',  out: B.DIAMOND_HELMET,  qty: 1, req: [{ id: B.DIAMOND, qty: 5 }], grid: [B.DIAMOND,B.DIAMOND,B.DIAMOND, B.DIAMOND,0,B.DIAMOND, 0,0,0] },
    { cat: 'tools',  out: B.DIAMOND_ARMOR,   qty: 1, req: [{ id: B.DIAMOND, qty: 8 }], grid: [B.DIAMOND,0,B.DIAMOND, B.DIAMOND,B.DIAMOND,B.DIAMOND, B.DIAMOND,B.DIAMOND,B.DIAMOND] },
    { cat: 'tools',  out: B.DIAMOND_LEGS,    qty: 1, req: [{ id: B.DIAMOND, qty: 7 }], grid: [B.DIAMOND,B.DIAMOND,B.DIAMOND, B.DIAMOND,0,B.DIAMOND, B.DIAMOND,0,B.DIAMOND] },
    { cat: 'tools',  out: B.DIAMOND_BOOTS,   qty: 1, req: [{ id: B.DIAMOND, qty: 4 }], grid: [0,0,0, B.DIAMOND,0,B.DIAMOND, B.DIAMOND,0,B.DIAMOND] },
    { cat: 'tools',  out: B.RUBY_HELMET,     qty: 1, req: [{ id: B.RUBY, qty: 5 }], grid: [B.RUBY,B.RUBY,B.RUBY, B.RUBY,0,B.RUBY, 0,0,0] },
    { cat: 'tools',  out: B.RUBY_CHEST,      qty: 1, req: [{ id: B.RUBY, qty: 8 }], grid: [B.RUBY,0,B.RUBY, B.RUBY,B.RUBY,B.RUBY, B.RUBY,B.RUBY,B.RUBY] },
    { cat: 'tools',  out: B.RUBY_LEGS,       qty: 1, req: [{ id: B.RUBY, qty: 7 }], grid: [B.RUBY,B.RUBY,B.RUBY, B.RUBY,0,B.RUBY, B.RUBY,0,B.RUBY] },
    { cat: 'tools',  out: B.RUBY_BOOTS,      qty: 1, req: [{ id: B.RUBY, qty: 4 }], grid: [0,0,0, B.RUBY,0,B.RUBY, B.RUBY,0,B.RUBY] },
    // CHAINMAIL, COPPER, TURTLE SHELL & NETHERITE RECIPES
    { cat: 'tools',  out: B.CHAINMAIL_HELMET,qty: 1, req: [{ id: B.IRON_INGOT, qty: 3 }, { id: B.COAL, qty: 2 }], grid: [B.IRON_INGOT,B.COAL,B.IRON_INGOT, B.COAL,0,B.IRON_INGOT, 0,0,0] },
    { cat: 'tools',  out: B.CHAINMAIL_CHEST, qty: 1, req: [{ id: B.IRON_INGOT, qty: 5 }, { id: B.COAL, qty: 3 }], grid: [B.IRON_INGOT,0,B.IRON_INGOT, B.COAL,B.IRON_INGOT,B.COAL, B.IRON_INGOT,B.COAL,B.IRON_INGOT] },
    { cat: 'tools',  out: B.CHAINMAIL_LEGS,  qty: 1, req: [{ id: B.IRON_INGOT, qty: 4 }, { id: B.COAL, qty: 3 }], grid: [B.IRON_INGOT,B.COAL,B.IRON_INGOT, B.IRON_INGOT,0,B.IRON_INGOT, B.COAL,0,B.COAL] },
    { cat: 'tools',  out: B.CHAINMAIL_BOOTS, qty: 1, req: [{ id: B.IRON_INGOT, qty: 2 }, { id: B.COAL, qty: 2 }], grid: [0,0,0, B.COAL,0,B.COAL, B.IRON_INGOT,0,B.IRON_INGOT] },
    { cat: 'tools',  out: B.COPPER_HELMET,   qty: 1, req: [{ id: B.COPPER_INGOT, qty: 5 }], grid: [B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT, B.COPPER_INGOT,0,B.COPPER_INGOT, 0,0,0] },
    { cat: 'tools',  out: B.COPPER_CHEST,    qty: 1, req: [{ id: B.COPPER_INGOT, qty: 8 }], grid: [B.COPPER_INGOT,0,B.COPPER_INGOT, B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT, B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT] },
    { cat: 'tools',  out: B.COPPER_LEGS,     qty: 1, req: [{ id: B.COPPER_INGOT, qty: 7 }], grid: [B.COPPER_INGOT,B.COPPER_INGOT,B.COPPER_INGOT, B.COPPER_INGOT,0,B.COPPER_INGOT, B.COPPER_INGOT,0,B.COPPER_INGOT] },
    { cat: 'tools',  out: B.COPPER_BOOTS,    qty: 1, req: [{ id: B.COPPER_INGOT, qty: 4 }], grid: [0,0,0, B.COPPER_INGOT,0,B.COPPER_INGOT, B.COPPER_INGOT,0,B.COPPER_INGOT] },
    { cat: 'tools',  out: B.TURTLE_HELMET,   qty: 1, req: [{ id: B.SEAGRASS, qty: 4 }, { id: B.EMERALD, qty: 1 }], grid: [B.SEAGRASS,B.EMERALD,B.SEAGRASS, B.SEAGRASS,0,B.SEAGRASS, 0,0,0] },
    ...[
      [B.NETHERITE_HELMET, B.DIAMOND_HELMET], [B.NETHERITE_ARMOR, B.DIAMOND_ARMOR],
      [B.NETHERITE_LEGS, B.DIAMOND_LEGS],     [B.NETHERITE_BOOTS, B.DIAMOND_BOOTS],
      [B.NETHERITE_PICK, B.DIAMOND_PICK],     [B.NETHERITE_SWORD, B.DIAMOND_SWORD],
      [B.NETHERITE_AXE, B.DIAMOND_AXE],       [B.NETHERITE_SHOVEL, B.DIAMOND_SHOVEL],
      [B.NETHERITE_HOE, B.DIAMOND_HOE]
    ].map(([outId, baseId]) => ({
      cat: 'tools', out: outId, qty: 1,
      req: [{ id: B.TEMPLATE_NETHERITE, qty: 1 }, { id: baseId, qty: 1 }, { id: B.NETHERITE_INGOT, qty: 1 }],
      grid: [0, 0, 0, B.TEMPLATE_NETHERITE, baseId, B.NETHERITE_INGOT, 0, 0, 0]
    })),
    // 3 POST-NETHERITE MYTHIC ARMOR TIERS (ENDER DRAGON -> SOLARIS -> CELESTIAL)
    { cat: 'tools',  out: B.ENDER_HELMET,    qty: 1, req: [{ id: B.NETHERITE_HELMET, qty: 1 }, { id: B.VOID_PEARL, qty: 2 }, { id: B.OBSIDIAN, qty: 2 }], grid: [B.OBSIDIAN,B.VOID_PEARL,B.OBSIDIAN, 0,B.NETHERITE_HELMET,0, 0,B.VOID_PEARL,0] },
    { cat: 'tools',  out: B.ENDER_CHEST,     qty: 1, req: [{ id: B.NETHERITE_ARMOR,  qty: 1 }, { id: B.VOID_PEARL, qty: 3 }, { id: B.OBSIDIAN, qty: 2 }], grid: [B.VOID_PEARL,B.NETHERITE_ARMOR,B.VOID_PEARL, B.OBSIDIAN,B.VOID_PEARL,B.OBSIDIAN, 0,0,0] },
    { cat: 'tools',  out: B.ENDER_LEGS,      qty: 1, req: [{ id: B.NETHERITE_LEGS,   qty: 1 }, { id: B.VOID_PEARL, qty: 2 }, { id: B.OBSIDIAN, qty: 2 }], grid: [B.OBSIDIAN,B.VOID_PEARL,B.OBSIDIAN, 0,B.NETHERITE_LEGS,0, 0,B.VOID_PEARL,0] },
    { cat: 'tools',  out: B.ENDER_BOOTS,     qty: 1, req: [{ id: B.NETHERITE_BOOTS,  qty: 1 }, { id: B.VOID_PEARL, qty: 2 }, { id: B.OBSIDIAN, qty: 2 }], grid: [B.OBSIDIAN,B.VOID_PEARL,B.OBSIDIAN, 0,B.NETHERITE_BOOTS,0, 0,B.VOID_PEARL,0] },
    { cat: 'tools',  out: B.SOLARIS_HELMET,  qty: 1, req: [{ id: B.ENDER_HELMET, qty: 1 }, { id: B.MAGMA_CORE, qty: 2 }, { id: B.RUBY, qty: 2 }], grid: [B.RUBY,B.MAGMA_CORE,B.RUBY, 0,B.ENDER_HELMET,0, 0,B.MAGMA_CORE,0] },
    { cat: 'tools',  out: B.SOLARIS_CHEST,   qty: 1, req: [{ id: B.ENDER_CHEST,  qty: 1 }, { id: B.MAGMA_CORE, qty: 3 }, { id: B.RUBY, qty: 2 }], grid: [B.MAGMA_CORE,B.ENDER_CHEST,B.MAGMA_CORE, B.RUBY,B.MAGMA_CORE,B.RUBY, 0,0,0] },
    { cat: 'tools',  out: B.SOLARIS_LEGS,    qty: 1, req: [{ id: B.ENDER_LEGS,   qty: 1 }, { id: B.MAGMA_CORE, qty: 2 }, { id: B.RUBY, qty: 2 }], grid: [B.RUBY,B.MAGMA_CORE,B.RUBY, 0,B.ENDER_LEGS,0, 0,B.MAGMA_CORE,0] },
    { cat: 'tools',  out: B.SOLARIS_BOOTS,   qty: 1, req: [{ id: B.ENDER_BOOTS,  qty: 1 }, { id: B.MAGMA_CORE, qty: 2 }, { id: B.RUBY, qty: 2 }], grid: [B.RUBY,B.MAGMA_CORE,B.RUBY, 0,B.ENDER_BOOTS,0, 0,B.MAGMA_CORE,0] },
    { cat: 'tools',  out: B.CELESTIAL_HELMET,qty: 1, req: [{ id: B.SOLARIS_HELMET, qty: 1 }, { id: B.GLOW_CRYSTAL, qty: 2 }, { id: B.EMERALD, qty: 2 }], grid: [B.EMERALD,B.GLOW_CRYSTAL,B.EMERALD, 0,B.SOLARIS_HELMET,0, 0,B.GLOW_CRYSTAL,0] },
    { cat: 'tools',  out: B.CELESTIAL_CHEST, qty: 1, req: [{ id: B.SOLARIS_CHEST,  qty: 1 }, { id: B.GLOW_CRYSTAL, qty: 3 }, { id: B.EMERALD, qty: 2 }], grid: [B.GLOW_CRYSTAL,B.SOLARIS_CHEST,B.GLOW_CRYSTAL, B.EMERALD,B.GLOW_CRYSTAL,B.EMERALD, 0,0,0] },
    { cat: 'tools',  out: B.CELESTIAL_LEGS,  qty: 1, req: [{ id: B.SOLARIS_LEGS,   qty: 1 }, { id: B.GLOW_CRYSTAL, qty: 2 }, { id: B.EMERALD, qty: 2 }], grid: [B.EMERALD,B.GLOW_CRYSTAL,B.EMERALD, 0,B.SOLARIS_LEGS,0, 0,B.GLOW_CRYSTAL,0] },
    { cat: 'tools',  out: B.CELESTIAL_BOOTS, qty: 1, req: [{ id: B.SOLARIS_BOOTS,  qty: 1 }, { id: B.GLOW_CRYSTAL, qty: 2 }, { id: B.EMERALD, qty: 2 }], grid: [B.EMERALD,B.GLOW_CRYSTAL,B.EMERALD, 0,B.SOLARIS_BOOTS,0, 0,B.GLOW_CRYSTAL,0] },

    // BUILDING BLOCKS & ARCHITECTURE (COMPLETE MINECRAFT SET!)
    { cat: 'blocks', out: B.STONE_BRICK,     qty: 4, req: [{ id: B.STONE, qty: 4 }],  grid: [B.STONE,B.STONE,0, B.STONE,B.STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.GLASS,           qty: 4, req: [{ id: B.SAND, qty: 3 }, { id: B.COAL, qty: 1 }], grid: [0,B.SAND,0, B.SAND,B.COAL,B.SAND, 0,0,0] },
    { cat: 'blocks', out: B.SANDSTONE,       qty: 4, req: [{ id: B.SAND, qty: 4 }], grid: [B.SAND,B.SAND,0, B.SAND,B.SAND,0, 0,0,0] },
    { cat: 'blocks', out: B.TERRACOTTA,      qty: 4, req: [{ id: B.DIRT, qty: 2 }, { id: B.SAND, qty: 2 }], grid: [B.DIRT,B.SAND,0, B.SAND,B.DIRT,0, 0,0,0] },
    { cat: 'blocks', out: B.CONCRETE,        qty: 4, req: [{ id: B.STONE, qty: 2 }, { id: B.SAND, qty: 2 }], grid: [B.STONE,B.SAND,0, B.SAND,B.STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.CRACKED_CONCRETE,qty: 4, req: [{ id: B.CONCRETE, qty: 2 }, { id: B.STONE, qty: 2 }], grid: [B.CONCRETE,B.STONE,0, B.STONE,B.CONCRETE,0, 0,0,0] },
    { cat: 'blocks', out: B.ASPHALT,         qty: 4, req: [{ id: B.STONE, qty: 3 }, { id: B.COAL, qty: 1 }], grid: [B.STONE,B.COAL,0, B.STONE,B.STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.ROAD_LINE,       qty: 4, req: [{ id: B.ASPHALT, qty: 3 }, { id: B.FLOWER_YELLOW, qty: 1 }], grid: [B.ASPHALT,B.FLOWER_YELLOW,0, B.ASPHALT,B.ASPHALT,0, 0,0,0] },
    { cat: 'blocks', out: B.RUST_STEEL,      qty: 4, req: [{ id: B.IRON_INGOT, qty: 2 }, { id: B.COPPER_INGOT, qty: 2 }], grid: [B.IRON_INGOT,B.COPPER_INGOT,0, B.COPPER_INGOT,B.IRON_INGOT,0, 0,0,0] },
    { cat: 'blocks', out: B.DEEPSLATE,       qty: 4, req: [{ id: B.STONE, qty: 4 }, { id: B.COAL, qty: 1 }], grid: [0,B.STONE,0, B.STONE,B.COAL,B.STONE, 0,B.STONE,0] },
    { cat: 'blocks', out: B.BASALT,          qty: 4, req: [{ id: B.DEEPSLATE, qty: 2 }, { id: B.STONE, qty: 2 }], grid: [B.DEEPSLATE,B.STONE,0, B.STONE,B.DEEPSLATE,0, 0,0,0] },
    { cat: 'blocks', out: B.OBSIDIAN,        qty: 2, req: [{ id: B.STONE, qty: 4 }, { id: B.MAGMA_CORE, qty: 1 }], grid: [0,B.STONE,0, B.STONE,B.MAGMA_CORE,B.STONE, 0,B.STONE,0] },
    { cat: 'blocks', out: B.MUD,             qty: 4, req: [{ id: B.DIRT, qty: 4 }], grid: [B.DIRT,B.DIRT,0, B.DIRT,B.DIRT,0, 0,0,0] },
    { cat: 'blocks', out: B.MUD_BRICK,       qty: 4, req: [{ id: B.MUD, qty: 4 }], grid: [B.MUD,B.MUD,0, B.MUD,B.MUD,0, 0,0,0] },
    { cat: 'blocks', out: B.COPPER_ROOF,     qty: 4, req: [{ id: B.COPPER_INGOT, qty: 2 }, { id: B.STONE, qty: 2 }], grid: [B.COPPER_INGOT,B.STONE,0, B.STONE,B.COPPER_INGOT,0, 0,0,0] },
    { cat: 'blocks', out: B.MARBLE_BRICK,    qty: 4, req: [{ id: B.STONE, qty: 2 }, { id: B.SANDSTONE, qty: 2 }], grid: [B.STONE,B.SANDSTONE,0, B.SANDSTONE,B.STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.PRISMARINE,      qty: 4, req: [{ id: B.STONE, qty: 3 }, { id: B.CORAL_BLUE, qty: 1 }], grid: [B.STONE,B.CORAL_BLUE,0, B.STONE,B.STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.PACKED_ICE,      qty: 2, req: [{ id: B.ICE, qty: 4 }], grid: [B.ICE,B.ICE,0, B.ICE,B.ICE,0, 0,0,0] },
    { cat: 'blocks', out: B.SNOW,            qty: 4, req: [{ id: B.ICE, qty: 2 }], grid: [0,0,0, B.ICE,B.ICE,0, 0,0,0] },
    { cat: 'blocks', out: B.HAY_BALE,        qty: 2, req: [{ id: B.TALL_GRASS, qty: 4 }], grid: [B.TALL_GRASS,B.TALL_GRASS,0, B.TALL_GRASS,B.TALL_GRASS,0, 0,0,0] },
    { cat: 'blocks', out: B.NETHER_BRICK,    qty: 4, req: [{ id: B.NETHERRACK, qty: 4 }], grid: [B.NETHERRACK,B.NETHERRACK,0, B.NETHERRACK,B.NETHERRACK,0, 0,0,0] },
    { cat: 'blocks', out: B.PURPUR_BLOCK,    qty: 4, req: [{ id: B.END_STONE, qty: 2 }, { id: B.CHORUS_PLANT, qty: 2 }], grid: [B.END_STONE,B.CHORUS_PLANT,0, B.CHORUS_PLANT,B.END_STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.END_STONE_BRICKS, qty: 4, req: [{ id: B.END_STONE, qty: 4 }], grid: [B.END_STONE,B.END_STONE,0, B.END_STONE,B.END_STONE,0, 0,0,0] },
    { cat: 'blocks', out: B.PURPUR_PILLAR,   qty: 2, req: [{ id: B.PURPUR_BLOCK, qty: 2 }], grid: [0,B.PURPUR_BLOCK,0, 0,B.PURPUR_BLOCK,0, 0,0,0] },
    { cat: 'misc',   out: B.END_ROD,         qty: 4, req: [{ id: B.BLAZE_ROD, qty: 1 }, { id: B.CHORUS_PLANT, qty: 1 }], grid: [0,B.BLAZE_ROD,0, 0,B.CHORUS_PLANT,0, 0,0,0] },
    { cat: 'blocks', out: B.BROKEN_GLASS,    qty: 4, req: [{ id: B.GLASS, qty: 2 }], grid: [0,0,0, B.GLASS,0,B.GLASS, 0,0,0] },
    // v21 Bamboo Block (9x Bamboo!), Bamboo Planks, Sugar Cane & Complete Fences / Stone Walls!
    { cat: 'blocks', out: B.BAMBOO_BLOCK,    qty: 1, req: [{ id: B.BAMBOO, qty: 9 }], grid: [B.BAMBOO,B.BAMBOO,B.BAMBOO, B.BAMBOO,B.BAMBOO,B.BAMBOO, B.BAMBOO,B.BAMBOO,B.BAMBOO] },
    { cat: 'blocks', out: B.BAMBOO_PLANKS,   qty: 2, req: [{ id: B.BAMBOO_BLOCK, qty: 1 }], grid: [0,0,0, 0,B.BAMBOO_BLOCK,0, 0,0,0] },
    { cat: 'blocks', out: B.OAK_FENCE,       qty: 3, req: [{ id: B.PLANKS, qty: 4 }, { id: B.STICK, qty: 2 }], grid: [0,0,0, B.PLANKS,B.STICK,B.PLANKS, B.PLANKS,B.STICK,B.PLANKS] },
    { cat: 'blocks', out: B.SPRUCE_FENCE,    qty: 3, req: [{ id: B.SPRUCE_LOG, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [0,0,0, B.SPRUCE_LOG,B.STICK,B.SPRUCE_LOG, 0,B.STICK,0] },
    { cat: 'blocks', out: B.BIRCH_FENCE,     qty: 3, req: [{ id: B.BIRCH_LOG, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [0,0,0, B.BIRCH_LOG,B.STICK,B.BIRCH_LOG, 0,B.STICK,0] },
    { cat: 'blocks', out: B.SAKURA_FENCE,    qty: 3, req: [{ id: B.SAKURA_LOG, qty: 2 }, { id: B.STICK, qty: 2 }], grid: [0,0,0, B.SAKURA_LOG,B.STICK,B.SAKURA_LOG, 0,B.STICK,0] },
    { cat: 'blocks', out: B.BAMBOO_FENCE,    qty: 3, req: [{ id: B.BAMBOO_PLANKS, qty: 4 }, { id: B.STICK, qty: 2 }], grid: [0,0,0, B.BAMBOO_PLANKS,B.STICK,B.BAMBOO_PLANKS, B.BAMBOO_PLANKS,B.STICK,B.BAMBOO_PLANKS] },
    { cat: 'blocks', out: B.NETHER_FENCE,    qty: 6, req: [{ id: B.NETHER_BRICK, qty: 6 }], grid: [0,0,0, B.NETHER_BRICK,B.NETHER_BRICK,B.NETHER_BRICK, B.NETHER_BRICK,B.NETHER_BRICK,B.NETHER_BRICK] },
    { cat: 'blocks', out: B.STONE_WALL,      qty: 6, req: [{ id: B.STONE, qty: 6 }], grid: [0,0,0, B.STONE,B.STONE,B.STONE, B.STONE,B.STONE,B.STONE] },
    { cat: 'blocks', out: B.STONE_BRICK_WALL,qty: 6, req: [{ id: B.STONE_BRICK, qty: 6 }], grid: [0,0,0, B.STONE_BRICK,B.STONE_BRICK,B.STONE_BRICK, B.STONE_BRICK,B.STONE_BRICK,B.STONE_BRICK] },
    { cat: 'blocks', out: B.DEEPSLATE_WALL,  qty: 6, req: [{ id: B.DEEPSLATE, qty: 6 }], grid: [0,0,0, B.DEEPSLATE,B.DEEPSLATE,B.DEEPSLATE, B.DEEPSLATE,B.DEEPSLATE,B.DEEPSLATE] },
    { cat: 'misc',   out: B.CHEST,           qty: 1, req: [{ id: B.BAMBOO_PLANKS, qty: 8 }], grid: [B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,B.BAMBOO_PLANKS, B.BAMBOO_PLANKS,0,B.BAMBOO_PLANKS, B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,B.BAMBOO_PLANKS] },
    { cat: 'misc',   out: B.WINDMILL_HUB,    qty: 1, req: [{ id: B.PLANKS, qty: 4 }, { id: B.WHITE_WOOL, qty: 4 }, { id: B.IRON_INGOT, qty: 1 }], grid: [B.WHITE_WOOL,B.PLANKS,B.WHITE_WOOL, B.PLANKS,B.IRON_INGOT,B.PLANKS, B.WHITE_WOOL,B.PLANKS,B.WHITE_WOOL] },
    { cat: 'misc',   out: B.CRAFT_TABLE,     qty: 1, req: [{ id: B.BAMBOO_PLANKS, qty: 4 }], grid: [B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,0, B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,0, 0,0,0] },
    { cat: 'misc',   out: B.BOOKSHELF,       qty: 1, req: [{ id: B.PLANKS, qty: 6 }, { id: B.SUGAR_CANE, qty: 3 }], grid: [B.PLANKS,B.PLANKS,B.PLANKS, B.SUGAR_CANE,B.SUGAR_CANE,B.SUGAR_CANE, B.PLANKS,B.PLANKS,B.PLANKS] },
    { cat: 'tools',  out: B.BOAT_ITEM,       qty: 1, req: [{ id: B.BAMBOO_PLANKS, qty: 5 }], grid: [0,0,0, B.BAMBOO_PLANKS,0,B.BAMBOO_PLANKS, B.BAMBOO_PLANKS,B.BAMBOO_PLANKS,B.BAMBOO_PLANKS] },

    // FOOD & POTIONS
    { cat: 'food',   out: B.BREAD,           qty: 2, req: [{ id: B.HAY_BALE, qty: 1 }], grid: [0,0,0, B.HAY_BALE,0,0, 0,0,0] },
    { cat: 'food',   out: B.GOLD_APPLE,      qty: 1, req: [{ id: B.GOLD_INGOT, qty: 4 }, { id: B.APPLE, qty: 1 }], grid: [0,B.GOLD_INGOT,0, B.GOLD_INGOT,B.APPLE,B.GOLD_INGOT, 0,B.GOLD_INGOT,0] },
    { cat: 'food',   out: B.COOKED_FISH,     qty: 1, req: [{ id: B.RAW_FISH, qty: 1 }, { id: B.COAL, qty: 1 }], grid: [0,B.RAW_FISH,0, 0,B.COAL,0, 0,0,0] },
    { cat: 'food',   out: B.COCONUT_DRINK,   qty: 2, req: [{ id: B.COCONUT, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.STICK,0, B.COCONUT,B.COCONUT,0, 0,0,0] },
    { cat: 'food',   out: B.WATER_BREATH_POTION, qty: 1, req: [{ id: B.CORAL_PINK, qty: 1 }, { id: B.GLASS, qty: 1 }, { id: B.RAW_FISH, qty: 1 }], grid: [0,B.CORAL_PINK,0, B.GLASS,B.RAW_FISH,0, 0,0,0] },
    { cat: 'food',   out: B.FOOD,            qty: 2, req: [{ id: B.APPLE, qty: 2 }, { id: B.PLANKS, qty: 1 }], grid: [0,B.APPLE,0, 0,B.APPLE,0, 0,B.PLANKS,0] },
    { cat: 'food',   out: B.APPLE,           qty: 2, req: [{ id: B.BERRY_BUSH, qty: 2 }], grid: [0,0,0, B.BERRY_BUSH,B.BERRY_BUSH,0, 0,0,0] },
    { cat: 'blocks', out: B.BAMBOO_SHOOT,    qty: 2, req: [{ id: B.BAMBOO, qty: 1 }], grid: [0,0,0, 0,B.BAMBOO,0, 0,0,0] },
    { cat: 'blocks', out: B.RAIL,            qty: 8, req: [{ id: B.IRON_INGOT, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [B.IRON_INGOT,0,B.IRON_INGOT, B.IRON_INGOT,B.STICK,B.IRON_INGOT, B.IRON_INGOT,0,B.IRON_INGOT] },
    { cat: 'blocks', out: B.MOSS_BLOCK,      qty: 4, req: [{ id: B.TALL_GRASS, qty: 2 }, { id: B.DIRT, qty: 2 }], grid: [B.TALL_GRASS,B.TALL_GRASS,0, B.DIRT,B.DIRT,0, 0,0,0] },
    { cat: 'misc',   out: B.GLOW_VINES,      qty: 4, req: [{ id: B.VINE, qty: 2 }, { id: B.MUSHROOM_GLOW, qty: 1 }], grid: [0,B.VINE,0, 0,B.MUSHROOM_GLOW,0, 0,B.VINE,0] },
    { cat: 'tools',  is2x2: true, out: B.FLINT_AND_STEEL, qty: 1, req: [{ id: B.IRON_INGOT, qty: 1 }, { id: B.FLINT, qty: 1 }], grid: [B.IRON_INGOT,0,0, 0,B.FLINT,0, 0,0,0] },
    { cat: 'misc',   is2x2: true, out: B.BLAZE_POWDER,    qty: 2, req: [{ id: B.BLAZE_ROD, qty: 1 }], grid: [B.BLAZE_ROD,0,0, 0,0,0, 0,0,0] },
    { cat: 'misc',   is2x2: true, out: B.ENDER_EYE,       qty: 1, req: [{ id: B.ENDER_PEARL, qty: 1 }, { id: B.BLAZE_POWDER, qty: 1 }], grid: [B.ENDER_PEARL,B.BLAZE_POWDER,0, 0,0,0, 0,0,0] },
    { cat: 'misc',                out: B.END_CRYSTAL_BLOCK, qty: 1, req: [{ id: B.GLASS, qty: 7 }, { id: B.ENDER_EYE, qty: 1 }, { id: B.GHAST_TEAR, qty: 1 }], grid: [B.GLASS,B.GLASS,B.GLASS, B.GLASS,B.ENDER_EYE,B.GLASS, B.GLASS,B.GHAST_TEAR,B.GLASS] },
    // v43 Ichor & Aetherium Tools & Armor (The Sift Endgame Tiers!)
    { cat: 'tools',  out: B.ICHOR_PICK,       qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.ICHOR_SWORD,      qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.ICHOR_CRYSTAL,0, 0,B.ICHOR_CRYSTAL,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.ICHOR_AXE,        qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL,0, B.ICHOR_CRYSTAL,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.AETHERIUM_PICK,   qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 3 }, { id: B.ECHO_SHARD, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [B.AETHERIUM_INGOT,B.AETHERIUM_INGOT,B.AETHERIUM_INGOT, 0,B.ECHO_SHARD,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.AETHERIUM_SWORD,  qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 2 }, { id: B.ECHO_SHARD, qty: 1 }, { id: B.STICK, qty: 1 }], grid: [0,B.AETHERIUM_INGOT,0, 0,B.AETHERIUM_INGOT,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.AETHERIUM_AXE,    qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.AETHERIUM_INGOT,B.AETHERIUM_INGOT,0, B.AETHERIUM_INGOT,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.ICHOR_HELMET,     qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 5 }], grid: [B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL, B.ICHOR_CRYSTAL,0,B.ICHOR_CRYSTAL, 0,0,0] },
    { cat: 'tools',  out: B.ICHOR_CHEST,      qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 8 }], grid: [B.ICHOR_CRYSTAL,0,B.ICHOR_CRYSTAL, B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL, B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL] },
    { cat: 'tools',  out: B.ICHOR_LEGS,       qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 7 }], grid: [B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL,B.ICHOR_CRYSTAL, B.ICHOR_CRYSTAL,0,B.ICHOR_CRYSTAL, B.ICHOR_CRYSTAL,0,B.ICHOR_CRYSTAL] },
    { cat: 'tools',  out: B.ICHOR_BOOTS,      qty: 1, req: [{ id: B.ICHOR_CRYSTAL, qty: 4 }], grid: [0,0,0, B.ICHOR_CRYSTAL,0,B.ICHOR_CRYSTAL, B.ICHOR_CRYSTAL,0,B.ICHOR_CRYSTAL] },
    { cat: 'tools',  out: B.AETHERIUM_HELMET, qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 5 }], grid: [B.AETHERIUM_INGOT,B.AETHERIUM_INGOT,B.AETHERIUM_INGOT, B.AETHERIUM_INGOT,0,B.AETHERIUM_INGOT, 0,0,0] },
    { cat: 'tools',  out: B.AETHERIUM_CHEST,  qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 8 }], grid: [B.AETHERIUM_INGOT,0,B.AETHERIUM_INGOT, B.AETHERIUM_INGOT,B.AETHERIUM_INGOT,B.AETHERIUM_INGOT, B.AETHERIUM_INGOT,B.AETHERIUM_INGOT,B.AETHERIUM_INGOT] },
    { cat: 'tools',  out: B.AETHERIUM_LEGS,   qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 7 }], grid: [B.AETHERIUM_INGOT,B.AETHERIUM_INGOT,B.AETHERIUM_INGOT, B.AETHERIUM_INGOT,0,B.AETHERIUM_INGOT, B.AETHERIUM_INGOT,0,B.AETHERIUM_INGOT] },
    { cat: 'tools',  out: B.AETHERIUM_BOOTS,  qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 4 }], grid: [0,0,0, B.AETHERIUM_INGOT,0,B.AETHERIUM_INGOT, B.AETHERIUM_INGOT,0,B.AETHERIUM_INGOT] },
    // v67 New Armor Tiers (Emerald, Amethyst, Obsidian) & New Sift Dream Tools + Rainbow Dream Armor Sets
    { cat: 'tools',  out: B.EMERALD_HELMET,   qty: 1, req: [{ id: B.EMERALD, qty: 5 }], grid: [B.EMERALD,B.EMERALD,B.EMERALD, B.EMERALD,0,B.EMERALD, 0,0,0] },
    { cat: 'tools',  out: B.EMERALD_CHEST,    qty: 1, req: [{ id: B.EMERALD, qty: 8 }], grid: [B.EMERALD,0,B.EMERALD, B.EMERALD,B.EMERALD,B.EMERALD, B.EMERALD,B.EMERALD,B.EMERALD] },
    { cat: 'tools',  out: B.EMERALD_LEGS,     qty: 1, req: [{ id: B.EMERALD, qty: 7 }], grid: [B.EMERALD,B.EMERALD,B.EMERALD, B.EMERALD,0,B.EMERALD, B.EMERALD,0,B.EMERALD] },
    { cat: 'tools',  out: B.EMERALD_BOOTS,    qty: 1, req: [{ id: B.EMERALD, qty: 4 }], grid: [0,0,0, B.EMERALD,0,B.EMERALD, B.EMERALD,0,B.EMERALD] },
    { cat: 'tools',  out: B.AMETHYST_HELMET,  qty: 1, req: [{ id: B.GLOW_CRYSTAL, qty: 3 }, { id: B.DIAMOND, qty: 2 }], grid: [B.GLOW_CRYSTAL,B.DIAMOND,B.GLOW_CRYSTAL, B.GLOW_CRYSTAL,0,B.DIAMOND, 0,0,0] },
    { cat: 'tools',  out: B.AMETHYST_CHEST,   qty: 1, req: [{ id: B.GLOW_CRYSTAL, qty: 5 }, { id: B.DIAMOND, qty: 3 }], grid: [B.GLOW_CRYSTAL,0,B.GLOW_CRYSTAL, B.DIAMOND,B.GLOW_CRYSTAL,B.DIAMOND, B.GLOW_CRYSTAL,B.DIAMOND,B.GLOW_CRYSTAL] },
    { cat: 'tools',  out: B.AMETHYST_LEGS,    qty: 1, req: [{ id: B.GLOW_CRYSTAL, qty: 4 }, { id: B.DIAMOND, qty: 3 }], grid: [B.GLOW_CRYSTAL,B.DIAMOND,B.GLOW_CRYSTAL, B.GLOW_CRYSTAL,0,B.GLOW_CRYSTAL, B.DIAMOND,0,B.DIAMOND] },
    { cat: 'tools',  out: B.AMETHYST_BOOTS,   qty: 1, req: [{ id: B.GLOW_CRYSTAL, qty: 2 }, { id: B.DIAMOND, qty: 2 }], grid: [0,0,0, B.GLOW_CRYSTAL,0,B.GLOW_CRYSTAL, B.DIAMOND,0,B.DIAMOND] },
    { cat: 'tools',  out: B.OBSIDIAN_HELMET,  qty: 1, req: [{ id: B.OBSIDIAN, qty: 4 }, { id: B.DIAMOND, qty: 1 }], grid: [B.OBSIDIAN,B.DIAMOND,B.OBSIDIAN, B.OBSIDIAN,0,B.OBSIDIAN, 0,0,0] },
    { cat: 'tools',  out: B.OBSIDIAN_CHEST,   qty: 1, req: [{ id: B.OBSIDIAN, qty: 6 }, { id: B.DIAMOND, qty: 2 }], grid: [B.OBSIDIAN,0,B.OBSIDIAN, B.DIAMOND,B.OBSIDIAN,B.DIAMOND, B.OBSIDIAN,B.OBSIDIAN,B.OBSIDIAN] },
    { cat: 'tools',  out: B.OBSIDIAN_LEGS,    qty: 1, req: [{ id: B.OBSIDIAN, qty: 5 }, { id: B.DIAMOND, qty: 2 }], grid: [B.OBSIDIAN,B.OBSIDIAN,B.OBSIDIAN, B.DIAMOND,0,B.DIAMOND, B.OBSIDIAN,0,B.OBSIDIAN] },
    { cat: 'tools',  out: B.OBSIDIAN_BOOTS,   qty: 1, req: [{ id: B.OBSIDIAN, qty: 2 }, { id: B.DIAMOND, qty: 2 }], grid: [0,0,0, B.OBSIDIAN,0,B.OBSIDIAN, B.DIAMOND,0,B.DIAMOND] },
    { cat: 'tools',  out: B.MOONSTONE_PICK,   qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.MOONSTONE_GEM,B.MOONSTONE_GEM,B.MOONSTONE_GEM, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.MOONSTONE_SWORD,  qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.MOONSTONE_GEM,0, 0,B.MOONSTONE_GEM,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.MOONSTONE_AXE,    qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.MOONSTONE_GEM,B.MOONSTONE_GEM,0, B.MOONSTONE_GEM,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.MOONSTONE_SHOVEL, qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [0,B.MOONSTONE_GEM,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.MOONSTONE_HELMET, qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 5 }], grid: [B.MOONSTONE_GEM,B.MOONSTONE_GEM,B.MOONSTONE_GEM, B.MOONSTONE_GEM,0,B.MOONSTONE_GEM, 0,0,0] },
    { cat: 'tools',  out: B.MOONSTONE_CHEST,  qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 8 }], grid: [B.MOONSTONE_GEM,0,B.MOONSTONE_GEM, B.MOONSTONE_GEM,B.MOONSTONE_GEM,B.MOONSTONE_GEM, B.MOONSTONE_GEM,B.MOONSTONE_GEM,B.MOONSTONE_GEM] },
    { cat: 'tools',  out: B.MOONSTONE_LEGS,   qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 7 }], grid: [B.MOONSTONE_GEM,B.MOONSTONE_GEM,B.MOONSTONE_GEM, B.MOONSTONE_GEM,0,B.MOONSTONE_GEM, B.MOONSTONE_GEM,0,B.MOONSTONE_GEM] },
    { cat: 'tools',  out: B.MOONSTONE_BOOTS,  qty: 1, req: [{ id: B.MOONSTONE_GEM, qty: 4 }], grid: [0,0,0, B.MOONSTONE_GEM,0,B.MOONSTONE_GEM, B.MOONSTONE_GEM,0,B.MOONSTONE_GEM] },
    { cat: 'tools',  out: B.NEBULA_PICK,      qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 3 }, { id: B.ECHO_SHARD, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [B.NEBULA_INGOT,B.NEBULA_INGOT,B.NEBULA_INGOT, 0,B.ECHO_SHARD,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.NEBULA_SWORD,     qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 2 }, { id: B.STICK, qty: 1 }], grid: [0,B.NEBULA_INGOT,0, 0,B.NEBULA_INGOT,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.NEBULA_AXE,       qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.NEBULA_INGOT,B.NEBULA_INGOT,0, B.NEBULA_INGOT,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.NEBULA_SHOVEL,    qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [0,B.NEBULA_INGOT,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.NEBULA_HELMET,    qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 5 }], grid: [B.NEBULA_INGOT,B.NEBULA_INGOT,B.NEBULA_INGOT, B.NEBULA_INGOT,0,B.NEBULA_INGOT, 0,0,0] },
    { cat: 'tools',  out: B.NEBULA_CHEST,     qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 8 }], grid: [B.NEBULA_INGOT,0,B.NEBULA_INGOT, B.NEBULA_INGOT,B.NEBULA_INGOT,B.NEBULA_INGOT, B.NEBULA_INGOT,B.NEBULA_INGOT,B.NEBULA_INGOT] },
    { cat: 'tools',  out: B.NEBULA_LEGS,      qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 7 }], grid: [B.NEBULA_INGOT,B.NEBULA_INGOT,B.NEBULA_INGOT, B.NEBULA_INGOT,0,B.NEBULA_INGOT, B.NEBULA_INGOT,0,B.NEBULA_INGOT] },
    { cat: 'tools',  out: B.NEBULA_BOOTS,     qty: 1, req: [{ id: B.NEBULA_INGOT, qty: 4 }], grid: [0,0,0, B.NEBULA_INGOT,0,B.NEBULA_INGOT, B.NEBULA_INGOT,0,B.NEBULA_INGOT] },
    { cat: 'tools',  out: B.DREAM_PRISM_PICK, qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 3 }, { id: B.ECHO_SHARD, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM, 0,B.ECHO_SHARD,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DREAM_PRISM_SWORD,qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 2 }, { id: B.ECHO_SHARD, qty: 1 }, { id: B.STICK, qty: 1 }], grid: [0,B.DREAM_PRISM_GEM,0, 0,B.DREAM_PRISM_GEM,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DREAM_PRISM_AXE,  qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 3 }, { id: B.STICK, qty: 2 }], grid: [B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,0, B.DREAM_PRISM_GEM,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DREAM_PRISM_SHOVEL,qty:1, req: [{ id: B.DREAM_PRISM_GEM, qty: 1 }, { id: B.STICK, qty: 2 }], grid: [0,B.DREAM_PRISM_GEM,0, 0,B.STICK,0, 0,B.STICK,0] },
    { cat: 'tools',  out: B.DREAM_PRISM_HELMET,qty:1, req: [{ id: B.DREAM_PRISM_GEM, qty: 5 }], grid: [B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,0,B.DREAM_PRISM_GEM, 0,0,0] },
    { cat: 'tools',  out: B.DREAM_PRISM_CHEST,qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 8 }], grid: [B.DREAM_PRISM_GEM,0,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM] },
    { cat: 'tools',  out: B.DREAM_PRISM_LEGS, qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 7 }], grid: [B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,0,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,0,B.DREAM_PRISM_GEM] },
    { cat: 'tools',  out: B.DREAM_PRISM_BOOTS,qty: 1, req: [{ id: B.DREAM_PRISM_GEM, qty: 4 }], grid: [0,0,0, B.DREAM_PRISM_GEM,0,B.DREAM_PRISM_GEM, B.DREAM_PRISM_GEM,0,B.DREAM_PRISM_GEM] },
    // Block of Netherite + Redstone conversion + Smithing Template Duplication Recipes (all 19 templates!)
    { cat: 'blocks', out: B.NETHERITE_BLOCK, qty: 1, req: [{ id: B.NETHERITE_INGOT, qty: 9 }], grid: [B.NETHERITE_INGOT,B.NETHERITE_INGOT,B.NETHERITE_INGOT, B.NETHERITE_INGOT,B.NETHERITE_INGOT,B.NETHERITE_INGOT, B.NETHERITE_INGOT,B.NETHERITE_INGOT,B.NETHERITE_INGOT] },
    { cat: 'misc',   out: B.NETHERITE_INGOT, qty: 9, is2x2: true, req: [{ id: B.NETHERITE_BLOCK, qty: 1 }], grid: [B.NETHERITE_BLOCK,0,0, 0,0,0, 0,0,0] },
    { cat: 'misc',   out: B.REDSTONE,        qty: 4, is2x2: true, req: [{ id: B.RUBY, qty: 1 }], grid: [B.RUBY,0,0, 0,0,0, 0,0,0] },
    ...[B.TEMPLATE_NETHERITE, B.TRIM_WARD, B.TRIM_COAST, B.TRIM_WILD, B.TRIM_DUNE, B.TRIM_TIDE, B.TRIM_SILENCE, B.TRIM_SENTRY, B.TRIM_VEX, B.TRIM_RIB, B.TRIM_SNOUT, B.TRIM_EYE, B.TRIM_SPIRE, B.TRIM_FLOW, B.TRIM_BOLT, B.TRIM_WAYFINDER, B.TRIM_RAISER, B.TRIM_SHAPER, B.TRIM_HOST].map(tid => {
      const db = BLOCK_DEF[tid].dupBlock;
      return { cat: 'misc', out: tid, qty: 2, req: [{ id: tid, qty: 1 }, { id: B.DIAMOND, qty: 7 }, { id: db, qty: 1 }], grid: [B.DIAMOND, tid, B.DIAMOND, B.DIAMOND, db, B.DIAMOND, B.DIAMOND, B.DIAMOND, B.DIAMOND] };
    }),
    // All Wood, Earth & Stone Building Slabs (3 horizontal blocks -> 6 slabs!)
    ...SLAB_SPECS.filter(s => !s.noCraft).map(s => {
      const cId = s.craftId || s.baseId;
      return { cat: 'blocks', out: s.botId, qty: 6, req: [{ id: cId, qty: 3 }], grid: [0, 0, 0, 0, 0, 0, cId, cId, cId] };
    }),
    // Deep Dark & Ancient City Crafting Recipes
    { cat: 'blocks', out: B.DEEPSLATE_BRICKS, qty: 4, is2x2: true, req: [{ id: B.DEEPSLATE, qty: 4 }], grid: [B.DEEPSLATE,B.DEEPSLATE,0, B.DEEPSLATE,B.DEEPSLATE,0, 0,0,0] },
    { cat: 'blocks', out: B.DEEPSLATE_TILES,  qty: 4, is2x2: true, req: [{ id: B.DEEPSLATE_BRICKS, qty: 4 }], grid: [B.DEEPSLATE_BRICKS,B.DEEPSLATE_BRICKS,0, B.DEEPSLATE_BRICKS,B.DEEPSLATE_BRICKS,0, 0,0,0] },
    { cat: 'misc',   out: B.SOUL_LANTERN,     qty: 1, req: [{ id: B.IRON_INGOT, qty: 4 }, { id: B.SOUL_SAND, qty: 1 }, { id: B.COAL, qty: 1 }], grid: [B.IRON_INGOT,B.COAL,B.IRON_INGOT, B.IRON_INGOT,B.SOUL_SAND,B.IRON_INGOT, 0,0,0] },
    { cat: 'misc',   out: B.ENDER_CHEST_BLOCK,qty: 1, req: [{ id: B.OBSIDIAN, qty: 8 }, { id: B.ENDER_EYE, qty: 1 }], grid: [B.OBSIDIAN,B.OBSIDIAN,B.OBSIDIAN, B.OBSIDIAN,B.ENDER_EYE,B.OBSIDIAN, B.OBSIDIAN,B.OBSIDIAN,B.OBSIDIAN] },
    { cat: 'misc',   out: B.NOTE_BLOCK,       qty: 1, req: [{ id: B.PLANKS, qty: 8, anyPlanks: true }, { id: B.REDSTONE, qty: 1 }], grid: [B.PLANKS,B.PLANKS,B.PLANKS, B.PLANKS,B.REDSTONE,B.PLANKS, B.PLANKS,B.PLANKS,B.PLANKS] },
    { cat: 'misc',   out: B.CANDLE,           qty: 2, is2x2: true, req: [{ id: B.TORCH_BLOCK, qty: 1 }, { id: B.WHITE_WOOL, qty: 1 }], grid: [B.TORCH_BLOCK,0,0, B.WHITE_WOOL,0,0, 0,0,0] },
    { cat: 'misc',   out: B.MUSIC_DISC_5,     qty: 1, req: [{ id: B.DISC_FRAGMENT_5, qty: 9 }], grid: [B.DISC_FRAGMENT_5,B.DISC_FRAGMENT_5,B.DISC_FRAGMENT_5, B.DISC_FRAGMENT_5,B.DISC_FRAGMENT_5,B.DISC_FRAGMENT_5, B.DISC_FRAGMENT_5,B.DISC_FRAGMENT_5,B.DISC_FRAGMENT_5] },
    { cat: 'food',   out: B.NIGHT_VISION_POTION, qty: 1, req: [{ id: B.GOLDEN_CARROT, qty: 1 }, { id: B.GLASS, qty: 1 }, { id: B.GLOW_CRYSTAL, qty: 1 }], grid: [0,B.GOLDEN_CARROT,0, B.GLOW_CRYSTAL,B.GLASS,0, 0,0,0] },
    // Dragon Scale Armor, Dragon Bone Weapons & Dragon Riding Saddle (Sift Aetherium + Dragon Scale)
    { cat: 'tools',  out: B.DRAGON_HELMET,    qty: 1, req: [{ id: B.DRAGON_SCALE, qty: 5 }], grid: [B.DRAGON_SCALE,B.DRAGON_SCALE,B.DRAGON_SCALE, B.DRAGON_SCALE,0,B.DRAGON_SCALE, 0,0,0] },
    { cat: 'tools',  out: B.DRAGON_CHEST,     qty: 1, req: [{ id: B.DRAGON_SCALE, qty: 8 }], grid: [B.DRAGON_SCALE,0,B.DRAGON_SCALE, B.DRAGON_SCALE,B.DRAGON_SCALE,B.DRAGON_SCALE, B.DRAGON_SCALE,B.DRAGON_SCALE,B.DRAGON_SCALE] },
    { cat: 'tools',  out: B.DRAGON_LEGS,      qty: 1, req: [{ id: B.DRAGON_SCALE, qty: 7 }], grid: [B.DRAGON_SCALE,B.DRAGON_SCALE,B.DRAGON_SCALE, B.DRAGON_SCALE,0,B.DRAGON_SCALE, B.DRAGON_SCALE,0,B.DRAGON_SCALE] },
    { cat: 'tools',  out: B.DRAGON_BOOTS,     qty: 1, req: [{ id: B.DRAGON_SCALE, qty: 4 }], grid: [0,0,0, B.DRAGON_SCALE,0,B.DRAGON_SCALE, B.DRAGON_SCALE,0,B.DRAGON_SCALE] },
    { cat: 'tools',  out: B.DRAGON_BONE_SWORD,qty: 1, req: [{ id: B.DRAGON_BONE, qty: 2 }, { id: B.DRAGON_SCALE, qty: 1 }], grid: [0,B.DRAGON_SCALE,0, 0,B.DRAGON_BONE,0, 0,B.DRAGON_BONE,0] },
    { cat: 'tools',  out: B.DRAGON_BONE_AXE,  qty: 1, req: [{ id: B.DRAGON_BONE, qty: 2 }, { id: B.DRAGON_SCALE, qty: 3 }], grid: [B.DRAGON_SCALE,B.DRAGON_SCALE,0, B.DRAGON_SCALE,B.DRAGON_BONE,0, 0,B.DRAGON_BONE,0] },
    { cat: 'tools',  out: B.DRAGON_BONE_PICK, qty: 1, req: [{ id: B.DRAGON_BONE, qty: 2 }, { id: B.DRAGON_SCALE, qty: 3 }], grid: [B.DRAGON_SCALE,B.DRAGON_SCALE,B.DRAGON_SCALE, 0,B.DRAGON_BONE,0, 0,B.DRAGON_BONE,0] },
    { cat: 'tools',  out: B.DRAGON_BONE_BOW,  qty: 1, req: [{ id: B.DRAGON_BONE, qty: 3 }, { id: B.DRAGON_SCALE, qty: 2 }], grid: [0,B.DRAGON_BONE,B.DRAGON_SCALE, B.DRAGON_BONE,0,B.DRAGON_SCALE, 0,B.DRAGON_BONE,0] },
    { cat: 'tools',  out: B.DRAGON_SADDLE,    qty: 1, req: [{ id: B.AETHERIUM_ORE, qty: 2 }, { id: B.DRAGON_SCALE, qty: 5 }], grid: [B.DRAGON_SCALE,B.AETHERIUM_ORE,B.DRAGON_SCALE, B.DRAGON_SCALE,B.AETHERIUM_ORE,B.DRAGON_SCALE, B.DRAGON_SCALE,0,0] },
    { cat: 'tools',  out: B.DRAGON_SADDLE,    qty: 1, req: [{ id: B.AETHERIUM_INGOT, qty: 2 }, { id: B.DRAGON_SCALE, qty: 5 }], grid: [B.DRAGON_SCALE,B.AETHERIUM_INGOT,B.DRAGON_SCALE, B.DRAGON_SCALE,B.AETHERIUM_INGOT,B.DRAGON_SCALE, B.DRAGON_SCALE,0,0] }
  ];

  const BIOMES = {
    PLAINS:           { id: 0,  name: 'Đồng Bằng' },
    FOREST:           { id: 1,  name: 'Rừng Rậm' },
    DESERT:           { id: 2,  name: 'Sa Mạc' },
    SNOW:             { id: 3,  name: 'Đỉnh Tuyết' },
    SAKURA:           { id: 4,  name: 'Rừng Anh Đào' },
    SWAMP:            { id: 5,  name: 'Đầm Lầy' },
    MESA:             { id: 6,  name: 'Cao Nguyên Đá Đỏ' },
    AUTUMN:           { id: 7,  name: 'Rừng Mùa Thu' },
    LUSH_GROVE:       { id: 8,  name: 'Rừng Rêu Cổ Đại' },
    FLOWER_MEADOW:    { id: 9,  name: 'Thảo Nguyên Hoa' },
    TAIGA:            { id: 10, name: 'Rừng Thông Taiga' },
    NETHER_CRIMSON:   { id: 11, name: 'Địa Ngục • Rừng Đỏ Thẫm' },
    NETHER_WARPED:    { id: 12, name: 'Địa Ngục • Rừng Biến Dị' },
    NETHER_WASTES:    { id: 13, name: 'Địa Ngục • Biển Dung Nham' },
    THE_END:          { id: 14, name: 'Khu Kết Thúc (The End)' },
    BEACH_PALM:       { id: 15, name: 'Bờ Biển Dừa Nhiệt Đới' },
    MANGROVE_SWAMP:   { id: 16, name: 'Đầm Lầy Rừng Ngập Mặn' },
    ALPINE_PEAKS:     { id: 17, name: 'Dãy Núi Tuyết Cao' },
    HIGHLAND_PLATEAU: { id: 18, name: 'Cao Nguyên Hùng Vĩ' },
    DEEP_OCEAN:       { id: 19, name: 'Đại Dương & Rạn San Hô' },
    BAMBOO_JUNGLE:    { id: 20, name: 'Rừng Trúc Xanh' },
    MUSHROOM_ISLAND:  { id: 21, name: 'Đảo Nấm Khổng Lồ' },
    LAVENDER_MEADOW:  { id: 22, name: 'Thảo Nguyên Oải Hương' },
    VOLCANIC_BASALT:  { id: 23, name: 'Đồng Tro Núi Lửa' },
    ABANDONED_CITY:   { id: 24, name: 'Đại Đô Thị Hiện Đại Bỏ Hoang' },
    REDWOOD_ANCIENT:  { id: 25, name: 'Rừng Cổ Thụ Khổng Lồ (Sequoia)' },
    WEEPING_GROVE:    { id: 26, name: 'Rừng Cổ Thụ Dây Leo Rủ' },
    BIRCH_ANCIENT:    { id: 27, name: 'Rừng Bạch Dương Cổ Thụ' },
    AUTUMN_GOLDEN:    { id: 28, name: 'Rừng Thu Vàng Óng' },
    AUTUMN_DEEP:      { id: 29, name: 'Rừng Thu Sâu & Trại Bỏ Hoang' },
    ABYSS_TRENCH:     { id: 30, name: 'Vực Biển Siêu Sâu (Abyss Trench)' },
    // ===== v24: 8 biome mới lấy cảm hứng từ bộ ảnh trong biom/ =====
    GLOWSHROOM_GROVE: { id: 31, name: 'Rừng Nấm Phát Sáng' },
    DAPPLED_FOREST:   { id: 32, name: 'Rừng Tán Lá Mùa Thu' },
    BADLANDS_SPIRES:  { id: 33, name: 'Trụ Đá Đỏ Badlands' },
    BADLANDS_CRATER:  { id: 34, name: 'Hố Đá Đỏ Khổng Lồ' },
    MARSH_RUINS:      { id: 35, name: 'Đầm Lầy Phế Tích' },
    TROPICAL_COAST:   { id: 36, name: 'Bờ Biển Nhiệt Đới' },
    GIANT_TREES:      { id: 37, name: 'Rừng Đại Thụ' },
    MANOR_GARDEN:     { id: 38, name: 'Vườn Trang Viên' },
    SIFT_MEADOW:      { id: 40, name: "The Sift • Singer's Meadow" },
    SIFT_HUSKLAND:    { id: 41, name: 'The Sift • Humbler Huskland' },
    SIFT_LULLABY:     { id: 42, name: 'The Sift • Lullaby Hills' },
    SIFT_LULLABY_TOP: { id: 43, name: 'The Sift • Lullaby Hilltop' },
    SIFT_SPOREFIELDS: { id: 44, name: 'The Sift • Fungal Sporefields' },
    SIFT_CHORAL_GLEN: { id: 45, name: 'The Sift • Choral Glen' },
    SIFT_CANYON:      { id: 46, name: 'The Sift • Sifter Canyon' },
    SIFT_WILD:        { id: 47, name: 'The Sift • Wild Meadows' },
    SIFT_ICHOR_PONDS: { id: 48, name: 'The Sift • Ichor Ponds' },
    SIFT_ECHO_DEN:    { id: 49, name: 'The Sift • The Echo Den' },
    BLUE_FOREST:      { id: 50, name: 'Rừng Xanh Lam Huyền Ảo' },
    WHEAT_VALLEY:     { id: 51, name: 'Cánh Đồng Lúa' },
    PINE_VALLEY:      { id: 52, name: 'Thung Lũng Thông & Nhà Thợ Rèn' },
    GIANT_JUNGLE:     { id: 53, name: 'Rừng Nhiệt Đới Đại Thụ' },
    CLOUD_PEAKS:      { id: 54, name: 'Đỉnh Núi Vượt Mây' }
  };
  const BIOME_LIST = [];
  for (const _b of Object.values(BIOMES)) BIOME_LIST[_b.id] = _b;

  /* ============================================================================
   * 1B. UNIFIED ARMOR PALETTES, 64x64 ARMOR TEXTURES & 7-COLOR DREAM RAINBOW ENGINE
   * ============================================================================ */
  const ARMOR_TIER_PAL = {
    leather:     { main: '#9a5428', hi: '#c27742', dark: '#5e3013', glint: '#e5a973', trim: '#5c2d10', hex: 0x9a5428, rough: 0.80, metal: 0.05 },
    chainmail:   { main: '#9aa4b2', hi: '#d6dde6', dark: '#3e4652', glint: '#f8fafc', trim: '#64748b', hex: 0x9aa4b2, rough: 0.42, metal: 0.50 },
    copper:      { main: '#c86b3c', hi: '#eb9a68', dark: '#6d3116', glint: '#ffdcb8', trim: '#52b788', hex: 0xc86b3c, rough: 0.30, metal: 0.55 },
    iron:        { main: '#cfd8e3', hi: '#eef3f8', dark: '#6c7a8d', glint: '#ffffff', trim: '#94a3b8', hex: 0xd4dce6, rough: 0.34, metal: 0.45 },
    gold:        { main: '#f6c828', hi: '#fef08a', dark: '#a16207', glint: '#ffffff', trim: '#fbbf24', hex: 0xfacc15, rough: 0.26, metal: 0.62 },
    turtle:      { main: '#3fa34d', hi: '#76d474', dark: '#1a4d22', glint: '#c6f8b0', trim: '#2d6a4f', hex: 0x3fa34d, rough: 0.55, metal: 0.12 },
    diamond:     { main: '#2ce6dc', hi: '#7ffcf3', dark: '#0e7c86', glint: '#ffffff', trim: '#19b5bd', hex: 0x2ce6dc, rough: 0.24, metal: 0.32 },
    emerald:     { main: '#10b981', hi: '#6ee7b7', dark: '#065f46', glint: '#fef08a', trim: '#facc15', hex: 0x10b981, rough: 0.24, metal: 0.42, emit: 0.14 },
    ruby:        { main: '#e11d48', hi: '#fb7185', dark: '#881337', glint: '#fef08a', trim: '#facc15', hex: 0xe11d48, rough: 0.26, metal: 0.40 },
    amethyst:    { main: '#a855f7', hi: '#e9d5ff', dark: '#581c87', glint: '#ffffff', trim: '#f0abfc', hex: 0xa855f7, rough: 0.20, metal: 0.46, emit: 0.22 },
    obsidian:    { main: '#312e81', hi: '#6366f1', dark: '#0f0a24', glint: '#c4b5fd', trim: '#818cf8', hex: 0x4338ca, rough: 0.28, metal: 0.62, emit: 0.20 },
    netherite:   { main: '#443d44', hi: '#6a6169', dark: '#221e23', glint: '#918791', trim: '#322d33', hex: 0x443d44, rough: 0.34, metal: 0.60 },
    ender:       { main: '#5b21b6', hi: '#c084fc', dark: '#1e0b36', glint: '#f5d0fe', trim: '#e879f9', hex: 0x7e22ce, rough: 0.24, metal: 0.52, emit: 0.24 },
    solaris:     { main: '#ea580c', hi: '#fbbf24', dark: '#450a0a', glint: '#fef08a', trim: '#facc15', hex: 0xf97316, rough: 0.22, metal: 0.60, emit: 0.30 },
    celestial:   { main: '#0284c7', hi: '#67e8f9', dark: '#0f172a', glint: '#ecfeff', trim: '#a5f3fc', hex: 0x22d3ee, rough: 0.18, metal: 0.48, emit: 0.36 },
    moonstone:   { main: '#a5b4fc', hi: '#e0e7ff', dark: '#3730a3', glint: '#ffffff', trim: '#bae6fd', hex: 0x818cf8, rough: 0.20, metal: 0.56, emit: 0.24, rainbow: true, waterSeed: 0.0, style: 'moon' },
    ichor:       { main: '#f472b6', hi: '#fbcfe8', dark: '#831843', glint: '#ffffff', trim: '#fde047', hex: 0xf472b6, rough: 0.22, metal: 0.50, emit: 0.25, rainbow: true, waterSeed: 1.2, style: 'ichor' },
    nebula:      { main: '#c084fc', hi: '#f3e8ff', dark: '#4c1d95', glint: '#ffffff', trim: '#e2e8f0', hex: 0xc084fc, rough: 0.18, metal: 0.64, emit: 0.26, rainbow: true, waterSeed: 2.5, style: 'nebula' },
    aetherium:   { main: '#22d3ee', hi: '#cffafe', dark: '#155e75', glint: '#ffffff', trim: '#f8fafc', hex: 0x22d3ee, rough: 0.18, metal: 0.60, emit: 0.27, rainbow: true, waterSeed: 3.8, style: 'aether' },
    dragon:      { main: '#b91c1c', hi: '#f87171', dark: '#450a0a', glint: '#fde047', trim: '#f59e0b', hex: 0xdc2626, rough: 0.28, metal: 0.45, emit: 0.18 },
    dragon_head: { main: '#1e1b24', hi: '#4b4558', dark: '#09080c', glint: '#d946ef', trim: '#c026d3', hex: 0x262130, rough: 0.55, metal: 0.18, emit: 0.12 },
    elytra:      { main: '#7e7d99', hi: '#abaac7', dark: '#424156', glint: '#c7d2fe', trim: '#52516b', hex: 0x7e7d99, rough: 0.50, metal: 0.25 },
    dream_prism: { main: '#38e8e1', hi: '#ffffff', dark: '#3b0764', glint: '#ffffff', trim: '#f8fafc', hex: 0x69b8ff, rough: 0.16, metal: 0.68, emit: 0.28, rainbow: true, waterSeed: 5.1, style: 'prism' }
  };
  const TRIM_MATERIALS = {
    [B.QUARTZ_ORE]:      { id: 'quartz',    label: 'Thạch Anh',  hex: '#e3d4c4', hi: '#fff8f0', dark: '#b4a595' },
    [B.IRON_INGOT]:      { id: 'iron',      label: 'Sắt',        hex: '#ececec', hi: '#ffffff', dark: '#9ea6b2', sameDark: '#7b838f' },
    [B.NETHERITE_INGOT]: { id: 'netherite', label: 'Netherite',  hex: '#625859', hi: '#82777a', dark: '#2b2429', sameDark: '#2b2429' },
    [B.REDSTONE]:        { id: 'redstone',  label: 'Đá Đỏ',      hex: '#b81d13', hi: '#ef4444', dark: '#6d0e0a' },
    [B.COPPER_INGOT]:    { id: 'copper',    label: 'Đồng',       hex: '#b4684d', hi: '#e28f6e', dark: '#7a3c24', sameDark: '#7a3c24' },
    [B.GOLD_INGOT]:      { id: 'gold',      label: 'Vàng',       hex: '#deb12d', hi: '#fef08a', dark: '#a16207', sameDark: '#a8760e' },
    [B.EMERALD]:         { id: 'emerald',   label: 'Lục Bảo',    hex: '#11a036', hi: '#4ade80', dark: '#0b6b28', sameDark: '#0b6b28' },
    [B.DIAMOND]:         { id: 'diamond',   label: 'Kim Cương',  hex: '#2cbab4', hi: '#7ffcf3', dark: '#1b7a8c', sameDark: '#1b7a8c' },
    [B.LAPIS_ORE]:       { id: 'lapis',     label: 'Lưu Ly',     hex: '#21497b', hi: '#60a5fa', dark: '#152e52' },
    [B.GLOW_CRYSTAL]:    { id: 'amethyst',  label: 'Thạch Tím',  hex: '#9a5cc6', hi: '#d8b4fe', dark: '#6b3296', sameDark: '#6b3296' },
    [B.RUBY]:            { id: 'ruby',      label: 'Hồng Ngọc',  hex: '#f43f5e', hi: '#fda4af', dark: '#9f1239', sameDark: '#9f1239' }
  };
  function resolveTrimColors(armorTier, trim) {
    if (!trim) return null;
    let mat = trim.matId ? TRIM_MATERIALS[trim.matId] : null;
    if (!mat && trim.id) mat = Object.values(TRIM_MATERIALS).find(x => x.id === trim.id) || null;
    const rawHex = (trim.hex || mat?.hex || '#d8dce0');
    const isSame = !!(mat && armorTier && (armorTier === mat.id || (armorTier === 'gem' && mat.id === 'diamond')));
    const main = (isSame && mat.sameDark) ? mat.sameDark : rawHex;
    const hi = isSame ? rawHex : (mat?.hi || rawHex);
    const dark = mat?.dark || main;
    const hexInt = parseInt(main.replace('#', ''), 16) || 0xd8dce0;
    return { main, hi, dark, hexInt };
  }
  const SMITH_UPGRADE_MAP = {
    [B.DIAMOND_HELMET]: B.NETHERITE_HELMET, [B.DIAMOND_ARMOR]: B.NETHERITE_ARMOR,
    [B.DIAMOND_LEGS]:   B.NETHERITE_LEGS,   [B.DIAMOND_BOOTS]: B.NETHERITE_BOOTS,
    [B.DIAMOND_PICK]:   B.NETHERITE_PICK,   [B.DIAMOND_SWORD]: B.NETHERITE_SWORD,
    [B.DIAMOND_AXE]:    B.NETHERITE_AXE,    [B.DIAMOND_SHOVEL]: B.NETHERITE_SHOVEL,
    [B.DIAMOND_HOE]:    B.NETHERITE_HOE
  };

  // 7 Pastel Dream-Water Hues (matching Dream Pond Reference: Pink, Peach, Gold, Mint, Aqua, Sky, Lavender)
  const DREAM_WATER_STOPS = [
    [255, 135, 198], [255, 184, 120], [255, 240, 138], [110, 242, 168],
    [56,  232, 225], [105, 184, 255], [194, 139, 255]
  ];
  function sampleDreamWaterRGB(u, v, seed = 0) {
    const wx = u * 4.4 + Math.sin(v * 6.8 + seed) * 0.65 + Math.cos((u + v) * 5.2 - seed * 0.7) * 0.35;
    const wy = v * 4.4 + Math.cos(u * 6.4 - seed) * 0.65;
    const t = ((wx * 0.75 + wy * 0.85 + seed * 0.31) % 7 + 7) % 7;
    const i0 = t | 0, i1 = (i0 + 1) % 7, f = t - i0, s = f * f * (3 - 2 * f);
    const a = DREAM_WATER_STOPS[i0], b = DREAM_WATER_STOPS[i1];
    return [
      Math.round(a[0] + (b[0] - a[0]) * s),
      Math.round(a[1] + (b[1] - a[1]) * s),
      Math.round(a[2] + (b[2] - a[2]) * s)
    ];
  }
  const dreamSwatchTexCache = new Map();
  function getDreamWaterSwatchTex(seed = 0) {
    const k = String(seed);
    if (dreamSwatchTexCache.has(k)) return dreamSwatchTexCache.get(k);
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const [r, g, b] = sampleDreamWaterRGB(x / 16, y / 16, seed);
      const lift = ((x * 3 + y * 5) & 7) === 0 ? 1.16 : 0.96;
      c.fillStyle = `rgb(${Math.min(255, (r * lift) | 0)},${Math.min(255, (g * lift) | 0)},${Math.min(255, (b * lift) | 0)})`;
      c.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    dreamSwatchTexCache.set(k, tex);
    return tex;
  }

  const _rainbowMats = new Set();
  const _dreamIconsLive = document.getElementsByClassName('dream-rainbow-icon');
  let _dreamRainbowHue = 0, _lastDreamHueDeg = -999;
  function applyRainbowToMat(mat, tPhase) {
    if (!mat || !mat.color) return;
    const ud = mat.userData || {};
    mat.color.setHex(0xffffff);
    if (mat.emissive) {
      const h = ((0.54 + Math.sin(tPhase * 6.2832) * 0.16) % 1 + 1) % 1;
      mat.emissive.setHSL(h, 0.72, 0.24);
      mat.emissiveIntensity = (ud.isRainbowItem ? 0.24 : (ud.isArmorRelief ? 0.26 : 0.20)) + 0.08 * Math.sin(tPhase * 12.566);
    }
  }
  function tickDreamRainbow(tSec) {
    if (_dreamIconsLive.length === 0 && _rainbowMats.size === 0) return;
    if (typeof invDrag !== 'undefined' && invDrag.active) return;
    _dreamRainbowHue = (tSec * 0.14) % 1.0;
    const invOpen = typeof _elInvModal !== 'undefined' && _elInvModal && !_elInvModal.classList.contains('hidden');
    if (_dreamIconsLive.length > 0 && !(invOpen && (_isMobilePerf || _isWeakDevice))) {
      const deg = Math.round(Math.sin(tSec * 1.1) * 18);
      if (Math.abs(deg - _lastDreamHueDeg) >= (invOpen ? 5 : 2)) {
        _lastDreamHueDeg = deg;
        const bri = (1.04 + Math.sin(tSec * 2.2) * 0.05).toFixed(2);
        document.documentElement.style.setProperty('--dream-hue', deg + 'deg');
        document.documentElement.style.setProperty('--dream-bri', bri);
      }
    }
    if (!invOpen && _rainbowMats.size > 0 && (!_isWeakDevice || (frameCounter & 1) === 0)) {
      for (const mat of _rainbowMats) applyRainbowToMat(mat, _dreamRainbowHue);
    }
  }

  const armorTexCache = new Map();
  function getArmorTexture(tier, trim = null) {
    const key = ARMOR_TIER_PAL[tier] ? tier : 'iron';
    const trimKey = (trim && trim.pattern) ? `${trim.pattern}:${trim.matId || trim.hex || ''}` : '';
    const cacheKey = trimKey ? `${key}:${trimKey}` : key;
    if (armorTexCache.has(cacheKey)) return armorTexCache.get(cacheKey);
    const p = ARMOR_TIER_PAL[key];
    const isDream = !!p.rainbow;
    const wSeed = p.waterSeed || 0;
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 64, 64);
    const dwCol = (x, y, role) => {
      const [r, g, b] = sampleDreamWaterRGB((x % 32) / 16, (y % 32) / 16, wSeed);
      if (role === 'glint') return '#ffffff';
      if (role === 'trim') return `rgb(${Math.min(255, Math.round(r * 0.5 + 128))},${Math.min(255, Math.round(g * 0.5 + 128))},${Math.min(255, Math.round(b * 0.5 + 128))})`;
      if (role === 'hi')   return `rgb(${Math.min(255, Math.round(r * 0.72 + 72))},${Math.min(255, Math.round(g * 0.72 + 72))},${Math.min(255, Math.round(b * 0.72 + 72))})`;
      if (role === 'edge') return `rgb(${Math.round(r * 0.44)},${Math.round(g * 0.44)},${Math.round(b * 0.44)})`;
      if (role === 'dark') return `rgb(${Math.round(r * 0.72)},${Math.round(g * 0.72)},${Math.round(b * 0.72)})`;
      return `rgb(${r},${g},${b})`;
    };
    const px = (x, y, w, h, col, role = 'main') => {
      if (!isDream) { c.fillStyle = col; c.fillRect(x, y, w, h); return; }
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        c.fillStyle = dwCol(x + xx, y + yy, role);
        c.fillRect(x + xx, y + yy, 1, 1);
      }
    };
    const plate = (x0, y0, w, h) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const edge = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
        const hsh = ((x * 53 + y * 97 + x0 * 13) ^ (y0 * 29)) & 7;
        const role = edge ? 'edge' : (hsh <= 1 ? 'dark' : (hsh >= 6 ? 'hi' : 'main'));
        const col = edge ? p.dark : (hsh <= 1 ? p.dark : (hsh >= 6 ? p.hi : p.main));
        px(x0 + x, y0 + y, 1, 1, col, role);
      }
      if (w > 2 && h > 2) { px(x0 + 1, y0 + 1, w - 2, 1, p.hi, 'hi'); px(x0 + 1, y0 + 1, 1, h - 2, p.hi, 'hi'); }
    };

    // 1) HELMET (u=0, v=0, 8x8x8)
    plate(8, 0, 8, 8); px(10, 1, 2, 2, p.glint, 'glint');
    plate(0, 8, 8, 5); plate(0, 13, 5, 2);
    plate(16, 8, 8, 5); plate(19, 13, 5, 2);
    plate(24, 8, 8, 7);
    plate(8, 8, 8, 3);
    px(9, 8, 2, 1, p.glint, 'glint');
    px(11, 10, 2, 3, p.main, 'main'); px(11, 10, 1, 2, p.hi, 'hi');
    px(8, 11, 1, 3, p.dark, 'edge'); px(15, 11, 1, 3, p.dark, 'edge');
    if (key === 'netherite' || key === 'obsidian') {
      px(8, 11, 1, 4, p.main); px(15, 11, 1, 4, p.main);
      px(11, 8, 2, 4, p.hi);
    } else if (key === 'ruby' || key === 'gold' || key === 'emerald' || key === 'amethyst' || isDream) {
      px(10, 8, 4, 1, p.trim, 'trim'); px(11, 9, 2, 2, p.trim, 'trim');
    }

    // 2) CHESTPLATE (u=16, v=16, 8x12x4)
    px(20, 16, 2, 4, p.main, 'main'); px(26, 16, 2, 4, p.main, 'main');
    plate(16, 20, 4, 12); plate(28, 20, 4, 12);
    plate(20, 20, 8, 12);
    c.clearRect(22, 20, 4, 1); c.clearRect(23, 21, 2, 1);
    px(21, 21, 1, 2, p.glint, 'glint'); px(22, 22, 2, 1, p.glint, 'glint'); px(21, 25, 1, 2, p.glint, 'glint');
    px(20, 29, 8, 2, p.dark, 'dark'); px(22, 29, 4, 2, p.trim, 'trim');
    plate(32, 20, 8, 12); c.clearRect(34, 20, 4, 1);
    px(35, 22, 2, 7, p.hi, 'hi'); px(32, 29, 8, 2, p.dark, 'dark');
    if (['ruby','emerald','amethyst','obsidian','ender','solaris','celestial','dragon'].includes(key) || isDream) {
      px(21, 22, 6, 2, p.trim, 'trim'); px(22, 24, 4, 2, p.trim, 'trim'); px(23, 26, 2, 2, p.glint, 'glint');
      px(33, 22, 6, 2, p.trim, 'trim'); px(34, 24, 4, 2, p.trim, 'trim');
    } else if (key === 'netherite') {
      for (let ry = 23; ry <= 27; ry += 2) { px(21, ry, 6, 1, p.dark); px(33, ry, 6, 1, p.dark); }
    } else if (key === 'chainmail') {
      for (let ry = 21; ry <= 28; ry++) for (let rx = 20; rx <= 27; rx++) if ((rx + ry) % 2 === 0) px(rx, ry, 1, 1, p.dark);
    }

    // 3) ARMORED UPPER-ARM SLEEVES (u=40, v=16)
    plate(44, 16, 4, 4); px(45, 17, 2, 1, p.glint, 'glint');
    for (const ax of [40, 44, 48, 52]) {
      plate(ax, 20, 4, 6);
      px(ax + 1, 21, 2, 1, p.glint, 'glint');
      px(ax, 25, 4, 1, p.trim, 'trim');
      if (key === 'netherite' || key === 'obsidian') { px(ax, 25, 1, 2, p.dark); px(ax + 3, 25, 1, 2, p.dark); }
    }

    // 4) LEGGINGS
    plate(16, 52, 4, 4); plate(20, 52, 8, 4); plate(28, 52, 4, 4); plate(32, 52, 8, 4);
    px(23, 52, 2, 2, p.trim, 'trim');
    plate(4, 32, 4, 4);
    for (const lx of [0, 4, 8, 12]) {
      plate(lx, 36, 4, 9);
      px(lx + 1, 38, 1, 4, p.hi, 'hi');
      if (key === 'ruby' || key === 'emerald' || key === 'amethyst' || isDream) px(lx, 37, 4, 1, p.trim, 'trim');
    }

    // 5) BOOTS
    plate(8, 48, 4, 4);
    for (const bx of [0, 4, 8, 12]) {
      plate(bx, 59, 4, 5);
      px(bx, 59, 4, 1, p.trim, 'trim');
      px(bx + 1, 60, 1, 1, p.glint, 'glint');
      px(bx + 1, 62, 1, 1, p.glint, 'glint');
      px(bx, 63, 4, 1, p.dark, 'edge');
    }

    // 6) MINECRAFT 1.21 ARMOR TRIM PATTERNS ON 64x64 TEXTURE (distinct motif per Smithing Template!)
    const tr = resolveTrimColors(key, trim);
    if (tr) {
      const pat = (trim.pattern || 'wild').toLowerCase();
      const tc = (x, y, w = 1, h = 1, col = tr.main) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
      // Helmet Trim: top crown rim + brow + sides/back per pattern
      tc(8, 0, 8, 1, tr.hi); tc(8, 7, 8, 1, tr.dark); tc(8, 8, 8, 1, tr.hi);
      tc(0, 9, 8, 1, tr.main); tc(16, 9, 8, 1, tr.main); tc(24, 9, 8, 1, tr.main);
      if (pat === 'wild' || pat === 'snout' || pat === 'spire') { tc(10, 9, 1, 2, tr.main); tc(13, 9, 1, 2, tr.main); tc(9, 1, 6, 1, tr.main); }
      else if (pat === 'eye' || pat === 'sentry' || pat === 'ward') { tc(11, 8, 2, 2, tr.hi); tc(11, 2, 2, 3, tr.main); }
      else if (pat === 'silence') { tc(8, 8, 8, 2, tr.main); tc(9, 1, 6, 6, tr.dark); tc(10, 2, 4, 4, tr.hi); }

      // Chestplate Trim (Front 20..27 x 20..31, Back 32..39 x 20..31, Sleeves 40..55 x 20..25)
      if (pat === 'wild') {
        tc(20, 21, 8, 1, tr.main); tc(21, 23, 2, 1, tr.hi); tc(25, 23, 2, 1, tr.hi);
        tc(22, 24, 4, 1, tr.main); tc(21, 26, 2, 1, tr.main); tc(25, 26, 2, 1, tr.main);
        tc(20, 28, 8, 1, tr.main); tc(33, 22, 6, 1, tr.main); tc(34, 25, 4, 2, tr.hi);
      } else if (pat === 'silence') {
        tc(20, 21, 8, 1, tr.hi); tc(21, 22, 6, 6, tr.main); tc(22, 23, 4, 4, tr.hi); tc(20, 29, 8, 2, tr.main);
        tc(32, 21, 8, 1, tr.hi); tc(33, 22, 6, 6, tr.main);
      } else if (pat === 'ward' || pat === 'rib') {
        for (const ry of [21, 23, 25, 27]) { tc(21, ry, 6, 1, ry === 21 ? tr.hi : tr.main); tc(33, ry, 6, 1, tr.main); }
        tc(23, 22, 2, 7, tr.hi);
      } else if (pat === 'dune' || pat === 'eye' || pat === 'spire') {
        tc(22, 22, 4, 1, tr.hi); tc(21, 23, 6, 2, tr.main); tc(23, 23, 2, 2, tr.hi); tc(22, 25, 4, 1, tr.main);
        tc(20, 28, 8, 1, tr.dark); tc(33, 23, 6, 2, tr.main);
      } else if (pat === 'tide' || pat === 'coast' || pat === 'flow' || pat === 'bolt') {
        tc(20, 22, 3, 1, tr.hi); tc(25, 22, 3, 1, tr.hi); tc(21, 24, 6, 1, tr.main);
        tc(22, 26, 4, 1, tr.hi); tc(20, 29, 8, 1, tr.main); tc(32, 24, 8, 1, tr.main);
      } else {
        // Snout, Sentry, Vex, Wayfinder, Raiser, Shaper, Host
        tc(21, 21, 6, 1, tr.hi); tc(22, 23, 4, 3, tr.main); tc(20, 29, 8, 1, tr.main); tc(23, 28, 2, 2, tr.hi);
        tc(33, 22, 6, 1, tr.main); tc(34, 24, 4, 2, tr.hi);
      }
      for (const ax of [40, 44, 48, 52]) {
        tc(ax, 20, 4, 1, tr.hi);
        tc(ax + 1, 22, 2, 2, pat === 'silence' ? tr.hi : tr.main);
        tc(ax, 24, 4, 1, tr.main);
      }

      // Leggings Trim (Waist 16..39 x 52..55 & Legs 0..15 x 36..44)
      tc(20, 52, 8, 1, tr.hi); tc(20, 54, 8, 1, tr.main); tc(32, 52, 8, 1, tr.main);
      for (const lx of [0, 4, 8, 12]) {
        tc(lx, 36, 4, 1, tr.hi);
        if (pat === 'wild' || pat === 'flow' || pat === 'bolt') {
          tc(lx + 1, 38, 2, 2, tr.main); tc(lx + 2, 40, 1, 2, tr.hi); tc(lx, 43, 4, 1, tr.main);
        } else {
          tc(lx + 1, 38, 2, 1, tr.main); tc(lx, 42, 4, 1, tr.main); tc(lx, 43, 4, 1, tr.dark);
        }
      }

      // Boots Trim (Cuff + Toe cap on 0..15 x 59..63)
      for (const bx of [0, 4, 8, 12]) {
        tc(bx, 59, 4, 1, tr.hi);
        tc(bx, 61, 4, 1, tr.main);
        tc(bx + 1, 62, 2, 1, tr.hi);
      }
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    armorTexCache.set(cacheKey, tex);
    return tex;
  }

  const armorIconCache = new Map();
  // Exact 16x16 Canonical Minecraft Armor Silhouettes (matching classic Java/Bedrock pixel sheets)
  const ARMOR_ICON_MAPS = {
    helmet: [
      '................',
      '................',
      '................',
      '....11111111....',
      '...1223443221...',
      '..123443222221..',
      '..123432222221..',
      '..122222222221..',
      '..122111111221..',
      '..1221....1221..',
      '..1221....1221..',
      '...111....111...',
      '................',
      '................',
      '................',
      '................'
    ],
    chest: [
      '................',
      '..1111....1111..',
      '.12332111122221.',
      '.12443222223221.',
      '.12332222222221.',
      '.12222222222221.',
      '..111223322111..',
      '...1223222221...',
      '...1222222221...',
      '...1222222221...',
      '...1222222221...',
      '...1222222221...',
      '...1222222221...',
      '....11111111....',
      '................',
      '................'
    ],
    legs: [
      '................',
      '...1111111111...',
      '...1344322221...',
      '...1233222221...',
      '...1222112221...',
      '...1231..1221...',
      '...1221..1221...',
      '...1221..1221...',
      '...1221..1221...',
      '...1221..1221...',
      '...1221..1221...',
      '...1221..1221...',
      '...1221..1221...',
      '...1111..1111...',
      '................',
      '................'
    ],
    boots: [
      '................',
      '................',
      '................',
      '................',
      '...1111..1111...',
      '...1341..1321...',
      '...1231..1221...',
      '...1221..1221...',
      '..11221..12211..',
      '.132221..122321.',
      '.122221..122221.',
      '.122221..122221.',
      '.111111..111111.',
      '................',
      '................',
      '................'
    ]
  };
  function getArmorIconCanvas(slot, tier, trim = null) {
    const tKey = ARMOR_TIER_PAL[tier] ? tier : 'iron';
    const trimKey = (trim && trim.pattern) ? `${trim.pattern}:${trim.matId || trim.hex || ''}` : '';
    const key = trimKey ? `${slot}:${tKey}:${trimKey}` : `${slot}:${tKey}`;
    if (armorIconCache.has(key)) return armorIconCache.get(key);
    const pal = ARMOR_TIER_PAL[tKey];
    const rows = ARMOR_ICON_MAPS[slot] || ARMOR_ICON_MAPS.chest;
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    const isDream = !!pal.rainbow;
    const wSeed = pal.waterSeed || 0;
    const cmap = { '1': pal.dark, '2': pal.main, '3': pal.hi, '4': pal.glint || pal.hi, '5': pal.trim || pal.hi };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      let col = cmap[ch] || pal.main;
      if (isDream) {
        const [r, g, b] = sampleDreamWaterRGB(x / 16, y / 16, wSeed);
        if (ch === '4') col = '#ffffff';
        else if (ch === '5') col = `rgb(${Math.min(255, Math.round(r * 0.55 + 115))},${Math.min(255, Math.round(g * 0.55 + 115))},${Math.min(255, Math.round(b * 0.55 + 115))})`;
        else if (ch === '3') col = `rgb(${Math.min(255, Math.round(r * 0.72 + 72))},${Math.min(255, Math.round(g * 0.72 + 72))},${Math.min(255, Math.round(b * 0.72 + 72))})`;
        else if (ch === '1') col = `rgb(${Math.round(r * 0.40)},${Math.round(g * 0.40)},${Math.round(b * 0.40)})`;
        else col = `rgb(${r},${g},${b})`;
      } else if (tKey === 'chainmail' && ch === '2' && ((x + y) & 1)) col = pal.dark;
      c.fillStyle = col; c.fillRect(x, y, 1, 1);
    }
    // Signature Netherite details matching vanilla icons (helmet noseguard + subtle chestplate rib plates)
    if (tKey === 'netherite' && !isDream) {
      if (slot === 'helmet') {
        c.fillStyle = pal.main; c.fillRect(7, 8, 2, 2);
        c.fillStyle = pal.dark; c.fillRect(7, 10, 2, 1);
        c.fillStyle = pal.hi;   c.fillRect(7, 4, 2, 2);
      } else if (slot === 'chest') {
        c.fillStyle = pal.dark;
        c.fillRect(5, 7, 6, 1); c.fillRect(5, 10, 6, 1);
      }
    }
    // Pixel-art Armor Trim overlay on 16x16 icon
    const tr = resolveTrimColors(tKey, trim);
    if (tr) {
      const pat = (trim.pattern || 'wild').toLowerCase();
      const pxT = (x, y, w = 1, h = 1, hi = false) => { c.fillStyle = hi ? tr.hi : tr.main; c.fillRect(x, y, w, h); };
      if (slot === 'helmet') {
        pxT(4, 7, 8, 1, true);
        pxT(3, 8, 1, 2); pxT(12, 8, 1, 2);
        if (pat === 'silence' || pat === 'ward' || pat === 'eye') pxT(7, 4, 2, 3, true);
        else pxT(6, 4, 4, 1);
      } else if (slot === 'chest') {
        pxT(2, 2, 2, 2, true); pxT(12, 2, 2, 2, true);
        pxT(5, 4, 6, 1);
        if (pat === 'wild' || pat === 'rib' || pat === 'ward') {
          pxT(4, 7, 8, 1, true); pxT(5, 9, 6, 1); pxT(4, 11, 8, 1);
        } else if (pat === 'silence') {
          pxT(4, 6, 8, 2, true); pxT(5, 8, 6, 3); pxT(4, 12, 8, 1);
        } else {
          pxT(6, 6, 4, 2, true); pxT(7, 8, 2, 2); pxT(4, 12, 8, 1);
        }
      } else if (slot === 'legs') {
        pxT(4, 2, 8, 1, true);
        pxT(4, 6, 2, 2); pxT(10, 6, 2, 2);
        pxT(4, 10, 2, 2, true); pxT(10, 10, 2, 2, true);
      } else {
        pxT(4, 6, 2, 1, true); pxT(10, 6, 2, 1, true);
        pxT(2, 10, 4, 2, true); pxT(10, 10, 4, 2, true);
      }
    }
    armorIconCache.set(key, cv);
    return cv;
  }

  /* ============================================================================
   * 2. CRISP 16x16 PBR PIXEL-ART TEXTURE ATLAS + BUMP MAP (8x52 = 416 TILES)
   * ============================================================================ */
  const ATLAS_COLS = 8, ATLAS_ROWS = 68, TILE_PX = 16;

  function buildTextureAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_COLS * TILE_PX; canvas.height = ATLAS_ROWS * TILE_PX;
    const ctx = canvas.getContext('2d');

    const tilePixels = (idx, drawFn) => {
      const tx = (idx % ATLAS_COLS) * TILE_PX, ty = Math.floor(idx / ATLAS_COLS) * TILE_PX;
      for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const h = ((x * 374761393 + y * 668265263 + idx * 1442695041) ^ (x * 1274126177)) >>> 0;
        const col = drawFn(x, y, (h % 1000) / 1000, h);
        if (col) { ctx.fillStyle = col; ctx.fillRect(tx + x, ty + y, 1, 1); }
      }
    };
    const drawSpriteMap = (idx, rows, palette) => {
      const tx = (idx % ATLAS_COLS) * TILE_PX, ty = Math.floor(idx / ATLAS_COLS) * TILE_PX;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = rows[y][x];
        if (ch !== '.' && palette[ch]) { ctx.fillStyle = palette[ch]; ctx.fillRect(tx + x, ty + y, 1, 1); }
      }
    };
    const shade = (hex, amt) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${Math.max(0,Math.min(255,((n>>16)&255)+amt))},${Math.max(0,Math.min(255,((n>>8)&255)+amt))},${Math.max(0,Math.min(255,(n&255)+amt))})`;
    };
    // 100% Authentic Minecraft 16x16 Jappa-Style Natural Stone (NOT brick!), Dirt, Grass, Sand, Badlands Terracotta & Ores
    const STONE_MAP = [
      'aaabbaaaacccaaaa',
      'bbbaaaabbaaaacca',
      'aaaacccaaabbbdaa',
      'abbbdaaaacccaaab',
      'caaaabbbbaaaaccc',
      'aaacccaaaddbaaaa',
      'bbbaaaacccaaabbb',
      'aaaddbaaaabbbcaa',
      'cccaaaabbbdaaaab',
      'aaabbbcaaaacccaa',
      'bbdaaaacccaaabbb',
      'aaacccaaabbbdaaa',
      'abbbbaaaacccaaab',
      'caaaaddbaaaabbca',
      'aaabbbcaaaacccaa',
      'bbbaaaabbbdaaaac'
    ];
    const SAND_MAP = [
      'abacaaabcaabacaa',
      'baaeabacbaadcaab',
      'caabacbaaeabacaa',
      'adcaabacaaabcaac',
      'aabcaaeabcaabaca',
      'baabacaaadcaabac',
      'caadcaabcaabacae',
      'abcaabacbaadcaab',
      'baaeabcaabcaabac',
      'caabacaaabcaadca',
      'adcaabacaaaeabac',
      'aabcaabacaaabcaa',
      'baadcaabcaadcaac',
      'caabacaaaeabacaa',
      'abcaadcaabcaabac',
      'baabcaabacaaabca'
    ];
    const TERRACOTTA_MAP = [
      'abaaabcaabaaabca',
      'baabaaabcaadbaab',
      'caabaaabcaabaaac',
      'adbaabaaabcaabaa',
      'aabcaabaaabcaaba',
      'baabaaadbaabaaab',
      'caadbaabcaabaaac',
      'abcaabaaabcaadba',
      'baabaaabcaabaaab',
      'caabaaadbaabcaaa',
      'adbaabaaabcaabaa',
      'aabcaabaaabcaaba',
      'baadbaabcaadbaac',
      'caabaaabcaabaaab',
      'abcaadbaabcaabaa',
      'baabcaabaaadbaab'
    ];
    const GRASS_SIDE_MAP = [
      'ggGGgGGgGGggGGgG',
      'GGgGGgGGgGGgGGgG',
      'gGGgGGgGGgGGgGGg',
      'dggGdgGGgdgGgdgg',
      'ddgddggGddddggdd',
      'ddddddddGddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd'
    ];
    const DEEPSLATE_MAP = [
      'ddbbbaaacccbbbaa',
      'bbbaaacccaaabbbd',
      'aacccbbbbdddaaab',
      'dddbaaaabbbcccaa',
      'bbbaacccbbbaaddd',
      'aaabbbdddcccaabb',
      'cccbbbaaaabbbddd',
      'dddaaacccbbbaaaa',
      'bbbaaaabbbddccca',
      'aacccbbbaaaabbbd',
      'ddbbbaaacccbbbaa',
      'bbbaadddcccaabbb',
      'aaabbbcccaadddbb',
      'cccdddaaabbbccaa',
      'bbbaaacccbbbaadd',
      'ddaaabbbcccaabbb'
    ];
    const DIRT_MAP = [
      'abacaaabcaabacaa',
      'baadaabacbadcaab',
      'caabapbaaacaabad',
      'adcaabacaaadbaac',
      'aabcaadaabcaabae',
      'baabacaaadbaacab',
      'caadbaabcaabapba',
      'abcaabacbaadcaab',
      'baaeabcaabcaabad',
      'caabadaabcaabaca',
      'adbaabapcaadbaab',
      'aabcaabacaabcaae',
      'baadbaabcaadbaac',
      'caabacaaabcaabad',
      'apcaadbaabcaabac',
      'baabcaabadaabcaa'
    ];
    const GRASS_TOP_MAP = [
      'acbaabcaebcaabca',
      'baacdabcaabcaedb',
      'caabcaebdaabcaac',
      'dbcaabcaacbaadca',
      'aabcaedbcaabcaeb',
      'caadbaabcaacbaac',
      'ebcaabcaadbaabca',
      'baacbaabcaebcaad',
      'caabcaadbaabcaac',
      'adbaabcaacbaedba',
      'aabcaebcaadbaabc',
      'caacbaabcaabcaed',
      'ebcaadbaabcaacba',
      'baabcaacbaadbaac',
      'caedbaabcaabcaeb',
      'adbaabcaebcaadba'
    ];
    const OAK_BARK_MAP = [
      'dacbadcbdacbadcb',
      'dacbadcbdacbadcb',
      'dbcaadcbdacbbdcb',
      'dbcaadcbdbcaadcb',
      'dacbbdcdabcaadcb',
      'dacbadcdabcbaddb',
      'dbcaadbdabcbaddb',
      'ddcabdbdabcaadcb',
      'dacbadbdacbaadcb',
      'dacbadcbdacbadcb',
      'dbcaadcbdacbadcb',
      'dbcaadcbdbcaadcb',
      'dacbadcdbbcaadcb',
      'dacbbdcdabcaadcb',
      'dbcaadcdabcbadcb',
      'dacbadcbdacbadcb'
    ];
    const BIRCH_BARK_MAP = [
      'aaabaaacaaabaaac',
      'baaaacaaabaaacaa',
      'aaKDDKaaabaaacaa',
      'baKDDKaaacaaabaa',
      'aaaaacaaabaaacaa',
      'aKDKaaacaaaaabaa',
      'baaaacaaaKDDDKaa',
      'aaabaaacaaKDKaaa',
      'baaaacaaabaaacaa',
      'aaabaaacaaKDDKaa',
      'baaaacaaabKDKaaa',
      'aaKDDDKaaabaaaca',
      'baaaacaaabaaacaa',
      'aaabaaacaaabaaac',
      'baKDKaaacaaaaaba',
      'aaabaaacaaabaaac'
    ];
    // Unique Minecraft 1.17+ Jappa Ore Vein Silhouettes (Coal, Iron, Gold, Diamond each have distinct shapes!)
    const COAL_ORE_MAP = [
      '................',
      '....sMM.........',
      '...dMMMs........',
      '....sdd....sMM..',
      '..........dMMMs.',
      '...........sMd..',
      '..sMM...........',
      '.dMMMs....sMM...',
      '..sMMd...dMMMs..',
      '...dd.....sdd...',
      '................',
      '.....sMMM.......',
      '....dMMMMs..sM..',
      '.....sMMd..dMMs.',
      '......dd....sd..',
      '................'
    ];
    const IRON_ORE_MAP = [
      '................',
      '.......dHM......',
      '..dHMsdMMMs.....',
      '.dMMMs.ssd......',
      '..ssd...........',
      '.........dHM....',
      '....dHM.dMMMs...',
      '...dMMMs.ssd....',
      '....ssd.........',
      '...........dHM..',
      '..dHM.....dMMMs.',
      '.dMMMs.....ssd..',
      '..ssd...dHM.....',
      '.......dMMMs....',
      '........ssd.....',
      '................'
    ];
    const GOLD_ORE_MAP = [
      '................',
      '..........dH....',
      '...dHM...dHMs...',
      '..dHMs....sd....',
      '...sd...........',
      '.........dHM....',
      '....dH..dHMMs...',
      '...dHMs..sMd....',
      '....sd..........',
      '............dH..',
      '..dHM......dHMs.',
      '.dHMMs......sd..',
      '..sMd...dHM.....',
      '.......dHMs.....',
      '........sd......',
      '................'
    ];
    const DIAMOND_ORE_MAP = [
      '................',
      '.........dH.....',
      '...dH...dHMs....',
      '..dHMs...sd.....',
      '...sd...........',
      '..........dH....',
      '.....dH..dHMs...',
      '....dHMs..sd....',
      '.....sd.........',
      '...........dH...',
      '..dH......dHMs..',
      '.dHMs......sd...',
      '..sd....dH......',
      '.......dHMs.....',
      '........sd......',
      '................'
    ];
    const SNOW_OVERHANG  = [4, 4, 5, 3, 3, 4, 6, 5, 4, 3, 3, 5, 4, 3, 4, 3];

    const stoneColor = (x, y, r, baseHex = '#7d7d7d') => {
      const ch = STONE_MAP[y][x];
      const d = ch === 'd' ? -13 : (ch === 'b' ? -6 : (ch === 'c' ? 8 : 0));
      return shade(baseHex, d + (r - 0.5) * 5);
    };
    const deepslateColor = (x, y, r) => {
      const ch = DEEPSLATE_MAP[y][x];
      const d = ch === 'd' ? -18 : (ch === 'b' ? -8 : (ch === 'c' ? 12 : 0));
      return shade('#4f4f56', d + (r - 0.5) * 6);
    };
    const dirtColor = (x, y, r) => {
      const ch = DIRT_MAP[y][x];
      if (ch === 'p') return shade('#91887e', (r - 0.5) * 8);
      const pal = { a: '#946846', b: '#845b3c', c: '#a67752', d: '#69462d', e: '#ba8960' };
      return shade(pal[ch] || '#946846', (r - 0.5) * 6);
    };
    const grassTopColor = (x, y, r, extra = 0) => {
      const ch = GRASS_TOP_MAP[y][x];
      const pal = { a: '#4ec428', b: '#40ad1e', c: '#5fd434', d: '#329616', e: '#72e644' };
      return shade(pal[ch] || '#4ec428', extra + (r - 0.5) * 5);
    };
    const barkColor = (x, y, r, pal) => {
      const ch = OAK_BARK_MAP[y][x];
      return shade(pal[ch] || pal.a, (r - 0.5) * 6);
    };
    const logTopColor = (x, y, r, barkOuter = '#4c3820', barkInner = '#6b5130', ringLight = '#c4a269', ringMid = '#a8844f', ringDark = '#8b6a3c') => {
      const mx = Math.abs(x - 7.5), my = Math.abs(y - 7.5);
      const cheb = Math.max(mx, my);
      if (cheb >= 7.0) return shade(barkOuter, (r - 0.5) * 8);
      if (cheb >= 6.0) return shade(barkInner, (r - 0.5) * 8);
      const ring = Math.floor(cheb);
      if (ring <= 1) return shade(ringDark, (r - 0.5) * 8);
      return shade((ring & 1) === 0 ? ringLight : ringMid, (r - 0.5) * 8);
    };
    const oreTileColor = (x, y, r, map, isDeep, pal) => {
      const ch = map[y][x];
      if (ch === '.') return isDeep ? deepslateColor(x, y, r) : stoneColor(x, y, r);
      return pal[ch] || (isDeep ? deepslateColor(x, y, r) : stoneColor(x, y, r));
    };

    const PICK_SPRITE = ['................','.....DDDDDD.....','....DHHHHHHD....','....DMMMMMHMD...','.....DDDDDMMHD..','.........DMMHD..','........DWDMMD..','.......DWD.DMD..','......DWD...DD..','.....DWD........','....DWD.........','...DWD..........','..DWD...........','.DWD............','.DD.............','................'];
    const SWORD_SPRITE = ['................','............DDD.','...........DHHMD','..........DHHMMD','.........DHHMMD.','........DHHMMD..','.......DHHMMD...','......DHHMMD....','...DDDHHMMD.....','...DGGGGMD......','....DGGMD.......','...DWDGGD.......','..DWD.DDD.......','.DWD............','.DD.............','................'];
    const AXE_SPRITE = ['................','.......DDDDDD...','......DDMMMMHD..','......DHHMMMHHD.','.......DMMMMHHD.','........DWMMHHD.','........DWDMMHD.','.......DWD.DMHD.','......DWD...DDD.','.....DWD........','....DWD.........','...DWD..........','..DWD...........','.DWD............','.DD.............','................'];
    const SHOVEL_SPRITE = ['................','..........DDDD..','.........DHHHMD.','.........DHMMMD.','........DHMMMD..','........DMMMD...','........DWD.....','.......DWD......','......DWD.......','.....DWD........','....DWD.........','...DWD..........','..DWD...........','.DWD............','.DD.............','................'];
    const BOW_SPRITE = ['................','.......DDD......','......DMMMD.....','.....DMD..SD....','....DMD....SD...','...DMD......SD..','..DWD........SD.','..DWD........SD.','..DWD........SD.','...DMD......SD..','....DMD....SD...','.....DMD..SD....','......DMMMD.....','.......DDD......','................','................'];
    const ARROW_SPRITE = ['................','...........DDD..','..........DHHMD.','..........DHMMMD','.........DWD.DD.','........DWD.....','.......DWD......','......DWD.......','.....DWD........','....DWD.........','...DWD..........','..RWD...........','.RRD............','.RR.............','................','................'];
    const ARMOR_SPRITE = ['................','...DDD....DDD...','..DHHMD..DHHMD..','.DHHHHMDDHHHHMD.','.DHMMMMMMMMMMHD.','.DDDMMMMMMMMDDD.','...DMMMMHHMMMD..','...DMMMMHHMMMD..','...DMMMMMMMMMD..','...DMMMMMMMMMD..','...DMMDDDDMMMD..','...DMMMMMMMMMD..','...DMMMMMMMMMD..','...DDDDDDDDDDD..','................','................'];
    const TALL_GRASS_SPRITE = ['....g......g....','..g.g..g...g..g.','..g.G.gG..gG..g.','.gG.G.gG..gG.gG.','.gG.GG.G.gGG.gG.','.GG.GG.GG.GG.GG.','gGG.GGgGG.GGgGG.','GGg.GGGGGGgGGGG.','GGGGGGGGGGGGGGGg','GGGGGGGGGGGGGGGG','.GGGGGGGGGGGGGG.','.gGGGGdGGGGdGGG.','..GGGdGGGdGGGG..','..dGGddGGdGGGg..','..ddd.dddd.ddd..','...dd..ddd..dd..'];
    const POPPY_SPRITE = ['................','......RRRR......','....RRHHHHHR....','....RHHRRRHR....','....RRRRRRRR....','.....RRRRRR.....','......RRRR......','.......GG.......','.....gGGGG......','....gGGGGGg.....','......gGGg......','....g..GG..g....','....Gg.GG.gG....','.....GGGGGG.....','......dGGd......','......dddd......'];
    const DANDELION_SPRITE = ['................','................','.....YYYYYY.....','....YYHHHHYY....','....YYYYYYYY....','.....YYYYYY.....','......YYYY......','.......GG.......','.....g.GG.g.....','.....GGGGGG.....','......gGGg......','...g...GG...g...','...Gg..GG..gG...','....gGGGGGGg....','.....ddGGdd.....','......dddd......'];
    const PETALS_SPRITE = ['................','................','................','................','................','................','................','................','................','................','..PP........WW..','.PWWP..pp..WPPW.','..PP..pWWp..WW..','.......pp..PP...','..WW......PWWP..','...........PP...'];
    const SEAGRASS_SPRITE = ['..g........g....','.gG...g....gG...','.GG..gG....GG.g.','.Gg..GG...gGG.gG','..GG.GG...GG..GG','g.GG.Gg..gGG.gGG','G.GG.GG..GGG.GG.','G.GGgGG.gGGG.GG.','GGGGGGGGGGGGgGG.','.GGGGGGGGGGGGGG.','.gGGGGGGGGGGGG..','..GGGGdGGGGdGG..','..dGGGdGGGdGGG..','..ddd.dddd.ddd..','...dd..ddd..dd..','...d...ddd..d...'];
    const MUSHROOM_GLOW_SPRITE = ['................','................','................','................','....CCCC........','...CHCCCH.......','..CCCCCCCC......','..CHCCCCCHC..cc.','..SSSSSSSS..cHCc','....SSSS....SSSS','.....SS......SS.','.....SS......ss.','.....ss......ss.','....sss......ss.','....sss......ss.','....ddd......dd.'];

    const palWood = { D:'#3b2410', W:'#85532a', M:'#a8753e', H:'#cfa063', G:'#6b4423' };
    const palStone = { D:'#2d3138', W:'#85532a', M:'#848d96', H:'#c5cdd6', G:'#5c636e' };
    const palIron = { D:'#39414a', W:'#85532a', M:'#cbd5e1', H:'#ffffff', G:'#94a3b8' };
    const palDiamond = { D:'#0e4f5c', W:'#85532a', M:'#14c8d8', H:'#a5f8ff', G:'#0d8fa0' };
    const palFire = { D:'#7c2d12', W:'#431407', M:'#f97316', H:'#fef08a', G:'#ea580c' };

    tilePixels(0, (x, y, r) => grassTopColor(x, y, r));
    tilePixels(1, (x, y, r) => {
      const ch = GRASS_SIDE_MAP[y][x];
      if (ch === 'G' || ch === 'g') {
        const belowIsDirt = (y + 1 < 16 && GRASS_SIDE_MAP[y + 1][x] === 'd');
        return grassTopColor(x, y, r, belowIsDirt ? -10 : (ch === 'G' ? 4 : -2));
      }
      const aboveIsGrass = (y > 0 && GRASS_SIDE_MAP[y - 1][x] !== 'd');
      if (aboveIsGrass) return shade('#63442c', (r - 0.5) * 6);
      return dirtColor(x, y, r);
    });
    tilePixels(2, (x, y, r) => dirtColor(x, y, r));
    tilePixels(3, (x, y, r) => stoneColor(x, y, r, '#7d7d7d'));
    tilePixels(4, (x, y, r) => logTopColor(x, y, r));
    tilePixels(5, (x, y, r) => barkColor(x, y, r, { c: '#86653d', a: '#6c5231', b: '#574126', d: '#45331d' }));

    // Organic Botanical Leaf Masks (~18% dappled sky gaps & distinct sunlit cluster depth for lush bushy canopies!)
    const BOTANICAL_LEAF_MASK = [
      '.HMM..HHMM..SSM.',
      'HHMMS.HMMMS.HHMM',
      'MMHH.SMMSSM.HHMM',
      '.MMMSHHMMMSHMM..',
      'HMMSSMMHHMMSHHMM',
      'MMHHMMM..MMMHHMM',
      'SSMMMHHMMSHMMSSD',
      '.HMMMSHHMMSHHM..',
      'HHMMMMSSMMMHHMMM',
      'MMHH.SMMSSM.HHMD',
      '.MSSHHMMMSHMMSS.',
      'HMMSS.HHMM..HHMM',
      'MMHHMMMS.MMMHHMM',
      'SDMMHHMMMSMMSSDD',
      '.HHMMSSMMHHMMSS.',
      'MMSS..HHMM..SSMD'
    ];
    const SAKURA_LEAF_MASK = [
      '.HMM..HHMM..SSM.',
      'HHMMSHHMMMSHHMMM',
      'MMHH.MMS.MMMHHMM',
      'MSMMHHMMMHMMMSMM',
      '.MMSS.HHMM.MMSS.',
      'HMMMSHHMMMSHMMMH',
      'MMHHMMMMHHMMMMHM',
      'SSMMM.SMMMM.SSMD',
      'HHMMMSHHMMMSHHMM',
      'MMHH.MMMHHM.MMHM',
      '.MSMMHHMMMSMMHM.',
      'HMMMSHHMMMSHHMMM',
      'MMHHMM.SMMMHHMMM',
      'SDMMMMHHMMMMSSDD',
      '.HMMMSHHMMMSHHM.',
      '.SMMH..MSS..HMS.'
    ];
    const AUTUMN_LEAF_MASK = [
      'HHMM..MMSMM..HH.',
      'HMMHHMMSSMMHHMM.',
      'MMHH.MMSMM.MMSSD',
      '.MMSSMMHHMMSSMM.',
      'HHMMSS.MHH.MSSHH',
      'MMMHHMMSSMMHHMMM',
      'SSMMHHMMSSMMHHSD',
      '.HHMM.MSSMM.MSS.',
      'MMHHMMSSMMHHMMSS',
      'HHMMSSMMHHMMSSHH',
      'SSMM.HMSSMM.HHMM',
      '.MMHHMMSSMMHHMM.',
      'HHMMSSMMHHMMSSHH',
      'MMHH.MSSMMH.MSSD',
      '.SSMMHHMMSSMMHH.',
      'MMHH..SMMHH..MSD'
    ];
    const drawFancyLeaf = (idx, pal, mask = BOTANICAL_LEAF_MASK) => {
      const tx = (idx % ATLAS_COLS) * TILE_PX, ty = Math.floor(idx / ATLAS_COLS) * TILE_PX;
      const tierTone = { H: 8, M: 0, S: -10, D: -20 };
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = mask[y][x];
        if (ch === '.') continue;
        const h = ((x * 374761393 + y * 668265263 + idx * 1442695041) ^ (x * 1274126177)) >>> 0;
        const rimDark = (x === 0 || x === 15 || y === 15) ? -6 : (y === 0 ? 4 : 0);
        const jitter = ((h % 1000) / 1000 - 0.5) * 16 + (tierTone[ch] || 0) + rimDark;
        ctx.fillStyle = shade(pal[ch] || pal.M, jitter);
        ctx.fillRect(tx + x, ty + y, 1, 1);
      }
    };
    // Cây Táo / Sồi (Oak Leaves): kết cấu lá hữu cơ từng chùm đậm nhạt + khe sáng tự nhiên!
    drawFancyLeaf(6,  { H: '#74ea44', M: '#45b828', S: '#267d16', D: '#134c09' }, BOTANICAL_LEAF_MASK);
    tilePixels(7, (x, y, r) => {
      const ch = SAND_MAP[y][x];
      const pal = { a: '#dfd3a0', b: '#d7c992', c: '#e5daaa', d: '#cab981', e: '#ece3b7' };
      return shade(pal[ch] || '#dfd3a0', (r - 0.5) * 6);
    });
    // 100% Authentic Minecraft Jappa Oak Planks (4 horizontal boards, staggered vertical joints, warm woodgrain & crisp bevels!)
    const OAK_PLANK_MAP = [
      'dddddddddddddddd',
      'hhHHhhHhHhhHHhhd',
      'mmMMmMmMMmMMmmmd',
      'bBbbBbBbbbBbbBBd',
      'dddddddddddddddd',
      'hHHhdhhHHhhhHhhH',
      'mMMmdmMMmmmMMmMM',
      'bBBbdbBBbbBbbBbb',
      'dddddddddddddddd',
      'hhHhhhHHhhHdhHHh',
      'mmMMmMMmmMMdmMMm',
      'bBbbBbbBbbbdbBBb',
      'dddddddddddddddd',
      'hHhhHHdhhHhhhHHh',
      'mMmmMMdmMMmmMMmm',
      'bBbbBBdbBbbbBbbB'
    ];
    const oakPal = { d: '#674c2a', b: '#946e3e', B: '#876335', m: '#ae834c', M: '#a37844', h: '#c49a5d', H: '#d0a86a' };
    tilePixels(8, (x, y, r) => shade(oakPal[OAK_PLANK_MAP[y][x]] || '#ae834c', (r - 0.5) * 6));
    tilePixels(9, (x, y, r) => shade('#f2f9ff', (r - 0.5) * 16));
    tilePixels(10, (x, y, r) => {
      const ov = SNOW_OVERHANG[x];
      if (y < ov) return y === ov - 1 ? shade('#dcebf4', (r - 0.5) * 6) : shade('#f3f9fc', (r - 0.5) * 8);
      return dirtColor(x, y, r);
    });
    tilePixels(11, (x, y, r) => (((x + y) % 7 === 0) ? '#d6f2ff' : shade('#84ccf5', (r - 0.5) * 18)));
    tilePixels(12, (x, y, r) => barkColor(x, y, r, { c: '#543a1f', a: '#3e2915', b: '#2f1e0e', d: '#211408' }));
    // Cây Thông (Spruce): dùng mask cụm dày lá thu nhuộm xanh thông đậm mượt mọi mức đồ họa!
    drawFancyLeaf(13, { H: '#48a85e', M: '#2c7d44', S: '#1a572f', D: '#0f381e' }, AUTUMN_LEAF_MASK);
    tilePixels(14, (x, y, r) => {
      // Authentic Minecraft Cherry Bark: deep purplish-mahogany bark with soft rose-brown horizontal lenticels
      const isLenticel = ((y === 2 && x >= 3 && x <= 7) || (y === 6 && x >= 10 && x <= 14) || (y === 10 && x >= 2 && x <= 6) || (y === 14 && x >= 8 && x <= 12));
      if (isLenticel) return shade(y === 6 || y === 14 ? '#a16278' : '#7d475b', (r - 0.5) * 6);
      return barkColor(x, y, r, { c: '#482433', a: '#351824', b: '#29111b', d: '#1e0b13' });
    });
    drawFancyLeaf(15, { H: '#ffd4ec', M: '#ff96ca', S: '#f262a6', D: '#d14388' }, SAKURA_LEAF_MASK);
    tilePixels(16, (x, y, r) => {
      const ch = BIRCH_BARK_MAP[y][x];
      if (ch === 'D') return '#22201e';
      if (ch === 'K') return '#57534e';
      return shade(ch === 'c' ? '#f4f2ec' : (ch === 'b' ? '#d8d4ca' : '#e8e5dc'), (r - 0.5) * 6);
    });
    // Rebuilt Authentic Minecraft Cactus Side (vertical fluted emerald ribs + subtle sharp pixel spines!)
    tilePixels(17, (x, y, r) => {
      const col = x & 3;
      if (col === 0) return shade('#1d5622', (r - 0.5) * 10);
      if (col === 2 && ((y + (x >> 2) * 3) % 5 === 1)) return '#112914';
      if (col === 2 && ((y + (x >> 2) * 3) % 5 === 2)) return '#dff7d4';
      return shade(col === 1 ? '#4ea33b' : (col === 2 ? '#3e8c30' : '#2c7026'), (r - 0.5) * 14);
    });
    tilePixels(18, (x, y, r) => {
      const ch = TERRACOTTA_MAP[y][x];
      const pal = { a: '#9e4c36', b: '#93442f', c: '#aa553e', d: '#853c28' };
      return shade(pal[ch] || '#9e4c36', (r - 0.5) * 5);
    });
    tilePixels(19, (x, y, r) => {
      if (y === 0) return shade('#e8ddb0', (r - 0.5) * 6);
      if (y === 3) return shade('#b5a270', (r - 0.5) * 6);
      if (y < 3) return shade('#dfd2a2', ((x & 3) === 0 ? -8 : 4) + (r - 0.5) * 6);
      const ch = SAND_MAP[y][x];
      const pal = { a: '#d4c38e', b: '#cab780', c: '#dccd9a', d: '#bcab74', e: '#e2d5a6' };
      return shade(pal[ch] || '#d4c38e', (y === 8 || y === 12 ? -7 : 0) + (r - 0.5) * 6);
    });
    tilePixels(20, (x, y, r) => oreTileColor(x, y, r, GOLD_ORE_MAP, false, { H: '#fff8a8', M: '#fcee4b', s: '#d99e1a', d: '#8a5c0c' }));
    tilePixels(21, (x, y, r) => { const d = Math.hypot(x - 8, y - 8); if (d > 6.2) return null; return (x > 10 && y > 9) ? '#f5f0e1' : shade('#c94e28', (r - 0.5) * 26); });
    tilePixels(22, (x, y, r) => deepslateColor(x, y, r));
    tilePixels(23, (x, y, r) => r > 0.65 ? '#4c525e' : r < 0.3 ? '#0c0e12' : '#242830');
    tilePixels(24, (x, y, r) => oreTileColor(x, y, r, COAL_ORE_MAP, false, { M: '#26262a', s: '#17171a', d: '#0d0d10' }));
    tilePixels(25, (x, y, r) => oreTileColor(x, y, r, IRON_ORE_MAP, false, { H: '#f2d3ba', M: '#d8af93', s: '#af866a', d: '#7d5a42' }));
    tilePixels(26, (x, y, r) => oreTileColor(x, y, r, DIAMOND_ORE_MAP, true, { H: '#d4fffb', M: '#4aedd9', s: '#1fc4b7', d: '#127a75' }));
    tilePixels(27, (x, y, r) => r > 0.72 ? '#fef08a' : r > 0.35 ? '#f97316' : '#dc2626');
    // Tile 28: Pure Red Apple Sprite (transparent background — NEVER a green leaf cube!)
    tilePixels(28, (x, y, r) => {
      if (x === 8 && y >= 2 && y <= 4) return '#6b4423';
      if ((x === 9 || x === 10) && y === 3) return '#4ade80';
      const d = Math.hypot((x - 7.5) * 0.96, (y - 9.2) * 1.04);
      if (d > 5.0 || (y <= 5 && Math.abs(x - 7.5) < 1.2)) return null;
      if (x <= 6 && y >= 6 && y <= 8 && d < 3.6) return '#fca5a5';
      return d > 4.1 ? '#991b1b' : shade('#dc2626', (r - 0.5) * 18);
    });
    tilePixels(29, (x, y, r) => barkColor(x, y, r, { c: '#7a7267', a: '#665f56', b: '#524c44', d: '#3f3a34' }));
    // Lá Cam Mùa Thu + Cây Bạch Dương (cụm tán hữu cơ sắc nét, nhuộm xanh tươi sáng!)
    drawFancyLeaf(30, { H: '#ffe04d', M: '#ff8a14', S: '#eb4b10', D: '#a82906' }, AUTUMN_LEAF_MASK);
    drawFancyLeaf(31, { H: '#8ef548', M: '#5cd42a', S: '#369e18', D: '#1f6b0e' }, BOTANICAL_LEAF_MASK);
    tilePixels(32, (x, y, r) => (x <= 1 || x >= 14 || y <= 1 || y >= 14) ? '#3b2b1d' : ((x === 2 || x === 13 || y === 2 || y === 13) ? '#b45309' : (r > 0.65 ? '#fde68a' : r > 0.25 ? '#f59e0b' : '#d97706')));
    tilePixels(33, (x, y, r) => {
      if ((y < 4 && (x + y) % 3 === 0) || (y > 11 && x % 4 === 1)) return shade('#4e8c30', (r - 0.5) * 24);
      if (y === 0 || y === 8 || (y < 8 && x === 0) || (y >= 8 && x === 8)) return '#434952';
      return shade('#8e97a1', (r - 0.5) * 18 + (y === 1 || y === 9 ? 16 : 0));
    });
    // Tile 34 & 35: Authentic Minecraft Crafting Table Top & Side (matching Image 9!)
    tilePixels(34, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#452612';
      // 4 Light-Oak Corner Brackets with dark L-shaped corner notches
      const inCornerX = (x >= 1 && x <= 3) || (x >= 12 && x <= 14);
      const inCornerY = (y >= 1 && y <= 3) || (y >= 12 && y <= 14);
      if (inCornerX && inCornerY) {
        const isNotch = ((x === 1 || x === 14) && (y <= 2 || y >= 13)) || ((y === 1 || y === 14) && (x <= 2 || x >= 13));
        return isNotch ? '#1e150c' : shade('#b89458', (r - 0.5) * 10);
      }
      if (x <= 2 || x >= 13 || y <= 2 || y >= 13) return shade('#a86539', (r - 0.5) * 12);
      // 3x3 Dark-Brown Crafting Grid (x, y in 3..12, lines at 3, 6, 9, 12)
      const isGridX = (x === 3 || x === 6 || x === 9 || x === 12);
      const isGridY = (y === 3 || y === 6 || y === 9 || y === 12);
      if (isGridX && isGridY) return '#2d170a';
      if (isGridX || isGridY) return '#4a2914';
      return shade(((x + y) & 1) ? '#b56f40' : '#a36034', (r - 0.5) * 12);
    });
    const drawCraftSideBase = (x, y, r) => {
      // Top reddish-tan table overhang + central stepped V-drape into dark vertical pillar
      if (y === 0) return '#452612';
      if (y <= 2 || (y === 3 && x >= 5 && x <= 10) || (y === 4 && x >= 6 && x <= 9)) {
        if (x === 0 || x === 15) return '#3b200e';
        return shade((y >= 2 && x >= 6 && x <= 9) ? '#854a24' : '#a86539', (r - 0.5) * 12);
      }
      if (y === 3) return '#3b200e';
      // Central dark-brown vertical pillar (x=7..8) & outer side posts (x=0..1, 14..15) + bottom sill
      if (x === 7 || x === 8) return shade(x === 7 ? '#3b200e' : '#2b1608', (r - 0.5) * 8);
      if (x === 0 || x === 15 || y === 15) return '#2b1608';
      if (x === 1 || x === 14 || y === 14) return '#52351b';
      // Recessed light-oak horizontal plank panels
      if (y === 7 || y === 11) return shade('#785c32', (r - 0.5) * 8);
      return shade(oakPal[OAK_PLANK_MAP[y][x]] || '#b89458', (r - 0.5) * 8);
    };
    tilePixels(35, (x, y, r) => {
      // Left oak panel: Hanging iron shears/pliers & dark tool pouch (matching Image 9 side face!)
      if (x >= 3 && x <= 5 && y >= 5 && y <= 8) return (x === 4 && y >= 6 && y <= 7) ? '#5e3519' : '#2b1608';
      if ((x === 3 || x === 5) && y >= 9 && y <= 12) return (y === 9 || x === 3) ? '#d8dde2' : '#8e96a0';
      if (x === 4 && y === 9) return '#475569';
      return drawCraftSideBase(x, y, r);
    });
    tilePixels(36, (x, y) => (Math.abs((15 - x) - y) <= 1 && x >= 3 && x <= 12) ? ((15 - x === y) ? '#b07b42' : '#5e3918') : null);

    drawSpriteMap(37, PICK_SPRITE, palWood); drawSpriteMap(38, PICK_SPRITE, palStone);
    drawSpriteMap(39, PICK_SPRITE, palIron); drawSpriteMap(40, PICK_SPRITE, palDiamond);
    drawSpriteMap(41, SWORD_SPRITE, palWood); drawSpriteMap(42, SWORD_SPRITE, palStone);
    drawSpriteMap(43, SWORD_SPRITE, palIron); drawSpriteMap(44, SWORD_SPRITE, palDiamond);
    drawSpriteMap(45, AXE_SPRITE, palWood); drawSpriteMap(46, AXE_SPRITE, palStone);
    drawSpriteMap(47, AXE_SPRITE, palIron); drawSpriteMap(48, AXE_SPRITE, palDiamond);
    drawSpriteMap(49, SHOVEL_SPRITE, palStone);
    tilePixels(50, (x, y, r) => {
      if (x === 8 && y >= 2 && y <= 4) return '#6b4423';
      if (x === 9 && y === 3) return '#4ade80';
      const d = Math.hypot(x - 8, y - 9.5); if (d > 5.0) return null;
      return d > 4.2 ? '#b45309' : (x <= 7 && y <= 8 ? '#fef9c3' : shade('#facc15', (r - 0.5) * 22));
    });
    drawSpriteMap(51, TALL_GRASS_SPRITE, { g: '#7ef238', G: '#49c922', d: '#288212' });
    drawSpriteMap(52, POPPY_SPRITE, { R: '#ef2323', H: '#fca5a5', G: '#3cb820', g: '#68e338', d: '#227012' });
    drawSpriteMap(53, DANDELION_SPRITE, { Y: '#facc15', H: '#fef9c3', G: '#3cb820', g: '#68e338', d: '#227012' });
    drawSpriteMap(54, PETALS_SPRITE, { P: '#f472b6', p: '#ec4899', W: '#fff1f7' });
    drawSpriteMap(55, SEAGRASS_SPRITE, { g: '#4ade80', G: '#16a34a', d: '#14532d' });

    // v10/v12 Additional Crisp 16x16 Tiles (56-71): Glass, TNT, Furnace, Gunpowder, Pearls, Bow/Arrow, Armor, Fire Sword, Glow Mushroom, Lily Pad, Crystal
    tilePixels(56, (x, y) => (x === 0 || x === 15 || y === 0 || y === 15) ? '#93c5fd' : ((x === 3 && y === 3) || (x === 4 && y === 2) || (x === 11 && y === 12) || (x === 12 && y === 11)) ? '#f0f9ff' : null);
    tilePixels(57, (x, y, r) => {
      if (y === 5 || y === 10) return '#27272a';
      if (y > 5 && y < 10) {
        const isLetter = ((y === 6 || ((x === 3) && y >= 6)) && x >= 2 && x <= 4) || ((x === 6 || x === 9 || (x === 7 && y === 7) || (x === 8 && y === 8)) && x >= 6 && x <= 9) || ((y === 6 || (x === 12 && y >= 6)) && x >= 11 && x <= 13);
        return isLetter ? '#18181b' : '#f8fafc';
      }
      return shade(x % 2 === 0 ? '#dc2626' : '#b91c1c', (r - 0.5) * 14);
    });
    tilePixels(58, (x, y, r) => (Math.hypot(x - 7.5, y - 7.5) < 2.2) ? '#18181b' : ((x === 8 && y === 6) ? '#facc15' : shade('#b91c1c', (r - 0.5) * 18)));
    // Tile 59 & 60: Authentic Minecraft Furnace Top/Bottom & Side/Back (matching Image 5!)
    tilePixels(59, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return shade('#636363', (r - 0.5) * 8);
      if (x === 1 || x === 14 || y === 1 || y === 14) return shade('#757575', (r - 0.5) * 8);
      return shade(((x + y * 3) % 5 === 0) ? '#a8a8a8' : '#9c9c9c', (r - 0.5) * 10);
    });
    const furnaceCobbleColor = (x, y, r) => {
      const ch = STONE_MAP[y][x];
      const base = ch === 'd' ? '#424242' : (ch === 'b' ? '#575757' : (ch === 'c' ? '#828282' : '#6b6b6b'));
      return shade(base, (r - 0.5) * 10);
    };
    tilePixels(60, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#383838';
      if (y === 9) return (x === 1 || x === 14) ? '#525252' : '#b5b5b5';
      if (y >= 10) {
        if (x === 1 || x === 14 || y === 14) return '#595959';
        return shade(((x * 3 + y) % 4 === 0) ? '#a6a6a6' : '#969696', (r - 0.5) * 8);
      }
      return furnaceCobbleColor(x, y, r);
    });
    tilePixels(61, (x, y, r) => { const d = Math.hypot(x - 7.5, y - 10.5); return (d > 5.2 || y < 5) ? null : shade(d < 2.5 ? '#94a3b8' : '#52525b', (r - 0.5) * 26); });
    tilePixels(62, (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 5.5 ? null : (d < 2.0 ? '#fdf4ff' : (d > 4.2 ? '#4c1d95' : '#9333ea')); });
    tilePixels(63, (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 5.5 ? null : (d < 2.5 ? '#fef08a' : (d > 4.2 ? '#7c2d12' : '#ea580c')); });
    drawSpriteMap(64, BOW_SPRITE, { D:'#451a03', W:'#92400e', M:'#b45309', S:'#e2e8f0' });
    drawSpriteMap(65, ARROW_SPRITE, { D:'#334155', H:'#ffffff', M:'#cbd5e1', W:'#a16207', R:'#dc2626' });
    drawSpriteMap(66, ARMOR_SPRITE, palIron); drawSpriteMap(67, ARMOR_SPRITE, palDiamond);
    drawSpriteMap(68, SWORD_SPRITE, palFire);
    drawSpriteMap(69, MUSHROOM_GLOW_SPRITE, { C:'#2dd4bf', H:'#ccfbf1', c:'#14b8a6', S:'#e2e8f0', s:'#94a3b8', d:'#475569' });
    tilePixels(70, (x, y, r) => {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
      if (d > 6.5 || (dx > 0 && Math.abs(dy) < dx * 0.45)) return null;
      return d > 5.4 ? '#15803d' : ((x + y) % 5 === 0 ? '#4ade80' : shade('#22c55e', (r - 0.5) * 16));
    });
    tilePixels(71, (x, y, r) => {
      if (y <= 2 || Math.abs(x - 7.5) + y < 5) return '#f3e8ff';
      if (x <= 1 || x >= 14) return '#9333ea';
      if (y >= 14) return '#6b21a8';
      return (Math.abs(x - y) <= 1 || Math.abs((15 - x) - y) <= 1) ? '#e9d5ff' : shade(((x + y) & 2) ? '#c084fc' : '#a855f7', (r - 0.5) * 20);
    });
    // v15 Crisp 16x16 Minecraft Nether & End Tiles (72-89)
    const netherrackColor = (x, y, r) => {
      const ch = DIRT_MAP[y][x];
      const pal = { a: '#6e2424', b: '#591b1b', c: '#822d2d', d: '#461313', e: '#963939', p: '#3d1010' };
      return shade(pal[ch] || '#6e2424', (r - 0.5) * 8);
    };
    tilePixels(72, (x, y, r) => netherrackColor(x, y, r));
    tilePixels(73, (x, y, r) => { const ch = GRASS_TOP_MAP[y][x]; const pal = { a: '#9e1c24', b: '#7f141b', c: '#bd2630', d: '#640f15', e: '#d43a44' }; return shade(pal[ch] || '#9e1c24', (r - 0.5) * 6); });
    tilePixels(74, (x, y, r) => { const ch = GRASS_SIDE_MAP[y][x]; if (ch !== 'd') return shade(ch === 'G' ? '#b8222c' : '#8f1720', (r - 0.5) * 8); return netherrackColor(x, y, r); });
    tilePixels(75, (x, y, r) => { const ch = GRASS_TOP_MAP[y][x]; const pal = { a: '#168c7f', b: '#107067', c: '#23a899', d: '#0c5750', e: '#3bc2b3' }; return shade(pal[ch] || '#168c7f', (r - 0.5) * 6); });
    tilePixels(76, (x, y, r) => { const ch = GRASS_SIDE_MAP[y][x]; if (ch !== 'd') return shade(ch === 'G' ? '#20a394' : '#13736a', (r - 0.5) * 8); return netherrackColor(x, y, r); });
    tilePixels(77, (x, y, r) => barkColor(x, y, r, { c: '#a3284b', a: '#6e1934', b: '#521126', d: '#360a18' }));
    tilePixels(78, (x, y, r) => barkColor(x, y, r, { c: '#26a6a0', a: '#2e4057', b: '#1f2d40', d: '#141e2b' }));
    tilePixels(79, (x, y, r) => { const ch = DIRT_MAP[y][x]; const pal = { a: '#8c0e1a', b: '#730a14', c: '#a61724', d: '#59070f', e: '#bf2230', p: '#4a050b' }; return shade(pal[ch] || '#8c0e1a', (r - 0.5) * 8); });
    tilePixels(80, (x, y, r) => { const ch = DIRT_MAP[y][x]; const pal = { a: '#0f9e92', b: '#0b7d74', c: '#1cb8ab', d: '#085e58', e: '#38d4c7', p: '#064742' }; return shade(pal[ch] || '#0f9e92', (r - 0.5) * 8); });
    tilePixels(81, (x, y, r) => { const d = Math.hypot(x - 7.5, y - 7.5); return d < 3.5 ? '#fde68a' : (d < 6.0 ? shade('#f59e0b', (r - 0.5) * 14) : shade('#b45309', (r - 0.5) * 14)); });
    tilePixels(82, (x, y, r) => (y % 4 === 0 || ((Math.floor(y / 4) & 1) === 0 ? x === 7 : x === 15)) ? '#1a0c0e' : shade('#3b1b20', (r - 0.5) * 10));
    tilePixels(83, (x, y, r) => { const ch = DIRT_MAP[y][x]; const pal = { a: '#4f3c2e', b: '#3e2e22', c: '#5e4838', d: '#2b1f16', e: '#695140', p: '#211710' }; return shade(pal[ch] || '#4f3c2e', (r - 0.5) * 7); });
    tilePixels(84, (x, y, r) => { const ch = STONE_MAP[y][x]; const pal = { a: '#150f24', b: '#0d0917', c: '#352254', d: '#08050f' }; return shade(pal[ch] || '#150f24', (r - 0.5) * 6); });
    tilePixels(85, (x, y, r) => { const ch = STONE_MAP[y][x]; const pal = { a: '#dbda9c', b: '#c9c683', c: '#ebe9b2', d: '#b5b06e' }; return shade(pal[ch] || '#dbda9c', (r - 0.5) * 6); });
    tilePixels(86, (x, y, r) => (x === 0 || y === 0 || x === 8 || y === 8) ? '#6f4b7a' : shade('#a87ab5', ((x === 1 || y === 1 || x === 9 || y === 9) ? 14 : 0) + (r - 0.5) * 10));
    tilePixels(87, (x, y, r) => ((x + y) % 5 === 0) ? '#d8b4fe' : shade('#582c6e', (r - 0.5) * 16));
    drawSpriteMap(88, TALL_GRASS_SPRITE, { g: '#f43f5e', G: '#be123c', d: '#881337' });
    drawSpriteMap(89, TALL_GRASS_SPRITE, { g: '#5eead4', G: '#14b8a6', d: '#0f766e' });

    // v16 Crisp 16x16 Tiles (90-131): Cherry Heartwood, Palm, Mangrove, Castle Copper/Marble, Ocean Ruins, Interactive Blocks & Tools
    tilePixels(90, (x, y, r) => {
      // Authentic Minecraft Cherry Log Top/Bottom: dark cherry bark rim + warm pink heartwood rings!
      const bx = Math.min(x, 15 - x), by = Math.min(y, 15 - y), bd = Math.min(bx, by);
      if (bd === 0) return shade('#2d131e', (r - 0.5) * 8);
      if (bd === 1) return shade('#451f2f', (r - 0.5) * 8);
      const ring = Math.floor(Math.hypot(x - 7.5, y - 7.5));
      return shade((ring & 1) ? '#e8b3ad' : '#d48d8c', (r - 0.5) * 8);
    });
    tilePixels(91, (x, y, r) => {
      // Tropical Palm Trunk: horizontal fibrous rings
      if (y % 4 === 0) return shade('#6e5134', (r - 0.5) * 10);
      return shade(y % 4 === 1 ? '#b08b62' : '#96714b', (r - 0.5) * 14);
    });
    drawFancyLeaf(92, { H: '#74d642', M: '#4fb52b', S: '#328a1a', D: '#1d5e0d' }, BOTANICAL_LEAF_MASK);
    tilePixels(93, (x, y, r) => {
      // Pure Coconut Sprite (transparent background)
      const d = Math.hypot((x - 7.5) * 1.05, (y - 8.5) * 0.92);
      if (d > 5.0) return null;
      if ((x === 6 && y === 7) || (x === 9 && y === 7) || (x === 7 && y === 9)) return '#3b2112';
      return d > 4.0 ? '#4a2c16' : shade('#7c4d2b', (r - 0.5) * 20);
    });
    tilePixels(94, (x, y, r) => barkColor(x, y, r, { c: '#6e3d36', a: '#572f29', b: '#45241f', d: '#301815' }));
    tilePixels(95, (x, y, r) => {
      // Tangled Aerial Mangrove Prop Roots (transparent gaps)
      const isRoot = (Math.abs(x - 3) <= 1 || Math.abs(x - 12) <= 1 || Math.abs((x + y) - 15) <= 1 || Math.abs(x - y) <= 1 || y === 0 || y === 15);
      return isRoot ? shade((x + y) % 3 === 0 ? '#6e4e35' : '#4a3322', (r - 0.5) * 14) : null;
    });
    drawFancyLeaf(96, { H: '#5eb040', M: '#3f872c', S: '#285e1b', D: '#183d0f' }, AUTUMN_LEAF_MASK);
    tilePixels(97, (x, y, r) => { const ch = DIRT_MAP[y][x]; const pal = { a: '#3d3c44', b: '#323138', c: '#4a4952', d: '#28272d', e: '#52515c', p: '#1f1e24' }; return shade(pal[ch] || '#3d3c44', (r - 0.5) * 6); });
    tilePixels(98, (x, y, r) => (y % 4 === 0 || ((Math.floor(y / 4) & 1) === 0 ? x === 7 : x === 15)) ? '#5e4636' : shade('#91715a', (r - 0.5) * 12));
    tilePixels(99, (x, y, r) => {
      // Oxidized Emerald-Teal Copper Castle Roof Tiles (matches Reference Image 3!)
      const mortar = (y % 4 === 0 || ((Math.floor(y / 4) & 1) === 0 ? x === 7 : x === 15));
      if (mortar) return '#26695d';
      const shine = (y % 4 === 1) ? 14 : 0;
      return shade(((x + y) % 7 === 0) ? '#5eead4' : '#3ca892', shine + (r - 0.5) * 12);
    });
    tilePixels(100, (x, y, r) => {
      // Bright Carved Castle Marble/Limestone Brick (matches Reference Image 3!)
      const mortar = (y % 8 === 0 || (y < 8 ? x === 0 : x === 8));
      if (mortar) return '#b5b1a4';
      return shade(y % 8 === 1 ? '#f7f5ee' : '#e5e2d7', (r - 0.5) * 8);
    });
    tilePixels(101, (x, y, r) => ((x % 4 === 0 || y % 4 === 0) ? '#25615c' : shade(((x + y) & 2) ? '#4ea89e' : '#36857d', (r - 0.5) * 16)));
    tilePixels(102, (x, y, r) => {
      const bd = Math.min(x, 15 - x, y, 15 - y);
      if (bd <= 1) return shade('#58a39e', (r - 0.5) * 10);
      if (bd <= 3) return shade('#99f6e4', (r - 0.5) * 10);
      return shade('#ecfeff', (r - 0.5) * 6);
    });
    tilePixels(103, (x, y, r) => ((x * 3 + y * 5) % 7 === 0 ? '#9d174d' : shade(r > 0.6 ? '#fbcfe8' : '#ec4899', (r - 0.5) * 18)));
    tilePixels(104, (x, y, r) => ((x * 3 + y * 5) % 7 === 0 ? '#1e3a8a' : shade(r > 0.6 ? '#bae6fd' : '#0ea5e9', (r - 0.5) * 18)));
    tilePixels(105, (x, y, r) => ((x * 3 + y * 5) % 7 === 0 ? '#a16207' : shade(r > 0.6 ? '#fef08a' : '#eab308', (r - 0.5) * 18)));
    tilePixels(106, (x, y, r) => ((x + y) % 5 === 0 ? '#e0f2fe' : shade('#7dd3fc', (r - 0.5) * 12)));
    tilePixels(107, (x, y, r) => shade((x + y) % 3 === 0 ? '#ca8a04' : '#eab308', (r - 0.5) * 18));
    tilePixels(108, (x, y, r) => (y === 4 || y === 11) ? '#b91c1c' : shade(x % 2 === 0 ? '#eab308' : '#ca8a04', (r - 0.5) * 18));
    tilePixels(109, (x, y, r) => {
      const bd = Math.min(x, 15 - x, y, 15 - y);
      if (bd <= 1) return '#a3e635';
      if (bd >= 4 && bd <= 6) return '#4d7c0f';
      return shade('#84cc16', (r - 0.5) * 16);
    });
    tilePixels(110, (x, y, r) => {
      if (y <= 1 || y === 7 || y === 8 || y >= 14) return shade('#b98952', (r - 0.5) * 12);
      const bookCols = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#b45309'];
      if (x % 3 === 0) return '#27272a';
      return shade(bookCols[(Math.floor(x / 3) + (y > 8 ? 3 : 0)) % bookCols.length], (r - 0.5) * 12);
    });
    tilePixels(111, (x, y, r) => {
      if ((x <= 2 || x >= 13) && (y <= 2 || y >= 13)) return '#22d3ee';
      if (x >= 3 && x <= 12 && y >= 3 && y <= 12) return (x >= 6 && x <= 9 && y >= 5 && y <= 10) ? '#fef3c7' : '#b91c1c';
      return shade('#1b112b', (r - 0.5) * 10);
    });
    tilePixels(112, (x, y, r) => y < 4 ? ((x === 2 || x === 13) ? '#22d3ee' : '#b91c1c') : shade('#1b112b', (r - 0.5) * 10));
    tilePixels(113, (x, y, r) => (y <= 4 || y >= 12 || (x >= 4 && x <= 11)) ? shade(y <= 1 ? '#94a3b8' : '#334155', (r - 0.5) * 14) : '#1e293b');
    // Tile 114 & 115: Authentic Minecraft Chest Top/Bottom & Front (matching Image 6!)
    const chestWoodGrain = (x, y, r) => {
      const ch = OAK_PLANK_MAP[y][x];
      const pal = { d: '#8a5d22', b: '#996828', B: '#8f6024', m: '#a87532', M: '#9e6d2c', h: '#b8843b', H: '#c49042' };
      return shade(pal[ch] || '#a87532', (r - 0.5) * 8);
    };
    tilePixels(114, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#2c241b';
      if (x === 1 || x === 14 || y === 1 || y === 14) return shade('#734f20', (r - 0.5) * 8);
      return chestWoodGrain(x, y, r);
    });
    tilePixels(115, (x, y, r) => {
      if (x >= 7 && x <= 8 && y >= 4 && y <= 8) return (x === 7 && y <= 7) ? '#e2e8f0' : '#94a3b8';
      if (x >= 6 && x <= 9 && y >= 3 && y <= 9 && (x === 6 || x === 9 || y === 3 || y === 9)) return '#4a3619';
      if (x === 0 || x === 15 || y === 0 || y === 15 || y === 5) return '#2c241b';
      if (x === 1 || x === 14 || y === 1 || y === 14 || y === 4 || y === 6) return shade('#734f20', (r - 0.5) * 8);
      return chestWoodGrain(x, y, r);
    });
    tilePixels(116, (x, y, r) => y < 5 ? shade('#f8fafc', (r - 0.5) * 8) : shade('#dc2626', (r - 0.5) * 14));
    tilePixels(117, (x, y, r) => y < 8 ? (x < 5 ? '#f8fafc' : '#dc2626') : (y < 12 ? '#b45309' : ((x <= 2 || x >= 13) ? '#78350f' : '#27272a')));
    tilePixels(118, (x, y, r) => {
      const d = Math.hypot(x - 7.5, y - 6.5);
      if (y >= 11) return shade((x & 2) ? '#57361a' : '#291a0d', (r - 0.5) * 12);
      if (d < 3.0) return '#fef08a';
      if (d < 5.5) return shade('#f97316', (r - 0.5) * 18);
      return shade('#451a03', (r - 0.5) * 12);
    });
    const drawBucketTile = (idx, fillCol) => tilePixels(idx, (x, y, r) => {
      if (y >= 3 && y <= 13 && x >= 3 && x <= 12) {
        if (y === 4 && x >= 4 && x <= 11 && fillCol) return shade(fillCol, (r - 0.5) * 16);
        if (y === 5 && x >= 5 && x <= 10 && fillCol) return shade(fillCol, 14);
        if (y >= 11 && (x === 3 || x === 12)) return null;
        if (x === 3 || x === 12 || y === 13 || y === 3) return '#475569';
        return shade(x <= 6 ? '#e2e8f0' : '#94a3b8', (r - 0.5) * 10);
      }
      return null;
    });
    drawBucketTile(119, null); drawBucketTile(120, '#38bdf8'); drawBucketTile(121, '#f97316');
    tilePixels(122, (x, y) => {
      if (x >= 3 && x <= 11 && Math.abs((14 - x) - y) <= 0) return '#92400e';
      if (x === 12 && y >= 3 && y <= 10) return '#e2e8f0';
      if (x >= 11 && x <= 13 && y >= 11 && y <= 13) return y === 11 ? '#ef4444' : '#f8fafc';
      return null;
    });
    tilePixels(123, (x, y, r) => {
      if (y >= 7 && y <= 12 && x >= 2 && x <= 13 && !(y >= 11 && (x <= 3 || x >= 12))) return shade(y === 8 ? '#78350f' : '#b45309', (r - 0.5) * 12);
      if (y >= 4 && y <= 7 && (x === 5 || x === 10)) return '#d97706';
      return null;
    });
    tilePixels(124, (x, y) => {
      if (x >= 3 && x <= 12 && Math.abs((15 - x) - y) <= 1) return (x >= 10 ? '#a855f7' : (x <= 5 ? '#f59e0b' : '#b45309'));
      return null;
    });
    tilePixels(125, (x, y, r) => {
      const body = Math.hypot((x - 8.5) * 0.72, (y - 8) * 1.35) < 3.6;
      const tail = (x >= 2 && x <= 4 && Math.abs(y - 8) <= (5 - x));
      if (x === 11 && y === 7) return '#0f172a';
      return (body || tail) ? shade(y < 8 ? '#38bdf8' : '#bae6fd', (r - 0.5) * 16) : null;
    });
    tilePixels(126, (x, y, r) => {
      const body = Math.hypot((x - 8.5) * 0.72, (y - 8) * 1.35) < 3.6;
      const tail = (x >= 2 && x <= 4 && Math.abs(y - 8) <= (5 - x));
      if (x === 11 && y === 7) return '#451a03';
      return (body || tail) ? shade(y < 8 ? '#d97706' : '#fcd34d', (r - 0.5) * 16) : null;
    });
    tilePixels(127, (x, y, r) => {
      if (Math.hypot((x - 8) * 0.65, (y - 8.5) * 1.15) < 4.2) return shade(y < 8 ? '#f59e0b' : '#b45309', (r - 0.5) * 16);
      return null;
    });
    tilePixels(128, (x, y, r) => {
      if (x === 9 && y >= 2 && y <= 6) return '#ef4444';
      const d = Math.hypot(x - 7.5, y - 9.5);
      if (d > 4.6) return null;
      if (y <= 7 && d < 3.4) return '#fef9c3';
      return shade('#78350f', (r - 0.5) * 14);
    });
    tilePixels(129, (x, y, r) => {
      if (x >= 6 && x <= 9 && y >= 2 && y <= 4) return '#b45309';
      if (Math.hypot(x - 7.5, y - 10) < 4.5) return shade(y < 9 ? '#bae6fd' : '#06b6d4', (r - 0.5) * 14);
      return null;
    });
    drawSpriteMap(130, SHOVEL_SPRITE, palIron);
    drawSpriteMap(131, SHOVEL_SPRITE, palDiamond);

    // v17 Crisp 16x16 Tiles (132-157): Real Minecraft Torch, Shield, 4-Piece Armor, Abandoned Modern City & New Flora!
    tilePixels(132, (x, y, r) => {
      // Authentic Minecraft Torch Sprite: thin wooden stick + glowing coal/yellow-orange flame tip!
      if (x >= 7 && x <= 8 && y >= 5 && y <= 14) return shade(x === 7 ? '#8b5e34' : '#634122', (r - 0.5) * 14);
      if (x >= 7 && x <= 8 && y >= 2 && y <= 4) return y === 2 ? '#fef9c3' : (y === 3 ? '#facc15' : '#ea580c');
      if ((x === 6 || x === 9) && y === 3) return '#f97316';
      return null;
    });
    tilePixels(133, (x, y, r) => {
      // Authentic Minecraft Oak-Plank & Riveted Iron-Rim Shield Sprite
      if (x < 2 || x > 13 || y < 1 || y > 14) return null;
      if (x === 2 || x === 13 || y === 1 || y === 14) return shade(x === 13 || y === 14 ? '#646b75' : '#949ba5', (r - 0.5) * 10);
      if ((x === 4 || x === 11) && (y === 3 || y === 6 || y === 9 || y === 12)) return '#7c8490';
      if ((x === 4 || x === 11) && (y === 4 || y === 7 || y === 10 || y === 13)) return '#3d2a16';
      const plankCols = ['#6a4c28', '#5d4121', '#73532d', '#583d1f'];
      return shade(plankCols[(x - 3) % plankCols.length], (r - 0.5) * 10);
    });
    const drawHelmet = (idx, pal) => tilePixels(idx, (x, y) => {
      if (y >= 3 && y <= 11 && x >= 3 && x <= 12) {
        if (y >= 8 && x >= 5 && x <= 10) return null;
        if (y === 3 || x === 3 || x === 12) return pal.D;
        return (y === 4 || x === 4) ? pal.H : pal.M;
      }
      return null;
    });
    const drawLegs = (idx, pal) => tilePixels(idx, (x, y) => {
      if (y >= 2 && y <= 13 && x >= 4 && x <= 11) {
        if (y >= 7 && (x === 7 || x === 8)) return null;
        if (y === 2 || x === 4 || x === 11 || y === 13) return pal.D;
        return (x === 5 || y === 3) ? pal.H : pal.M;
      }
      return null;
    });
    const drawBoots = (idx, pal) => tilePixels(idx, (x, y) => {
      if (y >= 8 && y <= 13 && ((x >= 2 && x <= 6) || (x >= 9 && x <= 13))) {
        if (y === 13 || y === 8 || x === 2 || x === 6 || x === 9 || x === 13) return pal.D;
        return y === 9 ? pal.H : pal.M;
      }
      return null;
    });
    drawHelmet(134, palIron); drawLegs(135, palIron); drawBoots(136, palIron);
    drawHelmet(137, palDiamond); drawLegs(138, palDiamond); drawBoots(139, palDiamond);

    // Abandoned Modern City Blocks (140-146)
    tilePixels(140, (x, y, r) => ((x + y * 3) % 19 === 0 ? '#181a1f' : shade('#2f333b', (r - 0.5) * 18)));
    tilePixels(141, (x, y, r) => (x >= 6 && x <= 9 && y >= 2 && y <= 13) ? shade('#eab308', (r - 0.5) * 18) : shade('#2f333b', (r - 0.5) * 18));
    tilePixels(142, (x, y, r) => (y === 0 || y === 8) ? '#6b7280' : shade('#9ca3af', (r - 0.5) * 14));
    tilePixels(143, (x, y, r) => {
      if ((Math.abs(x - y) <= 0 && y > 4) || (x + y === 15 && y < 10)) return '#1f2937';
      if ((x + y * 5) % 13 === 0) return '#3f6212'; // moss creeping on ruined concrete!
      return shade('#757c85', (r - 0.5) * 20);
    });
    tilePixels(144, (x, y, r) => (x <= 1 || x >= 14 || y <= 1 || y >= 14 || Math.abs(x - y) <= 1 || Math.abs(x + y - 15) <= 1) ? shade((x + y) % 3 === 0 ? '#9a3412' : '#573628', (r - 0.5) * 16) : null);
    tilePixels(145, (x, y) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#334155';
      if (x + y < 7 || x + y > 24 || Math.abs(x - y) === 6) return '#94a3b8';
      return null;
    });
    tilePixels(146, (x, y, r) => {
      if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return '#1e293b';
      if ((y === 5 && x >= 6 && x <= 9) || (y === 4 && (x === 7 || x === 8)) || (y === 6 && x >= 5 && x <= 10)) return '#38bdf8';
      if ((y === 10 && x >= 6 && x <= 9) || (y === 11 && (x === 7 || x === 8)) || (y === 9 && x >= 5 && x <= 10)) return '#facc15';
      return shade('#475569', (r - 0.5) * 10);
    });

    // New Biomes, Trees & Flora Blocks (147-157) — Tile 147 = Authentic Minecraft Bamboo Stalk Side (Image 4!)
    tilePixels(147, (x, y, r) => {
      if (y === 4 || y === 12) return shade('#8ac94c', (r - 0.5) * 10); // Pale bamboo node ring!
      if (y === 5 || y === 13) return shade('#2e5914', (r - 0.5) * 8);  // Crisp shadow under node!
      const ridge = (x <= 2 || x >= 13) ? '#3c6e1b' : ((x >= 6 && x <= 9) ? '#63a32b' : '#4f8a22');
      return shade(ridge, (r - 0.5) * 12);
    });
    tilePixels(148, (x, y, r) => shade((x + y * 3) % 5 === 0 ? '#8c748a' : '#735e70', (r - 0.5) * 16));
    tilePixels(149, (x, y, r) => y < 4 ? shade('#7a6578', (r - 0.5) * 12) : dirtColor(x, y, r));
    tilePixels(150, (x, y, r) => (Math.hypot(x - 4, y - 4) < 2.2 || Math.hypot(x - 11, y - 10) < 2.4 || Math.hypot(x - 12, y - 3) < 1.8) ? '#f8fafc' : shade('#dc2626', (r - 0.5) * 18));
    tilePixels(151, (x, y, r) => shade(x % 4 === 0 ? '#d6cfc2' : '#eae4d8', (r - 0.5) * 10));
    tilePixels(152, (x, y, r) => (x % 4 === 0) ? '#1f2229' : shade('#3d424d', (r - 0.5) * 18));
    drawSpriteMap(153, POPPY_SPRITE, { R: '#a855f7', H: '#e9d5ff', G: '#3b8c26', g: '#5ec240', d: '#255c17' });
    tilePixels(154, (x, y, r) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.5) return null;
      if (d < 2.6) return '#facc15';
      if (d < 4.6) return shade('#f472b6', (r - 0.5) * 14);
      return shade('#22c55e', (r - 0.5) * 14);
    });
    drawSpriteMap(155, TALL_GRASS_SPRITE, { g: '#ef4444', G: '#166534', d: '#14532d' });
    drawSpriteMap(156, TALL_GRASS_SPRITE, { g: '#68e332', G: '#36ab1a', d: '#1d690c' });
    tilePixels(157, (x, y, r) => {
      // Rich Hanging Lush Forest Vines (connected vertical stems + dense leaf clusters matching Images 2 & 3!)
      const stemA = (x === 2 || x === 3 || (x === 4 && (y % 5) < 2));
      const stemB = (x === 7 || (x === 8 && (y % 4) !== 1));
      const stemC = (x === 12 || x === 13 || (x === 11 && ((y + 2) % 5) < 2));
      const leafCluster = (((x - 3) * (x - 3) + ((y % 6) - 2) * ((y % 6) - 2)) <= 4 && r > 0.25)
        || (((x - 8) * (x - 8) + (((y + 3) % 5) - 2) * (((y + 3) % 5) - 2)) <= 4 && r > 0.22)
        || (((x - 12) * (x - 12) + (((y + 1) % 6) - 3) * (((y + 1) % 6) - 3)) <= 4 && r > 0.25);
      if (!stemA && !stemB && !stemC && !leafCluster) return null;
      const col = r > 0.78 ? '#64cf3a' : (r > 0.45 ? '#35941d' : (r > 0.18 ? '#216b13' : '#14470b'));
      return shade(col, (r - 0.5) * 14);
    });

    // v18 New Ores (158-162), Pickaxes/Swords (163-167), and 4 Full Armor Sets: Leather/Gold/Ruby/Netherite (168-183)!
    tilePixels(158, (x, y, r) => oreTileColor(x, y, r, IRON_ORE_MAP, false, { H: '#5eead4', M: '#ea7c42', s: '#b4532a', d: '#147a6c' })); // Copper Ore w/ verdigris specks!
    tilePixels(159, (x, y, r) => oreTileColor(x, y, r, COAL_ORE_MAP, false, { M: '#e2e8f0', s: '#94a3b8', d: '#475569' }));                  // Tin/Silver Ore
    tilePixels(160, (x, y, r) => oreTileColor(x, y, r, DIAMOND_ORE_MAP, false, { H: '#a7f3d0', M: '#10b981', s: '#047857', d: '#064e3b' })); // Emerald Ore
    tilePixels(161, (x, y, r) => oreTileColor(x, y, r, DIAMOND_ORE_MAP, true, { H: '#fda4af', M: '#f43f5e', s: '#be123c', d: '#881337' }));  // Ruby Ore
    tilePixels(162, (x, y, r) => oreTileColor(x, y, r, GOLD_ORE_MAP, true, { H: '#c4b5fd', M: '#7c3aed', s: '#4c1d95', d: '#271738' }));     // Ancient Netherite/Titanium Debris!
    const palCopper    = { D:'#5c2810', W:'#85532a', M:'#ea7c42', H:'#fdba74', G:'#b4532a' };
    const palLeather   = { D:'#3b1e0a', W:'#78350f', M:'#92400e', H:'#b45309', G:'#6b310c' };
    const palGold      = { D:'#78350f', W:'#85532a', M:'#facc15', H:'#fef08a', G:'#ca8a04' };
    const palRuby      = { D:'#6b0924', W:'#85532a', M:'#f43f5e', H:'#fda4af', G:'#be123c' };
    const palNetherite = { D:'#181322', W:'#3b2514', M:'#4c3d5e', H:'#a78bfa', G:'#2d233a' };
    drawSpriteMap(163, PICK_SPRITE, palCopper);
    drawSpriteMap(164, PICK_SPRITE, palRuby);
    drawSpriteMap(165, PICK_SPRITE, palNetherite);
    drawSpriteMap(166, SWORD_SPRITE, palRuby);
    drawSpriteMap(167, SWORD_SPRITE, palNetherite);
    const drawChest = (idx, pal) => tilePixels(idx, (x, y) => {
      if (y < 2 || y > 13 || x < 2 || x > 13) return null;
      if (y <= 4 && x >= 6 && x <= 9) return null;
      if (y >= 7 && (x <= 3 || x >= 12)) return null;
      if (x === 2 || x === 13 || y === 2 || y === 13 || (y === 6 && (x <= 3 || x >= 12))) return pal.D;
      return y === 3 || x === 7 ? pal.H : pal.M;
    });
    drawHelmet(168, palLeather);   drawChest(169, palLeather);   drawLegs(170, palLeather);   drawBoots(171, palLeather);
    drawHelmet(172, palGold);      drawChest(173, palGold);      drawLegs(174, palGold);      drawBoots(175, palGold);
    drawHelmet(176, palRuby);      drawChest(177, palRuby);      drawLegs(178, palRuby);      drawBoots(179, palRuby);
    drawHelmet(180, palNetherite); drawChest(181, palNetherite); drawLegs(182, palNetherite); drawBoots(183, palNetherite);

    // v21 Authentic Minecraft Cactus Top (184), Sugar Cane (185), Bamboo Top/Icon/Leaves (186-188), Bamboo Block (189-190), Bamboo Planks (191)!
    tilePixels(184, (x, y, r) => {
      const border = (x === 0 || x === 15 || y === 0 || y === 15);
      const star = (x === 7 || x === 8 || y === 7 || y === 8);
      if (border) return '#1d5622';
      if (star && Math.abs(x - 7.5) < 4.5 && Math.abs(y - 7.5) < 4.5) return shade('#6ec44d', (r - 0.5) * 10);
      return shade(((x & 3) === 0 || (y & 3) === 0) ? '#2b6b25' : '#459636', (r - 0.5) * 12);
    });
    // Tile 185: Lush Multi-Stalk Sugar Cane (Image 2!)
    tilePixels(185, (x, y, r) => {
      const stalks = [3, 7, 11, 13];
      for (const sx of stalks) {
        if (Math.abs(x - sx) <= 0.6) {
          if (y % 5 === 2) return '#c2f279';
          return shade(x === sx ? '#79cc3a' : '#529e24', (r - 0.5) * 12);
        }
        if ((y === 4 || y === 9 || y === 13) && Math.abs(x - (sx + 1)) <= 1 && r > 0.32) return '#92e04a';
      }
      return null;
    });
    // Tile 186: Bamboo Stalk Top (Image 4!)
    tilePixels(186, (x, y, r) => (x >= 5 && x <= 10 && y >= 5 && y <= 10) ? '#4f8522' : shade('#91d14b', (r - 0.5) * 12));
    // Tile 187: Authentic Diagonal Bamboo Item Icon with Side Sprout Leaf (EXACT Image 5!)
    const BAMBOO_ICON_SPRITE = [
      '............MMd.',
      '...........MMMd.',
      '..........HMMd..',
      '.........HMMd...',
      '........HHMd....',
      '.......MMMdMM...',
      '......MMMd.HM...',
      '.....HMMd...M...',
      '....HHMd........',
      '...MMMd.........',
      '..MMMd..........',
      '.HMMd...........',
      'MMMd............',
      'MMd.............',
      'dd..............',
      '................'
    ];
    drawSpriteMap(187, BAMBOO_ICON_SPRITE, { H: '#9ad64f', M: '#5a9624', d: '#366114' });
    // Tile 188: Crisp Bamboo Top Leaves (Images 6 & 7!)
    tilePixels(188, (x, y, r) => {
      const inLeaf = ((y >= 2 && y <= 6 && x >= 1 && x <= 14) || (y >= 8 && y <= 13 && x >= 2 && x <= 13));
      if (!inLeaf) return null;
      if (((x + y * 3) % 5) === 0) return null;
      return shade(((x + y) & 1) ? '#6db52f' : '#4a851d', (r - 0.5) * 16);
    });
    // Tile 189: Bundled Bamboo Block Top — EXACT Image 9 3x3 Grid of Hollow Bamboo Rings!
    tilePixels(189, (x, y, r) => {
      const cx = x % 5, cy = y % 5;
      if (x === 15 || y === 15) return '#3b5719';
      if (cx === 0 || cy === 0) return shade('#9eb84c', (r - 0.5) * 10);
      if (cx === 4 || cy === 4) return shade('#597523', (r - 0.5) * 10);
      if (cx === 2 && cy === 2) return '#2d4012';
      return shade('#759632', (r - 0.5) * 12);
    });
    // Tile 190: Bundled Bamboo Block Side — EXACT Image 9 Vertical Bundled Culms w/ Staggered Pale Joint Stripes!
    tilePixels(190, (x, y, r) => {
      const stalk = Math.floor(x / 4);
      const lx = x % 4;
      const nodeY = (stalk * 5 + 3) % 14;
      if (y === nodeY || y === (nodeY + 8) % 16) return shade('#9ec24e', (r - 0.5) * 10);
      if (y === (nodeY + 1) % 16) return '#345214';
      const baseCol = lx === 0 ? '#3c5c19' : (lx === 1 ? '#6e942e' : (lx === 2 ? '#598024' : '#47691b'));
      return shade(baseCol, (r - 0.5) * 12);
    });
    // Tile 191: Warm Golden-Yellow Bamboo Planks — EXACT Image 8 Minecraft 1.20 Bamboo Planks!
    tilePixels(191, (x, y, r) => {
      const row = y >> 2, ly = y & 3;
      const seam = (ly === 0) || (x === ((row * 7 + 4) & 15));
      if (seam) return shade('#9c8332', (r - 0.5) * 8);
      if (ly === 1) return shade('#ebd673', (r - 0.5) * 10);
      return shade(ly === 2 ? '#d6be56' : '#c2a842', (r - 0.5) * 12);
    });

    // v22 Authentic Bamboo Shoot (192), 2-Block Bed Pillow/Blanket/Sides (193-196), Lush Moss (197), Glow Vines (198), Crimson Maple (199), Cobweb (200), Mineshaft Rail (201), End Crystal (202)!
    const BAMBOO_SHOOT_SPRITE = [
      '.......g........',
      '.......gG.......',
      '......gGG.......',
      '......gGgd......',
      '.....gGBgG......',
      '.....gBBbG......',
      '.....bBbbG......',
      '....bBBbBb......',
      '....dBbBBd......',
      '....bBdbBb......',
      '....dBBbBd......',
      '...dBdbBBbd.....',
      '...bBbdBbBd.....',
      '...dBbbBbbd.....',
      '...dd..dd.......',
      '................'
    ];
    drawSpriteMap(192, BAMBOO_SHOOT_SPRITE, { g: '#7cc730', G: '#4a851d', B: '#6d552b', b: '#947843', d: '#3d2c15' });
    // Tile 193: Bed White Quilted Pillow Top (EXACT Image 10 & images.jpg!)
    tilePixels(193, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#cbd5e1';
      if (x === 1 || x === 14 || y === 1 || y === 14) return '#e2e8f0';
      return shade('#f8fafc', (r - 0.5) * 8);
    });
    // Tile 194: Bed Crimson Blanket Top w/ Subtle Fold Crease!
    tilePixels(194, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#991b1b';
      if (y === 3 || y === 4) return shade('#b91c1c', (r - 0.5) * 10);
      return shade('#dc2626', (r - 0.5) * 14);
    });
    // Tile 195: Bed Crimson Blanket Side (pure quilted crimson wool w/ crisp top & hem shading)
    tilePixels(195, (x, y, r) => {
      if (y === 0) return '#ef4444';
      if (y >= 14) return '#991b1b';
      if (y === 13 || x === 0 || x === 15) return '#b91c1c';
      return shade('#dc2626', (r - 0.5) * 14);
    });
    // Tile 196: Bed White Pillow Side (pure quilted white pillow w/ crisp seam border)
    tilePixels(196, (x, y, r) => {
      if (y === 0) return '#ffffff';
      if (y >= 14) return '#cbd5e1';
      if (y === 13 || x === 0 || x === 15) return '#dbe4ee';
      return shade('#f8fafc', (r - 0.5) * 10);
    });
    // Tile 197: Lush Cave Rich Emerald-Olive Moss Block
    tilePixels(197, (x, y, r) => shade(((x * 3 + y * 5) % 7 === 0) ? '#74b83b' : (((x + y) & 3) === 0 ? '#3f7322' : '#57962e'), (r - 0.5) * 18));
    // Tile 198: Lush Cave Hanging Glow Berry Vines (Vibrant hanging vine + bright golden glowing berries!)
    tilePixels(198, (x, y, r) => {
      const isBerry = (Math.hypot(x - 5, y - 5) < 2.2) || (Math.hypot(x - 10, y - 11) < 2.3) || (Math.hypot(x - 8, y - 14) < 1.8);
      if (isBerry) return (r > 0.45 ? '#fef08a' : '#f59e0b');
      const stem = (x === 7 || x === 8 || (x === 6 && (y & 3) === 1) || (x === 9 && (y & 3) === 2));
      const leaf = ((Math.abs(x - 7.5) <= 3.5 && ((x + y * 3) % 5 === 0)));
      if (stem || leaf) return shade(stem ? '#2e6e24' : '#4fa834', (r - 0.5) * 14);
      return null;
    });
    // Tile 199: Vivid Scarlet/Crimson Autumn Maple Leaves
    drawFancyLeaf(199, { H: '#f87171', M: '#dc2626', S: '#991b1b', D: '#5c0e0e' }, AUTUMN_LEAF_MASK);
    // Tile 200: Abandoned Mineshaft Spider Cobweb
    tilePixels(200, (x, y) => {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5), d = Math.hypot(dx, dy);
      if (Math.abs(dx - dy) < 0.7 || dx < 0.6 || dy < 0.6 || Math.abs(d - 3.5) < 0.55 || Math.abs(d - 6.5) < 0.55) return '#f1f5f9';
      return null;
    });
    // Tile 201: Abandoned Mineshaft Wooden & Iron Rail Track
    tilePixels(201, (x, y, r) => {
      if (x === 3 || x === 4 || x === 11 || x === 12) return shade('#cbd5e1', (r - 0.5) * 14);
      if (y % 4 === 1 || y % 4 === 2) return (x >= 2 && x <= 13) ? shade('#8c5e35', (r - 0.5) * 12) : null;
      return null;
    });
    // Tile 202: Radiant Amethyst End Crystal Block
    tilePixels(202, (x, y, r) => {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d < 4.5) return '#fdf4ff';
      if (d < 8.5) return shade('#e879f9', (r - 0.5) * 14);
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#581c87';
      return shade('#a21caf', (r - 0.5) * 12);
    });

    // ===================== v23.0 AUTHENTIC PIXEL ART TILES (203..249) =====================
    // Tile 203: Wheat Seeds (EXACT media_1795130875664 scattered bright-green & olive seed grains!)
    const WHEAT_SEEDS_SPRITE = [
      '................','................','....L......L....','....g.......L...',
      '....d.......g...','...L........gd..','...L..gG....dd..','...L..dd........',
      '..gG.y..........','..dd.d..L.......','........L..yY...',
      '.......gG..dd...','.......dd.......','................','................','................'
    ];
    drawSpriteMap(203, WHEAT_SEEDS_SPRITE, { L: '#22c55e', g: '#65a30d', G: '#4d7c0f', d: '#365314', y: '#a3a826', Y: '#71761a' });
    // Tile 204: Harvested Wheat Sheaf (EXACT media_1795130883111 golden bundle tied in dark green!)
    const WHEAT_ITEM_SPRITE = [
      '..........b.....','........y.b..b..','.....bb.yYbb....','......yYyyYbb.b.',
      '......YyyYyyYb..','......yyYyyYyy..','.....yYyyYyyb...','....dGyyYyydd...',
      '...ydGGyyyd.....','..yYGGddG..d....','.yYyydd.........','.dYyd...........',
      '.d.d............','................','................','................'
    ];
    drawSpriteMap(204, WHEAT_ITEM_SPRITE, { y: '#e5d84e', Y: '#b8a828', b: '#7a6820', G: '#4a6b1d', d: '#2c4211' });
    // Tiles 205-208: 4 Wheat Crop Growth Stages (EXACT media_1795130887896 -> media_1795130906211!)
    for (let st = 0; st < 4; st++) {
      tilePixels(205 + st, (x, y, r) => {
        const stalkXs = st === 3 ? [1, 3, 5, 7, 9, 11, 13, 15] : [2, 5, 8, 11, 13];
        const minY = st === 0 ? 12 : (st === 1 ? 8 : (st === 2 ? 4 : 0));
        if (y < minY) return null;
        for (let si = 0; si < stalkXs.length; si++) {
          const sx = stalkXs[si];
          const localTop = minY + ((si * 2) % 3);
          if (y < localTop) continue;
          const hasGrain = st >= 2 && Math.abs(x - sx) === 1 && y < localTop + (st === 3 ? 8 : 5) && (((x + y + si) & 1) || (st === 3 && y < localTop + 5));
          if (x === sx || hasGrain) {
            if (st === 0) return shade('#22c55e', (r - 0.5) * 20);
            if (st === 1) return shade(y < localTop + 3 ? '#65a30d' : '#3f7d1c', (r - 0.5) * 18);
            if (st === 2) return shade(y < localTop + 4 ? '#d4c33b' : '#659624', (r - 0.5) * 16);
            if (y < localTop + 3) return shade(r > 0.48 ? '#fef08a' : '#fde047', (r - 0.5) * 12);
            if (y < localTop + 8) return shade(r > 0.42 ? '#facc15' : '#eab308', (r - 0.5) * 14);
            return shade(y < 13 ? '#d97706' : '#a16207', (r - 0.5) * 14);
          }
        }
        return null;
      });
    }
    // Tile 209: Wet Tilled Farmland Soil Top
    tilePixels(209, (x, y, r) => {
      if ((y & 3) === 0) return shade('#3b2312', (r - 0.5) * 10);
      return shade((y & 3) === 1 ? '#5e3b20' : '#4d2f18', (r - 0.5) * 12);
    });
    // Tile 210 & 211: Authentic Minecraft Watermelon Top & Striped Side (EXACT media_1795131016477!)
    tilePixels(210, (x, y, r) => {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      if (dx < 1.5 && dy < 1.5) return '#3f5a16';
      const ring = Math.max(dx, dy);
      if ((Math.floor(ring) & 1) === 0 && (dx < 1.4 || dy < 1.4 || Math.abs(dx - dy) < 1.2)) return shade('#4d7a1d', (r - 0.5) * 14);
      return shade('#96c938', (r - 0.5) * 16);
    });
    tilePixels(211, (x, y, r) => {
      const stripe = ((x + Math.floor(Math.sin(y * 0.7) * 0.8)) & 3) === 0;
      if (stripe) return shade('#48751a', (r - 0.5) * 14);
      return shade(((x & 3) === 2) ? '#84ba2c' : '#a2d43f', (r - 0.5) * 16);
    });
    // Tile 212: Juicy Red Melon Slice with Black Seeds (media_1795131016477!)
    const MELON_SLICE_SPRITE = [
      '................','................','..........dd....','.........dGGd...',
      '........dGRRGd..','.......dGRbRRd..','......dGRRRRbd..','.....dGRbRRRRd..',
      '....dGRRRRRbRd..','...dGRRbRRRRd...','..dGRRRRRRRd....','..dGGRRRRRd.....',
      '...dGGGGGdd.....','....ddddd.......','................','................'
    ];
    drawSpriteMap(212, MELON_SLICE_SPRITE, { d: '#2d5a12', G: '#7ac72b', R: '#ef4444', b: '#1c1917' });
    // Tile 213: Peach, Tile 214: Mango, Tile 215: Blueberry Bush
    tilePixels(213, (x, y, r) => {
      if (y >= 2 && y <= 4 && x >= 7 && x <= 10) return '#22c55e';
      const d = Math.hypot(x - 7.5, y - 9.2);
      if (d <= 4.6) return shade(y < 8 ? '#fda4af' : '#fb7185', (r - 0.5) * 16);
      return null;
    });
    tilePixels(214, (x, y, r) => {
      if (y >= 2 && y <= 4 && x >= 7 && x <= 9) return '#15803d';
      const d = Math.hypot((x - 7.5) * 1.15, (y - 9.5) * 0.85);
      if (d <= 4.3) return shade(y < 8 ? '#facc15' : '#f97316', (r - 0.5) * 18);
      return null;
    });
    tilePixels(215, (x, y, r) => {
      const b1 = Math.hypot(x - 5, y - 6) < 2.0, b2 = Math.hypot(x - 11, y - 8) < 2.0, b3 = Math.hypot(x - 7, y - 12) < 2.0;
      if (b1 || b2 || b3) return r > 0.45 ? '#60a5fa' : '#1d4ed8';
      if (y >= 4 && Math.hypot(x - 7.5, y - 10) < 6.2 && ((x + y * 3) % 4 !== 0)) return shade('#2d6e32', (r - 0.5) * 18);
      return null;
    });
    // Tile 216: Autumn Golden Grass, Tile 217: Autumn Crimson Bush, Tile 218/219: Autumn Podzol Top & Side
    tilePixels(216, (x, y, r) => {
      const bladePhase = ((x * 5 + (x >> 1) * 3) % 7);
      const minY = bladePhase < 2 ? 0 : (bladePhase < 5 ? 2 : 5);
      if (y < minY) return null;
      const gap = (x % 3 === 1 && y < 7) || (x === 0 && y < 10) || (x === 15 && y < 10);
      if (gap && r < 0.75) return null;
      if (y <= 4) return shade('#fbbf24', (r - 0.5) * 14);
      if (y <= 9) return shade(r > 0.5 ? '#f59e0b' : '#ea580c', (r - 0.5) * 16);
      return shade(y <= 13 ? '#b45309' : '#7c2d12', (r - 0.5) * 12);
    });
    tilePixels(217, (x, y, r) => {
      if (Math.hypot(x - 7.5, y - 9.5) < 6.2 && ((x * 3 + y * 5) % 7 !== 0)) return shade(r > 0.5 ? '#ea580c' : '#c2410c', (r - 0.5) * 20);
      return null;
    });
    tilePixels(218, (x, y, r) => shade(r > 0.72 ? '#d97706' : (r > 0.35 ? '#9a4e1c' : '#6b3614'), (r - 0.5) * 18));
    tilePixels(219, (x, y, r) => y < 4 ? shade('#b45309', (r - 0.5) * 16) : shade('#7c4e2d', (r - 0.5) * 14));
    // Tiles 220-222: Iron, Gold & Copper Ingots
    const INGOT_SPRITE = [
      '................','................','................','......dddd......',
      '....ddHHHHdd....','...dHHHHHHHHd...','..dHHMMMMMMMHd..','..dHMMMMMMMMMd..',
      '..dHMMMMMMddMd..','..dHMMMMddMMMd..','..dHMMddMMMMMd..','...ddMMMMMMdd...',
      '....dddddddd....','................','................','................'
    ];
    drawSpriteMap(220, INGOT_SPRITE, { d: '#475569', M: '#cbd5e1', H: '#ffffff' });
    drawSpriteMap(221, INGOT_SPRITE, { d: '#854d0e', M: '#eab308', H: '#fef08a' });
    drawSpriteMap(222, INGOT_SPRITE, { d: '#7c2d12', M: '#ea7c42', H: '#fdba74' });
    // Tile 223: Smooth Stone, Tile 224: Lapis Ore, Tile 225: Quartz Ore
    tilePixels(223, (x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15) ? '#787e85' : shade('#9ca3af', (r - 0.5) * 8));
    tilePixels(224, (x, y, r) => {
      const gem = ((x >= 3 && x <= 5 && y >= 4 && y <= 6) || (x >= 10 && x <= 12 && y >= 5 && y <= 8) || (x >= 5 && x <= 8 && y >= 10 && y <= 13));
      return gem ? shade(r > 0.5 ? '#3b82f6' : '#1d4ed8', (r - 0.5) * 18) : shade('#7c848c', (r - 0.5) * 14);
    });
    tilePixels(225, (x, y, r) => {
      const gem = ((x >= 3 && x <= 6 && y >= 3 && y <= 5) || (x >= 9 && x <= 13 && y >= 7 && y <= 9) || (x >= 4 && x <= 7 && y >= 11 && y <= 13));
      return gem ? shade('#f8fafc', (r - 0.5) * 12) : shade('#6e2525', (r - 0.5) * 16);
    });
    // Tile 226 & 227: Raw Beef & Cooked Steak
    const BEEF_SPRITE = [
      '................','................','.....dddddd.....','...ddMMMMMMdd...',
      '..dMMHHMMMMMMd..','..dMHHHMMMMMMd..','..dMMMMMMHHMMd..','..dMMMMMHHHMMd..',
      '..dMMMMMMHHMMd..','...dMMMMMMMMd...','....ddMMMMdd....','......dddd......',
      '................','................','................','................'
    ];
    drawSpriteMap(226, BEEF_SPRITE, { d: '#7f1d1d', M: '#ef4444', H: '#fecaca' });
    drawSpriteMap(227, BEEF_SPRITE, { d: '#3b1508', M: '#7c2d12', H: '#b45309' });
    // Tiles 228-231: Blast Furnace (Top & Front) & Smoker (Top & Front) matching Image 7!
    tilePixels(228, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#2d3036';
      if (x === 3 || x === 12 || y === 3 || y === 7 || y === 12) return '#363940';
      if ((x === 1 || x === 14) && (y === 1 || y === 14)) return '#6e737d';
      return shade(((x + y) & 1) ? '#555961' : '#484c54', (r - 0.5) * 10);
    });
    tilePixels(229, (x, y, r) => {
      // Center light-grey metallic faceplate with 3 vertical black vent slits (matching Image 7 bottom!)
      if (x >= 4 && x <= 11 && y >= 6 && y <= 12) {
        if (x === 4 || x === 11 || y === 6 || y === 12) return (y === 6 || x === 4) ? '#a6abb3' : '#5e626a';
        if (y >= 8 && y <= 10 && (x === 5 || x === 7 || x === 9)) return '#0f1115';
        return shade(y === 7 ? '#d8dce2' : '#bfc4cc', (r - 0.5) * 8);
      }
      // Top corner light-grey iron rivet brackets
      if ((x <= 3 || x >= 12) && y <= 2) {
        if ((x === 1 || x === 2 || x === 13 || x === 14) && y === 1) return '#3a3d45';
        return shade('#9ea3ab', (r - 0.5) * 8);
      }
      if (y <= 7) {
        if (x >= 5 && x <= 10 && (y === 3 || y === 4)) return '#22252a';
        if (x === 0 || x === 15 || y === 0) return '#2b2e34';
        return shade('#434750', (r - 0.5) * 10);
      }
      if (y === 8) return '#a8adb5';
      if (x === 0 || x === 15 || y === 15 || x === 7 || x === 8) return '#52565e';
      return shade('#848991', (r - 0.5) * 10);
    });
    tilePixels(230, (x, y, r) => {
      // Smoker Top: 4 oak corner pixels + cobblestone frame + central 6x6 dark square chimney hole (matching Image 7 top!)
      if ((x <= 1 || x >= 14) && (y <= 1 || y >= 14)) return shade('#6b5130', (r - 0.5) * 8);
      if (x >= 5 && x <= 10 && y >= 5 && y <= 10) return (x >= 6 && x <= 9 && y >= 6 && y <= 9) ? '#121212' : '#242424';
      if (x === 4 || x === 11 || y === 4 || y === 11) return '#4a4a4a';
      return shade(((x * 3 + y * 5) % 4 === 0) ? '#8f8f8f' : '#757575', (r - 0.5) * 12);
    });
    const smokerBark = (x, y, r) => barkColor(x, y, r, { c: '#7d5f39', a: '#6b5130', b: '#543d22', d: '#3d2b16' });
    tilePixels(231, (x, y, r) => {
      // Smoker Front: Oak log frame + upper oven door (left silver iron bar + right black opening) + lower wooden ember grate (matching Image 7 top!)
      if (x <= 2 || x >= 13 || y <= 2) return smokerBark(x, y, r);
      if (y >= 3 && y <= 7) {
        if (x === 3 || x === 12 || y === 3 || y === 7) return shade('#828282', (r - 0.5) * 10);
        if (x === 4 || x === 5) return shade(x === 4 ? '#d4d4d4' : '#b0b0b0', (r - 0.5) * 8);
        return '#171717';
      }
      if (y === 8 || y === 9 || y === 13) return smokerBark(x, y, r);
      if (y >= 10 && y <= 12) {
        return ((x & 1) === 1) ? shade('#6b5130', (r - 0.5) * 8) : (y === 11 ? '#3b2410' : '#1f150c');
      }
      return shade(y === 15 ? '#4f4f4f' : '#7d7d7d', (r - 0.5) * 10);
    });
    // Tiles 232-239: Iron, Gold, Diamond & Netherite Chest Top + Front (images (13)-(14).jpg!)
    const drawChestTiles = (tTop, tFront, rim, body, latch) => {
      tilePixels(tTop, (x, y, r) => (x <= 1 || x >= 14 || y <= 1 || y >= 14) ? rim : shade(body, (r - 0.5) * 12));
      tilePixels(tFront, (x, y, r) => {
        if (x >= 6 && x <= 9 && y >= 5 && y <= 9) return latch;
        if (y === 6) return '#18181b';
        if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return rim;
        return shade(body, (r - 0.5) * 12);
      });
    };
    drawChestTiles(232, 233, '#64748b', '#cbd5e1', '#1e293b');
    drawChestTiles(234, 235, '#a16207', '#facc15', '#78350f');
    drawChestTiles(236, 237, '#0e7490', '#22d3ee', '#fef08a');
    drawChestTiles(238, 239, '#1e1b2e', '#4c3a5d', '#f59e0b');
    // Tiles 240-244: 5 Authentic Minecraft Doors (Oak, Spruce, Birch, Bamboo, Iron — exact palette from image/images (24)-(30).jpg!)
    const drawDoorTile = (idx, frame, panel, handle, mode) => {
      tilePixels(idx, (x, y, r) => {
        if (mode === 'spruce') {
          if ((y === 2 || y === 7 || y === 13) && x >= 1 && x <= 14) return ((x & 3) === 0) ? '#26292e' : '#3a3e45';
          if (x >= 10 && x <= 13 && y >= 8 && y <= 11 && (x === 10 || x === 13 || y === 8 || y === 11)) return handle;
          if (x === 0 || x === 4 || x === 8 || x === 12 || x === 15) return shade(frame, -16);
          return shade(panel, ((x & 1) ? 5 : -4) + (r - 0.5) * 10);
        }
        if (x === 1 && (y === 3 || y === 8 || y === 13)) return '#6e737b';
        if (x === 11 && y === 8) return handle;
        if (x === 12 && (y === 8 || y === 9)) return handle;
        if (x <= 1 || x >= 14 || y === 0 || y === 15 || y === 7) return shade(frame, (r - 0.5) * 10);
        if (mode === 'open' && y >= 2 && y <= 5 && ((x >= 3 && x <= 6) || (x >= 9 && x <= 12))) return null;
        if (mode === 'birch' && y >= 2 && y <= 8 && x >= 3 && x <= 12) return ((x === 7 || x === 8 || y === 5) ? '#dad6c6' : '#f1efe4');
        if (y >= 9 && y <= 13 && (x === 3 || x === 12 || y === 9 || y === 13 || x === 7 || x === 8)) return shade(frame, -14);
        return shade(panel, (r - 0.5) * 10);
      });
    };
    drawDoorTile(240, '#8d6c3b', '#ad884e', '#4b5058', 'open');    // Oak Door (images (24)/(27).jpg)
    drawDoorTile(241, '#4b341b', '#6d4e2d', '#b8bec6', 'spruce');  // Spruce Door w/ silver ring (images (26).jpg)
    drawDoorTile(242, '#c5b580', '#ddd0a0', '#40454c', 'birch');   // Birch Door w/ white shoji grid (images (28)/(29).jpg)
    drawDoorTile(243, '#a68c32', '#dbc35c', '#5c4b14', 'open');    // Bamboo Door (images (30).jpg)
    drawDoorTile(244, '#aeb4ba', '#d5d9dd', '#3c4047', 'open');    // Iron Door (images (25)/(29).jpg)
    // Tiles 245-248: 4 Authentic Minecraft Trapdoors (Oak, Spruce, Sakura, Iron — images (30).jpg!)
    const drawTrapTile = (idx, frame, panel, holes) => {
      tilePixels(idx, (x, y, r) => {
        if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return shade(frame, (r - 0.5) * 10);
        if (holes && ((x >= 3 && x <= 6) || (x >= 9 && x <= 12)) && ((y >= 3 && y <= 6) || (y >= 9 && y <= 12))) return null;
        if (x === 7 || x === 8 || y === 7 || y === 8) return shade(frame, -10);
        return shade(panel, (r - 0.5) * 12);
      });
    };
    drawTrapTile(245, '#8d6c3b', '#ad884e', true);
    drawTrapTile(246, '#4b341b', '#6d4e2d', false);
    drawTrapTile(247, '#c27196', '#f4a9c8', true);
    drawTrapTile(248, '#aeb4ba', '#d5d9dd', true);
    // Tile 249: White Tent Wool (Abandoned Campsite!)
    tilePixels(249, (x, y, r) => shade(((x + y) & 3) === 0 ? '#e2e8f0' : '#f8fafc', (r - 0.5) * 10));

    // ===== v24 Tiles 250-255: Kéo Cắt Lá + Phôi Quặng Tinh Luyện =====
    // Tile 250: Canonical Minecraft 16x16 Shears (grey steel blades upper-right, reddish-brown handles, pivot ring bottom-left)
    const _shearsPal = {
      W: '#f1f5f9', L: '#d1d5db', M: '#9ca3af', D: '#6b7280', K: '#374151',
      R: '#9b4d34', B: '#7f3c27', S: '#5c291a', P: '#ffffff'
    };
    const _shearsRows = [
      '................',
      '................',
      '........BMLLM...',
      '.......SDLWLLM..',
      '......SDLLMWLL..',
      '.....RBDLMWMLL..',
      '....RBR.MWMLMM..',
      '...RBRS.MLWMBS..',
      '...RBB...DMBS...',
      '...BRB..BBS.....',
      '...MM...RBS.....',
      '..MPPD..RRBS....',
      '..DPPD..BS......',
      '...KKS..........',
      '................',
      '................'
    ];
    tilePixels(250, (x, y) => {
      const ch = _shearsRows[y]?.[x];
      return ch && _shearsPal[ch] ? _shearsPal[ch] : null;
    });
    // Gem vẽ chung: rhombus nhiều facet
    const drawGemTile = (idx, core, mid, edge) => tilePixels(idx, (x, y, r) => {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 8.5);
      if (dx / 5.6 + dy / 6.0 > 1) return null;
      if (dx / 5.6 + dy / 6.0 > 0.82) return shade(edge, (r - 0.5) * 12);
      if (dx + dy * 0.8 < 2.0) return '#ffffff';
      if (dx + dy * 0.8 < 3.4) return core;
      return shade(mid, (r - 0.5) * 14);
    });
    drawGemTile(251, '#a5f3fc', '#22d3ee', '#0e7490');   // Kim cương
    drawGemTile(253, '#a7f3d0', '#10b981', '#065f46');   // Ngọc lục bảo
    drawGemTile(254, '#fecdd3', '#f43f5e', '#9f1239');   // Hồng ngọc
    // Tile 252: Cục than đá (vón cục, nhiều cạnh)
    tilePixels(252, (x, y, r) => {
      const d = Math.hypot((x - 7.5) * 1.05, (y - 8.5) * 1.12);
      if (d > 5.6) return null;
      if (d > 4.6) return '#0f172a';
      return shade(r > 0.62 ? '#475569' : '#1e293b', (r - 0.5) * 10);
    });
    // Tile 255: Phôi Titan (thỏi kim loại tím xám)
    drawSpriteMap(255, INGOT_SPRITE, { d: '#2e1065', M: '#a78bfa', H: '#ede9fe' });

    // ===== v40 Tiles 256-275: Full Minecraft Foodstuffs Pixel-Art Sprites (Meats, Fruits, Veggies, Cakes) =====
    const PORK_SPRITE = [
      '................',
      '........dddd....',
      '......ddHHHHd...',
      '.....dHHMMMMHd..',
      '....dHMMMMMMMd..',
      '...dHMMMHHMMMd..',
      '..dHMMMMMMMMd...',
      '..dMMMMHMMMMd...',
      '.dHMMMMMMMMd....',
      '.dMMMMMMMMd.....',
      '.dMMHMMMMd......',
      '.dMMMMMMd.......',
      '..dMMMMd........',
      '...dddd.........',
      '................',
      '................'
    ];
    drawSpriteMap(256, PORK_SPRITE, { d: '#881337', M: '#f48fb1', H: '#fce7f3' }); // Raw Pork
    drawSpriteMap(257, PORK_SPRITE, { d: '#451a03', M: '#b45309', H: '#f59e0b' }); // Cooked Pork

    const CHICKEN_SPRITE = [
      '................',
      '........ddddd...',
      '......ddMMMMMd..',
      '.....dMMHHHHMMd.',
      '....dMMHHMMMMMd.',
      '...dMMMMMMMMMMd.',
      '...dMMMMMMMMMdd.',
      '...dMMMMMMMMdWd.',
      '....dMMMMMMdWWd.',
      '....dMMdddWWdd..',
      '...dWWd...dd....',
      '..dWWd..........',
      '.dWWd...........',
      '..dd............',
      '................',
      '................'
    ];
    drawSpriteMap(258, CHICKEN_SPRITE, { d: '#9d174d', M: '#fbcfe8', H: '#fff1f2', W: '#f8fafc' }); // Raw Chicken
    drawSpriteMap(259, CHICKEN_SPRITE, { d: '#78350f', M: '#d97706', H: '#fde68a', W: '#fef3c7' }); // Cooked Chicken

    const MUTTON_SPRITE = [
      '................',
      '...........ddd..',
      '..........dWWd..',
      '.........dWWd...',
      '.......ddMMd....',
      '.....ddMMMMd....',
      '....dMMHHMMd....',
      '...dMMMMMMMd....',
      '..dMMMHHMMd.....',
      '.dMMMMMMMMd.....',
      '.dMMMMMMMd......',
      '.dMMHHMMd.......',
      '..dMMMMd........',
      '...dddd.........',
      '................',
      '................'
    ];
    drawSpriteMap(260, MUTTON_SPRITE, { d: '#7f1d1d', M: '#ef4444', H: '#fecaca', W: '#f8fafc' }); // Raw Mutton
    drawSpriteMap(261, MUTTON_SPRITE, { d: '#451a03', M: '#92400e', H: '#d97706', W: '#fef3c7' }); // Cooked Mutton

    const RABBIT_SPRITE = [
      '................',
      '................',
      '....dddd..dddd..',
      '...dMMMMddMMMMd.',
      '..dMMHHMMMMHHMd.',
      '..dMMMMMMMMMMMd.',
      '...dMMMMMMMMMd..',
      '....dMMMMMMMd...',
      '...dMMMddMMMd...',
      '..dMMMd..dMMMd..',
      '..dWWd....dWWd..',
      '...dd......dd...',
      '................',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(262, RABBIT_SPRITE, { d: '#9f1239', M: '#fda4af', H: '#ffe4e6', W: '#f8fafc' }); // Raw Rabbit
    drawSpriteMap(263, RABBIT_SPRITE, { d: '#78350f', M: '#c2410c', H: '#fdba74', W: '#fef3c7' }); // Cooked Rabbit

    const SALMON_SPRITE = [
      '................',
      '...........ddd..',
      '..........dHHHd.',
      '........ddMMHHd.',
      '......ddMMMMMd..',
      '....ddMMHHMMd...',
      '...dMMMMMMMMd...',
      '..dGMMMMMMMd....',
      '.dGGdMMMMMd.....',
      '.dGGdMMMMd......',
      '..dd.dMMd.......',
      '....dMMd........',
      '...dMMd.........',
      '....dd..........',
      '................',
      '................'
    ];
    drawSpriteMap(264, SALMON_SPRITE, { d: '#881337', M: '#e11d48', H: '#fda4af', G: '#0f766e' }); // Raw Salmon
    drawSpriteMap(265, SALMON_SPRITE, { d: '#7c2d12', M: '#ea580c', H: '#fed7aa', G: '#115e59' }); // Cooked Salmon

    const CARROT_SPRITE = [
      '................',
      '..........gg....',
      '.........gGGg...',
      '........gGGgg...',
      '.......ddgG.....',
      '......dHHMd.....',
      '.....dHMMMMd....',
      '....dMMMMMd.....',
      '...dHMMMMd......',
      '..dMMMMMd.......',
      '..dMMMMd........',
      '.dMMMd..........',
      '.dMMd...........',
      '..dd............',
      '................',
      '................'
    ];
    drawSpriteMap(266, CARROT_SPRITE, { d: '#9a3412', M: '#f97316', H: '#fdba74', g: '#15803d', G: '#22c55e' }); // Carrot
    drawSpriteMap(267, CARROT_SPRITE, { d: '#854d0e', M: '#facc15', H: '#fef08a', g: '#ca8a04', G: '#fef9c3' }); // Golden Carrot

    const POTATO_SPRITE = [
      '................',
      '................',
      '.......ddddd....',
      '.....ddHHHHMd...',
      '....dHHMMMMMMd..',
      '...dHMMMMMMMMd..',
      '..dMMMMMMdMMMd..',
      '..dMMMMMMMMMd...',
      '..dMMdMMMMMd....',
      '..dMMMMMMMd.....',
      '...dMMMMMd......',
      '....ddddd.......',
      '................',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(268, POTATO_SPRITE, { d: '#78350f', M: '#d4a373', H: '#fef3c7' }); // Potato
    drawSpriteMap(269, POTATO_SPRITE, { d: '#713f12', M: '#eab308', H: '#fef9c3' }); // Baked Potato

    const BEET_SPRITE = [
      '................',
      '.........gg.....',
      '........gGGg....',
      '.......ggGGg....',
      '......ddgg......',
      '.....dMMMd......',
      '....dMMHHMd.....',
      '...dMMMMMMMd....',
      '...dMMMMMMMd....',
      '....dMMMMMd.....',
      '.....dMMMd......',
      '......dMd.......',
      '.......d........',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(270, BEET_SPRITE, { d: '#4c0519', M: '#be123c', H: '#fb7185', g: '#15803d', G: '#22c55e' }); // Beetroot

    const BERRY_SPRITE = [
      '................',
      '........gg......',
      '.......gGGg.....',
      '.....ggGgg.dd...',
      '....dRRd..dRHd..',
      '...dRRHRd.dRRd..',
      '...dRRRRd..dd...',
      '....dddd..gg....',
      '......gg.dRRd...',
      '.....dRHdRRHRd..',
      '.....dRRdRRRRd..',
      '......dd..ddd...',
      '................',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(271, BERRY_SPRITE, { d: '#7f1d1d', R: '#dc2626', H: '#fca5a5', g: '#14532d', G: '#22c55e' }); // Sweet Berries

    const COOKIE_SPRITE = [
      '................',
      '................',
      '.....dddddd.....',
      '...ddMMMMMMdd...',
      '..dMMcMMMMMMMd..',
      '..dMMMMMMcMMMd..',
      '.dMMMMcMMMMMMMd.',
      '.dMMMMMMMMMcMMd.',
      '.dMMcMMMMMMMMMd.',
      '..dMMMMMcMMMMd..',
      '..dMMMMMMMMMMd..',
      '...ddMMMMMMdd...',
      '.....dddddd.....',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(272, COOKIE_SPRITE, { d: '#78350f', M: '#d97706', c: '#451a03' }); // Cookie

    const PIE_SPRITE = [
      '................',
      '................',
      '.......dd.......',
      '......dHHd......',
      '.....dHMMMd.....',
      '....dHMMMMMd....',
      '...dMMMMMMMMd...',
      '..dMMMMMMMMMMd..',
      '.dCCCCCCCCCCCCd.',
      '.dCccccccccccCd.',
      '..dCCCCCCCCCCd..',
      '...dddddddddd...',
      '................',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(273, PIE_SPRITE, { d: '#78350f', M: '#ea580c', H: '#fdba74', C: '#d4a373', c: '#b45309' }); // Pumpkin Pie

    const CAKE_SPRITE = [
      '................',
      '................',
      '....dddddddd....',
      '..ddWWRWWWRWdd..',
      '.dWWWWWWWWWWWWd.',
      '.dWWWRWWWWWRWWd.',
      '.dWddWWdddWWdWd.',
      '.dCWWCCWWWCCWCd.',
      '.dCCCCCCCCCCCCd.',
      '.dCccccccccccCd.',
      '.dCCCCCCCCCCCCd.',
      '..dddddddddddd..',
      '................',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(274, CAKE_SPRITE, { d: '#78350f', W: '#f8fafc', R: '#ef4444', C: '#d97706', c: '#b45309' }); // Cake

    const HONEY_SPRITE = [
      '................',
      '......dddd......',
      '......dCCd......',
      '......dCCd......',
      '.....dGGGGd.....',
      '....dGHHHHGd....',
      '...dGMMMMMMGd...',
      '...dGMHHHHMGd...',
      '...dGMMMMMMGd...',
      '...dGMMMMMMGd...',
      '...dGMMMMMMGd...',
      '....dGGGGGGd....',
      '.....dddddd.....',
      '................',
      '................',
      '................'
    ];
    drawSpriteMap(275, HONEY_SPRITE, { d: '#78350f', C: '#b45309', G: '#bae6fd', M: '#f59e0b', H: '#fef08a' }); // Honey Bottle

    // === v42 Tiles 276..287: Gravel, Nether Portal, End Portal Frame/Eye/Void & Portal Items ===
    // 276: Gravel (speckled multi-tone gray pebbles like Minecraft!)
    tilePixels(276, (x, y) => {
      const h = ((x * 374761393 + y * 668265263) ^ ((x + 3) * 1274126177)) >>> 0;
      const p = (h % 100);
      if (p < 14) return '#5c5856';
      if (p < 32) return '#75706e';
      if (p < 56) return '#8d8886';
      if (p < 78) return '#a29d9a';
      if (p < 92) return '#b6b0ac';
      return '#676368';
    });
    // 277: Nether Portal (swirling luminous violet-magenta vortex!)
    tilePixels(277, (x, y) => {
      const dx = x - 7.5, dy = y - 7.5;
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const swirl = Math.sin(r * 1.15 - ang * 2.0) + Math.cos((x + y) * 0.65) * 0.4;
      if (swirl > 0.72) return '#e9d5ff';
      if (swirl > 0.25) return '#c084fc';
      if (swirl > -0.25) return '#9333ea';
      if (swirl > -0.7) return '#6b21a8';
      return '#4c1d95';
    });
    // 278: End Portal Frame TOP (empty socket: teal rim + end-stone cream trim + deep dark socket)
    tilePixels(278, (x, y) => {
      const edge = (x === 0 || y === 0 || x === 15 || y === 15);
      const rim = (x === 1 || y === 1 || x === 14 || y === 14);
      const inner = (x >= 4 && x <= 11 && y >= 4 && y <= 11);
      const innerRim = (x >= 3 && x <= 12 && y >= 3 && y <= 12);
      if (inner) return ((x + y) & 1) ? '#0b1f22' : '#102c2f';
      if (innerRim) return ((x ^ y) & 1) ? '#d6d49e' : '#b8b67c';
      if (edge) return ((x + y) & 1) ? '#275754' : '#35736e';
      if (rim) return ((x + y) & 1) ? '#428981' : '#2e6560';
      return ((x * 3 + y * 5) % 4 === 0) ? '#3c7e77' : '#2d635d';
    });
    // 279: End Portal Frame SIDE (teal scalloped top + end-stone cream bottom)
    tilePixels(279, (x, y) => {
      if (y <= 3 || (y === 4 && (x % 3 !== 1))) return ((x + y) & 1) ? '#35736e' : '#265552';
      if (y === 4 || (y === 5 && (x % 3 === 1))) return '#1b3f3d';
      if (y >= 14) return '#b5b27a';
      const h = ((x * 92821 + y * 68917) >>> 0) % 7;
      if (h === 0) return '#b8b57d';
      if (h === 1) return '#e4e2af';
      return '#d5d29c';
    });
    // 280: End Portal Frame TOP WITH EYE OF ENDER inserted!
    tilePixels(280, (x, y) => {
      const dx = x - 7.5, dy = y - 7.5;
      const inEye = (x >= 4 && x <= 11 && y >= 4 && y <= 11);
      if (inEye) {
        if (Math.abs(dx) < 1.1 && Math.abs(dy) < 2.6) return '#041216'; // vertical pupil slit
        if (Math.abs(dx) < 2.2 && Math.abs(dy) < 2.2) return '#34d399'; // glowing iris
        if (Math.hypot(dx, dy) < 3.6) return '#10b981';
        return '#065f46';
      }
      const edge = (x === 0 || y === 0 || x === 15 || y === 15);
      const innerRim = (x >= 3 && x <= 12 && y >= 3 && y <= 12);
      if (innerRim) return ((x ^ y) & 1) ? '#e5e3ab' : '#c6c488';
      if (edge) return '#275754';
      return ((x + y) & 1) ? '#3c7e77' : '#2d635d';
    });
    // 281: End Portal (deep cosmic starry void!)
    tilePixels(281, (x, y) => {
      const h = ((x * 1664525 + y * 1013904223) ^ (x * 2654435761)) >>> 0;
      const m = h % 53;
      if (m === 0) return '#67e8f9';
      if (m === 1) return '#a5b4fc';
      if (m === 2) return '#34d399';
      if (m < 7) return '#1e293b';
      if (m < 14) return '#0f172a';
      return '#050811';
    });
    // 282: Flint (Đá Lửa) 16x16 sprite
    drawSpriteMap(282, [
      '................',
      '................',
      '........dd......',
      '.......dLLd.....',
      '......dLLMMd....',
      '.....dLLMMdd....',
      '....dLLMMdddd...',
      '....dLMMddddD...',
      '...dLMMddddDD...',
      '...dMMddddDDD...',
      '...dMddddDDDD...',
      '....ddddDDDD....',
      '.....ddDDDD.....',
      '......DDDD......',
      '................',
      '................'
    ], { d: '#374151', L: '#9ca3af', M: '#4b5563', D: '#111827' });
    // 283: Flint and Steel (Bật Lửa Thạch Anh) 16x16 authentic sprite
    drawSpriteMap(283, [
      '................',
      '.....ssss.......',
      '...ssSWWWs......',
      '..sSWs..ss......',
      '..sSs...........',
      '..sSs...........',
      '..sSSs....ff....',
      '...sSSs..fLLf...',
      '....sss.fLMff...',
      '.......fLMMfF...',
      '.......fMMfFF...',
      '.......fMfFFF...',
      '........fFFFF...',
      '.........FFF....',
      '................',
      '................'
    ], { s: '#374151', S: '#9ca3af', W: '#f8fafc', f: '#1f2937', L: '#d1d5db', M: '#4b5563', F: '#0f172a' });
    // 284: Ender Pearl (Ngọc Ender) 16x16 authentic sprite
    drawSpriteMap(284, [
      '................',
      '................',
      '.....dddddd.....',
      '....dTTTTTTd....',
      '...dTLLTTTTTd...',
      '..dTLWWTTTTCCd..',
      '..dTLWTTCCCTTD..',
      '..dTTTTCCCCDDD..',
      '..dTTTTTCCDDDD..',
      '..dTTTTTDDDDDD..',
      '...dTTTDDDDDd...',
      '....dDDDDDDd....',
      '.....dddddd.....',
      '................',
      '................',
      '................'
    ], { d: '#042f2e', T: '#0f766e', C: '#14b8a6', L: '#5eead4', W: '#ccfbf1', D: '#064e3b' });
    // 285: Blaze Rod (Que Quỷ Lửa) 16x16 authentic sprite
    drawSpriteMap(285, [
      '................',
      '............oo..',
      '...........oYYo.',
      '..........oYWWo.',
      '.........oYLLo..',
      '........oYYYo...',
      '.......oYWWo....',
      '......oYLLo.....',
      '.....oYYYo......',
      '....oYWWo.......',
      '...oYLLo........',
      '..oYYYo.........',
      '.oODDo..........',
      '.ooo............',
      '................',
      '................'
    ], { o: '#9a3412', O: '#c2410c', D: '#b45309', Y: '#f59e0b', L: '#facc15', W: '#fef08a' });
    // 286: Blaze Powder (Bột Quỷ Lửa) 16x16 authentic sprite
    drawSpriteMap(286, [
      '................',
      '.......Y........',
      '....o..L..W.....',
      '......oYo...o...',
      '...ooYWWYo......',
      '..oOYYWWYYOo....',
      '..oOYYYYYYYOo...',
      '.oOOYYYYYYOOOo..',
      '..oOOOOOOYYOOo..',
      '..oOOoOOoOOOo...',
      '...oo..o..oo.Y..',
      '..Y...o....W....',
      '.....o..........',
      '................',
      '................',
      '................'
    ], { o: '#9a3412', O: '#ea580c', Y: '#facc15', L: '#fef08a', W: '#ffffff' });
    // 287: Eye of Ender (Mắt Ender) 16x16 authentic sprite
    drawSpriteMap(287, [
      '................',
      '................',
      '.....dddddd.....',
      '....dGGGGGGd....',
      '...dGLLGGGGGd...',
      '..dGLWGGPPGGGd..',
      '..dGLGGGPPGGGd..',
      '..dGGGGPPGGGGd..',
      '..dGGGGPPGGGGd..',
      '..dGGGGDDGGGDd..',
      '...dGGGGDDDDd...',
      '....dGDDDDDd....',
      '.....dddddd.....',
      '................',
      '................',
      '................'
    ], { d: '#022c22', G: '#10b981', L: '#6ee7b7', W: '#dcfce7', D: '#047857', P: '#020617' });

    // === v60 Tiles 288..300: THE SIFT Organic Pixel Textures (bit-mixed hash, ZERO %10 checkerboard!) ===
    const _siftH = (x, y, s) => {
      let h = Math.imul((x * 374761393) ^ (y * 668265263) ^ s, 1274126177);
      return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
    };
    // 288: Dream Portal Frame (carved weathered ruin stone bricks matching Abandoned Ruins!)
    tilePixels(288, (x, y) => {
      const h = _siftH(x, y, 2881);
      const horizMortar = (y === 0 || y === 8);
      const vertMortar = (y < 8 ? (x === 0 || x === 8) : (x === 4 || x === 12));
      const groove = (x === 3 || x === 12 || y === 3 || y === 12) && x >= 3 && x <= 12 && y >= 3 && y <= 12;
      if (groove && h > 0.62) return '#38bdf8';
      if (y <= 2 && h > 0.48) return h > 0.76 ? '#4ade80' : '#3a7d6c';
      if (horizMortar || vertMortar) return '#3b424c';
      return h > 0.74 ? '#8a94a0' : (h > 0.36 ? '#6b7582' : '#535c68');
    });
    // 289: Dream Portal Curtain (luminous glowing cyan-aqua-white voxel energy matching ref!)
    tilePixels(289, (x, y) => {
      const h = _siftH(x >> 1, y >> 1, 2893);
      const edge = (x <= 1 || y <= 1 || x >= 14 || y >= 14);
      if (edge) return h > 0.45 ? '#e0ffff' : '#67e8f9';
      const sw = Math.sin(x * 0.55 + y * 0.42) * 0.5 + 0.5;
      if (h > 0.78 || sw > 0.82) return '#ecfeff';
      if (h > 0.48 || sw > 0.52) return '#67e8f9';
      return h > 0.20 ? '#22d3ee' : '#0ea5c6';
    });
    // 290: Singer's Meadow Grass TOP (rich organic mint-sage turf matching ref!)
    tilePixels(290, (x, y) => {
      const h = _siftH(x, y, 2901);
      if (h > 0.88) return '#6ed6b5';
      if (h > 0.58) return '#48b896';
      if (h > 0.24) return '#369b80';
      return '#287d68';
    });
    // 291: Singer's Meadow Grass SIDE
    tilePixels(291, (x, y) => {
      const h = _siftH(x, y, 2911);
      const lip = 3 + ((Math.imul(x * 11 + 7, 2654435761) >>> 29) & 1);
      if (y < lip) return h > 0.55 ? '#48b896' : '#329178';
      return h > 0.72 ? '#b37258' : (h > 0.34 ? '#985d48' : '#7e4b3a');
    });
    // 292: Lullaby Hills Grass TOP (rich organic rose-pink meadow turf!)
    tilePixels(292, (x, y) => {
      const h = _siftH(x, y, 2921);
      if (h > 0.86) return '#f9a8d4';
      if (h > 0.52) return '#e879a8';
      if (h > 0.22) return '#d45f92';
      return '#b84b7c';
    });
    // 293: Lullaby Hills Grass SIDE
    tilePixels(293, (x, y) => {
      const h = _siftH(x, y, 2931);
      const lip = 3 + ((Math.imul(x * 13 + 5, 2654435761) >>> 29) & 1);
      if (y < lip) return h > 0.55 ? '#e879a8' : '#cc5a8d';
      return h > 0.72 ? '#a66b58' : (h > 0.35 ? '#8e5747' : '#744538');
    });
    // 294: Humbler Huskland Soil (warm weathered terracotta-ochre)
    tilePixels(294, (x, y) => {
      const h = _siftH(x, y, 2941);
      if (h > 0.82) return '#c98062';
      if (h > 0.48) return '#ad674e';
      if (h > 0.20) return '#94533e';
      return '#7b4332';
    });
    // 295: Fungal Sporefield Turf (rich organic twilight violet moss)
    tilePixels(295, (x, y) => {
      const h = _siftH(x, y, 2951);
      if (h > 0.86) return '#c4b5fd';
      if (h > 0.52) return '#8b5cf6';
      if (h > 0.22) return '#7044cc';
      return '#582fa8';
    });
    // 296: Burrows Deep Purple Stone (Sift Stone)
    tilePixels(296, (x, y) => {
      const h = _siftH(x, y, 2961);
      if (h > 0.84) return '#62427a';
      if (h > 0.48) return '#4b3161';
      if (h > 0.20) return '#3b244e';
      return '#2c193c';
    });
    // 297: Sift Log TOP
    tilePixels(297, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.2) return '#4c5f70';
      return (Math.floor(d) % 2 === 0) ? '#b8ccd6' : '#9ab2bf';
    });
    // 298: Sift Log SIDE (pale silver-teal dreamwood bark)
    tilePixels(298, (x, y) => {
      const h = _siftH(x, y, 2981);
      if (x % 4 === 0) return '#5f7688';
      return h > 0.65 ? '#c6d8e0' : (h > 0.28 ? '#9fb5c2' : '#7e97a6');
    });
    // 299: Sift Leaves (lush weeping cyan-mint foliage — organic ~12% cutouts, ZERO checkerboard!)
    tilePixels(299, (x, y) => {
      const h = _siftH(x, y, 2991);
      if (h < 0.12) return null;
      if (h > 0.80) return '#7be8d8';
      if (h > 0.46) return '#38b5a6';
      if (h > 0.22) return '#259187';
      return '#1a6f6b';
    });
    // 300: Lullaby Leaves (soft frosted mint-pearl weeping tips — ZERO checkerboard or whiteout!)
    tilePixels(300, (x, y) => {
      const h = _siftH(x, y, 3001);
      if (h < 0.11) return null;
      if (h > 0.78) return '#d8f3f0';
      if (h > 0.45) return '#9cd8d4';
      if (h > 0.22) return '#74b8b8';
      return '#e6c0d8';
    });
    // 301: Sift Pink Dream Grass/Flower (like image 4!)
    drawSpriteMap(301, [
      '................',
      '.....p....p.....',
      '....pLp..pLp....',
      '..p.pLp..pLp.p..',
      '.pLppLp.pLpppLp.',
      '.pLppPppLPppPLp.',
      '..pPpPppPPpPPp..',
      '..pPPPpPPPpPPp..',
      '...pPPPPPPPPp...',
      '...pPPdPPdPPp...',
      '....pdPPdPPp....',
      '....pddPPddp....',
      '.....pddddp.....',
      '.....pddddp.....',
      '......dddd......',
      '................'
    ], { L: '#fbcfe8', p: '#fb7185', P: '#f43f5e', d: '#be123c' });
    // 302: Dream Fruit Berry Bush (instant 1-click harvest!)
    drawSpriteMap(302, [
      '................',
      '.....ggggg......',
      '...ggGGGGGgg....',
      '..gGGFFGGFFGg...',
      '..gGFFGGGGFFg...',
      '.gGGGGGGFFGGGg..',
      '.gGFFGGGFFGGGg..',
      '.gGFFGGGGGGGGg..',
      '..gGGGGGFFGGg...',
      '..gGGGGFFGGGg...',
      '...gGGGGGFFg....',
      '....gGGGGgg.....',
      '.....gggg.......',
      '......bb........',
      '......bb........',
      '................'
    ], { g: '#0f766e', G: '#2dd4bf', F: '#f472b6', b: '#78350f' });
    // 303: Glowing Burrows Spore Mushroom
    drawSpriteMap(303, [
      '................',
      '....cccccc......',
      '..ccCCWWCCcc....',
      '.cCCCWWWWCCCc...',
      '.cCWWCCCCWWCc...',
      '.cCCCCCCCCCCc...',
      '..cccccccccc....',
      '......ss........',
      '.....sSSs.......',
      '.....sSSs.......',
      '.....sSSs.......',
      '.....sSSs.......',
      '....sSSSSs......',
      '....ssssss......',
      '................',
      '................'
    ], { c: '#0891b2', C: '#22d3ee', W: '#e0f2fe', s: '#cbd5e1', S: '#f8fafc' });
    // 304: Ichor Ore (deep purple Sift stone inlaid with iridescent rainbow gems!)
    tilePixels(304, (x, y) => {
      const gem = ((x >= 3 && x <= 5 && y >= 3 && y <= 5) || (x >= 10 && x <= 12 && y >= 5 && y <= 7) || (x >= 5 && x <= 8 && y >= 10 && y <= 12));
      if (gem) {
        const c = (x + y) % 3;
        return c === 0 ? '#f472b6' : (c === 1 ? '#67e8f9' : '#fef08a');
      }
      return ((x + y) & 1) ? '#3b1f54' : '#4c2c69';
    });
    // 305: Aetherium Ore (deep purple Sift stone with luminous electric-cyan-violet veins!)
    tilePixels(305, (x, y) => {
      const gem = ((x >= 2 && x <= 5 && y >= 4 && y <= 6) || (x >= 9 && x <= 13 && y >= 3 && y <= 6) || (x >= 4 && x <= 8 && y >= 10 && y <= 13) || (x >= 11 && x <= 13 && y >= 10 && y <= 12));
      if (gem) return ((x ^ y) & 1) ? '#22d3ee' : '#e0f2fe';
      return ((x * 3 + y) % 4 === 0) ? '#2e1645' : '#4c2c69';
    });
    // 306: Ichor Crystal sprite
    drawSpriteMap(306, [
      '................',
      '.......c........',
      '......cWc.......',
      '.....cCWCc......',
      '....cCPWPCc.....',
      '...cCPPYPPCc....',
      '...cPPYYPPPc....',
      '...cCPPYPPCc....',
      '....cCPWPCc.....',
      '.....cCWCc......',
      '......cCc.......',
      '.......c........',
      '................',
      '................',
      '................',
      '................'
    ], { c: '#9d174d', C: '#f472b6', P: '#67e8f9', Y: '#fef08a', W: '#ffffff' });
    // 307: Aetherium Ingot sprite
    drawSpriteMap(307, [
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '....dWWWWWWd....',
      '...dWWCCCCWWd...',
      '..dWCCCCCCCCWd..',
      '..dCCBBBBBBCCd..',
      '..dCBBBBBBBBcd..',
      '...dBBBBBBBBd...',
      '....dddddddd....',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], { d: '#164e63', W: '#ecfeff', C: '#22d3ee', B: '#0284c7', c: '#6366f1' });
    // 308: Dream Fruit sprite
    drawSpriteMap(308, [
      '................',
      '.......gg.......',
      '......gGGg......',
      '.....dddddd.....',
      '....dLLPPPPd....',
      '...dLLPPPPPPd...',
      '...dLPPPPPPDd...',
      '...dPPPPPPDDd...',
      '...dPPCCPPDDd...',
      '....dPPCCDDd....',
      '.....dDDDDd.....',
      '......dddd......',
      '................',
      '................',
      '................',
      '................'
    ], { g: '#0f766e', G: '#5eead4', d: '#9d174d', L: '#fbcfe8', P: '#f472b6', C: '#67e8f9', D: '#db2777' });
    // 309: Echo Shard sprite
    drawSpriteMap(309, [
      '................',
      '.......dd.......',
      '......dCCd......',
      '.....dCWWCd.....',
      '....dCCWWCCd....',
      '....dCBBBBcd....',
      '...dCCBBBBCCd...',
      '...dCBBBBBBCd...',
      '....dBBBBBBd....',
      '.....dBBBBd.....',
      '......dBBd......',
      '.......dd.......',
      '................',
      '................',
      '................',
      '................'
    ], { d: '#083344', W: '#e0f2fe', C: '#22d3ee', B: '#0e7490', c: '#67e8f9' });

    // Canonical 16x16 Minecraft Tool Silhouettes + 7-Color Dream Water Gradient (exact match to MC_ICONS_BUNDLE!)
    const CANONICAL_TOOL_MAPS = {
      pick: [
        '................',
        '................',
        '......00000.....',
        '.....0231120ss..',
        '......000011Sw..',
        '..........s210..',
        '.........ssw120.',
        '........sSw.030.',
        '.......ssw..010.',
        '......sSw...020.',
        '.....ssw....020.',
        '....sSw......0..',
        '...ssw..........',
        '..sSw...........',
        '..ww............',
        '................'
      ],
      sword: [
        '.............000',
        '............0330',
        '...........03230',
        '..........03230.',
        '.........03220..',
        '........03220...',
        '..00...02320....',
        '..000.02220.....',
        '...0102120......',
        '...011020.......',
        '....0000........',
        '...ss0000.......',
        '..sSw.0000......',
        '00sw....00......',
        '000.............',
        '000.............'
      ],
      axe: [
        '................',
        '.........00.....',
        '........0230....',
        '.......03120....',
        '......02111ss...',
        '......022111w...',
        '.......00s1110..',
        '........ssw310..',
        '.......sSw.00...',
        '......ssw.......',
        '.....ssw........',
        '....sSw.........',
        '...ssw..........',
        '..sSw...........',
        '..ww............',
        '................'
      ],
      shovel: [
        '................',
        '................',
        '...........000..',
        '..........03210.',
        '.........022120.',
        '........0221320.',
        '.........s1220..',
        '........sSw20...',
        '.......sSw.0....',
        '......ssw.......',
        '.....sSw........',
        '....ssw.........',
        '..ssSw..........',
        '..sSw...........',
        '...ww...........',
        '................'
      ]
    };
    const drawCanonicalTool = (idx, kind, palOrDreamSeed) => {
      const grid = CANONICAL_TOOL_MAPS[kind];
      const isDream = (typeof palOrDreamSeed === 'number');
      const sx = (idx & 7) * 16, sy = (idx >> 3) * 16;
      const p = isDream ? null : palOrDreamSeed;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = grid[y][x];
        if (ch === '.') continue;
        let col;
        if (ch === 's') col = isDream ? '#4c1d95' : '#684e23';
        else if (ch === 'S') col = isDream ? '#94a3b8' : '#8b6932';
        else if (ch === 'w') col = isDream ? '#1e1b4b' : '#4a3518';
        else if (isDream) {
          const [r, g, b] = sampleDreamWaterRGB(x / 16, y / 16, palOrDreamSeed);
          if (ch === '0') col = `rgb(${Math.round(r * 0.36)},${Math.round(g * 0.36)},${Math.round(b * 0.36)})`;
          else if (ch === '1') col = `rgb(${Math.round(r * 0.80)},${Math.round(g * 0.80)},${Math.round(b * 0.80)})`;
          else if (ch === '3') col = ((x + y) & 1) ? '#ffffff' : `rgb(${Math.min(255, Math.round(r * 0.60 + 102))},${Math.min(255, Math.round(g * 0.60 + 102))},${Math.min(255, Math.round(b * 0.60 + 102))})`;
          else col = `rgb(${r},${g},${b})`;
        } else {
          col = ch === '0' ? '#0f172a' : (ch === '1' ? p.c1 : (ch === '3' ? p.c3 : p.c2));
        }
        ctx.fillStyle = col;
        ctx.fillRect(sx + x, sy + y, 1, 1);
      }
    };
    const _mkHelm  = (idx, c1, c2, c3) => drawSpriteMap(idx, ARMOR_ICON_MAPS.helmet, { '1': c1, '2': c2, '3': c3, '4': c3, '5': c3 });
    const _mkChest = (idx, c1, c2, c3) => drawSpriteMap(idx, ARMOR_ICON_MAPS.chest,  { '1': c1, '2': c2, '3': c3, '4': c3, '5': c3 });
    const _mkLegs  = (idx, c1, c2, c3) => drawSpriteMap(idx, ARMOR_ICON_MAPS.legs,   { '1': c1, '2': c2, '3': c3, '4': c3, '5': c3 });
    const _mkBoots = (idx, c1, c2, c3) => drawSpriteMap(idx, ARMOR_ICON_MAPS.boots,  { '1': c1, '2': c2, '3': c3, '4': c3, '5': c3 });

    drawCanonicalTool(310, 'pick',  1.2); // Ichor Dream Water Pick
    drawCanonicalTool(311, 'sword', 1.2); // Ichor Dream Water Sword
    drawCanonicalTool(312, 'axe',   1.2); // Ichor Dream Water Axe
    drawCanonicalTool(313, 'pick',  3.8); // Aetherium Dream Water Pick
    drawCanonicalTool(314, 'sword', 3.8); // Aetherium Dream Water Sword
    drawCanonicalTool(315, 'axe',   3.8); // Aetherium Dream Water Axe
    _mkHelm(316,  '#9d174d', '#f472b6', '#67e8f9');
    _mkChest(317, '#9d174d', '#f472b6', '#67e8f9');
    _mkLegs(318,  '#9d174d', '#f472b6', '#67e8f9');
    _mkBoots(319, '#9d174d', '#f472b6', '#67e8f9');
    _mkHelm(320,  '#155e75', '#22d3ee', '#e0f2fe');
    _mkChest(321, '#155e75', '#22d3ee', '#e0f2fe');
    _mkLegs(322,  '#155e75', '#22d3ee', '#e0f2fe');
    _mkBoots(323, '#155e75', '#22d3ee', '#e0f2fe');
    // 324..327: 4-Frame Animated Voxel Flame Strip (row 40, cols 4..7 — authentic Minecraft/Luanti pixel fire!)
    const firePal = { R: '#dc2626', E: '#ea580c', O: '#f97316', Y: '#facc15', L: '#fef08a', W: '#ffffff' };
    drawSpriteMap(324, [
      '.......R........',
      '......EO........',
      '..R...OY....R...',
      '..EO..OYO..ER...',
      '.EOY..OYO..OO...',
      '.EOY.OOYYO.OYO..',
      '.EOYYOYYYO.YYO..',
      'ROYYLLYYLLOYLLO.',
      'EOYLLLLLLLLLLYO.',
      'ROYLWWWWWWLLYYOR',
      'ROYLWWWWWWWLYYOR',
      'EOYYLWWWWWWLLYYR',
      '.RYYLWWWWWWLYYO.',
      '.EOYLLWWWWLLYYO.',
      '..ROYYLLLLYYOOR.',
      '..RROOYYYYOORR..'
    ], firePal);
    drawSpriteMap(325, [
      '..R........R....',
      '..EO.......OE...',
      '..OY...R...OY...',
      '.EOY...EO..OYO..',
      '.OYO..EOYO.YYO..',
      '.OYYO.OYYO.OYO..',
      'EOYYYOYYLYOOYYO.',
      'EOLLLLYYLLLYLLOR',
      'OYLLWWWWWWLLLYYR',
      'OYLWWWWWWWWLYYOR',
      'ROYLWWWWWWLLYYOR',
      'ROYYLWWWWWWLYYOR',
      '.EOYYLLWWLLYYOR.',
      '.ROYYLLLLLLYYO..',
      '..EOOYYYYYYOOR..',
      '..RROOYYYYOORR..'
    ], firePal);
    drawSpriteMap(326, [
      '....R......R....',
      '....EO........E.',
      '.R..OYO...R..EO.',
      '.EO.OYY..EO..OY.',
      '.OYOOYY..OYO.OY.',
      '.OYYOYYO.OYYOOYO',
      'EOYYLYYYOOYYLLYR',
      'ROYLLLLLLLYLLYYR',
      'ROYLWWWWWWWLLYYR',
      'EOYLWWWWWWLLLYOR',
      'EOYYLWWWWWWLYYOR',
      '.RYYLLWWWWLLYYO.',
      '.ROYYLWWWWLYYYO.',
      '..EOYLLLLLLYYO..',
      '..ROOYYYYYYOOR..',
      '..RROOYYYYOORR..'
    ], firePal);
    drawSpriteMap(327, [
      '.........R......',
      '....R...EO......',
      '...EO...OY...R..',
      '..EOY..EOYO..EO.',
      '..OYO..OYYO..OY.',
      '.EOYYO.OYYO.OOY.',
      '.OYYLYOYYLYOOYYO',
      'ROYYLLYYLLLYLLOR',
      'OYLLWWWWWWWLLYYR',
      'OYLWWWWWWWLLLYOR',
      'EOYLWWWWWWLLYYOR',
      'ROYYLWWWWWWLYYOR',
      '.ROYYLLWWLLYYOR.',
      '..EOYLLLLLLYYO..',
      '..ROOYYYYYYOOR..',
      '..RROOYYYYOORR..'
    ], firePal);

    // ===== v67 Tiles 328-345: New Sift Ores, Dream Materials & Moonstone / Nebula / Dream Prism Tools =====
    tilePixels(328, (x, y) => {
      const gem = ((x >= 2 && x <= 5 && y >= 3 && y <= 5) || (x >= 10 && x <= 13 && y >= 6 && y <= 8) || (x >= 4 && x <= 7 && y >= 10 && y <= 13));
      if (gem) return ((x + y) & 1) ? '#e0e7ff' : '#818cf8';
      return ((x + y) & 1) ? '#3b1f54' : '#4c2c69';
    });
    tilePixels(329, (x, y) => {
      const gem = ((x >= 3 && x <= 6 && y >= 2 && y <= 5) || (x >= 9 && x <= 12 && y >= 7 && y <= 10) || (x >= 2 && x <= 5 && y >= 10 && y <= 13));
      if (gem) return ((x ^ y) % 3 === 0) ? '#fde047' : (((x + y) & 1) ? '#e879f9' : '#9333ea');
      return ((x * 3 + y) % 4 === 0) ? '#2e1645' : '#4c2c69';
    });
    tilePixels(330, (x, y) => {
      const gem = ((x >= 2 && x <= 5 && y >= 3 && y <= 6) || (x >= 9 && x <= 13 && y >= 3 && y <= 6) || (x >= 5 && x <= 9 && y >= 9 && y <= 13));
      if (gem) {
        const rb = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#6366f1','#d946ef'];
        return rb[(x * 3 + y * 5) % rb.length];
      }
      return ((x + y) & 1) ? '#3b1f54' : '#4c2c69';
    });
    drawGemTile(331, '#e0e7ff', '#818cf8', '#4338ca'); // Moonstone Gem
    drawSpriteMap(332, INGOT_SPRITE, { d: '#4c1d95', M: '#c084fc', H: '#fde047' }); // Nebula Ingot
    tilePixels(333, (x, y) => {
      // Dream Prism Gem in 7-color Dream Water swirl
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d > 6.5) return null;
      const [r, g, b] = sampleDreamWaterRGB(x / 16, y / 16, 5.1);
      if (d > 5.4) return `rgb(${Math.round(r * 0.42)},${Math.round(g * 0.42)},${Math.round(b * 0.42)})`;
      if (x >= 5 && x <= 7 && y >= 4 && y <= 6) return '#ffffff';
      return `rgb(${r},${g},${b})`;
    });
    // Canonical 16x16 Dream Water Tools for Moonstone (334-337), Nebula (338-341), Dream Prism (342-345)
    drawCanonicalTool(334, 'pick',   0.0);
    drawCanonicalTool(335, 'sword',  0.0);
    drawCanonicalTool(336, 'axe',    0.0);
    drawCanonicalTool(337, 'shovel', 0.0);
    drawCanonicalTool(338, 'pick',   2.5);
    drawCanonicalTool(339, 'sword',  2.5);
    drawCanonicalTool(340, 'axe',    2.5);
    drawCanonicalTool(341, 'shovel', 2.5);
    drawCanonicalTool(342, 'pick',   5.1);
    drawCanonicalTool(343, 'sword',  5.1);
    drawCanonicalTool(344, 'axe',    5.1);
    drawCanonicalTool(345, 'shovel', 5.1);
    // v70 New Upgraded Ore Chest Tiles (346..353): Copper (riveted plate like ref photo), Emerald, Ruby & 7-Color Dream Water!
    drawChestTiles(346, 347, '#9a4522', '#d97745', '#fbd38d');
    tilePixels(346, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#7c3416';
      if (x === 1 || x === 14 || y === 1 || y === 14) return '#9a4522';
      if ((x === 3 || x === 12) && (y === 3 || y === 12)) return '#7c3416';
      if (x === y || x + y === 15) return shade('#b9582e', (r - 0.5) * 10);
      return shade('#e28452', (r - 0.5) * 14);
    });
    tilePixels(347, (x, y, r) => {
      if (x >= 6 && x <= 9 && y >= 5 && y <= 9) return (y === 6 || y === 9) ? '#d6d3d1' : '#94a3b8';
      if (y === 6) return '#431407';
      if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return '#9a4522';
      if ((x === 3 || x === 12) && (y === 3 || y === 12)) return '#7c3416';
      return shade('#d97745', (r - 0.5) * 14);
    });
    drawChestTiles(348, 349, '#047857', '#10b981', '#fef08a');
    drawChestTiles(350, 351, '#9f1239', '#e11d48', '#fde68a');
    tilePixels(352, (x, y) => {
      const [r, g, b] = sampleDreamWaterRGB(x / 15, y / 15, 2.2);
      if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return `rgb(${Math.round(r * 0.62)},${Math.round(g * 0.62)},${Math.round(b * 0.62)})`;
      return `rgb(${r},${g},${b})`;
    });
    tilePixels(353, (x, y) => {
      if (x >= 6 && x <= 9 && y >= 5 && y <= 9) return '#fef9c3';
      if (y === 6) return '#1e1b4b';
      const [r, g, b] = sampleDreamWaterRGB(x / 15, y / 15, 2.2);
      if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return `rgb(${Math.round(r * 0.62)},${Math.round(g * 0.62)},${Math.round(b * 0.62)})`;
      return `rgb(${r},${g},${b})`;
    });
    // v79 Tiles 354..371: Charcoal, Ancient Debris, Netherite Scrap/Ingot/Axe/Shovel, Smithing Table & 7 Templates
    tilePixels(354, (x, y, r) => {
      const d = Math.hypot((x - 7.5) * 1.04, (y - 8.2) * 1.14);
      if (d > 5.5) return null;
      if (d > 4.5) return '#17100c';
      return shade(r > 0.60 ? '#4d3a2f' : '#2a1e18', (r - 0.5) * 12);
    });
    // Ancient Debris Top/Bottom (355) & Side (356): authentic spiral rim + dark riveted basalt bands
    tilePixels(355, (x, y, r) => {
      const ring = Math.round(Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)));
      if (ring === 7 || ring === 4 || ring === 1) return shade('#281915', (r - 0.5) * 10);
      if (ring === 5 || ring === 2) return shade('#7c5e53', (r - 0.5) * 14);
      return shade('#4d3831', (r - 0.5) * 12);
    });
    tilePixels(356, (x, y, r) => {
      if (y === 0 || y === 15 || y === 7 || y === 8) return shade('#251713', (r - 0.5) * 10);
      if (y === 2 || y === 13) return shade('#7c5e53', (r - 0.5) * 14);
      if ((x === 3 || x === 12) && (y === 4 || y === 11)) return '#8a6b5f';
      return shade('#4a342d', (r - 0.5) * 14);
    });
    // Netherite Scrap (357) & Charcoal-Slate Ingot (358, matching netherrite.jpg)
    const SCRAP_SPRITE = [
      '................','................','......DDDD......','....DDHHHHDD....',
      '...DHMMMMMMHD...','..DHMMDDDDMMHD..','..DMDDDDDDDDMD..','...DDDMMMMDDD...',
      '..DDHHMMMMHHDD..','..DHMMDDDDMMHD..','..DDDDDDDDDDDD..','....DDMMMMDD....',
      '......DDDD......','................','................','................'
    ];
    const NETHERITE_INGOT_SPRITE = [
      '................','................','........dddd....','......ddHHHHd...',
      '.....dHHMMMMMd..','....dHHMMMMMMSd.','...dHHMMMMMMMSd.','..dHHMMMMMMMSd..',
      '..dHMMMMMMMSdd..','..dMMMMMMMSd....','..dMMMMMSdd.....','...dMMSdd.......',
      '....ddd.........','................','................','................'
    ];
    drawSpriteMap(357, SCRAP_SPRITE, { D: '#241815', M: '#593d35', H: '#826359' });
    drawSpriteMap(358, NETHERITE_INGOT_SPRITE, { d: '#1a171c', M: '#564f58', H: '#78707a', S: '#373239' });
    // Smithing Table (matching Image 8): Top forged iron anvil plate (359), Side with hanging Blacksmith Hammer (360), Bottom mahogany (361), Front/Back with Tongs & 2 Chisels (371)
    tilePixels(359, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#22262e';
      if (x === 1 || x === 14 || y === 1 || y === 14) return '#545b68';
      if ((x === 2 || x === 13) && (y === 2 || y === 13)) return '#1a1d24'; // 4 corner rivets
      if (x === 4 || x === 11 || y === 4 || y === 11) return '#2e333d';
      return shade(((x + y * 3) % 5 === 0) ? '#484f5c' : '#3a404a', (r - 0.5) * 10);
    });
    const smithingSideBase = (x, y, r) => {
      // Top dark bluish-grey forged iron tabletop overhang (rows 0..3)
      if (y <= 3) {
        if (y === 3 || x === 0 || x === 15) return '#20242b';
        if ((x === 2 || x === 13) && y === 1) return '#181b20';
        return shade(y === 1 ? '#4c5360' : '#3a404a', (r - 0.5) * 8);
      }
      // Dark forged iron vertical corner posts (x <= 1 || x >= 14)
      if (x <= 1 || x >= 14) return shade((x === 0 || x === 15 || y === 15) ? '#20242b' : '#363c46', (r - 0.5) * 8);
      // Rich dark reddish-brown mahogany plank body with horizontal plank grooves
      if (y === 7 || y === 11 || y === 15) return '#33110b';
      return shade(((x + y) & 1) ? '#5e2318' : '#4e1c13', (r - 0.5) * 10);
    };
    tilePixels(360, (x, y, r) => {
      // Center Hanging Blacksmith Hammer (matching Image 8 left & right side faces!)
      if (x >= 5 && x <= 10 && y >= 6 && y <= 8) {
        if (y === 6 && x >= 6 && x <= 9) return '#58606e';
        return (x === 5 || x === 10 || y === 8) ? '#252930' : '#3d434f';
      }
      if ((x === 7 || x === 8) && y >= 5 && y <= 13) {
        return x === 7 ? '#a3623a' : '#7d4625';
      }
      return smithingSideBase(x, y, r);
    });
    tilePixels(361, (x, y, r) => (x === 0 || x === 15 || y === 0 || y === 15 || y === 5 || y === 10) ? '#2e0f0a' : shade('#4c1b13', (r - 0.5) * 10));
    tilePixels(371, (x, y, r) => {
      // Left: 2 Hanging Chisels/Files with warm wooden handles + dark steel blades (matching Image 8 front/back faces!)
      if ((x === 3 || x === 4 || x === 6) && y >= 5 && y <= 11) {
        if (y <= 7) return (x === 3 || x === 6) ? '#a3623a' : '#7d4625';
        if (x === 6 && y >= 11) return smithingSideBase(x, y, r);
        return (y === 8) ? '#545b68' : '#363b45';
      }
      // Right: Hanging Forged-Iron Blacksmith Tongs / Pliers (matching Image 8 front/back faces!)
      if (x >= 9 && x <= 12 && y >= 5 && y <= 13) {
        const isJaw = (y >= 5 && y <= 7 && (x === 9 || x === 12 || (y === 5 && (x === 10 || x === 11))));
        const isPivot = (y === 8 && (x === 10 || x === 11));
        const isHandle = (y >= 9 && y <= 13 && (x === 9 || x === 12));
        if (isJaw || isPivot || isHandle) return (y === 5 || isPivot) ? '#545b68' : '#2e333d';
      }
      return smithingSideBase(x, y, r);
    });
    // Netherite Axe (362) & Shovel (363)
    const palNeth = { D: '#1b181d', W: '#6b4423', M: '#453e46', H: '#746c76', G: '#2c282e' };
    drawSpriteMap(362, AXE_SPRITE, palNeth);
    drawSpriteMap(363, SHOVEL_SPRITE, palNeth);
    // Smithing Templates (364..370, 372..383): Upgrade Tablet + All 18 Armor Trims (tilted stone tablets + bright cyan runes!)
    // 364: Netherite Upgrade (upright dark red Netherrack tablet w/ glowing cyan UP ARROW, matching netherrite.jpg & manhren.png)
    tilePixels(364, (x, y, r) => {
      if (x < 2 || x > 13 || y < 1 || y > 14) return null;
      if (x === 2 || x === 13 || y === 1 || y === 14) return '#2d0c0d';
      if (x === 3 || y === 2) return '#8f292c';
      // Cyan Up-Arrow icon centered in tablet
      const ax = Math.abs(x - 7.5);
      if ((y === 4 && ax < 1) || (y === 5 && ax < 2) || (y === 6 && ax < 3) || (y >= 7 && y <= 11 && ax < 1.2)) {
        return y <= 6 ? '#67f5ea' : '#2dd4bf';
      }
      return shade('#5a1a1d', (r - 0.5) * 12);
    });
    // Tilted carved Armor Trim Tablet renderer (matching manhren.png & congthucgiap.jpg silhouettes)
    const drawTrimTablet = (idx, dark, mid, light, runeFn) => {
      tilePixels(idx, (x, y, r) => {
        // Classic 45deg-tilted octagonal stone slab silhouette inside 16x16
        const dSum = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        if (dSum > 7.6 || x < 1 || x > 14 || y < 1 || y > 14) return null;
        if (dSum > 6.3 || x === 1 || x === 14 || y === 1 || y === 14) return dark;
        if (runeFn(x - 7.5, y - 7.5)) return '#52e6dc';
        if (x + y <= 13 && dSum > 4.9) return light;
        return shade(mid, (r - 0.5) * 12);
      });
    };
    drawTrimTablet(365, '#1b2430', '#3d4a5c', '#64748b', (dx, dy) => Math.abs(dx) <= 2 && Math.abs(dy) <= 3 && (Math.abs(dx) > 0.5 || Math.abs(dy) < 0.6)); // Ward
    drawTrimTablet(366, '#27303d', '#586475', '#8894a6', (dx, dy) => (Math.abs(dy - 1) < 0.6 || Math.abs(dy + 1.5) < 0.6) && Math.abs(dx) <= 3); // Coast
    drawTrimTablet(367, '#284512', '#527c24', '#84cc16', (dx, dy) => Math.abs(dx + dy) < 1.1 || (Math.abs(dx - 1.5) < 0.7 && Math.abs(dy - 1.5) < 0.7)); // Wild
    drawTrimTablet(368, '#784e18', '#c9a66b', '#ead19c', (dx, dy) => Math.abs(dx) + Math.abs(dy) <= 2.3 && Math.abs(dx) + Math.abs(dy) >= 0.8); // Dune
    drawTrimTablet(369, '#11423e', '#237a72', '#4cc2b7', (dx, dy) => Math.abs(dx - dy * 0.7) < 1.1 || Math.abs(dy + 1.5) < 0.6 && Math.abs(dx) <= 2.5); // Tide
    drawTrimTablet(370, '#07121c', '#123847', '#26697a', (dx, dy) => (Math.abs(dx) <= 0.7 && Math.abs(dy) <= 3.2) || (Math.abs(dy) <= 0.7 && Math.abs(dx) <= 3.2)); // Silence
    drawTrimTablet(372, '#2d3540', '#636e7d', '#929dad', (dx, dy) => Math.abs(dy) <= 2.5 && (Math.abs(dx) === 1.5 || Math.abs(dx) === 2.5)); // Sentry
    drawTrimTablet(373, '#1a2029', '#38414f', '#5a6575', (dx, dy) => Math.abs(dx) + Math.abs(dy + 1) <= 2.2 || (Math.abs(dy - 2) < 0.6 && Math.abs(dx) <= 1.5)); // Vex
    drawTrimTablet(374, '#360d0d', '#6e2121', '#993838', (dx, dy) => Math.abs(dx) <= 0.6 || (Math.abs(dx) <= 2.6 && (Math.abs(dy + 1) < 0.6 || Math.abs(dy - 1.5) < 0.6))); // Rib
    drawTrimTablet(375, '#141217', '#2d2933', '#494352', (dx, dy) => (Math.abs(dx) <= 2.5 && Math.abs(dy - 1) <= 1.2 && Math.abs(dx) >= 1) || Math.abs(dy + 1.5) < 0.6); // Snout
    drawTrimTablet(376, '#6e6a46', '#bab47e', '#ded9a0', (dx, dy) => Math.hypot(dx, dy) <= 2.4 && Math.hypot(dx, dy) >= 0.9); // Eye
    drawTrimTablet(377, '#4c1d6e', '#8847ad', '#b876de', (dx, dy) => Math.abs(dx) <= 0.7 && Math.abs(dy) <= 3.5 || (Math.abs(dx) === 1.5 && dy < 0)); // Spire
    drawTrimTablet(378, '#263038', '#4d5d6b', '#758796', (dx, dy) => Math.abs(dx - Math.sin(dy * 1.4) * 1.4) < 1.1); // Flow
    drawTrimTablet(379, '#5e2c14', '#a85732', '#d97a4e', (dx, dy) => (dx * dy <= 0 && Math.abs(dx + dy) <= 1.2) || (Math.abs(dy) <= 0.7 && Math.abs(dx) <= 2.2)); // Bolt
    drawTrimTablet(380, '#592e14', '#9c562c', '#c77a48', (dx, dy) => Math.abs(dx) + Math.abs(dy) <= 3.0 && (Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8)); // Wayfinder
    drawTrimTablet(381, '#542a16', '#945030', '#bf704b', (dx, dy) => Math.abs(dy) <= 2.5 && Math.abs(Math.abs(dx) - 1.5) < 0.7); // Raiser
    drawTrimTablet(382, '#5c2f16', '#a1572f', '#cc7a4b', (dx, dy) => Math.abs(dx) <= 2.5 && Math.abs(Math.abs(dy) - 1.5) < 0.7); // Shaper
    drawTrimTablet(383, '#4f2715', '#8c4b2b', '#b86c46', (dx, dy) => (Math.abs(dx) <= 1.5 && Math.abs(dy) <= 1.5) && !(Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6)); // Host
    // Block of Netherite (384, matching netherrite.jpg)
    tilePixels(384, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#1d191e';
      if (x === 1 || y === 1) return '#5c535d';
      if (x === 14 || y === 14) return '#272228';
      const innerEdge = (x === 4 || x === 11 || y === 4 || y === 11) && x >= 4 && x <= 11 && y >= 4 && y <= 11;
      if (innerEdge) return '#2d282e';
      return shade((x >= 5 && x <= 10 && y >= 5 && y <= 10) ? '#3c363e' : '#4a434c', (r - 0.5) * 12);
    });
    // Redstone Dust (385)
    tilePixels(385, (x, y, r) => {
      const dx = x - 7.5, dy = y - 8.0, d = Math.hypot(dx * 0.9, dy * 1.1);
      if (d > 5.4 && !(d < 6.4 && r > 0.72)) return null;
      if (d > 4.2 && r < 0.45) return null;
      if (d < 2.2 && r > 0.45) return '#ff4b3a';
      return r > 0.68 ? '#ef2314' : (r > 0.30 ? '#b81108' : '#7a0904');
    });
    // 15 Colored Wools (386..400) + 15 Colored Bed Blanket Tops (401..415) & Sides (416..430)
    for (const e of _DYN_COLORED_ENTRIES) {
      const c = e.c;
      if (e.kind === 'wool') {
        tilePixels(e.tile, (x, y, r) => shade((((x + y) & 3) === 0 ? c.dark : (((x * 3 + y) & 7) === 0 ? c.light : c.hex)), (r - 0.5) * 12));
      } else {
        tilePixels(e.bTopTile, (x, y, r) => {
          if (x === 0 || x === 15 || y === 0 || y === 15) return c.dark;
          if (y === 3 || y === 4) return shade(c.light, -18 + (r - 0.5) * 10);
          return shade(c.hex, (r - 0.5) * 14);
        });
        tilePixels(e.bSideTile, (x, y, r) => {
          if (y === 0) return c.light;
          if (y >= 14) return c.dark;
          if (y === 13 || x === 0 || x === 15) return shade(c.dark, 10);
          return shade(c.hex, (r - 0.5) * 14);
        });
      }
    }
    // v86 Tiles 431..438: Ghast Tear, Blue Orchid, Allium, Oxeye Daisy, Wild Clover, Crimson/Warped Fungus & End Crystal Icon (matching Image 1!)
    const GHAST_TEAR_SPRITE = [
      '................','.......DD.......','......DHHD......','.....DWWWWd.....',
      '....DWWWWCCd....','....DWWWWCCd....','...DWWWWWCCCd...','...DWWWWWCCCd...',
      '...DWWWWCCCCd...','....DWWWCCCd....','....dCCCCCCd....','.....dCCCCd.....',
      '......dddd......','................','................','................'
    ];
    drawSpriteMap(431, GHAST_TEAR_SPRITE, { D: '#334155', d: '#1e293b', H: '#e0f2fe', W: '#ffffff', C: '#bae6fd' });
    // Tile 432: Blue Orchid (Hoa Phong Lan Xanh)
    tilePixels(432, (x, y, r) => {
      if ((x === 7 || x === 8) && y >= 7 && y <= 15) return y >= 14 ? '#14532d' : '#228b22';
      if ((x === 6 && y >= 11 && y <= 13) || (x === 9 && y >= 10 && y <= 12)) return '#15803d';
      const d1 = Math.hypot(x - 7.5, y - 5.2), d2 = Math.hypot(x - 5.2, y - 6.8), d3 = Math.hypot(x - 9.8, y - 6.8);
      if (d1 < 1.3) return '#fef08a';
      if (d1 < 3.0 || d2 < 2.1 || d3 < 2.1) return (x + y) % 2 === 0 ? '#38bdf8' : '#0284c7';
      return null;
    });
    // Tile 433: Allium (Hoa Hành Tím Cầu Tròn)
    tilePixels(433, (x, y, r) => {
      if ((x === 7 || x === 8) && y >= 7 && y <= 15) return y >= 14 ? '#14532d' : '#16a34a';
      const d = Math.hypot(x - 7.5, y - 4.8);
      if (d < 3.3) return d < 1.6 ? '#f3e8ff' : (((x + y) & 1) ? '#c084fc' : '#9333ea');
      return null;
    });
    // Tile 434: Oxeye Daisy (Hoa Cúc Trắng Nhụy Vàng)
    tilePixels(434, (x, y, r) => {
      if ((x === 7 || x === 8) && y >= 8 && y <= 15) return y >= 14 ? '#14532d' : '#15803d';
      const d = Math.hypot(x - 7.5, y - 5.5);
      if (d < 1.7) return '#facc15';
      if (d < 3.6 && (Math.abs(x - 7.5) <= 2.8 || Math.abs(y - 5.5) <= 2.8)) return ((x ^ y) & 1) ? '#ffffff' : '#e2e8f0';
      return null;
    });
    // Tile 435: Wild Clover & Meadow Sprouts (Thảm Cỏ Ba Lá & Hoa Dại)
    tilePixels(435, (x, y, r) => {
      if (y < 6) return null;
      if ((x === 4 && y === 7) || (x === 11 && y === 8) || (x === 8 && y === 6)) return ((x + y) & 1) ? '#fef08a' : '#f472b6';
      const blade = ((x === 3 || x === 4) && y >= 8) || ((x === 7 || x === 8) && y >= 7) || ((x === 11 || x === 12) && y >= 9) || ((x === 5 || x === 10) && y >= 11);
      if (!blade) return null;
      return y >= 14 ? '#14532d' : shade((y <= 9 || ((x + y) & 1)) ? '#4ade80' : '#16a34a', (r - 0.5) * 14);
    });
    // Tile 436: Crimson Fungus (Nấm Đỏ Thẫm Địa Ngục)
    tilePixels(436, (x, y, r) => {
      if (x >= 7 && x <= 8 && y >= 8 && y <= 15) return shade('#7f1d1d', (r - 0.5) * 12);
      const cap = (y >= 3 && y <= 8 && Math.abs(x - 7.5) <= (8.8 - Math.abs(y - 6.5) * 1.15));
      if (!cap) return null;
      if ((x === 6 && y === 5) || (x === 9 && y === 6) || (x === 7 && y === 4)) return '#fef08a';
      return shade(y <= 4 ? '#ef4444' : '#b91c1c', (r - 0.5) * 14);
    });
    // Tile 437: Warped Fungus (Nấm Xanh Biến Dị Địa Ngục)
    tilePixels(437, (x, y, r) => {
      if (x >= 7 && x <= 8 && y >= 8 && y <= 15) return shade('#134e4a', (r - 0.5) * 12);
      const cap = (y >= 3 && y <= 8 && Math.abs(x - 7.5) <= (8.8 - Math.abs(y - 6.5) * 1.15));
      if (!cap) return null;
      if ((x === 6 && y === 5) || (x === 9 && y === 6) || (x === 8 && y === 4)) return '#fb923c';
      return shade(y <= 4 ? '#2dd4bf' : '#0f766e', (r - 0.5) * 14);
    });
    // Tile 438: Canonical Minecraft End Crystal 16x16 Item Icon (matching uploaded Image 1!)
    const END_CRYSTAL_ICON_SPRITE = [
      '................',
      '..FFFFFFFFFFFF..',
      '.FF..........FF.',
      '.F.....PP.....F.',
      '.F....PPPP....F.',
      '.F...PPLLLP...F.',
      '.F..PPLRRLLP..F.',
      '.F.PPLLRLLRLP.F.',
      '.F.PPLLLRRLLP.F.',
      '.F..PPLLLLLP..F.',
      '.F...PPrrPP...F.',
      '.F....PPPP....F.',
      '.F.....PP.....F.',
      '.FF..........FF.',
      '..FFFFFFFFFFFF..',
      '................'
    ];
    drawSpriteMap(438, END_CRYSTAL_ICON_SPRITE, {
      F: '#e0f2fe', P: '#c026d3', L: '#f0abfc', R: '#be185d', r: '#e11d48'
    });
    // v87 Tiles 439..443: Dedicated Front & Side Tiles for Furnace (Image 5), Chest (Image 6), Smoker & Blast Furnace (Image 7), Crafting Table (Image 9)!
    // Tile 439: Furnace Front (upper dark arched opening + middle light stone divider + lower arched flaming firebox!)
    tilePixels(439, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#383838';
      // Upper black arched smelting opening (x=4..11, y=3..6)
      if (x >= 4 && x <= 11 && y >= 3 && y <= 6) {
        if (y === 3 && (x === 4 || x === 11)) return '#3b3b3b';
        return '#0a0a0a';
      }
      // Lower arched flaming firebox (x=4..11, y=10..15)
      if (x >= 4 && x <= 11 && y >= 10 && y <= 15) {
        if (y === 10 && (x <= 5 || x >= 10)) return '#262626';
        if (y === 11 && (x === 4 || x === 11)) return '#262626';
        if (y <= 11 || ((x + y) % 3 === 0 && y === 12)) return '#ef1a0c';
        if (y === 12 || (y === 13 && (x === 4 || x === 8 || x === 11))) return '#ff7b00';
        return ((x + y) & 1) ? '#ffeb00' : '#fff76b';
      }
      // Light-grey stone arch surround around lower firebox (y=9..14)
      if (y === 9) return (x === 1 || x === 14) ? '#595959' : '#bcbcbc';
      if (y >= 10) return (x === 1 || x === 14) ? '#595959' : shade('#a3a3a3', (r - 0.5) * 8);
      return furnaceCobbleColor(x, y, r);
    });
    // Tile 440: Blast Furnace Side/Back (top iron corner rivets + dark iron upper hood + lower split smooth-stone armor plates!)
    tilePixels(440, (x, y, r) => {
      if ((x <= 3 || x >= 12) && y <= 2) {
        if ((x === 1 || x === 2 || x === 13 || x === 14) && y === 1) return '#3a3d45';
        return shade('#9ea3ab', (r - 0.5) * 8);
      }
      if (y <= 7) {
        if (x === 0 || x === 15 || y === 0) return '#2b2e34';
        if (y === 5 || y === 6) return shade('#2e3138', (r - 0.5) * 8);
        return shade('#454952', (r - 0.5) * 10);
      }
      if (y === 8) return (x === 0 || x === 15 || x === 7 || x === 8) ? '#5c6068' : '#aeb3bc';
      if (x === 0 || x === 15 || y === 15 || x === 7 || x === 8) return '#4e525a';
      if (x === 1 || x === 14 || y === 14) return '#6c7078';
      return shade('#8a8f98', (r - 0.5) * 10);
    });
    // Tile 441: Smoker Side/Back (Oak log vertical corner pillars + middle oak cross-beam framing upper & lower grey stone panels!)
    tilePixels(441, (x, y, r) => {
      if (x <= 2 || x >= 13 || y <= 1 || (y >= 8 && y <= 10) || y === 15) return smokerBark(x, y, r);
      if (x === 3 || x === 12 || y === 2 || y === 7 || y === 11 || y === 14) return shade('#5c5c5c', (r - 0.5) * 10);
      return shade(((x + y * 3) % 4 === 0) ? '#9e9e9e' : '#858585', (r - 0.5) * 10);
    });
    // Tile 442: Crafting Table Front/Back (left hanging carpenter's square/mallet + right white-silver hand saw — matching Image 9!)
    tilePixels(442, (x, y, r) => {
      // Left oak panel: Hanging iron square / mallet (x=3..5, y=5..11)
      if (x >= 3 && x <= 5 && y >= 5 && y <= 6) return (y === 5 || x === 3) ? '#e2e8f0' : '#94a3b8';
      if ((x === 3 || x === 4) && y >= 7 && y <= 11) return x === 3 ? '#4e2b15' : '#2b1608';
      // Right oak panel: Hanging white-silver Hand Saw (handle at y=5..6, wide white blade at y=7..12)
      if (x >= 10 && x <= 12 && y >= 5 && y <= 6) return (x === 11 && y === 6) ? '#784421' : '#3b200e';
      if (x >= 10 && x <= 12 && y >= 7 && y <= 12 && !(x === 12 && y >= 11)) {
        return (x === 10 || y === 7) ? '#f8fafc' : ((x === 12 || y === 12) ? '#94a3b8' : '#dbe2ea');
      }
      return drawCraftSideBase(x, y, r);
    });
    // Tile 443: Chest Side/Back (dark charcoal-brown outer frame + warm golden wood planks + dark horizontal lid seam at row 5 — matching Image 6!)
    tilePixels(443, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15 || y === 5) return '#2c241b';
      if (x === 1 || x === 14 || y === 1 || y === 14 || y === 4 || y === 6) return shade('#734f20', (r - 0.5) * 8);
      return chestWoodGrain(x, y, r);
    });
    // v100 Tiles 444..446: Lush Short Grass, Dense Bush Grass & Wild Tall Jungle Grass (matching Images 2 & 3!)
    const SHORT_GRASS_SPRITE = [
      '................','................','................','................',
      '................','................','......h.........','..h...g....h....',
      '..g..hg.h..g....','.hg..gg.g..gh...','.gg.hgg.gh.gg.h.','.gG.ggg.gg.gg.g.',
      '.GG.gGg.gg.gG.G.','.GGdGGGdGGdGGdG.','.ddGdddGddGddGd.','dddddddddddddddd'
    ];
    drawSpriteMap(444, SHORT_GRASS_SPRITE, { h: '#7ee846', g: '#4bc427', G: '#2a8516', d: '#16520c' });
    tilePixels(445, (x, y, r) => {
      if (y < 2) return null;
      const distX = Math.abs(x - 7.5);
      const env = 1.0 - (15 - y) * 0.045;
      if (distX > 7.6 * env && r < 0.72) return null;
      if (y <= 5 && ((x + y * 3) % 3 === 0)) return null;
      if (y <= 4) return shade('#7ae843', (r - 0.5) * 14);
      if (y <= 8) return shade(r > 0.55 ? '#55c92b' : '#359c1a', (r - 0.5) * 16);
      if (y <= 12) return shade(r > 0.5 ? '#2c8a17' : '#1e6b10', (r - 0.5) * 14);
      return shade('#14470b', (r - 0.5) * 10);
    });
    tilePixels(446, (x, y, r) => {
      const bladePhase = ((x * 5 + (x >> 1) * 3) % 7);
      const minY = bladePhase < 2 ? 0 : (bladePhase < 5 ? 2 : 5);
      if (y < minY) return null;
      const gap = (x % 3 === 1 && y < 7) || (x === 0 && y < 10) || (x === 15 && y < 10);
      if (gap && r < 0.75) return null;
      if (y <= 4) return shade('#82f04a', (r - 0.5) * 14);
      if (y <= 9) return shade(r > 0.5 ? '#56cc2c' : '#37a31d', (r - 0.5) * 16);
      return shade(y <= 13 ? '#257a14' : '#14470b', (r - 0.5) * 12);
    });
    // v101 Tile 447: Minecraft-style Redstone Ore (Natural Stone + Crimson/Scarlet Glowing Crystals)
    tilePixels(447, (x, y, r) => {
      const gem = ((x >= 2 && x <= 4 && y >= 2 && y <= 4) || (x >= 10 && x <= 13 && y >= 3 && y <= 5)
        || (x >= 6 && x <= 8 && y >= 7 && y <= 9) || (x >= 2 && x <= 5 && y >= 11 && y <= 13)
        || (x >= 11 && x <= 13 && y >= 10 && y <= 13));
      if (gem) return (r > 0.72) ? '#fca5a5' : (r > 0.35 ? '#ef4444' : '#991b1b');
      return shade(((x + y * 2) & 3) === 0 ? '#69717a' : '#7c848c', (r - 0.5) * 18);
    });
    // v104 Tiles 448..457: Blue-Tree Forest, Teal Grass, Wetland Cattails & Dark Slate Shingle Roof
    tilePixels(448, (x, y, r) => barkColor(x, y, r, { c: '#94a7be', a: '#788ba3', b: '#55657a', d: '#3e4b5c' }));
    tilePixels(449, (x, y, r) => logTopColor(x, y, r, '#3e4b5c', '#5c6e8a', '#dce6f4', '#b4c3d8', '#8ea0b8'));
    drawFancyLeaf(450, { H: '#67c8ff', M: '#1e88f5', S: '#0f5bd1', D: '#09348f' }, BOTANICAL_LEAF_MASK);
    drawFancyLeaf(451, { H: '#42a6ff', M: '#1565d8', S: '#0b40a3', D: '#062266' }, AUTUMN_LEAF_MASK);
    const azurePal = { d: '#2b4466', b: '#3c5e88', B: '#35547a', m: '#527bb0', M: '#496fa1', h: '#6795cc', H: '#7aa9e0' };
    tilePixels(452, (x, y, r) => shade(azurePal[OAK_PLANK_MAP[y][x]] || '#527bb0', (r - 0.5) * 6));
    const blueGrassTop = (x, y, r, extra = 0) => {
      const ch = GRASS_TOP_MAP[y][x];
      const pal = { a: '#2bb5a5', b: '#1f968b', c: '#38c7b8', d: '#177873', e: '#52ded0' };
      return shade(pal[ch] || '#2bb5a5', extra + (r - 0.5) * 5);
    };
    tilePixels(453, (x, y, r) => blueGrassTop(x, y, r));
    tilePixels(454, (x, y, r) => {
      const ch = GRASS_SIDE_MAP[y][x];
      if (ch === 'G' || ch === 'g') {
        const belowIsDirt = (y + 1 < 16 && GRASS_SIDE_MAP[y + 1][x] === 'd');
        return blueGrassTop(x, y, r, belowIsDirt ? -10 : (ch === 'G' ? 4 : -2));
      }
      const aboveIsGrass = (y > 0 && GRASS_SIDE_MAP[y - 1][x] !== 'd');
      if (aboveIsGrass) return shade('#63442c', (r - 0.5) * 6);
      return dirtColor(x, y, r);
    });
    tilePixels(455, (x, y, r) => {
      // Crisp individual cyan-teal blades so sunlight doesn't wash out a solid block to cream-white
      const blade = (x === 2 && y >= 6) || (x === 4 && y >= 5) || (x === 7 && y >= 4) || (x === 9 && y >= 6) || (x === 12 && y >= 5) || (x === 14 && y >= 8)
        || (y >= 11 && ((x >= 3 && x <= 5) || (x >= 7 && x <= 10) || (x >= 11 && x <= 13)))
        || (y >= 13 && x >= 2 && x <= 14);
      if (!blade) return null;
      if (y <= 6) return shade('#3cd9c4', (r - 0.5) * 10);
      if (y <= 9) return shade('#20ae9f', (r - 0.5) * 10);
      if (y <= 12) return shade('#147d76', (r - 0.5) * 10);
      return shade('#0b4f4d', (r - 0.5) * 8);
    });
    tilePixels(456, (x, y, r) => {
      const isReed1 = (x === 4 || x === 5), isReed2 = (x === 10 || x === 11), isSide = (x === 2 && y >= 7) || (x === 13 && y >= 8);
      if (!isReed1 && !isReed2 && !isSide) return null;
      if (isReed1 && y >= 2 && y <= 5) return shade(x === 4 ? '#7c4524' : '#522b14', (r - 0.5) * 10);
      if (isReed2 && y >= 3 && y <= 6) return shade(x === 10 ? '#7c4524' : '#522b14', (r - 0.5) * 10);
      if ((isReed1 && y < 1) || (isReed2 && y < 2)) return null;
      return shade(y < 10 ? '#4cb83b' : '#2e7d24', (r - 0.5) * 12);
    });
    tilePixels(457, (x, y, r) => {
      const row = y >> 2, stagger = (row & 1) ? 4 : 0;
      const sx = (x + stagger) & 7;
      if (y % 4 === 0) return shade('#262a33', (r - 0.5) * 6);
      if (sx === 0) return shade('#2c303a', (r - 0.5) * 8);
      if (y % 4 === 1) return shade('#5d6475', (r - 0.5) * 10);
      return shade(((x + row) & 3) === 0 ? '#4c5261' : '#3b404d', (r - 0.5) * 12);
    });
    // 458: Sculk (abyssal slate-teal with glowing cyan organic tendrils/specks)
    tilePixels(458, (x, y, r, h) => {
      const v = Math.sin(x * 0.65 + y * 0.45) + Math.cos(x * 0.4 - y * 0.75);
      if ((h & 31) === 0 || v > 1.55) return shade('#22d3ee', (r - 0.5) * 12);
      if (v > 1.10) return shade('#0e7490', (r - 0.5) * 10);
      if (v > 0.65) return shade('#0a3b47', (r - 0.5) * 8);
      return shade('#05141c', (r - 0.5) * 6);
    });
    // 459: Sculk Vein (lacy translucent cyan-teal tendril webbing)
    tilePixels(459, (x, y, r) => {
      const net = Math.abs(Math.sin(x * 0.7 + y * 0.5)) < 0.24 || Math.abs(Math.cos(x * 0.55 - y * 0.75)) < 0.22;
      if (!net && r > 0.14) return null;
      return r > 0.72 ? '#67e8f9' : (r > 0.35 ? '#06b6d4' : '#0b4f61');
    });
    // 460: Sculk Catalyst top (pale bone plate + dark-teal rim & cyan core flecks)
    tilePixels(460, (x, y, r, h) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return '#082029';
      if ((x === 7 || x === 8) && (y === 7 || y === 8)) return '#22d3ee';
      if ((h & 15) === 0) return '#0e7490';
      return shade('#dbd4b8', (r - 0.5) * 10);
    });
    // 461: Sculk Catalyst side (bone overhang + dark teal speckled lower body)
    tilePixels(461, (x, y, r, h) => {
      if (y < 4 || (y === 4 && (x & 1) === 0)) return shade('#d6cfb2', (r - 0.5) * 10);
      if ((h & 15) === 0) return '#22d3ee';
      if ((h & 7) === 0) return '#0e7490';
      return shade('#071d26', (r - 0.5) * 8);
    });
    // 462: Sculk Sensor base (dark teal slab with cyan acoustic ring)
    tilePixels(462, (x, y, r) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 2.2) return '#67e8f9';
      if (d >= 3.5 && d <= 5.0) return '#0891b2';
      return shade((x + y) % 5 === 0 ? '#113a45' : '#08222b', (r - 0.5) * 8);
    });
    // 463: Sculk Sensor glowing acoustic tendril
    tilePixels(463, (x, y, r) => {
      const stalk = (x >= 7 && x <= 8 && y >= 5) || ((x === 6 || x === 9) && y >= 2 && y <= 6) || ((x === 5 || x === 10) && y <= 3);
      if (!stalk) return null;
      return y < 4 ? shade('#67e8f9', (r - 0.5) * 10) : shade('#0891b2', (r - 0.5) * 10);
    });
    // 464: Sculk Shrieker top/core (pale bone outer prongs + bright cyan soul ring)
    tilePixels(464, (x, y, r) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 2.5) return '#cffafe';
      if (d < 4.5) return '#06b6d4';
      if ((x <= 2 || x >= 13) && (y <= 2 || y >= 13)) return shade('#e2dcc4', (r - 0.5) * 8);
      return shade('#071b24', (r - 0.5) * 6);
    });
    // 465: Sculk Shrieker bone-ribbed side
    tilePixels(465, (x, y, r) => {
      if (y < 6 && (x < 4 || x > 11)) return shade('#dfd8be', (r - 0.5) * 10);
      if (y >= 4 && y <= 8 && x >= 5 && x <= 10) return '#06b6d4';
      return shade('#071921', (r - 0.5) * 8);
    });
    // 466: Reinforced Deepslate top/bottom (iron-slate border + ribbed dark crossplate)
    tilePixels(466, (x, y, r) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return shade('#4b5563', (r - 0.5) * 8);
      if (x === 1 || y === 1 || x === 14 || y === 14) return shade('#1f2430', (r - 0.5) * 6);
      if (x === 7 || x === 8 || y === 7 || y === 8) return shade('#374151', (r - 0.5) * 8);
      return shade('#161922', (r - 0.5) * 6);
    });
    // 467: Reinforced Deepslate side (pale bone top/bottom teeth rims + dark ribbed slate)
    tilePixels(467, (x, y, r) => {
      const rim = (y <= 2 || y >= 13) && (x !== 0 && x !== 15 && ((x & 1) === 1 || y === 0 || y === 15));
      if (rim) return shade('#b8b6a4', (r - 0.5) * 8);
      if (y === 3 || y === 12) return '#374151';
      if ((x === 3 || x === 12) && y > 3 && y < 12) return '#4b5563';
      return shade('#191d26', (r - 0.5) * 8);
    });
    // 468: Deepslate Bricks
    tilePixels(468, (x, y, r) => {
      const row = y >> 2, ox = (row & 1) ? 4 : 0, bx = (x + ox) & 7;
      if ((y & 3) === 0 || bx === 0) return shade('#181a22', (r - 0.5) * 6);
      if ((y & 3) === 1) return shade('#3b404e', (r - 0.5) * 8);
      return shade('#2b2f3a', (r - 0.5) * 10);
    });
    // 469: Deepslate Tiles
    tilePixels(469, (x, y, r) => {
      const row = y >> 2, ox = (row & 1) ? 2 : 0, bx = (x + ox) & 3;
      if ((y & 3) === 0 || bx === 0) return shade('#13151c', (r - 0.5) * 6);
      if ((y & 3) === 1) return shade('#303440', (r - 0.5) * 8);
      return shade('#21242e', (r - 0.5) * 10);
    });
    // 470: Soul Lantern core (electric cyan-aqua soul flame glass)
    tilePixels(470, (x, y, r) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return '#1e293b';
      const d = Math.hypot(x - 7.5, y - 8.0);
      if (d < 2.6) return '#ecfeff';
      if (d < 4.8) return '#22d3ee';
      return shade('#0284c7', (r - 0.5) * 8);
    });
    // 471: Candle wax cylinder
    tilePixels(471, (x, y, r) => {
      if (x >= 5 && x <= 10 && y >= 5) return shade(y === 5 ? '#fef3c7' : '#e7d9b4', (r - 0.5) * 8);
      if (x >= 7 && x <= 8 && y >= 2 && y <= 4) return y === 2 ? '#fef08a' : '#f59e0b';
      return null;
    });
    // 472..475 (Row 59, cols 0..3): Soul Fire 4 animated frames!
    for (let f = 0; f < 4; f++) {
      tilePixels(472 + f, (x, y, r) => {
        const wave = Math.sin(y * 0.45 + f * 1.57 + x * 0.4) * 1.4;
        const hCol = 15 - (3 + Math.abs(Math.sin(x * 0.72 + f * 1.4)) * 9 + wave);
        if (y < hCol) return null;
        const t = (y - hCol) / Math.max(1, 15 - hCol);
        return t > 0.68 ? '#ecfeff' : (t > 0.36 ? '#22d3ee' : shade('#0284c7', (r - 0.5) * 8));
      });
    }
    // 476: Ender Chest texture
    tilePixels(476, (x, y, r) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return '#090d16';
      if (y === 5) return '#1e1b2e';
      if (x >= 6 && x <= 9 && y >= 4 && y <= 7) return '#2dd4bf';
      return shade(((x + y) & 3) === 0 ? '#113033' : '#0a2024', (r - 0.5) * 8);
    });
    // 477: Note Block
    tilePixels(477, (x, y, r) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return '#422006';
      const note = (x === 9 && y >= 4 && y <= 10) || (y === 4 && x >= 9 && x <= 12) || (x >= 6 && x <= 9 && y >= 9 && y <= 12);
      if (note) return '#facc15';
      return shade('#7c4a26', (r - 0.5) * 10);
    });
    // 478: Night Vision Potion
    tilePixels(478, (x, y, r) => {
      if (x >= 6 && x <= 9 && y === 2) return '#92400e';
      if (x >= 6 && x <= 9 && y >= 3 && y <= 5) return '#cbd5e1';
      if ((y >= 6 && y <= 13 && x >= 4 && x <= 11) && !((y === 6 || y === 13) && (x === 4 || x === 11))) {
        return y >= 8 ? shade('#2563eb', (r - 0.5) * 12) : '#dbeafe';
      }
      if (x === 6 && y === 9) return '#93c5fd';
      return null;
    });
    // 479: Totem of Undying
    tilePixels(479, (x, y) => {
      const head = x >= 5 && x <= 10 && y >= 2 && y <= 6;
      const wing = y >= 7 && y <= 9 && x >= 2 && x <= 13;
      const body = x >= 5 && x <= 10 && y >= 7 && y <= 13;
      if (!head && !wing && !body) return null;
      if (y === 4 && (x === 6 || x === 9)) return '#10b981';
      if (y === 8 && (x === 7 || x === 8)) return '#22c55e';
      return (x + y) % 4 === 0 ? '#fef08a' : ((x === 5 || x === 10 || y === 13) ? '#ca8a04' : '#facc15');
    });
    // 480: Swift Sneak Enchanted Book
    tilePixels(480, (x, y, r) => {
      if (x < 3 || x > 12 || y < 2 || y > 13) return null;
      if (x <= 4) return '#1e1b4b';
      if (y >= 11) return '#e2e8f0';
      if (y === 6 && x >= 7 && x <= 9) return '#22d3ee';
      return shade(((x + y) & 1) ? '#6d28d9' : '#4c1d95', (r - 0.5) * 10);
    });
    // 481: Disc Fragment 5
    tilePixels(481, (x, y) => {
      if (x >= 5 && x <= 11 && y >= 4 && y <= 11 && x + y >= 10 && x + y <= 20) {
        return (x >= 7 && x <= 9 && y >= 7 && y <= 9) ? '#22d3ee' : '#0f3945';
      }
      return null;
    });
    // 482: Music Disc 5 (cyan center ring)
    tilePixels(482, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.4 || d < 1.2) return null;
      if (d < 2.8) return '#22d3ee';
      if (d < 3.5) return '#0891b2';
      return ((x + y) & 1) ? '#111827' : '#071b24';
    });
    // 483: Music Disc Otherside (teal-green center ring)
    tilePixels(483, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.4 || d < 1.2) return null;
      if (d < 2.8) return '#4ade80';
      if (d < 3.5) return '#0d9488';
      return ((x + y) & 1) ? '#1f2937' : '#0f172a';
    });
    // 484: Snowball
    tilePixels(484, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 5.8) return null;
      if (d > 4.6 || y - x > 3) return '#93c5fd';
      if (x < 6 && y < 6) return '#ffffff';
      return '#e0f2fe';
    });
    // 485: Volcanic Stone (charred basalt matrix + glowing magma seams for Dragon Nests)
    tilePixels(485, (x, y, r, h) => {
      const ch = STONE_MAP[y][x];
      const crack = ((x * 3 + y * 5 + ((x ^ y) & 3)) % 13 === 0);
      if (crack) return (h & 7) === 0 ? '#ea580c' : '#572017';
      const pal = { a: '#272024', b: '#1e181b', c: '#342b30', d: '#161113' };
      return shade(pal[ch] || '#272024', (r - 0.5) * 6);
    });
    // 486: Dragon Crystal Ore (embedded gold/amber & cyan crystal shards on Volcanic Stone, Iron Pickaxe+)
    tilePixels(486, (x, y, r, h) => {
      const nodes = [[4, 4, 2.3], [11, 5, 2.1], [7, 11, 2.5]];
      for (const [nx, ny, nr] of nodes) {
        const dist = Math.hypot(x - nx, y - ny);
        if (dist <= nr) {
          if (dist < 1.0) return ((nx + y) & 1) ? '#fef9c3' : '#67e8f9';
          return dist < 1.7 ? '#fbbf24' : '#b45309';
        }
      }
      const ch = STONE_MAP[y][x];
      const pal = { a: '#292125', b: '#1e181b', c: '#362d32', d: '#151012' };
      return shade(pal[ch] || '#292125', (r - 0.5) * 6);
    });
    // 487: Dragon Crystal Item (Minecraft Amethyst-Heart Star Crystal)
    drawSpriteMap(487, [
      '................',
      '.......oo.......',
      '......oYYo......',
      '.....oYCCYo.....',
      '....oYCCCCYo....',
      '...oYYCWWCYYo...',
      '..oYYCCWWCCYYo..',
      '..oYAACCCCAAYo..',
      '...oYAAAAAAYo...',
      '...oaAAAAAAao...',
      '....oaDDDDao....',
      '.....oDDDDoo....',
      '......oooo......',
      '................',
      '................',
      '................'
    ], { o: '#1c1917', Y: '#fef08a', C: '#67e8f9', W: '#ecfeff', A: '#f59e0b', a: '#b45309', D: '#44403c' });
    // 488: Dragon Scale (Canonical Minecraft Shield-Plate Scale)
    drawSpriteMap(488, [
      '................',
      '.....dddddd.....',
      '...ddRRRRRRdd...',
      '..dRRHHHHHRRRd..',
      '..dRHGGGGGGHRd..',
      '.dRRGRRRRRRGHRd.',
      '.dRRGRDDDDDRGRd.',
      '.dRDRRDGGGDRRRd.',
      '..dRRRRDDDRRRd..',
      '..dRRRGGGGGRRd..',
      '...dRRRRRRRRd...',
      '....dRRRRRRd....',
      '.....ddRRdd.....',
      '.......dd.......',
      '................',
      '................'
    ], { d: '#450a0a', R: '#dc2626', H: '#fca5a5', G: '#facc15', D: '#7f1d1d' });
    // 489: Dragon Bone (Crisp Minecraft Bone Diagonal)
    drawSpriteMap(489, [
      '................',
      '...........ooo..',
      '..........oHHHo.',
      '.........oHMMHo.',
      '.........oMMHo..',
      '........oMMMo...',
      '.......oHMMo....',
      '......oMMMo.....',
      '.....oHMMo......',
      '....oMMMo.......',
      '..oooMMo........',
      '.oHHHMo.........',
      '.oMMMo..........',
      '..ooo...........',
      '................',
      '................'
    ], { o: '#44403c', H: '#fafaf9', M: '#d6d3d1' });
    // 490: Dragon Riding Saddle (Canonical Minecraft Curved Saddle w/ Aether Gem & Stirrups)
    drawSpriteMap(490, [
      '................',
      '................',
      '....dddddddd....',
      '...dRRRRRRRRd...',
      '..dRRHHHHHHHRd..',
      '..dRDDDDDDDDDRd.',
      '..dRRGCCCCCGGRd.',
      '..dRRGCAAACGRRd.',
      '...ddRRRRRRRdd..',
      '...dRGG...GGRd..',
      '...dRdd...ddRd..',
      '...dGd.....dGd..',
      '...ddd.....ddd..',
      '................',
      '................',
      '................'
    ], { d: '#450a0a', R: '#b91c1c', H: '#f87171', D: '#7f1d1d', G: '#fbbf24', C: '#22d3ee', A: '#cffafe' });
    // 491..495: Authentic Stepped Minecraft Dragon Eggs (Fire, Ice, Water, Leaf, Tree)
    const drawDragonEggTile = (tIdx, o, b, s, g, sp) => drawSpriteMap(tIdx, [
      '................',
      '......oooo......',
      '.....oSSSSo.....',
      '....oSggggSo....',
      '...oSSbbbbSSo...',
      '..oSSbsppsbSSo..',
      '..oSbbbbbbbbSo..',
      '..oSggbbbggbSo..',
      '..oSbbbbsppbSo..',
      '..oSSbbbbbbSSo..',
      '...oSSggggSSo...',
      '...oBBBBBBBBo...',
      '....oooooooo....',
      '................',
      '................',
      '................'
    ], { o, B: b, S: s, b, g, p: sp });
    drawDragonEggTile(491, '#290505', '#450a0a', '#b91c1c', '#f97316', '#fef08a');
    drawDragonEggTile(492, '#082f49', '#0c4a6e', '#0284c7', '#7dd3fc', '#f0f9ff');
    drawDragonEggTile(493, '#062c3b', '#0f3b5c', '#0ea5e9', '#2dd4bf', '#cffafe');
    drawDragonEggTile(494, '#052e16', '#14532d', '#16a34a', '#86efac', '#facc15');
    drawDragonEggTile(495, '#27150a', '#3f2314', '#5c7c2f', '#a3e635', '#f472b6');
    // 496..499: Distinct 16x16 Minecraft Dragon Scale Helmet, Chestplate, Leggings & Boots
    const palArmorDrg = { o: '#3b0707', H: '#f87171', M: '#b91c1c', D: '#7f1d1d', G: '#fbbf24' };
    drawSpriteMap(496, [
      '................',
      '....G......G....',
      '...oGo....oGo...',
      '...oHooooooHo...',
      '..oHHHHHHHHHHo..',
      '..oHMMGGGGMMHo..',
      '..oHMDDDDDDMHo..',
      '..oHDo....oDHo..',
      '..ooo......ooo..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], palArmorDrg);
    drawSpriteMap(497, [
      '................',
      '..ooo......ooo..',
      '.oHHHoo..ooHHHo.',
      '.oHMMMoGGooMMHo.',
      '.oHMGGGGGGGMHHo.',
      '..ooMMMMMMMMoo..',
      '...oMMDDDDMMo...',
      '...oMDGGGGDMo...',
      '...oMMMMMMMMo...',
      '...oDDDDDDDDo...',
      '....oooooooo....',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], palArmorDrg);
    drawSpriteMap(498, [
      '................',
      '..oooooooooooo..',
      '..oGGGGGGGGGGoo.',
      '..oHHHHHHHHHHo..',
      '..oMMMMooMMMMo..',
      '..oMMDo..oDMMo..',
      '..oMMDo..oDMMo..',
      '..oMDDo..oDDMo..',
      '..oMDDo..oDDMo..',
      '..oDDDo..oDDDo..',
      '..oooo....oooo..',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], palArmorDrg);
    drawSpriteMap(499, [
      '................',
      '................',
      '................',
      '................',
      '..oooo....oooo..',
      '..oHHo....oHHo..',
      '..oMMo....oMMo..',
      '..oGGo....oGGo..',
      '.oHMMo....oMMHo.',
      '.oDDDo....oDDDo.',
      'oooooo....oooooo',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], palArmorDrg);
    const palDragon = { D:'#450a0a', W:'#e7e5e4', M:'#dc2626', H:'#fde047', G:'#f59e0b' };
    drawSpriteMap(500, SWORD_SPRITE, palDragon);
    drawSpriteMap(501, AXE_SPRITE,   palDragon);
    drawSpriteMap(502, PICK_SPRITE,  palDragon);
    drawSpriteMap(503, BOW_SPRITE,   { D:'#450a0a', W:'#e7e5e4', M:'#b91c1c', S:'#22d3ee' });
    // 504..509: Canonical 16x16 Minecraft Farming Hoes (Wood, Stone, Iron, Gold, Diamond, Netherite)
    const HOE_SPRITE = [
      '................','......DDDDDD....','.....DHHHHHHD...','.....DMMMMMMHD..',
      '......DDDDDMHD..','..........DMMD..','.........DWD.D..','........DWD.....',
      '.......DWD......','......DWD.......','.....DWD........','....DWD.........',
      '...DWD..........','..DWD...........','.DD.............','................'
    ];
    const palGoldTool = { D: '#78350f', W: '#85532a', M: '#eab308', H: '#fef08a', G: '#a16207' };
    drawSpriteMap(504, HOE_SPRITE, palWood);
    drawSpriteMap(505, HOE_SPRITE, palStone);
    drawSpriteMap(506, HOE_SPRITE, palIron);
    drawSpriteMap(507, HOE_SPRITE, palGoldTool);
    drawSpriteMap(508, HOE_SPRITE, palDiamond);
    drawSpriteMap(509, HOE_SPRITE, palNeth);

    // 510: End Gateway Cosmos Vortex
    tilePixels(510, (x, y, n) => {
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy);
      if ((Math.imul(x + 3, 73856093) ^ Math.imul(y + 7, 19349663)) % 17 === 0) return n > 0.5 ? '#c4b5fd' : '#67e8f9';
      if (r < 4.5 && ((x ^ y) & 1) === 0) return n > 0.45 ? '#312e81' : '#1e1b4b';
      return n > 0.72 ? '#0f172a' : '#03050b';
    });
    // 511: End Stone Bricks
    tilePixels(511, (x, y, n) => {
      const row = Math.floor(y / 8), bx = (x + (row & 1) * 4) % 8, by = y % 8;
      if (by === 0 || bx === 0) return n > 0.4 ? '#b7b281' : '#c6c18e';
      if (by === 1 || bx === 1) return '#f2efbf';
      return n > 0.65 ? '#e7e4b2' : (n > 0.25 ? '#deda9e' : '#d0cb8f');
    });
    // 512: Purpur Pillar Top
    tilePixels(512, (x, y, n) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.4) return '#6d456d';
      if (d > 4.6) return n > 0.5 ? '#b985b9' : '#a774a7';
      return ((x + y) & 1) ? '#986698' : '#b47fb4';
    });
    // 513: Purpur Pillar Fluted Side
    tilePixels(513, (x, y, n) => {
      if (y === 0 || y === 15) return '#7b4f7b';
      const f = x % 4;
      if (f === 0) return '#794e79';
      if (f === 1) return '#c592c5';
      return n > 0.55 ? '#ad79ad' : '#9b689b';
    });
    // 514: End Rod Glow Shaft
    tilePixels(514, (x, y, n) => {
      if (x >= 5 && x <= 10) return n > 0.6 ? '#fff1f2' : '#fdfaff';
      return 'rgba(0,0,0,0)';
    });
    // 515: End Rod Collar Base
    tilePixels(515, (x, y, n) => (n > 0.5 ? '#8f5f8f' : '#6f476f'));
    // 516: Dragon Head Icon
    tilePixels(516, (x, y, n) => {
      if (x >= 2 && x <= 13 && y >= 4 && y <= 13) {
        if ((y === 7 || y === 8) && (x === 4 || x === 5 || x === 10 || x === 11)) return '#e879f9';
        if (y >= 11 && x >= 5 && x <= 10) return '#2d2638';
        return n > 0.55 ? '#262130' : '#18141f';
      }
      if ((y >= 2 && y <= 4) && (x === 4 || x === 11)) return '#4b4459';
      return 'rgba(0,0,0,0)';
    });
    // 517: Elytra Sprite Icon
    tilePixels(517, (x, y, n) => {
      const dx = Math.abs(x - 7.5);
      if (y >= 2 && y <= 13) {
        const minD = (y < 5) ? 0.5 : (y - 3) * 0.35;
        const maxD = (y < 6) ? 3.5 + y * 0.7 : 7.5 - Math.max(0, y - 10) * 0.9;
        if (dx >= minD && dx <= maxD) {
          if (dx <= minD + 1.1 || dx >= maxD - 0.9) return '#48475c';
          return n > 0.5 ? '#9d9cb8' : '#7c7b96';
        }
      }
      return 'rgba(0,0,0,0)';
    });
    // 518: Windmill Rotor Hub Texture (Oak/Spruce axle with iron center bolt & sail cross)
    tilePixels(518, (x, y, n) => {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      if (dx <= 1.6 && dy <= 1.6) return n > 0.5 ? '#64748b' : '#334155';
      if (dx <= 1.2 || dy <= 1.2) return n > 0.5 ? '#8f5e38' : '#6f4524';
      if ((dx <= 4.5 && y >= 2 && y <= 6) || (dy <= 4.5 && x >= 9 && x <= 13)) return n > 0.5 ? '#f8fafc' : '#e2e8f0';
      return n > 0.55 ? '#5c3c22' : '#4a2f1a';
    });
    // 519: Red Sand (Cát Đỏ Badlands)
    tilePixels(519, (x, y, r) => {
      const ch = SAND_MAP[y][x];
      const pal = { a: '#c66126', b: '#b7531d', c: '#d36f32', d: '#a54617', e: '#de7c3c' };
      return shade(pal[ch] || '#c66126', (r - 0.5) * 8);
    });
    // 520-524: Terracotta Strata (Trắng, Cam, Vàng, Nâu, Đỏ)
    const drawTerracotta = (idx, baseHex, darkHex, hiHex) => {
      tilePixels(idx, (x, y, r) => {
        const streak = ((y * 5 + (x >> 2)) % 7 === 0) ? darkHex : (((y * 3 + x) % 11 === 0) ? hiHex : baseHex);
        return shade(streak, (r - 0.5) * 8);
      });
    };
    drawTerracotta(520, '#d2b2a1', '#bf9b89', '#dfc3b4');
    drawTerracotta(521, '#a65426', '#8d431b', '#ba6534');
    drawTerracotta(522, '#c08926', '#a3711a', '#d49d35');
    drawTerracotta(523, '#523625', '#40281a', '#654531');
    drawTerracotta(524, '#923d2e', '#792f23', '#a64d3c');
    // 525: Dead Bush (Bụi Cây Khô)
    tilePixels(525, (x, y, r) => {
      const dx = x - 7.5;
      const stem = (y >= 9 && Math.abs(dx) < 0.8);
      const b1 = (y >= 4 && y <= 12 && Math.abs(dx + (12 - y) * 0.65) < 0.75);
      const b2 = (y >= 3 && y <= 11 && Math.abs(dx - (11 - y) * 0.6) < 0.75);
      const twig = (y >= 5 && y <= 8 && (Math.abs(x - 4) < 0.8 || Math.abs(x - 11) < 0.8));
      return (stem || b1 || b2 || twig) ? shade('#8a5a2b', (r - 0.5) * 18) : null;
    });
    // 526-527: Golden & Orange Ancient Maple Leaves
    drawFancyLeaf(526, { H: '#fef08a', M: '#eab308', S: '#ca8a04', D: '#854d0e' }, AUTUMN_LEAF_MASK);
    drawFancyLeaf(527, { H: '#fdba74', M: '#ea580c', S: '#c2410c', D: '#7c2d12' }, AUTUMN_LEAF_MASK);
    // 528: Mangrove Propagule (Hanging Mangrove Sprout)
    tilePixels(528, (x, y, r) => {
      if (y >= 1 && y <= 3 && (x === 7 || x === 8)) return shade('#5c3c22', (r - 0.5) * 12);
      if (y >= 4 && y <= 12 && Math.abs(x - 7.5) <= (y < 9 ? 1.2 : 0.7)) {
        return shade(y < 8 ? '#65a30d' : '#4d7c0f', (r - 0.5) * 14);
      }
      return null;
    });

    // Crisp PBR Luminance Bump Map (NearestFilter, zero blur)
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = canvas.width; bumpCanvas.height = canvas.height;
    const bCtx = bumpCanvas.getContext('2d');
    const srcImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bImg = bCtx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < srcImg.data.length; i += 4) {
      const lum = Math.min(255, Math.round(srcImg.data[i] * 0.3 + srcImg.data[i + 1] * 0.59 + srcImg.data[i + 2] * 0.11));
      bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = lum;
      bImg.data[i + 3] = 255;
    }
    bCtx.putImageData(bImg, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.flipY = false;

    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.magFilter = THREE.NearestFilter; bumpTex.minFilter = THREE.NearestFilter;
    bumpTex.generateMipmaps = false; bumpTex.flipY = false;

    // ===== Atlas "lá đặc" cho đồ họa THẤP (lazy QuickPack: chỉ tạo khi bật Low Graphics để tiết kiệm RAM + cold boot) =====
    let _solidTexCache = null;
    const getSolidTex = () => {
      if (_solidTexCache) return _solidTexCache;
      const solidCanvas = document.createElement('canvas');
      solidCanvas.width = canvas.width; solidCanvas.height = canvas.height;
      const sctx = solidCanvas.getContext('2d');
      sctx.drawImage(canvas, 0, 0);
      const sImg = sctx.getImageData(0, 0, canvas.width, canvas.height);
      const sD = sImg.data, SW = canvas.width, SH = canvas.height;
      for (let ty = 0; ty < SH; ty += TILE_PX) {
        for (let tx = 0; tx < SW; tx += TILE_PX) {
          let r0 = 0, g0 = 0, b0 = 0, n = 0;
          for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
            const i = ((ty + y) * SW + (tx + x)) * 4;
            if (sD[i + 3] > 40) { r0 += sD[i]; g0 += sD[i + 1]; b0 += sD[i + 2]; n++; }
          }
          if (!n) continue;
          const ar = (r0 / n) * 0.62, ag = (g0 / n) * 0.66, ab = (b0 / n) * 0.62;
          for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
            const i = ((ty + y) * SW + (tx + x)) * 4;
            if (sD[i + 3] <= 40) { sD[i] = ar; sD[i + 1] = ag; sD[i + 2] = ab; sD[i + 3] = 255; }
          }
        }
      }
      sctx.putImageData(sImg, 0, 0);
      const solidTex = new THREE.CanvasTexture(solidCanvas);
      solidTex.magFilter = THREE.NearestFilter; solidTex.minFilter = THREE.NearestFilter;
      solidTex.generateMipmaps = false; solidTex.flipY = false;
      _solidTexCache = solidTex;
      return solidTex;
    };

    return { tex, bumpTex, canvas, getSolidTex };
  }

