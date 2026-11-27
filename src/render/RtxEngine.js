// NUCRAFT Module: src/render/RtxEngine.js — Three.js renderer, GPU preset detection, RTX shaders & PostFX

  /* ============================================================================
   * 5. RTX ENGINE: 2048px SHADOWS + PLANAR WATER MIRROR + SHADERS + BLOOM COMPOSITOR
   * ============================================================================ */
  const gameStage = document.getElementById('gameStage');
  const canvas = document.getElementById('gameCanvas');
  const _preMobile = (typeof navigator !== 'undefined' && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 920)));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !_preMobile, powerPreference: 'high-performance', stencil: false });
  const _hwProfile = CFG.detectHardwareProfile
    ? CFG.detectHardwareProfile(renderer.getContext())
    : { isMobile: false, isMobilePerf: false, isWeakDevice: false, cores: 8, mem: 8, gpu: { renderer: 'WebGL', isSoftware: false, isDedicated: true } };
  const isTouchInitial = _hwProfile.isMobile;
  const _initMobile = _hwProfile.isMobile;
  const _isWeakDevice = _hwProfile.isWeakDevice;
  const _isMobilePerf = _hwProfile.isMobilePerf;
  const _savedGfx = CFG.loadGfxPrefs
    ? CFG.loadGfxPrefs(_hwProfile)
    : { shaderQuality: _initMobile ? 'low' : 'high', renderDistance: 3, shaderPreset: 'bsl', bumpEnabled: !_initMobile, volumetricClouds: true };
  let _fpsSlow = false, _fpsCheckAcc = 0, _fpsCheckCnt = 0;
  let _autoPerfLow = false, _autoPerfTier = 0, _autoPerfStreak = 0, _autoPerfUpStreak = 0, _autoPerfPrScale = 1.0;
  let _lastShX = 9e9, _lastShY = 9e9, _lastShZ = 9e9, _lastShYaw = 9e9, _lastShPitch = 9e9, _lastShTime = -1;
  let _shadowAcc = 99, _reflAcc = 99, _postFxAcc = 99, _atmoAcc = 99, _previewAcc = 99, _lightAcc = 99, _postFxDirty = true;
  window._nucraftFps = 60;
  window._nucraftCpuMs = 0;
  let renderDistance = _savedGfx.renderDistance, shaderQuality = _savedGfx.shaderQuality;
  let weatherMode = 'auto', rainIntensity = 0, autoWeatherTimer = 45, autoWeatherTarget = 0, lightningFlash = 0, thunderTimer = 8;
  let thirdPerson = 0, hudHidden = false, minimapVisible = true, cameraShake = 0;
  let shaderPreset = _savedGfx.shaderPreset, volumetricClouds = _savedGfx.volumetricClouds, bumpEnabled = _savedGfx.bumpEnabled;
  let currentDimension = 'overworld', depthOffset = 0; // 'overworld' -> dig -1000 -> 'nether' -> dig -1000 -> 'end' | 'sift'

  const _getSharpMaxPR = (q) => {
    const qn = CFG.normalizeQuality ? CFG.normalizeQuality(q, 'high') : q;
    const p = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[qn]) || { maxPixelRatio: 1.0 };
    let res;
    if (_initMobile) res = (qn === 'extreme' || qn === 'ultra') ? Math.min(1.5, p.maxPixelRatio) : Math.min(1.0, p.maxPixelRatio);
    else {
      const ded = !!(_hwProfile && _hwProfile.gpu && _hwProfile.gpu.isDedicated);
      const bigScreen = Math.max(window.innerWidth || 0, window.innerHeight || 0) >= 1500;
      const baseMax = (qn === 'extreme') ? p.maxPixelRatio : ((!ded && bigScreen) ? Math.min(1.25, p.maxPixelRatio) : p.maxPixelRatio);
      res = Math.max(0.75, baseMax * _autoPerfPrScale);
    }
    if (window._cartoonAddonActive) return (_initMobile || _isWeakDevice) ? Math.min(1.0, res) : Math.min(1.25, res);
    return res;
  };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
  renderer.shadowMap.enabled = (shaderQuality !== 'low');
  renderer.shadowMap.type = _initMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.localClippingEnabled = (shaderQuality !== 'low');
  const _useDirectRender = () => ((shaderQuality === 'low' || !!window._cartoonAddonActive || (shaderQuality === 'high' && (!window.sodiumOpts || window.sodiumOpts.sodium !== false))) && !(window.sodiumOpts && (window.sodiumOpts.rayTracing || (window.sodiumOpts.frameGen | 0) > 1)));
  renderer.toneMapping = _useDirectRender() ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = (shaderPreset === 'eclipse') ? 0.97 : 0.95;
  renderer.setClearColor(0x9bc4e8, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9bc4e8, 48, 75);

  const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.08, 780);
  scene.add(camera);

  const sunLight = new THREE.DirectionalLight(0xffe9c4, 1.04);
  sunLight.castShadow = (shaderQuality !== 'low');
  const _shadowRes = 1024;
  sunLight.shadow.mapSize.width = _shadowRes;
  sunLight.shadow.mapSize.height = _shadowRes;
  sunLight.shadow.camera.near = 4;
  sunLight.shadow.camera.far = 110;
  const shadowRad = 24;
  sunLight.shadow.camera.left = -shadowRad;
  sunLight.shadow.camera.right = shadowRad;
  sunLight.shadow.camera.top = shadowRad;
  sunLight.shadow.camera.bottom = -shadowRad;
  sunLight.shadow.bias = -0.00025;
  sunLight.shadow.normalBias = 0.058;
  sunLight.shadow.radius = 2.4;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0x88b4ea, 0x58533a, 0.50);
  scene.add(hemiLight);

  // Lean PointLight Pool (3 Mobile / 4 PC) cuts PBR per-pixel cost ~60%; baked vertex aBlockLight still lights every torch/lantern/lava!
  const dynamicLightPool = [];
  const _poolCount = _initMobile ? 3 : 4;
  for (let i = 0; i < _poolCount; i++) {
    const pl = new THREE.PointLight(0xffb86c, 0, 26, 1.35);
    scene.add(pl);
    dynamicLightPool.push(pl);
  }
  const torchLight = dynamicLightPool[0];

  // Crisp 16:9 Per-Frame Planar Water Reflection RenderTarget (upgraded 384x216 on RTX Ultra)
  const _initGfxP = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality]) || { reflW: 256, reflH: 144 };
  const reflRT = new THREE.WebGLRenderTarget(
    Math.max(160, _initGfxP.reflW || 256),
    Math.max(90, _initGfxP.reflH || 144),
    { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false }
  );
  const reflCam = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 420);
  const reflClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WATER_LEVEL + 0.855));

  const { tex: atlasTex, bumpTex, canvas: atlasCanvas, getSolidTex: getAtlasSolidTex } = buildTextureAtlas();
  const atlasCtx = atlasCanvas.getContext('2d');

  const envUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.45, 0.82, 0.35).normalize() },
    uSunColor: { value: new THREE.Color(0xffe9c4) },
    uSkyTop: { value: new THREE.Color(0x3a7fe0) },
    uSkyHorizon: { value: new THREE.Color(0x9bc4e8) },
    uFogColor: { value: new THREE.Color(0x9bc4e8) },
    uFogStart: { value: 48.0 },
    uFogEnd: { value: 78.0 },
    uQuality: { value: (shaderQuality === 'extreme' || shaderQuality === 'ultra') ? 2.0 : (shaderQuality === 'low' ? 0.0 : 1.0) },
    uWaterQuality: { value: 1.0 },
    uReflMap: { value: reflRT.texture },
    uReflMatrix: { value: new THREE.Matrix4() },
    uUsePlanarRefl: { value: 1.0 },
    uCloudCover: { value: 0.46 },
    uVolumetricClouds: { value: 1.0 },
    uWindStrength: { value: 1.0 },
    uRainWetness: { value: 0.0 },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVis: { value: 0.0 },
    uLightScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
    uShaftStrength: { value: 0.28 },
    uShaftColor: { value: new THREE.Color(0xffe8b6) },
    uVibrance: { value: 0.34 },
    uWarmth: { value: 0.14 },
    uContrast: { value: 0.08 },
    uExposure: { value: 0.96 },
    uSharpness: { value: 0.18 },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uMoonBoost: { value: 0.0 },
    uUnderwater: { value: 0.0 },
    uInLava: { value: 0.0 },
    uWaterDepth: { value: 0.0 },
    uDimension: { value: 0.0 },
    uHasGodRays: { value: 0.0 },
    uChillMode: { value: shaderPreset === 'chill_sunset' ? 1.0 : 0.0 },
    uDlssMode: { value: shaderPreset === 'dlss_ultra' ? 1.0 : 0.0 },
    uEclipseMode: { value: shaderPreset === 'eclipse' ? 1.0 : 0.0 },
    uPlayerPos: { value: new THREE.Vector3() },
    uWakePts: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -999, 0)) },
    uGrassRadius: { value: _isMobilePerf ? 18.0 : 32.0 },
    uGrassSoilRadius: { value: _isMobilePerf ? 16.0 : 24.0 },
    uSurfaceLight: { value: 1.0 },
    uRayTracing: { value: 0.0 },
    uReflClipY: { value: -9999.0 },
    uRtVoxelTex: { value: null },
    uRtOrigin: { value: new THREE.Vector3(-32, -8, -32) },
    uRtQuality: { value: _initMobile ? 0.0 : 1.0 },
    uWindVec: { value: new THREE.Vector2(0, 0) },
    uWindGust: { value: 0.5 },
    uCartoonMode: { value: 0.0 },
    uSulfurWater: { value: 0.0 }
  };

  // Real-time GPU 3D Voxel Acceleration Volume (64x32x64 packed into 512x256 RGBA DataTexture, WebGL1+2 compatible)
  const RT_VOL_W = 64, RT_VOL_H = 32, RT_VOL_D = 64, RT_TEX_W = 512, RT_TEX_H = 256;
  const rtVoxelBytes = new Uint8Array(RT_TEX_W * RT_TEX_H * 4);
  const rtVoxelTex = new THREE.DataTexture(rtVoxelBytes, RT_TEX_W, RT_TEX_H, THREE.RGBAFormat);
  rtVoxelTex.minFilter = THREE.NearestFilter;
  rtVoxelTex.magFilter = THREE.NearestFilter;
  rtVoxelTex.wrapS = THREE.ClampToEdgeWrapping;
  rtVoxelTex.wrapT = THREE.ClampToEdgeWrapping;
  rtVoxelTex.generateMipmaps = false;
  rtVoxelTex.flipY = false;
  rtVoxelTex.needsUpdate = true;
  envUniforms.uRtVoxelTex.value = rtVoxelTex;

  let _rtLutReady = false, _rtLutCap = 0;
  let _rtLutKind = null, _rtLutR = null, _rtLutG = null, _rtLutB = null;
  let _rtLastOx = 9e8, _rtLastOy = 9e8, _rtLastOz = 9e8, _rtLastDim = '';
  let _rtLastBuildMs = 0, _rtBuildMs = 0, _rtUpdates = 0, _rtActiveVoxels = 0;
  function _rtEnsureLut() {
    if (_rtLutReady || typeof BLOCK_DEF === 'undefined' || typeof B === 'undefined') return _rtLutReady;
    const cap = (typeof BLOCK_LUT_CAP !== 'undefined' && BLOCK_LUT_CAP > 0) ? BLOCK_LUT_CAP : 2048;
    _rtLutCap = cap;
    _rtLutKind = new Uint8Array(cap);
    _rtLutR = new Uint8Array(cap);
    _rtLutG = new Uint8Array(cap);
    _rtLutB = new Uint8Array(cap);
    const _EMIT_RGB = {
      [B.LAVA]: [255, 112, 22], [B.MAGMA_BLOCK]: [236, 86, 20], [B.FIRE]: [255, 176, 48], [B.SOUL_FIRE]: [72, 226, 255],
      [B.TORCH_BLOCK]: [255, 194, 80], [B.LANTERN]: [255, 206, 98], [B.SOUL_LANTERN]: [76, 236, 255], [B.CAMPFIRE]: [255, 158, 56],
      [B.SHROOMLIGHT]: [255, 184, 86], [B.SEA_LANTERN]: [166, 246, 240], [B.GLOW_CRYSTAL]: [120, 220, 255], [B.MUSHROOM_GLOW]: [125, 245, 215],
      [B.GLOW_VINES]: [255, 214, 102], [B.END_ROD]: [248, 236, 255], [B.END_PORTAL]: [174, 92, 255], [B.END_GATEWAY]: [148, 78, 245],
      [B.END_PORTAL_FRAME_EYE]: [92, 244, 195], [B.END_CRYSTAL_BLOCK]: [244, 114, 225], [B.NETHER_PORTAL]: [188, 78, 255],
      [B.DREAM_PORTAL]: [110, 235, 255], [B.WARDEN_PORTAL]: [34, 211, 238], [B.CANDLE]: [255, 206, 115], [B.REDSTONE]: [235, 45, 35],
      [B.REDSTONE_ORE]: [215, 55, 48], [B.ICHOR_ORE]: [240, 115, 245], [B.DRAGON_CRYSTAL_ORE]: [195, 95, 255],
      [B.SULFUR_CRYSTAL]: [255, 224, 92], [B.SULFUR_VENT]: [255, 176, 68]
    };
    const _GLASS_SET = new Set([B.ICE, B.PACKED_ICE, B.GLASS, B.BROKEN_GLASS, B.IRON_GRATE, B.PACKED_ICE_SLAB, B.PACKED_ICE_SLAB_TOP].filter(Boolean));
    const _GLOSS_SET = new Set([
      B.OBSIDIAN, B.OBSIDIAN_SLAB, B.OBSIDIAN_SLAB_TOP, B.MARBLE_BRICK, B.MARBLE_BRICK_SLAB, B.MARBLE_BRICK_SLAB_TOP,
      B.COPPER_ROOF, B.COPPER_SLAB, B.COPPER_SLAB_TOP, B.PRISMARINE, B.PRISMARINE_SLAB, B.PRISMARINE_SLAB_TOP,
      B.ELEVATOR_BLOCK, B.NETHERITE_BLOCK, B.BLACKSTONE_BRICKS, B.DEEPSLATE_TILES, B.PURPUR_BLOCK, B.PURPUR_PILLAR,
      B.IRON_CHEST, B.GOLD_CHEST, B.DIAMOND_CHEST, B.NETHERITE_CHEST, B.GOLD_ORE, B.DIAMOND_ORE, B.EMERALD_ORE,
      B.RUBY_ORE, B.LAPIS_ORE, B.QUARTZ_ORE, B.UMBRA_ORE, B.RESONANT_ORE, B.SOULFORGED_ORE, B.ENCHANT_TABLE, B.ANVIL, B.SLIME_BLOCK
    ].filter(Boolean));
    for (let id = 1; id < cap; id++) {
      const d = BLOCK_DEF[id];
      if (!d) continue;
      let r = 136, g = 142, b = 152;
      if (d.mapColor && typeof d.mapColor === 'string' && d.mapColor.charCodeAt(0) === 35 && d.mapColor.length >= 7) {
        const hex = parseInt(d.mapColor.slice(1, 7), 16);
        if (!Number.isNaN(hex)) { r = (hex >> 16) & 255; g = (hex >> 8) & 255; b = hex & 255; }
      }
      if (_EMIT_RGB[id]) {
        const e = _EMIT_RGB[id];
        _rtLutKind[id] = 224; _rtLutR[id] = e[0]; _rtLutG[id] = e[1]; _rtLutB[id] = e[2];
      } else if (d.emissive) {
        _rtLutKind[id] = 224;
        _rtLutR[id] = Math.min(255, Math.round(r * 1.18 + 25));
        _rtLutG[id] = Math.min(255, Math.round(g * 1.18 + 25));
        _rtLutB[id] = Math.min(255, Math.round(b * 1.18 + 25));
      } else if (id === B.WATER) {
        _rtLutKind[id] = 160; _rtLutR[id] = 40; _rtLutG[id] = 150; _rtLutB[id] = 200;
      } else if (_GLASS_SET.has(id) || d.glass) {
        _rtLutKind[id] = 128; _rtLutR[id] = r; _rtLutG[id] = g; _rtLutB[id] = b;
      } else if (d.foliage && d.solid) {
        _rtLutKind[id] = 96; _rtLutR[id] = r; _rtLutG[id] = g; _rtLutB[id] = b;
      } else if (_GLOSS_SET.has(id)) {
        _rtLutKind[id] = 64; _rtLutR[id] = r; _rtLutG[id] = g; _rtLutB[id] = b;
      } else if (d.solid) {
        _rtLutKind[id] = 32; _rtLutR[id] = r; _rtLutG[id] = g; _rtLutB[id] = b;
      }
    }
    _rtLutReady = true;
    return true;
  }

  function updateRayTracingVoxelVolume(force = false) {
    if (envUniforms.uRayTracing.value < 0.5) return false;
    if (typeof player === 'undefined' || !player || typeof chunks === 'undefined' || !_rtEnsureLut()) return false;
    const ox = Math.floor(player.x) - 32;
    const oy = Math.max(MIN_Y, Math.min(MAX_Y - (RT_VOL_H - 1), Math.floor(player.y) - 12));
    const oz = Math.floor(player.z) - 32;
    const dim = (typeof currentDimension === 'string') ? currentDimension : 'overworld';
    const now = performance.now();
    const moved = (Math.abs(ox - _rtLastOx) >= 2 || Math.abs(oy - _rtLastOy) >= 2 || Math.abs(oz - _rtLastOz) >= 2 || dim !== _rtLastDim);
    if (!force && !window._rtVolDirty && !moved) return false;
    if (!force && (now - _rtLastBuildMs) < 42) return false;

    const t0 = performance.now();
    rtVoxelBytes.fill(0);
    let activeVoxels = 0;
    const minWy = Math.max(MIN_Y + 1, oy);
    const maxWy = Math.min(MAX_Y, oy + RT_VOL_H - 1);
    const cMinX = ox >> 4, cMaxX = (ox + RT_VOL_W - 1) >> 4;
    const cMinZ = oz >> 4, cMaxZ = (oz + RT_VOL_D - 1) >> 4;
    for (let cz = cMinZ; cz <= cMaxZ; cz++) {
      for (let cx = cMinX; cx <= cMaxX; cx++) {
        const ch = (typeof _getChunkFast === 'function') ? _getChunkFast(cx, cz) : chunks.get(`${cx},${cz}`);
        if (!ch || !ch.data) continue;
        const data = ch.data;
        const wxBase = cx << 4, wzBase = cz << 4;
        const x0 = Math.max(ox, wxBase), x1 = Math.min(ox + RT_VOL_W - 1, wxBase + 15);
        const z0 = Math.max(oz, wzBase), z1 = Math.min(oz + RT_VOL_D - 1, wzBase + 15);
        const topWy = Math.min(maxWy, MIN_Y + (ch.maxLy || (WORLD_H - 1)));
        for (let wy = minWy; wy <= topWy; wy++) {
          const ly = wy - MIN_Y, vy = wy - oy;
          const tileX = vy & 7, tileY = vy >> 3;
          const lyOff = ly << 8;
          const baseTexX = tileX * 64 + (x0 - ox);
          const baseTexY = tileY * 64;
          for (let wz = z0; wz <= z1; wz++) {
            const lz = wz - wzBase, vz = wz - oz;
            const cRow = lyOff | (lz << 4);
            let pIdx = ((baseTexY + vz) * 512 + baseTexX) * 4;
            for (let wx = x0; wx <= x1; wx++, pIdx += 4) {
              const id = data[cRow | (wx - wxBase)];
              if (!id) continue;
              const kind = _rtLutKind[id];
              if (!kind) continue;
              rtVoxelBytes[pIdx]     = _rtLutR[id];
              rtVoxelBytes[pIdx + 1] = _rtLutG[id];
              rtVoxelBytes[pIdx + 2] = _rtLutB[id];
              rtVoxelBytes[pIdx + 3] = kind;
              activeVoxels++;
            }
          }
        }
      }
    }
    envUniforms.uRtOrigin.value.set(ox, oy, oz);
    if (envUniforms.uRtQuality) envUniforms.uRtQuality.value = (_initMobile || _isWeakDevice || shaderQuality === 'high') ? 0.0 : 1.0;
    rtVoxelTex.needsUpdate = true;
    _rtLastOx = ox; _rtLastOy = oy; _rtLastOz = oz; _rtLastDim = dim;
    _rtLastBuildMs = now;
    _rtBuildMs = +(performance.now() - t0).toFixed(2);
    _rtUpdates++;
    _rtActiveVoxels = activeVoxels;
    window._rtVolDirty = false;
    return true;
  }

  function _getRtStats() {
    return {
      enabled: envUniforms.uRayTracing.value > 0.5,
      qualityMode: envUniforms.uRtQuality ? envUniforms.uRtQuality.value : 0,
      origin: [envUniforms.uRtOrigin.value.x, envUniforms.uRtOrigin.value.y, envUniforms.uRtOrigin.value.z],
      dims: [RT_VOL_W, RT_VOL_H, RT_VOL_D],
      texSize: [RT_TEX_W, RT_TEX_H],
      activeVoxels: _rtActiveVoxels,
      updates: _rtUpdates,
      lastBuildMs: _rtBuildMs,
      shadowMapEnabled: !!renderer.shadowMap.enabled,
      shadowSize: sunLight.shadow.mapSize.width,
      postFxDirect: _useDirectRender()
    };
  }

  // Shared GLSL ES 1.00 Amanatides-Woo 3D Voxel DDA Ray Tracer (Sun Shadows, Colored GI Bounce, Emissive Radiance & Mirror Reflections)
  const RT_DDA_GLSL = `
    uniform sampler2D uRtVoxelTex;
    uniform vec3 uRtOrigin;
    uniform float uRtQuality;
    float rtInVol(vec3 wp) {
      vec3 r = wp - uRtOrigin;
      return smoothstep(0.0, 2.5, r.x) * smoothstep(64.0, 61.5, r.x)
           * smoothstep(0.0, 2.0, r.y) * smoothstep(32.0, 29.5, r.y)
           * smoothstep(0.0, 2.5, r.z) * smoothstep(64.0, 61.5, r.z);
    }
    vec4 rtSampleVoxel(vec3 rel) {
      if (rel.x < 0.0 || rel.x >= 64.0 || rel.y < 0.0 || rel.y >= 32.0 || rel.z < 0.0 || rel.z >= 64.0) return vec4(0.0);
      float vx = floor(rel.x);
      float vy = floor(rel.y);
      float vz = floor(rel.z);
      float tileY = floor(vy * 0.125 + 0.0001);
      float tileX = vy - tileY * 8.0;
      vec2 uv = vec2((tileX * 64.0 + vx + 0.5) / 512.0, (tileY * 64.0 + vz + 0.5) / 256.0);
      return texture2D(uRtVoxelTex, uv);
    }
    vec3 rtTraceSunShadow(vec3 wp, vec3 nrm, vec3 sunDir, out float shDist) {
      shDist = 32.0;
      vec3 p0 = wp + nrm * 0.07;
      vec3 invD = vec3(abs(sunDir.x) > 1e-4 ? 1.0 / sunDir.x : 1e4, abs(sunDir.y) > 1e-4 ? 1.0 / sunDir.y : 1e4, abs(sunDir.z) > 1e-4 ? 1.0 / sunDir.z : 1e4);
      vec3 sgn = vec3(sunDir.x >= 0.0 ? 1.0 : -1.0, sunDir.y >= 0.0 ? 1.0 : -1.0, sunDir.z >= 0.0 ? 1.0 : -1.0);
      vec3 cell = floor(p0);
      vec3 tMax = (cell + max(sgn, vec3(0.0)) - p0) * invD;
      vec3 tDelta = abs(invD);
      vec3 tr = vec3(1.0);
      float hitT = 0.0;
      for (int i = 0; i < 22; i++) {
        if (tMax.x < tMax.y) {
          if (tMax.x < tMax.z) { hitT = tMax.x; cell.x += sgn.x; tMax.x += tDelta.x; }
          else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; }
        } else {
          if (tMax.y < tMax.z) { hitT = tMax.y; cell.y += sgn.y; tMax.y += tDelta.y; }
          else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; }
        }
        vec3 rel = cell - uRtOrigin;
        if (rel.x < 0.0 || rel.x >= 64.0 || rel.y < 0.0 || rel.y >= 32.0 || rel.z < 0.0 || rel.z >= 64.0) break;
        vec4 vox = rtSampleVoxel(rel);
        float k = vox.a * 255.0;
        if (k < 16.0 || k >= 192.0) continue;
        if (k >= 144.0) {
          tr *= vec3(0.84, 0.94, 0.98);
          continue;
        }
        if (k >= 112.0) {
          shDist = min(shDist, hitT);
          tr *= clamp(vox.rgb * 0.72 + vec3(0.24), 0.22, 0.88);
          if (max(tr.r, max(tr.g, tr.b)) < 0.06) break;
          continue;
        }
        if (k >= 80.0) {
          shDist = min(shDist, hitT);
          tr *= clamp(vox.rgb * 0.56 + vec3(0.08), 0.14, 0.52);
          if (max(tr.r, max(tr.g, tr.b)) < 0.06) break;
          continue;
        }
        shDist = hitT;
        return vec3(0.0);
      }
      return tr;
    }
    vec4 rtTraceGI(vec3 wp, vec3 nrm, vec3 sunDir, vec3 skyCol, vec3 sunCol, float sunUp, float ign, float camDist) {
      vec3 upAxis = abs(nrm.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 tU = normalize(cross(upAxis, nrm));
      vec3 tV = cross(nrm, tU);
      vec3 p0 = wp + nrm * 0.07;
      float nRays = (uRtQuality > 0.5 && camDist < 22.0) ? 4.0 : 2.0;
      float maxStepsF = (uRtQuality > 0.5 && camDist < 22.0) ? 9.0 : 7.0;
      float ang0 = ign * 6.2831853;
      vec3 bounce = vec3(0.0), emit = vec3(0.0);
      float skyVis = 0.0;
      for (int ri = 0; ri < 4; ri++) {
        if (float(ri) >= nRays) break;
        float fracR = (float(ri) + 0.5) / nRays;
        float phi = ang0 + float(ri) * 2.3999632;
        float rSin = sqrt(clamp(0.18 + fracR * 0.72, 0.05, 0.96));
        float rCos = sqrt(max(0.04, 1.0 - rSin * rSin));
        vec3 rd = normalize(tU * (cos(phi) * rSin) + tV * (sin(phi) * rSin) + nrm * rCos);
        vec3 invD = vec3(abs(rd.x) > 1e-4 ? 1.0 / rd.x : 1e4, abs(rd.y) > 1e-4 ? 1.0 / rd.y : 1e4, abs(rd.z) > 1e-4 ? 1.0 / rd.z : 1e4);
        vec3 sgn = vec3(rd.x >= 0.0 ? 1.0 : -1.0, rd.y >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
        vec3 cell = floor(p0);
        vec3 tMax = (cell + max(sgn, vec3(0.0)) - p0) * invD;
        vec3 tDelta = abs(invD);
        float hitT = 0.0;
        vec3 hitN = vec3(0.0, 1.0, 0.0);
        bool hitSolid = false;
        for (int si = 0; si < 9; si++) {
          if (float(si) >= maxStepsF) break;
          if (tMax.x < tMax.y) {
            if (tMax.x < tMax.z) { hitT = tMax.x; cell.x += sgn.x; tMax.x += tDelta.x; hitN = vec3(-sgn.x, 0.0, 0.0); }
            else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; hitN = vec3(0.0, 0.0, -sgn.z); }
          } else {
            if (tMax.y < tMax.z) { hitT = tMax.y; cell.y += sgn.y; tMax.y += tDelta.y; hitN = vec3(0.0, -sgn.y, 0.0); }
            else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; hitN = vec3(0.0, 0.0, -sgn.z); }
          }
          vec3 rel = cell - uRtOrigin;
          if (rel.x < 0.0 || rel.x >= 64.0 || rel.y < 0.0 || rel.y >= 32.0 || rel.z < 0.0 || rel.z >= 64.0) break;
          vec4 vox = rtSampleVoxel(rel);
          float k = vox.a * 255.0;
          if (k < 16.0 || (k >= 144.0 && k < 192.0)) continue;
          if (k >= 192.0) {
            float attE = 1.0 / (1.0 + hitT * hitT * 0.055);
            emit += vox.rgb * attE * 2.20;
            hitSolid = true;
            break;
          }
          float hNdL = max(dot(hitN, sunDir), 0.0);
          vec3 hIrr = sunCol * (hNdL * sunUp * 1.48) + skyCol * (0.28 + 0.34 * max(hitN.y, 0.0)) * (0.30 + 0.70 * sunUp);
          float attB = 1.0 / (1.0 + hitT * 0.20);
          bounce += vox.rgb * hIrr * attB;
          hitSolid = true;
          break;
        }
        if (!hitSolid) skyVis += 1.0;
      }
      return vec4((bounce + emit) / nRays, skyVis / nRays);
    }
    vec4 rtTraceReflection(vec3 wp, vec3 rd, vec3 sunDir, vec3 sunCol, vec3 skyTop, vec3 skyHor, float sunUp, float distScale) {
      vec3 p0 = wp;
      vec3 invD = vec3(abs(rd.x) > 1e-4 ? 1.0 / rd.x : 1e4, abs(rd.y) > 1e-4 ? 1.0 / rd.y : 1e4, abs(rd.z) > 1e-4 ? 1.0 / rd.z : 1e4);
      vec3 sgn = vec3(rd.x >= 0.0 ? 1.0 : -1.0, rd.y >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
      vec3 cell = floor(p0);
      vec3 tMax = (cell + max(sgn, vec3(0.0)) - p0) * invD;
      vec3 tDelta = abs(invD);
      float hitT = 0.0;
      vec3 hitN = vec3(0.0, 1.0, 0.0);
      float maxSt = (uRtQuality > 0.5) ? 28.0 : 18.0;
      for (int i = 0; i < 28; i++) {
        if (float(i) >= maxSt) break;
        if (tMax.x < tMax.y) {
          if (tMax.x < tMax.z) { hitT = tMax.x; cell.x += sgn.x; tMax.x += tDelta.x; hitN = vec3(-sgn.x, 0.0, 0.0); }
          else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; hitN = vec3(0.0, 0.0, -sgn.z); }
        } else {
          if (tMax.y < tMax.z) { hitT = tMax.y; cell.y += sgn.y; tMax.y += tDelta.y; hitN = vec3(0.0, -sgn.y, 0.0); }
          else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; hitN = vec3(0.0, 0.0, -sgn.z); }
        }
        vec3 rel = cell - uRtOrigin;
        if (rel.x < 0.0 || rel.x >= 64.0 || rel.y < 0.0 || rel.y >= 32.0 || rel.z < 0.0 || rel.z >= 64.0) break;
        vec4 vox = rtSampleVoxel(rel);
        float k = vox.a * 255.0;
        if (k < 16.0 || (k >= 144.0 && k < 192.0)) continue;
        float fade = 1.0 - smoothstep(distScale * 0.68, distScale, hitT);
        if (k >= 192.0) return vec4(vox.rgb * 1.42, fade);
        float hNdL = max(dot(hitN, sunDir), 0.0);
        vec3 hSky = mix(skyHor, skyTop, clamp(hitN.y * 0.45 + 0.45, 0.0, 1.0));
        vec3 hSun = sunCol * hNdL * sunUp * 0.94 + hSky * (0.22 + 0.36 * sunUp) + vec3(0.06, 0.11, 0.22) * (1.0 - sunUp);
        return vec4(vox.rgb * hSun, fade);
      }
      return vec4(0.0);
    }
    vec4 rtTraceRefractFloor(vec3 wp, vec3 rd) {
      vec3 p0 = wp;
      vec3 invD = vec3(abs(rd.x) > 1e-4 ? 1.0 / rd.x : 1e4, abs(rd.y) > 1e-4 ? 1.0 / rd.y : 1e4, abs(rd.z) > 1e-4 ? 1.0 / rd.z : 1e4);
      vec3 sgn = vec3(rd.x >= 0.0 ? 1.0 : -1.0, rd.y >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
      vec3 cell = floor(p0);
      vec3 tMax = (cell + max(sgn, vec3(0.0)) - p0) * invD;
      vec3 tDelta = abs(invD);
      float hitT = 0.0;
      for (int i = 0; i < 6; i++) {
        if (tMax.x < tMax.y) {
          if (tMax.x < tMax.z) { hitT = tMax.x; cell.x += sgn.x; tMax.x += tDelta.x; }
          else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; }
        } else {
          if (tMax.y < tMax.z) { hitT = tMax.y; cell.y += sgn.y; tMax.y += tDelta.y; }
          else { hitT = tMax.z; cell.z += sgn.z; tMax.z += tDelta.z; }
        }
        vec3 rel = cell - uRtOrigin;
        if (rel.x < 0.0 || rel.x >= 64.0 || rel.y < 0.0 || rel.y >= 32.0 || rel.z < 0.0 || rel.z >= 64.0) break;
        vec4 vox = rtSampleVoxel(rel);
        float k = vox.a * 255.0;
        if (k < 16.0 || (k >= 144.0 && k < 192.0)) continue;
        return vec4(vox.rgb, exp(-hitT * 0.34));
      }
      return vec4(0.0);
    }
  `;

  // Crisp 16x16 Pixel-Art Terrain Material w/ Linear-Rich BSL/Complementary Albedo, Warm Sun vs Soft Balanced Shadows & Anti-Glare Shoulder
  const terrainMat = new THREE.MeshStandardMaterial({
    map: atlasTex,
    bumpMap: bumpTex,
    bumpScale: 0.056,
    alphaTest: 0.45,
    roughness: 0.90,
    metalness: 0.02,
    vertexColors: true
  });
  terrainMat.customProgramCacheKey = () => 'luanti_terrain_bsl_v75';
  terrainMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: envUniforms.uTime, uSunDir: envUniforms.uSunDir,
      uSunColor: envUniforms.uSunColor, uSkyTop: envUniforms.uSkyTop, uSkyHorizon: envUniforms.uSkyHorizon,
      uRainWetness: envUniforms.uRainWetness,
      uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uUnderwater: envUniforms.uUnderwater, uInLava: envUniforms.uInLava, uWaterDepth: envUniforms.uWaterDepth, uDimension: envUniforms.uDimension,
      uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode,
      uEclipseMode: envUniforms.uEclipseMode, uPlayerPos: envUniforms.uPlayerPos, uGrassRadius: envUniforms.uGrassRadius,
      uGrassSoilRadius: envUniforms.uGrassSoilRadius, uSurfaceLight: envUniforms.uSurfaceLight, uRayTracing: envUniforms.uRayTracing,
      uRtVoxelTex: envUniforms.uRtVoxelTex, uRtOrigin: envUniforms.uRtOrigin, uRtQuality: envUniforms.uRtQuality,
      uCartoonMode: envUniforms.uCartoonMode
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBlockLight = aBlockLight;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uRainWetness, uFogStart, uFogEnd, uUnderwater, uInLava, uWaterDepth, uDimension, uQuality, uChillMode, uDlssMode, uEclipseMode, uGrassRadius, uGrassSoilRadius, uSurfaceLight, uRayTracing, uCartoonMode;
        uniform vec3 uSunDir, uSunColor, uFogColor, uSkyTop, uSkyHorizon, uPlayerPos;
        varying vec3 vBlockLight, vWPos, vWNorm;
        ${RT_DDA_GLSL}
        // Authentic BSL / Eclipse Rotated Cellular Underwater Caustics
        float waterCaustics(vec3 wp, float t) {
          vec2 p = wp.xz * 0.44 - wp.y * vec2(0.28, 0.22);
          vec2 w1 = p + vec2(sin(p.y * 1.55 + t * 1.15), cos(p.x * 1.45 - t * 0.98)) * 0.50;
          float a = abs(sin(w1.x * 1.85 + t * 0.86) + cos(w1.y * 2.05 - t * 0.78));
          vec2 w2 = p * 1.32 + vec2(cos(p.y * 1.85 - t * 1.05), sin(p.x * 1.75 + t * 1.18)) * 0.44;
          float b = abs(sin(w2.x * 1.72 - t * 0.94) + cos(w2.y * 1.82 + t * 0.88));
          float web = pow(clamp(1.0 - min(a, b) * 0.56, 0.0, 1.0), 3.4);
          float pool = pow(clamp(1.0 - (a + b) * 0.27, 0.0, 1.0), 2.1) * 0.42;
          float baseC = clamp(web * 0.90 + pool, 0.0, 1.25);
          if (uEclipseMode > 0.5) {
            vec2 ep = wp.xz * 0.52 - wp.y * vec2(0.30, 0.24);
            mat2 rotE = mat2(-0.73736, -0.67549, 0.67549, -0.73736);
            float mov = t * 0.78;
            float rSum = 0.0;
            vec2 rp = ep;
            for (int ei = 0; ei < 3; ei++) {
              rp = rotE * rp * 1.16 + vec2(mov * 0.42, -mov * 0.36);
              float ridge = abs(sin(rp.x * 1.85 + cos(rp.y * 1.65 + mov * 0.5)) + cos(rp.y * 1.95 - sin(rp.x * 1.55 - mov * 0.4)));
              rSum += pow(clamp(1.0 - ridge * 0.54, 0.0, 1.0), 3.2);
            }
            return clamp(mix(baseC, rSum * 0.78, 0.76), 0.0, 1.55);
          }
          return baseC;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // True original terrain block colors (preserve green grass, warm soil, autumn podzol & blue grass natively)
        diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(1.01));
        float greenDom = max(0.0, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
        float orangeDom = max(0.0, diffuseColor.r - diffuseColor.b) * smoothstep(0.14, 0.58, diffuseColor.g) * step(diffuseColor.g, diffuseColor.r);
        if (uEclipseMode > 0.5 && vWNorm.y > 0.9 && (greenDom > 0.03 || orangeDom > 0.08)) {
          float gDistFade = smoothstep(-30.0, 25.0, length(vWPos - cameraPosition));
          float inGrassRad = smoothstep(uGrassRadius, uGrassRadius * 0.58, length(vWPos.xz - uPlayerPos.xz));
          float rootTint = orangeDom > 0.08 ? mix(0.76, 1.0, gDistFade) : gDistFade;
          diffuseColor.rgb *= mix(1.0, rootTint, inGrassRad);
        }
        float upW = clamp(vWNorm.y, 0.0, 1.0);
        float shoreWet = smoothstep(1.35, 0.72, vWPos.y) * smoothstep(-3.0, 0.0, vWPos.y);
        float wetAmt = clamp(max(shoreWet, uRainWetness * upW * 0.85), 0.0, 1.0) * (1.0 - uCartoonMode);
        diffuseColor.rgb *= mix(1.0, 0.86, wetAmt);
        if (uCartoonMode > 0.5) {
          float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
          float mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
          float sat = mx - mn;
          vec3 cBase = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(1.06));
          vec3 boosted = mix(vec3((cBase.r + cBase.g + cBase.b) * 0.3333), cBase, 1.24);
          diffuseColor.rgb = clamp(mix(boosted, boosted * (1.05 + upW * 0.07), sat > 0.02 ? 1.0 : 0.45), 0.0, 1.0);
        } else {
          float tLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 earthy = mix(vec3(tLum), diffuseColor.rgb, 1.04);
          earthy += vec3(0.035, 0.008, -0.025) * orangeDom;
          diffuseColor.rgb = clamp(earthy, 0.0, 1.0);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float upR = clamp(vWNorm.y, 0.0, 1.0);
        float wetR = clamp(max(smoothstep(1.35, 0.72, vWPos.y), uRainWetness * upR * 0.9), 0.0, 1.0);
        float surfMaskR = clamp(uSurfaceLight, 0.0, 1.0);
        float puddleMaskR = smoothstep(-0.15, 0.55, sin(vWPos.x * 0.42 + cos(vWPos.z * 0.37)) * cos(vWPos.z * 0.48 - sin(vWPos.x * 0.31))) * upR * uRainWetness * surfMaskR;
        roughnessFactor = mix(roughnessFactor, 0.22, clamp(wetR * 0.72 * surfMaskR + puddleMaskR * 0.55, 0.0, 0.86));
        roughnessFactor = mix(roughnessFactor, max(0.18, roughnessFactor * 0.72), uRayTracing * 0.45);`)
      .replace('#include <opaque_fragment>', `
        vec3 sunL = normalize(uSunDir);
        vec3 nrmW = normalize(vWNorm);
        vec3 viewW = normalize(cameraPosition - vWPos);
        float sunUpB = smoothstep(-0.08, 0.25, sunL.y);
        float ndlRaw = dot(nrmW, sunL);
        float dirWrap = clamp(ndlRaw * 0.5 + 0.5, 0.0, 1.0);
        // Warm Sunlight vs Sculptural Hemispheric GI & Cool Indigo-Twilight Shadows + Puddle Specular Shimmer
        bool isUltraQ = (uQuality > 1.5);
        bool isLowQ = (uQuality < 0.5);
        float albLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float whiteDamp = 1.0 - smoothstep(0.58, 0.94, albLum) * 0.30 * sunUpB;
        float shadeCool = pow(1.0 - dirWrap, 1.35) * mix(0.08 + 0.11 * sunUpB, 0.06 + 0.11 * sunUpB, uCartoonMode);
        vec3 baseShTint = isUltraQ ? vec3(0.80, 0.88, 1.05) : vec3(0.82, 0.89, 1.04);
        vec3 calmRegShTint = isUltraQ ? vec3(0.78, 0.86, 1.04) : vec3(0.80, 0.88, 1.04);
        vec3 shadowTint = mix(mix(calmRegShTint, baseShTint, uEclipseMode), vec3(0.74, 0.81, 1.05), uChillMode);
        shadowTint = mix(shadowTint, vec3(0.78, 0.86, 1.06), uDlssMode * 0.60);
        shadowTint = mix(shadowTint, vec3(0.76, 0.85, 1.06), uEclipseMode * 0.75);
        outgoingLight = mix(outgoingLight, outgoingLight * shadowTint, shadeCool * (isUltraQ ? 1.18 : 1.05) * (1.0 + uDlssMode * 0.10 + uEclipseMode * 0.12));
        float extSun = sunUpB * clamp(uSurfaceLight, 0.0, 1.0);
        float skyHemi = clamp(nrmW.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 bounceGnd = mix(vec3(0.50, 0.37, 0.24), vec3(0.58, 0.34, 0.18), uChillMode);
        float rtFade = 0.0;
        vec4 rtGiOut = vec4(0.0, 0.0, 0.0, 1.0);
        vec3 rtShCol = vec3(1.0);
        float rtShMask = 1.0;
        float rtCamD = length(cameraPosition - vWPos);
        if (uRayTracing > 0.5 && rtCamD < 44.0) {
          rtFade = rtInVol(vWPos) * (1.0 - smoothstep(32.0, 44.0, rtCamD));
          if (rtFade > 0.01) {
            float rtIgn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (sunUpB > 0.02 && ndlRaw > -0.10) {
              float rtShDist = 32.0;
              rtShCol = rtTraceSunShadow(vWPos, nrmW, sunL, rtShDist);
              rtShMask = dot(rtShCol, vec3(0.3333));
            }
            rtGiOut = rtTraceGI(vWPos, nrmW, sunL, mix(uSkyHorizon, uSkyTop, 0.45), uSunColor, sunUpB, rtIgn, rtCamD);
          }
        }
        float rtAO = mix(1.0, 0.22 + 0.78 * pow(clamp(rtGiOut.a, 0.0, 1.0), 1.35), rtFade * 0.94);
        outgoingLight *= rtAO;
        if (rtFade > 0.01 && sunUpB > 0.02) {
          float rtLitFade = rtFade * smoothstep(-0.02, 0.25, ndlRaw);
          if (ndlRaw > -0.02 && rtShMask < 0.05) {
            outgoingLight *= mix(1.0, 0.38, rtLitFade * 0.84);
          } else if (ndlRaw > -0.02 && rtShMask < 0.94) {
            outgoingLight *= mix(vec3(1.0), clamp(rtShCol * 1.24 + vec3(0.16), 0.20, 1.0), rtLitFade * 0.86);
          } else if (ndlRaw > 0.02) {
            outgoingLight += diffuseColor.rgb * uSunColor * (0.065 * smoothstep(0.02, 0.55, ndlRaw) * rtShMask * rtFade * extSun);
          }
          outgoingLight += diffuseColor.rgb * mix(uSkyHorizon, uSkyTop, 0.65) * (0.048 * (1.0 - smoothstep(-0.1, 0.5, ndlRaw)) * rtGiOut.a * rtFade * extSun);
        }
        outgoingLight += diffuseColor.rgb * mix(bounceGnd, uSkyTop, skyHemi) * (0.072 + 0.014 * uChillMode + 0.016 * uDlssMode + 0.020 * uEclipseMode) * extSun * (1.0 - rtFade * 0.65);
        outgoingLight += diffuseColor.rgb * rtGiOut.rgb * (1.18 + 0.48 * (1.0 - rtGiOut.a)) * rtFade;
        float sunLitMask = smoothstep(-0.05, 0.75, ndlRaw) * extSun * mix(1.0, rtShMask, rtFade * 0.94);
        float chillSunBoost = 1.0 + uChillMode * 0.10 + uDlssMode * 0.08 + uEclipseMode * 0.10 + rtFade * 0.20;
        outgoingLight += diffuseColor.rgb * uSunColor * ((isUltraQ ? 0.034 : 0.026) * chillSunBoost * sunLitMask * whiteDamp * mix(1.0, 0.45, uCartoonMode));
        if (!isLowQ) {
          vec3 halfT = normalize(sunL + viewW);
          float specT = pow(max(dot(nrmW, halfT), 0.0), mix(isUltraQ ? 48.0 : 36.0, 64.0, max(uDlssMode, uEclipseMode * 0.85))) * sunLitMask * ((isUltraQ ? 0.007 : 0.004) * chillSunBoost * whiteDamp + uDlssMode * 0.012 * whiteDamp + uEclipseMode * 0.010 * whiteDamp + uRayTracing * 0.032 * whiteDamp + uRainWetness * (isUltraQ ? 0.14 : 0.09));
          outgoingLight += uSunColor * specT;
          float puddleO = smoothstep(-0.15, 0.55, sin(vWPos.x * 0.42 + cos(vWPos.z * 0.37)) * cos(vWPos.z * 0.48 - sin(vWPos.x * 0.31))) * clamp(nrmW.y, 0.0, 1.0) * uRainWetness * clamp(uSurfaceLight, 0.0, 1.0);
          float puddleShim = puddleO * (0.14 + 0.10 * sin(uTime * 7.5 + vWPos.x * 5.0 + vWPos.z * 5.0));
          outgoingLight += mix(uSkyHorizon, uSunColor, 0.45 * uChillMode) * puddleShim * 0.14;
          if (isUltraQ || uChillMode > 0.5 || uDlssMode > 0.5 || uEclipseMode > 0.5 || uRayTracing > 0.5) {
            float fresT = pow(1.0 - max(dot(nrmW, viewW), 0.0), 3.8);
            vec3 fresTint = mix(mix(uSkyHorizon, uSkyTop, 0.45), mix(uSkyHorizon, uSunColor, 0.55), max(uChillMode, uEclipseMode * 0.6));
            outgoingLight += fresTint * fresT * (0.026 + 0.020 * uChillMode + 0.022 * uDlssMode + 0.024 * uEclipseMode + rtFade * 0.044 + uRainWetness * 0.08) * extSun * mix(1.0, rtGiOut.a, rtFade * 0.6);
          }
        }
        if (rtFade > 0.02 && rtCamD < 28.0) {
          vec4 rtSelf = rtSampleVoxel((vWPos - nrmW * 0.08) - uRtOrigin);
          float rtSelfK = rtSelf.a * 255.0;
          if (rtSelfK >= 192.0) {
            outgoingLight += diffuseColor.rgb * 0.34 * rtFade;
          } else {
            float rtFres = pow(1.0 - clamp(dot(nrmW, viewW), 0.0, 1.0), 2.8);
            float rtGloss = (rtSelfK >= 112.0 && rtSelfK < 144.0) ? 0.64 : ((rtSelfK >= 48.0 && rtSelfK < 80.0) ? 0.42 : (0.14 * rtFres * clamp(uSurfaceLight * 0.7 + 0.3, 0.0, 1.0)));
            float rtWetRefl = clamp((wetAmt * 0.36 + clamp(uRainWetness, 0.0, 1.0) * smoothstep(0.55, 0.95, nrmW.y) * 0.40) * clamp(uSurfaceLight, 0.0, 1.0), 0.0, 0.46);
            float rtSpecAmt = max(rtGloss, rtWetRefl);
            if (rtSpecAmt > 0.04) {
              vec3 rtRDir = reflect(-viewW, nrmW);
              vec4 rtRefl = rtTraceReflection(vWPos + nrmW * 0.08, rtRDir, sunL, uSunColor, uSkyTop, uSkyHorizon, sunUpB, 22.0);
              vec3 rtSkyR = mix(uSkyHorizon, uSkyTop, clamp(rtRDir.y * 0.6 + 0.3, 0.0, 1.0)) * (0.30 + 0.70 * sunUpB);
              vec3 rtRCol = mix(rtSkyR, rtRefl.rgb, rtRefl.a);
              float rtRMix = clamp(rtSpecAmt * (0.28 + 0.72 * rtFres) * rtFade * (1.0 - smoothstep(18.0, 28.0, rtCamD)), 0.0, 0.72);
              outgoingLight = mix(outgoingLight, rtRCol * (0.42 + 0.68 * diffuseColor.rgb), rtRMix);
            }
          }
        }
        // Murky Marine Depth Absorption (Eclipse Water_Absorb + underwater caustics)
        if (uDimension < 0.5 && vWPos.y < 0.86 && (uUnderwater > 0.5 || vWPos.y > -18.0)) {
          float wDepth = max(0.0, 0.86 - vWPos.y);
          vec3 absorbK = uEclipseMode > 0.5
            ? (uUnderwater > 0.5 ? vec3(0.392389, 0.108329, 0.0660636) * 0.28 : vec3(0.392389, 0.108329, 0.0660636))
            : (uUnderwater > 0.5 ? vec3(0.11, 0.032, 0.028) : vec3(0.40, 0.22, 0.15));
          vec3 waterAbsorb = exp(-wDepth * absorbK);
          outgoingLight *= mix(vec3(1.0), waterAbsorb, 0.94);
          float subMurk = 1.0 - exp(-wDepth * (uUnderwater > 0.5 ? 0.04 : 0.28));
          vec3 deepSeaTint = mix(vec3(0.012, 0.11, 0.22), vec3(0.008, 0.072, 0.14), clamp(wDepth * 0.12, 0.0, 1.0)) * (0.18 + 0.82 * sunUpB);
          outgoingLight = mix(outgoingLight, deepSeaTint, clamp(subMurk, 0.0, 0.88));
          if (!isLowQ && uUnderwater > 0.5 && sunUpB > 0.05 && wDepth < 20.0) {
            float sideFace = 0.55 + 0.45 * clamp(vWNorm.y, 0.0, 1.0);
            float caust = waterCaustics(vWPos, uTime) * exp(-wDepth * 0.11) * sunUpB * sideFace * mix(1.0, 1.38, uRayTracing);
            outgoingLight += (diffuseColor.rgb * 0.45 + vec3(0.10, 0.24, 0.28)) * vec3(0.36, 0.78, 0.82) * caust * 0.36 * waterAbsorb;
          }
        }
        float surfLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float blockLightGain = mix(1.90, (uUnderwater > 0.5 ? 1.18 : 0.76), smoothstep(0.08, 0.60, surfLuma) * (0.25 + 0.75 * sunUpB * clamp(uSurfaceLight, 0.0, 1.0))) * mix(1.0, 1.24, uRayTracing);
        vec3 blockAdd = vBlockLight * (diffuseColor.rgb + vec3(0.055)) * blockLightGain;
        outgoingLight += blockAdd / (vec3(1.0) + max(outgoingLight, vec3(0.0)) * 1.10 + blockAdd * 0.52);
        // Pre-RT sub-unity highlight shoulder keeps bricks & lamps vivid without channel clipping or yellow washout
        float outPeak = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        float outLum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float hiMetric = mix(outLum, outPeak, 0.55);
        float hiCapT = mix(mix(0.86, 0.96, uRayTracing), 0.74, uCartoonMode);
        if (hiMetric > hiCapT) {
          float overH = hiMetric - hiCapT;
          float compLum = hiCapT + overH / (1.0 + overH * mix(1.55, 1.15, uRayTracing));
          outgoingLight *= (compLum / max(hiMetric, 0.0001));
        }
        #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
        vec3 viewVecF = vWPos - cameraPosition;
        float distF = length(viewVecF);
        vec3 viewDirF = viewVecF / max(distF, 0.0001);
        if (uInLava > 0.5) {
          float lvFog = smoothstep(0.30, 3.05, distF);
          gl_FragColor.rgb = mix(gl_FragColor.rgb * vec3(1.12, 0.56, 0.32), uFogColor, clamp(lvFog, 0.0, 0.995));
        } else if (uUnderwater > 0.5) {
          float abyssK = clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0);
          float fogDens = mix(0.036, 0.095, abyssK);
          float uwFog = 1.0 - exp(-distF * fogDens);
          vec3 uwTopCol = uFogColor * vec3(1.16, 1.38, 1.52);
          vec3 uwBotCol = uFogColor * vec3(0.24, 0.36, 0.54);
          vec3 uwCol = mix(uwBotCol, uwTopCol, smoothstep(-0.62, 0.68, viewDirF.y));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uwCol, clamp(uwFog, 0.0, 0.985));
        } else {
          float fogFactor = smoothstep(uFogStart, uFogEnd, distF);
          float mistLow = exp(-max(vWPos.y - 2.0, 0.0) * 0.12) * smoothstep(26.0, 74.0, distF) * mix(0.20, 0.24, max(uChillMode, uEclipseMode));
          float scatterAmt = clamp(max(fogFactor * 0.84, mistLow), 0.0, 0.86);
          scatterAmt = mix(scatterAmt, scatterAmt * 0.88, uDlssMode);
          vec3 fSun = normalize(uSunDir);
          vec3 activeSunF = fSun.y > -0.05 ? fSun : -fSun;
          vec3 activeColF = fSun.y > -0.05 ? uSunColor : vec3(0.42, 0.62, 0.96);
          float noonTame = 1.0 - smoothstep(0.45, 0.92, fSun.y) * mix(0.68, 0.42, uEclipseMode);
          float sunScatter = pow(max(dot(viewDirF, activeSunF), 0.0), mix(7.0, 4.4, max(uChillMode, uEclipseMode))) * (fSun.y > -0.05 ? smoothstep(-0.1, 0.25, fSun.y) * noonTame : 0.35);
          vec3 aerialMistCol = vec3(0.663, 0.741, 0.816) * (0.14 + 0.86 * smoothstep(-0.10, 0.20, fSun.y));
          vec3 fogBase = mix(uFogColor * mix(1.00, 0.92, smoothstep(0.45, 0.92, fSun.y)), aerialMistCol, 0.35 * (1.0 - uCartoonMode));
          vec3 scatterCol = mix(fogBase, min(activeColF * mix(0.90, 1.04, max(uChillMode, uEclipseMode)), vec3(1.0, 0.93, 0.82)), sunScatter * mix(0.14, 0.36, max(uChillMode, uEclipseMode)));
          float blLumaT = max(vBlockLight.r, max(vBlockLight.g, vBlockLight.b));
          float lightFogResistT = 1.0 - clamp(blLumaT * 0.80, 0.0, 0.84);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, scatterCol, scatterAmt * lightFogResistT);
        }
        gl_FragColor.a = 1.0;`);
  };

  // Razor-Sharp Fancy Leaves Material w/ Velvety Canopy Shade, True Sakura Pink & Warm Golden Backlit SSS
  const leavesMat = new THREE.MeshStandardMaterial({
    map: atlasTex,
    alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.74, metalness: 0.02, vertexColors: true
  });
  leavesMat.customProgramCacheKey = () => 'luanti_leaves_bsl_v42';
  leavesMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength,
      uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uUnderwater: envUniforms.uUnderwater, uInLava: envUniforms.uInLava,
      uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uRainWetness: envUniforms.uRainWetness,
      uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode, uSurfaceLight: envUniforms.uSurfaceLight, uRayTracing: envUniforms.uRayTracing,
      uRtVoxelTex: envUniforms.uRtVoxelTex, uRtOrigin: envUniforms.uRtOrigin, uRtQuality: envUniforms.uRtQuality,
      uWindVec: envUniforms.uWindVec, uWindGust: envUniforms.uWindGust, uCartoonMode: envUniforms.uCartoonMode
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindStrength, uEclipseMode;\nuniform vec2 uWindVec;\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;\nvarying vec3 vWPos;\nvarying vec3 vWNormL;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wpLeaf = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float leafPhase = sin(wpLeaf.x * 0.72 + wpLeaf.z * 0.54 + wpLeaf.y * 0.6 + uTime * 2.1);
        float wMul = uWindStrength * mix(0.65, 1.05, step(0.5, uEclipseMode));
        transformed.x += (uWindVec.x * 0.85 + leafPhase * 0.038) * wMul;
        transformed.z += (uWindVec.y * 0.85 + leafPhase * 0.028) * wMul;`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBlockLight = aBlockLight;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormL = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uFogStart, uFogEnd, uInLava, uQuality, uChillMode, uRainWetness, uDlssMode, uEclipseMode, uSurfaceLight, uRayTracing, uCartoonMode;\nuniform vec3 uSunDir, uSunColor, uFogColor;\nvarying vec3 vBlockLight, vWPos, vWNormL;\n${RT_DDA_GLSL}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        float faceDirL = gl_FrontFacing ? 1.0 : -1.0;
        vec3 vNormL = normalize(vNormal) * faceDirL;
        if (uCartoonMode > 0.5) {
          normal = vNormL;
        } else {
          vec3 upViewL = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec3 blendedN = mix(vNormL, upViewL, 0.28);
          normal = length(blendedN) > 0.05 ? normalize(blendedN) : vNormL;
        }
        geometryNormal = normal;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Rich deep emerald foliage & true sakura richness (Cartoon Bare Bones vivid pop vs Normal BSL deep canopy)
        float lAvg = (diffuseColor.r + diffuseColor.g + diffuseColor.b) * 0.3333;
        if (uCartoonMode > 0.5) {
          vec3 cLeaf = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(1.05));
          diffuseColor.rgb = clamp(mix(vec3(lAvg), cLeaf, 1.25) * 1.07, 0.0, 1.0);
        } else {
          float lLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 natLeaf = mix(vec3(lLum), diffuseColor.rgb, 1.00);
          diffuseColor.rgb = clamp(natLeaf * 0.94, 0.0, 1.0);
        }`)
      .replace('#include <opaque_fragment>', `
        vec3 vDirL = normalize(vWPos - cameraPosition);
        vec3 sDirL = normalize(uSunDir);
        float backFaceL = gl_FrontFacing ? 1.0 : 0.78;
        vec3 nDirL = normalize(vWNormL) * (gl_FrontFacing ? 1.0 : -1.0);
        bool isUltraL = (uQuality > 1.5);
        float sUp = smoothstep(-0.10, 0.24, sDirL.y);
        float rtFadeL = 0.0;
        vec3 rtShL = vec3(1.0);
        float rtShLumL = 1.0;
        if (uRayTracing > 0.5) {
          float rtCamDL = length(cameraPosition - vWPos);
          if (rtCamDL < 42.0) {
            rtFadeL = rtInVol(vWPos) * (1.0 - smoothstep(30.0, 42.0, rtCamDL));
            if (rtFadeL > 0.01 && sUp > 0.02) {
              float rtShDL = 32.0;
              rtShL = rtTraceSunShadow(vWPos, nDirL, sDirL, rtShDL);
              rtShLumL = dot(rtShL, vec3(0.3333));
            }
          }
        }
        float sssFwd = pow(max(dot(vDirL, sDirL), 0.0), 3.0);
        float sssBroad = max(dot(vDirL, sDirL) * 0.5 + 0.5, 0.0) * 0.22;
        float canopyWrap = clamp(dot(nDirL, sDirL) * 0.5 + 0.5, 0.0, 1.0);
        float toonLeafWrap = mix(canopyWrap, smoothstep(0.28, 0.58, canopyWrap) * 0.34 + 0.66, step(0.5, uCartoonMode));
        float normalCanopy = mix(0.64, 1.02, smoothstep(0.08, 0.92, canopyWrap));
        outgoingLight *= mix(mix(0.46, normalCanopy, sUp), mix(0.62, mix(0.90, 1.04, toonLeafWrap), sUp), step(0.5, uCartoonMode)) * backFaceL;
        outgoingLight *= mix(vec3(1.0), clamp(rtShL * 1.12 + vec3(0.38), 0.42, 1.0), rtFadeL * 0.80);
        vec3 leafShBase = mix(vec3(0.84, 0.91, 1.03), mix(vec3(0.94, 0.97, 1.04), vec3(0.90, 0.93, 1.04), max(uChillMode, uEclipseMode * 0.55)), step(0.5, uCartoonMode));
        outgoingLight = mix(outgoingLight, outgoingLight * leafShBase, (1.0 - canopyWrap) * mix(0.18, 0.10, step(0.5, uCartoonMode)) * sUp);
        float leafRim = pow(1.0 - abs(dot(nDirL, vDirL)), 2.2) * 0.08 * canopyWrap * sUp * (1.0 - step(0.5, uCartoonMode));
        float sUpG = sUp * clamp(uSurfaceLight, 0.0, 1.0) * mix(1.0, 0.30 + 0.70 * rtShLumL, rtFadeL);
        float leafLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float leafLightGain = mix(1.58, 0.58, smoothstep(0.10, 0.65, leafLuma) * sUpG);
        float chillLeafSss = mix(isUltraL ? 0.18 : 0.12, isUltraL ? 0.26 : 0.19, uChillMode) + uDlssMode * 0.08 + uEclipseMode * 0.10 + rtFadeL * 0.34;
        vec3 leafBlockAdd = vBlockLight * (diffuseColor.rgb + vec3(0.045)) * leafLightGain;
        vec3 leafSunBal = mix(uSunColor, vec3(1.02, 0.99, 0.92), mix(0.42, 0.72, max(uCartoonMode, rtFadeL * 0.90)));
        vec3 canopyAmb = mix(uSkyHorizon, vec3(0.94, 0.98, 0.93), 0.55) * mix(0.064 + 0.015 * uEclipseMode, 0.13, uCartoonMode);
        float crownGlow = pow(canopyWrap, 2.4) * mix(0.06, 0.0, step(0.5, uCartoonMode));
        outgoingLight += diffuseColor.rgb * (canopyAmb + vec3(0.045 * rtFadeL)) * sUpG + diffuseColor.rgb * leafSunBal * (sssFwd * (chillLeafSss + mix(0.06, 0.0, step(0.5, uCartoonMode))) + sssBroad * mix(0.04, 0.10, max(uChillMode, max(uEclipseMode, rtFadeL * 0.95))) + crownGlow + leafRim) * sUpG + leafSunBal * (uRainWetness * 0.04 * sssFwd * sUpG) + leafBlockAdd / (vec3(1.0) + max(outgoingLight, vec3(0.0)) * 0.90 + leafBlockAdd * 0.52);
        float outPeakL = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        float outLumL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float hiMetricL = mix(outLumL, outPeakL, 0.45);
        float hiCapL = mix(mix(0.88, 0.96, uRayTracing), 0.76, uCartoonMode);
        if (hiMetricL > hiCapL) {
          float overL = hiMetricL - hiCapL;
          float compLumL = hiCapL + overL / (1.0 + overL * mix(1.45, 1.25, uRayTracing));
          outgoingLight *= (compLumL / max(hiMetricL, 0.0001));
        }
        #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
        vec3 viewVecL = vWPos - cameraPosition;
        float distL = length(viewVecL);
        vec3 viewDirL = viewVecL / max(distL, 0.0001);
        if (uInLava > 0.5) {
          float lvFogL = smoothstep(0.30, 3.05, distL);
          gl_FragColor.rgb = mix(gl_FragColor.rgb * vec3(1.12, 0.56, 0.32), uFogColor, clamp(lvFogL, 0.0, 0.995));
        } else {
          float fogL = smoothstep(uFogStart, uFogEnd, distL);
          vec3 lSun = normalize(uSunDir);
          vec3 activeSunL = lSun.y > -0.05 ? lSun : -lSun;
          vec3 activeColL = lSun.y > -0.05 ? uSunColor : vec3(0.42, 0.62, 0.96);
          float lNoonTame = 1.0 - smoothstep(0.45, 0.92, lSun.y) * mix(0.68, 0.42, uEclipseMode);
          float lScatter = pow(max(dot(viewDirL, activeSunL), 0.0), mix(7.0, 4.4, max(uChillMode, uEclipseMode))) * (lSun.y > -0.05 ? smoothstep(-0.1, 0.25, lSun.y) * lNoonTame : 0.35);
          vec3 lFogBase = uFogColor * mix(0.94, 0.88, smoothstep(0.45, 0.92, lSun.y));
          float blLumaL = max(vBlockLight.r, max(vBlockLight.g, vBlockLight.b));
          float lightFogResistL = 1.0 - clamp(blLumaL * 0.78, 0.0, 0.82);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(lFogBase, min(activeColL * mix(0.90, 1.06, max(uChillMode, uEclipseMode)), vec3(1.0, 0.91, 0.78)), lScatter * mix(0.16, 0.48, max(uChillMode, uEclipseMode))), fogL * lightFogResistL);
        }
        gl_FragColor.a = 1.0;`);
  };

  // Synchronized Wind Shadow Depth Material for Crisp Leaves
  const leavesDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map: atlasTex, alphaTest: 0.45, side: THREE.DoubleSide
  });
  leavesDepthMat.customProgramCacheKey = () => 'luanti_leaves_depth_bsl_v14';
  leavesDepthMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength, uEclipseMode: envUniforms.uEclipseMode, uWindVec: envUniforms.uWindVec });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindStrength, uEclipseMode;\nuniform vec2 uWindVec;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wpLeaf = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float leafPhase = sin(wpLeaf.x * 0.72 + wpLeaf.z * 0.54 + wpLeaf.y * 0.6 + uTime * 2.1);
        float wMul = uWindStrength * mix(0.65, 1.05, step(0.5, uEclipseMode));
        transformed.x += (uWindVec.x * 0.85 + leafPhase * 0.038) * wMul;
        transformed.z += (uWindVec.y * 0.85 + leafPhase * 0.028) * wMul;`);
  };

  // Low graphics: lá ĐẶC (không lỗ, không alphaTest) — dùng texture thật khi ở chế độ Thấp để tránh tạo USE_MAP thừa
  const leavesMatLow = new THREE.MeshStandardMaterial({
    map: shaderQuality === 'low' ? getAtlasSolidTex() : atlasTex, side: THREE.FrontSide, roughness: 0.80, metalness: 0.0, vertexColors: true
  });

  // BUILD v166: Ultra-lightweight Lambert material for Bare Bones Cartoon leaves (FrontSide, zero PBR specular, zero wind trig/SSS/RT; preserves glass alphaTest & torch blockLight)
  const leavesMatCartoon = new THREE.MeshLambertMaterial({
    map: atlasTex, alphaTest: 0.5, side: THREE.FrontSide, vertexColors: true
  });
  leavesMatCartoon.customProgramCacheKey = () => 'luanti_leaves_cartoon_lite_v1';
  leavesMatCartoon.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlockLight = aBlockLight;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBlockLight;')
      .replace('#include <opaque_fragment>', 'outgoingLight += vBlockLight * (diffuseColor.rgb + vec3(0.04)) * 0.85;\n#include <opaque_fragment>');
  };

  // Plant Material (Crisp 3-Plane Grass Tufts, Flowers, Wheat Gust Waves & Warm Golden Backlit Tip Glow!)
  const plantMat = new THREE.MeshStandardMaterial({
    map: atlasTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.80, metalness: 0.0
  });
  plantMat.customProgramCacheKey = () => 'luanti_plant_bsl_v39';
  plantMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength,
      uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uUnderwater: envUniforms.uUnderwater, uInLava: envUniforms.uInLava, uWaterDepth: envUniforms.uWaterDepth, uDimension: envUniforms.uDimension,
      uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uRainWetness: envUniforms.uRainWetness,
      uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode, uPlayerPos: envUniforms.uPlayerPos, uSurfaceLight: envUniforms.uSurfaceLight, uRayTracing: envUniforms.uRayTracing,
      uRtVoxelTex: envUniforms.uRtVoxelTex, uRtOrigin: envUniforms.uRtOrigin, uRtQuality: envUniforms.uRtQuality,
      uWindVec: envUniforms.uWindVec, uWindGust: envUniforms.uWindGust, uCartoonMode: envUniforms.uCartoonMode
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindStrength, uEclipseMode, uWindGust;\nuniform vec2 uWindVec;\nuniform vec3 uPlayerPos;\nattribute float aPlantSway;\nattribute float aSkyShade;\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;\nvarying vec3 vWPos;\nvarying float vPlantTip;\nvarying float vSkyShade;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wpP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float curvP = clamp(aPlantSway, 0.0, 1.5);
        float pPhase = sin(uTime * 2.25 + wpP.x * 0.72 + wpP.z * 0.64);
        float gustK = 0.72 + 0.42 * uWindGust;
        float swayAmp = uWindStrength * curvP * gustK;
        vec2 pMoveXZ = uWindVec * (1.25 * swayAmp) + vec2(pPhase * 0.068, cos(uTime * 1.85 + wpP.z * 0.78) * 0.044) * swayAmp;
        vec2 pdxz = wpP.xz - uPlayerPos.xz;
        float pdLen = length(pdxz);
        float pPush = smoothstep(0.55, 0.05, pdLen) * smoothstep(1.2, 0.15, abs(wpP.y - uPlayerPos.y)) * 0.65 * curvP;
        vec2 pDir = pdLen > 0.001 ? (pdxz / pdLen) : vec2(0.0);
        transformed.xz += pMoveXZ + pDir * pPush * 0.55;
        transformed.y -= dot(pMoveXZ, pMoveXZ) * 0.45;`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBlockLight = aBlockLight;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPlantTip = clamp(aPlantSway, 0.0, 1.0);\nvSkyShade = aSkyShade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uFogStart, uFogEnd, uUnderwater, uInLava, uWaterDepth, uDimension, uQuality, uChillMode, uRainWetness, uDlssMode, uEclipseMode, uSurfaceLight, uRayTracing, uCartoonMode;\nuniform vec3 uSunDir, uSunColor, uFogColor;\nvarying vec3 vBlockLight, vWPos;\nvarying float vPlantTip, vSkyShade;\n${RT_DDA_GLSL}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        // Prevent DoubleSide backfaces from flipping upward (0,1,0) normals downward into black!
        normal = normalize( vNormal );
        geometryNormal = normal;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Lush emerald meadow grass roots + warm sunlit golden-lime tips (matching forest shader refs!)
        float dayPlant = smoothstep(-0.08, 0.25, normalize(uSunDir).y);
        float isGoldCrop = clamp((diffuseColor.r - diffuseColor.b) * 2.2, 0.0, 1.0);
        if (uCartoonMode > 0.5) {
          diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(0.99));
          float rootShadeC = mix(0.56, 0.86, isGoldCrop * 0.75);
          diffuseColor.rgb *= vSkyShade * mix(rootShadeC, mix(0.96, 1.06, dayPlant), smoothstep(0.0, 0.84, vPlantTip));
        } else {
          float pL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 pCol = mix(vec3(pL), diffuseColor.rgb, 1.00);
          pCol = clamp(pCol * 0.94, 0.0, 1.0);
          float tipBand = smoothstep(0.35, 1.0, vPlantTip);
          float rootShadeN = mix(0.56, 0.84, isGoldCrop * 0.75);
          vec3 tipTint = mix(vec3(1.0), vec3(1.03, 1.02, 0.94), tipBand * dayPlant * (1.0 - isGoldCrop * 0.5));
          diffuseColor.rgb = pCol * tipTint * vSkyShade * mix(rootShadeN, mix(0.94, 1.04, dayPlant), smoothstep(0.0, 0.82, vPlantTip));
        }`)
      .replace('#include <opaque_fragment>', `
        vec3 vDirP = normalize(vWPos - cameraPosition);
        vec3 sDirP = normalize(uSunDir);
        float sUpP = smoothstep(-0.08, 0.28, sDirP.y);
        float rtFadeP = 0.0;
        vec3 rtShP = vec3(1.0);
        float rtShLumP = 1.0;
        if (uRayTracing > 0.5) {
          float rtCamDP = length(cameraPosition - vWPos);
          if (rtCamDP < 32.0) {
            rtFadeP = rtInVol(vWPos) * (1.0 - smoothstep(22.0, 32.0, rtCamDP));
            if (rtFadeP > 0.01 && sUpP > 0.02) {
              float rtShDP = 32.0;
              rtShP = rtTraceSunShadow(vWPos, vec3(0.0, 1.0, 0.0), sDirP, rtShDP);
              rtShLumP = dot(rtShP, vec3(0.3333));
            }
          }
        }
        float chillPlantMul = 1.0 + uChillMode * 0.30 + uDlssMode * 0.16 + uEclipseMode * 0.22 + rtFadeP * 0.36;
        float pSSS = (pow(max(dot(vDirP, sDirP), 0.0), 3.0) * (uQuality > 1.5 ? 0.22 : 0.16) + 0.02 * (1.0 - uChillMode)) * chillPlantMul * smoothstep(0.15, 1.0, vPlantTip) * sUpP * vSkyShade * mix(1.0, rtShLumP, rtFadeP * 0.92);
        float tipRimP = pow(1.0 - abs(vDirP.y), 2.4) * smoothstep(0.32, 1.0, vPlantTip) * (0.04 + 0.12 * uChillMode + 0.08 * uDlssMode + 0.10 * uEclipseMode + rtFadeP * 0.10) * sUpP * mix(1.0, rtShLumP, rtFadeP * 0.90);
        outgoingLight *= mix(0.46, mix(mix(0.88, 1.0, uEclipseMode), 0.84, uChillMode), sUpP);
        outgoingLight *= mix(vec3(1.0), clamp(rtShP * 1.15 + vec3(0.32), 0.34, 1.0), rtFadeP * 0.85);
        vec3 plantShTint = mix(vec3(0.92, 0.96, 1.03), vec3(0.76, 0.78, 0.96), max(uChillMode, uEclipseMode * 0.55));
        outgoingLight = mix(outgoingLight * plantShTint, outgoingLight, vSkyShade);
        vec3 plantSunBal = mix(uSunColor, vec3(0.95, 0.99, 1.02), mix(0.56, 0.72, uEclipseMode));
        outgoingLight += diffuseColor.rgb * plantSunBal * (pSSS + tipRimP) + diffuseColor.rgb * uSunColor * (0.08 * rtShLumP * rtFadeP * sUpP) + plantSunBal * (uRainWetness * 0.07 * vPlantTip * sUpP);
        if (uDimension < 0.5 && vWPos.y < 0.86) {
          float wDepthP = max(0.0, 0.86 - vWPos.y);
          vec3 wAbsorbP = exp(-wDepthP * vec3(0.115, 0.050, 0.025));
          outgoingLight *= mix(vec3(1.0), wAbsorbP, 0.92);
        }
        float sUpPG = sUpP * clamp(uSurfaceLight, 0.0, 1.0);
        float plantLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float plantLightGain = mix(1.58, 0.58, smoothstep(0.10, 0.65, plantLuma) * sUpPG);
        vec3 plantBlockAdd = vBlockLight * (diffuseColor.rgb + vec3(0.045)) * plantLightGain;
        outgoingLight += plantBlockAdd / (vec3(1.0) + max(outgoingLight, vec3(0.0)) * 0.90 + plantBlockAdd * 0.52);
        float outPeakP = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        float outLumP = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float hiMetricP = mix(outLumP, outPeakP, 0.50);
        float hiCapP = mix(0.60, 0.92, uRayTracing);
        if (hiMetricP > hiCapP) {
          float overP = hiMetricP - hiCapP;
          float compLumP = hiCapP + overP / (1.0 + overP * mix(3.10, 1.35, uRayTracing));
          outgoingLight *= (compLumP / max(hiMetricP, 0.0001));
        }
        #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
        vec3 viewVecP = vWPos - cameraPosition;
        float distP = length(viewVecP);
        vec3 viewDirP = viewVecP / max(distP, 0.0001);
        if (uInLava > 0.5) {
          float lvFogP = smoothstep(0.30, 3.05, distP);
          gl_FragColor.rgb = mix(gl_FragColor.rgb * vec3(1.12, 0.56, 0.32), uFogColor, clamp(lvFogP, 0.0, 0.995));
        } else if (uUnderwater > 0.5) {
          float abyssKP = clamp(uWaterDepth / 34.0, 0.0, 1.0);
          float uwFogP = 1.0 - exp(-distP * mix(0.044, 0.132, abyssKP));
          vec3 uwColP = mix(uFogColor * vec3(0.18, 0.28, 0.44), uFogColor * vec3(1.16, 1.38, 1.52), smoothstep(-0.62, 0.68, viewDirP.y));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uwColP, clamp(uwFogP, 0.0, 0.985));
        } else {
          float fogP = smoothstep(uFogStart, uFogEnd, distP);
          vec3 pSun = normalize(uSunDir);
          vec3 activeSunP = pSun.y > -0.05 ? pSun : -pSun;
          vec3 activeColP = pSun.y > -0.05 ? uSunColor : vec3(0.42, 0.62, 0.96);
          float pNoonTame = 1.0 - smoothstep(0.45, 0.92, pSun.y) * mix(0.68, 0.42, uEclipseMode);
          float pScatter = pow(max(dot(viewDirP, activeSunP), 0.0), mix(7.0, 4.4, max(uChillMode, uEclipseMode))) * (pSun.y > -0.05 ? smoothstep(-0.1, 0.25, pSun.y) * pNoonTame : 0.35);
          vec3 pFogBase = uFogColor * mix(1.00, 0.90, smoothstep(0.45, 0.92, pSun.y));
          float blLumaP = max(vBlockLight.r, max(vBlockLight.g, vBlockLight.b));
          float lightFogResistP = 1.0 - clamp(blLumaP * 0.78, 0.0, 0.82);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(pFogBase, min(activeColP * mix(0.90, 1.06, max(uChillMode, uEclipseMode)), vec3(1.0, 0.91, 0.78)), pScatter * mix(0.16, 0.48, max(uChillMode, uEclipseMode))), fogP * lightFogResistP);
        }
        gl_FragColor.a = 1.0;`);
  };

  // Animated Emissive Material (Pulsing Lava, Lanterns, Glowing Cave Mushrooms & 4-Frame Voxel Fire!)
  const emissiveMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlasTex }, uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength, uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd, uReflClipY: envUniforms.uReflClipY, uInLava: envUniforms.uInLava },
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime, uWindStrength;
      attribute float aEmissiveType;
      varying vec2 vUv; varying float vDist, vEType, vFireSeed; varying vec3 vWPos;
      void main() {
        vUv = uv;
        float et = aEmissiveType;
        vec3 posL = position;
        float hasModel = abs(modelMatrix[3].x) + abs(modelMatrix[3].y) + abs(modelMatrix[3].z);
        vFireSeed = (hasModel > 0.001) ? floor(abs(modelMatrix[3].x) + abs(modelMatrix[3].z)) * 1.73 : (floor(position.x) * 1.37 + floor(position.z) * 2.19);
        if (et > 9.5) {
          et -= 10.0;
          vec3 cell = floor(posL);
          vec3 pivot = cell + vec3(0.5, 0.72, 0.5);
          vec3 rel = posL - pivot;
          float seed = cell.x * 1.37 + cell.y * 0.83 + cell.z * 2.19;
          float windAmp = 0.068 + 0.055 * clamp(uWindStrength, 0.2, 2.0);
          float angZ = (sin(uTime * 1.90 + seed) * 0.76 + sin(uTime * 3.15 + seed * 1.7) * 0.24) * windAmp;
          float angX = (cos(uTime * 1.52 + seed * 1.3) * 0.72 + cos(uTime * 2.65 + seed * 2.1) * 0.28) * windAmp * 0.75;
          float cz = cos(angZ), sz = sin(angZ);
          vec3 r1 = vec3(rel.x * cz - rel.y * sz, rel.x * sz + rel.y * cz, rel.z);
          float cx = cos(angX), sx = sin(angX);
          vec3 r2 = vec3(r1.x, r1.y * cx - r1.z * sx, r1.y * sx + r1.z * cx);
          posL = pivot + r2;
        }
        vEType = et;
        vec4 wp = modelMatrix * vec4(posL, 1.0);
        vWPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime, uFogStart, uFogEnd, uReflClipY, uInLava; uniform vec3 uFogColor;
      varying vec2 vUv; varying float vDist, vEType, vFireSeed; varying vec3 vWPos;
      void main() {
        if (vWPos.y < uReflClipY) discard;
        if (vEType > 3.5) {
          float fPhase = floor(mod(uTime * 12.5 + vFireSeed, 4.0));
          float shimmer = sin(uTime * 16.0 + vUv.y * 28.0 + vFireSeed) * 0.0025;
          vec4 fTex = texture2D(uMap, vec2(clamp(vUv.x + fPhase * 0.125 + shimmer, 0.0, 0.999), vUv.y));
          if (fTex.a < 0.45) discard;
          float flick = 0.94 + 0.08 * sin(uTime * 21.0 + vFireSeed * 3.1) + 0.04 * cos(uTime * 34.0 + vFireSeed);
          vec3 fCol = fTex.rgb * flick + (vEType > 4.5 ? vec3(0.01, 0.07, 0.11) : vec3(0.06, 0.025, 0.005));
          float fFog = uInLava > 0.5 ? clamp(smoothstep(0.30, 3.05, vDist), 0.0, 0.995) : smoothstep(uFogStart * 1.35, uFogEnd * 2.4, vDist) * 0.30;
          gl_FragColor = vec4(mix(fCol, uFogColor, fFog), 1.0);
          return;
        }
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.45) discard;
        vec3 col;
        float fogF;
        if (vEType > 1.5 && vEType < 2.5) {
          // Soft bioluminescent glow for Cave Mushrooms visible clearly across caves
          float mPulse = 0.82 + 0.06 * sin(uTime * 2.2);
          col = tex.rgb * mPulse;
          fogF = smoothstep(uFogStart * 1.25, uFogEnd * 2.0, vDist) * 0.42;
        } else if (vEType < 0.5) {
          // Cozy warm amber Lantern & Shroomlight glow with crisp pixel details
          float lPulse = 0.94 + 0.03 * sin(uTime * 2.4);
          col = tex.rgb * lPulse + vec3(0.04, 0.02, 0.004);
          fogF = smoothstep(uFogStart * 1.4, uFogEnd * 2.5, vDist) * 0.28;
        } else {
          float pulse = 0.92 + 0.04 * sin(uTime * 2.6 + vEType * 2.0);
          col = tex.rgb * pulse;
          fogF = smoothstep(uFogStart * 1.35, uFogEnd * 2.4, vDist) * 0.32;
        }
        if (uInLava > 0.5) fogF = clamp(smoothstep(0.30, 3.05, vDist), 0.0, 0.995);
        gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
      }`
  });

  // Translucent Thin Portal Shader (Nether purple 0, Dream aura 1, End cosmic void 2, Warden sculk vortex 3)
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlasTex }, uTime: envUniforms.uTime, uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd, uReflClipY: envUniforms.uReflClipY },
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float aPortalKind;
      varying vec2 vUv; varying float vDist, vKind; varying vec3 vWPos;
      void main() {
        vUv = uv; vKind = aPortalKind;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime, uFogStart, uFogEnd, uReflClipY, uInLava; uniform vec3 uFogColor;
      varying vec2 vUv; varying float vDist, vKind; varying vec3 vWPos;
      float pHash(vec2 p) {
        return fract(sin(dot(mod(p, 256.0), vec2(127.1, 311.7))) * 43758.5453);
      }
      float pNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(pHash(i), pHash(i + vec2(1.0, 0.0)), u.x),
                   mix(pHash(i + vec2(0.0, 1.0)), pHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float pFbm(vec2 p) {
        float v = 0.0, a = 0.52;
        mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
        for (int i = 0; i < 3; i++) {
          v += a * pNoise(p);
          p = rot * p * 2.04 + vec2(11.3, 7.7);
          a *= 0.48;
        }
        return v;
      }
      void main() {
        if (vWPos.y < uReflClipY) discard;
        vec3 vDirP = normalize(vWPos - cameraPosition);
        vec2 par1 = vec2(vDirP.x + vDirP.z, vDirP.y) * 0.24;
        vec2 par2 = par1 * 2.1;
        vec2 pBase = vec2(vWPos.x + vWPos.z, vWPos.y);
        float tS = uTime * 0.42;
        vec2 q1 = vec2(pFbm(pBase * 0.95 + par1 + vec2(tS * 0.35, -tS * 0.55)),
                       pFbm(pBase * 0.95 + par1 + vec2(-tS * 0.42, tS * 0.38) + 4.3));
        vec2 q2 = vec2(pFbm(pBase * 1.45 + q1 * 1.25 + par2 - vec2(tS * 0.28, tS * 0.45)),
                       pFbm(pBase * 1.45 + q1 * 1.25 + par2 + vec2(tS * 0.32, -tS * 0.24) + 8.1));
        float warp = pFbm(pBase * 1.25 + q2 * 1.35 + par1 * 1.3);
        float mist = pFbm(pBase * 2.10 - q1 * 0.85 + par2 * 0.8 - vec2(0.0, tS * 0.65));
        vec2 spUv = pBase * 3.8 + q1 * 1.1 + par2 * 1.6 - vec2(0.0, tS * 0.95);
        vec2 spCell = floor(spUv);
        vec2 spF = fract(spUv) - 0.5;
        float spRnd = pHash(spCell);
        float spRad = length(spF - (vec2(spRnd, fract(spRnd * 17.3)) - 0.5) * 0.42);
        float spCore = smoothstep(0.26, 0.03, spRad) * step(0.58, spRnd);
        float glint = spCore * (0.45 + 0.55 * sin(uTime * 3.2 + spRnd * 38.0));
        vec3 col; float a;
        if (vKind > 2.5) {
          float pulse = 0.72 + 0.28 * sin(uTime * 3.2 - length(vWPos.xy) * 1.15);
          float vein = smoothstep(0.46, 0.82, mist * 0.68 + warp * 0.42);
          float ripple = smoothstep(0.42, 0.96, sin((pBase.y - uTime * 1.65) * 2.4 + q1.x * 3.0) * 0.5 + 0.5);
          col = mix(vec3(0.015, 0.075, 0.12), vec3(0.04, 0.44, 0.54), smoothstep(0.24, 0.78, warp));
          col = mix(col, vec3(0.18, 0.94, 0.98), vein * (0.45 + 0.45 * ripple) * pulse);
          col += vec3(0.66, 1.00, 1.00) * glint * 0.85;
          a = mix(0.84, 0.96, clamp(mist * 0.65 + glint * 0.45, 0.0, 1.0));
        } else if (vKind < 0.5) {
          float sw = smoothstep(0.22, 0.84, warp * 0.65 + mist * 0.45);
          float bloom = smoothstep(0.48, 0.88, mist + q2.y * 0.30);
          col = mix(vec3(0.22, 0.03, 0.46), vec3(0.68, 0.14, 0.96), sw);
          col = mix(col, vec3(0.95, 0.62, 1.00), bloom * 0.62);
          col += vec3(0.98, 0.78, 1.00) * glint * 0.88;
          a = mix(0.76, 0.93, clamp(mist * 0.65 + glint * 0.45, 0.0, 1.0));
        } else if (vKind < 1.5) {
          float huePhase = dot(pBase, vec2(0.18, 0.22)) + warp * 0.55 - uTime * 0.16;
          vec3 rb = 0.54 + 0.46 * cos(6.28318 * (huePhase + vec3(0.0, 0.33, 0.67)));
          vec3 pearlescent = vec3(0.95, 0.88, 1.00);
          col = mix(rb * 0.72 + vec3(0.14, 0.08, 0.26), mix(rb * 1.15, pearlescent, 0.34), smoothstep(0.28, 0.82, mist * 0.62 + warp * 0.44));
          col += mix(rb, vec3(1.0), 0.45) * glint * 0.92;
          a = mix(0.78, 0.94, clamp(mist * 0.65 + glint * 0.45, 0.0, 1.0));
        } else {
          float s1 = fract(sin(dot(floor((vWPos.xz + vWPos.y * 0.4) * 5.0), vec2(12.9898, 78.233))) * 43758.5453);
          float star = smoothstep(0.92, 0.995, s1) * (0.6 + 0.4 * sin(uTime * 4.2 + s1 * 40.0));
          float swirl = 0.5 + 0.5 * sin(atan(vWPos.z, vWPos.x) * 3.0 + uTime * 1.8 - length(vWPos.xz) * 0.7);
          col = mix(vec3(0.03, 0.04, 0.14), vec3(0.22, 0.12, 0.42), swirl * 0.65) + vec3(0.35, 0.92, 0.96) * star * 1.15 + mist * vec3(0.08, 0.06, 0.18);
          a = 0.98;
        }
        float fogF = smoothstep(uFogStart, uFogEnd * 1.1, vDist);
        gl_FragColor = vec4(mix(col, uFogColor, fogF), a);
      }`
  });

  // Fast 24x-Optimized Fluffy Cumulus Cloud & 3-Dimension Atmospheric Sky Dome (Overworld / Nether / The End!)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uSunDir: envUniforms.uSunDir, uSkyTop: envUniforms.uSkyTop, uSkyHorizon: envUniforms.uSkyHorizon, uFogColor: envUniforms.uFogColor,
      uSunColor: envUniforms.uSunColor, uTime: envUniforms.uTime,
      uCloudCover: envUniforms.uCloudCover, uVolumetricClouds: envUniforms.uVolumetricClouds,
      uDimension: envUniforms.uDimension, uUnderwater: envUniforms.uUnderwater, uInLava: envUniforms.uInLava, uWaterDepth: envUniforms.uWaterDepth,
      uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode, uCartoonMode: envUniforms.uCartoonMode
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0)); }`,
    fragmentShader: `
      precision mediump float;
      uniform vec3 uSunDir, uSkyTop, uSkyHorizon, uSunColor, uFogColor;
      uniform float uTime, uCloudCover, uVolumetricClouds, uDimension, uUnderwater, uInLava, uWaterDepth, uChillMode, uDlssMode, uEclipseMode, uCartoonMode;
      varying vec3 vDir;
      float cHash(vec2 p) { return fract(sin(dot(mod(p, 289.0), vec2(127.1, 311.7))) * 43758.5453); }
      float cNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), u.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbmFast(vec2 p) {
        float s = cNoise(p) * 0.54;
        p = mat2(0.80, 0.60, -0.60, 0.80) * p * 2.05 + vec2(13.1, 7.4);
        s += cNoise(p) * 0.28;
        p = mat2(0.80, 0.60, -0.60, 0.80) * p * 2.05 + vec2(5.7, 11.2);
        s += cNoise(p) * 0.14;
        return s;
      }
      float puffCloudMask(vec2 p, float cov) {
        vec2 cell = floor(p);
        vec2 f = smoothstep(0.14, 0.86, fract(p));
        float a = cNoise(cell * 0.42);
        float b = cNoise((cell + vec2(1.0, 0.0)) * 0.42);
        float c = cNoise((cell + vec2(0.0, 1.0)) * 0.42);
        float d2 = cNoise((cell + vec2(1.0, 1.0)) * 0.42);
        float blk = mix(mix(a, b, f.x), mix(c, d2, f.x), f.y);
        float puff = fbmFast(p * 0.55) * 0.22;
        return smoothstep(0.64 - cov * 0.36, 0.76 - cov * 0.24, blk * 0.84 + puff);
      }
      float eTri(float x) { return clamp(abs(fract(x) - 0.5), 0.01, 0.49); }
      vec2 eTri2(vec2 p) { float tx = eTri(p.x); return vec2(tx + eTri(p.y), eTri(tx + p.y)); }
      mat2 eMm2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
      float eTriNoise(vec2 p, float t) {
        float z = 1.8, z2 = 2.5, rz = 0.0;
        p *= eMm2(p.x * 0.06);
        vec2 bp = p;
        mat2 rot = eMm2(t * 0.055);
        mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);
        for (int i = 0; i < 3; i++) {
          vec2 dg = eTri2(bp * 1.75) * 0.75;
          dg *= rot;
          p -= dg / z2;
          bp *= 1.3;
          z2 *= 0.45;
          z *= 0.42;
          p *= 1.21 + (rz - 1.0) * 0.02;
          rz += eTri(p.x + eTri(p.y)) * z;
          p *= -m2;
        }
        return clamp(1.0 / pow(max(rz * 28.0, 0.22), 1.55), 0.0, 0.56);
      }
      vec3 eclipseAurora(vec3 dir, float t) {
        vec3 colA = vec3(0.0), avgCol = vec3(0.0);
        float fade = dir.y * 2.0 + 0.42;
        float gndMask = 1.0 - exp(-22.0 * pow(clamp(dir.y + 0.02, 0.0, 1.0), 2.0));
        for (int ai = 0; ai < 8; ai++) {
          float mI = 4.6 * float(ai);
          float pt = (0.85 + pow(mI, 1.38) * 0.0018) / max(fade, 0.14);
          vec3 bpos = pt * dir;
          float rzt = eTriNoise(bpos.zx * 0.72, t);
          vec3 col2 = (sin(vec3(2.25, -0.55, 1.32) + mI * 0.088) * 0.5 + 0.5) * rzt;
          avgCol = mix(avgCol, col2, 0.20);
          colA += avgCol * exp2(-mI * 0.048 - 1.85);
        }
        return 14.5 * pow(max(colA, vec3(0.0)), vec3(1.22)) * gndMask;
      }
      void main() {
        vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
        if (uInLava > 0.5) {
          gl_FragColor = vec4(mix(uSkyHorizon, uSkyTop, clamp(d.y * 0.5 + 0.5, 0.0, 1.0)), 1.0);
          return;
        }
        // Dimension 4 = WARDEN REALM (Deep Abyssal Sculk Cavern Sky + Cyan Bioluminescence)
        if (uDimension > 3.5) {
          vec3 colW = mix(uSkyHorizon, uSkyTop, pow(abs(d.y), 0.58));
          float veinW = fbmFast(d.xz * 2.6 + vec2(uTime * 0.025, -uTime * 0.018));
          colW += vec3(0.06, 0.52, 0.64) * smoothstep(0.54, 0.88, veinW) * 0.42;
          gl_FragColor = vec4(colW, 0.0);
          return;
        }
        // Dimension 3 = THE SIFT (Moody Turquoise-to-Rose Twilight Sky + Luminous Cyan/Pink/Gold Aurora Ribbons!)
        if (uDimension > 2.5) {
          vec3 colS = mix(uSkyHorizon, uSkyTop, pow(clamp(d.y * 0.88 + 0.12, 0.0, 1.0), 0.55));
          vec3 sunS = normalize(uSunDir);
          float sDot = max(dot(d, sunS), 0.0);
          colS += vec3(1.0, 0.80, 0.72) * (pow(sDot, 6.0) * 0.14 + pow(sDot, 28.0) * 0.22);
          if (d.y > -0.02) {
            vec2 aUv = d.xz / (max(d.y, 0.05) + 0.36);
            float w1 = sin(aUv.x * 2.1 + aUv.y * 0.8 + uTime * 0.22 + sin(aUv.y * 1.4 - uTime * 0.14) * 1.2);
            float w2 = cos(aUv.x * 3.4 - aUv.y * 1.9 - uTime * 0.18 + sin(aUv.x * 1.1) * 0.9);
            float band1 = pow(smoothstep(0.24, 0.94, 0.48 + 0.34 * w1 + 0.20 * w2), 1.45);
            float band2 = pow(smoothstep(0.34, 0.96, 0.45 - 0.30 * w2 + 0.24 * sin(aUv.x * 1.6 - aUv.y * 2.2 + uTime * 0.16)), 1.55);
            float elevMask = smoothstep(-0.02, 0.16, d.y) * smoothstep(0.96, 0.25, d.y);
            vec3 aurCyan = vec3(0.40, 0.98, 0.90);
            vec3 aurPink = vec3(0.98, 0.52, 0.80);
            vec3 aurGold = vec3(0.98, 0.86, 0.58);
            vec3 aurMix = mix(aurCyan, aurPink, smoothstep(-0.55, 0.65, sin(aUv.x * 1.3 + aUv.y * 0.9)));
            colS += aurMix * band1 * elevMask * 0.46 + aurGold * band2 * elevMask * 0.18;
          }
          gl_FragColor = vec4(colS, 0.0);
          return;
        }
        // Dimension 1 = The Nether (smoldering crimson cavern haze), Dimension 2 = The End (luminous magenta-violet nebula void!)
        if (uDimension > 1.5) {
          vec3 colE = mix(vec3(0.28, 0.09, 0.44), vec3(0.05, 0.015, 0.12), pow(abs(d.y), 0.62));
          float neb1 = fbmFast(d.xz / (abs(d.y) + 0.45) * 2.1 + vec2(uTime * 0.008, 0.0));
          float neb2 = fbmFast(d.xz / (abs(d.y) + 0.35) * 3.6 - vec2(0.0, uTime * 0.010));
          colE += vec3(0.56, 0.16, 0.78) * smoothstep(0.40, 0.86, neb1) * 0.55;
          colE += vec3(0.85, 0.34, 0.98) * smoothstep(0.58, 0.92, neb2) * 0.32;
          float stE = cHash(floor(d.xz / (abs(d.y) + 0.35) * 90.0));
          if (stE > 0.983) colE += vec3(0.98, 0.82, 1.0) * (0.65 + 0.35 * sin(uTime * 2.5 + stE * 80.0)) * 1.35;
          gl_FragColor = vec4(colE, 0.0);
          return;
        }
        if (uDimension > 0.5) {
          vec3 colN = mix(uSkyHorizon, uSkyTop, pow(abs(d.y), 0.55));
          float ash = fbmFast(d.xz * 3.0 + vec2(uTime * 0.04, uTime * 0.02));
          colN += vec3(0.32, 0.06, 0.03) * smoothstep(0.52, 0.88, ash) * 0.52;
          gl_FragColor = vec4(colN, 0.0);
          return;
        }
        // Pure BSL / Complementary Volumetric Deep-Sea Underwater Dome (ZERO clouds/stripes — smooth top sapphire glow -> dark blue-black abyss!)
        if (uUnderwater > 0.5) {
          float abyssS = clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0);
          vec3 uwTop = uSkyHorizon * vec3(1.18, 1.40, 1.56);
          vec3 uwBot = uSkyHorizon * vec3(0.22, 0.34, 0.50);
          vec3 colUW = mix(uwBot, uwTop, smoothstep(-0.75, 0.75, d.y));
          float sunUpW = smoothstep(-0.1, 0.3, normalize(uSunDir).y);
          float uwSunScat = pow(max(dot(d, normalize(uSunDir)), 0.0), 4.0) * 0.45 * sunUpW * exp(-uWaterDepth * 0.04);
          colUW += vec3(0.24, 0.76, 0.88) * uwSunScat * (1.0 - abyssS * 0.65);
          float overheadGlow = pow(max(d.y, 0.0), 3.2) * exp(-uWaterDepth * 0.045) * sunUpW;
          colUW += vec3(0.14, 0.46, 0.62) * overheadGlow * (1.0 - abyssS * 0.65);
          gl_FragColor = vec4(colUW, 1.0);
          return;
        }
        if (uCartoonMode > 0.5) {
          vec3 sunC = normalize(uSunDir);
          float sUpC = smoothstep(-0.12, 0.22, sunC.y);
          vec3 toonDay = mix(vec3(0.56, 0.90, 1.00), vec3(0.04, 0.50, 0.99), pow(max(h, 0.0001), 0.52));
          vec3 toonNight = mix(vec3(0.06, 0.14, 0.34), vec3(0.02, 0.04, 0.14), pow(max(h, 0.0001), 0.58));
          vec3 cSky = mix(toonNight, toonDay, sUpC);
          vec3 sRight = normalize(cross(vec3(0.0, 1.0, 0.01), sunC));
          vec3 sUpAx = cross(sunC, sRight);
          if (dot(d, sunC) > 0.0) {
            vec2 sUv = vec2(dot(d, sRight), dot(d, sUpAx));
            float sqSun = step(max(abs(sUv.x), abs(sUv.y)), 0.072) * step(0.0, d.y + 0.04);
            cSky = mix(cSky, vec3(1.0, 0.98, 0.78), sqSun * sUpC);
          }
          if (d.y < 0.02) cSky = mix(cSky, uFogColor, smoothstep(0.02, -0.10, d.y));
          gl_FragColor = vec4(cSky, 0.0);
          return;
        }
        vec3 col = mix(uSkyHorizon, uSkyTop, pow(max(h, 0.0001), mix(0.56, 0.36, uChillMode)));
        vec3 sunN = normalize(uSunDir);
        float sunDot = max(dot(d, sunN), 0.0), sunUp = smoothstep(-0.14, 0.25, sunN.y);
        float horClip = smoothstep(-0.025, 0.045, d.y);
        float sunsetK = smoothstep(-0.12, 0.16, sunN.y) * (1.0 - smoothstep(0.18, 0.52, sunN.y));
        // Rayleigh + Mie golden sunset belt & deep twilight violet mid-sky
        float chillBand = max(uChillMode, sunsetK * 0.72) * exp(-max(h, 0.0) * 7.8) * sunUp;
        col = mix(col, vec3(0.48, 0.27, 0.44), uChillMode * exp(-pow((h - 0.14) * 5.6, 2.0)) * 0.46 * sunUp);
        col += mix(vec3(0.95, 0.52, 0.24), vec3(1.0, 0.44, 0.18), sunsetK) * chillBand * (0.14 + 0.34 * pow(sunDot, 2.0));
        // Clean Solar Disc with faint subtle bloom only (zero heavy haze)
        float mieBoost = 1.0 + uChillMode * 0.35 + sunsetK * 0.28;
        col += uSunColor * (pow(sunDot, 5.0) * 0.08 + pow(sunDot, 22.0) * 0.14) * sunUp * mieBoost * horClip;
        col += uSunColor * (pow(sunDot, 140.0) * 0.42 + pow(sunDot, 520.0) * 0.75) * sunUp * horClip;
        float sunDisc = smoothstep(0.9984, 0.99935, sunDot) * horClip;
        if (sunDisc > 0.005) {
          vec3 sunCoreCol = mix(uSunColor * 1.12, vec3(1.0, 0.985, 0.93), smoothstep(0.9989, 0.9998, sunDot));
          col = mix(col, sunCoreCol * 1.48, sunDisc * sunUp);
        }

        // Textured Lunar Disc (subtle Maria craters + crisp silver limb)
        float moonDot = max(dot(d, -sunN), 0.0);
        float moonPresence = smoothstep(0.18, -0.06, sunN.y);
        col += vec3(0.32, 0.58, 0.95) * moonPresence * (pow(moonDot, 14.0) * 0.36 + pow(moonDot, 56.0) * 0.62) * (1.0 + 0.22 * uDlssMode) * horClip;
        float moonDisc = smoothstep(0.9964, 0.9986, moonDot) * horClip;
        if (moonDisc > 0.01) {
          vec3 mRight = normalize(cross(vec3(0.0, 1.0, 0.01), -sunN));
          vec3 mUp = cross(-sunN, mRight);
          vec2 mUv = vec2(dot(d, mRight), dot(d, mUp)) * 18.0;
          float maria = fbmFast(mUv * 4.5);
          vec3 mCol = mix(vec3(0.76, 0.82, 0.92), vec3(0.95, 0.97, 1.0), smoothstep(0.28, 0.72, maria));
          col = mix(col, mCol * (1.18 + 0.10 * moonPresence), moonDisc * (0.28 + 0.72 * moonPresence));
        }

        float twilightStars = max(uChillMode, uDlssMode * 0.55) * smoothstep(0.24, 0.72, h) * 0.62;
        float nightMask = max(smoothstep(0.10, -0.18, sunN.y) * smoothstep(0.03, 0.28, h), twilightStars);
        if (nightMask > 0.01) {
          // Delicate Milky Way arch + 2-tier twinkling pinpoint stars
          float mwCoord = (d.x * 0.55 + d.y * 0.45 - d.z * 0.70);
          float mwBand = exp(-mwCoord * mwCoord * 12.0) * smoothstep(0.10, -0.18, sunN.y) * smoothstep(0.06, 0.32, h);
          if (mwBand > 0.01) {
            float mwDust = fbmFast(d.xz / (d.y + 0.45) * 2.4 + vec2(3.1, -1.7));
            col += vec3(0.11, 0.16, 0.28) * mwBand * smoothstep(0.32, 0.78, mwDust) * 0.85;
          }
          vec2 stGrid = d.xz / (d.y + 0.35) * 185.0;
          vec2 stCell = floor(stGrid);
          vec2 stLocal = fract(stGrid) - 0.5;
          float stR = cHash(stCell);
          if (stR > 0.986) {
            float dotStar = smoothstep(0.34, 0.04, length(stLocal));
            vec3 stTint = mix(vec3(0.84, 0.92, 1.0), vec3(1.0, 0.94, 0.82), fract(stR * 73.1));
            col += stTint * dotStar * nightMask * (0.60 + 0.40 * sin(uTime * 3.0 + stR * 120.0)) * (1.42 + 0.32 * uDlssMode);
          }
          // Aurora Borealis + Eclipse Nimitz Curtain Aurora
          if (d.y > 0.02 && smoothstep(0.10, -0.18, sunN.y) > 0.04) {
            float nightAur = smoothstep(0.10, -0.18, sunN.y);
            if (uEclipseMode > 0.5) {
              vec3 aurEc = eclipseAurora(vec3(d.x, max(d.y, 0.04), d.z), uTime);
              col += aurEc * nightAur * 1.15;
            } else {
              float aBand = smoothstep(0.06, 0.24, d.y) * smoothstep(0.88, 0.34, d.y);
              vec2 aUv = d.xz / (d.y + 0.34);
              float w1 = sin(aUv.x * 2.4 + uTime * 0.28 + sin(aUv.y * 1.5 - uTime * 0.16) * 1.4);
              float w2 = sin(aUv.x * 5.2 - aUv.y * 1.9 - uTime * 0.36) * 0.50;
              float curtain = pow(smoothstep(0.22, 0.96, 0.48 + 0.36 * w1 + 0.22 * w2), 1.45);
              float streaks = 0.50 + 0.50 * fbmFast(vec2(aUv.x * 6.5 + uTime * 0.09, aUv.y * 1.2));
              float ribbon = curtain * streaks * aBand * nightAur;
              vec3 aurLow = vec3(0.10, 0.98, 0.74);
              vec3 aurMid = vec3(0.18, 0.70, 1.00);
              vec3 aurTop = vec3(0.56, 0.24, 0.98);
              vec3 aurCol = mix(aurLow, mix(aurMid, aurTop, smoothstep(0.30, 0.66, d.y)), smoothstep(0.14, 0.42, d.y));
              col += aurCol * ribbon * (0.95 + 0.25 * uDlssMode);
            }
          }
        }

        // Soft Puffy Volumetric 3D Blocky Clouds (#E8EEF5 lit tops, #AEBBD0 shaded blue-grey undersides)
        float cloudAlpha = 0.0;
        if (uVolumetricClouds > 0.5 && d.y > 0.015) {
          vec3 lightD = sunN.y > -0.05 ? sunN : -sunN;
          float horFade = smoothstep(0.015, 0.16, d.y);
          vec3 cAccum = vec3(0.0);
          float cTrans = 1.0;
          vec3 litDayC = mix(vec3(0.910, 0.933, 0.961), uSunColor * 0.98, 0.16 + sunsetK * 0.30);
          vec3 shDayC  = mix(vec3(0.682, 0.733, 0.816), mix(vec3(0.42, 0.36, 0.52), uSkyHorizon * 0.84, 0.35), max(uChillMode * 0.65, sunsetK * 0.55));
          vec3 litNightC = vec3(0.20, 0.29, 0.44);
          vec3 shNightC  = vec3(0.06, 0.10, 0.18);
          vec3 baseLitC = mix(litNightC, litDayC, sunUp);
          vec3 baseShC  = mix(shNightC, shDayC, sunUp);
          float fwdDotC = sunN.y > -0.05 ? sunDot : moonDot;
          float silverC = pow(fwdDotC, 6.0) * 0.14 * max(sunUp, moonPresence * 0.35);
          for (int ci = 0; ci < 6; ci++) {
            float hs = (float(ci) + 0.5) / 6.0;
            float dome = 0.72 + 0.28 * sin(hs * 3.14159);
            float altY = mix(2.65, 3.20, hs);
            vec2 cUv = (d.xz / max(d.y + 0.06, 0.09)) * altY + vec2(uTime * 0.016, uTime * 0.006);
            float m0 = puffCloudMask(cUv, uCloudCover - (1.0 - dome) * 0.10);
            if (m0 > 0.01) {
              float mSun = puffCloudMask(cUv + lightD.xz / (abs(lightD.y) + 0.45) * 0.32, uCloudCover);
              float litF = clamp(hs * 0.74 + (1.0 - mSun) * 0.32, 0.08, 1.0);
              vec3 sCol = mix(baseShC, baseLitC, litF) + baseLitC * silverC * (1.0 - m0 * 0.5);
              float sAlpha = m0 * mix(0.46, 0.66, dome) * horFade;
              cAccum += cTrans * sCol * sAlpha;
              cTrans *= (1.0 - sAlpha);
            }
          }
          cloudAlpha = clamp(1.0 - cTrans, 0.0, 0.96);
          if (cloudAlpha > 0.01) {
            col = col * cTrans + cAccum;
          }
        }
        // Seamless horizon continuity: lock sky horizon band to exact uFogColor so terrain edges never cut at night/day
        float horSkirt = smoothstep(0.09, -0.02, d.y);
        col = mix(col, uFogColor, horSkirt);
        if (d.y < -0.06) col = mix(col, uFogColor * 0.86, smoothstep(-0.06, -0.34, d.y));
        gl_FragColor = vec4(col, uVolumetricClouds > 0.5 ? clamp(cloudAlpha * 0.62, 0.0, 0.74) : 0.0);
      }`
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(640, 24, 16), skyMat); scene.add(skyDome);

  // Shooting Stars Pool (Night & Meteor Shower Sky Streaks — 0 heap allocs per frame)
  const SHOOTING_STAR_MAX = 14;
  const ssPositions = new Float32Array(SHOOTING_STAR_MAX * 6);
  const ssColors = new Float32Array(SHOOTING_STAR_MAX * 6);
  const shootingStarGeo = new THREE.BufferGeometry();
  shootingStarGeo.setAttribute('position', new THREE.BufferAttribute(ssPositions, 3));
  shootingStarGeo.setAttribute('color', new THREE.BufferAttribute(ssColors, 3));
  const shootingStarMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  });
  const shootingStarLines = new THREE.LineSegments(shootingStarGeo, shootingStarMat);
  shootingStarLines.frustumCulled = false; shootingStarLines.visible = false;
  scene.add(shootingStarLines);
  const shootingStars = Array.from({ length: SHOOTING_STAR_MAX }, () => ({
    active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, len: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1
  }));

  // Authentic Luanti 3D Voxel Cloud Layer (toggleable classic cloud mode)
  const CLOUD_PERIOD = 16, CLOUD_CELL = 10, CLOUD_THICK = 3.2, CLOUD_Y = 50;
  const CLOUD_PERIOD_W = CLOUD_PERIOD * CLOUD_CELL;
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, fog: false });
  const cloudMesh = (() => {
    const grid = new Uint8Array(CLOUD_PERIOD * CLOUD_PERIOD);
    const seeds = [[2,2,2.4],[7,4,2.1],[12,2,2.3],[4,9,2.6],[11,10,2.5],[14,13,2.0],[1,14,2.2],[8,14,1.9]];
    for (let z = 0; z < CLOUD_PERIOD; z++) for (let x = 0; x < CLOUD_PERIOD; x++) {
      let density = 0;
      for (const [sx, sz, rad] of seeds) {
        let dx = Math.abs(x - sx); if (dx > CLOUD_PERIOD / 2) dx = CLOUD_PERIOD - dx;
        let dz = Math.abs(z - sz); if (dz > CLOUD_PERIOD / 2) dz = CLOUD_PERIOD - dz;
        const d = Math.hypot(dx, dz);
        if (d < rad) density = Math.max(density, 1 - d / rad);
      }
      grid[z * CLOUD_PERIOD + x] = density > 0.24 ? 1 : 0;
    }
    const isCloud = (gx, gz) => grid[(((gz % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD) * CLOUD_PERIOD + (((gx % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD)] === 1;
    const pos = [], cols = [], idx = [];
    let vc = 0;
    const HALF = CLOUD_PERIOD;
    const pushQuad = (a, b, c, d, r, g, bl) => {
      pos.push(...a, ...b, ...c, ...d); cols.push(r, g, bl, r, g, bl, r, g, bl, r, g, bl);
      idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3); vc += 4;
    };
    for (let gz = -HALF; gz < HALF; gz++) for (let gx = -HALF; gx < HALF; gx++) {
      if (!isCloud(gx, gz)) continue;
      if (Math.hypot(gx + 0.5, gz + 0.5) / HALF > 0.95) continue;
      const x0 = gx * CLOUD_CELL, x1 = x0 + CLOUD_CELL, z0 = gz * CLOUD_CELL, z1 = z0 + CLOUD_CELL, y0 = 0, y1 = CLOUD_THICK;
      pushQuad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], 1.0, 1.0, 1.0);
      pushQuad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1], 0.80, 0.85, 0.93);
      if (!isCloud(gx + 1, gz)) pushQuad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], 0.93, 0.95, 0.98);
      if (!isCloud(gx - 1, gz)) pushQuad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], 0.90, 0.93, 0.97);
      if (!isCloud(gx, gz + 1)) pushQuad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], 0.88, 0.91, 0.96);
      if (!isCloud(gx, gz - 1)) pushQuad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], 0.92, 0.94, 0.98);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, cloudMat); m.position.y = CLOUD_Y; m.frustumCulled = false; m.visible = false;
    scene.add(m); return m;
  })();
  let cloudDrift = 0;

  // Authentic BSL/SEUS Crystal-Clear Water Shader (ZERO Shore Stripes • Smooth Per-Corner Shore Blend • Glassy Day & Moonlit Night Reflections)
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: {
      uTime: envUniforms.uTime, uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uSkyTop: envUniforms.uSkyTop, uSkyHorizon: envUniforms.uSkyHorizon, uFogColor: envUniforms.uFogColor,
      uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd, uQuality: envUniforms.uQuality, uWaterQuality: envUniforms.uWaterQuality,
      uReflMap: envUniforms.uReflMap, uReflMatrix: envUniforms.uReflMatrix, uUsePlanarRefl: envUniforms.uUsePlanarRefl, uUnderwater: envUniforms.uUnderwater, uInLava: envUniforms.uInLava, uWaterDepth: envUniforms.uWaterDepth, uDimension: envUniforms.uDimension,
      uRainWetness: envUniforms.uRainWetness, uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode,
      uEclipseMode: envUniforms.uEclipseMode, uWakePts: envUniforms.uWakePts, uPlayerPos: envUniforms.uPlayerPos, uRayTracing: envUniforms.uRayTracing,
      uRtVoxelTex: envUniforms.uRtVoxelTex, uRtOrigin: envUniforms.uRtOrigin, uRtQuality: envUniforms.uRtQuality,
      uCartoonMode: envUniforms.uCartoonMode, uSulfurWater: envUniforms.uSulfurWater
    },
    vertexShader: `
      attribute float aIsTop;
      attribute float aShore;
      attribute float aDepth;
      varying vec3 vWorldPos, vNormal; varying float vDist, vIsTop, vShore, vColDepth; varying vec4 vClipPos, vReflClip;
      uniform float uTime, uEclipseMode;
      uniform mat4 uReflMatrix;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz; vNormal = normal; vIsTop = aIsTop; vShore = aShore; vColDepth = aDepth;
        vec4 mv = viewMatrix * wp; vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
        vClipPos = gl_Position;
        vReflClip = uReflMatrix * vec4(wp.x, wp.y, wp.z, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime, uFogStart, uFogEnd, uQuality, uWaterQuality, uUsePlanarRefl, uUnderwater, uInLava, uWaterDepth, uDimension, uRainWetness, uChillMode, uDlssMode, uEclipseMode, uRayTracing, uCartoonMode, uSulfurWater;
      uniform vec3 uSunDir, uSunColor, uSkyTop, uSkyHorizon, uFogColor, uPlayerPos;
      uniform vec4 uWakePts[8];
      uniform sampler2D uReflMap;
      varying vec3 vWorldPos, vNormal; varying float vDist, vIsTop, vShore, vColDepth; varying vec4 vClipPos, vReflClip;
      ${RT_DDA_GLSL}

      // Single-pass analytical 4-octave directional wave height + slope (saves ~60% trig cost vs 3x finite differences)
      vec3 waterWaveGrad(vec2 p, float t, bool highDetail) {
        float h = 0.0;
        vec2 g = vec2(0.0);
        vec2 d1 = vec2(0.86, 0.51);
        float p1 = dot(p, d1) * 1.75 + t * 1.32;
        h += sin(p1) * 0.036;
        g += d1 * (cos(p1) * 0.063);
        vec2 d2 = vec2(-0.62, 0.78);
        float p2 = dot(p, d2) * 2.35 - t * 1.14;
        h += sin(p2) * 0.028;
        g += d2 * (cos(p2) * 0.066);
        if (highDetail) {
          vec2 d3 = vec2(0.36, -0.93);
          float p3 = dot(p, d3) * 4.20 + t * 1.88;
          h += sin(p3) * 0.015;
          g += d3 * (cos(p3) * 0.063);
          vec2 d4 = vec2(-0.91, -0.41);
          float p4 = dot(p, d4) * 6.90 - t * 2.45;
          h += sin(p4) * 0.008;
          g += d4 * (cos(p4) * 0.055);
        }
        return vec3(h, g.x, g.y);
      }
      // Authentic Eclipse waterBump.glsl + all_translucent.fsh: 3-octave golden-angle waves + patchy largeWavesCurved + parallax
      float eWaveNoise(vec2 p) {
        vec2 fl = floor(p);
        vec2 f = p - fl;
        vec2 u = f * f * (3.0 - 2.0 * f);
        vec2 i0 = mod(fl, 256.0);
        vec2 i1 = mod(fl + vec2(1.0, 0.0), 256.0);
        vec2 i2 = mod(fl + vec2(0.0, 1.0), 256.0);
        vec2 i3 = mod(fl + vec2(1.0, 1.0), 256.0);
        float a = fract(sin(dot(i0, vec2(127.1, 311.7))) * 43758.5453);
        float b = fract(sin(dot(i1, vec2(127.1, 311.7))) * 43758.5453);
        float c = fract(sin(dot(i2, vec2(127.1, 311.7))) * 43758.5453);
        float d = fract(sin(dot(i3, vec2(127.1, 311.7))) * 43758.5453);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float getEclipseWaterH(vec2 pos, float largeWavesCurved, float movement, bool highDetail) {
        mat2 rotM = mat2(-0.73739, -0.67546, 0.67546, -0.73739);
        float lwShift = largeWavesCurved * 0.5 + movement;
        float hSum = 0.0;
        vec2 p0 = rotM * pos;
        hSum += eWaveNoise(p0 / vec2(48.0, 12.0) * 14.0 + lwShift * 24.0);
        vec2 p1 = rotM * p0;
        hSum += eWaveNoise(p1 / vec2(12.0, 48.0) * 14.0 + lwShift * 24.0);
        if (highDetail) {
          vec2 p2 = rotM * p1;
          hSum += eWaveNoise(p2 / vec2(32.0, 32.0) * 14.0 + lwShift * 24.0);
        } else {
          hSum *= 1.5;
        }
        return (hSum / 4.5) * max(largeWavesCurved, 0.3);
      }
      vec2 getEclipseParallaxPos(vec2 pos, vec3 viewDir, float t, float dist, float shore) {
        float largeWaves = eWaveNoise(pos / 600.0 * 14.0);
        float largeWavesCurved = pow(1.0 - pow(1.0 - largeWaves, 2.5), 4.5);
        float hPar = getEclipseWaterH(pos, largeWavesCurved, t * 0.035, false);
        float waterHeight = exp(-7.0 * exp(-7.0 * hPar)) * 0.25;
        float damp = (1.0 - smoothstep(0.35, 1.0, shore) * 0.65) * exp(-dist * 0.015);
        vec2 shift = (viewDir.xz / max(abs(viewDir.y), 0.28)) * waterHeight * damp;
        return pos + clamp(shift, vec2(-0.32), vec2(0.32));
      }
      vec3 eclipseWaterGrad(vec2 p, float t, float dist, bool highDetail) {
        float movement = t * 0.035;
        float largeWaves = eWaveNoise(p / 600.0 * 14.0);
        float largeWavesCurved = pow(1.0 - pow(1.0 - largeWaves, 2.5), 4.5);
        float deltaPos = mix(1.0, 0.15, largeWavesCurved) + min(dist / 384.0, 3.0);
        float h0 = getEclipseWaterH(p, largeWavesCurved, movement, highDetail);
        float h1 = getEclipseWaterH(p + vec2(deltaPos, 0.0), largeWavesCurved, movement, highDetail);
        float h2 = getEclipseWaterH(p + vec2(0.0, deltaPos), largeWavesCurved, movement, highDetail);
        float farAtten = exp(-dist * 0.011);
        return vec3(h0 * 0.06, ((h1 - h0) / deltaPos) * 1.45 * farAtten, ((h2 - h0) / deltaPos) * 1.45 * farAtten);
      }
      void main() {
        vec3 n = normalize(vNormal), viewDir = normalize(cameraPosition - vWorldPos);
        bool highWater = (uQuality > 0.5 && uWaterQuality > 0.5);
        float waveH = 0.0, wakeFoam = 0.0;
        if (vIsTop > 0.5) {
          float waveAmp = mix(1.38, 0.42, smoothstep(0.0, 1.0, vShore));
          vec2 wSamplePos = (uEclipseMode > 0.5 && highWater)
            ? getEclipseParallaxPos(vWorldPos.xz, viewDir, uTime, vDist, vShore)
            : vWorldPos.xz;
          vec3 wg = uEclipseMode > 0.5 ? eclipseWaterGrad(wSamplePos, uTime, vDist, highWater) : waterWaveGrad(wSamplePos, uTime, highWater);
          waveH = wg.x;
          float ecWaveMul = mix(1.0, 1.18, uEclipseMode);
          n = normalize(vec3(-wg.y * waveAmp * ecWaveMul, 1.0, -wg.z * waveAmp * ecWaveMul));
          // Eclipse Player / Boat Wake Expanding Ripples (uWakePts[8])
          if (uEclipseMode > 0.5 && vDist < 42.0) {
            for (int wi = 0; wi < 8; wi++) {
              vec4 wpW = uWakePts[wi];
              float strW = wpW.w;
              float ageW = uTime - wpW.z;
              if (strW > 0.01 && ageW > 0.01 && ageW < 4.2) {
                vec2 diffW = vWorldPos.xz - wpW.xy;
                float distW = length(diffW);
                float rW = ageW * 1.95;
                float envW = exp(-pow((distW - rW) * 1.55, 2.0)) * exp(-ageW * 0.72) * strW;
                float slopeW = cos((distW - rW) * 12.5) * envW * 0.30;
                vec2 dirW = diffW / max(distW, 0.001);
                n.x += dirW.x * slopeW;
                n.z += dirW.y * slopeW;
                wakeFoam += envW * max(0.0, sin((distW - rW) * 12.5)) * 0.58;
              }
            }
            n.y = max(n.y, 0.25);
            n = normalize(n);
          }
          if (uRainWetness > 0.05 && vDist < 36.0) {
            vec2 rp = vWorldPos.xz * mix(2.2, 2.8, uEclipseMode);
            vec2 rc = floor(rp);
            vec2 rf = fract(rp) - 0.5;
            float rt = fract(uTime * 1.45 + fract(sin(dot(rc, vec2(127.1, 311.7))) * 43758.5));
            float rd = length(rf);
            float ring = sin((rd - rt * 0.55) * 32.0) * exp(-abs(rd - rt * 0.55) * 14.0) * (1.0 - rt);
            vec2 rDir = rf / max(rd, 0.001);
            n = normalize(vec3(n.x + rDir.x * ring * 0.24 * uRainWetness, n.y, n.z + rDir.y * ring * 0.24 * uRainWetness));
          }
        }
        float NdotV = clamp(abs(dot(viewDir, n)), 0.001, 1.0);
        // Physical Schlick Fresnel (Eclipse increases grazing mirror sheen slightly)
        float fresnel = 0.025 + 0.95 * pow(1.0 - NdotV, mix(4.0, 3.8, uEclipseMode));
        vec3 sunD = normalize(uSunDir);
        float sunUp = smoothstep(-0.14, 0.24, sunD.y);
        float nightK = 1.0 - sunUp;

        // Semi-Opaque Depth-Turbid Marine Ocean Water (all shaders: shallow coastal teal -> deep opaque ocean blue!)
        float depthK = clamp(vColDepth * 1.15 + (1.0 - vShore) * 0.14, 0.0, 1.0);
        float turbid = 1.0 - exp(-(0.80 + vColDepth * 5.2));
        vec3 shallowDay = mix(vec3(0.095, 0.36, 0.42), vec3(0.085, 0.38, 0.44), uEclipseMode);
        vec3 deepDay = mix(vec3(0.020, 0.13, 0.24), vec3(0.018, 0.14, 0.25), uEclipseMode);
        shallowDay = mix(shallowDay, vec3(0.14, 0.72, 0.94), uCartoonMode * 0.85);
        deepDay = mix(deepDay, vec3(0.04, 0.42, 0.78), uCartoonMode * 0.85);
        shallowDay = mix(shallowDay, vec3(0.10, 0.74, 0.70), uSulfurWater);
        deepDay = mix(deepDay, vec3(0.03, 0.46, 0.50), uSulfurWater);
        vec3 baseDay = mix(shallowDay, deepDay, smoothstep(0.0, 0.85, depthK));
        if (uEclipseMode > 0.5 || uRayTracing > 0.5) {
          vec3 beerWater = exp(-max(0.4, depthK * 14.0) * vec3(0.392389, 0.108329, 0.0660636)) * vec3(0.22, 0.36, 0.44);
          baseDay = mix(baseDay, max(deepDay, beerWater), uRayTracing > 0.5 ? 0.68 : 0.55);
        }
        baseDay *= mix(1.0, 0.84, smoothstep(14.0, 72.0, vDist));
        vec3 shallowNight = vec3(0.015, 0.075, 0.14), deepNight = vec3(0.006, 0.018, 0.055);
        vec3 baseWater = mix(mix(shallowNight, deepNight, smoothstep(0.0, 0.85, depthK)), baseDay, sunUp);

        vec3 activeLightDir = sunD.y > -0.05 ? sunD : normalize(vec3(-sunD.x, max(0.28, -sunD.y), -sunD.z));
        vec3 activeLightCol = sunD.y > -0.05 ? uSunColor : vec3(0.62, 0.80, 1.0);
        float activeStrength = sunD.y > -0.05 ? sunUp : 0.68;

        vec3 col = baseWater;
        float alpha = clamp(0.76 + vColDepth * 0.18, 0.76, 0.96);
        bool fromBelow = (cameraPosition.y < vWorldPos.y - 0.05);
        if (vIsTop > 0.5 && fromBelow) {
          // Physical Snell's Window looking UP from underwater (incident ray -viewDir to water normal nUw)
          vec3 nUw = normalize(vec3(n.x * 2.1, n.y, n.z * 2.1));
          float cosInc = max(dot(-viewDir, nUw), 0.0);
          vec3 refrDir = refract(-viewDir, -nUw, 1.3333);
          float snell = smoothstep(0.38, 0.66, cosInc);
          float depthFade = exp(-uWaterDepth * 0.075);
          float uwSunAlign = pow(max(dot(normalize(refrDir + vec3(0.0, 0.015, 0.0)), sunD), 0.0), 10.0) * 1.35
                           + pow(max(dot(normalize(refrDir + vec3(0.0, 0.015, 0.0)), sunD), 0.0), 3.0) * 0.48;
          float fwdWaveSun = pow(max(dot(-viewDir, sunD), 0.0), 4.0) * (0.45 + 0.55 * max(dot(nUw, sunD), 0.0));
          vec3 skyThru = mix(vec3(0.14, 0.62, 0.78), vec3(0.95, 1.38, 1.42), snell) * (0.20 + 0.88 * sunUp) * depthFade;
          vec3 sunPatch = uSunColor * (uwSunAlign * snell * 1.45 + fwdWaveSun * 0.72) * sunUp * depthFade;
          float rippleEdge = pow(clamp(1.0 - abs(nUw.y), 0.0, 1.0), 0.58) * 0.55 * sunUp * depthFade;
          vec3 totalIntRefl = mix(vec3(0.015, 0.095, 0.165), vec3(0.028, 0.15, 0.24), clamp(nUw.x * 0.5 + 0.5, 0.0, 1.0)) + uFogColor * 0.16;
          col = mix(totalIntRefl + vec3(0.24, 0.64, 0.72) * rippleEdge, skyThru + sunPatch, snell);
          alpha = mix(0.92, 0.94, snell);
        } else if (vIsTop > 0.5) {
          if (uCartoonMode > 0.5) {
            vec3 cShallow = mix(vec3(0.16, 0.70, 0.96), vec3(0.12, 0.80, 0.74), uSulfurWater);
            vec3 cDeep = mix(vec3(0.06, 0.49, 0.87), vec3(0.04, 0.50, 0.56), uSulfurWater);
            vec3 cWater = mix(cShallow, cDeep, smoothstep(0.0, 0.85, depthK)) * (0.28 + 0.76 * sunUp);
            float cStreak = sin(vWorldPos.z * 0.55 + uTime * 1.05 + sin(vWorldPos.x * 0.14) * 1.1);
            float cWave = smoothstep(0.76, 0.96, cStreak) * 0.36;
            cWater += vec3(0.06, 0.13, 0.18) * cWave * sunUp;
            float cShore = smoothstep(0.76, 0.96, vShore);
            cWater = mix(cWater, vec3(0.84, 0.97, 1.0), cShore * 0.48);
            float cFog = smoothstep(uFogStart, uFogEnd, vDist);
            gl_FragColor = vec4(mix(cWater, uFogColor, clamp(cFog, 0.0, 1.0)), clamp(0.82 + vColDepth * 0.14, 0.82, 0.94));
            return;
          }
          bool isUltraW = (uQuality > 1.5);
          vec3 reflDir = reflect(-viewDir, n);
          vec3 nightSkyRefl = mix(vec3(0.04, 0.09, 0.20), vec3(0.015, 0.035, 0.095), pow(clamp(reflDir.y, 0.0, 1.0), 0.55));
          vec3 daySkyRefl = mix(uSkyHorizon * vec3(0.92, 1.02, 1.06), uSkyTop, pow(clamp(reflDir.y, 0.0, 1.0), 0.46));
          vec3 reflFallback = mix(nightSkyRefl, daySkyRefl, sunUp);
          reflFallback += activeLightCol * pow(max(dot(reflDir, activeLightDir), 0.0), 18.0) * (0.30 * sunUp + 0.18 * nightK);
          vec3 reflCol = reflFallback;
          bool hasPlanarW = (uUsePlanarRefl > 0.5 && highWater && abs(vWorldPos.y - 0.86) < 0.45);
          if (hasPlanarW) {
            vec2 ndc = (vReflClip.xy / max(0.001, vReflClip.w)) * 0.5 + 0.5;
            float shoreCalm = 1.0 - smoothstep(0.0, 0.72, vShore) * 0.94;
            float distDamp = 1.0 / (1.0 + vDist * 0.032);
            vec2 reflUv = ndc + n.xz * vec2(0.022, 0.036) * shoreCalm * distDamp * mix(1.0, 0.92, uEclipseMode);
            float edgeMask = step(0.01, vReflClip.w) * smoothstep(0.0, 0.06, reflUv.x) * smoothstep(1.0, 0.94, reflUv.x)
                           * smoothstep(0.0, 0.08, reflUv.y) * smoothstep(1.0, 0.92, reflUv.y);
            vec3 mapSample = texture2D(uReflMap, clamp(reflUv, 0.004, 0.996)).rgb;
            mapSample = mix(mapSample, max(mapSample, baseWater * 0.72), isUltraW ? 0.22 : 0.30);
            reflCol = mix(reflFallback, mapSample, edgeMask * ((isUltraW ? 0.90 : 0.84) - vShore * (isUltraW ? 0.16 : 0.20)));
          }
          if (uRayTracing > 0.5 && vDist < 44.0) {
            float rtFadeW = rtInVol(vWorldPos) * (1.0 - smoothstep(32.0, 44.0, vDist));
            if (rtFadeW > 0.01) {
              vec3 rtWaterPos = vWorldPos + vec3(0.0, 0.10, 0.0);
              vec3 rtNormW = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.56));
              vec3 rtRDirW = reflect(-viewDir, rtNormW);
              vec4 rtW = rtTraceReflection(rtWaterPos, normalize(vec3(rtRDirW.x, max(0.03, rtRDirW.y), rtRDirW.z)), sunD, activeLightCol, uSkyTop, uSkyHorizon, sunUp, 30.0);
              vec3 rtReflCol = mix(reflFallback, rtW.rgb * 1.22, rtW.a);
              reflCol = mix(reflCol, hasPlanarW ? mix(reflCol, rtReflCol, clamp(rtW.a * 0.90, 0.0, 0.92)) : rtReflCol, rtFadeW * (hasPlanarW ? 0.92 : 0.98));
              vec3 refrDirW = refract(-viewDir, n, 0.75);
              refrDirW = normalize(length(refrDirW) > 0.01 ? refrDirW : -viewDir);
              vec4 rtSub = rtTraceRefractFloor(vWorldPos - vec3(0.0, 0.08, 0.0), refrDirW);
              if (rtSub.a > 0.02) {
                float rtCaustW = pow(clamp(0.5 + 0.5 * sin(vWorldPos.x * 1.65 + uTime * 2.1 + cos(vWorldPos.z * 1.55 - uTime * 1.8)), 0.0, 1.0), 3.0);
                baseWater = mix(baseWater, baseWater * 0.38 + rtSub.rgb * (0.34 + 0.58 * sunUp + rtCaustW * 0.28 * sunUp), rtSub.a * rtFadeW * 0.72);
              }
            }
          }
          float waveShade = clamp(0.95 + n.x * 0.14 + n.z * 0.14, 0.85, 1.12);
          float reflMix = clamp(fresnel * (uRayTracing > 0.5 ? 0.86 : (isUltraW ? 0.68 : 0.62)) + (uRayTracing > 0.5 ? 0.16 : (isUltraW ? 0.07 : 0.05)) + max(uDlssMode * 0.03, uEclipseMode * 0.05), 0.08, uRayTracing > 0.5 ? 0.94 : (isUltraW ? 0.78 : 0.68));
          col = mix(baseWater * waveShade, reflCol * waveShade, reflMix);
          // Delicate animated shoreline foam + player/boat wake foam shimmer
          float foamBand = clamp(smoothstep(0.76, 1.0, vShore + waveH * 1.45) * (0.30 + 0.70 * sunUp) + wakeFoam, 0.0, 1.0);
          col = mix(col, vec3(0.86, 0.97, 0.99), foamBand * (isUltraW ? 0.36 : 0.28));

          // Crisp Sun / Moon Specular Glint Path + Broad Sky Shimmer across ripples
          vec3 halfV = normalize(activeLightDir + viewDir);
          float specTight = pow(max(dot(n, halfV), 0.0), mix(230.0, 310.0, max(max(uDlssMode, uEclipseMode * 0.75), uRayTracing))) * activeStrength;
          float specBroad = pow(max(dot(n, halfV), 0.0), mix(34.0, 24.0, uEclipseMode)) * (0.22 * sunUp + 0.14 * nightK);
          col += activeLightCol * (specTight * (isUltraW ? 0.42 : (highWater ? 0.34 : 0.24)) * (1.0 + max(uDlssMode * 0.18, uEclipseMode * 0.22) + uRayTracing * 0.42) + specBroad * (isUltraW ? 0.22 : 0.18) * (1.0 + uEclipseMode * 0.18 + uRayTracing * 0.18));
          float wPeak = max(col.r, max(col.g, col.b));
          float wLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float wMetric = mix(wLum, wPeak, 0.45);
          float wFloor = mix(0.62, 0.98, uRayTracing);
          if (wMetric > wFloor) col *= (wFloor + (wMetric - wFloor) / (1.0 + (wMetric - wFloor) * mix(2.85, 1.25, uRayTracing))) / max(wMetric, 0.0001);

          float baseAlpha = mix(0.78, 0.985, clamp(turbid * 0.86 + depthK * 0.24, 0.0, 1.0));
          alpha = clamp(mix(baseAlpha, 0.99, clamp(fresnel * 0.88, 0.0, 1.0)), 0.76, 0.992);
          if (uEclipseMode > 0.5) alpha = max(alpha, clamp(wakeFoam * 0.62, 0.0, 0.95));
        }

        // v59 THE SIFT: Vivid Swirling Rainbow Ichor Water (matches ref pond: cyan/magenta/pink/gold iridescence!)
        if (uDimension > 2.5 && uDimension < 3.5) {
          vec2 ip = vWorldPos.xz * 0.26;
          float sw1 = sin(ip.x * 1.15 + uTime * 0.95 + cos(ip.y * 1.05 - uTime * 0.68) * 1.75);
          float sw2 = cos(ip.y * 1.25 - uTime * 0.82 + sin(ip.x * 0.95 + uTime * 0.58) * 1.65);
          float sw3 = sin((ip.x - ip.y) * 0.85 + uTime * 0.72 + sw1 * 0.8);
          vec3 cCyan = vec3(0.14, 0.96, 0.99);
          vec3 cPink = vec3(1.00, 0.42, 0.86);
          vec3 cMint = vec3(0.36, 0.99, 0.76);
          vec3 cGold = vec3(1.00, 0.94, 0.56);
          vec3 cLav  = vec3(0.78, 0.54, 1.00);
          vec3 ichor = mix(cCyan, cPink, smoothstep(-0.8, 0.8, sw1));
          ichor = mix(ichor, cMint, smoothstep(0.0, 0.95, sw2 * 0.5 + 0.5) * 0.55);
          ichor = mix(ichor, mix(cLav, cGold, sw3 * 0.5 + 0.5), 0.38);
          float sparkle = pow(max(0.0, sin(vWorldPos.x * 3.4 + uTime * 2.2) * cos(vWorldPos.z * 3.3 - uTime * 1.9)), 6.0);
          col = mix(col, ichor + vec3(sparkle * 0.55) + vec3(0.18, 0.22, 0.25) * vShore, 0.90);
          alpha = clamp(alpha + 0.18, 0.78, 0.96);
        }
        if (uInLava > 0.5) {
          float lvFogW = clamp(smoothstep(0.30, 3.05, vDist), 0.0, 0.995);
          gl_FragColor = vec4(mix(col * vec3(1.10, 0.54, 0.30), uFogColor, lvFogW), alpha);
        } else if (uUnderwater > 0.5) {
          float uwFogW = (1.0 - exp(-vDist * mix(0.042, 0.125, clamp(uWaterDepth / 34.0, 0.0, 1.0)))) * ((fromBelow && vIsTop > 0.5) ? 0.38 : 1.0);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(uwFogW, 0.0, 0.98)), alpha);
        } else {
          float fogF = smoothstep(uFogStart, uFogEnd, vDist);
          vec3 vDirW = normalize(vWorldPos - cameraPosition);
          float wNoonTame = 1.0 - smoothstep(0.45, 0.92, sunD.y) * mix(0.68, 0.42, uEclipseMode);
          float wScatter = pow(max(dot(vDirW, activeLightDir), 0.0), mix(7.0, 4.0, uEclipseMode)) * activeStrength;
          vec3 wFogBase = uFogColor * mix(1.00, 0.90, smoothstep(0.45, 0.92, sunD.y));
          vec3 wSunGlow = mix(min(activeLightCol * 0.90, vec3(0.90, 0.84, 0.74)), min(activeLightCol * 1.08, vec3(1.0, 0.90, 0.72)), uEclipseMode);
          vec3 scatterFogW = mix(wFogBase, wSunGlow, wScatter * (mix(0.18, 0.46, uEclipseMode) * sunUp * wNoonTame + 0.14 * nightK));
          gl_FragColor = vec4(mix(col, scatterFogW, fogF), alpha);
        }
      }`
  });

  // Animated Liquid Lava Shader (Viscous Undulating Waves + Swirling Molten Magma Veins + Cooling Basalt Crust + Downward Lava Falls!)
  const lavaMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: envUniforms.uTime, uFogColor: envUniforms.uFogColor,
      uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uReflClipY: envUniforms.uReflClipY, uInLava: envUniforms.uInLava
    },
    vertexShader: `
      attribute float aIsTop;
      attribute float aShore;
      varying vec3 vWorldPos, vNormal; varying float vDist, vIsTop, vShore;
      uniform float uTime;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        if (aIsTop > 0.5) {
          float swell = sin(wp.x * 0.95 + uTime * 1.15) * 0.026
                      + cos(wp.z * 0.90 - uTime * 0.95) * 0.022
                      + sin((wp.x + wp.z) * 1.65 + uTime * 1.50) * 0.011;
          wp.y += swell * (1.0 - aShore * 0.72);
        }
        vWorldPos = wp.xyz; vNormal = normal; vIsTop = aIsTop; vShore = aShore;
        vec4 mv = viewMatrix * wp; vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uFogStart, uFogEnd, uReflClipY, uInLava;
      uniform vec3 uFogColor;
      varying vec3 vWorldPos, vNormal; varying float vDist, vIsTop, vShore;

      float lHash(vec2 p) { return fract(sin(dot(mod(p, 289.0), vec2(127.1, 311.7))) * 43758.5453); }
      float lNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(lHash(i), lHash(i + vec2(1.0, 0.0)), u.x), mix(lHash(i + vec2(0.0, 1.0)), lHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float lFbm(vec2 p) {
        float s = lNoise(p) * 0.54;
        p = mat2(0.80, 0.60, -0.60, 0.80) * p * 2.04 + vec2(9.2, 4.7);
        s += lNoise(p) * 0.30;
        p = mat2(0.80, 0.60, -0.60, 0.80) * p * 2.04 + vec2(3.8, 11.4);
        s += lNoise(p) * 0.16;
        return s;
      }
      float lavaWave(vec2 p, float t) {
        return sin(p.x * 2.1 + p.y * 0.9 + t * 1.15) * 0.42
             + cos(p.x * 1.2 - p.y * 2.4 - t * 0.98) * 0.36
             + sin(p.x * 4.1 - p.y * 3.5 + t * 1.65) * 0.22;
      }
      void main() {
        if (vWorldPos.y < uReflClipY) discard;
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec2 uvFlow;
        float tFlow;

        if (vIsTop > 0.5) {
          uvFlow = vWorldPos.xz * 0.68;
          tFlow = uTime;
          // Fast viscous magma wave normal (smooth glossy ripples like water!)
          float eps = 0.06;
          float hC = lavaWave(vWorldPos.xz, uTime);
          float hX = lavaWave(vWorldPos.xz + vec2(eps, 0.0), uTime);
          float hZ = lavaWave(vWorldPos.xz + vec2(0.0, eps), uTime);
          float wAmp = mix(1.45, 0.65, vShore);
          n = normalize(vec3((hC - hX) * wAmp, 1.0, (hC - hZ) * wAmp));
        } else {
          // Gravity-driven downward molten cascades on Nether Lava Falls!
          uvFlow = vec2((vWorldPos.x + vWorldPos.z) * 1.12, vWorldPos.y * 0.55 + uTime * 2.25);
          tFlow = uTime * 1.35;
        }

        // Single-pass domain-warped boiling convection cells + glowing crack veins
        vec2 q = vec2(
          lFbm(uvFlow + vec2(tFlow * 0.17, -tFlow * 0.11)),
          lFbm(uvFlow + vec2(5.2 - tFlow * 0.13, 1.3 + tFlow * 0.15))
        );
        float m = lFbm(uvFlow * 1.26 + q * 1.72 + vec2(tFlow * 0.08, tFlow * 0.06));
        float ridge = 1.0 - abs(lNoise(uvFlow * 2.85 + q * 2.10 - vec2(tFlow * 0.24, -tFlow * 0.18)) * 2.0 - 1.0);
        float vein = pow(clamp(ridge, 0.0, 1.0), 2.7);
        if (vIsTop < 0.5) m = clamp(m * 1.12 + 0.06, 0.0, 1.0);

        // 4-stop volcanic color ramp: Dark Cooling Basalt Crust -> Deep Crimson -> Molten Orange -> Incandescent Gold Veins
        float heat = clamp(m * 0.85 + vein * 0.40 + vShore * 0.07, 0.0, 1.0);
        vec3 crustCol   = vec3(0.14, 0.025, 0.015);
        vec3 crimsonCol = vec3(0.66, 0.08, 0.015);
        vec3 orangeCol  = vec3(1.00, 0.35, 0.03);
        vec3 goldCol    = vec3(1.14, 0.82, 0.24);

        vec3 col = mix(crustCol, crimsonCol, smoothstep(0.24, 0.44, heat));
        col = mix(col, orangeCol, smoothstep(0.44, 0.68, heat));
        col = mix(col, goldCol, smoothstep(0.68, 0.94, heat));

        // Viscous ripple contrast + molten Fresnel heat sheen + pulsing convection glow
        float waveSh = vIsTop > 0.5 ? clamp(0.92 + n.x * 0.28 + n.z * 0.28, 0.78, 1.18) : 1.0;
        float NdotV = clamp(abs(dot(viewDir, n)), 0.001, 1.0);
        float fresnel = pow(1.0 - NdotV, 2.5);
        float pulse = 0.96 + 0.06 * sin(uTime * 2.2 + vWorldPos.x * 0.45 + vWorldPos.z * 0.45);
        col = col * waveSh * pulse
            + vec3(0.96, 0.28, 0.03) * fresnel * 0.30
            + vec3(0.60, 0.16, 0.02) * vShore * (1.0 - smoothstep(0.55, 0.88, heat)) * 0.35;

        float fogF = uInLava > 0.5 ? clamp(smoothstep(0.30, 3.05, vDist), 0.0, 0.995) : smoothstep(uFogStart, uFogEnd * 1.12, vDist);
        gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
      }`
  });

  /* Multi-Pass WebGL Post-Processing Compositor (BSL Volumetric God-Rays + Dual-Scale Bloom + AgX Filmic Grade!) */
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postQuadGeo = new THREE.PlaneBufferGeometry(2, 2);
  let sceneRT = null, bloomRT1 = null, bloomRT2 = null, bloomWide1 = null, bloomWide2 = null, godRayRT1 = null, godRayRT2 = null, fgRtA = null, fgRtB = null, fgPing = 0;
  function ensurePostRTs(needWide = false, needFg = false) {
    if (!sceneRT) {
      const msaaSamples = (!_initMobile && renderer.capabilities && renderer.capabilities.isWebGL2) ? 4 : 0;
      sceneRT = new THREE.WebGLRenderTarget(1280, 720, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false, samples: msaaSamples });
      const fxOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
      bloomRT1 = new THREE.WebGLRenderTarget(320, 180, fxOpts);
      bloomRT2 = new THREE.WebGLRenderTarget(320, 180, fxOpts);
      godRayRT1 = new THREE.WebGLRenderTarget(320, 180, fxOpts);
      godRayRT2 = new THREE.WebGLRenderTarget(320, 180, fxOpts);
    }
    if (needWide && !bloomWide1) {
      const wOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
      bloomWide1 = new THREE.WebGLRenderTarget(160, 90, wOpts);
      bloomWide2 = new THREE.WebGLRenderTarget(160, 90, wOpts);
    }
    if (needFg && !fgRtA) {
      const fgOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
      fgRtA = new THREE.WebGLRenderTarget(1280, 720, fgOpts);
      fgRtB = new THREE.WebGLRenderTarget(1280, 720, fgOpts);
    }
  }

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uEclipseMode: envUniforms.uEclipseMode }, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uQuality, uChillMode, uEclipseMode; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float peak = max(c.r, max(c.g, c.b));
        float hi = mix(lum, peak, mix(0.28, 0.34, max(uChillMode, uEclipseMode * 0.85)));
        float hiLo = mix(uQuality > 1.5 ? 1.04 : 1.08, mix(1.02, 1.05, uEclipseMode), max(uChillMode, uEclipseMode * 0.9));
        float hiGain = mix(uQuality > 1.5 ? 0.28 : 0.22, mix(0.36, 0.30, uEclipseMode), max(uChillMode, uEclipseMode * 0.85));
        float w = smoothstep(hiLo, 1.38, hi);
        gl_FragColor = vec4(c * w * w * hiGain, 1.0);
      }`
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1 / 320, 0) } }, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;
        s += (texture2D(tDiffuse, vUv + uDir * 1.3846).rgb + texture2D(tDiffuse, vUv - uDir * 1.3846).rgb) * 0.316216;
        s += (texture2D(tDiffuse, vUv + uDir * 3.2307).rgb + texture2D(tDiffuse, vUv - uDir * 3.2307).rgb) * 0.070270;
        gl_FragColor = vec4(s, 1.0);
      }`
  });
  const fgBlendMat = new THREE.ShaderMaterial({
    uniforms: {
      tCur: { value: null },
      tPrev: { value: null },
      uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
      uReprojUV: { value: new THREE.Vector2(0, 0) },
      uZoom: { value: 0.0 },
      uIsSynth: { value: 0.0 },
      uFlowAmt: { value: 0.0 },
      uAiSharp: { value: 0.42 }
    },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tCur, tPrev;
      uniform vec2 uTexel, uReprojUV;
      uniform float uZoom, uIsSynth, uFlowAmt, uAiSharp;
      varying vec2 vUv;
      float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        vec2 uv = vUv;
        if (uIsSynth > 0.5) {
          uv = vUv + uReprojUV + (vUv - 0.5) * uZoom;
          uv = clamp(uv, uTexel * 1.5, vec2(1.0) - uTexel * 1.5);
        }
        vec3 c = texture2D(tCur, uv).rgb;
        vec3 nN = texture2D(tCur, uv + vec2(0.0, uTexel.y)).rgb;
        vec3 nS = texture2D(tCur, uv - vec2(0.0, uTexel.y)).rgb;
        vec3 nE = texture2D(tCur, uv + vec2(uTexel.x, 0.0)).rgb;
        vec3 nW = texture2D(tCur, uv - vec2(uTexel.x, 0.0)).rgb;
        vec3 mn = min(c, min(min(nN, nS), min(nE, nW)));
        vec3 mx = max(c, max(max(nN, nS), max(nE, nW)));

        // Local variance-clipped optical-flow motion prediction for animated water/grass/mobs on AI synth frames
        if (uIsSynth > 0.5 && uFlowAmt > 0.01) {
          vec2 eDist = min(uv, 1.0 - uv);
          float edgeMask = smoothstep(0.0, 0.04, min(eDist.x, eDist.y));
          vec3 pC = texture2D(tPrev, uv).rgb;
          float dI = luma(c) - luma(pC);
          float gx = (luma(nE) - luma(nW)) * 0.5;
          float gy = (luma(nN) - luma(nS)) * 0.5;
          float g2 = gx * gx + gy * gy + 0.004;
          vec2 flow = clamp(vec2(gx, gy) * (-dI / g2), vec2(-1.4), vec2(1.4)) * uTexel * (uFlowAmt * edgeMask);
          vec3 pred = texture2D(tCur, clamp(uv + flow, uTexel, vec2(1.0) - uTexel)).rgb;
          c = mix(c, clamp(pred, mn, mx), 0.42 * edgeMask);
        }

        // AMD FSR RCAS Edge-Directed AI Super-Resolution Sharpening (anti-ringing, color-neutral)
        if (uAiSharp > 0.01) {
          float lC = luma(c), lN = luma(nN), lS = luma(nS), lE = luma(nE), lW = luma(nW);
          float minL = min(lC, min(min(lN, lS), min(lE, lW)));
          float maxL = max(lC, max(max(lN, lS), max(lE, lW)));
          float lobe = clamp(-min(minL, 1.0 - maxL) / max(maxL, 0.001), -0.18, 0.0) * uAiSharp;
          vec3 rcas = (c + (nN + nS + nE + nW) * lobe) / (1.0 + 4.0 * lobe);
          c = clamp(rcas, mn * 0.96, mx * 1.04);
        }
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const godRayMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      uLightScreen: envUniforms.uLightScreenPos,
      uShaftColor: envUniforms.uShaftColor,
      uShaftStrength: envUniforms.uShaftStrength,
      uUnderwater: envUniforms.uUnderwater,
      uTime: envUniforms.uTime
    },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tScene;
      uniform vec2 uLightScreen;
      uniform vec3 uShaftColor;
      uniform float uShaftStrength, uUnderwater, uTime;
      varying vec2 vUv;
      void main() {
        if (uShaftStrength <= 0.005) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec2 delta = (vUv - uLightScreen) * (0.92 / 24.0);
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        vec2 sampleUv = vUv - delta * ign;
        float shafts = 0.0, decay = 1.0;
        for (int i = 0; i < 24; i++) {
          sampleUv -= delta;
          if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
            vec4 s = texture2D(tScene, sampleUv);
            float lum = clamp(dot(s.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.4);
            if (uUnderwater > 0.5) {
              float snellPass = smoothstep(0.24, 0.78, lum) * smoothstep(0.08, 0.62, sampleUv.y);
              shafts += (snellPass * 0.92 + clamp(1.0 - s.a, 0.0, 1.0) * 0.35) * decay;
            } else {
              float skyOcc = clamp(1.0 - s.a, 0.0, 1.0);
              shafts += skyOcc * (0.32 + 0.68 * lum) * decay;
            }
          }
          decay *= 0.932;
        }
        float radial = exp(-length(vUv - uLightScreen) * (uUnderwater > 0.5 ? 0.62 : 1.02));
        if (uUnderwater > 0.5) {
          vec2 dL = vUv - uLightScreen;
          float ang = atan(dL.y, dL.x);
          float waveBeam = 0.50 + 0.50 * pow(0.5 + 0.5 * sin(ang * 19.0 + uTime * 0.9) * cos(ang * 13.0 - uTime * 0.6), 1.4);
          radial *= waveBeam;
        }
        float val = (shafts / 24.0) * radial * uShaftStrength;
        gl_FragColor = vec4(uShaftColor * val, 1.0);
      }`
  });
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tBloom: { value: null }, tBloomWide: { value: null }, tGodRays: { value: null },
      uUnderwater: envUniforms.uUnderwater, uInLava: envUniforms.uInLava, uWaterDepth: envUniforms.uWaterDepth, uTime: envUniforms.uTime,
      uVibrance: envUniforms.uVibrance, uWarmth: envUniforms.uWarmth,
      uExposure: envUniforms.uExposure, uContrast: envUniforms.uContrast,
      uSharpness: envUniforms.uSharpness, uTexelSize: envUniforms.uTexelSize,
      uMoonBoost: envUniforms.uMoonBoost, uDimension: envUniforms.uDimension,
      uHasGodRays: envUniforms.uHasGodRays, uQuality: envUniforms.uQuality,
      uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode,
      uLightScreen: envUniforms.uLightScreenPos, uSunVis: envUniforms.uSunVis, uRayTracing: envUniforms.uRayTracing, uCartoonMode: envUniforms.uCartoonMode
    },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tScene, tBloom, tBloomWide, tGodRays;
      uniform float uUnderwater, uInLava, uWaterDepth, uTime, uVibrance, uWarmth, uExposure, uContrast, uSharpness, uMoonBoost, uDimension, uHasGodRays, uQuality, uChillMode, uDlssMode, uEclipseMode, uSunVis, uRayTracing, uCartoonMode;
      uniform vec2 uTexelSize, uLightScreen;
      varying vec2 vUv;
      // Authentic Merlin1809 Eclipse-Shader AgX Minimal Tonemap & Vignette (color_transforms.glsl / final.fsh)
      vec3 agxDefaultContrastApprox(vec3 x) {
        vec3 x2 = x * x;
        vec3 x4 = x2 * x2;
        return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      }
      vec3 agxLook(vec3 val) {
        float luma = dot(val, vec3(0.2126, 0.7152, 0.0722));
        return vec3(luma) + 1.25 * (val - vec3(luma));
      }
      vec3 ToneMap_AgX_minimal_merlin(vec3 color) {
        mat3 AgXInsetMatrix = mat3(
          0.842479062253094, 0.0423282422610123, 0.0423756549057051,
          0.0784335999999992, 0.878468636469772, 0.0784336,
          0.0792237451477643, 0.0791661274605434, 0.879142973793104
        );
        mat3 AgXOutsetMatrix = mat3(
          1.19687900512017, -0.0528968517574562, -0.0529716355144438,
          -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
          -0.0990297440797205, -0.0989611768448433, 1.15107367264116
        );
        const float AgxMinEv = -11.47393;
        const float AgxMaxEv = 3.226069;
        color = AgXInsetMatrix * max(color, vec3(1e-5));
        color = clamp(log2(max(color, vec3(1e-5))), AgxMinEv, AgxMaxEv);
        color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
        color = agxDefaultContrastApprox(color);
        color = agxLook(color);
        color = AgXOutsetMatrix * color;
        color = pow(max(color, vec3(0.0)), vec3(2.2));
        return clamp(color, 0.0, 1.0);
      }
      float eclipseVignette(vec2 uv, float noise) {
        float v = 1.0 - clamp(1.0 - length(uv - 0.5), 0.0, 1.0);
        v *= v * v;
        v = 1.0 - v;
        v *= v * v * v * v;
        v = v + v * (noise - 0.5) * 0.01;
        return mix(1.0, v, 0.22);
      }
      void main() {
        vec2 uv = vUv;
        bool isUltraC = (uQuality > 1.5);
        if (uUnderwater > 0.5) {
          uv.x += sin(uv.y * 14.0 + uTime * 2.4) * mix(0.0018, 0.0024, uEclipseMode);
          uv.y += cos(uv.x * 12.0 + uTime * 2.0) * mix(0.0014, 0.0018, uEclipseMode);
        } else if (uInLava > 0.5) {
          uv.x += sin(uv.y * 9.0 + uTime * 1.8) * 0.0022;
          uv.y += cos(uv.x * 8.0 + uTime * 1.5) * 0.0016;
        }
        vec3 col = texture2D(tScene, uv).rgb;
        if (uInLava > 0.5) {
          vec2 lvTap = uTexelSize * 2.2;
          col = col * 0.28
            + texture2D(tScene, clamp(uv + vec2(lvTap.x, lvTap.y), 0.002, 0.998)).rgb * 0.18
            + texture2D(tScene, clamp(uv + vec2(-lvTap.x, lvTap.y), 0.002, 0.998)).rgb * 0.18
            + texture2D(tScene, clamp(uv + vec2(lvTap.x, -lvTap.y), 0.002, 0.998)).rgb * 0.18
            + texture2D(tScene, clamp(uv + vec2(-lvTap.x, -lvTap.y), 0.002, 0.998)).rgb * 0.18;
        } else if (uUnderwater < 0.5) {
          if (uRayTracing > 0.5) {
            vec2 rtTap = uTexelSize * 1.05;
            vec3 dN = texture2D(tScene, clamp(uv + vec2(0.0, rtTap.y), 0.002, 0.998)).rgb;
            vec3 dS = texture2D(tScene, clamp(uv - vec2(0.0, rtTap.y), 0.002, 0.998)).rgb;
            vec3 dE = texture2D(tScene, clamp(uv + vec2(rtTap.x, 0.0), 0.002, 0.998)).rgb;
            vec3 dW = texture2D(tScene, clamp(uv - vec2(rtTap.x, 0.0), 0.002, 0.998)).rgb;
            float wN = exp(-dot(abs(dN - col), vec3(1.0)) * 18.0) * 0.65;
            float wS = exp(-dot(abs(dS - col), vec3(1.0)) * 18.0) * 0.65;
            float wE = exp(-dot(abs(dE - col), vec3(1.0)) * 18.0) * 0.65;
            float wW = exp(-dot(abs(dW - col), vec3(1.0)) * 18.0) * 0.65;
            col = (col + dN * wN + dS * wS + dE * wE + dW * wW) / (1.0 + wN + wS + wE + wW);
          }
          if (uSharpness > 0.01) {
            vec3 nN = texture2D(tScene, uv + vec2(0.0, uTexelSize.y)).rgb;
            vec3 nS = texture2D(tScene, uv - vec2(0.0, uTexelSize.y)).rgb;
            vec3 nE = texture2D(tScene, uv + vec2(uTexelSize.x, 0.0)).rgb;
            vec3 nW = texture2D(tScene, uv - vec2(uTexelSize.x, 0.0)).rgb;
            // Edge-aware FXAA-lite: anti-alias jagged high-contrast silhouettes without blurring textures
            float lC = dot(col, vec3(0.299, 0.587, 0.114));
            float lN = dot(nN, vec3(0.299, 0.587, 0.114));
            float lS = dot(nS, vec3(0.299, 0.587, 0.114));
            float lE = dot(nE, vec3(0.299, 0.587, 0.114));
            float lW = dot(nW, vec3(0.299, 0.587, 0.114));
            float lRange = max(max(lC, max(lN, lS)), max(lE, lW)) - min(min(lC, min(lN, lS)), min(lE, lW));
            float aaMask = smoothstep(0.06, 0.24, lRange);
            if (aaMask > 0.02) {
              float dirH = abs((lN + lS) * 0.5 - lC), dirV = abs((lE + lW) * 0.5 - lC);
              vec2 edgeStep = (dirH >= dirV) ? vec2(uTexelSize.x * 0.65, 0.0) : vec2(0.0, uTexelSize.y * 0.65);
              vec3 edgeMix = (texture2D(tScene, clamp(uv + edgeStep, 0.001, 0.999)).rgb + texture2D(tScene, clamp(uv - edgeStep, 0.001, 0.999)).rgb) * 0.5;
              col = mix(col, edgeMix, aaMask * 0.45);
            }
            float rtShScale = mix(1.0, 0.72, uRayTracing) * (1.0 - aaMask * 0.55);
            if (uDlssMode > 0.5 || uEclipseMode > 0.5) {
              vec3 nNE = texture2D(tScene, uv + vec2(uTexelSize.x, uTexelSize.y)).rgb;
              vec3 nNW = texture2D(tScene, uv + vec2(-uTexelSize.x, uTexelSize.y)).rgb;
              vec3 nSE = texture2D(tScene, uv + vec2(uTexelSize.x, -uTexelSize.y)).rgb;
              vec3 nSW = texture2D(tScene, uv + vec2(-uTexelSize.x, -uTexelSize.y)).rgb;
              vec3 avg8 = (nN + nS + nE + nW + (nNE + nNW + nSE + nSW) * 0.65) / 6.6;
              vec3 mnC = min(col, min(min(nN, nS), min(nE, nW)));
              vec3 mxC = max(col, max(max(nN, nS), max(nE, nW)));
              float shDlss = uSharpness * (isUltraC ? 1.25 : 1.08) * rtShScale;
              col = clamp(col + clamp((col - avg8) * shDlss, -0.095, 0.095), mnC * 0.94, mxC * 1.06);
            } else {
              vec3 nb4 = (nN + nS + nE + nW) * 0.25;
              float shGain = uSharpness * (isUltraC ? 1.15 : 1.0) * rtShScale;
              col = clamp(col + clamp((col - nb4) * shGain, -0.075, 0.075), 0.0, 1.5);
            }
          }
        }
        // Subtle crisp Bloom, Atmospheric Golden Halo & Volumetric God-Rays
        float bloomBoost = max(uChillMode, max(uDlssMode * 0.72, uEclipseMode * 0.64));
        float bloomCalm = mix(0.68, 1.0, uEclipseMode);
        float bloomMix1 = mix(isUltraC ? 0.032 : 0.024, isUltraC ? 0.046 : 0.034, bloomBoost) * mix(1.0, 1.25, uRayTracing) * bloomCalm;
        float bloomMix2 = mix(isUltraC ? 0.014 : 0.008, isUltraC ? 0.022 : 0.014, bloomBoost) * mix(1.0, 1.30, uRayTracing) * bloomCalm;
        float hasBloom = step(0.5, max(uQuality, uRayTracing));
        col += (texture2D(tBloom, uv).rgb * bloomMix1 + texture2D(tBloomWide, uv).rgb * bloomMix2) * hasBloom;
        if (uUnderwater > 0.5) {
          float abyssT = clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0);
          float topGlow = smoothstep(0.35, 1.0, vUv.y) * exp(-uWaterDepth * 0.045);
          col += vec3(0.02, 0.11, 0.18) * topGlow;
          vec3 uwGrade = mix(vec3(0.84, 0.96, 1.05), vec3(0.44, 0.62, 0.84), abyssT);
          col *= uwGrade * mix(1.0, 0.54, abyssT * abyssT);
        }
        if (uHasGodRays > 0.5) {
          float rayGain = (uUnderwater > 0.5
            ? mix(0.65, 0.98, uEclipseMode)
            : mix(isUltraC ? 0.22 : 0.18, isUltraC ? 0.28 : 0.22, max(uChillMode, max(uDlssMode * 0.85, uEclipseMode * 0.85)))) * mix(1.0, 1.32, uRayTracing);
          col += texture2D(tGodRays, uv).rgb * rayGain;
        }
        if (uUnderwater < 0.5 && (uChillMode > 0.5 || uEclipseMode > 0.5) && uSunVis > 0.02) {
          float sunRad = exp(-length((uv - uLightScreen) * vec2(1.45, 1.0)) * mix(3.1, 2.7, uEclipseMode));
          col += vec3(1.0, 0.82, 0.56) * sunRad * clamp(uSunVis * 2.0, 0.0, 1.0) * mix(0.035, 0.055, uEclipseMode);
        }
        if (uRayTracing > 0.5 && uUnderwater < 0.5 && uInLava < 0.5) {
          float rtxLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col *= mix(vec3(0.90, 0.96, 1.09), vec3(1.10, 1.04, 0.94), smoothstep(0.16, 0.72, rtxLum));
        }

        // Authentic Merlin1809 Eclipse AgX Minimal + Purkinje + Vignette (zero yellow wash!) vs ACES grading
        float expUse = mix(uExposure, uExposure * 0.94, uUnderwater);
        if (uDimension > 2.5) expUse *= 0.90;
        if (uEclipseMode > 0.5 && uCartoonMode < 0.5) {
          vec3 linC = pow(max(col, vec3(1e-5)), vec3(2.2));
          if (uMoonBoost > 0.05 && uUnderwater < 0.5) {
            float lRod = dot(linC, vec3(0.2126, 0.7152, 0.0722));
            float purk = clamp((1.0 - smoothstep(0.015, 0.16, lRod)) * uMoonBoost * 0.35, 0.0, 0.40);
            linC = mix(linC, vec3(lRod) * vec3(0.4, 0.7, 1.0) * 1.15, purk);
          }
          vec3 agxOut = ToneMap_AgX_minimal_merlin(linC * expUse * 0.94);
          col = pow(max(agxOut, vec3(0.0)), vec3(1.0 / 2.2));
          if (uUnderwater < 0.5 && uDimension < 0.5) {
            float shL = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col += vec3(0.022, 0.021, 0.024) * (1.0 - smoothstep(0.0, 0.24, shL));
          }
          float ecLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          vec3 ecCoolSh = mix(vec3(0.90, 0.95, 1.05), vec3(1.0), smoothstep(0.06, 0.36, ecLum));
          col *= mix(ecCoolSh, vec3(1.0), uUnderwater * 0.75);
          vec3 ecWarmHi = vec3(1.0 + uWarmth * 0.14, 1.0 + uWarmth * 0.02, 1.0 - uWarmth * 0.16);
          float ecWarmMask = smoothstep(0.26, 0.80, ecLum) * (1.0 - uUnderwater * 0.85);
          col = mix(col, col * ecWarmHi, ecWarmMask);
          vec3 ecCurve = col * col * (3.0 - 2.0 * col);
          col = mix(col, ecCurve, uContrast * (1.0 - uUnderwater * 0.45));
          float maxEc = max(col.r, max(col.g, col.b)), minEc = min(col.r, min(col.g, col.b));
          float lumEc = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(lumEc), col, 1.0 + uVibrance * (1.0 - (maxEc - minEc) * 0.70));
          float ignV = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float uwVig = uUnderwater > 0.5 ? (1.0 - dot(vUv - 0.5, vUv - 0.5) * mix(0.22, 0.45, clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0))) : 1.0;
          col *= eclipseVignette(vUv, ignV) * uwVig;
        } else {
          vec3 linR = pow(max(col, vec3(1e-5)), vec3(2.2));
          vec3 agxReg = ToneMap_AgX_minimal_merlin(linR * expUse * 0.94);
          col = pow(max(agxReg, vec3(0.0)), vec3(1.0 / 2.2));
          if (uUnderwater < 0.5 && uDimension < 0.5 && uCartoonMode < 0.5) {
            float shL2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col += vec3(0.022, 0.021, 0.024) * (1.0 - smoothstep(0.0, 0.24, shL2));
          }
          float hiLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float hiDesat = smoothstep(0.68, 0.98, hiLum) * 0.08 * (1.0 - uUnderwater);
          col = mix(col, vec3(hiLum) * vec3(1.01, 0.99, 0.96), hiDesat);
          if (uCartoonMode < 0.5) {
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
            vec3 baseCool = mix(vec3(0.90, 0.95, 1.05), vec3(0.86, 0.92, 1.06), uMoonBoost * 0.72);
            vec3 coolShadows = mix(baseCool, vec3(0.88, 0.93, 1.06), uChillMode * (1.0 - uUnderwater));
            coolShadows = mix(coolShadows, vec3(0.90, 0.95, 1.05), uDlssMode * (1.0 - uUnderwater) * 0.72);
            if (uDimension > 3.5) coolShadows = vec3(0.76, 0.96, 1.04);
            else if (uDimension > 2.5) coolShadows = vec3(0.88, 0.89, 1.01);
            else if (uDimension > 1.5) coolShadows = vec3(0.96, 0.88, 1.08);
            else if (uDimension > 0.5) coolShadows = vec3(1.03, 0.90, 0.86);
            col = mix(col * coolShadows, col, smoothstep(0.06, 0.36, lum));
            vec3 warmHigh = vec3(1.0 + uWarmth * 0.14, 1.0 + uWarmth * 0.02, 1.0 - uWarmth * 0.16);
            if (uDimension > 3.5) warmHigh = vec3(0.92, 1.04, 1.08);
            else if (uDimension > 2.5) warmHigh = vec3(1.05, 0.97, 0.99);
            else if (uDimension > 1.5) warmHigh = vec3(1.06, 0.95, 1.12);
            float warmMask = smoothstep(0.24, 0.82, lum) * (1.0 - smoothstep(0.84, 0.98, lum) * 0.55);
            col = mix(col, col * warmHigh, warmMask * (1.0 - uUnderwater * 0.88));
            vec3 sCurve = col * col * (3.0 - 2.0 * col);
            col = mix(col, sCurve, uContrast * (1.0 - uUnderwater * 0.45));
            float maxCh = max(col.r, max(col.g, col.b));
            float minCh = min(col.r, min(col.g, col.b));
            float satBoost = uVibrance * (1.0 - (maxCh - minCh) * 0.70);
            float lumaV = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col = mix(vec3(lumaV), col, 1.0 + satBoost);
            float vigAmt = uUnderwater > 0.5 ? mix(0.22, 0.48, clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0)) : mix(0.06, 0.10, uChillMode);
            float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * vigAmt;
            col *= vig;
          }
        }
        if (uInLava > 0.5) {
          col = mix(col, vec3(0.62, 0.14, 0.02), 0.20);
        }
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`
  });
  const postQuad = new THREE.Mesh(postQuadGeo, brightMat);
  postScene.add(postQuad);

  // Weather Particles (Rain / Snow / Blizzard / Sandstorm single draw call)
  const WEATHER_CNT = 620;
  const weatherPositions = new Float32Array(WEATHER_CNT * 6);
  const weatherOffsets = Array.from({ length: WEATHER_CNT }, () => ({
    x: (Math.random() - 0.5) * 28, y: Math.random() * 20, z: (Math.random() - 0.5) * 28, sp: 14 + Math.random() * 6
  }));
  const weatherGeo = new THREE.BufferGeometry();
  weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));
  const weatherMat = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45 });
  const weatherLines = new THREE.LineSegments(weatherGeo, weatherMat);
  weatherLines.frustumCulled = false; weatherLines.visible = false; scene.add(weatherLines);

  const highlightMesh = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.78 })
  );
  highlightMesh.visible = false; scene.add(highlightMesh);

  const crackTextures = [];
  for (let stage = 0; stage < 5; stage++) {
    const cc = document.createElement('canvas'); cc.width = 32; cc.height = 32;
    const cctx = cc.getContext('2d'); cctx.strokeStyle = 'rgba(0,0,0,0.85)'; cctx.lineWidth = 1.8;
    for (let i = 0; i < 3 + stage * 3; i++) {
      const ang = (i / (3 + stage * 3)) * Math.PI * 2 + stage * 0.4, len = 5 + stage * 3.2;
      cctx.beginPath(); cctx.moveTo(16, 16);
      cctx.lineTo(16 + Math.cos(ang) * len * 0.5, 16 + Math.sin(ang) * len * 0.5);
      cctx.lineTo(16 + Math.cos(ang + 0.28) * len, 16 + Math.sin(ang + 0.28) * len); cctx.stroke();
    }
    const ct = new THREE.CanvasTexture(cc); ct.magFilter = THREE.NearestFilter; crackTextures.push(ct);
  }
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTextures[0], transparent: true, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2 });
  const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), crackMat);
  crackMesh.visible = false; scene.add(crackMesh);

  // Item-Only 3D First-Person Viewmodel (Crisp 16x16 Voxel Items & Bump-Mapped Blocks!)
  const heldPivot = new THREE.Group();
  heldPivot.position.set(0.44, -0.34, -0.60);
  camera.add(heldPivot);
  const vmWeaponMount = new THREE.Group();
  vmWeaponMount.rotation.order = 'YXZ';
  heldPivot.add(vmWeaponMount);
  const offhandPivot = new THREE.Group();
  offhandPivot.position.set(-0.46, -0.36, -0.62);
  camera.add(offhandPivot);
  const heldModelCache = new Map();
  const offhandModelCache = new Map();
  let activeHeldObj = null;
  let activeOffhandObj = null;

  function _makeFirstPersonArmGroup(pxScale) {
    const g = new THREE.Group();
    const sk = (typeof getSkinDef === 'function' && typeof selectedSkinId === 'string') ? getSkinDef(selectedSkinId) : { slim: true };
    const isSlim = (typeof isSkinSlim === 'function') ? isSkinSlim(selectedSkinId) : !!sk.slim;
    const tex = (typeof getSkinTexture === 'function') ? getSkinTexture(selectedSkinId) : null;
    const wPx = isSlim ? 3 : 4;
    const armMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02, alphaTest: 0.1 });
    const sleeveMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const armMesh = makeSkinBox(wPx, 12, 4, 40, 16, armMat, pxScale, 0);
    const sleeveMesh = makeSkinBox(wPx, 12, 4, 40, 32, sleeveMat, pxScale, 0.0025);
    // +Y is shoulder/sleeve, -Y is fist/fingers; shifting +6px places fist right at local origin (0,0,0)
    const halfY = 5.65 * pxScale;
    armMesh.position.set(0, halfY, 0);
    sleeveMesh.position.set(0, halfY, 0);
    g.add(armMesh, sleeveMesh);
    g.rotation.order = 'YXZ';
    return g;
  }

  function buildToolArmMesh() {
    return _makeFirstPersonArmGroup(0.034);
  }

  function buildEmptyHandMesh() {
    const g = _makeFirstPersonArmGroup(0.035);
    g.position.set(0.05, -0.09, 0.05);
    g.rotation.set(1.86, -0.36, 0.14);
    return g;
  }

  let _bedAssets = null;
  function getBedHeldSharedAssets(THREE) {
    if (_bedAssets) return _bedAssets;
    const mkTex = (drawFn) => {
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      const ctx = cv.getContext('2d');
      drawFn(ctx);
      const t = new THREE.CanvasTexture(cv);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      return t;
    };
    const h = (x, y, s) => {
      let n = ((x * 374761393 + y * 668265263 + s * 1442695041) | 0);
      n = ((n ^ (n >>> 13)) * 1274126177) | 0;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const shadePx = (hex, d) => {
      const c = (v) => Math.max(0, Math.min(255, v | 0));
      return `rgb(${c(((hex >> 16) & 255) + d)},${c(((hex >> 8) & 255) + d)},${c((hex & 255) + d)})`;
    };
    const oakTex = mkTex((c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const seam = (y % 4 === 0) ? -22 : ((x + (y >> 2) * 5) % 8 === 0 ? -10 : 0);
        c.fillStyle = shadePx(0xb07e46, seam + (h(x, y, 1) - 0.5) * 18);
        c.fillRect(x, y, 1, 1);
      }
    });
    const legTex = mkTex((c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const edge = (x === 0 || x === 15 || y === 15) ? -18 : 0;
        c.fillStyle = shadePx(0x8a5b2c, edge + (h(x, y, 2) - 0.5) * 16);
        c.fillRect(x, y, 1, 1);
      }
    });
    const redTex = mkTex((c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const border = (x === 0 || x === 15 || y === 0 || y === 15) ? -28 : ((y === 4 || y === 10) ? -14 : 0);
        const weave = ((x + y) & 1) ? 5 : -5;
        c.fillStyle = shadePx(0xd62424, border + weave + (h(x, y, 3) - 0.5) * 14);
        c.fillRect(x, y, 1, 1);
      }
    });
    const pillowTex = mkTex((c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const b = (x === 0 || x === 15 || y === 0 || y === 15) ? -34 : ((x === 1 || x === 14 || y === 1 || y === 14) ? -14 : 0);
        c.fillStyle = shadePx(0xf8fafc, b + (h(x, y, 4) - 0.5) * 8);
        c.fillRect(x, y, 1, 1);
      }
    });
    const mkGeo = (w, hh, d) => {
      const g = new THREE.BoxGeometry(w, hh, d);
      g.userData.sharedGeo = true;
      return g;
    };
    _bedAssets = {
      geos: {
        frame:   mkGeo(0.26,  0.048, 0.50),
        leg:     mkGeo(0.052, 0.088, 0.052),
        headBar: mkGeo(0.264, 0.054, 0.024),
        blanket: mkGeo(0.268, 0.090, 0.345),
        fold:    mkGeo(0.272, 0.018, 0.036),
        pillow:  mkGeo(0.266, 0.098, 0.155),
        crown:   mkGeo(0.205, 0.020, 0.105)
      },
      mats: {
        oak:    new THREE.MeshStandardMaterial({ map: oakTex,    roughness: 0.80 }),
        leg:    new THREE.MeshStandardMaterial({ map: legTex,    roughness: 0.82 }),
        red:    new THREE.MeshStandardMaterial({ map: redTex,    roughness: 0.86 }),
        fold:   new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.84 }),
        pillow: new THREE.MeshStandardMaterial({ map: pillowTex, roughness: 0.82 })
      }
    };
    return _bedAssets;
  }

  function getBedHeldBlanketMats(THREE, hexInt = 0xd62424, lightHexInt = 0xf1f5f9) {
    const A = getBedHeldSharedAssets(THREE);
    if (!A.blanketCache) A.blanketCache = new Map();
    const k = `${hexInt}|${lightHexInt}`;
    if (A.blanketCache.has(k)) return A.blanketCache.get(k);
    if (hexInt === 0xd62424) {
      const pair = { main: A.mats.red, fold: A.mats.fold };
      A.blanketCache.set(k, pair);
      return pair;
    }
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const ctx = cv.getContext('2d');
    const c = (v) => Math.max(0, Math.min(255, v | 0));
    const shadePx = (hex, d) => `rgb(${c(((hex >> 16) & 255) + d)},${c(((hex >> 8) & 255) + d)},${c((hex & 255) + d)})`;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let n = ((x * 374761393 + y * 668265263 + 432695041) | 0);
      n = ((n ^ (n >>> 13)) * 1274126177) | 0;
      const r = ((n ^ (n >>> 16)) >>> 0) / 4294967295;
      const border = (x === 0 || x === 15 || y === 0 || y === 15) ? -28 : ((y === 4 || y === 10) ? -14 : 0);
      const weave = ((x + y) & 1) ? 5 : -5;
      ctx.fillStyle = shadePx(hexInt, border + weave + (r - 0.5) * 14);
      ctx.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    const pair = {
      main: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86 }),
      fold: new THREE.MeshStandardMaterial({ color: lightHexInt, roughness: 0.84 })
    };
    A.blanketCache.set(k, pair);
    return pair;
  }

  function buildHeldBedMesh(THREE, blockId = B.BED) {
    const A = getBedHeldSharedAssets(THREE);
    const bDef = BLOCK_DEF[blockId];
    const hexInt = bDef && bDef.bedHex ? parseInt(bDef.bedHex.slice(1), 16) : 0xd62424;
    const lightInt = bDef && bDef.bedLightHex ? parseInt(bDef.bedLightHex.slice(1), 16) : 0xf1f5f9;
    const bm = getBedHeldBlanketMats(THREE, hexInt, lightInt);
    const g = new THREE.Group();
    const addPart = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.userData.sharedGeo = true;
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    addPart(A.geos.frame,   A.mats.oak, 0, -0.042, 0);
    addPart(A.geos.headBar, A.mats.leg, 0, -0.018, -0.244);
    addPart(A.geos.leg, A.mats.leg, -0.104, -0.104, -0.224);
    addPart(A.geos.leg, A.mats.leg,  0.104, -0.104, -0.224);
    addPart(A.geos.leg, A.mats.leg, -0.104, -0.104,  0.224);
    addPart(A.geos.leg, A.mats.leg,  0.104, -0.104,  0.224);
    addPart(A.geos.blanket, bm.main, 0, 0.024,  0.078);
    addPart(A.geos.fold,    bm.fold, 0, 0.070, -0.078);
    addPart(A.geos.pillow, A.mats.pillow, 0, 0.028, -0.172);
    addPart(A.geos.crown,  A.mats.pillow, 0, 0.082, -0.172);
    g.rotation.order = 'YXZ';
    g.position.set(0.01, 0.04, -0.06);
    g.rotation.set(0.42, -0.66, 0.14);
    g.userData.iconReady = true;
    return g;
  }

  function build3DHeldArmorMesh(slot, tier, trim = null) {
    const pal = ARMOR_TIER_PAL[tier] || ARMOR_TIER_PAL.iron;
    const tex = getArmorTexture(tier, trim);
    const isLeather = tier === 'leather';
    const isRainbow = !!pal.rainbow;
    const tr = resolveTrimColors(tier, trim);
    const armorMat = new THREE.MeshStandardMaterial({
      map: tex, color: 0xffffff, roughness: pal.rough, metalness: pal.metal,
      transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const relMap = isRainbow ? getDreamWaterSwatchTex(pal.waterSeed || 0) : null;
    const relMat = new THREE.MeshStandardMaterial({
      map: relMap,
      color: isRainbow ? 0xffffff : pal.hex,
      roughness: isLeather ? 0.80 : Math.max(0.18, pal.rough - 0.06),
      metalness: isLeather ? 0.05 : Math.min(0.88, pal.metal + 0.18),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const accMat = new THREE.MeshStandardMaterial({
      map: (isRainbow && !tr) ? relMap : null,
      color: tr ? tr.hexInt : (isRainbow ? 0xffffff : (pal.trim || pal.hex)),
      roughness: isLeather && !tr ? 0.78 : Math.max(0.16, pal.rough - 0.08),
      metalness: isLeather && !tr ? 0.05 : Math.min(0.90, pal.metal + 0.22),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    if (isRainbow) {
      armorMat.userData = { isRainbowArmor: true };
      relMat.userData   = { isRainbowArmor: true, isArmorRelief: true };
      _rainbowMats.add(armorMat); _rainbowMats.add(relMat);
      applyRainbowToMat(armorMat, _dreamRainbowHue);
      applyRainbowToMat(relMat,   _dreamRainbowHue);
      if (!tr) {
        accMat.userData = { isRainbowArmor: true, isArmorRelief: true, isRainbowAccent: true };
        _rainbowMats.add(accMat);
        applyRainbowToMat(accMat, _dreamRainbowHue);
      } else {
        accMat.emissive.setHex(tr.hexInt); accMat.emissiveIntensity = 0.22;
      }
    } else {
      const eInt = pal.emit !== undefined ? pal.emit : (isLeather ? 0.02 : (tier === 'diamond' ? 0.14 : 0.09));
      armorMat.emissive.setHex(pal.hex); armorMat.emissiveIntensity = eInt;
      relMat.emissive.setHex(pal.hex);   relMat.emissiveIntensity = eInt;
      accMat.emissive.setHex(tr ? tr.hexInt : pal.hex); accMat.emissiveIntensity = tr ? 0.20 : eInt;
    }
    const g = new THREE.Group();
    const mkRel = (w, h, d, x, y, z, isAcc = false) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), isAcc ? accMat : relMat);
      m.position.set(x, y, z); g.add(m); return m;
    };
    if (slot === 'helmet') {
      const sc = 0.038;
      g.add(makeSkinBox(8, 8, 8, 0, 0, armorMat, sc, 0.008));
      mkRel(0.31, 0.044, 0.040, 0, 0.075, 0.152, false);
      mkRel(0.316, 0.022, 0.046, 0, 0.077, 0.155, true);
      mkRel(0.038, 0.068, 0.036, 0, 0.038, 0.155, false);
      mkRel(0.048, 0.042, 0.30, 0, 0.166, 0.0, false);
      g.position.set(0.0, -0.02, -0.05); g.rotation.set(0.14, -0.45, 0.06);
    } else if (slot === 'chest') {
      const sc = 0.028;
      g.add(makeSkinBox(8, 12, 4, 16, 16, armorMat, sc, 0.008));
      const pL = makeSkinBoxPart(4, 6, 4, 40, 16, 0, armorMat, sc, 0.006); pL.position.set(-0.175, 0.095, 0);
      const pR = makeSkinBoxPart(4, 6, 4, 40, 16, 0, armorMat, sc, 0.006); pR.position.set(0.175, 0.095, 0);
      g.add(pL, pR);
      mkRel(0.19, 0.14, 0.028, 0, 0.05,  0.064, false);
      mkRel(0.18, 0.12, 0.024, 0, 0.05, -0.062, false);
      mkRel(0.24, 0.042, 0.135, 0, -0.105, 0, false);
      mkRel(0.244, 0.020, 0.140, 0, -0.105, 0, true);
      mkRel(0.048, 0.044, 0.028, 0, -0.105, 0.072, true);
      mkRel(0.14, 0.040, 0.142, -0.18, 0.170, 0, false);
      mkRel(0.14, 0.040, 0.142,  0.18, 0.170, 0, false);
      mkRel(0.135, 0.024, 0.140, -0.18, 0.185, 0, true);
      mkRel(0.135, 0.024, 0.140,  0.18, 0.185, 0, true);
      g.position.set(0.0, -0.02, -0.05); g.rotation.set(0.12, -0.42, 0.04);
    } else if (slot === 'legs') {
      const sc = 0.030;
      const wBox = makeSkinBox(8, 4, 4, 16, 48, armorMat, sc, 0.006); wBox.position.set(0, 0.13, 0);
      const lL = makeSkinBox(4, 12, 4, 0, 32, armorMat, sc, 0.006); lL.position.set(-0.065, -0.035, 0);
      const lR = makeSkinBox(4, 12, 4, 0, 32, armorMat, sc, 0.006); lR.position.set( 0.065, -0.035, 0);
      g.add(wBox, lL, lR);
      mkRel(0.10, 0.042, 0.028, -0.065, -0.015, 0.070, true);
      mkRel(0.10, 0.042, 0.028,  0.065, -0.015, 0.070, true);
      mkRel(0.048, 0.038, 0.024, 0, 0.13, 0.070, true);
      g.position.set(0.0, -0.01, -0.05); g.rotation.set(0.14, -0.42, 0.05);
    } else {
      const sc = 0.036;
      const bL = makeSkinBoxPart(4, 6, 4, 0, 48, 6, armorMat, sc, 0.007); bL.position.set(-0.095, -0.04, 0.02);
      const bR = makeSkinBoxPart(4, 6, 4, 0, 48, 6, armorMat, sc, 0.007); bR.position.set( 0.095, -0.04, -0.02);
      g.add(bL, bR);
      mkRel(0.172, 0.034, 0.172, -0.095,  0.06,  0.02, false);
      mkRel(0.172, 0.034, 0.172,  0.095,  0.06, -0.02, false);
      mkRel(0.150, 0.040, 0.048, -0.095, -0.105,  0.092, true);
      mkRel(0.150, 0.040, 0.048,  0.095, -0.105,  0.052, true);
      g.position.set(0.0, -0.03, -0.05); g.rotation.set(0.16, -0.46, 0.06);
    }
    g.userData.iconReady = true;
    return g;
  }

  let _mcShieldTexPair = null;
  function getMinecraftShieldTextures() {
    if (_mcShieldTexPair) return _mcShieldTexPair;
    const mkFaceTex = (isBack = false) => {
      const cw = 24, ch = 44;
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const ctx = cv.getContext('2d');
      // 1) Vertical Oak Wood Planks Interior (x: 3..20, y: 3..40)
      const boardColors = ['#7c562c', '#6e4a23', '#886032', '#64421f', '#775329'];
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const isRim = (x < 3 || x >= cw - 3 || y < 3 || y >= ch - 3);
          if (isRim) {
            const outer = (x === 0 || x === cw - 1 || y === 0 || y === ch - 1);
            const innerBevel = (x === 2 || x === cw - 3 || y === 2 || y === ch - 3);
            let col = outer ? '#7e858f' : (innerBevel ? '#5e646e' : '#939aa4');
            if ((x + y) % 5 === 0) col = outer ? '#6f7680' : '#7b828c';
            ctx.fillStyle = col;
            ctx.fillRect(x, y, 1, 1);
          } else {
            const bx = x - 3;
            const plankIdx = Math.min(4, Math.floor(bx / 3.6));
            const seam = (bx === 3 || bx === 7 || bx === 10 || bx === 14);
            let col = boardColors[plankIdx];
            if (seam) col = '#4f3518';
            else if (((x * 13 + y * 29) & 7) === 0) col = '#916838';
            else if (((x * 7 + y * 19) & 7) === 1) col = '#5a3b1b';
            ctx.fillStyle = col;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      // 2) Interior vs Exterior detail: rivets on front face only; clean grip mounting strap on inner wooden planks!
      if (!isBack) {
        const rivetY = [7, 16, 25, 34];
        const rivetX = [5, 17];
        for (const ry of rivetY) {
          for (const rx of rivetX) {
            ctx.fillStyle = '#6f7782'; ctx.fillRect(rx, ry, 2, 2);
            ctx.fillStyle = '#9aa2ad'; ctx.fillRect(rx, ry, 1, 1);
            ctx.fillStyle = '#3d2812'; ctx.fillRect(rx, ry + 2, 2, 1);
          }
        }
      } else {
        // Inner vertical iron brace down center planks behind handle (Minecraft interior wood look)
        ctx.fillStyle = '#5a6069'; ctx.fillRect(10, 14, 4, 16);
        ctx.fillStyle = '#7b828c'; ctx.fillRect(11, 15, 2, 14);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      return tex;
    };
    const edgeCv = document.createElement('canvas'); edgeCv.width = 4; edgeCv.height = 16;
    const eCtx = edgeCv.getContext('2d');
    for (let y = 0; y < 16; y++) {
      eCtx.fillStyle = (y % 4 === 0) ? '#6f757f' : '#858c96';
      eCtx.fillRect(0, y, 4, 1);
    }
    const edgeTex = new THREE.CanvasTexture(edgeCv);
    edgeTex.magFilter = THREE.NearestFilter;
    edgeTex.minFilter = THREE.NearestFilter;
    edgeTex.generateMipmaps = false;
    edgeTex.needsUpdate = true;
    _mcShieldTexPair = { frontTex: mkFaceTex(false), backTex: mkFaceTex(true), edgeTex };
    return _mcShieldTexPair;
  }

  function build3DShieldMesh(forThirdPerson = false) {
    const g = new THREE.Group();
    const { frontTex, backTex, edgeTex } = getMinecraftShieldTextures();
    const w = forThirdPerson ? 0.50 : 0.44;
    const h = forThirdPerson ? 0.88 : 0.78;
    const d = forThirdPerson ? 0.056 : 0.046;
    const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.72, metalness: 0.14 });
    const backMat  = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.76, metalness: 0.12 });
    const edgeMat  = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.44, metalness: 0.35 });
    // In 1st-person (!forThirdPerson), camera looks down -Z: interior backMat faces +Z (player) & exterior frontMat faces -Z (enemies)!
    // In 3rd-person (forThirdPerson), avatar rig faces +Z: exterior frontMat stays on +Z and interior/handle on -Z!
    const mats = forThirdPerson
      ? [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat]
      : [edgeMat, edgeMat, edgeMat, edgeMat, backMat, frontMat];
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    plate.castShadow = forThirdPerson;
    plate.receiveShadow = true;
    g.add(plate);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x4b3b2c, roughness: 0.78, metalness: 0.12 });
    if (forThirdPerson) {
      const handleD = d * 2.05;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.19, h * 0.28, handleD), handleMat);
      handle.position.set(0, 0, -(d * 0.5 + handleD * 0.5));
      g.add(handle);
    } else {
      const fpHandleD = d * 1.15;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.20, h * 0.26, fpHandleD), handleMat);
      handle.position.set(0, -0.02, +(d * 0.5 + fpHandleD * 0.45));
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.35 });
      const topBand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, 0.028, fpHandleD * 0.45), strapMat);
      topBand.position.set(0, -0.02 + h * 0.12, +(d * 0.5 + fpHandleD * 0.22));
      const botBand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, 0.028, fpHandleD * 0.45), strapMat);
      botBand.position.set(0, -0.02 - h * 0.12, +(d * 0.5 + fpHandleD * 0.22));
      g.add(handle, topBand, botBand);
    }
    return g;
  }

  let _heldAtlasMat = null;
  function _getHeldAtlasMat() {
    if (!_heldAtlasMat) {
      _heldAtlasMat = new THREE.MeshStandardMaterial({
        map: typeof atlasTex !== 'undefined' ? atlasTex : null,
        bumpMap: typeof bumpTex !== 'undefined' ? bumpTex : null,
        bumpScale: 0.03,
        roughness: 0.8
      });
    }
    return _heldAtlasMat;
  }

  /** Build a BoxGeometry mesh mapped cleanly to 3 atlas tiles [top, side, bottom]. */
  function build3DDragonHeadMesh(scale = 1.0) {
    const g = new THREE.Group();
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1a1721, roughness: 0.68, metalness: 0.16 });
    const mScale = new THREE.MeshStandardMaterial({ color: 0x2d2738, roughness: 0.58, metalness: 0.20 });
    const mHorn = new THREE.MeshStandardMaterial({ color: 0x453e52, roughness: 0.52, metalness: 0.24 });
    const mEye = new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xd946ef, emissiveIntensity: 1.35, roughness: 0.18 });
    const add = (w, h, d, x, y, z, mat, parent = g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    // Skull cranium + ridged cheeks
    add(0.68, 0.56, 0.72, 0, 0.28, -0.02, mDark);
    add(0.72, 0.20, 0.50, 0, 0.30, -0.04, mScale);
    // Snout upper + protruding dark nostrils
    add(0.46, 0.24, 0.44, 0, 0.26, 0.48, mScale);
    add(0.11, 0.09, 0.11, -0.13, 0.39, 0.58, mHorn);
    add(0.11, 0.09, 0.11,  0.13, 0.39, 0.58, mHorn);
    // Glowing violet dragon eyes
    add(0.14, 0.11, 0.16, -0.27, 0.34, 0.26, mEye);
    add(0.14, 0.11, 0.16,  0.27, 0.34, 0.26, mEye);
    // Swept back horns & ear crests
    add(0.11, 0.16, 0.36, -0.22, 0.58, -0.20, mHorn);
    add(0.11, 0.16, 0.36,  0.22, 0.58, -0.20, mHorn);
    add(0.08, 0.11, 0.22, -0.34, 0.44, -0.18, mScale);
    add(0.08, 0.11, 0.22,  0.34, 0.44, -0.18, mScale);
    // Articulated lower jaw (pivots around mouth hinge for redstone/idle chomp)
    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, 0.14, 0.26);
    add(0.42, 0.11, 0.40, 0, -0.04, 0.20, mDark, jawPivot);
    g.add(jawPivot);
    g.userData.jawPivot = jawPivot;
    if (scale !== 1.0) g.scale.setScalar(scale);
    return g;
  }

  let _windmillIronMat = null, _windmillSailMat = null;
  function build3DWindmillRotorMesh(scale = 1.0) {
    if (!_windmillIronMat) {
      _windmillIronMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.44, metalness: 0.65 });
      _windmillSailMat = new THREE.MeshStandardMaterial({ color: 0xf6f1e3, roughness: 0.88, metalness: 0.02 });
    }
    const g = new THREE.Group();
    const axle = _makeAtlasBox(0.92, 0.92, 1.12, 4, 12, 4);
    const frontCap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.36), _windmillIronMat);
    frontCap.position.set(0, 0, 0.62);
    g.add(axle, frontCap);

    const rotorPivot = new THREE.Group();
    rotorPivot.position.set(0, 0, 0.66);
    g.add(rotorPivot);

    for (let a = 0; a < 4; a++) {
      const arm = new THREE.Group();
      arm.rotation.z = a * (Math.PI * 0.5);
      const spar = _makeAtlasBox(0.26, 7.1, 0.26, 4, 12, 4);
      spar.position.set(0, 3.9, 0);
      spar.castShadow = true;
      arm.add(spar);

      for (const ry of [1.8, 3.1, 4.4, 5.7, 7.0]) {
        const bar = _makeAtlasBox(1.85, 0.16, 0.16, 8, 8, 8);
        bar.position.set(0.82, ry, -0.02);
        bar.castShadow = true;
        arm.add(bar);
      }

      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.62, 5.45, 0.12), _windmillSailMat);
      sail.position.set(0.86, 4.55, 0.06);
      sail.rotation.y = 0.14;
      sail.castShadow = true;
      sail.receiveShadow = true;

      const edgeTrim = _makeAtlasBox(0.14, 5.55, 0.18, 8, 8, 8);
      edgeTrim.position.set(1.70, 4.55, 0.02);
      arm.add(sail, edgeTrim);
      rotorPivot.add(arm);
    }

    g.userData.rotorPivot = rotorPivot;
    if (scale !== 1.0) g.scale.setScalar(scale);
    return g;
  }

  function _makeAtlasBox(w, h, d, tTop, tSide, tBot) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uvAttr = geo.attributes && geo.attributes.uv;
    if (uvAttr) {
      const uStep = 1 / ATLAS_COLS, vStep = 1 / ATLAS_ROWS;
      const ft = [tSide, tSide, tTop, tBot, tSide, tSide];
      for (let f = 0; f < 6; f++) {
        const tile = ft[f], tx = tile % ATLAS_COLS, ty = Math.floor(tile / ATLAS_COLS);
        const u0 = tx * uStep + 0.002, u1 = (tx + 1) * uStep - 0.002;
        const v0 = ty * vStep + 0.002, v1 = (ty + 1) * vStep - 0.002;
        const base = f * 4;
        uvAttr.setXY(base, u0, v0); uvAttr.setXY(base + 1, u1, v0);
        uvAttr.setXY(base + 2, u0, v1); uvAttr.setXY(base + 3, u1, v1);
      }
      uvAttr.needsUpdate = true;
    }
    return new THREE.Mesh(geo, _getHeldAtlasMat());
  }

  let _bucketSharedMats = null;
  function build3DBucketMesh(kind = 'empty') {
    if (!_bucketSharedMats) {
      _bucketSharedMats = {
        ironLight: new THREE.MeshStandardMaterial({ color: 0xdbe4ef, roughness: 0.34, metalness: 0.68 }),
        ironMid:   new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.38, metalness: 0.64 }),
        ironDark:  new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.44, metalness: 0.62 }),
        cavity:    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.35 }),
        handle:    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.40, metalness: 0.65 }),
        waterMain: new THREE.MeshStandardMaterial({ color: 0x2299ee, emissive: 0x0284c7, emissiveIntensity: 0.32, roughness: 0.12, metalness: 0.10, transparent: true, opacity: 0.90 }),
        waterHi:   new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.48, roughness: 0.08, transparent: true, opacity: 0.92 }),
        lavaMain:  new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xea580c, emissiveIntensity: 1.25, roughness: 0.22 }),
        lavaCore:  new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.65, roughness: 0.14 }),
        lavaCrust: new THREE.MeshStandardMaterial({ color: 0x9a3412, emissive: 0x7c2d12, emissiveIntensity: 0.55, roughness: 0.48 })
      };
    }
    const M = _bucketSharedMats;
    const g = new THREE.Group();
    const addB = (w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx || ry || rz) m.rotation.set(rx, ry, rz);
      g.add(m);
      return m;
    };
    // 1) Tapered 3D Iron Bucket Base & Stepped Lower Hull
    addB(0.165, 0.026, 0.165, 0, -0.112, 0, M.ironDark);
    addB(0.188, 0.055, 0.188, 0, -0.074, 0, M.ironMid);
    addB(0.194, 0.018, 0.194, 0, -0.088, 0, M.ironDark); // bottom iron hoop band
    // 2) Upper Hollow 3D Bucket Walls (4 main plates + 4 bevel corner pillars + dark inner floor)
    addB(0.172, 0.020, 0.172, 0, -0.042, 0, M.cavity);
    addB(0.190, 0.135, 0.028, 0,  0.020,  0.102, M.ironLight); // front wall
    addB(0.190, 0.135, 0.028, 0,  0.020, -0.102, M.ironMid);   // back wall
    addB(0.028, 0.135, 0.190, -0.102, 0.020, 0,  M.ironLight); // left wall
    addB(0.028, 0.135, 0.190,  0.102, 0.020, 0,  M.ironMid);   // right wall
    for (const sx of [-0.088, 0.088]) for (const sz of [-0.088, 0.088]) {
      addB(0.036, 0.135, 0.036, sx, 0.020, sz, M.ironDark);
    }
    // 3) Top Flared Iron Rim & Riveted Side Ears + 3D Arched Wire Bail Handle
    addB(0.236, 0.028, 0.034, 0,  0.096,  0.108, M.ironDark);
    addB(0.236, 0.028, 0.034, 0,  0.096, -0.108, M.ironDark);
    addB(0.034, 0.028, 0.236, -0.108, 0.096, 0,  M.ironDark);
    addB(0.034, 0.028, 0.236,  0.108, 0.096, 0,  M.ironDark);
    addB(0.026, 0.044, 0.044, -0.128, 0.092, 0,  M.ironDark); // left lug ear
    addB(0.026, 0.044, 0.044,  0.128, 0.092, 0,  M.ironDark); // right lug ear
    // Arched 3D wire bail handle (tilted slightly forward for 3D depth)
    const bail = new THREE.Group();
    bail.position.set(0, 0.095, 0);
    bail.rotation.x = 0.26;
    const mkBail = (w, h, d, x, y, z) => {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.handle);
      bm.position.set(x, y, z); bail.add(bm);
    };
    mkBail(0.018, 0.095, 0.018, -0.126, 0.045, 0);
    mkBail(0.018, 0.095, 0.018,  0.126, 0.045, 0);
    mkBail(0.268, 0.020, 0.020,  0.0,   0.095, 0);
    mkBail(0.110, 0.028, 0.028,  0.0,   0.095, 0); // center wooden/steel hand grip
    g.add(bail);
    // 4) 3D Volumetric Liquid Fill for Water Bucket & Lava Bucket
    if (kind === 'water') {
      addB(0.184, 0.115, 0.184, 0, 0.025, 0, M.waterMain);
      addB(0.075, 0.014, 0.045, -0.032, 0.084, 0.025, M.waterHi);
      addB(0.055, 0.014, 0.036,  0.038, 0.084, -0.028, M.waterHi);
    } else if (kind === 'lava') {
      addB(0.184, 0.118, 0.184, 0, 0.026, 0, M.lavaMain);
      addB(0.092, 0.016, 0.068, -0.018, 0.086,  0.014, M.lavaCore);
      addB(0.054, 0.016, 0.052,  0.042, 0.086, -0.032, M.lavaCore);
      addB(0.064, 0.014, 0.054, -0.046, 0.085, -0.038, M.lavaCrust);
      addB(0.052, 0.014, 0.048,  0.044, 0.085,  0.042, M.lavaCrust);
    }
    g.rotation.order = 'YXZ';
    g.position.set(0.01, -0.01, -0.05);
    g.rotation.set(0.22, -0.52, 0.06);
    g.userData.iconReady = true;
    return g;
  }

  let _endCrystalSharedMats = null;
  function _getEndCrystalMats() {
    if (_endCrystalSharedMats) return _endCrystalSharedMats;
    const mkTex = (drawFn) => {
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      drawFn(ctx, (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); });
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false; tex.needsUpdate = true;
      return tex;
    };
    // 1) 16x16 Pixelated Bedrock Base Plate texture (matches uploaded Image 3!)
    const baseTex = mkTex((ctx, put) => {
      const cols = ['#111827', '#1f2937', '#374151', '#4b5563', '#030712'];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const h = (((x * 73 + y * 151) ^ (x * 19 + y * 31)) >>> 0) % 5;
        put(x, y, (x === 0 || x === 15 || y === 0 || y === 15) ? '#0f172a' : cols[h]);
      }
    });
    // 2) 16x16 Pixelated Minecraft End Crystal Notched Glass Frame Cage texture (matches uploaded Images 2 & 3!)
    const cageTex = mkTex((ctx, put) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ax = Math.min(x, 15 - x), ay = Math.min(y, 15 - y);
        const isOuter = (ax === 0 || ay === 0);
        const isInnerRim = (ax === 1 || ay === 1);
        // Iconic stepped/notched tooth pattern along the inner glass frame edge
        const isTooth = ((ax === 2 && (y % 2 === 1) && ay >= 2) || (ay === 2 && (x % 2 === 1) && ax >= 2));
        const isCornerStep = (ax <= 2 && ay <= 2);
        if (isOuter) put(x, y, (x < 8 && y < 8) ? '#f0f9ff' : '#cbd5e1');
        else if (isInnerRim || isCornerStep) put(x, y, ((x + y) & 1) ? '#e0f2fe' : '#bae6fd');
        else if (isTooth) put(x, y, '#f5d0fe');
      }
    });
    // 3) 16x16 Pixelated Glowing Pink-Magenta Rune Core Cube texture (matches uploaded Images 2 & 3!)
    const coreTex = mkTex((ctx, put) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const edge = (x === 0 || x === 15 || y === 0 || y === 15);
        const h = ((x * 29 + y * 53) & 3);
        put(x, y, edge ? '#f0abfc' : (h === 0 ? '#f5d0fe' : (h === 1 ? '#e879f9' : '#f472b6')));
      }
      // Iconic Minecraft End Crystal dark-magenta geometric rune symbols on the core!
      const rune = [
        [4,4],[5,4],[6,4],[7,4],[4,5],[4,6],[4,7],[5,7],[6,7],
        [10,4],[11,4],[11,5],[11,6],[10,6],[9,6],[11,7],
        [4,10],[5,10],[6,10],[4,11],[6,11],[4,12],[5,12],[6,12],
        [9,10],[11,10],[10,11],[9,12],[11,12]
      ];
      for (const [rx, ry] of rune) put(rx, ry, '#a21caf');
      put(7, 7, '#ffffff'); put(8, 8, '#ffffff');
    });
    _endCrystalSharedMats = {
      baseMat: new THREE.MeshStandardMaterial({ map: baseTex, roughness: 0.85, metalness: 0.12 }),
      cageMat: new THREE.MeshStandardMaterial({ map: cageTex, alphaTest: 0.4, transparent: true, side: THREE.DoubleSide, roughness: 0.18, metalness: 0.15, emissive: 0xc084fc, emissiveIntensity: 0.28 }),
      coreMat: new THREE.MeshStandardMaterial({ map: coreTex, roughness: 0.15, metalness: 0.08, emissive: 0xd946ef, emissiveIntensity: 0.95 })
    };
    return _endCrystalSharedMats;
  }

  function build3DEndCrystalItemMesh() {
    const M = _getEndCrystalMats();
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.24), M.baseMat);
    base.position.set(0, -0.11, 0);
    g.add(base);
    const cage1 = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.185, 0.185), M.cageMat);
    cage1.position.set(0, 0.025, 0);
    cage1.rotation.set(0.62, 0.78, 0.62);
    const cage2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), M.cageMat);
    cage2.position.set(0, 0.025, 0);
    cage2.rotation.set(-0.62, -0.52, 0.78);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.118, 0.118), M.coreMat);
    core.position.set(0, 0.025, 0);
    core.rotation.set(0.45, 0.35, -0.45);
    g.add(cage1, cage2, core);
    g.rotation.order = 'YXZ';
    g.position.set(0.01, -0.01, -0.05);
    g.rotation.set(0.18, -0.48, 0.08);
    g.userData.iconReady = true;
    return g;
  }

  // Shared 3D Stepped Voxel Dragon Egg builder matching icon pattern (non-overlapping bands + 3D raised spots on 4 sides)
  function _buildDragonEggMesh(pal, scale = 1.0) {
    const g = new THREE.Group();
    const p = pal || { base: 0x3b0a0a, shell: 0xb91c1c, band: 0xf97316, spot: 0xfef08a };
    const mBase = new THREE.MeshStandardMaterial({ color: p.base, roughness: 0.55, metalness: 0.15 });
    const mShell = new THREE.MeshStandardMaterial({ color: p.shell, roughness: 0.35, metalness: 0.20, emissive: p.shell, emissiveIntensity: 0.16 });
    const mBand = new THREE.MeshStandardMaterial({ color: p.band, roughness: 0.25, metalness: 0.25, emissive: p.band, emissiveIntensity: 0.45 });
    const mSpot = new THREE.MeshStandardMaterial({ color: p.spot, roughness: 0.18, emissive: p.spot, emissiveIntensity: 0.68 });
    const tiers = [
      [0.62, 0.14, 0.62, 0.07, mBase],
      [0.74, 0.22, 0.74, 0.25, mShell],
      [0.68, 0.14, 0.68, 0.43, mBand],
      [0.54, 0.20, 0.54, 0.60, mShell],
      [0.36, 0.14, 0.36, 0.77, mBand],
      [0.20, 0.10, 0.20, 0.89, mSpot]
    ];
    for (const [w, h, d, y, mat] of tiers) {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(w * scale, h * scale, d * scale), mat);
      bm.position.set(0, y * scale, 0);
      g.add(bm);
    }
    // 3D raised elemental egg spots matching 16x16 icon silhouettes on all 4 sides
    const spotSpecs = [
      [0.14, 0.12, 0.06,  0.14, 0.54,  0.295, mSpot],
      [0.14, 0.12, 0.06, -0.14, 0.54, -0.295, mSpot],
      [0.06, 0.12, 0.14,  0.295, 0.54, -0.14, mSpot],
      [0.06, 0.12, 0.14, -0.295, 0.54,  0.14, mSpot],
      [0.12, 0.10, 0.06, -0.16, 0.28,  0.385, mBand],
      [0.12, 0.10, 0.06,  0.16, 0.28, -0.385, mBand],
      [0.06, 0.10, 0.12,  0.385, 0.28,  0.16, mBand],
      [0.06, 0.10, 0.12, -0.385, 0.28, -0.16, mBand]
    ];
    for (const [w, h, d, x, y, z, mat] of spotSpecs) {
      const sm = new THREE.Mesh(new THREE.BoxGeometry(w * scale, h * scale, d * scale), mat);
      sm.position.set(x * scale, y * scale, z * scale);
      g.add(sm);
    }
    return g;
  }

  function build3DSculptedSpecialItem(blockId, meta = null) {
    const _aDef = BLOCK_DEF[blockId];
    if (_aDef && _aDef.dragonEgg) {
      const g = new THREE.Group();
      const inner = _buildDragonEggMesh(_aDef.eggPal, 0.34);
      inner.position.set(0, -0.15, 0);
      g.add(inner);
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.02, -0.04); g.rotation.set(0.20, -0.52, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (_aDef && _aDef.bucket) {
      return build3DBucketMesh(_aDef.bucket);
    }
    if (_aDef && _aDef.armorSlot && _aDef.armorTier && _aDef.armorSlot !== 'offhand') {
      return build3DHeldArmorMesh(_aDef.armorSlot, _aDef.armorTier, (meta && meta.trim) ? meta.trim : null);
    }
    if (blockId === B.SHIELD) {
      const sh = build3DShieldMesh(false);
      sh.userData.iconReady = true;
      return sh;
    }
    if (_aDef && _aDef.bed) {
      return buildHeldBedMesh(THREE, blockId);
    }
    if (blockId === B.LANTERN || blockId === B.SOUL_LANTERN) {
      // Sculpted 3D Hanging Lantern / Soul Lantern with rigid top ring & swinging lantern body pivot
      const isSoul = (blockId === B.SOUL_LANTERN);
      const texKey = isSoul ? '_soulLanternCoreTex' : '_lanternCoreTex';
      if (!build3DSculptedSpecialItem[texKey]) {
        const lcv = document.createElement('canvas'); lcv.width = 16; lcv.height = 16;
        const lc = lcv.getContext('2d');
        for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
          const edge = (px <= 1 || px >= 14 || py <= 1 || py >= 14);
          const midFrame = (px === 2 || px === 13 || py === 2 || py === 13);
          const core = isSoul ? (px >= 5 && px <= 10 && py >= 5 && py <= 11) : (px >= 6 && px <= 9 && py >= 6 && py <= 10);
          const inner = isSoul ? (px >= 3 && px <= 12 && py >= 3 && py <= 13) : (px >= 4 && px <= 11 && py >= 4 && py <= 12);
          lc.fillStyle = isSoul
            ? (edge ? '#1e242d' : (midFrame ? '#0284c7' : (core ? '#ecfeff' : (inner ? '#22d3ee' : '#0284c7'))))
            : (edge ? '#232933' : (midFrame ? '#b45309' : (core ? '#fef9c3' : (inner ? '#fbbf24' : '#d97706'))));
          lc.fillRect(px, py, 1, 1);
        }
        const ltex = new THREE.CanvasTexture(lcv);
        ltex.magFilter = THREE.NearestFilter; ltex.minFilter = THREE.NearestFilter; ltex.generateMipmaps = false;
        build3DSculptedSpecialItem[texKey] = ltex;
      }
      const g = new THREE.Group();
      const mkBox = (parent, w, h, d, col, x, y, z, emit = 0, tex = null) => {
        const mat = new THREE.MeshStandardMaterial({
          map: tex, color: tex ? 0xffffff : col, roughness: emit ? 0.36 : 0.45, metalness: emit ? 0.0 : 0.52,
          emissive: emit ? new THREE.Color(emit) : new THREE.Color(0), emissiveIntensity: emit ? (isSoul ? 0.64 : 0.46) : 0
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); parent.add(m); return m;
      };
      // Rigid top hanging ring attached directly to hand grip (does not swing)
      mkBox(g, 0.018, 0.044, 0.018, 0x64748b, -0.026, 0.175, 0);
      mkBox(g, 0.018, 0.044, 0.018, 0x64748b,  0.026, 0.175, 0);
      mkBox(g, 0.070, 0.018, 0.018, 0x94a3b8,  0.0,   0.197, 0);
      mkBox(g, 0.026, 0.026, 0.026, 0x64748b,  0.0,   0.214, 0);

      // Pendulum pivot under the top chain ring (located via getObjectByName so .clone() stays safe)
      const swingPivot = new THREE.Group();
      swingPivot.name = 'lanternSwingPivot';
      swingPivot.position.set(0, 0.155, 0);
      g.add(swingPivot);

      mkBox(swingPivot, 0.022, 0.022, 0.022, 0x64748b, 0, -0.008, 0);
      mkBox(swingPivot, 0.126, 0.010, 0.126, 0x64748b, 0, -0.012, 0);
      mkBox(swingPivot, 0.122, 0.038, 0.122, 0x3b4657, 0, -0.029, 0);
      mkBox(swingPivot, 0.178, 0.032, 0.178, 0x2d3542, 0, -0.063, 0);
      mkBox(swingPivot, 0.138, 0.168, 0.138, isSoul ? 0x22d3ee : 0xfbbf24, 0, -0.160, 0, isSoul ? 0x22d3ee : 0xffa822, build3DSculptedSpecialItem[texKey]);
      for (const sx of [-0.072, 0.072]) for (const sz of [-0.072, 0.072]) mkBox(swingPivot, 0.022, 0.176, 0.022, 0x1e242d, sx, -0.160, sz);
      mkBox(swingPivot, 0.178, 0.010, 0.178, 0x3b4657, 0, -0.244, 0);
      mkBox(swingPivot, 0.175, 0.032, 0.175, 0x262d38, 0, -0.260, 0);

      g.position.set(0.02, -0.01, -0.04);
      g.rotation.set(0.08, -0.45, 0.03);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.TOTEM_UNDYING) {
      // Sculpted 3D Golden Totem of Undying matching reference Image 1 (protruding nose, emerald eyes, angled stepped wings, rim highlight)
      if (!build3DSculptedSpecialItem._totemPartMats) {
        const pal = {
          L: '#fff098', H: '#ffe678', G: '#f8c64b', M: '#ebb03c', A: '#df972b', D: '#d1861f',
          W: '#ffffff', E: '#00d252', G2: '#00c44b', K: '#008a36'
        };
        const mkPixMat = (rows, emit = 0xd97706, emitI = 0.07) => {
          const h = rows.length, w = rows[0].length;
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const c = cv.getContext('2d');
          for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            c.fillStyle = pal[rows[py][px]] || pal.G;
            c.fillRect(px, py, 1, 1);
          }
          const t = new THREE.CanvasTexture(cv);
          t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
          return new THREE.MeshStandardMaterial({
            map: t, roughness: 0.36, metalness: 0.24,
            emissive: new THREE.Color(emit), emissiveIntensity: emitI
          });
        };
        const goldSideMat = mkPixMat(['HG','GA']);
        const headCleanMat = (() => {
          const cv = document.createElement('canvas'); cv.width = 6; cv.height = 7;
          const c = cv.getContext('2d');
          const grid = [
            [pal.A, pal.G, pal.L, pal.L, pal.G, pal.A],
            [pal.G, pal.D, pal.A, pal.A, pal.D, pal.G],
            [pal.W, pal.E, pal.H, pal.G, pal.W, pal.E],
            [pal.G2,pal.K, pal.H, pal.G, pal.G2,pal.K],
            [pal.M, pal.A, pal.G, pal.G, pal.A, pal.M],
            [pal.G, pal.M, pal.A, pal.A, pal.M, pal.G],
            [pal.L, pal.H, pal.H, pal.G, pal.M, pal.A]
          ];
          for (let py = 0; py < 7; py++) for (let px = 0; px < 6; px++) { c.fillStyle = grid[py][px]; c.fillRect(px, py, 1, 1); }
          const t = new THREE.CanvasTexture(cv);
          t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
          return new THREE.MeshStandardMaterial({ map: t, roughness: 0.36, metalness: 0.24, emissive: new THREE.Color(0xd97706), emissiveIntensity: 0.07 });
        })();
        const noseMat  = mkPixMat(['HG','HG','MA','GA','MA']);
        const chestMat = mkPixMat(['LLGGMA','LGGMMA','GGMAAD']);
        const baseMat  = mkPixMat(['GGGG','GAAM','GDDM','LLLL']);
        const wingUpL  = mkPixMat(['HGLL','AGGL']);
        const wingUpR  = mkPixMat(['LLGH','LGGA']);
        const wingLoMat= mkPixMat(['AA','LL','GG']);
        build3DSculptedSpecialItem._totemPartMats = {
          goldSideMat, headCleanMat, noseMat, chestMat, baseMat, wingUpL, wingUpR, wingLoMat
        };
      }
      const pm = build3DSculptedSpecialItem._totemPartMats;
      const g = new THREE.Group();
      const u = 0.0235;
      const mkPart = (parent, w, h, d, x, y, z, frontMat, sideMat = pm.goldSideMat) => {
        const mats = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * u, h * u, d * u), mats);
        m.position.set(x * u, y * u, z * u);
        parent.add(m);
        return m;
      };
      // Head, 3D protruding nose, torso chest, and pedestal base
      mkPart(g, 6.0, 7.0, 4.0, 0, 3.0, 0, pm.headCleanMat);
      mkPart(g, 2.0, 4.6, 1.6, 0, 1.35, 2.5, pm.noseMat, pm.noseMat);
      mkPart(g, 6.0, 3.2, 3.2, 0, -2.0, -0.1, pm.chestMat);
      mkPart(g, 4.0, 3.0, 2.6, 0, -5.0, -0.15, pm.baseMat);
      // Left angled stepped wing
      const wingL = new THREE.Group();
      wingL.position.set(-2.9 * u, 0.7 * u, -0.15 * u);
      wingL.rotation.z = -0.12;
      mkPart(wingL, 4.0, 2.1, 1.6, -2.0, 0.9, 0, pm.wingUpL);
      mkPart(wingL, 2.6, 2.9, 1.5, -1.3, -1.55, 0, pm.wingLoMat);
      g.add(wingL);
      // Right angled stepped wing
      const wingR = new THREE.Group();
      wingR.position.set(2.9 * u, 0.7 * u, -0.15 * u);
      wingR.rotation.z = 0.12;
      mkPart(wingR, 4.0, 2.1, 1.6, 2.0, 0.9, 0, pm.wingUpR);
      mkPart(wingR, 2.6, 2.9, 1.5, 1.3, -1.55, 0, pm.wingLoMat);
      g.add(wingR);

      g.rotation.order = 'YXZ';
      g.position.set(0.0, 0.02, -0.04);
      g.rotation.set(0.10, -0.42, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.TORCH_BLOCK) {
      // Sculpted 3D Minecraft Torch with glowing ember & animated-look 3D flame!
      const g = new THREE.Group();
      const mkB = (w, h, d, col, x, y, z, emit = 0, ei = 0) => {
        const mat = new THREE.MeshStandardMaterial({
          color: col, roughness: emit ? 0.35 : 0.82,
          emissive: emit ? new THREE.Color(emit) : new THREE.Color(0), emissiveIntensity: ei
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); g.add(m); return m;
      };
      mkB(0.055, 0.32, 0.055, 0x8b5a2b, 0, -0.02, 0); // Wooden shaft
      mkB(0.064, 0.055, 0.064, 0x3b2314, 0, 0.145, 0, 0xd97706, 0.32); // Charred ember tip
      mkB(0.072, 0.075, 0.072, 0xff7b00, 0, 0.195, 0, 0xff6a00, 0.72); // Outer orange flame
      mkB(0.044, 0.095, 0.044, 0xfef08a, 0, 0.215, 0, 0xfde047, 0.90); // Bright yellow core
      g.position.set(-0.01, -0.02, -0.05);
      g.rotation.set(0.16, -0.35, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.BLAZE_ROD) {
      const g = new THREE.Group();
      const rodMat  = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.1, emissive: 0xea580c, emissiveIntensity: 0.44 });
      const coreMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.16, emissive: 0xfacc15, emissiveIntensity: 0.62 });
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6 });
      const addB = (w, h, d, x, y, z, m) => { const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); bm.position.set(x, y, z); g.add(bm); };
      addB(0.055, 0.36, 0.055, 0, 0.03, 0, rodMat);
      addB(0.064, 0.06, 0.064, 0, 0.17, 0, coreMat);
      addB(0.066, 0.04, 0.066, 0, 0.05, 0, bandMat);
      addB(0.066, 0.04, 0.066, 0, -0.07, 0, bandMat);
      addB(0.058, 0.05, 0.058, 0, -0.14, 0, coreMat);
      g.rotation.order = 'YXZ'; g.position.set(0.02, -0.01, -0.04); g.rotation.set(0.38, -0.35, -0.12);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.BLAZE_POWDER) {
      const g = new THREE.Group();
      const orgMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4, emissive: 0xc2410c, emissiveIntensity: 0.36 });
      const gldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, emissive: 0xf59e0b, emissiveIntensity: 0.56 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.15, emissive: 0xfef08a, emissiveIntensity: 0.72 });
      const addB = (w, h, d, x, y, z, m) => { const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); bm.position.set(x, y, z); g.add(bm); };
      addB(0.18, 0.06, 0.18, 0, -0.04, 0, orgMat);
      addB(0.13, 0.07, 0.13, 0, 0.01, 0, gldMat);
      addB(0.07, 0.07, 0.07, 0.01, 0.05, -0.01, tipMat);
      addB(0.036, 0.036, 0.036, -0.07, 0.09, 0.04, tipMat);
      addB(0.032, 0.032, 0.032, 0.07, 0.11, -0.03, gldMat);
      addB(0.028, 0.028, 0.028, 0.02, 0.14, 0.05, tipMat);
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.24, -0.45, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.ENDER_PEARL || blockId === B.ENDER_EYE) {
      const isEye = (blockId === B.ENDER_EYE);
      const g = new THREE.Group();
      const darkMat  = new THREE.MeshStandardMaterial({ color: isEye ? 0x064e3b : 0x042f2e, roughness: 0.25, metalness: 0.12 });
      const mainMat  = new THREE.MeshStandardMaterial({ color: isEye ? 0x10b981 : 0x0f766e, roughness: 0.18, emissive: isEye ? 0x059669 : 0x0d9488, emissiveIntensity: isEye ? 0.52 : 0.42 });
      const glintMat = new THREE.MeshStandardMaterial({ color: isEye ? 0xa7f3d0 : 0x5eead4, roughness: 0.12, emissive: isEye ? 0x6ee7b7 : 0x2dd4bf, emissiveIntensity: 0.58 });
      const addB = (w, h, d, x, y, z, m) => { const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); bm.position.set(x, y, z); g.add(bm); };
      addB(0.18, 0.18, 0.18, 0, 0, 0, darkMat);
      addB(0.15, 0.21, 0.15, 0, 0, 0, mainMat);
      addB(0.21, 0.15, 0.15, 0, 0, 0, mainMat);
      addB(0.15, 0.15, 0.21, 0, 0, 0, mainMat);
      addB(0.06, 0.06, 0.06, -0.055, 0.055, 0.065, glintMat);
      if (isEye) {
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1, metalness: 0.2 });
        addB(0.042, 0.12, 0.222, 0, 0, 0, pupilMat);
      }
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.20, -0.46, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.END_PORTAL_FRAME || blockId === B.END_PORTAL_FRAME_EYE) {
      const g = new THREE.Group();
      const creamMat = new THREE.MeshStandardMaterial({ color: 0xd5d29c, roughness: 0.85 });
      const tealMat  = new THREE.MeshStandardMaterial({ color: 0x2d6a62, roughness: 0.5 });
      const sockMat  = new THREE.MeshStandardMaterial({ color: 0x0b1f22, roughness: 0.35 });
      const addB = (w, h, d, x, y, z, m) => { const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); bm.position.set(x, y, z); g.add(bm); };
      addB(0.24, 0.13, 0.24, 0, -0.04, 0, creamMat);
      addB(0.245, 0.06, 0.245, 0, 0.055, 0, tealMat);
      addB(0.13, 0.015, 0.13, 0, 0.085, 0, sockMat);
      if (blockId === B.END_PORTAL_FRAME_EYE) {
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.50 });
        const pupMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
        addB(0.11, 0.055, 0.11, 0, 0.108, 0, eyeMat);
        addB(0.025, 0.060, 0.075, 0, 0.110, 0, pupMat);
      }
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.28, -0.55, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.GHAST_TEAR) {
      const g = new THREE.Group();
      const tearMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.14, metalness: 0.15, emissive: 0x7dd3fc, emissiveIntensity: 0.38 });
      const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, emissive: 0xbae6fd, emissiveIntensity: 0.52 });
      const addB = (w, h, d, x, y, z, m) => { const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); bm.position.set(x, y, z); g.add(bm); };
      addB(0.14, 0.14, 0.10, 0, -0.04, 0, tearMat);
      addB(0.10, 0.12, 0.08, 0, 0.04, 0, tearMat);
      addB(0.055, 0.08, 0.06, 0, 0.11, 0, coreMat);
      addB(0.07, 0.07, 0.112, -0.02, -0.03, 0, coreMat);
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.18, -0.45, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.END_CRYSTAL_BLOCK) {
      return build3DEndCrystalItemMesh();
    }
    if (blockId === B.DRAGON_HEAD) {
      const g = build3DDragonHeadMesh(0.32);
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.06, -0.04); g.rotation.set(0.18, -0.64, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.ELYTRA || blockId === B.ELYTRA_PHOENIX) {
      const m = build3DVoxelItemMesh(blockId);
      m.rotation.order = 'YXZ';
      m.position.set(0.01, 0.01, -0.05);
      m.rotation.set(0.18, -0.45, 0.08);
      m.userData.iconReady = true;
      return m;
    }
    if (blockId === B.END_ROD) {
      const g = new THREE.Group();
      const base = _makeAtlasBox(0.085, 0.038, 0.085, 515, 515, 515); base.position.set(0, -0.11, 0);
      const rodM = new THREE.MeshStandardMaterial({ color: 0xfdfaff, emissive: 0xf5d0fe, emissiveIntensity: 0.62, roughness: 0.18 });
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.26, 0.044), rodM); pole.position.set(0, 0.02, 0);
      g.add(base, pole);
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.16, -0.42, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.WINDMILL_HUB) {
      const g = build3DWindmillRotorMesh(0.036);
      g.rotation.order = 'YXZ'; g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.16, -0.52, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.GLOW_CRYSTAL || blockId === B.ICHOR_CRYSTAL || blockId === B.ECHO_SHARD || blockId === B.MOONSTONE_GEM || blockId === B.DREAM_PRISM_GEM) {
      // Sculpted 3D Multi-Spire Glowing Amethyst / Crystal Cluster (Note: DRAGON_CRYSTAL renders from icon sprite 487 for 1P/3P/icon parity)
      const g = new THREE.Group();
      const cPal = blockId === B.ICHOR_CRYSTAL
        ? { main: 0xf472b6, tip: 0xfef08a, emit: 0xec4899, base: 0x4c1d95 }
        : (blockId === B.ECHO_SHARD
          ? { main: 0x06b6d4, tip: 0xa5f3fc, emit: 0x0891b2, base: 0x0f172a }
          : (blockId === B.END_CRYSTAL_BLOCK
            ? { main: 0xe879f9, tip: 0xfdf4ff, emit: 0xd946ef, base: 0x3b0764 }
            : (blockId === B.MOONSTONE_GEM
              ? { main: 0xa5b4fc, tip: 0xf8fafc, emit: 0x6366f1, base: 0x1e1b4b }
              : (blockId === B.DREAM_PRISM_GEM
                ? { main: 0xffffff, tip: 0xffffff, emit: 0xffffff, base: 0x1e293b }
                : { main: 0xa855f7, tip: 0xf3e8ff, emit: 0x9333ea, base: 0x2e1065 }))))
      const baseMat = new THREE.MeshStandardMaterial({ color: cPal.base, roughness: 0.72, metalness: 0.12 });
      const cryMat  = new THREE.MeshStandardMaterial({ color: cPal.main, roughness: 0.18, metalness: 0.15, emissive: cPal.emit, emissiveIntensity: 0.55 });
      const tipMat  = new THREE.MeshStandardMaterial({ color: cPal.tip,  roughness: 0.12, metalness: 0.10, emissive: cPal.tip,  emissiveIntensity: 0.70 });
      const isDreamGem = (blockId === B.DREAM_PRISM_GEM);
      const dreamSpireMats = isDreamGem ? [0x38e8e1, 0xc28bff, 0xff87c6, 0x6ef2a8].map((hx) => {
        const m = new THREE.MeshStandardMaterial({ color: hx, roughness: 0.16, metalness: 0.24, emissive: hx, emissiveIntensity: 0.55 });
        m.userData = { isRainbowItem: true };
        _rainbowMats.add(m);
        applyRainbowToMat(m, _dreamRainbowHue);
        return m;
      }) : null;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.18), baseMat);
      base.position.set(0, -0.10, 0); g.add(base);
      let spireIdx = 0;
      const addSpire = (w, h, d, x, y, z, rx, rz) => {
        const sp = new THREE.Group();
        sp.position.set(x, y, z); sp.rotation.set(rx, 0, rz);
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dreamSpireMats ? dreamSpireMats[spireIdx % 4] : cryMat);
        body.position.set(0, h * 0.5, 0);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.28, d * 0.62), dreamSpireMats ? dreamSpireMats[(spireIdx + 1) % 4] : tipMat);
        tip.position.set(0, h + h * 0.12, 0);
        spireIdx++;
        sp.add(body, tip); g.add(sp);
      };
      addSpire(0.085, 0.28, 0.085,  0.00, -0.09,  0.00,  0.10, -0.08);
      addSpire(0.062, 0.20, 0.062, -0.055, -0.09,  0.02, -0.22,  0.42);
      addSpire(0.058, 0.19, 0.058,  0.058, -0.09, -0.015, 0.26, -0.44);
      addSpire(0.050, 0.15, 0.050,  0.015, -0.09,  0.055, 0.45,  0.14);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.18, -0.48, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    const _itemDef = BLOCK_DEF[blockId];
    if (_itemDef && _itemDef.door && typeof getDoorVoxelMatSet === 'function') {
      // Sculpted 3D Miniature Door for 1st-Person & 3rd-Person (slab + 3D rails, mullions, hinges & doorknob!)
      const dm = getDoorVoxelMatSet(_itemDef.doorTier || 'oak');
      const g = new THREE.Group();
      const W = 0.21, H = 0.42, T = 0.040;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), dm.faceMat);
      front.position.set(0, 0, T * 0.5 + 0.001);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), dm.faceMatM);
      back.position.set(0, 0, -T * 0.5 - 0.001); back.rotation.y = Math.PI;
      const frameBox = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), dm.edgeMat);
      g.add(frameBox, front, back);
      // 3D Protruding Doorknob (both sides) + Hinge studs
      const knobMat = new THREE.MeshStandardMaterial({ color: dm.pal.knob || 0xe2e8f0, roughness: 0.35, metalness: 0.65 });
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, T + 0.022), knobMat);
      knob.position.set(0.062, -0.01, 0);
      const hingeMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.6 });
      for (const hy of [0.13, 0.0, -0.13]) {
        const hg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.030, T + 0.008), hingeMat);
        hg.position.set(-0.095, hy, 0);
        g.add(hg);
      }
      g.add(knob);
      g.rotation.order = 'YXZ';
      g.position.set(0.02, 0.01, -0.05); g.rotation.set(0.14, -0.58, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (_itemDef && _itemDef.trapdoor && typeof getDoorVoxelMatSet === 'function') {
      const tier = _itemDef.doorTier || 'oak';
      const dm = getDoorVoxelMatSet(tier);
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.048, 0.28), _getTrapMat ? _getTrapMat(tier, dm.pal) : dm.edgeMat);
      const rim1 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.054, 0.045), dm.edgeMat); rim1.position.set(0, 0, 0.13);
      const rim2 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.054, 0.045), dm.edgeMat); rim2.position.set(0, 0,-0.13);
      g.add(slab, rim1, rim2);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.45, -0.52, 0.12);
      g.userData.iconReady = true;
      return g;
    }
    if (_itemDef && _itemDef.chest && typeof _getChestMats === 'function') {
      const cm = _getChestMats(_itemDef.chestTier || 'oak');
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), cm.body);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.272, 0.032, 0.272), cm.rim); rim.position.set(0, 0.04, 0);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.068, 0.032), cm.latch); latch.position.set(0, 0.02, 0.138);
      g.add(body, rim, latch);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.26, -0.62, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (_itemDef && _itemDef.stairs) {
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [3, 3, 3];
      const b1 = _makeAtlasBox(0.26, 0.13, 0.26, tTop, tSide, tBot); b1.position.set(0, -0.065, 0);
      const b2 = _makeAtlasBox(0.26, 0.13, 0.13, tTop, tSide, tBot); b2.position.set(0,  0.065, -0.065);
      g.add(b1, b2);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.24, -0.62, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (_itemDef && _itemDef.slab) {
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [8, 8, 8];
      const slabBox = _makeAtlasBox(0.26, 0.13, 0.26, tTop, tSide, tBot);
      slabBox.position.set(0, -0.055, 0);
      g.add(slabBox);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.24, -0.62, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (_itemDef && _itemDef.fence) {
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [8, 8, 8];
      const pL = _makeAtlasBox(0.065, 0.28, 0.065, tTop, tSide, tBot); pL.position.set(-0.085, 0, 0);
      const pR = _makeAtlasBox(0.065, 0.28, 0.065, tTop, tSide, tBot); pR.position.set( 0.085, 0, 0);
      const r1 = _makeAtlasBox(0.26,  0.045, 0.04, tTop, tSide, tBot); r1.position.set(0,  0.06, 0);
      const r2 = _makeAtlasBox(0.26,  0.045, 0.04, tTop, tSide, tBot); r2.position.set(0, -0.05, 0);
      g.add(pL, pR, r1, r2);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.18, -0.52, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (_itemDef && _itemDef.wall) {
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [3, 3, 3];
      const post = _makeAtlasBox(0.13, 0.26, 0.13, tTop, tSide, tBot);
      const wing = _makeAtlasBox(0.26, 0.21, 0.095, tTop, tSide, tBot); wing.position.set(0, -0.025, 0);
      g.add(post, wing);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.20, -0.58, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.ANVIL) {
      const g = new THREE.Group();
      const mBase = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.55 });
      const mDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.50, metalness: 0.60 });
      const mTop  = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.42, metalness: 0.65 });
      const addA = (w, h, d, y, m) => { const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); bm.position.set(0, y, 0); g.add(bm); };
      addA(0.22, 0.055, 0.17, -0.095, mBase);
      addA(0.17, 0.035, 0.13, -0.050, mDark);
      addA(0.11, 0.075, 0.09,  0.005, mDark);
      addA(0.26, 0.095, 0.16,  0.090, mTop);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.22, -0.60, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.ENCHANT_TABLE) {
      const g = new THREE.Group();
      const obs = _makeAtlasBox(0.26, 0.18, 0.26, 84, 84, 84); obs.position.set(0, -0.03, 0);
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.018, 0.21), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.72 }));
      cloth.position.set(0, 0.066, 0);
      const studMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.65, roughness: 0.25 });
      for (const sx of [-0.095, 0.095]) for (const sz of [-0.095, 0.095]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.03), studMat);
        st.position.set(sx, 0.066, sz); g.add(st);
      }
      const book = new THREE.Group();
      book.position.set(0, 0.135, 0); book.rotation.set(-0.35, 0.25, 0);
      const cov = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.016, 0.10), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 }));
      const pag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.082), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 }));
      pag.position.set(0, 0.008, 0);
      book.add(cov, pag);
      g.add(obs, cloth, book);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.02, -0.05); g.rotation.set(0.24, -0.58, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.BAMBOO) {
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [140, 140, 140];
      const stalk = _makeAtlasBox(0.068, 0.34, 0.068, tTop, tSide, tBot);
      const nodeMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.78 });
      for (const ny of [-0.07, 0.06]) {
        const nd = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.022, 0.078), nodeMat);
        nd.position.set(0, ny, 0); g.add(nd);
      }
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.75 });
      for (const [lx, ly, lz, ry, rz] of [[0.06, 0.11, 0, 0.2, -0.45], [-0.06, 0.03, 0.03, -0.3, 0.50], [0.04, -0.05, -0.04, 0.8, -0.42]]) {
        const lf = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.038), leafMat);
        lf.position.set(lx, ly, lz); lf.rotation.set(0, ry, rz); g.add(lf);
      }
      g.add(stalk);
      g.rotation.order = 'YXZ';
      g.position.set(-0.01, 0.0, -0.05); g.rotation.set(0.16, -0.35, 0.06);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.CACTUS) {
      if (!build3DSculptedSpecialItem._cacMats) {
        build3DSculptedSpecialItem._cacMats = {
          tip: new THREE.MeshStandardMaterial({ color: 0xdfefc9, roughness: 0.72 }),
          base: new THREE.MeshStandardMaterial({ color: 0x295e23, roughness: 0.85 })
        };
      }
      const cm = build3DSculptedSpecialItem._cacMats;
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [184, 17, 184];
      const core = _makeAtlasBox(0.228, 0.26, 0.228, tTop, tSide, tBot);
      const spGeo = new THREE.BoxGeometry(0.014, 0.013, 0.013);
      // Staggered protruding needle clusters along ribs matching 2D isometric icon
      const spOffsets = [
        [ 0.120,  0.070, -0.045, true], [ 0.120, -0.015,  0.045, true], [ 0.120, -0.080, -0.035, true],
        [-0.120,  0.055,  0.035, true], [-0.120, -0.055, -0.045, true],
        [-0.045,  0.070,  0.120, false],[ 0.045, -0.015,  0.120, false],[-0.035, -0.080,  0.120, false],
        [ 0.035,  0.055, -0.120, false],[-0.045, -0.055, -0.120, false]
      ];
      for (const [sx, sy, sz, onX] of spOffsets) {
        const sp = new THREE.Mesh(spGeo, cm.tip);
        sp.position.set(sx, sy, sz);
        if (onX) sp.scale.set(1.25, 0.85, 0.85); else sp.scale.set(0.85, 0.85, 1.25);
        g.add(sp);
        const sb = new THREE.Mesh(spGeo, cm.base);
        sb.position.set(sx * 0.92, sy, sz * 0.92);
        sb.scale.setScalar(0.82);
        g.add(sb);
      }
      g.add(core);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.02, -0.04); g.rotation.set(0.18, -0.78, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.CAKE_ITEM) {
      const g = new THREE.Group();
      const spMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78 });
      const icMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
      const stMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
      const sponge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.10, 0.25), spMat); sponge.position.set(0, -0.02, 0);
      const icing = new THREE.Mesh(new THREE.BoxGeometry(0.258, 0.045, 0.258), icMat); icing.position.set(0, 0.048, 0);
      g.add(sponge, icing);
      for (const [bx, bz] of [[0, 0], [-0.07, -0.06], [0.06, -0.05], [-0.05, 0.07], [0.07, 0.06]]) {
        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.022, 0.036), stMat);
        dot.position.set(bx, 0.078, bz); g.add(dot);
      }
      g.rotation.order = 'YXZ';
      g.position.set(0.01, 0.01, -0.04); g.rotation.set(0.28, -0.56, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.BOAT_ITEM) {
      const g = new THREE.Group();
      const oakMat = new THREE.MeshStandardMaterial({ color: 0xb07e46, roughness: 0.80 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a5b2c, roughness: 0.82 });
      const addB = (w, h, d, x, y, z, m, ry = 0) => {
        const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        bm.position.set(x, y, z); if (ry) bm.rotation.y = ry; g.add(bm);
      };
      addB(0.28, 0.032, 0.16, 0, -0.035, 0, trimMat);
      addB(0.28, 0.068, 0.028, 0, 0.01, -0.078, oakMat);
      addB(0.28, 0.068, 0.028, 0, 0.01,  0.078, oakMat);
      addB(0.028, 0.068, 0.156, -0.145, 0.01, 0, trimMat);
      addB(0.028, 0.068, 0.156,  0.145, 0.01, 0, trimMat);
      addB(0.045, 0.018, 0.13, -0.02, 0.018, 0, trimMat);
      addB(0.022, 0.018, 0.18, -0.06, 0.035, 0.10, trimMat, 0.45);
      addB(0.022, 0.018, 0.18,  0.06, 0.035,-0.10, trimMat,-0.45);
      g.rotation.order = 'YXZ';
      g.position.set(0.01, -0.01, -0.05); g.rotation.set(0.32, -0.58, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    if (blockId === B.SPYGLASS) {
      const g = new THREE.Group();
      const copMat = new THREE.MeshStandardMaterial({ color: 0xd97745, roughness: 0.36, metalness: 0.65 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.30, metalness: 0.72 });
      const lensMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.55, roughness: 0.18, metalness: 0.25 });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.22, 0.058), copMat); b1.position.set(0, -0.04, 0);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.11, 0.072), copMat); b2.position.set(0, 0.11, 0);
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.022, 0.076), rimMat); r1.position.set(0, 0.06, 0);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.022, 0.076), rimMat); r2.position.set(0, 0.16, 0);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.018, 0.056), lensMat); lens.position.set(0, 0.172, 0);
      g.add(b1, b2, r1, r2, lens);
      g.rotation.order = 'YXZ';
      g.position.set(-0.01, 0.02, -0.06); g.rotation.set(-0.92, -0.22, 0.08);
      g.userData.iconReady = true;
      return g;
    }
    return null;
  }

  let _itemIconTmpCv = null, _itemIconTmpCtx = null;
  const _bowRgbaScratch = new Uint8ClampedArray(16 * 16 * 4);
  function build3DVoxelItemMesh(blockId, meta = null) {
    const def = BLOCK_DEF[blockId];
    const isCastRod = (blockId === B.FISHING_ROD && meta && meta.rodCast && typeof V153_TILES !== 'undefined');
    const tile = isCastRod ? V153_TILES.rodCast : (def.itemTile !== undefined ? def.itemTile : def.tiles[1]);
    let imgData = null;
    let usedOfficialIcon = false;
    const _vKey = (typeof BLOCK_ID_TO_KEY !== 'undefined') ? BLOCK_ID_TO_KEY[blockId] : null;
    const _vIm = (_vKey && !def.customAtlasTex && !isCastRod && typeof _mcItemImgs !== 'undefined') ? _mcItemImgs.get(_vKey) : null;
    if (def.tool === 'bow' && typeof window.getBowStageSprite === 'function') {
      const bStage = (meta && typeof meta.bowStage === 'number') ? meta.bowStage : 0;
      const sp = window.getBowStageSprite(blockId, bStage);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = sp.rows[y][x];
        const pi = (y * 16 + x) * 4;
        const hex = (ch !== '.' && sp.pal[ch]) ? sp.pal[ch] : null;
        if (hex) {
          const n = parseInt(hex.slice(1), 16);
          _bowRgbaScratch[pi] = (n >> 16) & 255;
          _bowRgbaScratch[pi + 1] = (n >> 8) & 255;
          _bowRgbaScratch[pi + 2] = n & 255;
          _bowRgbaScratch[pi + 3] = 255;
        } else {
          _bowRgbaScratch[pi + 3] = 0;
        }
      }
      imgData = _bowRgbaScratch;
      usedOfficialIcon = true;
    } else if (_vIm && _vIm.complete && _vIm.naturalWidth > 0) {
      if (!_itemIconTmpCv) {
        _itemIconTmpCv = document.createElement('canvas'); _itemIconTmpCv.width = 16; _itemIconTmpCv.height = 16;
        _itemIconTmpCtx = _itemIconTmpCv.getContext('2d'); _itemIconTmpCtx.imageSmoothingEnabled = false;
      }
      _itemIconTmpCtx.clearRect(0, 0, 16, 16);
      _itemIconTmpCtx.drawImage(_vIm, 0, 0, _vIm.naturalWidth, _vIm.naturalHeight, 0, 0, 16, 16);
      imgData = _itemIconTmpCtx.getImageData(0, 0, 16, 16).data;
      usedOfficialIcon = true;
    } else {
      const tx = (tile % ATLAS_COLS) * TILE_PX, ty = Math.floor(tile / ATLAS_COLS) * TILE_PX;
      imgData = atlasCtx.getImageData(tx, ty, TILE_PX, TILE_PX).data;
    }
    const pos = [], norm = [], cols = [], idx = [];
    let vc = 0;
    const isTool = !!def.tool;
    const isChunky = !isTool && !def.cross && (
      def.food || def.bucket || blockId === B.WATER_BREATH_POTION || blockId === B.NIGHT_VISION_POTION ||
      blockId === B.TOTEM_UNDYING || blockId === B.SWIFT_SNEAK_BOOK || blockId === B.DISC_FRAGMENT_5 ||
      blockId === B.MUSIC_DISC_5 || blockId === B.MUSIC_DISC_OTHERSIDE || blockId === B.SNOWBALL ||
      blockId === B.COAL || blockId === B.CHARCOAL ||
      blockId === B.DIAMOND || blockId === B.EMERALD || blockId === B.RUBY || blockId === B.FLINT || blockId === B.REDSTONE ||
      blockId === B.GUNPOWDER || blockId === B.VOID_PEARL || blockId === B.MAGMA_CORE ||
      blockId === B.RAW_IRON || blockId === B.RAW_GOLD || blockId === B.RAW_COPPER ||
      blockId === B.NETHERITE_SCRAP || blockId === B.NETHERITE_INGOT ||
      blockId === B.DRAGON_SCALE || blockId === B.DRAGON_BONE || blockId === B.DRAGON_SADDLE || blockId === B.DRAGON_CRYSTAL || !!def.smithTemplate || !!def.dragonArmorSlot ||
      (_vKey && /INGOT$/.test(_vKey))
    );
    // Volumetric 16x16 3D extruded item model (embossed thicker center bevel on meats, foods, ingots & gems!)
    const px = isTool ? 0.030 : (isChunky ? 0.028 : 0.026);
    const halfD = (isTool ? 0.016 : (isChunky ? 0.022 : 0.014));
    const bevel = isChunky ? 0.008 : 0.0;
    const pushQuad = (a, b, c, d, n, r, g, bl) => {
      pos.push(...a, ...b, ...c, ...d); norm.push(...n, ...n, ...n, ...n);
      cols.push(r, g, bl, r, g, bl, r, g, bl, r, g, bl);
      idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3); vc += 4;
    };
    const getPxIdx = (x, y) => (y * 16 + x) * 4;
    const isOpaque = (x, y) => (x >= 0 && x < 16 && y >= 0 && y < 16 && imgData[getPxIdx(x, y) + 3] > 32);
    const isInteriorPx = (x, y) => bevel > 0 && isOpaque(x, y) && isOpaque(x - 1, y) && isOpaque(x + 1, y) && isOpaque(x, y - 1) && isOpaque(x, y + 1);
    const isRainbowItem = !!(def && def.rainbow);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!isOpaque(x, y)) continue;
      const pi = getPxIdx(x, y);
      const r = imgData[pi] / 255, g = imgData[pi + 1] / 255, bl = imgData[pi + 2] / 255;
      const intr = isInteriorPx(x, y);
      const x0 = (x - 8) * px, x1 = x0 + px, y0 = (8 - y - 1) * px, y1 = y0 + px;
      const z0 = -(halfD + (intr ? bevel : 0)), z1 = (halfD + (intr ? bevel : 0));
      pushQuad([x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [0,0,1], r, g, bl);
      pushQuad([x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [0,0,-1], r*0.95, g*0.95, bl*0.95);
      const emitSide = (dir, zLo, zHi) => {
        if (dir === 0) pushQuad([x0,y1,zHi], [x1,y1,zHi], [x1,y1,zLo], [x0,y1,zLo], [0,1,0], Math.min(1,r*1.06), Math.min(1,g*1.06), Math.min(1,bl*1.06));
        else if (dir === 1) pushQuad([x0,y0,zLo], [x1,y0,zLo], [x1,y0,zHi], [x0,y0,zHi], [0,-1,0], r*0.78, g*0.78, bl*0.78);
        else if (dir === 2) pushQuad([x1,y0,zHi], [x1,y0,zLo], [x1,y1,zLo], [x1,y1,zHi], [1,0,0], r*0.90, g*0.90, bl*0.90);
        else pushQuad([x0,y0,zLo], [x0,y0,zHi], [x0,y1,zHi], [x0,y1,zLo], [-1,0,0], r*0.86, g*0.86, bl*0.86);
      };
      const nbD = [[0,-1],[0,1],[1,0],[-1,0]];
      for (let d = 0; d < 4; d++) {
        const nx = x + nbD[d][0], ny = y + nbD[d][1];
        if (!isOpaque(nx, ny)) emitSide(d, z0, z1);
        else if (intr && !isInteriorPx(nx, ny)) { emitSide(d, halfD, z1); emitSide(d, z0, -halfD); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(idx);
    const isWarmGlow = (blockId === B.FIRE_SWORD || blockId === B.DRAGON_BONE_SWORD || blockId === B.DRAGON_BONE_BOW || blockId === B.DRAGON_CRYSTAL || blockId === B.DRAGON_SCALE || blockId === B.END_DRAGON_SCALE || blockId === B.END_DRAGON_BONE || blockId === B.END_DRAGON_SWORD || blockId === B.END_DRAGON_BOW || blockId === B.ENCHANTED_BOOK || blockId === B.LAVA_BUCKET || blockId === B.TORCH_BLOCK || blockId === B.GOLD_APPLE || blockId === B.GOLDEN_CARROT || blockId === B.WATER_BREATH_POTION || blockId === B.NIGHT_VISION_POTION || blockId === B.TOTEM_UNDYING || blockId === B.SWIFT_SNEAK_BOOK || blockId === B.DREAM_FRUIT || blockId === B.SOUL_FLINT_AND_STEEL || blockId === B.SCULK_ECHO_BOW || blockId === B.DEEP_SONIC_BOW || blockId === B.SOUL_HARBINGER_BOW || blockId === B.RESONANT_SWORD || blockId === B.SOULFORGED_SWORD || blockId === B.SCULK_RESONANT_GEM || blockId === B.SCULK_HEART || blockId === B.SOUL_RESONATOR);
    const isEnch = !!(meta && meta.ench);
    const isSpecialGlint = isRainbowItem || (blockId === B.FIRE_SWORD || blockId === B.ENCHANTED_BOOK || blockId === B.DRAGON_BONE_SWORD || blockId === B.DRAGON_BONE_AXE || blockId === B.DRAGON_BONE_PICK || blockId === B.DRAGON_BONE_BOW || blockId === B.SCULK_CHITIN_SWORD || blockId === B.SCULK_CHITIN_PICK || blockId === B.SCULK_CHITIN_AXE || blockId === B.SCULK_ECHO_BOW || blockId === B.RESONANT_SWORD || blockId === B.RESONANT_PICK || blockId === B.RESONANT_AXE || blockId === B.DEEP_SONIC_BOW || blockId === B.SOULFORGED_SWORD || blockId === B.SOULFORGED_PICK || blockId === B.SOULFORGED_AXE || blockId === B.SOUL_HARBINGER_BOW || blockId === B.END_DRAGON_SWORD || blockId === B.END_DRAGON_PICK || blockId === B.END_DRAGON_AXE || blockId === B.END_DRAGON_SHOVEL || blockId === B.END_DRAGON_HOE || blockId === B.END_DRAGON_BOW);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: (isRainbowItem || isEnch || isSpecialGlint) ? 0.30 : (isChunky ? 0.62 : 0.72),
      metalness: (isRainbowItem || isSpecialGlint) ? 0.28 : ((blockId === B.GOLD_APPLE || blockId === B.GOLDEN_CARROT || blockId === B.TOTEM_UNDYING) ? 0.28 : 0.06),
      emissive: isWarmGlow ? new THREE.Color((blockId === B.WATER_BREATH_POTION || blockId === B.SWIFT_SNEAK_BOOK || blockId === B.SOUL_FLINT_AND_STEEL || blockId === B.SCULK_ECHO_BOW || blockId === B.DEEP_SONIC_BOW || blockId === B.SOUL_HARBINGER_BOW || blockId === B.RESONANT_SWORD || blockId === B.SOULFORGED_SWORD || blockId === B.SCULK_RESONANT_GEM || blockId === B.SCULK_HEART || blockId === B.SOUL_RESONATOR) ? 0x0ea5e9 : (blockId === B.NIGHT_VISION_POTION ? 0x3b82f6 : (blockId === B.DREAM_FRUIT ? 0xec4899 : (blockId === B.GOLD_APPLE || blockId === B.GOLDEN_CARROT || blockId === B.TOTEM_UNDYING ? 0xf59e0b : 0xd97706)))) : new THREE.Color(0x000000),
      emissiveIntensity: isWarmGlow ? 0.08 : 0.0
    });
    if (isRainbowItem) {
      mat.userData = { isRainbowItem: true };
      _rainbowMats.add(mat);
      applyRainbowToMat(mat, _dreamRainbowHue);
    }
    if (isEnch || isSpecialGlint) {
      const gTint = isEnch ? 0xb89cff : ((blockId === B.FIRE_SWORD || blockId === B.DRAGON_BONE_SWORD || blockId === B.DRAGON_BONE_AXE || blockId === B.DRAGON_BONE_PICK || blockId === B.DRAGON_BONE_BOW) ? 0xfcd38d : ((blockId === B.ICHOR_PICK || blockId === B.ICHOR_SWORD || blockId === B.ICHOR_AXE) ? 0xf0a6c5 : 0x7dd3fc));
      _attachSmoothEnchantGlint(mat, gTint, isEnch ? 0.22 : (isRainbowItem ? 0.18 : 0.14));
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.iconReady = usedOfficialIcon || !_vIm;
    if (def.tool === 'rod') {
      const tipMarker = new THREE.Object3D();
      tipMarker.name = 'rodTipMarker';
      tipMarker.position.set(5.7 * px, 6.0 * px, 0);
      mesh.add(tipMarker);
    }
    // Authentic Minecraft First-Person Hand Poses (YXZ + positive ry points blade/pick/axe/bow tip FORWARD into -Z, handle in right hand!)
    mesh.rotation.order = 'YXZ';
    const isForwardShaft = (blockId === B.STICK || blockId === B.SPYGLASS || blockId === B.ARROW);
    if (def.tool === 'sword') {
      // Sword blade thrusts cleanly UP & FORWARD (-Z) angled slightly inward toward crosshair!
      mesh.position.set(-0.02, 0.03, -0.05);
      mesh.rotation.set(-0.06, 1.88, 0.22);
    } else if (def.tool === 'pick') {
      // Pickaxe upright handle in right hand, sharp front pick tine aiming STRAIGHT FORWARD (-Z) at target block!
      mesh.position.set(-0.02, 0.01, -0.05);
      mesh.rotation.set(-0.04, 1.92, 0.30);
    } else if (def.tool === 'axe') {
      // Axe handle in right hand, curved cutting blade facing STRAIGHT FORWARD (-Z) ready to chop!
      mesh.position.set(-0.02, 0.01, -0.05);
      mesh.rotation.set(-0.04, 1.92, 0.28);
    } else if (def.tool === 'shovel') {
      // Shovel spade pointing FORWARD (-Z) & UP!
      mesh.position.set(-0.02, 0.01, -0.05);
      mesh.rotation.set(-0.04, 1.90, 0.26);
    } else if (def.tool === 'bow') {
      // Authentic 3D extruded pixel-art Minecraft Bow: curved stave FORWARD (-Z), string facing player (+Z)!
      mesh.position.set(0.0, 0.01, -0.04);
      mesh.rotation.set(0.06, -1.42, 0.68);
    } else if (def.tool === 'rod') {
      // Minecraft 1P Fishing Rod: full checkered shaft, silver reel & outward hook cleanly framed in view
      mesh.position.set(-0.055, 0.082, -0.048);
      mesh.rotation.set(-0.10, Math.PI - 0.36, 0.06);
      mesh.scale.setScalar(1.06);
    } else if (isForwardShaft) {
      mesh.position.set(-0.01, 0.02, -0.06);
      mesh.rotation.set(-0.05, 1.84, 0.22);
    } else if (def.tool === 'shears') {
      mesh.position.set(-0.045, 0.045, -0.055);
      mesh.rotation.set(-0.06, 2.02, 0.24);
    } else if (def.tool === 'flint_steel') {
      mesh.position.set(0.0, 0.02, -0.04);
      mesh.rotation.set(0.10, -0.40, 0.08);
    } else if (blockId === B.TORCH_BLOCK) {
      mesh.position.set(-0.02, 0.01, -0.06);
      mesh.rotation.set(0.12, -0.35, 0.08);
    } else {
      // Meats, food, buckets, ingots, ores, gems, potions & flowers raised clearly in 1st-person 3/4 view!
      mesh.position.set(0.0, 0.035, -0.03);
      mesh.rotation.set(0.14, -0.42, 0.08);
    }
    return mesh;
  }

  const _heldMcTexCache = new Map();
  function _getHeldMcTex(texKey) {
    if (_heldMcTexCache.has(texKey)) return _heldMcTexCache.get(texKey);
    const im = (typeof _mcTexImgs !== 'undefined') ? _mcTexImgs.get(texKey) : null;
    if (!im || !im.complete || im.naturalWidth <= 0) return null;
    const t = new THREE.Texture(im);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    _heldMcTexCache.set(texKey, t);
    return t;
  }

  function build3DTexturedBlockMesh(blockId) {
    const def = BLOCK_DEF[blockId] || BLOCK_DEF[B.DIRT], geo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const bKey = (typeof BLOCK_ID_TO_KEY !== 'undefined') ? BLOCK_ID_TO_KEY[blockId] : null;
    const bSpec = (!def?.customAtlasTex && bKey && typeof _mcBundle !== 'undefined' && _mcBundle.blocks) ? _mcBundle.blocks[bKey] : null;
    let mesh = null;
    if (bSpec && bSpec.length) {
      const tTop = _getHeldMcTex(bSpec[0]);
      const tSide = _getHeldMcTex(bSpec[1] || bSpec[0]);
      const tFront = _getHeldMcTex(bSpec[2] || bSpec[1] || bSpec[0]);
      const tBot = _getHeldMcTex(bSpec[3] || bSpec[0]);
      if (tTop && tSide && tFront) {
        const mkMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.04, alphaTest: def.glass ? 0.45 : 0, transparent: !!def.glass });
        const mats = [mkMat(tSide), mkMat(tSide), mkMat(tTop), mkMat(tBot || tTop), mkMat(tFront), mkMat(tSide)];
        mesh = new THREE.Mesh(geo, mats);
        mesh.userData.iconReady = true;
      }
    }
    if (!mesh) {
      const uvAttr = geo.attributes.uv;
      const uStep = 1 / ATLAS_COLS, vStep = 1 / ATLAS_ROWS;
      const fTile = def.frontTile !== undefined ? def.frontTile : def.tiles[1];
      const bTile = (def.bothZFront && def.frontTile !== undefined) ? def.frontTile : def.tiles[1];
      const faceTileMap = [def.tiles[1], def.tiles[1], def.tiles[0], def.tiles[2], fTile, bTile];
      for (let f = 0; f < 6; f++) {
        const tile = faceTileMap[f], tx = tile % ATLAS_COLS, ty = Math.floor(tile / ATLAS_COLS);
        const u0 = tx * uStep + 0.002, u1 = (tx + 1) * uStep - 0.002, v0 = ty * vStep + 0.002, v1 = (ty + 1) * vStep - 0.002;
        const base = f * 4;
        uvAttr.setXY(base, u0, v0); uvAttr.setXY(base + 1, u1, v0); uvAttr.setXY(base + 2, u0, v1); uvAttr.setXY(base + 3, u1, v1);
      }
      uvAttr.needsUpdate = true;
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: atlasTex, bumpMap: bumpTex, bumpScale: 0.03, roughness: 0.8, alphaTest: def.glass ? 0.45 : 0 }));
      mesh.userData.iconReady = !bSpec;
    }
    mesh.position.set(0.01, -0.02, -0.04); mesh.rotation.set(0.18, -0.78, 0.08);
    return mesh;
  }

  /** Unified 3D item/block builder used by 1st-person, offhand, 3rd-person, and dropped items. */
  function buildUnified3DItemMesh(blockId, meta = null) {
    const safeId = BLOCK_DEF[blockId] ? blockId : B.DIRT;
    const def = BLOCK_DEF[safeId];
    return build3DSculptedSpecialItem(safeId, meta)
      || ((def.voxelItem || !def.solid) ? build3DVoxelItemMesh(safeId, meta) : build3DTexturedBlockMesh(safeId));
  }

  function updateOffhandViewModel(offId) {
    if (activeOffhandObj) { offhandPivot.remove(activeOffhandObj); activeOffhandObj = null; }
    if (!offId || offId === B.AIR || !BLOCK_DEF[offId]) { offhandPivot.visible = false; return; }
    offhandPivot.visible = (thirdPerson === 0 && !hudHidden);
    const cached = offhandModelCache.get(offId);
    if (!cached || (cached.userData && cached.userData.iconReady === false)) {
      const m = (offId === B.SHIELD) ? build3DShieldMesh(false) : buildUnified3DItemMesh(offId);
      if (offId === B.SHIELD) { m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.userData.iconReady = true; }
      else if (offId === B.TORCH_BLOCK) { m.position.set(0.04, 0.02, -0.05); m.rotation.set(0.14, 0.35, -0.10); }
      else if (offId === B.LANTERN || offId === B.SOUL_LANTERN) { m.position.set(0.03, -0.01, -0.04); m.rotation.set(0.08, 0.45, -0.03); }
      else if (offId === B.TOTEM_UNDYING) { m.rotation.order = 'YXZ'; m.position.set(0.02, 0.01, -0.04); m.rotation.set(0.10, 0.42, -0.06); }
      if (!m.userData || m.userData.iconReady !== false) offhandModelCache.set(offId, m);
      activeOffhandObj = m;
    } else {
      activeOffhandObj = cached;
    }
    offhandPivot.add(activeOffhandObj);
  }

  function _attachSmoothEnchantGlint(mat, tintHex = 0xb89cff, strength = 0.20) {
    if (!mat) return mat;
    mat.customProgramCacheKey = () => 'nucraft_enchant_glint_v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGlintTime = envUniforms.uTime;
      shader.uniforms.uGlintTint = { value: new THREE.Color(tintHex) };
      shader.uniforms.uGlintStr = { value: strength };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGlintPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGlintPos = transformed;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uGlintTime, uGlintStr;\nuniform vec3 uGlintTint;\nvarying vec3 vGlintPos;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{\n  float w1 = pow(0.5 + 0.5 * sin(vGlintPos.x * 16.0 + vGlintPos.y * 22.0 - uGlintTime * 1.45), 4.0);\n  float w2 = pow(0.5 + 0.5 * sin(vGlintPos.x * 20.0 - vGlintPos.y * 14.0 - uGlintTime * 1.15), 4.0);\n  float shimmer = (0.28 + 0.72 * clamp(w1 * 0.65 + w2 * 0.45, 0.0, 1.0)) * uGlintStr;\n  totalEmissiveRadiance += uGlintTint * shimmer;\n}');
    };
    return mat;
  }

  function _itemMetaCacheKey(blockId, meta) {
    if (!blockId) return 0;
    let k = String(blockId);
    if (meta && typeof meta.bowStage === 'number' && meta.bowStage > 0) k += `:bs${meta.bowStage}`;
    if (meta && meta.rodCast) k += ':rc';
    if (meta && meta.ench) k += ':e';
    const t = meta && meta.trim;
    if (t && t.pattern) k += `:${t.pattern}:${t.matId || t.hex || ''}`;
    return k === String(blockId) ? blockId : k;
  }

  let _fpEmptySkin = '';
  let _fpToolArmWrap = null;
  let _fpToolArmSkin = '';

  const _FP_TOOL_MOUNTS = {
    sword:   { px: 0.00, py: 0.014, pz: -0.008, rx: 0.06, ry: -0.46, rz: 0.12, sc: 1.18 },
    pick:    { px: 0.00, py: 0.012, pz: -0.008, rx: 0.08, ry: -1.14, rz: 0.10, sc: 1.14 },
    axe:     { px: 0.00, py: 0.012, pz: -0.008, rx: 0.08, ry: -1.16, rz: 0.12, sc: 1.14 },
    shovel:  { px: 0.00, py: 0.018, pz: -0.006, rx: 0.06, ry: -0.28, rz: 0.08, sc: 1.14 },
    hoe:     { px: 0.00, py: 0.012, pz: -0.008, rx: 0.06, ry: -1.10, rz: 0.10, sc: 1.14 },
    rod:     { px: 0.00, py: 0.010, pz: -0.008, rx: 0.06, ry: -1.05, rz: 0.12, sc: 1.08 },
    shears:  { px: 0.00, py: 0.010, pz: -0.008, rx: 0.06, ry: -1.05, rz: 0.12, sc: 1.06 },
    trident: { px: 0.00, py: 0.020, pz: -0.006, rx: 0.06, ry: -0.32, rz: 0.08, sc: 1.12 }
  };

  function updateHeldViewModel(blockId, meta = null) {
    const _skinNow = String((typeof window !== 'undefined' && window.selectedSkinId) || 'steve');
    if (_skinNow !== _fpEmptySkin) {
      heldModelCache.delete(0);
      _fpEmptySkin = _skinNow;
    }
    const _heldKey = _itemMetaCacheKey(blockId || 0, meta);
    const idChanged = (typeof player !== 'undefined' && player && (player._lastHeldId || 0) !== (blockId || 0));
    const keyChanged = (typeof player !== 'undefined' && player && player._lastHeldKey !== _heldKey);
    const _defHeld = (blockId && BLOCK_DEF[blockId]) ? BLOCK_DEF[blockId] : null;
    const _isTrident = !!(B.TRIDENT && blockId === B.TRIDENT);
    const _toolType = _isTrident ? 'trident' : (_defHeld && _defHeld.tool ? _defHeld.tool : '');
    const _showToolArm = !!(_toolType && _toolType !== 'bow' && _toolType !== 'rod' && _toolType !== 'flint_steel' && blockId !== B.SHIELD);
    if (keyChanged) {
      player._lastHeldId = blockId || 0;
      player._lastHeldKey = _heldKey;
      if (idChanged) {
        player.equipPopT = 1.0; // Smooth Afterswing pull-out flourish
        const swDef = (blockId && BLOCK_DEF[blockId]) ? BLOCK_DEF[blockId] : null;
        const cdMax = typeof getWeaponAttackCooldown === 'function' ? getWeaponAttackCooldown(swDef) : 0.45;
        player.atkCdMax = cdMax;
        player.atkCd = cdMax;
        if (!(swDef && swDef.tool === 'sword')) { player.swordCombo = 0; player.comboResetT = 0; }
      }
    }
    if (_showToolArm) {
      if (!_fpToolArmWrap || _fpToolArmSkin !== _skinNow) {
        if (_fpToolArmWrap) heldPivot.remove(_fpToolArmWrap);
        _fpToolArmWrap = buildToolArmMesh();
        _fpToolArmWrap.position.set(0.016, -0.022, 0.012);
        _fpToolArmWrap.rotation.set(1.76, -0.34, 0.14);
        _fpToolArmSkin = _skinNow;
        heldPivot.add(_fpToolArmWrap);
      }
      _fpToolArmWrap.visible = true;
    } else if (_fpToolArmWrap) {
      _fpToolArmWrap.visible = false;
    }
    if (!keyChanged && activeHeldObj && (!activeHeldObj.userData || activeHeldObj.userData.iconReady !== false)) {
      if (typeof invPreviewRig !== 'undefined' && invPreviewRig && typeof setRigHeldItem === 'function') {
        setRigHeldItem(invPreviewRig, blockId || 0, meta);
      }
      return;
    }
    if (activeHeldObj) {
      if (activeHeldObj.parent) activeHeldObj.parent.remove(activeHeldObj);
      activeHeldObj = null;
    }
    if (typeof playerAvatar !== 'undefined' && playerAvatar && typeof setRigHeldItem === 'function') {
      setRigHeldItem(playerAvatar, blockId || 0, meta);
    }
    if (typeof invPreviewRig !== 'undefined' && invPreviewRig && typeof setRigHeldItem === 'function') {
      setRigHeldItem(invPreviewRig, blockId || 0, meta);
    }
    if (!blockId || blockId === B.AIR || !_defHeld) {
      vmWeaponMount.position.set(0, 0, 0);
      vmWeaponMount.rotation.set(0, 0, 0);
      vmWeaponMount.scale.setScalar(1);
      if (!heldModelCache.has(0)) heldModelCache.set(0, buildEmptyHandMesh());
      activeHeldObj = heldModelCache.get(0);
      vmWeaponMount.add(activeHeldObj);
      return;
    }
    const cached = heldModelCache.get(_heldKey);
    if (!cached || (cached.userData && cached.userData.iconReady === false)) {
      const built = buildUnified3DItemMesh(blockId, meta);
      if (!built.userData || built.userData.iconReady !== false) heldModelCache.set(_heldKey, built);
      activeHeldObj = built;
    } else {
      activeHeldObj = cached;
    }
    const tm = _showToolArm ? _FP_TOOL_MOUNTS[_toolType] : null;
    if (tm) {
      // Align (-7,-7)->(+7,+7) diagonal sprite straight UP (+Y) with handle centered inside fist (0,0,0)
      activeHeldObj.rotation.order = 'YXZ';
      activeHeldObj.position.set(0, 0.172, 0);
      activeHeldObj.rotation.set(0, 0, Math.PI * 0.25);
      vmWeaponMount.position.set(tm.px, tm.py, tm.pz);
      vmWeaponMount.rotation.set(tm.rx, tm.ry, tm.rz);
      vmWeaponMount.scale.setScalar(tm.sc);
    } else {
      vmWeaponMount.position.set(0, 0, 0);
      vmWeaponMount.rotation.set(0, 0, 0);
      vmWeaponMount.scale.setScalar(1);
    }
    vmWeaponMount.add(activeHeldObj);
  }

  // Single-Draw-Call True World-Space Ambient Air Motes / Fireflies (never dragged along with player!)
  const _moteCount = _initMobile ? 28 : 48;
  const airMotes = Array.from({ length: _moteCount }, (_, i) => ({
    wx: 0, wy: 0, wz: 0, init: false,
    sp: 0.45 + Math.random() * 0.85, ph: Math.random() * 6.28,
    isPink: (i % 3 === 0), isCyan: (i % 3 === 1)
  }));
  const _motePosArr = new Float32Array(_moteCount * 3);
  const _moteColArr = new Float32Array(_moteCount * 3);
  const _moteGeo = new THREE.BufferGeometry();
  _moteGeo.setAttribute('position', new THREE.BufferAttribute(_motePosArr, 3));
  _moteGeo.setAttribute('color', new THREE.BufferAttribute(_moteColArr, 3));
  const _moteTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(8, 8, 0.5, 8, 8, 7.5);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.72)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 16, 16);
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  })();
  const _moteMat = new THREE.PointsMaterial({ map: _moteTex, size: 0.085, vertexColors: true, transparent: true, opacity: 0.58, alphaTest: 0.04, sizeAttenuation: true, depthWrite: false });
  const _motePoints = new THREE.Points(_moteGeo, _moteMat);
  _motePoints.frustumCulled = false;
  scene.add(_motePoints);
  let _lastMoteMode = '';
  function updateAirMotesBatch(dt, show, mode) {
    _motePoints.visible = show;
    if (!show) return;
    _moteMat.opacity = mode === 'underwater' ? 0.50 : ((mode === 'sift' || mode === 'golden') ? 0.62 : 0.52);
    _moteMat.size = mode === 'underwater' ? 0.06 : ((mode === 'golden' || mode === 'night') ? 0.095 : 0.075);
    const needCol = (mode !== _lastMoteMode || mode === 'night' || mode === 'golden');
    const px = player.x, py = player.y, pz = player.z;
    for (let i = 0; i < _moteCount; i++) {
      const m = airMotes[i], b = i * 3;
      const distCam = m.init ? Math.hypot(m.wx - px, m.wy - (py + 1.4), m.wz - pz) : 99;
      if (!m.init || distCam < 2.4 || Math.abs(m.wx - px) > 26 || Math.abs(m.wz - pz) > 26 || Math.abs(m.wy - py) > 16) {
        let ox = (Math.random() - 0.5) * 44, oz = (Math.random() - 0.5) * 44;
        if (Math.hypot(ox, oz) < 3.0) { ox += (ox >= 0 ? 3.2 : -3.2); oz += (oz >= 0 ? 3.2 : -3.2); }
        m.wx = px + ox;
        m.wz = pz + oz;
        m.wy = py + (Math.random() - 0.22) * 10;
        m.init = true;
      }
      m.ph += dt * m.sp;
      if (mode === 'sift') {
        m.wy += dt * 0.28 * m.sp;
        if (needCol) {
          if (m.isPink) { _moteColArr[b] = 1.0; _moteColArr[b + 1] = 0.55; _moteColArr[b + 2] = 0.85; }
          else if (m.isCyan) { _moteColArr[b] = 0.42; _moteColArr[b + 1] = 0.96; _moteColArr[b + 2] = 0.96; }
          else { _moteColArr[b] = 1.0; _moteColArr[b + 1] = 0.92; _moteColArr[b + 2] = 0.60; }
        }
      } else if (mode === 'nether_warped' || mode === 'nether_crimson') {
        m.wy += dt * 0.48 * m.sp;
        if (needCol) {
          if (mode === 'nether_warped') { _moteColArr[b] = 0.18; _moteColArr[b + 1] = 0.83; _moteColArr[b + 2] = 0.75; }
          else { _moteColArr[b] = 1.0; _moteColArr[b + 1] = 0.48; _moteColArr[b + 2] = 0.16; }
        }
      } else if (mode === 'end') {
        m.wy += Math.sin(m.ph) * dt * 0.35;
        if (needCol) { _moteColArr[b] = 0.91; _moteColArr[b + 1] = 0.47; _moteColArr[b + 2] = 0.98; }
      } else if (mode === 'underwater') {
        m.wy += dt * 0.22 * m.sp;
        if (needCol) { _moteColArr[b] = 0.78; _moteColArr[b + 1] = 0.96; _moteColArr[b + 2] = 1.00; }
      } else if (mode === 'golden') {
        m.wy += Math.sin(m.ph * 1.1) * dt * 0.25;
        const g = 0.55 + 0.45 * Math.abs(Math.sin(m.ph * 1.8));
        _moteColArr[b] = 1.0 * g; _moteColArr[b + 1] = 0.86 * g; _moteColArr[b + 2] = 0.36 * g;
      } else if (mode === 'night') {
        m.wy += Math.sin(m.ph) * dt * 0.30;
        const p = 0.45 + 0.55 * Math.abs(Math.sin(m.ph * 2.2));
        _moteColArr[b] = 0.78 * p; _moteColArr[b + 1] = 0.96 * p; _moteColArr[b + 2] = 0.42 * p;
      } else if (mode === 'autumn') {
        m.wy -= dt * 0.52 * m.sp;
        if (needCol) {
          if (m.isPink) { _moteColArr[b] = 0.98; _moteColArr[b + 1] = 0.45; _moteColArr[b + 2] = 0.09; }
          else { _moteColArr[b] = 0.98; _moteColArr[b + 1] = 0.80; _moteColArr[b + 2] = 0.08; }
        }
      } else {
        m.wy -= dt * 0.20 * m.sp;
        if (needCol) {
          if (m.isPink) { _moteColArr[b] = 1.0; _moteColArr[b + 1] = 0.75; _moteColArr[b + 2] = 0.86; }
          else { _moteColArr[b] = 1.0; _moteColArr[b + 1] = 0.95; _moteColArr[b + 2] = 0.69; }
        }
      }
      _motePosArr[b]     = m.wx + Math.sin(m.ph) * 0.65;
      _motePosArr[b + 1] = m.wy + Math.cos(m.ph * 1.3) * 0.35;
      _motePosArr[b + 2] = m.wz + Math.cos(m.ph * 0.9) * 0.65;
    }
    _moteGeo.attributes.position.needsUpdate = true;
    if (needCol) {
      _lastMoteMode = mode;
      _moteGeo.attributes.color.needsUpdate = true;
    }
  }
  window.__getAirMotesWorld = () => airMotes.map(m => ({ wx: m.wx, wy: m.wy, wz: m.wz, init: m.init }));

  // Single-Draw-Call Smooth Luminous Firefly Portal Particles (Nether Purple, Dream 7-Color, Warden Cyan)
  const _pMoteCount = _initMobile ? 42 : 72;
  const _pMotePosArr = new Float32Array(_pMoteCount * 3);
  const _pMoteColArr = new Float32Array(_pMoteCount * 3);
  const _pMoteGeo = new THREE.BufferGeometry();
  _pMoteGeo.setAttribute('position', new THREE.BufferAttribute(_pMotePosArr, 3));
  _pMoteGeo.setAttribute('color', new THREE.BufferAttribute(_pMoteColArr, 3));
  const _fireflyTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(16, 16, 0.5, 16, 16, 15.5);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.88)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.28)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  })();
  const _portalMoteMat = new THREE.PointsMaterial({
    map: _fireflyTex, size: 0.22, vertexColors: true, transparent: true, opacity: 0.92,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
  });
  const _portalMotePoints = new THREE.Points(_pMoteGeo, _portalMoteMat);
  _portalMotePoints.frustumCulled = false;
  _portalMotePoints.visible = false;
  scene.add(_portalMotePoints);

  const _PORTAL_RAINBOW_7 = [
    [1.00, 0.32, 0.38], [1.00, 0.62, 0.22], [1.00, 0.92, 0.30],
    [0.32, 0.98, 0.52], [0.22, 0.92, 1.00], [0.38, 0.58, 1.00], [0.82, 0.42, 1.00]
  ];
  const _PORTAL_NETHER_PAL = [[0.78, 0.36, 1.00], [0.92, 0.48, 1.00], [0.65, 0.24, 0.98]];
  const _PORTAL_WARDEN_PAL = [[0.14, 0.92, 0.98], [0.06, 0.78, 0.86], [0.38, 1.00, 0.98], [0.12, 0.84, 0.76]];
  const _portalMotes = Array.from({ length: _pMoteCount }, (_, i) => ({
    u: i / _pMoteCount, dur: 2.4 + Math.random() * 1.8,
    ax: 0, ay: 0, az: 0, kind: 0, init: false,
    ang0: Math.random() * 6.283, angSp: (Math.random() < 0.5 ? 1 : -1) * (0.9 + Math.random() * 1.1),
    startR: 1.3 + Math.random() * 2.1, orbitR: 0.65 + Math.random() * 2.15,
    yOff: (Math.random() - 0.5) * 1.8, yBob: 0.25 + Math.random() * 0.45,
    ph: Math.random() * 6.283, pulseSp: 3.2 + Math.random() * 2.8, palIdx: i
  }));
  const _nearPortalBuf = [];
  let _nearPortalScanAcc = 99;
  function updatePortalMotes(dt, tNow) {
    if (typeof chunks === 'undefined' || typeof player === 'undefined' || (typeof sodiumOpts !== 'undefined' && sodiumOpts.particles === false)) {
      if (_portalMotePoints.visible) _portalMotePoints.visible = false;
      return;
    }
    _nearPortalScanAcc += dt;
    if (_nearPortalScanAcc >= 0.25) {
      _nearPortalScanAcc = 0;
      _nearPortalBuf.length = 0;
      const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const ch = chunks.get(chunkKey(pcx + dx, pcz + dz));
        if (!ch || !ch.portalNodes || ch.portalNodes.length === 0) continue;
        for (let ni = 0; ni < ch.portalNodes.length; ni++) {
          const pn = ch.portalNodes[ni];
          const ddx = pn.x - player.x, ddy = pn.y - player.y, ddz = pn.z - player.z;
          if (ddx * ddx + ddy * ddy + ddz * ddz <= 784) _nearPortalBuf.push(pn);
        }
      }
    }
    if (_nearPortalBuf.length === 0) {
      if (_portalMotePoints.visible) _portalMotePoints.visible = false;
      return;
    }
    _portalMotePoints.visible = true;
    for (let i = 0; i < _pMoteCount; i++) {
      const m = _portalMotes[i], b = i * 3;
      m.u += dt / m.dur;
      const ddx = m.ax - player.x, ddz = m.az - player.z;
      if (!m.init || m.u >= 1.0 || ddx * ddx + ddz * ddz > 1024) {
        const src = _nearPortalBuf[(Math.random() * _nearPortalBuf.length) | 0];
        m.ax = src.x; m.ay = src.y; m.az = src.z; m.kind = src.kind;
        m.u = m.init ? 0.0 : (i / _pMoteCount);
        m.dur = 2.2 + Math.random() * 2.0;
        m.ang0 = Math.random() * 6.283;
        m.angSp = (Math.random() < 0.5 ? 1 : -1) * (0.85 + Math.random() * 1.15);
        m.startR = 1.3 + Math.random() * 2.1;
        m.orbitR = 0.65 + Math.random() * 2.15;
        m.yOff = (Math.random() - 0.5) * 1.8;
        m.yBob = 0.25 + Math.random() * 0.45;
        m.init = true;
      }
      const isInward = ((i & 1) === 0);
      const u = m.u;
      const ang = m.ang0 + m.angSp * u * 3.1 + Math.sin(tNow * 1.1 + m.ph) * 0.25;
      const rad = isInward ? (m.startR * Math.pow(Math.max(0, 1 - u), 1.35)) : (m.orbitR + Math.sin(u * 6.283 + m.ph) * 0.32);
      const dy = isInward ? (m.yOff * (1 - u) + Math.sin(u * 6.283 + m.ph) * 0.25) : (m.yOff * 0.65 + Math.sin(tNow * 1.6 + m.ph) * m.yBob);
      _pMotePosArr[b]     = m.ax + Math.cos(ang) * rad;
      _pMotePosArr[b + 1] = m.ay + dy;
      _pMotePosArr[b + 2] = m.az + Math.sin(ang) * rad;

      const glow = Math.sin(u * Math.PI) * (0.55 + 0.45 * Math.sin(tNow * m.pulseSp + m.ph));
      if (m.kind === 1) {
        const ph7 = ((m.palIdx + tNow * 0.85) % 7 + 7) % 7;
        const i0 = ph7 | 0, i1 = (i0 + 1) % 7, f7 = ph7 - i0;
        const c0 = _PORTAL_RAINBOW_7[i0], c1 = _PORTAL_RAINBOW_7[i1];
        _pMoteColArr[b]     = (c0[0] + (c1[0] - c0[0]) * f7) * glow;
        _pMoteColArr[b + 1] = (c0[1] + (c1[1] - c0[1]) * f7) * glow;
        _pMoteColArr[b + 2] = (c0[2] + (c1[2] - c0[2]) * f7) * glow;
      } else {
        const pal = m.kind === 3 ? _PORTAL_WARDEN_PAL[(m.palIdx + i) % 4] : _PORTAL_NETHER_PAL[(m.palIdx + i) % 3];
        _pMoteColArr[b]     = pal[0] * glow;
        _pMoteColArr[b + 1] = pal[1] * glow;
        _pMoteColArr[b + 2] = pal[2] * glow;
      }
    }
    _pMoteGeo.attributes.position.needsUpdate = true;
    _pMoteGeo.attributes.color.needsUpdate = true;
  }

  // Authentic Merlin1809 Eclipse-Shader 2-Tier Ultra-Dense Thin Tapered Procedural Grass (225 blades/m² near + 81 far)
  const _isLiteGrass = (_isMobilePerf || (_hwProfile && _hwProfile.gpu && _hwProfile.gpu.isSoftware));
  const ECLIPSE_GRASS_NEAR_MAX = (_isMobilePerf || _isLiteGrass) ? 560 : 1250;
  const ECLIPSE_GRASS_FAR_MAX  = _isMobilePerf ? 1600 : (_isLiteGrass ? 2600 : 4800);
  function _buildEclipseGrassGeo(cols, tiers, widthScale) {
    const pos = [], bladeH = [], bladeSide = [], bladeRand = [], idx = [];
    let vc = 0;
    const halton = (i, base) => {
      let f = 1, r = 0, n = i;
      while (n > 0) { f /= base; r += f * (n % base); n = Math.floor(n / base); }
      return r;
    };
    const BLADES = cols * cols;
    const cellSpan = 0.97 / cols;
    for (let b = 0; b < BLADES; b++) {
      const gx = b % cols, gz = Math.floor(b / cols);
      const ox = Math.max(-0.485, Math.min(0.485, -0.485 + (gx + 0.5) * cellSpan + (halton(b + 1, 2) - 0.5) * cellSpan * 0.82));
      const oz = Math.max(-0.485, Math.min(0.485, -0.485 + (gz + 0.5) * cellSpan + (halton(b + 1, 3) - 0.5) * cellSpan * 0.82));
      const rdx = (halton(b + 11, 5) + halton(b + 17, 7)) - 1.0;
      const rdz = (halton(b + 13, 11) + halton(b + 19, 13)) - 1.0;
      const hVar = 0.78 + halton(b + 5, 17) * 0.46;
      const baseV = vc;
      for (let t = 0; t < tiers.length; t++) {
        pos.push(ox, 0.0, oz);
        bladeH.push(tiers[t]); bladeSide.push(-1.0); bladeRand.push(rdx, rdz, hVar, widthScale);
        pos.push(ox, 0.0, oz);
        bladeH.push(tiers[t]); bladeSide.push(1.0); bladeRand.push(rdx, rdz, hVar, widthScale);
        vc += 2;
      }
      pos.push(ox, 0.0, oz);
      bladeH.push(1.0); bladeSide.push(0.0); bladeRand.push(rdx, rdz, hVar, widthScale);
      vc += 1;
      for (let t = 0; t < tiers.length - 1; t++) {
        const r0 = baseV + t * 2, r1 = r0 + 2;
        idx.push(r0, r0 + 1, r1 + 1, r0, r1 + 1, r1);
      }
      const topR = baseV + (tiers.length - 1) * 2;
      idx.push(topR, topR + 1, topR + 2);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aBladeH', new THREE.Float32BufferAttribute(bladeH, 1));
    g.setAttribute('aBladeSide', new THREE.Float32BufferAttribute(bladeSide, 1));
    g.setAttribute('aBladeRand', new THREE.Float32BufferAttribute(bladeRand, 4));
    g.setIndex(idx);
    g.instanceCount = 0;
    return g;
  }
  function _makeEgInstanceBuffers(geo, maxCnt) {
    const pos = new Float32Array(maxCnt * 4), col = new Float32Array(maxCnt * 4), side = new Float32Array(maxCnt * 4), ao = new Float32Array(maxCnt);
    const posAttr = new THREE.InstancedBufferAttribute(pos, 4), colAttr = new THREE.InstancedBufferAttribute(col, 4), sideAttr = new THREE.InstancedBufferAttribute(side, 4), aoAttr = new THREE.InstancedBufferAttribute(ao, 1);
    if (typeof THREE.DynamicDrawUsage !== 'undefined') {
      [posAttr, colAttr, sideAttr, aoAttr].forEach(a => { if (a.setUsage) a.setUsage(THREE.DynamicDrawUsage); });
    }
    geo.setAttribute('aInstPos', posAttr);
    geo.setAttribute('aInstCol', colAttr);
    geo.setAttribute('aInstSide', sideAttr);
    geo.setAttribute('aInstAo', aoAttr);
    return { maxCnt, pos, col, side, ao, posAttr, colAttr, sideAttr, aoAttr, geo };
  }
  const grassInstGeoNear = _buildEclipseGrassGeo((_isMobilePerf || _isLiteGrass) ? 10 : 15, [0.0, 0.33, 0.66], 1.0);
  const grassInstGeoFar  = _buildEclipseGrassGeo(_isMobilePerf ? 6 : 9, [0.0, 0.50], 1.28);
  const _egNear = _makeEgInstanceBuffers(grassInstGeoNear, ECLIPSE_GRASS_NEAR_MAX);
  const _egFar  = _makeEgInstanceBuffers(grassInstGeoFar,  ECLIPSE_GRASS_FAR_MAX);

  const eclipseGrassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength,
      uPlayerPos: envUniforms.uPlayerPos, uGrassRadius: envUniforms.uGrassRadius,
      uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uSkyTop: envUniforms.uSkyTop, uFogColor: envUniforms.uFogColor,
      uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uReflClipY: envUniforms.uReflClipY, uInLava: envUniforms.uInLava,
      uRayTracing: envUniforms.uRayTracing, uRtVoxelTex: envUniforms.uRtVoxelTex,
      uRtOrigin: envUniforms.uRtOrigin, uRtQuality: envUniforms.uRtQuality
    },
    vertexShader: `
      attribute float aBladeH;
      attribute float aBladeSide;
      attribute vec4 aBladeRand;
      attribute vec4 aInstPos;
      attribute vec4 aInstCol;
      attribute vec4 aInstSide;
      attribute float aInstAo;
      uniform float uTime, uWindStrength, uGrassRadius;
      uniform vec3 uPlayerPos;
      varying vec3 vCol, vWPos;
      varying float vBladeH, vHeightFade, vSide, vDist, vSkyAo, vGust;
      vec2 calcWave(vec3 pos) {
        const float PI48 = 150.796447372;
        float pi2wt = PI48 * uTime;
        float magnitude = abs(sin(dot(vec4(uTime, pos), vec4(1.0, 0.005, 0.005, 0.005))) * 0.5 + 0.72) * 0.013;
        return (sin(pi2wt * vec2(0.0063, 0.0015) * 4.0 - pos.xz + pos.y * 0.05) + 0.1) * magnitude;
      }
      vec3 calcMovePlants(vec3 pos) {
        vec2 m = calcWave(pos);
        return vec3(m.x, -length(m), m.y) * 5.0 * uWindStrength;
      }
      void main() {
        float c = cos(aInstCol.w), s = sin(aInstCol.w);
        vec3 rotOff = vec3(position.x * c - position.z * s, 0.0, position.x * s + position.z * c);
        vec3 rootPos = aInstPos.xyz + rotOff;
        float distXZ = length(rootPos.xz - uPlayerPos.xz);
        float distFade = 1.0 - smoothstep(uGrassRadius * 0.72, uGrassRadius, distXZ);
        if (distFade <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

        vec4 sideCheck = aInstSide;
        float eastH  = clamp(abs(sideCheck.x) * abs(rotOff.x + 0.5), 0.0, 1.0);
        float westH  = clamp(abs(sideCheck.y) * abs(rotOff.x - 0.5), 0.0, 1.0);
        float southH = clamp(abs(sideCheck.z) * abs(rotOff.z + 0.5), 0.0, 1.0);
        float northH = clamp(abs(sideCheck.w) * abs(rotOff.z - 0.5), 0.0, 1.0);
        eastH  *= eastH  * sign(sideCheck.x);
        westH  *= westH  * sign(sideCheck.y);
        southH *= southH * sign(sideCheck.z);
        northH *= northH * sign(sideCheck.w);
        float totalHeightMult = 0.5 * clamp(eastH + westH + southH + northH, -1.0, 1.0) + 1.0;
        if (abs(sideCheck.x) > 1.5) eastH = 0.0;
        if (abs(sideCheck.y) > 1.5) westH = 0.0;
        if (abs(sideCheck.z) > 1.5) southH = 0.0;
        if (abs(sideCheck.w) > 1.5) northH = 0.0;
        vec2 edgeBlend = eastH * vec2(-0.17, 0.0) + westH * vec2(0.17, 0.0) + southH * vec2(0.0, -0.17) + northH * vec2(0.0, 0.17);

        float grassH = aBladeH;
        float grassCurvature = smoothstep(0.0, 1.0, grassH);
        float clump = 0.88 + 0.24 * sin(rootPos.x * 0.62 + cos(rootPos.z * 0.58) * 1.4);
        float bladeLenY = 0.56 * clump * totalHeightMult * aInstPos.w * aBladeRand.z * distFade;
        vec3 toCam = rootPos - cameraPosition;
        float camDist = length(toCam);
        vec3 viewCam = toCam / max(camDist, 1e-4);
        vec3 rightDir = normalize(cross(vec3(0.0, 1.0, 0.0), viewCam) + vec3(1e-5, 0.0, 0.0));
        float tierStep = floor(grassH * 3.0 + 0.15);
        float taper = aBladeSide * pow(0.74, tierStep);
        float halfThick = (0.0132 + min(camDist, 38.0) * 0.00052) * aBladeRand.w * aInstPos.w;

        vec3 wp = rootPos;
        wp.y += grassH * bladeLenY - 0.015;
        vec2 offsetXZ = wp.xz - uPlayerPos.xz;
        float playerDist = smoothstep(0.5, 0.05, length(offsetXZ)) * smoothstep(1.2, 0.15, abs(wp.y - uPlayerPos.y));
        vec2 dir2 = length(offsetXZ) > 1e-4 ? normalize(offsetXZ) : vec2(0.0);
        wp.xz += 0.7 * playerDist * dir2 * grassCurvature;

        vec2 rndRotated = vec2(aBladeRand.x * c - aBladeRand.y * s, aBladeRand.x * s + aBladeRand.y * c);
        wp.xz += grassCurvature * (0.5 * rndRotated * 0.30 + edgeBlend);
        vec3 windMove = 1.6 * calcMovePlants(rootPos) * grassCurvature * grassCurvature;
        wp += windMove;
        wp += rightDir * (taper * halfThick);

        vCol = aInstCol.rgb;
        vWPos = wp;
        vBladeH = grassH;
        vHeightFade = smoothstep(-0.35, 1.0, grassH);
        vSide = aBladeSide;
        vSkyAo = aInstAo;
        vGust = clamp(length(windMove.xz) * 7.5, 0.0, 1.0);
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uSunDir, uSunColor, uSkyTop, uFogColor;
      uniform float uTime, uFogStart, uFogEnd, uReflClipY, uInLava, uRayTracing;
      varying vec3 vCol, vWPos;
      varying float vBladeH, vHeightFade, vSide, vDist, vSkyAo, vGust;
      ${RT_DDA_GLSL}
      void main() {
        if (vWPos.y < uReflClipY) discard;
        vec3 sDir = normalize(uSunDir);
        vec3 vDir = normalize(vWPos - cameraPosition);
        float sunUp = smoothstep(-0.08, 0.28, sDir.y);
        float rtFadeG = 0.0;
        vec3 rtShG = vec3(1.0);
        float rtShLumG = 1.0;
        if (uRayTracing > 0.5 && sunUp > 0.02) {
          float maxGrassRtD = (uRtQuality > 0.5) ? 30.0 : 16.0;
          if (vDist < maxGrassRtD) {
            rtFadeG = rtInVol(vWPos) * (1.0 - smoothstep(maxGrassRtD * 0.68, maxGrassRtD, vDist));
            if (rtFadeG > 0.01) {
              float rtShDG = 24.0;
              rtShG = rtTraceSunShadow(vWPos, vec3(0.0, 1.0, 0.0), sDir, rtShDG);
              rtShLumG = dot(rtShG, vec3(0.3333));
            }
          }
        }
        float warmAmt = smoothstep(0.08, 0.34, vCol.r - vCol.g);
        vec3 rootMul = mix(vec3(0.42, 0.48, 0.34), vec3(0.68, 0.48, 0.24), warmAmt);
        vec3 midMul  = mix(vec3(0.90, 0.94, 0.86), vec3(1.00, 0.92, 0.80), warmAmt);
        vec3 tipMul  = mix(vec3(1.02, 1.05, 0.94), vec3(1.08, 1.00, 0.86), warmAmt);
        vec3 grad = vBladeH < 0.45 ? mix(rootMul, midMul, vBladeH / 0.45) : mix(midMul, tipMul, (vBladeH - 0.45) / 0.55);
        float spine = 1.0 - abs(vSide) * 0.20;
        vec3 albedo = vCol * grad * spine;
        float cloudDapple = 0.88 + 0.12 * sin(vWPos.x * 0.09 + uTime * 0.22) * cos(vWPos.z * 0.08 - uTime * 0.17);
        vec3 skyHemi = mix(vec3(0.12, 0.16, 0.24), uSkyTop * 0.42 + vec3(0.46), sunUp) * mix(0.55, 1.0, vSkyAo) * mix(1.0, 0.58 + 0.42 * rtShLumG, rtFadeG);
        vec3 sunDirect = uSunColor * (0.48 * sunUp * vSkyAo) * mix(vec3(1.0), rtShG, rtFadeG * 0.94) * (1.0 + 0.18 * rtFadeG * rtShLumG);
        float sssFwd = pow(max(dot(vDir, sDir), 0.0), 3.0) * 0.42 * smoothstep(0.15, 1.0, vHeightFade) * sunUp * vSkyAo * mix(1.0, rtShLumG, rtFadeG * 0.92);
        float gustSheen = vGust * smoothstep(0.35, 1.0, vBladeH) * 0.10 * sunUp * vSkyAo * mix(1.0, rtShLumG, rtFadeG * 0.90);
        float tipRim = smoothstep(0.55, 1.0, vBladeH) * (1.0 - abs(vSide)) * 0.04 * sunUp * vSkyAo * mix(1.0, rtShLumG, rtFadeG * 0.90);
        vec3 sunBal = mix(uSunColor, vec3(1.0), 0.40);
        vec3 litCol = albedo * (skyHemi + sunDirect) * cloudDapple + albedo * sunBal * (sssFwd + gustSheen) + sunBal * tipRim;
        float fogF = smoothstep(uFogStart, uFogEnd, vDist);
        float sunSc = pow(max(dot(vDir, sDir.y > -0.05 ? sDir : -sDir), 0.0), 4.2) * (sDir.y > -0.05 ? sunUp : 0.35);
        vec3 fogCol = mix(uFogColor * 0.92, min(uSunColor * 1.05, vec3(1.0, 0.91, 0.78)), sunSc * 0.46);
        if (uInLava > 0.5) {
          gl_FragColor = vec4(mix(litCol * vec3(1.10, 0.54, 0.30), uFogColor, clamp(smoothstep(0.30, 3.05, vDist), 0.0, 0.995)), 1.0);
        } else {
          gl_FragColor = vec4(mix(litCol, fogCol, fogF), 1.0);
        }
      }`
  });
  const eclipseGrassMesh = new THREE.Mesh(grassInstGeoNear, eclipseGrassMat);
  eclipseGrassMesh.frustumCulled = false;
  eclipseGrassMesh.visible = false;
  scene.add(eclipseGrassMesh);
  const eclipseGrassFarMesh = new THREE.Mesh(grassInstGeoFar, eclipseGrassMat);
  eclipseGrassFarMesh.frustumCulled = false;
  eclipseGrassFarMesh.visible = false;
  scene.add(eclipseGrassFarMesh);

  let _egLastX = 1e9, _egLastZ = 1e9, _egLastDim = '', _egLastNearCount = 0, _egLastFarCount = 0;
  const _egBiomeCache = new Map();
  function getEclipseGrassCount() {
    return (eclipseGrassMesh.visible ? _egLastNearCount : 0) + (eclipseGrassFarMesh.visible ? _egLastFarCount : 0);
  }
  function getEclipseGrassColorStats() {
    let warmAutumn = 0, dream = 0, green = 0;
    for (const [vis, buf, cnt] of [
      [eclipseGrassMesh.visible, _egNear.col, _egLastNearCount],
      [eclipseGrassFarMesh.visible, _egFar.col, _egLastFarCount]
    ]) {
      if (!vis) continue;
      for (let i = 0; i < cnt; i++) {
        const o = i * 4;
        const r = buf[o], g = buf[o + 1], b = buf[o + 2];
        if (b > 0.45) dream++;
        else if (r > 0.60 && g < 0.65 && b < 0.25) warmAutumn++;
        else if (g > r) green++;
      }
    }
    return { total: warmAutumn + dream + green, warmAutumn, dream, green };
  }
  function _writeEgSlot(buf, slot, wx, wy, wz, baseSc, r, g, b, baseAng, sE, sW, sS, sN, skyAO) {
    const o = slot * 4;
    buf.pos[o] = wx + 0.5; buf.pos[o + 1] = wy + 1.0; buf.pos[o + 2] = wz + 0.5; buf.pos[o + 3] = baseSc;
    buf.col[o] = r; buf.col[o + 1] = g; buf.col[o + 2] = b; buf.col[o + 3] = baseAng;
    buf.side[o] = sE; buf.side[o + 1] = sW; buf.side[o + 2] = sS; buf.side[o + 3] = sN;
    buf.ao[slot] = skyAO;
  }
  function _commitEgTier(mesh, buf, cnt) {
    buf.geo.instanceCount = cnt;
    if (cnt > 0) {
      if (buf.posAttr.updateRange)  { buf.posAttr.updateRange.offset = 0;  buf.posAttr.updateRange.count = cnt * 4; }
      if (buf.colAttr.updateRange)  { buf.colAttr.updateRange.offset = 0;  buf.colAttr.updateRange.count = cnt * 4; }
      if (buf.sideAttr.updateRange) { buf.sideAttr.updateRange.offset = 0; buf.sideAttr.updateRange.count = cnt * 4; }
      if (buf.aoAttr.updateRange)   { buf.aoAttr.updateRange.offset = 0;   buf.aoAttr.updateRange.count = cnt; }
      buf.posAttr.needsUpdate = true;
      buf.colAttr.needsUpdate = true;
      buf.sideAttr.needsUpdate = true;
      buf.aoAttr.needsUpdate = true;
    }
    mesh.visible = (cnt > 0);
  }
  function updateEclipseGrass(force = false) {
    if (window._cartoonAddonActive || shaderPreset !== 'eclipse' ||
        typeof chunks === 'undefined' || typeof B === 'undefined' || typeof player === 'undefined' ||
        currentDimension === 'nether' || currentDimension === 'end' || currentDimension === 'warden' || depthOffset > 0 || player.y < -10) {
      if (eclipseGrassMesh.visible) eclipseGrassMesh.visible = false;
      if (eclipseGrassFarMesh.visible) eclipseGrassFarMesh.visible = false;
      return;
    }
    if (force) { _egLastX = 1e9; _egLastZ = 1e9; }
    if (currentDimension !== _egLastDim || _egBiomeCache.size > 4096) _egBiomeCache.clear();
    if (!force && !window._eclipseGrassDirty && window._chunkBuiltThisFrame) return;
    const moved = Math.hypot(player.x - _egLastX, player.z - _egLastZ);
    if (!force && !window._eclipseGrassDirty && moved < 3.0 && currentDimension === _egLastDim) return;
    _egLastX = player.x; _egLastZ = player.z; _egLastDim = currentDimension;
    window._eclipseGrassDirty = false;

    const pTier = typeof _autoPerfTier !== 'undefined' ? _autoPerfTier : 0;
    const scaleT = pTier >= 2 ? 0.50 : (pTier === 1 ? 0.72 : 1.0);
    const nearMax = Math.floor(ECLIPSE_GRASS_NEAR_MAX * scaleT);
    const farMax  = Math.floor(ECLIPSE_GRASS_FAR_MAX * scaleT);
    const hasBiomeFn = (typeof getBiomeAt === 'function');
    const hasWorldGet = (typeof getBlockWorld === 'function');

    const rad = envUniforms.uGrassRadius ? envUniforms.uGrassRadius.value : (_isMobilePerf ? 22 : 38);
    const nearRad = (_isMobilePerf || _isLiteGrass) ? 12.0 : 17.5;
    const nearRadSq = nearRad * nearRad;
    const radI = Math.floor(rad), radSq = rad * rad;
    const px = Math.floor(player.x), pz = Math.floor(player.z);
    const minLy = Math.max(0, Math.floor(player.y - 12) - MIN_Y);
    const maxCapLy = WORLD_H - 2;
    let nearCnt = 0, farCnt = 0, maxEmitD2 = 0;
    let cacheCx = 999999, cacheCz = 999999, cacheCh = null;

    const isGrassSurface = (bid) => (bid === B.GRASS || bid === B.SIFT_GRASS || bid === B.LULLABY_GRASS || bid === B.SPORE_TURF || bid === B.BLUE_GRASS || bid === B.MOSS_BLOCK || bid === B.AUTUMN_PODZOL);
    const isShortGrassTop = (tid) => (tid === B.TALL_GRASS || tid === B.SHORT_GRASS || tid === B.BUSH_GRASS || tid === B.WILD_TALL_GRASS || tid === B.AUTUMN_GRASS);
    const checkSideDir = (data, lx, ly, lz, wx, wy, wz) => {
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
        const upB = data[((ly + 1) << 8) | (lz << 4) | lx];
        if (IS_SOLID[upB] === 1 || isShortGrassTop(upB)) return 1.0;
        const lvB = data[(ly << 8) | (lz << 4) | lx];
        return isGrassSurface(lvB) ? 0.0 : -1.0;
      }
      if (!hasWorldGet) return 0.0;
      const upW = getBlockWorld(wx, wy + 1, wz);
      if (IS_SOLID[upW] === 1 || isShortGrassTop(upW)) return 1.0;
      return isGrassSurface(getBlockWorld(wx, wy, wz)) ? 0.0 : -1.0;
    };

    const emitColumn = (wx, wz, d2) => {
      const cx = wx >> 4, cz = wz >> 4;
      if (cx !== cacheCx || cz !== cacheCz) {
        cacheCx = cx; cacheCz = cz;
        cacheCh = chunks.get(chunkKey(cx, cz));
      }
      const ch = cacheCh;
      if (!ch || !ch.data || !ch.meshed) return;
      const data = ch.data;
      const maxLy = Math.min(maxCapLy, ch.maxLy, Math.floor(player.y + 14) - MIN_Y);
      if (maxLy < minLy) return;
      const lx = wx & 15, lz = wz & 15;
      const colOff = (lz << 4) | lx;
      for (let ly = maxLy; ly >= minLy && (nearCnt < nearMax || farCnt < farMax); ly--) {
        const id = data[(ly << 8) | colOff];
        if (id === B.STONE || id === B.DEEPSLATE || id === B.WATER || id === B.SANDSTONE) break;
        if (!isGrassSurface(id)) continue;
        if (id === B.SPORE_TURF) {
          if (ly <= 0) continue;
          const belowId = data[((ly - 1) << 8) | colOff];
          if (IS_SOLID[belowId] !== 1 || belowId === B.SIFT_LOG || belowId === B.SPORE_TURF) continue;
        }
        const wy = MIN_Y + ly;
        if (wy < WATER_LEVEL - 1) continue;
        const topId = data[((ly + 1) << 8) | colOff];
        if (topId !== 0 && (topId === B.SEAGRASS || topId === B.WHEAT_CROP || (BLOCK_FLAGS[topId] & BLK_CROSS) === 0)) continue;

        let skyAO = 1.0;
        if (ly < ch.maxLy) {
          const topScanMax = Math.min(ch.maxLy, ly + 18);
          for (let sy = ly + 1; sy <= topScanMax; sy++) {
            const ab = data[(sy << 8) | colOff];
            if (ab !== 0 && (BLOCK_FLAGS[ab] & BLK_CROSS) === 0) { skyAO = 0.42; break; }
          }
        }

        let bio = null;
        if ((id === B.GRASS || id === B.AUTUMN_PODZOL) && hasBiomeFn) {
          const bqx = wx >> 2, bqz = wz >> 2;
          const bqk = (bqx + 131072) * 262144 + (bqz + 131072);
          bio = _egBiomeCache.get(bqk);
          if (bio === undefined) { bio = getBiomeAt(bqx << 2, bqz << 2); _egBiomeCache.set(bqk, bio); }
        }
        let cr = 0.36, cg = 0.64, cb = 0.24;
        if (id === B.AUTUMN_PODZOL) {
          if (typeof BIOMES !== 'undefined' && bio === BIOMES.AUTUMN_GOLDEN) { cr = 0.95; cg = 0.58; cb = 0.12; }
          else { cr = 0.90; cg = 0.44; cb = 0.09; }
        } else if (id === B.SIFT_GRASS) { cr = 0.24; cg = 0.68; cb = 0.54; }
        else if (id === B.LULLABY_GRASS) { cr = 0.84; cg = 0.44; cb = 0.64; }
        else if (id === B.SPORE_TURF) { cr = 0.52; cg = 0.36; cb = 0.88; }
        else if (id === B.BLUE_GRASS) { cr = 0.18; cg = 0.62; cb = 0.58; }
        else if (id === B.MOSS_BLOCK) { cr = 0.30; cg = 0.54; cb = 0.18; }
        else if (typeof BIOMES !== 'undefined' && bio) {
          if (bio === BIOMES.PLAINS || bio === BIOMES.GREEN_PLAINS || bio === BIOMES.LUSH_STEPPE || bio === BIOMES.FLOWER_MEADOW || bio === BIOMES.HIGHLAND_PLATEAU) {
            cr = 0.38; cg = 0.68; cb = 0.24;
          } else if (bio === BIOMES.DARK_FOREST) { cr = 0.24; cg = 0.48; cb = 0.18; }
          else if (bio === BIOMES.PALE_GARDEN) { cr = 0.46; cg = 0.52; cb = 0.48; }
          else if (bio === BIOMES.NIGHTMARE_WOODS) { cr = 0.36; cg = 0.20; cb = 0.32; }
          else if (bio === BIOMES.SNOW || bio === BIOMES.SNOWY_PLAINS || bio === BIOMES.ALPINE_PEAKS || bio === BIOMES.MEGA_SNOW_PEAKS || bio === BIOMES.TAIGA) { cr = 0.30; cg = 0.54; cb = 0.34; }
          else if (bio === BIOMES.AUTUMN || bio === BIOMES.AUTUMN_GOLDEN || bio === BIOMES.AUTUMN_DEEP || bio === BIOMES.DAPPLED_FOREST) {
            cr = (bio === BIOMES.AUTUMN_GOLDEN) ? 0.95 : 0.90;
            cg = (bio === BIOMES.AUTUMN_GOLDEN) ? 0.58 : 0.44;
            cb = (bio === BIOMES.AUTUMN_GOLDEN) ? 0.12 : 0.09;
          }
          else if (bio === BIOMES.SAVANNA || bio === BIOMES.MESA || bio === BIOMES.DESERT) { cr = 0.56; cg = 0.58; cb = 0.22; }
        }

        let sE = 0.0, sW = 0.0, sS = 0.0, sN = 0.0;
        if (isShortGrassTop(topId)) {
          sE = 2.0; sW = 2.0; sS = 2.0; sN = 2.0;
        } else {
          sE = checkSideDir(data, lx + 1, ly, lz, wx + 1, wy, wz);
          sW = checkSideDir(data, lx - 1, ly, lz, wx - 1, wy, wz);
          sS = checkSideDir(data, lx, ly, lz + 1, wx, wy, wz + 1);
          sN = checkSideDir(data, lx, ly, lz - 1, wx, wy, wz - 1);
        }

        if (d2 > maxEmitD2) maxEmitD2 = d2;
        let h = Math.imul(wx * 374761 + wz * 668265 + wy * 214748, 0x85ebca6b) >>> 0;
        const baseAng = (h & 3) * (Math.PI * 0.5); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        const baseSc = 0.85 + ((h & 255) / 255) * 0.26; h >>>= 8;
        const hueShift = (((h & 63) / 63) - 0.5) * 0.07;
        const rc = Math.max(0.05, Math.min(1.0, cr + hueShift));
        const gc = Math.max(0.08, Math.min(1.0, cg + hueShift * 0.6));
        const bc = Math.max(0.04, Math.min(1.0, cb - hueShift * 0.2));

        if (d2 <= nearRadSq && nearCnt < nearMax) {
          _writeEgSlot(_egNear, nearCnt++, wx, wy, wz, baseSc, rc, gc, bc, baseAng, sE, sW, sS, sN, skyAO);
        } else if (farCnt < farMax) {
          _writeEgSlot(_egFar, farCnt++, wx, wy, wz, baseSc, rc, gc, bc, baseAng, sE, sW, sS, sN, skyAO);
        }
      }
    };

    emitColumn(px, pz, 0);
    for (let ring = 1; ring <= radI && (nearCnt < nearMax || farCnt < farMax); ring++) {
      const rz2 = ring * ring;
      for (let dx = -ring; dx <= ring && (nearCnt < nearMax || farCnt < farMax); dx++) {
        const d2 = dx * dx + rz2;
        if (d2 <= radSq) {
          emitColumn(px + dx, pz - ring, d2);
          emitColumn(px + dx, pz + ring, d2);
        }
      }
      for (let dz = -ring + 1; dz <= ring - 1 && (nearCnt < nearMax || farCnt < farMax); dz++) {
        const d2 = rz2 + dz * dz;
        if (d2 <= radSq) {
          emitColumn(px - ring, pz + dz, d2);
          emitColumn(px + ring, pz + dz, d2);
        }
      }
    }
    _egLastNearCount = nearCnt;
    _egLastFarCount = farCnt;
    _commitEgTier(eclipseGrassMesh, _egNear, nearCnt);
    _commitEgTier(eclipseGrassFarMesh, _egFar, farCnt);
    if (envUniforms.uGrassSoilRadius) {
      envUniforms.uGrassSoilRadius.value = (nearCnt + farCnt) > 0 ? Math.max(8.0, Math.sqrt(maxEmitD2)) : 0.0;
    }
  }


