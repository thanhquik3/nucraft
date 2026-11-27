// NUCRAFT Module: src/mods/ModManager.js — IndexedDB Mod & Minecraft Add-on (.mcpack/.mcaddon/.zip/.json/.js) Loader

  const MOD_DB_NAME = 'nucraft_mods_db_v1';
  const MOD_STORE = 'packs';
  const MAX_MOD_BYTES = 24 * 1024 * 1024;
  let _modDbPromise = null;
  let _installedMods = [];
  let _baseAtlasBackup = null;
  let _baseBlockDefsBackup = null;
  let _baseMobStatsBackup = null;
  let _baseRecipesCount = -1;
  const _baseSoundBackup = new Map();
  const _modCommands = new Map();
  const _modTickHandlers = [];

  const MC_ID_TO_B = {
    air: 0, stone: B.STONE, cobblestone: B.STONE, granite: B.STONE, andesite: B.STONE, deepslate: B.DEEPSLATE,
    grass: B.GRASS, grass_block: B.GRASS, dirt: B.DIRT, farmland: B.FARMLAND, podzol: B.AUTUMN_PODZOL, mycelium: B.MYCELIUM,
    oak_planks: B.PLANKS, planks: B.PLANKS, spruce_planks: B.PLANKS, birch_planks: B.PLANKS, bamboo_planks: B.BAMBOO_PLANKS,
    oak_log: B.OAK_LOG, log: B.OAK_LOG, spruce_log: B.SPRUCE_LOG, birch_log: B.BIRCH_LOG, cherry_log: B.SAKURA_LOG,
    sand: B.SAND, sandstone: B.SANDSTONE, glass: B.GLASS, obsidian: B.OBSIDIAN, terracotta: B.TERRACOTTA,
    netherrack: B.NETHERRACK, end_stone: B.END_STONE, stone_bricks: B.STONE_BRICK, brick_block: B.STONE_BRICK,
    stick: B.STICK, coal: B.COAL, charcoal: B.CHARCOAL, iron_ingot: B.IRON_INGOT, gold_ingot: B.GOLD_INGOT,
    copper_ingot: B.COPPER_INGOT, diamond: B.DIAMOND, emerald: B.EMERALD, redstone: B.REDSTONE,
    netherite_ingot: B.NETHERITE_INGOT, netherite_scrap: B.NETHERITE_SCRAP, raw_iron: B.RAW_IRON, raw_gold: B.RAW_GOLD,
    wheat: B.WHEAT, wheat_seeds: B.WHEAT_SEEDS, bread: B.BREAD, apple: B.APPLE, golden_apple: B.GOLD_APPLE,
    hay_block: B.HAY_BALE, cookie: B.COOKIE, carrot: B.CARROT, golden_carrot: B.GOLDEN_CARROT,
    potato: B.POTATO, baked_potato: B.BAKED_POTATO, beetroot: B.BEETROOT, sweet_berries: B.SWEET_BERRIES,
    melon_slice: B.MELON_SLICE, melon_block: B.MELON_BLOCK, pumpkin_pie: B.PUMPKIN_PIE, cake: B.CAKE_ITEM,
    cooked_beef: B.COOKED_BEEF, beef: B.RAW_BEEF, porkchop: B.RAW_PORK, cooked_porkchop: B.COOKED_PORK,
    torch: B.TORCH_BLOCK, lantern: B.LANTERN, soul_lantern: B.SOUL_LANTERN, campfire: B.CAMPFIRE,
    crafting_table: B.CRAFT_TABLE, furnace: B.FURNACE, chest: B.CHEST, tnt: B.TNT,
    oak_fence: B.OAK_FENCE, cobblestone_wall: B.STONE_WALL, oak_door: B.OAK_DOOR, sugar_cane: B.SUGAR_CANE,
    wooden_pickaxe: B.WOOD_PICK, stone_pickaxe: B.STONE_PICK, iron_pickaxe: B.IRON_PICK, diamond_pickaxe: B.DIAMOND_PICK, netherite_pickaxe: B.NETHERITE_PICK,
    wooden_sword: B.WOOD_SWORD, stone_sword: B.STONE_SWORD, iron_sword: B.IRON_SWORD, diamond_sword: B.DIAMOND_SWORD, netherite_sword: B.NETHERITE_SWORD,
    wooden_axe: B.WOOD_AXE, stone_axe: B.STONE_AXE, iron_axe: B.IRON_AXE, diamond_axe: B.DIAMOND_AXE, netherite_axe: B.NETHERITE_AXE,
    stone_shovel: B.STONE_SHOVEL, iron_shovel: B.IRON_SHOVEL, diamond_shovel: B.DIAMOND_SHOVEL, netherite_shovel: B.NETHERITE_SHOVEL,
    wooden_hoe: B.WOOD_HOE, stone_hoe: B.STONE_HOE, iron_hoe: B.IRON_HOE, golden_hoe: B.GOLD_HOE, diamond_hoe: B.DIAMOND_HOE, netherite_hoe: B.NETHERITE_HOE,
    shears: B.SHEARS, bow: B.BOW, arrow: B.ARROW, shield: B.SHIELD, bucket: B.BUCKET, water_bucket: B.WATER_BUCKET,
    ender_pearl: B.ENDER_PEARL, blaze_rod: B.BLAZE_ROD, blaze_powder: B.BLAZE_POWDER, ender_eye: B.ENDER_EYE
  };

  const MC_TEX_TO_TILES = {
    grass_top: [0], grass_block_top: [0], grass_carried: [0],
    grass_side: [1], grass_block_side: [1], dirt: [2], stone: [3], cobblestone: [3],
    log_oak_top: [4], oak_log_top: [4], log_oak: [5], oak_log: [5],
    leaves_oak: [6], oak_leaves: [6], sand: [7], planks_oak: [8], oak_planks: [8],
    snow: [9], ice: [11], log_spruce: [12], spruce_log: [12], leaves_spruce: [13], spruce_leaves: [13],
    cherry_leaves: [15], sakura_leaves: [15], log_birch: [16], birch_log: [16],
    hardened_clay: [18], terracotta: [18], sandstone_normal: [19], sandstone: [19],
    gold_ore: [20], deepslate: [22], bedrock: [23], coal_ore: [24], iron_ore: [25], diamond_ore: [26],
    stonebrick: [33], stone_bricks: [33], glass: [60], tnt_side: [61], bookshelf: [77],
    obsidian: [80], netherrack: [81], end_stone: [86], emerald_ore: [160], copper_ore: [158],
    hay_block_side: [201], hay_block_top: [202], wheat_stage_7: [208], wheat_stage7: [208], farmland_wet: [209],
    wood_pickaxe: [37], wooden_pickaxe: [37], stone_pickaxe: [38], iron_pickaxe: [39], diamond_pickaxe: [40],
    wood_sword: [41], wooden_sword: [41], stone_sword: [42], iron_sword: [43], diamond_sword: [44],
    wood_axe: [45], wooden_axe: [45], stone_axe: [46], iron_axe: [47], diamond_axe: [48],
    apple: [28], bread: [70], wheat_seeds: [203], wheat: [204], iron_ingot: [220], gold_ingot: [221],
    copper_ingot: [222], diamond: [251], emerald: [253],
    wooden_hoe: [504], stone_hoe: [505], iron_hoe: [506], golden_hoe: [507], diamond_hoe: [508], netherite_hoe: [509]
  };

  function resolveMcItemId(raw) {
    if (typeof raw === 'number' && BLOCK_DEF[raw]) return raw;
    if (!raw || typeof raw !== 'string') return 0;
    const norm = raw.trim().toLowerCase().replace(/^minecraft:/, '').replace(/:.*$/, '');
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

  async function unzipEntries(bufOrU8) {
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
    // Flatten nested .mcpack / .zip bundles inside .mcaddon archives
    const nestedKeys = Array.from(files.keys()).filter((k) => /\.(mcpack|zip)$/i.test(k));
    for (const nk of nestedKeys) {
      try {
        const sub = await unzipEntries(files.get(nk));
        const subBase = nk.replace(/\.(mcpack|zip)$/i, '').split('/').pop();
        for (const [sk, sv] of sub.entries()) files.set(`${subBase}/${sk}`, sv);
      } catch (_) {}
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
        _baseBlockDefsBackup.set(Number(k), { name: d.name, hard: d.hard, dmg: d.dmg, heal: d.heal, feed: d.feed });
      }
    }
    if (!_baseMobStatsBackup && typeof MOB_STATS !== 'undefined') {
      _baseMobStatsBackup = new Map();
      for (const [k, s] of Object.entries(MOB_STATS)) {
        _baseMobStatsBackup.set(k, { hp: s.hp, speed: s.speed, dmg: s.dmg });
      }
    }
    if (_baseRecipesCount < 0 && typeof RECIPES !== 'undefined') {
      _baseRecipesCount = RECIPES.length;
    }
  }

  function refreshWorldVisualsAfterMods() {
    if (typeof atlasCtx !== 'undefined' && typeof atlasCanvas !== 'undefined' && typeof atlasTex !== 'undefined') {
      atlasTex.needsUpdate = true;
      if (typeof bumpTex !== 'undefined' && bumpTex && bumpTex.image) {
        const bCtx = bumpTex.image.getContext('2d');
        const src = atlasCtx.getImageData(0, 0, atlasCanvas.width, atlasCanvas.height);
        const dst = bCtx.createImageData(atlasCanvas.width, atlasCanvas.height);
        for (let i = 0; i < src.data.length; i += 4) {
          const lum = Math.min(255, Math.round(src.data[i] * 0.3 + src.data[i + 1] * 0.59 + src.data[i + 2] * 0.11));
          dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = lum;
          dst.data[i + 3] = 255;
        }
        bCtx.putImageData(dst, 0, 0);
        bumpTex.needsUpdate = true;
      }
    }
    if (typeof _oreThumb3DCache !== 'undefined') _oreThumb3DCache.clear();
    if (typeof terrainMat !== 'undefined' && terrainMat) {
      const toonOn = typeof envUniforms !== 'undefined' && envUniforms.uCartoonMode && envUniforms.uCartoonMode.value > 0.5;
      terrainMat.bumpScale = toonOn ? 0.014 : 0.058;
    }
    if (typeof _rcGridBuiltSig !== 'undefined') _rcGridBuiltSig = '';
    if (typeof markAllLoadedChunksDirty === 'function' && typeof chunks !== 'undefined' && chunks.size) markAllLoadedChunksDirty(true);
    if (typeof renderHotbar === 'function') renderHotbar();
  }

  // Built-in Bare Bones Cartoon Resource Pack: flat graphic 2-tone blocks, solid lush/cherry leaf cubes, & trailer palette
  function applyCartoonBareBonesPack() {
    if (typeof envUniforms !== 'undefined' && envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = 1.0;
    if (typeof atlasCtx === 'undefined' || typeof atlasCanvas === 'undefined') return 0;
    const cols = typeof ATLAS_COLS !== 'undefined' ? ATLAS_COLS : 8;
    const px = typeof TILE_PX !== 'undefined' ? TILE_PX : 16;
    const terrainTiles = new Set();
    const leafTiles = new Set();
    if (typeof BLOCK_DEF !== 'undefined') {
      for (let id = 1; id < BLOCK_DEF.length; id++) {
        const d = BLOCK_DEF[id];
        if (!d || d.itemOnly || d.tool || !Array.isArray(d.tiles)) continue;
        for (const t of d.tiles) if (typeof t === 'number' && t >= 0) {
          terrainTiles.add(t);
          if (d.leaves) leafTiles.add(t);
        }
        if (typeof d.frontTile === 'number' && d.frontTile >= 0) terrainTiles.add(d.frontTile);
      }
    }
    let painted = 0;
    const fillRectTile = (tIdx, col) => {
      const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
      atlasCtx.fillStyle = col;
      atlasCtx.fillRect(tx, ty, px, px);
    };
    const pxTile = (tIdx, x, y, w, h, col) => {
      const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
      atlasCtx.fillStyle = col;
      atlasCtx.fillRect(tx + x, ty + y, w, h);
    };
    // 1. Clean 4x4 Super-Pixel Bare Bones filter across ALL terrain/foliage tiles (making leaves cute solid 2-tone cubes!)
    const img = atlasCtx.getImageData(0, 0, atlasCanvas.width, atlasCanvas.height);
    const d = img.data, W = atlasCanvas.width;
    for (const tIdx of terrainTiles) {
      const tx = (tIdx % cols) * px, ty = Math.floor(tIdx / cols) * px;
      if (tx + px > W || ty + px > atlasCanvas.height) continue;
      const isLeaf = leafTiles.has(tIdx);
      let tr = 0, tg = 0, tb = 0, tcnt = 0;
      if (isLeaf) {
        for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
          const i0 = ((ty + yy) * W + (tx + xx)) * 4;
          if (d[i0 + 3] > 60) { tr += d[i0]; tg += d[i0 + 1]; tb += d[i0 + 2]; tcnt++; }
        }
        if (tcnt > 0) { tr /= tcnt; tg /= tcnt; tb /= tcnt; }
      }
      for (let by = 0; by < px; by += 4) {
        for (let bx = 0; bx < px; bx += 4) {
          let r = 0, g = 0, b = 0, cnt = 0;
          for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
            const idx = ((ty + by + yy) * W + (tx + bx + xx)) * 4;
            if (d[idx + 3] > 60) { r += d[idx]; g += d[idx + 1]; b += d[idx + 2]; cnt++; }
          }
          if (isLeaf) {
            const br = cnt > 0 ? r / cnt : tr, bg = cnt > 0 ? g / cnt : tg, bb = cnt > 0 ? b / cnt : tb;
            const lum = 0.299 * br + 0.587 * bg + 0.114 * bb;
            const tone = (((bx >> 2) + (by >> 2)) & 1) ? 1.07 : 0.94;
            const sat = 1.28;
            const nr = Math.min(255, Math.max(0, Math.round((lum + (br - lum) * sat) * tone + 8)));
            const ng = Math.min(255, Math.max(0, Math.round((lum + (bg - lum) * sat) * tone + 8)));
            const nb = Math.min(255, Math.max(0, Math.round((lum + (bb - lum) * sat) * tone + 6)));
            for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
              const idx = ((ty + by + yy) * W + (tx + bx + xx)) * 4;
              d[idx] = nr; d[idx + 1] = ng; d[idx + 2] = nb; d[idx + 3] = 255;
            }
            continue;
          }
          if (cnt < 3) continue;
          r /= cnt; g /= cnt; b /= cnt;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const sat = 1.28;
          const nr = Math.min(255, Math.max(0, Math.round(lum + (r - lum) * sat + 6)));
          const ng = Math.min(255, Math.max(0, Math.round(lum + (g - lum) * sat + 6)));
          const nb = Math.min(255, Math.max(0, Math.round(lum + (b - lum) * sat + 5)));
          for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
            const idx = ((ty + by + yy) * W + (tx + bx + xx)) * 4;
            if (d[idx + 3] > 60) { d[idx] = nr; d[idx + 1] = ng; d[idx + 2] = nb; }
          }
        }
      }
      painted++;
    }
    atlasCtx.putImageData(img, 0, 0);

    // 2. Signature Bare Bones Trailer Hero Overlays (matching reference screenshots 100%)
    fillRectTile(0, '#59d130');
    pxTile(0, 2, 2, 4, 4, '#6be040'); pxTile(0, 10, 8, 4, 4, '#6be040'); pxTile(0, 4, 11, 3, 2, '#4bc228');
    fillRectTile(1, '#c98842');
    pxTile(1, 0, 0, 16, 4, '#59d130');
    pxTile(1, 0, 4, 4, 2, '#59d130'); pxTile(1, 8, 4, 4, 2, '#59d130'); pxTile(1, 14, 4, 2, 1, '#59d130');
    pxTile(1, 2, 9, 4, 3, '#b57434'); pxTile(1, 10, 11, 4, 3, '#b57434');
    fillRectTile(2, '#c98842');
    pxTile(2, 2, 2, 5, 4, '#b57434'); pxTile(2, 9, 9, 5, 4, '#b57434'); pxTile(2, 11, 3, 3, 3, '#d69852');
    fillRectTile(3, '#8c95a3');
    pxTile(3, 1, 2, 6, 4, '#7d8694'); pxTile(3, 8, 8, 6, 5, '#7d8694'); pxTile(3, 9, 2, 4, 3, '#9da6b5');
    fillRectTile(33, '#929ca8');
    pxTile(33, 0, 7, 16, 1, '#79838f'); pxTile(33, 0, 15, 16, 1, '#79838f');
    pxTile(33, 7, 0, 1, 7, '#79838f'); pxTile(33, 15, 8, 1, 7, '#79838f');
    fillRectTile(4, '#e2ba78');
    pxTile(4, 0, 0, 16, 2, '#754b28'); pxTile(4, 0, 14, 16, 2, '#754b28');
    pxTile(4, 0, 0, 2, 16, '#754b28'); pxTile(4, 14, 0, 2, 16, '#754b28');
    pxTile(4, 5, 5, 6, 6, '#cda05e');
    fillRectTile(5, '#754b28');
    pxTile(5, 2, 0, 3, 16, '#633d1f'); pxTile(5, 9, 0, 3, 16, '#633d1f'); pxTile(5, 6, 0, 2, 16, '#875a33');
    fillRectTile(6, '#4cc42d');
    pxTile(6, 0, 0, 4, 4, '#60d63d'); pxTile(6, 8, 4, 4, 4, '#60d63d'); pxTile(6, 4, 10, 4, 4, '#3da822'); pxTile(6, 12, 12, 4, 4, '#60d63d');
    fillRectTile(13, '#2e8c36');
    pxTile(13, 0, 0, 4, 4, '#3ba644'); pxTile(13, 8, 6, 4, 4, '#3ba644'); pxTile(13, 4, 12, 4, 4, '#24732b');
    fillRectTile(15, '#ff9ec9');
    pxTile(15, 0, 0, 4, 4, '#ffb3d6'); pxTile(15, 8, 4, 4, 4, '#ffb3d6');
    pxTile(15, 4, 10, 4, 4, '#f07eb3'); pxTile(15, 12, 12, 4, 4, '#ffb3d6');
    pxTile(15, 12, 0, 4, 4, '#f07eb3'); pxTile(15, 0, 8, 4, 4, '#f48cbe');
    fillRectTile(16, '#f4efe6');
    pxTile(16, 2, 3, 5, 2, '#4a4e54'); pxTile(16, 10, 7, 4, 2, '#4a4e54'); pxTile(16, 3, 12, 6, 2, '#4a4e54');
    fillRectTile(7, '#f5df8c'); pxTile(7, 3, 3, 5, 3, '#ebd078'); pxTile(7, 9, 10, 5, 3, '#ebd078');
    fillRectTile(8, '#d6a15c');
    for (const yRow of [0, 4, 8, 12]) pxTile(8, 0, yRow + 3, 16, 1, '#b57f3d');
    pxTile(8, 2, 1, 6, 2, '#e2b06b'); pxTile(8, 9, 9, 5, 2, '#e2b06b');
    fillRectTile(9, '#f4f9ff'); pxTile(9, 2, 3, 5, 3, '#dceeff'); pxTile(9, 10, 10, 4, 3, '#dceeff');
    const drawOre = (tIdx, gem) => {
      fillRectTile(tIdx, '#8c95a3');
      pxTile(tIdx, 3, 3, 3, 3, gem); pxTile(tIdx, 10, 4, 3, 2, gem);
      pxTile(tIdx, 4, 10, 3, 3, gem); pxTile(tIdx, 9, 10, 4, 3, gem);
    };
    drawOre(20, '#facc15'); drawOre(24, '#272a30'); drawOre(25, '#f2cdb0');
    drawOre(26, '#38e8ff'); drawOre(158, '#eb7d44'); drawOre(160, '#22e564');
    return painted;
  }

  function drawPngTileOnAtlas(tileIdx, img) {
    if (typeof atlasCtx === 'undefined' || !img) return false;
    const cols = typeof ATLAS_COLS !== 'undefined' ? ATLAS_COLS : 8;
    const px = typeof TILE_PX !== 'undefined' ? TILE_PX : 16;
    const tx = (tileIdx % cols) * px, ty = Math.floor(tileIdx / cols) * px;
    atlasCtx.save();
    atlasCtx.imageSmoothingEnabled = false;
    atlasCtx.clearRect(tx, ty, px, px);
    atlasCtx.drawImage(img, tx, ty, px, px);
    atlasCtx.restore();
    return true;
  }

  function decodeImageFromBytes(u8, mime = 'image/png') {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([u8], { type: mime }));
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image decode fail')); };
      im.src = url;
    });
  }

  function stripJsonComments(str) {
    return String(str || '').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
  }

  function registerShapedOrShapelessRecipe(jsonObj) {
    if (!jsonObj || typeof RECIPES === 'undefined') return 0;
    const shaped = jsonObj['minecraft:recipe_shaped'] || (jsonObj.type === 'minecraft:crafting_shaped' ? jsonObj : null);
    const shapeless = jsonObj['minecraft:recipe_shapeless'] || (jsonObj.type === 'minecraft:crafting_shapeless' ? jsonObj : null);
    const body = shaped || shapeless;
    if (!body) return 0;
    const resObj = Array.isArray(body.result) ? body.result[0] : body.result;
    const outId = resolveMcItemId(resObj && (resObj.item || resObj.id));
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
          const kDef = body.key[k];
          const bid = resolveMcItemId(typeof kDef === 'string' ? kDef : (Array.isArray(kDef) ? kDef[0]?.item : kDef?.item));
          grid[r * 3 + c] = bid;
          addReq(bid);
        }
      }
    } else if (shapeless && Array.isArray(body.ingredients)) {
      for (let i = 0; i < Math.min(9, body.ingredients.length); i++) {
        const ing = body.ingredients[i];
        const bid = resolveMcItemId(typeof ing === 'string' ? ing : ing?.item);
        grid[i] = bid;
        addReq(bid);
      }
    }
    const req = Array.from(reqMap.entries()).map(([id, q]) => ({ id, qty: q }));
    if (!req.length) return 0;
    const cat = BLOCK_DEF[outId].tool || BLOCK_DEF[outId].armorSlot ? 'tools' : (BLOCK_DEF[outId].food ? 'food' : (BLOCK_DEF[outId].solid ? 'blocks' : 'misc'));
    RECIPES.unshift({ cat, is2x2: req.reduce((s, r) => s + r.qty, 0) <= 4, out: outId, qty, req, grid, _isMod: true });
    return 1;
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

  window.NUCRAFT_MOD_API = {
    get B() { return typeof B !== 'undefined' ? B : {}; },
    get BLOCK_DEF() { return typeof BLOCK_DEF !== 'undefined' ? BLOCK_DEF : {}; },
    get RECIPES() { return typeof RECIPES !== 'undefined' ? RECIPES : []; },
    get MOB_STATS() { return typeof MOB_STATS !== 'undefined' ? MOB_STATS : {}; },
    registerRecipe(spec) {
      if (!spec || !spec.out || !Array.isArray(spec.req) || typeof RECIPES === 'undefined') return false;
      RECIPES.unshift(Object.assign({ cat: 'misc', qty: 1, grid: [0,0,0,0,0,0,0,0,0], _isMod: true }, spec));
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
    if (typeof envUniforms !== 'undefined' && envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = 0.0;
    if (_baseBlockDefsBackup && typeof BLOCK_DEF !== 'undefined') {
      for (const [id, st] of _baseBlockDefsBackup.entries()) if (BLOCK_DEF[id]) Object.assign(BLOCK_DEF[id], st);
    }
    if (_baseMobStatsBackup && typeof MOB_STATS !== 'undefined') {
      for (const [k, st] of _baseMobStatsBackup.entries()) if (MOB_STATS[k]) Object.assign(MOB_STATS[k], st);
    }
    if (_baseRecipesCount >= 0 && typeof RECIPES !== 'undefined') {
      RECIPES.length = _baseRecipesCount;
    }
    _modCommands.clear();
    _modTickHandlers.length = 0;
    if (typeof luantiBuffers !== 'undefined') {
      for (const [k, orig] of _baseSoundBackup.entries()) {
        if (orig) luantiBuffers.set(k, orig); else luantiBuffers.delete(k);
      }
      _baseSoundBackup.clear();
    }

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
          for (const [path, bytes] of entries.entries()) {
            const low = path.toLowerCase();
            if (/\.jar$|\.geo\.json$/i.test(low)) { hasGeoOrJar = true; continue; }
            if (/\.(png|webp)$/i.test(low) && (/(^|\/)textures\/(blocks?|items?)\//i.test(low) || /assets\/minecraft\/textures\/(block|item)\//i.test(low))) {
              const stem = low.split('/').pop().replace(/\.(png|webp)$/i, '');
              const targets = MC_TEX_TO_TILES[stem];
              if (targets && targets.length) {
                try {
                  const im = await decodeImageFromBytes(bytes, low.endsWith('.webp') ? 'image/webp' : 'image/png');
                  for (const tIdx of targets) if (drawPngTileOnAtlas(tIdx, im)) stats.tex++;
                } catch (_) {}
              }
            } else if (/\.json$/i.test(low)) {
              try {
                const jObj = JSON.parse(stripJsonComments(new TextDecoder().decode(bytes)));
                if (/(^|\/)recipes?\//i.test(low)) stats.recipe += registerShapedOrShapelessRecipe(jObj);
                else if (/(^|\/)entities\//i.test(low)) stats.mob += applyEntityJsonPatch(jObj);
              } catch (_) {}
            } else if (/\.(ogg|mp3|wav)$/i.test(low) && typeof audioCtx !== 'undefined' && audioCtx && typeof luantiBuffers !== 'undefined') {
              const sKey = low.split('/').pop().replace(/\.(ogg|mp3|wav)$/i, '');
              try {
                if (!_baseSoundBackup.has(sKey)) _baseSoundBackup.set(sKey, luantiBuffers.get(sKey) || null);
                const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                const buf = await audioCtx.decodeAudioData(ab);
                luantiBuffers.set(sKey, buf);
                stats.sound++;
              } catch (_) {}
            }
          }
          if (hasGeoOrJar) stats.warn.push('File .jar/.geo.json mô hình xương phức tạp được bỏ qua an toàn; đã nạp texture/công thức tương thích.');
        }
        pack.runtimeNote = `Texture: ${stats.tex} • Công thức: ${stats.recipe} • Mob/Block: ${stats.mob}${stats.script ? ' • Script ✓' : ''}`;
        pack.warnings = stats.warn;
      } catch (err) {
        pack.enabled = false;
        pack.runtimeNote = `⚠️ Lỗi khi nạp mod (đã tự tắt an toàn): ${err.message || err}`;
        console.error('[ModManager]', err);
      }
    }
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
        description: 'Biến đổi toàn bộ khối, lá cây, bầu trời & nước sang phong cách hoạt hình Bare Bones mượt mà rực rỡ.',
        size: 4096,
        enabled: false,
        installedAt: Date.now() - 1000
      };
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
      cartoonBtn.textContent = activeC ? _t('🎨 Tắt Add-on Đồ Họa Hoạt Hình', '🎨 Disable Cartoon Add-on') : _t('🎨 Bật Add-on Đồ Họa Hoạt Hình', '🎨 Enable Cartoon Add-on');
    }
    const listEl = document.getElementById('modListContainer');
    if (!listEl) return;
    if (!_installedMods.length) {
      listEl.innerHTML = `<div class="mod-empty-msg">${_t('Chưa có Mod hoặc Add-on nào được cài. Hãy bấm <b>+ Tải Mod / Add-on</b> hoặc <b>✨ Cài Add-on Mẫu</b> bên trên!', 'No Mods or Add-ons installed yet. Click <b>+ Upload Mod / Add-on</b> or <b>✨ Install Sample Add-on</b> above!')}</div>`;
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
    } else {
      const u8 = bytesOrText instanceof Uint8Array ? bytesOrText : new Uint8Array(bytesOrText);
      if (u8.byteLength > MAX_MOD_BYTES) throw new Error('File vượt quá 24MB');
      const entries = await unzipEntries(u8);
      for (const [p, v] of entries.entries()) {
        if (/(^|\/)manifest\.json$/i.test(p)) {
          try {
            const mf = JSON.parse(stripJsonComments(new TextDecoder().decode(v)));
            if (mf.header && mf.header.name) name = String(mf.header.name).replace(/§./g, '').slice(0, 48);
            if (mf.header && mf.header.description) description = String(mf.header.description).replace(/§./g, '').slice(0, 140);
            if (mf.header && Array.isArray(mf.header.version)) version = mf.header.version.join('.');
            break;
          } catch (_) {}
        } else if (/(^|\/)pack\.mcmeta$/i.test(p)) {
          try {
            const pm = JSON.parse(stripJsonComments(new TextDecoder().decode(v)));
            if (pm.pack && pm.pack.description) description = String(pm.pack.description).replace(/§./g, '').slice(0, 140);
          } catch (_) {}
        }
      }
      stored = u8;
    }

    const rec = {
      id: 'mod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name, description, version, format, enabled: true, fileName,
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
          description: 'Biến đổi toàn bộ khối, lá cây, bầu trời & nước sang phong cách hoạt hình Bare Bones mượt mà rực rỡ.',
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
        cartoonBtn.textContent = pack.enabled ? _t('🎨 Tắt Add-on Đồ Họa Hoạt Hình', '🎨 Disable Cartoon Add-on') : _t('🎨 Bật Add-on Đồ Họa Hoạt Hình', '🎨 Enable Cartoon Add-on');
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
    if (!_installedMods.some(m => m.id === 'builtin_cartoon_barebones')) {
      const defCartoon = {
        id: 'builtin_cartoon_barebones',
        name: '🎨 Đồ Họa Hoạt Hình (Bare Bones Cartoon)',
        format: 'builtin-cartoon',
        description: 'Biến đổi toàn bộ khối, lá cây, bầu trời & nước sang phong cách hoạt hình Bare Bones mượt mà rực rỡ.',
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
      cartoonBtn.textContent = activeC ? _t('🎨 Tắt Add-on Đồ Họa Hoạt Hình', '🎨 Disable Cartoon Add-on') : _t('🎨 Bật Add-on Đồ Họa Hoạt Hình', '🎨 Enable Cartoon Add-on');
    }
    if (_installedMods.some(m => m.enabled)) await applyAllEnabledMods();
    else renderModManagerList();
    window.toggleCartoonBareBonesAddon = toggleCartoonBareBonesAddon;
  }
  window.initModManager = initModManager;
  window.renderModManagerList = renderModManagerList;
  window.installModBytes = installModBytes;
  window.installSampleMcpackAddon = installSampleMcpackAddon;
