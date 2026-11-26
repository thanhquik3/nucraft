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
    ANCIENT_MINES:       { id: 8, key: 'ancient_mines',       name: '⛏️ Hầm Mỏ Đá Cổ Đại',       fogHex: 0x191614 }
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
      if (els[ni] !== 'water' && getOceanMacro(sx, sz).isOcean) {
        for (let rStep = rad; rStep <= 1100; rStep += 64) {
          const tx = Math.round(Math.cos(ang) * rStep), tz = Math.round(Math.sin(ang) * rStep);
          if (!getOceanMacro(tx, tz).isOcean) { sx = tx; sz = tz; break; }
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
    const sx = (wx + seedMix.ox * 0.25) * 0.0115;
    const sy = (trueY + seedMix.oy * 0.25) * 0.0185;
    const sz = (wz + seedMix.oz * 0.25) * 0.0115;
    const temp = valueNoise3D(sx, sy, sz, seedMix.b1) * 0.68 + valueNoise3D(sx * 2.3 + 13.7, sy * 2.1, sz * 2.3 - 9.4, seedMix.b1 + 17) * 0.32;
    const humid = valueNoise3D(sx * 1.17 + 31.7, sy * 0.96 - 17.3, sz * 1.17 + 19.1, seedMix.b2) * 0.68 + valueNoise3D(sx * 2.4 - 7.1, sy * 2.2 + 5.3, sz * 2.4 + 21.8, seedMix.b2 + 29) * 0.32;
    const weird = valueNoise3D(sx * 1.45 - 23.1, sy * 1.55 + 41.2, sz * 1.45 + 11.9, seedMix.s1 + 73);
    if (trueY <= -760 && temp > 0.32) return UNDERGROUND_BIOMES.MAGMA_CAVERN;
    if (trueY <= -600 && temp > 0.54) return UNDERGROUND_BIOMES.MAGMA_CAVERN;
    if (temp > 0.69 && trueY <= -40) return UNDERGROUND_BIOMES.MAGMA_CAVERN;
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
  // Monumental 1000x1000 Grand Ancient Ruins & Relocated End Portal Citadel (wx, wz in [-3504..-2497])
  const GRAND_RUINS_MIN_X = -3504, GRAND_RUINS_MAX_X = -2497;
  const GRAND_RUINS_MIN_Z = -3504, GRAND_RUINS_MAX_Z = -2497;
  const GRAND_RUINS_CX = -3000, GRAND_RUINS_CZ = -3000, GRAND_RUINS_PORTAL_Y = 16;
  function isGrandRuins(wx, wz) {
    return currentDimension === 'overworld' && wx >= GRAND_RUINS_MIN_X && wx <= GRAND_RUINS_MAX_X && wz >= GRAND_RUINS_MIN_Z && wz <= GRAND_RUINS_MAX_Z;
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
    const macro = fbm2D(wx * 0.000105, wz * 0.000105, 3, 0.52, 2.0, worldSeed + 4111);
    const coastJitter = (fbm2D(wx * 0.0014, wz * 0.0014, 2, 0.5, 2.0, worldSeed + 411) - 0.5) * 0.14;
    const seaVal = macro + coastJitter + spawnLift;
    const isOcean = seaVal < 0.47;
    const openness = isOcean ? Math.max(0, Math.min(1, (0.47 - seaVal) / 0.22)) : 0;
    const ridge = fbm2D(wx * 0.0011, wz * 0.0011, 2, 0.5, 2.0, worldSeed + 4157);
    const trenchFactor = Math.max(0, 1.0 - Math.abs(ridge - 0.5) * 3.8);
    return { isOcean, openness, seaVal, trenchFactor };
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
    if (Math.hypot(wx - 64, wz + 72) < 56) {
      return { x: 64, z: -72, baseY: 7, hero: true };
    }
    const GRID = 256;
    const gx0 = Math.floor(wx / GRID), gz0 = Math.floor(wz / GRID);
    for (let dzg = -1; dzg <= 1; dzg++) {
      for (let dxg = -1; dxg <= 1; dxg++) {
        const rgx = gx0 + dxg, rgz = gz0 + dzg;
        if (rgx === 0 && (rgz === 0 || rgz === -1)) continue;
        if (hash2i(rgx, rgz, worldSeed + 8821) > 0.56) continue;
        const ax = Math.round((rgx + 0.28 + hash2i(rgx, rgz, worldSeed + 8837) * 0.44) * GRID);
        const az = Math.round((rgz + 0.28 + hash2i(rgx, rgz, worldSeed + 8861) * 0.44) * GRID);
        if (Math.abs(wx - ax) <= 44 && Math.abs(wz - az) <= 50) {
          return { x: ax, z: az, baseY: 7, hero: false };
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
      const swx = wx + (valueNoise2D(wx * 0.0018, wz * 0.0018, worldSeed + 4199) - 0.5) * 90.0;
      const swz = wz + (valueNoise2D(wx * 0.0018 + 31.3, wz * 0.0018 - 17.7, worldSeed + 4211) - 0.5) * 90.0;
      const n1 = fbm2D(swx * 0.0012, swz * 0.0012, 2, 0.5, 2.0, worldSeed + 4101);
      const n2 = fbm2D(swx * 0.0015, swz * 0.0015, 2, 0.5, 2.0, worldSeed + 4202);
      const n3 = fbm2D(swx * 0.0020, swz * 0.0020, 2, 0.5, 2.0, worldSeed + 4303);
      if (Math.hypot(wx, wz) < 32) return BIOMES.SIFT_MEADOW;
      if (n3 < 0.23) return n1 < 0.45 ? BIOMES.SIFT_OCEAN : BIOMES.SIFT_ICHOR_PONDS;
      if (n2 > 0.74) return BIOMES.SIFT_PEAKS;
      if (n1 < 0.25) return BIOMES.SIFT_HUSKLAND;
      if (n1 > 0.74) return n2 > 0.54 ? BIOMES.SIFT_GIANT_FOREST : BIOMES.SIFT_SPOREFIELDS;
      if (n2 > 0.64) return (n3 > 0.62) ? BIOMES.SIFT_LULLABY_TOP : BIOMES.SIFT_LULLABY;
      if (n2 < 0.26) return n3 < 0.45 ? BIOMES.SIFT_SKY_ISLANDS : BIOMES.SIFT_CANYON;
      if (n3 > 0.68) return BIOMES.SIFT_CHORAL_GLEN;
      if (n1 >= 0.36 && n1 <= 0.52 && n2 >= 0.34 && n2 <= 0.56) return BIOMES.SIFT_PLAINS;
      if (n1 > 0.52 && n1 < 0.64 && n2 > 0.45) return BIOMES.SIFT_WILD;
      return BIOMES.SIFT_MEADOW;
    }
    if (currentDimension === 'end') return BIOMES.THE_END;
    if (currentDimension === 'nether') {
      if (Math.hypot(wx - 64, wz + 72) < 42) return BIOMES.NETHER_BASALT_DELTAS;
      const nB = fbm2D(wx * 0.0036, wz * 0.0036, 2, 0.5, 2.0, worldSeed + 707);
      const nB2 = fbm2D(wx * 0.0042 + 19.3, wz * 0.0042 - 14.7, 2, 0.5, 2.0, worldSeed + 733);
      if (nB < 0.34) return BIOMES.NETHER_CRIMSON;
      if (nB > 0.66) return BIOMES.NETHER_WARPED;
      if (nB2 < 0.37) return BIOMES.NETHER_BASALT_DELTAS;
      if (nB2 > 0.65) return BIOMES.NETHER_SOUL_VALLEY;
      return BIOMES.NETHER_WASTES;
    }
    if (isWheatMegaPlain(wx, wz)) return BIOMES.WHEAT_VALLEY;
    if (isAbandonedCity(wx, wz)) return BIOMES.ABANDONED_CITY;
    if (isGrandRuins(wx, wz)) return BIOMES.GRAND_RUINS;
    const _oMac = getOceanMacro(wx, wz);
    if (_oMac.isOcean) {
      const _isl = getOceanIslandInfo(wx, wz, _oMac.openness);
      if (_isl && _isl.inIsland) return _isl.biome;
      return (_oMac.openness > 0.34 || _oMac.trenchFactor > 0.55) ? BIOMES.ABYSS_TRENCH : BIOMES.DEEP_OCEAN;
    }
    const warpX = (valueNoise2D(wx * 0.0016, wz * 0.0016, worldSeed + 511) - 0.5) * 140.0;
    const warpZ = (valueNoise2D(wx * 0.0016 + 19.7, wz * 0.0016 - 23.1, worldSeed + 523) - 0.5) * 140.0;
    const bx = wx + warpX, bz = wz + warpZ;
    const coast = fbm2D(bx * 0.00055, bz * 0.00055, 2, 0.5, 2.0, worldSeed + 411);
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
    if (biome === BIOMES.GRAND_RUINS) return 14;
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
    if (currentDimension === 'sift') {
      // v59: Địa hình The Sift chuẩn ảnh mẫu (trụ đá đỏ Terracotta Mesa bậc thang, hồ Ichor cầu vồng + đảo đá bước chân, đồng cỏ xanh ngọc & Lullaby hồng)
      const base = fbm2D(wx * 0.016, wz * 0.016, 2, 0.5, 2.0, worldSeed + 4404);
      const det  = valueNoise2D(wx * 0.06, wz * 0.06, worldSeed + 4505);
      const mesa = valueNoise2D(wx * 0.032, wz * 0.032, worldSeed + 4808);
      // Hồ Ichor cảnh quan gần cổng spawn (0, 16) có đảo đá nhỏ nổi lên giữa nước cầu vồng
      const pondD = Math.hypot((wx - 1) * 0.9, (wz - 16) * 1.05);
      if (pondD < 10.5) {
        if ((Math.hypot(wx - 1, wz - 15) < 2.2) || (Math.hypot(wx + 4, wz - 18) < 1.9) || (Math.hypot(wx - 5, wz - 13) < 1.8)) {
          return WATER_LEVEL + 1;
        }
        return pondD < 8.6 ? WATER_LEVEL - 2 : WATER_LEVEL - 1;
      }
      if (biome === BIOMES.SIFT_OCEAN) {
        return Math.floor(WATER_LEVEL - 14 + base * 5 + det * 1.4);
      }
      if (biome === BIOMES.SIFT_SKY_ISLANDS) {
        return Math.floor(WATER_LEVEL - 11 + base * 4);
      }
      if (biome === BIOMES.SIFT_PEAKS) {
        const peak = Math.pow(Math.max(0, base * 1.25 - 0.1), 1.25);
        return Math.floor(WATER_LEVEL + 16 + peak * 42 + det * 3.0);
      }
      if (biome === BIOMES.SIFT_PLAINS) {
        return Math.floor(WATER_LEVEL + 2 + base * 2.8 + det * 0.8);
      }
      if (biome === BIOMES.SIFT_GIANT_FOREST) {
        return Math.floor(WATER_LEVEL + 4 + base * 8.5 + det * 1.8);
      }
      if (biome === BIOMES.SIFT_ICHOR_PONDS) {
        return (det > 0.68) ? Math.floor(WATER_LEVEL + 1 + (det - 0.68) * 6) : Math.floor(WATER_LEVEL - 2);
      }
      if (biome === BIOMES.SIFT_CANYON) {
        const ridge = Math.abs(mesa - 0.5);
        return ridge < 0.11 ? Math.floor(WATER_LEVEL - 3) : Math.floor(WATER_LEVEL + 9 + Math.floor(base * 3) * 3);
      }
      if (biome === BIOMES.SIFT_LULLABY_TOP) return Math.floor(WATER_LEVEL + 8 + Math.floor(base * 4) * 2 + det * 2);
      if (biome === BIOMES.SIFT_LULLABY) return Math.floor(WATER_LEVEL + 3 + base * 7 + det * 1.8);
      if (biome === BIOMES.SIFT_HUSKLAND) {
        if (mesa > 0.62) return Math.floor(WATER_LEVEL + 12 + Math.floor((mesa - 0.62) * 24));
        return Math.floor(WATER_LEVEL + 2 + base * 4 + det * 1.2);
      }
      if (biome === BIOMES.SIFT_SPOREFIELDS) return Math.floor(WATER_LEVEL + 2 + base * 5 + det * 1.6);
      // Singer's Meadow: thung lũng cỏ xanh ngọc xen kẽ trụ đá Terracotta nổi bật quanh tầm nhìn
      if (mesa > 0.72 && Math.hypot(wx, wz) > 16) return Math.floor(WATER_LEVEL + 11 + Math.floor((mesa - 0.72) * 26));
      return Math.floor(WATER_LEVEL + 2 + Math.floor(base * 3) * 2 + det * 1.5);
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
      const cont = fbm2D(wx * 0.017, wz * 0.017, 2, 0.5, 2.0, worldSeed + 505);
      const det = valueNoise2D(wx * 0.06, wz * 0.06, worldSeed + 606);
      // Continuous meandering Nether lava river channel + sea basins so Nether ALWAYS has flowing lava rivers!
      const riverN = Math.abs(fbm2D(wx * 0.011, wz * 0.011, 2, 0.5, 2.0, worldSeed + 577) - 0.5);
      let nh;
      if (biome === BIOMES.NETHER_BASALT_DELTAS) {
        nh = -4.5 + cont * 16.5 + Math.round(det * 4.5);
      } else if (biome === BIOMES.NETHER_SOUL_VALLEY) {
        nh = -2.5 + cont * 12.5 + det * 2.2;
      } else if (biome === BIOMES.NETHER_CRIMSON || biome === BIOMES.NETHER_WARPED) {
        const rawH = -4.2 + cont * 17.2 + det * 2.4;
        nh = rawH * 0.58 + Math.round(rawH / 3) * 3 * 0.42;
      } else {
        nh = -8.5 + cont * 17.5 + det * 2.6;
      }
      if (riverN < 0.095) {
        const t = 1.0 - riverN / 0.095;
        nh = Math.min(nh, WATER_LEVEL - 1.5 - t * 6.0);
      }
      return Math.max(MIN_Y + 6, Math.floor(nh));
    }
    if (biome === BIOMES.ABANDONED_CITY) return 2;
    if (biome === BIOMES.GRAND_RUINS) return 14;
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

  function fillCoarseCaveGrid(wx0, wz0) {
    let p = 0;
    const dOff = depthOffset || 0;
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

  // Off-thread Coarse 3D Cave/Noise Worker Pool (keeps main render thread tear-free during chunk streaming)
  const chunkWorkerPool = (() => {
    const cache = new Map();
    const inFlight = new Set();
    const workers = [];
    let rr = 0, seq = 0, workerHits = 0, active = false, blobUrl = null;
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
            w.onmessage = (ev) => {
              const d = ev && ev.data;
              if (!d || !d.key || !d.caveGrid) return;
              inFlight.delete(d.key);
              if (!d.key.startsWith(`${seedMix.c1}:`)) return;
              cache.set(d.key, d.caveGrid);
              if (cache.size > 96) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
              }
            };
            w.onerror = () => { active = false; };
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
      prefetch(cx, cz, dOff = 0) {
        if (!active || currentDimension !== 'overworld' || inFlight.size >= Math.max(16, workers.length * 8)) return;
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
      clear() {
        cache.clear();
        inFlight.clear();
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
    fireSimAccum += dt;
    if (fireSimAccum < 0.30 || activeFires.size === 0) return;
    const stepDt = fireSimAccum;
    fireSimAccum = 0;
    const dirs6 = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const entries = Array.from(activeFires.entries());
    const rainingNow = (typeof rainIntensity !== 'undefined' && rainIntensity > 0.45);
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
      if (dPlayer < 24 && Math.random() < 0.62) {
        if (typeof spawnPixelFx === 'function') {
          const isSoul = (below === B.SOUL_SAND || below === B.BASALT);
          spawnPixelFx(isSoul ? 'soul_flame' : 'fire_flame', x + 0.22 + Math.random() * 0.56, y + 0.38, z + 0.22 + Math.random() * 0.56, { count: 1, scale: 0.86, life: 0.44, riseV: 1.15, randV: 0.35, spread: 0.28 });
          if (Math.random() < 0.45) spawnVoxelFx(Math.random() < 0.6 ? 'ember' : 'smoke', x + 0.25 + Math.random() * 0.5, y + 0.72, z + 0.25 + Math.random() * 0.5, 1);
        } else {
          spawnParticles(x + 0.25 + Math.random() * 0.5, y + 0.65, z + 0.25 + Math.random() * 0.5, Math.random() < 0.65 ? 0xf97316 : 0x475569, 1, Math.random() < 0.65);
        }
      }
    }
    flushUrgentChunks(4);
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
    chunks.set(k, ch);
    _invChunkCache();
    if (ch.dirty) _dirtyChunkSet.add(ch);
    if (ch.urgentDirty) _urgentChunkSet.add(ch);
    if (ch.borderDirty) _borderChunkSet.add(ch);
    if (typeof player !== 'undefined' && player && Math.abs((ch.cx << 4) + 8 - player.x) <= 44 && Math.abs((ch.cz << 4) + 8 - player.z) <= 44) window._rtVolDirty = true;
    return ch;
  }
  const _flushScratch = [];
  function flushUrgentChunks(maxRebuilds = 8, includeDirty = false) {
    let rebuilt = 0;
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
        if (++rebuilt >= maxRebuilds) { _flushScratch.length = 0; return; }
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
          if (++rebuilt >= maxRebuilds) { _flushScratch.length = 0; return; }
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

  let _lxCap = 8192;
  let _lxPos = new Float32Array(_lxCap * 3), _lxNorm = new Float32Array(_lxCap * 3), _lxUvs = new Float32Array(_lxCap * 2), _lxCols = new Float32Array(_lxCap * 3), _lxBL = new Float32Array(_lxCap * 3);
  let _lxIdx = new Uint32Array((_lxCap * 3) >> 1);
  function _growLeafCrossScratch(vNeed) {
    let nCap = _lxCap;
    while (nCap < vNeed) nCap <<= 1;
    const p = new Float32Array(nCap * 3), n = new Float32Array(nCap * 3), u = new Float32Array(nCap * 2), c = new Float32Array(nCap * 3), b = new Float32Array(nCap * 3), ix = new Uint32Array((nCap * 3) >> 1);
    p.set(_lxPos); n.set(_lxNorm); u.set(_lxUvs); c.set(_lxCols); b.set(_lxBL); ix.set(_lxIdx);
    _lxPos = p; _lxNorm = n; _lxUvs = u; _lxCols = c; _lxBL = b; _lxIdx = ix; _lxCap = nCap;
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
    weatherFx: true,      // Sodium Extra: rain/snow weather particle toggle
    clouds: true,         // Sodium Extra: volumetric / voxel clouds toggle
    fog: true,            // Sodium Extra: atmospheric & deep sea fog toggle
    particles: true,      // Sodium Extra: block break & spell particles toggle
    animations: true,     // Sodium Extra: skeletal & crystal animations toggle
    farEntities: true,    // Sodium Extra: distant entity rendering toggle
    frameGen: 1,          // AI Frame Gen (1=Off, 2=x2, 4=x4 reprojection + optical-flow + RCAS super-res)
    rayTracing: false     // Real-time Ray Tracing GI, mirror water reflections & leaf light transmission
  }, (() => { try { return JSON.parse(localStorage.getItem(SODIUM_OPTS_KEY) || '{}') || {}; } catch (_) { return {}; } })());
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
  const _ptPos = [], _ptUvs = [], _ptKind = [], _ptIndices = [];
  const _makeFluidBuf = (cap) => ({ cap, pos: new Float32Array(cap * 3), norm: new Float32Array(cap * 3), isTop: new Float32Array(cap), shore: new Float32Array(cap), depth: new Float32Array(cap), idx: new Uint32Array((cap * 3) >> 1) });
  function _growFluidBuf(b, vNeed) {
    let nCap = b.cap; while (nCap < vNeed) nCap <<= 1;
    const pos = new Float32Array(nCap * 3), norm = new Float32Array(nCap * 3), isTop = new Float32Array(nCap), shore = new Float32Array(nCap), depth = new Float32Array(nCap), idx = new Uint32Array((nCap * 3) >> 1);
    pos.set(b.pos); norm.set(b.norm); isTop.set(b.isTop); shore.set(b.shore); depth.set(b.depth); idx.set(b.idx);
    b.pos = pos; b.norm = norm; b.isTop = isTop; b.shore = shore; b.depth = depth; b.idx = idx; b.cap = nCap;
  }
  const _wBuf = _makeFluidBuf(4096), _lvBuf = _makeFluidBuf(4096);
  const _pPos = [], _pNorm = [], _pUvs = [], _pSway = [], _pSkyShade = [], _pBLights = [], _pIndices = [];
  const _meshSt = { vCount: 0, iCount: 0, lCount: 0, liCount: 0, lxCount: 0, lxiCount: 0, eCount: 0, ptCount: 0, wCount: 0, wiCount: 0, lvCount: 0, lviCount: 0, pCount: 0 };

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

  function _refreshOwnEmitters(targetCh) {
    if (!targetCh || !targetCh.data) return;
    const cx = targetCh.cx, cz = targetCh.cz, wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W;
    const data = targetCh.data, maxLy = Math.min(WORLD_H - 1, targetCh.maxLy);
    const maxEm = _initMobile ? 168 : 336;
    let emLen = 0, secLen = 0;
    const lightNodes = [];
    const portalNodes = [];
    const secLightNodes = [];
    for (let ly = 0; ly <= maxLy; ly++) {
      const yOff = ly << 8;
      for (let lz = 0; lz < 16; lz++) {
        const zOff = yOff | (lz << 4);
        for (let lx = 0; lx < 16; lx++) {
          const id = data[zOff | lx];
          if (IS_EMISSIVE[id] === 0) continue;
          const lwx = wx0 + lx + 0.5, lwy = MIN_Y + ly + 0.5, lwz = wz0 + lz + 0.5;
          if (id === B.LANTERN) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=1.28; _ownScanBuf[emLen+4]=0.96; _ownScanBuf[emLen+5]=0.54; _ownScanBuf[emLen+6]=400.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xffca7a, int: 1.38, dist: 28, lvl: 15, r: 1.28, g: 0.96, b: 0.54, rad: 20, rad2: 400.0, prio: 1 });
          } else if (id === B.SOUL_LANTERN) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.46; _ownScanBuf[emLen+4]=1.06; _ownScanBuf[emLen+5]=1.26; _ownScanBuf[emLen+6]=324.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x38e8ff, int: 1.28, dist: 25, lvl: 14, r: 0.46, g: 1.06, b: 1.26, rad: 18, rad2: 324.0, prio: 1 });
          } else if (id === B.SOUL_FIRE) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.30; _ownScanBuf[emLen+4]=0.78; _ownScanBuf[emLen+5]=0.96; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x22d3ee, int: 0.78, dist: 19, lvl: 12, r: 0.30, g: 0.78, b: 0.96, rad: 14, rad2: 196.0, prio: 1 });
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
          } else if (id === B.SEA_LANTERN) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.44; _ownScanBuf[emLen+4]=0.82; _ownScanBuf[emLen+5]=0.90; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0x72f5eb, int: 0.82, r: 0.44, g: 0.82, b: 0.90, rad2: 196.0 });
          } else if (id === B.END_CRYSTAL_BLOCK) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.76; _ownScanBuf[emLen+4]=0.38; _ownScanBuf[emLen+5]=0.86; _ownScanBuf[emLen+6]=169.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xe879f9, int: 0.76, r: 0.76, g: 0.38, b: 0.86, rad2: 169.0 });
          } else if (id === B.END_ROD) {
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=0.92; _ownScanBuf[emLen+4]=0.88; _ownScanBuf[emLen+5]=0.96; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: 0xfef3ff, int: 0.88, r: 0.92, g: 0.88, b: 0.96, rad2: 196.0, prio: 1 });
          } else if (id === B.NETHER_PORTAL || id === B.END_PORTAL || id === B.END_GATEWAY || id === B.DREAM_PORTAL || id === B.WARDEN_PORTAL) {
            const isWardP = (id === B.WARDEN_PORTAL);
            const pR = isWardP ? 0.14 : (id === B.DREAM_PORTAL ? 0.45 : (id === B.END_GATEWAY ? 0.49 : 0.69));
            const pG = isWardP ? 0.80 : (id === B.DREAM_PORTAL ? 0.75 : (id === B.END_GATEWAY ? 0.63 : 0.39));
            const pB = isWardP ? 0.88 : (id === B.END_GATEWAY ? 0.88 : 0.81);
            if (emLen < maxEm) { _ownScanBuf[emLen]=lx+0.5; _ownScanBuf[emLen+1]=ly+0.5; _ownScanBuf[emLen+2]=lz+0.5; _ownScanBuf[emLen+3]=pR; _ownScanBuf[emLen+4]=pG; _ownScanBuf[emLen+5]=pB; _ownScanBuf[emLen+6]=196.0; emLen+=7; }
            lightNodes.push({ x: lwx, y: lwy, z: lwz, col: isWardP ? 0x22d3ee : (id === B.DREAM_PORTAL ? 0x67e8f9 : (id === B.END_GATEWAY ? 0x818cf8 : 0xc084fc)), int: 0.78, r: pR, g: pG, b: pB, rad2: 196.0, prio: 1 });
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
    targetCh.lightNodes = lightNodes;
    targetCh.portalNodes = portalNodes;
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
    if (ly > 0 && id === B.WATER) {
      const nbBelow = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
      if (_canFluidReplace(nbBelow)) scheduleFluid(wx, wy, wz, 0.08);
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
      if (f === 1 && (_isFluidMatch(nb, B.WATER, nwy) || IS_OPAQUE[nb] === 1)) continue;
      if (f >= 2 && (_isFluidMatch(nb, B.WATER, nwy) || IS_OPAQUE[nb] === 1)) continue;
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
      if (_canFluidReplace(nbBelow)) scheduleFluid(wx, wy, wz, 0.14);
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
    const flatY = (id === B.LILY_PAD) ? -0.11 : (def.flatTrack ? 0.04 : 0.03);
    const isHanging = (id === B.VINE || id === B.GLOW_VINES || id === B.MANGROVE_PROPAGULE || id === B.WEEPING_VINES);
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
      const hW = id === B.WHEAT_3 ? 1.04 : (id === B.WHEAT_2 ? 0.94 : (id === B.WHEAT_1 ? 0.80 : 0.65));
      const pad = 0.25, far = 0.75;
      quads = [
        [[0.02, 0.0, pad], [0.98, 0.0, pad], [0.98, hW, pad], [0.02, hW, pad]],
        [[0.02, 0.0, far], [0.98, 0.0, far], [0.98, hW, far], [0.02, hW, far]],
        [[pad, 0.0, 0.02], [pad, 0.0, 0.98], [pad, hW, 0.98], [pad, hW, 0.02]],
        [[far, 0.0, 0.02], [far, 0.0, 0.98], [far, hW, 0.98], [far, hW, 0.02]]
      ];
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
      const isBushyTuft = isLushGrass || (id === B.SEAGRASS && !isStacked);
      const jScale = isStacked ? 0.14 : (isLushGrass ? 0.16 : 0.16);
      const jx = (pr1 - 0.5) * jScale, jz = (pr2 - 0.5) * jScale;
      const hTop = (isStacked || isHanging || id === B.SUGAR_CANE || id === B.COBWEB) ? 1.0
        : (id === B.WILD_TALL_GRASS ? (1.36 + pr1 * 0.24)
        : (id === B.BUSH_GRASS ? (0.98 + pr1 * 0.14)
        : (id === B.SHORT_GRASS ? (0.56 + pr1 * 0.14)
        : (id === B.TALL_GRASS ? (0.82 + pr1 * 0.20) : 0.90))));
      if (isBushyTuft && !isStacked && (shaderQuality !== 'low' || (typeof sodiumOpts !== 'undefined' && !!sodiumOpts.rayTracing))) {
        const r = (id === B.BUSH_GRASS || id === B.WILD_TALL_GRASS) ? 0.48 : 0.44;
        const rTop = r * 1.18;
        const cxp = 0.5 + jx, czp = 0.5 + jz, s60 = 0.8660254, c60 = 0.5;
        quads = [
          [[cxp - r, 0, czp], [cxp + r, 0, czp], [cxp + rTop, hTop, czp], [cxp - rTop, hTop, czp]],
          [[cxp - r * c60, 0, czp - r * s60], [cxp + r * c60, 0, czp + r * s60], [cxp + rTop * c60, hTop, czp + rTop * s60], [cxp - rTop * c60, hTop, czp - rTop * s60]],
          [[cxp - r * c60, 0, czp + r * s60], [cxp + r * c60, 0, czp - r * s60], [cxp + rTop * c60, hTop, czp - rTop * s60], [cxp - rTop * c60, hTop, czp + rTop * s60]]
        ];
        if (id === B.BUSH_GRASS || id === B.WILD_TALL_GRASS) {
          const ri = 0.34, s45 = 0.7071068;
          quads.push([[cxp - ri * s45, 0, czp - ri * s45], [cxp + ri * s45, 0, czp + ri * s45], [cxp + ri * 1.15 * s45, hTop * 0.92, czp + ri * 1.15 * s45], [cxp - ri * 1.15 * s45, hTop * 0.92, czp - ri * 1.15 * s45]]);
        }
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
      emitBox(0.0, 0.0, 0.0, 1.0, 0.8125, 1.0, tTop, tSide, tBot, true);
      if (id === B.END_PORTAL_FRAME_EYE) emitBox(0.25, 0.8125, 0.25, 0.75, 0.98, 0.75, 280, 280, 280, false);
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
      const canConn = (nb) => { const d = BLOCK_DEF_ARR[nb]; return !!(d && (d.fence || d.wall || IS_OPAQUE[nb] === 1)); };
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz))) { emitBox(0.625, 0.75, 0.4375, 1.0, 0.9375, 0.5625, tTop, tSide, tBot); emitBox(0.625, 0.375, 0.4375, 1.0, 0.5625, 0.5625, tTop, tSide, tBot); }
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz))) { emitBox(0.0, 0.75, 0.4375, 0.375, 0.9375, 0.5625, tTop, tSide, tBot); emitBox(0.0, 0.375, 0.4375, 0.375, 0.5625, 0.5625, tTop, tSide, tBot); }
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1))) { emitBox(0.4375, 0.75, 0.625, 0.5625, 0.9375, 1.0, tTop, tSide, tBot); emitBox(0.4375, 0.375, 0.625, 0.5625, 0.5625, 1.0, tTop, tSide, tBot); }
      if (canConn(_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1))) { emitBox(0.4375, 0.75, 0.0, 0.5625, 0.9375, 0.375, tTop, tSide, tBot); emitBox(0.4375, 0.375, 0.0, 0.5625, 0.5625, 0.375, tTop, tSide, tBot); }
    } else if (def.wall) {
      const canW = (nb) => { const d = BLOCK_DEF_ARR[nb]; return !!(d && (d.wall || d.fence || IS_OPAQUE[nb] === 1)); };
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

  function _meshFoliageVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, computeAO, sliceLen, st) {
    const tile = def.tiles[0], u0 = TILE_U0[tile], u1 = TILE_U1[tile], v0 = TILE_V0[tile], v1 = TILE_V1[tile];
    const isSakura = !!def.sakuraLeaf, isBlue = !!def.blueLeaf, isNeutral = !!def.neutralLeaf, isGlass = !!def.glass;
    const cullSame = (sodiumOpts.moreCulling || shaderQuality !== 'ultra' || isGlass);
    if (cullSame && lx > 0 && lx < 15 && lz > 0 && lz < 15 && ly > 0 && ly < WORLD_H - 1) {
      const cIdx = (ly << 8) | (lz << 4) | lx;
      const n0 = data[cIdx + 1], n1 = data[cIdx - 1], n2 = data[cIdx + 256], n3 = data[cIdx - 256], n4 = data[cIdx + 16], n5 = data[cIdx - 16];
      if ((IS_OPAQUE[n0] === 1 || n0 === id) && (IS_OPAQUE[n1] === 1 || n1 === id) &&
          (IS_OPAQUE[n2] === 1 || n2 === id) && (IS_OPAQUE[n3] === 1 || n3 === id) &&
          (IS_OPAQUE[n4] === 1 || n4 === id) && (IS_OPAQUE[n5] === 1 || n5 === id)) return;
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
      if (IS_OPAQUE[nb] === 1 || (cullSame && nb === id)) continue;
      if (IS_SOLID[nb] === 0) anyExposed = true;
      if (st.lCount + 4 > _lCap) _growLeafScratch(st.lCount + 4);
      const isInner = (nb === id);
      const shadeMul = isGlass ? 1.0 : ((isSakura || isBlue || isNeutral)
        ? ((f === 0 ? 1.03 : (f === 1 ? 0.92 : 0.98)) * (isInner ? 0.95 : 1.0))
        : ((f === 0 ? 1.03 : (f === 1 ? 0.89 : 0.97)) * (isInner ? 0.94 : 1.0)));
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
    // Motschen's Better Leaves: shadow-free fluffy crossed outer-silhouette leaf cards on exposed non-glass canopies
    if (!isGlass && anyExposed && computeAO) {
      if (st.lxCount + 8 > _lxCap) _growLeafCrossScratch(st.lxCount + 8);
      const hJ = hash3i(wx, wy, wz, 731);
      const ang = (hJ - 0.5) * 0.55;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ext = 0.62, yLo = -0.10, yHi = 1.12;
      const jx = (hash3i(wx + 3, wy, wz, 911) - 0.5) * 0.08;
      const jz = (hash3i(wx, wy, wz + 5, 919) - 0.5) * 0.08;
      const cxB = wx + 0.5 + jx, czB = wz + 0.5 + jz;
      const xTint = tint * 0.99;
      const r0 = Math.min(1.12, xTint * baseR), g0 = Math.min(1.12, xTint * baseG), b0 = Math.min(1.12, xTint * baseB);
      for (let q = 0; q < 2; q++) {
        const dx1 = (q === 0 ? (ca - sa) : (ca + sa)) * ext * 0.72;
        const dz1 = (q === 0 ? (sa + ca) : (sa - ca)) * ext * 0.72;
        const xA = cxB - dx1, zA = czB - dz1, xB = cxB + dx1, zB = czB + dz1;
        let vp = st.lxCount * 3, up = st.lxCount * 2;
        const corners = [[xA, wy + yLo, zA], [xB, wy + yLo, zB], [xB, wy + yHi, zB], [xA, wy + yHi, zA]];
        for (let c = 0; c < 4; c++) {
          _lxPos[vp] = corners[c][0]; _lxPos[vp+1] = corners[c][1]; _lxPos[vp+2] = corners[c][2];
          _lxNorm[vp] = 0; _lxNorm[vp+1] = 1.0; _lxNorm[vp+2] = 0;
          _lxCols[vp] = r0; _lxCols[vp+1] = g0; _lxCols[vp+2] = b0;
          _lxBL[vp] = tuftLr; _lxBL[vp+1] = tuftLg; _lxBL[vp+2] = tuftLb;
          vp += 3;
        }
        _lxUvs[up]=u0; _lxUvs[up+1]=v1; _lxUvs[up+2]=u1; _lxUvs[up+3]=v1; _lxUvs[up+4]=u1; _lxUvs[up+5]=v0; _lxUvs[up+6]=u0; _lxUvs[up+7]=v0;
        const ip = st.lxiCount, lc = st.lxCount;
        _lxIdx[ip]=lc; _lxIdx[ip+1]=lc+1; _lxIdx[ip+2]=lc+2; _lxIdx[ip+3]=lc; _lxIdx[ip+4]=lc+2; _lxIdx[ip+5]=lc+3;
        st.lxCount = lc + 4; st.lxiCount = ip + 6;
      }
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
      const bx = [x0, x1], by = [y0, y1], bz = [z0, z1];
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        if (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + face.dir[0], ly + face.dir[1], lz + face.dir[2]) === id) continue;
        for (let c = 0; c < 4; c++) {
          const cr = face.corners[c];
          ptPos.push(wx + bx[cr[0]], wy + by[cr[1]], wz + bz[cr[2]]);
          ptKind.push(pKind);
        }
        ptUvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
        ptIndices.push(st.ptCount, st.ptCount + 1, st.ptCount + 2, st.ptCount, st.ptCount + 2, st.ptCount + 3); st.ptCount += 4;
      }
    };
    if (id === B.END_GATEWAY) {
      emitPortalBox(0.04, 0.04, 0.04, 0.96, 0.96, 0.96, 2.0);
    } else if (id === B.END_PORTAL) {
      const aboveB = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly + 1, lz), belowB = _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly - 1, lz);
      const isUpright = (aboveB === B.END_PORTAL || aboveB === B.OBSIDIAN) && (belowB === B.END_PORTAL || belowB === B.OBSIDIAN);
      if (!isUpright) emitPortalBox(0.0, 0.72, 0.0, 1.0, 0.80, 1.0, 2.0);
      else {
        const hasX = (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) === B.OBSIDIAN || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) === B.OBSIDIAN);
        const hasZ = (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) === B.OBSIDIAN || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) === B.OBSIDIAN);
        const alongZ = hasZ && !hasX;
        emitPortalBox(alongZ ? 0.45 : 0.0, 0.0, alongZ ? 0.0 : 0.45, alongZ ? 0.55 : 1.0, 1.0, alongZ ? 1.0 : 0.55, 2.0);
      }
    } else {
      const fId = (id === B.DREAM_PORTAL) ? B.DREAM_PORTAL_FRAME : (id === B.WARDEN_PORTAL ? B.REINFORCED_DEEPSLATE : B.OBSIDIAN);
      const pKind = (id === B.WARDEN_PORTAL) ? 3.0 : (id === B.DREAM_PORTAL ? 1.0 : 0.0);
      const hasX = (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx - 1, ly, lz) === fId || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx + 1, ly, lz) === fId);
      const hasZ = (_getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) === id || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz - 1) === fId || _getFastBlock(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz + 1) === fId);
      const alongZ = hasZ && !hasX;
      emitPortalBox(alongZ ? 0.45 : 0.0, 0.0, alongZ ? 0.0 : 0.45, alongZ ? 0.55 : 1.0, 1.0, alongZ ? 1.0 : 0.55, pKind);
    }
  }

  const _chAutumnCell = new Int8Array(16);
  function rebuildChunkMesh(ch) {
    const cx = ch.cx, cz = ch.cz, wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W, data = ch.data;
    _chAutumnCell.fill(-1);
    const _autPodDef = BLOCK_DEF_ARR[B.AUTUMN_PODZOL];
    const thisChKey = chunkKey(cx, cz);
    if (ch._pendingSlice) {
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
    if (typeof markChunkExplored === 'function') markChunkExplored(ch);
    const dXP = chunks.get(chunkKey(cx + 1, cz))?.data || null, dXM = chunks.get(chunkKey(cx - 1, cz))?.data || null;
    const dZP = chunks.get(chunkKey(cx, cz + 1))?.data || null, dZM = chunks.get(chunkKey(cx, cz - 1))?.data || null;

    const maxLy = Math.min(WORLD_H - 1, ch.maxLy);
    const emLen = _scanChunkEmitters(ch, cx, cz, wx0, wz0, data, maxLy);
    const hasFluidLevels = (fluidLevel.size > 0);
    const computeAO = (shaderQuality !== 'low' || (typeof sodiumOpts !== 'undefined' && !!sodiumOpts.rayTracing));

    const ePos = _ePos, eUvs = _eUvs, eType = _eType, eIndices = _eIndices;
    const ptPos = _ptPos, ptUvs = _ptUvs, ptKind = _ptKind, ptIndices = _ptIndices;
    const pPos = _pPos, pNorm = _pNorm, pUvs = _pUvs, pSway = _pSway, pSkyShade = _pSkyShade, pBLights = _pBLights, pIndices = _pIndices;
    ePos.length = 0; eUvs.length = 0; eType.length = 0; eIndices.length = 0;
    ptPos.length = 0; ptUvs.length = 0; ptKind.length = 0; ptIndices.length = 0;
    pPos.length = 0; pNorm.length = 0; pUvs.length = 0; pSway.length = 0; pSkyShade.length = 0; pBLights.length = 0; pIndices.length = 0;
    const st = _meshSt;
    st.vCount = 0; st.iCount = 0; st.lCount = 0; st.liCount = 0; st.lxCount = 0; st.lxiCount = 0; st.eCount = 0; st.ptCount = 0; st.wCount = 0; st.wiCount = 0; st.lvCount = 0; st.lviCount = 0; st.pCount = 0;
    const cullBottomBedrock = (sodiumOpts.moreCulling && currentDimension !== 'end');
    const _cXP = chunks.get(chunkKey(cx + 1, cz)), _cXM = chunks.get(chunkKey(cx - 1, cz));
    const _cZP = chunks.get(chunkKey(cx, cz + 1)), _cZM = chunks.get(chunkKey(cx, cz - 1));
    const _allOceanNbr = !!(ch.isOceanChunk && _cXP && _cXP.isOceanChunk && _cXM && _cXM.isOceanChunk && _cZP && _cZP.isOceanChunk && _cZM && _cZM.isOceanChunk);

    for (let ly = 0; ly <= maxLy; ly++) {
      _wDepthGen = (_wDepthGen + 1) >>> 0;
      if (_wDepthGen === 0) { _wDepthStamp.fill(0); _wDepthGen = 1; }
      const wy = MIN_Y + ly, yOff = ly << 8;
      // Sodium: uniform air or interior ocean-water Y-layer skip
      const _uniId = data[yOff];
      if (_uniId === 0 || (_uniId === B.WATER && _allOceanNbr && !hasFluidLevels && ly > 0 && (wy - (depthOffset || 0)) < WATER_LEVEL)) {
        let _allSame = true;
        for (let _k = 1; _k < 256; _k++) { if (data[yOff | _k] !== _uniId) { _allSame = false; break; } }
        if (_allSame) continue;
      }
      let sliceLen = 0, sMinX = 999, sMaxX = -999, sMinZ = 999, sMaxZ = -999;
      if (emLen > 0) {
        const cyMid = ly + 0.5;
        for (let ei = 0; ei < emLen; ei += 7) {
          const dy = cyMid - _emBuf[ei + 1], rad2 = _emBuf[ei + 6];
          if (dy * dy <= rad2 + 48.0) {
            const ex = _emBuf[ei], ez = _emBuf[ei + 2], rPad = Math.sqrt(rad2) + 1.5;
            _sliceEmBuf[sliceLen] = ex; _sliceEmBuf[sliceLen+1] = _emBuf[ei+1]; _sliceEmBuf[sliceLen+2] = ez;
            _sliceEmBuf[sliceLen+3] = _emBuf[ei+3]; _sliceEmBuf[sliceLen+4] = _emBuf[ei+4]; _sliceEmBuf[sliceLen+5] = _emBuf[ei+5]; _sliceEmBuf[sliceLen+6] = rad2;
            sliceLen += 7;
            if (ex - rPad < sMinX) sMinX = ex - rPad;
            if (ex + rPad > sMaxX) sMaxX = ex + rPad;
            if (ez - rPad < sMinZ) sMinZ = ez - rPad;
            if (ez + rPad > sMaxZ) sMaxZ = ez + rPad;
          }
        }
        _sliceMinX = sMinX; _sliceMaxX = sMaxX; _sliceMinZ = sMinZ; _sliceMaxZ = sMaxZ;
      }
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

          // Cold / special blocks path (exact original dispatch precedence)
          if (flags & BLK_WATER_SEA) {
            _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, id, hasFluidLevels, _wBuf, st);
            if (id === B.WATER) continue;
          }
          if (flags & BLK_LAVA) {
            _meshLavaVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, hasFluidLevels, _lvBuf, st);
            continue;
          }
          const def = BLOCK_DEF_ARR[id]; if (!def) continue;
          if (flags & BLK_CROSS) {
            _meshCrossPlantVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, maxLy, sliceLen, ePos, eUvs, eType, eIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st);
            continue;
          }
          if (flags & BLK_TORCH) {
            _meshTorchVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, ePos, eUvs, eType, eIndices, st);
            continue;
          }
          if (flags & BLK_LANTERN) {
            _meshLanternVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, ePos, eUvs, eType, eIndices, st, id);
            continue;
          }
          if (flags & BLK_HANG) {
            _meshHangingFruitVoxel(lx, ly, lz, wx, wy, wz, def, sliceLen, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st);
            continue;
          }
          if ((flags & (BLK_SOLID | BLK_PORTAL | BLK_SUB)) === 0) continue;
          if (flags & BLK_ANIM) {
            if (waterloggedBlocks.size > 0 && waterloggedBlocks.has(modKey(wx, wy, wz))) {
              _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, B.WATER, hasFluidLevels, _wBuf, st);
            }
            createAnimatedBlockVisual(wx, wy, wz, id, thisChKey);
            continue;
          }
          if (flags & BLK_SUB) {
            if ((waterloggedBlocks.size > 0 && waterloggedBlocks.has(modKey(wx, wy, wz))) || (def.rootCage && wy <= WATER_LEVEL)) {
              _meshWaterVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, zOff, lx, ly, lz, wx, wy, wz, B.WATER, hasFluidLevels, _wBuf, st);
            }
            _meshSubBlockVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, sliceLen, ePos, eUvs, eType, eIndices, pPos, pNorm, pUvs, pSway, pSkyShade, pBLights, pIndices, st);
            continue;
          }
          if (flags & BLK_FOLIAGE) {
            _meshFoliageVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, computeAO, sliceLen, st);
            continue;
          }
          if ((flags & (BLK_EMISSIVE | BLK_GLASS)) === 0) {
            if (inY && inZ && lx > 0 && lx < 15) {
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
          }
          if (flags & (BLK_CRYSTAL | BLK_PORTAL)) {
            _meshCrystalOrPortalVoxel(data, dXP, dXM, dZP, dZM, wx0, wz0, lx, ly, lz, wx, wy, wz, id, def, ePos, eUvs, eType, eIndices, ptPos, ptUvs, ptKind, ptIndices, st);
            continue;
          }

          // Remaining full cubes (glass, emissive solid cubes)
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
    if (st.vCount > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(_sPos.slice(0, st.vCount * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(_sNorm.slice(0, st.vCount * 3), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(_sUvs.slice(0, st.vCount * 2), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(_sCols.slice(0, st.vCount * 3), 3));
      geo.setAttribute('aBlockLight', new THREE.BufferAttribute(_sBL.slice(0, st.vCount * 3), 3));
      geo.setIndex(_makeIdxAttr(_sIdx, st.iCount, st.vCount));
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
      ch.leavesMesh = new THREE.Mesh(lGeo, _effLow ? leavesMatLow : leavesMat);
      if (_effUltra) ch.leavesMesh.customDepthMaterial = leavesDepthMat;
      const nearLeafSh = (_shChunkRad >= 0) && (Math.max(Math.abs(cx - (Math.floor(player.x) >> 4)), Math.abs(cz - (Math.floor(player.z) >> 4))) <= Math.min(_shChunkRad, 2));
      ch.leavesMesh.castShadow = (_effUltra && nearLeafSh); ch.leavesMesh.receiveShadow = false; ch.leavesMesh.frustumCulled = true;
      ch.leavesMesh.matrixAutoUpdate = false; ch.leavesMesh.updateMatrix();
      scene.add(ch.leavesMesh);
    }
    if (st.lxCount > 0 && !_effLow) {
      const lxGeo = new THREE.BufferGeometry();
      lxGeo.setAttribute('position', new THREE.BufferAttribute(_lxPos.slice(0, st.lxCount * 3), 3));
      lxGeo.setAttribute('normal', new THREE.BufferAttribute(_lxNorm.slice(0, st.lxCount * 3), 3));
      lxGeo.setAttribute('uv', new THREE.BufferAttribute(_lxUvs.slice(0, st.lxCount * 2), 2));
      lxGeo.setAttribute('color', new THREE.BufferAttribute(_lxCols.slice(0, st.lxCount * 3), 3));
      lxGeo.setAttribute('aBlockLight', new THREE.BufferAttribute(_lxBL.slice(0, st.lxCount * 3), 3));
      lxGeo.setIndex(_makeIdxAttr(_lxIdx, st.lxiCount, st.lxCount));
      _assignChunkBounds(lxGeo, wx0, wz0, maxLy);
      ch.leavesCrossMesh = new THREE.Mesh(lxGeo, leavesMat);
      ch.leavesCrossMesh.castShadow = false; ch.leavesCrossMesh.receiveShadow = false; ch.leavesCrossMesh.frustumCulled = true;
      ch.leavesCrossMesh.matrixAutoUpdate = false; ch.leavesCrossMesh.updateMatrix();
      scene.add(ch.leavesCrossMesh);
    }
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
    if (st.ptCount > 0) {
      const ptGeo = new THREE.BufferGeometry();
      ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(ptPos, 3));
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
      ch.plantMesh.castShadow = false; ch.plantMesh.receiveShadow = false; ch.plantMesh.frustumCulled = true;
      ch.plantMesh.matrixAutoUpdate = false; ch.plantMesh.updateMatrix();
      scene.add(ch.plantMesh);
    }
    const wasUrgent = ch.urgentDirty;
    ch.dirty = false;
    ch.urgentDirty = false;
    ch.borderDirty = false;
    ch.meshed = true;
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

