// NUCRAFT Module: src/entities/RemotePlayer.js — Remote peer interpolation, locator bar & AI Co-op buddy

  function applyRemotePeerState(rp, st, equip) {
    if (!rp || !st) return;
    rp.dim = st.dim || rp.dim || 'overworld';
    rp.depthOffset = typeof st.depthOffset === 'number' ? st.depthOffset : (rp.depthOffset || 0);
    const localOff = depthOffset || 0;
    const hasTy = (typeof st.trueY === 'number' && Number.isFinite(st.trueY));
    const worldY = hasTy ? (st.trueY + localOff) : st.y;
    const nowNet = performance.now();
    rp.trueY = hasTy ? st.trueY : undefined;
    if (!rp._netBuf) rp._netBuf = createNetInterp(85);
    const yawIn = (typeof st.yaw === 'number' && Number.isFinite(st.yaw)) ? st.yaw : (rp.yaw || 0);
    const pitchIn = (typeof st.pitch === 'number' && Number.isFinite(st.pitch)) ? st.pitch : (rp.pitch || 0);
    const hasSeq = (typeof st.seq === 'number');
    const accepted = pushNetSnap(rp._netBuf, {
      seq: st.seq,
      ts: st.ts,
      x: st.x,
      y: worldY,
      ty: rp.trueY,
      z: st.z,
      vx: (typeof st.vx === 'number') ? st.vx : (hasSeq ? 0 : undefined),
      vy: (typeof st.vy === 'number') ? st.vy : (hasSeq ? 0 : undefined),
      vz: (typeof st.vz === 'number') ? st.vz : (hasSeq ? 0 : undefined),
      yaw: yawIn,
      pitch: pitchIn,
      spd: st.speed || 0
    }, nowNet, localOff);
    if (!accepted) return;

    rp._lastPktAt = nowNet;
    rp.tx = st.x; rp.ty = worldY; rp.tz = st.z;
    rp.tYaw = yawIn; rp.tPitch = pitchIn;
    rp.vy = typeof st.vy === 'number' ? st.vy : 0;
    if (!rp._hasNetState) {
      rp._hasNetState = true;
      rp.x = st.x; rp.y = worldY; rp.z = st.z;
      rp.yaw = yawIn; rp.pitch = pitchIn;
      rp._netBuf.lastOutX = rp.x;
      rp._netBuf.lastOutY = rp.y;
      rp._netBuf.lastOutZ = rp.z;
      rp._netBuf.hasOut = true;
    }
    rp.speed = st.speed || 0;
    rp.sprinting = !!st.sprinting; rp.sneaking = !!st.sneaking;
    rp.inWater = !!st.inWater; rp.deepWater = !!st.deepWater; rp.swimMoving = !!st.swimMoving;
    rp.sprintSwimming = !!st.sprintSwimming; rp.lowSprintSwim = !!st.lowSprintSwim;
    rp.onGround = (st.onGround !== false && st.onGround !== 0); rp.flying = !!st.flying; rp.gliding = !!st.gliding; rp.swing = st.swing || 0;
    rp.swingActive = !!st.swingActive; rp.swingU = st.swingU || 0;
    rp.bowDrawing = !!st.bowDrawing; rp.bowCharge = st.bowCharge || 0; rp.bowStage = st.bowStage || 0;
    rp.actionType = st.actionType || rp.actionType || 'attack';
    rp.burning = !!st.burning; rp.burnSoul = !!st.burnSoul;
    if (st.swSeq) { rp.swordAtkSeq = st.swSeq; rp.swordAtkHit = st.swHit || 1; } else if (!rp.swing) rp.swordAtkSeq = 0;
    if (equip) {
      const eqSig = `${equip.helmet||0}_${equip.chest||0}_${equip.legs||0}_${equip.boots||0}_${equip.offhand||0}`;
      if (eqSig !== rp._eqSig) { rp._eqSig = eqSig; applyArmorToPlayerRig(rp.rig, equip); }
    }
    const heldMeta = rp.bowDrawing && rp.bowStage > 0 ? { bowStage: rp.bowStage } : null;
    const heldKeyNet = st.held !== undefined ? `${st.held}:${rp.bowStage}` : '';
    if (st.held !== undefined && heldKeyNet !== rp._heldNetKey) {
      rp._heldId = st.held; rp._heldNetKey = heldKeyNet;
      setRigHeldItem(rp.rig, st.held, heldMeta);
    }
  }


  function _setBuddyHeld(rp, itemId, meta = null) {
    if (!rp || !rp.rig) return;
    const key = `${itemId || 0}:${meta && meta.ench ? 1 : 0}`;
    if (rp._heldId === itemId && rp._heldNetKey === key) return;
    rp._heldId = itemId;
    rp._heldNetKey = key;
    if (typeof setRigHeldItem === 'function') setRigHeldItem(rp.rig, itemId, meta || null);
  }
  function _buddyIsHazard(bx, by, bz) {
    const b0 = getBlockWorld(bx, by, bz);
    if (b0 === B.LAVA || b0 === B.FIRE || b0 === B.CACTUS || b0 === B.MAGMA_BLOCK || (B.SWEET_BERRY_BUSH && b0 === B.SWEET_BERRY_BUSH)) return true;
    const b1 = getBlockWorld(bx, by - 1, bz);
    return (b1 === B.LAVA || b1 === B.FIRE || b1 === B.MAGMA_BLOCK);
  }
  function _buddyCanStandAt(bx, by, bz) {
    return !isSolidAt(bx, by, bz) && !isSolidAt(bx, by + 1, bz) && !_buddyIsHazard(bx, by, bz);
  }
  function _buddyFloorNear(x, y, z) {
    const bx = Math.floor(x), bz = Math.floor(z), by = Math.floor(y);
    for (let yy = by + 1; yy >= by - 5; yy--) {
      if (isSolidAt(bx, yy, bz) && !isSolidAt(bx, yy + 1, bz) && !isSolidAt(bx, yy + 2, bz)) return yy + 1.0;
    }
    return null;
  }
  function _buddyFindSafeSpotNearPlayer() {
    const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
    for (let r = 2; r <= 5; r++) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const tx = px + Math.round(Math.cos(ang) * r), tz = pz + Math.round(Math.sin(ang) * r);
        for (let dy = 2; dy >= -3; dy--) {
          const ty = py + dy;
          if (isSolidAt(tx, ty - 1, tz) && _buddyCanStandAt(tx, ty, tz)) {
            return { x: tx + 0.5, y: ty, z: tz + 0.5 };
          }
        }
      }
    }
    return { x: player.x - Math.sin(player.yaw) * 2.5, y: player.y + 0.2, z: player.z - Math.cos(player.yaw) * 2.5 };
  }
  function _buddyIsBuildableBlock(id) {
    const def = id ? BLOCK_DEF[id] : null;
    if (!def || !def.solid || def.itemOnly || def.tool || def.armorSlot) return false;
    if (def.chest || def.door || def.trapdoor || def.oreBlock || def.interactive || def.cross || def.isSapling || def.slab || def.stairs || def.fence || def.wall) return false;
    if (id === B.TNT || id === B.CACTUS || id === B.MAGMA_BLOCK || id === B.BEDROCK) return false;
    return true;
  }
  function _buddyThrowItemToPlayer(rp, id, count = 1, meta = null) {
    if (!id || count <= 0 || typeof spawnDroppedItem !== 'function') return;
    const dx = player.x - rp.x, dy = (player.y + 1.1) - (rp.y + 1.35), dz = player.z - rp.z;
    const dXZ = Math.max(0.25, Math.hypot(dx, dz));
    const spd = Math.min(7.2, Math.max(3.4, dXZ * 1.35));
    const sx = rp.x + (dx / dXZ) * 0.45, sy = rp.y + 1.35, sz = rp.z + (dz / dXZ) * 0.45;
    spawnDroppedItem(sx, sy, sz, id, {
      exactPos: true,
      thrown: true,
      thrownByBuddy: true,
      count,
      dur: meta && typeof meta.dur === 'number' ? meta.dur : undefined,
      maxDur: meta && meta.maxDur ? meta.maxDur : undefined,
      ench: !!(meta && meta.ench),
      trim: meta && meta.trim ? { ...meta.trim } : null,
      vx: (dx / dXZ) * spd,
      vy: Math.max(2.1, Math.min(4.8, 2.3 + dy * 0.45)),
      vz: (dz / dXZ) * spd,
      pickupDelay: 0.20
    });
    rp.swing = 0.85;
    rp.swingActive = true;
    rp.actionType = 'attack';
    if (typeof playSfx === 'function') playSfx('place');
  }
  function _buddyAddToStackList(list, id, count) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].count += count; return; }
    }
    list.push({ id, count });
  }
  function _buddyPeekBlock(rp) {
    if (!rp._buddyBlocks) return null;
    for (let i = 0; i < rp._buddyBlocks.length; i++) {
      if (rp._buddyBlocks[i].count > 0 && _buddyIsBuildableBlock(rp._buddyBlocks[i].id)) return rp._buddyBlocks[i];
    }
    return null;
  }
  function _buddyConsumeBlock(rp, stack) {
    if (!stack || stack.count <= 0) return;
    stack.count--;
    if (stack.count <= 0 && rp._buddyBlocks) {
      const idx = rp._buddyBlocks.indexOf(stack);
      if (idx >= 0) rp._buddyBlocks.splice(idx, 1);
    }
  }
  function _buddyWantsDrop(rp, it) {
    if (!it || !it.id || it.thrownByBuddy) return false;
    if (it.dim && it.dim !== currentDimension) return false;
    if (it.buddyMined) return (it.age || 0) >= 0.16;
    if (!it.thrownByPlayer) return false;
    if ((it.age || 0) < 0.22) return false;
    const def = BLOCK_DEF[it.id];
    if (!def) return false;
    return !!(def.armorSlot || def.tool || _buddyIsBuildableBlock(it.id));
  }
  function _buddyPickupDrop(rp, idx) {
    if (typeof droppedItems === 'undefined' || !Array.isArray(droppedItems) || idx < 0 || idx >= droppedItems.length) return false;
    const it = droppedItems[idx];
    if (!it || !it.id) return false;
    const def = BLOCK_DEF[it.id];
    if (!def) return false;
    const meta = { dur: it.dur || 0, maxDur: it.maxDur || 0, ench: !!it.ench, trim: it.trim ? { ...it.trim } : null };
    const qty = Math.max(1, it.count || 1);

    // Remove picked drop from world cleanly
    if (it.mesh && typeof scene !== 'undefined' && scene) scene.remove(it.mesh);
    if (it.shadow && typeof scene !== 'undefined' && scene) scene.remove(it.shadow);
    droppedItems.splice(idx, 1);
    if (it.dropId && typeof broadcastDropRemove === 'function') broadcastDropRemove(it.dropId);
    if (typeof playSfx === 'function') playSfx('pop');

    if (it.buddyMined) {
      _buddyAddToStackList(rp._buddyLoot, it.id, qty);
      return true;
    }
    if (def.armorSlot) {
      if (!rp.equip) rp.equip = { helmet: 0, chest: 0, legs: 0, boots: 0, offhand: 0 };
      if (!rp.equipMeta) rp.equipMeta = { helmet: null, chest: null, legs: null, boots: null, offhand: null };
      const slot = def.armorSlot;
      const oldId = rp.equip[slot];
      const oldMeta = rp.equipMeta[slot];
      rp.equip[slot] = it.id;
      rp.equipMeta[slot] = meta;
      if (typeof applyArmorToPlayerRig === 'function' && rp.rig) applyArmorToPlayerRig(rp.rig, rp.equip, rp.equipMeta);
      if (oldId && oldId !== it.id) _buddyThrowItemToPlayer(rp, oldId, 1, oldMeta);
      if (typeof showToast === 'function') showToast(`🤖 Alex đã nhặt và mặc ${def.name}!`);
      return true;
    }
    if (def.tool === 'sword') {
      const oldId = rp._buddyCustomSword ? rp._buddySwordId : 0;
      const oldMeta = rp._buddySwordMeta || null;
      rp._buddySwordId = it.id;
      rp._buddySwordMeta = meta;
      rp._buddyCustomSword = true;
      _setBuddyHeld(rp, it.id, meta);
      if (oldId && oldId !== it.id) _buddyThrowItemToPlayer(rp, oldId, 1, oldMeta);
      if (typeof showToast === 'function') showToast(`🤖 Alex đã trang bị ${def.name}!`);
      return true;
    }
    if (def.tool === 'pick') {
      const oldId = rp._buddyCustomPick ? rp._buddyPickId : 0;
      const oldMeta = rp._buddyPickMeta || null;
      rp._buddyPickId = it.id;
      rp._buddyPickMeta = meta;
      rp._buddyCustomPick = true;
      _setBuddyHeld(rp, it.id, meta);
      if (oldId && oldId !== it.id) _buddyThrowItemToPlayer(rp, oldId, 1, oldMeta);
      if (typeof showToast === 'function') showToast(`🤖 Alex đã trang bị ${def.name}!`);
      return true;
    }
    if (def.tool) {
      const oldId = rp._buddyExtraToolId || 0;
      const oldMeta = rp._buddyExtraToolMeta || null;
      rp._buddyExtraToolId = it.id;
      rp._buddyExtraToolMeta = meta;
      if ((def.dmg || 0) >= ((BLOCK_DEF[rp._buddySwordId]?.dmg) || 0)) {
        rp._buddySwordId = it.id;
        rp._buddySwordMeta = meta;
        rp._buddyCustomSword = true;
      }
      _setBuddyHeld(rp, it.id, meta);
      if (oldId && oldId !== it.id) _buddyThrowItemToPlayer(rp, oldId, 1, oldMeta);
      if (typeof showToast === 'function') showToast(`🤖 Alex đã nhặt công cụ ${def.name}!`);
      return true;
    }
    if (_buddyIsBuildableBlock(it.id)) {
      _buddyAddToStackList(rp._buddyBlocks, it.id, qty);
      _setBuddyHeld(rp, it.id, null);
      rp._showBlkHoldT = 1.2;
      if (typeof showToast === 'function') showToast(`🤖 Alex đã nhặt ${qty}× ${def.name} để đặt leo/xây cầu!`);
      return true;
    }
    _buddyAddToStackList(rp._buddyLoot, it.id, qty);
    return true;
  }
  function _buddyFindDesiredDrop(rp) {
    if (typeof droppedItems === 'undefined' || !Array.isArray(droppedItems) || !droppedItems.length) return -1;
    let bestIdx = -1, bestD2 = 1e9;
    for (let i = 0; i < droppedItems.length; i++) {
      const it = droppedItems[i];
      if (!_buddyWantsDrop(rp, it)) continue;
      const dx = it.x - rp.x, dy = it.y - rp.y, dz = it.z - rp.z;
      if (Math.abs(dy) > 5.5) continue;
      const d2 = dx * dx + dz * dz;
      const maxR2 = it.buddyMined ? 49 : 100; // 7m for mined ores, 10m for player-thrown gifts
      if (d2 <= maxR2 && d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    return bestIdx;
  }
  function _buddyFindHostileTarget(rp) {
    if (typeof mobs === 'undefined' || !Array.isArray(mobs) || !mobs.length) return null;
    let best = null, bestScore = 1e9;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m || m._dead || m.hp <= 0 || m.tamed) continue;
      const st = (typeof MOB_STATS !== 'undefined' && MOB_STATS[m.type]) ? MOB_STATS[m.type] : null;
      if (st && st.villager) continue;
      const isHostile = !!(st && st.hostile) || m.state === 'chase' || (m.aggro || 0) > 0;
      if (!isHostile) continue;
      if (Math.abs(m.y - rp.y) > 7.5 && Math.abs(m.y - player.y) > 7.5) continue;
      const dP = Math.hypot(m.x - player.x, m.z - player.z);
      const dB = Math.hypot(m.x - rp.x, m.z - rp.z);
      if (dP > 15.0 && dB > 12.5) continue;
      const score = dP * 0.72 + dB * 0.48 - ((m.state === 'chase') ? 2.5 : 0);
      if (score < bestScore) { bestScore = score; best = m; }
    }
    return best;
  }
  function _buddyIsOreExposed(bx, by, bz) {
    return !isSolidAt(bx + 1, by, bz) || !isSolidAt(bx - 1, by, bz)
      || !isSolidAt(bx, by + 1, bz) || !isSolidAt(bx, by - 1, bz)
      || !isSolidAt(bx, by, bz + 1) || !isSolidAt(bx, by, bz - 1);
  }
  function _buddyFindNearbyOre(rp, nowSec) {
    const cx = Math.floor(rp.x), cy = Math.floor(rp.y), cz = Math.floor(rp.z);
    const skip = rp._skipOres;
    let best = null, bestD2 = 1e9;
    const rad = 7;
    for (let dy = -2; dy <= 3; dy++) {
      const wy = cy + dy;
      if (wy <= MIN_Y + 1 || wy >= MAX_Y - 1) continue;
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const d2 = dx * dx + dz * dz + dy * dy * 1.6;
          if (d2 >= bestD2 || d2 > rad * rad + 4) continue;
          const wx = cx + dx, wz = cz + dz;
          const bid = getBlockWorld(wx, wy, wz);
          const def = bid ? BLOCK_DEF[bid] : null;
          if (!def || !def.oreBlock) continue;
          const key = `${wx},${wy},${wz}`;
          if (skip && (skip.get(key) || 0) > nowSec) continue;
          if (!_buddyIsOreExposed(wx, wy, wz)) continue;
          bestD2 = d2;
          best = { x: wx, y: wy, z: wz, id: bid };
        }
      }
    }
    return best;
  }
  function _buddyPickMoveYaw(rp, targetX, targetY, targetZ, dt) {
    const wantYaw = Math.atan2(-(targetX - rp.x), -(targetZ - rp.z));
    const curBy = Math.floor(rp.y + 0.15);
    const hasBlocks = !!_buddyPeekBlock(rp);
    const evalDir = (ang) => {
      const sx = -Math.sin(ang), sz = -Math.cos(ang);
      const f1x = Math.floor(rp.x + sx * 0.78), f1z = Math.floor(rp.z + sz * 0.78);
      const f2x = Math.floor(rp.x + sx * 1.55), f2z = Math.floor(rp.z + sz * 1.55);
      if (_buddyIsHazard(f1x, curBy, f1z) || _buddyIsHazard(f2x, curBy, f2z)) return -100;
      const bAhead = getBlockWorld(f1x, curBy, f1z);
      const bAheadBelow = getBlockWorld(f1x, curBy - 1, f1z);
      const isWaterAhead = (bAhead === B.WATER || bAheadBelow === B.WATER);
      const blockedFeet = isSolidAt(f1x, curBy, f1z);
      const blockedHead = isSolidAt(f1x, curBy + 1, f1z);
      if (!blockedFeet && !blockedHead) {
        if (isWaterAhead || rp.inWater) return 9; // Alex swims freely across rivers & oceans!
        const dropSafe = isSolidAt(f1x, curBy - 1, f1z) || isSolidAt(f1x, curBy - 2, f1z) || isSolidAt(f1x, curBy - 3, f1z) || isSolidAt(f1x, curBy - 4, f1z);
        const step2Clear = !isSolidAt(f2x, curBy, f2z) && !isSolidAt(f2x, curBy + 1, f2z);
        // 1-block gap jumpable if landing on solid ground 2 blocks ahead!
        if (!dropSafe && isSolidAt(f2x, curBy - 1, f2z) && !isSolidAt(f2x, curBy, f2z)) return 7;
        return (dropSafe ? 10 : (hasBlocks ? 5 : -12)) + (step2Clear ? 4 : 0);
      }
      // 1-block jumpable step up!
      if (blockedFeet && !isSolidAt(f1x, curBy + 1, f1z) && !isSolidAt(f1x, curBy + 2, f1z) && !isSolidAt(Math.floor(rp.x), curBy + 2, Math.floor(rp.z))) {
        return 7;
      }
      return -50; // Tall unjumpable wall (2+ blocks)
    };

    const directScore = evalDir(wantYaw);
    if (rp._detourT > 0) {
      rp._detourT -= dt;
      if (directScore >= 9 && rp._detourT < 0.35) { rp._detourT = 0; return { yaw: wantYaw, jump: false, needClimb: false, needBridge: false }; }
      const detScore = evalDir(rp._detourYaw);
      if (detScore >= 6) return { yaw: rp._detourYaw, jump: detScore === 7, needClimb: false, needBridge: false };
      rp._detourT = 0;
    }
    if (directScore >= 9) return { yaw: wantYaw, jump: false, needClimb: false, needBridge: false };
    if (directScore === 7) return { yaw: wantYaw, jump: true, needClimb: false, needBridge: false };
    if (directScore === 5 && hasBlocks) return { yaw: wantYaw, jump: false, needClimb: false, needBridge: true };

    // When directly facing an unjumpable tall wall and target is higher above us, pillar straight up cleanly if we have blocks!
    const wantHigher = (targetY !== null && targetY >= curBy + 1.5);
    if (hasBlocks && directScore <= -40 && wantHigher) {
      rp._detourT = 0;
      return { yaw: wantYaw, jump: false, needClimb: true, needBridge: false };
    }

    // Otherwise probe side detour angles to walk smoothly around unjumpable walls/trees/hazards!
    const s = rp._detourSign || 1;
    const offsets = [0.78 * s, -0.78 * s, 1.48 * s, -1.48 * s, 2.25 * s, -2.25 * s];
    let bestYaw = wantYaw, bestSc = directScore, chosenSign = s;
    for (let i = 0; i < offsets.length; i++) {
      const cand = wantYaw + offsets[i];
      const sc = evalDir(cand);
      if (sc > bestSc) {
        bestSc = sc;
        bestYaw = cand;
        chosenSign = offsets[i] >= 0 ? 1 : -1;
        if (sc >= 14) break;
      }
    }
    if (hasBlocks && bestSc < 6) {
      return { yaw: wantYaw, jump: false, needClimb: true, needBridge: false };
    }
    rp._detourSign = chosenSign;
    rp._detourYaw = bestYaw;
    rp._detourT = 0.62;
    return { yaw: bestYaw, jump: bestSc === 7, needClimb: false, needBridge: false };
  }
  function _buddyTryPlaceClimbBlock(rp) {
    if ((rp._placeCd || 0) > 0 || !rp.onGround) return false;
    const stack = _buddyPeekBlock(rp);
    if (!stack) return false;
    const bx = Math.floor(rp.x), by = Math.floor(rp.y + 0.12), bz = Math.floor(rp.z);
    // Need clear 2-block headroom above Alex to pillar up cleanly!
    if (isSolidAt(bx, by + 2, bz) || isSolidAt(bx, by + 3, bz)) return false;
    const curHere = getBlockWorld(bx, by, bz);
    if (curHere !== B.AIR && curHere !== B.WATER && !(BLOCK_DEF[curHere] && BLOCK_DEF[curHere].cross)) return false;
    // Jump up and place block directly beneath Alex's feet (Minecraft pillar-up!)
    _setBuddyHeld(rp, stack.id, null);
    rp._showBlkHoldT = 0.9;
    rp.x = bx + 0.5; rp.z = bz + 0.5;
    rp.y = by + 1.04;
    rp.vy = JUMP_VEL * 0.62;
    rp.onGround = false;
    setBlockWorld(bx, by, bz, stack.id, true);
    _buddyConsumeBlock(rp, stack);
    rp._placeCd = 0.42;
    rp.swing = 0.85;
    rp.swingActive = true;
    rp.actionType = 'mine';
    if (typeof playSfx === 'function') playSfx('place');
    return true;
  }
  function _buddyTryPlaceBridgeBlock(rp, yaw) {
    if ((rp._placeCd || 0) > 0) return false;
    const stack = _buddyPeekBlock(rp);
    if (!stack) return false;
    const fx = Math.floor(rp.x - Math.sin(yaw) * 0.92);
    const fz = Math.floor(rp.z - Math.cos(yaw) * 0.92);
    const fy = Math.floor(rp.y + 0.12) - 1;
    if (fy <= MIN_Y + 1 || isSolidAt(fx, fy, fz)) return false;
    _setBuddyHeld(rp, stack.id, null);
    rp._showBlkHoldT = 0.9;
    setBlockWorld(fx, fy, fz, stack.id, true);
    _buddyConsumeBlock(rp, stack);
    rp._placeCd = 0.36;
    rp.swing = 0.80;
    rp.swingActive = true;
    rp.actionType = 'mine';
    if (typeof playSfx === 'function') playSfx('place');
    return true;
  }
  function _updateCoopBuddyAI(rp, dt, nowSec) {
    if (rp.vy === undefined) rp.vy = 0;
    if (rp._scanT === undefined) rp._scanT = 0;
    if (rp._oreScanT === undefined) rp._oreScanT = 0;
    if (rp._atkCd === undefined) rp._atkCd = 0;
    if (rp._placeCd === undefined) rp._placeCd = 0;
    if (rp._stuckT === undefined) rp._stuckT = 0;
    if (rp._detourT === undefined) rp._detourT = 0;
    if (rp._detourSign === undefined) rp._detourSign = 1;
    if (!rp._skipOres) rp._skipOres = new Map();
    if (!rp._buddyBlocks) rp._buddyBlocks = [];
    if (!rp._buddyLoot) rp._buddyLoot = [];
    if (!rp.equip) rp.equip = { helmet: 0, chest: 0, legs: 0, boots: 0, offhand: 0 };
    if (!rp.equipMeta) rp.equipMeta = { helmet: null, chest: null, legs: null, boots: null, offhand: null };
    if (!rp._buddySwordId) rp._buddySwordId = B.DIAMOND_SWORD;
    if (!rp._buddyPickId) rp._buddyPickId = B.DIAMOND_PICK;

    if (rp._lastDim && rp._lastDim !== currentDimension) {
      const sp = _buddyFindSafeSpotNearPlayer();
      rp.x = sp.x; rp.y = sp.y; rp.z = sp.z; rp.vy = 0;
      rp._combatTarget = null; rp._oreTarget = null; rp._mineProg = 0; rp._detourT = 0; rp._stuckT = 0;
    }
    rp._lastDim = currentDimension;
    rp.dim = currentDimension;

    const safeDt = Math.min(0.05, Math.max(0.004, dt || 0.016));
    if (rp._atkCd > 0) rp._atkCd = Math.max(0, rp._atkCd - safeDt);
    if (rp._placeCd > 0) rp._placeCd = Math.max(0, rp._placeCd - safeDt);
    if (rp._showBlkHoldT > 0) rp._showBlkHoldT = Math.max(0, rp._showBlkHoldT - safeDt);
    if (rp.swing > 0) rp.swing = Math.max(0, rp.swing - safeDt * 3.4);
    rp.swingActive = false;

    const dxP = player.x - rp.x, dzP = player.z - rp.z, dyP = player.y - rp.y;
    const distP = Math.hypot(dxP, dzP);

    // Rescue teleport if Alex fell way behind (>38m) or trapped >5s without blocks
    if (distP > 38 || Math.abs(dyP) > 22 || (rp._stuckT > 5.0 && !_buddyPeekBlock(rp))) {
      const sp = _buddyFindSafeSpotNearPlayer();
      rp.x = sp.x; rp.y = sp.y; rp.z = sp.z; rp.vy = 0;
      rp._stuckT = 0; rp._detourT = 0; rp._oreTarget = null; rp._mineProg = 0;
    }

    // Immediate touch-range pickup of any player-thrown gear/blocks or buddy-mined ores within 1.85m!
    if (typeof droppedItems !== 'undefined' && Array.isArray(droppedItems) && droppedItems.length > 0) {
      for (let di = droppedItems.length - 1; di >= 0; di--) {
        const it = droppedItems[di];
        if (!_buddyWantsDrop(rp, it)) continue;
        if (Math.hypot(it.x - rp.x, it.z - rp.z) <= 1.85 && Math.abs(it.y - rp.y) <= 2.2) {
          _buddyPickupDrop(rp, di);
        }
      }
    }

    // 1) COMBAT PRIORITY: Defend & fight hostile mobs near player/buddy
    rp._scanT -= safeDt;
    if (rp._scanT <= 0 || (rp._combatTarget && (rp._combatTarget._dead || rp._combatTarget.hp <= 0))) {
      rp._scanT = 0.22;
      rp._combatTarget = (distP < 24) ? _buddyFindHostileTarget(rp) : null;
    }

    // 2) ITEM PICKUP PRIORITY: Walk over to pick up gear/blocks player threw or ores Alex just mined!
    const desiredDropIdx = (!rp._combatTarget && distP < 24) ? _buddyFindDesiredDrop(rp) : -1;

    // 3) ORE MINING PRIORITY: When safe, no drops waiting, and near player, locate & mine exposed ores!
    if (!rp._combatTarget && desiredDropIdx < 0 && rp._buddyLoot.length === 0 && distP <= 18 && Math.abs(dyP) <= 8) {
      if (rp._oreTarget) {
        const curB = getBlockWorld(rp._oreTarget.x, rp._oreTarget.y, rp._oreTarget.z);
        if (!curB || !BLOCK_DEF[curB] || !BLOCK_DEF[curB].oreBlock) {
          rp._oreTarget = null; rp._mineProg = 0; rp._oreChaseT = 0;
        }
      }
      rp._oreScanT -= safeDt;
      if (!rp._oreTarget && rp._oreScanT <= 0) {
        rp._oreScanT = 0.65;
        rp._oreTarget = _buddyFindNearbyOre(rp, nowSec);
        rp._mineProg = 0;
        rp._oreChaseT = 0;
      }
    } else if (rp._combatTarget || distP > 20) {
      rp._oreTarget = null;
      rp._mineProg = 0;
    }

    let moveTargetX = null, moveTargetY = null, moveTargetZ = null, wantSpeed = 0, wantSprint = false, lookYaw = rp.yaw || 0, lookPitch = 0;

    if (rp._combatTarget) {
      // Fight hostile mob using Alex's equipped sword (including player-gifted upgrades!)
      _setBuddyHeld(rp, rp._buddySwordId, rp._buddySwordMeta || null);
      const swDef = BLOCK_DEF[rp._buddySwordId];
      const swDmg = Math.max(5.5, (swDef && swDef.dmg) ? swDef.dmg : 7.0);
      const m = rp._combatTarget;
      const mdx = m.x - rp.x, mdy = (m.y + 0.7) - (rp.y + 1.4), mdz = m.z - rp.z;
      const mDistXZ = Math.hypot(mdx, mdz);
      const mDist3D = Math.hypot(mdx, mdy, mdz);
      lookYaw = Math.atan2(-mdx, -mdz);
      lookPitch = Math.max(-0.8, Math.min(0.8, Math.atan2(mdy, Math.max(0.2, mDistXZ))));
      if (mDistXZ > 1.85) {
        moveTargetX = m.x; moveTargetY = m.y; moveTargetZ = m.z;
        wantSpeed = mDistXZ > 4.5 ? 6.5 : 4.9;
        wantSprint = mDistXZ > 4.5;
      }
      if (mDist3D <= 2.75 && rp._atkCd <= 0 && typeof hurtMob === 'function') {
        rp._atkCd = 0.56;
        rp.swing = 1.0;
        rp.swingActive = true;
        rp.actionType = 'attack';
        rp.swordAtkSeq = (rp.swordAtkSeq || 0) + 1;
        rp.swordAtkHit = ((rp.swordAtkHit || 0) % 3) + 1;
        const inv = 1 / Math.max(0.1, mDistXZ);
        hurtMob(m, swDmg, mdx * inv * 6.5, mdz * inv * 6.5, 4.0, false, true);
        if (typeof playSfx === 'function') playSfx('hit');
      }
    } else if (desiredDropIdx >= 0) {
      // Run over to pick up player-thrown tools/armor/blocks OR freshly mined ore drops!
      const dit = droppedItems[desiredDropIdx];
      moveTargetX = dit.x; moveTargetY = dit.y; moveTargetZ = dit.z;
      const dd = Math.hypot(dit.x - rp.x, dit.z - rp.z);
      wantSpeed = dd > 4.0 ? 5.8 : 4.6;
      wantSprint = dd > 4.5;
      lookYaw = Math.atan2(-(dit.x - rp.x), -(dit.z - rp.z));
      if (dd <= 1.95 && Math.abs(dit.y - rp.y) <= 2.3) _buddyPickupDrop(rp, desiredDropIdx);
    } else if (rp._oreTarget) {
      // Walk to & mine exposed ore block with equipped Pickaxe!
      if (rp._showBlkHoldT <= 0) _setBuddyHeld(rp, rp._buddyPickId, rp._buddyPickMeta || null);
      const ot = rp._oreTarget;
      const ox = ot.x + 0.5, oy = ot.y + 0.5, oz = ot.z + 0.5;
      const odx = ox - rp.x, ody = oy - (rp.y + 1.45), odz = oz - rp.z;
      const oDistXZ = Math.hypot(odx, odz);
      const oDist3D = Math.hypot(odx, ody, odz);
      lookYaw = Math.atan2(-odx, -odz);
      lookPitch = Math.max(-1.05, Math.min(1.05, Math.atan2(ody, Math.max(0.2, oDistXZ))));
      if (oDist3D > 3.15) {
        moveTargetX = ox; moveTargetY = oy; moveTargetZ = oz;
        wantSpeed = 4.8;
        rp._oreChaseT = (rp._oreChaseT || 0) + safeDt;
        if (rp._oreChaseT > 4.5) {
          rp._skipOres.set(`${ot.x},${ot.y},${ot.z}`, nowSec + 15);
          rp._oreTarget = null; rp._mineProg = 0; rp._oreChaseT = 0;
        }
      } else {
        rp.swingActive = true;
        rp.actionType = 'mine';
        rp.swing = 0.85;
        rp.swingU = ((rp.swingU || 0) + safeDt * 3.8) % 1.0;
        rp.swordAtkSeq = 0;
        rp._mineProg = (rp._mineProg || 0) + safeDt;
        rp._mineFxT = (rp._mineFxT || 0) + safeDt;
        const oreDef = BLOCK_DEF[ot.id];
        const pickDef = BLOCK_DEF[rp._buddyPickId];
        const speedMul = Math.max(1.0, Math.min(3.0, ((pickDef && pickDef.mineMul) || 8.0) / 8.0));
        if (rp._mineFxT >= 0.22) {
          rp._mineFxT = 0;
          const colHex = oreDef && oreDef.mapColor ? parseInt(oreDef.mapColor.replace('#', ''), 16) : 0x94a3b8;
          if (typeof spawnParticles === 'function') spawnParticles(ox, oy, oz, colHex, 4, true);
          if (typeof playSfx === 'function') playSfx('dig');
        }
        const mineDur = Math.max(0.40, Math.min(1.5, (((oreDef && oreDef.hard) || 1.8) * 0.36) / speedMul));
        if (rp._mineProg >= mineDur) {
          const brokenId = getBlockWorld(ot.x, ot.y, ot.z);
          if (brokenId === ot.id) {
            setBlockWorld(ot.x, ot.y, ot.z, B.AIR, true);
            const dropId = (oreDef && oreDef.drop) ? oreDef.drop : brokenId;
            // Spawn mined ore marked buddyMined so Alex picks it up & runs back to throw it to the player!
            if (dropId && typeof spawnDroppedItem === 'function') spawnDroppedItem(ox, oy, oz, dropId, { buddyMined: true, pickupDelay: 0.45 });
            if (oreDef && oreDef.xp > 0 && typeof spawnXpOrb === 'function') spawnXpOrb(ox, oy, oz, oreDef.xp);
            if (typeof playSfx === 'function') playSfx('break');
            if (typeof spawnParticles === 'function') spawnParticles(ox, oy, oz, oreDef && oreDef.mapColor ? parseInt(oreDef.mapColor.replace('#', ''), 16) : 0x38bdf8, 8, true);
          }
          let nextVein = null;
          const vDirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
          for (let vi = 0; vi < 6; vi++) {
            const vx = ot.x + vDirs[vi][0], vy = ot.y + vDirs[vi][1], vz = ot.z + vDirs[vi][2];
            const vId = getBlockWorld(vx, vy, vz);
            if (vId && BLOCK_DEF[vId] && BLOCK_DEF[vId].oreBlock) { nextVein = { x: vx, y: vy, z: vz, id: vId }; break; }
          }
          rp._oreTarget = nextVein;
          rp._mineProg = 0;
          rp._oreChaseT = 0;
        }
      }
    } else if (rp._buddyLoot.length > 0) {
      // ORE DELIVERY: Run back to player and throw all collected ores straight toward the player!
      const topLoot = rp._buddyLoot[0];
      _setBuddyHeld(rp, topLoot.id, null);
      lookYaw = Math.atan2(-dxP, -dzP);
      lookPitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dyP, Math.max(0.4, distP))));
      if (distP > 3.2 || Math.abs(dyP) > 2.8) {
        moveTargetX = player.x; moveTargetY = player.y; moveTargetZ = player.z;
        wantSpeed = distP > 8.0 ? 6.4 : 5.0;
        wantSprint = distP > 8.0;
      } else {
        let totalDelivered = 0;
        const names = [];
        while (rp._buddyLoot.length > 0) {
          const stk = rp._buddyLoot.shift();
          _buddyThrowItemToPlayer(rp, stk.id, stk.count, null);
          totalDelivered += stk.count;
          const nm = (BLOCK_DEF[stk.id] && BLOCK_DEF[stk.id].name) ? BLOCK_DEF[stk.id].name : 'quặng';
          names.push(`${stk.count}× ${nm}`);
        }
        if (totalDelivered > 0 && typeof showToast === 'function') {
          showToast(`🤖 Alex đã đào và ném cho bạn: ${names.slice(0, 2).join(', ')}!`);
        }
      }
    } else {
      // Default: Follow player smartly (run, jump, climb with blocks, swim) or patrol nearby
      if (rp._showBlkHoldT <= 0) _setBuddyHeld(rp, rp._buddyPickId, rp._buddyPickMeta || null);
      rp.swordAtkSeq = 0;
      if (distP > 6.8 || dyP >= 0.85) {
        moveTargetX = player.x; moveTargetY = player.y; moveTargetZ = player.z;
        wantSpeed = distP > 12.5 ? 6.8 : 4.8;
        wantSprint = distP > 12.5;
        lookYaw = Math.atan2(-dxP, -dzP);
      } else if (distP < 3.6 && Math.abs(dyP) < 0.85) {
        wantSpeed = 0; wantSprint = false;
        lookYaw = Math.atan2(-dxP, -dzP);
        lookPitch = Math.max(-0.5, Math.min(0.5, Math.atan2(dyP, Math.max(0.4, distP))));
      } else {
        rp.wanderT -= safeDt;
        if (rp.wanderT <= 0) {
          rp.wanderT = 2.4 + Math.random() * 2.4;
          const wa = Math.random() * Math.PI * 2;
          rp._wanderX = player.x + Math.cos(wa) * (3.5 + Math.random() * 2.5);
          rp._wanderZ = player.z + Math.sin(wa) * (3.5 + Math.random() * 2.5);
        }
        if (rp._wanderX !== undefined) {
          const wd = Math.hypot(rp._wanderX - rp.x, rp._wanderZ - rp.z);
          if (wd > 0.9) {
            moveTargetX = rp._wanderX; moveTargetY = player.y; moveTargetZ = rp._wanderZ;
            wantSpeed = 2.9;
            lookYaw = Math.atan2(-(rp._wanderX - rp.x), -(rp._wanderZ - rp.z));
          } else {
            lookYaw = Math.atan2(-dxP, -dzP);
          }
        }
      }
    }

    // 4) NAVIGATION EXECUTION: Sprint, Jump, Detour, Pillar-Up Climb, Bridge & Swim!
    let wantJump = false, wantClimb = false, wantBridge = false;
    if (moveTargetX !== null && wantSpeed > 0.05) {
      const nav = _buddyPickMoveYaw(rp, moveTargetX, moveTargetY, moveTargetZ, safeDt);
      lookYaw = nav.yaw;
      wantJump = nav.jump;
      wantClimb = nav.needClimb;
      wantBridge = nav.needBridge;
    }

    let dYaw = lookYaw - (rp.yaw || 0);
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    rp.yaw = (rp.yaw || 0) + dYaw * Math.min(1, safeDt * 12.0);
    rp.pitch = (rp.pitch || 0) + (lookPitch - (rp.pitch || 0)) * Math.min(1, safeDt * 10.0);

    // Bridge ahead across chasm if holding blocks
    if (wantBridge) _buddyTryPlaceBridgeBlock(rp, rp.yaw);
    // Pillar-up climb onto higher cliff/wall if holding blocks (hold XZ steady on pillar between jumps so Alex never steps off mid-climb!)
    const climbedNow = wantClimb && _buddyTryPlaceClimbBlock(rp);
    const holdForClimb = wantClimb && !!_buddyPeekBlock(rp);

    const prevX = rp.x, prevZ = rp.z;
    const effSpeed = rp.inWater ? Math.min(wantSpeed, wantSprint ? 4.8 : 3.7) : wantSpeed;
    const stepX = (climbedNow || holdForClimb) ? 0 : (-Math.sin(rp.yaw) * effSpeed * safeDt);
    const stepZ = (climbedNow || holdForClimb) ? 0 : (-Math.cos(rp.yaw) * effSpeed * safeDt);
    const curFootY = Math.floor(rp.y + 0.12);
    const curHeadY = Math.floor(rp.y + 1.55);
    const canMoveAxis = (tx, tz) => {
      const r = 0.24;
      for (const [ox, oz] of [[-r,-r],[r,-r],[-r,r],[r,r]]) {
        const bx = Math.floor(tx + ox), bz = Math.floor(tz + oz);
        if (isSolidAt(bx, curFootY, bz) || isSolidAt(bx, curHeadY, bz) || _buddyIsHazard(bx, curFootY, bz)) return false;
      }
      return true;
    };

    let blockedHoriz = false;
    if (Math.abs(stepX) > 1e-5) {
      if (canMoveAxis(rp.x + stepX, rp.z)) rp.x += stepX;
      else blockedHoriz = true;
    }
    if (Math.abs(stepZ) > 1e-5) {
      if (canMoveAxis(rp.x, rp.z + stepZ)) rp.z += stepZ;
      else blockedHoriz = true;
    }

    // Auto-jump over 1-block steps, gaps, or shoreline banks out of water!
    if (!climbedNow && (wantJump || blockedHoriz) && (rp.onGround || rp.inWater)) {
      const fx = Math.floor(rp.x - Math.sin(rp.yaw) * 0.76), fz = Math.floor(rp.z - Math.cos(rp.yaw) * 0.76);
      const clearStepUp = !isSolidAt(fx, curFootY + 1, fz) && !isSolidAt(fx, curFootY + 2, fz) && !isSolidAt(Math.floor(rp.x), curFootY + 2, Math.floor(rp.z));
      if (clearStepUp || rp.inWater) {
        rp.vy = JUMP_VEL * 0.96;
        rp.onGround = false;
      } else if (blockedHoriz && _buddyPeekBlock(rp) && _buddyTryPlaceClimbBlock(rp)) {
        // Placed block to climb over tall wall!
      } else if (blockedHoriz && rp._detourT <= 0) {
        rp._detourSign = -(rp._detourSign || 1);
        rp._detourYaw = rp.yaw + 1.45 * rp._detourSign;
        rp._detourT = 0.65;
      }
    }

    // Stuck detector: try jumping, placing a climb block if available, or detouring around!
    const movedDist = Math.hypot(rp.x - prevX, rp.z - prevZ);
    if (!climbedNow && !holdForClimb && effSpeed > 0.5 && movedDist < effSpeed * safeDt * 0.22) {
      rp._stuckT += safeDt;
      if (rp._stuckT > 0.40 && (rp.onGround || rp.inWater)) {
        if (_buddyPeekBlock(rp) && (moveTargetY !== null && moveTargetY >= rp.y + 1.4) && _buddyTryPlaceClimbBlock(rp)) {
          rp._stuckT = 0;
        } else {
          rp.vy = JUMP_VEL * 0.96;
          rp.onGround = false;
          rp._detourSign = -(rp._detourSign || 1);
          rp._detourYaw = rp.yaw + 1.35 * rp._detourSign;
          rp._detourT = 0.75;
        }
      }
    } else {
      rp._stuckT = Math.max(0, rp._stuckT - safeDt * 2.5);
    }

    // Real vertical physics + smooth buoyant swimming
    const rpCol = measureWaterColumnAt(rp.x, rp.y, rp.z);
    rp.inWater = rpCol.inWater;
    rp.deepWater = rpCol.inWater && rpCol.depth >= 2;
    rp.swimMoving = rp.inWater && effSpeed > 0.14;
    rp.sprintSwimming = rp.inWater && wantSprint && effSpeed > 3.2;
    if (rp.inWater) {
      const targetSwimY = (moveTargetY !== null && moveTargetY < rp.y - 1.2) ? -1.4 : ((wantJump || blockedHoriz) ? 5.2 : ((rpCol.surfaceY !== undefined && rp.y < rpCol.surfaceY - 0.55) ? 3.2 : 0.4));
      rp.vy += (targetSwimY - rp.vy) * Math.min(1, safeDt * 7.5);
    } else {
      rp.vy = Math.max(-28, rp.vy - GRAVITY * safeDt);
    }

    const nextY = rp.y + rp.vy * safeDt;
    if (rp.vy > 0) {
      const headCheckY = Math.floor(nextY + 1.72);
      if (isSolidAt(Math.floor(rp.x), headCheckY, Math.floor(rp.z))) {
        rp.vy = 0;
      } else {
        rp.y = nextY;
        rp.onGround = false;
      }
    } else {
      const footBlockY = Math.floor(nextY - 0.02);
      const rF = 0.22;
      let hitFloor = false;
      for (const [ox, oz] of [[0,0],[-rF,-rF],[rF,-rF],[-rF,rF],[rF,rF]]) {
        if (isSolidAt(Math.floor(rp.x + ox), footBlockY, Math.floor(rp.z + oz))) { hitFloor = true; break; }
      }
      if (hitFloor) {
        rp.y = footBlockY + 1.0;
        rp.vy = 0;
        rp.onGround = !rp.deepWater;
      } else {
        rp.y = nextY;
        rp.onGround = false;
        if (rp.y < MIN_Y + 2) {
          const fl = _buddyFloorNear(rp.x, player.y, rp.z);
          rp.y = fl !== null ? fl : (Math.max(WATER_LEVEL, colGroundY(Math.floor(rp.x), Math.floor(rp.z))) + 1.0);
          rp.vy = 0;
          rp.onGround = true;
        }
      }
    }

    rp.speed = (movedDist / safeDt) > 0.12 ? Math.min(effSpeed, movedDist / safeDt) : 0;
    rp.sprinting = wantSprint && rp.speed > 4.2 && !rp.inWater;
  }

  function toggleCoopBuddy() {
    if (remotePlayers.has('coop_buddy')) {
      removeRemotePeer('coop_buddy');
      showToast('🤖 Đã ẩn Bạn Đồng Hành Co-op');
      return;
    }
    const rp = ensureRemotePeer('coop_buddy', 'Alex (Co-op)', '#f472b6', true);
    const sp = _buddyFindSafeSpotNearPlayer();
    rp.x = rp.tx = sp.x; rp.y = rp.ty = sp.y; rp.z = rp.tz = sp.z;
    rp.vy = 0; rp.onGround = true; rp._lastDim = currentDimension;
    rp.equip = { helmet: 0, chest: 0, legs: 0, boots: 0, offhand: 0 };
    rp.equipMeta = { helmet: null, chest: null, legs: null, boots: null, offhand: null };
    rp._buddyBlocks = [];
    rp._buddyLoot = [];
    rp._buddySwordId = B.DIAMOND_SWORD;
    rp._buddyPickId = B.DIAMOND_PICK;
    rp.rig.g.position.set(rp.x, rp.y, rp.z);
    _setBuddyHeld(rp, rp._buddyPickId, null);
    showToast('🤖 Alex đã tham gia! Ném giáp, công cụ hoặc block cho Alex — Alex sẽ tự mặc, leo block, bơi, đánh quái & đào quặng mang về cho bạn!');
  }

  const locatorDotEls = new Map();
  let _lastHasPeers = false;
  const _lastSentNet = { x: 1e9, y: 1e9, z: 1e9, yaw: 0, pitch: 0, held: -1, bowStage: 0, eqSig: '', skinId: '', customSkinSig: '', idleAt: 0, metaAt: 0, _hadSwing: false, _hadSwAtk: false, _burning: false, _burnSoul: false };
  let _localPrevPos = null;
  let _localVelX = 0, _localVelY = 0, _localVelZ = 0;
  let _localStateSeq = 0, _lastStateSendMs = 0, _wasMovingNet = false, _wasOnGroundNet = true;
  const _rpSampleOut = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, spd: 0 };
  const _wasmNetRps = [];
  let _cachedLocBarW = 360, _cachedLocBarAt = 0;
  function _netQ2(v) { return Math.round(v * 100) / 100; }
  function _netQ3(v) { return Math.round(v * 1000) / 1000; }
  function updateCoopAndLocator(dt, tNow, visualOnly = false) {
    // Adaptive quantized snapshot broadcast with measured true velocity & edge-triggered flush
    const nowPerf = performance.now();
    const localOff = depthOffset || 0;
    const safeFrameDt = Math.min(0.05, Math.max(0.001, dt || 0.016));
    if (!visualOnly) {
      if (activeRoomId) {
        const trueYNow = player.y - localOff;
        const safeDt = Math.max(0.004, Math.min(0.1, dt || 0.016));
        if (!_localPrevPos || _localPrevPos.dim !== currentDimension) {
          _localPrevPos = { x: player.x, y: trueYNow, z: player.z, dim: currentDimension };
          _localVelX = 0; _localVelY = 0; _localVelZ = 0;
        } else {
          const dxL = player.x - _localPrevPos.x;
          const dyL = trueYNow - _localPrevPos.y;
          const dzL = player.z - _localPrevPos.z;
          const stepDist = Math.hypot(dxL, dyL, dzL);
          if (stepDist > 8.0) {
            _localVelX = 0; _localVelY = 0; _localVelZ = 0;
          } else {
            const vK = 1 - Math.exp(-24.0 * safeDt);
            _localVelX += ((dxL / safeDt) - _localVelX) * vK;
            _localVelY += ((dyL / safeDt) - _localVelY) * vK;
            _localVelZ += ((dzL / safeDt) - _localVelZ) * vK;
          }
          _localPrevPos.x = player.x; _localPrevPos.y = trueYNow; _localPrevPos.z = player.z;
        }
        const measSpd = Math.hypot(_localVelX, _localVelZ);
        const _isMovingNet = measSpd > 0.06 || Math.abs(_localVelY) > 0.08 || (player.curSpeed || 0) > 0.05 || (player.curSwing || 0) > 0.02 || !!player.swordAtkActive || !!player.bowDrawing;
        const qx = _netQ2(player.x), qy = _netQ2(player.y), qz = _netQ2(player.z);
        const qYaw = _netQ3(player.yaw), qPitch = _netQ3(player.pitch);
        const heldId = (inventory[player.selectedSlot]?.count > 0 ? inventory[player.selectedSlot].id : 0);
        const swingEdge = ((player.curSwing || 0) > 0.02 && !_lastSentNet._hadSwing) || (!!player.swordAtkActive && !_lastSentNet._hadSwAtk);
        const _burnNow = ((player.burnTime || 0) > 0 && gameMode !== 'creative' && !player.dead);
        const _burnSoulNow = _burnNow && !!player._burnSoul;
        const rotChanged = Math.abs(_wrapNetAng(qYaw - _lastSentNet.yaw)) > 0.008 || Math.abs(qPitch - _lastSentNet.pitch) > 0.008;
        const discreteEdge = (_isMovingNet !== _wasMovingNet)
          || (!!player.onGround !== _wasOnGroundNet)
          || swingEdge
          || (heldId !== _lastSentNet.held)
          || (_burnNow !== !!_lastSentNet._burning)
          || (_burnSoulNow !== !!_lastSentNet._burnSoul);
        const yawEdge = Math.abs(_wrapNetAng(qYaw - _lastSentNet.yaw)) > 0.35;
        const sinceSend = nowPerf - _lastStateSendMs;
        const edgeReady = (discreteEdge && sinceSend >= 18) || (yawEdge && sinceSend >= 28);
        // Scale state send rate smoothly with transport & peer count
        const peerCnt = remotePlayers.size;
        const onlyMqtt = (typeof activeCoopTransport !== 'undefined' && activeCoopTransport === 'mqtt')
          || (p2pIsHost && p2pClientConns.size === 0 && mqttRoomPeers.size > 0 && !(wsConn && wsConn.readyState === 1));
        const moveIntervalMs = onlyMqtt ? 60 : (peerCnt >= 8 ? 55 : (peerCnt >= 4 ? 42 : 33));
        const _sendIntervalMs = (_isMovingNet || !!player.bowDrawing) ? moveIntervalMs : (rotChanged ? 90 : 1000);
        if (edgeReady || sinceSend >= _sendIntervalMs) {
          const eq = player.equip;
          const eqSig = `${eq.helmet||0}_${eq.chest||0}_${eq.legs||0}_${eq.boots||0}_${eq.offhand||0}`;
          const posChanged = Math.abs(qx - _lastSentNet.x) > 0.01 || Math.abs(qy - _lastSentNet.y) > 0.01 || Math.abs(qz - _lastSentNet.z) > 0.01
            || rotChanged || heldId !== _lastSentNet.held || (player.curSwing || 0) > 0.02 || !!player.swordAtkActive
            || !!player.bowDrawing || (player.bowStage || 0) !== (_lastSentNet.bowStage || 0);
          const needMeta = (eqSig !== _lastSentNet.eqSig || selectedSkinId !== _lastSentNet.skinId || localPlayerName !== _lastSentNet.name || (nowPerf - _lastSentNet.metaAt) >= 15000);
          if (_isMovingNet || discreteEdge || yawEdge || posChanged || needMeta || (nowPerf - _lastSentNet.idleAt) >= 1000) {
            _lastStateSendMs = nowPerf;
            _wasMovingNet = _isMovingNet;
            _wasOnGroundNet = !!player.onGround;
            _lastSentNet._hadSwing = (player.curSwing || 0) > 0.02;
            _lastSentNet._hadSwAtk = !!player.swordAtkActive;
            _lastSentNet._burning = _burnNow;
            _lastSentNet._burnSoul = _burnSoulNow;
            _lastSentNet.idleAt = nowPerf;
            _lastSentNet.name = localPlayerName;
            _lastSentNet.x = qx; _lastSentNet.y = qy; _lastSentNet.z = qz;
            _lastSentNet.yaw = qYaw; _lastSentNet.pitch = qPitch; _lastSentNet.held = heldId;
            _lastSentNet.bowStage = player.bowStage || 0;
            const stOut = {
              seq: ++_localStateSeq,
              ts: Math.round(nowPerf),
              dim: currentDimension,
              x: qx, y: qy, trueY: _netQ2(trueYNow), z: qz,
              yaw: qYaw, pitch: qPitch,
              speed: _netQ2(Math.max(measSpd, player.curSpeed || 0)),
              held: heldId
            };
            if (localOff) stOut.depthOffset = localOff;
            const qvx = _netQ2(_localVelX), qvy = _netQ2(_localVelY), qvz = _netQ2(_localVelZ);
            if (Math.abs(qvx) >= 0.01) stOut.vx = qvx;
            if (Math.abs(qvy) >= 0.01) stOut.vy = qvy;
            if (Math.abs(qvz) >= 0.01) stOut.vz = qvz;
            if (player.sprinting) stOut.sprinting = 1;
            if (player.sneaking) stOut.sneaking = 1;
            if (player.inWater) stOut.inWater = 1;
            if (player.deepWater) stOut.deepWater = 1;
            if ((player.curSpeed || 0) > 0.2) stOut.swimMoving = 1;
            if (player.sprintSwimming) stOut.sprintSwimming = 1;
            if (player.lowSprintSwim) stOut.lowSprintSwim = 1;
            if (!player.onGround) stOut.onGround = 0;
            if (player.flying) stOut.flying = 1;
            if (player.gliding) stOut.gliding = 1;
            if ((player.hurtAnimT || 0) > 0.01) stOut.hurtT = _netQ2(player.hurtAnimT);
            if ((player.curSwing || 0) > 0.01) stOut.swing = _netQ2(player.curSwing);
            if (player.swingActive) stOut.swingActive = 1;
            if (player.swingActive || (player.curSwing || 0) > 0.01) {
              stOut.swingU = _netQ3(player.swingU || 0);
              stOut.actionType = player.actionType || 'mine';
            }
            if (player.bowDrawing) {
              stOut.bowDrawing = 1;
              stOut.bowCharge = _netQ2(player.bowCharge || 0);
              stOut.bowStage = player.bowStage || 0;
            }
            if (player.swordAtkActive) {
              stOut.swSeq = player.swordAtkSeq || 0;
              stOut.swHit = player.swordAtkHit || 0;
            }
            if (_burnNow) stOut.burning = 1;
            if (_burnSoulNow) stOut.burnSoul = 1;
            const pkt = { type: 'state', name: localPlayerName, state: stOut };
            if (needMeta) {
              _lastSentNet.eqSig = eqSig; _lastSentNet.skinId = selectedSkinId; _lastSentNet.metaAt = nowPerf;
              pkt.skinId = selectedSkinId; pkt.equip = eq; pkt.dayTime = dayTime;
              if (typeof getLocalCustomSkinPayload === 'function') {
                const cs = getLocalCustomSkinPayload();
                const csSig = cs ? `${cs.slim ? 1 : 0}:${cs.dataUrl.length}:${cs.dataUrl.slice(-16)}` : '';
                if (cs && csSig !== _lastSentNet.customSkinSig) {
                  _lastSentNet.customSkinSig = csSig;
                  pkt.customSkin = cs;
                } else if (!cs) {
                  _lastSentNet.customSkinSig = '';
                }
              }
            }
            sendCoopMsg(pkt, discreteEdge ? { mqttEdge: true } : null);
          }
        }
      } else {
        _localPrevPos = null;
        _lastStateSendMs = 0;
        _lastSentNet.customSkinSig = '';
      }
    }

    // Update remote player interpolation, AI Co-op buddy movement & skeletal animation
    const hasPeers = remotePlayers.size > 0;
    if (hasPeers !== _lastHasPeers) { _lastHasPeers = hasPeers; locatorBarEl.classList.toggle('visible', hasPeers); _cachedLocBarAt = 0; }
    if (!hasPeers) {
      if (locatorDotEls.size > 0) {
        for (const e of locatorDotEls.values()) e.el.remove();
        locatorDotEls.clear();
      }
      return;
    }

    const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
    // Avoid synchronous DOM layout reflow every frame: refresh clientWidth at most once per second
    if (nowPerf - _cachedLocBarAt >= 1000) {
      _cachedLocBarAt = nowPerf;
      _cachedLocBarW = locatorBarEl.clientWidth || 360;
    }
    const barInnerW = _cachedLocBarW;
    const _wCoreNet = (typeof window._getNucraftWasmCore === 'function') ? window._getNucraftWasmCore() : null;
    const _useWasmNet = !!(_wCoreNet && _wCoreNet.exports && _wCoreNet.exports.interp_net_entities && _wCoreNet.netEntBuf);
    _wasmNetRps.length = 0;

    for (const [pid, rp] of remotePlayers.entries()) {
      const lastActiveAt = rp._lastPktAt || rp._createdAt;
      if (!rp.isBuddy && activeRoomId && lastActiveAt && typeof worldPaused !== 'undefined' && !worldPaused && (nowPerf - lastActiveAt > 25000)) {
        removeRemotePeer(pid);
        continue;
      }
      if (rp.isBuddy) {
        if (!visualOnly) _updateCoopBuddyAI(rp, dt, nowPerf * 0.001);
      } else {
        let tgtX = rp.tx, tgtY = (typeof rp.trueY === 'number') ? (rp.trueY + localOff) : rp.ty, tgtZ = rp.tz;
        let tgtYaw = rp.yaw || 0, tgtPitch = rp.pitch || 0, vxN = 0, vzN = 0;
        if (rp._netBuf && rp._netBuf.snaps.length > 0) {
          const maxTp = (rp.gliding || rp.flying) ? 26.0 : 12.0;
          const s = sampleNetInterp(rp._netBuf, nowPerf, safeFrameDt, localOff, maxTp, _rpSampleOut);
          tgtX = s.x; tgtY = s.y; tgtZ = s.z;
          tgtYaw = s.yaw; tgtPitch = s.pitch;
          vxN = s.vx; vzN = s.vz;
          rp.vy = s.vy;
          const visSpd = Math.hypot(s.vx, s.vz);
          const animSpd = Math.max(s.spd * 0.4, visSpd);
          rp.speed = animSpd < 0.08 ? 0 : animSpd;
        }
        if (_useWasmNet && _wasmNetRps.length < 128) {
          if (!rp._wasmSmoothed) {
            rp.x = tgtX; rp.y = tgtY; rp.z = tgtZ;
            rp.yaw = tgtYaw; rp.pitch = tgtPitch;
            rp._wasmSmoothed = true;
          }
          const idx = _wasmNetRps.length;
          const o = idx * 12;
          const nb = _wCoreNet.netEntBuf;
          nb[o] = rp.x; nb[o + 1] = rp.y; nb[o + 2] = rp.z; nb[o + 3] = rp.yaw || 0; nb[o + 4] = rp.pitch || 0;
          nb[o + 5] = tgtX; nb[o + 6] = tgtY; nb[o + 7] = tgtZ; nb[o + 8] = tgtYaw; nb[o + 9] = tgtPitch;
          nb[o + 10] = vxN; nb[o + 11] = vzN;
          _wasmNetRps.push(rp);
        } else {
          rp.x = tgtX; rp.y = tgtY; rp.z = tgtZ;
          rp.yaw = tgtYaw; rp.pitch = tgtPitch;
        }
      }
    }
    if (_useWasmNet && _wasmNetRps.length > 0) {
      const nW = _wCoreNet.exports.interp_net_entities(_wasmNetRps.length | 0, safeFrameDt, 18.0) >>> 0;
      const nb = _wCoreNet.netEntBuf;
      for (let wi = 0; wi < nW; wi++) {
        const rpW = _wasmNetRps[wi], o = wi * 12;
        rpW.x = nb[o]; rpW.y = nb[o + 1]; rpW.z = nb[o + 2];
        rpW.yaw = nb[o + 3]; rpW.pitch = nb[o + 4];
      }
      if (_wCoreNet.state) _wCoreNet.state.netInterpCalls = (_wCoreNet.state.netInterpCalls || 0) + 1;
    }

    let _rpVisIdx = 0;
    for (const [pid, rp] of remotePlayers.entries()) {
      const sameDim = !!rp.isBuddy || ((rp.dim || 'overworld') === currentDimension);
      const dx = rp.x - player.x, dz = rp.z - player.z, dy = rp.y - player.y;
      const distSq = dx * dx + dz * dz;
      const inVisRange = sameDim && distSq < 12100; // <= 110m
      rp.rig.g.visible = inVisRange;
      if (inVisRange) {
        rp.rig.g.position.set(rp.x, rp.y, rp.z);
        rp.rig.g.rotation.y = rp.yaw + Math.PI;
        // Distance-LOD skeletal animation: full-rate <=40m, half-rate 40..85m, static pose >85m for high FPS in crowded rooms
        if (distSq <= 1600 || (distSq <= 7225 && (((frameCounter + _rpVisIdx) & 1) === 0))) {
          animatePlayerRig(rp.rig, rp, distSq <= 1600 ? safeFrameDt : safeFrameDt * 2, tNow);
        }
      }
      _rpVisIdx++;

      // Update persistent GPU-composited locator dot every frame with zero DOM thrash
      let entry = locatorDotEls.get(pid);
      if (!sameDim) {
        if (entry && entry.el.style.display !== 'none') entry.el.style.display = 'none';
        continue;
      } else if (entry && entry.el.style.display === 'none') {
        entry.el.style.display = '';
      }
      const dist = Math.sqrt(distSq);
      const fwdDot = dx * (-sinY) + dz * (-cosY);
      const rightDot = dx * cosY + dz * (-sinY);
      const relAng = Math.atan2(rightDot, fwdDot); // 0 = ahead, +PI/2 = right, -PI/2 = left
      const clamped = Math.max(-Math.PI * 0.5, Math.min(Math.PI * 0.5, relAng));
      const xPx = (0.04 + ((clamped + Math.PI * 0.5) / Math.PI) * 0.92) * barInnerW;
      const dotPx = Math.round(Math.max(4, Math.min(11, 11.5 - (dist / 90) * 7.5)));
      const behind = relAng < -Math.PI * 0.52 ? 'l' : (relAng > Math.PI * 0.52 ? 'r' : '');
      const elev = dy > 5 ? 'u' : (dy < -5 ? 'd' : '');
      const mDist = Math.round(dist);

      if (!entry) {
        const el = document.createElement('div');
        el.className = 'loc-dot';
        const elevEl = document.createElement('span');
        elevEl.className = 'loc-elev';
        el.appendChild(elevEl);
        locatorBarEl.appendChild(el);
        entry = { el, elevEl, lastX: -9999, lastPx: 0, lastBehind: '', lastElev: '', lastDist: -1, lastColor: '' };
        locatorDotEls.set(pid, entry);
      }
      if (Math.abs(xPx - entry.lastX) > 0.04) {
        entry.lastX = xPx;
        entry.el.style.transform = `translate3d(${xPx.toFixed(2)}px, -50%, 0) translateX(-50%)`;
      }
      if (dotPx !== entry.lastPx) {
        entry.lastPx = dotPx;
        entry.el.style.width = `${dotPx}px`;
        entry.el.style.height = `${dotPx}px`;
      }
      if (rp.color !== entry.lastColor) {
        entry.lastColor = rp.color;
        entry.el.style.background = rp.color;
      }
      if (behind !== entry.lastBehind) {
        entry.lastBehind = behind;
        entry.el.classList.toggle('behind-l', behind === 'l');
        entry.el.classList.toggle('behind-r', behind === 'r');
      }
      if (elev !== entry.lastElev) {
        entry.lastElev = elev;
        entry.elevEl.className = elev === 'u' ? 'loc-elev up' : (elev === 'd' ? 'loc-elev dn' : 'loc-elev');
        entry.elevEl.textContent = elev === 'u' ? '▲' : (elev === 'd' ? '▼' : '');
      }
      if (mDist !== entry.lastDist) {
        entry.lastDist = mDist;
        entry.el.title = `${rp.name} (${mDist}m)`;
      }
    }
    if (locatorDotEls.size > remotePlayers.size) {
      for (const [pid, e] of locatorDotEls.entries()) {
        if (!remotePlayers.has(pid)) { e.el.remove(); locatorDotEls.delete(pid); }
      }
    }
  }

