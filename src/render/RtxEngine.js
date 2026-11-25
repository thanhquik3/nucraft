// NUCRAFT Module: src/render/RtxEngine.js — Three.js renderer, GPU preset detection, RTX shaders & PostFX

  /* ============================================================================
   * 5. RTX ENGINE: 2048px SHADOWS + PLANAR WATER MIRROR + SHADERS + BLOOM COMPOSITOR
   * ============================================================================ */
  const gameStage = document.getElementById('gameStage');
  const canvas = document.getElementById('gameCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
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
  let _lastShX = 9e9, _lastShZ = 9e9, _lastShYaw = 9e9, _lastShPitch = 9e9, _lastShTime = -1;
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
    if (_initMobile) return (qn === 'extreme' || qn === 'ultra') ? Math.min(1.5, p.maxPixelRatio) : Math.min(1.0, p.maxPixelRatio);
    const ded = !!(_hwProfile && _hwProfile.gpu && _hwProfile.gpu.isDedicated);
    const bigScreen = Math.max(window.innerWidth || 0, window.innerHeight || 0) >= 1500;
    const baseMax = (qn === 'extreme') ? p.maxPixelRatio : ((!ded && bigScreen) ? Math.min(1.25, p.maxPixelRatio) : p.maxPixelRatio);
    return Math.max(0.75, baseMax * _autoPerfPrScale);
  };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
  renderer.shadowMap.enabled = (shaderQuality !== 'low');
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.localClippingEnabled = (shaderQuality !== 'low');
  const _useDirectRender = () => (shaderQuality === 'low');
  renderer.toneMapping = _useDirectRender() ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = 0.96;
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
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0x88b4ea, 0x58533a, 0.50);
  scene.add(hemiLight);

  // Lean PointLight Pool (3 Mobile / 4 PC) cuts PBR per-pixel cost ~60%; baked vertex aBlockLight still lights every torch/lantern/lava!
  const dynamicLightPool = [];
  const _poolCount = _initMobile ? 3 : 4;
  for (let i = 0; i < _poolCount; i++) {
    const pl = new THREE.PointLight(0xffb86c, 0, 18, 1.85);
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
  const reflClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WATER_LEVEL + 0.85));

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
    uSurfaceLight: { value: 1.0 }
  };

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
  terrainMat.customProgramCacheKey = () => 'luanti_terrain_bsl_v67';
  terrainMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: envUniforms.uTime, uSunDir: envUniforms.uSunDir,
      uSunColor: envUniforms.uSunColor, uSkyTop: envUniforms.uSkyTop, uSkyHorizon: envUniforms.uSkyHorizon,
      uRainWetness: envUniforms.uRainWetness,
      uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uUnderwater: envUniforms.uUnderwater, uWaterDepth: envUniforms.uWaterDepth, uDimension: envUniforms.uDimension,
      uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode,
      uEclipseMode: envUniforms.uEclipseMode, uPlayerPos: envUniforms.uPlayerPos, uGrassRadius: envUniforms.uGrassRadius,
      uGrassSoilRadius: envUniforms.uGrassSoilRadius, uSurfaceLight: envUniforms.uSurfaceLight
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBlockLight = aBlockLight;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uRainWetness, uFogStart, uFogEnd, uUnderwater, uWaterDepth, uDimension, uQuality, uChillMode, uDlssMode, uEclipseMode, uGrassRadius, uGrassSoilRadius, uSurfaceLight;
        uniform vec3 uSunDir, uSunColor, uFogColor, uSkyTop, uSkyHorizon, uPlayerPos;
        varying vec3 vBlockLight, vWPos, vWNorm;
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
        // Crisp Complementary / Eclipse Albedo (keep real green grass & melon tops intact!)
        diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(1.01));
        float greenDom = max(0.0, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
        diffuseColor.rgb += vec3(0.012, 0.068, 0.004) * greenDom;
        float upW = clamp(vWNorm.y, 0.0, 1.0);
        float shoreWet = smoothstep(1.35, 0.72, vWPos.y) * smoothstep(-3.0, 0.0, vWPos.y);
        float wetAmt = clamp(max(shoreWet, uRainWetness * upW * 0.85), 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, 0.86, wetAmt);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float upR = clamp(vWNorm.y, 0.0, 1.0);
        float wetR = clamp(max(smoothstep(1.35, 0.72, vWPos.y), uRainWetness * upR * 0.9), 0.0, 1.0);
        float surfMaskR = clamp(uSurfaceLight, 0.0, 1.0);
        float puddleMaskR = smoothstep(-0.15, 0.55, sin(vWPos.x * 0.42 + cos(vWPos.z * 0.37)) * cos(vWPos.z * 0.48 - sin(vWPos.x * 0.31))) * upR * uRainWetness * surfMaskR;
        roughnessFactor = mix(roughnessFactor, 0.22, clamp(wetR * 0.72 * surfMaskR + puddleMaskR * 0.55, 0.0, 0.86));`)
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
        float shadeCool = pow(1.0 - dirWrap, 1.35) * (0.06 + 0.11 * sunUpB);
        vec3 shadowTint = mix(isUltraQ ? vec3(0.83, 0.90, 1.07) : vec3(0.88, 0.93, 1.04), vec3(0.64, 0.70, 1.04), uChillMode);
        shadowTint = mix(shadowTint, vec3(0.70, 0.80, 1.10), uDlssMode * 0.60);
        shadowTint = mix(shadowTint, vec3(0.58, 0.69, 1.08), uEclipseMode * 0.78);
        outgoingLight = mix(outgoingLight, outgoingLight * shadowTint, shadeCool * (isUltraQ ? 1.38 : 1.12) * (1.0 + uDlssMode * 0.14 + uEclipseMode * 0.16));
        float extSun = sunUpB * clamp(uSurfaceLight, 0.0, 1.0);
        float skyHemi = clamp(nrmW.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 bounceGnd = mix(vec3(0.45, 0.38, 0.28), vec3(0.58, 0.32, 0.16), uChillMode);
        outgoingLight += diffuseColor.rgb * mix(bounceGnd, uSkyTop, skyHemi) * (0.030 + 0.012 * uChillMode + 0.016 * uDlssMode + 0.020 * uEclipseMode) * extSun;
        float sunLitMask = smoothstep(-0.05, 0.75, ndlRaw) * extSun;
        float chillSunBoost = 1.0 + uChillMode * 0.16 + uDlssMode * 0.12 + uEclipseMode * 0.18;
        outgoingLight += diffuseColor.rgb * uSunColor * ((isUltraQ ? 0.048 : 0.034) * chillSunBoost * sunLitMask * whiteDamp);
        if (!isLowQ) {
          vec3 halfT = normalize(sunL + viewW);
          float specT = pow(max(dot(nrmW, halfT), 0.0), mix(isUltraQ ? 48.0 : 36.0, 64.0, max(uDlssMode, uEclipseMode * 0.85))) * sunLitMask * ((isUltraQ ? 0.014 : 0.008) * chillSunBoost * whiteDamp + uDlssMode * 0.028 * whiteDamp + uEclipseMode * 0.020 * whiteDamp + uRainWetness * (isUltraQ ? 0.14 : 0.09));
          outgoingLight += uSunColor * specT;
          float puddleO = smoothstep(-0.15, 0.55, sin(vWPos.x * 0.42 + cos(vWPos.z * 0.37)) * cos(vWPos.z * 0.48 - sin(vWPos.x * 0.31))) * clamp(nrmW.y, 0.0, 1.0) * uRainWetness * clamp(uSurfaceLight, 0.0, 1.0);
          float puddleShim = puddleO * (0.14 + 0.10 * sin(uTime * 7.5 + vWPos.x * 5.0 + vWPos.z * 5.0));
          outgoingLight += mix(uSkyHorizon, uSunColor, 0.45 * uChillMode) * puddleShim * 0.14;
          if (isUltraQ || uChillMode > 0.5 || uDlssMode > 0.5 || uEclipseMode > 0.5) {
            float fresT = pow(1.0 - max(dot(nrmW, viewW), 0.0), 3.8);
            vec3 fresTint = mix(mix(uSkyHorizon, uSkyTop, 0.45), mix(uSkyHorizon, uSunColor, 0.55), max(uChillMode, uEclipseMode * 0.6));
            outgoingLight += fresTint * fresT * (0.026 + 0.020 * uChillMode + 0.022 * uDlssMode + 0.024 * uEclipseMode + uRainWetness * 0.08) * extSun;
          }
        }
        // Murky Marine Depth Absorption (caustics restricted subtly underwater only — zero bright lines from above!)
        if (uDimension < 0.5 && vWPos.y < 0.86 && (uUnderwater > 0.5 || vWPos.y > -18.0)) {
          float wDepth = max(0.0, 0.86 - vWPos.y);
          vec3 waterAbsorb = exp(-wDepth * (uUnderwater > 0.5 ? vec3(0.11, 0.032, 0.028) : vec3(0.40, 0.22, 0.15)));
          outgoingLight *= mix(vec3(1.0), waterAbsorb, 0.94);
          float subMurk = 1.0 - exp(-wDepth * (uUnderwater > 0.5 ? 0.04 : 0.28));
          vec3 deepSeaTint = mix(vec3(0.012, 0.11, 0.22), vec3(0.008, 0.072, 0.14), clamp(wDepth * 0.12, 0.0, 1.0)) * (0.18 + 0.82 * sunUpB);
          outgoingLight = mix(outgoingLight, deepSeaTint, clamp(subMurk, 0.0, 0.88));
          if (!isLowQ && uUnderwater > 0.5 && sunUpB > 0.05 && wDepth < 20.0) {
            float sideFace = 0.55 + 0.45 * clamp(vWNorm.y, 0.0, 1.0);
            float caust = waterCaustics(vWPos, uTime) * exp(-wDepth * 0.11) * sunUpB * sideFace;
            outgoingLight += (diffuseColor.rgb * 0.45 + vec3(0.10, 0.24, 0.28)) * vec3(0.36, 0.78, 0.82) * caust * 0.36 * waterAbsorb;
          }
        }
        float surfLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float blockLightGain = mix(1.42, (uUnderwater > 0.5 ? 1.05 : 0.72), smoothstep(0.08, 0.60, surfLuma) * (0.25 + 0.75 * sunUpB * clamp(uSurfaceLight, 0.0, 1.0)));
        vec3 blockAdd = vBlockLight * (diffuseColor.rgb + vec3(0.03)) * blockLightGain;
        outgoingLight += blockAdd / (vec3(1.0) + max(outgoingLight, vec3(0.0)) * 1.15 + blockAdd * 0.85);
        // Pre-RT sub-unity highlight shoulder keeps bricks & lamps vivid without channel clipping or yellow washout
        float outPeak = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        float outLum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float hiMetric = mix(outLum, outPeak, 0.55);
        if (hiMetric > 0.58) {
          float overH = hiMetric - 0.58;
          float compLum = 0.58 + overH / (1.0 + overH * 2.85);
          outgoingLight *= (compLum / max(hiMetric, 0.0001));
        }
        #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
        vec3 viewVecF = vWPos - cameraPosition;
        float distF = length(viewVecF);
        vec3 viewDirF = viewVecF / max(distF, 0.0001);
        if (uUnderwater > 0.5) {
          float abyssK = clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0);
          float fogDens = mix(0.036, 0.095, abyssK);
          float uwFog = 1.0 - exp(-distF * fogDens);
          vec3 uwTopCol = uFogColor * vec3(1.16, 1.38, 1.52);
          vec3 uwBotCol = uFogColor * vec3(0.24, 0.36, 0.54);
          vec3 uwCol = mix(uwBotCol, uwTopCol, smoothstep(-0.62, 0.68, viewDirF.y));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uwCol, clamp(uwFog, 0.0, 0.985));
        } else {
          float fogFactor = smoothstep(uFogStart, uFogEnd, distF);
          float mistLow = exp(-max(vWPos.y - mix(1.5, 2.2, uEclipseMode), 0.0) * mix(0.15, 0.11, max(uChillMode, uEclipseMode * 0.7))) * smoothstep(mix(28.0, 14.0, max(uChillMode, uEclipseMode)), 64.0, distF) * mix(0.06, 0.28, max(uChillMode, uEclipseMode * 0.95));
          float scatterAmt = clamp(max(fogFactor, mistLow), 0.0, 1.0);
          scatterAmt = mix(scatterAmt, scatterAmt * 0.88, uDlssMode);
          vec3 fSun = normalize(uSunDir);
          vec3 activeSunF = fSun.y > -0.05 ? fSun : -fSun;
          vec3 activeColF = fSun.y > -0.05 ? uSunColor : vec3(0.42, 0.62, 0.96);
          float noonTame = 1.0 - smoothstep(0.45, 0.92, fSun.y) * mix(0.68, 0.42, uEclipseMode);
          float sunScatter = pow(max(dot(viewDirF, activeSunF), 0.0), mix(7.0, 4.4, max(uChillMode, uEclipseMode))) * (fSun.y > -0.05 ? smoothstep(-0.1, 0.25, fSun.y) * noonTame : 0.35);
          vec3 fogBase = uFogColor * mix(0.94, 0.88, smoothstep(0.45, 0.92, fSun.y));
          vec3 scatterCol = mix(fogBase, min(activeColF * mix(0.90, 1.06, max(uChillMode, uEclipseMode)), vec3(1.0, 0.91, 0.78)), sunScatter * mix(0.18, 0.50, max(uChillMode, uEclipseMode)));
          float blLumaT = max(vBlockLight.r, max(vBlockLight.g, vBlockLight.b));
          float lightFogResistT = 1.0 - clamp(blLumaT * 0.72, 0.0, 0.76);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, scatterCol, scatterAmt * lightFogResistT);
        }
        gl_FragColor.a = 1.0;`);
  };

  // Razor-Sharp Fancy Leaves Material w/ Velvety Canopy Shade, True Sakura Pink & Warm Golden Backlit SSS
  const leavesMat = new THREE.MeshStandardMaterial({
    map: atlasTex, bumpMap: bumpTex, bumpScale: 0.028,
    alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.74, metalness: 0.02, vertexColors: true
  });
  leavesMat.customProgramCacheKey = () => 'luanti_leaves_bsl_v34';
  leavesMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength,
      uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uRainWetness: envUniforms.uRainWetness,
      uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode, uSurfaceLight: envUniforms.uSurfaceLight
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindStrength;\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;\nvarying vec3 vWPos;\nvarying vec3 vWNormL;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wpLeaf = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float sway = (sin(uTime * 1.9 + wpLeaf.x * 0.7 + wpLeaf.z * 0.5) + cos(uTime * 1.3 + wpLeaf.y * 0.8) * 0.5) * 0.045 * uWindStrength;
        transformed.x += sway;
        transformed.z += sway * 0.7;`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBlockLight = aBlockLight;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormL = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFogStart, uFogEnd, uQuality, uChillMode, uRainWetness, uDlssMode, uEclipseMode, uSurfaceLight;\nuniform vec3 uSunDir, uSunColor, uFogColor;\nvarying vec3 vBlockLight, vWPos, vWNormL;')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal = normalize( vNormal );
        geometryNormal = normal;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Lush Complementary foliage richness (vivid emerald-lime oak/birch canopy + luminous sakura blossom pink!)
        diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(1.00));`)
      .replace('#include <opaque_fragment>', `
        vec3 vDirL = normalize(vWPos - cameraPosition);
        vec3 sDirL = normalize(uSunDir);
        vec3 nDirL = normalize(vWNormL);
        bool isUltraL = (uQuality > 1.5);
        float sUp = smoothstep(-0.08, 0.25, sDirL.y);
        float sssFwd = pow(max(dot(vDirL, sDirL), 0.0), 3.0);
        float sssBroad = max(dot(vDirL, sDirL) * 0.5 + 0.5, 0.0) * 0.24;
        float topSun = smoothstep(-0.25, 0.85, dot(nDirL, sDirL));
        outgoingLight *= mix(0.42, mix(0.86, 1.02, topSun), sUp);
        vec3 leafShTint = mix(isUltraL ? vec3(0.84, 0.90, 1.07) : vec3(0.90, 0.94, 1.04), vec3(0.76, 0.80, 1.08), max(uChillMode, uEclipseMode * 0.75));
        outgoingLight = mix(outgoingLight, outgoingLight * leafShTint, (1.0 - topSun) * (isUltraL ? 0.26 : 0.18) * sUp);
        float sUpG = sUp * clamp(uSurfaceLight, 0.0, 1.0);
        float leafLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float leafLightGain = mix(1.18, 0.55, smoothstep(0.10, 0.65, leafLuma) * sUpG);
        float chillLeafSss = mix(isUltraL ? 0.32 : 0.20, isUltraL ? 0.48 : 0.34, uChillMode) + uDlssMode * 0.18 + uEclipseMode * 0.24;
        vec3 leafBlockAdd = vBlockLight * (diffuseColor.rgb + vec3(0.025)) * leafLightGain;
        outgoingLight += diffuseColor.rgb * (0.036 * sUpG) + diffuseColor.rgb * uSunColor * (sssFwd * chillLeafSss + sssBroad * mix(0.08, 0.16, max(uChillMode, uEclipseMode))) * sUpG + uSunColor * (uRainWetness * 0.06 * sssFwd * sUpG) + leafBlockAdd / (vec3(1.0) + max(outgoingLight, vec3(0.0)) * 0.90 + leafBlockAdd * 0.75);
        float outPeakL = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        float outLumL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float hiMetricL = mix(outLumL, outPeakL, 0.50);
        if (hiMetricL > 0.60) {
          float overL = hiMetricL - 0.60;
          float compLumL = 0.60 + overL / (1.0 + overL * 3.10);
          outgoingLight *= (compLumL / max(hiMetricL, 0.0001));
        }
        #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
        vec3 viewVecL = vWPos - cameraPosition;
        float distL = length(viewVecL);
        vec3 viewDirL = viewVecL / max(distL, 0.0001);
        float fogL = smoothstep(uFogStart, uFogEnd, distL);
        vec3 lSun = normalize(uSunDir);
        vec3 activeSunL = lSun.y > -0.05 ? lSun : -lSun;
        vec3 activeColL = lSun.y > -0.05 ? uSunColor : vec3(0.42, 0.62, 0.96);
        float lNoonTame = 1.0 - smoothstep(0.45, 0.92, lSun.y) * mix(0.68, 0.42, uEclipseMode);
        float lScatter = pow(max(dot(viewDirL, activeSunL), 0.0), mix(7.0, 4.4, max(uChillMode, uEclipseMode))) * (lSun.y > -0.05 ? smoothstep(-0.1, 0.25, lSun.y) * lNoonTame : 0.35);
        vec3 lFogBase = uFogColor * mix(0.94, 0.88, smoothstep(0.45, 0.92, lSun.y));
        float blLumaL = max(vBlockLight.r, max(vBlockLight.g, vBlockLight.b));
        float lightFogResistL = 1.0 - clamp(blLumaL * 0.72, 0.0, 0.74);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(lFogBase, min(activeColL * mix(0.90, 1.06, max(uChillMode, uEclipseMode)), vec3(1.0, 0.91, 0.78)), lScatter * mix(0.16, 0.48, max(uChillMode, uEclipseMode))), fogL * lightFogResistL);
        gl_FragColor.a = 1.0;`);
  };

  // Synchronized Wind Shadow Depth Material for Crisp Leaves
  const leavesDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map: atlasTex, alphaTest: 0.45, side: THREE.DoubleSide
  });
  leavesDepthMat.customProgramCacheKey = () => 'luanti_leaves_depth_bsl_v12';
  leavesDepthMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindStrength;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wpLeaf = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float sway = (sin(uTime * 1.9 + wpLeaf.x * 0.7 + wpLeaf.z * 0.5) + cos(uTime * 1.3 + wpLeaf.y * 0.8) * 0.5) * 0.045 * uWindStrength;
        transformed.x += sway;
        transformed.z += sway * 0.7;`);
  };

  // Low graphics: lá ĐẶC (không lỗ, không alphaTest) — dùng texture thật khi ở chế độ Thấp để tránh tạo USE_MAP thừa
  const leavesMatLow = new THREE.MeshStandardMaterial({
    map: shaderQuality === 'low' ? getAtlasSolidTex() : atlasTex, side: THREE.FrontSide, roughness: 0.80, metalness: 0.0, vertexColors: true
  });

  // Plant Material (Crisp 3-Plane Grass Tufts, Flowers, Wheat Gust Waves & Warm Golden Backlit Tip Glow!)
  const plantMat = new THREE.MeshStandardMaterial({
    map: atlasTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.80, metalness: 0.0
  });
  plantMat.customProgramCacheKey = () => 'luanti_plant_bsl_v33';
  plantMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength,
      uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd,
      uUnderwater: envUniforms.uUnderwater, uWaterDepth: envUniforms.uWaterDepth, uDimension: envUniforms.uDimension,
      uQuality: envUniforms.uQuality, uChillMode: envUniforms.uChillMode, uRainWetness: envUniforms.uRainWetness,
      uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode, uPlayerPos: envUniforms.uPlayerPos, uSurfaceLight: envUniforms.uSurfaceLight
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindStrength, uEclipseMode;\nuniform vec3 uPlayerPos;\nattribute float aPlantSway;\nattribute float aSkyShade;\nattribute vec3 aBlockLight;\nvarying vec3 vBlockLight;\nvarying vec3 vWPos;\nvarying float vPlantTip;\nvarying float vSkyShade;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wpP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        // Lock horizontal sway phase to column (wx, wz) + Eclipse rolling wind gusts & player foot parting
        vec2 colPhase = floor(wpP.xz) + 0.5;
        float gust = 0.72 + 0.48 * sin(uTime * 1.15 + colPhase.x * 0.14 + colPhase.y * 0.11);
        float wSway = sin(uTime * 2.4 + colPhase.x * 0.72 + colPhase.y * 0.65) * mix(0.084, 0.112, uEclipseMode) * gust * uWindStrength * aPlantSway;
        float wSwayZ = cos(uTime * 1.95 + colPhase.y * 0.85 + colPhase.x * 0.35) * mix(0.052, 0.072, uEclipseMode) * gust * uWindStrength * aPlantSway;
        transformed.x += wSway;
        transformed.z += wSwayZ;
        if (uEclipseMode > 0.5) {
          vec2 pdxz = wpP.xz - uPlayerPos.xz;
          float pdLen = length(pdxz);
          float pPush = smoothstep(0.95, 0.08, pdLen) * smoothstep(1.4, 0.1, abs(wpP.y - uPlayerPos.y)) * 0.34 * aPlantSway;
          vec2 pDir = pdLen > 0.001 ? (pdxz / pdLen) : vec2(0.0);
          transformed.xz += pDir * pPush;
          transformed.y -= (length(vec2(wSway, wSwayZ)) * 0.24 + pPush * 0.28);
        }`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBlockLight = aBlockLight;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPlantTip = clamp(aPlantSway, 0.0, 1.0);\nvSkyShade = aSkyShade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFogStart, uFogEnd, uUnderwater, uWaterDepth, uDimension, uQuality, uChillMode, uRainWetness, uDlssMode, uEclipseMode, uSurfaceLight;\nuniform vec3 uSunDir, uSunColor, uFogColor;\nvarying vec3 vBlockLight, vWPos;\nvarying float vPlantTip, vSkyShade;')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        // Prevent DoubleSide backfaces from flipping upward (0,1,0) normals downward into black!
        normal = normalize( vNormal );
        geometryNormal = normal;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Lush Complementary emerald-lime meadow grass, deep sculpted root AO & golden sunset crop tips!
        diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.001)), vec3(0.99));
        float dayPlant = smoothstep(-0.08, 0.25, normalize(uSunDir).y);
        float isGoldCrop = clamp((diffuseColor.r - diffuseColor.b) * 2.2, 0.0, 1.0);
        float baseRootShade = mix(mix(0.84, 0.56, uChillMode), 0.52, uEclipseMode);
        float rootShade = mix(baseRootShade, 0.86, isGoldCrop * 0.75);
        diffuseColor.rgb *= vSkyShade * mix(rootShade, mix(0.98, 1.12, dayPlant), smoothstep(0.0, 0.84, vPlantTip));`)
      .replace('#include <opaque_fragment>', `
        vec3 vDirP = normalize(vWPos - cameraPosition);
        vec3 sDirP = normalize(uSunDir);
        float sUpP = smoothstep(-0.08, 0.28, sDirP.y);
        float chillPlantMul = 1.0 + uChillMode * 0.55 + uDlssMode * 0.28 + uEclipseMode * 0.45;
        float pSSS = (pow(max(dot(vDirP, sDirP), 0.0), 3.0) * (uQuality > 1.5 ? 0.40 : 0.28) + 0.03 * (1.0 - uChillMode)) * chillPlantMul * smoothstep(0.15, 1.0, vPlantTip) * sUpP * vSkyShade;
        float tipRimP = pow(1.0 - abs(vDirP.y), 2.4) * smoothstep(0.32, 1.0, vPlantTip) * (0.06 + 0.24 * uChillMode + 0.14 * uDlssMode + 0.20 * uEclipseMode) * sUpP;
        outgoingLight *= mix(0.30, mix(1.0, 0.74, uChillMode), sUpP);
        vec3 plantShTint = mix(vec3(0.88, 0.93, 1.03), vec3(0.68, 0.66, 0.92), max(uChillMode, uEclipseMode * 0.75));
        outgoingLight = mix(outgoingLight * plantShTint, outgoingLight, vSkyShade);
        outgoingLight += diffuseColor.rgb * uSunColor * (pSSS + tipRimP) + uSunColor * (uRainWetness * 0.08 * vPlantTip * sUpP);
        if (uDimension < 0.5 && vWPos.y < 0.86) {
          float wDepthP = max(0.0, 0.86 - vWPos.y);
          vec3 wAbsorbP = exp(-wDepthP * vec3(0.115, 0.050, 0.025));
          outgoingLight *= mix(vec3(1.0), wAbsorbP, 0.92);
        }
        float sUpPG = sUpP * clamp(uSurfaceLight, 0.0, 1.0);
        float plantLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float plantLightGain = mix(1.18, 0.55, smoothstep(0.10, 0.65, plantLuma) * sUpPG);
        vec3 plantBlockAdd = vBlockLight * (diffuseColor.rgb + vec3(0.025)) * plantLightGain;
        outgoingLight += plantBlockAdd / (vec3(1.0) + max(outgoingLight, vec3(0.0)) * 0.90 + plantBlockAdd * 0.75);
        float outPeakP = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        float outLumP = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float hiMetricP = mix(outLumP, outPeakP, 0.50);
        if (hiMetricP > 0.60) {
          float overP = hiMetricP - 0.60;
          float compLumP = 0.60 + overP / (1.0 + overP * 3.10);
          outgoingLight *= (compLumP / max(hiMetricP, 0.0001));
        }
        #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
        vec3 viewVecP = vWPos - cameraPosition;
        float distP = length(viewVecP);
        vec3 viewDirP = viewVecP / max(distP, 0.0001);
        if (uUnderwater > 0.5) {
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
          vec3 pFogBase = uFogColor * mix(0.94, 0.88, smoothstep(0.45, 0.92, pSun.y));
          float blLumaP = max(vBlockLight.r, max(vBlockLight.g, vBlockLight.b));
          float lightFogResistP = 1.0 - clamp(blLumaP * 0.72, 0.0, 0.74);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(pFogBase, min(activeColP * mix(0.90, 1.06, max(uChillMode, uEclipseMode)), vec3(1.0, 0.91, 0.78)), pScatter * mix(0.16, 0.48, max(uChillMode, uEclipseMode))), fogP * lightFogResistP);
        }
        gl_FragColor.a = 1.0;`);
  };

  // Animated Emissive Material (Pulsing Lava, Lanterns, Glowing Cave Mushrooms & 4-Frame Voxel Fire!)
  const emissiveMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlasTex }, uTime: envUniforms.uTime, uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd },
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float aEmissiveType;
      varying vec2 vUv; varying float vDist, vEType, vFireSeed;
      void main() {
        vUv = uv; vEType = aEmissiveType;
        float hasModel = abs(modelMatrix[3].x) + abs(modelMatrix[3].y) + abs(modelMatrix[3].z);
        vFireSeed = (hasModel > 0.001) ? floor(abs(modelMatrix[3].x) + abs(modelMatrix[3].z)) * 1.73 : (floor(position.x) * 1.37 + floor(position.z) * 2.19);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime, uFogStart, uFogEnd; uniform vec3 uFogColor;
      varying vec2 vUv; varying float vDist, vEType, vFireSeed;
      void main() {
        if (vEType > 3.5) {
          float fPhase = floor(mod(uTime * 12.5 + vFireSeed, 4.0));
          float shimmer = sin(uTime * 16.0 + vUv.y * 28.0 + vFireSeed) * 0.0025;
          vec4 fTex = texture2D(uMap, vec2(clamp(vUv.x + fPhase * 0.125 + shimmer, 0.0, 0.999), vUv.y));
          if (fTex.a < 0.45) discard;
          float flick = 0.94 + 0.08 * sin(uTime * 21.0 + vFireSeed * 3.1) + 0.04 * cos(uTime * 34.0 + vFireSeed);
          vec3 fCol = fTex.rgb * flick + (vEType > 4.5 ? vec3(0.01, 0.07, 0.11) : vec3(0.06, 0.025, 0.005));
          float fFog = smoothstep(uFogStart * 1.35, uFogEnd * 2.4, vDist) * 0.30;
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
        gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
      }`
  });

  // Translucent Thin Portal Shader (Nether purple 0, Dream cyan 1, End cosmic void 2)
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlasTex }, uTime: envUniforms.uTime, uFogColor: envUniforms.uFogColor, uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd },
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float aPortalKind;
      varying vec2 vUv; varying float vDist, vKind; varying vec3 vWPos;
      void main() {
        vUv = uv; vKind = aPortalKind;
        vWPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime, uFogStart, uFogEnd; uniform vec3 uFogColor;
      varying vec2 vUv; varying float vDist, vKind; varying vec3 vWPos;
      void main() {
        vec2 uv = vUv;
        if (vKind < 1.5) {
          uv += vec2(sin(uTime * 3.1 + vWPos.y * 4.5) * 0.0016, cos(uTime * 2.7 + vWPos.x * 4.5 + vWPos.z * 4.5) * 0.0010);
        }
        vec4 tex = texture2D(uMap, uv);
        vec3 col; float a;
        if (vKind < 0.5) {
          col = tex.rgb * (1.14 + 0.10 * sin(uTime * 3.0 + vWPos.y * 2.0));
          a = 0.78;
        } else if (vKind < 1.5) {
          col = tex.rgb * (1.18 + 0.08 * sin(uTime * 2.6 + vWPos.y * 1.8));
          a = 0.84;
        } else {
          col = tex.rgb * (1.05 + 0.14 * sin(uTime * 2.2 + vWPos.x * 1.3 + vWPos.z * 1.3));
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
      uSunDir: envUniforms.uSunDir, uSkyTop: envUniforms.uSkyTop, uSkyHorizon: envUniforms.uSkyHorizon,
      uSunColor: envUniforms.uSunColor, uTime: envUniforms.uTime,
      uCloudCover: envUniforms.uCloudCover, uVolumetricClouds: envUniforms.uVolumetricClouds,
      uDimension: envUniforms.uDimension, uUnderwater: envUniforms.uUnderwater, uWaterDepth: envUniforms.uWaterDepth,
      uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0)); }`,
    fragmentShader: `
      precision mediump float;
      uniform vec3 uSunDir, uSkyTop, uSkyHorizon, uSunColor;
      uniform float uTime, uCloudCover, uVolumetricClouds, uDimension, uUnderwater, uWaterDepth, uChillMode, uDlssMode, uEclipseMode;
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
        vec3 col = mix(uSkyHorizon, uSkyTop, pow(max(h, 0.0001), mix(0.44, 0.28, uChillMode)));
        vec3 sunN = normalize(uSunDir);
        float sunDot = max(dot(d, sunN), 0.0), sunUp = smoothstep(-0.14, 0.25, sunN.y);
        // 3-Band Rayleigh + Mie Sunset Horizon Band & Deep Twilight Rose-Violet Mid-Sky
        float chillBand = uChillMode * exp(-max(h, 0.0) * 8.2) * sunUp;
        col = mix(col, vec3(0.48, 0.27, 0.44), uChillMode * exp(-pow((h - 0.14) * 5.6, 2.0)) * 0.48 * sunUp);
        col += vec3(0.95, 0.50, 0.24) * chillBand * (0.14 + 0.32 * pow(sunDot, 2.0));
        // Creamy-Gold Mie Forward Scattering Corona + Crisp Sun Disc
        float mieBoost = 1.0 + uChillMode * 0.45 + uDlssMode * 0.32;
        col += uSunColor * (pow(sunDot, 6.0) * 0.12 + pow(sunDot, 24.0) * 0.24 + pow(sunDot, 96.0) * 0.36) * sunUp * mieBoost;
        col += uSunColor * smoothstep(0.9960, 0.9990, sunDot) * (1.28 + 0.16 * uDlssMode) * sunUp;

        float moonDot = max(dot(d, -sunN), 0.0);
        float moonPresence = smoothstep(0.18, -0.06, sunN.y);
        col += vec3(0.32, 0.58, 0.95) * moonPresence * (pow(moonDot, 14.0) * 0.42 + pow(moonDot, 50.0) * 0.72) * (1.0 + 0.25 * uDlssMode);
        float moonDisc = smoothstep(0.9958, 0.9985, moonDot);
        if (moonDisc > 0.01) col += vec3(0.92, 0.96, 1.0) * moonDisc * 1.25;

        float twilightStars = max(uChillMode, uDlssMode * 0.55) * smoothstep(0.24, 0.72, h) * 0.62;
        float nightMask = max(smoothstep(0.10, -0.18, sunN.y) * smoothstep(0.05, 0.32, h), twilightStars);
        if (nightMask > 0.01) {
          // Crisp delicate twinkling pinpoint stars (zero chunky blocks!)
          vec2 stGrid = d.xz / (d.y + 0.35) * 185.0;
          vec2 stCell = floor(stGrid);
          vec2 stLocal = fract(stGrid) - 0.5;
          float stR = cHash(stCell);
          if (stR > 0.988) {
            float dotStar = smoothstep(0.34, 0.04, length(stLocal));
            col += vec3(0.92, 0.96, 1.0) * dotStar * nightMask * (0.60 + 0.40 * sin(uTime * 3.0 + stR * 120.0)) * (1.45 + 0.35 * uDlssMode);
          }
          // Authentic Shimmering Aurora Borealis + Eclipse Nimitz Curtain Aurora (rendered BEFORE clouds for dark cloud silhouettes!)
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

        // Dual-Layer Realistic Sky Clouds: High-Altitude Wispy Sunset Cirrus + Sculpted Puffy Cumulus!
        float cloudAlpha = 0.0;
        if (uVolumetricClouds > 0.5 && d.y > 0.02) {
          vec3 lightD = sunN.y > -0.05 ? sunN : -sunN;
          vec2 ciUv = (d.xz / (d.y + 0.26)) * vec2(0.85, 2.35) + vec2(uTime * 0.008, uTime * 0.004);
          float ci = smoothstep(0.54, 0.88, fbmFast(ciUv)) * smoothstep(0.03, 0.25, d.y) * smoothstep(0.95, 0.38, d.y);
          if (ci > 0.01) {
            vec3 ciCol = mix(mix(uSkyHorizon * 0.85, vec3(0.34, 0.36, 0.54), 0.42), uSunColor * 1.06, pow(sunDot, 2.5) * 0.78);
            float ciFade = mix(0.28, 0.48, max(uChillMode, max(uDlssMode * 0.65, uEclipseMode * 0.75))) * sunUp;
            col = mix(col, ciCol, ci * ciFade);
            cloudAlpha = max(cloudAlpha, ci * ciFade * 0.6);
          }
          vec2 pUv = (d.xz / (d.y + 0.18)) * 1.45 + vec2(uTime * 0.014, uTime * 0.007);
          float f1 = fbmFast(pUv);
          float dens = smoothstep(0.64 - uCloudCover * 0.45, 0.89 - uCloudCover * 0.30, f1);
          float horFade = smoothstep(0.02, 0.20, d.y);
          if (dens > 0.01) {
            vec2 lStep = lightD.xz / (abs(lightD.y) + 0.42) * 0.15;
            float fSun = fbmFast(pUv + lStep);
            float lit = clamp(0.62 + (f1 - fSun) * (2.5 + 0.45 * max(uDlssMode, uEclipseMode)), 0.14, 1.0);
            float silverRim = pow(sunDot, mix(6.5, 4.2, uEclipseMode)) * (1.0 - dens * 0.40) * mix(0.22, 0.54, max(uChillMode, max(uDlssMode * 0.85, uEclipseMode))) * sunUp;
            vec3 dayBright = mix(vec3(0.90, 0.88, 0.85), uSunColor * mix(1.02, 1.12, uEclipseMode), mix(0.34, 0.72, max(uChillMode, max(uDlssMode * 0.35, uEclipseMode * 0.82))));
            vec3 dayShade  = mix(mix(vec3(0.46, 0.54, 0.70), uSkyHorizon * 0.78, 0.34), mix(vec3(0.30, 0.27, 0.48), vec3(0.28, 0.33, 0.44), uEclipseMode), max(uChillMode * 0.75, uEclipseMode * 0.85));
            vec3 nightCloudDark = mix(vec3(0.07, 0.12, 0.24), vec3(0.045, 0.06, 0.105), uEclipseMode);
            vec3 nightCloudLit  = mix(vec3(0.24, 0.36, 0.56), vec3(0.16, 0.20, 0.30), uEclipseMode);
            vec3 cCol = mix(mix(nightCloudDark, dayShade, sunUp), mix(nightCloudLit, dayBright, sunUp), lit);
            cCol += uSunColor * silverRim;
            float cumAlpha = dens * mix(0.88, 0.94, uEclipseMode) * horFade;
            cloudAlpha = max(cloudAlpha, cumAlpha);
            col = mix(col, cCol, cumAlpha);
          }
        }
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
    uniforms: {
      uTime: envUniforms.uTime, uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uSkyTop: envUniforms.uSkyTop, uSkyHorizon: envUniforms.uSkyHorizon, uFogColor: envUniforms.uFogColor,
      uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd, uQuality: envUniforms.uQuality, uWaterQuality: envUniforms.uWaterQuality,
      uReflMap: envUniforms.uReflMap, uReflMatrix: envUniforms.uReflMatrix, uUsePlanarRefl: envUniforms.uUsePlanarRefl, uUnderwater: envUniforms.uUnderwater, uWaterDepth: envUniforms.uWaterDepth, uDimension: envUniforms.uDimension,
      uRainWetness: envUniforms.uRainWetness, uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode,
      uEclipseMode: envUniforms.uEclipseMode, uWakePts: envUniforms.uWakePts, uPlayerPos: envUniforms.uPlayerPos
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
        if (aIsTop > 0.5) {
          float eMul = mix(1.0, 1.55, uEclipseMode);
          wp.y += (sin(wp.x * 1.15 + wp.z * 0.42 + uTime * 1.45) * 0.011 + cos(wp.z * 1.05 - wp.x * 0.35 - uTime * 1.22) * 0.008) * eMul * (1.0 - clamp(aShore, 0.0, 1.0) * 0.90);
        }
        vWorldPos = wp.xyz; vNormal = normal; vIsTop = aIsTop; vShore = aShore; vColDepth = aDepth;
        vec4 mv = viewMatrix * wp; vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
        vClipPos = gl_Position;
        vReflClip = uReflMatrix * vec4(wp.x, 0.86, wp.z, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime, uFogStart, uFogEnd, uQuality, uWaterQuality, uUsePlanarRefl, uUnderwater, uWaterDepth, uDimension, uRainWetness, uChillMode, uDlssMode, uEclipseMode;
      uniform vec3 uSunDir, uSunColor, uSkyTop, uSkyHorizon, uFogColor, uPlayerPos;
      uniform vec4 uWakePts[8];
      uniform sampler2D uReflMap;
      varying vec3 vWorldPos, vNormal; varying float vDist, vIsTop, vShore, vColDepth; varying vec4 vClipPos, vReflClip;

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
      // Eclipse Golden-Angle Patchy Swell Waves (with smooth distance damping so horizon stays glassy)
      vec3 eclipseWaterGrad(vec2 p, float t, float dist, bool highDetail) {
        float patchMask = 0.62 + 0.38 * sin(p.x * 0.11 + cos(p.y * 0.08) * 1.5);
        float farAtten = exp(-dist * 0.013);
        float h = 0.0;
        vec2 g = vec2(0.0);
        mat2 rotG = mat2(-0.73736, -0.67549, 0.67549, -0.73736);
        vec2 rp = p;
        float freq = 1.45, amp = 0.044, spd = 1.28;
        for (int wi = 0; wi < 4; wi++) {
          if (!highDetail && wi >= 3) break;
          float ph = rp.x * freq + sin(rp.y * freq * 0.42 + t * 0.55) * 0.65 + t * spd;
          h += sin(ph) * amp;
          vec2 wg = vec2(cos(ph) * freq * amp, cos(ph) * cos(rp.y * freq * 0.42 + t * 0.55) * freq * 0.27 * amp);
          if (wi == 1) wg = mat2(rotG[0][0], -rotG[0][1], -rotG[1][0], rotG[1][1]) * wg;
          else if (wi == 2) wg = rotG * wg;
          g += wg;
          rp = rotG * rp;
          freq *= 1.58;
          amp *= 0.56;
          spd *= -1.12;
        }
        return vec3(h * patchMask, g.x * patchMask * farAtten, g.y * patchMask * farAtten);
      }
      void main() {
        vec3 n = normalize(vNormal), viewDir = normalize(cameraPosition - vWorldPos);
        bool highWater = (uQuality > 0.5 && uWaterQuality > 0.5);
        float waveH = 0.0, wakeFoam = 0.0;
        if (vIsTop > 0.5) {
          float waveAmp = mix(1.38, 0.42, smoothstep(0.0, 1.0, vShore));
          vec3 wg = uEclipseMode > 0.5 ? eclipseWaterGrad(vWorldPos.xz, uTime, vDist, highWater) : waterWaveGrad(vWorldPos.xz, uTime, highWater);
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
        vec3 shallowDay = mix(vec3(0.055, 0.27, 0.39), vec3(0.048, 0.30, 0.36), uEclipseMode);
        vec3 deepDay = mix(vec3(0.010, 0.072, 0.175), vec3(0.009, 0.082, 0.165), uEclipseMode);
        vec3 baseDay = mix(shallowDay, deepDay, smoothstep(0.0, 0.85, depthK));
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
          bool isUltraW = (uQuality > 1.5);
          vec3 reflDir = reflect(-viewDir, n);
          vec3 nightSkyRefl = mix(vec3(0.04, 0.09, 0.20), vec3(0.015, 0.035, 0.095), pow(clamp(reflDir.y, 0.0, 1.0), 0.55));
          vec3 daySkyRefl = mix(uSkyHorizon * vec3(0.92, 1.02, 1.06), uSkyTop, pow(clamp(reflDir.y, 0.0, 1.0), 0.46));
          vec3 reflFallback = mix(nightSkyRefl, daySkyRefl, sunUp);
          reflFallback += activeLightCol * pow(max(dot(reflDir, activeLightDir), 0.0), 18.0) * (0.30 * sunUp + 0.18 * nightK);
          vec3 reflCol = reflFallback;
          if (uUsePlanarRefl > 0.5 && highWater && abs(vWorldPos.y - 0.86) < 0.45) {
            vec2 ndc = (vReflClip.xy / max(0.001, vReflClip.w)) * 0.5 + 0.5;
            float shoreCalm = 1.0 - smoothstep(0.0, 1.0, vShore) * 0.65;
            float distDamp = 1.0 / (1.0 + vDist * 0.032);
            vec2 reflUv = ndc + n.xz * vec2(0.022, 0.036) * shoreCalm * distDamp * mix(1.0, 0.92, uEclipseMode);
            float edgeMask = step(0.01, vReflClip.w) * smoothstep(0.0, 0.06, reflUv.x) * smoothstep(1.0, 0.94, reflUv.x)
                           * smoothstep(0.0, 0.08, reflUv.y) * smoothstep(1.0, 0.92, reflUv.y);
            vec3 mapSample = texture2D(uReflMap, clamp(reflUv, 0.004, 0.996)).rgb;
            mapSample = mix(mapSample, max(mapSample, baseWater * 0.72), isUltraW ? 0.22 : 0.30);
            reflCol = mix(reflFallback, mapSample, edgeMask * ((isUltraW ? 0.90 : 0.84) - vShore * (isUltraW ? 0.16 : 0.20)));
          }
          float waveShade = clamp(0.95 + n.x * 0.14 + n.z * 0.14, 0.85, 1.12);
          float reflMix = clamp(fresnel * (isUltraW ? 0.68 : 0.62) + (isUltraW ? 0.07 : 0.05) + max(uDlssMode * 0.03, uEclipseMode * 0.03), 0.08, isUltraW ? 0.72 : 0.66);
          col = mix(baseWater * waveShade, reflCol * waveShade, reflMix);
          // Delicate animated shoreline foam + player/boat wake foam shimmer
          float foamBand = clamp(smoothstep(0.76, 1.0, vShore + waveH * 1.45) * (0.30 + 0.70 * sunUp) + wakeFoam, 0.0, 1.0);
          col = mix(col, vec3(0.86, 0.97, 0.99), foamBand * (isUltraW ? 0.36 : 0.28));

          // Crisp Sun / Moon Specular Glint Path + Broad Sky Shimmer across ripples
          vec3 halfV = normalize(activeLightDir + viewDir);
          float specTight = pow(max(dot(n, halfV), 0.0), mix(230.0, 290.0, max(uDlssMode, uEclipseMode * 0.75))) * activeStrength;
          float specBroad = pow(max(dot(n, halfV), 0.0), mix(34.0, 24.0, uEclipseMode)) * (0.22 * sunUp + 0.14 * nightK);
          col += activeLightCol * (specTight * (isUltraW ? 0.42 : (highWater ? 0.34 : 0.24)) * (1.0 + max(uDlssMode * 0.18, uEclipseMode * 0.22)) + specBroad * (isUltraW ? 0.22 : 0.18) * (1.0 + uEclipseMode * 0.18));
          float wPeak = max(col.r, max(col.g, col.b));
          float wLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float wMetric = mix(wLum, wPeak, 0.45);
          if (wMetric > 0.62) col *= (0.62 + (wMetric - 0.62) / (1.0 + (wMetric - 0.62) * 2.85)) / max(wMetric, 0.0001);

          float baseAlpha = mix(0.78, 0.985, clamp(turbid * 0.86 + depthK * 0.24, 0.0, 1.0));
          alpha = clamp(mix(baseAlpha, 0.99, clamp(fresnel * 0.88, 0.0, 1.0)), 0.76, 0.992);
          if (uEclipseMode > 0.5) alpha = max(alpha, clamp(wakeFoam * 0.62, 0.0, 0.95));
        }

        // v59 THE SIFT: Vivid Swirling Rainbow Ichor Water (matches ref pond: cyan/magenta/pink/gold iridescence!)
        if (uDimension > 2.5) {
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
        if (uUnderwater > 0.5) {
          float uwFogW = (1.0 - exp(-vDist * mix(0.042, 0.125, clamp(uWaterDepth / 34.0, 0.0, 1.0)))) * ((fromBelow && vIsTop > 0.5) ? 0.38 : 1.0);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(uwFogW, 0.0, 0.98)), alpha);
        } else {
          float fogF = smoothstep(uFogStart, uFogEnd, vDist);
          vec3 vDirW = normalize(vWorldPos - cameraPosition);
          float wNoonTame = 1.0 - smoothstep(0.45, 0.92, sunD.y) * mix(0.68, 0.42, uEclipseMode);
          float wScatter = pow(max(dot(vDirW, activeLightDir), 0.0), mix(7.0, 4.0, uEclipseMode)) * activeStrength;
          vec3 wFogBase = uFogColor * mix(0.94, 0.88, smoothstep(0.45, 0.92, sunD.y));
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
      uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd
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
      uniform float uTime, uFogStart, uFogEnd;
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

        float fogF = smoothstep(uFogStart, uFogEnd * 1.12, vDist);
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
      sceneRT = new THREE.WebGLRenderTarget(1280, 720, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
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
        float hiLo = mix(uQuality > 1.5 ? 0.90 : 0.94, mix(0.84, 0.89, uEclipseMode), max(uChillMode, uEclipseMode * 0.9));
        float hiGain = mix(uQuality > 1.5 ? 0.32 : 0.26, mix(0.42, 0.34, uEclipseMode), max(uChillMode, uEclipseMode * 0.85));
        float w = smoothstep(hiLo, 1.18, hi);
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
    uniforms: { tCur: { value: null }, tPrev: { value: null }, uFgMix: { value: 0.0 } },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tCur, tPrev; uniform float uFgMix; varying vec2 vUv;
      void main() {
        vec3 cur = texture2D(tCur, vUv).rgb;
        vec3 prv = texture2D(tPrev, vUv).rgb;
        gl_FragColor = vec4(mix(cur, prv, clamp(uFgMix, 0.0, 0.45)), 1.0);
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
      uUnderwater: envUniforms.uUnderwater, uWaterDepth: envUniforms.uWaterDepth, uTime: envUniforms.uTime,
      uVibrance: envUniforms.uVibrance, uWarmth: envUniforms.uWarmth,
      uExposure: envUniforms.uExposure, uContrast: envUniforms.uContrast,
      uSharpness: envUniforms.uSharpness, uTexelSize: envUniforms.uTexelSize,
      uMoonBoost: envUniforms.uMoonBoost, uDimension: envUniforms.uDimension,
      uHasGodRays: envUniforms.uHasGodRays, uQuality: envUniforms.uQuality,
      uChillMode: envUniforms.uChillMode, uDlssMode: envUniforms.uDlssMode, uEclipseMode: envUniforms.uEclipseMode,
      uLightScreen: envUniforms.uLightScreenPos, uSunVis: envUniforms.uSunVis
    },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tScene, tBloom, tBloomWide, tGodRays;
      uniform float uUnderwater, uWaterDepth, uTime, uVibrance, uWarmth, uExposure, uContrast, uSharpness, uMoonBoost, uDimension, uHasGodRays, uQuality, uChillMode, uDlssMode, uEclipseMode, uSunVis;
      uniform vec2 uTexelSize, uLightScreen;
      varying vec2 vUv;
      // Narkowicz ACES Filmic Tonemap (BSL / Complementary / ShaderLABS standard)
      vec3 acesFilmic(vec3 x) {
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
      }
      void main() {
        vec2 uv = vUv;
        bool isUltraC = (uQuality > 1.5);
        if (uUnderwater > 0.5) {
          uv.x += sin(uv.y * 14.0 + uTime * 2.4) * mix(0.0018, 0.0024, uEclipseMode);
          uv.y += cos(uv.x * 12.0 + uTime * 2.0) * mix(0.0014, 0.0018, uEclipseMode);
        }
        vec3 col = texture2D(tScene, uv).rgb;
        // Crisp Contrast-Adaptive Sharpening (CAS) in DLSS Ultra / Eclipse mode + 4-tap clarity otherwise
        if (uUnderwater < 0.5 && uSharpness > 0.01) {
          vec3 nN = texture2D(tScene, uv + vec2(0.0, uTexelSize.y)).rgb;
          vec3 nS = texture2D(tScene, uv - vec2(0.0, uTexelSize.y)).rgb;
          vec3 nE = texture2D(tScene, uv + vec2(uTexelSize.x, 0.0)).rgb;
          vec3 nW = texture2D(tScene, uv - vec2(uTexelSize.x, 0.0)).rgb;
          if (uDlssMode > 0.5 || uEclipseMode > 0.5) {
            vec3 nNE = texture2D(tScene, uv + vec2(uTexelSize.x, uTexelSize.y)).rgb;
            vec3 nNW = texture2D(tScene, uv + vec2(-uTexelSize.x, uTexelSize.y)).rgb;
            vec3 nSE = texture2D(tScene, uv + vec2(uTexelSize.x, -uTexelSize.y)).rgb;
            vec3 nSW = texture2D(tScene, uv + vec2(-uTexelSize.x, -uTexelSize.y)).rgb;
            vec3 avg8 = (nN + nS + nE + nW + (nNE + nNW + nSE + nSW) * 0.65) / 6.6;
            vec3 mnC = min(col, min(min(nN, nS), min(nE, nW)));
            vec3 mxC = max(col, max(max(nN, nS), max(nE, nW)));
            float shDlss = uSharpness * (isUltraC ? 1.25 : 1.08);
            col = clamp(col + clamp((col - avg8) * shDlss, -0.095, 0.095), mnC * 0.94, mxC * 1.06);
          } else {
            vec3 nb4 = (nN + nS + nE + nW) * 0.25;
            float shGain = uSharpness * (isUltraC ? 1.15 : 1.0);
            col = clamp(col + clamp((col - nb4) * shGain, -0.075, 0.075), 0.0, 1.5);
          }
        }
        // Subtle crisp Bloom, Atmospheric Golden Halo & Volumetric God-Rays
        float bloomBoost = max(uChillMode, max(uDlssMode * 0.72, uEclipseMode * 0.64));
        float bloomMix1 = mix(isUltraC ? 0.055 : 0.040, isUltraC ? 0.078 : 0.062, bloomBoost);
        float bloomMix2 = mix(isUltraC ? 0.028 : 0.016, isUltraC ? 0.044 : 0.030, bloomBoost);
        col += texture2D(tBloom, uv).rgb * bloomMix1 + texture2D(tBloomWide, uv).rgb * bloomMix2;
        if (uUnderwater > 0.5) {
          float abyssT = clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0);
          float topGlow = smoothstep(0.35, 1.0, vUv.y) * exp(-uWaterDepth * 0.045);
          col += vec3(0.02, 0.11, 0.18) * topGlow;
          vec3 uwGrade = mix(vec3(0.84, 0.96, 1.05), vec3(0.44, 0.62, 0.84), abyssT);
          col *= uwGrade * mix(1.0, 0.54, abyssT * abyssT);
        }
        if (uHasGodRays > 0.5) {
          float rayGain = uUnderwater > 0.5
            ? mix(0.65, 0.98, uEclipseMode)
            : mix(isUltraC ? 0.28 : 0.22, isUltraC ? 0.36 : 0.28, max(uChillMode, max(uDlssMode * 0.85, uEclipseMode * 0.85)));
          col += texture2D(tGodRays, uv).rgb * rayGain;
        }
        if (uUnderwater < 0.5 && (uChillMode > 0.5 || uEclipseMode > 0.5) && uSunVis > 0.02) {
          float sunRad = exp(-length((uv - uLightScreen) * vec2(1.45, 1.0)) * mix(3.1, 2.7, uEclipseMode));
          col += vec3(1.0, 0.76, 0.42) * sunRad * clamp(uSunVis * 2.0, 0.0, 1.0) * mix(0.11, 0.11, uEclipseMode);
        }

        // 1. Clean Direct ACES Filmic Tonemap
        float expUse = mix(uExposure, uExposure * 0.94, uUnderwater);
        if (uDimension > 2.5) expUse *= 0.90;
        col = acesFilmic(max(col, vec3(0.0)) * expUse);

        // 2. Gentle Highlight Rolloff
        float hiLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float hiDesat = smoothstep(0.74, 1.0, hiLum) * 0.06 * (1.0 - uUnderwater);
        col = mix(col, vec3(hiLum) * vec3(1.01, 0.99, 0.96), hiDesat);

        // 3. Split-Toning (Eclipse cool slate-teal shadows + warm golden highlights)
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 baseCool = mix(vec3(0.96, 0.97, 1.02), vec3(0.84, 0.90, 1.07), uMoonBoost * 0.72);
        vec3 coolShadows = mix(baseCool, vec3(0.85, 0.88, 1.10), uChillMode * (1.0 - uUnderwater));
        coolShadows = mix(coolShadows, vec3(0.87, 0.93, 1.09), uDlssMode * (1.0 - uUnderwater) * 0.72);
        coolShadows = mix(coolShadows, vec3(0.83, 0.91, 1.06), uEclipseMode * (1.0 - uUnderwater) * 0.85);
        if (uDimension > 2.5) coolShadows = vec3(0.88, 0.89, 1.01);
        else if (uDimension > 1.5) coolShadows = vec3(0.96, 0.88, 1.08);
        else if (uDimension > 0.5) coolShadows = vec3(1.03, 0.90, 0.86);
        col = mix(col * coolShadows, col, smoothstep(0.04, 0.42, lum));

        vec3 warmHigh = vec3(1.0 + uWarmth * 0.42, 1.0 + uWarmth * 0.16, 1.0 - uWarmth * 0.32);
        if (uDimension > 2.5) warmHigh = vec3(1.05, 0.97, 0.99);
        else if (uDimension > 1.5) warmHigh = vec3(1.06, 0.95, 1.12);
        float warmMask = smoothstep(0.10, 0.50, lum) * (1.0 - smoothstep(0.72, 0.96, lum) * 0.72);
        col = mix(col, col * warmHigh, warmMask * (1.0 - uUnderwater * 0.88));

        // 4. Gentle Filmic S-Curve Micro-Contrast
        vec3 sCurve = col * col * (3.0 - 2.0 * col);
        col = mix(col, sCurve, uContrast * (1.0 - uUnderwater * 0.45));

        // 5. Vibrant Color Boost
        float maxCh = max(col.r, max(col.g, col.b));
        float minCh = min(col.r, min(col.g, col.b));
        float satBoost = uVibrance * (1.0 - (maxCh - minCh) * 0.72);
        float lumaV = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(lumaV), col, 1.06 + satBoost);

        // 6. Subtle Cinematic Lens Vignette
        float vigAmt = uUnderwater > 0.5 ? mix(0.22, 0.48, clamp(log(1.0 + uWaterDepth * 0.045) / 3.481, 0.0, 1.0)) : mix(0.14, 0.19, max(uChillMode, uEclipseMode * 0.75));
        float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * vigAmt;
        col *= vig;
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
  const offhandPivot = new THREE.Group();
  offhandPivot.position.set(-0.46, -0.36, -0.62);
  camera.add(offhandPivot);
  const heldModelCache = new Map();
  const offhandModelCache = new Map();
  let activeHeldObj = null;
  let activeOffhandObj = null;

  function buildEmptyHandMesh() {
    const g = new THREE.Group();
    const sk = (typeof getSkinDef === 'function' && typeof selectedSkinId === 'string') ? getSkinDef(selectedSkinId) : { slim: true };
    const isSlim = (typeof isSkinSlim === 'function') ? isSkinSlim(selectedSkinId) : !!sk.slim;
    const tex = (typeof getSkinTexture === 'function') ? getSkinTexture(selectedSkinId) : null;
    const wPx = isSlim ? 3 : 4;
    const armMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02, alphaTest: 0.1 });
    const sleeveMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const armMesh = makeSkinBox(wPx, 12, 4, 40, 16, armMat, 0.048, 0);
    const sleeveMesh = makeSkinBox(wPx, 12, 4, 40, 32, sleeveMat, 0.048, 0.003);
    armMesh.position.set(0, -0.09, 0);
    sleeveMesh.position.set(0, -0.09, 0);
    g.add(armMesh, sleeveMesh);
    g.position.set(0.06, -0.14, 0.02);
    g.rotation.set(0.45, -0.45, 0.22);
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

  // Shared 3D Stepped Voxel Dragon Egg builder (non-overlapping bands used by 1st/3rd person hand + placed world egg)
  function _buildDragonEggMesh(pal, scale = 1.0) {
    const g = new THREE.Group();
    const p = pal || { base: 0x3b0a0a, shell: 0xb91c1c, band: 0xf97316, spot: 0xfef08a };
    const mBase = new THREE.MeshStandardMaterial({ color: p.base, roughness: 0.55, metalness: 0.15 });
    const mShell = new THREE.MeshStandardMaterial({ color: p.shell, roughness: 0.35, metalness: 0.20, emissive: p.shell, emissiveIntensity: 0.16 });
    const mBand = new THREE.MeshStandardMaterial({ color: p.band, roughness: 0.25, metalness: 0.25, emissive: p.band, emissiveIntensity: 0.45 });
    const mSpot = new THREE.MeshStandardMaterial({ color: p.spot, roughness: 0.18, emissive: p.spot, emissiveIntensity: 0.72 });
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
    return g;
  }

  function build3DSculptedSpecialItem(blockId, meta = null) {
    const _aDef = BLOCK_DEF[blockId];
    if (_aDef && _aDef.dragonEgg) {
      const g = _buildDragonEggMesh(_aDef.eggPal, 0.32);
      g.children.forEach(c => { c.position.y -= 0.12; });
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
    if (blockId === B.LANTERN) {
      // Sculpted 3D Iron-and-Amber Hanging Lantern (matches hotbar icon 1:1 in 1st-person, offhand & 3rd-person!)
      if (!build3DSculptedSpecialItem._lanternCoreTex) {
        const lcv = document.createElement('canvas'); lcv.width = 16; lcv.height = 16;
        const lc = lcv.getContext('2d');
        for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
          const edge = (px <= 1 || px >= 14 || py <= 1 || py >= 14);
          const midFrame = (px === 2 || px === 13 || py === 2 || py === 13);
          const core = (px >= 6 && px <= 9 && py >= 6 && py <= 10);
          const inner = (px >= 4 && px <= 11 && py >= 4 && py <= 12);
          lc.fillStyle = edge ? '#232933' : (midFrame ? '#b45309' : (core ? '#fef9c3' : (inner ? '#fbbf24' : '#d97706')));
          lc.fillRect(px, py, 1, 1);
        }
        const ltex = new THREE.CanvasTexture(lcv);
        ltex.magFilter = THREE.NearestFilter; ltex.minFilter = THREE.NearestFilter; ltex.generateMipmaps = false;
        build3DSculptedSpecialItem._lanternCoreTex = ltex;
      }
      const g = new THREE.Group();
      const body = new THREE.Group();
      const mkBox = (w, h, d, col, x, y, z, emit = 0, tex = null) => {
        const mat = new THREE.MeshStandardMaterial({
          map: tex, color: tex ? 0xffffff : col, roughness: emit ? 0.40 : 0.45, metalness: emit ? 0.0 : 0.52,
          emissive: emit ? new THREE.Color(emit) : new THREE.Color(0), emissiveIntensity: emit ? 0.46 : 0
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); body.add(m); return m;
      };
      // Bottom wrought-iron plate
      mkBox(0.175, 0.032, 0.175, 0x262d38, 0, -0.105, 0);
      // Warm glowing candle glass cube with pixel-art flame core
      mkBox(0.138, 0.168, 0.138, 0xfbbf24, 0, -0.005, 0, 0xffa822, build3DSculptedSpecialItem._lanternCoreTex);
      // 4 crisp corner iron pillars
      for (const sx of [-0.072, 0.072]) for (const sz of [-0.072, 0.072]) mkBox(0.022, 0.176, 0.022, 0x1e242d, sx, -0.005, sz);
      // Stepped wrought-iron hood + chimney cap
      mkBox(0.178, 0.032, 0.178, 0x2d3542, 0,  0.092, 0);
      mkBox(0.122, 0.038, 0.122, 0x3b4657, 0,  0.126, 0);
      // 3D Top Hanging Iron Ring / Chain Loop
      mkBox(0.018, 0.044, 0.018, 0x64748b, -0.026, 0.166, 0);
      mkBox(0.018, 0.044, 0.018, 0x64748b,  0.026, 0.166, 0);
      mkBox(0.070, 0.018, 0.018, 0x94a3b8,  0.0,   0.188, 0);
      mkBox(0.026, 0.026, 0.026, 0x64748b,  0.0,   0.205, 0);
      g.add(body);
      g.position.set(0.02, -0.01, -0.04);
      g.rotation.set(0.08, -0.45, 0.03);
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
      const isPhx = (blockId === B.ELYTRA_PHOENIX);
      const g = new THREE.Group();
      const cA = new THREE.MeshStandardMaterial({ color: isPhx ? 0x180a0a : 0x45445c, roughness: 0.45, metalness: 0.28 });
      const cB = new THREE.MeshStandardMaterial({ color: isPhx ? 0xea580c : 0x7e7d99, roughness: 0.42, metalness: 0.24, emissive: isPhx ? 0x9a3412 : 0x000000, emissiveIntensity: isPhx ? 0.25 : 0 });
      const cC = new THREE.MeshStandardMaterial({ color: isPhx ? 0xfbbf24 : 0xa5a4c2, roughness: 0.36, metalness: 0.20, emissive: isPhx ? 0xf59e0b : 0x000000, emissiveIntensity: isPhx ? 0.55 : 0 });
      const addSlat = (w, h, d, x, y, z, m, rz = 0) => {
        const bm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        bm.position.set(x, y, z); if (rz) bm.rotation.z = rz; g.add(bm);
      };
      // Shoulder collar bar + stepped pixelated twin wings matching 62f02c71 / fd49b18a sprites
      addSlat(0.14, 0.032, 0.032, 0, 0.115, 0.002, cA);
      const tiers = [
        [0.036, 0.20, 0.028, 0.030,  0.005, 0.002, cA, 0.08],
        [0.038, 0.23, 0.028, 0.056, -0.010, 0.000, cB, 0.14],
        [0.038, 0.23, 0.026, 0.082, -0.024,-0.002, cC, 0.18],
        [0.034, 0.17, 0.024, 0.106, -0.042,-0.004, isPhx ? cA : cB, 0.22]
      ];
      for (const sx of [-1, 1]) {
        for (const [w, h, d, x, y, z, m, rz] of tiers) addSlat(w, h, d, sx * x, y, z, m, sx * -rz);
      }
      g.rotation.order = 'YXZ'; g.position.set(0.01, 0.01, -0.05); g.rotation.set(0.18, -0.45, 0.08);
      g.userData.iconReady = true;
      return g;
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
    if (blockId === B.GLOW_CRYSTAL || blockId === B.ICHOR_CRYSTAL || blockId === B.ECHO_SHARD || blockId === B.MOONSTONE_GEM || blockId === B.DREAM_PRISM_GEM || blockId === B.DRAGON_CRYSTAL) {
      // Sculpted 3D Multi-Spire Glowing Amethyst / Crystal Cluster (matches media_1795287473580_5e1d17a6.jpg!)
      const g = new THREE.Group();
      const cPal = blockId === B.DRAGON_CRYSTAL
        ? { main: 0xf59e0b, tip: 0x67e8f9, emit: 0xd97706, base: 0x292524 }
        : (blockId === B.ICHOR_CRYSTAL
        ? { main: 0xf472b6, tip: 0xfef08a, emit: 0xec4899, base: 0x4c1d95 }
        : (blockId === B.ECHO_SHARD
          ? { main: 0x06b6d4, tip: 0xa5f3fc, emit: 0x0891b2, base: 0x0f172a }
          : (blockId === B.END_CRYSTAL_BLOCK
            ? { main: 0xe879f9, tip: 0xfdf4ff, emit: 0xd946ef, base: 0x3b0764 }
            : (blockId === B.MOONSTONE_GEM
              ? { main: 0xa5b4fc, tip: 0xf8fafc, emit: 0x6366f1, base: 0x1e1b4b }
              : (blockId === B.DREAM_PRISM_GEM
                ? { main: 0xffffff, tip: 0xffffff, emit: 0xffffff, base: 0x1e293b }
                : { main: 0xa855f7, tip: 0xf3e8ff, emit: 0x9333ea, base: 0x2e1065 })))));
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
      const g = new THREE.Group();
      const [tTop, tSide, tBot] = _itemDef.tiles || [184, 17, 184];
      const core = _makeAtlasBox(0.225, 0.27, 0.225, tTop, tSide, tBot);
      const spineMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85 });
      for (const sy of [-0.07, 0.06]) {
        const sx = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.018, 0.018), spineMat); sx.position.set(0, sy, 0.055);
        const sz = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.245), spineMat); sz.position.set(-0.055, sy, 0);
        g.add(sx, sz);
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
  function build3DVoxelItemMesh(blockId) {
    const def = BLOCK_DEF[blockId];
    const tile = def.itemTile !== undefined ? def.itemTile : def.tiles[1];
    let imgData = null;
    let usedOfficialIcon = false;
    const _vKey = (typeof BLOCK_ID_TO_KEY !== 'undefined') ? BLOCK_ID_TO_KEY[blockId] : null;
    const _vIm = (_vKey && typeof _mcItemImgs !== 'undefined') ? _mcItemImgs.get(_vKey) : null;
    if (_vIm && _vIm.complete && _vIm.naturalWidth > 0) {
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
      blockId === B.DRAGON_SCALE || blockId === B.DRAGON_BONE || blockId === B.DRAGON_SADDLE || blockId === B.DRAGON_CRYSTAL || !!def.smithTemplate ||
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
    const flipDiag = (def.tool === 'axe' || def.tool === 'bow');
    const getPxIdx = (x, y) => (flipDiag ? ((15 - x) * 16 + (15 - y)) : (y * 16 + x)) * 4;
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
    const isWarmGlow = (blockId === B.FIRE_SWORD || blockId === B.DRAGON_BONE_SWORD || blockId === B.DRAGON_CRYSTAL || blockId === B.DRAGON_SCALE || blockId === B.LAVA_BUCKET || blockId === B.TORCH_BLOCK || blockId === B.GOLD_APPLE || blockId === B.GOLDEN_CARROT || blockId === B.WATER_BREATH_POTION || blockId === B.NIGHT_VISION_POTION || blockId === B.TOTEM_UNDYING || blockId === B.SWIFT_SNEAK_BOOK || blockId === B.DREAM_FRUIT);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: isRainbowItem ? 0.22 : (isChunky ? 0.62 : 0.72),
      metalness: isRainbowItem ? 0.45 : ((blockId === B.GOLD_APPLE || blockId === B.GOLDEN_CARROT || blockId === B.TOTEM_UNDYING) ? 0.28 : 0.06),
      emissive: isWarmGlow ? new THREE.Color(blockId === B.WATER_BREATH_POTION || blockId === B.SWIFT_SNEAK_BOOK ? 0x06b6d4 : (blockId === B.NIGHT_VISION_POTION ? 0x3b82f6 : (blockId === B.DREAM_FRUIT ? 0xec4899 : (blockId === B.GOLD_APPLE || blockId === B.GOLDEN_CARROT || blockId === B.TOTEM_UNDYING ? 0xf59e0b : 0xea580c)))) : new THREE.Color(0x000000),
      emissiveIntensity: isWarmGlow ? 0.22 : 0.0
    });
    if (isRainbowItem) {
      mat.userData = { isRainbowItem: true };
      _rainbowMats.add(mat);
      applyRainbowToMat(mat, _dreamRainbowHue);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.iconReady = usedOfficialIcon || !_vIm;
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
      // Authentic 3D extruded pixel-art Minecraft Bow: curved wood outward/forward, string facing player!
      mesh.position.set(-0.01, 0.01, -0.04);
      mesh.rotation.set(0.06, 1.72, 0.14);
    } else if (def.tool === 'rod' || isForwardShaft) {
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
      || ((def.voxelItem || !def.solid) ? build3DVoxelItemMesh(safeId) : build3DTexturedBlockMesh(safeId));
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
      else if (offId === B.LANTERN) { m.position.set(0.03, -0.01, -0.04); m.rotation.set(0.08, 0.45, -0.03); }
      if (!m.userData || m.userData.iconReady !== false) offhandModelCache.set(offId, m);
      activeOffhandObj = m;
    } else {
      activeOffhandObj = cached;
    }
    offhandPivot.add(activeOffhandObj);
  }

  function _itemMetaCacheKey(blockId, meta) {
    if (!blockId) return 0;
    const t = meta && meta.trim;
    return (t && t.pattern) ? `${blockId}:${t.pattern}:${t.matId || t.hex || ''}` : blockId;
  }

  let _fpEmptySkin = '';
  let _fpToolArmWrap = null;
  let _fpToolArmSkin = '';

  function updateHeldViewModel(blockId, meta = null) {
    const _skinNow = String((typeof window !== 'undefined' && window.selectedSkinId) || 'steve');
    if (_skinNow !== _fpEmptySkin) {
      heldModelCache.delete(0);
      _fpEmptySkin = _skinNow;
    }
    const _heldKey = _itemMetaCacheKey(blockId || 0, meta);
    const keyChanged = (typeof player !== 'undefined' && player && player._lastHeldKey !== _heldKey);
    if (keyChanged) {
      player._lastHeldId = blockId || 0;
      player._lastHeldKey = _heldKey;
      player.equipPopT = 1.0; // Punchy! / Move Those Hands snappy draw-equip pop!
      const swDef = (blockId && BLOCK_DEF[blockId]) ? BLOCK_DEF[blockId] : null;
      const cdMax = typeof getWeaponAttackCooldown === 'function' ? getWeaponAttackCooldown(swDef) : 0.45;
      player.atkCdMax = cdMax;
      player.atkCd = cdMax;
      if (!(swDef && swDef.tool === 'sword')) { player.swordCombo = 0; player.comboResetT = 0; }
    }
    const _defHeld = (blockId && BLOCK_DEF[blockId]) ? BLOCK_DEF[blockId] : null;
    const _showToolArm = !!(_defHeld && (_defHeld.tool || blockId === B.TRIDENT));
    if (_showToolArm) {
      if (!_fpToolArmWrap || _fpToolArmSkin !== _skinNow) {
        if (_fpToolArmWrap) heldPivot.remove(_fpToolArmWrap);
        _fpToolArmWrap = new THREE.Group();
        const arm = buildEmptyHandMesh();
        arm.position.set(0, 0, 0);
        arm.rotation.set(0, 0, 0);
        _fpToolArmWrap.add(arm);
        _fpToolArmWrap.position.set(0.055, -0.155, 0.085);
        _fpToolArmWrap.rotation.set(1.18, -0.18, 0.14);
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
    if (activeHeldObj) { heldPivot.remove(activeHeldObj); activeHeldObj = null; }
    if (typeof playerAvatar !== 'undefined' && playerAvatar && typeof setRigHeldItem === 'function') {
      setRigHeldItem(playerAvatar, blockId || 0, meta);
    }
    if (typeof invPreviewRig !== 'undefined' && invPreviewRig && typeof setRigHeldItem === 'function') {
      setRigHeldItem(invPreviewRig, blockId || 0, meta);
    }
    if (!blockId || blockId === B.AIR || !_defHeld) {
      if (!heldModelCache.has(0)) heldModelCache.set(0, buildEmptyHandMesh());
      activeHeldObj = heldModelCache.get(0);
      heldPivot.add(activeHeldObj);
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
    heldPivot.add(activeHeldObj);
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
  const _moteMat = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.84, sizeAttenuation: true, depthWrite: false });
  const _motePoints = new THREE.Points(_moteGeo, _moteMat);
  _motePoints.frustumCulled = false;
  scene.add(_motePoints);
  let _lastMoteMode = '';
  function updateAirMotesBatch(dt, show, mode) {
    _motePoints.visible = show;
    if (!show) return;
    _moteMat.opacity = mode === 'underwater' ? 0.72 : ((mode === 'sift' || mode === 'golden') ? 0.90 : 0.78);
    _moteMat.size = mode === 'underwater' ? 0.11 : ((mode === 'golden' || mode === 'night') ? 0.22 : 0.17);
    const needCol = (mode !== _lastMoteMode || mode === 'night' || mode === 'golden');
    const px = player.x, py = player.y, pz = player.z;
    for (let i = 0; i < _moteCount; i++) {
      const m = airMotes[i], b = i * 3;
      if (!m.init || Math.abs(m.wx - px) > 26 || Math.abs(m.wz - pz) > 26 || Math.abs(m.wy - py) > 16) {
        m.wx = px + (Math.random() - 0.5) * 44;
        m.wz = pz + (Math.random() - 0.5) * 44;
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

  // Eclipse 3D Ultra-Dense Grass Carpet (7x7 / 8x8 stratified tiles + 90deg overlay = 98-128 blades/m² within 11m, seamless edge-to-edge)
  const _isLiteGrass = (_isMobilePerf || (_hwProfile && _hwProfile.gpu && _hwProfile.gpu.isSoftware));
  const ECLIPSE_GRASS_MAX = _isMobilePerf ? 2200 : (_isLiteGrass ? 3000 : 6200);
  const grassInstGeo = (() => {
    const pos = [], bladeH = [], bladeSide = [], idx = [];
    let vc = 0;
    const halton = (i, base) => {
      let f = 1, r = 0, n = i;
      while (n > 0) { f /= base; r += f * (n % base); n = Math.floor(n / base); }
      return r;
    };
    const COLS = _isLiteGrass ? 6 : 8;
    const BLADES = COLS * COLS;
    const cellSpan = 0.97 / COLS;
    const tiers = [0.0, 0.50];
    const wScale = [1.0, 0.62];
    const leanScale = [0.0, 0.36];
    for (let b = 0; b < BLADES; b++) {
      const gx = b % COLS, gz = Math.floor(b / COLS);
      const ox = Math.max(-0.492, Math.min(0.492, -0.485 + (gx + 0.5) * cellSpan + (halton(b + 1, 2) - 0.5) * cellSpan * 0.68));
      const oz = Math.max(-0.492, Math.min(0.492, -0.485 + (gz + 0.5) * cellSpan + (halton(b + 1, 3) - 0.5) * cellSpan * 0.68));
      const f1 = halton(b + 4, 5), f2 = halton(b + 7, 7);
      const yaw = f1 * 6.283185;
      const h = 0.40 + f2 * 0.30;
      const w = 0.050 + (1.0 - f2) * 0.020;
      const lean = 0.14 + halton(b + 3, 11) * 0.18;
      const ca = Math.cos(yaw), sa = Math.sin(yaw);
      const rx = ca, rz = sa, fx = -sa, fz = ca;
      const tipX = Math.max(-0.48, Math.min(0.48, ox + fx * lean));
      const tipZ = Math.max(-0.48, Math.min(0.48, oz + fz * lean));
      const dxTip = tipX - ox, dzTip = tipZ - oz;
      const baseV = vc;
      for (let t = 0; t < tiers.length; t++) {
        const y = -0.02 + h * tiers[t];
        const hw = w * wScale[t], ln = leanScale[t];
        const cx = ox + dxTip * ln, cz = oz + dzTip * ln;
        pos.push(cx - rx * hw, y, cz - rz * hw);
        bladeH.push(tiers[t]); bladeSide.push(-1.0);
        pos.push(cx + rx * hw, y, cz + rz * hw);
        bladeH.push(tiers[t]); bladeSide.push(1.0);
        vc += 2;
      }
      pos.push(tipX, -0.02 + h, tipZ);
      bladeH.push(1.0); bladeSide.push(0.0);
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
    g.setIndex(idx);
    g.instanceCount = 0;
    return g;
  })();
  const _egInstPos = new Float32Array(ECLIPSE_GRASS_MAX * 4);
  const _egInstCol = new Float32Array(ECLIPSE_GRASS_MAX * 4);
  const _egInstAo = new Float32Array(ECLIPSE_GRASS_MAX);
  const _egPosAttr = new THREE.InstancedBufferAttribute(_egInstPos, 4);
  const _egColAttr = new THREE.InstancedBufferAttribute(_egInstCol, 4);
  const _egAoAttr = new THREE.InstancedBufferAttribute(_egInstAo, 1);
  if (typeof THREE.DynamicDrawUsage !== 'undefined') {
    if (_egPosAttr.setUsage) _egPosAttr.setUsage(THREE.DynamicDrawUsage);
    if (_egColAttr.setUsage) _egColAttr.setUsage(THREE.DynamicDrawUsage);
    if (_egAoAttr.setUsage) _egAoAttr.setUsage(THREE.DynamicDrawUsage);
  }
  grassInstGeo.setAttribute('aInstPos', _egPosAttr);
  grassInstGeo.setAttribute('aInstCol', _egColAttr);
  grassInstGeo.setAttribute('aInstAo', _egAoAttr);

  const eclipseGrassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: envUniforms.uTime, uWindStrength: envUniforms.uWindStrength,
      uPlayerPos: envUniforms.uPlayerPos, uGrassRadius: envUniforms.uGrassRadius,
      uSunDir: envUniforms.uSunDir, uSunColor: envUniforms.uSunColor,
      uSkyTop: envUniforms.uSkyTop, uFogColor: envUniforms.uFogColor,
      uFogStart: envUniforms.uFogStart, uFogEnd: envUniforms.uFogEnd
    },
    vertexShader: `
      attribute float aBladeH;
      attribute float aBladeSide;
      attribute vec4 aInstPos;
      attribute vec4 aInstCol;
      attribute float aInstAo;
      uniform float uTime, uWindStrength, uGrassRadius;
      uniform vec3 uPlayerPos;
      varying vec3 vCol, vWPos;
      varying float vH, vSide, vDist, vSkyAo;
      void main() {
        float c = cos(aInstCol.w), s = sin(aInstCol.w);
        vec3 lp = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
        vec3 wp = lp + aInstPos.xyz;
        float distXZ = length(wp.xz - uPlayerPos.xz);
        float distFade = 1.0 - smoothstep(uGrassRadius * 0.68, uGrassRadius, distXZ);
        if (distFade <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        lp.y = (lp.y + 0.02) * aInstPos.w * distFade - 0.02;
        wp = lp + aInstPos.xyz;
        // Eclipse rolling gust sway + smooth radial player foot parting
        float curv = aBladeH * aBladeH;
        float gust = 0.72 + 0.44 * sin(uTime * 1.15 + wp.x * 0.22 + wp.z * 0.18);
        float wX = (sin(uTime * 2.55 + wp.x * 0.85 + wp.z * 0.55) * 0.095 + 0.025) * gust * uWindStrength * curv * aInstPos.w;
        float wZ = cos(uTime * 2.05 + wp.z * 0.90 - wp.x * 0.45) * 0.072 * gust * uWindStrength * curv * aInstPos.w;
        vec2 pd = wp.xz - uPlayerPos.xz;
        float pLen = length(pd);
        float pPush = smoothstep(0.55, 0.05, pLen) * smoothstep(1.35, 0.1, abs(wp.y - uPlayerPos.y)) * 0.14 * curv;
        vec2 pDir = pLen > 0.001 ? (pd / pLen) : vec2(0.0);
        wp.x += wX + pDir.x * pPush;
        wp.z += wZ + pDir.y * pPush;
        wp.y -= (length(vec2(wX, wZ)) * 0.30 + pPush * 0.34);
        vCol = aInstCol.rgb; vWPos = wp; vH = aBladeH; vSide = aBladeSide; vSkyAo = aInstAo;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uSunDir, uSunColor, uSkyTop, uFogColor;
      uniform float uTime, uFogStart, uFogEnd;
      varying vec3 vCol, vWPos;
      varying float vH, vSide, vDist, vSkyAo;
      void main() {
        vec3 sDir = normalize(uSunDir);
        vec3 vDir = normalize(vWPos - cameraPosition);
        float sunUp = smoothstep(-0.08, 0.28, sDir.y);
        // Hue-preserving AO root -> vivid mid -> sunlit tip (green, warm autumn orange, and cool/pink/violet Dream flora)
        float warmG = smoothstep(0.05, 0.35, vCol.r - vCol.g);
        float coolB = smoothstep(0.36, 0.58, vCol.b);
        vec3 rootCol = vCol * mix(mix(vec3(0.11, 0.23, 0.08), vec3(0.24, 0.15, 0.08), warmG), vec3(0.20, 0.20, 0.26), coolB);
        vec3 midCol = vCol * mix(mix(vec3(0.78, 0.92, 0.68), vec3(0.95, 0.82, 0.64), warmG), vec3(0.88, 0.88, 0.96), coolB);
        vec3 tipCol = vCol * mix(mix(vec3(1.06, 1.15, 0.74), vec3(1.16, 1.04, 0.72), warmG), vec3(1.12, 1.12, 1.16), coolB);
        vec3 bladeGrad = vH < 0.50 ? mix(rootCol, midCol, vH / 0.50) : mix(midCol, tipCol, (vH - 0.50) / 0.50);
        float midRidg = 1.0 - abs(vSide) * 0.26;
        vec3 base = bladeGrad * midRidg;
        float cloudShade = 0.78 + 0.22 * sin(vWPos.x * 0.08 + uTime * 0.18) * cos(vWPos.z * 0.07 - uTime * 0.14);
        vec3 aoShade = mix(vec3(0.32, 0.40, 0.56), vec3(1.0), vSkyAo) * cloudShade;
        float nightScale = mix(0.18, 1.0, sunUp);
        vec3 litCol = base * aoShade * mix(vec3(0.42, 0.56, 0.82), vec3(0.96, 1.00, 0.94), sunUp) * nightScale;
        float sss = pow(max(dot(vDir, sDir), 0.0), 2.8) * 0.50 + 0.14;
        litCol += vCol * uSunColor * sss * smoothstep(0.18, 1.0, vH) * vSkyAo * sunUp;
        float tipSheen = smoothstep(0.45, 1.0, vH) * (1.0 - abs(vSide)) * 0.12 * vSkyAo * sunUp;
        litCol += uSunColor * tipSheen;
        litCol += vCol * uSkyTop * 0.09 * smoothstep(0.28, 1.0, vH) * (0.25 + 0.75 * sunUp) * vSkyAo;
        litCol += vec3(0.18, 0.32, 0.48) * smoothstep(0.55, 1.0, vH) * (1.0 - sunUp) * 0.08 * vSkyAo;
        float fogF = smoothstep(uFogStart, uFogEnd, vDist);
        float sunSc = pow(max(dot(vDir, sDir.y > -0.05 ? sDir : -sDir), 0.0), 4.2) * (sDir.y > -0.05 ? sunUp : 0.35);
        vec3 fogCol = mix(uFogColor * 0.92, min(uSunColor * 1.05, vec3(1.0, 0.91, 0.78)), sunSc * 0.46);
        gl_FragColor = vec4(mix(litCol, fogCol, fogF), 1.0);
      }`
  });
  const eclipseGrassMesh = new THREE.Mesh(grassInstGeo, eclipseGrassMat);
  eclipseGrassMesh.frustumCulled = false;
  eclipseGrassMesh.visible = false;
  scene.add(eclipseGrassMesh);

  let _egLastX = 1e9, _egLastZ = 1e9, _egLastDim = '', _egLastCount = 0;
  const _egBiomeCache = new Map();
  function getEclipseGrassCount() { return eclipseGrassMesh.visible ? _egLastCount : 0; }
  function getEclipseGrassColorStats() {
    let warmAutumn = 0, dream = 0, green = 0;
    const total = eclipseGrassMesh.visible ? _egLastCount : 0;
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      const r = _egInstCol[o], g = _egInstCol[o + 1], b = _egInstCol[o + 2];
      if (b > 0.45) dream++;
      else if (r > 0.65 && g < 0.65 && b < 0.25) warmAutumn++;
      else if (g > r) green++;
    }
    return { total, warmAutumn, dream, green };
  }
  function updateEclipseGrass(force = false) {
    if (shaderPreset !== 'eclipse' ||
        typeof chunks === 'undefined' || typeof B === 'undefined' || typeof player === 'undefined' ||
        currentDimension === 'nether' || currentDimension === 'end' || depthOffset > 0 || player.y < -10) {
      if (eclipseGrassMesh.visible) eclipseGrassMesh.visible = false;
      return;
    }
    if (force) { _egLastX = 1e9; _egLastZ = 1e9; }
    const moved = Math.hypot(player.x - _egLastX, player.z - _egLastZ);
    if (!force && !window._eclipseGrassDirty && moved < 3.0 && currentDimension === _egLastDim) return;
    _egLastX = player.x; _egLastZ = player.z; _egLastDim = currentDimension;
    window._eclipseGrassDirty = false;

    const effMax = (typeof _autoPerfTier !== 'undefined' && _autoPerfTier >= 2)
      ? Math.floor(ECLIPSE_GRASS_MAX * 0.50)
      : ((typeof _autoPerfTier !== 'undefined' && _autoPerfTier === 1) ? Math.floor(ECLIPSE_GRASS_MAX * 0.72) : ECLIPSE_GRASS_MAX);
    _egBiomeCache.clear();
    const hasBiomeFn = (typeof getBiomeAt === 'function');

    const rad = envUniforms.uGrassRadius ? envUniforms.uGrassRadius.value : (_isMobilePerf ? 20 : 36);
    const radI = Math.floor(rad), radSq = rad * rad;
    const px = Math.floor(player.x), pz = Math.floor(player.z);
    const minLy = Math.max(0, Math.floor(player.y - 12) - MIN_Y);
    const maxCapLy = WORLD_H - 2;
    let cnt = 0, maxEmitD2 = 0;
    let cacheCx = 999999, cacheCz = 999999, cacheCh = null;

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
      const colOff = ((wz & 15) << 4) | (wx & 15);
      for (let ly = maxLy; ly >= minLy && cnt < effMax; ly--) {
        const id = data[(ly << 8) | colOff];
        if (id === B.STONE || id === B.DEEPSLATE || id === B.WATER || id === B.SANDSTONE) break;
        if (id !== B.GRASS && id !== B.SIFT_GRASS && id !== B.LULLABY_GRASS && id !== B.SPORE_TURF && id !== B.BLUE_GRASS && id !== B.MOSS_BLOCK && id !== B.AUTUMN_PODZOL) continue;
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
        let cr = 0.28, cg = 0.84, cb = 0.14;
        if (id === B.AUTUMN_PODZOL) {
          if (typeof BIOMES !== 'undefined' && bio === BIOMES.AUTUMN_GOLDEN) { cr = 0.94; cg = 0.54; cb = 0.10; }
          else { cr = 0.88; cg = 0.42; cb = 0.08; }
        } else if (id === B.SIFT_GRASS) { cr = 0.26; cg = 0.78; cb = 0.60; }
        else if (id === B.LULLABY_GRASS) { cr = 0.94; cg = 0.48; cb = 0.70; }
        else if (id === B.SPORE_TURF) { cr = 0.58; cg = 0.38; cb = 0.96; }
        else if (id === B.BLUE_GRASS) { cr = 0.16; cg = 0.72; cb = 0.66; }
        else if (id === B.MOSS_BLOCK) { cr = 0.28; cg = 0.64; cb = 0.16; }
        else if (typeof BIOMES !== 'undefined' && bio) {
          if (bio === BIOMES.PLAINS || bio === BIOMES.LUSH_STEPPE || bio === BIOMES.FLOWER_MEADOW || bio === BIOMES.HIGHLAND_PLATEAU) {
            cr = 0.34; cg = 0.88; cb = 0.13;
          } else if (bio === BIOMES.DARK_FOREST) { cr = 0.19; cg = 0.54; cb = 0.14; }
          else if (bio === BIOMES.PALE_GARDEN) { cr = 0.48; cg = 0.56; cb = 0.52; }
          else if (bio === BIOMES.NIGHTMARE_WOODS) { cr = 0.40; cg = 0.18; cb = 0.34; }
          else if (bio === BIOMES.SNOW || bio === BIOMES.ALPINE_PEAKS || bio === BIOMES.MEGA_SNOW_PEAKS || bio === BIOMES.TAIGA) { cr = 0.28; cg = 0.60; cb = 0.34; }
          else if (bio === BIOMES.AUTUMN || bio === BIOMES.AUTUMN_GOLDEN || bio === BIOMES.AUTUMN_DEEP || bio === BIOMES.DAPPLED_FOREST) {
            cr = (bio === BIOMES.AUTUMN_GOLDEN) ? 0.94 : 0.90;
            cg = (bio === BIOMES.AUTUMN_GOLDEN) ? 0.56 : 0.45;
            cb = 0.09;
          }
          else if (bio === BIOMES.SAVANNA || bio === BIOMES.MESA || bio === BIOMES.DESERT) { cr = 0.66; cg = 0.68; cb = 0.20; }
        }

        const macroH = 0.88 + 0.38 * (0.5 + 0.5 * Math.sin(wx * 0.24 + Math.cos(wz * 0.21) * 1.3));
        const nearTiles = (d2 <= 100) ? 2 : 1;
        const lodScale = (d2 <= 100) ? 1.05 : 1.18;
        if (d2 > maxEmitD2) maxEmitD2 = d2;
        let h = Math.imul(wx * 374761 + wz * 668265 + wy * 214748, 0x85ebca6b) >>> 0;
        const baseAng = (h & 3) * (Math.PI * 0.5); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        const baseSc = (0.72 + ((h & 255) / 255) * 0.33) * macroH * lodScale; h >>>= 8;
        const hueShift = (((h & 63) / 63) - 0.5) * 0.12;
        const rc = Math.max(0.05, Math.min(1.0, cr + hueShift));
        const gc = Math.max(0.08, Math.min(1.0, cg + hueShift * 0.65));
        const bc = Math.max(0.04, Math.min(1.0, cb - hueShift * 0.3));

        for (let t = 0; t < nearTiles && cnt < effMax; t++) {
          const base = cnt * 4;
          _egInstPos[base] = wx + 0.5;
          _egInstPos[base + 1] = wy + 1.0;
          _egInstPos[base + 2] = wz + 0.5;
          _egInstPos[base + 3] = baseSc * (t === 0 ? 1.0 : 0.90);
          _egInstCol[base] = rc;
          _egInstCol[base + 1] = gc;
          _egInstCol[base + 2] = bc;
          _egInstCol[base + 3] = baseAng + (t === 0 ? 0.0 : 1.570796);
          _egInstAo[cnt] = skyAO;
          cnt++;
        }
      }
    };

    // Outward radial square rings from camera center guarantee 360-degree full grass coverage near player!
    emitColumn(px, pz, 0);
    for (let ring = 1; ring <= radI && cnt < effMax; ring++) {
      const rz2 = ring * ring;
      for (let dx = -ring; dx <= ring && cnt < effMax; dx++) {
        const d2 = dx * dx + rz2;
        if (d2 <= radSq) {
          emitColumn(px + dx, pz - ring, d2);
          if (cnt < effMax) emitColumn(px + dx, pz + ring, d2);
        }
      }
      for (let dz = -ring + 1; dz <= ring - 1 && cnt < effMax; dz++) {
        const d2 = rz2 + dz * dz;
        if (d2 <= radSq) {
          emitColumn(px - ring, pz + dz, d2);
          if (cnt < effMax) emitColumn(px + ring, pz + dz, d2);
        }
      }
    }
    _egLastCount = cnt;
    grassInstGeo.instanceCount = cnt;
    if (cnt > 0) {
      if (_egPosAttr.updateRange) { _egPosAttr.updateRange.offset = 0; _egPosAttr.updateRange.count = cnt * 4; }
      if (_egColAttr.updateRange) { _egColAttr.updateRange.offset = 0; _egColAttr.updateRange.count = cnt * 4; }
      if (_egAoAttr.updateRange) { _egAoAttr.updateRange.offset = 0; _egAoAttr.updateRange.count = cnt; }
      _egPosAttr.needsUpdate = true;
      _egColAttr.needsUpdate = true;
      _egAoAttr.needsUpdate = true;
    }
    eclipseGrassMesh.visible = (cnt > 0);
    if (envUniforms.uGrassSoilRadius) {
      envUniforms.uGrassSoilRadius.value = cnt > 0 ? Math.max(8.0, Math.sqrt(maxEmitD2)) : 0.0;
    }
  }


