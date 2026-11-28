// NUCRAFT Module: src/ui/Chat.js — Chat box, profanity filter & slash commands

  // Semi-Transparent Minecraft Chat Box + Toggleable Profanity Filter (###) + Co-op Sync!
  let profanityFilterEnabled = localStorage.getItem('luanti_profanity_filter') !== '0';
  const DEFAULT_BAD_WORDS = ['dm', 'dmm', 'đm', 'đmm', 'vl', 'vcl', 'cl', 'cc', 'cặc', 'lồn', 'buồi', 'địt', 'dit', 'đụ', 'du ma', 'đụ má', 'ngu', 'chó đẻ', 'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'motherfucker'];
  let customBadWords = [];
  try { customBadWords = JSON.parse(localStorage.getItem('luanti_custom_badwords') || '[]') || []; } catch (_) {}
  function filterProfanity(text) {
    if (!profanityFilterEnabled || !text) return text;
    let out = String(text);
    const list = DEFAULT_BAD_WORDS.concat(customBadWords).filter(Boolean);
    for (let i = 0; i < list.length; i++) {
      const w = list[i].trim(); if (!w) continue;
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[\\s.,!?])(${esc})(?=$|[\\s.,!?])`, 'gi');
      out = out.replace(re, (m, pre) => pre + '###');
    }
    return out;
  }
  let _lastChatTopPx = -1, _chatPosDirty = true, _lastPbVis = null;
  function markChatPosDirty() { _chatPosDirty = true; }
  function syncChatWrapPosition() {
    const cw = document.getElementById('chatWrap'), pb = document.getElementById('posBox');
    if (!cw || !pb) return;
    const pbVis = !pb.classList.contains('hidden');
    if (pbVis !== _lastPbVis) { _lastPbVis = pbVis; _chatPosDirty = true; }
    if (!_chatPosDirty && _lastChatTopPx >= 0) return;
    _chatPosDirty = false;
    const wantTop = (pbVis && pb.offsetHeight > 0) ? Math.round(pb.offsetTop + pb.offsetHeight + 5) : 10;
    if (wantTop !== _lastChatTopPx) {
      _lastChatTopPx = wantTop;
      cw.style.top = wantTop + 'px';
    }
  }
  window.addEventListener('resize', () => { _lastChatTopPx = -1; _chatPosDirty = true; syncChatWrapPosition(); });
  function appendChatLine(sender, rawMsg, isSys = false) {
    const log = document.getElementById('chatLog'); if (!log) return;
    syncChatWrapPosition();
    const cleanMsg = isSys ? rawMsg : filterProfanity(rawMsg);
    const line = document.createElement('div');
    line.className = 'chat-line' + (isSys ? ' sys' : '');
    line.textContent = isSys ? cleanMsg : `<${sender}> ${cleanMsg}`;
    log.appendChild(line);
    while (log.children.length > 8) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
    setTimeout(() => line.classList.add('faded'), 9500);
  }
  let chatOpen = false;
  function openChatBox(prefill = '') {
    if (chatOpen) return;
    syncChatWrapPosition();
    chatOpen = true; isPlaying = false; mining.active = false;
    if (typeof clearMoveKeys === 'function') clearMoveKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    const wrap = document.getElementById('chatWrap'), inp = document.getElementById('chatInput');
    wrap.classList.add('open');
    if (prefill) inp.value = prefill;
    setTimeout(() => { inp.focus(); const len = inp.value.length; inp.setSelectionRange(len, len); }, 20);
  }
  function closeChatBox() {
    if (!chatOpen) return;
    chatOpen = false;
    const wrap = document.getElementById('chatWrap'), inp = document.getElementById('chatInput');
    inp.blur(); wrap.classList.remove('open');
    isPlaying = true; safeLockPointer();
  }
  let isAdminUnlocked = false;
  function syncMobSpawnLockUI() {
    const locked = (typeof gameMode !== 'undefined' && gameMode === 'survival' && !isAdminUnlocked);
    document.body.classList.toggle('survival-locked-mobs', locked);
    const notice = document.getElementById('mobSpawnLockNotice');
    if (notice) notice.style.display = locked ? 'flex' : 'none';
  }
  window.syncMobSpawnLockUI = syncMobSpawnLockUI;

  function setAdminUnlocked(enabled, notify = true) {
    isAdminUnlocked = !!enabled;
    document.body.classList.toggle('admin-unlocked', isAdminUnlocked);
    syncMobSpawnLockUI();
    const btn = document.getElementById('btnAdminUnlock');
    if (btn) {
      btn.textContent = isAdminUnlocked ? '👑 Admin: ĐÃ MỞ' : '👑 Mở Khóa Admin';
      btn.classList.toggle('mc-btn-green', isAdminUnlocked);
    }
    const gmH1 = document.querySelector('#menuModal .gm-brand h1');
    if (gmH1) gmH1.textContent = typeof tr === 'function' ? tr('CÀI ĐẶT', 'SETTINGS') : 'CÀI ĐẶT';
    if (typeof syncTimeWeatherAdminLocks === 'function') syncTimeWeatherAdminLocks();
    if (!isAdminUnlocked) {
      const wPane = document.getElementById('gmPaneWorld');
      if (wPane && wPane.classList.contains('active')) {
        document.querySelector('#gmNav .gm-tab[data-gtab="play"]')?.click();
      }
      if (typeof lobbyBiome !== 'undefined' && (lobbyBiome === 'dim_sift' || String(lobbyBiome).startsWith('sift_'))) {
        if (typeof selectLobbyBiome === 'function') selectLobbyBiome('sakura');
      }
    }
    if (notify) showToast(isAdminUnlocked ? '👑 Đã mở khóa quyền Quản trị!' : '🔒 Đã tắt quyền Quản trị.');
    return isAdminUnlocked;
  }
  window.setAdminUnlocked = setAdminUnlocked;

  document.getElementById('btnAdminUnlock')?.addEventListener('click', () => {
    const inp = document.getElementById('inpAdminCode');
    const code = (inp?.value || '').trim().toLowerCase();
    if (isAdminUnlocked && (!code || code === 'off')) { setAdminUnlocked(false, true); if (inp) inp.value = ''; return; }
    if (code === 'admintq' || code === '/admintq') {
      setAdminUnlocked(true, true);
      if (inp) inp.value = '';
    } else {
      showToast('🔒 Mã quản trị không đúng!');
    }
  });
  document.getElementById('inpAdminCode')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btnAdminUnlock')?.click(); }
  });

  function openAdminWorldMenu() {
    openMenu();
    const mm = document.getElementById('menuModal');
    if (mm) mm.classList.remove('pause-mode');
    document.querySelector('#gmNav .gm-tab[data-gtab="world"]')?.click();
  }
  function submitChatInput() {
    const inp = document.getElementById('chatInput');
    const txt = (inp.value || '').trim();
    inp.value = '';
    closeChatBox();
    if (!txt) return;
    const low = txt.toLowerCase();
    if (low === '/admintq') {
      const wasUnlocked = isAdminUnlocked;
      setAdminUnlocked(true, !wasUnlocked);
      openAdminWorldMenu();
      return;
    }
    if (low === '/admintq off') {
      setAdminUnlocked(false, true);
      return;
    }
    if (low === '/clear item' || low === '/clear items') {
      if (!isAdminUnlocked) {
        appendChatLine('HỆ THỐNG', '🔒 Chỉ quản trị viên mới có thể dùng lệnh này!', false);
        showToast('🔒 Yêu cầu quyền quản trị!');
        return;
      }
      let cleared = 0;
      if (typeof droppedItems !== 'undefined' && Array.isArray(droppedItems)) {
        cleared = droppedItems.length;
        for (let i = droppedItems.length - 1; i >= 0; i--) {
          const it = droppedItems[i];
          if (it?.mesh && typeof scene !== 'undefined') scene.remove(it.mesh);
          if (it?.shadow && typeof scene !== 'undefined') scene.remove(it.shadow);
        }
        droppedItems.length = 0;
      }
      appendChatLine('HỆ THỐNG', `🧹 Đã dọn sạch ${cleared} vật phẩm rơi trên bản đồ!`, false);
      showToast(`🧹 Đã dọn sạch ${cleared} vật phẩm rơi!`);
      return;
    }
    if (low === '/clear backpack') {
      if (!isAdminUnlocked) {
        appendChatLine('HỆ THỐNG', '🔒 Chỉ quản trị viên mới có thể dùng lệnh này!', false);
        showToast('🔒 Yêu cầu quyền quản trị!');
        return;
      }
      let clearedSlots = 0;
      if (typeof inventory !== 'undefined' && Array.isArray(inventory)) {
        for (let i = 0; i < inventory.length; i++) {
          const s = inventory[i];
          if (s && s.count > 0) clearedSlots++;
          inventory[i] = { id: 0, count: 0, dur: 0, maxDur: 0, ench: false, trim: null };
        }
      }
      if (typeof renderHotbar === 'function') renderHotbar();
      if (typeof updateHeldViewModel === 'function') updateHeldViewModel(0, null);
      const invM = document.getElementById('invModal');
      if (invM && !invM.classList.contains('hidden') && typeof renderInventoryModal === 'function') renderInventoryModal();
      appendChatLine('HỆ THỐNG', `🧹 Đã làm sạch toàn bộ balo (${clearedSlots} ô)!`, false);
      showToast(`🧹 Đã dọn sạch balo (${clearedSlots} ô)!`);
      return;
    }
    if (typeof window.runModCommand === 'function' && window.runModCommand(txt)) {
      return;
    }
    if (low === '/locate ancient_city' || low === '/locate deep_dark') {
      const nearest = getNearestAncientCity(player.x, player.z);
      const ac = nearest.city;
      const dist = Math.round(nearest.dist);
      const msg = `👁️ Thành Phố Cổ (Ancient City) gần nhất: X=${ac.x}, Y=${ac.y}, Z=${ac.z} (cách ${dist} block, sâu dưới dãy núi). Gõ "/tp ancient_city" để dịch chuyển tới đó!`;
      appendChatLine('HỆ THỐNG', msg, false);
      showToast(`👁️ Ancient City gần nhất: X=${ac.x}, Y=-52, Z=${ac.z} (${dist}m)`);
      return;
    }
    if (low === '/tp ancient_city' || low === '/tp deep_dark') {
      teleportToScenicBiome('ancient_city');
      return;
    }
    if (low === '/locate dragon_nest' || low === '/locate dragon') {
      const nr = getNearestDragonNest(player.x, player.z), ns = nr.nest, d = Math.round(nr.dist);
      const msg = `🌋 Tổ Rồng Nguyên Tố (${ns.el}) gần nhất: X=${ns.x}, Y=${ns.y}, Z=${ns.z} (cách ${d}m). Gõ "/tp dragon_nest" để tới đó!`;
      appendChatLine('HỆ THỐNG', msg, false);
      showToast(`🌋 Tổ Rồng gần nhất: X=${ns.x}, Y=${ns.y}, Z=${ns.z} (${d}m)`);
      return;
    }
    if (low === '/tp dragon_nest') {
      teleportToScenicBiome('dragon_nest');
      return;
    }
    // v188: /locate biome, /locate structure, /place & /tp verification commands for all 6 Sift biomes & Dragon World structures!
    if (low.startsWith('/locate biome ')) {
      const arg = low.slice('/locate biome '.length).trim();
      const mapBio = {
        sift: BIOMES.SIFT_CANYON, canyon: BIOMES.SIFT_CANYON, the_sift: BIOMES.SIFT_CANYON,
        meadow: BIOMES.SIFT_MEADOW, singers_meadow: BIOMES.SIFT_MEADOW,
        lullaby: BIOMES.SIFT_LULLABY, lullaby_hills: BIOMES.SIFT_LULLABY,
        burrows: BIOMES.SIFT_ICHOR_PONDS, ichor: BIOMES.SIFT_ICHOR_PONDS,
        huskland: BIOMES.SIFT_HUSKLAND, humbler_huskland: BIOMES.SIFT_HUSKLAND,
        sporefields: BIOMES.SIFT_SPOREFIELDS, fungal: BIOMES.SIFT_SPOREFIELDS
      };
      const targetB = mapBio[arg];
      if (!targetB) {
        appendChatLine('HỆ THỐNG', 'Biome hợp lệ: sift, meadow, lullaby, burrows, huskland, sporefields', false);
        return;
      }
      const loc = (typeof locateNearestSiftBiome === 'function') ? locateNearestSiftBiome(targetB, player.x, player.z) : null;
      if (loc) appendChatLine('HỆ THỐNG', `🧭 [${targetB.name}] gần nhất tại X=${loc.x}, Z=${loc.z} (${loc.dist}m). Gõ "/tp ${loc.x} 20 ${loc.z}" để tới!`, false);
      else appendChatLine('HỆ THỐNG', `Không tìm thấy biome ${arg} trong phạm vi 640m.`, false);
      return;
    }
    if (low.startsWith('/locate structure ')) {
      const kind = low.slice('/locate structure '.length).trim();
      const loc = (typeof locateNearestRealmStructure === 'function') ? locateNearestRealmStructure(kind || 'any', player.x, player.z) : null;
      if (loc) appendChatLine('HỆ THỐNG', `🏰 Công trình [${loc.kind}] gần nhất tại X=${loc.x}, Y=${loc.y}, Z=${loc.z} (${loc.dist}m). Gõ "/tp ${loc.x} ${loc.y} ${loc.z}"!`, false);
      else appendChatLine('HỆ THỐNG', 'Không tìm thấy công trình! Thử: castle, village, ruin, den, island, nest, vault, lab, altar, library.', false);
      return;
    }
    if (low.startsWith('/place ')) {
      if (!isAdminUnlocked && gameMode !== 'creative') {
        appendChatLine('HỆ THỐNG', '🔒 Cần /admintq hoặc Creative để dùng /place!', false);
        return;
      }
      const kind = low.slice('/place '.length).trim();
      const placed = (typeof placeStructureAtPlayer === 'function') ? placeStructureAtPlayer(kind) : null;
      if (placed) appendChatLine('HỆ THỐNG', `🏗️ Đã đặt công trình [${placed.kind}] tại X=${placed.x}, Y=${placed.y}, Z=${placed.z}!`, false);
      else appendChatLine('HỆ THỐNG', 'Tên hợp lệ: castle, village, ruin, den, nest, vault, lab, altar, library.', false);
      return;
    }
    if (low.startsWith('/tp ')) {
      const parts = low.slice(4).trim().split(/\s+/);
      if (parts.length === 3 && parts.every(p => !isNaN(Number(p)))) {
        const tx = Number(parts[0]), ty = Number(parts[1]), tz = Number(parts[2]);
        player.x = tx; player.y = ty; player.z = tz; player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = ty;
        const scx = Math.floor(tx) >> 4, scz = Math.floor(tz) >> 4;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!chunks.has(chunkKey(scx + dx, scz + dz))) generateChunk(scx + dx, scz + dz);
        flushUrgentChunks(32, true);
        appendChatLine('HỆ THỐNG', `✨ Đã dịch chuyển tới (${tx}, ${ty}, ${tz})!`, false);
        return;
      }
    }
    if ((low === '/summon warden' || low === '/warden') && (gameMode === 'creative' || isAdminUnlocked)) {
      if (typeof spawnWardenEmerging === 'function') {
        spawnWardenEmerging(Math.floor(player.x + 6), Math.floor(player.y), Math.floor(player.z));
      } else {
        spawnMobOfType('cave_warden', player.x + 6, player.y, player.z);
      }
      showToast('💀 Đã triệu hồi Warden!');
      return;
    }
    if (low === '/testportals' && (gameMode === 'creative' || isAdminUnlocked)) {
      const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
      if (typeof beginBlockBatch === 'function') beginBlockBatch();
      try {
      // Clear flat staging platform ahead
      for (let dz = -8; dz <= -2; dz++) for (let dx = -7; dx <= 7; dx++) {
        setBlockWorld(px + dx, py - 1, pz + dz, B.STONE_BRICK, true);
        for (let dy = 0; dy <= 6; dy++) setBlockWorld(px + dx, py + dy, pz + dz, B.AIR, true);
      }
      // 1) Unlit 4x5 Obsidian Nether Portal frame (left side, ready for Flint & Steel)
      const npx = px - 4, npz = pz - 5;
      for (let dx = 0; dx < 4; dx++) {
        setBlockWorld(npx + dx, py - 1, npz, B.OBSIDIAN, true);
        setBlockWorld(npx + dx, py + 3, npz, B.OBSIDIAN, true);
      }
      for (let dy = 0; dy < 3; dy++) {
        setBlockWorld(npx,     py + dy, npz, B.OBSIDIAN, true);
        setBlockWorld(npx + 3, py + dy, npz, B.OBSIDIAN, true);
      }
      // 2) Empty 12-frame Horizontal End Portal ring (right side, ready for 12 Eyes of Ender)
      const epx = px + 4, epz = pz - 5;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        setBlockWorld(epx + dx, py - 2, epz + dz, B.STONE_BRICK, true);
        setBlockWorld(epx + dx, py - 1, epz + dz, B.LAVA, true);
      }
      for (let i = -1; i <= 1; i++) {
        setBlockWorld(epx - 2, py, epz + i, B.END_PORTAL_FRAME, true);
        setBlockWorld(epx + 2, py, epz + i, B.END_PORTAL_FRAME, true);
        setBlockWorld(epx + i, py, epz - 2, B.END_PORTAL_FRAME, true);
        setBlockWorld(epx + i, py, epz + 2, B.END_PORTAL_FRAME, true);
      }
      } finally { if (typeof endBlockBatch === 'function') endBlockBatch(); }
      flushUrgentChunks(32, true);
      showToast('🧪 Đã gọi khung Cổng Địa Ngục (trái) & 12 khung Cổng Kết Thúc (phải)! Hãy dùng Bật Lửa & 12 Mắt Ender!');
      return;
    }
    appendChatLine(localPlayerName, txt, false);
    if (typeof sendCoopMsg === 'function' && activeRoomId) sendCoopMsg({ type: 'chat', name: localPlayerName, text: txt });
  }
  document.getElementById('btnChatOpen').addEventListener('click', () => { if (chatOpen) closeChatBox(); else if (isPlaying) openChatBox(); });
  document.getElementById('btnChatSend').addEventListener('click', submitChatInput);
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitChatInput(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeChatBox(); }
  });
  const _btnCoords = document.getElementById('btnToggleCoords');
  const syncCoordsBtn = () => { if (_btnCoords) { const t = (typeof tr === 'function') ? tr : (v) => v; _btnCoords.textContent = showCoordsHud ? t('📍 Tọa độ: BẬT', '📍 Coords: ON') : t('📍 Tọa độ: TẮT', '📍 Coords: OFF'); _btnCoords.classList.toggle('mc-btn-green', showCoordsHud); } };
  if (_btnCoords) _btnCoords.addEventListener('click', () => { showCoordsHud = !showCoordsHud; try { localStorage.setItem('luanti_show_coords', showCoordsHud ? '1' : '0'); } catch (_) {} syncCoordsBtn(); applyHudLayout(); });
  syncCoordsBtn();
  const _btnProf = document.getElementById('btnToggleProfanity');
  const syncProfBtn = () => { if (_btnProf) { const t = (typeof tr === 'function') ? tr : (v) => v; _btnProf.textContent = profanityFilterEnabled ? t('🛡️ Lọc chat: BẬT', '🛡️ Filter: ON') : t('🛡️ Lọc chat: TẮT', '🛡️ Filter: OFF'); _btnProf.classList.toggle('mc-btn-green', profanityFilterEnabled); } };
  if (_btnProf) _btnProf.addEventListener('click', () => { profanityFilterEnabled = !profanityFilterEnabled; try { localStorage.setItem('luanti_profanity_filter', profanityFilterEnabled ? '1' : '0'); } catch (_) {} syncProfBtn(); showToast(profanityFilterEnabled ? '🛡️ Đã BẬT bộ lọc ngôn từ thô tục (###)' : '🛡️ Đã TẮT bộ lọc ngôn từ'); });
  syncProfBtn();
  const _inpBW = document.getElementById('inpBlockedWords');
  if (_inpBW && customBadWords.length) _inpBW.value = customBadWords.join(', ');
  const _btnSaveBW = document.getElementById('btnSaveBlockedWords');
  if (_btnSaveBW) _btnSaveBW.addEventListener('click', () => {
    customBadWords = (_inpBW.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    try { localStorage.setItem('luanti_custom_badwords', JSON.stringify(customBadWords)); } catch (_) {}
    showToast(`🛡️ Đã lưu ${customBadWords.length} từ cấm tùy chỉnh!`);
  });
