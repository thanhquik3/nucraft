// NUCRAFT Module: src/entities/Player.js — Player physics, swimming, Rig3 animations, skins, armor, raycast & mining

  /* ============================================================================
   * 7. PLAYER, INVENTORY (WITH TOOL DURABILITY & ARMOR), 3D DROPS & THIRD-PERSON AVATAR
   * ============================================================================ */
  const player = {
    x: 8.5, y: 14, z: 8.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.15,
    onGround: false, inWater: false, eyesInWater: false, inLava: false, eyesInLava: false, sneaking: false,
    sitting: false, doubleTapSprint: false,
    inBoat: false, spyglassZoom: false, waterBreathT: 0, bedSpawn: null, ridingDragon: null,
    hp: 20, maxHp: 20, armor: 5, hunger: 20, maxHunger: 20, air: 10, maxAir: 10,
    equip: { helmet: 0, chest: 0, legs: 0, boots: 0, offhand: 0 },
    equipMeta: { helmet: null, chest: null, legs: null, boots: null, offhand: null },
    armorToughness: 0, kbResist: 0,
    blockingT: 0, shieldRaiseT: 0, shieldDisableT: 0, shieldImpactT: 0, offhandDur: 336, offhandMaxDur: 336, regenTimer: 0,
    flying: false, lastStepCycle: 0,
    xp: 0, level: 0, daysPlayed: 1, swiftSneak: 0,
    fallStartY: 14, landAnimT: 0, dead: false, invuln: 0, walkBob: 0, burnTime: 0, _stepCamOff: 0,
    swingT: 0, swingDur: 0.25, swingAct: 'attack', _mineHitFired: false, mineSwingPhase: 0, selectedSlot: 0,
    swordCombo: 0, swordAtkHit: 0, swordAtkSeq: 0, swordAtkT: 0, swordAtkDur: 0, swordAtkActive: false
  };
  function startHandSwing(dur = 0.36, act = 'attack') {
    if (player.swingT > 0.001 && (act || 'attack') === player.swingAct) {
      const curDur = Math.max(0.18, player.swingDur || dur);
      if ((1.0 - player.swingT / curDur) < 0.36) return;
    }
    player.swingT = dur;
    player.swingDur = dur;
    player.swingAct = act || 'attack';
    player.swingStep = ((player.swingStep || 0) + 1) % 6;
    player._mineHitFired = false;
  }

  // ===================== 20+ AUTHENTIC MINECRAFT VOXEL SKINS + CUSTOM PNG PERSISTENCE =====================
  const CUSTOM_SKINS_STORAGE_KEY = 'nucraft_custom_skins_v1';
  const BUILTIN_SKIN_COUNT = (Array.isArray(window.NUCRAFT_SKIN_BUNDLE) && window.NUCRAFT_SKIN_BUNDLE.length) ? window.NUCRAFT_SKIN_BUNDLE.length : 1;
  const PLAYER_SKINS = (Array.isArray(window.NUCRAFT_SKIN_BUNDLE) && window.NUCRAFT_SKIN_BUNDLE.length)
    ? window.NUCRAFT_SKIN_BUNDLE.map(s => ({ ...s }))
    : [{ id: 's_101e98da3da8a765', name: 'Nón Ếch Dễ Thương', slim: true, skin: '#ccc5c5', hair: '#a2c08d', eye: '#2b2430', sleeve: '#e9e1e2', png: '' }];
  function loadSavedCustomSkins() {
    try {
      const raw = localStorage.getItem(CUSTOM_SKINS_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const s of arr) {
        if (s && typeof s.id === 'string' && typeof s.png === 'string' && s.png.startsWith('data:image/png')) {
          if (!PLAYER_SKINS.some(x => x.id === s.id)) PLAYER_SKINS.push({ ...s, isCustom: true });
        }
      }
    } catch (_) {}
  }
  function saveCustomSkinsList() {
    const customs = PLAYER_SKINS.filter(s => s.isCustom);
    try {
      localStorage.setItem(CUSTOM_SKINS_STORAGE_KEY, JSON.stringify(customs));
    } catch (_) {
      // Evict oldest custom skin once if localStorage quota is tight
      if (customs.length > 1) {
        const dropId = customs[0].id;
        const idx = PLAYER_SKINS.findIndex(s => s.id === dropId);
        if (idx >= 0) PLAYER_SKINS.splice(idx, 1);
        try { localStorage.setItem(CUSTOM_SKINS_STORAGE_KEY, JSON.stringify(PLAYER_SKINS.filter(s => s.isCustom))); } catch (__) {}
      }
    }
  }
  loadSavedCustomSkins();
  let selectedSkinId = localStorage.getItem('luanti_skin_id') || PLAYER_SKINS[0].id;
  if (!PLAYER_SKINS.some(s => s.id === selectedSkinId)) selectedSkinId = PLAYER_SKINS[0].id;
  let customSkinImage = null, customSkinSlim = false;
  const skinTexCache = new Map();
  const skinCanvasCache = new Map();
  const _skinViewportThumbCache = new Map();
  let _skinRefreshQueued = false;

  function getSkinDef(id) {
    if (id === 'custom') {
      return { id: 'custom', name: 'Skin Tùy Chỉnh (.PNG)', slim: customSkinSlim, skin: '#f6d4c2', hair: '#4a3525', eye: '#2b2430', sleeve: '#94a3b8', png: '' };
    }
    return PLAYER_SKINS.find(s => s.id === id) || PLAYER_SKINS[0];
  }

  function isSkinSlim(skinId) {
    return (skinId === 'custom') ? !!customSkinSlim : !!getSkinDef(skinId).slim;
  }

  function _countOpaqueBox(ctx, x, y, w, h) {
    const d = ctx.getImageData(x, y, w, h).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
    return n;
  }

  function detectSlimFromCanvas(ctx) {
    try {
      const s = Math.max(1, Math.round((ctx.canvas?.width || 64) / 64));
      const rArmSide = _countOpaqueBox(ctx, 54 * s, 20 * s, 2 * s, 12 * s);
      const rArmTop  = _countOpaqueBox(ctx, 50 * s, 16 * s, 2 * s, 4 * s);
      const lArmSide = _countOpaqueBox(ctx, 46 * s, 52 * s, 2 * s, 12 * s);
      const lArmTop  = _countOpaqueBox(ctx, 42 * s, 48 * s, 2 * s, 4 * s);
      // Tolerates artist signatures bleeding a few pixels into right-arm side when top & left-arm slim strips are empty
      return (lArmSide === 0 && rArmTop === 0 && lArmTop === 0) || (rArmSide === 0 && lArmSide === 0);
    } catch (_) { return false; }
  }

  function _sampleCanvasHex(ctx, coords, fallbackHex) {
    for (const [x, y] of coords) {
      try {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (d[3] > 128) return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      } catch (_) {}
    }
    return fallbackHex;
  }

  // Validate & normalize any 64x64, 64x32, or HD (e.g. 128x128) Minecraft PNG skin into standard 64x64 + detect Slim vs Classic
  function normalizeCustomSkinImage(img) {
    if (!img || !img.width || !img.height) return { error: '⚠ Không đọc được kích thước ảnh PNG!' };
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const isSquare = (w === h && w >= 64);
    const isLegacy = (w === h * 2 && w >= 64);
    if (!isSquare && !isLegacy) {
      return { error: '⚠ Ảnh PNG phải đúng cấu trúc skin Minecraft (64×64, 64×32 hoặc 128×128)!' };
    }
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, 64, 64);
    let slim = false;
    if (isLegacy) {
      c.drawImage(img, 0, 0, w, h, 0, 0, 64, 32);
      const mirrorBox = (sx, sy, sw, sh, dx, dy) => {
        c.save(); c.translate(dx + sw, dy); c.scale(-1, 1); c.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh); c.restore();
      };
      mirrorBox(0, 20, 4, 12, 24, 52); mirrorBox(8, 20, 4, 12, 16, 52);
      mirrorBox(4, 20, 4, 12, 20, 52); mirrorBox(12, 20, 4, 12, 28, 52);
      mirrorBox(4, 16, 4, 4, 20, 48);  mirrorBox(8, 16, 4, 4, 24, 48);
      mirrorBox(40, 20, 4, 12, 40, 52); mirrorBox(48, 20, 4, 12, 32, 52);
      mirrorBox(44, 20, 4, 12, 36, 52); mirrorBox(52, 20, 4, 12, 44, 52);
      mirrorBox(44, 16, 4, 4, 36, 48);  mirrorBox(48, 16, 4, 4, 40, 48);
    } else {
      c.drawImage(img, 0, 0, w, h, 0, 0, 64, 64);
      // Detect Slim at native resolution first for HD skins, then fallback to 64x64
      if (w > 64 && w <= 512) {
        const hi = document.createElement('canvas'); hi.width = w; hi.height = h;
        const hc = hi.getContext('2d', { willReadFrequently: true });
        hc.imageSmoothingEnabled = false;
        hc.drawImage(img, 0, 0, w, h);
        slim = detectSlimFromCanvas(hc);
      } else {
        slim = detectSlimFromCanvas(c);
      }
    }
    const coreHead = _countOpaqueBox(c, 8, 8, 8, 8);
    const coreBody = _countOpaqueBox(c, 20, 20, 8, 12);
    if (coreHead < 8 && coreBody < 12) {
      return { error: '⚠ Ảnh PNG bị trống ở vùng đầu/thân nên không tương thích làm skin!' };
    }
    cv._decoded = true;
    return {
      canvas: cv,
      slim,
      skin: _sampleCanvasHex(c, [[11, 13], [12, 13], [11, 14], [10, 11]], '#f6d4c2'),
      hair: _sampleCanvasHex(c, [[11, 3], [11, 8], [27, 10], [43, 3]], '#4a3525'),
      eye: _sampleCanvasHex(c, [[10, 13], [13, 13], [9, 12], [14, 12]], '#2b2430'),
      sleeve: _sampleCanvasHex(c, [[44, 24], [45, 22], [22, 24], [36, 56]], '#94a3b8'),
      png: cv.toDataURL('image/png')
    };
  }

  function buildCustomSkinCanvas(img) {
    const norm = normalizeCustomSkinImage(img);
    if (norm && norm.canvas) { customSkinSlim = norm.slim; return norm.canvas; }
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    if (img) cv.getContext('2d').drawImage(img, 0, 0, 64, 64);
    customSkinSlim = false;
    return cv;
  }

  function scheduleSkinViewsRefresh() {
    if (_skinRefreshQueued) return;
    _skinRefreshQueued = true;
    requestAnimationFrame(() => {
      _skinRefreshQueued = false;
      for (const tex of skinTexCache.values()) tex.needsUpdate = true;
      for (const r of [
        typeof playerAvatar !== 'undefined' ? playerAvatar : null,
        typeof skinPreviewRig !== 'undefined' ? skinPreviewRig : null,
        typeof titleSkinRig !== 'undefined' ? titleSkinRig : null,
        typeof invPreviewRig !== 'undefined' ? invPreviewRig : null
      ]) {
        if (r && r.skinMat) { r.skinMat.needsUpdate = true; r.outerMat.needsUpdate = true; }
      }
      if (typeof heldModelCache !== 'undefined') {
        heldModelCache.delete(0);
        if (typeof inventory !== 'undefined' && typeof player !== 'undefined' && !inventory[player.selectedSlot]?.id && typeof updateHeldViewModel === 'function') {
          updateHeldViewModel(0);
        }
      }
      if (typeof refreshSkinThumbCanvases === 'function') refreshSkinThumbCanvases();
      if (typeof renderSkinPreview3DOnce === 'function') renderSkinPreview3DOnce();
      if (typeof drawCharPreview === 'function') drawCharPreview();
      if (typeof syncTitleAvatarFace === 'function') syncTitleAvatarFace();
      if (typeof syncAllPlayerAvatarFaces === 'function') syncAllPlayerAvatarFaces();
    });
  }

  function paintFallbackSkinCanvas(cv, sk) {
    const c = cv.getContext('2d');
    const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    c.clearRect(0, 0, 64, 64);
    r(0, 8, 32, 8, sk.skin); r(8, 0, 8, 8, sk.hair); r(16, 0, 8, 8, sk.skin);
    r(0, 8, 8, 6, sk.hair); r(16, 8, 8, 6, sk.hair); r(24, 8, 8, 8, sk.hair);
    r(9, 12, 2, 2, sk.eye); r(13, 12, 2, 2, sk.eye);
    r(16, 20, 24, 12, sk.sleeve); r(40, 20, 16, 12, sk.sleeve); r(32, 52, 16, 12, sk.sleeve);
    r(0, 20, 16, 12, sk.hair); r(16, 52, 16, 12, sk.hair);
  }

  function getSkinCanvas(skinId) {
    if (skinId === 'custom' && customSkinImage) {
      return buildCustomSkinCanvas(customSkinImage);
    }
    if (skinCanvasCache.has(skinId)) return skinCanvasCache.get(skinId);
    const sk = getSkinDef(skinId);
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    paintFallbackSkinCanvas(cv, sk);
    skinCanvasCache.set(skinId, cv);
    if (sk.png) {
      const img = new Image();
      img.onload = () => {
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, 64, 64);
        c.drawImage(img, 0, 0, 64, 64);
        cv._decoded = true;
        _skinViewportThumbCache.delete(skinId);
        const cachedTex = skinTexCache.get(skinId);
        if (cachedTex) cachedTex.needsUpdate = true;
        scheduleSkinViewsRefresh();
      };
      img.src = sk.png;
    }
    return cv;
  }

  function preloadAllSkinTextures() {
    for (const sk of PLAYER_SKINS) getSkinTexture(sk.id);
  }

  function getSkinTexture(skinId) {
    if (skinId !== 'custom' && skinTexCache.has(skinId)) return skinTexCache.get(skinId);
    const cv = getSkinCanvas(skinId);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    if (skinId !== 'custom') skinTexCache.set(skinId, tex);
    return tex;
  }

  // Exact Minecraft 64x64 Box UV Mapper (maps pixel coords (u,v) with (w,h,d) cleanly to BoxGeometry faces!)
  function makeSkinBox(wPx, hPx, dPx, uPx, vPx, mat, scale = 0.0625, inflate = 0) {
    const geo = new THREE.BoxGeometry(wPx * scale + inflate * 2, hPx * scale + inflate * 2, dPx * scale + inflate * 2);
    const uv = geo.attributes.uv;
    // Three.js BoxGeometry face order: +X(left), -X(right), +Y(top), -Y(bottom), +Z(front), -Z(back)
    const setFace = (fIdx, x, y, rw, rh) => {
      const u0 = x / 64, u1 = (x + rw) / 64;
      const v1 = 1 - y / 64, v0 = 1 - (y + rh) / 64;
      const i = fIdx * 4;
      if (fIdx === 3) {
        // Invert V on -Y bottom face so +Z front aligns with front edge instead of back edge
        uv.setXY(i, u0, v0); uv.setXY(i + 1, u1, v0); uv.setXY(i + 2, u0, v1); uv.setXY(i + 3, u1, v1);
      } else {
        uv.setXY(i, u0, v1); uv.setXY(i + 1, u1, v1); uv.setXY(i + 2, u0, v0); uv.setXY(i + 3, u1, v0);
      }
    };
    setFace(0, uPx + dPx + wPx, vPx + dPx, dPx, hPx); // +X
    setFace(1, uPx,             vPx + dPx, dPx, hPx); // -X
    setFace(2, uPx + dPx,       vPx,       wPx, dPx); // +Y top
    setFace(3, uPx + dPx + wPx, vPx,       wPx, dPx); // -Y bot
    setFace(4, uPx + dPx,       vPx + dPx, wPx, hPx); // +Z front
    setFace(5, uPx + dPx * 2 + wPx, vPx + dPx, wPx, hPx); // -Z back
    uv.needsUpdate = true;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Seamless UV-Split Half-Limb Box for Articulated Elbows & Knees (Fresh Player Extension / Smooth Moves!)
  function makeSkinBoxPart(wPx, partH, dPx, uPx, vPx, yOffPx, mat, scale = 0.0625, inflate = 0) {
    const geo = new THREE.BoxGeometry(wPx * scale + inflate * 2, partH * scale + inflate * 2, dPx * scale + inflate * 2);
    const uv = geo.attributes.uv;
    const setFace = (fIdx, x, y, rw, rh) => {
      const u0 = x / 64, u1 = (x + rw) / 64;
      const v1 = 1 - y / 64, v0 = 1 - (y + rh) / 64;
      const i = fIdx * 4;
      uv.setXY(i, u0, v1); uv.setXY(i + 1, u1, v1); uv.setXY(i + 2, u0, v0); uv.setXY(i + 3, u1, v0);
    };
    const sv = vPx + dPx + yOffPx;
    setFace(0, uPx + dPx + wPx, sv, dPx, partH);
    setFace(1, uPx,             sv, dPx, partH);
    setFace(2, uPx + dPx,       yOffPx === 0 ? vPx : sv, wPx, yOffPx === 0 ? dPx : 1);
    setFace(3, uPx + dPx + wPx, yOffPx > 0 ? vPx : (sv + partH - 1), wPx, yOffPx > 0 ? dPx : 1);
    setFace(4, uPx + dPx,       sv, wPx, partH);
    setFace(5, uPx + dPx * 2 + wPx, sv, wPx, partH);
    uv.needsUpdate = true;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // (Hoisted ARMOR_TIER_PAL, armorTexCache & getArmorTexture are defined above buildTextureAtlas)

  function applyArmorToPlayerRig(rig, eq, eqMeta = null) {
    if (!rig || !rig.armor) return;
    const setArmorMat = (meshOrGroup, itemId, meta = null) => {
      if (!meshOrGroup) return;
      const def = itemId ? BLOCK_DEF[itemId] : null;
      const tier = (def && def.armorTier) ? def.armorTier : null;
      const pal = tier ? (ARMOR_TIER_PAL[tier] || ARMOR_TIER_PAL.iron) : null;
      const trimObj = (meta && meta.trim && meta.trim.pattern) ? meta.trim : null;
      const trimRes = pal ? resolveTrimColors(tier, trimObj) : null;
      const trimHex = trimRes ? trimRes.hexInt : null;
      meshOrGroup.visible = !!pal;
      meshOrGroup.traverse((ch) => {
        if (!ch.isMesh || !ch.material) return;
        const isRel = !!(ch.userData && ch.userData.isArmorRelief);
        const isAcc = !!(ch.userData && ch.userData.isAccent);
        ch.material.userData = ch.material.userData || {};
        ch.material.userData.isArmorRelief = isRel;
        ch.material.userData.isRainbowAccent = isAcc && !trimHex;
        if (!pal) {
          _rainbowMats.delete(ch.material);
          return;
        }
        const tex = getArmorTexture(tier, trimObj);
        const isLeather = tier === 'leather';
        ch.material.map = isRel ? (pal.rainbow && !(isAcc && trimHex) ? getDreamWaterSwatchTex(pal.waterSeed || 0) : null) : tex;
        ch.material.roughness = isRel ? (isLeather ? 0.80 : Math.max(0.18, pal.rough - 0.06)) : pal.rough;
        ch.material.metalness = isRel ? (isLeather ? 0.05 : Math.min(0.88, pal.metal + 0.18)) : pal.metal;
        if (trimHex !== null && isAcc) {
          _rainbowMats.delete(ch.material);
          ch.material.color.setHex(trimHex);
          if (ch.material.emissive) {
            ch.material.emissive.setHex(trimHex);
            ch.material.emissiveIntensity = 0.22;
          }
        } else if (pal.rainbow) {
          _rainbowMats.add(ch.material);
          applyRainbowToMat(ch.material, _dreamRainbowHue);
        } else {
          _rainbowMats.delete(ch.material);
          ch.material.color.setHex(isRel ? (isAcc ? (pal.trim || pal.hex) : pal.hex) : 0xffffff);
          if (ch.material.emissive) {
            ch.material.emissive.setHex(pal.hex);
            ch.material.emissiveIntensity = pal.emit !== undefined ? pal.emit : (isLeather ? 0.02 : (tier === 'diamond' ? 0.14 : 0.09));
          }
        }
        ch.material.needsUpdate = true;
      });
    };
    const m = eqMeta || {};
    setArmorMat(rig.armor.helmet, eq.helmet, m.helmet);
    if (rig.armor.dragonHelmet) rig.armor.dragonHelmet.visible = (eq.helmet === B.DRAGON_HEAD);
    if (eq.helmet === B.DRAGON_HEAD && rig.armor.helmet) rig.armor.helmet.visible = false;
    if (rig.headAcc) rig.headAcc.visible = !eq.helmet; // Keep cute face/bangs visible, tuck tall horns/ears under helmet!
    setArmorMat(rig.armor.chest, eq.chest, m.chest);
    setArmorMat(rig.armor.pauldronL, eq.chest, m.chest);
    setArmorMat(rig.armor.pauldronR, eq.chest, m.chest);
    const isEly = !!(eq.chest && BLOCK_DEF[eq.chest] && BLOCK_DEF[eq.chest].isElytra);
    const isPhoenixEly = (eq.chest === B.ELYTRA_PHOENIX);
    if (isEly) {
      if (rig.armor.chest) rig.armor.chest.visible = false;
      if (rig.armor.pauldronL) rig.armor.pauldronL.visible = false;
      if (rig.armor.pauldronR) rig.armor.pauldronR.visible = false;
    }
    if (rig.armor.elytra) {
      rig.armor.elytra.visible = isEly;
      rig.armor.elyPhxFlag = isPhoenixEly;
      rig.armor.elyStatePrev = -1;
      if (rig.armor.elyNormGroups) for (const grp of rig.armor.elyNormGroups) grp.visible = !isPhoenixEly;
      if (rig.armor.elyPhxGroups) for (const grp of rig.armor.elyPhxGroups) grp.visible = isPhoenixEly;
    }
    setArmorMat(rig.armor.waist, eq.legs, m.legs);
    setArmorMat(rig.armor.legL, eq.legs, m.legs);
    setArmorMat(rig.armor.legR, eq.legs, m.legs);
    setArmorMat(rig.armor.bootL, eq.boots, m.boots);
    setArmorMat(rig.armor.bootR, eq.boots, m.boots);
    if (rig.armor.shield) rig.armor.shield.visible = (eq.offhand === B.SHIELD);
    if (rig.armor.offTorch) rig.armor.offTorch.visible = (eq.offhand === B.TORCH_BLOCK);
    if (rig.armor.offLantern) rig.armor.offLantern.visible = (eq.offhand === B.LANTERN);
    if (rig.armor.offSoulLantern) rig.armor.offSoulLantern.visible = (eq.offhand === B.SOUL_LANTERN);
    if (rig.armor.offTotem) rig.armor.offTotem.visible = (eq.offhand === B.TOTEM_UNDYING);
  }

  function recalcPlayerArmor() {
    let total = 0, tough = 0, kb = 0;
    for (const k of ['helmet', 'chest', 'legs', 'boots', 'offhand']) {
      const id = player.equip[k], d = id ? BLOCK_DEF[id] : null;
      if (d && d.armorVal) total += d.armorVal;
      if (d && d.toughness) tough += d.toughness;
      if (d && d.kbResist) kb += d.kbResist;
    }
    let elemSet = null;
    for (const k of ['helmet', 'chest', 'legs', 'boots']) {
      const id = player.equip[k], d = id ? BLOCK_DEF[id] : null;
      const es = (d && d.dragonElemSet) ? d.dragonElemSet : '';
      if (!es) { elemSet = null; break; }
      if (elemSet === null) elemSet = es;
      else if (elemSet !== es) { elemSet = null; break; }
    }
    player.dragonArmorSet = elemSet;
    if (elemSet === 'earth') kb = Math.max(kb, 0.75);
    player.armor = Math.min(40, total);
    player.armorToughness = tough;
    player.kbResist = Math.min(0.85, kb);
    if (typeof playerAvatar !== 'undefined' && playerAvatar) applyArmorToPlayerRig(playerAvatar, player.equip, player.equipMeta);
    if (typeof updateOffhandViewModel === 'function') updateOffhandViewModel(player.equip.offhand || 0);
    renderStatusBars();
  }

  let invPreviewRenderer = null, invPreviewScene = null, invPreviewCam = null, invPreviewRig = null, invPreviewRotY = 0.22;
  function ensureInvPreview3D() {
    const cv = document.getElementById('charPreviewCanvas');
    if (!cv || invPreviewRenderer) return;
    try {
      invPreviewRenderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, preserveDrawingBuffer: true });
      invPreviewRenderer.setClearColor(0x000000, 0);
      if (typeof THREE.ACESFilmicToneMapping !== 'undefined') invPreviewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      invPreviewRenderer.toneMappingExposure = 0.88;
      invPreviewRenderer.setSize(106, 156, false);
      invPreviewScene = new THREE.Scene();
      invPreviewCam = new THREE.PerspectiveCamera(36, 106 / 156, 0.1, 20);
      invPreviewCam.position.set(0, 1.04, 4.35);
      invPreviewCam.lookAt(0, 0.96, 0);
      invPreviewScene.add(new THREE.AmbientLight(0xffffff, 0.58));
      const dL = new THREE.DirectionalLight(0xfff5e4, 0.45); dL.position.set(2.2, 4.0, 3.2); invPreviewScene.add(dL);
      const rL = new THREE.DirectionalLight(0xcbd5e1, 0.18); rL.position.set(-2.4, 2.0, -2.4); invPreviewScene.add(rL);
      invPreviewRig = createPlayerRig(selectedSkinId, null, null, null);
      invPreviewScene.add(invPreviewRig.g);
      let dragging = false, lx = 0;
      cv.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; });
      window.addEventListener('pointerup', () => { dragging = false; });
      window.addEventListener('pointermove', (e) => {
        if (dragging && !document.getElementById('invModal').classList.contains('hidden')) {
          invPreviewRotY += (e.clientX - lx) * 0.02; lx = e.clientX; drawCharPreview();
        }
      });
    } catch (_) {}
  }
  function drawCharPreview() {
    ensureInvPreview3D();
    if (!invPreviewRenderer || !invPreviewScene || !invPreviewCam || !invPreviewRig) return;
    if (invPreviewRig.skinId !== selectedSkinId) applySkinToRig(invPreviewRig, selectedSkinId);
    applyArmorToPlayerRig(invPreviewRig, player.equip, player.equipMeta);
    const sel = inventory[player.selectedSlot];
    setRigHeldItem(invPreviewRig, (sel && sel.count > 0) ? sel.id : 0, (sel && sel.count > 0) ? sel : null);
    animatePlayerRig(invPreviewRig, { speed: 0, onGround: true, heldId: (sel && sel.count > 0) ? sel.id : 0 }, 0.016, performance.now() * 0.001);
    invPreviewRig.g.rotation.y = invPreviewRotY;
    invPreviewRenderer.render(invPreviewScene, invPreviewCam);
  }

  let _equipSlotEls = null, _lastCharPreviewEquipSig = '';
  function renderEquipmentUI() {
    if (!_equipSlotEls) _equipSlotEls = Array.from(document.querySelectorAll('.equip-slot'));
    let eqTotalSig = String(selectedSkinId || '');
    for (let i = 0; i < _equipSlotEls.length; i++) {
      const el = _equipSlotEls[i];
      const key = el.dataset.eq;
      const itemId = player.equip[key] || 0;
      const eqMeta = (player.equipMeta && player.equipMeta[key]) || null;
      const slotSig = itemId > 0 ? `${itemId}:${eqMeta && eqMeta.ench ? 1 : 0}:${eqMeta && eqMeta.trim ? eqMeta.trim.pattern + '_' + (eqMeta.trim.matId || '') : ''}` : '0';
      eqTotalSig += '|' + slotSig;
      el.classList.toggle('equipped', itemId > 0);
      el.classList.toggle('selected-swap', selectedEquipSlot === key);
      el.classList.toggle('shield-disabled', key === 'offhand' && itemId === B.SHIELD && (player.shieldDisableT || 0) > 0);
      if (el._eqSig !== slotSig) {
        el._eqSig = slotSig;
        delete el.dataset.mcTip;
        el.title = itemId > 0 ? shortItemTip(itemId, eqMeta) : '';
        const ghost = el._ghostEl || (el._ghostEl = el.querySelector('.eq-ghost'));
        const cv = el._cvEl || (el._cvEl = el.querySelector('canvas'));
        if (ghost) ghost.style.display = itemId > 0 ? 'none' : '';
        if (cv) {
          const ctx = el._ctx2d || (el._ctx2d = cv.getContext('2d'));
          ctx.clearRect(0, 0, cv.width, cv.height);
          cv.classList.remove('dream-rainbow-icon');
          if (itemId > 0) drawBlockPreview(ctx, itemId, eqMeta);
        }
      }
      let durEl = el._durEl || (el._durEl = el.querySelector('.slot-dur'));
      if (key === 'offhand' && itemId === B.SHIELD && (player.offhandMaxDur || 336) > 0 && (player.offhandDur || 336) < (player.offhandMaxDur || 336)) {
        if (!durEl) {
          durEl = document.createElement('div'); durEl.className = 'slot-dur';
          durEl.innerHTML = '<div class="slot-dur-fill"></div>';
          el.appendChild(durEl);
          el._durEl = durEl;
        }
        const pct = Math.max(0, Math.min(1, (player.offhandDur || 0) / (player.offhandMaxDur || 336)));
        durEl.style.display = 'block';
        durEl.firstElementChild.style.width = `${Math.round(pct * 100)}%`;
        durEl.firstElementChild.style.background = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#eab308' : '#ef4444');
      } else if (durEl) {
        durEl.style.display = 'none';
      }
    }
    const sel = inventory[player.selectedSlot];
    eqTotalSig += '|' + ((sel && sel.count > 0) ? _itemMetaCacheKey(sel.id, sel) : 0);
    if (_lastCharPreviewEquipSig !== eqTotalSig) {
      _lastCharPreviewEquipSig = eqTotalSig;
      drawCharPreview();
    }
  }

  function getActiveShieldHand() {
    if (player.equip && player.equip.offhand === B.SHIELD) return 'offhand';
    const sel = (typeof inventory !== 'undefined') ? inventory[player.selectedSlot] : null;
    if (sel && sel.count > 0 && sel.id === B.SHIELD) return 'mainhand';
    return null;
  }

  function isPlayerShieldBlocking() {
    return !!getActiveShieldHand() && (player.shieldDisableT || 0) <= 0 && (player.sneaking || player.blockingT > 0);
  }

  function damagePlayerShield(amount, isAxeHit = false) {
    const hand = getActiveShieldHand();
    if (!hand) return;
    player.shieldImpactT = 1.0;
    const cost = Math.max(1, Math.ceil(amount));
    if (isAxeHit) {
      player.shieldDisableT = 5.0;
      player.blockingT = 0;
      playSfx('break');
      spawnPixelFx('axe_break', player.x - Math.sin(player.yaw) * 0.65, player.y + 1.15, player.z - Math.cos(player.yaw) * 0.65, { count: 2, scale: 1.25, life: 0.42 });
      showToast('🪓 Rìu đã vô hiệu hóa Khiên 5 giây!');
    }
    if (hand === 'offhand') {
      if (gameMode !== 'creative') player.offhandDur = Math.max(0, (player.offhandDur ?? 336) - cost);
      if (player.offhandDur <= 0) {
        player.equip.offhand = 0;
        player.offhandDur = 336;
        playSfx('break');
        spawnParticles(player.x, player.y + 1.1, player.z, 0x94a3b8, 12, false);
        recalcPlayerArmor();
      }
      renderEquipmentUI();
    } else if (gameMode !== 'creative') {
      damageHeldTool(cost);
    }
    renderHotbar();
  }

  function equipItemToSlot(eqKey, invIdx) {
    const slot = inventory[invIdx];
    if (!slot || slot.count <= 0) return false;
    const prevId = player.equip[eqKey] || 0;
    const prevEm = player.equipMeta && player.equipMeta[eqKey];
    const prevDef = prevId ? BLOCK_DEF[prevId] : null;
    const prevMaxDur = (prevId === B.SHIELD) ? (player.offhandMaxDur || 336) : ((prevEm && prevEm.maxDur) || (prevDef && prevDef.maxDur) || 0);
    const prevDur = (prevId === B.SHIELD) ? (player.offhandDur || 336) : ((prevEm && typeof prevEm.dur === 'number' && prevEm.dur > 0) ? prevEm.dur : prevMaxDur);
    const prevMeta = (prevEm || prevMaxDur > 0) ? { dur: prevDur, maxDur: prevMaxDur, ench: !!(prevEm && prevEm.ench), trim: (prevEm && prevEm.trim) ? { ...prevEm.trim } : null } : null;
    const prevOffDur = prevDur;
    const newId = slot.id;
    const newDef = BLOCK_DEF[newId];
    const newMaxDur = (newId === B.SHIELD) ? (slot.maxDur || 336) : (slot.maxDur || (newDef && newDef.maxDur) || 0);
    const newDur = (newId === B.SHIELD) ? (slot.dur || 336) : ((typeof slot.dur === 'number' && slot.dur > 0) ? slot.dur : newMaxDur);
    const newMeta = (slot.ench || slot.trim || newMaxDur > 0) ? { dur: newDur, maxDur: newMaxDur, ench: !!slot.ench, trim: slot.trim ? { ...slot.trim } : null } : null;
    slot.count--;
    if (slot.count <= 0) { slot.id = 0; slot.dur = 0; slot.maxDur = 0; slot.ench = false; slot.trim = null; }
    player.equip[eqKey] = newId;
    if (player.equipMeta) player.equipMeta[eqKey] = newMeta;
    if (eqKey === 'offhand' && newId === B.SHIELD) {
      player.offhandDur = newDur;
      player.offhandMaxDur = newMaxDur;
    }
    if (prevId > 0) {
      addItemToInventory(prevId, 1, prevMeta);
      if (eqKey === 'offhand' && prevId === B.SHIELD) {
        const restored = inventory.find(s => s.id === B.SHIELD && s.count > 0);
        if (restored) restored.dur = Math.max(1, prevOffDur);
      }
    }
    recalcPlayerArmor();
    renderEquipmentUI();
    renderHotbar();
    playSfx('equip');
    showToast(`🛡️ Đã trang bị ${BLOCK_DEF[newId]?.name || 'Giáp'}!`);
    return true;
  }

  function unequipArmorSlot(eqKey) {
    const prevId = player.equip[eqKey] || 0;
    if (!prevId) return;
    const em = player.equipMeta && player.equipMeta[eqKey];
    const prevDef = BLOCK_DEF[prevId];
    const pMax = (eqKey === 'offhand' && prevId === B.SHIELD) ? (player.offhandMaxDur || 336) : ((em && em.maxDur) || (prevDef && prevDef.maxDur) || 0);
    const pDur = (eqKey === 'offhand' && prevId === B.SHIELD) ? Math.max(1, player.offhandDur || 336) : ((em && typeof em.dur === 'number' && em.dur > 0) ? em.dur : pMax);
    const prevMeta = (em || pMax > 0) ? { dur: pDur, maxDur: pMax, ench: !!(em && em.ench), trim: (em && em.trim) ? { ...em.trim } : null } : null;
    if (!addItemToInventory(prevId, 1, prevMeta)) {
      showToast('🎒 Balo đã đầy! Hãy dọn 1 ô trống trước khi tháo trang bị!');
      return;
    }
    if (eqKey === 'offhand' && prevId === B.SHIELD) {
      player.offhandDur = 336; player.offhandMaxDur = 336;
    }
    player.equip[eqKey] = 0;
    if (player.equipMeta) player.equipMeta[eqKey] = null;
    recalcPlayerArmor();
    renderEquipmentUI();
    renderInventoryModal();
    renderHotbar();
    playSfx('equip');
    showToast(`Đã tháo ${BLOCK_DEF[prevId]?.name || 'trang bị'}`);
  }

  // Full Procedural Hierarchical Player Rig + Multi-State Animator (Local F5 + Remote Co-op Players + AI Companion)
  function makeNameTagSprite(label, badgeHex = '#38bdf8') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(11, 16, 24, 0.78)'; c.fillRect(8, 6, 240, 36);
    c.strokeStyle = badgeHex; c.lineWidth = 3; c.strokeRect(8, 6, 240, 36);
    c.font = 'bold 22px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#f8fafc'; c.fillText(String(label || 'Player').slice(0, 14), 128, 25);
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    sp.scale.set(1.55, 0.30, 1); sp.position.set(0, 2.22, 0);
    return sp;
  }

  function createPlayerRig(skinIdOrColor = PLAYER_SKINS[0].id, _unused1 = null, _unused2 = null, nameLabel = null, badgeHex = '#38bdf8') {
    const skinId = (typeof skinIdOrColor === 'string') ? skinIdOrColor : selectedSkinId;
    const g = new THREE.Group();
    const makeP = (x, y, z, parent) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const tex = getSkinTexture(skinId);
    const skinMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02, alphaTest: 0.1 });
    const outerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });

    // Authentic NameMC 64x64 + R6 Hierarchy (1/16m = 0.0625m per pixel; full 2nd-layer overlays!)
    const hips = makeP(0, 1.125, 0, g);
    const torso = makeP(0, 0, 0, hips);
    const torsoMesh = makeSkinBox(8, 12, 4, 16, 16, skinMat, 0.0625, 0);
    const torsoOuter = makeSkinBox(8, 12, 4, 16, 32, outerMat, 0.0625, 0.016);
    torso.add(torsoMesh, torsoOuter);

    const head = makeP(0, 0.375, 0, torso);
    const headBase = makeSkinBox(8, 8, 8, 0, 0, skinMat, 0.0625, 0);
    headBase.castShadow = false;
    headBase.position.set(0, 0.25, 0); head.add(headBase);
    const headOuter = makeSkinBox(8, 8, 8, 32, 0, outerMat, 0.0625, 0.028);
    headOuter.castShadow = false;
    headOuter.position.set(0, 0.25, 0); head.add(headOuter);
    const headAcc = makeP(0, 0.25, 0, head);

    // NameMC Arms: Slim (3x12x4) & Classic (4x12x4) flush against torso (±0.25) with separate Left/Right UVs + 2nd layer!
    const armL = makeP( 0.25, 0.1875, 0, torso);
    const slimL = new THREE.Group(); slimL.position.set(0.09375, -0.1875, 0);
    slimL.add(makeSkinBox(3, 12, 4, 32, 48, skinMat, 0.0625, 0), makeSkinBox(3, 12, 4, 48, 48, outerMat, 0.0625, 0.015));
    const classicL = new THREE.Group(); classicL.position.set(0.125, -0.1875, 0);
    classicL.add(makeSkinBox(4, 12, 4, 32, 48, skinMat, 0.0625, 0), makeSkinBox(4, 12, 4, 48, 48, outerMat, 0.0625, 0.015));
    armL.add(slimL, classicL);

    const armR = makeP(-0.25, 0.1875, 0, torso);
    const slimR = new THREE.Group(); slimR.position.set(-0.09375, -0.1875, 0);
    slimR.add(makeSkinBox(3, 12, 4, 40, 16, skinMat, 0.0625, 0), makeSkinBox(3, 12, 4, 40, 32, outerMat, 0.0625, 0.015));
    const classicR = new THREE.Group(); classicR.position.set(-0.125, -0.1875, 0);
    classicR.add(makeSkinBox(4, 12, 4, 40, 16, skinMat, 0.0625, 0), makeSkinBox(4, 12, 4, 40, 32, outerMat, 0.0625, 0.015));
    armR.add(slimR, classicR);
    const handHold = makeP(-0.09375, -0.50, 0.07, armR);

    // NameMC Legs: asymmetric Left (16,48 + 0,48) and Right (0,16 + 0,32) with full pants overlay!
    const legL = makeP( 0.25, -0.375, 0, torso);
    const legLGrp = new THREE.Group(); legLGrp.position.set(-0.125, -0.375, 0);
    legLGrp.add(makeSkinBox(4, 12, 4, 16, 48, skinMat, 0.0625, 0), makeSkinBox(4, 12, 4, 0, 48, outerMat, 0.0625, 0.015));
    legL.add(legLGrp);

    const legR = makeP(-0.25, -0.375, 0, torso);
    const legRGrp = new THREE.Group(); legRGrp.position.set(0.125, -0.375, 0);
    legRGrp.add(makeSkinBox(4, 12, 4, 0, 16, skinMat, 0.0625, 0), makeSkinBox(4, 12, 4, 0, 32, outerMat, 0.0625, 0.015));
    legR.add(legRGrp);

    // ===================== AUTHENTIC MINECRAFT R6 3D VOLUMETRIC PIXEL-ART ARMOR =====================
    const mkArmorMat = () => new THREE.MeshStandardMaterial({
      map: getArmorTexture('iron'), color: 0xffffff, roughness: 0.28, metalness: 0.50,
      transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const mkReliefMat = () => new THREE.MeshStandardMaterial({
      color: 0xd4dce6, roughness: 0.26, metalness: 0.65,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const addRelief = (parent, w, h, d, x, y, z, mat, isAccent = false) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.userData.isArmorRelief = true; m.userData.isAccent = isAccent;
      parent.add(m); return m;
    };
    const armHelmMat  = mkArmorMat(), armHelmRelMat  = mkReliefMat(), armHelmAccMat  = mkReliefMat();
    const armChestMat = mkArmorMat(), armChestRelMat = mkReliefMat(), armChestAccMat = mkReliefMat();
    const armLegMat   = mkArmorMat(), armLegRelMat   = mkReliefMat(), armLegAccMat   = mkReliefMat();
    const armBootMat  = mkArmorMat(), armBootRelMat  = mkReliefMat(), armBootAccMat  = mkReliefMat();

    // 1) Volumetric 3D Helmet (Pixel-Art Shell + Sleek Brow Visor, Nasal Guard & Top Crown Crest; castShadow off so face stays clearly lit!)
    const armorHelmet = new THREE.Group(); armorHelmet.position.set(0, 0.25, 0); head.add(armorHelmet);
    const helmShell = makeSkinBox(8, 8, 8, 0, 0, armHelmMat, 0.0625, 0.048); helmShell.castShadow = false;
    armorHelmet.add(helmShell);
    addRelief(armorHelmet, 0.58, 0.065, 0.06, 0, 0.14, 0.288, armHelmRelMat, false).castShadow = false;
    addRelief(armorHelmet, 0.59, 0.036, 0.068, 0, 0.145, 0.294, armHelmAccMat, true).castShadow = false;
    addRelief(armorHelmet, 0.06, 0.105, 0.055, 0, 0.08, 0.292, armHelmRelMat, false).castShadow = false;
    addRelief(armorHelmet, 0.08, 0.06, 0.56, 0, 0.305, 0.0, armHelmRelMat, false).castShadow = false;
    armorHelmet.visible = false;

    const dragonHelmet = build3DDragonHeadMesh(0.84);
    dragonHelmet.position.set(0, 0.0, 0.04);
    dragonHelmet.visible = false;
    head.add(dragonHelmet);

    // 2) Volumetric 3D Chestplate (Pixel-Art Shell + Sculpted Layered Breastplate Plate + Sleek Waist Belt Trim!)
    const armorChest = new THREE.Group(); armorChest.position.set(0, 0, 0); torso.add(armorChest);
    armorChest.add(makeSkinBox(8, 12, 4, 16, 16, armChestMat, 0.0625, 0.036));
    addRelief(armorChest, 0.48, 0.36, 0.06, 0, 0.12, 0.165, armChestRelMat, false);
    addRelief(armorChest, 0.44, 0.32, 0.05, 0, 0.12, -0.16, armChestRelMat, false);
    addRelief(armorChest, 0.58, 0.10, 0.34, 0, -0.26, 0,    armChestRelMat, false);
    addRelief(armorChest, 0.59, 0.04, 0.355, 0, -0.26, 0,   armChestAccMat, true);
    addRelief(armorChest, 0.13, 0.095, 0.055, 0, -0.26, 0.175, armChestAccMat, true);
    armorChest.visible = false;

    const elytraGrp = new THREE.Group(); elytraGrp.position.set(0, 0.28, -0.155); torso.add(elytraGrp);
    const elyNormMats = [
      new THREE.MeshStandardMaterial({ color: 0x3b3a50, roughness: 0.56, metalness: 0.30 }),
      new THREE.MeshStandardMaterial({ color: 0x7e7d99, roughness: 0.44, metalness: 0.24 }),
      new THREE.MeshStandardMaterial({ color: 0xa2a1bf, roughness: 0.38, metalness: 0.18 })
    ];
    const elyPhxMats = [
      new THREE.MeshStandardMaterial({ color: 0x170b0b, roughness: 0.52, metalness: 0.32 }),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.36, metalness: 0.25, emissive: 0x9a3412, emissiveIntensity: 0.28 }),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.24, metalness: 0.15, emissive: 0xf97316, emissiveIntensity: 0.85 })
    ];
    const elyNormGroups = [], elyPhxGroups = [];
    const elyStateObjs = { norm: [[], [], []], phx: [[], [], []] };
    // Shoulder hinge collar connecting left & right wings seamlessly
    const elyCollarN = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.068), elyNormMats[0]);
    elyCollarN.position.set(0, -0.02, 0.005); elyNormGroups.push(elyCollarN); elytraGrp.add(elyCollarN);
    const elyCollarP = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.068), elyPhxMats[0]);
    elyCollarP.position.set(0, -0.02, 0.005); elyCollarP.visible = false; elyPhxGroups.push(elyCollarP); elytraGrp.add(elyCollarP);

    const mkWingPivot = (sideSign) => {
      const p = new THREE.Group(); p.position.set(sideSign * 0.065, 0, 0);
      const buildSteppedStates = (mats, targetList, bucketKey, isPhx) => {
        const wingWrap = new THREE.Group();
        wingWrap.visible = !isPhx;
        targetList.push(wingWrap);
        const addSlats = (parent, slats) => {
          for (const [xl, yt, h, mi, zo, w] of slats) {
            // Overlap horizontally by >=0.016m and in Z cleanly so ZERO V-gap ever forms
            const sl = new THREE.Mesh(new THREE.BoxGeometry(w || 0.072, h, 0.058), mats[mi]);
            sl.position.set(sideSign * xl, yt - h * 0.5, zo); sl.castShadow = true; parent.add(sl);
            if (isPhx && mi >= 1) {
              const tip = new THREE.Mesh(new THREE.BoxGeometry((w || 0.072) * 0.88, 0.11, 0.062), mats[2]);
              tip.position.set(sideSign * xl, yt - h + 0.055, zo); parent.add(tip);
            }
          }
        };
        // Shared cohesive inner wing carapace (columns 0..3)
        addSlats(wingWrap, [
          [0.030,  0.00, 0.72, 0,  0.004, 0.076],
          [0.086,  0.00, 0.82, 1,  0.002, 0.076],
          [0.142, -0.02, 0.88, 1,  0.000, 0.076],
          [0.198, -0.05, 0.90, 2, -0.002, 0.076]
        ]);
        // State 0 (Folded Carapace — compact swept cloak down back)
        const s0 = new THREE.Group();
        addSlats(s0, [
          [0.248, -0.09, 0.84, 2, -0.003, 0.070],
          [0.294, -0.15, 0.72, 1, -0.005, 0.066],
          [0.336, -0.22, 0.54, 0, -0.007, 0.060]
        ]);
        // State 1 (Ready-to-Open / Sneak / Falling Prep — flared medium stepped wings)
        const s1 = new THREE.Group(); s1.visible = false;
        addSlats(s1, [
          [0.252, -0.06, 0.88, 2, -0.003, 0.074],
          [0.308, -0.10, 0.82, 2, -0.005, 0.074],
          [0.362, -0.15, 0.70, 1, -0.007, 0.072],
          [0.412, -0.22, 0.52, 0, -0.009, 0.068]
        ]);
        // State 2 (Full Gliding — broad stepped Minecraft delta wings matching 2c092d26 / 08241693)
        const s2 = new THREE.Group(); s2.visible = false;
        addSlats(s2, [
          [0.254, -0.03, 0.92, 2, -0.003, 0.078],
          [0.312, -0.05, 0.90, 2, -0.004, 0.078],
          [0.370, -0.09, 0.84, 2, -0.005, 0.076],
          [0.426, -0.15, 0.74, 1, -0.006, 0.074],
          [0.480, -0.22, 0.58, 0, -0.007, 0.070],
          [0.528, -0.30, 0.38, 0, -0.008, 0.064]
        ]);
        wingWrap.add(s0, s1, s2);
        elyStateObjs[bucketKey][0].push(s0);
        elyStateObjs[bucketKey][1].push(s1);
        elyStateObjs[bucketKey][2].push(s2);
        p.add(wingWrap);
      };
      buildSteppedStates(elyNormMats, elyNormGroups, 'norm', false);
      buildSteppedStates(elyPhxMats, elyPhxGroups, 'phx', true);
      elytraGrp.add(p);
      return p;
    };
    const elytraL = mkWingPivot(1), elytraR = mkWingPivot(-1);
    elytraGrp.visible = false;

    // 3) Volumetric 3D Armored Shoulder Pauldrons (Base armor pauldrons + sleek top trim band so shoulders never look blocky!)
    const armorPauldronL = new THREE.Group(); armorPauldronL.position.set(0.105, 0, 0); armL.add(armorPauldronL);
    armorPauldronL.add(makeSkinBoxPart(4, 6, 4, 40, 16, 0, armChestMat, 0.0625, 0.038));
    addRelief(armorPauldronL, 0.34, 0.19, 0.36, 0.025, 0.125, 0, armChestRelMat, false);
    addRelief(armorPauldronL, 0.31, 0.075, 0.37, 0.035, 0.255, 0, armChestRelMat, false);
    addRelief(armorPauldronL, 0.32, 0.048, 0.36, 0.032, 0.255, 0, armChestAccMat, true);
    armorPauldronL.visible = false;

    const armorPauldronR = new THREE.Group(); armorPauldronR.position.set(-0.105, 0, 0); armR.add(armorPauldronR);
    armorPauldronR.add(makeSkinBoxPart(4, 6, 4, 40, 16, 0, armChestMat, 0.0625, 0.038));
    addRelief(armorPauldronR, 0.34, 0.19, 0.36, -0.025, 0.125, 0, armChestRelMat, false);
    addRelief(armorPauldronR, 0.31, 0.075, 0.37, -0.035, 0.255, 0, armChestRelMat, false);
    addRelief(armorPauldronR, 0.32, 0.048, 0.36, -0.032, 0.255, 0, armChestAccMat, true);
    armorPauldronR.visible = false;

    // 4) Volumetric 3D R6 Leggings (Waist + Full Continuous 12px R6 Leg Greaves + Sleek Knee Trim!)
    const armorWaist = makeSkinBox(8, 4, 4, 16, 48, armLegMat, 0.0625, 0.030);
    armorWaist.position.set(0, -0.25, 0); torso.add(armorWaist);
    armorWaist.visible = false;

    const armorLegL = new THREE.Group(); armorLegL.position.set(-0.125, -0.375, 0); legL.add(armorLegL);
    armorLegL.add(makeSkinBox(4, 12, 4, 0, 32, armLegMat, 0.0625, 0.030));
    addRelief(armorLegL, 0.24, 0.15, 0.06, 0, 0.03, 0.16, armLegRelMat, false);
    addRelief(armorLegL, 0.22, 0.06, 0.05, 0, 0.03, 0.172, armLegAccMat, true);
    armorLegL.visible = false;

    const armorLegR = new THREE.Group(); armorLegR.position.set(0.125, -0.375, 0); legR.add(armorLegR);
    armorLegR.add(makeSkinBox(4, 12, 4, 0, 32, armLegMat, 0.0625, 0.030));
    addRelief(armorLegR, 0.24, 0.15, 0.06, 0, 0.03, 0.16, armLegRelMat, false);
    addRelief(armorLegR, 0.22, 0.06, 0.05, 0, 0.03, 0.172, armLegAccMat, true);
    armorLegR.visible = false;

    // 5) Volumetric 3D Chunky Boots (mounted cleanly on lower 6px of R6 leg!)
    const armorBootL = new THREE.Group(); armorBootL.position.set(-0.125, -0.5625, 0); legL.add(armorBootL);
    armorBootL.add(makeSkinBoxPart(4, 6, 4, 0, 48, 6, armBootMat, 0.0625, 0.044));
    addRelief(armorBootL, 0.31, 0.13, 0.12, 0, -0.13, 0.145, armBootRelMat, false);
    addRelief(armorBootL, 0.30, 0.06, 0.09, 0, -0.13, 0.165, armBootAccMat, true);
    addRelief(armorBootL, 0.365, 0.07, 0.365, 0,  0.045, 0,    armBootRelMat, false);
    armorBootL.visible = false;

    const armorBootR = new THREE.Group(); armorBootR.position.set(0.125, -0.5625, 0); legR.add(armorBootR);
    armorBootR.add(makeSkinBoxPart(4, 6, 4, 0, 48, 6, armBootMat, 0.0625, 0.044));
    addRelief(armorBootR, 0.31, 0.13, 0.12, 0, -0.13, 0.145, armBootRelMat, false);
    addRelief(armorBootR, 0.30, 0.06, 0.09, 0, -0.13, 0.165, armBootAccMat, true);
    addRelief(armorBootR, 0.365, 0.07, 0.365, 0,  0.045, 0,    armBootRelMat, false);
    armorBootR.visible = false;

    // 6) Authentic Larger 3D Off-Hand Minecraft Tower Shield mounted cleanly on left R6 arm!
    const armorShield = makeP(0.28, -0.32, 0.04, armL);
    armorShield.rotation.set(-0.04, Math.PI * 0.38, 0.04);
    armorShield.add(build3DShieldMesh(true));
    armorShield.visible = false;

    // 7) 3D Off-Hand Torch & Lantern mounted on left R6 hand!
    const offTorch = makeP(0.125, -0.455, 0.22, armL);
    offTorch.rotation.set(0.45, 0, 0);
    const otStick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.08), new THREE.MeshStandardMaterial({ color: 0x7c4d24, roughness: 0.8 }));
    const otFlame = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.10), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xff9f1c, emissiveIntensity: 1.2, roughness: 0.3 }));
    otFlame.position.set(0, 0.24, 0);
    offTorch.add(otStick, otFlame);
    offTorch.visible = false;

    const offLantern = makeP(0.125, -0.49, 0.16, armL);
    const olMesh = buildUnified3DItemMesh(B.LANTERN);
    olMesh.position.set(0, -0.18, 0); olMesh.rotation.set(0, 0.18, 0); olMesh.scale.setScalar(1.18);
    offLantern.add(olMesh);
    offLantern.visible = false;
    const offLanternPivot = olMesh.getObjectByName('lanternSwingPivot');

    const offSoulLantern = makeP(0.125, -0.49, 0.16, armL);
    const oslMesh = buildUnified3DItemMesh(B.SOUL_LANTERN);
    oslMesh.position.set(0, -0.18, 0); oslMesh.rotation.set(0, 0.18, 0); oslMesh.scale.setScalar(1.18);
    offSoulLantern.add(oslMesh);
    offSoulLantern.visible = false;
    const offSoulLanternPivot = oslMesh.getObjectByName('lanternSwingPivot');

    const offTotem = makeP(0.125, -0.47, 0.16, armL);
    const otMesh = buildUnified3DItemMesh(B.TOTEM_UNDYING);
    otMesh.rotation.order = 'YXZ';
    otMesh.position.set(0, 0.04, 0.04); otMesh.rotation.set(0.18, 0.22, -0.04); otMesh.scale.setScalar(1.02);
    offTotem.add(otMesh);
    offTotem.visible = false;

    const rig = {
      g, hips, torso, torsoOuter, head, headOuter, headAcc, armL, armR, handHold, legL, legR,
      armVariant: { slimL, classicL, slimR, classicR },
      skinMat, outerMat, skinId, heldItemId: -1,
      r6Rest: {
        hipsY: 1.125,
        torso: [0, 0, 0],
        head: [0, 0.375, 0],
        armL: [0.25, 0.1875, 0],
        armR: [-0.25, 0.1875, 0],
        legL: [0.25, -0.375, 0],
        legR: [-0.25, -0.375, 0]
      },
      armor: { helmet: armorHelmet, dragonHelmet, chest: armorChest, pauldronL: armorPauldronL, pauldronR: armorPauldronR, elytra: elytraGrp, elytraL, elytraR, elyNormGroups, elyPhxGroups, elyStateObjs, elyPhxFlag: false, elyStatePrev: -1, waist: armorWaist, legL: armorLegL, legR: armorLegR, bootL: armorBootL, bootR: armorBootR, shield: armorShield, offTorch, offLantern, offSoulLantern, offTotem, offLanternPivot, offSoulLanternPivot },
      animPhase: Math.random() * 6,
      moveBlend: 0, sprintBlend: 0, airBlend: 0, jumpFlip: 1
    };
    setRigSlim(rig, isSkinSlim(skinId));
    if (nameLabel) g.add(makeNameTagSprite(nameLabel, badgeHex));
    return rig;
  }

  function _stepLanternPendulum(st, tgtX, tgtZ, dt) {
    const cdt = Math.min(0.04, Math.max(0.001, dt || 0.016));
    st.vx = (st.vx + (tgtX - st.rx) * 42.0 * cdt) * Math.exp(-5.2 * cdt);
    st.vz = (st.vz + (tgtZ - st.rz) * 42.0 * cdt) * Math.exp(-5.2 * cdt);
    st.rx = Math.max(-0.52, Math.min(0.52, st.rx + st.vx * cdt));
    st.rz = Math.max(-0.52, Math.min(0.52, st.rz + st.vz * cdt));
    return st;
  }

  const _BOW_IDLE_POS = new THREE.Vector3(0.10, -0.04, 0.10);
  const _BOW_AIM_POS  = new THREE.Vector3(0.04, 0.06, 0.03);
  const _BOW_IDLE_Q   = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.12, 2.60, 'YXZ'));
  const _BOW_AIM_Q    = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, Math.PI * 0.5 - 0.04, Math.PI * 0.75 - 0.08, 'YXZ'));
  function _applyRigBowGripPose(grip, aimT) {
    if (!grip) return;
    const t = Math.max(0, Math.min(1, aimT || 0));
    grip.position.lerpVectors(_BOW_IDLE_POS, _BOW_AIM_POS, t);
    grip.quaternion.copy(_BOW_IDLE_Q).slerp(_BOW_AIM_Q, t);
  }

  function setRigHeldItem(rig, blockId, meta = null) {
    if (!rig || !rig.handHold) return;
    const bid = blockId || 0;
    const itemKey = _itemMetaCacheKey(bid, meta);
    if (rig.heldItemKey === itemKey && (rig.heldItemId || 0) === bid) return;
    rig.heldItemId = bid;
    rig.heldItemKey = itemKey;
    while (rig.handHold.children.length) rig.handHold.remove(rig.handHold.children[0]);
    rig.bowGrip = null;
    rig.heldLanternPivot = null;
    if (!bid || !BLOCK_DEF[bid]) return;
    const def = BLOCK_DEF[bid];
    const cachedRig = heldModelCache.get(itemKey);
    let srcModel = cachedRig;
    if (!srcModel || (srcModel.userData && srcModel.userData.iconReady === false)) {
      srcModel = buildUnified3DItemMesh(bid, meta);
      if (!srcModel.userData || srcModel.userData.iconReady !== false) heldModelCache.set(itemKey, srcModel);
    }
    const clone = srcModel.clone();
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.setScalar(1);
    const isForwardShaft = (bid === B.STICK || bid === B.ARROW);
    if (def.tool === 'sword') {
      // Authentic Minecraft 3rd-person Sword Grip: pommel/handle locked inside right fist, blade pointing FORWARD (+Z) & slightly UP in vertical plane!
      const grip = new THREE.Group();
      grip.rotation.order = 'YXZ';
      grip.position.set(0.0, -0.02, 0.05);
      grip.rotation.set(0.0, -Math.PI * 0.5, -Math.PI * 0.25 + 0.20);
      clone.scale.setScalar(1.26);
      clone.position.set(0.22, 0.22, 0.0);
      grip.add(clone);
      rig.handHold.add(grip);
    } else if (def.tool === 'bow') {
      // Authentic Minecraft 3rd-person Bow Grip: idle diagonal hold across body (Image 2) <-> upright vertical aiming (Image 3)
      const grip = new THREE.Group();
      clone.scale.setScalar(1.28);
      clone.position.set(0.0, 0.0, 0.0);
      grip.add(clone);
      rig.bowGrip = grip;
      const initAimT = (meta && meta.bowStage > 0) ? Math.max(rig._bowAimT || 0, 1.0) : (rig._bowAimT || 0);
      _applyRigBowGripPose(grip, initAimT);
      rig.handHold.add(grip);
    } else if (def.tool === 'pick' || def.tool === 'axe' || def.tool === 'shovel' || def.tool === 'hoe' || def.tool === 'rod' || def.tool === 'shears' || isForwardShaft) {
      // Authentic Minecraft 3rd-person Tool Grip: handle locked inside right fist, curved blade/head facing FORWARD (+Z)!
      const grip = new THREE.Group();
      grip.rotation.order = 'YXZ';
      grip.position.set(0.0, -0.02, 0.06);
      grip.rotation.set(0.0, Math.PI * 0.5, Math.PI * 0.25 + 0.62);
      clone.scale.setScalar(1.22);
      clone.position.set(0.17, 0.17, 0.0);
      grip.add(clone);
      rig.handHold.add(grip);
    } else if (bid === B.SHIELD) {
      const shMain = build3DShieldMesh(true);
      shMain.position.set(-0.10, 0.12, 0.06);
      shMain.rotation.set(-0.08, -Math.PI * 0.44, -0.04);
      rig.handHold.add(shMain);
    } else if (bid === B.SPYGLASS) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(1.0);
      clone.position.set(0.0, 0.04, 0.14);
      clone.rotation.set(0.92, -0.18, 0.0);
      rig.handHold.add(clone);
    } else if (bid === B.TORCH_BLOCK || bid === B.BLAZE_ROD || bid === B.BAMBOO) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(bid === B.BLAZE_ROD ? 1.08 : 0.96);
      clone.position.set(0.0, bid === B.BLAZE_ROD ? 0.08 : 0.10, 0.10);
      clone.rotation.set(bid === B.BLAZE_ROD ? 0.30 : 0.18, -Math.PI * 0.45, 0.0);
      rig.handHold.add(clone);
    } else if (bid === B.LANTERN || bid === B.SOUL_LANTERN) {
      const grip = new THREE.Group();
      grip.rotation.order = 'YXZ';
      grip.position.set(0.0, 0.02, 0.12);
      grip.rotation.set(0.0, -0.18, 0.0);
      clone.scale.setScalar(1.20);
      clone.position.set(0.0, -0.19, 0.0);
      clone.rotation.set(0.0, 0.0, 0.0);
      grip.add(clone);
      rig.handHold.add(grip);
      rig.heldLanternPivot = clone.getObjectByName('lanternSwingPivot');
    } else if (bid === B.TOTEM_UNDYING) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(1.02);
      clone.position.set(0.0, 0.05, 0.14);
      clone.rotation.set(0.18, -0.22, 0.04);
      rig.handHold.add(clone);
    } else if (def.bed) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(0.92);
      clone.position.set(0.02, 0.04, 0.12);
      clone.rotation.set(0.32, -Math.PI * 0.42, 0.08);
      rig.handHold.add(clone);
    } else if (def.door) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(0.84);
      clone.position.set(0.0, 0.02, 0.13);
      clone.rotation.set(0.18, -Math.PI * 0.46, 0.05);
      rig.handHold.add(clone);
    } else if (def.armorSlot && def.armorTier && def.armorSlot !== 'offhand') {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(1.08);
      clone.position.set(0.0, 0.03, 0.12);
      clone.rotation.set(0.20, -Math.PI * 0.42, 0.06);
      rig.handHold.add(clone);
    } else if (bid === B.GLOW_CRYSTAL || bid === B.ICHOR_CRYSTAL || bid === B.ECHO_SHARD || bid === B.END_CRYSTAL_BLOCK || bid === B.MOONSTONE_GEM || bid === B.DREAM_PRISM_GEM || bid === B.DRAGON_CRYSTAL || def.dragonEgg) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(1.05);
      clone.position.set(0.0, 0.06, 0.10);
      clone.rotation.set(0.22, -Math.PI * 0.45, 0.06);
      rig.handHold.add(clone);
    } else if (def.bucket || def.chest || def.trapdoor || def.stairs || def.slab || def.fence || def.wall || bid === B.CAMPFIRE || bid === B.ANVIL || bid === B.ENCHANT_TABLE || bid === B.CAKE_ITEM || bid === B.BOAT_ITEM) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(def.bucket ? 1.02 : 0.96);
      clone.position.set(0.0, 0.03, 0.13);
      clone.rotation.set(def.bucket ? 0.16 : 0.24, -0.48, 0.06);
      rig.handHold.add(clone);
    } else if (bid === B.ENDER_EYE || bid === B.ENDER_PEARL || bid === B.BLAZE_POWDER || bid === B.FLINT_AND_STEEL || bid === B.END_PORTAL_FRAME || bid === B.END_PORTAL_FRAME_EYE) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(1.02);
      clone.position.set(0.0, 0.03, 0.12);
      clone.rotation.set(0.22, -0.44, 0.06);
      rig.handHold.add(clone);
    } else if (def.voxelItem || !def.solid) {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(0.96);
      clone.position.set(0.0, 0.04, 0.16);
      clone.rotation.set(0.24, -0.48, 0.12);
      rig.handHold.add(clone);
    } else {
      clone.rotation.order = 'YXZ';
      clone.scale.setScalar(1.02);
      clone.position.set(0.0, 0.01, 0.12);
      clone.rotation.set(0.12, 0.45, 0.0);
      rig.handHold.add(clone);
    }
  }

  function setRigSlim(rig, slim) {
    if (!rig || !rig.armVariant) return;
    const isSlim = !!slim;
    rig.armVariant.slimL.visible = isSlim;
    rig.armVariant.slimR.visible = isSlim;
    rig.armVariant.classicL.visible = !isSlim;
    rig.armVariant.classicR.visible = !isSlim;
    if (rig.handHold) rig.handHold.position.x = isSlim ? -0.09375 : -0.125;
  }

  function rebuildSkinAccessories(rig, _skinId) {
    if (!rig || !rig.headAcc) return;
    while (rig.headAcc.children.length) {
      const ch = rig.headAcc.children[0];
      rig.headAcc.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) ch.material.dispose();
    }
  }

  function applySkinToRig(rig, skinId) {
    if (!rig || !rig.skinMat) return;
    const tex = getSkinTexture(skinId);
    rig.skinId = skinId;
    rig.skinMat.map = tex; rig.skinMat.needsUpdate = true;
    rig.outerMat.map = tex; rig.outerMat.needsUpdate = true;
    setRigSlim(rig, isSkinSlim(skinId));
    rebuildSkinAccessories(rig, skinId);
    if (typeof playerAvatar !== 'undefined' && rig === playerAvatar) applyArmorToPlayerRig(playerAvatar, player.equip, player.equipMeta);
  }

  // Roblox Studio R6 Animations (movement from Workspace.Rig & 6-hit sword combo rig2_sword_1..6 from Workspace.Rig2 in test23, baked via Blender MCP!)
  const ROBLOX_R6_ANIMS = {"rig_idle3":{"dur":1.883,"loop":true,"t":{"torso":{"q":[[0,0.0035,0,0,1],[0.083,0.0035,0,0,1],[0.167,0.0035,0,0,1],[0.25,0.004,0,0,1],[0.333,0.0045,0,0,1],[0.417,0.005,0,0,1],[0.5,0.006,0,0,1],[0.583,0.007,0,0,1],[0.667,0.008,0,0,1],[0.75,0.009,0,0,1],[0.833,0.0095,0,0,1],[0.917,0.01,0,0,1],[1,0.0105,0,0,0.9999],[1.083,0.011,0,0,0.9999],[1.167,0.0105,0,0,0.9999],[1.25,0.0105,0,0,0.9999],[1.333,0.0095,0,0,1],[1.417,0.0085,0,0,1],[1.5,0.0075,0,0,1],[1.583,0.0065,0,0,1],[1.667,0.0055,0,0,1],[1.75,0.0045,0,0,1],[1.833,0.004,0,0,1]],"p":[[0,-0.0085,-0.0139,0.0023],[0.083,-0.0085,-0.0154,0.0023],[0.167,-0.0085,-0.0169,0.0023],[0.25,-0.0085,-0.0188,0.0023],[0.333,-0.0085,-0.0203,0.0023],[0.417,-0.0085,-0.0221,0.0023],[0.5,-0.0085,-0.0232,0.0026],[0.583,-0.0085,-0.024,0.0026],[0.667,-0.0085,-0.0244,0.0026],[0.75,-0.0085,-0.024,0.003],[0.833,-0.0085,-0.0229,0.003],[0.917,-0.0085,-0.0214,0.003],[1,-0.0085,-0.0199,0.003],[1.083,-0.0085,-0.018,0.003],[1.167,-0.0085,-0.0165,0.003],[1.25,-0.0085,-0.0146,0.003],[1.333,-0.0085,-0.0135,0.003],[1.417,-0.0085,-0.0128,0.0026],[1.5,-0.0085,-0.012,0.0026],[1.583,-0.0085,-0.0116,0.0026],[1.667,-0.0085,-0.012,0.0023],[1.75,-0.0085,-0.0124,0.0023],[1.833,-0.0085,-0.0131,0.0023]]},"head":{"q":[[0,0.014,0.0045,0.0004,0.9999],[0.083,0.0165,0.0045,0.0004,0.9999],[0.167,0.0185,0.0045,0.0004,0.9998],[0.25,0.021,0.0045,0.0004,0.9998],[0.333,0.023,0.0045,0.0004,0.9997],[0.417,0.025,0.0045,0.0004,0.9997],[0.5,0.0265,0.0045,0.0004,0.9996],[0.583,0.027,0.0045,0.0004,0.9996],[0.667,0.027,0.0045,0.0004,0.9996],[0.75,0.0255,0.0045,0.0004,0.9997],[0.833,0.0235,0.0045,0.0004,0.9997],[0.917,0.021,0.0045,0.0004,0.9998],[1,0.0185,0.0045,0.0004,0.9998],[1.083,0.016,0.0045,0.0004,0.9999],[1.167,0.0135,0.0045,0.0004,0.9999],[1.25,0.0115,0.0045,0.0004,0.9999],[1.333,0.01,0.0045,0.0005,0.9999],[1.417,0.009,0.0045,0.0005,0.9999],[1.5,0.009,0.0045,0.0005,0.9999],[1.583,0.0095,0.0045,0.0005,0.9999],[1.667,0.01,0.0045,0.0005,0.9999],[1.75,0.0115,0.0045,0.0004,0.9999],[1.833,0.013,0.0045,0.0004,0.9999]],"p":[[0,0,0.0064,0],[0.083,0,0.0064,0],[0.167,0,0.0064,0],[0.25,0,0.0064,0],[0.333,0,0.0064,0],[0.417,0,0.0064,0],[0.5,0,0.0064,0],[0.583,0,0.0064,0],[0.667,0,0.0064,0],[0.75,0,0.0064,0],[0.833,0,0.0064,0],[0.917,0,0.0064,0],[1,0,0.0064,0],[1.083,0,0.0064,0],[1.167,0,0.0064,0],[1.25,0,0.0064,0],[1.333,0,0.0064,0],[1.417,0,0.0064,0],[1.5,0,0.0064,0],[1.583,0,0.0064,0],[1.667,0,0.0064,0],[1.75,0,0.0064,0],[1.833,0,0.0064,0]]},"armL":{"q":[[0,0.0003,0.0601,0.0205,0.998],[0.083,-0.0002,0.0586,0.0206,0.9981],[0.167,-0.0006,0.0551,0.0206,0.9983],[0.25,-0.001,0.0501,0.0206,0.9985],[0.333,-0.0014,0.044,0.0206,0.9988],[0.417,-0.0013,0.0375,0.0206,0.9991],[0.5,-0.0011,0.031,0.0211,0.9993],[0.583,-0.001,0.025,0.021,0.9995],[0.667,-0.0004,0.02,0.021,0.9996],[0.75,0.0002,0.0165,0.021,0.9996],[0.833,0.0012,0.0145,0.0215,0.9997],[0.917,0.0022,0.0135,0.0215,0.9997],[1,0.0032,0.0141,0.0215,0.9997],[1.083,0.0037,0.0161,0.0214,0.9996],[1.167,0.0046,0.0196,0.0214,0.9996],[1.25,0.0045,0.0241,0.0214,0.9995],[1.333,0.0049,0.0296,0.0214,0.9993],[1.417,0.0042,0.0361,0.0209,0.9991],[1.5,0.0041,0.0426,0.0208,0.9989],[1.583,0.003,0.0487,0.0209,0.9986],[1.667,0.0024,0.0537,0.0209,0.9983],[1.75,0.0018,0.0576,0.0204,0.9981],[1.833,0.0008,0.0596,0.0205,0.998]],"p":[[0,-0.0095,-0.0274,-0.0307],[0.083,-0.01,-0.0292,-0.0307],[0.167,-0.0105,-0.0315,-0.0307],[0.25,-0.0107,-0.0338,-0.0307],[0.333,-0.011,-0.036,-0.0307],[0.417,-0.0112,-0.0375,-0.0307],[0.5,-0.0112,-0.039,-0.0307],[0.583,-0.0112,-0.0394,-0.0307],[0.667,-0.011,-0.0394,-0.0307],[0.75,-0.0105,-0.0386,-0.0307],[0.833,-0.01,-0.0368,-0.0307],[0.917,-0.0095,-0.0345,-0.0307],[1,-0.0088,-0.0323,-0.0311],[1.083,-0.0083,-0.0296,-0.0311],[1.167,-0.008,-0.0274,-0.0311],[1.25,-0.0075,-0.0255,-0.0311],[1.333,-0.0075,-0.0244,-0.0311],[1.417,-0.0075,-0.0236,-0.0311],[1.5,-0.0077,-0.0232,-0.0307],[1.583,-0.008,-0.0232,-0.0307],[1.667,-0.0085,-0.024,-0.0307],[1.75,-0.0088,-0.0248,-0.0307],[1.833,-0.0092,-0.0263,-0.0307]]},"armR":{"q":[[0,0.0003,-0.0601,-0.0205,0.998],[0.083,0.0018,-0.0571,-0.0204,0.9982],[0.167,0.0034,-0.0537,-0.0209,0.9983],[0.25,0.0055,-0.0497,-0.0208,0.9985],[0.333,0.0075,-0.0457,-0.0212,0.9987],[0.417,0.0101,-0.0417,-0.0211,0.9989],[0.5,0.0122,-0.0388,-0.0216,0.9989],[0.583,0.0137,-0.0363,-0.0215,0.999],[0.667,0.0148,-0.0348,-0.0215,0.9991],[0.75,0.0153,-0.0349,-0.022,0.999],[0.833,0.0152,-0.0364,-0.0215,0.999],[0.917,0.0142,-0.0384,-0.0215,0.9989],[1,0.0131,-0.0413,-0.0215,0.9988],[1.083,0.0115,-0.0448,-0.0215,0.9987],[1.167,0.01,-0.0483,-0.0211,0.9986],[1.25,0.0079,-0.0517,-0.0211,0.9984],[1.333,0.0063,-0.0552,-0.0207,0.9982],[1.417,0.0043,-0.0577,-0.0208,0.9981],[1.5,0.0027,-0.0602,-0.0204,0.998],[1.583,0.0012,-0.0616,-0.0205,0.9979],[1.667,0.0002,-0.0622,-0.0205,0.9979],[1.75,-0.0003,-0.0622,-0.0206,0.9979],[1.833,0.0002,-0.0611,-0.0205,0.9979]],"p":[[0,0.0095,-0.0274,-0.0307],[0.083,0.0097,-0.0281,-0.0307],[0.167,0.0103,-0.0292,-0.0307],[0.25,0.0105,-0.03,-0.0307],[0.333,0.0107,-0.0307,-0.0307],[0.417,0.0107,-0.0311,-0.0307],[0.5,0.011,-0.0315,-0.0307],[0.583,0.011,-0.0315,-0.0304],[0.667,0.011,-0.0315,-0.0304],[0.75,0.0107,-0.0307,-0.0304],[0.833,0.0105,-0.03,-0.0304],[0.917,0.0103,-0.0292,-0.0307],[1,0.0097,-0.0281,-0.0307],[1.083,0.0095,-0.027,-0.0307],[1.167,0.0092,-0.0263,-0.0307],[1.25,0.009,-0.0255,-0.0307],[1.333,0.0088,-0.0251,-0.0307],[1.417,0.0088,-0.0248,-0.0307],[1.5,0.0088,-0.0251,-0.0307],[1.583,0.0088,-0.0251,-0.0307],[1.667,0.009,-0.0255,-0.0307],[1.75,0.0092,-0.0263,-0.0307],[1.833,0.0095,-0.027,-0.0307]]},"legL":{"q":[[0,0.0095,0.0378,0.0257,0.9989],[1.417,0.0051,0.0342,0.0259,0.9991]],"p":[[0,0.0022,0.0364,0.0112],[1.417,0.0022,0.033,0.0112]]},"legR":{"q":[[0,0.009,-0.0333,-0.0292,0.999],[1.417,0.0044,-0.0202,-0.0294,0.9994]],"p":[[0,-0.0018,0.0345,0.012],[1.417,-0.0018,0.0323,0.012]]}}},"rig_walk":{"dur":1,"loop":true,"t":{"torso":{"q":[[0,0.0841,-0.1113,-0.0027,0.9902],[0.033,0.0841,-0.1097,-0.0023,0.9904],[0.067,0.0835,-0.1042,-0.0023,0.991],[0.1,0.0835,-0.0959,-0.0015,0.9919],[0.133,0.083,-0.0842,-0.001,0.993],[0.167,0.0825,-0.0699,-0.0002,0.9941],[0.2,0.0824,-0.0527,0.0003,0.9952],[0.233,0.0818,-0.0326,0.0007,0.9961],[0.267,0.0822,-0.0104,0.0014,0.9966],[0.3,0.0823,0.0132,0.0019,0.9965],[0.333,0.0828,0.0373,0.0019,0.9959],[0.367,0.0828,0.0605,0.002,0.9947],[0.4,0.0834,0.0807,0.0023,0.9932],[0.433,0.0839,0.0965,0.0024,0.9918],[0.467,0.084,0.1072,0.0025,0.9907],[0.5,0.0841,0.1113,0.0027,0.9902],[0.533,0.0841,0.1097,0.0023,0.9904],[0.567,0.0835,0.1042,0.0023,0.991],[0.6,0.0835,0.0959,0.0015,0.9919],[0.633,0.083,0.0842,0.001,0.993],[0.667,0.0825,0.0699,0.0002,0.9941],[0.7,0.0824,0.0527,-0.0003,0.9952],[0.733,0.0818,0.0326,-0.0007,0.9961],[0.767,0.0822,0.0104,-0.0014,0.9966],[0.8,0.0823,-0.0132,-0.0019,0.9965],[0.833,0.0828,-0.0373,-0.0019,0.9959],[0.867,0.0828,-0.0605,-0.002,0.9947],[0.9,0.0834,-0.0807,-0.0023,0.9932],[0.933,0.0839,-0.0965,-0.0024,0.9918],[0.967,0.084,-0.1072,-0.0025,0.9907],[1,0.0841,-0.1113,-0.0027,0.9902]],"p":[[0,-0.0035,-0.1031,0.0683],[0.033,-0.0035,-0.0971,0.0701],[0.067,-0.0032,-0.0821,0.0716],[0.1,-0.0032,-0.0607,0.0724],[0.133,-0.003,-0.0371,0.0728],[0.167,-0.0027,-0.0142,0.0728],[0.2,-0.0022,0.0045,0.0728],[0.233,-0.0018,0.0154,0.0728],[0.267,-0.001,0.0154,0.0728],[0.3,-0.0003,0.0045,0.0731],[0.333,0.0005,-0.0142,0.0731],[0.367,0.0015,-0.0371,0.0731],[0.4,0.0022,-0.0607,0.0724],[0.433,0.0027,-0.0821,0.0716],[0.467,0.0032,-0.0971,0.0705],[0.5,0.0035,-0.1031,0.0683],[0.533,0.0027,-0.0971,0.0653],[0.567,0.0008,-0.0821,0.0607],[0.6,-0.002,-0.0607,0.0555],[0.633,-0.005,-0.0371,0.0503],[0.667,-0.0083,-0.0142,0.0454],[0.7,-0.0107,0.0045,0.0416],[0.733,-0.0127,0.0154,0.0398],[0.767,-0.0132,0.0154,0.0398],[0.8,-0.0127,0.0045,0.042],[0.833,-0.0112,-0.0142,0.0457],[0.867,-0.0095,-0.0371,0.0506],[0.9,-0.0073,-0.0607,0.0559],[0.933,-0.0055,-0.0821,0.0607],[0.967,-0.004,-0.0971,0.0653],[1,-0.0035,-0.1031,0.0683]]},"head":{"q":[[0,0.0017,0.1112,-0.0072,0.9938],[0.033,0.0018,0.1096,-0.0067,0.9939],[0.067,0.0016,0.1046,-0.0067,0.9945],[0.1,0.0021,0.0959,-0.0057,0.9954],[0.133,0.0019,0.0843,-0.0052,0.9964],[0.167,0.0023,0.0697,-0.0042,0.9976],[0.2,0.0021,0.052,-0.0031,0.9986],[0.233,0.0025,0.032,-0.0016,0.9995],[0.267,0.0025,0.0095,0,1],[0.3,0.0025,-0.0145,0.001,0.9999],[0.333,0.0021,-0.0385,0.0026,0.9993],[0.367,0.0022,-0.0611,0.0041,0.9981],[0.4,0.002,-0.0812,0.0052,0.9967],[0.433,0.0021,-0.097,0.0062,0.9953],[0.467,0.0018,-0.1076,0.0067,0.9942],[0.5,0.0017,-0.1112,0.0072,0.9938],[0.533,0.0018,-0.1096,0.0067,0.9939],[0.567,0.0016,-0.1046,0.0067,0.9945],[0.6,0.0021,-0.0959,0.0057,0.9954],[0.633,0.0019,-0.0843,0.0052,0.9964],[0.667,0.0023,-0.0697,0.0042,0.9976],[0.7,0.0021,-0.052,0.0031,0.9986],[0.733,0.0025,-0.032,0.0016,0.9995],[0.767,0.0025,-0.0095,0,1],[0.8,0.0025,0.0145,-0.001,0.9999],[0.833,0.0021,0.0385,-0.0026,0.9993],[0.867,0.0022,0.0611,-0.0041,0.9981],[0.9,0.002,0.0812,-0.0052,0.9967],[0.933,0.0021,0.097,-0.0062,0.9953],[0.967,0.0018,0.1076,-0.0067,0.9942],[1,0.0017,0.1112,-0.0072,0.9938]]},"armL":{"q":[[0,-0.2538,-0.001,0.0629,0.9652],[0.033,-0.2773,-0.0002,0.0657,0.9585],[0.067,-0.2897,0.0001,0.0671,0.9548],[0.1,-0.2896,-0.0014,0.0666,0.9548],[0.133,-0.2789,-0.0098,0.0624,0.9582],[0.167,-0.2579,-0.0245,0.0546,0.9643],[0.2,-0.2287,-0.043,0.045,0.9715],[0.233,-0.1918,-0.0616,0.0354,0.9789],[0.267,-0.1487,-0.0786,0.0267,0.9854],[0.3,-0.1011,-0.0904,0.0205,0.9905],[0.333,-0.0496,-0.0955,0.0179,0.994],[0.367,0.0049,-0.0908,0.02,0.9957],[0.4,0.0588,-0.079,0.0248,0.9948],[0.433,0.1103,-0.0621,0.0316,0.9914],[0.467,0.1568,-0.043,0.0388,0.9859],[0.5,0.1951,-0.0245,0.0462,0.9794],[0.533,0.223,-0.0098,0.0516,0.9734],[0.567,0.2384,-0.0013,0.0555,0.9696],[0.6,0.2399,-0.0003,0.0553,0.9692],[0.633,0.2278,-0.0013,0.0517,0.9723],[0.667,0.2053,-0.0027,0.0456,0.9776],[0.7,0.1729,-0.0042,0.0398,0.9841],[0.733,0.1319,-0.0048,0.036,0.9906],[0.767,0.0841,-0.005,0.0356,0.9958],[0.8,0.0317,-0.0048,0.0377,0.9988],[0.833,-0.0238,-0.0045,0.0409,0.9989],[0.867,-0.0792,-0.0036,0.0454,0.9958],[0.9,-0.1317,-0.0031,0.0501,0.99],[0.933,-0.1797,-0.0023,0.0546,0.9822],[0.967,-0.2213,-0.0016,0.0592,0.9734],[1,-0.2538,-0.001,0.0629,0.9652]],"p":[[0,0.0077,-0.0592,0.0619],[0.033,0.0083,-0.0626,0.0668],[0.067,0.0085,-0.0645,0.0694],[0.1,0.0085,-0.0645,0.0679],[0.133,0.0073,-0.063,0.0529],[0.167,0.0055,-0.0596,0.0266],[0.2,0.0035,-0.0555,-0.006],[0.233,0.002,-0.0503,-0.0416],[0.267,0.001,-0.0446,-0.075],[0.3,0.0008,-0.0394,-0.1024],[0.333,0.001,-0.036,-0.1196],[0.367,0.002,-0.0341,-0.126],[0.4,0.0035,-0.0341,-0.1253],[0.433,0.005,-0.0353,-0.1189],[0.467,0.0067,-0.0368,-0.1084],[0.5,0.0083,-0.0386,-0.096],[0.533,0.0092,-0.0401,-0.0829],[0.567,0.01,-0.0405,-0.0709],[0.6,0.01,-0.0386,-0.0611],[0.633,0.0085,-0.0323,-0.0518],[0.667,0.006,-0.024,-0.0424],[0.7,0.0037,-0.0169,-0.033],[0.733,0.002,-0.0131,-0.0229],[0.767,0.002,-0.015,-0.012],[0.8,0.0022,-0.0199,-0.0004],[0.833,0.003,-0.0266,0.0116],[0.867,0.0037,-0.0341,0.024],[0.9,0.0047,-0.0416,0.0356],[0.933,0.006,-0.0484,0.0461],[0.967,0.0067,-0.0544,0.0551],[1,0.0077,-0.0592,0.0619]]},"armR":{"q":[[0,0.1951,0.0245,-0.0462,0.9794],[0.033,0.223,0.0098,-0.0516,0.9734],[0.067,0.2384,0.0013,-0.0555,0.9696],[0.1,0.2388,0.0003,-0.0553,0.9695],[0.133,0.2198,0.001,-0.05,0.9743],[0.167,0.185,0.0022,-0.0422,0.9818],[0.2,0.1386,0.0033,-0.0338,0.9898],[0.233,0.084,0.0041,-0.0285,0.9961],[0.267,0.0276,0.0042,-0.0281,0.9992],[0.3,-0.0279,0.0039,-0.0304,0.9991],[0.333,-0.0802,0.0038,-0.0343,0.9962],[0.367,-0.129,0.0031,-0.0395,0.9909],[0.4,-0.1723,0.0023,-0.0453,0.984],[0.433,-0.2098,0.0018,-0.0513,0.9764],[0.467,-0.241,0.0011,-0.0565,0.9689],[0.5,-0.2649,0.0009,-0.0616,0.9623],[0.533,-0.2815,0.0004,-0.0651,0.9574],[0.567,-0.2901,-0.0001,-0.0671,0.9547],[0.6,-0.2896,0.0014,-0.0666,0.9548],[0.633,-0.2789,0.0098,-0.0624,0.9582],[0.667,-0.2579,0.0245,-0.0546,0.9643],[0.7,-0.2287,0.043,-0.045,0.9715],[0.733,-0.1918,0.0616,-0.0354,0.9789],[0.767,-0.1487,0.0786,-0.0267,0.9854],[0.8,-0.1011,0.0904,-0.0205,0.9905],[0.833,-0.0496,0.0955,-0.0179,0.994],[0.867,0.0049,0.0908,-0.02,0.9957],[0.9,0.0588,0.079,-0.0248,0.9948],[0.933,0.1103,0.0621,-0.0316,0.9914],[0.967,0.1568,0.043,-0.0388,0.9859],[1,0.1951,0.0245,-0.0462,0.9794]],"p":[[0,-0.0083,-0.0353,-0.0971],[0.033,-0.0092,-0.0375,-0.084],[0.067,-0.01,-0.0394,-0.0713],[0.1,-0.01,-0.0405,-0.0604],[0.133,-0.0092,-0.0409,-0.048],[0.167,-0.0077,-0.0413,-0.0345],[0.2,-0.0063,-0.0416,-0.021],[0.233,-0.0053,-0.042,-0.0079],[0.267,-0.0053,-0.0435,0.0049],[0.3,-0.0055,-0.0465,0.0165],[0.333,-0.006,-0.0506,0.0277],[0.367,-0.0067,-0.0551,0.0379],[0.4,-0.0077,-0.06,0.0469],[0.433,-0.0085,-0.0649,0.0547],[0.467,-0.0092,-0.0694,0.0611],[0.5,-0.01,-0.0731,0.066],[0.533,-0.0107,-0.0761,0.069],[0.567,-0.011,-0.0776,0.0709],[0.6,-0.0107,-0.0776,0.069],[0.633,-0.0095,-0.075,0.0536],[0.667,-0.0073,-0.0701,0.0274],[0.7,-0.0047,-0.0638,-0.0056],[0.733,-0.0027,-0.0562,-0.0413],[0.767,-0.0013,-0.0484,-0.075],[0.8,-0.0008,-0.0409,-0.1028],[0.833,-0.001,-0.036,-0.1196],[0.867,-0.002,-0.033,-0.1264],[0.9,-0.0035,-0.0319,-0.1256],[0.933,-0.005,-0.0319,-0.1196],[0.967,-0.0067,-0.033,-0.1095],[1,-0.0083,-0.0353,-0.0971]]},"legL":{"q":[[0,0.1986,0.1072,-0.0229,0.9739],[0.033,0.199,0.1052,-0.0225,0.9741],[0.067,0.2089,0.0996,-0.0224,0.9726],[0.1,0.2171,0.0902,-0.0222,0.9717],[0.133,0.2062,0.079,-0.0193,0.9751],[0.167,0.1577,0.0663,-0.0137,0.9852],[0.2,0.0806,0.0498,-0.005,0.9955],[0.233,0.0733,0.0309,-0.0028,0.9968],[0.267,0.0076,0.011,-0.0046,0.9999],[0.3,-0.0748,-0.0113,-0.0099,0.9971],[0.333,-0.1515,-0.0353,-0.0176,0.9877],[0.367,-0.2143,-0.0582,-0.0246,0.9747],[0.4,-0.2569,-0.0781,-0.0302,0.9628],[0.433,-0.2777,-0.0938,-0.032,0.9555],[0.467,-0.2827,-0.1048,-0.029,0.953],[0.5,-0.272,-0.109,-0.0216,0.9559],[0.533,-0.2233,-0.1081,-0.0125,0.9687],[0.567,-0.154,-0.1043,-0.0036,0.9826],[0.6,-0.1185,-0.0961,0.0042,0.9883],[0.633,-0.0953,-0.0847,0.0105,0.9918],[0.667,-0.0753,-0.07,0.0158,0.9946],[0.7,-0.0561,-0.0528,0.0201,0.9968],[0.733,-0.0343,-0.0333,0.0229,0.9986],[0.767,-0.0082,-0.0107,0.0234,0.9996],[0.8,0.0242,0.013,0.0217,0.9994],[0.833,0.0605,0.0366,0.0163,0.9974],[0.867,0.0987,0.0592,0.0087,0.9933],[0.9,0.1353,0.0788,-0.0012,0.9877],[0.933,0.1672,0.0939,-0.0114,0.9814],[0.967,0.189,0.1038,-0.0191,0.9763],[1,0.1986,0.1072,-0.0229,0.9739]],"p":[[0,-0.0005,-0.0019,-0.0428],[0.033,-0.0008,0.003,-0.0416],[0.067,0.002,0.0101,-0.021],[0.1,0.0057,0.0188,0.0112],[0.133,0.008,0.0334,0.0379],[0.167,0.0077,0.054,0.042],[0.2,0.0032,0.0683,0.0345],[0.233,0.0057,0.0611,0.1327],[0.267,0.006,0.0641,0.1609],[0.3,0.0053,0.0611,0.1665],[0.333,0.0032,0.0503,0.1699],[0.367,-0.0003,0.0375,0.1725],[0.4,-0.0043,0.0326,0.1706],[0.433,-0.008,0.0405,0.1586],[0.467,-0.012,0.0532,0.144],[0.5,-0.0168,0.0668,0.1331],[0.533,-0.023,0.0904,0.1598],[0.567,-0.0285,0.1057,0.2111],[0.6,-0.0285,0.0941,0.2201],[0.633,-0.0262,0.0735,0.2119],[0.667,-0.023,0.051,0.1954],[0.7,-0.0192,0.0307,0.1725],[0.733,-0.0152,0.0154,0.1436],[0.767,-0.012,0.0075,0.1102],[0.8,-0.0092,0.006,0.0761],[0.833,-0.0073,0.0075,0.0435],[0.867,-0.0053,0.0083,0.0154],[0.9,-0.0037,0.0075,-0.0083],[0.933,-0.0022,0.0041,-0.0263],[0.967,-0.0013,0.0004,-0.0382],[1,-0.0005,-0.0019,-0.0428]]},"legR":{"q":[[0,-0.2603,0.1092,0.0203,0.9591],[0.033,-0.2119,0.1086,0.0119,0.9712],[0.067,-0.1428,0.104,0.0049,0.9843],[0.1,-0.1081,0.0959,0.0004,0.9895],[0.133,-0.0864,0.0844,-0.0032,0.9927],[0.167,-0.0679,0.0697,-0.0053,0.9952],[0.2,-0.0498,0.0525,-0.0074,0.9974],[0.233,-0.0293,0.0328,-0.008,0.999],[0.267,-0.0034,0.0105,-0.008,0.9999],[0.3,0.0279,-0.0132,-0.0061,0.9995],[0.333,0.0641,-0.0372,-0.0016,0.9972],[0.367,0.1025,-0.0594,0.0051,0.9929],[0.4,0.1388,-0.0788,0.0126,0.9871],[0.433,0.1702,-0.094,0.0199,0.9807],[0.467,0.1911,-0.1038,0.0249,0.9757],[0.5,0.1983,-0.1073,0.0249,0.9739],[0.533,0.2027,-0.1052,0.0224,0.9733],[0.567,0.2206,-0.0983,0.0208,0.9702],[0.6,0.2286,-0.0884,0.0188,0.9693],[0.633,0.2137,-0.0764,0.0147,0.9738],[0.667,0.1599,-0.0639,0.0094,0.985],[0.7,0.0724,-0.0486,0.002,0.9962],[0.733,0.0547,-0.0314,0.0027,0.998],[0.767,-0.0084,-0.0126,0.0079,0.9999],[0.8,-0.086,0.0097,0.0154,0.9961],[0.833,-0.1564,0.0342,0.0237,0.9868],[0.867,-0.2132,0.0581,0.0301,0.9748],[0.9,-0.2517,0.0783,0.0339,0.964],[0.933,-0.2685,0.0941,0.0331,0.9581],[0.967,-0.2717,0.1048,0.0287,0.9562],[1,-0.2603,0.1092,0.0203,0.9591]],"p":[[0,0.0163,0.0709,0.1301],[0.033,0.023,0.0915,0.1586],[0.067,0.0288,0.1028,0.2111],[0.1,0.029,0.0874,0.2205],[0.133,0.0272,0.0641,0.2119],[0.167,0.0243,0.039,0.1954],[0.2,0.0208,0.0165,0.1721],[0.233,0.0168,0,0.1429],[0.267,0.013,-0.0083,0.1095],[0.3,0.0097,-0.009,0.0746],[0.333,0.007,-0.0067,0.0416],[0.367,0.005,-0.0037,0.0131],[0.4,0.003,-0.0026,-0.0105],[0.433,0.0015,-0.003,-0.0281],[0.467,0,-0.0037,-0.0394],[0.5,-0.0013,-0.003,-0.0435],[0.533,-0.0032,0.0023,-0.0326],[0.567,-0.008,0.0064,0.0034],[0.6,-0.012,0.0165,0.042],[0.633,-0.013,0.0349,0.0709],[0.667,-0.0107,0.0592,0.0724],[0.7,-0.0043,0.0754,0.0525],[0.733,-0.0057,0.0683,0.1346],[0.767,-0.0057,0.0664,0.1613],[0.8,-0.0047,0.0592,0.1669],[0.833,-0.0025,0.0465,0.1706],[0.867,0.001,0.0353,0.1725],[0.9,0.0047,0.033,0.1688],[0.933,0.008,0.0435,0.1549],[0.967,0.0115,0.0577,0.1402],[1,0.0163,0.0709,0.1301]]}}},"rig_run":{"dur":0.615,"loop":true,"t":{"torso":{"q":[[0,0.2749,-0.1462,-0.0088,0.9503],[0.015,0.2748,-0.1441,-0.0088,0.9506],[0.031,0.2754,-0.1385,-0.0082,0.9513],[0.046,0.2756,-0.1287,-0.0079,0.9526],[0.062,0.2758,-0.1162,-0.0068,0.9542],[0.077,0.2766,-0.1011,-0.0058,0.9556],[0.093,0.2768,-0.0835,-0.0051,0.9573],[0.108,0.2773,-0.0642,-0.0039,0.9586],[0.123,0.2775,-0.0435,-0.0025,0.9597],[0.138,0.2779,-0.0223,-0.0014,0.9604],[0.154,0.2778,0,0,0.9606],[0.169,0.2779,0.0223,0.0014,0.9604],[0.185,0.2775,0.0435,0.0025,0.9597],[0.2,0.2773,0.0642,0.0039,0.9586],[0.215,0.2768,0.0835,0.0051,0.9573],[0.231,0.2766,0.1011,0.0058,0.9556],[0.246,0.2758,0.1162,0.0068,0.9542],[0.262,0.2756,0.1287,0.0079,0.9526],[0.277,0.2754,0.1385,0.0082,0.9513],[0.292,0.2748,0.1441,0.0088,0.9506],[0.308,0.2749,0.1462,0.0088,0.9503],[0.323,0.2748,0.1441,0.0088,0.9506],[0.338,0.2754,0.1385,0.0082,0.9513],[0.354,0.2756,0.1287,0.0079,0.9526],[0.369,0.2758,0.1162,0.0068,0.9542],[0.385,0.2766,0.1011,0.0058,0.9556],[0.4,0.2768,0.0835,0.0051,0.9573],[0.415,0.2773,0.0642,0.0039,0.9586],[0.431,0.2775,0.0435,0.0025,0.9597],[0.446,0.2779,0.0223,0.0014,0.9604],[0.462,0.2778,0,0,0.9606],[0.477,0.2779,-0.0223,-0.0014,0.9604],[0.493,0.2775,-0.0435,-0.0025,0.9597],[0.507,0.2773,-0.0642,-0.0039,0.9586],[0.523,0.2768,-0.0835,-0.0051,0.9573],[0.538,0.2766,-0.1011,-0.0058,0.9556],[0.554,0.2758,-0.1162,-0.0068,0.9542],[0.569,0.2756,-0.1287,-0.0079,0.9526],[0.585,0.2754,-0.1385,-0.0082,0.9513],[0.6,0.2748,-0.1441,-0.0088,0.9506],[0.615,0.2749,-0.1462,-0.0088,0.9503]],"p":[[0,-0.016,-0.0855,0.159],[0.015,-0.0158,-0.0892,0.1613],[0.031,-0.0152,-0.1001,0.1684],[0.046,-0.014,-0.1159,0.1781],[0.062,-0.0127,-0.135,0.1905],[0.077,-0.011,-0.1556,0.2036],[0.093,-0.0092,-0.1762,0.2171],[0.108,-0.007,-0.1954,0.2291],[0.123,-0.0047,-0.2111,0.2393],[0.138,-0.0025,-0.222,0.246],[0.154,0,-0.2258,0.2486],[0.169,0.0025,-0.222,0.246],[0.185,0.0047,-0.2111,0.2393],[0.2,0.007,-0.1954,0.2291],[0.215,0.0092,-0.1762,0.2171],[0.231,0.011,-0.1556,0.2036],[0.246,0.0127,-0.135,0.1905],[0.262,0.014,-0.1159,0.1781],[0.277,0.0152,-0.1001,0.1684],[0.292,0.0158,-0.0892,0.1613],[0.308,0.016,-0.0855,0.159],[0.323,0.0158,-0.0892,0.1613],[0.338,0.0152,-0.1001,0.1684],[0.354,0.014,-0.1159,0.1781],[0.369,0.0127,-0.135,0.1905],[0.385,0.011,-0.1556,0.2036],[0.4,0.0092,-0.1762,0.2171],[0.415,0.007,-0.1954,0.2291],[0.431,0.0047,-0.2111,0.2393],[0.446,0.0025,-0.222,0.246],[0.462,0,-0.2258,0.2486],[0.477,-0.0025,-0.222,0.246],[0.493,-0.0047,-0.2111,0.2393],[0.507,-0.007,-0.1954,0.2291],[0.523,-0.0092,-0.1762,0.2171],[0.538,-0.011,-0.1556,0.2036],[0.554,-0.0127,-0.135,0.1905],[0.569,-0.014,-0.1159,0.1781],[0.585,-0.0152,-0.1001,0.1684],[0.6,-0.0158,-0.0892,0.1613],[0.615,-0.016,-0.0855,0.159]]},"head":{"q":[[0,-0.0829,0.1568,-0.0224,0.9839],[0.015,-0.0829,0.1548,-0.022,0.9842],[0.031,-0.0827,0.1485,-0.0215,0.9852],[0.046,-0.0829,0.1385,-0.0198,0.9867],[0.062,-0.0831,0.1249,-0.0178,0.9885],[0.077,-0.0831,0.1088,-0.0156,0.9905],[0.093,-0.0834,0.0898,-0.0131,0.9924],[0.108,-0.0833,0.0692,-0.0098,0.9941],[0.123,-0.0835,0.0468,-0.0066,0.9954],[0.138,-0.0837,0.0239,-0.0035,0.9962],[0.154,-0.0838,0,0,0.9965],[0.169,-0.0837,-0.0239,0.0035,0.9962],[0.185,-0.0835,-0.0468,0.0066,0.9954],[0.2,-0.0833,-0.0692,0.0098,0.9941],[0.215,-0.0834,-0.0898,0.0131,0.9924],[0.231,-0.0831,-0.1088,0.0156,0.9905],[0.246,-0.0831,-0.1249,0.0178,0.9885],[0.262,-0.0829,-0.1385,0.0198,0.9867],[0.277,-0.0827,-0.1485,0.0215,0.9852],[0.292,-0.0829,-0.1548,0.022,0.9842],[0.308,-0.0829,-0.1568,0.0224,0.9839],[0.323,-0.0829,-0.1548,0.022,0.9842],[0.338,-0.0827,-0.1485,0.0215,0.9852],[0.354,-0.0829,-0.1385,0.0198,0.9867],[0.369,-0.0831,-0.1249,0.0178,0.9885],[0.385,-0.0831,-0.1088,0.0156,0.9905],[0.4,-0.0834,-0.0898,0.0131,0.9924],[0.415,-0.0833,-0.0692,0.0098,0.9941],[0.431,-0.0835,-0.0468,0.0066,0.9954],[0.446,-0.0837,-0.0239,0.0035,0.9962],[0.462,-0.0838,0,0,0.9965],[0.477,-0.0837,0.0239,-0.0035,0.9962],[0.493,-0.0835,0.0468,-0.0066,0.9954],[0.507,-0.0833,0.0692,-0.0098,0.9941],[0.523,-0.0834,0.0898,-0.0131,0.9924],[0.538,-0.0831,0.1088,-0.0156,0.9905],[0.554,-0.0831,0.1249,-0.0178,0.9885],[0.569,-0.0829,0.1385,-0.0198,0.9867],[0.585,-0.0827,0.1485,-0.0215,0.9852],[0.6,-0.0829,0.1548,-0.022,0.9842],[0.615,-0.0829,0.1568,-0.0224,0.9839]]},"armL":{"q":[[0,-0.8203,-0.1527,0.1505,0.5303],[0.015,-0.8235,-0.1651,0.1558,0.5199],[0.031,-0.8217,-0.1777,0.1605,0.5171],[0.046,-0.8153,-0.1891,0.1646,0.522],[0.062,-0.8033,-0.2004,0.1683,0.535],[0.077,-0.7852,-0.2109,0.1723,0.5562],[0.093,-0.7588,-0.2207,0.1766,0.5869],[0.108,-0.7226,-0.2278,0.1817,0.6268],[0.123,-0.673,-0.2321,0.1874,0.6768],[0.138,-0.6061,-0.2322,0.1935,0.7357],[0.154,-0.5176,-0.2249,0.2003,0.8009],[0.169,-0.4055,-0.209,0.2058,0.8657],[0.185,-0.2739,-0.1832,0.2088,0.9208],[0.2,-0.1346,-0.1503,0.2071,0.9573],[0.215,-0.0007,-0.1132,0.2014,0.9729],[0.231,0.1166,-0.0768,0.1925,0.9713],[0.246,0.2126,-0.043,0.1821,0.9591],[0.262,0.2857,-0.0139,0.1713,0.9428],[0.277,0.3385,0.0106,0.1606,0.9271],[0.292,0.3729,0.0302,0.1505,0.9151],[0.308,0.3901,0.0462,0.1409,0.9088],[0.323,0.3909,0.0581,0.1312,0.9092],[0.338,0.3768,0.0665,0.1218,0.9158],[0.354,0.3485,0.0724,0.1124,0.9277],[0.369,0.3055,0.0758,0.1032,0.9435],[0.385,0.2463,0.0765,0.0937,0.9616],[0.4,0.1702,0.074,0.0847,0.979],[0.415,0.077,0.0675,0.0769,0.9918],[0.431,-0.0321,0.057,0.0701,0.9954],[0.446,-0.1516,0.0426,0.0659,0.9853],[0.462,-0.2737,0.0248,0.0649,0.9593],[0.477,-0.3893,0.0043,0.0682,0.9186],[0.493,-0.4922,-0.0176,0.0748,0.8671],[0.507,-0.5787,-0.0389,0.0839,0.8103],[0.523,-0.6489,-0.0594,0.0943,0.7527],[0.538,-0.7035,-0.0781,0.1052,0.6985],[0.554,-0.745,-0.0957,0.1157,0.6499],[0.569,-0.7757,-0.1114,0.126,0.6083],[0.585,-0.7974,-0.1258,0.1351,0.5745],[0.6,-0.8118,-0.1395,0.1435,0.5485],[0.615,-0.8203,-0.1527,0.1505,0.5303]],"p":[[0,-0.0008,-0.0146,0.1376],[0.015,-0.001,-0.0338,0.123],[0.031,-0.002,-0.0592,0.1035],[0.046,-0.004,-0.09,0.0814],[0.062,-0.0063,-0.1237,0.0566],[0.077,-0.0085,-0.1594,0.03],[0.093,-0.0103,-0.1946,0.0026],[0.108,-0.0112,-0.2288,-0.0255],[0.123,-0.011,-0.2591,-0.054],[0.138,-0.0092,-0.2839,-0.0836],[0.154,-0.006,-0.3004,-0.1144],[0.169,-0.0018,-0.3049,-0.1466],[0.185,0.0022,-0.2955,-0.1796],[0.2,0.0047,-0.2726,-0.2104],[0.215,0.0053,-0.2381,-0.2351],[0.231,0.004,-0.1969,-0.2516],[0.246,0.002,-0.153,-0.2591],[0.262,-0.0003,-0.1114,-0.2587],[0.277,-0.0025,-0.0746,-0.2528],[0.292,-0.0047,-0.045,-0.2419],[0.308,-0.0073,-0.0248,-0.2276],[0.323,-0.0103,-0.0154,-0.2104],[0.338,-0.0132,-0.015,-0.1909],[0.354,-0.0165,-0.0218,-0.1688],[0.369,-0.0198,-0.0345,-0.144],[0.385,-0.0225,-0.0499,-0.1166],[0.4,-0.0253,-0.0664,-0.0863],[0.415,-0.0272,-0.0814,-0.0532],[0.431,-0.0288,-0.0915,-0.0184],[0.446,-0.0293,-0.0956,0.0161],[0.462,-0.029,-0.0919,0.0484],[0.477,-0.0275,-0.0818,0.0769],[0.493,-0.025,-0.0668,0.1005],[0.507,-0.022,-0.0503,0.1192],[0.523,-0.0182,-0.0341,0.1339],[0.538,-0.0145,-0.0199,0.1444],[0.554,-0.0107,-0.0086,0.1507],[0.569,-0.007,-0.0015,0.1537],[0.585,-0.004,0.0008,0.153],[0.6,-0.0018,-0.0034,0.1477],[0.615,-0.0008,-0.0146,0.1376]]},"armR":{"q":[[0,0.3901,-0.0462,-0.1409,0.9088],[0.015,0.3909,-0.0581,-0.1312,0.9092],[0.031,0.3768,-0.0665,-0.1218,0.9158],[0.046,0.3485,-0.0724,-0.1124,0.9277],[0.062,0.3055,-0.0758,-0.1032,0.9435],[0.077,0.2463,-0.0765,-0.0937,0.9616],[0.093,0.1702,-0.074,-0.0847,0.979],[0.108,0.077,-0.0675,-0.0769,0.9918],[0.123,-0.0321,-0.057,-0.0701,0.9954],[0.138,-0.1516,-0.0426,-0.0659,0.9853],[0.154,-0.2737,-0.0248,-0.0649,0.9593],[0.169,-0.3893,-0.0043,-0.0682,0.9186],[0.185,-0.4922,0.0176,-0.0748,0.8671],[0.2,-0.5787,0.0389,-0.0839,0.8103],[0.215,-0.6489,0.0594,-0.0943,0.7527],[0.231,-0.7035,0.0781,-0.1052,0.6985],[0.246,-0.745,0.0957,-0.1157,0.6499],[0.262,-0.7757,0.1114,-0.126,0.6083],[0.277,-0.7974,0.1258,-0.1351,0.5745],[0.292,-0.8118,0.1395,-0.1435,0.5485],[0.308,-0.8203,0.1527,-0.1505,0.5303],[0.323,-0.8235,0.1651,-0.1558,0.5199],[0.338,-0.8217,0.1777,-0.1605,0.5171],[0.354,-0.8153,0.1891,-0.1646,0.522],[0.369,-0.8033,0.2004,-0.1683,0.535],[0.385,-0.7852,0.2109,-0.1723,0.5562],[0.4,-0.7588,0.2207,-0.1766,0.5869],[0.415,-0.7226,0.2278,-0.1817,0.6268],[0.431,-0.673,0.2321,-0.1874,0.6768],[0.446,-0.6061,0.2322,-0.1935,0.7357],[0.462,-0.5176,0.2249,-0.2003,0.8009],[0.477,-0.4055,0.209,-0.2058,0.8657],[0.493,-0.2739,0.1832,-0.2088,0.9208],[0.507,-0.1346,0.1503,-0.2071,0.9573],[0.523,-0.0007,0.1132,-0.2014,0.9729],[0.538,0.1166,0.0768,-0.1925,0.9713],[0.554,0.2126,0.043,-0.1821,0.9591],[0.569,0.2857,0.0139,-0.1713,0.9428],[0.585,0.3385,-0.0106,-0.1606,0.9271],[0.6,0.3729,-0.0302,-0.1505,0.9151],[0.615,0.3901,-0.0462,-0.1409,0.9088]],"p":[[0,0.0073,-0.0248,-0.2276],[0.015,0.0103,-0.0154,-0.2104],[0.031,0.0132,-0.015,-0.1909],[0.046,0.0165,-0.0218,-0.1688],[0.062,0.0198,-0.0345,-0.144],[0.077,0.0225,-0.0499,-0.1166],[0.093,0.0253,-0.0664,-0.0863],[0.108,0.0272,-0.0814,-0.0532],[0.123,0.0288,-0.0915,-0.0184],[0.138,0.0293,-0.0956,0.0161],[0.154,0.029,-0.0919,0.0484],[0.169,0.0275,-0.0818,0.0769],[0.185,0.025,-0.0668,0.1005],[0.2,0.022,-0.0503,0.1192],[0.215,0.0182,-0.0341,0.1339],[0.231,0.0145,-0.0199,0.1444],[0.246,0.0107,-0.0086,0.1507],[0.262,0.007,-0.0015,0.1537],[0.277,0.004,0.0008,0.153],[0.292,0.0018,-0.0034,0.1477],[0.308,0.0008,-0.0146,0.1376],[0.323,0.001,-0.0338,0.123],[0.338,0.002,-0.0592,0.1035],[0.354,0.004,-0.09,0.0814],[0.369,0.0063,-0.1237,0.0566],[0.385,0.0085,-0.1594,0.03],[0.4,0.0103,-0.1946,0.0026],[0.415,0.0112,-0.2288,-0.0255],[0.431,0.011,-0.2591,-0.054],[0.446,0.0092,-0.2839,-0.0836],[0.462,0.006,-0.3004,-0.1144],[0.477,0.0018,-0.3049,-0.1466],[0.493,-0.0022,-0.2955,-0.1796],[0.507,-0.0047,-0.2726,-0.2104],[0.523,-0.0053,-0.2381,-0.2351],[0.538,-0.004,-0.1969,-0.2516],[0.554,-0.002,-0.153,-0.2591],[0.569,0.0003,-0.1114,-0.2587],[0.585,0.0025,-0.0746,-0.2528],[0.6,0.0047,-0.045,-0.2419],[0.615,0.0073,-0.0248,-0.2276]]},"legL":{"q":[[0,0.4006,0.1143,-0.0837,0.9053],[0.015,0.4315,0.1075,-0.0851,0.8917],[0.031,0.4606,0.0963,-0.0823,0.8785],[0.046,0.4834,0.082,-0.0762,0.8682],[0.062,0.4952,0.066,-0.0656,0.8638],[0.077,0.4898,0.0498,-0.0505,0.8689],[0.093,0.4867,0.0321,-0.0339,0.8723],[0.108,0.5283,0.0143,-0.0195,0.8487],[0.123,0.5114,0.0009,-0.0005,0.8593],[0.138,0.4634,-0.01,0.0176,0.8859],[0.154,0.3986,-0.0196,0.0315,0.9164],[0.169,0.3258,-0.0297,0.0383,0.9442],[0.185,0.2298,-0.0433,0.0391,0.9715],[0.2,0.0937,-0.0614,0.0325,0.9932],[0.215,-0.081,-0.0816,0.019,0.9932],[0.231,-0.2665,-0.0995,-0.0005,0.9587],[0.246,-0.4452,-0.1114,-0.0249,0.8881],[0.262,-0.6305,-0.1123,-0.0546,0.7661],[0.277,-0.6912,-0.1148,-0.0688,0.7101],[0.292,-0.6993,-0.119,-0.0738,0.701],[0.308,-0.696,-0.1215,-0.0747,0.7037],[0.323,-0.6818,-0.1226,-0.0719,0.7176],[0.338,-0.6565,-0.1213,-0.067,0.7415],[0.354,-0.6197,-0.1175,-0.0592,0.7738],[0.369,-0.5701,-0.1092,-0.0495,0.8127],[0.385,-0.5037,-0.0978,-0.037,0.8575],[0.4,-0.32,-0.0837,-0.0125,0.9436],[0.415,-0.176,-0.0646,0.0027,0.9823],[0.431,-0.0472,-0.0426,0.01,0.9979],[0.446,0.0633,-0.0211,0.0079,0.9977],[0.462,0.1477,-0.0006,-0.004,0.989],[0.477,0.2022,0.0181,-0.0211,0.9789],[0.493,0.2284,0.0383,-0.0296,0.9724],[0.507,0.222,0.058,-0.0251,0.973],[0.523,0.1992,0.0754,-0.0215,0.9768],[0.538,0.2418,0.0883,-0.034,0.9657],[0.554,0.278,0.0994,-0.0473,0.9543],[0.569,0.3107,0.1075,-0.0599,0.9425],[0.585,0.3413,0.1138,-0.0708,0.9304],[0.6,0.3705,0.1162,-0.079,0.9182],[0.615,0.4006,0.1143,-0.0837,0.9053]],"p":[[0,-0.0272,-0.105,-0.1496],[0.015,-0.028,-0.0922,-0.147],[0.031,-0.027,-0.0724,-0.1305],[0.046,-0.0248,-0.0476,-0.0994],[0.062,-0.0215,-0.0188,-0.0536],[0.077,-0.0182,0.0146,0.0075],[0.093,-0.0155,0.0229,0.099],[0.108,-0.0123,-0.045,0.246],[0.123,-0.0152,-0.036,0.3638],[0.138,-0.0222,0.0165,0.4612],[0.154,-0.0323,0.0975,0.5336],[0.169,-0.0432,0.198,0.5786],[0.185,-0.054,0.3176,0.5794],[0.2,-0.0605,0.4357,0.5111],[0.215,-0.0575,0.5025,0.381],[0.231,-0.0457,0.4763,0.2423],[0.246,-0.031,0.3548,0.1447],[0.262,-0.0185,0.1222,0.1065],[0.277,-0.025,0.0319,0.1586],[0.292,-0.034,0.018,0.2063],[0.308,-0.0393,0.0094,0.2351],[0.323,-0.0387,0.0064,0.2438],[0.338,-0.034,0.0097,0.2351],[0.354,-0.0262,0.0225,0.2137],[0.369,-0.0185,0.0473,0.1852],[0.385,-0.0135,0.0889,0.1586],[0.4,-0.026,0.2408,0.2434],[0.415,-0.0297,0.2914,0.3157],[0.431,-0.0262,0.2884,0.375],[0.446,-0.0147,0.2464,0.4088],[0.462,0.0032,0.1826,0.4039],[0.477,0.021,0.117,0.3578],[0.493,0.0265,0.0671,0.2782],[0.507,0.0143,0.045,0.1646],[0.523,-0.0025,0.0349,0.0394],[0.538,-0.0057,-0.0105,-0.0023],[0.554,-0.01,-0.0491,-0.0442],[0.569,-0.0152,-0.0788,-0.0833],[0.585,-0.0203,-0.0986,-0.1155],[0.6,-0.0245,-0.1076,-0.1387],[0.615,-0.0272,-0.105,-0.1496]]},"legR":{"q":[[0,-0.696,0.1215,0.0747,0.7037],[0.015,-0.6818,0.1226,0.0719,0.7176],[0.031,-0.6565,0.1213,0.067,0.7415],[0.046,-0.6197,0.1175,0.0592,0.7738],[0.062,-0.5701,0.1092,0.0495,0.8127],[0.077,-0.5037,0.0978,0.037,0.8575],[0.093,-0.32,0.0837,0.0125,0.9436],[0.108,-0.176,0.0646,-0.0027,0.9823],[0.123,-0.0472,0.0426,-0.01,0.9979],[0.138,0.0633,0.0211,-0.0079,0.9977],[0.154,0.1477,0.0006,0.004,0.989],[0.169,0.2022,-0.0181,0.0211,0.9789],[0.185,0.2284,-0.0383,0.0296,0.9724],[0.2,0.222,-0.058,0.0251,0.973],[0.215,0.1992,-0.0754,0.0215,0.9768],[0.231,0.2418,-0.0883,0.034,0.9657],[0.246,0.278,-0.0994,0.0473,0.9543],[0.262,0.3107,-0.1075,0.0599,0.9425],[0.277,0.3413,-0.1138,0.0708,0.9304],[0.292,0.3705,-0.1162,0.079,0.9182],[0.308,0.4006,-0.1143,0.0837,0.9053],[0.323,0.4315,-0.1075,0.0851,0.8917],[0.338,0.4606,-0.0963,0.0823,0.8785],[0.354,0.4834,-0.082,0.0762,0.8682],[0.369,0.4952,-0.066,0.0656,0.8638],[0.385,0.4898,-0.0498,0.0505,0.8689],[0.4,0.4867,-0.0321,0.0339,0.8723],[0.415,0.5283,-0.0143,0.0195,0.8487],[0.431,0.5114,-0.0009,0.0005,0.8593],[0.446,0.4634,0.01,-0.0176,0.8859],[0.462,0.3986,0.0196,-0.0315,0.9164],[0.477,0.3258,0.0297,-0.0383,0.9442],[0.493,0.2298,0.0433,-0.0391,0.9715],[0.507,0.0937,0.0614,-0.0325,0.9932],[0.523,-0.081,0.0816,-0.019,0.9932],[0.538,-0.2665,0.0995,0.0005,0.9587],[0.554,-0.4452,0.1114,0.0249,0.8881],[0.569,-0.6305,0.1123,0.0546,0.7661],[0.585,-0.6912,0.1148,0.0688,0.7101],[0.6,-0.6993,0.119,0.0738,0.701],[0.615,-0.696,0.1215,0.0747,0.7037]],"p":[[0,0.0393,0.0094,0.2351],[0.015,0.0387,0.0064,0.2438],[0.031,0.034,0.0097,0.2351],[0.046,0.0262,0.0225,0.2137],[0.062,0.0185,0.0473,0.1852],[0.077,0.0135,0.0889,0.1586],[0.093,0.026,0.2408,0.2434],[0.108,0.0297,0.2914,0.3157],[0.123,0.0262,0.2884,0.375],[0.138,0.0147,0.2464,0.4088],[0.154,-0.0032,0.1826,0.4039],[0.169,-0.021,0.117,0.3578],[0.185,-0.0265,0.0671,0.2782],[0.2,-0.0143,0.045,0.1646],[0.215,0.0025,0.0349,0.0394],[0.231,0.0057,-0.0105,-0.0023],[0.246,0.01,-0.0491,-0.0442],[0.262,0.0152,-0.0788,-0.0833],[0.277,0.0203,-0.0986,-0.1155],[0.292,0.0245,-0.1076,-0.1387],[0.308,0.0272,-0.105,-0.1496],[0.323,0.028,-0.0922,-0.147],[0.338,0.027,-0.0724,-0.1305],[0.354,0.0248,-0.0476,-0.0994],[0.369,0.0215,-0.0188,-0.0536],[0.385,0.0182,0.0146,0.0075],[0.4,0.0155,0.0229,0.099],[0.415,0.0123,-0.045,0.246],[0.431,0.0152,-0.036,0.3638],[0.446,0.0222,0.0165,0.4612],[0.462,0.0323,0.0975,0.5336],[0.477,0.0432,0.198,0.5786],[0.493,0.054,0.3176,0.5794],[0.507,0.0605,0.4357,0.5111],[0.523,0.0575,0.5025,0.381],[0.538,0.0457,0.4763,0.2423],[0.554,0.031,0.3548,0.1447],[0.569,0.0185,0.1222,0.1065],[0.585,0.025,0.0319,0.1586],[0.6,0.034,0.018,0.2063],[0.615,0.0393,0.0094,0.2351]]}}},"rig_jump":{"dur":0.333,"loop":false,"t":{"torso":{"q":[[0,0.156,0.0001,0.0035,0.9878],[0.033,0.1513,0.0005,0.003,0.9885],[0.067,0.1471,0.0009,0.0024,0.9891],[0.1,0.143,0.0008,0.0019,0.9897],[0.133,0.1569,0.0008,0.0019,0.9876],[0.167,0.1709,0.0008,0.0019,0.9853],[0.2,0.1846,0.0009,0.0019,0.9828],[0.233,0.1989,0.0009,0.0019,0.98],[0.267,0.213,0.0014,0.0017,0.9771],[0.3,0.2269,0.0013,0.0012,0.9739],[0.333,0.2406,0.0013,0.0012,0.9706]],"p":[[0,0,-0.3716,0],[0.033,0,-0.2479,0],[0.067,0,-0.1237,0],[0.1,0,0,0],[0.133,0,0,0],[0.167,0,0,0],[0.2,0,0,0],[0.233,0,0,0],[0.267,0,0,0],[0.3,0,0,0],[0.333,0,0,0]]},"head":{"q":[[0,0.1616,0.0089,-0.0045,0.9868],[0.033,0.1979,0.0092,-0.0024,0.9802],[0.067,0.2335,0.0086,-0.0005,0.9723],[0.1,0.269,0.0088,0.0017,0.9631],[0.133,0.2424,0.0087,0.0019,0.9701],[0.167,0.2156,0.0087,0.0022,0.9764],[0.2,0.1884,0.0091,0.0023,0.9821],[0.233,0.1611,0.009,0.0026,0.9869],[0.267,0.1342,0.0094,0.0023,0.9909],[0.3,0.1066,0.0093,0.0025,0.9943],[0.333,0.0793,0.0092,0.0028,0.9968]],"p":[[0,-0.0005,0.0116,-0.042],[0.033,-0.0003,0.0094,-0.0338],[0.067,-0.0003,0.0067,-0.0251],[0.1,-0.0003,0.0045,-0.0169],[0.133,-0.0003,0.0041,-0.0142],[0.167,-0.0003,0.0034,-0.012],[0.2,0,0.0026,-0.0097],[0.233,0,0.0019,-0.0071],[0.267,0,0.0015,-0.0049],[0.3,0,0.0008,-0.0023],[0.333,0,0,0]]},"armL":{"q":[[0,-0.0764,0.084,0.0904,0.9894],[0.033,-0.1207,-0.0142,0.0669,0.9903],[0.067,-0.1631,-0.1127,0.042,0.9792],[0.1,-0.2039,-0.2096,0.017,0.9561],[0.133,-0.1777,-0.2037,0.0863,0.9589],[0.167,-0.151,-0.1971,0.1556,0.9561],[0.2,-0.1236,-0.1895,0.2237,0.948],[0.233,-0.0946,-0.1808,0.2903,0.9349],[0.267,-0.0662,-0.1709,0.356,0.9163],[0.3,-0.0368,-0.1601,0.4192,0.8929],[0.333,-0.0071,-0.1486,0.48,0.8646]],"p":[[0,0.0138,-0.0319,-0.024],[0.033,0.0272,-0.0435,-0.0326],[0.067,0.0408,-0.0551,-0.0409],[0.1,0.0542,-0.0668,-0.0495],[0.133,0.0583,-0.0701,-0.0518],[0.167,0.0622,-0.0735,-0.0544],[0.2,0.066,-0.0769,-0.0566],[0.233,0.07,-0.0803,-0.0592],[0.267,0.0737,-0.0836,-0.0615],[0.3,0.0777,-0.087,-0.0641],[0.333,0.0815,-0.0904,-0.0664]]},"armR":{"q":[[0,-0.0682,-0.153,-0.0655,0.9837],[0.033,-0.0717,-0.0266,-0.0551,0.9955],[0.067,-0.0743,0.0996,-0.0435,0.9913],[0.1,-0.0756,0.2244,-0.0315,0.971],[0.133,-0.0697,0.2109,-0.0936,0.9705],[0.167,-0.0636,0.1962,-0.1559,0.966],[0.2,-0.0571,0.1811,-0.2169,0.9575],[0.233,-0.0507,0.1646,-0.2773,0.9452],[0.267,-0.0437,0.1482,-0.3363,0.929],[0.3,-0.0369,0.1305,-0.3942,0.909],[0.333,-0.0296,0.1127,-0.4503,0.8852]],"p":[[0,-0.0138,-0.0289,-0.0191],[0.033,-0.0272,-0.0386,-0.0289],[0.067,-0.0408,-0.0484,-0.0386],[0.1,-0.0545,-0.0581,-0.0484],[0.133,-0.0583,-0.0607,-0.0514],[0.167,-0.0622,-0.0638,-0.054],[0.2,-0.066,-0.0664,-0.057],[0.233,-0.07,-0.0694,-0.0596],[0.267,-0.0737,-0.072,-0.0626],[0.3,-0.0777,-0.075,-0.0653],[0.333,-0.0815,-0.0776,-0.0683]]},"legL":{"q":[[0,0.0045,0.1011,0.0056,0.9949],[0.033,-0.0785,0.0774,-0.005,0.9939],[0.067,-0.1616,0.0527,-0.0152,0.9853],[0.1,-0.2433,0.0281,-0.0255,0.9692],[0.133,-0.2125,0.0186,-0.0267,0.9766],[0.167,-0.1819,0.0097,-0.0277,0.9829],[0.2,-0.1507,0.0008,-0.0287,0.9882],[0.233,-0.1196,-0.0085,-0.0297,0.9923],[0.267,-0.0884,-0.0174,-0.0307,0.9955],[0.3,-0.0569,-0.0263,-0.0316,0.9975],[0.333,-0.0252,-0.0353,-0.0324,0.9985]],"p":[[0,0.0003,0.3746,0.1159],[0.033,-0.0015,0.243,0.1039],[0.067,-0.003,0.1114,0.0915],[0.1,-0.0045,-0.0203,0.0795],[0.133,-0.003,0.0353,0.1155],[0.167,-0.0013,0.0907,0.1515],[0.2,0.0003,0.1462,0.1875],[0.233,0.0018,0.2018,0.2239],[0.267,0.0032,0.2573,0.2599],[0.3,0.0047,0.3127,0.2959],[0.333,0.0063,0.3686,0.3319]]},"legR":{"q":[[0,-0.1764,-0.1293,0.0181,0.9756],[0.033,-0.1954,-0.1004,0.0148,0.9755],[0.067,-0.2143,-0.0707,0.0111,0.9741],[0.1,-0.2322,-0.0415,0.0076,0.9717],[0.133,-0.2599,-0.0326,0.0057,0.9651],[0.167,-0.2871,-0.0247,0.0041,0.9576],[0.2,-0.3139,-0.016,0.0021,0.9493],[0.233,-0.3408,-0.0076,0.0004,0.9401],[0.267,-0.3673,0.0006,-0.0014,0.9301],[0.3,-0.3931,0.009,-0.0032,0.9194],[0.333,-0.419,0.0175,-0.0046,0.9078]],"p":[[0,-0.001,0.3862,0.1219],[0.033,-0.0015,0.2441,0.1177],[0.067,-0.002,0.102,0.1132],[0.1,-0.0025,-0.0401,0.1087],[0.133,-0.0025,-0.0349,0.1009],[0.167,-0.0022,-0.0296,0.0934],[0.2,-0.0022,-0.024,0.0855],[0.233,-0.0022,-0.0188,0.078],[0.267,-0.0022,-0.0135,0.0701],[0.3,-0.0022,-0.0083,0.0626],[0.333,-0.0022,-0.003,0.0547]]}}},"rig_fall":{"dur":0.783,"loop":true,"t":{"torso":{"q":[[0,0.0611,0.0011,0.0014,0.9981],[0.033,0.0712,0.0076,0.0015,0.9974],[0.067,0.0807,0.0142,0.0019,0.9966],[0.1,0.0903,0.0203,0.0027,0.9957],[0.133,0.1,0.0269,0.0028,0.9946],[0.167,0.1096,0.0331,0.0034,0.9934],[0.2,0.1194,0.0398,0.0038,0.992],[0.233,0.1096,0.0351,0.0032,0.9933],[0.267,0.1,0.0304,0.0025,0.9945],[0.3,0.0903,0.0258,0.0022,0.9956],[0.333,0.0807,0.0212,0.0018,0.9965],[0.367,0.0712,0.0166,0.0013,0.9973],[0.4,0.0611,0.0116,0.0008,0.9981],[0.433,0.0712,0.0041,0.0012,0.9975],[0.467,0.0808,-0.0034,0.0018,0.9967],[0.5,0.0904,-0.0108,0.0025,0.9958],[0.533,0.1001,-0.0183,0.0028,0.9948],[0.567,0.1098,-0.0258,0.0034,0.9936],[0.6,0.1196,-0.0333,0.004,0.9923],[0.633,0.1088,-0.0268,0.0034,0.9937],[0.667,0.0985,-0.0208,0.0031,0.9949],[0.7,0.0878,-0.0143,0.0028,0.996],[0.733,0.0773,-0.0084,0.0022,0.997],[0.767,0.0667,-0.0019,0.0016,0.9978]]},"head":{"q":[[0,0.0793,0.0092,0.0028,0.9968],[0.033,0.0721,0.0082,0.0029,0.9974],[0.067,0.0651,0.0077,0.0035,0.9978],[0.1,0.0586,0.0067,0.0036,0.9983],[0.133,0.0515,0.0057,0.0042,0.9986],[0.167,0.0445,0.0047,0.0043,0.999],[0.2,0.0375,0.0037,0.0049,0.9993],[0.233,0.0445,0.0032,0.0049,0.999],[0.267,0.0515,0.0023,0.0049,0.9987],[0.3,0.0581,0.0013,0.0049,0.9983],[0.333,0.0652,0.0008,0.005,0.9979],[0.367,0.0722,-0.0001,0.005,0.9974],[0.4,0.0793,-0.0011,0.0051,0.9968],[0.433,0.0702,0.0067,0.003,0.9975],[0.467,0.0616,0.0141,0.0016,0.998],[0.5,0.0526,0.022,-0.0002,0.9984],[0.533,0.0441,0.0295,-0.0018,0.9986],[0.567,0.0352,0.0369,-0.0038,0.9987],[0.6,0.0262,0.0449,-0.0057,0.9986],[0.633,0.0362,0.0384,-0.0039,0.9986],[0.667,0.0456,0.0319,-0.0025,0.9984],[0.7,0.0551,0.0255,-0.0009,0.9982],[0.733,0.0646,0.0191,0.0008,0.9977],[0.767,0.0742,0.0127,0.0021,0.9972]]},"armL":{"q":[[0,-0.0309,-0.0178,0.8598,0.5094],[0.033,-0.0432,-0.0236,0.864,0.5011],[0.067,-0.0558,-0.0294,0.8678,0.4929],[0.1,-0.0684,-0.0354,0.8716,0.4841],[0.133,-0.0807,-0.0413,0.8751,0.4755],[0.167,-0.0934,-0.0472,0.8785,0.4662],[0.2,-0.1057,-0.0529,0.8816,0.457],[0.233,-0.0947,-0.0467,0.8759,0.4708],[0.267,-0.0838,-0.0401,0.87,0.4842],[0.3,-0.0728,-0.0339,0.8637,0.4976],[0.333,-0.062,-0.0278,0.8571,0.5106],[0.367,-0.0513,-0.0213,0.8503,0.5233],[0.4,-0.0402,-0.0147,0.8431,0.5361],[0.433,-0.0467,-0.0038,0.8465,0.5303],[0.467,-0.0533,0.0071,0.8494,0.525],[0.5,-0.0594,0.018,0.8524,0.5191],[0.533,-0.0657,0.0289,0.8551,0.5134],[0.567,-0.0725,0.04,0.8578,0.5073],[0.6,-0.0785,0.051,0.8602,0.5012],[0.633,-0.0699,0.0385,0.8606,0.503],[0.667,-0.0614,0.0261,0.8607,0.5048],[0.7,-0.0525,0.0135,0.8607,0.5062],[0.733,-0.0441,0.0011,0.8604,0.5076],[0.767,-0.0354,-0.0116,0.8599,0.5091]],"p":[[0,0.1318,-0.042,-0.0859],[0.033,0.1328,-0.0428,-0.0818],[0.067,0.1338,-0.0435,-0.078],[0.1,0.135,-0.0442,-0.0739],[0.133,0.136,-0.045,-0.0701],[0.167,0.137,-0.0457,-0.066],[0.2,0.138,-0.0465,-0.0622],[0.233,0.136,-0.0476,-0.066],[0.267,0.1338,-0.0491,-0.0698],[0.3,0.1318,-0.0503,-0.0739],[0.333,0.1295,-0.0518,-0.0776],[0.367,0.1275,-0.0529,-0.0814],[0.4,0.1253,-0.054,-0.0855],[0.433,0.1255,-0.0592,-0.0874],[0.467,0.1255,-0.0645,-0.0896],[0.5,0.1255,-0.0698,-0.0915],[0.533,0.1258,-0.075,-0.0938],[0.567,0.1258,-0.0803,-0.096],[0.6,0.126,-0.0859,-0.0979],[0.633,0.127,-0.0776,-0.0956],[0.667,0.128,-0.0698,-0.0938],[0.7,0.129,-0.0619,-0.0915],[0.733,0.13,-0.0536,-0.0892],[0.767,0.1313,-0.0457,-0.087]]},"armR":{"q":[[0,-0.0306,0.0182,-0.8513,0.5234],[0.033,-0.0351,0.0097,-0.8546,0.5179],[0.067,-0.0391,0.0011,-0.8576,0.5129],[0.1,-0.0432,-0.0075,-0.8605,0.5076],[0.133,-0.0477,-0.0156,-0.8632,0.5023],[0.167,-0.0518,-0.0245,-0.866,0.4968],[0.2,-0.0562,-0.0329,-0.8685,0.4913],[0.233,-0.0535,-0.0245,-0.8648,0.4987],[0.267,-0.0506,-0.0158,-0.8607,0.5064],[0.3,-0.0482,-0.0073,-0.8564,0.5141],[0.333,-0.0453,0.0011,-0.852,0.5215],[0.367,-0.0425,0.0095,-0.8476,0.5288],[0.4,-0.0395,0.0182,-0.8431,0.5361],[0.433,-0.0442,0.0163,-0.8498,0.525],[0.467,-0.0489,0.0144,-0.8564,0.5138],[0.5,-0.0538,0.0127,-0.8628,0.5025],[0.533,-0.0586,0.0112,-0.8691,0.491],[0.567,-0.0634,0.0093,-0.8751,0.4797],[0.6,-0.0674,0.0073,-0.8811,0.468],[0.633,-0.0611,0.0094,-0.876,0.4783],[0.667,-0.0541,0.0115,-0.8708,0.4884],[0.7,-0.0474,0.0131,-0.8654,0.4987],[0.733,-0.041,0.0153,-0.8598,0.5087],[0.767,-0.034,0.0174,-0.8542,0.5185]],"p":[[0,-0.1318,-0.0142,-0.0919],[0.033,-0.1323,-0.0195,-0.0949],[0.067,-0.133,-0.0248,-0.0979],[0.1,-0.1335,-0.0296,-0.1009],[0.133,-0.1343,-0.0349,-0.1039],[0.167,-0.1348,-0.0401,-0.1069],[0.2,-0.1355,-0.0454,-0.1099],[0.233,-0.1348,-0.0465,-0.1069],[0.267,-0.134,-0.048,-0.1035],[0.3,-0.1333,-0.0491,-0.1001],[0.333,-0.1325,-0.0503,-0.0968],[0.367,-0.1318,-0.0518,-0.0938],[0.4,-0.131,-0.0529,-0.0904],[0.433,-0.1315,-0.0518,-0.0848],[0.467,-0.1323,-0.0506,-0.0791],[0.5,-0.1328,-0.0495,-0.0735],[0.533,-0.1333,-0.048,-0.0679],[0.567,-0.134,-0.0469,-0.0619],[0.6,-0.1345,-0.0457,-0.0562],[0.633,-0.134,-0.0401,-0.063],[0.667,-0.1335,-0.0345,-0.0694],[0.7,-0.133,-0.0285,-0.0758],[0.733,-0.1325,-0.0229,-0.0821],[0.767,-0.132,-0.0173,-0.0885]]},"legL":{"q":[[0,0.2653,-0.0251,-0.0403,0.963],[0.033,0.2657,-0.0309,-0.0387,0.9628],[0.067,0.266,-0.0374,-0.0375,0.9625],[0.1,0.2666,-0.0437,-0.0357,0.9622],[0.133,0.267,-0.0496,-0.0346,0.9618],[0.167,0.267,-0.0559,-0.0328,0.9615],[0.2,0.2674,-0.0623,-0.0311,0.9611],[0.233,0.2609,-0.0548,-0.0319,0.9633],[0.267,0.2537,-0.0478,-0.032,0.9656],[0.3,0.2471,-0.0408,-0.0324,0.9676],[0.333,0.2403,-0.0334,-0.033,0.9696],[0.367,0.2333,-0.0265,-0.0333,0.9715],[0.4,0.2265,-0.0191,-0.0336,0.9733],[0.433,0.2246,-0.0201,-0.0359,0.9736],[0.467,0.2225,-0.0205,-0.0379,0.974],[0.5,0.2209,-0.021,-0.0404,0.9742],[0.533,0.2186,-0.0219,-0.0428,0.9746],[0.567,0.2169,-0.0224,-0.0453,0.9749],[0.6,0.2152,-0.0232,-0.0472,0.9752],[0.633,0.2245,-0.0234,-0.046,0.9731],[0.667,0.2337,-0.0236,-0.0448,0.971],[0.7,0.2424,-0.0243,-0.0435,0.9689],[0.733,0.2518,-0.0245,-0.0423,0.9666],[0.767,0.2607,-0.0246,-0.0411,0.9642]],"p":[[0,0.007,0.2752,0.3998],[0.033,0.0073,0.279,0.411],[0.067,0.0075,0.2824,0.4219],[0.1,0.0077,0.2861,0.4331],[0.133,0.008,0.2895,0.444],[0.167,0.0083,0.2929,0.4549],[0.2,0.0085,0.2966,0.4661],[0.233,0.008,0.2888,0.4571],[0.267,0.0073,0.2813,0.4485],[0.3,0.0067,0.2734,0.4399],[0.333,0.0063,0.2655,0.4312],[0.367,0.0055,0.258,0.4222],[0.4,0.005,0.2501,0.4136],[0.433,0.0055,0.2513,0.4118],[0.467,0.006,0.2524,0.4095],[0.5,0.0067,0.2535,0.4073],[0.533,0.0073,0.2546,0.4054],[0.567,0.008,0.2558,0.4031],[0.6,0.0085,0.2569,0.4012],[0.633,0.0083,0.2602,0.4009],[0.667,0.008,0.2636,0.4005],[0.7,0.0077,0.267,0.4005],[0.733,0.0075,0.2704,0.4001],[0.767,0.0073,0.2737,0.4001]]},"legR":{"q":[[0,-0.217,-0.0121,0.006,0.9761],[0.033,-0.2312,-0.0214,0.0078,0.9726],[0.067,-0.2454,-0.0307,0.0092,0.9689],[0.1,-0.2597,-0.0403,0.0109,0.9648],[0.133,-0.2737,-0.05,0.0128,0.9604],[0.167,-0.2874,-0.0596,0.014,0.9558],[0.2,-0.3012,-0.069,0.0155,0.9509],[0.233,-0.2844,-0.0596,0.0142,0.9568],[0.267,-0.268,-0.0504,0.013,0.962],[0.3,-0.2508,-0.0408,0.0117,0.9671],[0.333,-0.2337,-0.0313,0.0105,0.9718],[0.367,-0.2165,-0.022,0.009,0.976],[0.4,-0.1989,-0.0123,0.0077,0.9799],[0.433,-0.2181,-0.0126,0.0084,0.9758],[0.467,-0.2366,-0.0129,0.0087,0.9715],[0.5,-0.2555,-0.0134,0.0094,0.9667],[0.533,-0.2745,-0.0138,0.0101,0.9614],[0.567,-0.2928,-0.0141,0.0103,0.956],[0.6,-0.3113,-0.0147,0.011,0.9501],[0.633,-0.2943,-0.0142,0.0103,0.9556],[0.667,-0.2773,-0.0136,0.0091,0.9606],[0.7,-0.2598,-0.0131,0.0084,0.9655],[0.733,-0.2427,-0.0127,0.0076,0.97],[0.767,-0.2258,-0.0123,0.0064,0.9741]],"p":[[0,-0.0022,-0.021,0.0705],[0.033,-0.0022,-0.0206,0.0735],[0.067,-0.0025,-0.0203,0.0761],[0.1,-0.0027,-0.0199,0.0791],[0.133,-0.003,-0.0195,0.0821],[0.167,-0.0032,-0.0195,0.0851],[0.2,-0.0035,-0.0191,0.0878],[0.233,-0.0032,-0.0158,0.0848],[0.267,-0.003,-0.0124,0.0814],[0.3,-0.0027,-0.009,0.078],[0.333,-0.0025,-0.0056,0.0746],[0.367,-0.0022,-0.0026,0.0713],[0.4,-0.002,0.0008,0.0679],[0.433,-0.0018,-0.0019,0.0803],[0.467,-0.0015,-0.0045,0.0926],[0.5,-0.0013,-0.0075,0.1046],[0.533,-0.0013,-0.0101,0.117],[0.567,-0.001,-0.0128,0.1294],[0.6,-0.0008,-0.0158,0.1417],[0.633,-0.001,-0.0165,0.1286],[0.667,-0.0013,-0.0176,0.1159],[0.7,-0.0015,-0.0188,0.1028],[0.733,-0.0018,-0.0195,0.09],[0.767,-0.002,-0.0206,0.0769]]}}},"rig_land":{"dur":0.483,"loop":false,"t":{"torso":{"q":[[0,0.2979,0,0,0.9546],[0.017,0.3108,0,0,0.9505],[0.033,0.324,0,0,0.9461],[0.05,0.3371,0,0,0.9415],[0.067,0.3501,0,0,0.9367],[0.083,0.3633,0,0,0.9317],[0.1,0.3761,0,0,0.9266],[0.117,0.3892,0,0,0.9212],[0.133,0.4019,0,0,0.9157],[0.15,0.4142,0,0,0.9102],[0.167,0.4271,0,0,0.9042],[0.183,0.4392,0,0,0.8984],[0.2,0.4517,0,0,0.8922],[0.217,0.4641,0,0,0.8858],[0.233,0.4765,0,0,0.8792],[0.25,0.4657,0,0,0.8849],[0.267,0.4545,0,0,0.8907],[0.283,0.4437,0,0,0.8962],[0.3,0.4325,0,0,0.9016],[0.317,0.4213,0,0,0.9069],[0.333,0.4103,0,0,0.912],[0.35,0.3993,0,0,0.9168],[0.367,0.3879,0,0,0.9217],[0.383,0.3761,0,0,0.9266],[0.4,0.365,0,0,0.931],[0.417,0.3534,0,0,0.9355],[0.433,0.3421,0,0,0.9397],[0.45,0.3304,0,0,0.9438],[0.467,0.3186,0,0,0.9479],[0.483,0.3074,0,0,0.9516]],"p":[[0,0.016,-0.1643,0.2063],[0.017,0.0158,-0.1688,0.2115],[0.033,0.0155,-0.1729,0.2167],[0.05,0.015,-0.1774,0.2216],[0.067,0.0147,-0.1815,0.2269],[0.083,0.0145,-0.1856,0.2321],[0.1,0.014,-0.1901,0.2374],[0.117,0.0138,-0.1943,0.2426],[0.133,0.0135,-0.1988,0.2479],[0.15,0.013,-0.2029,0.2531],[0.167,0.0127,-0.2074,0.258],[0.183,0.0123,-0.2115,0.2632],[0.2,0.012,-0.216,0.2685],[0.217,0.0118,-0.2201,0.2737],[0.233,0.0112,-0.2246,0.279],[0.25,0.011,-0.2167,0.2726],[0.267,0.0105,-0.2089,0.2666],[0.283,0.01,-0.201,0.2602],[0.3,0.0095,-0.1935,0.2543],[0.317,0.009,-0.1856,0.2479],[0.333,0.0088,-0.1777,0.2419],[0.35,0.0083,-0.1699,0.2359],[0.367,0.0077,-0.1624,0.2295],[0.383,0.0073,-0.1545,0.2235],[0.4,0.007,-0.1466,0.2171],[0.417,0.0065,-0.1387,0.2111],[0.433,0.006,-0.1309,0.2048],[0.45,0.0055,-0.1234,0.1988],[0.467,0.005,-0.1155,0.1924],[0.483,0.0047,-0.1076,0.1864]]},"head":{"q":[[0,-0.012,0.004,0.002,0.9999],[0.017,-0.023,0.003,0.0011,0.9997],[0.033,-0.0345,0.002,-0.0004,0.9994],[0.05,-0.046,0.0011,-0.002,0.9989],[0.067,-0.0571,0.0002,-0.0035,0.9984],[0.083,-0.0686,-0.0012,-0.0046,0.9976],[0.1,-0.0798,-0.002,-0.0062,0.9968],[0.117,-0.0914,-0.0028,-0.0073,0.9958],[0.133,-0.0115,-0.0049,-0.0086,0.9999],[0.15,0.0681,-0.0067,-0.0096,0.9976],[0.167,0.1476,-0.0082,-0.0109,0.989],[0.183,0.2257,-0.0099,-0.0116,0.9741],[0.2,0.3027,-0.0114,-0.0127,0.9529],[0.217,0.3779,-0.0124,-0.0133,0.9257],[0.233,0.4502,-0.0144,-0.014,0.8927],[0.25,0.4397,-0.0133,-0.0147,0.898],[0.267,0.4291,-0.0127,-0.015,0.9031],[0.283,0.4181,-0.0116,-0.0156,0.9082],[0.3,0.4071,-0.0111,-0.0164,0.9132],[0.317,0.3964,-0.01,-0.0169,0.9178],[0.333,0.3857,-0.0094,-0.0172,0.9224],[0.35,0.3746,-0.0082,-0.0177,0.927],[0.367,0.3452,-0.0069,-0.0188,0.9383],[0.383,0.316,-0.006,-0.0196,0.9485],[0.4,0.2861,-0.0044,-0.0201,0.958],[0.417,0.256,-0.0034,-0.0208,0.9664],[0.433,0.2259,-0.0024,-0.0215,0.9739],[0.45,0.1952,-0.0009,-0.0223,0.9805],[0.467,0.1647,0.0002,-0.0229,0.9861],[0.483,0.1338,0.0014,-0.0234,0.9907]],"p":[[0,0,0.0064,0],[0.017,0,0.0064,0],[0.033,0,0.0064,0],[0.05,0,0.0064,0],[0.067,0,0.0064,0],[0.083,0,0.0064,0],[0.1,0,0.0064,0],[0.117,0,0.0064,0],[0.133,0,0.0064,0],[0.15,0,0.0064,0],[0.167,0,0.0064,0],[0.183,0,0.0064,0],[0.2,0,0.0064,0],[0.217,0,0.0064,0],[0.233,0,0.0064,0],[0.25,0,0.0064,0],[0.267,0,0.0064,0],[0.283,0,0.0064,0],[0.3,0,0.0064,0],[0.317,0,0.0064,0],[0.333,0,0.0064,0],[0.35,0,0.0064,0],[0.367,0,0.0064,0],[0.383,0,0.0064,0],[0.4,0,0.0064,0],[0.417,0,0.0064,0],[0.433,0,0.0064,0],[0.45,0,0.0064,0],[0.467,0,0.0064,0],[0.483,0,0.0064,0]]},"armL":{"q":[[0,-0.3765,-0.0841,0.2061,0.8993],[0.017,-0.3749,-0.0902,0.1879,0.9033],[0.033,-0.3728,-0.0962,0.1698,0.9071],[0.05,-0.371,-0.1021,0.1522,0.9104],[0.067,-0.369,-0.1079,0.1343,0.9133],[0.083,-0.3666,-0.1141,0.1159,0.916],[0.1,-0.3639,-0.1199,0.0979,0.9185],[0.117,-0.3617,-0.1254,0.08,0.9204],[0.133,-0.3589,-0.1314,0.0617,0.922],[0.15,-0.3564,-0.137,0.0435,0.9232],[0.167,-0.3532,-0.1428,0.0255,0.9242],[0.183,-0.3501,-0.1486,0.007,0.9248],[0.2,-0.3472,-0.1542,-0.0114,0.925],[0.217,-0.3439,-0.1594,-0.0295,0.9249],[0.233,-0.3404,-0.1647,-0.0477,0.9245],[0.25,-0.3382,-0.1639,-0.0648,0.9244],[0.267,-0.3365,-0.1627,-0.0825,0.9238],[0.283,-0.3341,-0.1614,-0.1001,0.9232],[0.3,-0.3321,-0.1601,-0.1173,0.9221],[0.317,-0.3294,-0.1588,-0.1345,0.921],[0.333,-0.3269,-0.1576,-0.1518,0.9194],[0.35,-0.3244,-0.1561,-0.1691,0.9175],[0.367,-0.328,-0.1401,-0.1451,0.9229],[0.383,-0.3315,-0.1239,-0.1209,0.9274],[0.4,-0.3346,-0.1076,-0.0967,0.9312],[0.417,-0.3374,-0.0912,-0.072,0.9342],[0.433,-0.3399,-0.075,-0.048,0.9362],[0.45,-0.3421,-0.0586,-0.0235,0.9375],[0.467,-0.3439,-0.042,0.0011,0.9381],[0.483,-0.3454,-0.0253,0.0253,0.9378]],"p":[[0,-0.067,-0.0934,0.1762],[0.017,-0.0777,-0.0964,0.1916],[0.033,-0.0885,-0.0994,0.2066],[0.05,-0.099,-0.1024,0.222],[0.067,-0.1098,-0.1054,0.2374],[0.083,-0.1205,-0.1084,0.2524],[0.1,-0.1313,-0.1114,0.2677],[0.117,-0.142,-0.1144,0.2831],[0.133,-0.1527,-0.1174,0.2985],[0.15,-0.1635,-0.1204,0.3135],[0.167,-0.1742,-0.1234,0.3289],[0.183,-0.1847,-0.1264,0.3443],[0.2,-0.1955,-0.1294,0.3592],[0.217,-0.2062,-0.1324,0.3746],[0.233,-0.217,-0.1354,0.39],[0.25,-0.2045,-0.132,0.3739],[0.267,-0.192,-0.1283,0.3578],[0.283,-0.1795,-0.1249,0.3416],[0.3,-0.167,-0.1211,0.3259],[0.317,-0.1547,-0.1174,0.3097],[0.333,-0.1422,-0.114,0.2936],[0.35,-0.1298,-0.1102,0.2775],[0.367,-0.1172,-0.1069,0.2617],[0.383,-0.1047,-0.1031,0.2456],[0.4,-0.0922,-0.0998,0.2295],[0.417,-0.0798,-0.096,0.2134],[0.433,-0.0673,-0.0926,0.1973],[0.45,-0.055,-0.0889,0.1815],[0.467,-0.0425,-0.0851,0.1654],[0.483,-0.03,-0.0818,0.1492]]},"armR":{"q":[[0,-0.3302,0.2229,-0.2133,0.8921],[0.017,-0.3342,0.2225,-0.1935,0.8952],[0.033,-0.3381,0.222,-0.1729,0.898],[0.05,-0.3419,0.2214,-0.1531,0.9004],[0.067,-0.3456,0.2203,-0.1327,0.9025],[0.083,-0.349,0.2195,-0.1128,0.9041],[0.1,-0.3521,0.2187,-0.0923,0.9053],[0.117,-0.3555,0.2175,-0.0719,0.9062],[0.133,-0.3583,0.2161,-0.0514,0.9068],[0.15,-0.3615,0.2148,-0.0313,0.9068],[0.167,-0.364,0.2137,-0.0106,0.9065],[0.183,-0.3665,0.2123,0.0098,0.9058],[0.2,-0.369,0.2106,0.03,0.9048],[0.217,-0.3716,0.2089,0.0505,0.9032],[0.233,-0.3735,0.2074,0.071,0.9013],[0.25,-0.3636,0.2103,0.0852,0.9035],[0.267,-0.3537,0.2136,0.0995,0.9052],[0.283,-0.3437,0.2168,0.1136,0.9066],[0.3,-0.3333,0.2197,0.1275,0.9079],[0.317,-0.323,0.2224,0.1417,0.9089],[0.333,-0.3125,0.2253,0.1555,0.9096],[0.35,-0.302,0.2285,0.1693,0.9099],[0.367,-0.3026,0.2166,0.1373,0.918],[0.383,-0.3034,0.2048,0.1045,0.9247],[0.4,-0.303,0.1925,0.0718,0.9306],[0.417,-0.3026,0.1799,0.039,0.9352],[0.433,-0.302,0.1673,0.0064,0.9385],[0.45,-0.3006,0.1545,-0.0261,0.9408],[0.467,-0.2994,0.1414,-0.0591,0.9417],[0.483,-0.2976,0.1278,-0.0919,0.9416]],"p":[[0,0.02,-0.0656,0.1748],[0.017,0.0288,-0.072,0.1909],[0.033,0.0372,-0.0784,0.207],[0.05,0.0457,-0.0844,0.2231],[0.067,0.0545,-0.0907,0.2393],[0.083,0.063,-0.0971,0.255],[0.1,0.0715,-0.1035,0.2711],[0.117,0.0803,-0.1099,0.2873],[0.133,0.0887,-0.1162,0.3034],[0.15,0.0973,-0.1222,0.3191],[0.167,0.106,-0.1286,0.3352],[0.183,0.1145,-0.135,0.3514],[0.2,0.1232,-0.1414,0.3675],[0.217,0.1318,-0.1477,0.3836],[0.233,0.1403,-0.1541,0.3994],[0.25,0.1315,-0.1496,0.3821],[0.267,0.123,-0.1455,0.3649],[0.283,0.1143,-0.1414,0.3476],[0.3,0.1055,-0.1372,0.3304],[0.317,0.0968,-0.1327,0.3131],[0.333,0.0882,-0.1286,0.2959],[0.35,0.0795,-0.1245,0.2786],[0.367,0.07,-0.1192,0.2591],[0.383,0.0607,-0.114,0.2396],[0.4,0.0512,-0.1091,0.2201],[0.417,0.042,-0.1039,0.2006],[0.433,0.0325,-0.0986,0.1811],[0.45,0.023,-0.0938,0.1616],[0.467,0.0138,-0.0885,0.1421],[0.483,0.0043,-0.0833,0.1226]]},"legL":{"q":[[0,0.0523,-0.0612,0.0092,0.9967],[0.017,0.0353,-0.0562,0.013,0.9977],[0.033,0.0179,-0.0513,0.0169,0.9984],[0.05,0.0005,-0.0465,0.0205,0.9987],[0.067,-0.017,-0.0415,0.0243,0.9987],[0.083,-0.034,-0.0365,0.0278,0.9984],[0.1,-0.0516,-0.0317,0.0314,0.9977],[0.117,-0.0688,-0.0265,0.0353,0.9967],[0.133,-0.0861,-0.0215,0.0393,0.9953],[0.15,-0.103,-0.0165,0.0426,0.9936],[0.167,-0.1204,-0.0117,0.0465,0.9916],[0.183,-0.1377,-0.0065,0.0501,0.9892],[0.2,-0.1546,-0.0014,0.054,0.9865],[0.217,-0.1716,0.0037,0.0576,0.9835],[0.233,-0.1888,0.0087,0.0609,0.9801],[0.25,-0.1943,0.0139,0.0584,0.9791],[0.267,-0.1999,0.0193,0.0556,0.978],[0.283,-0.2055,0.0251,0.0534,0.9769],[0.3,-0.2118,0.0305,0.0507,0.9755],[0.317,-0.2173,0.036,0.048,0.9743],[0.333,-0.2228,0.041,0.0454,0.9729],[0.35,-0.2285,0.0465,0.0429,0.9715],[0.367,-0.2342,0.0522,0.0399,0.97],[0.383,-0.2398,0.0573,0.0374,0.9684],[0.4,-0.2454,0.063,0.0351,0.9667],[0.417,-0.251,0.0683,0.0323,0.965],[0.433,-0.2565,0.0737,0.0295,0.9633],[0.45,-0.2622,0.0795,0.0269,0.9613],[0.467,-0.2674,0.0845,0.0241,0.9596],[0.483,-0.2731,0.0899,0.0215,0.9575]],"p":[[0,-0.0045,0.15,0.3247],[0.017,-0.0045,0.1661,0.3225],[0.033,-0.0045,0.1822,0.3199],[0.05,-0.0045,0.1984,0.3172],[0.067,-0.0045,0.2145,0.3146],[0.083,-0.0045,0.231,0.312],[0.1,-0.0043,0.2471,0.3094],[0.117,-0.0043,0.2632,0.3071],[0.133,-0.0043,0.2794,0.3045],[0.15,-0.0043,0.2955,0.3019],[0.167,-0.0043,0.3116,0.2993],[0.183,-0.0043,0.3277,0.2966],[0.2,-0.0043,0.3439,0.2944],[0.217,-0.0043,0.36,0.2918],[0.233,-0.0043,0.3761,0.2891],[0.25,-0.004,0.3641,0.285],[0.267,-0.004,0.3521,0.2809],[0.283,-0.0037,0.3401,0.2771],[0.3,-0.0037,0.3281,0.273],[0.317,-0.0035,0.3165,0.2689],[0.333,-0.0035,0.3045,0.2647],[0.35,-0.0035,0.2925,0.2606],[0.367,-0.0032,0.2805,0.2569],[0.383,-0.0032,0.2685,0.2528],[0.4,-0.003,0.2565,0.2486],[0.417,-0.003,0.2445,0.2445],[0.433,-0.0027,0.2325,0.2404],[0.45,-0.0027,0.2205,0.2366],[0.467,-0.0027,0.2085,0.2325],[0.483,-0.0025,0.1965,0.2284]]},"legR":{"q":[[0,0.0313,0.0138,-0.0535,0.998],[0.017,-0.0043,0.0138,-0.0556,0.9984],[0.033,-0.0398,0.0138,-0.0571,0.9975],[0.05,-0.0755,0.014,-0.0587,0.9953],[0.067,-0.1111,0.0143,-0.0599,0.9919],[0.083,-0.146,0.0142,-0.0617,0.9873],[0.1,-0.1811,0.0141,-0.0626,0.9814],[0.117,-0.2163,0.0137,-0.0642,0.9741],[0.133,-0.2506,0.0138,-0.0653,0.9658],[0.15,-0.285,0.0136,-0.0665,0.9561],[0.167,-0.3185,0.0137,-0.0673,0.9454],[0.183,-0.352,0.0134,-0.0683,0.9334],[0.2,-0.3852,0.0133,-0.0694,0.9201],[0.217,-0.4179,0.0131,-0.0701,0.9057],[0.233,-0.45,0.0133,-0.0708,0.8901],[0.25,-0.4385,0.0128,-0.0707,0.8959],[0.267,-0.4272,0.0124,-0.0706,0.9013],[0.283,-0.416,0.012,-0.0706,0.9065],[0.3,-0.4043,0.0115,-0.0705,0.9118],[0.317,-0.393,0.0113,-0.0709,0.9167],[0.333,-0.3812,0.0109,-0.0709,0.9217],[0.35,-0.3694,0.0104,-0.0708,0.9265],[0.367,-0.3579,0.01,-0.0708,0.931],[0.383,-0.346,0.0096,-0.0707,0.9355],[0.4,-0.3339,0.0092,-0.0707,0.9399],[0.417,-0.3225,0.0092,-0.0705,0.9439],[0.433,-0.3106,0.0088,-0.0704,0.9479],[0.45,-0.2983,0.0084,-0.0704,0.9518],[0.467,-0.2862,0.008,-0.0703,0.9555],[0.483,-0.2742,0.0074,-0.0698,0.9591]],"p":[[0,-0.0127,0.1785,0.2692],[0.017,-0.0127,0.1811,0.2569],[0.033,-0.013,0.1841,0.2441],[0.05,-0.0132,0.1871,0.2314],[0.067,-0.0135,0.1898,0.219],[0.083,-0.0138,0.1928,0.2063],[0.1,-0.014,0.1954,0.1939],[0.117,-0.0143,0.1984,0.1811],[0.133,-0.0143,0.201,0.1688],[0.15,-0.0145,0.204,0.156],[0.167,-0.0147,0.207,0.1432],[0.183,-0.015,0.2096,0.1309],[0.2,-0.0152,0.2126,0.1181],[0.217,-0.0155,0.2152,0.1057],[0.233,-0.0158,0.2182,0.093],[0.25,-0.0158,0.2213,0.1046],[0.267,-0.016,0.2243,0.1166],[0.283,-0.0163,0.2273,0.1283],[0.3,-0.0165,0.2303,0.1399],[0.317,-0.0168,0.2329,0.1515],[0.333,-0.0168,0.2359,0.1631],[0.35,-0.017,0.2389,0.1751],[0.367,-0.0173,0.2419,0.1867],[0.383,-0.0175,0.2449,0.1984],[0.4,-0.0177,0.2479,0.21],[0.417,-0.0177,0.2509,0.2216],[0.433,-0.018,0.2539,0.2336],[0.45,-0.0182,0.2569,0.2453],[0.467,-0.0185,0.2599,0.2569],[0.483,-0.0187,0.2625,0.2685]]}}},"climb_ClimbAnim":{"dur":0.458,"loop":true,"t":{"torso":{"q":[[0,0,0,0.0196,0.9998],[0.05,0,0,0.0157,0.9999],[0.1,0,0,0.0119,0.9999],[0.15,0,0,0.0039,1],[0.2,0,0,0.0008,1],[0.25,0,0,0.0007,1],[0.3,0,0,0.0034,1],[0.35,0,0,0.0113,0.9999],[0.4,0,0,0.0152,0.9999],[0.45,0,0,0.0195,0.9998]],"p":[[0,0,0,-0.1624],[0.05,0,0,-0.1624],[0.1,0,0,-0.1624],[0.15,0,0,-0.1624],[0.2,0,0,-0.1624],[0.25,0,0,-0.1624],[0.3,0,0,-0.1624],[0.35,0,0,-0.1624],[0.4,0,0,-0.1624],[0.45,0,0,-0.1624]]},"head":{"q":[[0,-0.2466,-0.0067,-0.0386,0.9683],[0.05,-0.2464,-0.0042,-0.0286,0.9687],[0.1,-0.2463,-0.0017,-0.0189,0.969],[0.15,-0.2464,0.0036,0.0018,0.9692],[0.2,-0.2465,0.0054,0.0092,0.9691],[0.25,-0.2465,0.0058,0.0106,0.9691],[0.3,-0.2464,0.0039,0.0032,0.9691],[0.35,-0.2463,-0.0013,-0.0173,0.969],[0.4,-0.2464,-0.0039,-0.0273,0.9688],[0.45,-0.2466,-0.0067,-0.0385,0.9683]]},"armL":{"q":[[0,-0.4276,0.0095,-0.0009,0.9039],[0.05,-0.5234,0.0484,0.0158,0.8506],[0.1,-0.6651,0.0463,0.0261,0.7448],[0.15,-0.9629,-0.0306,-0.0158,0.2678],[0.2,-0.9577,-0.0657,-0.0174,0.2797],[0.25,-0.9102,-0.1071,-0.0514,0.3967],[0.3,-0.8583,-0.0891,-0.0348,0.5041],[0.35,-0.6705,-0.0331,-0.0108,0.7411],[0.4,-0.5605,-0.0095,-0.0066,0.8281],[0.45,-0.4284,0.0094,-0.001,0.9035]],"p":[[0,0.0062,-0.0558,0.0199],[0.05,0.0081,-0.032,0.0232],[0.1,0.0076,-0.0086,0.0133],[0.15,-0.0075,0.0529,-0.1081],[0.2,-0.0184,0.0468,0.0169],[0.25,-0.0215,0.0313,0.0434],[0.3,-0.0162,0.0089,0.0306],[0.35,-0.0039,-0.0401,-0.0004],[0.4,0.0017,-0.0534,-0.0078],[0.45,0.0062,-0.0558,0.0192]]},"armR":{"q":[[0,0.9817,-0.0558,-0.0145,-0.1813],[0.05,0.9606,-0.0707,-0.0247,-0.2675],[0.1,0.9206,-0.0711,-0.0166,-0.3837],[0.15,0.7798,-0.0496,-0.0076,-0.624],[0.2,0.6922,-0.0361,-0.0076,-0.7208],[0.25,0.5563,-0.0105,-0.0092,-0.8308],[0.3,0.5395,0.0041,-0.0028,-0.842],[0.35,0.7135,0.0638,0.06,-0.6951],[0.4,0.8383,0.0427,0.0718,-0.5388],[0.45,0.9823,-0.0326,-0.0004,-0.1846]],"p":[[0,0.0211,0.067,0.0063],[0.05,0.0152,0.0734,0.0615],[0.1,0.0087,0.057,0.0696],[0.15,0.0071,-0.0098,0.0699],[0.2,0.006,-0.0442,0.07],[0.25,0.003,-0.0931,0.0698],[0.3,0.0001,-0.0988,0.0698],[0.35,-0.0139,-0.0465,0.0696],[0.4,-0.0118,-0.0057,0.0614],[0.45,0.0127,0.0665,0.0069]]},"legL":{"q":[[0,-0.0478,0.0062,-0.0065,0.9988],[0.05,-0.0513,0.0062,-0.0003,0.9987],[0.1,-0.0737,0.0063,0.0004,0.9973],[0.15,-0.1642,0.0054,0.0033,0.9864],[0.2,-0.0439,0.0037,0.0026,0.999],[0.25,0.2982,-0.0038,-0.0076,0.9545],[0.3,0.286,-0.0078,-0.0128,0.9581],[0.35,0.0311,-0.0048,-0.0284,0.9991],[0.4,-0.0448,0.0017,-0.0281,0.9986],[0.45,-0.0663,0.0064,-0.013,0.9977]],"p":[[0,0.0267,0.3608,0.3682],[0.05,0.0217,0.1961,0.3738],[0.1,0.0194,0.1255,0.3423],[0.15,0.0176,0.0109,0.0696],[0.2,0.0182,0.0198,0.0803],[0.25,0.0229,0.0691,0.235],[0.3,0.0251,0.2419,0.33],[0.35,0.0314,0.4293,0.3733],[0.4,0.0316,0.4088,0.3522],[0.45,0.0316,0.4104,0.355]]},"legR":{"q":[[0,0.3078,-0.0148,-0.0169,0.9512],[0.05,0.2589,-0.0202,-0.0108,0.9656],[0.1,0.1674,-0.0241,-0.0074,0.9856],[0.15,-0.001,-0.0074,-0.0036,1],[0.2,-0.0165,0.0027,0.0009,0.9999],[0.25,-0.0239,0.0144,-0.0046,0.9996],[0.3,-0.0536,0.0134,-0.0103,0.9984],[0.35,-0.1415,0.0068,-0.016,0.9898],[0.4,-0.1218,0.0006,-0.019,0.9924],[0.45,0.3302,-0.0152,-0.0165,0.9436]],"p":[[0,-0.0177,0.0309,0.1051],[0.05,-0.0203,0.1304,0.2914],[0.1,-0.0207,0.2487,0.3405],[0.15,-0.0207,0.4184,0.3751],[0.2,-0.0204,0.4123,0.3777],[0.25,-0.0192,0.2131,0.3762],[0.3,-0.0196,0.1325,0.334],[0.35,-0.022,0.011,0.1447],[0.4,-0.0218,0.0065,0.0558],[0.45,-0.0181,0.0123,0.0689]]}}},"rig_sit":{"dur":2,"loop":true,"t":{"torso":{"q":[[0,-0.0872,0,0,0.9962],[0.067,-0.0852,0,0,0.9964],[0.133,-0.0805,0,0,0.9968],[0.2,-0.0749,0,0,0.9972],[0.267,-0.0703,0,0,0.9975],[0.333,-0.0683,0,0,0.9977],[0.4,-0.0683,0,0,0.9977],[0.467,-0.0683,0,0,0.9977],[0.533,-0.0683,0,0,0.9977],[0.6,-0.0683,0,0,0.9977],[0.667,-0.0683,0,0,0.9977],[0.733,-0.0694,0,0,0.9976],[0.8,-0.0722,0,0,0.9974],[0.867,-0.0765,0,0,0.9971],[0.933,-0.0816,0,0,0.9967],[1,-0.0872,0,0,0.9962],[1.067,-0.0927,0,0,0.9957],[1.133,-0.0978,0,0,0.9952],[1.2,-0.1021,0,0,0.9948],[1.267,-0.1049,0,0,0.9945],[1.333,-0.106,0,0,0.9944],[1.4,-0.106,0,0,0.9944],[1.467,-0.106,0,0,0.9944],[1.533,-0.106,0,0,0.9944],[1.6,-0.106,0,0,0.9944],[1.667,-0.106,0,0,0.9944],[1.733,-0.104,0,0,0.9946],[1.8,-0.0993,0,0,0.9951],[1.867,-0.0938,0,0,0.9956],[1.933,-0.0891,0,0,0.996],[2,-0.0872,0,0,0.9962]],"p":[[0,0,-0.5175,0],[0.067,0,-0.5165,0],[0.133,0,-0.5141,0],[0.2,0,-0.5112,0],[0.267,0,-0.5088,0],[0.333,0,-0.5078,0],[0.4,0,-0.5078,0],[0.467,0,-0.5078,0],[0.533,0,-0.5078,0],[0.6,0,-0.5078,0],[0.667,0,-0.5078,0],[0.733,0,-0.5083,0],[0.8,0,-0.5098,0],[0.867,0,-0.512,0],[0.933,0,-0.5146,0],[1,0,-0.5175,0],[1.067,0,-0.5204,0],[1.133,0,-0.523,0],[1.2,0,-0.5252,0],[1.267,0,-0.5267,0],[1.333,0,-0.5272,0],[1.4,0,-0.5272,0],[1.467,0,-0.5272,0],[1.533,0,-0.5272,0],[1.6,0,-0.5272,0],[1.667,0,-0.5272,0],[1.733,0,-0.5262,0],[1.8,0,-0.5238,0],[1.867,0,-0.5209,0],[1.933,0,-0.5185,0],[2,0,-0.5175,0]]},"legR":{"q":[[0,-0.661,0.0462,-0.0522,0.7471],[0.067,-0.6615,0.0463,-0.0522,0.7467],[0.133,-0.6628,0.0463,-0.0521,0.7456],[0.2,-0.6648,0.0465,-0.052,0.7437],[0.267,-0.6675,0.0467,-0.0518,0.7413],[0.333,-0.6707,0.0469,-0.0516,0.7384],[0.4,-0.6744,0.0472,-0.0514,0.7351],[0.467,-0.6783,0.0474,-0.0511,0.7315],[0.533,-0.6823,0.0477,-0.0509,0.7277],[0.6,-0.6862,0.048,-0.0506,0.7241],[0.667,-0.6898,0.0482,-0.0504,0.7206],[0.733,-0.693,0.0485,-0.0502,0.7176],[0.8,-0.6956,0.0486,-0.05,0.715],[0.867,-0.6975,0.0488,-0.0499,0.7131],[0.933,-0.6988,0.0489,-0.0498,0.7119],[1,-0.6992,0.0489,-0.0498,0.7115],[1.067,-0.6988,0.0489,-0.0498,0.7119],[1.133,-0.6975,0.0488,-0.0499,0.7131],[1.2,-0.6956,0.0486,-0.05,0.715],[1.267,-0.693,0.0485,-0.0502,0.7176],[1.333,-0.6898,0.0482,-0.0504,0.7206],[1.4,-0.6862,0.048,-0.0506,0.7241],[1.467,-0.6823,0.0477,-0.0509,0.7277],[1.533,-0.6783,0.0474,-0.0511,0.7315],[1.6,-0.6744,0.0472,-0.0514,0.7351],[1.667,-0.6707,0.0469,-0.0516,0.7384],[1.733,-0.6675,0.0467,-0.0518,0.7413],[1.8,-0.6648,0.0465,-0.052,0.7437],[1.867,-0.6628,0.0463,-0.0521,0.7456],[1.933,-0.6615,0.0463,-0.0522,0.7467],[2,-0.661,0.0462,-0.0522,0.7471]]},"head":{"q":[[0,0.0523,0,0,0.9986],[0.067,0.0499,0.0094,-0.0003,0.9987],[0.133,0.0443,0.0318,-0.0009,0.9985],[0.2,0.0375,0.0586,-0.0017,0.9976],[0.267,0.0319,0.0811,-0.0024,0.9962],[0.333,0.0296,0.0905,-0.0027,0.9955],[0.4,0.0296,0.0905,-0.0027,0.9955],[0.467,0.0296,0.0905,-0.0027,0.9955],[0.533,0.0296,0.0905,-0.0027,0.9955],[0.6,0.0296,0.0905,-0.0027,0.9955],[0.667,0.0296,0.0905,-0.0027,0.9955],[0.733,0.0308,0.0854,-0.0026,0.9959],[0.8,0.0343,0.0717,-0.0024,0.9968],[0.867,0.0394,0.0514,-0.002,0.9979],[0.933,0.0456,0.0268,-0.0012,0.9986],[1,0.0523,0,0,0.9986],[1.067,0.059,-0.0268,0.0016,0.9979],[1.133,0.0651,-0.0513,0.0034,0.9966],[1.2,0.0701,-0.0715,0.0051,0.995],[1.267,0.0734,-0.0853,0.0063,0.9936],[1.333,0.0747,-0.0903,0.0068,0.9931],[1.4,0.0747,-0.0903,0.0068,0.9931],[1.467,0.0747,-0.0903,0.0068,0.9931],[1.533,0.0747,-0.0903,0.0068,0.9931],[1.6,0.0747,-0.0903,0.0068,0.9931],[1.667,0.0747,-0.0903,0.0068,0.9931],[1.733,0.0723,-0.0809,0.0061,0.9941],[1.8,0.0667,-0.0585,0.0044,0.996],[1.867,0.0601,-0.0318,0.0024,0.9977],[1.933,0.0546,-0.0094,0.0007,0.9985],[2,0.0523,0,0,0.9986]]},"armR":{"q":[[0,-0.2406,0.0253,-0.1014,0.965],[0.067,-0.2429,0.0255,-0.1014,0.9644],[0.133,-0.2483,0.0261,-0.1012,0.963],[0.2,-0.2547,0.0268,-0.101,0.9614],[0.267,-0.2601,0.0273,-0.1009,0.9599],[0.333,-0.2624,0.0276,-0.1008,0.9593],[0.4,-0.2624,0.0276,-0.1008,0.9593],[0.467,-0.2624,0.0276,-0.1008,0.9593],[0.533,-0.2624,0.0276,-0.1008,0.9593],[0.6,-0.2624,0.0276,-0.1008,0.9593],[0.667,-0.2624,0.0276,-0.1008,0.9593],[0.733,-0.2612,0.0275,-0.1009,0.9596],[0.8,-0.2579,0.0271,-0.101,0.9605],[0.867,-0.253,0.0266,-0.1011,0.9618],[0.933,-0.2471,0.026,-0.1013,0.9633],[1,-0.2406,0.0253,-0.1014,0.965],[1.067,-0.2341,0.0246,-0.1016,0.9666],[1.133,-0.2281,0.024,-0.1017,0.968],[1.2,-0.2232,0.0235,-0.1019,0.9691],[1.267,-0.2199,0.0231,-0.1019,0.9699],[1.333,-0.2187,0.023,-0.102,0.9702],[1.4,-0.2187,0.023,-0.102,0.9702],[1.467,-0.2187,0.023,-0.102,0.9702],[1.533,-0.2187,0.023,-0.102,0.9702],[1.6,-0.2187,0.023,-0.102,0.9702],[1.667,-0.2187,0.023,-0.102,0.9702],[1.733,-0.2209,0.0232,-0.1019,0.9697],[1.8,-0.2264,0.0238,-0.1018,0.9684],[1.867,-0.2329,0.0245,-0.1016,0.9669],[1.933,-0.2383,0.025,-0.1015,0.9655],[2,-0.2406,0.0253,-0.1014,0.965]]},"legL":{"q":[[0,-0.6992,-0.0489,0.0498,0.7115],[0.067,-0.6988,-0.0489,0.0498,0.7119],[0.133,-0.6975,-0.0488,0.0499,0.7131],[0.2,-0.6956,-0.0486,0.05,0.715],[0.267,-0.693,-0.0485,0.0502,0.7176],[0.333,-0.6898,-0.0482,0.0504,0.7206],[0.4,-0.6862,-0.048,0.0506,0.7241],[0.467,-0.6823,-0.0477,0.0509,0.7277],[0.533,-0.6783,-0.0474,0.0511,0.7315],[0.6,-0.6744,-0.0472,0.0514,0.7351],[0.667,-0.6707,-0.0469,0.0516,0.7384],[0.733,-0.6675,-0.0467,0.0518,0.7413],[0.8,-0.6648,-0.0465,0.052,0.7437],[0.867,-0.6628,-0.0463,0.0521,0.7456],[0.933,-0.6615,-0.0463,0.0522,0.7467],[1,-0.661,-0.0462,0.0522,0.7471],[1.067,-0.6615,-0.0463,0.0522,0.7467],[1.133,-0.6628,-0.0463,0.0521,0.7456],[1.2,-0.6648,-0.0465,0.052,0.7437],[1.267,-0.6675,-0.0467,0.0518,0.7413],[1.333,-0.6707,-0.0469,0.0516,0.7384],[1.4,-0.6744,-0.0472,0.0514,0.7351],[1.467,-0.6783,-0.0474,0.0511,0.7315],[1.533,-0.6823,-0.0477,0.0509,0.7277],[1.6,-0.6862,-0.048,0.0506,0.7241],[1.667,-0.6898,-0.0482,0.0504,0.7206],[1.733,-0.693,-0.0485,0.0502,0.7176],[1.8,-0.6956,-0.0486,0.05,0.715],[1.867,-0.6975,-0.0488,0.0499,0.7131],[1.933,-0.6988,-0.0489,0.0498,0.7119],[2,-0.6992,-0.0489,0.0498,0.7115]]},"armL":{"q":[[0,-0.2406,-0.0253,0.1014,0.965],[0.067,-0.2429,-0.0255,0.1014,0.9644],[0.133,-0.2483,-0.0261,0.1012,0.963],[0.2,-0.2547,-0.0268,0.101,0.9614],[0.267,-0.2601,-0.0273,0.1009,0.9599],[0.333,-0.2624,-0.0276,0.1008,0.9593],[0.4,-0.2624,-0.0276,0.1008,0.9593],[0.467,-0.2624,-0.0276,0.1008,0.9593],[0.533,-0.2624,-0.0276,0.1008,0.9593],[0.6,-0.2624,-0.0276,0.1008,0.9593],[0.667,-0.2624,-0.0276,0.1008,0.9593],[0.733,-0.2612,-0.0275,0.1009,0.9596],[0.8,-0.2579,-0.0271,0.101,0.9605],[0.867,-0.253,-0.0266,0.1011,0.9618],[0.933,-0.2471,-0.026,0.1013,0.9633],[1,-0.2406,-0.0253,0.1014,0.965],[1.067,-0.2341,-0.0246,0.1016,0.9666],[1.133,-0.2281,-0.024,0.1017,0.968],[1.2,-0.2232,-0.0235,0.1019,0.9691],[1.267,-0.2199,-0.0231,0.1019,0.9699],[1.333,-0.2187,-0.023,0.102,0.9702],[1.4,-0.2187,-0.023,0.102,0.9702],[1.467,-0.2187,-0.023,0.102,0.9702],[1.533,-0.2187,-0.023,0.102,0.9702],[1.6,-0.2187,-0.023,0.102,0.9702],[1.667,-0.2187,-0.023,0.102,0.9702],[1.733,-0.2209,-0.0232,0.1019,0.9697],[1.8,-0.2264,-0.0238,0.1018,0.9684],[1.867,-0.2329,-0.0245,0.1016,0.9669],[1.933,-0.2383,-0.025,0.1015,0.9655],[2,-0.2406,-0.0253,0.1014,0.965]]}}},"custom_attack_combo":{"dur":1.6,"loop":false,"t":{"torso":{"q":[[0,0,-0.1564,0,0.9877],[0.067,0.0049,-0.1867,-0.0032,0.9824],[0.133,0.0183,-0.2493,-0.0098,0.9682],[0.2,0.0381,-0.301,-0.0153,0.9527],[0.233,0.0498,-0.3086,-0.0162,0.9497],[0.267,0.0617,-0.2681,-0.0132,0.9613],[0.333,0.0817,-0.0444,0.0065,0.9956],[0.4,0.1034,0.2159,0.0324,0.9704],[0.467,0.1138,0.3557,0.0437,0.9266],[0.533,0.088,0.2821,0.0431,0.9544],[0.6,0.0299,0.1228,0.0387,0.9912],[0.667,-0.0329,-0.0469,0.033,0.9978],[0.733,-0.0784,-0.1705,0.0237,0.982],[0.767,-0.0855,-0.1901,0.0166,0.9779],[0.8,-0.0743,-0.1759,0.0082,0.9816],[0.867,-0.0019,-0.0863,-0.0109,0.9962],[0.933,0.099,0.0373,-0.0289,0.994],[1,0.1934,0.1504,-0.0431,0.9686],[1.067,0.2366,0.2017,-0.0503,0.9491],[1.133,0.2261,0.1927,-0.0478,0.9537],[1.2,0.1985,0.1693,-0.0417,0.9645],[1.267,0.1601,0.1365,-0.0335,0.977],[1.333,0.1168,0.0997,-0.0245,0.9878],[1.4,0.074,0.0632,-0.0157,0.9951],[1.467,0.0367,0.0313,-0.0078,0.9988],[1.533,0.0102,0.0086,-0.0021,0.9999],[1.6,0,0,0,1]],"p":[[0,0,0,0],[0.067,0,-0.0028,-0.006],[0.133,0,-0.0097,-0.0182],[0.2,0,-0.0183,-0.0284],[0.233,0,-0.0225,-0.03],[0.267,0,-0.0263,-0.0242],[0.333,0,-0.0323,0.0113],[0.4,0,-0.0362,0.0542],[0.467,0,-0.0375,0.075],[0.533,0,-0.0309,0.0703],[0.6,0,-0.0156,0.0594],[0.667,0,0.0014,0.0472],[0.733,0,0.0132,0.0388],[0.767,0,0.015,0.0375],[0.8,0,0.0114,0.0398],[0.867,0,-0.0122,0.055],[0.933,0,-0.0462,0.0768],[1,0,-0.0768,0.0965],[1.067,0,-0.09,0.105],[1.133,0,-0.0861,0.1005],[1.2,0,-0.0759,0.0886],[1.267,0,-0.0615,0.0718],[1.333,0,-0.045,0.0525],[1.4,0,-0.0285,0.0332],[1.467,0,-0.0141,0.0164],[1.533,0,-0.0039,0.0045],[1.6,0,0,0]]},"head":{"q":[[0,0,0.1219,0,0.9925],[0.067,0,0.1457,0,0.9893],[0.133,0,0.195,0,0.9808],[0.2,0,0.2358,0,0.9718],[0.233,0,0.2419,0,0.9703],[0.267,0,0.2103,0,0.9776],[0.333,0,0.0304,0,0.9995],[0.4,0,-0.1822,0,0.9833],[0.467,0,-0.2924,0,0.9563],[0.533,0,-0.2334,0,0.9724],[0.6,0,-0.1026,0,0.9947],[0.667,0,0.0393,0,0.9992],[0.733,0,0.1406,0,0.9901],[0.767,0,0.1564,0,0.9877],[0.8,-0.0041,0.1455,-0.0007,0.9894],[0.867,-0.0309,0.0748,-0.005,0.9967],[0.933,-0.0692,-0.025,-0.0109,0.9972],[1,-0.1045,-0.1152,-0.0164,0.9877],[1.067,-0.1204,-0.1553,-0.0191,0.9803],[1.133,-0.1151,-0.1485,-0.0182,0.982],[1.2,-0.1013,-0.1307,-0.016,0.9861],[1.267,-0.082,-0.1057,-0.0129,0.9909],[1.333,-0.0599,-0.0773,-0.0094,0.9952],[1.4,-0.0379,-0.0489,-0.006,0.9981],[1.467,-0.0188,-0.0242,-0.003,0.9995],[1.533,-0.0052,-0.0066,-0.0008,1],[1.6,0,0,0,1]]},"armL":{"q":[[0,-0.3539,-0.0561,0.146,0.9221],[0.067,-0.3671,-0.049,0.1169,0.9215],[0.133,-0.3947,-0.0321,0.0574,0.9164],[0.2,-0.4186,-0.0108,0.0081,0.9081],[0.233,-0.4226,0,0,0.9063],[0.267,-0.3827,0.01,0.0083,0.9238],[0.333,-0.1535,0.0264,0.057,0.9861],[0.4,0.1038,0.0355,0.1233,0.9863],[0.467,0.2383,0.042,0.1685,0.9556],[0.533,0.1553,0.0243,0.1755,0.9718],[0.6,-0.026,-0.0098,0.1752,0.9841],[0.667,-0.2263,-0.0465,0.1799,0.9562],[0.733,-0.3747,-0.0788,0.1873,0.9046],[0.767,-0.3978,-0.0845,0.1899,0.8936],[0.8,-0.3736,-0.0779,0.1916,0.9043],[0.867,-0.2175,-0.0404,0.1914,0.9563],[0.933,-0.0088,0.0011,0.1947,0.9808],[1,0.1803,0.0398,0.2076,0.9606],[1.067,0.2686,0.062,0.2162,0.9366],[1.133,0.2581,0.0604,0.2081,0.9415],[1.2,0.2275,0.053,0.1833,0.9549],[1.267,0.1838,0.0425,0.148,0.9708],[1.333,0.134,0.0308,0.1078,0.9846],[1.4,0.0846,0.0195,0.0681,0.9939],[1.467,0.0418,0.0097,0.0337,0.9985],[1.533,0.0115,0.0027,0.0093,0.9999],[1.6,0,0,0,1]]},"armR":{"q":[[0,-0.4704,0.1173,-0.2116,0.8486],[0.067,-0.5057,0.1611,-0.2329,0.8149],[0.133,-0.5848,0.2565,-0.2797,0.7169],[0.2,-0.6427,0.3451,-0.3182,0.6054],[0.233,-0.65,0.3603,-0.3244,0.5852],[0.267,-0.6586,0.3196,-0.2921,0.6154],[0.333,-0.6346,0.1045,-0.0947,0.7598],[0.4,-0.6283,-0.1055,0.1475,0.7565],[0.467,-0.6247,-0.2398,0.2663,0.6938],[0.533,-0.6767,-0.1826,0.2288,0.6755],[0.6,-0.7937,-0.073,0.1413,0.5871],[0.667,-0.9224,0.0271,0.0476,0.3822],[0.733,-0.9712,0.1062,-0.0136,0.2127],[0.767,-0.9743,0.1196,-0.0233,0.1894],[0.8,-0.9685,0.1126,-0.0183,0.2213],[0.867,-0.883,0.0723,0.0109,0.4636],[0.933,-0.6619,0.0277,0.0583,0.7468],[1,-0.4687,-0.0201,0.1087,0.8764],[1.067,-0.3224,-0.0453,0.1316,0.9363],[1.133,-0.2144,-0.0425,0.125,0.9678],[1.2,-0.1348,-0.0375,0.11,0.984],[1.267,-0.0781,-0.0306,0.0893,0.9925],[1.333,-0.0401,-0.0226,0.0655,0.9968],[1.4,-0.017,-0.0143,0.0416,0.9989],[1.467,-0.0051,-0.0071,0.0205,0.9998],[1.533,-0.0006,-0.002,0.0056,1],[1.6,0,0,0,1]]},"legL":{"q":[[0,-0.1564,0,0,0.9877],[0.067,-0.1599,0,0,0.9871],[0.133,-0.167,0,0,0.986],[0.2,-0.1728,0,0,0.985],[0.233,-0.1736,0,0,0.9848],[0.267,-0.1529,0,0,0.9882],[0.333,-0.0297,0,0,0.9996],[0.4,0.1173,0,0,0.9931],[0.467,0.1908,0,0,0.9816],[0.533,0.1635,0,0,0.9865],[0.6,0.0948,0,0,0.9955],[0.667,0.0037,0,0,1],[0.733,-0.0933,0,0,0.9956],[0.767,-0.1392,0,0,0.9903],[0.8,-0.1804,0,0,0.9836],[0.867,-0.2468,0,0,0.9691],[0.933,-0.292,0,0,0.9564],[1,-0.3176,0,0,0.9482],[1.067,-0.3256,0,0,0.9455],[1.133,-0.311,0,0,0.9504],[1.2,-0.273,0,0,0.962],[1.267,-0.2202,0,0,0.9755],[1.333,-0.1607,0,0,0.987],[1.4,-0.1018,0,0,0.9948],[1.467,-0.0505,0,0,0.9987],[1.533,-0.014,0,0,0.9999],[1.6,0,0,0,1]]},"legR":{"q":[[0,0.1564,0,0,0.9877],[0.067,0.1634,0,0,0.9866],[0.133,0.1777,0,0,0.9841],[0.2,0.1892,0,0,0.9819],[0.233,0.1908,0,0,0.9816],[0.267,0.1628,0,0,0.9867],[0.333,0.0006,0,0,1],[0.4,-0.193,0,0,0.9812],[0.467,-0.2924,0,0,0.9563],[0.533,-0.2576,0,0,0.9663],[0.6,-0.1716,0,0,0.9852],[0.667,-0.0607,0,0,0.9982],[0.733,0.0532,0,0,0.9986],[0.767,0.1045,0,0,0.9945],[0.8,0.1484,0,0,0.9889],[0.867,0.2136,0,0,0.9769],[0.933,0.2525,0,0,0.9676],[1,0.271,0,0,0.9626],[1.067,0.2756,0,0,0.9613],[1.133,0.2634,0,0,0.9647],[1.2,0.2315,0,0,0.9728],[1.267,0.187,0,0,0.9824],[1.333,0.1365,0,0,0.9906],[1.4,0.0865,0,0,0.9963],[1.467,0.0428,0,0,0.9991],[1.533,0.0118,0,0,0.9999],[1.6,0,0,0,1]]}}},"custom_mine":{"dur":0.708,"loop":true,"t":{"torso":{"q":[[0,0.0898,-0.0498,0.0045,0.9947],[0.042,0.0977,-0.0588,0.0089,0.9934],[0.083,0.1152,-0.0782,0.0191,0.9901],[0.125,0.1328,-0.0974,0.0299,0.9859],[0.167,0.1408,-0.1059,0.035,0.9837],[0.208,0.1081,-0.0824,0.0259,0.9904],[0.25,0.0347,-0.0282,0.0106,0.9989],[0.292,-0.04,0.03,0.0012,0.9988],[0.333,-0.085,0.0683,-0.0038,0.994],[0.375,-0.1037,0.0868,-0.0079,0.9908],[0.417,-0.1075,0.0915,-0.0099,0.9899],[0.458,-0.0944,0.0801,-0.0107,0.9922],[0.5,-0.0617,0.0528,-0.0113,0.9966],[0.542,-0.0198,0.0202,-0.0096,0.9996],[0.583,0.0215,-0.0086,-0.0057,0.9997],[0.625,0.0566,-0.0307,-0.001,0.9979],[0.667,0.0807,-0.0448,0.0029,0.9957],[0.708,0.0898,-0.0498,0.0045,0.9947]]},"head":{"q":[[0,0.05,0.03,-0.0015,0.9983],[0.042,0.0468,0.0362,-0.0017,0.9982],[0.083,0.0399,0.0499,-0.002,0.998],[0.125,0.0331,0.0637,-0.0021,0.9974],[0.167,0.0299,0.0699,-0.0021,0.9971],[0.208,0.0379,0.0538,-0.002,0.9978],[0.25,0.057,0.0177,-0.001,0.9982],[0.292,0.0799,-0.0199,0.0016,0.9966],[0.333,0.1,-0.0448,0.0019,0.994],[0.375,0.1138,-0.0573,-0.0008,0.9919],[0.417,0.1189,-0.0607,-0.0027,0.991],[0.458,0.1147,-0.0544,-0.0011,0.9919],[0.5,0.1041,-0.0391,0.0015,0.9938],[0.542,0.0899,-0.0199,0.0018,0.9958],[0.583,0.0752,-0.0012,0.0001,0.9972],[0.625,0.0625,0.0147,-0.0009,0.9979],[0.667,0.0534,0.0258,-0.0014,0.9982],[0.708,0.05,0.03,-0.0015,0.9983]]},"armL":{"q":[[0,-0.1726,-0.0226,0.1277,0.9764],[0.042,-0.1631,-0.0185,0.1346,0.9772],[0.083,-0.1423,-0.009,0.1497,0.9784],[0.125,-0.1217,0.0011,0.1643,0.9789],[0.167,-0.1124,0.0059,0.1708,0.9789],[0.208,-0.1326,-0.0044,0.159,0.9783],[0.25,-0.18,-0.0269,0.1313,0.9745],[0.292,-0.2335,-0.0502,0.1007,0.9658],[0.333,-0.2747,-0.0684,0.0797,0.9558],[0.375,-0.2994,-0.0804,0.0692,0.9482],[0.417,-0.3076,-0.0849,0.0664,0.9454],[0.458,-0.2974,-0.0806,0.0718,0.9486],[0.5,-0.2727,-0.0698,0.0845,0.9558],[0.542,-0.2426,-0.056,0.0989,0.9634],[0.583,-0.2149,-0.043,0.1111,0.9693],[0.625,-0.1927,-0.0323,0.1201,0.9733],[0.667,-0.178,-0.0252,0.1257,0.9756],[0.708,-0.1726,-0.0226,0.1277,0.9764]]},"armR":{"q":[[0,-0.7651,0.0587,-0.1008,0.6332],[0.042,-0.8045,0.064,-0.1036,0.5813],[0.083,-0.8786,0.0776,-0.1086,0.4586],[0.125,-0.9339,0.094,-0.1115,0.3264],[0.167,-0.9526,0.1022,-0.1119,0.2639],[0.208,-0.9125,0.0875,-0.1024,0.3863],[0.25,-0.7679,0.0688,-0.0764,0.6323],[0.292,-0.5523,0.0693,-0.0497,0.8292],[0.333,-0.3925,0.0773,-0.0354,0.9158],[0.375,-0.3177,0.0813,-0.0285,0.9443],[0.417,-0.3006,0.0817,-0.0262,0.9499],[0.458,-0.3288,0.0765,-0.0297,0.9408],[0.5,-0.4013,0.0652,-0.0398,0.9128],[0.542,-0.4984,0.0548,-0.0548,0.8635],[0.583,-0.5998,0.0504,-0.0716,0.7954],[0.625,-0.6861,0.0521,-0.0867,0.7204],[0.667,-0.744,0.0564,-0.097,0.6587],[0.708,-0.7651,0.0587,-0.1008,0.6332]]}}},"custom_chop":{"dur":0.708,"loop":true,"t":{"torso":{"q":[[0,0.0378,-0.1005,-0.0159,0.9941],[0.042,0.0432,-0.1194,-0.0175,0.9918],[0.083,0.0544,-0.1607,-0.02,0.9853],[0.125,0.0648,-0.2019,-0.0213,0.977],[0.167,0.0692,-0.2205,-0.0215,0.9727],[0.208,0.0491,-0.1696,-0.0212,0.9841],[0.25,0.0009,-0.0559,-0.0106,0.9984],[0.292,-0.0505,0.0594,0.013,0.9969],[0.333,-0.0804,0.1293,0.033,0.9878],[0.375,-0.0918,0.1592,0.0426,0.982],[0.417,-0.0936,0.1658,0.0446,0.9807],[0.458,-0.0815,0.1441,0.0383,0.9855],[0.5,-0.0529,0.0921,0.0245,0.994],[0.542,-0.0203,0.0298,0.0106,0.9993],[0.583,0.006,-0.0246,-0.0005,0.9997],[0.625,0.0241,-0.0656,-0.0086,0.9975],[0.667,0.0344,-0.0915,-0.0139,0.9951],[0.708,0.0378,-0.1005,-0.0159,0.9941]]},"head":{"q":[[0,0.0399,0.0749,-0.003,0.9964],[0.042,0.038,0.0882,-0.0003,0.9954],[0.083,0.0336,0.1175,0.0058,0.9925],[0.125,0.0287,0.1466,0.0121,0.9887],[0.167,0.0264,0.1598,0.015,0.9867],[0.208,0.0346,0.1239,0.0123,0.9916],[0.25,0.0525,0.0434,0.0073,0.9977],[0.292,0.0699,-0.0399,0.0028,0.9968],[0.333,0.0805,-0.0922,-0.0021,0.9925],[0.375,0.0855,-0.1156,-0.0068,0.9896],[0.417,0.0868,-0.121,-0.009,0.9888],[0.458,0.0827,-0.1045,-0.0059,0.9911],[0.5,0.0725,-0.0656,-0.0004,0.9952],[0.542,0.06,-0.02,0.0012,0.998],[0.583,0.0502,0.0195,-0.001,0.9985],[0.625,0.044,0.0494,-0.0022,0.9978],[0.667,0.0408,0.0683,-0.0028,0.9968],[0.708,0.0399,0.0749,-0.003,0.9964]]},"armL":{"q":[[0,-0.2029,-0.0533,0.1313,0.9689],[0.042,-0.192,-0.043,0.14,0.9704],[0.083,-0.1682,-0.0197,0.1583,0.9728],[0.125,-0.1449,0.0046,0.1752,0.9738],[0.167,-0.1345,0.0158,0.1825,0.9738],[0.208,-0.1576,-0.0034,0.1687,0.973],[0.25,-0.211,-0.043,0.1338,0.9673],[0.292,-0.2691,-0.078,0.0916,0.9556],[0.333,-0.3091,-0.0947,0.0601,0.9444],[0.375,-0.3298,-0.0989,0.0431,0.9378],[0.417,-0.3357,-0.0988,0.0382,0.936],[0.458,-0.3209,-0.093,0.0487,0.9413],[0.5,-0.2873,-0.0798,0.0719,0.9518],[0.542,-0.2511,-0.0666,0.0958,0.9609],[0.583,-0.2254,-0.0588,0.1129,0.9659],[0.625,-0.2109,-0.0547,0.1238,0.9681],[0.667,-0.2044,-0.0534,0.1296,0.9688],[0.708,-0.2029,-0.0533,0.1313,0.9689]]},"armR":{"q":[[0,-0.6654,0.114,-0.2808,0.6822],[0.042,-0.6939,0.1329,-0.2937,0.6439],[0.083,-0.7488,0.179,-0.3169,0.5539],[0.125,-0.792,0.2304,-0.3324,0.4573],[0.167,-0.8076,0.2552,-0.3366,0.4116],[0.208,-0.7852,0.1925,-0.2732,0.5214],[0.25,-0.6898,0.0936,-0.0939,0.7117],[0.292,-0.5575,0.0579,0.1105,0.8208],[0.333,-0.4729,0.0655,0.2276,0.8487],[0.375,-0.4371,0.0748,0.2719,0.8541],[0.417,-0.4292,0.0766,0.2794,0.8555],[0.458,-0.4349,0.0695,0.2309,0.8676],[0.5,-0.4583,0.0562,0.1128,0.8798],[0.542,-0.5034,0.0511,-0.028,0.8621],[0.583,-0.5611,0.0619,-0.1436,0.8128],[0.625,-0.6145,0.0837,-0.2226,0.7522],[0.667,-0.6516,0.1049,-0.2669,0.7023],[0.708,-0.6654,0.114,-0.2808,0.6822]]}}},"custom_attack":{"dur":0.792,"loop":false,"t":{"torso":{"q":[[0,0,-0.1296,0,0.9916],[0.042,0.0144,-0.1554,-0.004,0.9877],[0.083,0.0398,-0.2032,-0.0091,0.9783],[0.125,0.0527,-0.229,-0.0106,0.972],[0.167,0.0298,-0.171,-0.0097,0.9848],[0.208,-0.0228,-0.0419,0.0029,0.9989],[0.25,-0.0714,0.0882,0.0262,0.9932],[0.292,-0.0942,0.166,0.0419,0.9807],[0.333,-0.1026,0.198,0.0488,0.9736],[0.375,-0.1038,0.2044,0.05,0.9721],[0.417,-0.0973,0.1932,0.0456,0.9753],[0.458,-0.0813,0.1649,0.0353,0.9823],[0.5,-0.0607,0.1275,0.0234,0.9897],[0.542,-0.0407,0.0894,0.0135,0.9951],[0.583,-0.0252,0.0581,0.0072,0.998],[0.625,-0.0142,0.0346,0.0034,0.9993],[0.667,-0.0069,0.018,0.0014,0.9998],[0.708,-0.0026,0.0073,0.0004,1],[0.75,-0.0005,0.0017,0,1],[0.792,0,0,0,1]]},"head":{"q":[[0,0,0.0998,0,0.995],[0.042,0.0045,0.1205,0.0045,0.9927],[0.083,0.0123,0.1588,0.0123,0.9872],[0.125,0.0161,0.1794,0.0161,0.9835],[0.167,0.0098,0.1364,0.0127,0.9905],[0.208,-0.0053,0.04,0.0024,0.9992],[0.25,-0.0206,-0.0597,-0.0112,0.9979],[0.292,-0.0289,-0.1229,-0.0202,0.9918],[0.333,-0.0323,-0.1517,-0.0239,0.9876],[0.375,-0.0328,-0.1586,-0.0245,0.9865],[0.417,-0.03,-0.1499,-0.0209,0.988],[0.458,-0.0236,-0.128,-0.0128,0.9914],[0.5,-0.0162,-0.0992,-0.0047,0.9949],[0.542,-0.01,-0.0699,-0.0007,0.9975],[0.583,-0.0058,-0.0459,-0.0003,0.9989],[0.625,-0.003,-0.0276,-0.0001,0.9996],[0.667,-0.0012,-0.0146,0,0.9999],[0.708,-0.0004,-0.006,0,1],[0.75,0,-0.0014,0,1],[0.792,0,0,0,1]]},"armL":{"q":[[0,-0.2354,-0.0332,0.1355,0.9618],[0.042,-0.2579,-0.0271,0.1505,0.954],[0.083,-0.2997,-0.0177,0.1789,0.9369],[0.125,-0.3221,-0.0137,0.1944,0.9264],[0.167,-0.2946,-0.0325,0.1825,0.9375],[0.208,-0.2233,-0.0688,0.1609,0.9589],[0.25,-0.1264,-0.0906,0.1477,0.9767],[0.292,-0.0213,-0.0881,0.1445,0.9853],[0.333,0.065,-0.0808,0.1424,0.9844],[0.375,0.1004,-0.0772,0.1366,0.9825],[0.417,0.0743,-0.0748,0.1253,0.9865],[0.458,0.0174,-0.0659,0.1114,0.9914],[0.5,-0.0399,-0.052,0.0984,0.993],[0.542,-0.0669,-0.0361,0.0875,0.9933],[0.583,-0.0669,-0.0226,0.077,0.9945],[0.625,-0.064,-0.0132,0.0662,0.9957],[0.667,-0.0597,-0.0071,0.0562,0.9966],[0.708,-0.055,-0.0038,0.0478,0.9973],[0.75,-0.0514,-0.0023,0.0421,0.9978],[0.792,-0.0499,-0.002,0.0399,0.998]]},"armR":{"q":[[0,-0.6209,0.0845,-0.26,0.7347],[0.042,-0.7118,0.1261,-0.2667,0.6374],[0.083,-0.8397,0.2106,-0.26,0.4278],[0.125,-0.884,0.2577,-0.2449,0.3038],[0.167,-0.8607,0.193,-0.1924,0.43],[0.208,-0.7429,0.0954,-0.0361,0.6616],[0.25,-0.5584,0.0716,0.1431,0.814],[0.292,-0.4161,0.0945,0.2465,0.8702],[0.333,-0.3372,0.1173,0.2884,0.8884],[0.375,-0.3127,0.1241,0.2973,0.8935],[0.417,-0.3239,0.1135,0.2814,0.8961],[0.458,-0.3491,0.0903,0.239,0.9016],[0.5,-0.3747,0.0664,0.1797,0.9071],[0.542,-0.3846,0.0488,0.1168,0.9144],[0.583,-0.3624,0.0377,0.064,0.929],[0.625,-0.3124,0.0285,0.0243,0.9492],[0.667,-0.2472,0.0193,-0.003,0.9688],[0.708,-0.1814,0.0111,-0.0195,0.9832],[0.75,-0.1303,0.0053,-0.0276,0.9911],[0.792,-0.1097,0.0033,-0.0298,0.9935]]}}},"rig2_sword_1":{"dur":0.467,"loop":false,"t":{"torso":{"q":[[0,0.2159,-0.3166,-0.0088,0.9236],[0.013,0.2144,-0.3241,-0.0115,0.9213],[0.027,0.2098,-0.3451,-0.0185,0.9146],[0.04,0.2019,-0.3775,-0.027,0.9033],[0.053,0.1908,-0.4181,-0.0341,0.8875],[0.067,0.1772,-0.4621,-0.0373,0.8681],[0.08,0.1627,-0.5042,-0.0354,0.8474],[0.093,0.1484,-0.5407,-0.0291,0.8275],[0.107,0.1349,-0.5696,-0.02,0.8105],[0.12,0.1218,-0.5896,-0.01,0.7984],[0.133,0.1085,-0.5991,-0.0004,0.7933],[0.147,0.0942,-0.5959,0.0085,0.7974],[0.16,0.0783,-0.5765,0.0165,0.8131],[0.173,0.0604,-0.535,0.0244,0.8424],[0.187,0.0405,-0.4638,0.033,0.8844],[0.2,0.0205,-0.361,0.0433,0.9313],[0.213,0.0031,-0.2297,0.0557,0.9717],[0.227,-0.0085,-0.0796,0.0693,0.9944],[0.24,-0.012,0.0739,0.0827,0.9938],[0.253,-0.0066,0.2154,0.0938,0.972],[0.267,0.0072,0.3353,0.1006,0.9367],[0.28,0.0277,0.4317,0.1017,0.8958],[0.293,0.0513,0.5101,0.0987,0.8529],[0.307,0.0745,0.5751,0.0934,0.8093],[0.32,0.0941,0.6296,0.0878,0.7662],[0.333,0.1069,0.6755,0.084,0.7247],[0.347,0.1112,0.7135,0.0838,0.6866],[0.36,0.1096,0.7432,0.0854,0.6545],[0.373,0.1054,0.7644,0.0869,0.6301],[0.387,0.1004,0.7783,0.0882,0.6135],[0.4,0.0957,0.7864,0.0896,0.6037],[0.413,0.0922,0.7897,0.0913,0.5996],[0.427,0.0907,0.7892,0.0931,0.6002],[0.44,0.0921,0.7857,0.0948,0.6043],[0.453,0.0974,0.78,0.0961,0.6107],[0.467,0.1077,0.7726,0.0965,0.6182]],"p":[[0,-0.0234,-0.2363,0.1339],[0.013,-0.0228,-0.2286,0.1339],[0.027,-0.0213,-0.2084,0.1337],[0.04,-0.0198,-0.1801,0.1328],[0.053,-0.0189,-0.1481,0.1309],[0.067,-0.0193,-0.1167,0.1283],[0.08,-0.0208,-0.0905,0.1256],[0.093,-0.0228,-0.0736,0.124],[0.107,-0.0245,-0.0689,0.1242],[0.12,-0.0252,-0.0743,0.1266],[0.133,-0.0245,-0.0867,0.1309],[0.147,-0.0226,-0.1029,0.1367],[0.16,-0.0196,-0.1199,0.1436],[0.173,-0.0161,-0.1347,0.151],[0.187,-0.0128,-0.1453,0.1583],[0.2,-0.0109,-0.1524,0.1654],[0.213,-0.0109,-0.1574,0.1731],[0.227,-0.0125,-0.1613,0.1831],[0.24,-0.0138,-0.1651,0.1961],[0.253,-0.0129,-0.1697,0.211],[0.267,-0.008,-0.1762,0.225],[0.28,0.0014,-0.1851,0.2353],[0.293,0.0137,-0.1957,0.2406],[0.307,0.0269,-0.2066,0.2406],[0.32,0.039,-0.2159,0.2359],[0.333,0.0478,-0.2217,0.2276],[0.347,0.0517,-0.2227,0.2171],[0.36,0.0517,-0.2196,0.2058],[0.373,0.0495,-0.2138,0.1944],[0.387,0.0459,-0.2065,0.1836],[0.4,0.0414,-0.199,0.1741],[0.413,0.0367,-0.1922,0.1661],[0.427,0.0325,-0.1873,0.1601],[0.44,0.0294,-0.1851,0.1563],[0.453,0.0281,-0.1868,0.1552],[0.467,0.0292,-0.1934,0.157]]},"head":{"q":[[0,-0.0488,0.256,0.0255,0.9651],[0.013,-0.049,0.2692,0.0197,0.9616],[0.027,-0.0495,0.3029,0.0044,0.9517],[0.04,-0.05,0.3487,-0.017,0.9358],[0.053,-0.0504,0.3975,-0.0408,0.9153],[0.067,-0.0507,0.4409,-0.0633,0.8939],[0.08,-0.0507,0.4715,-0.081,0.8766],[0.093,-0.0507,0.483,-0.0906,0.8694],[0.107,-0.0421,0.4823,-0.0945,0.8699],[0.12,-0.02,0.4799,-0.0969,0.8717],[0.133,0.0099,0.4747,-0.0983,0.8746],[0.147,0.0421,0.4659,-0.0991,0.8783],[0.16,0.0714,0.4527,-0.0996,0.8832],[0.173,0.0925,0.4345,-0.1003,0.8903],[0.187,0.1068,0.3937,-0.0963,0.9079],[0.2,0.1192,0.3145,-0.0829,0.9381],[0.213,0.1293,0.1989,-0.0607,0.9696],[0.227,0.1358,0.055,-0.0312,0.9887],[0.24,0.1383,-0.0992,0.0015,0.9854],[0.253,0.1374,-0.241,0.0324,0.9602],[0.267,0.1356,-0.3529,0.057,0.924],[0.28,0.1353,-0.4293,0.0738,0.8899],[0.293,0.1367,-0.478,0.0844,0.8635],[0.307,0.1389,-0.5069,0.0905,0.8459],[0.32,0.1411,-0.5214,0.0935,0.8363],[0.333,0.1421,-0.5256,0.0943,0.8335],[0.347,0.1421,-0.5256,0.0943,0.8335],[0.36,0.1421,-0.5256,0.0943,0.8335],[0.373,0.1421,-0.5256,0.0943,0.8335],[0.387,0.1421,-0.5256,0.0943,0.8335],[0.4,0.1421,-0.5256,0.0943,0.8335],[0.413,0.1421,-0.5256,0.0943,0.8335],[0.427,0.1421,-0.5256,0.0943,0.8335],[0.44,0.1421,-0.5256,0.0943,0.8335],[0.453,0.1421,-0.5256,0.0943,0.8335],[0.467,0.1421,-0.5256,0.0943,0.8335]]},"armL":{"q":[[0,-0.856,-0.3936,0.2565,0.2155],[0.013,-0.8543,-0.3926,0.256,0.2247],[0.027,-0.8491,-0.3892,0.2546,0.2505],[0.04,-0.8401,-0.3826,0.2526,0.29],[0.053,-0.8266,-0.372,0.25,0.3403],[0.067,-0.808,-0.3565,0.2471,0.3987],[0.08,-0.7838,-0.3352,0.2438,0.4625],[0.093,-0.7534,-0.3072,0.2405,0.5293],[0.107,-0.7164,-0.2721,0.2374,0.5969],[0.12,-0.6727,-0.2318,0.2349,0.6623],[0.133,-0.6231,-0.189,0.2335,0.7221],[0.147,-0.5697,-0.1473,0.2343,0.7738],[0.16,-0.5155,-0.1104,0.2385,0.8156],[0.173,-0.4636,-0.082,0.2474,0.8468],[0.187,-0.4168,-0.0646,0.262,0.868],[0.2,-0.3754,-0.0571,0.2819,0.8811],[0.213,-0.3392,-0.058,0.306,0.8877],[0.227,-0.3079,-0.0655,0.3331,0.8888],[0.24,-0.2809,-0.078,0.362,0.8854],[0.253,-0.2581,-0.0939,0.3914,0.8783],[0.267,-0.2392,-0.1115,0.42,0.8683],[0.28,-0.224,-0.1292,0.4464,0.8567],[0.293,-0.2125,-0.1452,0.4694,0.8446],[0.307,-0.2047,-0.158,0.4878,0.8338],[0.32,-0.2005,-0.1659,0.5007,0.8256],[0.333,-0.1999,-0.1672,0.5068,0.8217],[0.347,-0.2032,-0.1619,0.5056,0.8227],[0.36,-0.2123,-0.1549,0.4983,0.8262],[0.373,-0.2289,-0.1516,0.4868,0.8293],[0.387,-0.2512,-0.1514,0.4724,0.8311],[0.4,-0.2765,-0.1527,0.4569,0.8315],[0.413,-0.3022,-0.1535,0.442,0.8305],[0.427,-0.3255,-0.1522,0.4299,0.8283],[0.44,-0.3438,-0.1472,0.4226,0.8255],[0.453,-0.3545,-0.1367,0.4225,0.8229],[0.467,-0.3552,-0.1194,0.4313,0.8207]],"p":[[0,-0.1239,-0.2124,0.3125],[0.013,-0.1184,-0.2115,0.3127],[0.027,-0.1041,-0.209,0.3115],[0.04,-0.084,-0.2054,0.3065],[0.053,-0.0614,-0.2012,0.2952],[0.067,-0.0394,-0.1968,0.2752],[0.08,-0.0212,-0.1929,0.2441],[0.093,-0.0099,-0.1901,0.1998],[0.107,-0.0075,-0.189,0.1413],[0.12,-0.0124,-0.1898,0.0726],[0.133,-0.0224,-0.1925,-0.0011],[0.147,-0.0352,-0.197,-0.075],[0.16,-0.0484,-0.2028,-0.1442],[0.173,-0.0599,-0.2097,-0.2036],[0.187,-0.0677,-0.2169,-0.2495],[0.2,-0.0719,-0.2239,-0.2825],[0.213,-0.0728,-0.2304,-0.3044],[0.227,-0.0708,-0.2361,-0.317],[0.24,-0.0666,-0.2407,-0.3219],[0.253,-0.0608,-0.244,-0.3205],[0.267,-0.0541,-0.2462,-0.3146],[0.28,-0.0474,-0.2474,-0.3058],[0.293,-0.0416,-0.2481,-0.2958],[0.307,-0.0378,-0.2489,-0.2864],[0.32,-0.0369,-0.2504,-0.2797],[0.333,-0.0399,-0.2533,-0.2776],[0.347,-0.047,-0.2576,-0.2813],[0.36,-0.0558,-0.2626,-0.2884],[0.373,-0.064,-0.2671,-0.296],[0.387,-0.0709,-0.2708,-0.3027],[0.4,-0.0764,-0.2736,-0.3075],[0.413,-0.0802,-0.2754,-0.3093],[0.427,-0.082,-0.2766,-0.3066],[0.44,-0.0815,-0.2774,-0.2979],[0.453,-0.0784,-0.2782,-0.2818],[0.467,-0.0722,-0.2794,-0.2567]]},"armR":{"q":[[0,-0.6968,0.4413,-0.0171,0.5652],[0.013,-0.6911,0.4241,-0.0308,0.5845],[0.027,-0.6752,0.3753,-0.0673,0.6315],[0.04,-0.6503,0.2992,-0.1189,0.6881],[0.053,-0.6194,0.2024,-0.1774,0.7375],[0.067,-0.5892,0.0927,-0.2357,0.7673],[0.08,-0.5686,-0.0238,-0.289,0.7698],[0.093,-0.567,-0.1455,-0.3351,0.7383],[0.107,-0.59,-0.2752,-0.3717,0.6618],[0.12,-0.627,-0.4106,-0.3925,0.5331],[0.133,-0.6594,-0.5353,-0.3881,0.3578],[0.147,-0.6725,-0.6277,-0.3551,0.1661],[0.16,-0.6672,-0.6806,-0.3027,0.0002],[0.173,-0.6561,-0.7051,-0.2447,-0.1118],[0.187,-0.6511,-0.7167,-0.1889,-0.1632],[0.2,-0.6557,-0.7239,-0.1336,-0.1676],[0.213,-0.668,-0.7279,-0.0743,-0.1356],[0.227,-0.6838,-0.726,-0.0059,-0.0725],[0.24,-0.6971,-0.7126,0.0768,0.0183],[0.253,-0.6991,-0.6801,0.1771,0.1318],[0.267,-0.6792,-0.6202,0.2957,0.2579],[0.28,-0.6288,-0.5283,0.4251,0.3805],[0.293,-0.5501,-0.4107,0.5438,0.4827],[0.307,-0.4587,-0.2848,0.6332,0.5545],[0.32,-0.3732,-0.1682,0.6888,0.5983],[0.333,-0.3063,-0.0696,0.7157,0.6238],[0.347,-0.2611,0.0105,0.7219,0.6408],[0.36,-0.2247,0.0735,0.7181,0.6546],[0.373,-0.1864,0.1179,0.712,0.6666],[0.387,-0.1489,0.146,0.7056,0.6772],[0.4,-0.117,0.1629,0.6989,0.6865],[0.413,-0.0942,0.1734,0.6919,0.6945],[0.427,-0.0836,0.1823,0.6839,0.7015],[0.44,-0.0886,0.1943,0.6739,0.7072],[0.453,-0.1138,0.2145,0.6601,0.7109],[0.467,-0.1666,0.2488,0.6378,0.7096]],"p":[[0,0.1108,-0.1376,0.2229],[0.013,0.1106,-0.1345,0.2144],[0.027,0.1085,-0.127,0.1916],[0.04,0.1016,-0.1176,0.1582],[0.053,0.0871,-0.1082,0.1167],[0.067,0.0641,-0.099,0.0692],[0.08,0.0328,-0.0886,0.0194],[0.093,-0.0067,-0.0732,-0.0278],[0.107,-0.0548,-0.0456,-0.0703],[0.12,-0.1086,-0.0015,-0.1166],[0.133,-0.159,0.0508,-0.1761],[0.147,-0.1945,0.0915,-0.2388],[0.16,-0.2115,0.1111,-0.2731],[0.173,-0.2153,0.1206,-0.2504],[0.187,-0.2128,0.1361,-0.1655],[0.2,-0.2111,0.1606,-0.0538],[0.213,-0.2162,0.1895,0.0436],[0.227,-0.2283,0.2168,0.1],[0.24,-0.2294,0.2396,0.1393],[0.253,-0.1972,0.2557,0.1957],[0.267,-0.1108,0.2632,0.2996],[0.28,0.0326,0.2615,0.4543],[0.293,0.1753,0.2541,0.568],[0.307,0.2601,0.2446,0.5605],[0.32,0.2923,0.2334,0.4674],[0.333,0.2959,0.2202,0.3491],[0.347,0.2923,0.2047,0.2526],[0.36,0.2865,0.1887,0.1859],[0.373,0.2793,0.175,0.1479],[0.387,0.2725,0.1644,0.1343],[0.4,0.2678,0.1566,0.1396],[0.413,0.2663,0.1509,0.1586],[0.427,0.2689,0.1467,0.1861],[0.44,0.2765,0.1434,0.217],[0.453,0.2902,0.1397,0.2463],[0.467,0.311,0.1325,0.269]]},"legL":{"q":[[0,-0.1593,0.087,0.1497,0.9719],[0.013,-0.1399,0.0968,0.1392,0.9755],[0.027,-0.0922,0.1255,0.1128,0.9813],[0.04,-0.0352,0.1715,0.0791,0.9814],[0.053,0.0124,0.231,0.0454,0.9718],[0.067,0.0399,0.2971,0.0146,0.9539],[0.08,0.0476,0.3633,-0.0137,0.9304],[0.093,0.0417,0.4255,-0.0375,0.9032],[0.107,0.0469,0.4812,-0.0621,0.8731],[0.12,0.0708,0.5272,-0.0917,0.8418],[0.133,0.1075,0.5605,-0.1247,0.8116],[0.147,0.1496,0.5791,-0.1571,0.7858],[0.16,0.1907,0.5821,-0.1831,0.7689],[0.173,0.228,0.5674,-0.1948,0.7669],[0.187,0.2616,0.5309,-0.1837,0.7848],[0.2,0.2913,0.4692,-0.1489,0.8203],[0.213,0.3119,0.381,-0.0959,0.8651],[0.227,0.315,0.2714,-0.0345,0.9088],[0.24,0.3032,0.1528,0.0171,0.9404],[0.253,0.2854,0.0406,0.05,0.9562],[0.267,0.2551,-0.0558,0.0746,0.9624],[0.28,0.2221,-0.1334,0.0894,0.9617],[0.293,0.2111,-0.1969,0.0901,0.9532],[0.307,0.2014,-0.2531,0.0917,0.9418],[0.32,0.1911,-0.3054,0.0961,0.9279],[0.333,0.1806,-0.3559,0.1034,0.9111],[0.347,0.1705,-0.4026,0.1115,0.8924],[0.36,0.1613,-0.4407,0.1187,0.875],[0.373,0.1533,-0.4689,0.1244,0.8609],[0.387,0.1465,-0.488,0.1281,0.8509],[0.4,0.141,-0.4996,0.1299,0.8448],[0.413,0.1366,-0.505,0.1298,0.8423],[0.427,0.1331,-0.5054,0.1282,0.8429],[0.44,0.13,-0.5016,0.1255,0.846],[0.453,0.1268,-0.4946,0.1219,0.8511],[0.467,0.1228,-0.4852,0.1175,0.8577]],"p":[[0,0.0158,0.355,0.0987],[0.013,0.0212,0.3474,0.1013],[0.027,0.0337,0.3204,0.1017],[0.04,0.0444,0.2689,0.0841],[0.053,0.0425,0.199,0.036],[0.067,0.021,0.1252,-0.0403],[0.08,-0.0184,0.0607,-0.1284],[0.093,-0.0682,0.0154,-0.2096],[0.107,-0.1129,-0.0108,-0.2614],[0.12,-0.1457,-0.0251,-0.2881],[0.133,-0.1647,-0.033,-0.3023],[0.147,-0.1727,-0.0388,-0.3156],[0.16,-0.1735,-0.0422,-0.3342],[0.173,-0.1676,-0.039,-0.3567],[0.187,-0.1523,-0.0244,-0.3736],[0.2,-0.1255,-0.0002,-0.3722],[0.213,-0.0909,0.0261,-0.3452],[0.227,-0.0568,0.048,-0.2952],[0.24,-0.0236,0.0556,-0.2273],[0.253,0.0062,0.0482,-0.1414],[0.267,0.0196,0.0438,-0.0565],[0.28,0.0222,0.0428,0.0254],[0.293,0.0199,0.0336,0.1297],[0.307,0.0048,0.0322,0.2253],[0.32,-0.0206,0.0378,0.3048],[0.333,-0.0526,0.0464,0.3644],[0.347,-0.086,0.0533,0.4025],[0.36,-0.1155,0.0574,0.4235],[0.373,-0.1386,0.0592,0.4333],[0.387,-0.1552,0.0589,0.4363],[0.4,-0.1662,0.0572,0.4355],[0.413,-0.1726,0.0548,0.4326],[0.427,-0.1755,0.0528,0.4293],[0.44,-0.1757,0.0524,0.4263],[0.453,-0.1739,0.0546,0.4249],[0.467,-0.1708,0.061,0.4258]]},"legR":{"q":[[0,0.1742,-0.3354,-0.0696,0.9232],[0.013,0.1835,-0.3174,-0.0645,0.9281],[0.027,0.2033,-0.2663,-0.0531,0.9407],[0.04,0.2182,-0.1866,-0.0414,0.957],[0.053,0.2155,-0.0857,-0.0323,0.9722],[0.067,0.1898,0.0252,-0.0247,0.9812],[0.08,0.1466,0.1337,-0.0178,0.9799],[0.093,0.0985,0.2301,-0.0164,0.968],[0.107,0.0547,0.3139,-0.0218,0.9476],[0.12,0.0185,0.3866,-0.0306,0.9216],[0.133,-0.0077,0.4454,-0.0416,0.8943],[0.147,-0.0223,0.488,-0.0538,0.8709],[0.16,-0.0217,0.511,-0.0689,0.8565],[0.173,-0.0019,0.5097,-0.0884,0.8558],[0.187,0.0282,0.4789,-0.1061,0.871],[0.2,0.0566,0.4189,-0.1174,0.8986],[0.213,0.0802,0.3322,-0.1253,0.9314],[0.227,0.0959,0.2259,-0.1329,0.9603],[0.24,0.1018,0.1121,-0.1429,0.9781],[0.253,0.0979,0.0036,-0.1565,0.9828],[0.267,0.0855,-0.091,-0.1734,0.9769],[0.28,0.067,-0.1695,-0.1921,0.9643],[0.293,0.0469,-0.2371,-0.2111,0.9471],[0.307,0.0293,-0.2985,-0.2284,0.9262],[0.32,0.0174,-0.356,-0.2416,0.9026],[0.333,0.014,-0.4103,-0.2489,0.8772],[0.347,0.0192,-0.4581,-0.2522,0.8522],[0.36,0.0275,-0.4951,-0.2542,0.8303],[0.373,0.0339,-0.5213,-0.2556,0.8135],[0.387,0.037,-0.538,-0.2571,0.8019],[0.4,0.0368,-0.5471,-0.2595,0.7949],[0.413,0.0333,-0.5502,-0.263,0.7918],[0.427,0.0267,-0.5485,-0.2673,0.7918],[0.44,0.0173,-0.5435,-0.2719,0.794],[0.453,0.0051,-0.5364,-0.2762,0.7975],[0.467,-0.0097,-0.5285,-0.2796,0.8015]],"p":[[0,-0.0193,0.1109,0.1339],[0.013,-0.0207,0.116,0.1654],[0.027,-0.0176,0.1295,0.2463],[0.04,0.003,0.1516,0.3508],[0.053,0.0471,0.1848,0.4494],[0.067,0.1083,0.227,0.5172],[0.08,0.1735,0.2681,0.5457],[0.093,0.2345,0.2962,0.5416],[0.107,0.2854,0.3017,0.5199],[0.12,0.3222,0.2864,0.4946],[0.133,0.3445,0.2593,0.4721],[0.147,0.3535,0.2296,0.457],[0.16,0.3525,0.2059,0.4532],[0.173,0.3439,0.1953,0.4639],[0.187,0.3171,0.1901,0.4838],[0.2,0.2638,0.1835,0.4973],[0.213,0.1904,0.1817,0.4878],[0.227,0.1107,0.1898,0.443],[0.24,0.0415,0.2084,0.364],[0.253,-0.0058,0.2343,0.2661],[0.267,-0.0295,0.2626,0.1677],[0.28,-0.0353,0.2889,0.0802],[0.293,-0.03,0.3101,0.0043],[0.307,-0.0186,0.3246,-0.0613],[0.32,-0.0047,0.3323,-0.117],[0.333,0.0086,0.3347,-0.163],[0.347,0.0196,0.3335,-0.1988],[0.36,0.0284,0.3295,-0.2253],[0.373,0.0349,0.3232,-0.2448],[0.387,0.0392,0.3158,-0.2588],[0.4,0.0419,0.3086,-0.2684],[0.413,0.0434,0.3025,-0.2745],[0.427,0.0438,0.2985,-0.2776],[0.44,0.0435,0.2974,-0.2785],[0.453,0.0426,0.3003,-0.2777],[0.467,0.0414,0.3083,-0.2758]]}}},"rig2_sword_2":{"dur":0.467,"loop":false,"t":{"torso":{"q":[[0,0.1077,0.7726,0.0965,0.6182],[0.013,0.1235,0.7642,0.0955,0.6258],[0.027,0.1429,0.7549,0.0929,0.6333],[0.04,0.163,0.7451,0.0882,0.6407],[0.053,0.1809,0.7353,0.0814,0.648],[0.067,0.1936,0.7262,0.0725,0.6557],[0.08,0.1983,0.7183,0.0614,0.664],[0.093,0.193,0.7117,0.0486,0.6737],[0.107,0.1795,0.7047,0.0342,0.6855],[0.12,0.1605,0.6953,0.0189,0.7003],[0.133,0.1386,0.6812,0.0028,0.7189],[0.147,0.1166,0.6603,-0.0138,0.7417],[0.16,0.0969,0.6306,-0.0308,0.7694],[0.173,0.0823,0.5895,-0.0481,0.8021],[0.187,0.0748,0.5346,-0.0657,0.8392],[0.2,0.074,0.4648,-0.0832,0.8784],[0.213,0.079,0.3791,-0.0998,0.9166],[0.227,0.0884,0.2771,-0.1145,0.9499],[0.24,0.1003,0.1601,-0.1261,0.9739],[0.253,0.1123,0.0328,-0.1339,0.9841],[0.267,0.1223,-0.0978,-0.1374,0.9781],[0.28,0.1289,-0.2241,-0.1366,0.9563],[0.293,0.1315,-0.3392,-0.1318,0.9221],[0.307,0.1304,-0.438,-0.1236,0.8808],[0.32,0.1266,-0.5172,-0.1128,0.8389],[0.333,0.1213,-0.5754,-0.1002,0.8026],[0.347,0.116,-0.6127,-0.0868,0.7769],[0.36,0.1122,-0.6329,-0.0734,0.7625],[0.373,0.1108,-0.6398,-0.061,0.758],[0.387,0.1114,-0.6368,-0.0501,0.7613],[0.4,0.1135,-0.627,-0.041,0.7696],[0.413,0.1161,-0.6136,-0.0337,0.7803],[0.427,0.1182,-0.5998,-0.0285,0.7909],[0.44,0.1189,-0.589,-0.0254,0.7989],[0.453,0.117,-0.5848,-0.0244,0.8024],[0.467,0.1114,-0.5906,-0.0255,0.7989]],"p":[[0,0.0292,-0.1934,0.157],[0.013,0.0331,-0.2057,0.162],[0.027,0.0393,-0.222,0.1692],[0.04,0.0466,-0.24,0.1775],[0.053,0.0543,-0.2568,0.1859],[0.067,0.0614,-0.2692,0.1932],[0.08,0.0673,-0.2739,0.1986],[0.093,0.0715,-0.2687,0.2014],[0.107,0.0742,-0.2555,0.2019],[0.12,0.0757,-0.2377,0.2007],[0.133,0.0766,-0.2184,0.1984],[0.147,0.0773,-0.2003,0.1955],[0.16,0.0785,-0.186,0.1928],[0.173,0.0806,-0.1779,0.1912],[0.187,0.0838,-0.1776,0.1919],[0.2,0.0876,-0.1842,0.1957],[0.213,0.0909,-0.1962,0.203],[0.227,0.0925,-0.2123,0.214],[0.24,0.091,-0.2311,0.2279],[0.253,0.0854,-0.251,0.2429],[0.267,0.0756,-0.2703,0.2566],[0.28,0.0623,-0.2877,0.2672],[0.293,0.0467,-0.3019,0.2734],[0.307,0.0303,-0.3118,0.2755],[0.32,0.014,-0.3165,0.2744],[0.333,-0.0012,-0.3154,0.2717],[0.347,-0.015,-0.3086,0.2688],[0.36,-0.0266,-0.3004,0.2661],[0.373,-0.0354,-0.2951,0.2633],[0.387,-0.0416,-0.2927,0.2608],[0.4,-0.0455,-0.292,0.2587],[0.413,-0.0474,-0.2921,0.2568],[0.427,-0.0475,-0.2918,0.255],[0.44,-0.0461,-0.2901,0.2529],[0.453,-0.0434,-0.2858,0.2502],[0.467,-0.0397,-0.2778,0.2464]]},"head":{"q":[[0,0.1421,-0.5256,0.0943,0.8335],[0.013,0.1419,-0.5252,0.0946,0.8337],[0.027,0.1412,-0.5239,0.0955,0.8345],[0.04,0.1402,-0.5215,0.0969,0.8361],[0.053,0.1388,-0.5178,0.0989,0.8384],[0.067,0.137,-0.5125,0.1012,0.8417],[0.08,0.135,-0.5053,0.1038,0.8459],[0.093,0.1326,-0.4962,0.1068,0.8514],[0.107,0.13,-0.4846,0.1099,0.858],[0.12,0.1272,-0.4703,0.1133,0.8659],[0.133,0.124,-0.4529,0.1167,0.8752],[0.147,0.1205,-0.4319,0.1202,0.8857],[0.16,0.1167,-0.4066,0.1237,0.8976],[0.173,0.1125,-0.3765,0.1271,0.9107],[0.187,0.1079,-0.3407,0.1303,0.9248],[0.2,0.1026,-0.2983,0.1332,0.9395],[0.213,0.0967,-0.2481,0.1356,0.9543],[0.227,0.0903,-0.1774,0.1343,0.9707],[0.24,0.0835,-0.0773,0.126,0.9855],[0.253,0.0757,0.0443,0.1106,0.99],[0.267,0.0671,0.1743,0.0891,0.9783],[0.28,0.0584,0.2972,0.0639,0.9509],[0.293,0.0504,0.4,0.0378,0.9144],[0.307,0.044,0.4757,0.0132,0.8784],[0.32,0.0399,0.5222,-0.0086,0.8519],[0.333,0.0384,0.5381,-0.0271,0.8416],[0.347,0.0384,0.5375,-0.042,0.8414],[0.36,0.0386,0.5362,-0.0535,0.8415],[0.373,0.039,0.5344,-0.0621,0.842],[0.387,0.0399,0.5323,-0.0686,0.8428],[0.4,0.0414,0.5302,-0.0734,0.8437],[0.413,0.0436,0.528,-0.0771,0.8446],[0.427,0.0466,0.5259,-0.0804,0.8454],[0.44,0.0506,0.5242,-0.0838,0.846],[0.453,0.0557,0.5228,-0.0878,0.8461],[0.467,0.0621,0.522,-0.0931,0.8456]]},"armL":{"q":[[0,-0.3552,-0.1194,0.4313,0.8207],[0.013,-0.3448,-0.0949,0.4496,0.8185],[0.027,-0.3288,-0.0683,0.4732,0.8144],[0.04,-0.314,-0.0452,0.4981,0.807],[0.053,-0.3075,-0.0312,0.521,0.7957],[0.067,-0.3162,-0.0315,0.5393,0.7798],[0.08,-0.3482,-0.0523,0.5499,0.7574],[0.093,-0.4095,-0.0998,0.5475,0.7229],[0.107,-0.4943,-0.1712,0.5273,0.6695],[0.12,-0.5881,-0.2577,0.4859,0.593],[0.133,-0.6722,-0.3447,0.4257,0.4981],[0.147,-0.733,-0.4181,0.3579,0.3997],[0.16,-0.7683,-0.4711,0.297,0.3155],[0.173,-0.784,-0.5041,0.2542,0.2582],[0.187,-0.7871,-0.5208,0.2348,0.2326],[0.2,-0.7828,-0.526,0.2358,0.2343],[0.213,-0.7723,-0.5221,0.2534,0.2585],[0.227,-0.7544,-0.5091,0.2846,0.3012],[0.24,-0.7272,-0.4864,0.3259,0.3582],[0.253,-0.6893,-0.4536,0.373,0.4242],[0.267,-0.6411,-0.4123,0.4205,0.4922],[0.28,-0.586,-0.3657,0.4634,0.5552],[0.293,-0.5302,-0.3193,0.4977,0.6077],[0.307,-0.4808,-0.2788,0.5219,0.6471],[0.32,-0.4445,-0.2493,0.5361,0.673],[0.333,-0.4264,-0.2349,0.541,0.6858],[0.347,-0.4279,-0.2368,0.5377,0.6868],[0.36,-0.436,-0.2464,0.5324,0.6825],[0.373,-0.438,-0.2545,0.5308,0.6794],[0.387,-0.434,-0.2602,0.5329,0.6782],[0.4,-0.4275,-0.2643,0.5367,0.6777],[0.413,-0.4218,-0.2678,0.5404,0.677],[0.427,-0.4202,-0.2717,0.5422,0.675],[0.44,-0.4261,-0.2769,0.5402,0.6708],[0.453,-0.4427,-0.2843,0.5326,0.663],[0.467,-0.4732,-0.2947,0.5167,0.6498]],"p":[[0,-0.0722,-0.2794,-0.2567],[0.013,-0.063,-0.2809,-0.2221],[0.027,-0.052,-0.2822,-0.18],[0.04,-0.0408,-0.2825,-0.1319],[0.053,-0.0308,-0.281,-0.0789],[0.067,-0.0234,-0.2775,-0.0213],[0.08,-0.0202,-0.2712,0.0405],[0.093,-0.0236,-0.2617,0.1049],[0.107,-0.0347,-0.2495,0.1663],[0.12,-0.0527,-0.2369,0.2164],[0.133,-0.0735,-0.227,0.2487],[0.147,-0.0916,-0.2217,0.2625],[0.16,-0.1037,-0.2208,0.2624],[0.173,-0.11,-0.2226,0.253],[0.187,-0.112,-0.2256,0.2366],[0.2,-0.1113,-0.2291,0.2143],[0.213,-0.1082,-0.2332,0.1872],[0.227,-0.1027,-0.2379,0.1562],[0.24,-0.0942,-0.2437,0.122],[0.253,-0.0828,-0.2508,0.0847],[0.267,-0.0691,-0.2589,0.0446],[0.28,-0.0545,-0.2677,0.0028],[0.293,-0.0408,-0.2762,-0.0378],[0.307,-0.0291,-0.2835,-0.0731],[0.32,-0.0201,-0.2891,-0.0984],[0.333,-0.0138,-0.2925,-0.1092],[0.347,-0.0101,-0.2937,-0.1048],[0.36,-0.0078,-0.294,-0.0962],[0.373,-0.0056,-0.2947,-0.0944],[0.387,-0.0033,-0.2957,-0.0987],[0.4,-0.0011,-0.2966,-0.1055],[0.413,0.0011,-0.2968,-0.1111],[0.427,0.0032,-0.296,-0.1118],[0.44,0.005,-0.2939,-0.104],[0.453,0.0066,-0.29,-0.0842],[0.467,0.0075,-0.2837,-0.0491]]},"armR":{"q":[[0,-0.1666,0.2488,0.6378,0.7096],[0.013,-0.2552,0.3034,0.5985,0.6961],[0.027,-0.3776,0.3765,0.5321,0.6577],[0.04,-0.5173,0.4578,0.4311,0.5805],[0.053,-0.6436,0.5297,0.3022,0.4626],[0.067,-0.7287,0.5792,0.1698,0.3235],[0.08,-0.7679,0.6087,0.0596,0.1904],[0.093,-0.7727,0.6296,-0.0168,0.0788],[0.107,-0.7546,0.6535,-0.0576,-0.0089],[0.12,-0.7178,0.6893,-0.0625,-0.076],[0.133,-0.6604,0.7398,-0.0332,-0.1246],[0.147,-0.594,0.7904,0.0019,-0.1501],[0.16,-0.5461,0.8257,-0.0007,-0.1414],[0.173,-0.5459,0.829,-0.0892,-0.0825],[0.187,-0.5688,0.78,-0.2591,0.0303],[0.2,-0.5603,0.6711,-0.4522,0.1764],[0.213,-0.4925,0.5452,-0.599,0.3185],[0.227,-0.3861,0.4165,-0.6933,0.4436],[0.24,-0.2727,0.2781,-0.7444,0.5423],[0.253,-0.1826,0.1317,-0.7629,0.606],[0.267,-0.1227,-0.0034,-0.7596,0.6387],[0.28,-0.0871,-0.1159,-0.7449,0.6512],[0.293,-0.0674,-0.2043,-0.7262,0.6529],[0.307,-0.0562,-0.2711,-0.7073,0.6504],[0.32,-0.0479,-0.3199,-0.6899,0.6476],[0.333,-0.0382,-0.3534,-0.6745,0.647],[0.347,-0.0249,-0.3744,-0.6611,0.6498],[0.36,-0.0091,-0.3863,-0.6495,0.6548],[0.373,0.0075,-0.3923,-0.6397,0.6609],[0.387,0.0235,-0.3945,-0.6317,0.6669],[0.4,0.0374,-0.3949,-0.6255,0.6719],[0.413,0.0479,-0.3951,-0.6215,0.6748],[0.427,0.0532,-0.3968,-0.62,0.6747],[0.44,0.0515,-0.402,-0.6217,0.6702],[0.453,0.0399,-0.4127,-0.6271,0.6594],[0.467,0.0147,-0.4313,-0.6368,0.639]],"p":[[0,0.311,0.1325,0.269],[0.013,0.3399,0.1154,0.2827],[0.027,0.3754,0.0809,0.2937],[0.04,0.4143,0.0282,0.3161],[0.053,0.4522,-0.0287,0.3608],[0.067,0.4847,-0.0705,0.4196],[0.08,0.5096,-0.0927,0.4706],[0.093,0.5257,-0.1066,0.4985],[0.107,0.5307,-0.1252,0.4982],[0.12,0.521,-0.1577,0.4687],[0.133,0.4922,-0.204,0.416],[0.147,0.4496,-0.2396,0.3759],[0.16,0.4055,-0.2392,0.3897],[0.173,0.3694,-0.1909,0.4826],[0.187,0.3205,-0.1141,0.6038],[0.2,0.2268,-0.0419,0.6664],[0.213,0.0826,-0.014,0.5943],[0.227,-0.0702,-0.0197,0.4285],[0.24,-0.1862,-0.0282,0.2485],[0.253,-0.24,-0.0169,0.122],[0.267,-0.2512,0.0011,0.0416],[0.28,-0.244,0.0083,-0.0192],[0.293,-0.2272,0.0041,-0.069],[0.307,-0.2044,-0.0084,-0.11],[0.32,-0.1791,-0.0259,-0.1432],[0.333,-0.1545,-0.0452,-0.169],[0.347,-0.1332,-0.0635,-0.1873],[0.36,-0.1155,-0.0799,-0.1986],[0.373,-0.1011,-0.0941,-0.2037],[0.387,-0.0896,-0.1062,-0.2035],[0.4,-0.0807,-0.116,-0.1992],[0.413,-0.0741,-0.1239,-0.1916],[0.427,-0.0697,-0.1299,-0.1816],[0.44,-0.0673,-0.1341,-0.17],[0.453,-0.0669,-0.1359,-0.1575],[0.467,-0.0687,-0.1342,-0.1447]]},"legL":{"q":[[0,0.1228,-0.4852,0.1175,0.8577],[0.013,0.1182,-0.4599,0.1081,0.8734],[0.027,0.1125,-0.411,0.0908,0.9001],[0.04,0.1048,-0.3489,0.0687,0.9287],[0.053,0.0954,-0.2847,0.0463,0.9527],[0.067,0.086,-0.231,0.0298,0.9687],[0.08,0.08,-0.2009,0.0259,0.976],[0.093,0.0784,-0.1908,0.0327,0.978],[0.107,0.0797,-0.1857,0.0414,0.9785],[0.12,0.0844,-0.1823,0.0498,0.9783],[0.133,0.0917,-0.1765,0.0547,0.9785],[0.147,0.0997,-0.163,0.0524,0.9802],[0.16,0.1054,-0.1353,0.0394,0.9844],[0.173,0.1055,-0.0875,0.0137,0.9905],[0.187,0.0957,-0.031,-0.0176,0.9948],[0.2,0.0701,0.0209,-0.0444,0.9963],[0.213,0.0254,0.0694,-0.0612,0.9954],[0.227,-0.0368,0.1167,-0.0634,0.9905],[0.24,-0.1092,0.1648,-0.0466,0.9792],[0.253,-0.1793,0.2135,-0.0081,0.9603],[0.267,-0.2339,0.2628,0.0493,0.9348],[0.28,-0.2634,0.3123,0.1161,0.9053],[0.293,-0.2658,0.3617,0.1799,0.8753],[0.307,-0.2455,0.4104,0.229,0.8478],[0.32,-0.2108,0.4581,0.2558,0.8248],[0.333,-0.1704,0.5043,0.2569,0.8066],[0.347,-0.1328,0.5401,0.2413,0.7953],[0.36,-0.1044,0.5588,0.2222,0.7922],[0.373,-0.0871,0.5637,0.2037,0.7957],[0.387,-0.0793,0.5585,0.1877,0.8041],[0.4,-0.0788,0.5466,0.1742,0.8153],[0.413,-0.083,0.5314,0.1628,0.8272],[0.427,-0.0896,0.5163,0.1532,0.8378],[0.44,-0.0958,0.5049,0.1448,0.8456],[0.453,-0.099,0.5005,0.1377,0.8489],[0.467,-0.0965,0.5068,0.1323,0.8463]],"p":[[0,-0.1708,0.061,0.4258],[0.013,-0.1601,0.0773,0.4342],[0.027,-0.1364,0.1058,0.4476],[0.04,-0.1039,0.1426,0.4561],[0.053,-0.0693,0.1837,0.4543],[0.067,-0.0408,0.2261,0.444],[0.08,-0.0271,0.2678,0.4339],[0.093,-0.0255,0.306,0.4272],[0.107,-0.027,0.3384,0.4207],[0.12,-0.0302,0.3644,0.4151],[0.133,-0.0323,0.3839,0.4095],[0.147,-0.0295,0.3972,0.4014],[0.16,-0.0176,0.4047,0.3865],[0.173,0.005,0.4068,0.3591],[0.187,0.0297,0.4049,0.318],[0.2,0.0473,0.4029,0.2647],[0.213,0.056,0.403,0.1976],[0.227,0.0548,0.4035,0.1176],[0.24,0.0427,0.4015,0.0307],[0.253,0.0195,0.3952,-0.0526],[0.267,-0.0124,0.3853,-0.122],[0.28,-0.0476,0.3737,-0.1715],[0.293,-0.08,0.363,-0.2013],[0.307,-0.1047,0.3555,-0.2158],[0.32,-0.1194,0.3529,-0.2211],[0.333,-0.1231,0.3557,-0.2226],[0.347,-0.1167,0.3578,-0.2204],[0.36,-0.1047,0.3554,-0.2135],[0.373,-0.0919,0.3524,-0.2025],[0.387,-0.0801,0.3501,-0.1878],[0.4,-0.0704,0.3488,-0.1709],[0.413,-0.0631,0.348,-0.1541],[0.427,-0.0581,0.3467,-0.1398],[0.44,-0.0549,0.3438,-0.1301],[0.453,-0.0531,0.3382,-0.1268],[0.467,-0.0527,0.3289,-0.1316]]},"legR":{"q":[[0,-0.0097,-0.5285,-0.2796,0.8015],[0.013,-0.0097,-0.4983,-0.284,0.8191],[0.027,0.0151,-0.4353,-0.2923,0.8514],[0.04,0.0523,-0.3589,-0.3052,0.8805],[0.053,0.0871,-0.2877,-0.3215,0.8979],[0.067,0.1063,-0.2347,-0.3338,0.9068],[0.08,0.1021,-0.2079,-0.3258,0.9166],[0.093,0.0844,-0.1989,-0.2897,0.9324],[0.107,0.066,-0.1938,-0.234,0.9504],[0.12,0.0499,-0.1936,-0.1633,0.9661],[0.133,0.0395,-0.1983,-0.0843,0.9757],[0.147,0.0369,-0.2064,-0.0047,0.9778],[0.16,0.0436,-0.2156,0.0684,0.9731],[0.173,0.0605,-0.2233,0.1292,0.9642],[0.187,0.0907,-0.2262,0.1733,0.9542],[0.2,0.1333,-0.2207,0.1973,0.9458],[0.213,0.1827,-0.2048,0.1992,0.9407],[0.227,0.2329,-0.1774,0.1786,0.9394],[0.24,0.2779,-0.1382,0.1395,0.9404],[0.253,0.311,-0.0905,0.0919,0.9416],[0.267,0.3245,-0.0386,0.0449,0.944],[0.28,0.3139,0.0159,-0.0041,0.9493],[0.293,0.2855,0.0729,-0.0568,0.9539],[0.307,0.2499,0.1302,-0.1068,0.9535],[0.32,0.2164,0.1848,-0.1478,0.9472],[0.333,0.1926,0.2341,-0.1771,0.9363],[0.347,0.179,0.2694,-0.1949,0.9259],[0.36,0.1666,0.2874,-0.2062,0.9204],[0.373,0.1552,0.2915,-0.2148,0.9191],[0.387,0.1487,0.2845,-0.2207,0.921],[0.4,0.1454,0.2701,-0.2242,0.925],[0.413,0.144,0.2524,-0.2255,0.9299],[0.427,0.1427,0.2354,-0.2251,0.9346],[0.44,0.1405,0.2231,-0.2238,0.9383],[0.453,0.136,0.2198,-0.2224,0.9401],[0.467,0.1277,0.2296,-0.2213,0.9392]],"p":[[0,0.0414,0.3083,-0.2758],[0.013,0.0333,0.326,-0.2523],[0.027,0.0204,0.3498,-0.1912],[0.04,0.016,0.3671,-0.1042],[0.053,0.0277,0.3705,-0.0133],[0.067,0.0505,0.3643,0.0573],[0.08,0.0684,0.3601,0.0906],[0.093,0.0707,0.3566,0.096],[0.107,0.0619,0.3435,0.0917],[0.12,0.0456,0.3167,0.0819],[0.133,0.0281,0.2745,0.07],[0.147,0.0161,0.2202,0.058],[0.16,0.014,0.1619,0.0463],[0.173,0.0219,0.1093,0.0354],[0.187,0.0355,0.0689,0.028],[0.2,0.0495,0.0413,0.0251],[0.213,0.06,0.024,0.0273],[0.227,0.0642,0.013,0.0381],[0.24,0.0605,0.0031,0.062],[0.253,0.047,-0.0087,0.0994],[0.267,0.0257,-0.0145,0.1466],[0.28,0.0086,-0.0016,0.1994],[0.293,0.0065,0.0278,0.2534],[0.307,0.0184,0.0619,0.3017],[0.32,0.0383,0.0919,0.3394],[0.333,0.0608,0.1129,0.3646],[0.347,0.0776,0.1245,0.371],[0.36,0.0835,0.1338,0.3633],[0.373,0.0824,0.144,0.3531],[0.387,0.0778,0.1529,0.3427],[0.4,0.0712,0.1605,0.3321],[0.413,0.0639,0.1666,0.3217],[0.427,0.0569,0.1711,0.3119],[0.44,0.0514,0.174,0.3036],[0.453,0.0485,0.175,0.2977],[0.467,0.0489,0.1741,0.2949]]}}},"rig2_sword_3":{"dur":0.467,"loop":false,"t":{"torso":{"q":[[0,0.1114,-0.5906,-0.0255,0.7989],[0.013,0.1015,-0.6084,-0.0287,0.7866],[0.027,0.0884,-0.6348,-0.0337,0.7668],[0.04,0.0741,-0.665,-0.0404,0.742],[0.053,0.0606,-0.6943,-0.0485,0.7155],[0.067,0.0495,-0.7188,-0.0576,0.6911],[0.08,0.0425,-0.7354,-0.0674,0.6729],[0.093,0.0405,-0.7421,-0.0779,0.6645],[0.107,0.0441,-0.7367,-0.0887,0.6689],[0.12,0.0535,-0.7167,-0.0998,0.6881],[0.133,0.0686,-0.6787,-0.1109,0.7227],[0.147,0.0876,-0.6212,-0.1215,0.7692],[0.16,0.1086,-0.5428,-0.1309,0.8225],[0.173,0.1296,-0.4424,-0.1383,0.8766],[0.187,0.1483,-0.3209,-0.1424,0.9245],[0.2,0.1629,-0.1819,-0.1425,0.9592],[0.213,0.1719,-0.0327,-0.1381,0.9748],[0.227,0.1747,0.117,-0.1293,0.9691],[0.24,0.1723,0.2574,-0.117,0.9436],[0.253,0.1662,0.3808,-0.1025,0.9038],[0.267,0.1587,0.4833,-0.0872,0.8566],[0.28,0.1518,0.5644,-0.0722,0.8082],[0.293,0.1467,0.6274,-0.0582,0.7625],[0.307,0.1443,0.6759,-0.0459,0.7213],[0.32,0.1448,0.7125,-0.0355,0.6857],[0.333,0.1485,0.7394,-0.0274,0.6561],[0.347,0.1551,0.7583,-0.0216,0.6328],[0.36,0.1641,0.7708,-0.0177,0.6153],[0.373,0.1745,0.7783,-0.0152,0.603],[0.387,0.1856,0.7819,-0.0137,0.595],[0.4,0.1963,0.7825,-0.0129,0.5907],[0.413,0.2058,0.7813,-0.0125,0.5892],[0.427,0.2131,0.7791,-0.0121,0.5894],[0.44,0.2174,0.7771,-0.0115,0.5906],[0.453,0.2177,0.7763,-0.0103,0.5915],[0.467,0.2131,0.778,-0.0083,0.591]],"p":[[0,-0.0397,-0.2778,0.2464],[0.013,-0.0352,-0.2656,0.2417],[0.027,-0.0298,-0.2497,0.2365],[0.04,-0.0239,-0.2313,0.2318],[0.053,-0.0177,-0.2112,0.2285],[0.067,-0.0115,-0.1905,0.2269],[0.08,-0.0057,-0.1698,0.2273],[0.093,-0.0005,-0.1498,0.2296],[0.107,0.0041,-0.1315,0.2338],[0.12,0.0083,-0.1156,0.2397],[0.133,0.0127,-0.103,0.2472],[0.147,0.018,-0.0947,0.2555],[0.16,0.0247,-0.0911,0.2639],[0.173,0.0334,-0.093,0.2709],[0.187,0.0438,-0.1003,0.2754],[0.2,0.0553,-0.112,0.276],[0.213,0.0665,-0.1266,0.2724],[0.227,0.0761,-0.1432,0.2654],[0.24,0.0832,-0.1612,0.2567],[0.253,0.0877,-0.1803,0.2481],[0.267,0.0902,-0.2002,0.2411],[0.28,0.0913,-0.2205,0.2365],[0.293,0.0918,-0.2406,0.234],[0.307,0.0922,-0.2595,0.2333],[0.32,0.0926,-0.2765,0.2336],[0.333,0.0931,-0.2907,0.2347],[0.347,0.0937,-0.3015,0.236],[0.36,0.0943,-0.309,0.2374],[0.373,0.0945,-0.3133,0.2387],[0.387,0.0944,-0.3148,0.2398],[0.4,0.0936,-0.3137,0.2406],[0.413,0.092,-0.3101,0.241],[0.427,0.0894,-0.304,0.2408],[0.44,0.0858,-0.2957,0.2398],[0.453,0.081,-0.2853,0.2378],[0.467,0.0748,-0.2728,0.2347]]},"head":{"q":[[0,0.0621,0.522,-0.0931,0.8456],[0.013,0.0702,0.5245,-0.1,0.8426],[0.027,0.08,0.5318,-0.1081,0.8362],[0.04,0.0903,0.5418,-0.1164,0.8275],[0.053,0.1,0.5526,-0.1243,0.818],[0.067,0.1083,0.5624,-0.1308,0.8092],[0.08,0.1139,0.5696,-0.1353,0.8027],[0.093,0.116,0.5723,-0.1369,0.8002],[0.107,0.1059,0.5679,-0.1363,0.8048],[0.12,0.081,0.5547,-0.1347,0.8171],[0.133,0.0494,0.5323,-0.1321,0.8347],[0.147,0.0184,0.5003,-0.1288,0.856],[0.16,-0.0053,0.4578,-0.125,0.8802],[0.173,-0.0152,0.4023,-0.1207,0.9074],[0.187,-0.0088,0.3276,-0.1114,0.9382],[0.2,0.0096,0.2301,-0.0928,0.9687],[0.213,0.037,0.1129,-0.066,0.9907],[0.227,0.0687,-0.0161,-0.0335,0.9969],[0.24,0.0991,-0.1444,0.0007,0.9845],[0.253,0.1226,-0.2595,0.032,0.9574],[0.267,0.1356,-0.3529,0.057,0.924],[0.28,0.1404,-0.422,0.0742,0.8926],[0.293,0.1424,-0.4704,0.0849,0.8667],[0.307,0.1427,-0.5021,0.0909,0.8481],[0.32,0.1424,-0.5199,0.0936,0.8371],[0.333,0.1421,-0.5256,0.0943,0.8335],[0.347,0.1421,-0.5256,0.0943,0.8335],[0.36,0.1421,-0.5256,0.0943,0.8335],[0.373,0.1421,-0.5256,0.0943,0.8335],[0.387,0.1421,-0.5256,0.0943,0.8335],[0.4,0.1421,-0.5256,0.0943,0.8335],[0.413,0.1421,-0.5256,0.0943,0.8335],[0.427,0.1421,-0.5256,0.0943,0.8335],[0.44,0.1421,-0.5256,0.0943,0.8335],[0.453,0.1421,-0.5256,0.0943,0.8335],[0.467,0.1421,-0.5256,0.0943,0.8335]]},"armL":{"q":[[0,-0.4732,-0.2947,0.5167,0.6498],[0.013,-0.5187,-0.3079,0.4901,0.6292],[0.027,-0.5733,-0.3213,0.4531,0.6023],[0.04,-0.6291,-0.3316,0.4085,0.5722],[0.053,-0.6792,-0.3365,0.3602,0.5438],[0.067,-0.7187,-0.3347,0.313,0.5229],[0.08,-0.7444,-0.3252,0.2717,0.516],[0.093,-0.7534,-0.3072,0.2405,0.5293],[0.107,-0.7428,-0.2796,0.2218,0.5665],[0.12,-0.713,-0.2437,0.2139,0.6217],[0.133,-0.6652,-0.2018,0.2145,0.6861],[0.147,-0.6031,-0.1577,0.2214,0.75],[0.16,-0.533,-0.1161,0.2327,0.8052],[0.173,-0.4636,-0.082,0.2474,0.8468],[0.187,-0.4024,-0.059,0.2649,0.8743],[0.2,-0.3507,-0.0461,0.2852,0.8908],[0.213,-0.3078,-0.0419,0.3079,0.8993],[0.227,-0.2729,-0.0448,0.3325,0.9016],[0.24,-0.245,-0.0534,0.3585,0.8992],[0.253,-0.2235,-0.0664,0.3851,0.893],[0.267,-0.2077,-0.0827,0.4115,0.8836],[0.28,-0.1971,-0.101,0.4367,0.8719],[0.293,-0.1914,-0.12,0.4599,0.8588],[0.307,-0.1901,-0.1383,0.48,0.8452],[0.32,-0.1931,-0.1545,0.496,0.8324],[0.333,-0.1999,-0.1672,0.5068,0.8217],[0.347,-0.2102,-0.1753,0.5119,0.8143],[0.36,-0.2235,-0.1788,0.5117,0.8101],[0.373,-0.239,-0.1785,0.5073,0.8085],[0.387,-0.2562,-0.175,0.4994,0.8089],[0.4,-0.2743,-0.1687,0.489,0.8107],[0.413,-0.2926,-0.1603,0.4768,0.8132],[0.427,-0.3104,-0.1506,0.464,0.8159],[0.44,-0.3272,-0.14,0.4514,0.8183],[0.453,-0.3423,-0.1294,0.4402,0.82],[0.467,-0.3552,-0.1194,0.4313,0.8207]],"p":[[0,0.0075,-0.2837,-0.0491],[0.013,0.0075,-0.2743,0.0015],[0.027,0.0061,-0.2617,0.0599],[0.04,0.0037,-0.2467,0.1169],[0.053,0.0008,-0.2306,0.1647],[0.067,-0.0021,-0.2149,0.1976],[0.08,-0.0054,-0.2009,0.2108],[0.093,-0.0099,-0.1901,0.1998],[0.107,-0.0164,-0.1836,0.1621],[0.12,-0.0247,-0.1817,0.1035],[0.133,-0.0339,-0.1842,0.0308],[0.147,-0.0433,-0.1907,-0.0493],[0.16,-0.0522,-0.1997,-0.1301],[0.173,-0.0599,-0.2097,-0.2036],[0.187,-0.0656,-0.2189,-0.2627],[0.2,-0.0693,-0.227,-0.307],[0.213,-0.071,-0.2339,-0.3379],[0.227,-0.0708,-0.2395,-0.357],[0.24,-0.0688,-0.2438,-0.3657],[0.253,-0.0654,-0.2471,-0.3657],[0.267,-0.0608,-0.2493,-0.3586],[0.28,-0.0555,-0.2506,-0.3461],[0.293,-0.0502,-0.2513,-0.3298],[0.307,-0.0453,-0.2517,-0.3117],[0.32,-0.0417,-0.2522,-0.2936],[0.333,-0.0399,-0.2533,-0.2776],[0.347,-0.0405,-0.2552,-0.2655],[0.36,-0.0432,-0.2579,-0.257],[0.373,-0.0475,-0.2612,-0.2518],[0.387,-0.0527,-0.2648,-0.2493],[0.4,-0.0584,-0.2683,-0.2488],[0.413,-0.0638,-0.2715,-0.2499],[0.427,-0.0685,-0.2743,-0.2519],[0.44,-0.0718,-0.2765,-0.2542],[0.453,-0.0732,-0.2781,-0.256],[0.467,-0.0722,-0.2794,-0.2567]]},"armR":{"q":[[0,0.0147,-0.4313,-0.6368,0.639],[0.013,-0.0287,-0.46,-0.6501,0.6042],[0.027,-0.0925,-0.4979,-0.6637,0.5505],[0.04,-0.1774,-0.5418,-0.6716,0.4731],[0.053,-0.2805,-0.5853,-0.6654,0.3689],[0.067,-0.3927,-0.619,-0.6363,0.2404],[0.08,-0.4999,-0.6348,-0.5808,0.0992],[0.093,-0.5894,-0.6305,-0.5037,-0.0374],[0.107,-0.6559,-0.6107,-0.4157,-0.1549],[0.12,-0.7018,-0.5832,-0.3263,-0.2468],[0.133,-0.7327,-0.5541,-0.2405,-0.3135],[0.147,-0.7541,-0.5273,-0.1594,-0.3577],[0.16,-0.77,-0.5043,-0.0811,-0.3823],[0.173,-0.783,-0.4856,-0.0022,-0.3888],[0.187,-0.7944,-0.471,0.0765,-0.3757],[0.2,-0.8087,-0.4628,0.1333,-0.3377],[0.213,-0.8327,-0.4651,0.1375,-0.2672],[0.227,-0.8624,-0.4773,0.0651,-0.1555],[0.24,-0.8716,-0.4882,-0.0444,-0.0097],[0.253,-0.8474,-0.4941,-0.1251,0.1487],[0.267,-0.7999,-0.5041,-0.1146,0.3049],[0.28,-0.7242,-0.5178,0.0261,0.4546],[0.293,-0.5994,-0.5047,0.221,0.5806],[0.307,-0.4507,-0.4592,0.365,0.6729],[0.32,-0.3087,-0.4035,0.4509,0.7339],[0.333,-0.1892,-0.3557,0.4992,0.7671],[0.347,-0.0985,-0.326,0.5282,0.7779],[0.36,-0.0339,-0.3122,0.5465,0.7764],[0.373,0.0096,-0.3091,0.5586,0.7696],[0.387,0.0359,-0.3123,0.5667,0.7616],[0.4,0.0479,-0.3178,0.5722,0.7546],[0.413,0.0467,-0.322,0.5755,0.7503],[0.427,0.0326,-0.321,0.5768,0.7505],[0.44,0.0043,-0.31,0.5756,0.7567],[0.453,-0.0407,-0.2823,0.5705,0.7702],[0.467,-0.1069,-0.2275,0.5575,0.7912]],"p":[[0,-0.0687,-0.1342,-0.1447],[0.013,-0.0727,-0.1259,-0.1322],[0.027,-0.0783,-0.1065,-0.1207],[0.04,-0.0837,-0.0708,-0.1127],[0.053,-0.0847,-0.0164,-0.1132],[0.067,-0.0762,0.052,-0.1285],[0.08,-0.056,0.1216,-0.1614],[0.093,-0.0282,0.1786,-0.2075],[0.107,-0.0006,0.2178,-0.2576],[0.12,0.0199,0.244,-0.3036],[0.133,0.0296,0.2655,-0.3414],[0.147,0.0272,0.2896,-0.3699],[0.16,0.0125,0.3216,-0.3889],[0.173,-0.0149,0.3649,-0.3987],[0.187,-0.0543,0.4204,-0.3945],[0.2,-0.1002,0.4821,-0.3536],[0.213,-0.1448,0.5407,-0.2469],[0.227,-0.1832,0.5756,-0.0595],[0.24,-0.2156,0.545,0.1359],[0.253,-0.2319,0.4308,0.2583],[0.267,-0.1941,0.2894,0.3468],[0.28,-0.0774,0.1862,0.4565],[0.293,0.0654,0.1224,0.537],[0.307,0.1777,0.0761,0.5318],[0.32,0.2556,0.0411,0.4633],[0.333,0.3077,0.0153,0.3766],[0.347,0.3426,-0.0039,0.3108],[0.36,0.3649,-0.0183,0.2714],[0.373,0.3772,-0.029,0.2537],[0.387,0.3813,-0.036,0.2532],[0.4,0.3786,-0.039,0.2649],[0.413,0.3706,-0.0375,0.2844],[0.427,0.3586,-0.031,0.3068],[0.44,0.3444,-0.019,0.327],[0.453,0.33,-0.0018,0.339],[0.467,0.3177,0.0183,0.3353]]},"legL":{"q":[[0,-0.0965,0.5068,0.1323,0.8463],[0.013,-0.0543,0.5311,0.1047,0.839],[0.027,0.0435,0.5699,0.0353,0.8198],[0.04,0.1654,0.6069,-0.0645,0.7747],[0.053,0.2683,0.632,-0.1658,0.7078],[0.067,0.3193,0.6533,-0.2334,0.6456],[0.08,0.3219,0.6803,-0.2548,0.6071],[0.093,0.2999,0.7095,-0.2393,0.5911],[0.107,0.2709,0.7315,-0.206,0.5908],[0.12,0.2355,0.7423,-0.158,0.6071],[0.133,0.1917,0.7374,-0.0932,0.6409],[0.147,0.1494,0.7124,-0.0297,0.6851],[0.16,0.1351,0.6668,-0.0031,0.7329],[0.173,0.1205,0.603,0.0271,0.7881],[0.187,0.1066,0.5203,0.0596,0.8452],[0.2,0.0936,0.4199,0.0931,0.8979],[0.213,0.0819,0.3063,0.1259,0.94],[0.227,0.0714,0.1866,0.1563,0.9673],[0.24,0.062,0.0689,0.1827,0.9788],[0.253,0.0534,-0.0394,0.2043,0.9767],[0.267,0.082,-0.1302,0.2072,0.9661],[0.28,0.1145,-0.2043,0.2063,0.95],[0.293,0.139,-0.265,0.2055,0.9318],[0.307,0.1564,-0.3147,0.2044,0.9137],[0.32,0.166,-0.3556,0.2034,0.897],[0.333,0.1692,-0.3895,0.2026,0.8824],[0.347,0.1658,-0.4159,0.2019,0.8711],[0.36,0.157,-0.4347,0.2007,0.8638],[0.373,0.1438,-0.4474,0.1992,0.8599],[0.387,0.1275,-0.455,0.1978,0.8588],[0.4,0.1092,-0.4586,0.1967,0.8597],[0.413,0.0898,-0.4592,0.1962,0.8617],[0.427,0.0703,-0.4581,0.1965,0.864],[0.44,0.0514,-0.4566,0.198,0.8658],[0.453,0.0338,-0.4564,0.2008,0.8662],[0.467,0.0184,-0.4589,0.2051,0.8643]],"p":[[0,-0.0527,0.3289,-0.1316],[0.013,-0.0388,0.3221,-0.1374],[0.027,0.001,0.3003,-0.1446],[0.04,0.0506,0.2242,-0.1734],[0.053,0.0697,0.099,-0.2368],[0.067,0.0338,-0.0078,-0.3133],[0.08,-0.0345,-0.0534,-0.3691],[0.093,-0.0985,-0.0522,-0.3906],[0.107,-0.1457,-0.0373,-0.3912],[0.12,-0.1876,-0.0189,-0.3821],[0.133,-0.227,0.0001,-0.368],[0.147,-0.2504,0.0066,-0.3623],[0.16,-0.2195,-0.0037,-0.3704],[0.173,-0.1766,-0.0054,-0.3683],[0.187,-0.1256,0.0029,-0.3489],[0.2,-0.0725,0.0209,-0.3069],[0.213,-0.0254,0.0462,-0.2417],[0.227,0.0089,0.0756,-0.1592],[0.24,0.0267,0.1055,-0.0697],[0.253,0.0286,0.1333,0.0156],[0.267,0.0279,0.1526,0.1401],[0.28,0.0144,0.1629,0.2549],[0.293,-0.0076,0.1691,0.3443],[0.307,-0.0326,0.1734,0.4127],[0.32,-0.0578,0.1779,0.4622],[0.333,-0.0813,0.1831,0.4974],[0.347,-0.1013,0.1895,0.5201],[0.36,-0.1166,0.197,0.5332],[0.373,-0.1274,0.205,0.5384],[0.387,-0.1345,0.2126,0.5374],[0.4,-0.1386,0.2191,0.5315],[0.413,-0.1404,0.2237,0.5218],[0.427,-0.141,0.2259,0.5091],[0.44,-0.1412,0.2253,0.4943],[0.453,-0.1417,0.2219,0.4782],[0.467,-0.1434,0.2155,0.4618]]},"legR":{"q":[[0,0.1277,0.2296,-0.2213,0.9392],[0.013,0.1214,0.2543,-0.2213,0.9336],[0.027,0.124,0.2891,-0.2225,0.9228],[0.04,0.1339,0.3287,-0.2239,0.9077],[0.053,0.1485,0.3679,-0.2243,0.8901],[0.067,0.1655,0.4022,-0.222,0.8727],[0.08,0.1819,0.428,-0.2149,0.8588],[0.093,0.1975,0.4424,-0.2017,0.8512],[0.107,0.2115,0.4429,-0.1809,0.8523],[0.12,0.223,0.4265,-0.1506,0.8635],[0.133,0.2298,0.3903,-0.1089,0.8849],[0.147,0.2291,0.3334,-0.0561,0.9128],[0.16,0.2176,0.255,0.006,0.9421],[0.173,0.192,0.1539,0.0735,0.9665],[0.187,0.1474,0.0381,0.1379,0.9787],[0.2,0.0839,-0.0819,0.1874,0.9753],[0.213,0.0094,-0.1999,0.2124,0.9565],[0.227,-0.0653,-0.3082,0.2077,0.9261],[0.24,-0.1289,-0.3995,0.1751,0.8906],[0.253,-0.1723,-0.4695,0.123,0.8572],[0.267,-0.1907,-0.5174,0.0635,0.8318],[0.28,-0.1837,-0.5456,0.0088,0.8176],[0.293,-0.1534,-0.5592,-0.0311,0.8141],[0.307,-0.1125,-0.5631,-0.0572,0.8167],[0.32,-0.0749,-0.5612,-0.0755,0.8208],[0.333,-0.0445,-0.5567,-0.0865,0.825],[0.347,-0.0243,-0.5526,-0.0917,0.828],[0.36,-0.0157,-0.5519,-0.0933,0.8285],[0.373,-0.0193,-0.5576,-0.0929,0.8246],[0.387,-0.0302,-0.565,-0.092,0.8194],[0.4,-0.0426,-0.5684,-0.0917,0.8165],[0.413,-0.0548,-0.5688,-0.0916,0.8155],[0.427,-0.0652,-0.5674,-0.0913,0.8157],[0.44,-0.0722,-0.5655,-0.0905,0.8166],[0.453,-0.0741,-0.5643,-0.0888,0.8174],[0.467,-0.0693,-0.5653,-0.0859,0.8175]],"p":[[0,0.0489,0.1741,0.2949],[0.013,0.0564,0.1714,0.3041],[0.027,0.0745,0.1664,0.3308],[0.04,0.1027,0.158,0.3671],[0.053,0.1388,0.1464,0.4044],[0.067,0.1788,0.1328,0.4366],[0.08,0.2171,0.1202,0.4609],[0.093,0.2495,0.1108,0.4795],[0.107,0.2719,0.1062,0.4962],[0.12,0.2798,0.1076,0.5143],[0.133,0.2684,0.1151,0.5339],[0.147,0.2353,0.1271,0.5504],[0.16,0.1801,0.1404,0.5533],[0.173,0.106,0.151,0.5277],[0.187,0.0273,0.1545,0.4584],[0.2,-0.0375,0.1496,0.3468],[0.213,-0.0768,0.1387,0.2092],[0.227,-0.0866,0.1267,0.0681],[0.24,-0.0724,0.1186,-0.0561],[0.253,-0.0451,0.1186,-0.1521],[0.267,-0.0166,0.13,-0.2189],[0.28,0.0046,0.1556,-0.2611],[0.293,0.0142,0.1962,-0.2855],[0.307,0.0159,0.2405,-0.2977],[0.32,0.0153,0.2766,-0.3031],[0.333,0.0129,0.3036,-0.306],[0.347,0.0099,0.3219,-0.3097],[0.36,0.0082,0.3334,-0.3162],[0.373,0.0089,0.3396,-0.3263],[0.387,0.0105,0.3421,-0.3366],[0.4,0.0104,0.342,-0.3431],[0.413,0.0084,0.3399,-0.3461],[0.427,0.0048,0.3362,-0.3458],[0.44,-0.0004,0.3313,-0.3428],[0.453,-0.0068,0.3253,-0.3377],[0.467,-0.014,0.3183,-0.3315]]}}},"rig2_sword_4":{"dur":0.533,"loop":false,"t":{"torso":{"q":[[0,0.2131,0.778,-0.0083,0.591],[0.013,0.2031,0.7827,-0.0053,0.5884],[0.027,0.1888,0.7891,-0.0025,0.5845],[0.04,0.1719,0.7955,-0.0014,0.5811],[0.053,0.1541,0.8,-0.0034,0.5799],[0.067,0.137,0.801,-0.0101,0.5826],[0.08,0.1223,0.7969,-0.0232,0.5911],[0.093,0.111,0.7863,-0.0438,0.6062],[0.107,0.1027,0.7687,-0.0705,0.6274],[0.12,0.0964,0.7438,-0.1017,0.6535],[0.133,0.0916,0.7114,-0.1354,0.6835],[0.147,0.0877,0.6711,-0.1701,0.7163],[0.16,0.0841,0.6222,-0.204,0.7511],[0.173,0.0804,0.564,-0.2356,0.7873],[0.187,0.0762,0.4955,-0.2631,0.8243],[0.2,0.071,0.4151,-0.2845,0.8612],[0.213,0.0642,0.3211,-0.2979,0.8967],[0.227,0.0557,0.2138,-0.3025,0.9272],[0.24,0.0454,0.0957,-0.298,0.9487],[0.253,0.0334,-0.0286,-0.2847,0.9576],[0.267,0.02,-0.153,-0.2634,0.9523],[0.28,0.006,-0.2708,-0.2364,0.9332],[0.293,-0.0081,-0.3763,-0.2061,0.9032],[0.307,-0.0216,-0.4662,-0.1752,0.8669],[0.32,-0.034,-0.5387,-0.1463,0.829],[0.333,-0.0448,-0.5941,-0.1213,0.794],[0.347,-0.0541,-0.6339,-0.1012,0.7649],[0.36,-0.0623,-0.6639,-0.0851,0.7403],[0.373,-0.0702,-0.6888,-0.072,0.7179],[0.387,-0.0776,-0.71,-0.0611,0.6972],[0.4,-0.084,-0.7282,-0.0521,0.6782],[0.413,-0.0891,-0.7441,-0.0443,0.6607],[0.427,-0.0924,-0.7582,-0.0373,0.6444],[0.44,-0.0936,-0.7711,-0.0307,0.6291],[0.453,-0.0922,-0.7833,-0.0242,0.6143],[0.467,-0.0877,-0.7953,-0.0172,0.5996],[0.48,-0.0795,-0.8074,-0.0094,0.5846],[0.493,-0.0673,-0.8199,-0.0006,0.5686],[0.507,-0.0504,-0.8329,0.0097,0.5511],[0.52,-0.028,-0.8463,0.0218,0.5315],[0.533,0.0004,-0.86,0.036,0.5091]],"p":[[0,0.0748,-0.2728,0.2347],[0.013,0.0672,-0.2588,0.2303],[0.027,0.0586,-0.2439,0.2247],[0.04,0.0499,-0.229,0.218],[0.053,0.0421,-0.2147,0.2101],[0.067,0.0361,-0.2015,0.2008],[0.08,0.0332,-0.1899,0.1895],[0.093,0.0343,-0.1803,0.1762],[0.107,0.039,-0.1729,0.1616],[0.12,0.0468,-0.168,0.1468],[0.133,0.0569,-0.1656,0.1328],[0.147,0.0686,-0.1657,0.1208],[0.16,0.0812,-0.1678,0.1119],[0.173,0.0939,-0.1714,0.1068],[0.187,0.1057,-0.1756,0.1064],[0.2,0.1153,-0.1791,0.1111],[0.213,0.1217,-0.1807,0.1205],[0.227,0.1239,-0.1796,0.1332],[0.24,0.1218,-0.1756,0.1469],[0.253,0.1152,-0.1689,0.1585],[0.267,0.1051,-0.1603,0.1651],[0.28,0.0932,-0.1512,0.1646],[0.293,0.0815,-0.1429,0.1566],[0.307,0.0717,-0.1365,0.142],[0.32,0.0651,-0.1323,0.1227],[0.333,0.0624,-0.1306,0.1005],[0.347,0.0634,-0.1307,0.0774],[0.36,0.0663,-0.1314,0.0557],[0.373,0.0692,-0.1312,0.0372],[0.387,0.0714,-0.1302,0.0222],[0.4,0.0728,-0.1285,0.0104],[0.413,0.0732,-0.1264,0.0017],[0.427,0.0723,-0.124,-0.0042],[0.44,0.07,-0.1218,-0.0077],[0.453,0.0661,-0.1198,-0.0091],[0.467,0.0605,-0.1184,-0.0086],[0.48,0.053,-0.118,-0.0066],[0.493,0.0435,-0.119,-0.0034],[0.507,0.0316,-0.1219,0.0006],[0.52,0.0172,-0.1274,0.0049],[0.533,0,-0.1363,0.0091]]},"head":{"q":[[0,0.1421,-0.5256,0.0943,0.8335],[0.013,0.142,-0.5251,0.0956,0.8337],[0.027,0.1417,-0.5237,0.0993,0.8342],[0.04,0.1412,-0.5212,0.105,0.8351],[0.053,0.1406,-0.5176,0.1124,0.8365],[0.067,0.1399,-0.5127,0.121,0.8384],[0.08,0.1392,-0.5065,0.1305,0.8409],[0.093,0.1385,-0.4989,0.1405,0.8439],[0.107,0.1377,-0.4898,0.1507,0.8476],[0.12,0.137,-0.479,0.1609,0.852],[0.133,0.1364,-0.4664,0.1707,0.8572],[0.147,0.1359,-0.4518,0.1798,0.8632],[0.16,0.1355,-0.4351,0.1879,0.8701],[0.173,0.1353,-0.4159,0.1948,0.878],[0.187,0.1352,-0.3938,0.2002,0.8869],[0.2,0.1354,-0.3686,0.2037,0.8969],[0.213,0.1339,-0.3267,0.2002,0.9139],[0.227,0.13,-0.2559,0.1851,0.9399],[0.24,0.1248,-0.1579,0.1579,0.9667],[0.253,0.1198,-0.0376,0.1188,0.9849],[0.267,0.1173,0.0943,0.0705,0.9861],[0.28,0.1188,0.2237,0.0179,0.9672],[0.293,0.123,0.3374,-0.0316,0.9327],[0.307,0.1286,0.4273,-0.072,0.892],[0.32,0.1348,0.4907,-0.0996,0.8551],[0.333,0.141,0.5275,-0.112,0.8303],[0.347,0.1467,0.5493,-0.1154,0.8145],[0.36,0.1516,0.5682,-0.1178,0.8001],[0.373,0.1559,0.5845,-0.1195,0.7872],[0.387,0.1596,0.5985,-0.1206,0.7758],[0.4,0.1627,0.6103,-0.1212,0.7657],[0.413,0.1653,0.6203,-0.1215,0.7571],[0.427,0.1675,0.6286,-0.1217,0.7497],[0.44,0.1692,0.6354,-0.1218,0.7435],[0.453,0.1707,0.6408,-0.122,0.7385],[0.467,0.1718,0.645,-0.1225,0.7345],[0.48,0.1726,0.6481,-0.1233,0.7314],[0.493,0.1732,0.6503,-0.1247,0.7291],[0.507,0.1735,0.6516,-0.1267,0.7275],[0.52,0.1737,0.6521,-0.1295,0.7265],[0.533,0.1736,0.652,-0.1331,0.7259]]},"armL":{"q":[[0,-0.3552,-0.1194,0.4313,0.8207],[0.013,-0.3658,-0.1107,0.4256,0.8202],[0.027,-0.3746,-0.1047,0.4228,0.8185],[0.04,-0.3827,-0.1028,0.4222,0.8153],[0.053,-0.3908,-0.1065,0.4231,0.8105],[0.067,-0.3997,-0.1171,0.4249,0.8037],[0.08,-0.4103,-0.1362,0.4269,0.7943],[0.093,-0.4226,-0.1644,0.4281,0.7817],[0.107,-0.4356,-0.1992,0.4285,0.7661],[0.12,-0.4478,-0.2372,0.4281,0.7482],[0.133,-0.458,-0.2751,0.4275,0.7293],[0.147,-0.4652,-0.3095,0.4271,0.7109],[0.16,-0.4689,-0.3376,0.4278,0.6951],[0.173,-0.4685,-0.3567,0.4308,0.6839],[0.187,-0.4636,-0.3641,0.4369,0.6794],[0.2,-0.4533,-0.3568,0.4472,0.6836],[0.213,-0.4365,-0.332,0.4618,0.6971],[0.227,-0.4131,-0.2909,0.4794,0.7175],[0.24,-0.3836,-0.2363,0.4977,0.7412],[0.253,-0.3492,-0.172,0.5143,0.7642],[0.267,-0.3118,-0.103,0.5274,0.7836],[0.28,-0.2745,-0.0352,0.5361,0.7975],[0.293,-0.2406,0.0257,0.5406,0.8057],[0.307,-0.2132,0.0751,0.542,0.8094],[0.32,-0.195,0.1094,0.5418,0.8102],[0.333,-0.1881,0.1257,0.5411,0.8099],[0.347,-0.1932,0.1234,0.5408,0.8093],[0.36,-0.2058,0.1103,0.5398,0.8088],[0.373,-0.2207,0.095,0.5373,0.8085],[0.387,-0.2364,0.0792,0.5332,0.8084],[0.4,-0.2525,0.0634,0.5278,0.8085],[0.413,-0.2682,0.0478,0.5213,0.8087],[0.427,-0.2831,0.0327,0.5139,0.8091],[0.44,-0.2966,0.0185,0.5061,0.8096],[0.453,-0.3081,0.0055,0.4982,0.8105],[0.467,-0.3172,-0.0061,0.4904,0.8117],[0.48,-0.3233,-0.0158,0.4831,0.8135],[0.493,-0.326,-0.0235,0.4767,0.816],[0.507,-0.3248,-0.0289,0.4715,0.8194],[0.52,-0.3191,-0.0315,0.4678,0.8236],[0.533,-0.3083,-0.0313,0.4659,0.8288]],"p":[[0,-0.0722,-0.2794,-0.2567],[0.013,-0.0685,-0.2803,-0.2557],[0.027,-0.0625,-0.281,-0.2533],[0.04,-0.0548,-0.2816,-0.2499],[0.053,-0.0462,-0.2823,-0.2459],[0.067,-0.0372,-0.283,-0.2419],[0.08,-0.0284,-0.2839,-0.2383],[0.093,-0.0203,-0.285,-0.2354],[0.107,-0.013,-0.2861,-0.2334],[0.12,-0.0066,-0.2873,-0.232],[0.133,-0.0015,-0.2882,-0.2312],[0.147,0.002,-0.2887,-0.2308],[0.16,0.0036,-0.2886,-0.2306],[0.173,0.0028,-0.2879,-0.2307],[0.187,-0.001,-0.2864,-0.2311],[0.2,-0.0081,-0.2842,-0.2319],[0.213,-0.0185,-0.2812,-0.2333],[0.227,-0.0315,-0.2777,-0.2353],[0.24,-0.0459,-0.2739,-0.2382],[0.253,-0.0609,-0.27,-0.242],[0.267,-0.0757,-0.2661,-0.2467],[0.28,-0.0897,-0.2626,-0.2519],[0.293,-0.1022,-0.2593,-0.2569],[0.307,-0.1126,-0.2563,-0.2609],[0.32,-0.1201,-0.2536,-0.2628],[0.333,-0.1238,-0.2512,-0.2617],[0.347,-0.1235,-0.249,-0.2573],[0.36,-0.1211,-0.2473,-0.2513],[0.373,-0.119,-0.2464,-0.2454],[0.387,-0.1174,-0.2462,-0.24],[0.4,-0.1163,-0.2466,-0.2353],[0.413,-0.1155,-0.2476,-0.2314],[0.427,-0.115,-0.2488,-0.2282],[0.44,-0.1145,-0.2504,-0.2259],[0.453,-0.1139,-0.2521,-0.2244],[0.467,-0.1131,-0.254,-0.2236],[0.48,-0.1121,-0.2557,-0.2235],[0.493,-0.1105,-0.2574,-0.224],[0.507,-0.1084,-0.2588,-0.2252],[0.52,-0.1056,-0.26,-0.2268],[0.533,-0.1021,-0.2607,-0.229]]},"armR":{"q":[[0,-0.1069,-0.2275,0.5575,0.7912],[0.013,-0.1984,-0.1326,0.5289,0.8145],[0.027,-0.3093,0.0047,0.4756,0.8235],[0.04,-0.42,0.1681,0.3952,0.7995],[0.053,-0.5062,0.325,0.3013,0.7399],[0.067,-0.5574,0.4484,0.217,0.6642],[0.08,-0.5799,0.5325,0.1583,0.5959],[0.093,-0.585,0.585,0.1287,0.5468],[0.107,-0.5814,0.6185,0.1197,0.5149],[0.12,-0.5735,0.6411,0.1225,0.495],[0.133,-0.5635,0.6578,0.1305,0.4825],[0.147,-0.5526,0.6721,0.1377,0.4732],[0.16,-0.5422,0.687,0.1383,0.4636],[0.173,-0.5332,0.7056,0.1255,0.4495],[0.187,-0.5266,0.7302,0.0907,0.4258],[0.2,-0.5215,0.7613,0.0225,0.3847],[0.213,-0.5143,0.7912,-0.087,0.3194],[0.227,-0.5021,0.7984,-0.227,0.2425],[0.24,-0.4868,0.762,-0.3904,0.1729],[0.253,-0.4678,0.651,-0.5838,0.1288],[0.267,-0.432,0.4437,-0.7734,0.1353],[0.28,-0.379,0.1859,-0.8774,0.2278],[0.293,-0.3013,-0.0582,-0.8767,0.3705],[0.307,-0.2001,-0.2358,-0.8132,0.493],[0.32,-0.1092,-0.3439,-0.7328,0.5769],[0.333,-0.0544,-0.4076,-0.6619,0.6268],[0.347,-0.0407,-0.4499,-0.6098,0.6512],[0.36,-0.0443,-0.4769,-0.573,0.665],[0.373,-0.0452,-0.4906,-0.5452,0.6783],[0.387,-0.0417,-0.4951,-0.5237,0.692],[0.4,-0.036,-0.4936,-0.5071,0.7056],[0.413,-0.0292,-0.4884,-0.4944,0.7185],[0.427,-0.0227,-0.4814,-0.4847,0.7299],[0.44,-0.0173,-0.474,-0.4775,0.7396],[0.453,-0.0139,-0.4674,-0.4724,0.7471],[0.467,-0.0133,-0.463,-0.469,0.752],[0.48,-0.0163,-0.4618,-0.4671,0.7539],[0.493,-0.0238,-0.4649,-0.4665,0.7521],[0.507,-0.0369,-0.4734,-0.4671,0.7459],[0.52,-0.0567,-0.4886,-0.4683,0.734],[0.533,-0.0847,-0.5115,-0.4697,0.7146]],"p":[[0,0.3177,0.0183,0.3353],[0.013,0.3091,0.0336,0.3085],[0.027,0.3012,0.0297,0.2619],[0.04,0.2867,-0.0026,0.2118],[0.053,0.2608,-0.0529,0.1782],[0.067,0.228,-0.1007,0.1664],[0.08,0.1965,-0.1365,0.1668],[0.093,0.1717,-0.1633,0.1697],[0.107,0.1535,-0.186,0.172],[0.12,0.1407,-0.2067,0.1746],[0.133,0.132,-0.2257,0.179],[0.147,0.1262,-0.2423,0.1874],[0.16,0.1222,-0.256,0.2019],[0.173,0.1189,-0.266,0.2254],[0.187,0.1147,-0.2714,0.2618],[0.2,0.1076,-0.2696,0.3174],[0.213,0.0959,-0.2506,0.399],[0.227,0.0828,-0.197,0.5019],[0.24,0.0709,-0.0964,0.616],[0.253,0.0529,0.0515,0.7187],[0.267,-0.0007,0.1902,0.7248],[0.28,-0.0982,0.2209,0.5816],[0.293,-0.1848,0.1498,0.3796],[0.307,-0.2115,0.0482,0.209],[0.32,-0.194,-0.0393,0.0924],[0.333,-0.1665,-0.0934,0.0323],[0.347,-0.1537,-0.111,0.0235],[0.36,-0.1506,-0.1106,0.0387],[0.373,-0.1467,-0.1094,0.0539],[0.387,-0.1404,-0.1103,0.0655],[0.4,-0.1322,-0.1126,0.0743],[0.413,-0.1227,-0.1158,0.0809],[0.427,-0.1125,-0.1192,0.0858],[0.44,-0.1021,-0.1225,0.0895],[0.453,-0.0922,-0.1253,0.0923],[0.467,-0.0833,-0.1272,0.0947],[0.48,-0.076,-0.1277,0.097],[0.493,-0.0709,-0.1265,0.0996],[0.507,-0.0686,-0.1227,0.1027],[0.52,-0.0698,-0.1156,0.1065],[0.533,-0.0752,-0.1036,0.1111]]},"legL":{"q":[[0,0.0184,-0.4589,0.2051,0.8643],[0.013,0.0063,-0.4647,0.2128,0.8595],[0.027,-0.0015,-0.4716,0.2245,0.8527],[0.04,-0.005,-0.4778,0.2393,0.8452],[0.053,-0.004,-0.4809,0.2569,0.8383],[0.067,0.0016,-0.478,0.2775,0.8334],[0.08,0.0119,-0.466,0.3014,0.8318],[0.093,0.0263,-0.4421,0.3286,0.8342],[0.107,0.0444,-0.4062,0.3569,0.84],[0.12,0.0656,-0.3588,0.3837,0.8484],[0.133,0.0885,-0.3011,0.4059,0.8583],[0.147,0.1116,-0.2341,0.421,0.8692],[0.16,0.1334,-0.1591,0.4266,0.8803],[0.173,0.1516,-0.0772,0.4206,0.8912],[0.187,0.1644,0.011,0.4012,0.901],[0.2,0.1695,0.1052,0.3673,0.9084],[0.213,0.1767,0.1964,0.3205,0.9097],[0.227,0.1902,0.272,0.2697,0.9039],[0.24,0.198,0.3281,0.2247,0.8959],[0.253,0.1904,0.3643,0.1895,0.8917],[0.267,0.1655,0.3845,0.1634,0.8933],[0.28,0.1291,0.3948,0.1458,0.8979],[0.293,0.0893,0.4023,0.1363,0.9009],[0.307,0.0534,0.4146,0.1324,0.8988],[0.32,0.0276,0.4381,0.1297,0.8891],[0.333,0.0171,0.4777,0.1223,0.8698],[0.347,0.0126,0.5192,0.1132,0.8471],[0.36,0.0052,0.5503,0.1087,0.8278],[0.373,-0.0001,0.5764,0.1072,0.8101],[0.387,-0.0028,0.5989,0.1074,0.7936],[0.4,-0.0035,0.6184,0.1087,0.7783],[0.413,-0.0029,0.6356,0.1101,0.7641],[0.427,-0.0014,0.6512,0.1111,0.7508],[0.44,0.0005,0.6658,0.1111,0.7378],[0.453,0.0025,0.68,0.1094,0.725],[0.467,0.0038,0.6944,0.1059,0.7118],[0.48,0.0037,0.7094,0.1,0.6977],[0.493,0.0015,0.7253,0.0915,0.6823],[0.507,-0.004,0.7423,0.0805,0.6652],[0.52,-0.0138,0.7604,0.0668,0.6459],[0.533,-0.029,0.7794,0.0501,0.6239]],"p":[[0,-0.1434,0.2155,0.4618],[0.013,-0.1481,0.2073,0.4456],[0.027,-0.1558,0.1995,0.4301],[0.04,-0.165,0.1932,0.4162],[0.053,-0.1748,0.1895,0.4043],[0.067,-0.1847,0.189,0.3954],[0.08,-0.1945,0.1925,0.3897],[0.093,-0.2034,0.2004,0.3876],[0.107,-0.2111,0.2115,0.3893],[0.12,-0.2164,0.2249,0.395],[0.133,-0.218,0.2405,0.4036],[0.147,-0.2145,0.2585,0.4138],[0.16,-0.2047,0.2798,0.4233],[0.173,-0.1874,0.305,0.4285],[0.187,-0.1619,0.3338,0.4254],[0.2,-0.1278,0.3649,0.4083],[0.213,-0.0875,0.3837,0.383],[0.227,-0.0485,0.3791,0.3578],[0.24,-0.019,0.3581,0.3299],[0.253,-0.0018,0.3312,0.2959],[0.267,0.0073,0.3043,0.2538],[0.28,0.0127,0.2773,0.2045],[0.293,0.0163,0.2487,0.1504],[0.307,0.0178,0.2191,0.0947],[0.32,0.0171,0.1919,0.0418],[0.333,0.0157,0.1722,-0.0038],[0.347,0.0122,0.1587,-0.0405],[0.36,0.0051,0.1458,-0.0706],[0.373,-0.0035,0.1334,-0.0959],[0.387,-0.0127,0.1218,-0.1171],[0.4,-0.0221,0.1116,-0.1351],[0.413,-0.0312,0.1028,-0.1503],[0.427,-0.0396,0.0958,-0.1634],[0.44,-0.0467,0.0907,-0.1747],[0.453,-0.0523,0.0876,-0.1849],[0.467,-0.0564,0.0866,-0.1947],[0.48,-0.0588,0.0877,-0.2047],[0.493,-0.0599,0.0909,-0.2158],[0.507,-0.0603,0.0961,-0.2288],[0.52,-0.0606,0.1031,-0.2447],[0.533,-0.0614,0.1117,-0.2644]]},"legR":{"q":[[0,-0.0693,-0.5653,-0.0859,0.8175],[0.013,-0.0569,-0.5692,-0.0814,0.8162],[0.027,-0.0389,-0.5746,-0.0753,0.814],[0.04,-0.0187,-0.5799,-0.0673,0.8117],[0.053,0.0004,-0.583,-0.0571,0.8105],[0.067,0.0152,-0.5824,-0.0442,0.8115],[0.08,0.0227,-0.5767,-0.0277,0.8162],[0.093,0.0208,-0.5649,-0.007,0.8249],[0.107,0.0105,-0.5476,0.0178,0.8365],[0.12,-0.0063,-0.5258,0.0465,0.8493],[0.133,-0.0277,-0.5002,0.0788,0.8619],[0.147,-0.0519,-0.4717,0.114,0.8728],[0.16,-0.0778,-0.4409,0.151,0.8813],[0.173,-0.1036,-0.4081,0.1889,0.8871],[0.187,-0.1275,-0.3731,0.2269,0.8905],[0.2,-0.1481,-0.3353,0.2634,0.8924],[0.213,-0.1425,-0.3064,0.3059,0.8901],[0.227,-0.0862,-0.2916,0.347,0.8872],[0.24,0.0148,-0.2831,0.3613,0.8883],[0.253,0.1255,-0.2836,0.3287,0.8921],[0.267,0.2182,-0.2933,0.2496,0.8967],[0.28,0.2687,-0.3101,0.1396,0.9012],[0.293,0.2701,-0.326,0.0213,0.9057],[0.307,0.2345,-0.3317,-0.0814,0.9102],[0.32,0.1829,-0.32,-0.1515,0.9172],[0.333,0.1483,-0.2876,-0.1769,0.9295],[0.347,0.1582,-0.253,-0.1691,0.9393],[0.36,0.1587,-0.2238,-0.1686,0.9467],[0.373,0.1544,-0.1966,-0.1721,0.9528],[0.387,0.1479,-0.1712,-0.1775,0.9578],[0.4,0.1403,-0.1477,-0.1833,0.9617],[0.413,0.1322,-0.1259,-0.1889,0.9649],[0.427,0.1237,-0.1057,-0.1938,0.9674],[0.44,0.1148,-0.0868,-0.1979,0.9696],[0.453,0.1053,-0.0688,-0.2008,0.9715],[0.467,0.0953,-0.0514,-0.2023,0.9733],[0.48,0.0848,-0.0343,-0.2021,0.9751],[0.493,0.0739,-0.0171,-0.1999,0.9769],[0.507,0.0623,0.0004,-0.1954,0.9787],[0.52,0.0496,0.0188,-0.1883,0.9807],[0.533,0.0346,0.0386,-0.178,0.9827]],"p":[[0,-0.014,0.3183,-0.3315],[0.013,-0.0219,0.3101,-0.3247],[0.027,-0.03,0.2997,-0.3173],[0.04,-0.0381,0.286,-0.3094],[0.053,-0.0458,0.2682,-0.3007],[0.067,-0.0527,0.2458,-0.2909],[0.08,-0.0587,0.2184,-0.2792],[0.093,-0.0633,0.1859,-0.2647],[0.107,-0.0657,0.1499,-0.2472],[0.12,-0.0655,0.1117,-0.2266],[0.133,-0.0623,0.0728,-0.2034],[0.147,-0.0552,0.0344,-0.1786],[0.16,-0.0432,-0.0023,-0.1541],[0.173,-0.0264,-0.0364,-0.1321],[0.187,-0.0055,-0.0674,-0.1149],[0.2,0.0183,-0.0947,-0.1054],[0.213,0.0412,-0.1166,-0.1054],[0.227,0.0566,-0.1251,-0.1103],[0.24,0.0596,-0.1173,-0.1119],[0.253,0.0544,-0.0948,-0.1189],[0.267,0.0417,-0.0607,-0.1242],[0.28,0.0274,-0.0183,-0.1247],[0.293,0.0194,0.0258,-0.1188],[0.307,0.0184,0.0608,-0.1071],[0.32,0.0192,0.0843,-0.0907],[0.333,0.0096,0.1001,-0.0539],[0.347,-0.016,0.1074,0.0228],[0.36,-0.0241,0.116,0.0787],[0.373,-0.0239,0.1242,0.1201],[0.387,-0.0198,0.1311,0.1506],[0.4,-0.0141,0.1366,0.1732],[0.413,-0.0081,0.1408,0.19],[0.427,-0.0024,0.144,0.2028],[0.44,0.003,0.1467,0.2133],[0.453,0.008,0.1491,0.223],[0.467,0.0129,0.1517,0.2333],[0.48,0.0179,0.1547,0.2456],[0.493,0.0233,0.1588,0.2613],[0.507,0.0297,0.1647,0.2811],[0.52,0.0375,0.1734,0.3053],[0.533,0.0471,0.1865,0.3327]]}}},"rig2_sword_5":{"dur":0.533,"loop":false,"t":{"torso":{"q":[[0,0.0004,-0.86,0.036,0.5091],[0.013,0.0352,-0.873,0.0525,0.4837],[0.027,0.0746,-0.8832,0.0698,0.4577],[0.04,0.1163,-0.8891,0.0865,0.4342],[0.053,0.1573,-0.8897,0.101,0.4165],[0.067,0.1946,-0.8849,0.1123,0.408],[0.08,0.2254,-0.8748,0.1193,0.4119],[0.093,0.2475,-0.8594,0.1222,0.4305],[0.107,0.2618,-0.8382,0.1224,0.4624],[0.12,0.2695,-0.8105,0.122,0.5056],[0.133,0.2722,-0.7748,0.1222,0.5575],[0.147,0.2713,-0.7296,0.1238,0.6155],[0.16,0.268,-0.6734,0.1272,0.6772],[0.173,0.2632,-0.6045,0.1323,0.7402],[0.187,0.2572,-0.5204,0.1386,0.8024],[0.2,0.2493,-0.4181,0.1453,0.8614],[0.213,0.2379,-0.2958,0.1505,0.9128],[0.227,0.2212,-0.154,0.1524,0.9509],[0.24,0.198,0.0025,0.1492,0.9688],[0.253,0.1681,0.1639,0.1398,0.9619],[0.267,0.1332,0.318,0.1245,0.9304],[0.28,0.0965,0.4535,0.1046,0.8798],[0.293,0.0613,0.5644,0.0823,0.8191],[0.307,0.0303,0.65,0.0596,0.757],[0.32,0.0053,0.713,0.0379,0.7001],[0.333,-0.0123,0.7576,0.0181,0.6524],[0.347,-0.0222,0.7881,0.0004,0.6151],[0.36,-0.0271,0.8106,-0.0159,0.5848],[0.373,-0.0298,0.8288,-0.0315,0.5578],[0.387,-0.031,0.8437,-0.0461,0.5339],[0.4,-0.0309,0.8555,-0.0592,0.5134],[0.413,-0.0296,0.8646,-0.0704,0.4966],[0.427,-0.0274,0.8711,-0.0793,0.4838],[0.44,-0.0246,0.8754,-0.0854,0.4751],[0.453,-0.0213,0.8777,-0.0883,0.4706],[0.467,-0.018,0.8779,-0.0877,0.4704],[0.48,-0.015,0.8761,-0.0832,0.4747],[0.493,-0.0127,0.8721,-0.0743,0.4835],[0.507,-0.0118,0.8657,-0.0609,0.4967],[0.52,-0.013,0.8564,-0.0427,0.5144],[0.533,-0.017,0.8435,-0.0196,0.5365]],"p":[[0,0,-0.1363,0.0091],[0.013,-0.0199,-0.1494,0.0124],[0.027,-0.0418,-0.1662,0.015],[0.04,-0.0642,-0.1853,0.0173],[0.053,-0.0857,-0.2049,0.02],[0.067,-0.1051,-0.2222,0.0242],[0.08,-0.121,-0.2342,0.0311],[0.093,-0.1325,-0.2382,0.0413],[0.107,-0.14,-0.235,0.0541],[0.12,-0.144,-0.2262,0.0685],[0.133,-0.1449,-0.2135,0.0836],[0.147,-0.1433,-0.1989,0.0987],[0.16,-0.1395,-0.1842,0.1134],[0.173,-0.1338,-0.1709,0.1274],[0.187,-0.1262,-0.1605,0.1404],[0.2,-0.1167,-0.1538,0.1517],[0.213,-0.1051,-0.1502,0.1598],[0.227,-0.0922,-0.149,0.1627],[0.24,-0.0794,-0.1499,0.1585],[0.253,-0.069,-0.1535,0.1471],[0.267,-0.0628,-0.1608,0.1305],[0.28,-0.0615,-0.1721,0.1123],[0.293,-0.0641,-0.1869,0.0958],[0.307,-0.0689,-0.204,0.0829],[0.32,-0.074,-0.2218,0.074],[0.333,-0.0781,-0.2386,0.0685],[0.347,-0.0802,-0.2532,0.0656],[0.36,-0.0809,-0.2656,0.0636],[0.373,-0.081,-0.2759,0.0612],[0.387,-0.0807,-0.2843,0.0584],[0.4,-0.0801,-0.2906,0.0555],[0.413,-0.0791,-0.2947,0.0526],[0.427,-0.0778,-0.2967,0.0502],[0.44,-0.0763,-0.2963,0.0483],[0.453,-0.0746,-0.2937,0.0474],[0.467,-0.0728,-0.2887,0.0477],[0.48,-0.071,-0.2813,0.0494],[0.493,-0.0695,-0.2716,0.0528],[0.507,-0.0684,-0.2596,0.058],[0.52,-0.0682,-0.2455,0.065],[0.533,-0.0691,-0.2295,0.0736]]},"head":{"q":[[0,0.1736,0.652,-0.1331,0.7259],[0.013,0.1715,0.6509,-0.1388,0.7264],[0.027,0.1657,0.6483,-0.1472,0.7284],[0.04,0.1569,0.6441,-0.1578,0.7318],[0.053,0.1459,0.6383,-0.17,0.7365],[0.067,0.1333,0.6306,-0.1834,0.7422],[0.08,0.1198,0.6212,-0.1974,0.7489],[0.093,0.1059,0.6099,-0.2116,0.7564],[0.107,0.0923,0.5966,-0.2256,0.7646],[0.12,0.0794,0.5813,-0.2391,0.7737],[0.133,0.0678,0.5639,-0.2518,0.7836],[0.147,0.0581,0.5441,-0.2634,0.7945],[0.16,0.0506,0.5218,-0.2736,0.8064],[0.173,0.046,0.4965,-0.2821,0.8196],[0.187,0.0448,0.4677,-0.2885,0.8343],[0.2,0.05,0.4232,-0.2868,0.858],[0.213,0.0633,0.35,-0.2706,0.8946],[0.227,0.0838,0.2453,-0.2381,0.936],[0.24,0.1096,0.1101,-0.1884,0.9697],[0.253,0.1371,-0.0453,-0.1239,0.9817],[0.267,0.1617,-0.2012,-0.0528,0.9647],[0.28,0.1803,-0.3368,0.0143,0.924],[0.293,0.1924,-0.4406,0.0694,0.8741],[0.307,0.1995,-0.5113,0.1092,0.8288],[0.32,0.203,-0.5522,0.1333,0.7976],[0.333,0.2041,-0.5659,0.1416,0.7862],[0.347,0.2041,-0.5659,0.1416,0.7862],[0.36,0.2041,-0.5659,0.1416,0.7862],[0.373,0.2041,-0.5659,0.1416,0.7862],[0.387,0.2041,-0.5659,0.1416,0.7862],[0.4,0.2041,-0.5659,0.1416,0.7862],[0.413,0.2041,-0.5659,0.1416,0.7862],[0.427,0.2041,-0.5659,0.1416,0.7862],[0.44,0.2041,-0.5659,0.1416,0.7862],[0.453,0.2041,-0.5659,0.1416,0.7862],[0.467,0.2041,-0.5659,0.1416,0.7862],[0.48,0.2041,-0.5659,0.1416,0.7862],[0.493,0.2041,-0.5659,0.1416,0.7862],[0.507,0.2041,-0.5659,0.1416,0.7862],[0.52,0.2041,-0.5659,0.1416,0.7862],[0.533,0.2041,-0.5659,0.1416,0.7862]]},"armL":{"q":[[0,-0.3083,-0.0313,0.4659,0.8288],[0.013,-0.2922,-0.0276,0.4661,0.8347],[0.027,-0.2722,-0.0199,0.4684,0.8403],[0.04,-0.2503,-0.0073,0.4733,0.8446],[0.053,-0.2283,0.0107,0.4809,0.8465],[0.067,-0.2084,0.035,0.4915,0.8448],[0.08,-0.1926,0.0659,0.5052,0.8387],[0.093,-0.1826,0.1029,0.5215,0.8271],[0.107,-0.1789,0.1427,0.5386,0.8109],[0.12,-0.1819,0.1814,0.5549,0.7913],[0.133,-0.1918,0.2158,0.569,0.77],[0.147,-0.2092,0.2432,0.5801,0.7487],[0.16,-0.2349,0.2611,0.5877,0.7289],[0.173,-0.2706,0.2667,0.5907,0.7118],[0.187,-0.3184,0.2564,0.5878,0.6981],[0.2,-0.3809,0.2257,0.5762,0.687],[0.213,-0.4576,0.1727,0.5527,0.6747],[0.227,-0.5447,0.0969,0.5136,0.6559],[0.24,-0.6341,0.0006,0.4559,0.6245],[0.253,-0.7144,-0.1085,0.3802,0.5772],[0.267,-0.7748,-0.2183,0.2933,0.5158],[0.28,-0.8109,-0.3164,0.2057,0.4472],[0.293,-0.8261,-0.3957,0.1272,0.3804],[0.307,-0.8278,-0.4549,0.0636,0.322],[0.32,-0.8233,-0.4961,0.0171,0.2752],[0.333,-0.818,-0.522,-0.012,0.2413],[0.347,-0.8153,-0.5351,-0.0247,0.2197],[0.36,-0.8155,-0.5399,-0.027,0.2067],[0.373,-0.8177,-0.5396,-0.0246,0.1988],[0.387,-0.8214,-0.5356,-0.0192,0.1949],[0.4,-0.8261,-0.5288,-0.0117,0.1944],[0.413,-0.8312,-0.5201,-0.003,0.1965],[0.427,-0.8362,-0.5104,0.0059,0.2005],[0.44,-0.8406,-0.5009,0.0141,0.2057],[0.453,-0.844,-0.4925,0.0205,0.2114],[0.467,-0.8461,-0.4863,0.0243,0.2168],[0.48,-0.8465,-0.4835,0.0246,0.2213],[0.493,-0.8449,-0.4852,0.0203,0.2242],[0.507,-0.8409,-0.4922,0.0107,0.2247],[0.52,-0.8339,-0.5052,-0.005,0.2221],[0.533,-0.8229,-0.5249,-0.0277,0.2157]],"p":[[0,-0.1021,-0.2607,-0.229],[0.013,-0.0979,-0.2608,-0.2318],[0.027,-0.094,-0.2606,-0.2352],[0.04,-0.0914,-0.2602,-0.2392],[0.053,-0.091,-0.26,-0.244],[0.067,-0.0939,-0.2602,-0.2495],[0.08,-0.1009,-0.261,-0.256],[0.093,-0.1124,-0.2624,-0.2635],[0.107,-0.1273,-0.2641,-0.2709],[0.12,-0.144,-0.2656,-0.2767],[0.133,-0.1612,-0.2666,-0.2788],[0.147,-0.1773,-0.2669,-0.2746],[0.16,-0.1908,-0.2663,-0.2614],[0.173,-0.2006,-0.2645,-0.2364],[0.187,-0.2056,-0.2613,-0.1965],[0.2,-0.2061,-0.2564,-0.1408],[0.213,-0.2049,-0.25,-0.0737],[0.227,-0.2044,-0.243,-0.0028],[0.24,-0.2053,-0.2375,0.0629],[0.253,-0.2049,-0.2359,0.116],[0.267,-0.1987,-0.2389,0.1548],[0.28,-0.1842,-0.2452,0.1839],[0.293,-0.1634,-0.2515,0.2091],[0.307,-0.1413,-0.2549,0.2329],[0.32,-0.1236,-0.2538,0.2545],[0.333,-0.1151,-0.2474,0.2707],[0.347,-0.1176,-0.2357,0.279],[0.36,-0.1246,-0.2216,0.2809],[0.373,-0.1287,-0.2079,0.2789],[0.387,-0.1292,-0.1954,0.2742],[0.4,-0.127,-0.1842,0.2676],[0.413,-0.1231,-0.1745,0.2601],[0.427,-0.1184,-0.1667,0.2524],[0.44,-0.1139,-0.1609,0.2453],[0.453,-0.1107,-0.1575,0.2396],[0.467,-0.1097,-0.1567,0.2361],[0.48,-0.1121,-0.159,0.2355],[0.493,-0.1189,-0.1645,0.2386],[0.507,-0.1312,-0.1734,0.2463],[0.52,-0.1497,-0.1858,0.2592],[0.533,-0.1752,-0.2017,0.2786]]},"armR":{"q":[[0,-0.0847,-0.5115,-0.4697,0.7146],[0.013,-0.1218,-0.5424,-0.4701,0.6855],[0.027,-0.167,-0.5796,-0.4679,0.6459],[0.04,-0.2183,-0.6203,-0.4611,0.5958],[0.053,-0.2732,-0.6613,-0.4481,0.5359],[0.067,-0.3288,-0.6998,-0.4277,0.4683],[0.08,-0.3821,-0.7332,-0.3996,0.396],[0.093,-0.4306,-0.7602,-0.3641,0.3228],[0.107,-0.4727,-0.7804,-0.3222,0.2524],[0.12,-0.5077,-0.7946,-0.2747,0.188],[0.133,-0.5357,-0.8039,-0.2224,0.1319],[0.147,-0.5569,-0.8095,-0.1651,0.0858],[0.16,-0.5716,-0.8126,-0.1021,0.0509],[0.173,-0.5798,-0.8136,-0.0316,0.0285],[0.187,-0.5807,-0.8124,0.0489,0.0202],[0.2,-0.5733,-0.8065,0.1421,0.0279],[0.213,-0.5601,-0.7892,0.2461,0.0526],[0.227,-0.546,-0.7523,0.3563,0.0947],[0.24,-0.5364,-0.687,0.4652,0.1545],[0.253,-0.5354,-0.5861,0.563,0.2298],[0.267,-0.5374,-0.4533,0.6392,0.3118],[0.28,-0.5357,-0.3037,0.6857,0.3881],[0.293,-0.5285,-0.1585,0.7027,0.4491],[0.307,-0.5183,-0.0355,0.6987,0.4918],[0.32,-0.5086,0.0557,0.6853,0.5182],[0.333,-0.5027,0.1122,0.6721,0.532],[0.347,-0.5014,0.1358,0.6649,0.5367],[0.36,-0.5018,0.1406,0.6627,0.5378],[0.373,-0.5001,0.1397,0.663,0.5394],[0.387,-0.4958,0.1363,0.6647,0.5421],[0.4,-0.4898,0.1311,0.6673,0.5455],[0.413,-0.4826,0.1249,0.6705,0.5495],[0.427,-0.4749,0.1186,0.6736,0.5537],[0.44,-0.4675,0.1127,0.6763,0.558],[0.453,-0.4609,0.1081,0.6782,0.562],[0.467,-0.4558,0.1055,0.679,0.5658],[0.48,-0.4529,0.1056,0.6782,0.569],[0.493,-0.4527,0.1091,0.6755,0.5716],[0.507,-0.456,0.1168,0.6705,0.5734],[0.52,-0.4635,0.1296,0.6625,0.5741],[0.533,-0.4756,0.1484,0.6506,0.5732]],"p":[[0,-0.0752,-0.1036,0.1111],[0.013,-0.0852,-0.0852,0.1157],[0.027,-0.0989,-0.0598,0.1193],[0.04,-0.1147,-0.0274,0.1204],[0.053,-0.1312,0.0108,0.1176],[0.067,-0.1465,0.0528,0.1101],[0.08,-0.1595,0.0956,0.0981],[0.093,-0.1692,0.1358,0.083],[0.107,-0.1755,0.171,0.0671],[0.12,-0.1787,0.1994,0.0532],[0.133,-0.1793,0.2205,0.044],[0.147,-0.1776,0.2343,0.0417],[0.16,-0.174,0.2412,0.0484],[0.173,-0.1686,0.242,0.0658],[0.187,-0.1614,0.2372,0.0958],[0.2,-0.1528,0.2288,0.1403],[0.213,-0.1459,0.2251,0.2007],[0.227,-0.1441,0.2355,0.2764],[0.24,-0.1502,0.2686,0.3639],[0.253,-0.1552,0.3256,0.4476],[0.267,-0.1051,0.3868,0.4758],[0.28,0.0339,0.4274,0.4128],[0.293,0.183,0.423,0.3067],[0.307,0.2607,0.3646,0.2162],[0.32,0.2789,0.2831,0.1546],[0.333,0.2733,0.2169,0.1212],[0.347,0.2722,0.1924,0.1122],[0.36,0.2753,0.1946,0.1161],[0.373,0.2756,0.202,0.1225],[0.387,0.2726,0.2099,0.1294],[0.4,0.2669,0.2174,0.1364],[0.413,0.2595,0.2238,0.1437],[0.427,0.2512,0.2284,0.1509],[0.44,0.2428,0.2303,0.1579],[0.453,0.2353,0.2289,0.1647],[0.467,0.2293,0.2235,0.1709],[0.48,0.2258,0.2136,0.1766],[0.493,0.2255,0.1983,0.1813],[0.507,0.2294,0.1769,0.1852],[0.52,0.2382,0.1486,0.1879],[0.533,0.2527,0.1123,0.1896]]},"legL":{"q":[[0,-0.029,0.7794,0.0501,0.6239],[0.013,-0.0487,0.7984,0.0307,0.5994],[0.027,-0.0705,0.815,0.0091,0.5751],[0.04,-0.0935,0.8271,-0.0133,0.554],[0.053,-0.116,0.8334,-0.035,0.5392],[0.067,-0.1358,0.8329,-0.0554,0.5336],[0.08,-0.1505,0.8252,-0.0734,0.5395],[0.093,-0.1583,0.8096,-0.089,0.5582],[0.107,-0.1592,0.7862,-0.1045,0.5879],[0.12,-0.1536,0.7547,-0.1221,0.6261],[0.133,-0.1417,0.7145,-0.143,0.67],[0.147,-0.1234,0.6652,-0.1679,0.717],[0.16,-0.0981,0.6062,-0.196,0.7645],[0.173,-0.0652,0.537,-0.225,0.8104],[0.187,-0.0244,0.4569,-0.251,0.853],[0.2,0.023,0.3743,-0.2735,0.8857],[0.213,0.0761,0.2978,-0.2893,0.9065],[0.227,0.133,0.2269,-0.2908,0.9199],[0.24,0.1893,0.1628,-0.2731,0.929],[0.253,0.2368,0.108,-0.2318,0.9373],[0.267,0.2669,0.0635,-0.1617,0.9479],[0.28,0.2745,0.0262,-0.0644,0.9591],[0.293,0.2578,-0.0071,0.0466,0.965],[0.307,0.2211,-0.0396,0.1515,0.9626],[0.32,0.1776,-0.0751,0.2339,0.9529],[0.333,0.1455,-0.1185,0.285,0.94],[0.347,0.1228,-0.1601,0.3162,0.927],[0.36,0.0981,-0.1916,0.3419,0.9147],[0.373,0.0722,-0.2179,0.3644,0.9025],[0.387,0.0461,-0.2399,0.3836,0.8906],[0.4,0.0211,-0.2577,0.3991,0.8797],[0.413,-0.0014,-0.2714,0.4107,0.8704],[0.427,-0.0206,-0.2815,0.4182,0.8634],[0.44,-0.0355,-0.288,0.4216,0.8591],[0.453,-0.0455,-0.2912,0.4211,0.8578],[0.467,-0.05,-0.2913,0.4167,0.8597],[0.48,-0.0485,-0.2883,0.4086,0.8646],[0.493,-0.0406,-0.2824,0.397,0.8724],[0.507,-0.0263,-0.2733,0.3823,0.8823],[0.52,-0.006,-0.2609,0.3653,0.8935],[0.533,0.0193,-0.245,0.3473,0.905]],"p":[[0,-0.0614,0.1117,-0.2644],[0.013,-0.0636,0.1216,-0.2891],[0.027,-0.067,0.1313,-0.3179],[0.04,-0.0714,0.1387,-0.348],[0.053,-0.0757,0.1426,-0.3759],[0.067,-0.0772,0.1427,-0.3984],[0.08,-0.0733,0.1399,-0.412],[0.093,-0.0621,0.1347,-0.4138],[0.107,-0.0436,0.1274,-0.4035],[0.12,-0.0189,0.117,-0.3807],[0.133,0.0097,0.1029,-0.3444],[0.147,0.0393,0.0841,-0.2937],[0.16,0.0662,0.0604,-0.2278],[0.173,0.0859,0.0323,-0.1473],[0.187,0.0935,0.0014,-0.0552],[0.2,0.0845,-0.0342,0.0332],[0.213,0.0626,-0.0743,0.0995],[0.227,0.0388,-0.1134,0.1369],[0.24,0.0269,-0.1437,0.1482],[0.253,0.0348,-0.1517,0.1472],[0.267,0.0552,-0.1224,0.1543],[0.28,0.0689,-0.0575,0.1813],[0.293,0.0629,0.0223,0.2191],[0.307,0.0395,0.0952,0.2527],[0.32,0.0099,0.1505,0.2803],[0.333,-0.018,0.1894,0.3141],[0.347,-0.0436,0.2188,0.3449],[0.36,-0.0669,0.2432,0.3605],[0.373,-0.0883,0.2641,0.367],[0.387,-0.1073,0.2813,0.3669],[0.4,-0.1228,0.2948,0.3625],[0.413,-0.1346,0.3046,0.3556],[0.427,-0.1425,0.311,0.3481],[0.44,-0.1466,0.3141,0.3413],[0.453,-0.1469,0.3139,0.3359],[0.467,-0.1437,0.3101,0.3323],[0.48,-0.137,0.3024,0.3306],[0.493,-0.127,0.2901,0.3298],[0.507,-0.1136,0.2724,0.3287],[0.52,-0.0974,0.2485,0.3243],[0.533,-0.079,0.2182,0.3122]]},"legR":{"q":[[0,0.0346,0.0386,-0.178,0.9827],[0.013,0.0178,0.0621,-0.1655,0.9841],[0.027,0,0.0897,-0.1533,0.9841],[0.04,-0.0187,0.1184,-0.1433,0.9824],[0.053,-0.0378,0.1453,-0.1372,0.9791],[0.067,-0.0549,0.1676,-0.1364,0.9748],[0.08,-0.0663,0.1828,-0.1416,0.9706],[0.093,-0.0683,0.1895,-0.1525,0.9676],[0.107,-0.0604,0.1881,-0.168,0.9658],[0.12,-0.0431,0.1794,-0.1865,0.965],[0.133,-0.0176,0.1637,-0.206,0.9646],[0.147,0.0151,0.141,-0.2246,0.9641],[0.16,0.0539,0.1115,-0.2406,0.9627],[0.173,0.0984,0.0751,-0.253,0.9595],[0.187,0.148,0.0324,-0.261,0.9534],[0.2,0.1967,-0.0133,-0.258,0.9458],[0.213,0.228,-0.0519,-0.2413,0.9418],[0.227,0.2303,-0.0758,-0.2081,0.9476],[0.24,0.204,-0.0837,-0.1608,0.962],[0.253,0.1594,-0.0786,-0.1219,0.9765],[0.267,0.1162,-0.07,-0.113,0.9843],[0.28,0.0956,-0.0709,-0.1288,0.9845],[0.293,0.1018,-0.0869,-0.1456,0.9802],[0.307,0.1232,-0.1156,-0.1463,0.9747],[0.32,0.1493,-0.1538,-0.1289,0.9682],[0.333,0.1796,-0.2018,-0.0969,0.9579],[0.347,0.2065,-0.2471,-0.0624,0.9447],[0.36,0.2233,-0.2814,-0.0335,0.9327],[0.373,0.2342,-0.3098,-0.0077,0.9215],[0.387,0.2406,-0.3335,0.0153,0.9114],[0.4,0.2432,-0.3529,0.0347,0.9028],[0.413,0.2429,-0.3683,0.0501,0.896],[0.427,0.2405,-0.38,0.0611,0.8911],[0.44,0.2367,-0.3882,0.0673,0.8881],[0.453,0.2323,-0.3929,0.0687,0.8871],[0.467,0.2278,-0.3942,0.0651,0.8879],[0.48,0.2238,-0.3919,0.0566,0.8906],[0.493,0.2208,-0.3857,0.0432,0.8948],[0.507,0.219,-0.375,0.0253,0.9004],[0.52,0.2187,-0.3592,0.0034,0.9073],[0.533,0.2201,-0.3374,-0.0218,0.915]],"p":[[0,0.0471,0.1865,0.3327],[0.013,0.0602,0.2077,0.3639],[0.027,0.0772,0.2384,0.3948],[0.04,0.0958,0.276,0.4185],[0.053,0.1134,0.3161,0.4305],[0.067,0.1279,0.3532,0.4316],[0.08,0.1383,0.382,0.4256],[0.093,0.1442,0.3989,0.4179],[0.107,0.1467,0.4047,0.4117],[0.12,0.1461,0.4011,0.4076],[0.133,0.1425,0.3894,0.4053],[0.147,0.1358,0.3705,0.4034],[0.16,0.1259,0.3451,0.4007],[0.173,0.1139,0.3131,0.3957],[0.187,0.1012,0.2739,0.3864],[0.2,0.0957,0.2341,0.3721],[0.213,0.1039,0.2093,0.3522],[0.227,0.115,0.2112,0.3279],[0.24,0.1136,0.235,0.3047],[0.253,0.1003,0.2637,0.2865],[0.267,0.0842,0.2852,0.2751],[0.28,0.0659,0.2924,0.2718],[0.293,0.0391,0.2843,0.2705],[0.307,0.0034,0.2669,0.261],[0.32,-0.0336,0.248,0.2419],[0.333,-0.0651,0.2318,0.224],[0.347,-0.0892,0.2199,0.2106],[0.36,-0.1082,0.2113,0.1959],[0.373,-0.1243,0.2035,0.179],[0.387,-0.1377,0.1962,0.1609],[0.4,-0.1481,0.19,0.1429],[0.413,-0.1557,0.1851,0.1263],[0.427,-0.1606,0.1817,0.112],[0.44,-0.163,0.1798,0.1009],[0.453,-0.1629,0.1793,0.0935],[0.467,-0.1606,0.1801,0.09],[0.48,-0.156,0.1818,0.0906],[0.493,-0.1491,0.1838,0.095],[0.507,-0.1397,0.1852,0.1029],[0.52,-0.1277,0.1853,0.1134],[0.533,-0.1131,0.1827,0.1253]]}}},"rig2_sword_6":{"dur":0.533,"loop":false,"t":{"torso":{"q":[[0,-0.017,0.8435,-0.0196,0.5365],[0.013,-0.0247,0.8264,0.0078,0.5625],[0.027,-0.0352,0.8047,0.0369,0.5914],[0.04,-0.047,0.7786,0.0649,0.6223],[0.053,-0.0581,0.7487,0.0891,0.6544],[0.067,-0.0662,0.7156,0.1076,0.687],[0.08,-0.0685,0.6804,0.1189,0.7199],[0.093,-0.0623,0.6436,0.1229,0.7529],[0.107,-0.0472,0.6043,0.1212,0.7861],[0.12,-0.0237,0.5608,0.1159,0.8195],[0.133,0.0073,0.511,0.1092,0.8526],[0.147,0.0442,0.4529,0.1028,0.8845],[0.16,0.0848,0.3849,0.098,0.9138],[0.173,0.1268,0.3054,0.0955,0.9389],[0.187,0.167,0.2138,0.0951,0.9578],[0.2,0.2026,0.1104,0.0959,0.9683],[0.213,0.232,-0.0019,0.0964,0.9679],[0.227,0.2544,-0.119,0.0952,0.955],[0.24,0.2693,-0.2361,0.0915,0.9292],[0.253,0.2767,-0.3489,0.0849,0.8914],[0.267,0.2773,-0.4533,0.0754,0.8438],[0.28,0.2721,-0.5464,0.0638,0.7896],[0.293,0.2625,-0.6263,0.0508,0.7323],[0.307,0.25,-0.6925,0.0377,0.6757],[0.32,0.236,-0.745,0.0257,0.6233],[0.333,0.2219,-0.7848,0.0159,0.5784],[0.347,0.209,-0.8133,0.0091,0.5429],[0.36,0.1981,-0.8337,0.0047,0.5154],[0.373,0.1902,-0.8486,0.0018,0.4936],[0.387,0.1851,-0.8593,-0.0001,0.4768],[0.4,0.1824,-0.8665,-0.001,0.4646],[0.413,0.1818,-0.871,-0.0011,0.4565],[0.427,0.1828,-0.8732,-0.0006,0.4518],[0.44,0.1852,-0.8736,0.0005,0.45],[0.453,0.1885,-0.8726,0.0019,0.4505],[0.467,0.1923,-0.8707,0.0036,0.4527],[0.48,0.1963,-0.8681,0.0054,0.4559],[0.493,0.2,-0.8654,0.0071,0.4594],[0.507,0.2032,-0.8629,0.0085,0.4627],[0.52,0.2054,-0.861,0.0095,0.4652],[0.533,0.2062,-0.8603,0.0098,0.4661]],"p":[[0,-0.0691,-0.2295,0.0736],[0.013,-0.0713,-0.2121,0.0834],[0.027,-0.0743,-0.1943,0.093],[0.04,-0.0775,-0.1768,0.1013],[0.053,-0.0798,-0.1601,0.1076],[0.067,-0.0803,-0.1443,0.1119],[0.08,-0.078,-0.1296,0.115],[0.093,-0.0726,-0.1162,0.1181],[0.107,-0.0644,-0.1054,0.1223],[0.12,-0.0542,-0.0982,0.1288],[0.133,-0.0432,-0.0955,0.1383],[0.147,-0.0325,-0.0975,0.1511],[0.16,-0.0236,-0.1047,0.1669],[0.173,-0.0176,-0.1168,0.1845],[0.187,-0.0155,-0.1332,0.202],[0.2,-0.0175,-0.1528,0.217],[0.213,-0.023,-0.1742,0.228],[0.227,-0.0307,-0.1962,0.234],[0.24,-0.0393,-0.2175,0.2346],[0.253,-0.0476,-0.2373,0.2305],[0.267,-0.0544,-0.2553,0.2228],[0.28,-0.0593,-0.271,0.2131],[0.293,-0.0622,-0.2847,0.2027],[0.307,-0.0632,-0.2963,0.1926],[0.32,-0.0628,-0.3058,0.1834],[0.333,-0.0615,-0.3131,0.1752],[0.347,-0.0597,-0.3183,0.1681],[0.36,-0.058,-0.3216,0.1622],[0.373,-0.0569,-0.3238,0.158],[0.387,-0.0564,-0.3248,0.1551],[0.4,-0.0565,-0.325,0.1534],[0.413,-0.057,-0.3244,0.1527],[0.427,-0.058,-0.3232,0.1527],[0.44,-0.0593,-0.3215,0.1533],[0.453,-0.0607,-0.3195,0.1543],[0.467,-0.0623,-0.3174,0.1556],[0.48,-0.0638,-0.3154,0.157],[0.493,-0.0652,-0.3136,0.1584],[0.507,-0.0663,-0.3121,0.1596],[0.52,-0.067,-0.3111,0.1604],[0.533,-0.0673,-0.3107,0.1608]]},"head":{"q":[[0,0.2041,-0.5659,0.1416,0.7862],[0.013,0.2032,-0.5631,0.1398,0.7887],[0.027,0.2005,-0.5549,0.1347,0.7961],[0.04,0.1962,-0.5416,0.1268,0.8075],[0.053,0.1903,-0.5234,0.1166,0.8223],[0.067,0.1829,-0.5004,0.1046,0.8397],[0.08,0.174,-0.4728,0.0914,0.859],[0.093,0.1637,-0.4407,0.0774,0.8792],[0.107,0.1521,-0.4043,0.063,0.8997],[0.12,0.1391,-0.3636,0.0488,0.9198],[0.133,0.125,-0.319,0.0354,0.9388],[0.147,0.1096,-0.2704,0.0231,0.9562],[0.16,0.0931,-0.2181,0.0125,0.9714],[0.173,0.0756,-0.162,0.0041,0.9839],[0.187,0.0569,-0.102,-0.0016,0.9932],[0.2,0.0374,-0.038,-0.0047,0.9986],[0.213,0.0186,0.0312,-0.0077,0.9993],[0.227,0.0026,0.1064,-0.014,0.9942],[0.24,-0.0088,0.1886,-0.027,0.9816],[0.253,-0.0131,0.2781,-0.0503,0.9591],[0.267,-0.0091,0.3728,-0.0884,0.9237],[0.28,0.0014,0.4634,-0.1375,0.8754],[0.293,0.0155,0.5404,-0.1875,0.8201],[0.307,0.0304,0.5981,-0.2299,0.7672],[0.32,0.0439,0.635,-0.2585,0.7267],[0.333,0.0543,0.6513,-0.2686,0.7076],[0.347,0.0621,0.657,-0.2673,0.7022],[0.36,0.0689,0.6621,-0.2648,0.6977],[0.373,0.0746,0.6667,-0.2613,0.694],[0.387,0.0796,0.6707,-0.257,0.6912],[0.4,0.0837,0.6743,-0.2521,0.689],[0.413,0.0871,0.6774,-0.2468,0.6875],[0.427,0.0898,0.6801,-0.2412,0.6864],[0.44,0.092,0.6824,-0.2356,0.6858],[0.453,0.0937,0.6844,-0.2301,0.6855],[0.467,0.0949,0.6859,-0.2249,0.6855],[0.48,0.0957,0.6872,-0.2202,0.6857],[0.493,0.0963,0.6881,-0.2162,0.6859],[0.507,0.0966,0.6887,-0.2131,0.6862],[0.52,0.0967,0.6891,-0.2111,0.6865],[0.533,0.0967,0.6892,-0.2104,0.6866]]},"armL":{"q":[[0,-0.8229,-0.5249,-0.0277,0.2157],[0.013,-0.8072,-0.5506,-0.0568,0.2052],[0.027,-0.7878,-0.5783,-0.0885,0.1929],[0.04,-0.7666,-0.6043,-0.1182,0.1819],[0.053,-0.7464,-0.6262,-0.142,0.175],[0.067,-0.7298,-0.642,-0.1566,0.1754],[0.08,-0.7196,-0.65,-0.1581,0.1865],[0.093,-0.7177,-0.6477,-0.1427,0.2121],[0.107,-0.723,-0.6334,-0.1091,0.2532],[0.12,-0.7322,-0.6038,-0.0565,0.31],[0.133,-0.7403,-0.5537,0.0157,0.3811],[0.147,-0.7399,-0.4789,0.1046,0.4608],[0.16,-0.7242,-0.3805,0.2013,0.5388],[0.173,-0.6919,-0.2688,0.2919,0.6032],[0.187,-0.6503,-0.1606,0.3632,0.6476],[0.2,-0.6106,-0.0698,0.4104,0.6737],[0.213,-0.5791,0.0015,0.4385,0.6873],[0.227,-0.5573,0.0559,0.454,0.6929],[0.24,-0.5448,0.0967,0.4619,0.6932],[0.253,-0.5402,0.1269,0.4659,0.6892],[0.267,-0.5417,0.149,0.4685,0.6818],[0.28,-0.5477,0.1641,0.4701,0.6724],[0.293,-0.5567,0.1733,0.4703,0.6624],[0.307,-0.5677,0.1774,0.469,0.6529],[0.32,-0.5796,0.1769,0.466,0.6447],[0.333,-0.5917,0.1724,0.4609,0.6385],[0.347,-0.6033,0.1644,0.4537,0.6349],[0.36,-0.6137,0.1549,0.446,0.6329],[0.373,-0.622,0.1457,0.4393,0.6316],[0.387,-0.6285,0.1372,0.4338,0.6309],[0.4,-0.6332,0.1295,0.4295,0.6307],[0.413,-0.6366,0.1225,0.4262,0.631],[0.427,-0.6387,0.1162,0.4238,0.6316],[0.44,-0.6399,0.1107,0.4222,0.6325],[0.453,-0.6402,0.1058,0.4213,0.6336],[0.467,-0.6399,0.1018,0.4208,0.6348],[0.48,-0.6393,0.0984,0.4208,0.6361],[0.493,-0.6384,0.0958,0.421,0.6372],[0.507,-0.6376,0.0939,0.4213,0.6381],[0.52,-0.6369,0.0928,0.4216,0.6388],[0.533,-0.6367,0.0924,0.4217,0.639]],"p":[[0,-0.1752,-0.2017,0.2786],[0.013,-0.2073,-0.2207,0.3045],[0.027,-0.2417,-0.2409,0.3328],[0.04,-0.2737,-0.2604,0.3582],[0.053,-0.2991,-0.278,0.3744],[0.067,-0.3137,-0.2927,0.3747],[0.08,-0.3133,-0.3038,0.3524],[0.093,-0.2954,-0.3107,0.3038],[0.107,-0.2638,-0.3139,0.2352],[0.12,-0.2233,-0.3139,0.1565],[0.133,-0.1775,-0.311,0.0775],[0.147,-0.1284,-0.3056,0.0062],[0.16,-0.0779,-0.2991,-0.0542],[0.173,-0.0313,-0.2935,-0.105],[0.187,0.0011,-0.2906,-0.1459],[0.2,0.0094,-0.2908,-0.1723],[0.213,-0.0041,-0.2924,-0.184],[0.227,-0.0321,-0.2936,-0.184],[0.24,-0.0669,-0.2928,-0.1763],[0.253,-0.1001,-0.2885,-0.1665],[0.267,-0.1254,-0.2802,-0.1595],[0.28,-0.1426,-0.2688,-0.1555],[0.293,-0.153,-0.2557,-0.1533],[0.307,-0.1581,-0.2423,-0.1518],[0.32,-0.1593,-0.2301,-0.1502],[0.333,-0.158,-0.2204,-0.1472],[0.347,-0.1554,-0.214,-0.1422],[0.36,-0.1522,-0.21,-0.1366],[0.373,-0.1487,-0.2072,-0.1314],[0.387,-0.145,-0.2052,-0.127],[0.4,-0.1413,-0.2038,-0.1231],[0.413,-0.1375,-0.2031,-0.1198],[0.427,-0.1339,-0.2029,-0.117],[0.44,-0.1304,-0.203,-0.1146],[0.453,-0.1271,-0.2035,-0.1126],[0.467,-0.1241,-0.2041,-0.111],[0.48,-0.1215,-0.2049,-0.1098],[0.493,-0.1193,-0.2056,-0.1089],[0.507,-0.1177,-0.2063,-0.1082],[0.52,-0.1167,-0.2067,-0.1079],[0.533,-0.1163,-0.2069,-0.1078]]},"armR":{"q":[[0,-0.4756,0.1484,0.6506,0.5732],[0.013,-0.4932,0.1741,0.6338,0.5698],[0.027,-0.5161,0.2065,0.6119,0.5626],[0.04,-0.5442,0.2451,0.5846,0.5496],[0.053,-0.5772,0.2889,0.5514,0.5284],[0.067,-0.6142,0.3369,0.5122,0.4969],[0.08,-0.654,0.387,0.4667,0.4524],[0.093,-0.6946,0.4368,0.4152,0.3928],[0.107,-0.7332,0.4831,0.3586,0.3171],[0.12,-0.7666,0.522,0.2985,0.2253],[0.133,-0.7917,0.5499,0.2375,0.1199],[0.147,-0.8063,0.5639,0.1782,0.009],[0.16,-0.8123,0.5642,0.1208,-0.0854],[0.173,-0.8169,0.5544,0.0631,-0.1459],[0.187,-0.8281,0.5375,-0.001,-0.1593],[0.2,-0.8481,0.5116,-0.0804,-0.1125],[0.213,-0.8638,0.4709,-0.1791,-0.0043],[0.227,-0.85,0.4073,-0.2929,0.1606],[0.24,-0.7777,0.3189,-0.4047,0.3601],[0.253,-0.6386,0.2199,-0.4903,0.5509],[0.267,-0.4542,0.1319,-0.5381,0.6977],[0.28,-0.256,0.0612,-0.5514,0.7916],[0.293,-0.0727,0.0073,-0.5403,0.8383],[0.307,0.0775,-0.0332,-0.5177,0.8514],[0.32,0.1871,-0.0652,-0.4949,0.8461],[0.333,0.254,-0.0943,-0.4801,0.8344],[0.347,0.2807,-0.1242,-0.4773,0.8234],[0.36,0.2856,-0.1522,-0.4807,0.815],[0.373,0.2853,-0.1736,-0.4837,0.809],[0.387,0.2835,-0.188,-0.485,0.8057],[0.4,0.2806,-0.1963,-0.485,0.8047],[0.413,0.2769,-0.1993,-0.4839,0.8059],[0.427,0.2725,-0.198,-0.4821,0.8088],[0.44,0.2677,-0.1933,-0.4797,0.8129],[0.453,0.2628,-0.1862,-0.4769,0.8178],[0.467,0.2579,-0.1775,-0.4739,0.823],[0.48,0.2534,-0.1684,-0.4709,0.8281],[0.493,0.2494,-0.1596,-0.4681,0.8326],[0.507,0.2463,-0.1522,-0.4658,0.8362],[0.52,0.2442,-0.147,-0.4642,0.8386],[0.533,0.2434,-0.1451,-0.4636,0.8395]],"p":[[0,0.2527,0.1123,0.1896],[0.013,0.2734,0.0674,0.1902],[0.027,0.2992,0.0167,0.1895],[0.04,0.3287,-0.0366,0.1874],[0.053,0.3602,-0.0889,0.1842],[0.067,0.3925,-0.1364,0.1804],[0.08,0.4241,-0.1747,0.177],[0.093,0.4538,-0.1988,0.1748],[0.107,0.4807,-0.2025,0.1745],[0.12,0.5042,-0.1789,0.1756],[0.133,0.5238,-0.1209,0.1761],[0.147,0.5375,-0.0277,0.1754],[0.16,0.536,0.0778,0.184],[0.173,0.5074,0.1645,0.2172],[0.187,0.4392,0.2007,0.2934],[0.2,0.3308,0.1719,0.4216],[0.213,0.2317,0.1283,0.5594],[0.227,0.1837,0.1152,0.655],[0.24,0.1548,0.1077,0.6822],[0.253,0.1057,0.0725,0.6178],[0.267,0.0176,0.0009,0.4603],[0.28,-0.0731,-0.0772,0.2554],[0.293,-0.1238,-0.1326,0.0623],[0.307,-0.1099,-0.152,-0.0739],[0.32,-0.0608,-0.148,-0.1534],[0.333,-0.017,-0.1382,-0.1906],[0.347,-0.0075,-0.1349,-0.2007],[0.36,-0.0187,-0.1364,-0.1983],[0.373,-0.0301,-0.1382,-0.1942],[0.387,-0.0377,-0.1396,-0.1905],[0.4,-0.042,-0.1407,-0.1873],[0.413,-0.0435,-0.1415,-0.1844],[0.427,-0.0426,-0.142,-0.1819],[0.44,-0.0399,-0.1424,-0.1797],[0.453,-0.0359,-0.1427,-0.1779],[0.467,-0.0311,-0.1427,-0.1765],[0.48,-0.026,-0.1427,-0.1754],[0.493,-0.0211,-0.1426,-0.1747],[0.507,-0.017,-0.1425,-0.1742],[0.52,-0.0142,-0.1424,-0.1739],[0.533,-0.0132,-0.1423,-0.1739]]},"legL":{"q":[[0,0.0193,-0.245,0.3473,0.905],[0.013,0.0498,-0.2253,0.3309,0.915],[0.027,0.0861,-0.2016,0.3171,0.9227],[0.04,0.1269,-0.1738,0.305,0.9277],[0.053,0.1703,-0.141,0.2944,0.9297],[0.067,0.2137,-0.1027,0.285,0.9287],[0.08,0.2537,-0.0584,0.2764,0.9251],[0.093,0.2875,-0.0082,0.2674,0.9197],[0.107,0.3144,0.0473,0.2561,0.9128],[0.12,0.3375,0.1079,0.2395,0.9039],[0.133,0.3589,0.1724,0.2144,0.8919],[0.147,0.3801,0.2387,0.1782,0.8757],[0.16,0.4013,0.3037,0.1289,0.8545],[0.173,0.422,0.364,0.066,0.8277],[0.187,0.4394,0.4161,-0.0094,0.796],[0.2,0.4497,0.4495,-0.0915,0.7664],[0.213,0.4391,0.4611,-0.1627,0.7538],[0.227,0.3809,0.4682,-0.2103,0.7691],[0.24,0.255,0.4823,-0.2431,0.802],[0.253,0.0834,0.492,-0.2514,0.8294],[0.267,-0.0824,0.49,-0.2071,0.8428],[0.28,-0.2005,0.4839,-0.1149,0.8441],[0.293,-0.2602,0.4824,-0.007,0.8364],[0.307,-0.2738,0.49,0.0879,0.8229],[0.32,-0.2588,0.5097,0.1537,0.806],[0.333,-0.2292,0.5448,0.1831,0.7856],[0.347,-0.1988,0.5823,0.1904,0.7649],[0.36,-0.1745,0.6097,0.194,0.7485],[0.373,-0.1555,0.6302,0.1959,0.735],[0.387,-0.1414,0.6454,0.1965,0.7245],[0.4,-0.1316,0.656,0.1963,0.7168],[0.413,-0.1257,0.663,0.1953,0.7117],[0.427,-0.1231,0.667,0.1937,0.7088],[0.44,-0.1231,0.6684,0.1919,0.708],[0.453,-0.1251,0.668,0.1899,0.7086],[0.467,-0.1285,0.6661,0.1878,0.7103],[0.48,-0.1327,0.6633,0.1858,0.7127],[0.493,-0.137,0.6601,0.184,0.7153],[0.507,-0.1409,0.6571,0.1826,0.7176],[0.52,-0.1436,0.6549,0.1816,0.7194],[0.533,-0.1447,0.654,0.1813,0.72]],"p":[[0,-0.079,0.2182,0.3122],[0.013,-0.0625,0.1853,0.2933],[0.027,-0.0504,0.1554,0.2743],[0.04,-0.0416,0.1302,0.2587],[0.053,-0.0347,0.1098,0.2495],[0.067,-0.0289,0.0933,0.2482],[0.08,-0.0234,0.0805,0.2552],[0.093,-0.0177,0.072,0.2695],[0.107,-0.0112,0.0689,0.2877],[0.12,-0.0017,0.0706,0.3087],[0.133,0.0126,0.0759,0.3288],[0.147,0.0329,0.0832,0.3432],[0.16,0.0594,0.0899,0.3473],[0.173,0.0908,0.0928,0.3377],[0.187,0.1244,0.0895,0.3128],[0.2,0.1526,0.078,0.2826],[0.213,0.1667,0.0784,0.2639],[0.227,0.1657,0.1281,0.2402],[0.24,0.1533,0.2143,0.1605],[0.253,0.1261,0.2789,0.0329],[0.267,0.0837,0.3097,-0.0811],[0.28,0.0359,0.3247,-0.1528],[0.293,-0.0068,0.3322,-0.189],[0.307,-0.0398,0.3347,-0.2063],[0.32,-0.0631,0.3368,-0.2175],[0.333,-0.0787,0.3446,-0.2298],[0.347,-0.0887,0.3548,-0.241],[0.36,-0.0952,0.362,-0.248],[0.373,-0.0996,0.3671,-0.2526],[0.387,-0.1024,0.3704,-0.2559],[0.4,-0.1039,0.3724,-0.2582],[0.413,-0.1043,0.3731,-0.2599],[0.427,-0.1038,0.3728,-0.2611],[0.44,-0.1027,0.3717,-0.2619],[0.453,-0.101,0.3701,-0.2622],[0.467,-0.0991,0.3681,-0.2622],[0.48,-0.0971,0.3661,-0.2619],[0.493,-0.0951,0.3642,-0.2614],[0.507,-0.0935,0.3625,-0.2608],[0.52,-0.0923,0.3614,-0.2603],[0.533,-0.0919,0.361,-0.2601]]},"legR":{"q":[[0,0.2201,-0.3374,-0.0218,0.915],[0.013,0.2253,-0.3087,-0.0473,0.9229],[0.027,0.2341,-0.2744,-0.07,0.9301],[0.04,0.2441,-0.2364,-0.089,0.9363],[0.053,0.2519,-0.1969,-0.1043,0.9418],[0.067,0.2548,-0.1583,-0.1162,0.9468],[0.08,0.2498,-0.1226,-0.1259,0.9522],[0.093,0.2343,-0.0915,-0.1349,0.9584],[0.107,0.2086,-0.0652,-0.1447,0.965],[0.12,0.1731,-0.043,-0.156,0.9715],[0.133,0.1282,-0.0241,-0.1685,0.977],[0.147,0.0744,-0.0074,-0.1807,0.9807],[0.16,0.0129,0.0078,-0.19,0.9817],[0.173,-0.0534,0.0224,-0.1922,0.9796],[0.187,-0.1198,0.0371,-0.1828,0.9751],[0.2,-0.1672,0.0477,-0.1534,0.9727],[0.213,-0.1765,0.052,-0.1078,0.977],[0.227,-0.1466,0.0521,-0.0627,0.9858],[0.24,-0.0862,0.0511,-0.0318,0.9945],[0.253,-0.0132,0.0533,-0.0159,0.9984],[0.267,0.0499,0.0625,-0.0026,0.9968],[0.28,0.0796,0.0769,0.01,0.9938],[0.293,0.0729,0.0919,0.0016,0.9931],[0.307,0.0505,0.1106,-0.0289,0.9922],[0.32,0.0304,0.1397,-0.0618,0.9878],[0.333,0.0269,0.1835,-0.0814,0.9793],[0.347,0.0345,0.2283,-0.0921,0.9686],[0.36,0.0397,0.2615,-0.1014,0.959],[0.373,0.0415,0.2866,-0.1089,0.9509],[0.387,0.0403,0.3053,-0.1143,0.9445],[0.4,0.0367,0.3184,-0.1178,0.9399],[0.413,0.0313,0.3267,-0.1198,0.937],[0.427,0.0245,0.331,-0.1205,0.9356],[0.44,0.0169,0.3321,-0.1202,0.9354],[0.453,0.0087,0.3306,-0.1191,0.9362],[0.467,0.0005,0.3272,-0.1175,0.9376],[0.48,-0.0073,0.3227,-0.1157,0.9394],[0.493,-0.0143,0.3178,-0.114,0.9412],[0.507,-0.0199,0.3133,-0.1124,0.9428],[0.52,-0.0236,0.3101,-0.1114,0.9439],[0.533,-0.025,0.3088,-0.111,0.9443]],"p":[[0,-0.1131,0.1827,0.1253],[0.013,-0.0973,0.1754,0.1363],[0.027,-0.0821,0.1635,0.1443],[0.04,-0.0681,0.1495,0.1488],[0.053,-0.0555,0.1362,0.1493],[0.067,-0.0446,0.1258,0.1473],[0.08,-0.0354,0.1203,0.1441],[0.093,-0.0278,0.1213,0.1409],[0.107,-0.0211,0.1289,0.1392],[0.12,-0.0147,0.1431,0.1395],[0.133,-0.0075,0.1631,0.1406],[0.147,0.0008,0.1875,0.1403],[0.16,0.0101,0.2135,0.1371],[0.173,0.0195,0.2381,0.1306],[0.187,0.0275,0.2578,0.1226],[0.2,0.0326,0.2711,0.1231],[0.213,0.0355,0.2797,0.1398],[0.227,0.0377,0.2826,0.1725],[0.24,0.0388,0.2761,0.2189],[0.253,0.0324,0.2554,0.2727],[0.267,0.0085,0.2212,0.322],[0.28,-0.0287,0.1893,0.3466],[0.293,-0.054,0.18,0.3443],[0.307,-0.0561,0.1891,0.3379],[0.32,-0.0433,0.2029,0.3447],[0.333,-0.0224,0.217,0.3757],[0.347,0.0011,0.2293,0.4136],[0.36,0.021,0.2384,0.4393],[0.373,0.0371,0.245,0.4555],[0.387,0.0492,0.2496,0.4648],[0.4,0.0575,0.2527,0.4686],[0.413,0.0623,0.2546,0.4683],[0.427,0.064,0.2554,0.4648],[0.44,0.0634,0.2553,0.4592],[0.453,0.061,0.2544,0.4519],[0.467,0.0574,0.253,0.4436],[0.48,0.0533,0.2512,0.4351],[0.493,0.0491,0.2493,0.427],[0.507,0.0456,0.2475,0.4201],[0.52,0.0431,0.2462,0.4154],[0.533,0.0421,0.2457,0.4137]]}}},"rig3_swim_idle":{"dur":2,"loop":true,"t":{"torso":{"q":[[0,0.0872,0,0,0.9962],[0.25,0.0828,0,0,0.9966],[0.5,0.128,0,0,0.9918],[0.75,0.0872,0,0,0.9962],[1,0.0882,0,0,0.9961],[1.25,0.0854,0,0,0.9963],[1.5,0.1274,0,0,0.9918],[1.75,0.0828,0,0,0.9966],[2,0.0872,0,0,0.9962]],"p":[[0,0,0.0432,0],[0.25,0,0.0566,0],[0.5,0,0.0701,0],[0.75,0,0.0836,0],[1,0,0.097,0.0001],[1.25,0,0.0836,0],[1.5,0,0.0701,0],[1.75,0,0.0566,0],[2,0,0.0432,0]]},"legL":{"q":[[0,0.0109,-0.0011,0.0065,0.9999],[0.25,-0.1199,-0.002,0.0063,0.9928],[0.5,-0.2487,-0.0028,0.006,0.9686],[0.75,-0.1199,-0.002,0.0063,0.9928],[1,0.0109,-0.0011,0.0065,0.9999],[1.25,0.152,-0.0002,0.0066,0.9884],[1.5,0.2901,0.0007,0.0065,0.957],[1.75,0.152,-0.0002,0.0066,0.9884],[2,0.0109,-0.0011,0.0065,0.9999]],"p":[[0,-0.0015,-0.0084,-0.0091],[0.25,-0.0015,-0.0084,-0.0091],[0.5,-0.0015,-0.0084,-0.0091],[0.75,-0.0015,-0.0084,-0.0091],[1,-0.0015,-0.0084,-0.0091],[1.25,-0.0015,-0.0084,-0.0091],[1.5,-0.0015,-0.0084,-0.0091],[1.75,-0.0015,-0.0084,-0.0091],[2,-0.0015,-0.0084,-0.0091]]},"armR":{"q":[[0,-0.6486,0.1745,0.1526,0.725],[0.25,-0.6357,0.1076,-0.0078,0.7644],[0.5,-0.6025,0.0372,-0.168,0.7793],[0.75,-0.5837,-0.2189,-0.3681,0.6899],[1,-0.4983,-0.4501,-0.5262,0.5217],[1.25,-0.5246,-0.4946,-0.4912,0.4888],[1.5,-0.5483,-0.5366,-0.4537,0.4533],[1.75,-0.6861,-0.2076,-0.1726,0.6755],[2,-0.6486,0.1745,0.1526,0.725]],"p":[[0,0.0549,0.0118,0.097],[0.25,0.0071,0.0136,0.1191],[0.5,-0.0407,0.0154,0.1412],[0.75,-0.0885,0.0171,0.1633],[1,-0.1363,0.0189,0.1854],[1.25,-0.1321,0.0146,0.1788],[1.5,-0.128,0.0102,0.1723],[1.75,-0.0366,0.011,0.1346],[2,0.0549,0.0118,0.097]]},"head":{"q":[[0,0.0297,0,0,0.9996],[0.25,0.0358,0,0,0.9994],[0.75,0.0481,0,0,0.9988],[1,0.0543,0,0,0.9985],[1.25,0.0481,0,0,0.9988],[1.75,0.0358,0,0,0.9994],[2,0.0297,0,0,0.9996]],"p":[[0,0,0.0408,-0.0103],[0.25,0,0.0402,-0.0109],[0.75,-0.0001,0.0386,-0.0076],[1,-0.0001,0.0378,-0.0061],[1.25,-0.0001,0.0385,-0.0077],[1.75,0,0.04,-0.0099],[2,0,0.0407,-0.012]]},"armL":{"q":[[0,-0.6248,-0.2104,-0.1056,0.7445],[0.25,-0.6093,-0.1657,0.0425,0.7743],[0.5,-0.5785,-0.1168,0.1896,0.7847],[0.75,-0.5754,0.1563,0.3747,0.71],[1,-0.5065,0.4115,0.517,0.554],[1.25,-0.5449,0.4645,0.486,0.501],[1.5,-0.579,0.5138,0.4512,0.4441],[1.75,-0.6867,0.1731,0.1971,0.678],[2,-0.6248,-0.2104,-0.1056,0.7445]],"p":[[0,-0.0281,0.0345,0.0292],[0.25,0.0095,0.0252,0.0816],[0.5,0.0471,0.0159,0.1341],[0.75,0.0816,0.0141,0.1588],[1,0.116,0.0124,0.1835],[1.25,0.125,0.0158,0.1739],[1.5,0.1341,0.0193,0.1644],[1.75,0.053,0.0269,0.0968],[2,-0.0281,0.0345,0.0292]]},"legR":{"q":[[0,0.0178,0,0,0.9998],[0.25,0.1373,0,0,0.9905],[0.5,0.2549,0,0,0.967],[0.75,0.1373,0,0,0.9905],[1,0.0178,0,0,0.9998],[1.25,-0.1139,0,0,0.9935],[1.5,-0.2437,0,0,0.9699],[1.75,-0.1139,0,0,0.9935],[2,0.0178,0,0,0.9998]],"p":[[0,0,-0.0238,0.0005],[0.25,0,-0.0238,0.0006],[0.5,0,-0.0238,0.0006],[0.75,0,-0.0238,0.0006],[1,0,-0.0238,0.0005],[1.25,0,-0.0238,0.0005],[1.5,0,-0.0238,0.0005],[1.75,0,-0.0238,0.0005],[2,0,-0.0238,0.0005]]}}},"rig3_swim":{"dur":0.667,"loop":true,"t":{"torso":{"q":[[0,0.6751,0.029,0.0265,0.7367],[0.333,0.675,-0.0322,-0.0295,0.7366],[0.667,0.6751,0.029,0.0265,0.7367]],"p":[[0,0.0151,-0.0841,0.0073],[0.333,0,0,0],[0.667,0.0151,-0.0841,0.0073]]},"legL":{"q":[[0,-0.3291,-0.0089,0.014,0.9442],[0.333,0.3387,0.0262,-0.0239,0.9402],[0.667,-0.3291,-0.0089,0.014,0.9442]]},"armR":{"q":[[0,0,-0.3007,0,0.9537],[0.333,-0.1656,-0.2961,-0.0522,0.9392],[0.667,0,-0.3007,0,0.9537]]},"head":{"q":[[0,-0.5732,0.096,-0.0678,0.8109],[0.333,-0.5451,-0.0975,0.0621,0.8304],[0.667,-0.5732,0.096,-0.0678,0.8109]]},"armL":{"q":[[0,0,0.3007,0,0.9537],[0.333,-0.1738,0.2957,0.0548,0.9378],[0.667,0,0.3007,0,0.9537]]},"legR":{"q":[[0,0.3402,-0.0188,0.0158,0.94],[0.333,-0.3361,0.0172,-0.0103,0.9416],[0.667,0.3402,-0.0188,0.0158,0.94]]}}}};
  const R6_JOINTS = ['torso', 'head', 'armL', 'armR', 'legL', 'legR'];
  const mkR6Pose = () => ({
    torso: { p: [0,0,0], q: [0,0,0,1] }, head: { p: [0,0,0], q: [0,0,0,1] },
    armL:  { p: [0,0,0], q: [0,0,0,1] }, armR: { p: [0,0,0], q: [0,0,0,1] },
    legL:  { p: [0,0,0], q: [0,0,0,1] }, legR: { p: [0,0,0], q: [0,0,0,1] }
  });
  const _r6SampleBuf = mkR6Pose(), _r6IdleBuf = mkR6Pose(), _r6WalkBuf = mkR6Pose(), _r6RunBuf = mkR6Pose(), _r6AirBuf = mkR6Pose(), _r6FallBuf = mkR6Pose(), _r6ActBuf = mkR6Pose(), _r6TargetBuf = mkR6Pose(), _r6FpBuf = mkR6Pose(), _r6SwordTmp = mkR6Pose(), _r6SwimIdleBuf = mkR6Pose(), _r6SwimBuf = mkR6Pose();
  const _r6Q1 = new THREE.Quaternion(), _r6Q2 = new THREE.Quaternion();
  const _r6Eul = new THREE.Euler(0, 0, 0, 'XYZ');
  const _r6V1 = new THREE.Vector3();
  const _fpQ1 = new THREE.Quaternion(), _fpQ2 = new THREE.Quaternion();
  const _fpV1 = new THREE.Vector3(), _fpV2 = new THREE.Vector3();
  const smoothstep01 = (x) => { const u = x <= 0 ? 0 : (x >= 1 ? 1 : x); return u * u * (3 - 2 * u); };

  function slerpQ4(a, b, u, dst) {
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (dot < 0) { dot = -dot; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (dot > 0.9995) {
      const rx = a[0] + (bx - a[0]) * u, ry = a[1] + (by - a[1]) * u, rz = a[2] + (bz - a[2]) * u, rw = a[3] + (bw - a[3]) * u;
      const len = Math.hypot(rx, ry, rz, rw) || 1;
      dst[0] = rx / len; dst[1] = ry / len; dst[2] = rz / len; dst[3] = rw / len;
      return;
    }
    const th = Math.acos(Math.min(1, dot)), sinTh = Math.sin(th) || 1e-6;
    const w0 = Math.sin((1 - u) * th) / sinTh, w1 = Math.sin(u * th) / sinTh;
    dst[0] = a[0] * w0 + bx * w1; dst[1] = a[1] * w0 + by * w1; dst[2] = a[2] * w0 + bz * w1; dst[3] = a[3] * w0 + bw * w1;
  }

  function slerpKeyframe(ka, kb, u, dst) {
    let bx = kb[1], by = kb[2], bz = kb[3], bw = kb[4];
    let dot = ka[1] * bx + ka[2] * by + ka[3] * bz + ka[4] * bw;
    if (dot < 0) { dot = -dot; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (dot > 0.9995) {
      const rx = ka[1] + (bx - ka[1]) * u, ry = ka[2] + (by - ka[2]) * u, rz = ka[3] + (bz - ka[3]) * u, rw = ka[4] + (bw - ka[4]) * u;
      const len = Math.hypot(rx, ry, rz, rw) || 1;
      dst[0] = rx / len; dst[1] = ry / len; dst[2] = rz / len; dst[3] = rw / len;
      return;
    }
    const th = Math.acos(Math.min(1, dot)), sinTh = Math.sin(th) || 1e-6;
    const w0 = Math.sin((1 - u) * th) / sinTh, w1 = Math.sin(u * th) / sinTh;
    dst[0] = ka[1] * w0 + bx * w1; dst[1] = ka[2] * w0 + by * w1; dst[2] = ka[3] * w0 + bz * w1; dst[3] = ka[4] * w0 + bw * w1;
  }

  function resetR6Pose(pose) {
    for (let i = 0; i < R6_JOINTS.length; i++) {
      const jt = pose[R6_JOINTS[i]];
      jt.p[0] = 0; jt.p[1] = 0; jt.p[2] = 0;
      jt.q[0] = 0; jt.q[1] = 0; jt.q[2] = 0; jt.q[3] = 1;
    }
  }
  function copyR6Pose(dst, src) {
    for (let i = 0; i < R6_JOINTS.length; i++) {
      const k = R6_JOINTS[i], d = dst[k], s = src[k];
      d.p[0] = s.p[0]; d.p[1] = s.p[1]; d.p[2] = s.p[2];
      d.q[0] = s.q[0]; d.q[1] = s.q[1]; d.q[2] = s.q[2]; d.q[3] = s.q[3];
    }
  }
  function blendR6Pose(dst, src, w) {
    if (w <= 0.0001) return;
    if (w >= 0.9999) { copyR6Pose(dst, src); return; }
    for (let i = 0; i < R6_JOINTS.length; i++) {
      const k = R6_JOINTS[i], d = dst[k], s = src[k];
      d.p[0] += (s.p[0] - d.p[0]) * w; d.p[1] += (s.p[1] - d.p[1]) * w; d.p[2] += (s.p[2] - d.p[2]) * w;
      slerpQ4(d.q, s.q, w, d.q);
    }
  }

  function sampleTrack(pts, t, dur, loop, isQuat, dst) {
    if (!pts || !pts.length) {
      dst[0] = 0; dst[1] = 0; dst[2] = 0;
      if (isQuat) dst[3] = 1;
      return;
    }
    if (pts.length === 1) {
      const k = pts[0];
      dst[0] = k[1]; dst[1] = k[2]; dst[2] = k[3];
      if (isQuat) dst[3] = k[4];
      return;
    }
    const first = pts[0], last = pts[pts.length - 1];
    if (loop && (t < first[0] || t > last[0])) {
      const span = Math.max(1e-5, (dur - last[0]) + first[0]);
      const el = (t >= last[0]) ? (t - last[0]) : ((dur - last[0]) + t);
      const u = Math.max(0, Math.min(1, el / span));
      if (isQuat) { slerpKeyframe(last, first, u, dst); return; }
      dst[0] = last[1] + (first[1] - last[1]) * u;
      dst[1] = last[2] + (first[2] - last[2]) * u;
      dst[2] = last[3] + (first[3] - last[3]) * u;
      return;
    }
    if (t <= first[0]) {
      dst[0] = first[1]; dst[1] = first[2]; dst[2] = first[3];
      if (isQuat) dst[3] = first[4];
      return;
    }
    if (t >= last[0]) {
      dst[0] = last[1]; dst[1] = last[2]; dst[2] = last[3];
      if (isQuat) dst[3] = last[4];
      return;
    }
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid][0] <= t) lo = mid; else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const u = (b[0] > a[0]) ? (t - a[0]) / (b[0] - a[0]) : 0;
    if (isQuat) { slerpKeyframe(a, b, u, dst); return; }
    dst[0] = a[1] + (b[1] - a[1]) * u;
    dst[1] = a[2] + (b[2] - a[2]) * u;
    dst[2] = a[3] + (b[3] - a[3]) * u;
  }

  function sampleR6Clip(clipName, timeSec, out = _r6SampleBuf) {
    const clip = ROBLOX_R6_ANIMS && ROBLOX_R6_ANIMS[clipName];
    if (!clip || !clip.t) return false;
    const dur = clip.dur || 1;
    const t = clip.loop ? (((timeSec % dur) + dur) % dur) : Math.max(0, Math.min(dur, timeSec));
    const tr = clip.t;
    for (let i = 0; i < R6_JOINTS.length; i++) {
      const k = R6_JOINTS[i], jt = tr[k], dst = out[k];
      sampleTrack(jt && jt.p, t, dur, !!clip.loop, false, dst.p);
      sampleTrack(jt && jt.q, t, dur, !!clip.loop, true, dst.q);
    }
    return true;
  }

  // Authentic Roblox R6 Motor6D Quaternion SLERP Animator (Idle3, walk, run, sit, Jump, Fall, Land!)
  function animatePlayerRig(rig, st, dt, tNow) {
    const speed = st.speed || 0;
    const moving = speed > 0.14;
    const swimMoving = (st.swimMoving !== undefined) ? !!st.swimMoving : moving;
    const sprinting = !!st.sprinting && moving;
    const sneaking = !!st.sneaking;
    const inWater = !!st.inWater;
    const swimming = inWater && !!st.deepWater;
    const sprintSwim = !!(st.sprintSwimming || (swimming && swimMoving && sprinting));
    const lowSprintSwim = !!st.lowSprintSwim;
    const flying = !!st.flying;
    const blocking = !!st.blocking;
    const sitting = !!st.sitting && !swimming && !flying;
    const climbing = !!st.climbing;
    const hurtT = st.hurtT || 0;
    const onGround = !!st.onGround;
    const airborne = !onGround && !inWater && !flying && !climbing && !sitting;
    const vy = st.vy || 0;
    const swing = st.swing || 0;
    const strafe = st.strafe || 0;
    const jumpPop = st.jumpPop || 0;
    const combo = st.comboStep || 0;
    const toolKind = st.toolKind || '';
    const heldId = st.heldId !== undefined ? st.heldId : (rig.heldItemId || 0);
    const isBow = (heldId === B.BOW || toolKind === 'bow');
    const _heldDefR6 = (heldId && BLOCK_DEF[heldId]) ? BLOCK_DEF[heldId] : null;
    const isSword = (toolKind === 'sword') || !!(_heldDefR6 && _heldDefR6.tool === 'sword');
    const dtClamped = Math.max(0, Math.min(dt || 0.016, 0.05));

    if (!rig._r6CurPose) {
      rig._r6CurPose = mkR6Pose();
      rig._r6FadeFrom = mkR6Pose();
      rig._r6SwordPrev = mkR6Pose();
      rig._r6XfadeT = 0; rig._r6XfadeDur = 0; rig._r6StateKey = '';
      rig._r6SwordSeq = 0; rig._r6SwordHit = 0; rig._r6SwordT = 0; rig._r6SwordDur = 0;
      rig._r6SwordActive = false; rig._r6SwordXfadeT = 0; rig._r6SwordXfadeDur = 0;
    }

    const stateKey = flying ? 'fly' : (swimming ? 'swim' : (climbing ? 'climb' : 'ground'));
    if (rig._r6Init && rig._r6StateKey && rig._r6StateKey !== stateKey) {
      copyR6Pose(rig._r6FadeFrom, rig._r6CurPose);
      rig._r6XfadeT = 0;
      rig._r6XfadeDur = 0.16;
    }
    rig._r6StateKey = stateKey;

    rig.moveBlend = (rig.moveBlend || 0) + ((moving ? 1 : 0) - (rig.moveBlend || 0)) * Math.min(1, dtClamped * 14.0);
    rig.sprintBlend = (rig.sprintBlend || 0) + ((sprinting ? 1 : 0) - (rig.sprintBlend || 0)) * Math.min(1, dtClamped * 11.0);
    rig.airBlend = (rig.airBlend || 0) + ((airborne ? 1 : 0) - (rig.airBlend || 0)) * Math.min(1, dtClamped * 15.0);
    rig.sitBlend = (rig.sitBlend || 0) + ((sitting ? 1 : 0) - (rig.sitBlend || 0)) * Math.min(1, dtClamped * 12.0);
    const _wantSwim = (swimming && !flying && !climbing) ? 1 : 0;
    rig.swimBlend = (rig.swimBlend || 0) + (_wantSwim - (rig.swimBlend || 0)) * Math.min(1, dtClamped * 9.0);
    rig.swimCrawlBlend = (rig.swimCrawlBlend || 0) + (((_wantSwim && swimMoving) ? 1 : 0) - (rig.swimCrawlBlend || 0)) * Math.min(1, dtClamped * 8.5);
    rig.swimSprintBlend = (rig.swimSprintBlend || 0) + (((_wantSwim && sprintSwim) ? 1 : 0) - (rig.swimSprintBlend || 0)) * Math.min(1, dtClamped * 7.5);
    const _keepMineBlend = !!(st.isLocal && typeof mining !== 'undefined' && mining && mining.swinging);
    const _wantAct = (!rig._r6SwordActive && !(isSword && (st.swordAtkSeq || 0) > 0) && (st.swingActive || swing > 0.01 || _keepMineBlend)) ? 1 : 0;
    rig.actionBlend = (rig.actionBlend || 0) + (_wantAct - (rig.actionBlend || 0)) * Math.min(1, dtClamped * (_wantAct ? 26.0 : 14.0));
    const mB = rig.moveBlend, sB = rig.sprintBlend;
    if ((st.swingActive || swing > 0.01) && st.actionType) rig.lastActionType = st.actionType;

    // Exact custom Jump / Fall / Land state timers (Land only on >= 8-block drops; 7.95 tolerates 0.02 ground snap)
    const wasAir = !!rig.wasAirborne;
    const rigY = rig.g ? rig.g.position.y : 0;
    if (airborne) {
      if (!wasAir) {
        rig.r6AirT = 0;
        rig.r6Jumped = (vy > 0.5 || jumpPop > 0.05);
        rig.r6AirPeakY = rigY;
      } else {
        rig.r6AirT = (rig.r6AirT || 0) + dtClamped;
        if (rigY > (rig.r6AirPeakY ?? rigY)) rig.r6AirPeakY = rigY;
      }
      rig.r6LandT = 0;
    } else {
      if (st.landAnimT !== undefined) {
        rig.r6LandT = st.landAnimT;
      } else if (wasAir && onGround && !inWater && !flying && !sitting && ((rig.r6AirPeakY ?? rigY) - rigY) >= 7.95) {
        rig.r6LandT = 0.001;
      } else if ((rig.r6LandT || 0) > 0) {
        rig.r6LandT += dtClamped;
        if (rig.r6LandT >= 0.483) rig.r6LandT = 0;
      }
      rig.r6AirT = 0;
      rig.r6Jumped = false;
      rig.r6AirPeakY = rigY;
    }
    rig.wasAirborne = airborne;

    if (moving) rig.animPhase += dtClamped * (sprinting ? 13.8 : (sneaking ? 6.8 : (inWater ? 8.8 : 9.8)));
    else rig.animPhase += dtClamped * 1.8;
    rig.r6WalkT = (rig.r6WalkT || 0) + dtClamped * Math.max(0.85, speed / 4.2);
    rig.r6RunT  = (rig.r6RunT  || 0) + dtClamped * Math.max(0.92, speed / 5.8);
    rig.r6SwimIdleT = (rig.r6SwimIdleT || 0) + dtClamped;
    rig.r6SwimT = (rig.r6SwimT || 0) + dtClamped * (lowSprintSwim ? 1.45 : (sprintSwim ? 1.22 : 1.0));

    const p = rig.animPhase;
    const rest = rig.r6Rest || {
      hipsY: 1.125, torso: [0,0,0], head: [0,0.375,0],
      armL: [0.25,0.1875,0], armR: [-0.25,0.1875,0], legL: [0.25,-0.375,0], legR: [-0.25,-0.375,0]
    };
    let hipsX = 0, hipsY = rest.hipsY, hipsRotX = 0, hipsRotY = 0, hipsRotZ = 0;
    let hipsScY = 1.0, hipsScXZ = 1.0;
    resetR6Pose(_r6TargetBuf);

    const setJointEuler = (jt, rx, ry, rz) => {
      _r6Eul.set(rx, ry, rz, 'XYZ');
      _r6Q1.setFromEuler(_r6Eul);
      jt.q[0] = _r6Q1.x; jt.q[1] = _r6Q1.y; jt.q[2] = _r6Q1.z; jt.q[3] = _r6Q1.w;
    };
    const mulJointEuler = (jt, rx, ry, rz) => {
      _r6Q1.set(jt.q[0], jt.q[1], jt.q[2], jt.q[3]);
      _r6Eul.set(rx, ry, rz, 'XYZ');
      _r6Q2.setFromEuler(_r6Eul);
      _r6Q1.multiply(_r6Q2);
      jt.q[0] = _r6Q1.x; jt.q[1] = _r6Q1.y; jt.q[2] = _r6Q1.z; jt.q[3] = _r6Q1.w;
    };

    const hasR6 = !!(ROBLOX_R6_ANIMS && ROBLOX_R6_ANIMS.rig_walk);

    if (st.gliding) {
      hipsY = rest.hipsY + 0.04;
      hipsRotX = 1.24 - Math.max(-0.48, Math.min(0.48, (st.pitch || 0) * 0.65));
      hipsRotZ = -strafe * 0.36;
      setJointEuler(_r6TargetBuf.torso, 0.12, 0, 0);
      setJointEuler(_r6TargetBuf.legL, 0.18 + Math.sin(tNow * 5.0) * 0.06, 0, 0.10);
      setJointEuler(_r6TargetBuf.legR, 0.14 - Math.sin(tNow * 5.0) * 0.06, 0, -0.10);
      setJointEuler(_r6TargetBuf.armL, 0.25, 0, 0.36);
      setJointEuler(_r6TargetBuf.armR, 0.25, 0, -0.36);
      setJointEuler(_r6TargetBuf.head, -0.65, 0, -strafe * 0.14);
    } else if (flying) {
      const spK = Math.min(1.0, speed / (SPRINT_SPEED * 1.35));
      hipsY = rest.hipsY + 0.05 + Math.sin(tNow * 3.1) * 0.065;
      hipsRotX = 0.14 + spK * 0.96;
      hipsRotZ = -strafe * 0.32;
      setJointEuler(_r6TargetBuf.torso, 0.06 + spK * 0.14, 0, 0);
      setJointEuler(_r6TargetBuf.legL, 0.16 + spK * 0.24 + Math.sin(tNow * 2.8) * 0.08, 0, 0.08);
      setJointEuler(_r6TargetBuf.legR, -0.18 * spK + 0.06 - Math.sin(tNow * 2.8) * 0.08, 0, -0.08);
      setJointEuler(_r6TargetBuf.armL, -0.26 + spK * 0.82, 0, 0.34 + spK * 0.16 + Math.sin(tNow * 3.4) * 0.06);
      setJointEuler(_r6TargetBuf.armR, -0.26 + spK * 0.82, 0, -0.34 - spK * 0.16 - Math.sin(tNow * 3.4) * 0.06);
      setJointEuler(_r6TargetBuf.head, 0, 0, -strafe * 0.16);
    } else if (climbing && hasR6 && sampleR6Clip('climb_ClimbAnim', rig.r6WalkT * 1.2)) {
      copyR6Pose(_r6TargetBuf, _r6SampleBuf);
    } else if (hasR6) {
      // Smooth ground base (idle3 <-> walk <-> run crossfade)
      sampleR6Clip('rig_idle3', tNow, _r6IdleBuf);
      copyR6Pose(_r6TargetBuf, _r6IdleBuf);
      if (mB > 0.015) {
        sampleR6Clip('rig_walk', rig.r6WalkT, _r6WalkBuf);
        sampleR6Clip('rig_run',  rig.r6RunT,  _r6RunBuf);
        blendR6Pose(_r6WalkBuf, _r6RunBuf, sB);
        blendR6Pose(_r6TargetBuf, _r6WalkBuf, mB);
        hipsRotZ -= strafe * (0.08 + 0.06 * sB) * (1 - rig.airBlend * 0.6);
      }
      // Smooth airborne Jump -> Fall crossfade blended cleanly onto Ground!
      if (airborne || rig.airBlend > 0.015) {
        const wantFall = (!rig.r6Jumped || vy < 1.2 || rig.r6AirT >= 0.22) ? 1 : 0;
        rig.fallBlend = airborne ? ((rig.fallBlend || 0) + (wantFall - (rig.fallBlend || 0)) * Math.min(1, dtClamped * 12.0)) : (rig.fallBlend || 0);
        sampleR6Clip('rig_jump', rig.r6AirT, _r6AirBuf);
        sampleR6Clip('rig_fall', rig.r6AirT, _r6FallBuf);
        blendR6Pose(_r6AirBuf, _r6FallBuf, rig.fallBlend);
        mulJointEuler(_r6AirBuf.head, 0, 0, -strafe * 0.14);
        blendR6Pose(_r6TargetBuf, _r6AirBuf, rig.airBlend);
      } else {
        rig.fallBlend = 0;
      }
      // Smooth Sitting transition (anchor hips & legs flush onto ground block surface!)
      if ((sitting || rig.sitBlend > 0.015) && sampleR6Clip('rig_sit', tNow, _r6SampleBuf)) {
        blendR6Pose(_r6TargetBuf, _r6SampleBuf, rig.sitBlend);
        const sitB = rig.sitBlend;
        hipsY -= 0.068 * sitB;
        mulJointEuler(_r6TargetBuf.legL, -0.065 * sitB, 0, 0);
        mulJointEuler(_r6TargetBuf.legR, -0.065 * sitB, 0, 0);
      }
      const snTarget = (sneaking && !swimming) ? 1 : 0;
      rig.sneakBlend = (rig.sneakBlend || 0) + (snTarget - (rig.sneakBlend || 0)) * Math.min(1, dtClamped * 16.0);
      if (rig.sneakBlend > 0.005) {
        const snB = rig.sneakBlend;
        hipsY -= 0.24 * snB;
        mulJointEuler(_r6TargetBuf.torso, 0.44 * snB, 0, 0);
        mulJointEuler(_r6TargetBuf.head, -0.34 * snB, 0, 0);
        mulJointEuler(_r6TargetBuf.legL, -0.38 * snB, 0, 0);
        mulJointEuler(_r6TargetBuf.legR, -0.38 * snB, 0, 0);
        _r6TargetBuf.legL.p[1] = (_r6TargetBuf.legL.p[1] || 0) + 0.14 * snB;
        _r6TargetBuf.legR.p[1] = (_r6TargetBuf.legR.p[1] || 0) + 0.14 * snB;
        _r6TargetBuf.legL.p[2] = (_r6TargetBuf.legL.p[2] || 0) + 0.11 * snB;
        _r6TargetBuf.legR.p[2] = (_r6TargetBuf.legR.p[2] || 0) + 0.11 * snB;
      }
    }

    if (!flying && (rig.swimBlend || 0) > 0.008) {
      // Exact custom Roblox Rig3 SwimIdle (standing water) & Swim (prone forward) clips
      const swB = rig.swimBlend, crB = rig.swimCrawlBlend || 0;
      if (!sampleR6Clip('rig3_swim_idle', rig.r6SwimIdleT || tNow, _r6SwimIdleBuf)) {
        resetR6Pose(_r6SwimIdleBuf);
      }
      if (crB > 0.005 && sampleR6Clip('rig3_swim', rig.r6SwimT || 0, _r6SwimBuf)) {
        blendR6Pose(_r6SwimIdleBuf, _r6SwimBuf, crB);
      }
      blendR6Pose(_r6TargetBuf, _r6SwimIdleBuf, swB);
      const targetSwimHipsY = lowSprintSwim ? (rest.hipsY * (1 - crB) + 0.42 * crB) : (rest.hipsY - 0.14 * crB);
      hipsY += (targetSwimHipsY - hipsY) * swB;
      const divePitch = (st.eyesInWater && Math.abs(st.pitch || 0) > 0.22) ? Math.max(-0.35, Math.min(0.35, -(st.pitch || 0) * 0.45)) : 0;
      hipsRotX += divePitch * swB * crB;
      hipsRotZ += (-strafe * 0.14 - hipsRotZ) * swB * crB;
    }

    if (jumpPop > 0.01) { hipsScY += jumpPop * 0.08; hipsScXZ -= jumpPop * 0.04; }
    if ((rig.r6LandT || 0) > 0 && hasR6 && sampleR6Clip('rig_land', rig.r6LandT)) {
      const uL = Math.min(1, rig.r6LandT / 0.483);
      blendR6Pose(_r6TargetBuf, _r6SampleBuf, Math.sin(uL * Math.PI) * 0.85);
    }

    if (rig._r6XfadeDur > 0 && rig._r6XfadeT < rig._r6XfadeDur) {
      rig._r6XfadeT += dtClamped;
      const xu = smoothstep01(rig._r6XfadeT / rig._r6XfadeDur);
      copyR6Pose(_r6SwordTmp, rig._r6FadeFrom);
      blendR6Pose(_r6SwordTmp, _r6TargetBuf, xu);
      copyR6Pose(_r6TargetBuf, _r6SwordTmp);
    }

    // Active combat / bow / blocking overrides ONLY (anchor arm cleanly on R6 shoulder!)
    if (isBow && typeof setRigHeldItem === 'function') {
      const wantSt = (st.bowDrawing && (st.bowStage || 0) > 0) ? (st.bowStage | 0) : 0;
      const bowMeta = wantSt > 0
        ? (st.heldEnch ? { bowStage: wantSt, ench: true } : { bowStage: wantSt })
        : (st.heldEnch ? { ench: true } : null);
      setRigHeldItem(rig, heldId, bowMeta);
    }
    const wantBowAim = !!(isBow && st.bowDrawing && !swimming && !flying);
    const bowAimRate = rig._r6Init ? (1 - Math.exp(-18.0 * dtClamped)) : 1.0;
    rig._bowAimT = (rig._bowAimT || 0) + ((wantBowAim ? 1 : 0) - (rig._bowAimT || 0)) * bowAimRate;
    if (isBow && rig.bowGrip) _applyRigBowGripPose(rig.bowGrip, rig._bowAimT);
    if (!swimming && !flying && isBow) {
      if (st.bowDrawing) {
        const bCh = Math.max(0.05, Math.min(1, st.bowCharge || 0.25));
        const pitchOff = Math.max(-1.05, Math.min(1.05, (st.pitch || 0) * 0.85));
        // Both arms extended forward & slightly angled inward symmetrically while aiming/drawing bow
        setJointEuler(_r6TargetBuf.armR, -1.52 - pitchOff, 0.0, 0.34 + bCh * 0.06);
        _r6TargetBuf.armR.p[0] = 0; _r6TargetBuf.armR.p[1] = 0; _r6TargetBuf.armR.p[2] = 0;
        if (!blocking) {
          setJointEuler(_r6TargetBuf.armL, -1.48 - pitchOff * 0.92, 0.0, -0.58 - bCh * 0.22);
          _r6TargetBuf.armL.p[0] = 0; _r6TargetBuf.armL.p[1] = 0; _r6TargetBuf.armL.p[2] = -bCh * 0.08;
        }
        mulJointEuler(_r6TargetBuf.torso, 0, 0.06, 0);
      } else if (swing <= 0.01) {
        // Natural relaxed right-arm idle pose matching blue-hoodie bow idle reference
        mulJointEuler(_r6TargetBuf.armR, -0.12, 0.0, 0.02);
      }
    }
    const bT = Math.max(0, Math.min(1, st.shieldRaiseT !== undefined ? st.shieldRaiseT : (blocking ? 1 : 0)));
    const shHand = st.shieldHand || (blocking ? 'offhand' : null);
    if (bT > 0.01 && shHand) {
      if (shHand === 'offhand') {
        _r6Q1.set(_r6TargetBuf.armL.q[0], _r6TargetBuf.armL.q[1], _r6TargetBuf.armL.q[2], _r6TargetBuf.armL.q[3]);
        _r6Eul.set(-0.74, 0, -0.42, 'XYZ');
        _r6Q2.setFromEuler(_r6Eul);
        _r6Q1.slerp(_r6Q2, bT);
        _r6TargetBuf.armL.q[0] = _r6Q1.x; _r6TargetBuf.armL.q[1] = _r6Q1.y; _r6TargetBuf.armL.q[2] = _r6Q1.z; _r6TargetBuf.armL.q[3] = _r6Q1.w;
        _r6TargetBuf.armL.p[0] *= (1 - bT); _r6TargetBuf.armL.p[1] *= (1 - bT); _r6TargetBuf.armL.p[2] *= (1 - bT);
        mulJointEuler(_r6TargetBuf.torso, 0, -0.22 * bT, 0);
      } else {
        _r6Q1.set(_r6TargetBuf.armR.q[0], _r6TargetBuf.armR.q[1], _r6TargetBuf.armR.q[2], _r6TargetBuf.armR.q[3]);
        _r6Eul.set(-0.74, 0, 0.42, 'XYZ');
        _r6Q2.setFromEuler(_r6Eul);
        _r6Q1.slerp(_r6Q2, bT);
        _r6TargetBuf.armR.q[0] = _r6Q1.x; _r6TargetBuf.armR.q[1] = _r6Q1.y; _r6TargetBuf.armR.q[2] = _r6Q1.z; _r6TargetBuf.armR.q[3] = _r6Q1.w;
        _r6TargetBuf.armR.p[0] *= (1 - bT); _r6TargetBuf.armR.p[1] *= (1 - bT); _r6TargetBuf.armR.p[2] *= (1 - bT);
        mulJointEuler(_r6TargetBuf.torso, 0, 0.22 * bT, 0);
      }
    }
    if (rig.armor && rig.armor.shield) {
      const oT = (shHand === 'offhand') ? bT : 0;
      rig.armor.shield.position.set(0.28 - oT * 0.19, -0.32 - oT * 0.13, 0.04 + oT * 0.26);
      rig.armor.shield.rotation.set(-0.04 + oT * 0.72, (Math.PI * 0.38) * (1 - oT) + 0.14 * oT, 0.04 + oT * 0.34);
    }

    const incomingSwordSeq = st.swordAtkSeq || 0;
    if (isSword && incomingSwordSeq > 0 && incomingSwordSeq !== rig._r6SwordSeq) {
      copyR6Pose(rig._r6SwordPrev, rig._r6Init ? rig._r6CurPose : _r6TargetBuf);
      const hitNum = Math.max(1, Math.min(6, st.swordAtkHit || 1));
      const swClip = ROBLOX_R6_ANIMS && ROBLOX_R6_ANIMS['rig2_sword_' + hitNum];
      rig._r6SwordSeq = incomingSwordSeq;
      rig._r6SwordHit = hitNum;
      rig._r6SwordT = Math.min(st.swordAtkT || 0, 0.12);
      rig._r6SwordDur = (swClip && swClip.dur) ? swClip.dur : 0.5;
      rig._r6SwordXfadeT = 0;
      rig._r6SwordXfadeDur = rig._r6SwordActive ? 0.075 : 0.085;
      rig._r6SwordActive = true;
    } else if (!isSword && rig._r6SwordActive) {
      rig._r6SwordT = Math.max(rig._r6SwordT, (rig._r6SwordDur || 0.5) + 0.02);
    }

    if (rig._r6SwordActive && hasR6) {
      rig._r6SwordT += dtClamped;
      const dur = rig._r6SwordDur || 0.5;
      const holdDur = (!isSword || sprinting || airborne) ? 0.04 : 0.10;
      const fadeOutDur = (!isSword || sprinting || airborne) ? 0.14 : 0.20;
      const clipKey = 'rig2_sword_' + Math.max(1, Math.min(6, rig._r6SwordHit || 1));
      let swordW = 1.0;
      if (rig._r6SwordT > dur + holdDur) {
        const uOut = (rig._r6SwordT - (dur + holdDur)) / fadeOutDur;
        if (uOut >= 1) { rig._r6SwordActive = false; swordW = 0; }
        else swordW = 1.0 - smoothstep01(uOut);
      }
      if (swordW > 0.001 && sampleR6Clip(clipKey, Math.min(rig._r6SwordT, dur), _r6ActBuf)) {
        if (rig._r6SwordXfadeDur > 0 && rig._r6SwordXfadeT < rig._r6SwordXfadeDur) {
          rig._r6SwordXfadeT += dtClamped;
          const xu = smoothstep01(rig._r6SwordXfadeT / rig._r6SwordXfadeDur);
          copyR6Pose(_r6SwordTmp, rig._r6SwordPrev);
          blendR6Pose(_r6SwordTmp, _r6ActBuf, xu);
          copyR6Pose(_r6ActBuf, _r6SwordTmp);
        }
        const legW = swordW * ((airborne || swimming || flying || sitting) ? 0.15 : (1 - mB * 0.72));
        for (let ai = 0; ai < R6_JOINTS.length; ai++) {
          const jk = R6_JOINTS[ai];
          let w = swordW;
          if (jk === 'head') w = swordW * 0.88;
          else if (jk === 'legL' || jk === 'legR') w = legW;
          else if ((jk === 'armL' && bT > 0.35 && shHand === 'offhand') || (jk === 'armR' && bT > 0.35 && shHand === 'mainhand')) w = 0;
          if (w <= 0.0001) continue;
          const d = _r6TargetBuf[jk], s = _r6ActBuf[jk];
          d.p[0] += (s.p[0] - d.p[0]) * w;
          d.p[1] += (s.p[1] - d.p[1]) * w;
          d.p[2] += (s.p[2] - d.p[2]) * w;
          slerpQ4(d.q, s.q, w, d.q);
        }
      }
    } else if ((st.swingActive || swing > 0.01 || rig.actionBlend > 0.02) && hasR6) {
      const actType = st.actionType || rig.lastActionType || (isSword ? 'attack' : 'mine');
      if (st.swingActive) rig._lastSwingU = Math.max(0, Math.min(1, st.swingU || 0));
      else if (rig.actionBlend <= 0.05) rig._lastSwingU = 0;
      const u = (rig._lastSwingU !== undefined) ? rig._lastSwingU : 0;
      const arc = (u < 0.34 ? smoothstep01(u / 0.34) : (u < 0.54 ? 1.0 - (u - 0.34) * 0.45 : Math.max(0, 1.0 - smoothstep01((u - 0.54) / 0.46)) * 0.91)) * rig.actionBlend;
      const altSign = ((st.comboStep || 0) & 1) ? -1 : 1;
      if (!(bT > 0.35 && shHand === 'mainhand') && arc > 0.001) {
        if (actType === 'attack') {
          mulJointEuler(_r6TargetBuf.armR, -arc * 1.42, arc * 0.48 * altSign, arc * 0.26 * altSign);
        } else {
          mulJointEuler(_r6TargetBuf.armR, -arc * 1.68, -arc * 0.16, arc * 0.10);
        }
      }
    }

    if (hurtT > 0.01) {
      const hPulse = Math.sin(Math.min(1, hurtT / 0.42) * Math.PI);
      if (!((rig.r6LandT || 0) > 0)) {
        hipsRotZ += hPulse * 0.05; hipsScY -= hPulse * 0.05; hipsScXZ += hPulse * 0.03;
        mulJointEuler(_r6TargetBuf.torso, -hPulse * 0.62, 0, 0);
        mulJointEuler(_r6TargetBuf.armL, hPulse * 0.58, 0, hPulse * 0.30);
        mulJointEuler(_r6TargetBuf.armR, hPulse * 0.50, 0, -hPulse * 0.30);
        mulJointEuler(_r6TargetBuf.legL, -hPulse * 0.20, 0, 0);
        mulJointEuler(_r6TargetBuf.legR, -hPulse * 0.14, 0, 0);
        mulJointEuler(_r6TargetBuf.head, 0, 0, hPulse * 0.06);
        rig._hurtLean = hPulse;
      } else {
        rig._hurtLean = 0;
      }
      if (rig.skinMat) { rig.skinMat.emissive.setHex(0xb91c1c); rig.skinMat.emissiveIntensity = hPulse * 0.85; }
    } else if (rig.skinMat && rig.skinMat.emissiveIntensity > 0) {
      rig._hurtLean = 0; rig.skinMat.emissive.setHex(0x000000); rig.skinMat.emissiveIntensity = 0;
    }

    const pitchW = 0.55 * (1 - (rig.swimBlend || 0) * (0.45 + 0.40 * (rig.swimCrawlBlend || 0)));
    const lookX = Math.max(-1.05, Math.min(1.05, -(st.pitch || 0) * pitchW - (rig._hurtLean || 0) * 0.40));
    if (Math.abs(lookX) > 1e-4) mulJointEuler(_r6TargetBuf.head, lookX, 0, 0);

    // Framerate-independent damped Motor6D quaternion SLERP + exact first-frame snap!
    copyR6Pose(rig._r6CurPose, _r6TargetBuf);
    const damp = rig._r6Init ? (1 - Math.exp(-(rig._r6SwordActive ? 34 : 26) * dtClamped)) : 1.0;
    rig._r6Init = true;
    _r6V1.set(hipsX, hipsY, 0);
    rig.hips.position.lerp(_r6V1, damp);
    _r6Eul.set(hipsRotX, hipsRotY, hipsRotZ, 'XYZ');
    _r6Q1.setFromEuler(_r6Eul);
    rig.hips.quaternion.slerp(_r6Q1, damp);
    _r6V1.set(hipsScXZ, hipsScY, hipsScXZ);
    rig.hips.scale.lerp(_r6V1, damp);

    if (rig.armor.elytra && rig.armor.elytra.visible) {
      // 3-State Zero-Gap Stepped Elytra Animation: 0 = Folded Carapace | 1 = Ready (Sneak / Midair Prep) | 2 = Full Gliding
      const readyAir = (!onGround && !st.gliding && !sitting && !inWater) || sneaking;
      const elyState = st.gliding ? 2 : (readyAir ? 1 : 0);
      if (rig.armor.elyStateObjs && rig.armor.elyStatePrev !== elyState) {
        rig.armor.elyStatePrev = elyState;
        const bKey = rig.armor.elyPhxFlag ? 'phx' : 'norm';
        const states = rig.armor.elyStateObjs[bKey];
        for (let si = 0; si < 3; si++) {
          for (const gObj of states[si]) gObj.visible = (si === elyState);
        }
      }
      const tgtSpread = elyState === 2 ? (1.12 + Math.sin(tNow * 6.5) * 0.04) : (elyState === 1 ? 0.46 : (0.10 + Math.min(0.10, speed * 0.014)));
      const tgtPitchE = elyState === 2 ? 0.05 : (elyState === 1 ? 0.32 : 0.08);
      const tgtYawE   = elyState === 2 ? 0.14 : (elyState === 1 ? 0.18 : 0.05);
      const tgtSpanX  = elyState === 2 ? 1.15 : (elyState === 1 ? 1.04 : 0.94);
      const ek = rig._r6Init ? (1 - Math.exp(-14.0 * dtClamped)) : 1.0;
      rig._elySp = (rig._elySp ?? tgtSpread) + (tgtSpread - (rig._elySp ?? tgtSpread)) * ek;
      rig._elyPt = (rig._elyPt ?? tgtPitchE) + (tgtPitchE - (rig._elyPt ?? tgtPitchE)) * ek;
      rig._elyYw = (rig._elyYw ?? tgtYawE) + (tgtYawE - (rig._elyYw ?? tgtYawE)) * ek;
      rig._elySx = (rig._elySx ?? tgtSpanX) + (tgtSpanX - (rig._elySx ?? tgtSpanX)) * ek;
      rig.armor.elytraL.rotation.set(rig._elyPt, -rig._elyYw,  rig._elySp);
      rig.armor.elytraR.rotation.set(rig._elyPt,  rig._elyYw, -rig._elySp);
      rig.armor.elytraL.scale.set(rig._elySx, 1, 1);
      rig.armor.elytraR.scale.set(rig._elySx, 1, 1);
    }
    if (rig.armor.dragonHelmet && rig.armor.dragonHelmet.visible && rig.armor.dragonHelmet.userData.jawPivot) {
      rig.armor.dragonHelmet.userData.jawPivot.rotation.x = Math.max(0, Math.sin(tNow * 4.5) * Math.min(0.28, speed * 0.04));
    }
    for (let i = 0; i < R6_JOINTS.length; i++) {
      const k = R6_JOINTS[i], jt = _r6TargetBuf[k], rPos = rest[k];
      const obj = rig[k];
      _r6V1.set(rPos[0] + jt.p[0], rPos[1] + jt.p[1], rPos[2] + jt.p[2]);
      obj.position.lerp(_r6V1, damp);
      _r6Q1.set(jt.q[0], jt.q[1], jt.q[2], jt.q[3]);
      obj.quaternion.slerp(_r6Q1, damp);
    }
    if (rig.heldLanternPivot) {
      if (!rig._r3MainLSw) rig._r3MainLSw = { rx: 0, rz: 0, vx: 0, vz: 0 };
      _r6Eul.setFromQuaternion(rig.armR.quaternion, 'XYZ');
      const tgtX = -_r6Eul.x * 0.72 + Math.min(0.32, speed * 0.052) + Math.sin(tNow * 2.15) * 0.06 + Math.sin(rig.animPhase) * mB * 0.14;
      const tgtZ = -_r6Eul.z * 0.65 + Math.cos(tNow * 1.72) * 0.05 + strafe * 0.14;
      const s = _stepLanternPendulum(rig._r3MainLSw, tgtX, tgtZ, dtClamped);
      rig.heldLanternPivot.rotation.set(s.rx, 0, s.rz);
    }
    const offPiv = (rig.armor.offLantern && rig.armor.offLantern.visible)
      ? rig.armor.offLanternPivot
      : ((rig.armor.offSoulLantern && rig.armor.offSoulLantern.visible) ? rig.armor.offSoulLanternPivot : null);
    if (offPiv) {
      if (!rig._r3OffLSw) rig._r3OffLSw = { rx: 0, rz: 0, vx: 0, vz: 0 };
      _r6Eul.setFromQuaternion(rig.armL.quaternion, 'XYZ');
      const tgtX = -_r6Eul.x * 0.72 + Math.min(0.32, speed * 0.052) + Math.sin(tNow * 2.15 + 1.1) * 0.06 - Math.sin(rig.animPhase) * mB * 0.14;
      const tgtZ = -_r6Eul.z * 0.65 + Math.cos(tNow * 1.72 + 0.9) * 0.05 + strafe * 0.14;
      const s = _stepLanternPendulum(rig._r3OffLSw, tgtX, tgtZ, dtClamped);
      offPiv.rotation.set(s.rx, 0, s.rz);
    }
  }

  const playerAvatar = createPlayerRig(selectedSkinId, null, null, null);
  playerAvatar.g.visible = false;
  scene.add(playerAvatar.g);
  applyArmorToPlayerRig(playerAvatar, player.equip, player.equipMeta);

  const inventory = Array.from({ length: 36 }, () => ({ id: 0, count: 0, dur: 0, maxDur: 0 }));
  function setSlotItem(idx, id, count = 1, dur = null, meta = null) {
    const def = BLOCK_DEF[id];
    const maxDur = (def && def.maxDur) ? def.maxDur : 0;
    inventory[idx].id = id;
    inventory[idx].count = count;
    inventory[idx].maxDur = maxDur;
    inventory[idx].dur = dur !== null ? dur : maxDur;
    inventory[idx].ench = !!(meta && meta.ench);
    inventory[idx].trim = (meta && meta.trim) ? { ...meta.trim } : null;
  }
  function initStarterInventory() {
    for (let i = 0; i < 36; i++) { inventory[i].id = 0; inventory[i].count = 0; inventory[i].dur = 0; inventory[i].maxDur = 0; inventory[i].ench = false; inventory[i].trim = null; }
    // Authentic Minecraft Survival Start: New players begin 100% empty-handed with NO items or armor!
    player.equip = { helmet: 0, chest: 0, legs: 0, boots: 0, offhand: 0 };
    player.equipMeta = { helmet: null, chest: null, legs: null, boots: null, offhand: null };
    if (typeof smithState !== 'undefined') { smithState.tpl = null; smithState.base = null; smithState.mat = null; }
    player.offhandDur = 336; player.offhandMaxDur = 336; player.shieldDisableT = 0; player.shieldRaiseT = 0; player.shieldImpactT = 0;
    recalcPlayerArmor();
  }
  function canFitItemInInventory(blockId, meta = null) {
    const def = BLOCK_DEF[blockId];
    const noStack = !!(def && (def.tool || def.armorSlot)) || !!(meta && (meta.ench || meta.trim || (meta.maxDur > 0 && typeof meta.dur === 'number' && meta.dur < meta.maxDur)));
    if (!noStack) {
      for (let i = 0; i < 36; i++) {
        if (inventory[i].id === blockId && inventory[i].count > 0 && inventory[i].count < 99 && !inventory[i].ench && !inventory[i].trim) return true;
      }
    }
    for (let i = 0; i < 36; i++) if (inventory[i].count === 0) return true;
    return false;
  }
  function addItemToInventory(blockId, qty = 1, meta = null) {
    const def = BLOCK_DEF[blockId];
    const noStack = !!(def && (def.tool || def.armorSlot)) || !!(meta && (meta.ench || meta.trim || (meta.maxDur > 0 && typeof meta.dur === 'number' && meta.dur < meta.maxDur)));
    const maxStack = noStack ? 1 : 99;
    if (maxStack > 1) {
      for (let i = 0; i < 36; i++) {
        if (inventory[i].id === blockId && inventory[i].count > 0 && inventory[i].count < maxStack && !inventory[i].ench && !inventory[i].trim) {
          const add = Math.min(maxStack - inventory[i].count, qty); inventory[i].count += add; qty -= add;
          if (qty <= 0) { renderHotbar(); return true; }
        }
      }
    }
    const itemDur = (meta && typeof meta.dur === 'number' && meta.dur > 0) ? meta.dur : null;
    for (let i = 0; i < 36; i++) {
      if (inventory[i].count === 0) {
        const give = Math.min(maxStack, qty);
        setSlotItem(i, blockId, give, itemDur, meta);
        qty -= give;
        if (qty <= 0) { renderHotbar(); return true; }
      }
    }
    renderHotbar(); return false;
  }
  function damageHeldTool(amount = 1) {
    const slot = inventory[player.selectedSlot];
    if (!slot || slot.count <= 0 || !slot.maxDur) return;
    slot.dur = Math.max(0, slot.dur - amount);
    if (slot.dur <= 0) {
      const name = BLOCK_DEF[slot.id]?.name || 'Công cụ';
      slot.id = 0; slot.count = 0; slot.dur = 0; slot.maxDur = 0; slot.ench = false; slot.trim = null;
      playSfx('break');
      showToast(`${name} đã hỏng!`);
    }
    renderHotbar();
  }
  function countItem(id) { let t = 0; for (let i = 0; i < 36; i++) if (inventory[i].count > 0 && inventory[i].id === id) t += inventory[i].count; return t; }
  function countAnyLog() { let t = 0; for (let i = 0; i < 36; i++) if (inventory[i].count > 0 && BLOCK_DEF[inventory[i].id]?.isLog) t += inventory[i].count; return t; }
  function countAnyCoal() { let t = 0; for (let i = 0; i < 36; i++) if (inventory[i].count > 0 && BLOCK_DEF[inventory[i].id]?.isCoal) t += inventory[i].count; return t; }
  function countAnyPlanks() { let t = 0; for (let i = 0; i < 36; i++) if (inventory[i].count > 0 && BLOCK_DEF[inventory[i].id]?.isPlanks) t += inventory[i].count; return t; }
  function consumeItem(id, qty, anyLog = false, anyCoal = false, anyPlanks = false) {
    for (let i = 0; i < 36 && qty > 0; i++) {
      const s = inventory[i]; if (s.count <= 0) continue;
      if (anyLog ? BLOCK_DEF[s.id]?.isLog : (anyCoal ? BLOCK_DEF[s.id]?.isCoal : (anyPlanks ? BLOCK_DEF[s.id]?.isPlanks : s.id === id))) {
        const take = Math.min(s.count, qty); s.count -= take; qty -= take;
        if (s.count <= 0) { s.id = 0; s.dur = 0; s.maxDur = 0; s.ench = false; s.trim = null; }
      }
    }
  }
  function canCraftRecipe(r) {
    for (const req of r.req) {
      if (req.anyLog ? countAnyLog() < req.qty : (req.anyCoal ? countAnyCoal() < req.qty : (req.anyPlanks ? countAnyPlanks() < req.qty : countItem(req.id) < req.qty))) return false;
    }
    return true;
  }
  function addXp(amount) {
    player.xp += amount;
    if (amount > 0) playSfx('xp_orb');
    let leveledUp = false;
    while (player.xp >= 20 + player.level * 12) { player.xp -= (20 + player.level * 12); player.level++; leveledUp = true; }
    if (leveledUp) { playSfx('levelup'); showToast(tr(`✨ Lên Cấp ${player.level}!`, `✨ Level Up! Level ${player.level}`)); }
    renderXpBar();
  }
  function renderXpBar() {
    const need = 20 + player.level * 12;
    const pct = Math.max(0, Math.min(100, (player.xp / need) * 100));
    const fillEl = document.getElementById('xpFill');
    const lvlEl = document.getElementById('xpLevel');
    if (fillEl) fillEl.style.width = `${pct.toFixed(1)}%`;
    if (lvlEl) lvlEl.textContent = player.level > 0 ? String(player.level) : '';
  }

  // Authentic Minecraft Glowing 3D XP Orbs (pop out on ore/mob kill & magnetically fly into nearby player)
  const xpOrbs = [];
  let _xpOrbTex = null, _xpOrbMats = null;
  function _getXpOrbMats() {
    if (_xpOrbMats) return _xpOrbMats;
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 1.5, 16, 16, 15.5);
    grad.addColorStop(0.0, 'rgba(255, 255, 235, 1.0)');
    grad.addColorStop(0.28, 'rgba(190, 255, 72, 0.98)');
    grad.addColorStop(0.60, 'rgba(74, 222, 52, 0.72)');
    grad.addColorStop(1.0, 'rgba(22, 163, 74, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    _xpOrbTex = new THREE.CanvasTexture(cv);
    _xpOrbTex.magFilter = THREE.LinearFilter;
    _xpOrbTex.minFilter = THREE.LinearFilter;
    _xpOrbMats = [0, 1, 2, 3].map(() => new THREE.SpriteMaterial({
      map: _xpOrbTex,
      color: 0xa3ff3a,
      transparent: true,
      depthWrite: false
    }));
    return _xpOrbMats;
  }
  function spawnXpOrbs(wx, wy, wz, totalXp) {
    let rem = Math.round(totalXp || 0);
    if (rem <= 0) return;
    const vals = [];
    if (rem <= 4) {
      for (let i = 0; i < rem; i++) vals.push(1);
    } else if (rem <= 12) {
      while (rem > 0) {
        const v = rem >= 5 ? 3 : (rem >= 3 ? 2 : rem);
        vals.push(v); rem -= v;
      }
    } else {
      const denoms = [15, 9, 5, 3, 1];
      while (rem > 0 && vals.length < 15) {
        let picked = 1;
        for (let di = 0; di < denoms.length; di++) {
          if (rem >= denoms[di]) { picked = denoms[di]; break; }
        }
        vals.push(picked); rem -= picked;
      }
      if (rem > 0) {
        if (vals.length > 0) vals[vals.length - 1] += rem;
        else vals.push(rem);
      }
    }
    const mats = _getXpOrbMats();
    for (let i = 0; i < vals.length; i++) {
      if (xpOrbs.length >= 120) {
        let extra = 0;
        for (let j = i; j < vals.length; j++) extra += vals[j];
        if (extra > 0) addXp(extra);
        break;
      }
      const val = vals[i];
      const matIdx = (Math.random() * mats.length) | 0;
      const sp = new THREE.Sprite(mats[matIdx]);
      const sc = val >= 10 ? 0.38 : (val >= 4 ? 0.31 : 0.24);
      sp.scale.set(sc, sc, sc);
      const sx = wx + (Math.random() - 0.5) * 0.44;
      const sy = wy + 0.14 + Math.random() * 0.22;
      const sz = wz + (Math.random() - 0.5) * 0.44;
      sp.position.set(sx, sy, sz);
      scene.add(sp);
      xpOrbs.push({
        value: val,
        x: sx, y: sy, z: sz,
        vx: (Math.random() - 0.5) * 3.1,
        vy: 2.5 + Math.random() * 1.9,
        vz: (Math.random() - 0.5) * 3.1,
        age: 0,
        pickupDelay: 0.28 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2,
        onGround: false,
        mesh: sp
      });
    }
  }
  function updateXpOrbs(dt) {
    if (xpOrbs.length === 0) return;
    const mats = _getXpOrbMats();
    const tPulse = typeof elapsed === 'number' ? elapsed : performance.now() * 0.001;
    for (let mi = 0; mi < mats.length; mi++) {
      const k = 0.5 + 0.5 * Math.sin(tPulse * 5.2 + mi * 1.57);
      mats[mi].color.setRGB(0.46 + k * 0.50, 1.0, 0.18 + k * 0.16);
    }
    const maxMagDist2 = 64.0;
    const airDrag = Math.exp(-1.8 * dt);
    const groundDrag = Math.exp(-10.5 * dt);
    for (let i = xpOrbs.length - 1; i >= 0; i--) {
      const orb = xpOrbs[i];
      orb.age += dt;
      if (orb.age >= ITEM_DESPAWN_SEC) {
        scene.remove(orb.mesh);
        xpOrbs[i] = xpOrbs[xpOrbs.length - 1]; xpOrbs.pop();
        continue;
      }
      const dx = player.x - orb.x, dy = (player.y + 0.72) - orb.y, dz = player.z - orb.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (!player.dead && orb.age >= orb.pickupDelay && dist2 < maxMagDist2) {
        const dist = Math.sqrt(dist2);
        if (dist < 0.78) {
          addXp(orb.value);
          scene.remove(orb.mesh);
          xpOrbs[i] = xpOrbs[xpOrbs.length - 1]; xpOrbs.pop();
          continue;
        }
        const pull = 1.0 - dist / 8.0;
        const targetSpd = 5.6 + pull * 10.5;
        const inv = 1.0 / (dist + 1e-4);
        const steerK = Math.min(1.0, dt * (9.5 + pull * 14.0));
        orb.vx += (dx * inv * targetSpd - orb.vx) * steerK;
        orb.vy += (dy * inv * targetSpd - orb.vy) * steerK;
        orb.vz += (dz * inv * targetSpd - orb.vz) * steerK;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.z += orb.vz * dt;
        orb.onGround = false;
      } else {
        const curBx = Math.floor(orb.x), curBy = Math.floor(orb.y), curBz = Math.floor(orb.z);
        const blkHere = getBlockWorld(curBx, curBy, curBz);
        if (blkHere === B.LAVA || blkHere === B.FIRE) {
          scene.remove(orb.mesh);
          xpOrbs[i] = xpOrbs[xpOrbs.length - 1]; xpOrbs.pop();
          continue;
        }
        if (blkHere === B.WATER) {
          orb.vy += (1.1 - orb.vy) * Math.min(1.0, dt * 5.0);
        } else {
          orb.vy = Math.max(-22.0, orb.vy - 16.5 * dt);
        }
        const nx = orb.x + orb.vx * dt, nz = orb.z + orb.vz * dt;
        const midY = Math.floor(orb.y + 0.08);
        if (!isSolidAt(Math.floor(nx), midY, curBz)) orb.x = nx; else orb.vx *= -0.35;
        if (!isSolidAt(Math.floor(orb.x), midY, Math.floor(nz))) orb.z = nz; else orb.vz *= -0.35;
        const ny = orb.y + orb.vy * dt;
        if (orb.vy > 0 && isSolidAt(Math.floor(orb.x), Math.floor(ny + 0.14), Math.floor(orb.z))) {
          orb.vy = -orb.vy * 0.25;
        } else {
          orb.y = ny;
        }
        const gy = Math.floor(orb.y - 0.14);
        if (isSolidAt(Math.floor(orb.x), gy, Math.floor(orb.z)) && orb.vy <= 0) {
          orb.y = gy + 1.14;
          if (orb.vy < -1.8) { orb.vy = -orb.vy * 0.30; orb.vx *= 0.72; orb.vz *= 0.72; orb.onGround = false; }
          else { orb.vy = 0; orb.onGround = true; }
        } else {
          orb.onGround = false;
        }
        const drag = orb.onGround ? groundDrag : airDrag;
        orb.vx *= drag; orb.vz *= drag;
      }
      const bob = orb.onGround ? Math.sin(orb.age * 4.5 + orb.phase) * 0.045 : 0;
      orb.mesh.position.set(orb.x, orb.y + bob, orb.z);
    }
  }

  // Textured 3D Dropped Items (floating & 360° spinning with Minecraft ground shadow disc!)
  const droppedItems = [], dropModelCache = new Map();
  const dropShadowGeo = new THREE.CircleGeometry(0.18, 12);
  dropShadowGeo.rotateX(-Math.PI * 0.5);
  const dropShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
  function getDropVisual(blockId) {
    let base = dropModelCache.get(blockId);
    if (!base || (base.userData && base.userData.iconReady === false)) {
      const def = BLOCK_DEF[blockId] || BLOCK_DEF[B.DIRT];
      const m = buildUnified3DItemMesh(blockId);
      const sc = blockId === B.SHIELD ? 0.76 : ((def.voxelItem || !def.solid) ? 0.84 : (m.isGroup ? 0.90 : 0.92));
      m.scale.setScalar(sc);
      m.position.set(0, 0, 0);
      m.rotation.set(0, 0, 0);
      if (typeof m.traverse === 'function') m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      if (!m.userData || m.userData.iconReady !== false) dropModelCache.set(blockId, m);
      base = m;
    }
    const clone = base.clone();
    clone.userData = Object.assign({}, base.userData);
    return clone;
  }
  function spawnDroppedItem(wx, wy, wz, blockId, opts = null) {
    if (!blockId || !BLOCK_DEF[blockId]) return;
    const def = BLOCK_DEF[blockId];
    const dropId = (opts && opts.dropId) || ('d_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
    if (opts && opts._remote && droppedItems.some(d => d.dropId === dropId)) return;
    const mesh = getDropVisual(blockId);
    const shadow = new THREE.Mesh(dropShadowGeo, dropShadowMat);
    const phase = Math.random() * Math.PI * 2;
    const exact = !!(opts && opts.exactPos);
    const sx = exact ? wx : (wx + 0.5 + (Math.random() - 0.5) * 0.22);
    const sy = exact ? wy : (wy + 0.35);
    const sz = exact ? wz : (wz + 0.5 + (Math.random() - 0.5) * 0.22);
    mesh.position.set(sx, sy + 0.28, sz);
    shadow.position.set(sx, sy + 0.03, sz);
    scene.add(mesh, shadow);
    const cnt = (opts && opts.count > 1) ? opts.count : 1;
    const dur = (opts && typeof opts.dur === 'number') ? opts.dur : (def.maxDur || 0);
    const maxDur = (opts && opts.maxDur) || (def.maxDur || 0);
    const ench = !!(opts && opts.ench);
    const trim = (opts && opts.trim) ? { ...opts.trim } : null;
    const vx = (opts && opts.vx !== undefined) ? opts.vx : (Math.random() - 0.5) * 2.1;
    const vy = (opts && opts.vy !== undefined) ? opts.vy : 3.2;
    const vz = (opts && opts.vz !== undefined) ? opts.vz : (Math.random() - 0.5) * 2.1;
    const dim = (opts && opts.dim) || currentDimension || 'overworld';
    const fromDeath = !!(opts && opts.fromDeath);
    const entry = {
      dropId, dim,
      id: blockId,
      count: cnt,
      dur, maxDur, ench, trim,
      x: sx, y: sy, z: sz,
      rx: sx, ry: sy, rz: sz,
      vx, vy, vz,
      tumbleX: (opts && opts.thrown) ? 0.65 : 0.22,
      spinRate: (opts && opts.thrown) ? 8.5 : 3.6,
      age: 0,
      pickupDelay: (opts && opts.pickupDelay !== undefined) ? opts.pickupDelay : 0.35,
      fromDeath,
      phase,
      onGround: false,
      mesh,
      shadow
    };
    droppedItems.push(entry);
    if (activeRoomId && !(opts && opts._remote) && !isApplyingRemoteBlock && typeof queueNetworkDropSpawn === 'function') {
      queueNetworkDropSpawn({
        dropId, dim, id: blockId, count: cnt, dur, maxDur, ench, trim,
        x: +sx.toFixed(3), y: +sy.toFixed(3), trueY: +(sy - (depthOffset || 0)).toFixed(3), z: +sz.toFixed(3),
        vx: +vx.toFixed(3), vy: +vy.toFixed(3), vz: +vz.toFixed(3), fromDeath
      });
    }
    return entry;
  }

  function throwInventorySlot(idx, wholeStack = false) {
    if (idx < 0 || idx >= inventory.length) return false;
    const slot = inventory[idx];
    if (!slot || slot.count <= 0 || !slot.id) return false;
    const def = BLOCK_DEF[slot.id];
    const dropId = slot.id;
    const qty = (wholeStack || (def && (def.tool || def.armorSlot)) || slot.ench || slot.trim || (slot.maxDur > 0 && slot.dur < slot.maxDur)) ? slot.count : 1;
    const itemMeta = { dur: slot.dur || 0, maxDur: slot.maxDur || 0, ench: !!slot.ench, trim: slot.trim ? { ...slot.trim } : null };
    slot.count -= qty;
    if (slot.count <= 0) { slot.id = 0; slot.count = 0; slot.dur = 0; slot.maxDur = 0; slot.ench = false; slot.trim = null; }
    _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ');
    _rayDir.set(0, 0, -1).applyEuler(_rayEuler);
    const eyeOff = player.sneakEyeOff !== undefined ? player.sneakEyeOff : (player.sneaking ? -0.36 : 0);
    const ex = player.x + _rayDir.x * 0.48 - Math.cos(player.yaw) * 0.14;
    const ey = player.y + EYE_HEIGHT + eyeOff - 0.18 + _rayDir.y * 0.32;
    const ez = player.z + _rayDir.z * 0.48 + Math.sin(player.yaw) * 0.14;
    const pVx = (player.smoothMoveX || 0) + (player.vx || 0);
    const pVz = (player.smoothMoveZ || 0) + (player.vz || 0);
    spawnDroppedItem(ex, ey, ez, dropId, {
      exactPos: true,
      thrown: true,
      count: qty,
      dur: itemMeta.dur, maxDur: itemMeta.maxDur, ench: itemMeta.ench, trim: itemMeta.trim,
      vx: _rayDir.x * 8.4 + pVx * 0.42 + (Math.random() - 0.5) * 0.24,
      vy: Math.max(1.45, _rayDir.y * 7.2 + 2.55),
      vz: _rayDir.z * 8.4 + pVz * 0.42 + (Math.random() - 0.5) * 0.24,
      pickupDelay: 1.25
    });
    player.swingT = 0.22;
    playSfx('place');
    renderHotbar();
    if (!document.getElementById('invModal').classList.contains('hidden')) renderInventoryModal();
    if (typeof schedulePlayerRoomSave === 'function') schedulePlayerRoomSave(true);
    showToast(`🗑️ Đã vứt ${qty}× ${def ? def.name : 'vật phẩm'}`);
    return true;
  }

  function itemTouchesCactus(ix, iy, iz) {
    const cx0 = Math.floor(ix), cy0 = Math.floor(iy + 0.15), cz0 = Math.floor(iz);
    for (let dy = -1; dy <= 1; dy++) {
      const by = cy0 + dy;
      if (iy < by - 0.12 || iy > by + 1.12) continue;
      for (let dz = -1; dz <= 1; dz++) {
        const bz = cz0 + dz;
        if (Math.abs(iz - (bz + 0.5)) >= 0.64) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const bx = cx0 + dx;
          if (Math.abs(ix - (bx + 0.5)) >= 0.64) continue;
          if (getBlockWorld(bx, by, bz) === B.CACTUS) return true;
        }
      }
    }
    return false;
  }

  function removeDroppedItemById(dropId) {
    if (!dropId) return false;
    const did = String(dropId);
    for (let i = droppedItems.length - 1; i >= 0; i--) {
      const it = droppedItems[i];
      if (it && String(it.dropId) === did) {
        scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
        droppedItems[i] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
        return true;
      }
    }
    return false;
  }
  function _completeNetworkDropPickup(dropId, srvDrop = null) {
    const did = String(dropId || '');
    let idx = -1;
    for (let i = droppedItems.length - 1; i >= 0; i--) {
      if (droppedItems[i] && String(droppedItems[i].dropId) === did) { idx = i; break; }
    }
    const localIt = idx >= 0 ? droppedItems[idx] : null;
    const src = srvDrop || localIt;
    if (src && src.id) {
      addItemToInventory(src.id, src.count || 1, {
        dur: src.dur || 0,
        maxDur: src.maxDur || 0,
        ench: !!src.ench,
        trim: src.trim ? { ...src.trim } : null
      });
      playSfx('pickup');
      if (typeof schedulePlayerRoomSave === 'function') schedulePlayerRoomSave(true);
    }
    if (idx >= 0) {
      const it = droppedItems[idx];
      scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
      droppedItems[idx] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
    }
  }
  function updateDroppedItems(dt) {
    const useFastDrops = !!(sodiumOpts.entityCulling || sodiumOpts.immFast);
    const lookX = -Math.sin(player.yaw) * Math.cos(player.pitch);
    const lookY = Math.sin(player.pitch);
    const lookZ = -Math.cos(player.yaw) * Math.cos(player.pitch);
    const eyeY = player.y + EYE_HEIGHT;
    const airDrag = Math.exp(-1.25 * dt);
    const groundDrag = Math.exp(-12.5 * dt);
    const interpK = 1 - Math.exp(-26.0 * dt);
    for (let i = droppedItems.length - 1; i >= 0; i--) {
      const it = droppedItems[i];
      if ((it.dim || 'overworld') !== (currentDimension || 'overworld')) {
        it.mesh.visible = false; if (it.shadow) it.shadow.visible = false;
        continue;
      }
      const loaded = chunks.has(chunkKey(Math.floor(it.x) >> 4, Math.floor(it.z) >> 4));
      if (!loaded) {
        it.mesh.visible = false; if (it.shadow) it.shadow.visible = false;
        continue;
      }
      // Authentic Minecraft: Timer only counts while chunk is loaded; death-dropped items stay preserved until picked up!
      it.age += dt;
      if (!it.fromDeath && it.age >= ITEM_DESPAWN_SEC) {
        if (activeRoomId && typeof isSimAuthority === 'function' && isSimAuthority() && typeof broadcastDropRemove === 'function') broadcastDropRemove(it.dropId);
        scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
        droppedItems[i] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
        continue;
      }
      const isSettled = it.onGround && !it._wasEncased && Math.abs(it.vx) < 0.005 && Math.abs(it.vz) < 0.005;
      if (!isSettled || ((frameCounter + i) % 6) === 0) {
        const curBx = Math.floor(it.x), curBy = Math.floor(it.y + 0.16), curBz = Math.floor(it.z);
        if (isSolidAt(curBx, curBy, curBz)) {
          // Minecraft Item Elevator: push items buried inside a newly placed block smoothly upward to hover on top!
          it.onGround = false;
          it.vx *= 0.72; it.vz *= 0.72;
          it.x += (curBx + 0.5 - it.x) * Math.min(1, dt * 6.0);
          it.z += (curBz + 0.5 - it.z) * Math.min(1, dt * 6.0);
          it.vy = Math.max(it.vy, 5.2);
          it.y += it.vy * dt;
          it._wasEncased = true;
        } else if (!isSettled) {
          if (it._wasEncased) { it._wasEncased = false; it.vy = Math.min(it.vy, 2.1); }
          const inWater = (getBlockWorld(curBx, curBy, curBz) === B.WATER);
          if (inWater) {
            it.vy = Math.min(1.6, it.vy + (1.2 - it.vy) * Math.min(1, dt * 5.5));
          } else {
            it.vy = Math.max(-24.0, it.vy - 17.5 * dt);
          }
          // Sub-stepped horizontal & vertical sweep so fast-thrown items never tunnel through walls or floors!
          const stepCnt = (Math.hypot(it.vx, it.vy, it.vz) * dt > 0.34) ? 2 : 1;
          const subDt = dt / stepCnt;
          for (let st = 0; st < stepCnt; st++) {
            const nx = it.x + it.vx * subDt, nz = it.z + it.vz * subDt;
            const midY = Math.floor(it.y + 0.22);
            if (!isSolidAt(Math.floor(nx), midY, Math.floor(it.z))) it.x = nx; else it.vx *= -0.32;
            if (!isSolidAt(Math.floor(it.x), midY, Math.floor(nz))) it.z = nz; else it.vz *= -0.32;
            const ny = it.y + it.vy * subDt;
            if (it.vy > 0 && isSolidAt(Math.floor(it.x), Math.floor(ny + 0.38), Math.floor(it.z))) {
              it.vy = -it.vy * 0.25;
            } else {
              it.y = ny;
            }
            const gy = Math.floor(it.y - 0.04);
            if (isSolidAt(Math.floor(it.x), gy, Math.floor(it.z)) && it.vy <= 0) {
              it.y = gy + 1.0;
              if (it.vy < -2.1) {
                it.vy = -it.vy * 0.26;
                it.vx *= 0.72; it.vz *= 0.72;
                it.onGround = false;
              } else {
                it.vy = 0;
                it.onGround = true;
              }
            } else {
              it.onGround = false;
            }
          }
          const drag = it.onGround ? groundDrag : (inWater ? Math.exp(-4.5 * dt) : airDrag);
          it.vx *= drag; it.vz *= drag;
          if (it.onGround && Math.abs(it.vx) < 0.008 && Math.abs(it.vz) < 0.008) { it.vx = 0; it.vz = 0; }
        } else if (!isSolidAt(curBx, Math.floor(it.y - 0.04), curBz)) {
          it.onGround = false;
        }
        const bx = Math.floor(it.x), bz = Math.floor(it.z);
        // Lava burns items UNLESS fireImmune (Netherite / Ancient Debris float undamaged in lava/fire!)
        const blkHere = getBlockWorld(bx, Math.floor(it.y + 0.14), bz);
        const blkBelow = getBlockWorld(bx, Math.floor(it.y - 0.06), bz);
        if (blkHere === B.LAVA || blkBelow === B.LAVA || blkHere === B.FIRE || blkHere === B.SOUL_FIRE) {
          if (BLOCK_DEF[it.id]?.fireImmune) {
            if (blkHere === B.LAVA) { it.vy = Math.max(it.vy, 1.2); it.onGround = false; }
          } else {
            spawnParticles(it.x, it.y + 0.35, it.z, 0xff6b00, 10, true);
            spawnParticles(it.x, it.y + 0.45, it.z, 0xfef08a, 6, true);
            playSfx('hiss');
            if (activeRoomId && typeof isSimAuthority === 'function' && isSimAuthority() && typeof broadcastDropRemove === 'function') broadcastDropRemove(it.dropId);
            scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
            droppedItems[i] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
            continue;
          }
        }
        if ((!isSettled || ((frameCounter + i) & 7) === 0) && itemTouchesCactus(it.x, it.y, it.z)) {
          spawnParticles(it.x, it.y + 0.35, it.z, 0x4ade80, 9, false);
          playSfx('break');
          if (activeRoomId && typeof isSimAuthority === 'function' && isSimAuthority() && typeof broadcastDropRemove === 'function') broadcastDropRemove(it.dropId);
          scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
          droppedItems[i] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
          continue;
        }
        // Solo-only ground stack merge for non-custom-metadata items
        const itCustom = !!(it.ench || it.trim || (it.maxDur > 0 && it.dur < it.maxDur));
        if (!activeRoomId && !itCustom && it.onGround && it.count < 99 && ((frameCounter + i) & 7) === 0 && !(BLOCK_DEF[it.id] && (BLOCK_DEF[it.id].tool || BLOCK_DEF[it.id].armorSlot))) {
          for (let j = i - 1; j >= 0; j--) {
            const ot = droppedItems[j];
            if (!ot || ot.id !== it.id || !ot.onGround || ot.count >= 99 || ot.ench || ot.trim || (ot.maxDur > 0 && ot.dur < ot.maxDur)) continue;
            const mdx = ot.x - it.x, mdy = ot.y - it.y, mdz = ot.z - it.z;
            if (mdx * mdx + mdy * mdy + mdz * mdz < 0.75) {
              const mv = Math.min(99 - ot.count, it.count);
              ot.count += mv;
              it.count -= mv;
              ot.mesh.scale.multiplyScalar(1.04);
              setTimeout(() => { if (ot.mesh) { const def0 = BLOCK_DEF[ot.id]; ot.mesh.scale.setScalar(ot.id === B.SHIELD ? 0.76 : ((def0 && (def0.voxelItem || !def0.solid)) ? 0.84 : 0.90)); } }, 90);
              if (it.count <= 0) break;
            }
          }
          if (it.count <= 0) {
            scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
            droppedItems[i] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
            continue;
          }
        }
      }

      const pDelay = it.pickupDelay !== undefined ? it.pickupDelay : 0.35;
      const dx = player.x - it.x, dy = (player.y + 0.85) - (it.y + 0.48), dz = player.z - it.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (!player.dead && it.age >= pDelay && dist2 < 5.76 && canFitItemInInventory(it.id, it)) {
        const dist = Math.sqrt(dist2);
        const midY = Math.floor((player.y + 0.85 + it.y + 0.35) * 0.5);
        const midBlocked = dist >= 1.15 && isSolidAt(Math.floor((player.x + it.x) * 0.5), midY, Math.floor((player.z + it.z) * 0.5));
        if (!midBlocked) {
          const pullFrac = Math.min(1.0, (10.5 + (2.2 - Math.min(2.2, dist)) * 7.0) * dt / Math.max(0.06, dist));
          it.vx = 0; it.vy = 0; it.vz = 0; it.onGround = false;
          it.x += dx * pullFrac; it.y += dy * pullFrac; it.z += dz * pullFrac;
          it.rx = it.x; it.ry = it.y; it.rz = it.z;
          const postDist = Math.hypot(player.x - it.x, (player.y + 0.85) - (it.y + 0.48), player.z - it.z);
          if (postDist < 0.85) {
            if (activeRoomId && typeof requestNetworkDropPickup === 'function') {
              requestNetworkDropPickup(it);
            } else {
              addItemToInventory(it.id, it.count || 1, it); playSfx('pickup');
              scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow);
              droppedItems[i] = droppedItems[droppedItems.length - 1]; droppedItems.pop();
              continue;
            }
          }
        }
      }
      if (it.rx === undefined) { it.rx = it.x; it.ry = it.y; it.rz = it.z; }
      it.rx += (it.x - it.rx) * interpK;
      it.ry += (it.y - it.ry) * interpK;
      it.rz += (it.z - it.rz) * interpK;
      // Entity Culling & ImmediatelyFast: 6-plane frustum + distance skip for dropped items
      const _maxDropD2 = (sodiumOpts.farEntities === false) ? 784.0 : 1444.0;
      if (useFastDrops && dist2 > 9.0) {
        if (dist2 > _maxDropD2) {
          it.mesh.visible = false; if (it.shadow) it.shadow.visible = false;
          continue;
        }
        if (_camFrustumReady && sodiumOpts.entityCulling) {
          _cullSphere.center.set(it.rx, it.ry + 0.35, it.rz);
          _cullSphere.radius = 0.95;
          if (!_camFrustum.intersectsSphere(_cullSphere)) {
            it.mesh.visible = false; if (it.shadow) it.shadow.visible = false;
            continue;
          }
        }
      }
      it.mesh.visible = true;
      if (it.shadow) {
        it.shadow.visible = it.onGround && dist2 < 576.0;
        if (it.shadow.visible) it.shadow.position.set(it.rx, it.ry + 0.03, it.rz);
      }
      if (useFastDrops && isSettled && dist2 > 225.0 && ((frameCounter + i) & 1) !== 0) continue;
      // Smooth mid-air tumble damping into Minecraft upright hover & 360° spin!
      it.tumbleX = (it.tumbleX || 0) * Math.exp(-(it.onGround ? 14.0 : 2.8) * dt);
      it.spinRate = 2.1 + ((it.spinRate || 2.1) - 2.1) * Math.exp(-(it.onGround ? 10.0 : 2.2) * dt);
      it.phase += it.spinRate * dt;
      const wave = Math.sin(it.age * 2.8 + it.phase * 0.35);
      const hoverY = it.onGround ? (0.28 + wave * 0.075) : 0.24;
      it.mesh.position.set(it.rx, it.ry + hoverY, it.rz);
      it.mesh.rotation.set(Math.sin(it.age * 9.0) * it.tumbleX, it.phase, Math.cos(it.age * 7.5) * it.tumbleX * 0.5);
      if (it.shadow && it.shadow.visible) {
        it.shadow.position.set(it.x, it.y + 0.025, it.z);
        it.shadow.scale.setScalar(1.0 - wave * 0.16);
      }
    }
  }

  // ===================== CODE-DRIVEN PIXELFX ENGINE (patch-gg/pixelfx style!) =====================
  const _pixelFxSheets = new Map();
  function _pfxHash(n) { n = (n ^ 61) ^ (n >>> 16); n += n << 3; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  function bakePixelSheet(frameCount, size, additive, drawFrameFn) {
    const mats = [];
    for (let f = 0; f < frameCount; f++) {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const px = (x, y, col) => {
        const ix = Math.round(x), iy = Math.round(y);
        if (ix >= 0 && ix < size && iy >= 0 && iy < size) { ctx.fillStyle = col; ctx.fillRect(ix, iy, 1, 1); }
      };
      const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
      const line = (x0, y0, x1, y1, col) => {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let guard = 0; guard < 128; guard++) {
          px(x0, y0, col);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      };
      const disc = (cx, cy, r, col, dither = false) => {
        const r2 = r * r, x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d2 <= r2 && (!dither || d2 < r2 * 0.65 || ((x + y) & 1) === 0)) px(x, y, col);
        }
      };
      const ring = (cx, cy, r, col) => {
        const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (Math.abs(d - r) < 0.68) px(x, y, col);
        }
      };
      const star = (cx, cy, arm, col, coreCol, diag = 0) => {
        for (let i = -arm; i <= arm; i++) {
          const c = (Math.abs(i) <= Math.max(1, arm >> 1)) ? (coreCol || col) : col;
          px(cx + i, cy, c); px(cx, cy + i, c);
        }
        if (diag > 0) for (let i = -diag; i <= diag; i++) { px(cx + i, cy + i, col); px(cx + i, cy - i, col); }
      };
      const bolt = (x0, y0, x1, y1, jag, seed, glowCol, coreCol) => {
        const pts = [[x0, y0]];
        const segs = 4;
        for (let s = 1; s < segs; s++) {
          const k = s / segs, j = (_pfxHash(seed * 31 + s * 17) - 0.5) * 2 * jag;
          const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
          pts.push([x0 + dx * k - (dy / dl) * j, y0 + dy * k + (dx / dl) * j]);
        }
        pts.push([x1, y1]);
        for (let s = 0; s < pts.length - 1; s++) {
          if (glowCol) { line(pts[s][0] + 1, pts[s][1], pts[s+1][0] + 1, pts[s+1][1], glowCol); line(pts[s][0], pts[s][1] + 1, pts[s+1][0], pts[s+1][1] + 1, glowCol); }
          line(pts[s][0], pts[s][1], pts[s+1][0], pts[s+1][1], coreCol);
        }
      };
      drawFrameFn({ ctx, f, n: frameCount, size, t: frameCount > 1 ? f / (frameCount - 1) : 0, px, rect, line, disc, ring, star, bolt, hash: (k) => _pfxHash(f * 97 + k * 23) });
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
      mats.push(new THREE.SpriteMaterial({
        map: tex, transparent: true, alphaTest: 0.06, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      }));
    }
    return { frames: frameCount, mats };
  }

  function getPixelFxSheet(kind) {
    if (_pixelFxSheets.has(kind)) return _pixelFxSheets.get(kind);
    let sheet = null;
    if (kind === 'ice_shatter') {
      sheet = bakePixelSheet(7, 24, true, ({ f, t, size, px, line, ring, star, disc, hash }) => {
        const cx = 11.5, cy = 11.5;
        if (f <= 2) {
          disc(cx, cy, Math.max(1, 3.2 - f), f === 0 ? '#ffffff' : '#bae6fd');
          ring(cx, cy, 2 + f * 3.0, '#7dd3fc');
          star(cx, cy, 4 + f * 2, '#38bdf8', '#ffffff', 3 + f);
        } else {
          if (f <= 4) ring(cx, cy, 6 + (f - 2) * 2.2, '#38bdf8');
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + 0.35;
            const r0 = 2.5 + (f - 2) * 1.9, r1 = r0 + (f < 5 ? 3.5 : 2.0);
            line(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0, cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, f < 5 ? '#e0f2fe' : '#7dd3fc');
            if (f < 6) px(cx + Math.cos(ang) * (r0 + 1), cy + Math.sin(ang) * (r0 + 1), '#ffffff');
          }
          for (let s = 0; s < 5; s++) {
            const a = hash(s + 11) * Math.PI * 2, d = 3 + t * 9.5;
            px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (s & 1) ? '#ffffff' : '#7dd3fc');
          }
        }
      });
    } else if (kind === 'frost_aura') {
      sheet = bakePixelSheet(6, 16, true, ({ f, px, star, hash }) => {
        const cx = 7.5 + Math.round(Math.sin(f * 1.05)), cy = 7.5 + Math.round(Math.cos(f * 1.05));
        star(cx, cy, (f & 1) ? 3 : 2, '#7dd3fc', '#ffffff', (f & 1) ? 1 : 2);
        px(cx - 2, cy - 2, '#e0f2fe'); px(cx + 2, cy + 2, '#e0f2fe');
        for (let k = 0; k < 3; k++) px(3 + ((hash(k + 5) * 10) | 0), 3 + ((hash(k + 19) * 10) | 0), k === 0 ? '#ffffff' : '#bae6fd');
      });
    } else if (kind === 'lightning_arc') {
      sheet = bakePixelSheet(6, 24, true, ({ f, bolt, disc, px, hash }) => {
        const cx = 11.5, cy = 11.5;
        if (f <= 2) disc(cx, cy, 2.6 - f * 0.6, '#ffffff', true);
        const branches = f < 4 ? 3 : 2;
        for (let b = 0; b < branches; b++) {
          const a = hash(b * 7 + 3) * Math.PI * 2, r = 6 + (f % 3) * 2.2;
          const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
          bolt(cx + (hash(b) - 0.5) * 3, cy + (hash(b + 9) - 0.5) * 3, x1, y1, 3.2, f * 17 + b, '#38bdf8', b === 0 ? '#ffffff' : '#bae6fd');
          if (f < 5) px(x1, y1, '#ffffff');
        }
        for (let s = 0; s < 5; s++) px(4 + ((hash(s + 40) * 16) | 0), 4 + ((hash(s + 50) * 16) | 0), s === 0 ? '#ffffff' : '#7dd3fc');
      });
    } else if (kind === 'electric_coil') {
      sheet = bakePixelSheet(6, 16, true, ({ f, bolt, px, hash }) => {
        const a0 = f * 1.1, x0 = 7.5 + Math.cos(a0) * 5, y0 = 7.5 + Math.sin(a0) * 5;
        const x1 = 7.5 + Math.cos(a0 + 2.3) * 5.2, y1 = 7.5 + Math.sin(a0 + 2.3) * 5.2;
        bolt(x0, y0, x1, y1, 2.2, f * 13 + 3, '#0284c7', '#e0f2fe');
        px(7.5, 7.5, '#ffffff');
        for (let s = 0; s < 3; s++) px(2 + ((hash(s + 7) * 12) | 0), 2 + ((hash(s + 17) * 12) | 0), '#7dd3fc');
      });
    } else if (kind === 'explosion_fire' || kind === 'explosion_electric' || kind === 'explosion_frost' || kind === 'explosion_ender') {
      const EXP_PALS = {
        explosion_fire:     { core: '#ffffff', hi: '#fef08a', mid: '#f97316', dark: '#57534e', ring: '#facc15' },
        explosion_electric: { core: '#ffffff', hi: '#e0f2fe', mid: '#38bdf8', dark: '#1e3a8a', ring: '#7dd3fc' },
        explosion_frost:    { core: '#ffffff', hi: '#e0f2fe', mid: '#7dd3fc', dark: '#0369a1', ring: '#bae6fd' },
        explosion_ender:    { core: '#ffffff', hi: '#f5d0fe', mid: '#d946ef', dark: '#4c1d95', ring: '#e879f9' }
      };
      const pal = EXP_PALS[kind];
      sheet = bakePixelSheet(8, 24, kind !== 'explosion_fire', ({ f, t, disc, ring, px, bolt, hash }) => {
        const cx = 11.5, cy = 11.5;
        if (f === 0) {
          disc(cx, cy, 4.5, pal.core); ring(cx, cy, 6.2, pal.ring);
        } else if (f <= 3) {
          ring(cx, cy, 5.5 + f * 1.9, pal.ring);
          const lobes = [[0,0,5.2-f*0.4],[-3,-2,3.4],[3,-2,3.4],[-2,3,3.2],[3,2,3.2]];
          for (const [ox, oy, lr] of lobes) disc(cx + ox * (f * 0.48), cy + oy * (f * 0.48), lr, f < 2 ? pal.hi : pal.mid, f === 3);
          disc(cx, cy, Math.max(1.2, 3.2 - f * 0.6), pal.core);
          if (kind === 'explosion_electric') bolt(cx - 5, cy - 4, cx + 6, cy + 5, 2.5, f * 19, pal.mid, pal.core);
        } else {
          for (let k = 0; k < 6; k++) {
            const a = hash(k + 5) * Math.PI * 2 + t * 0.4, d = 3.5 + (f - 3) * 1.65;
            disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(1, 3.2 - (f - 4) * 0.55), f < 6 ? pal.mid : pal.dark, true);
          }
          for (let s = 0; s < 5; s++) {
            const a = hash(s + 31) * Math.PI * 2, d = 5 + (f - 3) * 1.7;
            px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, pal.hi);
          }
        }
      });
    } else if (kind === 'fire_flame') {
      // Upgraded patch-gg/pixelfx 8-frame 20x20 multi-layered pixel-art fire flipbook!
      sheet = bakePixelSheet(8, 20, true, ({ f, t, px, disc, line, hash }) => {
        const sway = Math.sin(f * 0.95) * 1.65;
        const lift = f * 0.65;
        // Outer crimson-red base & dithered heat corona
        disc(9.5 + sway * 0.25, 14.5 - lift * 0.4, Math.max(1.8, 4.4 - f * 0.35), '#b91c1c', true);
        disc(9.5 + sway * 0.35, 13.2 - lift * 0.55, Math.max(1.5, 3.8 - f * 0.32), '#ef4444', f >= 5);
        // Mid vivid orange dancing flame tongues
        disc(9.5 + sway * 0.55, 11.2 - lift * 0.75, Math.max(1.2, 3.0 - f * 0.26), '#f97316', f >= 6);
        disc(9.5 - sway * 0.45, 10.0 - lift * 0.65, Math.max(0.9, 2.1 - f * 0.22), '#fb923c', true);
        // Inner golden-yellow flame heart
        if (f <= 6) {
          disc(9.5 + sway * 0.65, 9.4 - lift * 0.72, Math.max(0.8, 2.1 - f * 0.22), '#facc15', f >= 4);
          line(9.5 + sway * 0.4, 13.5, 9.5 + sway * 0.9, 6.2 - (f % 3), '#fde047');
        }
        // White-hot base core
        if (f <= 4) disc(9.5 + sway * 0.2, 13.6 - lift * 0.3, Math.max(0.8, 1.7 - f * 0.25), f < 2 ? '#ffffff' : '#fef08a');
        // Detached rising pixel embers
        for (let e = 0; e < 3; e++) {
          const ex = 6 + ((hash(e * 7 + 3) * 8) | 0) + sway * 0.5;
          const ey = Math.max(1, 7 - f + ((hash(e * 13 + 5) * 4) | 0));
          px(ex, ey, e === 0 ? '#fef08a' : (e === 1 ? '#facc15' : '#f97316'));
        }
      });
    } else if (kind === 'soul_flame') {
      // patch-gg/pixelfx 8-frame 20x20 Soul Fire (cyan-turquoise spectral flame)
      sheet = bakePixelSheet(8, 20, true, ({ f, px, disc, line, hash }) => {
        const sway = Math.cos(f * 0.95) * 1.6;
        const lift = f * 0.65;
        disc(9.5 + sway * 0.25, 14.5 - lift * 0.4, Math.max(1.8, 4.3 - f * 0.35), '#0e7490', true);
        disc(9.5 + sway * 0.45, 12.2 - lift * 0.65, Math.max(1.3, 3.2 - f * 0.28), '#06b6d4', f >= 5);
        if (f <= 6) {
          disc(9.5 + sway * 0.6, 9.8 - lift * 0.72, Math.max(0.9, 2.2 - f * 0.22), '#67e8f9', f >= 4);
          line(9.5 + sway * 0.3, 13.5, 9.5 + sway * 0.85, 6.0 - (f % 3), '#a5f3fc');
        }
        if (f <= 4) disc(9.5 + sway * 0.2, 13.6 - lift * 0.3, Math.max(0.8, 1.7 - f * 0.25), '#ffffff');
        for (let e = 0; e < 3; e++) {
          px(6 + ((hash(e * 11 + 2) * 8) | 0), Math.max(1, 7 - f + ((hash(e * 17 + 4) * 4) | 0)), e === 0 ? '#ffffff' : '#67e8f9');
        }
      });
    } else if (kind === 'end_crystal_burst') {
      // patch-gg/pixelfx 8-frame 24x24 End Crystal Crystalline Magenta-Violet Shockwave Burst!
      sheet = bakePixelSheet(8, 24, true, ({ f, t, disc, ring, star, bolt, px, hash }) => {
        const cx = 11.5, cy = 11.5;
        if (f <= 2) {
          disc(cx, cy, 4.8 - f * 0.8, '#ffffff');
          ring(cx, cy, 3.5 + f * 3.1, '#f0abfc');
          star(cx, cy, 6 + f * 2, '#e879f9', '#ffffff', 4 + f);
        } else {
          ring(cx, cy, Math.min(10.8, 5.2 + f * 1.15), f < 6 ? '#d946ef' : '#a21caf');
          if (f <= 5) star(cx, cy, 8 - f, '#f5d0fe', '#ffffff', 5 - (f >> 1));
          for (let b = 0; b < 3; b++) {
            const a = hash(b * 9 + f) * Math.PI * 2, r = 5.5 + f * 0.95;
            bolt(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4, f * 19 + b, '#c026d3', '#fdf4ff');
          }
          for (let s = 0; s < 7; s++) {
            const a = (s / 7) * Math.PI * 2 + t * 0.8, d = 3.2 + t * 8.0;
            px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (s & 1) ? '#ffffff' : '#f0abfc');
          }
        }
      });
    } else if (kind === 'rain_splash') {
      // patch-gg/pixelfx 5-frame 16x16 authentic Minecraft ground raindrop splash crown + ripple!
      sheet = bakePixelSheet(5, 16, false, ({ f, px, ring }) => {
        const cx = 7.5, cy = 10.5;
        if (f <= 3) ring(cx, cy, 1.4 + f * 1.35, f < 2 ? '#e0f2fe' : '#7dd3fc');
        const spread = 1.2 + f * 1.15, h = f < 2 ? (2.2 + f * 1.6) : Math.max(0.5, 4.2 - (f - 1) * 1.3);
        for (const sx of [-1, 0, 1]) {
          const dx = cx + sx * spread, dy = cy - h - (sx === 0 ? 1.0 : 0);
          px(dx, dy, f < 2 ? '#ffffff' : '#bae6fd');
          if (f < 4) px(dx, dy + 1, '#38bdf8');
        }
      });
    } else if (kind === 'lava_pop') {
      // patch-gg/pixelfx 6-frame 16x16 molten lava bubble swell & spark burst
      sheet = bakePixelSheet(6, 16, true, ({ f, disc, ring, px, hash }) => {
        const cx = 7.5, cy = 9.5;
        if (f <= 2) {
          disc(cx, cy - f * 0.5, 1.6 + f * 0.75, '#ea580c');
          disc(cx - 0.4, cy - 0.5 - f * 0.5, 0.9 + f * 0.35, '#fde047');
        } else {
          ring(cx, cy - 1.0, 2.0 + (f - 2) * 1.2, '#f97316');
          for (let s = 0; s < 5; s++) {
            const a = (s / 5) * Math.PI + 0.2 + hash(s) * 0.4;
            const d = 1.5 + (f - 2) * 1.45;
            px(cx + Math.cos(a) * d * 1.2, cy - Math.sin(a) * d * 1.3, (s & 1) ? '#fef08a' : '#fb923c');
          }
        }
      });
    } else if (kind === 'portal_vortex') {
      // patch-gg/pixelfx 6-frame 20x20 swirling dimensional portal rune vortex
      sheet = bakePixelSheet(6, 20, true, ({ f, px, ring, star }) => {
        const cx = 9.5, cy = 9.5;
        ring(cx, cy, 2.5 + (f % 3) * 1.5, (f & 1) ? '#c084fc' : '#e879f9');
        star(cx, cy, 2 + (f & 1), '#f0abfc', '#ffffff', 1);
        for (let arm = 0; arm < 4; arm++) {
          const baseA = (arm / 4) * Math.PI * 2 + f * 0.55;
          for (let r = 2; r <= 7; r++) {
            const a = baseA + r * 0.28;
            px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r < 4 ? '#fdf4ff' : (r < 6 ? '#e879f9' : '#9333ea'));
          }
        }
      });
    } else if (kind === 'smoke_puff') {
      sheet = bakePixelSheet(6, 16, false, ({ f, disc, hash }) => {
        const cols = ['#cbd5e1', '#94a3b8', '#94a3b8', '#64748b', '#475569', '#334155'];
        const col = cols[f];
        const r = f < 3 ? (2.2 + f * 0.9) : (4.2 - (f - 2) * 0.65);
        disc(7.5 + (f > 2 ? -1.5 : 0), 8.0 - f * 0.5, r, col, f >= 3);
        if (f >= 1 && f <= 4) disc(9.5, 7.0 - f * 0.4, Math.max(1.2, r * 0.65), f < 3 ? '#e2e8f0' : '#64748b', f >= 3);
        if (f === 5) disc(4 + ((hash(9) * 7) | 0), 5, 1.5, '#475569', true);
      });
    } else if (kind === 'evoker_spell') {
      // Curly lavender-violet pixel magic swirls matching Evoker casting reference (Image 3)
      sheet = bakePixelSheet(6, 20, false, ({ f, px }) => {
        const cx = 9.5, cy = 9.5, phase = f * 0.65;
        for (let i = 0; i < 20; i++) {
          const a = phase + i * 0.36;
          const r = 1.4 + i * 0.40;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          px(x, y, i > 14 ? '#6d28d9' : (i > 8 ? '#a78bfa' : '#ede9fe'));
        }
        px(cx + Math.cos(phase + 2.1) * 7, cy + Math.sin(phase + 2.1) * 7, '#7c3aed');
      });
    } else if (kind === 'pixelfx_slash_r' || kind === 'pixelfx_slash_l' || kind === 'pixelfx_slash_heavy' || kind === 'pixelfx_slash_fire' || kind === 'pixelfx_slash_prism') {
      // patch-gg/pixelfx-style 6-frame 32x32 tapered pixel-art sword crescent blade arc + dark pixel outline + spark particles
      const rev = (kind === 'pixelfx_slash_l');
      const isHeavy = (kind === 'pixelfx_slash_heavy');
      const isFire = (kind === 'pixelfx_slash_fire');
      const isPrism = (kind === 'pixelfx_slash_prism');
      const prismCols = ['#ef4444', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a855f7', '#f472b6'];
      const outlineCol = isFire ? '#7c2d12' : (isPrism ? '#312e81' : '#0369a1');
      sheet = bakePixelSheet(6, 32, false, ({ f, t, px, star, hash }) => {
        const cx = 15.5, cy = 16.5;
        const headP = Math.min(1.0, (f + 2.0) / 3.1);
        const tailP = Math.max(0.0, (f - 1.3) / 3.6);
        const aMin = -2.45, aMax = 0.68;
        const R = isHeavy ? 13.0 : 11.8;
        const samples = 64;
        for (let s = 0; s <= samples; s++) {
          const u = s / samples;
          if (u < tailP || u > headP) continue;
          const au = rev ? (aMax - (aMax - aMin) * u) : (aMin + (aMax - aMin) * u);
          const prog = (u - tailP) / Math.max(0.08, headP - tailP);
          const thick = Math.max(2, Math.round((isHeavy ? 5.2 : 4.2) * Math.sin(prog * Math.PI * 0.88) * (1 - t * 0.35)));
          const cs = Math.cos(au), sn = Math.sin(au);
          px(cx + cs * (R + 0.9), cy + sn * (R + 0.9), outlineCol);
          for (let w = 0; w < thick; w++) {
            const rw = R - w * 0.95;
            const x = cx + cs * rw, y = cy + sn * rw;
            let col;
            if (isPrism) col = w === 0 && prog > 0.55 ? '#ffffff' : prismCols[(s + f * 2 + w) % prismCols.length];
            else if (isFire) col = w === 0 && prog > 0.50 ? '#ffffff' : (w <= 1 ? '#fde047' : (w === 2 ? '#f97316' : '#dc2626'));
            else if (isHeavy) col = w <= 1 ? '#ffffff' : (w === 2 ? '#fde047' : '#0284c7');
            else col = w === 0 && prog > 0.42 ? '#ffffff' : (w <= 1 ? '#e0f2fe' : (w === 2 ? '#38bdf8' : '#0284c7'));
            px(x, y, col);
            if (isFire && w === thick - 1 && (s % 4 === 0) && f < 5) {
              px(cx + cs * (rw - 1.5), cy + sn * (rw - 1.5) - 1, '#f97316');
            }
          }
          px(cx + cs * (R - thick * 0.95), cy + sn * (R - thick * 0.95), outlineCol);
        }
        // Apex bright pixel spark & trailing detached sparks (classic PixelFX motion polish!)
        if (f >= 1 && f <= 4) {
          const apexA = rev ? (aMax - (aMax - aMin) * headP) : (aMin + (aMax - aMin) * headP);
          star(cx + Math.cos(apexA) * R, cy + Math.sin(apexA) * R, f < 3 ? 2 : 1, isFire ? '#fde047' : '#7dd3fc', '#ffffff', f === 1 ? 1 : 0);
        }
        for (let sp = 0; sp < 5; sp++) {
          const sa = aMin + (aMax - aMin) * hash(sp * 3 + 1);
          const sd = R - 1 + hash(sp * 5 + 2) * 4;
          px(cx + Math.cos(sa) * sd, cy + Math.sin(sa) * sd, isPrism ? prismCols[sp % prismCols.length] : (isFire ? '#fb923c' : '#e0f2fe'));
        }
      });
    } else if (kind === 'slash_arc') {
      sheet = bakePixelSheet(5, 24, true, ({ f, px, line }) => {
        const startA = -1.6 + f * 0.35, endA = startA + 1.8 - f * 0.15;
        const r = 8.5 + f * 0.4;
        for (let i = 0; i <= 14; i++) {
          const a = startA + (endA - startA) * (i / 14);
          const x = 11.5 + Math.cos(a) * r, y = 11.5 + Math.sin(a) * r;
          px(x, y, f < 3 ? '#ffffff' : '#7dd3fc');
          if (i > 3 && i < 12 && f < 4) line(x, y, 11.5 + Math.cos(a) * (r - 1.5), 11.5 + Math.sin(a) * (r - 1.5), f < 2 ? '#e0f2fe' : '#38bdf8');
        }
      });
    } else if (kind === 'crit_star') {
      sheet = bakePixelSheet(6, 16, true, ({ f, star, px }) => {
        const arm = Math.max(1, f < 3 ? 2 + f * 2 : 6 - (f - 2));
        star(7.5, 7.5, arm, f < 4 ? '#facc15' : '#f97316', '#ffffff', f < 4 ? Math.max(1, f) : 0);
        const d = 2 + f * 1.05;
        for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) px(7.5 + sx * d, 7.5 + sy * d, '#fef08a');
      });
    } else if (kind === 'shield_clang' || kind === 'axe_break') {
      const isBreak = (kind === 'axe_break');
      const rCol = isBreak ? '#ef4444' : '#facc15', cCol = isBreak ? '#fca5a5' : '#ffffff';
      sheet = bakePixelSheet(6, 24, true, ({ f, ring, star, px, hash }) => {
        const r = 2.5 + f * 1.65;
        if (f < 5) ring(11.5, 11.5, r, isBreak && (f >= 2) ? '#f97316' : rCol);
        if (f < 3) star(11.5, 11.5, 4 - f, rCol, cCol, 2 - f);
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2 + f * 0.22 + hash(s) * 0.3, d = r + 1.5;
          px(11.5 + Math.cos(a) * d, 11.5 + Math.sin(a) * d, cCol);
        }
      });
    } else if (kind === 'water_splash') {
      sheet = bakePixelSheet(6, 24, false, ({ f, px, disc }) => {
        const h = f < 3 ? (3 + f * 2.5) : (8 - (f - 2) * 1.2);
        for (let i = -3; i <= 3; i++) {
          const x = 11.5 + i * (1.1 + f * 0.32), y = 17 - h + Math.abs(i) * (0.9 + f * 0.25);
          px(x, y, Math.abs(i) < 2 && f < 4 ? '#ffffff' : '#38bdf8');
          if (f < 5) px(x, y + 1, '#bae6fd');
        }
        if (f < 4) disc(11.5, 17.5, Math.max(1, 3.5 - f * 0.6), '#e0f2fe', true);
      });
    } else {
      // Shared magic / aura / sonic / dream sheet generator
      const MAG_PALS = {
        magic_ender:  ['#ffffff', '#f5d0fe', '#d946ef', '#7e22ce'],
        magic_sonic:  ['#ffffff', '#e0f2fe', '#22d3ee', '#0284c7'],
        magic_poison: ['#ffffff', '#bbf7d0', '#4ade80', '#15803d'],
        magic_dream:  ['#ffffff', '#fbcfe8', '#a5f3fc', '#fde68a']
      };
      const cols = MAG_PALS[kind] || MAG_PALS.magic_ender;
      sheet = bakePixelSheet(6, 16, true, ({ f, star, ring, px, hash }) => {
        if (f < 4) ring(7.5, 7.5, 2 + f * 1.4, cols[2]);
        star(7.5, 7.5, Math.max(1, 3 - Math.abs(f - 2)), cols[1], cols[0], f < 4 ? 1 : 0);
        for (let k = 0; k < 4; k++) {
          const a = hash(k + 5) * Math.PI * 2 + f * 0.45, d = 2.5 + f * 0.9;
          px(7.5 + Math.cos(a) * d, 7.5 + Math.sin(a) * d, cols[(k + f) & 3]);
        }
      });
    }
    _pixelFxSheets.set(kind, sheet);
    return sheet;
  }

  const MAX_PIXEL_FX = _isWeakDevice ? 40 : 80;
  const pixelFxList = [], pixelFxPool = [];
  function spawnPixelFx(kind, wx, wy, wz, opts = {}) {
    const cnt = Math.min(opts.count || 1, _isWeakDevice ? 4 : 8);
    const sheet = getPixelFxSheet(kind);
    for (let i = 0; i < cnt; i++) {
      let fx;
      if (pixelFxList.length >= MAX_PIXEL_FX) fx = pixelFxList.shift();
      else if (pixelFxPool.length > 0) { fx = pixelFxPool.pop(); fx.sp.visible = true; }
      else {
        const sp = new THREE.Sprite(sheet.mats[0]);
        sp.frustumCulled = false;
        scene.add(sp);
        fx = { sp, sheet, kind, life: 0.4, maxLife: 0.4, vx: 0, vy: 0, vz: 0, grav: 0, baseScale: 1, grow: 0.2, lastF: -1 };
      }
      fx.sheet = sheet;
      fx.kind = kind;
      fx.lastF = 0;
      fx.sp.material = sheet.mats[0];
      const spr = opts.spread ?? 0.28;
      fx.sp.position.set(wx + (Math.random() - 0.5) * spr, wy + (Math.random() - 0.5) * spr, wz + (Math.random() - 0.5) * spr);
      fx.baseScale = opts.scale ?? 0.85;
      fx.grow = opts.grow ?? 0.25;
      fx.sp.scale.setScalar(fx.baseScale);
      fx.vx = opts.vx !== undefined ? opts.vx : (Math.random() - 0.5) * (opts.randV ?? 0.8);
      fx.vy = opts.vy !== undefined ? opts.vy : (Math.random() * (opts.riseV ?? 0.6));
      fx.vz = opts.vz !== undefined ? opts.vz : (Math.random() - 0.5) * (opts.randV ?? 0.8);
      fx.grav = opts.grav ?? 0;
      fx.life = fx.maxLife = opts.life ?? (0.36 + Math.random() * 0.14);
      pixelFxList.push(fx);
    }
  }
  function updatePixelFx(dt) {
    for (let i = pixelFxList.length - 1; i >= 0; i--) {
      const fx = pixelFxList[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        fx.sp.visible = false;
        pixelFxPool.push(fx);
        pixelFxList[i] = pixelFxList[pixelFxList.length - 1]; pixelFxList.pop();
        continue;
      }
      if (fx.grav) fx.vy -= fx.grav * dt;
      fx.sp.position.x += fx.vx * dt;
      fx.sp.position.y += fx.vy * dt;
      fx.sp.position.z += fx.vz * dt;
      const prog = Math.max(0, Math.min(0.999, 1 - fx.life / fx.maxLife));
      const fIdx = Math.min(fx.sheet.frames - 1, (prog * fx.sheet.frames) | 0);
      if (fIdx !== fx.lastF) {
        fx.lastF = fIdx;
        fx.sp.material = fx.sheet.mats[fIdx];
      }
      fx.sp.scale.setScalar(fx.baseScale * (1 + prog * fx.grow));
    }
  }

  const activeSwordSlashes = [];
  const _SW_MAX_SLICES = 64;
  const _SW_SPARKS_N = 36;
  const _swHiltLocal = new THREE.Vector3(-0.075, -0.075, 0.0);
  const _swTipLocal  = new THREE.Vector3(0.245, 0.245, 0.0);
  const _swTmpHilt   = new THREE.Vector3(), _swTmpTip = new THREE.Vector3();
  const _swTmpDir0   = new THREE.Vector3(), _swTmpDir1 = new THREE.Vector3(), _swTmpDirM = new THREE.Vector3();
  const _swCamInv    = new THREE.Matrix4();

  function _getSwordTrailPalette(def) {
    const sel = (typeof inventory !== 'undefined') ? inventory[player.selectedSlot] : null;
    const isEnch = !!(sel && sel.ench);
    const nm = def && def.name ? def.name : '';
    if (def && def.rainbow) return { core: 0xffffff, edge: 0xf472b6, spark: 0xfef08a, prism: 1.0 };
    if ((def && def.fireDmg) || /Vàng|Gold|Đồng|Copper|Lửa|Fire|Rồng/i.test(nm)) {
      return { core: 0xfffbeb, edge: 0xf59e0b, spark: 0xfde047, prism: 0.0 };
    }
    if (isEnch || /Netherite|Sakura|Mộng|Dream|Thạch Anh|Amethyst/i.test(nm)) {
      return { core: 0xfff0f8, edge: 0xff4fa8, spark: 0xfef08a, prism: 0.0 };
    }
    if (/Kim Cương|Diamond|Sculk|Warden|Resonant|Soulforged|Umbra|Aetherium|Ichor|Cộng Hưởng/i.test(nm) || (def && (def.tier || 0) >= 4)) {
      return { core: 0xf0fdff, edge: 0x06e5ff, spark: 0xfef08a, prism: 0.0 };
    }
    return { core: 0xffffff, edge: 0x38bdf8, spark: 0xfef08a, prism: 0.0 };
  }

  function _getBladeEndpoints(toolKind, outHilt, outTip) {
    if (toolKind === 'sword') {
      outHilt.set(-0.025, -0.025, 0.0); outTip.set(0.235, 0.235, 0.0);
    } else if (toolKind === 'pick' || toolKind === 'axe' || toolKind === 'shovel' || toolKind === 'hoe') {
      outHilt.set(0.015, 0.015, 0.0); outTip.set(0.230, 0.230, 0.0);
    } else {
      outHilt.set(-0.015, -0.015, 0.0); outTip.set(0.235, 0.235, 0.0);
    }
  }

  function _createAfterswingRibbonTexture() {
    if (_createAfterswingRibbonTexture._tex) return _createAfterswingRibbonTexture._tex;
    const W = 128, H = 128;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    // Generate crisp glowing leading blade core (y=0) fading smoothly into wispy layered flame/silk wisps (y=127)
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      const decay = Math.pow(Math.max(0, 1.0 - v), 1.38);
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const hiltMask = Math.min(1.0, Math.max(0.18, (u - 0.02) / 0.24));
        const tipGlow = 0.72 + 0.28 * Math.pow(u, 1.2);
        const w1 = 0.5 + 0.5 * Math.sin(u * 26.0 + v * 5.2 + Math.cos(u * 11.0 - v * 3.0) * 1.3);
        const w2 = 0.5 + 0.5 * Math.sin(u * 47.0 - v * 8.5 + Math.sin(v * 7.0) * 1.4);
        const wisps = Math.pow(w1 * 0.62 + w2 * 0.38, 1.35);
        const coreBand = Math.exp(-v * 9.5);
        const intensity = Math.max(0, Math.min(1, hiltMask * tipGlow * (coreBand + (1.0 - coreBand) * decay * (0.38 + 0.72 * wisps))));
        const pi = (y * W + x) * 4;
        const val = Math.round(intensity * 255);
        d[pi] = val; d[pi + 1] = val; d[pi + 2] = val; d[pi + 3] = val;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    _createAfterswingRibbonTexture._tex = tex;
    return tex;
  }

  function _sampleSwordBladeSpace(outHilt, outTip, inCameraSpace, toolKind = 'sword') {
    _getBladeEndpoints(toolKind, _swHiltLocal, _swTipLocal);
    if (!inCameraSpace) {
      if (typeof playerAvatar !== 'undefined' && playerAvatar && playerAvatar.handHold && playerAvatar.g) {
        playerAvatar.g.updateMatrixWorld(true);
        const c0 = playerAvatar.handHold.children[0];
        const swordObj = (c0 && c0.children && c0.children[0]) ? c0.children[0] : c0;
        if (swordObj && swordObj.matrixWorld) {
          outHilt.copy(_swHiltLocal).applyMatrix4(swordObj.matrixWorld);
          outTip.copy(_swTipLocal).applyMatrix4(swordObj.matrixWorld);
          return true;
        }
      }
      outHilt.set(player.x, player.y + 1.1, player.z);
      outTip.copy(outHilt).add(new THREE.Vector3(0, 0.45, -0.45));
      return false;
    }
    if (typeof camera !== 'undefined' && camera && typeof activeHeldObj !== 'undefined' && activeHeldObj && activeHeldObj.visible !== false) {
      camera.updateMatrixWorld(true);
      if (typeof heldPivot !== 'undefined' && heldPivot) heldPivot.updateMatrixWorld(true);
      _swCamInv.copy(camera.matrixWorld).invert();
      outHilt.copy(_swHiltLocal).applyMatrix4(activeHeldObj.matrixWorld).applyMatrix4(_swCamInv);
      outTip.copy(_swTipLocal).applyMatrix4(activeHeldObj.matrixWorld).applyMatrix4(_swCamInv);
      return true;
    }
    outHilt.set(0.18, -0.18, -0.52);
    outTip.set(0.18, 0.22, -0.62);
    return false;
  }

  function _createSlashSparkTexture() {
    if (_createSlashSparkTexture._tex) return _createSlashSparkTexture._tex;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const halo = ctx.createRadialGradient(32, 32, 0, 32, 32, 24);
    halo.addColorStop(0.0, 'rgba(255,255,255,0.92)');
    halo.addColorStop(0.28, 'rgba(255,248,210,0.45)');
    halo.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(32, 2);
    ctx.quadraticCurveTo(34, 30, 62, 32);
    ctx.quadraticCurveTo(34, 34, 32, 62);
    ctx.quadraticCurveTo(30, 34, 2, 32);
    ctx.quadraticCurveTo(30, 30, 32, 2);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    _createSlashSparkTexture._tex = tex;
    return tex;
  }

  function _disposeSwordTrail(tr) {
    if (tr.parentObj) {
      tr.parentObj.remove(tr.mesh);
      tr.parentObj.remove(tr.sparks);
    }
    tr.geo.dispose();
    tr.mat.dispose();
    tr.sparkGeo.dispose();
    tr.sparkMat.dispose();
  }

  function spawnSwordSlashArc(comboHit = 1, def = null, didHit = false, isEquip = false) {
    if (activeSwordSlashes.length >= 5) {
      _disposeSwordTrail(activeSwordSlashes.shift());
    }
    const pal = _getSwordTrailPalette(def);
    const in1p = !(typeof thirdPerson !== 'undefined' && thirdPerson > 0);
    const parentObj = (in1p && typeof camera !== 'undefined' && camera) ? camera : scene;
    const toolKind = (def && def.tool) ? def.tool : 'sword';
    const maxV = _SW_MAX_SLICES * 2;
    const posArr = new Float32Array(maxV * 3);
    const uvArr = new Float32Array(maxV * 2);
    const idx = [];
    for (let s = 0; s < _SW_MAX_SLICES - 1; s++) {
      const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posArr, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
    const uvAttr = new THREE.BufferAttribute(uvArr, 2); uvAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('uv', uvAttr);
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTrailTex: { value: _createAfterswingRibbonTexture() },
        uCoreCol:  { value: new THREE.Color(pal.core) },
        uEdgeCol:  { value: new THREE.Color(pal.edge) },
        uFade:     { value: isEquip ? 0.78 : 1.0 },
        uTime:     { value: 0.0 },
        uPrism:    { value: pal.prism }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uTrailTex;
        uniform vec3 uCoreCol, uEdgeCol;
        uniform float uFade, uTime, uPrism;
        varying vec2 vUv;
        void main() {
          // vUv.x = hilt(0)..tip(1), vUv.y = newest slice(0)..fading tail(1)
          float span = clamp(vUv.x, 0.0, 1.0);
          float ageV = clamp(vUv.y, 0.0, 1.0);
          float wispTex = texture2D(uTrailTex, vec2(span, ageV)).r;
          float leadEdge = pow(1.0 - ageV, 7.5) * 0.80 * smoothstep(0.06, 0.45, span);
          float sharpOuter = pow(span, 3.6) * (1.0 - ageV * 0.72) * 0.65;
          vec3 edgeC = uEdgeCol;
          if (uPrism > 0.5) {
            float ph = span * 4.5 - ageV * 5.0 - uTime * 8.0;
            edgeC = 0.55 + 0.45 * cos(ph + vec3(0.0, 2.094, 4.188));
          }
          float coreMix = clamp(leadEdge * 0.55 + pow(span, 5.2) * (1.0 - ageV * 0.6) * 0.65, 0.0, 0.85);
          vec3 col = mix(edgeC, uCoreCol, coreMix);
          float alpha = clamp((wispTex * 1.05 + leadEdge * 0.45 + sharpOuter * 0.40) * smoothstep(0.06, 0.34, span) * uFade, 0.0, 0.92);
          gl_FragColor = vec4(col * (1.26 + coreMix * 0.40), alpha);
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: !in1p,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    parentObj.add(mesh);

    const spPos = new Float32Array(_SW_SPARKS_N * 3);
    const spVel = new Float32Array(_SW_SPARKS_N * 3);
    const spCol = new Float32Array(_SW_SPARKS_N * 3);
    const cEdge = new THREE.Color(pal.edge), cSpark = new THREE.Color(pal.spark || 0xfef08a), cWhite = new THREE.Color(0xffffff);
    for (let si = 0; si < _SW_SPARKS_N; si++) {
      const sc = (si % 3 === 0) ? cWhite : ((si % 3 === 1) ? cSpark : cEdge);
      spCol[si * 3] = sc.r; spCol[si * 3 + 1] = sc.g; spCol[si * 3 + 2] = sc.b;
    }
    const sparkGeo = new THREE.BufferGeometry();
    const spAttr = new THREE.BufferAttribute(spPos, 3); spAttr.setUsage(THREE.DynamicDrawUsage);
    sparkGeo.setAttribute('position', spAttr);
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
    sparkGeo.setDrawRange(0, 0);
    const sparkMat = new THREE.PointsMaterial({
      map: _createSlashSparkTexture(),
      vertexColors: true,
      size: in1p ? (didHit ? 0.068 : 0.056) : (didHit ? 0.22 : 0.18),
      transparent: true,
      opacity: isEquip ? 0.85 : 0.98,
      depthWrite: false,
      depthTest: !in1p,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    sparks.renderOrder = 11;
    parentObj.add(sparks);

    _sampleSwordBladeSpace(_swTmpHilt, _swTmpTip, in1p, toolKind);

    activeSwordSlashes.push({
      parentObj, mesh, geo, mat, posArr, uvArr, posAttr, uvAttr,
      sparks, sparkGeo, sparkMat, spPos, spVel, spAttr, sparkCount: 0,
      rawSlices: [{ hx: _swTmpHilt.x, hy: _swTmpHilt.y, hz: _swTmpHilt.z, tx: _swTmpTip.x, ty: _swTmpTip.y, tz: _swTmpTip.z, t: 0 }],
      lastHilt: _swTmpHilt.clone(),
      lastTip: _swTmpTip.clone(),
      isFirstPerson: in1p, toolKind, isEquip: !!isEquip,
      age: 0, prevSampleAge: 0,
      recordDur: isEquip ? 0.26 : 0.30,
      sliceLife: isEquip ? 0.23 : 0.26,
      maxLife: isEquip ? 0.44 : 0.50,
      didHit: !!didHit, comboHit
    });
  }

  function updateSwordSlashes(dt) {
    const curIs1p = !(typeof thirdPerson !== 'undefined' && thirdPerson > 0);
    for (let i = activeSwordSlashes.length - 1; i >= 0; i--) {
      const tr = activeSwordSlashes[i];
      tr.age += dt;
      if (tr.age >= tr.maxLife) {
        _disposeSwordTrail(tr);
        activeSwordSlashes[i] = activeSwordSlashes[activeSwordSlashes.length - 1];
        activeSwordSlashes.pop();
        continue;
      }
      const visMatch = (tr.isFirstPerson === curIs1p);
      tr.mesh.visible = visMatch;
      tr.sparks.visible = visMatch;

      if (tr.age <= tr.recordDur && tr.rawSlices.length < _SW_MAX_SLICES) {
        _sampleSwordBladeSpace(_swTmpHilt, _swTmpTip, tr.isFirstPerson, tr.toolKind);
        const moveDist = _swTmpTip.distanceTo(tr.lastTip);
        if (moveDist > 0.008) {
          const subSteps = Math.min(_SW_MAX_SLICES - tr.rawSlices.length, Math.max(1, Math.min(5, Math.ceil(moveDist / 0.09))));
          _swTmpDir0.subVectors(tr.lastTip, tr.lastHilt);
          const len0 = Math.max(0.14, _swTmpDir0.length());
          _swTmpDir0.divideScalar(len0);
          _swTmpDir1.subVectors(_swTmpTip, _swTmpHilt);
          const len1 = Math.max(0.14, _swTmpDir1.length());
          _swTmpDir1.divideScalar(len1);
          const t0 = tr.prevSampleAge;
          for (let st = 1; st <= subSteps; st++) {
            const u = st / subSteps;
            const hx = tr.lastHilt.x + (_swTmpHilt.x - tr.lastHilt.x) * u;
            const hy = tr.lastHilt.y + (_swTmpHilt.y - tr.lastHilt.y) * u;
            const hz = tr.lastHilt.z + (_swTmpHilt.z - tr.lastHilt.z) * u;
            _swTmpDirM.copy(_swTmpDir0).lerp(_swTmpDir1, u).normalize();
            const lenM = len0 + (len1 - len0) * u;
            tr.rawSlices.push({
              hx, hy, hz,
              tx: hx + _swTmpDirM.x * lenM,
              ty: hy + _swTmpDirM.y * lenM,
              tz: hz + _swTmpDirM.z * lenM,
              t: t0 + (tr.age - t0) * u
            });
          }
          if (tr.sparkCount < _SW_SPARKS_N) {
            const addN = Math.min(_SW_SPARKS_N - tr.sparkCount, tr.didHit ? 5 : 3);
            const vScale = tr.isFirstPerson ? 0.38 : 1.0;
            for (let k = 0; k < addN; k++) {
              const si = tr.sparkCount++;
              const sb = si * 3;
              const f = 0.35 + Math.random() * 0.72;
              const j = tr.isFirstPerson ? 0.045 : 0.10;
              tr.spPos[sb]     = _swTmpHilt.x + (_swTmpTip.x - _swTmpHilt.x) * f + (Math.random() - 0.5) * j;
              tr.spPos[sb + 1] = _swTmpHilt.y + (_swTmpTip.y - _swTmpHilt.y) * f + (Math.random() - 0.5) * j;
              tr.spPos[sb + 2] = _swTmpHilt.z + (_swTmpTip.z - _swTmpHilt.z) * f + (Math.random() - 0.5) * j;
              tr.spVel[sb]     = (_swTmpTip.x - tr.lastTip.x) * 2.1 + (Math.random() - 0.5) * 0.75 * vScale;
              tr.spVel[sb + 1] = (_swTmpTip.y - tr.lastTip.y) * 2.1 + (0.32 + Math.random() * 0.55) * vScale;
              tr.spVel[sb + 2] = (_swTmpTip.z - tr.lastTip.z) * 2.1 + (Math.random() - 0.5) * 0.75 * vScale;
            }
          }
          tr.lastHilt.copy(_swTmpHilt);
          tr.lastTip.copy(_swTmpTip);
        }
        tr.prevSampleAge = tr.age;
      }

      const n = tr.rawSlices.length;
      if (n >= 2) {
        const denom = n - 1;
        for (let s = 0; s < n; s++) {
          const sl = tr.rawSlices[s];
          const ageRatio = Math.max(0, Math.min(1, (tr.age - sl.t) / tr.sliceLife));
          const tailPinch = Math.pow(s / denom, 0.72);
          const taper = Math.pow(1.0 - ageRatio, 1.55) * tailPinch; // Sleek pointed crescent tail + quadratic decay
          const mx = sl.hx * 0.28 + sl.tx * 0.72, my = sl.hy * 0.28 + sl.ty * 0.72, mz = sl.hz * 0.28 + sl.tz * 0.72;
          const b = s * 6;
          tr.posArr[b]     = mx + (sl.hx - mx) * taper;
          tr.posArr[b + 1] = my + (sl.hy - my) * taper;
          tr.posArr[b + 2] = mz + (sl.hz - mz) * taper;
          tr.posArr[b + 3] = mx + (sl.tx - mx) * taper;
          tr.posArr[b + 4] = my + (sl.ty - my) * taper;
          tr.posArr[b + 5] = mz + (sl.tz - mz) * taper;
          // UV: x = hilt(0)->tip(1), y = newest slice(0)->trailing fade(1) for flame/silk ribbon scrolling
          const uvY = Math.min(1.0, Math.max(ageRatio, 1.0 - tailPinch * 0.95));
          const ub = s * 4;
          tr.uvArr[ub] = 0.0; tr.uvArr[ub + 1] = uvY;
          tr.uvArr[ub + 2] = 1.0; tr.uvArr[ub + 3] = uvY;
        }
        tr.posAttr.needsUpdate = true;
        tr.uvAttr.needsUpdate = true;
        tr.geo.setDrawRange(0, denom * 6);
      }
      const globalFade = tr.age <= tr.recordDur * 0.60 ? 1.0 : Math.max(0.0, 1.0 - (tr.age - tr.recordDur * 0.60) / (tr.maxLife - tr.recordDur * 0.60));
      tr.mat.uniforms.uFade.value = (tr.isEquip ? 0.78 : 1.0) * globalFade * globalFade;
      tr.mat.uniforms.uTime.value = tr.age;
      tr.sparkMat.opacity = (tr.isEquip ? 0.85 : 0.98) * globalFade * globalFade;
      if (tr.sparkCount > 0) {
        const turb = tr.isFirstPerson ? 0.14 : 0.42;
        for (let s = 0; s < tr.sparkCount; s++) {
          const sb = s * 3;
          tr.spPos[sb]     += (tr.spVel[sb] + Math.sin(tr.age * 9.5 + s * 1.7) * turb) * dt;
          tr.spPos[sb + 1] += (tr.spVel[sb + 1] + Math.abs(Math.sin(tr.age * 5.0 + s * 1.1)) * turb * 1.2) * dt;
          tr.spPos[sb + 2] += (tr.spVel[sb + 2] + Math.cos(tr.age * 8.2 + s * 2.1) * turb) * dt;
          tr.spVel[sb] *= 0.92; tr.spVel[sb + 1] *= 0.92; tr.spVel[sb + 2] *= 0.92;
        }
        tr.spAttr.needsUpdate = true;
        tr.sparkGeo.setDrawRange(0, tr.sparkCount);
      }
    }
  }

  let _chargedAuraTex = null;
  function getChargedAuraTex() {
    if (_chargedAuraTex) return _chargedAuraTex;
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const drawBolt = (pts, col) => {
      c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
      pts.forEach((p, idx) => idx === 0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]));
      c.stroke();
    };
    drawBolt([[4,0],[9,7],[5,14],[11,22],[6,32]], '#38bdf8');
    drawBolt([[18,0],[14,9],[20,17],[15,25],[19,32]], '#7dd3fc');
    drawBolt([[27,2],[23,11],[29,19],[24,28]], '#e0f2fe');
    drawBolt([[0,12],[8,10],[16,13],[25,9],[32,12]], '#38bdf8');
    c.fillStyle = '#ffffff';
    for (const [sx, sy] of [[9,7],[14,9],[20,17],[5,14],[24,28]]) c.fillRect(sx, sy, 2, 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _chargedAuraTex = tex;
    return tex;
  }

  // ImmediatelyFast + Zero-GC Instanced Particle Batch (1 WebGL draw call for up to 150 particles!)
  const MAX_PARTICLES = _isWeakDevice ? 84 : 150;
  const particles = [], partGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const particlePool = [];
  const _partDummy = new THREE.Object3D(), _partColor = new THREE.Color(0xffffff);
  const _partInstMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const _partInstMesh = new THREE.InstancedMesh(partGeo, _partInstMat, MAX_PARTICLES);
  _partInstMesh.frustumCulled = false;
  _partInstMesh.count = 0;
  _partInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _partInstMesh.setColorAt(0, _partColor);
  if (_partInstMesh.instanceColor) _partInstMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(_partInstMesh);
  function _spawnOneParticle(wx, wy, wz, colorHex, opts) {
    if (typeof sodiumOpts !== 'undefined' && !sodiumOpts.particles) return;
    if (sodiumOpts.immFast) {
      const pdx = wx - player.x, pdz = wz - player.z, pd2 = pdx * pdx + pdz * pdz;
      if (pd2 > 1024.0) return;
      if (pd2 > 36.0 && (-Math.sin(player.yaw) * pdx - Math.cos(player.yaw) * pdz) < -3.2) return;
    }
    let p;
    if (particles.length >= MAX_PARTICLES) {
      p = particles.shift();
    } else if (particlePool.length > 0) {
      p = particlePool.pop();
    } else {
      p = { x: 0, y: 0, z: 0, rx: 0, ry: 0, color: new THREE.Color(0xffffff), vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.5, rise: false, kind: 'debris', grav: 14, baseScale: 1, rxSpd: 0, rySpd: 0 };
    }
    p.color.setHex(colorHex);
    const sp = opts.spread ?? 0.55;
    p.x = wx + (Math.random() - 0.5) * sp;
    p.y = wy + (Math.random() - 0.5) * sp;
    p.z = wz + (Math.random() - 0.5) * sp;
    p.rx = Math.random() * 3.1;
    p.ry = Math.random() * 3.1;
    p.baseScale = opts.scale ?? 1.0;
    p.vx = opts.vx ?? ((Math.random() - 0.5) * 1.4);
    p.vy = opts.vy ?? 1.6;
    p.vz = opts.vz ?? ((Math.random() - 0.5) * 1.4);
    p.life = p.maxLife = opts.life ?? 0.5;
    p.rise = !!opts.rise;
    p.kind = opts.kind || 'debris';
    p.grav = opts.grav ?? (p.rise ? 0 : 14);
    p.rxSpd = opts.rotSpd ?? ((Math.random() - 0.5) * 6.0);
    p.rySpd = (Math.random() - 0.5) * 6.0;
    particles.push(p);
  }
  function spawnVoxelFx(kind, wx, wy, wz, count = 6, colOverride = null) {
    if (typeof sodiumOpts !== 'undefined' && !sodiumOpts.particles) return;
    const n = Math.min(count, 24);
    const PALS = {
      flame: [0xff6b00, 0xfacc15, 0xef4444, 0xfef08a],
      ember: [0xfef08a, 0xf97316, 0xffedd5],
      smoke: [0x475569, 0x64748b, 0x334155],
      spark: [0x38bdf8, 0xe0f2fe, 0xffffff],
      snow:  [0xe0f2fe, 0xbae6fd, 0x7dd3fc],
      magic: [0xc084fc, 0xa855f7, 0x4ade80]
    };
    // Layered Code-Driven PixelFX Sprite-Sheet Bursts + micro voxel accents
    if (kind === 'flame') {
      spawnPixelFx('fire_flame', wx, wy + 0.14, wz, { count: Math.max(1, Math.min(4, Math.ceil(n / 3))), scale: 0.88, life: 0.46, riseV: 1.15, randV: 0.42, spread: 0.38 });
    } else if (kind === 'soul_flame') {
      spawnPixelFx('soul_flame', wx, wy + 0.14, wz, { count: Math.max(1, Math.min(3, Math.ceil(n / 3))), scale: 0.88, life: 0.46, riseV: 1.15, randV: 0.40, spread: 0.36 });
      return;
    } else if (kind === 'ember') {
      spawnPixelFx('fire_flame', wx, wy + 0.10, wz, { count: 1, scale: 0.52, life: 0.38, riseV: 1.45, randV: 0.65, spread: 0.44 });
    } else if (kind === 'end_crystal') {
      spawnPixelFx('end_crystal_burst', wx, wy + 0.20, wz, { count: Math.max(2, Math.min(5, n)), scale: 1.55, life: 0.52, riseV: 0.5, randV: 1.8, spread: 0.85 });
      return;
    } else if (kind === 'lava_pop') {
      spawnPixelFx('lava_pop', wx, wy + 0.08, wz, { count: 1, scale: 0.72, life: 0.42, riseV: 0.65, randV: 0.35, spread: 0.35 });
      return;
    } else if (kind === 'portal_vortex') {
      spawnPixelFx('portal_vortex', wx, wy + 0.15, wz, { count: Math.max(1, Math.min(3, n)), scale: 0.85, life: 0.50, riseV: 0.45, randV: 0.5, spread: 0.48 });
      return;
    } else if (kind === 'smoke') {
      spawnPixelFx('smoke_puff', wx, wy + 0.10, wz, { count: Math.max(1, Math.min(3, Math.ceil(n / 4))), scale: 0.85, life: 0.56, riseV: 0.75, randV: 0.3, spread: 0.42 });
    } else if (kind === 'spark' || kind === 'electric') {
      spawnPixelFx('lightning_arc', wx, wy + 0.15, wz, { count: Math.max(1, Math.min(3, Math.ceil(n / 5))), scale: 1.15, life: 0.34, randV: 1.2, spread: 0.65 });
      spawnPixelFx('electric_coil', wx, wy + 0.10, wz, { count: Math.max(1, Math.min(2, Math.ceil(n / 7))), scale: 0.82, life: 0.36, randV: 1.5, spread: 0.72 });
      return;
    } else if (kind === 'snow' || kind === 'ice' || kind === 'frost') {
      spawnPixelFx('ice_shatter', wx, wy + 0.15, wz, { count: Math.max(1, Math.min(3, Math.ceil(n / 5))), scale: 1.10, life: 0.44, randV: 0.9, spread: 0.62 });
      spawnPixelFx('frost_aura', wx, wy + 0.10, wz, { count: Math.max(1, Math.min(3, Math.ceil(n / 5))), scale: 0.72, life: 0.52, riseV: 0.4, randV: 0.8, spread: 0.70 });
      return;
    } else if (kind === 'magic' || kind === 'dream') {
      spawnPixelFx(kind === 'dream' ? 'magic_dream' : 'magic_ender', wx, wy + 0.15, wz, { count: Math.max(1, Math.min(3, Math.ceil(n / 4))), scale: 0.78, life: 0.46, riseV: 0.6, randV: 0.6, spread: 0.50 });
    }
    const pal = PALS[kind] || PALS.flame;
    const cubeLim = (kind === 'flame' || kind === 'smoke') ? Math.max(1, n >> 1) : n;
    for (let i = 0; i < cubeLim; i++) {
      const col = colOverride ?? pal[(Math.random() * pal.length) | 0];
      if (kind === 'flame') {
        _spawnOneParticle(wx, wy, wz, col, { kind, rise: true, spread: 0.42, scale: 0.65 + Math.random() * 0.35, vx: (Math.random() - 0.5) * 0.65, vy: 1.5 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.65, life: 0.34 + Math.random() * 0.18, grav: -1.6 });
      } else if (kind === 'ember') {
        _spawnOneParticle(wx, wy, wz, col, { kind, rise: true, spread: 0.50, scale: 0.45 + Math.random() * 0.25, vx: (Math.random() - 0.5) * 1.6, vy: 2.2 + Math.random() * 2.1, vz: (Math.random() - 0.5) * 1.6, life: 0.50 + Math.random() * 0.30, grav: -0.8 });
      } else if (kind === 'smoke') {
        _spawnOneParticle(wx, wy, wz, col, { kind, rise: true, spread: 0.48, scale: 0.85 + Math.random() * 0.40, vx: (Math.random() - 0.5) * 0.45, vy: 0.95 + Math.random() * 0.85, vz: (Math.random() - 0.5) * 0.45, life: 0.55 + Math.random() * 0.30, grav: -0.4, rotSpd: 1.8 });
      } else {
        _spawnOneParticle(wx, wy, wz, col, { kind, rise: true, spread: 0.55, scale: 0.58, vx: (Math.random() - 0.5) * 1.4, vy: 1.2 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.4, life: 0.48, grav: 0 });
      }
    }
  }
  function spawnParticles(wx, wy, wz, colorHex, count = 8, rise = false) {
    if (typeof sodiumOpts !== 'undefined' && !sodiumOpts.particles) return;
    let n = Math.min(count, 24);
    if (sodiumOpts.immFast && particles.length > (MAX_PARTICLES * 0.65)) {
      n = Math.max(2, (n * 0.6) | 0);
    }
    for (let i = 0; i < n; i++) {
      _spawnOneParticle(wx, wy, wz, colorHex, {
        kind: rise ? 'rise' : 'debris',
        rise,
        vx: (Math.random() - 0.5) * (rise ? 1.2 : 3.6),
        vy: rise ? (1.4 + Math.random() * 2.2) : (2.0 + Math.random() * 3.0),
        vz: (Math.random() - 0.5) * (rise ? 1.2 : 3.6),
        life: rise ? 0.45 : 0.50,
        grav: rise ? 0 : 14
      });
    }
  }
  function updateParticles(dt) {
    updatePixelFx(dt);
    updateSwordSlashes(dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt;
      if (p.life <= 0) { particlePool.push(p); particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
      if (p.grav) p.vy -= p.grav * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;
      if (!p.rise && p.vy < -1.0 && isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        p.vy = -p.vy * 0.34; p.vx *= 0.60; p.vz *= 0.60;
      } else {
        p.x = nx; p.y = ny; p.z = nz;
      }
      p.rx += p.rxSpd * dt; p.ry += p.rySpd * dt;
      const t = Math.max(0.01, p.life / (p.maxLife || 0.5));
      const sc = p.kind === 'smoke' ? (p.baseScale * (0.95 + (1 - t) * 0.75) * Math.min(1, t * 2.4)) : (p.baseScale * t * 1.15);
      _partDummy.position.set(p.x, p.y, p.z);
      _partDummy.rotation.set(p.rx, p.ry, 0);
      _partDummy.scale.setScalar(Math.max(0.01, sc));
      _partDummy.updateMatrix();
      _partInstMesh.setMatrixAt(i, _partDummy.matrix);
      _partInstMesh.setColorAt(i, p.color);
    }
    _partInstMesh.count = particles.length;
    if (particles.length > 0) {
      _partInstMesh.instanceMatrix.needsUpdate = true;
      if (_partInstMesh.instanceColor) _partInstMesh.instanceColor.needsUpdate = true;
    }
  }


  /* ============================================================================
   * 9. RAYCASTING, PHYSICS, ARMOR MITIGATION & RHYTHMIC HOLD-TO-MINE
   * ============================================================================ */
  const _rayDir = new THREE.Vector3(), _rayEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  function dropAllPlayerItemsOnDeath() {
    if (gameMode === 'creative') return 0;
    let droppedCount = 0;
    const dx = player.x, dy = player.y + 0.45, dz = player.z;
    const scatterItem = (id, count, meta = null) => {
      if (!id || count <= 0 || !BLOCK_DEF[id]) return;
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.4 + Math.random() * 2.2;
      const def = BLOCK_DEF[id];
      const maxDur = (meta && meta.maxDur) || (def && def.maxDur) || 0;
      const dur = (meta && typeof meta.dur === 'number' && meta.dur > 0) ? meta.dur : maxDur;
      spawnDroppedItem(dx, dy, dz, id, {
        exactPos: true,
        count,
        dur,
        maxDur,
        ench: !!(meta && meta.ench),
        trim: (meta && meta.trim) ? { ...meta.trim } : null,
        vx: Math.cos(ang) * spd,
        vy: 2.5 + Math.random() * 1.8,
        vz: Math.sin(ang) * spd,
        pickupDelay: 0.75,
        fromDeath: true
      });
      droppedCount += count;
    };
    for (let i = 0; i < inventory.length; i++) {
      const s = inventory[i];
      if (s && s.count > 0 && s.id) {
        scatterItem(s.id, s.count, { dur: s.dur || 0, maxDur: s.maxDur || 0, ench: !!s.ench, trim: s.trim ? { ...s.trim } : null });
        s.id = 0; s.count = 0; s.dur = 0; s.maxDur = 0; s.ench = false; s.trim = null;
      }
    }
    for (const eqKey of ['helmet', 'chest', 'legs', 'boots', 'offhand']) {
      const eqId = player.equip[eqKey];
      if (eqId) {
        const em = player.equipMeta && player.equipMeta[eqKey];
        const meta = (eqKey === 'offhand' && eqId === B.SHIELD)
          ? { dur: player.offhandDur || 336, maxDur: player.offhandMaxDur || 336, ench: !!(em && em.ench), trim: (em && em.trim) ? { ...em.trim } : null }
          : (em ? { dur: em.dur || 0, maxDur: em.maxDur || 0, ench: !!em.ench, trim: em.trim ? { ...em.trim } : null } : null);
        scatterItem(eqId, 1, meta);
        player.equip[eqKey] = 0;
        if (player.equipMeta) player.equipMeta[eqKey] = null;
      }
    }
    player.offhandDur = 336; player.offhandMaxDur = 336;
    if (typeof flushNetworkDropBatch === 'function') flushNetworkDropBatch();
    if (typeof schedulePlayerRoomSave === 'function') schedulePlayerRoomSave(true);
    recalcPlayerArmor();
    renderHotbar();
    renderEquipmentUI();
    return droppedCount;
  }

  function hurtPlayer(amount, reason, bypassAll = false, knockBack = false, opts = null) {
    if (player.dead || gameMode === 'creative') return;
    if (!bypassAll && player.invuln > 0) return;
    if (!bypassAll) {
      const _dMul = getDifficultyCfg().dmgMul;
      if (_dMul <= 0) return;
      amount *= _dMul;
    }
    if (!bypassAll && isPlayerShieldBlocking() && (player.shieldRaiseT || 0) > 0.30) {
      let blockOk = true;
      if (opts && opts.fromPos) {
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
        const ax = opts.fromPos.x - player.x, az = opts.fromPos.z - player.z;
        const aLen = Math.hypot(ax, az) || 1;
        blockOk = (ax * fx + az * fz) >= -0.20 * aLen;
      }
      if (blockOk) {
        playSfx('equip');
        spawnPixelFx('shield_clang', player.x - Math.sin(player.yaw) * 0.55, player.y + 1.15, player.z - Math.cos(player.yaw) * 0.55, { count: 1, scale: 1.1, life: 0.34 });
        if (knockBack && !player.flying) {
          player.vx += Math.sin(player.yaw) * 2.2;
          player.vz += Math.cos(player.yaw) * 2.2;
        }
        damagePlayerShield(Math.max(1, Math.ceil(amount)), !!(opts && opts.isAxe));
        player.invuln = 0.22;
        return;
      }
    }
    let shieldMul = 1.0;
    if (opts && opts.fromPos) {
      let bestAtt = null, bestAD = 12;
      for (let ai = 0; ai < mobs.length; ai++) {
        const mb = mobs[ai];
        if (!mb || mb._dead || mb.tamed || !mb.hostile) continue;
        const d = Math.hypot(mb.x - opts.fromPos.x, mb.z - opts.fromPos.z);
        if (d < bestAD) { bestAD = d; bestAtt = mb; }
      }
      if (bestAtt) {
        _playerCombatTarget = bestAtt; _playerCombatTargetT = 12.0;
        if (player.dragonArmorSet === 'fire' && !FIRE_IMMUNE_MOBS.has(bestAtt.type)) {
          bestAtt.burning = true; bestAtt.burnTime = Math.max(bestAtt.burnTime || 0, 4.0);
        }
      }
    }
    if (!bypassAll && player.blockingT > 0 && (player.shieldDisableT || 0) <= 0) {
      shieldMul = 0.25;
      playSfx('equip');
    }
    const effArmor = Math.max(player.armor * 0.28, player.armor - (4 * amount) / (2 + (player.armorToughness || 0) * 0.25));
    const armorRed = Math.min(0.76, effArmor <= 20 ? effArmor * 0.032 : (0.64 + (effArmor - 20) * 0.0085));
    const reduced = bypassAll ? amount : Math.max(0.5, Math.round(amount * shieldMul * (1.0 - armorRed) * 2) / 2);
    if (!bypassAll && reduced > 0 && player.armor > 0) {
      const armorDmg = Math.max(1, Math.floor(amount * 0.25));
      let eqBroken = false;
      for (const ek of ['helmet', 'chest', 'legs', 'boots']) {
        const aid = player.equip[ek];
        const aDef = aid ? BLOCK_DEF[aid] : null;
        if (!aid || !aDef || !aDef.maxDur) continue;
        if (!player.equipMeta) player.equipMeta = { helmet: null, chest: null, legs: null, boots: null, offhand: null };
        if (!player.equipMeta[ek]) player.equipMeta[ek] = { dur: aDef.maxDur, maxDur: aDef.maxDur, ench: false, trim: null };
        const em = player.equipMeta[ek];
        if (!em.maxDur) em.maxDur = aDef.maxDur;
        if (typeof em.dur !== 'number' || em.dur <= 0) em.dur = em.maxDur;
        em.dur = Math.max(0, em.dur - armorDmg);
        if (em.dur <= 0) { player.equip[ek] = 0; player.equipMeta[ek] = null; eqBroken = true; playSfx('break'); }
      }
      if (eqBroken) { recalcPlayerArmor(); renderEquipmentUI(); }
    }
    player.hp = Math.max(0, player.hp - reduced); player.invuln = bypassAll ? 0.25 : 0.55; player.hurtAnimT = 0.42; cameraShake = Math.max(cameraShake, 0.22); playSfx('hurt');
    // Văng người RA SAU theo hướng đang nhìn (Netherite +10%/món chống đẩy lùi = tối đa 40%!)
    if (knockBack && !player.flying) {
      const kbScale = Math.max(0.15, 1.0 - (player.kbResist || 0));
      player.vx += Math.sin(player.yaw) * 3.6 * kbScale;
      player.vz += Math.cos(player.yaw) * 3.6 * kbScale;
      player.vy = Math.max(player.vy, 2.2 * kbScale);
      player.onGround = false;
    }
    const ov = document.getElementById('damageOverlay'); ov.classList.add('flash'); setTimeout(() => ov.classList.remove('flash'), 160);
    renderStatusBars();
    if (player.hp <= 0) {
      // Totem of Undying death prevention (check offhand first, then active/hotbar slots)
      let savedByTotem = false;
      if (B.TOTEM_UNDYING) {
        if (player.equip && player.equip.offhand === B.TOTEM_UNDYING) {
          player.equip.offhand = 0;
          if (player.equipMeta) player.equipMeta.offhand = null;
          savedByTotem = true;
        } else {
          const checkOrder = [player.selectedSlot];
          for (let ti = 0; ti < 9; ti++) if (ti !== player.selectedSlot) checkOrder.push(ti);
          for (let ci = 0; ci < checkOrder.length; ci++) {
            const s = inventory[checkOrder[ci]];
            if (s && s.id === B.TOTEM_UNDYING && s.count > 0) {
              s.count--;
              if (s.count <= 0) { s.id = 0; s.dur = 0; s.maxDur = 0; }
              savedByTotem = true;
              break;
            }
          }
        }
      }
      if (savedByTotem) {
        player.hp = 10;
        player.invuln = 3.2;
        player.burnTime = 0;
        player._darknessT = 0;
        recalcPlayerArmor(); renderHotbar(); renderEquipmentUI(); renderStatusBars();
        const tf = document.getElementById('totemFlash');
        if (tf) { tf.classList.add('active'); setTimeout(() => tf.classList.remove('active'), 480); }
        spawnParticles(player.x, player.y + 1.1, player.z, 0xfacc15, 22, true);
        spawnParticles(player.x, player.y + 1.1, player.z, 0x10b981, 16, true);
        playAncientCityDiscSfx(false);
        showToast('🗿 Totem Bất Tử đã cứu mạng bạn!');
        return;
      }
      player.dead = true; if (player.ridingDragon) dismountDragon(); player._wardenWarningLevel = 0; if (document.pointerLockElement) document.exitPointerLock();
      isPlaying = false; mining.active = false;
      if (typeof clearMoveKeys === 'function') clearMoveKeys();
      if (typeof chatOpen !== 'undefined' && chatOpen && typeof closeChatBox === 'function') { closeChatBox(); isPlaying = false; }
      ['invModal', 'chestModal', 'furnaceModal', 'smithingModal', 'tradeModal', 'worldMapModal', 'menuModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('pause-mode', 'from-lobby'); }
      });
      activeChestKey = null; activeChestPartnerKey = null; activeFurnaceKey = null;
      const dX = Math.floor(player.x), dY = Math.floor(player.y - depthOffset), dZ = Math.floor(player.z);
      const dropped = dropAllPlayerItemsOnDeath();
      const dropInfo = dropped > 0 ? ` • Đồ rơi (${dropped}) tại tọa độ: ${dX}, ${dY}, ${dZ}` : ` • Tọa độ: ${dX}, ${dY}, ${dZ}`;
      document.getElementById('deathReason').textContent = (reason || 'Bạn đã hết máu.') + dropInfo;
      document.body.classList.add('in-menu');
      document.getElementById('deathModal').classList.remove('hidden');
    }
  }
  function playerCollides(x, y, z, testHeight = null) {
    const pH = testHeight !== null ? testHeight : (player.sprintSwimming ? 0.68 : (player.sneaking ? 1.42 : PLAYER_HEIGHT));
    const x0 = Math.floor(x - PLAYER_RADIUS), x1 = Math.floor(x + PLAYER_RADIUS);
    const z0 = Math.floor(z - PLAYER_RADIUS), z1 = Math.floor(z + PLAYER_RADIUS);
    const y0 = Math.floor(y), y1 = Math.floor(y + pH - 0.05);
    let lastCx = 999999, lastCz = 999999, curCh = null;
    for (let bx = x0; bx <= x1; bx++) {
      const cx = bx >> 4, lx = bx & 15;
      for (let bz = z0; bz <= z1; bz++) {
        const cz = bz >> 4;
        if (cx !== lastCx || cz !== lastCz) { lastCx = cx; lastCz = cz; curCh = chunks.get(chunkKey(cx, cz)) || null; }
        const data = curCh ? curCh.data : null;
        const colBase = ((bz & 15) << 4) | lx;
        for (let by = y0; by <= y1; by++) {
          let bid;
          if (by < MIN_Y) bid = (currentDimension === 'end') ? B.AIR : B.BEDROCK;
          else if (by > MAX_Y || !data) bid = B.AIR;
          else bid = data[((by - MIN_Y) << 8) | colBase];
          if (IS_STAIRS[bid] === 1) {
            if (y < by + 0.5 - 1e-4 && y + pH - 0.05 > by + 1e-4) return true;
            if (y < by + 1.0 - 1e-4 && y + pH - 0.05 > by + 0.5 + 1e-4) {
              const sd = BLOCK_DEF[bid].stairDir || 0;
              if (sd === 0 && z - PLAYER_RADIUS < bz + 0.5 - 1e-4) return true;
              if (sd === 1 && z + PLAYER_RADIUS > bz + 0.5 + 1e-4) return true;
              if (sd === 2 && x + PLAYER_RADIUS > bx + 0.5 + 1e-4) return true;
              if (sd === 3 && x - PLAYER_RADIUS < bx + 0.5 - 1e-4) return true;
            }
            continue;
          }
          if (IS_SLAB[bid] === 1) {
            if (y < by + 0.5 - 1e-4 && y + pH - 0.05 > by + 1e-4) return true;
            continue;
          }
          if (IS_SLAB[bid] === 2) {
            if (y < by + 1.0 - 1e-4 && y + pH - 0.05 > by + 0.5 + 1e-4) return true;
            continue;
          }
          if (IS_SOLID[bid] !== 1) {
            if (by > MIN_Y && by <= MAX_Y + 1 && data) {
              const belowId = (by - 1 < MIN_Y) ? B.AIR : data[((by - 1 - MIN_Y) << 8) | colBase];
              if (IS_DOOR[belowId] === 1 && !doorOpenState.get(modKey(bx, by - 1, bz))) return true;
            }
          } else if (IS_FENCE_WALL[bid] === 1) {
            if (aabbHitsFenceOrWall(x - PLAYER_RADIUS, y + 0.02, z - PLAYER_RADIUS, x + PLAYER_RADIUS, y + pH - 0.05, z + PLAYER_RADIUS, bx, by, bz, bid)) return true;
          } else if (IS_DOOR_OR_TRAP[bid] === 1) {
            if (!doorOpenState.get(modKey(bx, by, bz))) return true;
          } else {
            return true;
          }
        }
      }
    }
    return false;
  }
  function hasSupportBelow(x, y, z) {
    const byLo = Math.floor(y - 0.58), byHi = Math.floor(y - 0.06);
    for (let by = byHi; by >= byLo; by--) {
      for (let bx = Math.floor(x - PLAYER_RADIUS); bx <= Math.floor(x + PLAYER_RADIUS); bx++)
        for (let bz = Math.floor(z - PLAYER_RADIUS); bz <= Math.floor(z + PLAYER_RADIUS); bz++) {
          const b = getBlockWorld(bx, by, bz);
          if (IS_FENCE_WALL[b] === 1) {
            if (aabbHitsFenceOrWall(x - PLAYER_RADIUS, y - 0.14, z - PLAYER_RADIUS, x + PLAYER_RADIUS, y + 0.05, z + PLAYER_RADIUS, bx, by, bz, b)) return true;
          } else if (by === byHi && isSolidAt(bx, by, bz)) return true;
        }
    }
    return false;
  }
  const _tmpScreenVec = new THREE.Vector3();
  function getRayDirFromScreen(clientX, clientY) {
    if (typeof clientX !== 'number' || typeof clientY !== 'number') {
      _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ');
      return _rayDir.set(0, 0, -1).applyEuler(_rayEuler);
    }
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    let nx = (clientX / w) * 2 - 1;
    let ny = -(clientY / h) * 2 + 1;
    if (typeof isRotated90 !== 'undefined' && isRotated90) {
      const tx = -ny, ty = nx;
      nx = tx; ny = ty;
    }
    _tmpScreenVec.set(nx, ny, 0.5).unproject(camera);
    return _rayDir.copy(_tmpScreenVec).sub(camera.position).normalize();
  }
  function raycastBlock(maxDist = 5.4, hitWater = false, hitSourceOnly = false, screenX = null, screenY = null) {
    if (screenX !== null && screenY !== null) getRayDirFromScreen(screenX, screenY);
    else { _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ'); _rayDir.set(0, 0, -1).applyEuler(_rayEuler); }
    let x = player.x, y = player.y + EYE_HEIGHT + (player.sneakEyeOff !== undefined ? player.sneakEyeOff : (player.sneaking ? -0.38 : 0)) + (player.sitEyeOff || 0), z = player.z;
    let prevX = Math.floor(x), prevY = Math.floor(y), prevZ = Math.floor(z);
    let adjX = prevX, adjY = prevY, adjZ = prevZ;
    const sx = _rayDir.x * 0.06, sy = _rayDir.y * 0.06, sz = _rayDir.z * 0.06;
    let lastCx = 999999, lastCz = 999999, curCh = null;
    let curId = (prevY >= MIN_Y && prevY <= MAX_Y) ? getBlockWorld(prevX, prevY, prevZ) : B.AIR;
    for (let d = 0; d < maxDist; d += 0.06) {
      x += sx; y += sy; z += sz;
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      if (bx !== prevX || by !== prevY || bz !== prevZ) {
        adjX = prevX; adjY = prevY; adjZ = prevZ;
        prevX = bx; prevY = by; prevZ = bz;
        curId = B.AIR;
        if (by >= MIN_Y && by <= MAX_Y) {
          const cx = bx >> 4, cz = bz >> 4;
          if (cx !== lastCx || cz !== lastCz) { lastCx = cx; lastCz = cz; curCh = chunks.get(chunkKey(cx, cz)) || null; }
          if (curCh) {
            const idx = ((by - MIN_Y) << 8) | ((bz & 15) << 4) | (bx & 15);
            curId = curCh.data[idx];
            if (curId === B.AIR) {
              if (by > MIN_Y) {
                const belowDoorId = curCh.data[idx - 256];
                if (IS_DOOR[belowDoorId] === 1) return { x: bx, y: by - 1, z: bz, px: adjX, py: adjY, pz: adjZ, id: belowDoorId };
              }
            } else if (IS_FENCE_WALL[curId] !== 1) {
              const isFluidHit = hitWater && (curId === B.WATER || curId === B.LAVA) && (!hitSourceOnly || getFluidLevel(bx, by, bz, curId) === 0);
              if (IS_SOLID[curId] === 1 || IS_RAY_NON_SOLID[curId] === 1 || isFluidHit) return { x: bx, y: by, z: bz, px: adjX, py: adjY, pz: adjZ, id: curId, hy: Math.max(0, Math.min(0.999, y - by)) };
            }
          }
        }
      }
      if (IS_FENCE_WALL[curId] === 1 && pointInFenceOrWall(x, y, z, bx, by, bz, curId)) {
        return { x: bx, y: by, z: bz, px: adjX, py: adjY, pz: adjZ, id: curId, hy: Math.max(0, Math.min(0.999, y - by)) };
      }
    }
    return null;
  }
  function _isBlockSolidHit(bx, by, bz, minY, maxY) {
    if (by < MIN_Y) return currentDimension !== 'end';
    if (by > MAX_Y) return false;
    const c = chunks.get(chunkKey(bx >> 4, bz >> 4));
    if (!c) return false;
    const idx = ((by - MIN_Y) << 8) | ((bz & 15) << 4) | (bx & 15);
    const id = c.data[idx];
    if (IS_SOLID[id] !== 1) {
      if (by > MIN_Y && IS_DOOR[c.data[idx - 256]] === 1 && !doorOpenState.get(modKey(bx, by - 1, bz))) return true;
      return false;
    }
    if (IS_FENCE_WALL[id] === 1) return false;
    if (IS_DOOR_OR_TRAP[id] === 1) return !doorOpenState.get(modKey(bx, by, bz));
    if (IS_SLAB[id] === 1) return minY < by + 0.505 && maxY > by - 0.005;
    if (IS_SLAB[id] === 2) return minY < by + 1.005 && maxY > by + 0.495;
    return true;
  }
  function _raycastSolidOccluderDist(ox, oy, oz, dx, dy, dz, maxDist) {
    let bx = Math.floor(ox), by = Math.floor(oy), bz = Math.floor(oz);
    const sx = dx >= 0 ? 1 : -1, sy = dy >= 0 ? 1 : -1, sz = dz >= 0 ? 1 : -1;
    const tDeltaX = Math.abs(dx) > 1e-7 ? Math.abs(1 / dx) : 1e9;
    const tDeltaY = Math.abs(dy) > 1e-7 ? Math.abs(1 / dy) : 1e9;
    const tDeltaZ = Math.abs(dz) > 1e-7 ? Math.abs(1 / dz) : 1e9;
    let tMaxX = Math.abs(dx) > 1e-7 ? ((sx > 0 ? (bx + 1 - ox) : (ox - bx)) * tDeltaX) : 1e9;
    let tMaxY = Math.abs(dy) > 1e-7 ? ((sy > 0 ? (by + 1 - oy) : (oy - by)) * tDeltaY) : 1e9;
    let tMaxZ = Math.abs(dz) > 1e-7 ? ((sz > 0 ? (bz + 1 - oz) : (oz - bz)) * tDeltaZ) : 1e9;
    let t = 0;
    for (let step = 0; step < 48; step++) {
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) { bx += sx; t = tMaxX; tMaxX += tDeltaX; }
        else               { bz += sz; t = tMaxZ; tMaxZ += tDeltaZ; }
      } else {
        if (tMaxY < tMaxZ) { by += sy; t = tMaxY; tMaxY += tDeltaY; }
        else               { bz += sz; t = tMaxZ; tMaxZ += tDeltaZ; }
      }
      if (t > maxDist) return maxDist;
      const tExit = Math.min(tMaxX, tMaxY, tMaxZ, maxDist);
      const y0 = oy + dy * t, y1 = oy + dy * tExit;
      if (_isBlockSolidHit(bx, by, bz, Math.min(y0, y1), Math.max(y0, y1))) return t;
    }
    return maxDist;
  }
  function _hasClearSightToMob(ox, oy, oz, m) {
    const mh = m.hitboxH || 1.4;
    const fracs = [0.55, 0.84, 0.22];
    for (let fi = 0; fi < fracs.length; fi++) {
      const ty = m.y + mh * fracs[fi];
      const vx = m.x - ox, vy = ty - oy, vz = m.z - oz;
      const dist = Math.hypot(vx, vy, vz);
      if (dist < 0.08) return true;
      const hitT = _raycastSolidOccluderDist(ox, oy, oz, vx / dist, vy / dist, vz / dist, dist - 0.05);
      if (hitT >= dist - 0.07) return true;
    }
    return false;
  }
  function raycastMob(maxDist = 4.6, screenX = null, screenY = null) {
    if (screenX !== null && screenY !== null) getRayDirFromScreen(screenX, screenY);
    else { _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ'); _rayDir.set(0, 0, -1).applyEuler(_rayEuler); }
    const ox = player.x, oy = player.y + EYE_HEIGHT + (player.sneakEyeOff !== undefined ? player.sneakEyeOff : (player.sneaking ? -0.38 : 0)) + (player.sitEyeOff || 0), oz = player.z;
    const invX = Math.abs(_rayDir.x) > 1e-6 ? 1 / _rayDir.x : 1e9;
    const invY = Math.abs(_rayDir.y) > 1e-6 ? 1 / _rayDir.y : 1e9;
    const invZ = Math.abs(_rayDir.z) > 1e-6 ? 1 / _rayDir.z : 1e9;
    const wallDist = _raycastSolidOccluderDist(ox, oy, oz, _rayDir.x, _rayDir.y, _rayDir.z, maxDist);
    let best = null, bestD = wallDist;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      const r = Math.max(0.68, (m.hitboxR || 0.4) + 0.28);
      const h = Math.max(0.95, m.hitboxH || 1.4) + 0.22;
      const t1x = (m.x - r - ox) * invX, t2x = (m.x + r - ox) * invX;
      const t1y = (m.y - 0.12 - oy) * invY, t2y = (m.y + h - oy) * invY;
      const t1z = (m.z - r - oz) * invZ, t2z = (m.z + r - oz) * invZ;
      const tmin = Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y), Math.min(t1z, t2z), 0);
      const tmax = Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y), Math.max(t1z, t2z));
      if (tmax >= tmin && tmin < bestD && _hasClearSightToMob(ox, oy, oz, m)) { best = m; bestD = tmin; }
    }
    return best;
  }

  const mining = { active: false, swinging: false, key: '', progress: 0, sfxTimer: 0, touchX: null, touchY: null };
  const eatState = { active: false, slotIdx: -1, itemId: 0, timer: 0, duration: 1.60, nextChomp: 0 };
  function syncEatBarUI() {
    const wrap = document.getElementById('eatProgressWrap'), fill = document.getElementById('eatProgressFill');
    if (!wrap || !fill) return;
    if (eatState.active) {
      wrap.classList.add('active');
      fill.style.width = Math.min(100, Math.round((eatState.timer / eatState.duration) * 100)) + '%';
    } else {
      wrap.classList.remove('active');
      fill.style.width = '0%';
    }
  }
  function updateEatingState(dt) {
    if (!eatState.active) { syncEatBarUI(); return; }
    if (player.dead || !isPlaying || player.selectedSlot !== eatState.slotIdx) { eatState.active = false; syncEatBarUI(); return; }
    const slot = inventory[eatState.slotIdx];
    const def = (slot && slot.count > 0 && slot.id === eatState.itemId) ? BLOCK_DEF[slot.id] : null;
    if (!def || !def.food) { eatState.active = false; syncEatBarUI(); return; }
    eatState.timer += dt;
    syncEatBarUI();
    if (eatState.timer >= eatState.nextChomp) {
      eatState.nextChomp = eatState.timer + 0.22;
      ensureAudio();
      playEatChompSfx();
      const colHex = def.crumbColor || (def.mapColor ? parseInt(def.mapColor.replace('#', ''), 16) : 0xd97706);
      spawnFoodCrumbs(colHex);
    }
    if (eatState.timer >= eatState.duration) {
      eatState.active = false;
      syncEatBarUI();
      const heal = def.heal || 4, feed = def.feed || 5;
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
      player.hunger = Math.min(player.maxHunger, player.hunger + feed);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      playEatBurpSfx();
      renderHotbar(); renderStatusBars();
      showToast(`🍖 Đã ăn ${def.name} (+${heal} Máu, +${feed} Thể lực)`);
    }
  }

  function tamePetMob(mobHit) {
    if (!mobHit || mobHit._dead || !TAMEABLE_PETS.has(mobHit.type) || mobHit.tamed) return false;
    const slot = inventory[player.selectedSlot];
    const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    if (gameMode !== 'creative' && selDef && selDef.food) { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
    mobHit.tamed = true; mobHit.sitting = false; mobHit.provoked = 0;
    mobHit.maxHp = Math.max(mobHit.maxHp, 26); mobHit.hp = mobHit.maxHp;
    if (!mobHit.petTag) {
      const petTag = makeNameTagSprite(`♥ ${mobHit.displayName}`, '#f472b6');
      petTag.position.set(0, mobHit.hitboxH + 0.65, 0);
      mobHit.group.add(petTag); mobHit.petTag = petTag;
    }
    spawnParticles(mobHit.x, mobHit.y + 0.85, mobHit.z, 0xf472b6, 16, true);
    playSfx('pickup');
    showToast(`💖 Đã thuần hóa ${mobHit.displayName}! Chạm lại để Ngồi / Đi Theo!`);
    return true;
  }

  function startBowDraw(screenX = null, screenY = null, silent = false) {
    if (player.dead || eatState.active) return false;
    const slot = inventory[player.selectedSlot];
    const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    if (!selDef || selDef.tool !== 'bow') return false;
    if (gameMode !== 'creative' && countItem(B.ARROW) <= 0) {
      if (!player._bowEmptyToastT || performance.now() - player._bowEmptyToastT > 1200) {
        player._bowEmptyToastT = performance.now();
        showToast('Hết Mũi Tên! Hãy chế thêm trong Balo (E)');
      }
      return false;
    }
    if (!player.bowDrawing && !silent) playSfx('bow_draw');
    player.bowDrawing = true;
    player.bowCharge = Math.max(player.bowCharge || 0, 0.08);
    player.bowStage = 1;
    player._bowAimPos = (screenX !== null && screenY !== null) ? { x: screenX, y: screenY } : null;
    player._lastFpBowStage = 1;
    if (typeof updateHeldViewModel === 'function') updateHeldViewModel(slot.id, { bowStage: 1, ench: !!(slot && slot.ench) });
    return true;
  }

  function cancelBowDraw() {
    if (!player.bowDrawing && !player.bowCharge && !player.bowStage) return;
    player.bowDrawing = false;
    if (typeof stopBowDrawSfx === 'function') stopBowDrawSfx();
    player.bowCharge = 0;
    player.bowStage = 0;
    player._bowAimPos = null;
    if ((player._lastFpBowStage || 0) !== 0) {
      player._lastFpBowStage = 0;
      const slot = inventory[player.selectedSlot];
      if (typeof updateHeldViewModel === 'function') updateHeldViewModel(slot && slot.count > 0 ? slot.id : B.AIR, slot && slot.count > 0 ? slot : null);
    }
  }

  function updateBowDrawState(dt) {
    if (!player.bowDrawing) {
      if ((player._lastFpBowStage || 0) !== 0) cancelBowDraw();
      return;
    }
    if (!isPlaying || player.dead || eatState.active) { cancelBowDraw(); return; }
    const slot = inventory[player.selectedSlot];
    const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    if (!selDef || selDef.tool !== 'bow') { cancelBowDraw(); return; }
    player.bowCharge = Math.min(1.0, (player.bowCharge || 0) + dt / 0.82);
    const nextSt = player.bowCharge >= 0.86 ? 3 : (player.bowCharge >= 0.40 ? 2 : 1);
    if (nextSt !== player.bowStage) {
      player.bowStage = nextSt;
      if (nextSt === 3) playSfx('bow_full');
    }
    if ((player._lastFpBowStage || 0) !== nextSt) {
      player._lastFpBowStage = nextSt;
      if (typeof updateHeldViewModel === 'function') updateHeldViewModel(slot.id, { bowStage: nextSt, ench: !!(slot && slot.ench) });
    }
  }

  function releaseBowDraw(screenX = null, screenY = null) {
    if (!player.bowDrawing) return false;
    const charge = Math.max(0.18, Math.min(1.0, player.bowCharge || 0.25));
    const isFull = charge >= 0.86;
    const ax = (screenX !== null && screenX !== undefined) ? screenX : (player._bowAimPos ? player._bowAimPos.x : null);
    const ay = (screenY !== null && screenY !== undefined) ? screenY : (player._bowAimPos ? player._bowAimPos.y : null);
    cancelBowDraw();
    const slot = inventory[player.selectedSlot];
    const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    if (!selDef || selDef.tool !== 'bow') return false;
    if (gameMode !== 'creative' && countItem(B.ARROW) <= 0) { showToast('Hết Mũi Tên! Hãy chế thêm trong Balo (E)'); return false; }
    if (gameMode !== 'creative') consumeItem(B.ARROW, 1);
    if (ax !== null && ay !== null) getRayDirFromScreen(ax, ay);
    else { _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ'); _rayDir.set(0, 0, -1).applyEuler(_rayEuler); }
    const eyeY = player.y + (player.sneaking ? EYE_HEIGHT - 0.24 : EYE_HEIGHT);
    const arrowSpd = 12.0 + 24.0 * charge;
    const arrowDmg = (selDef.dmg || 6.5) * (0.45 + 0.85 * charge);
    fireArrow(player.x + _rayDir.x * 0.5, eyeY - 0.05 + _rayDir.y * 0.5, player.z + _rayDir.z * 0.5, _rayDir.x, _rayDir.y, _rayDir.z, arrowSpd, true, arrowDmg);
    if (isFull) spawnParticles(player.x + _rayDir.x * 0.9, eyeY - 0.05 + _rayDir.y * 0.9, player.z + _rayDir.z * 0.9, (slot.id >= B.SCULK_ECHO_BOW ? 0x22d3ee : 0xfef08a), 6, true);
    if (gameMode !== 'creative') damageHeldTool(1);
    player.swingT = 0.22; renderHotbar();
    return true;
  }

  function quickFireBow(screenX = null, screenY = null) {
    if (!startBowDraw(screenX, screenY, true)) return false;
    player.bowCharge = 0.50;
    return releaseBowDraw(screenX, screenY);
  }

  function tryStripLogWithAxe(hit) {
    if (!hit) return false;
    const slot = inventory[player.selectedSlot];
    const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    const targetDef = BLOCK_DEF[hit.id];
    if (!selDef || selDef.tool !== 'axe' || !targetDef || !targetDef.stripTo) return false;
    setBlockWorld(hit.x, hit.y, hit.z, targetDef.stripTo, true);
    flushUrgentChunks(16);
    if (typeof startHandSwing === 'function') startHandSwing(0.22, 'attack');
    else player.swingT = 0.22;
    playBlockSfx(hit.id, true);
    spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, targetDef.mapColor || '#8a623c', 10, false);
    emitSculkVibration(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 'mine', 8);
    if (gameMode !== 'creative') damageHeldTool(1);
    mining.active = false; mining.progress = 0;
    return true;
  }

  function handlePlaceOrEat(screenX = null, screenY = null) {
    if (player.dead) { syncSpyglassZoomState(); return; }
    syncSpyglassZoomState();
    const slot = inventory[player.selectedSlot];
    const selDef = (slot && slot.count > 0) ? BLOCK_DEF[slot.id] : null;
    const mobHit = raycastMob(4.8, screenX, screenY);

    // Flint & Steel / Soul Flint & Steel ignites ANY targeted mob/animal immediately!
    if (mobHit && slot && (slot.id === B.FLINT_AND_STEEL || slot.id === B.SOUL_FLINT_AND_STEEL)) {
      const isSoul = (slot.id === B.SOUL_FLINT_AND_STEEL);
      player.swingT = 0.22;
      playSfx('burn');
      spawnParticles(mobHit.x, mobHit.y + 0.9, mobHit.z, isSoul ? 0x22d3ee : 0xf97316, 14, true);
      if (!FIRE_IMMUNE_MOBS.has(mobHit.type)) {
        mobHit.burning = true;
        mobHit.burnTime = isSoul ? 8.5 : 6.5;
        mobHit.burnTick = 0.25;
        hurtMob(mobHit, isSoul ? 3.5 : 1.5, mobHit.x - player.x, mobHit.z - player.z, 3.0, true, true);
      } else {
        showToast('🔥 Quái vật này miễn nhiễm với lửa!');
      }
      if (gameMode !== 'creative') damageHeldTool(1);
      renderHotbar();
      return;
    }

    if (mobHit && mobHit.type === 'villager') { openTradeModal(mobHit); return; }
    if (mobHit && mobHit.tamed && mobHit.elemDragon) {
      if (feedOrInteractTamedDragon(mobHit, slot, selDef, true)) return;
    }
    if (mobHit && TAMEABLE_PETS.has(mobHit.type)) {
      if (!mobHit.tamed) {
        tamePetMob(mobHit);
      } else if (selDef && selDef.food && mobHit.hp < mobHit.maxHp) {
        slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar();
        mobHit.hp = mobHit.maxHp;
        spawnParticles(mobHit.x, mobHit.y + 0.85, mobHit.z, 0xf43f5e, 12, true);
        playSfx('eat'); showToast(`💖 ${mobHit.displayName} đã ăn no và hồi đầy máu!`);
      } else {
        mobHit.sitting = !mobHit.sitting;
        spawnParticles(mobHit.x, mobHit.y + 0.8, mobHit.z, mobHit.sitting ? 0x38bdf8 : 0x4ade80, 10, true);
        playSfx('equip');
        showToast(mobHit.sitting ? `🐾 ${mobHit.displayName} đang ngồi chờ tại chỗ.` : `🐾 ${mobHit.displayName} đang chạy theo bạn!`);
      }
      return;
    }

    const wantEmptyScoop = !!(selDef && selDef.bucket === 'empty');
    let hit = raycastBlock(5.4, !!(selDef && (selDef.lily || wantEmptyScoop || selDef.boat || selDef.tool === 'rod')), false, screenX, screenY);
    if (wantEmptyScoop && hit && (hit.id === B.WATER || hit.id === B.LAVA)) {
      const srcHit = raycastBlock(5.4, true, true, screenX, screenY);
      if (srcHit && (srcHit.id === B.WATER || srcHit.id === B.LAVA)) hit = srcHit;
    }

    if (hit && slot && (slot.id === B.FLINT_AND_STEEL || slot.id === B.SOUL_FLINT_AND_STEEL)) {
      const isSoulSteel = (slot.id === B.SOUL_FLINT_AND_STEEL);
      player.swingT = 0.22;
      if (hit.id === B.TNT) {
        setBlockWorld(hit.x, hit.y, hit.z, B.AIR, true);
        spawnPrimedTnt(hit.x + 0.5, hit.y, hit.z + 0.5, 2.4);
        flushUrgentChunks(32);
        if (gameMode !== 'creative') damageHeldTool(1);
        renderHotbar();
        showToast('💣 Đã châm ngòi TNT bằng Bật Lửa!');
        return;
      }
      const ix = hit.px, iy = hit.py, iz = hit.pz;
      spawnParticles(ix + 0.5, iy + 0.35, iz + 0.5, isSoulSteel ? 0x22d3ee : 0xf97316, 14, true);
      if (isSoulSteel && typeof tryIgniteWardenPortal === 'function' && tryIgniteWardenPortal(hit.x, hit.y, hit.z, ix, iy, iz)) {
        flushUrgentChunks(48);
        if (gameMode !== 'creative') damageHeldTool(1);
        renderHotbar();
        return;
      }
      if (!isSoulSteel && hit.id === B.REINFORCED_DEEPSLATE) {
        playSfx('equip');
        showToast('🩵 Cổng Thành Phố Cổ cần Bật Lửa Linh Hồn (Sắt + Mảnh Vang Echo + Đá Lửa) để kích hoạt!');
        return;
      }
      if (!isSoulSteel && tryIgniteNetherPortal(ix, iy, iz)) {
        flushUrgentChunks(32);
        if (gameMode !== 'creative') damageHeldTool(1);
        renderHotbar();
        return;
      }
      if (iy > MIN_Y && iy <= MAX_Y) {
        const exId = getBlockWorld(ix, iy, iz), exDef = BLOCK_DEF[exId];
        if (exId === B.AIR || (exDef && exDef.cross && exId !== B.FIRE && exId !== B.SOUL_FIRE)) {
          const fireBlockId = (isSoulSteel || getBlockWorld(ix, iy - 1, iz) === B.SOUL_SAND) ? B.SOUL_FIRE : B.FIRE;
          setBlockWorld(ix, iy, iz, fireBlockId, true);
          igniteAdjacentTnt(ix, iy, iz);
          flushUrgentChunks(32);
          playSfx('burn');
          if (gameMode !== 'creative') damageHeldTool(1);
          renderHotbar();
          return;
        }
      }
      playSfx('equip');
      showToast('🔥 Không thể đốt lửa tại vị trí này!');
      return;
    }

    // Interact with Placed Functional Blocks (Crafting Table 3x3, 3 Furnaces, 5 Animated 3D Chests, 5 Doors, 4 Trapdoors, Enchanting, Anvil, Bed, Campfire!)
    if (hit && !player.sneaking) {
      const hDef = BLOCK_DEF[hit.id];
      if (hit.id === B.NOTE_BLOCK) {
        try {
          ensureAudio();
          if (audioCtx && audioCtx.state === 'running' && sfxGain && sfxVolume > 0.01) {
            const now = audioCtx.currentTime, o = audioCtx.createOscillator(), gN = audioCtx.createGain();
            const pitch = 220 * Math.pow(2, ((Math.abs(hit.x * 7 + hit.z * 13) % 12)) / 12);
            o.type = 'triangle'; o.frequency.setValueAtTime(pitch, now);
            gN.gain.setValueAtTime(0.001, now); gN.gain.linearRampToValueAtTime(0.22, now + 0.02); gN.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            o.connect(gN); gN.connect(sfxGain); o.start(now); o.stop(now + 0.48);
          }
        } catch (_) {}
        spawnParticles(hit.x + 0.5, hit.y + 1.1, hit.z + 0.5, 0xfacc15, 6, true);
        emitSculkVibration(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 'noteblock', 16);
        showToast('🎵 Khối Âm Thanh vang lên — đánh lạc hướng Warden!');
        return;
      }
      if (hit.id === B.END_PORTAL_FRAME_EYE && slot && slot.id === B.ENDER_EYE) {
        showToast('👁️ Khung Cổng End này đã có Mắt Ender rồi!');
        return;
      }
      if (hit.id === B.END_PORTAL_FRAME && slot && slot.id === B.ENDER_EYE) {
        setBlockWorld(hit.x, hit.y, hit.z, B.END_PORTAL_FRAME_EYE, true);
        if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
        player.swingT = 0.22;
        spawnParticles(hit.x + 0.5, hit.y + 1.0, hit.z + 0.5, 0x34d399, 14, true);
        playSfx('equip');
        if (!tryActivateEndPortalAround(hit.x, hit.y, hit.z)) {
          showToast('👁️ Đã gắn Mắt Ender vào Khung Cổng Kết Thúc!');
        }
        flushUrgentChunks(32);
        return;
      }
      if (hit.id === B.CRAFT_TABLE) { openInventoryModal('table'); return; }
      if (hit.id === B.SMITHING_TABLE) { openSmithingModal(); return; }
      if (hDef && hDef.furnaceType) { openFurnaceModal(hit.x, hit.y, hit.z, hit.id); return; }
      if (hDef && hDef.chest) { openChestModal(hit.x, hit.y, hit.z, hit.id); return; }
      if (hDef && (hDef.door || hDef.trapdoor)) {
        const dk = modKey(hit.x, hit.y, hit.z);
        const nowOpen = !doorOpenState.get(dk);
        setDoorOpenPair(hit.x, hit.y, hit.z, nowOpen, true);
        player.swingT = 0.18;
        showToast(nowOpen ? `🚪 Đã mở ${hDef.name}` : `🚪 Đã đóng ${hDef.name}`);
        return;
      }
      if (hit.id === B.WINDMILL_HUB && !player.sneaking) {
        const wk = modKey(hit.x, hit.y, hit.z);
        const prev = windmillHubState.get(wk) || { yaw: 0, speed: 1 };
        const nextSpd = prev.speed === 1 ? 2 : (prev.speed === 2 ? 0 : 1);
        windmillHubState.set(wk, { yaw: prev.yaw, speed: nextSpd });
        player.swingT = 0.16; playSfx('click');
        showToast(nextSpd === 0 ? '🌬️ Cối Xoay Gió: Đã tạm dừng (0x)' : `🌬️ Cối Xoay Gió: Tốc độ ${nextSpd}x`);
        return;
      }
      if (BLOCK_DEF[hit.id] && BLOCK_DEF[hit.id].dragonEgg) {
        const eggK = modKey(hit.x, hit.y, hit.z);
        const eggDef = BLOCK_DEF[hit.id];
        if (incubatingEggs.has(eggK) && !player.sneaking) {
          const eg = incubatingEggs.get(eggK);
          incubatingEggs.delete(eggK);
          setBlockWorld(hit.x, hit.y, hit.z, B.AIR, true);
          flushUrgentChunks(16);
          hatchTamedDragon(eg.el, hit.x + 0.5, hit.y + 0.15, hit.z + 0.5);
        } else {
          incubatingEggs.delete(eggK);
          setBlockWorld(hit.x, hit.y, hit.z, B.AIR, true);
          flushUrgentChunks(16);
          addItemToInventory(hit.id, 1);
          playSfx('pickup'); renderHotbar();
          showToast(hit.id === B.ENDER_DRAGON_EGG ? '🥚 Đã thu thập Trứng Rồng End vào Balo!' : `🥚 Đã nhặt ${eggDef.name} vào Balo! Đặt xuống đất để ấp nở!`);
        }
        return;
      }
      if (hit.id === B.ENCHANT_TABLE) {
        if (slot && selDef && (selDef.tool || selDef.armorSlot)) {
          if (slot.ench) { showToast('✨ Trang bị này đã được Phù Phép rồi!'); return; }
          if (player.level < 1 && gameMode !== 'creative') { showToast('✨ Cần ít nhất 1 Cấp Kinh Nghiệm (XP) để Phù Phép!'); return; }
          if (gameMode !== 'creative') player.level = Math.max(0, player.level - 1);
          slot.ench = true;
          spawnParticles(hit.x + 0.5, hit.y + 1.2, hit.z + 0.5, 0xc084fc, 16, true);
          playSfx('warp'); renderHotbar(); renderStatusBars();
          showToast(`✨ ĐÃ PHÙ PHÉP ${selDef.name}!`);
        } else showToast('✨ Hãy cầm Công Cụ hoặc Áo Giáp rồi bấm vào Bàn Phù Phép!');
        return;
      }
      if (hit.id === B.ANVIL) {
        if (slot && slot.maxDur > 0 && slot.dur < slot.maxDur) {
          slot.dur = slot.maxDur;
          spawnParticles(hit.x + 0.5, hit.y + 1.0, hit.z + 0.5, 0xfacc15, 12, true);
          playSfx('equip'); renderHotbar();
          showToast(`🔨 Đe Rèn đã sửa 100% độ bền cho ${selDef.name}!`);
        } else showToast('🔨 Hãy cầm công cụ bị hư hại để sửa 100% trên Đe Rèn!');
        return;
      }
      if (BLOCK_DEF[hit.id] && BLOCK_DEF[hit.id].bed) {
        if (currentDimension === 'nether' || currentDimension === 'end') {
          setBlockWorld(hit.x, hit.y, hit.z, B.AIR, true);
          for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nb = getBlockWorld(hit.x + dx, hit.y, hit.z + dz);
            if (BLOCK_DEF[nb] && BLOCK_DEF[nb].bed) setBlockWorld(hit.x + dx, hit.y, hit.z + dz, B.AIR, true);
          }
          triggerExplosion(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 4.5, 18, 'Bạn bị nổ khi nằm ngủ ở Nether/End!');
          return;
        }
        player.bedSpawn = { dim: currentDimension || 'overworld', depthOffset: depthOffset || 0, bx: hit.x, by: hit.y, bz: hit.z, trueY: hit.y - (depthOffset || 0), x: hit.x + 0.5, y: hit.y + 1.2, z: hit.z + 0.5 };
        if (typeof schedulePlayerRoomSave === 'function') schedulePlayerRoomSave(true);
        player.hp = player.maxHp;
        if (envUniforms.uSunDir.value.y < 0.12) { dayTime = 0.28; showToast('🛏️ Bạn đã ngủ qua đêm tới Bình Minh & hồi đầy máu!'); }
        else showToast('🛏️ Đã đặt điểm hồi sinh tại Giường & hồi đầy máu!');
        playSfx('pickup'); renderStatusBars();
        return;
      }
      if (hit.id === B.CAMPFIRE) {
        const cfRec = (slot && slot.count > 0) ? SMELT_RECIPES[slot.id] : null;
        if (cfRec && cfRec.kind === 'food') {
          slot.count--; if (slot.count <= 0) slot.id = 0;
          addItemToInventory(cfRec.out, 1);
          spawnParticles(hit.x + 0.5, hit.y + 1.1, hit.z + 0.5, 0xfb923c, 10, true);
          playSfx('burn'); renderHotbar();
          showToast(`🔥 Đã nướng chín 1 ${BLOCK_DEF[cfRec.out]?.name || 'Thịt Nướng'} trên Lửa Trại!`);
        } else {
          player.hp = Math.min(player.maxHp, player.hp + 4);
          spawnParticles(hit.x + 0.5, hit.y + 1.1, hit.z + 0.5, 0xfef08a, 8, true);
          playSfx('eat'); renderStatusBars();
          showToast('🔥 Sưởi ấm bên Lửa Trại (+4 Máu)! Cầm Cá Tươi để nướng!');
        }
        return;
      }
      if (hit.id === B.TNT) {
        setBlockWorld(hit.x, hit.y, hit.z, B.AIR, true);
        spawnPrimedTnt(hit.x + 0.5, hit.y, hit.z + 0.5, 2.4);
        showToast('💣 Đã châm ngòi TNT!');
        return;
      }
      if (hit.id === B.ELEVATOR_BLOCK) {
        const ch = chunks.get(chunkKey(hit.x >> 4, hit.z >> 4));
        const sp = ch && ch.skyscraperSpec;
        if (sp) {
          const goingUp = player.y < sp.topH - 25;
          player.x = sp.wx0 + sp.w * 0.5;
          player.z = sp.wz0 + sp.d * 0.5;
          player.y = goingUp ? (sp.topH + 1.2) : 3.2;
          player.vy = 0; player.fallStartY = player.y;
          playSfx('warp');
          spawnParticles(player.x, player.y + 1.0, player.z, 0x38bdf8, 16, true);
          showToast(goingUp ? `🏙️ Thang máy tốc hành: Đã lên Sân Thượng Cao Ốc ${sp.topH}m!` : '🏙️ Đã xuống Sảnh Tầng Trệt (Y = 3m)!');
        } else {
          player.y = Math.min(500, player.y + 30); player.vy = 0; player.fallStartY = player.y;
          playSfx('warp'); showToast('🏙️ Đã dịch chuyển thang máy lên cao!');
        }
        return;
      }
    }
    if (!slot || slot.count <= 0 || !selDef) return;

    // Buckets: Scoop Source / Waterlogged Slab or Pour Finite Flowing Water & Lava!
    if (selDef.bucket) {
      if (selDef.bucket === 'empty' && hit) {
        const hk = modKey(hit.x, hit.y, hit.z);
        if (IS_SLAB[hit.id] > 0 && waterloggedBlocks.has(hk)) {
          waterloggedBlocks.delete(hk);
          fluidLevel.delete(hk);
          markFluidDirty(hit.x, hit.y, hit.z);
          wakeAdjacentFluids(hit.x, hit.y, hit.z, 0.55);
          flushUrgentChunks(32, true);
          slot.id = B.WATER_BUCKET;
          player.swingT = 0.24; playSfx('splash'); renderHotbar();
          showToast('🪣 Đã múc nước ra khỏi Phiến!');
          return;
        }
        if (hit.id === B.WATER || hit.id === B.LAVA) {
          const isL = (hit.id === B.LAVA);
          const fl = getFluidLevel(hit.x, hit.y, hit.z, hit.id);
          const isExactPoured = !isL && pouredFluidSources.has(hk);
          if (fl !== 0 && !isExactPoured) {
            showToast(isL ? '🪣 Hãy múc ngay tại ô nguồn Dung Nham!' : '🪣 Hãy múc tại nguồn nước hoặc đúng vị trí đã đổ xô nước!');
            return;
          }
          if (isL || isExactPoured) {
            pouredFluidSources.delete(hk);
            setBlockWorld(hit.x, hit.y, hit.z, B.AIR, true);
            fluidLevel.delete(hk);
            wakeAdjacentFluids(hit.x, hit.y, hit.z, 0.55);
          }
          const filledId = isL ? B.LAVA_BUCKET : B.WATER_BUCKET;
          if (slot.count > 1 && gameMode !== 'creative') {
            slot.count--;
            addItemToInventory(filledId, 1);
          } else {
            slot.id = filledId;
            slot.count = 1;
          }
          player.swingT = 0.24; playSfx(isL ? 'lava_splash' : 'splash'); renderHotbar();
          showToast(isL ? '🪣 Đã múc nguồn Dung Nham — dòng chảy đang rút hết!' : (isExactPoured ? '🪣 Đã múc đúng vị trí đổ nước — nước đang rút hết!' : '🪣 Đã múc đầy Xô Nước (không làm hụt nguồn nước)!'));
          return;
        }
      } else if ((selDef.bucket === 'water' || selDef.bucket === 'lava') && hit) {
        if (selDef.bucket === 'water' && IS_SLAB[hit.id] > 0) {
          const hk = modKey(hit.x, hit.y, hit.z);
          waterloggedBlocks.add(hk);
          fluidLevel.set(hk, 0);
          markFluidDirty(hit.x, hit.y, hit.z);
          scheduleFluid(hit.x, hit.y, hit.z, 0.10);
          flushUrgentChunks(32, true);
          if (gameMode !== 'creative') slot.id = B.BUCKET;
          player.swingT = 0.24; playSfx('splash'); renderHotbar();
          showToast('💧 Đã cho nước vào Phiến (Waterlogged)!');
          return;
        }
        const liqId = selDef.bucket === 'lava' ? B.LAVA : B.WATER;
        const replaceTarget = !!(BLOCK_DEF[hit.id] && BLOCK_DEF[hit.id].cross);
        const tx = replaceTarget ? hit.x : hit.px;
        const ty = replaceTarget ? hit.y : hit.py;
        const tz = replaceTarget ? hit.z : hit.pz;
        if (ty <= MIN_Y || ty > MAX_Y) return;
        setBlockWorld(tx, ty, tz, liqId, true);
        const pk = modKey(tx, ty, tz);
        fluidLevel.set(pk, 0); // Mark exact poured block as SOURCE (level 0)!
        pouredFluidSources.add(pk);
        scheduleFluid(tx, ty, tz, liqId === B.LAVA ? 0.22 : 0.09);
        if (liqId === B.LAVA) igniteAdjacentTnt(tx, ty, tz);
        if (gameMode !== 'creative') slot.id = B.BUCKET;
        player.swingT = 0.24; playSfx(liqId === B.LAVA ? 'lava_splash' : 'splash'); renderHotbar();
        showToast(liqId === B.LAVA ? '🌋 Đã đổ Dung Nham chảy lan (múc lại ô này để thu hết)!' : '💧 Đã đổ Nước chảy lan (múc đúng ô này để thu hết)!');
        return;
      }
      return;
    }

    // Fishing Rod: Catch fresh fish or sea treasure from any water body!
    if (selDef.tool === 'rod') {
      if (hit && hit.id === B.WATER) {
        player.swingT = 0.24; damageHeldTool(1); playSfx('splash');
        spawnParticles(hit.x + 0.5, hit.y + 1.0, hit.z + 0.5, 0x38bdf8, 12, false);
        const caught = Math.random() < 0.18 ? B.GOLD_ORE : (Math.random() < 0.15 ? B.SEA_LANTERN : B.RAW_FISH);
        addItemToInventory(caught, 1); renderHotbar();
        showToast(`🎣 Câu được 1 ${BLOCK_DEF[caught].name}!`);
      } else showToast('🎣 Hãy hướng Cần Câu về mặt nước biển/hồ để câu cá!');
      return;
    }

    // Boat Riding: Toggle fast ocean sailing when near or on water!
    if (selDef.boat) {
      if (player.inBoat) {
        player.inBoat = false; playSfx('place'); showToast('⛵ Đã rời Thuyền Gỗ!');
      } else if (player.inWater || (hit && hit.id === B.WATER)) {
        if (hit && hit.id === B.WATER) { player.x = hit.x + 0.5; player.y = hit.y + 0.95; player.z = hit.z + 0.5; }
        player.inBoat = true; playSfx('splash'); showToast('⛵ Đã lên Thuyền Gỗ! Lướt nhanh trên mặt biển (bấm lại để xuống)!');
      } else showToast('⛵ Hãy nhìn xuống mặt nước để hạ thủy Thuyền Gỗ!');
      return;
    }

    // Spyglass Zoom 3x!
    if (selDef.spyglass) {
      player.spyglassZoom = !player.spyglassZoom;
      camera.fov = player.spyglassZoom ? 24 : 74;
      camera.updateProjectionMatrix();
      playSfx('equip');
      showToast(player.spyglassZoom ? '🔭 Ống Nhòm: Đã phóng đại 3× (bấm lại để tắt)' : '🔭 Đã tắt Ống Nhòm');
      return;
    }

    // Water Breathing Potion (90s infinite underwater oxygen!)
    if (selDef.waterBreath) {
      player.waterBreathT = 90.0; player.air = player.maxAir;
      slot.count--; if (slot.count <= 0) slot.id = 0;
      playSfx('eat'); renderHotbar(); renderStatusBars();
      showToast('🫧 Đã uống Thuốc Thở Biển! Lặn tự do 90 giây!');
      return;
    }

    // Night Vision Potion (180s cave & Deep Dark illumination!)
    if (slot.id === B.NIGHT_VISION_POTION) {
      player._nightVisionT = 180.0;
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
      playSfx('eat'); renderHotbar();
      showToast('👁️ Đã uống Thuốc Nhìn Đêm (180s)! Soi sáng hang tối & Deep Dark!');
      return;
    }

    // Swift Sneak Book (boosts sneak speed up to Lv 3 while silent!)
    if (slot.id === B.SWIFT_SNEAK_BOOK) {
      if ((player.swiftSneak || 0) >= 3) { showToast('👟 Swift Sneak đã đạt cấp tối đa (Cấp III)!'); return; }
      player.swiftSneak = Math.min(3, (player.swiftSneak || 0) + 1);
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
      playSfx('warp'); renderHotbar();
      showToast(`👟 Đã học Swift Sneak Cấp ${player.swiftSneak}! Đi lén nhanh hơn & hoàn toàn im lặng!`);
      return;
    }

    // Snowball throw (distracts Wardens via vibration!)
    if (slot.id === B.SNOWBALL) {
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
      if (screenX !== null && screenY !== null) getRayDirFromScreen(screenX, screenY);
      else { _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ'); _rayDir.set(0, 0, -1).applyEuler(_rayEuler); }
      const eyeY = player.y + (player.sneaking ? EYE_HEIGHT - 0.24 : EYE_HEIGHT);
      const sbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.7 }));
      const ox = player.x + _rayDir.x * 0.6, oy = eyeY - 0.05 + _rayDir.y * 0.6, oz = player.z + _rayDir.z * 0.6;
      sbMesh.position.set(ox, oy, oz); scene.add(sbMesh);
      projectiles.push({ kind: 'snowball', x: ox, y: oy, z: oz, vx: _rayDir.x * 22.0, vy: _rayDir.y * 22.0 + 1.8, vz: _rayDir.z * 22.0, fromPlayer: true, dmg: 0.5, stuck: false, life: 4.0, mesh: sbMesh });
      playSfx('bow'); player.swingT = 0.20; renderHotbar();
      return;
    }

    // Ancient City Music Discs!
    if (slot.id === B.MUSIC_DISC_5 || slot.id === B.MUSIC_DISC_OTHERSIDE) {
      const is5 = (slot.id === B.MUSIC_DISC_5);
      playAncientCityDiscSfx(is5);
      showToast(is5 ? '💿 Đang phát Đĩa Nhạc 5 (Deep Dark)...' : '💿 Đang phát Đĩa Nhạc Otherside...');
      return;
    }

    // Shoot / Draw Bow! (Hold-to-draw tension stages 0..3 matching 100% Minecraft behavior)
    if (selDef.tool === 'bow') {
      startBowDraw(screenX, screenY);
      return;
    }

    // Raise Shield Block Stance (Right-click with Shield!)
    if (selDef.shield) {
      if ((player.shieldDisableT || 0) > 0) {
        showToast('🪓 Khiên đang bị vô hiệu hóa!');
        return;
      }
      player.blockingT = 1.45;
      player.swingT = 0.18;
      let pushed = 0;
      for (let i = 0; i < mobs.length; i++) {
        const m = mobs[i];
        if (!m.hostile && !(m.provoked > 0)) continue;
        const d = Math.hypot(m.x - player.x, m.z - player.z);
        if (d < 3.6) {
          const inv = 1 / (d + 0.1);
          m.vx = (m.x - player.x) * inv * 10.0; m.vz = (m.z - player.z) * inv * 10.0; m.vy = 3.5;
          spawnParticles(m.x, m.y + 1.0, m.z, 0x38bdf8, 8, true);
          pushed++;
        }
      }
      playSfx('equip');
      showToast(pushed > 0 ? `🛡️ Đỡ Khiên đẩy lùi ${pushed} quái vật!` : '🛡️ Giơ Khiên phòng thủ (Chặn 85% sát thương)!');
      return;
    }

    // Elytra Firework Boost with Gunpowder while Gliding!
    if (slot.id === B.GUNPOWDER && player.gliding) {
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
      _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ');
      _rayDir.set(0, 0, -1).applyEuler(_rayEuler);
      const boostSpd = 25.0;
      player.glideVel = { x: _rayDir.x * boostSpd, y: _rayDir.y * boostSpd + 3.5, z: _rayDir.z * boostSpd };
      player.vy = player.glideVel.y;
      playSfx('roar');
      spawnParticles(player.x, player.y + 0.6, player.z, 0xfbbf24, 16, true);
      showToast('🚀 Tăng tốc Pháo Hoa Elytra!');
      return;
    }

    // Equip 4-Slot Armor / Off-Hand Shield / Elytra (and Dragon Head when not placing onto a block!)
    if (selDef.armorSlot && !(selDef.solid && hit)) {
      equipItemToSlot(selDef.armorSlot, player.selectedSlot);
      player.swingT = 0.22;
      renderHotbar();
      return;
    }

    // Void Pearl Teleport!
    if (selDef.pearl) {
      if (screenX !== null && screenY !== null) getRayDirFromScreen(screenX, screenY);
      else { _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ'); _rayDir.set(0, 0, -1).applyEuler(_rayEuler); }
      let tx = player.x, ty = player.y + 1.2, tz = player.z;
      for (let d = 1.0; d <= 12.0; d += 0.5) {
        const nx = player.x + _rayDir.x * d, ny = player.y + 1.2 + _rayDir.y * d, nz = player.z + _rayDir.z * d;
        if (isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) break;
        tx = nx; ty = ny; tz = nz;
      }
      spawnParticles(player.x, player.y + 1, player.z, 0xd946ef, 10, true);
      player.x = tx; player.y = Math.max(MIN_Y + 2, ty); player.z = tz; player.fallStartY = player.y;
      spawnParticles(player.x, player.y + 1, player.z, 0xd946ef, 12, true);
      slot.count--; if (slot.count <= 0) slot.id = 0;
      playSfx('warp'); renderHotbar(); showToast('✨ Dịch chuyển Hư Không!');
      return;
    }

    if (slot.id === B.ENDER_EYE) {
      if (throwEnderEye()) {
        player.swingT = 0.24;
        if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
      }
      return;
    }

    // Minecraft-Style Timed Eating (1.35s chew animation + crunchy SFX + falling food crumbs!)
    if (selDef.food) {
      if (player.hp < player.maxHp || player.hunger < player.maxHunger) {
        if (!eatState.active || eatState.slotIdx !== player.selectedSlot || eatState.itemId !== slot.id) {
          eatState.active = true;
          eatState.slotIdx = player.selectedSlot;
          eatState.itemId = slot.id;
          eatState.timer = 0;
          eatState.duration = 1.60;
          eatState.nextChomp = 0.02;
        }
      } else showToast('Bạn đang đầy máu & thể lực!');
      return;
    }

    // Authentic Minecraft Hoe Tilling: till Grass / Dirt / Podzol / Mycelium into moist Farmland!
    if (selDef.tool === 'hoe' && hit) {
      if (hit.id === B.GRASS || hit.id === B.DIRT || hit.id === B.AUTUMN_PODZOL || hit.id === B.MYCELIUM) {
        const aboveB = getBlockWorld(hit.x, hit.y + 1, hit.z);
        const aboveDef = BLOCK_DEF[aboveB];
        if (aboveB === B.AIR || (aboveDef && !aboveDef.solid)) {
          setBlockWorld(hit.x, hit.y, hit.z, B.FARMLAND, true);
          player.swingT = 0.22;
          playBlockSfx(B.DIRT, true);
          spawnParticles(hit.x + 0.5, hit.y + 1.05, hit.z + 0.5, 0x7c4e2d, 7, false);
          if (gameMode === 'survival' && slot.maxDur > 0) {
            slot.dur = Math.max(0, (slot.dur !== undefined ? slot.dur : slot.maxDur) - 1);
            if (slot.dur <= 0) {
              inventory[player.selectedSlot] = { id: 0, count: 0, dur: 0, maxDur: 0 };
              playSfx('break');
              showToast(`💥 ${selDef.name} đã hỏng!`);
            }
          }
          renderHotbar();
        } else {
          showToast('🌾 Ô phía trên phải trống mới có thể cuốc thành Đất Ruộng!');
        }
      } else {
        showToast('🌾 Chỉ có thể dùng Cuốc lên Cỏ Xanh hoặc Đất!');
      }
      return;
    }

    // Authentic Minecraft Farming: Wheat Seeds ONLY plant on Farmland (must till ground with a Hoe first!)
    if (selDef.seedCrop && hit) {
      if (hit.id === B.FARMLAND) {
        const aboveB = getBlockWorld(hit.x, hit.y + 1, hit.z);
        if (aboveB === B.AIR || (BLOCK_DEF[aboveB] && BLOCK_DEF[aboveB].cross)) {
          setBlockWorld(hit.x, hit.y + 1, hit.z, selDef.seedCrop, true);
          if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
          player.swingT = 0.22; playSfx('place'); renderHotbar();
          spawnParticles(hit.x + 0.5, hit.y + 1.15, hit.z + 0.5, 0x4ade80, 6, false);
          showToast('🌾 Đã gieo Hạt Giống Lúa Mì lên Đất Ruộng!');
        } else showToast('🌾 Ô phía trên đất ruộng phải trống để gieo hạt!');
      } else {
        showToast('🌾 Hãy dùng Cuốc (Hoe) cuốc đất thành Đất Ruộng trước khi gieo hạt!');
      }
      return;
    }

    // Bone Meal Fertilization (accelerates Saplings, Wheat Crops & blooms Grass!)
    if (slot.id === B.BONE_MEAL && hit) {
      const hDef = BLOCK_DEF[hit.id];
      const consumeMeal = () => {
        if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
        player.swingT = 0.22;
        spawnParticles(hit.x + 0.5, hit.y + 0.65, hit.z + 0.5, 0x4ade80, 12, true);
        playSfx('xp_orb');
      };
      if (hDef && hDef.isSapling) {
        consumeMeal();
        const mk = modKey(hit.x, hit.y, hit.z);
        const cnt = (saplingFertilizeCount.get(mk) || 0) + 1;
        saplingFertilizeCount.set(mk, cnt);
        if (cnt >= 2 || Math.random() < 0.48) {
          if (!growSaplingAt(hit.x, hit.y, hit.z, hit.id)) {
            showToast('🌱 Cần thêm không gian trống phía trên để cây lớn!');
          }
        }
        return;
      }
      if (hit.id === B.WHEAT_0 || hit.id === B.WHEAT_1 || hit.id === B.WHEAT_2) {
        consumeMeal();
        const nextStage = Math.min(B.WHEAT_3, hit.id + 1 + (Math.random() < 0.5 ? 1 : 0));
        setBlockWorld(hit.x, hit.y, hit.z, nextStage, true);
        flushUrgentChunks(16);
        return;
      }
      if (hit.id === B.GRASS) {
        consumeMeal();
        const flora = [B.TALL_GRASS, B.SHORT_GRASS, B.FLOWER_RED, B.FLOWER_YELLOW];
        for (let i = 0; i < 6; i++) {
          const rx = hit.x + ((Math.random() * 5 - 2.5) | 0), rz = hit.z + ((Math.random() * 5 - 2.5) | 0);
          if (getBlockWorld(rx, hit.y, rz) === B.GRASS && getBlockWorld(rx, hit.y + 1, rz) === B.AIR) {
            setBlockWorld(rx, hit.y + 1, rz, flora[(Math.random() * flora.length) | 0], true);
          }
        }
        flushUrgentChunks(16);
        return;
      }
      showToast('🦴 Chỉ bón Bột Xương được cho Mầm Cây, Lúa Mì hoặc Cỏ Xanh!');
      return;
    }

    if (selDef.tool || selDef.itemOnly || (!selDef.solid && !selDef.cross && !selDef.torch && !selDef.liquid && !selDef.portal) || !hit) return;
    const { px, py, pz } = hit;

    // Double-Slab Merge: placing matching slab onto opposite half of an existing slab creates a full block!
    if (selDef.slab && !selDef.slabTop && (hit.id === slot.id || hit.id === selDef.slabTopId)) {
      const wantMerge = (hit.id === slot.id && py === hit.y + 1)
        || (hit.id === selDef.slabTopId && py === hit.y - 1)
        || (py === hit.y && ((hit.id === slot.id && (hit.hy || 0) >= 0.5) || (hit.id === selDef.slabTopId && (hit.hy || 0) < 0.5)));
      if (wantMerge) {
        const overXZ = (player.x + PLAYER_RADIUS > hit.x && player.x - PLAYER_RADIUS < hit.x + 1 && player.z + PLAYER_RADIUS > hit.z && player.z - PLAYER_RADIUS < hit.z + 1);
        if (overXZ && player.y < hit.y + 1.0 && player.y + PLAYER_HEIGHT > hit.y) {
          if (player.y >= hit.y + 0.45 && !playerCollides(player.x, hit.y + 1.0, player.z)) {
            player.y = hit.y + 1.0; player.fallStartY = Math.max(player.fallStartY, player.y);
          } else return;
        }
        setBlockWorld(hit.x, hit.y, hit.z, selDef.fullBlockId, true);
        waterloggedBlocks.delete(modKey(hit.x, hit.y, hit.z));
        fluidLevel.delete(modKey(hit.x, hit.y, hit.z));
        wakeAdjacentFluids(hit.x, hit.y, hit.z, 0.75);
        flushUrgentChunks(32);
        if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
        player.swingT = 0.24; playSfx('place'); renderHotbar();
        return;
      }
    }

    if (py <= MIN_Y || py > MAX_Y) return;
    if (!player.onGround && player.vy > 0 && py === Math.floor(player.y) && (player.y - py) >= -0.05 && (player.y - py) < 0.44 && !playerCollides(player.x, py + 1.005, player.z)) {
      player._stepCamOff = Math.max(-0.45, (player._stepCamOff || 0) + (player.y - (py + 1.005)));
      player.y = py + 1.005;
      player.fallStartY = Math.max(player.fallStartY, player.y);
    }
    const inP = (px >= Math.floor(player.x - PLAYER_RADIUS) && px <= Math.floor(player.x + PLAYER_RADIUS) && pz >= Math.floor(player.z - PLAYER_RADIUS) && pz <= Math.floor(player.z + PLAYER_RADIUS) && py >= Math.floor(player.y) && py <= Math.floor(player.y + PLAYER_HEIGHT));
    if (inP) return;

    // Authentic 2-Block Half-Height Colored Minecraft Bed Placement
    if (selDef.bed && !selDef.bedFoot) {
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      let dx = 0, dz = 0;
      if (Math.abs(fx) >= Math.abs(fz)) dx = fx >= 0 ? 1 : -1;
      else dz = fz >= 0 ? 1 : -1;
      let hx = px + dx, hz = pz + dz;
      const headOpen = (getBlockWorld(hx, py, hz) === B.AIR || (BLOCK_DEF[getBlockWorld(hx, py, hz)] && BLOCK_DEF[getBlockWorld(hx, py, hz)].cross));
      if (!headOpen) {
        hx = px - dx; hz = pz - dz;
        if (!(getBlockWorld(hx, py, hz) === B.AIR || (BLOCK_DEF[getBlockWorld(hx, py, hz)] && BLOCK_DEF[getBlockWorld(hx, py, hz)].cross))) {
          showToast('🛏️ Cần 2 ô trống cạnh nhau để đặt Giường chuẩn Minecraft!');
          return;
        }
      }
      const bedFootId = selDef.bedPartner || B.BED_FOOT;
      setBlockWorld(px, py, pz, bedFootId, true);
      setBlockWorld(hx, py, hz, slot.id, true);
      flushUrgentChunks(32);
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
      player.swingT = 0.24; playSfx('place'); renderHotbar();
      return;
    }

    if (slot.id === B.TORCH_BLOCK) {
      const fdx = px - hit.x, fdy = py - hit.y, fdz = pz - hit.z;
      const tk = modKey(px, py, pz);
      if (fdy === 0) {
        if (fdx === 1) torchAttachDir.set(tk, 'nx');
        else if (fdx === -1) torchAttachDir.set(tk, 'px');
        else if (fdz === 1) torchAttachDir.set(tk, 'nz');
        else if (fdz === -1) torchAttachDir.set(tk, 'pz');
      } else if (fdy === 1) {
        torchAttachDir.set(tk, 'floor');
      } else {
        torchAttachDir.delete(tk);
      }
    }

    // Authentic Minecraft End Crystal Rule: ONLY placeable on top of Obsidian (B.OBSIDIAN) or Bedrock (B.BEDROCK)!
    if (slot.id === B.END_CRYSTAL_BLOCK) {
      const baseId = (py === hit.y + 1) ? hit.id : getBlockWorld(px, py - 1, pz);
      if (baseId !== B.OBSIDIAN && baseId !== B.BEDROCK) {
        showToast('💎 Pha Lê End chỉ đặt được trên Khối Hắc Diện Thạch (Obsidian) hoặc Đá Nền (Bedrock)!');
        return;
      }
    }

    // Sapling Soil Validation
    if (BLOCK_DEF[slot.id]?.isSapling) {
      const soilId = getBlockWorld(px, py - 1, pz);
      const okBase = soilId === B.GRASS || soilId === B.DIRT || soilId === B.AUTUMN_PODZOL || soilId === B.MYCELIUM || soilId === B.MOSS_BLOCK || soilId === B.FARMLAND || soilId === B.BLUE_GRASS || soilId === B.SIFT_GRASS || soilId === B.LULLABY_GRASS || soilId === B.HUSK_SOIL || soilId === B.SPORE_TURF || soilId === B.PALE_MOSS || soilId === B.NIGHTMARE_MOSS || soilId === B.SCULK || soilId === B.CRIMSON_NYLIUM || soilId === B.WARPED_NYLIUM || soilId === B.NETHERRACK || soilId === B.MUD;
      const okSand = (slot.id === B.PALM_SAPLING || slot.id === B.MANGROVE_PROPAGULE) && (soilId === B.SAND || soilId === B.RED_SAND);
      if (!okBase && !okSand) {
        showToast('🌱 Mầm cây chỉ trồng được trên Đất, Cỏ, Rêu hoặc Đất Trồng!');
        return;
      }
    }

    // v29/v69: Cầu thang theo góc nhìn + Phiến (Slab) đặt nửa trên/dưới + hỗ trợ Waterlog!
    let placeId = slot.id;
    const pdefS = BLOCK_DEF[placeId];
    if (pdefS && pdefS.stairs) {
      const fdx = -Math.sin(player.yaw), fdz = -Math.cos(player.yaw);
      const sdir = (Math.abs(fdx) >= Math.abs(fdz)) ? (fdx >= 0 ? 2 : 3) : (fdz >= 0 ? 1 : 0);
      placeId = (pdefS.stairBase || B.OAK_STAIRS_N) + sdir;
    } else if (pdefS && pdefS.slab && !pdefS.slabTop) {
      const wantTop = (py === hit.y - 1) || (py === hit.y && (hit.hy || 0) >= 0.5);
      placeId = wantTop ? pdefS.slabTopId : slot.id;
    }
    const wasWater = (((pdefS && pdefS.slab) || placeId === B.END_CRYSTAL_BLOCK) && getBlockWorld(px, py, pz) === B.WATER);
    setBlockWorld(px, py, pz, placeId, true);
    if (placeId === B.DRAGON_HEAD && typeof dragonHeadYaw !== 'undefined') {
      dragonHeadYaw.set(modKey(px, py, pz), player.yaw + Math.PI);
    }
    if (placeId === B.WINDMILL_HUB && typeof windmillHubState !== 'undefined') {
      const fdx = -Math.sin(player.yaw), fdz = -Math.cos(player.yaw);
      const wyaw = (Math.abs(fdx) >= Math.abs(fdz)) ? (fdx >= 0 ? -Math.PI * 0.5 : Math.PI * 0.5) : (fdz >= 0 ? Math.PI : 0);
      windmillHubState.set(modKey(px, py, pz), { yaw: wyaw, speed: 1 });
    }
    if (!(player.sneaking && isWoolBlock(placeId))) {
      emitSculkVibration(px + 0.5, py + 0.5, pz + 0.5, 'place', 8);
    }
    if (pdefS && pdefS.chest) {
      if (!isEnderChestBlock(placeId)) {
        const tk = toTrueChestKey(px, py, pz);
        consumedLootChests.add(currentDimension + ':' + tk);
        naturalChestTags.delete(tk);
        chestStorageMap.set(tk, createEmptyChestSlots(pdefS.chestSlots || 27));
      }
      const paired = tryPairChestAt(px, py, pz, placeId);
      if (paired) showToast('📦 Đã ghép thành Rương Lớn!');
    }
    if (slot.id === B.WATER || slot.id === B.LAVA) {
      fluidLevel.set(modKey(px, py, pz), 0);
      scheduleFluid(px, py, pz, slot.id === B.LAVA ? 0.24 : 0.10);
      if (slot.id === B.LAVA) igniteAdjacentTnt(px, py, pz);
    } else if (wasWater) {
      const pk = modKey(px, py, pz);
      waterloggedBlocks.add(pk);
      fluidLevel.set(pk, 0);
      scheduleFluid(px, py, pz, 0.10);
    } else {
      const pk = modKey(px, py, pz);
      waterloggedBlocks.delete(pk);
      fluidLevel.delete(pk);
      wakeAdjacentFluids(px, py, pz, 0.75);
      if (placeId === B.TNT) {
        const adj = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        for (const [dx, dy, dz] of adj) {
          if (getBlockWorld(px + dx, py + dy, pz + dz) === B.LAVA) { igniteAdjacentTnt(px, py, pz); break; }
        }
      }
    }
    flushUrgentChunks(32);
    if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; }
    player.swingT = 0.24; playSfx('place'); renderHotbar();
    if (placeId === B.END_CRYSTAL_BLOCK) {
      _endCrystalScanT = 0;
      tryRespawnEnderDragonWithCrystals(px, py, pz);
    }
    if (pdefS && pdefS.dragonEgg) {
      const ek = modKey(px, py, pz);
      incubatingEggs.set(ek, { x: px, y: py, z: pz, el: pdefS.dragonEgg, eggId: placeId, timer: 8.0 });
      showToast(`🔥 Đang ấp ${pdefS.name}! Sẽ nở sau 8 giây (hoặc chạm lại để nở ngay)!`);
    }
    if (pdefS && pdefS.isSapling) {
      plantedSaplings.set(modKey(px, py, pz), { x: px, y: py, z: pz, id: placeId, age: 0, targetAge: 35 + Math.random() * 45 });
    }
  }

  const _elMineRing = document.getElementById('mineRing'), _elMineArc = document.getElementById('mineRingArc');
  const _elAtkCdWrap = document.getElementById('atkCdWrap'), _elAtkCdFill = document.getElementById('atkCdFill');
  let _lastMineRingOn = false;
  function _setMineRing(on) {
    if (on === _lastMineRingOn || !_elMineRing) return;
    _lastMineRingOn = on;
    _elMineRing.classList.toggle('active', on);
  }
  function updateMining(dt) {
    mining.swinging = false;
    const isDirectTouch = (mobileCtrlMode === 'touch_direct' && showMobileControls);
    const rx = (isDirectTouch && mining.touchX !== null) ? mining.touchX : null;
    const ry = (isDirectTouch && mining.touchY !== null) ? mining.touchY : null;
    const hit = (isDirectTouch && !mining.active) ? null : raycastBlock(5.4, false, false, rx, ry);
    if (hit) {
      if (IS_FENCE_WALL[hit.id] === 1) {
        const bnd = getFenceWallUnionBounds(hit.x, hit.y, hit.z, hit.id);
        highlightMesh.scale.set(bnd.sx, bnd.sy, bnd.sz);
        highlightMesh.position.set(hit.x + bnd.cx, hit.y + bnd.cy, hit.z + bnd.cz);
      } else {
        const slT = IS_SLAB[hit.id];
        highlightMesh.scale.set(1, slT > 0 ? 0.5 : 1, 1);
        highlightMesh.position.set(hit.x + 0.5, hit.y + (slT === 1 ? 0.25 : (slT === 2 ? 0.75 : 0.5)), hit.z + 0.5);
      }
      highlightMesh.visible = !hudHidden;
    } else highlightMesh.visible = false;
    const mineArc = _elMineArc;
    if (mining.breakCd > 0) mining.breakCd = Math.max(0, mining.breakCd - dt);
    if (!mining.active || player.dead) { mining.progress = 0; player.mineSwingPhase = 0; crackMesh.visible = false; _setMineRing(false); return; }
    if (mining.breakCd > 0) { mining.progress = 0; player.mineSwingPhase = 0; crackMesh.visible = false; _setMineRing(false); return; }

    if (mining.sfxTimer > 0) mining.sfxTimer -= dt;
    if (raycastMob(4.4, rx, ry)) {
      player.mineSwingPhase = 0;
      if ((player.atkCd || 0) <= 0.01) attackTargetMob(rx, ry);
      return;
    }
    if (!hit) { mining.progress = 0; player.mineSwingPhase = 0; crackMesh.visible = false; _setMineRing(false); return; }
    if (hit.id === B.END_CRYSTAL_BLOCK) {
      startHandSwing(0.25, 'attack');
      mining.active = false;
      mining.progress = 0;
      crackMesh.visible = false;
      _setMineRing(false);
      detonateEndCrystalAt(hit.x, hit.y, hit.z);
      return;
    }
    const def = BLOCK_DEF[hit.id] || BLOCK_DEF[B.DIRT];
    if (hit.id === B.BEDROCK || def.unbreakable) {
      mining.progress = 0;
      player.mineSwingPhase = 0;
      crackMesh.visible = false;
      _setMineRing(false);
      if (mining.sfxTimer <= 0) { showToast('🪨 Đá Nền (Bedrock) không thể đào phá!'); mining.sfxTimer = 1.2; }
      return;
    }
    const k = modKey(hit.x, hit.y, hit.z);
    if (mining.key !== k) { mining.key = k; mining.progress = 0; }

    const sel = inventory[player.selectedSlot], selDef = (sel && sel.count > 0) ? BLOCK_DEF[sel.id] : null;
    const reqTier = def.reqTier || 0;
    const heldPickTier = (selDef && selDef.tool === 'pick') ? (selDef.pickTier || 1) : 0;
    const tierOk = (gameMode === 'creative') || (reqTier === 0) || (heldPickTier >= reqTier);
    if (def.indestructible) {
      mining.progress = 0;
      player.mineSwingPhase = 0;
      _setMineRing(false);
      if (mining.sfxTimer <= 0) { showToast('🛡️ Cổng Giấc Mơ bất tử — không thể bị phá hủy!'); mining.sfxTimer = 1.6; }
      return;
    }
    mining.swinging = true;
    mining.heldDur = (mining.heldDur || 0) + dt;
    if (player.swingT <= 0.001) {
      startHandSwing(0.30, 'mine');
      if (selDef && (selDef.tool === 'pick' || selDef.tool === 'axe' || selDef.tool === 'shovel' || selDef.tool === 'hoe')) {
        spawnSwordSlashArc(((player.swingStep || 0) % 2) + 1, selDef, true, false);
      }
      mining._didInitialSwing = true;
    }
    const _mDur = Math.max(0.18, player.swingDur || 0.28);
    const _mU = Math.max(0, Math.min(1, 1.0 - player.swingT / _mDur));
    player.mineSwingPhase = _mU * Math.PI;
    const tierNames = ['', 'Cúp Gỗ', 'Cúp Đá/Đồng', 'Cúp Sắt', 'Cúp Kim Cương/Ruby', 'Cúp Netherite', 'Cúp Ichor / Mặt Trăng', 'Cúp Aetherium / Tinh Vân', 'Cúp Lăng Kính 7 Màu'];
    if (!tierOk && mining.sfxTimer <= 0) {
      showToast(`⛏️ Cần ${tierNames[reqTier] || 'Cúp cao hơn'} trở lên để khai thác ${def.name}!`);
      mining.sfxTimer = 1.6;
    }
    // Tốc độ đào CHUẨN MINECRAFT: Cúp chỉ đào đá/quặng nhanh (đào đất chậm như tay không), Xẻng mới đào đất/cỏ/cát nhanh, Rìu đào gỗ nhanh!
    let speedMul;
    const handSpeed = def.dirt ? 0.48 : (def.wood ? 0.26 : (def.rock ? (tierOk ? 0.28 : 0.12) : 0.32));
    if (!(selDef && selDef.tool)) {
      speedMul = handSpeed;
    } else {
      let matched = false;
      if (selDef.tool === 'pick' && def.rock && tierOk) { speedMul = selDef.mineMul; matched = true; }
      else if (selDef.tool === 'axe' && def.wood) { speedMul = selDef.mineMul; matched = true; }
      else if (selDef.tool === 'shovel' && def.dirt) { speedMul = selDef.mineMul; matched = true; }
      else if (selDef.tool === 'shears' && def.shearsOnly) { speedMul = 9.0; matched = true; }   // Kéo cắt lá cực nhanh
      if (!matched) speedMul = handSpeed;
      if (sel && sel.ench && tierOk && matched) speedMul += 2.5;
    }
    if (player.dragonArmorSet === 'earth') speedMul *= 1.25;

    // v43 Sift Ore Mining Curve: Diamond (tier 4) = slow; Netherite (tier 5) = medium; Ichor/Moon (6) & Aether/Nebula (7) = fast; Dream Prism (8) = turbo!
    if (def.siftOre && gameMode !== 'creative') {
      if (heldPickTier === 4) speedMul *= 0.16;
      else if (heldPickTier === 5) speedMul *= 0.62;
      else if (heldPickTier >= 8) speedMul *= 1.45;
    }
    // v43 Instant 1-Click Fruit / Berry / Crop Harvest (just like Minecraft!)
    const isInstantFruit = !!(def.instantFruit || hit.id === B.BERRY_BUSH || hit.id === B.MELON_BLOCK || hit.id === B.WHEAT_3 || hit.id === B.SIFT_BERRY_BUSH);
    if (isInstantFruit) {
      mining.progress = 1.05;
    } else {
      mining.progress += (gameMode === 'creative') ? (dt / 0.11) : ((dt * speedMul) / Math.max(0.08, def.hard));
    }
    if (!player._mineHitFired && _mU >= 0.40) {
      player._mineHitFired = true;
      playBlockSfx(hit.id, false);
      spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.mapColor || '#aaa', 3, false);
      if (selDef && selDef.tool === 'pick' && def.rock) spawnParticles(hit.x + 0.5, hit.y + 0.65, hit.z + 0.5, selDef.rainbow ? 0x38e8e1 : 0xfef08a, 3, true);
      else if (selDef && selDef.tool === 'axe' && def.wood) spawnParticles(hit.x + 0.5, hit.y + 0.55, hit.z + 0.5, 0xd97706, 3, false);
    }

    const pct = Math.min(1, mining.progress);
    _setMineRing(true); mineArc.setAttribute('stroke-dashoffset', (87.96 * (1 - pct)).toFixed(2));
    if (!def.cross && !def.torch) { crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); crackMat.map = crackTextures[Math.min(4, Math.floor(pct * 5))]; crackMesh.visible = true; }
    if (mining.progress >= 1.0) {
      const brokenId = hit.id;
      // Lá cây chỉ rơi khi CẮT BẰNG KÉO (giống Minecraft). Đập tay / cuốc / rìu thì lá mất, không rơi.
      const _heldSlot = inventory[player.selectedSlot];
      const _heldId = (_heldSlot && _heldSlot.count > 0) ? _heldSlot.id : 0;
      const _needsShears = !!(BLOCK_DEF[brokenId] && BLOCK_DEF[brokenId].shearsOnly && _heldId !== B.SHEARS);
      // Chuẩn Minecraft: Cúp có Phù Phép (Silk Touch) đào khối quặng mới rơi nguyên Khối Quặng; cúp thường rơi kim cương / than / phôi thô!
      const _hasSilkPick = !!(_heldSlot && _heldSlot.ench && selDef && selDef.tool === 'pick');
      const _baseDrop = (BLOCK_DEF[brokenId] && BLOCK_DEF[brokenId].drop) || 0;
      const dropId = (tierOk && !_needsShears) ? ((_hasSilkPick && BLOCK_DEF[brokenId] && BLOCK_DEF[brokenId].oreBlock && brokenId !== B.DIAMOND_ORE) ? brokenId : _baseDrop) : 0;
      if (def.xp && tierOk && !_hasSilkPick) spawnXpOrbs(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.xp);
      const bk = modKey(hit.x, hit.y, hit.z);
      const wasWL = waterloggedBlocks.delete(bk);
      setBlockWorld(hit.x, hit.y, hit.z, wasWL ? B.WATER : B.AIR, true);
      if (wasWL) { fluidLevel.set(bk, 0); wakeAdjacentFluids(hit.x, hit.y, hit.z); }
      else flowWaterInto(hit.x, hit.y, hit.z);
      doorOpenState.delete(bk);
      incubatingEggs.delete(bk);
      plantedSaplings.delete(bk); saplingFertilizeCount.delete(bk);
      spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.mapColor || '#999', 8, false);
      if (brokenId === B.REDSTONE_ORE && tierOk && !_hasSilkPick) {
        const extraRed = 3 + ((Math.random() * 2) | 0);
        spawnDroppedItem(hit.x, hit.y, hit.z, B.REDSTONE, { count: extraRed });
        spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 0xef4444, 6, true);
      } else if (brokenId === B.DRAGON_CRYSTAL_ORE && tierOk && !_hasSilkPick) {
        if (Math.random() < 0.6) spawnDroppedItem(hit.x, hit.y, hit.z, B.DRAGON_CRYSTAL, { count: 1 });
        spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 0xfbbf24, 8, true);
      }
      // Authentic Minecraft Grass -> Wheat Seeds Drop (~28%), Ripe Wheat -> 1-2 Wheat + 1-3 Seeds, Melon -> 3-6 Slices!
      if (brokenId === B.TALL_GRASS || brokenId === B.AUTUMN_GRASS) {
        // Rơi hạt giống theo xác suất, KHÔNG hiện thông báo (tránh spam khi đập cỏ liên tục)
        if (Math.random() < 0.28) spawnDroppedItem(hit.x, hit.y, hit.z, B.WHEAT_SEEDS);
      } else if (brokenId === B.WHEAT_3) {
        const wQty = 1 + (Math.random() < 0.45 ? 1 : 0);
        const sQty = 1 + ((Math.random() * 3) | 0);
        spawnDroppedItem(hit.x, hit.y, hit.z, B.WHEAT, { count: wQty });
        spawnDroppedItem(hit.x, hit.y, hit.z, B.WHEAT_SEEDS, { count: sQty });
        showToast(`🌾 Thu hoạch ${wQty}× Lúa Mì Chín & ${sQty}× Hạt Giống!`);
      } else if (brokenId === B.BERRY_BUSH) {
        const bQty = 2 + ((Math.random() * 2) | 0);
        spawnDroppedItem(hit.x, hit.y, hit.z, B.SWEET_BERRIES, { count: bQty });
      } else if (brokenId === B.SIFT_BERRY_BUSH) {
        const fQty = 2 + ((Math.random() * 2) | 0);
        spawnDroppedItem(hit.x, hit.y, hit.z, B.DREAM_FRUIT, { count: fQty });
      } else if (brokenId === B.GRAVEL) {
        if (Math.random() < 0.18) {
          spawnDroppedItem(hit.x, hit.y, hit.z, B.FLINT);
          showToast('🪨 Nhặt được Đá Lửa (Flint) từ Đá Sỏi!');
        } else {
          spawnDroppedItem(hit.x, hit.y, hit.z, B.GRAVEL);
        }
      } else if (brokenId === B.MELON_BLOCK) {
        const mQty = 3 + ((Math.random() * 4) | 0);
        spawnDroppedItem(hit.x, hit.y, hit.z, B.MELON_SLICE, { count: mQty });
      } else if (_needsShears) {
        if (def.saplingDrop && Math.random() < 0.16) spawnDroppedItem(hit.x, hit.y, hit.z, def.saplingDrop);
        if ((brokenId === B.OAK_LEAVES || brokenId === B.DARK_OAK_LEAVES) && Math.random() < 0.03) spawnDroppedItem(hit.x, hit.y, hit.z, B.APPLE);
      } else if (dropId) {
        spawnDroppedItem(hit.x, hit.y, hit.z, dropId);
      }
      if (def.chest) breakChestAt(hit.x, hit.y, hit.z, brokenId);
      if (brokenId === B.OBSIDIAN || brokenId === B.NETHER_PORTAL) {
        extinguishConnectedNetherPortal(hit.x, hit.y, hit.z);
      }
      if (!tierOk && reqTier > 0) showToast(`❌ ${def.name} vỡ vụn vì thiếu ${tierNames[reqTier]}!`);

      // 1) Authentic Minecraft Bamboo & Sugar Cane Gravity Cascade (chopping bottom drops ALL blocks directly above!)
      if (brokenId === B.BAMBOO || brokenId === B.SUGAR_CANE) {
        let cy = hit.y + 1, cascaded = 0;
        while (cy <= MAX_Y && getBlockWorld(hit.x, cy, hit.z) === brokenId) {
          setBlockWorld(hit.x, cy, hit.z, B.AIR, true);
          spawnParticles(hit.x + 0.5, cy + 0.5, hit.z + 0.5, '#6db52f', 5, false);
          spawnDroppedItem(hit.x, cy, hit.z, brokenId);
          cy++; cascaded++;
        }
        if (cascaded > 0) showToast(`🎋 Đã đốn ngã toàn bộ ${cascaded + 1} đốt ${def.name}!`);
      }
      // 2) Authentic 2-Block Bed Paired Destruction (breaking Head or Foot cleanly removes partner half!)
      if (def && def.bed) {
        const partner = def.bedPartner || ((brokenId === B.BED) ? B.BED_FOOT : B.BED);
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (getBlockWorld(hit.x + dx, hit.y, hit.z + dz) === partner) {
            setBlockWorld(hit.x + dx, hit.y, hit.z + dz, B.AIR, true);
            break;
          }
        }
      }
      // 3) End Crystal Smash: Explodes Crystal & Deals 25 Backlash Damage to Boss Ender Dragon!
      if (brokenId === B.END_CRYSTAL_BLOCK) {
        _endCrystalScanT = 0;
        spawnParticles(hit.x + 0.5, hit.y + 0.8, hit.z + 0.5, 0xe879f9, 22, true);
        playSfx('mob_explode');
        const drg = mobs.find(mb => mb.type === 'ender_dragon');
        if (drg) hurtMob(drg, 25, 0, 0, 0, false, true);
        showToast('💎 Đã phá hủy Pha Lê End! Rồng Ender mất hồi máu (-25 HP)!');
      }

      // Dựng lại ngay mesh chunk vừa đào (kể cả chunk giáp ranh) để tuyệt đối không còn lỗi hiển thị block ma!
      flushUrgentChunks(32);
      emitSculkVibration(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 'break', 9);
      damageHeldTool(1);
      playBlockSfx(brokenId, true); mining.progress = 0; mining.breakCd = 0.20; crackMesh.visible = false; _setMineRing(false);
    }
  }


  function updatePlayer(dt) {
    if (player.dead) { syncSpyglassZoomState(); player.landAnimT = 0; player.landSquash = 0; return; }
    syncSpyglassZoomState();
    if (player.invuln > 0) player.invuln -= dt;
    if (player.blockingT > 0) player.blockingT = Math.max(0, player.blockingT - dt);
    if ((player.shieldDisableT || 0) > 0) {
      player.shieldDisableT = Math.max(0, player.shieldDisableT - dt);
      if (player.shieldDisableT <= 0 && typeof renderEquipmentUI === 'function') renderEquipmentUI();
    }
    if ((player.shieldImpactT || 0) > 0) player.shieldImpactT = Math.max(0, player.shieldImpactT - dt * 5.5);
    const _shHandNow = (typeof getActiveShieldHand === 'function') ? getActiveShieldHand() : null;
    const _shWant = (_shHandNow && (player.shieldDisableT || 0) <= 0 && (player.sneaking || player.blockingT > 0)) ? 1 : 0;
    player.shieldRaiseT = (player.shieldRaiseT || 0) + (_shWant - (player.shieldRaiseT || 0)) * (1 - Math.exp(-13.5 * dt));
    if (gameMode !== 'creative' && player.flying) player.flying = false;
    if (gameMode === 'creative') {
      player.hp = player.maxHp; player.hunger = 20; player.air = player.maxAir;
    }

    const wCol = measureWaterColumnAt(player.x, player.y, player.z);
    const feetBlock = getBlockWorld(Math.floor(player.x), Math.floor(player.y + 0.2), Math.floor(player.z));
    const eyeWorldY = player.y + EYE_HEIGHT + (player.swimEyeOff || 0);
    const eyeBlock = getBlockWorld(Math.floor(player.x), Math.floor(eyeWorldY), Math.floor(player.z));
    const wasInWater = player.inWater;
    const wasInLava = player.inLava;
    player.waterDepth = wCol.depth;
    player.waterSurfaceY = wCol.surfaceY;
    player.waterBotY = wCol.botY;
    player.inWater = wCol.inWater;
    player.eyesInWater = _isWaterLike(eyeBlock) && (!wCol.inWater || eyeWorldY < wCol.surfaceY);
    const _lavaEyeAbove = getBlockWorld(Math.floor(player.x), Math.floor(eyeWorldY) + 1, Math.floor(player.z)) === B.LAVA;
    player.inLava = (feetBlock === B.LAVA || eyeBlock === B.LAVA);
    player.eyesInLava = (eyeBlock === B.LAVA && eyeWorldY < (Math.floor(eyeWorldY) + (_lavaEyeAbove ? 1.0 : 0.90)));
    // Nước nông 1 ô -> đi bộ / chạy bình thường; chỉ >= 2 ô nước & ngập thân mới đứng nước / bơi!
    player.deepWater = wCol.inWater && wCol.depth >= 2 && (player.y < wCol.surfaceY - 0.55);
    if (player.deepWater && !player.inBoat) player.sitting = false;
    if (player.inWater && !wasInWater) {
      playSfx('splash');
      spawnPixelFx('water_splash', player.x, player.y + 0.45, player.z, { count: 2, scale: 1.15, life: 0.42, riseV: 0.6, spread: 0.5 });
    } else if (player.deepWater && player.curSpeed > 1.6 && (frameCounter % (player.lowSprintSwim ? 4 : 7)) === 0) {
      spawnParticles(player.x, player.y + (player.lowSprintSwim ? 0.35 : 0.72), player.z, 0xbae6fd, player.lowSprintSwim ? 3 : 2, true);
    }
    if (player.inLava && !wasInLava) {
      playSfx('lava_splash');
      spawnVoxelFx('lava_pop', player.x, player.y + 0.45, player.z, 2);
      spawnVoxelFx('ember', player.x, player.y + 0.55, player.z, 5);
      spawnVoxelFx('smoke', player.x, player.y + 0.65, player.z, 2);
    } else if (player.inLava && !player.eyesInLava && player.curSpeed > 0.5 && (frameCounter % 16) === 0) {
      spawnVoxelFx('ember', player.x, player.y + 0.35, player.z, 2);
    }
    if (player.eyesInWater !== _lastEyesInWater) {
      _lastEyesInWater = player.eyesInWater;
      _elUnderwater.classList.toggle('active', _lastEyesInWater);
    }
    if (player.eyesInLava !== _lastEyesInLava) {
      _lastEyesInLava = player.eyesInLava;
      if (_elLava) _elLava.classList.toggle('active', _lastEyesInLava);
    }

    const _isFireImmuneEquip = (player.dragonArmorSet === 'fire' || !!(player.equip.chest && BLOCK_DEF[player.equip.chest] && BLOCK_DEF[player.equip.chest].fireImmune));
    if (player.inLava && gameMode !== 'creative' && !_isFireImmuneEquip) {
      player.burnTime = Math.max(player.burnTime || 0, 6.0);
      lavaTick += dt;
      if (lavaTick >= 0.45) { lavaTick = 0; hurtPlayer(4, 'Bạn rơi xuống hồ Dung Nham!'); }
    } else if (player.onGround && !player.sneaking && getBlockWorld(Math.floor(player.x), Math.floor(player.y - 0.15), Math.floor(player.z)) === B.MAGMA_BLOCK && gameMode !== 'creative' && !_isFireImmuneEquip) {
      lavaTick += dt;
      if (lavaTick >= 0.85) { lavaTick = 0; hurtPlayer(1, '🔥 Bỏng chân trên Khối Dung Nham (ngồi Shift để tránh)!'); }
    } else lavaTick = 0;

    if (gameMode === 'creative' || player.inWater || _isFireImmuneEquip) {
      player.burnTime = 0; player._burnSoul = false; fireTick = 0;
    } else {
      const feetSoul = (feetBlock === B.SOUL_FIRE);
      if (feetBlock === B.FIRE || feetSoul) {
        player.burnTime = Math.max(player.burnTime || 0, 4.5);
        player._burnSoul = feetSoul;
      }
      if ((player.burnTime || 0) > 0) {
        player.burnTime = Math.max(0, player.burnTime - dt);
        fireTick += dt;
        if (fireTick >= 0.75) {
          fireTick = 0;
          hurtPlayer(player._burnSoul ? 3 : 2, player._burnSoul ? '🩵 Bạn đang cháy trong Lửa Linh Hồn!' : '🔥 Bạn đang bị cháy!');
          spawnParticles(player.x, player.y + 0.9, player.z, player._burnSoul ? 0x22d3ee : 0xf97316, 4, true);
          playSfx('burn');
        }
      } else { player._burnSoul = false; fireTick = 0; }
    }
    const fireHudOn = (!player.inLava && !player.eyesInLava && (player.burnTime || 0) > 0 && gameMode !== 'creative' && !player.dead);
    if (_elFireHud && fireHudOn !== _lastFireHudOn) {
      _lastFireHudOn = fireHudOn;
      _elFireHud.classList.toggle('active', fireHudOn);
    }

    // === v62 Instant Portal Detection (0s Minecraft-style immediate portal trigger -> Bedrock Dynamic Loading Screen!) ===
    if (flyingEnderEyes.length > 0) updateFlyingEnderEyes(dt);
    updateDreamRuinsAndPortals(dt);
    if (_portalCooldown > 0) _portalCooldown = Math.max(0, _portalCooldown - dt);
    const bodyBlock = getBlockWorld(Math.floor(player.x), Math.floor(player.y + 0.9), Math.floor(player.z));
    const underFeetBlock = getBlockWorld(Math.floor(player.x), Math.floor(player.y - 0.15), Math.floor(player.z));
    const inNetherPortal = (feetBlock === B.NETHER_PORTAL || bodyBlock === B.NETHER_PORTAL);
    const inEndPortal = (feetBlock === B.END_PORTAL || bodyBlock === B.END_PORTAL || underFeetBlock === B.END_PORTAL);
    const inEndGateway = (feetBlock === B.END_GATEWAY || bodyBlock === B.END_GATEWAY || underFeetBlock === B.END_GATEWAY);
    const inDreamPortal = (feetBlock === B.DREAM_PORTAL || bodyBlock === B.DREAM_PORTAL);
    const inWardenPortal = (feetBlock === B.WARDEN_PORTAL || bodyBlock === B.WARDEN_PORTAL);
    if (inWardenPortal && _portalCooldown <= 0 && !isWorldLoading) {
      _portalCooldown = 4.5;
      if (currentDimension === 'warden') {
        showWorldLoadingOverlay(
          'Đang tải thế giới',
          'Đang rời Thế Giới Warden trở về Overworld...',
          () => switchDimension('overworld', '🌿 Đã quay về Overworld qua Cổng Cổ Thành!', { returnFromWarden: true }),
          { badge: 'OVERWORLD' }
        );
      } else {
        window.lastWardenOverworldPos = { x: Math.floor(player.x), y: Math.floor(player.y), z: Math.floor(player.z) };
        showWorldLoadingOverlay(
          'Đang tải thế giới',
          'Đang tiến vào Thế Giới Cổ Thành Warden...',
          () => switchDimension('warden', '🩵 ĐÃ BƯỚC VÀO THẾ GIỚI WARDEN CỔ ĐẠI!'),
          { badge: 'WARDEN REALM' }
        );
      }
    } else if (inEndGateway && _portalCooldown <= 0 && !isWorldLoading && currentDimension === 'end' && typeof teleportViaEndGateway === 'function') {
      teleportViaEndGateway(Math.hypot(player.x, player.z) < 180);
    } else if (inDreamPortal && _portalCooldown <= 0 && !isWorldLoading) {
      _portalCooldown = 4.5;
      if (_elDreamPortalOv) _elDreamPortalOv.classList.remove('active');
      if (currentDimension === 'sift') {
        showWorldLoadingOverlay(
          'Đang tải thế giới',
          'Đang rời Khu Giấc Mơ trở về Thế Giới Chính...',
          () => switchDimension('overworld', '🌿 Đã quay về Overworld qua Cổng Giấc Mơ!', { returnFromSift: true, portalCoords: lastSiftOverworldPos }),
          { badge: 'OVERWORLD' }
        );
      } else {
        lastSiftOverworldPos = { x: Math.floor(player.x), z: Math.floor(player.z) };
        showWorldLoadingOverlay(
          'Đang tải thế giới',
          'Đang bước vào Khu Giấc Mơ (The Sift)...',
          () => switchDimension('sift'),
          { badge: 'THE SIFT' }
        );
      }
    } else if (inEndPortal && _portalCooldown <= 0 && !isWorldLoading) {
      _portalCooldown = 4.5;
      if (_elNetherPortalOv) _elNetherPortalOv.classList.remove('active');
      if (currentDimension === 'end') {
        showWorldLoadingOverlay(
          'Đang tải thế giới',
          'Đang bước qua Cổng Kết Thúc trở về Thế Giới Chính...',
          () => switchDimension('overworld', '🌿 Đã trở về Thế Giới Chính từ Thành Phố Kết Thúc!'),
          { badge: 'OVERWORLD' }
        );
      } else {
        showWorldLoadingOverlay(
          'Đang tải thế giới',
          'Đang mở Thành Phố Kết Thúc (The End) — Đối đầu Rồng Ender!',
          () => switchDimension('end', '🌌 ĐÃ BƯỚC QUA CỔNG KẾT THÚC TỚI THE END — ĐỐI ĐẦU RỒNG ENDER!'),
          { badge: 'THE END' }
        );
      }
    } else if (inNetherPortal && _portalCooldown <= 0 && !isWorldLoading && (currentDimension === 'overworld' || currentDimension === 'nether')) {
      _portalCooldown = 4.5;
      if (_elNetherPortalOv) _elNetherPortalOv.classList.remove('active');
      teleportViaNetherPortal();
    }

    if (player.waterBreathT > 0) player.waterBreathT = Math.max(0, player.waterBreathT - dt);
    if (player.eyesInWater && gameMode !== 'creative' && player.dragonArmorSet !== 'water') {
      if (player.waterBreathT <= 0) {
        player.air = Math.max(0, player.air - dt * 0.68);
        if (player.air <= 0) { drownTick += dt; if (drownTick >= 1.0) { drownTick = 0; hurtPlayer(2, 'Bạn đã hết oxy dưới nước!'); } }
      } else { player.air = player.maxAir; }
      renderStatusBars();
    } else if (player.air < player.maxAir) {
      player.air = Math.min(player.maxAir, player.air + dt * (player.dragonArmorSet === 'water' ? 12.0 : 4.0));
      renderStatusBars();
    } else {
      if (_elAirRow && _elAirRow.classList.contains('visible')) renderStatusBars();
    }

    if (player.chillT > 0) player.chillT = Math.max(0, player.chillT - dt);
    if (player.entangleT > 0) player.entangleT = Math.max(0, player.entangleT - dt);
    if (player.dragonArmorSet === 'ice' && (frameCounter % 15) === 0) {
      for (let mi = 0; mi < mobs.length; mi++) {
        const mb = mobs[mi];
        if (!mb || mb._dead || mb.tamed || !mb.hostile) continue;
        const dx = mb.x - player.x, dz = mb.z - player.z, d2 = dx * dx + dz * dz;
        if (d2 < 20.25 && Math.abs(mb.y - player.y) < 3.5) {
          mb._chilledT = 2.0;
          if ((frameCounter % 30) === 0) spawnParticles(mb.x, mb.y + 0.9, mb.z, 0x7dd3fc, 2, true);
        }
      }
      if (player.sneaking && !player.inWater && player.onGround) {
        const px = Math.floor(player.x), pz = Math.floor(player.z);
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
          if (getBlockWorld(px + ox, WATER_LEVEL, pz + oz) === B.WATER) setBlockWorld(px + ox, WATER_LEVEL, pz + oz, B.ICE, false);
        }
      }
    }
    const canCtrl = !!(isPlaying && !player.dead);
    if (canCtrl) { updateTouchBow(dt); updateBowDrawState(dt); } else cancelBowDraw();
    updateContextPetBtn(false, dt);

    let f = canCtrl ? touchState.joyY : 0, s = canCtrl ? touchState.joyX : 0;
    if (canCtrl) {
      if (keys['KeyW'] || keys['ArrowUp']) f += 1;
      if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) s -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) s += 1;
    }
    let len = Math.hypot(f, s), sprinting = false, moveX = 0, moveZ = 0;

    if (player.ridingDragon && player.ridingDragon._dead) {
      if (typeof detachRiderFromDragon === 'function') detachRiderFromDragon();
      player.ridingDragon = null; player.sitting = false;
    }
    if (player.ridingDragon && !player.ridingDragon._dead) {
      const dm = player.ridingDragon;
      let rf = f, rs = s;
      if (len > 1) { rf /= len; rs /= len; }
      sprinting = canCtrl && !!(keys['ControlLeft'] || keys['ControlRight'] || touchState.sprint) && rf > 0.15;
      const rSpd = sprinting ? 23.0 : 16.0;
      const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
      const cosP = Math.max(0.28, Math.cos(player.pitch)), sinP = Math.sin(player.pitch);
      const tVx = (-sinY * cosP * rf + cosY * rs) * rSpd;
      const tVz = (-cosY * cosP * rf - sinY * rs) * rSpd;
      const hoverUD = canCtrl ? (((keys['Space'] || touchState.jump || dragonFlyCtrl.up) ? 9.5 : 0) - ((keys['ShiftLeft'] || keys['ShiftRight'] || touchState.sneak || dragonFlyCtrl.down) ? 9.5 : 0)) : 0;
      const upDown = rf * sinP * rSpd + hoverUD;
      const smK = 1 - Math.exp(-10.5 * dt);
      const vK = 1 - Math.exp(-9.5 * dt);
      player.smoothMoveX = (player.smoothMoveX || 0) + (tVx - (player.smoothMoveX || 0)) * smK;
      player.smoothMoveZ = (player.smoothMoveZ || 0) + (tVz - (player.smoothMoveZ || 0)) * smK;
      player.vy = (player.vy || 0) + (upDown - (player.vy || 0)) * vK;
      moveX = player.smoothMoveX; moveZ = player.smoothMoveZ;
      if (Math.abs(moveX) < 0.01 && tVx === 0) moveX = 0;
      if (Math.abs(moveZ) < 0.01 && tVz === 0) moveZ = 0;
      if (Math.abs(player.vy) < 0.01 && upDown === 0) player.vy = 0;
      const nxD = dm.x + moveX * dt, nzD = dm.z + moveZ * dt, nyD = Math.min(540, dm.y + player.vy * dt);
      const bxCur = Math.floor(dm.x), bzCur = Math.floor(dm.z), byMid = Math.floor(dm.y + 0.9), byHi = Math.floor(dm.y + 1.9);
      const _isDrgWall = (wx, wy, wz) => { const b = getBlockWorld(wx, wy, wz), d = BLOCK_DEF[b]; return isSolidAt(wx, wy, wz) && !(d && (d.foliage || d.cross)); };
      if (!_isDrgWall(Math.floor(nxD), byMid, bzCur) && !_isDrgWall(Math.floor(nxD), byHi, bzCur)) dm.x = nxD;
      else player.smoothMoveX = 0;
      if (!_isDrgWall(Math.floor(dm.x), byMid, Math.floor(nzD)) && !_isDrgWall(Math.floor(dm.x), byHi, Math.floor(nzD))) dm.z = nzD;
      else player.smoothMoveZ = 0;
      const bxNew = Math.floor(dm.x), bzNew = Math.floor(dm.z);
      const solidUnder = _isDrgWall(bxNew, Math.floor(nyD + 0.02), bzNew);
      if (solidUnder && player.vy <= 0) {
        dm.y = Math.floor(nyD + 0.02) + 1.02;
        player.vy = 0;
      } else if (!solidUnder) {
        dm.y = Math.max(MIN_Y + 2, nyD);
      }
      dm.flying = (upDown > 0.2) || !_isDrgWall(bxNew, Math.floor(dm.y - 0.35), bzNew);
      let dDiff = (player.yaw + Math.PI) - dm.yaw;
      while (dDiff > Math.PI) dDiff -= Math.PI * 2;
      while (dDiff < -Math.PI) dDiff += Math.PI * 2;
      const yawStep = dDiff * (1 - Math.exp(-9.5 * dt));
      dm.yaw += yawStep;
      const wantBank = Math.max(-0.32, Math.min(0.32, -rs * 0.18 - yawStep * 2.2));
      const wantPitch = Math.max(-0.52, Math.min(0.52, -player.vy * 0.032));
      dm._bankRoll = (dm._bankRoll || 0) + (wantBank - (dm._bankRoll || 0)) * (1 - Math.exp(-9.0 * dt));
      dm._flyPitch = (dm._flyPitch || 0) + (wantPitch - (dm._flyPitch || 0)) * (1 - Math.exp(-9.0 * dt));
      dm.rx = dm.x; dm.ry = dm.y; dm.rz = dm.z; dm.ryaw = dm.yaw;
      if (dm.group) {
        dm.group.position.set(dm.x, dm.y, dm.z);
        dm.group.rotation.y = dm.yaw;
        dm.group.rotation.z = dm._bankRoll;
      }
      if (dm.anim && dm.anim.torso) dm.anim.torso.rotation.x = dm._flyPitch;
      if (typeof attachRiderToDragon === 'function' && typeof playerAvatar !== 'undefined' && playerAvatar.g && playerAvatar.g.parent === scene) {
        attachRiderToDragon(dm);
      }
      if (typeof getDragonSaddleWorldPos === 'function') {
        const sw = getDragonSaddleWorldPos(dm);
        player.x = sw.x; player.y = sw.y; player.z = sw.z;
      } else {
        const scD = dm.dragonScale || 1.16;
        player.x = dm.x + Math.sin(dm.yaw) * (0.20 * scD);
        player.y = dm.y + 1.62 * scD;
        player.z = dm.z + Math.cos(dm.yaw) * (0.20 * scD);
      }
      player.vx = 0; player.vz = 0;
      player.sitting = true; player.sneaking = false; player.onGround = !dm.flying;
      player.fallStartY = player.y;
      player.curSpeed = Math.hypot(moveX, moveZ);
      player.sprinting = sprinting;
    } else {
    if (canCtrl && (keys['Space'] || touchState.jump || Math.abs(f) > 0.1 || Math.abs(s) > 0.1) && player.sitting && !player.inBoat) {
      player.sitting = false;
    }
    const wantSneak = canCtrl && !!(keys['ShiftLeft'] || keys['ShiftRight'] || touchState.sneak);
    const activeSneak = wantSneak && (!player.deepWater || player.flying);
    if (!activeSneak && player.sneaking && !player.flying && playerCollides(player.x, player.y, player.z, PLAYER_HEIGHT)) {
      player.sneaking = true;
    } else {
      player.sneaking = activeSneak;
    }
    player.sneakEyeOff = (player.sneakEyeOff || 0) + ((player.sneaking ? -0.38 : 0) - (player.sneakEyeOff || 0)) * (1 - Math.exp(-18.0 * dt));
    const wantSitDip = (player.sitting && !player.ridingDragon && !player.inBoat && !player.flying && !player.deepWater);
    player.sitEyeOff = (player.sitEyeOff || 0) + ((wantSitDip ? -0.56 : 0) - (player.sitEyeOff || 0)) * (1 - Math.exp(-14.0 * dt));
    const sprintInput = canCtrl && !!(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyR'] || player.doubleTapSprint || touchState.sprint || (showMobileControls && touchState.joyY >= 0.92 && Math.abs(touchState.joyX) < 0.58));
    sprinting = (!player.sneaking || player.deepWater) && sprintInput && (f > 0.15 || (player.deepWater && len > 0.15)) && player.hunger > 4;
    const wantSprintSwim = player.deepWater && !player.flying && !player.inBoat && sprinting && len > 0.08;
    if (!wantSprintSwim && player.sprintSwimming && !player.flying && playerCollides(player.x, player.y, player.z, PLAYER_HEIGHT)) {
      player.sprintSwimming = true;
    } else {
      player.sprintSwimming = wantSprintSwim;
    }
    const distAboveSeabed = player.deepWater ? (player.y - wCol.botY) : 99;
    player.lowSprintSwim = !!(player.sprintSwimming && player.deepWater && (distAboveSeabed <= 0.28 || player.onGround || wantSneak));
    const targetSwimEye = player.lowSprintSwim ? -0.78 : (player.sprintSwimming ? -0.45 : 0);
    player.swimEyeOff = (player.swimEyeOff || 0) + (targetSwimEye - (player.swimEyeOff || 0)) * (1 - Math.exp(-12.0 * dt));
    const sneakMul = 1.0 + (player.swiftSneak || 0) * 0.45;
    const baseSpeed = player.sneaking ? (SNEAK_SPEED * sneakMul) : (sprinting ? SPRINT_SPEED : WALK_SPEED);
    const groundBelow = underFeetBlock;
    if (player.onGround && !player.flying && groundBelow === B.SCULK_SHRIEKER) {
      triggerSculkShrieker(Math.floor(player.x), Math.floor(player.y - 0.15), Math.floor(player.z));
    }
    if (player.inBoat && !player.inWater && groundBelow !== B.WATER) player.inBoat = false;
    const iceBoost = (groundBelow === B.PACKED_ICE || groundBelow === B.ICE) ? 1.65 : 1.0;
    const elemDebuff = (player.entangleT > 0) ? 0.45 : ((player.chillT > 0) ? 0.65 : 1.0);
    const swimSpeedBase = player.inBoat ? (baseSpeed * 2.15)
      : (player.inLava ? (baseSpeed * 0.48)
      : (player.lowSprintSwim ? (SPRINT_SPEED * 1.28)
        : (player.sprintSwimming ? (SPRINT_SPEED * 1.04)
          : (player.deepWater ? (WALK_SPEED * 0.82)
            : (player.inWater ? (baseSpeed * 0.82) : (baseSpeed * iceBoost))))));
    const waterArmBoost = (player.dragonArmorSet === 'water' && player.inWater) ? 1.35 : 1.0;
    const moveSpeed = swimSpeedBase * elemDebuff * waterArmBoost;

    let targetMoveX = 0, targetMoveZ = 0;
    if (len > 0.08) {
      const cl = len > 1 ? 1 / len : 1; f *= cl; s *= cl;
      const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
      const flyBoost = player.flying ? 2.45 : 1.0;
      targetMoveX = (-sinY * f + cosY * s) * moveSpeed * flyBoost;
      targetMoveZ = (-cosY * f - sinY * s) * moveSpeed * flyBoost;
      player.walkBob += dt * (sprinting ? 12 : player.sneaking ? 5.5 : 8.5);
      const stepCycle = Math.floor(player.walkBob / Math.PI);
      if (player.onGround && !player.flying && !player.inBoat && stepCycle !== player.lastStepCycle) {
        player.lastStepCycle = stepCycle;
        if (!player.sneaking) {
          playFootstep(groundBelow || B.CONCRETE, false);
          emitSculkVibration(player.x, player.y, player.z, 'step', 9);
        }
      }
      hungerTick += dt * (sprinting ? 0.35 : 0.08) * getDifficultyCfg().hungerMul;
    }
    // Luanti-style frame-rate-independent smooth acceleration & inertia (zero stutter across 30/60/120fps)
    const isIce = (groundBelow === B.PACKED_ICE || groundBelow === B.ICE);
    const accelRate = player.flying ? 14.0 : (isIce ? 5.5 : (player.inWater ? 8.5 : (player.onGround ? 22.0 : 9.5)));
    const smoothK = 1 - Math.exp(-accelRate * dt);
    player.smoothMoveX = (player.smoothMoveX || 0) + (targetMoveX - (player.smoothMoveX || 0)) * smoothK;
    player.smoothMoveZ = (player.smoothMoveZ || 0) + (targetMoveZ - (player.smoothMoveZ || 0)) * smoothK;
    if (Math.abs(player.smoothMoveX) < 0.01 && targetMoveX === 0) player.smoothMoveX = 0;
    if (Math.abs(player.smoothMoveZ) < 0.01 && targetMoveZ === 0) player.smoothMoveZ = 0;
    moveX = player.smoothMoveX; moveZ = player.smoothMoveZ;
    player.curSpeed = Math.hypot(moveX, moveZ);
    player.sprinting = !!sprinting;
    const kbDamp = Math.exp(-9.5 * dt);
    player.vx *= kbDamp; player.vz *= kbDamp;

    if (worldDifficulty === 'peaceful' && gameMode !== 'creative') {
      if (player.hunger < player.maxHunger) { player.hunger = player.maxHunger; renderStatusBars(); }
      if (player.hp < player.maxHp) {
        player.regenTimer = (player.regenTimer || 0) + dt;
        if (player.regenTimer >= 1.1) {
          player.regenTimer = 0;
          player.hp = Math.min(player.maxHp, player.hp + 1);
          renderStatusBars();
        }
      } else { player.regenTimer = 0; }
    } else if (gameMode !== 'creative') {
      if (player.dragonArmorSet === 'leaf' && player.hp < player.maxHp) {
        player._leafRegenT = (player._leafRegenT || 0) + dt;
        if (player._leafRegenT >= 2.5) { player._leafRegenT = 0; player.hp = Math.min(player.maxHp, player.hp + 1); renderStatusBars(); }
      }
      if (player.hunger >= 18 && player.hp < player.maxHp) {
        const regenInterval = (player.hunger >= 20) ? 1.35 : 3.2;
        player.regenTimer = (player.regenTimer || 0) + dt;
        if (player.regenTimer >= regenInterval) {
          player.regenTimer = 0;
          player.hp = Math.min(player.maxHp, player.hp + 1); // Half-heart heal (+1 of 20)
          hungerTick += 2.2; // Consumes food bar smoothly during health regeneration like real Minecraft
          renderStatusBars();
        }
      } else {
        player.regenTimer = 0;
      }
    }
    if (hungerTick >= 6.5) { hungerTick -= 6.5; if (gameMode !== 'creative' && player.hunger > 0) { player.hunger--; renderStatusBars(); } }

    const wantJump = canCtrl && !!(keys['Space'] || touchState.jump);
    const _chestDef = player.equip.chest ? BLOCK_DEF[player.equip.chest] : null;
    const _hasElytraEquipped = !!(_chestDef && _chestDef.isElytra);
    if (player.gliding && (player.onGround || player.inWater || player.flying || player.sitting || player.ridingDragon || !_hasElytraEquipped)) {
      player.gliding = false;
      player.glideVel = null;
    }
    if (player.flying) {
      const flyV = (wantJump ? 14.0 : 0) - (player.sneaking ? 14.0 : 0);
      player.vy = flyV;
      player.fallStartY = player.y;
    } else if (player.gliding) {
      const isPhxGlide = (player.equip.chest === B.ELYTRA_PHOENIX);
      if (!player.glideVel) {
        const initSp = Math.max(10.0, Math.hypot(moveX, moveZ));
        player.glideVel = { x: -Math.sin(player.yaw) * initSp, y: player.vy, z: -Math.cos(player.yaw) * initSp };
      }
      const sinP = Math.sin(player.pitch), cosP = Math.max(0.25, Math.cos(player.pitch));
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      let hSp = Math.hypot(player.glideVel.x, player.glideVel.z);
      if (sinP < -0.04) {
        hSp = Math.min(isPhxGlide ? 38.0 : 34.0, hSp + (-sinP) * 21.0 * dt);
        player.vy = Math.max(-22.0, player.vy + sinP * 14.0 * dt);
      } else {
        hSp = Math.max(4.5, hSp * Math.exp((isPhxGlide ? -0.15 : -0.22) * dt) - sinP * 9.5 * dt);
        const lift = Math.min(18.0, sinP * hSp * (isPhxGlide ? 1.65 : 1.45));
        player.vy = Math.min(14.0, Math.max(-3.0, player.vy + (lift - (isPhxGlide ? 5.6 : 6.8) * cosP) * dt));
      }
      player.vy = Math.max(-14.0, player.vy - (isPhxGlide ? 0.9 : 1.2) * dt);
      const steerK = 1 - Math.exp(-5.4 * dt);
      const tgtX = fx * hSp, tgtZ = fz * hSp;
      player.glideVel.x += (tgtX - player.glideVel.x) * steerK;
      player.glideVel.z += (tgtZ - player.glideVel.z) * steerK;
      moveX = player.glideVel.x; moveZ = player.glideVel.z;
      player.curSpeed = Math.hypot(moveX, moveZ);
      if (Math.abs(player.vy) < 10.5) player.fallStartY = player.y;
      if (isPhxGlide && (frameCounter % 4) === 0) spawnParticles(player.x, player.y + 0.5, player.z, 0xf97316, 2, true);
      if ((frameCounter % 45) === 0 && gameMode !== 'creative') {
        const elyMax = (_chestDef && _chestDef.maxDur) || 432;
        if (!player.equipMeta.chest) player.equipMeta.chest = { dur: elyMax, maxDur: elyMax };
        if (player.equipMeta.chest.dur > 1) player.equipMeta.chest.dur--;
      }
    } else if (player.inBoat) {
      const targetBoatY = WATER_LEVEL + 0.88;
      player.vy = (targetBoatY - player.y) * 8.0;
      player.fallStartY = player.y;
    } else if (player.deepWater) {
      const targetFloatY = wCol.surfaceY - 1.22;
      if (wantJump) {
        player.vy = 6.5;
      } else if (wantSneak) {
        player.vy = player.sprintSwimming ? -8.5 : -6.2;
      } else if (player.lowSprintSwim && player.pitch <= 0.28) {
        player.vy = (distAboveSeabed > 0.16) ? -2.8 : 0;
      } else if (len > 0.08 && Math.abs(player.pitch) > 0.22) {
        const pitchV = Math.sin(player.pitch) * moveSpeed * 1.25;
        player.vy = (player.y >= wCol.surfaceY - 1.05 && pitchV > 0) ? 0 : Math.max(-6.8, Math.min(5.2, pitchV));
      } else if (len > 0.08) {
        if (player.y > targetFloatY + 0.06) player.vy = (targetFloatY - player.y) * 4.0;
        else if (player.y > targetFloatY - 0.45 && !player.sprintSwimming) player.vy = (targetFloatY - player.y) * 2.5;
        else player.vy *= Math.exp(-6.0 * dt);
      } else {
        player.vy = Math.max(-4.5, Math.min(4.8, (targetFloatY - player.y) * 5.2));
      }
      player.fallStartY = player.y;
    } else if (player.inLava) {
      if (wantJump) player.vy = 3.6;
      else if (wantSneak) player.vy = -3.8;
      else player.vy = Math.max(-2.2, (player.vy || 0) * Math.exp(-6.0 * dt) - 1.6 * dt);
      player.fallStartY = player.y;
    }
    else {
      player._jumpBufT = wantJump ? 0.10 : Math.max(0, (player._jumpBufT || 0) - dt);
      if ((wantJump || player._jumpBufT > 0) && player.onGround) {
        player.vy = JUMP_VEL; player.onGround = false; player._jumpBufT = 0; player.landAnimT = 0;
        player.jumpFlip = -(player.jumpFlip || 1); player.jumpPopT = 1.0; playSfx('jump');
      }
      player.vy = Math.max(-36, player.vy - GRAVITY * dt);
    }

    let resolvedUpY = false;
    if (!player.flying && !player.inBoat && player.vy > 0) {
      const nyUp = Math.min(540, player.y + player.vy * dt);
      if (!playerCollides(player.x, nyUp, player.z)) {
        player.y = nyUp; player.onGround = false; player.fallStartY = player.y;
      } else {
        let lo = player.y, hi = nyUp;
        for (let b = 0; b < 5; b++) {
          const mid = (lo + hi) * 0.5;
          if (playerCollides(player.x, mid, player.z)) hi = mid; else lo = mid;
        }
        player.y = lo; player.vy = 0;
      }
      resolvedUpY = true;
    }

    // Sub-Stepped Solid Player Collision (prevents clipping/snagging when sprinting, flying, or knocked back!)
    const dispX = (moveX + player.vx) * dt, dispZ = (moveZ + player.vz) * dt;
    const subSteps = Math.max(1, Math.min(4, Math.ceil(Math.hypot(dispX, dispZ) / 0.16)));
    const sxStep = dispX / subSteps, szStep = dispZ / subSteps;
    for (let st = 0; st < subSteps; st++) {
      const nx = player.x + sxStep, nz = player.z + szStep;
      const tcx = Math.floor(nx) >> 4, tcz = Math.floor(nz) >> 4;
      if (!chunks.has(chunkKey(tcx, tcz))) generateChunk(tcx, tcz);
      let sY;
      if (!playerCollides(nx, player.y, player.z)) {
        if (!player.sneaking || !player.onGround || player.flying || hasSupportBelow(nx, player.y, player.z)) player.x = nx;
      } else if ((sY = _tryStepPlayerStair(nx, player.z)) >= 0) {
        _applyPlayerStairStep(sY); player.x = nx;
      } else if (!player.onGround && player.vy > -2.8 && (Math.floor(player.y + 0.16) > Math.floor(player.y)) && !playerCollides(nx, Math.floor(player.y + 0.16) + 0.002, player.z)) {
        _applyPlayerStairStep(Math.floor(player.y + 0.16) + 0.002); player.x = nx;
      } else player.vx = 0;
      if (!playerCollides(player.x, player.y, nz)) {
        if (!player.sneaking || !player.onGround || player.flying || hasSupportBelow(player.x, player.y, nz)) player.z = nz;
      } else if ((sY = _tryStepPlayerStair(player.x, nz)) >= 0) {
        _applyPlayerStairStep(sY); player.z = nz;
      } else if (!player.onGround && player.vy > -2.8 && (Math.floor(player.y + 0.16) > Math.floor(player.y)) && !playerCollides(player.x, Math.floor(player.y + 0.16) + 0.002, nz)) {
        _applyPlayerStairStep(Math.floor(player.y + 0.16) + 0.002); player.z = nz;
      } else player.vz = 0;
    }

    if ((player.landAnimT || 0) > 0) {
      if (!player.onGround || player.inWater || player.flying || player.sitting || player.inBoat) player.landAnimT = 0;
      else { player.landAnimT += dt; if (player.landAnimT >= 0.483) player.landAnimT = 0; }
    }
    if (!resolvedUpY) {
      if (player.onGround && player.vy <= 0 && !playerCollides(player.x, player.y, player.z) && hasSupportBelow(player.x, player.y, player.z)) {
        player.vy = 0; player.fallStartY = player.y;
      } else {
        const ny = Math.min(540, player.y + player.vy * dt);
        if (!playerCollides(player.x, ny, player.z)) {
          player.y = ny; player.onGround = false; if (player.vy > 0) player.fallStartY = player.y;
        } else if (player.vy <= 0) {
          const landBlock = getBlockWorld(Math.floor(player.x), Math.floor(ny - 0.1), Math.floor(player.z));
          const wasOnGround = player.onGround;
          let lo = ny, hi = Math.max(ny, player.y);
          if (playerCollides(player.x, hi, player.z)) {
            let landedY = hi, stepUp = 0;
            while (playerCollides(player.x, landedY, player.z) && stepUp < 1.05) { landedY += 0.02; stepUp += 0.02; }
            hi = landedY; lo = landedY;
          } else {
            for (let b = 0; b < 6; b++) {
            const mid = (lo + hi) * 0.5;
            if (playerCollides(player.x, mid, player.z)) lo = mid; else hi = mid;
          }
        }
        const snapH = Math.round(hi * 2) * 0.5;
        let landedY = (Math.abs(hi - snapH) < 0.045 && !playerCollides(player.x, snapH, player.z)) ? snapH : hi;
        const fallDist = player.fallStartY - landedY;
        if (landBlock === B.SLIME_BLOCK && !player.sneaking) {
          player.y = Math.floor(landedY);
          while (playerCollides(player.x, player.y, player.z)) player.y += 0.05;
          player.vy = Math.max(12.5, Math.min(18.0, Math.sqrt(Math.max(4, fallDist) * 28)));
          player.onGround = false; player.fallStartY = player.y; player.landAnimT = 0;
          playSfx('splash');
        } else {
          if (fallDist > 4.6 && !player.inWater && !player.flying) {
            const rawFall = Math.floor((fallDist - 3.6) * 2 * (player.dragonArmorSet === 'earth' ? 0.70 : 1.0));
            const finalFall = (landBlock === B.HAY_BALE) ? Math.max(1, Math.floor(rawFall * 0.2)) : rawFall;
            if (finalFall > 0) hurtPlayer(finalFall, 'Bạn rơi từ trên cao xuống!');
          }
          if (!wasOnGround && player.vy < -2.6) {
            playFootstep(landBlock || B.STONE, true);
            if (!player.sneaking && fallDist > 1.2) emitSculkVibration(player.x, player.y, player.z, 'land', 9);
            if (landBlock === B.SCULK_SHRIEKER) triggerSculkShrieker(Math.floor(player.x), Math.floor(ny - 0.1), Math.floor(player.z));
            if (!player.inWater && !player.flying && !(player.sitting || player.inBoat) && fallDist >= 7.95) {
              player.landSquash = Math.min(1.0, Math.abs(player.vy) / 14.0);
              player.landAnimT = 0.001;
            }
          }
          if (landedY > player.y + 0.04) player._stepCamOff = Math.max(-0.5, (player._stepCamOff || 0) + (player.y - landedY));
          player.y = landedY;
          player.onGround = true; player.fallStartY = player.y;
          player.vy = 0;
        }
      } else {
        player.vy = 0;
      }
      }
    }

    // Authentic Minecraft Cactus Prick Contact Damage (touching any B.CACTUS deals 1 HP damage + gentle pushback!)
    player.cactusCd = Math.max(0, (player.cactusCd || 0) - dt);
    if (!player.dead && player.cactusCd <= 0 && gameMode !== 'creative' && player.dragonArmorSet !== 'leaf' && currentDimension === 'overworld' && ((frameCounter % 3) === 0 || len > 0.08)) {
      const cr = PLAYER_RADIUS + 0.10;
      let hitCac = null;
      for (let bx = Math.floor(player.x - cr); bx <= Math.floor(player.x + cr) && !hitCac; bx++) {
        for (let bz = Math.floor(player.z - cr); bz <= Math.floor(player.z + cr) && !hitCac; bz++) {
          for (let by = Math.floor(player.y); by <= Math.floor(player.y + PLAYER_HEIGHT) && !hitCac; by++) {
            if (getBlockWorld(bx, by, bz) === B.CACTUS) hitCac = { x: bx + 0.5, z: bz + 0.5 };
          }
        }
      }
      if (hitCac) {
        player.cactusCd = 0.55;
        hurtPlayer(1, 'Bạn bị gai Xương Rồng đâm chết!');
        const kdx = player.x - hitCac.x, kdz = player.z - hitCac.z, klen = Math.hypot(kdx, kdz) || 1;
        player.vx += (kdx / klen) * 3.8; player.vz += (kdz / klen) * 3.8; player.vy = Math.max(player.vy, 2.8);
        spawnParticles(player.x, player.y + 0.9, player.z, 0x4ade80, 6, false);
        showToast('🌵 Bị gai Xương Rồng đâm (-1 HP)!');
      }
    }

    // Seamless Vertical Excavation System: Dig down -1000 blocks -> The Nether -> Dig -1000 blocks -> The End!
    if (currentDimension === 'end') {
      if (player.y <= MIN_Y + 4) {
        if (gameMode === 'creative') {
          player.y = 26; player.vy = 0; player.flying = true; player.fallStartY = player.y;
          showToast('🕊️ Chế độ Sáng Tạo bất tử — Đã nâng trở lại Đảo End!');
        } else if (player.dragonArmorSet === 'ender' && (!player._enderRescueAt || elapsed - player._enderRescueAt > 20)) {
          player._enderRescueAt = elapsed;
          player.y = 42; player.vy = 0; player.fallStartY = 42;
          spawnParticles(player.x, player.y + 1, player.z, 0xd946ef, 22, true);
          playSfx('warp');
          showToast('🌌 Giáp Rồng Ender đã cứu bạn khỏi Hư Không!');
        } else {
          hurtPlayer(player.hp + 99, 'Bạn đã rơi xuống Hư Không ở tầng đáy Khu Kết Thúc!', true);
          return;
        }
      } else if (player.y < -14 && gameMode !== 'creative') {
        voidTick += dt;
        if (voidTick >= 0.35) { voidTick = 0; hurtPlayer(4, 'Bạn đã rơi khỏi đảo xuống Hư Không Khu Kết Thúc!', true); }
      } else {
        voidTick = 0;
      }
    } else if (currentDimension === 'overworld' || currentDimension === 'nether') {
      const curTrueY = player.y - depthOffset;
      if (curTrueY <= -980) {
        const _pCh = chunks.get(chunkKey(Math.floor(player.x) >> 4, Math.floor(player.z) >> 4));
        const _chkLy = (-999 + depthOffset) - MIN_Y;
        if (_pCh && _chkLy >= 0 && _chkLy < WORLD_H && _pCh.data[(_chkLy << 8) | ((Math.floor(player.z) & 15) << 4) | (Math.floor(player.x) & 15)] === B.BEDROCK) {
          const _repRock = currentDimension === 'nether' ? B.NETHERRACK : B.DEEPSLATE;
          for (const _c of chunks.values()) {
            let _mod = false;
            for (let _ly = 0; _ly < WORLD_H; _ly++) {
              const _ty = (MIN_Y + _ly) - depthOffset;
              if (_ty <= -1001 && _ty >= -1010) {
                const _b = _ly << 8;
                for (let _i = 0; _i < 256; _i++) if (_c.data[_b | _i] !== B.BEDROCK) { _c.data[_b | _i] = B.BEDROCK; _mod = true; }
              } else if (_ty >= -1000 && _ty <= -980) {
                const _b = _ly << 8;
                for (let _i = 0; _i < 256; _i++) if (_c.data[_b | _i] === B.BEDROCK) { _c.data[_b | _i] = _repRock; _mod = true; }
              }
            }
            if (_mod) { _c.dirty = true; _c.urgentDirty = true; _dirtyChunkSet.add(_c); _urgentChunkSet.add(_c); }
          }
        }
      }
      if (curTrueY < -1010.5) {
        if (currentDimension === 'overworld') {
          showWorldLoadingOverlay(
            'Đang tải thế giới',
            'Đào sâu đủ -1000m — Đang dựng địa hình Địa Ngục (The Nether)...',
            () => switchDimension('nether', '🔥 ĐÀO SÂU ĐỦ -1000 BLOCK! Bạn đã xuyên thủng xuống ĐỊA NGỤC (THE NETHER)!'),
            { badge: 'THE NETHER' }
          );
          return;
        } else if (currentDimension === 'nether') {
          showWorldLoadingOverlay(
            'Đang tải thế giới',
            'Đào sâu đủ -1000m từ Địa Ngục — Đang dựng Khu Kết Thúc (The End)...',
            () => switchDimension('end', '🌌 ĐÀO SÂU ĐỦ -1000 BLOCK TỪ ĐỊA NGỤC! Bạn đã tới KHU KẾT THÚC (THE END)!'),
            { badge: 'THE END' }
          );
          return;
        }
      } else if (((player.y <= MIN_Y + 14 || (depthOffset === 960 && player.y <= MIN_Y + 18)) && depthOffset < 1000) || (player.y >= MAX_Y - 12 && (depthOffset > 0 || (currentDimension === 'nether' && depthOffset > -240)))) {
        const dyShift = (player.y <= MIN_Y + 18 && depthOffset < 1000 && !(player.y >= MAX_Y - 12)) ? 40 : -40;
        // Resolve pending slices at the OLD depthOffset before shifting coordinates
        for (const ch of chunks.values()) {
          if (ch._pendingSlice) {
            const ps = ch._pendingSlice;
            ch._pendingSlice = null;
            _fillDeepUndergroundSlice(ch.cx, ch.cz, ch.cx * CHUNK_W, ch.cz * CHUNK_W, ch.data, ps[0], ps[1]);
          }
        }
        if (activeChestKey) closeChestModal();
        chestPairMap.clear();
        depthOffset += dyShift;
        player.y += dyShift;
        player.fallStartY += dyShift;
        if (mining.key) {
          const kp = mining.key.split(',');
          if (kp.length === 3) mining.key = `${kp[0]},${(+kp[1]) + dyShift},${kp[2]}`;
        }
        if (crackMesh.visible) crackMesh.position.y += dyShift;
        if (highlightMesh.visible) highlightMesh.position.y += dyShift;
        for (let i = 0; i < droppedItems.length; i++) {
          const it = droppedItems[i];
          if (it) {
            it.y += dyShift;
            if (it.ry !== undefined) it.ry += dyShift;
            if (it.mesh) it.mesh.position.y += dyShift;
            if (it.shadow) it.shadow.position.y += dyShift;
          }
        }
        for (let i = 0; i < xpOrbs.length; i++) {
          const xo = xpOrbs[i];
          if (xo) {
            xo.y += dyShift;
            if (xo.mesh) xo.mesh.position.y += dyShift;
          }
        }
        for (let i = 0; i < mobs.length; i++) {
          const m = mobs[i];
          if (m) {
            m.y += dyShift;
            if (m.ry !== undefined) m.ry += dyShift;
            if (m.group) m.group.position.y += dyShift;
          }
        }
        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          if (pt) pt.y += dyShift;
        }
        const _shiftCoordMap = (mp) => {
          if (!mp || mp.size === 0) return;
          const entries = Array.from(mp.entries());
          mp.clear();
          for (let i = 0; i < entries.length; i++) {
            const [k, v] = entries[i];
            const p = String(k).split(',');
            if (p.length === 3) {
              const ny = (+p[1]) + dyShift;
              if (ny >= MIN_Y && ny <= MAX_Y) {
                if (v && typeof v === 'object' && typeof v.y === 'number') v.y = ny;
                mp.set(`${p[0]},${ny},${p[2]}`, v);
              }
            }
          }
        };
        _shiftCoordMap(activeFires);
        _shiftCoordMap(fluidLevel);
        if (pouredFluidSources.size > 0) {
          const pArr = Array.from(pouredFluidSources); pouredFluidSources.clear();
          for (let i = 0; i < pArr.length; i++) {
            const p = String(pArr[i]).split(',');
            if (p.length === 3) {
              const ny = (+p[1]) + dyShift;
              if (ny >= MIN_Y && ny <= MAX_Y) pouredFluidSources.add(`${p[0]},${ny},${p[2]}`);
            }
          }
        }
        _shiftCoordMap(torchAttachDir);
        _shiftCoordMap(doorOpenState);
        _shiftCoordMap(dragonHeadYaw);
        _shiftCoordMap(windmillHubState);
        if (interactiveVisuals.size > 0) {
          const ivEntries = Array.from(interactiveVisuals.entries());
          interactiveVisuals.clear(); interactiveByChunk.clear(); endCrystalVisuals.clear(); animatedInteractiveVisuals.clear();
          for (let i = 0; i < ivEntries.length; i++) {
            const [ik, v] = ivEntries[i];
            const p = String(ik).split(',');
            if (p.length === 3) {
              const ny = (+p[1]) + dyShift;
              if (ny >= MIN_Y && ny <= MAX_Y && v && v.group) {
                v.group.position.y = ny;
                v.group.updateMatrixWorld(true);
                _setInteractiveVisual(`${p[0]},${ny},${p[2]}`, v);
                continue;
              }
            }
            if (v && v.group) scene.remove(v.group);
          }
        }
        for (let i = fluidQueue.length - 1; i >= 0; i--) {
          fluidQueue[i].y += dyShift;
          if (fluidQueue[i].y <= MIN_Y || fluidQueue[i].y >= MAX_Y) fluidQueue.splice(i, 1);
        }
        fluidQueuedSet.clear();
        for (let i = 0; i < fluidQueue.length; i++) fluidQueuedSet.add(modKey(fluidQueue[i].x, fluidQueue[i].y, fluidQueue[i].z));

        const _shiftChunkMeshesY = (ch, dy) => {
          const ms = [ch.mesh, ch.leavesMesh, ch.emissiveMesh, ch.waterMesh, ch.lavaMesh, ch.plantMesh, ch.portalMesh, ch.towerMesh];
          for (let i = 0; i < ms.length; i++) {
            const m = ms[i];
            if (m) { m.position.y += dy; m.updateMatrix(); m.updateMatrixWorld(true); }
          }
        };
        const scx = Math.floor(player.x) >> 4, scz = Math.floor(player.z) >> 4;
        if (typeof chunkWorkerPool !== 'undefined' && chunkWorkerPool.clear) chunkWorkerPool.clear();
        if (!chunks.has(chunkKey(scx, scz))) generateChunk(scx, scz);
        const fillId = currentDimension === 'nether' ? B.NETHERRACK : B.DEEPSLATE;
        const topSliceMinTrueY = (MAX_Y + 1 - 40) - depthOffset;
        const airTop = (depthOffset === 0 || (currentDimension === 'nether' && topSliceMinTrueY > 230));
        const _waterShiftPrefill = (player.eyesInWater && currentDimension === 'overworld');
        for (const ch of Array.from(chunks.values())) {
          const nearSync = Math.abs(ch.cx - scx) <= 2 && Math.abs(ch.cz - scz) <= 2;
          const oceanPrefill = (currentDimension === 'overworld' && !!ch.isOceanChunk);
          if (dyShift > 0) {
            ch.data.copyWithin(40 << 8, 0, (WORLD_H - 40) << 8);
            if (nearSync) {
              const pureO = !!_fillDeepUndergroundSlice(ch.cx, ch.cz, ch.cx * CHUNK_W, ch.cz * CHUNK_W, ch.data, 0, 39);
              ch.isOceanChunk = ch.isOceanChunk && pureO;
              ch._pendingSlice = null;
            } else {
              ch.data.fill((oceanPrefill || _waterShiftPrefill) ? B.WATER : fillId, 0, 40 << 8);
              ch._pendingSlice = [0, 39];
            }
            ch.maxLy = WORLD_H - 1;
          } else {
            ch.data.copyWithin(0, 40 << 8, WORLD_H << 8);
            if (nearSync && depthOffset === 0 && (currentDimension === 'overworld' || currentDimension === 'nether')) {
              const kCh = chunkKey(ch.cx, ch.cz);
              const savedLow = ch.data.slice(0, (WORLD_H - 40) << 8);
              chunks.delete(kCh); _invChunkCache();
              const surf = generateChunk(ch.cx, ch.cz);
              ch.data.set(surf.data);
              ch.data.set(savedLow, 0);
              ch.maxLy = applyChunkMods(ch.cx, ch.cz, ch.data, Math.max(ch.maxLy, surf.maxLy));
              registerChunk(kCh, ch);
              ch._pendingSlice = null;
            } else if (nearSync && (depthOffset > 0 || (currentDimension === 'nether' && depthOffset < 0))) {
              _fillDeepUndergroundSlice(ch.cx, ch.cz, ch.cx * CHUNK_W, ch.cz * CHUNK_W, ch.data, WORLD_H - 40, WORLD_H - 1);
              ch._pendingSlice = null;
            } else {
              ch.data.fill(airTop ? B.AIR : ((oceanPrefill || _waterShiftPrefill) ? B.WATER : fillId), (WORLD_H - 40) << 8, WORLD_H << 8);
              ch._pendingSlice = [WORLD_H - 40, WORLD_H - 1];
            }
            ch.maxLy = WORLD_H - 1;
          }
          _shiftChunkMeshesY(ch, dyShift);
          ch.dirty = true;
          ch._emitDirty = true;
          _dirtyChunkSet.add(ch);
          if (nearSync) { ch.urgentDirty = true; _urgentChunkSet.add(ch); }
        }
        lastPlayerCx = 99999; lastPlayerCz = 99999;
        _teleportWarmupFrames = Math.max(_teleportWarmupFrames, 32);
        flushUrgentChunks(32, true);
        if (dyShift > 0 && depthOffset > 0) {
          const px0 = Math.floor(player.x), pz0 = Math.floor(player.z);
          const curD = Math.floor(player.y - depthOffset);
          if (player.eyesInWater && currentDimension === 'overworld') {
            showToast(`🌊 Lặn Biển Sâu: ${curD}m / -700m`);
          } else {
            const dest = currentDimension === 'overworld' ? 'Địa Ngục' : 'Khu Kết Thúc';
            const ugBioNow = currentDimension === 'overworld' ? getUndergroundBiomeAt(px0, curD, pz0) : null;
            const bioTag = ugBioNow ? ` • ${ugBioNow.name}` : '';
            showToast(`⛏️ Độ sâu ${curD}m / -1000m${bioTag} (Còn ${Math.max(0, 1000 + curD)}m → ${dest})`);
          }
        } else if (currentDimension === 'nether' && depthOffset < 0) {
          const curTrueTop = Math.floor(player.y - depthOffset);
          const dugUp = Math.max(0, Math.min(200, curTrueTop - 26));
          if (depthOffset <= -200) {
            showToast('🌋 ĐÃ ĐÀO XUYÊN 200 LỚP ĐÁ TRẦN ĐỊA NGỤC! Chào mừng tới Tầng Thượng Địa Ngục & Quần Thể Công Trình Cổ Đại!');
          } else {
            showToast(`⛏️ Trần Địa Ngục: Đã đào lên ${dugUp}m / 200m (Còn ${Math.max(0, 200 - dugUp)}m → Tầng Thượng Địa Ngục)`);
          }
        }
      }
    }
    } // end normal player physics (non-dragon-riding)

    if (player._stepCamOff) {
      player._stepCamOff *= Math.exp(-16.0 * dt);
      if (Math.abs(player._stepCamOff) < 0.002) player._stepCamOff = 0;
    }
    const _wantBob = (player.onGround && !player.ridingDragon && len > 0.1) ? 1 : 0;
    player._groundBobW = (player._groundBobW || 0) + (_wantBob - (player._groundBobW || 0)) * Math.min(1, dt * 18.0);
    const bobY = Math.sin(player.walkBob) * (player.sneaking ? 0.02 : 0.045) * player._groundBobW;
    const eyeY = player.y + EYE_HEIGHT + (player.sneakEyeOff || 0) + (player.sitEyeOff || 0) + (player.swimEyeOff || 0) + bobY + (player._stepCamOff || 0);
    if (!player.spyglassZoom) {
      const bowZoom = player.bowDrawing ? (11.5 * Math.min(1, player.bowCharge || 0)) : 0;
      const targetFov = (player.lowSprintSwim ? 84 : (player.sprintSwimming ? 80 : 74)) - bowZoom;
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-10.0 * dt));
        if (Math.abs(camera.fov - targetFov) <= 0.04) camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }
    }
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 2.4);
    const skX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake * 0.28 : 0;
    const skY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake * 0.28 : 0;

    camera.rotation.order = 'YXZ'; camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
    if (player.swingT > (player._prevSwingT || 0) + 0.02) player.swingDur = player.swingT;
    if (player.swingT > 0) player.swingT = Math.max(0, player.swingT - dt);
    else { player.swingDur = 0.25; player._mineHitFired = false; }
    player._prevSwingT = player.swingT;
    if (player.itemLabelT > 0) {
      player.itemLabelT -= dt;
      if (player.itemLabelT <= 0 && _elItemLabel) _elItemLabel.textContent = '';
    }
    if (player.atkCd > 0) player.atkCd = Math.max(0, player.atkCd - dt);
    if (_elAtkCdWrap && _elAtkCdFill) {
      const cdMax = player.atkCdMax || 0.625;
      const wantVis = (player.atkCd > 0.01 && isPlaying && !player.dead);
      if (wantVis) {
        const chPct = Math.max(0, Math.min(1, 1 - player.atkCd / cdMax));
        const pctInt = Math.round(chPct * 100);
        const wantReady = chPct >= 0.85;
        if (!_lastAtkCdVis) { _elAtkCdWrap.classList.add('visible'); _lastAtkCdVis = true; }
        if (wantReady !== _lastAtkCdReady) { _elAtkCdWrap.classList.toggle('ready', wantReady); _lastAtkCdReady = wantReady; }
        if (pctInt !== _lastAtkCdPct) { _elAtkCdFill.style.width = `${pctInt}%`; _lastAtkCdPct = pctInt; }
      } else if (_lastAtkCdVis) {
        _elAtkCdWrap.classList.remove('visible', 'ready');
        _lastAtkCdVis = false; _lastAtkCdReady = false; _lastAtkCdPct = -1;
      }
    }
    if (player.comboResetT > 0) {
      player.comboResetT = Math.max(0, player.comboResetT - dt);
      if (player.comboResetT <= 0) { player.comboStep = 0; player.swordCombo = 0; }
    }
    if (player.swordAtkActive) {
      player.swordAtkT += dt;
      const _swLim = (player.swordAtkDur || 0.5) + 0.10 + 0.20;
      if (player.swordAtkT >= _swLim) {
        player.swordAtkActive = false;
        if (player._fpSwCur) player._fpSwCur.fill(0);
      }
    }
    player.equipPopT = Math.max(0, (player.equipPopT || 0) - dt * 5.2);
    player.jumpPopT = Math.max(0, (player.jumpPopT || 0) - dt * 6.5);
    player.landSquash = Math.max(0, (player.landSquash || 0) - dt * 4.2);
    player.hurtAnimT = Math.max(0, (player.hurtAnimT || 0) - dt);
    const isMiningSwing = !!(mining.active && mining.swinging);
    const swDur = Math.max(0.18, player.swingDur || 0.25);
    const swingActive = (player.swingT > 0.001);
    const swingU = swingActive ? Math.max(0, Math.min(1, 1.0 - player.swingT / swDur)) : 0;
    const swing = swingActive ? Math.sin(Math.pow(swingU, 0.72) * Math.PI) : 0;
    player.sprinting = sprinting;
    player.curSpeed = Math.hypot(moveX, moveZ);
    player.curSwing = swing;
    const heldSel = inventory[player.selectedSlot];
    const heldDef = (heldSel && heldSel.count > 0) ? BLOCK_DEF[heldSel.id] : null;
    const heldToolKind = (heldDef && heldDef.tool) ? heldDef.tool : '';
    const landCamDip = -(player.landSquash || 0) * 0.085;

    if (thirdPerson > 0) {
      const isFront = (thirdPerson === 2);
      _rayEuler.set(isFront ? -player.pitch * 0.45 : player.pitch, player.yaw, 0, 'YXZ');
      _rayDir.set(0, 0, isFront ? -1 : 1).applyEuler(_rayEuler);
      const _camBoxCollides = (cx, cy, cz, r) => {
        const x0 = Math.floor(cx - r), x1 = Math.floor(cx + r);
        const y0 = Math.floor(cy - r), y1 = Math.floor(cy + r);
        const z0 = Math.floor(cz - r), z1 = Math.floor(cz + r);
        for (let bx = x0; bx <= x1; bx++) {
          for (let bz = z0; bz <= z1; bz++) {
            const c = chunks.get(chunkKey(bx >> 4, bz >> 4));
            for (let by = y0; by <= y1; by++) {
              if (by < MIN_Y) { if (currentDimension !== 'end') return true; continue; }
              if (by > MAX_Y) continue;
              if (!c) return true;
              const idx = ((by - MIN_Y) << 8) | ((bz & 15) << 4) | (bx & 15);
              const id = c.data[idx];
              if (id === B.AIR) {
                if (by > MIN_Y && IS_DOOR[c.data[idx - 256]] === 1 && !doorOpenState.get(modKey(bx, by - 1, bz))) return true;
                continue;
              }
              if (IS_DOOR_OR_TRAP[id] === 1) { if (!doorOpenState.get(modKey(bx, by, bz))) return true; continue; }
              if (IS_SLAB[id] === 1) { if ((cy - r) < by + 0.5 && (cy + r) > by) return true; continue; }
              if (IS_SLAB[id] === 2) { if ((cy - r) < by + 1.0 && (cy + r) > by + 0.5) return true; continue; }
              if (IS_SOLID[id] === 1) return true;
            }
          }
        }
        return false;
      };
      const ox = player.x, oz = player.z;
      const camR = _camBoxCollides(ox, eyeY, oz, 0.22) ? 0.14 : 0.22;
      let oy = eyeY;
      const maxLift = isFront ? 0.05 : 0.24;
      for (let ly = 0.05; ly <= maxLift; ly += 0.05) {
        if (!_camBoxCollides(ox, eyeY + ly, oz, camR)) oy = eyeY + ly;
        else break;
      }
      const maxCamD = player.ridingDragon ? (isFront ? 5.6 : 7.4) : (isFront ? 3.2 : 3.8);
      let camD = 0;
      for (let d = 0.04; d <= maxCamD; d += 0.04) {
        if (_camBoxCollides(ox + _rayDir.x * d, oy + _rayDir.y * d, oz + _rayDir.z * d, camR)) {
          let lo = camD, hi = d;
          for (let b = 0; b < 4; b++) {
            const mid = (lo + hi) * 0.5;
            if (_camBoxCollides(ox + _rayDir.x * mid, oy + _rayDir.y * mid, oz + _rayDir.z * mid, camR)) hi = mid;
            else lo = mid;
          }
          camD = lo;
          break;
        }
        camD = d;
      }
      let camX = ox + _rayDir.x * camD, camY = oy + _rayDir.y * camD, camZ = oz + _rayDir.z * camD;
      if ((skX !== 0 || skY !== 0) && !_camBoxCollides(camX + skX, camY + skY, camZ, camR)) {
        camX += skX; camY += skY;
      }
      camera.position.set(camX, camY, camZ);
      playerAvatar.g.visible = (camD >= 0.25);
      if (isFront) {
        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw + Math.PI;
        camera.rotation.x = -player.pitch * 0.35;
      }
      if (!player.ridingDragon || playerAvatar.g.parent === scene) {
        playerAvatar.g.position.set(player.x, player.y + (player.ridingDragon ? 0 : (player._stepCamOff || 0)), player.z);
        playerAvatar.g.rotation.y = player.yaw + Math.PI;
      }
      const rightIn = canCtrl ? ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touchState.joyX) : 0;
      const _actType = isMiningSwing ? 'mine' : ((heldToolKind === 'sword' || !heldDef) ? 'attack' : 'mine');
      animatePlayerRig(playerAvatar, {
        speed: player.ridingDragon ? 0 : player.curSpeed, sprinting: !player.ridingDragon && sprinting, sneaking: player.sneaking,
        sitting: !!(player.sitting || player.inBoat),
        inWater: player.inWater, deepWater: player.deepWater,
        swimMoving: len > 0.08, sprintSwimming: !!player.sprintSwimming, lowSprintSwim: !!player.lowSprintSwim,
        eyesInWater: !!player.eyesInWater, onGround: player.onGround, vy: player.vy,
        pitch: player.pitch, swing, strafe: rightIn, landSquash: player.landSquash, landAnimT: player.landAnimT || 0,
        jumpPop: player.jumpPopT, jumpFlip: player.jumpFlip || 1,
        comboStep: player.comboStep || 0, toolKind: heldToolKind,
        swordAtkSeq: player.swordAtkActive ? (player.swordAtkSeq || 0) : 0,
        swordAtkHit: player.swordAtkHit || 0,
        swordAtkT: player.swordAtkT || 0,
        actionType: swingActive ? (player.swingAct || _actType) : _actType,
        swingActive,
        swingU,
        minePhase: swingU,
        heldId: (heldSel && heldSel.count > 0) ? heldSel.id : 0,
        heldEnch: !!(heldSel && heldSel.ench),
        bowDrawing: !!player.bowDrawing,
        bowCharge: player.bowCharge || 0,
        bowStage: player.bowStage || 0,
        blocking: player.blockingT > 0,
        shieldRaiseT: player.shieldRaiseT || 0,
        shieldHand: (typeof getActiveShieldHand === 'function') ? getActiveShieldHand() : null,
        flying: player.flying, gliding: !!player.gliding, hurtT: player.hurtAnimT
      }, dt, elapsed);
    } else {
      // Bị đánh trúng: giật camera NGẢ RA SAU (ngẩng mặt) thay vì nghiêng sang một bên
      const hurtK = player.hurtAnimT > 0 ? Math.sin((player.hurtAnimT / 0.42) * Math.PI) : 0;
      const strafeTiltZ = -(canCtrl ? (((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touchState.joyX) * (sprinting ? 0.018 : 0.008)) : 0);
      camera.rotation.x = player.pitch - hurtK * 0.20;
      camera.rotation.z = strafeTiltZ * 0.6 + hurtK * 0.035;
      if (player.ridingDragon) {
        const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
        camera.position.set(player.x + fwdX * 1.45 + skX, eyeY + 0.65 + skY, player.z + fwdZ * 1.45);
      } else {
        camera.position.set(player.x + skX, eyeY + landCamDip + skY - hurtK * 0.05, player.z);
      }
    }
    skyDome.position.copy(camera.position);

    // Authentic Punchy! + Move Those Hands 1st-Person ViewModel Kinematics
    // (Spring Camera Inertia + Equip Pop + 3-Hit Sword Combo + Heavy Pick/Axe Chop + Sprint Arm-Pump + Jump/Land Weight!)
    const prevYaw = player._prevHandYaw !== undefined ? player._prevHandYaw : player.yaw;
    const prevPitch = player._prevHandPitch !== undefined ? player._prevHandPitch : player.pitch;
    let dYaw = player.yaw - prevYaw; while (dYaw > Math.PI) dYaw -= Math.PI * 2; while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const dPitch = player.pitch - prevPitch;
    player._prevHandYaw = player.yaw; player._prevHandPitch = player.pitch;
    player._handLagX = ((player._handLagX || 0) + dYaw * 0.45) * Math.max(0, 1 - dt * 10.5);
    player._handLagY = ((player._handLagY || 0) + dPitch * 0.38) * Math.max(0, 1 - dt * 10.5);
    const lagX = Math.max(-0.085, Math.min(0.085, player._handLagX));
    const lagY = Math.max(-0.075, Math.min(0.075, player._handLagY));

    player._fpSprintB = (player._fpSprintB || 0) + ((sprinting && len > 0.1 ? 1 : 0) - (player._fpSprintB || 0)) * Math.min(1, dt * 8.5);
    const fpSp = player._fpSprintB;
    const idleBreathX = Math.cos(elapsed * 1.45) * 0.009;
    const idleBreathY = Math.sin(elapsed * 2.9) * 0.013;
    const moveOn = (len > 0.1 && !player.flying) ? 1 : 0;
    const swayX = moveOn * Math.cos(player.walkBob * 0.5) * (0.018 + fpSp * 0.024);
    const fig8Y = moveOn * Math.abs(Math.sin(player.walkBob * 0.5)) * (-0.016 - fpSp * 0.022);
    player._fpSwimB = (player._fpSwimB || 0) + (((player.deepWater && !player.flying) ? 1 : 0) - (player._fpSwimB || 0)) * Math.min(1, dt * 8.0);
    const fpSw = player._fpSwimB * (swing > 0.01 || player.swordAtkActive ? 0.25 : 1.0);
    if (player.inWater) player._fpSwimPhase = ((player._fpSwimPhase || 0) + dt * (sprinting ? 5.2 : 3.8)) % (Math.PI * 2048);
    const swStrokeP = player._fpSwimPhase || 0;
    const swimSwayX = player.inWater ? Math.sin(swStrokeP) * (0.028 + fpSw * 0.042 * moveOn) : 0;
    const swimSwayY = player.inWater ? Math.cos(swStrokeP) * (0.022 + fpSw * 0.030 * moveOn) : 0;
    const swimStrokeZ = -fpSw * moveOn * Math.max(0, Math.sin(swStrokeP)) * 0.055;
    const swimStrokeRx = -fpSw * moveOn * (0.18 + Math.sin(swStrokeP) * 0.16);
    const swimStrokeRz = fpSw * moveOn * Math.cos(swStrokeP) * 0.14;
    const sneakDip = (player.sneakEyeOff || 0) * 0.18;
    const landDip = -(player.landSquash || 0) * 0.115;
    const airDip = !player.onGround && !player.inWater ? Math.max(-0.085, Math.min(0.075, -player.vy * 0.0085)) : 0;
    // Smooth snappy weapon equip flourish when switching hotbar items
    const eqPop = player.equipPopT || 0;
    const eqEase = eqPop * eqPop * eqPop;
    const eqArc = Math.sin(eqPop * Math.PI);
    const eqY = -eqEase * 0.20 + eqArc * 0.018;
    const eqZ = eqEase * 0.05;
    const eqRx = -eqEase * 0.28 + eqArc * 0.04;
    const eqRy = -eqEase * 0.16;
    const eqRz = -eqEase * 0.10;

    // Authentic Afterswing [Ja+] 1P Keyframed Multi-Directional Swing & Follow-Through Curves
    function _sampleAfterswingKeys(u, keys) {
      let a = keys[0], b = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (u >= keys[i][0] && u <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
      }
      const span = b[0] - a[0];
      const f = span > 1e-4 ? smoothstep01((u - a[0]) / span) : 0;
      return [
        a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f,
        a[4] + (b[4] - a[4]) * f, a[5] + (b[5] - a[5]) * f, a[6] + (b[6] - a[6]) * f
      ];
    }
    const _AS_SWORD_KEYS = [
      [[0,0,0,0,0,0,0],[0.09,0.06,0.03,0.04,0.16,-0.34,-0.24],[0.26,-0.72,-0.15,-0.26,-1.18,1.28,1.12],[0.50,-0.56,-0.16,-0.19,-1.04,1.06,0.88],[1,0,0,0,0,0,0]],
      [[0,0,0,0,0,0,0],[0.09,-0.46,-0.14,-0.18,-0.86,0.92,0.68],[0.28,0.18,0.08,-0.22,-0.62,-0.88,-0.78],[0.52,0.12,-0.04,-0.16,-0.48,-0.68,-0.56],[1,0,0,0,0,0,0]],
      [[0,0,0,0,0,0,0],[0.09,0.04,0.18,0.06,0.36,-0.20,-0.22],[0.28,-0.34,-0.22,-0.26,-1.24,0.46,0.48],[0.50,-0.24,-0.16,-0.18,-0.96,0.34,0.34],[1,0,0,0,0,0,0]]
    ];
    let swX = 0, swY = 0, swZ = 0, swRx = 0, swRy = 0, swRz = 0;
    if (swingActive && swing > 0.002) {
      let kv = null;
      if (heldToolKind === 'sword') {
        kv = _AS_SWORD_KEYS[(player.comboStep || 0) % 3];
      } else if (B.TRIDENT && heldDef && heldDef.id === B.TRIDENT) {
        kv = ((player.swingStep || 0) & 1)
          ? [[0,0,0,0,0,0,0],[0.10,0.06,0.14,0.05,0.28,-0.22,-0.22],[0.30,-0.36,-0.20,-0.32,-1.56,0.50,0.50],[0.52,-0.24,-0.14,-0.20,-1.18,0.38,0.36],[1,0,0,0,0,0,0]]
          : _AS_SWORD_KEYS[0];
      } else if (heldToolKind === 'pick' || heldToolKind === 'axe') {
        kv = [[0,0,0,0,0,0,0],[0.10,0.02,0.16,0.06,0.36,0.10,-0.14],[0.30,-0.26,-0.22,-0.34,-1.54,0.32,0.22],[0.54,-0.18,-0.12,-0.22,-1.12,0.22,0.14],[1,0,0,0,0,0,0]];
      } else if (heldToolKind === 'shovel') {
        kv = [[0,0,0,0,0,0,0],[0.10,-0.02,-0.06,0.06,0.20,-0.10,0.06],[0.32,-0.26,0.08,-0.36,-1.22,0.28,0.22],[0.54,-0.18,0.02,-0.24,-0.88,0.20,0.14],[1,0,0,0,0,0,0]];
      } else if (heldToolKind === 'hoe') {
        kv = [[0,0,0,0,0,0,0],[0.10,0.02,0.12,0.04,0.26,-0.16,-0.14],[0.30,-0.32,-0.18,-0.34,-1.48,0.44,0.36],[0.52,-0.22,-0.12,-0.24,-1.10,0.32,0.24],[1,0,0,0,0,0,0]];
      } else if (!heldDef) {
        kv = [[0,0,0,0,0,0,0],[0.26,-0.26,0.04,-0.36,-0.78,0.42,0.26],[0.48,-0.18,0.02,-0.24,-0.54,0.30,0.18],[1,0,0,0,0,0,0]];
      } else {
        kv = [[0,0,0,0,0,0,0],[0.30,-0.22,-0.08,-0.24,-1.12,0.42,0.20],[0.50,-0.15,-0.05,-0.16,-0.78,0.28,0.14],[1,0,0,0,0,0,0]];
      }
      [swX, swY, swZ, swRx, swRy, swRz] = _sampleAfterswingKeys(swingU, kv);
    }

    // Afterswing+ Sprint Carry (angles tool dynamically across view & pumps with stride!)
    const spX = -fpSp * 0.065;
    const spY = -fpSp * 0.030;
    const spZ = fpSp * 0.028;
    const spRx = -fpSp * 0.24 - (player.landSquash || 0) * 0.18;
    const spRy = fpSp * 0.28;
    const spRz = fpSp * 0.20 + (player.sneaking ? 0.14 : 0);

    const cdDip = 0;

    updateEatingState(dt);
    const eatChomp = eatState.active ? Math.sin(eatState.timer * 28.0) * 0.032 : 0;
    const eatX = eatState.active ? -0.18 : 0;
    const eatY = eatState.active ? 0.13 + eatChomp : 0;
    const eatZ = eatState.active ? 0.14 : 0;
    const eatRx = eatState.active ? 0.25 + eatChomp * 4.5 : 0;
    const eatRy = eatState.active ? 0.42 : 0;

    const shHand = (typeof getActiveShieldHand === 'function') ? getActiveShieldHand() : null;
    const bT = player.shieldRaiseT || 0;
    const disDip = ((player.shieldDisableT || 0) > 0) ? -0.26 : 0;
    const impZ = (player.shieldImpactT || 0) * 0.08;
    const mainIsShield = (heldSel && heldSel.count > 0 && heldSel.id === B.SHIELD);
    const _vmX = Math.min(1.0, Math.max(0.37, (camera.aspect || 1.6) / 1.25));
    const _vmZAdd = _vmX < 0.85 ? -0.08 * (1 - _vmX) : 0;
    if (mainIsShield && shHand === 'mainhand') {
      const mIdleX = 0.45 * _vmX + idleBreathX + swayX * 0.6 + lagX * 0.6, mIdleY = -0.49 + fig8Y * 0.6 + idleBreathY + landDip + disDip + lagY * 0.6, mIdleZ = -0.58 + _vmZAdd;
      const mBlkX = 0.14 * _vmX + idleBreathX * 0.20 + lagX * 0.20, mBlkY = -0.13 + idleBreathY * 0.22 + landDip * 0.35 + lagY * 0.20, mBlkZ = -0.44 + _vmZAdd + impZ;
      heldPivot.position.set(
        mIdleX + (mBlkX - mIdleX) * bT + swX * 0.35,
        mIdleY + (mBlkY - mIdleY) * bT + swY * 0.35,
        mIdleZ + (mBlkZ - mIdleZ) * bT
      );
      heldPivot.rotation.set(
        (0.05 + lagY * 0.9) * (1 - bT) + (0.04 + swRx * 0.2) * bT,
        (-0.36 - lagX * 1.1) * (1 - bT) + (-0.08) * bT,
        (0.05 - lagX * 0.6) * (1 - bT) + (-0.06) * bT
      );
    } else {
      // Afterswing [Ja+] Upright Heroic Idle Rest Poses (matching @lalynmc screenshots)
      const isMeleeGrip = (heldToolKind === 'sword' || heldToolKind === 'pick' || heldToolKind === 'axe' || heldToolKind === 'shovel' || heldToolKind === 'hoe' || (B.TRIDENT && heldDef && heldDef.id === B.TRIDENT));
      let idleOffX = 0, idleOffY = 0, idleOffZ = 0, idleRx = 0, idleRy = 0, idleRz = 0;
      if (heldToolKind === 'sword') {
        idleOffX = -0.05; idleOffY = 0.04; idleOffZ = 0.06;
        idleRx = 0.04; idleRy = 0.08; idleRz = -0.04;
      } else if (heldToolKind === 'pick' || heldToolKind === 'axe') {
        idleOffX = -0.04; idleOffY = 0.05; idleOffZ = 0.06;
        idleRx = 0.02; idleRy = 0.04; idleRz = -0.03;
      } else if (heldToolKind === 'shovel' || (B.TRIDENT && heldDef && heldDef.id === B.TRIDENT)) {
        idleOffX = -0.04; idleOffY = 0.06; idleOffZ = 0.06;
        idleRx = 0.02; idleRy = 0.04; idleRz = -0.02;
      } else if (heldToolKind === 'hoe') {
        idleOffX = -0.04; idleOffY = 0.05; idleOffZ = 0.06;
        idleRx = 0.02; idleRy = 0.05; idleRz = 0.02;
      } else if (heldToolKind === 'bow') {
        if (player.bowDrawing) {
          const bowC = Math.max(0.05, Math.min(1, player.bowCharge || 0.1));
          const tremor = bowC >= 0.98 ? Math.sin(elapsed * 42.0) * 0.004 : 0;
          idleOffX = -0.16 * bowC + tremor; idleOffY = 0.08 * bowC + tremor * 0.7; idleOffZ = 0.05 * bowC;
          idleRx = 0.08 * bowC; idleRy = 0.36 * bowC; idleRz = -0.22 * bowC;
        }
      } else if (!heldDef) {
        idleOffX = -0.03; idleOffY = -0.02; idleOffZ = 0.02;
      }
      heldPivot.position.set(
        (isMeleeGrip ? 0.42 : 0.46) * _vmX + idleBreathX + swayX + swimSwayX + lagX + spX + swX + eatX + idleOffX,
        (isMeleeGrip ? -0.35 : -0.37) + fig8Y + idleBreathY + swimSwayY + sneakDip + airDip + landDip + cdDip + eqY + lagY + spY + swY + eatY + idleOffY,
        -0.61 + _vmZAdd + eqZ + spZ + swZ + eatZ + swimStrokeZ + idleOffZ
      );
      heldPivot.rotation.set(
        swRx + spRx + eqRx + lagY * 1.7 + (airDip * 1.1) + eatRx + swimStrokeRx + idleRx,
        swRy + spRy + eqRy + swayX * 2.1 - lagX * 2.2 + eatRy + idleRy,
        swRz + spRz + eqRz + swayX * 1.4 - lagX * 0.9 + swimStrokeRz + idleRz
      );
      if (heldSel && (heldSel.id === B.LANTERN || heldSel.id === B.SOUL_LANTERN) && typeof activeHeldObj !== 'undefined' && activeHeldObj) {
        const lPiv = activeHeldObj.getObjectByName('lanternSwingPivot');
        if (lPiv) {
          if (!player._fpMainLanternSw) player._fpMainLanternSw = { rx: 0, rz: 0, vx: 0, vz: 0 };
          const tgtX = Math.sin(elapsed * 2.25) * 0.055 + moveOn * (0.10 + fpSp * 0.14) + lagY * 2.6 + airDip * 2.2 - (player.landSquash || 0) * 0.45 - swRx * 0.32;
          const tgtZ = Math.cos(elapsed * 1.80) * 0.045 + moveOn * Math.sin(player.walkBob * 0.5) * (0.14 + fpSp * 0.14) - lagX * 3.8 + swRz * 0.32;
          const s = _stepLanternPendulum(player._fpMainLanternSw, tgtX, tgtZ, dt);
          lPiv.rotation.set(s.rx, 0, s.rz);
        }
      }
    }
    if (offhandPivot) {
      if (thirdPerson > 0 || hudHidden) offhandPivot.visible = false;
      else if (offhandPivot.visible) {
      if (player.equip.offhand === B.SHIELD) {
        const oIdleX = -0.45 * _vmX - idleBreathX - swayX * 0.55 + lagX * 0.55;
        const oIdleY = -0.49 + fig8Y * 0.65 + idleBreathY + airDip * 0.6 + landDip + disDip + lagY * 0.65;
        const oIdleZ = -0.58 + _vmZAdd;
        const oBlkX = -0.14 * _vmX - idleBreathX * 0.20 + lagX * 0.20;
        const oBlkY = -0.13 + idleBreathY * 0.22 + landDip * 0.35 + lagY * 0.20;
        const oBlkZ = -0.44 + _vmZAdd + impZ;
        offhandPivot.position.set(
          oIdleX + (oBlkX - oIdleX) * bT,
          oIdleY + (oBlkY - oIdleY) * bT,
          oIdleZ + (oBlkZ - oIdleZ) * bT
        );
        offhandPivot.rotation.set(
          (0.05 + lagY * 0.9) * (1 - bT) + 0.04 * bT,
          (0.36 - swayX * 1.1 - lagX * 1.1) * (1 - bT) + 0.08 * bT,
          (-0.05 - swayX * 0.7 - lagX * 0.5) * (1 - bT) + 0.06 * bT
        );
      } else {
        offhandPivot.position.set(
          -0.46 * _vmX - idleBreathX - swayX * 0.7 + lagX * 0.7,
          -0.36 + fig8Y * 0.8 + idleBreathY + sneakDip + airDip * 0.8 + landDip + lagY * 0.8,
          -0.62 + _vmZAdd
        );
        offhandPivot.rotation.set(
          lagY * 1.1 + airDip * 0.8,
          -swayX * 1.4 - lagX * 1.3,
          -swayX * 0.9 - lagX * 0.6
        );
        if ((player.equip.offhand === B.LANTERN || player.equip.offhand === B.SOUL_LANTERN) && typeof activeOffhandObj !== 'undefined' && activeOffhandObj) {
          const oPiv = activeOffhandObj.getObjectByName('lanternSwingPivot');
          if (oPiv) {
            if (!player._fpOffLanternSw) player._fpOffLanternSw = { rx: 0, rz: 0, vx: 0, vz: 0 };
            const tgtX = Math.sin(elapsed * 2.25 + 1.0) * 0.055 + moveOn * (0.10 + fpSp * 0.14) + lagY * 2.6 + airDip * 2.2 - (player.landSquash || 0) * 0.45;
            const tgtZ = Math.cos(elapsed * 1.80 + 0.8) * 0.045 - moveOn * Math.sin(player.walkBob * 0.5) * (0.14 + fpSp * 0.14) - lagX * 3.8;
            const s = _stepLanternPendulum(player._fpOffLanternSw, tgtX, tgtZ, dt);
            oPiv.rotation.set(s.rx, 0, s.rz);
          }
        }
      }
      }
    }
  }
