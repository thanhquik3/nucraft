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
    const accepted = pushNetSnap(rp._netBuf, {
      seq: st.seq,
      ts: st.ts,
      x: st.x,
      y: worldY,
      ty: rp.trueY,
      z: st.z,
      vx: st.vx,
      vy: st.vy,
      vz: st.vz,
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
    rp.onGround = st.onGround !== false; rp.flying = !!st.flying; rp.gliding = !!st.gliding; rp.swing = st.swing || 0;
    rp.swingActive = !!st.swingActive; rp.swingU = st.swingU || 0;
    rp.bowDrawing = !!st.bowDrawing; rp.bowCharge = st.bowCharge || 0; rp.bowStage = st.bowStage || 0;
    rp.actionType = st.actionType || rp.actionType || 'attack';
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


  function toggleCoopBuddy() {
    if (remotePlayers.has('coop_buddy')) {
      removeRemotePeer('coop_buddy');
      showToast('🤖 Đã ẩn Bạn Đồng Hành Co-op');
      return;
    }
    const rp = ensureRemotePeer('coop_buddy', 'Alex (Co-op)', '#f472b6', true);
    const sx = player.x - Math.sin(player.yaw) * 6.5, sz = player.z - Math.cos(player.yaw) * 6.5;
    rp.x = rp.tx = sx; rp.z = rp.tz = sz;
    rp.y = rp.ty = colGroundY(Math.floor(sx), Math.floor(sz)) + 1.0;
    rp.rig.g.position.set(rp.x, rp.y, rp.z);
    showToast('🤖 Bạn Đồng Hành Alex đã tham gia! Xem chấm hồng trên Thanh Định Vị!');
  }

  const locatorDotEls = new Map();
  let _lastHasPeers = false;
  const _lastSentNet = { x: 1e9, y: 1e9, z: 1e9, yaw: 0, pitch: 0, held: -1, bowStage: 0, eqSig: '', skinId: '', customSkinSig: '', idleAt: 0, metaAt: 0, _hadSwing: false, _hadSwAtk: false };
  let _localPrevPos = null;
  let _localVelX = 0, _localVelY = 0, _localVelZ = 0;
  let _localStateSeq = 0, _lastStateSendMs = 0, _wasMovingNet = false, _wasOnGroundNet = true;
  const _rpSampleOut = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, spd: 0 };
  function updateCoopAndLocator(dt, tNow) {
    // Adaptive 20Hz quantized snapshot broadcast with measured true velocity & edge-triggered flush
    const nowPerf = performance.now();
    const localOff = depthOffset || 0;
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
      const q2 = v => Math.round(v * 100) / 100, q3 = v => Math.round(v * 1000) / 1000;
      const qx = q2(player.x), qy = q2(player.y), qz = q2(player.z);
      const qYaw = q3(player.yaw), qPitch = q3(player.pitch);
      const heldId = (inventory[player.selectedSlot]?.count > 0 ? inventory[player.selectedSlot].id : 0);
      const swingEdge = ((player.curSwing || 0) > 0.02 && !_lastSentNet._hadSwing) || (!!player.swordAtkActive && !_lastSentNet._hadSwAtk);
      const rotChanged = Math.abs(_wrapNetAng(qYaw - _lastSentNet.yaw)) > 0.008 || Math.abs(qPitch - _lastSentNet.pitch) > 0.008;
      const edgeChanged = (_isMovingNet !== _wasMovingNet)
        || (!!player.onGround !== _wasOnGroundNet)
        || (Math.abs(_wrapNetAng(qYaw - _lastSentNet.yaw)) > 0.35)
        || swingEdge
        || (heldId !== _lastSentNet.held);
      const _sendIntervalMs = (_isMovingNet || !!player.bowDrawing) ? 50 : (rotChanged ? 120 : 1000);
      if (edgeChanged || (nowPerf - _lastStateSendMs) >= _sendIntervalMs) {
        const eq = player.equip;
        const eqSig = `${eq.helmet||0}_${eq.chest||0}_${eq.legs||0}_${eq.boots||0}_${eq.offhand||0}`;
        const posChanged = Math.abs(qx - _lastSentNet.x) > 0.01 || Math.abs(qy - _lastSentNet.y) > 0.01 || Math.abs(qz - _lastSentNet.z) > 0.01
          || rotChanged || heldId !== _lastSentNet.held || (player.curSwing || 0) > 0.02 || !!player.swordAtkActive
          || !!player.bowDrawing || (player.bowStage || 0) !== (_lastSentNet.bowStage || 0);
        const needMeta = (eqSig !== _lastSentNet.eqSig || selectedSkinId !== _lastSentNet.skinId || (nowPerf - _lastSentNet.metaAt) >= 4500);
        if (_isMovingNet || edgeChanged || posChanged || needMeta || (nowPerf - _lastSentNet.idleAt) >= 1000) {
          _lastStateSendMs = nowPerf;
          _wasMovingNet = _isMovingNet;
          _wasOnGroundNet = !!player.onGround;
          _lastSentNet._hadSwing = (player.curSwing || 0) > 0.02;
          _lastSentNet._hadSwAtk = !!player.swordAtkActive;
          _lastSentNet.idleAt = nowPerf;
          _lastSentNet.x = qx; _lastSentNet.y = qy; _lastSentNet.z = qz;
          _lastSentNet.yaw = qYaw; _lastSentNet.pitch = qPitch; _lastSentNet.held = heldId;
          _lastSentNet.bowStage = player.bowStage || 0;
          const pkt = {
            type: 'state',
            name: localPlayerName,
            state: {
              seq: ++_localStateSeq,
              ts: Math.round(nowPerf),
              dim: currentDimension,
              depthOffset: localOff,
              x: qx, y: qy, trueY: q2(trueYNow), z: qz,
              vx: q2(_localVelX),
              vy: q2(_localVelY),
              vz: q2(_localVelZ),
              yaw: qYaw, pitch: qPitch,
              speed: q2(Math.max(measSpd, player.curSpeed || 0)), sprinting: !!player.sprinting, sneaking: !!player.sneaking,
              inWater: !!player.inWater, deepWater: !!player.deepWater,
              swimMoving: (player.curSpeed || 0) > 0.2, sprintSwimming: !!player.sprintSwimming,
              lowSprintSwim: !!player.lowSprintSwim, onGround: !!player.onGround, flying: !!player.flying, gliding: !!player.gliding,
              hurtT: q2(player.hurtAnimT || 0), swing: q2(player.curSwing || 0),
              swingActive: !!player.swingActive, swingU: q3(player.swingU || 0), actionType: player.actionType || 'mine',
              bowDrawing: !!player.bowDrawing, bowCharge: q2(player.bowCharge || 0), bowStage: player.bowStage || 0,
              swSeq: player.swordAtkActive ? (player.swordAtkSeq || 0) : 0, swHit: player.swordAtkHit || 0,
              held: heldId
            }
          };
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
          sendCoopMsg(pkt);
        }
      }
    } else {
      _localPrevPos = null;
      _lastStateSendMs = 0;
      _lastSentNet.customSkinSig = '';
    }

    // Update remote player interpolation, AI Co-op buddy movement & skeletal animation
    const hasPeers = remotePlayers.size > 0;
    if (hasPeers !== _lastHasPeers) { _lastHasPeers = hasPeers; locatorBarEl.classList.toggle('visible', hasPeers); }
    if (!hasPeers) {
      if (locatorDotEls.size > 0) {
        for (const e of locatorDotEls.values()) e.el.remove();
        locatorDotEls.clear();
      }
      return;
    }

    const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
    const barInnerW = locatorBarEl.clientWidth || 360;

    for (const [pid, rp] of remotePlayers.entries()) {
      const lastActiveAt = rp._lastPktAt || rp._createdAt;
      if (!rp.isBuddy && activeRoomId && lastActiveAt && typeof worldPaused !== 'undefined' && !worldPaused && (nowPerf - lastActiveAt > 12000)) {
        removeRemotePeer(pid);
        continue;
      }
      if (rp.isBuddy) {
        const dxP = player.x - rp.x, dzP = player.z - rp.z, distP = Math.hypot(dxP, dzP);
        if (distP > 9.5) {
          rp.yaw = Math.atan2(-dxP, -dzP);
          rp.speed = distP > 18 ? 6.5 : 4.2;
          rp.sprinting = distP > 18;
        } else if (distP < 4.5) {
          rp.speed = 0; rp.sprinting = false;
          rp.yaw = Math.atan2(-dxP, -dzP);
        } else {
          rp.wanderT -= dt;
          if (rp.wanderT <= 0) { rp.wanderT = 2.5 + Math.random() * 2.5; rp.yaw += (Math.random() - 0.5) * 1.6; }
          rp.speed = 2.6; rp.sprinting = false;
        }
        const nx = rp.x - Math.sin(rp.yaw) * rp.speed * dt;
        const nz = rp.z - Math.cos(rp.yaw) * rp.speed * dt;
        if (!isSolidAt(Math.floor(nx), Math.floor(rp.y + 0.6), Math.floor(nz))) { rp.x = nx; rp.z = nz; }
        const gy = colGroundY(Math.floor(rp.x), Math.floor(rp.z));
        const rpCol = measureWaterColumnAt(rp.x, rp.y, rp.z);
        rp.inWater = rpCol.inWater;
        rp.deepWater = rpCol.inWater && rpCol.depth >= 2;
        rp.swimMoving = rp.speed > 0.14;
        rp.y += ((Math.max(WATER_LEVEL, gy) + 1.0) - rp.y) * Math.min(1, dt * 8);
        rp.onGround = !rp.deepWater;
      } else {
        if (rp._netBuf && rp._netBuf.snaps.length > 0) {
          const maxTp = (rp.gliding || rp.flying) ? 26.0 : 12.0;
          const s = sampleNetInterp(rp._netBuf, nowPerf, dt, localOff, maxTp, _rpSampleOut);
          rp.x = s.x; rp.y = s.y; rp.z = s.z;
          rp.yaw = s.yaw; rp.pitch = s.pitch;
          rp.vy = s.vy;
          const visSpd = Math.hypot(s.vx, s.vz);
          const animSpd = Math.max(s.spd * 0.4, visSpd);
          rp.speed = animSpd < 0.08 ? 0 : animSpd;
        } else {
          const baseY = (typeof rp.trueY === 'number') ? (rp.trueY + localOff) : rp.ty;
          rp.x = rp.tx; rp.y = baseY; rp.z = rp.tz;
        }
      }
      const sameDim = !!rp.isBuddy || ((rp.dim || 'overworld') === currentDimension);
      rp.rig.g.visible = sameDim;
      if (sameDim) {
        rp.rig.g.position.set(rp.x, rp.y, rp.z);
        rp.rig.g.rotation.y = rp.yaw + Math.PI;
        animatePlayerRig(rp.rig, rp, dt, tNow);
      }

      // Update persistent GPU-composited locator dot every frame with zero DOM thrash
      let entry = locatorDotEls.get(pid);
      if (!sameDim) {
        if (entry && entry.el.style.display !== 'none') entry.el.style.display = 'none';
        continue;
      } else if (entry && entry.el.style.display === 'none') {
        entry.el.style.display = '';
      }
      const dx = rp.x - player.x, dz = rp.z - player.z, dy = rp.y - player.y;
      const dist = Math.hypot(dx, dz);
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

