'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const WASM_PATH = path.join(ROOT, 'assets', 'nucraft_core.wasm');

// Exact reference JS functions matching src/world/chunkWorker.js & src/world/Chunk.js
function jsHash2i(x, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function jsHash3i(x, y, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
  assert.strictEqual(w.wasm_abi_version(), 1);

  const coarseView = new Float32Array(w.memory.buffer, w.coarse_grid_ptr(), 1625);
  const emitView = new Float32Array(w.memory.buffer, w.emitters_buf_ptr(), 3584);
  const lightView = new Float32Array(w.memory.buffer, w.light_out_ptr(), 3);

  // 1) Noise parity assertions
  for (let s = -5; s <= 5; s++) {
    const x = s * 17.37 - 4.125, y = s * -9.83 + 2.5, z = s * 11.19 + 8.75, seed = 100000000 + s * 97123;
    assert(Math.abs(w.value_noise_2d(x, z, seed) - jsValueNoise2D(x, z, seed)) < 1e-12);
    assert(Math.abs(w.value_noise_3d(x, y, z, seed) - jsValueNoise3D(x, y, z, seed)) < 1e-12);
    assert(Math.abs(w.fbm_2d(x * 0.05, z * 0.05, 3, 0.5, 2.0, seed) - jsFbm2D(x * 0.05, z * 0.05, 3, 0.5, 2.0, seed)) < 1e-12);
  }

  // 2) Coarse 3D cave grid parity across diverse coords & depth offsets
  const jsGrid = new Float32Array(1625);
  const mix = { ox: -4123, oy: 8912, oz: -13451, c1: 18472911, c2: 91234812, c3: 55210193, c4: 77419283 };
  let maxCaveDiff = 0;
  const cases = [
    [0, 0, 0, -64],
    [-256, 512, 0, -64],
    [2048, -1024, 256, -64],
    [-3008, -3008, 512, -64],
    [10000, 10000, -128, -64],
    [64, -128, 768, -64]
  ];
  for (const [wx0, wz0, dOff, minY] of cases) {
    jsComputeCoarseCaveGrid(wx0, wz0, mix, dOff, minY, jsGrid);
    const n = w.compute_coarse_cave_grid(wx0, wz0, mix.ox, mix.oy, mix.oz, mix.c1, mix.c2, mix.c3, mix.c4, dOff, minY);
    assert.strictEqual(n, 1625);
    for (let i = 0; i < 1625; i++) {
      const diff = Math.abs(coarseView[i] - jsGrid[i]);
      if (diff > maxCaveDiff) maxCaveDiff = diff;
      assert(diff < 1e-5, `Cave diff ${diff} at idx=${i} case=(${wx0},${wz0},${dOff})`);
    }
  }

  // 3) Emitter light slice parity
  const sliceCount = 48;
  const sliceLen = sliceCount * 7;
  for (let i = 0; i < sliceCount; i++) {
    const base = i * 7;
    emitView[base] = (i % 16) + 0.5;
    emitView[base + 1] = ((i * 7) % 120) + 0.5;
    emitView[base + 2] = ((i * 5) % 16) + 0.5;
    emitView[base + 3] = 0.85;
    emitView[base + 4] = 0.62;
    emitView[base + 5] = 0.34;
    emitView[base + 6] = 196.0;
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
      assert(diff < 1e-5, `Light diff ${diff} at k=${k}, c=${c}`);
    }
  }

  // 4) Microbenchmark (40 chunks of 5x65x5 cave grid)
  const N_BENCH = 40;
  const tJs0 = performance.now();
  for (let i = 0; i < N_BENCH; i++) {
    jsComputeCoarseCaveGrid(i * 16, -i * 16, mix, 0, -64, jsGrid);
  }
  const jsMs = performance.now() - tJs0;

  const tWasm0 = performance.now();
  for (let i = 0; i < N_BENCH; i++) {
    w.compute_coarse_cave_grid(i * 16, -i * 16, mix.ox, mix.oy, mix.oz, mix.c1, mix.c2, mix.c3, mix.c4, 0, -64);
  }
  const wasmMs = performance.now() - tWasm0;

  console.log(
    `[NUCRAFT wasm test] PASS | size=${(bytes.length / 1024).toFixed(2)}KB | ` +
    `maxCaveDiff=${maxCaveDiff.toExponential(2)} | maxLightDiff=${maxLightDiff.toExponential(2)} | ` +
    `40-chunk cave grid: JS=${jsMs.toFixed(1)}ms vs RustWASM=${wasmMs.toFixed(1)}ms`
  );
}

main().catch((err) => {
  console.error('[NUCRAFT wasm test] FAIL:', err);
  process.exit(1);
});
