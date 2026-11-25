'use strict';
const CAVE_GRID_X = 5, CAVE_GRID_Y = 33, CAVE_GRID_Z = 5;

function hash2i(x, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash3i(x, y, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2i(xi, zi, seed), b = hash2i(xi + 1, zi, seed);
  const c = hash2i(xi, zi + 1, seed), d = hash2i(xi + 1, zi + 1, seed);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}

function valueNoise3D(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const x00 = hash3i(xi, yi, zi, seed) + (hash3i(xi + 1, yi, zi, seed) - hash3i(xi, yi, zi, seed)) * u;
  const x10 = hash3i(xi, yi + 1, zi, seed) + (hash3i(xi + 1, yi + 1, zi, seed) - hash3i(xi, yi + 1, zi, seed)) * u;
  const x01 = hash3i(xi, yi, zi + 1, seed) + (hash3i(xi + 1, yi, zi + 1, seed) - hash3i(xi, yi, zi + 1, seed)) * u;
  const x11 = hash3i(xi, yi + 1, zi + 1, seed) + (hash3i(xi + 1, yi + 1, zi + 1, seed) - hash3i(xi, yi + 1, zi + 1, seed)) * u;
  return (x00 + (x10 - x00) * v) + ((x01 + (x11 - x01) * v) - (x00 + (x10 - x00) * v)) * w;
}

function computeCoarseCaveGrid(wx0, wz0, seedMix, dOff, minY) {
  const caveGrid = new Float32Array(CAVE_GRID_X * CAVE_GRID_Y * CAVE_GRID_Z);
  let p = 0;
  const ox = seedMix.ox, oy = seedMix.oy, oz = seedMix.oz;
  for (let gy = 0; gy < CAVE_GRID_Y; gy++) {
    const wy = minY + gy * 4;
    const trueY = wy - dOff;
    const depthBoost = Math.min(0.13, Math.max(0, (-trueY - 12) * 0.00038));
    const strataMorph = valueNoise3D((wx0 + ox) * 0.006, trueY * 0.009, (wz0 + oz) * 0.006, seedMix.c3);
    const scaleMod = 0.84 + strataMorph * 0.36;
    for (let gz = 0; gz < CAVE_GRID_Z; gz++) {
      const wz = wz0 + gz * 4;
      for (let gx = 0; gx < CAVE_GRID_X; gx++) {
        const wx = wx0 + gx * 4;
        const warpX = (valueNoise3D((wx + ox) * 0.019, (trueY + oy) * 0.024, (wz + oz) * 0.019, seedMix.c4) - 0.5) * 16.0;
        const warpY = (valueNoise3D((wx + ox) * 0.016 - 23.4, (trueY + oy) * 0.020, (wz + oz) * 0.016 + 31.1, seedMix.c2 + 13) - 0.5) * 9.0;
        const warpZ = (valueNoise3D((wx + ox) * 0.019 + 47.3, (trueY + oy) * 0.024 - 19.7, (wz + oz) * 0.019 + 11.2, seedMix.c4 + 31) - 0.5) * 16.0;
        const qx = (wx + warpX) * scaleMod + ox * 0.5;
        const qy = (trueY + warpY) + oy * 0.5;
        const qz = (wz + warpZ) * scaleMod + oz * 0.5;

        const ch1 = valueNoise3D(qx * 0.025, qy * 0.035, qz * 0.025, seedMix.c1);
        const ch2 = valueNoise3D(qx * 0.054 + 19.2, qy * 0.068 - 11.4, qz * 0.054 + 7.8, seedMix.c1 + 43);
        const cheese = ch1 * 0.72 + ch2 * 0.28;
        const pillar = valueNoise2D((wx + ox) * 0.095, (wz + oz) * 0.095, seedMix.c3);
        const cheeseVal = cheese - (pillar > 0.76 ? (pillar - 0.76) * 1.25 : 0.0);

        const spA = Math.abs(valueNoise3D(qx * 0.044, qy * 0.056, qz * 0.044, seedMix.c2) - 0.5);
        const spB = Math.abs(valueNoise3D(qx * 0.047 + 73.1, qy * 0.055 - 41.9, qz * 0.047 + 29.4, seedMix.c3) - 0.5);
        const spaghetti = Math.max(0, 1.0 - (spA + spB) * 5.0);

        const ravMask = valueNoise3D((wx + ox) * 0.009, (trueY + oy) * 0.008, (wz + oz) * 0.009, seedMix.c1 + 77);
        const ravLine = Math.abs(valueNoise2D(qx * 0.024, qz * 0.024, seedMix.c2 + 53) - 0.5);
        const ravine = (ravMask > 0.55 && ravLine < 0.048) ? (0.88 - ravLine * 5.6) : 0.0;

        const noodle = valueNoise3D(qx * 0.072, qy * 0.088, qz * 0.072, seedMix.c4 + 19);

        caveGrid[p++] = Math.max(
          cheeseVal * 0.96 + noodle * 0.15 + depthBoost,
          spaghetti * 0.94 + noodle * 0.13 + depthBoost * 0.65,
          ravine
        );
      }
    }
  }
  return caveGrid;
}

self.onmessage = function (ev) {
  const m = ev && ev.data;
  if (!m || typeof m.wx0 !== 'number') return;
  const caveGrid = computeCoarseCaveGrid(m.wx0, m.wz0, m.seedMix, m.dOff || 0, m.minY);
  self.postMessage({ id: m.id, key: m.key, caveGrid }, [caveGrid.buffer]);
};
