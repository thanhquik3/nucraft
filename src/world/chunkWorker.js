'use strict';
const CAVE_GRID_X = 5, CAVE_GRID_Y = 65, CAVE_GRID_Z = 5;
let _wasm = null, _wasmInitDone = false, _wasmMemBuf = null, _views = null, _lutsReady = false;
const _pendingMsgs = [];

function _syncWorkerViews() {
  if (!_wasm) return null;
  const buf = _wasm.memory.buffer;
  if (_wasmMemBuf === buf && _views) return _views;
  _wasmMemBuf = buf;
  const ptr = (fn, Ctor, len) => (typeof _wasm[fn] === 'function' ? new Ctor(buf, _wasm[fn](), len) : null);
  const abi = typeof _wasm.wasm_abi_version === 'function' ? (_wasm.wasm_abi_version() | 0) : 1;
  _views = {
    abi,
    coarse: ptr('coarse_grid_ptr', Float32Array, 1625),
    emitters: ptr('emitters_buf_ptr', Float32Array, 3584),
    chunkData: ptr('chunk_data_ptr', Uint16Array, 65536),
    borderBuf: ptr('border_buf_ptr', Uint16Array, 17408),
    autumnCell: ptr('autumn_cell_ptr', Uint8Array, 16),
    lutOpaque: ptr('lut_opaque_ptr', Uint8Array, 2048),
    lutFlags: ptr('lut_flags_ptr', Uint16Array, 2048),
    lutTiles: ptr('lut_block_tiles_ptr', Uint16Array, 2048 * 5),
    lutUv: ptr('lut_tile_uv_ptr', Float32Array, 1024 * 4),
    meshPos: ptr('mesh_pos_ptr', Float32Array, 65536 * 3),
    meshNorm: ptr('mesh_norm_ptr', Float32Array, 65536 * 3),
    meshUv: ptr('mesh_uv_ptr', Float32Array, 65536 * 2),
    meshCol: ptr('mesh_col_ptr', Float32Array, 65536 * 3),
    meshBl: ptr('mesh_bl_ptr', Float32Array, 65536 * 3),
    meshIdx: ptr('mesh_idx_ptr', Uint32Array, 98304),
    specVox: ptr('special_voxels_ptr', Uint16Array, 65536),
    meshMeta: ptr('mesh_meta_ptr', Uint32Array, 4),
    terrainBids: ptr('terrain_bids_ptr', Uint16Array, 64),
    acCoords: ptr('ac_coords_ptr', Int32Array, 8),
    colHeights: ptr('col_heights_ptr', Int16Array, 256),
    colBiomes: ptr('col_biomes_ptr', Uint8Array, 256),
    terrainMeta: ptr('terrain_meta_ptr', Uint32Array, 4),
    lodMask: ptr('lod_mask_ptr', Uint8Array, 4096),
    lodPos: ptr('lod_pos_ptr', Float32Array, 49152 * 3),
    lodNorm: ptr('lod_norm_ptr', Float32Array, 49152 * 3),
    lodCol: ptr('lod_col_ptr', Float32Array, 49152 * 3),
    lodIdx: ptr('lod_idx_ptr', Uint32Array, 73728),
    lodMeta: ptr('lod_meta_ptr', Uint32Array, 4)
  };
  return _views;
}

(function _initWorkerWasm() {
  try {
    if (typeof fetch !== 'function' || typeof WebAssembly !== 'object' || !self.location || self.location.protocol === 'file:') {
      _wasmInitDone = true;
      return;
    }
    const wasmUrl = new URL('../../assets/nucraft_core.wasm?abi=4', self.location.href).href;
    fetch(wasmUrl)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => (buf ? WebAssembly.instantiate(buf, {}) : null))
      .then((res) => {
        if (res && res.instance && res.instance.exports) {
          _wasm = res.instance.exports;
          _syncWorkerViews();
        }
      })
      .catch(() => {})
      .finally(() => {
        _wasmInitDone = true;
        while (_pendingMsgs.length > 0) {
          _handleMsg(_pendingMsgs.shift());
        }
      });
  } catch (_) {
    _wasmInitDone = true;
  }
})();

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

