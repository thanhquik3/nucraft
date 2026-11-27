// NUCRAFT Module: src/ui/Menus.js — Ore UI lobby, Dressing Room, settings, saved worlds & pause menu

  function syncPauseStatusTag() {
    const tag = document.querySelector('#menuModal .pause-paused-tag');
    if (!tag) return;
    const isMulti = (typeof isMultiplayerSession === 'function') && isMultiplayerSession();
    tag.textContent = isMulti
      ? tr('Chơi chung • Không tạm dừng', 'Multiplayer • World Live')
      : tr('Trò chơi đã tạm dừng', 'Game Paused');
  }

  function openMenu() {
    isPlaying = false; mining.active = false; window._optionsOpenedFromLobby = false;
    if (typeof clearMoveKeys === 'function') clearMoveKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.classList.add('in-menu');
    if (typeof syncMobSpawnLockUI === 'function') syncMobSpawnLockUI();
    const mm = document.getElementById('menuModal');
    mm.classList.remove('from-lobby', 'hidden');
    mm.classList.add('pause-mode');
    const gmH1 = document.querySelector('#menuModal .gm-brand h1');
    if (gmH1) gmH1.textContent = tr('CÀI ĐẶT', 'SETTINGS');
    const bp = document.getElementById('btnPlay');
    if (bp) bp.textContent = tr('Tiếp Tục Chơi', 'Back to Game');
    const ppn = document.getElementById('pausePlayerName');
    if (ppn) ppn.textContent = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || localPlayerName || 'Người chơi';
    if (typeof renderPausePlayersList === 'function') renderPausePlayersList();
    syncPauseStatusTag();
    if (typeof renderPauseChar3D === 'function') renderPauseChar3D();
    const pdi = document.getElementById('pauseDimInfo');
    if (pdi) {
      const dimLabel = currentDimension === 'sift' ? tr('The Sift (Khu Giấc Mơ)', 'The Sift (Dream Realm)') : (currentDimension === 'nether' ? tr('Địa Ngục', 'The Nether') : (currentDimension === 'end' ? 'The End' : tr('Thế Giới Chính', 'Overworld')));
      const modeLabel = gameMode === 'creative' ? tr('Sáng Tạo', 'Creative') : tr('Sinh Tồn', 'Survival');
      pdi.textContent = `${dimLabel} • ${modeLabel}`;
    }
  }
  // v35: nút của pause menu kiểu Minecraft
  document.getElementById('pauseResume')?.addEventListener('click', () => { ensureAudio(); startPlaying(); });
  document.getElementById('pauseOptions')?.addEventListener('click', () => {
    const mm = document.getElementById('menuModal');
    mm.classList.remove('pause-mode');
    if (typeof syncTimeWeatherAdminLocks === 'function') syncTimeWeatherAdminLocks();
    if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
    const activeTab = document.querySelector('#gmNav .gm-tab.active');
    if (activeTab && typeof _syncGmInspectorForTab === 'function') _syncGmInspectorForTab(activeTab.dataset.gtab);
    if (typeof updateMobileUiScale === 'function') { updateMobileUiScale(); requestAnimationFrame(updateMobileUiScale); }
  });
  document.getElementById('pauseQuit')?.addEventListener('click', () => {
    try { saveCurrentWorldToList(); } catch (e) {}
    document.getElementById('btnBackLobby')?.click();
  });
  document.getElementById('pauseBtnMap')?.addEventListener('click', () => {
    ensureAudio();
    startPlaying();
    openWorldMapModal();
  });
  document.getElementById('pauseBtnCam')?.addEventListener('click', () => {
    ensureAudio();
    document.getElementById('btnCamMode')?.click();
    startPlaying();
  });
  const _openHudFromPause = () => {
    ensureAudio();
    document.getElementById('menuModal')?.classList.add('hidden');
    document.getElementById('btnEditHud')?.click();
  };
  document.getElementById('pauseBtnHud')?.addEventListener('click', _openHudFromPause);
  document.getElementById('pauseBtnEditHud')?.addEventListener('click', _openHudFromPause);
  document.getElementById('btnOreLobbyBack')?.addEventListener('click', () => {
    ensureAudio();
    closeLobbySub();
  });

  function applyBumpToggle(enabled) {
    bumpEnabled = enabled;
    const rtOn = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
    const isLow = (shaderQuality === 'low' && !rtOn);
    terrainMat.bumpScale = isLow ? 0.0 : (bumpEnabled ? (rtOn ? 0.085 : 0.058) : (rtOn ? 0.045 : 0.0));
    leavesMat.bumpScale = 0.0;
    const btn = document.getElementById('btnTexFilter');
    if (btn) { btn.classList.toggle('active', bumpEnabled); btn.textContent = bumpEnabled ? '✨ Bump PBR: Bật' : '🧱 Pixel Phẳng'; }
  }

  function teleportToScenicBiome(targetKey, opts = null) {
    if ((targetKey === 'dim_sift' || String(targetKey).startsWith('sift_')) && !isAdminUnlocked) {
      showToast('🔒 Khu Giấc Mơ chỉ mở khi bạn đánh bại hết quái tại Khu Tàn Tích!');
      return;
    }
    const _wrapDimLoad = (title, tip, badge, fn) => {
      if (!isWorldLoading && typeof showWorldLoadingOverlay === 'function') {
        showWorldLoadingOverlay(title, tip, fn, { badge });
      } else {
        fn();
        if (!isWorldLoading) startPlaying();
      }
    };
    if (targetKey === 'dim_overworld') { _wrapDimLoad('Đang tải thế giới', 'Đang dựng lại khu vực Thế Giới Chính...', 'OVERWORLD', () => switchDimension('overworld')); return; }
    if (targetKey === 'dim_nether') { _wrapDimLoad('Đang tải Địa Ngục', 'Đang kiến tạo dung nham & thành trì The Nether...', 'THE NETHER', () => switchDimension('nether')); return; }
    if (targetKey === 'nether_castle') { _wrapDimLoad('Đang tải Lâu Đài Địa Ngục', 'Đang dựng Lâu Đài Gothic Địa Ngục & cầu đá đen trên biển dung nham...', 'NETHER CASTLE', () => switchDimension('nether', '🏰 Đã tới Lâu Đài Địa Ngục! Khám phá tòa thành tháp ngọc lam giữa biển dung nham!', { castleHero: true })); return; }
    if (targetKey === 'dim_end') { _wrapDimLoad('Đang tải Khu Kết Thúc', 'Đang dựng đảo Ender & Đấu Trường Rồng...', 'THE END', () => switchDimension('end')); return; }
    if (targetKey === 'dim_dragon_realm') { _wrapDimLoad('Đang tải Thế Giới Rồng The End', 'Đang kiến tạo Thành Cổ Purpur, Hẻm Hang Pha Lê & Boss 50 Skill...', 'DRAGON REALM', () => switchDimension('dragon_realm')); return; }
    if (targetKey === 'dim_warden') { _wrapDimLoad('Đang tải Thế Giới Warden', 'Đang dựng Cổ Thành Sculk, Rừng Linh Hồn & Quặng Tier 6...', 'WARDEN REALM', () => switchDimension('warden')); return; }
    if (targetKey === 'dim_sift') { _wrapDimLoad('Đang tải The Sift', 'Đang dệt vùng đất Giấc Mơ & ao Ichor cầu vồng...', 'THE SIFT', () => switchDimension('sift')); return; }
    if (targetKey === 'sift_meadow' || targetKey === 'sift_huskland' || targetKey === 'sift_lullaby' || targetKey === 'sift_fungal' || targetKey === 'sift_burrows') {
      const siftMeta = {
        sift_meadow:   { bio: BIOMES.SIFT_MEADOW,      label: "🌸 The Sift • Singer's Meadow (Echo Golem & Ao Ichor)!" },
        sift_huskland: { bio: BIOMES.SIFT_HUSKLAND,    label: "🏜️ The Sift • Humbler Huskland!" },
        sift_lullaby:  { bio: BIOMES.SIFT_LULLABY,     label: "🎶 The Sift • Lullaby Hills!" },
        sift_fungal:   { bio: BIOMES.SIFT_SPOREFIELDS, label: "🍄 The Sift • Fungal Sporefields!" },
        sift_burrows:  { bio: BIOMES.SIFT_ICHOR_PONDS, label: "🔮 The Sift • Burrows & Ichor Ponds!" }
      }[targetKey];
      const prevDim = currentDimension;
      currentDimension = 'sift';
      const _siftOx = (((Math.imul(worldSeed ^ 0x517cc1b7, 0x27d4eb2f) >>> 0) % 800) - 400);
      const _siftOz = (((Math.imul(worldSeed ^ 0x2545f491, 0x85ebca6b) >>> 0) % 800) - 400);
      let fx = _siftOx, fz = _siftOz, foundSift = false;
      for (let r = 0; r <= 216 && !foundSift; r += 24) {
        for (let dz = -r; dz <= r && !foundSift; dz += 24) {
          for (let dx = -r; dx <= r && !foundSift; dx += 24) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            const b = getBiomeAt(_siftOx + dx, _siftOz + dz);
            if (b === siftMeta.bio || (targetKey === 'sift_lullaby' && b === BIOMES.SIFT_LULLABY_TOP)) {
              fx = _siftOx + dx; fz = _siftOz + dz; foundSift = true;
            }
          }
        }
      }
      currentDimension = prevDim;
      _wrapDimLoad('Đang tải The Sift', siftMeta.label, 'THE SIFT', () => switchDimension('sift', siftMeta.label, { spawnX: fx, spawnZ: fz, targetBio: siftMeta.bio }));
      return;
    }
    if (targetKey === 'ancient_city') {
      const _doAncientTp = () => {
        if (currentDimension !== 'overworld') switchDimension('overworld');
        else _clearWorldInteractiveCaches(false);
        const cities = getAncientCityLocations();
        const ac = cities[0];
        depthOffset = 40;
        const tcx = Math.floor(ac.x) >> 4, tcz = Math.floor(ac.z) >> 4;
        for (const ch of chunks.values()) { disposeChunkMeshes(ch, true); _freeChunkData(ch); }
        chunks.clear(); _invChunkCache(); emergeQueue.length = 0; emergeSet.clear(); _chunkUnloadQueue.length = 0; _chunkUnloadSet.clear();
        _dirtyChunkSet.clear(); _urgentChunkSet.clear(); _borderChunkSet.clear(); endCrystalVisuals.clear();
        for (let i = mobs.length - 1; i >= 0; i--) disposeMobInstance(mobs[i]);
        mobs.length = 0;
        player.x = ac.x + 0.5;
        player.y = ac.y + depthOffset + 1.25;
        player.z = ac.z + 18.5;
        player.yaw = 0.0; player.pitch = 0.14;
        player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
        lastPlayerCx = 99999; lastPlayerCz = 99999;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) generateChunk(tcx + dx, tcz + dz);
        if (!isWorldLoading) {
          for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
          _teleportWarmupFrames = 24;
        }
        if (shaderPreset !== 'eclipse' && !(opts && opts.preserveShader)) applyShaderPreset('moonlit');
        if (!isWorldLoading) startPlaying();
        showToast('👁️ Thành Phố Cổ! Nhấn Shift đi lén tránh Sculk Shrieker đánh thức Warden!');
      };
      _wrapDimLoad('Đang tải Thành Phố Cổ', 'Đang kiến tạo Thành Phố Cổ...', 'THÀNH PHỐ CỔ', _doAncientTp);
      return;
    }
    if (targetKey === 'dragon_nest') {
      const _doNestTp = () => {
        if (currentDimension !== 'overworld' || depthOffset !== 0) switchDimension('overworld');
        else _clearWorldInteractiveCaches(false);
        const nr = getDragonNestLocations()[0];
        const tcx = Math.floor(nr.x) >> 4, tcz = Math.floor(nr.z) >> 4;
        for (const ch of chunks.values()) { disposeChunkMeshes(ch, true); _freeChunkData(ch); }
        chunks.clear(); _invChunkCache(); emergeQueue.length = 0; emergeSet.clear(); _chunkUnloadQueue.length = 0; _chunkUnloadSet.clear();
        _dirtyChunkSet.clear(); _urgentChunkSet.clear(); _borderChunkSet.clear(); endCrystalVisuals.clear();
        for (let i = mobs.length - 1; i >= 0; i--) disposeMobInstance(mobs[i]);
        mobs.length = 0;
        spawnedDragonNests.clear();
        player.x = nr.x + 0.5; player.y = nr.y + 3.0; player.z = nr.z + 11.5;
        player.yaw = 0.0; player.pitch = 0.10;
        player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
        lastPlayerCx = 99999; lastPlayerCz = 99999;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) generateChunk(tcx + dx, tcz + dz);
        if (!isWorldLoading) {
          for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
          _teleportWarmupFrames = 24;
        }
        if (typeof MOB_STATS[nr.el + '_dragon'] !== 'undefined') {
          spawnedDragonNests.add(nr.idx);
          spawnMobOfType(nr.el + '_dragon', nr.x + 0.5, nr.y + 8.5, nr.z - 4.0);
        }
        if (!window._cartoonAddonActive && shaderPreset !== 'eclipse' && !(opts && opts.preserveShader)) applyShaderPreset('bsl');
        dayTime = 0.34;
        if (!isWorldLoading) startPlaying();
        showToast('🌋 Đã tới Tổ Rồng Nguyên Tố! Khai thác Quặng Tinh Thể Rồng bằng Cúp Sắt+ & nhặt Trứng Rồng!');
      };
      _wrapDimLoad('Đang tải Tổ Rồng', 'Đang dựng miệng núi lửa Tổ Rồng & Quặng Tinh Thể Rồng...', 'DRAGON NEST', _doNestTp);
      return;
    }
    _wrapDimLoad('Đang tải khu vực mới', 'Đang kiến tạo địa hình & dựng khối 3D...', 'OVERWORLD', () => {
    if (currentDimension !== 'overworld' || depthOffset !== 0) switchDimension('overworld');
    if (targetKey === 'grand_ruins') {
      const ccx = GRAND_RUINS_CX >> 4, ccz = GRAND_RUINS_CZ >> 4;
      for (const ch of chunks.values()) disposeChunkMeshes(ch);
      chunks.clear(); _invChunkCache(); emergeQueue.length = 0; emergeSet.clear(); _chunkUnloadQueue.length = 0; _chunkUnloadSet.clear();
      _dirtyChunkSet.clear(); _urgentChunkSet.clear(); _borderChunkSet.clear(); endCrystalVisuals.clear();
      for (let i = mobs.length - 1; i >= 0; i--) disposeMobInstance(mobs[i]);
      mobs.length = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) generateChunk(ccx + dx, ccz + dz);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const chR = chunks.get(chunkKey(ccx + dx, ccz + dz));
        if (chR && chR.dirty) rebuildChunkMesh(chR);
      }
      _teleportWarmupFrames = 24;
      player.x = GRAND_RUINS_CX + 0.5; player.y = 15.2; player.z = GRAND_RUINS_CZ + 8.5;
      player.yaw = 0.0; player.pitch = 0.08;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = 15.2;
      lastPlayerCx = 99999; lastPlayerCz = 99999;
      if (!window._cartoonAddonActive && shaderPreset !== 'eclipse' && !(opts && opts.preserveShader)) applyShaderPreset('bsl');
      dayTime = 0.30;
      if (!isWorldLoading) startPlaying();
      showToast('🏛️ Chào mừng tới Khu Tàn Tích Cổ Đại 1000×1000 & Đền Cổng The End! Đặt đủ 12 Mắt Ender để mở cổng!');
      return;
    }
    if (targetKey === 'abandoned_city') {
      // Snap cleanly to a Grand Boulevard chunk ((ccx % 3) === 0, (ccz % 3) !== 0) so spawn faces down an overgrown avenue!
      const _acOffCx = (((Math.imul(worldSeed ^ 0x1b873593, 0x85ebca6b) >>> 0) % 8) - 4) * 3;
      const _acOffCz = (((Math.imul(worldSeed ^ 0xcc9e2d51, 0x27d4eb2f) >>> 0) % 8) - 4) * 3;
      const ccx = 282 + _acOffCx, ccz = 283 + _acOffCz;
      const tx = ccx * 16 + 4.5, tz = ccz * 16 + 11.5;
      for (const ch of chunks.values()) disposeChunkMeshes(ch);
      chunks.clear(); _invChunkCache(); emergeQueue.length = 0; emergeSet.clear(); _chunkUnloadQueue.length = 0; _chunkUnloadSet.clear();
      _dirtyChunkSet.clear(); _urgentChunkSet.clear(); _borderChunkSet.clear(); endCrystalVisuals.clear();
      for (let i = mobs.length - 1; i >= 0; i--) disposeMobInstance(mobs[i]);
      mobs.length = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(ccx + dx, ccz + dz);
      const centerCh = chunks.get(chunkKey(ccx, ccz));
      if (centerCh && centerCh.dirty) rebuildChunkMesh(centerCh);
      _teleportWarmupFrames = 24;
      player.x = tx; player.y = 3.2; player.z = tz;
      player.yaw = 0.0; player.pitch = 0.08;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = 3.2;
      lastPlayerCx = 99999; lastPlayerCz = 99999;
      spawnMobOfType('ruin_stalker', tx + 5.5, 3.2, tz - 10.5);
      spawnMobOfType('gargoyle', tx - 4.0, 14.5, tz - 14.0);
      if (!window._cartoonAddonActive && shaderPreset !== 'eclipse' && !(opts && opts.preserveShader)) applyShaderPreset('bsl');
      dayTime = 0.31;
      if (!isWorldLoading) startPlaying();
      return;
    }
    const sunYawAt = (t) => { const a = t * Math.PI * 2 - Math.PI * 0.5; return Math.atan2(-Math.cos(a) * 0.85, -0.42); };
    const moonYawAt = (t) => { const a = t * Math.PI * 2 - Math.PI * 0.5; return Math.atan2(Math.cos(a) * 0.85, 0.42); };
    const mapCfg = {
      ancient_ruins:{ biome: BIOMES.FOREST,          needWater: false, time: 0.72,  preset: 'moonlit', pitch: 0.02, msg: '🏛️ Tàn Tích Bí Ẩn Cổ Đại (Đầy Quái Vật & Kho Báu Hiếm!)' },
      castle_city: { biome: BIOMES.PLAINS,           needWater: false, time: 0.35,  preset: 'bsl',     pitch: 0.04, msg: '🏰 Đại Thành & Lâu Đài Hoàng Gia' },
      seaport:     { biome: BIOMES.BEACH_PALM,       needWater: false, time: 0.34,  preset: 'bsl',     pitch: 0.0,  msg: '⚓ Cảng Biển, Ngọn Hải Đăng & Thuyền Buồm' },
      ocean_ruins: { biome: BIOMES.DEEP_OCEAN,       needWater: false, time: 0.44,  preset: 'bliss',   pitch: -0.22,msg: '🚢 Đáy Biển: Thuyền Đắm, Đền Đại Dương & Rạn San Hô' },
      abyss_trench:{ biome: BIOMES.ABYSS_TRENCH,     needWater: false, time: 0.46,  preset: 'bsl',     pitch: -0.24,msg: '🌊 Vực Biển Siêu Sâu (Abyss Trench) — Càng lặn sâu càng tối xanh đen đậm!' },
      bamboo:      { biome: BIOMES.BAMBOO_JUNGLE,    needWater: false, time: 0.34,  preset: 'bliss',   pitch: 0.02, msg: '🎋 Rừng Trúc Xanh Cổ Đại' },
      mushroom:    { biome: BIOMES.MUSHROOM_ISLAND,  needWater: false, time: 0.36,  preset: 'bliss',   pitch: 0.02, msg: '🍄 Đảo Nấm Đỏ Khổng Lồ' },
      lavender:    { biome: BIOMES.LAVENDER_MEADOW,  needWater: false, time: 0.33,  preset: 'bliss',   pitch: -0.02,msg: '🪻 Thảo Nguyên Hoa Oải Hương' },
      volcanic:    { biome: BIOMES.VOLCANIC_BASALT,  needWater: false, time: 0.70,  preset: 'bsl',     pitch: 0.02, msg: '🌋 Đồng Tro Bazan Núi Lửa' },
      beach_palm:  { biome: BIOMES.BEACH_PALM,       needWater: true,  time: 0.36,  preset: 'bsl',     pitch: 0.0,  msg: '🏝️ Bờ Biển Dừa Nhiệt Đới' },
      mangrove:    { biome: BIOMES.MANGROVE_SWAMP,   needWater: false, time: 0.33,  preset: 'bliss',   pitch: -0.02,msg: '🐊 Đầm Lầy Rừng Ngập Mặn' },
      alpine:      { biome: BIOMES.ALPINE_PEAKS,     needWater: false, time: 0.36,  preset: 'bsl',     pitch: 0.04, msg: '🏔️ Dãy Núi Tuyết Cao & Băng Nén' },
      plateau:     { biome: BIOMES.HIGHLAND_PLATEAU, needWater: false, time: 0.34,  preset: 'bsl',     pitch: 0.0,  msg: '🦅 Cao Nguyên Hùng Vĩ' },
      sakura:      { biome: BIOMES.SAKURA,           needWater: true,  time: 0.31,  preset: 'bsl',     pitch: 0.0,  msg: '🌸 Hồ Anh Đào NUCRAFT' },
      village:     { biome: BIOMES.PLAINS,           needWater: false, time: 0.36,  preset: 'bsl',     pitch: -0.02,msg: '🏘️ Làng Builder Cổ Đại & Golem Sắt' },
      lush_cave:   { biome: BIOMES.LUSH_GROVE,       needWater: false, time: 0.34,  preset: 'bliss',   pitch: -0.04,msg: '💎 Hang Động Tươi Tốt & Warden' },
      autumn:      { biome: BIOMES.AUTUMN,           needWater: false, time: 0.33,  preset: 'bsl',     pitch: 0.0,  msg: '🍁 Rừng Mùa Thu Lá Đỏ' },
      autumn_camp: { biome: BIOMES.AUTUMN_DEEP,      needWater: false, time: 0.32,  preset: 'bsl',     pitch: 0.0,  msg: '⛺ Khu Trại Bỏ Hoang Rừng Thu Sâu' },
      autumn_golden:{ biome: BIOMES.AUTUMN_GOLDEN,   needWater: false, time: 0.34,  preset: 'bliss',   pitch: 0.0,  msg: '🍂 Rừng Thu Vàng Óng & Lá Rơi' },
      lush:        { biome: BIOMES.LUSH_GROVE,       needWater: true,  time: 0.38,  preset: 'bliss',   pitch: -0.01,msg: '🌿 Rừng Rêu Cổ Đại & Tàn Tích' },
      meadow:      { biome: BIOMES.FLOWER_MEADOW,    needWater: false, time: 0.35,  preset: 'bliss',   pitch: -0.02,msg: '🌼 Thảo Nguyên Hoa Rực Rỡ' },
      forest:      { biome: BIOMES.FOREST,           needWater: false, time: 0.29,  preset: 'bliss',   pitch: 0.01, msg: '🌲 Rừng Nắng & Tia Nắng' },
      desert:      { biome: BIOMES.DESERT,           needWater: false, time: 0.28,  preset: 'bsl',     pitch: 0.0,  msg: '🏜️ Sa Mạc Vàng & Đền Tháp Đôi' },
      snow:        { biome: BIOMES.SNOW,             needWater: false, time: 0.205, preset: 'moonlit', pitch: 0.03, msg: '❄️ Biệt Thự Tuyết 2 Tầng & Trăng Tròn' },
      tudor_estate:{ biome: BIOMES.PLAINS,           needWater: false, time: 0.30,  preset: 'bsl',     pitch: 0.0,  msg: '🏡 Biệt Thự Tudor Gạch Đỏ & Vườn Hoa' },
      manor_estate:{ biome: BIOMES.FOREST,           needWater: false, time: 0.33,  preset: 'bliss',   pitch: 0.02, msg: '🏰 Trang Viên Tudor Cổ Kính & Mê Cung Hàng Rào' },
      winter_cabin:{ biome: BIOMES.SNOW,             needWater: false, time: 0.205, preset: 'moonlit', pitch: 0.03, msg: '❄️ Tuyết Xá Gỗ Thông & Ống Khói' },
      starter_house:{ biome: BIOMES.FLOWER_MEADOW,   needWater: false, time: 0.32,  preset: 'bliss',   pitch: 0.0,  msg: '🌼 Nhà Khởi Đầu Giữa Đồng Hoa' },
      forest_cabin:{ biome: BIOMES.FOREST,           needWater: false, time: 0.31,  preset: 'bliss',   pitch: 0.01, msg: '🌲 Nhà Gỗ Trong Rừng & Vườn Lúa' },
      blue_forest: { biome: BIOMES.BLUE_FOREST,      needWater: false, time: 0.33,  preset: 'bsl',     pitch: 0.02, msg: '💙 Rừng Xanh Lam Huyền Ảo & Nấm Đỏ Khổng Lồ' },
      wheat_valley:{ biome: BIOMES.WHEAT_VALLEY,     needWater: false, time: 0.746, preset: 'chill_sunset', pitch: -0.02, msg: '🌾 Cánh Đồng Lúa' },
      pine_valley: { biome: BIOMES.PINE_VALLEY,      needWater: false, time: 0.34,  preset: 'bsl',     pitch: 0.03, msg: '🏡 Thung Lũng Thông & Lò Rèn Cổ Điển' },
      giant_jungle:{ biome: BIOMES.GIANT_JUNGLE,     needWater: true,  time: 0.35,  preset: 'bsl',     pitch: 0.03, msg: '🌴 Rừng Nhiệt Đới Đại Thụ & Dây Leo Rủ' },
      highland:    { biome: BIOMES.HIGHLAND_PLATEAU, needWater: false, time: 0.34,  preset: 'bsl',     pitch: 0.01, msg: '⛰️ Cao Nguyên Đá Dựng & Mây Trời' },
      lush_steppe: { biome: BIOMES.LUSH_STEPPE,      needWater: false, time: 0.32,  preset: 'bliss',   pitch: -0.01,msg: '🌿 Đồng Bằng Cỏ Xanh Mênh Mông' },
      green_plains:{ biome: BIOMES.GREEN_PLAINS,     needWater: false, time: 0.32,  preset: 'bsl',     pitch: -0.01,msg: '🌿 Đồng Bằng Cỏ Xanh Tươi Mát' },
      snowy_plains:{ biome: BIOMES.SNOWY_PLAINS,     needWater: true,  time: 0.31,  preset: 'bsl',     pitch: -0.02,msg: '❄️ Đồng Bằng Tuyết Trắng Bất Tận' },
      dark_forest: { biome: BIOMES.DARK_FOREST,      needWater: false, time: 0.36,  preset: 'moonlit', pitch: 0.01, msg: '🌑 Rừng Tối Cây Cổ Thụ Rậm Rạp' },
      pale_garden: { biome: BIOMES.PALE_GARDEN,      needWater: false, time: 0.38,  preset: 'moonlit', pitch: 0.01, msg: '🤍 Khu Rừng Nhợt Nhạt & Sương Mù Lạnh' },
      nightmare_woods:{ biome: BIOMES.NIGHTMARE_WOODS, needWater: false, time: 0.76, preset: 'moonlit', pitch: 0.02, msg: '🕸️ Khu Rừng Ác Mộng — Sương Mù Hạn Chế Tầm Nhìn!' },
      sulfur_springs:{ biome: BIOMES.SULFUR_SPRINGS, needWater: true, time: 0.33, preset: 'bsl', pitch: 0.01, msg: '🧪 Suối Lưu Huỳnh — Bậc Thềm Khoáng Vàng Ngọc Lam & Slime Lưu Huỳnh!' }
    };
    const cfg = mapCfg[targetKey]; if (!cfg) return;
    let found = null;
    // v45: Mỗi seed khi chọn cùng 1 Biome vẫn tìm tại vùng tọa độ ngẫu nhiên khác nhau!
    const _bHashA = Math.imul(worldSeed ^ 0x6c8e9cf5, 0x85ebca6b) >>> 0;
    const _bHashB = Math.imul(worldSeed ^ 0x1d872b41, 0x27d4eb2f) >>> 0;
    const ox = Math.floor(player.x) + ((_bHashA % 960) - 480);
    const oz = Math.floor(player.z) + ((_bHashB % 960) - 480);
    if (targetKey === 'wheat_valley' && typeof WHEAT_PLAIN_CX === 'number') {
      found = { x: WHEAT_PLAIN_CX + 0.5, z: WHEAT_PLAIN_CZ + 0.5, yaw: 0.0 };
    } else if (targetKey === 'castle_city') {
      found = { x: 12000.5, z: -11940.5, yaw: 0.0 };
    }
    if (targetKey === 'abyss_trench') {
      for (let r = 256; r <= 28000 && !found; r += 192) {
        for (let dz = -r; dz <= r && !found; dz += 192) for (let dx = -r; dx <= r && !found; dx += 192) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const wx = ox + dx, wz = oz + dz;
          const mac = getOceanMacro(wx, wz);
          if (!mac.isOcean) continue;
          if (getOceanIslandInfo(wx, wz, mac.openness)) continue;
          if (getOceanFloorTrueY(wx, wz, BIOMES.ABYSS_TRENCH) <= -280) {
            found = { x: wx + 0.5, z: wz + 0.5, yaw: 0.0 };
          }
        }
      }
      if (!found) {
        for (let r = 256; r <= 48000 && !found; r += 384) {
          for (let dz = -r; dz <= r && !found; dz += 384) for (let dx = -r; dx <= r && !found; dx += 384) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            const wx = ox + dx, wz = oz + dz;
            if (getOceanMacro(wx, wz).isOcean && getOceanFloorTrueY(wx, wz, BIOMES.ABYSS_TRENCH) <= -120) {
              found = { x: wx + 0.5, z: wz + 0.5, yaw: 0.0 };
            }
          }
        }
      }
    } else if (targetKey === 'ocean_ruins' || targetKey === 'mushroom') {
      for (let r = 64; r <= 12000 && !found; r += 96) {
        for (let dz = -r; dz <= r && !found; dz += 96) for (let dx = -r; dx <= r && !found; dx += 96) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const wx = ox + dx, wz = oz + dz, b = getBiomeAt(wx, wz);
          if (b !== cfg.biome) continue;
          if (targetKey === 'ocean_ruins') {
            const oy = getOceanFloorTrueY(wx, wz, b);
            if (oy <= -18 && oy >= -42) found = { x: wx + 0.5, z: wz + 0.5, yaw: 0.0 };
          } else if (getTerrainHeight(wx, wz, b) > WATER_LEVEL) {
            found = { x: wx + 0.5, z: wz + 0.5, yaw: sunYawAt(cfg.time) };
          }
        }
      }
    }
    for (let r = 8; r <= 1280 && !found && targetKey !== 'abyss_trench'; r += (r < 560 ? 8 : 32)) {
      const step = r < 560 ? 8 : 32;
      for (let dz = -r; dz <= r && !found; dz += step) for (let dx = -r; dx <= r && !found; dx += step) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const wx = ox + dx, wz = oz + dz, b = getBiomeAt(wx, wz);
        if (b !== cfg.biome) continue;
        const h = getTerrainHeight(wx, wz, b);
        if (targetKey === 'ocean_ruins') { if (h > WATER_LEVEL - 4) continue; }
        else if (targetKey === 'abyss_trench') { if (h > -24) continue; }
        else if (h <= WATER_LEVEL || h > MAX_Y - 12) continue;
        if (cfg.needWater) {
          if (targetKey === 'giant_jungle') {
            if (getBiomeAt(wx + 12, wz) !== BIOMES.GIANT_JUNGLE && getBiomeAt(wx - 12, wz) !== BIOMES.GIANT_JUNGLE) continue;
            if (getBiomeAt(wx, wz + 12) !== BIOMES.GIANT_JUNGLE && getBiomeAt(wx, wz - 12) !== BIOMES.GIANT_JUNGLE) continue;
            if (getBiomeAt(wx + 16, wz) === BIOMES.SAKURA || getBiomeAt(wx - 16, wz) === BIOMES.SAKURA || getBiomeAt(wx, wz + 16) === BIOMES.SAKURA || getBiomeAt(wx, wz - 16) === BIOMES.SAKURA) continue;
          }
          for (const [vx, vz] of [[6,0],[-6,0],[0,6],[0,-6],[8,8],[-8,-8]]) {
            if (getTerrainHeight(wx + vx, wz + vz, getBiomeAt(wx + vx, wz + vz)) <= WATER_LEVEL - 1) {
              if (targetKey === 'giant_jungle' && getBiomeAt(wx - vx, wz - vz) !== BIOMES.GIANT_JUNGLE) continue;
              found = { x: wx + 0.5, z: wz + 0.5, yaw: Math.atan2(-vx, -vz) };
              break;
            }
          }
        } else {
          const prefY = (targetKey === 'snow' || targetKey === 'winter_cabin') ? moonYawAt(cfg.time) : ((targetKey === 'village' || targetKey === 'castle_city' || targetKey === 'seaport' || targetKey === 'ocean_ruins' || targetKey === 'abyss_trench' || targetKey === 'pine_valley' || targetKey === 'wheat_valley') ? 0.0 : sunYawAt(cfg.time));
          const fx = -Math.sin(prefY), fz = -Math.cos(prefY);
          if (targetKey === 'snow' || targetKey === 'winter_cabin' || targetKey === 'snowy_plains') {
            const wantB = (targetKey === 'snowy_plains') ? BIOMES.SNOWY_PLAINS : BIOMES.SNOW;
            if (getBiomeAt(wx + 10, wz) !== wantB || getBiomeAt(wx - 10, wz) !== wantB ||
                getBiomeAt(wx, wz + 10) !== wantB || getBiomeAt(wx, wz - 10) !== wantB) continue;
            const x8 = wx + Math.round(fx * 9), z8 = wz + Math.round(fz * 9);
            const h8 = getTerrainHeight(x8, z8, getBiomeAt(x8, z8));
            if (targetKey !== 'snowy_plains' && (h8 <= WATER_LEVEL || Math.abs(h8 - h) > 5)) continue;
            if (targetKey === 'snowy_plains' && Math.abs(h8 - h) > 6) continue;
          } else if (targetKey === 'green_plains') {
            if (getBiomeAt(wx + 12, wz) !== BIOMES.GREEN_PLAINS || getBiomeAt(wx - 12, wz) !== BIOMES.GREEN_PLAINS ||
                getBiomeAt(wx, wz + 12) !== BIOMES.GREEN_PLAINS || getBiomeAt(wx, wz - 12) !== BIOMES.GREEN_PLAINS) continue;
          } else if (targetKey === 'blue_forest') {
            if (getBiomeAt(wx + 12, wz) !== BIOMES.BLUE_FOREST || getBiomeAt(wx - 12, wz) !== BIOMES.BLUE_FOREST ||
                getBiomeAt(wx, wz + 12) !== BIOMES.BLUE_FOREST || getBiomeAt(wx, wz - 12) !== BIOMES.BLUE_FOREST) continue;
            if (getTerrainHeight(wx + 8, wz, BIOMES.BLUE_FOREST) <= WATER_LEVEL || getTerrainHeight(wx - 8, wz, BIOMES.BLUE_FOREST) <= WATER_LEVEL) continue;
          } else if (targetKey === 'pine_valley') {
            if (getBiomeAt(wx + 12, wz) !== BIOMES.PINE_VALLEY || getBiomeAt(wx - 12, wz) !== BIOMES.PINE_VALLEY ||
                getBiomeAt(wx, wz + 8) !== BIOMES.PINE_VALLEY || getBiomeAt(wx, wz - 22) !== BIOMES.PINE_VALLEY) continue;
          } else if (targetKey === 'wheat_valley') {
            if (getBiomeAt(wx + 14, wz) !== BIOMES.WHEAT_VALLEY || getBiomeAt(wx - 14, wz) !== BIOMES.WHEAT_VALLEY ||
                getBiomeAt(wx, wz + 10) !== BIOMES.WHEAT_VALLEY || getBiomeAt(wx, wz - 24) !== BIOMES.WHEAT_VALLEY) continue;
          } else if (targetKey !== 'sulfur_springs' && targetKey !== 'village' && targetKey !== 'castle_city' && targetKey !== 'seaport' && targetKey !== 'ocean_ruins' && targetKey !== 'abyss_trench') {
            let blocked = false;
            for (const d of [8, 16, 24]) {
              const ax = wx + Math.round(fx * d), az = wz + Math.round(fz * d);
              if (getTerrainHeight(ax, az, getBiomeAt(ax, az)) > h + 3) { blocked = true; break; }
            }
            if (blocked) continue;
          }
          found = { x: wx + 0.5, z: wz + 0.5, yaw: prefY };
        }
      }
    }
    if (!found && targetKey !== 'abyss_trench' && targetKey !== 'ocean_ruins' && targetKey !== 'mushroom') {
      const prefY = (targetKey === 'snow' || targetKey === 'winter_cabin') ? moonYawAt(cfg.time)
        : ((targetKey === 'village' || targetKey === 'castle_city' || targetKey === 'seaport' || targetKey === 'pine_valley' || targetKey === 'wheat_valley') ? 0.0 : sunYawAt(cfg.time));
      for (let r = 64; r <= 6400 && !found; r += 48) {
        for (let dz = -r; dz <= r && !found; dz += 48) for (let dx = -r; dx <= r && !found; dx += 48) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const wx = ox + dx, wz = oz + dz, b = getBiomeAt(wx, wz);
          if (b !== cfg.biome) continue;
          const h = getTerrainHeight(wx, wz, b);
          if (h > WATER_LEVEL && h <= MAX_Y - 12) found = { x: wx + 0.5, z: wz + 0.5, yaw: prefY };
        }
      }
    }
    if (!found) {
      const sp = findSafeSpawnPoint(ox, oz, false);
      found = { x: sp.x, z: sp.z, yaw: sp.yaw };
    }
    const _flushDirtyIfDirect = () => {
      if (!isWorldLoading) {
        for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
      }
    };
    let clean;
    if (targetKey === 'abyss_trench' || targetKey === 'ocean_ruins') {
      const fcx = Math.floor(found.x) >> 4, fcz = Math.floor(found.z) >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const k = chunkKey(fcx + dx, fcz + dz);
        if (!chunks.has(k)) generateChunk(fcx + dx, fcz + dz);
      }
      clean = { x: found.x, y: -12, z: found.z, yaw: found.yaw || 0 };
    } else {
      clean = landPlayerScenic(found.x, found.z, found.yaw);
    }
    if (targetKey === 'sakura') ensureScenicSakuraAcrossLake(clean);
    if (targetKey === 'sulfur_springs' && typeof spawnMobOfType === 'function') {
      const lx = Math.floor(clean.x) - Math.sin(clean.yaw || 0) * 6, lz = Math.floor(clean.z) - Math.cos(clean.yaw || 0) * 6;
      const sy1 = Math.max(WATER_LEVEL + 1, colGroundY(Math.floor(lx + 2), Math.floor(lz + 2))) + 1.1;
      const sy2 = Math.max(WATER_LEVEL + 1, colGroundY(Math.floor(lx - 3), Math.floor(lz - 1))) + 1.1;
      spawnMobOfType('sulfur_slime', lx + 2.5, sy1, lz + 2.5);
      spawnMobOfType('sulfur_slime', lx - 2.5, sy2, lz - 1.5);
    }
    if (targetKey === 'blue_forest') {
      ensureScenicBlueForestView(clean);
      _flushDirtyIfDirect();
    }
    if (targetKey === 'giant_jungle') {
      ensureScenicGiantJungleView(clean);
      _flushDirtyIfDirect();
    }
    if (targetKey === 'pine_valley') {
      const cx0 = Math.round(clean.x), cz0 = Math.round(clean.z - 18);
      const cy0 = buildNordicSmithyCottage(cx0, cz0);
      clean.x = cx0 - 2.0; clean.z = cz0 + 17.5; clean.y = Math.max(cy0 + 1.2, colGroundY(cx0 - 2, cz0 + 17) + 1.2); clean.yaw = -0.11;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'wheat_valley') {
      const targetX = (typeof WHEAT_PLAIN_CX === 'number') ? WHEAT_PLAIN_CX : Math.round(clean.x);
      const targetZ = (typeof WHEAT_PLAIN_CZ === 'number') ? WHEAT_PLAIN_CZ : Math.round(clean.z);
      const wcx = targetX >> 4, wcz = (targetZ - 34) >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!chunks.has(chunkKey(wcx + dx, wcz + dz))) generateChunk(wcx + dx, wcz + dz);
      }
      clean.x = targetX + 0.5; clean.z = targetZ + 0.5;
      clean.y = Math.max(WATER_LEVEL + 2, colGroundY(targetX, targetZ) + 1.2); clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'ancient_ruins') {
      const rx0 = Math.round(clean.x), rz0 = Math.round(clean.z - 12);
      const ry0 = buildMysteriousRuins(rx0, rz0);
      clean.x = rx0 + 0.5; clean.z = rz0 + 13.5; clean.y = colGroundY(Math.floor(clean.x), Math.floor(clean.z)) + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'castle_city') {
      const cx0 = Math.round(clean.x), cz0 = Math.round(clean.z - 14);
      const cy0 = buildGrandCastleCity(cx0, cz0);
      // Spawn safely ON TOP of the grand stone castle courtyard facing the Royal Castle Keep!
      clean.x = cx0 + 0.5; clean.z = cz0 + 15.5; clean.y = cy0 + 1.2; clean.yaw = 0.0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        setBlockWorld(cx0 + dx, cy0, cz0 + 15 + dz, B.STONE_BRICK, true);
        for (let hy = 1; hy <= 5; hy++) setBlockWorld(cx0 + dx, cy0 + hy, cz0 + 15 + dz, B.AIR, true);
      }
      _flushDirtyIfDirect();
    }
    if (targetKey === 'seaport') {
      const px0 = Math.round(clean.x), pz0 = Math.round(clean.z);
      const py0 = buildSeaportAndShips(px0, pz0);
      clean.x = px0 + 0.5; clean.z = pz0 + 3.5; clean.y = py0 + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'ocean_ruins') {
      const ox0 = Math.round(clean.x), oz0 = Math.round(clean.z);
      buildUnderwaterRuinsAndShipwreck(ox0, oz0);
      clean.x = ox0 + 0.5; clean.z = oz0 + 9.5; clean.y = WATER_LEVEL - 4.2; clean.yaw = 0.0;
      player.waterBreathT = Math.max(player.waterBreathT, 120.0);
      _flushDirtyIfDirect();
    }
    if (targetKey === 'abyss_trench') {
      const ax0 = Math.round(clean.x), az0 = Math.round(clean.z);
      const flTrueY = getOceanFloorTrueY(ax0, az0, BIOMES.ABYSS_TRENCH);
      clean.x = ax0 + 0.5; clean.z = az0 + 0.5; clean.y = -18.0; clean.yaw = -0.36;
      player.waterBreathT = Math.max(player.waterBreathT, 300.0);
      // Glowing deep-sea dive sanctuary offset forward-right so column below player is 100% unobstructed open water down to -700m!
      const sx0 = ax0 + 4, sz0 = az0 - 9, bY = -23;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        setBlockWorld(sx0 + dx, bY, sz0 + dz, edge ? B.PRISMARINE : B.SEA_LANTERN, true);
        if (edge && ((dx + dz) & 1) === 0) setBlockWorld(sx0 + dx, bY + 1, sz0 + dz, B.GLOW_CRYSTAL, true);
      }
      setBlockWorld(sx0 - 1, bY + 1, sz0, B.CORAL_PINK, true);
      setBlockWorld(sx0 + 1, bY + 1, sz0, B.CORAL_BLUE, true);
      spawnMobOfType('glow_squid', ax0 + 2.0, -19.5, az0 - 6.0);
      spawnMobOfType('ocean_barnacle', ax0 + 4.5, -21.0, az0 - 8.5);
      spawnMobOfType('anglerfish', ax0 + 1.5, -18.5, az0 - 8.0);
      spawnMobOfType('whale_blue', ax0 + 6.5, -16.0, az0 - 13.0);
      spawnMobOfType('shark_white', ax0 - 3.5, -17.0, az0 - 10.5);
      spawnMobOfType('tropical_fish', ax0 + 2.5, -17.5, az0 - 5.5);
      cfg.msg = `🌊 Vực Biển Siêu Sâu (Đáy biển ${flTrueY}m / -700m) — Nhấn Shift để lặn sâu xuống vực tối!`;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'beach_palm') {
      const bx0 = Math.round(clean.x), bz0 = Math.round(clean.z);
      for (const [spId, dx, dz] of [['crab_red', 3, -4], ['parrot_red', -3, -5], ['monkey_palm', 5, -3], ['marine_dolphin', 0, -10]]) {
        const sp = ANIMAL_MAP.get(spId);
        spawnMobOfType(spId, bx0 + dx, sp && sp.aqua ? WATER_LEVEL - 1.4 : (sp && sp.fly ? clean.y + 4.5 : clean.y + 0.5), bz0 + dz);
      }
    }
    if (targetKey === 'mangrove') {
      const mx0 = Math.round(clean.x), mz0 = Math.round(clean.z);
      for (const [spId, dx, dz] of [['crocodile', 4, -6], ['frog_green', -2, -4], ['heron', 2, -5], ['capybara', -4, -5]]) {
        spawnMobOfType(spId, mx0 + dx, colGroundY(mx0 + dx, mz0 + dz) + 1.2, mz0 + dz);
      }
    }
    if (targetKey === 'alpine') {
      const ax0 = Math.round(clean.x), az0 = Math.round(clean.z);
      for (const [spId, dx, dz] of [['snow_leopard', 4, -6], ['mountain_goat', -4, -5], ['polar_bear', 1, -8], ['penguin', -2, -4]]) {
        spawnMobOfType(spId, ax0 + dx, colGroundY(ax0 + dx, az0 + dz) + 1.2, az0 + dz);
      }
    }
    if (targetKey === 'plateau') {
      const hx0 = Math.round(clean.x), hz0 = Math.round(clean.z);
      for (const [spId, dx, dz] of [['eagle_golden', 2, -7], ['wild_horse', -4, -6], ['llama', 5, -5], ['giraffe', -2, -9]]) {
        const sp = ANIMAL_MAP.get(spId);
        spawnMobOfType(spId, hx0 + dx, sp && sp.fly ? clean.y + 6.5 : colGroundY(hx0 + dx, hz0 + dz) + 1.2, hz0 + dz);
      }
    }
    if (targetKey === 'village') {
      const vx = Math.round(clean.x), vz = Math.round(clean.z - 8);
      buildVillage(vx, vz);
      clean.x = vx + 0.5; clean.z = vz + 6.8; clean.yaw = 0.0;
      clean.y = colGroundY(Math.floor(clean.x), Math.floor(clean.z)) + 1.1;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'lush_cave') {
      const gx = Math.round(clean.x), gz = Math.round(clean.z);
      const floorY = buildLushCaveGrotto(gx, gz);
      clean.x = gx + 0.5; clean.z = gz + 5.8; clean.y = floorY + 0.5; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'lush') {
      const rx = Math.round(clean.x - Math.sin(clean.yaw) * 10), rz = Math.round(clean.z - Math.cos(clean.yaw) * 10);
      buildMossyPondRuins(rx, rz);
      _flushDirtyIfDirect();
    }
    if (targetKey === 'desert') {
      const tx = Math.round(clean.x - Math.sin(clean.yaw) * 15), tz = Math.round(clean.z - Math.cos(clean.yaw) * 15);
      buildDesertTemple(tx, tz);
      _flushDirtyIfDirect();
    }
    if (targetKey === 'snow') {
      const cabYaw = clean.yaw + 0.25;
      const bx = Math.round(clean.x - Math.sin(cabYaw) * 9), bz = Math.round(clean.z - Math.cos(cabYaw) * 9);
      buildTimberManor(bx, bz, 1, 'small');
      clean.yaw = clean.yaw + 0.08;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'tudor_estate') {
      const hx0 = Math.round(clean.x), hz0 = Math.round(clean.z - 14);
      buildTimberManor(hx0, hz0, 1, 'large');
      clean.x = hx0 + 0.5; clean.z = hz0 + 12.5; clean.y = colGroundY(hx0, hz0 + 12) + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'manor_estate') {
      const hx0 = Math.round(clean.x), hz0 = Math.round(clean.z - 14);
      buildTimberManor(hx0, hz0, 1, 'large');
      clean.x = hx0 + 0.5; clean.z = hz0 + 13.5; clean.y = colGroundY(hx0, hz0 + 13) + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'winter_cabin') {
      const hx0 = Math.round(clean.x), hz0 = Math.round(clean.z - 14);
      buildTimberManor(hx0, hz0, 1, 'small');
      clean.x = hx0 + 0.5; clean.z = hz0 + 12.5; clean.y = colGroundY(hx0, hz0 + 12) + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'starter_house') {
      const hx0 = Math.round(clean.x), hz0 = Math.round(clean.z - 14);
      buildTimberManor(hx0, hz0, 1, 'medium');
      clean.x = hx0 + 0.5; clean.z = hz0 + 11.5; clean.y = colGroundY(hx0, hz0 + 11) + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'forest_cabin') {
      const hx0 = Math.round(clean.x), hz0 = Math.round(clean.z - 14);
      buildTimberManor(hx0, hz0, 1, 'medium');
      clean.x = hx0 + 0.5; clean.z = hz0 + 12.5; clean.y = colGroundY(hx0, hz0 + 12) + 1.2; clean.yaw = 0.0;
      _flushDirtyIfDirect();
    }
    if (targetKey === 'tudor_estate' || targetKey === 'winter_cabin' || targetKey === 'starter_house' || targetKey === 'forest_cabin') {
      const sx = Math.floor(clean.x), sy = Math.floor(clean.y), sz = Math.floor(clean.z);
      for (let dy = 0; dy <= 4; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setBlockWorld(sx + dx, sy + dy, sz + dz, B.AIR, true);
    }
    player.x = clean.x; player.y = clean.y; player.z = clean.z;
    player.yaw = clean.yaw; player.pitch = cfg.pitch;
    player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = clean.y;
    lastPlayerCx = 99999; lastPlayerCz = 99999;
    if (shaderPreset !== 'eclipse' && !(opts && opts.preserveShader)) applyShaderPreset(cfg.preset);
    dayTime = cfg.time;
    document.querySelectorAll('#timeSeg .seg-btn').forEach(b => b.classList.toggle('active', Math.abs(parseFloat(b.dataset.time) - cfg.time) < 0.03));
    if (!isWorldLoading) startPlaying();
    // (không thông báo khi vào map)
    });
  }

  document.getElementById('btnPlay').addEventListener('click', startPlaying);
  document.getElementById('btnMenu').addEventListener('click', openMenu);
  document.getElementById('btnSave').addEventListener('click', () => { ensureAudio(); saveWorld(); });
  document.getElementById('btnToggleTouch').addEventListener('click', () => { _userManuallyToggledTouch = true; showMobileControls = !showMobileControls; syncMobileControls(); applyHudLayout(); showToast(showMobileControls ? 'Đã bật nút Mobile' : 'Đã ẩn nút Mobile'); });
  document.getElementById('btnResetWorld').addEventListener('click', () => {
    const mm = document.getElementById('menuModal');
    if (mm.classList.contains('hidden')) return;
    mm.classList.add('hidden');
    mm.classList.remove('from-lobby', 'pause-mode');
    document.body.classList.remove('in-menu');
    showWorldLoadingOverlay(
      'Đang tạo bản đồ mới...',
      'Đang kiến tạo địa hình và dựng khối 3D...',
      () => {
        try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
        resetWorld();
      }
    );
  });
  document.getElementById('btnRespawn').addEventListener('click', () => {
    // Authentic Minecraft Respawn: NEVER wipe mobs or death-dropped items in Overworld!
    const finishRespawn = () => {
      let validBed = null;
      if (player.bedSpawn && Number.isFinite(player.bedSpawn.x) && Number.isFinite(player.bedSpawn.z)) {
        const bs = player.bedSpawn;
        const bDim = bs.dim || 'overworld';
        if (bDim === currentDimension) {
          const bx = bs.bx !== undefined ? bs.bx : Math.floor(bs.x);
          const bz = bs.bz !== undefined ? bs.bz : Math.floor(bs.z);
          const bTrueY = typeof bs.trueY === 'number' ? bs.trueY : (Math.floor(bs.y - 1.2) - (bs.depthOffset || 0));
          const checkLy = bTrueY + (depthOffset || 0);
          const bcx = bx >> 4, bcz = bz >> 4;
          if (!chunks.has(chunkKey(bcx, bcz))) generateChunk(bcx, bcz);
          const blkAt = (checkLy > MIN_Y && checkLy <= MAX_Y) ? getBlockWorld(bx, checkLy, bz) : 0;
          if (blkAt === B.BED || blkAt === B.BED_FOOT) {
            validBed = { x: bs.x, y: checkLy + 1.2, z: bs.z, yaw: bs.yaw };
          } else {
            player.bedSpawn = null;
            showToast('🛏️ Giường của bạn đã bị phá hoặc không còn tồn tại! Hồi sinh về điểm gốc.');
          }
        }
      }
      const targetSp = validBed || window._worldSpawnPos || findSafeSpawnPoint(8, 8, true);
      player.x = targetSp.x; player.y = targetSp.y; player.z = targetSp.z;
      if (targetSp.yaw !== undefined) player.yaw = targetSp.yaw;
      player.pitch = 0.0;
      player.vx = 0; player.vy = 0; player.vz = 0;
      player.fallStartY = player.y;
      player.flying = false;
      player.hp = 20; player.hunger = 20; player.air = player.maxAir; player.dead = false; player.inBoat = false;
      player.eyesInWater = false; player.inWater = false; player.eyesInLava = false; player.inLava = false; player.deepWater = false; drownTick = 0; player.burnTime = 0; player._stepCamOff = 0;
      if (typeof _elUnderwater !== 'undefined' && _elUnderwater) { _elUnderwater.classList.remove('active'); _lastEyesInWater = false; }
      if (typeof _elLava !== 'undefined' && _elLava) { _elLava.classList.remove('active'); _lastEyesInLava = false; }
      if (typeof _elFireHud !== 'undefined' && _elFireHud) { _elFireHud.classList.remove('active'); _lastFireHudOn = false; }
      document.getElementById('airRow')?.classList.remove('visible');
      player.invuln = 2.5;
      renderStatusBars(); renderHotbar();
      if (!isWorldLoading) startPlaying();
      showToast('✨ Đã hồi sinh! Quái vật và vật phẩm rơi vẫn còn nguyên tại vị trí cũ!');
    };
    if (currentDimension !== 'overworld' || depthOffset !== 0) {
      document.getElementById('deathModal')?.classList.add('hidden');
      showWorldLoadingOverlay(
        'Đang hồi sinh về Thế Giới Chính...',
        'Đang tải lại địa hình điểm hồi sinh...',
        () => {
          switchDimension('overworld', '✨ Đã hồi sinh tại Thế Giới Chính!');
          finishRespawn();
        }
      );
    } else {
      finishRespawn();
    }
  });

  document.querySelectorAll('#renderDistSeg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#renderDistSeg .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); renderDistance = parseInt(btn.dataset.val, 10); lastPlayerCx = 99999;
      if (CFG.saveGfxPrefs) CFG.saveGfxPrefs({ renderDistance });
      showToast(`Tầm nhìn: ${btn.textContent}`);
    });
  });
  document.querySelectorAll('#qualitySeg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#qualitySeg .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); applyQualitySetting(btn.dataset.val, true);
      showToast(`Đồ họa: ${btn.textContent}`);
    });
  });
  document.querySelectorAll('#frameGenSeg .seg-btn').forEach(btn => {
    const fg = parseInt(btn.dataset.fg, 10) || 1;
    btn.classList.toggle('active', ((sodiumOpts.frameGen | 0) || 1) === fg);
    btn.addEventListener('click', () => {
      sodiumOpts.frameGen = fg;
      saveSodiumOpts();
      document.querySelectorAll('#frameGenSeg .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (typeof window._fgReset === 'function') window._fgReset();
      if (typeof resizeViewport === 'function') resizeViewport();
      showToast(`AI Frame Ảo: ${fg > 1 ? 'x' + fg + ' (Tăng FPS + Làm Nét)' : 'Tắt (x1)'}`);
    });
  });
  document.querySelectorAll('#presetSeg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyShaderPreset(btn.dataset.preset, true);
      showToast(`Shader: ${btn.textContent}`);
    });
  });
  const _rtBtn = document.getElementById('btnRayTracing');
  if (_rtBtn) {
    const _syncRtBtn = () => {
      const on = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
      _rtBtn.classList.toggle('active', on);
      _rtBtn.textContent = on ? tr('BẬT', 'ON') : tr('TẮT', 'OFF');
      if (typeof envUniforms !== 'undefined' && envUniforms.uRayTracing) envUniforms.uRayTracing.value = on ? 1.0 : 0.0;
      if (on) window._rtVolDirty = true;
    };
    _syncRtBtn();
    _rtBtn.addEventListener('click', () => {
      sodiumOpts.rayTracing = !sodiumOpts.rayTracing;
      saveSodiumOpts();
      _syncRtBtn();
      window._rtVolDirty = true;
      if (typeof applyQualitySetting === 'function') applyQualitySetting(shaderQuality, false);
      if (typeof updateRayTracingVoxelVolume === 'function') updateRayTracingVoxelVolume(true);
      window._postFxDirty = true;
      if (typeof window._fgReset === 'function') window._fgReset();
      showToast(sodiumOpts.rayTracing ? tr('✨ Ray Tracing 3D: ĐÃ BẬT', '✨ 3D Ray Tracing: ON') : tr('✨ Ray Tracing 3D: ĐÃ TẮT', '✨ 3D Ray Tracing: OFF'));
    });
  }
  document.getElementById('btnCloudMode').addEventListener('click', (e) => {
    volumetricClouds = !volumetricClouds;
    e.currentTarget.classList.toggle('active', volumetricClouds);
    e.currentTarget.textContent = volumetricClouds ? tr('☁️ Mây Volumetric', '☁️ Volumetric Clouds') : tr('🧊 Mây Khối Luanti', '🧊 Luanti Block Clouds');
    if (CFG.saveGfxPrefs) CFG.saveGfxPrefs({ volumetricClouds });
    showToast(volumetricClouds ? tr('Đã bật Mây Volumetric 3D', 'Volumetric 3D Clouds enabled') : tr('Đã bật Mây Khối Luanti', 'Luanti Block Clouds enabled'));
  });
  document.getElementById('btnTexFilter').addEventListener('click', () => {
    applyBumpToggle(!bumpEnabled);
    if (CFG.saveGfxPrefs) CFG.saveGfxPrefs({ bumpEnabled });
    showToast(bumpEnabled ? tr('Bump Relief PBR: Đã bật', 'Bump Relief PBR: On') : tr('Pixel-Art Phẳng Cổ Điển', 'Classic Flat Pixel-Art'));
  });
  document.querySelectorAll('#scenicSeg .spawn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!document.getElementById('menuModal').classList.contains('hidden')) {
        const scKey = btn.dataset.scenic;
        const scLabel = btn.textContent.trim();
        document.getElementById('menuModal').classList.add('hidden');
        showWorldLoadingOverlay(
          'Đang tải khu vực mới...',
          `Đang tạo địa hình và dựng khối 3D tại "${scLabel}"...`,
          () => teleportToScenicBiome(scKey)
        );
      }
    });
  });
  function syncTimeWeatherAdminLocks() {
    const unlocked = (typeof isAdminUnlocked !== 'undefined' && !!isAdminUnlocked);
    const tSeg = document.getElementById('timeSeg');
    const cRow = document.getElementById('clockEditorRow');
    const wSeg = document.getElementById('weatherSeg');
    const inpClk = document.getElementById('inpExactClock');
    const tBadge = document.getElementById('timeLockBadge');
    const wBadge = document.getElementById('weatherLockBadge');
    if (tSeg) tSeg.classList.toggle('admin-locked', !unlocked);
    if (cRow) cRow.classList.toggle('admin-locked', !unlocked);
    if (wSeg) wSeg.classList.toggle('admin-locked', !unlocked);
    if (inpClk) {
      inpClk.readOnly = !unlocked;
      inpClk.tabIndex = unlocked ? 0 : -1;
      inpClk.title = unlocked
        ? tr('Chỉnh giờ chính xác (HH:MM)', 'Set exact world time (HH:MM)')
        : tr('Giờ hiện tại (Mở khóa Admin để chỉnh)', 'Current time (Unlock Admin to edit)');
    }
    const badgeTxt = unlocked ? tr('👑 Admin', '👑 Admin') : tr('🔒 Chỉ xem', '🔒 View Only');
    if (tBadge) tBadge.textContent = badgeTxt;
    if (wBadge) wBadge.textContent = badgeTxt;
    if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
  }
  window.syncTimeWeatherAdminLocks = syncTimeWeatherAdminLocks;

  document.querySelectorAll('#timeSeg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof isAdminUnlocked === 'undefined' || !isAdminUnlocked) {
        if (typeof playUiLockedSfx === 'function') playUiLockedSfx();
        showToast(tr('🔒 Chỉ Admin mới có thể chỉnh thời gian & thời tiết!', '🔒 Unlock Admin to change time & weather!'));
        return;
      }
      dayTime = parseFloat(btn.dataset.time);
      if (typeof updateAtmosphere === 'function') updateAtmosphere(0.016);
      if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
      showToast(tr(`🕒 Đã chuyển thời gian: ${btn.textContent}`, `🕒 Time set to: ${btn.textContent}`));
    });
  });
  {
    const inpClk = document.getElementById('inpExactClock');
    const applyExactClockVal = () => {
      if (typeof isAdminUnlocked === 'undefined' || !isAdminUnlocked) {
        if (typeof playUiLockedSfx === 'function') playUiLockedSfx();
        showToast(tr('🔒 Chỉ Admin mới có thể chỉnh giờ thế giới!', '🔒 Unlock Admin to set world clock!'));
        if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
        return;
      }
      const m = /^(\d{1,2}):(\d{2})$/.exec((inpClk?.value || '').trim());
      if (!m) return;
      const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
      const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
      dayTime = ((hh * 60 + mm) / 1440) % 1.0;
      if (typeof updateAtmosphere === 'function') updateAtmosphere(0.016);
      if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
      if (typeof playUiClickSfx === 'function') playUiClickSfx();
      const pad = (v) => (v < 10 ? '0' + v : '' + v);
      showToast(tr(`🕒 Đã đặt đồng hồ thành ${pad(hh)}:${pad(mm)}`, `🕒 World clock set to ${pad(hh)}:${pad(mm)}`));
    };
    inpClk?.addEventListener('change', applyExactClockVal);
    inpClk?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyExactClockVal(); inpClk.blur(); } });
    inpClk?.addEventListener('pointerdown', (e) => {
      if (typeof isAdminUnlocked === 'undefined' || !isAdminUnlocked) {
        e.preventDefault();
        if (typeof playUiLockedSfx === 'function') playUiLockedSfx();
        showToast(tr('🔒 Chỉ Admin mới có thể chỉnh thời gian & thời tiết!', '🔒 Unlock Admin to change time & weather!'));
      }
    });
  }
  document.querySelectorAll('#weatherSeg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof isAdminUnlocked === 'undefined' || !isAdminUnlocked) {
        if (typeof playUiLockedSfx === 'function') playUiLockedSfx();
        showToast(tr('🔒 Chỉ Admin mới có thể chỉnh thời gian & thời tiết!', '🔒 Unlock Admin to change time & weather!'));
        return;
      }
      weatherMode = btn.dataset.weather;
      if (typeof updateWeatherAndLights === 'function') updateWeatherAndLights(0.016);
      if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
      if (typeof broadcastWeatherSync === 'function') broadcastWeatherSync(weatherMode, (typeof activeWeatherKind === 'string' && activeWeatherKind) ? activeWeatherKind : weatherMode);
      showToast(tr(`🌦️ Thời tiết: ${btn.textContent}`, `🌦️ Weather: ${btn.textContent}`));
    });
  });
  function applyRemoteWeatherSync(w) {
    if (!w) return;
    if (typeof w.weatherMode === 'string') weatherMode = w.weatherMode;
    if (typeof w.activeWeatherKind === 'string' && w.activeWeatherKind) {
      activeWeatherKind = w.activeWeatherKind;
      if (typeof autoWeatherTarget !== 'undefined') autoWeatherTarget = (w.activeWeatherKind === 'clear' || w.activeWeatherKind === 'meteor' || w.activeWeatherKind === 'aurora') ? 0 : (w.activeWeatherKind === 'drizzle' ? 0.40 : 1);
    }
    if (typeof updateWeatherAndLights === 'function') updateWeatherAndLights(0.016);
    if (typeof syncLiveTimeAndWeatherUi === 'function') syncLiveTimeAndWeatherUi(true);
  }
  document.querySelectorAll('#sodiumExtraSeg .seg-btn').forEach(btn => {
    const key = btn.dataset.sopt;
    if (key && sodiumOpts[key] !== undefined) btn.classList.toggle('active', !!sodiumOpts[key]);
    btn.addEventListener('click', () => {
      if (!key) return;
      sodiumOpts[key] = !sodiumOpts[key];
      btn.classList.toggle('active', !!sodiumOpts[key]);
      saveSodiumOpts();
      if (key === 'moreCulling' || key === 'fastLight') {
        markAllLoadedChunksDirty(true);
      }
      if (key === 'entityCulling' && !sodiumOpts.entityCulling) {
        for (let i = 0; i < mobs.length; i++) if (mobs[i] && mobs[i].group) mobs[i].group.visible = true;
      }
      if (key === 'sharpness' && envUniforms.uSharpness) {
        envUniforms.uSharpness.value = (typeof getPresetSharpness === 'function') ? getPresetSharpness(shaderPreset) : (sodiumOpts.sharpness ? 0.19 : 0.0);
      }
      if (key === 'smoothShadows') {
        const effUltra = (shaderQuality === 'ultra' || shaderQuality === 'extreme' || !!sodiumOpts.rayTracing);
        renderer.shadowMap.type = (effUltra && !_initMobile && sodiumOpts.smoothShadows) ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
        renderer.shadowMap.needsUpdate = true;
      }
      if (key === 'waterRefl' && envUniforms.uUsePlanarRefl) {
        envUniforms.uUsePlanarRefl.value = sodiumOpts.waterRefl ? 1.0 : 0.0;
      }
      if (key === 'waterQuality' && envUniforms.uWaterQuality) {
        envUniforms.uWaterQuality.value = sodiumOpts.waterQuality ? 1.0 : 0.0;
      }
      if (key === 'autoPerf' && !sodiumOpts.autoPerf) {
        _autoPerfLow = false;
        _autoPerfTier = 0;
        _autoPerfStreak = 0;
        _autoPerfUpStreak = 0;
        if (envUniforms.uWaterQuality) envUniforms.uWaterQuality.value = sodiumOpts.waterQuality !== false ? 1.0 : 0.0;
        if (_autoPerfPrScale !== 1.0) {
          _autoPerfPrScale = 1.0;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _getSharpMaxPR(shaderQuality)));
          resizeViewport();
        }
      }
      if (key === 'weatherFx' && !sodiumOpts.weatherFx && typeof weatherLines !== 'undefined') {
        weatherLines.visible = false;
      }
      if (key === 'particles' && !sodiumOpts.particles) {
        particles.length = 0;
        if (typeof _partInstMesh !== 'undefined') _partInstMesh.count = 0;
        if (typeof smokeVoxels !== 'undefined') smokeVoxels.length = 0;
        if (typeof _smokeInstMesh !== 'undefined') _smokeInstMesh.count = 0;
      }
      if (key === 'clouds' || key === 'fog') {
        try { updateAtmosphere(0.016); } catch (_) {}
      }
      if (key === 'sodium') {
        if (typeof _postFxDirty !== 'undefined') _postFxDirty = true;
        if (renderer) renderer.toneMapping = (typeof _useDirectRender === 'function' && _useDirectRender()) ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        if (renderer && renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
      }
      if (key === 'modernFix') {
        window._hudTxtChanged = true;
      }
      showToast(`${btn.textContent.trim()}: ${sodiumOpts[key] ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}`);
    });
  });
  document.querySelectorAll('[data-fpstarget]').forEach(btn => {
    const tVal = Number(btn.dataset.fpstarget) || 0;
    btn.classList.toggle('active', (Number(sodiumOpts.fpsTarget) || 0) === tVal);
    btn.addEventListener('click', () => {
      sodiumOpts.fpsTarget = tVal;
      saveSodiumOpts();
      document.querySelectorAll('[data-fpstarget]').forEach(b => b.classList.toggle('active', (Number(b.dataset.fpstarget) || 0) === tVal));
      showToast(`🎯 Giới hạn FPS: ${tVal > 0 ? tVal + ' FPS' : 'MAX (Không giới hạn)'}`);
    });
  });
  document.querySelectorAll('#mobSpawnSeg .spawn-btn, #animalSpawnSeg .spawn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameMode === 'survival' && !isAdminUnlocked) {
        showToast('🔒 Tính năng triệu hồi Động vật & Quái vật bị khóa trong chế độ Sinh tồn!');
        return;
      }
      const mType = btn.dataset.mob;
      if (mType === 'v70_cute_pack' || mType === 'v70_hostile_pack' || mType === 'mobvote_pack' || mType === 'pastel_pack') {
        const list = (mType === 'v70_cute_pack')
          ? ['moobloom', 'cluckshroom', 'cinnamon_ferret', 'copper_golem', 'tuff_golem', 'wooly_cow', 'blue_crab', 'baby_ghast']
          : (mType === 'mobvote_pack')
            ? ['sniffer', 'savanna_monkey', 'meerkat', 'pink_dolphin', 'vulture', 'ostrich', 'moss_golem', 'rascal', 'armadillo', 'ocean_barnacle']
            : (mType === 'pastel_pack')
              ? ['plush_slime_mint', 'plush_strawberry_slime', 'plush_allay_lavender', 'plush_zombie_chibi', 'plush_creeper_blossom', 'plush_enderman_ribbon', 'plush_bear_teal', 'plush_panda_berry', 'plush_bat_heart', 'plush_duckling_bow', 'plush_chicken_daisy', 'plush_pig_crown', 'plush_cow_flower', 'plush_sheep_sakura', 'plush_fox_berry', 'plush_wolf_bow', 'plush_llama_bow', 'plush_turtle_flower', 'plush_axolotl_hat']
              : ['charged_creeper', 'icy_creeper', 'nerd_creeper', 'bogged', 'frozen_zombie', 'chicken_jockey', 'wildfire', 'mini_abomination'];
        for (let k = 0; k < list.length; k++) {
          const ang = player.yaw + Math.PI + (k - (list.length - 1) * 0.5) * 0.22;
          const d = 4.6 + (k & 1) * 1.8;
          const sx = player.x + Math.sin(ang) * d, sz = player.z + Math.cos(ang) * d;
          let sy = Math.floor(player.y) + 2;
          for (let y = Math.floor(player.y) + 6; y >= Math.floor(player.y) - 6; y--) {
            const bid = getBlockWorld(Math.floor(sx), y, Math.floor(sz));
            if (isSolidAt(Math.floor(sx), y, Math.floor(sz)) && !BLOCK_DEF[bid]?.foliage && !isSolidAt(Math.floor(sx), y + 1, Math.floor(sz))) { sy = y + 1; break; }
          }
          if (list[k] === 'baby_ghast' || list[k] === 'wildfire' || list[k] === 'vulture' || list[k] === 'plush_allay_lavender' || list[k] === 'plush_bat_heart') sy += 2.2;
          const mob = spawnMobOfType(list[k], sx, sy, sz);
          if (mob) { mob.yaw = Math.atan2(player.x - sx, player.z - sz); mob.ryaw = mob.yaw; }
        }
        startPlaying();
        showToast(mType === 'v70_cute_pack' ? '✨ Đã gọi Bộ Thú Voxel Dễ Thương v70!' : (mType === 'mobvote_pack' ? '🗳️ Đã gọi Đủ Bộ Mob Vote!' : (mType === 'pastel_pack' ? '🧸 Đã gọi Đủ 19 Mob Bông Pastel!' : '⚡ Đã gọi Bộ Creeper & Quái Mới v70!')));
        return;
      }
      if (mType === 'verdant_pack') {
        const heroPack = ['camel', 'caravan_camel', 'rabbit_brown', 'sika_deer', 'panda', 'fox'];
        for (let k = 0; k < heroPack.length; k++) {
          const ang = player.yaw + Math.PI + (k - 2.5) * 0.42;
          const dist = (k === 2 || k === 3) ? 4.4 : 6.2;
          const sx = player.x + Math.sin(ang) * dist, sz = player.z + Math.cos(ang) * dist;
          let sy = Math.floor(player.y) + 1;
          for (let y = Math.floor(player.y) + 6; y >= Math.floor(player.y) - 6; y--) {
            const bid = getBlockWorld(Math.floor(sx), y, Math.floor(sz));
            if (isSolidAt(Math.floor(sx), y, Math.floor(sz)) && !BLOCK_DEF[bid]?.foliage && !isSolidAt(Math.floor(sx), y + 1, Math.floor(sz))) { sy = y + 1; break; }
          }
          const mob = spawnMobOfType(heroPack[k], sx, sy, sz);
          if (mob) { mob.yaw = Math.atan2(player.x - sx, player.z - sz); mob.ryaw = mob.yaw; }
        }
        startPlaying();
        showToast('🐾 Đã triệu hồi Đàn Thú Voxel Verdant (Lạc Đà, Lạc Đà Đèn, Thỏ, Hươu, Gấu Trúc, Cáo)!');
        return;
      }
      if (mType === 'wildlife_pack') {
        const biome = getBiomeAt(Math.floor(player.x), Math.floor(player.z));
        const names = [];
        for (let k = 0; k < 5; k++) {
          const ang = player.yaw + Math.PI + (k - 2) * 0.42;
          const sx = player.x + Math.sin(ang) * (5.5 + k * 0.9), sz = player.z + Math.cos(ang) * (5.5 + k * 0.9);
          let sy = Math.floor(player.y) + 1;
          for (let y = Math.floor(player.y) + 6; y >= Math.floor(player.y) - 6; y--) {
            if (isSolidAt(Math.floor(sx), y, Math.floor(sz)) && !isSolidAt(Math.floor(sx), y + 1, Math.floor(sz))) { sy = y + 1; break; }
          }
          const spId = pickBiomeAnimal(biome, false);
          const sp = ANIMAL_MAP.get(spId);
          spawnMobOfType(spId, sx, sp && sp.fly ? sy + 4.5 : sy, sz);
          if (sp) names.push(sp.name);
        }
        startPlaying();
        showToast(`🐾 Đã thả đàn thú: ${names.slice(0, 3).join(', ')}...!`);
        return;
      }
      if (mType === 'ocean_school') {
        const biome = getBiomeAt(Math.floor(player.x), Math.floor(player.z));
        const names = [];
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          const sx = player.x - Math.sin(player.yaw) * 6.0 + Math.cos(ang) * 3.5;
          const sz = player.z - Math.cos(player.yaw) * 6.0 + Math.sin(ang) * 3.5;
          const spId = pickBiomeAnimal(biome, true);
          const sp = ANIMAL_MAP.get(spId);
          spawnMobOfType(spId, sx, WATER_LEVEL - 1.2 - (k % 3) * 0.8, sz);
          if (sp) names.push(sp.name);
        }
        startPlaying();
        showToast(`🐠 Đã thả đàn cá biển: ${names.slice(0, 3).join(', ')}...!`);
        return;
      }
      const sx = player.x - Math.sin(player.yaw) * 6.0, sz = player.z - Math.cos(player.yaw) * 6.0;
      let sy = Math.floor(player.y) + 2;
      for (let y = Math.floor(player.y) + 6; y >= Math.floor(player.y) - 6; y--) {
        if (isSolidAt(Math.floor(sx), y, Math.floor(sz)) && !isSolidAt(Math.floor(sx), y + 1, Math.floor(sz))) { sy = y + 1; break; }
      }
      if (mType === 'phantom_drake' || mType === 'gargoyle' || mType === 'end_phantom') sy += 4.5;
      else if (IS_DRAGON_MOB.has(mType)) {
        const liveDrgs = mobs.filter(mb => mb && !mb._dead && IS_DRAGON_MOB.has(mb.type));
        if (liveDrgs.length >= 3) {
          const rm = liveDrgs.find(mb => mb.type !== 'ender_dragon') || liveDrgs[0];
          disposeMobInstance(rm);
          const ri = mobs.indexOf(rm); if (ri !== -1) { mobs[ri] = mobs[mobs.length - 1]; mobs.pop(); }
        }
        sy += 10.5;
      }
      else if (mType === 'ghast') sy += 6.5;
      else if (mType === 'blaze' || mType === 'wildfire' || mType === 'soul_wisp' || mType === 'allay' || mType === 'baby_ghast' || mType === 'glare_mob') sy += 2.5;
      else if (ANIMAL_MAP.get(mType)?.aqua) sy = Math.min(WATER_LEVEL - 1.2, player.y);
      const spawned = spawnMobOfType(mType, sx, sy, sz);
      spawned.yaw = player.yaw + Math.PI;
      startPlaying();
      showToast(`Đã triệu hồi ${btn.textContent}!`);
    });
  });

  // ===================== VIETNAMESE / ENGLISH LANGUAGE SWITCHER (v110) =====================
  const UI_TEXT_EN = {
    'Chơi': 'Play',
    'Cài Đặt': 'Settings',
    'Chơi Chung (Co-op)': 'Multiplayer (Co-op)',
    'Phòng Thay Đồ': 'Dressing Room',
    'Thoát trò chơi': 'Quit Game',
    'Bạn bè (': 'Friends (',
    'Bạn bè (0)': 'Friends (0)',
    'Hồ Sơ': 'Profile',
    'Hồ sơ': 'Profile',
    'Mới!': 'New!',
    'Khu Giấc Mơ (The Sift)': 'Dream Realm (The Sift)',
    'Người chơi': 'Player',
    'game fanmade chơi giải trí': 'fanmade game just for fun',
    'TẠO THẾ GIỚI MỚI': 'CREATE NEW WORLD',
    'TẠO THẾ GIỚI': 'CREATE WORLD',
    'Tạo Phòng Co-op': 'Create Co-op Room',
    'Chung': 'General',
    'Nâng cao': 'Advanced',
    'Khám phá / Sift': 'Explore / The Sift',
    'Phòng Co-op': 'Co-op Rooms',
    'Mod & Add-on (': 'Mods & Add-ons (',
    'Skin': 'Skins',
    'Tên thế giới': 'World Name',
    'Chế độ chơi': 'Game Mode',
    'Sinh tồn': 'Survival',
    'Sáng tạo': 'Creative',
    'Độ khó': 'Difficulty',
    'Bình yên': 'Peaceful',
    'Dễ': 'Easy',
    'Thường': 'Normal',
    'Khó': 'Hard',
    'Quần xã khởi đầu (Biome)': 'Starting Biome',
    '🌸 Rừng Anh Đào': '🌸 Cherry Blossom Grove',
    '🐊 Rừng Ngập Mặn': '🐊 Mangrove Swamp',
    '🏜️ Sa Mạc': '🏜️ Desert Dunes',
    '🌼 Thảo Nguyên': '🌼 Flower Meadow',
    '🏔️ Núi Tuyết': '🏔️ Snowy Peaks',
    '💎 Hang Động': '💎 Lush Cave',
    '🎋 Rừng Trúc': '🎋 Bamboo Forest',
    '🏝️ Biển Dừa': '🏝️ Coconut Beach',
    '🍁 Rừng Mùa Thu': '🍁 Autumn Forest',
    '🏰 Đại Thành': '🏰 Royal Castle City',
    '🏙️ Đô Thị Hoang': '🏙️ Abandoned City',
    '⚓ Cảng Biển': '⚓ Seaport Harbor',
    '💙 Rừng Xanh Lam': '💙 Cerulean Forest',
    '🌾 Cánh Đồng Lúa': '🌾 Golden Wheat Fields',
    '🏡 Thung Lũng Thông': '🏡 Pine Blacksmith Valley',
    '🌴 Rừng Đại Thụ': '🌴 Giant Jungle Canopy',
    '👁️ Thành Phố Cổ': '👁️ Ancient City',
    '✨ Khu Giấc Mơ': '✨ The Sift (Dream Realm)',
    'Hạt giống thế giới (Seed)': 'World Seed',
    '🎲 Ngẫu nhiên': '🎲 Randomize',
    'Nhập số hạt giống cố định để tái tạo cùng địa hình, hoặc bấm "Ngẫu nhiên" để sinh bản đồ mới.': 'Enter a fixed seed number to recreate the same terrain, or click "Randomize" to generate a new map.',
    'Chơi chung với bạn bè': 'Multiplayer Game',
    'Bật để bạn bè đã kết bạn nhìn thấy và vào thẳng thế giới này của bạn qua mạng.': 'Allow added friends to see and join your world directly online.',
    'Phong cách ánh sáng & Đồ họa (Shader)': 'Lighting & Graphics Style (Shader)',
    'Ánh Sáng Tự Nhiên': 'Natural Sunlight',
    'Mộng Mơ (Bliss)': 'Dreamy (Bliss)',
    '🌅 Chill Hoàng Hôn': '🌅 Chill Sunset',
    '🌿 Xanh Tươi Mát': '🌿 Verdant Fresh',
    'Ánh Trăng': 'Moonlit Silver',
    'Thay đổi bầu trời, ánh nắng và sắc thái mây 3D khi bước vào thế giới.': 'Changes sky colors, sunlight tint, and 3D cloud mood when entering the world.',
    'Quản lý Thế giới': 'World Management',
    'Chọn thế giới đã lưu để chơi tiếp hoặc tạo một thế giới hoàn toàn mới.': 'Pick a saved world to resume or create a brand-new adventure.',
    '+ Tạo thế giới mới': '+ Create New World',
    '🟢 Thế giới của bạn bè đang mở': '🟢 Active Friends Worlds',
    'Thế giới của bạn': 'Your Worlds',
    '✨ Khu Giấc Mơ — The Sift (Mới!)': '✨ Dream Realm — The Sift (New!)',
    'Chiều không gian mộng mơ với cực quang ngọc lục bảo, đồi ru ngủ, hồ Ichor và các sinh vật dễ thương độc quyền.': 'A dreamy emerald-aurora dimension with Lullaby Hills, Ichor pools, and exclusive cute creatures.',
    '▶ Vào Ngay The Sift': '▶ Enter The Sift Now',
    'Khám phá Quần Xã & Thế Giới Mở': 'Explore Biomes & Open World',
    'Chọn quần xã khởi đầu ngay tại mục': 'Select your starting biome right in the',
    'để xem trước hình ảnh Shader sắc nét ở góc trên bên trái. (Khu Giấc Mơ chỉ mở khóa bằng Admin hoặc sau khi đánh bại toàn bộ quái tại Khu Tàn Tích.)': 'tab to preview crisp Shader scenery in the top-left card. (The Sift unlocks via Admin or after clearing the Ruins.)',
    'Kết nối Chơi Chung (Internet P2P & LAN)': 'Multiplayer Connection (Internet P2P & LAN)',
    '🔌 Trạng thái máy chủ Co-op:': '🔌 Co-op Server Status:',
    'Đang kiểm tra kết nối...': 'Checking connection...',
    'TÊN CỦA BẠN TRONG PHÒNG': 'YOUR IN-ROOM NAME',
    'NHẬP MÃ PHÒNG CỦA BẠN BÈ': 'ENTER FRIEND ROOM CODE',
    'Vào Phòng': 'Join Room',
    'PHÒNG ĐANG MỞ TRÊN MÁY CHỦ': 'OPEN ROOMS ON SERVER',
    'Chưa có phòng nào — bấm "Tạo Phòng Mới" để lấy Mã Phòng chia sẻ cho bạn bè!': 'No active rooms yet — click "Create New Room" to get a Room Code to share!',
    'Tạo Phòng Mới & Lấy Mã': 'Create Room & Get Code',
    'Làm Mới Danh Sách': 'Refresh List',
    'Bạn bè & Lời mời (': 'Friends & Invites (',
    '🧩 Quản Lý Mod & Voxel Add-on': '🧩 Mod & Voxel Add-on Manager',
    'Hỗ trợ nạp gói tài nguyên định dạng mở (': 'Load open-format resource/add-on packs (',
    '— texture, âm thanh, công thức crafting, chỉ số mob) hoặc Mod NUCRAFT (': '— textures, sounds, crafting recipes, mob stats) or NUCRAFT Mods (',
    '). File': '). Files like',
    'xương phức tạp được bỏ qua an toàn không gây lỗi game.': 'with complex skeletal rigs are skipped safely without crashing.',
    'Kéo thả file Mod / Add-on vào đây hoặc chọn từ máy (lưu bền vững trong trình duyệt)': 'Drag & drop Mod / Add-on files here or pick from device (saved in browser storage)',
    '+ Tải Mod / Add-on (.mcpack / .mcaddon / .zip / .json / .js)': '+ Load Mod / Add-on (.mcpack / .mcaddon / .zip / .json / .js)',
    '✨ Cài Add-on Mẫu': '✨ Install Sample Add-on',
    'Danh sách Mod & Add-on đã cài': 'Installed Mods & Add-ons',
    'Xoay 3D': 'Spin 3D',
    'Tải .PNG': 'Upload .PNG',
    'Xác Nhận': 'Confirm',
    'Quay Lại Màn Hình Chính': 'Back to Title Screen',
    '✓ Chọn Skin Này': '✓ Select This Skin',
    'CLASSIC SKINS — CHỌN SKIN NHÂN VẬT': 'CLASSIC SKINS — CHOOSE CHARACTER SKIN',
    'Tiếp tục trò chơi': 'Resume Game',
    'Cài đặt': 'Settings',
    'Lưu & thoát': 'Save & Quit',
    'Trò chơi đã tạm dừng': 'Game Paused',
    'Chơi chung • Không tạm dừng': 'Multiplayer • World Live',
    'Phòng thay đồ': 'Dressing Room',
    'Mời tham gia trò chơi': 'Invite to Game',
    'Người chơi trong Thế giới': 'Players in World',
    '← Quay lại': '← Back',
    'Quay lại': 'Back',
    'CÀI ĐẶT': 'SETTINGS',
    'Trò chơi': 'Game',
    'Đồ họa': 'Graphics',
    'Vùng đất': 'Worlds / Realms',
    'Quái vật': 'Mobs & Spawns',
    'Điều Khiển, Tọa Độ & Bộ Lọc Chat (###)': 'Controls, Coordinates & Chat Filter (###)',
    'Góc Nhìn F5 (3D)': 'F5 View (3D)',
    'Tùy Chỉnh Nút & Tọa Độ': 'Customize HUD & Coords',
    'Bật/Tắt Nút Mobile': 'Toggle Mobile Controls',
    'Gọi Bạn Đồng Hành': 'Summon Companion',
    '🎮 Kiểu Mobile 1': '🎮 Touch Layout 1',
    '🎮 Kiểu Mobile 2': '🎮 Touch Layout 2',
    '🎮 Kiểu Mobile 3': '🎮 Touch Layout 3',
    'Lưu Từ Cấm': 'Save Blocked Words',
    'Chơi Chung Qua Internet (Mọi Mạng Wi-Fi / 4G)': 'Play Together Online (Any Wi-Fi / 4G)',
    'Mở phòng để nhận Mã Phòng Internet 6 ký tự và gửi cho bạn bè ở bất kỳ đâu!': 'Host a room to get a 6-character online Room Code and share it with friends anywhere!',
    'Mở Phòng Online & Lấy Mã': 'Open Online Room & Get Code',
    'Về Sảnh / Đổi Skin': 'Lobby / Change Skin',
    'Lưu Trữ Thế Giới': 'World Storage',
    '💾 Lưu Thế Giới': '💾 Save World',
    '🔄 Tạo Map Mới': '🔄 New World',
    'Quyền Quản Trị (Admin • Mở Khóa Tab Vùng Đất)': 'Admin Access (Unlock Realms Tab)',
    '👑 Mở Khóa Admin': '👑 Unlock Admin',
    '🌐 Ngôn Ngữ / Language': '🌐 Language / Ngôn Ngữ',
    '🎵 Âm Thanh & Nhạc Nền Voxel Chill': '🎵 Sound Effects & Chill Background Music',
    'Âm thanh': 'Audio',
    'Đặt lại mục': 'Reset section',
    'Mặc định:': 'Default:',
    'NGÔN NGỮ': 'LANGUAGE',
    'ÂM LƯỢNG': 'VOLUME',
    'ĐIỀU KHIỂN & GIAO DIỆN': 'CONTROLS & INTERFACE',
    'HIỂN THỊ & CHẤT LƯỢNG': 'DISPLAY & QUALITY',
    'SHADER, MÂY & BỀ MẶT': 'SHADER, CLOUDS & SURFACES',
    '🔊 Tổng:': '🔊 Master:',
    '🎹 Nhạc nền:': '🎹 Music:',
    '⛏️ Hiệu ứng:': '⛏️ Effects:',
    '💥 Quái & Nổ:': '💥 Mobs & SFX:',
    'Tầm Nhìn & Chất Lượng': 'Render Distance & Quality',
    'Gần (2)': 'Short (2)',
    'Chuẩn (3)': 'Normal (3)',
    'Xa (4)': 'Far (4)',
    'Nhẹ': 'Fast',
    'RTX Chuẩn': 'RTX Standard',
    'RTX Ultra': 'RTX Ultra',
    'Shader & Mây / Bề Mặt': 'Shaders, Clouds & Surfaces',
    'BSL Tự Nhiên': 'BSL Natural',
    'Bliss Dịu': 'Bliss Soft',
    '🌅 Chill Hoàng Hôn': '🌅 Chill Sunset',
    '🌿 Xanh Tươi Mát': '🌿 Fresh Lush',
    'Đêm Trăng': 'Moonlit Silver',
    '✨ DLSS Siêu Thực': '✨ DLSS Ultra',
    '🌘 Eclipse Shader': '🌘 Eclipse Shader',
    'Mây 3D': '3D Clouds',
    '☁️ Mây Volumetric': '☁️ Volumetric Clouds',
    '🧊 Mây Khối Luanti': '🧊 Luanti Block Clouds',
    'Bump PBR: Bật': 'Bump PBR: On',
    'Bump Relief PBR: Đã bật': 'Bump Relief PBR: On',
    'Thời Gian Trong Ngày': 'Time of Day',
    'Giờ Vàng': 'Golden Hour',
    'Trưa': 'Noon',
    'Hoàng Hôn': 'Sunset',
    'Thời Tiết': 'Weather',
    'Tự động': 'Auto',
    'Quang': 'Clear',
    'Mưa': 'Rain',
    'Bão': 'Storm',
    'Tuyết Rơi': 'Snowfall',
    'Bão Tuyết': 'Blizzard',
    'Sương Mù': 'Dense Fog',
    'Bão Cát': 'Sandstorm',
    'Mưa Sao Băng': 'Meteor Shower',
    '🔒 Chỉ xem': '🔒 View Only',
    '👑 Admin': '👑 Admin',
    '📊 Hiện FPS HUD': '📊 Show FPS HUD',
    '🌑 Bóng Mượt': '🌑 Smooth Shadows',
    '🌊 Phản Chiếu Nước': '🌊 Water Reflections',
    '💧 Nước Đẹp Ultra': '💧 Ultra Water',
    '🏎️ Auto-Tối Ưu FPS': '🏎️ Auto-Optimize FPS',
    '✨ Sắc Nét Clarity': '✨ Clarity Sharpen',
    '🌧️ Hạt Thời Tiết': '🌧️ Weather Particles',
    '☁️ Mây Trời': '☁️ Sky Clouds',
    '🌫️ Sương Mù Fog': '🌫️ Distance Fog',
    '✨ Hạt Particle': '✨ Particles',
    '🎞️ Hoạt Ảnh': '🎞️ Animations',
    '🦕 Entity Xa': '🦕 Distant Entities',
    'Chiều Không Gian & Khu Vực Đặc Biệt': 'Dimensions & Special Biomes',
    'Tàn Tích Bí Ẩn (Quái Đông)': 'Mysterious Ruins (Heavy Mobs)',
    'Đô Thị Bỏ Hoang 500m': 'Abandoned City 500m',
    'Rừng Lá Cam Mùa Thu': 'Autumn Maple Forest',
    '⛺ Khu Trại Bỏ Hoang Mùa Thu': '⛺ Abandoned Autumn Camp',
    '🍂 Rừng Thu Vàng Óng': '🍂 Golden Autumn Woods',
    'Làng Dân Làng': 'Villager Village',
    '🏡 Biệt Thự Tudor Gạch Đỏ': '🏡 Brick Tudor Mansion',
    '🏰 Trang Viên Tudor Cổ Kính': '🏰 Historic Tudor Manor',
    '❄️ Tuyết Xá Gỗ Thông': '❄️ Pine Snow Lodge',
    '🌼 Nhà Khởi Đầu': '🌼 Starter Cottage',
    '🌲 Nhà Gỗ Trong Rừng': '🌲 Forest Cabin',
    'Đại Thành & Lâu Đài': 'Grand Citadel & Castle',
    '🌿 Thế Giới Chính': '🌿 Overworld',
    '🔥 Địa Ngục (Nether)': '🔥 The Nether',
    '🌌 Khu Kết Thúc (End)': '🌌 The End',
    '✨ Khu Giấc Mơ (The Sift)': '✨ Dream Realm (The Sift)',
    'Cảng Biển & Tàu': 'Seaport & Ship',
    'Đáy Biển & Tàu Đắm': 'Ocean Floor & Shipwreck',
    '🌊 Vực Biển Siêu Sâu (Abyss)': '🌊 Deep Ocean Abyss',
    'Hồ Anh Đào': 'Cherry Blossom Lake',
    '🏡 Thung Lũng Thông & Nhà Rèn': '🏡 Pine Valley & Forge',
    '🌴 Rừng Nhiệt Đới Đại Thụ': '🌴 Giant Tropical Jungle',
    'Rừng Trúc Xanh': 'Green Bamboo Grove',
    'Đảo Nấm Khổng Lồ': 'Giant Mushroom Island',
    'Thảo Nguyên Oải Hương': 'Lavender Meadow',
    'Đồng Tro Núi Lửa': 'Volcanic Ash Plains',
    'Bờ Biển Dừa': 'Coconut Coast',
    'Đầm Lầy Ngập Mặn': 'Mangrove Swamp',
    'Núi Tuyết Cao': 'High Snowy Peaks',
    'Cao Nguyên': 'Highlands Plateau',
    'Hang Tươi Tốt': 'Lush Caves',
    'BẠN ĐÃ GỤC NGÃ!': 'YOU DIED!',
    'Bạn đã hết máu trong thế giới sinh tồn.': 'You ran out of health in Survival mode.',
    'HỒI SINH TẠI ĐIỂM XUẤT PHÁT': 'RESPAWN AT SPAWN POINT',
    'Mời bạn bè vào trò chơi của bạn': 'Invite Friends to Your Game',
    'Lời mời kết bạn': 'Friend Requests',
    'Bạn bè trực tuyến': 'Online Friends',
    'Bạn bè ngoại tuyến': 'Offline Friends',
    'Thêm bạn bè': 'Add Friends',
    'Gửi lời mời': 'Send Invite',
    'Thêm bạn bè (Tìm theo tên UID)': 'Add Friends (Search by UID)',
    'Tìm người chơi theo tên UID chính xác': 'Find players by exact UID name',
    'Tìm': 'Search',
    'Quay lại danh sách bạn bè': 'Back to Friends List',
    '✓ Đồng ý': '✓ Accept',
    'Từ chối': 'Decline',
    'Hồ sơ người chơi (UID)': 'Player Profile (UID)',
    'Đặt tên UID của bạn (chỉ nhập 1 lần duy nhất, không thể thay đổi sau khi lưu):': 'Set your UID name (one-time setup, cannot be changed after saving):',
    'Đóng': 'Close',
    'Lưu UID cố định': 'Save Permanent UID',
    'Mặc định': 'Default',
    '✓ Lưu & Xong': '✓ Save & Done',
    'Kích thước:': 'Scale:',
    'Độ mờ (Opacity):': 'Opacity:',
    'Tất cả nút': 'All Buttons',
    'Gửi': 'Send',
    'Đang tải thế giới': 'Loading World',
    'Đang xây địa hình...': 'Building terrain...',
    '🔒 Tính năng triệu hồi Động vật & Quái vật bị khóa trong chế độ Sinh tồn.': '🔒 Animal & Mob spawning is locked in Survival mode.',
    '🐾 20+ Thú Voxel Dễ Thương Mới & Thuần Hóa (Chuột Phải!)': '🐾 20+ Cute Voxel Animals & Taming (Right-Click!)'
  };
  const UI_ATTR_EN = {
    'Nhập tin nhắn (Enter gửi • Esc đóng)...': 'Type a message (Enter to send • Esc to close)...',
    'Tìm kiếm công thức...': 'Search recipes...',
    'Nhập tên thế giới...': 'Enter world name...',
    'Để trống để tạo hạt giống ngẫu nhiên mới...': 'Leave blank for a random seed...',
    'Nhập tên UID người chơi...': 'Enter player UID...',
    'Thêm từ cấm chat cách nhau bởi dấu phẩy (VD: ngu, ga)...': 'Comma-separated blocked words...',
    'Nhập mã quản trị...': 'Enter admin code...',
    'Quay lại Sảnh': 'Back to Lobby',
    'Quay Lại Sảnh': 'Back to Lobby',
    'Quay lại': 'Back',
    'Toàn màn hình': 'Fullscreen',
    'Bật / Tắt Toàn Màn Hình': 'Toggle Fullscreen',
    'Giờ hiện tại (Mở khóa Admin để chỉnh)': 'Current time (Unlock Admin to edit)',
    'Chỉnh giờ chính xác (HH:MM)': 'Set exact world time (HH:MM)',
    'Đồng hồ thế giới': 'World Clock',
    'Đóng': 'Close'
  };
  const BIOME_EN_MAP = {
    sakura:         { label: '🌸 Cherry Grove',     desc: 'Start beside a vibrant Cherry Blossom lake under golden BSL Sunlight, crystal streams, and lush green grass.' },
    mangrove:       { label: '🐊 Mangrove Swamp',   desc: 'Roots-tangled mangrove swamp above emerald water with moss carpets, lily pads, and crocodiles.' },
    desert:         { label: '🏜️ Desert Dunes',     desc: 'Golden sand dunes glowing under bright sun with ancient sandstone pyramids, cacti, and green oases.' },
    meadow:         { label: '🌼 Flower Meadow',    desc: 'Rolling green grasslands dotted with daisies, poppies, purple lavender, and gentle streams.' },
    alpine:         { label: '🏔️ Snowy Peaks',      desc: 'Majestic snow-capped peaks meeting packed ice, deep pine woods, and reflective alpine lakes.' },
    lush_cave:      { label: '💎 Lush Cave',        desc: 'Sun-lit sinkhole cavern covered in vibrant moss, underground waterfalls, glow vines, and crystals.' },
    bamboo:         { label: '🎋 Bamboo Forest',    desc: 'Towering green bamboo groves catching warm dappled sunlight beside tranquil brooks.' },
    beach_palm:     { label: '🏝️ Coconut Beach',    desc: 'Crystal turquoise bay, soft white sandy beaches, vibrant coral reefs, and leaning palm trees.' },
    autumn:         { label: '🍁 Autumn Forest',    desc: 'Crimson and amber maple trees glowing along calm rocky riverside slopes.' },
    castle_city:    { label: '🏰 Castle City',      desc: 'Majestic royal castle surrounded by reflective moats, copper-roofed watchtowers, and stone bridges.' },
    abandoned_city: { label: '🏙️ Abandoned City',   desc: 'An overgrown modern boulevard of moss-covered glass skyscrapers standing in quiet twilight.' },
    grand_ruins:    { label: '🏛️ Grand End Ruins',  desc: 'Massive 1000×1000 overgrown ancient ruins housing the majestic End Portal Citadel Shrine, waterfalls, and guardian courtyard.' },
    seaport:        { label: '⚓ Seaport Harbor',   desc: 'Bustling oak timber docks reaching into blue waters beneath a glowing coastal lighthouse.' },
    blue_forest:    { label: '💙 Cerulean Forest',  desc: 'Mystic blue-foliage woods dotted with giant red mushrooms, teal grass, and lantern-lit trails.' },
    wheat_valley:   { label: '🌾 Wheat Fields',     desc: 'Endless golden wheat fields glowing in warm chill sunlight beside wooden windmills.' },
    pine_valley:    { label: '🏡 Pine Valley',      desc: 'Deep spruce valley with a cozy blacksmith cottage, warm forge hearth, and terracotta roof.' },
    giant_jungle:   { label: '🌴 Giant Jungle',     desc: 'Towering tropical canopy trees stretching over calm rivers with hanging green vines.' },
    ancient_city:   { label: '👁️ Ancient City',     desc: 'Deep mountain cavern city with the ancient stone portal, soul lanterns, wool carpets, and Wardens.' },
    highland:       { label: '⛰️ Highland Plateau', desc: 'Sweeping high plateaus and clay mountain cliffs rising into sunlit clouds.' },
    lush_steppe:    { label: '🌿 Lush Steppe',      desc: 'Vast rolling grass plains built for villages, windmills, and open exploration.' },
    green_plains:   { label: '🌿 Green Plains',     desc: 'Lush flat emerald grassland blanketed in tall grass, meadows, and villages.' },
    snowy_plains:   { label: '❄️ Snowy Plains',     desc: 'Broad snowy flats with frosted white grass, frozen lakes, and snow-draped earth.' },
    dark_forest:    { label: '🌑 Dark Forest',      desc: 'Dense dark oak canopy with red mushrooms and dappled twilight shade.' },
    pale_garden:    { label: '🤍 Pale Garden',      desc: 'Eerie pale woods shrouded in silver mist with pale oak trunks and moss carpets.' },
    nightmare_woods:{ label: '🕸️ Nightmare Woods',  desc: 'Cursed twilight forest cloaked in heavy crimson mist that restricts far visibility.' },
    sulfur_springs: { label: '🧪 Sulfur Springs',   desc: 'Terraced geothermal turquoise pools ringed with yellow sulfur spires, red cinnabar stone, steam vents, and Sulfur Slimes.' },
    dim_sift:       { label: '✨ Dream Realm',      desc: 'The Sift dimension shimmering with emerald aurora skies, Lullaby Hills, Ichor pools, and cute mobs.' },
    dim_nether:     { label: '🔥 The Nether',       desc: 'Molten lava dimension filled with Crimson fungus forests and glowing Netherrack caverns.' },
    dim_end:        { label: '🐉 The End City',     desc: 'Deep violet void with floating End Stone islands, obsidian pillars, and glowing Purpur towers.' },
    dim_dragon_realm:{ label: '🌌 Dragon End Realm', desc: 'Mythic multi-biome dragon dimension with Void Jungles, Crystal Caverns, Purpur Citadels, and the 50-Skill Sovereign Boss.' },
    dim_warden:     { label: '👁️ Warden Realm',     desc: 'Abyssal Sculk citadel dimension with Soul Fire forests, 4 Sculk guardians (200-1000HP), and Tier-6 ores.' }
  };
  const DIFF_EN_MAP = {
    peaceful: { label: 'Peaceful', desc: 'Hostile mobs do not spawn. Hunger does not drain and health regenerates quickly.' },
    easy:     { label: 'Easy',     desc: 'Hostile mobs spawn and deal reduced damage (0.65×). Hunger drains more slowly.' },
    normal:   { label: 'Normal',   desc: 'Hostile mobs spawn and deal standard damage. Hunger drains normally as you move.' },
    hard:     { label: 'Hard',     desc: 'Hostile mobs deal heavy damage (1.5×), fight aggressively, and hunger drains faster.' }
  };
  const MODE_EN_MAP = {
    survival: 'Explore a mysterious world where you build, gather resources, craft gear, and battle mobs.',
    creative: 'Unlimited blocks and items, free flight (F / Space×2), and zero damage for pure building.'
  };
  function getLocBiomeLabel(k) { const info = ORE_BIOME_PREVIEWS[k] || ORE_BIOME_PREVIEWS.sakura; return currentLang === 'en' ? (BIOME_EN_MAP[k]?.label || info.label) : info.label; }
  function getLocBiomeDesc(k) { const info = ORE_BIOME_PREVIEWS[k] || ORE_BIOME_PREVIEWS.sakura; return currentLang === 'en' ? (BIOME_EN_MAP[k]?.desc || info.desc) : info.desc; }
  function getLocDiffLabel(k) { const d = DIFFICULTY_CFG[k] || DIFFICULTY_CFG.normal; return currentLang === 'en' ? (DIFF_EN_MAP[k]?.label || d.label) : d.label; }
  function getLocDiffDesc(k) { const d = DIFFICULTY_CFG[k] || DIFFICULTY_CFG.normal; return currentLang === 'en' ? (DIFF_EN_MAP[k]?.desc || d.desc) : d.desc; }
  function getLocModeDesc(k) { const m = k === 'creative' ? 'creative' : 'survival'; return currentLang === 'en' ? MODE_EN_MAP[m] : MODE_DESC_MAP[m]; }

  function _applyDomLang(lang) {
    const skipSelector = '#savedWorldsList, #modManagerList, #lobbyBiomeDesc, #lobbyModeDesc, #lobbyDiffDesc, #coordsText, #daysText, #depthText, #itemLabel, #tabLblWorlds, #gmTitleText, #btnPlay, #lobbySubTitle, #oreWorldThumbBadge, #btnTitleLang, #coopServerStatus, #controlsHintText';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const p = node.parentElement;
      if (!p || p.tagName === 'SCRIPT' || p.tagName === 'STYLE') continue;
      if (p.closest(skipSelector)) continue;
      if (node._viOrig === undefined) node._viOrig = node.nodeValue;
      const origRaw = node._viOrig;
      const norm = origRaw.replace(/\s+/g, ' ').trim();
      if (!norm) continue;
      const enText = UI_TEXT_EN[norm];
      if (!enText) continue;
      if (lang === 'en') {
        const nextVal = origRaw.replace(origRaw.trim(), enText);
        if (node.nodeValue !== nextVal) node.nodeValue = nextVal;
        node._i18nLastEn = enText;
      } else if (node.nodeValue.trim() === node._i18nLastEn || node.nodeValue.trim() === enText) {
        node.nodeValue = origRaw;
      }
    }
    document.querySelectorAll('[title], [placeholder], [aria-label]').forEach(el => {
      for (const attr of ['title', 'placeholder', 'aria-label']) {
        const cur = el.getAttribute(attr);
        if (!cur) continue;
        const dk = 'viAttr_' + attr;
        if (!el.dataset[dk]) el.dataset[dk] = cur;
        const viVal = el.dataset[dk];
        const enVal = UI_ATTR_EN[viVal];
        if (!enVal) continue;
        if (lang === 'en') el.setAttribute(attr, enVal);
        else if (cur === enVal) el.setAttribute(attr, viVal);
      }
    });
    const ch = document.getElementById('controlsHintText');
    if (ch) {
      if (!ch.dataset.viHtml) ch.dataset.viHtml = ch.innerHTML;
      ch.innerHTML = lang === 'en'
        ? 'Keys <b>I / E</b>: 2×2 Bag &amp; 3D Armor • Place <b>Crafting Table</b> for 3×3 Grid • <b>T / Enter</b>: Chat • <b>M</b>: Map • <b>F1</b>: Toggle HUD • <b>F5</b>: Camera View • <b>F / Space×2</b>: Fly (<b>Creative</b>) • Dig down <b>-1000m</b> to Nether → deeper to <b>The End</b>!'
        : ch.dataset.viHtml;
    }
    const coordsBtn = document.getElementById('btnToggleCoords');
    if (coordsBtn && typeof coordsVisible !== 'undefined') coordsBtn.textContent = coordsVisible ? tr('📍 Tọa Độ HUD: BẬT', '📍 HUD Coords: ON') : tr('📍 Tọa Độ HUD: TẮT', '📍 HUD Coords: OFF');
    const profBtn = document.getElementById('btnToggleProfanity');
    if (profBtn && typeof profanityFilterOn !== 'undefined') profBtn.textContent = profanityFilterOn ? tr('🛡️ Lọc Từ Thô Tục: BẬT', '🛡️ Chat Filter: ON') : tr('🛡️ Lọc Từ Thô Tục: TẮT', '🛡️ Chat Filter: OFF');
    const rtBtn = document.getElementById('btnRayTracing');
    if (rtBtn && typeof sodiumOpts !== 'undefined') rtBtn.textContent = sodiumOpts.rayTracing ? tr('BẬT', 'ON') : tr('TẮT', 'OFF');
    const cloudBtn = document.getElementById('btnCloudMode');
    if (cloudBtn && typeof volumetricClouds !== 'undefined') cloudBtn.textContent = volumetricClouds ? tr('☁️ Mây Volumetric', '☁️ Volumetric Clouds') : tr('🧊 Mây Khối Luanti', '🧊 Luanti Block Clouds');
    const texBtn = document.getElementById('btnTexFilter');
    if (texBtn && typeof bumpEnabled !== 'undefined') texBtn.textContent = bumpEnabled ? tr('Bump PBR: Bật', 'Bump PBR: On') : tr('Bump PBR: Tắt', 'Bump PBR: Off');
  }

  function _applyAllI18n(lang) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'vi';
    _applyDomLang(lang);
    const gmH1 = document.getElementById('gmTitleText');
    if (gmH1) gmH1.textContent = tr('CÀI ĐẶT', 'SETTINGS');
    const wNameInp = document.getElementById('inpWorldName');
    if (wNameInp) {
      const wv = wNameInp.value.trim();
      if (lang === 'en' && (wv === 'Thế giới của tôi' || wv === 'Vương Quốc Anh Đào')) wNameInp.value = 'My World';
      else if (lang === 'vi' && wv === 'My World') wNameInp.value = 'Thế giới của tôi';
    }
    const mm = document.getElementById('menuModal');
    const bp = document.getElementById('btnPlay');
    if (bp) {
      bp.textContent = (mm && mm.classList.contains('from-lobby'))
        ? tr('Xong (Quay Lại Sảnh)', 'Done (Back to Lobby)')
        : tr('▶ Tiếp Tục Chơi', '▶ Resume Game');
    }
    const modeDesc = document.getElementById('lobbyModeDesc');
    if (modeDesc && typeof lobbyMode !== 'undefined') modeDesc.textContent = getLocModeDesc(lobbyMode);
    const diffDesc = document.getElementById('lobbyDiffDesc');
    if (diffDesc && typeof lobbyDifficulty !== 'undefined') diffDesc.textContent = getLocDiffDesc(lobbyDifficulty);
    const bioDesc = document.getElementById('lobbyBiomeDesc');
    if (bioDesc && typeof lobbyBiome !== 'undefined') bioDesc.textContent = getLocBiomeDesc(lobbyBiome);
    const subTitle = document.getElementById('lobbySubTitle');
    const actTab = document.querySelector('.lobby-tab.active');
    if (subTitle && typeof getSubTitle === 'function') subTitle.textContent = getSubTitle(actTab?.dataset.ltab || 'create');
    const stEl = document.getElementById('coopServerStatus');
    if (stEl && typeof activeRoomId !== 'undefined' && !activeRoomId) {
      stEl.innerHTML = tr('🌐 Internet Relay &amp; P2P: <b style="color:#4ade80;">Sẵn sàng kết nối xuyên mạng Wi-Fi / 4G ✓</b>', '🌐 Internet Relay &amp; P2P: <b style="color:#4ade80;">Ready for Cross-Network Wi-Fi / 4G ✓</b>');
    }
    if (typeof updateTitleScreenLabels === 'function') updateTitleScreenLabels();
    if (typeof lobbyBiome !== 'undefined' && typeof drawOreWorldThumb === 'function') drawOreWorldThumb(lobbyBiome);
    if (typeof renderSavedWorldsList === 'function') renderSavedWorldsList();
    if (typeof renderModManagerList === 'function') renderModManagerList();
    if (typeof updateHotbarUI === 'function') updateHotbarUI();
    if (typeof syncTimeWeatherAdminLocks === 'function') syncTimeWeatherAdminLocks();
    window._lastCoordsHud = ''; window._lastDaysHud = ''; window._lastDepthHud = '';
  }

  const I18N_DICT = {
    vi: {
      inv_title: 'Crafting',
      eq_armor: 'Giáp',
      eq_hint: 'Bấm giáp/khiên trong Balo để mặc ngay',
      inv_bag: 'Inventory',
      lobby_splash: 'game fanmade chơi giải trí',
      lbl_name_lang: 'TÊN NGƯỜI CHƠI, NGÔN NGỮ & SHADER',
      menu_ver: 'game fanmade chơi giải trí',
      lbl_lang: '🌐 NGÔN NGỮ / LANGUAGE (F = BAY • F5 = GIÁP 3D • T = CHAT • M = MAP)',
      lbl_mobs: 'TRIỆU HỒI QUÁI VẬT ĐỊA NGỤC, END CITY & BOSS BLENDER 3D',
      controls_hint: ''
    },
    en: {
      inv_title: 'Crafting',
      eq_armor: 'Armor',
      eq_hint: 'Click armor/shield in Backpack to equip',
      inv_bag: 'Inventory',
      lobby_splash: 'fanmade game just for fun',
      lbl_name_lang: 'PLAYER NAME, LANGUAGE & SHADER',
      menu_ver: 'fanmade game just for fun',
      lbl_lang: '🌐 LANGUAGE / NGÔN NGỮ (F = FLY • F5 = 3D ARMOR • T = CHAT • M = MAP)',
      lbl_mobs: 'SUMMON NETHER, END CITY & BOSS BLENDER 3D MOBS',
      controls_hint: ''
    }
  };
  try { localStorage.setItem('luanti_lang', currentLang); } catch (_) {}
  function applyLanguage(lang, notify = false) {
    currentLang = (lang === 'en') ? 'en' : 'vi';
    try { localStorage.setItem('luanti_lang', currentLang); } catch (_) {}
    if (typeof _applyAllI18n === 'function') _applyAllI18n(currentLang);
    const dict = I18N_DICT[currentLang] || I18N_DICT.vi;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.id === 'controlsHintText') return;
      const k = el.getAttribute('data-i18n');
      if (dict[k]) el.textContent = dict[k];
    });
    document.querySelectorAll('#langSegLobby .seg-btn, #langSegMenu .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === currentLang);
    });
    const mm = document.getElementById('menuModal');
    const btnPlay = document.getElementById('btnPlay');
    if (btnPlay) {
      btnPlay.textContent = (mm && mm.classList.contains('from-lobby'))
        ? tr('Xong (Quay Lại Sảnh)', 'Done (Back to Lobby)')
        : tr('▶ Tiếp Tục Chơi', '▶ Resume Game');
    }
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.textContent = tr('💾 Lưu Thế Giới', '💾 Save World');
    const btnReset = document.getElementById('btnResetWorld');
    if (btnReset) btnReset.textContent = tr('🔄 Tạo Map Mới', '🔄 New World');
    if (notify) showToast(tr('🇻🇳 Đã chuyển ngôn ngữ sang Tiếng Việt!', '🇬🇧 Switched language to English!'));
  }
  document.querySelectorAll('#langSegLobby .seg-btn, #langSegMenu .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLanguage(btn.dataset.lang, true));
  });


  /* ============================================================================
   * 14. MINECRAFT LOBBY, MULTI-WORLD SAVES, CO-OP ROOM ID & PLAYER LOCATOR BAR
   * ============================================================================ */
  const WORLDS_KEY = 'luanti_craft_v14_worlds';
  let currentWorldMeta = { id: 'w_default', name: 'Vương Quốc Anh Đào', seed: worldSeed, mode: 'survival', biome: 'sakura', preset: 'bsl' };
  let gameMode = 'survival', localPlayerName = 'SteveVN';
const DIFFICULTY_CFG = {
  peaceful: {
    label: 'Bình yên',
    dmgMul: 0,
    hungerMul: 0,
    hostileSpawn: false,
    desc: 'Quái vật hung dữ không xuất hiện. Thanh đói không giảm và máu tự hồi phục nhanh.'
  },
  easy: {
    label: 'Dễ',
    dmgMul: 0.65,
    hungerMul: 0.7,
    hostileSpawn: true,
    desc: 'Quái vật xuất hiện nhưng gây ít sát thương hơn (0.65×). Thanh đói giảm chậm hơn.'
  },
  normal: {
    label: 'Thường',
    dmgMul: 1.0,
    hungerMul: 1.0,
    hostileSpawn: true,
    desc: 'Quái vật hung dữ xuất hiện và gây sát thương tiêu chuẩn. Thanh đói giảm dần khi vận động.'
  },
  hard: {
    label: 'Khó',
    dmgMul: 1.5,
    hungerMul: 1.35,
    hostileSpawn: true,
    desc: 'Quái vật gây sát thương cao hơn (1.5×), tấn công quyết liệt và thanh đói giảm nhanh hơn.'
  }
};
const MODE_DESC_MAP = {
  survival: 'Khám phá thế giới bí ẩn nơi bạn xây dựng, thu thập, chế tạo và chiến đấu với quái vật.',
  creative: 'Tài nguyên vô hạn, bay tự do (phím F / Space×2) và không nhận sát thương để thỏa sức sáng tạo.'
};
let worldDifficulty = 'normal';
let lobbyDifficulty = 'normal';
let seedUserEdited = false;

function getDifficultyCfg(diffKey) {
  return DIFFICULTY_CFG[diffKey || worldDifficulty] || DIFFICULTY_CFG.normal;
}

const ORE_BIOME_PREVIEWS = {
  sakura:         { label: '🌸 Rừng Anh Đào',     desc: 'Khởi đầu bên hồ Hoa Anh Đào rực rỡ dưới nắng vàng Shader BSL, có suối nước trong và thảm cỏ xanh.',                     sky1: '#4fa8f8', sky2: '#fde8c8', grass: '#53b23b', dirt: '#3a7d28', water: '#2b82c9', tree: '#f9a8d4', trunk: '#5c3a21', accent: '#fbcfe8', kind: 'trees' },
  mangrove:       { label: '🐊 Rừng Ngập Mặn',   desc: 'Đầm lầy cây Đước rễ chùm nổi trên mặt nước xanh ngọc, phủ đầy rêu xanh, lá súng và bầy cá sấu trú ngụ.',              sky1: '#3b8d99', sky2: '#b8ebd0', grass: '#4a7c3a', dirt: '#3d3c44', water: '#1e6f68', tree: '#3f7d3a', trunk: '#5c342e', accent: '#a3e635', kind: 'trees' },
  desert:         { label: '🏜️ Sa Mạc',           desc: 'Đồi cát vàng trải dài dưới ánh nắng rực rỡ cùng đền kim tự tháp sa thạch cổ đại, xương rồng và ốc đảo xanh.',          sky1: '#2f8df6', sky2: '#fde08d', grass: '#e2cc8a', dirt: '#c9a66b', water: '#1e90b8', tree: '#2d7a36', trunk: '#b85c3e', accent: '#fde68a', kind: 'beach' },
  meadow:         { label: '🌼 Thảo Nguyên',       desc: 'Đồng cỏ xanh mướt trải thảm hoa cúc vàng, anh túc đỏ, oải hương tím và dòng suối mát uốn lượn dưới ánh sáng Bliss.',   sky1: '#3d9ef7', sky2: '#d5f2ff', grass: '#58b942', dirt: '#448c2d', water: '#2aa4e0', tree: '#6bc445', trunk: '#7c5838', accent: '#fef08a', kind: 'trees' },
  alpine:         { label: '🏔️ Núi Tuyết',        desc: 'Đỉnh núi tuyết trắng hùng vĩ xen lẫn băng nén lấp lánh, rừng thông kim xanh thẫm và hồ băng phản chiếu ánh mặt trời.', sky1: '#1d6fd6', sky2: '#dbeafe', grass: '#eef6fc', dirt: '#7c848c', water: '#38bdf8', tree: '#295748', trunk: '#4a3525', accent: '#bae6fd', kind: 'trees' },
  lush_cave:      { label: '💎 Hang Động',         desc: 'Khu hang động rêu tươi tốt có giếng trời rọi nắng, thác nước ngầm, dây leo phát sáng và pha lê lấp lánh.',            sky1: '#0f2936', sky2: '#2d6a6e', grass: '#4ea832', dirt: '#3c414a', water: '#06b6d4', tree: '#34d399', trunk: '#4a3f3a', accent: '#67e8f9', kind: 'sift' },
  bamboo:         { label: '🎋 Rừng Trúc',        desc: 'Rừng trúc xanh cao vút đón những tia nắng xuyên tán lá vàng ấm áp bên dòng suối nhỏ.',                                sky1: '#4c9cf2', sky2: '#d1fae5', grass: '#45a13d', dirt: '#2d6a30', water: '#0d9488', tree: '#84cc16', trunk: '#4d7c0f', accent: '#bef264', kind: 'bamboo' },
  beach_palm:     { label: '🏝️ Biển Dừa',         desc: 'Vịnh biển nhiệt đới nước xanh trong vắt, bãi cát trắng mịn, rạn san hô rực rỡ và rặng dừa nghiêng bóng.',             sky1: '#2196f3', sky2: '#c5eeff', grass: '#facc15', dirt: '#eab308', water: '#0284c7', tree: '#22c55e', trunk: '#8a5d3b', accent: '#fef9c3', kind: 'beach' },
  autumn:         { label: '🍁 Rừng Mùa Thu',     desc: 'Rừng phong lá đỏ cam rực rỡ hòa cùng sắc vàng cuối chiều trên triền sông đá êm đềm.',                                 sky1: '#3b82f6', sky2: '#fed7aa', grass: '#c27a2c', dirt: '#7c4e38', water: '#2563eb', tree: '#ea580c', trunk: '#6d4c2f', accent: '#facc15', kind: 'trees' },
  castle_city:    { label: '🏰 Đại Thành',        desc: 'Tòa lâu đài hoàng gia uy nghiêm với hào nước phản chiếu ánh nắng, tháp canh mái đồng và cầu gỗ cổ kính.',             sky1: '#2f7df0', sky2: '#fde68a', grass: '#4d9b34', dirt: '#367023', water: '#2563eb', tree: '#9ca3af', trunk: '#4b5563', accent: '#dc2626', kind: 'castle' },
  abandoned_city: { label: '🏙️ Đô Thị Hoang',     desc: 'Đại lộ thành phố hiện đại bị bỏ hoang với những tòa cao ốc kính vỡ phủ rêu xanh dưới ánh hoàng hôn.',                 sky1: '#3b4d63', sky2: '#cbd5e1', grass: '#526052', dirt: '#3f3f46', water: '#334155', tree: '#64748b', trunk: '#27272a', accent: '#84cc16', kind: 'city' },
  grand_ruins:    { label: '🏛️ Tàn Tích Cổng End', desc: 'Khu tàn tích cổ đại 1000×1000 hùng vĩ với Đền Cổng The End, vòm đá rêu, thác nước, tượng cổ và vực dung nham.',      sky1: '#235a78', sky2: '#c8ead8', grass: '#4f8c3c', dirt: '#5c6266', water: '#2563eb', tree: '#3b7d31', trunk: '#4b5563', accent: '#34d399', kind: 'castle' },
  seaport:        { label: '⚓ Cảng Biển',        desc: 'Bến cảng gỗ sồi sầm uất vươn ra vịnh biển xanh biếc cùng ngọn hải đăng phát sáng rực.',                              sky1: '#2589e8', sky2: '#d8f0ff', grass: '#52a33a', dirt: '#785130', water: '#1d4ed8', tree: '#ef4444', trunk: '#f8fafc', accent: '#fde047', kind: 'seaport' },
  blue_forest:    { label: '💙 Rừng Xanh Lam',    desc: 'Rừng cây lá xanh lam huyền ảo xen lẫn nấm đỏ khổng lồ, thảm cỏ ngọc lam và đèn lồng dọc lối mòn.',                   sky1: '#1a6fd6', sky2: '#9fe8f8', grass: '#25a89d', dirt: '#5c6e8a', water: '#1e88e5', tree: '#1d8cf8', trunk: '#788ba3', accent: '#dc2626', kind: 'trees' },
  wheat_valley:   { label: '🌾 Cánh Đồng Lúa',    desc: 'Cánh đồng lúa mì chín vàng bất tận hòa cùng ánh hoàng hôn ấm chill và những chiếc cối xay gió cổ kính.', sky1: '#1c244f', sky2: '#f59f63', grass: '#d99e26', dirt: '#6b4423', water: '#2563eb', tree: '#eab308', trunk: '#5c3a21', accent: '#fde047', kind: 'trees' },
  pine_valley:    { label: '🏡 Thung Lũng Thông', desc: 'Thung lũng thông xanh thẫm cùng căn nhà thợ rèn cổ kính ống khói cao mái ngói cam và hiên lò ấm.',                   sky1: '#2b7be0', sky2: '#cfe7fa', grass: '#4fa832', dirt: '#7a5230', water: '#2584c6', tree: '#295748', trunk: '#4a3525', accent: '#b85c3e', kind: 'trees' },
  giant_jungle:   { label: '🌴 Rừng Đại Thụ',     desc: 'Rừng nhiệt đới cây đại thụ tán dù cao vút bên dòng sông êm đềm với những màn dây leo xanh rủ dài.',                  sky1: '#1d75d8', sky2: '#b8e8f5', grass: '#3fa334', dirt: '#5c4228', water: '#1e7fb8', tree: '#3a7d34', trunk: '#6d4c2f', accent: '#84cc16', kind: 'trees' },
  ancient_city:   { label: '👁️ Thành Phố Cổ',     desc: 'Thành phố cổ đại sâu dưới lòng núi với đại cổng đá cổ, lửa xanh, thảm len và Warden canh giữ.', sky1: '#040911', sky2: '#0c2736', grass: '#09242e', dirt: '#1f222b', water: '#0891b2', tree: '#22d3ee', trunk: '#2a2e38', accent: '#22d3ee', kind: 'sift' },
  highland:       { label: '⛰️ Cao Nguyên',        desc: 'Vùng cao nguyên rộng lớn với vách núi đất sét, thảm cỏ cao và tầm nhìn bao quát biển mây.',                 sky1: '#2672d6', sky2: '#c5e2fa', grass: '#65a30d', dirt: '#a16244', water: '#2584c6', tree: '#4d7c0f', trunk: '#6d4c2f', accent: '#e7e5e4', kind: 'trees' },
  lush_steppe:    { label: '🌿 Đồng Bằng Xanh',    desc: 'Đồng bằng cỏ xanh trải dài 2000–5000m thích hợp xây thành quách, làng mạc và trang trại lúa.',              sky1: '#217ef0', sky2: '#d5f2ff', grass: '#58b942', dirt: '#448c2d', water: '#2aa4e0', tree: '#4ea832', trunk: '#6d4c2f', accent: '#fde047', kind: 'trees' },
  green_plains:   { label: '🌿 Đồng Bằng Cỏ Xanh', desc: 'Thảo nguyên cỏ xanh mướt rộng thoáng với thảm cỏ rậm, làng mạc và đàn vật nuôi tự nhiên.',              sky1: '#2b88f2', sky2: '#d8f1ff', grass: '#59be3f', dirt: '#6f4c30', water: '#2aa4e0', tree: '#52aa36', trunk: '#6d4c2f', accent: '#86efac', kind: 'trees' },
  snowy_plains:   { label: '❄️ Đồng Bằng Tuyết',   desc: 'Đồng bằng tuyết trắng mênh mông với đất tuyết, cỏ tuyết trắng, hồ băng và thông thưa.',                 sky1: '#75afe8', sky2: '#e9f6ff', grass: '#eff8ff', dirt: '#7a583b', water: '#7dd3fc', tree: '#265c3a', trunk: '#4b331c', accent: '#e0f2fe', kind: 'snow' },
  dark_forest:    { label: '🌑 Rừng Tối',          desc: 'Rừng sồi đen tán rậm rạp phủ bóng râm âm u cùng nấm đỏ khổng lồ và thảm rêu cổ thụ.',                     sky1: '#141e26', sky2: '#2d3b32', grass: '#2c4c26', dirt: '#3f2e21', water: '#1e3a4c', tree: '#1e3a1a', trunk: '#3b2416', accent: '#ef4444', kind: 'trees' },
  pale_garden:    { label: '🤍 Rừng Nhợt Nhạt',    desc: 'Khu rừng sồi trắng nhợt nhạt bao phủ bởi rêu xám bạc và lớp sương mù lạnh buốt giăng lối.',                sky1: '#64748b', sky2: '#cbd5e1', grass: '#94a3b8', dirt: '#64748b', water: '#475569', tree: '#cbd5e1', trunk: '#94a3b8', accent: '#e2e8f0', kind: 'trees' },
  nightmare_woods:{ label: '🕸️ Rừng Ác Mộng',      desc: 'Khu rừng ma quái chìm trong màn sương tím sẫm đặc quánh làm hạn chế tầm nhìn ở xa!',                        sky1: '#09030b', sky2: '#3b0724', grass: '#3b152a', dirt: '#1f0b18', water: '#581c87', tree: '#4c0519', trunk: '#1c1917', accent: '#f43f5e', kind: 'sift' },
  sulfur_springs: { label: '🧪 Suối Lưu Huỳnh',    desc: 'Hồ nước nóng ngọc lam xếp tầng với thềm lưu huỳnh vàng rực, đá chu sa đỏ, cột hơi phun và Slime Lưu Huỳnh.', sky1: '#1d7ee8', sky2: '#d5f3ff', grass: '#eab308', dirt: '#991b1b', water: '#06b6d4', tree: '#295748', trunk: '#4a3525', accent: '#fde047', kind: 'trees' },
  dim_sift:       { label: '✨ Khu Giấc Mơ',       desc: 'Chiều không gian mộng mơ The Sift với cực quang ngọc lục bảo, hồ Ichor phát sáng và tán cây huyền ảo.',               sky1: '#16284c', sky2: '#5eead4', grass: '#c084fc', dirt: '#6d28d9', water: '#2dd4bf', tree: '#f0abfc', trunk: '#312e81', accent: '#fef08a', kind: 'sift' },
  dim_nether:     { label: '🔥 Địa Ngục',         desc: 'Thế giới dung nham đỏ rực với rừng nấm Crimson và đá Netherrack rực lửa.',                                            sky1: '#450a0a', sky2: '#991b1b', grass: '#7f1d1d', dirt: '#450a0a', water: '#f97316', tree: '#b91c1c', trunk: '#292524', accent: '#facc15', kind: 'nether' },
  dim_end:        { label: '🐉 Thành Phố End',    desc: 'Hư không tím thẫm với đảo End Stone lơ lửng, trụ Hắc Diện Thạch và tháp Purpur phát sáng.',                           sky1: '#090514', sky2: '#2e1065', grass: '#e9d594', dirt: '#c2ad6b', water: '#1e1b4b', tree: '#18181b', trunk: '#09090b', accent: '#e879f9', kind: 'end' },
  dim_dragon_realm:{ label: '🌌 Thế Giới Rồng End', desc: 'Chiều không gian rồng huyền thoại với 5 quần xã, Thành Cổ Purpur, Hang Pha Lê & Boss Tối Thượng 50 Skill.',          sky1: '#070316', sky2: '#3b0764', grass: '#a855f7', dirt: '#4c1d95', water: '#6d28d9', tree: '#c084fc', trunk: '#1e1b4b', accent: '#f0abfc', kind: 'end' },
  dim_warden:     { label: '👁️ Thế Giới Warden',  desc: 'Chiều không gian Cổ Thành Sculk huyền bí với Rừng Linh Hồn, Boss 1000HP và Quặng Tier 6.',                            sky1: '#030b14', sky2: '#082635', grass: '#0a2a36', dirt: '#151b24', water: '#06b6d4', tree: '#0ea5e9', trunk: '#111827', accent: '#22d3ee', kind: 'sift' }
};

const _oreThumb3DCache = new Map();
let _oreThumbRT = null;
let _oreThumbPxBuf = null;
let _oreThumbMat = null;
function drawOreWorldThumb(biomeKey) {
  if (typeof renderReal3DWorldThumb === 'function' && renderReal3DWorldThumb(biomeKey)) return;
  const cv = document.getElementById('oreWorldThumbCanvas');
  const badge = document.getElementById('oreWorldThumbBadge');
  const p = ORE_BIOME_PREVIEWS[biomeKey] || ORE_BIOME_PREVIEWS.sakura;
  if (badge) badge.textContent = p.label;
  if (!cv) return;
  const c = cv.getContext('2d');
  if (!c) return;
  const W = cv.width, H = cv.height, px = 8; // 40x22 crisp voxel preview grid
  const rect = (gx, gy, gw, gh, col) => { c.fillStyle = col; c.fillRect(gx * px, gy * px, gw * px, gh * px); };

  // Sky gradient bands
  const gSky = c.createLinearGradient(0, 0, 0, H * 0.56);
  gSky.addColorStop(0, p.sky1);
  gSky.addColorStop(1, p.sky2);
  c.fillStyle = gSky;
  c.fillRect(0, 0, W, H);

  // Clouds or aurora / stars
  if (p.kind === 'sift') {
    rect(4, 2, 14, 2, 'rgba(94,234,212,0.55)');
    rect(12, 4, 18, 2, 'rgba(240,171,252,0.55)');
    rect(22, 2, 12, 2, 'rgba(125,211,252,0.5)');
    for (const [sx, sy] of [[5, 3], [16, 2], [29, 3], [35, 5], [9, 6]]) rect(sx, sy, 1, 1, '#fef9c3');
  } else if (p.kind === 'end') {
    for (const [sx, sy] of [[3, 2], [9, 4], [15, 2], [23, 3], [31, 2], [36, 5], [27, 6]]) rect(sx, sy, 1, 1, '#e9d5ff');
  } else if (p.kind !== 'nether') {
    rect(5, 2, 7, 2, 'rgba(255,255,255,0.85)');
    rect(7, 1, 4, 1, 'rgba(255,255,255,0.92)');
    rect(23, 3, 9, 2, 'rgba(255,255,255,0.8)');
    rect(26, 2, 4, 1, 'rgba(255,255,255,0.9)');
  } else {
    rect(0, 0, 40, 3, '#3b0a0a');
    rect(6, 3, 5, 2, '#5c1212');
    rect(26, 3, 7, 2, '#5c1212');
  }

  // Horizon terrain & water river/lagoon
  rect(0, 12, 40, 11, p.dirt);
  rect(0, 11, 40, 3, p.grass);
  rect(11, 13, 18, 10, p.water);
  rect(14, 14, 12, 8, p.water);
  // Shimmering pixel highlights on water/lava
  rect(15, 15, 5, 1, 'rgba(255,255,255,0.32)');
  rect(19, 18, 6, 1, 'rgba(255,255,255,0.26)');
  if (p.kind === 'trees' || p.kind === 'beach') {
    rect(16, 12, 7, 2, '#f3e3a3'); // Sandbar like reference screenshot!
  }

  // Biome-specific voxel foreground landmarks
  if (p.kind === 'trees' || p.kind === 'sift') {
    // Left & right chunky voxel trees
    rect(4, 9, 2, 7, p.trunk); rect(1, 5, 8, 5, p.tree); rect(2, 4, 6, 2, p.accent);
    rect(33, 8, 2, 7, p.trunk); rect(30, 4, 8, 5, p.tree); rect(31, 3, 6, 2, p.accent);
    rect(10, 9, 1, 4, p.trunk); rect(8, 7, 5, 3, p.tree);
    if (p.kind === 'sift') {
      for (const [fx, fy] of [[13, 11], [20, 9], [26, 12], [17, 16]]) rect(fx, fy, 1, 1, p.accent);
    }
  } else if (p.kind === 'city') {
    rect(3, 5, 6, 10, p.tree); rect(4, 7, 1, 1, p.accent); rect(7, 9, 1, 1, '#1e293b');
    rect(29, 3, 8, 12, p.tree); rect(31, 5, 2, 2, '#1e293b'); rect(34, 8, 2, 2, '#1e293b');
    rect(30, 12, 4, 2, p.accent);
  } else if (p.kind === 'castle') {
    rect(13, 5, 14, 8, p.tree); rect(13, 4, 2, 1, p.tree); rect(17, 4, 2, 1, p.tree); rect(21, 4, 2, 1, p.tree); rect(25, 4, 2, 1, p.tree);
    rect(18, 9, 4, 4, p.trunk); rect(19, 2, 2, 3, p.accent);
  } else if (p.kind === 'beach') {
    rect(5, 8, 2, 7, p.trunk); rect(2, 6, 8, 2, p.tree); rect(4, 5, 4, 1, p.tree);
    rect(32, 9, 2, 6, p.trunk); rect(29, 7, 8, 2, p.tree);
  } else if (p.kind === 'bamboo') {
    for (const bx of [3, 6, 9, 30, 33, 36]) {
      rect(bx, 3, 1, 12, p.tree);
      rect(bx, 6, 1, 1, p.trunk);
      rect(bx, 10, 1, 1, p.trunk);
    }
    rect(4, 4, 4, 2, p.accent); rect(31, 5, 5, 2, p.accent);
  } else if (p.kind === 'seaport') {
    rect(31, 4, 4, 10, p.trunk); rect(31, 6, 4, 2, p.tree); rect(31, 10, 4, 2, p.tree);
    rect(32, 3, 2, 1, p.accent);
    rect(4, 13, 12, 2, p.dirt); rect(6, 15, 1, 3, p.dirt); rect(12, 15, 1, 3, p.dirt);
  } else if (p.kind === 'nether') {
    rect(2, 4, 6, 10, p.tree); rect(31, 5, 7, 9, p.tree);
    rect(16, 15, 8, 2, p.accent); rect(19, 18, 5, 1, '#fef08a');
  } else if (p.kind === 'end') {
    rect(6, 4, 3, 10, p.tree); rect(7, 3, 1, 1, p.accent);
    rect(30, 3, 3, 11, p.tree); rect(31, 2, 1, 1, p.accent);
    rect(18, 5, 3, 9, p.tree); rect(19, 4, 1, 1, p.accent);
  }

  // Crisp Minecraft pixel block grid sheen
  c.strokeStyle = 'rgba(0,0,0,0.08)';
  c.lineWidth = 1;
  for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}

function drawActiveSkinHeadCanvas(wrap, skinId) {
  if (!wrap) return;
  let cv = wrap.querySelector('canvas.ore-avatar-cv');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.className = 'ore-avatar-cv';
    cv.width = 16;
    cv.height = 16;
    wrap.textContent = '';
    wrap.appendChild(cv);
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const sk = typeof getSkinDef === 'function' ? getSkinDef(skinId) : null;
  const srcCv = typeof getSkinCanvas === 'function' ? getSkinCanvas(skinId) : null;
  ctx.clearRect(0, 0, 16, 16);
  if (srcCv && srcCv.width >= 64 && srcCv.height >= 64) {
    ctx.drawImage(srcCv, 8, 8, 8, 8, 0, 0, 16, 16);
    ctx.drawImage(srcCv, 40, 8, 8, 8, 0, 0, 16, 16);
    return;
  }
  ctx.fillStyle = (sk && sk.skin) || '#c6906b';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = (sk && sk.hair) || '#3b2616';
  ctx.fillRect(0, 0, 16, 4);
  ctx.fillStyle = (sk && sk.eye) || '#4f3799';
  ctx.fillRect(3, 8, 2, 2);
  ctx.fillRect(11, 8, 2, 2);
}

function syncTitleAvatarFace() {
  if (typeof syncAllPlayerAvatarFaces === 'function') syncAllPlayerAvatarFaces();
}

  let activeRoomId = null, wsConn = null, bcChannel = null, localPeerId = 'L_' + Math.random().toString(36).slice(2, 7);
  let isApplyingRemoteBlock = false, stateSendAccum = 0;
  const remotePlayers = new Map(); // peerId -> { id, name, color, isBuddy, x, y, z, yaw, pitch, speed, sprinting, sneaking, inWater, onGround, swing, rig, wanderT }
  const locatorBarEl = document.getElementById('locatorBar');

  function getSavedWorldsList() {
    try {
      const list = JSON.parse(localStorage.getItem(WORLDS_KEY) || '[]');
      let changed = false;
      for (const w of list) {
        if (w && !w.roomId) {
          w.roomId = (typeof mintPermanentRoomCode === 'function') ? mintPermanentRoomCode() : ('LC' + Math.random().toString(36).slice(2, 6).toUpperCase());
          changed = true;
        }
      }
      if (changed) try { localStorage.setItem(WORLDS_KEY, JSON.stringify(list)); } catch (_) {}
      return list;
    } catch (_) { return []; }
  }
  function _captureLiveWorldThumb(fallback) {
    try {
      if (typeof inLobby !== 'undefined' && inLobby) return fallback || null;
      if (typeof renderer === 'undefined' || !renderer || !renderer.domElement) return fallback || null;
      if (typeof renderMainScene === 'function') renderMainScene(0.016);
      const c = document.createElement('canvas'); c.width = 160; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.drawImage(renderer.domElement, 0, 0, 160, 100);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (_) { return fallback || null; }
  }
  function saveCurrentWorldToList() {
    try {
      if (!currentWorldMeta.roomId) currentWorldMeta.roomId = (typeof mintPermanentRoomCode === 'function') ? mintPermanentRoomCode() : ('LC' + Math.random().toString(36).slice(2, 6).toUpperCase());
      const thumbUrl = _captureLiveWorldThumb(currentWorldMeta.thumb || null);
      if (thumbUrl) currentWorldMeta.thumb = thumbUrl;
      const list = getSavedWorldsList().filter(w => w.id !== currentWorldMeta.id);
      const modsArr = []; for (const [k, v] of worldMods.entries()) modsArr.push([k, v]);
      if (typeof saveWorldModsIdb === 'function') saveWorldModsIdb(currentWorldMeta.id, worldMods);
      list.unshift({
        ...currentWorldMeta,
        thumb: currentWorldMeta.thumb || undefined,
        updatedAt: Date.now(),
        player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, hp: player.hp, armor: player.armor, equip: player.equip, equipMeta: player.equipMeta, offhandDur: player.offhandDur || 336, offhandMaxDur: player.offhandMaxDur || 336, hunger: player.hunger, xp: player.xp, level: player.level, daysPlayed: player.daysPlayed, swiftSneak: player.swiftSneak || 0, bedSpawn: player.bedSpawn || null },
        inventory, dayTime, weatherMode, depthOffset, currentDimension, hasIdbMods: true, modsCount: worldMods.size, mods: modsArr.slice(-1500),
        savedMobs: (typeof serializeMobsForSave === 'function') ? serializeMobsForSave() : [],
        ...serializeChestData()
      });
      localStorage.setItem(WORLDS_KEY, JSON.stringify(list.slice(0, 8)));
      if (typeof window.scheduleAccountCloudSync === 'function') window.scheduleAccountCloudSync();
    } catch (_) {}
  }

function renderSavedWorldsList() {
  const box = document.getElementById('savedWorldsList');
  const list = getSavedWorldsList();
  const tabLbl = document.getElementById('tabLblWorlds');
  if (tabLbl) tabLbl.textContent = tr(`Thế giới đã lưu (${list.length})`, `Saved Worlds (${list.length})`);
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div class="room-status-box">${tr('Chưa có thế giới nào được lưu. Bấm <b>+ Tạo thế giới mới</b> để bắt đầu cuộc phiêu lưu!', 'No saved worlds yet. Click <b>+ Create New World</b> to start your adventure!')}</div>`;
    return;
  }
  box.innerHTML = '';
  for (const w of list) {
    const bioInfo = ORE_BIOME_PREVIEWS[w.biome] || ORE_BIOME_PREVIEWS.sakura;
    const diffInfo = DIFFICULTY_CFG[w.difficulty] || DIFFICULTY_CFG.normal;
    const bioLbl = typeof getLocBiomeLabel === 'function' ? getLocBiomeLabel(w.biome) : bioInfo.label;
    const diffLbl = typeof getLocDiffLabel === 'function' ? getLocDiffLabel(w.difficulty) : diffInfo.label;
    const dtStr = new Date(w.updatedAt || Date.now()).toLocaleString(currentLang === 'en' ? 'en-US' : 'vi-VN');
    const rCode = String(w.roomId || '').toUpperCase();
    const liveInfo = (rCode && typeof liveRoomsByCode !== 'undefined') ? liveRoomsByCode.get(rCode) : null;
    const livePlayers = liveInfo ? (Number(liveInfo.players) || 0) : 0;
    const thumbStyle = w.thumb
      ? `background-image:url('${w.thumb}');background-size:cover;background-position:center;`
      : `background:linear-gradient(180deg, ${bioInfo.sky1} 0%, ${bioInfo.sky2} 46%, ${bioInfo.grass} 47%, ${bioInfo.dirt} 100%);`;
    const card = document.createElement('div');
    card.className = 'ore-world-card';
    card.innerHTML = `
      <div class="ore-world-thumb" style="${thumbStyle}"></div>
      <div class="ore-world-info">
        <div class="ore-world-name">${escHtml(w.name || tr('Thế giới của tôi', 'My World'))}</div>
        <div class="ore-world-sub">Seed: ${w.seed} • ${bioLbl} • ${dtStr}</div>
        <div class="ore-world-tags">
          <span class="ore-tag">${w.mode === 'creative' ? tr('Sáng tạo', 'Creative') : tr('Sinh tồn', 'Survival')}</span>
          <span class="ore-tag diff">${diffLbl}</span>
          ${rCode ? `<span class="ore-tag">🔑 ${escHtml(rCode)}</span>` : ''}
          ${w.shareWithFriends !== false ? `<span class="ore-tag" style="${livePlayers > 0 ? 'background:#14532d;color:#bbf7d0;border-color:#22c55e;' : ''}">${livePlayers > 0 ? `🟢 Đang chơi: ${livePlayers} người` : '⚪ 0 người trong map'}</span>` : ''}
        </div>
      </div>
    `;
    const acts = document.createElement('div');
    acts.className = 'ore-world-right';
    const bPlay = document.createElement('button');
    bPlay.className = 'mc-btn mc-btn-green';
    bPlay.type = 'button';
    bPlay.textContent = tr('▶ Chơi', '▶ Play');
    bPlay.addEventListener('click', (e) => { e.stopPropagation(); loadSavedWorldEntry(w); });
    const bDel = document.createElement('button');
    bDel.className = 'mc-btn mc-btn-red';
    bDel.type = 'button';
    bDel.title = tr('Xóa thế giới', 'Delete World');
    bDel.textContent = '🗑';
    bDel.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = getSavedWorldsList().filter(x => x.id !== w.id);
      try { localStorage.setItem(WORLDS_KEY, JSON.stringify(next)); } catch (_) {}
      if (typeof deleteWorldModsIdb === 'function') deleteWorldModsIdb(w.id);
      renderSavedWorldsList();
    });
    card.addEventListener('click', () => loadSavedWorldEntry(w));
    acts.append(bPlay, bDel);
    card.appendChild(acts);
    box.appendChild(card);
  }
}

  function loadSavedWorldEntry(w) {
    document.getElementById('friendsModal')?.classList.add('hidden');
    document.getElementById('addFriendModal')?.classList.add('hidden');
    document.getElementById('profileModal')?.classList.add('hidden');
    const _doLoadSaved = async () => {
      let idbMods = null;
      if (w.hasIdbMods && typeof loadWorldModsIdb === 'function') {
        idbMods = await loadWorldModsIdb(w.id);
      }
      const uid = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || localPlayerName || 'Người chơi';
      localPlayerName = uid;
      const permRoomId = w.roomId || (typeof mintPermanentRoomCode === 'function' ? mintPermanentRoomCode() : ('LC' + Math.random().toString(36).slice(2, 6).toUpperCase()));
      currentWorldMeta = { id: w.id, roomId: permRoomId, name: w.name, seed: w.seed, mode: w.mode || 'survival', difficulty: w.difficulty || 'normal', biome: w.biome || 'sakura', preset: w.preset || 'bsl', shareWithFriends: w.shareWithFriends !== false };
      gameMode = currentWorldMeta.mode;
      if (typeof syncMobSpawnLockUI === 'function') syncMobSpawnLockUI();
      worldDifficulty = currentWorldMeta.difficulty;
      window._justLoadedLocalSaveAt = Date.now();
      resetWorld(w.seed, { deferSpawnChunks: true });
    if (typeof w.depthOffset === 'number') depthOffset = w.depthOffset;
    if (typeof w.currentDimension === 'string') currentDimension = w.currentDimension;
    if (w.player) Object.assign(player, w.player);
    if (!player.equipMeta) player.equipMeta = { helmet: null, chest: null, legs: null, boots: null, offhand: null };
    if (Array.isArray(w.inventory) && w.inventory.length === 36) {
      for (let i = 0; i < 36; i++) {
        const s = w.inventory[i], def = BLOCK_DEF[s.id];
        inventory[i].id = s.id || 0; inventory[i].count = s.count || 0;
        inventory[i].maxDur = s.maxDur || (def && def.maxDur) || 0;
        inventory[i].dur = s.dur !== undefined ? s.dur : inventory[i].maxDur;
        inventory[i].ench = !!s.ench;
        inventory[i].trim = s.trim ? { ...s.trim } : null;
      }
    }
    recalcPlayerArmor();
    if (typeof w.dayTime === 'number') dayTime = w.dayTime;
    if (typeof w.weatherMode === 'string') weatherMode = w.weatherMode;
    _clearWorldInteractiveCaches(true, false);
    if (typeof rebuildCurrentDimModIndex === 'function') rebuildCurrentDimModIndex();
    const modsSrc = (Array.isArray(idbMods) && idbMods.length > 0) ? idbMods : w.mods;
    if (Array.isArray(modsSrc)) for (const [k, v] of modsSrc) { worldMods.set(k, v); indexWorldModKey(k, v); }
    lastPlayerCx = 99999; lastPlayerCz = 99999;
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(pcx + dx, pcz + dz);
    if (currentDimension === 'dragon_realm') generateChunk(1, 3);
    restoreChestData(w);
    if (Array.isArray(w.savedMobs)) {
      if (typeof restoreMobsFromSave === 'function') restoreMobsFromSave(w.savedMobs);
    } else if (typeof spawnFallbackDimMobs === 'function') {
      spawnFallbackDimMobs();
    }
    mobSpawnTimer = 2.0;
    if (!isWorldLoading) { for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch); }
    applyShaderPreset(window._cartoonAddonActive ? 'cartoon_barebones' : (shaderPreset === 'eclipse' ? 'eclipse' : (currentWorldMeta.preset || 'eclipse')));
    renderHotbar(); renderStatusBars(); renderXpBar(); renderEquipmentUI();
      document.getElementById('lobbyScreen').classList.add('hidden');
      if (!isWorldLoading) startPlaying();
      if (currentWorldMeta.shareWithFriends) {
        try { window._nextCreateRoomFresh = false; hostCoopRoom(currentWorldMeta.roomId); } catch (_) {}
      }
      if (typeof broadcastFriendWorldPresence === 'function') broadcastFriendWorldPresence();
    };
    if (typeof showWorldLoadingOverlay === 'function') {
      showWorldLoadingOverlay('Đang tải thế giới...', `Đang khôi phục thế giới "${w.name || 'Thế giới'}" và đồng bộ địa hình...`, _doLoadSaved);
    } else {
      _doLoadSaved();
    }
  }

function parseCustomOrRandomSeed(rawSeed) {
  const s = String(rawSeed || '').trim();
  if (!seedUserEdited || !s) return generateUniqueRandomSeed();
  if (/^-?\d+$/.test(s)) {
    const n = Math.abs(parseInt(s, 10)) % 2147483647;
    return n || generateUniqueRandomSeed();
  }
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2147483647 || generateUniqueRandomSeed();
}

function launchWorldFromLobby(opts, hostCoop = false) {
  document.getElementById('friendsModal')?.classList.add('hidden');
  document.getElementById('addFriendModal')?.classList.add('hidden');
  document.getElementById('profileModal')?.classList.add('hidden');
  const seedNum = parseCustomOrRandomSeed(opts.seed);
  const _seedEl = document.getElementById('inpWorldSeed');
  if (_seedEl && !seedUserEdited) _seedEl.value = '';
  const lockedUid = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || '';
  localPlayerName = lockedUid || (opts.playerName || 'Người chơi').trim().slice(0, 18) || 'Người chơi';
  gameMode = opts.mode || 'survival';
  if (typeof syncMobSpawnLockUI === 'function') syncMobSpawnLockUI();
  worldDifficulty = (opts.difficulty && DIFFICULTY_CFG[opts.difficulty]) ? opts.difficulty : (lobbyDifficulty || 'normal');
  const shareFriends = (opts.shareWithFriends !== undefined) ? !!opts.shareWithFriends : (typeof isShareWithFriendsEnabled === 'function' ? isShareWithFriendsEnabled() : true);
  let chosenBiome = opts.biome || 'sakura';
  if ((chosenBiome === 'dim_sift' || String(chosenBiome).startsWith('sift_')) && !isAdminUnlocked) {
    chosenBiome = 'sakura';
  }
  const worldNameClean = (opts.name || 'Thế Giới Mới').trim() || 'Thế Giới Mới';

  const _doCreateWorld = () => {
    const permRoomId = (typeof mintPermanentRoomCode === 'function') ? mintPermanentRoomCode() : ('LC' + Math.random().toString(36).slice(2, 6).toUpperCase());
    currentWorldMeta = {
      id: 'w_' + Date.now(),
      roomId: permRoomId,
      name: worldNameClean,
      seed: seedNum,
      mode: gameMode,
      difficulty: worldDifficulty,
      biome: chosenBiome,
      preset: opts.preset || lobbyShader || 'eclipse',
      shareWithFriends: shareFriends
    };
    resetWorld(seedNum, { deferSpawnChunks: true });
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.body.classList.remove('in-lobby');
    applyShaderPreset(window._cartoonAddonActive ? 'cartoon_barebones' : (shaderPreset === 'eclipse' ? 'eclipse' : (currentWorldMeta.preset || 'eclipse')));
    try { teleportToScenicBiome(chosenBiome, { preserveShader: true }); } catch (err) { console.error('Biome teleport error:', err); }
    window._worldSpawnPos = { x: player.x, y: player.y, z: player.z, yaw: player.yaw };
    if (currentDimension === 'overworld') {
      _ruinOriginX = Math.round(player.x);
      _ruinOriginZ = Math.round(player.z);
      _ruinLocSeed = -1;
      const _rs = getDreamRuinLocations();
      if (_rs && _rs[0]) stampDreamRuinAltar(_rs[0]);
    }
    if (!isPlaying && !isWorldLoading) startPlaying();
    saveCurrentWorldToList();
    if (hostCoop || shareFriends) { window._nextCreateRoomFresh = true; hostCoopRoom(permRoomId); }
    if (typeof broadcastFriendWorldPresence === 'function') broadcastFriendWorldPresence();
  };

  if (typeof showWorldLoadingOverlay === 'function') {
    document.getElementById('lobbyScreen')?.classList.add('hidden');
    document.body.classList.remove('in-lobby');
    showWorldLoadingOverlay(
      tr('Đang tạo thế giới mới...', 'Creating New World...'),
      tr(`Đang khởi tạo hạt giống #${seedNum} (${typeof getLocDiffLabel === 'function' ? getLocDiffLabel(worldDifficulty) : getDifficultyCfg(worldDifficulty).label}) và dựng địa hình...`, `Initializing seed #${seedNum} (${typeof getLocDiffLabel === 'function' ? getLocDiffLabel(worldDifficulty) : getDifficultyCfg(worldDifficulty).label}) and generating terrain...`),
      _doCreateWorld
    );
  } else {
    _doCreateWorld();
  }
}


  // Lobby UI Event Listeners (including Interactive 3D Minecraft Voxel Skin Picker & ESC 4-Tab Menu!)
  let lobbyMode = 'survival', lobbyBiome = 'sakura', lobbyShader = 'eclipse';
  let skinPreviewRotY = 0.42, skinPreviewRig = null, skinPreviewRenderer = null, skinPreviewScene = null, skinPreviewCam = null;
  let titleSkinRotY = -0.36, titleSkinRig = null, titleSkinRenderer = null, titleSkinScene = null, titleSkinCam = null;

  function renderSkinPreview3DOnce() {
    if (skinPreviewRenderer && skinPreviewScene && skinPreviewCam && skinPreviewRig) {
      skinPreviewRig.g.rotation.y = skinPreviewRotY;
      skinPreviewRenderer.render(skinPreviewScene, skinPreviewCam);
    }
    if (titleSkinRenderer && titleSkinScene && titleSkinCam && titleSkinRig) {
      titleSkinRig.g.rotation.y = titleSkinRotY;
      titleSkinRenderer.render(titleSkinScene, titleSkinCam);
    }
  }

  function updateDressingRoomCarousel() {
    const idx = Math.max(0, PLAYER_SKINS.findIndex(s => s.id === selectedSkinId));
    const n = PLAYER_SKINS.length;
    const drOpen = !document.getElementById('dressingRoomScreen')?.classList.contains('hidden');
    if (drOpen) {
      const slotMap = [
        ['drSlotM2', (idx - 2 + n) % n],
        ['drSlotM1', (idx - 1 + n) % n],
        ['drSlotP1', (idx + 1) % n],
        ['drSlotP2', (idx + 2) % n],
      ];
      for (const [elId, sIdx] of slotMap) {
        const box = document.getElementById(elId);
        if (!box) continue;
        const sk = PLAYER_SKINS[sIdx];
        box.dataset.skin = sk.id;
        const cv = box.querySelector('canvas');
        if (cv) drawSkinThumbPortrait(cv, sk.id);
        const sp = box.querySelector('span');
        if (sp) sp.textContent = sk.name;
      }
    }
    const skCur = getSkinDef(selectedSkinId);
    const displayName = selectedSkinId === 'custom' ? 'Skin Tùy Chỉnh (.PNG)' : skCur.name;
    const cName = document.getElementById('drCenterSkinName');
    if (cName) cName.textContent = displayName;
    const cStat = document.getElementById('drCurrentSkinStatus');
    if (cStat) cStat.textContent = `Skin hiện tại: ${displayName}${skCur.pair ? ` • Skin Đôi: ${skCur.pair}` : ''}`;
    const tName = document.getElementById('titleSkinName');
    if (tName) tName.textContent = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) ? getLockedPlayerUid() : displayName;
    document.querySelectorAll('#drSkinStrip .dr-skin-card').forEach(el => {
      const isAct = el.dataset.skin === selectedSkinId;
      el.classList.toggle('active', isAct);
      if (isAct && !document.getElementById('dressingRoomScreen')?.classList.contains('hidden')) {
        const cv = el.querySelector('canvas');
        if (cv && cv.dataset.thumbDrawn !== '1') {
          drawSkinThumbPortrait(cv, el.dataset.skin);
          cv.dataset.thumbDrawn = '1';
        }
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
  }

  let _skinCatalogDirty = true;
  let _skinThumbObserver = null;

  function _syncDrFilterLabels() {
    let pairGroups = 0;
    for (let i = 0; i + 1 < PLAYER_SKINS.length; i++) {
      if (PLAYER_SKINS[i].pair && PLAYER_SKINS[i].pair === PLAYER_SKINS[i + 1].pair) {
        pairGroups++;
        i++;
      }
    }
    const bAll = document.getElementById('btnDrFilterAll');
    const bCpl = document.getElementById('btnDrFilterCouples');
    if (bAll) bAll.textContent = `Tất cả (${PLAYER_SKINS.length})`;
    if (bCpl) bCpl.textContent = `Skin Đôi (${pairGroups})`;
  }

  function openDressingRoom() {
    const lobby = document.getElementById('lobbyScreen');
    const dr = document.getElementById('dressingRoomScreen');
    if (!lobby || !dr) return;
    lobby.classList.remove('hidden', 'sub-open');
    lobby.classList.add('dr-open');
    dr.classList.remove('hidden');
    if (_skinCatalogDirty) renderSkinCatalogUI();
    updateDressingRoomCarousel();
    renderSkinPreview3DOnce();
    requestAnimationFrame(renderSkinPreview3DOnce);
  }
  function closeDressingRoom() {
    const lobby = document.getElementById('lobbyScreen');
    const dr = document.getElementById('dressingRoomScreen');
    if (dr) dr.classList.add('hidden');
    if (lobby) lobby.classList.remove('dr-open');
    renderSkinPreview3DOnce();
  }

  function selectPlayerSkin(skinId, notify = false) {
    if (!PLAYER_SKINS.some(s => s.id === skinId) && skinId !== 'custom') skinId = PLAYER_SKINS[0].id;
    selectedSkinId = skinId;
    try { if (skinId !== 'custom') localStorage.setItem('luanti_skin_id', skinId); } catch (_) {}
    if (typeof window.scheduleAccountCloudSync === 'function') window.scheduleAccountCloudSync();
    applySkinToRig(playerAvatar, skinId);
    if (skinPreviewRig) applySkinToRig(skinPreviewRig, skinId);
    if (titleSkinRig) applySkinToRig(titleSkinRig, skinId);
    if (typeof invPreviewRig !== 'undefined' && invPreviewRig) applySkinToRig(invPreviewRig, skinId);
    renderSkinPreview3DOnce();
    // Refresh 1st-person empty hand to match chosen skin!
    heldModelCache.delete(0);
    if (!inventory[player.selectedSlot]?.id) updateHeldViewModel(0);
    drawCharPreview();
    const sk = getSkinDef(skinId);
    const lbl = document.getElementById('skinSelectedName');
    if (lbl) lbl.textContent = skinId === 'custom' ? 'Skin Tùy Chỉnh (.PNG)' : sk.name;
    document.querySelectorAll('#lobbySkinGrid .skin-card').forEach(el => el.classList.toggle('active', el.dataset.skin === skinId));
    updateDressingRoomCarousel();
    if (typeof syncTitleAvatarFace === 'function') syncTitleAvatarFace();
    if (typeof broadcastSkinSync === 'function') broadcastSkinSync();
    if (notify) showToast(`🧑 Đã chọn Skin: ${skinId === 'custom' ? 'Skin Tùy Chỉnh' : sk.name}!`);
  }

  function removeCustomSkin(skinId) {
    const idx = PLAYER_SKINS.findIndex(s => s.id === skinId && s.isCustom);
    if (idx < 0) return;
    PLAYER_SKINS.splice(idx, 1);
    skinTexCache.delete(skinId);
    skinCanvasCache.delete(skinId);
    _skinViewportThumbCache.delete(skinId);
    saveCustomSkinsList();
    if (selectedSkinId === skinId) selectPlayerSkin(PLAYER_SKINS[0].id, false);
    _skinCatalogDirty = true;
    if (!document.getElementById('dressingRoomScreen')?.classList.contains('hidden')) renderSkinCatalogUI();
    showToast('🗑️ Đã xóa Skin tùy chỉnh!');
  }

  function _createSkinCardEl(sk, className, onPick, eagerDraw = false) {
    const card = document.createElement('div');
    card.className = className + (sk.id === selectedSkinId ? ' active' : '');
    card.dataset.skin = sk.id;
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 116;
    if (eagerDraw) {
      drawSkinThumbPortrait(cv, sk.id);
      cv.dataset.thumbDrawn = '1';
    } else if (typeof IntersectionObserver !== 'function') {
      drawSkinThumbPortrait(cv, sk.id);
      cv.dataset.thumbDrawn = '1';
    }
    const sp = document.createElement('span'); sp.textContent = sk.name;
    card.append(cv, sp);
    if (sk.isCustom) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'dr-skin-del'; del.title = 'Xóa skin này'; del.textContent = '×';
      del.addEventListener('click', (e) => { e.stopPropagation(); removeCustomSkin(sk.id); });
      card.appendChild(del);
    }
    bindSkinThumbHover(card, cv, () => sk.id);
    card.addEventListener('click', () => onPick(sk));
    return card;
  }

  function renderSkinCatalogUI() {
    const grid = document.getElementById('lobbySkinGrid');
    if (grid && grid.offsetParent !== null) {
      grid.innerHTML = '';
      for (const sk of PLAYER_SKINS) {
        grid.appendChild(_createSkinCardEl(sk, 'skin-card', (s) => selectPlayerSkin(s.id, true), true));
      }
    }
    const drStrip = document.getElementById('drSkinStrip');
    if (drStrip) {
      if (_skinThumbObserver) { _skinThumbObserver.disconnect(); _skinThumbObserver = null; }
      drStrip.innerHTML = '';
      const lazyCards = [];
      for (let i = 0; i < PLAYER_SKINS.length; i++) {
        const sk = PLAYER_SKINS[i];
        const nextSk = (i + 1 < PLAYER_SKINS.length) ? PLAYER_SKINS[i + 1] : null;
        if (sk.pair && nextSk && nextSk.pair === sk.pair) {
          const grp = document.createElement('div');
          grp.className = 'dr-pair-group';
          grp.dataset.pair = sk.pair;
          const tag = document.createElement('div');
          tag.className = 'dr-pair-tag';
          tag.textContent = `Skin Đôi: ${sk.pair}`;
          const row = document.createElement('div');
          row.className = 'dr-pair-cards';
          const c1 = _createSkinCardEl(sk, 'dr-skin-card', (s) => selectPlayerSkin(s.id, false), i < 8 || sk.id === selectedSkinId);
          const c2 = _createSkinCardEl(nextSk, 'dr-skin-card', (s) => selectPlayerSkin(s.id, false), i + 1 < 8 || nextSk.id === selectedSkinId);
          row.append(c1, c2);
          grp.append(tag, row);
          drStrip.appendChild(grp);
          lazyCards.push(c1, c2);
          i++;
        } else {
          const c = _createSkinCardEl(sk, 'dr-skin-card', (s) => selectPlayerSkin(s.id, false), i < 8 || sk.id === selectedSkinId);
          drStrip.appendChild(c);
          lazyCards.push(c);
        }
      }
      if (typeof IntersectionObserver === 'function') {
        _skinThumbObserver = new IntersectionObserver((entries) => {
          for (const ent of entries) {
            if (!ent.isIntersecting) continue;
            const el = ent.target;
            const cv = el.querySelector('canvas');
            const sid = el.dataset.skin;
            if (cv && sid && cv.dataset.thumbDrawn !== '1') {
              drawSkinThumbPortrait(cv, sid);
              cv.dataset.thumbDrawn = '1';
            }
            _skinThumbObserver?.unobserve(el);
          }
        }, { root: drStrip, rootMargin: '220px', threshold: 0.01 });
        for (const c of lazyCards) {
          if (c.querySelector('canvas')?.dataset.thumbDrawn !== '1') _skinThumbObserver.observe(c);
        }
      }
      _skinCatalogDirty = false;
    }
    const drCnt = document.getElementById('drSkinCountLbl');
    if (drCnt) drCnt.textContent = `${PLAYER_SKINS.length} Skins`;
    _syncDrFilterLabels();
    updateDressingRoomCarousel();
  }

  let _skinThumbRenderer = null, _skinThumbScene = null, _skinThumbCam = null, _skinThumbRig = null;
  let _skinThumbHoverState = null, _skinThumbHoverRaf = 0, _skinThumbHoverLast = 0;

  function _ensureSkinThumbRenderer() {
    if (_skinThumbRenderer || typeof THREE === 'undefined') return _skinThumbRenderer;
    try {
      const w = 96, h = 116;
      const offCv = document.createElement('canvas'); offCv.width = w; offCv.height = h;
      _skinThumbRenderer = new THREE.WebGLRenderer({ canvas: offCv, alpha: true, antialias: false, preserveDrawingBuffer: true });
      _skinThumbRenderer.setSize(w, h, false);
      _skinThumbRenderer.setClearColor(0x000000, 0);
      if (typeof THREE.ACESFilmicToneMapping !== 'undefined') _skinThumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      _skinThumbRenderer.toneMappingExposure = 0.88;
      _skinThumbScene = new THREE.Scene();
      _skinThumbCam = new THREE.PerspectiveCamera(35, w / h, 0.1, 20);
      _skinThumbCam.position.set(0, 0.96, 3.55);
      _skinThumbCam.lookAt(0, 0.95, 0);
      _skinThumbScene.add(new THREE.AmbientLight(0xffffff, 0.62));
      const key = new THREE.DirectionalLight(0xfff8ee, 0.48); key.position.set(2.2, 4.0, 3.2);
      const rim = new THREE.DirectionalLight(0xcbd5e1, 0.20); rim.position.set(-2.5, 2.0, -2.5);
      _skinThumbScene.add(key, rim);
      _skinThumbRig = createPlayerRig(PLAYER_SKINS[0].id, null, null, null);
      _skinThumbScene.add(_skinThumbRig.g);
    } catch (_) {
      _skinThumbRenderer = null;
    }
    return _skinThumbRenderer;
  }

  function drawSkinThumbPortrait(cv, skinId, rotY = 0.36) {
    if (!cv) return;
    const c = cv.getContext('2d');
    if (!c) return;
    const w = cv.width || 96, h = cv.height || 116;
    const isDefaultAngle = Math.abs(rotY - 0.36) < 0.001;
    if (isDefaultAngle && skinId !== 'custom' && _skinViewportThumbCache.has(skinId)) {
      c.clearRect(0, 0, w, h);
      c.drawImage(_skinViewportThumbCache.get(skinId), 0, 0, w, h);
      return;
    }
    const ren = _ensureSkinThumbRenderer();
    if (!ren || !_skinThumbRig) return;
    applySkinToRig(_skinThumbRig, skinId);
    _skinThumbRig.g.rotation.y = rotY;
    _skinThumbRig.hips.position.set(0, 1.125, 0);
    _skinThumbRig.hips.rotation.set(0, 0, 0);
    _skinThumbRig.torso.rotation.set(0, 0, 0);
    _skinThumbRig.head.rotation.set(0.04, -0.10, 0);
    _skinThumbRig.armL.rotation.set(0.08, 0, 0.05);
    _skinThumbRig.armR.rotation.set(-0.08, 0, -0.05);
    _skinThumbRig.legL.rotation.set(-0.04, 0, 0);
    _skinThumbRig.legR.rotation.set(0.04, 0, 0);
    ren.render(_skinThumbScene, _skinThumbCam);

    const frame = document.createElement('canvas'); frame.width = 96; frame.height = 116;
    const fc = frame.getContext('2d');
    const bg = fc.createRadialGradient(48, 42, 4, 48, 56, 62);
    bg.addColorStop(0, 'rgba(255,255,255,0.14)');
    bg.addColorStop(1, 'rgba(15,23,42,0.28)');
    fc.fillStyle = bg;
    fc.fillRect(0, 0, 96, 116);
    fc.fillStyle = 'rgba(0,0,0,0.34)';
    fc.beginPath(); fc.ellipse(48, 104, 24, 5.5, 0, 0, Math.PI * 2); fc.fill();
    fc.drawImage(ren.domElement, 0, 0, 96, 116);

    const srcCv = skinCanvasCache.get(skinId);
    if (isDefaultAngle && skinId !== 'custom' && srcCv && srcCv._decoded) {
      _skinViewportThumbCache.set(skinId, frame);
    }
    c.clearRect(0, 0, w, h);
    c.drawImage(frame, 0, 0, w, h);
  }

  function _stepSkinThumbHover(now) {
    _skinThumbHoverRaf = 0;
    const st = _skinThumbHoverState;
    if (!st || !st.card.isConnected) { _skinThumbHoverState = null; return; }
    const dt = _skinThumbHoverLast ? Math.min(0.05, (now - _skinThumbHoverLast) * 0.001) : 0.016;
    _skinThumbHoverLast = now;
    st.rot += dt * 1.45;
    const sid = st.getId();
    if (sid) drawSkinThumbPortrait(st.cv, sid, st.rot);
    _skinThumbHoverRaf = requestAnimationFrame(_stepSkinThumbHover);
  }

  function bindSkinThumbHover(card, cv, getId) {
    card.addEventListener('pointerenter', () => {
      _skinThumbHoverState = { card, cv, getId, rot: 0.36 };
      _skinThumbHoverLast = 0;
      if (!_skinThumbHoverRaf) _skinThumbHoverRaf = requestAnimationFrame(_stepSkinThumbHover);
    });
    card.addEventListener('pointerleave', () => {
      if (_skinThumbHoverState && _skinThumbHoverState.card === card) _skinThumbHoverState = null;
      const sid = getId();
      if (sid) drawSkinThumbPortrait(cv, sid);
    });
  }

  function refreshSkinThumbCanvases() {
    const drVisible = !document.getElementById('dressingRoomScreen')?.classList.contains('hidden');
    const gridVisible = !!(document.getElementById('lobbySkinGrid')?.offsetParent !== null);
    if (!drVisible && !gridVisible) return;
    document.querySelectorAll('#lobbySkinGrid .skin-card, #drSkinStrip .dr-skin-card, .dr-side-slot').forEach(el => {
      const sid = el.dataset.skin;
      const cv = el.querySelector('canvas');
      if (!sid || !cv) return;
      if (el.classList.contains('dr-side-slot') || el.closest('#lobbySkinGrid') || cv.dataset.thumbDrawn === '1') {
        drawSkinThumbPortrait(cv, sid);
      }
    });
  }

  function addCustomSkinFromImage(img, rawName = '') {
    const norm = normalizeCustomSkinImage(img);
    if (!norm || norm.error) {
      showToast((norm && norm.error) || '⚠ Ảnh PNG không hợp lệ!');
      return null;
    }
    const cleanBase = String(rawName || '').replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 22);
    const customIdx = PLAYER_SKINS.filter(s => s.isCustom).length + 1;
    const id = 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5);
    const entry = {
      id,
      name: cleanBase || `Skin Tùy Chỉnh ${customIdx}`,
      slim: norm.slim,
      skin: norm.skin,
      hair: norm.hair,
      eye: norm.eye,
      sleeve: norm.sleeve,
      png: norm.png,
      isCustom: true
    };
    PLAYER_SKINS.push(entry);
    skinCanvasCache.set(id, norm.canvas);
    skinTexCache.delete(id);
    _skinViewportThumbCache.delete(id);
    saveCustomSkinsList();
    _skinCatalogDirty = true;
    renderSkinCatalogUI();
    selectPlayerSkin(id, true);
    return entry;
  }

  function handleCustomSkinFile(file) {
    if (!file) return;
    if (file.type && file.type !== 'image/png' && !/\.png$/i.test(file.name || '')) {
      showToast('⚠ Vui lòng chọn file ảnh .PNG!');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try { URL.revokeObjectURL(url); } catch (_) {}
      addCustomSkinFromImage(img, file.name);
    };
    img.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {} showToast('⚠ Không đọc được file PNG!'); };
    img.src = url;
  }

  function initLobbySkinPicker() {
    // Lazy skin bootstrap: decode only active skin on startup; defer 33-card 3D strip until Dressing Room opens!
    // 1) Dressing Room Center 3D Character Canvas (#drSkinPreview3D)
    const drCanvas = document.getElementById('drSkinPreview3D') || document.getElementById('skinPreview3D');
    if (drCanvas && !skinPreviewRenderer) {
      try {
        skinPreviewRenderer = new THREE.WebGLRenderer({ canvas: drCanvas, alpha: true, antialias: false });
        skinPreviewRenderer.setSize(210, 240, false);
        if (typeof THREE.ACESFilmicToneMapping !== 'undefined') skinPreviewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        skinPreviewRenderer.toneMappingExposure = 0.88;
        skinPreviewScene = new THREE.Scene();
        skinPreviewCam = new THREE.PerspectiveCamera(35, 210 / 240, 0.1, 20);
        skinPreviewCam.position.set(0, 0.98, 3.55);
        skinPreviewCam.lookAt(0, 0.95, 0);
        skinPreviewScene.add(new THREE.AmbientLight(0xffffff, 0.62));
        const dL = new THREE.DirectionalLight(0xfff4e0, 0.48); dL.position.set(2.5, 4, 3); skinPreviewScene.add(dL);
        skinPreviewRig = createPlayerRig(selectedSkinId, null, null, null);
        skinPreviewScene.add(skinPreviewRig.g);
        let dragSkin = false, sxPrev = 0;
        drCanvas.addEventListener('pointerdown', (e) => { dragSkin = true; sxPrev = e.clientX; });
        window.addEventListener('pointerup', () => { dragSkin = false; });
        window.addEventListener('pointermove', (e) => { if (dragSkin) { skinPreviewRotY += (e.clientX - sxPrev) * 0.018; sxPrev = e.clientX; renderSkinPreview3DOnce(); } });
      } catch (_) {}
    }
    // 2) Title Screen Right-Side Live 3D Character Canvas (#titleSkinCanvas)
    const tCanvas = document.getElementById('titleSkinCanvas');
    if (tCanvas && !titleSkinRenderer) {
      try {
        titleSkinRenderer = new THREE.WebGLRenderer({ canvas: tCanvas, alpha: true, antialias: false });
        titleSkinRenderer.setSize(176, 224, false);
        if (typeof THREE.ACESFilmicToneMapping !== 'undefined') titleSkinRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        titleSkinRenderer.toneMappingExposure = 0.88;
        titleSkinScene = new THREE.Scene();
        titleSkinCam = new THREE.PerspectiveCamera(34, 176 / 224, 0.1, 20);
        titleSkinCam.position.set(0, 1.02, 3.85);
        titleSkinCam.lookAt(0, 0.94, 0);
        titleSkinScene.add(new THREE.AmbientLight(0xffffff, 0.62));
        const tL = new THREE.DirectionalLight(0xfff6e5, 0.48); tL.position.set(-2.2, 4, 3); titleSkinScene.add(tL);
        titleSkinRig = createPlayerRig(selectedSkinId, null, null, null);
        titleSkinScene.add(titleSkinRig.g);
        let dragTitleSkin = false, txPrev = 0;
        tCanvas.addEventListener('pointerdown', (e) => { dragTitleSkin = true; txPrev = e.clientX; });
        window.addEventListener('pointerup', () => { dragTitleSkin = false; });
        window.addEventListener('pointermove', (e) => { if (dragTitleSkin) { titleSkinRotY += (e.clientX - txPrev) * 0.018; txPrev = e.clientX; renderSkinPreview3DOnce(); } });
      } catch (_) {}
    }
    // 3) Lazy Dressing Room counter & filter buttons (cards render when Dressing Room opens)
    const drCnt = document.getElementById('drSkinCountLbl');
    if (drCnt) drCnt.textContent = `${PLAYER_SKINS.length} Skins`;
    _syncDrFilterLabels();
    const setDrCouplesFilter = (onlyCouples) => {
      const drStrip = document.getElementById('drSkinStrip');
      if (drStrip) {
        drStrip.classList.toggle('couples-only', !!onlyCouples);
        drStrip.scrollLeft = 0;
      }
      document.getElementById('btnDrFilterAll')?.classList.toggle('active', !onlyCouples);
      document.getElementById('btnDrFilterCouples')?.classList.toggle('active', !!onlyCouples);
    };
    document.getElementById('btnDrFilterAll')?.addEventListener('click', () => setDrCouplesFilter(false));
    document.getElementById('btnDrFilterCouples')?.addEventListener('click', () => setDrCouplesFilter(true));
    document.getElementById('btnDressingRoom')?.addEventListener('click', () => { ensureAudio(); openDressingRoom(); });
    document.getElementById('btnDrBack')?.addEventListener('click', () => { ensureAudio(); closeDressingRoom(); });
    document.getElementById('btnDrConfirm')?.addEventListener('click', () => {
      ensureAudio();
      closeDressingRoom();
      const sk = getSkinDef(selectedSkinId);
      showToast(`✓ Đã trang bị Skin: ${selectedSkinId === 'custom' ? 'Skin Tùy Chỉnh' : sk.name}!`);
    });
    const stepDrSkin = (delta) => {
      const curIdx = Math.max(0, PLAYER_SKINS.findIndex(s => s.id === selectedSkinId));
      const nextIdx = (curIdx + delta + PLAYER_SKINS.length) % PLAYER_SKINS.length;
      selectPlayerSkin(PLAYER_SKINS[nextIdx].id, false);
    };
    document.getElementById('btnDrPrev')?.addEventListener('click', () => stepDrSkin(-1));
    document.getElementById('btnDrNext')?.addEventListener('click', () => stepDrSkin(1));
    ['drSlotM2', 'drSlotM1', 'drSlotP1', 'drSlotP2'].forEach(id => {
      const slotEl = document.getElementById(id);
      if (!slotEl) return;
      const cv = slotEl.querySelector('canvas');
      if (cv) bindSkinThumbHover(slotEl, cv, () => slotEl.dataset.skin);
      slotEl.addEventListener('click', (e) => {
        const skId = e.currentTarget.dataset.skin;
        if (skId) selectPlayerSkin(skId, false);
      });
    });
    document.getElementById('btnDrResetRot')?.addEventListener('click', () => { skinPreviewRotY = 0.42; renderSkinPreview3DOnce(); });
    document.getElementById('btnDrRandom')?.addEventListener('click', () => {
      const pick = PLAYER_SKINS[Math.floor(Math.random() * PLAYER_SKINS.length)];
      if (pick) selectPlayerSkin(pick.id, true);
    });
    document.getElementById('btnDrStripL')?.addEventListener('click', () => { document.getElementById('drSkinStrip')?.scrollBy({ left: -200, behavior: 'smooth' }); });
    document.getElementById('btnDrStripR')?.addEventListener('click', () => { document.getElementById('drSkinStrip')?.scrollBy({ left: 200, behavior: 'smooth' }); });
    document.getElementById('btnDrUploadClassic')?.addEventListener('click', () => { document.getElementById('inpDrCustomSkinPng')?.click(); });
    document.getElementById('inpDrCustomSkinPng')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      handleCustomSkinFile(f);
      e.target.value = '';
    });
    const btnL = document.getElementById('btnSkinRotL'), btnR = document.getElementById('btnSkinRotR');
    if (btnL) btnL.addEventListener('click', () => { skinPreviewRotY -= 0.45; renderSkinPreview3DOnce(); });
    if (btnR) btnR.addEventListener('click', () => { skinPreviewRotY += 0.45; renderSkinPreview3DOnce(); });
    const btnOk = document.getElementById('btnSkinConfirm');
    if (btnOk) btnOk.addEventListener('click', () => {
      document.querySelector('.lobby-tab[data-ltab="create"]')?.click();
      showToast(`✓ Đã xác nhận Skin: ${getSkinDef(selectedSkinId).name}!`);
    });
    const inpPng = document.getElementById('inpCustomSkinPng');
    if (inpPng) inpPng.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      handleCustomSkinFile(f);
      e.target.value = '';
    });
    selectPlayerSkin(selectedSkinId, false);
  }

  // Minecraft Dungeons Settings Navigation (Q/E tabs, Audio tab, Live Inspector, X Reset section)
  const _GM_TAB_DEFAULTS = {
    play:     { t: 'CÀI ĐẶT CHUNG',       d: 'Điều chỉnh ngôn ngữ, sơ đồ điều khiển PC/Mobile, tọa độ HUD, bộ lọc chat và quyền quản trị.', f: 'Tiếng Việt' },
    graphics: { t: 'ĐỒ HỌA & SHADER',     d: 'Cấu hình tầm nhìn chunk, chất lượng RTX, Eclipse Shader bản chuẩn Merlin1809 và các tùy chọn Sodium/Culling.', f: 'Eclipse Shader' },
    audio:    { t: 'ÂM THANH',            d: 'Điều chỉnh âm lượng tổng, nhạc nền khám phá, hiệu ứng đào/đặt khối và âm thanh quái vật.', f: '78%' },
    world:    { t: 'VÙNG ĐẤT & CHIỀU',     d: 'Dịch chuyển nhanh tới các quần xã, công trình và chiều không gian khác nhau (dành cho Admin).', f: 'Thế Giới Chính' },
    mobs:     { t: 'ĐỘNG VẬT & QUÁI VẬT', d: 'Triệu hồi thú voxel dễ thương hoặc Boss Blender 3D vào trước mặt bạn ở chế độ Sáng tạo.', f: 'Sáng tạo' }
  };
  function _setGmInspector(title, desc, defVal) {
    const tEl = document.getElementById('gmInspectorTitle');
    const dEl = document.getElementById('gmInspectorDesc');
    const fEl = document.getElementById('gmInspectorDef');
    if (tEl && title) tEl.textContent = title;
    if (dEl && desc) dEl.textContent = desc;
    if (fEl) fEl.textContent = defVal || '—';
  }
  function _syncGmInspectorForTab(k) {
    const info = _GM_TAB_DEFAULTS[k] || _GM_TAB_DEFAULTS.play;
    _setGmInspector(info.t, info.d, info.f);
  }
  function switchGmTab(k) {
    document.querySelectorAll('#gmNav .gm-tab').forEach(t => t.classList.toggle('active', t.dataset.gtab === k));
    ['play', 'graphics', 'audio', 'world', 'mobs'].forEach(idKey => {
      const pEl = document.getElementById('gmPane' + idKey.charAt(0).toUpperCase() + idKey.slice(1));
      if (pEl) pEl.classList.toggle('active', idKey === k);
    });
    _syncGmInspectorForTab(k);
  }
  document.querySelectorAll('#gmNav .gm-tab').forEach(tab => {
    tab.addEventListener('click', () => switchGmTab(tab.dataset.gtab));
  });
  const _cycleGmTab = (dir) => {
    const tabs = Array.from(document.querySelectorAll('#gmNav .gm-tab')).filter(t => t.offsetParent !== null);
    if (!tabs.length) return;
    const cur = tabs.findIndex(t => t.classList.contains('active'));
    const nxt = tabs[(cur + dir + tabs.length) % tabs.length];
    if (nxt) switchGmTab(nxt.dataset.gtab);
  };
  document.getElementById('btnGmTabPrev')?.addEventListener('click', () => _cycleGmTab(-1));
  document.getElementById('btnGmTabNext')?.addEventListener('click', () => _cycleGmTab(1));

  const _gmContentEl = document.querySelector('#menuModal .gm-content');
  if (_gmContentEl) {
    const _onInspect = (ev) => {
      const holder = ev.target?.closest('[data-desc], [title]');
      if (!holder || !_gmContentEl.contains(holder)) return;
      const desc = holder.dataset.desc || holder.getAttribute('title');
      if (!desc) return;
      const title = holder.dataset.title || (holder.textContent ? holder.textContent.trim().slice(0, 40) : '');
      const defVal = holder.dataset.def || holder.closest('[data-def]')?.dataset.def || '—';
      _setGmInspector(title, desc, defVal);
    };
    _gmContentEl.addEventListener('pointerover', _onInspect);
    _gmContentEl.addEventListener('focusin', _onInspect);
  }

  const bindAudioSlider = (sliderId, labelId, onSet) => {
    const sl = document.getElementById(sliderId), lb = document.getElementById(labelId);
    if (!sl) return;
    const syncUi = () => {
      const v = Math.max(0, Math.min(1, parseInt(sl.value, 10) / 100));
      onSet(v);
      sl.style.setProperty('--pct', `${sl.value}%`);
      if (lb) lb.textContent = `${sl.value}%`;
    };
    sl.style.setProperty('--pct', `${sl.value}%`);
    sl.addEventListener('input', syncUi);
  };
  bindAudioSlider('audioVolSlider', 'audioVolLabel', (v) => { masterVolume = v; if (masterGain) masterGain.gain.value = v; });
  bindAudioSlider('musicVolSlider', 'musicVolLabel', (v) => { musicVolume = v; if (musicGain) musicGain.gain.value = v; ensureAudio(); });
  bindAudioSlider('sfxVolSlider',   'sfxVolLabel',   (v) => { sfxVolume = v;   if (sfxGain)   sfxGain.gain.value   = v; });
  bindAudioSlider('mobVolSlider',   'mobVolLabel',   (v) => { mobVolume = v;   if (mobGain)   mobGain.gain.value   = v; });

  function resetActiveGmSection() {
    const act = document.querySelector('#gmNav .gm-tab.active')?.dataset.gtab || 'play';
    if (act === 'audio') {
      [['audioVolSlider', 78], ['musicVolSlider', 55], ['sfxVolSlider', 85], ['mobVolSlider', 42]].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) { el.value = String(val); el.dispatchEvent(new Event('input')); }
      });
      showToast(tr('Đã đặt lại Âm thanh về mặc định', 'Audio settings reset to defaults'));
    } else if (act === 'graphics') {
      document.querySelector('#renderDistSeg .seg-btn[data-val="4"]')?.click();
      document.querySelector('#qualitySeg .seg-btn[data-val="ultra"]')?.click();
      document.querySelector('#frameGenSeg .seg-btn[data-fg="1"]')?.click();
      document.querySelector('#presetSeg .seg-btn[data-preset="eclipse"]')?.click();
      if (typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing) document.getElementById('btnRayTracing')?.click();
      if (!volumetricClouds) document.getElementById('btnCloudMode')?.click();
      if (!bumpEnabled) document.getElementById('btnTexFilter')?.click();
      if (typeof sodiumOpts !== 'undefined') {
        document.querySelectorAll('#sodiumExtraSeg .seg-btn[data-sopt]').forEach(b => {
          const k = b.dataset.sopt;
          if (k && sodiumOpts[k] === false) b.click();
        });
      }
      showToast(tr('Đã đặt lại Đồ họa về mặc định (Eclipse + Ultra)', 'Video settings reset to defaults'));
    } else if (act === 'play') {
      document.getElementById('btnMobileMode1')?.click();
      const cb = document.getElementById('btnToggleCoords');
      if (cb && !cb.classList.contains('mc-btn-green')) cb.click();
      const pb = document.getElementById('btnToggleProfanity');
      if (pb && !pb.classList.contains('mc-btn-green')) pb.click();
      showToast(tr('Đã đặt lại Cài đặt chung về mặc định', 'General settings reset to defaults'));
    }
  }
  document.getElementById('btnGmResetSection')?.addEventListener('click', resetActiveGmSection);
  window.addEventListener('keydown', (e) => {
    const mm = document.getElementById('menuModal');
    if (!mm || mm.classList.contains('hidden') || mm.classList.contains('pause-mode')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyQ') { e.preventDefault(); e.stopPropagation(); _cycleGmTab(-1); }
    else if (e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); _cycleGmTab(1); }
    else if (e.code === 'KeyX') { e.preventDefault(); e.stopPropagation(); resetActiveGmSection(); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); document.getElementById('btnGmBack')?.click(); }
  }, true);
  const btnMenuHost = document.getElementById('btnMenuHostInternet');
  if (btnMenuHost) btnMenuHost.addEventListener('click', () => {
    hostCoopRoom();
    if (activeRoomId) { try { navigator.clipboard.writeText(activeRoomId); } catch (_) {} }
  });

  // ===================== AUTHENTIC MINECRAFT JAVA TITLE LOGO, STONE BUTTONS & DIRT SUB-SCREENS =====================
  function initMinecraftTitleVisuals() {
    // 1) Procedural Authentic Minecraft Stone Button Pixel Grain Texture (--mc-stone-btn-bg)
    const sb = document.createElement('canvas'); sb.width = 200; sb.height = 20;
    const sbc = sb.getContext('2d');
    for (let y = 0; y < 20; y++) for (let x = 0; x < 200; x++) {
      const h = (((x * 374761393 + y * 668265263) ^ (x * 1274126177)) >>> 0) % 256;
      let v = 110 + ((h % 19) - 9);
      if (y === 0 || y === 1) v += 24;
      else if (y >= 18) v -= 24;
      v = Math.max(60, Math.min(175, v));
      sbc.fillStyle = `rgb(${v},${v},${v})`;
      sbc.fillRect(x, y, 1, 1);
    }
    document.documentElement.style.setProperty('--mc-stone-btn-bg', `url("${sb.toDataURL()}")`);

    // 2) Procedural Authentic Dark Minecraft Dirt Tile Wallpaper (--mc-dirt-bg)
    const dt = document.createElement('canvas'); dt.width = 16; dt.height = 16;
    const dtc = dt.getContext('2d');
    const dirtShades = ['#2b1e15', '#342419', '#241911', '#3d2b1e', '#1f150e', '#3a2a20'];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = (((x * 73856093) ^ (y * 19349663)) >>> 0) % dirtShades.length;
      dtc.fillStyle = dirtShades[h];
      dtc.fillRect(x, y, 1, 1);
    }
    document.documentElement.style.setProperty('--mc-dirt-bg', `url("${dt.toDataURL()}")`);

    // 3) Authentic 3D Extruded Cracked-Stone Pixel-Art "NUCRAFT" Logo w/ Iconic Creeper-Face 'A'!
    const cv = document.getElementById('mcLogoCanvas');
    if (!cv) return;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);

    const GLYPHS = {
      N: ['###..##','###..##','####.##','####.##','##.####','##..###','##...##','##...##','##...##'],
      U: ['##...##','##...##','##...##','##...##','##...##','##...##','#######','#######','.#####.'],
      C: ['.######','#######','##.....','##.....','##.....','##.....','##.....','#######','.######'],
      R: ['######.','#######','##...##','##...##','######.','#####..','##..##.','##...##','##...##'],
      A: ['.#####.','#######','##.#.##','###.###','##...##','##.#.##','#######','##...##','##...##'],
      F: ['#######','#######','##.....','##.....','######.','######.','##.....','##.....','##.....'],
      T: ['#######','#######','..###..','..###..','..###..','..###..','..###..','..###..','..###..']
    };
    const word = 'NUCRAFT';
    const px = 7; // Crisp 7x7 canvas pixels per logical stone pixel
    const letterW = 7, letterH = 9, gap = 1;
    const totalCols = word.length * letterW + (word.length - 1) * gap;
    const ox = Math.floor((cv.width - totalCols * px) * 0.5);
    const oy = 10;

    // Helper: draw 1 logical pixel with deterministic cobblestone shading/cracks
    const plot = (gx, gy, col) => { c.fillStyle = col; c.fillRect(Math.round(ox + gx * px), Math.round(oy + gy * px), px, px); };

    // Collect face cells for each letter with subtle Minecraft perspective flare on 3D underside!
    const cells = [];
    for (let li = 0; li < word.length; li++) {
      const g = GLYPHS[word[li]];
      const baseCol = li * (letterW + gap);
      const flare = (li - 3) * 0.14;
      for (let r = 0; r < letterH; r++) {
        for (let col = 0; col < letterW; col++) {
          if (g[r][col] === '#') cells.push({ gx: baseCol + col, gy: r, li, r, col, flare, ch: word[li] });
        }
      }
    }

    // Pass 1: Thick crisp pure-black outer outline around both 3D extrusion & face
    for (let d = 4; d >= 0; d--) {
      for (const cl of cells) {
        const bx = cl.gx + cl.flare * d, by = cl.gy + d * 0.85;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          plot(bx + dx * 0.68, by + dy * 0.68, '#0b0b0b');
        }
      }
    }
    // Pass 2: 3D Extruded Chiseled Dark-Stone Underside (4 depth tiers)
    const extShades = ['#4d4d4d', '#3e3e3e', '#2f2f2f', '#212121'];
    for (let d = 4; d >= 1; d--) {
      for (const cl of cells) {
        const bx = cl.gx + cl.flare * d, by = cl.gy + d * 0.85;
        const n = ((cl.gx * 19 + cl.gy * 31 + d * 13) & 3);
        const base = extShades[d - 1];
        plot(bx, by, n === 0 ? '#1b1b1b' : base);
      }
    }
    // Pass 3: Front Cracked Cobblestone Face (light-gray stone blocks + cracks + crisp top bevel!)
    for (const cl of cells) {
      const h = (((cl.gx * 374761393 + cl.gy * 668265263) ^ (cl.li * 1274126177)) >>> 0) % 100;
      const g = GLYPHS[cl.ch];
      const topAir = (cl.r === 0 || g[cl.r - 1][cl.col] !== '#');
      const botAir = (cl.r === letterH - 1 || g[cl.r + 1][cl.col] !== '#');
      const isCrack = (h < 13) || (cl.r === 4 && (cl.col === 1 || cl.col === 5) && cl.ch !== 'A') || (cl.r === 2 && cl.col === 3 && (cl.ch === 'N' || cl.ch === 'F'));
      let shade = 212 - cl.r * 6 + ((h % 17) - 8);
      if (topAir) shade += 28;
      if (botAir) shade -= 18;
      if (isCrack) shade -= 58;
      shade = Math.max(92, Math.min(248, shade));
      plot(cl.gx, cl.gy, `rgb(${shade},${shade},${shade})`);
      // Tiny inner top-left stone specular pixel on top edges
      if (topAir && !isCrack) {
        c.fillStyle = '#ffffff';
        c.fillRect(Math.round(ox + cl.gx * px), Math.round(oy + cl.gy * px), px, 2);
      }
    }
    // Pass 4: Crisp pure-black Creeper face carving inside 'A' so it pops unmistakably!
    const aCol0 = 4 * (letterW + gap);
    for (const [cx, cy] of [[2,2],[4,2],[3,3],[2,4],[3,4],[4,4],[2,5],[4,5]]) {
      plot(aCol0 + cx, cy, '#0d0d0d');
    }
  }

function updateTitleScreenLabels() {
  const setT = (id, txt) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lbl = el.querySelector('.ore-sift-label');
    if (lbl) lbl.textContent = txt;
    else el.textContent = txt;
  };
  setT('btnTitleSingleplayer', tr('Chơi', 'Play'));
  setT('btnTitleOptions',      tr('Cài Đặt', 'Settings'));
  setT('btnTitleMultiplayer',  tr('Chơi Chung (Co-op)', 'Multiplayer (Co-op)'));
  setT('btnDressingRoom',      tr('Phòng Thay Đồ', 'Dressing Room'));
  setT('btnTitleQuit',         tr('Thoát trò chơi', 'Quit Game'));
  setT('btnLobbySubBack',      tr('Quay lại', 'Back'));
  const verEl = document.getElementById('lobbyVersionText');
  if (verEl) verEl.textContent = (typeof BUILD_TAG !== 'undefined' && BUILD_TAG) ? BUILD_TAG : 'BUILD v60';
  const accBtn = document.getElementById('btnTitleAccess');
  if (accBtn && typeof showMobileControls !== 'undefined') {
    accBtn.classList.toggle('is-active', !!showMobileControls);
  }
  syncTitleAvatarFace();
}

const SUB_TITLES = {
  create:   'TẠO THẾ GIỚI MỚI',
  advanced: 'TẠO THẾ GIỚI — NÂNG CAO',
  worlds:   'CHỌN THẾ GIỚI',
  biomes:   'KHÁM PHÁ QUẦN XÃ & THE SIFT',
  coop:     'CHƠI CHUNG (CO-OP)',
  mods:     'MOD & VOXEL ADD-ON',
  skin:     'TỦ ĐỒ — CHỌN SKIN 3D'
};
const SUB_TITLES_EN = {
  create:   'CREATE NEW WORLD',
  advanced: 'CREATE WORLD — ADVANCED',
  worlds:   'SELECT SAVED WORLD',
  biomes:   'EXPLORE BIOMES & THE SIFT',
  coop:     'MULTIPLAYER (CO-OP)',
  mods:     'MODS & VOXEL ADD-ONS',
  skin:     'DRESSING ROOM — 3D SKINS'
};
function getSubTitle(tabKey) {
  return currentLang === 'en' ? (SUB_TITLES_EN[tabKey] || SUB_TITLES_EN.create) : (SUB_TITLES[tabKey] || SUB_TITLES.create);
}

function openLobbySub(tabKey = 'create') {
  const lobby = document.getElementById('lobbyScreen');
  if (!lobby) return;
  lobby.classList.remove('hidden', 'dr-open');
  lobby.classList.add('sub-open');
  const subTitle = document.getElementById('lobbySubTitle');
  if (subTitle) subTitle.textContent = getSubTitle(tabKey);
  const targetTab = document.querySelector(`.lobby-tab[data-ltab="${tabKey}"]`) || document.querySelector('.lobby-tab[data-ltab="create"]');
  targetTab?.click();
  drawOreWorldThumb(lobbyBiome);
}

function closeLobbySub() {
  const lobby = document.getElementById('lobbyScreen');
  if (lobby) lobby.classList.remove('sub-open');
}

function selectLobbyBiome(biomeKey) {
  lobbyBiome = biomeKey || 'sakura';
  document.querySelectorAll('#lobbyBiomeSeg .seg-btn').forEach(x => {
    x.classList.toggle('active', x.dataset.lbiome === lobbyBiome);
  });
  const descEl = document.getElementById('lobbyBiomeDesc');
  if (descEl) descEl.textContent = getLocBiomeDesc(lobbyBiome);
  drawOreWorldThumb(lobbyBiome);
}

function initLobbyOreUI() {
  document.getElementById('btnTitleSingleplayer')?.addEventListener('click', () => { ensureAudio(); openLobbySub('create'); });
  document.getElementById('btnTitleMultiplayer')?.addEventListener('click', () => { ensureAudio(); openLobbySub('coop'); });
  document.getElementById('btnTitleSift')?.addEventListener('click', () => {
    if (!isAdminUnlocked) return;
    ensureAudio();
    selectLobbyBiome('dim_sift');
    openLobbySub('biomes');
  });
  document.getElementById('btnQuickPlaySift')?.addEventListener('click', () => {
    if (!isAdminUnlocked) { showToast('🔒 Chỉ Admin mới dùng nút vào nhanh Khu Giấc Mơ!'); return; }
    ensureAudio();
    selectLobbyBiome('dim_sift');
    launchWorldFromLobby({
      name: (document.getElementById('inpWorldName')?.value || '').trim() || 'Khu Giấc Mơ (The Sift)',
      seed: document.getElementById('inpWorldSeed')?.value || '',
      playerName: document.getElementById('inpPlayerName')?.value || '',
      mode: lobbyMode,
      difficulty: lobbyDifficulty,
      biome: 'dim_sift',
      preset: 'bliss'
    }, false);
  });
  document.getElementById('btnTitleSkins')?.addEventListener('click', () => { ensureAudio(); openLobbySub('skin'); });
  document.getElementById('btnTitleOptions')?.addEventListener('click', () => {
    ensureAudio();
    window._optionsOpenedFromLobby = true;
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.body.classList.add('in-menu');
    const mm = document.getElementById('menuModal');
    mm.classList.add('from-lobby');
    mm.classList.remove('pause-mode', 'hidden');
    const bp = document.getElementById('btnPlay');
    if (bp) bp.textContent = tr('Xong (Quay Lại Sảnh)', 'Done (Back to Lobby)');
    const gmH1 = document.querySelector('#menuModal .gm-brand h1');
    if (gmH1) gmH1.textContent = tr('CÀI ĐẶT', 'SETTINGS');
    if (typeof syncTimeWeatherAdminLocks === 'function') syncTimeWeatherAdminLocks();
    document.querySelector('#gmNav .gm-tab[data-gtab="graphics"]')?.click();
    if (typeof updateMobileUiScale === 'function') { updateMobileUiScale(); requestAnimationFrame(updateMobileUiScale); }
  });
  document.getElementById('btnTitleLang')?.addEventListener('click', () => {
    ensureAudio();
    applyLanguage(currentLang === 'vi' ? 'en' : 'vi', true);
    updateTitleScreenLabels();
  });
  document.getElementById('btnTitleAccess')?.addEventListener('click', () => {
    ensureAudio();
    _userManuallyToggledTouch = true;
    showMobileControls = !showMobileControls;
    syncMobileControls();
    document.getElementById('btnTitleAccess')?.classList.toggle('is-active', !!showMobileControls);
    showToast(showMobileControls ? tr('📱 Đã bật nút điều khiển cảm ứng Mobile!', '📱 Mobile touch controls enabled!') : tr('⌨️ Đã ẩn nút cảm ứng (Chế độ PC)', '⌨️ Touch controls hidden (PC mode)'));
  });
  document.getElementById('btnTitleQuit')?.addEventListener('click', () => {
    try { window.close(); } catch (_) {}
    showToast('👋 Hãy đóng cửa sổ để thoát NUCRAFT!');
  });
  document.getElementById('btnLobbySubBack')?.addEventListener('click', () => { ensureAudio(); closeLobbySub(); });

  // Unified Sidebar Navigation across all 6 Ore UI panes
  const paneMap = {
    create:   'lobbyPaneCreate',
    advanced: 'lobbyPaneAdvanced',
    worlds:   'lobbyPaneWorlds',
    biomes:   'lobbyPaneBiomes',
    coop:     'lobbyPaneCoop',
    mods:     'lobbyPaneMods',
    skin:     'lobbyPaneSkin'
  };
  document.querySelectorAll('.lobby-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lobby-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const k = tab.dataset.ltab;
      const subTitle = document.getElementById('lobbySubTitle');
      if (subTitle) subTitle.textContent = getSubTitle(k);
      for (const [pk, pId] of Object.entries(paneMap)) {
        document.getElementById(pId)?.classList.toggle('active', pk === k);
      }
      if (k === 'skin') renderSkinPreview3DOnce();
      if (k === 'mods' && typeof renderModManagerList === 'function') renderModManagerList();
      if (k === 'worlds') { if (typeof fetchLiveRoomsHttp === 'function') fetchLiveRoomsHttp(); renderSavedWorldsList(); if (typeof renderFriendWorldsList === 'function') renderFriendWorldsList(); }
      if (k === 'coop') {
        const stEl = document.getElementById('coopServerStatus');
        if (stEl && !activeRoomId) stEl.innerHTML = tr('🌐 Internet Relay &amp; P2P: <b style="color:#4ade80;">Sẵn sàng kết nối xuyên mạng Wi-Fi / 4G ✓</b>', '🌐 Internet Relay &amp; P2P: <b style="color:#4ade80;">Ready for Cross-Network Wi-Fi / 4G ✓</b>');
        if (typeof fetchLiveRoomsHttp === 'function') fetchLiveRoomsHttp();
        ncMqtt.ensureConnected();
        connectCoopSocket((online) => { if (online && wsConn && wsConn.readyState === 1) wsConn.send(JSON.stringify({ type: 'list_rooms' })); });
      }
    });
  });

  // Seed input & Random button
  const seedInp = document.getElementById('inpWorldSeed');
  seedInp?.addEventListener('input', () => { seedUserEdited = seedInp.value.trim().length > 0; });
  document.getElementById('btnRandSeed')?.addEventListener('click', () => {
    if (!seedInp) return;
    seedInp.value = String(generateUniqueRandomSeed());
    seedUserEdited = true;
  });

  // Game Mode segmented toggle + live description
  document.querySelectorAll('#lobbyModeSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#lobbyModeSeg .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    lobbyMode = b.dataset.lmode || 'survival';
    const desc = document.getElementById('lobbyModeDesc');
    if (desc) desc.textContent = getLocModeDesc(lobbyMode);
  }));

  // Difficulty 4-col Ore UI segmented toggle + live description
  document.querySelectorAll('#lobbyDiffSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#lobbyDiffSeg .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    lobbyDifficulty = b.dataset.ldiff || 'normal';
    const desc = document.getElementById('lobbyDiffDesc');
    if (desc) desc.textContent = getLocDiffDesc(lobbyDifficulty);
  }));

  // Biome & Dimension grid + live 16:9 canvas preview update
  document.querySelectorAll('#lobbyBiomeSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    selectLobbyBiome(b.dataset.lbiome);
  }));

  // Shader preset toggle
  document.querySelectorAll('#lobbyShaderSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#lobbyShaderSeg .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    lobbyShader = b.dataset.lshader || 'eclipse';
  }));

  // Create World / Create Co-op Room / Host New Room
  const gatherWorldOpts = (playerInpId) => ({
    name: document.getElementById('inpWorldName')?.value || '',
    seed: document.getElementById('inpWorldSeed')?.value || '',
    playerName: document.getElementById(playerInpId)?.value || '',
    mode: lobbyMode,
    difficulty: lobbyDifficulty,
    biome: lobbyBiome,
    preset: lobbyShader
  });
  document.getElementById('btnLobbyCreatePlay')?.addEventListener('click', () => launchWorldFromLobby(gatherWorldOpts('inpPlayerName'), false));
  document.getElementById('btnLobbyCreateCoop')?.addEventListener('click', () => launchWorldFromLobby(gatherWorldOpts('inpPlayerName'), true));
  document.getElementById('btnHostNewRoom')?.addEventListener('click', () => launchWorldFromLobby(gatherWorldOpts('inpCoopName'), true));

  const _triggerJoinRoom = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    joinCoopRoomById(document.getElementById('inpJoinRoomId')?.value || '');
  };
  document.getElementById('btnJoinRoom')?.addEventListener('click', _triggerJoinRoom);
  document.getElementById('inpJoinRoomId')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _triggerJoinRoom(e);
  });

  // Initial preview draw
  drawOreWorldThumb(lobbyBiome);
}
if (typeof document !== 'undefined' && document.getElementById('lobbyScreen')) {
  initLobbyOreUI();
}
  document.getElementById('btnRefreshRooms').addEventListener('click', () => {
    connectCoopSocket((online) => { if (online && wsConn && wsConn.readyState === 1) wsConn.send(JSON.stringify({ type: 'list_rooms' })); });
  });
  document.getElementById('roomBadge').addEventListener('click', () => {
    if (!activeRoomId) return;
    try { navigator.clipboard.writeText(activeRoomId); } catch (_) {}
    showToast(`📋 Đã sao chép Mã Phòng: ${activeRoomId} — Gửi cho bạn bè để vào chơi chung!`);
  });
  document.getElementById('btnToggleBuddy').addEventListener('click', () => {
    toggleCoopBuddy(); startPlaying();
  });
  document.getElementById('btnBackLobby').addEventListener('click', () => {
    saveCurrentWorldToList();
    leaveCoopRoom();
    isPlaying = false; mining.active = false; window._optionsOpenedFromLobby = false;
    if (typeof toggleHideHud === 'function') toggleHideHud(false);
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.classList.remove('in-menu');
    const mm = document.getElementById('menuModal');
    mm.classList.add('hidden'); mm.classList.remove('from-lobby');
    closeLobbySub();
    document.getElementById('lobbyScreen').classList.remove('hidden');
    document.body.classList.add('in-lobby');
    { const _is = document.getElementById('inpWorldSeed'); if (_is) _is.value = String(generateUniqueRandomSeed()); }
    renderSavedWorldsList();
    connectCoopSocket();
  });
  document.getElementById('btnSave').addEventListener('click', () => saveCurrentWorldToList());


  function showWorldLoadingOverlay(titleText, tipText, workFn, opts = null) {
    const ov = document.getElementById('worldLoadingOverlay');
    const tEl = document.getElementById('worldLoadTitle');
    const tipEl = document.getElementById('worldLoadTip');
    const bar = document.getElementById('worldLoadBarFill');
    const pctEl = document.getElementById('worldLoadPct');
    const gridCv = document.getElementById('worldLoadGrid');
    const badge = document.getElementById('worldLoadDimBadge');
    if (!ov || !bar) { if (typeof workFn === 'function') workFn(); return; }
    if (isWorldLoading) return;
    isWorldLoading = true;
    isPlaying = false;
    const tStartLoad = performance.now();
    _worldLoadYaw = (typeof player !== 'undefined' && player.yaw) || 0;
    const dimLabel = (dim) => dim === 'nether' ? 'THE NETHER' : (dim === 'end' ? 'THE END' : (dim === 'sift' ? 'THE SIFT' : 'OVERWORLD'));
    if (tEl) tEl.textContent = titleText || tr('Đang tạo thế giới...', 'Building Terrain...');
    if (tipEl) tipEl.textContent = tipText || tr('Đang khởi tạo hạt giống và kiến tạo bản đồ...', 'Generating terrain chunks around spawn...');
    if (badge) badge.textContent = (opts && opts.badge) ? opts.badge : dimLabel(currentDimension);
    const setPct = (p) => {
      const clamped = Math.max(0, Math.min(100, Math.round(p)));
      bar.style.width = clamped + '%';
      if (pctEl) pctEl.textContent = clamped + '%';
    };
    setPct(2);
    const gCtx = gridCv ? gridCv.getContext('2d') : null;
    if (gCtx) {
      gCtx.fillStyle = '#12151b';
      gCtx.fillRect(0, 0, gridCv.width, gridCv.height);
    }
    ov.classList.remove('hidden');

    // Frame 1: Paint loading overlay immediately before executing world/biome target setup
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const _afterWork = () => {
        isPlaying = false;
        if (badge) badge.textContent = (opts && opts.badge) ? opts.badge : dimLabel(currentDimension);

        // Build full spiral ring list of REAL visible chunks around player's actual destination (r = 0 .. loadRad)
        const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
        const loadRad = Math.min(3, Math.max(1, renderDistance || 3));
        const gridRad = loadRad + 1;
        const genRings = [], meshRings = [];
        const chunkState = new Map();
        for (let r = 0; r <= gridRad; r++) {
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const cx = pcx + dx, cz = pcz + dz;
            genRings.push([cx, cz]);
            chunkState.set(chunkKey(cx, cz), 0);
            if (r <= loadRad) meshRings.push([cx, cz]);
          }
        }
        for (const ch of chunks.values()) {
          if (ch.dirty && (Math.abs(ch.cx - pcx) > loadRad || Math.abs(ch.cz - pcz) > loadRad)) {
            meshRings.push([ch.cx, ch.cz]);
          }
        }
        const totalGen = genRings.length;
        const totalMesh = meshRings.length;
        if (chunkWorkerPool.active && currentDimension === 'overworld' && (depthOffset || 0) === 0) {
          const preN = Math.min(totalGen, _isMobilePerf ? 12 : 24);
          for (let pi = 0; pi < preN; pi++) {
            const pc = genRings[pi][0], pz = genRings[pi][1];
            if (!chunks.has(chunkKey(pc, pz)) && !isAbandonedCity(pc * 16 + 8, pz * 16 + 8) && !isGrandRuins(pc * 16 + 8, pz * 16 + 8)) {
              chunkWorkerPool.prefetchOverworld(pc, pz);
            }
          }
        }
        const drawLoadGrid = (actCx = null, actCz = null) => {
          if (!gCtx || !gridCv) return;
          const W = gridCv.width, H = gridCv.height;
          const cols = gridRad * 2 + 1;
          const step = Math.floor(Math.min(W, H) / cols);
          const ox = Math.floor((W - step * cols) * 0.5), oy = Math.floor((H - step * cols) * 0.5);
          gCtx.fillStyle = '#0d1117';
          gCtx.fillRect(0, 0, W, H);
          for (let dz = -gridRad; dz <= gridRad; dz++) {
            for (let dx = -gridRad; dx <= gridRad; dx++) {
              const cx = pcx + dx, cz = pcz + dz;
              const st = chunkState.get(chunkKey(cx, cz)) || 0;
              const px = ox + (dx + gridRad) * step;
              const py = oy + (dz + gridRad) * step;
              const isAct = (actCx === cx && actCz === cz);
              const isInner = Math.max(Math.abs(dx), Math.abs(dz)) <= loadRad;
              gCtx.fillStyle = isAct ? '#fde047'
                : (st >= 2 ? '#f8fafc'
                : (st === 1 ? '#4ade80'
                : (isInner ? '#232a36' : '#181c24')));
              gCtx.fillRect(px + 1, py + 1, Math.max(2, step - 2), Math.max(2, step - 2));
            }
          }
        };
        drawLoadGrid(pcx, pcz);

        let genIdx = 0, meshIdx = 0, drainPasses = 0;
        const stepRealChunkLoad = () => {
          const frameDeadline = performance.now() + (_isMobilePerf ? 9.5 : 11.5);
          let genOps = 0, meshOps = 0;
          let activeCx = null, activeCz = null;
          if (chunkWorkerPool.active) {
            chunkWorkerPool.drainCompletedMeshes(_isMobilePerf ? 6 : 12, 6.5);
          }
          // Phase 1: Real Voxel Terrain & Cave/Structure Data Generation (5%..45%)
          if (chunkWorkerPool.active && currentDimension === 'overworld' && (depthOffset || 0) === 0 && genIdx < totalGen) {
            const lookEnd = Math.min(totalGen, genIdx + (_isMobilePerf ? 10 : 18));
            for (let pi = genIdx; pi < lookEnd; pi++) {
              const pc = genRings[pi][0], pz = genRings[pi][1];
              if (!chunks.has(chunkKey(pc, pz)) && !isAbandonedCity(pc * 16 + 8, pz * 16 + 8) && !isGrandRuins(pc * 16 + 8, pz * 16 + 8)) {
                chunkWorkerPool.prefetchOverworld(pc, pz);
              }
            }
          }
          while (genIdx < totalGen && genOps < 4 && (genOps === 0 || performance.now() < frameDeadline)) {
            const [cx, cz] = genRings[genIdx++];
            const k = chunkKey(cx, cz);
            if (!chunks.has(k)) generateChunk(cx, cz);
            if ((chunkState.get(k) || 0) < 1) chunkState.set(k, 1);
            activeCx = cx; activeCz = cz;
            genOps++;
          }
          // Phase 2: Parallel Worker Mesh Fan-out + Direct Near-Chunk Meshing (45%..86%)
          if (genIdx >= totalGen && chunkWorkerPool.active) {
            const fanLimit = Math.min(totalMesh, meshIdx + (_isMobilePerf ? 8 : 16));
            for (let mi = meshIdx; mi < fanLimit; mi++) {
              const [fcx, fcz] = meshRings[mi];
              const d2 = (fcx - pcx) * (fcx - pcx) + (fcz - pcz) * (fcz - pcz);
              if (d2 <= 1) continue;
              const fch = chunks.get(chunkKey(fcx, fcz));
              if (fch && (fch.dirty || fch.urgentDirty || !fch.meshed) && !fch._pendingSlice) {
                _dispatchChunkMeshToWorker(fch);
              }
            }
          }
          while (genIdx >= totalGen && meshIdx < totalMesh && meshOps < 2 && (meshOps === 0 || performance.now() < frameDeadline)) {
            const [cx, cz] = meshRings[meshIdx++];
            const k = chunkKey(cx, cz);
            const ch = chunks.get(k);
            if (ch && (ch.dirty || ch.urgentDirty || ch._pendingSlice || !ch.meshed)) {
              const d2 = (cx - pcx) * (cx - pcx) + (cz - pcz) * (cz - pcz);
              if (chunkWorkerPool.active && d2 > 1 && !ch._pendingSlice && (ch._meshInFlightGen === (ch._meshGen || 0) || _dispatchChunkMeshToWorker(ch))) {
                activeCx = cx; activeCz = cz;
                continue;
              }
              rebuildChunkMesh(ch);
            }
            chunkState.set(k, 2);
            activeCx = cx; activeCz = cz;
            meshOps++;
          }
          // Phase 2b: Drain remaining worker/dirty/border chunks inside loadRad before reveal
          let stillDirtyNear = false;
          if (genIdx >= totalGen && meshIdx >= totalMesh && drainPasses < 28) {
            drainPasses++;
            if (chunkWorkerPool.active) chunkWorkerPool.drainCompletedMeshes(_isMobilePerf ? 6 : 12, 7.0);
            const _drainSet = (s) => {
              for (const ch of Array.from(s)) {
                if (!ch || chunks.get(chunkKey(ch.cx, ch.cz)) !== ch) { s.delete(ch); continue; }
                if (Math.abs(ch.cx - pcx) > loadRad || Math.abs(ch.cz - pcz) > loadRad) continue;
                if (ch.dirty || ch.urgentDirty || ch.borderDirty || ch._pendingSlice || !ch.meshed) {
                  if (chunkWorkerPool.active && ch._meshInFlightGen === (ch._meshGen || 0) && drainPasses < 14) {
                    stillDirtyNear = true;
                    continue;
                  }
                  if ((genOps + meshOps) > 0 && performance.now() >= frameDeadline) { stillDirtyNear = true; return true; }
                  rebuildChunkMesh(ch);
                  chunkState.set(chunkKey(ch.cx, ch.cz), 2);
                  meshOps++;
                } else {
                  chunkState.set(chunkKey(ch.cx, ch.cz), 2);
                  s.delete(ch);
                }
              }
              return false;
            };
            if (!_drainSet(_urgentChunkSet) && !_drainSet(_dirtyChunkSet)) _drainSet(_borderChunkSet);
          }

          if (genIdx < totalGen || meshIdx < totalMesh || stillDirtyNear) {
            const pct = (genIdx < totalGen)
              ? Math.round(5 + (genIdx / Math.max(1, totalGen)) * 40)
              : (meshIdx < totalMesh)
                ? Math.round(45 + (meshIdx / Math.max(1, totalMesh)) * 41)
                : Math.min(92, 86 + drainPasses * 2);
            setPct(pct);
            drawLoadGrid(activeCx, activeCz);
            if (tipEl) {
              tipEl.textContent = (genIdx < totalGen)
                ? tr(`Đang kiến tạo địa hình khu vực (${genIdx}/${totalGen} chunk • ${pct}%)...`, `Generating terrain (${genIdx}/${totalGen} chunks • ${pct}%)...`)
                : (meshIdx < totalMesh)
                  ? tr(`Đang dựng khối 3D & ánh sáng (${meshIdx}/${totalMesh} chunk • ${pct}%)...`, `Building 3D chunk meshes & lighting (${meshIdx}/${totalMesh} • ${pct}%)...`)
                  : tr(`Đang hoàn thiện ánh sáng ranh giới & chi tiết (${pct}%)...`, `Finishing border lighting & details (${pct}%)...`);
            }
            requestAnimationFrame(stepRealChunkLoad);
          } else {
            // Phase 3: GPU Shader Compile & 2-Frame Real Warmup (94%..100%)
            drawLoadGrid(null, null);
            setPct(94);
            if (tipEl) tipEl.textContent = tr('Đang biên dịch shader GPU & đồng bộ ánh sáng...', 'Compiling GPU shaders & syncing lighting...');
            requestAnimationFrame(() => {
              emergeQueue.length = 0;
              emergeSet.clear();
              lastPlayerCx = pcx;
              lastPlayerCz = pcz;
              _teleportWarmupFrames = 0;
              _reflDoneOnce = false;
              if (typeof farLodSystem !== 'undefined') farLodSystem.update(pcx, pcz, true);
              camera.rotation.order = 'YXZ';
              camera.rotation.y = player.yaw;
              camera.rotation.x = player.pitch;
              camera.position.set(player.x, player.y + (player.sneaking ? EYE_HEIGHT - 0.24 : EYE_HEIGHT), player.z);
              skyDome.position.copy(camera.position);
              try { _refreshCamFrustum(); } catch (_) {}
              if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
              try { updateAtmosphere(0.016); updateSunShadowFrustum(); } catch (_) {}
              const envKey = `${currentDimension}:${shaderQuality}`;
              if (window._compiledEnvKey !== envKey) {
                try { renderer.compile(scene, camera); } catch (_) {}
                window._compiledEnvKey = envKey;
              }
              try { renderWaterReflectionPass(false, 0.016); renderMainScene(0.016); } catch (_) {}
              setPct(98);
              if (tipEl) tipEl.textContent = tr(`Đang làm ấm khung hình GPU (${totalMesh}/${totalMesh} chunk)...`, `Warming up GPU frames (${totalMesh}/${totalMesh} chunks)...`);
              requestAnimationFrame(() => {
                try { renderMainScene(0.016); } catch (_) {}
                setPct(100);
                if (tipEl) tipEl.textContent = tr(`Đã tải xong 100% khu vực (${totalMesh}/${totalMesh} chunk)!`, `Loaded 100% of world spawn (${totalMesh}/${totalMesh} chunks)!`);
                window._lastWorldLoadStats = {
                  genCount: totalGen,
                  meshCount: totalMesh,
                  elapsedMs: Math.round(performance.now() - tStartLoad),
                  chunksTotal: chunks.size,
                  completedAt: Date.now()
                };
                requestAnimationFrame(() => {
                  isWorldLoading = false;
                  ov.classList.add('hidden');
                  setPct(0);
                  startPlaying();
                });
              });
            });
          }
        };
        requestAnimationFrame(stepRealChunkLoad);
        };
        let _workRes = null;
        try {
          if (typeof workFn === 'function') _workRes = workFn();
        } catch (err) {
          console.error('World load err:', err);
        }
        if (_workRes && typeof _workRes.then === 'function') {
          _workRes.catch((err) => console.error('World load async err:', err)).finally(_afterWork);
        } else {
          _afterWork();
        }
      });
    });
  }

  document.getElementById('btnGmBack')?.addEventListener('click', () => {
    ensureAudio();
    const mm = document.getElementById('menuModal');
    if (window._optionsOpenedFromLobby) {
      window._optionsOpenedFromLobby = false;
      mm?.classList.add('hidden');
      mm?.classList.remove('from-lobby', 'pause-mode');
      document.body.classList.remove('in-menu');
      document.getElementById('lobbyScreen')?.classList.remove('hidden');
      document.body.classList.add('in-lobby');
    } else {
      mm?.classList.add('pause-mode');
    }
  });
  document.getElementById('btnTitleProfile')?.addEventListener('click', () => { ensureAudio(); openProfileModal('uid'); });
  document.getElementById('pauseBtnProfile')?.addEventListener('click', () => { ensureAudio(); openProfileModal('uid'); });
  document.getElementById('btnCloseProfile')?.addEventListener('click', closeProfileModal);
  document.getElementById('btnCancelProfile')?.addEventListener('click', closeProfileModal);
  document.getElementById('btnProfTabUid')?.addEventListener('click', () => { ensureAudio(); window.switchProfileModalTab?.('uid'); });
  document.getElementById('btnProfTabAuth')?.addEventListener('click', () => { ensureAudio(); window.switchProfileModalTab?.('auth'); });
  document.getElementById('btnProfileGoAuth')?.addEventListener('click', () => { ensureAudio(); window.switchProfileModalTab?.('auth'); });
  document.getElementById('btnProfileSyncNow')?.addEventListener('click', async () => {
    ensureAudio();
    try {
      const ok = await window.nucraftSyncActiveAccountNow?.();
      showToast(ok ? '☁️ Đã đồng bộ tài khoản (Skin, Map, Add-on & Bạn bè)!' : '⚠️ Vui lòng đăng nhập lại để đồng bộ.');
    } catch (err) {
      showToast('⚠️ ' + (err.message || err));
    }
  });
  document.getElementById('btnProfileLogout')?.addEventListener('click', () => {
    ensureAudio();
    window.nucraftLogoutAccount?.();
    showToast('🚪 Đã đăng xuất phiên tài khoản.');
  });
  let _authModeReg = false;
  const _setAuthMode = (isReg) => {
    _authModeReg = !!isReg;
    document.getElementById('btnAuthModeLogin')?.classList.toggle('active', !_authModeReg);
    document.getElementById('btnAuthModeRegister')?.classList.toggle('active', _authModeReg);
    document.getElementById('authConfirmWrap')?.classList.toggle('hidden', !_authModeReg);
    const sub = document.getElementById('btnAuthSubmit');
    if (sub) sub.textContent = _authModeReg ? '✨ Tạo tài khoản & Lưu ngay' : '▶ Đăng nhập & Tải dữ liệu';
    const st = document.getElementById('authStatusMsg');
    if (st) st.textContent = '';
  };
  document.getElementById('btnAuthModeLogin')?.addEventListener('click', () => { ensureAudio(); _setAuthMode(false); });
  document.getElementById('btnAuthModeRegister')?.addEventListener('click', () => { ensureAudio(); _setAuthMode(true); });
  document.getElementById('btnToggleAuthPass')?.addEventListener('click', () => {
    const p1 = document.getElementById('inpAuthPass');
    const p2 = document.getElementById('inpAuthPass2');
    const nextType = (p1 && p1.type === 'password') ? 'text' : 'password';
    if (p1) p1.type = nextType;
    if (p2) p2.type = nextType;
  });
  const _runAuthSubmit = async () => {
    const u = document.getElementById('inpAuthUser')?.value || '';
    const p1 = document.getElementById('inpAuthPass')?.value || '';
    const p2 = document.getElementById('inpAuthPass2')?.value || '';
    const st = document.getElementById('authStatusMsg');
    const btn = document.getElementById('btnAuthSubmit');
    if (btn) btn.disabled = true;
    if (st) { st.style.color = '#fde047'; st.textContent = _authModeReg ? '⏳ Đang mã hóa & tạo tài khoản...' : '⏳ Đang xác thực & tải dữ liệu...'; }
    try {
      const snap = _authModeReg
        ? await window.nucraftRegisterAccount(u, p1, p2)
        : await window.nucraftLoginAccount(u, p1);
      if (st) {
        st.style.color = '#4ade80';
        const wCnt = Array.isArray(snap?.worlds) ? snap.worlds.length : 0;
        const fCnt = Array.isArray(snap?.friends) ? snap.friends.length : 0;
        const aCnt = Array.isArray(snap?.addons) ? snap.addons.filter(x => x && x.enabled).length : 0;
        st.textContent = _authModeReg
          ? `✅ Tạo tài khoản @${snap.uid} thành công! (${wCnt} map, ${fCnt} bạn bè, ${aCnt} add-on đã lưu)`
          : `✅ Đăng nhập @${snap.uid} thành công! Đã nạp Skin, ${wCnt} map, ${aCnt} add-on & ${fCnt} bạn bè!`;
      }
      showToast(_authModeReg ? `✅ Đã tạo tài khoản @${snap.uid}!` : `✅ Chào mừng @${snap.uid} trở lại!`);
    } catch (err) {
      if (st) { st.style.color = '#fca5a5'; st.textContent = '⚠️ ' + (err?.message || err); }
      showToast('⚠️ ' + (err?.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  document.getElementById('btnAuthSubmit')?.addEventListener('click', () => { ensureAudio(); _runAuthSubmit(); });
  document.getElementById('inpAuthPass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !_authModeReg) _runAuthSubmit(); });
  document.getElementById('inpAuthPass2')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && _authModeReg) _runAuthSubmit(); });
  document.getElementById('btnAuthExport')?.addEventListener('click', async () => {
    ensureAudio();
    try { await window.nucraftExportAccountFile(); showToast('💾 Đã tải xuống file sao lưu .ncacc!'); }
    catch (err) { showToast('⚠️ ' + (err?.message || err)); }
  });
  document.getElementById('btnAuthImport')?.addEventListener('click', () => {
    ensureAudio();
    document.getElementById('inpAuthImportFile')?.click();
  });
  document.getElementById('inpAuthImportFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const u = document.getElementById('inpAuthUser')?.value || '';
    const p1 = document.getElementById('inpAuthPass')?.value || '';
    const st = document.getElementById('authStatusMsg');
    try {
      const txt = await f.text();
      const snap = await window.nucraftImportAccountFile(txt, u, p1);
      if (st) { st.style.color = '#4ade80'; st.textContent = `✅ Đã khôi phục @${snap.uid} từ file sao lưu!`; }
      showToast(`✅ Đã khôi phục tài khoản @${snap.uid}!`);
    } catch (err) {
      if (st) { st.style.color = '#fca5a5'; st.textContent = '⚠️ ' + (err?.message || err); }
      showToast('⚠️ ' + (err?.message || err));
    }
  });
  document.getElementById('btnSaveProfileUid')?.addEventListener('click', () => {
    const raw = document.getElementById('inpProfileUid')?.value || '';
    const res = setLockedPlayerUidOnce(raw);
    if (!res.ok) {
      const h = document.getElementById('profileUidHint');
      if (h) { h.textContent = '⚠️ ' + res.reason; h.style.color = '#fca5a5'; }
      showToast('⚠️ ' + res.reason);
      return;
    }
    showToast(`✅ Đã lưu UID cố định: ${res.uid} (Không thể đổi sau này)`);
    closeProfileModal();
  });

  document.getElementById('btnTitleFriends')?.addEventListener('click', () => { ensureAudio(); openFriendsModal(); });
  document.getElementById('btnSubFriends')?.addEventListener('click', () => { ensureAudio(); openFriendsModal(); });
  document.getElementById('btnPauseInvite')?.addEventListener('click', () => { ensureAudio(); openFriendsModal(); });
  document.getElementById('btnCoopOpenFriends')?.addEventListener('click', () => { ensureAudio(); openFriendsModal(); });
  document.getElementById('btnCloseFriends')?.addEventListener('click', () => document.getElementById('friendsModal')?.classList.add('hidden'));
  document.getElementById('btnOpenAddFriend')?.addEventListener('click', () => openAddFriendModal());
  document.getElementById('btnCloseAddFriend')?.addEventListener('click', () => document.getElementById('addFriendModal')?.classList.add('hidden'));
  document.getElementById('btnBackToFriends')?.addEventListener('click', () => {
    document.getElementById('addFriendModal')?.classList.add('hidden');
    openFriendsModal();
  });
  document.getElementById('btnBannerAcceptFriend')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const u = document.getElementById('friendReqBanner')?.dataset.reqUid;
    if (u) acceptIncomingFriendReq(u);
  });
  document.getElementById('btnBannerDeclineFriend')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const u = document.getElementById('friendReqBanner')?.dataset.reqUid;
    if (u) declineIncomingFriendReq(u);
  });
  document.getElementById('btnBannerCloseFriend')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const banner = document.getElementById('friendReqBanner');
    if (banner && banner.dataset.reqUid) _bannerDismissedUidKey = sanitizeUidForPeer(banner.dataset.reqUid);
    banner?.classList.add('hidden');
  });

  document.getElementById('btnSendFriendInvite')?.addEventListener('click', () => {
    if (selectedInviteFriends.size === 0) {
      openAddFriendModal();
      return;
    }
    const myUid = getLockedPlayerUid();
    const world = getMySharedWorldPayload();
    if (!world) {
      showToast('⚠️ Hãy vào một thế giới có bật "Chơi chung với bạn bè" trước khi gửi lời mời vào phòng!');
      return;
    }
    let sent = 0;
    for (const fKey of selectedInviteFriends) {
      const fr = loadFriendsList().find(x => sanitizeUidForPeer(x.uid) === fKey);
      if (fr) {
        sendFriendPacketToUid(fr.uid, { type: 'friend_game_invite', fromUid: myUid, world });
        sent++;
      }
    }
    selectedInviteFriends.clear();
    renderFriendsModalLists();
    showToast(`✉️ Đã gửi lời mời vào thế giới tới ${sent} người bạn!`);
  });

  const _doSearchFriend = () => {
    const raw = (document.getElementById('inpSearchFriendUid')?.value || '').trim();
    const fb = document.getElementById('addFriendFeedback');
    if (!raw) {
      if (fb) { fb.className = 'ore-friend-fb err visible'; fb.textContent = '⚠️ Hãy nhập chính xác tên UID của người chơi cần tìm!'; }
      showToast('⚠️ Hãy nhập chính xác tên UID của người chơi cần tìm!');
      return;
    }
    if (fb) { fb.className = 'ore-friend-fb'; fb.innerHTML = ''; }
    const key = sanitizeUidForPeer(raw);
    window._pendingFriendSearchKey = key;
    const myUid = getLockedPlayerUid();
    if (myUid) sendFriendPacketToUid(raw, { type: 'friend_ping', fromUid: myUid, world: getMySharedWorldPayload() });
    const st = friendOnlineStatus.get(key);
    const isOn = !!(st && st.online && (Date.now() - st.lastSeen < 45000));
    renderFriendSearchResult(raw, isOn);
  };
  document.getElementById('btnSearchFriendUid')?.addEventListener('click', _doSearchFriend);
  document.getElementById('inpSearchFriendUid')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') _doSearchFriend(); });

  document.getElementById('btnToggleShareFriends')?.addEventListener('click', (e) => {
    shareWithFriendsEnabled = !shareWithFriendsEnabled;
    const btn = e.currentTarget;
    btn.classList.toggle('on', shareWithFriendsEnabled);
    btn.setAttribute('aria-pressed', shareWithFriendsEnabled ? 'true' : 'false');
    showToast(shareWithFriendsEnabled ? '🟢 Đã bật: Bạn bè sẽ thấy và vào được thế giới này!' : '🔒 Đã tắt: Thế giới riêng tư (chỉ chơi 1 mình).');
  });

  document.getElementById('btnPlayCreateShortcut')?.addEventListener('click', () => {
    document.querySelector('.lobby-tab[data-ltab="create"]')?.click();
  });

  // v60: Không tự ép xoay/fullscreen ngay cú chạm đầu tiên ở sảnh (tránh đá người dùng khỏi Mobile Portrait); dùng nút Full / Xoay chủ động.


  // v57: Dựng nhân vật 3D thật (giống hệt khung nhân vật trong túi đồ Backpack, có đủ Skin + Giáp + Vật phẩm) lên màn hình Dừng Game!
  function renderPauseChar3D() {
    try {
      const pcv = document.getElementById('pauseCharCanvas');
      if (!pcv || typeof drawCharPreview !== 'function') return;
      drawCharPreview();
      if (!invPreviewRenderer || !invPreviewRenderer.domElement) return;
      const ctx = pcv.getContext('2d');
      ctx.clearRect(0, 0, pcv.width, pcv.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(invPreviewRenderer.domElement, 0, 0, pcv.width, pcv.height);
    } catch (_) {}
  }
  (function bindPauseCharDrag() {
    const pcv = document.getElementById('pauseCharCanvas');
    if (!pcv) return;
    let dragging = false, prevX = 0;
    pcv.addEventListener('pointerdown', (e) => { dragging = true; prevX = e.clientX; });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      invPreviewRotY += (e.clientX - prevX) * 0.018;
      prevX = e.clientX;
      renderPauseChar3D();
    });
  })();

/* ============================================================================
 * v61: REAL 3D IN-GAME WORLD THUMBNAIL + PAUSE / FRIENDS / AVATAR UI UPGRADES
 * Drop-in JS patch for D:\mine2\NUCRAFT_Mobile.html (exact splice lines listed
 * in v61_ui_report.md). Preserves all existing element IDs & global functions.
 * ============================================================================ */

// ----------------------------------------------------------------------------
// 1. SHARED PIXEL AVATAR & GOLDEN CROWN SVG HELPERS (Lobby, Pause, Friends)
// ----------------------------------------------------------------------------
function buildPixelAvatarSvg(skinObj, extraCls) {
  const sk = skinObj || (typeof getSkinDef === 'function' && typeof selectedSkinId !== 'undefined' ? getSkinDef(selectedSkinId) : null) || {};
  const skin = sk.skin || '#c6906b';
  const hair = sk.hair || '#3b2616';
  const eye  = sk.eye  || '#4f3799';
  return `<svg class="${extraCls || ''}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
    <rect width="8" height="8" fill="${skin}" class="av-skin"/>
    <rect x="0" y="0" width="8" height="2" fill="${hair}" class="av-hair"/>
    <rect x="0" y="2" width="1" height="1" fill="${hair}" class="av-hair"/>
    <rect x="7" y="2" width="1" height="1" fill="${hair}" class="av-hair"/>
    <rect x="1" y="4" width="1" height="1" fill="#ffffff"/>
    <rect x="2" y="4" width="1" height="1" fill="${eye}" class="av-eye"/>
    <rect x="5" y="4" width="1" height="1" fill="${eye}" class="av-eye"/>
    <rect x="6" y="4" width="1" height="1" fill="#ffffff"/>
    <rect x="3" y="5" width="2" height="1" fill="#9c6849"/>
    <rect x="2" y="6" width="4" height="2" fill="${hair}" class="av-hair"/>
    <rect x="3" y="6" width="2" height="1" fill="${skin}" class="av-skin"/>
  </svg>`;
}

function syncAllPlayerAvatarFaces() {
  if (typeof selectedSkinId === 'undefined') return;
  document.querySelectorAll('#titleAvatarFace, #pauseAvatarFace, .js-local-av').forEach(wrap => {
    drawActiveSkinHeadCanvas(wrap, selectedSkinId);
  });
}

// ----------------------------------------------------------------------------
// 2. REAL 3D IN-GAME WORLD PREVIEW THUMBNAIL (Uses real renderer + atlasTex!)
//    Zero extra WebGL context; renders & caches crisp 320x200 3D voxel scenes
//    matching media_1795278126522_64a5c418.jpg for all 9 biomes + live view.
// ----------------------------------------------------------------------------
function captureLiveWorldThumb(targetCanvas) {
  const cv = targetCanvas || document.getElementById('oreWorldThumbCanvas');
  if (!cv || typeof renderer === 'undefined' || !renderer || !renderer.domElement) return false;
  try {
    if (typeof scene !== 'undefined' && typeof camera !== 'undefined') {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(renderer.domElement, 0, 0, cv.width, cv.height);
    return true;
  } catch (_) {
    return false;
  }
}

function _buildBiomeDioramaScene(biomeKey) {
  const B_ = (typeof B !== 'undefined') ? B : {};
  const DEF_ = (typeof BLOCK_DEF !== 'undefined') ? BLOCK_DEF : {};
  const cols = (typeof ATLAS_COLS !== 'undefined') ? ATLAS_COLS : 8;
  const rows = (typeof ATLAS_ROWS !== 'undefined') ? ATLAS_ROWS : 48;

  // High-detail 24x16x24 voxel diorama grid (y=0..15) for crisp shader screenshots
  const SX = 24, SY = 16, SZ = 24;
  const grid = new Uint16Array(SX * SY * SZ);
  const idx3 = (x, y, z) => (y * SZ + z) * SX + x;
  const setB = (x, y, z, id) => {
    const ix = Math.round(x), iy = Math.round(y), iz = Math.round(z);
    if (ix >= 0 && ix < SX && iy >= 0 && iy < SY && iz >= 0 && iz < SZ) grid[idx3(ix, iy, iz)] = id || 0;
  };
  const getB = (x, y, z) => (x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ) ? grid[idx3(x, y, z)] : 0;

  const fillBox = (x0, y0, z0, x1, y1, z1, id) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setB(x, y, z, id);
  };
  const placeTree = (tx, ty, tz, logId, leafId, h) => {
    for (let y = 0; y < h; y++) setB(tx, ty + y, tz, logId);
    const top = ty + h - 1;
    fillBox(tx - 2, top - 1, tz - 2, tx + 2, top, tz + 2, leafId);
    fillBox(tx - 1, top + 1, tz - 1, tx + 1, top + 2, tz + 1, leafId);
    setB(tx - 2, top, tz - 2, 0); setB(tx + 2, top, tz + 2, 0);
    setB(tx - 2, top, tz + 2, 0); setB(tx + 2, top, tz - 2, 0);
  };

  // Shader atmosphere presets (BSL/Bliss sun rays, atmospheric horizon haze, specular water)
  const presets = {
    sakura:         { skyTop: '#2474e8', skyMid: '#7bc6ff', skyBot: '#ffe6c7', fog: 0xf4dcc4, sun: 0xffe4ad, amb: 0xaad4ff, gnd: 0x3b4d2a, fluid: 0x1d7ed6, fluidSpec: 0xffe9b3, fluidAlpha: 0.78, clouds: true, sunX: 0.72, sunY: 0.21, rayTint: 'rgba(255,212,140,0.28)', mistRgba: 'rgba(255,236,204,0.24)' },
    mangrove:       { skyTop: '#1d7588', skyMid: '#68c3b7', skyBot: '#e3f5cc', fog: 0xbfe2c4, sun: 0xffebb8, amb: 0x99e2d0, gnd: 0x2f432b, fluid: 0x1c6b63, fluidSpec: 0xfff0bd, fluidAlpha: 0.80, clouds: true, sunX: 0.66, sunY: 0.19, rayTint: 'rgba(255,232,165,0.26)', mistRgba: 'rgba(204,242,216,0.26)' },
    desert:         { skyTop: '#1b72e8', skyMid: '#6cb8ff', skyBot: '#ffdfa0', fog: 0xf6cf95, sun: 0xffd27d, amb: 0xffdca8, gnd: 0x996d38, fluid: 0x1a8fb8, fluidSpec: 0xfff3c4, fluidAlpha: 0.78, clouds: true, sunX: 0.76, sunY: 0.22, rayTint: 'rgba(255,198,96,0.34)', mistRgba: 'rgba(255,222,158,0.28)' },
    meadow:         { skyTop: '#217ef0', skyMid: '#7accff', skyBot: '#eef9ff', fog: 0xd4f0ff, sun: 0xfff1c4, amb: 0xb7e4ff, gnd: 0x42662b, fluid: 0x269be6, fluidSpec: 0xffffff, fluidAlpha: 0.76, clouds: true, sunX: 0.70, sunY: 0.18, rayTint: 'rgba(255,244,185,0.28)', mistRgba: 'rgba(232,248,255,0.22)' },
    alpine:         { skyTop: '#1357c2', skyMid: '#61a8f5', skyBot: '#e4f1ff', fog: 0xd2e6ff, sun: 0xfff4d9, amb: 0xc2dfff, gnd: 0x475569, fluid: 0x2c9ee8, fluidSpec: 0xffffff, fluidAlpha: 0.82, clouds: true, sunX: 0.28, sunY: 0.19, rayTint: 'rgba(224,242,255,0.28)', mistRgba: 'rgba(225,240,255,0.26)' },
    lush_cave:      { skyTop: '#081b24', skyMid: '#113a47', skyBot: '#296e73', fog: 0x174852, sun: 0xa5f3fc, amb: 0x5eead4, gnd: 0x142621, fluid: 0x06b6d4, fluidSpec: 0xa5f3fc, fluidAlpha: 0.82, clouds: false, noSunRays: true, caveRays: true, sunX: 0.52, sunY: 0.05, rayTint: 'rgba(135,248,255,0.26)', mistRgba: 'rgba(45,155,168,0.22)' },
    ancient_city:   { skyTop: '#03070e', skyMid: '#071b24', skyBot: '#0f3947', fog: 0x091c26, sun: 0x22d3ee, amb: 0x0ea5e9, gnd: 0x060b12, fluid: 0x0891b2, fluidSpec: 0xa5f3fc, fluidAlpha: 0.84, clouds: false, noSunRays: true, caveRays: true, sunX: 0.50, sunY: 0.14, rayTint: 'rgba(34,211,238,0.20)', mistRgba: 'rgba(14,116,144,0.20)' },
    bamboo:         { skyTop: '#2684eb', skyMid: '#8ad8ce', skyBot: '#edffe4', fog: 0xcff5d8, sun: 0xffefba, amb: 0xa7f3d0, gnd: 0x2d4a26, fluid: 0x0f766e, fluidSpec: 0xfef9c3, fluidAlpha: 0.78, clouds: true, sunX: 0.68, sunY: 0.20, rayTint: 'rgba(255,242,170,0.28)', mistRgba: 'rgba(218,252,226,0.24)' },
    beach_palm:     { skyTop: '#1084e8', skyMid: '#6cd0ff', skyBot: '#fff0c7', fog: 0xc4ecff, sun: 0xfff4c2, amb: 0x99e0ff, gnd: 0x9b8249, fluid: 0x0ea5e9, fluidSpec: 0xffffff, fluidAlpha: 0.74, clouds: true, sunX: 0.75, sunY: 0.20, rayTint: 'rgba(255,235,168,0.30)', mistRgba: 'rgba(224,246,255,0.20)' },
    autumn:         { skyTop: '#2a6bd6', skyMid: '#f29e6d', skyBot: '#ffe0a3', fog: 0xf5bd8c, sun: 0xffc978, amb: 0xfdba74, gnd: 0x59341d, fluid: 0x1d68b8, fluidSpec: 0xffe4a0, fluidAlpha: 0.78, clouds: true, sunX: 0.68, sunY: 0.24, rayTint: 'rgba(255,186,104,0.34)', mistRgba: 'rgba(255,209,150,0.26)' },
    abandoned_city: { skyTop: '#263447', skyMid: '#68798f', skyBot: '#f5b895', fog: 0x9aa3b2, sun: 0xffd2a6, amb: 0x94a3b8, gnd: 0x27272a, fluid: 0x334155, fluidSpec: 0xffdcb8, fluidAlpha: 0.76, clouds: true, sunX: 0.56, sunY: 0.26, rayTint: 'rgba(255,196,148,0.28)', mistRgba: 'rgba(216,184,168,0.22)' },
    grand_ruins:    { skyTop: '#1c4f6b', skyMid: '#589b8d', skyBot: '#d6f5e3', fog: 0x9ec9b8, sun: 0xffe6a6, amb: 0xa7f3d0, gnd: 0x3a473c, fluid: 0x2563eb, fluidSpec: 0xffffff, fluidAlpha: 0.80, clouds: true, sunX: 0.62, sunY: 0.28, rayTint: 'rgba(255,236,170,0.34)', mistRgba: 'rgba(180,235,210,0.24)' },
    castle_city:    { skyTop: '#1f6fe8', skyMid: '#7cc2ff', skyBot: '#ffe8bd', fog: 0xd9e6f7, sun: 0xffebc2, amb: 0xa5ccff, gnd: 0x3f4e32, fluid: 0x1e6bb8, fluidSpec: 0xfff0c4, fluidAlpha: 0.80, clouds: true, sunX: 0.74, sunY: 0.20, rayTint: 'rgba(255,226,158,0.28)', mistRgba: 'rgba(232,238,252,0.22)' },
    seaport:        { skyTop: '#1676e3', skyMid: '#74cbff', skyBot: '#fff0d4', fog: 0xcbe8ff, sun: 0xfff2c7, amb: 0x9fd2ff, gnd: 0x3b4d38, fluid: 0x1d4ed8, fluidSpec: 0xffffff, fluidAlpha: 0.78, clouds: true, sunX: 0.30, sunY: 0.21, rayTint: 'rgba(255,238,185,0.28)', mistRgba: 'rgba(220,242,255,0.22)' },
    blue_forest:    { skyTop: '#156cd6', skyMid: '#4eb3f2', skyBot: '#b6f0f8', fog: 0x89d6eb, sun: 0xffe9c4, amb: 0x8ce2f7, gnd: 0x1b4d52, fluid: 0x1e88e5, fluidSpec: 0xd8f3ff, fluidAlpha: 0.78, clouds: true, sunX: 0.68, sunY: 0.20, rayTint: 'rgba(180,240,255,0.24)', mistRgba: 'rgba(165,236,245,0.22)' },
    wheat_valley:   { skyTop: '#1c244f', skyMid: '#7d4d68', skyBot: '#f59f63', fog: 0xd98e62, sun: 0xffc675, amb: 0xf4a872, gnd: 0x4d3418, fluid: null, fluidSpec: 0xffe4a0, fluidAlpha: 0, clouds: true, sunX: 0.42, sunY: 0.30, rayTint: 'rgba(255,196,120,0.34)', mistRgba: 'rgba(245,180,120,0.26)', fireflies: true },
    pine_valley:    { skyTop: '#2672d6', skyMid: '#72b3e8', skyBot: '#d9ecfa', fog: 0xc4ddf2, sun: 0xffe9c4, amb: 0xaad2f5, gnd: 0x384d2a, fluid: 0x2584c6, fluidSpec: 0xfff0c4, fluidAlpha: 0.78, clouds: true, sunX: 0.70, sunY: 0.20, rayTint: 'rgba(255,226,168,0.25)', mistRgba: 'rgba(218,236,250,0.20)' },
    giant_jungle:   { skyTop: '#1a6fd6', skyMid: '#68bee8', skyBot: '#d4f0e8', fog: 0xbadfd8, sun: 0xffe9c4, amb: 0x99dec8, gnd: 0x284722, fluid: 0x1c7db8, fluidSpec: 0xffe9c4, fluidAlpha: 0.76, clouds: true, sunX: 0.66, sunY: 0.19, rayTint: 'rgba(255,228,165,0.24)', mistRgba: 'rgba(205,238,228,0.22)' },
    highland:       { skyTop: '#1f70db', skyMid: '#72b8f5', skyBot: '#e3f1ff', fog: 0xcbe3fa, sun: 0xffefc4, amb: 0xb0d8ff, gnd: 0x5c4028, fluid: 0x2584c6, fluidSpec: 0xffffff, fluidAlpha: 0.78, clouds: true, sunX: 0.70, sunY: 0.18, rayTint: 'rgba(255,240,190,0.26)', mistRgba: 'rgba(220,238,255,0.24)' },
    lush_steppe:    { skyTop: '#217ef0', skyMid: '#7accff', skyBot: '#eef9ff', fog: 0xd4f0ff, sun: 0xfff1c4, amb: 0xb7e4ff, gnd: 0x42662b, fluid: 0x269be6, fluidSpec: 0xffffff, fluidAlpha: 0.76, clouds: true, sunX: 0.70, sunY: 0.18, rayTint: 'rgba(255,244,185,0.28)', mistRgba: 'rgba(232,248,255,0.22)' },
    green_plains:   { skyTop: '#2684f2', skyMid: '#82d2ff', skyBot: '#edf8ff', fog: 0xd4f0ff, sun: 0xfff2c6, amb: 0xbbe6ff, gnd: 0x487630, fluid: 0x29a0ea, fluidSpec: 0xffffff, fluidAlpha: 0.78, clouds: true, sunX: 0.72, sunY: 0.19, rayTint: 'rgba(255,244,185,0.28)', mistRgba: 'rgba(232,248,255,0.22)' },
    snowy_plains:   { skyTop: '#5e96dc', skyMid: '#b5d7f5', skyBot: '#edf6ff', fog: 0xdeedfa, sun: 0xfef9e7, amb: 0xd0e6fb, gnd: 0xdfeefa, fluid: 0x6ec3f0, fluidSpec: 0xffffff, fluidAlpha: 0.85, clouds: true, sunX: 0.64, sunY: 0.16, rayTint: 'rgba(230,245,255,0.24)', mistRgba: 'rgba(235,246,255,0.30)' },
    dark_forest:    { skyTop: '#162026', skyMid: '#2f4538', skyBot: '#6d8272', fog: 0x35473a, sun: 0xd1fae5, amb: 0x5d7a64, gnd: 0x1e2e1a, fluid: 0x1e3a4c, fluidSpec: 0x94a3b8, fluidAlpha: 0.82, clouds: true, sunX: 0.65, sunY: 0.20, rayTint: 'rgba(180,220,190,0.18)', mistRgba: 'rgba(55,75,60,0.28)' },
    pale_garden:    { skyTop: '#475569', skyMid: '#94a3b8', skyBot: '#e2e8f0', fog: 0xb8c0cc, sun: 0xe2e8f0, amb: 0xcbd5e1, gnd: 0x64748b, fluid: 0x64748b, fluidSpec: 0xffffff, fluidAlpha: 0.80, clouds: true, sunX: 0.55, sunY: 0.22, rayTint: 'rgba(226,232,240,0.22)', mistRgba: 'rgba(203,213,225,0.34)' },
    nightmare_woods:{ skyTop: '#07020a', skyMid: '#26061b', skyBot: '#4a0b2c', fog: 0x240718, sun: 0xf43f5e, amb: 0x9d174d, gnd: 0x1a0612, fluid: 0x581c87, fluidSpec: 0xf43f5e, fluidAlpha: 0.84, clouds: false, noSunRays: true, sunX: 0.50, sunY: 0.20, rayTint: 'rgba(244,63,94,0.22)', mistRgba: 'rgba(76,5,25,0.40)' },
    dim_sift:       { skyTop: '#111d42', skyMid: '#2a6f82', skyBot: '#7ef5dc', fog: 0x4dbeb8, sun: 0xd8b4fe, amb: 0xa78bfa, gnd: 0x3b1d5e, fluid: 0x2dd4bf, fluidSpec: 0xfef08a, fluidAlpha: 0.82, clouds: false, aurora: true, noSunRays: true, sunX: 0.50, sunY: 0.18, rayTint: 'rgba(110,245,220,0.25)', mistRgba: 'rgba(130,245,225,0.22)' },
    dim_nether:     { skyTop: '#240404', skyMid: '#6e100a', skyBot: '#c93818', fog: 0x7d180e, sun: 0xff9b54, amb: 0xd9461f, gnd: 0x290707, fluid: 0xff6200, fluidSpec: 0xfef08a, fluidAlpha: 0.96, clouds: false, noSunRays: true, sunX: 0.50, sunY: 0.35, rayTint: 'rgba(255,120,40,0.24)', mistRgba: 'rgba(180,45,15,0.22)' },
    dim_end:        { skyTop: '#060312', skyMid: '#180833', skyBot: '#3b156b', fog: 0x240b47, sun: 0xe9d5ff, amb: 0x8b5cf6, gnd: 0x140826, fluid: null, fluidSpec: 0xe9d5ff, fluidAlpha: 0, clouds: false, stars: true, noSunRays: true, sunX: 0.50, sunY: 0.20, rayTint: 'rgba(216,180,254,0.22)', mistRgba: 'rgba(90,30,150,0.20)' },
    dim_dragon_realm:{ skyTop: '#09041c', skyMid: '#240b47', skyBot: '#4c1d95', fog: 0x2a0f4d, sun: 0xf0abfc, amb: 0xa855f7, gnd: 0x1a0836, fluid: 0x6d28d9, fluidSpec: 0xe9d5ff, fluidAlpha: 0.78, clouds: false, stars: true, noSunRays: true, sunX: 0.50, sunY: 0.22, rayTint: 'rgba(232,121,249,0.26)', mistRgba: 'rgba(139,92,246,0.22)' },
    dim_warden:     { skyTop: '#030b14', skyMid: '#07222f', skyBot: '#0e3c4d', fog: 0x071d29, sun: 0x67e8f9, amb: 0x22d3ee, gnd: 0x06131c, fluid: 0x06b6d4, fluidSpec: 0xa5f3fc, fluidAlpha: 0.80, clouds: false, noSunRays: true, caveRays: true, sunX: 0.50, sunY: 0.16, rayTint: 'rgba(34,211,238,0.22)', mistRgba: 'rgba(8,145,178,0.22)' }
  };
  const cfg = presets[biomeKey] || presets.sakura;

  // Build authentic rich terrain + landmarks on 24x16x24 grid
  let fluidY = 3.84;
  if (biomeKey === 'dim_nether') {
    fillBox(0, 0, 0, SX - 1, 1, SZ - 1, B_.NETHERRACK);
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const river = Math.abs(x - 12 + Math.sin(z * 0.28) * 3.0) < 4.2;
      if (!river) {
        const h = 4 + ((x < 6 || x > 18) ? 1 : 0) + ((z < 5 && (x < 5 || x > 19)) ? 2 : 0);
        for (let y = 2; y <= h; y++) setB(x, y, z, y === h ? B_.CRIMSON_NYLIUM : B_.NETHERRACK);
      }
    }
    placeTree(4, 6, 14, B_.CRIMSON_STEM, B_.NETHER_WART_BLOCK, 5);
    placeTree(19, 6, 12, B_.CRIMSON_STEM, B_.NETHER_WART_BLOCK, 4);
    placeTree(17, 6, 6, B_.WARPED_STEM || B_.CRIMSON_STEM, B_.WARPED_WART_BLOCK || B_.NETHER_WART_BLOCK, 4);
    setB(5, 8, 13, B_.SHROOMLIGHT); setB(18, 8, 12, B_.SHROOMLIGHT);
    fillBox(0, 13, 0, SX - 1, 15, 4, B_.NETHERRACK);
  } else if (biomeKey === 'dim_end' || biomeKey === 'dim_dragon_realm') {
    fluidY = -99;
    for (let z = 2; z < SZ - 1; z++) for (let x = 2; x < SX - 2; x++) {
      const d = Math.hypot(x - 12, z - 12);
      if (d < 9.5) {
        setB(x, 1, z, B_.END_STONE);
        setB(x, 2, z, B_.END_STONE);
        setB(x, 3, z, B_.END_STONE);
        if (d < 6.8) setB(x, 4, z, B_.END_STONE);
      }
    }
    fillBox(5, 4, 8, 6, 12, 9, B_.OBSIDIAN);
    fillBox(17, 4, 7, 18, 13, 8, B_.OBSIDIAN);
    fillBox(10, 5, 3, 13, 11, 6, B_.PURPUR_BLOCK);
    setB(11, 12, 4, B_.GLOW_CRYSTAL || B_.SEA_LANTERN);
    setB(12, 12, 5, B_.GLOW_CRYSTAL || B_.SEA_LANTERN);
    setB(5, 13, 8, B_.GLOW_CRYSTAL || B_.SHROOMLIGHT);
    setB(17, 14, 7, B_.GLOW_CRYSTAL || B_.SHROOMLIGHT);
  } else if (biomeKey === 'dim_sift') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.SIFT_STONE || B_.STONE);
      setB(x, 1, z, B_.HUSK_SOIL || B_.DIRT);
      const pond = Math.hypot((x - 12) * 0.9, (z - 12) * 0.72) < 5.2;
      if (!pond) {
        const h = (z < 7 || x < 5 || x > 18) ? 5 : 4;
        for (let y = 2; y < h; y++) setB(x, y, z, B_.HUSK_SOIL || B_.DIRT);
        setB(x, h, z, ((x + z) % 3 === 0 ? (B_.LULLABY_GRASS || B_.SIFT_GRASS) : (B_.SIFT_GRASS || B_.GRASS)));
      }
    }
    placeTree(4, 6, 14, B_.SIFT_LOG || B_.BIRCH_LOG, B_.SIFT_LEAVES || B_.SAKURA_LEAVES, 5);
    placeTree(19, 6, 13, B_.SIFT_LOG || B_.BIRCH_LOG, B_.LULLABY_LEAVES || B_.SAKURA_LEAVES, 4);
    placeTree(10, 6, 4, B_.SIFT_LOG || B_.BIRCH_LOG, B_.SIFT_LEAVES || B_.OAK_LEAVES, 5);
    setB(6, 5, 16, B_.SIFT_FLOWER || B_.FLOWER_LAVENDER);
    setB(17, 5, 15, B_.SIFT_FLOWER || B_.FLOWER_LAVENDER);
  } else if (biomeKey === 'dim_warden') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.DEEPSLATE); setB(x, 1, z, B_.WARDEN_SCULK_STONE || B_.DEEPSLATE);
      const h = (z < 6 || x < 4 || x > 19) ? 5 : 4;
      for (let y = 2; y <= h; y++) setB(x, y, z, y === h ? ((x + z) % 3 === 0 ? B_.SCULK : (B_.WARDEN_SCULK_STONE || B_.DEEPSLATE)) : B_.DEEPSLATE);
    }
    fillBox(8, 5, 4, 15, 5, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE_BRICKS);
    fillBox(8, 12, 4, 15, 12, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE_BRICKS);
    fillBox(8, 6, 4, 8, 11, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE_BRICKS);
    fillBox(15, 6, 4, 15, 11, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE_BRICKS);
    fillBox(9, 6, 4, 14, 11, 4, B_.WARDEN_PORTAL || B_.SEA_LANTERN);
    placeTree(4, 6, 15, B_.SCULK_LOG || B_.DEEPSLATE, B_.SCULK_LEAVES || B_.BLUE_LEAVES, 5);
    placeTree(19, 6, 14, B_.SCULK_LOG || B_.DEEPSLATE, B_.SCULK_LEAVES || B_.BLUE_LEAVES, 5);
    setB(6, 5, 7, B_.SOUL_FIRE || B_.SOUL_LANTERN); setB(17, 5, 7, B_.SOUL_FIRE || B_.SOUL_LANTERN);
  } else if (biomeKey === 'mangrove') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.MUD || B_.DIRT); setB(x, 2, z, B_.MUD || B_.DIRT);
      const d1 = Math.hypot(x - 4.5, z - 14), d2 = Math.hypot(x - 19, z - 13), d3 = Math.hypot(x - 11.5, z - 5);
      if (d1 < 5.2 || d2 < 5.0 || d3 < 5.8 || z < 3) {
        setB(x, 3, z, B_.MUD || B_.DIRT);
        setB(x, 4, z, (x + z) % 4 === 0 ? (B_.MOSS_BLOCK || B_.GRASS) : B_.GRASS);
      } else {
        if ((x * 7 + z * 13) % 11 === 0) setB(x, 4, z, B_.LILY_PAD || B_.MOSS_BLOCK);
      }
    }
    // Arching Mangrove prop roots rising out of murky turquoise lagoon
    for (const [tx, tz, th] of [[5, 14, 5], [18, 13, 5], [10, 5, 5], [15, 7, 4]]) {
      for (const [rx, rz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        setB(tx + rx, 3, tz + rz, B_.MANGROVE_ROOTS || B_.OAK_LOG);
        setB(tx + rx, 4, tz + rz, B_.MANGROVE_ROOTS || B_.OAK_LOG);
        setB(tx + rx, 5, tz + rz, B_.MANGROVE_ROOTS || B_.OAK_LOG);
      }
      placeTree(tx, 6, tz, B_.MANGROVE_LOG || B_.OAK_LOG, B_.MANGROVE_LEAVES || B_.OAK_LEAVES, th);
      setB(tx - 2, 7, tz + 1, B_.GLOW_VINES || B_.OAK_LEAVES);
      setB(tx + 2, 7, tz + 1, B_.GLOW_VINES || B_.OAK_LEAVES);
    }
    setB(10, 4, 15, B_.LILY_PAD || B_.MOSS_BLOCK); setB(13, 4, 12, B_.LOTUS || B_.FLOWER_RED);
  } else if (biomeKey === 'desert') {
    fluidY = 2.82;
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.SANDSTONE); setB(x, 1, z, B_.SANDSTONE);
      const oasis = Math.hypot((x - 16.5) * 0.85, (z - 15.5) * 1.05) < 3.6;
      if (!oasis) {
        const dune = 3 + Math.round(Math.sin(x * 0.25 + z * 0.14) * 1.1 + (z < 6 ? 1.5 : 0));
        for (let y = 2; y < dune; y++) setB(x, y, z, B_.SANDSTONE);
        setB(x, dune, z, B_.SAND);
      } else {
        setB(x, 2, z, B_.SAND);
        if (Math.hypot(x - 16.5, z - 15.5) > 2.6) setB(x, 3, z, B_.GRASS);
      }
    }
    // Iconic Stepped Desert Pyramid Temple in background
    for (let tier = 0; tier < 6; tier++) {
      fillBox(3 + tier, 4 + tier, 3 + tier, 13 - tier, 4 + tier, 12 - tier, (tier === 2 || tier === 4) ? B_.TERRACOTTA : B_.SANDSTONE);
    }
    fillBox(7, 4, 11, 9, 6, 12, 0); // Temple entrance
    setB(6, 6, 12, B_.TERRACOTTA); setB(10, 6, 12, B_.TERRACOTTA);
    // Cacti & oasis palm
    for (const [cx, cy, cz, ch] of [[4, 5, 16, 3], [20, 5, 10, 4], [12, 4, 17, 2]]) {
      for (let y = 0; y < ch; y++) setB(cx, cy + y, cz, B_.CACTUS);
    }
    setB(19, 4, 16, B_.PALM_LOG || B_.OAK_LOG); setB(19, 5, 16, B_.PALM_LOG || B_.OAK_LOG);
    setB(18, 6, 16, B_.PALM_LOG || B_.OAK_LOG); setB(18, 7, 16, B_.PALM_LOG || B_.OAK_LOG);
    fillBox(16, 8, 15, 20, 8, 17, B_.PALM_LEAVES || B_.OAK_LEAVES);
    fillBox(17, 8, 14, 19, 8, 18, B_.PALM_LEAVES || B_.OAK_LEAVES);
  } else if (biomeKey === 'meadow') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const brook = Math.abs(x - 12 + Math.sin(z * 0.28) * 3.0) < 2.9;
      if (brook) {
        setB(x, 2, z, B_.SAND);
      } else {
        const hill = 4 + Math.round((z < 8 ? (8 - z) * 0.25 : 0) + (Math.sin(x * 0.3) * 0.8 + 0.6));
        for (let y = 2; y < hill; y++) setB(x, y, z, B_.DIRT);
        setB(x, hill, z, B_.GRASS);
        const hSeed = (x * 37 + z * 53) % 13;
        if (hSeed === 0) setB(x, hill + 1, z, B_.FLOWER_YELLOW);
        else if (hSeed === 2) setB(x, hill + 1, z, B_.FLOWER_RED);
        else if (hSeed === 4) setB(x, hill + 1, z, B_.FLOWER_LAVENDER || B_.FLOWER_RED);
        else if (hSeed === 6 || hSeed === 9) setB(x, hill + 1, z, B_.TALL_GRASS);
      }
    }
    placeTree(4, 5, 13, B_.BIRCH_LOG || B_.OAK_LOG, B_.BIRCH_LEAVES || B_.OAK_LEAVES, 4);
    placeTree(19, 6, 11, B_.OAK_LOG, B_.OAK_LEAVES, 5);
    placeTree(7, 6, 4, B_.OAK_LOG, B_.OAK_LEAVES, 4);
  } else if (biomeKey === 'snowy_plains') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const bay = Math.hypot((x - 16) * 0.9, (z - 16) * 0.85) < 5.6;
      if (bay) {
        setB(x, 2, z, B_.DIRT);
        setB(x, 3, z, B_.ICE);
      } else {
        const h = (z < 7 && x < 10) ? 5 : 4;
        for (let y = 2; y < h; y++) setB(x, y, z, B_.DIRT);
        setB(x, h, z, B_.SNOWY_DIRT || B_.SNOW);
      }
    }
    for (const [sx, sy, sz] of [[5, 6, 4], [18, 5, 6]]) {
      for (let y = 0; y < 5; y++) setB(sx, sy + y, sz, B_.SPRUCE_LOG || B_.OAK_LOG);
      fillBox(sx - 2, sy + 2, sz - 2, sx + 2, sy + 2, sz + 2, B_.SPRUCE_LEAVES || B_.OAK_LEAVES);
      fillBox(sx - 1, sy + 3, sz - 1, sx + 1, sy + 4, sz + 1, B_.SPRUCE_LEAVES || B_.OAK_LEAVES);
      setB(sx, sy + 5, sz, B_.SNOW);
    }
  } else if (biomeKey === 'alpine') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.STONE);
      const lake = Math.hypot((x - 12.5) * 0.85, (z - 17) * 1.1) < 4.5;
      if (lake) {
        setB(x, 2, z, B_.STONE);
        if (Math.hypot(x - 12.5, z - 17) > 3.1) setB(x, 3, z, B_.PACKED_ICE || B_.ICE);
      } else {
        const peakDist = Math.min(Math.hypot(x - 6, z - 4), Math.hypot(x - 18, z - 3.5));
        const mh = Math.max(4, Math.min(13, Math.round(13.5 - peakDist * 0.95 + (Math.sin(x * 0.5) * 0.8))));
        for (let y = 2; y < mh; y++) setB(x, y, z, y >= 8 ? B_.STONE : B_.DIRT);
        setB(x, mh, z, (mh >= 10 || z > 12) ? B_.SNOW : (mh >= 7 ? B_.STONE : B_.GRASS));
      }
    }
    // Frozen icefall down mountain saddle
    fillBox(11, 4, 6, 12, 9, 8, B_.PACKED_ICE || B_.ICE);
    // Spruce conifers
    for (const [sx, sy, sz] of [[4, 6, 14], [19, 6, 15], [16, 7, 10], [8, 6, 11]]) {
      for (let y = 0; y < 5; y++) setB(sx, sy + y, sz, B_.SPRUCE_LOG || B_.OAK_LOG);
      fillBox(sx - 2, sy + 2, sz - 2, sx + 2, sy + 2, sz + 2, B_.SPRUCE_LEAVES || B_.OAK_LEAVES);
      fillBox(sx - 1, sy + 3, sz - 1, sx + 1, sy + 4, sz + 1, B_.SPRUCE_LEAVES || B_.OAK_LEAVES);
      setB(sx, sy + 5, sz, B_.SNOW);
    }
  } else if (biomeKey === 'lush_cave') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.DEEPSLATE || B_.STONE);
      setB(x, 1, z, B_.STONE);
      const pool = Math.hypot((x - 12) * 0.85, (z - 14.5) * 0.95) < 5.0;
      if (!pool) {
        const wall = (x <= 3 || x >= SX - 4 || z <= 3);
        const h = wall ? (8 + ((x + z) % 3)) : 4;
        for (let y = 2; y <= h; y++) setB(x, y, z, y === 4 ? (B_.MOSS_BLOCK || B_.GRASS) : ((y < 4) ? B_.DEEPSLATE : B_.STONE));
        if (!wall && (x * 11 + z * 7) % 9 === 0) setB(x, 5, z, B_.MUSHROOM_GLOW);
      }
      // Cave ceiling vault with sunlit skylight opening in center-back
      const inSkylight = Math.hypot(x - 12, z - 8) < 3.4;
      if (!inSkylight && z < 16) {
        setB(x, 13, z, B_.MOSS_BLOCK || B_.STONE);
        setB(x, 14, z, B_.DEEPSLATE || B_.STONE);
        setB(x, 15, z, B_.STONE);
        if ((x * 5 + z * 13) % 7 === 0) setB(x, 12, z, B_.GLOW_VINES || B_.SHROOMLIGHT);
      }
    }
    // Luminous amethyst/cyan crystal formations + cave glow
    fillBox(5, 5, 8, 6, 7, 9, B_.GLOW_CRYSTAL || B_.SEA_LANTERN);
    setB(5, 8, 8, B_.GLOW_CRYSTAL || B_.SEA_LANTERN);
    fillBox(17, 5, 9, 18, 8, 10, B_.GLOW_CRYSTAL || B_.SEA_LANTERN);
    setB(17, 9, 9, B_.SHROOMLIGHT);
    setB(10, 5, 7, B_.GLOW_CRYSTAL || B_.SEA_LANTERN);
    fillBox(11, 4, 4, 12, 12, 4, B_.SEA_LANTERN);
  } else if (biomeKey === 'ancient_city') {
    fluidY = 2.84;
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.DEEPSLATE); setB(x, 1, z, B_.DEEPSLATE_TILES || B_.DEEPSLATE);
      setB(x, 2, z, ((x + z) & 2) ? (B_.DEEPSLATE_BRICKS || B_.DEEPSLATE) : (B_.DEEPSLATE_TILES || B_.DEEPSLATE));
      if (Math.abs(x - 12) <= 1 && z >= 8) setB(x, 2, z, B_.GRAY_WOOL || B_.WHITE_WOOL);
      else if (x <= 3 || x >= SX - 4 || ((x * 7 + z * 11) % 7 === 0)) setB(x, 2, z, B_.SCULK || B_.DEEPSLATE);
    }
    fillBox(5, 3, 4, 18, 3, 6, B_.DEEPSLATE_BRICKS || B_.DEEPSLATE);
    for (let rx = 7; rx <= 16; rx++) { setB(rx, 4, 7, B_.SOUL_FIRE || B_.GLOW_CRYSTAL); }
    for (let y = 4; y <= 11; y++) { setB(5, y, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE); setB(18, y, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE); }
    fillBox(5, 4, 5, 18, 4, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE);
    fillBox(5, 11, 5, 18, 11, 5, B_.REINFORCED_DEEPSLATE || B_.DEEPSLATE);
    fillBox(6, 5, 5, 17, 10, 5, 0);
    setB(9, 4, 16, B_.SOUL_LANTERN || B_.SEA_LANTERN); setB(15, 4, 16, B_.SOUL_LANTERN || B_.SEA_LANTERN);
    setB(3, 3, 13, B_.SCULK_SENSOR || B_.GLOW_CRYSTAL); setB(20, 3, 12, B_.SCULK_SHRIEKER || B_.SEA_LANTERN);
  } else if (biomeKey === 'autumn') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const river = Math.abs(x - 12 + Math.sin(z * 0.3) * 2.5) < 3.6;
      if (!river) {
        const h = (z < 6 || x < 5 || x > 18) ? 5 : 4;
        for (let y = 2; y < h; y++) setB(x, y, z, B_.AUTUMN_PODZOL || B_.DIRT);
        setB(x, h, z, B_.AUTUMN_GRASS || B_.GRASS);
      } else {
        setB(x, 2, z, B_.SAND);
      }
    }
    placeTree(4, 6, 15, B_.OAK_LOG, B_.CRIMSON_MAPLE_LEAVES || B_.ACACIA_LEAVES, 5);
    placeTree(19, 6, 14, B_.BIRCH_LOG || B_.OAK_LOG, B_.ACACIA_LEAVES, 5);
    placeTree(6, 6, 6, B_.OAK_LOG, B_.ACACIA_LEAVES, 4);
    placeTree(18, 6, 5, B_.OAK_LOG, B_.CRIMSON_MAPLE_LEAVES || B_.ACACIA_LEAVES, 5);
  } else if (biomeKey === 'abandoned_city') {
    fluidY = -99;
    fillBox(0, 0, 0, SX - 1, 2, SZ - 1, B_.STONE);
    fillBox(0, 3, 0, SX - 1, 3, SZ - 1, B_.ASPHALT || B_.DEEPSLATE);
    for (let z = 2; z < SZ - 1; z += 3) { setB(9, 3, z, B_.ROAD_LINE || B_.SAND); setB(14, 3, z, B_.ROAD_LINE || B_.SAND); }
    // Left dark brutalist tower + right pale concrete tower wrapped in heavy green foliage + central boulevard vine tree + white L-streetlamp
    fillBox(1, 4, 3, 6, 14, 14, B_.DEEPSLATE || B_.CONCRETE);
    fillBox(2, 5, 4, 5, 13, 13, 0);
    for (let y = 5; y <= 12; y += 2) { setB(6, y, 6, B_.GLASS); setB(6, y, 10, B_.GLASS); setB(6, y, 12, B_.OAK_LEAVES); }
    fillBox(4, 14, 7, 6, 15, 13, B_.OAK_LEAVES || B_.MOSS_BLOCK);
    fillBox(17, 4, 3, 22, 13, 14, B_.CONCRETE || B_.STONE_BRICK);
    fillBox(18, 5, 4, 21, 12, 13, 0);
    for (let y = 5; y <= 11; y += 2) { setB(17, y, 6, B_.GLASS); setB(17, y, 10, B_.OAK_LEAVES); }
    fillBox(17, 13, 8, 20, 14, 13, B_.OAK_LEAVES || B_.MOSS_BLOCK);
    setB(11, 3, 12, B_.GRASS); placeTree(11, 4, 12, B_.OAK_LOG, B_.OAK_LEAVES, 5);
    setB(9, 6, 13, B_.VINE); setB(13, 6, 11, B_.VINE);
    for (let y = 4; y <= 8; y++) setB(15, y, 16, B_.CONCRETE);
    setB(14, 8, 16, B_.CONCRETE); setB(14, 7, 16, B_.SEA_LANTERN || B_.LANTERN);
  } else if (biomeKey === 'grand_ruins') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.DEEPSLATE_BRICKS || B_.STONE);
      setB(x, 3, z, ((x + z) % 3 === 0) ? (B_.MOSSY_STONE_BRICK || B_.MOSS_BLOCK) : B_.STONE_BRICK);
    }
    fillBox(9, 4, 9, 14, 4, 14, B_.MOSSY_STONE_BRICK || B_.STONE_BRICK);
    fillBox(10, 5, 10, 13, 5, 13, B_.END_PORTAL_FRAME);
    fillBox(11, 5, 11, 12, 5, 12, B_.LAVA);
    fillBox(5, 4, 5, 8, 12, 6, B_.STONE_BRICK);
    fillBox(15, 4, 5, 18, 12, 6, B_.STONE_BRICK);
    fillBox(6, 12, 5, 17, 13, 6, B_.MOSSY_STONE_BRICK || B_.STONE_BRICK);
    fillBox(1, 5, 8, 4, 8, 16, B_.GRASS);
    placeTree(2, 9, 13, B_.SPRUCE_LOG || B_.OAK_LOG, B_.SPRUCE_LEAVES || B_.OAK_LEAVES, 5);
    setB(7, 4, 10, B_.IRON_GRATE || B_.STONE_BRICK); setB(16, 4, 10, B_.IRON_GRATE || B_.STONE_BRICK);
    setB(5, 13, 5, B_.CAMPFIRE); setB(18, 13, 5, B_.CAMPFIRE);
  } else if (biomeKey === 'castle_city') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const moat = (z >= 13 && z <= 16);
      if (!moat) { setB(x, 2, z, B_.DIRT); setB(x, 3, z, B_.DIRT); setB(x, 4, z, B_.GRASS); }
    }
    fillBox(10, 4, 13, 13, 4, 16, B_.PLANKS);
    fillBox(5, 5, 5, 18, 9, 10, B_.STONE_BRICK);
    fillBox(6, 6, 6, 17, 9, 9, 0);
    fillBox(10, 5, 10, 13, 7, 10, 0);
    for (let x = 5; x <= 18; x += 2) setB(x, 10, 10, B_.STONE_BRICK);
    fillBox(3, 5, 7, 6, 12, 10, B_.MARBLE_BRICK || B_.STONE_BRICK);
    fillBox(17, 5, 7, 20, 12, 10, B_.MARBLE_BRICK || B_.STONE_BRICK);
    fillBox(3, 13, 7, 6, 13, 10, B_.COPPER_ROOF || B_.TERRACOTTA);
    fillBox(17, 13, 7, 20, 13, 10, B_.COPPER_ROOF || B_.TERRACOTTA);
    setB(9, 6, 11, B_.LANTERN || B_.SHROOMLIGHT); setB(14, 6, 11, B_.LANTERN || B_.SHROOMLIGHT);
  } else if (biomeKey === 'beach_palm') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.SANDSTONE || B_.STONE); setB(x, 1, z, B_.SAND);
      const isSea = (x > 8 && z < 17 && (x - 6 + (17 - z) * 0.55) > 7.5);
      if (!isSea) {
        setB(x, 2, z, B_.SAND); setB(x, 3, z, B_.SAND);
        setB(x, 4, z, (x < 5 && z > 15) ? B_.GRASS : B_.SAND);
      } else {
        setB(x, 2, z, B_.SAND);
        if ((x === 14 && z === 10) || (x === 18 && z === 12)) setB(x, 3, z, B_.CORAL_PINK);
        if (x === 16 && z === 9) setB(x, 3, z, B_.CORAL_BLUE);
      }
    }
    for (const [px, pz, dir] of [[4, 15, 1], [18, 17, -1]]) {
      setB(px, 5, pz, B_.PALM_LOG || B_.OAK_LOG); setB(px, 6, pz, B_.PALM_LOG || B_.OAK_LOG);
      setB(px + dir, 7, pz, B_.PALM_LOG || B_.OAK_LOG); setB(px + dir, 8, pz, B_.PALM_LOG || B_.OAK_LOG);
      fillBox(px + dir - 2, 9, pz - 1, px + dir + 2, 9, pz + 1, B_.PALM_LEAVES || B_.OAK_LEAVES);
      fillBox(px + dir - 1, 9, pz - 2, px + dir + 1, 9, pz + 2, B_.PALM_LEAVES || B_.OAK_LEAVES);
    }
  } else if (biomeKey === 'bamboo') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const stream = Math.abs(x - 12 + Math.cos(z * 0.28) * 2.5) < 3.2;
      if (!stream) { setB(x, 2, z, B_.DIRT); setB(x, 3, z, B_.DIRT); setB(x, 4, z, B_.GRASS); }
      else setB(x, 2, z, B_.SAND);
    }
    for (const [bx, bz, bh] of [[3,15,9],[5,12,10],[7,17,8],[4,8,9],[16,14,10],[19,16,9],[18,9,9],[15,6,8],[7,5,9]]) {
      for (let y = 5; y < 5 + bh && y < SY; y++) setB(bx, y, bz, B_.BAMBOO_BLOCK || B_.OAK_LOG);
      fillBox(bx - 1, Math.min(SY - 1, 4 + bh), bz - 1, bx + 1, Math.min(SY - 1, 4 + bh), bz + 1, B_.BIRCH_LEAVES || B_.OAK_LEAVES);
    }
  } else if (biomeKey === 'seaport') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.SAND);
      if (x < 6 || (x > 17 && z < 12)) { setB(x, 2, z, B_.DIRT); setB(x, 3, z, B_.DIRT); setB(x, 4, z, B_.GRASS); }
    }
    fillBox(3, 4, 13, 13, 4, 17, B_.PLANKS);
    for (const [px, pz] of [[7, 13], [7, 17], [13, 13], [13, 17]]) { setB(px, 3, pz, B_.OAK_LOG); setB(px, 2, pz, B_.OAK_LOG); }
    for (let y = 5; y <= 12; y++) {
      const bId = (y % 2 === 0) ? (B_.MARBLE_BRICK || B_.SNOW) : (B_.TERRACOTTA || B_.NETHER_BRICK);
      fillBox(19, y, 6, 20, y, 7, bId);
    }
    fillBox(19, 13, 6, 20, 13, 7, B_.SEA_LANTERN || B_.SHROOMLIGHT);
  } else if (biomeKey === 'blue_forest') {
    fluidY = -99;
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const h = (z < 6 || x > 18) ? 5 : 4;
      for (let y = 2; y < h; y++) setB(x, y, z, B_.DIRT);
      const trail = Math.abs(x - 11 + Math.sin(z * 0.28) * 2.5) < 1.8;
      setB(x, h, z, trail ? B_.SAND : (B_.BLUE_GRASS || B_.GRASS));
      if (!trail && (x * 13 + z * 7) % 5 === 0) setB(x, h + 1, z, B_.TEAL_FERN || B_.TALL_GRASS);
    }
    placeTree(4, 5, 14, B_.AZURE_LOG || B_.BIRCH_LOG, B_.AZURE_LEAVES || B_.OAK_LEAVES, 6);
    placeTree(18, 6, 13, B_.AZURE_LOG || B_.BIRCH_LOG, B_.COBALT_LEAVES || B_.OAK_LEAVES, 7);
    placeTree(10, 6, 5, B_.AZURE_LOG || B_.BIRCH_LOG, B_.AZURE_LEAVES || B_.OAK_LEAVES, 6);
    for (let y = 5; y < 9; y++) setB(15, y, 16, B_.MUSHROOM_STEM);
    fillBox(14, 9, 15, 16, 9, 17, B_.MUSHROOM_RED_CAP); setB(15, 10, 16, B_.MUSHROOM_RED_CAP);
    setB(8, 5, 17, B_.OAK_FENCE); setB(8, 6, 17, B_.LANTERN || B_.TORCH_BLOCK);
  } else if (biomeKey === 'wheat_valley') {
    fluidY = -99;
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const hill = (z < 8 && x > 15) ? 2 : ((Math.sin(x * 0.28 + z * 0.22) > 0.45) ? 1 : 0);
      const topY = 3 + hill;
      setB(x, 0, z, B_.STONE);
      for (let y = 1; y < topY; y++) setB(x, y, z, B_.DIRT);
      if (Math.abs(x - 12) <= 1 && z >= 18) {
        setB(x, topY, z, B_.STONE_BRICK);
      } else {
        setB(x, topY, z, B_.FARMLAND || B_.DIRT);
        setB(x, topY + 1, z, B_.WHEAT_3 || B_.FLOWER_YELLOW);
      }
    }
    // Scenic silhouette windmill in background left + glowing fence torch flanking path
    fillBox(6, 4, 2, 10, 6, 6, B_.STONE_BRICK);
    fillBox(7, 7, 3, 9, 10, 5, B_.PLANKS);
    fillBox(7, 11, 3, 9, 12, 5, B_.DARK_SLATE_ROOF || B_.DEEPSLATE);
    setB(8, 8, 6, B_.LANTERN || B_.TORCH_BLOCK);
    for (let k = -3; k <= 3; k++) { setB(8 + k, 9, 6, B_.WHITE_WOOL || B_.PLANKS); setB(8, 9 + k, 6, B_.WHITE_WOOL || B_.PLANKS); }
    setB(10, 4, 19, B_.OAK_FENCE); setB(10, 5, 19, B_.TORCH_BLOCK);
    setB(14, 4, 19, B_.OAK_FENCE); setB(14, 5, 19, B_.TORCH_BLOCK);
  } else if (biomeKey === 'pine_valley') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      if (z > 16 && x > 15) { setB(x, 2, z, B_.SAND); }
      else { setB(x, 2, z, B_.DIRT); setB(x, 3, z, B_.DIRT); setB(x, 4, z, B_.GRASS); }
    }
    fillBox(8, 5, 8, 16, 8, 14, B_.PLANKS);
    fillBox(8, 9, 8, 16, 11, 14, B_.DARK_SLATE_ROOF || B_.DEEPSLATE);
    fillBox(6, 5, 10, 7, 14, 11, B_.STONE_BRICK);
    fillBox(6, 14, 10, 7, 15, 11, B_.TERRACOTTA);
    for (const [sx, sz] of [[4, 14], [19, 11], [20, 6]]) {
      for (let y = 5; y <= 11; y++) setB(sx, y, sz, B_.SPRUCE_LOG);
      fillBox(sx - 2, 7, sz - 2, sx + 2, 8, sz + 2, B_.SPRUCE_LEAVES);
      fillBox(sx - 1, 9, sz - 1, sx + 1, 11, sz + 1, B_.SPRUCE_LEAVES);
    }
  } else if (biomeKey === 'giant_jungle') {
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const river = Math.abs(x - 11 + Math.sin(z * 0.25) * 2.5) < 3.6;
      if (!river) { setB(x, 2, z, B_.DIRT); setB(x, 3, z, B_.DIRT); setB(x, 4, z, B_.GRASS); }
      else setB(x, 2, z, B_.SAND);
    }
    for (const [tx, tz, th] of [[4, 14, 9], [18, 13, 10], [17, 5, 8]]) {
      fillBox(tx, 5, tz, tx + 1, 5 + th, tz + 1, B_.OAK_LOG);
      fillBox(tx - 3, 4 + th, tz - 3, tx + 3, 5 + th, tz + 3, B_.OAK_LEAVES);
      for (let vy = 6; vy < 4 + th; vy++) { setB(tx - 2, vy, tz + 2, B_.VINE); setB(tx + 2, vy, tz - 1, B_.VINE); }
    }
  } else if (biomeKey === 'highland' || biomeKey === 'lush_steppe' || biomeKey === 'green_plains') {
    fluidY = -99;
    const isH = (biomeKey === 'highland');
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const h = isH ? Math.floor(5 + (x > 14 ? 4 : 0) + Math.sin(z * 0.25) * 1.5) : Math.floor(4 + Math.sin(x * 0.22) * 0.8);
      for (let y = 2; y < h; y++) setB(x, y, z, (isH && y > 5) ? (B_.TERRACOTTA || B_.DIRT) : B_.DIRT);
      setB(x, h, z, B_.GRASS);
    }
    placeTree(5, 6, 13, B_.OAK_LOG, B_.OAK_LEAVES, 4);
  } else if (biomeKey === 'dark_forest' || biomeKey === 'pale_garden' || biomeKey === 'nightmare_woods') {
    fluidY = -99;
    const isPale = (biomeKey === 'pale_garden'), isNight = (biomeKey === 'nightmare_woods');
    const topB = isPale ? (B_.PALE_MOSS || B_.MOSS_BLOCK) : (isNight ? (B_.NIGHTMARE_MOSS || B_.MOSS_BLOCK) : B_.GRASS);
    const logB = isPale ? (B_.PALE_LOG || B_.BIRCH_LOG) : (isNight ? (B_.NIGHTMARE_LOG || B_.SPRUCE_LOG) : B_.OAK_LOG);
    const leafB = isPale ? (B_.PALE_LEAVES || B_.WHITE_WOOL) : (isNight ? (B_.NIGHTMARE_LEAVES || B_.SPRUCE_LEAVES) : B_.SPRUCE_LEAVES);
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT); setB(x, 2, z, B_.DIRT); setB(x, 3, z, B_.DIRT); setB(x, 4, z, topB);
    }
    placeTree(6, 5, 13, logB, leafB, 6);
    placeTree(17, 5, 11, logB, leafB, 6);
    placeTree(11, 5, 6, logB, leafB, 5);
  } else {
    // Default 'sakura': lush cherry blossom river & sandbar in golden BSL light
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      setB(x, 0, z, B_.STONE); setB(x, 1, z, B_.DIRT);
      const riverCenter = 12.0 + Math.sin(z * 0.27) * 2.8;
      const inRiver = Math.abs(x - riverCenter) < 4.3;
      const isSandbar = inRiver && z >= 8 && z <= 12 && Math.abs(x - riverCenter) < 2.0;
      if (isSandbar) {
        setB(x, 2, z, B_.SAND); setB(x, 3, z, B_.SAND); setB(x, 4, z, B_.SAND);
      } else if (!inRiver) {
        const h = (z < 6 && (x < 6 || x > 17)) ? 5 : 4;
        for (let y = 2; y < h; y++) setB(x, y, z, B_.DIRT);
        setB(x, h, z, B_.GRASS);
        if (h === 4 && ((x * 29 + z * 17) % 9 === 0)) setB(x, 5, z, B_.SAKURA_PETALS || B_.FLOWER_RED);
      } else {
        setB(x, 2, z, B_.SAND);
      }
    }
    placeTree(4, 5, 15, B_.SAKURA_LOG || B_.OAK_LOG, B_.SAKURA_LEAVES || B_.OAK_LEAVES, 5);
    placeTree(19, 5, 14, B_.OAK_LOG, B_.OAK_LEAVES, 5);
    placeTree(6, 5, 6, B_.OAK_LOG, B_.OAK_LEAVES, 4);
    placeTree(18, 6, 5, B_.SAKURA_LOG || B_.OAK_LOG, B_.SAKURA_LEAVES || B_.OAK_LEAVES, 5);
  }

  // Smooth per-vertex AO + warm sun/cool sky radiosity tint
  const isOccluder = (id) => {
    if (!id) return 0;
    const d = DEF_[id];
    if (!d || d.trans || d.cross || d.glass || d.emissive) return 0;
    return d.foliage ? 0.48 : 1.0;
  };
  const vertexAO = (x, y, z, fc, v) => {
    const ax = x + fc.d[0], ay = y + fc.d[1], az = z + fc.d[2];
    const [uA, vA] = fc.axes;
    const su = v[uA] ? 1 : -1, sv = v[vA] ? 1 : -1;
    const oU = [uA === 0 ? su : 0, uA === 1 ? su : 0, uA === 2 ? su : 0];
    const oV = [vA === 0 ? sv : 0, vA === 1 ? sv : 0, vA === 2 ? sv : 0];
    const s1 = isOccluder(getB(ax + oU[0], ay + oU[1], az + oU[2]));
    const s2 = isOccluder(getB(ax + oV[0], ay + oV[1], az + oV[2]));
    const cr = isOccluder(getB(ax + oU[0] + oV[0], ay + oU[1] + oV[1], az + oU[2] + oV[2]));
    const occ = (s1 >= 0.9 && s2 >= 0.9) ? 3.0 : Math.min(3.0, s1 + s2 + cr);
    return 1.0 - occ * 0.14;
  };

  // Build single face-culled + crossed-foliage BufferGeometry mapped to real atlasTex (flipY = false!)
  const pos = [], norm = [], uv = [], col = [], ind = [];
  let vCnt = 0;
  const uStep = 1 / cols, vStep = 1 / rows, padU = 0.002, padV = 0.002;
  const FACES = [
    { d: [0, 1, 0],  axes: [0, 2], tIdx: 0, shade: [1.04, 1.02, 0.98], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { d: [0, -1, 0], axes: [0, 2], tIdx: 2, shade: [0.56, 0.58, 0.64], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { d: [0, 0, 1],  axes: [0, 1], tIdx: 1, shade: [0.84, 0.86, 0.92], v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
    { d: [0, 0, -1], axes: [0, 1], tIdx: 1, shade: [0.96, 0.91, 0.82], v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
    { d: [1, 0, 0],  axes: [2, 1], tIdx: 1, shade: [0.98, 0.94, 0.86], v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
    { d: [-1, 0, 0], axes: [2, 1], tIdx: 1, shade: [0.76, 0.80, 0.88], v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] }
  ];

  for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const id = getB(x, y, z);
    if (!id) continue;
    const def = DEF_[id];
    const tiles = (def && def.tiles) ? def.tiles : [3, 3, 3];
    const emBoost = (def && def.emissive) ? 1.38 : 1.0;

    if (def && def.lily) {
      const tile = tiles[0];
      const tx = tile % cols, ty = Math.floor(tile / cols);
      const u0 = tx * uStep + padU, u1 = (tx + 1) * uStep - padU, v0 = ty * vStep + padV, v1 = (ty + 1) * vStep - padV;
      const fy = y + 0.04;
      for (const [px, pz, uu, vv] of [[x+0.08,z+0.92,u0,v1],[x+0.92,z+0.92,u1,v1],[x+0.92,z+0.08,u1,v0],[x+0.08,z+0.08,u0,v0]]) {
        pos.push(px, fy, pz); norm.push(0, 1, 0); uv.push(uu, vv); col.push(1.0, 1.05, 0.98);
      }
      ind.push(vCnt, vCnt + 1, vCnt + 2, vCnt, vCnt + 2, vCnt + 3);
      vCnt += 4;
      continue;
    }

    if (def && def.cross) {
      const tile = tiles[0];
      const tx = tile % cols, ty = Math.floor(tile / cols);
      const u0 = tx * uStep + padU, u1 = (tx + 1) * uStep - padU, v0 = ty * vStep + padV, v1 = (ty + 1) * vStep - padV;
      const quads = [
        [[0.14, 0, 0.14], [0.86, 0, 0.86], [0.86, 0.94, 0.86], [0.14, 0.94, 0.14]],
        [[0.14, 0, 0.86], [0.86, 0, 0.14], [0.86, 0.94, 0.14], [0.14, 0.94, 0.86]]
      ];
      for (const q of quads) {
        const quv = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
        for (let i = 0; i < 4; i++) {
          pos.push(x + q[i][0], y + q[i][1], z + q[i][2]);
          norm.push(0, 1, 0);
          uv.push(quv[i][0], quv[i][1]);
          col.push(emBoost, emBoost, emBoost);
        }
        ind.push(vCnt, vCnt + 1, vCnt + 2, vCnt, vCnt + 2, vCnt + 3, vCnt, vCnt + 2, vCnt + 1, vCnt, vCnt + 3, vCnt + 2);
        vCnt += 4;
      }
      continue;
    }

    for (let f = 0; f < 6; f++) {
      const fc = FACES[f];
      const nb = getB(x + fc.d[0], y + fc.d[1], z + fc.d[2]);
      const nbDef = nb ? DEF_[nb] : null;
      if (nb && !(nbDef && (nbDef.glass || nbDef.trans || nbDef.foliage || nbDef.cross))) continue;
      const tile = tiles[fc.tIdx] != null ? tiles[fc.tIdx] : tiles[0];
      const tx = tile % cols, ty = Math.floor(tile / cols);
      const u0 = tx * uStep + padU, u1 = (tx + 1) * uStep - padU;
      const v0 = ty * vStep + padV, v1 = (ty + 1) * vStep - padV;
      const fUvs = (f === 1) ? [[u0,v0],[u1,v0],[u1,v1],[u0,v1]] : [[u0,v1],[u1,v1],[u1,v0],[u0,v0]];
      const aos = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        const ao = (def && def.emissive) ? 1.0 : vertexAO(x, y, z, fc, fc.v[i]);
        aos[i] = ao;
        pos.push(x + fc.v[i][0], y + fc.v[i][1], z + fc.v[i][2]);
        norm.push(fc.d[0], fc.d[1], fc.d[2]);
        uv.push(fUvs[i][0], fUvs[i][1]);
        col.push(fc.shade[0] * ao * emBoost, fc.shade[1] * ao * emBoost, fc.shade[2] * ao * emBoost);
      }
      if (aos[0] + aos[2] > aos[1] + aos[3]) {
        ind.push(vCnt, vCnt + 1, vCnt + 2, vCnt, vCnt + 2, vCnt + 3);
      } else {
        ind.push(vCnt + 1, vCnt + 2, vCnt + 3, vCnt + 1, vCnt + 3, vCnt);
      }
      vCnt += 4;
    }
  }

  const sc = new THREE.Scene();
  const isEnclosedCave = (biomeKey === 'ancient_city' || biomeKey === 'lush_cave');
  const isOceanVista = (biomeKey === 'beach_palm' || biomeKey === 'seaport');
  sc.fog = new THREE.FogExp2(cfg.fog, isEnclosedCave ? 0.020 : 0.0135);

  // Rich 3-stop atmospheric sky backdrop canvas texture
  const skyCv = document.createElement('canvas');
  skyCv.width = 4; skyCv.height = 128;
  const sCtx = skyCv.getContext('2d');
  const grd = sCtx.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, cfg.skyTop);
  grd.addColorStop(0.46, cfg.skyMid || cfg.skyTop);
  grd.addColorStop(0.84, cfg.skyBot);
  grd.addColorStop(1, cfg.skyBot);
  sCtx.fillStyle = grd;
  sCtx.fillRect(0, 0, 4, 128);
  const skyTex = new THREE.CanvasTexture(skyCv);
  sc.background = skyTex;

  const hemi = new THREE.HemisphereLight(cfg.amb, cfg.gnd, 1.05);
  sc.add(hemi);
  const sun = new THREE.DirectionalLight(cfg.sun, 1.48);
  sun.position.set(cfg.sunX < 0.5 ? -8 : 26, 24, -2);
  sun.target.position.set(12, 4, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.004;
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 2; sun.shadow.camera.far = 85;
  sc.add(sun);
  sc.add(sun.target);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(ind);

  if (!_oreThumbMat && typeof atlasTex !== 'undefined') {
    _oreThumbMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.45 });
  }
  const voxelMesh = new THREE.Mesh(geo, _oreThumbMat || new THREE.MeshLambertMaterial({ vertexColors: true }));
  voxelMesh.castShadow = true;
  voxelMesh.receiveShadow = true;
  sc.add(voxelMesh);

  // Specular shader water / glowing lava / ichor surface plane
  const disposables = [geo, skyTex];
  if (!isEnclosedCave && biomeKey !== 'dim_end') {
    const skirtColMap = {
      wheat_valley: 0xc99322, desert: 0xd8bf7a, alpine: 0xdce8f5, autumn: 0xb26d2a,
      sakura: 0x4b9e38, meadow: 0x4ea83b, mangrove: 0x3b6e35, bamboo: 0x3e9134,
      pine_valley: 0x438731, giant_jungle: 0x37852e, castle_city: 0x458e33,
      abandoned_city: 0x485058, grand_ruins: 0x3b4d3f, blue_forest: 0x1e8f85, dim_sift: 0x4b2a7b,
      dim_warden: 0x08232e, dim_nether: 0x5c180c, beach_palm: 0x1a7fc4, seaport: 0x1b4db8
    };
    const skGeo = new THREE.PlaneGeometry(220, 220);
    skGeo.rotateX(-Math.PI / 2);
    const skMat = new THREE.MeshLambertMaterial({ color: skirtColMap[biomeKey] || 0x4b8c32 });
    const skMesh = new THREE.Mesh(skGeo, skMat);
    skMesh.position.set(12, isOceanVista ? 2.4 : (biomeKey === 'wheat_valley' ? 3.85 : 3.92), 12);
    skMesh.receiveShadow = true;
    sc.add(skMesh);
    disposables.push(skGeo, skMat);
  }
  if (cfg.fluid !== null && fluidY > 0) {
    const wGeo = new THREE.PlaneGeometry(isOceanVista ? 220 : SX, isOceanVista ? 220 : SZ);
    wGeo.rotateX(-Math.PI / 2);
    const wMat = new THREE.MeshPhongMaterial({
      color: cfg.fluid,
      specular: cfg.fluidSpec || 0xffffff,
      shininess: biomeKey === 'dim_nether' ? 12 : 120,
      transparent: true,
      opacity: cfg.fluidAlpha,
      emissive: biomeKey === 'dim_nether' ? 0xd94600 : (biomeKey === 'dim_sift' || biomeKey === 'lush_cave' ? 0x0d9488 : 0x0b3a66),
      emissiveIntensity: biomeKey === 'dim_nether' ? 0.72 : 0.25
    });
    const wMesh = new THREE.Mesh(wGeo, wMat);
    wMesh.position.set(SX * 0.5, fluidY, SZ * 0.5);
    wMesh.receiveShadow = true;
    sc.add(wMesh);
    disposables.push(wGeo, wMat);
  }

  // Lightweight distant horizon silhouette landmarks so wide vistas feel boundless
  if (!isEnclosedCave && biomeKey !== 'dim_end') {
    const hMat = new THREE.MeshLambertMaterial({
      color: biomeKey === 'wheat_valley' ? 0x9c6d1b : (biomeKey === 'desert' ? 0xc29e5a : ((biomeKey === 'alpine' || biomeKey === 'snowy_plains') ? 0xbcd4ea : (biomeKey === 'dim_nether' ? 0x3b0d08 : (biomeKey === 'dim_sift' ? 0x312e81 : 0x325e34))))
    });
    const hillSpecs = biomeKey === 'wheat_valley'
      ? [[-14, 5.2, -20, 12, 3.2, 10], [36, 5.4, -24, 14, 3.4, 12], [12, 4.6, -42, 48, 2.2, 14], [-8, 8.8, -16, 4.2, 7.6, 4.2], [-8, 10.6, -13.6, 9.2, 1.4, 0.8], [-8, 10.6, -13.6, 1.4, 9.2, 0.8], [32, 9.0, -32, 4.6, 8.2, 4.6], [32, 11.2, -29.4, 9.6, 1.4, 0.8], [32, 11.2, -29.4, 1.4, 9.6, 0.8]]
      : (biomeKey === 'abandoned_city' || biomeKey === 'castle_city')
        ? [[-12, 9, -18, 6, 12, 6], [34, 10, -22, 7, 14, 7], [-20, 7, 4, 6, 8, 6], [38, 8, 2, 6, 10, 6], [10, 8, -36, 10, 11, 8]]
        : [[-16, 6.5, -18, 18, 5.5, 12], [38, 7.5, -22, 20, 7.0, 14], [12, 6.2, -38, 36, 5.0, 14], [-24, 5.8, 4, 10, 4.2, 14], [44, 6.2, 6, 10, 4.8, 14]];
    for (const [hx, hy, hz, hw, hh, hd] of hillSpecs) {
      const hg = new THREE.BoxGeometry(hw, hh, hd);
      const hm = new THREE.Mesh(hg, hMat);
      hm.position.set(hx, hy, hz);
      sc.add(hm);
      disposables.push(hg);
    }
    disposables.push(hMat);
  }

  // Layered soft Minecraft volumetric clouds / aurora / stars
  if (cfg.clouds) {
    const cMat = new THREE.MeshLambertMaterial({ color: 0xfff8ee, emissive: 0xffe8cc, emissiveIntensity: 0.45, transparent: true, opacity: 0.80, fog: false });
    const cSpecs = [[-12, 21.5, -18, 10.5, 0.75, 4.2], [5.5, 19.2, 2.5, 7.2, 0.65, 3.2], [24, 22.0, -14, 11.0, 0.75, 4.4], [14.0, 18.6, 9.0, 5.6, 0.55, 2.6], [38, 20.5, -26, 9.5, 0.65, 3.8]];
    for (const [cx, cy, cz, cw, ch, cd] of cSpecs) {
      const cg = new THREE.BoxGeometry(cw, ch, cd);
      const cm = new THREE.Mesh(cg, cMat);
      cm.position.set(cx, cy, cz);
      sc.add(cm);
      disposables.push(cg);
    }
    disposables.push(cMat);
  } else if (cfg.aurora) {
    const aMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.56, fog: false });
    const ag = new THREE.BoxGeometry(28, 0.7, 2.0);
    const am = new THREE.Mesh(ag, aMat); am.position.set(12, 19.5, -10); sc.add(am);
    disposables.push(ag, aMat);
  }

  const cam = new THREE.PerspectiveCamera(isEnclosedCave ? 64 : 62, 640 / 400, 0.1, 220);
  if (biomeKey === 'wheat_valley') {
    cam.position.set(14.6, 13.6, 30.2);
    cam.lookAt(10.6, 5.4, -6.0);
  } else if (isEnclosedCave) {
    cam.position.set(12.2, 8.8, 25.4);
    cam.lookAt(11.8, 5.2, 2.0);
  } else if (biomeKey === 'dim_end' || biomeKey === 'dim_dragon_realm') {
    cam.position.set(15.2, 13.8, 30.5);
    cam.lookAt(11.8, 5.4, 6.0);
  } else {
    cam.position.set(14.4, 13.2, 29.8);
    cam.lookAt(11.6, 5.0, 2.0);
  }

  return { scene: sc, camera: cam, cfg, dispose: () => { for (const d of disposables) try { d.dispose(); } catch (_) {} } };
}

function _applyShaderPostFXToThumb(oCtx, off, W, H, key, cfg) {
  // 1) BSL Atmospheric Bloom Pass (soft glowing highlights over water, sky, crystals)
  try {
    const bCv = document.createElement('canvas');
    bCv.width = 120; bCv.height = 75;
    const bCtx = bCv.getContext('2d');
    if (bCtx) {
      bCtx.drawImage(off, 0, 0, bCv.width, bCv.height);
      oCtx.save();
      if ('filter' in oCtx) oCtx.filter = 'blur(5px) brightness(1.16)';
      oCtx.globalCompositeOperation = 'screen';
      oCtx.globalAlpha = 0.28;
      oCtx.drawImage(bCv, 0, 0, W, H);
      oCtx.restore();
    }
  } catch (_) {}

  // 2) Sun Halo + Crepuscular God-Ray Shafts (or Cave Skylight Rays)
  oCtx.save();
  oCtx.globalCompositeOperation = 'screen';
  const sx = W * (cfg.sunX != null ? cfg.sunX : 0.7);
  const sy = H * (cfg.sunY != null ? cfg.sunY : 0.2);
  if (!cfg.noSunRays) {
    const sunG = oCtx.createRadialGradient(sx, sy, 2, sx, sy, W * 0.44);
    sunG.addColorStop(0, 'rgba(255, 252, 232, 0.72)');
    sunG.addColorStop(0.14, cfg.rayTint || 'rgba(255, 224, 155, 0.30)');
    sunG.addColorStop(0.55, 'rgba(255, 210, 140, 0.08)');
    sunG.addColorStop(1, 'rgba(255, 210, 140, 0)');
    oCtx.fillStyle = sunG;
    oCtx.fillRect(0, 0, W, H);
    // Crisp glowing solar disc
    const discG = oCtx.createRadialGradient(sx, sy, 0, sx, sy, 16);
    discG.addColorStop(0, 'rgba(255,255,245,0.92)');
    discG.addColorStop(0.45, 'rgba(255,238,185,0.45)');
    discG.addColorStop(1, 'rgba(255,238,185,0)');
    oCtx.fillStyle = discG;
    oCtx.beginPath(); oCtx.arc(sx, sy, 16, 0, Math.PI * 2); oCtx.fill();
  }
  if (!cfg.noSunRays || cfg.caveRays) {
    // Soft blurred volumetric light shafts streaming across trees/mountains/cave
    oCtx.save();
    if ('filter' in oCtx) oCtx.filter = 'blur(8px)';
    oCtx.globalAlpha = 0.62;
    const beamOffsets = [[-90, 48], [-25, 62], [45, 76], [125, 54]];
    for (const [dxEnd, bw] of beamOffsets) {
      const tx = sx + dxEnd * (sx > W * 0.5 ? -1.4 : 1.4);
      const rg = oCtx.createLinearGradient(sx, sy, tx, H * 0.92);
      rg.addColorStop(0, cfg.rayTint || 'rgba(255, 232, 168, 0.22)');
      rg.addColorStop(0.65, 'rgba(255, 240, 200, 0.06)');
      rg.addColorStop(1, 'rgba(255, 240, 200, 0)');
      oCtx.fillStyle = rg;
      oCtx.beginPath();
      oCtx.moveTo(sx - 8, sy);
      oCtx.lineTo(sx + 8, sy);
      oCtx.lineTo(tx + bw, H);
      oCtx.lineTo(tx - bw * 0.6, H);
      oCtx.closePath();
      oCtx.fill();
    }
    oCtx.restore();
  }

  // 3) Atmospheric Horizon Mist Band
  const mistG = oCtx.createLinearGradient(0, H * 0.34, 0, H * 0.64);
  mistG.addColorStop(0, 'rgba(255,255,255,0)');
  mistG.addColorStop(0.5, cfg.mistRgba || 'rgba(255,236,204,0.20)');
  mistG.addColorStop(1, 'rgba(255,255,255,0)');
  oCtx.fillStyle = mistG;
  oCtx.fillRect(0, H * 0.34, W, H * 0.30);

  // 4) Water Shimmer Specular Reflection Glints (BSL water sparkles)
  if (cfg.fluid !== null && key !== 'dim_nether' && key !== 'castle_city') {
    for (let i = 0; i < 6; i++) {
      const wy = H * (0.64 + i * 0.048);
      const wx = W * 0.5 + (sx - W * 0.5) * 0.35 + ((i % 2 === 0 ? -1 : 1) * (10 + i * 5));
      const ww = 38 + (5 - i) * 14;
      const wg = oCtx.createLinearGradient(wx - ww, wy, wx + ww, wy);
      wg.addColorStop(0, 'rgba(255,255,255,0)');
      wg.addColorStop(0.5, 'rgba(255,250,224,0.28)');
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      oCtx.fillStyle = wg;
      oCtx.fillRect(wx - ww, wy, ww * 2, 2.2);
    }
  }
  oCtx.restore();

  // 4b) Warm Golden Firefly Sparks for Wheat Valley / Chill Sunset / Sakura
  if (cfg.fireflies || key === 'sakura' || key === 'autumn' || key === 'blue_forest') {
    oCtx.save();
    oCtx.globalCompositeOperation = 'screen';
    const pts = [[0.18,0.62,2.8],[0.31,0.55,2.0],[0.48,0.68,2.5],[0.62,0.52,2.2],[0.78,0.64,3.0],[0.24,0.74,1.8],[0.69,0.71,2.0]];
    for (const [fx, fy, fr] of pts) {
      const gx = fx * W, gy = fy * H;
      const fg = oCtx.createRadialGradient(gx, gy, 0, gx, gy, fr * 3.5);
      fg.addColorStop(0, 'rgba(255, 244, 180, 0.92)');
      fg.addColorStop(0.5, 'rgba(255, 200, 95, 0.36)');
      fg.addColorStop(1, 'rgba(255, 200, 95, 0)');
      oCtx.fillStyle = fg;
      oCtx.beginPath(); oCtx.arc(gx, gy, fr * 3.5, 0, Math.PI * 2); oCtx.fill();
    }
    oCtx.restore();
  }

  // 5) Subtle Cinematic Shader Vignette
  oCtx.save();
  const vigG = oCtx.createRadialGradient(W * 0.5, H * 0.48, W * 0.28, W * 0.5, H * 0.5, W * 0.68);
  vigG.addColorStop(0, 'rgba(0,0,0,0)');
  vigG.addColorStop(1, 'rgba(8,12,20,0.26)');
  oCtx.fillStyle = vigG;
  oCtx.fillRect(0, 0, W, H);
  oCtx.restore();
}

function renderReal3DWorldThumb(biomeKey) {
  const key = biomeKey || 'sakura';
  const cv = document.getElementById('oreWorldThumbCanvas');
  const badge = document.getElementById('oreWorldThumbBadge');
  if (typeof ORE_BIOME_PREVIEWS !== 'undefined' && badge) {
    const info = ORE_BIOME_PREVIEWS[key] || ORE_BIOME_PREVIEWS.sakura;
    if (info) badge.textContent = (typeof getLocBiomeLabel === 'function') ? getLocBiomeLabel(key) : info.label;
  }
  if (!cv) return false;
  if (key === 'live') return captureLiveWorldThumb(cv);

  const ctx2d = cv.getContext('2d');
  if (!ctx2d) return false;

  // Fast cache hit!
  if (_oreThumb3DCache.has(key)) {
    ctx2d.clearRect(0, 0, cv.width, cv.height);
    ctx2d.drawImage(_oreThumb3DCache.get(key), 0, 0, cv.width, cv.height);
    return true;
  }

  if (typeof renderer === 'undefined' || !renderer || typeof THREE === 'undefined' || typeof atlasTex === 'undefined') {
    return false;
  }

  const W = 640, H = 400;
  if (!_oreThumbRT || _oreThumbRT.width !== W || _oreThumbRT.height !== H) {
    if (_oreThumbRT && typeof _oreThumbRT.dispose === 'function') _oreThumbRT.dispose();
    _oreThumbRT = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
    _oreThumbPxBuf = new Uint8Array(W * H * 4);
  }

  const prevRT = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevTM = renderer.toneMapping;
  const prevExposure = renderer.toneMappingExposure;
  const prevClip = renderer.localClippingEnabled;
  const prevShadow = renderer.shadowMap.enabled;
  const prevAutoShadow = renderer.shadowMap.autoUpdate;

  let diorama = null;
  try {
    diorama = _buildBiomeDioramaScene(key);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.localClippingEnabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setRenderTarget(_oreThumbRT);
    renderer.clear(true, true, true);
    renderer.render(diorama.scene, diorama.camera);
    renderer.readRenderTargetPixels(_oreThumbRT, 0, 0, W, H, _oreThumbPxBuf);

    // Flip WebGL bottom-up rows into 480x300 offscreen canvas + apply BSL Shader Post-FX
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const oCtx = off.getContext('2d');
    const imgData = oCtx.createImageData(W, H);
    const rowBytes = W * 4;
    for (let y = 0; y < H; y++) {
      const srcOff = (H - 1 - y) * rowBytes;
      imgData.data.set(_oreThumbPxBuf.subarray(srcOff, srcOff + rowBytes), y * rowBytes);
    }
    oCtx.putImageData(imgData, 0, 0);
    _applyShaderPostFXToThumb(oCtx, off, W, H, key, diorama.cfg);
    _oreThumb3DCache.set(key, off);

    ctx2d.clearRect(0, 0, cv.width, cv.height);
    ctx2d.drawImage(off, 0, 0, cv.width, cv.height);
    return true;
  } catch (_) {
    return false;
  } finally {
    renderer.setRenderTarget(prevRT);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.toneMapping = prevTM;
    renderer.toneMappingExposure = prevExposure;
    renderer.localClippingEnabled = prevClip;
    renderer.shadowMap.enabled = prevShadow;
    renderer.shadowMap.autoUpdate = prevAutoShadow;
    renderer.shadowMap.needsUpdate = true;
    if (diorama) diorama.dispose();
  }
}

// ----------------------------------------------------------------------------
// 3. PAUSE MENU PLAYERS LIST + TRANSPARENT 3D CHARACTER + DRESSING ROOM RETURN
// ----------------------------------------------------------------------------
function renderPausePlayersListV61() {
  const PAUSE_CROWN_SVG = `<svg viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="1" y="2" width="2" height="6" fill="#facc15"/>
    <rect x="5" y="1" width="2" height="7" fill="#fef08a"/>
    <rect x="9" y="2" width="2" height="6" fill="#facc15"/>
    <rect x="1" y="4" width="10" height="4" fill="#facc15"/>
    <rect x="2" y="5" width="2" height="2" fill="#eab308"/>
    <rect x="5" y="5" width="2" height="2" fill="#f97316"/>
    <rect x="8" y="5" width="2" height="2" fill="#eab308"/>
    <rect x="1" y="8" width="10" height="1" fill="#a16207"/>
  </svg>`;
  const box = document.getElementById('pausePlayersList');
  const title = document.getElementById('pauseWorldPlayersTitle');
  const worldName = (typeof currentWorldMeta !== 'undefined' && currentWorldMeta && currentWorldMeta.name) || tr('Thế giới', 'World');
  if (title) title.textContent = tr(`Người chơi trong ${worldName}`, `Players in ${worldName}`);
  if (!box) return;
  const myName = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || (typeof localPlayerName !== 'undefined' && localPlayerName) || tr('Người chơi', 'Player');
  const myAv = buildPixelAvatarSvg(null, 'js-local-av');
  const amIHost = (typeof isSimAuthority === 'function') ? isSimAuthority() : true;
  const hostPeerId = (typeof _wsRoomHostId !== 'undefined') ? _wsRoomHostId : '';
  let html = `
    <div class="pause-player-row">
      <div class="pause-player-row-main">
        <div class="pause-player-av js-local-av">${myAv}</div>
        <div class="pause-player-row-name">${escHtml(myName)}</div>
      </div>
      ${amIHost ? `<div class="pause-crown-box" title="${tr('Chủ phòng (Host)', 'World Host')}">${PAUSE_CROWN_SVG}</div>` : ''}
    </div>
  `;
  if (typeof remotePlayers !== 'undefined' && remotePlayers) {
    for (const rp of remotePlayers.values()) {
      if (!rp || rp.isBuddy) continue;
      const skObj = (typeof getSkinDef === 'function' && rp.skinId) ? getSkinDef(rp.skinId) : null;
      const guestAv = buildPixelAvatarSvg(skObj || { skin: '#d4a373', hair: '#2b2d42', eye: '#1d4ed8' });
      const rpIsHost = !!(hostPeerId && rp.id === hostPeerId);
      html += `
        <div class="pause-player-row">
          <div class="pause-player-row-main">
            <div class="pause-player-av">${guestAv}</div>
            <div class="pause-player-row-name">${escHtml(rp.name || tr('Bạn chơi', 'Player'))}</div>
          </div>
          ${rpIsHost ? `<div class="pause-crown-box" title="${tr('Chủ phòng (Host)', 'World Host')}">${PAUSE_CROWN_SVG}</div>` : ''}
        </div>
      `;
    }
  }
  box.innerHTML = html;
  if (typeof syncAllPlayerAvatarFaces === 'function') syncAllPlayerAvatarFaces();
}

// ----------------------------------------------------------------------------
// 4. CRITICAL DOM FIX: ENSURE DIALOG MODALS SIT OUTSIDE #hud (SO THEY SHOW IN
//    LOBBY & PAUSE WHEN body.in-lobby / body.in-menu SETS #hud display:none!)
// ----------------------------------------------------------------------------
function ensureDialogsOutsideHud() {
  const stage = document.getElementById('gameStage');
  const hud = document.getElementById('hud');
  if (!stage || !hud) return;
  ['friendsModal', 'addFriendModal', 'profileModal', 'friendReqBanner', 'worldLoadingOverlay', 'toast'].forEach(id => {
    const el = document.getElementById(id);
    if (el && hud.contains(el)) stage.appendChild(el);
  });
}

// ----------------------------------------------------------------------------
// 5. BOOTSTRAP HOOKS (Preserves all existing IDs & wiring)
// ----------------------------------------------------------------------------
function initV61UiPolish() {
  ensureDialogsOutsideHud();
  syncAllPlayerAvatarFaces();
  if (typeof applyLanguage === 'function') applyLanguage(currentLang, false);
  if (typeof syncTimeWeatherAdminLocks === 'function') syncTimeWeatherAdminLocks();

  // Wire "Phòng thay đồ" (#pauseBtnEditHud) cleanly to Dressing Room w/ return-to-Pause
  // (While #pauseBtnHud in the bottom-left strip continues to open HUD Editor!)
  const pauseDrBtn = document.getElementById('pauseBtnEditHud');
  if (pauseDrBtn && !pauseDrBtn.dataset.v61Bound) {
    pauseDrBtn.dataset.v61Bound = '1';
    const cloned = pauseDrBtn.cloneNode(true);
    pauseDrBtn.parentNode.replaceChild(cloned, pauseDrBtn);
    cloned.addEventListener('click', () => {
      if (typeof ensureAudio === 'function') ensureAudio();
      window._drOpenedFromPause = true;
      document.getElementById('menuModal')?.classList.add('hidden');
      if (typeof openDressingRoom === 'function') openDressingRoom();
    });
  }

  // Ensure closing Dressing Room returns to Pause Menu when opened from Pause
  ['btnDrBack', 'btnDrConfirm'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!window._drOpenedFromPause) return;
      window._drOpenedFromPause = false;
      document.getElementById('lobbyScreen')?.classList.add('hidden');
      document.body.classList.remove('in-lobby');
      document.body.classList.add('in-menu');
      const mm = document.getElementById('menuModal');
      if (mm) { mm.classList.remove('hidden', 'from-lobby'); mm.classList.add('pause-mode'); }
      syncAllPlayerAvatarFaces();
      if (typeof renderPausePlayersList === 'function') renderPausePlayersList();
      if (typeof renderPauseChar3D === 'function') renderPauseChar3D();
    });
  });
}

