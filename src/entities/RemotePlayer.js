// NUCRAFT Module: src/entities/RemotePlayer.js — Remote peer interpolation, locator bar & AI Co-op buddy

  function applyRemotePeerState(rp, st, equip) {
    if (!rp || !st) return;
    if (!rp._lastPktAt) {
      rp.x = rp.tx = st.x;
      rp.y = rp.ty = st.y;
      rp.z = rp.tz = st.z;
      rp.tvx = 0; rp.tvy = 0; rp.tvz = 0;
      rp.yaw = rp.tYaw = typeof st.yaw === 'number' ? st.yaw : 0;
      rp.pitch = rp.tPitch = typeof st.pitch === 'number' ? st.pitch : 0;
      rp._lastPktAt = performance.now();
    } else {
      const _nowNet = performance.now();
      const _pdt = Math.max(0.02, Math.min(0.25, (_nowNet - rp._lastPktAt) / 1000));
      rp.tvx = (typeof st.vx === 'number') ? st.vx : ((st.x - (rp.tx ?? st.x)) / _pdt);
      rp.tvy = (typeof st.vy === 'number') ? st.vy : ((st.y - (rp.ty ?? st.y)) / _pdt);
      rp.tvz = (typeof st.vz === 'number') ? st.vz : ((st.z - (rp.tz ?? st.z)) / _pdt);
      rp.tx = st.x; rp.ty = st.y; rp.tz = st.z;
      rp.tYaw = st.yaw; rp.tPitch = st.pitch;
      rp._lastPktAt = _nowNet;
    }
    rp.speed = st.speed || 0;
    rp.sprinting = !!st.sprinting; rp.sneaking = !!st.sneaking;
    rp.inWater = !!st.inWater; rp.deepWater = !!st.deepWater; rp.swimMoving = !!st.swimMoving;
    rp.sprintSwimming = !!st.sprintSwimming; rp.lowSprintSwim = !!st.lowSprintSwim;
    rp.onGround = st.onGround !== false; rp.swing = st.swing || 0;
    if (st.swSeq) { rp.swordAtkSeq = st.swSeq; rp.swordAtkHit = st.swHit || 1; } else if (!rp.swing) rp.swordAtkSeq = 0;
    if (equip) {
      const eqSig = `${equip.helmet||0}_${equip.chest||0}_${equip.legs||0}_${equip.boots||0}_${equip.offhand||0}`;
      if (eqSig !== rp._eqSig) { rp._eqSig = eqSig; applyArmorToPlayerRig(rp.rig, equip); }
    }
    if (st.held !== undefined && st.held !== rp._heldId) { rp._heldId = st.held; setRigHeldItem(rp.rig, st.held); }
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
  const _lastSentNet = { x: 1e9, y: 1e9, z: 1e9, yaw: 0, pitch: 0, held: -1, eqSig: '', skinId: '', idleAt: 0, metaAt: 0 };
  function updateCoopAndLocator(dt, tNow) {
    // Adaptive 20Hz moving / 1Hz idle quantized delta broadcast for smooth multi-player sync!
    if (activeRoomId) {
      stateSendAccum += dt;
      const _isMovingNet = (player.curSpeed || 0) > 0.05 || Math.abs(player.vy) > 0.05 || (player.curSwing || 0) > 0.02 || !!player.swordAtkActive;
      const _sendInterval = _isMovingNet ? 0.05 : 0.20;
      if (stateSendAccum >= _sendInterval) {
        stateSendAccum = 0;
        const q2 = v => Math.round(v * 100) / 100, q3 = v => Math.round(v * 1000) / 1000;
        const qx = q2(player.x), qy = q2(player.y), qz = q2(player.z);
        const qYaw = q3(player.yaw), qPitch = q3(player.pitch);
        const heldId = (inventory[player.selectedSlot]?.count > 0 ? inventory[player.selectedSlot].id : 0);
        const eq = player.equip;
        const eqSig = `${eq.helmet||0}_${eq.chest||0}_${eq.legs||0}_${eq.boots||0}_${eq.offhand||0}`;
        const nowPerf = performance.now();
        const posChanged = Math.abs(qx - _lastSentNet.x) > 0.01 || Math.abs(qy - _lastSentNet.y) > 0.01 || Math.abs(qz - _lastSentNet.z) > 0.01
          || Math.abs(qYaw - _lastSentNet.yaw) > 0.005 || Math.abs(qPitch - _lastSentNet.pitch) > 0.005
          || heldId !== _lastSentNet.held || (player.curSwing || 0) > 0.02 || !!player.swordAtkActive;
        const needMeta = (eqSig !== _lastSentNet.eqSig || selectedSkinId !== _lastSentNet.skinId || (nowPerf - _lastSentNet.metaAt) >= 2000);
        if (_isMovingNet || posChanged || needMeta || (nowPerf - _lastSentNet.idleAt) >= 1000) {
          _lastSentNet.idleAt = nowPerf;
          _lastSentNet.x = qx; _lastSentNet.y = qy; _lastSentNet.z = qz;
          _lastSentNet.yaw = qYaw; _lastSentNet.pitch = qPitch; _lastSentNet.held = heldId;
          const pkt = {
            type: 'state',
            name: localPlayerName,
            state: {
              x: qx, y: qy, z: qz,
              vx: q2((player.smoothMoveX || 0) + (player.vx || 0)),
              vy: q2(player.vy || 0),
              vz: q2((player.smoothMoveZ || 0) + (player.vz || 0)),
              yaw: qYaw, pitch: qPitch,
              speed: q2(player.curSpeed || 0), sprinting: !!player.sprinting, sneaking: !!player.sneaking,
              inWater: !!player.inWater, deepWater: !!player.deepWater,
              swimMoving: (player.curSpeed || 0) > 0.2, sprintSwimming: !!player.sprintSwimming,
              lowSprintSwim: !!player.lowSprintSwim, onGround: !!player.onGround, flying: !!player.flying,
              hurtT: q2(player.hurtAnimT || 0), swing: q2(player.curSwing || 0),
              swSeq: player.swordAtkActive ? (player.swordAtkSeq || 0) : 0, swHit: player.swordAtkHit || 0,
              held: heldId
            }
          };
          if (needMeta) {
            _lastSentNet.eqSig = eqSig; _lastSentNet.skinId = selectedSkinId; _lastSentNet.metaAt = nowPerf;
            pkt.skinId = selectedSkinId; pkt.equip = eq; pkt.dayTime = dayTime;
          }
          sendCoopMsg(pkt);
        }
      }
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
        // Dead-reckoning prediction (clamped <= 150ms) + frame-rate-independent exponential smoothing + shortest-arc yaw!
        const ageSec = rp._lastPktAt ? Math.min(0.15, Math.max(0, (performance.now() - rp._lastPktAt) / 1000)) : 0;
        const predX = rp.tx + (rp.tvx || 0) * ageSec;
        const predY = rp.ty + (rp.tvy || 0) * ageSec * 0.5;
        const predZ = rp.tz + (rp.tvz || 0) * ageSec;
        const errDist = Math.hypot(predX - rp.x, predY - rp.y, predZ - rp.z);
        if (errDist > 14.0) {
          rp.x = rp.tx; rp.y = rp.ty; rp.z = rp.tz;
        } else {
          const kPos = 1 - Math.exp(-15.5 * dt);
          rp.x += (predX - rp.x) * kPos;
          rp.y += (predY - rp.y) * kPos;
          rp.z += (predZ - rp.z) * kPos;
        }
        if (typeof rp.tYaw === 'number') {
          let dYaw = ((rp.tYaw - (rp.yaw || 0) + Math.PI) % (Math.PI * 2)) - Math.PI;
          if (dYaw < -Math.PI) dYaw += Math.PI * 2;
          rp.yaw = (rp.yaw || 0) + dYaw * (1 - Math.exp(-18.0 * dt));
        }
        if (typeof rp.tPitch === 'number') {
          rp.pitch = (rp.pitch || 0) + (rp.tPitch - (rp.pitch || 0)) * (1 - Math.exp(-18.0 * dt));
        }
      }
      rp.rig.g.position.set(rp.x, rp.y, rp.z);
      rp.rig.g.rotation.y = rp.yaw + Math.PI;
      animatePlayerRig(rp.rig, rp, dt, tNow);

      // Update persistent GPU-composited locator dot every frame with zero DOM thrash
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

      let entry = locatorDotEls.get(pid);
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

