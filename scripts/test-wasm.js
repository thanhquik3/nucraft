'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { B } = require('../shared/blocks.js');
const { CHUNK_W, MIN_Y, WORLD_H, MAX_Y, WATER_LEVEL } = require('../shared/constants.js');

const ROOT = path.resolve(__dirname, '..');
const WASM_PATH = path.join(ROOT, 'assets', 'nucraft_core.wasm');

// Exact reference JS functions matching src/world/chunkWorker.js & src/world/Chunk.js
function jsHash2i(x, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10;
}
function jsHash3i(x, y, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10;
}
function jsValueNoise2D(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = jsHash2i(xi, zi, seed), b = jsHash2i(xi + 1, zi, seed);
  const c = jsHash2i(xi, zi + 1, seed), d = jsHash2i(xi + 1, zi + 1, seed);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
function jsValueNoise3D(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const x00 = jsHash3i(xi, yi, zi, seed) + (jsHash3i(xi + 1, yi, zi, seed) - jsHash3i(xi, yi, zi, seed)) * u;
  const x10 = jsHash3i(xi, yi + 1, zi, seed) + (jsHash3i(xi + 1, yi + 1, zi, seed) - jsHash3i(xi, yi + 1, zi, seed)) * u;
  const x01 = jsHash3i(xi, yi, zi + 1, seed) + (jsHash3i(xi + 1, yi, zi + 1, seed) - jsHash3i(xi, yi, zi + 1, seed)) * u;
  const x11 = jsHash3i(xi, yi + 1, zi + 1, seed) + (jsHash3i(xi + 1, yi + 1, zi + 1, seed) - jsHash3i(xi, yi + 1, zi + 1, seed)) * u;
  return (x00 + (x10 - x00) * v) + ((x01 + (x11 - x01) * v) - (x00 + (x10 - x00) * v)) * w;
}
function jsFbm2D(x, z, octaves, persistence, lacunarity, seed) {
  let val = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += jsValueNoise2D(x * freq, z * freq, seed + i * 97) * amp;
    maxAmp += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return val / maxAmp;
}
function jsComputeCoarseCaveGrid(wx0, wz0, mix, dOff, minY, out) {
  let p = 0;
  const ox = mix.ox, oy = mix.oy, oz = mix.oz;
  for (let gy = 0; gy < 65; gy++) {
    const wy = minY + gy * 4;
    const trueY = wy - dOff;
    const depthBoost = Math.min(0.13, Math.max(0, (-trueY - 12) * 0.00038));
    const strataMorph = jsValueNoise3D((wx0 + ox) * 0.006, trueY * 0.009, (wz0 + oz) * 0.006, mix.c3);
    const scaleMod = 0.84 + strataMorph * 0.36;
    for (let gz = 0; gz < 5; gz++) {
      const wz = wz0 + gz * 4;
      for (let gx = 0; gx < 5; gx++) {
        const wx = wx0 + gx * 4;
        const warpX = (jsValueNoise3D((wx + ox) * 0.019, (trueY + oy) * 0.024, (wz + oz) * 0.019, mix.c4) - 0.5) * 16.0;
        const warpY = (jsValueNoise3D((wx + ox) * 0.016 - 23.4, (trueY + oy) * 0.020, (wz + oz) * 0.016 + 31.1, mix.c2 + 13) - 0.5) * 9.0;
        const warpZ = (jsValueNoise3D((wx + ox) * 0.019 + 47.3, (trueY + oy) * 0.024 - 19.7, (wz + oz) * 0.019 + 11.2, mix.c4 + 31) - 0.5) * 16.0;
        const qx = (wx + warpX) * scaleMod + ox * 0.5;
        const qy = (trueY + warpY) + oy * 0.5;
        const qz = (wz + warpZ) * scaleMod + oz * 0.5;
        const ch1 = jsValueNoise3D(qx * 0.025, qy * 0.035, qz * 0.025, mix.c1);
        const ch2 = jsValueNoise3D(qx * 0.054 + 19.2, qy * 0.068 - 11.4, qz * 0.054 + 7.8, mix.c1 + 43);
        const cheese = ch1 * 0.72 + ch2 * 0.28;
        const pillar = jsValueNoise2D((wx + ox) * 0.095, (wz + oz) * 0.095, mix.c3);
        const cheeseVal = cheese - (pillar > 0.76 ? (pillar - 0.76) * 1.25 : 0.0);
        const spA = Math.abs(jsValueNoise3D(qx * 0.044, qy * 0.056, qz * 0.044, mix.c2) - 0.5);
        const spB = Math.abs(jsValueNoise3D(qx * 0.047 + 73.1, qy * 0.055 - 41.9, qz * 0.047 + 29.4, mix.c3) - 0.5);
        const spaghetti = Math.max(0, 1.0 - (spA + spB) * 5.0);
        const ravMask = jsValueNoise3D((wx + ox) * 0.009, (trueY + oy) * 0.008, (wz + oz) * 0.009, mix.c1 + 77);
        const ravLine = Math.abs(jsValueNoise2D(qx * 0.024, qz * 0.024, mix.c2 + 53) - 0.5);
        const ravine = (ravMask > 0.55 && ravLine < 0.048) ? (0.88 - ravLine * 5.6) : 0.0;
        const noodle = jsValueNoise3D(qx * 0.072, qy * 0.088, qz * 0.072, mix.c4 + 19);
        out[p++] = Math.max(
          cheeseVal * 0.96 + noodle * 0.15 + depthBoost,
          spaghetti * 0.94 + noodle * 0.13 + depthBoost * 0.65,
          ravine
        );
      }
    }
  }
}
function jsEvalLightSlice(lx, ly, lz, sliceBuf, sliceLen, out) {
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

// Reference JS solid chunk mesher (matching Chunk.js lines 2478-2603)
const JS_FACES = [
  { dir: [0, 1, 0],  tileIdx: 0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], uAxis:[1,0,0], vAxis:[0,0,-1] },
  { dir: [0, -1, 0], tileIdx: 2, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uAxis:[1,0,0], vAxis:[0,0,1]  },
  { dir: [1, 0, 0],  tileIdx: 1, corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], uAxis:[0,0,-1],vAxis:[0,1,0]  },
  { dir: [-1, 0, 0], tileIdx: 1, corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], uAxis:[0,0,1], vAxis:[0,1,0]  },
  { dir: [0, 0, 1],  tileIdx: 1, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], uAxis:[1,0,0], vAxis:[0,1,0]  },
  { dir: [0, 0, -1], tileIdx: 1, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], uAxis:[-1,0,0],vAxis:[0,1,0]  }
];
const JS_AO_LUT = [1.0, 0.84, 0.68, 0.50];

function jsMeshSolidChunk(data, border, opaque, flags, blockTiles, tileUv, autumnCell, emitters, emLen, wx0, wz0, maxLy, computeAO, grassId, podzolId, blkSolidFlag) {
  const pos = [], norm = [], uv = [], col = [], bl = [], idx = [], spec = [];
  const sliceEm = new Float32Array(3584), tmpL = new Float32Array(3);
  const sampleB = (lx, ly, lz) => {
    if (ly < 0) return B.BEDROCK;
    if (ly >= WORLD_H) return 0;
    if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) return data[(ly << 8) | (lz << 4) | lx];
    if (lx === 16 && lz >= 0 && lz < 16) return border[(ly << 4) | lz];
    if (lx === -1 && lz >= 0 && lz < 16) return border[4096 + ((ly << 4) | lz)];
    if (lz === 16 && lx >= 0 && lx < 16) return border[8192 + ((ly << 4) | lx)];
    if (lz === -1 && lx >= 0 && lx < 16) return border[12288 + ((ly << 4) | lx)];
    if (lx === 16 && lz === 16) return border[16384 + ly];
    if (lx === 16 && lz === -1) return border[16640 + ly];
    if (lx === -1 && lz === 16) return border[16896 + ly];
    if (lx === -1 && lz === -1) return border[17152 + ly];
    return 0;
  };
  let vc = 0;
  for (let ly = 0; ly <= maxLy; ly++) {
    const wy = MIN_Y + ly, yOff = ly << 8;
    const uni = data[yOff];
    if (uni === 0) {
      let same = true;
      for (let k = 1; k < 256; k++) if (data[yOff | k] !== 0) { same = false; break; }
      if (same) continue;
    }
    let sliceLen = 0, sMinX = 999, sMaxX = -999, sMinZ = 999, sMaxZ = -999;
    if (emLen > 0) {
      const cyMid = ly + 0.5;
      for (let ei = 0; ei < emLen; ei += 7) {
        const dy = cyMid - emitters[ei + 1], rad2 = emitters[ei + 6];
        if (dy * dy <= rad2 + 48.0) {
          const ex = emitters[ei], ez = emitters[ei + 2], rPad = Math.sqrt(rad2) + 1.5;
          sliceEm.set(emitters.subarray(ei, ei + 7), sliceLen);
          sliceLen += 7;
          if (ex - rPad < sMinX) sMinX = ex - rPad;
          if (ex + rPad > sMaxX) sMaxX = ex + rPad;
          if (ez - rPad < sMinZ) sMinZ = ez - rPad;
          if (ez + rPad > sMaxZ) sMaxZ = ez + rPad;
        }
      }
    }
    for (let lz = 0; lz < 16; lz++) {
      const zOff = yOff | (lz << 4), wz = wz0 + lz;
      for (let lx = 0; lx < 16; lx++) {
        const cIdx = zOff | lx, id = data[cIdx];
        if (id === 0) continue;
        if (flags[id] !== blkSolidFlag) { spec.push(cIdx); continue; }
        if (blockTiles[id * 5] === 0xffff) continue;
        if (opaque[sampleB(lx + 1, ly, lz)] && opaque[sampleB(lx - 1, ly, lz)] &&
            opaque[sampleB(lx, ly + 1, lz)] && opaque[sampleB(lx, ly - 1, lz)] &&
            opaque[sampleB(lx, ly, lz + 1)] && opaque[sampleB(lx, ly, lz - 1)]) continue;
        const useId = (id === grassId && autumnCell[((lz >> 2) << 2) | (lx >> 2)] === 1) ? podzolId : id;
        const tb = useId * 5, ft = blockTiles[tb + 3], bz = blockTiles[tb + 4] !== 0, wx = wx0 + lx;
        for (let f = 0; f < 6; f++) {
          const fc = JS_FACES[f], dx = fc.dir[0], dy = fc.dir[1], dz = fc.dir[2];
          const nlx = lx + dx, nly = ly + dy, nlz = lz + dz;
          if (opaque[sampleB(nlx, nly, nlz)]) continue;
          let lr = 0, lg = 0, lb = 0;
          if (sliceLen > 0 && !(nlx + 0.5 < sMinX || nlx + 0.5 > sMaxX || nlz + 0.5 < sMinZ || nlz + 0.5 > sMaxZ)) {
            jsEvalLightSlice(nlx + 0.5, nly + 0.5, nlz + 0.5, sliceEm, sliceLen, tmpL);
            lr = tmpL[0]; lg = tmpL[1]; lb = tmpL[2];
          }
          const aos = [1, 1, 1, 1];
          if (computeAO) {
            for (let c = 0; c < 4; c++) {
              const su = (c === 1 || c === 2) ? 1 : -1, sv = (c === 2 || c === 3) ? 1 : -1;
              const ux = fc.uAxis[0] * su, uy = fc.uAxis[1] * su, uz = fc.uAxis[2] * su;
              const vx = fc.vAxis[0] * sv, vy = fc.vAxis[1] * sv, vz = fc.vAxis[2] * sv;
              const s1 = opaque[sampleB(nlx + ux, nly + uy, nlz + uz)];
              const s2 = opaque[sampleB(nlx + vx, nly + vy, nlz + vz)];
              const cn = opaque[sampleB(nlx + ux + vx, nly + uy + vy, nlz + uz + vz)];
              aos[c] = (s1 && s2) ? 0.50 : JS_AO_LUT[s1 + s2 + cn];
            }
          }
          for (let c = 0; c < 4; c++) {
            const cr = fc.corners[c];
            pos.push(wx + cr[0], wy + cr[1], wz + cr[2]);
            norm.push(dx, dy, dz);
            col.push(aos[c], aos[c], aos[c]);
            bl.push(lr, lg, lb);
          }
          const tile = (ft !== 0xffff && (dz === 1 || (bz && dz === -1))) ? ft : blockTiles[tb + fc.tileIdx];
          const u0 = tileUv[tile * 4], u1 = tileUv[tile * 4 + 1], v0 = tileUv[tile * 4 + 2], v1 = tileUv[tile * 4 + 3];
          uv.push(u0, v1, u1, v1, u1, v0, u0, v0);
          if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
          else idx.push(vc + 1, vc + 2, vc + 3, vc + 1, vc + 3, vc);
          vc += 4;
        }
      }
    }
  }
  return { vCount: vc, iCount: idx.length, pos, norm, uv, col, bl, idx, spec };
}

