// NUCRAFT Module: src/network/Network.js — WebSocket / PeerJS / MQTT / BroadcastChannel co-op & friend system

  // Cross-Network Internet P2P Multiplayer (PeerJS WebRTC + MQTT WSS Internet Relay + LAN WebSocket + BroadcastChannel)
  let p2pPeer = null, p2pIsHost = false, p2pHostConn = null;
  const p2pClientConns = new Map(); // peerId -> DataConnection
  const P2P_PREFIX = 'luanticraft-v18-room-';
  const P2P_ICE_CFG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ]
  };
  const MQTT_NS = 'nucraft/v89';
  const MQTT_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  let activeCoopTransport = null; // 'host' | 'p2p' | 'mqtt' | 'ws' | 'bc' | null
  let wsSelfPeerId = null;
  let pendingJoinCb = null;
  const mqttRoomPeers = new Set();
  const bcRoomPeers = new Set();
  let mqttRoomTopic = null, mqttRoomUnsub = null, _lastMqttStateAt = 0;

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let _peerJsLoadQueue = null;
  function ensurePeerJsLoaded(cb) {
    if (typeof Peer !== 'undefined') { try { cb(true); } catch (_) {} return; }
    if (_peerJsLoadQueue) { _peerJsLoadQueue.push(cb); return; }
    _peerJsLoadQueue = [cb];
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      const q = _peerJsLoadQueue || [];
      _peerJsLoadQueue = null;
      for (const fn of q) { try { fn(ok); } catch (_) {} }
    };
    const injectFallback = () => {
      if (typeof Peer !== 'undefined') { finish(true); return; }
      if (document.querySelector('script[data-peer-fb="1"]')) return;
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
      s.dataset.peerFb = '1';
      s.onload = () => finish(typeof Peer !== 'undefined');
      s.onerror = () => finish(typeof Peer !== 'undefined');
      document.head.appendChild(s);
    };
    const existing = document.querySelector('script[src*="peerjs"]');
    if (existing) {
      existing.addEventListener('load', () => finish(typeof Peer !== 'undefined'), { once: true });
      existing.addEventListener('error', injectFallback, { once: true });
      setTimeout(() => { if (!settled && typeof Peer === 'undefined') injectFallback(); }, 2500);
    } else {
      injectFallback();
    }
    setTimeout(() => { if (!settled) finish(typeof Peer !== 'undefined'); }, 9000);
  }

  // Zero-dependency MQTT v3.1.1 over WSS relay client (crosses symmetric NAT / 4G / Wi-Fi reliably)
  const ncMqtt = (() => {
    const _te = new TextEncoder(), _td = new TextDecoder();
    const subs = new Map(); // filter -> Set<cb>
    const outbox = []; // { topic, payloadStr, retain }
    let ws = null, ready = false, connecting = false, brokerIdx = 0, retryMs = 1500, pidSeq = 1;
    let pingTimer = null, reconTimer = null, rxBuf = new Uint8Array(0);
    const clientId = 'nc_' + Math.random().toString(36).slice(2, 10) + '_' + (Date.now() & 0xffff).toString(36);

    function encVarLen(n) {
      const out = [];
      do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0);
      return out;
    }
    function encStr(s) {
      const b = _te.encode(s);
      return [(b.length >> 8) & 255, b.length & 255, ...b];
    }
    function pktConnect() {
      const body = [...encStr('MQTT'), 4, 2, 0, 35, ...encStr(clientId)];
      return new Uint8Array([0x10, ...encVarLen(body.length), ...body]);
    }
    function pktSubscribe(pid, topic) {
      const body = [(pid >> 8) & 255, pid & 255, ...encStr(topic), 0];
      return new Uint8Array([0x82, ...encVarLen(body.length), ...body]);
    }
    function pktUnsubscribe(pid, topic) {
      const body = [(pid >> 8) & 255, pid & 255, ...encStr(topic)];
      return new Uint8Array([0xA2, ...encVarLen(body.length), ...body]);
    }
    function pktPublish(topic, payloadStr, retain) {
      const tBytes = _te.encode(topic);
      const pBytes = payloadStr ? _te.encode(payloadStr) : new Uint8Array(0);
      const bodyLen = 2 + tBytes.length + pBytes.length;
      const vh = encVarLen(bodyLen);
      const out = new Uint8Array(1 + vh.length + bodyLen);
      out[0] = retain ? 0x31 : 0x30;
      out.set(vh, 1);
      const off = 1 + vh.length;
      out[off] = (tBytes.length >> 8) & 255;
      out[off + 1] = tBytes.length & 255;
      out.set(tBytes, off + 2);
      if (pBytes.length) out.set(pBytes, off + 2 + tBytes.length);
      return out;
    }
    function topicMatches(filter, topic) {
      if (filter === topic) return true;
      const f = filter.split('/'), t = topic.split('/');
      for (let i = 0; i < f.length; i++) {
        if (f[i] === '#') return true;
        if (i >= t.length) return false;
        if (f[i] !== '+' && f[i] !== t[i]) return false;
      }
      return f.length === t.length;
    }
    function nextPid() { pidSeq = (pidSeq % 65534) + 1; return pidSeq; }
    function clearTimers() {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (reconTimer) { clearTimeout(reconTimer); reconTimer = null; }
    }
    function scheduleReconnect() {
      if (reconTimer || subs.size === 0 && outbox.length === 0) return;
      const wait = retryMs;
      retryMs = Math.min(8000, Math.round(retryMs * 1.5));
      brokerIdx = (brokerIdx + 1) % MQTT_BROKERS.length;
      reconTimer = setTimeout(() => { reconTimer = null; ensureConnected(); }, wait);
    }
    function handleRx(chunk) {
      if (rxBuf.length === 0) rxBuf = chunk;
      else {
        const merged = new Uint8Array(rxBuf.length + chunk.length);
        merged.set(rxBuf, 0); merged.set(chunk, rxBuf.length);
        rxBuf = merged;
      }
      while (rxBuf.length >= 2) {
        let mult = 1, remLen = 0, idx = 1, b = 0, needMore = false;
        do {
          if (idx >= rxBuf.length) { needMore = true; break; }
          b = rxBuf[idx++];
          remLen += (b & 127) * mult;
          mult *= 128;
        } while ((b & 128) !== 0 && mult <= 2097152);
        if (needMore || rxBuf.length < idx + remLen) break;
        const type = rxBuf[0] >> 4, flags = rxBuf[0] & 0x0f;
        const body = rxBuf.subarray(idx, idx + remLen);
        rxBuf = rxBuf.subarray(idx + remLen);
        if (type === 2 && body.length >= 2 && body[1] === 0) {
          ready = true; connecting = false; retryMs = 1500;
          for (const topic of subs.keys()) { try { ws.send(pktSubscribe(nextPid(), topic)); } catch (_) {} }
          while (outbox.length > 0 && ws && ws.readyState === 1) {
            const it = outbox.shift();
            try { ws.send(pktPublish(it.topic, it.payloadStr, it.retain)); } catch (_) { break; }
          }
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (ws && ws.readyState === 1) { try { ws.send(new Uint8Array([0xC0, 0x00])); } catch (_) {} }
          }, 25000);
        } else if (type === 3 && body.length >= 2) {
          const tLen = (body[0] << 8) | body[1];
          if (2 + tLen > body.length) continue;
          const topic = _td.decode(body.subarray(2, 2 + tLen));
          let pOff = 2 + tLen;
          if (((flags >> 1) & 3) > 0) pOff += 2;
          if (pOff >= body.length) continue; // empty retained clear
          let obj = null;
          try { obj = JSON.parse(_td.decode(body.subarray(pOff))); } catch (_) { continue; }
          for (const [filter, set] of subs.entries()) {
            if (!topicMatches(filter, topic)) continue;
            for (const cb of Array.from(set)) { try { cb(obj, topic); } catch (_) {} }
          }
        }
      }
    }
    function ensureConnected() {
      if (ready || connecting || typeof WebSocket === 'undefined') return;
      connecting = true;
      rxBuf = new Uint8Array(0);
      try {
        const sock = new WebSocket(MQTT_BROKERS[brokerIdx % MQTT_BROKERS.length], 'mqtt');
        ws = sock;
        sock.binaryType = 'arraybuffer';
        const openGuard = setTimeout(() => {
          if (sock === ws && !ready) { try { sock.close(); } catch (_) {} }
        }, 6500);
        sock.onopen = () => {
          if (sock !== ws) return;
          try { sock.send(pktConnect()); } catch (_) {}
        };
        sock.onmessage = (ev) => {
          if (sock !== ws || !(ev.data instanceof ArrayBuffer)) return;
          clearTimeout(openGuard);
          handleRx(new Uint8Array(ev.data));
        };
        sock.onerror = () => {
          clearTimeout(openGuard);
          if (sock === ws) { ready = false; connecting = false; }
        };
        sock.onclose = () => {
          clearTimeout(openGuard);
          if (sock === ws) {
            ready = false; connecting = false; ws = null;
            clearTimers();
            scheduleReconnect();
          }
        };
      } catch (_) {
        connecting = false;
        scheduleReconnect();
      }
    }
    function subscribe(topic, cb) {
      let set = subs.get(topic);
      const isNew = !set;
      if (!set) { set = new Set(); subs.set(topic, set); }
      set.add(cb);
      ensureConnected();
      if (isNew && ready && ws && ws.readyState === 1) {
        try { ws.send(pktSubscribe(nextPid(), topic)); } catch (_) {}
      }
      return () => {
        const s = subs.get(topic);
        if (!s) return;
        s.delete(cb);
        if (s.size === 0) {
          subs.delete(topic);
          if (ready && ws && ws.readyState === 1) {
            try { ws.send(pktUnsubscribe(nextPid(), topic)); } catch (_) {}
          }
        }
      };
    }
    function publish(topic, payloadObjOrEmpty, retain = false) {
      const payloadStr = (payloadObjOrEmpty === '' || payloadObjOrEmpty == null)
        ? ''
        : (typeof payloadObjOrEmpty === 'string' ? payloadObjOrEmpty : JSON.stringify(payloadObjOrEmpty));
      ensureConnected();
      if (ready && ws && ws.readyState === 1) {
        try { ws.send(pktPublish(topic, payloadStr, retain)); return true; } catch (_) {}
      }
      if (outbox.length >= 64) outbox.shift();
      outbox.push({ topic, payloadStr, retain });
      return false;
    }
    return { ensureConnected, subscribe, publish, isConnected: () => ready, _encStr: encStr, _pktPub: pktPublish, _topicMatches: topicMatches };
  })();

  function ensureRemotePeer(peerId, name, color = '#38bdf8', isBuddy = false, skinId = null) {
    let rp = remotePlayers.get(peerId);
    if (rp) {
      if (skinId && rp.skinId !== skinId) { rp.skinId = skinId; applySkinToRig(rp.rig, skinId); }
      return rp;
    }
    const skinList = PLAYER_SKINS.map(s => s.id);
    const hashC = peerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const chosenSkin = skinId || skinList[hashC % skinList.length];
    const rig = createPlayerRig(chosenSkin, null, null, name, color);
    rig.g.position.set(player.x + 3, player.y, player.z + 3);
    scene.add(rig.g);
    rp = {
      id: peerId, name: name || 'Bạn Chơi', color, isBuddy, skinId: chosenSkin,
      x: player.x + 3.5, y: player.y, z: player.z + 3.5, tx: player.x + 3.5, ty: player.y, tz: player.z + 3.5,
      yaw: 0, pitch: 0, speed: 0, sprinting: false, sneaking: false, inWater: false, onGround: true, swing: 0,
      wanderT: 2.0, rig
    };
    remotePlayers.set(peerId, rp);
    updateRoomBadgeUI();
    return rp;
  }

  function removeRemotePeer(peerId) {
    const rp = remotePlayers.get(peerId);
    if (rp) {
      scene.remove(rp.rig.g);
      remotePlayers.delete(peerId);
      updateRoomBadgeUI();
    }
    const dotEntry = locatorDotEls.get(peerId);
    if (dotEntry) { dotEntry.el.remove(); locatorDotEls.delete(peerId); }
  }

  function updateRoomBadgeUI() {
    const badge = document.getElementById('roomBadge');
    const menuSt = document.getElementById('menuCoopStatus');
    if (menuSt) {
      if (activeRoomId) menuSt.innerHTML = `Đang mở phòng Internet: <b style="color:#4ade80;">${activeRoomId}</b> (${1 + remotePlayers.size} người chơi) — Gửi mã này cho bạn bè ở bất kỳ mạng Wi-Fi / 4G nào!`;
      else menuSt.textContent = 'Mở phòng để nhận Mã Phòng Internet 6 ký tự và gửi cho bạn bè ở bất kỳ đâu!';
    }
    if (!badge) return;
    const hudEl = document.getElementById('hud');
    if (activeRoomId || remotePlayers.size > 0) {
      badge.classList.add('visible');
      if (hudEl) hudEl.classList.add('has-room-badge');
      document.getElementById('roomCodeHud').textContent = activeRoomId || 'CO-OP BOT';
      document.getElementById('roomPeerCount').textContent = String(1 + remotePlayers.size);
    } else {
      badge.classList.remove('visible');
      if (hudEl) hudEl.classList.remove('has-room-badge');
    }
  }

  let _cancelActiveJoin = null;

  function sendChunkedWelcome(sendFn, extraFields = {}) {
    const allMods = Array.from(worldMods.entries()).slice(-1800);
    const peerSnap = [{
      peerId: localPeerId, name: localPlayerName, color: '#38bdf8',
      skinId: selectedSkinId, equip: player.equip,
      state: { x: player.x, y: player.y, z: player.z }
    }];
    for (const [pid, pr] of remotePlayers.entries()) {
      if (!pr.isBuddy && pid !== extraFields._to) {
        peerSnap.push({ peerId: pid, name: pr.name, color: pr.color, skinId: pr.skinId, state: { x: pr.x, y: pr.y, z: pr.z } });
      }
    }
    sendFn({
      type: 'p2p_welcome',
      ...extraFields,
      roomId: activeRoomId,
      hostId: localPeerId,
      world: currentWorldMeta,
      dayTime,
      mods: allMods.slice(0, 200),
      peers: peerSnap
    });
    for (let i = 200; i < allMods.length; i += 250) {
      sendFn({
        type: 'p2p_mods_chunk',
        ...extraFields,
        mods: allMods.slice(i, i + 250)
      });
    }
  }

  function applyModsChunkList(mods) {
    if (!Array.isArray(mods) || !mods.length) return;
    isApplyingRemoteBlock = true;
    for (const entry of mods) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const k = String(entry[0]), v = Number(entry[1]) || 0;
      worldMods.set(k, v);
      indexWorldModKey(k, v);
      const c1 = k.indexOf(','), c2 = k.indexOf(',', c1 + 1);
      if (c1 >= 0 && c2 >= 0) {
        const mx = parseInt(k.slice(0, c1), 10), my = parseInt(k.slice(c1 + 1, c2), 10), mz = parseInt(k.slice(c2 + 1), 10);
        setBlockWorld(mx, my + (depthOffset || 0), mz, v, false);
      }
    }
    isApplyingRemoteBlock = false;
  }

  function sendCoopMsg(obj) {
    if (!activeRoomId) return;
    if (p2pIsHost) {
      const pkt = { ...obj, _from: localPeerId };
      for (const conn of p2pClientConns.values()) {
        if (conn && conn.open) { try { conn.send(pkt); } catch (_) {} }
      }
      if (mqttRoomTopic && mqttRoomPeers.size > 0) {
        const now = performance.now();
        if (obj.type !== 'state' || now - _lastMqttStateAt >= 95) {
          if (obj.type === 'state') _lastMqttStateAt = now;
          ncMqtt.publish(mqttRoomTopic, pkt);
        }
      }
      if (wsConn && wsConn.readyState === 1 && (obj.type !== 'state' || activeCoopTransport === 'ws' || remotePlayers.size > p2pClientConns.size)) {
        try { wsConn.send(JSON.stringify(obj)); } catch (_) {}
      }
      if (bcChannel && bcRoomPeers.size > 0) {
        try { bcChannel.postMessage({ ...pkt, _room: activeRoomId }); } catch (_) {}
      }
      return;
    }
    const pkt = { ...obj, _from: localPeerId };
    if (activeCoopTransport === 'p2p' && p2pHostConn && p2pHostConn.open) {
      try { p2pHostConn.send(pkt); } catch (_) {}
    } else if (activeCoopTransport === 'mqtt' && mqttRoomTopic) {
      const now = performance.now();
      if (obj.type !== 'state' || now - _lastMqttStateAt >= 95) {
        if (obj.type === 'state') _lastMqttStateAt = now;
        ncMqtt.publish(mqttRoomTopic, pkt);
      }
    } else if (activeCoopTransport === 'ws' && wsConn && wsConn.readyState === 1) {
      try { wsConn.send(JSON.stringify(obj)); } catch (_) {}
    } else if (activeCoopTransport === 'bc' && bcChannel) {
      try { bcChannel.postMessage({ ...pkt, _room: activeRoomId }); } catch (_) {}
    }
  }


  function handleIncomingP2PData(senderId, m, senderConn, viaTransport = 'p2p') {
    if (!m || typeof m !== 'object') return;
    if (m._relayBy && m._relayBy === localPeerId) return;
    const fromId = m._from || senderId;
    if (!fromId || fromId === localPeerId) return;
    if (m._to && m._to !== localPeerId) return;
    if (p2pIsHost) {
      if (m.type === 'state' || m.type === 'block' || m.type === 'chat') {
        const relay = { ...m, _from: fromId, _relayBy: localPeerId };
        for (const [cid, c] of p2pClientConns.entries()) {
          if (cid !== senderId && c && c.open) { try { c.send(relay); } catch (_) {} }
        }
        if (viaTransport !== 'mqtt' && mqttRoomTopic && mqttRoomPeers.size > 0) {
          ncMqtt.publish(mqttRoomTopic, relay);
        }
        if (viaTransport !== 'ws' && m.type === 'block' && wsConn && wsConn.readyState === 1) {
          try { wsConn.send(JSON.stringify(m)); } catch (_) {}
        }
      }
      if (m.type === 'p2p_hello') {
        if (senderConn) senderConn._ncPeerId = fromId;
        const rp = ensureRemotePeer(fromId, m.name || 'Bạn Chơi', '#4ade80', false, m.skinId);
        if (m.equip) applyArmorToPlayerRig(rp.rig, m.equip);
        const hItem = (m.state && m.state.held !== undefined) ? m.state.held : (m.held !== undefined ? m.held : undefined);
        if (hItem !== undefined) setRigHeldItem(rp.rig, hItem);
        if (viaTransport === 'mqtt') {
          mqttRoomPeers.add(fromId);
          sendChunkedWelcome((pkt) => ncMqtt.publish(mqttRoomTopic, { ...pkt, _from: localPeerId }), { _to: fromId });
        } else if (senderConn) {
          sendChunkedWelcome((pkt) => { try { senderConn.send(pkt); } catch (_) {} });
        }
        showToast(`🌐 ${m.name || 'Bạn chơi'} đã kết nối vào phòng ${activeRoomId}!`);
        return;
      }
    }
    if (m.type === 'p2p_welcome') {
      if (pendingJoinCb) {
        pendingJoinCb(viaTransport, m.roomId || activeRoomId, m.world, m.mods || [], m.peers || [], m.dayTime);
      } else {
        activeRoomId = m.roomId || activeRoomId;
        applyJoinedWorld(m.world, m.mods || [], m.peers || [], m.dayTime);
      }
      return;
    }
    if (m.type === 'p2p_mods_chunk') {
      applyModsChunkList(m.mods);
      return;
    }
    if (m.type === 'state' && m.state) {
      const rp = ensureRemotePeer(fromId, m.name || 'Bạn Chơi', '#4ade80', false, m.skinId);
      applyRemotePeerState(rp, m.state, m.equip);
    } else if (m.type === 'block') {
      isApplyingRemoteBlock = true; setBlockWorld(m.x, m.y, m.z, m.id, true); isApplyingRemoteBlock = false;
    } else if (m.type === 'chat' && m.text) {
      appendChatLine(m.name || 'Bạn Chơi', m.text, false);
    } else if (m.type === 'leave') {
      mqttRoomPeers.delete(fromId);
      bcRoomPeers.delete(fromId);
      removeRemotePeer(fromId);
    }
  }

  function destroyP2P() {
    p2pIsHost = false;
    try { if (p2pHostConn) p2pHostConn.close(); } catch (_) {}
    p2pHostConn = null;
    for (const c of p2pClientConns.values()) { try { c.close(); } catch (_) {} }
    p2pClientConns.clear();
    try { if (p2pPeer) p2pPeer.destroy(); } catch (_) {}
    p2pPeer = null;
  }

  function leaveCoopRoom() {
    if (_cancelActiveJoin) { try { _cancelActiveJoin(); } catch (_) {} _cancelActiveJoin = null; }
    pendingJoinCb = null;
    if (activeRoomId) {
      try { sendCoopMsg({ type: 'leave' }); } catch (_) {}
    }
    if (mqttRoomUnsub) { try { mqttRoomUnsub(); } catch (_) {} mqttRoomUnsub = null; }
    mqttRoomTopic = null;
    mqttRoomPeers.clear();
    bcRoomPeers.clear();
    destroyP2P();
    if (wsConn && wsConn.readyState === 1) {
      try { wsConn.send(JSON.stringify({ type: 'leave' })); } catch (_) {}
    }
    activeRoomId = null;
    activeCoopTransport = null;
    for (const [pid, rp] of Array.from(remotePlayers.entries())) {
      if (!rp.isBuddy) removeRemotePeer(pid);
    }
    updateRoomBadgeUI();
  }

  function broadcastBlockMod(wx, wy, wz, id) {
    if (!activeRoomId) return;
    sendCoopMsg({ type: 'block', x: wx, y: wy, z: wz, id });
  }

  function initBroadcastChannelFallback() {
    if (bcChannel || typeof BroadcastChannel === 'undefined') return;
    bcChannel = new BroadcastChannel('luanti_coop_v14');
    bcChannel.onmessage = (ev) => {
      const m = ev.data;
      if (!m || m._from === localPeerId) return;
      if (m.type === 'bc_join_req' && p2pIsHost && activeRoomId && m.roomId === activeRoomId) {
        bcRoomPeers.add(m._from);
        const modsArr = Array.from(worldMods.entries()).slice(-1500);
        bcChannel.postMessage({
          type: 'bc_join_ack', _from: localPeerId, _room: activeRoomId, target: m._from,
          world: currentWorldMeta, dayTime, mods: modsArr, hostName: localPlayerName,
          hostSkinId: selectedSkinId, hostState: { x: player.x, y: player.y, z: player.z }
        });
        ensureRemotePeer(m._from, m.name, '#4ade80');
        showToast(`👥 ${m.name} đã vào phòng ${activeRoomId}!`);
      } else if (m.type === 'bc_join_ack' && m.target === localPeerId) {
        const peers = [{ peerId: m._from, name: m.hostName, color: '#38bdf8', skinId: m.hostSkinId, state: m.hostState }];
        if (pendingJoinCb) {
          pendingJoinCb('bc', m._room, m.world, m.mods || [], peers, m.dayTime);
        } else {
          activeRoomId = m._room;
          activeCoopTransport = 'bc';
          applyJoinedWorld(m.world, m.mods || [], peers, m.dayTime);
        }
      } else if (activeRoomId && m._room === activeRoomId) {
        if (!p2pIsHost && activeCoopTransport !== 'bc') return;
        if (m.type === 'state' && m.state) {
          const rp = ensureRemotePeer(m._from, m.name || 'Bạn Chơi', '#4ade80', false, m.skinId);
          applyRemotePeerState(rp, m.state, m.equip);
        } else if (m.type === 'block') {
          isApplyingRemoteBlock = true; setBlockWorld(m.x, m.y, m.z, m.id, true); isApplyingRemoteBlock = false;
        } else if (m.type === 'chat' && m.text) {
          appendChatLine(m.name || 'Bạn Chơi', m.text, false);
        } else if (m.type === 'leave') {
          bcRoomPeers.delete(m._from);
          removeRemotePeer(m._from);
        }
      }
    };
  }

  function applyJoinedWorld(w, mods, peers, srvDayTime) {
    w = w || {};
    isWorldLoading = false;
    window._optionsOpenedFromLobby = false;
    if (typeof closeLobbySub === 'function') closeLobbySub();
    document.getElementById('lobbyScreen')?.classList.add('hidden');
    document.body.classList.remove('in-lobby');
    showWorldLoadingOverlay(
      'Đang vào phòng Co-op...',
      `Đang tải khu vực thế giới "${w.worldName || w.name || 'Phòng Co-op'}"...`,
      () => {
        currentWorldMeta = { id: 'coop_' + activeRoomId, name: w.worldName || w.name || 'Phòng Co-op', seed: w.seed || 133742, mode: w.mode || 'survival', biome: w.biome || 'sakura', preset: w.preset || 'bsl' };
        gameMode = currentWorldMeta.mode;
        resetWorld(currentWorldMeta.seed);
        _clearWorldInteractiveCaches(false);
        if (Array.isArray(mods)) for (const [k, v] of mods) { worldMods.set(k, v); indexWorldModKey(k, v); }
        const dtVal = (typeof srvDayTime === 'number') ? srvDayTime : w.dayTime;
        if (typeof dtVal === 'number') dayTime = dtVal;
        if (Array.isArray(peers) && peers[0] && peers[0].state && Number.isFinite(peers[0].state.x) && Number.isFinite(peers[0].state.z)) {
          const gx = peers[0].state.x + 2.2, gz = peers[0].state.z + 2.2;
          const gy = Math.max(Number(peers[0].state.y) || 0, colGroundY(Math.floor(gx), Math.floor(gz)) + 1.05);
          player.x = gx; player.y = gy; player.z = gz;
          player.vx = player.vy = player.vz = 0;
          player.fallStartY = gy;
        }
        for (const rp of Array.from(remotePlayers.keys())) removeRemotePeer(rp);
        if (Array.isArray(peers)) {
          for (const p of peers) {
            if (!p || p.peerId === localPeerId) continue;
            const rp = ensureRemotePeer(p.peerId, p.name, p.color || '#38bdf8', false, p.skinId || null);
            if (p.equip) applyArmorToPlayerRig(rp.rig, p.equip);
            if (p.state) { rp.x = rp.tx = p.state.x; rp.y = rp.ty = p.state.y; rp.z = rp.tz = p.state.z; }
          }
        }
        applyShaderPreset(currentWorldMeta.preset);
        updateRoomBadgeUI();
        showToast(`🌐 Đã vào phòng ${activeRoomId} thành công!`);
      }
    );
  }

  function connectCoopSocket(onReady) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      initBroadcastChannelFallback();
      const stEl = document.getElementById('coopServerStatus');
      if (stEl && !activeRoomId) stEl.innerHTML = '🌐 Chế độ Internet Relay & Tab: <b style="color:#4ade80;">Sẵn sàng kết nối qua Internet ✓</b>';
      if (onReady) onReady(false);
      return;
    }
    if (/[?&]standalone=1\b/.test(location.search || '') || /\.github\.io$/i.test(location.hostname || '')) {
      initBroadcastChannelFallback();
      const stEl = document.getElementById('coopServerStatus');
      if (stEl && !activeRoomId) stEl.innerHTML = '🌐 Chế độ Internet Relay (P2P &amp; MQTT): <b style="color:#4ade80;">Sẵn sàng kết nối xuyên mạng Wi-Fi / 4G ✓</b>';
      if (onReady) onReady(false);
      return;
    }
    if (wsConn && wsConn.readyState === 1) { if (onReady) onReady(true); return; }
    try {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsConn = new WebSocket(`${wsProto}//${location.host}/ws`);
      wsConn.onopen = () => {
        const stEl = document.getElementById('coopServerStatus');
        if (stEl && !activeRoomId) stEl.innerHTML = `🔌 Máy chủ Co-op LAN &amp; Internet: <b style="color:#4ade80;">Đã kết nối (${escHtml(location.host)}) ✓</b>`;
        wsConn.send(JSON.stringify({ type: 'list_rooms' }));
        const uid = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || '';
        if (uid) wsConn.send(JSON.stringify({ type: 'register_uid', uid }));
        if (onReady) onReady(true);
      };
      wsConn.onerror = () => {
        initBroadcastChannelFallback();
        const stEl = document.getElementById('coopServerStatus');
        if (stEl && !activeRoomId) stEl.innerHTML = '🌐 Chế độ Internet Relay: <b style="color:#4ade80;">Sẵn sàng kết nối xuyên mạng Wi-Fi / 4G ✓</b>';
        if (onReady) onReady(false);
      };
      wsConn.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
        if (msg.type === 'room_joined') {
          wsSelfPeerId = msg.peerId;
          if (!msg.isHost) {
            if (pendingJoinCb) {
              pendingJoinCb('ws', msg.roomId, msg.world, msg.mods, msg.peers, msg.world && msg.world.dayTime);
            } else {
              activeRoomId = msg.roomId;
              activeCoopTransport = 'ws';
              applyJoinedWorld(msg.world, msg.mods, msg.peers, msg.world && msg.world.dayTime);
            }
          } else {
            if (!activeRoomId) activeRoomId = msg.roomId;
            updateRoomBadgeUI();
          }
        } else if (msg.type === 'peer_join') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) {
            ensureRemotePeer(msg.peerId, msg.name, msg.color || '#f472b6', false, msg.skinId || null);
            showToast(`👥 ${msg.name} đã tham gia phòng ${activeRoomId}!`);
          }
        } else if (msg.type === 'peer_leave') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) {
            removeRemotePeer(msg.peerId);
            showToast(`👋 ${msg.name || 'Người chơi'} đã rời phòng.`);
          }
        } else if (msg.type === 'peer_state' && msg.state) {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId === wsSelfPeerId || msg.peerId === localPeerId) return;
          const rp = ensureRemotePeer(msg.peerId, msg.name, msg.color || '#f472b6', false, msg.skinId || null);
          applyRemotePeerState(rp, msg.state, msg.equip);
          if (p2pIsHost) {
            const relay = { type: 'state', _from: msg.peerId, _relayBy: localPeerId, name: msg.name, skinId: msg.skinId || null, equip: msg.equip || null, state: msg.state };
            for (const c of p2pClientConns.values()) if (c && c.open) { try { c.send(relay); } catch (_) {} }
            if (mqttRoomTopic && mqttRoomPeers.size > 0) ncMqtt.publish(mqttRoomTopic, relay);
          }
        } else if (msg.type === 'block') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId === wsSelfPeerId || msg.peerId === localPeerId) return;
          isApplyingRemoteBlock = true; setBlockWorld(msg.x, msg.y, msg.z, msg.id, true); isApplyingRemoteBlock = false;
          if (p2pIsHost) {
            const relay = { type: 'block', _from: msg.peerId, _relayBy: localPeerId, x: msg.x, y: msg.y, z: msg.z, id: msg.id };
            for (const c of p2pClientConns.values()) if (c && c.open) { try { c.send(relay); } catch (_) {} }
            if (mqttRoomTopic && mqttRoomPeers.size > 0) ncMqtt.publish(mqttRoomTopic, relay);
          }
        } else if (msg.type === 'chat' && msg.text) {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) appendChatLine(msg.name || 'Bạn Chơi', msg.text, false);
        } else if (msg.type === 'rooms_list') {
          renderOpenRoomsList(msg.rooms || []);
        } else if (msg.type === 'friend_packet' && msg.payload) {
          if (typeof handleIncomingFriendPacket === 'function') handleIncomingFriendPacket(msg.payload);
        } else if (msg.type === 'error') {
          if (pendingJoinCb) {
            if (typeof window._triggerRemoteJoinNow === 'function') window._triggerRemoteJoinNow();
          } else {
            showToast(`⚠️ ${msg.message}`);
          }
        }
      };
    } catch (_) {
      initBroadcastChannelFallback();
      if (onReady) onReady(false);
    }
  }

  function renderOpenRoomsList(list) {
    const box = document.getElementById('openRoomsList');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = 'Chưa có phòng nào — bấm "Tạo Phòng Mới" để lấy Mã Phòng chia sẻ cho bạn bè!';
      return;
    }
    box.innerHTML = '';
    for (const r of list) {
      const row = document.createElement('div');
      row.className = 'world-item';
      row.innerHTML = `<div class="world-meta"><b>Phòng ${escHtml(r.roomId)} — ${escHtml(r.worldName)}</b><small>${Number(r.players) || 1} người chơi • ${r.mode === 'creative' ? 'Sáng Tạo' : 'Sinh Tồn'}</small></div>`;
      const btn = document.createElement('button');
      btn.className = 'mc-btn mc-btn-green'; btn.textContent = 'VÀO NGAY';
      btn.addEventListener('click', () => {
        document.getElementById('inpJoinRoomId').value = r.roomId;
        joinCoopRoomById(r.roomId);
      });
      row.appendChild(btn);
      box.appendChild(row);
    }
  }

  function hostCoopRoom() {
    leaveCoopRoom();
    initBroadcastChannelFallback();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'LC';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    activeRoomId = id;
    p2pIsHost = true;
    activeCoopTransport = 'host';
    updateRoomBadgeUI();
    const stEl = document.getElementById('coopServerStatus');
    if (stEl) stEl.innerHTML = `🌐 Đã mở Phòng Co-op: <b style="color:#4ade80;">${escHtml(id)}</b> — Bạn bè nhập mã này để vào ngay!`;

    // 1) Internet WSS MQTT Relay (works reliably across symmetric NAT / 4G / Wi-Fi)
    mqttRoomTopic = `${MQTT_NS}/room/${id}`;
    mqttRoomUnsub = ncMqtt.subscribe(mqttRoomTopic, (m) => {
      if (!m || m._from === localPeerId || m._relayBy === localPeerId) return;
      handleIncomingP2PData(m._from, m, null, 'mqtt');
    });

    // 2) WebRTC P2P via PeerJS (loaded safely even if async defer wasn't ready yet)
    ensurePeerJsLoaded((ok) => {
      if (!ok || !p2pIsHost || activeRoomId !== id) return;
      try {
        p2pPeer = new Peer(P2P_PREFIX + id, { config: P2P_ICE_CFG });
        p2pPeer.on('open', () => {
          if (stEl && activeRoomId === id) stEl.innerHTML = `🌐 Đã mở Phòng Internet P2P &amp; Relay: <b style="color:#4ade80;">${escHtml(id)}</b> — Bạn bè ở bất kỳ đâu đều vào được!`;
          updateRoomBadgeUI();
          showToast(`🌐 Đã mở Phòng Online toàn cầu • Mã Phòng: ${id} (Bấm góc trái để chép)`);
        });
        p2pPeer.on('disconnected', () => {
          if (p2pPeer && !p2pPeer.destroyed && p2pIsHost && activeRoomId === id) {
            try { p2pPeer.reconnect(); } catch (_) {}
          }
        });
        p2pPeer.on('connection', (conn) => {
          p2pClientConns.set(conn.peer, conn);
          conn.on('data', (d) => handleIncomingP2PData(conn.peer, d, conn, 'p2p'));
          conn.on('close', () => {
            p2pClientConns.delete(conn.peer);
            removeRemotePeer(conn._ncPeerId || conn.peer);
          });
          conn.on('error', () => { p2pClientConns.delete(conn.peer); });
        });
        p2pPeer.on('error', () => {
          showToast(`🌐 Đã mở Phòng Relay/LAN • Mã Phòng: ${id}`);
        });
      } catch (_) {}
    });

    // 3) LAN WebSocket on server.js (pass exact same roomId + unified clientId!)
    connectCoopSocket((online) => {
      if (online && wsConn && wsConn.readyState === 1 && activeRoomId === id && p2pIsHost) {
        wsConn.send(JSON.stringify({
          type: 'create_room', roomId: id, clientId: localPeerId, name: localPlayerName, skinId: selectedSkinId,
          seed: worldSeed, worldName: currentWorldMeta.name, mode: gameMode, biome: currentWorldMeta.biome,
          preset: shaderPreset, dayTime, state: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch },
          mods: Array.from(worldMods.entries()).slice(-2500)
        }));
      }
    });
  }

  function joinCoopRoomById(code) {
    const roomId = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const inpEl = document.getElementById('inpJoinRoomId');
    if (inpEl) inpEl.blur();
    const stEl = document.getElementById('coopServerStatus');
    const fbEl = document.getElementById('joinRoomFeedback');
    const setCoopStatus = (msgHtml, cls = 'wait') => {
      if (stEl) stEl.innerHTML = msgHtml;
      if (fbEl) {
        fbEl.innerHTML = msgHtml;
        fbEl.className = 'join-feedback-box visible ' + cls;
      }
    };
    if (!roomId) {
      setCoopStatus('⚠️ Hãy nhập <b>Mã Phòng</b> (VD: LC842B) trước khi bấm Vào Phòng!', 'err');
      return;
    }
    const lockedUid = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || '';
    localPlayerName = lockedUid || (document.getElementById('inpCoopName').value || 'BạnChơi').trim().slice(0, 18) || 'BạnChơi';
    leaveCoopRoom();
    initBroadcastChannelFallback();
    setCoopStatus(`⏳ Đang kết nối tới phòng <b>${escHtml(roomId)}</b> qua Internet &amp; LAN... Vui lòng chờ!`, 'wait');

    let joinedOk = false, closedOut = false, remoteStarted = false;
    let joinTimer = null, helloTimer = null, p2pRetryTimer = null, remoteDelayTimer = null;
    let guestMqttUnsub = null;
    const topic = `${MQTT_NS}/room/${roomId}`;

    const cleanupTimers = () => {
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null; }
      if (p2pRetryTimer) { clearTimeout(p2pRetryTimer); p2pRetryTimer = null; }
      if (remoteDelayTimer) { clearTimeout(remoteDelayTimer); remoteDelayTimer = null; }
      window._triggerRemoteJoinNow = null;
    };
    _cancelActiveJoin = () => {
      closedOut = true;
      cleanupTimers();
      if (guestMqttUnsub) { try { guestMqttUnsub(); } catch (_) {} guestMqttUnsub = null; }
    };

    const completeJoinOnce = (transport, rId, world, mods, peers, srvDayTime) => {
      if (joinedOk || closedOut) return;
      joinedOk = true;
      _cancelActiveJoin = null;
      pendingJoinCb = null;
      cleanupTimers();
      if (transport !== 'mqtt' && guestMqttUnsub) {
        try { guestMqttUnsub(); } catch (_) {}
        guestMqttUnsub = null;
        mqttRoomUnsub = null;
        mqttRoomTopic = null;
      } else if (transport === 'mqtt') {
        mqttRoomUnsub = guestMqttUnsub;
        mqttRoomTopic = topic;
      }
      if (transport !== 'p2p') destroyP2P();
      if (transport !== 'ws' && wsConn && wsConn.readyState === 1) {
        try { wsConn.send(JSON.stringify({ type: 'leave' })); } catch (_) {}
      }
      activeRoomId = rId || roomId;
      activeCoopTransport = transport;
      setCoopStatus(`✅ Đã kết nối phòng <b>${escHtml(activeRoomId)}</b>!`, 'ok');
      applyJoinedWorld(world, mods, peers, srvDayTime);
    };
    pendingJoinCb = completeJoinOnce;

    joinTimer = setTimeout(() => {
      if (joinedOk || closedOut) return;
      closedOut = true;
      pendingJoinCb = null;
      _cancelActiveJoin = null;
      cleanupTimers();
      if (guestMqttUnsub) { try { guestMqttUnsub(); } catch (_) {} guestMqttUnsub = null; }
      mqttRoomTopic = null;
      destroyP2P();
      setCoopStatus(`❌ Không tìm thấy phòng <b>${escHtml(roomId)}</b> hoặc chủ phòng đã thoát. Hãy kiểm tra lại mã phòng (phải mở phòng trước) rồi thử lại!`, 'err');
    }, 15000);

    const startRemoteTransports = () => {
      if (remoteStarted || joinedOk || closedOut) return;
      remoteStarted = true;
      if (remoteDelayTimer) { clearTimeout(remoteDelayTimer); remoteDelayTimer = null; }
      window._triggerRemoteJoinNow = null;

      // 1) Internet WSS MQTT Relay
      guestMqttUnsub = ncMqtt.subscribe(topic, (m) => {
        if (!m || m._from === localPeerId || m._relayBy === localPeerId) return;
        if (m._to && m._to !== localPeerId) return;
        if (m.type === 'p2p_welcome') {
          completeJoinOnce('mqtt', m.roomId || roomId, m.world, m.mods || [], m.peers || [], m.dayTime);
          return;
        }
        if (joinedOk && activeCoopTransport === 'mqtt') handleIncomingP2PData(m._from, m, null, 'mqtt');
      });
      const sendMqttHello = () => {
        if (joinedOk || closedOut) return;
        const curS = inventory[player.selectedSlot];
        ncMqtt.publish(topic, {
          type: 'p2p_hello', _from: localPeerId, name: localPlayerName,
          skinId: selectedSkinId, equip: player.equip,
          held: (curS && curS.count > 0) ? curS.id : 0
        });
      };
      sendMqttHello();
      if (helloTimer) clearInterval(helloTimer);
      helloTimer = setInterval(sendMqttHello, 2500);

      // 2) WebRTC P2P via PeerJS
      ensurePeerJsLoaded((ok) => {
        if (!ok || joinedOk || closedOut) return;
        try {
          p2pPeer = new Peer({ config: P2P_ICE_CFG });
          p2pPeer.on('open', () => {
            if (joinedOk || closedOut) return;
            const attemptConnect = (retryLeft) => {
              if (joinedOk || closedOut || !p2pPeer || p2pPeer.destroyed) return;
              if (p2pHostConn) { try { p2pHostConn.close(); } catch (_) {} }
              const conn = p2pPeer.connect(P2P_PREFIX + roomId, { reliable: true, serialization: 'json' });
              p2pHostConn = conn;
              let opened = false;
              if (p2pRetryTimer) clearTimeout(p2pRetryTimer);
              p2pRetryTimer = setTimeout(() => {
                if (!opened && !joinedOk && !closedOut && retryLeft > 0) attemptConnect(retryLeft - 1);
              }, 5500);
              conn.on('open', () => {
                opened = true;
                if (p2pRetryTimer) { clearTimeout(p2pRetryTimer); p2pRetryTimer = null; }
                if (joinedOk || closedOut) { try { conn.close(); } catch (_) {} return; }
                setCoopStatus(`🤝 Đã nối tới phòng <b>${escHtml(roomId)}</b>, đang tải dữ liệu thế giới...`, 'ok');
                const curS = inventory[player.selectedSlot];
                conn.send({
                  type: 'p2p_hello', _from: localPeerId, name: localPlayerName,
                  skinId: selectedSkinId, equip: player.equip,
                  held: (curS && curS.count > 0) ? curS.id : 0
                });
              });
              conn.on('data', (d) => {
                if (d && d.type === 'p2p_welcome') {
                  completeJoinOnce('p2p', d.roomId || roomId, d.world, d.mods || [], d.peers || [], d.dayTime);
                  return;
                }
                if (joinedOk && activeCoopTransport === 'p2p') handleIncomingP2PData(conn.peer, d, conn, 'p2p');
              });
              conn.on('close', () => {
                if (joinedOk && activeCoopTransport === 'p2p' && conn === p2pHostConn) {
                  activeRoomId = null;
                  activeCoopTransport = null;
                  updateRoomBadgeUI();
                }
              });
            };
            attemptConnect(1);
          });
          p2pPeer.on('error', () => {
            // Do not abort prematurely: MQTT Relay / WS / BroadcastChannel continue connecting in parallel
          });
        } catch (_) {}
      });
    };

    // 3) Same-Browser BroadcastChannel & 4) LAN WebSocket (server.js) — prefer fast local WS before MQTT/P2P
    if (bcChannel) bcChannel.postMessage({ type: 'bc_join_req', _from: localPeerId, roomId, name: localPlayerName });
    if (wsConn && wsConn.readyState === 1) {
      window._triggerRemoteJoinNow = startRemoteTransports;
      remoteDelayTimer = setTimeout(startRemoteTransports, 180);
    } else {
      startRemoteTransports();
    }
    connectCoopSocket((online) => {
      if (online && !joinedOk && !closedOut && wsConn && wsConn.readyState === 1) {
        wsConn.send(JSON.stringify({ type: 'join_room', roomId, clientId: localPeerId, name: localPlayerName, skinId: selectedSkinId }));
      } else if (!online && !remoteStarted) {
        startRemoteTransports();
      }
    });
  }


  /* ============================================================================
   * v45: HỆ THỐNG HỒ SƠ UID CỐ ĐỊNH 1 LẦN, BẠN BÈ, THẾ GIỚI BẠN BÈ & MÀN HÌNH TẢI MAP
   * ============================================================================ */
  const UID_STORAGE_KEY = 'nucraft_locked_uid_v1';
  const FRIENDS_STORAGE_KEY = 'nucraft_friends_list_v1';
  const FRIEND_REQS_KEY = 'nucraft_friend_reqs_v1';
  const OUTGOING_REQS_KEY = 'nucraft_outgoing_friend_reqs_v1';
  const FRIEND_PEER_PREFIX = 'nucraft-uid-v45-';

  let shareWithFriendsEnabled = true;
  let friendNetworkPeer = null;
  let friendBc = null;
  let _friendMqttKey = null;
  let _friendMqttUnsubs = [];
  let _bannerDismissedUidKey = null;
  const friendOnlineStatus = new Map();
  const selectedInviteFriends = new Set();

  function sanitizeUidForPeer(uid) {
    return String(uid || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 18);
  }
  function getLockedPlayerUid() {
    try { return (localStorage.getItem(UID_STORAGE_KEY) || '').trim(); } catch (_) { return ''; }
  }
  function setLockedPlayerUidOnce(rawUid) {
    const existing = getLockedPlayerUid();
    if (existing) return { ok: false, reason: 'Tên UID đã được khóa vĩnh viễn và không thể thay đổi!' };
    const clean = String(rawUid || '').trim();
    if (clean.length < 3 || clean.length > 18) {
      return { ok: false, reason: 'Tên UID phải dài từ 3 đến 18 ký tự!' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return { ok: false, reason: 'Tên UID chỉ gồm chữ không dấu, số và dấu gạch dưới (_).' };
    }
    try { localStorage.setItem(UID_STORAGE_KEY, clean); } catch (_) {}
    localPlayerName = clean;
    syncPlayerUidUI();
    initFriendNetworkPeer();
    return { ok: true, uid: clean };
  }
  function isShareWithFriendsEnabled() { return !!shareWithFriendsEnabled; }

  function loadFriendsList() {
    try {
      const arr = JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveFriendsList(arr) {
    try { localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function loadIncomingFriendReqs() {
    try {
      const arr = JSON.parse(localStorage.getItem(FRIEND_REQS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveIncomingFriendReqs(arr) {
    try { localStorage.setItem(FRIEND_REQS_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function loadOutgoingFriendReqs() {
    try {
      const arr = JSON.parse(localStorage.getItem(OUTGOING_REQS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveOutgoingFriendReqs(arr) {
    try { localStorage.setItem(OUTGOING_REQS_KEY, JSON.stringify(arr)); } catch (_) {}
  }

  function syncPlayerUidUI() {
    const uid = getLockedPlayerUid();
    if (uid) localPlayerName = uid;
    const dispName = uid || localPlayerName || 'Người chơi';
    const tName = document.getElementById('titleSkinName');
    if (tName) tName.textContent = dispName;
    const pName = document.getElementById('pausePlayerName');
    if (pName) pName.textContent = dispName;
    const inpP = document.getElementById('inpPlayerName');
    if (inpP && uid) { inpP.value = uid; inpP.disabled = true; }
    const inpC = document.getElementById('inpCoopName');
    if (inpC && uid) { inpC.value = uid; inpC.disabled = true; }

    const friends = loadFriendsList();
    const reqs = loadIncomingFriendReqs();
    let onlineCnt = 0;
    const now = Date.now();
    for (const f of friends) {
      const st = friendOnlineStatus.get(sanitizeUidForPeer(f.uid));
      if (st && st.online && (now - st.lastSeen < 45000)) onlineCnt++;
    }
    const badgeCount = onlineCnt + reqs.length;
    const lblTitle = document.getElementById('lblTitleFriends');
    if (lblTitle) lblTitle.textContent = `Bạn bè (${badgeCount})`;
    const lblSub = document.getElementById('lblSubFriends');
    if (lblSub) lblSub.textContent = `Bạn bè (${badgeCount})`;
    const dotTitle = document.getElementById('titleFriendsDot');
    if (dotTitle) {
      dotTitle.textContent = reqs.length > 9 ? '9+' : (reqs.length > 0 ? String(reqs.length) : '');
      dotTitle.style.display = reqs.length > 0 ? 'inline-flex' : 'none';
    }
    const dotSub = document.getElementById('subFriendsDot');
    if (dotSub) dotSub.style.display = reqs.length > 0 ? 'inline-block' : 'none';
    const coopBadge = document.getElementById('coopFriendsReqBadge');
    if (coopBadge) coopBadge.textContent = String(reqs.length);
  }

  function openProfileModal() {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    const uid = getLockedPlayerUid();
    const inp = document.getElementById('inpProfileUid');
    const st = document.getElementById('profileUidStatus');
    const btnSave = document.getElementById('btnSaveProfileUid');
    if (uid) {
      if (st) st.textContent = `UID vĩnh viễn của bạn đã được khóa: ${uid}`;
      if (inp) { inp.value = uid; inp.disabled = true; }
      if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Đã khóa UID'; btnSave.style.opacity = '0.55'; }
    } else {
      if (st) st.textContent = 'Đặt tên UID của bạn (chỉ nhập 1 lần duy nhất, không thể thay đổi sau khi lưu):';
      if (inp) { inp.value = ''; inp.disabled = false; setTimeout(() => inp.focus(), 60); }
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Lưu UID cố định'; btnSave.style.opacity = '1'; }
    }
    modal.classList.remove('hidden');
  }
  function closeProfileModal() {
    document.getElementById('profileModal')?.classList.add('hidden');
  }

  function getMySharedWorldPayload() {
    if (document.body.classList.contains('in-lobby') || isWorldLoading || !currentWorldMeta || !currentWorldMeta.shareWithFriends || !activeRoomId) return null;
    return {
      roomId: activeRoomId,
      name: currentWorldMeta.name || 'Thế Giới Mới',
      hostUid: getLockedPlayerUid() || localPlayerName || 'Người chơi',
      mode: gameMode === 'creative' ? 'Sáng tạo' : 'Sinh tồn',
      biome: currentWorldMeta.biome || 'sakura',
      players: 1 + remotePlayers.size,
      maxPlayers: 5,
      updatedAt: Date.now()
    };
  }

  function sendFriendPacketToUid(targetUid, payload) {
    const key = sanitizeUidForPeer(targetUid);
    if (!key) return;
    const myKey = sanitizeUidForPeer(payload && payload.fromUid ? payload.fromUid : getLockedPlayerUid());
    try {
      if (friendBc) friendBc.postMessage({ ...payload, toKey: key });
    } catch (_) {}
    if (wsConn && wsConn.readyState === 1) {
      try { wsConn.send(JSON.stringify({ type: 'friend_packet', targetKey: key, payload })); } catch (_) {}
    }
    if (payload && payload.type === 'friend_req' && myKey) {
      ncMqtt.publish(`${MQTT_NS}/friend/${key}/req/${myKey}`, { ...payload, toKey: key }, true);
    } else if (payload && payload.type === 'friend_accept' && myKey) {
      ncMqtt.publish(`${MQTT_NS}/friend/${key}/acc/${myKey}`, { ...payload, toKey: key }, true);
    } else {
      ncMqtt.publish(`${MQTT_NS}/friend/${key}/msg`, { ...payload, toKey: key }, false);
    }
    if (friendNetworkPeer && !friendNetworkPeer.destroyed) {
      if (friendNetworkPeer.disconnected) { try { friendNetworkPeer.reconnect(); } catch (_) {} }
      try {
        const conn = friendNetworkPeer.connect(FRIEND_PEER_PREFIX + key, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          try { conn.send(payload); } catch (_) {}
          setTimeout(() => { try { conn.close(); } catch (_) {} }, 1200);
        });
      } catch (_) {}
    }
  }

  function showFriendReqBanner(fromUid) {
    if (fromUid) {
      const k = sanitizeUidForPeer(fromUid);
      if (_bannerDismissedUidKey && _bannerDismissedUidKey === k) _bannerDismissedUidKey = null;
    }
    refreshFriendReqBanner();
  }

  function refreshFriendReqBanner() {
    const banner = document.getElementById('friendReqBanner');
    const lbl = document.getElementById('frbFromUid');
    if (!banner || !lbl) return;
    const reqs = loadIncomingFriendReqs();
    const pending = reqs.find(r => sanitizeUidForPeer(r.uid) !== _bannerDismissedUidKey);
    if (!pending) {
      banner.classList.add('hidden');
      delete banner.dataset.reqUid;
      return;
    }
    lbl.textContent = pending.uid;
    banner.dataset.reqUid = pending.uid;
    banner.classList.remove('hidden');
  }

  function acceptIncomingFriendReq(uid) {
    const cleanUid = String(uid || '').trim();
    const rKey = sanitizeUidForPeer(cleanUid);
    if (!rKey) return false;
    const myUid = getLockedPlayerUid();
    if (!myUid) { openProfileModal(); return false; }
    const myKey = sanitizeUidForPeer(myUid);
    const friends = loadFriendsList();
    if (!friends.some(f => sanitizeUidForPeer(f.uid) === rKey)) {
      friends.push({ uid: cleanUid, addedAt: Date.now() });
      saveFriendsList(friends);
    }
    saveIncomingFriendReqs(loadIncomingFriendReqs().filter(x => sanitizeUidForPeer(x.uid) !== rKey));
    saveOutgoingFriendReqs(loadOutgoingFriendReqs().filter(x => sanitizeUidForPeer(x.uid) !== rKey));
    if (myKey) ncMqtt.publish(`${MQTT_NS}/friend/${myKey}/req/${rKey}`, '', true);
    sendFriendPacketToUid(cleanUid, { type: 'friend_accept', fromUid: myUid, world: getMySharedWorldPayload() });
    if (_bannerDismissedUidKey === rKey) _bannerDismissedUidKey = null;
    syncPlayerUidUI();
    renderIncomingFriendReqs();
    renderFriendsModalLists();
    renderFriendWorldsList();
    refreshFriendReqBanner();
    const fb = document.getElementById('addFriendFeedback');
    if (fb) {
      fb.className = 'ore-friend-fb visible';
      fb.innerHTML = `✅ Đã kết bạn với <b>${escHtml(cleanUid)}</b>!`;
    }
    showToast(`🎉 Đã kết bạn với ${cleanUid}! Giờ hai bạn có thể thấy thế giới của nhau.`);
    return true;
  }

  function declineIncomingFriendReq(uid) {
    const rKey = sanitizeUidForPeer(uid);
    if (!rKey) return false;
    const myKey = sanitizeUidForPeer(getLockedPlayerUid());
    saveIncomingFriendReqs(loadIncomingFriendReqs().filter(x => sanitizeUidForPeer(x.uid) !== rKey));
    if (myKey) ncMqtt.publish(`${MQTT_NS}/friend/${myKey}/req/${rKey}`, '', true);
    if (_bannerDismissedUidKey === rKey) _bannerDismissedUidKey = null;
    syncPlayerUidUI();
    renderIncomingFriendReqs();
    refreshFriendReqBanner();
    return true;
  }

  function handleIncomingFriendPacket(pkt) {
    if (!pkt || !pkt.type) return;
    const myUid = getLockedPlayerUid();
    const myKey = sanitizeUidForPeer(myUid);
    if (pkt.toKey && myKey && pkt.toKey !== myKey) return;
    const fromUid = String(pkt.fromUid || '').trim();
    const fromKey = sanitizeUidForPeer(fromUid);
    if (!fromKey || fromKey === myKey) return;

    if (pkt.type === 'friend_ping') {
      if (!myUid) return;
      sendFriendPacketToUid(fromUid, {
        type: 'friend_pong',
        fromUid: myUid,
        world: getMySharedWorldPayload()
      });
    } else if (pkt.type === 'friend_pong' || pkt.type === 'friend_world_status') {
      friendOnlineStatus.set(fromKey, {
        uid: fromUid,
        online: true,
        lastSeen: Date.now(),
        world: pkt.world || null
      });
      syncPlayerUidUI();
      renderFriendsModalLists();
      renderFriendWorldsList();
      if (pkt.type === 'friend_pong' && window._pendingFriendSearchKey === fromKey) {
        renderFriendSearchResult(fromUid, true);
      }
    } else if (pkt.type === 'friend_req') {
      const friends = loadFriendsList();
      if (friends.some(f => sanitizeUidForPeer(f.uid) === fromKey)) {
        if (myKey) ncMqtt.publish(`${MQTT_NS}/friend/${myKey}/req/${fromKey}`, '', true);
        if (myUid) sendFriendPacketToUid(fromUid, { type: 'friend_accept', fromUid: myUid, world: getMySharedWorldPayload() });
        return;
      }
      const reqs = loadIncomingFriendReqs();
      if (!reqs.some(r => sanitizeUidForPeer(r.uid) === fromKey)) {
        reqs.unshift({ uid: fromUid, ts: Date.now() });
        saveIncomingFriendReqs(reqs);
        syncPlayerUidUI();
        renderIncomingFriendReqs();
        showFriendReqBanner(fromUid);
        showToast(`👥 ${fromUid} đã gửi lời mời kết bạn! Bấm "Đồng ý" để kết bạn.`);
      }
    } else if (pkt.type === 'friend_accept') {
      const friends = loadFriendsList();
      if (!friends.some(f => sanitizeUidForPeer(f.uid) === fromKey)) {
        friends.push({ uid: fromUid, addedAt: Date.now() });
        saveFriendsList(friends);
      }
      saveOutgoingFriendReqs(loadOutgoingFriendReqs().filter(x => sanitizeUidForPeer(x.uid) !== fromKey));
      saveIncomingFriendReqs(loadIncomingFriendReqs().filter(x => sanitizeUidForPeer(x.uid) !== fromKey));
      if (myKey) {
        ncMqtt.publish(`${MQTT_NS}/friend/${myKey}/acc/${fromKey}`, '', true);
        ncMqtt.publish(`${MQTT_NS}/friend/${myKey}/req/${fromKey}`, '', true);
      }
      friendOnlineStatus.set(fromKey, { uid: fromUid, online: true, lastSeen: Date.now(), world: pkt.world || null });
      syncPlayerUidUI();
      renderIncomingFriendReqs();
      renderFriendsModalLists();
      renderFriendWorldsList();
      refreshFriendReqBanner();
      const fb = document.getElementById('addFriendFeedback');
      if (fb) {
        fb.className = 'ore-friend-fb visible';
        fb.innerHTML = `✅ <b>${escHtml(fromUid)}</b> đã đồng ý kết bạn với bạn!`;
      }
      showToast(`✅ ${fromUid} đã đồng ý kết bạn với bạn!`);
    } else if (pkt.type === 'friend_game_invite') {
      if (pkt.world && pkt.world.roomId) {
        friendOnlineStatus.set(fromKey, { uid: fromUid, online: true, lastSeen: Date.now(), world: pkt.world });
        renderFriendWorldsList();
        showToast(`✉️ ${fromUid} mời bạn vào thế giới "${pkt.world.name}"! Mở mục Chơi → Thế giới để tham gia.`);
      }
    }
  }

  function broadcastFriendWorldPresence() {
    const myUid = getLockedPlayerUid();
    if (!myUid) return;
    const world = getMySharedWorldPayload();
    const friends = loadFriendsList();
    for (const f of friends) {
      sendFriendPacketToUid(f.uid, { type: 'friend_world_status', fromUid: myUid, world });
    }
  }

  function pollAllFriendsStatus() {
    const myUid = getLockedPlayerUid();
    if (!myUid) return;
    const friends = loadFriendsList();
    const world = getMySharedWorldPayload();
    for (const f of friends) {
      sendFriendPacketToUid(f.uid, { type: 'friend_ping', fromUid: myUid, world });
    }
  }

  function initFriendNetworkPeer() {
    if (!friendBc && typeof BroadcastChannel !== 'undefined') {
      try {
        friendBc = new BroadcastChannel('nucraft_friends_v45');
        friendBc.onmessage = (ev) => handleIncomingFriendPacket(ev.data);
      } catch (_) {}
    }
    const myUid = getLockedPlayerUid();
    const myKey = sanitizeUidForPeer(myUid);
    if (!myKey) return;

    // Register UID on LAN WebSocket (server.js)
    if (wsConn && wsConn.readyState === 1) {
      try { wsConn.send(JSON.stringify({ type: 'register_uid', uid: myUid })); } catch (_) {}
    }

    // Subscribe retained MQTT friend mailbox (req / accept / live msg)
    if (_friendMqttKey !== myKey) {
      for (const u of _friendMqttUnsubs) { try { u(); } catch (_) {} }
      _friendMqttUnsubs = [];
      _friendMqttKey = myKey;
      _friendMqttUnsubs.push(
        ncMqtt.subscribe(`${MQTT_NS}/friend/${myKey}/req/+`, (d) => handleIncomingFriendPacket(d)),
        ncMqtt.subscribe(`${MQTT_NS}/friend/${myKey}/acc/+`, (d) => handleIncomingFriendPacket(d)),
        ncMqtt.subscribe(`${MQTT_NS}/friend/${myKey}/msg`, (d) => handleIncomingFriendPacket(d))
      );
    }

    ensurePeerJsLoaded((ok) => {
      if (!ok) return;
      const curKey = sanitizeUidForPeer(getLockedPlayerUid());
      if (!curKey) return;
      if (friendNetworkPeer && !friendNetworkPeer.destroyed && friendNetworkPeer.id === FRIEND_PEER_PREFIX + curKey) {
        if (friendNetworkPeer.disconnected) { try { friendNetworkPeer.reconnect(); } catch (_) {} }
        return;
      }
      try { if (friendNetworkPeer) friendNetworkPeer.destroy(); } catch (_) {}
      try {
        friendNetworkPeer = new Peer(FRIEND_PEER_PREFIX + curKey, { config: P2P_ICE_CFG });
        friendNetworkPeer.on('open', () => { pollAllFriendsStatus(); });
        friendNetworkPeer.on('disconnected', () => {
          if (friendNetworkPeer && !friendNetworkPeer.destroyed) { try { friendNetworkPeer.reconnect(); } catch (_) {} }
        });
        friendNetworkPeer.on('connection', (conn) => {
          conn.on('data', (d) => handleIncomingFriendPacket(d));
        });
        friendNetworkPeer.on('error', () => {});
      } catch (_) {}
    });
  }

  function renderFriendsModalLists() {
    const onBox = document.getElementById('friendsOnlineList');
    const offBox = document.getElementById('friendsOfflineList');
    if (!onBox || !offBox) return;
    const friends = loadFriendsList();
    const now = Date.now();
    onBox.innerHTML = '';
    offBox.innerHTML = '';
    let onCount = 0, offCount = 0;

    for (const f of friends) {
      const key = sanitizeUidForPeer(f.uid);
      const st = friendOnlineStatus.get(key);
      const isOn = !!(st && st.online && (now - st.lastSeen < 45000));
      const row = document.createElement('div');
      row.className = 'ore-friend-row';
      const checked = selectedInviteFriends.has(key);
      const subText = (isOn && st.world) ? `Đang chơi: ${escHtml(st.world.name)}` : (isOn ? 'NUCRAFT • Trực tuyến' : '');
      row.innerHTML = `
        <div class="ore-friend-check${checked ? ' checked' : ''}">${checked ? '✓' : ''}</div>
        <div class="ore-friend-av">${typeof buildPixelAvatarSvg === 'function' ? buildPixelAvatarSvg({ skin: '#d4a373', hair: '#2b2d42', eye: '#3b82f6' }) : '🧑'}</div>
        <div class="ore-friend-meta">
          <div class="ore-friend-name">${escHtml(f.uid)}</div>
          ${subText ? `<div class="ore-friend-sub">${subText}</div>` : ''}
        </div>
        <div class="ore-status-dot${isOn ? ' online' : ''}"></div>
      `;
      row.addEventListener('click', () => {
        if (selectedInviteFriends.has(key)) selectedInviteFriends.delete(key);
        else selectedInviteFriends.add(key);
        renderFriendsModalLists();
      });
      if (isOn) { onBox.appendChild(row); onCount++; }
      else { offBox.appendChild(row); offCount++; }
    }

    if (onCount === 0) {
      onBox.innerHTML = '<div style="color:#a1a1aa;font-size:11px;padding:6px 4px;">Chưa có bạn bè nào đang trực tuyến.</div>';
    }
    if (offCount === 0) {
      offBox.innerHTML = '<div style="color:#a1a1aa;font-size:11px;padding:6px 4px;">Chưa có bạn bè ngoại tuyến. Bấm "Thêm bạn bè" để tìm theo tên UID!</div>';
    }
    const invBtn = document.getElementById('btnSendFriendInvite');
    if (invBtn) {
      invBtn.textContent = selectedInviteFriends.size > 0 ? `Gửi ${selectedInviteFriends.size} lời mời` : 'Gửi lời mời';
    }
  }

  function renderFriendSearchResult(targetUid, isOnlineFound) {
    const box = document.getElementById('searchFriendResult');
    if (!box) return;
    const myUid = getLockedPlayerUid();
    const cleanTarget = String(targetUid || '').trim();
    const tKey = sanitizeUidForPeer(cleanTarget);
    if (!cleanTarget) { box.innerHTML = ''; return; }
    if (myUid && sanitizeUidForPeer(myUid) === tKey) {
      box.innerHTML = '<div style="color:#fca5a5;font-size:11px;padding:6px;">Đây là tên UID của chính bạn!</div>';
      return;
    }
    const alreadyFriend = loadFriendsList().some(f => sanitizeUidForPeer(f.uid) === tKey);
    const alreadySent = loadOutgoingFriendReqs().some(x => sanitizeUidForPeer(x.uid) === tKey);
    box.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'ore-friend-row';
    row.innerHTML = `
      <div class="ore-friend-av">🧑</div>
      <div class="ore-friend-meta">
        <div class="ore-friend-name">${escHtml(cleanTarget)}</div>
        <div class="ore-friend-sub">${isOnlineFound ? '🟢 Đang trực tuyến trong NUCRAFT' : '🔎 Đã tìm thấy UID • Sẵn sàng gửi lời mời kết bạn'}</div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.className = 'mc-btn ' + (alreadyFriend ? '' : 'mc-btn-green');
    btn.style.cssText = 'height:32px;padding:0 12px;font-size:11px;flex-shrink:0;';
    btn.textContent = alreadyFriend ? 'Đã là bạn' : (alreadySent ? 'Gửi lại ✓' : 'Kết bạn');
    btn.disabled = alreadyFriend;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uidNow = getLockedPlayerUid();
      if (!uidNow) {
        showToast('⚠️ Hãy vào "Hồ sơ" đặt tên UID cố định của bạn trước khi kết bạn!');
        openProfileModal();
        return;
      }
      const out = loadOutgoingFriendReqs().filter(x => sanitizeUidForPeer(x.uid) !== tKey);
      out.unshift({ uid: cleanTarget, ts: Date.now() });
      saveOutgoingFriendReqs(out.slice(0, 30));
      sendFriendPacketToUid(cleanTarget, { type: 'friend_req', fromUid: uidNow });
      btn.textContent = 'Đã gửi lời mời ✓';
      btn.disabled = true;
      const fb = document.getElementById('addFriendFeedback');
      if (fb) {
        fb.className = 'ore-friend-fb visible';
        fb.innerHTML = `📨 Đã gửi lời mời kết bạn tới <b>${escHtml(cleanTarget)}</b>! Bên họ có thể bấm <b>Đồng ý</b> ngay tại mục <b>Bạn bè</b>.`;
      }
      showToast(`📨 Đã gửi lời mời kết bạn tới ${cleanTarget}! Bên họ vào "Bạn bè" để đồng ý.`);
    });
    row.appendChild(btn);
    box.appendChild(row);
  }

  function buildIncomingReqRow(r) {
    const row = document.createElement('div');
    row.className = 'ore-friend-row is-req';
    const av = typeof buildPixelAvatarSvg === 'function' ? buildPixelAvatarSvg({ skin: '#d4a373', hair: '#2b2d42', eye: '#16a34a' }) : '👤';
    row.innerHTML = `
      <div class="ore-friend-av">${av}</div>
      <div class="ore-friend-meta">
        <div class="ore-friend-name">${escHtml(r.uid)}</div>
        <div class="ore-friend-sub">Muốn kết bạn với bạn</div>
      </div>
    `;
    const acts = document.createElement('div');
    acts.className = 'ore-req-actions';
    const bAcc = document.createElement('button');
    bAcc.type = 'button';
    bAcc.className = 'mc-btn mc-btn-green';
    bAcc.style.cssText = 'height:30px;padding:0 10px;font-size:11px;';
    bAcc.textContent = '✓ Đồng ý';
    bAcc.addEventListener('click', (e) => { e.stopPropagation(); acceptIncomingFriendReq(r.uid); });
    const bDec = document.createElement('button');
    bDec.type = 'button';
    bDec.className = 'mc-btn';
    bDec.style.cssText = 'height:30px;padding:0 9px;font-size:11px;';
    bDec.textContent = 'Từ chối';
    bDec.addEventListener('click', (e) => { e.stopPropagation(); declineIncomingFriendReq(r.uid); });
    acts.append(bAcc, bDec);
    row.appendChild(acts);
    return row;
  }

  function renderIncomingFriendReqs() {
    const reqs = loadIncomingFriendReqs();
    const modalLbl = document.getElementById('friendsModalReqLbl');
    const modalCnt = document.getElementById('friendsModalReqCount');
    if (modalCnt) modalCnt.textContent = String(reqs.length);
    if (modalLbl) modalLbl.classList.toggle('has-reqs', reqs.length > 0);
    const coopBadge = document.getElementById('coopFriendsReqBadge');
    if (coopBadge) coopBadge.textContent = String(reqs.length);

    const targets = [
      { el: document.getElementById('friendsModalReqList'), emptyText: 'Chưa có lời mời kết bạn nào. Khi có người gửi, nút Đồng ý sẽ hiện ở đây!' },
      { el: document.getElementById('incomingFriendReqsList'), emptyText: 'Chưa có lời mời kết bạn nào đang chờ.' }
    ];
    for (const t of targets) {
      if (!t.el) continue;
      t.el.innerHTML = '';
      if (!reqs.length) {
        t.el.innerHTML = `<div style="color:#a1a1aa;font-size:11px;padding:6px 4px;">${t.emptyText}</div>`;
      } else {
        for (const r of reqs) t.el.appendChild(buildIncomingReqRow(r));
      }
    }
  }

  function renderFriendWorldsList() {
    const sec = document.getElementById('friendWorldsSection');
    const box = document.getElementById('friendWorldsList');
    if (!sec || !box) return;
    const friends = loadFriendsList();
    const now = Date.now();
    const activeWorlds = [];
    for (const f of friends) {
      const st = friendOnlineStatus.get(sanitizeUidForPeer(f.uid));
      if (st && st.online && st.world && st.world.roomId && (now - st.lastSeen < 60000)) {
        activeWorlds.push(st.world);
      }
    }
    if (!activeWorlds.length) {
      sec.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    sec.style.display = 'flex';
    box.innerHTML = '';
    for (const w of activeWorlds) {
      const card = document.createElement('div');
      card.className = 'ore-world-card';
      card.innerHTML = `
        <div class="ore-world-thumb">🌍</div>
        <div class="ore-world-info">
          <div class="ore-world-name">${escHtml(w.name)}</div>
          <div class="ore-world-sub">Thế giới của ${escHtml(w.hostUid)}</div>
          <div class="ore-world-tags">
            <span class="ore-tag">${escHtml(w.mode || 'Sinh tồn')}</span>
            <span class="ore-tag lan">Thế giới bạn bè</span>
          </div>
        </div>
        <div class="ore-world-right">
          <span style="color:#4ade80;">●</span> ${Number(w.players) || 1}/${Number(w.maxPlayers) || 5}
        </div>
      `;
      card.addEventListener('click', () => {
        showToast(`🌐 Đang vào thế giới "${w.name}" của ${w.hostUid}...`);
        joinCoopRoomById(w.roomId);
      });
      box.appendChild(card);
    }
  }

  function renderPausePlayersList() {
    return renderPausePlayersListV61();
  }

  function openFriendsModal() {
    const titleEl = document.getElementById('friendsModalTitle');
    if (titleEl) titleEl.textContent = isPlaying ? 'Mời bạn bè vào trò chơi của bạn' : 'Bạn bè & Lời mời kết bạn';
    pollAllFriendsStatus();
    renderIncomingFriendReqs();
    renderFriendsModalLists();
    const uid = getLockedPlayerUid();
    const onBox = document.getElementById('friendsOnlineList');
    if (!uid && onBox) {
      const warn = document.createElement('div');
      warn.style.cssText = 'background:#313233;border:2px solid #1e1e1f;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;';
      warn.innerHTML = '<span style="color:#fde68a;font-size:11.5px;font-family:var(--font-pixel);">Bạn chưa đặt tên UID cố định trong Hồ sơ!</span>';
      const b = document.createElement('button');
      b.className = 'mc-btn mc-btn-green';
      b.style.cssText = 'height:30px;padding:0 10px;font-size:11px;flex-shrink:0;';
      b.textContent = 'Đặt UID ngay';
      b.addEventListener('click', () => {
        document.getElementById('friendsModal')?.classList.add('hidden');
        openProfileModal();
      });
      warn.appendChild(b);
      onBox.prepend(warn);
    }
    document.getElementById('friendsModal')?.classList.remove('hidden');
  }
  function openAddFriendModal() {
    if (!getLockedPlayerUid()) {
      showToast('👤 Hãy đặt tên UID cố định trong Hồ sơ trước để thêm bạn bè!');
      openProfileModal();
      return;
    }
    const fb = document.getElementById('addFriendFeedback');
    if (fb) { fb.className = 'ore-friend-fb'; fb.innerHTML = ''; }
    document.getElementById('friendsModal')?.classList.add('hidden');
    renderIncomingFriendReqs();
    document.getElementById('addFriendModal')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('inpSearchFriendUid')?.focus(), 50);
  }