function computeCoarseCaveGrid(wx0, wz0, mix, dOff, minY) {
  const caveGrid = new Float32Array(CAVE_GRID_X * CAVE_GRID_Y * CAVE_GRID_Z);
  if (_wasm) {
    const v = _syncWorkerViews();
    _wasm.compute_coarse_cave_grid(wx0 | 0, wz0 | 0, mix.ox, mix.oy, mix.oz, mix.c1 | 0, mix.c2 | 0, mix.c3 | 0, mix.c4 | 0, dOff | 0, minY | 0);
    caveGrid.set(v.coarse);
    return caveGrid;
  }
  const seedMix = mix;
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

function _packIndexSlice(idxSrc, iCount, vCount) {
  if (vCount <= 65535) {
    const out = new Uint16Array(iCount);
    for (let i = 0; i < iCount; i++) out[i] = idxSrc[i];
    return out;
  }
  return idxSrc.slice(0, iCount);
}

function _handleMsg(m) {
  if (!m) return;

  if (m.type === 'init_luts') {
    if (!_wasm) return;
    const v = _syncWorkerViews();
    if (!v || !v.lutOpaque || !v.lutFlags || !v.lutTiles || !v.lutUv || !v.terrainBids) return;
    if (m.opaque) v.lutOpaque.set(m.opaque);
    if (m.flags) v.lutFlags.set(m.flags);
    if (m.blockTiles) v.lutTiles.set(m.blockTiles);
    if (m.tileUv) v.lutUv.set(m.tileUv);
    if (m.terrainBids) v.terrainBids.set(m.terrainBids);
    _lutsReady = true;
    return;
  }

  if (m.type === 'gen_overworld') {
    const v = _syncWorkerViews();
    if (!_wasm || !_lutsReady || !_wasm.generate_overworld_base_chunk || !v || v.abi < 4 || !v.chunkData || !v.colHeights || !v.colBiomes || !v.terrainMeta || !v.coarse) {
      self.postMessage({ type: 'gen_overworld_err', key: m.key, epoch: m.epoch });
      return;
    }
    if (m.acCoords && v.acCoords) v.acCoords.set(m.acCoords);
    const mix = m.seedMix;
    _wasm.generate_overworld_base_chunk(
      m.cx | 0, m.cz | 0, m.seed | 0,
      mix.ox, mix.oy, mix.oz,
      mix.c1 | 0, mix.c2 | 0, mix.c3 | 0, mix.c4 | 0,
      mix.b1 | 0, mix.b2 | 0, mix.s1 | 0,
      m.dOff | 0, m.minY | 0, m.maxY | 0, m.waterLevel | 0
    );
    const maxLy = v.terrainMeta[0] | 0;
    const isOceanChunk = (v.terrainMeta[1] === 1);
    const uniformBiome = v.terrainMeta[2] | 0;
    const data = v.chunkData.slice(0);
    const colHeights = v.colHeights.slice(0);
    const colBiomes = v.colBiomes.slice(0);
    const caveGrid = isOceanChunk ? new Float32Array(0) : v.coarse.slice(0);
    self.postMessage(
      {
        type: 'gen_overworld_ok',
        key: m.key,
        epoch: m.epoch,
        cx: m.cx | 0,
        cz: m.cz | 0,
        data,
        colHeights,
        colBiomes,
        caveGrid,
        maxLy,
        isOceanChunk,
        uniformBiome
      },
      [data.buffer, colHeights.buffer, colBiomes.buffer, caveGrid.buffer]
    );
    return;
  }

  if (m.type === 'mesh_solid') {
    const v = _syncWorkerViews();
    if (!_wasm || !_lutsReady || !_wasm.mesh_chunk_solid || !v || v.abi < 4 || !v.chunkData || !v.borderBuf || !v.meshPos || !v.meshMeta || !v.specVox) {
      self.postMessage({ type: 'mesh_solid_err', key: m.key, epoch: m.epoch, meshGen: m.meshGen });
      return;
    }
    v.chunkData.fill(0);
    v.chunkData.set(m.data);
    v.borderBuf.set(m.borderBuf);
    if (m.emitLen > 0 && m.emitters) v.emitters.set(m.emitters.subarray(0, m.emitLen));
    if (m.autumnCell) v.autumnCell.set(m.autumnCell);
    const ret = _wasm.mesh_chunk_solid(
      m.wx0 | 0, m.wz0 | 0, m.minY | 0, m.waterLevel | 0, m.dOff | 0,
      m.maxLy >>> 0, m.emitLen >>> 0, m.flagsBits >>> 0,
      m.grassId & 0xffff, m.autumnPodzolId & 0xffff, m.waterId & 0xffff, m.seagrassId & 0xffff,
      m.lavaId & 0xffff, m.bedrockId & 0xffff, m.deepslateId & 0xffff, m.blkSolidFlag & 0xffff
    ) >>> 0;
    if (ret === 0xFFFFFFFF || v.meshMeta[3] !== 0) {
      self.postMessage({ type: 'mesh_solid_err', key: m.key, epoch: m.epoch, meshGen: m.meshGen });
      return;
    }
    const vCount = v.meshMeta[0] >>> 0;
    const iCount = v.meshMeta[1] >>> 0;
    const specCount = v.meshMeta[2] >>> 0;
    const pos = v.meshPos.slice(0, vCount * 3);
    const norm = v.meshNorm.slice(0, vCount * 3);
    const uv = v.meshUv.slice(0, vCount * 2);
    const col = v.meshCol.slice(0, vCount * 3);
    const bl = v.meshBl.slice(0, vCount * 3);
    const idx = _packIndexSlice(v.meshIdx, iCount, vCount);
    const specialVoxels = v.specVox.slice(0, specCount);
    self.postMessage(
      {
        type: 'mesh_solid_ok',
        key: m.key,
        epoch: m.epoch,
        meshGen: m.meshGen,
        cx: m.cx | 0,
        cz: m.cz | 0,
        vCount,
        iCount,
        pos,
        norm,
        uv,
        col,
        bl,
        idx,
        specialVoxels
      },
      [pos.buffer, norm.buffer, uv.buffer, col.buffer, bl.buffer, idx.buffer, specialVoxels.buffer]
    );
    return;
  }

  if (m.type === 'build_lod') {
    const v = _syncWorkerViews();
    if (!_wasm || !_wasm.build_far_lod_mesh || !v || v.abi < 4 || !v.lodMask || !v.lodPos || !v.lodMeta) {
      self.postMessage({ type: 'build_lod_err', epoch: m.epoch });
      return;
    }
    v.lodMask.fill(0);
    if (m.loadedMask) v.lodMask.set(m.loadedMask.subarray(0, Math.min(4096, m.loadedMask.length)));
    _wasm.build_far_lod_mesh(
      m.centerCx | 0, m.centerCz | 0, m.seed | 0, m.waterLevel | 0,
      m.step >>> 0, m.outerRadius >>> 0, m.maskRadius >>> 0
    );
    const vCount = v.lodMeta[0] >>> 0;
    const iCount = v.lodMeta[1] >>> 0;
    const cells = v.lodMeta[2] >>> 0;
    const pos = v.lodPos.slice(0, vCount * 3);
    const norm = v.lodNorm.slice(0, vCount * 3);
    const col = v.lodCol.slice(0, vCount * 3);
    const idx = _packIndexSlice(v.lodIdx, iCount, vCount);
    self.postMessage(
      {
        type: 'build_lod_ok',
        epoch: m.epoch,
        centerCx: m.centerCx | 0,
        centerCz: m.centerCz | 0,
        vCount,
        iCount,
        cells,
        pos,
        norm,
        col,
        idx
      },
      [pos.buffer, norm.buffer, col.buffer, idx.buffer]
    );
    return;
  }

  if (typeof m.wx0 === 'number') {
    const caveGrid = computeCoarseCaveGrid(m.wx0, m.wz0, m.seedMix, m.dOff || 0, m.minY);
    self.postMessage({ id: m.id, key: m.key, caveGrid }, [caveGrid.buffer]);
  }
}

self.onmessage = function (ev) {
  const m = ev && ev.data;
  if (!m) return;
  if (!_wasmInitDone) {
    _pendingMsgs.push(m);
    return;
  }
  _handleMsg(m);
};