// Reference JS Overworld Biome & Height (matching Chunk.js lines 292-618, 747-765)
const B_IDS = {
  PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, SAKURA: 4, SWAMP: 5, MESA: 6, AUTUMN: 7,
  LUSH_GROVE: 8, FLOWER_MEADOW: 9, TAIGA: 10, BEACH_PALM: 15, MANGROVE_SWAMP: 16,
  ALPINE_PEAKS: 17, HIGHLAND_PLATEAU: 18, DEEP_OCEAN: 19, BAMBOO_JUNGLE: 20,
  MUSHROOM_ISLAND: 21, LAVENDER_MEADOW: 22, VOLCANIC_BASALT: 23, ABANDONED_CITY: 24,
  REDWOOD_ANCIENT: 25, WEEPING_GROVE: 26, BIRCH_ANCIENT: 27, AUTUMN_GOLDEN: 28,
  AUTUMN_DEEP: 29, ABYSS_TRENCH: 30, GLOWSHROOM_GROVE: 31, DAPPLED_FOREST: 32,
  BADLANDS_SPIRES: 33, BADLANDS_CRATER: 34, MARSH_RUINS: 35, TROPICAL_COAST: 36,
  GIANT_TREES: 37, MANOR_GARDEN: 38, BLUE_FOREST: 50, WHEAT_VALLEY: 51, PINE_VALLEY: 52,
  GIANT_JUNGLE: 53, CLOUD_PEAKS: 54, DARK_FOREST: 55, PALE_GARDEN: 56, NIGHTMARE_WOODS: 57,
  MEGA_SNOW_PEAKS: 58, LUSH_STEPPE: 59, GREEN_PLAINS: 68, SNOWY_PLAINS: 69, GRAND_RUINS: 72,
  SULFUR_SPRINGS: 78
};
function jsGetOceanMacro(wx, wz, seed) {
  const a = Math.imul((seed || 1) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const b = Math.imul((seed || 1) ^ 0xc2b2ae35, 0x27d4eb2f) >>> 0;
  const dSp = Math.hypot(wx - ((a % 3600) - 1800), wz - ((b % 3600) - 1800));
  const spawnLift = dSp < 580 ? Math.max(0, 1.0 - dSp / 580) * 0.44 : 0.0;
  const macro = jsFbm2D(wx * 0.000105, wz * 0.000105, 3, 0.52, 2.0, seed + 4111);
  const coastJitter = (jsFbm2D(wx * 0.0014, wz * 0.0014, 2, 0.5, 2.0, seed + 411) - 0.5) * 0.14;
  const seaVal = macro + coastJitter + spawnLift;
  const isOcean = seaVal < 0.47;
  const openness = isOcean ? Math.max(0, Math.min(1, (0.47 - seaVal) / 0.22)) : 0;
  const ridge = jsFbm2D(wx * 0.0011, wz * 0.0011, 2, 0.5, 2.0, seed + 4157);
  return { isOcean, openness, trenchFactor: Math.max(0, 1.0 - Math.abs(ridge - 0.5) * 3.8) };
}
function jsGetOceanIsland(wx, wz, openness, seed) {
  if (openness <= 0.08) return null;
  const CELL = 224, gx = Math.floor(wx / CELL), gz = Math.floor(wz / CELL);
  if (jsHash2i(gx, gz, seed + 6421) > 0.38) return null;
  const ix = (gx + 0.24 + jsHash2i(gx, gz, seed + 6427) * 0.52) * CELL;
  const iz = (gz + 0.24 + jsHash2i(gx, gz, seed + 6449) * 0.52) * CELL;
  const rad = 16 + jsHash2i(gx, gz, seed + 6451) * 24;
  const dist = Math.hypot(wx - ix, wz - iz);
  if (dist > rad * 1.9) return null;
  const ang = Math.atan2(wz - iz, wx - ix);
  const shoreWarp = (jsValueNoise2D(wx * 0.075, wz * 0.075, seed + 6469) - 0.5) * 0.26 + Math.sin(ang * 3 + gx) * 0.06;
  const normDist = dist / rad + shoreWarp;
  if (normDist > 1.65) return null;
  const kr = jsHash2i(gx, gz, seed + 6473);
  let kind = 'palm', biome = B_IDS.BEACH_PALM;
  if (kr < 0.24) { kind = 'palm'; biome = B_IDS.BEACH_PALM; }
  else if (kr < 0.44) { kind = 'tropical'; biome = B_IDS.TROPICAL_COAST; }
  else if (kr < 0.60) { kind = 'mushroom'; biome = B_IDS.MUSHROOM_ISLAND; }
  else if (kr < 0.74) { kind = 'volcanic'; biome = B_IDS.VOLCANIC_BASALT; }
  else if (kr < 0.88) { kind = 'sakura'; biome = B_IDS.SAKURA; }
  else { kind = 'atoll'; biome = B_IDS.BEACH_PALM; }
  const det = jsValueNoise2D(wx * 0.09, wz * 0.09, seed + 6481), inIsland = normDist < 1.0;
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
function jsGetOceanFloorY(wx, wz, biome, seed) {
  const m = jsGetOceanMacro(wx, wz, seed), isl = jsGetOceanIsland(wx, wz, m.openness, seed);
  if (isl && isl.inIsland) return isl.elevY;
  const cont = jsFbm2D(wx * 0.011, wz * 0.011, 2, 0.52, 2.05, seed);
  const det = jsValueNoise2D(wx * 0.052, wz * 0.052, seed + 404);
  let floorY;
  if (m.openness < 0.14) floorY = -5 - (m.openness / 0.14) * 27 + (cont - 0.5) * 6 + det * 2.0;
  else {
    const op = (m.openness - 0.14) / 0.86;
    const abyss = Math.pow(op, 1.05) * 428;
    const hadal = (m.trenchFactor > 0.35 && op > 0.38) ? Math.pow((m.trenchFactor - 0.35) / 0.65, 1.15) * ((op - 0.38) / 0.62) * 255 : 0;
    floorY = -32 - abyss - hadal + (cont - 0.5) * 24 + det * 3.5;
  }
  if (!m.isOcean && biome === B_IDS.DEEP_OCEAN) floorY = Math.max(floorY, -26);
  floorY = Math.max(-700, Math.min(-3, Math.round(floorY)));
  if (isl && isl.inSeamount) {
    const t = Math.max(0, Math.min(1, (isl.normDist - 1.0) / 0.65)), sm = t * t * (3 - 2 * t);
    const smTop = isl.kind === 'atoll' ? -3 : -2;
    floorY = Math.round(smTop + (floorY - smTop) * sm);
  }
  return Math.max(-700, Math.min(-2, floorY));
}
function jsOverworldBiomeAt(wx, wz, seed) {
  if (wx >= 9000 && wx < 11000 && wz >= 9000 && wz < 11000) return B_IDS.WHEAT_VALLEY;
  if (wx >= 2000 && wx <= 7000 && wz >= 2000 && wz <= 7000) return B_IDS.ABANDONED_CITY;
  if (wx >= -3504 && wx <= -2497 && wz >= -3504 && wz <= -2497) return B_IDS.GRAND_RUINS;
  const oMac = jsGetOceanMacro(wx, wz, seed);
  if (oMac.isOcean) {
    const isl = jsGetOceanIsland(wx, wz, oMac.openness, seed);
    if (isl && isl.inIsland) return isl.biome;
    return (oMac.openness > 0.34 || oMac.trenchFactor > 0.55) ? B_IDS.ABYSS_TRENCH : B_IDS.DEEP_OCEAN;
  }
  const warpX = (jsValueNoise2D(wx * 0.0016, wz * 0.0016, seed + 511) - 0.5) * 140.0;
  const warpZ = (jsValueNoise2D(wx * 0.0016 + 19.7, wz * 0.0016 - 23.1, seed + 523) - 0.5) * 140.0;
  const bx = wx + warpX, bz = wz + warpZ;
  const coast = jsFbm2D(bx * 0.00055, bz * 0.00055, 2, 0.5, 2.0, seed + 411);
  const humid = jsFbm2D(bx * 0.00048 + 3.1, bz * 0.00048 - 2.7, 2, 0.5, 2.0, seed + 202);
  const heat = jsFbm2D(bx * 0.00045 - 4.3, bz * 0.00045 + 5.9, 2, 0.5, 2.0, seed + 101);
  const spookyBand = jsFbm2D(bx * 0.00095 + 11.1, bz * 0.00095 - 7.3, 2, 0.5, 2.0, seed + 677);
  if (coast < 0.14 && humid > 0.62) return B_IDS.MUSHROOM_ISLAND;
  if (coast < 0.14) return B_IDS.DEEP_OCEAN;
  if (coast < 0.21 && humid > 0.60) return B_IDS.MARSH_RUINS;
  if (coast < 0.23) return B_IDS.DEEP_OCEAN;
  if (coast < 0.30 && heat > 0.60) return B_IDS.TROPICAL_COAST;
  if (coast < 0.30 && heat > 0.35) return B_IDS.BEACH_PALM;
  const elev = jsFbm2D(bx * 0.00072, bz * 0.00072, 2, 0.5, 2.0, seed + 303);
  if (elev > 0.78) return B_IDS.MEGA_SNOW_PEAKS;
  if (elev > 0.71) return B_IDS.CLOUD_PEAKS;
  const plainBand = jsFbm2D(bx * 0.00058, bz * 0.00058, 2, 0.5, 2.0, seed + 641);
  if (heat < 0.28 && elev > 0.50) return elev > 0.62 ? B_IDS.MEGA_SNOW_PEAKS : B_IDS.ALPINE_PEAKS;
  if (heat < 0.29) return (elev < 0.48 && plainBand > 0.42) ? B_IDS.SNOWY_PLAINS : B_IDS.SNOW;
  if (heat < 0.36 && humid > 0.56) return B_IDS.REDWOOD_ANCIENT;
  if (heat < 0.40) {
    if (heat >= 0.31 && humid > 0.62) return B_IDS.GIANT_TREES;
    if (heat >= 0.29 && humid >= 0.44 && humid <= 0.62 && elev < 0.56) return B_IDS.PINE_VALLEY;
    if (humid > 0.48) return B_IDS.TAIGA;
    return plainBand > 0.46 ? B_IDS.SNOWY_PLAINS : B_IDS.SNOW;
  }
  if (heat > 0.73 && elev > 0.62) return B_IDS.VOLCANIC_BASALT;
  if (heat > 0.56 && heat <= 0.74 && humid >= 0.38 && humid <= 0.68 && elev >= 0.28 && elev <= 0.66 && spookyBand > 0.40) return B_IDS.SULFUR_SPRINGS;
  if (heat > 0.70 && elev < 0.36 && humid < 0.37) return B_IDS.BADLANDS_CRATER;
  if (heat > 0.68 && elev > 0.50) return B_IDS.BADLANDS_SPIRES;
  if (heat > 0.65 && humid >= 0.38 && elev > 0.42) return B_IDS.MESA;
  if (elev > 0.64 && humid >= 0.28 && humid <= 0.66) return B_IDS.HIGHLAND_PLATEAU;
  if (heat > 0.60 && humid < 0.44) return B_IDS.DESERT;
  if (heat > 0.66) return (humid < 0.48) ? B_IDS.DESERT : B_IDS.MESA;
  if (humid > 0.58 && elev > 0.44) {
    if (spookyBand > 0.76) return B_IDS.NIGHTMARE_WOODS;
    if (spookyBand > 0.58) return B_IDS.PALE_GARDEN;
    if (spookyBand < 0.34 && heat >= 0.40 && heat <= 0.60) return B_IDS.DARK_FOREST;
  }
  if (heat >= 0.47 && heat <= 0.61 && humid >= 0.30 && humid <= 0.42 && elev < 0.52) return B_IDS.WHEAT_VALLEY;
  if (elev < 0.53 && heat >= 0.36 && heat <= 0.64 && (humid < 0.44 || (plainBand > 0.52 && humid < 0.60))) return plainBand > 0.68 ? B_IDS.LUSH_STEPPE : (plainBand > 0.50 ? B_IDS.GREEN_PLAINS : B_IDS.PLAINS);
  if (heat > 0.57 && humid > 0.67) return B_IDS.BAMBOO_JUNGLE;
  if (heat > 0.51 && heat <= 0.64 && humid > 0.62 && elev < 0.56) return B_IDS.GIANT_JUNGLE;
  if (heat > 0.59 && heat <= 0.74 && humid > 0.60) return B_IDS.DAPPLED_FOREST;
  if (heat > 0.56 && humid >= 0.44 && humid <= 0.60) {
    if (elev > 0.57) return B_IDS.AUTUMN_DEEP;
    if (humid > 0.52) return B_IDS.AUTUMN_GOLDEN;
    return B_IDS.AUTUMN;
  }
  if (heat >= 0.40 && heat < 0.47 && humid > 0.55 && elev < 0.60) return B_IDS.BLUE_FOREST;
  if (humid > 0.70 && elev > 0.55) return B_IDS.GLOWSHROOM_GROVE;
  if (humid > 0.66 && elev >= 0.46 && elev < 0.56) return B_IDS.WEEPING_GROVE;
  if (humid > 0.63) return elev < 0.40 ? B_IDS.MANGROVE_SWAMP : (elev < 0.47 ? B_IDS.SWAMP : (elev < 0.58 ? B_IDS.LUSH_GROVE : B_IDS.FOREST));
  if (humid > 0.48 && heat > 0.45 && heat <= 0.57) return B_IDS.SAKURA;
  if (humid > 0.42 && humid <= 0.52 && heat >= 0.40 && heat <= 0.47) return B_IDS.BIRCH_ANCIENT;
  if (elev > 0.54 && humid > 0.48) return B_IDS.LAVENDER_MEADOW;
  if (elev > 0.48 && elev <= 0.54 && humid > 0.44 && humid <= 0.53 && heat > 0.40 && heat <= 0.52) return B_IDS.MANOR_GARDEN;
  if (elev > 0.52 && humid > 0.40) return B_IDS.FLOWER_MEADOW;
  return humid >= 0.52 ? B_IDS.FOREST : B_IDS.PLAINS;
}
function jsOverworldRawHeight(wx, wz, biome, seed) {
  if (biome === B_IDS.ABANDONED_CITY) return 2;
  if (biome === B_IDS.GRAND_RUINS) return 14;
  if (wx >= 9000 && wx < 11000 && wz >= 9000 && wz < 11000) {
    const hill = jsFbm2D(wx * 0.0055, wz * 0.0055, 2, 0.5, 2.0, seed + 881);
    const wave = jsValueNoise2D(wx * 0.018, wz * 0.018, seed + 883);
    const edgeDist = Math.min(wx - 9000, 11000 - wx, wz - 9000, 11000 - wz);
    return Math.max(2, 2.5 + (hill * 3.8 + wave * 0.7) * Math.min(1, Math.max(0, edgeDist / 48)));
  }
  const oMac = jsGetOceanMacro(wx, wz, seed);
  if (oMac.isOcean) {
    const isl = jsGetOceanIsland(wx, wz, oMac.openness, seed);
    if (isl && isl.inIsland) return isl.elevY;
    return Math.max(-44, jsGetOceanFloorY(wx, wz, biome, seed));
  }
  const cont = jsFbm2D(wx * 0.011, wz * 0.011, 3, 0.52, 2.05, seed);
  const detail = jsValueNoise2D(wx * 0.052, wz * 0.052, seed + 404);
  let h = -4 + cont * 17 + detail * 2.2;
  if (biome === B_IDS.ABYSS_TRENCH || biome === B_IDS.DEEP_OCEAN) h = Math.max(-44, jsGetOceanFloorY(wx, wz, biome, seed));
  else if (biome === B_IDS.PLAINS || biome === B_IDS.GREEN_PLAINS) {
    const pond = jsValueNoise2D(wx * 0.028, wz * 0.028, seed + 643);
    h = (pond < 0.14 && cont < 0.36) ? (WATER_LEVEL - 2.0 + pond * 6) : (1.5 + cont * (biome === B_IDS.GREEN_PLAINS ? 4.4 : 5.2) + detail * 0.75);
  } else if (biome === B_IDS.SNOWY_PLAINS) {
    const snBay = jsValueNoise2D(wx * 0.024, wz * 0.024, seed + 649);
    h = (snBay < 0.15 && cont < 0.42) ? (WATER_LEVEL - 2.0 + snBay * 5.5) : (1.5 + cont * 4.4 + detail * 0.65);
  } else if (biome === B_IDS.MUSHROOM_ISLAND) h = 1 + cont * 9 + detail * 1.8;
  else if (biome === B_IDS.BEACH_PALM) h = -2.5 + cont * 7.2 + detail * 1.2;
  else if (biome === B_IDS.MANGROVE_SWAMP) h = -2.0 + cont * 4.5 + detail * 0.9;
  else if (biome === B_IDS.MEGA_SNOW_PEAKS) h = 54 + Math.pow(Math.max(0, cont * 1.24 - 0.04), 1.38) * 68 + Math.abs(jsFbm2D(wx * 0.019, wz * 0.019, 2, 0.5, 2.0, seed + 331) - 0.5) * 32 + detail * 4.5;
  else if (biome === B_IDS.CLOUD_PEAKS) h = 26 + Math.pow(Math.max(0, cont * 1.18 - 0.08), 1.32) * 64 + Math.abs(jsFbm2D(wx * 0.024, wz * 0.024, 2, 0.5, 2.0, seed + 319) - 0.5) * 20 + detail * 4.2;
  else if (biome === B_IDS.ALPINE_PEAKS) h = 16 + Math.pow(Math.max(0, cont * 1.15 - 0.10), 1.35) * 52 + detail * 4.2;
  else if (biome === B_IDS.HIGHLAND_PLATEAU) h = 14 + cont * 24 + detail * 2.4;
  else if (biome === B_IDS.LUSH_STEPPE) h = 2.0 + cont * 8.0 + detail * 1.2;
  else if (biome === B_IDS.DARK_FOREST) h = -1 + cont * 12 + detail * 2.0;
  else if (biome === B_IDS.PALE_GARDEN) h = 2 + cont * 14 + detail * 2.2;
  else if (biome === B_IDS.NIGHTMARE_WOODS) h = 3 + cont * 18 + Math.abs(detail - 0.5) * 6.0;
  else if (biome === B_IDS.VOLCANIC_BASALT) h = 1 + cont * 19 + detail * 3.0;
  else if (biome === B_IDS.SULFUR_SPRINGS) {
    const bField = jsFbm2D(wx * 0.038, wz * 0.038, 2, 0.5, 2.0, seed + 7801), ridge = jsValueNoise2D(wx * 0.016, wz * 0.016, seed + 7803);
    if (bField < 0.39) h = WATER_LEVEL - 2.2;
    else if (bField < 0.47) h = WATER_LEVEL + 1.0;
    else if (bField < 0.55) h = WATER_LEVEL + 2.0 + Math.floor(ridge * 2.0);
    else h = 2.0 + Math.floor((bField - 0.55) * 26.0) + ridge * 5.0;
  } else if (biome === B_IDS.BAMBOO_JUNGLE) h = -1 + cont * 15 + detail * 2.2;
  else if (biome === B_IDS.REDWOOD_ANCIENT) h = 1 + cont * 18 + detail * 2.4;
  else if (biome === B_IDS.WEEPING_GROVE) h = -1.5 + cont * 10 + detail * 1.6;
  else if (biome === B_IDS.BIRCH_ANCIENT) h = cont * 13 + detail * 2.0;
  else if (biome === B_IDS.SWAMP) h = -2.4 + cont * 6.5 + detail * 1.2;
  else if (biome === B_IDS.LUSH_GROVE) h = -2.8 + cont * 12 + detail * 2.0;
  else if (biome === B_IDS.DESERT) h = -1 + cont * 13 + detail * 1.8;
  else if (biome === B_IDS.SNOW) h = 1 + cont * 22 + detail * 3.2;
  else if (biome === B_IDS.TAIGA) h = -1 + cont * 19 + detail * 2.8;
  else if (biome === B_IDS.AUTUMN || biome === B_IDS.AUTUMN_GOLDEN || biome === B_IDS.AUTUMN_DEEP) h = -2 + cont * 15 + detail * 2.2;
  else if (biome === B_IDS.FLOWER_MEADOW || biome === B_IDS.LAVENDER_MEADOW) h = cont * 11 + detail * 1.6;
  else if (biome === B_IDS.MESA) {
    const raw = 2 + Math.max(0, jsFbm2D(wx * 0.015, wz * 0.015, 2, 0.5, 2.0, seed + 733) - 0.22) * 46;
    h = Math.floor(raw / 3) * 3 + (raw % 3) * 0.25 + detail * 1.0;
  } else if (biome === B_IDS.GLOWSHROOM_GROVE) h = -1 + cont * 13 + detail * 2.2;
  else if (biome === B_IDS.DAPPLED_FOREST) h = -2 + cont * 14 + detail * 2.0;
  else if (biome === B_IDS.BADLANDS_SPIRES) {
    const sF = jsFbm2D(wx * 0.036, wz * 0.036, 2, 0.5, 2.0, seed + 719), sP = jsFbm2D(wx * 0.014, wz * 0.014, 2, 0.5, 2.0, seed + 727);
    const sp = sF > 0.57 ? Math.pow((sF - 0.57) / 0.43, 1.15) * 38 : (sP > 0.62 ? Math.floor((sP - 0.62) * 42) : 0);
    h = 2 + Math.min(46, Math.floor(sp / 2) * 2) + detail * 1.1;
  } else if (biome === B_IDS.BADLANDS_CRATER) h = -4 + cont * 7 + detail * 1.4;
  else if (biome === B_IDS.MARSH_RUINS) h = -2.6 + cont * 4.6 + detail * 1.0;
  else if (biome === B_IDS.TROPICAL_COAST) h = -1.5 + cont * 9 + detail * 1.6;
  else if (biome === B_IDS.GIANT_TREES) h = cont * 18 + detail * 2.6;
  else if (biome === B_IDS.MANOR_GARDEN) h = -1 + cont * 10 + detail * 1.4;
  else if (biome === B_IDS.BLUE_FOREST) h = (cont < 0.25 && detail < 0.18) ? (WATER_LEVEL - 1.0) : (0.5 + cont * 11 + detail * 1.6);
  else if (biome === B_IDS.WHEAT_VALLEY) h = 2.0 + cont * 4.0 + detail * 0.5;
  else if (biome === B_IDS.PINE_VALLEY) h = (cont < 0.26 && detail < 0.22) ? (WATER_LEVEL - 1.0) : (-0.5 + cont * 12 + detail * 1.5);
  else if (biome === B_IDS.GIANT_JUNGLE) h = (Math.abs(jsFbm2D(wx * 0.0085, wz * 0.0085, 2, 0.5, 2.0, seed + 743) - 0.5) < 0.09) ? (WATER_LEVEL - 2.4) : (-0.5 + cont * 13 + detail * 2.0);
  return h;
}
function jsOverworldTerrainHeight(wx, wz, biome, seed) {
  if (biome === B_IDS.ABANDONED_CITY) return 2;
  if (biome === B_IDS.GRAND_RUINS) return 14;
  const b1 = jsOverworldBiomeAt(wx + 8, wz, seed), b2 = jsOverworldBiomeAt(wx - 8, wz, seed);
  const b3 = jsOverworldBiomeAt(wx, wz + 8, seed), b4 = jsOverworldBiomeAt(wx, wz - 8, seed);
  const b5 = jsOverworldBiomeAt(wx + 20, wz, seed), b6 = jsOverworldBiomeAt(wx - 20, wz, seed);
  const b7 = jsOverworldBiomeAt(wx, wz + 20, seed), b8 = jsOverworldBiomeAt(wx, wz - 20, seed);
  const h = (b1 === biome && b2 === biome && b3 === biome && b4 === biome && b5 === biome && b6 === biome && b7 === biome && b8 === biome)
    ? jsOverworldRawHeight(wx, wz, biome, seed)
    : (jsOverworldRawHeight(wx, wz, biome, seed) * 4.0 +
       jsOverworldRawHeight(wx + 8, wz, b1, seed) * 1.25 + jsOverworldRawHeight(wx - 8, wz, b2, seed) * 1.25 +
       jsOverworldRawHeight(wx, wz + 8, b3, seed) * 1.25 + jsOverworldRawHeight(wx, wz - 8, b4, seed) * 1.25 +
       jsOverworldRawHeight(wx + 20, wz, b5, seed) * 0.75 + jsOverworldRawHeight(wx - 20, wz, b6, seed) * 0.75 +
       jsOverworldRawHeight(wx, wz + 20, b7, seed) * 0.75 + jsOverworldRawHeight(wx, wz - 20, b8, seed) * 0.75) / 12.0;
  return Math.max(MIN_Y + 4, Math.min(MAX_Y - 8, Math.floor(h)));
}

function fillTerrainBids(arr) {
  arr.fill(0);
  arr[1] = B.GRASS; arr[2] = B.DIRT; arr[3] = B.STONE; arr[4] = B.SAND;
  arr[5] = B.SNOW; arr[6] = B.ICE; arr[7] = B.WATER; arr[8] = B.TERRACOTTA;
  arr[9] = B.SANDSTONE; arr[10] = B.GOLD_ORE; arr[11] = B.DEEPSLATE; arr[12] = B.BEDROCK;
  arr[13] = B.COAL_ORE; arr[14] = B.IRON_ORE; arr[15] = B.DIAMOND_ORE; arr[16] = B.LAVA;
  arr[17] = B.GLOW_CRYSTAL; arr[18] = B.MUD; arr[19] = B.PACKED_ICE; arr[20] = B.MYCELIUM;
  arr[21] = B.BASALT; arr[22] = B.COPPER_ORE; arr[23] = B.TIN_ORE; arr[24] = B.EMERALD_ORE;
  arr[25] = B.RUBY_ORE; arr[26] = B.MOSS_BLOCK; arr[27] = B.FARMLAND; arr[28] = B.AUTUMN_PODZOL;
  arr[29] = B.LAPIS_ORE; arr[30] = B.GRAVEL; arr[31] = B.REDSTONE_ORE; arr[32] = B.BLUE_GRASS;
  arr[33] = B.SCULK; arr[34] = B.RED_SAND; arr[35] = B.TERRACOTTA_WHITE; arr[36] = B.TERRACOTTA_ORANGE;
  arr[37] = B.TERRACOTTA_YELLOW; arr[38] = B.TERRACOTTA_BROWN; arr[39] = B.TERRACOTTA_RED;
  arr[40] = B.PALE_MOSS; arr[41] = B.NIGHTMARE_MOSS; arr[42] = B.SNOWY_DIRT; arr[43] = B.SULFUR_BLOCK;
  arr[44] = B.SULFUR_ORE; arr[45] = B.CINNABAR_STONE; arr[46] = B.TRAVERTINE_STONE; arr[47] = B.THERMAL_CRUST;
  arr[48] = B.STONE_BRICK;
}

async function main() {
  assert(fs.existsSync(WASM_PATH), `Missing compiled WASM binary: ${WASM_PATH}`);
  const bytes = fs.readFileSync(WASM_PATH);
  assert(bytes.length > 16 && bytes.length < 256 * 1024, `Unexpected WASM size: ${bytes.length}`);
  assert.strictEqual(bytes[0], 0x00);
  assert.strictEqual(bytes[1], 0x61);
  assert.strictEqual(bytes[2], 0x73);
  assert.strictEqual(bytes[3], 0x6d);

  const { instance } = await WebAssembly.instantiate(bytes, {});
  const w = instance.exports;
  assert.strictEqual(w.wasm_abi_version(), 5);

  const mem = () => w.memory.buffer;
  const coarseView = new Float32Array(mem(), w.coarse_grid_ptr(), 1625);
  const emitView = new Float32Array(mem(), w.emitters_buf_ptr(), 3584);
  const lightView = new Float32Array(mem(), w.light_out_ptr(), 3);
  const frameOutView = new Float32Array(mem(), w.frame_out_ptr(), 16);
  const partView = new Float32Array(mem(), w.particle_buf_ptr(), 512 * 8);
  const sphereInView = new Float32Array(mem(), w.sphere_in_ptr(), 256 * 4);
  const sphereOutView = new Uint8Array(mem(), w.sphere_out_ptr(), 256);
  const atlasRgbaView = new Uint8Array(mem(), w.atlas_rgba_ptr(), 1048576);
  const atlasBumpView = new Uint8Array(mem(), w.atlas_bump_ptr(), 1048576);
  const tileModeView = new Uint8Array(mem(), w.tile_mode_ptr(), 1024);

  // ABI v4 views
  const chunkDataView = new Uint16Array(mem(), w.chunk_data_ptr(), 65536);
  const borderBufView = new Uint16Array(mem(), w.border_buf_ptr(), 17408);
  const autumnCellView = new Uint8Array(mem(), w.autumn_cell_ptr(), 16);
  const lutOpaqueView = new Uint8Array(mem(), w.lut_opaque_ptr(), 2048);
  const lutFlagsView = new Uint16Array(mem(), w.lut_flags_ptr(), 2048);
  const lutTilesView = new Uint16Array(mem(), w.lut_block_tiles_ptr(), 2048 * 5);
  const lutUvView = new Float32Array(mem(), w.lut_tile_uv_ptr(), 1024 * 4);
  const meshPosView = new Float32Array(mem(), w.mesh_pos_ptr(), 65536 * 3);
  const meshNormView = new Float32Array(mem(), w.mesh_norm_ptr(), 65536 * 3);
  const meshUvView = new Float32Array(mem(), w.mesh_uv_ptr(), 65536 * 2);
  const meshColView = new Float32Array(mem(), w.mesh_col_ptr(), 65536 * 3);
  const meshBlView = new Float32Array(mem(), w.mesh_bl_ptr(), 65536 * 3);
  const meshIdxView = new Uint32Array(mem(), w.mesh_idx_ptr(), 98304);
  const specVoxView = new Uint16Array(mem(), w.special_voxels_ptr(), 65536);
  const meshMetaView = new Uint32Array(mem(), w.mesh_meta_ptr(), 4);
  const terrainBidsView = new Uint16Array(mem(), w.terrain_bids_ptr(), 64);
  const acCoordsView = new Int32Array(mem(), w.ac_coords_ptr(), 8);
  const colHeightsView = new Int16Array(mem(), w.col_heights_ptr(), 256);
  const colBiomesView = new Uint8Array(mem(), w.col_biomes_ptr(), 256);
  const terrainMetaView = new Uint32Array(mem(), w.terrain_meta_ptr(), 4);
  const codecInView = new Uint8Array(mem(), w.codec_in_ptr(), 2097152);
  const codecOutView = new Uint8Array(mem(), w.codec_out_ptr(), 2097152);
  const lodMaskView = new Uint8Array(mem(), w.lod_mask_ptr(), 4096);
  const lodPosView = new Float32Array(mem(), w.lod_pos_ptr(), 49152 * 3);
  const lodNormView = new Float32Array(mem(), w.lod_norm_ptr(), 49152 * 3);
  const lodColView = new Float32Array(mem(), w.lod_col_ptr(), 49152 * 3);
  const lodIdxView = new Uint32Array(mem(), w.lod_idx_ptr(), 73728);
  const lodMetaView = new Uint32Array(mem(), w.lod_meta_ptr(), 4);

  // ABI v5 views
  const lutEmitInfoView = new Float32Array(mem(), w.lut_emit_info_ptr(), 2048 * 4);
  const lutEmitMetaView = new Uint8Array(mem(), w.lut_emit_meta_ptr(), 2048);
  const lutMapU32View = new Uint32Array(mem(), w.lut_map_u32_ptr(), 2048);
  const lutRtPackView = new Uint8Array(mem(), w.lut_rt_pack_ptr(), 2048 * 4);
  const scanEmitOutView = new Float32Array(mem(), w.scan_emitters_out_ptr(), 160 * 8);
  const scanSpecOutView = new Float32Array(mem(), w.scan_spec_out_ptr(), 96 * 4);
  const scanTopHView = new Int16Array(mem(), w.scan_topmap_h_ptr(), 256);
  const scanMapU32View = new Uint32Array(mem(), w.scan_minimap_u32_ptr(), 256);
  const scanMetaView = new Uint32Array(mem(), w.scan_meta_out_ptr(), 4);
  const rtVolOutView = new Uint8Array(mem(), w.rt_vol_out_ptr(), 512 * 256 * 4);
  const itemRgbaInView = new Uint8Array(mem(), w.item_rgba_in_ptr(), 16 * 16 * 4);
  const itemPosOutView = new Float32Array(mem(), w.item_pos_out_ptr(), 6144 * 3);
  const itemNormOutView = new Float32Array(mem(), w.item_norm_out_ptr(), 6144 * 3);
  const itemColOutView = new Float32Array(mem(), w.item_col_out_ptr(), 6144 * 3);
  const itemIdxOutView = new Uint32Array(mem(), w.item_idx_out_ptr(), 9216);
  const itemMetaOutView = new Uint32Array(mem(), w.item_meta_out_ptr(), 2);

  // 1) Noise parity
  for (let s = -5; s <= 5; s++) {
    const x = s * 17.37 - 4.125, y = s * -9.83 + 2.5, z = s * 11.19 + 8.75, seed = 100000000 + s * 97123;
    assert(Math.abs(w.value_noise_2d(x, z, seed) - jsValueNoise2D(x, z, seed)) < 1e-12);
    assert(Math.abs(w.value_noise_3d(x, y, z, seed) - jsValueNoise3D(x, y, z, seed)) < 1e-12);
    assert(Math.abs(w.fbm_2d(x * 0.05, z * 0.05, 3, 0.5, 2.0, seed) - jsFbm2D(x * 0.05, z * 0.05, 3, 0.5, 2.0, seed)) < 1e-12);
  }

  // 2) Coarse 3D cave grid parity
  const jsGrid = new Float32Array(1625);
  const mix = { ox: -4123, oy: 8912, oz: -13451, c1: 18472911, c2: 91234812, c3: 55210193, c4: 77419283 };
  let maxCaveDiff = 0;
  for (const [wx0, wz0, dOff, minY] of [[0, 0, 0, -64], [-256, 512, 0, -64], [2048, -1024, 256, -64], [-3008, -3008, 512, -64]]) {
    jsComputeCoarseCaveGrid(wx0, wz0, mix, dOff, minY, jsGrid);
    assert.strictEqual(w.compute_coarse_cave_grid(wx0, wz0, mix.ox, mix.oy, mix.oz, mix.c1, mix.c2, mix.c3, mix.c4, dOff, minY), 1625);
    for (let i = 0; i < 1625; i++) {
      const diff = Math.abs(coarseView[i] - jsGrid[i]);
      if (diff > maxCaveDiff) maxCaveDiff = diff;
      assert(diff < 1e-5);
    }
  }

  // 3) Emitter light slice parity
  const sliceCount = 48, sliceLen = sliceCount * 7;
  for (let i = 0; i < sliceCount; i++) {
    const base = i * 7;
    emitView[base] = (i % 16) + 0.5; emitView[base + 1] = ((i * 7) % 120) + 0.5; emitView[base + 2] = ((i * 5) % 16) + 0.5;
    emitView[base + 3] = 0.85; emitView[base + 4] = 0.62; emitView[base + 5] = 0.34; emitView[base + 6] = 196.0;
  }
  const jsOut = new Float32Array(3);
  let maxLightDiff = 0;
  for (let k = 0; k < 30; k++) {
    const lx = (k % 16) + 0.5, ly = (k * 4) + 0.5, lz = ((k * 3) % 16) + 0.5;
    jsEvalLightSlice(lx, ly, lz, emitView, sliceLen, jsOut);
    w.eval_light_slice(lx, ly, lz, sliceLen);
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(lightView[c] - jsOut[c]);
      if (diff > maxLightDiff) maxLightDiff = diff;
      assert(diff < 1e-5);
    }
  }

  // 4) ABI v2 + v3 checks
  assert.strictEqual(w.step_env_wind_state(12.5, 0.5, 100.3, 12.7, -45.2, 0.55, 0.72, 0.42, 48.0, 2048.0), 1);
  assert(Math.abs(frameOutView[0]) <= 0.25 && Number.isFinite(frameOutView[3]));
  partView[0] = 10; partView[1] = 20; partView[2] = -5; partView[3] = 2; partView[4] = 4; partView[5] = -1; partView[6] = 9.8; partView[7] = 1.5;
  assert.strictEqual(w.step_particles_batch(1, 0.1), 1);
  assert(Math.abs(partView[4] - 3.02) < 1e-4);
  sphereInView.set([0, 0, -10, 2, 0, 0, 40, 2, 0, 0, -250, 2, 1, 1, 1, 3]);
  assert.strictEqual(w.cull_spheres_batch(4, 0, 0, 0, 0, 0, -1, 120.0, 0.35), 2);
  assert.strictEqual(sphereOutView[0], 1); assert.strictEqual(sphereOutView[1], 0);
  tileModeView.fill(0); tileModeView[1] = 1;
  atlasRgbaView.fill(160);
  assert.strictEqual(w.stylize_atlas_cartoon(32, 48, 16, 2, 6), 1);
  assert.strictEqual(w.build_bump_map_rgba(64), 64);

  // 5) ABI v4: Solid Mesher Parity + 40-chunk Benchmark
  const BLK_SOLID = 8192;
  lutOpaqueView.fill(0); lutFlagsView.fill(0); lutTilesView.fill(0xffff);
  for (const id of [B.GRASS, B.DIRT, B.STONE, B.BEDROCK, B.CRAFT_TABLE, B.AUTUMN_PODZOL]) {
    lutOpaqueView[id] = 1;
    lutFlagsView[id] = BLK_SOLID;
  }
  lutFlagsView[B.WATER] = 1; lutFlagsView[B.OAK_LEAVES] = 256; lutFlagsView[B.TORCH_BLOCK] = 8; lutFlagsView[B.GLASS] = 4096 | BLK_SOLID;
  const setTile = (id, t0, t1, t2, front = 0xffff, bothZ = 0) => {
    const o = id * 5;
    lutTilesView[o] = t0; lutTilesView[o + 1] = t1; lutTilesView[o + 2] = t2; lutTilesView[o + 3] = front; lutTilesView[o + 4] = bothZ;
  };
  setTile(B.GRASS, 0, 1, 2); setTile(B.DIRT, 2, 2, 2); setTile(B.STONE, 3, 3, 3);
  setTile(B.BEDROCK, 22, 22, 22); setTile(B.CRAFT_TABLE, 34, 35, 8, 442, 1); setTile(B.AUTUMN_PODZOL, 10, 11, 2);
  for (let t = 0; t < 512; t++) {
    const tx = t & 7, ty = t >> 3;
    lutUvView[t * 4] = tx / 8 + 0.002; lutUvView[t * 4 + 1] = (tx + 1) / 8 - 0.002;
    lutUvView[t * 4 + 2] = ty / 104 + 0.002; lutUvView[t * 4 + 3] = (ty + 1) / 104 - 0.002;
  }
  chunkDataView.fill(0);
  borderBufView.fill(0);
  autumnCellView.fill(0);
  autumnCellView[0] = 1; autumnCellView[5] = 1;
  for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    chunkDataView[(0 << 8) | (lz << 4) | lx] = B.BEDROCK;
    const h = 48 + ((lx + lz) % 5);
    for (let ly = 1; ly < h; ly++) chunkDataView[(ly << 8) | (lz << 4) | lx] = ly < h - 3 ? B.STONE : B.DIRT;
    chunkDataView[(h << 8) | (lz << 4) | lx] = B.GRASS;
  }
  chunkDataView[(52 << 8) | (4 << 4) | 4] = B.CRAFT_TABLE;
  chunkDataView[(53 << 8) | (3 << 4) | 3] = B.OAK_LEAVES;
  chunkDataView[(53 << 8) | (4 << 4) | 4] = B.TORCH_BLOCK;
  chunkDataView[(53 << 8) | (5 << 4) | 5] = B.GLASS;
  chunkDataView[(49 << 8) | (12 << 4) | 12] = B.WATER;
  for (let ly = 0; ly < 50; ly++) {
    borderBufView[(ly << 4) | 2] = B.STONE;
    borderBufView[4096 + (ly << 4) | 3] = B.DIRT;
    borderBufView[16384 + ly] = B.STONE;
    borderBufView[17152 + ly] = B.STONE;
  }
  emitView[0] = 4.5; emitView[1] = 53.5; emitView[2] = 4.5;
  emitView[3] = 1.18; emitView[4] = 0.88; emitView[5] = 0.48; emitView[6] = 324.0;
  const maxLyTest = 54;
  const jsMesh = jsMeshSolidChunk(chunkDataView, borderBufView, lutOpaqueView, lutFlagsView, lutTilesView, lutUvView, autumnCellView, emitView, 7, 16, -32, maxLyTest, true, B.GRASS, B.AUTUMN_PODZOL, BLK_SOLID);
  const wV = w.mesh_chunk_solid(16, -32, MIN_Y, WATER_LEVEL, 0, maxLyTest, 7, 1 | 2 | 8 | 64, B.GRASS, B.AUTUMN_PODZOL, B.WATER, B.SEAGRASS, B.LAVA, B.BEDROCK, B.DEEPSLATE, BLK_SOLID);
  assert.strictEqual(wV, jsMesh.vCount);
  assert.strictEqual(meshMetaView[0], jsMesh.vCount);
  assert.strictEqual(meshMetaView[1], jsMesh.iCount);
  assert.strictEqual(meshMetaView[2], jsMesh.spec.length);
  assert.strictEqual(meshMetaView[3], 0);
  for (let i = 0; i < jsMesh.vCount * 3; i++) {
    assert(Math.abs(meshPosView[i] - jsMesh.pos[i]) < 1e-5, `pos mismatch at ${i}`);
    assert(Math.abs(meshNormView[i] - jsMesh.norm[i]) < 1e-5, `norm mismatch at ${i}`);
    assert(Math.abs(meshColView[i] - jsMesh.col[i]) < 1e-5, `ao mismatch at ${i}`);
    assert(Math.abs(meshBlView[i] - jsMesh.bl[i]) < 1e-5, `bl mismatch at ${i}`);
  }
  for (let i = 0; i < jsMesh.vCount * 2; i++) assert(Math.abs(meshUvView[i] - jsMesh.uv[i]) < 1e-5);
  for (let i = 0; i < jsMesh.iCount; i++) assert.strictEqual(meshIdxView[i], jsMesh.idx[i]);
  for (let i = 0; i < jsMesh.spec.length; i++) assert.strictEqual(specVoxView[i], jsMesh.spec[i]);

  const tJsMesh0 = performance.now();
  for (let i = 0; i < 40; i++) jsMeshSolidChunk(chunkDataView, borderBufView, lutOpaqueView, lutFlagsView, lutTilesView, lutUvView, autumnCellView, emitView, 7, 16, -32, maxLyTest, true, B.GRASS, B.AUTUMN_PODZOL, BLK_SOLID);
  const jsMeshMs = performance.now() - tJsMesh0;
  const tWasmMesh0 = performance.now();
  for (let i = 0; i < 40; i++) w.mesh_chunk_solid(16, -32, MIN_Y, WATER_LEVEL, 0, maxLyTest, 7, 1 | 2 | 8 | 64, B.GRASS, B.AUTUMN_PODZOL, B.WATER, B.SEAGRASS, B.LAVA, B.BEDROCK, B.DEEPSLATE, BLK_SOLID);
  const wasmMeshMs = performance.now() - tWasmMesh0;

  // 5b) ABI v4: 2D Greedy Face Merging verification (area conservation, bounds, unit normals & reduction)
  const gV = w.mesh_chunk_solid(16, -32, MIN_Y, WATER_LEVEL, 0, maxLyTest, 7, 1 | 2 | 8 | 64 | 128, B.GRASS, B.AUTUMN_PODZOL, B.WATER, B.SEAGRASS, B.LAVA, B.BEDROCK, B.DEEPSLATE, BLK_SOLID) >>> 0;
  const gI = meshMetaView[1] >>> 0;
  assert.strictEqual(meshMetaView[3], 0);
  assert.strictEqual(meshMetaView[2], jsMesh.spec.length);
  for (let i = 0; i < jsMesh.spec.length; i++) assert.strictEqual(specVoxView[i], jsMesh.spec[i]);
  let greedyArea = 0;
  for (let v = 0; v < gV; v += 4) {
    const o = v * 3;
    const ax = meshPosView[o + 3] - meshPosView[o], ay = meshPosView[o + 4] - meshPosView[o + 1], az = meshPosView[o + 5] - meshPosView[o + 2];
    const bx = meshPosView[o + 9] - meshPosView[o], by = meshPosView[o + 10] - meshPosView[o + 1], bz = meshPosView[o + 11] - meshPosView[o + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    greedyArea += Math.round(Math.hypot(cx, cy, cz));
    assert(Number.isFinite(meshPosView[o]) && Math.abs(Math.hypot(meshNormView[o], meshNormView[o + 1], meshNormView[o + 2]) - 1.0) < 1e-4);
  }
  for (let i = 0; i < gI; i++) assert(meshIdxView[i] < gV);
  assert.strictEqual(greedyArea, (jsMesh.vCount / 4) | 0, `Greedy total quad area must match 1x1 face count: got=${greedyArea}, expected=${jsMesh.vCount / 4}`);
  const tWasmGreedy0 = performance.now();
  for (let i = 0; i < 40; i++) w.mesh_chunk_solid(16, -32, MIN_Y, WATER_LEVEL, 0, maxLyTest, 7, 1 | 2 | 8 | 64 | 128, B.GRASS, B.AUTUMN_PODZOL, B.WATER, B.SEAGRASS, B.LAVA, B.BEDROCK, B.DEEPSLATE, BLK_SOLID);
  const wasmGreedyMs = performance.now() - tWasmGreedy0;
  const greedySavePct = ((1 - gV / jsMesh.vCount) * 100);
  // Flat slab chunk greedy merge reduction check
  chunkDataView.fill(0); borderBufView.fill(0); autumnCellView.fill(0);
  for (let ly = 0; ly <= 32; ly++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    chunkDataView[(ly << 8) | (lz << 4) | lx] = ly === 0 ? B.BEDROCK : (ly < 32 ? B.STONE : B.GRASS);
  }
  const flat1x1V = w.mesh_chunk_solid(0, 0, MIN_Y, WATER_LEVEL, 0, 32, 0, 1 | 2 | 8 | 64, B.GRASS, B.AUTUMN_PODZOL, B.WATER, B.SEAGRASS, B.LAVA, B.BEDROCK, B.DEEPSLATE, BLK_SOLID) >>> 0;
  const flatGreedyV = w.mesh_chunk_solid(0, 0, MIN_Y, WATER_LEVEL, 0, 32, 0, 1 | 2 | 8 | 64 | 128, B.GRASS, B.AUTUMN_PODZOL, B.WATER, B.SEAGRASS, B.LAVA, B.BEDROCK, B.DEEPSLATE, BLK_SOLID) >>> 0;
  const flatSavePct = (1 - flatGreedyV / flat1x1V) * 100;
  assert(flatSavePct >= 80, `Expected >=80% flat chunk vertex reduction, got ${flatSavePct.toFixed(1)}%`);

  // 6) ABI v4: Overworld Biome, Height & Base Chunk Parity + 32-chunk Benchmark
  fillTerrainBids(terrainBidsView);
  acCoordsView.set([240, 240, -240, 240, -240, -240, 240, -240]);
  const testSeeds = [1337, 424242, 987654321];
  const testPoints = [[0, 0], [32, -48], [-224, 336], [10000, 10000], [2500, 2500], [-3000, -3000], [1400, -1800], [640, 720]];
  for (const sd of testSeeds) {
    for (const [tx, tz] of testPoints) {
      const jb = jsOverworldBiomeAt(tx, tz, sd);
      const wb = w.overworld_biome_at(tx, tz, sd);
      assert.strictEqual(wb, jb, `Biome mismatch at (${tx},${tz}) seed=${sd}: js=${jb} wasm=${wb}`);
      const jh = jsOverworldTerrainHeight(tx, tz, jb, sd);
      const wh = w.overworld_terrain_height(tx, tz, sd, MIN_Y, MAX_Y, WATER_LEVEL);
      assert.strictEqual(wh, jh, `Height mismatch at (${tx},${tz}) seed=${sd}: js=${jh} wasm=${wh}`);
    }
  }
  // Base chunk check across diverse chunks (normal terrain, wheat mega plain, ocean)
  const chunkCases = [[0, 0], [-5, 3], [625, 625], [88, -110]];
  for (const [cx, cz] of chunkCases) {
    const maxLy = w.generate_overworld_base_chunk(cx, cz, 424242, mix.ox, mix.oy, mix.oz, mix.c1, mix.c2, mix.c3, mix.c4, 31337, 73319, 424242, 0, MIN_Y, MAX_Y, WATER_LEVEL);
    assert(maxLy > 0 && maxLy < WORLD_H);
    if (terrainMetaView[1] === 0) {
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const ci = (lz << 4) | lx, wx = cx * 16 + lx, wz = cz * 16 + lz;
        assert.strictEqual(colBiomesView[ci], jsOverworldBiomeAt(wx, wz, 424242));
      }
    }
  }
  const tWasmGen0 = performance.now();
  for (let i = 0; i < 32; i++) {
    w.generate_overworld_base_chunk(i - 16, i % 5, 424242, mix.ox, mix.oy, mix.oz, mix.c1, mix.c2, mix.c3, mix.c4, 31337, 73319, 424242, 0, MIN_Y, MAX_Y, WATER_LEVEL);
  }
  const wasmGenMs = performance.now() - tWasmGen0;

  // 7) ABI v4: NCW1 Binary Codec Round-trip + Fuzz
  const N_MODS = 50000;
  const expectedMap = new Map();
  const dvIn = new DataView(codecInView.buffer, codecInView.byteOffset, N_MODS * 13);
  for (let i = 0; i < N_MODS; i++) {
    const dim = i % 5;
    const x = ((i % 128) - 64) | 0;
    const y = (((i >> 7) % 90) - 30) | 0;
    const z = (((i >> 11) % 64) - 32) | 0;
    const bid = 1 + (i % 410);
    const off = i * 13;
    codecInView[off] = dim;
    dvIn.setInt32(off + 1, x, true);
    dvIn.setInt16(off + 5, y, true);
    dvIn.setInt32(off + 7, z, true);
    dvIn.setUint16(off + 11, bid, true);
    expectedMap.set(`${dim}:${x},${y},${z}`, bid);
  }
  const jsonBytes = JSON.stringify(Array.from(expectedMap.entries())).length;
  const encBytes = w.encode_world_mods_bin(N_MODS) >>> 0;
  assert(encBytes >= 10 && encBytes < jsonBytes / 4, `Expected >4x compression: enc=${encBytes}, json=${jsonBytes}`);
  codecInView.set(codecOutView.subarray(0, encBytes));
  const decCount = w.decode_world_mods_bin(encBytes) >>> 0;
  assert.strictEqual(decCount, expectedMap.size);
  const dvOut = new DataView(codecOutView.buffer, codecOutView.byteOffset, decCount * 13);
  for (let i = 0; i < decCount; i++) {
    const off = i * 13;
    const k = `${codecOutView[off]}:${dvOut.getInt32(off + 1, true)},${dvOut.getInt16(off + 5, true)},${dvOut.getInt32(off + 7, true)}`;
    assert.strictEqual(dvOut.getUint16(off + 11, true), expectedMap.get(k));
  }
  // Corrupt/fuzz inputs safely fail with 0xFFFFFFFF
  codecInView.set([0, 0, 0, 0, 1, 0, 0, 0, 0, 0], 0);
  assert.strictEqual(w.decode_world_mods_bin(10) >>> 0, 0xFFFFFFFF);
  codecInView.set([78, 67, 87, 49, 99, 0, 0, 0, 0, 0], 0); // bad version
  assert.strictEqual(w.decode_world_mods_bin(10) >>> 0, 0xFFFFFFFF);
  codecInView.set([78, 67, 87, 49, 1, 0, 5, 0, 0, 0, 15], 0); // truncated
  assert.strictEqual(w.decode_world_mods_bin(11) >>> 0, 0xFFFFFFFF);

  // 8) ABI v4: Dual-Ring 768m Slope-Lit Far LOD Ring test
  const maskR = 5, maskW = maskR * 2 + 1;
  lodMaskView.fill(0);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    lodMaskView[(dz + maskR) * maskW + (dx + maskR)] = 1;
  }
  const tLod0 = performance.now();
  const lodVerts = w.build_far_lod_mesh(0, 0, 1337, WATER_LEVEL, 8, 256, maskR) >>> 0;
  const lodMs = performance.now() - tLod0;
  const lodIdxLen = lodMetaView[1] >>> 0;
  const lodOuterR = lodMetaView[3] >>> 0;
  assert(lodVerts > 1000 && lodVerts <= 49152 && lodIdxLen > 1000 && lodIdxLen <= 73728 && lodIdxLen % 6 === 0);
  assert.strictEqual(lodOuterR, 768);
  assert(lodMs < 25, `LOD took too long: ${lodMs}ms`);
  let maxLodHoriz = 0;
  for (let i = 0; i < lodVerts; i++) {
    const o = i * 3;
    const x = lodPosView[o], y = lodPosView[o + 1], z = lodPosView[o + 2];
    const nx = lodNormView[o], ny = lodNormView[o + 1], nz = lodNormView[o + 2];
    assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    assert(Math.abs(Math.hypot(nx, ny, nz) - 1.0) < 1e-4, `LOD non-unit normal at v=${i}`);
    assert(Number.isFinite(lodColView[o]) && Number.isFinite(lodColView[o + 1]) && Number.isFinite(lodColView[o + 2]));
    const hd = Math.hypot(x - 8, z - 8);
    if (hd > maxLodHoriz) maxLodHoriz = hd;
  }
  assert(maxLodHoriz > 560, `Expected Ring 2 extending past 560 blocks, got ${maxLodHoriz}`);
  for (let i = 0; i < lodIdxLen; i++) assert(lodIdxView[i] < lodVerts);
  // Ensure no LOD top quad is centered inside the masked central 4x4 chunks [-24..24]
  for (let i = 0; i < lodVerts; i += 4) {
    if (lodNormView[i * 3 + 1] > 0.5) {
      const cxMid = (lodPosView[i * 3] + lodPosView[i * 3 + 3]) * 0.5;
      const czMid = (lodPosView[i * 3 + 2] + lodPosView[i * 3 + 8]) * 0.5;
      assert(!(Math.abs(cxMid) < 24 && Math.abs(czMid) < 24), `Unmasked LOD quad inside loaded center: (${cxMid},${czMid})`);
    }
  }

  // 9) ABI v5: Fused Scan (Emitters + TopMap + Minimap), RT Pack, 3D Item Extrude, Solid Atlas, CRC32
  lutEmitInfoView.fill(0); lutEmitMetaView.fill(0); lutMapU32View.fill(0xff80726b);
  lutMapU32View[B.GRASS] = 0xff49944f; lutMapU32View[B.STONE] = 0xff7b7b7b;
  lutEmitInfoView.set([1.18, 0.88, 0.48, 324.0], B.TORCH_BLOCK * 4);
  lutEmitMetaView[B.TORCH_BLOCK] = 1;
  lutEmitInfoView.set([0.82, 0.36, 0.12, 144.0], B.LAVA * 4);
  lutEmitMetaView[B.LAVA] = 3; // sampled lava
  chunkDataView.fill(0);
  chunkDataView[(12 << 8) | (5 << 4) | 7] = B.STONE;
  chunkDataView[(40 << 8) | (2 << 4) | 3] = B.GRASS;
  chunkDataView[(41 << 8) | (2 << 4) | 3] = B.TORCH_BLOCK; // cross block emitter above GRASS
  chunkDataView[(8 << 8) | (4 << 4) | 4] = B.LAVA;   // (4&3)==0 && (4&3)==0 && (8&1)==0 -> kept
  chunkDataView[(9 << 8) | (4 << 4) | 4] = B.LAVA;   // (9&1)==1 -> skipped
  const emFound = w.scan_chunk_emitters_and_topmap(50, 160, 8, 0xff271811) >>> 0;
  assert.strictEqual(emFound, 2);
  assert.strictEqual(scanMetaView[0], 1); // primary torch first
  assert.strictEqual(scanMetaView[1], 2);
  assert.strictEqual(Math.round(scanEmitOutView[7]), B.TORCH_BLOCK);
  assert.strictEqual(Math.round(scanEmitOutView[8 + 7]), B.LAVA);
  assert.strictEqual(scanTopHView[(2 << 4) | 3], 40); // skipped cross torch at 41, picked GRASS at 40
  assert.strictEqual(scanMapU32View[(2 << 4) | 3] >>> 0, 0xff49944f);
  assert.strictEqual(scanMapU32View[(0 << 4) | 0] >>> 0, 0xff271811);
  assert.strictEqual(scanSpecOutView.length, 96 * 4);

  // RT Voxel Packer parity check
  lutRtPackView.fill(0);
  lutRtPackView.set([122, 128, 134, 32], B.STONE * 4);
  lutRtPackView.set([255, 112, 22, 224], B.LAVA * 4);
  w.rt_vol_clear();
  const packedN = w.pack_rt_chunk_into_vol(0, 0, MIN_Y, -32, MIN_Y + 8, -32, MAX_Y) >>> 0;
  assert.strictEqual(packedN, 3); // STONE@12, GRASS@40(kind=0 skipped), TORCH@41(0), LAVA@8, LAVA@9
  // Check STONE at (lx=7, ly=12, lz=5) -> wx=7, wy=MIN_Y+12, wz=5 -> vx=39, vy=4, vz=37
  const vyS = 4, tXS = vyS & 7, tYS = vyS >> 3;
  const pIdxS = ((tYS * 64 + 37) * 512 + (tXS * 64 + 39)) * 4;
  assert.strictEqual(rtVolOutView[pIdxS], 122);
  assert.strictEqual(rtVolOutView[pIdxS + 3], 32);

  // 16x16 3D Voxel Item Extruder check (2x2 opaque block with bevel -> 0 interior pixels -> known quads)
  itemRgbaInView.fill(0);
  for (let y = 6; y < 9; y++) for (let x = 6; x < 9; x++) {
    const o = (y * 16 + x) * 4;
    itemRgbaInView[o] = 200; itemRgbaInView[o + 1] = 100; itemRgbaInView[o + 2] = 50; itemRgbaInView[o + 3] = 255;
  }
  const exIdxCnt = w.extrude_voxel_item_16x16(0.028, 0.022, 0.008) >>> 0;
  // 3x3 grid: 9 front + 9 back + 12 outerperimeter sides + 4*2 bevel steps around center pixel (7,7) = 38 quads -> 152 verts, 228 idx
  assert.strictEqual(itemMetaOutView[0], 152);
  assert.strictEqual(itemMetaOutView[1], 228);
  assert.strictEqual(exIdxCnt, 228);
  assert(Math.abs(itemPosOutView[0] - (-2 * 0.028)) < 1e-5);
  assert.strictEqual(itemNormOutView[2], 1.0);
  assert(Math.abs(itemColOutView[0] - 200 / 255) < 1e-4);
  assert.strictEqual(itemIdxOutView[5], 3);

  // Solid Atlas builder check (transparent pixels filled with dimmed tile average)
  atlasRgbaView.fill(0);
  atlasRgbaView[0] = 100; atlasRgbaView[1] = 200; atlasRgbaView[2] = 100; atlasRgbaView[3] = 255;
  assert.strictEqual(w.build_solid_atlas_rgba(32, 16, 16), 1);
  assert.strictEqual(atlasBumpView[0], 100);
  assert.strictEqual(atlasBumpView[4], 62);  // Math.trunc(100 * 0.62)
  assert.strictEqual(atlasBumpView[5], 132); // Math.trunc(200 * 0.66)
  assert.strictEqual(atlasBumpView[7], 255);

  // IEEE CRC32 known test vector ("123456789" -> 0xCBF43926)
  const crcTestBytes = Buffer.from('123456789', 'ascii');
  codecInView.set(crcTestBytes, 0);
  assert.strictEqual(w.crc32_bytes(crcTestBytes.length) >>> 0, 0xCBF43926);

  // 10) Rust/WASM 2D PixelFX Strip Baker & Plume Stepper checks
  const pfxSpecs = [
    [0, 24, 10, 1], // fire_flame
    [1, 24, 10, 2], // soul_flame
    [2, 24, 12, 3], // sulfur_steam
    [3, 24, 12, 4], // campfire_smoke
    [4, 20, 8, 5],  // smoke_puff
    [5, 24, 10, 6]  // dragon_impact_glow
  ];
  for (const [kind, sz, fr, seed] of pfxSpecs) {
    const written = w.bake_pixelfx_strip_rgba(kind, sz, fr, seed) >>> 0;
    assert.strictEqual(written, fr * sz * sz * 4, `Unexpected byte size for pixelfx kind ${kind}`);
    const stripW = fr * sz;
    const rgbSet = new Set();
    let opaqueCnt = 0;
    let firstFrameAlphaSum = 0;
    let lastFrameAlphaSum = 0;
    for (let y = 0; y < sz; y++) {
      for (let fIdx = 0; fIdx < fr; fIdx++) {
        for (let x = 0; x < sz; x++) {
          const off = (y * stripW + fIdx * sz + x) * 4;
          const a = atlasRgbaView[off + 3];
          if (fIdx === 0) firstFrameAlphaSum += a;
          if (fIdx === fr - 1) lastFrameAlphaSum += a;
          if (a > 16) {
            opaqueCnt++;
            rgbSet.add((atlasRgbaView[off] << 16) | (atlasRgbaView[off + 1] << 8) | atlasRgbaView[off + 2]);
          }
        }
      }
    }
    assert(opaqueCnt > 40, `Too few opaque pixels in pixelfx kind ${kind}: ${opaqueCnt}`);
    assert(rgbSet.size >= 3, `Expected >= 3 distinct tones for pixelfx kind ${kind}, got ${rgbSet.size}`);
    if (kind === 2 || kind === 3 || kind === 4) {
      assert(lastFrameAlphaSum < firstFrameAlphaSum, `Expected smoke kind ${kind} to thin in final frame (${lastFrameAlphaSum} vs ${firstFrameAlphaSum})`);
    }
  }
  assert.strictEqual(w.bake_pixelfx_strip_rgba(99, 24, 8, 1) >>> 0, 0);
  assert.strictEqual(w.bake_pixelfx_strip_rgba(0, 4, 8, 1) >>> 0, 0);

  partView.fill(0);
  partView.set([1.0, 2.0, 3.0, 0.0, 1.5, 0.0, 0.7, 2.0], 0);
  partView.set([-2.0, 0.5, 4.0, 0.2, 2.0, -0.1, 2.1, 1.5], 8);
  const pOut = w.step_pixelfx_plumes(2, 0.1, 1.25, 0.25, 0.4) >>> 0;
  assert.strictEqual(pOut, 2);
  assert(Number.isFinite(partView[0]) && Number.isFinite(partView[1]) && Number.isFinite(partView[2]));
  assert(partView[1] > 2.0 && partView[4] < 1.5, 'Expected positive Y rise with drag');
  assert(Math.abs(partView[0] - 1.0) > 1e-4 || Math.abs(partView[2] - 3.0) > 1e-4, 'Expected horizontal wind-curl drift');
  assert(Math.abs(partView[7] - 1.9) < 1e-5 && Math.abs(partView[15] - 1.4) < 1e-5);

  console.log(
    `[NUCRAFT wasm test] PASS | ABI v5 | size=${(bytes.length / 1024).toFixed(2)}KB | ` +
    `40-chunk solid: JS=${jsMeshMs.toFixed(1)}ms, WASM=${wasmMeshMs.toFixed(1)}ms, Greedy=${wasmGreedyMs.toFixed(1)}ms (-${greedySavePct.toFixed(1)}% / flat -${flatSavePct.toFixed(1)}% verts) | ` +
    `32-chunk OW gen=${wasmGenMs.toFixed(1)}ms | ` +
    `NCW1 50k=${encBytes}B (${(jsonBytes / encBytes).toFixed(1)}x) | ` +
    `FarLOD ${lodOuterR}m=${(lodIdxLen / 3) | 0} tris in ${lodMs.toFixed(2)}ms`
  );
}

main().catch((err) => {
  console.error('[NUCRAFT wasm test] FAIL:', err);
  process.exit(1);
});
