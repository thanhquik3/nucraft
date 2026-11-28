// NUCRAFT Module: src/main.js — Game loop, shadows, water reflections, postFX, bootstrap & __NUCRAFT_V45__

  function startPlaying() {
    if (isWorldLoading) return;
    try { ensureAudio(); } catch (_) {}
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    document.body.classList.remove('in-menu');
    document.getElementById('menuModal')?.classList.remove('pause-mode');
    if (window._optionsOpenedFromLobby) {
      window._optionsOpenedFromLobby = false;
      const mm = document.getElementById('menuModal');
      if (mm) { mm.classList.add('hidden'); mm.classList.remove('from-lobby'); }
      document.getElementById('lobbyScreen')?.classList.remove('hidden');
      document.body.classList.add('in-lobby');
      return;
    }
    document.getElementById('lobbyScreen')?.classList.add('hidden');
    document.body.classList.remove('in-lobby');
    heldPivot.visible = (thirdPerson === 0 && !hudHidden);
    if (typeof offhandPivot !== 'undefined') offhandPivot.visible = (thirdPerson === 0 && !hudHidden && !!activeOffhandObj);
    const mm = document.getElementById('menuModal');
    if (mm) { mm.classList.add('hidden'); mm.classList.remove('from-lobby'); }
    document.getElementById('deathModal')?.classList.add('hidden');
    document.getElementById('invModal')?.classList.add('hidden');
    document.getElementById('furnaceModal')?.classList.add('hidden');
    document.getElementById('chestModal')?.classList.add('hidden');
    document.getElementById('smithingModal')?.classList.add('hidden');
    document.getElementById('worldMapModal')?.classList.add('hidden');
    activeChestKey = null; activeChestPartnerKey = null; activeFurnaceKey = null;
    _playerCombatTarget = null; _playerCombatTargetT = 0; _dragonGrowthUiTimer = 0; _activeGrowthDragon = null;
    document.getElementById('dragonGrowthWrap')?.classList.remove('visible');
    document.getElementById('btnDragonMount')?.classList.remove('visible');
    document.getElementById('btnDragonEquip')?.classList.remove('visible');
    document.getElementById('dragonFlightHud')?.classList.remove('visible'); _hingesAnimating = true;
    document.getElementById('dragonModal')?.classList.add('hidden');
    document.getElementById('tradeModal')?.classList.add('hidden');
    document.getElementById('friendsModal')?.classList.add('hidden');
    document.getElementById('addFriendModal')?.classList.add('hidden');
    document.getElementById('profileModal')?.classList.add('hidden');
    isPlaying = true;
    if (typeof syncMobSpawnLockUI === 'function') syncMobSpawnLockUI();
    if (isTouchDevice() && !_userManuallyToggledTouch) showMobileControls = true;
    syncMobileControls();
    applyMobileCtrlModeUI();
    applyHudLayout();
    safeLockPointer();
    if (typeof preloadCoreMobGlbs === 'function') preloadCoreMobGlbs();
  }

  let _lastChunkComputeAO;
  const _pendingGfxOps = new Map();
  let _gfxRafId = 0;
  function scheduleGfxApply(key, fn) {
    if (typeof requestAnimationFrame !== 'function') { fn(); return; }
    _pendingGfxOps.set(key, fn);
    if (!_gfxRafId) {
      _gfxRafId = requestAnimationFrame(() => {
        _gfxRafId = 0;
        const ops = Array.from(_pendingGfxOps.values());
        _pendingGfxOps.clear();
        for (let i = 0; i < ops.length; i++) ops[i]();
      });
    }
  }
  window.scheduleGfxApply = scheduleGfxApply;

  function applyQualitySetting(val, persist = false) {
    val = (CFG.normalizeQuality ? CFG.normalizeQuality(val, 'high') : val);
    shaderQuality = val;
    const rtOn = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
    const isLow = (val === 'low'), isExtreme = (val === 'extreme'), isUltra = (val === 'ultra' || isExtreme);
    const effShadowOn = !isLow || rtOn;
    const effUltra = isUltra || rtOn;
    const direct = _useDirectRender();
    const preset = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[val]) || { shadowSize: 1024, reflW: 256, reflH: 144 };
    document.querySelectorAll('#qualitySeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
    envUniforms.uQuality.value = isUltra ? 2.0 : ((isLow && !rtOn) ? 0.0 : (rtOn ? 2.0 : 1.0));
    if (envUniforms.uRtQuality) envUniforms.uRtQuality.value = (_initMobile || _isWeakDevice || val === 'high' || isLow) ? 0.0 : 1.0;
    renderer.shadowMap.enabled = effShadowOn;
    sunLight.castShadow = effShadowOn;
    const dedGpu = !!(_hwProfile && _hwProfile.gpu && _hwProfile.gpu.isDedicated);
    const isCartoon = !!window._cartoonAddonActive;
    let wantShSize = isLow ? 1024 : (isExtreme ? ((dedGpu && !_initMobile) ? 3072 : 2048) : ((effShadowOn && !_initMobile) ? (dedGpu ? (preset.shadowSize || 2048) : 2048) : 1024));
    if (rtOn && !_initMobile) wantShSize = Math.max(wantShSize, 2048);
    if (isCartoon) wantShSize = Math.min(wantShSize, 1024);
    if (sunLight.shadow.mapSize.width !== wantShSize) {
      sunLight.shadow.mapSize.set(wantShSize, wantShSize);
      if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    }
    if (preset.reflW > 0 && preset.reflH > 0) {
      const wantRW = _initMobile ? Math.min(256, preset.reflW) : preset.reflW;
      const wantRH = _initMobile ? Math.min(144, preset.reflH) : preset.reflH;
      if (reflRT.width !== wantRW || reflRT.height !== wantRH) reflRT.setSize(wantRW, wantRH);
    }
    sunLight.shadow.radius = (!isCartoon && effShadowOn && !_initMobile && (typeof sodiumOpts === 'undefined' || sodiumOpts.smoothShadows !== false)) ? 2.8 : 1.0;
    renderer.shadowMap.needsUpdate = true;
    _lastShCx = 999999; _lastShCz = 999999; _lastShQual = '';
    _lastReflYaw = 9e9; _lastReflPitch = 9e9; _reflDoneOnce = false;
    _postFxDirty = true;
    renderer.localClippingEnabled = !isLow || rtOn;
    if (isLow && !rtOn) {
      const sTex = getAtlasSolidTex();
      if (leavesMatLow.map !== sTex) leavesMatLow.map = sTex;
    }
    if (terrainMat._baseBumpMap === undefined) terrainMat._baseBumpMap = terrainMat.bumpMap;
    terrainMat.bumpScale = (isCartoon || (isLow && !rtOn) || (!bumpEnabled && !rtOn)) ? 0.0 : (bumpEnabled ? (rtOn ? 0.085 : 0.058) : (rtOn ? 0.045 : 0.0));
    leavesMat.bumpScale = 0.0;
    renderer.toneMapping = direct ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = (shaderPreset === 'eclipse') ? 0.97 : (shaderPreset === 'cartoon_barebones' ? 0.90 : 0.95);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(val)));
    if (persist && CFG.saveGfxPrefs) {
      CFG.saveGfxPrefs({ shaderQuality: val });
      try { if (CFG.CRASH_GUARD_KEY) localStorage.removeItem(CFG.CRASH_GUARD_KEY); } catch (_) {}
    }
    if (typeof syncLoadedChunkRenderFlags === 'function') syncLoadedChunkRenderFlags();
    const nextAO = (!isLow || rtOn);
    if (_lastChunkComputeAO !== undefined && _lastChunkComputeAO !== nextAO) markAllLoadedChunksDirty(false);
    _lastChunkComputeAO = nextAO;
    resizeViewport();
  }

  function getPresetSharpness(preset) {
    const sharpOn = (typeof sodiumOpts === 'undefined' || sodiumOpts.sharpness !== false);
    if (!sharpOn) return 0.0;
    return preset === 'dlss_ultra' ? 0.36 : (preset === 'eclipse' ? 0.28 : (preset === 'chill_sunset' ? 0.22 : (preset === 'cartoon_barebones' ? 0.16 : 0.19)));
  }

  function applyAaMode(mode, persist = false) {
    const valid = (mode === 'off' || mode === 'fxaa' || mode === 'msaa' || mode === 'ultra') ? mode : (_initMobile ? 'fxaa' : 'msaa');
    aaMode = valid;
    if (envUniforms.uAaMode) envUniforms.uAaMode.value = _aaModeVal(valid);
    document.querySelectorAll('#aaSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.aa === valid));
    if (persist && CFG.saveGfxPrefs) CFG.saveGfxPrefs({ aaMode: valid });
    _postFxDirty = true;
    resizeViewport();
  }
  window.applyAaMode = applyAaMode;

  const _presetTargets = { uExposure: 1.03, uVibrance: 0.08, uWarmth: 0.08, uContrast: 0.065, uCloudCover: 0.48, uSharpness: 0.19 };
  let _presetLerpActive = false;
  function applyShaderPreset(preset, persist = false, opts = null) {
    if (window._cartoonAddonActive) preset = 'cartoon_barebones';
    shaderPreset = preset;
    document.querySelectorAll('#presetSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    document.querySelectorAll('#lobbyShaderSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.lshader === preset));
    if (typeof lobbyShader !== 'undefined') lobbyShader = preset;
    if (envUniforms.uChillMode) envUniforms.uChillMode.value = (preset === 'chill_sunset') ? 1.0 : 0.0;
    if (envUniforms.uDlssMode) envUniforms.uDlssMode.value = (preset === 'dlss_ultra') ? 1.0 : 0.0;
    if (envUniforms.uEclipseMode) envUniforms.uEclipseMode.value = (preset === 'eclipse') ? 1.0 : 0.0;
    if (envUniforms.uNcr2Mode) envUniforms.uNcr2Mode.value = (preset === 'ncr2') ? 1.0 : 0.0;
    if (envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = (preset === 'cartoon_barebones' || window._cartoonAddonActive) ? 1.0 : 0.0;
    const tSh = getPresetSharpness(preset);
    let tExp = 1.03, tVib = 0.08, tWarm = 0.08, tCon = 0.065, tCloud = 0.48;
    if (preset === 'ncr2') { tExp = 1.02; tVib = 0.12; tWarm = 0.05; tCon = 0.065; tCloud = 0.50; }
    else if (preset === 'bliss') { tExp = 1.02; tVib = 0.08; tWarm = 0.10; tCon = 0.06; tCloud = 0.50; }
    else if (preset === 'moonlit') { tExp = 1.00; tVib = 0.04; tWarm = -0.04; tCon = 0.06; tCloud = 0.36; }
    else if (preset === 'chill_sunset') { tExp = 1.03; tVib = 0.09; tWarm = 0.16; tCon = 0.065; tCloud = 0.52; }
    else if (preset === 'verdant_fresh') { tExp = 1.03; tVib = 0.09; tWarm = 0.08; tCon = 0.065; tCloud = 0.48; }
    else if (preset === 'dlss_ultra') { tExp = 1.03; tVib = 0.08; tWarm = 0.08; tCon = 0.065; tCloud = 0.48; }
    else if (preset === 'eclipse') { tExp = 1.03; tVib = 0.11; tWarm = 0.24; tCon = 0.075; tCloud = 0.48; }
    else if (preset === 'cartoon_barebones') { tExp = 1.04; tVib = 0.09; tWarm = 0.0; tCon = 0.02; tCloud = 0.44; }
    _presetTargets.uExposure = tExp; _presetTargets.uVibrance = tVib; _presetTargets.uWarmth = tWarm;
    _presetTargets.uContrast = tCon; _presetTargets.uCloudCover = tCloud; _presetTargets.uSharpness = tSh;
    const smooth = !!(opts && typeof opts.smooth === 'boolean' ? opts.smooth : persist);
    if (smooth && typeof requestAnimationFrame === 'function') {
      _presetLerpActive = true;
    } else {
      _presetLerpActive = false;
      if (envUniforms.uSharpness) envUniforms.uSharpness.value = tSh;
      envUniforms.uExposure.value = tExp; envUniforms.uVibrance.value = tVib; envUniforms.uWarmth.value = tWarm;
      envUniforms.uContrast.value = tCon; envUniforms.uCloudCover.value = tCloud;
    }
    renderer.toneMappingExposure = (preset === 'eclipse') ? 0.99 : (preset === 'cartoon_barebones' ? 0.90 : 0.95);
    window._eclipseGrassDirty = true;
    if (typeof updateEclipseGrass === 'function') updateEclipseGrass(true);
    if (persist && CFG.saveGfxPrefs && preset !== 'cartoon_barebones') CFG.saveGfxPrefs({ shaderPreset: preset });
  }

  function syncCartoonExclusiveShaderUI(isOn) {
    const on = !!isOn;
    window._cartoonAddonActive = on;
    if (on && shaderPreset && shaderPreset !== 'cartoon_barebones') {
      window._preCartoonShaderPreset = shaderPreset;
    }
    document.querySelectorAll('#lobbyShaderSeg .seg-btn').forEach(b => {
      const isCar = b.dataset.lshader === 'cartoon_barebones';
      b.classList.toggle('hidden', on ? !isCar : isCar);
    });
    document.querySelectorAll('#presetSeg .seg-btn').forEach(b => {
      const isCar = b.dataset.preset === 'cartoon_barebones';
      b.classList.toggle('hidden', on ? !isCar : isCar);
    });
    if (typeof terrainMat !== 'undefined' && terrainMat) {
      if (terrainMat._savedBumpScale === undefined) terrainMat._savedBumpScale = terrainMat.bumpScale;
      terrainMat.bumpScale = on ? 0.0 : terrainMat._savedBumpScale;
    }
    if (on) {
      if (envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = 1.0;
      if (envUniforms.uRayTracing) envUniforms.uRayTracing.value = 0.0;
      if (envUniforms.uUsePlanarRefl) envUniforms.uUsePlanarRefl.value = 0.0;
      applyShaderPreset('cartoon_barebones', false);
    } else {
      if (envUniforms.uCartoonMode) envUniforms.uCartoonMode.value = 0.0;
      if (envUniforms.uRayTracing && typeof sodiumOpts !== 'undefined') envUniforms.uRayTracing.value = sodiumOpts.rayTracing ? 1.0 : 0.0;
      const restorePreset = window._preCartoonShaderPreset || (CFG.loadGfxPrefs ? (CFG.loadGfxPrefs().shaderPreset || 'eclipse') : 'eclipse');
      applyShaderPreset(restorePreset === 'cartoon_barebones' ? 'eclipse' : restorePreset, false);
    }
    applyQualitySetting(shaderQuality, false);
    window._postFxDirty = true;
  }
  window.syncCartoonExclusiveShaderUI = syncCartoonExclusiveShaderUI;
  if (window._cartoonAddonActive) syncCartoonExclusiveShaderUI(true);


  /* ============================================================================
   * 13. MAIN GAME LOOP (2048px SHADOWS, WATER MIRROR, WEATHER, BLOCK-LIGHTS & BLOOM!)
   * ============================================================================ */
  let dayTime = 0.29, lastFrame = performance.now(), elapsed = 0, hudTimer = 0, frameCounter = 0;
  let hungerTick = 0, drownTick = 0, lavaTick = 0, fireTick = 0, voidTick = 0;

  const colDayTop = new THREE.Color(0x1f63c8), colDayHor = new THREE.Color(0x7fb2e6);
  const colSunsetTop = new THREE.Color(0x2a2764), colSunsetHor = new THREE.Color(0xf4823c);
  const colNightTop = new THREE.Color(0x030816), colNightHor = new THREE.Color(0x0b1936);
  const colStormTop = new THREE.Color(0x28323d), colStormHor = new THREE.Color(0x525e6c);
  const colWhite = new THREE.Color(0xffffff), _tmpTop = new THREE.Color(), _tmpHor = new THREE.Color();
  const _colSkyFillSoft = new THREE.Color(0xdce9fa), _colCityMistWarm = new THREE.Color(0xd8c3a5), _colAerialMist = new THREE.Color(0xa9bdd0);
  const _colPaleFog = new THREE.Color(0xb8c0cc), _colNightmareFog = new THREE.Color(0x1b0b18), _colDarkForestFog = new THREE.Color(0x283526), _colAshFog = new THREE.Color(0x524236);
  const _colAuroraTop = new THREE.Color(0x0b3b3c), _colAuroraHor = new THREE.Color(0x34d399);
  const _colCartoonTop = new THREE.Color(0x2896ff), _colCartoonHor = new THREE.Color(0xbce7ff);
  const _sunProj = new THREE.Vector3();

  let _pbX = 1e9, _pbZ = 1e9, _pbDim = '', _pbSeed = -1, _pbVal = null;
  function getPlayerBiome() {
    const bx = Math.floor(player.x), bz = Math.floor(player.z);
    if (bx !== _pbX || bz !== _pbZ || currentDimension !== _pbDim || worldSeed !== _pbSeed || !_pbVal) {
      _pbX = bx; _pbZ = bz; _pbDim = currentDimension; _pbSeed = worldSeed;
      _pbVal = getBiomeAt(bx, bz);
    }
    return _pbVal;
  }
  const _topLights = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, col: 0, int: 0, dist: 20, d2: 0, score: 1e9 }));
  const activeLightningBolts = [];
  const _boltSegGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const _boltRingGeo = new THREE.RingGeometry(0.45, 2.35, 16);
  const _boltTmpA = new THREE.Vector3(), _boltTmpB = new THREE.Vector3(), _boltTmpD = new THREE.Vector3(), _boltUp = new THREE.Vector3(0, 1, 0);
  function _addBoltSeg(grp, ax, ay, az, bx, by, bz, r, mat) {
    _boltTmpA.set(ax, ay, az); _boltTmpB.set(bx, by, bz);
    const len = _boltTmpA.distanceTo(_boltTmpB);
    if (len < 0.05) return;
    const m = new THREE.Mesh(_boltSegGeo, mat);
    m.position.copy(_boltTmpA).add(_boltTmpB).multiplyScalar(0.5);
    m.scale.set(r, len, r);
    _boltTmpD.subVectors(_boltTmpB, _boltTmpA).normalize();
    m.quaternion.setFromUnitVectors(_boltUp, _boltTmpD);
    grp.add(m);
  }
  function spawnLightningStrike(tx, ty, tz, explode = true) {
    // Biome Cánh Đồng Lúa luôn bình yên: có thể mưa chill nhẹ nhưng tuyệt đối không sét đánh phá lúa/công trình
    if (currentDimension === 'overworld' && typeof getBiomeAt === 'function' && getBiomeAt(Math.floor(tx), Math.floor(tz)) === BIOMES.WHEAT_VALLEY) {
      return false;
    }
    const grp = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false });
    const segs = 12, topY = ty + 36;
    let px = tx + (Math.random() - 0.5) * 4.0, py = topY, pz = tz + (Math.random() - 0.5) * 4.0;
    for (let s = 1; s <= segs; s++) {
      const k = s / segs;
      const nx = s === segs ? tx : tx + (Math.random() - 0.5) * (1 - k * 0.72) * 3.8;
      const ny = topY - k * (topY - ty);
      const nz = s === segs ? tz : tz + (Math.random() - 0.5) * (1 - k * 0.72) * 3.8;
      _addBoltSeg(grp, px, py, pz, nx, ny, nz, 0.14, coreMat);
      _addBoltSeg(grp, px, py, pz, nx, ny, nz, 0.42, glowMat);
      if (s === 4 || s === 8) {
        const fx = nx + (Math.random() - 0.5) * 3.4, fy = ny - 3.6 - Math.random() * 2.5, fz = nz + (Math.random() - 0.5) * 3.4;
        _addBoltSeg(grp, nx, ny, nz, fx, fy, fz, 0.08, coreMat);
        _addBoltSeg(grp, nx, ny, nz, fx, fy, fz, 0.24, glowMat);
      }
      px = nx; py = ny; pz = nz;
    }
    const ring = new THREE.Mesh(_boltRingGeo, ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(tx, ty + 0.12, tz);
    grp.add(ring);
    scene.add(grp);
    activeLightningBolts.push({ grp, coreMat, glowMat, ringMat, ring, life: 0.42, maxLife: 0.42 });

    lightningFlash = 1.0;
    playThunderSfx(Math.hypot(player.x - tx, player.y - ty, player.z - tz));
    spawnPixelFx('explosion_electric', tx, ty + 0.9, tz, { count: 1, scale: 2.2, life: 0.48 });
    spawnPixelFx('lightning_arc', tx, ty + 2.0, tz, { count: 3, scale: 1.65, life: 0.42, spread: 1.2 });
    spawnPixelFx('lightning_arc', tx, ty + 5.8, tz, { count: 2, scale: 1.85, life: 0.36, spread: 1.4 });
    spawnPixelFx('electric_coil', tx, ty + 0.5, tz, { count: 2, scale: 1.15, life: 0.45, spread: 1.4 });
    // Authentic Minecraft: Lightning transforms nearby Creeper->Charged Creeper, Pig->Zombified Piglin, Villager->Witch!
    const _transformLightningMob = (m, nextType) => {
      if (!MOB_STATS[nextType]) return false;
      const prevY = m.y, prevYaw = m.yaw, prevX = m.x, prevZ = m.z;
      const nGrp = buildMobMesh(nextType, prevX, prevZ);
      if (nGrp) {
        scene.remove(m.group);
        for (let pi = 0; pi < m.parts.length; pi++) {
          const pMat = m.parts[pi].material;
          if (pMat && !(pMat.userData && pMat.userData.sharedMat)) pMat.dispose();
        }
        nGrp.group.position.set(prevX, prevY, prevZ);
        nGrp.group.rotation.y = prevYaw;
        scene.add(nGrp.group);
        m.group = nGrp.group; m.parts = nGrp.parts; m.flameGroup = nGrp.flameGroup; m.anim = nGrp.anim; m.fromBlender = nGrp.fromBlender;
      }
      m.type = nextType;
      m.displayName = MOB_STATS[nextType].displayName || nextType;
      m.hp = m.maxHp = MOB_STATS[nextType].hp;
      m.speed = MOB_STATS[nextType].speed;
      m.hurtFlash = 0.25;
      m._justCharged = true;
      return true;
    };
    let chargedCount = 0, piglinCount = 0, witchCount = 0;
    for (let mi = 0; mi < mobs.length; mi++) {
      const m = mobs[mi];
      if (!m || m._dead || Math.hypot(m.x - tx, m.z - tz) >= 6.5) continue;
      if (m.type === 'creeper' && _transformLightningMob(m, 'charged_creeper')) chargedCount++;
      else if (m.type === 'pig' && _transformLightningMob(m, 'zombified_piglin')) piglinCount++;
      else if (m.type === 'villager' && _transformLightningMob(m, 'witch')) witchCount++;
    }
    if (chargedCount > 0) showToast(`⚡ Sét đánh trúng Creeper! ${chargedCount} Creeper đã biến thành Creeper Điện!`);
    else if (piglinCount > 0) showToast(`⚡ Sét đánh trúng Lợn! Biến thành ${piglinCount} Piglin Thây Ma!`);
    else if (witchCount > 0) showToast(`⚡ Sét đánh trúng Dân Làng! Biến thành ${witchCount} Phù Thủy!`);
    // Lightning block destruction chance strictly reduced to 0.001% (1 in 100,000); normal strikes only deal damage & transform mobs!
    const destroyBlocksNow = !!(explode && Math.random() < 0.00001);
    if (explode && typeof triggerExplosion === 'function') {
      triggerExplosion(tx, ty, tz, 2.35, 11, '⚡ Bạn bị tia sấm sét đánh trúng!', { electric: true, silent: true, destroyBlocks: destroyBlocksNow });
      if (destroyBlocksNow) {
        const bx0 = Math.floor(tx), by0 = Math.floor(ty), bz0 = Math.floor(tz);
        let litFire = false;
        for (const [fx, fz] of [[bx0, bz0], [bx0 + 1, bz0], [bx0 - 1, bz0 + 1]]) {
          for (let fy = by0 + 2; fy >= by0 - 3; fy--) {
            if (IS_SOLID[getBlockWorld(fx, fy, fz)] === 1 && getBlockWorld(fx, fy + 1, fz) === B.AIR) {
              if (Math.random() < 0.65) { setBlockWorld(fx, fy + 1, fz, B.FIRE, true); litFire = true; }
              break;
            }
          }
        }
        if (litFire) flushUrgentChunks(8);
      }
    }
    return true;
  }
  function updateLightningBolts(dt) {
    for (let i = activeLightningBolts.length - 1; i >= 0; i--) {
      const b = activeLightningBolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        scene.remove(b.grp);
        b.coreMat.dispose(); b.glowMat.dispose(); b.ringMat.dispose();
        activeLightningBolts.splice(i, 1);
      } else {
        const k = b.life / b.maxLife;
        b.coreMat.opacity = k;
        b.glowMat.opacity = k * 0.72;
        b.ringMat.opacity = k * 0.88;
        b.ring.scale.setScalar(1.0 + (1.0 - k) * 1.9);
      }
    }
  }
  window.triggerTestLightning = (d = 12) => {
    const lx = Math.floor(player.x - Math.sin(player.yaw) * d) + 0.5;
    const lz = Math.floor(player.z - Math.cos(player.yaw) * d) + 0.5;
    const ly = getTerrainHeight(Math.floor(lx), Math.floor(lz), getBiomeAt(Math.floor(lx), Math.floor(lz))) + 1;
    spawnLightningStrike(lx, ly, lz, true);
    return { x: lx, y: ly, z: lz };
  };

  let activeWeatherKind = 'clear';
  const _colSandFog = new THREE.Color(0xc89b5c), _colSandHor = new THREE.Color(0xdcb478);
  const _colBlizzHor = new THREE.Color(0xcbdcf0), _colDenseFog = new THREE.Color(0x8fa0b2);
  const _colDlssTop = new THREE.Color(0x1f63c8), _colDlssHor = new THREE.Color(0x7fb2e6), _colDlssSun = new THREE.Color(0xfff5e0);
  const _colEclipseTop = new THREE.Color(0x4679c4), _colEclipseHor = new THREE.Color(0xf0b284);
  const _colEclipseNoonTop = new THREE.Color(0x2f74cc), _colEclipseNoonHor = new THREE.Color(0xa8cae8);
  const _colEclipseNightTop = new THREE.Color(0x050914), _colEclipseNightHor = new THREE.Color(0x111d33);
  const _colEclipseSun = new THREE.Color(0xffd088);
  const _colEclipseNoonSun = new THREE.Color(0xfff0d2);
  // NCR2 crisp vivid daylight palette (matching 6 reference screenshots: azure sky, pale blue horizon, warm non-blown-out sun, readable soft-blue night)
  const _colNcr2Top = new THREE.Color(0x2f7be4), _colNcr2Hor = new THREE.Color(0xb6dbf8);
  const _colNcr2SunsetTop = new THREE.Color(0x3a528a), _colNcr2SunsetHor = new THREE.Color(0xf2a474);
  const _colNcr2NightTop = new THREE.Color(0x0a162e), _colNcr2NightHor = new THREE.Color(0x1a3056);
  const _colNcr2Sun = new THREE.Color(0xfff1d4), _colNcr2SunsetSun = new THREE.Color(0xffb470);
  const _colNcr2Fog = new THREE.Color(0xb9dbf6);

  let _wakeIdx = 0, _wakeCooldown = 0, _wasInWaterWake = false, _lastWakeX = 1e9, _lastWakeZ = 1e9;
  let _lastWakeEmitTime = -999;
  function updateWaterWakes(dt) {
    const _wakesOn = (envUniforms.uEclipseMode && envUniforms.uEclipseMode.value > 0.5) || (envUniforms.uNcr2Mode && envUniforms.uNcr2Mode.value > 0.5);
    if (!envUniforms.uWakePts || !_wakesOn || currentDimension === 'nether' || currentDimension === 'end' || depthOffset > 0) {
      if (envUniforms.uWakeActive) envUniforms.uWakeActive.value = 0.0;
      return;
    }
    if (_wakeCooldown > -1.0) _wakeCooldown -= dt;
    const atSurfY = (player.y >= WATER_LEVEL - 2.6 && player.y <= WATER_LEVEL + 2.2);
    const bx = Math.floor(player.x), bz = Math.floor(player.z);
    const blkSurf = getBlockWorld(bx, WATER_LEVEL, bz);
    const inSurfWater = atSurfY && (blkSurf === B.WATER || blkSurf === B.SEAGRASS || player.inWater || player.eyesInWater);
    if (inSurfWater !== _wasInWaterWake) {
      _wasInWaterWake = inSurfWater;
      if (inSurfWater || blkSurf === B.WATER) {
        envUniforms.uWakePts.value[_wakeIdx].set(player.x, player.z, elapsed, 1.35);
        _wakeIdx = (_wakeIdx + 1) & 7;
        _wakeCooldown = 0.14;
        _lastWakeEmitTime = elapsed;
        _lastWakeX = player.x; _lastWakeZ = player.z;
        if (envUniforms.uWakeActive) envUniforms.uWakeActive.value = 1.0;
        return;
      }
    }
    if (inSurfWater) {
      const stepD = Math.hypot(player.x - _lastWakeX, player.z - _lastWakeZ);
      if (stepD >= 0.42 && _wakeCooldown <= 0) {
        envUniforms.uWakePts.value[_wakeIdx].set(player.x, player.z, elapsed, Math.min(1.25, 0.72 + stepD * 0.35));
        _wakeIdx = (_wakeIdx + 1) & 7;
        _wakeCooldown = 0.16;
        _lastWakeEmitTime = elapsed;
        _lastWakeX = player.x; _lastWakeZ = player.z;
      } else if (_wakeCooldown <= -0.58) {
        envUniforms.uWakePts.value[_wakeIdx].set(player.x, player.z, elapsed, 0.48);
        _wakeIdx = (_wakeIdx + 1) & 7;
        _wakeCooldown = 0.22;
        _lastWakeEmitTime = elapsed;
      }
    }
    if (envUniforms.uWakeActive) envUniforms.uWakeActive.value = (elapsed - _lastWakeEmitTime < 4.35) ? 1.0 : 0.0;
  }

  function formatGameClock(tVal = dayTime) {
    const norm = (((tVal % 1) + 1) % 1);
    const totalMin = Math.floor(norm * 1440) % 1440;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    const hhmm = (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute;
    let periodVi = 'Ban Đêm', periodEn = 'Night', shortVi = 'Đêm', shortEn = 'Night', iconKind = 'moon', presetTime = '0.92';
    if (hour >= 5 && hour < 7) {
      periodVi = 'Bình Minh'; periodEn = 'Dawn'; shortVi = 'B.Minh'; shortEn = 'Dawn'; iconKind = 'dawn'; presetTime = '0.31';
    } else if (hour >= 7 && hour < 11) {
      periodVi = 'Buổi Sáng'; periodEn = 'Morning'; shortVi = 'Sáng'; shortEn = 'Morn'; iconKind = 'sun'; presetTime = '0.31';
    } else if (hour >= 11 && hour < 15) {
      periodVi = 'Buổi Trưa'; periodEn = 'Noon'; shortVi = 'Trưa'; shortEn = 'Noon'; iconKind = 'sun'; presetTime = '0.50';
    } else if (hour >= 15 && hour < 17) {
      periodVi = 'Buổi Chiều'; periodEn = 'Afternoon'; shortVi = 'Chiều'; shortEn = 'Aft'; iconKind = 'sun'; presetTime = '0.50';
    } else if (hour >= 17 && hour < 19) {
      periodVi = 'Hoàng Hôn'; periodEn = 'Sunset'; shortVi = 'H.Hôn'; shortEn = 'Dusk'; iconKind = 'dawn'; presetTime = '0.73';
    } else if (hour >= 19 && hour < 22) {
      periodVi = 'Buổi Tối'; periodEn = 'Evening'; shortVi = 'Tối'; shortEn = 'Eve'; iconKind = 'moon'; presetTime = '0.92';
    }
    const isDayClock = (hour >= 6 && hour < 19);
    const pct = +(norm * 100).toFixed(1);
    return { hhmm, hour, minute, periodVi, periodEn, shortVi, shortEn, iconKind, presetTime, isDayClock, pct };
  }

  function getClockPixelSvg(iconKind) {
    if (iconKind === 'sun') {
      return '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="4" y="4" width="4" height="4" fill="#fde047"/><rect x="5" y="1" width="2" height="2" fill="#facc15"/><rect x="5" y="9" width="2" height="2" fill="#facc15"/><rect x="1" y="5" width="2" height="2" fill="#facc15"/><rect x="9" y="5" width="2" height="2" fill="#facc15"/><rect x="2" y="2" width="1" height="1" fill="#fef08a"/><rect x="9" y="2" width="1" height="1" fill="#fef08a"/><rect x="2" y="9" width="1" height="1" fill="#fef08a"/><rect x="9" y="9" width="1" height="1" fill="#fef08a"/></svg>';
    }
    if (iconKind === 'dawn') {
      return '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="3" y="4" width="6" height="4" fill="#fb923c"/><rect x="4" y="3" width="4" height="1" fill="#fde047"/><rect x="1" y="8" width="10" height="2" fill="#f97316"/><rect x="0" y="10" width="12" height="2" fill="#334155"/></svg>';
    }
    return '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="3" y="2" width="4" height="8" fill="#cbd5e1"/><rect x="5" y="1" width="3" height="2" fill="#e2e8f0"/><rect x="5" y="9" width="3" height="2" fill="#e2e8f0"/><rect x="6" y="3" width="2" height="6" fill="#1e293b"/><rect x="9" y="2" width="1" height="1" fill="#fef08a"/><rect x="10" y="6" width="1" height="1" fill="#bae6fd"/></svg>';
  }

  let _elMmClkBar = null, _elMmClkIco = null, _elMmClkTime = null, _elMmClkPer = null, _elMmClkProg = null;
  let _elStClkIco = null, _elStClkPer = null, _elStClkInp = null;
  let _lastMmClockSig = '', _lastStClockSig = '', _lastWeatherUiSig = '', _lastClockIconMm = '', _lastClockIconSt = '';

  function syncLiveTimeAndWeatherUi(force = false) {
    if (!_elMmClkBar) {
      _elMmClkBar = document.getElementById('minimapClockBar');
      _elMmClkIco = document.getElementById('minimapClockIcon');
      _elMmClkTime = document.getElementById('minimapClockTime');
      _elMmClkPer = document.getElementById('minimapClockPeriod');
      _elMmClkProg = document.getElementById('minimapClockProg');
      _elStClkIco = document.getElementById('settingsClockIco');
      _elStClkPer = document.getElementById('settingsClockPeriod');
      _elStClkInp = document.getElementById('inpExactClock');
    }
    const ck = formatGameClock(dayTime);
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const shortPer = isEn ? ck.shortEn : ck.shortVi;
    const fullPer = isEn ? ck.periodEn : ck.periodVi;
    const mmSig = `${ck.hhmm}|${shortPer}|${ck.isDayClock ? 1 : 0}`;
    if (force || mmSig !== _lastMmClockSig) {
      _lastMmClockSig = mmSig;
      if (_elMmClkTime) _elMmClkTime.textContent = ck.hhmm;
      if (_elMmClkPer) _elMmClkPer.textContent = shortPer;
      if (_elMmClkBar) _elMmClkBar.classList.toggle('is-night', !ck.isDayClock);
      if (_elMmClkProg) _elMmClkProg.style.width = `${ck.pct}%`;
      if (_elMmClkIco && ck.iconKind !== _lastClockIconMm) {
        _lastClockIconMm = ck.iconKind;
        _elMmClkIco.innerHTML = getClockPixelSvg(ck.iconKind);
      }
    }
    const unlocked = (typeof isAdminUnlocked !== 'undefined' && !!isAdminUnlocked);
    const stSig = `${ck.hhmm}|${fullPer}|${ck.presetTime}|${isEn ? 'en' : 'vi'}|${unlocked ? 1 : 0}`;
    if (force || stSig !== _lastStClockSig) {
      _lastStClockSig = stSig;
      if (_elStClkPer) _elStClkPer.textContent = fullPer;
      if (_elStClkIco && ck.iconKind !== _lastClockIconSt) {
        _lastClockIconSt = ck.iconKind;
        _elStClkIco.innerHTML = getClockPixelSvg(ck.iconKind);
      }
      if (_elStClkInp && document.activeElement !== _elStClkInp && _elStClkInp.value !== ck.hhmm) {
        _elStClkInp.value = ck.hhmm;
      }
      document.querySelectorAll('#timeSeg .seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.time === ck.presetTime);
      });
    }
    const wUiSig = `${weatherMode}|${activeWeatherKind}|${unlocked ? 1 : 0}`;
    if (force || wUiSig !== _lastWeatherUiSig) {
      _lastWeatherUiSig = wUiSig;
      document.querySelectorAll('#weatherSeg .seg-btn').forEach(b => {
        const w = b.dataset.weather;
        const isLive = (w === activeWeatherKind);
        b.classList.toggle('active', unlocked ? (w === weatherMode) : isLive);
        b.classList.toggle('live-weather', isLive);
      });
    }
  }
  window.syncLiveTimeAndWeatherUi = syncLiveTimeAndWeatherUi;

  let _nextMeteorT = 0.25, _wasMeteorWeather = false;
  function updateShootingStars(dt, sunY, inOverworld) {
    const canShow = inOverworld && !player.eyesInWater && depthOffset === 0 && (sunY < 0.08 || activeWeatherKind === 'meteor');
    if (!canShow) {
      _wasMeteorWeather = false;
      if (shootingStarLines.visible) {
        for (let i = 0; i < SHOOTING_STAR_MAX; i++) shootingStars[i].active = false;
        shootingStarLines.visible = false;
      }
      return;
    }
    const isMeteorShower = (activeWeatherKind === 'meteor');
    let burstCount = 1;
    if (isMeteorShower && !_wasMeteorWeather) {
      _wasMeteorWeather = true;
      _nextMeteorT = 0;
      burstCount = 3; // immediate visible streaks when meteor weather starts
    } else if (!isMeteorShower) {
      _wasMeteorWeather = false;
    }
    _nextMeteorT -= dt;
    if (_nextMeteorT <= 0) {
      _nextMeteorT = isMeteorShower ? (0.22 + Math.random() * 0.30) : (1.8 + Math.random() * 2.8);
      for (let i = 0; i < SHOOTING_STAR_MAX && burstCount > 0; i++) {
        const s = shootingStars[i];
        if (s.active) continue;
        // First burst aims within player's forward sky arc so meteor shower is immediately visible
        const fwdAz = -Math.PI * 0.5 - (player.yaw || 0);
        const az = (burstCount > 1) ? (fwdAz + (Math.random() - 0.5) * 0.85) : (Math.random() * Math.PI * 2);
        const el = (burstCount > 1) ? (0.24 + Math.random() * 0.24) : (0.22 + Math.random() * 0.52);
        const r = 340 + Math.random() * 60;
        const cosE = Math.cos(el);
        s.x = camera.position.x + Math.cos(az) * cosE * r;
        s.y = camera.position.y + Math.sin(el) * r;
        s.z = camera.position.z + Math.sin(az) * cosE * r;
        const spd = 105 + Math.random() * 65;
        const dAng = az + (Math.random() > 0.5 ? 1.05 : -1.05);
        s.vx = Math.cos(dAng) * spd;
        s.vy = -(0.38 + Math.random() * 0.42) * spd * 0.52;
        s.vz = Math.sin(dAng) * spd;
        s.len = (isMeteorShower ? 30 : 22) + Math.random() * 22;
        s.life = s.maxLife = (isMeteorShower ? 1.35 : 0.90) + Math.random() * 0.55;
        const tintPick = Math.random();
        if (tintPick < 0.45) { s.r = 1.0; s.g = 0.96; s.b = 0.78; }
        else if (tintPick < 0.80) { s.r = 0.70; s.g = 0.90; s.b = 1.0; }
        else { s.r = 0.92; s.g = 0.74; s.b = 1.0; }
        s.active = true;
        if (isMeteorShower && burstCount === 1 && !window._isWorldPaused && !document.body.classList.contains('in-lobby')) playSfx('meteor');
        burstCount--;
      }
    }
    let anyActive = false;
    for (let i = 0; i < SHOOTING_STAR_MAX; i++) {
      const s = shootingStars[i];
      const b = i * 6;
      if (!s.active) {
        ssPositions[b] = ssPositions[b + 1] = ssPositions[b + 2] = 0;
        ssPositions[b + 3] = ssPositions[b + 4] = ssPositions[b + 5] = 0;
        ssColors[b] = ssColors[b + 1] = ssColors[b + 2] = 0;
        ssColors[b + 3] = ssColors[b + 4] = ssColors[b + 5] = 0;
        continue;
      }
      s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }
      anyActive = true;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      const spd = Math.hypot(s.vx, s.vy, s.vz) || 1;
      const fade = Math.sin((s.life / s.maxLife) * Math.PI);
      const tx = s.x - (s.vx / spd) * s.len;
      const ty = s.y - (s.vy / spd) * s.len;
      const tz = s.z - (s.vz / spd) * s.len;
      ssPositions[b] = s.x; ssPositions[b + 1] = s.y; ssPositions[b + 2] = s.z;
      ssPositions[b + 3] = tx; ssPositions[b + 4] = ty; ssPositions[b + 5] = tz;
      ssColors[b] = s.r * fade; ssColors[b + 1] = s.g * fade; ssColors[b + 2] = s.b * fade;
      ssColors[b + 3] = s.r * fade * 0.08; ssColors[b + 4] = s.g * fade * 0.08; ssColors[b + 5] = s.b * fade * 0.12;
    }
    shootingStarLines.visible = anyActive;
    if (anyActive) {
      shootingStarGeo.attributes.position.needsUpdate = true;
      shootingStarGeo.attributes.color.needsUpdate = true;
    }
  }

  let _dynLightFound = 0;
  const _tmpLightPos = new THREE.Vector3();
  function _offerDynLight(need, x, y, z, col, int, d2, prio, dist = 20) {
    const score = d2 - (prio ? 64 : 0);
    if (_dynLightFound === need && score >= _topLights[need - 1].score) return;
    let idx = _dynLightFound < need ? _dynLightFound++ : need - 1;
    while (idx > 0 && score < _topLights[idx - 1].score) {
      const prev = _topLights[idx - 1], cur = _topLights[idx];
      cur.x = prev.x; cur.y = prev.y; cur.z = prev.z; cur.col = prev.col; cur.int = prev.int; cur.dist = prev.dist; cur.d2 = prev.d2; cur.score = prev.score;
      idx--;
    }
    const slot = _topLights[idx];
    slot.x = x; slot.y = y; slot.z = z; slot.col = col; slot.int = int; slot.dist = dist; slot.d2 = d2; slot.score = score;
  }

  let _sulfurSteamAcc = 0, _smokePlumeTick = 0;
  function updateWeatherAndLights(dt) {
    const inOverworld = (currentDimension === 'overworld');
    const biome = getPlayerBiome();
    const inChillWheat = (inOverworld && biome === BIOMES.WHEAT_VALLEY);
    const isColdBio = (biome === BIOMES.SNOW || biome === BIOMES.SNOWY_PLAINS || biome === BIOMES.ALPINE_PEAKS);
    const isSandBio = (biome === BIOMES.DESERT || biome === BIOMES.MESA);
    if (weatherMode === 'auto') {
      autoWeatherTimer -= dt;
      if (autoWeatherTimer <= 0) {
        autoWeatherTimer = 42 + Math.random() * 44;
        const r = Math.random();
        if (inChillWheat) activeWeatherKind = r < 0.22 ? 'drizzle' : (r < 0.34 ? 'rain' : (r < 0.42 ? 'meteor' : 'clear'));
        else if (isColdBio) activeWeatherKind = r < 0.24 ? 'snow' : (r < 0.38 ? 'blizzard' : (r < 0.48 ? 'aurora' : (r < 0.56 ? 'fog' : 'clear')));
        else if (isSandBio) activeWeatherKind = r < 0.24 ? 'sandstorm' : (r < 0.32 ? 'ashfall' : (r < 0.40 ? 'meteor' : 'clear'));
        else if (biome === BIOMES.VOLCANIC_BASALT) activeWeatherKind = r < 0.38 ? 'ashfall' : (r < 0.50 ? 'fog' : 'clear');
        else activeWeatherKind = r < 0.16 ? 'drizzle' : (r < 0.28 ? 'rain' : (r < 0.35 ? 'storm' : (r < 0.42 ? 'fog' : (r < 0.48 ? 'aurora' : (r < 0.53 ? 'meteor' : 'clear')))));
      }
      if (!inOverworld) activeWeatherKind = 'clear';
    } else {
      activeWeatherKind = inOverworld ? weatherMode : 'clear';
    }
    if (inChillWheat && activeWeatherKind === 'storm') activeWeatherKind = 'rain';

    const wIntensityGoal = (activeWeatherKind === 'clear' || activeWeatherKind === 'meteor' || activeWeatherKind === 'aurora') ? 0.0
      : (activeWeatherKind === 'drizzle' ? 0.40 : (activeWeatherKind === 'ashfall' ? 0.55 : (activeWeatherKind === 'rain' ? 0.72 : (activeWeatherKind === 'snow' ? 0.68 : (activeWeatherKind === 'fog' ? 0.58 : 1.0)))));
    autoWeatherTarget = (!inOverworld) ? 0.0 : ((weatherMode === 'auto' && inChillWheat && wIntensityGoal > 0.76) ? 0.76 : wIntensityGoal);
    rainIntensity += (autoWeatherTarget - rainIntensity) * Math.min(1, dt * (weatherMode === 'auto' ? 0.95 : 3.2));
    const wetMode = (activeWeatherKind === 'rain' || activeWeatherKind === 'drizzle' || activeWeatherKind === 'storm' || activeWeatherKind === 'fog');
    envUniforms.uRainWetness.value = (inOverworld && wetMode) ? rainIntensity : 0.0;
    const windMul = (activeWeatherKind === 'blizzard' || activeWeatherKind === 'sandstorm') ? 2.15 : (activeWeatherKind === 'storm' ? 1.55 : ((inChillWheat || activeWeatherKind === 'drizzle') ? 0.68 : 1.15));
    envUniforms.uWindStrength.value = 1.0 + (inOverworld ? rainIntensity * windMul : 0.0);

    if (inOverworld && !inChillWheat && activeWeatherKind === 'storm' && rainIntensity > 0.72) {
      thunderTimer -= dt;
      if (thunderTimer <= 0) {
        thunderTimer = 5.5 + Math.random() * 7.5;
        const ang = Math.random() * Math.PI * 2, d = 10 + Math.random() * 15;
        const sx = Math.floor(player.x + Math.cos(ang) * d) + 0.5, sz = Math.floor(player.z + Math.sin(ang) * d) + 0.5;
        const strikeBio = getBiomeAt(Math.floor(sx), Math.floor(sz));
        if (strikeBio !== BIOMES.WHEAT_VALLEY) {
          const sy = getTerrainHeight(Math.floor(sx), Math.floor(sz), strikeBio) + 1;
          spawnLightningStrike(sx, sy, sz, true);
        }
      }
    }
    updateLightningBolts(dt);
    if (lightningFlash > 0) lightningFlash = Math.max(0, lightningFlash - dt * 3.8);

    const isBlizzard = (activeWeatherKind === 'blizzard');
    const isSandstorm = (activeWeatherKind === 'sandstorm');
    const isAshfall = (activeWeatherKind === 'ashfall');
    const isDrizzle = (activeWeatherKind === 'drizzle');
    const isSnow = (activeWeatherKind === 'snow' || isBlizzard || (isColdBio && (activeWeatherKind === 'rain' || isDrizzle)));
    const hasParticles = (activeWeatherKind === 'rain' || isDrizzle || activeWeatherKind === 'storm' || isSnow || isSandstorm || isAshfall);
    const showWeather = (inOverworld && hasParticles && rainIntensity > 0.05 && player.y > -4 && depthOffset === 0 && !player.eyesInWater);
    weatherLines.visible = showWeather && !!sodiumOpts.weatherFx;
    if (showWeather) {
      weatherMat.color.setHex(isAshfall ? 0xfb923c : (isSandstorm ? 0xe9be74 : (isBlizzard ? 0xe2f4ff : (isSnow ? 0xf8fafc : (isDrizzle ? 0xcfe8ff : 0xd8f3ff)))));
      weatherMat.opacity = rainIntensity * (isBlizzard ? 0.90 : (isSandstorm ? 0.82 : (isAshfall ? 0.74 : (isSnow ? 0.84 : (isDrizzle ? 0.44 : 0.62)))));
      const streakBase = isAshfall ? 0.14 : (isSandstorm ? 0.62 : (isBlizzard ? 0.34 : (isSnow ? 0.16 : (isDrizzle ? 0.52 : 0.92))));
      const fallMul = isAshfall ? 0.20 : (isSandstorm ? 0.36 : (isBlizzard ? 0.58 : (isSnow ? 0.25 : (isDrizzle ? 0.82 : 1.18))));
      const windX = isAshfall ? (0.14 + Math.sin(elapsed * 1.1) * 0.10) : (isSandstorm ? 1.95 : (isBlizzard ? 1.45 : (isSnow ? 0.06 : (0.18 + Math.sin(elapsed * 0.7) * 0.05))));
      const windZ = isAshfall ? (0.08 + Math.cos(elapsed * 0.9) * 0.08) : (isSandstorm ? 0.85 : (isBlizzard ? 0.62 : (isSnow ? 0.04 : (0.09 + Math.cos(elapsed * 0.5) * 0.03))));
      const drawCnt = Math.floor(WEATHER_CNT * rainIntensity * (_isMobilePerf ? 0.55 : 1));
      weatherGeo.setDrawRange(0, drawCnt * 2);
      for (let i = 0; i < drawCnt; i++) {
        const w = weatherOffsets[i];
        w.y -= w.sp * fallMul * dt;
        w.x -= windX * dt * (isSandstorm || isBlizzard ? 5.2 : 2.4);
        w.z -= windZ * dt * (isSandstorm || isBlizzard ? 4.4 : 2.4);
        if (w.y < -3 || w.x < -15 || w.x > 15 || w.z < -15 || w.z > 15) {
          w.y = 18 + (i & 3) * 0.6;
          w.x = (Math.random() - 0.5) * 26;
          w.z = (Math.random() - 0.5) * 26;
        }
        const wx = player.x + w.x + ((isSnow && !isBlizzard) || isAshfall ? Math.sin(elapsed * 2.1 + i) * 0.55 : 0.0);
        const wy = player.y + w.y;
        const wz = player.z + w.z + ((isSnow && !isBlizzard) || isAshfall ? Math.cos(elapsed * 1.7 + i) * 0.35 : 0.0);
        const sLen = streakBase * (0.82 + ((i & 3) * 0.12));
        const b = i * 6;
        weatherPositions[b] = wx; weatherPositions[b + 1] = wy; weatherPositions[b + 2] = wz;
        weatherPositions[b + 3] = wx + windX * sLen; weatherPositions[b + 4] = wy + (isSandstorm ? sLen * 0.25 : sLen); weatherPositions[b + 5] = wz + windZ * sLen;
      }
      weatherGeo.attributes.position.needsUpdate = true;
      // Authentic Minecraft ground raindrop splash crowns & ripples on exposed terrain/water around player!
      if (!isSnow && !isSandstorm && !isAshfall && (activeWeatherKind === 'rain' || isDrizzle || activeWeatherKind === 'storm') && rainIntensity > 0.18 && Math.random() < Math.min(0.85, rainIntensity * (_isMobilePerf ? 0.55 : 0.95))) {
        const splashes = (_isMobilePerf || rainIntensity < 0.55) ? 1 : 2;
        for (let si = 0; si < splashes; si++) {
          const rx = player.x + (Math.random() - 0.5) * 14.0;
          const rz = player.z + (Math.random() - 0.5) * 14.0;
          const bx = Math.floor(rx), bz = Math.floor(rz);
          const ch = chunks.get(chunkKey(bx >> 4, bz >> 4));
          if (!ch) continue;
          const colBase = ((bz & 15) << 4) | (bx & 15);
          const startY = Math.min(MAX_Y - 1, Math.floor(player.y + 10));
          const minScanY = Math.max(MIN_Y + 1, Math.floor(player.y - 6));
          for (let by = startY; by >= minScanY; by--) {
            const bid = ch.data[((by - MIN_Y) << 8) | colBase];
            if (bid === B.AIR) continue;
            if (IS_SOLID[bid] === 1 || bid === B.WATER) {
              const sy = by + (bid === B.WATER ? 0.92 : 1.03);
              spawnPixelFx('rain_splash', rx, sy, rz, { count: 1, scale: 0.42 + Math.random() * 0.16, life: 0.24, riseV: 0.18, randV: 0.12, spread: 0.08 });
            }
            break;
          }
        }
      }
    }

    // Unified 2D PixelFX Plumes & Fire Licks (Sulfur Steam Vents, Campfires, Fire, Soul Fire)
    if (isPlaying && !isWorldLoading && (typeof sodiumOpts === 'undefined' || sodiumOpts.particles !== false)) {
      _sulfurSteamAcc += dt;
      const _steamStep = (_isWeakDevice || shaderQuality === 'low') ? 0.28 : 0.19;
      if (_sulfurSteamAcc >= _steamStep) {
        _sulfurSteamAcc = 0;
        // Lightweight ambient Dream Water sparkles (The Sift) & subtle rising lava-heat mist (The Nether)
        if (currentDimension === 'sift') {
          const dwCfg = (window.NUCRAFT_REALM_CONFIG && window.NUCRAFT_REALM_CONFIG.dreamWater) || { sparkleRadius: 14 };
          const sRad = Math.max(6, Number(dwCfg.sparkleRadius) || 14);
          for (let spI = 0; spI < 2; spI++) {
            const sx = Math.floor(player.x + (Math.random() - 0.5) * sRad * 2);
            const sz = Math.floor(player.z + (Math.random() - 0.5) * sRad * 2);
            if (getBlockWorld(sx, WATER_LEVEL, sz) === B.WATER && getBlockWorld(sx, WATER_LEVEL + 1, sz) === B.AIR) {
              spawnPixelFx('magic_dream', sx + Math.random(), WATER_LEVEL + 0.96, sz + Math.random(), { count: 1, scale: 0.52, life: 0.65, riseV: 0.42, randV: 0.14, spread: 0.22 });
            }
          }
        } else if (currentDimension === 'nether' && Math.random() < 0.45) {
          // Gentle warm lava heat-mist wisps rising off nearby lava pools (atmospheric & light!)
          const lx = Math.floor(player.x + (Math.random() - 0.5) * 26);
          const lz = Math.floor(player.z + (Math.random() - 0.5) * 26);
          if (Math.hypot(lx - player.x, lz - player.z) > 4.5 && getBlockWorld(lx, WATER_LEVEL, lz) === B.LAVA && getBlockWorld(lx, WATER_LEVEL + 1, lz) === B.AIR) {
            spawn2DPixelPlume('smoke_puff', lx + 0.5, WATER_LEVEL + 1.05, lz + 0.5, { count: 1, scale: 0.72, grow: 0.85, vy: 0.58, randV: 0.12, spread: 0.35, life: 3.4 });
          }
        }
        _smokePlumeTick = (_smokePlumeTick + 1) % 3;
        const emitSmokeNow = (_smokePlumeTick === 0);
        const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
        const vRad = Math.min(3, Math.max(1, renderDistance || 3));
        const maxDistSq = (_isWeakDevice || shaderQuality === 'low') ? 1600.0 : 3600.0;
        for (let dz = -vRad; dz <= vRad; dz++) {
          for (let dx = -vRad; dx <= vRad; dx++) {
            const vch = chunks.get(chunkKey(pcx + dx, pcz + dz));
            const nodes = vch && vch.ventNodes;
            if (!nodes || nodes.length === 0) continue;
            for (let vi = 0; vi < nodes.length; vi++) {
              const vn = nodes[vi];
              const ddx = vn.x + 0.5 - player.x, ddz = vn.z + 0.5 - player.z;
              const d2 = ddx * ddx + ddz * ddz;
              if (d2 > maxDistSq) continue;
              if (getBlockWorld(vn.x, vn.y + 1, vn.z) !== B.AIR) continue;
              if (vn.kind === 'fire' || vn.kind === 'soul_fire') {
                if (d2 > 676.0) continue;
                const isSoul = (vn.kind === 'soul_fire');
                if (Math.random() < 0.78) {
                  spawn2DPixelPlume(isSoul ? 'soul_flame' : 'fire_flame', vn.x + 0.5, vn.y + 0.45, vn.z + 0.5, {
                    count: 1, scale: 1.08, grow: 0.18, vy: 1.22, randV: 0.16, spread: 0.44, life: 0.48
                  });
                }
                if (emitSmokeNow && !isSoul && Math.random() < 0.55) {
                  spawn2DPixelPlume('smoke_puff', vn.x + 0.5, vn.y + 0.95, vn.z + 0.5, {
                    count: 1, scale: 0.96, grow: 0.78, vy: 0.60, randV: 0.06, spread: 0.26, life: 6.8
                  });
                }
              } else {
                const isCf = (vn.kind === 'campfire');
                if (emitSmokeNow) {
                  spawn2DPixelPlume(isCf ? 'campfire_smoke' : 'sulfur_steam', vn.x + 0.5, vn.y + (isCf ? 0.88 : 1.12), vn.z + 0.5, {
                    count: 1, scale: isCf ? 1.32 : 1.48, spread: isCf ? 0.16 : 0.20, randV: 0.03,
                    grow: isCf ? 0.92 : 1.05, vy: isCf ? 0.66 : 0.76, life: isCf ? 15.5 : 17.0
                  });
                  if (!isCf && Math.random() < 0.34) {
                    spawn2DPixelPlume('sulfur_steam', vn.x + 0.5, vn.y + 1.28, vn.z + 0.5, {
                      count: 1, scale: 0.98, spread: 0.38, randV: 0.05,
                      grow: 0.85, vy: 0.70, life: 14.0
                    });
                  }
                }
                if (isCf && d2 <= 900.0) {
                  spawn2DPixelPlume('fire_flame', vn.x + 0.5, vn.y + 0.56, vn.z + 0.5, {
                    count: 1, scale: 1.02, grow: 0.14, vy: 1.12, randV: 0.10, spread: 0.26, life: 0.48
                  });
                }
              }
            }
          }
        }
      }
    }

    // Localized Cozy 7-Light Pool (1 Held Emissive Light + 6 World Lantern/Torch/Crystal/Lava Lights!)
    const sel = inventory[player.selectedSlot];
    const heldId = (sel && sel.count > 0) ? sel.id : 0;
    const heldDef = heldId ? BLOCK_DEF[heldId] : null;
    const offId = (player.equip && player.equip.offhand) ? player.equip.offhand : 0;
    const offDef = offId ? BLOCK_DEF[offId] : null;
    const activeGlowId = ((heldDef && heldDef.emissive) || heldId === B.FIRE_SWORD) ? heldId : ((offDef && offDef.emissive) ? offId : 0);
    torchLight.position.set(player.x, player.y + (activeGlowId ? 1.55 : 1.35), player.z);
    if (activeGlowId) {
      if (activeGlowId === B.LANTERN) {
        torchLight.color.setHex(0xffca7a);
        torchLight.distance = 28; torchLight.decay = 1.25;
        torchLight.intensity = (player.eyesInWater ? 1.35 : 1.28) + Math.sin(elapsed * 8) * 0.04;
      } else if (activeGlowId === B.TORCH_BLOCK) {
        torchLight.color.setHex(0xffbc68);
        torchLight.distance = 25; torchLight.decay = 1.30;
        torchLight.intensity = (player.eyesInWater ? 1.22 : 1.15) + Math.sin(elapsed * 10) * 0.05;
      } else if (activeGlowId === B.SOUL_LANTERN) {
        torchLight.color.setHex(0x38e8ff);
        torchLight.distance = 25; torchLight.decay = 1.30;
        torchLight.intensity = (player.eyesInWater ? 1.25 : 1.18) + Math.sin(elapsed * 7) * 0.04;
      } else {
        const hCol = (activeGlowId === B.SOUL_FIRE) ? 0x22d3ee
          : ((activeGlowId === B.SEA_LANTERN || activeGlowId === B.GLOW_CRYSTAL || activeGlowId === B.ELEVATOR_BLOCK) ? 0x67e8f9
          : (activeGlowId === B.MUSHROOM_GLOW ? 0x2dd4bf
          : (activeGlowId === B.END_CRYSTAL_BLOCK ? 0xe879f9
          : (activeGlowId === B.FIRE_SWORD || activeGlowId === B.CAMPFIRE || activeGlowId === B.LAVA ? 0xff7b2e : 0xffb347))));
        torchLight.color.setHex(hCol);
        torchLight.distance = 22; torchLight.decay = 1.45;
        torchLight.intensity = (player.eyesInWater ? 0.92 : 0.82) + Math.sin(elapsed * 10) * 0.04;
      }
    } else if (!player.eyesInWater && (player.y < -6 || depthOffset > 0)) {
      torchLight.distance = 18; torchLight.decay = 1.85;
      torchLight.color.setHex(0xffd296); torchLight.intensity = 0.36;
    } else torchLight.intensity = 0.0;

    _lightAcc += dt;
    if (_lightAcc >= 0.065) {
      _lightAcc = 0;
      const maxLights = shaderQuality === 'low' ? Math.min(5, dynamicLightPool.length) : dynamicLightPool.length;
      const need = Math.min(_topLights.length, Math.max(0, maxLights - 1));
      _dynLightFound = 0;
      if (need > 0) {
        for (let i = 0; i < mobs.length; i++) {
          const m = mobs[i];
          if (m.isBoss || m.fusing || m.burning || m.type === 'blaze') {
            const dx = m.x - player.x, dz = m.z - player.z, d2 = dx * dx + dz * dz;
            const isEndDrg = (m.type === 'ender_dragon' || m.type === 'sovereign_end_dragon');
            if (d2 <= (isEndDrg ? 2304 : 576)) {
              let lx = m.x, ly = m.y + 1.4, lz = m.z;
              if (isEndDrg && typeof window._getDragonBodyCenterWorldPos === 'function') {
                const bc = window._getDragonBodyCenterWorldPos(m, _tmpLightPos);
                lx = bc.x; ly = bc.y; lz = bc.z;
              }
              _offerDynLight(need, lx, ly, lz, m.fusing ? 0xd9f99d : (isEndDrg ? 0xd946ef : 0xff7b28), isEndDrg ? 1.15 : 0.85, d2, 1, isEndDrg ? 32 : 20);
            }
          }
        }
        for (let i = 0; i < primedTnts.length; i++) {
          _offerDynLight(need, primedTnts[i].x, primedTnts[i].y + 0.8, primedTnts[i].z, 0xffaa44, 0.95, 1, 1);
        }
        const px = Math.floor(player.x) >> 4, pz = Math.floor(player.z) >> 4;
        for (let cz = pz - 2; cz <= pz + 2; cz++) for (let cx = px - 2; cx <= px + 2; cx++) {
          const ch = chunks.get(chunkKey(cx, cz));
          if (!ch || !ch.lightNodes) continue;
          for (let li = 0; li < ch.lightNodes.length; li++) {
            const ln = ch.lightNodes[li];
            const dx = ln.x - player.x, dy = ln.y - player.y, dz = ln.z - player.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 <= 3025) _offerDynLight(need, ln.x, ln.y, ln.z, ln.col, ln.int, d2, ln.prio || 0, ln.dist || 20);
          }
        }
      }
      const crowdDamp = _dynLightFound > 1 ? 1.0 / (1.0 + 0.24 * (_dynLightFound - 1)) : 1.0;
      for (let s = 1; s < dynamicLightPool.length; s++) {
        const pl = dynamicLightPool[s], c = (s <= _dynLightFound) ? _topLights[s - 1] : null;
        if (c) {
          const dist = c.dist || 20;
          const fade = Math.max(0.55, 1.0 - Math.sqrt(c.d2) / 48.0);
          pl.position.set(c.x, c.y, c.z); pl.color.setHex(c.col);
          pl.distance = dist;
          pl.decay = dist >= 24 ? 1.30 : 1.65;
          pl.intensity = Math.min(1.40, c.int * fade * crowdDamp);
        } else pl.intensity = 0;
      }
    }
  }

  const _colBlissHor = new THREE.Color(0xf6bfd9), _colBlissTop = new THREE.Color(0x4a76cf), _colSunsetSun = new THREE.Color(0xff923c);
  const _colMoonTop = new THREE.Color(0x050e20), _colMoonHor = new THREE.Color(0x152847);
  const _colMoonDayTop = new THREE.Color(0x2466cc), _colMoonDayHor = new THREE.Color(0xa6d2f8);
  const _colChillTop = new THREE.Color(0x254078), _colChillHor = new THREE.Color(0xf3a368), _colChillSun = new THREE.Color(0xffd27a);
  const _colChillHemiSky = new THREE.Color(0x768bc8);
  const _colFreshTop = new THREE.Color(0x1f63c8), _colFreshHor = new THREE.Color(0x7fb2e6), _colFreshSun = new THREE.Color(0xfff5e0);
  const _colUwShallow = new THREE.Color(0x0b6578), _colUwMid = new THREE.Color(0x04304d), _colUwAbyss = new THREE.Color(0x010612), _colUwNight = new THREE.Color(0x020f24);
  const _colUwSunShallow = new THREE.Color(0x9ee8ff), _colUwSunAbyss = new THREE.Color(0x091c38);
  const _colSiftNightTop = new THREE.Color(0x0b1f3f), _colSiftNightHor = new THREE.Color(0x1c2f56), _colSiftNightFog = new THREE.Color(0x162646);
  const _colDrNightTop = new THREE.Color(0x261830), _colDrNightHor = new THREE.Color(0x4a2a46), _colDrNightFog = new THREE.Color(0x3a223b);
  const _colBiomeFogScaled = new THREE.Color(0x1b0b18);
  const _elLobby = document.getElementById('lobbyScreen'), _elCoords = document.getElementById('coordsText');
  const _elDays = document.getElementById('daysText'), _elDepth = document.getElementById('depthText');
  const _elUnderwater = document.getElementById('underwaterOverlay');
  const _elLava = document.getElementById('lavaOverlay');
  const _elDarknessOv = document.getElementById('darknessOverlay');
  const _elDressingRoom = document.getElementById('dressingRoomScreen');
  const _elInvModal = document.getElementById('invModal');
  const _elFurnModal = document.getElementById('furnaceModal');
  const _elSmithModal = document.getElementById('smithingModal');
  const _elTradeModal = document.getElementById('tradeModal');
  const _elMenuModal = document.getElementById('menuModal');
  const _elAirRow = document.getElementById('airRow');
  const _elItemLabel = document.getElementById('itemLabel');
  let _lastAtkCdVis = false, _lastAtkCdReady = false, _lastAtkCdPct = -1;
  const _tmpFog = new THREE.Color(0xc8f2ef);
  function updateAtmosphere(dt) {
    envUniforms.uDimension.value = currentDimension === 'warden' ? 4.0 : (currentDimension === 'sift' ? 3.0 : (currentDimension === 'dragon_realm' ? 2.15 : (currentDimension === 'end' ? 2.0 : (currentDimension === 'nether' ? 1.0 : 0.0))));
    // Luanti/Minecraft horizon rule: distance fog MUST reach 100% strictly inside loaded chunks (never past unloaded border)
    const loadedEdge = Math.max(15.0, renderDistance * 16.0 - 2.5);
    // Unified world clock tick across all dimensions & biomes so time never freezes or desyncs
    const prevDay = dayTime;
    dayTime = (dayTime + dt / DAY_LENGTH_SEC) % 1.0;
    if (dayTime < prevDay) player.daysPlayed++;
    const ang = dayTime * Math.PI * 2 - Math.PI * 0.5, sunY = Math.sin(ang);
    const sunsetWeight = Math.max(0, 1 - Math.abs(sunY - 0.16) * 2.65);
    const dayWeight = Math.max(0, Math.min(1, (sunY + 0.12) * 2.6));
    const applyLavaAtmo = () => {
      const inLv = !!(player && player.eyesInLava);
      envUniforms.uInLava.value = inLv ? 1.0 : 0.0;
      if (!inLv) return;
      envUniforms.uUnderwater.value = 0.0;
      envUniforms.uFogColor.value.setHex(0x9c2606);
      envUniforms.uSkyTop.value.setHex(0x741602);
      envUniforms.uSkyHorizon.value.setHex(0xa82a06);
      envUniforms.uFogStart.value = 0.35;
      envUniforms.uFogEnd.value = 2.95;
      scene.fog.color.copy(envUniforms.uFogColor.value);
      scene.fog.near = 0.35;
      scene.fog.far = 2.95;
      renderer.setClearColor(envUniforms.uFogColor.value, 1);
      envUniforms.uShaftStrength.value = 0.0;
      envUniforms.uSunVis.value = 0.0;
      cloudMesh.visible = false;
    };

    // ===================== DIMENSION 5: WARDEN REALM ATMOSPHERE =====================
    const _isNcr2 = (shaderPreset === 'ncr2');
    if (currentDimension === 'warden') {
      _tmpTop.setHex(_isNcr2 ? 0x061322 : 0x030b14);
      _tmpHor.setHex(_isNcr2 ? 0x0f3246 : 0x082635);
      _tmpFog.setHex(_isNcr2 ? 0x0b2535 : 0x071d29);
      envUniforms.uSkyTop.value.copy(_tmpTop);
      envUniforms.uSkyHorizon.value.copy(_tmpHor);
      envUniforms.uFogColor.value.copy(_tmpFog);
      scene.fog.color.copy(_tmpFog);
      const _wEnd = Math.min(loadedEdge, Math.max(48.0, renderDistance * 15.0));
      const _wStart = Math.min(20.0, _wEnd * 0.56);
      scene.fog.near = _wStart; scene.fog.far = _wEnd;
      envUniforms.uFogStart.value = _wStart; envUniforms.uFogEnd.value = _wEnd;
      renderer.setClearColor(_tmpFog, 1);
      sunLight.color.setHex(_isNcr2 ? 0x7ef0ff : 0x67e8f9);
      sunLight.intensity = _isNcr2 ? 0.86 : 0.78;
      hemiLight.color.setHex(_isNcr2 ? 0x38d9f0 : 0x22d3ee);
      hemiLight.groundColor.setHex(_isNcr2 ? 0x0b1d2a : 0x06131c);
      hemiLight.intensity = _isNcr2 ? 0.66 : 0.56;
      envUniforms.uSunColor.value.setHex(_isNcr2 ? 0x7ef0ff : 0x67e8f9);
      envUniforms.uSunDir.value.set(0.32, 0.86, 0.36).normalize();
      const snapX = Math.round(player.x / 2) * 2, snapY = Math.round(player.y / 2) * 2, snapZ = Math.round(player.z / 2) * 2;
      sunLight.target.position.set(snapX, snapY, snapZ);
      sunLight.position.set(snapX + 22, snapY + 46, snapZ + 22);
      sunLight.target.updateMatrixWorld();
      if (envUniforms.uSurfaceLight) envUniforms.uSurfaceLight.value = 0.25;
      envUniforms.uMoonBoost.value = 0.0; envUniforms.uShaftStrength.value = 0.0; envUniforms.uSunVis.value = 0.0;
      envUniforms.uUnderwater.value = player.eyesInWater ? 1.0 : 0.0;
      cloudMesh.visible = false;
      updateShootingStars(dt, 1, false);
      updateAirMotesBatch(dt, shaderQuality !== 'low', 'sift');
      applyLavaAtmo();
      return;
    }

    // ===================== DIMENSION 6: DRAGON REALM ATMOSPHERE (TIME-SYNCED HAZY ROSE SKY) =====================
    if (currentDimension === 'dragon_realm') {
      const drNight = 1.0 - dayWeight;
      _tmpTop.setHex(_isNcr2 ? 0xdec0c4 : 0xd6b4b9).lerp(_colDrNightTop, 0.62 * drNight);
      _tmpHor.setHex(_isNcr2 ? 0xf2d9d6 : 0xebd1ce).lerp(_colDrNightHor, 0.62 * drNight);
      _tmpFog.setHex(_isNcr2 ? 0xebd0ce : 0xe4c6c5).lerp(_colDrNightFog, 0.62 * drNight);
      envUniforms.uSkyTop.value.copy(_tmpTop);
      envUniforms.uSkyHorizon.value.copy(_tmpHor);
      envUniforms.uFogColor.value.copy(_tmpFog);
      scene.fog.color.copy(_tmpFog);
      const _drEnd = loadedEdge;
      const _drStart = Math.min(24.0, _drEnd * 0.34);
      scene.fog.near = _drStart; scene.fog.far = _drEnd;
      envUniforms.uFogStart.value = _drStart; envUniforms.uFogEnd.value = _drEnd;
      renderer.setClearColor(_tmpFog, 1);
      sunLight.color.setHex(_isNcr2 ? 0xffebe0 : 0xffe4d6).lerp(_colMoonDayTop, 0.35 * drNight);
      sunLight.intensity = (_isNcr2 ? 1.06 : 1.00) * (0.62 + 0.38 * dayWeight);
      hemiLight.color.setHex(_isNcr2 ? 0xf6d4d4 : 0xf0c7c8).lerp(_colDrNightHor, 0.45 * drNight);
      hemiLight.groundColor.setHex(_isNcr2 ? 0x99524c : 0x8a4540);
      hemiLight.intensity = (_isNcr2 ? 0.72 : 0.66) * (0.68 + 0.32 * dayWeight);
      envUniforms.uSunColor.value.copy(sunLight.color);
      envUniforms.uSunDir.value.set(Math.cos(ang) * 0.85, sunY, 0.42).normalize();
      const snapX = Math.round(player.x / 2) * 2, snapY = Math.round(player.y / 2) * 2, snapZ = Math.round(player.z / 2) * 2;
      sunLight.target.position.set(snapX, snapY, snapZ);
      sunLight.position.set(snapX + Math.cos(ang) * 26, snapY + Math.max(18, Math.abs(sunY) * 52), snapZ + 26);
      sunLight.target.updateMatrixWorld();
      if (envUniforms.uSurfaceLight) envUniforms.uSurfaceLight.value = 0.56 + 0.36 * dayWeight;
      envUniforms.uMoonBoost.value = drNight > 0.5 ? (drNight - 0.5) * 0.9 : 0.0; envUniforms.uShaftStrength.value = 0.0; envUniforms.uSunVis.value = 0.0;
      envUniforms.uUnderwater.value = player.eyesInWater ? 1.0 : 0.0;
      cloudMesh.visible = false;
      updateShootingStars(dt, 0, false);
      updateAirMotesBatch(dt, shaderQuality !== 'low', 'dragon');
      applyLavaAtmo();
      return;
    }

    // ===================== DIMENSION 4: THE SIFT (6 DISTINCT BIOME SKIES SYNCED TO WORLD TIME!) =====================
    if (currentDimension === 'sift') {
      const inDreamUw = !!(player && player.eyesInWater);
      const sBio = getPlayerBiome();
      const sNight = 1.0 - dayWeight;
      const isSiftMeadow = (sBio === BIOMES.SIFT_MEADOW);
      const isSiftLullaby = (sBio === BIOMES.SIFT_LULLABY || sBio === BIOMES.SIFT_LULLABY_TOP);
      const isSiftBurrows = (sBio === BIOMES.SIFT_ICHOR_PONDS);
      const isSiftHusk = (sBio === BIOMES.SIFT_HUSKLAND);
      const isSiftFungal = (sBio === BIOMES.SIFT_SPOREFIELDS);

      if (inDreamUw) {
        _tmpTop.setHex(0x4db6d6); _tmpHor.setHex(0xc48cd6); _tmpFog.setHex(0x86c8de);
      } else if (isSiftMeadow) {
        // Singer's Meadow: bright blue-cyan sky with white clouds (Ref 2/8)
        _tmpTop.setHex(0x4cb8f0); _tmpHor.setHex(0x7ef2dc); _tmpFog.setHex(0x8beae2);
      } else if (isSiftLullaby) {
        // Lullaby Hills: crisp cyan-pastel by day, dreamy deep blue at night (Refs 4/6 & 7/3)
        _tmpTop.setHex(0x52c4db); _tmpHor.setHex(0xe4c6e8); _tmpFog.setHex(0xc0d8e6);
      } else if (isSiftBurrows) {
        // Burrows & Ichor: warm dusty rose-pink sky (Refs 5 & 10)
        _tmpTop.setHex(0x98c6e4); _tmpHor.setHex(0xf2b8dc); _tmpFog.setHex(0xdcb4cc);
      } else if (isSiftHusk) {
        // Humbler Huskland: light hazy pink sky (Ref 1/9)
        _tmpTop.setHex(0xdcc2c8); _tmpHor.setHex(0xf2d9d8); _tmpFog.setHex(0xe8cccd);
      } else if (isSiftFungal) {
        // Fungal Sporefields: darker mystical violet-indigo twilight & light mystic fog
        _tmpTop.setHex(0x1b1238); _tmpHor.setHex(0x4c2b72); _tmpFog.setHex(0x3a2458);
      } else {
        // Central The Sift: pastel cyan-to-rose aurora sky (Refs 1, 2, 7)
        _tmpTop.setHex(_isNcr2 ? 0x3098b2 : 0x26829c);
        _tmpHor.setHex(_isNcr2 ? 0xe0a6cc : 0xd092bc);
        _tmpFog.setHex(_isNcr2 ? 0x968cb2 : 0x847a9e);
      }
      if (!inDreamUw) {
        const sNightBlend = isSiftFungal ? 0.40 * sNight : 0.72 * sNight;
        _tmpTop.lerp(_colSiftNightTop, sNightBlend).lerp(colSunsetTop, sunsetWeight * 0.18);
        _tmpHor.lerp(_colSiftNightHor, sNightBlend).lerp(colSunsetHor, sunsetWeight * 0.22);
        _tmpFog.lerp(_colSiftNightFog, sNightBlend).lerp(colSunsetHor, sunsetWeight * 0.16);
      }
      envUniforms.uSkyTop.value.copy(_tmpTop);
      envUniforms.uSkyHorizon.value.copy(_tmpHor);
      envUniforms.uFogColor.value.copy(_tmpFog);
      scene.fog.color.copy(_tmpFog);
      const _sfEnd = inDreamUw ? Math.min(loadedEdge, 34.0) : loadedEdge;
      const _sfStart = inDreamUw ? 6.0 : (isSiftFungal ? Math.min(20.0, _sfEnd * 0.30) : (isSiftHusk ? Math.min(24.0, _sfEnd * 0.36) : Math.min(34.0, _sfEnd * 0.46)));
      scene.fog.near = _sfStart; scene.fog.far = _sfEnd;
      envUniforms.uFogStart.value = _sfStart; envUniforms.uFogEnd.value = _sfEnd;
      renderer.setClearColor(_tmpFog, 1);
      sunLight.color.setHex(isSiftFungal ? 0xd4b8ff : (isSiftHusk ? 0xffe8dc : 0xffe2d6)).lerp(_colMoonDayTop, 0.42 * sNight);
      sunLight.intensity = (isSiftFungal ? 0.72 : (_isNcr2 ? 1.04 : 0.98)) * (0.58 + 0.42 * dayWeight);
      hemiLight.color.setHex(isSiftFungal ? 0x9868e8 : (isSiftHusk ? 0xf2d0d4 : (isSiftMeadow ? 0xa4f4f8 : 0x76e2ea))).lerp(_colSiftNightHor, 0.45 * sNight);
      hemiLight.groundColor.setHex(isSiftFungal ? 0x2a1844 : (isSiftBurrows ? 0x6b2232 : 0x4c3050));
      hemiLight.intensity = (isSiftFungal ? 0.54 : 0.62) * (0.65 + 0.35 * dayWeight);
      envUniforms.uSunColor.value.copy(sunLight.color);
      envUniforms.uSunDir.value.set(Math.cos(ang) * 0.85, sunY, 0.42).normalize();
      const snapX = Math.round(player.x / 2) * 2, snapY = Math.round(player.y / 2) * 2, snapZ = Math.round(player.z / 2) * 2;
      sunLight.target.position.set(snapX, snapY, snapZ);
      sunLight.position.set(snapX + Math.cos(ang) * 26, snapY + Math.max(18, Math.abs(sunY) * 52), snapZ + 26);
      sunLight.target.updateMatrixWorld();
      if (envUniforms.uSurfaceLight) envUniforms.uSurfaceLight.value = (isSiftFungal ? 0.65 : 0.92) * (0.58 + 0.42 * dayWeight);
      envUniforms.uMoonBoost.value = sNight > 0.5 ? (sNight - 0.5) * 1.1 : 0.0;
      envUniforms.uShaftStrength.value = 0.0; envUniforms.uSunVis.value = 0.0;
      envUniforms.uUnderwater.value = inDreamUw ? 1.0 : 0.0;
      // Show crisp white Minecraft clouds in Singer's Meadow (Ref 2/8); keep aurora open in Central Sift!
      cloudMesh.visible = isSiftMeadow && !inDreamUw;
      updateShootingStars(dt, isSiftMeadow ? 0 : 1, false);
      updateAirMotesBatch(dt, shaderQuality !== 'low', isSiftFungal ? 'end' : 'sift');
      applyLavaAtmo();
      return;
    }

    // ===================== DIMENSION 2: THE NETHER ATMOSPHERE =====================
    if (currentDimension === 'nether') {
      const curB = getPlayerBiome();
      const isWarped = (curB === BIOMES.NETHER_WARPED);
      const isBasalt = (curB === BIOMES.NETHER_BASALT_DELTAS);
      const isSoulV  = (curB === BIOMES.NETHER_SOUL_VALLEY);
      // Authentic Minecraft 1.16 Nether biome atmosphere (deep crimson haze, eerie teal Warped/Soul Valley mist, smoky Basalt ash)
      _tmpTop.setHex(isBasalt ? 0x2c2536 : (isSoulV ? 0x102832 : (isWarped ? 0x112b34 : 0x3f1410)));
      _tmpHor.setHex(isBasalt ? 0x524760 : (isSoulV ? 0x1b404d : (isWarped ? 0x1c4550 : 0x6b2419)));
      envUniforms.uSkyTop.value.copy(_tmpTop); envUniforms.uSkyHorizon.value.copy(_tmpHor);
      envUniforms.uFogColor.value.copy(_tmpHor);
      const _nEnd = Math.min(loadedEdge, isBasalt ? Math.min(loadedEdge, 66.0) : Math.min(loadedEdge, 76.0));
      envUniforms.uFogStart.value = Math.min(isBasalt ? 11.0 : 14.0, _nEnd * 0.34);
      envUniforms.uFogEnd.value = _nEnd;
      scene.fog.color.copy(_tmpHor); scene.fog.near = envUniforms.uFogStart.value; scene.fog.far = envUniforms.uFogEnd.value;
      envUniforms.uSunDir.value.set(0.35, 0.85, 0.30).normalize();
      envUniforms.uSunColor.value.setHex(isBasalt ? 0xd9cbe6 : (isSoulV ? 0x7dd3fc : (isWarped ? 0x6ee7d8 : 0xffb375)));
      const snapX = Math.round(player.x / 2) * 2, snapY = Math.round(player.y / 2) * 2, snapZ = Math.round(player.z / 2) * 2;
      sunLight.target.position.set(snapX, snapY, snapZ);
      sunLight.position.set(snapX + 16, snapY + 34, snapZ + 14);
      sunLight.color.setHex(isBasalt ? 0xd9cde4 : (isSoulV ? 0x8be2fa : (isWarped ? 0x99f6e4 : 0xffbf85)));
      sunLight.intensity = isBasalt ? 0.66 : 0.70;
      hemiLight.color.setHex(isBasalt ? 0x8d809e : (isSoulV ? 0x4bc0e8 : (isWarped ? 0x45cbbd : 0xd46a4a)));
      hemiLight.groundColor.setHex(isBasalt ? 0x352a40 : (isSoulV ? 0x1d3540 : 0x662a18));
      hemiLight.intensity = 0.80;
      if (envUniforms.uSurfaceLight) envUniforms.uSurfaceLight.value = 0.14;
      envUniforms.uMoonBoost.value = 0.0; envUniforms.uShaftStrength.value = 0.0; envUniforms.uSunVis.value = 0.0;
      cloudMesh.visible = false;
      if (typeof skyDome !== 'undefined') skyDome.visible = true;
      updateShootingStars(dt, 1, false);
      updateAirMotesBatch(dt, shaderQuality !== 'low', (isWarped || isSoulV) ? 'nether_warped' : 'nether_crimson');
      applyLavaAtmo();
      return;
    }

    // ===================== DIMENSION 3: THE END ATMOSPHERE =====================
    if (currentDimension === 'end') {
      _tmpTop.setHex(_isNcr2 ? 0x0e0a24 : 0x090414); _tmpHor.setHex(_isNcr2 ? 0x261d48 : 0x1b0e2e);
      envUniforms.uSkyTop.value.copy(_tmpTop); envUniforms.uSkyHorizon.value.copy(_tmpHor);
      envUniforms.uFogColor.value.copy(_tmpHor);
      const _eEnd = loadedEdge;
      envUniforms.uFogStart.value = Math.min(26.0, _eEnd * 0.52);
      envUniforms.uFogEnd.value = _eEnd;
      scene.fog.color.copy(_tmpHor); scene.fog.near = envUniforms.uFogStart.value; scene.fog.far = envUniforms.uFogEnd.value;
      envUniforms.uSunDir.value.set(0.45, 0.80, 0.38).normalize();
      envUniforms.uSunColor.value.setHex(_isNcr2 ? 0xdfd8ff : 0xe9d5ff);
      const snapX = Math.round(player.x / 2) * 2, snapY = Math.round(player.y / 2) * 2, snapZ = Math.round(player.z / 2) * 2;
      sunLight.target.position.set(snapX, snapY, snapZ);
      sunLight.position.set(snapX + 20, snapY + 38, snapZ + 18);
      sunLight.color.setHex(_isNcr2 ? 0xe4dcff : 0xddd6fe); sunLight.intensity = _isNcr2 ? 0.92 : 0.86;
      hemiLight.color.setHex(_isNcr2 ? 0x9b87f5 : 0xa855f7); hemiLight.groundColor.setHex(_isNcr2 ? 0x241a3d : 0x1e132b); hemiLight.intensity = _isNcr2 ? 0.68 : 0.58;
      if (envUniforms.uSurfaceLight) envUniforms.uSurfaceLight.value = 0.32;
      envUniforms.uMoonBoost.value = 0.0; envUniforms.uShaftStrength.value = 0.0; envUniforms.uSunVis.value = 0.0;
      cloudMesh.visible = false;
      updateShootingStars(dt, 1, false);
      updateAirMotesBatch(dt, shaderQuality !== 'low', 'end');
      applyLavaAtmo();
      return;
    }

    // ===================== DIMENSION 1: OVERWORLD PHOTOREAL SOFT-BSL ATMOSPHERE =====================
    envUniforms.uSunDir.value.set(Math.cos(ang) * 0.85, sunY, 0.42).normalize();
    const curBiome = getPlayerBiome();
    const inChillWheatAtmo = (curBiome === BIOMES.WHEAT_VALLEY);
    const stormSkyAmt = rainIntensity * (inChillWheatAtmo ? 0.56 : 0.88);
    // Realistic Dark-Grey Overcast Storm Sky when Raining (while keeping rainy Wheat Field dreamy & chill)
    _tmpTop.copy(colNightTop).lerp(colDayTop, dayWeight).lerp(colSunsetTop, sunsetWeight * 0.68).lerp(colStormTop, stormSkyAmt);
    _tmpHor.copy(colNightHor).lerp(colDayHor, dayWeight).lerp(colSunsetHor, sunsetWeight * 0.86).lerp(colStormHor, Math.min(0.90, stormSkyAmt * 1.02));
    if (shaderPreset === 'bliss') {
      _tmpHor.lerp(_colBlissHor, (0.32 + sunsetWeight * 0.28) * dayWeight * (1 - rainIntensity * 0.7));
      _tmpTop.lerp(_colBlissTop, 0.25 * dayWeight * (1 - rainIntensity * 0.7));
    } else if (shaderPreset === 'moonlit') {
      const nightW = 1.0 - dayWeight;
      _tmpTop.lerp(_colMoonDayTop, 0.24 * dayWeight * (1 - rainIntensity * 0.7)).lerp(_colMoonTop, 0.40 * nightW);
      _tmpHor.lerp(_colMoonDayHor, 0.22 * dayWeight * (1 - rainIntensity * 0.7)).lerp(_colMoonHor, 0.35 * nightW);
    } else if (shaderPreset === 'chill_sunset') {
      const chillClear = dayWeight * (1 - rainIntensity * (inChillWheatAtmo ? 0.50 : 0.70));
      _tmpTop.lerp(_colChillTop, 0.78 * chillClear);
      _tmpHor.lerp(_colChillHor, 0.82 * chillClear);
    } else if (shaderPreset === 'verdant_fresh') {
      _tmpTop.lerp(_colFreshTop, 0.48 * dayWeight * (1 - rainIntensity * 0.7));
      _tmpHor.lerp(_colFreshHor, 0.42 * dayWeight * (1 - rainIntensity * 0.7));
    } else if (shaderPreset === 'dlss_ultra') {
      const dlssClear = dayWeight * (1 - rainIntensity * 0.65);
      _tmpTop.lerp(_colDlssTop, 0.34 * dlssClear);
      _tmpHor.lerp(_colDlssHor, 0.30 * dlssClear);
    } else if (shaderPreset === 'eclipse') {
      const ecDay = dayWeight * (1 - rainIntensity * 0.65);
      const ecNight = (1.0 - dayWeight) * (1 - rainIntensity * 0.50);
      const ecGold = Math.min(1.0, 0.35 + sunsetWeight * 0.85);
      _tmpTop.lerp(_colEclipseNoonTop, 0.42 * ecDay).lerp(_colEclipseTop, 0.52 * ecDay * ecGold).lerp(_colEclipseNightTop, 0.55 * ecNight);
      _tmpHor.lerp(_colEclipseNoonHor, 0.32 * ecDay).lerp(_colEclipseHor, 0.68 * ecDay * ecGold).lerp(_colEclipseNightHor, 0.45 * ecNight);
    } else if (shaderPreset === 'ncr2') {
      // Smooth continuous time-of-day sky blend: crisp azure day, gentle coral-peach sunrise/sunset, readable soft-blue night
      const n2Clear = 1 - rainIntensity * 0.72;
      const n2Day = dayWeight * n2Clear;
      const n2Night = (1.0 - dayWeight) * (1 - rainIntensity * 0.45);
      const n2Sun = sunsetWeight * n2Clear;
      _tmpTop.lerp(_colNcr2Top, 0.72 * n2Day).lerp(_colNcr2SunsetTop, 0.42 * n2Sun).lerp(_colNcr2NightTop, 0.68 * n2Night);
      _tmpHor.lerp(_colNcr2Hor, 0.78 * n2Day).lerp(_colNcr2SunsetHor, 0.54 * n2Sun).lerp(_colNcr2NightHor, 0.64 * n2Night);
    }
    if (activeWeatherKind === 'blizzard') {
      _tmpTop.lerp(_colBlizzHor, 0.78 * rainIntensity);
      _tmpHor.lerp(_colBlizzHor, 0.90 * rainIntensity);
    } else if (activeWeatherKind === 'sandstorm') {
      _tmpTop.lerp(_colSandHor, 0.74 * rainIntensity);
      _tmpHor.lerp(_colSandFog, 0.88 * rainIntensity);
    } else if (activeWeatherKind === 'fog') {
      _tmpTop.lerp(_colDenseFog, 0.68 * rainIntensity);
      _tmpHor.lerp(_colDenseFog, 0.82 * rainIntensity);
    } else if (activeWeatherKind === 'ashfall') {
      _tmpTop.lerp(_colAshFog, 0.58 * rainIntensity);
      _tmpHor.lerp(_colAshFog, 0.76 * rainIntensity);
    } else if (activeWeatherKind === 'aurora') {
      _tmpTop.lerp(_colAuroraTop, 0.42);
      _tmpHor.lerp(_colAuroraHor, 0.34);
    }
    if (curBiome === BIOMES.NIGHTMARE_WOODS) {
      _colBiomeFogScaled.copy(_colNightmareFog).multiplyScalar(0.55 + 0.45 * dayWeight);
      const nmSkyMix = 0.52 + 0.28 * (1.0 - dayWeight);
      _tmpTop.lerp(_colBiomeFogScaled, nmSkyMix);
      _tmpHor.lerp(_colBiomeFogScaled, Math.min(0.88, nmSkyMix + 0.08));
    } else if (curBiome === BIOMES.PALE_GARDEN) {
      _colBiomeFogScaled.copy(_colPaleFog).multiplyScalar(0.26 + 0.74 * dayWeight);
      _tmpTop.lerp(_colBiomeFogScaled, 0.58);
      _tmpHor.lerp(_colBiomeFogScaled, 0.68);
    } else if (curBiome === BIOMES.DARK_FOREST) {
      _colBiomeFogScaled.copy(_colDarkForestFog).multiplyScalar(0.35 + 0.65 * dayWeight);
      _tmpTop.lerp(_colBiomeFogScaled, 0.38);
      _tmpHor.lerp(_colBiomeFogScaled, 0.45);
    }
    if (envUniforms.uSulfurWater) envUniforms.uSulfurWater.value = (typeof BIOMES.SULFUR_SPRINGS !== 'undefined' && curBiome === BIOMES.SULFUR_SPRINGS) ? 1.0 : 0.0;
    if ((envUniforms.uCartoonMode?.value || 0) > 0.5 && dayWeight > 0.05 && rainIntensity < 0.35) {
      _tmpTop.lerp(_colCartoonTop, 0.94 * dayWeight * (1 - rainIntensity));
      _tmpHor.lerp(_colCartoonHor, 0.92 * dayWeight * (1 - rainIntensity));
    }
    if (lightningFlash > 0) { _tmpTop.lerp(colWhite, lightningFlash * 0.65); _tmpHor.lerp(colWhite, lightningFlash * 0.55); }
    envUniforms.uSkyTop.value.copy(_tmpTop); envUniforms.uSkyHorizon.value.copy(_tmpHor);

    // Authentic Minecraft & BSL Deep-Sea Depth Fog: Shallow luminous sapphire -> Mid dark ocean -> Ultra-Deep Abyssal Blue-Black (xanh đen đậm)!
    const nightFogMul = 1.0 - dayWeight;
    const trueEyeY = (player.y - (depthOffset || 0)) + EYE_HEIGHT;
    const diveDepth = player.eyesInWater ? Math.max(0, (WATER_LEVEL + 0.86) - trueEyeY) : 0;
    envUniforms.uWaterDepth.value = diveDepth;
    const abyssT = Math.min(1.0, Math.log1p(diveDepth * 0.045) / Math.log1p(700 * 0.045));
    const _inUndergroundGrandRuins = (currentDimension === 'overworld' && curBiome === BIOMES.GRAND_RUINS && (player.y - (depthOffset || 0)) < 12);
    const _isUndergroundCavern = (!player.eyesInWater && (_inUndergroundGrandRuins || player.y < -8 || depthOffset > 0));
    if (player.eyesInWater) {
      if (typeof farLodSystem !== 'undefined') farLodSystem.hide();
      const uwFogC = envUniforms.uFogColor.value;
      uwFogC.copy(_colUwNight).lerp(_colUwShallow, dayWeight);
      if (abyssT < 0.45) uwFogC.lerp(_colUwMid, abyssT / 0.45);
      else uwFogC.copy(_colUwMid).lerp(_colUwAbyss, (abyssT - 0.45) / 0.55);
      // Lock skyDome seamlessly to abyssal underwater color so bright surface sky never leaks into deep ocean!
      envUniforms.uSkyTop.value.copy(uwFogC).multiplyScalar(1.18 - abyssT * 0.45);
      envUniforms.uSkyHorizon.value.copy(uwFogC);
      envUniforms.uFogStart.value = 1.8 - abyssT * 1.1;
      envUniforms.uFogEnd.value = 30.0 - abyssT * 15.0;
      if (typeof skyDome !== 'undefined') skyDome.visible = true;
    } else if (_isUndergroundCavern) {
      if (typeof farLodSystem !== 'undefined') farLodSystem.hide();
      if (_inUndergroundGrandRuins) {
        // Dense mysterious ancient subterranean slate-mist fog inside 1000m End Portal Ruins: zero bright sky/white void ever peeks through!
        envUniforms.uFogColor.value.setHex(0x11171c);
        envUniforms.uFogStart.value = 9.0;
        envUniforms.uFogEnd.value = 34.0;
      } else {
        const ugBioFog = getUndergroundBiomeAt(Math.floor(player.x), Math.floor(player.y - depthOffset), Math.floor(player.z));
        envUniforms.uFogColor.value.setHex(depthOffset >= 750 ? 0x260b0b : (ugBioFog ? ugBioFog.fogHex : 0x090d17));
        envUniforms.uFogStart.value = 10.0;
        envUniforms.uFogEnd.value = 32.0;
      }
      // Seal underground horizon completely: hide skyDome & clouds so unloaded distant tunnels fade into dark cavern fog (never white sky!)
      envUniforms.uSkyTop.value.copy(envUniforms.uFogColor.value);
      envUniforms.uSkyHorizon.value.copy(envUniforms.uFogColor.value);
      if (typeof skyDome !== 'undefined') skyDome.visible = false;
      if (typeof cloudMesh !== 'undefined') cloudMesh.visible = false;
      if (typeof shootingStarLines !== 'undefined') shootingStarLines.visible = false;
    } else {
      if (typeof skyDome !== 'undefined') skyDome.visible = true;
      envUniforms.uFogColor.value.copy(_tmpHor).lerp(_isNcr2 ? _colNcr2Fog : _colAerialMist, (_isNcr2 ? 0.42 : 0.36) * dayWeight * (1 - rainIntensity * 0.5));
      if (activeWeatherKind === 'sandstorm') envUniforms.uFogColor.value.lerp(_colSandFog, 0.85 * rainIntensity);
      else if (activeWeatherKind === 'blizzard') envUniforms.uFogColor.value.lerp(_colBlizzHor, 0.72 * rainIntensity);
      else if (activeWeatherKind === 'fog') envUniforms.uFogColor.value.lerp(_colDenseFog, 0.74 * rainIntensity);
      else if (activeWeatherKind === 'ashfall') envUniforms.uFogColor.value.lerp(_colAshFog, 0.74 * rainIntensity);
      const isEcMode = (shaderPreset === 'eclipse');
      const fogEnd = Math.max(14.5, loadedEdge * (1.0 - rainIntensity * 0.22));
      const fogStartRatio = (isEcMode ? 0.44 : (_isNcr2 ? 0.50 : 0.48)) - rainIntensity * 0.14;
      envUniforms.uFogStart.value = Math.max(8.0, Math.min(fogEnd * 0.70, fogEnd * fogStartRatio));
      envUniforms.uFogEnd.value   = fogEnd;
      if (curBiome === BIOMES.NIGHTMARE_WOODS) {
        _colBiomeFogScaled.copy(_colNightmareFog).multiplyScalar(0.55 + 0.45 * dayWeight);
        envUniforms.uFogColor.value.lerp(_colBiomeFogScaled, 0.74 + 0.20 * (1.0 - dayWeight));
        envUniforms.uFogEnd.value   = Math.min(envUniforms.uFogEnd.value, 44.0);
        envUniforms.uFogStart.value = Math.min(envUniforms.uFogStart.value, envUniforms.uFogEnd.value * 0.26);
      } else if (curBiome === BIOMES.PALE_GARDEN) {
        _colBiomeFogScaled.copy(_colPaleFog).multiplyScalar(0.26 + 0.74 * dayWeight);
        envUniforms.uFogColor.value.lerp(_colBiomeFogScaled, 0.78);
        envUniforms.uFogEnd.value   = Math.min(envUniforms.uFogEnd.value, 34.0);
        envUniforms.uFogStart.value = Math.min(envUniforms.uFogStart.value, envUniforms.uFogEnd.value * 0.24);
      } else if (curBiome === BIOMES.DARK_FOREST) {
        _colBiomeFogScaled.copy(_colDarkForestFog).multiplyScalar(0.35 + 0.65 * dayWeight);
        envUniforms.uFogColor.value.lerp(_colBiomeFogScaled, 0.55);
        envUniforms.uFogEnd.value   = Math.min(envUniforms.uFogEnd.value, 42.0);
        envUniforms.uFogStart.value = Math.min(envUniforms.uFogStart.value, envUniforms.uFogEnd.value * 0.30);
      }
      if (activeWeatherKind === 'blizzard' || activeWeatherKind === 'sandstorm' || activeWeatherKind === 'fog' || activeWeatherKind === 'ashfall') {
        const tgtE = Math.min(loadedEdge, activeWeatherKind === 'fog' ? 30.0 : (activeWeatherKind === 'ashfall' ? 38.0 : 32.0));
        const tgtS = Math.min(tgtE * 0.42, activeWeatherKind === 'fog' ? 7.0 : (activeWeatherKind === 'ashfall' ? 11.0 : 8.5));
        envUniforms.uFogStart.value += (tgtS - envUniforms.uFogStart.value) * Math.min(1, rainIntensity * 0.92);
        envUniforms.uFogEnd.value   += (tgtE - envUniforms.uFogEnd.value) * Math.min(1, rainIntensity * 0.92);
      }
    }
    if (sodiumOpts.fog === false) {
      envUniforms.uFogStart.value = player.eyesInWater ? 48.0 : 2500.0;
      envUniforms.uFogEnd.value = player.eyesInWater ? 140.0 : 5000.0;
    }
    if (player._nightVisionT > 0) player._nightVisionT = Math.max(0, player._nightVisionT - dt);
    if (player._darknessT > 0) player._darknessT = Math.max(0, player._darknessT - dt);
    if (player._wardenWarnDecayT > 0) {
      player._wardenWarnDecayT -= dt;
      if (player._wardenWarnDecayT <= 0 && (player._wardenWarningLevel || 0) > 0) {
        player._wardenWarningLevel--;
        player._wardenWarnDecayT = player._wardenWarningLevel > 0 ? 600.0 : 0;
      }
    }
    const nvOn = (player._nightVisionT || 0) > 0;
    const darkT = player._darknessT || 0;
    if (nvOn) {
      envUniforms.uFogEnd.value = Math.max(envUniforms.uFogEnd.value, Math.min(loadedEdge, 72.0));
    }
    if (darkT > 0) {
      const dPulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(envUniforms.uTime.value * 2.4));
      const dFade = Math.min(1.0, darkT * 0.65);
      const dStrength = dPulse * dFade * (nvOn ? 0.55 : 1.0);
      envUniforms.uFogColor.value.multiplyScalar(1.0 - 0.72 * dStrength);
      envUniforms.uFogStart.value = Math.min(envUniforms.uFogStart.value, nvOn ? 7.0 : 3.5);
      envUniforms.uFogEnd.value = Math.min(envUniforms.uFogEnd.value, nvOn ? 28.0 : 16.0);
      if (_elDarknessOv) _elDarknessOv.style.opacity = String(+(0.92 * dStrength).toFixed(3));
    } else if (_elDarknessOv && _elDarknessOv.style.opacity !== '0') {
      _elDarknessOv.style.opacity = '0';
    }
    scene.fog.color.copy(envUniforms.uFogColor.value);
    scene.fog.near = envUniforms.uFogStart.value;
    scene.fog.far = envUniforms.uFogEnd.value;
    renderer.setClearColor(envUniforms.uFogColor.value, 1);

    // Warm Cream-Gold Sunlight + Smooth Midday Zenith Dampening (fresh, warm, zero midday/white-block glare!)
    const noonSoft = 1.0 - 0.24 * Math.max(0, (sunY - 0.50) / 0.50);
    if (shaderPreset === 'chill_sunset') {
      envUniforms.uSunColor.value.setHex(0xffe4b4).lerp(_colChillSun, 0.86);
    } else if (shaderPreset === 'verdant_fresh') {
      envUniforms.uSunColor.value.copy(_colFreshSun);
    } else if (shaderPreset === 'dlss_ultra') {
      envUniforms.uSunColor.value.copy(_colDlssSun);
      if (sunsetWeight > 0.18) envUniforms.uSunColor.value.lerp(_colSunsetSun, Math.min(0.85, sunsetWeight * 0.95));
    } else if (shaderPreset === 'eclipse') {
      const noonAmt = Math.max(0, Math.min(1, (sunY - 0.38) / 0.48));
      envUniforms.uSunColor.value.copy(_colEclipseSun).lerp(_colEclipseNoonSun, noonAmt * 0.65).lerp(_colSunsetSun, Math.min(0.72, sunsetWeight * 0.85));
    } else if (shaderPreset === 'ncr2') {
      envUniforms.uSunColor.value.copy(_colNcr2Sun).lerp(_colNcr2SunsetSun, Math.min(0.75, sunsetWeight * 0.85));
    } else if (sunsetWeight > 0.16) {
      envUniforms.uSunColor.value.setHex(0xffdfa8).lerp(_colSunsetSun, Math.min(1, sunsetWeight * 1.15));
    } else {
      envUniforms.uSunColor.value.setHex(0xfff5e0);
    }

    const surfaceFactor = player.eyesInWater
      ? Math.max(0.06, Math.exp(-diveDepth * 0.018))
      : (depthOffset > 0 ? 0.10 : Math.max(0.12, Math.min(1, (player.y + 8) / 10)));
    if (envUniforms.uSurfaceLight) envUniforms.uSurfaceLight.value = surfaceFactor;
    const albedoDamp = (curBiome === BIOMES.DESERT || curBiome === BIOMES.MESA) ? 0.88 : ((curBiome === BIOMES.SNOW || curBiome === BIOMES.SNOWY_PLAINS || curBiome === BIOMES.ALPINE_PEAKS) ? 0.90 : 1.0);
    const isNightShadow = (sunY < -0.04);
    const lDir = isNightShadow ? _sunProj.copy(envUniforms.uSunDir.value).negate() : _sunProj.copy(envUniforms.uSunDir.value);
    const shTexel = (shadowRad * 2) / (sunLight.shadow.mapSize.width || 1024);
    let snapX = Math.round(player.x / shTexel) * shTexel, snapY = Math.round(player.y / shTexel) * shTexel, snapZ = Math.round(player.z / shTexel) * shTexel;
    const _wCore = typeof window._getNucraftWasmCore === 'function' ? window._getNucraftWasmCore() : null;
    if (_wCore && _wCore.exports && _wCore.exports.step_env_wind_state && _wCore.frameOut) {
      _wCore.exports.step_env_wind_state(envUniforms.uTime.value, rainIntensity || 0, player.x, player.y, player.z, lDir.x, Math.max(0.22, lDir.y), lDir.z, shadowRad, sunLight.shadow.mapSize.width || 2048);
      envUniforms.uWindVec.value.set(_wCore.frameOut[0], _wCore.frameOut[1]);
      envUniforms.uWindGust.value = _wCore.frameOut[2];
      snapX = _wCore.frameOut[3]; snapY = _wCore.frameOut[4]; snapZ = _wCore.frameOut[5];
      _wCore.state.frameCalls++;
    } else {
      const wt = envUniforms.uTime.value, wAmp = 0.065 * (1 + (rainIntensity || 0) * 1.45);
      envUniforms.uWindVec.value.set(wAmp * Math.sin(wt * 1.35), wAmp * Math.cos(wt * 1.12));
      envUniforms.uWindGust.value = 0.5 + 0.5 * Math.sin(wt * 0.65);
    }
    sunLight.target.position.set(snapX, snapY, snapZ);
    sunLight.position.set(snapX + lDir.x * 46, snapY + Math.max(10, lDir.y * 46), snapZ + lDir.z * 46);
    const _isCartoon = (envUniforms.uCartoonMode?.value || 0) > 0.5;
    if (player.eyesInWater) {
      sunLight.color.copy(_colUwSunShallow).lerp(_colUwSunAbyss, abyssT);
      sunLight.intensity = (0.14 + dayWeight * 1.00) * surfaceFactor;
    } else if (isNightShadow) {
      sunLight.color.setHex(_isNcr2 ? 0x7cb0f8 : 0x6da0f5);
      sunLight.intensity = ((_isNcr2 ? 0.42 : 0.34) + lightningFlash * 1.1) * surfaceFactor;
    } else if (_isCartoon) {
      sunLight.color.setHex(0xfffbe8);
      sunLight.intensity = ((0.34 + dayWeight * 0.94) * (1 - rainIntensity * 0.35) + lightningFlash * 0.85) * surfaceFactor;
    } else {
      const freshMul = (shaderPreset === 'eclipse') ? 1.02 : (shaderPreset === 'ncr2' ? 0.94 : (shaderPreset === 'moonlit' ? 0.86 : 0.98));
      const ncr2NoonSoft = _isNcr2 ? (1.0 - 0.30 * Math.max(0, (sunY - 0.42) / 0.58)) : noonSoft;
      sunLight.color.copy(envUniforms.uSunColor.value);
      sunLight.intensity = ((0.22 + dayWeight * 1.00) * ncr2NoonSoft * albedoDamp * freshMul * (1 - rainIntensity * 0.34) + lightningFlash * 0.95) * surfaceFactor;
    }
    envUniforms.uMoonBoost.value = isNightShadow ? 1.0 : 0.0;

    if (player.eyesInWater) {
      hemiLight.color.copy(envUniforms.uFogColor.value).lerp(_colUwSunShallow, 0.30 * (1 - abyssT) * dayWeight);
      hemiLight.groundColor.copy(_colUwAbyss);
      hemiLight.intensity = Math.max(0.06, (0.16 + dayWeight * 0.44) * Math.exp(-diveDepth * 0.014));
    } else if (_isCartoon) {
      hemiLight.color.copy(_tmpTop).lerp(_colCartoonHor, 0.48);
      hemiLight.groundColor.setHex(dayWeight > 0.2 ? 0x567b86 : 0x162442);
      hemiLight.intensity = (0.40 + dayWeight * 0.36) * surfaceFactor;
    } else {
      // Cool sky-blue ambient above + warm earthy ground bounce below (clear light/shade separation matching refs)
      hemiLight.color.copy(_tmpTop).lerp(shaderPreset === 'chill_sunset' ? _colChillHemiSky : _colSkyFillSoft, (_isNcr2 ? 0.54 : 0.45) * dayWeight);
      hemiLight.groundColor.setHex(shaderPreset === 'chill_sunset' ? 0x765844 : (dayWeight > 0.2 ? (_isNcr2 ? 0x5c6a58 : 0x6b5d4a) : (_isNcr2 ? 0x243b5e : 0x1b2b48)));
      const hemiBoost = (shaderPreset === 'eclipse') ? 0.96 : (_isNcr2 ? 1.04 : 0.94);
      hemiLight.intensity = (0.36 + dayWeight * 0.34) * hemiBoost * surfaceFactor;
    }
    if ((player._nightVisionT || 0) > 0) {
      hemiLight.intensity = Math.max(hemiLight.intensity, 1.38);
      sunLight.intensity = Math.max(sunLight.intensity, 0.55);
    }

    // Project Real 3D Sun / Moon coordinates for Volumetric Crepuscular God-Rays & Real Underwater Sun Shafts
    envUniforms.uUnderwater.value = player.eyesInWater ? 1.0 : 0.0;
    const activeLightVec = isNightShadow ? _sunProj.copy(envUniforms.uSunDir.value).negate() : _sunProj.copy(envUniforms.uSunDir.value);
    const camFwdRay = _reflHiddenMobs._tmpCamFwd || (_reflHiddenMobs._tmpCamFwd = new THREE.Vector3());
    camera.getWorldDirection(camFwdRay);
    const sunAlign3D = camFwdRay.dot(activeLightVec);
    const _allowRays = player.eyesInWater ? (diveDepth < 65 && dayWeight > 0.15) : (player.y > -4);
    const _rtRaysOn = !_isCartoon && !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
    if (!_isCartoon && (shaderQuality !== 'low' || _rtRaysOn) && _allowRays && sunAlign3D > 0.02 && (activeLightVec.y > -0.08 || isNightShadow)) {
      activeLightVec.multiplyScalar(120).add(camera.position).project(camera);
      if (activeLightVec.z < 1.0) {
        const u = activeLightVec.x * 0.5 + 0.5, v = activeLightVec.y * 0.5 + 0.5;
        const lookAlign = player.eyesInWater
          ? Math.pow(Math.max(0, sunAlign3D), 0.65)
          : Math.max(0, 1.0 - Math.hypot(activeLightVec.x, activeLightVec.y) * 0.48);
        const weatherDim = 1 - rainIntensity * 0.72;
        const noonRayDamp = player.eyesInWater
          ? (1.0 - 0.25 * Math.max(0, (sunY - 0.65) / 0.35))
          : (1.0 - 0.55 * Math.max(0, (sunY - 0.55) / 0.45));
        const baseStr = isNightShadow ? 0.30 : ((0.24 + sunsetWeight * 0.28) * dayWeight * noonRayDamp);
        const uwAtten = player.eyesInWater ? Math.max(0, 1.0 - diveDepth / 58) * (shaderPreset === 'eclipse' ? 1.28 : 0.82) : 1.0;
        const chillRayBoost = (!player.eyesInWater && shaderPreset === 'chill_sunset') ? 1.22 : ((!player.eyesInWater && shaderPreset === 'eclipse') ? 1.32 : 1.0);
        const rtRayMul = _rtRaysOn ? 1.20 : 1.0;
        const shaftAmt = Math.min(player.eyesInWater ? 0.72 : (shaderPreset === 'eclipse' ? 0.34 : 0.24), lookAlign * baseStr * chillRayBoost * rtRayMul * weatherDim * uwAtten);
        envUniforms.uSunScreenPos.value.set(u, v);
        envUniforms.uSunVis.value = shaftAmt;
        envUniforms.uLightScreenPos.value.set(u, v);
        envUniforms.uShaftStrength.value = shaftAmt;
        envUniforms.uShaftColor.value.setHex(player.eyesInWater ? (shaderPreset === 'eclipse' ? (diveDepth < 6 ? 0x8af8f2 : 0x56f0e4) : 0x7ee8fa) : (isNightShadow ? 0x70b4ff : (shaderPreset === 'chill_sunset' ? 0xffb85c : ((shaderPreset === 'eclipse' && sunsetWeight > 0.14) ? 0xffbe74 : (sunsetWeight > 0.26 ? 0xffac54 : 0xfff0d4)))));
      } else {
        envUniforms.uSunVis.value = 0; envUniforms.uShaftStrength.value = 0;
      }
    } else {
      envUniforms.uSunVis.value = 0; envUniforms.uShaftStrength.value = 0;
    }

    const _showClouds = (sodiumOpts.clouds !== false);
    envUniforms.uVolumetricClouds.value = (!_isCartoon && _showClouds && volumetricClouds) ? 1.0 : 0.0;
    const baseCov = shaderPreset === 'bliss' ? 0.54 : (shaderPreset === 'eclipse' ? 0.58 : (shaderPreset === 'chill_sunset' ? 0.58 : (shaderPreset === 'dlss_ultra' ? 0.52 : (shaderPreset === 'verdant_fresh' ? 0.50 : (shaderPreset === 'moonlit' ? 0.36 : 0.46)))));
    envUniforms.uCloudCover.value = activeWeatherKind === 'meteor' ? 0.16 : Math.min(0.85, baseCov + rainIntensity * 0.34);

    cloudDrift = (cloudDrift + dt * (1.15 + rainIntensity * 1.4)) % CLOUD_PERIOD_W;
    const baseCX = Math.round((player.x - cloudDrift) / CLOUD_PERIOD_W) * CLOUD_PERIOD_W + cloudDrift;
    const baseCZ = Math.round(player.z / CLOUD_PERIOD_W) * CLOUD_PERIOD_W;
    cloudMesh.position.set(baseCX, CLOUD_Y, baseCZ);
    if (_isCartoon) {
      cloudMat.color.setHex(dayWeight > 0.18 ? 0xffffff : 0x7694bf);
      cloudMesh.visible = (_showClouds && player.y > -6);
    } else {
      cloudMat.color.copy(_tmpHor).lerp(colWhite, 0.72 * dayWeight + 0.10);
      if (sunsetWeight > 0.35 || shaderPreset === 'chill_sunset') cloudMat.color.lerp(envUniforms.uSunColor.value, 0.38);
      cloudMesh.visible = (_showClouds && !volumetricClouds && player.y > -6);
    }

    updateShootingStars(dt, sunY, true);
    const isNight = (sunY < 0.05), isAutumn = (curBiome === BIOMES.AUTUMN || curBiome === BIOMES.AUTUMN_GOLDEN || curBiome === BIOMES.AUTUMN_DEEP);
    const isGoldenChill = !player.eyesInWater && (shaderPreset === 'chill_sunset' || inChillWheatAtmo);
    const showMotes = (shaderQuality !== 'low' && (player.eyesInWater || (player.y > -2 && rainIntensity < (isGoldenChill ? 0.85 : 0.5))));
    updateAirMotesBatch(dt, showMotes, player.eyesInWater ? 'underwater' : (isGoldenChill ? 'golden' : (isNight ? 'night' : (isAutumn ? 'autumn' : 'day'))));
    applyLavaAtmo();
  }

  const _isWaterLike = (bid) => (bid === B.WATER || bid === B.SEAGRASS || bid === B.CORAL_PINK || bid === B.CORAL_BLUE || bid === B.CORAL_GOLD);
  function measureWaterColumnAt(wx, wy, wz) {
    const bx = Math.floor(wx), bz = Math.floor(wz);
    let by = Math.floor(wy + 0.22);
    if (!_isWaterLike(getBlockWorld(bx, by, bz))) {
      by = Math.floor(wy + 0.04);
      if (!_isWaterLike(getBlockWorld(bx, by, bz))) {
        return { inWater: false, depth: 0, topY: -9999, botY: -9999, surfaceY: -9999 };
      }
    }
    let topY = by, botY = by;
    for (let k = 0; k < 48 && _isWaterLike(getBlockWorld(bx, topY + 1, bz)); k++) topY++;
    for (let k = 0; k < 48 && _isWaterLike(getBlockWorld(bx, botY - 1, bz)); k++) botY--;
    return { inWater: true, depth: topY - botY + 1, topY, botY, surfaceY: topY + 0.88 };
  }
  function _tryStepPlayerStair(tx, tz) {
    if (!player.onGround || Math.abs(player.vy) > 0.25 || player.flying || player.sneaking) return -1;
    let foundStair = false, foundSlab = false;
    const onHalf = Math.abs((player.y - Math.floor(player.y)) - 0.5) < 0.10;
    const by0 = Math.floor(player.y), by1 = Math.floor(player.y + 0.55);
    const x0 = Math.floor(tx - PLAYER_RADIUS), x1 = Math.floor(tx + PLAYER_RADIUS);
    const z0 = Math.floor(tz - PLAYER_RADIUS), z1 = Math.floor(tz + PLAYER_RADIUS);
    for (let bx = x0; bx <= x1 && !foundStair; bx++) {
      for (let bz = z0; bz <= z1 && !foundStair; bz++) {
        const b0 = getBlockWorld(bx, by0, bz), b1 = getBlockWorld(bx, by1, bz);
        if (IS_STAIRS[b0] === 1 || IS_STAIRS[b1] === 1) foundStair = true;
        else if (IS_SLAB[b0] === 1 || IS_SLAB[b1] === 1 || (onHalf && IS_SOLID[b0] === 1)) foundSlab = true;
      }
    }
    if (!foundStair && !foundSlab) return -1;
    const maxTry = foundStair ? 2 : 1;
    for (let di = 0; di < maxTry; di++) {
      const candY = Math.round((player.y + (di === 0 ? 0.51 : 1.01)) * 2) / 2;
      if (candY > player.y + 0.04 && !playerCollides(tx, candY, tz)) return candY;
    }
    return -1;
  }
  function _applyPlayerStairStep(stepY) {
    player._stepCamOff = Math.max(-1.05, (player._stepCamOff || 0) + (player.y - stepY));
    player.y = stepY;
    player.onGround = true;
    player.vy = 0;
    player.fallStartY = Math.max(player.fallStartY, stepY);
  }


  let _lastShCx = 999999, _lastShCz = 999999, _lastShQual = '';
  const _shRight = new THREE.Vector3(), _shUp = new THREE.Vector3(), _shWorldUp = new THREE.Vector3(0, 1, 0);
  function updateSunShadowFrustum(updateLightMatrices = true) {
    if (!renderer.shadowMap.enabled) return;
    const px = player.x, pz = player.z;
    if (updateLightMatrices) {
      const py = player.y;
      const shTexel = (shadowRad * 2) / (sunLight.shadow.mapSize.width || 1024);
      const isNightShadow = (currentDimension === 'overworld' && envUniforms.uSunDir.value.y < -0.04);
      const lDir = isNightShadow ? _sunProj.copy(envUniforms.uSunDir.value).negate() : _sunProj.copy(envUniforms.uSunDir.value);
      const _wCore = typeof window._getNucraftWasmCore === 'function' ? window._getNucraftWasmCore() : null;
      let snapX, snapY, snapZ;
      if (_wCore && _wCore.exports && _wCore.exports.step_env_wind_state && _wCore.frameOut) {
        _wCore.exports.step_env_wind_state(envUniforms.uTime.value, rainIntensity || 0, px, py, pz, lDir.x, Math.max(0.22, lDir.y), lDir.z, shadowRad, sunLight.shadow.mapSize.width || 2048);
        snapX = _wCore.frameOut[3]; snapY = _wCore.frameOut[4]; snapZ = _wCore.frameOut[5];
      } else {
        _shRight.crossVectors(_shWorldUp, lDir);
        if (_shRight.lengthSq() < 1e-4) _shRight.set(1, 0, 0); else _shRight.normalize();
        _shUp.crossVectors(lDir, _shRight).normalize();
        const uCoord = Math.round((px * _shRight.x + py * _shRight.y + pz * _shRight.z) / shTexel) * shTexel;
        const vCoord = Math.round((px * _shUp.x + py * _shUp.y + pz * _shUp.z) / shTexel) * shTexel;
        const dCoord = px * lDir.x + py * lDir.y + pz * lDir.z;
        snapX = _shRight.x * uCoord + _shUp.x * vCoord + lDir.x * dCoord;
        snapY = _shRight.y * uCoord + _shUp.y * vCoord + lDir.y * dCoord;
        snapZ = _shRight.z * uCoord + _shUp.z * vCoord + lDir.z * dCoord;
      }
      const reach = (currentDimension === 'nether') ? 34 : 46;
      sunLight.target.position.set(snapX, snapY, snapZ);
      sunLight.position.set(snapX + lDir.x * reach, snapY + Math.max(10, lDir.y * reach), snapZ + lDir.z * reach);
      sunLight.target.updateMatrixWorld();
      sunLight.updateMatrixWorld();
    }
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    if ((pcx !== _lastShCx || pcz !== _lastShCz || shaderQuality !== _lastShQual) && chunks.size > 0) {
      _lastShCx = pcx; _lastShCz = pcz; _lastShQual = shaderQuality;
      const _rtShOn = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
      const _isCartoonSh = !!window._cartoonAddonActive;
      const preset = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality]) || { shadowChunkRange: 26 };
      const effShRange = preset.shadowChunkRange > 0 ? preset.shadowChunkRange : (_rtShOn ? 32 : 0);
      let maxChDist = effShRange > 0 ? Math.min(2, Math.max(1, Math.ceil(effShRange / CHUNK_W))) : -1;
      if (_isCartoonSh && maxChDist > 1) maxChDist = 1;
      const allowLeafSh = !_isCartoonSh && (shaderQuality !== 'low' || _rtShOn);
      const leafShDist = Math.min(maxChDist, 1);
      for (const ch of chunks.values()) {
        const dCh = Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz));
        const near = maxChDist >= 0 && dCh <= maxChDist;
        if (ch.mesh && ch.mesh.castShadow !== near) ch.mesh.castShadow = near;
        if (ch.leavesMesh) {
          const leafSh = allowLeafSh && leafShDist >= 0 && dCh <= leafShDist;
          if (ch.leavesMesh.castShadow !== leafSh) ch.leavesMesh.castShadow = leafSh;
          if (ch.leavesMesh.receiveShadow) ch.leavesMesh.receiveShadow = false;
          if (allowLeafSh && ch.leavesMesh.customDepthMaterial !== leavesDepthMat) ch.leavesMesh.customDepthMaterial = leavesDepthMat;
        }
      }
    }
  }

  let _reflDoneOnce = false, _lastReflX = 9e9, _lastReflY = 9e9, _lastReflZ = 9e9, _lastReflYaw = 9e9, _lastReflPitch = 9e9;
  const _reflHiddenChunks = [], _reflHiddenMobs = [];
  const _REFL_CLIP_ARR = [reflClipPlane], _EMPTY_CLIP_ARR = [];
  function renderWaterReflectionPass(inLobby = false, rawDt = 0.016) {
    const _rtReflOn = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
    if ((envUniforms.uCartoonMode?.value || 0) > 0.5 || (!sodiumOpts.waterRefl && !_rtReflOn) || _autoPerfLow || (shaderQuality === 'low' && !_rtReflOn) || (currentDimension !== 'overworld' && currentDimension !== 'sift') || depthOffset > 0 || player.eyesInWater || player.eyesInLava || player.y < -4 || camera.rotation.x > 0.35) {
      envUniforms.uUsePlanarRefl.value = 0.0;
      _reflDoneOnce = false;
      return;
    }
    _reflAcc += (rawDt || 0.016);
    const _rPreset = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality]) || { reflIntervalMs: 16 };
    const fgModeR = (typeof sodiumOpts !== 'undefined' && sodiumOpts.frameGen > 1) ? (sodiumOpts.frameGen | 0) : 1;
    const fastTurn = !_reflDoneOnce ||
      Math.abs(camera.rotation.y - _lastReflYaw) > 0.008 ||
      Math.abs(camera.rotation.x - _lastReflPitch) > 0.008;
    const camMoved = Math.abs(camera.position.x - _lastReflX) > 0.004 ||
      Math.abs(camera.position.y - _lastReflY) > 0.004 ||
      Math.abs(camera.position.z - _lastReflZ) > 0.004;
    const camStatic = _reflDoneOnce && !fastTurn && !camMoved;
    // Adaptive 60Hz PC / 30Hz Mobile planar reflection cadence (eliminates 240Hz double scene-render bottleneck!)
    const mobileFloor = (_initMobile || _autoPerfLow) ? 0.033 : 0.014;
    const cfgMinMs = Math.max(mobileFloor, (_rPreset.reflIntervalMs || 16) / 1000) * (fgModeR > 1 ? 1.25 : 1.0);
    const targetReflDt = camStatic ? 0.14 : cfgMinMs;
    if (_reflDoneOnce && _reflAcc < targetReflDt) return;
    _reflAcc = 0;
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    let hasWater = false;
    for (let dz = -3; dz <= 3 && !hasWater; dz++) for (let dx = -3; dx <= 3; dx++) {
      const c = chunks.get(chunkKey(pcx + dx, pcz + dz));
      if (c && c.waterMesh && c.waterMesh.visible) {
        const bs = c.waterMesh.geometry && c.waterMesh.geometry.boundingSphere;
        if (inLobby || !_camFrustumReady || !bs || _camFrustum.intersectsSphere(bs)) { hasWater = true; break; }
      }
    }
    if (!hasWater) { envUniforms.uUsePlanarRefl.value = 0.0; _reflDoneOnce = false; return; }
    window._reflUpdatesCount = (window._reflUpdatesCount || 0) + 1;
    _reflDoneOnce = true;
    _lastReflX = camera.position.x; _lastReflY = camera.position.y; _lastReflZ = camera.position.z;
    _lastReflYaw = camera.rotation.y; _lastReflPitch = camera.rotation.x;
    envUniforms.uUsePlanarRefl.value = 1.0;

    const waterY = WATER_LEVEL + 0.86;
    const reflFar = Math.max(720, camera.far);
    if (reflCam.aspect !== camera.aspect || reflCam.fov !== camera.fov || reflCam.far !== reflFar) {
      reflCam.aspect = camera.aspect; reflCam.fov = camera.fov; reflCam.far = reflFar; reflCam.updateProjectionMatrix();
    }
    reflCam.position.set(camera.position.x, 2 * waterY - camera.position.y, camera.position.z);
    reflCam.rotation.order = 'YXZ';
    reflCam.rotation.y = camera.rotation.y;
    reflCam.rotation.x = -camera.rotation.x;
    reflCam.rotation.z = 0;
    reflCam.updateMatrixWorld(true);
    if (envUniforms.uReflMatrix) {
      envUniforms.uReflMatrix.value.multiplyMatrices(reflCam.projectionMatrix, reflCam.matrixWorldInverse);
    }

    const wasHeldVis = heldPivot.visible, wasWeatherVis = weatherLines.visible, wasMoteVis = _motePoints.visible;
    const wasPortalMoteVis = (typeof _portalMotePoints !== 'undefined') ? _portalMotePoints.visible : false;
    const wasEclipseGrassVis = (typeof eclipseGrassMesh !== 'undefined') ? eclipseGrassMesh.visible : false;
    const wasEclipseGrassFarVis = (typeof eclipseGrassFarMesh !== 'undefined') ? eclipseGrassFarMesh.visible : false;
    const wasHighlightVis = (typeof highlightMesh !== 'undefined') ? highlightMesh.visible : false;
    const wasCrackVis = (typeof crackMesh !== 'undefined') ? crackMesh.visible : false;
    const wasPartVis = (typeof _partInstMesh !== 'undefined') ? _partInstMesh.visible : false;
    const wasBlkPartVis = (typeof _blkPartInstMesh !== 'undefined') ? _blkPartInstMesh.visible : false;
    const wasSmokeVis = (typeof _smokeInstMesh !== 'undefined') ? _smokeInstMesh.visible : false;
    const prevShadowEnabled = renderer.shadowMap.enabled;
    heldPivot.visible = false; weatherLines.visible = false; _motePoints.visible = false;
    if (typeof _portalMotePoints !== 'undefined') _portalMotePoints.visible = false;
    if (typeof eclipseGrassMesh !== 'undefined') eclipseGrassMesh.visible = false;
    if (typeof eclipseGrassFarMesh !== 'undefined') eclipseGrassFarMesh.visible = false;
    if (typeof highlightMesh !== 'undefined') highlightMesh.visible = false;
    if (typeof crackMesh !== 'undefined') crackMesh.visible = false;
    if (typeof _partInstMesh !== 'undefined') _partInstMesh.visible = false;
    if (typeof _blkPartInstMesh !== 'undefined') _blkPartInstMesh.visible = false;
    if (typeof _smokeInstMesh !== 'undefined') _smokeInstMesh.visible = false;
    renderer.shadowMap.enabled = false;
    _reflHiddenChunks.length = 0;
    const reflMaxChunkDistSq = Math.max(25, (renderDistance + 2) * (renderDistance + 2));
    for (const ch of chunks.values()) {
      if (ch.waterMesh && ch.waterMesh.visible) { ch.waterMesh.visible = false; _reflHiddenChunks.push(ch.waterMesh); }
      if (ch.plantMesh && ch.plantMesh.visible) { ch.plantMesh.visible = false; _reflHiddenChunks.push(ch.plantMesh); }
      if (ch.lavaMesh && ch.lavaMesh.visible) { ch.lavaMesh.visible = false; _reflHiddenChunks.push(ch.lavaMesh); }
      if (ch.leavesCrossMesh && ch.leavesCrossMesh.visible) { ch.leavesCrossMesh.visible = false; _reflHiddenChunks.push(ch.leavesCrossMesh); }
      const dcx = ch.cx - pcx, dcz = ch.cz - pcz;
      if (dcx * dcx + dcz * dcz > reflMaxChunkDistSq) {
        if (ch.mesh && ch.mesh.visible) { ch.mesh.visible = false; _reflHiddenChunks.push(ch.mesh); }
        if (ch.leavesMesh && ch.leavesMesh.visible) { ch.leavesMesh.visible = false; _reflHiddenChunks.push(ch.leavesMesh); }
      }
    }
    _reflHiddenMobs.length = 0;
    const reflCutY = WATER_LEVEL + 0.855;
    for (let mi = 0; mi < mobs.length; mi++) {
      const m = mobs[mi];
      if (m && m.group && m.group.visible) {
        const dx = m.x - player.x, dz = m.z - player.z;
        const mTop = (m.y || 0) + (m.hitboxH || 1.8);
        if (dx * dx + dz * dz > 1764 || mTop < reflCutY) {
          m.group.visible = false;
          _reflHiddenMobs.push(m.group);
        }
      }
    }
    if (typeof droppedItems !== 'undefined') {
      for (let di = 0; di < droppedItems.length; di++) {
        const d = droppedItems[di];
        if (!d) continue;
        if (d.shadow && d.shadow.visible) {
          d.shadow.visible = false;
          _reflHiddenMobs.push(d.shadow);
        }
        if (d.mesh && d.mesh.visible && (d.y || 0) < WATER_LEVEL + 1.15) {
          d.mesh.visible = false;
          _reflHiddenMobs.push(d.mesh);
        }
      }
    }
    if (typeof pixelFxList !== 'undefined') {
      for (let fi = 0; fi < pixelFxList.length; fi++) {
        const fx = pixelFxList[fi];
        if (fx && fx.sp && fx.sp.visible) {
          fx.sp.visible = false;
          _reflHiddenMobs.push(fx.sp);
        }
      }
    }
    if (typeof projectiles !== 'undefined') {
      for (let pi = 0; pi < projectiles.length; pi++) {
        const pr = projectiles[pi];
        if (pr && pr.mesh && pr.mesh.visible && (pr.y || 0) < WATER_LEVEL + 0.85) {
          pr.mesh.visible = false;
          _reflHiddenMobs.push(pr.mesh);
        }
      }
    }
    if (envUniforms.uReflClipY) envUniforms.uReflClipY.value = reflCutY;
    renderer.clippingPlanes = _REFL_CLIP_ARR;
    renderer.setRenderTarget(reflRT);
    renderer.setClearColor(envUniforms.uFogColor.value, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, reflCam);
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = _EMPTY_CLIP_ARR;
    if (envUniforms.uReflClipY) envUniforms.uReflClipY.value = -9999.0;
    renderer.shadowMap.enabled = prevShadowEnabled;
    for (let i = 0; i < _reflHiddenChunks.length; i++) _reflHiddenChunks[i].visible = true;
    for (let i = 0; i < _reflHiddenMobs.length; i++) _reflHiddenMobs[i].visible = true;
    if (typeof eclipseGrassMesh !== 'undefined') eclipseGrassMesh.visible = wasEclipseGrassVis;
    if (typeof eclipseGrassFarMesh !== 'undefined') eclipseGrassFarMesh.visible = wasEclipseGrassFarVis;
    if (typeof highlightMesh !== 'undefined') highlightMesh.visible = wasHighlightVis;
    if (typeof crackMesh !== 'undefined') crackMesh.visible = wasCrackVis;
    if (typeof _partInstMesh !== 'undefined') _partInstMesh.visible = wasPartVis;
    if (typeof _blkPartInstMesh !== 'undefined') _blkPartInstMesh.visible = wasBlkPartVis;
    if (typeof _smokeInstMesh !== 'undefined') _smokeInstMesh.visible = wasSmokeVis;
    heldPivot.visible = wasHeldVis; weatherLines.visible = wasWeatherVis; _motePoints.visible = wasMoteVis;
    if (typeof _portalMotePoints !== 'undefined') _portalMotePoints.visible = wasPortalMoteVis;
  }

  let _fgPrimed = false, _fgSubIdx = 0, _fgNativeReady = 0, _fgMobDtAcc = 0, _fgNatYaw = 0, _fgNatPitch = 0, _fgNatX = 0, _fgNatY = 0, _fgNatZ = 0, _fgNatFov = 72;
  let _fgStatNative = 0, _fgStatSynth = 0;
  window._fgReset = () => { _fgPrimed = false; _fgSubIdx = 0; _fgNativeReady = 0; window._fgForceNative = true; };
  function _wrapAng(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  function _shouldRunAiSynthFrame(fgMode, worldSimActive) {
    if (fgMode <= 1 || !worldSimActive || _useDirectRender() || !_fgPrimed || window._fgForceNative || !fgRtA || !fgRtB || typeof fgBlendMat === 'undefined') return false;
    if (thirdPerson > 0 && typeof player !== 'undefined' && player && ((player.swingT || 0) > 0.001 || player.swordAtkActive || player.bowDrawing)) return false;
    const maxSynth = (fgMode >= 4) ? 3 : 1;
    if (_fgSubIdx >= maxSynth) return false;
    const dYaw = Math.abs(_wrapAng(camera.rotation.y - _fgNatYaw));
    const dPitch = Math.abs(camera.rotation.x - _fgNatPitch);
    if (dYaw + dPitch > 0.36) return false;
    if (Math.hypot(camera.position.x - _fgNatX, camera.position.y - _fgNatY, camera.position.z - _fgNatZ) > 1.8) return false;
    if (Math.abs((camera.fov || 72) - _fgNatFov) > 2.0) return false;
    return true;
  }
  function renderMainScene(rawDt = 0.016, isAiSynth = false) {
    if (!_useDirectRender()) {
      window._lastDirectRenderUsed = false;
      const isUltra = (shaderQuality === 'ultra' || shaderQuality === 'extreme');
      const fgMode = (typeof sodiumOpts !== 'undefined' && sodiumOpts.frameGen > 1) ? (sodiumOpts.frameGen | 0) : 1;
      if (!sceneRT || (isUltra && !bloomWide1) || (fgMode > 1 && !fgRtA)) resizeViewport();
      if (isAiSynth && fgMode > 1 && fgRtA && fgRtB && typeof fgBlendMat !== 'undefined') {
        const dYaw = _wrapAng(camera.rotation.y - _fgNatYaw);
        const dPitch = camera.rotation.x - _fgNatPitch;
        const cp = Math.cos(camera.rotation.x);
        const dFwd = -(camera.position.x - _fgNatX) * Math.sin(camera.rotation.y) * cp
          + (camera.position.y - _fgNatY) * Math.sin(camera.rotation.x)
          - (camera.position.z - _fgNatZ) * Math.cos(camera.rotation.y) * cp;
        const vFovRad = (camera.fov || 72) * Math.PI / 180;
        const hFovRad = 2 * Math.atan(Math.tan(vFovRad * 0.5) * (camera.aspect || 1.777));
        const uOff = Math.max(-0.12, Math.min(0.12, -dYaw / Math.max(0.35, hFovRad)));
        const vOff = Math.max(-0.12, Math.min(0.12, dPitch / Math.max(0.35, vFovRad)));
        const zoomOff = Math.max(-0.035, Math.min(0.035, -dFwd * 0.028));
        const curTex = (fgPing ? fgRtA : fgRtB).texture;
        const prvTex = (fgPing ? fgRtB : fgRtA).texture;
        postQuad.material = fgBlendMat;
        fgBlendMat.uniforms.tCur.value = curTex;
        fgBlendMat.uniforms.tPrev.value = prvTex;
        fgBlendMat.uniforms.uReprojUV.value.set(uOff, vOff);
        fgBlendMat.uniforms.uZoom.value = zoomOff;
        fgBlendMat.uniforms.uIsSynth.value = 1.0;
        fgBlendMat.uniforms.uFlowAmt.value = (_fgNativeReady >= 2) ? (fgMode >= 4 ? 0.65 : 0.55) : 0.0;
        fgBlendMat.uniforms.uAiSharp.value = fgMode >= 4 ? 0.42 : 0.36;
        renderer.setRenderTarget(null);
        renderer.render(postScene, postCam);
        _fgSubIdx++; _fgStatSynth++;
        window._fgStats = { mode: fgMode, nativeFrames: _fgStatNative, synthFrames: _fgStatSynth, internalScale: fgMode >= 4 ? 0.60 : 0.72, fps: window._nucraftFps || 60, cpuMs: +(window._nucraftCpuMs || 0).toFixed(2) };
        return;
      }
      window._fgForceNative = false;
      renderer.setRenderTarget(sceneRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      _postFxAcc += (rawDt || 0.016);
      const _fxP = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality]) || { fxIntervalMs: 36 };
      const fgFxScale = fgMode >= 4 ? 1.8 : (fgMode >= 2 ? 1.45 : 1.0);
      const fxInterval = ((_fxP.fxIntervalMs || 36) / 1000) * (_fpsSlow ? 1.35 : 1.0) * (_initMobile ? 1.45 : 1.0) * fgFxScale;
      const camFxTurned = (Math.abs(camera.rotation.y - (renderMainScene._ly || 0)) > 0.075 || Math.abs(camera.rotation.x - (renderMainScene._lp || 0)) > 0.075);
      const effFxInterval = camFxTurned ? Math.max(0.020, fxInterval * 0.55) : fxInterval;
      const runPostFx = _postFxDirty || (_postFxAcc >= effFxInterval);
      if (runPostFx) {
        _postFxAcc = 0;
        _postFxDirty = false;
        renderMainScene._ly = camera.rotation.y;
        renderMainScene._lp = camera.rotation.x;
      }

      // Pass 1: Occlusion-Aware Volumetric Crepuscular God-Rays — skip all 3 GPU passes when shaft is off, Low quality, or between intervals!
      const enablePostBloom = (shaderQuality !== 'low' || (typeof sodiumOpts !== 'undefined' && !!sodiumOpts.rayTracing));
      const runRays = enablePostBloom && (envUniforms.uShaftStrength.value > 0.005);
      envUniforms.uHasGodRays.value = runRays ? 1.0 : 0.0;
      if (runRays && runPostFx) {
        postQuad.material = godRayMat;
        godRayMat.uniforms.tScene.value = sceneRT.texture;
        renderer.setRenderTarget(godRayRT1);
        renderer.render(postScene, postCam);

        postQuad.material = blurMat;
        blurMat.uniforms.tDiffuse.value = godRayRT1.texture;
        blurMat.uniforms.uDir.value.set(1.25 / godRayRT1.width, 0);
        renderer.setRenderTarget(godRayRT2);
        renderer.render(postScene, postCam);

        blurMat.uniforms.tDiffuse.value = godRayRT2.texture;
        blurMat.uniforms.uDir.value.set(0, 1.25 / godRayRT2.height);
        renderer.setRenderTarget(godRayRT1);
        renderer.render(postScene, postCam);
      }

      // Pass 2: Tight Atmospheric Bloom (1/4 Res — updated cleanly every fxInterval to keep 240Hz lock!)
      if (enablePostBloom && runPostFx) {
        postQuad.material = brightMat;
        brightMat.uniforms.tDiffuse.value = sceneRT.texture;
        renderer.setRenderTarget(bloomRT1);
        renderer.render(postScene, postCam);

        postQuad.material = blurMat;
        blurMat.uniforms.tDiffuse.value = bloomRT1.texture;
        blurMat.uniforms.uDir.value.set(1.35 / bloomRT1.width, 0);
        renderer.setRenderTarget(bloomRT2);
        renderer.render(postScene, postCam);

        blurMat.uniforms.tDiffuse.value = bloomRT2.texture;
        blurMat.uniforms.uDir.value.set(0, 1.35 / bloomRT2.height);
        renderer.setRenderTarget(bloomRT1);
        renderer.render(postScene, postCam);

        // Pass 3: Wide Atmospheric Bloom (1/8 Res on RTX Ultra)
        if (isUltra) {
          blurMat.uniforms.tDiffuse.value = bloomRT1.texture;
          blurMat.uniforms.uDir.value.set(2.2 / bloomWide1.width, 0);
          renderer.setRenderTarget(bloomWide1);
          renderer.render(postScene, postCam);

          blurMat.uniforms.tDiffuse.value = bloomWide1.texture;
          blurMat.uniforms.uDir.value.set(0, 2.2 / bloomWide2.height);
          renderer.setRenderTarget(bloomWide2);
          renderer.render(postScene, postCam);
        }
      }

      // Pass 4: BSL / Complementary ACES / Eclipse AgX Compositor + True AI Frame Gen + RCAS Super-Resolution
      postQuad.material = compositeMat;
      compositeMat.uniforms.tScene.value = sceneRT.texture;
      compositeMat.uniforms.tBloom.value = bloomRT1.texture;
      compositeMat.uniforms.tBloomWide.value = isUltra ? bloomWide2.texture : bloomRT1.texture;
      compositeMat.uniforms.tGodRays.value = godRayRT1.texture;
      if (fgMode > 1 && fgRtA && fgRtB && typeof fgBlendMat !== 'undefined') {
        const curRt = fgPing ? fgRtB : fgRtA;
        const prvRt = fgPing ? fgRtA : fgRtB;
        renderer.setRenderTarget(curRt);
        renderer.render(postScene, postCam);
        postQuad.material = fgBlendMat;
        fgBlendMat.uniforms.tCur.value = curRt.texture;
        fgBlendMat.uniforms.tPrev.value = prvRt.texture;
        fgBlendMat.uniforms.uReprojUV.value.set(0, 0);
        fgBlendMat.uniforms.uZoom.value = 0.0;
        fgBlendMat.uniforms.uIsSynth.value = 0.0;
        fgBlendMat.uniforms.uFlowAmt.value = 0.0;
        fgBlendMat.uniforms.uAiSharp.value = fgMode >= 4 ? 0.42 : 0.36;
        renderer.setRenderTarget(null);
        renderer.render(postScene, postCam);
        fgPing ^= 1; _fgPrimed = true; _fgSubIdx = 0; _fgNativeReady++; _fgStatNative++;
        _fgNatYaw = camera.rotation.y; _fgNatPitch = camera.rotation.x;
        _fgNatX = camera.position.x; _fgNatY = camera.position.y; _fgNatZ = camera.position.z;
        _fgNatFov = camera.fov || 72;
        window._fgStats = { mode: fgMode, nativeFrames: _fgStatNative, synthFrames: _fgStatSynth, internalScale: fgMode >= 4 ? 0.60 : 0.72, fps: window._nucraftFps || 60, cpuMs: +(window._nucraftCpuMs || 0).toFixed(2) };
      } else {
        _fgPrimed = false; _fgSubIdx = 0; _fgNativeReady = 0;
        window._fgStats = { mode: 1, nativeFrames: _fgStatNative, synthFrames: _fgStatSynth, internalScale: 1.0, fps: window._nucraftFps || 60, cpuMs: +(window._nucraftCpuMs || 0).toFixed(2) };
        renderer.setRenderTarget(null);
        renderer.render(postScene, postCam);
      }
    } else {
      window._lastDirectRenderUsed = true;
      window._directRenderHits = (window._directRenderHits || 0) + 1;
      renderer.setClearColor(envUniforms.uFogColor.value, 1);
      renderer.render(scene, camera);
    }
  }

  function isMultiplayerSession() {
    if (typeof remotePlayers !== 'undefined' && remotePlayers && remotePlayers.size > 0) {
      for (const rp of remotePlayers.values()) {
        if (rp && !rp.isBuddy) return true;
      }
    }
    return (typeof activeRoomId !== 'undefined' && !!activeRoomId && typeof p2pIsHost !== 'undefined' && !p2pIsHost);
  }

  let _lastPacedFrameMs = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    if (document.hidden) { lastFrame = now; return; }
    const _fpsCap = (typeof sodiumOpts !== 'undefined') ? (Number(sodiumOpts.fpsTarget) || 0) : 0;
    if (_fpsCap > 0) {
      const minGap = 1000 / _fpsCap;
      if (now - _lastPacedFrameMs < minGap * 0.90) return;
      _lastPacedFrameMs = now;
    }
    const _tFrameStart = performance.now();
    try {
    frameCounter++;
    const rawDt = Math.max(0.001, Math.min(0.05, (now - lastFrame) / 1000));
    const inLobbyOptions = !!(window._optionsOpenedFromLobby && _elMenuModal && !_elMenuModal.classList.contains('hidden'));
    const inLobby = !_elLobby.classList.contains('hidden') || inLobbyOptions;
    const inPauseMenu = !!(_elMenuModal && !_elMenuModal.classList.contains('hidden') && !window._optionsOpenedFromLobby && !_elMenuModal.classList.contains('from-lobby'));
    const worldPaused = inPauseMenu && !isMultiplayerSession() && !inLobby && !isWorldLoading;
    const worldSimActive = !inLobby && !isWorldLoading && !worldPaused;
    window._isWorldPaused = worldPaused;
    _fpsCheckAcc += rawDt; _fpsCheckCnt++;
    if (_fpsCheckAcc >= 1.0) {
      const avgFps = _fpsCheckCnt / _fpsCheckAcc;
      window._nucraftFps = Math.round(avgFps);
      _fpsSlow = avgFps < 28;
      if (sodiumOpts.autoPerf !== false && worldSimActive && performance.now() > (window._worldWarmupUntil || 0)) {
        const downThr = _initMobile ? 25 : 46;
        if (avgFps < 25) {
          _autoPerfStreak++; _autoPerfUpStreak = 0;
          if (_autoPerfStreak >= 2 && (_autoPerfTier < 2 || !_autoPerfLow)) {
            _autoPerfTier = 2; _autoPerfLow = true; _autoPerfPrScale = 0.85;
            if (envUniforms.uWaterQuality) envUniforms.uWaterQuality.value = 0.0;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
            resizeViewport();
          }
        } else if (avgFps < downThr) {
          _autoPerfStreak++; _autoPerfUpStreak = 0;
          if (_autoPerfStreak >= 2 && _autoPerfTier < 1) {
            _autoPerfTier = 1; _autoPerfPrScale = 0.90;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
            resizeViewport();
          }
        } else if (avgFps > (_autoPerfTier === 2 ? 52 : 58)) {
          _autoPerfStreak = 0; _autoPerfUpStreak++;
          if (_autoPerfTier === 2 && _autoPerfUpStreak >= 3) {
            _autoPerfTier = 1; _autoPerfLow = false; _autoPerfPrScale = 0.90; _autoPerfUpStreak = 0;
            if (envUniforms.uWaterQuality) envUniforms.uWaterQuality.value = sodiumOpts.waterQuality !== false ? 1.0 : 0.0;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
            resizeViewport();
          } else if (_autoPerfTier === 1 && _autoPerfUpStreak >= 4) {
            _autoPerfTier = 0; _autoPerfPrScale = 1.0; _autoPerfUpStreak = 0;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
            resizeViewport();
          }
        } else {
          _autoPerfStreak = 0; _autoPerfUpStreak = 0;
        }
      }
      _fpsCheckAcc = 0; _fpsCheckCnt = 0;
    }
    window._smoothDt = window._smoothDt ? (window._smoothDt * 0.72 + rawDt * 0.28) : rawDt;
    const dt = Math.min(0.05, window._smoothDt);
    if (inPauseMenu) {
      const _pSig = `${worldPaused ? 1 : 0}|${remotePlayers.size}|${Array.from(remotePlayers.keys()).join(',')}|${_wsRoomHostId || ''}|${currentLang}`;
      if (_pSig !== window._lastPauseUiSig) {
        window._lastPauseUiSig = _pSig;
        if (typeof syncPauseStatusTag === 'function') syncPauseStatusTag();
        if (typeof renderPausePlayersList === 'function') renderPausePlayersList();
      }
    } else if (window._lastPauseUiSig) {
      window._lastPauseUiSig = '';
    }

    lastFrame = now;
    const fgModeNow = (typeof sodiumOpts !== 'undefined' && sodiumOpts.frameGen > 1) ? (sodiumOpts.frameGen | 0) : 1;
    const _runAiSynth = !worldPaused && _shouldRunAiSynthFrame(fgModeNow, worldSimActive);
    if (!worldPaused) {
      elapsed += dt;
      if (typeof sodiumOpts === 'undefined' || sodiumOpts.animations !== false) envUniforms.uTime.value = elapsed;
      if (envUniforms.uPlayerPos) envUniforms.uPlayerPos.value.set(player.x, player.y, player.z);
      if (_presetLerpActive) {
        const lk = 1 - Math.exp(-12.0 * Math.min(0.05, rawDt));
        let maxD = 0;
        for (const k in _presetTargets) {
          const u = envUniforms[k];
          if (!u) continue;
          const d = _presetTargets[k] - u.value;
          u.value += d * lk;
          if (Math.abs(d) > maxD) maxD = Math.abs(d);
        }
        if (maxD < 0.001) {
          for (const k in _presetTargets) if (envUniforms[k]) envUniforms[k].value = _presetTargets[k];
          _presetLerpActive = false;
        }
      }
      if (currentDimension === 'sift' && !_runAiSynth) tickDreamRainbow(elapsed);
      if (!_runAiSynth && typeof updateAmbientSoundscape === 'function') {
        animate._ambAcc = (animate._ambAcc || 0) + rawDt;
        if (animate._ambAcc >= 0.125) { animate._ambAcc = 0; updateAmbientSoundscape(); }
      }
    }

    if (worldSimActive && !_runAiSynth) tickFurnaces(rawDt);

    if (!worldPaused && !_runAiSynth) {
      if (!isWorldLoading) updateChunkStreaming(rawDt);
      if (worldSimActive) {
        if (!_camFrustumReady) _refreshCamFrustum();
        updateWeatherAndLights(dt);
        updateWaterWakes(dt);
        updateInteractiveBlocksAndWorldTicks(dt);
      }
      if (typeof updateEclipseGrass === 'function' && (!window._chunkBuiltThisFrame || window._eclipseGrassDirty)) updateEclipseGrass(false);
      _atmoAcc += dt;
      if (_atmoAcc >= 0.033) { const _aDt = _atmoAcc; _atmoAcc = 0; updateAtmosphere(_aDt); }
    }
    _previewAcc += rawDt;
    const _runPreviewThisFrame = (_previewAcc >= 0.016);
    if (_runPreviewThisFrame) _previewAcc = 0;
    if (worldSimActive) {
      const moveDt = Math.min(0.036, (rawDt > dt * 1.65) ? (dt * 1.35 + rawDt * 0.15) : rawDt);
      if (_runAiSynth) {
        updatePlayer(moveDt);
        _refreshCamFrustum();
        _fgMobDtAcc += dt;
      } else {
        const mobDt = Math.min(0.08, dt + _fgMobDtAcc);
        _fgMobDtAcc = 0;
        updatePlayer(moveDt);
        _refreshCamFrustum();
        updateMining(mobDt); tickFluids(mobDt); tickIncubatingEggs(mobDt); updateDragonUiControls(mobDt); updateMobs(mobDt, elapsed);
        updateProjectilesAndTnt(mobDt); updateDroppedItems(mobDt); updateXpOrbs(mobDt); updateParticles(mobDt);
        if (typeof updatePortalMotes === 'function') updatePortalMotes(mobDt, elapsed);
        updateCoopAndLocator(mobDt, elapsed);
        if (typeof window.runModTickHooks === 'function') window.runModTickHooks(mobDt);
      }
    } else if (isWorldLoading) {
      // Dynamic rotating 3D panorama of the destination world behind Bedrock loading screen!
      if (weatherLines.visible) weatherLines.visible = false;
      if (torchLight.intensity > 0) torchLight.intensity = 0;
      heldPivot.visible = false;
      if (typeof offhandPivot !== 'undefined') offhandPivot.visible = false;
      _worldLoadYaw += dt * 0.16;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = _worldLoadYaw;
      camera.rotation.x = -0.14;
      camera.position.set(player.x, player.y + EYE_HEIGHT + 2.4, player.z);
      skyDome.position.copy(camera.position);
    } else if (inLobby) {
      // Pure Unobstructed Minecraft Java 3D Panorama Spin behind the NUCRAFT Title Screen!
      if (!document.body.classList.contains('in-lobby')) document.body.classList.add('in-lobby');
      if (weatherLines.visible) weatherLines.visible = false;
      if (torchLight.intensity > 0) torchLight.intensity = 0;
      heldPivot.visible = false;
      if (typeof offhandPivot !== 'undefined') offhandPivot.visible = false;
      player.yaw += dt * 0.068;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = -0.10;
      camera.position.set(player.x, player.y + EYE_HEIGHT + 2.2, player.z);
      skyDome.position.copy(camera.position);
      const _drOpen = _elDressingRoom && !_elDressingRoom.classList.contains('hidden');
      if (_runPreviewThisFrame) {
        if (_drOpen && skinPreviewRig && skinPreviewRenderer && skinPreviewScene && skinPreviewCam) {
          animatePlayerRig(skinPreviewRig, { speed: 0, onGround: true }, dt, elapsed);
          skinPreviewRig.g.rotation.y = skinPreviewRotY;
          skinPreviewRenderer.render(skinPreviewScene, skinPreviewCam);
        } else if (!_drOpen && titleSkinRig && titleSkinRenderer && titleSkinScene && titleSkinCam) {
          animatePlayerRig(titleSkinRig, { speed: 0, onGround: true }, dt, elapsed);
          titleSkinRig.g.rotation.y = titleSkinRotY;
          titleSkinRenderer.render(titleSkinScene, titleSkinCam);
        }
      }
    }
    if (!isPlaying && !invDrag.active && _runPreviewThisFrame && _elInvModal && !_elInvModal.classList.contains('hidden') && invPreviewRig && invPreviewRenderer && invPreviewScene && invPreviewCam) {
      if ((frameCounter % (_isMobilePerf ? 5 : 3)) === 0) {
        const _invSel = inventory[player.selectedSlot];
        animatePlayerRig(invPreviewRig, { speed: 0, onGround: true, heldId: (_invSel && _invSel.count > 0) ? _invSel.id : 0 }, dt, elapsed);
        invPreviewRig.g.rotation.y = invPreviewRotY;
        invPreviewRenderer.render(invPreviewScene, invPreviewCam);
      }
    }
    if (!isPlaying && _runPreviewThisFrame && typeof tickDragonModalPreview === 'function') {
      tickDragonModalPreview(dt);
    }

    if (worldSimActive && !_runAiSynth) {
      if (typeof window._minimapAcc !== 'number') window._minimapAcc = 0;
      window._minimapAcc += rawDt;
      const _mmInt = (typeof sodiumOpts === 'undefined' || sodiumOpts.modernFix !== false) ? (_isMobilePerf ? 0.18 : 0.12) : 0.032;
      if (window._minimapAcc >= _mmInt) {
        window._minimapAcc = 0;
        updateMinimap();
      }
    }
    if (worldSimActive) hudTimer += dt;
    if (worldSimActive && !_runAiSynth && hudTimer >= 0.18) {
      hudTimer = 0;
      const py = Math.floor(player.y);
      const trueY = py - depthOffset;
      const curBio = getPlayerBiome();
      const ugBioHud = (currentDimension === 'overworld' && trueY <= -6) ? getUndergroundBiomeAt(Math.floor(player.x), trueY, Math.floor(player.z)) : null;
      const _locB = (b) => (typeof getLocalizedBiomeName === 'function' ? getLocalizedBiomeName(b) : (b && b.name) || '');
      const _tr = (v, e) => (typeof tr === 'function' ? tr(v, e) : v);
      const area = currentDimension === 'end' ? _tr('Khu Kết Thúc (The End)', 'The End')
        : (currentDimension === 'dragon_realm' ? _locB(curBio)
        : (currentDimension === 'warden' ? _locB(curBio)
        : (currentDimension === 'sift' ? _locB(curBio)
        : (currentDimension === 'nether' ? _locB(curBio)
        : (player.eyesInWater ? (trueY <= -450 ? _tr('🌊 Vực Hadal -700m', '🌊 Hadal Trench -700m') : (trueY <= -200 ? _tr('🌊 Vực Đêm Sâu', '🌊 Midnight Zone') : (trueY <= -60 ? _tr('🌊 Tầng Chạng Vạng', '🌊 Twilight Zone') : _tr('🌊 Đại Dương Rộng Lớn', '🌊 Deep Ocean'))))
        : _locB(ugBioHud || curBio))))));
      const _fgTag = (typeof sodiumOpts !== 'undefined' && (sodiumOpts.frameGen | 0) > 1) ? ` AI-FG x${sodiumOpts.frameGen | 0}` : '';
      const _rtTag = (typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing) ? ' • ✨RTX' : '';
      const fpsTag = (sodiumOpts.fpsHud && window._nucraftFps)
        ? ` • ${window._nucraftFps} FPS${_fgTag}${_rtTag} (E:${mobs.length - _culledEntitiesCount}/${mobs.length} C:${chunks.size})`
        : _rtTag;
      const nextCoords = `${_tr('Vị trí', 'Position')}: ${Math.floor(player.x)}, ${trueY}, ${Math.floor(player.z)}${fpsTag}`;
      let _hudTxtChanged = false;
      if (nextCoords !== window._lastCoordsTxt) { window._lastCoordsTxt = nextCoords; _elCoords.textContent = nextCoords; _hudTxtChanged = true; }
      const nextDays = `${_tr('Ngày chơi', 'Day')}: ${player.daysPlayed} • ${area}`;
      if (nextDays !== window._lastDaysTxt) { window._lastDaysTxt = nextDays; _elDays.textContent = nextDays; _hudTxtChanged = true; }
      if (_elDepth) {
        let nextDepth;
        if (currentDimension === 'overworld') {
          nextDepth = player.eyesInWater
            ? (currentLang === 'en'
              ? `🌊 Deep Sea: ${trueY}m / -700m (${trueY <= -450 ? 'Hadal Abyss' : (trueY <= -200 ? 'Midnight Zone' : (trueY <= -60 ? 'Twilight Zone' : 'Sunlight Zone'))})`
              : `🌊 Biển sâu: ${trueY}m / -700m (${trueY <= -450 ? 'Vực Hadal Đen' : (trueY <= -200 ? 'Tầng Đêm Sâu' : (trueY <= -60 ? 'Tầng Chạng Vạng' : 'Tầng Biển Sáng'))})`)
            : (currentLang === 'en'
              ? `⛏️ Depth: ${trueY} / -1000m (${Math.max(0, 1000 + trueY)}m → The Nether)`
              : `⛏️ Độ sâu: ${trueY} / -1000m (Còn ${Math.max(0, 1000 + trueY)}m → Địa Ngục)`);
        }
        else if (currentDimension === 'warden') nextDepth = _tr('🩵 Thế Giới Warden • Quặng T6 & Boss 1000HP', '🩵 Warden Realm • Tier-6 Ores & Boss');
        else if (currentDimension === 'dragon_realm') nextDepth = _tr('🌌 Thế Giới Rồng The End • Boss 50 Skill (0, 136)', '🌌 Dragon End Realm • 50-Skill Sovereign Boss');
        else if (currentDimension === 'sift') nextDepth = _tr('✨ Khu Giấc Mơ (The Sift) • Ao Ichor Cầu Vồng & Quặng Aetherium', '✨ The Sift • Rainbow Ichor & Aetherium Ore');
        else if (currentDimension === 'nether') nextDepth = currentLang === 'en'
          ? `🔥 The Nether: ${trueY} / -1000m (${Math.max(0, 1000 + trueY)}m → The End)`
          : `🔥 Địa Ngục: ${trueY} / -1000m (Còn ${Math.max(0, 1000 + trueY)}m → Khu Kết Thúc)`;
        else nextDepth = _tr('🌌 Đấu Trường End • Phá Pha Lê & Hạ Rồng 750HP!', '🌌 The End Arena • Destroy Crystals & Slay 750HP Dragon!');
        if (nextDepth !== window._lastDepthTxt) { window._lastDepthTxt = nextDepth; _elDepth.textContent = nextDepth; _hudTxtChanged = true; }
      }
      syncLiveTimeAndWeatherUi();
      if (_hudTxtChanged || window._chatPosDirty) {
        if (_hudTxtChanged && typeof markChatPosDirty === 'function') markChatPosDirty();
        syncChatWrapPosition();
      }
    }

    if (!worldPaused) {
      if (_runAiSynth) {
        renderMainScene(rawDt, true);
      } else {
        if (renderer.shadowMap.enabled) {
          _shadowAcc += rawDt;
          const _shPresetMs = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality] && CFG.GFX_PRESETS[shaderQuality].shadowIntervalMs) || 16;
          const _shMinSec = _initMobile ? Math.max(0.033, _shPresetMs / 1000) : Math.max(0.012, _shPresetMs / 1000);
          if (_shadowAcc >= _shMinSec) {
            const _hasActiveFlyingBoss = !!window._hasActiveFlyingBoss;
            let _hasRemoteSh = false;
            if (typeof remotePlayers !== 'undefined' && remotePlayers && remotePlayers.size > 0) {
              for (const rp of remotePlayers.values()) {
                if (rp && rp.rig && rp.rig.g && rp.rig.g.visible && Math.hypot(rp.x - player.x, rp.z - player.z) < 24) {
                  if ((rp.speed || 0) > 0.04 || (rp.swingT || 0) > 0.001 || rp.swingActive || rp.onGround === false) { _hasRemoteSh = true; break; }
                }
              }
            }
            const avatarVis = !!(typeof playerAvatar !== 'undefined' && playerAvatar && playerAvatar.g && playerAvatar.g.visible);
            const pDeltaPos = Math.abs(player.x - _lastShX) > 0.005 || Math.abs(player.y - _lastShY) > 0.005 || Math.abs(player.z - _lastShZ) > 0.005;
            const pDeltaYaw = Math.abs(_wrapAng(player.yaw - _lastShYaw)) > 0.01;
            const playerActing = (player.swingT || 0) > 0.001 || !!player.swordAtkActive || !!player.bowDrawing || (player.blockingT || 0) > 0 || (player.hurtAnimT || 0) > 0 || (player.landAnimT || 0) > 0 || (player.jumpPopT || 0) > 0 || !player.onGround || (player.curSpeed || 0) > 0.04;
            const playerDynamicShadow = avatarVis && (pDeltaPos || pDeltaYaw || playerActing);
            const hasDynamicShadow = _hasActiveFlyingBoss || playerDynamicShadow || !!window._hasActiveNearShadowMob || _hasRemoteSh;
            const terrainCamMoved = Math.abs(player.x - _lastShX) > 0.65 || Math.abs(player.y - _lastShY) > 0.65 || Math.abs(player.z - _lastShZ) > 0.65 || Math.abs(dayTime - _lastShTime) > 0.0022;
            const shInterval = hasDynamicShadow
              ? _shMinSec
              : (terrainCamMoved ? Math.max(0.032, _shMinSec) : ((inLobby || isWorldLoading) ? 0.05 : 0.25));
            if (_shadowAcc >= shInterval) {
              _shadowAcc = 0;
              renderer.shadowMap.needsUpdate = true;
              window._shadowUpdatesCount = (window._shadowUpdatesCount || 0) + 1;
              _lastShX = player.x; _lastShY = player.y; _lastShZ = player.z; _lastShYaw = player.yaw; _lastShTime = dayTime;
            }
          }
        }
        updateSunShadowFrustum(!!renderer.shadowMap.needsUpdate);
        if (typeof updateRayTracingVoxelVolume === 'function') updateRayTracingVoxelVolume(false);
        renderWaterReflectionPass(inLobby, rawDt);
        renderMainScene(rawDt, false);
      }
    } else if ((frameCounter & 15) === 0) {
      renderMainScene(rawDt, false);
    }
    const _frameWorkMs = performance.now() - _tFrameStart;
    window._nucraftCpuMs = window._nucraftCpuMs ? (window._nucraftCpuMs * 0.85 + _frameWorkMs * 0.15) : _frameWorkMs;
    const _cpuMs = Math.max(0.25, window._nucraftCpuMs || _frameWorkMs || 1);
    const _potFps = Math.min(999, Math.round(1000 / _cpuMs));
    const _rInfo = renderer.info && renderer.info.render;
    const _shS = window.__NUCRAFT_SHADOW_STATS__ || (window.__NUCRAFT_SHADOW_STATS__ = {});
    _shS.shadowUpdates = window._shadowUpdatesCount || 0;
    _shS.reflUpdates = window._reflUpdatesCount || 0;
    _shS.cpuMs = +_cpuMs.toFixed(2);
    _shS.potFps = _potFps;
    _shS.smoothShadows = sodiumOpts.smoothShadows !== false;
    _shS.shadowSize = sunLight.shadow.mapSize.width || 0;
    _shS.shadowType = renderer.shadowMap.type;
    _shS.wasmReady = !!window.__NUCRAFT_WASM__?.ready;
    _shS.wasmAbi = window.__NUCRAFT_WASM__?.abi || 0;
    _shS.wasmFrameCalls = window.__NUCRAFT_WASM__?.frameCalls || 0;
    _shS.wasmPartCalls = window.__NUCRAFT_WASM__?.partCalls || 0;
    const _sOpt = (typeof sodiumOpts !== 'undefined') ? sodiumOpts : {};
    let _ad = window.__NUCRAFT_ADDONS__;
    if (!_ad) {
      _ad = window.__NUCRAFT_ADDONS__ = {
        sodium: { enabled: true, activeHits: 0 }, sodiumExtra: { enabled: true, activeHits: 0 },
        lithium: { enabled: true, activeHits: 0 }, immediatelyFast: { enabled: true, activeHits: 0 },
        entityCulling: { enabled: true, activeHits: 0 }, moreCulling: { enabled: true, activeHits: 0 },
        ferriteCore: { enabled: true, activeHits: 0 }, modernFix: { enabled: true, activeHits: 0 },
        quickPack: { enabled: true, activeHits: 0 }, scalableLux: { enabled: true, activeHits: 0 }
      };
    }
    _ad.sodium.enabled = _sOpt.sodium !== false; _ad.sodium.activeHits = (window._visibleChunksCount || 0) + (window._directRenderHits || 0);
    _ad.sodiumExtra.enabled = _sOpt.fpsHud !== false; _ad.sodiumExtra.activeHits = (window._shadowUpdatesCount || 0);
    _ad.lithium.enabled = _sOpt.lithiumAi !== false; _ad.lithium.activeHits = (typeof mobs !== 'undefined' ? mobs.length : 0);
    _ad.immediatelyFast.enabled = _sOpt.immFast !== false; _ad.immediatelyFast.activeHits = (typeof _partInstMesh !== 'undefined' && _partInstMesh ? _partInstMesh.count : 0);
    _ad.entityCulling.enabled = _sOpt.entityCulling !== false; _ad.entityCulling.activeHits = (typeof _culledEntitiesCount !== 'undefined' ? _culledEntitiesCount : 0);
    _ad.moreCulling.enabled = _sOpt.moreCulling !== false; _ad.moreCulling.activeHits = (window._visibleChunksCount || (typeof chunks !== 'undefined' ? chunks.size : 0));
    _ad.ferriteCore.enabled = _sOpt.ferriteRam !== false; _ad.ferriteCore.activeHits = (window._ferritePoolHits || 0);
    _ad.modernFix.enabled = _sOpt.modernFix !== false; _ad.modernFix.activeHits = frameCounter;
    _ad.quickPack.enabled = _sOpt.quickPack !== false; _ad.quickPack.activeHits = (typeof window.__NUCRAFT_MOB_KEYS__ !== 'undefined' ? window.__NUCRAFT_MOB_KEYS__.length : 0);
    _ad.scalableLux.enabled = _sOpt.fastLight !== false; _ad.scalableLux.activeHits = (typeof chunks !== 'undefined' ? chunks.size : 0);
    const _pf = window.__NUCRAFT_PERF__ || (window.__NUCRAFT_PERF__ = {});
    _pf.fps = window._nucraftFps || 60;
    _pf.frameWorkMs = +(_cpuMs.toFixed(2));
    _pf.potFps = _potFps;
    _pf.shadowUpdates = window._shadowUpdatesCount || 0;
    _pf.reflUpdates = window._reflUpdatesCount || 0;
    _pf.drawCalls = _rInfo ? _rInfo.calls : 0;
    _pf.triangles = _rInfo ? _rInfo.triangles : 0;
    _pf.culledEntities = (typeof _culledEntitiesCount !== 'undefined' ? _culledEntitiesCount : 0);
    _pf.visibleChunks = window._visibleChunksCount || (typeof chunks !== 'undefined' ? chunks.size : 0);
    _pf.fpsTarget = Number(_sOpt.fpsTarget) || 0;
    _pf.directRender = !!window._lastDirectRenderUsed;
    } catch (err) {
      // CRASH GUARD: một lỗi đơn lẻ không được phép làm chết vòng lặp game
      window.__ncErrCount = (window.__ncErrCount || 0) + 1;
      if (window.__ncErrCount < 4) {
        try { console.error('[NUCRAFT animate]', err); } catch (_) {}
        try { showToast('⚠️ Lỗi game: ' + (err && err.message ? err.message : err)); } catch (_) {}
      }
    }
  }


  /* ============================================================================
   * 15. BOOTSTRAP (LAUNCHES INTO MINECRAFT JAVA TITLE SCREEN + LIVE 3D PANORAMA!)
   * ============================================================================ */
  const _isExeApp = /[?&]exe=1\b/.test(location.search || '');
  const _isStandaloneExe = /[?&]standalone=1\b/.test(location.search || '');
  if (_isExeApp) document.body.classList.add('is-exe-app');

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    if (_isExeApp) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister().catch(() => {});
      }).catch(() => {});
    } else {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => { if (reg && reg.update) reg.update().catch(() => {}); }).catch(() => {});
    }
  }
  // Nếu trình duyệt khôi phục trang từ bộ nhớ đệm (bfcache) -> tải lại để chắc chắn chạy bản mới nhất
  window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
  // Tự phát hiện bản mới: so BUILD_TAG đang chạy với shared/constants.js trên đĩa (bỏ qua trong standalone .exe)
  if (!_isStandaloneExe && (location.protocol === 'http:' || location.protocol === 'https:')) {
    try {
      fetch('shared/constants.js?ts=' + Date.now(), { cache: 'no-store' }).then(r => r.text()).then((t) => {
        const m = t.match(/BUILD_TAG\s*=\s*'([^']+)'/);
        if (!m || m[1] === BUILD_TAG) return;
        const key = '_nucraft_reload_' + m[1];
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        location.reload();
      }).catch(() => {});
    } catch (_) {}
  }
  if (_isStandaloneExe && location.hostname === '127.0.0.1') {
    setInterval(() => { fetch('/__nucraft_ping', { cache: 'no-store' }).catch(() => {}); }, 5000);
    window.addEventListener('pagehide', () => { try { navigator.sendBeacon('/__nucraft_bye'); } catch (_) {} });
  }
  document.body.classList.add('in-lobby');
  initMinecraftTitleVisuals();
  { const _bt = document.getElementById('buildText'); if (_bt) _bt.textContent = BUILD_TAG; }
  updateTitleScreenLabels();
  loadHudLayout();
  initHotbarDOM();
  resizeViewport();
  document.querySelectorAll('#qualitySeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === shaderQuality));
  document.querySelectorAll('#renderDistSeg .seg-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.val, 10) === renderDistance));
  {
    const _fgV = String((typeof sodiumOpts !== 'undefined' && sodiumOpts.frameGen) || 1);
    document.querySelectorAll('#frameGenSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.fg === _fgV));
  }
  {
    const cBtn = document.getElementById('btnCloudMode');
    if (cBtn) {
      cBtn.classList.toggle('active', volumetricClouds);
      cBtn.textContent = volumetricClouds ? '☁️ Mây Volumetric' : '🧊 Mây Khối Luanti';
    }
  }
  applyQualitySetting(shaderQuality, false); applyBumpToggle(bumpEnabled);
  applyAaMode(aaMode, false);
  applyShaderPreset(shaderPreset, false);
  { const _initSeed = generateUniqueRandomSeed(); const _is = document.getElementById('inpWorldSeed'); if (_is) _is.value = String(_initSeed); currentWorldMeta.seed = _initSeed; resetWorld(_initSeed); }
  if (typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing && typeof updateRayTracingVoxelVolume === 'function') {
    window._rtVolDirty = true;
    updateRayTracingVoxelVolume(true);
  }
  initLobbySkinPicker();
  if (typeof initModManager === 'function') initModManager();
  renderSavedWorldsList();
  connectCoopSocket();
  applyHudLayout();
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) {
    const inp = document.getElementById('inpJoinRoomId');
    if (inp) inp.value = urlRoom.toUpperCase();
    openLobbySub('coop');
  }
  setTimeout(() => { if (typeof preloadCoreMobGlbs === 'function') preloadCoreMobGlbs(); }, 900);
  // ===== CRASH GUARD: bắt lỗi toàn cục + mất ngữ cảnh WebGL + bảo vệ crash khởi động thực sự =====
  window.addEventListener('error', (e) => {
    try { if (e && e.message) showToast('⚠️ Lỗi: ' + e.message); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', () => {
    try { showToast('⚠️ Lỗi nền đã được bỏ qua'); } catch (_) {}
  });
  try {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      try { showToast('🔄 Mất ngữ cảnh đồ họa — đang khôi phục, vui lòng chờ...'); } catch (_) {}
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      try { location.reload(); } catch (_) {}
    }, false);
  } catch (_) {}
  if (CFG.initSafeCrashGuard) {
    CFG.initSafeCrashGuard(canvas, () => {
      try {
        applyQualitySetting('low', true);
        showToast('🛡️ Đã bật đồ họa an toàn để chống crash lặp');
      } catch (_) {}
    });
  }



  initV61UiPolish();
  syncPlayerUidUI();
  initFriendNetworkPeer();
  renderIncomingFriendReqs();
  refreshFriendReqBanner();
  renderFriendWorldsList();
  const _elFriendsModal = document.getElementById('friendsModal');
  setInterval(() => {
    ncMqtt.ensureConnected();
    if (getLockedPlayerUid()) initFriendNetworkPeer();
    const inWorldNow = !document.body.classList.contains('in-lobby') && !isWorldLoading;
    const friendsOpen = _elFriendsModal && !_elFriendsModal.classList.contains('hidden');
    if (!inWorldNow || friendsOpen || loadFriendsList().length > 0) pollAllFriendsStatus();
    if (inWorldNow && currentWorldMeta && currentWorldMeta.shareWithFriends && activeRoomId) {
      broadcastFriendWorldPresence();
    }
    if (!inWorldNow) {
      syncPlayerUidUI();
      renderFriendWorldsList();
    }
  }, 15000);

  window.__NUCRAFT_V45__ = {
    getLockedPlayerUid,
    setLockedPlayerUidOnce,
    handleIncomingFriendPacket,
    acceptIncomingFriendReq,
    declineIncomingFriendReq,
    renderIncomingFriendReqs,
    loadFriendsList,
    loadIncomingFriendReqs,
    renderFriendWorldsList,
    renderFriendsModalLists,
    renderPausePlayersList,
    hostCoopRoom,
    joinCoopRoomById,
    leaveCoopRoom,
    getActiveRoomId: () => activeRoomId,
    getCoopNetDebug: () => ({ roomId: activeRoomId, transport: activeCoopTransport, isHost: p2pIsHost, simAuth: isSimAuthority(), wsState: wsConn ? wsConn.readyState : -1, wsSelfPeerId, wsRoomHostId: _wsRoomHostId, remotePeers: Array.from(remotePlayers.keys()), bcPeers: Array.from(bcRoomPeers), mqttPeers: Array.from(mqttRoomPeers), p2pConns: p2pClientConns.size }),
    ncMqtt,
    setAdminUnlocked,
    getDreamRuinLocations,
    launchWorldFromLobby,
    teleportToScenicBiome,
    getMobs: () => mobs,
    getDimMobDebug: () => (typeof serializeDimMobPersistence === 'function' ? serializeDimMobPersistence() : null),
    spawnMobOfType,
    hurtMob,
    getActiveSwordSlashesCount: () => activeSwordSlashes.length,
    playSwordSlashSfx,
    getPlayerPos: () => ({ x: player.x, y: player.y, z: player.z, seed: worldSeed, dim: currentDimension, isPlaying }),
    B,
    getBlockWorld,
    setBlockWorld,
    flushUrgentChunks,
    getChunks: () => chunks,
    mining,
    updateMining,
    droppedItems,
    setGameMode: (m) => { gameMode = m; },
    addXp,
    openInventoryModal,
    openFurnaceModal,
    openChestModal,
    openTradeModal,
    openSmithingModal,
    closeSmithingModal,
    getFurnaceState: (k) => furnaceStateMap.get(k),
    openWorldMapModal,
    setSlotItem,
    equipItemToSlot,
    recalcPlayerArmor,
    toggleThirdPerson,
    toggleHideHud,
    isHudHidden: () => hudHidden,
    applyShaderPreset,
    applyLanguage: (l, n) => typeof applyLanguage === 'function' && applyLanguage(l, n),
    getCurrentLang: () => currentLang,
    getDayTime: () => dayTime,
    setDayTime: (t) => { dayTime = t; syncLiveTimeAndWeatherUi(true); },
    getClockInfo: () => formatGameClock(dayTime),
    getActiveWeather: () => activeWeatherKind,
    getShootingStarCount: () => shootingStars.filter(s => s.active).length,
    getLocalizedBlockName,
    getLoadingStats: () => window._lastWorldLoadStats || null,
    getWeatherState: () => ({ weatherMode, activeWeatherKind, rainIntensity, lightningFlash, bolts: activeLightningBolts.length, chillMode: envUniforms.uChillMode.value, dlssMode: envUniforms.uDlssMode ? envUniforms.uDlssMode.value : 0, eclipseMode: envUniforms.uEclipseMode ? envUniforms.uEclipseMode.value : 0, skyTop: envUniforms.uSkyTop.value.getHexString(), skyHor: envUniforms.uSkyHorizon.value.getHexString() }),
    getEclipseState: () => ({
      preset: shaderPreset,
      eclipseMode: envUniforms.uEclipseMode ? envUniforms.uEclipseMode.value : 0,
      grassInstances: typeof getEclipseGrassCount === 'function' ? getEclipseGrassCount() : 0,
      grassStats: typeof getEclipseGrassColorStats === 'function' ? getEclipseGrassColorStats() : null,
      activeWakes: envUniforms.uWakePts ? envUniforms.uWakePts.value.filter(w => w.w > 0.01 && (elapsed - w.z) < 4.2).length : 0
    }),
    setWeatherMode: (w) => { weatherMode = w; activeWeatherKind = (w === 'auto' ? 'clear' : w); syncLiveTimeAndWeatherUi(true); },
    getFogAndFireState: () => ({ fogStart: envUniforms.uFogStart.value, fogEnd: envUniforms.uFogEnd.value, fogHex: envUniforms.uFogColor.value.getHexString(), renderDistance, lodVisible: !!(typeof farLodSystem !== 'undefined' && farLodSystem.isVisible()), hasFireHudEl: !!document.getElementById('fireHudOverlay'), burnTime: player.burnTime || 0, burnSoul: !!player._burnSoul, avatarFlameVisible: !!(playerAvatar && playerAvatar.flameGroup && playerAvatar.flameGroup.visible) }),
    setPlayerBurn: (sec, soul = false) => { player.burnTime = sec; player._burnSoul = !!soul; },
    handlePlaceOrEat,
    BLOCK_DEF,
    TRIM_MATERIALS,
    getArmorIconCanvas,
    renderHotbar,
    player,
    inventory,
    getFps: () => window._nucraftFps,
    getPerfStats: () => {
      const cpuMs = +(window._nucraftCpuMs || 0).toFixed(2);
      return {
        fps: window._nucraftFps || 0,
        cpuFrameMs: cpuMs,
        estUncappedFps: cpuMs > 0.1 ? Math.round(1000 / cpuMs) : 0,
        shaderQuality,
        pixelRatio: +(renderer.getPixelRatio() || 1).toFixed(2),
        hardware: { mobile: _initMobile, weak: _isWeakDevice, exe: !!(_hwProfile && _hwProfile.isExe), cores: _hwProfile.cores, mem: _hwProfile.mem },
        exeMode: !!(_hwProfile && _hwProfile.isExe),
        autoPerfTier: _autoPerfTier,
        workerCount: chunkWorkerPool.workerCount || 0,
        renderer: (_hwProfile && _hwProfile.gpu) ? _hwProfile.gpu.renderer : 'WebGL',
        drawCalls: (renderer.info && renderer.info.render) ? renderer.info.render.calls : 0,
        triangles: (renderer.info && renderer.info.render) ? renderer.info.render.triangles : 0,
        chunksLoaded: chunks.size,
        mobCount: mobs.length,
        workerActive: chunkWorkerPool.active,
        workerHits: chunkWorkerPool.hits,
        workerPending: chunkWorkerPool.inFlight.size,
        workerCached: chunkWorkerPool.cache.size,
        workerPendingMeshes: chunkWorkerPool.pendingMeshes || 0,
        workerReadyMeshes: chunkWorkerPool.readyMeshes || 0,
        workerPendingTerrain: chunkWorkerPool.pendingTerrain || 0,
        workerCachedTerrain: chunkWorkerPool.cachedTerrain || 0,
        wasmStats: (typeof _nucraftWasmState !== 'undefined') ? { ..._nucraftWasmState } : null,
        glbFetched: typeof _glbFetchCount === 'number' ? _glbFetchCount : 0,
        audioFetched: typeof _audioFetchCount === 'number' ? _audioFetchCount : 0
      };
    },
    applyQualitySetting,
    preloadMobGlb,
    preloadAllDragonGlbs,
    getChunkWorkerStats: () => ({
      active: chunkWorkerPool.active, hits: chunkWorkerPool.hits,
      pending: chunkWorkerPool.inFlight.size, cached: chunkWorkerPool.cache.size,
      pendingMeshes: chunkWorkerPool.pendingMeshes || 0,
      readyMeshes: chunkWorkerPool.readyMeshes || 0,
      pendingTerrain: chunkWorkerPool.pendingTerrain || 0,
      cachedTerrain: chunkWorkerPool.cachedTerrain || 0,
      epoch: chunkWorkerPool.epoch || 0
    }),
    testBinarySaveRoundtrip: (n = 2000) => {
      if (typeof encodeWorldModsBinary !== 'function' || typeof decodeWorldModsBinary !== 'function') return { ok: false, reason: 'missing_codec' };
      const sample = new Map();
      const dims = ['overworld', 'nether', 'end', 'sift'];
      for (let i = 0; i < n; i++) {
        const d = dims[i % dims.length];
        const x = (i % 64) - 32, y = (i % 80) - 20, z = ((i >> 6) % 64) - 32;
        sample.set(dimModKey(x, y, z, d), 1 + (i % 400));
      }
      const bin = encodeWorldModsBinary(sample);
      const decoded = decodeWorldModsBinary(bin);
      if (!decoded || decoded.length !== sample.size) return { ok: false, expected: sample.size, got: decoded ? decoded.length : 0 };
      for (const [k, v] of decoded) {
        if (sample.get(k) !== v) return { ok: false, mismatchKey: k, expected: sample.get(k), got: v };
      }
      const jsonLen = JSON.stringify(Array.from(sample.entries())).length;
      return { ok: true, entries: sample.size, binBytes: bin.length, jsonBytes: jsonLen, ratio: +(jsonLen / bin.length).toFixed(2) };
    },
    setElapsedForTest: (v) => { elapsed = v; },
    getRigs: () => ({ playerAvatar, titleSkinRig, skinPreviewRig, invPreviewRig }),
    PLAYER_SKINS,
    getSkinDef,
    isSkinSlim,
    openDressingRoom,
    closeDressingRoom,
    selectPlayerSkin,
    getSelectedSkinId: () => selectedSkinId,
    getSkinThumbCacheSize: () => _skinViewportThumbCache.size,
    getSkinCanvasDecodedCount: () => [...skinCanvasCache.values()].filter(c => c && c._decoded).length,
    addCustomSkinFromDataUrl: (dataUrl, name = 'Custom') => new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(addCustomSkinFromImage(im, name));
      im.onerror = () => reject(new Error('invalid_image'));
      im.src = dataUrl;
    }),
    getCustomSkinsCount: () => PLAYER_SKINS.filter(s => s && s.isCustom).length,
    removeCustomSkin,
    getSwimDebug: () => ({
      inWater: !!player.inWater, deepWater: !!player.deepWater,
      waterDepth: player.waterDepth || 0, waterSurfaceY: player.waterSurfaceY, waterBotY: player.waterBotY,
      eyesInWater: !!player.eyesInWater, sprintSwimming: !!player.sprintSwimming, lowSprintSwim: !!player.lowSprintSwim,
      curSpeed: player.curSpeed || 0, y: player.y, sitting: !!player.sitting,
      swimBlend: playerAvatar.swimBlend || 0, swimCrawlBlend: playerAvatar.swimCrawlBlend || 0,
      swimSprintBlend: playerAvatar.swimSprintBlend || 0, sitBlend: playerAvatar.sitBlend || 0,
      r6Clips: Object.keys(ROBLOX_R6_ANIMS).filter(k => k.includes('swim') || k === 'rig_sit'),
      fov: camera.fov
    }),
    getDragonNestLocations,
    getNearestDragonNest,
    hatchTamedDragon,
    rebuildDragonStageMesh,
    mountDragon,
    dismountDragon,
    feedOrInteractTamedDragon,
    fireRiddenDragonBreath,
    incubatingEggs,
    spawnMobOfType,
    getMobs: () => mobs,
    getProjectiles: () => projectiles,
    setBlockWorld,
    flushUrgentChunks,
    teleportPlayer: (x, y, z) => { player.x = x; player.y = y; player.z = z; player.vx = 0; player.vy = 0; player.vz = 0; },
    getDragonMountMetrics: () => {
      const dm = player.ridingDragon;
      const mList = [];
      for (let i = 0; i < mobs.length; i++) {
        const mb = mobs[i];
        if (!mb || mb._dead) continue;
        mList.push({ type: mb.type, hp: mb.hp, maxHp: mb.maxHp, tamed: !!mb.tamed, fromBlender: !!mb.fromBlender, isPlaceholder: !!mb.isPlaceholder, glbKey: mb.glbKey || null, pendingGlbKey: mb.pendingGlbKey || null });
      }
      const sw = (dm && typeof getDragonSaddleWorldPos === 'function') ? getDragonSaddleWorldPos(dm) : { x: player.x, y: player.y, z: player.z };
      const mp = (dm && typeof getDragonMouthWorldPos === 'function') ? getDragonMouthWorldPos(dm) : null;
      return {
        riding: !!dm,
        parentIsScene: playerAvatar.g.parent === scene,
        saddleDelta: dm ? Math.hypot(sw.x - player.x, sw.y - player.y, sw.z - player.z) : null,
        mouth: mp ? { x: mp.x, y: mp.y, z: mp.z } : null,
        dragon: dm ? { x: dm.x, y: dm.y, z: dm.z, yaw: dm.yaw, bank: dm._bankRoll || 0, pitch: dm._flyPitch || 0 } : null,
        player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
        mobs: mList
      };
    },
    getSwordAnimDebug: () => ({ clips: Object.keys(ROBLOX_R6_ANIMS).filter(k => k.startsWith('rig2_sword_')), combo: player.swordCombo || 0, hit: player.swordAtkHit || 0, seq: player.swordAtkSeq || 0, t: player.swordAtkT || 0, active: !!player.swordAtkActive, rigActive: !!playerAvatar._r6SwordActive, rigHit: playerAvatar._r6SwordHit || 0, thirdPerson, setThirdPerson: (v) => { thirdPerson = v; playerAvatar.g.visible = (thirdPerson > 0); heldPivot.visible = (thirdPerson === 0 && !hudHidden); if (typeof offhandPivot !== 'undefined') offhandPivot.visible = (thirdPerson === 0 && !hudHidden && !!activeOffhandObj); if (thirdPerson > 0) applyArmorToPlayerRig(playerAvatar, player.equip, player.equipMeta); }, giveSword: (id, meta = null) => { setSlotItem(player.selectedSlot, id, 1, null, meta); updateHeldViewModel(id, inventory[player.selectedSlot]); renderHotbar(); }, attack: () => attackTargetMob() }),
    getSwordTrailDebug: () => {
      let maxSlices = 0, maxSpan = 0, totalSparks = 0;
      for (let i = 0; i < activeSwordSlashes.length; i++) {
        const tr = activeSwordSlashes[i];
        if (tr.slices > maxSlices) maxSlices = tr.slices;
        totalSparks += tr.sparkCount || 0;
        if (tr.slices >= 2) {
          const sp = tr.lastHilt.distanceTo(tr.lastTip);
          if (sp > maxSpan) maxSpan = sp;
        }
      }
      return { is3D: true, activeCount: activeSwordSlashes.length, maxSlices, maxBladeSpan: +maxSpan.toFixed(3), sparkCount: totalSparks };
    },
    setAutoPerf: (on) => {
      sodiumOpts.autoPerf = !!on;
      if (!on) {
        _autoPerfLow = false; _autoPerfTier = 0; _autoPerfStreak = 0; _autoPerfUpStreak = 0;
        if (_autoPerfPrScale !== 1.0) { _autoPerfPrScale = 1.0; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality))); resizeViewport(); }
        if (envUniforms.uWaterQuality) envUniforms.uWaterQuality.value = 1.0;
      }
    },
    getWaterReflDebug: () => ({ width: reflRT.width, height: reflRT.height, far: reflCam.far, active: envUniforms.uUsePlanarRefl.value, exposure: envUniforms.uExposure.value, shaftStrength: envUniforms.uShaftStrength.value }),
    getSwingDebug: () => ({ swingT: player.swingT, swingDur: player.swingDur || 0.25, swing: player.curSwing || 0, swordAtkActive: !!player.swordAtkActive, armRx: (playerAvatar && playerAvatar.armR) ? playerAvatar.armR.rotation.x : 0, actionBlend: playerAvatar ? (playerAvatar.actionBlend || 0) : 0, heldRx: heldPivot ? heldPivot.rotation.x : 0 }),
    spawnMobAt: (type, x, y, z) => (typeof spawnMobOfType === 'function' ? spawnMobOfType(type, x, y, z) : null),
    getMobsList: () => mobs,
    getWaterDepthAttrInfo: () => {
      let count = 0, maxD = 0;
      chunks.forEach(c => {
        const a = c.waterMesh && c.waterMesh.geometry && c.waterMesh.geometry.attributes && c.waterMesh.geometry.attributes.aDepth;
        if (a) { count += a.count; for (let i = 0; i < a.count; i++) if (a.array[i] > maxD) maxD = a.array[i]; }
      });
      return { count, maxD };
    },
    openMenu,
    closeInventoryModal,
    isMultiplayerSession,
    getPauseDebug: () => ({
      isPlaying,
      inPauseMenu: !!(_elMenuModal && !_elMenuModal.classList.contains('hidden') && !window._optionsOpenedFromLobby && !_elMenuModal.classList.contains('from-lobby')),
      isMultiplayer: isMultiplayerSession(),
      worldPaused: !!window._isWorldPaused,
      elapsed,
      dayTime,
      remoteCount: remotePlayers.size,
      activeRoomId,
      p2pIsHost
    }),
    addMockRemotePeer: (id, name = 'Peer', isBuddy = false) => ensureRemotePeer(id, name, '#4ade80', isBuddy),
    removeMockRemotePeer: (id) => removeRemotePeer(id),
    setMockGuestSession: (roomId) => { if (roomId) { activeRoomId = roomId; p2pIsHost = false; } else { activeRoomId = null; p2pIsHost = false; } },
    getRemotePlayers: () => remotePlayers,
    applyRemotePeerState,
    applyRemoteMobSync,
    createNetInterp,
    pushNetSnap,
    sampleNetInterp,
    serializeMobsForNet,
    switchDimension,
    getEndCityForRegion: (rx, rz) => (typeof getEndCityForRegion === 'function' ? getEndCityForRegion(rx, rz) : null),
    teleportViaEndGateway: (toOuter = true) => (typeof teleportViaEndGateway === 'function' ? teleportViaEndGateway(toOuter) : null),
    getChestSlots: (wx, wy, wz) => chestStorageMap.get(toTrueChestKey(wx, wy, wz)) || null,
    getEndDebug: () => ({
      dim: currentDimension,
      pos: { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2) },
      gliding: !!player.gliding,
      equip: { ...player.equip },
      heroCity: (typeof END_CITY_HERO !== 'undefined') ? END_CITY_HERO : null,
      dragonHeads: (typeof dragonHeadYaw !== 'undefined') ? dragonHeadYaw.size : 0
    }),
    teleportPlayerTo: (x, y, z) => {
      player.x = x; player.y = y; player.z = z; player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = y;
      const scx = Math.floor(x) >> 4, scz = Math.floor(z) >> 4;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (!chunks.has(chunkKey(scx + dx, scz + dz))) generateChunk(scx + dx, scz + dz);
      }
      flushUrgentChunks(32, true);
    },
    getDeepChunkDebug: () => {
      let pendingCount = 0, nearPending5x5 = 0, renderPending = 0, oceanCount = 0;
      const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
      for (const ch of chunks.values()) {
        const dx = Math.abs(ch.cx - pcx), dz = Math.abs(ch.cz - pcz);
        if (ch._pendingSlice) {
          pendingCount++;
          if (dx <= 2 && dz <= 2) nearPending5x5++;
          if (dx <= renderDistance && dz <= renderDistance) renderPending++;
        }
        if (ch.isOceanChunk) oceanCount++;
      }
      return {
        depthOffset,
        playerY: +player.y.toFixed(2),
        trueY: +(player.y - depthOffset).toFixed(2),
        loadedChunks: chunks.size,
        pendingSliceChunks: pendingCount,
        nearPending5x5,
        renderPending,
        oceanFlaggedChunks: oceanCount,
        workerActive: !!(typeof chunkWorkerPool !== 'undefined' && chunkWorkerPool.active),
        workerHits: (typeof chunkWorkerPool !== 'undefined' ? chunkWorkerPool.hits : 0)
      };
    },
    findOceanCoord: () => {
      const px = Math.floor(player.x), pz = Math.floor(player.z);
      for (let r = 64; r <= 3200; r += 64) {
        for (const [dx, dz] of [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]]) {
          const tx = px + dx, tz = pz + dz;
          const om = getOceanMacro(tx, tz);
          if (om && om.isOcean && getOceanFloorTrueY(tx, tz) <= -120) return { x: tx, z: tz, floorY: getOceanFloorTrueY(tx, tz) };
        }
      }
      return null;
    },
    playerCollides: (x, y, z) => playerCollides(x, y, z),
    getFenceWallBoxes: (wx, wy, wz) => getFenceWallBoxes(wx, wy, wz, getBlockWorld(wx, wy, wz)),
    setBlockWorld: (x, y, z, id) => { setBlockWorld(x, y, z, id, true); flushUrgentChunks(32, true); },
    getLavaFxDebug: () => ({
      inLava: !!player.inLava,
      eyesInLava: !!player.eyesInLava,
      lavaOverlayActive: !!(_elLava && _elLava.classList.contains('active')),
      fireHudActive: !!(_elFireHud && _elFireHud.classList.contains('active')),
      nearbyLavaProx: +(window._nearbyLavaProx || 0).toFixed(3),
      nearLavaCells: (typeof _nearLavaCells !== 'undefined' ? _nearLavaCells.length : 0),
      lavaParticleSpawns: window._lavaParticleSpawns || 0,
      lavaSplashCount: window._lavaSplashSfxCount || 0,
      lavaPopSfxCount: window._lavaPopSfxCount || 0
    }),
    getRayTracingStats: () => (typeof _getRtStats === 'function' ? _getRtStats() : { enabled: false }),
    setRayTracing: (on) => {
      const target = !!on;
      if (typeof sodiumOpts !== 'undefined') {
        sodiumOpts.rayTracing = target;
        if (typeof saveSodiumOpts === 'function') saveSodiumOpts();
      }
      if (envUniforms.uRayTracing) envUniforms.uRayTracing.value = target ? 1.0 : 0.0;
      const btn = document.getElementById('btnRayTracing');
      if (btn) {
        btn.classList.toggle('active', target);
        btn.textContent = target ? (typeof tr === 'function' ? tr('BẬT', 'ON') : 'BẬT') : (typeof tr === 'function' ? tr('TẮT', 'OFF') : 'TẮT');
      }
      window._rtVolDirty = true;
      applyQualitySetting(shaderQuality, false);
      if (target && typeof updateRayTracingVoxelVolume === 'function') updateRayTracingVoxelVolume(true);
      window._postFxDirty = true;
      if (typeof window._fgReset === 'function') window._fgReset();
      return (typeof _getRtStats === 'function' ? _getRtStats() : { enabled: target });
    },
    getHighlightDebug: () => ({
      visible: highlightMesh.visible,
      sx: +highlightMesh.scale.x.toFixed(3), sy: +highlightMesh.scale.y.toFixed(3), sz: +highlightMesh.scale.z.toFixed(3),
      px: +highlightMesh.position.x.toFixed(3), py: +highlightMesh.position.y.toFixed(3), pz: +highlightMesh.position.z.toFixed(3)
    }),
    getMiningFxDebug: () => ({
      crackStages: crackTextures.length,
      crackVisible: crackMesh.visible,
      crackStageIdx: crackTextures.indexOf(crackMat.map),
      crackTexW: crackTextures[0]?.image?.width || 0,
      crackTexH: crackTextures[0]?.image?.height || 0,
      blkParticleCount: blkParticles.length,
      particleCount: particles.length,
      pixelFxCount: pixelFxList.length
    }),
    spawnBlockHitParticles,
    spawnBlockBreakParticles,
    crackMesh,
    crackMat,
    crackTextures,
    getWindmillDebug: () => {
      const arr = [];
      for (const [k, v] of interactiveVisuals.entries()) {
        if (v && v.kind === 'windmill_hub') {
          arr.push({
            key: k, x: v.group.position.x, y: v.group.position.y, z: v.group.position.z,
            visible: v.group.visible, rotZ: v.pivot ? +v.pivot.rotation.z.toFixed(4) : null,
            state: windmillHubState.get(k) || null
          });
        }
      }
      return arr;
    },
    xpOrbs,
    spawnXpOrbs,
    hurtMob,
    getMobs: () => mobs,
    getSittingDebug: () => {
      playerAvatar.g.updateMatrixWorld(true);
      const bBody = new THREE.Box3();
      const leg0 = playerAvatar.legL?.children[0], leg1 = playerAvatar.legR?.children[0], tr0 = playerAvatar.torso?.children[0];
      if (leg0) bBody.expandByObject(leg0);
      if (leg1) bBody.expandByObject(leg1);
      if (tr0) bBody.expandByObject(tr0);
      return {
        sitting: !!player.sitting,
        sitBlend: +(playerAvatar.sitBlend || 0).toFixed(3),
        sitEyeOff: +(player.sitEyeOff || 0).toFixed(3),
        playerY: +player.y.toFixed(3),
        minY: +bBody.min.y.toFixed(3),
        gap: +(bBody.min.y - player.y).toFixed(4)
      };
    }
  };

  requestAnimationFrame(animate);
