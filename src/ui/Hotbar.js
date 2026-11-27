// NUCRAFT Module: src/ui/Hotbar.js — HUD layout editor, minimap, hotbar, inventory, chest, furnace & world map UI

  /* ============================================================================
   * 10. CUSTOMIZABLE HUD LAYOUT, MINIMAP, FULLSCREEN & 90° LANDSCAPE SCALING
   * ============================================================================ */
  const HUD_LAYOUT_KEY = 'luanti_craft_hud_layout_v10';
  const WIDGET_NAMES = { joy: 'Joystick Trái', sprint: 'Nút Chạy (»)', attack: 'Nút Đánh/Đào', jump: 'Nút Nhảy', sneak: 'Nút Ngồi', place: 'Nút Đặt (+)', coords: 'Khung Tọa Độ' };

  function getDefaultHudLayout() {
    return {
      joy: { xp: 12, yp: 74, scale: 1.0, alpha: 0.78 }, sprint: { xp: 83, yp: 45, scale: 1.0, alpha: 0.78 },
      attack: { xp: 83, yp: 63, scale: 1.0, alpha: 0.78 }, jump: { xp: 92, yp: 38, scale: 1.0, alpha: 0.78 },
      sneak: { xp: 92, yp: 56, scale: 1.0, alpha: 0.78 }, place: { xp: 92, yp: 74, scale: 1.0, alpha: 0.78 },
      coords: { xp: 1, yp: 1.5, scale: 1.0, alpha: 0.92 }
    };
  }
  let showCoordsHud = localStorage.getItem('luanti_show_coords') !== '0';
  let hudLayout = getDefaultHudLayout(), hudEditMode = false, editTargetId = 'all';
  function loadHudLayout() {
    try {
      const raw = localStorage.getItem(HUD_LAYOUT_KEY); if (!raw) return;
      const parsed = JSON.parse(raw), def = getDefaultHudLayout();
      for (const k of Object.keys(def)) if (parsed[k] && typeof parsed[k].xp === 'number') {
        hudLayout[k] = { xp: Math.max(4, Math.min(96, parsed[k].xp)), yp: Math.max(12, Math.min(92, parsed[k].yp)), scale: Math.max(0.6, Math.min(1.5, parsed[k].scale || 1.0)), alpha: Math.max(0.2, Math.min(1.0, parsed[k].alpha || 0.78)) };
      }
    } catch (_) {}
  }
  function saveHudLayout() { try { localStorage.setItem(HUD_LAYOUT_KEY, JSON.stringify(hudLayout)); } catch (_) {} }
  function applyHudLayout() {
    const compactMul = (stageW < 760 || stageH < 450) ? 0.84 : 1.0;
    const topRightEl = document.getElementById('topRightHud');
    const trRect = (!hudEditMode && topRightEl && topRightEl.offsetHeight > 0) ? topRightEl.getBoundingClientRect() : null;
    const posByWid = {};
    document.querySelectorAll('.hud-widget').forEach(el => {
      const wid = el.dataset.wid, cfg = hudLayout[wid]; if (!cfg) return;
      const w = el.offsetWidth || (wid === 'joy' ? 128 : 54), h = el.offsetHeight || (wid === 'joy' ? 128 : 54);
      const effScale = cfg.scale * compactMul;
      const halfW = (w * effScale) * 0.5, halfH = (h * effScale) * 0.5;
      const minCx = halfW + 6, maxCx = Math.max(minCx, stageW - halfW - 6);
      const maxCy = Math.max(halfH + 6, stageH - halfH - 6);
      let minCy = halfH + 6;
      const cx = Math.max(minCx, Math.min(maxCx, (cfg.xp / 100) * stageW));
      if (trRect && trRect.width > 0 && (cx + halfW > trRect.left - 8)) {
        minCy = Math.min(maxCy, Math.max(minCy, Math.ceil(trRect.bottom + 8 + halfH)));
      }
      const cy = Math.max(minCy, Math.min(maxCy, (cfg.yp / 100) * stageH));
      posByWid[wid] = { el, w, h, effScale, halfW, halfH, minCy, maxCy, cx, cy, cfg };
    });
    if (!hudEditMode) {
      for (const col of [['jump', 'sneak', 'place'], ['sprint', 'attack']]) {
        for (let i = 1; i < col.length; i++) {
          const prev = posByWid[col[i - 1]], cur = posByWid[col[i]];
          if (!prev || !cur || Math.abs(prev.cx - cur.cx) > (prev.halfW + cur.halfW)) continue;
          const minNextCy = prev.cy + prev.halfH + cur.halfH + 6;
          if (cur.cy < minNextCy) cur.cy = Math.min(cur.maxCy, minNextCy);
        }
        for (let i = col.length - 2; i >= 0; i--) {
          const cur = posByWid[col[i]], next = posByWid[col[i + 1]];
          if (!cur || !next || Math.abs(cur.cx - next.cx) > (cur.halfW + next.halfW)) continue;
          const maxCurCy = next.cy - next.halfH - cur.halfH - 6;
          if (cur.cy > maxCurCy) cur.cy = Math.max(cur.minCy, maxCurCy);
        }
      }
    }
    for (const wid of Object.keys(posByWid)) {
      const p = posByWid[wid], el = p.el;
      el.style.left = `${Math.round(p.cx - p.w / 2)}px`;
      el.style.top = `${Math.round(p.cy - p.h / 2)}px`;
      el.style.transform = `scale(${p.effScale.toFixed(2)})`;
      el.style.opacity = String(p.cfg.alpha);
      el.classList.toggle('edit-selected', hudEditMode && (editTargetId === 'all' || editTargetId === wid));
    }
    const pb = document.getElementById('posBox');
    if (pb && hudLayout.coords) {
      pb.classList.toggle('hidden', !showCoordsHud && !hudEditMode);
      pb.classList.toggle('editing-coords', hudEditMode);
      pb.classList.toggle('edit-selected', hudEditMode && (editTargetId === 'all' || editTargetId === 'coords'));
      pb.style.left = `${Math.max(4, Math.round((hudLayout.coords.xp / 100) * stageW))}px`;
      pb.style.top = `${Math.max(4, Math.round((hudLayout.coords.yp / 100) * stageH))}px`;
      pb.style.transform = `scale(${(hudLayout.coords.scale * compactMul).toFixed(2)})`;
      pb.style.opacity = String(hudLayout.coords.alpha);
    }
    updateMobileUiScale();
  }
  function scaleGuiPanelToViewport(panelEl, padX = 16, padY = 16) {
    if (!panelEl) return;
    const natW = panelEl.offsetWidth;
    const natH = panelEl.offsetHeight;
    if (!natW || !natH) return;
    const availW = Math.max(180, stageW - padX * 2);
    const availH = Math.max(160, stageH - padY * 2);
    const s = Math.min(1, availW / natW, availH / natH);
    panelEl.style.transform = s < 0.999 ? `scale(${s.toFixed(4)})` : 'none';
  }
  function computeSettingsFrameMetrics(availW, availH) {
    const MIN_W = 860, MAX_W = 1060;
    const MIN_H = 560, MAX_H = 700;
    const MIN_AR = 1.28, MAX_AR = 1.78;
    const safeW = Math.max(240, availW);
    const safeH = Math.max(200, availH);
    if (safeW >= MIN_W && safeH >= MIN_H) {
      return { w: Math.min(MAX_W, Math.floor(safeW)), h: Math.min(MAX_H, Math.floor(safeH)), scale: 1 };
    }
    let scale = Math.min(1, safeW / MIN_W, safeH / MIN_H);
    let w = Math.min(MAX_W, Math.max(MIN_W, Math.floor(safeW / scale)));
    let h = Math.min(MAX_H, Math.max(MIN_H, Math.floor(safeH / scale)));
    if (w / h > MAX_AR) w = Math.min(MAX_W, Math.round(h * MAX_AR));
    if (w / h < MIN_AR) h = Math.min(MAX_H, Math.round(w / MIN_AR));
    scale = Math.min(1, safeW / w, safeH / h);
    return { w, h, scale };
  }
  function scaleSettingsModalToViewport() {
    const mm = document.getElementById('menuModal');
    if (!mm || mm.classList.contains('hidden') || mm.classList.contains('pause-mode')) return;
    const shell = mm.querySelector('.mc-panel.game-menu-shell');
    if (!shell) return;
    const cs = getComputedStyle(mm);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const boxW = (mm.clientWidth > 0 ? mm.clientWidth : stageW) - padX - 8;
    const boxH = (mm.clientHeight > 0 ? mm.clientHeight : stageH) - padY - 8;
    const { w, h, scale } = computeSettingsFrameMetrics(boxW, boxH);
    shell.style.setProperty('--mcd-w', `${w}px`);
    shell.style.setProperty('--mcd-h', `${h}px`);
    shell.style.setProperty('--mcd-scale', scale < 0.999 ? scale.toFixed(4) : '1');
  }
  function updateMobileUiScale() {
    const isTouch = document.body.classList.contains('touch-ui');
    const isCompactViewport = isTouch || stageW <= 960 || stageH <= 540;
    document.body.classList.toggle('mobile-inv-ui', isCompactViewport);
    const bc = document.getElementById('bottomCenter');
    if (bc) {
      if (!isCompactViewport) {
        bc.style.setProperty('--hb-scale', '1');
        bc.style.setProperty('--hb-shift-x', '0px');
      } else {
        // Tổng chiều rộng gồm 364px hotbar + 47px nút "..." khi bật Mobile Controls
        const totalHbW = isTouch ? 414 : 368;
        const shiftX = isTouch ? -23.5 : 0;
        const isLandscape = stageW >= stageH;
        let hbScale;
        if (isLandscape) {
          // Chừa không gian hai bên cho Joystick trái và cụm nút nhảy/đánh phải
          const widthCap = isTouch ? (stageW * 0.52) / totalHbW : (stageW - 24) / totalHbW;
          const heightCap = stageH / 540;
          hbScale = Math.min(0.84, widthCap, heightCap);
        } else {
          hbScale = Math.min(0.86, (stageW - 16) / totalHbW);
        }
        // Luôn bảo đảm không bao giờ tràn mép ngang
        hbScale = Math.min(hbScale, (stageW - 12) / totalHbW);
        hbScale = Math.max(0.48, Math.min(1, hbScale));
        bc.style.setProperty('--hb-scale', hbScale.toFixed(4));
        bc.style.setProperty('--hb-shift-x', `${shiftX}px`);
      }
    }
    const padX = stageW < 960 ? 6 : 14;
    const padY = stageH < 540 ? 6 : 14;
    const invModalEl = document.getElementById('invModal');
    if (invModalEl && !invModalEl.classList.contains('hidden')) {
      const mainP = document.getElementById('mainInvPanel');
      const rcGrid = document.getElementById('recipeGrid');
      if (mainP && rcGrid) {
        const overhead = isCompactViewport ? 54 : 77;
        const targetGridH = Math.max(190, mainP.offsetHeight - overhead);
        rcGrid.style.maxHeight = `${targetGridH}px`;
        rcGrid.style.minHeight = `${targetGridH}px`;
      }
      scaleGuiPanelToViewport(document.getElementById('invDualWrap'), padX, padY);
    }
    const furnModalEl = document.getElementById('furnaceModal');
    if (furnModalEl && !furnModalEl.classList.contains('hidden')) {
      scaleGuiPanelToViewport(furnModalEl.querySelector('.mc-gui-panel'), padX, padY);
    }
    const chestModalEl = document.getElementById('chestModal');
    if (chestModalEl && !chestModalEl.classList.contains('hidden')) {
      scaleGuiPanelToViewport(chestModalEl.querySelector('.mc-gui-panel'), padX, padY);
    }
    const tradeModalEl = document.getElementById('tradeModal');
    if (tradeModalEl && !tradeModalEl.classList.contains('hidden')) {
      scaleGuiPanelToViewport(tradeModalEl.querySelector('.mc-gui-panel'), padX, padY);
    }
    const smithModalEl = document.getElementById('smithingModal');
    if (smithModalEl && !smithModalEl.classList.contains('hidden')) {
      scaleGuiPanelToViewport(smithModalEl.querySelector('.mc-gui-panel'), padX, padY);
    }
    const drgModalEl = document.getElementById('dragonModal');
    if (drgModalEl && !drgModalEl.classList.contains('hidden')) {
      scaleGuiPanelToViewport(document.getElementById('dragonGuiPanel'), padX, padY);
    }
    scaleSettingsModalToViewport();
  }
  function syncEditorSliders() {
    const ref = editTargetId === 'all' ? hudLayout.attack : hudLayout[editTargetId];
    const sz = Math.round(ref.scale * 100), al = Math.round(ref.alpha * 100);
    document.getElementById('sliderSize').value = sz; document.getElementById('sizeVal').textContent = `${sz}%`;
    document.getElementById('sliderAlpha').value = al; document.getElementById('alphaVal').textContent = `${al}%`;
    document.getElementById('editorTargetLabel').textContent = `🎛️ KÉO NÚT ĐỂ ĐỔI VỊ TRÍ • ${editTargetId === 'all' ? 'Tất cả nút' : WIDGET_NAMES[editTargetId]}`;
  }
  function enterHudEditMode() {
    ensureAudio(); isPlaying = false; mining.active = false; clearMoveKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.classList.remove('in-menu');
    document.getElementById('menuModal').classList.add('hidden'); document.getElementById('invModal').classList.add('hidden'); document.getElementById('dragonModal')?.classList.add('hidden');
    showMobileControls = true; syncMobileControls();
    hudEditMode = true; editTargetId = 'all';
    document.getElementById('mobileControls').classList.add('editing');
    document.getElementById('hudEditorBar').classList.remove('hidden');
    applyHudLayout(); syncEditorSliders();
  }
  function exitHudEditMode(save = true) {
    if (save) { saveHudLayout(); showToast('Đã lưu bố cục, kích thước & độ mờ nút!'); }
    hudEditMode = false;
    document.getElementById('mobileControls').classList.remove('editing');
    document.getElementById('hudEditorBar').classList.add('hidden');
    applyHudLayout(); isPlaying = true;
  }

  document.getElementById('btnEditHud').addEventListener('click', () => { if (hudEditMode) exitHudEditMode(true); else enterHudEditMode(); });
  document.getElementById('btnMenuEditHud').addEventListener('click', enterHudEditMode);
  document.getElementById('btnSaveHud').addEventListener('click', () => exitHudEditMode(true));
  document.getElementById('btnSelectAllHud').addEventListener('click', () => { editTargetId = 'all'; syncEditorSliders(); applyHudLayout(); });
  document.getElementById('btnResetHud').addEventListener('click', () => { hudLayout = getDefaultHudLayout(); applyHudLayout(); syncEditorSliders(); showToast('Đã đặt lại bố cục mặc định'); });
  document.getElementById('sliderSize').addEventListener('input', (e) => { const v = parseInt(e.target.value, 10) / 100; document.getElementById('sizeVal').textContent = `${e.target.value}%`; if (editTargetId === 'all') for (const k of Object.keys(hudLayout)) hudLayout[k].scale = v; else hudLayout[editTargetId].scale = v; applyHudLayout(); });
  document.getElementById('sliderAlpha').addEventListener('input', (e) => { const v = parseInt(e.target.value, 10) / 100; document.getElementById('alphaVal').textContent = `${e.target.value}%`; if (editTargetId === 'all') for (const k of Object.keys(hudLayout)) hudLayout[k].alpha = v; else hudLayout[editTargetId].alpha = v; applyHudLayout(); });

  let dragWid = null, dragStartX = 0, dragStartY = 0, dragInitXp = 0, dragInitYp = 0;
  document.querySelectorAll('.hud-widget, #posBox').forEach(el => {
    const startDrag = (cx, cy) => { if (!hudEditMode) return false; dragWid = el.dataset.wid; if (!hudLayout[dragWid]) return false; editTargetId = dragWid; dragStartX = cx; dragStartY = cy; dragInitXp = hudLayout[dragWid].xp; dragInitYp = hudLayout[dragWid].yp; syncEditorSliders(); applyHudLayout(); return true; };
    el.addEventListener('mousedown', (e) => { if (startDrag(e.clientX, e.clientY)) e.preventDefault(); });
    el.addEventListener('touchstart', (e) => { if (hudEditMode && e.changedTouches.length > 0) { e.preventDefault(); startDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY); } }, { passive: false });
  });
  function moveHudDrag(cx, cy) {
    if (!hudEditMode || !dragWid) return;
    const rawDx = cx - dragStartX, rawDy = cy - dragStartY;
    hudLayout[dragWid].xp = Math.max(4, Math.min(96, dragInitXp + ((isRotated90 ? rawDy : rawDx) / stageW) * 100));
    hudLayout[dragWid].yp = Math.max(12, Math.min(92, dragInitYp + ((isRotated90 ? -rawDx : rawDy) / stageH) * 100));
    applyHudLayout();
  }
  window.addEventListener('mousemove', (e) => moveHudDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => { dragWid = null; });
  window.addEventListener('touchmove', (e) => { if (hudEditMode && dragWid && e.touches.length > 0) { e.preventDefault(); moveHudDrag(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  window.addEventListener('touchend', () => { dragWid = null; });

  let forceLandscape = false, isRotated90 = false, stageW = window.innerWidth, stageH = window.innerHeight;
  function getTrueViewportDimensions() {
    let vw = window.innerWidth || document.documentElement.clientWidth || 360, vh = window.innerHeight || document.documentElement.clientHeight || 640;
    if (document.documentElement.clientWidth > 0) vw = Math.min(vw, document.documentElement.clientWidth);
    if (document.documentElement.clientHeight > 0) vh = Math.min(vh, document.documentElement.clientHeight);
    if (window.visualViewport && (!window.visualViewport.scale || Math.abs(window.visualViewport.scale - 1) < 0.05)) { vw = Math.min(vw, Math.round(window.visualViewport.width)); vh = Math.min(vh, Math.round(window.visualViewport.height)); }
    return { vw: Math.max(240, vw), vh: Math.max(240, vh) };
  }
  function resizeViewport() {
    const { vw, vh } = getTrueViewportDimensions();
    if (forceLandscape && vw < vh) {
      isRotated90 = true; gameStage.classList.add('rotated-landscape');
      gameStage.style.setProperty('--rot-w', `${vh}px`); gameStage.style.setProperty('--rot-h', `${vw}px`); gameStage.style.setProperty('--rot-left', `${vw}px`);
      stageW = vh; stageH = vw;
    } else {
      isRotated90 = false; gameStage.classList.remove('rotated-landscape');
      gameStage.style.removeProperty('--rot-w'); gameStage.style.removeProperty('--rot-h'); gameStage.style.removeProperty('--rot-left');
      stageW = vw; stageH = vh;
    }
    renderer.setSize(stageW, stageH, false);
    const direct = _useDirectRender();
    renderer.toneMapping = direct ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    if (!direct) {
      const needWide = (shaderQuality === 'ultra' || shaderQuality === 'extreme');
      const fgMode = (typeof sodiumOpts !== 'undefined' && (sodiumOpts.frameGen | 0) > 1) ? (sodiumOpts.frameGen | 0) : 1;
      const needFg = (fgMode > 1);
      ensurePostRTs(needWide, needFg);
      const pr = renderer.getPixelRatio();
      const rtW = Math.max(128, Math.round(stageW * pr)), rtH = Math.max(128, Math.round(stageH * pr));
      const fgScale = (fgMode >= 4) ? 0.60 : (fgMode >= 2 ? 0.72 : 1.0);
      const scW = Math.max(128, Math.round(rtW * fgScale)), scH = Math.max(128, Math.round(rtH * fgScale));
      sceneRT.setSize(scW, scH);
      if (needFg && typeof fgRtA !== 'undefined' && fgRtA && fgRtB) {
        fgRtA.setSize(scW, scH); fgRtB.setSize(scW, scH);
      }
      if (typeof fgBlendMat !== 'undefined' && fgBlendMat.uniforms && fgBlendMat.uniforms.uTexel) {
        fgBlendMat.uniforms.uTexel.value.set(1 / scW, 1 / scH);
      }
      envUniforms.uTexelSize.value.set(1 / scW, 1 / scH);
      if (shaderQuality !== 'low' || (typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing)) {
        const bDiv = (_isMobilePerf && !needWide) ? 6 : 4;
        const bW = Math.max(48, Math.round(scW / bDiv)), bH = Math.max(48, Math.round(scH / bDiv));
        bloomRT1.setSize(bW, bH); bloomRT2.setSize(bW, bH);
        godRayRT1.setSize(bW, bH); godRayRT2.setSize(bW, bH);
        if (needWide && bloomWide1) {
          const wW = Math.max(40, scW >> 3), wH = Math.max(40, scH >> 3);
          bloomWide1.setSize(wW, wH); bloomWide2.setSize(wW, wH);
        }
      }
    }
    camera.aspect = stageW / stageH; camera.updateProjectionMatrix();
    reflCam.aspect = stageW / stageH; reflCam.updateProjectionMatrix();
    _postFxDirty = true;
    applyHudLayout();
  }
  window.addEventListener('resize', resizeViewport);
  const _onOrientationViewport = () => { resizeViewport(); setTimeout(resizeViewport, 160); setTimeout(resizeViewport, 360); };
  window.addEventListener('orientationchange', _onOrientationViewport);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', _onOrientationViewport);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeViewport);

  function isAppFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function syncFullscreenButtons() {
    const fs = isAppFullscreen();
    const enterSvg = '<path d="M2 2h4v2H4v2H2V2zm8 0h4v4h-2V4h-2V2zM2 10h2v2h2v2H2v-4zm10 2v-2h2v4h-4v-2h2z"/>';
    const exitSvg = '<path d="M4 2h2v4H2V4h2V2zm6 0h2v2h2v2h-4V2zM2 10h4v4H4v-2H2v-2zm8 0h4v2h-2v2h-2v-4z"/>';
    const fsBtnIds = ['btnFullscreen', 'btnLobbyFullscreen', 'btnDrFullscreen'];
    fsBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.toggle('is-active', fs);
      const svg = btn.querySelector('svg');
      if (svg) svg.innerHTML = fs ? exitSvg : enterSvg;
    });
    const lblFs = document.getElementById('lblLobbyFs');
    if (lblFs) lblFs.textContent = fs ? 'Thoát Full' : 'Full';
    const rotBtnIds = ['btnRotate', 'btnLobbyRotate'];
    rotBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('is-active', !!forceLandscape);
    });
  }
  async function toggleAppFullscreen() {
    ensureAudio();
    try {
      if (!isAppFullscreen()) {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (_) {}
    syncFullscreenButtons();
    setTimeout(resizeViewport, 120);
  }
  async function toggleAppLandscape() {
    ensureAudio();
    forceLandscape = !forceLandscape;
    if (forceLandscape) {
      try {
        const el = document.documentElement;
        if (!isAppFullscreen()) {
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        }
      } catch (_) {}
      try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) {}
    } else {
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) {}
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch (_) {}
    }
    syncFullscreenButtons();
    setTimeout(resizeViewport, 120);
  }
  document.getElementById('btnFullscreen').addEventListener('click', toggleAppFullscreen);
  document.getElementById('btnLobbyFullscreen')?.addEventListener('click', toggleAppFullscreen);
  document.getElementById('btnDrFullscreen').addEventListener('click', toggleAppFullscreen);
  document.getElementById('btnRotate').addEventListener('click', toggleAppLandscape);
  document.getElementById('btnLobbyRotate')?.addEventListener('click', toggleAppLandscape);
  document.addEventListener('fullscreenchange', () => { syncFullscreenButtons(); setTimeout(resizeViewport, 100); });
  document.addEventListener('webkitfullscreenchange', () => { syncFullscreenButtons(); setTimeout(resizeViewport, 100); });
  syncFullscreenButtons();

  function toggleThirdPerson() {
    thirdPerson = (thirdPerson + 1) % 3;
    playerAvatar.g.visible = (thirdPerson > 0);
    heldPivot.visible = (thirdPerson === 0 && !hudHidden);
    if (typeof offhandPivot !== 'undefined') offhandPivot.visible = (thirdPerson === 0 && !hudHidden && !!activeOffhandObj);
    if (thirdPerson > 0) applyArmorToPlayerRig(playerAvatar, player.equip, player.equipMeta);
    const lbl = thirdPerson === 1 ? '📷 Góc nhìn Thứ 3 — Sau Lưng (F5)' : (thirdPerson === 2 ? '🪞 Góc nhìn Thứ 3 — Mặt Trước Xem Giáp (F5)' : '👁️ Góc nhìn Thứ 1 (F5)');
    showToast(lbl);
  }
  function toggleHideHud(forceState) {
    hudHidden = (typeof forceState === 'boolean') ? forceState : !hudHidden;
    document.body.classList.toggle('hud-hidden', hudHidden);
    if (isPlaying) {
      heldPivot.visible = (thirdPerson === 0 && !hudHidden);
      if (typeof offhandPivot !== 'undefined') offhandPivot.visible = (thirdPerson === 0 && !hudHidden && !!activeOffhandObj);
    }
    if (hudHidden && typeof highlightMesh !== 'undefined') highlightMesh.visible = false;
    return hudHidden;
  }
  function toggleMinimap() {
    openWorldMapModal();
  }
  document.getElementById('btnCamMode').addEventListener('click', toggleThirdPerson);
  document.getElementById('btnToggleCamMenu').addEventListener('click', toggleThirdPerson);
  document.getElementById('btnMinimap').addEventListener('click', toggleMinimap);
  document.getElementById('minimapWrap').addEventListener('click', () => { if (isPlaying) openWorldMapModal(); });

  const minimapCanvas = document.getElementById('minimapCanvas');
  const minimapCtx = minimapCanvas.getContext('2d');
  const minimapImg = minimapCtx.createImageData(minimapCanvas.width, minimapCanvas.height);
  const minimapU32 = new Uint32Array(minimapImg.data.buffer);
  const MAP_COLOR_U32 = new Uint32Array(2048);
  const DEFAULT_MAP_U32 = 0xff271811;
  for (let i = 0; i < 2048; i++) {
    const hex = BLOCK_DEF[i]?.mapColor;
    if (hex && hex[0] === '#') {
      const n = parseInt(hex.slice(1), 16);
      MAP_COLOR_U32[i] = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    } else MAP_COLOR_U32[i] = 0xff80726b;
  }

  // Explored Chunks Fog-of-War Cache (Stores top-down 16x16 voxel map colors for every chunk you visit!)
  const exploredChunks = new Map();
  let _mmTerrainVer = 0;
  function markChunkExplored(ch) {
    if (!ch || !ch.data) return;
    const key = chunkKey(ch.cx, ch.cz);
    if (ch.mapDirty === false && exploredChunks.has(key)) return;
    let tile = exploredChunks.get(key);
    if (!tile) {
      // FerriteCore: Bound exploredChunks LRU cache so long exploration sessions never bloat RAM
      if (sodiumOpts.ferriteRam && exploredChunks.size >= 800) {
        const oldestKey = exploredChunks.keys().next().value;
        if (oldestKey !== undefined) {
          tile = exploredChunks.get(oldestKey);
          exploredChunks.delete(oldestKey);
        }
      }
      if (!tile) tile = new Uint32Array(256);
      exploredChunks.set(key, tile);
    }
    if (!ch.topMap) ch.topMap = new Int16Array(256).fill(-1);
    const data = ch.data, topMap = ch.topMap, topCap = Math.min(WORLD_H - 1, ch.maxLy);
    for (let lz = 0; lz < 16; lz++) {
      const zOff = lz << 4;
      for (let lx = 0; lx < 16; lx++) {
        const colBase = zOff | lx;
        let topLy = topMap[colBase];
        if (topLy < 0) {
          topLy = 0;
          for (let ly = topCap; ly >= 0; ly--) {
            const bid = data[(ly << 8) | colBase];
            if (bid !== B.AIR && !(BLOCK_DEF[bid] && BLOCK_DEF[bid].cross)) { topLy = ly; break; }
          }
          topMap[colBase] = topLy;
        }
        const id = data[(topLy << 8) | colBase];
        tile[colBase] = (id !== B.AIR && !(BLOCK_DEF[id] && BLOCK_DEF[id].cross)) ? MAP_COLOR_U32[id] : DEFAULT_MAP_U32;
      }
    }
    ch.mapDirty = false;
    _mmTerrainVer++;
  }

  let worldMapZoom = 2.0, worldMapOffX = 0, worldMapOffZ = 0, worldMapDrag = false, wmLastX = 0, wmLastY = 0;
  let _wmCtx = null, _wmImg = null, _wmU32 = null, _wmRafPending = false;
  function renderWorldMapModal() {
    const cv = document.getElementById('worldMapCanvas');
    if (!cv) return;
    const W = cv.width, H = cv.height;
    if (!_wmCtx) _wmCtx = cv.getContext('2d');
    const ctx = _wmCtx;
    if (!_wmImg || _wmImg.width !== W || _wmImg.height !== H) {
      _wmImg = ctx.createImageData(W, H);
      _wmU32 = new Uint32Array(_wmImg.data.buffer);
    }
    const img = _wmImg, u32 = _wmU32;
    const centerX = Math.floor(player.x) + worldMapOffX, centerZ = Math.floor(player.z) + worldMapOffZ;
    const invZ = 1 / worldMapZoom;
    let lastCx = 999999, lastCz = 999999, curTile = null, idx = 0;
    for (let py = 0; py < H; py++) {
      const wz = Math.floor(centerZ + (py - H * 0.5) * invZ);
      const cz = wz >> 4, lz = wz & 15, zOff = lz << 4;
      for (let px = 0; px < W; px++) {
        const wx = Math.floor(centerX + (px - W * 0.5) * invZ);
        const cx = wx >> 4;
        if (cx !== lastCx || cz !== lastCz) { lastCx = cx; lastCz = cz; curTile = exploredChunks.get(chunkKey(cx, cz)) || null; }
        if (curTile) {
          u32[idx++] = curTile[zOff | (wx & 15)];
        } else {
          // Textured Dark Fog-of-War for Unexplored Chunks!
          const fogNoise = (((wx * 37 ^ wz * 17) & 7) === 0) ? 0xff1c212b : 0xff11151d;
          u32[idx++] = fogNoise;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // Draw mobs inside explored area
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!exploredChunks.has(chunkKey(Math.floor(m.x) >> 4, Math.floor(m.z) >> 4))) continue;
      const sx = Math.round((m.x - centerX) * worldMapZoom + W * 0.5);
      const sy = Math.round((m.z - centerZ) * worldMapZoom + H * 0.5);
      if (sx >= 2 && sx < W - 2 && sy >= 2 && sy < H - 2) {
        ctx.fillStyle = m.isBoss ? '#d946ef' : (m.hostile ? '#ef4444' : '#4ade80');
        ctx.fillRect(sx - 2, sy - 2, m.isBoss ? 6 : 4, m.isBoss ? 6 : 4);
      }
    }
    // Draw player directional arrow
    const plX = (player.x - centerX) * worldMapZoom + W * 0.5;
    const plY = (player.z - centerZ) * worldMapZoom + H * 0.5;
    ctx.save(); ctx.translate(plX, plY); ctx.rotate(-player.yaw);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
    const st = document.getElementById('worldMapStats');
    if (st) st.textContent = `X: ${Math.floor(player.x)}, Z: ${Math.floor(player.z)}  •  ${worldMapZoom.toFixed(1)}×`;
  }
  function openWorldMapModal() {
    isPlaying = false; mining.active = false; clearMoveKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    worldMapOffX = 0; worldMapOffZ = 0;
    for (const ch of chunks.values()) markChunkExplored(ch);
    document.getElementById('worldMapModal').classList.remove('hidden');
    renderWorldMapModal();
  }
  function closeWorldMapModal() {
    document.getElementById('worldMapModal').classList.add('hidden');
    isPlaying = true; safeLockPointer();
  }
  document.getElementById('btnCloseWorldMap').addEventListener('click', closeWorldMapModal);
  document.getElementById('btnMapZoomIn').addEventListener('click', () => { worldMapZoom = Math.min(5.0, worldMapZoom * 1.35); renderWorldMapModal(); });
  document.getElementById('btnMapZoomOut').addEventListener('click', () => { worldMapZoom = Math.max(0.6, worldMapZoom / 1.35); renderWorldMapModal(); });
  document.getElementById('btnMapCenter').addEventListener('click', () => { worldMapOffX = 0; worldMapOffZ = 0; renderWorldMapModal(); });
  const _wmCv = document.getElementById('worldMapCanvas');
  if (_wmCv) {
    _wmCv.addEventListener('pointerdown', (e) => { worldMapDrag = true; wmLastX = e.clientX; wmLastY = e.clientY; });
    window.addEventListener('pointerup', () => { worldMapDrag = false; });
    window.addEventListener('pointermove', (e) => {
      if (!worldMapDrag) return;
      worldMapOffX -= (e.clientX - wmLastX) / worldMapZoom;
      worldMapOffZ -= (e.clientY - wmLastY) / worldMapZoom;
      wmLastX = e.clientX; wmLastY = e.clientY;
      if (!_wmRafPending) {
        _wmRafPending = true;
        requestAnimationFrame(() => { _wmRafPending = false; renderWorldMapModal(); });
      }
    });
  }


  let _mmLastKey = '', _mmLastX = -99999, _mmLastZ = -99999, _mmLastYaw = -99999;
  const _mmPadW = minimapCanvas.width + 2, _mmPadH = minimapCanvas.height + 2;
  const _mmBaseCv = document.createElement('canvas'); _mmBaseCv.width = _mmPadW; _mmBaseCv.height = _mmPadH;
  const _mmBaseCtx = _mmBaseCv.getContext('2d');
  const _mmBaseImg = _mmBaseCtx.createImageData(_mmPadW, _mmPadH);
  const _mmBaseU32 = new Uint32Array(_mmBaseImg.data.buffer);
  function updateMinimap() {
    if (!minimapVisible) return;
    const W = minimapCanvas.width, H = minimapCanvas.height, half = W >> 1;
    const px = Math.floor(player.x), pz = Math.floor(player.z);
    const mmKey = `${px},${pz},${currentDimension},${depthOffset},${_mmTerrainVer},${chunks.size}`;
    const keyChanged = (mmKey !== _mmLastKey);
    if (keyChanged) {
      _mmLastKey = mmKey;
      let lastCx = 999999, lastCz = 999999, curCh = null, curTile = null, pIdx = 0;
      for (let dz = -half - 1; dz <= half; dz++) {
        const wz = pz + dz, cz = wz >> 4, lzShift = (wz & 15) << 4;
        for (let dx = -half - 1; dx <= half; dx++) {
          const wx = px + dx, cx = wx >> 4;
          if (cx !== lastCx || cz !== lastCz) {
            lastCx = cx; lastCz = cz;
            const ck = chunkKey(cx, cz);
            curCh = chunks.get(ck) || null;
            curTile = (!curCh || curCh.mapDirty === false) ? (exploredChunks.get(ck) || null) : null;
            if (curCh && !curCh.topMap) curCh.topMap = new Int16Array(256).fill(-1);
          }
          const colBase = lzShift | (wx & 15);
          let u32 = DEFAULT_MAP_U32;
          if (curTile) {
            u32 = curTile[colBase];
          } else if (curCh) {
            const data = curCh.data;
            let topLy = curCh.topMap[colBase];
            if (topLy < 0) {
              topLy = 0;
              for (let ly = Math.min(WORLD_H - 1, curCh.maxLy); ly >= 0; ly--) {
                const bid = data[(ly << 8) | colBase];
                if (bid !== B.AIR && !(BLOCK_DEF[bid] && BLOCK_DEF[bid].cross)) { topLy = ly; break; }
              }
              curCh.topMap[colBase] = topLy;
            }
            const id = data[(topLy << 8) | colBase];
            if (id !== B.AIR && !(BLOCK_DEF[id] && BLOCK_DEF[id].cross)) u32 = MAP_COLOR_U32[id];
          }
          _mmBaseU32[pIdx++] = u32;
        }
      }
      _mmBaseCtx.putImageData(_mmBaseImg, 0, 0);
    }
    const moved = keyChanged || Math.abs(player.x - _mmLastX) > 0.012 || Math.abs(player.z - _mmLastZ) > 0.012 || Math.abs(player.yaw - _mmLastYaw) > 0.005 || (mobs.length > 0 && (frameCounter & 3) === 0);
    if (!moved) return;
    _mmLastX = player.x; _mmLastZ = player.z; _mmLastYaw = player.yaw;

    const fx = (player.x - px) - 0.5, fz = (player.z - pz) - 0.5;
    minimapCtx.imageSmoothingEnabled = false;
    minimapCtx.drawImage(_mmBaseCv, -1 - fx, -1 - fz);
    // Plot nearby mobs smoothly in floating-point relative coordinates
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i], mx = (m.x - player.x) + half, mz = (m.z - player.z) + half;
      if (mx >= 1 && mx < W - 1 && mz >= 1 && mz < H - 1) {
        minimapCtx.fillStyle = m.isBoss ? '#f97316' : (m.hostile ? '#ef4444' : '#4ade80');
        const sz = m.isBoss ? 4 : 2.2;
        minimapCtx.fillRect(mx - sz * 0.5, mz - sz * 0.5, sz, sz);
      }
    }
    // Player directional arrow at center (60 FPS smooth rotation!)
    minimapCtx.save();
    minimapCtx.translate(half, half);
    minimapCtx.rotate(-player.yaw);
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.beginPath(); minimapCtx.moveTo(0, -5); minimapCtx.lineTo(3.5, 4); minimapCtx.lineTo(0, 2); minimapCtx.lineTo(-3.5, 4); minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.restore();
  }

  /* ============================================================================
   * 11. MULTI-TOUCH & KEYBOARD INPUTS
   * ============================================================================ */
  const keys = {}, touchState = { joyX: 0, joyY: 0, jump: false, sprint: false, sneak: false };
  let isPlaying = false, isWorldLoading = false, _worldLoadYaw = 0, dragLook = false, lastMouseX = 0, lastMouseY = 0;
  function clearMoveKeys() {
    for (const k in keys) keys[k] = false;
    touchState.joyX = 0; touchState.joyY = 0;
    touchState.jump = false; touchState.sprint = false; touchState.sneak = false;
    if (typeof player !== 'undefined' && player) player.doubleTapSprint = false;
  }

  window.addEventListener('keydown', (e) => {
    const lobbyOpen = !document.getElementById('lobbyScreen').classList.contains('hidden');
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (e.code === 'Escape' && !document.getElementById('invModal').classList.contains('hidden')) closeInventoryModal();
      return;
    }
    if (lobbyOpen) {
      if (e.code === 'Escape') {
        const lEl = document.getElementById('lobbyScreen');
        if (lEl && lEl.classList.contains('dr-open')) document.getElementById('btnDrBack')?.click();
        else if (lEl && lEl.classList.contains('sub-open')) closeLobbySub();
      }
      return;
    }
    if (e.code === 'Escape') {
      if (chatOpen) closeChatBox();
      else if (hudEditMode) exitHudEditMode(true);
      else if (!document.getElementById('menuModal').classList.contains('hidden')) startPlaying();
      else if (!document.getElementById('dragonModal')?.classList.contains('hidden')) closeDragonModal();
      else if (!document.getElementById('furnaceModal').classList.contains('hidden')) closeFurnaceModal();
      else if (!document.getElementById('chestModal').classList.contains('hidden')) closeChestModal();
      else if (!document.getElementById('worldMapModal').classList.contains('hidden')) closeWorldMapModal();
      else if (!document.getElementById('tradeModal').classList.contains('hidden')) closeTradeModal();
      else if (!document.getElementById('smithingModal').classList.contains('hidden')) closeSmithingModal();
      else if (!document.getElementById('invModal').classList.contains('hidden')) closeInventoryModal();
      else if (isPlaying) openMenu();
      return;
    }
    if ((e.code === 'KeyT' || e.code === 'Enter') && isPlaying && !player.dead && !chatOpen) { e.preventDefault(); openChatBox(); return; }
    if (e.code === 'Slash' && isPlaying && !player.dead && !chatOpen) { e.preventDefault(); openChatBox('/'); return; }
    if (e.code === 'KeyE') {
      if (!document.getElementById('dragonModal')?.classList.contains('hidden')) { closeDragonModal(); return; }
      if (!document.getElementById('furnaceModal').classList.contains('hidden')) { closeFurnaceModal(); return; }
      if (!document.getElementById('chestModal').classList.contains('hidden')) { closeChestModal(); return; }
      if (!document.getElementById('smithingModal').classList.contains('hidden')) { closeSmithingModal(); return; }
      if (!document.getElementById('invModal').classList.contains('hidden')) closeInventoryModal();
      else if (isPlaying && !player.dead) openInventoryModal('backpack');
      return;
    }
    if (e.code === 'KeyQ' && !player.dead) {
      e.preventDefault();
      const invOpen = !document.getElementById('invModal').classList.contains('hidden');
      if (invOpen) {
        const targetSlot = hoveredInvSlot >= 0 ? hoveredInvSlot : (swapIdx >= 0 ? swapIdx : -1);
        if (targetSlot >= 0) {
          throwInventorySlot(targetSlot, e.ctrlKey || e.metaKey);
          if (swapIdx === targetSlot && inventory[targetSlot].count <= 0) swapIdx = -1;
        }
      } else if (isPlaying) {
        throwInventorySlot(player.selectedSlot, e.ctrlKey || e.metaKey);
      }
      return;
    }
    if (e.code === 'F1') {
      e.preventDefault();
      if (!e.repeat && !isWorldLoading && !chatOpen) toggleHideHud();
      return;
    }
    if (e.code === 'F5') { e.preventDefault(); toggleThirdPerson(); return; }
    if (e.code === 'KeyM') {
      if (!document.getElementById('worldMapModal').classList.contains('hidden')) closeWorldMapModal();
      else if (isPlaying) openWorldMapModal();
      return;
    }
    if (e.code === 'KeyX' && !e.repeat && isPlaying && !player.dead) {
      swapOffhandItem();
      return;
    }
    if (e.code === 'KeyF' && isPlaying && !player.dead) {
      if (player.ridingDragon) { dismountDragon(); return; }
      const cDef = player.equip && player.equip.chest ? BLOCK_DEF[player.equip.chest] : null;
      if (cDef && cDef.isElytra && !player.onGround && !player.inWater && !player.flying) {
        player.gliding = !player.gliding;
        if (player.gliding) {
          const sp = Math.max(10.0, Math.hypot(player.smoothMoveX || 0, player.smoothMoveZ || 0));
          player.glideVel = { x: -Math.sin(player.yaw) * sp, y: Math.max(player.vy, 1.8), z: -Math.cos(player.yaw) * sp };
          player.vy = player.glideVel.y; player.fallStartY = player.y;
          showToast('🪽 Đã mở Cánh Cứng Elytra! (Nhìn lên bay cao • Nhìn xuống tăng tốc)');
        } else showToast('🪽 Đã gập Cánh Cứng Elytra');
        return;
      }
      if (gameMode !== 'creative') {
        showToast('🚫 Chế độ Sinh Tồn cần Cánh Cứng Elytra trên không để bay!');
        return;
      }
      player.flying = !player.flying; player.vy = 0; player.fallStartY = player.y;
      showToast(player.flying ? '🕊️ Đã bật Bay Tự Do (Space = Bay lên • Shift = Bay xuống • Tới 540m!)' : '🦶 Đã tắt Bay Tự Do');
      return;
    }
    if (e.code === 'KeyG' && !e.repeat && isPlaying && !player.dead && player.ridingDragon) {
      if (typeof castRiddenDragonSkill === 'function') castRiddenDragonSkill(2);
      return;
    }
    if (e.code === 'KeyV' && !e.repeat && isPlaying && !player.dead && player.ridingDragon) {
      if (typeof castRiddenDragonSkill === 'function') castRiddenDragonSkill(3);
      return;
    }
    if (e.code === 'KeyB' && !e.repeat && isPlaying && !player.dead && player.ridingDragon) {
      if (typeof castRiddenDragonSkill === 'function') castRiddenDragonSkill(4);
      return;
    }
    if (e.code === 'KeyR' && !e.repeat && isPlaying && !player.dead) {
      if (player.ridingDragon) { dismountDragon(); return; }
      const drg = findNearestSaddledDragon(9.0);
      if (drg) { mountDragon(drg); return; }
    }
    if (e.code === 'KeyC' && !e.repeat && isPlaying && !player.dead) {
      player.sitting = !player.sitting;
      showToast(player.sitting ? '🪑 Đã ngồi xuống (Nhấn C hoặc di chuyển/nhảy để đứng dậy)' : '🧍 Đã đứng dậy');
      return;
    }
    if (e.code === 'KeyW' && !e.repeat && isPlaying && !player.dead) {
      const nowW = performance.now();
      if (nowW - (window._lastWTap || 0) < 300) player.doubleTapSprint = true;
      window._lastWTap = nowW;
    }
    if (e.code === 'Space' && !e.repeat && isPlaying && !player.dead) {
      const nowMs = performance.now();
      const cDefS = player.equip && player.equip.chest ? BLOCK_DEF[player.equip.chest] : null;
      if (cDefS && cDefS.isElytra && !player.onGround && !player.inWater && !player.flying && !player.gliding && player.vy < -0.5) {
        player.gliding = true;
        const sp = Math.max(10.0, Math.hypot(player.smoothMoveX || 0, player.smoothMoveZ || 0));
        player.glideVel = { x: -Math.sin(player.yaw) * sp, y: Math.max(0.5, player.vy * 0.25), z: -Math.cos(player.yaw) * sp };
        player.vy = player.glideVel.y; player.fallStartY = player.y;
        showToast('🪽 Đang Lướt Cánh Cứng Elytra! (F để gập • Bụi Súng để tăng tốc)');
      } else if (gameMode === 'creative' && nowMs - (window._lastSpaceTap || 0) < 280) {
        player.flying = !player.flying; player.vy = 0; player.fallStartY = player.y;
        showToast(player.flying ? '🕊️ Đã bật Bay Tự Do (Space = Bay lên • Shift = Bay xuống)!' : '🦶 Đã tắt Bay Tự Do');
      }
      window._lastSpaceTap = nowMs;
    }
    // Prevent Space / Enter / Arrows from triggering previously focused menu/HUD buttons while playing (fixes accidental teleport!)
    if (isPlaying && (e.code === 'Space' || e.code === 'Enter' || e.code.startsWith('Arrow'))) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    }
    if (isPlaying) keys[e.code] = true;
    if (isPlaying && e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5), 10); if (n >= 1 && n <= 9) selectHotbarSlot(n - 1); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyW') player.doubleTapSprint = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mining.active = false; dragLook = false; if (_mouseTouchSimActive) { _mouseTouchSimActive = false; endScreenPointer('mouse', lastTouchX, lastTouchY); } });

  function safeLockPointer() {
    if (isTouchDevice() || !canvas.requestPointerLock) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  // Block ALL browser/Edge right-click context menus everywhere in NUCRAFT (except inside text inputs!)
  window.addEventListener('contextmenu', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);
  document.addEventListener('contextmenu', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);
  window.addEventListener('auxclick', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.button === 1 || e.button === 2) e.preventDefault();
  }, true);
  let _lastRealTouchAt = 0, _mouseTouchSimActive = false;
  canvas.addEventListener('mousedown', (e) => {
    ensureAudio(); if (!isPlaying || player.dead || hudEditMode) return;
    if (showMobileControls) {
      if (performance.now() - _lastRealTouchAt < 500) return;
      if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
      if (e.button === 0) {
        e.preventDefault();
        _mouseTouchSimActive = true;
        startScreenPointer('mouse', e.clientX, e.clientY);
      } else if (e.button === 2) {
        e.preventDefault();
        const _hs = inventory[player.selectedSlot], _hd = (_hs && _hs.count > 0) ? BLOCK_DEF[_hs.id] : null;
        if (_hd && _hd.tool === 'bow' && typeof startBowDraw === 'function') startBowDraw(e.clientX, e.clientY);
        else handlePlaceOrEat(e.clientX, e.clientY);
      }
      return;
    }
    if (isTouchDevice()) return;
    if (e.button === 0) {
      if (document.pointerLockElement !== canvas) safeLockPointer();
      handlePrimaryActionDown();
      dragLook = true; lastMouseX = e.clientX; lastMouseY = e.clientY;
    } else if (e.button === 1) {
      e.preventDefault();
    } else if (e.button === 2) {
      e.preventDefault();
      const _hs = inventory[player.selectedSlot], _hd = (_hs && _hs.count > 0) ? BLOCK_DEF[_hs.id] : null;
      if (_hd && _hd.tool === 'bow' && typeof startBowDraw === 'function') startBowDraw();
      else handlePlaceOrEat();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (_mouseTouchSimActive && e.button === 0) {
      _mouseTouchSimActive = false;
      endScreenPointer('mouse', e.clientX, e.clientY);
      return;
    }
    if (e.button === 2) {
      if (player.bowDrawing && typeof releaseBowDraw === 'function') {
        releaseBowDraw(showMobileControls ? e.clientX : null, showMobileControls ? e.clientY : null);
      }
      return;
    }
    if (e.button === 0) {
      dragLook = false;
      if (!showMobileControls && !isTouchDevice()) mining.active = false;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPlaying || player.dead || hudEditMode) return;
    if (_mouseTouchSimActive && showMobileControls) {
      moveScreenPointer('mouse', e.clientX, e.clientY);
      return;
    }
    if (document.pointerLockElement === canvas) {
      const mx = Math.max(-140, Math.min(140, e.movementX || 0)), my = Math.max(-140, Math.min(140, e.movementY || 0));
      player.yaw -= mx * 0.0024; player.pitch = Math.max(-1.48, Math.min(1.48, player.pitch - my * 0.0024));
    }
    else if (dragLook && !isTouchDevice()) { const dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY; lastMouseX = e.clientX; lastMouseY = e.clientY; player.yaw -= dx * 0.0038; player.pitch = Math.max(-1.48, Math.min(1.48, player.pitch - dy * 0.0038)); }
  });
  window.addEventListener('wheel', (e) => { if (!isPlaying) return; selectHotbarSlot((player.selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9); }, { passive: true });

  let mobileCtrlMode = 'buttons'; // 'buttons' | 'classic' | 'touch_direct'
  try {
    const _mcm = localStorage.getItem('nucraft_mobile_ctrl_mode');
    if (_mcm === 'classic' || _mcm === 'buttons' || _mcm === 'touch_direct') mobileCtrlMode = _mcm;
  } catch (_) {}
  function isInteractiveContainerBlock(id) {
    if (!id) return false;
    if (id === B.CRAFT_TABLE || id === B.SMITHING_TABLE || id === B.ENCHANT_TABLE || id === B.ANVIL || id === B.CAMPFIRE || id === B.END_PORTAL_FRAME || id === B.END_PORTAL_FRAME_EYE || id === B.TNT || id === B.ELEVATOR_BLOCK) return true;
    const bd = BLOCK_DEF[id];
    return !!(bd && (bd.chest || bd.furnaceType || bd.door || bd.trapdoor || bd.bed));
  }
  function applyMobileCtrlModeUI() {
    const mc = document.getElementById('mobileControls');
    const isClassic = (mobileCtrlMode === 'classic');
    const isDirect = (mobileCtrlMode === 'touch_direct');
    if (mc) {
      mc.classList.toggle('mode-classic', isClassic);
      mc.classList.toggle('mode-direct', isDirect);
      mc.classList.remove('show-extra-btns');
    }
    const tcOn = document.body.classList.contains('touch-ui');
    document.body.classList.toggle('touch-direct-no-crosshair', !!(tcOn && isDirect));
    document.getElementById('btnMobileMode1')?.classList.toggle('mc-btn-green', mobileCtrlMode === 'buttons');
    document.getElementById('btnMobileMode2')?.classList.toggle('mc-btn-green', isClassic);
    document.getElementById('btnMobileMode3')?.classList.toggle('mc-btn-green', isDirect);
    if (!isDirect || !tcOn) document.getElementById('btnContextPet')?.classList.remove('visible');
  }
  function setMobileCtrlMode(mode) {
    mobileCtrlMode = mode;
    try { localStorage.setItem('nucraft_mobile_ctrl_mode', mode); } catch (_) {}
    if (!showMobileControls) {
      _userManuallyToggledTouch = true;
      showMobileControls = true;
      if (typeof syncMobileControls === 'function') syncMobileControls();
      if (typeof applyHudLayout === 'function') applyHudLayout();
    } else {
      applyMobileCtrlModeUI();
    }
    showToast(mode === 'touch_direct'
      ? '🎯 Kiểu Mobile 3: Chỉ Joystick + Nhảy & Ngồi — Chạm/click màn hình đánh & đặt, giữ đè đào & bắn cung!'
      : (mode === 'classic'
        ? '🎮 Kiểu Mobile 2: D-Pad MCPE (Chạm đặt/đánh, giữ đè đào)!'
        : '🎮 Kiểu Mobile 1: Nút Bấm Chuẩn (Joystick + Đánh/Đặt)!'));
  }
  document.getElementById('btnMobileMode1')?.addEventListener('click', () => setMobileCtrlMode('buttons'));
  document.getElementById('btnMobileMode2')?.addEventListener('click', () => setMobileCtrlMode('classic'));
  document.getElementById('btnMobileMode3')?.addEventListener('click', () => setMobileCtrlMode('touch_direct'));
  applyMobileCtrlModeUI();

  // True Multi-Touch + Unified PC Mouse Touch Simulation + Hold-to-Mine/Eat/Bow + Contextual Pet Tame!
  const activeUiTouchIds = new Set();
  const mcTouchRing = document.getElementById('mcTouchRing');
  const btnContextPet = document.getElementById('btnContextPet');
  let _contextPetTarget = null, _lastContextPetText = '', _contextPetScanT = 0;
  let lookTouchId = null, lastTouchX = 0, lastTouchY = 0;
  let joyTouchId = null, joyOriginX = 0, joyOriginY = 0;
  let dpadTouchId = null;
  let touchStartX = 0, touchStartY = 0, touchStartAt = 0, touchMovedDist = 0;
  let classicHoldTimer = null, classicMiningActive = false, touchEatingActive = false, touchBowActive = false, touchBowCd = 0;

  function clearClassicHold() {
    if (classicHoldTimer) { clearTimeout(classicHoldTimer); classicHoldTimer = null; }
    if (classicMiningActive) { classicMiningActive = false; mining.active = false; }
    mining.touchX = null; mining.touchY = null;
    if (touchEatingActive) { touchEatingActive = false; eatState.active = false; syncEatBarUI(); }
    if (touchBowActive && typeof player !== 'undefined' && player.bowDrawing && typeof cancelBowDraw === 'function') cancelBowDraw();
    touchBowActive = false; touchBowCd = 0;
    if (mcTouchRing) mcTouchRing.classList.remove('active');
  }

  function updateTouchBow(dt) {
    if (!touchBowActive) return;
    if (!isPlaying || player.dead || lookTouchId === null || mobileCtrlMode !== 'touch_direct') {
      if (typeof cancelBowDraw === 'function') cancelBowDraw();
      touchBowActive = false; return;
    }
    const slot = inventory[player.selectedSlot];
    const def = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    if (!def || def.tool !== 'bow') {
      if (typeof cancelBowDraw === 'function') cancelBowDraw();
      touchBowActive = false; return;
    }
  }

  function updateContextPetBtn(force = false, dt = 0.1) {
    if (!btnContextPet) return;
    if (!force) {
      _contextPetScanT -= dt;
      if (_contextPetScanT > 0) return;
      _contextPetScanT = 0.10;
    }
    if (!showMobileControls || mobileCtrlMode !== 'touch_direct' || !isPlaying || player.dead) {
      _contextPetTarget = null;
      if (_lastContextPetText !== '') { _lastContextPetText = ''; btnContextPet.classList.remove('visible'); }
      return;
    }
    let found = raycastMob(4.8);
    if (found && (found._dead || found.tamed || !TAMEABLE_PETS.has(found.type))) found = null;
    if (!found) {
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      let bestD = 4.6;
      for (let i = 0; i < mobs.length; i++) {
        const mb = mobs[i];
        if (!mb || mb._dead || mb.tamed || !TAMEABLE_PETS.has(mb.type)) continue;
        const dx = mb.x - player.x, dy = mb.y - player.y, dz = mb.z - player.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < bestD && (d < 1.6 || (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) > 0.25)) {
          bestD = d; found = mb;
        }
      }
    }
    _contextPetTarget = found;
    const nextTxt = found ? `💖 Thuần Hóa ${found.displayName || found.type}` : '';
    if (nextTxt !== _lastContextPetText) {
      _lastContextPetText = nextTxt;
      if (found) { btnContextPet.textContent = nextTxt; btnContextPet.classList.add('visible'); }
      else btnContextPet.classList.remove('visible');
    }
  }
  if (btnContextPet) {
    let _lastTameTouchAt = 0;
    const onTameClick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (_contextPetTarget && !_contextPetTarget._dead && !_contextPetTarget.tamed) {
        tamePetMob(_contextPetTarget);
        updateContextPetBtn(true);
      }
    };
    btnContextPet.addEventListener('touchstart', (e) => { _lastTameTouchAt = performance.now(); onTameClick(e); }, { passive: false });
    btnContextPet.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    btnContextPet.addEventListener('click', (e) => { if (performance.now() - _lastTameTouchAt >= 500) onTameClick(e); });
  }

  function sweepStaleTouches(touchList) {
    const alive = new Set();
    for (let i = 0; i < touchList.length; i++) alive.add(touchList[i].identifier);
    if (lookTouchId !== null && lookTouchId !== 'mouse' && !alive.has(lookTouchId)) { clearClassicHold(); lookTouchId = null; }
    if (joyTouchId !== null && !alive.has(joyTouchId)) { joyTouchId = null; updateJoyVisual(0, 0); }
    if (dpadTouchId !== null && !alive.has(dpadTouchId)) { dpadTouchId = null; clearDpadVisual(); }
    for (const id of Array.from(activeUiTouchIds)) if (!alive.has(id)) activeUiTouchIds.delete(id);
  }

  function startScreenPointer(id, cx, cy) {
    lookTouchId = id;
    lastTouchX = touchStartX = cx;
    lastTouchY = touchStartY = cy;
    touchStartAt = performance.now();
    touchMovedDist = 0;
    clearClassicHold();
    if ((mobileCtrlMode === 'classic' || mobileCtrlMode === 'touch_direct') && !(typeof isFishingRodCast === 'function' && isFishingRodCast())) {
      const isDir = (mobileCtrlMode === 'touch_direct');
      classicHoldTimer = setTimeout(() => {
        if (lookTouchId === id && touchMovedDist < 16 && isPlaying && !player.dead) {
          const hSlot = inventory[player.selectedSlot];
          const hDef = (hSlot && hSlot.count > 0) ? BLOCK_DEF[hSlot.id] : null;
          const holdMob = isDir ? raycastMob(4.8, lastTouchX, lastTouchY) : null;
          if (holdMob && holdMob.tamed && holdMob.elemDragon && (!hSlot || (hSlot.id !== B.DRAGON_CRYSTAL && hSlot.id !== B.DRAGON_SADDLE && !(hDef && hDef.dragonArmorSlot)))) {
            feedOrInteractTamedDragon(holdMob, hSlot, hDef, true, false);
            clearClassicHold();
            return;
          }
          if (isDir && hDef && hDef.tool === 'bow') {
            touchBowActive = true;
            if (typeof startBowDraw === 'function') startBowDraw(lastTouchX, lastTouchY);
          } else if (isDir && hDef && hDef.food && !player.sneaking && (player.hp < player.maxHp || player.hunger < player.maxHunger)) {
            touchEatingActive = true;
            eatState.active = true; eatState.slotIdx = player.selectedSlot; eatState.itemId = hSlot.id;
            eatState.timer = 0; eatState.duration = 1.05; eatState.nextChomp = 0.14;
            syncEatBarUI();
          } else {
            classicMiningActive = true;
            mining.touchX = isDir ? lastTouchX : null;
            mining.touchY = isDir ? lastTouchY : null;
            mining.active = true;
          }
          if (mcTouchRing) { mcTouchRing.style.left = lastTouchX + 'px'; mcTouchRing.style.top = lastTouchY + 'px'; mcTouchRing.classList.add('active'); }
        }
      }, 210);
    }
  }

  function moveScreenPointer(id, cx, cy) {
    if (lookTouchId !== id) return;
    const rawDx = cx - lastTouchX, rawDy = cy - lastTouchY;
    lastTouchX = cx; lastTouchY = cy;
    touchMovedDist += Math.hypot(rawDx, rawDy);
    if (touchMovedDist >= 16 && !classicMiningActive && !touchEatingActive && !touchBowActive && classicHoldTimer) {
      clearTimeout(classicHoldTimer); classicHoldTimer = null;
    }
    player.yaw -= (isRotated90 ? rawDy : rawDx) * 0.0048;
    player.pitch = Math.max(-1.48, Math.min(1.48, player.pitch - (isRotated90 ? -rawDx : rawDy) * 0.0048));
    if (classicMiningActive && mobileCtrlMode === 'touch_direct') { mining.touchX = cx; mining.touchY = cy; }
    if ((classicMiningActive || touchEatingActive || touchBowActive) && mcTouchRing) {
      mcTouchRing.style.left = cx + 'px'; mcTouchRing.style.top = cy + 'px';
    }
  }

  function endScreenPointer(id, cx, cy) {
    if (lookTouchId !== id) return;
    const dur = performance.now() - touchStartAt;
    const tapX = cx, tapY = cy;
    const heldBowShot = touchBowActive && typeof player !== 'undefined' && player.bowDrawing;
    const rodCastNow = (typeof isFishingRodCast === 'function' && isFishingRodCast());
    const wasTap = ((mobileCtrlMode === 'classic' || mobileCtrlMode === 'touch_direct' || rodCastNow) && !classicMiningActive && !touchEatingActive && !touchBowActive && touchMovedDist < 16 && dur < 320 && isPlaying && !player.dead && !hudEditMode);
    if (heldBowShot) {
      touchBowActive = false;
      if (typeof releaseBowDraw === 'function') releaseBowDraw(tapX, tapY);
    }
    clearClassicHold();
    lookTouchId = null;
    if (!wasTap) return;
    if (typeof isFishingRodCast === 'function' && isFishingRodCast()) {
      if (typeof toggleFishingCast === 'function') toggleFishingCast(tapX, tapY);
      return;
    }
    const mobHit = raycastMob(4.8, tapX, tapY);
    const _axSlot = inventory[player.selectedSlot], _axDef = (_axSlot && _axSlot.count > 0) ? BLOCK_DEF[_axSlot.id] : null;
    if (!mobHit && _axDef && _axDef.tool === 'axe' && typeof tryStripLogWithAxe === 'function') {
      const axHit = raycastBlock(5.4, false, false, tapX, tapY);
      if (axHit && BLOCK_DEF[axHit.id]?.stripTo && tryStripLogWithAxe(axHit)) return;
    }
    if (mobileCtrlMode === 'touch_direct') {
      const slot = inventory[player.selectedSlot];
      const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
      const hit = raycastBlock(5.4, false, false, tapX, tapY);
      if (mobHit) {
        if ((slot && (slot.id === B.FLINT_AND_STEEL || slot.id === B.SOUL_FLINT_AND_STEEL))
          || (mobHit.tamed && mobHit.elemDragon && (slot?.id === B.DRAGON_CRYSTAL || slot?.id === B.DRAGON_SADDLE || selDef?.dragonArmorSlot || !selDef || !selDef.dmg))
          || (mobHit.type === 'villager' && (!selDef || !selDef.dmg))
          || (mobHit.tamed && TAMEABLE_PETS.has(mobHit.type) && (!selDef || selDef.food || !selDef.dmg))) {
          handlePlaceOrEat(tapX, tapY);
        } else {
          attackTargetMob(tapX, tapY);
        }
      } else if (hit && !player.sneaking && isInteractiveContainerBlock(hit.id)) {
        handlePlaceOrEat(tapX, tapY);
      } else if (selDef && selDef.tool === 'bow') {
        if (typeof quickFireBow === 'function') quickFireBow(tapX, tapY);
        else attackTargetMob(tapX, tapY);
      } else if (selDef && !selDef.food && (!selDef.tool || selDef.tool === 'rod' || selDef.tool === 'flint_steel' || selDef.shield)) {
        if (hit || selDef.tool === 'rod' || selDef.spyglass || selDef.waterBreath || selDef.pearl || selDef.enchantedBook || (slot && (slot.id === B.ENDER_EYE || slot.id === B.NIGHT_VISION_POTION || slot.id === B.SWIFT_SNEAK_BOOK || slot.id === B.SNOWBALL || slot.id === B.MUSIC_DISC_5 || slot.id === B.MUSIC_DISC_OTHERSIDE)) || selDef.armorSlot || selDef.shield || selDef.boat) {
          handlePlaceOrEat(tapX, tapY);
        } else {
          attackTargetMob(tapX, tapY);
        }
      } else {
        attackTargetMob(tapX, tapY);
      }
    } else {
      if (mobHit) attackTargetMob(tapX, tapY);
      else handlePlaceOrEat(tapX, tapY);
    }
  }

  function swapOffhandItem() {
    const slot = inventory[player.selectedSlot];
    const curId = (slot && slot.count > 0) ? slot.id : 0;
    const curOff = player.equip.offhand || 0;
    const prevOffDur = player.offhandDur || 336;
    const curDef = curId ? BLOCK_DEF[curId] : null;
    if (curId && curDef && (curDef.offhandOk || curDef.shield)) {
      const nextDur = (curId === B.SHIELD) ? (slot.dur || 336) : 0;
      const nextMaxDur = (curId === B.SHIELD) ? (slot.maxDur || 336) : 0;
      if (gameMode !== 'creative') {
        slot.count--;
        if (slot.count <= 0) { slot.id = 0; slot.dur = 0; slot.maxDur = 0; }
      }
      if (curOff) {
        addItemToInventory(curOff, 1);
        if (curOff === B.SHIELD) {
          const restored = inventory.find(s => s.id === B.SHIELD && s.count > 0);
          if (restored) restored.dur = Math.max(1, prevOffDur);
        }
      }
      player.equip.offhand = curId;
      if (curId === B.SHIELD) {
        player.offhandDur = nextDur || 336;
        player.offhandMaxDur = nextMaxDur || 336;
      }
      recalcPlayerArmor();
      if (typeof renderEquipmentUI === 'function') renderEquipmentUI();
      playSfx('equip');
      renderHotbar();
      showToast(`✋ Đã cầm ${curDef.name} ở tay trái!`);
    } else if (curOff) {
      if (!addItemToInventory(curOff, 1)) { showToast('🎒 Balo đã đầy!'); return; }
      if (curOff === B.SHIELD) {
        for (let i = 35; i >= 0; i--) {
          if (inventory[i].id === B.SHIELD && inventory[i].count > 0) {
            inventory[i].dur = Math.max(1, prevOffDur);
            break;
          }
        }
      }
      player.equip.offhand = 0;
      recalcPlayerArmor();
      if (typeof renderEquipmentUI === 'function') renderEquipmentUI();
      playSfx('equip');
      renderHotbar();
      showToast('✋ Đã cất vật phẩm tay trái vào túi!');
    } else {
      showToast('💡 Hãy cầm Đuốc, Đèn Lồng, Totem hoặc Khiên rồi bấm để chuyển sang tay trái!');
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    _lastRealTouchAt = performance.now();
    ensureAudio(); if (!isPlaying || player.dead || hudEditMode) return;
    e.preventDefault();
    sweepStaleTouches(e.touches);
    if (lookTouchId === null) {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId || t.identifier === dpadTouchId || activeUiTouchIds.has(t.identifier)) continue;
        startScreenPointer(t.identifier, t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isPlaying || player.dead || hudEditMode) return;
    let handled = false;
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId && joyTouchId !== null) {
        handleJoyMove(t.clientX, t.clientY);
        handled = true;
      } else if (t.identifier === dpadTouchId && dpadTouchId !== null) {
        handleDpadPoint(t.clientX, t.clientY);
        handled = true;
      } else if (t.identifier === lookTouchId && lookTouchId !== null) {
        moveScreenPointer(t.identifier, t.clientX, t.clientY);
        handled = true;
      }
    }
    if (handled && e.cancelable) e.preventDefault();
  }, { passive: false });

  const endGlobalTouches = (e) => {
    _lastRealTouchAt = performance.now();
    for (const t of e.changedTouches) {
      if (t.identifier === lookTouchId) endScreenPointer(t.identifier, t.clientX, t.clientY);
      if (t.identifier === joyTouchId) {
        joyTouchId = null;
        updateJoyVisual(0, 0);
      }
      if (t.identifier === dpadTouchId) {
        dpadTouchId = null;
        clearDpadVisual();
      }
      activeUiTouchIds.delete(t.identifier);
    }
    if (e.touches) sweepStaleTouches(e.touches);
  };
  window.addEventListener('touchend', endGlobalTouches, { passive: true });
  window.addEventListener('touchcancel', endGlobalTouches, { passive: true });

  const joyZone = document.getElementById('joyZone'), joyKnob = document.getElementById('joyKnob');
  let _joyActiveState = false;
  function updateJoyVisual(nx, ny) {
    const active = (nx !== 0 || ny !== 0);
    if (active !== _joyActiveState) {
      _joyActiveState = active;
      if (joyZone) joyZone.classList.toggle('active', active);
      if (joyKnob) joyKnob.classList.toggle('returning', !active);
    }
    joyKnob.style.transform = `translate3d(${Math.round(nx * 36)}px, ${Math.round(ny * 36)}px, 0)`;
    touchState.joyX = nx; touchState.joyY = -ny;
  }
  function handleJoyMove(cx, cy) {
    const rawDx = cx - joyOriginX, rawDy = cy - joyOriginY;
    const dx = isRotated90 ? rawDy : rawDx, dy = isRotated90 ? -rawDx : rawDy;
    const maxR = 46, dist = Math.hypot(dx, dy), cl = dist > maxR ? maxR / dist : 1;
    updateJoyVisual((dx * cl) / maxR, (dy * cl) / maxR);
  }
  joyZone.addEventListener('touchstart', (e) => {
    if (hudEditMode) return; e.preventDefault(); e.stopPropagation(); ensureAudio();
    if (joyTouchId === null && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      joyTouchId = t.identifier;
      const rect = joyZone.getBoundingClientRect();
      joyOriginX = rect.left + rect.width / 2; joyOriginY = rect.top + rect.height / 2;
      handleJoyMove(t.clientX, t.clientY);
    }
  }, { passive: false });

  // Classic MCPE 4-Way D-Pad + Center Sneak (Cached rect + bitmask diff = zero touchmove reflows!)
  const dpadZone = document.getElementById('dpadZone');
  const _dpadBtnsMap = dpadZone ? {
    up: dpadZone.querySelector('.dpad-up'),
    down: dpadZone.querySelector('.dpad-down'),
    left: dpadZone.querySelector('.dpad-left'),
    right: dpadZone.querySelector('.dpad-right'),
    mid: dpadZone.querySelector('.dpad-mid')
  } : null;
  let _dpadRect = null, _lastDpadMask = -1;
  function _applyDpadMask(mask) {
    if (!_dpadBtnsMap || mask === _lastDpadMask) return;
    _lastDpadMask = mask;
    _dpadBtnsMap.up?.classList.toggle('active', !!(mask & 1));
    _dpadBtnsMap.down?.classList.toggle('active', !!(mask & 2));
    _dpadBtnsMap.left?.classList.toggle('active', !!(mask & 4));
    _dpadBtnsMap.right?.classList.toggle('active', !!(mask & 8));
    _dpadBtnsMap.mid?.classList.toggle('active', !!(mask & 16) || !!touchState.sneak);
  }
  function clearDpadVisual() {
    _dpadRect = null;
    _applyDpadMask(0);
    touchState.joyX = 0; touchState.joyY = 0;
  }
  function handleDpadPoint(cx, cy) {
    if (!dpadZone) return;
    const rect = _dpadRect || (_dpadRect = dpadZone.getBoundingClientRect());
    const rx = (cx - (rect.left + rect.width / 2)) / (rect.width * 0.5);
    const ry = (cy - (rect.top + rect.height / 2)) / (rect.height * 0.5);
    const dx = isRotated90 ? ry : rx;
    const dy = isRotated90 ? -rx : ry;
    if (Math.hypot(dx, dy) < 0.28) {
      touchState.joyX = 0; touchState.joyY = 0;
      _applyDpadMask(16);
      return;
    }
    let jx = 0, jy = 0, mask = 0;
    if (dy < -0.25) { jy = 1; mask |= 1; }
    else if (dy > 0.25) { jy = -1; mask |= 2; }
    if (dx < -0.25) { jx = -1; mask |= 4; }
    else if (dx > 0.25) { jx = 1; mask |= 8; }
    touchState.joyX = jx; touchState.joyY = jy;
    _applyDpadMask(mask);
  }
  let _sneakLocked = false, _lastSneakTapMs = 0;
  function toggleMobileSneakLatch() {
    _sneakLocked = !_sneakLocked;
    touchState.sneak = _sneakLocked;
    if (touchState.sneak) { touchState.sprint = false; document.getElementById('btnSprint')?.classList.remove('toggled'); }
    document.getElementById('btnSneak')?.classList.toggle('toggled', touchState.sneak);
    _dpadBtnsMap?.mid?.classList.toggle('active', touchState.sneak);
  }
  if (dpadZone) {
    dpadZone.addEventListener('touchstart', (e) => {
      if (hudEditMode) return; e.preventDefault(); e.stopPropagation(); ensureAudio();
      if (dpadTouchId === null && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        _dpadRect = dpadZone.getBoundingClientRect();
        const r = _dpadRect;
        const nrx = (t.clientX - (r.left + r.width / 2)) / (r.width * 0.5);
        const nry = (t.clientY - (r.top + r.height / 2)) / (r.height * 0.5);
        const ndx = isRotated90 ? nry : nrx, ndy = isRotated90 ? -nrx : nry;
        if (Math.hypot(ndx, ndy) < 0.32) {
          const nowMs = performance.now();
          if (nowMs - _lastSneakTapMs < 320) {
            _lastSneakTapMs = 0;
            toggleMobileSneakLatch();
          } else {
            _lastSneakTapMs = nowMs;
            touchState.sneak = true;
            _dpadBtnsMap?.mid?.classList.add('active');
          }
          return;
        }
        dpadTouchId = t.identifier;
        handleDpadPoint(t.clientX, t.clientY);
      }
    }, { passive: false });
    dpadZone.addEventListener('touchend', () => {
      if (dpadTouchId === null && !_sneakLocked && touchState.sneak) {
        touchState.sneak = false;
        _dpadBtnsMap?.mid?.classList.remove('active');
      }
    }, { passive: true });
  }

  let joyMouseDown = false;
  joyZone.addEventListener('mousedown', (e) => { if (hudEditMode) return; e.preventDefault(); ensureAudio(); joyMouseDown = true; const rect = joyZone.getBoundingClientRect(); joyOriginX = rect.left + rect.width / 2; joyOriginY = rect.top + rect.height / 2; handleJoyMove(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (joyMouseDown && !hudEditMode) handleJoyMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (joyMouseDown) { joyMouseDown = false; updateJoyVisual(0, 0); } });

  function bindMultiTouchButton(id, onPress, onRelease) {
    const el = document.getElementById(id), activeIds = new Set();
    let lastTouchAt = 0;
    el.addEventListener('touchstart', (e) => { if (hudEditMode) return; e.preventDefault(); e.stopPropagation(); lastTouchAt = performance.now(); ensureAudio(); const wasEmpty = activeIds.size === 0; for (const t of e.changedTouches) { activeIds.add(t.identifier); activeUiTouchIds.add(t.identifier); } if (wasEmpty) { el.classList.add('pressed'); onPress(); } }, { passive: false });
    const releaseTouch = (e) => { if (hudEditMode) return; e.preventDefault(); lastTouchAt = performance.now(); for (const t of e.changedTouches) { activeIds.delete(t.identifier); activeUiTouchIds.delete(t.identifier); } if (activeIds.size === 0) { el.classList.remove('pressed'); if (onRelease) onRelease(); } };
    el.addEventListener('touchend', releaseTouch, { passive: false }); el.addEventListener('touchcancel', releaseTouch, { passive: false });
    el.addEventListener('mousedown', (e) => { if (hudEditMode || performance.now() - lastTouchAt < 500) return; e.preventDefault(); e.stopPropagation(); ensureAudio(); el.classList.add('pressed'); onPress(); });
    const releaseMouse = () => { if (hudEditMode || performance.now() - lastTouchAt < 500) return; el.classList.remove('pressed'); if (onRelease) onRelease(); };
    el.addEventListener('mouseup', releaseMouse); el.addEventListener('mouseleave', releaseMouse);
  }
  bindMultiTouchButton('btnJump', () => {
    const nowMs = performance.now();
    const cDefJ = player.equip && player.equip.chest ? BLOCK_DEF[player.equip.chest] : null;
    if (cDefJ && cDefJ.isElytra && !player.onGround && !player.inWater && !player.flying && !player.gliding && player.vy < -0.5) {
      player.gliding = true;
      const sp = Math.max(10.0, Math.hypot(player.smoothMoveX || 0, player.smoothMoveZ || 0));
      player.glideVel = { x: -Math.sin(player.yaw) * sp, y: Math.max(0.5, player.vy * 0.25), z: -Math.cos(player.yaw) * sp };
      player.vy = player.glideVel.y; player.fallStartY = player.y;
      showToast('🪽 Đang Lướt Cánh Cứng Elytra!');
    } else if (gameMode === 'creative' && nowMs - (window._lastMobileJumpTap || 0) < 300) {
      player.flying = !player.flying; player.vy = 0; player.fallStartY = player.y;
      showToast(player.flying ? '🕊️ Đã bật Bay Tự Do (Sáng Tạo)!' : '🦶 Đã tắt Bay Tự Do');
    }
    window._lastMobileJumpTap = nowMs;
    touchState.jump = true;
  }, () => { touchState.jump = false; });
  bindMultiTouchButton('btnAttack', () => { handlePrimaryActionDown(); }, () => { mining.active = false; });
  bindMultiTouchButton('btnPlace', () => {
    const _hs = inventory[player.selectedSlot], _hd = (_hs && _hs.count > 0) ? BLOCK_DEF[_hs.id] : null;
    if (_hd && _hd.tool === 'bow' && typeof startBowDraw === 'function') startBowDraw();
    else handlePlaceOrEat();
  }, () => {
    if (player.bowDrawing && typeof releaseBowDraw === 'function') releaseBowDraw();
  });
  bindMultiTouchButton('btnSprint', () => { touchState.sprint = !touchState.sprint; if (touchState.sprint) { _sneakLocked = false; touchState.sneak = false; document.getElementById('btnSneak').classList.remove('toggled'); _dpadBtnsMap?.mid?.classList.remove('active'); } document.getElementById('btnSprint').classList.toggle('toggled', touchState.sprint); }, null);
  bindMultiTouchButton('btnSneak', () => {
    const nowMs = performance.now();
    if (nowMs - _lastSneakTapMs < 320) {
      _lastSneakTapMs = 0;
      toggleMobileSneakLatch();
    } else {
      _lastSneakTapMs = nowMs;
      touchState.sneak = true;
      document.getElementById('btnSneak').classList.add('toggled');
    }
  }, () => {
    if (!_sneakLocked) {
      touchState.sneak = false;
      document.getElementById('btnSneak').classList.remove('toggled');
      _dpadBtnsMap?.mid?.classList.remove('active');
    }
  });

  function isTouchDevice() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }
  let showMobileControls = isTouchDevice() || /mobile/i.test(location.pathname || '');
  let _userManuallyToggledTouch = false;
  function syncMobileControls() {
    const mc = document.getElementById('mobileControls');
    if (mc) mc.classList.toggle('visible', showMobileControls);
    // Ô "..." cạnh hotbar chỉ hiện ở chế độ Mobile (PC thuần ẩn đi, giống bản Java)
    document.body.classList.toggle('touch-ui', showMobileControls);
    if (typeof applyMobileCtrlModeUI === 'function') applyMobileCtrlModeUI();
    updateMobileUiScale();
  }
  syncMobileControls();
  window.addEventListener('touchstart', () => {
    if (!showMobileControls && !_userManuallyToggledTouch) {
      showMobileControls = true;
      syncMobileControls();
      applyHudLayout();
    }
  }, { passive: true });

  /* ============================================================================
   * 12. HUD, RECIPE BOOK + 3x3 CRAFTING GRID, SPAWNER & SAVE/LOAD
   * ============================================================================ */
  const hotbarEl = document.getElementById('hotbar'), slotIcons = [];
  let swapIdx = -1, selectedEquipSlot = null, hoveredInvSlot = -1, creativePickId = 0, recipeCat = 'all', recipeFilterCraftable = false, selectedRecipe = null;
  let invDrag = { active: false, moved: false, leftOrigin: false, modal: 'inv', sourceType: 'inv', idx: -1, eqKey: '', creativeId: 0, startX: 0, startY: 0, pointerId: null, pointerType: 'mouse', originEl: null, suppressClick: false };
  const invDragGhostEl = document.getElementById('invDragGhost');
  const invDragGhostCtx = invDragGhostEl ? invDragGhostEl.querySelector('canvas').getContext('2d') : null;
  const invDragGhostCnt = invDragGhostEl ? invDragGhostEl.querySelector('.ghost-cnt') : null;
  let _dragMainRect = null, _dragBookRect = null, _lastDropHoverEl = null, _lastBookTrashHover = false, _lastDragOutside = false;
  let _dragTargets = [], _invDragRaf = 0, _dragCurX = 0, _dragCurY = 0;
  let _invSlotUI = null, _rcGridBuiltSig = '', _rcSlotEntries = [], _craftSlotUI3 = null, _craftSlotUI2 = null, _craftOutUI3 = null, _craftOutUI2 = null;
  let _chestSlotUI = [], _chestBpUI = [], _chestHbUI = [], _furnBpUI = [], _furnHbUI = [], _smithBpUI = [], _smithHbUI = [];
  let _activeChestArrs = [], _activeChestBlockId = B.CHEST;
  let _rcBuildGen = 0, _rcChunkRaf = 0, _rcSearchTimer = 0;
  const _staticIconCache = new Map();

  function _slotItemVisualSig(s) {
    if (!s || s.count <= 0 || !s.id) return '0';
    return `${s.id}:${s.ench ? 1 : 0}:${s.trim ? s.trim.pattern + '_' + (s.trim.matId || s.trim.hex || '') : ''}`;
  }
  function _invalidateAllInvIconCaches() {
    _staticIconCache.clear();
    _rcGridBuiltSig = '';
    _lastCharPreviewEquipSig = '';
    if (_invSlotUI) for (let i = 0; i < _invSlotUI.length; i++) if (_invSlotUI[i]) _invSlotUI[i].sig = '';
    if (slotIcons) for (let i = 0; i < slotIcons.length; i++) if (slotIcons[i]) slotIcons[i].sig = '';
    if (_equipSlotEls) for (let i = 0; i < _equipSlotEls.length; i++) if (_equipSlotEls[i]) _equipSlotEls[i]._eqSig = '';
    if (_craftSlotUI3) for (let i = 0; i < _craftSlotUI3.length; i++) if (_craftSlotUI3[i]) _craftSlotUI3[i].sig = '';
    if (_craftSlotUI2) for (let i = 0; i < _craftSlotUI2.length; i++) if (_craftSlotUI2[i]) _craftSlotUI2[i].sig = '';
    if (_craftOutUI3) _craftOutUI3.sig = '';
    if (_craftOutUI2) _craftOutUI2.sig = '';
    for (const pool of [_chestSlotUI, _chestBpUI, _chestHbUI, _furnBpUI, _furnHbUI, _smithBpUI, _smithHbUI]) {
      for (let i = 0; i < pool.length; i++) if (pool[i]) pool[i].sig = '';
    }
    for (const fs of furnaceStateMap.values()) fs._uiSig = '';
  }

  function _clearSlotObj(s) {
    if (!s) return;
    s.id = 0; s.count = 0; s.dur = 0; s.maxDur = 0; s.ench = false; s.trim = null;
  }
  function _swapOrMergeSlots(a, b, cap = 99) {
    if (!a || !b || a === b) return false;
    const isStackBlocked = !!(BLOCK_DEF[a.id]?.tool || BLOCK_DEF[a.id]?.armorSlot || a.ench || b.ench || a.trim || b.trim);
    if (a.id > 0 && a.id === b.id && b.count > 0 && !isStackBlocked && b.count < cap) {
      const mv = Math.min(cap - b.count, a.count);
      b.count += mv; a.count -= mv;
      if (a.count <= 0) _clearSlotObj(a);
      return true;
    }
    const tId = a.id, tC = a.count, tD = a.dur || 0, tM = a.maxDur || 0, tE = !!a.ench, tT = a.trim || null;
    a.id = b.id || 0; a.count = b.count || 0; a.dur = b.dur || 0; a.maxDur = b.maxDur || 0; a.ench = !!b.ench; a.trim = b.trim || null;
    b.id = tId; b.count = tC; b.dur = tD; b.maxDur = tM; b.ench = tE; b.trim = tT;
    return true;
  }
  function _getChestLinearSlot(linearIdx) {
    let off = linearIdx;
    for (let k = 0; k < _activeChestArrs.length; k++) {
      const arr = _activeChestArrs[k];
      if (off < arr.length) return arr[off];
      off -= arr.length;
    }
    return null;
  }
  function getAutoEquipSlotForItem(bid, preferredEq = '') {
    const def = BLOCK_DEF[bid];
    if (!def) return null;
    if (preferredEq && (def.armorSlot === preferredEq || (preferredEq === 'offhand' && def.offhandOk))) return preferredEq;
    return def.armorSlot || (def.offhandOk ? 'offhand' : null);
  }
  function _inRect(r, cx, cy) {
    return !!(r && r.width > 0 && r.height > 0 && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom);
  }
  function _clientToStagePos(cx, cy) {
    return isRotated90 ? { x: cy, y: stageH - cx } : { x: cx, y: cy };
  }
  let _dragTargetsKey = '', _rcRefreshRaf = 0;
  function invalidateDragTargets() { _dragTargetsKey = ''; }
  function _scheduleRecipeRefresh() {
    if (_rcRefreshRaf) return;
    _rcRefreshRaf = requestAnimationFrame(() => {
      _rcRefreshRaf = 0;
      const im = document.getElementById('invModal');
      if (im && !im.classList.contains('hidden')) renderCrafting3x3();
    });
  }
  function _syncInvDropFast(updateCraft = false, updateEquip = false) {
    syncInvSlotsUI();
    if (updateCraft) renderCrafting3x3();
    if (updateEquip) renderEquipmentUI();
    if (!updateCraft && gameMode !== 'creative') _scheduleRecipeRefresh();
  }
  function _refreshInvPanelRects() {
    _dragMainRect = document.getElementById('mainInvPanel')?.getBoundingClientRect() || null;
    _dragBookRect = document.getElementById('recipeBookWrap')?.getBoundingClientRect() || null;
  }
  function _snapshotDragTargets(modalName) {
    const cg = (modalName === 'chest') ? document.getElementById('chestGrid') : null;
    const rbVis = (modalName === 'inv') ? (document.getElementById('recipeBookWrap')?.style.display || '') : '';
    const chTag = cg ? `${cg.scrollTop}_${_activeChestBlockId}_${_activeChestArrs.length}` : '';
    const key = `${modalName}|${stageW}x${stageH}|${isRotated90 ? 1 : 0}|${invMode}|${rbVis}|${chTag}`;
    if (_dragTargetsKey === key && _dragTargets.length > 0) return;
    _dragTargets.length = 0;
    const pushNode = (el, kind, extra) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      _dragTargets.push({ el, kind, left: r.left, right: r.right, top: r.top, bottom: r.bottom, ...extra });
    };
    if (modalName === 'chest') {
      const cgR = cg ? cg.getBoundingClientRect() : null;
      if (cg) {
        if (!cg._scrollInvalidHooked) {
          cg._scrollInvalidHooked = true;
          cg.addEventListener('scroll', invalidateDragTargets, { passive: true });
        }
        for (let i = 0; i < _chestSlotUI.length; i++) {
          const el = _chestSlotUI[i].div;
          if (el.style.display === 'none') continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const top = cgR ? Math.max(r.top, cgR.top) : r.top;
          const bottom = cgR ? Math.min(r.bottom, cgR.bottom) : r.bottom;
          if (bottom > top + 4) _dragTargets.push({ el, kind: 'chest', idx: i, left: r.left, right: r.right, top, bottom });
        }
      }
      for (let i = 0; i < _chestBpUI.length; i++) pushNode(_chestBpUI[i].div, 'chestInv', { idx: i + 9 });
      for (let i = 0; i < _chestHbUI.length; i++) pushNode(_chestHbUI[i].div, 'chestInv', { idx: i });
      _dragTargetsKey = key;
      return;
    }
    if (modalName === 'furnace') {
      const fIn = document.getElementById('furnInputSlot');
      const fFuel = document.getElementById('furnFuelSlot');
      if (fIn) pushNode(fIn, 'furnSlot', { eqKey: 'inSlot' });
      if (fFuel) pushNode(fFuel, 'furnSlot', { eqKey: 'fuelSlot' });
      for (let i = 0; i < _furnBpUI.length; i++) pushNode(_furnBpUI[i].div, 'furnInv', { idx: i + 9 });
      for (let i = 0; i < _furnHbUI.length; i++) pushNode(_furnHbUI[i].div, 'furnInv', { idx: i });
      _dragTargetsKey = key;
      return;
    }
    _refreshInvPanelRects();
    const panel = document.getElementById('mainInvPanel');
    if (!panel) return;
    const els = panel.querySelectorAll('[data-inv-idx], [data-craft-idx], .equip-slot[data-eq], #charPreviewBox');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.hasAttribute('data-inv-idx')) pushNode(el, 'inv', { idx: parseInt(el.dataset.invIdx, 10) });
      else if (el.hasAttribute('data-craft-idx')) pushNode(el, 'craft', { idx: parseInt(el.dataset.craftIdx, 10) });
      else if (el.hasAttribute('data-eq')) pushNode(el, 'equip', { eqKey: el.dataset.eq });
      else pushNode(el, 'charPreview', {});
    }
    _dragTargetsKey = key;
  }
  function _hitTestDragTarget(cx, cy) {
    let best = null, bestD2 = Infinity;
    const margin = (invDrag.pointerType === 'touch') ? 7 : 2;
    for (let i = 0; i < _dragTargets.length; i++) {
      const t = _dragTargets[i];
      if (cx >= t.left && cx <= t.right && cy >= t.top && cy <= t.bottom) return t;
      if (cx >= t.left - margin && cx <= t.right + margin && cy >= t.top - margin && cy <= t.bottom + margin) {
        const mx = (t.left + t.right) * 0.5, my = (t.top + t.bottom) * 0.5;
        const d2 = (cx - mx) * (cx - mx) + (cy - my) * (cy - my);
        if (d2 < bestD2) { bestD2 = d2; best = t; }
      }
    }
    return best;
  }
  function isPointOutsideInvPanels(cx, cy) {
    return !_inRect(_dragMainRect, cx, cy) && !_inRect(_dragBookRect, cx, cy);
  }
  function _setInvDropHover(el, bookTrash = false) {
    if (_lastDropHoverEl && _lastDropHoverEl !== el) _lastDropHoverEl.classList.remove('drop-hover');
    if (el && _lastDropHoverEl !== el) el.classList.add('drop-hover');
    _lastDropHoverEl = el || null;
    if (_lastBookTrashHover !== bookTrash) {
      _lastBookTrashHover = bookTrash;
      document.getElementById('recipeBookWrap')?.classList.toggle('creative-trash-hover', bookTrash);
    }
  }
  function clearInvDropHovers() {
    _setInvDropHover(null, false);
  }
  function endInvDragVisual() {
    if (_invDragRaf) { cancelAnimationFrame(_invDragRaf); _invDragRaf = 0; }
    if (invDrag.originEl) { invDrag.originEl.classList.remove('dragging-src'); invDrag.originEl = null; }
    if (invDragGhostEl) { invDragGhostEl.style.display = 'none'; invDragGhostEl.classList.remove('outside'); }
    if (_lastDragOutside) { _lastDragOutside = false; document.getElementById('invModal')?.classList.remove('drag-drop-outside'); }
    clearInvDropHovers();
  }
  const mcTipEl = document.getElementById('mcItemTooltip');
  let _mcTipVisible = false;
  function hideMcTooltip() {
    if (mcTipEl && _mcTipVisible) { _mcTipVisible = false; mcTipEl.style.display = 'none'; }
  }
  document.addEventListener('pointermove', (e) => {
    if (!mcTipEl || isPlaying || e.pointerType === 'touch' || invDrag.active) { hideMcTooltip(); return; }
    const el = e.target && e.target.closest ? e.target.closest('#invModal .slot, #invModal .equip-slot, #invModal .rc-slot, #furnaceModal .slot, #chestModal .slot, #tradeModal .trade-slot, #smithingModal .slot') : null;
    if (!el) { hideMcTooltip(); return; }
    if (el.title) { el.dataset.mcTip = el.title; el.title = ''; }
    const tip = el.dataset.mcTip || '';
    if (!tip) { hideMcTooltip(); return; }
    mcTipEl.textContent = tip;
    mcTipEl.style.display = 'block'; _mcTipVisible = true;
    const r = mcTipEl.getBoundingClientRect();
    const sp = _clientToStagePos(e.clientX, e.clientY);
    const x = Math.min(stageW - r.width - 8, sp.x + 12);
    const y = Math.max(8, sp.y - r.height - 10);
    mcTipEl.style.left = `${Math.max(8, x)}px`;
    mcTipEl.style.top = `${y}px`;
  }, { passive: true });
  window.addEventListener('blur', hideMcTooltip);
  function _setDragGhostTransform(cx, cy) {
    if (!invDragGhostEl) return;
    const sp = _clientToStagePos(cx, cy);
    const liftY = (invDrag.pointerType === 'touch') ? 22 : 0;
    invDragGhostEl.style.transform = `translate3d(${sp.x}px, ${sp.y - liftY}px, 0) translate(-50%, -50%) scale(1.08)`;
  }
  function _getDragGhostInfo() {
    let gId = 0, gCnt = 1, gMeta = null;
    if (invDrag.sourceType === 'inv' || invDrag.sourceType === 'chestInv' || invDrag.sourceType === 'furnInv') {
      const s = inventory[invDrag.idx];
      if (s && s.count > 0) { gId = s.id; gCnt = s.count; gMeta = s; }
    } else if (invDrag.sourceType === 'craft') {
      gId = manualCraftGrid[invDrag.idx] || 0;
    } else if (invDrag.sourceType === 'equip') {
      gId = player.equip[invDrag.eqKey] || 0;
      if (gId && player.equipMeta && player.equipMeta[invDrag.eqKey]) gMeta = player.equipMeta[invDrag.eqKey];
    } else if (invDrag.sourceType === 'creative') {
      gId = invDrag.creativeId || 0;
      const gDef = BLOCK_DEF[gId];
      gCnt = (gDef?.tool || gDef?.armorSlot || gId === B.SHIELD) ? 1 : 99;
    } else if (invDrag.sourceType === 'chest') {
      const s = _getChestLinearSlot(invDrag.idx);
      if (s && s.count > 0) { gId = s.id; gCnt = s.count; gMeta = s; }
    } else if (invDrag.sourceType === 'furnSlot' && activeFurnaceKey) {
      const fs = furnaceStateMap.get(activeFurnaceKey);
      const s = fs ? fs[invDrag.eqKey] : null;
      if (s && s.count > 0) { gId = s.id; gCnt = s.count; gMeta = s; }
    }
    return { gId, gCnt, gMeta };
  }
  function _beginInvDragGhost(cx, cy) {
    const { gId, gCnt, gMeta } = _getDragGhostInfo();
    if (!gId) {
      if (invDrag.sourceType === 'creative') resetInvDragState();
      return false;
    }
    _snapshotDragTargets(invDrag.modal);
    invDrag.moved = true;
    if (invDrag.originEl) invDrag.originEl.classList.add('dragging-src');
    if (invDragGhostEl && invDragGhostCtx) {
      drawBlockPreview(invDragGhostCtx, gId, gMeta);
      invDragGhostCnt.textContent = gCnt > 1 ? String(gCnt) : '';
      _setDragGhostTransform(cx, cy);
      invDragGhostEl.style.display = 'flex';
    }
    return true;
  }
  function _flushInvDragFrame() {
    _invDragRaf = 0;
    if (!invDrag.active || !invDrag.moved || !invDragGhostEl) return;
    const dist = Math.hypot(_dragCurX - invDrag.startX, _dragCurY - invDrag.startY);
    const tgt = _hitTestDragTarget(_dragCurX, _dragCurY);
    const dropEl = tgt ? tgt.el : null;
    if (dist > 18 || (dropEl && dropEl !== invDrag.originEl) || !dropEl) invDrag.leftOrigin = true;
    if (invDrag.modal === 'inv') {
      const isCreativeCatalog = (gameMode === 'creative' && invMode === 'backpack');
      const inBookTrash = !!(isCreativeCatalog && invDrag.sourceType !== 'creative' && _inRect(_dragBookRect, _dragCurX, _dragCurY));
      const out = !inBookTrash && invDrag.sourceType === 'inv' && isPointOutsideInvPanels(_dragCurX, _dragCurY);
      if (_lastDragOutside !== out) {
        _lastDragOutside = out;
        invDragGhostEl.classList.toggle('outside', out);
        document.getElementById('invModal')?.classList.toggle('drag-drop-outside', out);
      }
      _setInvDropHover(inBookTrash ? null : dropEl, inBookTrash);
    } else {
      _setInvDropHover((dropEl && dropEl !== invDrag.originEl) ? dropEl : null, false);
    }
  }
  function startInvDrag(e, sourceType, { idx = -1, eqKey = '', creativeId = 0, originEl = null, modal = 'inv' } = {}) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    hideMcTooltip();
    invDrag.active = true; invDrag.moved = false; invDrag.leftOrigin = false;
    invDrag.modal = modal;
    invDrag.sourceType = sourceType;
    invDrag.idx = idx; invDrag.eqKey = eqKey; invDrag.creativeId = creativeId;
    invDrag.startX = _dragCurX = e.clientX; invDrag.startY = _dragCurY = e.clientY;
    invDrag.pointerId = e.pointerId; invDrag.pointerType = e.pointerType || 'mouse';
    invDrag.originEl = originEl || (e.currentTarget && e.currentTarget.classList ? e.currentTarget : null);
  }
  function resetInvDragState() {
    invDrag.active = false; invDrag.moved = false; invDrag.leftOrigin = false; invDrag.modal = 'inv'; invDrag.sourceType = 'inv';
    invDrag.idx = -1; invDrag.eqKey = ''; invDrag.creativeId = 0; invDrag.pointerId = null;
    endInvDragVisual();
  }
  window.addEventListener('pointercancel', (e) => {
    if (invDrag.active && (invDrag.pointerId === null || e.pointerId === invDrag.pointerId)) resetInvDragState();
  });
  window.addEventListener('pointermove', (e) => {
    if (!invDrag.active || (invDrag.pointerId !== null && e.pointerId !== invDrag.pointerId)) return;
    _dragCurX = e.clientX; _dragCurY = e.clientY;
    if (!invDrag.moved) {
      const dx = _dragCurX - invDrag.startX, dy = _dragCurY - invDrag.startY;
      const thresh = invDrag.pointerType === 'touch' ? 6 : 4;
      if (Math.hypot(dx, dy) <= thresh) return;
      if (invDrag.sourceType === 'creative' && invDrag.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.1) {
        resetInvDragState();
        return;
      }
      if (!_beginInvDragGhost(_dragCurX, _dragCurY)) return;
    } else {
      _setDragGhostTransform(_dragCurX, _dragCurY);
    }
    if (!_invDragRaf) _invDragRaf = requestAnimationFrame(_flushInvDragFrame);
  }, { passive: true });
  function _armSuppressInvClick() {
    invDrag.suppressClick = true;
    setTimeout(() => { invDrag.suppressClick = false; }, 140);
  }
  window.addEventListener('pointerup', (e) => {
    if (!invDrag.active || (invDrag.pointerId !== null && e.pointerId !== invDrag.pointerId)) return;
    const wasMoved = invDrag.moved;
    const leftOrigin = invDrag.leftOrigin;
    const pType = invDrag.pointerType;
    const modalName = invDrag.modal;
    const srcType = invDrag.sourceType, fromIdx = invDrag.idx, fromEq = invDrag.eqKey, cId = invDrag.creativeId;
    const tgt = (wasMoved && leftOrigin) ? _hitTestDragTarget(e.clientX, e.clientY) : null;
    const cachedBookRect = _dragBookRect;
    const cachedMainRect = _dragMainRect;
    resetInvDragState();

    // Fast Mobile Touch & Wiggle-Safe Tap Handling
    if (!wasMoved || !leftOrigin) {
      if (pType === 'touch' || wasMoved) {
        _armSuppressInvClick();
        if (srcType === 'inv' && fromIdx >= 0) handleInvSlotTap(fromIdx, e);
        else if (srcType === 'craft' && fromIdx >= 0) handleCraftSlotTap(fromIdx);
        else if (srcType === 'equip' && fromEq) handleEquipSlotTap(fromEq);
        else if (srcType === 'chest' && fromIdx >= 0) _handleChestSlotTap(fromIdx);
        else if (srcType === 'chestInv' && fromIdx >= 0) _handleChestInvTap(fromIdx);
        else if (srcType === 'furnInv' && fromIdx >= 0) _handleFurnInvTap(fromIdx);
        else if (srcType === 'furnSlot' && fromEq) takeFromFurnaceSlot(fromEq);
      }
      return;
    }
    _armSuppressInvClick();

    if (modalName === 'chest') {
      if (!tgt) return;
      if (srcType === 'chest' && tgt.kind === 'chest') {
        if (tgt.idx === fromIdx) { _handleChestSlotTap(fromIdx); return; }
        if (_swapOrMergeSlots(_getChestLinearSlot(fromIdx), _getChestLinearSlot(tgt.idx))) {
          playSfx('pickup'); renderChestModal(_activeChestBlockId); syncActiveChestSlotsToNet();
        }
      } else if (srcType === 'chest' && tgt.kind === 'chestInv') {
        if (_swapOrMergeSlots(_getChestLinearSlot(fromIdx), inventory[tgt.idx])) {
          playSfx('pickup'); renderChestModal(_activeChestBlockId); syncActiveChestSlotsToNet();
          if (tgt.idx < 9) renderHotbar();
        }
      } else if (srcType === 'chestInv' && tgt.kind === 'chest') {
        if (_swapOrMergeSlots(inventory[fromIdx], _getChestLinearSlot(tgt.idx))) {
          playSfx('place'); renderChestModal(_activeChestBlockId); syncActiveChestSlotsToNet();
          if (fromIdx < 9) renderHotbar();
        }
      } else if (srcType === 'chestInv' && tgt.kind === 'chestInv') {
        if (tgt.idx === fromIdx) { _handleChestInvTap(fromIdx); return; }
        if (_swapOrMergeSlots(inventory[fromIdx], inventory[tgt.idx])) {
          playSfx('pickup'); renderChestModal(_activeChestBlockId);
          if (fromIdx < 9 || tgt.idx < 9) renderHotbar();
        }
      }
      return;
    }

    if (modalName === 'furnace') {
      if (!tgt || !activeFurnaceKey) return;
      const fs = furnaceStateMap.get(activeFurnaceKey); if (!fs) return;
      if (srcType === 'furnInv' && tgt.kind === 'furnSlot') {
        const s = inventory[fromIdx]; if (!s || s.count <= 0) return;
        if (tgt.eqKey === 'inSlot') {
          const rec = SMELT_RECIPES[s.id];
          const allowRec = rec && (fs.type === 'furnace' || (fs.type === 'blast' && rec.kind === 'ore') || (fs.type === 'smoker' && rec.kind === 'food'));
          if (!allowRec) { showToast('🔥 Ô trên chỉ nhận nguyên liệu nung hợp lệ!'); return; }
          if (fs.inSlot.count === 0 || fs.inSlot.id === s.id) {
            const mv = Math.min(99 - fs.inSlot.count, s.count);
            fs.inSlot.id = s.id; fs.inSlot.count += mv; s.count -= mv;
            if (s.count <= 0) _clearSlotObj(s);
            playSfx('place'); renderFurnaceModal(); if (fromIdx < 9) renderHotbar();
          }
        } else if (tgt.eqKey === 'fuelSlot') {
          if (!FUEL_VALUES[s.id]) { showToast('⛽ Ô dưới chỉ nhận Nhiên liệu (Than/Gỗ/Tre/Lava)!'); return; }
          if (fs.fuelSlot.count === 0 || (fs.fuelSlot.id === s.id && s.id !== B.LAVA_BUCKET)) {
            const mv = s.id === B.LAVA_BUCKET ? 1 : Math.min(99 - fs.fuelSlot.count, s.count);
            fs.fuelSlot.id = s.id; fs.fuelSlot.count += mv; s.count -= mv;
            if (s.count <= 0) _clearSlotObj(s);
            playSfx('place'); renderFurnaceModal(); if (fromIdx < 9) renderHotbar();
          }
        }
      } else if (srcType === 'furnSlot' && tgt.kind === 'furnInv') {
        const sl = fs[fromEq]; if (!sl || sl.count <= 0) return;
        const dst = inventory[tgt.idx];
        if (dst.count <= 0 || (dst.id === sl.id && !BLOCK_DEF[sl.id]?.tool && dst.count < 99)) {
          const mv = Math.min(99 - dst.count, sl.count);
          dst.id = sl.id; dst.count += mv; sl.count -= mv;
          if (sl.count <= 0) _clearSlotObj(sl);
        } else {
          takeFromFurnaceSlot(fromEq); return;
        }
        playSfx('pickup'); renderFurnaceModal(); if (tgt.idx < 9) renderHotbar();
      } else if (srcType === 'furnInv' && tgt.kind === 'furnInv') {
        if (tgt.idx === fromIdx) { _handleFurnInvTap(fromIdx); return; }
        if (_swapOrMergeSlots(inventory[fromIdx], inventory[tgt.idx])) {
          playSfx('pickup'); renderFurnaceModal();
          if (fromIdx < 9 || tgt.idx < 9) renderHotbar();
        }
      }
      return;
    }

    const isCreativeCatalog = (gameMode === 'creative' && invMode === 'backpack');

    // 1) Right -> Left drop into Creative Book deletes/clears item like Minecraft Creative trash!
    if (isCreativeCatalog && srcType !== 'creative' && _inRect(cachedBookRect, e.clientX, e.clientY)) {
      if (srcType === 'inv' && fromIdx >= 0) _clearSlotObj(inventory[fromIdx]);
      else if (srcType === 'craft' && fromIdx >= 0) manualCraftGrid[fromIdx] = 0;
      else if (srcType === 'equip' && fromEq) { player.equip[fromEq] = 0; if (player.equipMeta) player.equipMeta[fromEq] = null; recalcPlayerArmor(); }
      swapIdx = -1; creativePickId = 0; selectedEquipSlot = null;
      playSfx('pickup'); _syncInvDropFast(srcType === 'craft', srcType === 'equip');
      if (srcType === 'inv' && fromIdx < 9) renderHotbar();
      showToast('🗑️ Đã xóa vật phẩm (Sáng Tạo)');
      return;
    }

    // 2) Dropped completely outside panels
    if (!_inRect(cachedMainRect, e.clientX, e.clientY) && !_inRect(cachedBookRect, e.clientX, e.clientY)) {
      if (srcType === 'inv' && fromIdx >= 0) { throwInventorySlot(fromIdx, true); swapIdx = -1; }
      return;
    }

    if (!tgt) return;

    // 3) Drop onto 2x2 or 3x3 Crafting Grid cell
    if (tgt.kind === 'craft') {
      const toCraft = tgt.idx;
      if (!isNaN(toCraft) && toCraft >= 0 && toCraft < 9) {
        if (srcType === 'inv' && fromIdx >= 0 && inventory[fromIdx]?.count > 0) {
          const it = inventory[fromIdx];
          const oldCraft = manualCraftGrid[toCraft] || 0;
          manualCraftGrid[toCraft] = it.id;
          it.count--;
          if (it.count <= 0) _clearSlotObj(it);
          if (oldCraft > 0) addItemToInventory(oldCraft, 1);
          selectedRecipe = null; swapIdx = -1;
          playSfx('pickup'); _syncInvDropFast(true, false); if (fromIdx < 9) renderHotbar();
        } else if (srcType === 'creative' && cId > 0) {
          if (manualCraftGrid[toCraft] > 0 && gameMode !== 'creative') addItemToInventory(manualCraftGrid[toCraft], 1);
          manualCraftGrid[toCraft] = cId;
          selectedRecipe = null; creativePickId = 0;
          playSfx('pickup'); _syncInvDropFast(true, false);
        } else if (srcType === 'craft' && fromIdx >= 0 && fromIdx !== toCraft) {
          const tmp = manualCraftGrid[toCraft] || 0;
          manualCraftGrid[toCraft] = manualCraftGrid[fromIdx] || 0;
          manualCraftGrid[fromIdx] = tmp;
          playSfx('pickup'); _syncInvDropFast(true, false);
        }
      }
      return;
    }

    // 4) Drop onto Equipment Slot or 3D Character Preview Box (auto-routes armor/offhand!)
    if (tgt.kind === 'equip' || tgt.kind === 'charPreview') {
      const prefEq = tgt.kind === 'equip' ? tgt.eqKey : '';
      if (srcType === 'inv' && fromIdx >= 0 && inventory[fromIdx]?.count > 0) {
        const targetEq = getAutoEquipSlotForItem(inventory[fromIdx].id, prefEq);
        if (targetEq) {
          equipItemToSlot(targetEq, fromIdx);
          swapIdx = -1; selectedEquipSlot = null;
          _syncInvDropFast(false, true); if (fromIdx < 9) renderHotbar();
        } else showToast('🛡️ Chỉ mặc được Mũ, Áo, Quần, Giày hoặc Khiên/Đuốc!');
      } else if (srcType === 'creative' && cId > 0) {
        const targetEq = getAutoEquipSlotForItem(cId, prefEq);
        if (targetEq) {
          player.equip[targetEq] = cId;
          if (player.equipMeta) player.equipMeta[targetEq] = null;
          recalcPlayerArmor(); creativePickId = 0;
          playSfx('equip'); _syncInvDropFast(false, true);
          showToast(`🛡️ Đã trang bị ${BLOCK_DEF[cId]?.name || 'Giáp'}!`);
        } else showToast('🛡️ Vật phẩm này không phải giáp/trang bị!');
      }
      return;
    }

    // 5) Drop onto Backpack or Hotbar slot
    if (tgt.kind === 'inv') {
      const toIdx = tgt.idx;
      if (isNaN(toIdx) || toIdx < 0 || toIdx >= 36) return;
      if (srcType === 'inv' && fromIdx >= 0) {
        if (toIdx === fromIdx) { handleInvSlotTap(fromIdx, e); return; }
        _swapOrMergeSlots(inventory[fromIdx], inventory[toIdx]);
        swapIdx = -1; playSfx('pickup');
        // Fast partial re-render: skip full recipe catalog DOM scan on simple inv->inv move!
        _syncInvDropFast(false, false);
        if (fromIdx < 9 || toIdx < 9) renderHotbar();
      } else if (srcType === 'creative' && cId > 0) {
        const cDef = BLOCK_DEF[cId];
        const qty = (cDef?.tool || cDef?.armorSlot || cId === B.SHIELD) ? 1 : 99;
        setSlotItem(toIdx, cId, qty);
        creativePickId = 0; swapIdx = -1;
        playSfx('pickup'); _syncInvDropFast(false, false); if (toIdx < 9) renderHotbar();
      } else if (srcType === 'craft' && fromIdx >= 0 && manualCraftGrid[fromIdx] > 0) {
        const cid = manualCraftGrid[fromIdx], dst = inventory[toIdx];
        if (dst.count <= 0) { setSlotItem(toIdx, cid, 1); manualCraftGrid[fromIdx] = 0; }
        else if (dst.id === cid && dst.count < 99 && !BLOCK_DEF[cid]?.tool && !dst.ench && !dst.trim) { dst.count++; manualCraftGrid[fromIdx] = 0; }
        else if (dst.count === 1) { const sw = dst.id; setSlotItem(toIdx, cid, 1); manualCraftGrid[fromIdx] = sw; }
        else { addItemToInventory(cid, 1); manualCraftGrid[fromIdx] = 0; }
        swapIdx = -1; playSfx('pickup'); _syncInvDropFast(true, false); if (toIdx < 9) renderHotbar();
      } else if (srcType === 'equip' && fromEq && player.equip[fromEq]) {
        const eqId = player.equip[fromEq], dst = inventory[toIdx];
        const em = player.equipMeta && player.equipMeta[fromEq];
        const eqDef = BLOCK_DEF[eqId];
        const eqDur = (fromEq === 'offhand' && eqId === B.SHIELD) ? (player.offhandDur || 336) : (em && typeof em.dur === 'number' && em.dur > 0 ? em.dur : (eqDef && eqDef.maxDur ? eqDef.maxDur : 0));
        const eqMax = (fromEq === 'offhand' && eqId === B.SHIELD) ? (player.offhandMaxDur || 336) : (em && em.maxDur ? em.maxDur : (eqDef && eqDef.maxDur ? eqDef.maxDur : 0));
        const eqMeta = (em || eqMax > 0) ? { dur: eqDur, maxDur: eqMax, ench: !!(em && em.ench), trim: (em && em.trim) ? { ...em.trim } : null } : null;
        if (dst.count <= 0) { setSlotItem(toIdx, eqId, 1, eqDur > 0 ? eqDur : null, eqMeta); player.equip[fromEq] = 0; if (player.equipMeta) player.equipMeta[fromEq] = null; }
        else if (getAutoEquipSlotForItem(dst.id, fromEq) === fromEq && dst.count === 1) {
          const dDef = BLOCK_DEF[dst.id];
          const dMax = dst.maxDur || (dDef && dDef.maxDur) || 0;
          const dDur = (typeof dst.dur === 'number' && dst.dur > 0) ? dst.dur : dMax;
          const dMeta = (dst.ench || dst.trim || dMax > 0) ? { dur: dDur, maxDur: dMax, ench: !!dst.ench, trim: dst.trim ? { ...dst.trim } : null } : null;
          player.equip[fromEq] = dst.id; if (player.equipMeta) player.equipMeta[fromEq] = dMeta;
          if (fromEq === 'offhand' && dst.id === B.SHIELD) { player.offhandDur = dDur || 336; player.offhandMaxDur = dMax || 336; }
          setSlotItem(toIdx, eqId, 1, eqDur > 0 ? eqDur : null, eqMeta);
        } else {
          unequipArmorSlot(fromEq); return;
        }
        recalcPlayerArmor(); playSfx('equip'); _syncInvDropFast(false, true); if (toIdx < 9) renderHotbar();
      }
    }
  });
  document.getElementById('invModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget && swapIdx >= 0 && inventory[swapIdx] && inventory[swapIdx].count > 0) {
      throwInventorySlot(swapIdx, true);
      swapIdx = -1;
    }
  });

  // ===================== OFFICIAL MINECRAFT 1.21.1 HUD & 16x16 ITEM / 3D ISOMETRIC BLOCK ICON ENGINE =====================
  const BLOCK_ID_TO_KEY = {};
  for (const [bk, bv] of Object.entries(B)) BLOCK_ID_TO_KEY[bv] = bk;
  const _mcBundle = window.MC_ICONS_BUNDLE || { hud: {}, items: {}, blocks: {}, tex: {} };
  const _mcItemImgs = new Map();
  const _mcTexImgs = new Map();
  const _mcIsoCache = new Map();
  let _mcPendingImgs = 0;

  function _onMcImgReady() {
    _mcPendingImgs = Math.max(0, _mcPendingImgs - 1);
    if (_mcPendingImgs === 0) {
      _mcIsoCache.clear();
      _invalidateAllInvIconCaches();
      if (typeof heldModelCache !== 'undefined') heldModelCache.clear();
      if (typeof offhandModelCache !== 'undefined') offhandModelCache.clear();
      if (typeof dropModelCache !== 'undefined') dropModelCache.clear();
      if (typeof _heldMcTexCache !== 'undefined') _heldMcTexCache.clear();
      if (typeof playerAvatar !== 'undefined' && playerAvatar) playerAvatar.heldItemId = -1;
      if (typeof invPreviewRig !== 'undefined' && invPreviewRig) invPreviewRig.heldItemId = -1;
      if (slotIcons.length) renderHotbar();
      if (!document.getElementById('invModal').classList.contains('hidden')) renderInventoryModal();
      if (typeof player !== 'undefined' && player && typeof inventory !== 'undefined' && inventory) {
        const curSlot = inventory[player.selectedSlot];
        updateHeldViewModel(curSlot && curSlot.count > 0 ? curSlot.id : B.AIR, curSlot && curSlot.count > 0 ? curSlot : null);
        if (typeof updateOffhandViewModel === 'function') updateOffhandViewModel(player.equip.offhand || 0);
      }
      if (typeof droppedItems !== 'undefined' && typeof getDropVisual === 'function') {
        for (let i = 0; i < droppedItems.length; i++) {
          const it = droppedItems[i];
          if (it && it.mesh && it.mesh.userData && it.mesh.userData.iconReady === false) {
            const fresh = getDropVisual(it.id);
            fresh.position.copy(it.mesh.position);
            fresh.rotation.copy(it.mesh.rotation);
            fresh.visible = it.mesh.visible;
            scene.remove(it.mesh);
            scene.add(fresh);
            it.mesh = fresh;
          }
        }
      }
    }
  }
  for (const [k, uri] of Object.entries(_mcBundle.items || {})) {
    const im = new Image(); _mcPendingImgs++;
    im.onload = _onMcImgReady; im.onerror = _onMcImgReady;
    im.src = uri; _mcItemImgs.set(k, im);
  }
  for (const [k, uri] of Object.entries(_mcBundle.tex || {})) {
    const im = new Image(); _mcPendingImgs++;
    im.onload = _onMcImgReady; im.onerror = _onMcImgReady;
    im.src = uri; _mcTexImgs.set(k, im);
  }

  function initMinecraftHudSprites() {
    const hud = _mcBundle.hud || {};
    const xpWrap = document.getElementById('xpWrap');
    const xpImg = document.getElementById('xpFillImg');
    if (hud.hotbar && hotbarEl) hotbarEl.style.backgroundImage = `url("${hud.hotbar}")`;
    if (hud.xp_bg && xpWrap) xpWrap.style.backgroundImage = `url("${hud.xp_bg}")`;
    if (hud.xp_fill && xpImg) xpImg.src = hud.xp_fill;
    // Upgrade Inventory empty armor slot silhouettes to authentic Minecraft pixel outlines!
    const eqMap = { helmet: hud.slot_helmet, chest: hud.slot_chest, legs: hud.slot_legs, boots: hud.slot_boots, offhand: hud.slot_shield };
    for (const [eqKey, uri] of Object.entries(eqMap)) {
      if (!uri) continue;
      const g = document.querySelector(`.equip-slot[data-eq="${eqKey}"] .eq-ghost`);
      if (g) g.innerHTML = `<img src="${uri}" alt="" />`;
    }
    // 100% Authentic Minecraft Java Recipe Book Tabs, Search Icon, Filter Toggle & Knowledge Book!
    const rootStyle = document.documentElement.style;
    if (hud.rb_tab) rootStyle.setProperty('--rb-tab-bg', `url("${hud.rb_tab}")`);
    if (hud.rb_tab_sel) rootStyle.setProperty('--rb-tab-sel-bg', `url("${hud.rb_tab_sel}")`);
    if (hud.rb_filt_off) rootStyle.setProperty('--rb-filt-off', `url("${hud.rb_filt_off}")`);
    if (hud.rb_filt_on) rootStyle.setProperty('--rb-filt-on', `url("${hud.rb_filt_on}")`);
    if (hud.rb_btn) rootStyle.setProperty('--rb-btn-bg', `url("${hud.rb_btn}")`);
    if (hud.rb_btn_hi) rootStyle.setProperty('--rb-btn-hi', `url("${hud.rb_btn_hi}")`);
    const srchIco = document.getElementById('recipeSearchIco');
    if (srchIco && hud.rb_search) srchIco.src = hud.rb_search;

    const setTab = (cat, htmlStr) => { const el = document.querySelector(`#recipeTabs .rc-tab[data-cat="${cat}"]`); if (el) el.innerHTML = htmlStr; return el; };
    if (hud.rb_compass) setTab('all', `<img class="rc-ico-single" src="${hud.rb_compass}" alt="" />`);
    if (hud.rb_iron_axe && hud.rb_gold_sword) {
      setTab('tools', `<span class="rc-ico-dual"><img class="ico-a" src="${hud.rb_iron_axe}" alt="" /><img class="ico-b" src="${hud.rb_gold_sword}" alt="" /></span>`);
    }
    if (hud.rb_bricks) {
      const blkTab = setTab('blocks', '');
      if (blkTab) {
        const bImg = new Image();
        bImg.onload = () => {
          const iso = renderIsoCubeCanvas((c) => { c.drawImage(bImg, 0, 0, bImg.naturalWidth, bImg.naturalHeight, 0, 0, 16.35, 16.35); });
          iso.className = 'rc-ico-block';
          blkTab.innerHTML = '';
          blkTab.appendChild(iso);
        };
        bImg.src = hud.rb_bricks;
      }
    }
    if (hud.rb_lava_bkt && hud.rb_apple) {
      setTab('food', `<span class="rc-ico-dual"><img class="ico-a" src="${hud.rb_lava_bkt}" alt="" /><img class="ico-b" src="${hud.rb_apple}" alt="" /></span>`);
    }
    if (hud.rb_redstone) setTab('misc', `<img class="rc-ico-single" src="${hud.rb_redstone}" alt="" />`);
  }

  // Authentic Minecraft GUI 3D Isometric Cube Icon (Top 100%, Left 80%, Right 62% — matches vanilla Crafting Table / Planks / Sandstone!)
  function renderIsoCubeCanvas(drawFaceFn, vh = 13.4, topY = 2.6) {
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const dx = 12.2, dy = 6.1, cx = 16.0;
    // 1) Top face (bright 100%)
    c.save();
    c.setTransform(dx / 16, dy / 16, -dx / 16, dy / 16, cx, topY);
    drawFaceFn(c, 'top');
    c.restore();
    // 2) Left face (side, medium 80% shade)
    c.save();
    c.setTransform(dx / 16, dy / 16, 0, vh / 16, cx - dx, topY + dy);
    drawFaceFn(c, 'left');
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, 16.4, 16.4);
    c.restore();
    // 3) Right face (front/side, shaded 62%)
    c.save();
    c.setTransform(dx / 16, -dy / 16, 0, vh / 16, cx, topY + dy * 2);
    drawFaceFn(c, 'right');
    c.fillStyle = 'rgba(0,0,0,0.34)'; c.fillRect(0, 0, 16.4, 16.4);
    c.restore();
    return cv;
  }
  function renderIsoSlabCanvas(drawFaceFn) { return renderIsoCubeCanvas(drawFaceFn, 6.7, 9.2); }
  function renderIsoStairsCanvas(tIdx) {
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const bot = renderIsoCubeCanvas((c, face) => {
      const sx = (tIdx & 7) * TILE_PX, sy = (tIdx >> 3) * TILE_PX;
      c.drawImage(atlasCanvas, sx, sy + (face === 'top' ? 0 : 8), TILE_PX, face === 'top' ? TILE_PX : 8, 0, 0, 16.35, 16.35);
    }, 6.7, 9.3);
    const topStep = renderIsoCubeCanvas((c, face) => {
      const sx = (tIdx & 7) * TILE_PX, sy = (tIdx >> 3) * TILE_PX;
      const w = face === 'top' || face === 'right' ? 8 : 16;
      c.drawImage(atlasCanvas, sx, sy, w, face === 'top' ? 16 : 8, 0, 0, 16.35, 16.35);
    }, 6.7, 2.6);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bot, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 18, 22); ctx.clip(); ctx.drawImage(topStep, 0, 0); ctx.restore();
    return cv;
  }

  function _shadeHex(hex, mult) {
    const v = parseInt(String(hex || '#ef3333').replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, Math.round(((v >> 16) & 255) * mult)));
    const g = Math.min(255, Math.max(0, Math.round(((v >> 8) & 255) * mult)));
    const b = Math.min(255, Math.max(0, Math.round((v & 255) * mult)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function renderIsoBedCanvas(def) {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const ox = 11.8, oy = 14.4, sx = 8.4, sy = 4.2, sh = 14.0;
    const pt = (x, y, z) => [ox + (x - z) * sx, oy + (x + z) * sy - y * sh];
    const poly = (pts, fill) => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    };
    const isoBox = (x0, y0, z0, x1, y1, z1, colTop, colLeft, colRight) => {
      poly([pt(x0, y0, z1), pt(x1, y0, z1), pt(x1, y1, z1), pt(x0, y1, z1)], colLeft);
      poly([pt(x1, y0, z1), pt(x1, y0, z0), pt(x1, y1, z0), pt(x1, y1, z1)], colRight);
      poly([pt(x0, y1, z0), pt(x1, y1, z0), pt(x1, y1, z1), pt(x0, y1, z1)], colTop);
    };
    const bTop = def?.bedHex || '#ef3333';
    const bLeft = def?.bedDarkHex || _shadeHex(bTop, 0.82);
    const bRight = _shadeHex(bLeft, 0.78);
    const bFold = def?.bedLightHex || '#fecaca';
    isoBox(0.02, 0.00, 0.74, 0.28, 0.21, 0.98, '#9e6f3a', '#7c5126', '#5c3a18');
    isoBox(1.72, 0.00, 0.02, 1.98, 0.21, 0.26, '#9e6f3a', '#7c5126', '#5c3a18');
    isoBox(1.72, 0.00, 0.74, 1.98, 0.21, 0.98, '#9e6f3a', '#7c5126', '#5c3a18');
    isoBox(0.00, 0.19, 0.00, 2.00, 0.31, 1.00, '#c49557', '#a3713b', '#7a5226');
    isoBox(0.00, 0.31, 0.00, 0.64, 0.61, 1.00, '#f8fafc', '#dbe4ee', '#b6c4d4');
    isoBox(0.08, 0.61, 0.08, 0.54, 0.65, 0.92, '#ffffff', '#e2e8f0', '#cbd5e1');
    isoBox(0.64, 0.31, 0.00, 2.00, 0.58, 1.00, bTop, bLeft, bRight);
    isoBox(0.64, 0.58, 0.00, 0.80, 0.595, 1.00, bFold, '#e2e8f0', bRight);
    poly([pt(1.26, 0.582, 0.04), pt(1.36, 0.582, 0.04), pt(1.36, 0.582, 0.96), pt(1.26, 0.582, 0.96)], bLeft);
    return cv;
  }

  function getIsoBlockIcon(blockId) {
    if (_mcIsoCache.has(blockId)) return _mcIsoCache.get(blockId);
    const def0 = BLOCK_DEF[blockId];
    if (def0 && def0.bed) {
      const cv = renderIsoBedCanvas(def0);
      _mcIsoCache.set(blockId, cv);
      return cv;
    }
    if (def0 && def0.stairs && def0.tiles) {
      const cv = renderIsoStairsCanvas(def0.tiles[0]);
      _mcIsoCache.set(blockId, cv);
      return cv;
    }
    if (def0 && def0.slab && def0.tiles) {
      const tTop = def0.tiles[0], tSide = def0.tiles[1];
      const tFront = def0.frontTile !== undefined ? def0.frontTile : tSide;
      const cv = renderIsoSlabCanvas((c, face) => {
        const tIdx = face === 'top' ? tTop : (face === 'right' ? tFront : tSide);
        const sx = (tIdx & 7) * TILE_PX, sy = (tIdx >> 3) * TILE_PX;
        if (face === 'top') c.drawImage(atlasCanvas, sx, sy, TILE_PX, TILE_PX, 0, 0, 16.35, 16.35);
        else c.drawImage(atlasCanvas, sx, sy + (tTop !== tSide ? 0 : 4), TILE_PX, 8, 0, 0, 16.35, 16.35);
      });
      _mcIsoCache.set(blockId, cv);
      return cv;
    }
    const key = BLOCK_ID_TO_KEY[blockId];
    const bSpec = (!def0?.customAtlasTex && key && _mcBundle.blocks) ? _mcBundle.blocks[key] : null;
    if (bSpec && bSpec.length) {
      const topIm = _mcTexImgs.get(bSpec[0]);
      const sideIm = _mcTexImgs.get(bSpec[1] || bSpec[0]);
      const frontIm = _mcTexImgs.get(bSpec[2] || bSpec[1] || bSpec[0]);
      if (topIm && topIm.complete && topIm.naturalWidth > 0 &&
          sideIm && sideIm.complete && sideIm.naturalWidth > 0 &&
          frontIm && frontIm.complete && frontIm.naturalWidth > 0) {
        const cv = renderIsoCubeCanvas((c, face) => {
          const im = face === 'top' ? topIm : (face === 'right' ? frontIm : sideIm);
          c.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, 16.35, 16.35);
        });
        _mcIsoCache.set(blockId, cv);
        return cv;
      }
      return null;
    }
    const def = BLOCK_DEF[blockId];
    if (def && def.solid && !def.cross && !def.fence && !def.wall && !def.door && !def.trapdoor && !def.bed && !def.voxelItem && !def.dragonEgg && def.tiles) {
      const cv = renderIsoCubeCanvas((c, face) => {
        const tIdx = face === 'top' ? def.tiles[0] : (face === 'right' ? (def.frontTile !== undefined ? def.frontTile : def.tiles[1]) : def.tiles[1]);
        const sx = (tIdx & 7) * TILE_PX, sy = (tIdx >> 3) * TILE_PX;
        c.drawImage(atlasCanvas, sx, sy, TILE_PX, TILE_PX, 0, 0, 16.35, 16.35);
      });
      _mcIsoCache.set(blockId, cv);
      return cv;
    }
    return null;
  }

  function _isSpecialGlintItem(blockId) {
    const def = BLOCK_DEF[blockId];
    if (def && def.rainbow) return true;
    return blockId === B.FIRE_SWORD || blockId === B.ENCHANTED_BOOK ||
      blockId === B.DRAGON_BONE_SWORD || blockId === B.DRAGON_BONE_AXE ||
      blockId === B.DRAGON_BONE_PICK || blockId === B.DRAGON_BONE_BOW || blockId === B.SCULK_CHITIN_SWORD ||
      blockId === B.SCULK_CHITIN_PICK || blockId === B.SCULK_CHITIN_AXE || blockId === B.SCULK_ECHO_BOW ||
      blockId === B.RESONANT_SWORD || blockId === B.RESONANT_PICK || blockId === B.RESONANT_AXE ||
      blockId === B.DEEP_SONIC_BOW || blockId === B.SOULFORGED_SWORD || blockId === B.SOULFORGED_PICK ||
      blockId === B.SOULFORGED_AXE || blockId === B.SOUL_HARBINGER_BOW ||
      blockId === B.END_DRAGON_SWORD || blockId === B.END_DRAGON_PICK || blockId === B.END_DRAGON_AXE ||
      blockId === B.END_DRAGON_SHOVEL || blockId === B.END_DRAGON_HOE || blockId === B.END_DRAGON_BOW ||
      blockId === B.SOVEREIGN_KNIGHT_HELMET || blockId === B.SOVEREIGN_KNIGHT_CHEST ||
      blockId === B.SOVEREIGN_KNIGHT_LEGS || blockId === B.SOVEREIGN_KNIGHT_BOOTS;
  }
  function _apply2DEnchantSheen(c2d, W, H, isEnch, isSpecial) {
    if (!isEnch && !isSpecial) return;
    c2d.save();
    c2d.globalCompositeOperation = 'source-atop';
    const gr = c2d.createLinearGradient(0, 0, W, H);
    const a = isEnch ? 0.22 : 0.14;
    gr.addColorStop(0.0, `rgba(196, 172, 255, ${(a * 0.55).toFixed(2)})`);
    gr.addColorStop(0.45, `rgba(255, 250, 255, ${a.toFixed(2)})`);
    gr.addColorStop(1.0, `rgba(168, 210, 255, ${(a * 0.6).toFixed(2)})`);
    c2d.fillStyle = gr;
    c2d.fillRect(0, 0, W, H);
    c2d.restore();
  }
  function drawBlockPreview(c2d, blockId, meta = null) {
    const W = c2d.canvas.width, H = c2d.canvas.height;
    const def = BLOCK_DEF[blockId];
    const isEnch = !!(meta && meta.ench);
    if (c2d.canvas && c2d.canvas.classList) c2d.canvas.classList.toggle('dream-rainbow-icon', !!(def && def.rainbow) || isEnch);
    if (!def) { c2d.clearRect(0, 0, W, H); return; }
    const isPlainStatic = (!meta || (!meta.ench && !meta.trim)) && _mcPendingImgs === 0;
    if (isPlainStatic) {
      const cKey = `${W}x${H}:${blockId}`;
      const hit = _staticIconCache.get(cKey);
      if (hit) { c2d.clearRect(0, 0, W, H); c2d.drawImage(hit, 0, 0); return; }
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      _drawBlockPreviewUncached(off.getContext('2d'), blockId, null);
      _staticIconCache.set(cKey, off);
      c2d.clearRect(0, 0, W, H);
      c2d.drawImage(off, 0, 0);
      return;
    }
    _drawBlockPreviewUncached(c2d, blockId, meta);
  }
  function _drawBlockPreviewUncached(c2d, blockId, meta = null) {
    _drawBlockPreviewBody(c2d, blockId, meta);
    const isEnch = !!(meta && meta.ench);
    const isSpecial = _isSpecialGlintItem(blockId);
    if (isEnch || isSpecial) _apply2DEnchantSheen(c2d, c2d.canvas.width, c2d.canvas.height, isEnch, isSpecial);
  }
  function _drawBlockPreviewBody(c2d, blockId, meta = null) {
    const W = c2d.canvas.width, H = c2d.canvas.height;
    c2d.clearRect(0, 0, W, H);
    const def = BLOCK_DEF[blockId];
    if (!def) return;
    c2d.imageSmoothingEnabled = false;
    const key = BLOCK_ID_TO_KEY[blockId];

    if (blockId === B.DRAGON_HEAD) {
      const tx = (516 & 7) * TILE_PX, ty = (516 >> 3) * TILE_PX;
      const pad = Math.max(1, Math.round(W * 0.08));
      c2d.drawImage(atlasCanvas, tx, ty, TILE_PX, TILE_PX, pad, pad, W - pad * 2, H - pad * 2);
      return;
    }
    if (blockId === B.ELYTRA || blockId === B.ELYTRA_PHOENIX) {
      const eTile = (blockId === B.ELYTRA_PHOENIX) ? 537 : 517;
      const tx = (eTile & 7) * TILE_PX, ty = (eTile >> 3) * TILE_PX;
      const pad = Math.max(1, Math.round(W * 0.06));
      c2d.drawImage(atlasCanvas, tx, ty, TILE_PX, TILE_PX, pad, pad, W - pad * 2, H - pad * 2);
      return;
    }
    if (def.tool === 'bow' && typeof window.getBowStageSprite === 'function') {
      const sp = window.getBowStageSprite(blockId, (meta && typeof meta.bowStage === 'number') ? meta.bowStage : 0);
      const pad = Math.max(1, Math.round(W * 0.04));
      const pw = (W - pad * 2) / 16, ph = (H - pad * 2) / 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = sp.rows[y][x];
        if (ch !== '.' && sp.pal[ch]) {
          c2d.fillStyle = sp.pal[ch];
          c2d.fillRect(Math.floor(pad + x * pw), Math.floor(pad + y * ph), Math.ceil(pw), Math.ceil(ph));
        }
      }
      return;
    }
    if (blockId === B.END_ROD) {
      c2d.fillStyle = '#8f5f8f';
      c2d.fillRect(Math.round(W * 0.34), Math.round(H * 0.72), Math.round(W * 0.32), Math.round(H * 0.16));
      c2d.fillStyle = '#fdfaff';
      c2d.fillRect(Math.round(W * 0.42), Math.round(H * 0.14), Math.round(W * 0.16), Math.round(H * 0.58));
      return;
    }
    if (blockId === B.WINDMILL_HUB) {
      c2d.fillStyle = '#6f4524';
      c2d.fillRect(Math.round(W * 0.42), Math.round(H * 0.08), Math.round(W * 0.16), Math.round(H * 0.84));
      c2d.fillRect(Math.round(W * 0.08), Math.round(H * 0.42), Math.round(W * 0.84), Math.round(H * 0.16));
      c2d.fillStyle = '#f6f1e3';
      c2d.fillRect(Math.round(W * 0.56), Math.round(H * 0.10), Math.round(W * 0.20), Math.round(H * 0.30));
      c2d.fillRect(Math.round(W * 0.24), Math.round(H * 0.60), Math.round(W * 0.20), Math.round(H * 0.30));
      c2d.fillRect(Math.round(W * 0.60), Math.round(H * 0.56), Math.round(W * 0.30), Math.round(H * 0.20));
      c2d.fillRect(Math.round(W * 0.10), Math.round(H * 0.24), Math.round(W * 0.30), Math.round(H * 0.20));
      c2d.fillStyle = '#334155';
      c2d.fillRect(Math.round(W * 0.40), Math.round(H * 0.40), Math.round(W * 0.20), Math.round(H * 0.20));
      return;
    }

    // 0) Synchronized Procedural Armor Icons (guarantees 1:1 canonical silhouette + shaped Armor Trim pixel overlay!)
    if (def.armorSlot && def.armorTier && def.armorSlot !== 'offhand') {
      const aCv = getArmorIconCanvas(def.armorSlot, def.armorTier, (meta && meta.trim) ? meta.trim : null);
      if (aCv) {
        const pad = Math.max(0, Math.round(W * 0.04));
        c2d.drawImage(aCv, 0, 0, aCv.width, aCv.height, pad, pad, W - pad * 2, H - pad * 2);
        return;
      }
    }

    // 0b) Canonical Minecraft 3/4 Shield Icon matching textured Shield face + iron frame + rear handle!
    if (blockId === B.SHIELD) {
      if (!drawBlockPreview._shieldIcon) {
        const scv = document.createElement('canvas'); scv.width = 32; scv.height = 32;
        const sc = scv.getContext('2d');
        sc.imageSmoothingEnabled = false;
        const texPair = getMinecraftShieldTextures();
        const frontImg = texPair.frontTex.image;
        sc.save();
        // Slanted 3D Minecraft Shield icon with extruded metallic right edge & rear handle nub
        sc.translate(16, 16);
        sc.transform(0.86, 0.24, 0, 0.94, 0, 0);
        // Back grip nub
        sc.fillStyle = '#3b2f24'; sc.fillRect(6, -5, 4, 10);
        // Right metallic thickness strip
        sc.fillStyle = '#5a6069'; sc.fillRect(5, -13, 3, 26);
        // Main front shield face (24x44 texture scaled cleanly)
        sc.drawImage(frontImg, 0, 0, 24, 44, -8, -13, 14, 26);
        sc.restore();
        drawBlockPreview._shieldIcon = scv;
      }
      c2d.drawImage(drawBlockPreview._shieldIcon, 0, 0, 32, 32, 0, 0, W, H);
      return;
    }

    // 0c) Synchronized Hanging Lantern Icon matching 1st-Person & 3rd-Person 3D Lantern Model 1:1!
    if (blockId === B.LANTERN || blockId === B.SOUL_LANTERN) {
      const isSoulL = (blockId === B.SOUL_LANTERN);
      const cacheKey = isSoulL ? '_soulLanternIcon' : '_lanternIcon';
      if (!drawBlockPreview[cacheKey]) {
        const lcv = document.createElement('canvas'); lcv.width = 32; lcv.height = 32;
        const lc = lcv.getContext('2d');
        lc.imageSmoothingEnabled = false;
        lc.fillStyle = '#64748b'; lc.fillRect(14, 2, 4, 2);
        lc.fillStyle = '#94a3b8'; lc.fillRect(11, 4, 10, 2);
        lc.fillStyle = '#64748b'; lc.fillRect(11, 6, 2, 4); lc.fillRect(19, 6, 2, 4);
        lc.fillStyle = '#3b4657'; lc.fillRect(9, 10, 14, 3);
        lc.fillStyle = '#64748b'; lc.fillRect(10, 10, 12, 1);
        lc.fillStyle = '#2d3542'; lc.fillRect(6, 13, 20, 3);
        lc.fillStyle = isSoulL ? '#0284c7' : '#d97706'; lc.fillRect(8, 16, 16, 11);
        lc.fillStyle = isSoulL ? '#22d3ee' : '#fbbf24'; lc.fillRect(10, 17, 12, 9);
        lc.fillStyle = isSoulL ? '#ecfeff' : '#fef9c3'; lc.fillRect(13, 19, 6, 5);
        lc.fillStyle = '#1e242d'; lc.fillRect(7, 16, 2, 11); lc.fillRect(23, 16, 2, 11);
        lc.fillStyle = '#262d38'; lc.fillRect(6, 27, 20, 3);
        lc.fillStyle = '#3b4657'; lc.fillRect(7, 27, 18, 1);
        drawBlockPreview[cacheKey] = lcv;
      }
      c2d.drawImage(drawBlockPreview[cacheKey], 0, 0, 32, 32, 0, 0, W, H);
      return;
    }

    // 0d) Sculpted Golden Totem of Undying Icon matching 1st-Person, Offhand & 3rd-Person 3D Model 1:1!
    if (blockId === B.TOTEM_UNDYING) {
      if (!drawBlockPreview._totemIcon) {
        const tcv = document.createElement('canvas'); tcv.width = 32; tcv.height = 32;
        const tc = tcv.getContext('2d');
        tc.imageSmoothingEnabled = false;
        const px = (x, y, w, h, col) => { tc.fillStyle = col; tc.fillRect(x, y, w, h); };
        // Bright pale-gold outer rim matching Image 1
        px(9, 2, 14, 15, '#ffef9c');
        px(1, 9, 9, 5, '#ffef9c'); px(3, 14, 7, 6, '#ffef9c');
        px(22, 9, 9, 5, '#ffef9c'); px(22, 14, 7, 6, '#ffef9c');
        px(9, 17, 14, 6, '#ffef9c');
        px(11, 23, 10, 7, '#ffef9c');
        // Head block (x=10..21, y=3..15)
        px(10, 3, 12, 13, '#f8c64b');
        px(10, 3, 2, 2, '#df9b2e'); px(20, 3, 2, 2, '#df9b2e'); // ear corners
        px(14, 3, 4, 2, '#fff098'); // top crown highlight
        px(11, 5, 10, 2, '#d58a22'); // illager brow
        px(10, 12, 3, 3, '#ebb03c'); px(19, 12, 3, 3, '#ebb03c'); // cheek shading
        px(11, 14, 3, 2, '#fff098'); px(18, 13, 3, 2, '#df972b');
        // Left & Right 2x2 eyes (white top-left + emerald green!)
        px(10, 7, 2, 2, '#ffffff'); px(12, 7, 2, 2, '#00d252');
        px(10, 9, 2, 2, '#00c44b'); px(12, 9, 2, 2, '#008a36');
        px(18, 7, 2, 2, '#ffffff'); px(20, 7, 2, 2, '#00d252');
        px(18, 9, 2, 2, '#00c44b'); px(20, 9, 2, 2, '#008a36');
        // Left stepped tilted wing (x=2..9)
        px(2, 10, 8, 3, '#f8c64b'); px(4, 10, 4, 1, '#ffe980'); px(3, 11, 2, 1, '#dc9128');
        px(4, 13, 6, 6, '#f8c64b'); px(4, 13, 6, 1, '#e09a2d'); px(4, 15, 6, 1, '#fff098'); px(4, 17, 6, 2, '#ebb03c');
        // Right stepped tilted wing (x=22..29)
        px(22, 10, 8, 3, '#f8c64b'); px(24, 10, 4, 1, '#ffe980'); px(27, 11, 2, 1, '#dc9128');
        px(22, 13, 6, 6, '#f8c64b'); px(22, 13, 6, 1, '#e09a2d'); px(22, 15, 6, 1, '#fff098'); px(22, 17, 6, 2, '#ebb03c');
        // Torso chest (x=10..21, y=16..22) + protruding villager nose (x=14..17, y=9..18)
        px(10, 16, 12, 6, '#f8c64b');
        px(10, 16, 4, 3, '#fff098'); px(18, 17, 4, 4, '#e19b2e'); px(11, 20, 10, 2, '#d68c22');
        px(14, 9, 2, 9, '#ffeb84'); px(16, 9, 2, 9, '#f0b63e'); px(15, 17, 3, 2, '#df972b');
        // Narrower pedestal base (x=12..19, y=23..28)
        px(12, 23, 8, 6, '#f8c64b');
        px(13, 24, 6, 4, '#df972b'); px(14, 24, 4, 2, '#d38820');
        drawBlockPreview._totemIcon = tcv;
      }
      c2d.drawImage(drawBlockPreview._totemIcon, 0, 0, 32, 32, 0, 0, W, H);
      return;
    }

    // 0e) Isometric Minecraft Cactus Block Icon matching reference (14/16 fluted column + protruding edge spines!)
    if (blockId === B.CACTUS) {
      if (!drawBlockPreview._cactusIcon) {
        const ccv = document.createElement('canvas'); ccv.width = 32; ccv.height = 32;
        const cc = ccv.getContext('2d');
        cc.imageSmoothingEnabled = false;
        const isoC = renderIsoCubeCanvas((c, face) => {
          const tile = (face === 'top') ? 184 : 17;
          const sx = (tile & 7) * TILE_PX, sy = (tile >> 3) * TILE_PX;
          c.drawImage(atlasCanvas, sx, sy, TILE_PX, TILE_PX, 0, 0, 16.35, 16.35);
        }, 12.6, 3.4);
        cc.drawImage(isoC, 0, 0, 32, 32, 2, 1, 28, 30);
        // Protruding 3D pixel spine clusters on outer silhouette edges & fluted front corner matching d77e060b.png
        const sp = [
          [2, 9, '#3e7f2c'], [3, 9, '#d8ecc4'], [2, 15, '#1b4719'], [3, 15, '#d8ecc4'], [2, 21, '#265c20'], [3, 21, '#dfefc9'],
          [28, 12, '#3e7f2c'], [27, 12, '#d8ecc4'], [29, 17, '#1b4719'], [28, 17, '#dfefc9'], [27, 23, '#3e7f2c'], [26, 23, '#d8ecc4'],
          [14, 15, '#183615'], [15, 15, '#e2f2cd'], [16, 15, '#3b7d29'],
          [14, 21, '#183615'], [15, 21, '#e2f2cd'], [16, 21, '#dfefc9'], [15, 26, '#d8ecc4'],
          [9, 19, '#dfefc9'], [21, 13, '#dfefc9'], [22, 19, '#d8ecc4'], [9, 13, '#d8ecc4']
        ];
        for (const [sx, sy, col] of sp) { cc.fillStyle = col; cc.fillRect(sx, sy, 1, 1); }
        drawBlockPreview._cactusIcon = ccv;
      }
      c2d.drawImage(drawBlockPreview._cactusIcon, 0, 0, 32, 32, 0, 0, W, H);
      return;
    }

    // 1) Official Minecraft 1.21.1 16x16 Flat Item Texture (skip storage chests & custom-textured blocks so they always show isometric 3D block icons!)
    const itemIm = (key && !def.chest && !def.customAtlasTex) ? _mcItemImgs.get(key) : null;
    if (itemIm && itemIm.complete && itemIm.naturalWidth > 0) {
      const pad = Math.max(0, Math.round(W * 0.03));
      c2d.drawImage(itemIm, 0, 0, itemIm.naturalWidth, itemIm.naturalHeight, pad, pad, W - pad * 2, H - pad * 2);
      return;
    }

    // 2) Authentic Minecraft 3D Isometric Block Cube (Planks, Crafting Table, Furnace, Sandstone, Ores, TNT, etc.!)
    const iso = getIsoBlockIcon(blockId);
    if (iso) {
      c2d.drawImage(iso, 0, 0, iso.width, iso.height, 0, 0, W, H);
      return;
    }

    // 3) Procedural fallback for fences, walls & special NUCRAFT items (Shield, Bed, Coconut Drink)
    if (!def.tiles) return;
    const tile = def.itemTile !== undefined ? def.itemTile : def.tiles[1];
    const sx = (tile & 7) * TILE_PX, sy = (tile >> 3) * TILE_PX;
    if (def.fence) {
      c2d.drawImage(atlasCanvas, sx + 5, sy, 6, 16, Math.round(W * 0.14), Math.round(H * 0.10), Math.round(W * 0.22), Math.round(H * 0.80));
      c2d.drawImage(atlasCanvas, sx + 5, sy, 6, 16, Math.round(W * 0.64), Math.round(H * 0.10), Math.round(W * 0.22), Math.round(H * 0.80));
      c2d.drawImage(atlasCanvas, sx, sy + 5, 16, 4, Math.round(W * 0.12), Math.round(H * 0.28), Math.round(W * 0.76), Math.round(H * 0.14));
      c2d.drawImage(atlasCanvas, sx, sy + 9, 16, 4, Math.round(W * 0.12), Math.round(H * 0.56), Math.round(W * 0.76), Math.round(H * 0.14));
      return;
    }
    if (def.stalactite) {
      c2d.drawImage(atlasCanvas, sx + 4, sy, 8, 16, Math.round(W * 0.28), Math.round(H * 0.08), Math.round(W * 0.44), Math.round(H * 0.84));
      return;
    }
    if (def.wall) {
      c2d.drawImage(atlasCanvas, sx + 3, sy, 10, 16, Math.round(W * 0.30), Math.round(H * 0.12), Math.round(W * 0.40), Math.round(H * 0.78));
      c2d.drawImage(atlasCanvas, sx, sy + 4, 16, 12, Math.round(W * 0.10), Math.round(H * 0.30), Math.round(W * 0.80), Math.round(H * 0.60));
      return;
    }
    c2d.drawImage(atlasCanvas, sx, sy, TILE_PX, TILE_PX, 1, 1, W - 2, H - 2);
  }

  function initHotbarDOM() {
    initMinecraftHudSprites();
    const selUri = (_mcBundle.hud && _mcBundle.hud.hotbar_sel) ? _mcBundle.hud.hotbar_sel : '';
    hotbarEl.innerHTML = ''; slotIcons.length = 0;
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div'); slot.className = 'hb-slot';
      const sel = document.createElement('div'); sel.className = 'hb-sel';
      if (selUri) sel.style.backgroundImage = `url("${selUri}")`;
      const ic = document.createElement('canvas'); ic.width = 32; ic.height = 32;
      const cnt = document.createElement('span'); cnt.className = 'slot-count';
      const dur = document.createElement('div'); dur.className = 'slot-dur'; dur.style.display = 'none'; dur.innerHTML = '<div class="slot-dur-fill"></div>';
      slot.append(sel, ic, cnt, dur);
      slot.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); selectHotbarSlot(i); }, { passive: false });
      slot.addEventListener('click', (e) => { e.stopPropagation(); selectHotbarSlot(i); });
      hotbarEl.appendChild(slot); slotIcons.push({ slot, ctx: ic.getContext('2d'), cnt, dur, durFill: dur.firstElementChild });
    }
    const dock = document.getElementById('hotbarDock');
    let bagSlot = document.getElementById('btnBag');
    if (bagSlot) bagSlot.remove();
    bagSlot = document.createElement('div'); bagSlot.id = 'btnBag';
    bagSlot.title = 'Balo (E)'; bagSlot.innerHTML = '<span class="slot-dots">...</span>';
    bagSlot.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); ensureAudio(); openInventoryModal(); }, { passive: false });
    bagSlot.addEventListener('click', (e) => { e.stopPropagation(); ensureAudio(); openInventoryModal(); });
    (dock || hotbarEl).appendChild(bagSlot);
  }

  function _syncSelectedHotbarHUD() {
    syncSpyglassZoomState();
    const sel = inventory[player.selectedSlot], def = (sel && sel.count > 0) ? BLOCK_DEF[sel.id] : null;
    const _lblEl = document.getElementById('itemLabel');
    if (player._lastLabelSlot === undefined) {
      player._lastLabelSlot = player.selectedSlot;
      if (_lblEl) _lblEl.textContent = '';
    } else if (player._lastLabelSlot !== player.selectedSlot) {
      player._lastLabelSlot = player.selectedSlot;
      if (_lblEl) _lblEl.textContent = def ? (((typeof getLocalizedBlockName === 'function') ? getLocalizedBlockName(sel.id) : def.name) + (sel && sel.ench ? ' ✦' : '')) : '';
      player.itemLabelT = 2.0;
    }
    const _vmMeta = (sel && sel.count > 0)
      ? ((sel.id === B.FISHING_ROD && typeof isFishingRodCast === 'function' && isFishingRodCast()) ? { ...sel, rodCast: true } : sel)
      : null;
    updateHeldViewModel(sel && sel.count > 0 ? sel.id : B.AIR, _vmMeta);
  }
  function selectHotbarSlot(idx) {
    if (idx < 0 || idx > 8) return;
    const prev = player.selectedSlot;
    if (prev !== idx) {
      if (typeof cancelFishingCast === 'function' && inventory[idx]?.id !== B.FISHING_ROD) cancelFishingCast(true);
      player.selectedSlot = idx;
      if (slotIcons[prev]?.slot) slotIcons[prev].slot.classList.remove('active');
      if (slotIcons[idx]?.slot) slotIcons[idx].slot.classList.add('active');
      if (typeof playItemSwitchSfx === 'function') playItemSwitchSfx(inventory[idx]?.id || 0);
    }
    _syncSelectedHotbarHUD();
  }

  const _EQ_EMPTY_TIP = { helmet: 'Mũ', chest: 'Áo', legs: 'Quần', boots: 'Giày', offhand: 'Tay trái' };
  const _ROMAN_LV = ['', 'I', 'II', 'III'];
  function shortItemTip(id, meta = null) {
    const raw = BLOCK_DEF[id]?.name || '';
    let base = raw.replace(/\s*\((?!\+\d+|Cấp \d+|\d+ Ô|\d+s\))[^)]*\)/g, '').trim();
    if (meta && meta.trim) base += ` [Trim: ${meta.trim.pattern}/${meta.trim.label}]`;
    if (meta && meta.luck > 0) base += ` [May Mắn ${_ROMAN_LV[meta.luck] || meta.luck}]`;
    if (meta && meta.lure > 0) base += ` [Nhử Mồi ${_ROMAN_LV[meta.lure] || meta.lure}]`;
    if (meta && meta.ench) base += ' ✦';
    return base;
  }

  function syncSpyglassZoomState() {
    if (!player.spyglassZoom) return;
    const sel = inventory[player.selectedSlot];
    const selDef = (sel && sel.count > 0) ? BLOCK_DEF[sel.id] : null;
    if (!selDef || !selDef.spyglass || player.dead) {
      player.spyglassZoom = false;
      camera.fov = 74;
      camera.updateProjectionMatrix();
    }
  }
  function renderHotbar() {
    for (let i = 0; i < 9; i++) {
      const item = inventory[i], ui = slotIcons[i];
      if (!ui) continue;
      ui.slot.classList.toggle('active', i === player.selectedSlot);
      const sig = _slotItemVisualSig(item);
      if (ui.sig !== sig) {
        ui.sig = sig;
        delete ui.slot.dataset.mcTip;
        ui.slot.title = item.count > 0 ? shortItemTip(item.id, item) : '';
        if (item.count > 0) {
          drawBlockPreview(ui.ctx, item.id, item);
        } else {
          ui.ctx.clearRect(0, 0, 32, 32);
          ui.ctx.canvas.classList.remove('dream-rainbow-icon');
        }
      }
      if (item.count > 0) {
        const wantCnt = item.count > 1 ? String(item.count) : '';
        if (ui.cnt.textContent !== wantCnt) ui.cnt.textContent = wantCnt;
        if (item.maxDur > 0 && item.dur < item.maxDur) {
          ui.dur.style.display = 'block';
          const pct = Math.max(0, Math.min(100, (item.dur / item.maxDur) * 100));
          ui.durFill.style.width = `${pct.toFixed(0)}%`;
          ui.durFill.style.background = pct > 60 ? '#00ff00' : (pct > 30 ? '#ffff00' : (pct > 15 ? '#ff7700' : '#ff0000'));
        } else ui.dur.style.display = 'none';
      } else {
        if (ui.cnt.textContent !== '') ui.cnt.textContent = '';
        ui.dur.style.display = 'none';
      }
    }
    _syncSelectedHotbarHUD();
  }

  const manualCraftGrid = new Int16Array(9);
  const _grid2Idx = [0, 1, 3, 4];
  function hasManualCraftItems() {
    for (let i = 0; i < 9; i++) if (manualCraftGrid[i] > 0) return true;
    return false;
  }
  function refundManualCraftGrid() {
    let refunded = false;
    for (let i = 0; i < 9; i++) {
      if (manualCraftGrid[i] > 0) {
        addItemToInventory(manualCraftGrid[i], 1);
        manualCraftGrid[i] = 0;
        refunded = true;
      }
    }
    if (refunded && typeof renderHotbar === 'function') renderHotbar();
    return refunded;
  }
  function matchManualCraftGrid() {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      if (manualCraftGrid[i] > 0) pts.push([(i / 3) | 0, i % 3, manualCraftGrid[i]]);
    }
    if (!pts.length) return null;
    const pMinR = Math.min(...pts.map(x => x[0])), pMinC = Math.min(...pts.map(x => x[1])), pMaxC = Math.max(...pts.map(x => x[1]));
    for (const r of RECIPES) {
      if (invMode === 'backpack' && !r.is2x2) continue;
      const rPts = [];
      for (let i = 0; i < 9; i++) if (r.grid[i]) rPts.push([(i / 3) | 0, i % 3, r.grid[i]]);
      if (rPts.length !== pts.length) continue;
      const rMinR = Math.min(...rPts.map(x => x[0])), rMinC = Math.min(...rPts.map(x => x[1]));
      const allowLog = r.req.some(q => q.anyLog);
      const allowCoal = r.req.some(q => q.anyCoal);
      const allowPlanks = r.req.some(q => q.anyPlanks);
      const matMatch = (pb, rb) => pb === rb || (allowLog && BLOCK_DEF[pb]?.isLog) || (allowCoal && BLOCK_DEF[pb]?.isCoal && BLOCK_DEF[rb]?.isCoal) || (allowPlanks && BLOCK_DEF[pb]?.isPlanks && BLOCK_DEF[rb]?.isPlanks);
      let ok = true;
      for (let k = 0; k < pts.length; k++) {
        const [pr, pc, pb] = pts[k], [rr, rc, rb] = rPts[k];
        if ((pr - pMinR) !== (rr - rMinR) || (pc - pMinC) !== (rc - rMinC) || !matMatch(pb, rb)) {
          ok = false; break;
        }
      }
      if (ok) return r;
      // Horizontal mirror check (so both `/` and `\` diagonals craft Shears in 2x2 & 3x3!)
      const mPts = pts.map(([pr, pc, pb]) => [pr - pMinR, pMaxC - pc, pb]);
      let okMirror = true;
      for (let k = 0; k < rPts.length; k++) {
        const rr = rPts[k][0] - rMinR, rc = rPts[k][1] - rMinC, rb = rPts[k][2];
        const hit = mPts.find(([mr, mc, mb]) => mr === rr && mc === rc && matMatch(mb, rb));
        if (!hit) { okMirror = false; break; }
      }
      if (okMirror) return r;
      // Vertical flip check for End Crystal 3x3 (supports Ghast Tear in either bottom-center [Image 1] or top-center!)
      if (r.out === B.END_CRYSTAL_BLOCK) {
        const pMaxR = Math.max(...pts.map(x => x[0]));
        const vPts = pts.map(([pr, pc, pb]) => [pMaxR - pr, pc - pMinC, pb]);
        let okV = true;
        for (let k = 0; k < rPts.length; k++) {
          const rr = rPts[k][0] - rMinR, rc = rPts[k][1] - rMinC, rb = rPts[k][2];
          if (!vPts.some(([vr, vc, vb]) => vr === rr && vc === rc && matMatch(vb, rb))) { okV = false; break; }
        }
        if (okV) return r;
      }
    }
    // Shapeless fallback (e.g., Blaze Rod -> Blaze Powder, Ender Pearl + Blaze Powder -> Eye of Ender in any 2 slots)
    for (const r of RECIPES) {
      if (invMode === 'backpack' && !r.is2x2) continue;
      const totalReq = r.req.reduce((s, q) => s + q.qty, 0);
      if (totalReq !== pts.length) continue;
      if (!(r.shapeless || totalReq === 1 || r.out === B.ENDER_EYE || r.out === B.FLINT_AND_STEEL || r.out === B.SOUL_FLINT_AND_STEEL || r.out === B.MOSS_BLOCK)) continue;
      const bag = new Map();
      let logs = 0, coals = 0, planks = 0;
      for (const [, , pb] of pts) {
        if (BLOCK_DEF[pb]?.isLog) logs++;
        if (BLOCK_DEF[pb]?.isCoal) coals++;
        if (BLOCK_DEF[pb]?.isPlanks) planks++;
        bag.set(pb, (bag.get(pb) || 0) + 1);
      }
      let ok = true;
      for (const req of r.req) {
        if (req.anyLog) { if (logs < req.qty) { ok = false; break; } logs -= req.qty; }
        else if (req.anyCoal) { if (coals < req.qty) { ok = false; break; } coals -= req.qty; }
        else if (req.anyPlanks) { if (planks < req.qty) { ok = false; break; } planks -= req.qty; }
        else { const hv = bag.get(req.id) || 0; if (hv !== req.qty) { ok = false; break; } bag.delete(req.id); }
      }
      const wildRem = (r.req.some(q => q.anyLog) && logs === 0) || (r.req.some(q => q.anyCoal) && coals === 0) || (r.req.some(q => q.anyPlanks) && planks === 0);
      if (ok && (bag.size === 0 || wildRem)) return r;
    }
    return null;
  }

  let invMode = 'backpack'; // 'backpack' (2x2 + 3D player box) OR 'table' (3x3 Crafting Table!)
  function handleCraftSlotTap(gIdx) {
    if (creativePickId > 0) {
      if (manualCraftGrid[gIdx] > 0 && gameMode !== 'creative') addItemToInventory(manualCraftGrid[gIdx], 1);
      manualCraftGrid[gIdx] = creativePickId;
      creativePickId = 0; selectedRecipe = null;
      playSfx('pickup'); renderInventoryModal(); renderHotbar();
      return;
    }
    if (manualCraftGrid[gIdx] > 0) {
      addItemToInventory(manualCraftGrid[gIdx], 1);
      manualCraftGrid[gIdx] = 0;
      renderInventoryModal(); renderHotbar();
      return;
    }
    if (swapIdx >= 0 && inventory[swapIdx] && inventory[swapIdx].count > 0) {
      const it = inventory[swapIdx];
      manualCraftGrid[gIdx] = it.id;
      it.count--;
      if (it.count <= 0) { it.id = 0; it.dur = 0; it.maxDur = 0; swapIdx = -1; }
      selectedRecipe = null;
      playSfx('pickup'); renderInventoryModal(); renderHotbar();
      return;
    }
  }
  function _ensureCraftSlotsDOM() {
    if (_craftSlotUI3) return;
    const gridEl3 = document.getElementById('craftGrid3x3'), outEl3 = document.getElementById('craftOutputSlot');
    const gridEl2 = document.getElementById('craftGrid2x2'), outEl2 = document.getElementById('craftOutputSlot2x2');
    const mkCell = (gIdx, cvSize) => {
      const div = document.createElement('div');
      div.className = 'slot inv-slot-touch';
      div.dataset.craftIdx = String(gIdx);
      const cv = document.createElement('canvas'); cv.width = cvSize; cv.height = cvSize;
      div.appendChild(cv);
      div.addEventListener('pointerdown', (e) => {
        startInvDrag(e, 'craft', { idx: gIdx, originEl: div });
      });
      div.addEventListener('click', () => {
        if (invDrag.suppressClick) return;
        handleCraftSlotTap(gIdx);
      });
      return { gIdx, div, cv, ctx: cv.getContext('2d'), sig: '' };
    };
    const mkOut = (el, cvSize) => {
      if (!el) return null;
      el.innerHTML = '';
      const cv = document.createElement('canvas'); cv.width = cvSize; cv.height = cvSize;
      const cnt = document.createElement('span'); cnt.className = 'slot-count';
      el.append(cv, cnt);
      return { el, cv, ctx: cv.getContext('2d'), cnt, sig: '' };
    };
    gridEl3.innerHTML = '';
    _craftSlotUI3 = [];
    for (let i = 0; i < 9; i++) {
      const ui = mkCell(i, 30);
      gridEl3.appendChild(ui.div);
      _craftSlotUI3.push(ui);
    }
    _craftSlotUI2 = [];
    if (gridEl2) {
      gridEl2.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const ui = mkCell(_grid2Idx[i], 30);
        gridEl2.appendChild(ui.div);
        _craftSlotUI2.push(ui);
      }
    }
    _craftOutUI3 = mkOut(outEl3, 34);
    _craftOutUI2 = mkOut(outEl2, 30);
  }
  function renderCrafting3x3() {
    _ensureCraftSlotsDOM();
    const is2x2 = (invMode === 'backpack');
    const hasManual = hasManualCraftItems();
    const manualRec = hasManual ? matchManualCraftGrid() : null;
    const pat = selectedRecipe ? selectedRecipe.grid : [0,0,0,0,0,0,0,0,0];
    let pat2 = [0, 0, 0, 0];
    if (!hasManual && selectedRecipe) {
      if (selectedRecipe.is2x2) {
        const nz = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (pat[r * 3 + c]) nz.push([r, c, pat[r * 3 + c]]);
        if (nz.length) {
          const minR = Math.min(...nz.map(x => x[0])), minC = Math.min(...nz.map(x => x[1]));
          for (const [r, c, bid] of nz) {
            const nr = r - minR, nc = c - minC;
            if (nr < 2 && nc < 2) pat2[nr * 2 + nc] = bid;
          }
        }
      } else {
        pat2 = [pat[0] || pat[1], pat[2] || pat[4], pat[3] || pat[6], pat[7] || pat[8]];
      }
    }
    const needTable = !!(selectedRecipe && is2x2 && !selectedRecipe.is2x2);
    const makeAvailChecker = () => {
      const remMat = new Map();
      let remAnyLog = 0, remAnyCoal = 0, remAnyPlanks = 0;
      if (!hasManual && selectedRecipe) {
        for (const req of selectedRecipe.req) {
          if (req.anyLog) remAnyLog = countAnyLog();
          else if (req.anyCoal) remAnyCoal = countAnyCoal();
          else if (req.anyPlanks) remAnyPlanks = countAnyPlanks();
          else remMat.set(req.id, countItem(req.id));
        }
      }
      return (bid) => {
        if (!bid || hasManual || !selectedRecipe) return true;
        if (needTable) return false;
        if (BLOCK_DEF[bid]?.isLog && selectedRecipe.req.some(q => q.anyLog)) {
          if (remAnyLog > 0) { remAnyLog--; return true; }
          return false;
        }
        if (BLOCK_DEF[bid]?.isCoal && selectedRecipe.req.some(q => q.anyCoal)) {
          if (remAnyCoal > 0) { remAnyCoal--; return true; }
          return false;
        }
        if (BLOCK_DEF[bid]?.isPlanks && selectedRecipe.req.some(q => q.anyPlanks)) {
          if (remAnyPlanks > 0) { remAnyPlanks--; return true; }
          return false;
        }
        const hv = remMat.get(bid) || 0;
        if (hv > 0) { remMat.set(bid, hv - 1); return true; }
        return false;
      };
    };
    const syncCell = (ui, previewBid, isAvail) => {
      const placedId = manualCraftGrid[ui.gIdx];
      const isGhost = placedId <= 0 && !hasManual && previewBid > 0;
      const showId = placedId > 0 ? placedId : (hasManual ? 0 : previewBid);
      ui.div.classList.toggle('mc-ghost-miss', isGhost && !isAvail);
      ui.cv.style.opacity = isGhost ? '0.82' : '1';
      const sig = `${showId}:${isGhost ? 1 : 0}`;
      if (ui.sig !== sig) {
        ui.sig = sig;
        delete ui.div.dataset.mcTip;
        ui.div.title = showId > 0 ? shortItemTip(showId) : '';
        if (showId > 0) drawBlockPreview(ui.ctx, showId);
        else { ui.ctx.clearRect(0, 0, ui.cv.width, ui.cv.height); ui.cv.classList.remove('dream-rainbow-icon'); }
      }
    };
    const chk3 = makeAvailChecker();
    for (let i = 0; i < 9; i++) syncCell(_craftSlotUI3[i], pat[i], chk3(pat[i]));
    if (_craftSlotUI2.length) {
      const chk2 = makeAvailChecker();
      for (let i = 0; i < 4; i++) syncCell(_craftSlotUI2[i], pat2[i], chk2(pat2[i]));
    }
    const syncOut = (outUI, rec, ok) => {
      if (!outUI) return;
      outUI.el.classList.toggle('mc-ghost-miss', !!(rec && !ok));
      outUI.cv.style.opacity = (rec && !ok) ? '0.78' : '1';
      const outId = rec ? rec.out : 0, outQty = rec ? rec.qty : 0;
      const sig = `${outId}:${outQty}`;
      if (outUI.sig !== sig) {
        outUI.sig = sig;
        delete outUI.el.dataset.mcTip;
        outUI.el.title = outId > 0 ? (outQty > 1 ? `${outQty}x ${shortItemTip(outId)}` : shortItemTip(outId)) : '';
        outUI.cnt.textContent = outQty > 1 ? String(outQty) : '';
        if (outId > 0) drawBlockPreview(outUI.ctx, outId);
        else { outUI.ctx.clearRect(0, 0, outUI.cv.width, outUI.cv.height); outUI.cv.classList.remove('dream-rainbow-icon'); }
      }
    };
    let activeRec = null, activeOk = true;
    if (hasManual) {
      activeRec = manualRec;
      activeOk = !!manualRec;
    } else if (selectedRecipe) {
      activeRec = selectedRecipe;
      activeOk = canCraftRecipe(selectedRecipe) && !needTable;
    }
    syncOut(_craftOutUI2, is2x2 ? activeRec : null, activeOk);
    syncOut(_craftOutUI3, !is2x2 ? activeRec : null, activeOk);
  }
  function doCraftSelected() {
    const _t = (v, e) => (typeof tr === 'function' ? tr(v, e) : v);
    const _bName = (id) => (typeof getLocalizedBlockName === 'function' ? getLocalizedBlockName(id) : BLOCK_DEF[id].name);
    if (hasManualCraftItems()) {
      const mRec = matchManualCraftGrid();
      if (!mRec) { showToast(_t('❌ Công thức đặt trong ô chế tạo chưa khớp!', '❌ Recipe in crafting grid does not match!')); return; }
      for (let i = 0; i < 9; i++) manualCraftGrid[i] = 0;
      addItemToInventory(mRec.out, mRec.qty); playSfx('craft');
      showToast(`${_t('Đã chế tạo', 'Crafted')} ${mRec.qty}x ${_bName(mRec.out)}`);
      renderInventoryModal(); renderHotbar();
      return;
    }
    if (!selectedRecipe) return;
    if (invMode === 'backpack' && !selectedRecipe.is2x2) { showToast(_t('🪵 Công thức này cần đặt Bàn Chế Tạo (3×3) để chế!', '🪵 Place a Crafting Table (3×3) to craft this recipe!')); return; }
    if (!canCraftRecipe(selectedRecipe)) { showToast(_t('Chưa đủ nguyên liệu chế tạo!', 'Not enough materials to craft!')); return; }
    for (const req of selectedRecipe.req) consumeItem(req.id, req.qty, !!req.anyLog, !!req.anyCoal, !!req.anyPlanks);
    addItemToInventory(selectedRecipe.out, selectedRecipe.qty); playSfx('craft');
    showToast(`${_t('Đã chế tạo', 'Crafted')} ${selectedRecipe.qty}x ${_bName(selectedRecipe.out)}`);
    renderInventoryModal(); renderHotbar();
  }
  document.getElementById('craftOutputSlot').addEventListener('click', doCraftSelected);
  document.getElementById('craftOutputSlot2x2').addEventListener('click', doCraftSelected);
  document.getElementById('btnToggleBook2x2').addEventListener('click', () => { const rb = document.getElementById('recipeBookWrap'); rb.style.display = (rb.style.display === 'none') ? 'flex' : 'none'; requestAnimationFrame(updateMobileUiScale); });

  function getCreativeItemCategory(id, def) {
    if (!def) return 'misc';
    if (def.tool || def.armorSlot || def.dragonArmorSlot || id === B.ARROW || id === B.SHIELD || id === B.TOTEM_UNDYING || id === B.SWIFT_SNEAK_BOOK || id === B.SNOWBALL || id === B.DRAGON_SADDLE) return 'tools';
    if (def.food || def.cross || def.cropStage !== undefined || id === B.WHEAT_SEEDS || id === B.WHEAT || id === B.MELON_SLICE || id === B.APPLE || id === B.GOLD_APPLE || id === B.NIGHT_VISION_POTION) return 'food';
    if (def.solid && !def.light && !def.furnaceType && !def.chest && !def.door && !def.trapdoor && !def.bed && id !== B.TNT && id !== B.CRAFT_TABLE && id !== B.ENCHANT_TABLE && id !== B.ANVIL && id !== B.SMITHING_TABLE) return 'blocks';
    return 'misc';
  }

  function handleInvSlotTap(idx, e = null) {
    const s = inventory[idx];
    if (!s) return;
    // Left Creative item picked -> click any Right slot to place it cleanly!
    if (creativePickId > 0) {
      const cDef = BLOCK_DEF[creativePickId];
      const cQty = (cDef?.tool || cDef?.armorSlot || cDef?.dragonArmorSlot || creativePickId === B.SHIELD) ? 1 : 99;
      setSlotItem(idx, creativePickId, cQty);
      creativePickId = 0; swapIdx = -1; selectedEquipSlot = null;
      playSfx('pickup'); renderInventoryModal(); renderHotbar();
      return;
    }
    // Shift + Click quick-equips armor/shield or transfers between Hotbar & Backpack!
    if (e && e.shiftKey && s.count > 0) {
      const autoEq = getAutoEquipSlotForItem(s.id);
      if (autoEq) { equipItemToSlot(autoEq, idx); swapIdx = -1; renderInventoryModal(); renderHotbar(); return; }
      const rStart = idx < 9 ? 9 : 0, rEnd = idx < 9 ? 36 : 9;
      const isTool = !!(BLOCK_DEF[s.id] && BLOCK_DEF[s.id].tool) || !!s.ench || !!s.trim;
      for (let ti = rStart; ti < rEnd && s.count > 0; ti++) {
        const dst = inventory[ti];
        if (dst.id === s.id && dst.count > 0 && !isTool && !dst.ench && !dst.trim && dst.count < 99) {
          const mv = Math.min(99 - dst.count, s.count); dst.count += mv; s.count -= mv;
          if (s.count <= 0) { s.id = 0; s.dur = 0; s.maxDur = 0; s.ench = false; s.trim = null; }
        }
      }
      if (s.count > 0) {
        for (let ti = rStart; ti < rEnd; ti++) {
          if (inventory[ti].count <= 0) {
            inventory[ti] = { id: s.id, count: s.count, dur: s.dur, maxDur: s.maxDur, ench: !!s.ench, trim: s.trim ? { ...s.trim } : null };
            inventory[idx] = { id: 0, count: 0, dur: 0, maxDur: 0, ench: false, trim: null };
            break;
          }
        }
      }
      swapIdx = -1; playSfx('pickup'); renderInventoryModal(); renderHotbar();
      return;
    }
    // Nếu đang chọn sẵn một ô giáp bên trên rồi bấm vào giáp khớp loại trong Balo -> trang bị ngay!
    if (selectedEquipSlot) {
      if (s.count > 0 && getAutoEquipSlotForItem(s.id, selectedEquipSlot) === selectedEquipSlot) {
        equipItemToSlot(selectedEquipSlot, idx);
        selectedEquipSlot = null; swapIdx = -1;
        renderInventoryModal(); renderHotbar();
        return;
      }
      selectedEquipSlot = null;
      renderEquipmentUI();
    }
    if (swapIdx === -1) {
      if (s.count > 0) {
        swapIdx = idx;
        syncInvSlotsUI();
      }
    } else if (swapIdx === idx) {
      swapIdx = -1;
      syncInvSlotsUI();
    } else {
      const a = inventory[swapIdx], b = inventory[idx];
      if (a.id === b.id && b.count > 0 && !(BLOCK_DEF[a.id] && BLOCK_DEF[a.id].tool) && !a.ench && !b.ench && !a.trim && !b.trim) {
        const mv = Math.min(99 - b.count, a.count); b.count += mv; a.count -= mv;
        if (a.count <= 0) { a.id = 0; a.dur = 0; a.maxDur = 0; a.ench = false; a.trim = null; }
      } else {
        const tId = a.id, tC = a.count, tD = a.dur, tM = a.maxDur, tE = !!a.ench, tT = a.trim || null;
        a.id = b.id; a.count = b.count; a.dur = b.dur; a.maxDur = b.maxDur; a.ench = !!b.ench; a.trim = b.trim || null;
        b.id = tId; b.count = tC; b.dur = tD; b.maxDur = tM; b.ench = tE; b.trim = tT;
      }
      const touchedHotbar = (swapIdx < 9 || idx < 9);
      swapIdx = -1;
      playSfx('pickup');
      syncInvSlotsUI();
      if (touchedHotbar) renderHotbar();
    }
  }

  function _handleInvRightClick(idx) {
    const s = inventory[idx];
    if (!s) return;
    if (swapIdx >= 0 && swapIdx !== idx && inventory[swapIdx]?.count > 0) {
      const oldSwap = swapIdx, src = inventory[oldSwap];
      const srcSingle = !!(BLOCK_DEF[src.id]?.tool || BLOCK_DEF[src.id]?.armorSlot || BLOCK_DEF[src.id]?.dragonArmorSlot || src.ench || src.trim);
      if (s.count <= 0) {
        inventory[idx] = { id: src.id, count: 1, dur: src.dur || 0, maxDur: src.maxDur || 0, ench: !!src.ench, trim: src.trim ? { ...src.trim } : null };
      } else if (s.id === src.id && !srcSingle && !s.ench && !s.trim && s.count < 99) {
        s.count++;
      } else return;
      src.count--;
      if (src.count <= 0) { _clearSlotObj(src); swapIdx = -1; }
      playSfx('pickup'); syncInvSlotsUI();
      if (oldSwap < 9 || idx < 9) renderHotbar();
      return;
    }
    if (swapIdx === -1 && s.count > 1 && !(BLOCK_DEF[s.id]?.tool || BLOCK_DEF[s.id]?.armorSlot || BLOCK_DEF[s.id]?.dragonArmorSlot || s.ench || s.trim)) {
      const half = Math.floor(s.count / 2);
      let emptyIdx = -1;
      for (let k = 1; k < 36; k++) {
        const c = (idx + k) % 36;
        if (!inventory[c] || inventory[c].count <= 0) { emptyIdx = c; break; }
      }
      if (emptyIdx >= 0) {
        inventory[emptyIdx] = { id: s.id, count: half, dur: s.dur || 0, maxDur: s.maxDur || 0, ench: false, trim: null };
        s.count -= half;
      } else {
        swapIdx = idx;
      }
      playSfx('pickup'); syncInvSlotsUI();
      if (idx < 9 || (emptyIdx >= 0 && emptyIdx < 9)) renderHotbar();
    }
  }
  ['invModal', 'dragonModal', 'chestModal', 'furnaceModal'].forEach(mid => {
    document.getElementById(mid)?.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  function ensureInvSlotsDOM() {
    if (_invSlotUI) return;
    _invSlotUI = new Array(36);
    const bpGrid = document.getElementById('backpackGrid'), hbGrid = document.getElementById('invHotbarGrid');
    bpGrid.innerHTML = ''; hbGrid.innerHTML = '';
    const createSlotUI = (idx) => {
      const div = document.createElement('div');
      div.className = 'slot inv-slot-touch';
      div.dataset.invIdx = String(idx);
      const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28;
      const cnt = document.createElement('span'); cnt.className = 'slot-count';
      const dur = document.createElement('div'); dur.className = 'slot-dur'; dur.style.display = 'none'; dur.innerHTML = '<div class="slot-dur-fill"></div>';
      div.append(cv, cnt, dur);
      div.addEventListener('pointerenter', () => { hoveredInvSlot = idx; });
      div.addEventListener('pointerleave', () => { if (hoveredInvSlot === idx) hoveredInvSlot = -1; });
      div.addEventListener('pointerdown', (e) => {
        if (e.button === 2 && e.pointerType !== 'touch') {
          e.preventDefault();
          _handleInvRightClick(idx);
          return;
        }
        startInvDrag(e, 'inv', { idx, originEl: div, modal: 'inv' });
      });
      div.addEventListener('dblclick', () => {
        const s = inventory[idx];
        if (!s || s.count <= 0) return;
        const autoEq = getAutoEquipSlotForItem(s.id);
        if (autoEq) { equipItemToSlot(autoEq, idx); swapIdx = -1; creativePickId = 0; renderInventoryModal(); renderHotbar(); }
      });
      div.addEventListener('click', (e) => {
        if (invDrag.suppressClick) return;
        handleInvSlotTap(idx, e);
      });
      _invSlotUI[idx] = { div, cv, ctx: cv.getContext('2d'), cnt, dur, durFill: dur.firstElementChild, sig: '' };
      return div;
    };
    for (let i = 9; i < 36; i++) bpGrid.appendChild(createSlotUI(i));
    for (let i = 0; i < 9; i++) hbGrid.appendChild(createSlotUI(i));
  }

  function syncInvSlotsUI() {
    ensureInvSlotsDOM();
    for (let idx = 0; idx < 36; idx++) {
      const s = inventory[idx], ui = _invSlotUI[idx];
      ui.div.classList.toggle('selected-swap', swapIdx === idx);
      const sig = _slotItemVisualSig(s);
      if (ui.sig !== sig) {
        ui.sig = sig;
        delete ui.div.dataset.mcTip;
        ui.div.title = (s.count > 0 && BLOCK_DEF[s.id]) ? shortItemTip(s.id, s) : '';
        if (s.count > 0) drawBlockPreview(ui.ctx, s.id, s);
        else { ui.ctx.clearRect(0, 0, 28, 28); ui.cv.classList.remove('dream-rainbow-icon'); }
      }
      const wantCnt = s.count > 1 ? String(s.count) : '';
      if (ui.cnt.textContent !== wantCnt) ui.cnt.textContent = wantCnt;
      if (s.count > 0 && s.maxDur > 0 && s.dur < s.maxDur) {
        ui.dur.style.display = 'block';
        const pct = Math.max(0, Math.min(100, (s.dur / s.maxDur) * 100));
        ui.durFill.style.width = `${pct.toFixed(0)}%`;
        ui.durFill.style.background = pct > 60 ? '#00ff00' : (pct > 30 ? '#ffff00' : (pct > 15 ? '#ff7700' : '#ff0000'));
      } else {
        ui.dur.style.display = 'none';
      }
    }
  }

  const _CREATIVE_HIDDEN_IDS = new Set([B.AIR, B.FIRE, B.SOUL_FIRE, B.BED_FOOT, B.WHEAT_0, B.WHEAT_1, B.WHEAT_2, B.WHEAT_3, B.OAK_STAIRS_S, B.OAK_STAIRS_E, B.OAK_STAIRS_W, B.STONE_STAIRS_S, B.STONE_STAIRS_E, B.STONE_STAIRS_W, B.TERRACOTTA_STAIRS_S, B.TERRACOTTA_STAIRS_E, B.TERRACOTTA_STAIRS_W, B.DEEPSLATE_STAIRS_S, B.DEEPSLATE_STAIRS_E, B.DEEPSLATE_STAIRS_W]);

  let _rcDelegatedBound = false;
  function _ensureRecipeGridDelegation(rcGrid) {
    if (_rcDelegatedBound || !rcGrid) return;
    _rcDelegatedBound = true;
    rcGrid.addEventListener('pointerdown', (e) => {
      if (!(gameMode === 'creative' && invMode === 'backpack')) return;
      const cell = e.target && e.target.closest ? e.target.closest('.rc-slot') : null;
      if (!cell) return;
      const bid = parseInt(cell.dataset.creativeId || '0', 10);
      if (bid > 0) startInvDrag(e, 'creative', { creativeId: bid, originEl: cell, modal: 'inv' });
    });
    rcGrid.addEventListener('click', (e) => {
      if (invDrag.suppressClick) return;
      const isCreativeCatalog = (gameMode === 'creative' && invMode === 'backpack');
      const cell = e.target && e.target.closest ? e.target.closest('.rc-slot') : null;
      if (!cell) {
        if (isCreativeCatalog && e.target === rcGrid && swapIdx >= 0 && swapIdx < inventory.length) {
          _clearSlotObj(inventory[swapIdx]);
          swapIdx = -1; playSfx('pickup'); renderHotbar(); renderInventoryModal();
          showToast('🗑️ Đã xóa vật phẩm (Sáng Tạo)');
        }
        return;
      }
      const entry = _rcSlotEntries[parseInt(cell.dataset.rcIdx || '-1', 10)];
      if (!entry) return;
      if (isCreativeCatalog && entry.bid > 0) {
        const bid = entry.bid, def = BLOCK_DEF[bid];
        if (!def) return;
        const qty = (def.tool || def.armorSlot || def.dragonArmorSlot || bid === B.SHIELD) ? 1 : 99;
        if (swapIdx >= 0 && swapIdx < inventory.length) {
          setSlotItem(swapIdx, bid, qty);
          swapIdx = -1; creativePickId = 0;
          playSfx('pickup'); renderHotbar(); renderInventoryModal();
        } else if (creativePickId === bid) {
          addItemToInventory(bid, qty);
          creativePickId = 0;
          playSfx('pickup'); renderHotbar(); renderInventoryModal();
        } else {
          creativePickId = bid; swapIdx = -1; selectedEquipSlot = null;
          playSfx('pickup'); renderInventoryModal();
        }
      } else if (entry.r) {
        const r = entry.r, ref = refundManualCraftGrid();
        selectedRecipe = r;
        if (ref) renderInventoryModal();
        else {
          for (let k = 0; k < _rcSlotEntries.length; k++) _rcSlotEntries[k].cell.classList.toggle('selected', _rcSlotEntries[k].r === r);
          renderCrafting3x3();
        }
      }
    });
  }

  function renderInventoryModal() {
    hideMcTooltip();
    const q = (document.getElementById('recipeSearch').value || '').trim().toLowerCase(), rcGrid = document.getElementById('recipeGrid');
    const isCreativeCatalog = (gameMode === 'creative' && invMode === 'backpack');
    const filtBtn = document.getElementById('btnFilterCraftable');
    if (filtBtn) filtBtn.style.display = isCreativeCatalog ? 'none' : '';
    _ensureRecipeGridDelegation(rcGrid);

    const gridSig = `${isCreativeCatalog ? 'C' : 'R'}|${invMode}|${recipeCat}|${q}|${recipeFilterCraftable ? 1 : 0}`;
    if (_rcGridBuiltSig !== gridSig || (!isCreativeCatalog && recipeFilterCraftable)) {
      _rcGridBuiltSig = gridSig;
      const myGen = ++_rcBuildGen;
      if (_rcChunkRaf) { cancelAnimationFrame(_rcChunkRaf); _rcChunkRaf = 0; }
      const prevScroll = rcGrid.scrollTop;
      rcGrid.innerHTML = '';
      _rcSlotEntries = [];
      if (isCreativeCatalog) {
        const queue = [];
        for (const [kId, def] of Object.entries(BLOCK_DEF)) {
          const bid = Number(kId);
          if (!bid || _CREATIVE_HIDDEN_IDS.has(bid) || !def || !def.tiles || def.bedFoot || def.slabTop || (def.stairs && def.stairDir > 0)) continue;
          if (recipeCat !== 'all' && getCreativeItemCategory(bid, def) !== recipeCat) continue;
          if (q && !(def.name || '').toLowerCase().includes(q)) continue;
          queue.push(bid);
        }
        const appendBatch = (start, end) => {
          const frag = document.createDocumentFragment();
          for (let k = start; k < end; k++) {
            const bid = queue[k];
            const cell = document.createElement('div');
            cell.className = 'rc-slot craftable' + (creativePickId === bid ? ' selected' : '');
            cell.dataset.creativeId = String(bid);
            cell.dataset.rcIdx = String(_rcSlotEntries.length);
            cell.title = shortItemTip(bid);
            const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28; drawBlockPreview(cv.getContext('2d'), bid);
            cell.appendChild(cv);
            frag.appendChild(cell);
            _rcSlotEntries.push({ cell, bid, r: null });
          }
          rcGrid.appendChild(frag);
        };
        const firstEnd = Math.min(49, queue.length);
        appendBatch(0, firstEnd);
        rcGrid.scrollTop = prevScroll;
        let cur = firstEnd;
        const pump = () => {
          _rcChunkRaf = 0;
          if (myGen !== _rcBuildGen || cur >= queue.length) return;
          const next = Math.min(cur + 36, queue.length);
          appendBatch(cur, next);
          cur = next;
          if (cur < queue.length) _rcChunkRaf = requestAnimationFrame(pump);
        };
        if (cur < queue.length) _rcChunkRaf = requestAnimationFrame(pump);
      } else {
        const frag = document.createDocumentFragment();
        for (const r of RECIPES) {
          if (recipeCat !== 'all' && r.cat !== recipeCat) continue;
          const ok = canCraftRecipe(r) && (invMode === 'table' || !!r.is2x2); if (recipeFilterCraftable && !ok) continue;
          const name = (BLOCK_DEF[r.out].name || '') + ' ' + (typeof getLocalizedBlockName === 'function' ? getLocalizedBlockName(r.out) : ''); if (q && !name.toLowerCase().includes(q)) continue;
          const cell = document.createElement('div');
          cell.className = 'rc-slot' + (ok ? ' craftable' : '') + (selectedRecipe === r ? ' selected' : '');
          cell.dataset.rcIdx = String(_rcSlotEntries.length);
          cell.title = r.qty > 1 ? `${r.qty}x ${shortItemTip(r.out)}` : shortItemTip(r.out);
          const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28; drawBlockPreview(cv.getContext('2d'), r.out);
          cell.appendChild(cv);
          frag.appendChild(cell);
          _rcSlotEntries.push({ cell, bid: 0, r });
        }
        rcGrid.appendChild(frag);
        rcGrid.scrollTop = prevScroll;
      }
    } else {
      // Fast O(N) in-place class update — ZERO DOM creation & ZERO canvas redraws!
      if (isCreativeCatalog) {
        for (let i = 0; i < _rcSlotEntries.length; i++) {
          const e = _rcSlotEntries[i];
          e.cell.classList.toggle('selected', creativePickId === e.bid);
        }
      } else {
        for (let i = 0; i < _rcSlotEntries.length; i++) {
          const e = _rcSlotEntries[i];
          const ok = canCraftRecipe(e.r) && (invMode === 'table' || !!e.r.is2x2);
          e.cell.classList.toggle('craftable', ok);
          e.cell.classList.toggle('selected', selectedRecipe === e.r);
        }
      }
    }
    renderCrafting3x3();
    renderEquipmentUI();
    syncInvSlotsUI();
  }

  function handleEquipSlotTap(eqKey) {
    if (creativePickId > 0) {
      const targetEq = getAutoEquipSlotForItem(creativePickId, eqKey);
      if (targetEq) {
        player.equip[targetEq] = creativePickId;
        if (player.equipMeta) player.equipMeta[targetEq] = null;
        creativePickId = 0; selectedEquipSlot = null;
        recalcPlayerArmor(); playSfx('equip');
        renderInventoryModal(); renderHotbar();
        showToast(`🛡️ Đã trang bị ${BLOCK_DEF[player.equip[targetEq]]?.name || 'Giáp'}!`);
        return;
      }
    }
    if (swapIdx >= 0 && inventory[swapIdx] && inventory[swapIdx].count > 0) {
      const targetEq = getAutoEquipSlotForItem(inventory[swapIdx].id, eqKey);
      if (targetEq) {
        equipItemToSlot(targetEq, swapIdx);
        swapIdx = -1; selectedEquipSlot = null;
        renderInventoryModal(); renderHotbar();
        return;
      }
    }
    // Single-click an equipped armor/offhand slot unequips straight back to Backpack!
    if ((player.equip[eqKey] || 0) > 0) {
      selectedEquipSlot = null;
      unequipArmorSlot(eqKey);
      return;
    }
    selectedEquipSlot = (selectedEquipSlot === eqKey) ? null : eqKey;
    swapIdx = -1;
    renderEquipmentUI();
    syncInvSlotsUI();
  }

  document.querySelectorAll('.equip-slot').forEach(el => {
    el.classList.add('inv-slot-touch');
    el.addEventListener('pointerdown', (e) => {
      const eqKey = el.dataset.eq;
      startInvDrag(e, 'equip', { eqKey, originEl: el, modal: 'inv' });
    });
    el.addEventListener('click', () => {
      if (invDrag.suppressClick) return;
      handleEquipSlotTap(el.dataset.eq);
    });
  });

  document.querySelectorAll('.rc-tab').forEach(tab => { tab.addEventListener('click', () => { document.querySelectorAll('.rc-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); recipeCat = tab.dataset.cat; renderInventoryModal(); }); });
  document.getElementById('recipeSearch').addEventListener('input', () => {
    clearTimeout(_rcSearchTimer);
    _rcSearchTimer = setTimeout(renderInventoryModal, 70);
  });
  document.getElementById('btnFilterCraftable').addEventListener('click', (e) => { recipeFilterCraftable = !recipeFilterCraftable; e.currentTarget.classList.toggle('active', recipeFilterCraftable); renderInventoryModal(); });
  document.getElementById('btnToggleBook').addEventListener('click', () => { const rb = document.getElementById('recipeBookWrap'); rb.style.display = (rb.style.display === 'none') ? 'flex' : 'none'; requestAnimationFrame(updateMobileUiScale); });

  function openInventoryModal(mode = 'backpack') {
    refundManualCraftGrid();
    invalidateDragTargets();
    invMode = (mode === 'table') ? 'table' : 'backpack';
    isPlaying = false; mining.active = false; clearMoveKeys(); swapIdx = -1; selectedEquipSlot = null; creativePickId = 0; resetInvDragState();
    playSfx('ui_open');
    if (document.pointerLockElement) document.exitPointerLock();
    const modal = document.getElementById('invModal');
    modal.classList.toggle('mode-backpack', invMode === 'backpack');
    modal.classList.toggle('mode-table', invMode === 'table');
    const titleEl = document.getElementById('invTitleText');
    if (titleEl) titleEl.textContent = 'Crafting';
    renderInventoryModal();
    modal.classList.remove('hidden');
    modal.scrollLeft = 0; modal.scrollTop = 0;
    document.documentElement.scrollLeft = 0; document.documentElement.scrollTop = 0;
    updateMobileUiScale();
    requestAnimationFrame(() => { updateMobileUiScale(); invalidateDragTargets(); });
  }
  function closeInventoryModal() {
    if (_rcChunkRaf) { cancelAnimationFrame(_rcChunkRaf); _rcChunkRaf = 0; }
    invalidateDragTargets();
    hideMcTooltip(); refundManualCraftGrid(); swapIdx = -1; creativePickId = 0; selectedEquipSlot = null; resetInvDragState();
    playSfx('ui_close');
    const modal = document.getElementById('invModal');
    if (modal) { modal.scrollLeft = 0; modal.scrollTop = 0; modal.classList.add('hidden'); }
    document.documentElement.scrollLeft = 0; document.documentElement.scrollTop = 0;
    updateMobileUiScale();
    isPlaying = true; safeLockPointer();
  }
  document.getElementById('btnCloseInv').addEventListener('click', closeInventoryModal);

  // ===================== AUTHENTIC MINECRAFT FURNACE / BLAST FURNACE / SMOKER UI CONTROLLER =====================
  function getOrCreateFurnaceState(k, blockId) {
    let fs = furnaceStateMap.get(k);
    if (!fs) {
      const fType = (BLOCK_DEF[blockId] && BLOCK_DEF[blockId].furnaceType) || 'furnace';
      fs = { type: fType, inSlot: { id: 0, count: 0 }, fuelSlot: { id: 0, count: 0 }, outSlot: { id: 0, count: 0 }, burnLeft: 0, burnMax: 1, cookT: 0, cookNeed: (fType === 'furnace' ? 10.0 : 5.0), _uiSig: '' };
      furnaceStateMap.set(k, fs);
    }
    return fs;
  }
  function _ensureSlotGridPool(containerEl, pool, count, onInitEl) {
    while (pool.length < count) {
      const div = document.createElement('div');
      div.className = 'slot inv-slot-touch';
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
      const cnt = document.createElement('span'); cnt.className = 'slot-count';
      const dur = document.createElement('div'); dur.className = 'slot-dur'; dur.style.display = 'none';
      dur.innerHTML = '<div class="slot-dur-fill"></div>';
      div.append(cv, cnt, dur);
      const ui = { div, cv, ctx: cv.getContext('2d'), cnt, dur, durFill: dur.firstElementChild, sig: '' };
      if (onInitEl) onInitEl(ui, pool.length);
      containerEl.appendChild(div);
      pool.push(ui);
    }
    for (let i = 0; i < pool.length; i++) {
      const vis = i < count;
      if (pool[i].div.style.display !== (vis ? '' : 'none')) pool[i].div.style.display = vis ? '' : 'none';
    }
  }
  function _syncSimpleSlotUI(ui, item) {
    if (!ui) return;
    const sig = _slotItemVisualSig(item);
    if (ui.sig !== sig) {
      ui.sig = sig;
      delete ui.div.dataset.mcTip;
      ui.div.title = (item && item.count > 0 && BLOCK_DEF[item.id]) ? shortItemTip(item.id, item) : '';
      if (item && item.count > 0) drawBlockPreview(ui.ctx, item.id, item);
      else { ui.ctx.clearRect(0, 0, ui.cv.width, ui.cv.height); ui.cv.classList.remove('dream-rainbow-icon'); }
    }
    const wantCnt = (item && item.count > 1) ? String(item.count) : '';
    if (ui.cnt.textContent !== wantCnt) ui.cnt.textContent = wantCnt;
    if (ui.dur) {
      if (item && item.count > 0 && item.maxDur > 0 && item.dur < item.maxDur) {
        ui.dur.style.display = 'block';
        const pct = Math.max(0, Math.min(100, (item.dur / item.maxDur) * 100));
        ui.durFill.style.width = `${pct.toFixed(0)}%`;
        ui.durFill.style.background = pct > 60 ? '#00ff00' : (pct > 30 ? '#ffff00' : (pct > 15 ? '#ff7700' : '#ff0000'));
      } else ui.dur.style.display = 'none';
    }
  }

  // ===================== CLASSIC MINECRAFT DRAGON ARMOR, SADDLE & STATS MODAL =====================
  let _dragonModalTarget = null;
  let _dragonModalBpPool = [], _dragonModalHbPool = [], _dragonModalPoolsBound = false;
  let _dragonPrevRenderer = null, _dragonPrevScene = null, _dragonPrevCam = null, _dragonPrevRig = null;
  let _dragonPrevType = '', _dragonPrevRotY = 0.58;
  const _elDragonModal = document.getElementById('dragonModal');
  const _elDragonTitle = document.getElementById('dragonModalTitle');
  const _elDragonSitBtn = document.getElementById('btnDragonSitModal');
  let _dragonEqSlotEls = null;

  function _getDragonItemId(slotKey, tier) {
    if (slotKey === 'saddle') return B.DRAGON_SADDLE || 0;
    if (!tier) return 0;
    return B[`DRAGON_ARMOR_${String(tier).toUpperCase()}_${String(slotKey).toUpperCase()}`] || 0;
  }
  function ensureDragonPreview3D() {
    const cv = document.getElementById('dragonPreviewCanvas');
    if (!cv || _dragonPrevRenderer) return;
    try {
      _dragonPrevRenderer = new THREE.WebGLRenderer({ canvas: cv, alpha: false, antialias: false, preserveDrawingBuffer: true });
      _dragonPrevRenderer.setClearColor(0x050507, 1);
      if (typeof THREE.ACESFilmicToneMapping !== 'undefined') _dragonPrevRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      _dragonPrevRenderer.toneMappingExposure = 0.96;
      _dragonPrevRenderer.setSize(224, 148, false);
      _dragonPrevScene = new THREE.Scene();
      _dragonPrevCam = new THREE.PerspectiveCamera(38, 224 / 148, 0.1, 30);
      _dragonPrevCam.position.set(0, 1.48, 5.2);
      _dragonPrevCam.lookAt(0, 0.88, 0);
      _dragonPrevScene.add(new THREE.AmbientLight(0xffffff, 0.72));
      const dL = new THREE.DirectionalLight(0xfff5e4, 0.65); dL.position.set(3.2, 5.0, 4.2); _dragonPrevScene.add(dL);
      const rL = new THREE.DirectionalLight(0xcbd5e1, 0.25); rL.position.set(-3.0, 2.5, -3.2); _dragonPrevScene.add(rL);
      let dragging = false, lx = 0;
      cv.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; });
      window.addEventListener('pointerup', () => { dragging = false; });
      window.addEventListener('pointermove', (e) => {
        if (dragging && _elDragonModal && !_elDragonModal.classList.contains('hidden')) {
          _dragonPrevRotY += (e.clientX - lx) * 0.022; lx = e.clientX; drawDragonPreview();
        }
      });
    } catch (_) {}
  }
  function drawDragonPreview() {
    const m = _dragonModalTarget;
    if (!m) return;
    ensureDragonPreview3D();
    if (!_dragonPrevRenderer || !_dragonPrevScene || !_dragonPrevCam) return;
    if (_dragonPrevType !== m.type || !_dragonPrevRig) {
      if (_dragonPrevRig) {
        if (_dragonPrevRig.anim && _dragonPrevRig.anim.mixer) _dragonPrevRig.anim.mixer.stopAllAction();
        _dragonPrevScene.remove(_dragonPrevRig.group);
        _dragonPrevRig = null;
      }
      if (typeof instantiateBlenderMob === 'function') {
        const built = instantiateBlenderMob(m.type);
        if (built && built.group) {
          built.group.scale.setScalar(0.84);
          built.group.position.set(0, 0, 0);
          _dragonPrevScene.add(built.group);
          _dragonPrevRig = built;
          _dragonPrevType = m.type;
        }
      }
    }
    if (!_dragonPrevRig) return;
    if (typeof _applyDragonArmorToAnim === 'function') _applyDragonArmorToAnim(_dragonPrevRig.anim, m.dragonArmor, !!m.saddled);
    if (_dragonPrevRig.anim && _dragonPrevRig.anim.mixer) _dragonPrevRig.anim.mixer.update(0.001);
    _dragonPrevRig.group.rotation.y = _dragonPrevRotY;
    _dragonPrevRenderer.render(_dragonPrevScene, _dragonPrevCam);
  }
  function tickDragonModalPreview(dt) {
    if (!_dragonModalTarget || !_elDragonModal || _elDragonModal.classList.contains('hidden')) return;
    if (!_dragonPrevRig || !_dragonPrevRenderer) return;
    if (_dragonPrevRig.anim && _dragonPrevRig.anim.mixer) _dragonPrevRig.anim.mixer.update(Math.min(0.04, dt));
    _dragonPrevRig.group.rotation.y = _dragonPrevRotY;
    _dragonPrevRenderer.render(_dragonPrevScene, _dragonPrevCam);
  }
  function _handleDragonEqSlotClick(slotKey) {
    const m = _dragonModalTarget;
    if (!m || m._dead) return;
    if (slotKey === 'saddle') {
      if (!m.saddled) return;
      m.saddled = false;
      if (gameMode !== 'creative') addItemToInventory(B.DRAGON_SADDLE, 1);
      if (typeof _applyDragonArmorToAnim === 'function') _applyDragonArmorToAnim(m.anim, m.dragonArmor, false);
      if (typeof rebuildDragonStageMesh === 'function') rebuildDragonStageMesh(m);
    } else {
      const prevTier = m.dragonArmor && m.dragonArmor[slotKey];
      if (!prevTier) return;
      m.dragonArmor[slotKey] = null;
      const retId = _getDragonItemId(slotKey, prevTier);
      if (retId && gameMode !== 'creative') addItemToInventory(retId, 1);
      if (typeof _applyDragonArmorToAnim === 'function') _applyDragonArmorToAnim(m.anim, m.dragonArmor, !!m.saddled);
    }
    playSfx('equip'); renderHotbar(); renderDragonModal(); drawDragonPreview();
  }
  function _handleDragonInvClick(idx) {
    const m = _dragonModalTarget;
    if (!m || m._dead) return;
    const s = inventory[idx], def = s && s.count > 0 ? BLOCK_DEF[s.id] : null;
    if (!s || !def) return;
    if (def.dragonArmorSlot) {
      const aSlot = def.dragonArmorSlot, aTier = def.dragonArmorTier || 'iron';
      if (!m.dragonArmor || typeof m.dragonArmor !== 'object') m.dragonArmor = {};
      const prevTier = m.dragonArmor[aSlot];
      if (prevTier === aTier) return;
      if (gameMode !== 'creative') {
        s.count--; if (s.count <= 0) _clearSlotObj(s);
        const prevId = prevTier ? _getDragonItemId(aSlot, prevTier) : 0;
        if (prevId) addItemToInventory(prevId, 1);
      }
      m.dragonArmor[aSlot] = aTier;
      if (typeof _applyDragonArmorToAnim === 'function') _applyDragonArmorToAnim(m.anim, m.dragonArmor, !!m.saddled);
      playSfx('equip'); renderHotbar(); renderDragonModal(); drawDragonPreview();
    } else if (s.id === B.DRAGON_SADDLE) {
      if ((m.growth || 0) < 100 || m.saddled) return;
      if (gameMode !== 'creative') { s.count--; if (s.count <= 0) _clearSlotObj(s); }
      m.saddled = true;
      if (typeof _applyDragonArmorToAnim === 'function') _applyDragonArmorToAnim(m.anim, m.dragonArmor, true);
      if (typeof rebuildDragonStageMesh === 'function') rebuildDragonStageMesh(m);
      playSfx('equip'); renderHotbar(); renderDragonModal(); drawDragonPreview();
    } else if (s.id === B.DRAGON_CRYSTAL && typeof feedOrInteractTamedDragon === 'function') {
      feedOrInteractTamedDragon(m, s, def, false, false);
      renderDragonModal(); drawDragonPreview();
    }
  }
  function renderDragonModal() {
    const m = _dragonModalTarget;
    if (!m || !_elDragonModal) return;
    const locName = (typeof getLocalizedMobName === 'function') ? getLocalizedMobName(m.type, m.displayName) : (m.displayName || 'Rồng');
    if (_elDragonTitle) _elDragonTitle.textContent = locName;
    if (_elDragonSitBtn) _elDragonSitBtn.textContent = m.sitting ? tr('🪑 Ngồi', '🪑 Sit') : tr('🐾 Theo', '🐾 Follow');
    const stNames = [tr('Sơ Sinh', 'Hatchling'), tr('Rồng Nhỏ', 'Young'), tr('Chiến Đấu', 'Juvenile'), tr('Thiếu Niên', 'Sub-Adult'), tr('Trưởng Thành', 'Adult')];
    const stg = typeof growthToDragonStage === 'function' ? growthToDragonStage(m.growth || 0) : (m.dragonStage || 0);
    const armPts = typeof calcDragonArmorPts === 'function' ? calcDragonArmorPts(m) : 0;
    const sc = m.dragonScale || 1;
    const flySpd = (17.5 * (1 + Math.max(0, sc - 1) * 0.14)).toFixed(1);
    const elN = document.getElementById('dstatName');
    const elH = document.getElementById('dstatHp');
    const elG = document.getElementById('dstatGender');
    const elS = document.getElementById('dstatSpeed');
    const elD = document.getElementById('dstatDmg');
    const elPct = document.getElementById('dstatGrowthPct');
    const elFill = document.getElementById('dstatGrowthFill');
    const gPct = Math.max(0, Math.min(100, Number(m.growth) || 0));
    if (elN) elN.textContent = `${locName} • ${stNames[stg] || stNames[0]} (${Math.round(gPct)}%)`;
    if (elH) elH.textContent = tr(`Máu: ${Math.ceil(m.hp)} / ${m.maxHp}`, `Health: ${Math.ceil(m.hp)} / ${m.maxHp}`);
    if (elG) elG.textContent = tr(`Giới tính: ${m.gender === 'F' ? 'Cái ♀' : 'Đực ♂'}`, `Gender: ${m.gender === 'F' ? 'Female ♀' : 'Male ♂'}`);
    if (elS) elS.textContent = tr(`Tốc độ: Đi 3.6 • Bay ${flySpd}`, `Speed: Walk 3.6 • Fly ${flySpd}`);
    if (elD) elD.textContent = tr(`Sát thương: ${m.dmg} • Giáp: ${armPts}/20`, `Damage: ${m.dmg} • Armor: ${armPts}/20`);
    if (elPct) elPct.textContent = `${Math.round(gPct)}%` + (gPct >= 100 ? tr(' (Tối đa)', ' (Max)') : '');
    if (elFill) elFill.style.width = `${gPct.toFixed(1)}%`;
    if (!_dragonEqSlotEls) {
      _dragonEqSlotEls = Array.from(_elDragonModal.querySelectorAll('.dragon-eq-slot'));
      for (const el of _dragonEqSlotEls) {
        el.addEventListener('click', () => _handleDragonEqSlotClick(el.dataset.deq));
      }
    }
    for (const el of _dragonEqSlotEls) {
      const sk = el.dataset.deq;
      const itemId = (sk === 'saddle') ? (m.saddled ? B.DRAGON_SADDLE : 0) : _getDragonItemId(sk, m.dragonArmor && m.dragonArmor[sk]);
      el.classList.toggle('equipped', itemId > 0);
      const ghost = el.querySelector('.deq-ghost'), cv = el.querySelector('canvas');
      if (ghost) ghost.style.display = itemId > 0 ? 'none' : '';
      if (cv) {
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (itemId > 0) drawBlockPreview(ctx, itemId);
      }
      el.title = itemId > 0 ? shortItemTip(itemId) : '';
    }
    const bpEl = document.getElementById('dragonBackpackGrid'), hbEl = document.getElementById('dragonHotbarGrid');
    if (bpEl && hbEl) {
      _ensureSlotGridPool(bpEl, _dragonModalBpPool, 27, _dragonModalPoolsBound ? null : (ui, k) => {
        ui.div.addEventListener('click', () => _handleDragonInvClick(k + 9));
      });
      _ensureSlotGridPool(hbEl, _dragonModalHbPool, 9, _dragonModalPoolsBound ? null : (ui, k) => {
        ui.div.addEventListener('click', () => _handleDragonInvClick(k));
      });
      _dragonModalPoolsBound = true;
      for (let i = 0; i < 27; i++) _syncSimpleSlotUI(_dragonModalBpPool[i], inventory[i + 9]);
      for (let i = 0; i < 9; i++) _syncSimpleSlotUI(_dragonModalHbPool[i], inventory[i]);
    }
  }
  function openDragonModal(m) {
    if (!m || m._dead || !m.tamed || !m.elemDragon || !_elDragonModal) return;
    _dragonModalTarget = m;
    isPlaying = false; mining.active = false; clearMoveKeys(); resetInvDragState();
    playSfx('ui_open');
    if (document.pointerLockElement) document.exitPointerLock();
    renderDragonModal();
    _elDragonModal.classList.remove('hidden');
    updateMobileUiScale();
    requestAnimationFrame(() => { updateMobileUiScale(); drawDragonPreview(); });
  }
  function closeDragonModal() {
    if (!_elDragonModal || _elDragonModal.classList.contains('hidden')) return;
    hideMcTooltip();
    _elDragonModal.classList.add('hidden');
    _dragonModalTarget = null;
    playSfx('ui_close');
    updateMobileUiScale();
    if (!document.getElementById('lobbyScreen')?.classList.contains('hidden')) return;
    isPlaying = true; safeLockPointer();
  }
  document.getElementById('btnCloseDragonModal')?.addEventListener('click', closeDragonModal);
  if (_elDragonSitBtn) {
    _elDragonSitBtn.addEventListener('click', () => {
      const m = _dragonModalTarget;
      if (!m || m._dead || typeof feedOrInteractTamedDragon !== 'function') return;
      feedOrInteractTamedDragon(m, null, null, true, false);
      renderDragonModal();
    });
  }
  if (_elDragonModal) {
    _elDragonModal.addEventListener('click', (e) => { if (e.target === _elDragonModal) closeDragonModal(); });
  }
  function _syncInvPairPools(bpEl, bpPool, hbEl, hbPool, onTapFn, dragSourceType, modalName) {
    const mk = (isHb) => (ui, k) => {
      const invIdx = isHb ? k : (k + 9);
      ui.div.dataset[modalName === 'chest' ? 'chestInv' : (modalName === 'furnace' ? 'furnInv' : 'smithInv')] = String(invIdx);
      if (dragSourceType) {
        ui.div.addEventListener('pointerdown', (e) => {
          startInvDrag(e, dragSourceType, { idx: invIdx, originEl: ui.div, modal: modalName });
        });
      }
      ui.div.addEventListener('click', () => {
        if (dragSourceType && invDrag.suppressClick) return;
        onTapFn(invIdx);
      });
    };
    _ensureSlotGridPool(bpEl, bpPool, 27, mk(false));
    _ensureSlotGridPool(hbEl, hbPool, 9, mk(true));
    for (let i = 0; i < 27; i++) _syncSimpleSlotUI(bpPool[i], inventory[i + 9]);
    for (let i = 0; i < 9; i++) _syncSimpleSlotUI(hbPool[i], inventory[i]);
  }
  function drawSimpleSlotEl(el, item) {
    if (!el) return;
    if (!el._simpleUI) {
      el.innerHTML = '';
      const cv = document.createElement('canvas'); cv.width = 34; cv.height = 34;
      const cnt = document.createElement('span'); cnt.className = 'slot-count';
      el.append(cv, cnt);
      el._simpleUI = { div: el, cv, ctx: cv.getContext('2d'), cnt, dur: null, durFill: null, sig: '__init__' };
    }
    _syncSimpleSlotUI(el._simpleUI, item);
  }
  function updateFurnaceModalLiveBars(forceSlots = false) {
    if (!activeFurnaceKey) return;
    const fs = furnaceStateMap.get(activeFurnaceKey); if (!fs) return;
    const flameEl = document.getElementById('furnFlameFill'), arrowEl = document.getElementById('furnArrowFill');
    if (flameEl) flameEl.style.height = `${Math.min(100, Math.max(0, (fs.burnLeft / Math.max(0.1, fs.burnMax)) * 100)).toFixed(2)}%`;
    if (arrowEl) arrowEl.style.width = `${Math.min(100, Math.max(0, (fs.cookT / Math.max(0.1, fs.cookNeed)) * 100)).toFixed(2)}%`;
    const sig = `${fs.inSlot.id}:${fs.inSlot.count}|${fs.fuelSlot.id}:${fs.fuelSlot.count}|${fs.outSlot.id}:${fs.outSlot.count}`;
    if (forceSlots || fs._uiSig !== sig) {
      fs._uiSig = sig;
      drawSimpleSlotEl(document.getElementById('furnInputSlot'), fs.inSlot);
      drawSimpleSlotEl(document.getElementById('furnFuelSlot'), fs.fuelSlot);
      drawSimpleSlotEl(document.getElementById('furnOutputSlot'), fs.outSlot);
    }
  }
  function _handleFurnInvTap(idx) {
    if (!activeFurnaceKey) return;
    const fs = furnaceStateMap.get(activeFurnaceKey), s = inventory[idx];
    if (!fs || !s || s.count <= 0) return;
    const rec = SMELT_RECIPES[s.id];
    const isFuel = !!FUEL_VALUES[s.id];
    const allowRec = rec && (fs.type === 'furnace' || (fs.type === 'blast' && rec.kind === 'ore') || (fs.type === 'smoker' && rec.kind === 'food'));
    if (allowRec && (fs.inSlot.count === 0 || fs.inSlot.id === s.id)) {
      const mv = Math.min(99 - fs.inSlot.count, s.count);
      fs.inSlot.id = s.id; fs.inSlot.count += mv; s.count -= mv; if (s.count <= 0) _clearSlotObj(s);
      playSfx('place'); renderFurnaceModal(); if (idx < 9) renderHotbar();
    } else if (isFuel && (fs.fuelSlot.count === 0 || (fs.fuelSlot.id === s.id && s.id !== B.LAVA_BUCKET))) {
      const mv = s.id === B.LAVA_BUCKET ? 1 : Math.min(99 - fs.fuelSlot.count, s.count);
      fs.fuelSlot.id = s.id; fs.fuelSlot.count += mv; s.count -= mv; if (s.count <= 0) _clearSlotObj(s);
      playSfx('place'); renderFurnaceModal(); if (idx < 9) renderHotbar();
    } else {
      showToast(fs.type === 'blast' ? '🔥 Lò Luyện Kim chỉ nung Quặng + Nhiên liệu (Than/Gỗ/Tre/Lava)!' : (fs.type === 'smoker' ? '🍖 Lò Hun Khói chỉ nướng Thức Ăn + Nhiên liệu!' : '🔥 Chọn Quặng/Thức Ăn/Đá/Cát hoặc Nhiên liệu (Than, Gỗ, Tre, Xô Lava)!'));
    }
  }
  function renderFurnaceModal() {
    if (!activeFurnaceKey) return;
    hideMcTooltip();
    const fs = furnaceStateMap.get(activeFurnaceKey); if (!fs) return;
    const titleEl = document.getElementById('furnaceModalTitle');
    if (titleEl) titleEl.textContent = fs.type === 'blast' ? 'Blast Furnace' : (fs.type === 'smoker' ? 'Smoker' : 'Furnace');
    updateFurnaceModalLiveBars(true);
    _syncInvPairPools(document.getElementById('furnInvGrid'), _furnBpUI, document.getElementById('furnHbGrid'), _furnHbUI, _handleFurnInvTap, 'furnInv', 'furnace');
  }
  function openFurnaceModal(wx, wy, wz, blockId) {
    isPlaying = false; mining.active = false; clearMoveKeys(); resetInvDragState();
    if (document.pointerLockElement) document.exitPointerLock();
    activeFurnaceKey = modKey(wx, wy, wz);
    getOrCreateFurnaceState(activeFurnaceKey, blockId);
    renderFurnaceModal();
    document.getElementById('furnaceModal').classList.remove('hidden');
    updateMobileUiScale();
    requestAnimationFrame(updateMobileUiScale);
  }
  function closeFurnaceModal() {
    hideMcTooltip(); resetInvDragState();
    activeFurnaceKey = null;
    document.getElementById('furnaceModal').classList.add('hidden');
    isPlaying = true; safeLockPointer();
  }
  document.getElementById('btnCloseFurnace').addEventListener('click', closeFurnaceModal);
  const takeFromFurnaceSlot = (slotKey) => {
    if (!activeFurnaceKey) return;
    const fs = furnaceStateMap.get(activeFurnaceKey); if (!fs) return;
    const sl = fs[slotKey]; if (!sl || sl.count <= 0) return;
    addItemToInventory(sl.id, sl.count);
    _clearSlotObj(sl);
    playSfx('pickup'); renderFurnaceModal(); renderHotbar();
  };
  [['furnInputSlot', 'inSlot'], ['furnFuelSlot', 'fuelSlot'], ['furnOutputSlot', 'outSlot']].forEach(([elId, skey]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.add('inv-slot-touch');
    el.addEventListener('pointerdown', (e) => startInvDrag(e, 'furnSlot', { eqKey: skey, originEl: el, modal: 'furnace' }));
    el.addEventListener('click', () => { if (!invDrag.suppressClick) takeFromFurnaceSlot(skey); });
  });

  // ===================== AUTHENTIC ANIMATED 3D MULTI-TIER CHEST UI CONTROLLER (27 / 36 / 45 / 54 SLOTS!) =====================
  function _chestSeedRng(seedStr) {
    let h = (2166136261 ^ (typeof worldSeed === 'number' ? worldSeed : 1337)) >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    let s = h || 1;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function _fillAncientCityChestLoot(arr, seedKey = '') {
    const rng = _chestSeedRng('ancient_city:' + seedKey);
    const pick = (pool) => pool[(rng() * pool.length) | 0];
    const putLoot = (id, count = 1, ench = false) => {
      const idx = arr.findIndex(s => !s || s.count === 0);
      if (idx < 0) return;
      const def = BLOCK_DEF[id];
      arr[idx] = { id, count, dur: (def && def.maxDur) || 0, maxDur: (def && def.maxDur) || 0, ench: !!ench, trim: null };
    };
    const coreRare = [B.SWIFT_SNEAK_BOOK, B.ECHO_SHARD, B.DISC_FRAGMENT_5, B.TOTEM_UNDYING, B.NIGHT_VISION_POTION, B.TRIM_WARD, B.TRIM_SILENCE, B.MUSIC_DISC_5, B.MUSIC_DISC_OTHERSIDE];
    const commonCity = [B.GRAY_WOOL, B.CANDLE, B.SOUL_LANTERN, B.SNOWBALL, B.IRON_INGOT, B.COAL, B.DIAMOND, B.GOLD_APPLE, B.GOLDEN_CARROT, B.AMETHYST_LEGS, B.SCULK_CATALYST, B.SCULK_SENSOR, B.ENDER_CHEST_BLOCK];
    if (rng() < 0.72) putLoot(B.ECHO_SHARD, 1 + ((rng() * 3) | 0));
    if (rng() < 0.55) putLoot(B.DISC_FRAGMENT_5, 1 + ((rng() * 2) | 0));
    if (rng() < 0.48) putLoot(B.SWIFT_SNEAK_BOOK, 1, true);
    if (rng() < 0.42) putLoot(B.NIGHT_VISION_POTION, 1);
    if (rng() < 0.25) putLoot(B.TOTEM_UNDYING, 1);
    if (rng() < 0.30) putLoot(rng() < 0.55 ? B.TRIM_WARD : B.TRIM_SILENCE, 1);
    if (rng() < 0.18) putLoot(rng() < 0.5 ? B.MUSIC_DISC_5 : B.MUSIC_DISC_OTHERSIDE, 1);
    if (rng() < 0.22) putLoot(B.ENDER_CHEST_BLOCK, 1);
    const nCommon = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < nCommon; i++) {
      const id = pick(commonCity);
      const qty = (BLOCK_DEF[id] && (BLOCK_DEF[id].tool || BLOCK_DEF[id].armorSlot || id === B.ENDER_CHEST_BLOCK)) ? 1 : (2 + ((rng() * 5) | 0));
      putLoot(id, qty);
    }
    if (arr.every(s => !s || s.count === 0)) putLoot(pick(coreRare), 1);
  }
  function _fillNaturalChestLoot(arr, blockId, trueK, dimKey = '') {
    const tag = naturalChestTags.get(trueK) || '';
    const seedStr = (dimKey || (currentDimension + ':' + trueK)) + ':' + blockId;
    if (tag === 'ancient_city' && typeof _fillAncientCityChestLoot === 'function') {
      _fillAncientCityChestLoot(arr, seedStr);
      return;
    }
    if (tag === 'end_ship') {
      const rngShip = _chestSeedRng(seedStr);
      const putE = (idx, id, count = 1, ench = false) => {
        const d = BLOCK_DEF[id];
        arr[idx] = { id, count, dur: (d && d.maxDur) || 0, maxDur: (d && d.maxDur) || 0, ench: !!ench, trim: null };
      };
      putE(13, B.ELYTRA, 1, false);
      if (rngShip() < 0.15) putE(14, B.ELYTRA_PHOENIX || B.ELYTRA, 1, true);
      putE(3, B.DIAMOND, 2, false);
      putE(5, B.EMERALD, 5, false);
      putE(11, B.DIAMOND_SWORD, 1, true);
      putE(15, B.DIAMOND_PICK, 1, true);
      putE(21, B.GOLD_APPLE, 2, false);
      putE(23, B.GUNPOWDER, 8, false);
      putE(19, B.ENDER_PEARL, 4, false);
      return;
    }
    const rng = _chestSeedRng(seedStr);
    if (tag === 'end_city') {
      const endPool = [B.EMERALD, B.GOLD_INGOT, B.IRON_INGOT, B.AMETHYST || B.EMERALD, B.ENDER_PEARL, B.VOID_PEARL, B.END_ROD, B.PURPUR_BLOCK, B.GOLD_APPLE, B.DIAMOND_HELMET, B.DIAMOND_BOOTS, B.TRIM_SPIRE, B.TRIM_EYE];
      for (let i = 0; i < 6; i++) {
        const lid = endPool[(rng() * endPool.length) | 0], d = BLOCK_DEF[lid];
        arr[i * 4 + 1] = { id: lid, count: (d?.tool || d?.armorSlot) ? 1 : (2 + ((rng() * 4) | 0)), dur: d?.maxDur || 0, maxDur: d?.maxDur || 0, ench: !!(d?.tool || d?.armorSlot), trim: null };
      }
      return;
    }
    const isHighTier = (blockId === B.GOLD_CHEST || blockId === B.DIAMOND_CHEST || blockId === B.NETHERITE_CHEST);
    const lootPool = isHighTier
      ? [B.GOLD_INGOT, B.IRON_INGOT, B.COAL, B.REDSTONE, B.EMERALD, B.RUBY, B.GOLD_APPLE, B.GOLDEN_CARROT, B.VOID_PEARL, B.GLOW_CRYSTAL, B.COOKED_BEEF, B.COOKED_PORK, B.TORCH_BLOCK, B.TNT]
      : [B.IRON_INGOT, B.GOLD_INGOT, B.COAL, B.REDSTONE, B.RAW_IRON, B.RAW_GOLD, B.WHEAT_SEEDS, B.CARROT, B.POTATO, B.APPLE, B.BREAD, B.COOKIE, B.TORCH_BLOCK, B.ARROW, B.IRON_PICK, B.OAK_DOOR];
    const countItems = isHighTier ? 5 : 4;
    for (let i = 0; i < countItems; i++) {
      const lid = lootPool[Math.floor(rng() * lootPool.length)];
      arr[i * 3 + 1] = { id: lid, count: BLOCK_DEF[lid]?.tool ? 1 : (1 + ((rng() * 4) | 0)), dur: BLOCK_DEF[lid]?.maxDur || 0, maxDur: BLOCK_DEF[lid]?.maxDur || 0 };
    }
    const diamondChance = isHighTier ? 0.025 : 0.008;
    if (rng() < diamondChance) {
      arr[countItems * 3 + 1] = { id: B.DIAMOND, count: 1, dur: 0, maxDur: 0 };
    }
    const trimPool = [
      B.TRIM_WARD, B.TRIM_COAST, B.TRIM_WILD, B.TRIM_DUNE, B.TRIM_TIDE, B.TRIM_SILENCE,
      B.TRIM_SENTRY, B.TRIM_VEX, B.TRIM_RIB, B.TRIM_SNOUT, B.TRIM_EYE, B.TRIM_SPIRE,
      B.TRIM_FLOW, B.TRIM_BOLT, B.TRIM_WAYFINDER, B.TRIM_RAISER, B.TRIM_SHAPER, B.TRIM_HOST
    ];
    if (rng() < (isHighTier ? 0.18 : 0.10)) {
      const tplId = (isHighTier && rng() < 0.45) ? B.TEMPLATE_NETHERITE : trimPool[(rng() * trimPool.length) | 0];
      const emptyIdx = arr.findIndex(x => x.count === 0);
      if (emptyIdx >= 0) arr[emptyIdx] = { id: tplId, count: 1, dur: 0, maxDur: 0 };
    }
  }
  function _packChestArr(arr) {
    return arr.map(s => (s && s.id && s.count > 0) ? [s.id, s.count, s.dur || 0, s.maxDur || 0, s.ench ? 1 : 0, s.trim || 0] : null);
  }
  function serializeChestData() {
    const chests = [];
    for (const [dk, arr] of chestStorageMap.entries()) {
      if (Array.isArray(arr) && (arr.some(s => s && s.id && s.count > 0) || consumedLootChests.has(dk))) {
        chests.push([dk, _packChestArr(arr)]);
      }
    }
    const ender = enderChestSlots.some(s => s && s.id && s.count > 0)
      ? enderChestSlots.map(s => (s && s.id && s.count > 0) ? [s.id, s.count, s.dur || 0, s.maxDur || 0, s.ench ? 1 : 0, s.trim || 0] : null)
      : null;
    const tamedDragons = [];
    for (let i = 0; i < mobs.length; i++) {
      const mb = mobs[i];
      if (!mb || mb._dead || !mb.tamed || !mb.elemDragon) continue;
      tamedDragons.push({ el: mb.elemDragon, x: +mb.x.toFixed(2), y: +mb.y.toFixed(2), z: +mb.z.toFixed(2), growth: mb.growth || 0, saddled: !!mb.saddled, sitting: !!mb.sitting, hp: Math.round(mb.hp), gender: mb.gender || 'M', dragonArmor: mb.dragonArmor ? { ...mb.dragonArmor } : null });
    }
    const incEggs = [];
    for (const eg of incubatingEggs.values()) incEggs.push({ x: eg.x, y: eg.y, z: eg.z, el: eg.el, eggId: eg.eggId, timer: +eg.timer.toFixed(2) });
    return {
      chests: chests.slice(-1200),
      consumedLoot: Array.from(consumedLootChests).slice(-4000),
      enderChest: ender,
      tamedDragons: tamedDragons.slice(0, 16),
      incubatingEggs: incEggs.slice(0, 16)
    };
  }
  function _unpackChestArr(raw, cap = 27) {
    const out = createEmptyChestSlots(cap);
    if (!Array.isArray(raw)) return out;
    for (let i = 0; i < Math.min(cap, raw.length); i++) {
      const r = raw[i];
      if (!r) continue;
      if (Array.isArray(r)) {
        out[i] = { id: r[0] || 0, count: r[1] || 0, dur: r[2] || 0, maxDur: r[3] || 0, ench: !!r[4], trim: r[5] || null };
      } else if (r && r.id) {
        out[i] = { id: r.id || 0, count: r.count || 0, dur: r.dur || 0, maxDur: r.maxDur || 0, ench: !!r.ench, trim: r.trim ? { ...r.trim } : null };
      }
    }
    return out;
  }
  function restoreChestData(src) {
    if (!src) return;
    if (Array.isArray(src.consumedLoot)) {
      for (let i = 0; i < src.consumedLoot.length; i++) {
        const k = String(src.consumedLoot[i] || '');
        if (k) consumedLootChests.add(k.includes(':') ? k : ('overworld:' + k));
      }
    }
    if (Array.isArray(src.chests)) {
      for (let i = 0; i < src.chests.length; i++) {
        const entry = src.chests[i];
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const rawKey = String(entry[0] || '');
        const dimKey = rawKey.includes(':') ? rawKey : ('overworld:' + rawKey);
        const len = Array.isArray(entry[1]) && entry[1].length <= 27 ? 27 : 54;
        chestStorageMap.set(dimKey, _unpackChestArr(entry[1], len));
        consumedLootChests.add(dimKey);
      }
    }
    if (Array.isArray(src.enderChest)) {
      enderChestSlots = _unpackChestArr(src.enderChest, 27);
    }
    if (Array.isArray(src.tamedDragons)) {
      for (const td of src.tamedDragons) {
        if (!td || !td.el) continue;
        const dm = hatchTamedDragon(td.el, td.x, td.y, td.z, td);
        if (dm && typeof td.hp === 'number') dm.hp = Math.max(1, Math.min(dm.maxHp, td.hp));
      }
    }
    if (Array.isArray(src.incubatingEggs)) {
      for (const eg of src.incubatingEggs) {
        if (!eg || !eg.eggId) continue;
        incubatingEggs.set(modKey(eg.x, eg.y, eg.z), { x: eg.x, y: eg.y, z: eg.z, el: eg.el, eggId: eg.eggId, timer: eg.timer || 8.0 });
      }
    }
  }
  function toDimChestKey(k, dim = currentDimension) {
    if (!k) return '';
    if (String(k).includes(':')) return String(k);
    return (dim || 'overworld') + ':' + toTrueChestKey(k);
  }
  function getOrCreateChestSlots(k, blockId) {
    if (isEnderChestBlock(blockId)) return enderChestSlots;
    const tk = toTrueChestKey(k);
    const dimTk = toDimChestKey(k);
    let arr = chestStorageMap.get(dimTk);
    if (!arr && currentDimension === 'overworld' && chestStorageMap.has(tk)) {
      arr = chestStorageMap.get(tk);
      chestStorageMap.delete(tk);
      chestStorageMap.set(dimTk, arr);
    }
    const cap = (BLOCK_DEF[blockId] && BLOCK_DEF[blockId].chestSlots) || 27;
    if (!arr) {
      const canRollLoot = !consumedLootChests.has(dimTk) && !worldMods.has(dimModKey ? dimModKey(...tk.split(',').map(Number), currentDimension) : tk);
      arr = createEmptyChestSlots(cap);
      consumedLootChests.add(dimTk);
      if (canRollLoot) _fillNaturalChestLoot(arr, blockId, tk, dimTk);
      chestStorageMap.set(dimTk, arr);
      if (typeof broadcastChestSync === 'function') broadcastChestSync(dimTk, blockId, _packChestArr(arr));
    } else {
      consumedLootChests.add(dimTk);
    }
    return arr;
  }
  function syncActiveChestSlotsToNet() {
    if (activeChestKey && !isEnderChestBlock(_activeChestBlockId) && typeof broadcastChestSync === 'function') {
      const dk1 = toDimChestKey(activeChestKey);
      const a1 = chestStorageMap.get(dk1);
      if (a1) broadcastChestSync(dk1, _activeChestBlockId, _packChestArr(a1));
      if (activeChestPartnerKey) {
        const dk2 = toDimChestKey(activeChestPartnerKey);
        const a2 = chestStorageMap.get(dk2);
        if (a2) broadcastChestSync(dk2, _activeChestBlockId, _packChestArr(a2));
      }
    }
    if (typeof schedulePlayerRoomSave === 'function') schedulePlayerRoomSave(true);
  }
  function _handleChestSlotTap(linearIdx) {
    if (!activeChestKey) return;
    const s = _getChestLinearSlot(linearIdx);
    if (!s || s.count <= 0) return;
    addItemToInventory(s.id, s.count, s);
    _clearSlotObj(s);
    syncActiveChestSlotsToNet();
    playSfx('pickup'); renderChestModal(_activeChestBlockId); renderHotbar();
  }
  function _handleChestInvTap(idx) {
    if (!activeChestKey) return;
    const s = inventory[idx];
    if (!s || s.count <= 0) return;
    const maxS = (BLOCK_DEF[s.id]?.tool || BLOCK_DEF[s.id]?.armorSlot || s.ench || s.trim || (s.maxDur > 0 && s.dur < s.maxDur)) ? 1 : 99;
    let put = false;
    if (maxS > 1) {
      for (const arr of _activeChestArrs) {
        for (let j = 0; j < arr.length; j++) {
          if (arr[j].id === s.id && arr[j].count > 0 && !arr[j].ench && !arr[j].trim && !(arr[j].maxDur > 0 && arr[j].dur < arr[j].maxDur) && arr[j].count < maxS) {
            const mv = Math.min(maxS - arr[j].count, s.count); arr[j].count += mv; s.count -= mv; put = true;
            if (s.count <= 0) { _clearSlotObj(s); break; }
          }
        }
        if (s.count <= 0) break;
      }
    }
    if (s.count > 0) {
      for (const arr of _activeChestArrs) {
        for (let j = 0; j < arr.length; j++) {
          if (arr[j].count === 0) {
            arr[j] = { id: s.id, count: s.count, dur: s.dur, maxDur: s.maxDur, ench: !!s.ench, trim: s.trim ? { ...s.trim } : null };
            _clearSlotObj(s); put = true; break;
          }
        }
        if (s.count <= 0) break;
      }
    }
    if (put) { syncActiveChestSlotsToNet(); playSfx('place'); renderChestModal(_activeChestBlockId); if (idx < 9) renderHotbar(); }
    else showToast('📦 Rương đã đầy!');
  }
  function renderChestModal(blockId) {
    if (!activeChestKey) return;
    hideMcTooltip();
    const isEnder = isEnderChestBlock(blockId);
    const pts = activeChestKey.split(',');
    const wx = +pts[0], wy = +pts[1], wz = +pts[2];
    const pair = isEnder ? null : findDoubleChestPartner(wx, wy, wz, blockId);
    const k1 = pair ? pair.pk : activeChestKey;
    const k2 = pair ? pair.sk : null;
    activeChestPartnerKey = k2 && k2 !== activeChestKey ? k2 : (pair && pair.pk !== activeChestKey ? pair.pk : null);
    _hingesAnimating = true;
    const arr1 = getOrCreateChestSlots(k1, blockId);
    const arr2 = k2 ? getOrCreateChestSlots(k2, blockId) : null;
    const titleEl = document.getElementById('chestModalTitle');
    if (titleEl) {
      if (isEnder) titleEl.textContent = 'Ender Chest (Toàn cầu)';
      else if (blockId === B.CHEST) titleEl.textContent = pair ? 'Large Chest' : 'Chest';
      else {
        const cleanChestName = (BLOCK_DEF[blockId]?.name || 'Chest').replace(/\s*\(\d+\s*Ô\)\s*$/, '').trim();
        titleEl.textContent = pair ? `Large ${cleanChestName}` : cleanChestName;
      }
    }
    const allArrs = arr2 ? [arr1, arr2] : [arr1];
    _activeChestArrs = allArrs;
    _activeChestBlockId = blockId;
    const totalSlots = arr1.length + (arr2 ? arr2.length : 0);
    const cg = document.getElementById('chestGrid'), ig = document.getElementById('chestInvGrid'), hg = document.getElementById('chestHbGrid');
    _ensureSlotGridPool(cg, _chestSlotUI, totalSlots, (ui, k) => {
      ui.div.dataset.chestSlot = String(k);
      ui.div.addEventListener('pointerdown', (e) => startInvDrag(e, 'chest', { idx: k, originEl: ui.div, modal: 'chest' }));
      ui.div.addEventListener('click', () => { if (!invDrag.suppressClick) _handleChestSlotTap(k); });
    });
    for (let i = 0; i < totalSlots; i++) _syncSimpleSlotUI(_chestSlotUI[i], _getChestLinearSlot(i));
    _syncInvPairPools(ig, _chestBpUI, hg, _chestHbUI, _handleChestInvTap, 'chestInv', 'chest');
  }
  function openChestModal(wx, wy, wz, blockId) {
    isPlaying = false; mining.active = false; clearMoveKeys(); resetInvDragState();
    if (document.pointerLockElement) document.exitPointerLock();
    const k = modKey(wx, wy, wz);
    const pair = isEnderChestBlock(blockId) ? null : findDoubleChestPartner(wx, wy, wz, blockId);
    const pk = pair ? pair.pk : k;
    const pCoords = pair ? [pair.px, pair.py, pair.pz] : [wx, wy, wz];
    if (!interactiveVisuals.has(pk)) {
      createAnimatedBlockVisual(pCoords[0], pCoords[1], pCoords[2], blockId, chunkKey(pCoords[0] >> 4, pCoords[2] >> 4));
    }
    activeChestKey = k;
    activeChestPartnerKey = pair ? (pair.pk === k ? pair.sk : pair.pk) : null;
    for (const ck of [activeChestKey, activeChestPartnerKey]) {
      const v = ck && interactiveVisuals.get(ck);
      if (v && v.group) v.group.visible = true;
    }
    _hingesAnimating = true;
    playSfx('place');
    renderChestModal(blockId);
    document.getElementById('chestModal').classList.remove('hidden');
    updateMobileUiScale();
    requestAnimationFrame(updateMobileUiScale);
  }
  function closeChestModal() {
    syncActiveChestSlotsToNet();
    hideMcTooltip(); resetInvDragState();
    activeChestKey = null;
    activeChestPartnerKey = null;
    _activeChestArrs = [];
    _hingesAnimating = true;
    playSfx('break');
    document.getElementById('chestModal').classList.add('hidden');
    isPlaying = true; safeLockPointer();
  }
  document.getElementById('btnCloseChest').addEventListener('click', closeChestModal);

  // Villager Trading System (Aligned 4-Column Grid + Job-Site Professions: Toolsmith & Armorer)
  const VILLAGER_TRADES = [
    { costId: B.PLANKS,     costQty: 8,  giveId: B.TORCH_BLOCK,   giveQty: 6,  label: 'Đèn Lồng Phát Sáng' },
    { costId: B.STONE,      costQty: 12, giveId: B.ARROW,         giveQty: 12, label: 'Mũi Tên Sắt' },
    { costId: B.COAL,       costQty: 4,  giveId: B.APPLE,         giveQty: 4,  label: 'Táo Đỏ Tươi' },
    { costId: B.IRON_INGOT, costQty: 4,  giveId: B.BOW,           giveQty: 1,  label: 'Cung Tên Săn Bắn' },
    { costId: B.GOLD_INGOT, costQty: 3,  giveId: B.GOLD_APPLE,    giveQty: 2,  label: 'Táo Vàng Hồi Máu' },
    { costId: B.IRON_INGOT, costQty: 6,  giveId: B.IRON_ARMOR,    giveQty: 1,  label: 'Giáp Sắt (+6)' },
    { costId: B.GOLD_INGOT, costQty: 5,  giveId: B.VOID_PEARL,    giveQty: 2,  label: 'Ngọc Hư Không' },
    { costId: B.DIAMOND,    costQty: 2,  giveId: B.DIAMOND_SWORD, giveQty: 1,  label: 'Kiếm Kim Cương' }
  ];
  const TOOLSMITH_TRADES = [
    { costId: B.COAL,       costQty: 15, giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.IRON_INGOT, costQty: 4,  giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.DIAMOND,    costQty: 1,  giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.EMERALD,    costQty: 1,  giveId: B.STONE_PICK,     giveQty: 1, label: 'Cuốc Đá' },
    { costId: B.EMERALD,    costQty: 4,  giveId: B.IRON_PICK,      giveQty: 1, label: 'Cuốc Sắt' },
    { costId: B.EMERALD,    costQty: 12, giveId: B.DIAMOND_AXE,    giveQty: 1, label: 'Rìu Kim Cương' },
    { costId: B.EMERALD,    costQty: 10, giveId: B.DIAMOND_SHOVEL, giveQty: 1, label: 'Xẻng Kim Cương' },
    { costId: B.EMERALD,    costQty: 18, giveId: B.DIAMOND_PICK,   giveQty: 1, label: 'Cuốc Kim Cương' }
  ];
  const ARMORER_TRADES = [
    { costId: B.COAL,        costQty: 15, giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.IRON_INGOT,  costQty: 4,  giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.LAVA_BUCKET, costQty: 1,  giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.DIAMOND,     costQty: 1,  giveId: B.EMERALD,        giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.EMERALD,     costQty: 5,  giveId: B.IRON_HELMET,    giveQty: 1, label: 'Mũ Giáp Sắt' },
    { costId: B.EMERALD,     costQty: 9,  giveId: B.IRON_ARMOR,     giveQty: 1, label: 'Áo Giáp Sắt' },
    { costId: B.EMERALD,     costQty: 7,  giveId: B.IRON_LEGS,      giveQty: 1, label: 'Quần Giáp Sắt' },
    { costId: B.EMERALD,     costQty: 4,  giveId: B.IRON_BOOTS,     giveQty: 1, label: 'Giày Giáp Sắt' },
    { costId: B.EMERALD,     costQty: 5,  giveId: B.SHIELD,         giveQty: 1, label: 'Khiên Chắn' },
    { costId: B.EMERALD,     costQty: 15, giveId: B.DIAMOND_HELMET, giveQty: 1, label: 'Mũ Kim Cương' },
    { costId: B.EMERALD,     costQty: 24, giveId: B.DIAMOND_ARMOR,  giveQty: 1, label: 'Áo Kim Cương' },
    { costId: B.EMERALD,     costQty: 20, giveId: B.DIAMOND_LEGS,   giveQty: 1, label: 'Quần Kim Cương' },
    { costId: B.EMERALD,     costQty: 14, giveId: B.DIAMOND_BOOTS,  giveQty: 1, label: 'Giày Kim Cương' }
  ];
  const BUTCHER_TRADES = [
    { costId: B.RAW_PORK,   costQty: 7, giveId: B.EMERALD,       giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.RAW_BEEF,   costQty: 8, giveId: B.EMERALD,       giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.RAW_CHICKEN,costQty: 10,giveId: B.EMERALD,       giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.EMERALD,    costQty: 1, giveId: B.COOKED_PORK,   giveQty: 5, label: 'Thịt Heo Nướng' },
    { costId: B.EMERALD,    costQty: 1, giveId: B.COOKED_BEEF,   giveQty: 4, label: 'Bít Tết Nướng' },
    { costId: B.EMERALD,    costQty: 2, giveId: B.SWEET_BERRIES, giveQty: 8, label: 'Quả Mọng Đỏ' }
  ];
  const FARMER_TRADES = [
    { costId: B.WHEAT,      costQty: 15, giveId: B.EMERALD,       giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.POTATO,     costQty: 18, giveId: B.EMERALD,       giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.CARROT,     costQty: 16, giveId: B.EMERALD,       giveQty: 1, label: 'Ngọc Lục Bảo' },
    { costId: B.EMERALD,    costQty: 1,  giveId: B.BREAD,         giveQty: 6, label: 'Bánh Mì Nóng' },
    { costId: B.EMERALD,    costQty: 2,  giveId: B.GOLDEN_CARROT, giveQty: 3, label: 'Cà Rốt Vàng' },
    { costId: B.EMERALD,    costQty: 2,  giveId: B.COOKED_FISH,   giveQty: 4, label: 'Cá Nướng Giòn' }
  ];
  let activeTradeProf = 'villager';
  function detectVillagerProfession(mobHit = null) {
    if (mobHit && mobHit.villagerProf) return mobHit.villagerProf;
    const ox = Math.floor(mobHit ? mobHit.x : player.x);
    const oy = Math.floor(mobHit ? mobHit.y : player.y);
    const oz = Math.floor(mobHit ? mobHit.z : player.z);
    for (let dy = -2; dy <= 3; dy++) {
      for (let dz = -6; dz <= 6; dz++) {
        for (let dx = -6; dx <= 6; dx++) {
          const bid = getBlockWorld(ox + dx, oy + dy, oz + dz);
          if (bid === B.SMITHING_TABLE) return 'toolsmith';
          if (bid === B.BLAST_FURNACE) return 'armorer';
        }
      }
    }
    return 'villager';
  }
  function renderTradeModal() {
    hideMcTooltip();
    const list = document.getElementById('tradeList');
    if (!list) return;
    list.innerHTML = '';
    const trades = activeTradeProf === 'toolsmith' ? TOOLSMITH_TRADES
      : (activeTradeProf === 'armorer' ? ARMORER_TRADES
      : (activeTradeProf === 'butcher' ? BUTCHER_TRADES
      : (activeTradeProf === 'farmer' ? FARMER_TRADES : VILLAGER_TRADES)));
    for (const tr of trades) {
      const have = countItem(tr.costId);
      const can = have >= tr.costQty;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'trade-row';
      row.disabled = !can;
      const costName = shortItemTip(tr.costId) || '?';
      const giveName = shortItemTip(tr.giveId) || tr.label;

      const mkTradeSlot = (itemId, qty, tip) => {
        const sl = document.createElement('div');
        sl.className = 'trade-slot';
        sl.title = tip;
        const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28;
        drawBlockPreview(cv.getContext('2d'), itemId);
        sl.appendChild(cv);
        if (qty > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = String(qty);
          sl.appendChild(cnt);
        }
        return sl;
      };

      const costSlot = mkTradeSlot(tr.costId, tr.costQty, `${costName} (${have}/${tr.costQty})`);
      const arrowWrap = document.createElement('div');
      arrowWrap.className = 'trade-arrow-wrap';
      arrowWrap.innerHTML = `<svg class="mc-arrow-svg" width="24" height="17" viewBox="0 0 22 15" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 5h13V1l9 6.5-9 6.5v-4H0z" fill="#8b8b8b"/></svg>`
        + (!can ? `<svg class="trade-cross" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 2l1-1 4 4 4-4 1 1-4 4 4 4-1 1-4-4-4 4-1-1 4-4z" fill="#dc2626"/></svg>` : '');
      const giveSlot = mkTradeSlot(tr.giveId, tr.giveQty, giveName);
      const nm = document.createElement('span');
      nm.className = 'trade-name';
      nm.textContent = giveName;

      row.append(costSlot, arrowWrap, giveSlot, nm);
      row.addEventListener('click', () => {
        if (countItem(tr.costId) < tr.costQty) return;
        consumeItem(tr.costId, tr.costQty);
        addItemToInventory(tr.giveId, tr.giveQty);
        playSfx('craft');
        showToast(`Đã đổi ${tr.giveQty}x ${giveName}`);
        renderHotbar(); renderTradeModal();
      });
      list.appendChild(row);
    }
  }
  function openTradeModal(mobHit = null) {
    isPlaying = false; mining.active = false; clearMoveKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    activeTradeProf = detectVillagerProfession(mobHit);
    const titleEl = document.getElementById('tradeModalTitle');
    const titleMap = { toolsmith: 'Thợ Rèn (Blacksmith)', armorer: 'Thợ Giáp (Armorer)', butcher: 'Đồ Tể (Butcher)', farmer: 'Nông Dân (Farmer)', villager: 'Dân Làng' };
    if (titleEl) titleEl.textContent = titleMap[activeTradeProf] || 'Dân Làng';
    renderTradeModal();
    document.getElementById('tradeModal').classList.remove('hidden');
    updateMobileUiScale();
    requestAnimationFrame(updateMobileUiScale);
  }
  function closeTradeModal() { hideMcTooltip(); document.getElementById('tradeModal').classList.add('hidden'); isPlaying = true; safeLockPointer(); }
  document.getElementById('btnCloseTrade').addEventListener('click', closeTradeModal);

  // Authentic Minecraft Smithing Table UI Controller (Upgrade Gear -> Netherite + Armor Trim Preview)
  const smithState = { tpl: null, base: null, mat: null, yaw: 0.35 };
  function computeSmithResult() {
    const { tpl, base, mat } = smithState;
    if (!tpl || !base || !mat) return null;
    if (tpl.id === B.TEMPLATE_NETHERITE && SMITH_UPGRADE_MAP[base.id] && mat.id === B.NETHERITE_INGOT) {
      return { id: SMITH_UPGRADE_MAP[base.id], count: 1, dur: null, maxDur: BLOCK_DEF[SMITH_UPGRADE_MAP[base.id]]?.maxDur || 0, ench: !!base.ench, trim: base.trim ? { ...base.trim } : null, mode: 'upgrade' };
    }
    const tplDef = BLOCK_DEF[tpl.id], baseDef = BLOCK_DEF[base.id], matDef = TRIM_MATERIALS[mat.id];
    if (tplDef?.smithTemplate === 'trim' && baseDef?.armorSlot && baseDef.armorSlot !== 'offhand' && matDef) {
      return { id: base.id, count: 1, dur: base.dur, maxDur: base.maxDur, ench: !!base.ench, trim: { pattern: tplDef.trimId, id: matDef.id, matId: mat.id, hex: matDef.hex, label: matDef.label }, mode: 'trim' };
    }
    return null;
  }
  function renderSmithArmorStandPreview(item) {
    const cv = document.getElementById('smithPreviewCanvas');
    if (!cv) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    const cosY = Math.cos(smithState.yaw), absW = Math.max(0.32, Math.abs(cosY)), sx = Math.round(W * 0.5);
    // Stone base plate & wooden Armor Stand frame
    c.fillStyle = '#52525b'; c.fillRect(sx - 24, 106, 48, 8);
    c.fillStyle = '#71717a'; c.fillRect(sx - 24, 104, 48, 3);
    c.fillStyle = '#784e2a';
    c.fillRect(sx - 2, 24, 4, 80); // central post
    c.fillRect(sx - Math.round(18 * absW), 44, Math.round(36 * absW), 4); // shoulders bar
    c.fillRect(sx - Math.round(9 * absW), 70, Math.round(18 * absW), 3); // hip bar
    c.fillRect(sx - Math.round(8 * absW), 72, 4, 32); c.fillRect(sx + Math.round(4 * absW), 72, 4, 32);
    if (!item || !item.id) return;
    const def = BLOCK_DEF[item.id]; if (!def) return;
    if (def.armorSlot && def.armorTier && def.armorSlot !== 'offhand') {
      const pal = ARMOR_TIER_PAL[def.armorTier] || ARMOR_TIER_PAL.iron;
      const tr = resolveTrimColors(def.armorTier, item.trim);
      const trimHex = tr ? tr.main : null;
      const pat = (item.trim && item.trim.pattern) ? item.trim.pattern.toLowerCase() : '';
      const bw = Math.round(22 * absW), lw = Math.max(6, Math.round(9 * absW));
      c.fillStyle = pal.main; c.strokeStyle = pal.dark; c.lineWidth = 2;
      if (def.armorSlot === 'helmet') {
        c.fillRect(sx - bw / 2 - 2, 16, bw + 4, 22);
        c.fillStyle = pal.hi; c.fillRect(sx - bw / 2, 18, bw, 4);
        if (def.armorTier === 'netherite') { c.fillStyle = pal.dark; c.fillRect(sx - 2, 26, 4, 10); }
        if (trimHex) {
          c.fillStyle = trimHex;
          c.fillRect(sx - bw / 2 - 2, 25, bw + 4, 3);
          if (pat === 'silence' || pat === 'ward' || pat === 'eye') c.fillRect(sx - 3, 17, 6, 8);
        }
      } else if (def.armorSlot === 'chest') {
        c.fillRect(sx - bw / 2, 42, bw, 28);
        c.fillRect(sx - bw / 2 - lw, 42, lw - 1, 18);
        c.fillRect(sx + bw / 2 + 1, 42, lw - 1, 18);
        c.fillStyle = pal.hi; c.fillRect(sx - bw / 2 + 2, 44, bw - 4, 4);
        if (trimHex) {
          c.fillStyle = trimHex;
          c.fillRect(sx - bw / 2 - lw, 44, lw - 1, 3); c.fillRect(sx + bw / 2 + 1, 44, lw - 1, 3);
          if (pat === 'wild' || pat === 'rib' || pat === 'ward') {
            c.fillRect(sx - bw / 2 + 2, 49, bw - 4, 3);
            c.fillRect(sx - bw / 2 + 3, 55, bw - 6, 3);
            c.fillRect(sx - bw / 2 + 2, 62, bw - 4, 3);
          } else if (pat === 'silence') {
            c.fillRect(sx - bw / 2 + 2, 48, bw - 4, 14);
            c.fillStyle = pal.dark; c.fillRect(sx - 2, 52, 4, 6);
          } else {
            c.fillRect(sx - bw / 2 + 3, 50, bw - 6, 3);
            c.fillRect(sx - Math.round(bw * 0.25), 57, Math.max(4, Math.round(bw * 0.5)), 6);
          }
        }
      } else if (def.armorSlot === 'legs') {
        c.fillRect(sx - bw / 2, 68, bw, 7);
        c.fillRect(sx - bw / 2, 74, Math.max(5, lw), 18);
        c.fillRect(sx + bw / 2 - Math.max(5, lw), 74, Math.max(5, lw), 18);
        if (trimHex) {
          c.fillStyle = trimHex;
          c.fillRect(sx - bw / 2 + 1, 69, bw - 2, 3);
          c.fillRect(sx - bw / 2 + 1, 80, Math.max(4, lw - 2), 3);
          c.fillRect(sx + bw / 2 - Math.max(5, lw) + 1, 80, Math.max(4, lw - 2), 3);
        }
      } else {
        c.fillRect(sx - bw / 2, 90, Math.max(6, lw), 14);
        c.fillRect(sx + bw / 2 - Math.max(6, lw), 90, Math.max(6, lw), 14);
        if (trimHex) {
          c.fillStyle = trimHex;
          c.fillRect(sx - bw / 2, 93, Math.max(6, lw), 3);
          c.fillRect(sx + bw / 2 - Math.max(6, lw), 93, Math.max(6, lw), 3);
          c.fillRect(sx - bw / 2, 100, Math.max(6, lw), 2);
          c.fillRect(sx + bw / 2 - Math.max(6, lw), 100, Math.max(6, lw), 2);
        }
      }
      if (item.ench) {
        c.fillStyle = 'rgba(192,132,252,0.32)';
        c.fillRect(sx - bw / 2 - 4, 16, bw + 8, 88);
      }
    } else {
      const tmp = document.createElement('canvas'); tmp.width = 48; tmp.height = 48;
      drawBlockPreview(tmp.getContext('2d'), item.id, item);
      c.drawImage(tmp, sx - 24, 34, 48, 48);
    }
  }
  function _handleSmithInvTap(idx) {
    const s = inventory[idx];
    if (!s || s.count <= 0) return;
    const def = BLOCK_DEF[s.id]; if (!def) return;
    let targetKey = null;
    if (def.smithTemplate && !smithState.tpl) targetKey = 'tpl';
    else if ((SMITH_UPGRADE_MAP[s.id] || (def.armorSlot && def.armorSlot !== 'offhand')) && !smithState.base) targetKey = 'base';
    else if ((s.id === B.NETHERITE_INGOT || TRIM_MATERIALS[s.id]) && !smithState.mat) targetKey = 'mat';
    if (!targetKey) { showToast('⚒️ Chọn Mẫu Rèn, Đồ Kim Cương/Giáp hoặc Thỏi Netherite/Khoáng chất!'); return; }
    smithState[targetKey] = { id: s.id, count: 1, dur: s.dur, maxDur: s.maxDur, ench: !!s.ench, trim: s.trim ? { ...s.trim } : null };
    s.count--;
    if (s.count <= 0) _clearSlotObj(s);
    playSfx('place'); renderSmithingModal(); if (idx < 9) renderHotbar();
  }
  function renderSmithingModal() {
    hideMcTooltip();
    const res = computeSmithResult();
    const anyFail = !res && [smithState.tpl, smithState.base, smithState.mat].filter(Boolean).length >= 2;
    const crossEl = document.getElementById('smithArrowCross');
    if (crossEl) crossEl.classList.toggle('show', anyFail);
    const hintEl = document.getElementById('smithRuleHint');
    if (hintEl) {
      hintEl.textContent = res
        ? (res.mode === 'upgrade' ? 'Nâng cấp Netherite (Giữ nguyên phù phép • 0 XP)' : `Khắc viền ${res.trim.pattern} (${res.trim.label})`)
        : 'Mẫu rèn + Trang bị + Thỏi / Khoáng chất';
    }
    const paintSlot = (id, item, hintText) => {
      const el = document.getElementById(id); if (!el) return;
      drawSimpleSlotEl(el, item);
      if (!item) el.title = hintText;
    };
    paintSlot('smithTemplateSlot', smithState.tpl, 'Mẫu Nâng Cấp / Armor Trim');
    paintSlot('smithBaseSlot', smithState.base, 'Đồ Kim Cương / Áo Giáp');
    paintSlot('smithMatSlot', smithState.mat, 'Thỏi Netherite / Khoáng chất');
    paintSlot('smithResultSlot', res, 'Kết quả');
    renderSmithArmorStandPreview(res || smithState.base);
    const invG = document.getElementById('smithInvGrid'), hbG = document.getElementById('smithHbGrid');
    if (!invG || !hbG) return;
    _syncInvPairPools(invG, _smithBpUI, hbG, _smithHbUI, _handleSmithInvTap, '', 'smithing');
  }
  function openSmithingModal() {
    isPlaying = false; mining.active = false; clearMoveKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    smithState.yaw = 0.35;
    renderSmithingModal();
    document.getElementById('smithingModal').classList.remove('hidden');
    updateMobileUiScale();
    requestAnimationFrame(updateMobileUiScale);
  }
  function closeSmithingModal() {
    hideMcTooltip();
    for (const k of ['tpl', 'base', 'mat']) {
      if (smithState[k]) { addItemToInventory(smithState[k].id, 1, smithState[k]); smithState[k] = null; }
    }
    document.getElementById('smithingModal')?.classList.add('hidden');
    renderHotbar();
    isPlaying = true; safeLockPointer();
  }
  document.getElementById('btnCloseSmithing')?.addEventListener('click', closeSmithingModal);
  ['tpl', 'base', 'mat'].forEach((k, idx) => {
    const id = idx === 0 ? 'smithTemplateSlot' : (idx === 1 ? 'smithBaseSlot' : 'smithMatSlot');
    document.getElementById(id)?.addEventListener('click', () => {
      if (!smithState[k]) return;
      addItemToInventory(smithState[k].id, 1, smithState[k]);
      smithState[k] = null;
      playSfx('pickup'); renderSmithingModal(); renderHotbar();
    });
  });
  document.getElementById('smithResultSlot')?.addEventListener('click', () => {
    const res = computeSmithResult();
    if (!res) return;
    smithState.tpl = null; smithState.base = null; smithState.mat = null;
    addItemToInventory(res.id, 1, res);
    playSfx('craft');
    renderSmithingModal(); renderHotbar();
  });
  (() => {
    const box = document.getElementById('smithPreviewBox');
    let dragging = false, lx = 0;
    box?.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (dragging && !document.getElementById('smithingModal')?.classList.contains('hidden')) {
        smithState.yaw += (e.clientX - lx) * 0.03; lx = e.clientX;
        renderSmithArmorStandPreview(computeSmithResult() || smithState.base);
      }
    });
  })();

  function mcHudIconHtml(bgUri, fgUri = '', extraCls = '', delayMs = 0) {
    const st = delayMs ? ` style="animation-delay:${delayMs}ms"` : '';
    return `<span class="mc-ico${extraCls ? ' ' + extraCls : ''}"${st}>` +
      (bgUri ? `<img src="${bgUri}" alt="" />` : '') +
      (fgUri ? `<img src="${fgUri}" alt="" />` : '') +
      `</span>`;
  }

  let _lastStatusBarSig = '';
  let _prevHudHp = 20, _prevHudAirFull = 10, _hudHpAnimSeq = 0, _hudHpMode = '', _hudHpOld = 20, _hudAirMode = '';
  function renderStatusBars() {
    const airShow = (player.eyesInWater || player.air < player.maxAir);
    const fullB = Math.floor(player.air);
    const fracB = player.air - fullB;
    const popState = (fracB > 0.02 && fracB < 0.34) ? 2 : (fracB >= 0.34 ? 1 : 0);
    if (player.hp !== _prevHudHp) {
      _hudHpMode = (player.hp > _prevHudHp) ? 'heal' : 'hurt';
      _hudHpOld = _prevHudHp;
      _prevHudHp = player.hp;
      _hudHpAnimSeq++;
    }
    if (fullB !== _prevHudAirFull) {
      _hudAirMode = (fullB > _prevHudAirFull) ? 'refill' : 'drain';
      _prevHudAirFull = fullB;
    }
    const sig = `${player.hp}|${player.armor}|${player.hunger}|${airShow ? 1 : 0}|${fullB}|${popState}|${_hudHpAnimSeq}`;
    const rideDrg = (typeof player !== 'undefined' && player.ridingDragon && !player.ridingDragon._dead) ? player.ridingDragon : null;
    const drgHpI = rideDrg ? Math.max(0, Math.ceil(rideDrg.hp)) : -1;
    const drgMaxI = rideDrg ? Math.max(1, Math.ceil(rideDrg.maxHp)) : 0;
    const fullSig = `${sig}|${drgHpI}/${drgMaxI}`;
    if (fullSig === _lastStatusBarSig) return;
    _lastStatusBarSig = fullSig;
    const hud = _mcBundle.hud || {};
    const drgRow = document.getElementById('dragonHealthRow');
    if (drgRow) {
      if (rideDrg) {
        drgRow.classList.add('visible');
        const totalHearts = 10;
        const filledHalves = Math.max(0, Math.min(20, Math.round((rideDrg.hp / drgMaxI) * 20)));
        let mHtml = '';
        for (let i = 0; i < totalHearts; i++) {
          const idx = totalHearts - 1 - i;
          const v = filledHalves - idx * 2;
          const fg = v >= 2 ? hud.heart_full : (v >= 1 ? hud.heart_half : '');
          mHtml += mcHudIconHtml(hud.heart_bg, fg, fg ? 'mount-heart' : '');
        }
        drgRow.innerHTML = mHtml;
      } else {
        drgRow.classList.remove('visible');
        if (drgRow.innerHTML) drgRow.innerHTML = '';
      }
    }
    const lowHp = player.hp > 0 && player.hp <= 4;
    let hHtml = '', arHtml = '', fHtml = '';
    // 1) Hearts (Left -> Right, 10x 9x9px official Minecraft hearts + smooth half-heart heal & hurt animations!)
    const hpMin = Math.min(_hudHpOld, player.hp), hpMax = Math.max(_hudHpOld, player.hp);
    for (let i = 0; i < 10; i++) {
      const v = player.hp - i * 2;
      const fg = v >= 2 ? hud.heart_full : (v >= 1 ? hud.heart_half : '');
      let cls = lowHp ? 'low-hp' : '';
      let delayMs = lowHp ? ((i * 53) % 180) : 0;
      const lo = i * 2, hi = i * 2 + 2;
      if (_hudHpMode === 'heal' && hi > hpMin && lo < hpMax) {
        cls += ' heart-heal';
        delayMs = (i % 3) * 35;
      } else if (_hudHpMode === 'hurt' && lo < hpMax) {
        cls += ' heart-hurt';
        delayMs = (i % 3) * 20;
      }
      hHtml += mcHudIconHtml(hud.heart_bg, fg, cls.trim(), delayMs);
    }
    // 2) Armor (Stacks upward in rows of 20 pts; high-tier NUCRAFT armor > 20 opens gold & cyan upper rows!)
    const arRows = player.armor > 0 ? Math.min(2, Math.ceil(player.armor / 20)) : 1;
    for (let r = 0; r < arRows; r++) {
      let rowHtml = '';
      for (let i = 0; i < 10; i++) {
        const v = (player.armor - r * 20) - i * 2;
        const ico = v >= 2 ? hud.armor_full : (v >= 1 ? hud.armor_half : (r === 0 ? hud.armor_empty : ''));
        if (ico) rowHtml += mcHudIconHtml(ico, '');
      }
      arHtml += `<div class="mc-armor-subrow tier-${r + 1}">${rowHtml}</div>`;
    }
    // 3) Hunger / Food (Right -> Left fill, empties from LEFT side first — 100% authentic Minecraft!)
    for (let i = 0; i < 10; i++) {
      const idx = 9 - i;
      const v = player.hunger - idx * 2;
      const fg = v >= 2 ? hud.food_full : (v >= 1 ? hud.food_half : '');
      fHtml += mcHudIconHtml(hud.food_empty, fg);
    }
    document.getElementById('heartsRow').innerHTML = hHtml;
    const arRow = document.getElementById('armorRow');
    arRow.innerHTML = arHtml; arRow.classList.toggle('empty-armor', player.armor <= 0);
    document.getElementById('hungerRow').innerHTML = fHtml;
    // 4) Smooth Oxygen Bubbles (Right -> Left above Hunger when underwater, smooth bursting & refilling!)
    const airRow = document.getElementById('airRow');
    if (airShow) {
      airRow.classList.add('visible');
      let aHtml = '';
      for (let i = 0; i < 10; i++) {
        const idx = 9 - i;
        if (idx < fullB) {
          const rCls = (_hudAirMode === 'refill' && idx === fullB - 1) ? 'bubble-refill' : '';
          aHtml += mcHudIconHtml(hud.air_full, '', rCls);
        } else if (idx === fullB && popState === 2) {
          aHtml += mcHudIconHtml(hud.air_burst, '', 'bubble-pop');
        } else if (idx === fullB && popState === 1) {
          aHtml += mcHudIconHtml(hud.air_full, '');
        } else {
          aHtml += mcHudIconHtml('', '');
        }
      }
      airRow.innerHTML = aHtml;
    } else airRow.classList.remove('visible');
  }

  function showToast(msg) {
    // Đã tắt thanh thông báo popup theo yêu cầu người dùng
    return;
  }

