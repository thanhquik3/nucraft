// NUCRAFT Module: src/data/blocks.js — Block definitions, registry flags, wool & slab helpers

const {
    CHUNK_W, MIN_Y, WORLD_H, MAX_Y, WATER_LEVEL, GRAVITY, JUMP_VEL,
    WALK_SPEED, SPRINT_SPEED, SNEAK_SPEED, BUILD_TAG, PLAYER_RADIUS,
    PLAYER_HEIGHT, EYE_HEIGHT, ITEM_DESPAWN_SEC, DAY_LENGTH_SEC,
    B, WOOL_COLORS, WOOL_COLOR_TOTAL_W, pickRandomWoolColor,
    _DYN_COLORED_ENTRIES, SLAB_SPECS, WOOD_FAMILIES,
    BONE_TILES, JUNGLE_LOG_TILES, DARK_OAK_LOG_TILES, V142_TILES, V143_TILES, DRAGON_ARMOR_TILES, V153_TILES, V156_TILES
  } = window.NUCRAFT_SHARED;
  const CFG = window.NUCRAFT_CONFIG || {};

  let currentLang = 'vi';
  try {
    const _savedLang = localStorage.getItem('luanti_lang');
    if (_savedLang === 'en' || _savedLang === 'vi') currentLang = _savedLang;
  } catch (_) {}
  function tr(vi, en) { return currentLang === 'en' ? en : vi; }
  function _keyToTitleEn(k) {
    return String(k || '').toLowerCase().split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
  }
  const _BLOCK_EN_OVERRIDES = {
    OAK_LOG: 'Oak Log', OAK_LEAVES: 'Oak Leaves', PLANKS: 'Oak Planks',
    DIAMOND_PICK: 'Diamond Pickaxe', IRON_PICK: 'Iron Pickaxe', STONE_PICK: 'Stone Pickaxe',
    WOOD_PICK: 'Wooden Pickaxe', GOLD_PICK: 'Golden Pickaxe', NETHERITE_PICK: 'Netherite Pickaxe', RUBY_PICK: 'Ruby Pickaxe',
    WOOD_AXE: 'Wooden Axe', STONE_AXE: 'Stone Axe', IRON_AXE: 'Iron Axe', GOLD_AXE: 'Golden Axe', DIAMOND_AXE: 'Diamond Axe', NETHERITE_AXE: 'Netherite Axe',
    WOOD_SHOVEL: 'Wooden Shovel', STONE_SHOVEL: 'Stone Shovel', IRON_SHOVEL: 'Iron Shovel', DIAMOND_SHOVEL: 'Diamond Shovel',
    WOOD_HOE: 'Wooden Hoe', STONE_HOE: 'Stone Hoe', IRON_HOE: 'Iron Hoe', GOLD_HOE: 'Golden Hoe', DIAMOND_HOE: 'Diamond Hoe',
    WOOD_SWORD: 'Wooden Sword', STONE_SWORD: 'Stone Sword', IRON_SWORD: 'Iron Sword', DIAMOND_SWORD: 'Diamond Sword', FIRE_SWORD: 'Fire Sword',
    TORCH_BLOCK: 'Torch', CRAFT_TABLE: 'Crafting Table', TNT: 'TNT', FARMLAND: 'Farmland',
    WHEAT_SEEDS: 'Wheat Seeds', WHEAT_CROP: 'Wheat Crop', TALL_GRASS: 'Tall Grass', SEA_LANTERN: 'Sea Lantern',
    ENCHANT_TABLE: 'Enchanting Table', END_PORTAL_FRAME: 'End Portal Frame', END_PORTAL_FRAME_EYE: 'End Portal Frame (Eye)',
    END_CRYSTAL_BLOCK: 'End Crystal', TOTEM_UNDYING: 'Totem of Undying', SMITHING_TABLE: 'Smithing Table',
    END_GATEWAY: 'End Gateway', END_STONE_BRICKS: 'End Stone Bricks', PURPUR_PILLAR: 'Purpur Pillar',
    END_ROD: 'End Rod', DRAGON_HEAD: 'Dragon Head', ELYTRA: 'Elytra', ENDER_DRAGON_EGG: 'Dragon Egg',
    WINDMILL_HUB: 'Windmill Hub', SNOWY_DIRT: 'Snowy Dirt', SNOWY_GRASS: 'Snowy Grass', CACTUS_FLOWER: 'Cactus Flower',
    MAGMA_BLOCK: 'Magma Block', BLACKSTONE: 'Blackstone', BLACKSTONE_BRICKS: 'Polished Blackstone Bricks',
    MOSSY_STONE_BRICK: 'Mossy Stone Bricks', WEEPING_VINES: 'Weeping Vines', TWISTING_VINES: 'Twisting Vines', IRON_GRATE: 'Iron Grate'
  };
  function getLocalizedBlockName(id) {
    const d = BLOCK_DEF[id];
    if (!d) return '';
    if (currentLang !== 'en') return d.name || '';
    if (d.nameEn) return d.nameEn;
    const k = (typeof BLOCK_ID_TO_KEY !== 'undefined') ? BLOCK_ID_TO_KEY[id] : '';
    if (k && _BLOCK_EN_OVERRIDES[k]) return _BLOCK_EN_OVERRIDES[k];
    if (k) return _keyToTitleEn(k);
    return d.name || '';
  }
  const _BIOME_EN_NAMES = {
    'Rừng Anh Đào': 'Cherry Grove', 'Rừng Ngập Mặn': 'Mangrove Swamp', 'Sa Mạc': 'Desert',
    'Thảo Nguyên': 'Flower Meadow', 'Đồng Bằng': 'Plains', 'Rừng Rậm': 'Forest',
    'Rừng Bạch Dương': 'Birch Forest', 'Rừng Tuyết': 'Snowy Taiga', 'Núi Tuyết Cao': 'Alpine Peaks',
    'Hang Tươi Tốt': 'Lush Grove', 'Rừng Trúc': 'Bamboo Jungle', 'Bờ Biển Dừa': 'Palm Beach',
    'Rừng Mùa Thu': 'Autumn Forest', 'Rừng Thu Sâu': 'Deep Autumn Forest', 'Rừng Thu Vàng': 'Golden Autumn',
    'Cao Nguyên': 'Highland Plateau', 'Đảo Nấm': 'Mushroom Island', 'Thảo Nguyên Oải Hương': 'Lavender Meadow',
    'Đồng Tro Núi Lửa': 'Volcanic Basalt', 'Rừng Xanh Lam': 'Blue Forest', 'Cánh Đồng Lúa': 'Wheat Field',
    'Thung Lũng Thông': 'Pine Valley', 'Rừng Đại Thụ': 'Giant Jungle', 'Thành Phố Cổ': 'Ancient City',
    'Biển Sâu': 'Deep Ocean', 'Vực Biển Sâu': 'Abyssal Trench', 'Rừng Đỏ Địa Ngục': 'Crimson Forest',
    'Rừng Lục Địa Ngục': 'Warped Forest', 'Đất Hoang Địa Ngục': 'Nether Wastes', 'Khu Kết Thúc': 'The End',
    'Đồng Bằng Cỏ Xanh': 'Green Plains', 'Đồng Bằng Tuyết': 'Snowy Plains',
    'Địa Ngục • Đồng Bằng Đá Bazan': 'Nether • Basalt Deltas',
    'Địa Ngục • Thung Lũng Cát Linh Hồn': 'Nether • Soul Sand Valley',
    'Khu Tàn Tích Cổ Đại 1000×1000': 'Grand Ancient Ruins (1000×1000)',
    'Thế Giới Rồng • Rừng Rậm Hư Không': 'Dragon Realm • Void Jungle',
    'Thế Giới Rồng • Cao Nguyên Tử Tinh': 'Dragon Realm • Amethyst Plateau',
    'Thế Giới Rồng • Núi Cao Rồng Cổ': 'Dragon Realm • Dragon Peaks',
    'Thế Giới Rồng • Đồng Bằng Hư Không': 'Dragon Realm • Void Plains',
    'Thế Giới Rồng • Hang Động Tinh Thể': 'Dragon Realm • Crystal Caverns'
  };
  function getLocalizedBiomeName(bio) {
    const n = (typeof bio === 'string') ? bio : (bio && bio.name) || '';
    if (currentLang !== 'en') return n;
    return _BIOME_EN_NAMES[n] || (bio && bio.key ? _keyToTitleEn(bio.key) : n);
  }
  function getLocalizedMobName(type, fallback = '') {
    if (currentLang !== 'en') return fallback || (typeof MOB_STATS !== 'undefined' && MOB_STATS[type] ? MOB_STATS[type].displayName : type);
    return _keyToTitleEn(type);
  }

  const BLOCK_LUT_CAP = 2048;
  const IS_SOLID = new Uint8Array(BLOCK_LUT_CAP);
  const IS_OPAQUE = new Uint8Array(BLOCK_LUT_CAP);
  const IS_DOOR = new Uint8Array(BLOCK_LUT_CAP);
  const IS_DOOR_OR_TRAP = new Uint8Array(BLOCK_LUT_CAP);
  const IS_EMISSIVE = new Uint8Array(BLOCK_LUT_CAP);
  const IS_STAIRS = new Uint8Array(BLOCK_LUT_CAP);
  const IS_SLAB = new Uint8Array(BLOCK_LUT_CAP);
  const IS_FENCE_WALL = new Uint8Array(BLOCK_LUT_CAP);
  const IS_RAY_NON_SOLID = new Uint8Array(BLOCK_LUT_CAP);
  const BLOCK_DEF = {
    [B.AIR]:           { name: 'Không khí',           hard: 0,    solid: false, trans: true },
    [B.GRASS]:         { name: 'Cỏ Xanh',             hard: 0.55, solid: true,  dirt: true, drop: B.DIRT,          tiles: [0, 1, 2],    mapColor: '#5da642' },
    [B.DIRT]:          { name: 'Đất',                 hard: 0.50, solid: true,  dirt: true, drop: B.DIRT,          tiles: [2, 2, 2],    mapColor: '#8b5e3c' },
    [B.STONE]:         { name: 'Đá Tự Nhiên',         hard: 1.45, solid: true,  rock: true, reqTier: 1, drop: B.STONE,         tiles: [3, 3, 3],    mapColor: '#7c848c' },
    [B.OAK_LOG]:       { name: 'Gỗ Táo',              hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.OAK_LOG, tiles: [4, 5, 4], mapColor: '#6d4c2f' },
    [B.OAK_LEAVES]:    { name: 'Lá Cây Táo',          hard: 0.25, solid: true,  foliage: true, shearsOnly: true, drop: B.OAK_LEAVES,  tiles: [6, 6, 6],    mapColor: '#3a7d34' },
    [B.SAND]:          { name: 'Cát Vàng',            hard: 0.45, solid: true,  dirt: true, drop: B.SAND,          tiles: [7, 7, 7],    mapColor: '#e2cc8a' },
    [B.PLANKS]:        { name: 'Ván Gỗ',              hard: 0.75, solid: true,  wood: true, isPlanks: true, drop: B.PLANKS, tiles: [8, 8, 8], mapColor: '#b98952' },
    [B.SNOW]:          { name: 'Tuyết Phủ',           hard: 0.40, solid: true,  dirt: true, drop: B.SNOW,          tiles: [9, 10, 2],   mapColor: '#eef6fc' },
    [B.ICE]:           { name: 'Băng Giá',            hard: 0.55, solid: true,  rock: true, drop: B.ICE,           tiles: [11, 11, 11], mapColor: '#9ad4f5' },
    [B.SPRUCE_LOG]:    { name: 'Gỗ Thông',            hard: 0.95, solid: true,  wood: true, isLog: true, drop: B.SPRUCE_LOG, tiles: [4, 12, 4], mapColor: '#4a3525' },
    [B.WATER]:         { name: 'Nước',                hard: 99,   solid: false, trans: true, liquid: true,         tiles: [11, 11, 11], mapColor: '#2584c6' },
    [B.SPRUCE_LEAVES]: { name: 'Lá Thông Kim',        hard: 0.28, solid: true,  foliage: true, shearsOnly: true, drop: B.SPRUCE_LEAVES, tiles: [13, 13, 13], mapColor: '#295748' },
    [B.SAKURA_LOG]:    { name: 'Gỗ Anh Đào',          hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.SAKURA_LOG, tiles: [90, 14, 90], mapColor: '#4a2b36' },
    [B.SAKURA_LEAVES]: { name: 'Hoa Anh Đào',         hard: 0.25, solid: true,  foliage: true, sakuraLeaf: true, shearsOnly: true, drop: B.SAKURA_LEAVES, tiles: [15, 15, 15], mapColor: '#ff96c9' },
    [B.BIRCH_LOG]:     { name: 'Gỗ Bạch Dương',       hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.BIRCH_LOG, tiles: [4, 16, 4], mapColor: '#dfd9ce' },
    [B.CACTUS]:        { name: 'Xương Rồng',          hard: 0.45, solid: true, cactus: true, trans: true, customAtlasTex: true, drop: B.CACTUS, tiles: [184, 17, 184], mapColor: '#2d7a36' },
    [B.TERRACOTTA]:    { name: 'Đất Nung Đỏ',         hard: 1.15, solid: true,  rock: true, drop: B.TERRACOTTA,    tiles: [18, 18, 18], mapColor: '#b85c3e' },
    [B.SANDSTONE]:     { name: 'Đá Sa Thạch',         hard: 1.05, solid: true,  rock: true, drop: B.SANDSTONE,     tiles: [19, 19, 19], mapColor: '#d1b578' },
    [B.GOLD_ORE]:      { name: 'Quặng Vàng',          hard: 2.10, solid: true,  rock: true, oreBlock: true, reqTier: 3, drop: B.RAW_GOLD, tiles: [20, 20, 20], mapColor: '#e8c443' },
    [B.FOOD]:          { name: 'Thịt Nướng',          hard: 0,    solid: false, food: true, voxelItem: true, heal: 4, feed: 6, tiles: [21, 21, 21], mapColor: '#c95c38' },
    [B.DEEPSLATE]:     { name: 'Đá Phiến Sâu',        hard: 2.10, solid: true,  rock: true, reqTier: 1, drop: B.DEEPSLATE,     tiles: [22, 22, 22], mapColor: '#3c414a' },
    [B.BEDROCK]:       { name: 'Đá Nền (Bedrock)',    hard: 9999, solid: true,  rock: true, unbreakable: true, indestructible: true, drop: 0, tiles: [23, 23, 23], mapColor: '#1b1d24' },
    [B.COAL_ORE]:      { name: 'Quặng Than',          hard: 1.50, solid: true,  rock: true, oreBlock: true, reqTier: 1, xp: 3, drop: B.COAL, tiles: [24, 24, 24], mapColor: '#3a3d42' },
    [B.IRON_ORE]:      { name: 'Quặng Sắt',           hard: 1.85, solid: true,  rock: true, oreBlock: true, reqTier: 2, drop: B.RAW_IRON, tiles: [25, 25, 25], mapColor: '#b8947a' },
    [B.DIAMOND_ORE]:   { name: 'Quặng Kim Cương',     hard: 2.80, solid: true,  rock: true, oreBlock: true, reqTier: 3, xp: 7, drop: B.DIAMOND, tiles: [26, 26, 26], mapColor: '#38e8ff' },
    [B.LAVA]:          { name: 'Dung Nham',           hard: 99,   solid: false, liquid: true, emissive: true,      tiles: [27, 27, 27], mapColor: '#ff5500' },
    [B.APPLE]:         { name: 'Táo Đỏ',              hard: 0.14, solid: false, hangingFruit: true, fruitColor: '#dc2626', food: true, voxelItem: true, heal: 3, feed: 4, drop: B.APPLE, tiles: [28, 28, 28], mapColor: '#dc2626', crumbColor: 0xdc2626 },
    [B.ACACIA_LOG]:    { name: 'Gỗ Keo',              hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.ACACIA_LOG, tiles: [4, 29, 4], mapColor: '#7c4e38' },
    [B.ACACIA_LEAVES]: { name: 'Lá Thu Đỏ Cam',       hard: 0.25, solid: true,  foliage: true, neutralLeaf: true, shearsOnly: true, drop: B.ACACIA_LEAVES, tiles: [30, 30, 30], mapColor: '#d96b27' },
    [B.BIRCH_LEAVES]:  { name: 'Lá Bạch Dương',       hard: 0.25, solid: true,  foliage: true, shearsOnly: true, drop: B.BIRCH_LEAVES, tiles: [31, 31, 31], mapColor: '#7cb342' },
    [B.TORCH_BLOCK]:   { name: 'Cây Đuốc (Chuẩn Minecraft)', hard: 0.08, solid: false, torch: true, emissive: true, light: 14, voxelItem: true, offhandOk: true, drop: B.TORCH_BLOCK, tiles: [132, 132, 132], mapColor: '#fde047' },
    [B.STONE_BRICK]:   { name: 'Gạch Đá Rêu',         hard: 1.40, solid: true,  rock: true, drop: B.STONE_BRICK,   tiles: [33, 33, 33], mapColor: '#8d959e' },
    [B.CRAFT_TABLE]:   { name: 'Bàn Chế Tạo',         hard: 0.85, solid: true,  wood: true, drop: B.CRAFT_TABLE,   tiles: [34, 35, 8], frontTile: 442, bothZFront: true, customAtlasTex: true, mapColor: '#b07b42' },
    [B.STICK]:         { name: 'Que Gỗ',              hard: 0,    solid: false, itemOnly: true, voxelItem: true,   tiles: [36, 36, 36], mapColor: '#a16b3b' },
    [B.WOOD_PICK]:     { name: 'Cuốc Gỗ (Cấp 1)',     hard: 0,    solid: false, tool: 'pick', pickTier: 1, voxelItem: true, mineMul: 2.4, dmg: 2,   maxDur: 60,  tiles: [37, 37, 37], mapColor: '#c2925a' },
    [B.STONE_PICK]:    { name: 'Cuốc Đá (Cấp 2)',     hard: 0,    solid: false, tool: 'pick', pickTier: 2, voxelItem: true, mineMul: 3.6, dmg: 2.5, maxDur: 132, tiles: [38, 38, 38], mapColor: '#94a3b8' },
    [B.IRON_PICK]:     { name: 'Cuốc Sắt (Cấp 3)',    hard: 0,    solid: false, tool: 'pick', pickTier: 3, voxelItem: true, mineMul: 5.2, dmg: 3,   maxDur: 250, tiles: [39, 39, 39], mapColor: '#e2e8f0' },
    [B.DIAMOND_PICK]:  { name: 'Cuốc Kim Cương (Cấp 4)', hard: 0, solid: false, tool: 'pick', pickTier: 4, voxelItem: true, mineMul: 7.5, dmg: 3.5, maxDur: 600, tiles: [40, 40, 40], mapColor: '#38f2ff' },
    [B.WOOD_SWORD]:    { name: 'Kiếm Gỗ',             hard: 0,    solid: false, tool: 'sword',  voxelItem: true, mineMul: 1.2, dmg: 4,   maxDur: 60,  tiles: [41, 41, 41], mapColor: '#c2925a' },
    [B.STONE_SWORD]:   { name: 'Kiếm Đá',             hard: 0,    solid: false, tool: 'sword',  voxelItem: true, mineMul: 1.3, dmg: 5,   maxDur: 132, tiles: [42, 42, 42], mapColor: '#94a3b8' },
    [B.IRON_SWORD]:    { name: 'Kiếm Sắt',            hard: 0,    solid: false, tool: 'sword',  voxelItem: true, mineMul: 1.4, dmg: 6,   maxDur: 250, tiles: [43, 43, 43], mapColor: '#e2e8f0' },
    [B.DIAMOND_SWORD]: { name: 'Kiếm Kim Cương',      hard: 0,    solid: false, tool: 'sword',  voxelItem: true, mineMul: 1.6, dmg: 7,   maxDur: 600, tiles: [44, 44, 44], mapColor: '#22d3ee' },
    [B.WOOD_AXE]:      { name: 'Rìu Gỗ',              hard: 0,    solid: false, tool: 'axe',    voxelItem: true, mineMul: 2.5, dmg: 3.5, maxDur: 60,  tiles: [45, 45, 45], mapColor: '#c2925a' },
    [B.STONE_AXE]:     { name: 'Rìu Đá',              hard: 0,    solid: false, tool: 'axe',    voxelItem: true, mineMul: 3.8, dmg: 4.5, maxDur: 132, tiles: [46, 46, 46], mapColor: '#94a3b8' },
    [B.IRON_AXE]:      { name: 'Rìu Sắt',             hard: 0,    solid: false, tool: 'axe',    voxelItem: true, mineMul: 5.2, dmg: 5.5, maxDur: 250, tiles: [47, 47, 47], mapColor: '#e2e8f0' },
    [B.DIAMOND_AXE]:   { name: 'Rìu Kim Cương',       hard: 0,    solid: false, tool: 'axe',    voxelItem: true, mineMul: 7.2, dmg: 6.5, maxDur: 600, tiles: [48, 48, 48], mapColor: '#38f2ff' },
    [B.STONE_SHOVEL]:  { name: 'Xẻng Đá',             hard: 0,    solid: false, tool: 'shovel', voxelItem: true, mineMul: 4.0, dmg: 2,   maxDur: 132, tiles: [49, 49, 49], mapColor: '#94a3b8' },
    [B.GOLD_APPLE]:    { name: 'Táo Vàng',            hard: 0,    solid: false, food: true, voxelItem: true, heal: 12, feed: 10, tiles: [50, 50, 50], mapColor: '#facc15', crumbColor: 0xfacc15 },
    [B.TALL_GRASS]:    { name: 'Cỏ Dại',              hard: 0.08, solid: false, cross: true, foliage: true, tiles: [51, 51, 51], mapColor: '#4ea832' },
    [B.FLOWER_RED]:    { name: 'Hoa Anh Túc',         hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.FLOWER_RED, tiles: [52, 52, 52], mapColor: '#ef4444' },
    [B.FLOWER_YELLOW]: { name: 'Hoa Bồ Công Anh',     hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.FLOWER_YELLOW, tiles: [53, 53, 53], mapColor: '#facc15' },
    [B.SAKURA_PETALS]: { name: 'Cánh Hoa Anh Đào',    hard: 0.08, solid: false, cross: true, foliage: true, tiles: [54, 54, 54], mapColor: '#fbcfe8' },
    [B.SEAGRASS]:      { name: 'Rong Biển Xanh',      hard: 0.08, solid: false, cross: true, underwater: true, foliage: true, tiles: [55, 55, 55], mapColor: '#22a055' },
    [B.GLASS]:         { name: 'Kính Trong Suốt',     hard: 0.35, solid: true,  glass: true, drop: B.GLASS, tiles: [56, 56, 56], mapColor: '#bae6fd' },
    [B.TNT]:           { name: 'Thuốc Nổ TNT',        hard: 0.25, solid: true,  tnt: true, drop: B.TNT, tiles: [58, 57, 58], mapColor: '#ef4444' },
    [B.FURNACE]:       { name: 'Lò Nung Đá (Chuột Phải)', hard: 1.25, solid: true,  rock: true, reqTier: 1, furnaceType: 'furnace', interactive: true, drop: B.FURNACE, tiles: [59, 60, 59], frontTile: 439, customAtlasTex: true, mapColor: '#64748b' },
    [B.GUNPOWDER]:     { name: 'Thuốc Súng',          hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [61, 61, 61], mapColor: '#6b7280' },
    [B.VOID_PEARL]:    { name: 'Ngọc Hư Không',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, pearl: true, tiles: [62, 62, 62], mapColor: '#c026d3' },
    [B.MAGMA_CORE]:    { name: 'Lõi Dung Nham',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [63, 63, 63], mapColor: '#f97316' },
    [B.BOW]:           { name: 'Cung Tên',            hard: 0,    solid: false, tool: 'bow', voxelItem: true, customAtlasTex: true, dmg: 6.5, maxDur: 200, tiles: [64, 64, 64], mapColor: '#a16207' },
    [B.ARROW]:         { name: 'Mũi Tên Sắt',         hard: 0,    solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [65, 65, 65], mapColor: '#e2e8f0' },
    [B.IRON_ARMOR]:    { name: 'Áo Giáp Sắt (+6)',    hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest', armorVal: 6, armorTier: 'iron', tiles: [66, 66, 66], mapColor: '#cbd5e1' },
    [B.DIAMOND_ARMOR]: { name: 'Áo Giáp Kim Cương (+8)',hard: 0,  solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest', armorVal: 8, toughness: 2, maxDur: 528, armorTier: 'diamond', tiles: [67, 67, 67], mapColor: '#22d3ee' },
    [B.FIRE_SWORD]:    { name: 'Kiếm Lửa Dung Nham',  hard: 0,    solid: false, tool: 'sword', voxelItem: true, mineMul: 1.8, dmg: 8.5, fireDmg: true, maxDur: 450, tiles: [68, 68, 68], mapColor: '#fb923c' },
    [B.MUSHROOM_GLOW]: { name: 'Nấm Phát Sáng Hang',  hard: 0.08, solid: false, cross: true, emissive: true, drop: B.MUSHROOM_GLOW, tiles: [69, 69, 69], mapColor: '#2dd4bf' },
    [B.LILY_PAD]:          { name: 'Lá Súng Mặt Nước',    hard: 0.08, solid: false, cross: true, lily: true, drop: B.LILY_PAD, tiles: [70, 70, 70], mapColor: '#16a34a' },
    [B.GLOW_CRYSTAL]:      { name: 'Tinh Thể Pha Lê',     hard: 0.85, solid: true,  rock: true, trans: true, crystalCluster: true, emissive: true, drop: B.GLOW_CRYSTAL, tiles: [71, 71, 71], mapColor: '#c084fc' },
    [B.NETHERRACK]:        { name: 'Đá Địa Ngục',         hard: 0.48, solid: true,  rock: true, drop: B.NETHERRACK, tiles: [72, 72, 72], mapColor: '#6f2323' },
    [B.CRIMSON_NYLIUM]:    { name: 'Rêu Đỏ Địa Ngục',     hard: 0.55, solid: true,  rock: true, drop: B.NETHERRACK, tiles: [73, 74, 72], mapColor: '#a31c24' },
    [B.WARPED_NYLIUM]:     { name: 'Rêu Xanh Biến Dị',    hard: 0.55, solid: true,  rock: true, drop: B.NETHERRACK, tiles: [75, 76, 72], mapColor: '#14887c' },
    [B.CRIMSON_STEM]:      { name: 'Thân Nấm Đỏ Thẫm',    hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.CRIMSON_STEM, tiles: [77, 77, 77], mapColor: '#6b1c36' },
    [B.WARPED_STEM]:       { name: 'Thân Nấm Biến Dị',    hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.WARPED_STEM, tiles: [78, 78, 78], mapColor: '#244b5e' },
    [B.NETHER_WART_BLOCK]: { name: 'Tán Nấm Đỏ Thẫm',     hard: 0.35, solid: true,  drop: B.NETHER_WART_BLOCK, tiles: [79, 79, 79], mapColor: '#8c0d19' },
    [B.WARPED_WART_BLOCK]: { name: 'Tán Nấm Biến Dị',     hard: 0.35, solid: true,  drop: B.WARPED_WART_BLOCK, tiles: [80, 80, 80], mapColor: '#0e9f94' },
    [B.SHROOMLIGHT]:       { name: 'Đèn Nấm Địa Ngục',    hard: 0.35, solid: true,  emissive: true, drop: B.SHROOMLIGHT, tiles: [81, 81, 81], mapColor: '#f59e0b' },
    [B.NETHER_BRICK]:      { name: 'Gạch Pháo Đài Đỏ',    hard: 1.65, solid: true,  rock: true, drop: B.NETHER_BRICK, tiles: [82, 82, 82], mapColor: '#36191e' },
    [B.SOUL_SAND]:         { name: 'Cát Linh Hồn',        hard: 0.55, solid: true,  dirt: true, drop: B.SOUL_SAND, tiles: [83, 83, 83], mapColor: '#4a382c' },
    [B.OBSIDIAN]:          { name: 'Hắc Diện Thạch',      hard: 3.80, solid: true,  rock: true, blastResist: true, reqTier: 4, drop: B.OBSIDIAN, tiles: [84, 84, 84], mapColor: '#1b112b' },
    [B.END_STONE]:         { name: 'Đá Khu Kết Thúc',     hard: 1.50, solid: true,  rock: true, drop: B.END_STONE, tiles: [85, 85, 85], mapColor: '#dcd99e' },
    [B.PURPUR_BLOCK]:      { name: 'Đá Purpur Thành End', hard: 1.35, solid: true,  rock: true, drop: B.PURPUR_BLOCK, tiles: [86, 86, 86], mapColor: '#a676b2' },
    [B.CHORUS_PLANT]:      { name: 'Cây Điệp Khúc End',   hard: 0.35, solid: true,  drop: B.CHORUS_PLANT, tiles: [87, 87, 87], mapColor: '#6d3c7a' },
    [B.CRIMSON_ROOTS]:     { name: 'Cỏ Đỏ Địa Ngục',      hard: 0.08, solid: false, cross: true, foliage: true, tiles: [88, 88, 88], mapColor: '#c9182b' },
    [B.WARPED_ROOTS]:      { name: 'Cỏ Xanh Biến Dị',     hard: 0.08, solid: false, cross: true, foliage: true, tiles: [89, 89, 89], mapColor: '#14b8a6' },
    [B.PALM_LOG]:          { name: 'Thân Cây Dừa',        hard: 0.85, solid: true,  wood: true, isLog: true, drop: B.PALM_LOG, tiles: [4, 91, 4], mapColor: '#9c7853' },
    [B.PALM_LEAVES]:       { name: 'Tàu Lá Dừa Xanh',     hard: 0.22, solid: true,  foliage: true, shearsOnly: true, drop: B.PALM_LEAVES, tiles: [92, 92, 92], mapColor: '#4da83b' },
    [B.COCONUT]:           { name: 'Quả Dừa Tươi',        hard: 0.16, solid: false, hangingFruit: true, fruitColor: '#6b4423', food: true, voxelItem: true, heal: 3, feed: 4, drop: B.COCONUT, tiles: [93, 93, 93], mapColor: '#7c4d2b' },
    [B.MANGROVE_LOG]:      { name: 'Gỗ Đước Ngập Mặn',    hard: 0.95, solid: true,  wood: true, isLog: true, drop: B.MANGROVE_LOG, tiles: [4, 94, 4], mapColor: '#5c342e' },
    [B.MANGROVE_ROOTS]:    { name: 'Rễ Đước Ngập Mặn',    hard: 0.45, solid: true,  wood: true, trans: true, subBlock: true, rootCage: true, drop: B.MANGROVE_ROOTS, tiles: [95, 95, 95], mapColor: '#4f3829' },
    [B.MANGROVE_LEAVES]:   { name: 'Lá Rừng Ngập Mặn',    hard: 0.25, solid: true,  foliage: true, shearsOnly: true, drop: B.MANGROVE_LEAVES, tiles: [96, 96, 96], mapColor: '#3f7d3a' },
    [B.MUD]:               { name: 'Đất Bùn Đầm Lầy',     hard: 0.45, solid: true,  dirt: true, drop: B.MUD, tiles: [97, 97, 97], mapColor: '#3d3c44' },
    [B.MUD_BRICK]:         { name: 'Gạch Bùn Cổ',         hard: 1.25, solid: true,  rock: true, drop: B.MUD_BRICK, tiles: [98, 98, 98], mapColor: '#8c6d56' },
    [B.COPPER_ROOF]:       { name: 'Ngói Đồng Xanh Ngọc', hard: 1.30, solid: true,  rock: true, drop: B.COPPER_ROOF, tiles: [99, 99, 99], mapColor: '#3aa38d' },
    [B.MARBLE_BRICK]:      { name: 'Đá Cẩm Thạch Thành',  hard: 1.45, solid: true,  rock: true, drop: B.MARBLE_BRICK, tiles: [100, 100, 100], mapColor: '#e8e5dc' },
    [B.PRISMARINE]:        { name: 'Đá Lăng Kính Biển',   hard: 1.40, solid: true,  rock: true, drop: B.PRISMARINE, tiles: [101, 101, 101], mapColor: '#3a8c84' },
    [B.SEA_LANTERN]:       { name: 'Đèn Biển Đại Dương',  hard: 0.40, solid: true,  emissive: true, drop: B.SEA_LANTERN, tiles: [102, 102, 102], mapColor: '#99f6e4' },
    [B.CORAL_PINK]:        { name: 'San Hô Hồng',         hard: 0.35, solid: true,  rock: true, drop: B.CORAL_PINK, tiles: [103, 103, 103], mapColor: '#f472b6' },
    [B.CORAL_BLUE]:        { name: 'San Hô Xanh Lam',     hard: 0.35, solid: true,  rock: true, drop: B.CORAL_BLUE, tiles: [104, 104, 104], mapColor: '#38bdf8' },
    [B.CORAL_GOLD]:        { name: 'San Hô Vàng Rực',     hard: 0.35, solid: true,  rock: true, drop: B.CORAL_GOLD, tiles: [105, 105, 105], mapColor: '#facc15' },
    [B.PACKED_ICE]:        { name: 'Băng Nén (Trượt x1.6)',hard: 0.70, solid: true, rock: true, slippery: true, drop: B.PACKED_ICE, tiles: [106, 106, 106], mapColor: '#7dd3fc' },
    [B.HAY_BALE]:          { name: 'Kiện Rơm (Đệm Rơi)',  hard: 0.45, solid: true,  dirt: true, cushion: true, drop: B.HAY_BALE, tiles: [107, 108, 107], mapColor: '#eab308' },
    [B.SLIME_BLOCK]:       { name: 'Khối Slime Nảy Cao',  hard: 0.20, solid: true,  bouncy: true, drop: B.SLIME_BLOCK, tiles: [109, 109, 109], mapColor: '#84cc16' },
    [B.BOOKSHELF]:         { name: 'Kệ Sách Cổ Đại',      hard: 0.85, solid: true,  wood: true, drop: B.BOOKSHELF, tiles: [8, 110, 8], mapColor: '#a16207' },
    [B.ENCHANT_TABLE]:     { name: 'Bàn Phù Phép (Chuột Phải)', hard: 1.80, solid: true, rock: true, interactive: true, drop: B.ENCHANT_TABLE, tiles: [111, 112, 84], mapColor: '#7e22ce' },
    [B.ANVIL]:             { name: 'Đe Rèn Sửa Đồ (Chuột Phải)', hard: 1.90, solid: true, rock: true, interactive: true, drop: B.ANVIL, tiles: [113, 113, 113], mapColor: '#475569' },
    [B.CHEST]:             { name: 'Rương Gỗ Sồi (27 Ô)',        hard: 0.90, solid: true, wood: true, chest: true, chestSlots: 27, chestTier: 'oak', trans: true, interactive: true, drop: B.CHEST, tiles: [114, 443, 114], frontTile: 115, customAtlasTex: true, mapColor: '#b45309' },
    [B.BED]:               { voxelItem: true, name: 'Giường Ngủ Đỏ', hard: 0.35, solid: true, wood: true, bed: true, trans: true, interactive: true, bedPartner: B.BED_FOOT, bedColorKey: 'red', bedHex: '#dc2626', bedDarkHex: '#991b1b', bedLightHex: '#f87171', bedBlanketTile: 194, bedSideTile: 195, drop: B.BED, tiles: [193, 196, 8], mapColor: '#dc2626' },
    [B.CAMPFIRE]:          { name: 'Lửa Trại (Nướng & Hồi Máu)', hard: 0.50, solid: true, trans: true, campfire: true, wood: true, emissive: true, interactive: true, drop: B.CAMPFIRE, tiles: [118, 118, 118], mapColor: '#fb923c' },
    [B.BUCKET]:            { name: 'Xô Sắt (Múc Nước/Lava)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, bucket: 'empty', tiles: [119, 119, 119], mapColor: '#cbd5e1' },
    [B.WATER_BUCKET]:      { name: 'Xô Nước (Đổ Chảy Lan)',      hard: 0, solid: false, itemOnly: true, voxelItem: true, bucket: 'water', tiles: [120, 120, 120], mapColor: '#38bdf8' },
    [B.LAVA_BUCKET]:       { name: 'Xô Dung Nham (Đổ Chảy Lan)', hard: 0, solid: false, itemOnly: true, voxelItem: true, bucket: 'lava',  tiles: [121, 121, 121], mapColor: '#f97316' },
    [B.FISHING_ROD]:       { name: 'Cần Câu Cá Biển',            hard: 0, solid: false, tool: 'rod', voxelItem: true, customAtlasTex: true, dmg: 2, maxDur: 160, tiles: [122, 122, 122], mapColor: '#b45309' },
    [B.BOAT_ITEM]:         { name: 'Thuyền Gỗ (Lướt Mặt Biển)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, boat: true, tiles: [123, 123, 123], mapColor: '#92400e' },
    [B.SPYGLASS]:          { name: 'Ống Nhòm (Zoom 3x)',         hard: 0, solid: false, itemOnly: true, voxelItem: true, spyglass: true, tiles: [124, 124, 124], mapColor: '#f59e0b' },
    [B.RAW_FISH]:          { name: 'Cá Biển Tươi',               hard: 0, solid: false, food: true, voxelItem: true, heal: 2, feed: 3, tiles: [125, 125, 125], mapColor: '#38bdf8' },
    [B.COOKED_FISH]:       { name: 'Cá Nướng Vàng Giòn',         hard: 0, solid: false, food: true, voxelItem: true, heal: 6, feed: 8, tiles: [126, 126, 126], mapColor: '#f59e0b' },
    [B.BREAD]:             { name: 'Bánh Mì Nóng',               hard: 0, solid: false, food: true, voxelItem: true, heal: 5, feed: 7, tiles: [127, 127, 127], mapColor: '#d97706' },
    [B.COCONUT_DRINK]:     { name: 'Nước Dừa Giải Khát',         hard: 0, solid: false, food: true, voxelItem: true, heal: 6, feed: 6, tiles: [128, 128, 128], mapColor: '#fef3c7' },
    [B.WATER_BREATH_POTION]: { name: 'Thuốc Thở Dưới Biển (90s)', hard: 0, solid: false, itemOnly: true, voxelItem: true, waterBreath: true, tiles: [129, 129, 129], mapColor: '#22d3ee' },
    [B.IRON_SHOVEL]:       { name: 'Xẻng Sắt',                   hard: 0, solid: false, tool: 'shovel', voxelItem: true, mineMul: 5.5, dmg: 2.5, maxDur: 250, tiles: [130, 130, 130], mapColor: '#e2e8f0' },
    [B.DIAMOND_SHOVEL]:    { name: 'Xẻng Kim Cương',             hard: 0, solid: false, tool: 'shovel', voxelItem: true, mineMul: 8.0, dmg: 3.0, maxDur: 600, tiles: [131, 131, 131], mapColor: '#38f2ff' },
    [B.LANTERN]:           { name: 'Đèn Lồng Treo',              hard: 0.30, solid: true, emissive: true, light: 15, lantern: true, trans: true, voxelItem: true, offhandOk: true, drop: B.LANTERN, tiles: [32, 32, 32], mapColor: '#f59e0b' },
    [B.SHIELD]:            { name: 'Khiên Gỗ Sắt (Đỡ Đòn)',      hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'offhand', armorVal: 2, armorTier: 'iron', shield: true, offhandOk: true, maxDur: 336, tiles: [133, 133, 133], mapColor: '#92400e' },
    [B.IRON_HELMET]:       { name: 'Mũ Giáp Sắt (+2)',           hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 2, armorTier: 'iron', tiles: [134, 134, 134], mapColor: '#cbd5e1' },
    [B.IRON_LEGS]:         { name: 'Quần Giáp Sắt (+5)',         hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 5, armorTier: 'iron', tiles: [135, 135, 135], mapColor: '#cbd5e1' },
    [B.IRON_BOOTS]:        { name: 'Giày Giáp Sắt (+2)',         hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 2, armorTier: 'iron', tiles: [136, 136, 136], mapColor: '#cbd5e1' },
    [B.DIAMOND_HELMET]:    { name: 'Mũ Kim Cương (+3)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 3, toughness: 2, maxDur: 363, armorTier: 'diamond', tiles: [137, 137, 137], mapColor: '#22d3ee' },
    [B.DIAMOND_LEGS]:      { name: 'Quần Kim Cương (+6)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 6, toughness: 2, maxDur: 495, armorTier: 'diamond', tiles: [138, 138, 138], mapColor: '#22d3ee' },
    [B.DIAMOND_BOOTS]:     { name: 'Giày Kim Cương (+3)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 3, toughness: 2, maxDur: 429, armorTier: 'diamond', tiles: [139, 139, 139], mapColor: '#22d3ee' },
    [B.ASPHALT]:           { name: 'Đường Nhựa Đô Thị',          hard: 1.40, solid: true, rock: true, drop: B.ASPHALT, tiles: [140, 140, 140], mapColor: '#2d3138' },
    [B.ROAD_LINE]:         { name: 'Vạch Kẻ Đường Vàng',         hard: 1.40, solid: true, rock: true, drop: B.ASPHALT, tiles: [141, 140, 140], mapColor: '#eab308' },
    [B.CONCRETE]:          { name: 'Bê Tông Cao Ốc',             hard: 1.60, solid: true, rock: true, drop: B.CONCRETE, tiles: [142, 142, 142], mapColor: '#9ca3af' },
    [B.CRACKED_CONCRETE]:  { name: 'Bê Tông Đổ Nát Rêu',         hard: 1.35, solid: true, rock: true, drop: B.CONCRETE, tiles: [143, 143, 143], mapColor: '#6b7280' },
    [B.RUST_STEEL]:        { name: 'Khung Thép Gỉ Sét',          hard: 1.80, solid: true, rock: true, glass: true, drop: B.RUST_STEEL, tiles: [144, 144, 144], mapColor: '#7c3f24' },
    [B.BROKEN_GLASS]:      { name: 'Kính Cao Ốc Vỡ',             hard: 0.25, solid: true, glass: true, drop: B.GLASS, tiles: [145, 145, 145], mapColor: '#64748b' },
    [B.ELEVATOR_BLOCK]:    { name: 'Thang Máy 500m (Chuột Phải)',hard: 1.50, solid: true, rock: true, emissive: true, interactive: true, drop: B.ELEVATOR_BLOCK, tiles: [146, 146, 146], mapColor: '#38bdf8' },
    [B.BAMBOO]:            { name: 'Cây Tre Trúc',               hard: 0.32, solid: true, wood: true, bamboo: true, trans: true, drop: B.BAMBOO, tiles: [186, 147, 186], itemTile: 187, mapColor: '#589c28' },
    [B.MYCELIUM]:          { name: 'Đất Nấm Tím',                hard: 0.55, solid: true, dirt: true, drop: B.DIRT, tiles: [148, 149, 2], mapColor: '#7c6578' },
    [B.MUSHROOM_RED_CAP]:  { name: 'Tán Nấm Đỏ Khổng Lồ',        hard: 0.35, solid: true, wood: true, drop: B.MUSHROOM_RED_CAP, tiles: [150, 150, 150], mapColor: '#dc2626' },
    [B.MUSHROOM_STEM]:     { name: 'Thân Nấm Khổng Lồ',          hard: 0.45, solid: true, wood: true, drop: B.MUSHROOM_STEM, tiles: [151, 151, 151], mapColor: '#e5dfd5' },
    [B.BASALT]:            { name: 'Đá Bazan Núi Lửa',           hard: 1.65, solid: true, rock: true, drop: B.BASALT, tiles: [152, 152, 152], mapColor: '#33363f' },
    [B.FLOWER_LAVENDER]:   { name: 'Hoa Oải Hương Tím',          hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.FLOWER_LAVENDER, tiles: [153, 153, 153], mapColor: '#a855f7' },
    [B.LOTUS]:             { name: 'Hoa Sen Hồng Mặt Nước',      hard: 0.08, solid: false, cross: true, lily: true, drop: B.LOTUS, tiles: [154, 154, 154], mapColor: '#f472b6' },
    [B.BERRY_BUSH]:        { name: 'Bụi Quả Mọng Đỏ',            hard: 0.14, solid: false, cross: true, food: true, heal: 3, feed: 3, drop: B.BERRY_BUSH, tiles: [155, 155, 155], mapColor: '#dc2626' },
    [B.FERN]:              { name: 'Cây Dương Xỉ Rừng',          hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.FERN, tiles: [156, 156, 156], mapColor: '#2e7d32' },
    [B.VINE]:              { name: 'Dây Leo Rủ Xanh',            hard: 0.10, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.VINE, tiles: [157, 157, 157], mapColor: '#3a7d2c' },
    // v18 New Ores (Strict Pickaxe Mining Tiers!), New Tools & 4 Full New Armor Sets!
    [B.COPPER_ORE]:        { name: 'Quặng Đồng (Cần Cúp Gỗ+)',   hard: 1.65, solid: true, rock: true, oreBlock: true, reqTier: 1, drop: B.RAW_COPPER,   tiles: [158, 158, 158], mapColor: '#d97742' },
    [B.TIN_ORE]:           { name: 'Quặng Thiếc Bạc (Cúp Gỗ+)',  hard: 1.70, solid: true, rock: true, oreBlock: true, reqTier: 1, drop: B.RAW_IRON,     tiles: [159, 159, 159], mapColor: '#cbd5e1' },
    [B.EMERALD_ORE]:       { name: 'Quặng Lục Bảo (Cần Cúp Sắt+)',hard: 2.65, solid: true, rock: true, oreBlock: true, reqTier: 3, xp: 7, drop: B.EMERALD,      tiles: [160, 160, 160], mapColor: '#10b981' },
    [B.RUBY_ORE]:          { name: 'Quặng Hồng Ngọc (Cúp Sắt+)', hard: 2.75, solid: true, rock: true, oreBlock: true, reqTier: 3, xp: 7, drop: B.RUBY,         tiles: [161, 161, 161], mapColor: '#f43f5e' },
    [B.TITANIUM_ORE]:      { name: 'Mảnh Vụn Cổ Đại (Ancient Debris)',hard: 3.80, solid: true, rock: true, oreBlock: true, blastResist: true, fireImmune: true, reqTier: 4, xp: 0, drop: B.TITANIUM_ORE, tiles: [355, 356, 355], mapColor: '#5c4138' },
    [B.COPPER_PICK]:       { name: 'Cuốc Đồng (Cấp 2)',          hard: 0, solid: false, tool: 'pick', pickTier: 2, voxelItem: true, mineMul: 4.3, dmg: 2.8, maxDur: 185, tiles: [163, 163, 163], mapColor: '#ea7c42' },
    [B.RUBY_PICK]:         { name: 'Cuốc Hồng Ngọc (Cấp 4)',     hard: 0, solid: false, tool: 'pick', pickTier: 4, voxelItem: true, mineMul: 8.4, dmg: 4.0, maxDur: 780, tiles: [164, 164, 164], mapColor: '#f43f5e' },
    [B.NETHERITE_PICK]:    { name: 'Cuốc Netherite (Cấp 5)',     hard: 0, solid: false, tool: 'pick', pickTier: 5, voxelItem: true, fireImmune: true, mineMul: 9.0, dmg: 6.0, maxDur: 2031, tiles: [165, 165, 165], mapColor: '#443d44' },
    [B.RUBY_SWORD]:        { name: 'Kiếm Hồng Ngọc Ruby',        hard: 0, solid: false, tool: 'sword', voxelItem: true, mineMul: 1.7, dmg: 8.0, maxDur: 780, tiles: [166, 166, 166], mapColor: '#f43f5e' },
    [B.NETHERITE_SWORD]:   { name: 'Kiếm Netherite',             hard: 0, solid: false, tool: 'sword', voxelItem: true, fireImmune: true, mineMul: 2.0, dmg: 8.0, maxDur: 2031, tiles: [167, 167, 167], mapColor: '#443d44' },
    [B.LEATHER_HELMET]:    { name: 'Mũ Giáp Da (+1)',            hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 1, armorTier: 'leather', tiles: [168, 168, 168], mapColor: '#92400e' },
    [B.LEATHER_CHEST]:     { name: 'Áo Giáp Da (+3)',            hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 3, armorTier: 'leather', tiles: [169, 169, 169], mapColor: '#92400e' },
    [B.LEATHER_LEGS]:      { name: 'Quần Giáp Da (+2)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 2, armorTier: 'leather', tiles: [170, 170, 170], mapColor: '#92400e' },
    [B.LEATHER_BOOTS]:     { name: 'Giày Giáp Da (+1)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 1, armorTier: 'leather', tiles: [171, 171, 171], mapColor: '#92400e' },
    [B.GOLD_HELMET]:       { name: 'Mũ Giáp Vàng (+2)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 2, armorTier: 'gold', tiles: [172, 172, 172], mapColor: '#facc15' },
    [B.GOLD_ARMOR]:        { name: 'Áo Giáp Vàng (+5)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 5, armorTier: 'gold', tiles: [173, 173, 173], mapColor: '#facc15' },
    [B.GOLD_LEGS]:         { name: 'Quần Giáp Vàng (+3)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 3, armorTier: 'gold', tiles: [174, 174, 174], mapColor: '#facc15' },
    [B.GOLD_BOOTS]:        { name: 'Giày Giáp Vàng (+1)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 1, armorTier: 'gold', tiles: [175, 175, 175], mapColor: '#facc15' },
    [B.RUBY_HELMET]:       { name: 'Mũ Hồng Ngọc Ruby (+3)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 3, armorTier: 'ruby', tiles: [176, 176, 176], mapColor: '#f43f5e' },
    [B.RUBY_CHEST]:        { name: 'Áo Hồng Ngọc Ruby (+6)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 6, armorTier: 'ruby', tiles: [177, 177, 177], mapColor: '#f43f5e' },
    [B.RUBY_LEGS]:         { name: 'Quần Hồng Ngọc Ruby (+5)',   hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 5, armorTier: 'ruby', tiles: [178, 178, 178], mapColor: '#f43f5e' },
    [B.RUBY_BOOTS]:        { name: 'Giày Hồng Ngọc Ruby (+2)',   hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 2, armorTier: 'ruby', tiles: [179, 179, 179], mapColor: '#f43f5e' },
    [B.NETHERITE_HELMET]:  { name: 'Mũ Giáp Netherite (+3)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'helmet', armorVal: 3, toughness: 3, kbResist: 0.10, maxDur: 407, armorTier: 'netherite', tiles: [180, 180, 180], mapColor: '#443d44' },
    [B.NETHERITE_ARMOR]:   { name: 'Áo Giáp Netherite (+8)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'chest',  armorVal: 8, toughness: 3, kbResist: 0.10, maxDur: 592, armorTier: 'netherite', tiles: [181, 181, 181], mapColor: '#443d44' },
    [B.NETHERITE_LEGS]:    { name: 'Quần Giáp Netherite (+6)',   hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'legs',   armorVal: 6, toughness: 3, kbResist: 0.10, maxDur: 555, armorTier: 'netherite', tiles: [182, 182, 182], mapColor: '#443d44' },
    [B.NETHERITE_BOOTS]:   { name: 'Giày Giáp Netherite (+3)',   hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'boots',  armorVal: 3, toughness: 3, kbResist: 0.10, maxDur: 481, armorTier: 'netherite', tiles: [183, 183, 183], mapColor: '#443d44' },
    // Minecraft Vanilla: Chainmail, Copper & Turtle Shell Armor
    [B.CHAINMAIL_HELMET]:  { name: 'Mũ Giáp Xích (+2)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 2, armorTier: 'chainmail', tiles: [180, 180, 180], mapColor: '#94a3b8' },
    [B.CHAINMAIL_CHEST]:   { name: 'Áo Giáp Xích (+5)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 5, armorTier: 'chainmail', tiles: [181, 181, 181], mapColor: '#94a3b8' },
    [B.CHAINMAIL_LEGS]:    { name: 'Quần Giáp Xích (+4)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 4, armorTier: 'chainmail', tiles: [182, 182, 182], mapColor: '#94a3b8' },
    [B.CHAINMAIL_BOOTS]:   { name: 'Giày Giáp Xích (+1)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 1, armorTier: 'chainmail', tiles: [183, 183, 183], mapColor: '#94a3b8' },
    [B.COPPER_HELMET]:     { name: 'Mũ Giáp Đồng (+2)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 2, armorTier: 'copper',    tiles: [180, 180, 180], mapColor: '#d97706' },
    [B.COPPER_CHEST]:      { name: 'Áo Giáp Đồng (+4)',          hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 4, armorTier: 'copper',    tiles: [181, 181, 181], mapColor: '#d97706' },
    [B.COPPER_LEGS]:       { name: 'Quần Giáp Đồng (+3)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 3, armorTier: 'copper',    tiles: [182, 182, 182], mapColor: '#d97706' },
    [B.COPPER_BOOTS]:      { name: 'Giày Giáp Đồng (+1)',        hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 1, armorTier: 'copper',    tiles: [183, 183, 183], mapColor: '#d97706' },
    [B.TURTLE_HELMET]:     { name: 'Mũ Mai Rùa (+2)',            hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 2, armorTier: 'turtle',    tiles: [180, 180, 180], mapColor: '#22c55e' },
    // Balanced Post-Netherite Mythic Armor Tiers
    [B.ENDER_HELMET]:      { name: 'Mũ Rồng End (+4)',           hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 4, toughness: 3, armorTier: 'ender',     tiles: [180, 180, 180], mapColor: '#9333ea' },
    [B.ENDER_CHEST]:       { name: 'Áo Rồng End (+8)',           hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 8, toughness: 3, armorTier: 'ender',     tiles: [181, 181, 181], mapColor: '#9333ea' },
    [B.ENDER_LEGS]:        { name: 'Quần Rồng End (+6)',         hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 6, toughness: 3, armorTier: 'ender',     tiles: [182, 182, 182], mapColor: '#9333ea' },
    [B.ENDER_BOOTS]:       { name: 'Giày Rồng End (+3)',         hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 3, toughness: 3, armorTier: 'ender',     tiles: [183, 183, 183], mapColor: '#9333ea' },
    [B.SOLARIS_HELMET]:    { name: 'Mũ Mặt Trời Địa Ngục (+4)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 4, toughness: 3, armorTier: 'solaris',   tiles: [180, 180, 180], mapColor: '#f97316' },
    [B.SOLARIS_CHEST]:     { name: 'Áo Mặt Trời Địa Ngục (+8)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 8, toughness: 3, armorTier: 'solaris',   tiles: [181, 181, 181], mapColor: '#f97316' },
    [B.SOLARIS_LEGS]:      { name: 'Quần Mặt Trời Địa Ngục (+7)',hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 7, toughness: 3, armorTier: 'solaris',   tiles: [182, 182, 182], mapColor: '#f97316' },
    [B.SOLARIS_BOOTS]:     { name: 'Giày Mặt Trời Địa Ngục (+3)',hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 3, toughness: 3, armorTier: 'solaris',   tiles: [183, 183, 183], mapColor: '#f97316' },
    [B.CELESTIAL_HELMET]:  { name: 'Mũ Tinh Vân Vũ Trụ (+4)',    hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 4, toughness: 3.5, armorTier: 'celestial', tiles: [180, 180, 180], mapColor: '#06b6d4' },
    [B.CELESTIAL_CHEST]:   { name: 'Áo Tinh Vân Vũ Trụ (+9)',    hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 9, toughness: 3.5, armorTier: 'celestial', tiles: [181, 181, 181], mapColor: '#06b6d4' },
    [B.CELESTIAL_LEGS]:    { name: 'Quần Tinh Vân Vũ Trụ (+7)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 7, toughness: 3.5, armorTier: 'celestial', tiles: [182, 182, 182], mapColor: '#06b6d4' },
    [B.CELESTIAL_BOOTS]:   { name: 'Giày Tinh Vân Vũ Trụ (+3)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 3, toughness: 3.5, armorTier: 'celestial', tiles: [183, 183, 183], mapColor: '#06b6d4' },
    // v40 Full Minecraft Foodstuffs (Raw & Cooked Meats, Fruits, Veggies, Baked Goods)
    [B.RAW_PORK]:       { name: 'Thịt Heo Sống',         hard: 0, solid: false, food: true, voxelItem: true, heal: 2, feed: 3,  tiles: [256, 256, 256], mapColor: '#f48fb1', crumbColor: 0xf48fb1 },
    [B.COOKED_PORK]:    { name: 'Thịt Heo Nướng',        hard: 0, solid: false, food: true, voxelItem: true, heal: 8, feed: 10, tiles: [257, 257, 257], mapColor: '#c68642', crumbColor: 0xc68642 },
    [B.RAW_CHICKEN]:    { name: 'Thịt Gà Sống',          hard: 0, solid: false, food: true, voxelItem: true, heal: 1, feed: 2,  tiles: [258, 258, 258], mapColor: '#f8bbd0', crumbColor: 0xf8bbd0 },
    [B.COOKED_CHICKEN]: { name: 'Thịt Gà Nướng',         hard: 0, solid: false, food: true, voxelItem: true, heal: 6, feed: 8,  tiles: [259, 259, 259], mapColor: '#d97706', crumbColor: 0xd97706 },
    [B.RAW_MUTTON]:     { name: 'Thịt Cừu Sống',         hard: 0, solid: false, food: true, voxelItem: true, heal: 2, feed: 3,  tiles: [260, 260, 260], mapColor: '#ef5350', crumbColor: 0xef5350 },
    [B.COOKED_MUTTON]:  { name: 'Thịt Cừu Nướng',        hard: 0, solid: false, food: true, voxelItem: true, heal: 7, feed: 9,  tiles: [261, 261, 261], mapColor: '#8d5524', crumbColor: 0x8d5524 },
    [B.RAW_RABBIT]:     { name: 'Thịt Thỏ Sống',         hard: 0, solid: false, food: true, voxelItem: true, heal: 2, feed: 3,  tiles: [262, 262, 262], mapColor: '#f4a29e', crumbColor: 0xf4a29e },
    [B.COOKED_RABBIT]:  { name: 'Thịt Thỏ Nướng',        hard: 0, solid: false, food: true, voxelItem: true, heal: 6, feed: 7,  tiles: [263, 263, 263], mapColor: '#b45309', crumbColor: 0xb45309 },
    [B.RAW_SALMON]:     { name: 'Cá Hồi Tươi Sống',      hard: 0, solid: false, food: true, voxelItem: true, heal: 2, feed: 3,  tiles: [264, 264, 264], mapColor: '#e11d48', crumbColor: 0xe11d48 },
    [B.COOKED_SALMON]:  { name: 'Cá Hồi Nướng',          hard: 0, solid: false, food: true, voxelItem: true, heal: 7, feed: 8,  tiles: [265, 265, 265], mapColor: '#ea580c', crumbColor: 0xea580c },
    [B.CARROT]:         { name: 'Cà Rốt Tươi',           hard: 0, solid: false, food: true, voxelItem: true, heal: 3, feed: 4,  tiles: [266, 266, 266], mapColor: '#f97316', crumbColor: 0xf97316 },
    [B.GOLDEN_CARROT]:  { name: 'Cà Rốt Vàng',           hard: 0, solid: false, food: true, voxelItem: true, heal: 9, feed: 12, tiles: [267, 267, 267], mapColor: '#facc15', crumbColor: 0xfacc15 },
    [B.POTATO]:         { name: 'Khoai Tây Tươi',        hard: 0, solid: false, food: true, voxelItem: true, heal: 1, feed: 2,  tiles: [268, 268, 268], mapColor: '#d4a373', crumbColor: 0xd4a373 },
    [B.BAKED_POTATO]:   { name: 'Khoai Tây Nướng',       hard: 0, solid: false, food: true, voxelItem: true, heal: 6, feed: 7,  tiles: [269, 269, 269], mapColor: '#eab308', crumbColor: 0xeab308 },
    [B.BEETROOT]:       { name: 'Củ Dền Đỏ',             hard: 0, solid: false, food: true, voxelItem: true, heal: 2, feed: 3,  tiles: [270, 270, 270], mapColor: '#9f1239', crumbColor: 0x9f1239 },
    [B.SWEET_BERRIES]:  { name: 'Quả Mọng Đỏ Ngọt',      hard: 0, solid: false, food: true, voxelItem: true, heal: 3, feed: 4,  tiles: [271, 271, 271], mapColor: '#dc2626', crumbColor: 0xdc2626 },
    [B.COOKIE]:         { name: 'Bánh Quy Sô-cô-la',     hard: 0, solid: false, food: true, voxelItem: true, heal: 3, feed: 4,  tiles: [272, 272, 272], mapColor: '#b45309', crumbColor: 0xb45309 },
    [B.PUMPKIN_PIE]:    { name: 'Bánh Bí Ngô Nướng',     hard: 0, solid: false, food: true, voxelItem: true, heal: 7, feed: 9,  tiles: [273, 273, 273], mapColor: '#d97706', crumbColor: 0xd97706 },
    [B.CAKE_ITEM]:      { name: 'Bánh Kem Dâu Tây',      hard: 0, solid: false, food: true, voxelItem: true, heal: 8, feed: 10, tiles: [274, 274, 274], mapColor: '#f8fafc', crumbColor: 0xfca5a5 },
    [B.HONEY_BOTTLE]:   { name: 'Lọ Mật Ong Rừng',       hard: 0, solid: false, food: true, voxelItem: true, heal: 6, feed: 8,  tiles: [275, 275, 275], mapColor: '#f59e0b', crumbColor: 0xf59e0b },
    // v42 Gravel, Flint, Flint & Steel, Nether Portal, Ender Items & End Portal
    [B.GRAVEL]:               { name: 'Đá Sỏi',                hard: 0.75, solid: true,  dirt: true,  drop: B.GRAVEL, tiles: [276, 276, 276], mapColor: '#8b8685' },
    [B.FLINT]:                { name: 'Đá Lửa',                hard: 0,    solid: false, voxelItem: true, tiles: [282, 282, 282] },
    [B.FLINT_AND_STEEL]:      { name: 'Bật Lửa Thạch Anh',     hard: 0,    solid: false, tool: 'flint_steel', voxelItem: true, maxDur: 64, tiles: [283, 283, 283] },
    [B.FIRE]:                 { name: 'Lửa',                   hard: 0.02, solid: false, cross: true, trans: true, emissive: true, light: 14, fire: true, drop: 0, tiles: [324, 324, 324], mapColor: '#f97316' },
    [B.NETHER_PORTAL]:        { name: 'Cổng Địa Ngục',         hard: 0.25, solid: false, trans: true, emissive: true, light: 12, portal: 'nether', drop: 0, tiles: [277, 277, 277], mapColor: '#9333ea' },
    [B.ENDER_PEARL]:          { name: 'Ngọc Ender (Ender Pearl)', hard: 0, solid: false, voxelItem: true, tiles: [284, 284, 284] },
    [B.BLAZE_ROD]:            { name: 'Que Quỷ Lửa (Blaze Rod)',  hard: 0, solid: false, voxelItem: true, tiles: [285, 285, 285] },
    [B.BLAZE_POWDER]:         { name: 'Bột Quỷ Lửa (Blaze Powder)', hard: 0, solid: false, voxelItem: true, tiles: [286, 286, 286] },
    [B.ENDER_EYE]:            { name: 'Mắt Ender (Eye of Ender)', hard: 0, solid: false, voxelItem: true, tiles: [287, 287, 287] },
    [B.END_PORTAL_FRAME]:     { name: 'Khung Cổng Kết Thúc',   hard: 99,   solid: true,  stone: true, trans: true, drop: B.END_PORTAL_FRAME, tiles: [278, 279, 80], mapColor: '#2d6a62' },
    [B.END_PORTAL_FRAME_EYE]: { name: 'Khung Cổng End (Có Mắt)', hard: 99, solid: true,  stone: true, trans: true, emissive: false, light: 6, drop: B.END_PORTAL_FRAME, tiles: [280, 279, 80], mapColor: '#10b981' },
    [B.END_PORTAL]:           { name: 'Cổng Kết Thúc',         hard: 99,   solid: false, trans: true, emissive: true, light: 15, portal: 'end', drop: 0, tiles: [281, 281, 281], mapColor: '#090d16' },
    // v43 THE SIFT: Indestructible Dream Portal, Dreamy Biomes, Trees, Ores, Superior Tools & Armor
    [B.DREAM_PORTAL_FRAME]:   { name: 'Khung Cổng Giấc Mơ',    hard: 9999, solid: true,  rock: true, indestructible: true, emissive: false, light: 8, drop: 0, tiles: [288, 288, 288], mapColor: '#38bdf8' },
    [B.DREAM_PORTAL]:         { name: 'Cổng Giấc Mơ',          hard: 9999, solid: false, trans: true, indestructible: true, emissive: true, light: 15, portal: 'dream', drop: 0, tiles: [289, 289, 289], mapColor: '#f472b6' },
    [B.SIFT_GRASS]:           { name: 'Cỏ Singer Meadow',      hard: 0.55, solid: true,  dirt: true, drop: B.SIFT_GRASS, tiles: [290, 291, 294], mapColor: '#34d399' },
    [B.LULLABY_GRASS]:        { name: 'Cỏ Đồi Lullaby Hồng',   hard: 0.55, solid: true,  dirt: true, drop: B.LULLABY_GRASS, tiles: [292, 293, 294], mapColor: '#f472b6' },
    [B.HUSK_SOIL]:            { name: 'Đất Khô Huskland',      hard: 0.65, solid: true,  dirt: true, drop: B.HUSK_SOIL, tiles: [294, 294, 294], mapColor: '#c98a6b' },
    [B.SPORE_TURF]:           { name: 'Thảm Nấm Sporefield',   hard: 0.60, solid: true,  dirt: true, drop: B.SPORE_TURF, tiles: [295, 295, 296], mapColor: '#8b5cf6' },
    [B.SIFT_STONE]:           { name: 'Đá Tím Hang Burrows',   hard: 1.85, solid: true,  rock: true, reqTier: 1, drop: B.SIFT_STONE, tiles: [296, 296, 296], mapColor: '#4c2c69' },
    [B.SIFT_LOG]:             { name: 'Gỗ Giấc Mơ (Sift)',     hard: 1.05, solid: true,  wood: true, isLog: true, drop: B.SIFT_LOG, tiles: [297, 298, 297], mapColor: '#cbd5e1' },
    [B.SIFT_LEAVES]:          { name: 'Lá Ngọc Lam Sift',      hard: 0.25, solid: true,  foliage: true, leaves: true, neutralLeaf: true, trans: true, drop: B.DREAM_FRUIT, tiles: [299, 299, 299], mapColor: '#5eead4' },
    [B.LULLABY_LEAVES]:       { name: 'Lá Tuyết Lullaby',      hard: 0.25, solid: true,  foliage: true, leaves: true, neutralLeaf: true, trans: true, drop: B.DREAM_FRUIT, tiles: [300, 300, 300], mapColor: '#99e6e0' },
    [B.SIFT_FLOWER]:          { name: 'Cỏ Hồng Mộng Mơ',       hard: 0.05, solid: false, cross: true, trans: true, instantFruit: true, drop: B.SIFT_FLOWER, tiles: [301, 301, 301], mapColor: '#fb7185' },
    [B.SIFT_BERRY_BUSH]:      { name: 'Bụi Trái Cây Giấc Mơ',  hard: 0.05, solid: false, cross: true, trans: true, instantFruit: true, drop: B.DREAM_FRUIT, tiles: [302, 302, 302], mapColor: '#f472b6' },
    [B.SPORE_SHROOM]:         { name: 'Nấm Phát Sáng Burrows', hard: 0.08, solid: false, cross: true, trans: true, emissive: true, light: 11, drop: B.SPORE_SHROOM, tiles: [303, 303, 303], mapColor: '#38f2ff' },
    [B.ICHOR_ORE]:            { name: 'Quặng Ichor Cầu Vồng',  hard: 22.0, solid: true,  rock: true, oreBlock: true, reqTier: 4, xp: 14, siftOre: true, emissive: false, light: 7, drop: B.ICHOR_CRYSTAL, tiles: [304, 304, 304], mapColor: '#f472b6' },
    [B.AETHERIUM_ORE]:        { name: 'Quặng Aetherium Giấc Mơ', hard: 28.0, solid: true, rock: true, oreBlock: true, reqTier: 4, xp: 18, siftOre: true, emissive: false, light: 9, drop: B.AETHERIUM_ORE, tiles: [305, 305, 305], mapColor: '#22d3ee' },
    [B.ICHOR_CRYSTAL]:        { name: 'Tinh Thể Ichor',        hard: 0, solid: false, voxelItem: true, tiles: [306, 306, 306] },
    [B.AETHERIUM_INGOT]:      { name: 'Thỏi Aetherium',        hard: 0, solid: false, voxelItem: true, tiles: [307, 307, 307] },
    [B.DREAM_FRUIT]:          { name: 'Trái Cây Giấc Mơ',      hard: 0, solid: false, food: true, voxelItem: true, heal: 7, feed: 9, crumbColor: 0xf472b6, tiles: [308, 308, 308] },
    [B.ECHO_SHARD]:           { name: 'Mảnh Vang Echo',        hard: 0, solid: false, voxelItem: true, tiles: [309, 309, 309] },
    [B.ICHOR_PICK]:           { name: 'Cuốc Ichor 7 Màu (Cấp 6)', hard: 0, solid: false, tool: 'pick',  pickTier: 6, voxelItem: true, rainbow: true, mineMul: 14.5, dmg: 6.5,  maxDur: 2400, tiles: [310, 310, 310], mapColor: '#f472b6' },
    [B.ICHOR_SWORD]:          { name: 'Kiếm Ichor 7 Màu',         hard: 0, solid: false, tool: 'sword', voxelItem: true, rainbow: true, mineMul: 3.0,  dmg: 12.5, maxDur: 2400, tiles: [311, 311, 311], mapColor: '#f472b6' },
    [B.ICHOR_AXE]:            { name: 'Rìu Ichor 7 Màu',          hard: 0, solid: false, tool: 'axe',   voxelItem: true, rainbow: true, mineMul: 14.0, dmg: 11.0, maxDur: 2400, tiles: [312, 312, 312], mapColor: '#f472b6' },
    [B.AETHERIUM_PICK]:       { name: 'Cuốc Aetherium 7 Màu (Cấp 7)', hard: 0, solid: false, tool: 'pick',  pickTier: 7, voxelItem: true, rainbow: true, mineMul: 19.5, dmg: 8.0,  maxDur: 3800, tiles: [313, 313, 313], mapColor: '#22d3ee' },
    [B.AETHERIUM_SWORD]:      { name: 'Kiếm Aetherium 7 Màu',     hard: 0, solid: false, tool: 'sword', voxelItem: true, rainbow: true, mineMul: 3.5,  dmg: 16.0, maxDur: 3800, tiles: [314, 314, 314], mapColor: '#22d3ee' },
    [B.AETHERIUM_AXE]:        { name: 'Rìu Aetherium 7 Màu',      hard: 0, solid: false, tool: 'axe',   voxelItem: true, rainbow: true, mineMul: 18.5, dmg: 13.5, maxDur: 3800, tiles: [315, 315, 315], mapColor: '#22d3ee' },
    [B.ICHOR_HELMET]:         { name: 'Mũ Ichor 7 Màu (+5)',      hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 5, toughness: 4, armorTier: 'ichor',     rainbow: true, tiles: [316, 316, 316], mapColor: '#f472b6' },
    [B.ICHOR_CHEST]:          { name: 'Áo Giáp Ichor 7 Màu (+9)', hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 9, toughness: 4, armorTier: 'ichor',     rainbow: true, tiles: [317, 317, 317], mapColor: '#f472b6' },
    [B.ICHOR_LEGS]:           { name: 'Quần Ichor 7 Màu (+7)',    hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 7, toughness: 4, armorTier: 'ichor',     rainbow: true, tiles: [318, 318, 318], mapColor: '#f472b6' },
    [B.ICHOR_BOOTS]:          { name: 'Giày Ichor 7 Màu (+4)',    hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 4, toughness: 4, armorTier: 'ichor',     rainbow: true, tiles: [319, 319, 319], mapColor: '#f472b6' },
    [B.AETHERIUM_HELMET]:     { name: 'Mũ Aetherium 7 Màu (+5)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 5, toughness: 4.5, kbResist: 0.10, armorTier: 'aetherium', rainbow: true, tiles: [320, 320, 320], mapColor: '#22d3ee' },
    [B.AETHERIUM_CHEST]:      { name: 'Áo Giáp Aetherium 7 Màu (+11)', hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest', armorVal: 11, toughness: 4.5, kbResist: 0.10, armorTier: 'aetherium', rainbow: true, tiles: [321, 321, 321], mapColor: '#22d3ee' },
    [B.AETHERIUM_LEGS]:       { name: 'Quần Aetherium 7 Màu (+8)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',  armorVal: 8,  toughness: 4.5, kbResist: 0.10, armorTier: 'aetherium', rainbow: true, tiles: [322, 322, 322], mapColor: '#22d3ee' },
    [B.AETHERIUM_BOOTS]:      { name: 'Giày Aetherium 7 Màu (+5)',     hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots', armorVal: 5,  toughness: 4.5, kbResist: 0.10, armorTier: 'aetherium', rainbow: true, tiles: [323, 323, 323], mapColor: '#22d3ee' },
    // v21 Sugar Cane, Bamboo Block, Bamboo Planks & Complete Minecraft Fences + Stone Walls!
    [B.SUGAR_CANE]:        { name: 'Cây Mía Xanh',               hard: 0.10, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.SUGAR_CANE, tiles: [185, 185, 185], mapColor: '#78cc3a' },
    [B.BAMBOO_BLOCK]:      { name: 'Khối Tre Bó (9 Tre)',        hard: 0.85, solid: true, wood: true, isLog: true, drop: B.BAMBOO_BLOCK, tiles: [189, 190, 189], mapColor: '#5c8f2b' },
    [B.BAMBOO_PLANKS]:     { name: 'Ván Gỗ Tre Vàng',            hard: 0.72, solid: true, wood: true, isPlanks: true, drop: B.BAMBOO_PLANKS, tiles: [191, 191, 191], mapColor: '#d9c25b' },
    [B.OAK_FENCE]:         { name: 'Hàng Rào Gỗ Sồi',            hard: 0.75, solid: true, wood: true, fence: true, trans: true, drop: B.OAK_FENCE,      tiles: [8, 8, 8],       mapColor: '#b98952' },
    [B.SPRUCE_FENCE]:      { name: 'Hàng Rào Gỗ Thông',          hard: 0.75, solid: true, wood: true, fence: true, trans: true, drop: B.SPRUCE_FENCE,   tiles: [12, 12, 12],    mapColor: '#5e3f22' },
    [B.BIRCH_FENCE]:       { name: 'Hàng Rào Gỗ Bạch Dương',     hard: 0.75, solid: true, wood: true, fence: true, trans: true, drop: B.BIRCH_FENCE,    tiles: [16, 16, 16],    mapColor: '#dfd9ce' },
    [B.SAKURA_FENCE]:      { name: 'Hàng Rào Gỗ Anh Đào',        hard: 0.75, solid: true, wood: true, fence: true, trans: true, drop: B.SAKURA_FENCE,   tiles: [15, 14, 15],    mapColor: '#e8a2c4' },
    [B.BAMBOO_FENCE]:      { name: 'Hàng Rào Gỗ Tre',            hard: 0.65, solid: true, wood: true, fence: true, trans: true, drop: B.BAMBOO_FENCE,   tiles: [191, 191, 191], mapColor: '#d9c25b' },
    [B.NETHER_FENCE]:      { name: 'Hàng Rào Gạch Địa Ngục',     hard: 1.40, solid: true, rock: true, fence: true, trans: true, drop: B.NETHER_FENCE,   tiles: [76, 76, 76],    mapColor: '#3a1a22' },
    [B.STONE_WALL]:        { name: 'Tường Rào Đá Cuội',          hard: 1.35, solid: true, rock: true, wall: true,  trans: true, drop: B.STONE_WALL,     tiles: [3, 3, 3],       mapColor: '#7c848c' },
    [B.STONE_BRICK_WALL]:  { name: 'Tường Rào Gạch Đá',          hard: 1.45, solid: true, rock: true, wall: true,  trans: true, drop: B.STONE_BRICK_WALL, tiles: [33, 33, 33],  mapColor: '#8d969f' },
    [B.DEEPSLATE_WALL]:    { name: 'Tường Rào Đá Phiến Sâu',     hard: 1.75, solid: true, rock: true, wall: true,  trans: true, drop: B.DEEPSLATE_WALL, tiles: [21, 21, 21],    mapColor: '#484d56' },
    // v22 2-Block Authentic Bed Foot, Bamboo Shoot, Lush Cave Moss & Glow Vines, Crimson Maple Leaves, Mineshaft Cobweb & Rails, End Crystal!
    [B.BED_FOOT]:          { name: 'Giường Ngủ Đỏ (Chân Giường)', hard: 0.35, solid: true, wood: true, bed: true, bedFoot: true, bedPartner: B.BED, bedColorKey: 'red', bedHex: '#dc2626', bedDarkHex: '#991b1b', bedLightHex: '#f87171', bedBlanketTile: 194, bedSideTile: 195, trans: true, interactive: true, drop: B.BED, tiles: [194, 195, 8], mapColor: '#dc2626' },
    [B.BAMBOO_SHOOT]:      { name: 'Măng Tre Non (Cầm/Trồng)',   hard: 0.10, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.BAMBOO, tiles: [192, 192, 192], mapColor: '#6d8f28' },
    [B.GLOW_VINES]:        { name: 'Dây Leo Quả Phát Sáng',      hard: 0.10, solid: false, cross: true, foliage: true, emissive: true, hanging: true, drop: B.GLOW_VINES, tiles: [198, 198, 198], mapColor: '#f59e0b' },
    [B.MOSS_BLOCK]:        { name: 'Rêu Xanh Hang Tươi Tốt',     hard: 0.35, solid: true,  dirt: true, drop: B.MOSS_BLOCK, tiles: [197, 197, 197], mapColor: '#4d8a2d' },
    [B.CRIMSON_MAPLE_LEAVES]: { name: 'Lá Phong Đỏ Cổ Thụ',      hard: 0.25, solid: true,  foliage: true, neutralLeaf: true, shearsOnly: true, drop: B.CRIMSON_MAPLE_LEAVES, tiles: [199, 199, 199], mapColor: '#c41e1e' },
    [B.COBWEB]:            { name: 'Mạng Nhện Hầm Mỏ',           hard: 0.22, solid: false, cross: true, drop: B.STICK, tiles: [200, 200, 200], mapColor: '#e2e8f0' },
    [B.RAIL]:              { name: 'Đường Ray Hầm Mỏ',           hard: 0.35, solid: false, cross: true, flatTrack: true, drop: B.RAIL, tiles: [201, 201, 201], mapColor: '#94a3b8' },
    [B.END_CRYSTAL_BLOCK]: { name: 'Pha Lê End (End Crystal)',   hard: 0.15, solid: true,  rock: true, emissive: true, trans: true, voxelItem: true, endCrystal: true, drop: 0, tiles: [202, 202, 202], itemTile: 438, mapColor: '#e879f9' },
    // v23.0 Wheat Crops, Melons, Fruits, Autumn Biome Blocks, Smelted Ingots, 3 Furnaces, 5 Animated 3D Chests, 5 Doors & 4 Trapdoors!
    [B.WHEAT_SEEDS]:       { name: 'Hạt Giống Lúa Mì',           hard: 0,    solid: false, itemOnly: true, voxelItem: true, seedCrop: 194, tiles: [203, 203, 203], mapColor: '#65a30d' },
    [B.WHEAT]:             { name: 'Bông Lúa Mì Chín',           hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [204, 204, 204], mapColor: '#eab308' },
    [B.WHEAT_0]:           { name: 'Lúa Mì Non (Giai Đoạn 1)',   hard: 0.08, solid: false, cross: true, foliage: true, cropStage: 0, drop: 192, tiles: [205, 205, 205], mapColor: '#4ade80' },
    [B.WHEAT_1]:           { name: 'Lúa Mì Mọc (Giai Đoạn 2)',   hard: 0.08, solid: false, cross: true, foliage: true, cropStage: 1, drop: 192, tiles: [206, 206, 206], mapColor: '#65a30d' },
    [B.WHEAT_2]:           { name: 'Lúa Mì Trổ Bông (GĐ 3)',     hard: 0.08, solid: false, cross: true, foliage: true, cropStage: 2, drop: 192, tiles: [207, 207, 207], mapColor: '#a3a826' },
    [B.WHEAT_3]:           { name: 'Lúa Mì Chín Vàng (Thu Hoạch)',hard: 0.10,solid: false, cross: true, foliage: true, cropStage: 3, drop: 193, tiles: [208, 208, 208], mapColor: '#eab308' },
    [B.FARMLAND]:          { name: 'Đất Ruộng Ẩm (Trồng Trọt)',  hard: 0.55, solid: true,  dirt: true, drop: B.DIRT, tiles: [209, 2, 2], mapColor: '#5c3a21' },
    [B.MELON_BLOCK]:       { name: 'Quả Dưa Hấu Khổng Lồ',       hard: 0.65, solid: true,  wood: true, drop: 200, dropQty: 4, tiles: [210, 211, 210], mapColor: '#65a30d' },
    [B.MELON_SLICE]:       { name: 'Miếng Dưa Hấu Đỏ Mọng',      hard: 0,    solid: false, food: true, voxelItem: true, heal: 3, feed: 4, tiles: [212, 212, 212], mapColor: '#ef4444', crumbColor: 0xef4444 },
    [B.PEACH]:             { name: 'Quả Đào Hồng Ngọt',          hard: 0.14, solid: false, hangingFruit: true, food: true, voxelItem: true, heal: 4, feed: 5, drop: 201, tiles: [213, 213, 213], mapColor: '#fb7185', crumbColor: 0xfb7185 },
    [B.MANGO]:             { name: 'Quả Xoài Vàng Chín',         hard: 0.14, solid: false, hangingFruit: true, food: true, voxelItem: true, heal: 4, feed: 5, drop: 202, tiles: [214, 214, 214], mapColor: '#f59e0b', crumbColor: 0xf59e0b },
    [B.BLUEBERRY]:         { name: 'Quả Việt Quất Xanh',         hard: 0.14, solid: false, cross: true, food: true, voxelItem: true, heal: 3, feed: 4, drop: 203, tiles: [215, 215, 215], mapColor: '#3b82f6', crumbColor: 0x3b82f6 },
    [B.AUTUMN_GRASS]:      { name: 'Cỏ Mùa Thu Vàng Cam',        hard: 0.08, solid: false, cross: true, foliage: true, tiles: [216, 216, 216], mapColor: '#d97706' },
    [B.AUTUMN_BUSH]:       { name: 'Bụi Cây Thu Đỏ Rực',         hard: 0.12, solid: false, cross: true, foliage: true, drop: 205, tiles: [217, 217, 217], mapColor: '#ea580c' },
    [B.AUTUMN_PODZOL]:     { name: 'Đất Lá Rụng Mùa Thu',        hard: 0.55, solid: true,  dirt: true, drop: B.DIRT, tiles: [218, 219, 2], mapColor: '#a85a22' },
    [B.IRON_INGOT]:        { name: 'Thỏi Sắt Tinh Luyện',        hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [220, 220, 220], mapColor: '#e2e8f0' },
    [B.GOLD_INGOT]:        { name: 'Thỏi Vàng Tinh Luyện',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [221, 221, 221], mapColor: '#facc15' },
    [B.COPPER_INGOT]:      { name: 'Thỏi Đồng Tinh Luyện',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [222, 222, 222], mapColor: '#ea7c42' },
    [B.SMOOTH_STONE]:      { name: 'Đá Mịn Nung Chín',           hard: 1.55, solid: true,  rock: true, reqTier: 1, drop: 210, tiles: [223, 223, 223], mapColor: '#9ca3af' },
    [B.LAPIS_ORE]:         { name: 'Quặng Ngọc Lưu Ly (Cúp Đá+)',hard: 2.00, solid: true,  rock: true, oreBlock: true, reqTier: 2, xp: 5, drop: 211, tiles: [224, 224, 224], mapColor: '#2563eb' },
    [B.QUARTZ_ORE]:        { name: 'Quặng Thạch Anh (Cúp Sắt+)', hard: 2.15, solid: true,  rock: true, oreBlock: true, reqTier: 3, xp: 5, drop: 212, tiles: [225, 225, 225], mapColor: '#f1f5f9' },
    [B.RAW_BEEF]:          { name: 'Thịt Bò Tươi Sống',          hard: 0,    solid: false, food: true, voxelItem: true, heal: 2, feed: 3, tiles: [226, 226, 226], mapColor: '#dc2626' },
    [B.COOKED_BEEF]:       { name: 'Bít Tết Nướng Thơm Lừng',    hard: 0,    solid: false, food: true, voxelItem: true, heal: 8, feed: 10, tiles: [227, 227, 227], mapColor: '#7c2d12' },
    [B.BLAST_FURNACE]:     { name: 'Lò Luyện Kim (Nung Quặng ×2)',hard: 1.80,solid: true,  rock: true, reqTier: 1, furnaceType: 'blast', interactive: true, drop: 215, tiles: [228, 440, 228], frontTile: 229, customAtlasTex: true, mapColor: '#475569' },
    [B.SMOKER]:            { name: 'Lò Hun Khói (Nướng Ăn ×2)',  hard: 1.50, solid: true,  rock: true, reqTier: 1, furnaceType: 'smoker', interactive: true, drop: 216, tiles: [230, 441, 59], frontTile: 231, customAtlasTex: true, mapColor: '#6d4c2f' },
    [B.IRON_CHEST]:        { name: 'Rương Sắt Bạc (36 Ô)',       hard: 1.50, solid: true,  rock: true, chest: true, chestSlots: 36, chestTier: 'iron', trans: true, interactive: true, drop: 217, tiles: [232, 233, 232], mapColor: '#cbd5e1' },
    [B.GOLD_CHEST]:        { name: 'Rương Vàng Hoàng Gia (45 Ô)',hard: 1.65, solid: true,  rock: true, chest: true, chestSlots: 45, chestTier: 'gold', trans: true, interactive: true, drop: 218, tiles: [234, 235, 234], mapColor: '#facc15' },
    [B.DIAMOND_CHEST]:     { name: 'Rương Kim Cương (54 Ô)',     hard: 2.10, solid: true,  rock: true, chest: true, chestSlots: 54, chestTier: 'diamond', trans: true, interactive: true, drop: 219, tiles: [236, 237, 236], mapColor: '#22d3ee' },
    [B.NETHERITE_CHEST]:   { name: 'Rương Netherite Chống Nổ (63 Ô)',hard: 3.20,solid: true, rock: true, chest: true, chestSlots: 63, chestTier: 'netherite', blastProof: true, blastResist: true, fireImmune: true, trans: true, interactive: true, drop: 220, tiles: [238, 239, 238], mapColor: '#3b2e4a' },
    [B.OAK_DOOR]:          { name: 'Cửa Gỗ Sồi (Chuột Phải Mở)', hard: 0.70, solid: true,  wood: true, door: true, doorTier: 'oak', trans: true, interactive: true, drop: 221, tiles: [240, 240, 240], mapColor: '#b98952' },
    [B.SPRUCE_DOOR]:       { name: 'Cửa Gỗ Thông Cổ Điển',       hard: 0.75, solid: true,  wood: true, door: true, doorTier: 'spruce', trans: true, interactive: true, drop: 222, tiles: [241, 241, 241], mapColor: '#5c3c22' },
    [B.BIRCH_DOOR]:        { name: 'Cửa Gỗ Bạch Dương',          hard: 0.70, solid: true,  wood: true, door: true, doorTier: 'birch', trans: true, interactive: true, drop: 223, tiles: [242, 242, 242], mapColor: '#dfd9ce' },
    [B.BAMBOO_DOOR]:       { name: 'Cửa Gỗ Tre Thanh Lịch',      hard: 0.65, solid: true,  wood: true, door: true, doorTier: 'bamboo', trans: true, interactive: true, drop: 224, tiles: [243, 243, 243], mapColor: '#d9c25b' },
    [B.IRON_DOOR]:         { name: 'Cửa Sắt Kiên Cố',            hard: 1.85, solid: true,  rock: true, door: true, doorTier: 'iron', trans: true, interactive: true, drop: 225, tiles: [244, 244, 244], mapColor: '#e2e8f0' },
    [B.OAK_TRAPDOOR]:      { name: 'Cửa Sập Gỗ Sồi',             hard: 0.65, solid: true,  wood: true, trapdoor: true, doorTier: 'oak', trans: true, interactive: true, drop: 226, tiles: [245, 245, 245], mapColor: '#b98952' },
    [B.SPRUCE_TRAPDOOR]:   { name: 'Cửa Sập Gỗ Thông',           hard: 0.68, solid: true,  wood: true, trapdoor: true, doorTier: 'spruce', trans: true, interactive: true, drop: 227, tiles: [246, 246, 246], mapColor: '#5c3c22' },
    [B.SAKURA_TRAPDOOR]:   { name: 'Cửa Sập Hoa Anh Đào',        hard: 0.65, solid: true,  wood: true, trapdoor: true, doorTier: 'sakura', trans: true, interactive: true, drop: 228, tiles: [247, 247, 247], mapColor: '#f4a9c8' },
    [B.IRON_TRAPDOOR]:     { name: 'Cửa Sập Sắt',                hard: 1.70, solid: true,  rock: true, trapdoor: true, doorTier: 'iron', trans: true, interactive: true, drop: 229, tiles: [248, 248, 248], mapColor: '#cbd5e1' },
    [B.WHITE_WOOL]:        { name: 'Len Trắng (Vải Lều Trắng)',  hard: 0.32, solid: true,  wood: true, isWool: true, woolColor: 'white', drop: 230, tiles: [249, 249, 249], mapColor: '#f1f5f9' },
    // v29: Cầu thang gỗ sồi & gạch đá (khối bậc thang thật — tự chọn hướng theo góc nhìn khi đặt)
    [B.OAK_STAIRS_N]:      { name: 'Cầu Thang Gỗ Sồi',           hard: 0.75, solid: true,  wood: true, stairs: true, stairDir: 0, stairBase: B.OAK_STAIRS_N, trans: true, drop: B.OAK_STAIRS_N,   tiles: [8, 8, 8],     mapColor: '#b98952' },
    [B.OAK_STAIRS_S]:      { name: 'Cầu Thang Gỗ Sồi',           hard: 0.75, solid: true,  wood: true, stairs: true, stairDir: 1, stairBase: B.OAK_STAIRS_N, trans: true, drop: B.OAK_STAIRS_N,   tiles: [8, 8, 8],     mapColor: '#b98952' },
    [B.OAK_STAIRS_E]:      { name: 'Cầu Thang Gỗ Sồi',           hard: 0.75, solid: true,  wood: true, stairs: true, stairDir: 2, stairBase: B.OAK_STAIRS_N, trans: true, drop: B.OAK_STAIRS_N,   tiles: [8, 8, 8],     mapColor: '#b98952' },
    [B.OAK_STAIRS_W]:      { name: 'Cầu Thang Gỗ Sồi',           hard: 0.75, solid: true,  wood: true, stairs: true, stairDir: 3, stairBase: B.OAK_STAIRS_N, trans: true, drop: B.OAK_STAIRS_N,   tiles: [8, 8, 8],     mapColor: '#b98952' },
    [B.STONE_STAIRS_N]:    { name: 'Cầu Thang Gạch Đá',          hard: 1.40, solid: true,  rock: true, stairs: true, stairDir: 0, stairBase: B.STONE_STAIRS_N, trans: true, drop: B.STONE_STAIRS_N, tiles: [33, 33, 33],  mapColor: '#8d959e' },
    [B.STONE_STAIRS_S]:    { name: 'Cầu Thang Gạch Đá',          hard: 1.40, solid: true,  rock: true, stairs: true, stairDir: 1, stairBase: B.STONE_STAIRS_N, trans: true, drop: B.STONE_STAIRS_N, tiles: [33, 33, 33],  mapColor: '#8d959e' },
    [B.STONE_STAIRS_E]:    { name: 'Cầu Thang Gạch Đá',          hard: 1.40, solid: true,  rock: true, stairs: true, stairDir: 2, stairBase: B.STONE_STAIRS_N, trans: true, drop: B.STONE_STAIRS_N, tiles: [33, 33, 33],  mapColor: '#8d959e' },
    [B.STONE_STAIRS_W]:    { name: 'Cầu Thang Gạch Đá',          hard: 1.40, solid: true,  rock: true, stairs: true, stairDir: 3, stairBase: B.STONE_STAIRS_N, trans: true, drop: B.STONE_STAIRS_N, tiles: [33, 33, 33],  mapColor: '#8d959e' },
    [B.TERRACOTTA_STAIRS_N]: { name: 'Cầu Thang Ngói Đất Nung',  hard: 1.25, solid: true,  rock: true, stairs: true, stairDir: 0, stairBase: B.TERRACOTTA_STAIRS_N, trans: true, drop: B.TERRACOTTA_STAIRS_N, tiles: [18, 18, 18], mapColor: '#b85c3e' },
    [B.TERRACOTTA_STAIRS_S]: { name: 'Cầu Thang Ngói Đất Nung',  hard: 1.25, solid: true,  rock: true, stairs: true, stairDir: 1, stairBase: B.TERRACOTTA_STAIRS_N, trans: true, drop: B.TERRACOTTA_STAIRS_N, tiles: [18, 18, 18], mapColor: '#b85c3e' },
    [B.TERRACOTTA_STAIRS_E]: { name: 'Cầu Thang Ngói Đất Nung',  hard: 1.25, solid: true,  rock: true, stairs: true, stairDir: 2, stairBase: B.TERRACOTTA_STAIRS_N, trans: true, drop: B.TERRACOTTA_STAIRS_N, tiles: [18, 18, 18], mapColor: '#b85c3e' },
    [B.TERRACOTTA_STAIRS_W]: { name: 'Cầu Thang Ngói Đất Nung',  hard: 1.25, solid: true,  rock: true, stairs: true, stairDir: 3, stairBase: B.TERRACOTTA_STAIRS_N, trans: true, drop: B.TERRACOTTA_STAIRS_N, tiles: [18, 18, 18], mapColor: '#b85c3e' },
    [B.DEEPSLATE_STAIRS_N]: { name: 'Cầu Thang Đá Phiến',        hard: 1.60, solid: true,  rock: true, stairs: true, stairDir: 0, stairBase: B.DEEPSLATE_STAIRS_N, trans: true, drop: B.DEEPSLATE_STAIRS_N, tiles: [22, 22, 22], mapColor: '#3c414a' },
    [B.DEEPSLATE_STAIRS_S]: { name: 'Cầu Thang Đá Phiến',        hard: 1.60, solid: true,  rock: true, stairs: true, stairDir: 1, stairBase: B.DEEPSLATE_STAIRS_N, trans: true, drop: B.DEEPSLATE_STAIRS_N, tiles: [22, 22, 22], mapColor: '#3c414a' },
    [B.DEEPSLATE_STAIRS_E]: { name: 'Cầu Thang Đá Phiến',        hard: 1.60, solid: true,  rock: true, stairs: true, stairDir: 2, stairBase: B.DEEPSLATE_STAIRS_N, trans: true, drop: B.DEEPSLATE_STAIRS_N, tiles: [22, 22, 22], mapColor: '#3c414a' },
    [B.DEEPSLATE_STAIRS_W]: { name: 'Cầu Thang Đá Phiến',        hard: 1.60, solid: true,  rock: true, stairs: true, stairDir: 3, stairBase: B.DEEPSLATE_STAIRS_N, trans: true, drop: B.DEEPSLATE_STAIRS_N, tiles: [22, 22, 22], mapColor: '#3c414a' },
    // ===== v24 ITEMS =====
    [B.SHEARS]:            { name: 'Kéo Cắt Lá',                 hard: 0,    solid: false, itemOnly: true, voxelItem: true, tool: 'shears', maxDur: 238, tiles: [250, 250, 250], mapColor: '#cbd5e1' },
    [B.DIAMOND]:           { name: 'Kim Cương',                  hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [251, 251, 251], mapColor: '#22d3ee' },
    [B.EMERALD]:           { name: 'Ngọc Lục Bảo',               hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [253, 253, 253], mapColor: '#10b981' },
    [B.RUBY]:              { name: 'Hồng Ngọc',                  hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [254, 254, 254], mapColor: '#f43f5e' },
    [B.TITANIUM_INGOT]:    { name: 'Thỏi Netherite',             hard: 0,    solid: false, itemOnly: true, voxelItem: true, fireImmune: true, tiles: [358, 358, 358], mapColor: '#4a4347' },
    [B.COAL]:              { name: 'Than Đá',                    hard: 0,    solid: false, itemOnly: true, voxelItem: true, isCoal: true, tiles: [252, 252, 252], mapColor: '#334155' },
    [B.RAW_IRON]:          { name: 'Phôi Sắt Thô',               hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [220, 220, 220], mapColor: '#d8af93' },
    [B.RAW_GOLD]:          { name: 'Phôi Vàng Thô',              hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [221, 221, 221], mapColor: '#facc15' },
    [B.RAW_COPPER]:        { name: 'Phôi Đồng Thô',              hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [222, 222, 222], mapColor: '#ea7c42' },
    // v67 New Sift Ores, Dream Tools & 6 New Armor Sets (Static Overworld + 7-Color Rainbow Dream Sets!)
    [B.MOONSTONE_ORE]:     { name: 'Quặng Đá Mặt Trăng Giấc Mơ', hard: 18.0, solid: true,  rock: true, oreBlock: true, reqTier: 4, xp: 10, siftOre: true, light: 7, drop: B.MOONSTONE_GEM, tiles: [328, 328, 328], mapColor: '#a5b4fc' },
    [B.NEBULA_ORE]:        { name: 'Quặng Tinh Vân Giấc Mơ',     hard: 24.0, solid: true,  rock: true, oreBlock: true, reqTier: 4, xp: 16, siftOre: true, light: 8, drop: B.NEBULA_ORE,    tiles: [329, 329, 329], mapColor: '#a855f7' },
    [B.DREAM_PRISM_ORE]:   { name: 'Quặng Lăng Kính 7 Màu',      hard: 30.0, solid: true,  rock: true, oreBlock: true, reqTier: 4, xp: 22, siftOre: true, light: 10, rainbow: true, drop: B.DREAM_PRISM_GEM, tiles: [330, 330, 330], mapColor: '#f43f5e' },
    [B.MOONSTONE_GEM]:     { name: 'Ngọc Mặt Trăng (Moonstone)', hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [331, 331, 331], mapColor: '#a5b4fc' },
    [B.NEBULA_INGOT]:      { name: 'Thỏi Tinh Vân (Nebula)',     hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [332, 332, 332], mapColor: '#c084fc' },
    [B.DREAM_PRISM_GEM]:   { name: 'Lăng Kính Giấc Mơ 7 Màu',    hard: 0,    solid: false, itemOnly: true, voxelItem: true, rainbow: true, tiles: [333, 333, 333], mapColor: '#ef4444' },
    [B.MOONSTONE_PICK]:    { name: 'Cuốc Mặt Trăng 7 Màu (Cấp 6)',hard: 0,    solid: false, tool: 'pick',   pickTier: 6, voxelItem: true, rainbow: true, mineMul: 13.5, dmg: 6.0,  maxDur: 2200, tiles: [334, 334, 334], mapColor: '#818cf8' },
    [B.MOONSTONE_SWORD]:   { name: 'Kiếm Ánh Trăng 7 Màu',       hard: 0,    solid: false, tool: 'sword',  voxelItem: true, rainbow: true, mineMul: 2.8,  dmg: 11.5, maxDur: 2200, tiles: [335, 335, 335], mapColor: '#818cf8' },
    [B.MOONSTONE_AXE]:     { name: 'Rìu Mặt Trăng 7 Màu',        hard: 0,    solid: false, tool: 'axe',    voxelItem: true, rainbow: true, mineMul: 13.0, dmg: 10.5, maxDur: 2200, tiles: [336, 336, 336], mapColor: '#818cf8' },
    [B.MOONSTONE_SHOVEL]:  { name: 'Xẻng Mặt Trăng 7 Màu',       hard: 0,    solid: false, tool: 'shovel', voxelItem: true, rainbow: true, mineMul: 13.5, dmg: 5.5,  maxDur: 2200, tiles: [337, 337, 337], mapColor: '#818cf8' },
    [B.NEBULA_PICK]:       { name: 'Cuốc Tinh Vân 7 Màu (Cấp 7)', hard: 0,    solid: false, tool: 'pick',   pickTier: 7, voxelItem: true, rainbow: true, mineMul: 18.0, dmg: 7.5,  maxDur: 3400, tiles: [338, 338, 338], mapColor: '#c084fc' },
    [B.NEBULA_SWORD]:      { name: 'Kiếm Tinh Vân 7 Màu',        hard: 0,    solid: false, tool: 'sword',  voxelItem: true, rainbow: true, mineMul: 3.4,  dmg: 15.0, maxDur: 3400, tiles: [339, 339, 339], mapColor: '#c084fc' },
    [B.NEBULA_AXE]:        { name: 'Rìu Tinh Vân 7 Màu',         hard: 0,    solid: false, tool: 'axe',    voxelItem: true, rainbow: true, mineMul: 17.5, dmg: 13.0, maxDur: 3400, tiles: [340, 340, 340], mapColor: '#c084fc' },
    [B.NEBULA_SHOVEL]:     { name: 'Xẻng Tinh Vân 7 Màu',        hard: 0,    solid: false, tool: 'shovel', voxelItem: true, rainbow: true, mineMul: 18.0, dmg: 6.5,  maxDur: 3400, tiles: [341, 341, 341], mapColor: '#c084fc' },
    [B.DREAM_PRISM_PICK]:  { name: 'Cuốc Lăng Kính 7 Màu (Cấp 8)', hard: 0,  solid: false, tool: 'pick',   pickTier: 8, voxelItem: true, rainbow: true, mineMul: 24.0, dmg: 9.5,  maxDur: 5000, tiles: [342, 342, 342], mapColor: '#ef4444' },
    [B.DREAM_PRISM_SWORD]: { name: 'Kiếm Lăng Kính 7 Màu',       hard: 0,    solid: false, tool: 'sword',  voxelItem: true, rainbow: true, mineMul: 4.0,  dmg: 20.0, maxDur: 5000, tiles: [343, 343, 343], mapColor: '#ef4444' },
    [B.DREAM_PRISM_AXE]:   { name: 'Rìu Lăng Kính 7 Màu',        hard: 0,    solid: false, tool: 'axe',    voxelItem: true, rainbow: true, mineMul: 22.0, dmg: 16.5, maxDur: 5000, tiles: [344, 344, 344], mapColor: '#ef4444' },
    [B.DREAM_PRISM_SHOVEL]:{ name: 'Xẻng Lăng Kính 7 Màu',       hard: 0,    solid: false, tool: 'shovel', voxelItem: true, rainbow: true, mineMul: 24.0, dmg: 8.0,  maxDur: 5000, tiles: [345, 345, 345], mapColor: '#ef4444' },
    [B.EMERALD_HELMET]:    { name: 'Mũ Ngọc Lục Bảo (+3)',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 3, toughness: 1,   armorTier: 'emerald',  tiles: [316, 316, 316], mapColor: '#10b981' },
    [B.EMERALD_CHEST]:     { name: 'Áo Giáp Lục Bảo (+7)',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 7, toughness: 1,   armorTier: 'emerald',  tiles: [317, 317, 317], mapColor: '#10b981' },
    [B.EMERALD_LEGS]:      { name: 'Quần Ngọc Lục Bảo (+5)',     hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 5, toughness: 1,   armorTier: 'emerald',  tiles: [318, 318, 318], mapColor: '#10b981' },
    [B.EMERALD_BOOTS]:     { name: 'Giày Ngọc Lục Bảo (+2)',     hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 2, toughness: 1,   armorTier: 'emerald',  tiles: [319, 319, 319], mapColor: '#10b981' },
    [B.AMETHYST_HELMET]:   { name: 'Mũ Thạch Anh Tím (+3)',      hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 3, toughness: 1.5, armorTier: 'amethyst', tiles: [316, 316, 316], mapColor: '#a855f7' },
    [B.AMETHYST_CHEST]:    { name: 'Áo Giáp Thạch Anh Tím (+7)', hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 7, toughness: 1.5, armorTier: 'amethyst', tiles: [317, 317, 317], mapColor: '#a855f7' },
    [B.AMETHYST_LEGS]:     { name: 'Quần Thạch Anh Tím (+6)',    hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 6, toughness: 1.5, armorTier: 'amethyst', tiles: [318, 318, 318], mapColor: '#a855f7' },
    [B.AMETHYST_BOOTS]:    { name: 'Giày Thạch Anh Tím (+2)',    hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 2, toughness: 1.5, armorTier: 'amethyst', tiles: [319, 319, 319], mapColor: '#a855f7' },
    [B.OBSIDIAN_HELMET]:   { name: 'Mũ Hắc Diện Thạch (+3)',     hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 3, toughness: 2, kbResist: 0.05, armorTier: 'obsidian', tiles: [316, 316, 316], mapColor: '#4338ca' },
    [B.OBSIDIAN_CHEST]:    { name: 'Áo Giáp Hắc Diện (+7)',      hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 7, toughness: 2, kbResist: 0.05, armorTier: 'obsidian', tiles: [317, 317, 317], mapColor: '#4338ca' },
    [B.OBSIDIAN_LEGS]:     { name: 'Quần Hắc Diện Thạch (+6)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 6, toughness: 2, kbResist: 0.05, armorTier: 'obsidian', tiles: [318, 318, 318], mapColor: '#4338ca' },
    [B.OBSIDIAN_BOOTS]:    { name: 'Giày Hắc Diện Thạch (+3)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 3, toughness: 2, kbResist: 0.05, armorTier: 'obsidian', tiles: [319, 319, 319], mapColor: '#4338ca' },
    [B.MOONSTONE_HELMET]:  { name: 'Mũ Mặt Trăng 7 Màu (+4)',    hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 4, toughness: 3.5, armorTier: 'moonstone',   rainbow: true, tiles: [316, 316, 316], mapColor: '#ef4444' },
    [B.MOONSTONE_CHEST]:   { name: 'Áo Giáp Mặt Trăng 7 Màu (+9)',hard: 0,   solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 9, toughness: 3.5, armorTier: 'moonstone',   rainbow: true, tiles: [317, 317, 317], mapColor: '#ef4444' },
    [B.MOONSTONE_LEGS]:    { name: 'Quần Mặt Trăng 7 Màu (+7)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 7, toughness: 3.5, armorTier: 'moonstone',   rainbow: true, tiles: [318, 318, 318], mapColor: '#ef4444' },
    [B.MOONSTONE_BOOTS]:   { name: 'Giày Mặt Trăng 7 Màu (+4)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 4, toughness: 3.5, armorTier: 'moonstone',   rainbow: true, tiles: [319, 319, 319], mapColor: '#ef4444' },
    [B.NEBULA_HELMET]:     { name: 'Mũ Tinh Vân 7 Màu (+5)',     hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 5,  toughness: 4, kbResist: 0.08, armorTier: 'nebula',      rainbow: true, tiles: [320, 320, 320], mapColor: '#ef4444' },
    [B.NEBULA_CHEST]:      { name: 'Áo Giáp Tinh Vân 7 Màu (+10)',hard: 0,   solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 10, toughness: 4, kbResist: 0.08, armorTier: 'nebula',      rainbow: true, tiles: [321, 321, 321], mapColor: '#ef4444' },
    [B.NEBULA_LEGS]:       { name: 'Quần Tinh Vân 7 Màu (+8)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 8,  toughness: 4, kbResist: 0.08, armorTier: 'nebula',      rainbow: true, tiles: [322, 322, 322], mapColor: '#ef4444' },
    [B.NEBULA_BOOTS]:      { name: 'Giày Tinh Vân 7 Màu (+4)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 4,  toughness: 4, kbResist: 0.08, armorTier: 'nebula',      rainbow: true, tiles: [323, 323, 323], mapColor: '#ef4444' },
    [B.DREAM_PRISM_HELMET]:{ name: 'Mũ Lăng Kính 7 Màu (+6)',    hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 6,  toughness: 5, kbResist: 0.12, armorTier: 'dream_prism', rainbow: true, tiles: [320, 320, 320], mapColor: '#ef4444' },
    [B.DREAM_PRISM_CHEST]: { name: 'Áo Giáp Lăng Kính 7 Màu (+12)',hard: 0,  solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 12, toughness: 5, kbResist: 0.12, armorTier: 'dream_prism', rainbow: true, tiles: [321, 321, 321], mapColor: '#ef4444' },
    [B.DREAM_PRISM_LEGS]:  { name: 'Quần Lăng Kính 7 Màu (+9)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 9,  toughness: 5, kbResist: 0.12, armorTier: 'dream_prism', rainbow: true, tiles: [322, 322, 322], mapColor: '#ef4444' },
    [B.DREAM_PRISM_BOOTS]: { name: 'Giày Lăng Kính 7 Màu (+5)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 5,  toughness: 5, kbResist: 0.12, armorTier: 'dream_prism', rainbow: true, tiles: [323, 323, 323], mapColor: '#ef4444' },
    // v70 Upgraded Ore Storage Chests (Double Chest Capable!)
    [B.COPPER_BOX_CHEST]:  { name: 'Rương Đồng (36 Ô)',           hard: 1.35, solid: true, rock: true, chest: true, chestSlots: 36, chestTier: 'copper',  trans: true, interactive: true, drop: 384, tiles: [346, 347, 346], mapColor: '#d97745' },
    [B.EMERALD_BOX_CHEST]: { name: 'Rương Ngọc Lục Bảo (54 Ô)',   hard: 2.00, solid: true, rock: true, chest: true, chestSlots: 54, chestTier: 'emerald', trans: true, interactive: true, drop: 385, tiles: [348, 349, 348], mapColor: '#10b981' },
    [B.RUBY_BOX_CHEST]:    { name: 'Rương Hồng Ngọc Ruby (54 Ô)', hard: 2.10, solid: true, rock: true, chest: true, chestSlots: 54, chestTier: 'ruby',    trans: true, interactive: true, drop: 386, tiles: [350, 351, 350], mapColor: '#e11d48' },
    [B.DREAM_BOX_CHEST]:   { name: 'Rương Lăng Kính 7 Màu (72 Ô)',hard: 2.80, solid: true, rock: true, chest: true, chestSlots: 72, chestTier: 'dream',   rainbow: true, trans: true, interactive: true, drop: 387, tiles: [352, 353, 352], mapColor: '#69b8ff' },
    // v79 Charcoal, Netherite Scrap, Smithing Table, Netherite Axe/Shovel & Smithing Templates
    [B.CHARCOAL]:          { name: 'Than Củi (Charcoal)',        hard: 0,    solid: false, itemOnly: true, voxelItem: true, isCoal: true, tiles: [354, 354, 354], mapColor: '#443831' },
    [B.NETHERITE_SCRAP]:   { name: 'Phế Liệu Netherite',         hard: 0,    solid: false, itemOnly: true, voxelItem: true, fireImmune: true, tiles: [357, 357, 357], mapColor: '#5a3b33' },
    [B.SMITHING_TABLE]:    { name: 'Bàn Rèn (Smithing Table)',   hard: 1.40, solid: true,  wood: true, interactive: true, smithing: true, drop: B.SMITHING_TABLE, tiles: [359, 360, 361], frontTile: 371, bothZFront: true, customAtlasTex: true, mapColor: '#3f2e36' },
    [B.NETHERITE_AXE]:     { name: 'Rìu Netherite',              hard: 0,    solid: false, tool: 'axe',    voxelItem: true, fireImmune: true, mineMul: 9.0, dmg: 10.0, maxDur: 2031, tiles: [362, 362, 362], mapColor: '#4a4347' },
    [B.NETHERITE_SHOVEL]:  { name: 'Xẻng Netherite',             hard: 0,    solid: false, tool: 'shovel', voxelItem: true, fireImmune: true, mineMul: 9.0, dmg: 6.5,  maxDur: 2031, tiles: [363, 363, 363], mapColor: '#4a4347' },
    [B.TEMPLATE_NETHERITE]:{ name: 'Mẫu Nâng Cấp Netherite',     hard: 0,    solid: false, itemOnly: true, voxelItem: true, fireImmune: true, smithTemplate: 'upgrade', dupBlock: B.NETHERRACK, tiles: [364, 364, 364], mapColor: '#7f1d1d' },
    [B.TRIM_WARD]:         { name: 'Mẫu Rèn Ward (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'ward',    trimLabel: 'Ward',    dupBlock: B.DEEPSLATE,  tiles: [365, 365, 365], mapColor: '#334155' },
    [B.TRIM_COAST]:        { name: 'Mẫu Rèn Coast (Armor Trim)', hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'coast',   trimLabel: 'Coast',   dupBlock: B.STONE,      tiles: [366, 366, 366], mapColor: '#64748b' },
    [B.TRIM_WILD]:         { name: 'Mẫu Rèn Wild (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'wild',    trimLabel: 'Wild',    dupBlock: B.MOSS_BLOCK, tiles: [367, 367, 367], mapColor: '#4d7c0f' },
    [B.TRIM_DUNE]:         { name: 'Mẫu Rèn Dune (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'dune',    trimLabel: 'Dune',    dupBlock: B.SANDSTONE,  tiles: [368, 368, 368], mapColor: '#d1b578' },
    [B.TRIM_TIDE]:         { name: 'Mẫu Rèn Tide (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'tide',    trimLabel: 'Tide',    dupBlock: B.PRISMARINE, tiles: [369, 369, 369], mapColor: '#0d9488' },
    [B.TRIM_SILENCE]:      { name: 'Mẫu Rèn Silence (Armor Trim)',hard:0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'silence', trimLabel: 'Silence', dupBlock: B.DEEPSLATE,  tiles: [370, 370, 370], mapColor: '#0e7490' },
    [B.NETHERITE_BLOCK]:   { name: 'Khối Netherite (Block of Netherite)', hard: 4.50, solid: true, rock: true, blastResist: true, fireImmune: true, reqTier: 4, drop: B.NETHERITE_BLOCK, tiles: [384, 384, 384], mapColor: '#3f3a3e' },
    [B.REDSTONE]:          { name: 'Bụi Đá Đỏ (Redstone)',       hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [385, 385, 385], mapColor: '#dc2626' },
    [B.TRIM_SENTRY]:       { name: 'Mẫu Rèn Sentry (Armor Trim)',hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'sentry',    trimLabel: 'Sentry',    dupBlock: B.STONE,       tiles: [372, 372, 372], mapColor: '#64748b' },
    [B.TRIM_VEX]:          { name: 'Mẫu Rèn Vex (Armor Trim)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'vex',       trimLabel: 'Vex',       dupBlock: B.STONE,       tiles: [373, 373, 373], mapColor: '#475569' },
    [B.TRIM_RIB]:          { name: 'Mẫu Rèn Rib (Armor Trim)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'rib',       trimLabel: 'Rib',       dupBlock: B.NETHERRACK,  tiles: [374, 374, 374], mapColor: '#7f1d1d' },
    [B.TRIM_SNOUT]:        { name: 'Mẫu Rèn Snout (Armor Trim)', hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'snout',     trimLabel: 'Snout',     dupBlock: B.BASALT,      tiles: [375, 375, 375], mapColor: '#334155' },
    [B.TRIM_EYE]:          { name: 'Mẫu Rèn Eye (Armor Trim)',   hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'eye',       trimLabel: 'Eye',       dupBlock: B.END_STONE,   tiles: [376, 376, 376], mapColor: '#d9d49c' },
    [B.TRIM_SPIRE]:        { name: 'Mẫu Rèn Spire (Armor Trim)', hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'spire',     trimLabel: 'Spire',     dupBlock: B.PURPUR_BLOCK,tiles: [377, 377, 377], mapColor: '#a855f7' },
    [B.TRIM_FLOW]:         { name: 'Mẫu Rèn Flow (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'flow',      trimLabel: 'Flow',      dupBlock: B.STONE_BRICK, tiles: [378, 378, 378], mapColor: '#52606d' },
    [B.TRIM_BOLT]:         { name: 'Mẫu Rèn Bolt (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'bolt',      trimLabel: 'Bolt',      dupBlock: B.COPPER_ROOF, tiles: [379, 379, 379], mapColor: '#c86b3c' },
    [B.TRIM_WAYFINDER]:    { name: 'Mẫu Rèn Wayfinder (Armor Trim)',hard:0,   solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'wayfinder', trimLabel: 'Wayfinder', dupBlock: B.TERRACOTTA,  tiles: [380, 380, 380], mapColor: '#b45309' },
    [B.TRIM_RAISER]:       { name: 'Mẫu Rèn Raiser (Armor Trim)',hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'raiser',    trimLabel: 'Raiser',    dupBlock: B.TERRACOTTA,  tiles: [381, 381, 381], mapColor: '#b45309' },
    [B.TRIM_SHAPER]:       { name: 'Mẫu Rèn Shaper (Armor Trim)',hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'shaper',    trimLabel: 'Shaper',    dupBlock: B.TERRACOTTA,  tiles: [382, 382, 382], mapColor: '#b45309' },
    [B.TRIM_HOST]:         { name: 'Mẫu Rèn Host (Armor Trim)',  hard: 0,    solid: false, itemOnly: true, voxelItem: true, smithTemplate: 'trim', trimId: 'host',      trimLabel: 'Host',      dupBlock: B.TERRACOTTA,  tiles: [383, 383, 383], mapColor: '#b45309' },
    // v86 Ghast Tear & 6 New Varied Flora / Grass / Nether Fungus Blocks
    [B.GHAST_TEAR]:        { name: 'Nước Mắt Ghast (Ghast Tear)',hard: 0,    solid: false, itemOnly: true, voxelItem: true, tiles: [431, 431, 431], mapColor: '#e0f2fe' },
    [B.BLUE_ORCHID]:       { name: 'Hoa Phong Lan Xanh (Blue Orchid)', hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.BLUE_ORCHID, tiles: [432, 432, 432], mapColor: '#38bdf8' },
    [B.ALLIUM]:            { name: 'Hoa Hành Tím (Allium)',      hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.ALLIUM, tiles: [433, 433, 433], mapColor: '#c084fc' },
    [B.OXEYE_DAISY]:       { name: 'Hoa Cúc Trắng (Oxeye Daisy)',hard: 0.08, solid: false, cross: true, foliage: true, shearsOnly: true, drop: B.OXEYE_DAISY, tiles: [434, 434, 434], mapColor: '#f8fafc' },
    [B.CLOVER_PATCH]:      { name: 'Thảm Cỏ Ba Lá & Hoa Dại',    hard: 0.08, solid: false, cross: true, foliage: true, tiles: [435, 435, 435], mapColor: '#4ade80' },
    [B.CRIMSON_FUNGUS]:    { name: 'Nấm Đỏ Thẫm Địa Ngục',       hard: 0.08, solid: false, cross: true, foliage: true, emissive: true, drop: B.CRIMSON_FUNGUS, tiles: [436, 436, 436], mapColor: '#ef4444' },
    [B.WARPED_FUNGUS]:     { name: 'Nấm Xanh Biến Dị',           hard: 0.08, solid: false, cross: true, foliage: true, emissive: true, drop: B.WARPED_FUNGUS, tiles: [437, 437, 437], mapColor: '#2dd4bf' },
    [B.SHORT_GRASS]:       { name: 'Cỏ Ngắn Xanh Mướt',          hard: 0.06, solid: false, cross: true, foliage: true, drop: 0, tiles: [444, 444, 444], mapColor: '#36ab1a' },
    [B.BUSH_GRASS]:        { name: 'Bụi Cỏ Rậm Xanh',            hard: 0.08, solid: false, cross: true, foliage: true, drop: 0, tiles: [445, 445, 445], mapColor: '#237a12' },
    [B.WILD_TALL_GRASS]:   { name: 'Cỏ Cao Rừng Rậm',            hard: 0.08, solid: false, cross: true, foliage: true, drop: 0, tiles: [446, 446, 446], mapColor: '#2ea81c' },
    [B.REDSTONE_ORE]:      { name: 'Quặng Đá Đỏ (Redstone)',     hard: 2.00, solid: true,  rock: true, oreBlock: true, reqTier: 3, xp: 5, light: 5, drop: B.REDSTONE, tiles: [447, 447, 447], mapColor: '#dc2626' },
    [B.AZURE_LOG]:         { name: 'Gỗ Xanh Lam',                hard: 0.90, solid: true,  wood: true, isLog: true, drop: B.AZURE_LOG, tiles: [449, 448, 449], mapColor: '#5c6e8a' },
    [B.AZURE_LEAVES]:      { name: 'Lá Xanh Lam Tươi',           hard: 0.25, solid: true,  foliage: true, blueLeaf: true, shearsOnly: true, drop: B.AZURE_LEAVES, tiles: [450, 450, 450], mapColor: '#1d8cf8' },
    [B.COBALT_LEAVES]:     { name: 'Lá Thông Lam Đậm',           hard: 0.25, solid: true,  foliage: true, blueLeaf: true, shearsOnly: true, drop: B.COBALT_LEAVES, tiles: [451, 451, 451], mapColor: '#1254c8' },
    [B.AZURE_PLANKS]:      { name: 'Ván Gỗ Xanh Lam',            hard: 0.75, solid: true,  wood: true, isPlanks: true, drop: B.AZURE_PLANKS, tiles: [452, 452, 452], mapColor: '#4c7fb8' },
    [B.BLUE_GRASS]:        { name: 'Cỏ Ngọc Lam',                hard: 0.55, solid: true,  dirt: true, drop: B.DIRT, tiles: [453, 454, 2], mapColor: '#25a89d' },
    [B.TEAL_FERN]:         { name: 'Cỏ Bạc Hà Lam',              hard: 0.08, solid: false, cross: true, foliage: true, tiles: [455, 455, 455], mapColor: '#6de3d4' },
    [B.CATTAIL_REED]:      { name: 'Cỏ Sậy Đầm Lầy',             hard: 0.08, solid: false, cross: true, foliage: true, tiles: [456, 456, 456], mapColor: '#3f8a36' },
    [B.DARK_SLATE_ROOF]:     { name: 'Ngói Đá Đen Cổ',               hard: 1.50, solid: true,  rock: true, drop: B.DARK_SLATE_ROOF, tiles: [457, 457, 457], mapColor: '#3c424f' },
    [B.SCULK]:               { name: 'Khối Sculk',                   hard: 0.45, solid: true,  dirt: true, xp: 1, drop: B.SCULK, tiles: [458, 458, 458], mapColor: '#05151e' },
    [B.SCULK_VEIN]:          { name: 'Gân Sculk (Sculk Vein)',       hard: 0.25, solid: false, cross: true, flatTrack: true, trans: true, emissive: true, light: 3, drop: B.SCULK_VEIN, tiles: [459, 459, 459], mapColor: '#0e7490' },
    [B.SCULK_CATALYST]:      { name: 'Lõi Xúc Tác Sculk Catalyst',   hard: 2.50, solid: true,  rock: true, emissive: true, light: 6, xp: 5, drop: B.SCULK_CATALYST, tiles: [460, 461, 458], mapColor: '#134e4a' },
    [B.SCULK_SENSOR]:        { name: 'Cảm Biến Sculk Sensor',        hard: 1.50, solid: true,  rock: true, trans: true, subBlock: true, emissive: true, light: 6, xp: 4, drop: B.SCULK_SENSOR, tiles: [462, 462, 462], mapColor: '#0891b2' },
    [B.SCULK_SHRIEKER]:      { name: 'Máy Thét Sculk Shrieker',      hard: 2.20, solid: true,  rock: true, trans: true, subBlock: true, emissive: true, light: 7, xp: 5, drop: B.SCULK_SHRIEKER, tiles: [464, 465, 458], mapColor: '#0f2936' },
    [B.REINFORCED_DEEPSLATE]:{ name: 'Đá Bảng Gia Cố (Portal Frame)',hard: 55.0, solid: true,  rock: true, blastProof: true, pushResistant: true, drop: 0, tiles: [466, 467, 466], mapColor: '#222631' },
    [B.DEEPSLATE_BRICKS]:    { name: 'Gạch Đá Bảng Sâu (Deepslate Bricks)', hard: 2.20, solid: true, rock: true, reqTier: 1, drop: B.DEEPSLATE_BRICKS, tiles: [468, 468, 468], mapColor: '#2a2e38' },
    [B.DEEPSLATE_TILES]:     { name: 'Ngói Đá Bảng Sâu (Deepslate Tiles)',  hard: 2.20, solid: true, rock: true, reqTier: 1, drop: B.DEEPSLATE_TILES, tiles: [469, 469, 469], mapColor: '#1f222b' },
    [B.SOUL_LANTERN]:        { name: 'Đèn Lồng Linh Hồn (Soul Lantern)',    hard: 1.50, solid: false, lantern: true, emissive: true, trans: true, voxelItem: true, offhandOk: true, light: 14, drop: B.SOUL_LANTERN, tiles: [470, 470, 470], mapColor: '#22d3ee' },
    [B.SOUL_FIRE]:           { name: 'Lửa Linh Hồn (Soul Fire)',     hard: 0.05, solid: false, cross: true, trans: true, fire: true, emissive: true, light: 13, drop: 0, tiles: [472, 472, 472], mapColor: '#22d3ee' },
    [B.CANDLE]:              { name: 'Nến Phát Sáng (Candle)',       hard: 0.15, solid: false, trans: true, subBlock: true, candle: true, emissive: true, light: 10, drop: B.CANDLE, tiles: [471, 471, 471], mapColor: '#fde68a' },
    [B.ENDER_CHEST_BLOCK]:   { name: 'Rương Ender (Toàn Cầu 27 Ô)',  hard: 8.00, solid: true,  rock: true, chest: true, chestTier: 'ender', chestSlots: 27, trans: true, interactive: true, light: 7, reqTier: 2, drop: B.ENDER_CHEST_BLOCK, tiles: [476, 476, 476], mapColor: '#0f2728' },
    [B.NOTE_BLOCK]:          { name: 'Khối Âm Thanh (Note Block)',   hard: 0.80, solid: true,  wood: true, interactive: true, drop: B.NOTE_BLOCK, tiles: [477, 477, 477], mapColor: '#7c4a26' },
    [B.NIGHT_VISION_POTION]: { name: 'Thuốc Nhìn Đêm (Night Vision 180s)', hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [478, 478, 478], mapColor: '#3b82f6' },
    [B.TOTEM_UNDYING]:       { name: 'Totem Bất Tử (Totem of Undying)',    hard: 0, solid: false, itemOnly: true, voxelItem: true, offhandOk: true, tiles: [479, 479, 479], mapColor: '#facc15' },
    [B.SWIFT_SNEAK_BOOK]:    { name: 'Sách Phép Swift Sneak (Đi Lén Nhanh)', hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [480, 480, 480], mapColor: '#22d3ee' },
    [B.DISC_FRAGMENT_5]:     { name: 'Mảnh Đĩa Nhạc 5',              hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [481, 481, 481], mapColor: '#0e7490' },
    [B.MUSIC_DISC_5]:        { name: 'Đĩa Nhạc 5 (Deep Dark)',       hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [482, 482, 482], mapColor: '#22d3ee' },
    [B.MUSIC_DISC_OTHERSIDE]:{ name: 'Đĩa Nhạc Otherside',           hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [483, 483, 483], mapColor: '#4ade80' },
    [B.SNOWBALL]:            { name: 'Cầu Tuyết (Đánh Lạc Hướng Warden)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [484, 484, 484], mapColor: '#e0f2fe' },
    [B.VOLCANIC_STONE]:      { name: 'Đá Núi Lửa Tổ Rồng (Volcanic Rock)', hard: 2.30, solid: true, rock: true, blastResist: true, reqTier: 1, drop: B.VOLCANIC_STONE, tiles: [485, 485, 485], mapColor: '#3f221d' },
    [B.DRAGON_CRYSTAL_ORE]:  { name: 'Quặng Tinh Thể Rồng (Cần Cúp Sắt+)', hard: 2.85, solid: true, rock: true, oreBlock: true, reqTier: 3, xp: 10, light: 7, drop: B.DRAGON_CRYSTAL, tiles: [486, 486, 486], mapColor: '#f59e0b' },
    [B.DRAGON_CRYSTAL]:      { name: 'Tinh Thể Rồng (Nuôi Rồng Con)',      hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [487, 487, 487], mapColor: '#fbbf24' },
    [B.DRAGON_SCALE]:        { name: 'Vảy Rồng Cổ Đại (Chế Giáp Rồng)',    hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [488, 488, 488], mapColor: '#dc2626' },
    [B.DRAGON_BONE]:         { name: 'Xương Rồng (Chế Vũ Khí Rồng)',       hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [489, 489, 489], mapColor: '#f5f5f4' },
    [B.DRAGON_SADDLE]:       { name: 'Yên Cưỡi Rồng (Gắn Lên Rồng 100%)',  hard: 0, solid: false, itemOnly: true, voxelItem: true, tiles: [490, 490, 490], mapColor: '#22d3ee' },
    [B.DRAGON_EGG_FIRE]:     { name: 'Trứng Rồng Lửa (Đặt Để Ấp Nở)',     hard: 0.45, solid: true, rock: true, trans: true, emissive: true, light: 8, dragonEgg: 'fire',  eggPal: { base: 0x3b0a0a, shell: 0xb91c1c, band: 0xf97316, spot: 0xfef08a }, drop: B.DRAGON_EGG_FIRE,  tiles: [491, 491, 491], mapColor: '#ef4444' },
    [B.DRAGON_EGG_ICE]:      { name: 'Trứng Rồng Băng (Đặt Để Ấp Nở)',    hard: 0.45, solid: true, rock: true, trans: true, emissive: true, light: 8, dragonEgg: 'ice',   eggPal: { base: 0x0c4a6e, shell: 0x0284c7, band: 0x7dd3fc, spot: 0xe0f2fe }, drop: B.DRAGON_EGG_ICE,   tiles: [492, 492, 492], mapColor: '#38bdf8' },
    [B.DRAGON_EGG_WATER]:    { name: 'Trứng Rồng Nước (Đặt Để Ấp Nở)',    hard: 0.45, solid: true, rock: true, trans: true, emissive: true, light: 8, dragonEgg: 'water', eggPal: { base: 0x0f3b5c, shell: 0x0ea5e9, band: 0x2dd4bf, spot: 0xa5f3fc }, drop: B.DRAGON_EGG_WATER, tiles: [493, 493, 493], mapColor: '#06b6d4' },
    [B.DRAGON_EGG_LEAF]:     { name: 'Trứng Rồng Lá (Đặt Để Ấp Nở)',      hard: 0.45, solid: true, rock: true, trans: true, emissive: true, light: 7, dragonEgg: 'leaf',  eggPal: { base: 0x14532d, shell: 0x16a34a, band: 0x86efac, spot: 0xfacc15 }, drop: B.DRAGON_EGG_LEAF,  tiles: [494, 494, 494], mapColor: '#22c55e' },
    [B.DRAGON_EGG_TREE]:     { name: 'Trứng Rồng Cây Cổ Thụ (Đặt Để Ấp)', hard: 0.45, solid: true, rock: true, trans: true, emissive: true, light: 7, dragonEgg: 'tree',  eggPal: { base: 0x3f2314, shell: 0x5c7c2f, band: 0xa3e635, spot: 0xf472b6 }, drop: B.DRAGON_EGG_TREE,  tiles: [495, 495, 495], mapColor: '#65a30d' },
    [B.DRAGON_HELMET]:       { name: 'Mũ Giáp Vảy Rồng (+5)',              hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'helmet', armorVal: 5,  toughness: 4.5, kbResist: 0.12, maxDur: 2800, armorTier: 'dragon', tiles: [496, 496, 496], mapColor: '#dc2626' },
    [B.DRAGON_CHEST]:        { name: 'Áo Giáp Vảy Rồng (+10)',             hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'chest',  armorVal: 10, toughness: 4.5, kbResist: 0.12, maxDur: 2800, armorTier: 'dragon', tiles: [497, 497, 497], mapColor: '#dc2626' },
    [B.DRAGON_LEGS]:         { name: 'Quần Giáp Vảy Rồng (+8)',            hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'legs',   armorVal: 8,  toughness: 4.5, kbResist: 0.12, maxDur: 2800, armorTier: 'dragon', tiles: [498, 498, 498], mapColor: '#dc2626' },
    [B.DRAGON_BOOTS]:        { name: 'Giày Giáp Vảy Rồng (+5)',            hard: 0, solid: false, itemOnly: true, voxelItem: true, armorSlot: 'boots',  armorVal: 5,  toughness: 4.5, kbResist: 0.12, maxDur: 2800, armorTier: 'dragon', tiles: [499, 499, 499], mapColor: '#dc2626' },
    [B.DRAGON_BONE_SWORD]:   { name: 'Kiếm Xương Rồng',                    hard: 0, solid: false, tool: 'sword', voxelItem: true, mineMul: 2.8,  dmg: 14.0, fireDmg: true, maxDur: 2600, tiles: [500, 500, 500], mapColor: '#f5f5f4' },
    [B.DRAGON_BONE_AXE]:     { name: 'Rìu Chiến Xương Rồng',               hard: 0, solid: false, tool: 'axe',   voxelItem: true, mineMul: 14.5, dmg: 12.5, maxDur: 2600, tiles: [501, 501, 501], mapColor: '#f5f5f4' },
    [B.DRAGON_BONE_PICK]:    { name: 'Cuốc Xương Rồng (Cấp 6)',            hard: 0, solid: false, tool: 'pick',  pickTier: 6, voxelItem: true, mineMul: 15.0, dmg: 7.0, maxDur: 2600, tiles: [502, 502, 502], mapColor: '#f5f5f4' },
    [B.DRAGON_BONE_BOW]:     { name: 'Cung Xương Rồng',                    hard: 0, solid: false, tool: 'bow',   voxelItem: true, customAtlasTex: true, dmg: 11.5, maxDur: 1800, tiles: [503, 503, 503], mapColor: '#f5f5f4' }
  };

  // Register 15 new colored Wools, 15 colored Beds (+ hidden foots) & all Wood/Stone/Earth Building Slabs!
  for (const e of _DYN_COLORED_ENTRIES) {
    const c = e.c;
    if (e.kind === 'wool') {
      BLOCK_DEF[e.id] = { name: `Len ${c.vi}`, hard: 0.32, solid: true, wood: true, isWool: true, woolColor: c.key, drop: e.id, tiles: [e.tile, e.tile, e.tile], mapColor: c.hex };
    } else {
      const bDef = { voxelItem: true, name: `Giường Ngủ ${c.vi}`, hard: 0.35, solid: true, wood: true, bed: true, trans: true, interactive: true, bedPartner: e.footId, bedColorKey: c.key, bedHex: c.hex, bedDarkHex: c.dark, bedLightHex: c.light, bedBlanketTile: e.bTopTile, bedSideTile: e.bSideTile, drop: e.headId, tiles: [e.bTopTile, e.bSideTile, 8], mapColor: c.hex };
      BLOCK_DEF[e.headId] = bDef;
      BLOCK_DEF[e.footId] = Object.assign({}, bDef, { name: `Giường Ngủ ${c.vi} (Chân)`, bedFoot: true, bedPartner: e.headId });
    }
  }
  for (const s of SLAB_SPECS) {
    const base = BLOCK_DEF[s.baseId] || BLOCK_DEF[B.STONE];
    const common = {
      name: s.name,
      hard: s.petrified ? 1.85 : Math.max(0.25, +((base.hard || 0.8) * 0.9).toFixed(2)),
      solid: true, trans: true, slab: true,
      wood: s.petrified ? false : !!base.wood,
      rock: s.petrified ? true : !!base.rock,
      dirt: s.petrified ? false : !!base.dirt,
      reqTier: s.petrified ? 1 : (base.reqTier || 0),
      blastResist: s.petrified ? true : !!base.blastResist,
      slippery: !!base.slippery,
      isWoodSlab: !!s.isWood,
      fullBlockId: s.baseId,
      drop: s.botId,
      tiles: base.tiles.slice(),
      mapColor: base.mapColor
    };
    BLOCK_DEF[s.botId] = Object.assign({}, common, { slabTop: false, slabTopId: s.topId });
    BLOCK_DEF[s.topId] = Object.assign({}, common, { slabTop: true, slabBotId: s.botId });
  }

  // Farming Hoes (Wooden -> Netherite, tiles 504..509)
  BLOCK_DEF[B.WOOD_HOE]      = { name: 'Cuốc Đất Gỗ',        hard: 0, solid: false, tool: 'hoe', hoeTier: 1, voxelItem: true, mineMul: 2.0, dmg: 1.5, maxDur: 59,   tiles: [504, 504, 504], mapColor: '#a87c4f' };
  BLOCK_DEF[B.STONE_HOE]     = { name: 'Cuốc Đất Đá',        hard: 0, solid: false, tool: 'hoe', hoeTier: 2, voxelItem: true, mineMul: 3.0, dmg: 2.0, maxDur: 131,  tiles: [505, 505, 505], mapColor: '#94a3b8' };
  BLOCK_DEF[B.IRON_HOE]      = { name: 'Cuốc Đất Sắt',       hard: 0, solid: false, tool: 'hoe', hoeTier: 3, voxelItem: true, mineMul: 4.0, dmg: 2.5, maxDur: 250,  tiles: [506, 506, 506], mapColor: '#e2e8f0' };
  BLOCK_DEF[B.GOLD_HOE]      = { name: 'Cuốc Đất Vàng',      hard: 0, solid: false, tool: 'hoe', hoeTier: 2, voxelItem: true, mineMul: 5.5, dmg: 1.8, maxDur: 32,   tiles: [507, 507, 507], mapColor: '#facc15' };
  BLOCK_DEF[B.DIAMOND_HOE]   = { name: 'Cuốc Đất Kim Cương', hard: 0, solid: false, tool: 'hoe', hoeTier: 4, voxelItem: true, mineMul: 6.0, dmg: 3.0, maxDur: 1561, tiles: [508, 508, 508], mapColor: '#22d3ee' };
  BLOCK_DEF[B.NETHERITE_HOE] = { name: 'Cuốc Đất Netherite', hard: 0, solid: false, tool: 'hoe', hoeTier: 5, voxelItem: true, fireImmune: true, mineMul: 7.5, dmg: 4.0, maxDur: 2031, tiles: [509, 509, 509], mapColor: '#443d44' };
  BLOCK_DEF[B.END_GATEWAY]      = { name: 'Cổng End Gateway', nameEn: 'End Gateway', hard: 99, solid: false, trans: true, emissive: 0.96, light: 12, unbreakable: true, portal: true, tiles: [510, 510, 510], mapColor: '#0f172a' };
  BLOCK_DEF[B.END_STONE_BRICKS] = { name: 'Gạch Đá End', nameEn: 'End Stone Bricks', hard: 2.2, solid: true, reqTool: 'pick', tiles: [511, 511, 511], mapColor: '#e9e6b2' };
  BLOCK_DEF[B.PURPUR_PILLAR]    = { name: 'Cột Purpur', nameEn: 'Purpur Pillar', hard: 1.6, solid: true, reqTool: 'pick', tiles: [512, 513, 512], mapColor: '#a878a8' };
  BLOCK_DEF[B.END_ROD]          = { name: 'Đèn Thanh End Rod', nameEn: 'End Rod', hard: 0.2, solid: false, subBlock: true, endRod: true, trans: true, emissive: 0.95, light: 14, tiles: [514, 514, 515], mapColor: '#f8fafc' };
  BLOCK_DEF[B.DRAGON_HEAD]      = { name: 'Đầu Rồng End', nameEn: 'Dragon Head', hard: 1.0, solid: true, dragonHead: true, armorSlot: 'helmet', armorVal: 3, equipTier: 'dragon_head', customAtlasTex: true, tiles: [516, 516, 516], mapColor: '#1f1b24' };
  BLOCK_DEF[B.ELYTRA]           = { name: 'Cánh Cứng Elytra', nameEn: 'Elytra', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, armorSlot: 'chest', armorVal: 0, equipTier: 'elytra', isElytra: true, maxDur: 432, tiles: [517, 517, 517], mapColor: '#7c7b96' };
  BLOCK_DEF[B.ENDER_DRAGON_EGG] = { name: 'Trứng Rồng End', nameEn: 'Dragon Egg', hard: 3.0, solid: true, trans: true, dragonEgg: 'ender', eggPal: { base: 0x0b0812, shell: 0x181024, band: 0x3b1254, spot: 0xc026d3 }, light: 6, emissive: 0.35, customAtlasTex: true, drop: B.ENDER_DRAGON_EGG, tiles: [V153_TILES.enderDragonEgg, V153_TILES.enderDragonEgg, V153_TILES.enderDragonEgg], mapColor: '#110b19' };
  BLOCK_DEF[B.WINDMILL_HUB]     = { name: 'Trục Cối Xoay Gió', nameEn: 'Windmill Hub', hard: 2.0, solid: true, windmillHub: true, customAtlasTex: true, tiles: [518, 518, 518], mapColor: '#7c5332' };
  BLOCK_DEF[B.RED_SAND]            = { name: 'Cát Đỏ (Red Sand)',           nameEn: 'Red Sand',           hard: 0.45, solid: true,  dirt: true, customAtlasTex: true, drop: B.RED_SAND, tiles: [519, 519, 519], mapColor: '#be5b24' };
  BLOCK_DEF[B.TERRACOTTA_WHITE]    = { name: 'Đất Sét Nung Trắng',          nameEn: 'White Terracotta',   hard: 1.25, solid: true,  rock: true, customAtlasTex: true, drop: B.TERRACOTTA_WHITE, tiles: [520, 520, 520], mapColor: '#d1b1a1' };
  BLOCK_DEF[B.TERRACOTTA_ORANGE]   = { name: 'Đất Sét Nung Cam',            nameEn: 'Orange Terracotta',  hard: 1.25, solid: true,  rock: true, customAtlasTex: true, drop: B.TERRACOTTA_ORANGE, tiles: [521, 521, 521], mapColor: '#a15325' };
  BLOCK_DEF[B.TERRACOTTA_YELLOW]   = { name: 'Đất Sét Nung Vàng',           nameEn: 'Yellow Terracotta',  hard: 1.25, solid: true,  rock: true, customAtlasTex: true, drop: B.TERRACOTTA_YELLOW, tiles: [522, 522, 522], mapColor: '#ba8523' };
  BLOCK_DEF[B.TERRACOTTA_BROWN]    = { name: 'Đất Sét Nung Nâu',            nameEn: 'Brown Terracotta',   hard: 1.25, solid: true,  rock: true, customAtlasTex: true, drop: B.TERRACOTTA_BROWN, tiles: [523, 523, 523], mapColor: '#4d3323' };
  BLOCK_DEF[B.TERRACOTTA_RED]      = { name: 'Đất Sét Nung Đỏ',             nameEn: 'Red Terracotta',     hard: 1.25, solid: true,  rock: true, customAtlasTex: true, drop: B.TERRACOTTA_RED, tiles: [524, 524, 524], mapColor: '#8e3c2e' };
  BLOCK_DEF[B.DEAD_BUSH]           = { name: 'Bụi Cây Khô (Dead Bush)',     nameEn: 'Dead Bush',          hard: 0.05, solid: false, cross: true, trans: true, foliage: true, customAtlasTex: true, drop: B.STICK, tiles: [525, 525, 525], mapColor: '#8f5e2c' };
  BLOCK_DEF[B.GOLDEN_MAPLE_LEAVES] = { name: 'Lá Phong Vàng Rực',           nameEn: 'Golden Maple Leaves', hard: 0.25, solid: true,  foliage: true, neutralLeaf: true, shearsOnly: true, customAtlasTex: true, drop: B.GOLDEN_MAPLE_LEAVES, tiles: [526, 526, 526], mapColor: '#eab308' };
  BLOCK_DEF[B.ORANGE_MAPLE_LEAVES] = { name: 'Lá Phong Cam Cổ Thụ',         nameEn: 'Orange Maple Leaves', hard: 0.25, solid: true,  foliage: true, neutralLeaf: true, shearsOnly: true, customAtlasTex: true, drop: B.ORANGE_MAPLE_LEAVES, tiles: [527, 527, 527], mapColor: '#ea580c' };
  BLOCK_DEF[B.MANGROVE_PROPAGULE]  = { name: 'Mầm Đước Ngập Mặn',           nameEn: 'Mangrove Propagule', hard: 0.05, solid: false, cross: true, trans: true, foliage: true, hanging: true, customAtlasTex: true, drop: B.MANGROVE_PROPAGULE, tiles: [528, 528, 528], mapColor: '#4d7c0f' };
  BLOCK_DEF[B.PALE_LOG]            = { name: 'Gỗ Sồi Nhợt (Pale Oak)',      nameEn: 'Pale Oak Log',       hard: 0.95, solid: true,  wood: true, isLog: true, customAtlasTex: true, drop: B.PALE_LOG, tiles: [529, 530, 529], mapColor: '#9aa0a6' };
  BLOCK_DEF[B.PALE_PLANKS]         = { name: 'Ván Gỗ Nhợt (Pale Planks)',   nameEn: 'Pale Oak Planks',    hard: 0.75, solid: true,  wood: true, isPlanks: true, customAtlasTex: true, drop: B.PALE_PLANKS, tiles: [531, 531, 531], mapColor: '#d1d5db' };
  BLOCK_DEF[B.PALE_LEAVES]         = { name: 'Lá Sồi Nhợt (Pale Leaves)',   nameEn: 'Pale Oak Leaves',    hard: 0.25, solid: true,  foliage: true, neutralLeaf: true, shearsOnly: true, customAtlasTex: true, drop: B.PALE_LEAVES, tiles: [532, 532, 532], mapColor: '#94a3b8' };
  BLOCK_DEF[B.PALE_MOSS]           = { name: 'Rêu Trắng Xám (Pale Moss)',   nameEn: 'Pale Moss',          hard: 0.45, solid: true,  dirt: true, customAtlasTex: true, drop: B.PALE_MOSS, tiles: [533, 533, 533], mapColor: '#7b8794' };
  BLOCK_DEF[B.NIGHTMARE_LOG]       = { name: 'Gỗ Ác Mộng (Nightmare)',      nameEn: 'Nightmare Log',      hard: 1.05, solid: true,  wood: true, isLog: true, customAtlasTex: true, drop: B.NIGHTMARE_LOG, tiles: [534, 534, 534], mapColor: '#26142e' };
  BLOCK_DEF[B.NIGHTMARE_LEAVES]    = { name: 'Lá Rừng Ác Mộng',             nameEn: 'Nightmare Leaves',   hard: 0.28, solid: true,  foliage: true, neutralLeaf: true, shearsOnly: true, customAtlasTex: true, drop: B.NIGHTMARE_LEAVES, tiles: [535, 535, 535], mapColor: '#4c1d2e' };
  BLOCK_DEF[B.NIGHTMARE_MOSS]      = { name: 'Đất Rêu Ác Mộng',             nameEn: 'Nightmare Turf',     hard: 0.55, solid: true,  dirt: true, customAtlasTex: true, drop: B.NIGHTMARE_MOSS, tiles: [536, 536, 536], mapColor: '#1f1024' };
  BLOCK_DEF[B.ELYTRA_PHOENIX]      = { name: 'Cánh Phượng Hoàng (Phoenix Elytra)', nameEn: 'Phoenix Elytra', hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'chest', armorVal: 3, toughness: 2, equipTier: 'elytra_phoenix', isElytra: true, maxDur: 640, customAtlasTex: true, tiles: [537, 537, 537], mapColor: '#f97316' };
  BLOCK_DEF[B.DRAGON_EGG_EARTH]    = { name: 'Trứng Rồng Đất (Đặt Để Ấp Nở)', nameEn: 'Earth Dragon Egg', hard: 0.45, solid: true, rock: true, trans: true, emissive: true, light: 7, dragonEgg: 'earth', eggPal: { base: 0x2c1b0e, shell: 0x78350f, band: 0xd97706, spot: 0xfde047 }, customAtlasTex: true, drop: B.DRAGON_EGG_EARTH, tiles: [538, 538, 538], mapColor: '#92400e' };
  BLOCK_DEF[B.DRAGON_SCALE_FIRE]   = { name: 'Vảy Rồng Lửa',                nameEn: 'Fire Dragon Scale',  hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [539, 539, 539], mapColor: '#ef4444' };
  BLOCK_DEF[B.DRAGON_SCALE_ICE]    = { name: 'Vảy Rồng Băng',               nameEn: 'Ice Dragon Scale',   hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [540, 540, 540], mapColor: '#38bdf8' };
  BLOCK_DEF[B.DRAGON_SCALE_EARTH]  = { name: 'Vảy Rồng Đất',                nameEn: 'Earth Dragon Scale', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [541, 541, 541], mapColor: '#d97706' };
  BLOCK_DEF[B.DRAGON_SCALE_WATER]  = { name: 'Vảy Rồng Nước',               nameEn: 'Water Dragon Scale', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [542, 542, 542], mapColor: '#06b6d4' };
  BLOCK_DEF[B.DRAGON_SCALE_LEAF]   = { name: 'Vảy Rồng Lá',                 nameEn: 'Leaf Dragon Scale',  hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [543, 543, 543], mapColor: '#22c55e' };
  BLOCK_DEF[B.DRAGON_SCALE_ENDER]  = { name: 'Vảy Rồng Ender',              nameEn: 'Ender Dragon Scale', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [544, 544, 544], mapColor: '#c026d3' };
  for (const [elKey, elVi, elEn, elHex, fireImm] of [
    ['FIRE',  'Lửa',   'Fire',  '#ef4444', true],
    ['ICE',   'Băng',  'Ice',   '#38bdf8', false],
    ['EARTH', 'Đất',   'Earth', '#b45309', false],
    ['WATER', 'Nước',  'Water', '#06b6d4', false],
    ['LEAF',  'Lá',    'Leaf',  '#22c55e', false],
    ['ENDER', 'Ender', 'Ender', '#c026d3', true]
  ]) {
    const tierKey = 'dragon_' + elKey.toLowerCase();
    for (const [slotKey, slotVi, slotEn, val, dur] of [
      ['HELMET', 'Mũ',   'Helmet',     4, 2400],
      ['CHEST',  'Áo',   'Chestplate', 9, 2800],
      ['LEGS',   'Quần', 'Leggings',   7, 2600],
      ['BOOTS',  'Giày', 'Boots',      4, 2400]
    ]) {
      const sl = slotKey === 'CHEST' ? 'chest' : (slotKey === 'HELMET' ? 'helmet' : (slotKey === 'LEGS' ? 'legs' : 'boots'));
      const tile = slotKey === 'HELMET' ? 496 : (slotKey === 'CHEST' ? 497 : (slotKey === 'LEGS' ? 498 : 499));
      BLOCK_DEF[B[`DRAGON_${elKey}_${slotKey}`]] = {
        name: `${slotVi} Giáp Rồng ${elVi} (+${val})`, nameEn: `${elEn} Dragon ${slotEn}`,
        hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: fireImm,
        armorSlot: sl, armorVal: val, toughness: 4.0, kbResist: 0.12, maxDur: dur,
        armorTier: tierKey, dragonElemSet: elKey.toLowerCase(), customAtlasTex: true,
        tiles: [tile, tile, tile], mapColor: elHex
      };
    }
  }

  // v129: 5th Dimension ('warden') Blocks, Tier-6+ Ores, Materials, Mob Drops, Bows, Tools & 3 Armor Sets
  BLOCK_DEF[B.SOUL_FLINT_AND_STEEL] = { name: 'Bật Lửa Linh Hồn (Kích Hoạt Cổng Warden)', nameEn: 'Soul Flint & Steel', hard: 0, solid: false, tool: 'flint_steel', soulSteel: true, voxelItem: true, customAtlasTex: true, maxDur: 96, tiles: [545, 545, 545], mapColor: '#22d3ee' };
  BLOCK_DEF[B.WARDEN_PORTAL]        = { name: 'Cổng Không Gian Warden', nameEn: 'Warden Portal', hard: 99, solid: false, trans: true, portal: true, wardenPortal: true, emissive: 0.94, light: 12, unbreakable: true, customAtlasTex: true, tiles: [546, 546, 546], mapColor: '#0e7490' };
  BLOCK_DEF[B.WARDEN_SCULK_STONE]   = { name: 'Đá Sculk Cổ Thành (Warden Stone)', nameEn: 'Warden Sculk Stone', hard: 3.4, solid: true, rock: true, blastResist: true, reqTier: 4, customAtlasTex: true, drop: B.WARDEN_SCULK_STONE, tiles: [547, 547, 547], mapColor: '#0f252e' };
  BLOCK_DEF[B.SCULK_LOG]            = { name: 'Thân Cây Sculk Cổ Đại', nameEn: 'Sculk Log', hard: 1.45, solid: true, wood: true, isLog: true, customAtlasTex: true, drop: B.SCULK_LOG, tiles: [548, 549, 548], mapColor: '#13323e' };
  BLOCK_DEF[B.SCULK_PLANKS]         = { name: 'Ván Gỗ Sculk', nameEn: 'Sculk Planks', hard: 1.0, solid: true, wood: true, isPlanks: true, customAtlasTex: true, drop: B.SCULK_PLANKS, tiles: [550, 550, 550], mapColor: '#1a4250' };
  BLOCK_DEF[B.SCULK_LEAVES]         = { name: 'Lá Cây Phát Sáng Sculk', nameEn: 'Sculk Leaves', hard: 0.30, solid: true, foliage: true, leaves: true, neutralLeaf: true, trans: true, shearsOnly: true, light: 3, customAtlasTex: true, drop: B.SCULK_LEAVES, tiles: [551, 551, 551], mapColor: '#0d7485' };
  BLOCK_DEF[B.UMBRA_ORE]            = { name: 'Quặng Umbra Warden (Cúp Cấp 6+)', nameEn: 'Umbra Ore', hard: 28.0, solid: true, rock: true, oreBlock: true, reqTier: 6, siftOre: true, xp: 18, light: 6, customAtlasTex: true, drop: B.UMBRA_INGOT, tiles: [552, 552, 552], mapColor: '#6d28d9' };
  BLOCK_DEF[B.RESONANT_ORE]         = { name: 'Quặng Cộng Hưởng Sculk (Cúp Cấp 6+)', nameEn: 'Resonant Sculk Ore', hard: 32.0, solid: true, rock: true, oreBlock: true, reqTier: 6, siftOre: true, xp: 22, light: 8, customAtlasTex: true, drop: B.SCULK_RESONANT_GEM, tiles: [553, 553, 553], mapColor: '#06b6d4' };
  BLOCK_DEF[B.SOULFORGED_ORE]       = { name: 'Quặng Soulforged Cổ Thành (Cúp Cấp 6+)', nameEn: 'Soulforged Ore', hard: 36.0, solid: true, rock: true, oreBlock: true, reqTier: 6, siftOre: true, xp: 28, light: 10, fireImmune: true, customAtlasTex: true, drop: B.SOULFORGED_ORE, tiles: [554, 554, 554], mapColor: '#38bdf8' };
  BLOCK_DEF[B.UMBRA_INGOT]          = { name: 'Thỏi Umbra Warden', nameEn: 'Umbra Ingot', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [555, 555, 555], mapColor: '#7c3aed' };
  BLOCK_DEF[B.SCULK_RESONANT_GEM]   = { name: 'Ngọc Cộng Hưởng Sculk', nameEn: 'Resonant Gem', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [556, 556, 556], mapColor: '#22d3ee' };
  BLOCK_DEF[B.SOULFORGED_INGOT]     = { name: 'Thỏi Soulforged Bất Diệt', nameEn: 'Soulforged Ingot', hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, customAtlasTex: true, tiles: [557, 557, 557], mapColor: '#0ea5e9' };
  BLOCK_DEF[B.WARDEN_CHITIN]        = { name: 'Giáp Vỏ Sculk Chitin', nameEn: 'Warden Chitin', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [558, 558, 558], mapColor: '#0e7490' };
  BLOCK_DEF[B.SOUL_RESONATOR]       = { name: 'Lõi Sóng Âm Sentinel', nameEn: 'Soul Resonator', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [559, 559, 559], mapColor: '#67e8f9' };
  BLOCK_DEF[B.SCULK_HEART]          = { name: 'Trái Tim Linh Hồn Warden', nameEn: 'Sculk Heart', hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, customAtlasTex: true, tiles: [560, 560, 560], mapColor: '#22d3ee' };

  BLOCK_DEF[B.SCULK_CHITIN_SWORD]   = { name: 'Kiếm Sculk Chitin', nameEn: 'Sculk Chitin Sword', hard: 0, solid: false, tool: 'sword', voxelItem: true, customAtlasTex: true, mineMul: 3.4, dmg: 14.5, maxDur: 2800, tiles: [561, 561, 561], mapColor: '#0e7490' };
  BLOCK_DEF[B.SCULK_CHITIN_PICK]    = { name: 'Cúp Sculk Chitin (Cấp 7)', nameEn: 'Sculk Chitin Pickaxe', hard: 0, solid: false, tool: 'pick', pickTier: 7, voxelItem: true, customAtlasTex: true, mineMul: 16.5, dmg: 7.5, maxDur: 2800, tiles: [562, 562, 562], mapColor: '#0e7490' };
  BLOCK_DEF[B.SCULK_CHITIN_AXE]     = { name: 'Rìu Sculk Chitin', nameEn: 'Sculk Chitin Axe', hard: 0, solid: false, tool: 'axe', voxelItem: true, customAtlasTex: true, mineMul: 16.0, dmg: 13.0, maxDur: 2800, tiles: [563, 563, 563], mapColor: '#0e7490' };
  BLOCK_DEF[B.SCULK_ECHO_BOW]       = { name: 'Cung Vang Sculk Echo', nameEn: 'Sculk Echo Bow', hard: 0, solid: false, tool: 'bow', voxelItem: true, customAtlasTex: true, dmg: 11.5, maxDur: 2400, tiles: [564, 564, 564], mapColor: '#22d3ee' };

  BLOCK_DEF[B.RESONANT_SWORD]       = { name: 'Kiếm Cộng Hưởng Sculk', nameEn: 'Resonant Sword', hard: 0, solid: false, tool: 'sword', voxelItem: true, customAtlasTex: true, mineMul: 3.8, dmg: 17.5, maxDur: 3600, tiles: [565, 565, 565], mapColor: '#22d3ee' };
  BLOCK_DEF[B.RESONANT_PICK]        = { name: 'Cúp Cộng Hưởng Sculk (Cấp 7)', nameEn: 'Resonant Pickaxe', hard: 0, solid: false, tool: 'pick', pickTier: 7, voxelItem: true, customAtlasTex: true, mineMul: 20.5, dmg: 8.5, maxDur: 3600, tiles: [566, 566, 566], mapColor: '#22d3ee' };
  BLOCK_DEF[B.RESONANT_AXE]         = { name: 'Rìu Cộng Hưởng Sculk', nameEn: 'Resonant Axe', hard: 0, solid: false, tool: 'axe', voxelItem: true, customAtlasTex: true, mineMul: 19.5, dmg: 15.5, maxDur: 3600, tiles: [567, 567, 567], mapColor: '#22d3ee' };
  BLOCK_DEF[B.DEEP_SONIC_BOW]       = { name: 'Cung Sóng Âm Deep Sonic', nameEn: 'Deep Sonic Bow', hard: 0, solid: false, tool: 'bow', voxelItem: true, customAtlasTex: true, dmg: 14.0, maxDur: 3200, tiles: [568, 568, 568], mapColor: '#67e8f9' };

  BLOCK_DEF[B.SOULFORGED_SWORD]     = { name: 'Kiếm Soulforged Warden', nameEn: 'Soulforged Sword', hard: 0, solid: false, tool: 'sword', voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 4.5, dmg: 21.5, maxDur: 4800, tiles: [569, 569, 569], mapColor: '#38bdf8' };
  BLOCK_DEF[B.SOULFORGED_PICK]      = { name: 'Cúp Soulforged Warden (Cấp 8)', nameEn: 'Soulforged Pickaxe', hard: 0, solid: false, tool: 'pick', pickTier: 8, voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 25.5, dmg: 10.0, maxDur: 4800, tiles: [570, 570, 570], mapColor: '#38bdf8' };
  BLOCK_DEF[B.SOULFORGED_AXE]       = { name: 'Rìu Chiến Soulforged Warden', nameEn: 'Soulforged Axe', hard: 0, solid: false, tool: 'axe', voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 23.5, dmg: 18.0, maxDur: 4800, tiles: [571, 571, 571], mapColor: '#38bdf8' };
  BLOCK_DEF[B.SOUL_HARBINGER_BOW]   = { name: 'Cung Hồn Phán Quyết Harbinger', nameEn: 'Soul Harbinger Bow', hard: 0, solid: false, tool: 'bow', voxelItem: true, fireImmune: true, customAtlasTex: true, dmg: 17.0, maxDur: 4200, tiles: [572, 572, 572], mapColor: '#c084fc' };

  for (const [wKey, wVi, wEn, wTier, wHex, wTough, wKb, wDur, wFire, wVals] of [
    ['WARDEN_CHITIN', 'Vỏ Sculk',    'Warden Chitin', 'warden_chitin',     '#0e7490', 4.0, 0.08, 2800, false, [5, 9, 7, 4]],
    ['RESONANT',      'Cộng Hưởng',  'Resonant',      'warden_resonant',   '#22d3ee', 4.5, 0.10, 3600, false, [5, 10, 8, 5]],
    ['SOULFORGED',    'Soulforged',  'Soulforged',    'warden_soulforged', '#38bdf8', 5.0, 0.14, 4800, true,  [6, 12, 9, 5]]
  ]) {
    for (const [si, slotKey, slotVi, slotEn] of [[0, 'HELMET', 'Mũ', 'Helmet'], [1, 'CHEST', 'Áo', 'Chestplate'], [2, 'LEGS', 'Quần', 'Leggings'], [3, 'BOOTS', 'Giày', 'Boots']]) {
      const sl = slotKey === 'CHEST' ? 'chest' : (slotKey === 'HELMET' ? 'helmet' : (slotKey === 'LEGS' ? 'legs' : 'boots'));
      const tile = 573 + si;
      BLOCK_DEF[B[`${wKey}_${slotKey}`]] = {
        name: `${slotVi} Giáp ${wVi} (+${wVals[si]})`, nameEn: `${wEn} ${slotEn}`,
        hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: wFire,
        armorSlot: sl, armorVal: wVals[si], toughness: wTough, kbResist: wKb, maxDur: wDur,
        armorTier: wTier, wardenSet: wKey.toLowerCase(), customAtlasTex: true,
        tiles: [tile, tile, tile], mapColor: wHex
      };
    }
  }

  // v141: Jungle, Dark Oak, Bone, Bone Meal, Bone Block & Complete 17 Wood Families (Planks, Stripped Logs, Stairs, Slabs, Fences, Doors, Trapdoors, Saplings)
  BLOCK_DEF[B.JUNGLE_LOG]    = { name: 'Gỗ Rừng Nhiệt Đới',       nameEn: 'Jungle Log',      hard: 0.90, solid: true, wood: true, isLog: true, customAtlasTex: true, drop: B.JUNGLE_LOG, tiles: [JUNGLE_LOG_TILES.top, JUNGLE_LOG_TILES.side, JUNGLE_LOG_TILES.top], mapColor: '#5c4928' };
  BLOCK_DEF[B.JUNGLE_LEAVES] = { name: 'Lá Rừng Nhiệt Đới',       nameEn: 'Jungle Leaves',   hard: 0.25, solid: true, foliage: true, shearsOnly: true, customAtlasTex: true, drop: B.JUNGLE_LEAVES, tiles: [JUNGLE_LOG_TILES.leaves, JUNGLE_LOG_TILES.leaves, JUNGLE_LOG_TILES.leaves], mapColor: '#3ea825' };
  BLOCK_DEF[B.DARK_OAK_LOG]  = { name: 'Gỗ Sồi Đen',              nameEn: 'Dark Oak Log',    hard: 0.95, solid: true, wood: true, isLog: true, customAtlasTex: true, drop: B.DARK_OAK_LOG, tiles: [DARK_OAK_LOG_TILES.top, DARK_OAK_LOG_TILES.side, DARK_OAK_LOG_TILES.top], mapColor: '#382515' };
  BLOCK_DEF[B.DARK_OAK_LEAVES] = { name: 'Lá Sồi Đen',            nameEn: 'Dark Oak Leaves', hard: 0.25, solid: true, foliage: true, shearsOnly: true, customAtlasTex: true, drop: B.DARK_OAK_LEAVES, tiles: [DARK_OAK_LOG_TILES.leaves, DARK_OAK_LOG_TILES.leaves, DARK_OAK_LOG_TILES.leaves], mapColor: '#255c20' };
  BLOCK_DEF[B.BONE]          = { name: 'Xương',                   nameEn: 'Bone',            hard: 0.1, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [BONE_TILES.bone, BONE_TILES.bone, BONE_TILES.bone], mapColor: '#ece9dc' };
  BLOCK_DEF[B.BONE_MEAL]     = { name: 'Bột Xương',               nameEn: 'Bone Meal',       hard: 0.1, solid: false, itemOnly: true, voxelItem: true, isBoneMeal: true, customAtlasTex: true, tiles: [BONE_TILES.meal, BONE_TILES.meal, BONE_TILES.meal], mapColor: '#f5f5f0' };
  BLOCK_DEF[B.BONE_BLOCK]    = { name: 'Khối Xương Hóa Thạch',    nameEn: 'Bone Block',      hard: 1.5, solid: true, rock: true, customAtlasTex: true, drop: B.BONE_BLOCK, tiles: [BONE_TILES.blockTop, BONE_TILES.blockSide, BONE_TILES.blockTop], mapColor: '#e5e0cc' };

  for (const wf of WOOD_FAMILIES) {
    const isNether = (wf.key === 'crimson' || wf.key === 'warped');
    const logDef = BLOCK_DEF[wf.log];
    if (logDef) { logDef.isLog = true; logDef.wood = true; logDef.stripTo = wf.stripped; }
    if (wf.leaves && BLOCK_DEF[wf.leaves]) BLOCK_DEF[wf.leaves].saplingDrop = wf.sapling;

    const pDef = BLOCK_DEF[wf.planks] || (BLOCK_DEF[wf.planks] = { name: `Ván Gỗ ${wf.vn}`, nameEn: `${wf.en} Planks`, hard: 0.85, solid: true, wood: true, drop: wf.planks });
    pDef.isPlanks = true; pDef.wood = true; pDef.solid = true; pDef.customAtlasTex = true;
    pDef.tiles = [wf.tPlank, wf.tPlank, wf.tPlank];
    pDef.mapColor = wf.mapColor;

    BLOCK_DEF[wf.stripped] = {
      name: `Gỗ ${wf.vn} Cạo Vỏ`, nameEn: `Stripped ${wf.en} Log`,
      hard: 1.05, solid: true, wood: true, isLog: true, isStripped: true, customAtlasTex: true,
      drop: wf.stripped, tiles: [wf.tStripTop, wf.tStripSide, wf.tStripTop], mapColor: wf.mapColor
    };

    for (let d = 0; d < 4; d++) {
      const sid = wf.stairsN + d;
      BLOCK_DEF[sid] = {
        name: `Cầu Thang Gỗ ${wf.vn}`, nameEn: `${wf.en} Stairs`,
        hard: 0.75, solid: true, wood: true, stairs: true, stairDir: d, stairBase: wf.stairsN,
        trans: true, customAtlasTex: true, drop: wf.stairsN,
        tiles: [wf.tPlank, wf.tPlank, wf.tPlank], mapColor: wf.mapColor
      };
    }

    for (const sId of [wf.slabBot, wf.slabTop]) {
      const sd = BLOCK_DEF[sId];
      if (sd) {
        sd.fullBlockId = wf.planks;
        sd.wood = true; sd.customAtlasTex = true;
        sd.tiles = [wf.tPlank, wf.tPlank, wf.tPlank];
        sd.mapColor = wf.mapColor;
      }
    }

    BLOCK_DEF[wf.fence] = {
      name: `Hàng Rào Gỗ ${wf.vn}`, nameEn: `${wf.en} Fence`,
      hard: 0.85, solid: true, wood: true, fence: true, trans: true, customAtlasTex: true,
      drop: wf.fence, tiles: [wf.tPlank, wf.tPlank, wf.tPlank], mapColor: wf.mapColor
    };

    const existingDoor = BLOCK_DEF[wf.door];
    BLOCK_DEF[wf.door] = Object.assign({}, existingDoor || {}, {
      name: (existingDoor && existingDoor.name) || `Cửa Gỗ ${wf.vn}`, nameEn: `${wf.en} Door`,
      hard: 0.70, solid: true, wood: true, door: true, doorTier: wf.tier, trans: true, interactive: true,
      customAtlasTex: true, drop: wf.door, tiles: [wf.tDoor, wf.tDoor, wf.tDoor], mapColor: wf.mapColor
    });

    const existingTrap = BLOCK_DEF[wf.trapdoor];
    BLOCK_DEF[wf.trapdoor] = Object.assign({}, existingTrap || {}, {
      name: (existingTrap && existingTrap.name) || `Cửa Sập Gỗ ${wf.vn}`, nameEn: `${wf.en} Trapdoor`,
      hard: 0.65, solid: true, wood: true, trapdoor: true, doorTier: wf.tier, trans: true, interactive: true,
      customAtlasTex: true, drop: wf.trapdoor, tiles: [wf.tTrap, wf.tTrap, wf.tTrap], mapColor: wf.mapColor
    });

    const existingSap = BLOCK_DEF[wf.sapling];
    BLOCK_DEF[wf.sapling] = Object.assign({}, existingSap || {}, {
      name: (existingSap && existingSap.name) || `Mầm Cây ${wf.vn}`,
      nameEn: (existingSap && existingSap.nameEn) || `${wf.en} Sapling`,
      hard: 0.05, solid: false, cross: true, trans: true, foliage: true,
      shearsOnly: false, isSapling: true, saplingStyle: wf.treeStyle, isNetherSapling: isNether,
      customAtlasTex: true, drop: wf.sapling, tiles: [wf.tSapling, wf.tSapling, wf.tSapling],
      mapColor: (existingSap && existingSap.mapColor) || wf.mapColor
    });
  }
  BLOCK_DEF[B.CRIMSON_MAPLE_LEAVES].saplingDrop = B.OAK_SAPLING;
  BLOCK_DEF[B.GOLDEN_MAPLE_LEAVES].saplingDrop  = B.OAK_SAPLING;
  BLOCK_DEF[B.ORANGE_MAPLE_LEAVES].saplingDrop  = B.OAK_SAPLING;
  BLOCK_DEF[B.COBALT_LEAVES].saplingDrop        = B.AZURE_SAPLING;
  BLOCK_DEF[B.LULLABY_LEAVES].saplingDrop       = B.SIFT_SAPLING;

  // v142 Snowy Dirt, Frosted White Snowy Grass & Cactus Flower
  BLOCK_DEF[B.SNOWY_DIRT] = {
    name: 'Đất Tuyết', nameEn: 'Snowy Dirt',
    hard: 0.55, solid: true, dirt: true, customAtlasTex: true,
    drop: B.SNOWY_DIRT, tiles: [9, V142_TILES.snowyDirtSide, 2], mapColor: '#dcecf7'
  };
  BLOCK_DEF[B.SNOWY_GRASS] = {
    name: 'Cỏ Tuyết Trắng', nameEn: 'Snowy Grass',
    hard: 0.05, solid: false, cross: true, trans: true, foliage: true, shearsOnly: true, customAtlasTex: true,
    drop: B.SNOWY_GRASS, tiles: [V142_TILES.snowyGrass, V142_TILES.snowyGrass, V142_TILES.snowyGrass], mapColor: '#eef6ff'
  };
  BLOCK_DEF[B.CACTUS_FLOWER] = {
    name: 'Hoa Xương Rồng', nameEn: 'Cactus Flower',
    hard: 0.05, solid: false, cross: true, trans: true, foliage: true, customAtlasTex: true,
    drop: B.CACTUS_FLOWER, tiles: [V142_TILES.cactusFlower, V142_TILES.cactusFlower, V142_TILES.cactusFlower], mapColor: '#f472b6'
  };

  // v143 Magma Block, Blackstone, Mossy Stone Bricks, Nether Vines & Iron Grate
  BLOCK_DEF[B.MAGMA_BLOCK] = {
    name: 'Khối Dung Nham (Magma)', nameEn: 'Magma Block',
    hard: 1.2, solid: true, stone: true, emissive: true, eType: 0, customAtlasTex: true,
    drop: B.MAGMA_BLOCK, tiles: [V143_TILES.magmaBlock, V143_TILES.magmaBlock, V143_TILES.magmaBlock], mapColor: '#c2410c'
  };
  BLOCK_DEF[B.BLACKSTONE] = {
    name: 'Đá Đen Địa Ngục (Blackstone)', nameEn: 'Blackstone',
    hard: 1.8, solid: true, stone: true, customAtlasTex: true,
    drop: B.BLACKSTONE, tiles: [V143_TILES.blackstone, V143_TILES.blackstone, V143_TILES.blackstone], mapColor: '#27232c'
  };
  BLOCK_DEF[B.BLACKSTONE_BRICKS] = {
    name: 'Gạch Đá Đen Địa Ngục', nameEn: 'Polished Blackstone Bricks',
    hard: 2.0, solid: true, stone: true, customAtlasTex: true,
    drop: B.BLACKSTONE_BRICKS, tiles: [V143_TILES.blackstoneBricks, V143_TILES.blackstoneBricks, V143_TILES.blackstoneBricks], mapColor: '#2d2833'
  };
  BLOCK_DEF[B.MOSSY_STONE_BRICK] = {
    name: 'Gạch Đá Rêu Cổ Đại', nameEn: 'Mossy Stone Bricks',
    hard: 1.8, solid: true, stone: true, customAtlasTex: true,
    drop: B.MOSSY_STONE_BRICK, tiles: [V143_TILES.mossyStoneBrick, V143_TILES.mossyStoneBrick, V143_TILES.mossyStoneBrick], mapColor: '#5c7258'
  };
  BLOCK_DEF[B.WEEPING_VINES] = {
    name: 'Dây Leo Đỏ Địa Ngục', nameEn: 'Weeping Vines',
    hard: 0.08, solid: false, cross: true, trans: true, foliage: true, customAtlasTex: true,
    drop: B.WEEPING_VINES, tiles: [V143_TILES.weepingVines, V143_TILES.weepingVines, V143_TILES.weepingVines], mapColor: '#9f1239'
  };
  BLOCK_DEF[B.TWISTING_VINES] = {
    name: 'Dây Leo Biến Dị', nameEn: 'Twisting Vines',
    hard: 0.08, solid: false, cross: true, trans: true, foliage: true, customAtlasTex: true,
    drop: B.TWISTING_VINES, tiles: [V143_TILES.twistingVines, V143_TILES.twistingVines, V143_TILES.twistingVines], mapColor: '#0d9488'
  };
  BLOCK_DEF[B.IRON_GRATE] = {
    name: 'Lưới Sắt Cổ Đại', nameEn: 'Iron Grate',
    hard: 2.2, solid: true, stone: true, glass: true, trans: true, customAtlasTex: true,
    drop: B.IRON_GRATE, tiles: [V143_TILES.ironGrate, V143_TILES.ironGrate, V143_TILES.ironGrate], mapColor: '#475569'
  };

  {
    const _daTiers = [
      ['IRON',    'iron',    'Sắt',       'Iron',    '#cbd5e1', [2, 2, 4, 2]],
      ['GOLD',    'gold',    'Vàng',      'Gold',    '#facc15', [3, 3, 5, 3]],
      ['DIAMOND', 'diamond', 'Kim Cương', 'Diamond', '#22d3ee', [4, 4, 8, 4]]
    ];
    const _daSlots = [
      ['HEAD', 'head', 'Head', 'Mũ Giáp Đầu Rồng',  'Dragon Head Armor'],
      ['NECK', 'neck', 'Neck', 'Giáp Cổ Rồng',      'Dragon Neck Armor'],
      ['BODY', 'body', 'Body', 'Giáp Thân Rồng',    'Dragon Body Armor'],
      ['TAIL', 'tail', 'Tail', 'Giáp Đuôi Rồng',    'Dragon Tail Armor']
    ];
    for (const [TK, tKey, tVi, tEn, col, defs] of _daTiers) {
      for (let si = 0; si < _daSlots.length; si++) {
        const [SK, sKey, sCap, sVi, sEn] = _daSlots[si];
        const bid = B['DRAGON_ARMOR_' + TK + '_' + SK];
        const tile = DRAGON_ARMOR_TILES[tKey + sCap];
        BLOCK_DEF[bid] = {
          name: `${sVi} ${tVi}`,
          nameEn: `${tEn} ${sEn}`,
          hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true,
          dragonArmorTier: tKey, dragonArmorSlot: sKey, dragonArmorDef: defs[si],
          tiles: [tile, tile, tile], mapColor: col
        };
      }
    }
  }

  // v153: Fishing Loot Items, End Dragon Realm Blocks, End Dragon Scale/Bone Gear (= Sift Tier) & Sovereign Boss Knight Armor
  BLOCK_DEF[B.TROPICAL_FISH]  = { name: 'Cá Nhiệt Đới',          nameEn: 'Tropical Fish',  hard: 0, solid: false, food: true, voxelItem: true, customAtlasTex: true, heal: 2, feed: 2, crumbColor: 0xf97316, tiles: [V153_TILES.tropicalFish, V153_TILES.tropicalFish, V153_TILES.tropicalFish], mapColor: '#fb923c' };
  BLOCK_DEF[B.PUFFERFISH]     = { name: 'Cá Nóc',                nameEn: 'Pufferfish',     hard: 0, solid: false, food: true, voxelItem: true, customAtlasTex: true, heal: 1, feed: 1, puffer: true, crumbColor: 0xfacc15, tiles: [V153_TILES.pufferfish, V153_TILES.pufferfish, V153_TILES.pufferfish], mapColor: '#facc15' };
  BLOCK_DEF[B.ENCHANTED_BOOK] = { name: 'Sách Phù Phép',         nameEn: 'Enchanted Book', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, enchantedBook: true, tiles: [V153_TILES.enchantedBook, V153_TILES.enchantedBook, V153_TILES.enchantedBook], mapColor: '#a855f7' };
  BLOCK_DEF[B.NAME_TAG]       = { name: 'Nhãn Ghi Tên',          nameEn: 'Name Tag',       hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.nameTag, V153_TILES.nameTag, V153_TILES.nameTag], mapColor: '#d6c7a9' };
  BLOCK_DEF[B.NAUTILUS_SHELL] = { name: 'Vỏ Ốc Anh Vũ',          nameEn: 'Nautilus Shell', hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.nautilusShell, V153_TILES.nautilusShell, V153_TILES.nautilusShell], mapColor: '#e2a898' };
  BLOCK_DEF[B.SADDLE]         = { name: 'Yên Ngựa',              nameEn: 'Saddle',         hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.saddle, V153_TILES.saddle, V153_TILES.saddle], mapColor: '#9a3412' };
  BLOCK_DEF[B.BOWL]           = { name: 'Cái Bát Gỗ',            nameEn: 'Bowl',           hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.bowl, V153_TILES.bowl, V153_TILES.bowl], mapColor: '#92400e' };
  BLOCK_DEF[B.LEATHER]        = { name: 'Da Thuộc',              nameEn: 'Leather',        hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.leather, V153_TILES.leather, V153_TILES.leather], mapColor: '#b45309' };
  BLOCK_DEF[B.ROTTEN_FLESH]   = { name: 'Thịt Thối',             nameEn: 'Rotten Flesh',   hard: 0, solid: false, food: true, voxelItem: true, customAtlasTex: true, heal: 1, feed: 4, rotten: true, crumbColor: 0x65a30d, tiles: [V153_TILES.rottenFlesh, V153_TILES.rottenFlesh, V153_TILES.rottenFlesh], mapColor: '#84cc16' };
  BLOCK_DEF[B.STRING]         = { name: 'Sợi Chỉ',               nameEn: 'String',         hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.string, V153_TILES.string, V153_TILES.string], mapColor: '#f1f5f9' };
  BLOCK_DEF[B.WATER_BOTTLE]   = { name: 'Chai Nước',             nameEn: 'Water Bottle',   hard: 0, solid: false, food: true, voxelItem: true, customAtlasTex: true, heal: 1, feed: 1, crumbColor: 0x38bdf8, tiles: [V153_TILES.waterBottle, V153_TILES.waterBottle, V153_TILES.waterBottle], mapColor: '#38bdf8' };
  BLOCK_DEF[B.INK_SAC]        = { name: 'Túi Mực',               nameEn: 'Ink Sac',        hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.inkSac, V153_TILES.inkSac, V153_TILES.inkSac], mapColor: '#1e293b' };
  BLOCK_DEF[B.TRIPWIRE_HOOK]  = { name: 'Móc Dây Bẫy',           nameEn: 'Tripwire Hook',  hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.tripwireHook, V153_TILES.tripwireHook, V153_TILES.tripwireHook], mapColor: '#94a3b8' };
  BLOCK_DEF[B.COCOA_BEANS]    = { name: 'Hạt Ca Cao',            nameEn: 'Cocoa Beans',    hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V153_TILES.cocoaBeans, V153_TILES.cocoaBeans, V153_TILES.cocoaBeans], mapColor: '#7c2d12' };

  BLOCK_DEF[B.DRAGON_REALM_PORTAL] = { name: 'Cổng Thế Giới Rồng The End', nameEn: 'End Dragon Realm Portal', hard: 99, solid: false, trans: true, portal: true, dragonRealmPortal: true, emissive: 0.96, light: 15, unbreakable: true, customAtlasTex: true, tiles: [V153_TILES.dragonRealmPortal, V153_TILES.dragonRealmPortal, V153_TILES.dragonRealmPortal], mapColor: '#a855f7' };
  BLOCK_DEF[B.END_MOSS]            = { name: 'Rêu Hư Không Rồng End',      nameEn: 'Void Dragon Moss',       hard: 0.65, solid: true, dirt: true, customAtlasTex: true, drop: B.END_MOSS, tiles: [V153_TILES.endMossTop, V153_TILES.endMossSide, V153_TILES.endCrystalStone], mapColor: '#5b21b6' };
  BLOCK_DEF[B.END_CRYSTAL_STONE]   = { name: 'Đá Tinh Thể Hư Không',       nameEn: 'Void Crystal Stone',     hard: 2.6, solid: true, rock: true, blastResist: true, reqTier: 3, customAtlasTex: true, drop: B.END_CRYSTAL_STONE, tiles: [V153_TILES.endCrystalStone, V153_TILES.endCrystalStone, V153_TILES.endCrystalStone], mapColor: '#2e1065' };
  BLOCK_DEF[B.VOID_LOG]            = { name: 'Thân Cây Rồng Hư Không',     nameEn: 'Voidwood Log',           hard: 1.25, solid: true, wood: true, isLog: true, customAtlasTex: true, drop: B.VOID_LOG, tiles: [V153_TILES.voidLogTop, V153_TILES.voidLogSide, V153_TILES.voidLogTop], mapColor: '#3b0764' };
  BLOCK_DEF[B.VOID_LEAVES]         = { name: 'Lá Cây Rồng Hư Không',       nameEn: 'Voidwood Leaves',        hard: 0.25, solid: true, foliage: true, leaves: true, neutralLeaf: true, trans: true, shearsOnly: true, light: 5, customAtlasTex: true, drop: B.VOID_LEAVES, tiles: [V153_TILES.voidLeaves, V153_TILES.voidLeaves, V153_TILES.voidLeaves], mapColor: '#7e22ce' };

  BLOCK_DEF[B.END_DRAGON_SCALE]    = { name: 'Vảy Rồng The End',           nameEn: 'End Dragon Scale',       hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, customAtlasTex: true, tiles: [V153_TILES.endDragonScale, V153_TILES.endDragonScale, V153_TILES.endDragonScale], mapColor: '#c084fc' };
  BLOCK_DEF[B.END_DRAGON_BONE]     = { name: 'Xương Rồng The End',         nameEn: 'End Dragon Bone',        hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, customAtlasTex: true, tiles: [V153_TILES.endDragonBone, V153_TILES.endDragonBone, V153_TILES.endDragonBone], mapColor: '#e9d5ff' };
  BLOCK_DEF[B.END_DRAGON_HELMET]   = { name: 'Mũ Giáp Rồng The End (+6)',  nameEn: 'End Dragon Helmet',      hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'helmet', armorVal: 6, toughness: 5.0, kbResist: 0.12, maxDur: 5000, armorTier: 'end_dragon', dragonElemSet: 'end_dragon', customAtlasTex: true, tiles: [V153_TILES.endDragonHelmet, V153_TILES.endDragonHelmet, V153_TILES.endDragonHelmet], mapColor: '#a855f7' };
  BLOCK_DEF[B.END_DRAGON_CHEST]    = { name: 'Áo Giáp Rồng The End (+12)', nameEn: 'End Dragon Chestplate',  hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'chest',  armorVal: 12, toughness: 5.0, kbResist: 0.12, maxDur: 5000, armorTier: 'end_dragon', dragonElemSet: 'end_dragon', customAtlasTex: true, tiles: [V153_TILES.endDragonChest, V153_TILES.endDragonChest, V153_TILES.endDragonChest], mapColor: '#a855f7' };
  BLOCK_DEF[B.END_DRAGON_LEGS]     = { name: 'Quần Giáp Rồng The End (+9)',nameEn: 'End Dragon Leggings',    hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'legs',   armorVal: 9, toughness: 5.0, kbResist: 0.12, maxDur: 5000, armorTier: 'end_dragon', dragonElemSet: 'end_dragon', customAtlasTex: true, tiles: [V153_TILES.endDragonLegs, V153_TILES.endDragonLegs, V153_TILES.endDragonLegs], mapColor: '#a855f7' };
  BLOCK_DEF[B.END_DRAGON_BOOTS]    = { name: 'Giày Giáp Rồng The End (+5)',nameEn: 'End Dragon Boots',       hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'boots',  armorVal: 5, toughness: 5.0, kbResist: 0.12, maxDur: 5000, armorTier: 'end_dragon', dragonElemSet: 'end_dragon', customAtlasTex: true, tiles: [V153_TILES.endDragonBoots, V153_TILES.endDragonBoots, V153_TILES.endDragonBoots], mapColor: '#a855f7' };

  BLOCK_DEF[B.END_DRAGON_SWORD]    = { name: 'Kiếm Xương Rồng The End',    nameEn: 'End Dragon Sword',       hard: 0, solid: false, tool: 'sword',  voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 4.0,  dmg: 20.0, maxDur: 5000, tiles: [V153_TILES.endDragonSword, V153_TILES.endDragonSword, V153_TILES.endDragonSword], mapColor: '#c084fc' };
  BLOCK_DEF[B.END_DRAGON_PICK]     = { name: 'Cúp Xương Rồng The End (Cấp 8)', nameEn: 'End Dragon Pickaxe', hard: 0, solid: false, tool: 'pick', pickTier: 8, voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 24.0, dmg: 9.5,  maxDur: 5000, tiles: [V153_TILES.endDragonPick, V153_TILES.endDragonPick, V153_TILES.endDragonPick], mapColor: '#c084fc' };
  BLOCK_DEF[B.END_DRAGON_AXE]      = { name: 'Rìu Xương Rồng The End',     nameEn: 'End Dragon Axe',         hard: 0, solid: false, tool: 'axe',    voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 22.0, dmg: 16.5, maxDur: 5000, tiles: [V153_TILES.endDragonAxe, V153_TILES.endDragonAxe, V153_TILES.endDragonAxe], mapColor: '#c084fc' };
  BLOCK_DEF[B.END_DRAGON_SHOVEL]   = { name: 'Xẻng Xương Rồng The End',    nameEn: 'End Dragon Shovel',      hard: 0, solid: false, tool: 'shovel', voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 24.0, dmg: 8.0,  maxDur: 5000, tiles: [V153_TILES.endDragonShovel, V153_TILES.endDragonShovel, V153_TILES.endDragonShovel], mapColor: '#c084fc' };
  BLOCK_DEF[B.END_DRAGON_HOE]      = { name: 'Cuốc Đất Rồng The End',      nameEn: 'End Dragon Hoe',         hard: 0, solid: false, tool: 'hoe',    hoeTier: 8, voxelItem: true, fireImmune: true, customAtlasTex: true, mineMul: 24.0, dmg: 7.5,  maxDur: 5000, tiles: [V153_TILES.endDragonHoe, V153_TILES.endDragonHoe, V153_TILES.endDragonHoe], mapColor: '#c084fc' };
  BLOCK_DEF[B.END_DRAGON_BOW]      = { name: 'Cung Xương Rồng The End',    nameEn: 'End Dragon Bow',         hard: 0, solid: false, tool: 'bow',    voxelItem: true, fireImmune: true, customAtlasTex: true, dmg: 20.0, maxDur: 5000, tiles: [V153_TILES.endDragonBow, V153_TILES.endDragonBow, V153_TILES.endDragonBow], mapColor: '#c084fc' };

  BLOCK_DEF[B.SOVEREIGN_KNIGHT_HELMET] = { name: 'Mũ Chiến Thần Long Đế (+7)',     nameEn: 'Sovereign Dragon Helm',       hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'helmet', armorVal: 7,  toughness: 6.0, kbResist: 0.18, maxDur: 7500, armorTier: 'sovereign_knight', sovereignKnightSet: true, dragonElemSet: 'sovereign_knight', customAtlasTex: true, tiles: [V153_TILES.sovereignHelmet, V153_TILES.sovereignHelmet, V153_TILES.sovereignHelmet], mapColor: '#67e8f9' };
  BLOCK_DEF[B.SOVEREIGN_KNIGHT_CHEST]  = { name: 'Áo Giáp Chiến Thần Long Đế (+13)',nameEn: 'Sovereign Dragon Chestplate', hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'chest',  armorVal: 13, toughness: 6.0, kbResist: 0.18, maxDur: 7500, armorTier: 'sovereign_knight', sovereignKnightSet: true, dragonElemSet: 'sovereign_knight', customAtlasTex: true, tiles: [V153_TILES.sovereignChest, V153_TILES.sovereignChest, V153_TILES.sovereignChest], mapColor: '#67e8f9' };
  BLOCK_DEF[B.SOVEREIGN_KNIGHT_LEGS]   = { name: 'Quần Chiến Thần Long Đế (+10)',  nameEn: 'Sovereign Dragon Leggings',   hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'legs',   armorVal: 10, toughness: 6.0, kbResist: 0.18, maxDur: 7500, armorTier: 'sovereign_knight', sovereignKnightSet: true, dragonElemSet: 'sovereign_knight', customAtlasTex: true, tiles: [V153_TILES.sovereignLegs, V153_TILES.sovereignLegs, V153_TILES.sovereignLegs], mapColor: '#67e8f9' };
  BLOCK_DEF[B.SOVEREIGN_KNIGHT_BOOTS]  = { name: 'Giày Chiến Thần Long Đế (+6)',   nameEn: 'Sovereign Dragon Boots',      hard: 0, solid: false, itemOnly: true, voxelItem: true, fireImmune: true, armorSlot: 'boots',  armorVal: 6,  toughness: 6.0, kbResist: 0.18, maxDur: 7500, armorTier: 'sovereign_knight', sovereignKnightSet: true, dragonElemSet: 'sovereign_knight', customAtlasTex: true, tiles: [V153_TILES.sovereignBoots, V153_TILES.sovereignBoots, V153_TILES.sovereignBoots], mapColor: '#67e8f9' };

  BLOCK_DEF[B.SULFUR_BLOCK]     = { name: 'Khối Lưu Huỳnh Vàng',      nameEn: 'Sulfur Block',       hard: 1.1, solid: true, rock: true, customAtlasTex: true, drop: B.SULFUR_BLOCK, tiles: [V156_TILES.sulfurBlock, V156_TILES.sulfurBlock, V156_TILES.sulfurBlock], mapColor: '#eab308' };
  BLOCK_DEF[B.SULFUR_ORE]       = { name: 'Quặng Lưu Huỳnh',           nameEn: 'Sulfur Ore',         hard: 1.8, solid: true, rock: true, reqTier: 1, customAtlasTex: true, drop: B.SULFUR_POWDER, tiles: [V156_TILES.sulfurOre, V156_TILES.sulfurOre, V156_TILES.sulfurOre], mapColor: '#ca8a04' };
  BLOCK_DEF[B.CINNABAR_STONE]   = { name: 'Đá Chu Sa Lưu Huỳnh',      nameEn: 'Cinnabar Sulfur Stone', hard: 1.4, solid: true, rock: true, customAtlasTex: true, drop: B.CINNABAR_STONE, tiles: [V156_TILES.cinnabarStone, V156_TILES.cinnabarStone, V156_TILES.cinnabarStone], mapColor: '#991b1b' };
  BLOCK_DEF[B.TRAVERTINE_STONE] = { name: 'Đá Vôi Khoáng Trắng',     nameEn: 'Travertine Stone',   hard: 1.2, solid: true, rock: true, customAtlasTex: true, drop: B.TRAVERTINE_STONE, tiles: [V156_TILES.travertineStone, V156_TILES.travertineStone, V156_TILES.travertineStone], mapColor: '#e7e5e4' };
  BLOCK_DEF[B.THERMAL_CRUST]    = { name: 'Vỏ Khoáng Địa Nhiệt Cam',   nameEn: 'Thermal Mineral Crust', hard: 1.0, solid: true, rock: true, customAtlasTex: true, drop: B.THERMAL_CRUST, tiles: [V156_TILES.thermalCrust, V156_TILES.thermalCrust, V156_TILES.thermalCrust], mapColor: '#ea580c' };
  BLOCK_DEF[B.SULFUR_CRYSTAL]   = { name: 'Tinh Thể Lưu Huỳnh Phát Sáng', nameEn: 'Sulfur Crystal',  hard: 0.9, solid: true, rock: true, emissive: 0.55, light: 8, customAtlasTex: true, drop: B.SULFUR_POWDER, tiles: [V156_TILES.sulfurCrystal, V156_TILES.sulfurCrystal, V156_TILES.sulfurCrystal], mapColor: '#fde047' };
  BLOCK_DEF[B.SULFUR_VENT]      = { name: 'Miệng Phun Hơi Lưu Huỳnh',  nameEn: 'Sulfur Steam Vent',  hard: 1.6, solid: true, rock: true, emissive: 0.42, light: 7, sulfurVent: true, customAtlasTex: true, drop: B.SULFUR_POWDER, tiles: [V156_TILES.sulfurVent, V156_TILES.sulfurVent, V156_TILES.sulfurVent], mapColor: '#f59e0b' };
  BLOCK_DEF[B.SULFUR_SLIMEBALL] = { name: 'Nhớt Slime Lưu Huỳnh',      nameEn: 'Sulfur Slimeball',   hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V156_TILES.sulfurSlimeball, V156_TILES.sulfurSlimeball, V156_TILES.sulfurSlimeball], mapColor: '#facc15' };
  BLOCK_DEF[B.SULFUR_POWDER]    = { name: 'Bột Khoáng Lưu Huỳnh',      nameEn: 'Sulfur Powder',      hard: 0, solid: false, itemOnly: true, voxelItem: true, customAtlasTex: true, tiles: [V156_TILES.sulfurPowder, V156_TILES.sulfurPowder, V156_TILES.sulfurPowder], mapColor: '#fde047' };

  for (let i = 0; i < BLOCK_LUT_CAP; i++) {
    const d = BLOCK_DEF[i];
    if (!d) continue;
    if (d.solid) {
      IS_SOLID[i] = 1;
      if (!d.foliage && !d.glass && !d.trans && !d.slab && !d.fence && !d.wall && !d.bamboo && !d.cactus && !d.bed && !d.endCrystal && !d.chest && !d.door && !d.trapdoor && !d.dragonEgg && !d.dragonHead && !d.windmillHub) IS_OPAQUE[i] = 1;
    }
    if (d.door) IS_DOOR[i] = 1;
    if (d.door || d.trapdoor) IS_DOOR_OR_TRAP[i] = 1;
    if (d.emissive) IS_EMISSIVE[i] = 1;
    if (d.stairs) IS_STAIRS[i] = 1;
    if (d.slab) IS_SLAB[i] = d.slabTop ? 2 : 1;
    if (d.fence || d.wall) IS_FENCE_WALL[i] = 1;
    if (d.cross || d.torch || d.hangingFruit || d.candle) IS_RAY_NON_SOLID[i] = 1;
  }
  function isWoolBlock(id) { const d = BLOCK_DEF[id]; return !!(d && d.isWool); }
  const BLK_WATER_SEA = 1, BLK_LAVA = 2, BLK_CROSS = 4, BLK_TORCH = 8, BLK_LANTERN = 16, BLK_HANG = 32;
  const BLK_ANIM = 64, BLK_SUB = 128, BLK_FOLIAGE = 256, BLK_CRYSTAL = 512, BLK_PORTAL = 1024;
  const BLK_EMISSIVE = 2048, BLK_GLASS = 4096, BLK_SOLID = 8192;
  const BLOCK_DEF_ARR = new Array(BLOCK_LUT_CAP);
  const BLOCK_FLAGS = new Uint16Array(BLOCK_LUT_CAP);
  for (let i = 0; i < BLOCK_LUT_CAP; i++) {
    const d = BLOCK_DEF[i];
    if (!d) continue;
    BLOCK_DEF_ARR[i] = d;
    let fl = 0;
    if (i === B.WATER || i === B.SEAGRASS) fl |= BLK_WATER_SEA;
    if (i === B.LAVA) fl |= BLK_LAVA;
    if (d.cross) fl |= BLK_CROSS;
    if (d.torch) fl |= BLK_TORCH;
    if (d.lantern) fl |= BLK_LANTERN;
    if (d.hangingFruit) fl |= BLK_HANG;
    if (d.chest || d.door || d.trapdoor || d.endCrystal || d.dragonEgg || d.dragonHead || d.windmillHub) fl |= BLK_ANIM;
    if (d.fence || d.wall || d.bamboo || d.cactus || d.bed || d.stairs || d.slab || d.campfire || d.subBlock || i === B.END_PORTAL_FRAME || i === B.END_PORTAL_FRAME_EYE) fl |= BLK_SUB;
    if (d.foliage) fl |= BLK_FOLIAGE;
    if (d.crystalCluster) fl |= BLK_CRYSTAL;
    if (d.portal) fl |= BLK_PORTAL;
    if (d.emissive) fl |= BLK_EMISSIVE;
    if (d.glass) fl |= BLK_GLASS;
    if (d.solid) fl |= BLK_SOLID;
    BLOCK_FLAGS[i] = fl;
  }
