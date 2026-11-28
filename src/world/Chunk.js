// NUCRAFT Module: src/world/Chunk.js — Deterministic noise, Worker cave prefetcher, chunk mesher & emitter lighting

  /* ============================================================================
   * 3. NOISE & 4x4x4 COARSE-GRID 3D CAVE GENERATOR
   * ============================================================================ */
  const _RECENT_SEEDS_KEY = 'nucraft_recent_seeds_v1';
  const _sessionUsedSeeds = new Set();
  function generateUniqueRandomSeed() {
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem(_RECENT_SEEDS_KEY) || '[]');
      if (!Array.isArray(recent)) recent = [];
    } catch (_) { recent = []; }
    const recentSet = new Set(recent);
    let candidate = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      let r1 = 0, r2 = 0;
      try {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const buf = new Uint32Array(2);
          crypto.getRandomValues(buf);
          r1 = buf[0]; r2 = buf[1];
        }
      } catch (_) {}
      const nowMix = (Date.now() ^ Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000)) >>> 0;
      let z = (r1 ^ Math.imul(r2 || 0x9e3779b9, 0x85ebca6b) ^ nowMix ^ Math.floor(Math.random() * 0x7fffffff) ^ Math.imul(attempt + 1, 0x27d4eb2d)) >>> 0;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      z = (z ^ (z >>> 16)) >>> 0;
      // 9-digit positive int (100,000,000 .. 2,147,483,646) — fits 32-bit Math.imul & maxlength="12"
      candidate = 100000000 + (z % 2047483646);
      if (!_sessionUsedSeeds.has(candidate) && !recentSet.has(candidate)) break;
    }
    _sessionUsedSeeds.add(candidate);
    recent.unshift(candidate);
    try { localStorage.setItem(_RECENT_SEEDS_KEY, JSON.stringify(recent.slice(0, 64))); } catch (_) {}
    return candidate;
  }

  let worldSeed = generateUniqueRandomSeed();
  const seedMix = { ox: 0, oy: 0, oz: 0, c1: 1234, c2: 8888, c3: 5521, c4: 9173, b1: 31337, b2: 73319, s1: 424242 };
  function initSeedMix(s) {
    let h = (s | 0) ^ 0x6d2b79f5;
    const next32 = () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
    seedMix.ox = ((next32() % 40000) - 20000);
    seedMix.oy = ((next32() % 40000) - 20000);
    seedMix.oz = ((next32() % 40000) - 20000);
    seedMix.c1 = next32() & 0x3fffffff;
    seedMix.c2 = next32() & 0x3fffffff;
    seedMix.c3 = next32() & 0x3fffffff;
    seedMix.c4 = next32() & 0x3fffffff;
    seedMix.b1 = next32() & 0x3fffffff;
    seedMix.b2 = next32() & 0x3fffffff;
    seedMix.s1 = next32() & 0x3fffffff;
  }
  initSeedMix(worldSeed);

  const UNDERGROUND_BIOMES = {
    LUSH_CAVE:           { id: 0, key: 'lush_cave',           name: '🌿 Hang Rêu Tươi Tốt',      fogHex: 0x0b1f18 },
    CRYSTAL_CAVERN:      { id: 1, key: 'crystal_cavern',      name: '💎 Hang Pha Lê Huyền Ảo',    fogHex: 0x15102b },
    DRIPSTONE_CAVE:      { id: 2, key: 'dripstone_cave',      name: '🪨 Hang Nhũ Đá Cổ',          fogHex: 0x1c1712 },
    GLOWSHROOM_GROTTO:   { id: 3, key: 'glowshroom_grotto',   name: '🍄 Hang Nấm Phát Sáng',      fogHex: 0x1a0f26 },
    ICE_CAVERN:          { id: 4, key: 'ice_cavern',          name: '❄️ Hang Băng Cổ Đại',        fogHex: 0x0c1d2c },
    DEEP_DARK:           { id: 5, key: 'deep_dark',           name: '👁️ Vực Sâu Cổ Đại',          fogHex: 0x060b12 },
    MAGMA_CAVERN:        { id: 6, key: 'magma_cavern',        name: '🔥 Hang Dung Nham',          fogHex: 0x260c0a },
    SUBTERRANEAN_JUNGLE: { id: 7, key: 'subterranean_jungle', name: '🌴 Rừng Nguyên Sinh Ngầm',   fogHex: 0x092414 },
    ANCIENT_MINES:       { id: 8, key: 'ancient_mines',       name: '⛏️ Hầm Mỏ Đá Cổ Đại',       fogHex: 0x191614 },
    SULFUR_CAVE:         { id: 9, key: 'sulfur_cave',         name: '🧪 Hang Lưu Huỳnh',         fogHex: 0x382b08 }
  };

  function isDeepDarkEligibleSurface(wx, wz) {
    if (typeof getOceanMacro !== 'function' || typeof getBiomeAt !== 'function') return false;
    if (getOceanMacro(wx, wz).isOcean) return false;
    const b = getBiomeAt(wx, wz);
    if (b === BIOMES.DEEP_OCEAN || b === BIOMES.ABYSS_TRENCH || b === BIOMES.SWAMP ||
        b === BIOMES.MANGROVE_SWAMP || b === BIOMES.MARSH_RUINS || b === BIOMES.BEACH_PALM ||
        b === BIOMES.TROPICAL_COAST || b === BIOMES.ABANDONED_CITY) return false;
    if (b === BIOMES.ALPINE_PEAKS || b === BIOMES.CLOUD_PEAKS || b === BIOMES.HIGHLAND_PLATEAU || b === BIOMES.SAKURA ||
        b === BIOMES.SNOW || b === BIOMES.SNOWY_PLAINS || b === BIOMES.BADLANDS_SPIRES || b === BIOMES.VOLCANIC_BASALT) return true;
    return typeof getTerrainHeight === 'function' && getTerrainHeight(wx, wz, b) >= 12;
  }

  // Dedicated 2000x2000 Endless Golden Wheat Field & Windmills Overworld Zone (cleanly outside AbandonedCity 2000..7000)
  const WHEAT_PLAIN_MIN_X = 9000, WHEAT_PLAIN_MAX_X = 11000;
  const WHEAT_PLAIN_MIN_Z = 9000, WHEAT_PLAIN_MAX_Z = 11000;
  const WHEAT_PLAIN_CX = 10000, WHEAT_PLAIN_CZ = 10000;
  function isWheatMegaPlain(wx, wz) {
    return currentDimension === 'overworld' &&
      wx >= WHEAT_PLAIN_MIN_X && wx < WHEAT_PLAIN_MAX_X &&
      wz >= WHEAT_PLAIN_MIN_Z && wz < WHEAT_PLAIN_MAX_Z;
  }

  let _acLocSeed = -1, _acLocCache = null;
  function getAncientCityLocations() {
    const s = (typeof worldSeed === 'number' ? worldSeed : 1337);
    if (_acLocCache && _acLocSeed === s) return _acLocCache;
    const spSeedA = Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    const spSeedB = Math.imul(s ^ 0xc2b2ae35, 0x27d4eb2f) >>> 0;
    const ox = (typeof _ruinOriginX === 'number' && (_ruinOriginX !== 0 || _ruinOriginZ !== 0)) ? _ruinOriginX : ((spSeedA % 3600) - 1800);
    const oz = (typeof _ruinOriginX === 'number' && (_ruinOriginX !== 0 || _ruinOriginZ !== 0)) ? _ruinOriginZ : ((spSeedB % 3600) - 1800);
    const out = [];
    for (let qi = 0; qi < 4; qi++) {
      const baseAng = qi * (Math.PI * 0.5) + ((s * (qi + 1) * 0.013) % 1.1);
      let picked = null;
      for (let rad = 160; rad <= 1120 && !picked; rad += 64) {
        for (let da = -0.5; da <= 0.51 && !picked; da += 0.25) {
          const sx = Math.round(ox + Math.cos(baseAng + da) * rad);
          const sz = Math.round(oz + Math.sin(baseAng + da) * rad);
          if (!isDeepDarkEligibleSurface(sx, sz)) continue;
          if (getOceanMacro(sx + 40, sz).isOcean || getOceanMacro(sx - 40, sz).isOcean ||
              getOceanMacro(sx, sz + 40).isOcean || getOceanMacro(sx, sz - 40).isOcean) continue;
          picked = { x: sx, y: -52, z: sz };
        }
      }
      if (!picked) {
        // Fallback: pick farthest dry spot from oceans if seed is abnormally oceanic
        for (let rad = 180; rad <= 1600 && !picked; rad += 96) {
          const sx = Math.round(ox + Math.cos(baseAng) * rad), sz = Math.round(oz + Math.sin(baseAng) * rad);
          if (!getOceanMacro(sx, sz).isOcean) picked = { x: sx, y: -52, z: sz };
        }
      }
      out.push(picked || { x: Math.round(ox + Math.cos(baseAng) * 240), y: -52, z: Math.round(oz + Math.sin(baseAng) * 240) });
    }
    _acLocSeed = s; _acLocCache = out;
    return out;
  }

  function getNearestAncientCity(wx, wz) {
    const list = getAncientCityLocations();
    let best = list[0], bestD2 = Infinity;
    for (let i = 0; i < list.length; i++) {
      const dx = list[i].x - wx, dz = list[i].z - wz, d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = list[i]; }
    }
    return { city: best, dist: Math.sqrt(bestD2) };
  }

  let _dnLocSeed = -1, _dnLocCache = null;
  function getDragonNestLocations() {
    const s = (typeof worldSeed === 'number' ? worldSeed : 1337);
    if (_dnLocCache && _dnLocSeed === s) return _dnLocCache;
    const els = ['fire', 'ice', 'earth', 'water', 'leaf', 'tree'];
    const out = [];
    for (let ni = 0; ni < els.length; ni++) {
      const h1 = Math.imul((s ^ 0x517cc1b7) + ni * 911, 0x85ebca6b) >>> 0;
      const h2 = Math.imul((s ^ 0x94d049bb) + ni * 1307, 0x27d4eb2f) >>> 0;
      const ang = (ni * Math.PI * 2) / els.length + ((h1 % 100) / 100) * 0.55;
      const rad = (ni === 0) ? (135 + (h2 % 90)) : (220 + (h2 % 480));
      let sx = Math.round(Math.cos(ang) * rad), sz = Math.round(Math.sin(ang) * rad);
      const isDrySpot = (tx, tz) =>
        !getOceanMacro(tx, tz).isOcean &&
        !getOceanMacro(tx + 24, tz).isOcean && !getOceanMacro(tx - 24, tz).isOcean &&
        !getOceanMacro(tx, tz + 24).isOcean && !getOceanMacro(tx, tz - 24).isOcean;
      if (els[ni] !== 'water' && !isDrySpot(sx, sz)) {
        for (let rStep = rad; rStep <= 1400; rStep += 48) {
          const tx = Math.round(Math.cos(ang) * rStep), tz = Math.round(Math.sin(ang) * rStep);
          if (isDrySpot(tx, tz)) { sx = tx; sz = tz; break; }
        }
      }
      const bio = getBiomeAt(sx, sz);
      const sy = Math.max(WATER_LEVEL + 3, getTerrainHeight(sx, sz, bio));
      const hasCrystalOre = (ni === 0) ? true : ((h1 % 100) < 68);
      const hasEgg = (ni === 0) ? true : ((h2 % 100) < 62);
      out.push({ idx: ni, el: els[ni], x: sx, y: sy, z: sz, hasCrystalOre, hasEgg });
    }
    _dnLocSeed = s; _dnLocCache = out;
    return out;
  }
  function getNearestDragonNest(wx, wz) {
    const list = getDragonNestLocations();
    let best = list[0], bestD2 = Infinity;
    for (let i = 0; i < list.length; i++) {
      const dx = list[i].x - wx, dz = list[i].z - wz, d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = list[i]; }
    }
    return { nest: best, dist: Math.sqrt(bestD2) };
  }
  function stampDragonNestInChunk(data, wx0, wz0, dOff, maxLy) {
    if (currentDimension !== 'overworld' || dOff !== 0) return maxLy;
    const nests = getDragonNestLocations();
    for (let ni = 0; ni < nests.length; ni++) {
      const n = nests[ni];
      if (wx0 + 15 < n.x - 11 || wx0 > n.x + 11 || wz0 + 15 < n.z - 11 || wz0 > n.z + 11) continue;
      const eggByEl = {
        fire: B.DRAGON_EGG_FIRE, ice: B.DRAGON_EGG_ICE, earth: B.DRAGON_EGG_EARTH,
        water: B.DRAGON_EGG_WATER, leaf: B.DRAGON_EGG_LEAF, tree: B.DRAGON_EGG_TREE
      };
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
        const wx = wx0 + lx, wz = wz0 + lz;
        const dist = Math.hypot(wx - n.x, wz - n.z);
        if (dist > 10.5) continue;
        const colBase = (lz << 4) | lx;
        const rimBoost = dist > 5.5 && dist < 9.5 ? Math.max(0, Math.round((2.2 - Math.abs(dist - 7.5)) * 1.4)) : (dist <= 3.5 ? 0 : 1);
        const topFloor = Math.min(MAX_Y - 8, n.y + rimBoost);
        for (let wy = Math.max(MIN_Y + 2, n.y - 3); wy <= topFloor + 7; wy++) {
          const ly = wy - MIN_Y;
          if (ly < 0 || ly >= WORLD_H) continue;
          const idx = (ly << 8) | colBase;
          if (wy > topFloor) {
            if (dist <= 9.2 && data[idx] !== B.WATER) data[idx] = B.AIR;
            continue;
          }
          let bid = (hash3(wx, wy, wz) > 0.28) ? B.VOLCANIC_STONE : B.BASALT;
          if (n.hasCrystalOre && dist >= 4.2 && dist <= 9.2 && wy >= topFloor - 1 && hash3(wx + 19, wy * 3, wz - 11) > 0.72) {
            bid = B.DRAGON_CRYSTAL_ORE;
          } else if (dist <= 2.2 && wy === topFloor) {
            bid = B.OBSIDIAN;
          }
          data[idx] = bid;
          if (ly > maxLy) maxLy = ly;
        }
        if (wx === n.x && wz === n.z) {
          const pLy = (topFloor + 1) - MIN_Y;
          if (pLy > 0 && pLy < WORLD_H - 2) {
            data[(pLy << 8) | colBase] = B.VOLCANIC_STONE;
            if (pLy > maxLy) maxLy = pLy;
            if (n.hasEgg) {
              data[((pLy + 1) << 8) | colBase] = eggByEl[n.el] || B.DRAGON_EGG_FIRE;
              if (pLy + 1 > maxLy) maxLy = pLy + 1;
            }
          }
        }
      }
    }
    return maxLy;
  }

  function getUndergroundBiomeAt(wx, trueY, wz) {
    if (currentDimension === 'overworld' && trueY <= -14 && trueY >= -76) {
      const acList = getAncientCityLocations();
      for (let i = 0; i < acList.length; i++) {
        if (Math.abs(wx - acList[i].x) <= 72 && Math.abs(wz - acList[i].z) <= 72) return UNDERGROUND_BIOMES.DEEP_DARK;
      }
    }
    if (currentDimension === 'overworld' && trueY <= -4 && trueY >= -96 && getBiomeAt(wx, wz) === BIOMES.SULFUR_SPRINGS) return UNDERGROUND_BIOMES.SULFUR_CAVE;
    const sx = (wx + seedMix.ox * 0.25) * 0.0115;
    const sy = (trueY + seedMix.oy * 0.25) * 0.0185;
    const sz = (wz + seedMix.oz * 0.25) * 0.0115;
    const temp = valueNoise3D(sx, sy, sz, seedMix.b1) * 0.68 + valueNoise3D(sx * 2.3 + 13.7, sy * 2.1, sz * 2.3 - 9.4, seedMix.b1 + 17) * 0.32;
    const humid = valueNoise3D(sx * 1.17 + 31.7, sy * 0.96 - 17.3, sz * 1.17 + 19.1, seedMix.b2) * 0.68 + valueNoise3D(sx * 2.4 - 7.1, sy * 2.2 + 5.3, sz * 2.4 + 21.8, seedMix.b2 + 29) * 0.32;
    const weird = valueNoise3D(sx * 1.45 - 23.1, sy * 1.55 + 41.2, sz * 1.45 + 11.9, seedMix.s1 + 73);
    if (trueY <= -760 && temp > 0.32) return UNDERGROUND_BIOMES.MAGMA_CAVERN;
    if (trueY <= -600 && temp > 0.54) return UNDERGROUND_BIOMES.MAGMA_CAVERN;
    if (temp > 0.69 && trueY <= -40) return UNDERGROUND_BIOMES.MAGMA_CAVERN;
    if (temp > 0.58 && weird > 0.52 && trueY > -140) return UNDERGROUND_BIOMES.SULFUR_CAVE;
    if (temp < 0.28 && humid < 0.56) return UNDERGROUND_BIOMES.ICE_CAVERN;
    if (trueY <= -30 && temp < 0.45 && humid > 0.55 && isDeepDarkEligibleSurface(wx, wz)) return UNDERGROUND_BIOMES.DEEP_DARK;
    if (humid > 0.67 && weird > 0.52) return UNDERGROUND_BIOMES.SUBTERRANEAN_JUNGLE;
    if (humid > 0.59 && temp >= 0.30 && temp <= 0.68) return UNDERGROUND_BIOMES.LUSH_CAVE;
    if (weird > 0.62 && temp < 0.54) return UNDERGROUND_BIOMES.CRYSTAL_CAVERN;
    if (humid > 0.50 && temp >= 0.44) return UNDERGROUND_BIOMES.GLOWSHROOM_GROTTO;
    if (weird < 0.34 && trueY <= -30) return UNDERGROUND_BIOMES.ANCIENT_MINES;
    if (trueY <= -110 && temp < 0.38 && isDeepDarkEligibleSurface(wx, wz)) return UNDERGROUND_BIOMES.DEEP_DARK;
    return UNDERGROUND_BIOMES.DRIPSTONE_CAVE;
  }
  function hash2i(x, z, seed) { let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10; }
  function hash3i(x, y, z, seed) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10; }
  function valueNoise2D(x, z, seed) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2i(xi, zi, seed), b = hash2i(xi + 1, zi, seed), c = hash2i(xi, zi + 1, seed), d = hash2i(xi + 1, zi + 1, seed);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  }
  function valueNoise3D(x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const x00 = hash3i(xi, yi, zi, seed) + (hash3i(xi + 1, yi, zi, seed) - hash3i(xi, yi, zi, seed)) * u;
    const x10 = hash3i(xi, yi + 1, zi, seed) + (hash3i(xi + 1, yi + 1, zi, seed) - hash3i(xi, yi + 1, zi, seed)) * u;
    const x01 = hash3i(xi, yi, zi + 1, seed) + (hash3i(xi + 1, yi, zi + 1, seed) - hash3i(xi, yi, zi + 1, seed)) * u;
    const x11 = hash3i(xi, yi + 1, zi + 1, seed) + (hash3i(xi + 1, yi + 1, zi + 1, seed) - hash3i(xi, yi + 1, zi + 1, seed)) * u;
    return (x00 + (x10 - x00) * v) + ((x01 + (x11 - x01) * v) - (x00 + (x10 - x00) * v)) * w;
  }
  function fbm2D(x, z, octaves, persistence, lacunarity, seed) {
    let val = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) { val += valueNoise2D(x * freq, z * freq, seed + i * 97) * amp; maxAmp += amp; amp *= persistence; freq *= lacunarity; }
    return val / maxAmp;
  }
  function hash2(x, z, seed = worldSeed) { return hash2i(x | 0, z | 0, seed); }
  function hash3(x, y, z, seed = worldSeed) { return hash3i(x | 0, y | 0, z | 0, seed); }
  function fbm2(x, z, octaves = 2, seed = worldSeed) { return fbm2D(x, z, octaves, 0.5, 2.0, seed); }
  // Smooth 5000x5000 Abandoned Modern Megacity Zone (wx in [2000..7000], wz in [2000..7000])
  function isAbandonedCity(wx, wz) {
    return currentDimension === 'overworld' && wx >= 2000 && wx <= 7000 && wz >= 2000 && wz <= 7000;
  }
  // Monumental 1000x1000 Underground Grand Ancient Ruins & End Portal Citadel (wx, wz in [-3504..-2497], buried beneath dry land!)
  const GRAND_RUINS_MIN_X = -3504, GRAND_RUINS_MAX_X = -2497;
  const GRAND_RUINS_MIN_Z = -3504, GRAND_RUINS_MAX_Z = -2497;
  const GRAND_RUINS_CX = -3000, GRAND_RUINS_CZ = -3000;
  const GRAND_RUINS_Y_SHIFT = -34;
  const GRAND_RUINS_PLAZA_Y = 14 + GRAND_RUINS_Y_SHIFT;   // -20 (deep underground!)
  const GRAND_RUINS_PORTAL_Y = 16 + GRAND_RUINS_Y_SHIFT;  // -18 (deep underground!)
  const GRAND_CITADEL_CX = 12000, GRAND_CITADEL_CZ = -12000, GRAND_CITADEL_R = 500;
  function isGrandCitadel(wx, wz) {
    return currentDimension === 'overworld' &&
      Math.abs(wx - GRAND_CITADEL_CX) <= GRAND_CITADEL_R &&
      Math.abs(wz - GRAND_CITADEL_CZ) <= GRAND_CITADEL_R;
  }
  function isGrandRuins(wx, wz) {
    return currentDimension === 'overworld' && wx >= GRAND_RUINS_MIN_X && wx <= GRAND_RUINS_MAX_X && wz >= GRAND_RUINS_MIN_Z && wz <= GRAND_RUINS_MAX_Z;
  }
  function getGrandRuinsSurfaceY(wx, wz) {
    const edgeDist = Math.min(wx - GRAND_RUINS_MIN_X, GRAND_RUINS_MAX_X - wx, wz - GRAND_RUINS_MIN_Z, GRAND_RUINS_MAX_Z - wz);
    const edgeBlend = Math.min(1, Math.max(0, edgeDist / 64));
    const hill = fbm2D(wx * 0.011, wz * 0.011, 3, 0.52, 2.05, worldSeed + 9203);
    const detail = valueNoise2D(wx * 0.052, wz * 0.052, worldSeed + 9209);
    return Math.floor(16 + (hill * 18 + detail * 3.0) * (0.35 + 0.65 * edgeBlend));
  }
  function getSpawnContinentAnchor(seed) {
    const a = Math.imul((seed || 1) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    const b = Math.imul((seed || 1) ^ 0xc2b2ae35, 0x27d4eb2f) >>> 0;
    return { x: (a % 3600) - 1800, z: (b % 3600) - 1800 };
  }
  function getOceanMacro(wx, wz) {
    const sp = getSpawnContinentAnchor(worldSeed);
    const dSp = Math.hypot(wx - sp.x, wz - sp.z);
    // Dry scenic continent (~480m radius) around world spawn while oceans open ~6,000-10,000+ blocks wide outside
    const spawnLift = dSp < 580 ? Math.max(0, 1.0 - dSp / 580) * 0.44 : 0.0;
    // Guarantee the entire 1000x1000 Underground End Portal Ruins + surrounding border sit under solid dry land (NEVER ocean)
    const dRuins = Math.hypot(wx - GRAND_RUINS_CX, wz - GRAND_RUINS_CZ);
    const ruinsLift = dRuins < 1120 ? Math.max(0, 1.0 - Math.max(0, dRuins - 780) / 340) * 0.56 : 0.0;
    const dCit = Math.hypot(wx - GRAND_CITADEL_CX, wz - GRAND_CITADEL_CZ);
    const citadelLift = dCit < 1260 ? Math.max(0, 1.0 - Math.max(0, dCit - 860) / 400) * 0.62 : 0.0;
    const dWheat = Math.max(Math.abs(wx - WHEAT_PLAIN_CX), Math.abs(wz - WHEAT_PLAIN_CZ));
    const wheatLift = dWheat < 1420 ? Math.max(0, 1.0 - Math.max(0, dWheat - 1100) / 320) * 0.58 : 0.0;
    const dCity = Math.max(Math.abs(wx - 4500), Math.abs(wz - 4500));
    const cityLift = dCity < 2920 ? Math.max(0, 1.0 - Math.max(0, dCity - 2620) / 300) * 0.58 : 0.0;
    const landGuard = Math.max(ruinsLift, citadelLift, wheatLift, cityLift);
    const macro = fbm2D(wx * 0.000105, wz * 0.000105, 3, 0.52, 2.0, worldSeed + 4111);
    const coastJitter = (fbm2D(wx * 0.0014, wz * 0.0014, 2, 0.5, 2.0, worldSeed + 411) - 0.5) * 0.14;
    const seaVal = macro + coastJitter + spawnLift + landGuard;
    const isOcean = seaVal < 0.47;
    const openness = isOcean ? Math.max(0, Math.min(1, (0.47 - seaVal) / 0.22)) : 0;
    const ridge = fbm2D(wx * 0.0011, wz * 0.0011, 2, 0.5, 2.0, worldSeed + 4157);
    const trenchFactor = Math.max(0, 1.0 - Math.abs(ridge - 0.5) * 3.8);
    return { isOcean, openness, seaVal, trenchFactor, landGuard };
  }
  function getOceanIslandInfo(wx, wz, openness) {
    if (openness <= 0.08) return null;
    const CELL = 224;
    const gx = Math.floor(wx / CELL), gz = Math.floor(wz / CELL);
    if (hash2i(gx, gz, worldSeed + 6421) > 0.38) return null;
    const ix = (gx + 0.24 + hash2i(gx, gz, worldSeed + 6427) * 0.52) * CELL;
    const iz = (gz + 0.24 + hash2i(gx, gz, worldSeed + 6449) * 0.52) * CELL;
    const rad = 16 + hash2i(gx, gz, worldSeed + 6451) * 24;
    const dist = Math.hypot(wx - ix, wz - iz);
    if (dist > rad * 1.9) return null;
    const ang = Math.atan2(wz - iz, wx - ix);
    const shoreWarp = (valueNoise2D(wx * 0.075, wz * 0.075, worldSeed + 6469) - 0.5) * 0.26 + Math.sin(ang * 3 + gx) * 0.06;
    const normDist = dist / rad + shoreWarp;
    if (normDist > 1.65) return null;
    const kr = hash2i(gx, gz, worldSeed + 6473);
    let kind = 'palm', biome = BIOMES.BEACH_PALM;
    if (kr < 0.24) { kind = 'palm'; biome = BIOMES.BEACH_PALM; }
    else if (kr < 0.44) { kind = 'tropical'; biome = BIOMES.TROPICAL_COAST; }
    else if (kr < 0.60) { kind = 'mushroom'; biome = BIOMES.MUSHROOM_ISLAND; }
    else if (kr < 0.74) { kind = 'volcanic'; biome = BIOMES.VOLCANIC_BASALT; }
    else if (kr < 0.88) { kind = 'sakura'; biome = BIOMES.SAKURA; }
    else { kind = 'atoll'; biome = BIOMES.BEACH_PALM; }
    const det = valueNoise2D(wx * 0.09, wz * 0.09, worldSeed + 6481);
    const inIsland = normDist < 1.0;
    let elevY = 1;
    if (inIsland) {
      const dome = Math.max(0, 1.0 - normDist * normDist);
      if (kind === 'atoll') {
        const ring = Math.max(0, 1.0 - Math.abs(normDist - 0.66) * 3.4);
        elevY = normDist < 0.40 ? -2 : Math.round(-1 + ring * 5.2 + det * 1.4);
      } else if (kind === 'volcanic') {
        const rim = Math.max(0, 1.0 - Math.abs(normDist - 0.30) * 2.8);
        elevY = normDist < 0.20 ? 6 : Math.round(1 + dome * 12 + rim * 10 + det * 2.0);
      } else {
        elevY = Math.round(1 + dome * (kind === 'mushroom' ? 11 : 8.5) + det * 2.2);
      }
    }
    return { inIsland, inSeamount: !inIsland, biome, elevY, normDist, kind };
  }
  function getOceanFloorTrueY(wx, wz, biome) {
    const m = getOceanMacro(wx, wz);
    const isl = getOceanIslandInfo(wx, wz, m.openness);
    if (isl && isl.inIsland) return isl.elevY;
    const cont = fbm2D(wx * 0.011, wz * 0.011, 2, 0.52, 2.05, worldSeed);
    const det = valueNoise2D(wx * 0.052, wz * 0.052, worldSeed + 404);
    let floorY;
    if (m.openness < 0.14) {
      floorY = -5 - (m.openness / 0.14) * 27 + (cont - 0.5) * 6 + det * 2.0;
    } else {
      const op = (m.openness - 0.14) / 0.86;
      const abyss = Math.pow(op, 1.05) * 428;
      const hadal = (m.trenchFactor > 0.35 && op > 0.38)
        ? Math.pow((m.trenchFactor - 0.35) / 0.65, 1.15) * ((op - 0.38) / 0.62) * 255
        : 0;
      floorY = -32 - abyss - hadal + (cont - 0.5) * 24 + det * 3.5;
    }
    if (!m.isOcean && biome === BIOMES.DEEP_OCEAN) floorY = Math.max(floorY, -26);
    floorY = Math.max(-700, Math.min(-3, Math.round(floorY)));
    if (isl && isl.inSeamount) {
      const t = Math.max(0, Math.min(1, (isl.normDist - 1.0) / 0.65));
      const sm = t * t * (3 - 2 * t);
      const smTop = isl.kind === 'atoll' ? -3 : -2;
      floorY = Math.round(smTop + (floorY - smTop) * sm);
    }
    return Math.max(-700, Math.min(-2, floorY));
  }
  function getNetherCastleAnchor(wx, wz) {
    // Twin Hero Medieval Nether Castles near Nether Spawn + frequent Medieval Fortresses across the lava seas!
    if (Math.hypot(wx - 64, wz + 72) < 56) {
      return { x: 64, z: -72, baseY: 7, hero: true, style: 0 };
    }
    if (Math.hypot(wx + 56, wz - 52) < 52) {
      return { x: -56, z: 52, baseY: 8, hero: true, style: 1 };
    }
    const GRID = 168;
    const gx0 = Math.floor(wx / GRID), gz0 = Math.floor(wz / GRID);
    for (let dzg = -1; dzg <= 1; dzg++) {
      for (let dxg = -1; dxg <= 1; dxg++) {
        const rgx = gx0 + dxg, rgz = gz0 + dzg;
        if (rgx === 0 && (rgz === 0 || rgz === -1)) continue;
        if (hash2i(rgx, rgz, worldSeed + 8821) > 0.78) continue;
        const ax = Math.round((rgx + 0.25 + hash2i(rgx, rgz, worldSeed + 8837) * 0.50) * GRID);
        const az = Math.round((rgz + 0.25 + hash2i(rgx, rgz, worldSeed + 8861) * 0.50) * GRID);
        if (Math.abs(wx - ax) <= 44 && Math.abs(wz - az) <= 50) {
          const style = (hash2i(rgx, rgz, worldSeed + 8887) > 0.48) ? 1 : 0;
          return { x: ax, z: az, baseY: 7, hero: false, style };
        }
      }
    }
    return null;
  }

  function getBiomeAt(wx, wz) {
    if (currentDimension === 'warden') {
      if (Math.hypot(wx, wz) < 38) return BIOMES.WARDEN_CITADEL;
      const wn1 = fbm2D(wx * 0.0022, wz * 0.0022, 2, 0.5, 2.0, worldSeed + 7101);
      const wn2 = fbm2D(wx * 0.0026 + 17.3, wz * 0.0026 - 11.7, 2, 0.5, 2.0, worldSeed + 7202);
      if (wn1 > 0.58) return BIOMES.WARDEN_FOREST;
      if (wn2 > 0.62) return BIOMES.WARDEN_CITADEL;
      return BIOMES.WARDEN_REALM;
    }
    if (currentDimension === 'sift') {
      // 6 clearly distinct Sift biomes with domain-warped organic borders:
      // 1) SIFT_CANYON (The Sift central canyon & portal landmark)
      // 2) SIFT_MEADOW (Singer's Meadow: wide pink plains + edge teal forests + 7-color lakes)
      // 3) SIFT_LULLABY (Lullaby Hills: tall teal hills & red mountains + blocky ice-blue trees)
      // 4) SIFT_ICHOR_PONDS (Burrows & Ichor: crimson earth, pink-sand trenches, tilted spires, burrow caves)
      // 5) SIFT_HUSKLAND (Humbler Huskland: dry 2-3 tier red pillar land, pale grass, blue stone, main 7-color lake)
      // 6) SIFT_SPOREFIELDS (Fungal Sporefields: giant mushrooms, violet/cyan fungi, mystic caves)
      if (Math.hypot(wx, wz) < 74) return BIOMES.SIFT_CANYON;
      const swx = wx + (valueNoise2D(wx * 0.0032, wz * 0.0032, worldSeed + 4199) - 0.5) * 58.0;
      const swz = wz + (valueNoise2D(wx * 0.0032 + 31.3, wz * 0.0032 - 17.7, worldSeed + 4211) - 0.5) * 58.0;
      const temp = fbm2D(swx * 0.0026, swz * 0.0026, 3, 0.5, 2.0, worldSeed + 4101);
      const humid = fbm2D(swx * 0.0028 + 19.4, swz * 0.0028 - 14.2, 3, 0.5, 2.0, worldSeed + 4202);
      if (temp < 0.39 && humid >= 0.47) return BIOMES.SIFT_LULLABY;
      if (temp < 0.41 && humid < 0.47) return BIOMES.SIFT_SPOREFIELDS;
      if (temp > 0.61 && humid < 0.49) return BIOMES.SIFT_ICHOR_PONDS;
      if (temp > 0.59 && humid >= 0.49) return BIOMES.SIFT_HUSKLAND;
      if (humid >= 0.53) return BIOMES.SIFT_MEADOW;
      return BIOMES.SIFT_CANYON;
    }
    if (currentDimension === 'dragon_realm') {
      const swx = wx + (valueNoise2D(wx * 0.0024, wz * 0.0024, worldSeed + 8111) - 0.5) * 64.0;
      const swz = wz + (valueNoise2D(wx * 0.0024 + 19.7, wz * 0.0024 - 23.3, worldSeed + 8123) - 0.5) * 64.0;
      const n1 = fbm2D(swx * 0.0030, swz * 0.0030, 3, 0.5, 2.0, worldSeed + 8101);
      const n2 = fbm2D(swx * 0.0036 + 23.1, swz * 0.0036 - 11.7, 3, 0.5, 2.0, worldSeed + 8209);
      if (Math.hypot(wx, wz) < 18 || Math.hypot(wx, wz - 136) < 24) return BIOMES.DR_PLAINS;
      if (n1 > 0.66) return BIOMES.DR_PEAKS;
      if (n2 > 0.63) return BIOMES.DR_JUNGLE;
      if (n1 < 0.34) return BIOMES.DR_CAVERNS;
      if (n2 < 0.38) return BIOMES.DR_PLATEAU;
      return BIOMES.DR_PLAINS;
    }
    if (currentDimension === 'end') return BIOMES.THE_END;
    if (currentDimension === 'nether') {
      if (Math.hypot(wx - 64, wz + 72) < 34) return BIOMES.NETHER_BASALT_DELTAS;
      // Vibrant Minecraft 1.16 Nether biome tapestry: Crimson Forest, Warped Forest, Soul Sand Valley & Basalt Deltas meet across lava valleys!
      const nB = fbm2D(wx * 0.0052, wz * 0.0052, 2, 0.5, 2.0, worldSeed + 707);
      const nB2 = fbm2D(wx * 0.0058 + 19.3, wz * 0.0058 - 14.7, 2, 0.5, 2.0, worldSeed + 733);
      if (nB < 0.36) return BIOMES.NETHER_CRIMSON;
      if (nB > 0.64) return BIOMES.NETHER_WARPED;
      if (nB2 < 0.36) return BIOMES.NETHER_BASALT_DELTAS;
      if (nB2 > 0.60) return BIOMES.NETHER_SOUL_VALLEY;
      return BIOMES.NETHER_WASTES;
    }
    if (isWheatMegaPlain(wx, wz)) return BIOMES.WHEAT_VALLEY;
    if (isAbandonedCity(wx, wz)) return BIOMES.ABANDONED_CITY;
    if (isGrandRuins(wx, wz)) return BIOMES.GRAND_RUINS;
    if (isGrandCitadel(wx, wz)) return BIOMES.PLAINS;
    const _oMac = getOceanMacro(wx, wz);
    if (_oMac.isOcean) {
      const _isl = getOceanIslandInfo(wx, wz, _oMac.openness);
      if (_isl && _isl.inIsland) return _isl.biome;
      return (_oMac.openness > 0.34 || _oMac.trenchFactor > 0.55) ? BIOMES.ABYSS_TRENCH : BIOMES.DEEP_OCEAN;
    }
    const warpX = (valueNoise2D(wx * 0.0016, wz * 0.0016, worldSeed + 511) - 0.5) * 140.0;
    const warpZ = (valueNoise2D(wx * 0.0016 + 19.7, wz * 0.0016 - 23.1, worldSeed + 523) - 0.5) * 140.0;
    const bx = wx + warpX, bz = wz + warpZ;
    const coast = fbm2D(bx * 0.00055, bz * 0.00055, 2, 0.5, 2.0, worldSeed + 411) + (_oMac.landGuard || 0) * 0.45;
    const humid = fbm2D(bx * 0.00048 + 3.1, bz * 0.00048 - 2.7, 2, 0.5, 2.0, worldSeed + 202);
    const heat = fbm2D(bx * 0.00045 - 4.3, bz * 0.00045 + 5.9, 2, 0.5, 2.0, worldSeed + 101);
    const spookyBand = fbm2D(bx * 0.00095 + 11.1, bz * 0.00095 - 7.3, 2, 0.5, 2.0, worldSeed + 677);
    if (coast < 0.14 && humid > 0.62) return BIOMES.MUSHROOM_ISLAND;
    if (coast < 0.14) return BIOMES.DEEP_OCEAN;
    if (coast < 0.21 && humid > 0.60) return BIOMES.MARSH_RUINS;
    if (coast < 0.23) return BIOMES.DEEP_OCEAN;
    if (coast < 0.30 && heat > 0.60) return BIOMES.TROPICAL_COAST;
    if (coast < 0.30 && heat > 0.35) return BIOMES.BEACH_PALM;
    const elev = fbm2D(bx * 0.00072, bz * 0.00072, 2, 0.5, 2.0, worldSeed + 303);
    if (elev > 0.78) return BIOMES.MEGA_SNOW_PEAKS;
    if (elev > 0.71) return BIOMES.CLOUD_PEAKS;
    const plainBand = fbm2D(bx * 0.00058, bz * 0.00058, 2, 0.5, 2.0, worldSeed + 641);
    if (heat < 0.28 && elev > 0.50) return elev > 0.62 ? BIOMES.MEGA_SNOW_PEAKS : BIOMES.ALPINE_PEAKS;
    if (heat < 0.29) return (elev < 0.48 && plainBand > 0.42) ? BIOMES.SNOWY_PLAINS : BIOMES.SNOW;
    if (heat < 0.36 && humid > 0.56) return BIOMES.REDWOOD_ANCIENT;
    if (heat < 0.40) {
      if (heat >= 0.31 && humid > 0.62) return BIOMES.GIANT_TREES;
      if (heat >= 0.29 && humid >= 0.44 && humid <= 0.62 && elev < 0.56) return BIOMES.PINE_VALLEY;
      if (humid > 0.48) return BIOMES.TAIGA;
      return plainBand > 0.46 ? BIOMES.SNOWY_PLAINS : BIOMES.SNOW;
    }
    if (heat > 0.73 && elev > 0.62) return BIOMES.VOLCANIC_BASALT;
    if (heat > 0.56 && heat <= 0.74 && humid >= 0.38 && humid <= 0.68 && elev >= 0.28 && elev <= 0.66 && spookyBand > 0.40) return BIOMES.SULFUR_SPRINGS;
    if (heat > 0.70 && elev < 0.36 && humid < 0.37) return BIOMES.BADLANDS_CRATER;
    if (heat > 0.68 && elev > 0.50) return BIOMES.BADLANDS_SPIRES;
    if (heat > 0.65 && humid >= 0.38 && elev > 0.42) return BIOMES.MESA;
    if (elev > 0.64 && humid >= 0.28 && humid <= 0.66) return BIOMES.HIGHLAND_PLATEAU;
    if (heat > 0.60 && humid < 0.44) return BIOMES.DESERT;
    if (heat > 0.66) return (humid < 0.48) ? BIOMES.DESERT : BIOMES.MESA;
    if (humid > 0.58 && elev > 0.44) {
      if (spookyBand > 0.76) return BIOMES.NIGHTMARE_WOODS;
      if (spookyBand > 0.58) return BIOMES.PALE_GARDEN;
      if (spookyBand < 0.34 && heat >= 0.40 && heat <= 0.60) return BIOMES.DARK_FOREST;
    }
    if (heat >= 0.47 && heat <= 0.61 && humid >= 0.30 && humid <= 0.42 && elev < 0.52) return BIOMES.WHEAT_VALLEY;
    if (elev < 0.53 && heat >= 0.36 && heat <= 0.64 && (humid < 0.44 || (plainBand > 0.52 && humid < 0.60))) return plainBand > 0.68 ? BIOMES.LUSH_STEPPE : (plainBand > 0.50 ? BIOMES.GREEN_PLAINS : BIOMES.PLAINS);
    if (heat > 0.57 && humid > 0.67) return BIOMES.BAMBOO_JUNGLE;
    if (heat > 0.51 && heat <= 0.64 && humid > 0.62 && elev < 0.56) return BIOMES.GIANT_JUNGLE;
    if (heat > 0.59 && heat <= 0.74 && humid > 0.60) return BIOMES.DAPPLED_FOREST;
    if (heat > 0.56 && humid >= 0.44 && humid <= 0.60) {
      if (elev > 0.57) return BIOMES.AUTUMN_DEEP;
      if (humid > 0.52) return BIOMES.AUTUMN_GOLDEN;
      return BIOMES.AUTUMN;
    }
    if (heat >= 0.40 && heat < 0.47 && humid > 0.55 && elev < 0.60) return BIOMES.BLUE_FOREST;
    if (humid > 0.70 && elev > 0.55) return BIOMES.GLOWSHROOM_GROVE;
    if (humid > 0.66 && elev >= 0.46 && elev < 0.56) return BIOMES.WEEPING_GROVE;
    if (humid > 0.63) return elev < 0.40 ? BIOMES.MANGROVE_SWAMP : (elev < 0.47 ? BIOMES.SWAMP : (elev < 0.58 ? BIOMES.LUSH_GROVE : BIOMES.FOREST));
    if (humid > 0.48 && heat > 0.45 && heat <= 0.57) return BIOMES.SAKURA;
    if (humid > 0.42 && humid <= 0.52 && heat >= 0.40 && heat <= 0.47) return BIOMES.BIRCH_ANCIENT;
    if (elev > 0.54 && humid > 0.48) return BIOMES.LAVENDER_MEADOW;
    if (elev > 0.48 && elev <= 0.54 && humid > 0.44 && humid <= 0.53 && heat > 0.40 && heat <= 0.52) return BIOMES.MANOR_GARDEN;
    if (elev > 0.52 && humid > 0.40) return BIOMES.FLOWER_MEADOW;
    return humid >= 0.52 ? BIOMES.FOREST : BIOMES.PLAINS;
  }
  function getRawBiomeHeight(wx, wz, biome) {
    if (biome === BIOMES.ABANDONED_CITY) return 2;
    if (biome === BIOMES.GRAND_RUINS) return getGrandRuinsSurfaceY(wx, wz);
    if (isGrandCitadel(wx, wz)) return 6;
    if (isWheatMegaPlain(wx, wz)) {
      const hill = fbm2D(wx * 0.0055, wz * 0.0055, 2, 0.5, 2.0, worldSeed + 881);
      const wave = valueNoise2D(wx * 0.018, wz * 0.018, worldSeed + 883);
      const edgeDist = Math.min(wx - WHEAT_PLAIN_MIN_X, WHEAT_PLAIN_MAX_X - wx, wz - WHEAT_PLAIN_MIN_Z, WHEAT_PLAIN_MAX_Z - wz);
      const edgeBlend = Math.min(1, Math.max(0, edgeDist / 48));
      return Math.max(2, 2.5 + (hill * 3.8 + wave * 0.7) * edgeBlend);
    }
    const _oMac = getOceanMacro(wx, wz);
    if (_oMac.isOcean) {
      const _isl = getOceanIslandInfo(wx, wz, _oMac.openness);
      if (_isl && _isl.inIsland) return _isl.elevY;
      return Math.max(-44, getOceanFloorTrueY(wx, wz, biome));
    }
    const cont = fbm2D(wx * 0.011, wz * 0.011, 3, 0.52, 2.05, worldSeed);
    const detail = valueNoise2D(wx * 0.052, wz * 0.052, worldSeed + 404);
    let h = -4 + cont * 17 + detail * 2.2;
    if (biome === BIOMES.ABYSS_TRENCH || biome === BIOMES.DEEP_OCEAN) {
      h = Math.max(-44, getOceanFloorTrueY(wx, wz, biome));
    }
    else if (biome === BIOMES.PLAINS || biome === BIOMES.GREEN_PLAINS) {
      const pond = valueNoise2D(wx * 0.028, wz * 0.028, worldSeed + 643);
      const amp = (biome === BIOMES.GREEN_PLAINS) ? 4.4 : 5.2;
      h = (pond < 0.14 && cont < 0.36) ? (WATER_LEVEL - 2.0 + pond * 6) : (1.5 + cont * amp + detail * 0.75);
    }
    else if (biome === BIOMES.SNOWY_PLAINS) {
      const snBay = valueNoise2D(wx * 0.024, wz * 0.024, worldSeed + 649);
      h = (snBay < 0.15 && cont < 0.42) ? (WATER_LEVEL - 2.0 + snBay * 5.5) : (1.5 + cont * 4.4 + detail * 0.65);
    }
    else if (biome === BIOMES.MUSHROOM_ISLAND) h = 1 + cont * 9 + detail * 1.8;
    else if (biome === BIOMES.BEACH_PALM) h = -2.5 + cont * 7.2 + detail * 1.2;
    else if (biome === BIOMES.MANGROVE_SWAMP) h = -2.0 + cont * 4.5 + detail * 0.9;
    else if (biome === BIOMES.MEGA_SNOW_PEAKS) {
      const mPeak = Math.pow(Math.max(0, cont * 1.24 - 0.04), 1.38);
      const ridge = Math.abs(fbm2D(wx * 0.019, wz * 0.019, 2, 0.5, 2.0, worldSeed + 331) - 0.5) * 32;
      h = 54 + mPeak * 68 + ridge + detail * 4.5;
    }
    else if (biome === BIOMES.CLOUD_PEAKS) {
      const mPeak = Math.pow(Math.max(0, cont * 1.18 - 0.08), 1.32);
      const sharp = Math.abs(fbm2D(wx * 0.024, wz * 0.024, 2, 0.5, 2.0, worldSeed + 319) - 0.5) * 20;
      h = 26 + mPeak * 64 + sharp + detail * 4.2;
    }
    else if (biome === BIOMES.ALPINE_PEAKS) { const ridge = Math.pow(Math.max(0, cont * 1.15 - 0.10), 1.35); h = 16 + ridge * 52 + detail * 4.2; }
    else if (biome === BIOMES.HIGHLAND_PLATEAU) h = 14 + cont * 24 + detail * 2.4;
    else if (biome === BIOMES.LUSH_STEPPE) h = 2.0 + cont * 8.0 + detail * 1.2;
    else if (biome === BIOMES.DARK_FOREST) h = -1 + cont * 12 + detail * 2.0;
    else if (biome === BIOMES.PALE_GARDEN) h = 2 + cont * 14 + detail * 2.2;
    else if (biome === BIOMES.NIGHTMARE_WOODS) h = 3 + cont * 18 + Math.abs(detail - 0.5) * 6.0;
    else if (biome === BIOMES.VOLCANIC_BASALT) h = 1 + cont * 19 + detail * 3.0;
    else if (biome === BIOMES.SULFUR_SPRINGS) {
      const bField = fbm2D(wx * 0.038, wz * 0.038, 2, 0.5, 2.0, worldSeed + 7801);
      const ridge = valueNoise2D(wx * 0.016, wz * 0.016, worldSeed + 7803);
      if (bField < 0.39) h = WATER_LEVEL - 2.2;
      else if (bField < 0.47) h = WATER_LEVEL + 1.0;
      else if (bField < 0.55) h = WATER_LEVEL + 2.0 + Math.floor(ridge * 2.0);
      else h = 2.0 + Math.floor((bField - 0.55) * 26.0) + ridge * 5.0;
    }
    else if (biome === BIOMES.BAMBOO_JUNGLE) h = -1 + cont * 15 + detail * 2.2;
    else if (biome === BIOMES.REDWOOD_ANCIENT) h = 1 + cont * 18 + detail * 2.4;
    else if (biome === BIOMES.WEEPING_GROVE) h = -1.5 + cont * 10 + detail * 1.6;
    else if (biome === BIOMES.BIRCH_ANCIENT) h = 0 + cont * 13 + detail * 2.0;
    else if (biome === BIOMES.SWAMP) h = -2.4 + cont * 6.5 + detail * 1.2;
    else if (biome === BIOMES.LUSH_GROVE) h = -2.8 + cont * 12 + detail * 2.0;
    else if (biome === BIOMES.DESERT) h = -1 + cont * 13 + detail * 1.8;
    else if (biome === BIOMES.SNOW) h = 1 + cont * 22 + detail * 3.2;
    else if (biome === BIOMES.TAIGA) h = -1 + cont * 19 + detail * 2.8;
    else if (biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_GOLDEN || biome === BIOMES.AUTUMN_DEEP) h = -2 + cont * 15 + detail * 2.2;
    else if (biome === BIOMES.FLOWER_MEADOW || biome === BIOMES.LAVENDER_MEADOW) h = 0 + cont * 11 + detail * 1.6;
    else if (biome === BIOMES.MESA) {
      const mPlateau = fbm2D(wx * 0.015, wz * 0.015, 2, 0.5, 2.0, worldSeed + 733);
      const raw = 2 + Math.max(0, mPlateau - 0.22) * 46;
      h = Math.floor(raw / 3) * 3 + (raw % 3) * 0.25 + detail * 1.0;
    }
    // ===== v24 biomes =====
    else if (biome === BIOMES.GLOWSHROOM_GROVE) h = -1 + cont * 13 + detail * 2.2;
    else if (biome === BIOMES.DAPPLED_FOREST) h = -2 + cont * 14 + detail * 2.0;
    else if (biome === BIOMES.BADLANDS_SPIRES) {
      const sField = fbm2D(wx * 0.036, wz * 0.036, 2, 0.5, 2.0, worldSeed + 719);
      const sPlat = fbm2D(wx * 0.014, wz * 0.014, 2, 0.5, 2.0, worldSeed + 727);
      const spire = sField > 0.57 ? Math.pow((sField - 0.57) / 0.43, 1.15) * 38 : (sPlat > 0.62 ? Math.floor((sPlat - 0.62) * 42) : 0);
      h = 2 + Math.min(46, Math.floor(spire / 2) * 2) + detail * 1.1;
    }
    else if (biome === BIOMES.BADLANDS_CRATER) h = -4 + cont * 7 + detail * 1.4;
    else if (biome === BIOMES.MARSH_RUINS) h = -2.6 + cont * 4.6 + detail * 1.0;
    else if (biome === BIOMES.TROPICAL_COAST) h = -1.5 + cont * 9 + detail * 1.6;
    else if (biome === BIOMES.GIANT_TREES) h = 0 + cont * 18 + detail * 2.6;
    else if (biome === BIOMES.MANOR_GARDEN) h = -1 + cont * 10 + detail * 1.4;
    else if (biome === BIOMES.BLUE_FOREST) {
      h = (cont < 0.25 && detail < 0.18) ? (WATER_LEVEL - 1.0) : (0.5 + cont * 11 + detail * 1.6);
    }
    else if (biome === BIOMES.WHEAT_VALLEY) h = 2.0 + cont * 4.0 + detail * 0.5;
    else if (biome === BIOMES.PINE_VALLEY) {
      h = (cont < 0.26 && detail < 0.22) ? (WATER_LEVEL - 1.0) : (-0.5 + cont * 12 + detail * 1.5);
    }
    else if (biome === BIOMES.GIANT_JUNGLE) {
      const jr = Math.abs(fbm2D(wx * 0.0085, wz * 0.0085, 2, 0.5, 2.0, worldSeed + 743) - 0.5);
      h = jr < 0.09 ? (WATER_LEVEL - 2.4) : (-0.5 + cont * 13 + detail * 2.0);
    }
    return h;
  }
  // Shared procedural layered mesa / stepped terrace / tall spire terrain math (used by BOTH Dream Biome & Dragon Realm with strictly separate palettes!)
  function getRealmGenCfg() {
    return (typeof window !== 'undefined' && window.NUCRAFT_REALM_CONFIG) ? window.NUCRAFT_REALM_CONFIG : {
      dreamWater: { healAmount: 1, healIntervalSec: 1.75, sparkleIntervalSec: 0.26, sparkleRadius: 14 },
      sharedTerrain: { warpScale: 0.0046, warpAmp: 22.0, continentalScale: 0.0085, continentalOctaves: 4, erosionScale: 0.012, erosionOctaves: 3, detailScale: 0.048, mesaStepHeight: 3, overhangScale: 0.056, overhangThreshold: 0.62, overhangCarveDepth: 3, archCellSize: 46, archChance: 0.22 },
      dreamRealm: { waterLevel: 0, baseMinY: -5, baseMaxY: 32, pondThreshold: 0.34, spireCellSize: 22, spireChance: 0.38, spireMinH: 13, spireMaxH: 27, spireBaseRMin: 2.6, spireBaseRMax: 4.5, spireCapFlare: 1.45, treeChance: 0.036, treeMinH: 8, treeMaxH: 22 },
      dragonRealm: { baseMinY: 12, baseMaxY: 46, spireCellSize: 18, spireChance: 0.46, spireMinH: 16, spireMaxH: 36, spireBaseRMin: 2.5, spireBaseRMax: 4.4, spireCapFlare: 1.55, sandAccentThreshold: 0.63, mintCrystalChance: 0.044, mintCrystalMinH: 3, mintCrystalMaxH: 8 }
    };
  }

  // Raw per-biome Sift terrain height (6 genuinely distinct profiles!) before 5-point border smoothing
  function _sampleSiftBiomeRawY(wx, wz, biome, cont, erosion, mesaRidge, detail, stepH) {
    let rawY = 4.0, isMesaPlateau = false, isPondBasin = false, isSteppingStone = false, isTrench = false, isIchorPit = false;
    if (biome === BIOMES.SIFT_MEADOW) {
      // b) Singer's Meadow: wide gently rolling pink grass plains + scattered 7-color lakes (Ref 2/8)
      const lakeN = fbm2D(wx * 0.017 + 7.1, wz * 0.017 - 11.3, 2, 0.5, 2.0, worldSeed + 4513);
      if (lakeN < 0.27) {
        isPondBasin = true;
        const islN = valueNoise2D(wx * 0.16, wz * 0.16, worldSeed + 4519);
        if (islN > 0.84) { isSteppingStone = true; rawY = WATER_LEVEL + 1; }
        else rawY = WATER_LEVEL - 1.5 - ((0.27 - lakeN) / 0.27) * 3.2;
      } else {
        rawY = WATER_LEVEL + 2.5 + cont * 4.5 + detail * 1.1;
      }
    } else if (biome === BIOMES.SIFT_LULLABY || biome === BIOMES.SIFT_LULLABY_TOP) {
      // c) Lullaby Hills: tall climbable teal hills, high red-flanked mountains, valleys & steep slopes (Refs 4/6 & 7/3)
      const mtnN = fbm2D(wx * 0.011 - 15.2, wz * 0.011 + 8.7, 4, 0.54, 2.05, worldSeed + 4547);
      const ridge = 1.0 - Math.abs(mesaRidge - 0.5) * 2.0;
      const hillH = Math.pow(Math.max(0, mtnN * 0.72 + ridge * 0.34 - 0.12), 1.38) * 36.0;
      rawY = WATER_LEVEL + 3.0 + hillH + detail * 2.2;
      isMesaPlateau = (hillH > 18.0 && erosion < 0.42);
    } else if (biome === BIOMES.SIFT_ICHOR_PONDS) {
      // d) Burrows & Ichor: crimson earth, winding pink-sand trenches & deep burrow pits with glowing ichor (Refs 5 & 10)
      const trenchRidge = Math.abs(fbm2D(wx * 0.024 + 21.3, wz * 0.024 - 16.9, 3, 0.5, 2.0, worldSeed + 4561) - 0.5);
      const pitN = valueNoise2D(wx * 0.048 - 5.1, wz * 0.048 + 9.7, worldSeed + 4567);
      if (trenchRidge < 0.075) {
        isTrench = true;
        const depthT = (0.075 - trenchRidge) / 0.075;
        rawY = WATER_LEVEL + 3.0 - depthT * 7.5;
        if (rawY < WATER_LEVEL - 2.5) isIchorPit = true;
      } else if (pitN < 0.16) {
        isTrench = true;
        isIchorPit = (pitN < 0.085);
        rawY = WATER_LEVEL - 4.5 + (pitN / 0.16) * 5.0;
      } else {
        const stepped = Math.floor((6.5 + cont * 12.0 + (1.0 - erosion) * 6.0) / 2.0) * 2.0;
        rawY = WATER_LEVEL + stepped + detail * 1.4;
        isMesaPlateau = (rawY > WATER_LEVEL + 13);
      }
    } else if (biome === BIOMES.SIFT_HUSKLAND) {
      // e) Humbler Huskland: wide dry pillar plain + large sprawling 7-color main lake + distant red rock mountains (Ref 1/9)
      const mainLakeN = fbm2D(wx * 0.0115 - 31.4, wz * 0.0115 + 19.8, 3, 0.5, 2.0, worldSeed + 4583);
      if (mainLakeN < 0.34) {
        isPondBasin = true;
        const islN = valueNoise2D(wx * 0.145, wz * 0.145, worldSeed + 4591);
        if (islN > 0.82) { isSteppingStone = true; rawY = WATER_LEVEL + 1; }
        else rawY = WATER_LEVEL - 1.5 - ((0.34 - mainLakeN) / 0.34) * 4.5;
      } else if (mainLakeN > 0.72) {
        // Distant towering red rock mountains framing the pillar plain (Ref 1/9 right corner)
        const mtn = Math.pow((mainLakeN - 0.72) / 0.28, 1.25) * 32.0;
        rawY = WATER_LEVEL + 7.0 + Math.floor(mtn / 2) * 2 + detail * 1.8;
        isMesaPlateau = true;
      } else {
        rawY = WATER_LEVEL + 3.0 + Math.floor(cont * 4.0) * 1.5 + detail * 1.2;
      }
    } else if (biome === BIOMES.SIFT_SPOREFIELDS) {
      // f) Fungal Sporefields: rolling spongy violet-mushroom hills, mystic hollows & glowing ponds
      const pondN = fbm2D(wx * 0.022 + 4.3, wz * 0.022 - 14.7, 2, 0.5, 2.0, worldSeed + 4603);
      if (pondN < 0.24) {
        isPondBasin = true;
        rawY = WATER_LEVEL - 1.5 - ((0.24 - pondN) / 0.24) * 2.5;
      } else {
        rawY = WATER_LEVEL + 2.5 + cont * 11.5 + Math.sin(wx * 0.05) * Math.cos(wz * 0.05) * 1.8 + detail * 1.5;
      }
    } else {
      // a) The Sift (Central Canyon): dramatic stepped red-pink cliffs, deep chasms, canyon river/lakes, natural stone bridges (Refs 1, 2, 7)
      const chasmRidge = Math.abs(fbm2D(wx * 0.019 - 7.3, wz * 0.019 + 11.9, 3, 0.5, 2.0, worldSeed + 4621) - 0.5);
      if (chasmRidge < 0.09 && Math.hypot(wx, wz) > 18) {
        isPondBasin = true;
        const islN = valueNoise2D(wx * 0.15, wz * 0.15, worldSeed + 4637);
        if (islN > 0.80) { isSteppingStone = true; rawY = WATER_LEVEL + 1; }
        else rawY = WATER_LEVEL - 2.0 - ((0.09 - chasmRidge) / 0.09) * 4.0;
      } else {
        const mesaBoost = Math.max(0, (1.0 - erosion) * 0.65 + mesaRidge * 0.35 - 0.22);
        isMesaPlateau = (mesaBoost > 0.16);
        const rawElev = 3.5 + cont * 12.0 + Math.pow(mesaBoost, 1.12) * 19.0;
        rawY = WATER_LEVEL + Math.floor(rawElev / stepH) * stepH + (detail > 0.72 ? 1 : 0);
      }
    }
    return { rawY, isMesaPlateau, isPondBasin, isSteppingStone, isTrench, isIchorPit };
  }

  function sampleSharedMesaBase(wx, wz, realmKind, biome, skipBlend = false) {
    const cfg = getRealmGenCfg();
    const sh = cfg.sharedTerrain;
    const isDream = (realmKind === 'sift');
    const rc = isDream ? cfg.dreamRealm : cfg.dragonRealm;
    const sOff = isDream ? 4400 : 8300;
    const warpX = (valueNoise2D(wx * sh.warpScale, wz * sh.warpScale, worldSeed + sOff + 13) - 0.5) * sh.warpAmp;
    const warpZ = (valueNoise2D(wx * sh.warpScale + 27.3, wz * sh.warpScale - 19.1, worldSeed + sOff + 29) - 0.5) * sh.warpAmp;
    const swx = wx + warpX, swz = wz + warpZ;
    const cont = fbm2D(swx * sh.continentalScale, swz * sh.continentalScale, sh.continentalOctaves, 0.52, 2.05, worldSeed + sOff + 101);
    const erosion = fbm2D(swx * sh.erosionScale + 17.7, swz * sh.erosionScale - 13.3, sh.erosionOctaves, 0.5, 2.0, worldSeed + sOff + 211);
    const mesaRidge = fbm2D(swx * 0.017 - 9.4, swz * 0.017 + 14.2, 3, 0.5, 2.0, worldSeed + sOff + 307);
    const detail = valueNoise2D(wx * sh.detailScale, wz * sh.detailScale, worldSeed + sOff + 409);
    const stepH = Math.max(2, sh.mesaStepHeight | 0);
    const rangeY = rc.baseMaxY - rc.baseMinY;

    if (isDream) {
      const center = _sampleSiftBiomeRawY(wx, wz, biome, cont, erosion, mesaRidge, detail, stepH);
      let rawY = center.rawY;
      let edgeFactor = 0;
      // Smooth 5-point biome border blending so adjacent biomes transition organically without cliff seams!
      if (!skipBlend) {
        const bOff = 9;
        const bN = getBiomeAt(wx, wz - bOff), bS = getBiomeAt(wx, wz + bOff);
        const bW = getBiomeAt(wx - bOff, wz), bE = getBiomeAt(wx + bOff, wz);
        let diffCnt = 0;
        if (bN !== biome) diffCnt++;
        if (bS !== biome) diffCnt++;
        if (bW !== biome) diffCnt++;
        if (bE !== biome) diffCnt++;
        edgeFactor = diffCnt * 0.25;
        if (diffCnt > 0) {
          let sumY = rawY * 2.0, wSum = 2.0;
          for (const [ox, oz, nb] of [[0, -bOff, bN], [0, bOff, bS], [-bOff, 0, bW], [bOff, 0, bE]]) {
            if (nb === biome) { sumY += rawY; wSum += 1.0; }
            else {
              const ns = _sampleSiftBiomeRawY(wx + ox, wz + oz, nb, cont, erosion, mesaRidge, detail, stepH);
              sumY += ns.rawY; wSum += 1.0;
            }
          }
          rawY = sumY / wSum;
        }
      }
      const baseH = Math.max(MIN_Y + 6, Math.min(MAX_Y - 46, Math.floor(rawY)));
      return {
        baseH, cont, erosion, mesaRidge, detail, edgeFactor,
        isMesaPlateau: center.isMesaPlateau,
        isPondBasin: center.isPondBasin && baseH <= WATER_LEVEL,
        isSteppingStone: center.isSteppingStone,
        isTrench: center.isTrench,
        isIchorPit: center.isIchorPit
      };
    }

    // Dragon Realm: shared stepped mesa/terrace build method, elevated dry terraced red-rock badlands & valleys
    let rawY = rc.baseMinY, isMesaPlateau = false;
    const elevScore = cont * 0.56 + (1.0 - erosion) * 0.44;
    const mesaBoost = Math.max(0, (1.0 - erosion) * 0.58 + mesaRidge * 0.42 - 0.28);
    if (mesaBoost > 0.16 || biome === BIOMES.DR_PLATEAU || biome === BIOMES.DR_PEAKS) {
      isMesaPlateau = true;
      const rawElev = rc.baseMinY + elevScore * (rangeY * 0.52) + Math.pow(mesaBoost, 1.12) * (rangeY * 0.68);
      rawY = Math.floor(rawElev / stepH) * stepH + (detail > 0.74 ? 1 : 0);
    } else {
      const gentle = rc.baseMinY + 2.0 + elevScore * (rangeY * 0.36) + detail * 1.8;
      rawY = Math.floor(gentle / 2) * 2 + (detail > 0.62 ? 1 : 0);
    }
    if (biome === BIOMES.DR_PEAKS) rawY += Math.floor(Math.max(0, mesaRidge - 0.32) * 16);
    const baseH = Math.max(MIN_Y + 6, Math.min(MAX_Y - 46, Math.floor(rawY)));
    return { baseH, cont, erosion, mesaRidge, detail, edgeFactor: 0, isMesaPlateau, isPondBasin: false, isSteppingStone: false, isTrench: false, isIchorPit: false };
  }

  function sampleSharedSpireAt(wx, wz, realmKind) {
    const cfg = getRealmGenCfg();
    const isDream = (realmKind === 'sift');
    const rc = isDream ? cfg.dreamRealm : cfg.dragonRealm;
    const sOff = isDream ? 4400 : 8300;
    const cell = isDream ? 18 : rc.spireCellSize;
    const cgx = Math.floor(wx / cell), cgz = Math.floor(wz / cell);
    let best = null;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cgx + dx, gz = cgz + dz;
        const rExist = hash2i(gx, gz, worldSeed + sOff + 601);
        const jx = hash2i(gx, gz, worldSeed + sOff + 613);
        const jz = hash2i(gx, gz, worldSeed + sOff + 619);
        const sx = Math.floor((gx + 0.18 + jx * 0.64) * cell);
        const sz = Math.floor((gz + 0.18 + jz * 0.64) * cell);
        if (Math.hypot(sx, sz) < (isDream ? 20 : 22)) continue;
        if (!isDream && Math.hypot(sx, sz - 136) < 26) continue;
        const anchorBio = getBiomeAt(sx, sz);
        // Biome-specific spire rules in The Sift!
        let localChance = rc.spireChance;
        let isBurrows = false, isHuskland = false, isCentralSift = false;
        if (isDream) {
          if (anchorBio === BIOMES.SIFT_MEADOW || anchorBio === BIOMES.SIFT_SPOREFIELDS) continue; // Keep pink meadow & fungal forest pillar-free!
          isHuskland = (anchorBio === BIOMES.SIFT_HUSKLAND);
          isBurrows = (anchorBio === BIOMES.SIFT_ICHOR_PONDS);
          isCentralSift = (anchorBio === BIOMES.SIFT_CANYON);
          localChance = isHuskland ? 0.56 : (isBurrows ? 0.48 : (isCentralSift ? 0.40 : 0.26));
        }
        if (rExist > localChance) continue;
        const rBaseRaw = rc.spireBaseRMin + hash2i(gx, gz, worldSeed + sOff + 631) * (rc.spireBaseRMax - rc.spireBaseRMin);
        const rBase = isCentralSift ? Math.max(3.4, rBaseRaw * 1.18) : rBaseRaw;
        const capFlare = 0.85 + hash2i(gx, gz, worldSeed + sOff + 641) * (rc.spireCapFlare - 0.85);
        const rStyle = hash2i(gx, gz, worldSeed + sOff + 661);
        const isSandSpire = (!isDream && rStyle > 0.82) || (isBurrows && rStyle > 0.58);
        const tiltMul = isBurrows ? 0.20 : 0.08;
        const leanX = (hash2i(gx, gz, worldSeed + sOff + 673) - 0.5) * tiltMul;
        const leanZ = (hash2i(gx, gz, worldSeed + sOff + 677) - 0.5) * tiltMul;
        const rH = hash2i(gx, gz, worldSeed + sOff + 653);
        const minH = isHuskland ? 16 : (isBurrows ? 14 : rc.spireMinH);
        const maxH = isHuskland ? 32 : (isBurrows ? 28 : rc.spireMaxH);
        const height = Math.floor(minH + rH * (maxH - minH + 1));
        const maxFootprint = rBase * 1.38 + capFlare + Math.hypot(leanX, leanZ) * height + 1.4;
        if (Math.hypot(wx - sx, wz - sz) > maxFootprint) continue;
        const anchorSample = sampleSharedMesaBase(sx, sz, realmKind, anchorBio, true);
        if (isDream && !isHuskland && anchorSample.baseH < WATER_LEVEL) continue;
        if (isHuskland && anchorSample.baseH < WATER_LEVEL - 3) continue;
        const hasVolcanicCap = (!isDream && !isSandSpire && rStyle < 0.16 && height >= 26);
        const topY = Math.min(MAX_Y - 14, anchorSample.baseH + height);
        const cand = {
          sx, sz, gx, gz, anchorY: anchorSample.baseH, topY, height, anchorBio,
          baseR: isSandSpire ? rBase * 0.88 : rBase,
          capFlare: isSandSpire ? 0.0 : capFlare,
          leanX, leanZ, isSandSpire, hasVolcanicCap, isHuskland, isBurrows, isCentralSift,
          seedH: hash2i(gx, gz, worldSeed + sOff + 683)
        };
        if (!best || cand.topY > best.topY) best = cand;
      }
    }
    return best;
  }

  // Deterministic 3D Floating Island evaluator across ALL 6 Sift biomes (single-tree, clusters w/ sky bridges, towers, temples, rare boss vaults!)
  function sampleSiftFloatingIslandAt(wx, wz) {
    const cell = 38;
    const cgx = Math.floor(wx / cell), cgz = Math.floor(wz / cell);
    let best = null;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cgx + dx, gz = cgz + dz;
        const rExist = hash2i(gx, gz, worldSeed + 5101);
        if (rExist > 0.54) continue; // generous floating islands in every biome!
        const ix = Math.floor((gx + 0.22 + hash2i(gx, gz, worldSeed + 5113) * 0.56) * cell);
        const iz = Math.floor((gz + 0.22 + hash2i(gx, gz, worldSeed + 5119) * 0.56) * cell);
        if (Math.hypot(ix, iz) < 26) continue; // keep central portal sky clear
        const rSize = hash2i(gx, gz, worldSeed + 5147);
        const rad = Math.floor(4.5 + rSize * 7.5); // 4..11 block radius
        const dist = Math.hypot(wx - ix, wz - iz);
        if (dist > rad + 2.0) continue;
        const topY = Math.floor(38 + hash2i(gx, gz, worldSeed + 5153) * 30); // Y = 38..67
        const rKind = hash2i(gx, gz, worldSeed + 5167);
        const kind = (rad >= 9 && rKind > 0.80) ? 'boss_vault'
          : (rad >= 8 && rKind > 0.55) ? 'temple'
          : (rad >= 7 && rKind > 0.34) ? 'tower'
          : (rad >= 6 && rKind > 0.18) ? 'cottage'
          : 'tree_islet';
        const hasWaterfall = (hash2i(gx, gz, worldSeed + 5171) > 0.52);
        const hasStepSpiral = (hash2i(gx, gz, worldSeed + 5179) > 0.42);
        const cand = { ix, iz, gx, gz, topY, rad, kind, hasWaterfall, hasStepSpiral, dist, seedH: rKind, bio: getBiomeAt(ix, iz) };
        if (!best || cand.dist < best.dist) best = cand;
      }
    }
    return best;
  }

  function evalSharedSpireRadiusAtY(sp, wy, wx, wz, realmKind) {
    const relY = wy - sp.anchorY;
    if (relY < -3 || wy > sp.topY) return -1;
    const t = Math.max(0, Math.min(1, relY / Math.max(1, sp.height)));
    const sOff = (realmKind === 'sift') ? 4400 : 8300;
    const tier = Math.floor(relY / 3);
    const tierStep = (hash2i(sp.gx * 13 + tier, sp.gz * 17 - tier, worldSeed + sOff + 701) - 0.5) * 0.95;
    const crag = (valueNoise2D(wx * 0.34 + wy * 0.19, wz * 0.34 - wy * 0.15, worldSeed + sOff + 709) - 0.5) * 0.95;
    if (sp.isSandSpire) {
      // Conical pale-sand spire accent (Refs 9, 10, 11)
      return Math.max(0.55, sp.baseR * (1.18 - t * 0.96) + tierStep * 0.45 + crag * 0.5);
    }
    // Tall stacked rock spire with flared base, stepped narrow waist, and flared flat overhanging cap (Refs 1, 3, 6, 9, 10, 11)
    let r;
    if (wy >= sp.topY - 1) {
      // Flared flat overhanging grass-topped cap!
      r = sp.baseR * 0.80 + sp.capFlare * (wy === sp.topY ? 1.0 : 0.72) + crag * 0.45;
    } else if (t < 0.18) {
      r = sp.baseR * (1.26 - t * 1.65) + crag * 0.55;
    } else {
      const waist = 0.96 - 0.40 * Math.sin(t * Math.PI * 0.85);
      r = sp.baseR * waist + tierStep * 0.55 + crag * 0.55;
    }
    return Math.max(1.15, r);
  }

  function sampleSharedArchAt(wx, wy, wz, realmKind) {
    const cfg = getRealmGenCfg();
    const sh = cfg.sharedTerrain;
    const isDream = (realmKind === 'sift');
    const sOff = isDream ? 4400 : 8300;
    const cell = sh.archCellSize;
    const cgx = Math.floor(wx / cell), cgz = Math.floor(wz / cell);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cgx + dx, gz = cgz + dz;
        if (hash2i(gx, gz, worldSeed + sOff + 811) > sh.archChance) continue;
        const ax = (gx + 0.25 + hash2i(gx, gz, worldSeed + sOff + 821) * 0.5) * cell;
        const az = (gz + 0.25 + hash2i(gx, gz, worldSeed + sOff + 827) * 0.5) * cell;
        if (Math.hypot(ax, az) < 28) continue;
        if (!isDream && Math.hypot(ax, az - 136) < 32) continue;
        const halfSpan = 6.5 + hash2i(gx, gz, worldSeed + sOff + 839) * 4.5;
        const ddx = wx - ax, ddz = wz - az;
        if (ddx * ddx + ddz * ddz > (halfSpan + 3.0) * (halfSpan + 3.0)) continue;
        const ang = hash2i(gx, gz, worldSeed + sOff + 853) * Math.PI;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const along = ddx * ca + ddz * sa;
        const across = -ddx * sa + ddz * ca;
        const thick = 1.65 + hash2i(gx, gz, worldSeed + sOff + 859) * 0.75;
        if (Math.abs(across) > thick || Math.abs(along) > halfSpan + 1.4) continue;
        const anchorS = sampleSharedMesaBase(Math.floor(ax), Math.floor(az), realmKind, getBiomeAt(Math.floor(ax), Math.floor(az)));
        if (isDream && anchorS.baseH < WATER_LEVEL) continue;
        const rise = 7.5 + hash2i(gx, gz, worldSeed + sOff + 863) * 5.5;
        const u = along / halfSpan;
        const archY = anchorS.baseH - 1.0 + rise * (1.0 - u * u);
        if (wy >= anchorS.baseH - 3 && Math.abs(wy - archY) <= 1.55) {
          return { hit: true, isTop: (wy >= Math.floor(archY + 0.65)) };
        }
      }
    }
    return null;
  }

  function getTerrainHeight(wx, wz, biome) {
    if (currentDimension === 'warden') {
      const dist0 = Math.hypot(wx, wz);
      if (dist0 < 19) return WATER_LEVEL + 4;
      const wb = fbm2D(wx * 0.015, wz * 0.015, 2, 0.5, 2.0, worldSeed + 7404);
      const wd = valueNoise2D(wx * 0.055, wz * 0.055, worldSeed + 7505);
      const wr = valueNoise2D(wx * 0.028, wz * 0.028, worldSeed + 7606);
      if (biome === BIOMES.WARDEN_CITADEL) {
        return Math.floor(WATER_LEVEL + 4 + (wr > 0.68 ? Math.floor((wr - 0.68) * 18) : wb * 4.5) + wd * 1.4);
      }
      if (biome === BIOMES.WARDEN_FOREST) {
        return Math.floor(WATER_LEVEL + 4 + wb * 10 + wd * 2.0);
      }
      const ridge = Math.pow(Math.max(0, wr - 0.35), 1.35) * 24;
      return Math.floor(WATER_LEVEL + 3 + wb * 12 + ridge + wd * 2.2);
    }
    if (currentDimension === 'sift' || currentDimension === 'dragon_realm') {
      const realmKind = currentDimension;
      if (realmKind === 'dragon_realm') {
        const dC = Math.hypot(wx, wz);
        const dB = Math.hypot(wx, wz - 136);
        if (dC < 16) return 18;
        if (dB < 22) return 20;
      }
      const baseSample = sampleSharedMesaBase(wx, wz, realmKind, biome);
      let topH = baseSample.baseH;
      const sp = sampleSharedSpireAt(wx, wz, realmKind);
      if (sp) {
        const rCap = evalSharedSpireRadiusAtY(sp, sp.topY, wx, wz, realmKind);
        const cxTop = sp.sx + sp.leanX * sp.height, czTop = sp.sz + sp.leanZ * sp.height;
        if (Math.hypot(wx - cxTop, wz - czTop) <= rCap) {
          topH = Math.max(topH, sp.topY);
        }
      }
      return topH;
    }
    if (currentDimension === 'end') {
      const d0 = Math.hypot(wx, wz);
      if (d0 < 54) {
        const t = d0 / 54;
        const plateau = t < 0.72 ? 1.0 : Math.max(0, 1 - ((t - 0.72) / 0.28) * ((t - 0.72) / 0.28));
        return Math.floor(2 + plateau * 7 + valueNoise2D(wx * 0.055, wz * 0.055, worldSeed + 901) * 2.2);
      }
      if (d0 >= 180) {
        const cityH = (typeof getEndCityPlateauHeight === 'function') ? getEndCityPlateauHeight(wx, wz) : -99;
        if (cityH > -50) return cityH;
      }
      const isl = fbm2D(wx * 0.022, wz * 0.022, 2, 0.5, 2.0, worldSeed + 905);
      return isl > 0.57 ? Math.floor(3 + (isl - 0.57) * 30) : -99;
    }
    if (currentDimension === 'nether') {
      const castle = getNetherCastleAnchor(wx, wz);
      if (castle) {
        const dx = wx - castle.x, dz = wz - castle.z;
        const islandD = Math.hypot(dx / 17.5, dz / 15.5);
        if (islandD <= 1.05) {
          const drop = Math.pow(Math.max(0, islandD - 0.58) / 0.47, 1.7) * 5.2;
          return Math.max(WATER_LEVEL + 1, Math.round(castle.baseY - drop));
        }
        if (Math.hypot(dx, dz) < 38) return WATER_LEVEL - 4;
      }
      const cont = fbm2D(wx * 0.015, wz * 0.015, 3, 0.52, 2.05, worldSeed + 505);
      const det = valueNoise2D(wx * 0.06, wz * 0.06, worldSeed + 606);
      // Continuous meandering Nether lava river channel + broad terraced canyon basins (Images 1, 2, 3!)
      const riverN = Math.abs(fbm2D(wx * 0.0095, wz * 0.0095, 2, 0.5, 2.0, worldSeed + 577) - 0.5);
      let nh;
      if (biome === BIOMES.NETHER_BASALT_DELTAS) {
        nh = -5.5 + cont * 21.0 + Math.round(det * 4.5);
      } else if (biome === BIOMES.NETHER_SOUL_VALLEY) {
        nh = -3.5 + cont * 15.5 + det * 2.4;
      } else if (biome === BIOMES.NETHER_CRIMSON || biome === BIOMES.NETHER_WARPED) {
        const rawH = -5.5 + cont * 22.0 + det * 2.6;
        nh = rawH * 0.54 + Math.round(rawH / 3) * 3 * 0.46;
      } else {
        const rawW = -9.5 + cont * 23.0 + det * 2.8;
        nh = rawW * 0.62 + Math.round(rawW / 2) * 2 * 0.38;
      }
      if (riverN < 0.12) {
        const t = 1.0 - riverN / 0.12;
        nh = Math.min(nh, WATER_LEVEL - 1.5 - t * 7.5);
      }
      return Math.max(MIN_Y + 6, Math.floor(nh));
    }
    if (biome === BIOMES.ABANDONED_CITY) return 2;
    if (biome === BIOMES.GRAND_RUINS) return getGrandRuinsSurfaceY(wx, wz);
    if (isGrandCitadel(wx, wz)) return 6;
    const bC = biome || getBiomeAt(wx, wz);
    const b1 = getBiomeAt(wx + 8, wz), b2 = getBiomeAt(wx - 8, wz);
    const b3 = getBiomeAt(wx, wz + 8), b4 = getBiomeAt(wx, wz - 8);
    const b5 = getBiomeAt(wx + 20, wz), b6 = getBiomeAt(wx - 20, wz);
    const b7 = getBiomeAt(wx, wz + 20), b8 = getBiomeAt(wx, wz - 20);
    let h;
    if (b1 === bC && b2 === bC && b3 === bC && b4 === bC && b5 === bC && b6 === bC && b7 === bC && b8 === bC) {
      h = getRawBiomeHeight(wx, wz, bC);
    } else {
      h = (getRawBiomeHeight(wx, wz, bC) * 4.0
        + getRawBiomeHeight(wx + 8, wz, b1) * 1.25 + getRawBiomeHeight(wx - 8, wz, b2) * 1.25
        + getRawBiomeHeight(wx, wz + 8, b3) * 1.25 + getRawBiomeHeight(wx, wz - 8, b4) * 1.25
        + getRawBiomeHeight(wx + 20, wz, b5) * 0.75 + getRawBiomeHeight(wx - 20, wz, b6) * 0.75
        + getRawBiomeHeight(wx, wz + 20, b7) * 0.75 + getRawBiomeHeight(wx, wz - 20, b8) * 0.75) / 12.0;
    }
    return Math.max(MIN_Y + 4, Math.min(MAX_Y - 8, Math.floor(h)));
  }

  const CAVE_GRID_X = 5, CAVE_GRID_Y = 65, CAVE_GRID_Z = 5;
  const caveGrid = new Float32Array(CAVE_GRID_X * CAVE_GRID_Y * CAVE_GRID_Z);
  const colHeights = new Int16Array(256), colBiomes = new Uint8Array(256);

  // Zero-GC Rust WebAssembly acceleration core (ABI v6: terrain/cave/mesher/LOD + fused emitter/topmap scan, RT pack, 3D item extrude, solid atlas, CRC32, chunk queue sort, MP interp, mipmap)
  const _nucraftWasmState = {
    ready: false, abi: 0,
    caveCalls: 0, lightCalls: 0, frameCalls: 0, partCalls: 0, atlasCalls: 0,
    meshCalls: 0, workerMeshHits: 0, terrainCalls: 0, workerTerrainHits: 0,
    codecCalls: 0, lodBuilds: 0, lodTriangles: 0, lodVisible: false,
    scanCalls: 0, rtPackCalls: 0, itemExtrudeCalls: 0, crcCalls: 0,
    chunkSortCalls: 0, netInterpCalls: 0
  };
  if (typeof window !== 'undefined') window.__NUCRAFT_WASM__ = _nucraftWasmState;
  let _nwExports = null, _nwMemBuf = null, _nwCoarseView = null, _nwEmitView = null, _nwLightOut = null;
  let _nwFrameOut = null, _nwPartBuf = null, _nwSphIn = null, _nwSphOut = null;
  let _nwAtlasRgba = null, _nwAtlasBump = null, _nwTileModes = null;
  let _nwChunkData = null, _nwBorderBuf = null, _nwAutumnCell = null;
  let _nwLutOpaque = null, _nwLutFlags = null, _nwLutTiles = null, _nwLutUv = null;
  let _nwMeshPos = null, _nwMeshNorm = null, _nwMeshUv = null, _nwMeshCol = null, _nwMeshBl = null, _nwMeshIdx = null, _nwSpecVox = null, _nwMeshMeta = null;
  let _nwTerrainBids = null, _nwAcCoords = null, _nwColHeights = null, _nwColBiomes = null, _nwTerrainMeta = null;
  let _nwCodecIn = null, _nwCodecOut = null;
  let _nwLodMask = null, _nwLodPos = null, _nwLodNorm = null, _nwLodCol = null, _nwLodIdx = null, _nwLodMeta = null;
  let _nwLutEmitInfo = null, _nwLutEmitMeta = null, _nwLutMapU32 = null, _nwLutRtPack = null;
  let _nwScanEmitOut = null, _nwScanSpecOut = null, _nwScanTopH = null, _nwScanMapU32 = null, _nwScanMeta = null;
  let _nwRtVolOut = null;
  let _nwItemRgbaIn = null, _nwItemPosOut = null, _nwItemNormOut = null, _nwItemColOut = null, _nwItemIdxOut = null, _nwItemMetaOut = null;
  let _nwChunkQCoords = null, _nwChunkQOrder = null, _nwNetEntBuf = null;
  let _nwMobAiIn = null, _nwPlayerPosIn = null, _nwMobAiOut = null;
  let _cachedWasmLuts = null, _mainLutsSynced = false;

  function _buildTerrainBlockIds() {
    const tb = new Uint16Array(64);
    if (typeof B === 'undefined') return tb;
    tb[1] = B.GRASS || 0; tb[2] = B.DIRT || 0; tb[3] = B.STONE || 0; tb[4] = B.SAND || 0;
    tb[5] = B.SNOW || 0; tb[6] = B.ICE || 0; tb[7] = B.WATER || 0; tb[8] = B.TERRACOTTA || 0;
    tb[9] = B.SANDSTONE || 0; tb[10] = B.GOLD_ORE || 0; tb[11] = B.DEEPSLATE || 0; tb[12] = B.BEDROCK || 0;
    tb[13] = B.COAL_ORE || 0; tb[14] = B.IRON_ORE || 0; tb[15] = B.DIAMOND_ORE || 0; tb[16] = B.LAVA || 0;
    tb[17] = B.GLOW_CRYSTAL || 0; tb[18] = B.MUD || 0; tb[19] = B.PACKED_ICE || 0; tb[20] = B.MYCELIUM || 0;
    tb[21] = B.BASALT || 0; tb[22] = B.COPPER_ORE || 0; tb[23] = B.TIN_ORE || 0; tb[24] = B.EMERALD_ORE || 0;
    tb[25] = B.RUBY_ORE || 0; tb[26] = B.MOSS_BLOCK || 0; tb[27] = B.FARMLAND || 0; tb[28] = B.AUTUMN_PODZOL || 0;
    tb[29] = B.LAPIS_ORE || 0; tb[30] = B.GRAVEL || 0; tb[31] = B.REDSTONE_ORE || 0; tb[32] = B.BLUE_GRASS || 0;
    tb[33] = B.SCULK || 0; tb[34] = B.RED_SAND || 0; tb[35] = B.TERRACOTTA_WHITE || 0; tb[36] = B.TERRACOTTA_ORANGE || 0;
    tb[37] = B.TERRACOTTA_YELLOW || 0; tb[38] = B.TERRACOTTA_BROWN || 0; tb[39] = B.TERRACOTTA_RED || 0;
    tb[40] = B.PALE_MOSS || 0; tb[41] = B.NIGHTMARE_MOSS || 0; tb[42] = B.SNOWY_DIRT || 0;
    tb[43] = B.SULFUR_BLOCK || 0; tb[44] = B.SULFUR_ORE || 0; tb[45] = B.CINNABAR_STONE || 0;
    tb[46] = B.TRAVERTINE_STONE || 0; tb[47] = B.THERMAL_CRUST || 0; tb[48] = B.STONE_BRICK || 0;
    return tb;
  }

  function _getWasmLuts(forceRebuild = false) {
    if (_cachedWasmLuts && !forceRebuild) return _cachedWasmLuts;
    if (typeof IS_OPAQUE === 'undefined' || typeof BLOCK_FLAGS === 'undefined' || typeof BLOCK_DEF_ARR === 'undefined' || typeof TILE_U0 === 'undefined') return null;
    const cap = BLOCK_LUT_CAP;
    const opaque = new Uint8Array(cap);
    opaque.set(IS_OPAQUE.subarray(0, cap));
    const flags = new Uint16Array(cap);
    flags.set(BLOCK_FLAGS.subarray(0, cap));
    const blockTiles = new Uint16Array(cap * 5);
    blockTiles.fill(0xffff);
    for (let i = 0; i < cap; i++) {
      const d = BLOCK_DEF_ARR[i];
      if (!d || !Array.isArray(d.tiles)) continue;
      const off = i * 5;
      blockTiles[off] = d.tiles[0] & 0xffff;
      blockTiles[off + 1] = (d.tiles[1] !== undefined ? d.tiles[1] : d.tiles[0]) & 0xffff;
      blockTiles[off + 2] = (d.tiles[2] !== undefined ? d.tiles[2] : d.tiles[0]) & 0xffff;
      blockTiles[off + 3] = (d.frontTile !== undefined) ? (d.frontTile & 0xffff) : 0xffff;
      blockTiles[off + 4] = d.bothZFront ? 1 : 0;
    }
    const tileUv = new Float32Array(1024 * 4);
    const nTiles = Math.min(1024, _ATLAS_TILES);
    for (let t = 0; t < nTiles; t++) {
      const o = t * 4;
      tileUv[o] = TILE_U0[t]; tileUv[o + 1] = TILE_U1[t];
      tileUv[o + 2] = TILE_V0[t]; tileUv[o + 3] = TILE_V1[t];
    }
    const terrainBids = _buildTerrainBlockIds();
    const emitInfo = new Float32Array(cap * 4);
    const emitMeta = new Uint8Array(cap);
    const mapU32 = new Uint32Array(cap);
    const rtPack = new Uint8Array(cap * 4);
    const _setEm = (id, mode, r, g, b, rad2, extra = 0) => {
      if (!id || id >= cap) return;
      emitMeta[id] = mode | extra;
      emitInfo[id * 4] = r; emitInfo[id * 4 + 1] = g; emitInfo[id * 4 + 2] = b; emitInfo[id * 4 + 3] = rad2;
    };
    _setEm(B.LANTERN, 1, 1.28, 0.96, 0.54, 400.0);
    _setEm(B.SOUL_LANTERN, 1, 0.46, 1.06, 1.26, 324.0);
    _setEm(B.SOUL_FIRE, 1, 0.30, 0.78, 0.96, 196.0);
    _setEm(B.CANDLE, 1, 0.86, 0.64, 0.34, 144.0, 0x04);
    _setEm(B.TORCH_BLOCK, 1, 1.18, 0.88, 0.48, 324.0);
    _setEm(B.SHROOMLIGHT, 1, 0.84, 0.58, 0.28, 169.0);
    _setEm(B.CAMPFIRE, 1, 0.86, 0.50, 0.22, 169.0, 0x08);
    _setEm(B.FIRE, 1, 0.86, 0.50, 0.22, 144.0);
    _setEm(B.SEA_LANTERN, 1, 0.44, 0.82, 0.90, 196.0);
    _setEm(B.END_CRYSTAL_BLOCK, 1, 0.76, 0.38, 0.86, 169.0);
    _setEm(B.END_ROD, 1, 0.92, 0.88, 0.96, 196.0);
    _setEm(B.NETHER_PORTAL, 1, 0.69, 0.39, 0.81, 196.0, 0x08);
    _setEm(B.END_PORTAL, 1, 0.69, 0.39, 0.81, 196.0);
    _setEm(B.END_GATEWAY, 1, 0.49, 0.63, 0.88, 196.0);
    if (B.DRAGON_REALM_PORTAL) _setEm(B.DRAGON_REALM_PORTAL, 1, 0.49, 0.63, 0.88, 196.0);
    _setEm(B.DREAM_PORTAL, 1, 0.45, 0.75, 0.81, 196.0, 0x08);
    _setEm(B.WARDEN_PORTAL, 1, 0.14, 0.80, 0.88, 196.0, 0x08);
    _setEm(B.SCULK_SENSOR, 2, 0.22, 0.68, 0.82, 121.0);
    _setEm(B.SCULK_SHRIEKER, 2, 0.22, 0.68, 0.82, 121.0);
    _setEm(B.SCULK_CATALYST, 2, 0.22, 0.68, 0.82, 121.0);
    _setEm(B.ENDER_CHEST_BLOCK, 2, 0.22, 0.68, 0.82, 121.0);
    _setEm(B.MAGMA_BLOCK, 2, 0.85, 0.34, 0.10, 121.0);
    _setEm(B.LAVA, 3, 0.82, 0.36, 0.12, 144.0);
    _setEm(B.GLOW_CRYSTAL, 2, 0.36, 0.72, 0.86, 144.0);
    _setEm(B.ELEVATOR_BLOCK, 2, 0.34, 0.68, 0.84, 121.0);
    _setEm(B.GLOW_VINES, 2, 0.74, 0.54, 0.24, 121.0);
    _setEm(B.MUSHROOM_GLOW, 2, 0.26, 0.68, 0.74, 100.0);
    _setEm(B.SPORE_SHROOM, 2, 0.26, 0.68, 0.74, 100.0);
    if (B.SULFUR_VENT && B.SULFUR_VENT < cap && emitMeta[B.SULFUR_VENT] === 0) emitMeta[B.SULFUR_VENT] = 0x08;
    const _rtEmitRgb = {
      [B.LAVA]: [255, 112, 22], [B.MAGMA_BLOCK]: [236, 86, 20], [B.FIRE]: [255, 176, 48], [B.SOUL_FIRE]: [72, 226, 255],
      [B.TORCH_BLOCK]: [255, 194, 80], [B.LANTERN]: [255, 206, 98], [B.SOUL_LANTERN]: [76, 236, 255], [B.CAMPFIRE]: [255, 158, 56],
      [B.SHROOMLIGHT]: [255, 184, 86], [B.SEA_LANTERN]: [166, 246, 240], [B.GLOW_CRYSTAL]: [120, 220, 255], [B.MUSHROOM_GLOW]: [125, 245, 215],
      [B.GLOW_VINES]: [255, 214, 102], [B.END_ROD]: [248, 236, 255], [B.END_PORTAL]: [174, 92, 255], [B.END_GATEWAY]: [148, 78, 245], [B.DRAGON_REALM_PORTAL]: [120, 178, 255],
      [B.END_PORTAL_FRAME_EYE]: [92, 244, 195], [B.END_CRYSTAL_BLOCK]: [244, 114, 225], [B.NETHER_PORTAL]: [188, 78, 255],
      [B.DREAM_PORTAL]: [110, 235, 255], [B.WARDEN_PORTAL]: [34, 211, 238], [B.CANDLE]: [255, 206, 115], [B.REDSTONE]: [235, 45, 35],
      [B.REDSTONE_ORE]: [215, 55, 48], [B.ICHOR_ORE]: [240, 115, 245], [B.DRAGON_CRYSTAL_ORE]: [195, 95, 255],
      [B.SULFUR_CRYSTAL]: [255, 224, 92], [B.SULFUR_VENT]: [255, 176, 68]
    };
    const _rtGlassSet = new Set([B.ICE, B.PACKED_ICE, B.GLASS, B.GLASS_PANE, B.BROKEN_GLASS, B.IRON_GRATE, B.PACKED_ICE_SLAB, B.PACKED_ICE_SLAB_TOP].filter(Boolean));
    const _rtGlossSet = new Set([
      B.OBSIDIAN, B.OBSIDIAN_SLAB, B.OBSIDIAN_SLAB_TOP, B.MARBLE_BRICK, B.MARBLE_BRICK_SLAB, B.MARBLE_BRICK_SLAB_TOP,
      B.COPPER_ROOF, B.COPPER_SLAB, B.COPPER_SLAB_TOP, B.PRISMARINE, B.PRISMARINE_SLAB, B.PRISMARINE_SLAB_TOP,
      B.ELEVATOR_BLOCK, B.NETHERITE_BLOCK, B.BLACKSTONE_BRICKS, B.DEEPSLATE_TILES, B.PURPUR_BLOCK, B.PURPUR_PILLAR,
      B.IRON_CHEST, B.GOLD_CHEST, B.DIAMOND_CHEST, B.NETHERITE_CHEST, B.GOLD_ORE, B.DIAMOND_ORE, B.EMERALD_ORE,
      B.RUBY_ORE, B.LAPIS_ORE, B.QUARTZ_ORE, B.UMBRA_ORE, B.RESONANT_ORE, B.SOULFORGED_ORE, B.ENCHANT_TABLE, B.ANVIL, B.SLIME_BLOCK
    ].filter(Boolean));
    for (let id = 0; id < cap; id++) {
      const d = BLOCK_DEF_ARR[id];
      const hex = d && typeof d.mapColor === 'string' && d.mapColor.charCodeAt(0) === 35 && d.mapColor.length >= 7 ? d.mapColor : null;
      const n = hex ? parseInt(hex.slice(1, 7), 16) : NaN;
      mapU32[id] = !Number.isNaN(n) ? ((0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0) : 0xff80726b;
      if (id === 0 || !d) continue;
      if (IS_EMISSIVE[id] && emitMeta[id] === 0) _setEm(id, 2, 0.76, 0.58, 0.32, 121.0);
      let r = 136, g = 142, b = 152;
      if (!Number.isNaN(n)) { r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
      const ro = id * 4;
      if (_rtEmitRgb[id]) {
        const e = _rtEmitRgb[id];
        rtPack[ro] = e[0]; rtPack[ro + 1] = e[1]; rtPack[ro + 2] = e[2]; rtPack[ro + 3] = 224;
      } else if (d.emissive) {
        rtPack[ro] = Math.min(255, Math.round(r * 1.18 + 25));
        rtPack[ro + 1] = Math.min(255, Math.round(g * 1.18 + 25));
        rtPack[ro + 2] = Math.min(255, Math.round(b * 1.18 + 25));
        rtPack[ro + 3] = 224;
      } else if (id === B.WATER) {
        rtPack[ro] = 40; rtPack[ro + 1] = 150; rtPack[ro + 2] = 200; rtPack[ro + 3] = 160;
      } else if (_rtGlassSet.has(id) || d.glass) {
        rtPack[ro] = r; rtPack[ro + 1] = g; rtPack[ro + 2] = b; rtPack[ro + 3] = 128;
      } else if (d.foliage && d.solid) {
        rtPack[ro] = r; rtPack[ro + 1] = g; rtPack[ro + 2] = b; rtPack[ro + 3] = 96;
      } else if (_rtGlossSet.has(id)) {
        rtPack[ro] = r; rtPack[ro + 1] = g; rtPack[ro + 2] = b; rtPack[ro + 3] = 64;
      } else if (d.solid) {
        rtPack[ro] = r; rtPack[ro + 1] = g; rtPack[ro + 2] = b; rtPack[ro + 3] = 32;
      }
    }
    _cachedWasmLuts = { opaque, flags, blockTiles, tileUv, terrainBids, emitInfo, emitMeta, mapU32, rtPack };
    return _cachedWasmLuts;
  }

  function _syncWasmViews() {
    if (!_nwExports) return;
    const buf = _nwExports.memory.buffer;
    if (_nwMemBuf === buf && _nwCoarseView) return;
    _nwMemBuf = buf;
    _nwCoarseView = new Float32Array(buf, _nwExports.coarse_grid_ptr(), 1625);
    _nwEmitView = new Float32Array(buf, _nwExports.emitters_buf_ptr(), 3584);
    _nwLightOut = new Float32Array(buf, _nwExports.light_out_ptr(), 3);
    if (_nwExports.frame_out_ptr) _nwFrameOut = new Float32Array(buf, _nwExports.frame_out_ptr(), 16);
    if (_nwExports.particle_buf_ptr) _nwPartBuf = new Float32Array(buf, _nwExports.particle_buf_ptr(), 512 * 8);
    if (_nwExports.sphere_in_ptr) _nwSphIn = new Float32Array(buf, _nwExports.sphere_in_ptr(), 256 * 4);
    if (_nwExports.sphere_out_ptr) _nwSphOut = new Uint8Array(buf, _nwExports.sphere_out_ptr(), 256);
    if (_nwExports.atlas_rgba_ptr) _nwAtlasRgba = new Uint8Array(buf, _nwExports.atlas_rgba_ptr(), 1048576);
    if (_nwExports.atlas_bump_ptr) _nwAtlasBump = new Uint8Array(buf, _nwExports.atlas_bump_ptr(), 1048576);
    if (_nwExports.tile_mode_ptr) _nwTileModes = new Uint8Array(buf, _nwExports.tile_mode_ptr(), 1024);
    if (_nwExports.chunk_data_ptr) _nwChunkData = new Uint16Array(buf, _nwExports.chunk_data_ptr(), 65536);
    if (_nwExports.border_buf_ptr) _nwBorderBuf = new Uint16Array(buf, _nwExports.border_buf_ptr(), 17408);
    if (_nwExports.autumn_cell_ptr) _nwAutumnCell = new Uint8Array(buf, _nwExports.autumn_cell_ptr(), 16);
    if (_nwExports.lut_opaque_ptr) _nwLutOpaque = new Uint8Array(buf, _nwExports.lut_opaque_ptr(), 2048);
    if (_nwExports.lut_flags_ptr) _nwLutFlags = new Uint16Array(buf, _nwExports.lut_flags_ptr(), 2048);
    if (_nwExports.lut_block_tiles_ptr) _nwLutTiles = new Uint16Array(buf, _nwExports.lut_block_tiles_ptr(), 2048 * 5);
    if (_nwExports.lut_tile_uv_ptr) _nwLutUv = new Float32Array(buf, _nwExports.lut_tile_uv_ptr(), 1024 * 4);
    if (_nwExports.mesh_pos_ptr) _nwMeshPos = new Float32Array(buf, _nwExports.mesh_pos_ptr(), 65536 * 3);
    if (_nwExports.mesh_norm_ptr) _nwMeshNorm = new Float32Array(buf, _nwExports.mesh_norm_ptr(), 65536 * 3);
    if (_nwExports.mesh_uv_ptr) _nwMeshUv = new Float32Array(buf, _nwExports.mesh_uv_ptr(), 65536 * 2);
    if (_nwExports.mesh_col_ptr) _nwMeshCol = new Float32Array(buf, _nwExports.mesh_col_ptr(), 65536 * 3);
    if (_nwExports.mesh_bl_ptr) _nwMeshBl = new Float32Array(buf, _nwExports.mesh_bl_ptr(), 65536 * 3);
    if (_nwExports.mesh_idx_ptr) _nwMeshIdx = new Uint32Array(buf, _nwExports.mesh_idx_ptr(), 98304);
    if (_nwExports.special_voxels_ptr) _nwSpecVox = new Uint16Array(buf, _nwExports.special_voxels_ptr(), 65536);
    if (_nwExports.mesh_meta_ptr) _nwMeshMeta = new Uint32Array(buf, _nwExports.mesh_meta_ptr(), 4);
    if (_nwExports.terrain_bids_ptr) _nwTerrainBids = new Uint16Array(buf, _nwExports.terrain_bids_ptr(), 64);
    if (_nwExports.ac_coords_ptr) _nwAcCoords = new Int32Array(buf, _nwExports.ac_coords_ptr(), 8);
    if (_nwExports.col_heights_ptr) _nwColHeights = new Int16Array(buf, _nwExports.col_heights_ptr(), 256);
    if (_nwExports.col_biomes_ptr) _nwColBiomes = new Uint8Array(buf, _nwExports.col_biomes_ptr(), 256);
    if (_nwExports.terrain_meta_ptr) _nwTerrainMeta = new Uint32Array(buf, _nwExports.terrain_meta_ptr(), 4);
    if (_nwExports.codec_in_ptr) _nwCodecIn = new Uint8Array(buf, _nwExports.codec_in_ptr(), 2097152);
    if (_nwExports.codec_out_ptr) _nwCodecOut = new Uint8Array(buf, _nwExports.codec_out_ptr(), 2097152);
    if (_nwExports.lod_mask_ptr) _nwLodMask = new Uint8Array(buf, _nwExports.lod_mask_ptr(), 4096);
    if (_nwExports.lod_pos_ptr) _nwLodPos = new Float32Array(buf, _nwExports.lod_pos_ptr(), 49152 * 3);
    if (_nwExports.lod_norm_ptr) _nwLodNorm = new Float32Array(buf, _nwExports.lod_norm_ptr(), 49152 * 3);
    if (_nwExports.lod_col_ptr) _nwLodCol = new Float32Array(buf, _nwExports.lod_col_ptr(), 49152 * 3);
    if (_nwExports.lod_idx_ptr) _nwLodIdx = new Uint32Array(buf, _nwExports.lod_idx_ptr(), 73728);
    if (_nwExports.lod_meta_ptr) _nwLodMeta = new Uint32Array(buf, _nwExports.lod_meta_ptr(), 4);
    if (_nwExports.lut_emit_info_ptr) _nwLutEmitInfo = new Float32Array(buf, _nwExports.lut_emit_info_ptr(), 2048 * 4);
    if (_nwExports.lut_emit_meta_ptr) _nwLutEmitMeta = new Uint8Array(buf, _nwExports.lut_emit_meta_ptr(), 2048);
    if (_nwExports.lut_map_u32_ptr) _nwLutMapU32 = new Uint32Array(buf, _nwExports.lut_map_u32_ptr(), 2048);
    if (_nwExports.lut_rt_pack_ptr) _nwLutRtPack = new Uint8Array(buf, _nwExports.lut_rt_pack_ptr(), 2048 * 4);
    if (_nwExports.scan_emitters_out_ptr) _nwScanEmitOut = new Float32Array(buf, _nwExports.scan_emitters_out_ptr(), 160 * 8);
    if (_nwExports.scan_spec_out_ptr) _nwScanSpecOut = new Float32Array(buf, _nwExports.scan_spec_out_ptr(), 96 * 4);
    if (_nwExports.scan_topmap_h_ptr) _nwScanTopH = new Int16Array(buf, _nwExports.scan_topmap_h_ptr(), 256);
    if (_nwExports.scan_minimap_u32_ptr) _nwScanMapU32 = new Uint32Array(buf, _nwExports.scan_minimap_u32_ptr(), 256);
    if (_nwExports.scan_meta_out_ptr) _nwScanMeta = new Uint32Array(buf, _nwExports.scan_meta_out_ptr(), 4);
    if (_nwExports.rt_vol_out_ptr) _nwRtVolOut = new Uint8Array(buf, _nwExports.rt_vol_out_ptr(), 512 * 256 * 4);
    if (_nwExports.item_rgba_in_ptr) _nwItemRgbaIn = new Uint8Array(buf, _nwExports.item_rgba_in_ptr(), 16 * 16 * 4);
    if (_nwExports.item_pos_out_ptr) _nwItemPosOut = new Float32Array(buf, _nwExports.item_pos_out_ptr(), 6144 * 3);
    if (_nwExports.item_norm_out_ptr) _nwItemNormOut = new Float32Array(buf, _nwExports.item_norm_out_ptr(), 6144 * 3);
    if (_nwExports.item_col_out_ptr) _nwItemColOut = new Float32Array(buf, _nwExports.item_col_out_ptr(), 6144 * 3);
    if (_nwExports.item_idx_out_ptr) _nwItemIdxOut = new Uint32Array(buf, _nwExports.item_idx_out_ptr(), 9216);
    if (_nwExports.item_meta_out_ptr) _nwItemMetaOut = new Uint32Array(buf, _nwExports.item_meta_out_ptr(), 2);
    if (_nwExports.chunk_q_coords_ptr) _nwChunkQCoords = new Int32Array(buf, _nwExports.chunk_q_coords_ptr(), 2048 * 2);
    if (_nwExports.chunk_q_order_ptr) _nwChunkQOrder = new Uint32Array(buf, _nwExports.chunk_q_order_ptr(), 2048);
    if (_nwExports.net_ent_buf_ptr) _nwNetEntBuf = new Float32Array(buf, _nwExports.net_ent_buf_ptr(), 128 * 12);
    if (_nwExports.mob_ai_in_ptr) _nwMobAiIn = new Float32Array(buf, _nwExports.mob_ai_in_ptr(), 128 * 4);
    if (_nwExports.player_pos_in_ptr) _nwPlayerPosIn = new Float32Array(buf, _nwExports.player_pos_in_ptr(), 16 * 3);
    if (_nwExports.mob_ai_out_ptr) _nwMobAiOut = new Float32Array(buf, _nwExports.mob_ai_out_ptr(), 128 * 4);
  }
  function _syncMainWasmLuts(force = false) {
    const luts = _getWasmLuts(force);
    if (!luts) return false;
    if (_nwExports && (_mainLutsSynced === false || force)) {
      _syncWasmViews();
      if (_nwLutOpaque && _nwLutFlags && _nwLutTiles && _nwLutUv && _nwTerrainBids) {
        _nwLutOpaque.set(luts.opaque);
        _nwLutFlags.set(luts.flags);
        _nwLutTiles.set(luts.blockTiles);
        _nwLutUv.set(luts.tileUv);
        _nwTerrainBids.set(luts.terrainBids);
        if (_nwLutEmitInfo && luts.emitInfo) _nwLutEmitInfo.set(luts.emitInfo);
        if (_nwLutEmitMeta && luts.emitMeta) _nwLutEmitMeta.set(luts.emitMeta);
        if (_nwLutMapU32 && luts.mapU32) _nwLutMapU32.set(luts.mapU32);
        if (_nwLutRtPack && luts.rtPack) _nwLutRtPack.set(luts.rtPack);
        _mainLutsSynced = true;
      }
    }
    return _mainLutsSynced;
  }
  if (typeof window !== 'undefined') {
    window._syncWasmBlockLuts = (force = false) => {
      const luts = _getWasmLuts(force);
      _syncMainWasmLuts(force);
      if (luts && typeof chunkWorkerPool !== 'undefined' && chunkWorkerPool.syncLuts) {
        chunkWorkerPool.syncLuts(luts);
      }
      return !!luts;
    };
    window._getNucraftWasmCore = () => {
      if (!_nwExports) return null;
      _syncWasmViews();
      _syncMainWasmLuts(false);
      return {
        exports: _nwExports,
        frameOut: _nwFrameOut,
        particleBuf: _nwPartBuf,
        sphereIn: _nwSphIn,
        sphereOut: _nwSphOut,
        atlasRgba: _nwAtlasRgba,
        atlasBump: _nwAtlasBump,
        tileModes: _nwTileModes,
        codecIn: _nwCodecIn,
        codecOut: _nwCodecOut,
        chunkData: _nwChunkData,
        rtVolOut: _nwRtVolOut,
        itemRgbaIn: _nwItemRgbaIn,
        itemPosOut: _nwItemPosOut,
        itemNormOut: _nwItemNormOut,
        itemColOut: _nwItemColOut,
        itemIdxOut: _nwItemIdxOut,
        itemMetaOut: _nwItemMetaOut,
        scanEmitOut: _nwScanEmitOut,
        scanSpecOut: _nwScanSpecOut,
        scanTopH: _nwScanTopH,
        scanMapU32: _nwScanMapU32,
        scanMeta: _nwScanMeta,
        chunkQCoords: _nwChunkQCoords,
        chunkQOrder: _nwChunkQOrder,
        netEntBuf: _nwNetEntBuf,
        mobAiIn: _nwMobAiIn,
        playerPosIn: _nwPlayerPosIn,
        mobAiOut: _nwMobAiOut,
        state: _nucraftWasmState
      };
    };
  }
  (function _initNucraftWasm() {
    try {
      if (typeof fetch !== 'function' || typeof WebAssembly !== 'object' || (typeof location !== 'undefined' && location.protocol === 'file:')) return;
      fetch('./assets/nucraft_core.wasm?v=203').then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => (buf ? WebAssembly.instantiate(buf, {}) : null)).then((res) => {
        if (res && res.instance && res.instance.exports) {
          _nwExports = res.instance.exports;
          _syncWasmViews();
          _syncMainWasmLuts(true);
          _nucraftWasmState.abi = _nwExports.wasm_abi_version ? _nwExports.wasm_abi_version() : 1;
          _nucraftWasmState.ready = true;
        }
      }).catch(() => {});
    } catch (_) {}
  })();

  function fillCoarseCaveGrid(wx0, wz0) {
    const dOff = depthOffset || 0;
    if (_nwExports) {
      _syncWasmViews();
      _nwExports.compute_coarse_cave_grid(wx0 | 0, wz0 | 0, seedMix.ox, seedMix.oy, seedMix.oz, seedMix.c1 | 0, seedMix.c2 | 0, seedMix.c3 | 0, seedMix.c4 | 0, dOff | 0, MIN_Y | 0);
      caveGrid.set(_nwCoarseView);
      _nucraftWasmState.caveCalls++;
      return;
    }
    let p = 0;
    const ox = seedMix.ox, oy = seedMix.oy, oz = seedMix.oz;
    for (let gy = 0; gy < CAVE_GRID_Y; gy++) {
      const wy = MIN_Y + gy * 4;
      const trueY = wy - dOff;
      const depthBoost = Math.min(0.13, Math.max(0, (-trueY - 12) * 0.00038));
      const strataMorph = valueNoise3D((wx0 + ox) * 0.006, trueY * 0.009, (wz0 + oz) * 0.006, seedMix.c3);
      const scaleMod = 0.84 + strataMorph * 0.36;
      for (let gz = 0; gz < CAVE_GRID_Z; gz++) {
        const wz = wz0 + gz * 4;
        for (let gx = 0; gx < CAVE_GRID_X; gx++) {
          const wx = wx0 + gx * 4;
          // Continuous 3D domain warp in (wx, trueY, wz) so cave geometry is 100% seamless across vertical stratum shifts!
          const warpX = (valueNoise3D((wx + ox) * 0.019, (trueY + oy) * 0.024, (wz + oz) * 0.019, seedMix.c4) - 0.5) * 16.0;
          const warpY = (valueNoise3D((wx + ox) * 0.016 - 23.4, (trueY + oy) * 0.020, (wz + oz) * 0.016 + 31.1, seedMix.c2 + 13) - 0.5) * 9.0;
          const warpZ = (valueNoise3D((wx + ox) * 0.019 + 47.3, (trueY + oy) * 0.024 - 19.7, (wz + oz) * 0.019 + 11.2, seedMix.c4 + 31) - 0.5) * 16.0;
          const qx = (wx + warpX) * scaleMod + ox * 0.5;
          const qy = (trueY + warpY) + oy * 0.5;
          const qz = (wz + warpZ) * scaleMod + oz * 0.5;

          // 1) Multi-octave Cheese Caverns (grand sweeping chambers + natural pillars)
          const ch1 = valueNoise3D(qx * 0.025, qy * 0.035, qz * 0.025, seedMix.c1);
          const ch2 = valueNoise3D(qx * 0.054 + 19.2, qy * 0.068 - 11.4, qz * 0.054 + 7.8, seedMix.c1 + 43);
          const cheese = ch1 * 0.72 + ch2 * 0.28;
          const pillar = valueNoise2D((wx + ox) * 0.095, (wz + oz) * 0.095, seedMix.c3);
          const cheeseVal = cheese - (pillar > 0.76 ? (pillar - 0.76) * 1.25 : 0.0);

          // 2) Winding Spaghetti Tunnels
          const spA = Math.abs(valueNoise3D(qx * 0.044, qy * 0.056, qz * 0.044, seedMix.c2) - 0.5);
          const spB = Math.abs(valueNoise3D(qx * 0.047 + 73.1, qy * 0.055 - 41.9, qz * 0.047 + 29.4, seedMix.c3) - 0.5);
          const spaghetti = Math.max(0, 1.0 - (spA + spB) * 5.0);

          // 3) Deep Vertical Ravines / Fissures
          const ravMask = valueNoise3D((wx + ox) * 0.009, (trueY + oy) * 0.008, (wz + oz) * 0.009, seedMix.c1 + 77);
          const ravLine = Math.abs(valueNoise2D(qx * 0.024, qz * 0.024, seedMix.c2 + 53) - 0.5);
          const ravine = (ravMask > 0.55 && ravLine < 0.048) ? (0.88 - ravLine * 5.6) : 0.0;

          // 4) Noodle micro-passages connecting caverns
          const noodle = valueNoise3D(qx * 0.072, qy * 0.088, qz * 0.072, seedMix.c4 + 19);

          let v = Math.max(
            cheeseVal * 0.96 + noodle * 0.15 + depthBoost,
            spaghetti * 0.94 + noodle * 0.13 + depthBoost * 0.65,
            ravine
          );
          caveGrid[p++] = v;
        }
      }
    }
  }
  function sampleCaveFast(lx, ly, lz) {
    const gx = lx >> 2, gy = ly >> 2, gz = lz >> 2; if (gy >= CAVE_GRID_Y - 1) return 0;
    const fx = (lx & 3) * 0.25, fy = (ly & 3) * 0.25, fz = (lz & 3) * 0.25;
    const base = (gy * CAVE_GRID_Z + gz) * CAVE_GRID_X + gx, sY = CAVE_GRID_Z * CAVE_GRID_X, sZ = CAVE_GRID_X;
    const x00 = caveGrid[base] + (caveGrid[base + 1] - caveGrid[base]) * fx;
    const x01 = caveGrid[base + sZ] + (caveGrid[base + sZ + 1] - caveGrid[base + sZ]) * fx;
    const x10 = caveGrid[base + sY] + (caveGrid[base + sY + 1] - caveGrid[base + sY]) * fx;
    const x11 = caveGrid[base + sY + sZ] + (caveGrid[base + sY + sZ + 1] - caveGrid[base + sY + sZ]) * fx;
    return (x00 + (x01 - x00) * fz) + ((x10 + (x11 - x10) * fz) - (x00 + (x01 - x00) * fz)) * fy;
  }

  // Off-thread Horizon Worker Pool (Overworld terrain gen, solid chunk meshing, Far LOD & cave grid)
  const chunkWorkerPool = (() => {
    const cache = new Map();
    const terrainCache = new Map();
    const inFlight = new Set();
    const inFlightTerrain = new Set();
    const inFlightMesh = new Set();
    const completedMeshes = [];
    const workers = [];
    const workerLutsSent = [];
    let rr = 0, seq = 0, workerHits = 0, active = false, workerMeshSupported = true, blobUrl = null, _worldEpoch = 1;
    let _lodCb = null, _lodInFlight = false;
    const _releaseAllInFlightMeshes = () => {
      inFlightMesh.clear();
      if (typeof chunks !== 'undefined' && chunks) {
        for (const ch of chunks.values()) {
          if (ch && ch._meshInFlightGen !== -1) ch._meshInFlightGen = -1;
        }
      }
    };
    const _sendLutsToWorker = (wi, luts) => {
      if (!luts || workerLutsSent[wi]) return;
      workers[wi].postMessage({
        type: 'init_luts',
        opaque: luts.opaque,
        flags: luts.flags,
        blockTiles: luts.blockTiles,
        tileUv: luts.tileUv,
        terrainBids: luts.terrainBids,
        emitInfo: luts.emitInfo,
        emitMeta: luts.emitMeta,
        mapU32: luts.mapU32
      });
      workerLutsSent[wi] = true;
    };
    const _ensureAllLuts = () => {
      const luts = _getWasmLuts(false);
      if (!luts) return false;
      for (let wi = 0; wi < workers.length; wi++) _sendLutsToWorker(wi, luts);
      return true;
    };
    try {
      if (typeof Worker === 'function') {
        const count = _initMobile ? 1 : Math.min(4, Math.max(2, Math.floor(((_hwProfile && _hwProfile.cores) || 4) / 2)));
        if (window.__NUCRAFT_CHUNK_WORKER_SRC__) {
          blobUrl = URL.createObjectURL(new Blob([window.__NUCRAFT_CHUNK_WORKER_SRC__], { type: 'application/javascript' }));
        }
        const workerUrl = blobUrl || ((location.protocol === 'http:' || location.protocol === 'https:') ? 'src/world/chunkWorker.js' : '');
        if (workerUrl) {
          for (let i = 0; i < count; i++) {
            const w = new Worker(workerUrl);
            workerLutsSent.push(false);
            w.onmessage = (ev) => {
              const d = ev && ev.data;
              if (!d) return;
              if (d.type === 'gen_overworld_ok' || d.type === 'gen_overworld_err') {
                inFlightTerrain.delete(d.key);
                if (d.type === 'gen_overworld_ok' && d.epoch === _worldEpoch) {
                  terrainCache.set(d.key, d);
                  if (terrainCache.size > 96) {
                    const oldest = terrainCache.keys().next().value;
                    if (oldest !== undefined) terrainCache.delete(oldest);
                  }
                }
                return;
              }
              if (d.type === 'mesh_solid_ok' || d.type === 'mesh_solid_err') {
                inFlightMesh.delete(d.key);
                if (d.type === 'mesh_solid_ok' && d.epoch === _worldEpoch) {
                  completedMeshes.push(d);
                  if (completedMeshes.length > 128) {
                    // Always unlock evicted chunk so it NEVER stays permanently stuck invisible in-flight!
                    const ev = completedMeshes.shift();
                    if (ev && ev.epoch === _worldEpoch) {
                      const evCh = chunks.get(chunkKey(ev.cx, ev.cz));
                      if (evCh && evCh._meshInFlightGen === ev.meshGen) evCh._meshInFlightGen = -1;
                    }
                  }
                } else if (d.type === 'mesh_solid_err' && d.epoch === _worldEpoch) {
                  if (d.noWasm) {
                    // Worker lacks WASM (e.g. file:// offline build): disable worker solid meshing & release all chunks to main thread!
                    workerMeshSupported = false;
                    _releaseAllInFlightMeshes();
                  } else {
                    const ch = chunks.get(chunkKey(d.cx, d.cz));
                    if (ch) {
                      ch._meshInFlightGen = -1;
                      if (d.overflow) ch._skipWorkerMesh = true; // Dense chunk overflowed 65k WASM buffer -> fall back to dynamic JS mesher!
                    }
                  }
                }
                return;
              }
              if (d.type === 'build_lod_ok' || d.type === 'build_lod_err') {
                _lodInFlight = false;
                const cb = _lodCb; _lodCb = null;
                if (cb && d.epoch === _worldEpoch) cb(d);
                return;
              }
              if (!d.key || !d.caveGrid) return;
              inFlight.delete(d.key);
              if (!d.key.startsWith(`${seedMix.c1}:`)) return;
              cache.set(d.key, d.caveGrid);
              if (cache.size > 96) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
              }
            };
            w.onerror = () => { active = false; workerMeshSupported = false; _releaseAllInFlightMeshes(); };
            workers.push(w);
          }
          active = workers.length > 0;
        }
      }
    } catch (_) { active = false; }
    return {
      get active() { return active; },
      get workerCount() { return workers.length; },
      get hits() { return workerHits; },
      get inFlight() { return inFlight; },
      get cache() { return cache; },
      get epoch() { return _worldEpoch; },
      get pendingMeshes() { return inFlightMesh.size; },
      get readyMeshes() { return completedMeshes.length; },
      get pendingTerrain() { return inFlightTerrain.size; },
      get cachedTerrain() { return terrainCache.size; },
      syncLuts(luts) {
        if (!active || !luts) return;
        for (let wi = 0; wi < workers.length; wi++) {
          workerLutsSent[wi] = false;
          _sendLutsToWorker(wi, luts);
        }
      },
      prefetch(cx, cz, dOff = 0) {
        if (!active || currentDimension !== 'overworld' || inFlight.size >= Math.max(24, workers.length * 10)) return;
        const wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W;
        const key = `${seedMix.c1}:${dOff || 0}:${wx0},${wz0}`;
        if (cache.has(key) || inFlight.has(key)) return;
        inFlight.add(key);
        const w = workers[rr++ % workers.length];
        w.postMessage({
          id: ++seq,
          key,
          wx0,
          wz0,
          seedMix: { ox: seedMix.ox, oy: seedMix.oy, oz: seedMix.oz, c1: seedMix.c1, c2: seedMix.c2, c3: seedMix.c3, c4: seedMix.c4 },
          dOff: dOff || 0,
          minY: MIN_Y
        });
      },
      take(wx0, wz0, dOff = 0) {
        const key = `${seedMix.c1}:${dOff || 0}:${wx0},${wz0}`;
        const buf = cache.get(key);
        if (!buf) return false;
        caveGrid.set(buf);
        cache.delete(key);
        workerHits++;
        return true;
      },
      prefetchOverworld(cx, cz) {
        if (!active || currentDimension !== 'overworld' || (depthOffset || 0) !== 0) return false;
        if (inFlightTerrain.size >= Math.max(32, workers.length * 12)) return false;
        if (!_ensureAllLuts()) return false;
        const key = `${_worldEpoch}:${cx},${cz}`;
        if (terrainCache.has(key) || inFlightTerrain.has(key)) return false;
        const acList = (typeof getAncientCityLocations === 'function') ? getAncientCityLocations() : [];
        const ac = new Int32Array(8);
        for (let i = 0; i < 4 && i < acList.length; i++) {
          ac[i * 2] = acList[i].x | 0; ac[i * 2 + 1] = acList[i].z | 0;
        }
        inFlightTerrain.add(key);
        const wi = rr++ % workers.length;
        workers[wi].postMessage({
          type: 'gen_overworld',
          key,
          epoch: _worldEpoch,
          cx: cx | 0,
          cz: cz | 0,
          seed: worldSeed | 0,
          seedMix: { ox: seedMix.ox, oy: seedMix.oy, oz: seedMix.oz, c1: seedMix.c1, c2: seedMix.c2, c3: seedMix.c3, c4: seedMix.c4, b1: seedMix.b1, b2: seedMix.b2, s1: seedMix.s1 },
          acCoords: ac,
          dOff: 0,
          minY: MIN_Y | 0,
          maxY: MAX_Y | 0,
          waterLevel: WATER_LEVEL | 0
        }, [ac.buffer]);
        return true;
      },
      hasOverworld(cx, cz) {
        return terrainCache.has(`${_worldEpoch}:${cx},${cz}`);
      },
      takeOverworld(cx, cz) {
        const key = `${_worldEpoch}:${cx},${cz}`;
        const res = terrainCache.get(key);
        if (!res) return null;
        terrainCache.delete(key);
        workerHits++;
        _nucraftWasmState.workerTerrainHits++;
        return res;
      },
      enqueueMesh(ch, maxLy, borderBuf, emitters, emitLen, flagsBits, autumnCell) {
        if (!active || !workerMeshSupported || !ch || !ch.data || ch._skipWorkerMesh || inFlightMesh.size >= Math.max(24, workers.length * 10)) return false;
        if (!_ensureAllLuts()) return false;
        const mGen = ch._meshGen || 0;
        const key = `${_worldEpoch}:${ch.cx},${ch.cz}:${mGen}`;
        if (inFlightMesh.has(key) || ch._meshInFlightGen === mGen) return true;
        inFlightMesh.add(key);
        ch._meshInFlightGen = mGen;
        ch._meshInFlightAt = performance.now();
        const sliceLen = Math.min(ch.data.length, (maxLy + 1) << 8);
        const dataCopy = ch.data.slice(0, sliceLen);
        const borderCopy = borderBuf.slice(0);
        const emCopy = emitLen > 0 ? emitters.slice(0, emitLen) : new Float32Array(0);
        const autCopy = autumnCell ? autumnCell.slice(0) : new Uint8Array(16);
        const wi = rr++ % workers.length;
        workers[wi].postMessage({
          type: 'mesh_solid',
          key,
          epoch: _worldEpoch,
          meshGen: mGen,
          cx: ch.cx | 0,
          cz: ch.cz | 0,
          wx0: (ch.cx * CHUNK_W) | 0,
          wz0: (ch.cz * CHUNK_W) | 0,
          minY: MIN_Y | 0,
          waterLevel: WATER_LEVEL | 0,
          dOff: (depthOffset || 0) | 0,
          maxLy: maxLy >>> 0,
          emitLen: emitLen >>> 0,
          flagsBits: flagsBits >>> 0,
          grassId: B.GRASS & 0xffff,
          autumnPodzolId: B.AUTUMN_PODZOL & 0xffff,
          waterId: B.WATER & 0xffff,
          seagrassId: B.SEAGRASS & 0xffff,
          lavaId: B.LAVA & 0xffff,
          bedrockId: B.BEDROCK & 0xffff,
          deepslateId: B.DEEPSLATE & 0xffff,
          blkSolidFlag: BLK_SOLID & 0xffff,
          blkCrossFlag: BLK_CROSS & 0xffff,
          defaultMapU32: 0xff271811,
          maxEmitEntries: _initMobile ? 64 : 112,
          data: dataCopy,
          borderBuf: borderCopy,
          emitters: emCopy,
          autumnCell: autCopy
        }, [dataCopy.buffer, borderCopy.buffer, emCopy.buffer, autCopy.buffer]);
        return true;
      },
      drainCompletedMeshes(maxApply = 4, budgetMs = 1.6) {
        let applied = 0;
        const t0 = performance.now();
        if (completedMeshes.length > 3 && typeof player !== 'undefined' && player) {
          // Sort farthest-first so .pop() applies the closest visible chunks right in front of the player first!
          const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
          completedMeshes.sort((a, b) =>
            ((b.cx - pcx) * (b.cx - pcx) + (b.cz - pcz) * (b.cz - pcz)) -
            ((a.cx - pcx) * (a.cx - pcx) + (a.cz - pcz) * (a.cz - pcz))
          );
        }
        while (completedMeshes.length > 0 && applied < maxApply && (applied === 0 || (performance.now() - t0) < budgetMs)) {
          const rep = completedMeshes.pop();
          if (!rep || rep.epoch !== _worldEpoch) continue;
          const ch = chunks.get(chunkKey(rep.cx, rep.cz));
          if (!ch || !ch.data) continue;
          if (rep.meshGen !== (ch._meshGen || 0)) {
            if (ch._meshInFlightGen === rep.meshGen) ch._meshInFlightGen = -1;
            continue;
          }
          if (!ch.dirty && !ch.borderDirty && !ch.urgentDirty && ch.meshed) {
            ch._meshInFlightGen = -1;
            continue;
          }
          ch._meshInFlightGen = -1;
          rebuildChunkMesh(ch, rep);
          _nucraftWasmState.workerMeshHits++;
          applied++;
        }
        return applied;
      },
      requestLod(params, cb) {
        if (!active || _lodInFlight) return false;
        _lodInFlight = true;
        _lodCb = cb;
        const maskCopy = params.loadedMask.slice(0);
        const wi = rr++ % workers.length;
        workers[wi].postMessage({
          type: 'build_lod',
          epoch: _worldEpoch,
          centerCx: params.centerCx | 0,
          centerCz: params.centerCz | 0,
          seed: params.seed | 0,
          waterLevel: params.waterLevel | 0,
          step: params.step >>> 0,
          outerRadius: params.outerRadius >>> 0,
          maskRadius: params.maskRadius >>> 0,
          loadedMask: maskCopy
        }, [maskCopy.buffer]);
        return true;
      },
      clear() {
        _worldEpoch++;
        cache.clear();
        terrainCache.clear();
        inFlight.clear();
        inFlightTerrain.clear();
        inFlightMesh.clear();
        completedMeshes.length = 0;
        _lodInFlight = false;
        _lodCb = null;
      }
    };
  })();


  /* ============================================================================
   * 6. TWO-PASS LUANTI TREES, CAVE CRYSTALS/MUSHROOMS & BLOCK-LIGHT CHUNK MESHER
   * ============================================================================ */
  // Infinite World Coordinate Chunk Key (works seamlessly across millions of blocks!)
  const chunks = new Map(), emergeQueue = [], emergeSet = new Set(), worldMods = new Map(), worldModsByChunk = new Map();
  function dimModKey(wx, wy, wz, dim = currentDimension) {
    const k = modKey(wx, wy, wz);
    return (!dim || dim === 'overworld') ? k : (dim + ':' + k);
  }
  function parseWorldModKey(mk) {
    const colon = mk.indexOf(':');
    const dim = colon > 0 ? mk.slice(0, colon) : 'overworld';
    const coords = colon > 0 ? mk.slice(colon + 1) : mk;
    const c1 = coords.indexOf(','), c2 = coords.indexOf(',', c1 + 1);
    if (c1 < 0 || c2 < 0) return null;
    return {
      dim,
      mx: parseInt(coords.slice(0, c1), 10),
      my: parseInt(coords.slice(c1 + 1, c2), 10),
      mz: parseInt(coords.slice(c2 + 1), 10)
    };
  }
  function indexWorldModKey(mk, id) {
    const parsed = parseWorldModKey(mk);
    if (!parsed) return;
    if (parsed.dim !== (currentDimension || 'overworld')) return;
    const { mx, my, mz } = parsed;
    if (my < MIN_Y - 1200 || my > MAX_Y + 320) return;
    const ck = chunkKey(mx >> 4, mz >> 4);
    let cm = worldModsByChunk.get(ck);
    if (!cm) { cm = new Map(); worldModsByChunk.set(ck, cm); }
    cm.set(((my + 2048) << 8) | ((mz & 15) << 4) | (mx & 15), id);
  }
  function rebuildCurrentDimModIndex() {
    worldModsByChunk.clear();
    for (const [mk, id] of worldMods.entries()) indexWorldModKey(mk, id);
  }
  function recordWorldMod(wx, wy, wz, id) {
    const trueY = wy - (depthOffset || 0);
    worldMods.set(dimModKey(wx, trueY, wz, currentDimension), id);
    if (trueY < MIN_Y - 1200 || trueY > MAX_Y + 320) return;
    const ck = chunkKey(wx >> 4, wz >> 4);
    let cm = worldModsByChunk.get(ck);
    if (!cm) { cm = new Map(); worldModsByChunk.set(ck, cm); }
    cm.set(((trueY + 2048) << 8) | ((wz & 15) << 4) | (wx & 15), id);
  }
  // === Authentic Luanti + Minecraft Voxel Fire Lifecycle Engine ===
  const activeFires = new Map();
  const MAX_ACTIVE_FIRES = 100;
  let fireSimAccum = 0;

  function isPermanentFuel(id) {
    return id === B.NETHERRACK || id === B.OBSIDIAN || id === B.COAL_ORE || id === B.CAMPFIRE;
  }
  function isFlammable(id) {
    if (!id || id === B.AIR || id === B.FIRE || id === B.WATER || id === B.LAVA || id === B.CAMPFIRE || id === B.NETHER_FENCE) return false;
    const d = BLOCK_DEF[id];
    if (!d || d.chest || d.door || d.trapdoor || d.indestructible || d.portal || d.bed) return false;
    return !!(
      d.wood ||
      (d.foliage && !d.glass) ||
      id === B.HAY_BALE || id === B.CRAFT_TABLE || id === B.BOOKSHELF ||
      id === B.BAMBOO || id === B.BAMBOO_BLOCK || id === B.BAMBOO_PLANKS ||
      id === B.WHITE_WOOL || id === B.AUTUMN_BUSH ||
      (d.cross && !d.fire && !d.emissive && !d.flatTrack && !d.underwater)
    );
  }
  function registerFireBlock(wx, wy, wz) {
    const k = modKey(wx, wy, wz);
    if (activeFires.has(k) || activeFires.size >= MAX_ACTIVE_FIRES) return;
    activeFires.set(k, { x: wx, y: wy, z: wz, age: 0, maxAge: 4.5 + Math.random() * 4.0 });
  }
  function tickActiveFires(dt) {
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof isDimSimAuthority === 'function' && !isDimSimAuthority()) return;
    fireSimAccum += dt;
    if (fireSimAccum < 0.30 || activeFires.size === 0) return;
    const stepDt = fireSimAccum;
    fireSimAccum = 0;
    const dirs6 = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const entries = Array.from(activeFires.entries());
    const rainingNow = (typeof rainIntensity !== 'undefined' && rainIntensity > 0.45);
    if (typeof beginBlockBatch === 'function') beginBlockBatch();
    try {
    for (let i = 0; i < entries.length; i++) {
      const [k, f] = entries[i];
      const { x, y, z } = f;
      if (getBlockWorld(x, y, z) !== B.FIRE) { activeFires.delete(k); continue; }
      const dPlayer = Math.hypot(x - player.x, z - player.z);
      if (dPlayer > 72) continue;

      let wet = rainingNow && isExposedToSky(x + 0.5, y + 1, z + 0.5);
      let hasSupport = false;
      const flammables = [];
      for (let di = 0; di < 6; di++) {
        const nx = x + dirs6[di][0], ny = y + dirs6[di][1], nz = z + dirs6[di][2];
        const nb = getBlockWorld(nx, ny, nz);
        if (nb === B.WATER) { wet = true; break; }
        if (IS_SOLID[nb] === 1 || isFlammable(nb)) hasSupport = true;
        if (isFlammable(nb)) flammables.push([nx, ny, nz, nb]);
      }
      if (wet || !hasSupport) {
        setBlockWorld(x, y, z, B.AIR, true);
        activeFires.delete(k);
        if (dPlayer < 24) {
          spawnParticles(x + 0.5, y + 0.45, z + 0.5, 0x94a3b8, 4, false);
          if (wet && dPlayer < 16) playSfx('splash');
        }
        continue;
      }

      // Scan 3x3x3 neighborhood around fire so canopy fires climb vertically into tree crowns!
      if (flammables.length === 0) {
        for (let dy = 0; dy <= 2; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              const nb = getBlockWorld(x + dx, y + dy, z + dz);
              if (isFlammable(nb)) flammables.push([x + dx, y + dy, z + dz, nb]);
            }
          }
        }
      }

      const below = getBlockWorld(x, y - 1, z);
      const perm = isPermanentFuel(below);
      const nearFlammable = flammables.length > 0;

      // 1) Spread outward & upward to trees, leaves, wool, grass & wood (Luanti + Minecraft rules)
      if (nearFlammable && activeFires.size < MAX_ACTIVE_FIRES && Math.random() < 0.24) {
        const pick = flammables[(Math.random() * flammables.length) | 0];
        const [fx, fy, fz] = pick;
        const spreadTargets = [[fx, fy + 1, fz], [fx, fy + 1, fz], [fx + 1, fy, fz], [fx - 1, fy, fz], [fx, fy, fz + 1], [fx, fy, fz - 1]];
        const st = spreadTargets[(Math.random() * spreadTargets.length) | 0];
        if (st[1] > MIN_Y && st[1] <= MAX_Y) {
          const curb = getBlockWorld(st[0], st[1], st[2]);
          const curDef = BLOCK_DEF[curb];
          if (curb === B.AIR || (curDef && curDef.cross && curb !== B.FIRE)) {
            setBlockWorld(st[0], st[1], st[2], B.FIRE, true);
            igniteAdjacentTnt(st[0], st[1], st[2]);
          }
        }
      }

      // 2) Consume flammable blocks into ash/air or spreading embers
      if (nearFlammable && Math.random() < 0.16) {
        const pick = flammables[(Math.random() * flammables.length) | 0];
        const [fx, fy, fz, fId] = pick;
        const fDef = BLOCK_DEF[fId];
        const fastBurn = !!(fDef && (fDef.foliage || fDef.cross));
        if (fastBurn || Math.random() < 0.45) {
          const replaceWithFire = (activeFires.size < MAX_ACTIVE_FIRES && Math.random() < 0.55);
          setBlockWorld(fx, fy, fz, replaceWithFire ? B.FIRE : B.AIR, true);
          if (dPlayer < 26) {
            if (typeof spawnVoxelFx === 'function') {
              spawnVoxelFx('flame', fx + 0.5, fy + 0.5, fz + 0.5, 4);
              spawnVoxelFx('smoke', fx + 0.5, fy + 0.72, fz + 0.5, 3);
            } else {
              spawnParticles(fx + 0.5, fy + 0.5, fz + 0.5, 0xf97316, 4, true);
              spawnParticles(fx + 0.5, fy + 0.7, fz + 0.5, 0x475569, 3, false);
            }
          }
        }
      }

      // 3) Finite Burnout on non-flammable stone/dirt/grass; ambient rising smoke & sparks
      if (!perm) {
        f.age += stepDt * (nearFlammable ? 0.35 : 1.0);
        if (f.age >= f.maxAge) {
          setBlockWorld(x, y, z, B.AIR, true);
          activeFires.delete(k);
          if (dPlayer < 22) {
            if (typeof spawnVoxelFx === 'function') spawnVoxelFx('smoke', x + 0.5, y + 0.4, z + 0.5, 3);
            else spawnParticles(x + 0.5, y + 0.4, z + 0.5, 0x64748b, 3, false);
          }
          continue;
        }
      }
      if (dPlayer < 24 && Math.random() < 0.25) {
        if (typeof spawnVoxelFx === 'function') {
          spawnVoxelFx(Math.random() < 0.65 ? 'ember' : 'smoke', x + 0.25 + Math.random() * 0.5, y + 0.72, z + 0.25 + Math.random() * 0.5, 1);
        } else {
          spawnParticles(x + 0.25 + Math.random() * 0.5, y + 0.65, z + 0.25 + Math.random() * 0.5, Math.random() < 0.65 ? 0xf97316 : 0x475569, 1, Math.random() < 0.65);
        }
      }
    }
    flushUrgentChunks(4);
    } finally {
      if (typeof endBlockBatch === 'function') endBlockBatch();
    }
  }

  function clearWorldModsAll() { worldMods.clear(); worldModsByChunk.clear(); activeFires.clear(); }
  const chunkKey = (cx, cz) => (cx >= -16384 && cx < 16384 && cz >= -16384 && cz < 16384) ? (((cx + 16384) << 15) | (cz + 16384)) : `${cx},${cz}`;
  const _urgentChunkSet = new Set(), _dirtyChunkSet = new Set(), _borderChunkSet = new Set();
  let _lastChCx = 0x7fffffff, _lastChCz = 0x7fffffff, _lastChRef = null;
  function _invChunkCache() { _lastChCx = 0x7fffffff; _lastChRef = null; }
  function _getChunkFast(cx, cz) {
    if (cx === _lastChCx && cz === _lastChCz && _lastChRef) return _lastChRef;
    const c = chunks.get(chunkKey(cx, cz));
    if (c) { _lastChCx = cx; _lastChCz = cz; _lastChRef = c; }
    return c;
  }
  function registerChunk(k, ch) {
    const prev = chunks.get(k);
    if (prev && prev !== ch) {
      _dirtyChunkSet.delete(prev); _urgentChunkSet.delete(prev); _borderChunkSet.delete(prev);
      disposeChunkMeshes(prev, true);
      _freeChunkData(prev);
    }
    // Verify ch.maxLy covers every non-air voxel (prevents tall tree tops, structures, or mods above maxLy from turning invisible!)
    if (ch.data && ch.maxLy < WORLD_H - 1) {
      const d = ch.data;
      const curTop = Math.max(0, ch.maxLy | 0);
      outerTop: for (let ly = WORLD_H - 1; ly > curTop; ly--) {
        const base = ly << 8;
        for (let i = 0; i < 256; i++) {
          if (d[base | i] !== 0) { ch.maxLy = ly; break outerTop; }
        }
      }
    }
    chunks.set(k, ch);
    _invChunkCache();
    if (ch.dirty) _dirtyChunkSet.add(ch);
    if (ch.urgentDirty) _urgentChunkSet.add(ch);
    if (ch.borderDirty) _borderChunkSet.add(ch);
    if (typeof player !== 'undefined' && player && Math.abs((ch.cx << 4) + 8 - player.x) <= 44 && Math.abs((ch.cz << 4) + 8 - player.z) <= 44) window._rtVolDirty = true;
    return ch;
  }
  const _flushScratch = [];
  function flushUrgentChunks(maxRebuilds = 8, includeDirty = false, budgetMs = 0) {
    let rebuilt = 0;
    const t0 = budgetMs > 0 ? performance.now() : 0;
    const pcx = (typeof player !== 'undefined' && player) ? (Math.floor(player.x) >> 4) : 0;
    const pcz = (typeof player !== 'undefined' && player) ? (Math.floor(player.z) >> 4) : 0;
    const _byDist = (a, b) => ((a.cx - pcx) * (a.cx - pcx) + (a.cz - pcz) * (a.cz - pcz)) - ((b.cx - pcx) * (b.cx - pcx) + (b.cz - pcz) * (b.cz - pcz));
    const _byUrgent = (a, b) => ((a._emitDirty ? 0 : 1) - (b._emitDirty ? 0 : 1)) || _byDist(a, b);
    _flushScratch.length = 0;
    for (const ch of _urgentChunkSet) _flushScratch.push(ch);
    if (_flushScratch.length > 1) _flushScratch.sort(_byUrgent);
    for (let i = 0; i < _flushScratch.length; i++) {
      const ch = _flushScratch[i];
      if (ch.urgentDirty || (includeDirty && ch.dirty)) {
        rebuildChunkMesh(ch);
        if (++rebuilt >= maxRebuilds || (budgetMs > 0 && (performance.now() - t0) >= budgetMs)) { _flushScratch.length = 0; return; }
      } else {
        _urgentChunkSet.delete(ch);
      }
    }
    if (includeDirty) {
      _flushScratch.length = 0;
      for (const ch of _dirtyChunkSet) _flushScratch.push(ch);
      if (_flushScratch.length > 1) _flushScratch.sort(_byDist);
      for (let i = 0; i < _flushScratch.length; i++) {
        const ch = _flushScratch[i];
        if (ch.dirty || ch.urgentDirty) {
          rebuildChunkMesh(ch);
          if (++rebuilt >= maxRebuilds || (budgetMs > 0 && (performance.now() - t0) >= budgetMs)) { _flushScratch.length = 0; return; }
        } else {
          _dirtyChunkSet.delete(ch);
        }
      }
    }
    _flushScratch.length = 0;
  }
  const modKey = (wx, wy, wz) => `${wx},${wy},${wz}`;


  // FerriteCore: Pooled chunk voxel buffers (zero large TypedArray GC churn across ocean/exploration!)
  const _chunkDataPool = [];
  function _allocChunkData() {
    if (typeof sodiumOpts !== 'undefined' && sodiumOpts.ferriteRam && _chunkDataPool.length > 0) {
      const buf = _chunkDataPool.pop();
      buf.fill(0);
      window._ferritePoolHits = (window._ferritePoolHits || 0) + 1;
      return buf;
    }
    return new Uint16Array(CHUNK_W * WORLD_H * CHUNK_W);
  }
  function _freeChunkData(ch) {
    if (!ch || !ch.data) return;
    if (typeof sodiumOpts !== 'undefined' && sodiumOpts.ferriteRam && _chunkDataPool.length < 96) {
      _chunkDataPool.push(ch.data);
    }
    ch.data = null;
  }


  const FACES = [
    { dir: [0, 1, 0],  tileIdx: 0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], uAxis:[1,0,0], vAxis:[0,0,-1] },
    { dir: [0, -1, 0], tileIdx: 2, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uAxis:[1,0,0], vAxis:[0,0,1]  },
    { dir: [1, 0, 0],  tileIdx: 1, corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], uAxis:[0,0,-1],vAxis:[0,1,0]  },
    { dir: [-1, 0, 0], tileIdx: 1, corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], uAxis:[0,0,1], vAxis:[0,1,0]  },
    { dir: [0, 0, 1],  tileIdx: 1, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], uAxis:[1,0,0], vAxis:[0,1,0]  },
    { dir: [0, 0, -1], tileIdx: 1, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], uAxis:[-1,0,0],vAxis:[0,1,0]  }
  ];
  const AO_LUT = [1.0, 0.84, 0.68, 0.50];


  const _camFrustum = new THREE.Frustum(), _camProjView = new THREE.Matrix4();
  const _cullSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  let _camFrustumReady = false;
  function _refreshCamFrustum() {
    camera.updateMatrixWorld();
    _camProjView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _camFrustum.setFromProjectionMatrix(_camProjView);
    _camFrustumReady = true;
  }


  const _CHUNK_MESH_KEYS = ['mesh', 'leavesMesh', 'leavesCrossMesh', 'emissiveMesh', 'portalMesh', 'waterMesh', 'lavaMesh', 'plantMesh'];
  function disposeChunkMeshes(ch, keepInteractive = false) {
    if (!keepInteractive) clearChunkInteractiveVisuals(chunkKey(ch.cx, ch.cz));
    for (let i = 0; i < _CHUNK_MESH_KEYS.length; i++) {
      const key = _CHUNK_MESH_KEYS[i];
      if (ch[key]) { scene.remove(ch[key]); ch[key].geometry.dispose(); ch[key] = null; }
    }
    ch.meshed = false;
  }

  const _MESH_USTEP = 1 / ATLAS_COLS, _MESH_VSTEP = 1 / ATLAS_ROWS, _MESH_PADU = 0.002, _MESH_PADV = 0.002;
  const _ATLAS_TILES = ATLAS_COLS * ATLAS_ROWS;
  const TILE_U0 = new Float32Array(_ATLAS_TILES), TILE_U1 = new Float32Array(_ATLAS_TILES);
  const TILE_V0 = new Float32Array(_ATLAS_TILES), TILE_V1 = new Float32Array(_ATLAS_TILES);
  for (let _t = 0; _t < _ATLAS_TILES; _t++) {
    const _tx = _t & 7, _ty = _t >> 3;
    TILE_U0[_t] = _tx * _MESH_USTEP + _MESH_PADU;
    TILE_U1[_t] = (_tx + 1) * _MESH_USTEP - _MESH_PADU;
    TILE_V0[_t] = _ty * _MESH_VSTEP + _MESH_PADV;
    TILE_V1[_t] = (_ty + 1) * _MESH_VSTEP - _MESH_PADV;
  }
  if (typeof window._syncWasmBlockLuts === 'function') window._syncWasmBlockLuts(false);

  let _sCap = 16384;
  let _sPos = new Float32Array(_sCap * 3), _sNorm = new Float32Array(_sCap * 3), _sUvs = new Float32Array(_sCap * 2), _sCols = new Float32Array(_sCap * 3), _sBL = new Float32Array(_sCap * 3);
  let _sIdx = new Uint32Array((_sCap * 3) >> 1);
  function _growSolidScratch(vNeed) {
    let nCap = _sCap;
    while (nCap < vNeed) nCap <<= 1;
    const p = new Float32Array(nCap * 3), n = new Float32Array(nCap * 3), u = new Float32Array(nCap * 2), c = new Float32Array(nCap * 3), b = new Float32Array(nCap * 3), ix = new Uint32Array((nCap * 3) >> 1);
    p.set(_sPos); n.set(_sNorm); u.set(_sUvs); c.set(_sCols); b.set(_sBL); ix.set(_sIdx);
    _sPos = p; _sNorm = n; _sUvs = u; _sCols = c; _sBL = b; _sIdx = ix; _sCap = nCap;
  }

  let _lCap = 8192;
  let _lPos = new Float32Array(_lCap * 3), _lNorm = new Float32Array(_lCap * 3), _lUvs = new Float32Array(_lCap * 2), _lCols = new Float32Array(_lCap * 3), _lBL = new Float32Array(_lCap * 3);
  let _lIdx = new Uint32Array((_lCap * 3) >> 1);
  function _growLeafScratch(vNeed) {
    let nCap = _lCap;
    while (nCap < vNeed) nCap <<= 1;
    const p = new Float32Array(nCap * 3), n = new Float32Array(nCap * 3), u = new Float32Array(nCap * 2), c = new Float32Array(nCap * 3), b = new Float32Array(nCap * 3), ix = new Uint32Array((nCap * 3) >> 1);
    p.set(_lPos); n.set(_lNorm); u.set(_lUvs); c.set(_lCols); b.set(_lBL); ix.set(_lIdx);
    _lPos = p; _lNorm = n; _lUvs = u; _lCols = c; _lBL = b; _lIdx = ix; _lCap = nCap;
  }

  function _makeIdxAttr(srcU32, iLen, vCount) {
    if (vCount <= 65535) {
      const u16 = new Uint16Array(iLen);
      for (let i = 0; i < iLen; i++) u16[i] = srcU32[i];
      return new THREE.BufferAttribute(u16, 1);
    }
    return new THREE.BufferAttribute(Array.isArray(srcU32) ? new Uint32Array(srcU32.slice(0, iLen)) : srcU32.slice(0, iLen), 1);
  }

  const _emBuf = new Float32Array(336), _ownScanBuf = new Float32Array(336), _secEmBuf = new Float32Array(336), _sliceEmBuf = new Float32Array(336);
  const _EMPTY_EM_BUF = new Float32Array(0), _EMPTY_NODES = [];
  const _tmpLight = new Float32Array(3);
  let _sliceMinX = -999, _sliceMaxX = 999, _sliceMinZ = -999, _sliceMaxZ = 999;

  // Sodium + Sodium Extra + Lithium + ImmediatelyFast + Entity Culling + More Culling + FerriteCore + ModernFix + ScalableLux Config
  const SODIUM_OPTS_KEY = 'nucraft_sodium_opts_v85';
  const sodiumOpts = Object.assign({
    sodium: true,         // Sodium Core: direct fast render path, adaptive shadow cadence & tight chunk budget
    entityCulling: true,  // Entity Culling: skip rendering & skeletal animation for frustum/voxel-occluded mobs
    moreCulling: true,    // More Culling: smart interior leaf culling, bottom bedrock culling & sub-model culling
    fastLight: true,      // ScalableLux: cache chunk emitters, AABB slice bounds & squared-distance light solver
    lithiumAi: true,      // Lithium: distance-tiered AI/collision & idle separation early-out
    immFast: true,        // ImmediatelyFast: InstancedMesh batch particles & shared entity GLB materials
    ferriteRam: true,     // FerriteCore + ModernFix: pooled Uint16 chunk arrays & bounded LRU cache
    fpsHud: true,         // Sodium Extra: live FPS / Chunk / Entity / Optimization HUD badge
    smoothShadows: true,  // Sodium Extra: 60-240Hz texel-snapped smooth sun shadows
    waterRefl: true,      // Water shader: culled real-time planar water reflections
    waterQuality: true,   // Enhanced water detail: multi-octave waves, dual caustics & foam
    autoPerf: true,       // Dynamic auto-scaling under sustained low FPS
    sharpness: true,      // Post-FX clarity unsharp sharpening
    modernFix: true,      // ModernFix: incremental/on-demand audio decode, throttled minimap & dirty-checked HUD
    quickPack: true,      // Quick Pack: fast cache-first bundle loading & texture reuse
    fpsTarget: 0,         // Target FPS cap (0 = MAX unlocked, 60 / 120 / 240)
    weatherFx: true,      // Sodium Extra: rain/snow weather particle toggle
    clouds: true,         // Sodium Extra: volumetric / voxel clouds toggle
    fog: true,            // Sodium Extra: atmospheric & deep sea fog toggle
    particles: true,      // Sodium Extra: block break & spell particles toggle
    animations: true,     // Sodium Extra: skeletal & crystal animations toggle
    farEntities: true,    // Sodium Extra: distant entity rendering toggle
    farLod: false,        // Disabled: Luanti/Minecraft proximity chunk loading + clean horizon fog only
    greedyMesh: true,     // Horizon-style Rust WASM 2D greedy solid face merging
    frameGen: 1,          // AI Frame Gen (1=Off, 2=x2, 4=x4 reprojection + optical-flow + RCAS super-res)
    rayTracing: false     // Real-time Ray Tracing GI, mirror water reflections & leaf light transmission
  }, (() => { try { return JSON.parse(localStorage.getItem(SODIUM_OPTS_KEY) || '{}') || {}; } catch (_) { return {}; } })());
  sodiumOpts.farLod = false;
  if (typeof window !== 'undefined') window.sodiumOpts = sodiumOpts;

  // Far LOD disabled: only real chunks loaded within renderDistance are rendered behind clean distance fog
  const farLodSystem = {
    isActive: () => false,
    isVisible: () => false,
    hide() {},
    dispose() {},
    markChunkMeshed() {},
    update() {}
  };
  if (typeof envUniforms !== 'undefined') {
    if (envUniforms.uSharpness) envUniforms.uSharpness.value = sodiumOpts.sharpness ? 0.18 : 0.0;
    if (envUniforms.uUsePlanarRefl) envUniforms.uUsePlanarRefl.value = sodiumOpts.waterRefl ? 1.0 : 0.0;
    if (envUniforms.uWaterQuality) envUniforms.uWaterQuality.value = sodiumOpts.waterQuality !== false ? 1.0 : 0.0;
    if (envUniforms.uRayTracing) envUniforms.uRayTracing.value = sodiumOpts.rayTracing ? 1.0 : 0.0;
  }
  function saveSodiumOpts() {
    try { localStorage.setItem(SODIUM_OPTS_KEY, JSON.stringify(sodiumOpts)); } catch (_) {}
  }

  // FerriteCore / ModernFix: Shared reusable scratch arrays for chunk sub-meshes (zero Array allocations per chunk rebuild!)
  const _ePos = [], _eUvs = [], _eType = [], _eIndices = [];
  const _ptPos = [], _ptNorm = [], _ptUvs = [], _ptKind = [], _ptIndices = [], _ptQuads = [];
  const _makeFluidBuf = (cap) => ({ cap, pos: new Float32Array(cap * 3), norm: new Float32Array(cap * 3), isTop: new Float32Array(cap), shore: new Float32Array(cap), depth: new Float32Array(cap), idx: new Uint32Array((cap * 3) >> 1) });
  function _growFluidBuf(b, vNeed) {
    let nCap = b.cap; while (nCap < vNeed) nCap <<= 1;
    const pos = new Float32Array(nCap * 3), norm = new Float32Array(nCap * 3), isTop = new Float32Array(nCap), shore = new Float32Array(nCap), depth = new Float32Array(nCap), idx = new Uint32Array((nCap * 3) >> 1);
    pos.set(b.pos); norm.set(b.norm); isTop.set(b.isTop); shore.set(b.shore); depth.set(b.depth); idx.set(b.idx);
    b.pos = pos; b.norm = norm; b.isTop = isTop; b.shore = shore; b.depth = depth; b.idx = idx; b.cap = nCap;
  }
  const _wBuf = _makeFluidBuf(4096), _lvBuf = _makeFluidBuf(4096);
  const _pPos = [], _pNorm = [], _pUvs = [], _pSway = [], _pSkyShade = [], _pBLights = [], _pIndices = [];
  const _meshSt = { vCount: 0, iCount: 0, lCount: 0, liCount: 0, eCount: 0, ptCount: 0, wCount: 0, wiCount: 0, lvCount: 0, lviCount: 0, pCount: 0 };

  // Sodium: O(1) tight analytical bounding sphere assignment (eliminates Three.js 40k-vertex scan on first draw!)
  function _assignChunkBounds(geo, wx0, wz0, maxLy) {
    const halfH = (maxLy + 1) * 0.5;
    const cy = MIN_Y + halfH;
    const rad = Math.sqrt(128 + halfH * halfH) + 1.5;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(wx0 + 8, cy, wz0 + 8), rad);
  }

  function _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz) {
    const _edgeAt = (yy) => (lx >= 0 && lx < 16 && lz >= 0 && lz < 16)
      ? data[(yy << 8) | (lz << 4) | lx]
      : _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, yy, lz);
    if (ly < 0) {
      if (currentDimension === 'end') return B.AIR;
      if ((depthOffset || 0) > 0) {
        const ty = (MIN_Y + ly) - depthOffset;
        if (ty <= -1001) return B.BEDROCK;
        const edgeB = _edgeAt(0);
        return (edgeB === B.WATER || edgeB === B.SEAGRASS) ? B.WATER : (edgeB === B.LAVA ? B.LAVA : (edgeB === B.AIR ? B.AIR : B.DEEPSLATE));
      }
      return B.BEDROCK;
    }
    if (ly >= WORLD_H) {
      if ((depthOffset || 0) > 0 && currentDimension !== 'end') {
        const ty = (MIN_Y + ly) - depthOffset;
        const edgeB = _edgeAt(WORLD_H - 1);
        if (ty <= WATER_LEVEL && (edgeB === B.WATER || edgeB === B.SEAGRASS)) return B.WATER;
        if (IS_OPAQUE[edgeB]) return B.DEEPSLATE;
      }
      return B.AIR;
    }
    if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) return data[(ly << 8) | (lz << 4) | lx];
    if (lx === 16 && lz >= 0 && lz < 16) return dXP ? dXP[(ly << 8) | (lz << 4)] : B.AIR;
    if (lx === -1 && lz >= 0 && lz < 16) return dXM ? dXM[(ly << 8) | (lz << 4) | 15] : B.AIR;
    if (lz === 16 && lx >= 0 && lx < 16) return dZP ? dZP[(ly << 8) | lx] : B.AIR;
    if (lz === -1 && lx >= 0 && lx < 16) return dZM ? dZM[(ly << 8) | 240 | lx] : B.AIR;
    return getBlockWorld(wx0 + lx, MIN_Y + ly, wz0 + lz);
  }

  let _lightNodeSpecCache = null;
  function _getLightNodeSpec(id) {
    if (!_lightNodeSpecCache) {
      _lightNodeSpecCache = {
        [B.LANTERN]: { col: 0xffca7a, int: 1.38, dist: 28, lvl: 15, rad: 20, prio: 1 },
        [B.SOUL_LANTERN]: { col: 0x38e8ff, int: 1.28, dist: 25, lvl: 14, rad: 18, prio: 1 },
        [B.SOUL_FIRE]: { col: 0x22d3ee, int: 0.78, dist: 19, lvl: 12, rad: 14, prio: 1 },
        [B.CANDLE]: { col: 0xfbbf24, int: 0.68, prio: 1 },
        [B.TORCH_BLOCK]: { col: 0xffbc68, int: 1.26, dist: 25, lvl: 14, rad: 18, prio: 1 },
        [B.SHROOMLIGHT]: { col: 0xffb338, int: 0.78 },
        [B.CAMPFIRE]: { col: 0xff8c2e, int: 0.78 },
        [B.FIRE]: { col: 0xff8c2e, int: 0.68 },
        [B.SEA_LANTERN]: { col: 0x72f5eb, int: 0.82 },
        [B.END_CRYSTAL_BLOCK]: { col: 0xe879f9, int: 0.76 },
        [B.END_ROD]: { col: 0xfef3ff, int: 0.88, prio: 1 },
        [B.NETHER_PORTAL]: { col: 0xc084fc, int: 0.78, prio: 1 },
        [B.END_PORTAL]: { col: 0xc084fc, int: 0.78, prio: 1 },
        [B.END_GATEWAY]: { col: 0x818cf8, int: 0.78, prio: 1 },
        [B.DREAM_PORTAL]: { col: 0x67e8f9, int: 0.78, prio: 1 },
        [B.WARDEN_PORTAL]: { col: 0x22d3ee, int: 0.78, prio: 1 },
        [B.SCULK_SENSOR]: { col: 0x06b6d4, int: 0.58, cap: 16 },
        [B.SCULK_SHRIEKER]: { col: 0x06b6d4, int: 0.58, cap: 16 },
        [B.SCULK_CATALYST]: { col: 0x06b6d4, int: 0.58, cap: 16 },
        [B.ENDER_CHEST_BLOCK]: { col: 0x06b6d4, int: 0.58, cap: 16 },
        [B.MAGMA_BLOCK]: { col: 0xff6b1a, int: 0.72, cap: 14 },
        [B.LAVA]: { col: 0xff6b1a, int: 0.72, cap: 12 },
        [B.GLOW_CRYSTAL]: { col: 0x4cc9ff, int: 0.68, cap: 16 },
        [B.SIFT_CYAN_CRYSTAL]: { col: 0x38f2ff, int: 0.72, cap: 16 },
        [B.ELEVATOR_BLOCK]: { col: 0x4fd1ff, int: 0.62, cap: 14 },
        [B.GLOW_VINES]: { col: 0xffc44d, int: 0.62, cap: 14 },
        [B.SIFT_VINE]: { col: 0x22d3ee, int: 0.56, cap: 14 },
        [B.DRAGON_MINT_CRYSTAL]: { col: 0x8ef5e4, int: 0.44, cap: 14 },
        [B.MUSHROOM_GLOW]: { col: 0x38f2ff, int: 0.55, cap: 12 },
        [B.SPORE_SHROOM]: { col: 0x38f2ff, int: 0.55, cap: 12 }
      };
    }
    return _lightNodeSpecCache[id] || { col: 0xffc864, int: 0.62, cap: 12 };
  }

  function _unpackWasmScanToChunk(targetCh, emitOut, emitLen8, specOut, specLen4, topH, mapU32) {
    const cx = targetCh.cx, cz = targetCh.cz, wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W;
    const maxEm = _initMobile ? 168 : 336;
    let emLen = 0;
    const lightNodes = [], secLightNodes = [], portalNodes = [], ventNodes = [];
    let fireNodes = 0;
    for (let i = 0; i < emitLen8; i += 8) {
      const lxOff = emitOut[i], lyOff = emitOut[i + 1], lzOff = emitOut[i + 2];
      const r = emitOut[i + 3], g = emitOut[i + 4], b = emitOut[i + 5], rad2 = emitOut[i + 6];
      const bid = emitOut[i + 7] | 0;
      if ((bid === B.FIRE || bid === B.SOUL_FIRE) && fireNodes < 16 && ventNodes.length < 64) {
        ventNodes.push({ x: Math.floor(wx0 + lxOff), y: MIN_Y + Math.floor(lyOff), z: Math.floor(wz0 + lzOff), kind: bid === B.SOUL_FIRE ? 'soul_fire' : 'fire' });
        fireNodes++;
      }
      if (emLen < maxEm) {
        _ownScanBuf[emLen] = lxOff; _ownScanBuf[emLen + 1] = lyOff; _ownScanBuf[emLen + 2] = lzOff;
        _ownScanBuf[emLen + 3] = r; _ownScanBuf[emLen + 4] = g; _ownScanBuf[emLen + 5] = b; _ownScanBuf[emLen + 6] = rad2;
        emLen += 7;
      }
      const spec = _getLightNodeSpec(bid);
      const node = { x: wx0 + lxOff, y: MIN_Y + lyOff, z: wz0 + lzOff, col: spec.col, int: spec.int, r, g, b, rad2 };
      if (spec.dist) node.dist = spec.dist;
      if (spec.lvl) node.lvl = spec.lvl;
      if (spec.rad) node.rad = spec.rad;
      if (spec.prio) { node.prio = 1; lightNodes.push(node); }
      else if (spec.cap) { if (secLightNodes.length < spec.cap) secLightNodes.push(node); }
      else lightNodes.push(node);
    }
    for (let i = 0; i < specLen4; i += 4) {
      const lx = specOut[i] | 0, ly = specOut[i + 1] | 0, lz = specOut[i + 2] | 0, bid = specOut[i + 3] | 0;
      if (bid === B.SULFUR_VENT || bid === B.CAMPFIRE) {
        if (ventNodes.length < 64) ventNodes.push({ x: wx0 + lx, y: MIN_Y + ly, z: wz0 + lz, kind: bid === B.CAMPFIRE ? 'campfire' : 'vent' });
      } else if (bid === B.NETHER_PORTAL || bid === B.DREAM_PORTAL || bid === B.WARDEN_PORTAL) {
        if (portalNodes.length < 24) portalNodes.push({ x: wx0 + lx + 0.5, y: MIN_Y + ly + 0.5, z: wz0 + lz + 0.5, kind: bid === B.WARDEN_PORTAL ? 3 : (bid === B.DREAM_PORTAL ? 1 : 0) });
      }
    }
    for (let si = 0; si < secLightNodes.length && lightNodes.length < 24; si++) lightNodes.push(secLightNodes[si]);
    targetCh._ownEm = emLen > 0 ? new Float32Array(_ownScanBuf.subarray(0, emLen)) : _EMPTY_EM_BUF;
    targetCh._ownNodes = lightNodes;
    targetCh._ownPortalNodes = portalNodes;
    targetCh._ownVentNodes = ventNodes;
    targetCh.lightNodes = lightNodes;
    targetCh.portalNodes = portalNodes;
    targetCh.ventNodes = ventNodes;
    targetCh._emitDirty = false;
    if (topH && topH.length === 256) targetCh.topMap = new Int16Array(topH);
    if (mapU32 && mapU32.length === 256) targetCh._wasmMapU32 = new Uint32Array(mapU32);
  }

  function _refreshOwnEmitters(targetCh) {
    if (!targetCh || !targetCh.data) return;
    if (_nwExports && _nwExports.scan_chunk_emitters_and_topmap && _syncMainWasmLuts(false)) {
      _syncWasmViews();
      const maxLy = Math.min(WORLD_H - 1, targetCh.maxLy);
      const copyWords = Math.min(targetCh.data.length, (maxLy + 1) << 8);
      _nwChunkData.set(targetCh.data.subarray(0, copyWords));
      const total = _nwExports.scan_chunk_emitters_and_topmap(maxLy >>> 0, (_initMobile ? 64 : 112) >>> 0, BLK_CROSS >>> 0, 0xff271811) >>> 0;
      const specCnt = _nwScanMeta ? (_nwScanMeta[2] >>> 0) : 0;
      _unpackWasmScanToChunk(targetCh, _nwScanEmitOut, total * 8, _nwScanSpecOut, specCnt * 4, _nwScanTopH, _nwScanMapU32);
      _nucraftWasmState.scanCalls++;
      return;
    }
    const cx = targetCh.cx, cz = targetCh.cz, wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W;
    const data = targetCh.data, maxLy = Math.min(WORLD_H - 1, targetCh.maxLy);
    const maxEm = _initMobile ? 168 : 336;
    let emLen = 0, secLen = 0, fireNodes = 0;
    const lightNodes = [];
    const portalNodes = [];
    const ventNodes = [];
    const secLightNodes = [];
    for (let ly = 0; ly <= maxLy; ly++) {
      const yOff = ly << 8;
      for (let lz = 0; lz < 16; lz++) {
        const zOff = yOff | (lz << 4);
        for (let lx = 0; lx < 16; lx++) {
          const id = data[zOff | lx];
          if (IS_EMISSIVE[id] === 0) continue;
          const lwx = wx0 + lx + 0.5, lwy = MIN_Y + ly + 0.5, lwz = wz0 + lz + 0.5;
          if (id === B.SULFUR_VENT && ventNodes.length < 64) {
            ventNodes.push({ x: wx0 + lx, y: MIN_Y + ly, z: wz0 + lz, kind: 'vent' });
          }
          if (id === B.LANTERN) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=1.28; _ownScanBuf[emLen+4]=0.96; _ownScanBuf[emLen+5]=0.54; _ownScanBuf[emLen+6]=400.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xffca7a, int: 1.38, dist: 28, lvl: 15, r: 1.28, g: 0.96, b: 0.54, rad: 20, rad2: 400.0, prio: 1 });
          } else if (id === B.SOUL_LANTERN) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.46; _ownScanBuf[emLen+4]=1.06; _ownScanBuf[emLen+5]=1.26; _ownScanBuf[emLen+6]=324.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x38e8ff, int: 1.28, dist: 25, lvl: 14, r: 0.46, g: 1.06, b: 1.26, rad: 18, rad2: 324.0, prio: 1 });
          } else if (id === B.SOUL_FIRE) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.30; _ownScanBuf[emLen+4]=0.78; _ownScanBuf[emLen+5]=0.96; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x22d3ee, int: 0.78, dist: 19, lvl: 12, r: 0.30, g: 0.78, b: 0.96, rad: 14, rad2: 196.0, prio: 1 });
            if (fireNodes < 16 && ventNodes.length < 64) { ventNodes.push({ x: wx0 + lx, y: MIN_Y + ly, z: wz0 + lz, kind: 'soul_fire' }); fireNodes++; }
          } else if (id === B.CANDLE) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.45; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.86; _ownScanBuf[emLen+4]=0.64; _ownScanBuf[emLen+5]=0.34; _ownScanBuf[emLen+6]=144.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xfbbf24, int: 0.68, r: 0.86, g: 0.64, b: 0.34, rad2: 144.0, prio: 1 });
          } else if (id === B.SCULK_SENSOR || id === B.SCULK_SHRIEKER || id === B.SCULK_CATALYST || id === B.ENDER_CHEST_BLOCK) {
            if (secLen < maxEm) {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.22; _secEmBuf[secLen+4]=0.68; _secEmBuf[secLen+5]=0.82; _secEmBuf[secLen+6]=121.0; secLen+=7;
              if (secLightNodes.length < 16) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x06b6d4, int: 0.58, r: 0.22, g: 0.68, b: 0.82, rad2: 121.0 });
            }
          } else if (id === B.TORCH_BLOCK) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=1.18; _ownScanBuf[emLen+4]=0.88; _ownScanBuf[emLen+5]=0.48; _ownScanBuf[emLen+6]=324.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xffbc68, int: 1.26, dist: 25, lvl: 14, r: 1.18, g: 0.88, b: 0.48, rad: 18, rad2: 324.0, prio: 1 });
          } else if (id === B.SHROOMLIGHT) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.84; _ownScanBuf[emLen+4]=0.58; _ownScanBuf[emLen+5]=0.28; _ownScanBuf[emLen+6]=169.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xffb338, int: 0.78, r: 0.84, g: 0.58, b: 0.28, rad2: 169.0 });
          } else if (id === B.CAMPFIRE || id === B.FIRE) {
            const fRad = (id === B.FIRE) ? 144.0 : 169.0;
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.86; _ownScanBuf[emLen+4]=0.50; _ownScanBuf[emLen+5]=0.22; _ownScanBuf[emLen+6]=fRad; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xff8c2e, int: id === B.FIRE ? 0.68 : 0.78, r: 0.86, g: 0.50, b: 0.22, rad2: fRad });
            if (id === B.CAMPFIRE && ventNodes.length < 48) {
              ventNodes.push({ x: wx0 + lx, y: MIN_Y + ly, z: wz0 + lz, kind: 'campfire' });
            } else if (id === B.FIRE && fireNodes < 16 && ventNodes.length < 64) {
              ventNodes.push({ x: wx0 + lx, y: MIN_Y + ly, z: wz0 + lz, kind: 'fire' });
              fireNodes++;
            }
          } else if (id === B.SEA_LANTERN) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.44; _ownScanBuf[emLen+4]=0.82; _ownScanBuf[emLen+5]=0.90; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x72f5eb, int: 0.82, r: 0.44, g: 0.82, b: 0.90, rad2: 196.0 });
          } else if (id === B.END_CRYSTAL_BLOCK) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.76; _ownScanBuf[emLen+4]=0.38; _ownScanBuf[emLen+5]=0.86; _ownScanBuf[emLen+6]=169.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xe879f9, int: 0.76, r: 0.76, g: 0.38, b: 0.86, rad2: 169.0 });
          } else if (id === B.END_ROD) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.92; _ownScanBuf[emLen+4]=0.88; _ownScanBuf[emLen+5]=0.96; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xfef3ff, int: 0.88, r: 0.92, g: 0.88, b: 0.96, rad2: 196.0, prio: 1 });
          } else if (id === B.NETHER_PORTAL || id === B.END_PORTAL || id === B.END_GATEWAY || id === B.DREAM_PORTAL || id === B.WARDEN_PORTAL || id === B.DRAGON_REALM_PORTAL) {
            const isWardP = (id === B.WARDEN_PORTAL);
            const isEndP = (id === B.END_GATEWAY || id === B.DRAGON_REALM_PORTAL);
            const pR = isWardP ? 0.14 : (id === B.DREAM_PORTAL ? 0.45 : (isEndP ? 0.49 : 0.69));
            const pG = isWardP ? 0.80 : (id === B.DREAM_PORTAL ? 0.75 : (isEndP ? 0.63 : 0.39));
            const pB = isWardP ? 0.88 : (isEndP ? 0.88 : 0.81);
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=pR; _ownScanBuf[emLen+4]=pG; _ownScanBuf[emLen+5]=pB; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: isWardP ? 0x22d3ee : (id === B.DREAM_PORTAL ? 0x67e8f9 : (isEndP ? 0x818cf8 : 0xc084fc)), int: 0.78, r: pR, g: pG, b: pB, rad2: 196.0, prio: 1 });
            if ((id === B.NETHER_PORTAL || id === B.DREAM_PORTAL || isWardP) && portalNodes.length < 24) {
              portalNodes.push({ x: lwx, y: lwy, z: lwz, kind: isWardP ? 3 : (id === B.DREAM_PORTAL ? 1 : 0) });
            }
          } else if (secLen < maxEm) {
            if (id === B.MAGMA_BLOCK) {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.85; _secEmBuf[secLen+4]=0.34; _secEmBuf[secLen+5]=0.10; _secEmBuf[secLen+6]=121.0; secLen+=7;
              if (secLightNodes.length < 14) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xff6b1a, int: 0.72, r: 0.85, g: 0.34, b: 0.10, rad2: 121.0 });
            } else if (id === B.LAVA) {
              if ((lx & 3) === 0 && (lz & 3) === 0 && (ly & 1) === 0) {
                _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.82; _secEmBuf[secLen+4]=0.36; _secEmBuf[secLen+5]=0.12; _secEmBuf[secLen+6]=144.0; secLen+=7;
                if (secLightNodes.length < 12) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xff6b1a, int: 0.72, r: 0.82, g: 0.36, b: 0.12, rad2: 144.0 });
              }
            } else if (id === B.GLOW_CRYSTAL) {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.36; _secEmBuf[secLen+4]=0.72; _secEmBuf[secLen+5]=0.86; _secEmBuf[secLen+6]=144.0; secLen+=7;
              if (secLightNodes.length < 16) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x4cc9ff, int: 0.68, r: 0.36, g: 0.72, b: 0.86, rad2: 144.0 });
            } else if (id === B.ELEVATOR_BLOCK) {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.34; _secEmBuf[secLen+4]=0.68; _secEmBuf[secLen+5]=0.84; _secEmBuf[secLen+6]=121.0; secLen+=7;
              if (secLightNodes.length < 14) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x4fd1ff, int: 0.62, r: 0.34, g: 0.68, b: 0.84, rad2: 121.0 });
            } else if (id === B.GLOW_VINES) {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.74; _secEmBuf[secLen+4]=0.54; _secEmBuf[secLen+5]=0.24; _secEmBuf[secLen+6]=121.0; secLen+=7;
              if (secLightNodes.length < 14) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xffc44d, int: 0.62, r: 0.74, g: 0.54, b: 0.24, rad2: 121.0 });
            } else if (id === B.MUSHROOM_GLOW || id === B.SPORE_SHROOM) {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.26; _secEmBuf[secLen+4]=0.68; _secEmBuf[secLen+5]=0.74; _secEmBuf[secLen+6]=100.0; secLen+=7;
              if (secLightNodes.length < 12) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x38f2ff, int: 0.55, r: 0.26, g: 0.68, b: 0.74, rad2: 100.0 });
            } else {
              _secEmBuf[secLen]=lx+0.5; _secEmBuf[secLen+1]=ly+0.5; _secEmBuf[secLen+2]=lz+0.5; _secEmBuf[secLen+3]=0.76; _secEmBuf[secLen+4]=0.58; _secEmBuf[secLen+5]=0.32; _secEmBuf[secLen+6]=121.0; secLen+=7;
              if (secLightNodes.length < 12) secLightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xffc864, int: 0.62, r: 0.76, g: 0.58, b: 0.32, rad2: 121.0 });
            }
          }
        }
      }
    }
    for (let si = 0; si < secLen && emLen < maxEm; si++) _ownScanBuf[emLen++] = _secEmBuf[si];
    for (let si = 0; si < secLightNodes.length && lightNodes.length < 24; si++) lightNodes.push(secLightNodes[si]);
    targetCh._ownEm = emLen > 0 ? new Float32Array(_ownScanBuf.subarray(0, emLen)) : _EMPTY_EM_BUF;
    targetCh._ownNodes = lightNodes;
    targetCh._ownPortalNodes = portalNodes;
    targetCh._ownVentNodes = ventNodes;
    targetCh.lightNodes = lightNodes;
    targetCh.portalNodes = portalNodes;
    targetCh.ventNodes = ventNodes;
    targetCh._emitDirty = false;
  }

  function _scanChunkEmitters(ch, cx, cz, wx0, wz0, data, maxLy) {
    const maxEm = _initMobile ? 168 : 336;
    if (!sodiumOpts.fastLight || ch._emitDirty || ch._ownEm === undefined) _refreshOwnEmitters(ch);
    const own = ch._ownEm || _EMPTY_EM_BUF;
    let emLen = Math.min(maxEm, own.length);
    for (let k = 0; k < emLen; k++) _emBuf[k] = own[k];
    const lightNodes = (ch._ownNodes && ch._ownNodes.length > 0) ? ch._ownNodes : _EMPTY_NODES;
    const portalNodes = (ch._ownPortalNodes && ch._ownPortalNodes.length > 0) ? ch._ownPortalNodes : _EMPTY_NODES;
    const prevLightCnt = ch._prevLightCount || 0;
    ch.lightNodes = lightNodes;
    ch.portalNodes = portalNodes;
    ch.ventNodes = (ch._ownVentNodes && ch._ownVentNodes.length > 0) ? ch._ownVentNodes : _EMPTY_NODES;
    ch._prevLightCount = lightNodes.length;
    if (lightNodes.length !== prevLightCnt) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (dx !== 0 || dz !== 0) markChunkBorderDirty(cx + dx, cz + dz);
      }
    }
    const _collectNbr = (nx, nz, minRad2) => {
      const nbCh = chunks.get(chunkKey(nx, nz));
      if (!nbCh) return;
      if (nbCh._emitDirty || nbCh._ownEm === undefined) _refreshOwnEmitters(nbCh);
      const nodes = nbCh.lightNodes;
      if (!nodes || nodes.length === 0) return;
      for (let ni = 0; ni < nodes.length && emLen < maxEm; ni++) {
        const ln = nodes[ni];
        if (minRad2 > 0 && ln.rad2 <= minRad2) continue;
        const rPad = (ln.rad || Math.sqrt(ln.rad2)) + 1.5;
        const elx = ln.x - wx0, ely = ln.y - MIN_Y, elz = ln.z - wz0;
        if (elx > -rPad && elx < 16 + rPad && elz > -rPad && elz < 16 + rPad) {
          _emBuf[emLen]=elx; _emBuf[emLen+1]=ely; _emBuf[emLen+2]=elz; _emBuf[emLen+3]=ln.r; _emBuf[emLen+4]=ln.g; _emBuf[emLen+5]=ln.b; _emBuf[emLen+6]=ln.rad2; emLen+=7;
        }
      }
    };
    for (let dz = -1; dz <= 1 && emLen < maxEm; dz++) for (let dx = -1; dx <= 1 && emLen < maxEm; dx++) {
      if (dx !== 0 || dz !== 0) _collectNbr(cx + dx, cz + dz, 0);
    }
    for (let dz = -2; dz <= 2 && emLen < maxEm; dz++) for (let dx = -2; dx <= 2 && emLen < maxEm; dx++) {
      const ax = Math.abs(dx), az = Math.abs(dz);
      if ((ax === 2 || az === 2) && !(ax === 2 && az === 2)) _collectNbr(cx + dx, cz + dz, 256.0);
    }
    return emLen;
  }

  function _evalLightSlice(lx, ly, lz, sliceBuf, sliceLen, out) {
    if (sodiumOpts.fastLight && (lx < _sliceMinX || lx > _sliceMaxX || lz < _sliceMinZ || lz > _sliceMaxZ)) {
      out[0] = 0; out[1] = 0; out[2] = 0;
      return;
    }
    if (_nwExports && sliceBuf === _sliceEmBuf && sliceLen <= 3584) {
      _syncWasmViews();
      _nwExports.eval_light_slice(lx, ly, lz, sliceLen);
      out[0] = _nwLightOut[0]; out[1] = _nwLightOut[1]; out[2] = _nwLightOut[2];
      _nucraftWasmState.lightCalls++;
      return;
    }
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < sliceLen; i += 7) {
      const rad2 = sliceBuf[i + 6];
      const dy = ly - sliceBuf[i + 1], dy2 = dy * dy;
      if (dy2 >= rad2) continue;
      const dx = lx - sliceBuf[i], dxy2 = dy2 + dx * dx;
      if (dxy2 >= rad2) continue;
      const dz = lz - sliceBuf[i + 2], d2 = dxy2 + dz * dz;
      if (d2 < rad2) {
        const u = 1.0 - d2 / rad2, att2 = u * (0.58 + 0.42 * u);
        r += sliceBuf[i + 3] * att2; g += sliceBuf[i + 4] * att2; b += sliceBuf[i + 5] * att2;
      }
    }
    out[0] = Math.min(1.35, r / (1.0 + r * 0.32));
    out[1] = Math.min(1.35, g / (1.0 + g * 0.32));
    out[2] = Math.min(1.35, b / (1.0 + b * 0.32));
  }

  function _pushSolidBox(wx, wy, wz, x0, y0, z0, x1, y1, z1, tTop, tSide, tBot, lr, lg, lb, fitUv, st) {
    const vc = st.vCount;
    if (vc + 24 > _sCap) _growSolidScratch(vc + 24);
    const bx0 = wx + x0, bx1 = wx + x1, by0 = wy + y0, by1 = wy + y1, bz0 = wz + z0, bz1 = wz + z1;
    let vp = vc * 3, up = vc * 2, ip = st.iCount, curV = vc;
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const tile = face.tileIdx === 0 ? tTop : (face.tileIdx === 1 ? tSide : tBot);
      const tu0 = TILE_U0[tile], tu1 = TILE_U1[tile], tv0 = TILE_V0[tile], tv1 = TILE_V1[tile];
      const shadeM = f === 0 ? 1.0 : (f === 1 ? 0.68 : (f < 4 ? 0.86 : 0.92));
      const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
      for (let c = 0; c < 4; c++) {
        const cr = face.corners[c];
        _sPos[vp] = cr[0] ? bx1 : bx0; _sPos[vp+1] = cr[1] ? by1 : by0; _sPos[vp+2] = cr[2] ? bz1 : bz0;
        _sNorm[vp] = dx; _sNorm[vp+1] = dy; _sNorm[vp+2] = dz;
        _sCols[vp] = shadeM; _sCols[vp+1] = shadeM; _sCols[vp+2] = shadeM;
        _sBL[vp] = lr; _sBL[vp+1] = lg; _sBL[vp+2] = lb;
        vp += 3;
      }
      let su0 = tu0, su1 = tu1, sv0 = tv0, sv1 = tv1;
      if (!fitUv) {
        if (f < 2) {
          su0 = tu0 + (tu1 - tu0) * x0; su1 = tu0 + (tu1 - tu0) * x1;
          sv0 = tv0 + (tv1 - tv0) * z0; sv1 = tv0 + (tv1 - tv0) * z1;
        } else if (f < 4) {
          su0 = tu0 + (tu1 - tu0) * x0; su1 = tu0 + (tu1 - tu0) * x1;
          sv0 = tv0 + (tv1 - tv0) * (1 - y1); sv1 = tv0 + (tv1 - tv0) * (1 - y0);
        } else {
          su0 = tu0 + (tu1 - tu0) * z0; su1 = tu0 + (tu1 - tu0) * z1;
          sv0 = tv0 + (tv1 - tv0) * (1 - y1); sv1 = tv0 + (tv1 - tv0) * (1 - y0);
        }
      }
      _sUvs[up]=su0; _sUvs[up+1]=sv1; _sUvs[up+2]=su1; _sUvs[up+3]=sv1; _sUvs[up+4]=su1; _sUvs[up+5]=sv0; _sUvs[up+6]=su0; _sUvs[up+7]=sv0; up += 8;
      _sIdx[ip]=curV; _sIdx[ip+1]=curV+1; _sIdx[ip+2]=curV+2; _sIdx[ip+3]=curV; _sIdx[ip+4]=curV+2; _sIdx[ip+5]=curV+3;
      ip += 6; curV += 4;
    }
    st.vCount = curV; st.iCount = ip;
  }

  function _pushSingleSolidFace(wx, wy, wz, x0, y0, z0, x1, y1, z1, f, tile, lr, lg, lb, fitUv, st) {
    const vc = st.vCount;
    if (vc + 4 > _sCap) _growSolidScratch(vc + 4);
    const face = FACES[f];
    const bx0 = wx + x0, bx1 = wx + x1, by0 = wy + y0, by1 = wy + y1, bz0 = wz + z0, bz1 = wz + z1;
    const tu0 = TILE_U0[tile], tu1 = TILE_U1[tile], tv0 = TILE_V0[tile], tv1 = TILE_V1[tile];
    const shadeM = f === 0 ? 1.0 : (f === 1 ? 0.68 : (f < 4 ? 0.86 : 0.92));
    const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
    let vp = vc * 3, up = vc * 2, ip = st.iCount;
    for (let c = 0; c < 4; c++) {
      const cr = face.corners[c];
      _sPos[vp] = cr[0] ? bx1 : bx0; _sPos[vp+1] = cr[1] ? by1 : by0; _sPos[vp+2] = cr[2] ? bz1 : bz0;
      _sNorm[vp] = dx; _sNorm[vp+1] = dy; _sNorm[vp+2] = dz;
      _sCols[vp] = shadeM; _sCols[vp+1] = shadeM; _sCols[vp+2] = shadeM;
      _sBL[vp] = lr; _sBL[vp+1] = lg; _sBL[vp+2] = lb;
      vp += 3;
    }
    let su0 = tu0, su1 = tu1, sv0 = tv0, sv1 = tv1;
    if (!fitUv) {
      if (f < 2) {
        su0 = tu0 + (tu1 - tu0) * x0; su1 = tu0 + (tu1 - tu0) * x1;
        sv0 = tv0 + (tv1 - tv0) * z0; sv1 = tv0 + (tv1 - tv0) * z1;
      } else if (f < 4) {
        su0 = tu0 + (tu1 - tu0) * z0; su1 = tu0 + (tu1 - tu0) * z1;
        sv0 = tv0 + (tv1 - tv0) * (1 - y1); sv1 = tv0 + (tv1 - tv0) * (1 - y0);
      } else {
        su0 = tu0 + (tu1 - tu0) * x0; su1 = tu0 + (tu1 - tu0) * x1;
        sv0 = tv0 + (tv1 - tv0) * (1 - y1); sv1 = tv0 + (tv1 - tv0) * (1 - y0);
      }
    }
    _sUvs[up]=su0; _sUvs[up+1]=sv1; _sUvs[up+2]=su1; _sUvs[up+3]=sv1; _sUvs[up+4]=su1; _sUvs[up+5]=sv0; _sUvs[up+6]=su0; _sUvs[up+7]=sv0;
    _sIdx[ip]=vc; _sIdx[ip+1]=vc+1; _sIdx[ip+2]=vc+2; _sIdx[ip+3]=vc; _sIdx[ip+4]=vc+2; _sIdx[ip+5]=vc+3;
    st.vCount = vc + 4; st.iCount = ip + 6;
  }

  function _isFluidMatch(id, fluidId, wy) {
    if (id === fluidId) return true;
    if (fluidId !== B.WATER) return false;
    return id === B.SEAGRASS || (id === B.MANGROVE_ROOTS && wy <= WATER_LEVEL);
  }
  function _getFluidCornerHeight(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, cxOff, czOff, fluidId, hasFluidLevels, lvStep) {
    let sum = 0, wSum = 0, hasSource = false;
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const sx = lx + cxOff + dx, sz = lz + czOff + dz;
      const b = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, ly, sz);
      if (_isFluidMatch(b, fluidId, wy)) {
        const bUp = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, ly + 1, sz);
        if (_isFluidMatch(bUp, fluidId, wy + 1)) return 1.0;
        const fl = hasFluidLevels ? (fluidLevel.get(modKey(wx + cxOff + dx, wy, wz + czOff + dz)) || 0) : 0;
        if (fl === 8) return 1.0;
        if (fl === 0) { hasSource = true; continue; }
        sum += Math.max(0.16, 0.86 - fl * lvStep); wSum += 1;
      } else if (IS_SOLID[b] === 0 && IS_OPAQUE[b] === 0) {
        sum += 0.14; wSum += 1;
      }
    }
    if (hasSource) return 0.86;
    return wSum > 0 ? (sum / wSum) : 0.86;
  }
  const _fluidFaceCfg = { upNb: 0, fl: 0, isFalling: false, h00: 0.86, h10: 0.86, h11: 0.86, h01: 0.86 };
  const _wDepthCache = new Float32Array(324);
  const _wDepthStamp = new Uint32Array(324);
  let _wDepthGen = 1;
  function _bumpWaterDepthCache() {
    _wDepthGen = (_wDepthGen + 1) >>> 0;
    if (_wDepthGen === 0) { _wDepthStamp.fill(0); _wDepthGen = 1; }
  }

  function _getFluidFaceConfig(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, fluidId, hasFluidLevels, lvStep) {
    const upNb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz);
    const fl = hasFluidLevels ? (fluidLevel.get(modKey(wx, wy, wz)) || 0) : 0;
    const isFalling = _isFluidMatch(upNb, fluidId, wy + 1) || fl === 8;
    const cfg = _fluidFaceCfg;
    cfg.upNb = upNb; cfg.fl = fl; cfg.isFalling = isFalling;
    if (isFalling) {
      cfg.h00 = 1.0; cfg.h10 = 1.0; cfg.h11 = 1.0; cfg.h01 = 1.0;
      return cfg;
    }
    if (!hasFluidLevels && fluidId === B.WATER && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
      const r0 = (ly << 8) | (lz << 4) | lx;
      const b0 = data[r0 - 17], b1 = data[r0 - 16], b2 = data[r0 - 15], b3 = data[r0 - 1], b4 = data[r0 + 1], b5 = data[r0 + 15], b6 = data[r0 + 16], b7 = data[r0 + 17];
      const ok = (b, off) => {
        if (_isFluidMatch(b, B.WATER, wy)) {
          if (ly + 1 >= WORLD_H) return true;
          const bu = data[off + 256];
          return !_isFluidMatch(bu, B.WATER, wy + 1);
        }
        return IS_OPAQUE[b] === 1;
      };
      if (ok(b0, r0 - 17) && ok(b1, r0 - 16) && ok(b2, r0 - 15) && ok(b3, r0 - 1) && ok(b4, r0 + 1) && ok(b5, r0 + 15) && ok(b6, r0 + 16) && ok(b7, r0 + 17)) {
        cfg.h00 = 0.86; cfg.h10 = 0.86; cfg.h11 = 0.86; cfg.h01 = 0.86;
        return cfg;
      }
    }
    cfg.h00 = _getFluidCornerHeight(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 0, 0, fluidId, hasFluidLevels, lvStep);
    cfg.h10 = _getFluidCornerHeight(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 1, 0, fluidId, hasFluidLevels, lvStep);
    cfg.h11 = _getFluidCornerHeight(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 1, 1, fluidId, hasFluidLevels, lvStep);
    cfg.h01 = _getFluidCornerHeight(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 0, 1, fluidId, hasFluidLevels, lvStep);
    return cfg;
  }

  function _getFluidCornerDepth(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, cxOff, czOff) {
    const wy = MIN_Y + ly;
    let sum = 0, wSum = 0;
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const sx = lx + cxOff + dx, sz = lz + czOff + dz;
      let colD = -1.0;
      const inCache = (sx >= -1 && sx <= 16 && sz >= -1 && sz <= 16);
      const slot = inCache ? ((sz + 1) * 18 + (sx + 1)) : 0;
      if (inCache && _wDepthStamp[slot] === _wDepthGen) {
        colD = _wDepthCache[slot];
      } else {
        const b = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, ly, sz);
        if (_isFluidMatch(b, B.WATER, wy)) {
          let d = 1;
          const minY = Math.max(0, ly - 12);
          for (let yy = ly - 1; yy >= minY; yy--) {
            const sub = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, yy, sz);
            if (_isFluidMatch(sub, B.WATER, MIN_Y + yy)) d++;
            else break;
          }
          colD = Math.min(1.0, (d - 1) / 10.0);
        }
        if (inCache) {
          _wDepthStamp[slot] = _wDepthGen;
          _wDepthCache[slot] = colD;
        }
      }
      if (colD >= 0.0) { sum += colD; wSum++; }
    }
    return wSum > 0 ? (sum / wSum) : 0.0;
  }

  function _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, cxOff, czOff, fluidId, hasFluidLevels) {
    let floorSum = 0, fluidCount = 0, anyFlow = false;
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const sx = lx + cxOff + dx, sz = lz + czOff + dz;
      const b = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, ly, sz);
      if (IS_SOLID[b] === 1 && !_isFluidMatch(b, fluidId, wy)) return 1.0;
      if (_isFluidMatch(b, fluidId, wy)) {
        fluidCount++;
        if (hasFluidLevels) {
          const fl = fluidLevel.get(modKey(wx + cxOff + dx, wy, wz + czOff + dz)) || 0;
          if (fl > 0 && fl < 8) anyFlow = true;
        }
        if (ly > 0) {
          const b1 = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, ly - 1, sz);
          if (IS_SOLID[b1] === 1 && !_isFluidMatch(b1, fluidId, wy - 1)) floorSum += 0.55;
          else if (ly > 1) {
            const b2 = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, sx, ly - 2, sz);
            if (IS_SOLID[b2] === 1 && !_isFluidMatch(b2, fluidId, wy - 2)) floorSum += 0.25;
          }
        }
      }
    }
    const shallow = fluidCount > 0 ? (floorSum / fluidCount) : 0.0;
    return anyFlow ? Math.max(shallow, 0.85) : shallow;
  }

  function _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, id, hasFluidLevels, fBuf, st) {
    if (id === B.WATER && ly > 0) {
      const nbBelow = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
      if (_canFluidReplace(nbBelow)) {
        scheduleFluid(wx, wy, wz, 0.08);
      } else if (hasFluidLevels && IS_SOLID[nbBelow] === 1 && fluidLevel.has(modKey(wx, wy, wz))) {
        // Only wake active player-poured/flowing water from mesher; natural lakes/columns stay zero-CPU until disturbed by block break
        const curFl = getFluidLevel(wx, wy, wz, B.WATER);
        if (curFl < 7 || curFl === 8) {
          const nXP = (lx < 15 || dXP) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) : B.STONE;
          const nXM = (lx > 0  || dXM) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) : B.STONE;
          const nZP = (lz < 15 || dZP) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) : B.STONE;
          const nZM = (lz > 0  || dZM) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) : B.STONE;
          if (_canFluidReplace(nXP) || _canFluidReplace(nXM) || _canFluidReplace(nZP) || _canFluidReplace(nZM)) {
            scheduleFluid(wx, wy, wz, 0.10);
          }
        }
      }
    }
    if (id === B.WATER && !hasFluidLevels && lx > 0 && lx < 15 && lz > 0 && lz < 15 && ly > 0 && ly < WORLD_H - 1) {
      const cIdx = zOff | lx;
      const n1 = data[cIdx + 1], n2 = data[cIdx - 1], n3 = data[cIdx + 256], n4 = data[cIdx - 256], n5 = data[cIdx + 16], n6 = data[cIdx - 16];
      if ((n1 === B.WATER || n1 === B.SEAGRASS || IS_OPAQUE[n1] === 1) && (n2 === B.WATER || n2 === B.SEAGRASS || IS_OPAQUE[n2] === 1) &&
          (n3 === B.WATER || n3 === B.SEAGRASS || IS_OPAQUE[n3] === 1) && (n4 === B.WATER || n4 === B.SEAGRASS || IS_OPAQUE[n4] === 1) &&
          (n5 === B.WATER || n5 === B.SEAGRASS || IS_OPAQUE[n5] === 1) && (n6 === B.WATER || n6 === B.SEAGRASS || IS_OPAQUE[n6] === 1)) return;
    }
    const cfg = _getFluidFaceConfig(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, B.WATER, hasFluidLevels, 0.10);
    const isFlowing = (cfg.fl > 0 && cfg.fl < 8) || (Math.abs(cfg.h00 - cfg.h11) > 0.02 || Math.abs(cfg.h10 - cfg.h01) > 0.02);
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = lx + face.dir[0], ny = ly + face.dir[1], nz = lz + face.dir[2];
      if ((nx === 16 && !dXP) || (nx === -1 && !dXM) || (nz === 16 && !dZP) || (nz === -1 && !dZM)) continue;
      const nb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nx, ny, nz);
      const nwy = wy + face.dir[1];
      if (f === 0 && _isFluidMatch(nb, B.WATER, nwy)) continue;
      const nbGlass = !!(BLOCK_DEF_ARR[nb] && BLOCK_DEF_ARR[nb].glass);
      // Never emit coplanar Water face against Lava (prevents Water-Lava Z-fighting / overlapping liquid artifacts)
      if (f === 1 && (_isFluidMatch(nb, B.WATER, nwy) || nb === B.LAVA || IS_OPAQUE[nb] === 1 || nbGlass)) continue;
      if (f >= 2 && (_isFluidMatch(nb, B.WATER, nwy) || nb === B.LAVA || IS_OPAQUE[nb] === 1 || nbGlass)) continue;
      if (f >= 2 && IS_SLAB[nb] > 0 && waterloggedBlocks.has(modKey(wx + face.dir[0], nwy, wz + face.dir[2]))) continue;
      const vc = st.wCount;
      if (vc + 4 > fBuf.cap) _growFluidBuf(fBuf, vc + 4);
      let vp = vc * 3;
      const isTop = (f === 0) ? 1.0 : 0.0;
      const d00 = isTop > 0.5 ? _getFluidCornerDepth(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, 0, 0) : 0.45;
      const d10 = isTop > 0.5 ? _getFluidCornerDepth(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, 1, 0) : 0.45;
      const d11 = isTop > 0.5 ? _getFluidCornerDepth(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, 1, 1) : 0.45;
      const d01 = isTop > 0.5 ? _getFluidCornerDepth(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, 0, 1) : 0.45;
      const s00 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 0, 0, B.WATER, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      const s10 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 1, 0, B.WATER, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      const s11 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 1, 1, B.WATER, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      const s01 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 0, 1, B.WATER, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      for (let c = 0; c < 4; c++) {
        const cr = face.corners[c];
        const cyTop = cr[0] ? (cr[2] ? cfg.h11 : cfg.h10) : (cr[2] ? cfg.h01 : cfg.h00);
        const vi = vc + c;
        fBuf.pos[vp] = wx + cr[0]; fBuf.pos[vp + 1] = wy + (cr[1] === 1 ? cyTop : 0.0); fBuf.pos[vp + 2] = wz + cr[2];
        fBuf.norm[vp] = face.dir[0]; fBuf.norm[vp + 1] = face.dir[1]; fBuf.norm[vp + 2] = face.dir[2];
        vp += 3;
        fBuf.isTop[vi] = isTop;
        fBuf.depth[vi] = isTop > 0.5 ? (cr[0] ? (cr[2] ? d11 : d10) : (cr[2] ? d01 : d00)) : 0.45;
        fBuf.shore[vi] = isTop > 0.5 ? (cr[0] ? (cr[2] ? s11 : s10) : (cr[2] ? s01 : s00)) : (isFlowing ? 0.85 : 0.0);
      }
      const ip = st.wiCount;
      fBuf.idx[ip] = vc; fBuf.idx[ip + 1] = vc + 1; fBuf.idx[ip + 2] = vc + 2;
      fBuf.idx[ip + 3] = vc; fBuf.idx[ip + 4] = vc + 2; fBuf.idx[ip + 5] = vc + 3;
      st.wCount = vc + 4; st.wiCount = ip + 6;
    }
  }

  function _meshLavaVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, hasFluidLevels, fBuf, st) {
    if (ly > 0) {
      const nbBelow = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
      if (_canFluidReplace(nbBelow)) {
        scheduleFluid(wx, wy, wz, 0.14);
      } else if (hasFluidLevels && IS_SOLID[nbBelow] === 1 && fluidLevel.has(modKey(wx, wy, wz))) {
        // Only wake active player-poured/flowing lava from mesher; natural Nether lavafalls & seas stay zero-CPU until disturbed!
        const lavaMax = (currentDimension === 'nether') ? 7 : 3;
        const curFl = getFluidLevel(wx, wy, wz, B.LAVA);
        if (curFl < lavaMax || curFl === 8) {
          const nXP = (lx < 15 || dXP) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) : B.STONE;
          const nXM = (lx > 0  || dXM) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) : B.STONE;
          const nZP = (lz < 15 || dZP) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) : B.STONE;
          const nZM = (lz > 0  || dZM) ? _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) : B.STONE;
          if (_canFluidReplace(nXP) || _canFluidReplace(nXM) || _canFluidReplace(nZP) || _canFluidReplace(nZM)) {
            scheduleFluid(wx, wy, wz, currentDimension === 'nether' ? 0.16 : 0.28);
          }
        }
      }
    }
    if (!hasFluidLevels && lx > 0 && lx < 15 && lz > 0 && lz < 15 && ly > 0 && ly < WORLD_H - 1) {
      const cIdx = zOff | lx;
      const n1 = data[cIdx + 1], n2 = data[cIdx - 1], n3 = data[cIdx + 256], n4 = data[cIdx - 256], n5 = data[cIdx + 16], n6 = data[cIdx - 16];
      if ((n1 === B.LAVA || IS_OPAQUE[n1] === 1) && (n2 === B.LAVA || IS_OPAQUE[n2] === 1) &&
          (n3 === B.LAVA || IS_OPAQUE[n3] === 1) && (n4 === B.LAVA || IS_OPAQUE[n4] === 1) &&
          (n5 === B.LAVA || IS_OPAQUE[n5] === 1) && (n6 === B.LAVA || IS_OPAQUE[n6] === 1)) return;
    }
    const lvStep = (currentDimension === 'nether') ? 0.10 : 0.19;
    const cfg = _getFluidFaceConfig(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, B.LAVA, hasFluidLevels, lvStep);
    const isFlowing = (cfg.fl > 0 && cfg.fl < 8) || (Math.abs(cfg.h00 - cfg.h11) > 0.02 || Math.abs(cfg.h10 - cfg.h01) > 0.02);
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = lx + face.dir[0], ny = ly + face.dir[1], nz = lz + face.dir[2];
      if ((nx === 16 && !dXP) || (nx === -1 && !dXM) || (nz === 16 && !dZP) || (nz === -1 && !dZM)) continue;
      const nb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nx, ny, nz);
      if (nb === B.LAVA || IS_OPAQUE[nb] === 1) continue;
      const vc = st.lvCount;
      if (vc + 4 > fBuf.cap) _growFluidBuf(fBuf, vc + 4);
      let vp = vc * 3;
      const isTop = (f === 0) ? 1.0 : 0.0;
      const s00 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 0, 0, B.LAVA, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      const s10 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 1, 0, B.LAVA, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      const s11 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 1, 1, B.LAVA, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      const s01 = isTop > 0.5 ? _getFluidCornerShore(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, 0, 1, B.LAVA, hasFluidLevels) : (isFlowing ? 0.85 : 0.0);
      for (let c = 0; c < 4; c++) {
        const cr = face.corners[c];
        const cyTop = cr[0] ? (cr[2] ? cfg.h11 : cfg.h10) : (cr[2] ? cfg.h01 : cfg.h00);
        const vi = vc + c;
        fBuf.pos[vp] = wx + cr[0]; fBuf.pos[vp + 1] = wy + (cr[1] === 1 ? cyTop : 0.0); fBuf.pos[vp + 2] = wz + cr[2];
        fBuf.norm[vp] = face.dir[0]; fBuf.norm[vp + 1] = face.dir[1]; fBuf.norm[vp + 2] = face.dir[2];
        vp += 3;
        fBuf.isTop[vi] = isTop; fBuf.shore[vi] = isTop > 0.5 ? (cr[0] ? (cr[2] ? s11 : s10) : (cr[2] ? s01 : s00)) : (isFlowing ? 0.85 : 0.0); fBuf.depth[vi] = 0.0;
      }
      const ip = st.lviCount;
      fBuf.idx[ip] = vc; fBuf.idx[ip + 1] = vc + 1; fBuf.idx[ip + 2] = vc + 2;
      fBuf.idx[ip + 3] = vc; fBuf.idx[ip + 4] = vc + 2; fBuf.idx[ip + 5] = vc + 3;
      st.lvCount = vc + 4; st.lviCount = ip + 6;
    }
  }

  function _meshCrossPlantVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, maxLy, sliceLen, ePos, eUvs, eType, eIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st) {
    const tile = def.tiles[0], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
    const isFlat = (id === B.SAKURA_PETALS || id === B.LILY_PAD || !!def.flatTrack);
    const flatY = (id === B.LILY_PAD) ? -0.085 : (def.flatTrack ? 0.04 : 0.03);
    const isHanging = (id === B.VINE || id === B.GLOW_VINES || id === B.SIFT_VINE || id === B.MANGROVE_PROPAGULE || id === B.WEEPING_VINES);
    let stackBelow = 0, stackAbove = 0;
    if (!isFlat) {
      if (isHanging) {
        while (stackAbove < 6 && _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1 + stackAbove, lz) === id) stackAbove++;
      } else {
        while (stackBelow < 6 && _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1 - stackBelow, lz) === id) stackBelow++;
        if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz) === id) stackAbove = 1;
      }
    }
    const isStacked = (stackBelow > 0 || stackAbove > 0);
    const isWheatCrop = (id === B.WHEAT_0 || id === B.WHEAT_1 || id === B.WHEAT_2 || id === B.WHEAT_3);
    let quads;
    if (def.flatTrack) {
      const hasR = (rx, ry, rz) => (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, rx, ry, rz) === B.RAIL || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, rx, ry + 1, rz) === B.RAIL || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, rx, ry - 1, rz) === B.RAIL);
      const rX = hasR(lx - 1, ly, lz) || hasR(lx + 1, ly, lz);
      const rZ = hasR(lx, ly, lz - 1) || hasR(lx, ly, lz + 1);
      let alongX = rX && !rZ;
      if (!rX && !rZ) {
        const wallZ = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1)] === 1 || IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1)] === 1;
        const wallX = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz)] === 1 || IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz)] === 1;
        alongX = wallZ && !wallX;
      }
      const qZ = [[0.0, flatY, 1.0], [1.0, flatY, 1.0], [1.0, flatY, 0.0], [0.0, flatY, 0.0]];
      const qX = [[0.0, flatY, 0.0], [0.0, flatY, 1.0], [1.0, flatY, 1.0], [1.0, flatY, 0.0]];
      if (rX && rZ) quads = [qZ, [[0.0, flatY + 0.005, 0.0], [0.0, flatY + 0.005, 1.0], [1.0, flatY + 0.005, 1.0], [1.0, flatY + 0.005, 0.0]]];
      else quads = [alongX ? qX : qZ];
    } else if (isFlat) {
      quads = [[[0.04,flatY,0.96],[0.96,flatY,0.96],[0.96,flatY,0.04],[0.04,flatY,0.04]]];
    } else if (isWheatCrop) {
      const prW1 = hash2i(wx, wz, 577), prW2 = hash2i(wx + 23, wz - 17, 613);
      const isShaderWheat = (shaderQuality !== 'low');
      const baseHW = id === B.WHEAT_3 ? (isShaderWheat ? 1.18 : 1.04) : (id === B.WHEAT_2 ? (isShaderWheat ? 1.02 : 0.94) : (id === B.WHEAT_1 ? 0.82 : 0.65));
      const hW = baseHW + (isShaderWheat ? (prW1 - 0.42) * 0.22 : 0.0);
      const jxW = isShaderWheat ? (prW1 - 0.5) * 0.08 : 0.0;
      const jzW = isShaderWheat ? (prW2 - 0.5) * 0.08 : 0.0;
      const pad = 0.23, far = 0.77;
      quads = [
        [[0.02 + jxW, 0.0, pad + jzW], [0.98 + jxW, 0.0, pad + jzW], [0.98 + jxW, hW, pad + jzW], [0.02 + jxW, hW, pad + jzW]],
        [[0.02 - jxW, 0.0, far - jzW], [0.98 - jxW, 0.0, far - jzW], [0.98 - jxW, hW * 0.96, far - jzW], [0.02 - jxW, hW * 0.96, far - jzW]],
        [[pad + jxW, 0.0, 0.02 + jzW], [pad + jxW, 0.0, 0.98 + jzW], [pad + jxW, hW * 0.98, 0.98 + jzW], [pad + jxW, hW * 0.98, 0.02 + jzW]],
        [[far - jxW, 0.0, 0.02 - jzW], [far - jxW, 0.0, 0.98 - jzW], [far - jxW, hW * 1.04, 0.98 - jzW], [far - jxW, hW * 1.04, 0.02 - jzW]]
      ];
      // Shader lush wheat: 2 additional diagonal golden-ear planes for full undulating field density (matching 3 wheat refs!)
      if (isShaderWheat && (id === B.WHEAT_2 || id === B.WHEAT_3)) {
        const hDiag = hW * 1.08;
        quads.push(
          [[0.06 + jxW, 0.0, 0.06 + jzW], [0.94 + jxW, 0.0, 0.94 + jzW], [0.94 + jxW, hDiag, 0.94 + jzW], [0.06 + jxW, hDiag, 0.06 + jzW]],
          [[0.06 - jxW, 0.0, 0.94 + jzW], [0.94 - jxW, 0.0, 0.06 + jzW], [0.94 - jxW, hDiag * 0.97, 0.06 + jzW], [0.06 - jxW, hDiag * 0.97, 0.94 + jzW]]
        );
      }
    } else if (id === B.FIRE || id === B.SOUL_FIRE) {
      quads = [
        [[0.08, 0, 0.08], [0.92, 0, 0.92], [0.92, 1.02, 0.92], [0.08, 1.02, 0.08]],
        [[0.08, 0, 0.92], [0.92, 0, 0.08], [0.92, 1.02, 0.08], [0.08, 1.02, 0.92]],
        [[0.16, 0, 0.22], [0.84, 0, 0.22], [0.84, 0.96, 0.44], [0.16, 0.96, 0.44]],
        [[0.16, 0, 0.78], [0.84, 0, 0.78], [0.84, 0.96, 0.56], [0.16, 0.96, 0.56]]
      ];
      if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) > 0) quads.push([[0.05, 0.06, 0.06], [0.05, 0.06, 0.94], [0.16, 1.04, 0.94], [0.16, 1.04, 0.06]]);
      if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) > 0) quads.push([[0.95, 0.06, 0.94], [0.95, 0.06, 0.06], [0.84, 1.04, 0.06], [0.84, 1.04, 0.94]]);
      if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) > 0) quads.push([[0.94, 0.06, 0.05], [0.06, 0.06, 0.05], [0.06, 1.04, 0.16], [0.94, 1.04, 0.16]]);
      if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) > 0) quads.push([[0.06, 0.06, 0.95], [0.94, 0.06, 0.95], [0.94, 1.04, 0.84], [0.06, 1.04, 0.84]]);
    } else {
      const pr1 = hash2i(wx, wz, 541), pr2 = hash2i(wx + 37, wz - 19, 829);
      const isLushGrass = (id === B.TALL_GRASS || id === B.SHORT_GRASS || id === B.BUSH_GRASS || id === B.WILD_TALL_GRASS || id === B.AUTUMN_GRASS || id === B.SIFT_FLOWER);
      const jScale = isStacked ? 0.14 : (isLushGrass ? 0.14 : 0.16);
      const jx = (pr1 - 0.5) * jScale, jz = (pr2 - 0.5) * jScale;
      const hTop = (isStacked || isHanging || id === B.SUGAR_CANE || id === B.COBWEB) ? 1.0
        : (id === B.WILD_TALL_GRASS ? (1.18 + pr1 * 0.18)
        : (id === B.BUSH_GRASS ? (0.94 + pr1 * 0.12)
        : (id === B.SHORT_GRASS ? (0.68 + pr1 * 0.12)
        : (id === B.TALL_GRASS ? (0.88 + pr1 * 0.14) : 0.90))));
      if (isLushGrass && !isStacked) {
        // Canonical Minecraft 2-plane 45-degree X-cross grass model (matches all 6 grass refs + 33-50% fewer plant triangles!)
        const cxp = 0.5 + jx, czp = 0.5 + jz;
        const r = 0.44;
        quads = [
          [[cxp - r, 0, czp - r], [cxp + r, 0, czp + r], [cxp + r, hTop, czp + r], [cxp - r, hTop, czp - r]],
          [[cxp - r, 0, czp + r], [cxp + r, 0, czp - r], [cxp + r, hTop, czp - r], [cxp - r, hTop, czp + r]]
        ];
      } else {
        const cxp = 0.5 + (isHanging ? 0 : jx), czp = 0.5 + (isHanging ? 0 : jz);
        const r = (id === B.COBWEB || isHanging) ? 0.48 : 0.40;
        const rotF = (id === B.COBWEB || isHanging) ? 0.0 : (pr1 * 1.15 - 0.57);
        const ca = Math.cos(rotF + 0.7854), sa = Math.sin(rotF + 0.7854);
        const cb = Math.cos(rotF - 0.7854), sb = Math.sin(rotF - 0.7854);
        quads = [
          [[cxp - r * ca, 0, czp - r * sa], [cxp + r * ca, 0, czp + r * sa], [cxp + r * ca, hTop, czp + r * sa], [cxp - r * ca, hTop, czp - r * sa]],
          [[cxp - r * cb, 0, czp - r * sb], [cxp + r * cb, 0, czp + r * sb], [cxp + r * cb, hTop, czp + r * sb], [cxp - r * cb, hTop, czp - r * sb]]
        ];
      }
    }
    if (def.emissive && id !== B.GLOW_VINES) {
      const etVal = (id === B.SOUL_FIRE) ? 5.0 : ((id === B.FIRE) ? 4.0 : (id === B.SCULK_VEIN ? 2.0 : 1.0));
      for (let q = 0; q < quads.length; q++) {
        const qr = quads[q];
        ePos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
        eUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
        eType.push(etVal, etVal, etVal, etVal);
        eIndices.push(st.eCount, st.eCount+1, st.eCount+2, st.eCount, st.eCount+2, st.eCount+3); st.eCount += 4;
      }
    } else if (id === B.GLOW_VINES) {
      for (let q = 0; q < quads.length; q++) {
        const qr = quads[q];
        ePos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
        eUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
        eType.push(0.0, 0.0, 0.0, 0.0);
        eIndices.push(st.eCount, st.eCount+1, st.eCount+2, st.eCount, st.eCount+2, st.eCount+3); st.eCount += 4;
      }
    } else {
      if (sliceLen > 0) _evalLightSlice(lx + 0.5, ly + 0.5, lz + 0.5, _sliceEmBuf, sliceLen, _tmpLight);
      else { _tmpLight[0] = _tmpLight[1] = _tmpLight[2] = 0; }
      let skySh = 1.0;
      if (currentDimension === 'overworld') {
        for (let sy = ly + 1; sy <= Math.min(maxLy, ly + 9); sy++) {
          const ab = data[(sy << 8) | (lz << 4) | lx];
          if (ab !== B.AIR && (IS_SOLID[ab] === 1 || (BLOCK_DEF_ARR[ab] && BLOCK_DEF_ARR[ab].foliage && !BLOCK_DEF_ARR[ab].cross))) { skySh = 0.76; break; }
        }
      }
      let swBot = 0.0, swTop = 0.0;
      if (!isFlat && id !== B.COBWEB) {
        if (isHanging) { swTop = Math.min(1.6, stackAbove * 0.35); swBot = Math.min(1.9, (stackAbove + 1) * 0.35); }
        else if (isStacked) { swBot = Math.min(1.6, stackBelow * 0.48); swTop = Math.min(2.0, (stackBelow + 1) * 0.48); }
        else { swBot = 0.0; swTop = 0.85; }
      }
      const lr = _tmpLight[0], lg = _tmpLight[1], lb = _tmpLight[2];
      for (let q = 0; q < quads.length; q++) {
        const qr = quads[q];
        pPos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
        pNorm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
        pUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
        pSway.push(swBot, swBot, swTop, swTop);
        pSkyShade.push(skySh, skySh, skySh, skySh);
        pBLights.push(lr,lg,lb, lr,lg,lb, lr,lg,lb, lr,lg,lb);
        pIndices.push(st.pCount, st.pCount+1, st.pCount+2, st.pCount, st.pCount+2, st.pCount+3); st.pCount += 4;
      }
    }
  }

  function _meshTorchVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, ePos, eUvs, eType, eIndices, st) {
    const isFullWall = (nb) => {
      if (nb === B.AIR || IS_SOLID[nb] !== 1) return false;
      const nd = BLOCK_DEF_ARR[nb];
      return !!(nd && !nd.fence && !nd.wall && !nd.door && !nd.trapdoor && !nd.lantern && !nd.bed && !nd.bedFoot && !nd.bamboo && !nd.cactus && !nd.endCrystal);
    };
    const nbBelow = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
    const floorSolid = IS_SOLID[nbBelow] === 1 && !(BLOCK_DEF_ARR[nbBelow] && BLOCK_DEF_ARR[nbBelow].lantern);
    const wNX = isFullWall(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz));
    const wPX = isFullWall(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz));
    const wNZ = isFullWall(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1));
    const wPZ = isFullWall(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1));
    const pref = torchAttachDir.get(modKey(wx, wy, wz));
    let dir = 'floor';
    if (pref === 'nx' && wNX) dir = 'nx';
    else if (pref === 'px' && wPX) dir = 'px';
    else if (pref === 'nz' && wNZ) dir = 'nz';
    else if (pref === 'pz' && wPZ) dir = 'pz';
    else if (pref === 'floor' && floorSolid) dir = 'floor';
    else if (!floorSolid) {
      if (wNX) dir = 'nx'; else if (wPX) dir = 'px'; else if (wNZ) dir = 'nz'; else if (wPZ) dir = 'pz';
    }
    let ox = 0.5, oy = 0.0, oz = 0.5, tiltX = 0, tiltZ = 0;
    if (dir === 'nx')      { ox = 0.032; oy = 0.22; tiltX =  0.34; }
    else if (dir === 'px') { ox = 0.968; oy = 0.22; tiltX = -0.34; }
    else if (dir === 'nz') { oz = 0.032; oy = 0.22; tiltZ =  0.34; }
    else if (dir === 'pz') { oz = 0.968; oy = 0.22; tiltZ = -0.34; }
    const cosT = (tiltX !== 0 || tiltZ !== 0) ? 0.940 : 1.0;
    const xformT = (lxT, lyT, lzT) => {
      if (tiltX !== 0) return [wx + ox + lyT * tiltX + lxT * cosT, wy + oy + lyT * cosT - lxT * tiltX, wz + oz + lzT];
      if (tiltZ !== 0) return [wx + ox + lxT, wy + oy + lyT * cosT - lzT * tiltZ, wz + oz + lyT * tiltZ + lzT * cosT];
      return [wx + ox + lxT, wy + oy + lyT, wz + oz + lzT];
    };
    const addTorchBox = (y0, y1, hw, tileIdx, eKind) => {
      const tu0 = TILE_U0[tileIdx], tu1 = TILE_U1[tileIdx], tv0 = TILE_V0[tileIdx], tv1 = TILE_V1[tileIdx];
      const p000 = xformT(-hw, y0, -hw), p100 = xformT(hw, y0, -hw), p101 = xformT(hw, y0, hw), p001 = xformT(-hw, y0, hw);
      const p010 = xformT(-hw, y1, -hw), p110 = xformT(hw, y1, -hw), p111 = xformT(hw, y1, hw), p011 = xformT(-hw, y1, hw);
      const pts = [p001, p101, p111, p011, p100, p000, p010, p110, p101, p100, p110, p111, p000, p001, p011, p010, p011, p111, p110, p010, p000, p100, p101, p001];
      for (let q = 0; q < 6; q++) {
        const base = q * 4;
        for (let k = 0; k < 4; k++) { ePos.push(pts[base+k][0], pts[base+k][1], pts[base+k][2]); eType.push(eKind); }
        eUvs.push(tu0, tv1, tu1, tv1, tu1, tv0, tu0, tv0);
        eIndices.push(st.eCount, st.eCount+1, st.eCount+2, st.eCount, st.eCount+2, st.eCount+3); st.eCount += 4;
      }
    };
    addTorchBox(0.0, 0.49, 0.055, 5, 2.0);
    addTorchBox(0.49, 0.625, 0.062, 32, 0.0);
  }

  function _meshLanternVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, ePos, eUvs, eType, eIndices, st, id = B.LANTERN) {
    const ceilSolid = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz)] === 1;
    const isSoul = (id === B.SOUL_LANTERN);
    const yBase = ceilSolid ? 0.14 : 0.0;
    const hangOff = ceilSolid ? 10.0 : 0.0;
    const addLBox = (y0, y1, hw, tileIdx, eKind) => {
      const tu0 = TILE_U0[tileIdx], tu1 = TILE_U1[tileIdx], tv0 = TILE_V0[tileIdx], tv1 = TILE_V1[tileIdx];
      const cxL = wx + 0.5, czL = wz + 0.5, by0 = wy + y0, by1 = wy + y1;
      const pts = [
        [cxL-hw,by0,czL+hw],[cxL+hw,by0,czL+hw],[cxL+hw,by1,czL+hw],[cxL-hw,by1,czL+hw],
        [cxL+hw,by0,czL-hw],[cxL-hw,by0,czL-hw],[cxL-hw,by1,czL-hw],[cxL+hw,by1,czL-hw],
        [cxL+hw,by0,czL+hw],[cxL+hw,by0,czL-hw],[cxL+hw,by1,czL-hw],[cxL+hw,by1,czL+hw],
        [cxL-hw,by0,czL-hw],[cxL-hw,by0,czL+hw],[cxL-hw,by1,czL+hw],[cxL-hw,by1,czL-hw],
        [cxL-hw,by1,czL+hw],[cxL+hw,by1,czL+hw],[cxL+hw,by1,czL-hw],[cxL-hw,by1,czL-hw],
        [cxL-hw,by0,czL-hw],[cxL+hw,by0,czL-hw],[cxL+hw,by0,czL+hw],[cxL-hw,by0,czL+hw]
      ];
      for (let q = 0; q < 6; q++) {
        const base = q * 4;
        for (let k = 0; k < 4; k++) { ePos.push(pts[base+k][0], pts[base+k][1], pts[base+k][2]); eType.push(eKind); }
        eUvs.push(tu0, tv1, tu1, tv1, tu1, tv0, tu0, tv0);
        eIndices.push(st.eCount, st.eCount+1, st.eCount+2, st.eCount, st.eCount+2, st.eCount+3); st.eCount += 4;
      }
    };
    addLBox(yBase, yBase + 0.06, 0.21, 22, 2.0 + hangOff);
    addLBox(yBase + 0.06, yBase + 0.44, 0.18, isSoul ? 470 : 32, (isSoul ? 1.0 : 0.0) + hangOff);
    addLBox(yBase + 0.44, yBase + 0.51, 0.21, 22, 2.0 + hangOff);
    addLBox(yBase + 0.51, yBase + 0.58, 0.12, 22, 2.0 + hangOff);
    if (ceilSolid) addLBox(yBase + 0.58, 1.00, 0.045, 22, 2.0);
  }

  function _meshHangingFruitVoxel(lx, ly, lz, wx, wy, wz, def, sliceLen, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st) {
    const tile = def.tiles[0], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
    if (sliceLen > 0) _evalLightSlice(lx + 0.5, ly + 0.5, lz + 0.5, _sliceEmBuf, sliceLen, _tmpLight);
    else { _tmpLight[0] = _tmpLight[1] = _tmpLight[2] = 0; }
    const lr = _tmpLight[0], lg = _tmpLight[1], lb = _tmpLight[2];
    const fx0 = 0.22, fx1 = 0.78, fy0 = 0.42, fy1 = 1.00;
    const fQuads = [[[fx0, fy0, 0.5], [fx1, fy0, 0.5], [fx1, fy1, 0.5], [fx0, fy1, 0.5]], [[0.5, fy0, fx0], [0.5, fy0, fx1], [0.5, fy1, fx1], [0.5, fy1, fx0]]];
    for (let q = 0; q < 2; q++) {
      const qr = fQuads[q];
      pPos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
      pNorm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
      pUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
      pSway.push(0.25, 0.25, 0.0, 0.0);
      pSkyShade.push(0.95, 0.95, 0.95, 0.95);
      pBLights.push(lr,lg,lb, lr,lg,lb, lr,lg,lb, lr,lg,lb);
      pIndices.push(st.pCount, st.pCount+1, st.pCount+2, st.pCount, st.pCount+2, st.pCount+3); st.pCount += 4;
    }
  }

  function _meshSubBlockVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, sliceLen, ePos, eUvs, eType, eIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st) {
    if (sliceLen > 0) _evalLightSlice(lx + 0.5, ly + 0.5, lz + 0.5, _sliceEmBuf, sliceLen, _tmpLight);
    else { _tmpLight[0] = _tmpLight[1] = _tmpLight[2] = 0; }
    const lr = _tmpLight[0], lg = _tmpLight[1], lb = _tmpLight[2];
    const emitBox = (x0, y0, z0, x1, y1, z1, tTop, tSide, tBot, fitUv = false) => _pushSolidBox(wx, wy, wz, x0, y0, z0, x1, y1, z1, tTop, tSide, tBot, lr, lg, lb, fitUv, st);
    const tTop = def.tiles[0], tSide = def.tiles[1], tBot = def.tiles[2];
    if (id === B.END_PORTAL_FRAME || id === B.END_PORTAL_FRAME_EYE) {
      // Exact Minecraft End Portal Frame: 16x13x16 square base (0.8125 tall) + 8x4x8 SQUARE 3D Eye of Ender jewel (0.5x0.25x0.5) on top
      emitBox(0.0, 0.0, 0.0, 1.0, 0.8125, 1.0, 278, 279, 80, true);
      if (id === B.END_PORTAL_FRAME_EYE) emitBox(0.25, 0.8125, 0.25, 0.75, 1.0625, 0.75, 280, 280, 280, true);
    } else if (def.isBarrel) {
      // Exact 6-way directional Minecraft Barrel (open lid shows hollow interior when opened!)
      const isOpen = (typeof openBarrels !== 'undefined' && openBarrels.has(modKey(wx, wy, wz)));
      const tLid = isOpen ? V184_TILES.barrelTopOpen : V184_TILES.barrelTop;
      const tBotB = V184_TILES.barrelBottom, tSV = V184_TILES.barrelSide, tSH = V184_TILES.barrelSideH;
      const bDir = def.barrelDir || 'up';
      const faceTiles = (bDir === 'up') ? [tLid, tBotB, tSV, tSV, tSV, tSV]
        : (bDir === 'down') ? [tBotB, tLid, tSV, tSV, tSV, tSV]
        : (bDir === 'e') ? [tSH, tSH, tLid, tBotB, tSH, tSH]
        : (bDir === 'w') ? [tSH, tSH, tBotB, tLid, tSH, tSH]
        : (bDir === 's') ? [tSV, tSV, tSH, tSH, tLid, tBotB]
        : [tSV, tSV, tSH, tSH, tBotB, tLid];
      for (let f = 0; f < 6; f++) {
        const fc = FACES[f];
        const nb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + fc.dir[0], ly + fc.dir[1], lz + fc.dir[2]);
        if (IS_OPAQUE[nb] === 1) continue;
        _pushSingleSolidFace(wx, wy, wz, 0, 0, 0, 1, 1, 1, f, faceTiles[f], lr, lg, lb, true, st);
      }
    } else if (id === B.GLASS) {
      // Seamless Connected Glass Block (hides internal faces & internal frame borders between adjacent Glass/Glass Pane)
      const isGlassConn = (b) => (b === B.GLASS || b === B.GLASS_PANE);
      for (let f = 0; f < 6; f++) {
        const fc = FACES[f];
        const nb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + fc.dir[0], ly + fc.dir[1], lz + fc.dir[2]);
        if (IS_OPAQUE[nb] === 1 || nb === B.GLASS) continue;
        const ux = fc.uAxis[0], uy = fc.uAxis[1], uz = fc.uAxis[2];
        const vx = fc.vAxis[0], vy = fc.vAxis[1], vz = fc.vAxis[2];
        const nT = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + vx, ly + vy, lz + vz);
        const nR = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + ux, ly + uy, lz + uz);
        const nB = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - vx, ly - vy, lz - vz);
        const nL = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - ux, ly - uy, lz - uz);
        const mask = (isGlassConn(nT) ? 0 : 1) | (isGlassConn(nR) ? 0 : 2) | (isGlassConn(nB) ? 0 : 4) | (isGlassConn(nL) ? 0 : 8);
        _pushSingleSolidFace(wx, wy, wz, 0, 0, 0, 1, 1, 1, f, V184_TILES.glassCtmBase + mask, lr, lg, lb, true, st);
      }
    } else if (def.glassPane) {
      // Seamless Thin Glass Pane (2px thick, auto-connects horizontally & vertically with zero internal seams!)
      const isGlassConn = (b) => (b === B.GLASS_PANE || b === B.GLASS);
      const canPaneConn = (b) => { const d = BLOCK_DEF_ARR[b]; return !!(b === B.GLASS_PANE || b === B.GLASS || IS_OPAQUE[b] === 1 || (d && (d.wall || d.fence || d.isBarrel))); };
      const nbPX = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz);
      const nbNX = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz);
      const nbPZ = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1);
      const nbNZ = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1);
      const nbUp = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz);
      const nbDn = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
      const cPX = canPaneConn(nbPX), cNX = canPaneConn(nbNX), cPZ = canPaneConn(nbPZ), cNZ = canPaneConn(nbNZ);
      const gPX = isGlassConn(nbPX), gNX = isGlassConn(nbNX), gPZ = isGlassConn(nbPZ), gNZ = isGlassConn(nbNZ);
      const gUp = isGlassConn(nbUp), gDn = isGlassConn(nbDn);
      const tEdge = V184_TILES.glassPaneEdge;
      const p0 = 0.4375, p1 = 0.5625;
      const emitPaneSeg = (x0, z0, x1, z1, alongX, hideNeg, hidePos) => {
        // Face +Y / -Y thin top & bottom edges (hidden when stacked vertically with another glass pane/block)
        if (!gUp && IS_OPAQUE[nbUp] !== 1) _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 0, tEdge, lr, lg, lb, false, st);
        if (!gDn && IS_OPAQUE[nbDn] !== 1) _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 1, tEdge, lr, lg, lb, false, st);
        if (alongX) {
          // +Z face (uAxis=+X: Left=-X, Right=+X) and -Z face (uAxis=-X: Left=+X, Right=-X)
          const mPZ = (gUp ? 0 : 1) | (hidePos ? 0 : 2) | (gDn ? 0 : 4) | (hideNeg ? 0 : 8);
          const mNZ = (gUp ? 0 : 1) | (hideNeg ? 0 : 2) | (gDn ? 0 : 4) | (hidePos ? 0 : 8);
          _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 4, V184_TILES.glassCtmBase + mPZ, lr, lg, lb, true, st);
          _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 5, V184_TILES.glassCtmBase + mNZ, lr, lg, lb, true, st);
          if (!hidePos && !(x1 === 1 && IS_OPAQUE[nbPX] === 1)) _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 2, tEdge, lr, lg, lb, false, st);
          if (!hideNeg && !(x0 === 0 && IS_OPAQUE[nbNX] === 1)) _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 3, tEdge, lr, lg, lb, false, st);
        } else {
          // +X face (uAxis=-Z: Left=+Z, Right=-Z) and -X face (uAxis=+Z: Left=-Z, Right=+Z)
          const mPX = (gUp ? 0 : 1) | (hideNeg ? 0 : 2) | (gDn ? 0 : 4) | (hidePos ? 0 : 8);
          const mNX = (gUp ? 0 : 1) | (hidePos ? 0 : 2) | (gDn ? 0 : 4) | (hideNeg ? 0 : 8);
          _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 2, V184_TILES.glassCtmBase + mPX, lr, lg, lb, true, st);
          _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 3, V184_TILES.glassCtmBase + mNX, lr, lg, lb, true, st);
          if (!hidePos && !(z1 === 1 && IS_OPAQUE[nbPZ] === 1)) _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 4, tEdge, lr, lg, lb, false, st);
          if (!hideNeg && !(z0 === 0 && IS_OPAQUE[nbNZ] === 1)) _pushSingleSolidFace(wx, wy, wz, x0, 0, z0, x1, 1, z1, 5, tEdge, lr, lg, lb, false, st);
        }
      };
      if (!cPX && !cNX && !cPZ && !cNZ) {
        // Standalone thin glass post
        if (!gUp && IS_OPAQUE[nbUp] !== 1) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 0, tEdge, lr, lg, lb, false, st);
        if (!gDn && IS_OPAQUE[nbDn] !== 1) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 1, tEdge, lr, lg, lb, false, st);
        for (let f = 2; f < 6; f++) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, f, tEdge, lr, lg, lb, false, st);
      } else if ((cPX || cNX) && !cPZ && !cNZ) {
        emitPaneSeg(cNX ? 0.0 : p0, p0, cPX ? 1.0 : p1, p1, true, gNX, gPX);
      } else if ((cPZ || cNZ) && !cPX && !cNX) {
        emitPaneSeg(p0, cNZ ? 0.0 : p0, p1, cPZ ? 1.0 : p1, false, gNZ, gPZ);
      } else {
        // Corner / T / + junction: center pillar + connecting glass wings
        if (!gUp && IS_OPAQUE[nbUp] !== 1) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 0, tEdge, lr, lg, lb, false, st);
        if (!gDn && IS_OPAQUE[nbDn] !== 1) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 1, tEdge, lr, lg, lb, false, st);
        if (!cPX) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 2, tEdge, lr, lg, lb, false, st);
        if (!cNX) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 3, tEdge, lr, lg, lb, false, st);
        if (!cPZ) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 4, tEdge, lr, lg, lb, false, st);
        if (!cNZ) _pushSingleSolidFace(wx, wy, wz, p0, 0, p0, p1, 1, p1, 5, tEdge, lr, lg, lb, false, st);
        if (cPX) emitPaneSeg(p1, p0, 1.0, p1, true, true, gPX);
        if (cNX) emitPaneSeg(0.0, p0, p0, p1, true, gNX, true);
        if (cPZ) emitPaneSeg(p0, p1, p1, 1.0, false, true, gPZ);
        if (cNZ) emitPaneSeg(p0, 0.0, p1, p0, false, gNZ, true);
      }
    } else if (def.endCrystal) {
      emitBox(0.12, 0.0, 0.12, 0.88, 0.22, 0.88, 84, 84, 84);
      const cu0 = TILE_U0[202], cu1 = TILE_U1[202], cv0 = TILE_V0[202], cv1 = TILE_V1[202];
      const cbx = [0.22, 0.78], cby = [0.34, 0.98], cbz = [0.22, 0.78];
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        for (let c = 0; c < 4; c++) { const cr = face.corners[c]; ePos.push(wx + cbx[cr[0]], wy + cby[cr[1]], wz + cbz[cr[2]]); eType.push(3.0); }
        eUvs.push(cu0, cv1, cu1, cv1, cu1, cv0, cu0, cv0);
        eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
      }
    } else if (def.bed) {
      const partner = def.bedPartner || (def.bedFoot ? B.BED : B.BED_FOOT);
      const bt = def.bedBlanketTile || 194, bs = def.bedSideTile || 195;
      let pdx = 0, pdz = 1;
      if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) === partner) { pdx = 1; pdz = 0; }
      else if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) === partner) { pdx = -1; pdz = 0; }
      else if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) === partner) { pdx = 0; pdz = -1; }
      else if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) === partner) { pdx = 0; pdz = 1; }
      emitBox(0.0, 0.1875, 0.0, 1.0, 0.28, 1.0, 8, 8, 8);
      if (def.bedFoot) {
        emitBox(0.0, 0.28, 0.0, 1.0, 0.5625, 1.0, bt, bs, 8, true);
      } else {
        if (pdx === 1) { emitBox(0.0, 0.28, 0.0, 0.46, 0.60, 1.0, 193, 196, 8, true); emitBox(0.46, 0.28, 0.0, 1.0, 0.5625, 1.0, bt, bs, 8, true); }
        else if (pdx === -1) { emitBox(0.54, 0.28, 0.0, 1.0, 0.60, 1.0, 193, 196, 8, true); emitBox(0.0, 0.28, 0.0, 0.54, 0.5625, 1.0, bt, bs, 8, true); }
        else if (pdz === 1) { emitBox(0.0, 0.28, 0.0, 1.0, 0.60, 0.46, 193, 196, 8, true); emitBox(0.0, 0.28, 0.46, 1.0, 0.5625, 1.0, bt, bs, 8, true); }
        else { emitBox(0.0, 0.28, 0.54, 1.0, 0.60, 1.0, 193, 196, 8, true); emitBox(0.0, 0.28, 0.0, 1.0, 0.5625, 0.54, bt, bs, 8, true); }
      }
      const lw = 0.1875;
      if (pdx === 1) { emitBox(0.0, 0.0, 0.0, lw, 0.1875, lw, 8, 8, 8); emitBox(0.0, 0.0, 1 - lw, lw, 0.1875, 1.0, 8, 8, 8); }
      else if (pdx === -1) { emitBox(1 - lw, 0.0, 0.0, 1.0, 0.1875, lw, 8, 8, 8); emitBox(1 - lw, 0.0, 1 - lw, 1.0, 0.1875, 1.0, 8, 8, 8); }
      else if (pdz === 1) { emitBox(0.0, 0.0, 0.0, lw, 0.1875, lw, 8, 8, 8); emitBox(1 - lw, 0.0, 0.0, 1.0, 0.1875, lw, 8, 8, 8); }
      else { emitBox(0.0, 0.0, 1 - lw, lw, 0.1875, 1.0, 8, 8, 8); emitBox(1 - lw, 0.0, 1 - lw, 1.0, 0.1875, 1.0, 8, 8, 8); }
    } else if (def.cactus) {
      emitBox(0.0625, 0.0, 0.0625, 0.9375, 1.0, 0.9375, tTop, tSide, tBot);
      const su0 = TILE_U0[V142_TILES.cactusSpine], su1 = TILE_U1[V142_TILES.cactusSpine];
      const sv0 = TILE_V0[V142_TILES.cactusSpine], sv1 = TILE_V1[V142_TILES.cactusSpine];
      // Rigid 3D diagonal thorn fins protruding outward from the 4 fluted corners
      const sQuads = [
        [[0.065, 0, 0.065], [-0.025, 0, -0.025], [-0.025, 1, -0.025], [0.065, 1, 0.065]],
        [[0.935, 0, 0.065], [1.025, 0, -0.025], [1.025, 1, -0.025], [0.935, 1, 0.065]],
        [[0.935, 0, 0.935], [1.025, 0, 1.025], [1.025, 1, 1.025], [0.935, 1, 0.935]],
        [[0.065, 0, 0.935], [-0.025, 0, 1.025], [-0.025, 1, 1.025], [0.065, 1, 0.935]]
      ];
      for (let q = 0; q < 4; q++) {
        const qr = sQuads[q];
        pPos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
        pNorm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
        pUvs.push(su0, sv1, su1, sv1, su1, sv0, su0, sv0);
        pSway.push(0.0, 0.0, 0.0, 0.0);
        pSkyShade.push(0.95, 0.95, 0.95, 0.95);
        pBLights.push(lr,lg,lb, lr,lg,lb, lr,lg,lb, lr,lg,lb);
        pIndices.push(st.pCount, st.pCount+1, st.pCount+2, st.pCount, st.pCount+2, st.pCount+3); st.pCount += 4;
      }
    } else if (def.bamboo) {
      const jx = (hash2i(wx, wz, 719) - 0.5) * 0.24, jz = (hash2i(wx + 19, wz - 11, 727) - 0.5) * 0.24;
      const cx0 = Math.max(0.12, Math.min(0.64, 0.375 + jx)), cz0 = Math.max(0.12, Math.min(0.64, 0.375 + jz));
      emitBox(cx0, 0.0, cz0, cx0 + 0.25, 1.0, cz0 + 0.25, tTop, tSide, tBot);
      const ab1 = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz), ab2 = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 2, lz);
      if (ab1 !== B.BAMBOO || ab2 !== B.BAMBOO) {
        const lu0 = TILE_U0[188], lu1 = TILE_U1[188], lv0 = TILE_V0[188], lv1 = TILE_V1[188];
        const bxC = cx0 + 0.125, bzC = cz0 + 0.125, lrB = ab1 !== B.BAMBOO ? 0.44 : 0.34;
        const lQuads = [
          [[bxC - lrB, 0.12, bzC - lrB], [bxC + lrB, 0.12, bzC + lrB], [bxC + lrB, 0.98, bzC + lrB], [bxC - lrB, 0.98, bzC - lrB]],
          [[bxC - lrB, 0.12, bzC + lrB], [bxC + lrB, 0.12, bzC - lrB], [bxC + lrB, 0.98, bzC - lrB], [bxC - lrB, 0.98, bzC + lrB]]
        ];
        for (let q = 0; q < 2; q++) {
          const qr = lQuads[q];
          pPos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
          pNorm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
          pUvs.push(lu0, lv1, lu1, lv1, lu1, lv0, lu0, lv0);
          pSway.push(0.25, 0.25, 0.85, 0.85);
          pSkyShade.push(0.95, 0.95, 0.95, 0.95);
          pBLights.push(lr,lg,lb, lr,lg,lb, lr,lg,lb, lr,lg,lb);
          pIndices.push(st.pCount, st.pCount+1, st.pCount+2, st.pCount, st.pCount+2, st.pCount+3); st.pCount += 4;
        }
      }
    } else if (def.campfire) {
      emitBox(0.06, 0.00, 0.14, 0.94, 0.22, 0.36, 4, 5, 4);
      emitBox(0.06, 0.00, 0.64, 0.94, 0.22, 0.86, 4, 5, 4);
      emitBox(0.14, 0.16, 0.06, 0.36, 0.42, 0.94, 4, 5, 4);
      emitBox(0.64, 0.16, 0.06, 0.86, 0.42, 0.94, 4, 5, 4);
      emitBox(0.20, 0.01, 0.20, 0.80, 0.20, 0.80, 118, 24, 24, true);
      const fu0 = TILE_U0[324], fu1 = TILE_U1[324], fv0 = TILE_V0[324], fv1 = TILE_V1[324];
      const fQuads = [[[0.16, 0.22, 0.16], [0.84, 0.22, 0.84], [0.84, 1.18, 0.84], [0.16, 1.18, 0.16]], [[0.16, 0.22, 0.84], [0.84, 0.22, 0.16], [0.84, 1.18, 0.16], [0.16, 1.18, 0.84]]];
      for (let fq = 0; fq < 2; fq++) {
        const qr = fQuads[fq];
        ePos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
        eUvs.push(fu0, fv1, fu1, fv1, fu1, fv0, fu0, fv0);
        eType.push(4.0, 4.0, 4.0, 4.0);
        eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
      }
    } else if (def.stairs) {
      const sd = def.stairDir || 0;
      emitBox(0.0, 0.0, 0.0, 1.0, 0.5, 1.0, tTop, tSide, tBot);
      if (sd === 0) emitBox(0.0, 0.5, 0.0, 1.0, 1.0, 0.5, tTop, tSide, tBot);
      else if (sd === 1) emitBox(0.0, 0.5, 0.5, 1.0, 1.0, 1.0, tTop, tSide, tBot);
      else if (sd === 2) emitBox(0.5, 0.5, 0.0, 1.0, 1.0, 1.0, tTop, tSide, tBot);
      else emitBox(0.0, 0.5, 0.0, 0.5, 1.0, 1.0, tTop, tSide, tBot);
    } else if (def.slab) {
      emitBox(0.0, def.slabTop ? 0.5 : 0.0, 0.0, 1.0, def.slabTop ? 1.0 : 0.5, 1.0, tTop, tSide, tBot);
    } else if (def.fence) {
      emitBox(0.375, 0.0, 0.375, 0.625, 1.0, 0.625, tTop, tSide, tBot);
      const canConn = (nb) => { const d = BLOCK_DEF_ARR[nb]; return !!(d && !d.stalactite && (d.fence || d.wall || IS_OPAQUE[nb] === 1)); };
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz))) { emitBox(0.625, 0.75, 0.4375, 1.0, 0.9375, 0.5625, tTop, tSide, tBot); emitBox(0.625, 0.375, 0.4375, 1.0, 0.5625, 0.5625, tTop, tSide, tBot); }
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz))) { emitBox(0.0, 0.75, 0.4375, 0.375, 0.9375, 0.5625, tTop, tSide, tBot); emitBox(0.0, 0.375, 0.4375, 0.375, 0.5625, 0.5625, tTop, tSide, tBot); }
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1))) { emitBox(0.4375, 0.75, 0.625, 0.5625, 0.9375, 1.0, tTop, tSide, tBot); emitBox(0.4375, 0.375, 0.625, 0.5625, 0.5625, 1.0, tTop, tSide, tBot); }
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1))) { emitBox(0.4375, 0.75, 0.0, 0.5625, 0.9375, 0.375, tTop, tSide, tBot); emitBox(0.4375, 0.375, 0.0, 0.5625, 0.5625, 0.375, tTop, tSide, tBot); }
    } else if (def.stalactite) {
      // BUILD v166: Stalactites stay standalone vertical pillars (never merge horizontally like fences/walls)
      emitBox(0.25, 0.0, 0.25, 0.75, 1.0, 0.75, tTop, tSide, tBot);
    } else if (def.wall) {
      const canW = (nb) => { const d = BLOCK_DEF_ARR[nb]; return !!(d && !d.stalactite && (d.wall || d.fence || IS_OPAQUE[nb] === 1)); };
      const cPX = canW(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz)), cNX = canW(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz));
      const cPZ = canW(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1)), cNZ = canW(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1));
      const above = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz);
      const straightX = (cPX && cNX && !cPZ && !cNZ), straightZ = (cPZ && cNZ && !cPX && !cNX);
      const needPost = (!straightX && !straightZ) || above !== B.AIR;
      const wh = (above !== B.AIR && (BLOCK_DEF_ARR[above]?.wall || IS_OPAQUE[above] === 1)) ? 1.0 : 0.8125;
      if (needPost) emitBox(0.25, 0.0, 0.25, 0.75, 1.0, 0.75, tTop, tSide, tBot);
      else if (straightX) emitBox(0.0, 0.0, 0.3125, 1.0, wh, 0.6875, tTop, tSide, tBot);
      else emitBox(0.3125, 0.0, 0.0, 0.6875, wh, 1.0, tTop, tSide, tBot);
      if (needPost) {
        if (cPX) emitBox(0.75, 0.0, 0.3125, 1.0, wh, 0.6875, tTop, tSide, tBot);
        if (cNX) emitBox(0.0, 0.0, 0.3125, 0.25, wh, 0.6875, tTop, tSide, tBot);
        if (cPZ) emitBox(0.3125, 0.0, 0.75, 0.6875, wh, 1.0, tTop, tSide, tBot);
        if (cNZ) emitBox(0.3125, 0.0, 0.0, 0.6875, wh, 0.25, tTop, tSide, tBot);
      }
    } else if (id === B.SCULK_SENSOR) {
      emitBox(0.0, 0.0, 0.0, 1.0, 0.5, 1.0, 462, 462, 458, true);
      const tu0 = TILE_U0[463], tu1 = TILE_U1[463], tv0 = TILE_V0[463], tv1 = TILE_V1[463];
      for (const [cxS, czS] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) {
        const sQs = [
          [[cxS - 0.16, 0.48, czS], [cxS + 0.16, 0.48, czS], [cxS + 0.16, 0.94, czS], [cxS - 0.16, 0.94, czS]],
          [[cxS, 0.48, czS - 0.16], [cxS, 0.48, czS + 0.16], [cxS, 0.94, czS + 0.16], [cxS, 0.94, czS - 0.16]]
        ];
        for (let q = 0; q < 2; q++) {
          const qr = sQs[q];
          ePos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
          eUvs.push(tu0, tv1, tu1, tv1, tu1, tv0, tu0, tv0);
          eType.push(1.0, 1.0, 1.0, 1.0);
          eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
        }
      }
    } else if (id === B.SCULK_SHRIEKER) {
      emitBox(0.0, 0.0, 0.0, 1.0, 0.5, 1.0, 464, 465, 458, true);
      emitBox(0.06, 0.5, 0.06, 0.28, 0.88, 0.28, 465, 465, 465, true);
      emitBox(0.72, 0.5, 0.06, 0.94, 0.88, 0.28, 465, 465, 465, true);
      emitBox(0.06, 0.5, 0.72, 0.28, 0.88, 0.94, 465, 465, 465, true);
      emitBox(0.72, 0.5, 0.72, 0.94, 0.88, 0.94, 465, 465, 465, true);
      const cu0 = TILE_U0[464], cu1 = TILE_U1[464], cv0 = TILE_V0[464], cv1 = TILE_V1[464];
      ePos.push(wx+0.26,wy+0.54,wz+0.74, wx+0.74,wy+0.54,wz+0.74, wx+0.74,wy+0.54,wz+0.26, wx+0.26,wy+0.54,wz+0.26);
      eUvs.push(cu0, cv1, cu1, cv1, cu1, cv0, cu0, cv0);
      eType.push(1.0, 1.0, 1.0, 1.0);
      eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
    } else if (id === B.CANDLE) {
      const fu0 = TILE_U0[324], fu1 = TILE_U1[324], fv0 = TILE_V0[324], fv1 = TILE_V1[324];
      const specs = ((wx ^ wz) & 1) ? [[0.28, 0.44, 0.48], [0.56, 0.62, 0.36], [0.52, 0.32, 0.28]] : [[0.36, 0.44, 0.50], [0.64, 0.58, 0.38]];
      for (const [cxC, czC, ch] of specs) {
        emitBox(cxC - 0.06, 0.0, czC - 0.06, cxC + 0.06, ch, czC + 0.06, 471, 471, 471, true);
        const fQs = [
          [[cxC - 0.08, ch, czC], [cxC + 0.08, ch, czC], [cxC + 0.08, ch + 0.22, czC], [cxC - 0.08, ch + 0.22, czC]],
          [[cxC, ch, czC - 0.08], [cxC, ch, czC + 0.08], [cxC, ch + 0.22, czC + 0.08], [cxC, ch + 0.22, czC - 0.08]]
        ];
        for (let q = 0; q < 2; q++) {
          const qr = fQs[q];
          ePos.push(wx+qr[0][0],wy+qr[0][1],wz+qr[0][2], wx+qr[1][0],wy+qr[1][1],wz+qr[1][2], wx+qr[2][0],wy+qr[2][1],wz+qr[2][2], wx+qr[3][0],wy+qr[3][1],wz+qr[3][2]);
          eUvs.push(fu0, fv1, fu1, fv1, fu1, fv0, fu0, fv0);
          eType.push(0.0, 0.0, 0.0, 0.0);
          eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
        }
      }
    } else if (def.rootCage) {
      emitBox(0.36, 0.0, 0.36, 0.64, 1.0, 0.64, 94, 94, 94);
      emitBox(0.06, 0.0, 0.06, 0.24, 1.0, 0.24, 94, 94, 94);
      emitBox(0.76, 0.0, 0.06, 0.94, 1.0, 0.24, 94, 94, 94);
      emitBox(0.06, 0.0, 0.76, 0.24, 1.0, 0.94, 94, 94, 94);
      emitBox(0.76, 0.0, 0.76, 0.94, 1.0, 0.94, 94, 94, 94);
      emitBox(0.18, 0.68, 0.18, 0.82, 0.84, 0.36, 94, 94, 94);
      emitBox(0.18, 0.24, 0.64, 0.82, 0.40, 0.82, 94, 94, 94);
    } else if (id === B.END_ROD) {
      const aboveSolid = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz)] === 1;
      const belowSolid = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz)] === 1;
      if (aboveSolid && !belowSolid) {
        emitBox(0.32, 0.86, 0.32, 0.68, 1.0, 0.68, 515, 515, 515);
        emitBox(0.41, 0.06, 0.41, 0.59, 0.86, 0.59, 514, 514, 514, true);
      } else {
        emitBox(0.32, 0.0, 0.32, 0.68, 0.14, 0.68, 515, 515, 515);
        emitBox(0.41, 0.14, 0.41, 0.59, 0.98, 0.59, 514, 514, 514, true);
      }
    }
  }

  const _LEAF_CUBE_MASK = BLK_FOLIAGE | BLK_SOLID | BLK_GLASS | BLK_SUB;
  const _LEAF_CUBE_VAL = BLK_FOLIAGE | BLK_SOLID;

  function _meshFoliageVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, computeAO, sliceLen, st) {
    const tile = def.tiles[0], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
    const isSakura = !!def.sakuraLeaf, isBlue = !!def.blueLeaf, isNeutral = !!def.neutralLeaf, isGlass = !!def.glass;
    const isLeafCullNb = (nb) => isGlass ? (nb === id) : ((BLOCK_FLAGS[nb] & _LEAF_CUBE_MASK) === _LEAF_CUBE_VAL);
    if (lx > 0 && lx < 15 && lz > 0 && lz < 15 && ly > 0 && ly < WORLD_H - 1) {
      const cIdx = (ly << 8) | (lz << 4) | lx;
      const n0 = data[cIdx + 1], n1 = data[cIdx - 1], n2 = data[cIdx + 256], n3 = data[cIdx - 256], n4 = data[cIdx + 16], n5 = data[cIdx - 16];
      if ((IS_OPAQUE[n0] === 1 || isLeafCullNb(n0)) && (IS_OPAQUE[n1] === 1 || isLeafCullNb(n1)) &&
          (IS_OPAQUE[n2] === 1 || isLeafCullNb(n2)) && (IS_OPAQUE[n3] === 1 || isLeafCullNb(n3)) &&
          (IS_OPAQUE[n4] === 1 || isLeafCullNb(n4)) && (IS_OPAQUE[n5] === 1 || isLeafCullNb(n5))) return;
    }
    const tint = isGlass ? 1.0 : ((isSakura || isBlue || isNeutral)
      ? (0.96 + ((wx * 13 + wy * 7 + wz * 17) & 7) * 0.008)
      : (0.93 + ((wx * 11 + wy * 13 + wz * 17) & 7) * 0.014));
    const baseR = isSakura ? 1.08 : (isBlue ? 0.95 : (isNeutral || isGlass ? 1.0 : 0.94));
    const baseG = isSakura ? 0.99 : (isBlue || isNeutral || isGlass ? 1.0 : 1.04);
    const baseB = isSakura ? 1.06 : (isBlue ? 1.08 : (isNeutral || isGlass ? 1.0 : 0.94));
    let anyExposed = false, tuftLr = 0, tuftLg = 0, tuftLb = 0;
    for (let f = 0; f < 6; f++) {
      const face = FACES[f], dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
      const nlx = lx + dx, nly = ly + dy, nlz = lz + dz;
      const nb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx, nly, nlz);
      if (IS_OPAQUE[nb] === 1 || isLeafCullNb(nb)) continue;
      if (IS_SOLID[nb] === 0) anyExposed = true;
      if (st.lCount + 4 > _lCap) _growLeafScratch(st.lCount + 4);
      const isInner = false;
      const shadeMul = isGlass ? 1.0 : ((isSakura || isBlue || isNeutral)
        ? ((f === 0 ? 1.04 : (f === 1 ? 0.90 : 0.97)) * (isInner ? 0.96 : 1.0))
        : ((f === 0 ? 1.04 : (f === 1 ? 0.88 : 0.96)) * (isInner ? 0.95 : 1.0)));
      let lr = 0, lg = 0, lb = 0;
      if (sliceLen > 0) { _evalLightSlice(nlx + 0.5, nly + 0.5, nlz + 0.5, _sliceEmBuf, sliceLen, _tmpLight); lr = _tmpLight[0]; lg = _tmpLight[1]; lb = _tmpLight[2]; }
      if (IS_SOLID[nb] === 0 && (lr + lg + lb) > (tuftLr + tuftLg + tuftLb)) { tuftLr = lr; tuftLg = lg; tuftLb = lb; }
      let vp = st.lCount * 3, up = st.lCount * 2;
      const uxA = face.uAxis[0], uyA = face.uAxis[1], uzA = face.uAxis[2];
      const vxA = face.vAxis[0], vyA = face.vAxis[1], vzA = face.vAxis[2];
      const calcAO = (computeAO && !isInner && !isGlass);
      for (let c = 0; c < 4; c++) {
        const cr = face.corners[c];
        _lPos[vp] = wx + cr[0]; _lPos[vp+1] = wy + cr[1]; _lPos[vp+2] = wz + cr[2];
        _lNorm[vp] = dx; _lNorm[vp+1] = dy; _lNorm[vp+2] = dz;
        let ao = 1.0;
        if (calcAO) {
          const su = (c === 1 || c === 2) ? 1 : -1, sv = (c === 2 || c === 3) ? 1 : -1;
          const ux = uxA * su, uy = uyA * su, uz = uzA * su;
          const vx = vxA * sv, vy = vyA * sv, vz = vzA * sv;
          const s1 = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + ux, nly + uy, nlz + uz)];
          const s2 = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + vx, nly + vy, nlz + vz)];
          const cn = IS_SOLID[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + ux + vx, nly + uy + vy, nlz + uz + vz)];
          ao = (s1 && s2) ? 0.86 : Math.max(0.86, 0.86 + (AO_LUT[s1 + s2 + cn] - 0.5) * 0.28);
        }
        const crTint = Math.min(1.10, tint * shadeMul * ao);
        _lCols[vp] = Math.min(1.14, crTint * baseR);
        _lCols[vp+1] = Math.min(1.12, crTint * baseG);
        _lCols[vp+2] = Math.min(1.14, crTint * baseB);
        _lBL[vp] = lr; _lBL[vp+1] = lg; _lBL[vp+2] = lb;
        vp += 3;
      }
      _lUvs[up]=u0; _lUvs[up+1]=v1; _lUvs[up+2]=u1; _lUvs[up+3]=v1; _lUvs[up+4]=u1; _lUvs[up+5]=v0; _lUvs[up+6]=u0; _lUvs[up+7]=v0;
      const ip = st.liCount, lc = st.lCount;
      _lIdx[ip]=lc; _lIdx[ip+1]=lc+1; _lIdx[ip+2]=lc+2; _lIdx[ip+3]=lc; _lIdx[ip+4]=lc+2; _lIdx[ip+5]=lc+3;
      st.lCount = lc + 4; st.liCount = ip + 6;
    }
  }

  function _meshCrystalOrPortalVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, st) {
    const tile = def.tiles[0], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
    if (def.crystalCluster) {
      const emitPrism = (cxP, czP, bw, tw, h, tiltX, tiltZ) => {
        const bx = wx + cxP, by = wy, bz = wz + czP;
        const tx0 = bx - bw, tx1 = bx + bw, tz0 = bz - bw, tz1 = bz + bw;
        const ox = Math.sin(tiltX) * h, oz = Math.sin(tiltZ) * h, oy = Math.cos(tiltX) * Math.cos(tiltZ) * h;
        const topX = bx + ox, topY = by + oy, topZ = bz + oz;
        const qpts = [
          [[tx0, by, tz1], [tx1, by, tz1], [topX + tw, topY, topZ + tw], [topX - tw, topY, topZ + tw]],
          [[tx1, by, tz0], [tx0, by, tz0], [topX - tw, topY, topZ - tw], [topX + tw, topY, topZ - tw]],
          [[tx1, by, tz1], [tx1, by, tz0], [topX + tw, topY, topZ - tw], [topX + tw, topY, topZ + tw]],
          [[tx0, by, tz0], [tx0, by, tz1], [topX - tw, topY, topZ + tw], [topX - tw, topY, topZ - tw]],
          [[topX - tw, topY, topZ + tw], [topX + tw, topY, topZ + tw], [topX + tw, topY, topZ - tw], [topX - tw, topY, topZ - tw]]
        ];
        for (let q = 0; q < qpts.length; q++) {
          const qp = qpts[q];
          for (let c = 0; c < 4; c++) { ePos.push(qp[c][0], qp[c][1], qp[c][2]); eType.push(3.0); }
          eUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
          eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
        }
      };
      emitPrism(0.50, 0.50, 0.17, 0.06, 0.86,  0.14, -0.10);
      emitPrism(0.32, 0.44, 0.11, 0.04, 0.58, -0.44,  0.20);
      emitPrism(0.68, 0.48, 0.11, 0.04, 0.54,  0.46, -0.18);
      emitPrism(0.50, 0.68, 0.10, 0.035, 0.46,  0.08,  0.48);
      emitPrism(0.48, 0.30, 0.09, 0.035, 0.42, -0.14, -0.46);
      return;
    }
    const emitPortalBox = (x0, y0, z0, x1, y1, z1, pKind) => {
      const wx0p = wx + x0, wx1p = wx + x1, wy0p = wy + y0, wy1p = wy + y1, wz0p = wz + z0, wz1p = wz + z1;
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + face.dir[0], ly + face.dir[1], lz + face.dir[2]) === id) continue;
        let p, qU0, qU1, qV0, qV1;
        if (f === 0)      { p = wy1p; qU0 = wx0p; qU1 = wx1p; qV0 = wz0p; qV1 = wz1p; }
        else if (f === 1) { p = wy0p; qU0 = wx0p; qU1 = wx1p; qV0 = wz0p; qV1 = wz1p; }
        else if (f === 2) { p = wx1p; qU0 = wz0p; qU1 = wz1p; qV0 = wy0p; qV1 = wy1p; }
        else if (f === 3) { p = wx0p; qU0 = wz0p; qU1 = wz1p; qV0 = wy0p; qV1 = wy1p; }
        else if (f === 4) { p = wz1p; qU0 = wx0p; qU1 = wx1p; qV0 = wy0p; qV1 = wy1p; }
        else              { p = wz0p; qU0 = wx0p; qU1 = wx1p; qV0 = wy0p; qV1 = wy1p; }
        _ptQuads.push({ f, pKind, p, pk: Math.round(p * 1000), u0: qU0, u1: qU1, v0: qV0, v1: qV1, u0t: u0, u1t: u1, v0t: v0, v1t: v1 });
      }
    };
    const _resolvePortalAlongZ = (fId) => {
      const nbXM = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz);
      const nbXP = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz);
      const nbZM = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1);
      const nbZP = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1);
      const idX = (nbXM === id || nbXP === id), idZ = (nbZM === id || nbZP === id);
      if (idX !== idZ) return idZ;
      const frX = (nbXM === fId || nbXP === fId), frZ = (nbZM === fId || nbZP === fId);
      return frZ && !frX;
    };
    if (id === B.END_GATEWAY) {
      emitPortalBox(0.04, 0.04, 0.04, 0.96, 0.96, 0.96, 2.0);
    } else if (id === B.END_PORTAL) {
      const aboveB = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz), belowB = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
      const isUpright = (aboveB === B.END_PORTAL || aboveB === B.OBSIDIAN || aboveB === B.BEDROCK) && (belowB === B.END_PORTAL || belowB === B.OBSIDIAN || belowB === B.BEDROCK);
      if (!isUpright) emitPortalBox(0.0, 0.72, 0.0, 1.0, 0.75, 1.0, 2.0);
      else {
        const alongZ = _resolvePortalAlongZ(B.OBSIDIAN);
        emitPortalBox(alongZ ? 0.45 : 0.0, 0.0, alongZ ? 0.0 : 0.45, alongZ ? 0.55 : 1.0, 1.0, alongZ ? 1.0 : 0.55, 2.0);
      }
    } else {
      const isDragonP = (id === B.DRAGON_REALM_PORTAL);
      const fId = isDragonP ? B.BEDROCK : (id === B.DREAM_PORTAL ? B.DREAM_PORTAL_FRAME : (id === B.WARDEN_PORTAL ? B.REINFORCED_DEEPSLATE : B.OBSIDIAN));
      const pKind = isDragonP ? 2.0 : (id === B.WARDEN_PORTAL ? 3.0 : (id === B.DREAM_PORTAL ? 1.0 : 0.0));
      const alongZ = _resolvePortalAlongZ(fId);
      emitPortalBox(alongZ ? 0.45 : 0.0, 0.0, alongZ ? 0.0 : 0.45, alongZ ? 0.55 : 1.0, 1.0, alongZ ? 1.0 : 0.55, pKind);
    }
  }

  // Greedy-merge coplanar portal quads per (face, kind, plane) inside a chunk to eliminate 1x1 MSAA seams across all portals
  function _flushPortalQuads(ptPos, ptNorm, ptUvs, ptKind, ptIndices, st) {
    const n = _ptQuads.length;
    if (n === 0) return;
    _ptQuads.sort((a, b) => (a.f - b.f) || (a.pKind - b.pKind) || (a.pk - b.pk) || (a.v0 - b.v0) || (a.v1 - b.v1) || (a.u0 - b.u0));
    const uMerged = [];
    for (let i = 0; i < n; i++) {
      const q = _ptQuads[i];
      const prev = uMerged.length > 0 ? uMerged[uMerged.length - 1] : null;
      if (prev && prev.f === q.f && prev.pKind === q.pKind && prev.pk === q.pk &&
          Math.abs(prev.v0 - q.v0) < 1e-4 && Math.abs(prev.v1 - q.v1) < 1e-4 && Math.abs(prev.u1 - q.u0) < 1e-4) {
        prev.u1 = q.u1;
      } else {
        uMerged.push(q);
      }
    }
    uMerged.sort((a, b) => (a.f - b.f) || (a.pKind - b.pKind) || (a.pk - b.pk) || (a.u0 - b.u0) || (a.u1 - b.u1) || (a.v0 - b.v0));
    const finalQuads = [];
    for (let i = 0; i < uMerged.length; i++) {
      const q = uMerged[i];
      const prev = finalQuads.length > 0 ? finalQuads[finalQuads.length - 1] : null;
      if (prev && prev.f === q.f && prev.pKind === q.pKind && prev.pk === q.pk &&
          Math.abs(prev.u0 - q.u0) < 1e-4 && Math.abs(prev.u1 - q.u1) < 1e-4 && Math.abs(prev.v1 - q.v0) < 1e-4) {
        prev.v1 = q.v1;
      } else {
        finalQuads.push(q);
      }
    }
    for (let i = 0; i < finalQuads.length; i++) {
      const q = finalQuads[i], f = q.f, dir = FACES[f].dir, p = q.p;
      if (f === 0)      ptPos.push(q.u0, p, q.v1, q.u1, p, q.v1, q.u1, p, q.v0, q.u0, p, q.v0);
      else if (f === 1) ptPos.push(q.u0, p, q.v0, q.u1, p, q.v0, q.u1, p, q.v1, q.u0, p, q.v1);
      else if (f === 2) ptPos.push(p, q.v0, q.u1, p, q.v0, q.u0, p, q.v1, q.u0, p, q.v1, q.u1);
      else if (f === 3) ptPos.push(p, q.v0, q.u0, p, q.v0, q.u1, p, q.v1, q.u1, p, q.v1, q.u0);
      else if (f === 4) ptPos.push(q.u0, q.v0, p, q.u1, q.v0, p, q.u1, q.v1, p, q.u0, q.v1, p);
      else              ptPos.push(q.u1, q.v0, p, q.u0, q.v0, p, q.u0, q.v1, p, q.u1, q.v1, p);
      for (let c = 0; c < 4; c++) { ptNorm.push(dir[0], dir[1], dir[2]); ptKind.push(q.pKind); }
      ptUvs.push(q.u0t, q.v1t, q.u1t, q.v1t, q.u1t, q.v0t, q.u0t, q.v0t);
      ptIndices.push(st.ptCount, st.ptCount + 1, st.ptCount + 2, st.ptCount, st.ptCount + 2, st.ptCount + 3);
      st.ptCount += 4;
    }
  }

  const _chAutumnCell = new Int8Array(16);
  const _borderScratch = new Uint16Array(17408);
  const _autumnScratch = new Uint8Array(16);
  function _computeAutumnCell(wx0, wz0, outU8) {
    if (currentDimension !== 'overworld') { outU8.fill(0); return; }
    for (let gz = 0; gz < 4; gz++) {
      const wz = wz0 + (gz << 2);
      for (let gx = 0; gx < 4; gx++) {
        const ab = getBiomeAt(wx0 + (gx << 2), wz);
        outU8[(gz << 2) | gx] = (ab === BIOMES.AUTUMN || ab === BIOMES.AUTUMN_GOLDEN || ab === BIOMES.AUTUMN_DEEP || ab === BIOMES.DAPPLED_FOREST) ? 1 : 0;
      }
    }
  }
  function _packChunkBorders(outU16, dXP, dXM, dZP, dZM, cx, cz, maxLy) {
    outU16.fill(0);
    const copyLy = Math.min(WORLD_H - 1, maxLy + 1);
    const hasDepth = (depthOffset || 0) > 0;
    if (dXP) {
      for (let ly = 0; ly <= copyLy; ly++) {
        const row = ly << 8, dst = ly << 4;
        for (let lz = 0; lz < 16; lz++) outU16[dst | lz] = dXP[row | (lz << 4)];
      }
      if (hasDepth) {
        const row = (WORLD_H - 1) << 8, dst = (WORLD_H - 1) << 4;
        for (let lz = 0; lz < 16; lz++) outU16[dst | lz] = dXP[row | (lz << 4)];
      }
    }
    if (dXM) {
      for (let ly = 0; ly <= copyLy; ly++) {
        const row = ly << 8, dst = 4096 + (ly << 4);
        for (let lz = 0; lz < 16; lz++) outU16[dst | lz] = dXM[row | (lz << 4) | 15];
      }
      if (hasDepth) {
        const row = (WORLD_H - 1) << 8, dst = 4096 + ((WORLD_H - 1) << 4);
        for (let lz = 0; lz < 16; lz++) outU16[dst | lz] = dXM[row | (lz << 4) | 15];
      }
    }
    if (dZP) {
      for (let ly = 0; ly <= copyLy; ly++) {
        const row = ly << 8, dst = 8192 + (ly << 4);
        for (let lx = 0; lx < 16; lx++) outU16[dst | lx] = dZP[row | lx];
      }
      if (hasDepth) {
        const row = (WORLD_H - 1) << 8, dst = 8192 + ((WORLD_H - 1) << 4);
        for (let lx = 0; lx < 16; lx++) outU16[dst | lx] = dZP[row | lx];
      }
    }
    if (dZM) {
      for (let ly = 0; ly <= copyLy; ly++) {
        const row = ly << 8, dst = 12288 + (ly << 4);
        for (let lx = 0; lx < 16; lx++) outU16[dst | lx] = dZM[row | 240 | lx];
      }
      if (hasDepth) {
        const row = (WORLD_H - 1) << 8, dst = 12288 + ((WORLD_H - 1) << 4);
        for (let lx = 0; lx < 16; lx++) outU16[dst | lx] = dZM[row | 240 | lx];
      }
    }
    const corners = [
      [chunks.get(chunkKey(cx + 1, cz + 1))?.data || null, 0, 16384],
      [chunks.get(chunkKey(cx + 1, cz - 1))?.data || null, 240, 16640],
      [chunks.get(chunkKey(cx - 1, cz + 1))?.data || null, 15, 16896],
      [chunks.get(chunkKey(cx - 1, cz - 1))?.data || null, 255, 17152]
    ];
    for (let ci = 0; ci < 4; ci++) {
      const cd = corners[ci][0];
      if (!cd) continue;
      const cOff = corners[ci][1], base = corners[ci][2];
      for (let ly = 0; ly <= copyLy; ly++) outU16[base + ly] = cd[(ly << 8) | cOff];
      if (hasDepth) outU16[base + (WORLD_H - 1)] = cd[((WORLD_H - 1) << 8) | cOff];
    }
  }
  function _prepLayerLightSlice(ly, emLen) {
    if (emLen <= 0) return 0;
    let sliceLen = 0, sMinX = 999, sMaxX = -999, sMinZ = 999, sMaxZ = -999;
    const cyMid = ly + 0.5;
    for (let ei = 0; ei < emLen; ei += 7) {
      const dy = cyMid - _emBuf[ei + 1], rad2 = _emBuf[ei + 6];
      if (dy * dy <= rad2 + 48.0) {
        const ex = _emBuf[ei], ez = _emBuf[ei + 2], rPad = Math.sqrt(rad2) + 1.5;
        _sliceEmBuf[sliceLen] = ex; _sliceEmBuf[sliceLen + 1] = _emBuf[ei + 1]; _sliceEmBuf[sliceLen + 2] = ez;
        _sliceEmBuf[sliceLen + 3] = _emBuf[ei + 3]; _sliceEmBuf[sliceLen + 4] = _emBuf[ei + 4]; _sliceEmBuf[sliceLen + 5] = _emBuf[ei + 5]; _sliceEmBuf[sliceLen + 6] = rad2;
        sliceLen += 7;
        if (ex - rPad < sMinX) sMinX = ex - rPad;
        if (ex + rPad > sMaxX) sMaxX = ex + rPad;
        if (ez - rPad < sMinZ) sMinZ = ez - rPad;
        if (ez + rPad > sMaxZ) sMaxZ = ez + rPad;
      }
    }
    _sliceMinX = sMinX; _sliceMaxX = sMaxX; _sliceMinZ = sMinZ; _sliceMaxZ = sMaxZ;
    if (_nwExports && sliceLen > 0 && sliceLen <= 3584) {
      _syncWasmViews();
      _nwEmitView.set(_sliceEmBuf.subarray(0, sliceLen));
    }
    return sliceLen;
  }
  function _buildChunkMeshFlagsBits(ch, cx, cz, computeAO, cullBottomBedrock, hasFluidLevels) {
    const _cXP = chunks.get(chunkKey(cx + 1, cz)), _cXM = chunks.get(chunkKey(cx - 1, cz));
    const _cZP = chunks.get(chunkKey(cx, cz + 1)), _cZM = chunks.get(chunkKey(cx, cz - 1));
    const allOceanNbr = !!(ch.isOceanChunk && _cXP && _cXP.isOceanChunk && _cXM && _cXM.isOceanChunk && _cZP && _cZP.isOceanChunk && _cZM && _cZM.isOceanChunk);
    let bits = 0;
    if (computeAO) bits |= 1;
    if (cullBottomBedrock) bits |= 2;
    if (currentDimension === 'end') bits |= 4;
    if (currentDimension === 'overworld') bits |= 8;
    if (allOceanNbr) bits |= 16;
    if (hasFluidLevels) bits |= 32;
    if (sodiumOpts.fastLight) bits |= 64;
    if (!sodiumOpts || sodiumOpts.greedyMesh !== false) bits |= 128;
    return { bits, allOceanNbr };
  }
  function _dispatchChunkMeshToWorker(ch) {
    if (!chunkWorkerPool.active || !ch || !ch.data || ch._pendingSlice || ch._skipWorkerMesh) return false;
    const cx = ch.cx, cz = ch.cz, wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W, data = ch.data;
    const maxLy = Math.min(WORLD_H - 1, ch.maxLy);
    const emLen = _scanChunkEmitters(ch, cx, cz, wx0, wz0, data, maxLy);
    const dXP = chunks.get(chunkKey(cx + 1, cz))?.data || null, dXM = chunks.get(chunkKey(cx - 1, cz))?.data || null;
    const dZP = chunks.get(chunkKey(cx, cz + 1))?.data || null, dZM = chunks.get(chunkKey(cx, cz - 1))?.data || null;
    _packChunkBorders(_borderScratch, dXP, dXM, dZP, dZM, cx, cz, maxLy);
    _computeAutumnCell(wx0, wz0, _autumnScratch);
    const computeAO = (shaderQuality !== 'low' || (typeof sodiumOpts !== 'undefined' && !!sodiumOpts.rayTracing));
    const cullBottomBedrock = (sodiumOpts.moreCulling && currentDimension !== 'end');
    const { bits } = _buildChunkMeshFlagsBits(ch, cx, cz, computeAO, cullBottomBedrock, fluidLevel.size > 0);
    return chunkWorkerPool.enqueueMesh(ch, maxLy, _borderScratch, _emBuf, emLen, bits, _autumnScratch);
  }
  function _meshSpecialVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, cIdx, lx, ly, lz, wx, wy, wz, id, flags, maxLy, sliceLen, computeAO, hasFluidLevels, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st, thisChKey) {
    const zOff = (ly << 8) | (lz << 4), inY = (ly > 0 && ly < WORLD_H - 1), inZ = (lz > 0 && lz < 15);
    if (flags & BLK_WATER_SEA) {
      _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, id, hasFluidLevels, _wBuf, st);
      if (id === B.WATER) return;
    }
    if (flags & BLK_LAVA) {
      _meshLavaVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, hasFluidLevels, _lvBuf, st);
      return;
    }
    const def = BLOCK_DEF_ARR[id]; if (!def) return;
    if (flags & BLK_CROSS) {
      _meshCrossPlantVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, maxLy, sliceLen, ePos, eUvs, eType, eIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st);
      return;
    }
    if (flags & BLK_TORCH) {
      _meshTorchVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, ePos, eUvs, eType, eIndices, st);
      return;
    }
    if (flags & BLK_LANTERN) {
      _meshLanternVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, ePos, eUvs, eType, eIndices, st, id);
      return;
    }
    if (flags & BLK_HANG) {
      _meshHangingFruitVoxel(lx, ly, lz, wx, wy, wz, def, sliceLen, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st);
      return;
    }
    if ((flags & (BLK_SOLID | BLK_PORTAL | BLK_SUB)) === 0) return;
    if (flags & BLK_ANIM) {
      if (waterloggedBlocks.size > 0 && waterloggedBlocks.has(modKey(wx, wy, wz))) {
        _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, B.WATER, hasFluidLevels, _wBuf, st);
      }
      createAnimatedBlockVisual(wx, wy, wz, id, thisChKey);
      return;
    }
    if (flags & BLK_SUB) {
      if ((waterloggedBlocks.size > 0 && waterloggedBlocks.has(modKey(wx, wy, wz))) || (def.rootCage && wy <= WATER_LEVEL)) {
        _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, B.WATER, hasFluidLevels, _wBuf, st);
      }
      _meshSubBlockVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, sliceLen, ePos, eUvs, eType, eIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st);
      return;
    }
    if (flags & BLK_FOLIAGE) {
      _meshFoliageVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, computeAO, sliceLen, st);
      return;
    }
    if ((flags & (BLK_EMISSIVE | BLK_GLASS)) === 0) {
      if (inY && inZ && lx > 0 && lx < 15) {
        if (IS_OPAQUE[data[cIdx + 1]] === 1 && IS_OPAQUE[data[cIdx - 1]] === 1 &&
            IS_OPAQUE[data[cIdx + 256]] === 1 && IS_OPAQUE[data[cIdx - 256]] === 1 &&
            IS_OPAQUE[data[cIdx + 16]] === 1 && IS_OPAQUE[data[cIdx - 16]] === 1) return;
      } else if (
          IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz)] === 1 &&
          IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz)] === 1 &&
          IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz)] === 1 &&
          IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz)] === 1 &&
          IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1)] === 1 &&
          IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1)] === 1) return;
    }
    if (flags & (BLK_CRYSTAL | BLK_PORTAL)) {
      _meshCrystalOrPortalVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, st);
      return;
    }
    for (let f = 0; f < 6; f++) {
      const face = FACES[f], dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
      const nlx = lx + dx, nly = ly + dy, nlz = lz + dz;
      const nb = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx, nly, nlz);
      if (IS_OPAQUE[nb] === 1 || (def.glass && nb === B.GLASS) || (sodiumOpts.moreCulling && id === B.ICE && nb === B.ICE) || (def.portal && nb === id)) continue;
      const tile = (def.frontTile !== undefined && dz === 1) ? def.frontTile : def.tiles[face.tileIdx], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
      if (def.emissive) {
        const et = (id === B.GLOW_CRYSTAL) ? 3.0 : 0.0;
        for (let c = 0; c < 4; c++) { const cr = face.corners[c]; ePos.push(wx + cr[0], wy + cr[1], wz + cr[2]); eType.push(et); }
        eUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
        eIndices.push(st.eCount, st.eCount + 1, st.eCount + 2, st.eCount, st.eCount + 2, st.eCount + 3); st.eCount += 4;
        continue;
      }
      if (st.vCount + 4 > _sCap) _growSolidScratch(st.vCount + 4);
      let lr = 0, lg = 0, lb = 0;
      if (sliceLen > 0) { _evalLightSlice(nlx + 0.5, nly + 0.5, nlz + 0.5, _sliceEmBuf, sliceLen, _tmpLight); lr = _tmpLight[0]; lg = _tmpLight[1]; lb = _tmpLight[2]; }
      let ao0 = 1, ao1 = 1, ao2 = 1, ao3 = 1;
      const vc = st.vCount;
      let vp = vc * 3;
      for (let c = 0; c < 4; c++) {
        const cr = face.corners[c];
        _sPos[vp] = wx + cr[0]; _sPos[vp+1] = wy + cr[1]; _sPos[vp+2] = wz + cr[2];
        _sNorm[vp] = dx; _sNorm[vp+1] = dy; _sNorm[vp+2] = dz;
        let ao = 1.0;
        if (computeAO) {
          const su = (c === 1 || c === 2) ? 1 : -1, sv = (c === 2 || c === 3) ? 1 : -1;
          const ux = face.uAxis[0] * su, uy = face.uAxis[1] * su, uz = face.uAxis[2] * su;
          const vx = face.vAxis[0] * sv, vy = face.vAxis[1] * sv, vz = face.vAxis[2] * sv;
          const s1 = IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + ux, nly + uy, nlz + uz)];
          const s2 = IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + vx, nly + vy, nlz + vz)];
          const cn = IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + ux + vx, nly + uy + vy, nlz + uz + vz)];
          ao = (s1 && s2) ? 0.50 : AO_LUT[s1 + s2 + cn];
        }
        _sCols[vp] = ao; _sCols[vp+1] = ao; _sCols[vp+2] = ao;
        _sBL[vp] = lr; _sBL[vp+1] = lg; _sBL[vp+2] = lb;
        vp += 3;
        if (c === 0) ao0 = ao; else if (c === 1) ao1 = ao; else if (c === 2) ao2 = ao; else ao3 = ao;
      }
      const up = vc * 2;
      _sUvs[up]=u0; _sUvs[up+1]=v1; _sUvs[up+2]=u1; _sUvs[up+3]=v1; _sUvs[up+4]=u1; _sUvs[up+5]=v0; _sUvs[up+6]=u0; _sUvs[up+7]=v0;
      const ip = st.iCount;
      if (ao0 + ao2 > ao1 + ao3) { _sIdx[ip]=vc; _sIdx[ip+1]=vc+1; _sIdx[ip+2]=vc+2; _sIdx[ip+3]=vc; _sIdx[ip+4]=vc+2; _sIdx[ip+5]=vc+3; }
      else { _sIdx[ip]=vc+1; _sIdx[ip+1]=vc+2; _sIdx[ip+2]=vc+3; _sIdx[ip+3]=vc+1; _sIdx[ip+4]=vc+3; _sIdx[ip+5]=vc; }
      st.vCount = vc + 4; st.iCount = ip + 6;
    }
  }
  function _buildCombinedSolidGeo(prebuiltSolid, st) {
    const preV = prebuiltSolid ? prebuiltSolid.vCount : 0;
    const preI = prebuiltSolid ? prebuiltSolid.iCount : 0;
    const extraV = st.vCount, extraI = st.iCount;
    if (preV === 0 && extraV === 0) return null;
    const geo = new THREE.BufferGeometry();
    if (preV > 0 && extraV === 0) {
      geo.setAttribute('position', new THREE.BufferAttribute(prebuiltSolid.pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(prebuiltSolid.norm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(prebuiltSolid.uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(prebuiltSolid.col, 3));
      geo.setAttribute('aBlockLight', new THREE.BufferAttribute(prebuiltSolid.bl, 3));
      geo.setIndex(new THREE.BufferAttribute(prebuiltSolid.idx, 1));
      return geo;
    }
    if (preV === 0) {
      geo.setAttribute('position', new THREE.BufferAttribute(_sPos.slice(0, extraV * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(_sNorm.slice(0, extraV * 3), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(_sUvs.slice(0, extraV * 2), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(_sCols.slice(0, extraV * 3), 3));
      geo.setAttribute('aBlockLight', new THREE.BufferAttribute(_sBL.slice(0, extraV * 3), 3));
      geo.setIndex(_makeIdxAttr(_sIdx, extraI, extraV));
      return geo;
    }
    const totV = preV + extraV, totI = preI + extraI;
    const pos = new Float32Array(totV * 3), norm = new Float32Array(totV * 3), uv = new Float32Array(totV * 2);
    const col = new Float32Array(totV * 3), bl = new Float32Array(totV * 3);
    pos.set(prebuiltSolid.pos); pos.set(_sPos.subarray(0, extraV * 3), preV * 3);
    norm.set(prebuiltSolid.norm); norm.set(_sNorm.subarray(0, extraV * 3), preV * 3);
    uv.set(prebuiltSolid.uv); uv.set(_sUvs.subarray(0, extraV * 2), preV * 2);
    col.set(prebuiltSolid.col); col.set(_sCols.subarray(0, extraV * 3), preV * 3);
    bl.set(prebuiltSolid.bl); bl.set(_sBL.subarray(0, extraV * 3), preV * 3);
    const idx = totV <= 65535 ? new Uint16Array(totI) : new Uint32Array(totI);
    idx.set(prebuiltSolid.idx);
    for (let k = 0; k < extraI; k++) idx[preI + k] = _sIdx[k] + preV;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aBlockLight', new THREE.BufferAttribute(bl, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }
  function rebuildChunkMesh(ch, prebuiltSolid = null) {
    const cx = ch.cx, cz = ch.cz, wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W, data = ch.data;
    _chAutumnCell.fill(-1);
    const _autPodDef = BLOCK_DEF_ARR[B.AUTUMN_PODZOL];
    const thisChKey = chunkKey(cx, cz);
    if (ch._pendingSlice) {
      prebuiltSolid = null;
      const ps = ch._pendingSlice;
      ch._pendingSlice = null;
      if (depthOffset === 0 && ps[0] === WORLD_H - 40 && (currentDimension === 'overworld' || currentDimension === 'nether')) {
        const savedLow = data.slice(0, (WORLD_H - 40) << 8);
        chunks.delete(thisChKey); _invChunkCache();
        const surf = generateChunk(cx, cz);
        data.set(surf.data);
        data.set(savedLow, 0);
        ch.maxLy = applyChunkMods(cx, cz, data, Math.max(ch.maxLy, surf.maxLy));
        registerChunk(thisChKey, ch);
      } else if (depthOffset === 0 && ps[0] === 0 && currentDimension === 'nether') {
        const savedHigh = data.slice(40 << 8, WORLD_H << 8);
        chunks.delete(thisChKey); _invChunkCache();
        const surf = generateChunk(cx, cz);
        data.set(surf.data);
        data.set(savedHigh, 40 << 8);
        ch.maxLy = applyChunkMods(cx, cz, data, Math.max(ch.maxLy, surf.maxLy));
        registerChunk(thisChKey, ch);
      } else {
        _fillDeepUndergroundSlice(cx, cz, wx0, wz0, data, ps[0], ps[1]);
      }
      // Refresh neighbor borders that previously culled faces against the unresolved placeholder slice (zero underwater/cave X-ray!)
      const nearP = (typeof player !== 'undefined' && player) ? (Math.abs(cx - (Math.floor(player.x) >> 4)) <= 2 && Math.abs(cz - (Math.floor(player.z) >> 4)) <= 2) : false;
      markChunkDirty(cx + 1, cz, nearP); markChunkDirty(cx - 1, cz, nearP);
      markChunkDirty(cx, cz + 1, nearP); markChunkDirty(cx, cz - 1, nearP);
    }
    clearChunkInteractiveVisuals(thisChKey);
    if (prebuiltSolid && prebuiltSolid.topH && prebuiltSolid.topH.length === 256 && !ch._emitDirty) {
      _unpackWasmScanToChunk(
        ch,
        prebuiltSolid.scanEmit,
        prebuiltSolid.scanEmit ? prebuiltSolid.scanEmit.length : 0,
        prebuiltSolid.scanSpec,
        prebuiltSolid.scanSpec ? prebuiltSolid.scanSpec.length : 0,
        prebuiltSolid.topH,
        prebuiltSolid.mapU32
      );
      _nucraftWasmState.scanCalls++;
    }
    if (typeof markChunkExplored === 'function') markChunkExplored(ch);
    const dXP = chunks.get(chunkKey(cx + 1, cz))?.data || null, dXM = chunks.get(chunkKey(cx - 1, cz))?.data || null;
    const dZP = chunks.get(chunkKey(cx, cz + 1))?.data || null, dZM = chunks.get(chunkKey(cx, cz - 1))?.data || null;

    const maxLy = Math.min(WORLD_H - 1, ch.maxLy);
    const emLen = _scanChunkEmitters(ch, cx, cz, wx0, wz0, data, maxLy);
    const hasFluidLevels = (fluidLevel.size > 0);
    const computeAO = (shaderQuality !== 'low' || (typeof sodiumOpts !== 'undefined' && !!sodiumOpts.rayTracing));

    const ePos = _ePos, eUvs = _eUvs, eType = _eType, eIndices = _eIndices;
    const ptPos = _ptPos, ptNorm = _ptNorm, ptUvs = _ptUvs, ptKind = _ptKind, ptIndices = _ptIndices;
    const pPos = _pPos, pNorm = _pNorm, pUvs = _pUvs, pSway = _pSway, pSkyShade = _pSkyShade, pBLights = _pBLights, pIndices = _pIndices;
    ePos.length = 0; eUvs.length = 0; eType.length = 0; eIndices.length = 0;
    ptPos.length = 0; ptNorm.length = 0; ptUvs.length = 0; ptKind.length = 0; ptIndices.length = 0; _ptQuads.length = 0;
    pPos.length = 0; pNorm.length = 0; pUvs.length = 0; pSway.length = 0; pSkyShade.length = 0; pBLights.length = 0; pIndices.length = 0;
    const st = _meshSt;
    st.vCount = 0; st.iCount = 0; st.lCount = 0; st.liCount = 0; st.eCount = 0; st.ptCount = 0; st.wCount = 0; st.wiCount = 0; st.lvCount = 0; st.lviCount = 0; st.pCount = 0;
    const cullBottomBedrock = (sodiumOpts.moreCulling && currentDimension !== 'end');
    const { bits: meshFlagsBits, allOceanNbr: _allOceanNbr } = _buildChunkMeshFlagsBits(ch, cx, cz, computeAO, cullBottomBedrock, hasFluidLevels);

    let usedFastMesh = false;
    if (prebuiltSolid && prebuiltSolid.specialVoxels) {
      usedFastMesh = true;
      const sv = prebuiltSolid.specialVoxels;
      let prevLy = -1, sliceLen = 0;
      for (let si = 0; si < sv.length; si++) {
        const cIdx = sv[si];
        const ly = cIdx >> 8, lz = (cIdx >> 4) & 15, lx = cIdx & 15;
        const id = data[cIdx];
        if (id === 0) continue;
        if (ly !== prevLy) { prevLy = ly; _bumpWaterDepthCache(); sliceLen = _prepLayerLightSlice(ly, emLen); }
        _meshSpecialVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, cIdx, lx, ly, lz, wx0 + lx, MIN_Y + ly, wz0 + lz, id, BLOCK_FLAGS[id], maxLy, sliceLen, computeAO, hasFluidLevels, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st, thisChKey);
      }
    } else if (_nwExports && _nwExports.mesh_chunk_solid && _syncMainWasmLuts(false)) {
      _syncWasmViews();
      const copyWords = Math.min(data.length, (maxLy + 1) << 8);
      _nwChunkData.fill(0);
      _nwChunkData.set(data.subarray(0, copyWords));
      _packChunkBorders(_nwBorderBuf, dXP, dXM, dZP, dZM, cx, cz, maxLy);
      if (emLen > 0) _nwEmitView.set(_emBuf.subarray(0, Math.min(3584, emLen)));
      _computeAutumnCell(wx0, wz0, _nwAutumnCell);
      const ret = _nwExports.mesh_chunk_solid(
        wx0 | 0, wz0 | 0, MIN_Y | 0, WATER_LEVEL | 0, (depthOffset || 0) | 0,
        maxLy >>> 0, emLen >>> 0, meshFlagsBits >>> 0,
        B.GRASS & 0xffff, B.AUTUMN_PODZOL & 0xffff, B.WATER & 0xffff, B.SEAGRASS & 0xffff,
        B.LAVA & 0xffff, B.BEDROCK & 0xffff, B.DEEPSLATE & 0xffff, BLK_SOLID & 0xffff
      ) >>> 0;
      if (ret !== 0xFFFFFFFF && _nwMeshMeta[3] === 0) {
        usedFastMesh = true;
        _nucraftWasmState.meshCalls++;
        const wV = _nwMeshMeta[0] >>> 0, wI = _nwMeshMeta[1] >>> 0, specN = _nwMeshMeta[2] >>> 0;
        if (wV > 0) {
          if (wV > _sCap) _growSolidScratch(wV);
          _sPos.set(_nwMeshPos.subarray(0, wV * 3));
          _sNorm.set(_nwMeshNorm.subarray(0, wV * 3));
          _sUvs.set(_nwMeshUv.subarray(0, wV * 2));
          _sCols.set(_nwMeshCol.subarray(0, wV * 3));
          _sBL.set(_nwMeshBl.subarray(0, wV * 3));
          _sIdx.set(_nwMeshIdx.subarray(0, wI));
          st.vCount = wV;
          st.iCount = wI;
        }
        let prevLy = -1, sliceLen = 0;
        for (let si = 0; si < specN; si++) {
          const cIdx = _nwSpecVox[si];
          const ly = cIdx >> 8, lz = (cIdx >> 4) & 15, lx = cIdx & 15;
          const id = data[cIdx];
          if (id === 0) continue;
          if (ly !== prevLy) { prevLy = ly; _bumpWaterDepthCache(); sliceLen = _prepLayerLightSlice(ly, emLen); }
          _meshSpecialVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, cIdx, lx, ly, lz, wx0 + lx, MIN_Y + ly, wz0 + lz, id, BLOCK_FLAGS[id], maxLy, sliceLen, computeAO, hasFluidLevels, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st, thisChKey);
        }
      }
    }

    if (!usedFastMesh) {
    prebuiltSolid = null;
    for (let ly = 0; ly <= maxLy; ly++) {
      _bumpWaterDepthCache();
      const wy = MIN_Y + ly, yOff = ly << 8;
      // Sodium: uniform air or interior ocean-water Y-layer skip
      const _uniId = data[yOff];
      if (_uniId === 0 || (_uniId === B.WATER && _allOceanNbr && !hasFluidLevels && ly > 0 && (wy - (depthOffset || 0)) < WATER_LEVEL)) {
        let _allSame = true;
        for (let _k = 1; _k < 256; _k++) { if (data[yOff | _k] !== _uniId) { _allSame = false; break; } }
        if (_allSame) continue;
      }
      const sliceLen = _prepLayerLightSlice(ly, emLen);
      const inY = (ly > 0 && ly < WORLD_H - 1);

      for (let lz = 0; lz < 16; lz++) {
        const zOff = yOff | (lz << 4), wz = wz0 + lz, inZ = (lz > 0 && lz < 15);
        for (let lx = 0; lx < 16; lx++) {
          const cIdx = zOff | lx;
          const id = data[cIdx];
          if (id === 0) continue;
          const wx = wx0 + lx;
          const flags = BLOCK_FLAGS[id];

          // Hot common opaque cube fast path (>90% of voxels)
          if (flags === BLK_SOLID) {
            const def = BLOCK_DEF_ARR[id]; if (!def) continue;
            const isInt = (inY && inZ && lx > 0 && lx < 15);
            if (isInt) {
              if (IS_OPAQUE[data[cIdx + 1]] === 1 && IS_OPAQUE[data[cIdx - 1]] === 1 &&
                  IS_OPAQUE[data[cIdx + 256]] === 1 && IS_OPAQUE[data[cIdx - 256]] === 1 &&
                  IS_OPAQUE[data[cIdx + 16]] === 1 && IS_OPAQUE[data[cIdx - 16]] === 1) continue;
            } else if (
                IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz)] === 1 &&
                IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz)] === 1 &&
                IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz)] === 1 &&
                IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz)] === 1 &&
                IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1)] === 1 &&
                IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1)] === 1) continue;

            for (let f = 0; f < 6; f++) {
              if (f === 1 && ly === 0 && cullBottomBedrock) continue;
              const face = FACES[f], dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
              const nlx = lx + dx, nly = ly + dy, nlz = lz + dz;
              const nb = (nlx >= 0 && nlx < 16 && nlz >= 0 && nlz < 16 && nly >= 0 && nly < WORLD_H)
                ? data[(nly << 8) | (nlz << 4) | nlx]
                : _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx, nly, nlz);
              if (IS_OPAQUE[nb] === 1) continue;
              if (st.vCount + 4 > _sCap) _growSolidScratch(st.vCount + 4);
              let lr = 0, lg = 0, lb = 0;
              if (sliceLen > 0) { _evalLightSlice(nlx + 0.5, nly + 0.5, nlz + 0.5, _sliceEmBuf, sliceLen, _tmpLight); lr = _tmpLight[0]; lg = _tmpLight[1]; lb = _tmpLight[2]; }

              let ao0 = 1, ao1 = 1, ao2 = 1, ao3 = 1;
              if (computeAO) {
                const uxA = face.uAxis[0], uyA = face.uAxis[1], uzA = face.uAxis[2];
                const vxA = face.vAxis[0], vyA = face.vAxis[1], vzA = face.vAxis[2];
                const nlInt = (nlx > 0 && nlx < 15 && nlz > 0 && nlz < 15 && nly > 0 && nly < WORLD_H - 1);
                if (nlInt) {
                  const nIdx = (nly << 8) | (nlz << 4) | nlx;
                  const uOff = (uyA << 8) + (uzA << 4) + uxA, vOff = (vyA << 8) + (vzA << 4) + vxA;
                  for (let c = 0; c < 4; c++) {
                    const su = (c === 1 || c === 2) ? 1 : -1, sv = (c === 2 || c === 3) ? 1 : -1;
                    const s1 = IS_OPAQUE[data[nIdx + uOff * su]], s2 = IS_OPAQUE[data[nIdx + vOff * sv]], cn = IS_OPAQUE[data[nIdx + uOff * su + vOff * sv]];
                    const ao = (s1 && s2) ? 0.50 : AO_LUT[s1 + s2 + cn];
                    if (c === 0) ao0 = ao; else if (c === 1) ao1 = ao; else if (c === 2) ao2 = ao; else ao3 = ao;
                  }
                } else {
                  for (let c = 0; c < 4; c++) {
                    const su = (c === 1 || c === 2) ? 1 : -1, sv = (c === 2 || c === 3) ? 1 : -1;
                    const ux = uxA * su, uy = uyA * su, uz = uzA * su, vx = vxA * sv, vy = vyA * sv, vz = vzA * sv;
                    const s1 = IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + ux, nly + uy, nlz + uz)];
                    const s2 = IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + vx, nly + vy, nlz + vz)];
                    const cn = IS_OPAQUE[_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, nlx + ux + vx, nly + uy + vy, nlz + uz + vz)];
                    const ao = (s1 && s2) ? 0.50 : AO_LUT[s1 + s2 + cn];
                    if (c === 0) ao0 = ao; else if (c === 1) ao1 = ao; else if (c === 2) ao2 = ao; else ao3 = ao;
                  }
                }
              }
              const vc = st.vCount;
              let vp = vc * 3;
              const cr0 = face.corners[0], cr1 = face.corners[1], cr2 = face.corners[2], cr3 = face.corners[3];
              _sPos[vp] = wx+cr0[0]; _sPos[vp+1] = wy+cr0[1]; _sPos[vp+2] = wz+cr0[2]; _sNorm[vp] = dx; _sNorm[vp+1] = dy; _sNorm[vp+2] = dz; _sCols[vp]=ao0; _sCols[vp+1]=ao0; _sCols[vp+2]=ao0; _sBL[vp]=lr; _sBL[vp+1]=lg; _sBL[vp+2]=lb;
              _sPos[vp+3] = wx+cr1[0]; _sPos[vp+4] = wy+cr1[1]; _sPos[vp+5] = wz+cr1[2]; _sNorm[vp+3] = dx; _sNorm[vp+4] = dy; _sNorm[vp+5] = dz; _sCols[vp+3]=ao1; _sCols[vp+4]=ao1; _sCols[vp+5]=ao1; _sBL[vp+3]=lr; _sBL[vp+4]=lg; _sBL[vp+5]=lb;
              _sPos[vp+6] = wx+cr2[0]; _sPos[vp+7] = wy+cr2[1]; _sPos[vp+8] = wz+cr2[2]; _sNorm[vp+6] = dx; _sNorm[vp+7] = dy; _sNorm[vp+8] = dz; _sCols[vp+6]=ao2; _sCols[vp+7]=ao2; _sCols[vp+8]=ao2; _sBL[vp+6]=lr; _sBL[vp+7]=lg; _sBL[vp+8]=lb;
              _sPos[vp+9] = wx+cr3[0]; _sPos[vp+10] = wy+cr3[1]; _sPos[vp+11] = wz+cr3[2]; _sNorm[vp+9] = dx; _sNorm[vp+10] = dy; _sNorm[vp+11] = dz; _sCols[vp+9]=ao3; _sCols[vp+10]=ao3; _sCols[vp+11]=ao3; _sBL[vp+9]=lr; _sBL[vp+10]=lg; _sBL[vp+11]=lb;
              let useDef = def;
              if (id === B.GRASS && currentDimension === 'overworld' && _autPodDef) {
                const acIdx = ((lz >> 2) << 2) | (lx >> 2);
                let isAut = _chAutumnCell[acIdx];
                if (isAut < 0) {
                  const ab = getBiomeAt(wx0 + (lx & ~3), wz0 + (lz & ~3));
                  isAut = (ab === BIOMES.AUTUMN || ab === BIOMES.AUTUMN_GOLDEN || ab === BIOMES.AUTUMN_DEEP || ab === BIOMES.DAPPLED_FOREST) ? 1 : 0;
                  _chAutumnCell[acIdx] = isAut;
                }
                if (isAut === 1) useDef = _autPodDef;
              }
              const tile = (useDef.frontTile !== undefined && (dz === 1 || (useDef.bothZFront && dz === -1))) ? useDef.frontTile : useDef.tiles[face.tileIdx], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
              const up = vc * 2;
              _sUvs[up]=u0; _sUvs[up+1]=v1; _sUvs[up+2]=u1; _sUvs[up+3]=v1; _sUvs[up+4]=u1; _sUvs[up+5]=v0; _sUvs[up+6]=u0; _sUvs[up+7]=v0;
              const ip = st.iCount;
              if (ao0 + ao2 > ao1 + ao3) { _sIdx[ip]=vc; _sIdx[ip+1]=vc+1; _sIdx[ip+2]=vc+2; _sIdx[ip+3]=vc; _sIdx[ip+4]=vc+2; _sIdx[ip+5]=vc+3; }
              else { _sIdx[ip]=vc+1; _sIdx[ip+1]=vc+2; _sIdx[ip+2]=vc+3; _sIdx[ip+3]=vc+1; _sIdx[ip+4]=vc+3; _sIdx[ip+5]=vc; }
              st.vCount = vc + 4; st.iCount = ip + 6;
            }
            continue;
          }

          _meshSpecialVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, cIdx, lx, ly, lz, wx, wy, wz, id, flags, maxLy, sliceLen, computeAO, hasFluidLevels, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st, thisChKey);
        }
      }
    }
    }

    disposeChunkMeshes(ch, true);

    const _rtMeshOn = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
    const _effLow = (shaderQuality === 'low' && !_rtMeshOn);
    const _effUltra = (shaderQuality === 'ultra' || shaderQuality === 'extreme' || _rtMeshOn);
    const _shPreset = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality]) || { shadowChunkRange: 26 };
    const _rawShRange = _shPreset.shadowChunkRange > 0 ? _shPreset.shadowChunkRange : (_rtMeshOn ? 32 : 0);
    const _shChunkRad = _rawShRange > 0 ? Math.min(2, Math.max(1, Math.ceil(_rawShRange / CHUNK_W))) : -1;
    const nearShadow = (_shChunkRad >= 0) && (Math.max(Math.abs(cx - (Math.floor(player.x) >> 4)), Math.abs(cz - (Math.floor(player.z) >> 4))) <= _shChunkRad);
    const geo = _buildCombinedSolidGeo(prebuiltSolid, st);
    if (geo) {
      _assignChunkBounds(geo, wx0, wz0, maxLy);
      ch.mesh = new THREE.Mesh(geo, terrainMat);
      ch.mesh.castShadow = nearShadow; ch.mesh.receiveShadow = true; ch.mesh.frustumCulled = true;
      ch.mesh.matrixAutoUpdate = false; ch.mesh.updateMatrix();
      scene.add(ch.mesh);
    }
    if (st.lCount > 0) {
      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute('position', new THREE.BufferAttribute(_lPos.slice(0, st.lCount * 3), 3));
      lGeo.setAttribute('normal', new THREE.BufferAttribute(_lNorm.slice(0, st.lCount * 3), 3));
      lGeo.setAttribute('uv', new THREE.BufferAttribute(_lUvs.slice(0, st.lCount * 2), 2));
      lGeo.setAttribute('color', new THREE.BufferAttribute(_lCols.slice(0, st.lCount * 3), 3));
      lGeo.setAttribute('aBlockLight', new THREE.BufferAttribute(_lBL.slice(0, st.lCount * 3), 3));
      lGeo.setIndex(_makeIdxAttr(_lIdx, st.liCount, st.lCount));
      _assignChunkBounds(lGeo, wx0, wz0, maxLy);
      const _isCartoonMesh = !!window._cartoonAddonActive;
      ch.leavesMesh = new THREE.Mesh(lGeo, _isCartoonMesh ? leavesMatCartoon : (_effLow ? leavesMatLow : leavesMat));
      if (!_effLow && !_isCartoonMesh) ch.leavesMesh.customDepthMaterial = leavesDepthMat;
      const nearLeafSh = (_shChunkRad >= 0) && (Math.max(Math.abs(cx - (Math.floor(player.x) >> 4)), Math.abs(cz - (Math.floor(player.z) >> 4))) <= Math.min(_shChunkRad, 1));
      ch.leavesMesh.castShadow = (!_effLow && !_isCartoonMesh && nearLeafSh); ch.leavesMesh.receiveShadow = false; ch.leavesMesh.frustumCulled = true;
      ch.leavesMesh.matrixAutoUpdate = false; ch.leavesMesh.updateMatrix();
      scene.add(ch.leavesMesh);
    }
    ch.leavesCrossMesh = null;
    if (st.eCount > 0) {
      const eGeo = new THREE.BufferGeometry();
      eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
      eGeo.setAttribute('uv', new THREE.Float32BufferAttribute(eUvs, 2));
      eGeo.setAttribute('aEmissiveType', new THREE.Float32BufferAttribute(eType, 1));
      eGeo.setIndex(_makeIdxAttr(eIndices, eIndices.length, st.eCount));
      _assignChunkBounds(eGeo, wx0, wz0, maxLy);
      ch.emissiveMesh = new THREE.Mesh(eGeo, emissiveMat);
      ch.emissiveMesh.matrixAutoUpdate = false; ch.emissiveMesh.updateMatrix();
      scene.add(ch.emissiveMesh);
    }
    if (_ptQuads.length > 0) _flushPortalQuads(ptPos, ptNorm, ptUvs, ptKind, ptIndices, st);
    if (st.ptCount > 0) {
      const ptGeo = new THREE.BufferGeometry();
      ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(ptPos, 3));
      ptGeo.setAttribute('normal', new THREE.Float32BufferAttribute(ptNorm, 3));
      ptGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ptUvs, 2));
      ptGeo.setAttribute('aPortalKind', new THREE.Float32BufferAttribute(ptKind, 1));
      ptGeo.setIndex(_makeIdxAttr(ptIndices, ptIndices.length, st.ptCount));
      _assignChunkBounds(ptGeo, wx0, wz0, maxLy);
      ch.portalMesh = new THREE.Mesh(ptGeo, portalMat);
      ch.portalMesh.renderOrder = 3;
      ch.portalMesh.matrixAutoUpdate = false; ch.portalMesh.updateMatrix();
      scene.add(ch.portalMesh);
    }
    if (st.wCount > 0) {
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.BufferAttribute(_wBuf.pos.slice(0, st.wCount * 3), 3));
      wGeo.setAttribute('normal', new THREE.BufferAttribute(_wBuf.norm.slice(0, st.wCount * 3), 3));
      wGeo.setAttribute('aIsTop', new THREE.BufferAttribute(_wBuf.isTop.slice(0, st.wCount), 1));
      wGeo.setAttribute('aShore', new THREE.BufferAttribute(_wBuf.shore.slice(0, st.wCount), 1));
      wGeo.setAttribute('aDepth', new THREE.BufferAttribute(_wBuf.depth.slice(0, st.wCount), 1));
      wGeo.setIndex(_makeIdxAttr(_wBuf.idx, st.wiCount, st.wCount));
      _assignChunkBounds(wGeo, wx0, wz0, maxLy);
      ch.waterMesh = new THREE.Mesh(wGeo, waterMat);
      ch.waterMesh.renderOrder = 2;
      ch.waterMesh.matrixAutoUpdate = false; ch.waterMesh.updateMatrix();
      scene.add(ch.waterMesh);
    }
    if (st.lvCount > 0) {
      const lvGeo = new THREE.BufferGeometry();
      lvGeo.setAttribute('position', new THREE.BufferAttribute(_lvBuf.pos.slice(0, st.lvCount * 3), 3));
      lvGeo.setAttribute('normal', new THREE.BufferAttribute(_lvBuf.norm.slice(0, st.lvCount * 3), 3));
      lvGeo.setAttribute('aIsTop', new THREE.BufferAttribute(_lvBuf.isTop.slice(0, st.lvCount), 1));
      lvGeo.setAttribute('aShore', new THREE.BufferAttribute(_lvBuf.shore.slice(0, st.lvCount), 1));
      lvGeo.setIndex(_makeIdxAttr(_lvBuf.idx, st.lviCount, st.lvCount));
      _assignChunkBounds(lvGeo, wx0, wz0, maxLy);
      ch.lavaMesh = new THREE.Mesh(lvGeo, lavaMat);
      ch.lavaMesh.matrixAutoUpdate = false; ch.lavaMesh.updateMatrix();
      scene.add(ch.lavaMesh);
    }
    if (st.pCount > 0) {
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
      pGeo.setAttribute('normal', new THREE.Float32BufferAttribute(pNorm, 3));
      pGeo.setAttribute('uv', new THREE.Float32BufferAttribute(pUvs, 2));
      pGeo.setAttribute('aPlantSway', new THREE.Float32BufferAttribute(pSway, 1));
      pGeo.setAttribute('aSkyShade', new THREE.Float32BufferAttribute(pSkyShade, 1));
      pGeo.setAttribute('aBlockLight', new THREE.Float32BufferAttribute(pBLights, 3));
      pGeo.setIndex(_makeIdxAttr(pIndices, pIndices.length, st.pCount));
      _assignChunkBounds(pGeo, wx0, wz0, maxLy);
      ch.plantMesh = new THREE.Mesh(pGeo, plantMat);
      ch.plantMesh.castShadow = false; ch.plantMesh.receiveShadow = !_effLow; ch.plantMesh.frustumCulled = true;
      ch.plantMesh.matrixAutoUpdate = false; ch.plantMesh.updateMatrix();
      scene.add(ch.plantMesh);
    }
    const wasUrgent = ch.urgentDirty;
    ch.dirty = false;
    ch.urgentDirty = false;
    ch.borderDirty = false;
    ch.meshed = true;
    ch._meshInFlightGen = -1;
    if (typeof farLodSystem !== 'undefined') farLodSystem.markChunkMeshed();
    _dirtyChunkSet.delete(ch);
    _urgentChunkSet.delete(ch);
    _borderChunkSet.delete(ch);
    if (typeof player !== 'undefined' && player && Math.abs(cx - (Math.floor(player.x) >> 4)) <= 2 && Math.abs(cz - (Math.floor(player.z) >> 4)) <= 2) {
      window._eclipseGrassDirty = true;
    }
    if (renderer.shadowMap.enabled && nearShadow && (wasUrgent || (frameCounter - (window._lastChunkShF || -99)) >= 8)) {
      window._lastChunkShF = frameCounter;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  let lastPlayerCx = 99999, lastPlayerCz = 99999, _chunkPaceFlip = 0, _teleportWarmupFrames = 0;
  const _chunkUnloadQueue = [], _chunkUnloadSet = new Set();
  let _lastChunkSortYaw = 0;
  function _chunkFrustumScore(cx, cz, pcx, pcz, fwdX, fwdZ, acx, acz) {
    if (cx === acx && cz === acz && (acx !== pcx || acz !== pcz)) return 0.05;
    const dx = cx - pcx, dz = cz - pcz;
    const d2 = dx * dx + dz * dz;
    if (d2 <= 1) return d2 * 0.25; // Immediate neighbor chunks always highest priority
    const invLen = 1 / Math.sqrt(d2);
    const dot = (dx * fwdX + dz * fwdZ) * invLen;
    // Luanti-style camera frustum weighting: prioritize chunks directly ahead in view cone
    const coneMul = dot > 0.35 ? 0.42 : (dot > -0.15 ? 0.85 : 1.55);
    return d2 * coneMul;
  }

