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
    function publish(topic, payloadObjOrEmpty, retain = false, dropIfCongested = false) {
      const payloadStr = (payloadObjOrEmpty === '' || payloadObjOrEmpty == null)
        ? ''
        : (typeof payloadObjOrEmpty === 'string' ? payloadObjOrEmpty : JSON.stringify(payloadObjOrEmpty));
      ensureConnected();
      if (ready && ws && ws.readyState === 1) {
        if (dropIfCongested && ws.bufferedAmount > 48000) return false;
        try { ws.send(pktPublish(topic, payloadStr, retain)); return true; } catch (_) {}
      }
      if (dropIfCongested) return false;
      if (outbox.length >= 192) outbox.shift();
      outbox.push({ topic, payloadStr, retain });
      return false;
    }
    return { ensureConnected, subscribe, publish, isConnected: () => ready, _encStr: encStr, _pktPub: pktPublish, _topicMatches: topicMatches };
  })();

  const liveRoomsByCode = new Map();
  function mintPermanentRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'LC';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }
  function updateLiveRoomsCache(list) {
    if (!Array.isArray(list)) return;
    liveRoomsByCode.clear();
    for (const r of list) {
      if (r && r.roomId) liveRoomsByCode.set(String(r.roomId).toUpperCase(), r);
    }
    if (typeof renderSavedWorldsList === 'function') renderSavedWorldsList();
  }
  function fetchLiveRoomsHttp() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (/\.github\.io$/i.test(location.hostname || '') || /[?&]standalone=1\b/.test(location.search || '')) return;
    fetch('/api/rooms', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data.rooms)) {
          updateLiveRoomsCache(data.rooms);
          renderOpenRoomsList(data.rooms);
        }
      })
      .catch(() => {});
  }
  function clearAndRefreshOpenRooms() {
    liveRoomsByCode.clear();
    renderOpenRoomsList([]);
    if (typeof renderSavedWorldsList === 'function') renderSavedWorldsList();
    const canLocalApi = (location.protocol === 'http:' || location.protocol === 'https:')
      && !/\.github\.io$/i.test(location.hostname || '') && !/[?&]standalone=1\b/.test(location.search || '');
    if (canLocalApi) {
      fetch('/api/rooms/clear', { method: 'POST', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && Array.isArray(data.rooms)) {
            updateLiveRoomsCache(data.rooms);
            renderOpenRoomsList(data.rooms);
          }
        })
        .catch(() => {});
    }
    if (wsConn && wsConn.readyState === 1) {
      try { wsConn.send(JSON.stringify({ type: 'clear_rooms' })); } catch (_) {}
    } else {
      connectCoopSocket((online) => {
        if (online && wsConn && wsConn.readyState === 1) {
          try { wsConn.send(JSON.stringify({ type: 'clear_rooms' })); } catch (_) {}
        }
      });
    }
  }

  function _resolveRemoteSkinKey(peerId, skinId, customSkin) {
    if (customSkin && typeof customSkin.dataUrl === 'string' && typeof registerRemoteCustomSkin === 'function') {
      const k = registerRemoteCustomSkin(peerId, customSkin);
      if (k) return k;
    }
    return skinId || null;
  }

  function broadcastSkinSync() {
    if (!activeRoomId) return;
    const cs = (typeof getLocalCustomSkinPayload === 'function') ? getLocalCustomSkinPayload() : null;
    sendCoopMsg({ type: 'skin_sync', skinId: selectedSkinId, customSkin: cs });
  }

  function _wrapNetAng(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    return a < 0 ? a + Math.PI : a - Math.PI;
  }
  function _clampHermiteTan(vSpan, d) {
    if (d === 0 || vSpan * d <= 0) return 0;
    const maxMag = Math.abs(d) * 1.45;
    return Math.abs(vSpan) > maxMag ? (vSpan > 0 ? maxMag : -maxMag) : vSpan;
  }
  function createNetInterp(baseDelayMs = 85) {
    return {
      snaps: [], lastSeq: -1, clockOff: null, jitterMs: 0,
      avgIntMs: baseDelayMs, delayMs: baseDelayMs, renderT: null,
      wasCoasting: false, _reconcile: false,
      lastOutX: 0, lastOutY: 0, lastOutZ: 0, hasOut: false,
      corrX: 0, corrY: 0, corrZ: 0,
      lastPushNow: 0, lastSenderTs: null
    };
  }
  function pushNetSnap(buf, snap, nowMs, localDepthOff = 0) {
    if (!buf || !snap || !Number.isFinite(snap.x) || !Number.isFinite(snap.z)) return false;
    if (typeof snap.seq === 'number') {
      if (buf.lastSeq >= 0 && snap.seq <= buf.lastSeq && (buf.lastSeq - snap.seq) < 1000) return false;
      buf.lastSeq = snap.seq;
    }
    const hasTs = (typeof snap.ts === 'number' && Number.isFinite(snap.ts));
    const sTs = hasTs ? snap.ts : nowMs;
    const rawDiff = nowMs - sTs;
    if (buf.clockOff === null) {
      buf.clockOff = rawDiff;
      buf.jitterMs = 0;
    } else if (hasTs) {
      const diff = rawDiff - buf.clockOff;
      if (Math.abs(diff) > 1500) {
        buf.clockOff = rawDiff;
        buf.jitterMs = 0;
        buf.snaps.length = 0;
        buf.renderT = null;
        buf.corrX = 0; buf.corrY = 0; buf.corrZ = 0;
        buf._reconcile = false;
        buf.wasCoasting = false;
      } else if (diff < 0) {
        buf.clockOff += diff * 0.25;
        buf.jitterMs *= 0.90;
      } else {
        buf.clockOff += diff * 0.04;
        const cj = Math.min(180, diff);
        buf.jitterMs = Math.max(cj * 0.85, buf.jitterMs * 0.90 + cj * 0.10);
      }
    }
    if (buf.lastSenderTs !== null) {
      const rawDt = hasTs ? (sTs - buf.lastSenderTs) : (nowMs - buf.lastPushNow);
      if (rawDt > 15 && rawDt <= 320) {
        buf.avgIntMs = buf.avgIntMs * 0.85 + rawDt * 0.15;
      }
    }
    buf.lastSenderTs = sTs;
    buf.delayMs = Math.max(70, Math.min(250, buf.avgIntMs * 1.15 + buf.jitterMs * 1.25 + 14));

    const snaps = buf.snaps;
    let prev = snaps.length > 0 ? snaps[snaps.length - 1] : null;
    const hadPriorPastRender = !!(buf.hasOut && buf.renderT !== null && prev && buf.renderT > prev.t);
    let t = hasTs ? (sTs + buf.clockOff) : nowMs;
    if (prev && t <= prev.t) t = prev.t + 1;
    if (prev && (t - prev.t) > 320) {
      const anchorT = Math.max(prev.t + 1, t - Math.max(55, Math.min(120, buf.avgIntMs)));
      snaps.push({
        t: anchorT,
        x: prev.x, y: prev.y, ty: prev.ty, z: prev.z,
        vx: 0, vy: 0, vz: 0,
        yaw: prev.yaw, pitch: prev.pitch, spd: 0
      });
      prev = snaps[snaps.length - 1];
    }

    const hasTy = (typeof snap.ty === 'number' && Number.isFinite(snap.ty));
    const yVal = (typeof snap.y === 'number' && Number.isFinite(snap.y)) ? snap.y : (hasTy ? (snap.ty + localDepthOff) : 0);
    let vx = (typeof snap.vx === 'number' && Number.isFinite(snap.vx)) ? snap.vx : null;
    let vy = (typeof snap.vy === 'number' && Number.isFinite(snap.vy)) ? snap.vy : null;
    let vz = (typeof snap.vz === 'number' && Number.isFinite(snap.vz)) ? snap.vz : null;
    if (vx === null || vy === null || vz === null) {
      const segS = prev ? ((t - prev.t) / 1000) : 0;
      if (prev && segS > 0.008 && segS <= 0.35) {
        const prevY = prev.ty !== null ? (prev.ty + localDepthOff) : prev.y;
        if (vx === null) vx = (snap.x - prev.x) / segS;
        if (vy === null) vy = (yVal - prevY) / segS;
        if (vz === null) vz = (snap.z - prev.z) / segS;
      } else {
        if (vx === null) vx = 0;
        if (vy === null) vy = 0;
        if (vz === null) vz = 0;
      }
    }
    snaps.push({
      t,
      x: snap.x, y: yVal, ty: hasTy ? snap.ty : null, z: snap.z,
      vx, vy, vz,
      yaw: typeof snap.yaw === 'number' ? snap.yaw : (prev ? prev.yaw : 0),
      pitch: typeof snap.pitch === 'number' ? snap.pitch : (prev ? prev.pitch : 0),
      spd: typeof snap.spd === 'number' ? snap.spd : Math.hypot(vx, vz)
    });
    while (snaps.length > 10) snaps.shift();
    buf.lastPushNow = nowMs;
    if (buf.hasOut && buf.renderT !== null && (buf.wasCoasting || hadPriorPastRender)) buf._reconcile = true;
    return true;
  }
  function sampleNetInterp(buf, nowMs, dt, localDepthOff = 0, teleportDist = 12.0, outObj = null) {
    const out = outObj || { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, spd: 0 };
    const snaps = buf && buf.snaps;
    if (!snaps || snaps.length === 0) return out;
    const safeDt = Math.max(0.001, Math.min(0.1, dt || 0.016));
    const targetRT = nowMs - buf.delayMs;
    if (buf.renderT === null || Math.abs(targetRT - buf.renderT) > 420) {
      if (buf.renderT !== null && buf.hasOut) buf._reconcile = true;
      else { buf.corrX = 0; buf.corrY = 0; buf.corrZ = 0; buf._reconcile = false; }
      buf.renderT = targetRT;
    } else {
      const drift = targetRT - buf.renderT;
      const rate = 1 + Math.max(-0.08, Math.min(0.08, drift * 0.002));
      buf.renderT += safeDt * 1000 * rate;
    }
    while (snaps.length > 2 && snaps[1].t <= buf.renderT) snaps.shift();

    const n = snaps.length;
    const getY = (s) => (s.ty !== null ? (s.ty + localDepthOff) : s.y);
    let rawX, rawY, rawZ, vx, vy, vz, yaw, pitch, spd;

    if (n === 1 || buf.renderT <= snaps[0].t) {
      const s0 = snaps[0];
      rawX = s0.x; rawY = getY(s0); rawZ = s0.z;
      vx = s0.vx; vy = s0.vy; vz = s0.vz;
      yaw = s0.yaw; pitch = s0.pitch; spd = s0.spd;
      buf.wasCoasting = false;
    } else if (buf.renderT < snaps[n - 1].t) {
      let idx = 0;
      for (let k = 0; k < n - 1; k++) {
        if (snaps[k + 1].t >= buf.renderT) { idx = k; break; }
      }
      const A = snaps[idx], B = snaps[idx + 1];
      const ay = getY(A), by = getY(B);
      const dx = B.x - A.x, dy = by - ay, dz = B.z - A.z;
      if (Math.hypot(dx, dy, dz) > teleportDist) {
        rawX = B.x; rawY = by; rawZ = B.z;
        vx = B.vx; vy = B.vy; vz = B.vz;
        yaw = B.yaw; pitch = B.pitch; spd = B.spd;
        buf.corrX = 0; buf.corrY = 0; buf.corrZ = 0;
        buf._reconcile = false;
      } else {
        const segMs = Math.max(1, B.t - A.t);
        const segSec = segMs / 1000;
        const u = Math.max(0, Math.min(1, (buf.renderT - A.t) / segMs));
        const u2 = u * u, u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1;
        const h10 = u3 - 2 * u2 + u;
        const h01 = -2 * u3 + 3 * u2;
        const h11 = u3 - u2;
        const dh00 = 6 * u2 - 6 * u;
        const dh10 = 3 * u2 - 4 * u + 1;
        const dh01 = -6 * u2 + 6 * u;
        const dh11 = 3 * u2 - 2 * u;

        const m0x = _clampHermiteTan(A.vx * segSec, dx);
        const m1x = _clampHermiteTan(B.vx * segSec, dx);
        const m0z = _clampHermiteTan(A.vz * segSec, dz);
        const m1z = _clampHermiteTan(B.vz * segSec, dz);
        const maxY = Math.max(Math.abs(dy) * 1.5, 0.85);
        const clampY = (v) => Math.max(-maxY, Math.min(maxY, v));
        const m0y = clampY(A.vy * segSec);
        const m1y = clampY(B.vy * segSec);

        rawX = h00 * A.x + h10 * m0x + h01 * B.x + h11 * m1x;
        rawY = h00 * ay  + h10 * m0y + h01 * by  + h11 * m1y;
        rawZ = h00 * A.z + h10 * m0z + h01 * B.z + h11 * m1z;
        const invSeg = 1 / segSec;
        vx = (dh00 * A.x + dh10 * m0x + dh01 * B.x + dh11 * m1x) * invSeg;
        vy = (dh00 * ay  + dh10 * m0y + dh01 * by  + dh11 * m1y) * invSeg;
        vz = (dh00 * A.z + dh10 * m0z + dh01 * B.z + dh11 * m1z) * invSeg;
        yaw = A.yaw + _wrapNetAng(B.yaw - A.yaw) * u;
        pitch = A.pitch + (B.pitch - A.pitch) * u;
        spd = A.spd + (B.spd - A.spd) * u;
      }
      buf.wasCoasting = false;
    } else {
      const last = snaps[n - 1];
      const ly = getY(last);
      const overSec = Math.max(0, Math.min(0.22, (buf.renderT - last.t) / 1000));
      const damp = Math.exp(-7.5 * overSec);
      const coastSec = (1 - damp) / 7.5;
      rawX = last.x + last.vx * coastSec;
      rawY = ly + last.vy * coastSec * 0.45;
      rawZ = last.z + last.vz * coastSec;
      vx = last.vx * damp;
      vy = last.vy * damp * 0.45;
      vz = last.vz * damp;
      yaw = last.yaw;
      pitch = last.pitch;
      spd = last.spd * damp;
      buf.wasCoasting = (overSec > 0.004);
    }

    if (buf._reconcile && buf.hasOut) {
      buf._reconcile = false;
      const ex = buf.lastOutX - rawX, ey = buf.lastOutY - rawY, ez = buf.lastOutZ - rawZ;
      if (Math.hypot(ex, ey, ez) < teleportDist) {
        buf.corrX = ex; buf.corrY = ey; buf.corrZ = ez;
      } else {
        buf.corrX = 0; buf.corrY = 0; buf.corrZ = 0;
      }
    }
    const cDecay = Math.exp(-12.0 * safeDt);
    buf.corrX *= cDecay; buf.corrY *= cDecay; buf.corrZ *= cDecay;
    if (Math.abs(buf.corrX) < 0.001) buf.corrX = 0;
    if (Math.abs(buf.corrY) < 0.001) buf.corrY = 0;
    if (Math.abs(buf.corrZ) < 0.001) buf.corrZ = 0;

    out.x = rawX + buf.corrX;
    out.y = rawY + buf.corrY;
    out.z = rawZ + buf.corrZ;
    out.vx = vx; out.vy = vy; out.vz = vz;
    out.yaw = yaw; out.pitch = pitch; out.spd = spd;
    buf.lastOutX = out.x; buf.lastOutY = out.y; buf.lastOutZ = out.z;
    buf.hasOut = true;
    return out;
  }

  function ensureRemotePeer(peerId, name, color = '#38bdf8', isBuddy = false, skinId = null, playerKey = '', customSkin = null) {
    const resolvedSkin = _resolveRemoteSkinKey(peerId, skinId, customSkin);
    let rp = remotePlayers.get(peerId);
    if (rp) {
      if (name) rp.name = name;
      if (playerKey) rp.playerKey = String(playerKey);
      if (resolvedSkin && rp.skinId !== resolvedSkin) { rp.skinId = resolvedSkin; applySkinToRig(rp.rig, resolvedSkin); }
      rp._createdAt = rp._createdAt || performance.now();
      return rp;
    }
    const cleanKey = playerKey ? String(playerKey) : '';
    if (!isBuddy && cleanKey) {
      for (const [oldId, oldRp] of Array.from(remotePlayers.entries())) {
        if (oldId !== peerId && !oldRp.isBuddy && oldRp.playerKey && oldRp.playerKey === cleanKey) {
          removeRemotePeer(oldId);
        }
      }
    }
    const skinList = PLAYER_SKINS.map(s => s.id);
    const hashC = peerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const chosenSkin = resolvedSkin || skinList[hashC % skinList.length];
    const rig = createPlayerRig(chosenSkin, null, null, name, color);
    rig.g.position.set(player.x + 3, player.y, player.z + 3);
    scene.add(rig.g);
    const nowP = performance.now();
    rp = {
      id: peerId, name: name || 'Bạn Chơi', color, isBuddy, skinId: chosenSkin, playerKey: cleanKey,
      x: player.x + 3.5, y: player.y, z: player.z + 3.5, tx: player.x + 3.5, ty: player.y, tz: player.z + 3.5,
      trueY: undefined, vy: 0,
      yaw: 0, pitch: 0, speed: 0, sprinting: false, sneaking: false, inWater: false, onGround: true, swing: 0,
      wanderT: 2.0, rig, _hasNetState: false, _lastPktAt: 0, _createdAt: nowP, _netBuf: null
    };
    remotePlayers.set(peerId, rp);
    updateRoomBadgeUI();
    if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
    return rp;
  }

  function removeRemotePeer(peerId) {
    const rp = remotePlayers.get(peerId);
    if (rp) {
      scene.remove(rp.rig.g);
      remotePlayers.delete(peerId);
      updateRoomBadgeUI();
      if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
    }
    const dotEntry = locatorDotEls.get(peerId);
    if (dotEntry) { dotEntry.el.remove(); locatorDotEls.delete(peerId); }
  }

  function updateRoomBadgeUI() {
    const badge = document.getElementById('roomBadge');
    const menuSt = document.getElementById('menuCoopStatus');
    if (menuSt) {
      if (activeRoomId) menuSt.innerHTML = `Đang mở phòng Internet: <b style="color:#4ade80;">${escHtml(activeRoomId)}</b> (${1 + remotePlayers.size} người chơi) — Gửi mã này cho bạn bè ở bất kỳ mạng Wi-Fi / 4G nào!`;
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
    if (typeof applyHudLayout === 'function') applyHudLayout();
  }

  let _cancelActiveJoin = null;

  let _wsRoomHostId = '';
  let _wsJoinedRoomId = '';
  let _pendingWsMods = [];
  const _hostAuthoritativeDrops = new Map();
  const _roomDropsCache = new Map();
  let _dropBatchQueue = [];
  let _dropBatchTimer = null;
  let _playerRoomSaveTimer = null;
  let _lastSavedPlayerSig = '';

  function getLocalPlayerSaveKey() {
    const uid = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || '';
    if (uid) return 'uid:' + sanitizeUidForPeer(uid);
    try {
      let pk = localStorage.getItem('nucraft_coop_pk_v1');
      if (!pk) {
        pk = 'pk_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem('nucraft_coop_pk_v1', pk);
      }
      return pk;
    } catch (_) { return 'peer:' + localPeerId; }
  }
  function isSimAuthority() {
    if (!activeRoomId) return true;
    if (p2pIsHost) return true;
    if (_wsRoomHostId && wsSelfPeerId && _wsRoomHostId === wsSelfPeerId) return true;
    return false;
  }
  function serializeLocalPlayerRoomState() {
    return {
      dim: currentDimension || 'overworld',
      depthOffset: depthOffset || 0,
      x: +player.x.toFixed(3), y: +player.y.toFixed(3), trueY: +(player.y - (depthOffset || 0)).toFixed(3), z: +player.z.toFixed(3),
      yaw: +player.yaw.toFixed(4), pitch: +player.pitch.toFixed(4),
      hp: player.hp, hunger: player.hunger, xp: player.xp, level: player.level,
      daysPlayed: player.daysPlayed || 1,
      swiftSneak: player.swiftSneak || 0,
      bedSpawn: player.bedSpawn ? { ...player.bedSpawn } : null,
      offhandDur: player.offhandDur || 336,
      offhandMaxDur: player.offhandMaxDur || 336,
      equip: { ...player.equip },
      equipMeta: player.equipMeta ? JSON.parse(JSON.stringify(player.equipMeta)) : null,
      inventory: inventory.map(s => (s && s.count > 0)
        ? { id: s.id, count: s.count, dur: s.dur || 0, maxDur: s.maxDur || 0, ench: !!s.ench, trim: s.trim ? { ...s.trim } : null }
        : { id: 0, count: 0, dur: 0, maxDur: 0, ench: false, trim: null })
    };
  }
  function applySavedPlayerRoomState(sp) {
    if (!sp || !Number.isFinite(sp.x) || !Number.isFinite(sp.z)) return false;
    const tgtDim = (typeof sp.dim === 'string' && sp.dim) ? sp.dim : 'overworld';
    if (tgtDim !== currentDimension && typeof switchDimension === 'function') {
      switchDimension(tgtDim, null, { skipSpawnMove: true });
    }
    depthOffset = Number(sp.depthOffset) || 0;
    const tgtY = (typeof sp.trueY === 'number' && Number.isFinite(sp.trueY)) ? (sp.trueY + depthOffset) : (Number(sp.y) || 14);
    player.x = sp.x; player.y = tgtY; player.z = sp.z;
    if (Number.isFinite(sp.yaw)) player.yaw = sp.yaw;
    if (Number.isFinite(sp.pitch)) player.pitch = sp.pitch;
    player.vx = 0; player.vy = 0; player.vz = 0;
    player.fallStartY = player.y;
    if (typeof sp.hp === 'number') player.hp = sp.hp;
    if (typeof sp.hunger === 'number') player.hunger = sp.hunger;
    if (typeof sp.xp === 'number') player.xp = sp.xp;
    if (typeof sp.level === 'number') player.level = sp.level;
    if (typeof sp.daysPlayed === 'number') player.daysPlayed = sp.daysPlayed;
    if (typeof sp.swiftSneak === 'number') player.swiftSneak = sp.swiftSneak;
    player.bedSpawn = sp.bedSpawn ? { ...sp.bedSpawn } : null;
    if (typeof sp.offhandDur === 'number') player.offhandDur = sp.offhandDur;
    if (typeof sp.offhandMaxDur === 'number') player.offhandMaxDur = sp.offhandMaxDur;
    if (sp.equip) Object.assign(player.equip, sp.equip);
    if (sp.equipMeta) player.equipMeta = JSON.parse(JSON.stringify(sp.equipMeta));
    if (Array.isArray(sp.inventory) && sp.inventory.length === inventory.length) {
      for (let i = 0; i < inventory.length; i++) {
        const src = sp.inventory[i], def = (src && src.id) ? BLOCK_DEF[src.id] : null;
        if (!src || !src.id || src.count <= 0) {
          inventory[i].id = 0; inventory[i].count = 0; inventory[i].dur = 0; inventory[i].maxDur = 0; inventory[i].ench = false; inventory[i].trim = null;
        } else {
          const mDur = src.maxDur || (def && def.maxDur) || 0;
          inventory[i].id = src.id; inventory[i].count = src.count;
          inventory[i].maxDur = mDur;
          inventory[i].dur = (typeof src.dur === 'number' && src.dur > 0) ? src.dur : mDur;
          inventory[i].ench = !!src.ench;
          inventory[i].trim = src.trim ? { ...src.trim } : null;
        }
      }
    }
    if (typeof rebuildCurrentDimModIndex === 'function') rebuildCurrentDimModIndex();
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!chunks.has(chunkKey(pcx + dx, pcz + dz))) generateChunk(pcx + dx, pcz + dz);
    }
    for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
    recalcPlayerArmor(); renderHotbar(); renderEquipmentUI(); renderStatusBars(); renderXpBar();
    return true;
  }
  function _saveLocalCoopPlayerBackup(roomId, st) {
    if (!roomId || !st) return;
    try { localStorage.setItem(`nucraft_coop_player_${roomId}_${getLocalPlayerSaveKey()}`, JSON.stringify(st)); } catch (_) {}
  }
  function _loadLocalCoopPlayerBackup(roomId) {
    if (!roomId) return null;
    try {
      const raw = localStorage.getItem(`nucraft_coop_player_${roomId}_${getLocalPlayerSaveKey()}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function schedulePlayerRoomSave(immediate = false) {
    if (!activeRoomId || isWorldLoading) return;
    const flush = () => {
      _playerRoomSaveTimer = null;
      if (!activeRoomId || isWorldLoading) return;
      const st = serializeLocalPlayerRoomState();
      const sig = JSON.stringify(st);
      if (!immediate && sig === _lastSavedPlayerSig) return;
      _lastSavedPlayerSig = sig;
      _saveLocalCoopPlayerBackup(activeRoomId, st);
      if (wsConn && wsConn.readyState === 1) {
        try { wsConn.send(JSON.stringify({ type: 'player_save', playerKey: getLocalPlayerSaveKey(), playerState: st })); } catch (_) {}
      } else if (!p2pIsHost) {
        sendCoopMsg({ type: 'player_save', playerKey: getLocalPlayerSaveKey(), playerState: st });
      }
    };
    if (immediate) {
      if (_playerRoomSaveTimer) { clearTimeout(_playerRoomSaveTimer); _playerRoomSaveTimer = null; }
      flush();
    } else if (!_playerRoomSaveTimer) {
      _playerRoomSaveTimer = setTimeout(flush, 900);
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { if (activeRoomId) schedulePlayerRoomSave(true); });
    setInterval(() => { if (activeRoomId && isPlaying && !isWorldLoading) schedulePlayerRoomSave(false); }, 3500);
  }

  function broadcastChestSync(dimKey, blockId, packedSlots) {
    if (!activeRoomId) return;
    sendCoopMsg({ type: 'chest_sync', key: dimKey, blockId, slots: packedSlots });
  }
  function broadcastChestBreak(dimKey) {
    if (!activeRoomId) return;
    sendCoopMsg({ type: 'chest_break', key: dimKey });
  }
  function _applyRemoteChestSync(m) {
    if (!m || !m.key || !Array.isArray(m.slots)) return;
    const dk = String(m.key).includes(':') ? String(m.key) : ('overworld:' + String(m.key));
    const len = m.slots.length <= 27 ? 27 : 54;
    if (typeof _unpackChestArr === 'function') chestStorageMap.set(dk, _unpackChestArr(m.slots, len));
    consumedLootChests.add(dk);
    if (typeof activeChestKey === 'string' && activeChestKey && typeof toDimChestKey === 'function' && toDimChestKey(activeChestKey) === dk) {
      if (typeof renderChestModal === 'function') renderChestModal(_activeChestBlockId);
    }
  }
  function _applyRemoteChestBreak(m) {
    if (!m || !m.key) return;
    const dk = String(m.key).includes(':') ? String(m.key) : ('overworld:' + String(m.key));
    chestStorageMap.delete(dk);
    consumedLootChests.add(dk);
    if (typeof activeChestKey === 'string' && activeChestKey && typeof toDimChestKey === 'function' && toDimChestKey(activeChestKey) === dk) {
      if (typeof closeChestModal === 'function') closeChestModal();
    }
  }
  function queueNetworkDropSpawn(dropObj) {
    if (!activeRoomId || !dropObj || !dropObj.dropId) return;
    _roomDropsCache.set(String(dropObj.dropId), dropObj);
    if (p2pIsHost) _hostAuthoritativeDrops.set(String(dropObj.dropId), dropObj);
    _dropBatchQueue.push(dropObj);
    if (_dropBatchQueue.length >= 24) { flushNetworkDropBatch(); return; }
    if (!_dropBatchTimer) _dropBatchTimer = setTimeout(flushNetworkDropBatch, 25);
  }
  function flushNetworkDropBatch() {
    if (_dropBatchTimer) { clearTimeout(_dropBatchTimer); _dropBatchTimer = null; }
    if (!_dropBatchQueue.length) return;
    const drops = _dropBatchQueue.splice(0, _dropBatchQueue.length);
    if (activeRoomId) sendCoopMsg({ type: 'drop_batch', drops });
  }
  function _applyRemoteDropBatch(drops) {
    if (!Array.isArray(drops)) return;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (!d || !d.dropId) continue;
      _roomDropsCache.set(String(d.dropId), d);
      if (p2pIsHost) _hostAuthoritativeDrops.set(String(d.dropId), d);
      if ((d.dim || 'overworld') === currentDimension && !droppedItems.some(it => it.dropId === d.dropId)) {
        const sy = (typeof d.trueY === 'number') ? (d.trueY + (depthOffset || 0)) : d.y;
        spawnDroppedItem(d.x, sy, d.z, d.id, {
          _remote: true, dropId: d.dropId, dim: d.dim || 'overworld', exactPos: true,
          count: d.count || 1, dur: d.dur || 0, maxDur: d.maxDur || 0,
          ench: !!d.ench, trim: d.trim ? { ...d.trim } : null,
          vx: d.vx || 0, vy: d.vy || 0, vz: d.vz || 0,
          pickupDelay: d.fromDeath ? 0.55 : 0.25, fromDeath: !!d.fromDeath
        });
      }
    }
  }
  function _isDropContestedByPeer(dropObj) {
    if (!dropObj || typeof remotePlayers === 'undefined' || !remotePlayers) return false;
    const dim = dropObj.dim || currentDimension || 'overworld';
    for (const rp of remotePlayers.values()) {
      if (!rp || rp.isBuddy || (rp.dim || 'overworld') !== dim) continue;
      const dx = rp.x - dropObj.x, dz = rp.z - dropObj.z;
      if ((dx * dx + dz * dz) < 10.24) return true;
    }
    return false;
  }
  const _dropRemoveQueue = [];
  let _dropRemoveTimer = null;
  function flushDropRemoveBatch() {
    if (_dropRemoveTimer) { clearTimeout(_dropRemoveTimer); _dropRemoveTimer = null; }
    if (!_dropRemoveQueue.length) return;
    const ids = _dropRemoveQueue.splice(0, _dropRemoveQueue.length);
    if (activeRoomId) sendCoopMsg({ type: 'drop_remove', dropIds: ids });
  }
  function requestNetworkDropPickup(dropOrId) {
    if (!activeRoomId || !dropOrId) return;
    const isObj = (typeof dropOrId === 'object');
    const did = String((isObj && dropOrId.dropId) ? dropOrId.dropId : dropOrId);
    if (!did) return;
    const now = performance.now();
    if (isObj) {
      if (dropOrId._pickupReqAt && (now - dropOrId._pickupReqAt) < 180) return;
      dropOrId._pickupReqAt = now;
      dropOrId._pickupReqFirstAt = dropOrId._pickupReqFirstAt || now;
      dropOrId._pickupReqCount = (dropOrId._pickupReqCount || 0) + 1;
    }
    flushNetworkDropBatch();
    const dropFallback = (isObj && dropOrId.id)
      ? { dropId: did, id: dropOrId.id, count: dropOrId.count || 1, dur: dropOrId.dur || 0, maxDur: dropOrId.maxDur || 0, ench: !!dropOrId.ench, trim: dropOrId.trim ? { ...dropOrId.trim } : null }
      : null;
    if (p2pIsHost) {
      const d = _hostAuthoritativeDrops.get(did) || _roomDropsCache.get(did) || dropFallback;
      if (!d) return;
      if (typeof _completeNetworkDropPickup === 'function' && !_completeNetworkDropPickup(did, d)) return;
      _hostAuthoritativeDrops.delete(did);
      _roomDropsCache.delete(did);
      broadcastDropRemove(did);
      return;
    }
    // Local uncontested pickup (player broke plant / threw item with no peer nearby) or fast fallback after missed ACK (prevents orbiting!)
    const localUncontested = isObj && !dropOrId._remote && dropFallback && !_isDropContestedByPeer(dropOrId);
    const timedOut = isObj && dropFallback && (dropOrId._pickupReqCount >= 2 || (now - dropOrId._pickupReqFirstAt) >= 380);
    if (localUncontested || timedOut) {
      if (typeof _completeNetworkDropPickup === 'function' && !_completeNetworkDropPickup(did, dropFallback)) return;
      _hostAuthoritativeDrops.delete(did);
      _roomDropsCache.delete(did);
      broadcastDropRemove(did);
      return;
    }
    if (wsConn && wsConn.readyState === 1 && wsSelfPeerId && _wsJoinedRoomId === activeRoomId) {
      try { wsConn.send(JSON.stringify({ type: 'drop_pickup_req', dropId: did, drop: dropFallback })); } catch (_) {}
      return;
    }
    sendCoopMsg({ type: 'drop_pickup_req', dropId: did, drop: dropFallback });
  }
  function broadcastDropRemove(dropIds) {
    if (!activeRoomId || !dropIds) return;
    const ids = Array.isArray(dropIds) ? dropIds : [dropIds];
    for (const rawId of ids) {
      const id = String(rawId);
      _roomDropsCache.delete(id);
      _hostAuthoritativeDrops.delete(id);
      if (!_dropRemoveQueue.includes(id)) _dropRemoveQueue.push(id);
    }
    if (_dropRemoveQueue.length >= 16) { flushDropRemoveBatch(); return; }
    if (!_dropRemoveTimer) _dropRemoveTimer = setTimeout(flushDropRemoveBatch, 45);
  }
  function broadcastMobSync(dim, list, opts = null) {
    if (!activeRoomId || !isSimAuthority() || !Array.isArray(list)) return;
    const pkt = { type: 'mob_sync', dim: dim || currentDimension, mobs: list };
    if (opts) {
      if (typeof opts.seq === 'number') pkt.seq = opts.seq;
      if (typeof opts.ts === 'number') pkt.ts = opts.ts;
      pkt.full = (opts.full !== false);
      if (Array.isArray(opts.rm) && opts.rm.length) pkt.rm = opts.rm;
    }
    sendCoopMsg(pkt);
  }
  function broadcastMobHit(uid, dmg, kx, kz, ky, isFire) {
    if (!activeRoomId || !uid) return;
    sendCoopMsg({ type: 'mob_hit', uid, dmg, kx, kz, ky, isFire: !!isFire });
  }
  function broadcastMobAction(uid, action, payload = null) {
    if (!activeRoomId || !uid) return;
    sendCoopMsg({ type: 'mob_action', uid, action, payload });
  }
  function broadcastMobRemove(uid) {
    if (!activeRoomId || !uid || !isSimAuthority()) return;
    sendCoopMsg({ type: 'mob_remove', uid });
  }
  function broadcastDoorToggle(wx, wy, wz, open) {
    if (!activeRoomId) return;
    sendCoopMsg({ type: 'door_toggle', dim: currentDimension, x: wx, y: wy, trueY: wy - (depthOffset || 0), z: wz, open: !!open });
  }
  function broadcastWeatherSync(mode, activeKind) {
    if (!activeRoomId || !isSimAuthority()) return;
    sendCoopMsg({ type: 'weather_sync', weatherMode: mode, activeWeatherKind: activeKind || '' });
  }

  function sendChunkedWelcome(sendFn, extraFields = {}) {
    const allMods = Array.from(worldMods.entries());
    const cData = (typeof serializeChestData === 'function') ? serializeChestData() : { chests: [], consumedLoot: [] };
    const peerSnap = [{
      peerId: localPeerId, name: localPlayerName, color: '#38bdf8',
      skinId: selectedSkinId, customSkin: (typeof getLocalCustomSkinPayload === 'function') ? getLocalCustomSkinPayload() : null, equip: player.equip,
      state: { dim: currentDimension, depthOffset: depthOffset || 0, x: player.x, y: player.y, trueY: player.y - (depthOffset || 0), z: player.z }
    }];
    for (const [pid, pr] of remotePlayers.entries()) {
      if (!pr.isBuddy && pid !== extraFields._to) {
        peerSnap.push({ peerId: pid, name: pr.name, color: pr.color, skinId: pr.skinId, state: { dim: pr.dim || 'overworld', depthOffset: pr.depthOffset || 0, x: pr.x, y: pr.y, trueY: pr.trueY !== undefined ? pr.trueY : pr.y, z: pr.z } });
      }
    }
    sendFn({
      type: 'p2p_welcome',
      ...extraFields,
      roomId: activeRoomId,
      hostId: localPeerId,
      world: { ...currentWorldMeta, ruinOriginX: _ruinOriginX, ruinOriginZ: _ruinOriginZ, weatherMode },
      dayTime,
      chests: cData.chests || [],
      consumedChests: cData.consumedLoot || [],
      drops: Array.from(_hostAuthoritativeDrops.values()).slice(-400),
      mobs: (typeof serializeMobsForNet === 'function') ? serializeMobsForNet(currentDimension) : [],
      mods: allMods.slice(0, 600),
      peers: peerSnap
    });
    for (let i = 600; i < allMods.length; i += 800) {
      sendFn({
        type: 'p2p_mods_chunk',
        ...extraFields,
        mods: allMods.slice(i, i + 800)
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
      const parsed = (typeof parseWorldModKey === 'function') ? parseWorldModKey(k) : null;
      if (parsed) {
        if (parsed.dim === currentDimension) setBlockWorld(parsed.mx, parsed.my + (depthOffset || 0), parsed.mz, v, false);
      } else {
        const c1 = k.indexOf(','), c2 = k.indexOf(',', c1 + 1);
        if (c1 >= 0 && c2 >= 0) {
          const mx = parseInt(k.slice(0, c1), 10), my = parseInt(k.slice(c1 + 1, c2), 10), mz = parseInt(k.slice(c2 + 1), 10);
          setBlockWorld(mx, my + (depthOffset || 0), mz, v, false);
        }
      }
    }
    isApplyingRemoteBlock = false;
  }

  const _mqttRelayStateAt = new Map();
  function _countNetRemotePeers() {
    let n = 0;
    for (const rp of remotePlayers.values()) if (rp && !rp.isBuddy) n++;
    return n;
  }
  function _canSendP2P(conn, isEphemeral) {
    if (!conn || !conn.open) return false;
    if (isEphemeral && conn.dataChannel && conn.dataChannel.bufferedAmount > 64000) return false;
    return true;
  }
  function sendCoopMsg(obj) {
    if (!activeRoomId) return;
    const isEphemeral = (obj.type === 'state' || (obj.type === 'mob_sync' && obj.full === false));
    if (p2pIsHost) {
      const hasP2P = p2pClientConns.size > 0;
      const hasMqtt = !!(mqttRoomTopic && mqttRoomPeers.size > 0);
      const hasBc = !!(bcChannel && bcRoomPeers.size > 0);
      const hasWs = !!(wsConn && wsConn.readyState === 1);
      if (!hasP2P && !hasMqtt && !hasBc && !hasWs) return;
      const pkt = { ...obj, _from: localPeerId };
      if (hasP2P) {
        for (const conn of p2pClientConns.values()) {
          if (_canSendP2P(conn, isEphemeral)) { try { conn.send(pkt); } catch (_) {} }
        }
      }
      if (hasMqtt) {
        const now = performance.now();
        if (obj.type !== 'state' || now - _lastMqttStateAt >= 78) {
          if (obj.type === 'state') _lastMqttStateAt = now;
          ncMqtt.publish(mqttRoomTopic, pkt, false, isEphemeral);
        }
      }
      if (hasWs && (obj.type !== 'state' || activeCoopTransport === 'ws' || _countNetRemotePeers() > p2pClientConns.size)) {
        if (!isEphemeral || wsConn.bufferedAmount <= 64000) {
          try { wsConn.send(JSON.stringify(obj)); } catch (_) {}
        }
      }
      if (hasBc) {
        try { bcChannel.postMessage({ ...pkt, _room: activeRoomId }); } catch (_) {}
      }
      return;
    }
    const pkt = { ...obj, _from: localPeerId };
    if (activeCoopTransport === 'p2p' && _canSendP2P(p2pHostConn, isEphemeral)) {
      try { p2pHostConn.send(pkt); return; } catch (_) {}
    } else if (activeCoopTransport === 'mqtt' && mqttRoomTopic) {
      const now = performance.now();
      if (obj.type !== 'state' || now - _lastMqttStateAt >= 78) {
        if (obj.type === 'state') _lastMqttStateAt = now;
        ncMqtt.publish(mqttRoomTopic, pkt, false, isEphemeral);
      }
      return;
    } else if (activeCoopTransport === 'ws' && wsConn && wsConn.readyState === 1) {
      if (!isEphemeral || wsConn.bufferedAmount <= 64000) {
        try { wsConn.send(JSON.stringify(obj)); } catch (_) {}
      }
      return;
    } else if (activeCoopTransport === 'bc' && bcChannel) {
      try { bcChannel.postMessage({ ...pkt, _room: activeRoomId }); } catch (_) {}
      return;
    }
    // Reliable fallback when primary transport (e.g. P2P DataChannel) drops or backs up
    if (!isEphemeral) {
      if (mqttRoomTopic) ncMqtt.publish(mqttRoomTopic, pkt, false, false);
      else if (wsConn && wsConn.readyState === 1) { try { wsConn.send(JSON.stringify(obj)); } catch (_) {} }
      else if (bcChannel) { try { bcChannel.postMessage({ ...pkt, _room: activeRoomId }); } catch (_) {} }
    }
  }


  const _hostSavedPlayers = new Map();
  function _getP2PRoomRelays(m) {
    return (m.type === 'state' || m.type === 'block' || m.type === 'chat' || m.type === 'chest_sync' || m.type === 'chest_break' || m.type === 'drop_batch' || m.type === 'drop_remove' || m.type === 'door_toggle' || m.type === 'mob_action' || m.type === 'leave' || m.type === 'peer_leave');
  }
  function handleIncomingP2PData(senderId, m, senderConn, viaTransport = 'p2p') {
    if (!m || typeof m !== 'object') return;
    if (m._relayBy && m._relayBy === localPeerId) return;
    const fromId = m._from || senderId;
    if (!fromId || fromId === localPeerId) return;
    if (m._to && m._to !== localPeerId) return;
    if (m._exclude && m._exclude === localPeerId) return;
    if (p2pIsHost) {
      if (m.type !== 'leave' && m.type !== 'peer_leave') {
        if (viaTransport === 'bc') bcRoomPeers.add(fromId);
        else if (viaTransport === 'mqtt') mqttRoomPeers.add(fromId);
      }
      if (_getP2PRoomRelays(m)) {
        const isRelEphem = (m.type === 'state');
        const needP2PRelay = p2pClientConns.size > (viaTransport === 'p2p' ? 1 : 0);
        const needMqttRelay = (viaTransport !== 'mqtt' && !!mqttRoomTopic && mqttRoomPeers.size > 0);
        const needWsRelay = (viaTransport !== 'ws' && m.type !== 'state' && !!wsConn && wsConn.readyState === 1);
        if (needP2PRelay || needMqttRelay || needWsRelay) {
          const relay = { ...m, _from: fromId, _relayBy: localPeerId };
          if (needP2PRelay) {
            for (const [cid, c] of p2pClientConns.entries()) {
              if (cid !== senderId && _canSendP2P(c, isRelEphem)) { try { c.send(relay); } catch (_) {} }
            }
          }
          if (needMqttRelay) {
            const nowR = performance.now();
            const prevR = _mqttRelayStateAt.get(fromId) || 0;
            if (!isRelEphem || (nowR - prevR) >= 78) {
              if (isRelEphem) _mqttRelayStateAt.set(fromId, nowR);
              ncMqtt.publish(mqttRoomTopic, relay, false, isRelEphem);
            }
          }
          if (needWsRelay) {
            try { wsConn.send(JSON.stringify(m)); } catch (_) {}
          }
        }
      }
      if (m.type === 'player_save' && m.playerKey && m.playerState) {
        _hostSavedPlayers.set(String(m.playerKey), m.playerState);
        return;
      }
      if (m.type === 'drop_batch' && Array.isArray(m.drops)) {
        for (const d of m.drops) if (d && d.dropId) { _hostAuthoritativeDrops.set(String(d.dropId), d); _roomDropsCache.set(String(d.dropId), d); }
      } else if (m.type === 'drop_pickup_req' && m.dropId) {
        const did = String(m.dropId);
        const d = _hostAuthoritativeDrops.get(did) || _roomDropsCache.get(did) || (m.drop && m.drop.id ? m.drop : null);
        _hostAuthoritativeDrops.delete(did); _roomDropsCache.delete(did);
        if (!d) {
          sendCoopMsg({ type: 'drop_remove', dropId: did });
          return;
        }
        const ackPkt = { type: 'drop_pickup_ack', _from: localPeerId, _to: fromId, dropId: did, drop: d };
        if (senderConn && senderConn.open) { try { senderConn.send(ackPkt); } catch (_) {} }
        else if (viaTransport === 'mqtt' && mqttRoomTopic) ncMqtt.publish(mqttRoomTopic, ackPkt);
        else if (viaTransport === 'bc' && bcChannel) { try { bcChannel.postMessage({ ...ackPkt, _room: activeRoomId }); } catch (_) {} }
        sendCoopMsg({ type: 'drop_remove', dropId: did, _exclude: fromId });
        return;
      } else if (m.type === 'mob_hit' && typeof applyRemoteMobHit === 'function') {
        applyRemoteMobHit(m);
        return;
      }
      if (m.type === 'p2p_hello') {
        if (senderConn) senderConn._ncPeerId = fromId;
        const rp = ensureRemotePeer(fromId, m.name || 'Bạn Chơi', '#4ade80', false, m.skinId, m.playerKey || '', m.customSkin || null);
        if (m.equip) applyArmorToPlayerRig(rp.rig, m.equip);
        const hItem = (m.state && m.state.held !== undefined) ? m.state.held : (m.held !== undefined ? m.held : undefined);
        if (hItem !== undefined) setRigHeldItem(rp.rig, hItem);
        const sp = m.playerKey ? (_hostSavedPlayers.get(String(m.playerKey)) || null) : null;
        if (typeof resetMobNetSyncCache === 'function') resetMobNetSyncCache();
        if (viaTransport === 'mqtt') {
          mqttRoomPeers.add(fromId);
          sendChunkedWelcome((pkt) => ncMqtt.publish(mqttRoomTopic, { ...pkt, _from: localPeerId }), { _to: fromId, savedPlayer: sp });
        } else if (senderConn) {
          sendChunkedWelcome((pkt) => { try { senderConn.send(pkt); } catch (_) {} }, { savedPlayer: sp });
        }
        showToast(`🌐 ${m.name || 'Bạn chơi'} đã kết nối vào phòng ${activeRoomId}!`);
        return;
      }
    }
    if (m.type === 'p2p_welcome') {
      if (!pendingJoinCb && activeRoomId && activeRoomId === (m.roomId || activeRoomId)) return;
      const extra = { hostId: m.hostId, chests: m.chests, consumedChests: m.consumedChests, drops: m.drops, mobs: m.mobs, savedPlayer: m.savedPlayer };
      if (pendingJoinCb) {
        pendingJoinCb(viaTransport, m.roomId || activeRoomId, m.world, m.mods || [], m.peers || [], m.dayTime, extra);
      } else {
        activeRoomId = m.roomId || activeRoomId;
        applyJoinedWorld(m.world, m.mods || [], m.peers || [], m.dayTime, extra);
      }
      return;
    }
    if (m.type === 'p2p_mods_chunk') {
      if (isWorldLoading && Array.isArray(m.mods)) _pendingWsMods.push(...m.mods);
      applyModsChunkList(m.mods);
      return;
    }
    if (m.type === 'skin_sync') {
      ensureRemotePeer(fromId, m.name || 'Bạn Chơi', '#4ade80', false, m.skinId || null, m.playerKey || '', m.customSkin || null);
    } else if (m.type === 'state' && m.state) {
      const rp = ensureRemotePeer(fromId, m.name || 'Bạn Chơi', '#4ade80', false, m.skinId, m.playerKey || '', m.customSkin || null);
      applyRemotePeerState(rp, m.state, m.equip);
    } else if (m.type === 'block') {
      const bDim = m.dim || 'overworld';
      const ty = (typeof m.trueY === 'number') ? m.trueY : m.y;
      const mk = m.key || ((typeof dimModKey === 'function') ? dimModKey(m.x, ty + (depthOffset || 0), m.z, bDim) : modKey(m.x, ty, m.z));
      worldMods.set(mk, m.id);
      if (bDim === currentDimension) {
        isApplyingRemoteBlock = true; setBlockWorld(m.x, ty + (depthOffset || 0), m.z, m.id, true); isApplyingRemoteBlock = false;
      }
    } else if (m.type === 'chest_sync') {
      _applyRemoteChestSync(m);
    } else if (m.type === 'chest_break') {
      _applyRemoteChestBreak(m);
    } else if (m.type === 'drop_batch' || m.type === 'drop_spawn') {
      _applyRemoteDropBatch(Array.isArray(m.drops) ? m.drops : (m.drop ? [m.drop] : []));
    } else if (m.type === 'drop_pickup_ack') {
      _roomDropsCache.delete(String(m.dropId));
      if (typeof _completeNetworkDropPickup === 'function') _completeNetworkDropPickup(m.dropId, m.drop);
    } else if (m.type === 'drop_remove') {
      const ids = Array.isArray(m.dropIds) ? m.dropIds : (m.dropId ? [m.dropId] : []);
      for (const did of ids) { _roomDropsCache.delete(String(did)); _hostAuthoritativeDrops.delete(String(did)); if (typeof removeDroppedItemById === 'function') removeDroppedItemById(did); }
    } else if (m.type === 'mob_sync') {
      if (!isSimAuthority() && typeof applyRemoteMobSync === 'function') applyRemoteMobSync(m.mobs, m.dim, m.full !== false, m);
    } else if (m.type === 'mob_action') {
      if (typeof applyRemoteMobAction === 'function') applyRemoteMobAction(m);
    } else if (m.type === 'mob_remove') {
      if (!isSimAuthority() && typeof applyRemoteMobRemove === 'function') applyRemoteMobRemove(m.uid);
    } else if (m.type === 'mob_player_hit') {
      if ((!m.dim || m.dim === currentDimension) && !player.dead && gameMode !== 'creative' && typeof hurtPlayer === 'function') {
        hurtPlayer(Number(m.dmg) || 2, m.msg || 'Bạn bị quái vật tấn công!', !!m.ignoreArmor, m.canBlock !== false, { fromPos: { x: Number(m.fx) || player.x, z: Number(m.fz) || player.z }, isAxe: !!m.isAxe });
        if (m.kbY) { player.vy = Math.max(player.vy, Number(m.kbY) || 0); cameraShake = Math.max(cameraShake, 0.22); }
        if (m.disableShield) player.shieldDisableT = Math.max(player.shieldDisableT || 0, Number(m.disableShield) || 0);
      }
    } else if (m.type === 'door_toggle') {
      if ((!m.dim || m.dim === currentDimension) && typeof setDoorOpenPair === 'function') {
        const wy = (typeof m.trueY === 'number') ? (m.trueY + (depthOffset || 0)) : m.y;
        setDoorOpenPair(m.x, wy, m.z, !!m.open, true, true);
      }
    } else if (m.type === 'weather_sync') {
      if (!isSimAuthority() && typeof applyRemoteWeatherSync === 'function') applyRemoteWeatherSync(m);
    } else if (m.type === 'chat' && m.text) {
      appendChatLine(m.name || 'Bạn Chơi', m.text, false);
    } else if (m.type === 'leave' || m.type === 'peer_leave') {
      const byeId = m.peerId || fromId;
      if (m.type === 'peer_leave' || viaTransport === 'mqtt') mqttRoomPeers.delete(byeId);
      if (m.type === 'peer_leave' || viaTransport === 'bc') bcRoomPeers.delete(byeId);
      const stillActive = (m.type === 'leave') && (bcRoomPeers.has(byeId) || mqttRoomPeers.has(byeId) || Array.from(p2pClientConns.values()).some(c => c && c.open && (c._ncPeerId === byeId || c.peer === byeId)));
      if (!stillActive) {
        removeRemotePeer(byeId);
        if (p2pIsHost && m.type === 'leave') {
          sendCoopMsg({ type: 'peer_leave', peerId: byeId, name: m.name || '' });
        }
      }
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
    if (activeRoomId) { try { schedulePlayerRoomSave(true); } catch (_) {} }
    if (_cancelActiveJoin) { try { _cancelActiveJoin(); } catch (_) {} _cancelActiveJoin = null; }
    pendingJoinCb = null;
    _wsRoomHostId = '';
    _wsJoinedRoomId = '';
    _pendingWsMods.length = 0;
    _hostAuthoritativeDrops.clear();
    _roomDropsCache.clear();
    _dropBatchQueue.length = 0;
    if (_dropBatchTimer) { clearTimeout(_dropBatchTimer); _dropBatchTimer = null; }
    _dropRemoveQueue.length = 0;
    if (_dropRemoveTimer) { clearTimeout(_dropRemoveTimer); _dropRemoveTimer = null; }
    if (typeof clearClaimedDrops === 'function') clearClaimedDrops();
    if (activeRoomId) {
      try { sendCoopMsg({ type: 'leave' }); } catch (_) {}
    }
    if (mqttRoomUnsub) { try { mqttRoomUnsub(); } catch (_) {} mqttRoomUnsub = null; }
    mqttRoomTopic = null;
    mqttRoomPeers.clear();
    bcRoomPeers.clear();
    _mqttRelayStateAt.clear();
    if (typeof resetMobNetSyncCache === 'function') resetMobNetSyncCache();
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
    const ty = wy - (depthOffset || 0);
    const key = (typeof dimModKey === 'function') ? dimModKey(wx, wy, wz, currentDimension) : modKey(wx, ty, wz);
    sendCoopMsg({ type: 'block', key, dim: currentDimension, x: wx, y: wy, trueY: ty, z: wz, id });
  }

  function initBroadcastChannelFallback() {
    if (bcChannel || typeof BroadcastChannel === 'undefined') return;
    bcChannel = new BroadcastChannel('luanti_coop_v14');
    bcChannel.onmessage = (ev) => {
      const m = ev.data;
      if (!m || m._from === localPeerId) return;
      if (m.type === 'bc_join_req' && p2pIsHost && activeRoomId && m.roomId === activeRoomId) {
        bcRoomPeers.add(m._from);
        if (typeof resetMobNetSyncCache === 'function') resetMobNetSyncCache();
        const modsArr = Array.from(worldMods.entries());
        const cData = (typeof serializeChestData === 'function') ? serializeChestData() : { chests: [], consumedLoot: [] };
        const sp = m.playerKey ? (_hostSavedPlayers.get(String(m.playerKey)) || null) : null;
        bcChannel.postMessage({
          type: 'bc_join_ack', _from: localPeerId, _room: activeRoomId, target: m._from,
          world: { ...currentWorldMeta, ruinOriginX: _ruinOriginX, ruinOriginZ: _ruinOriginZ, weatherMode },
          dayTime, mods: modsArr, hostName: localPlayerName,
          hostSkinId: selectedSkinId,
          hostState: { dim: currentDimension, depthOffset: depthOffset || 0, x: player.x, y: player.y, trueY: player.y - (depthOffset || 0), z: player.z },
          chests: cData.chests || [], consumedChests: cData.consumedLoot || [],
          drops: Array.from(_hostAuthoritativeDrops.values()).slice(-400),
          mobs: (typeof serializeMobsForNet === 'function') ? serializeMobsForNet(currentDimension) : [],
          savedPlayer: sp
        });
        ensureRemotePeer(m._from, m.name, '#4ade80');
        showToast(`👥 ${m.name} đã vào phòng ${activeRoomId}!`);
      } else if (m.type === 'bc_join_ack' && m.target === localPeerId) {
        if (!pendingJoinCb && activeRoomId === m._room) return;
        const peers = [{ peerId: m._from, name: m.hostName, color: '#38bdf8', skinId: m.hostSkinId, state: m.hostState }];
        const extra = { hostId: m._from, chests: m.chests, consumedChests: m.consumedChests, drops: m.drops, mobs: m.mobs, savedPlayer: m.savedPlayer };
        if (pendingJoinCb) {
          pendingJoinCb('bc', m._room, m.world, m.mods || [], peers, m.dayTime, extra);
        } else {
          activeRoomId = m._room;
          activeCoopTransport = 'bc';
          applyJoinedWorld(m.world, m.mods || [], peers, m.dayTime, extra);
        }
      } else if (activeRoomId && m._room === activeRoomId) {
        if (!p2pIsHost && activeCoopTransport !== 'bc') return;
        handleIncomingP2PData(m._from, m, null, 'bc');
      }
    };
  }

  function applyJoinedWorld(w, mods, peers, srvDayTime, extra = {}) {
    w = w || {};
    extra = extra || {};
    isWorldLoading = false;
    window._optionsOpenedFromLobby = false;
    if (typeof closeLobbySub === 'function') closeLobbySub();
    document.getElementById('lobbyScreen')?.classList.add('hidden');
    document.body.classList.remove('in-lobby');
    showWorldLoadingOverlay(
      'Đang vào phòng Co-op...',
      `Đang tải khu vực thế giới "${w.worldName || w.name || 'Phòng Co-op'}"...`,
      () => {
        currentWorldMeta = { id: 'coop_' + activeRoomId, name: w.worldName || w.name || 'Phòng Co-op', seed: w.seed || 133742, mode: w.mode || 'survival', biome: w.biome || 'sakura', preset: w.preset || 'eclipse' };
        gameMode = currentWorldMeta.mode;
        if (extra.hostId) _wsRoomHostId = extra.hostId;
        if (extra.isHost) p2pIsHost = true;
        resetWorld(currentWorldMeta.seed, { deferSpawnChunks: true });
        if (typeof w.ruinOriginX === 'number' && typeof w.ruinOriginZ === 'number') {
          _ruinOriginX = w.ruinOriginX; _ruinOriginZ = w.ruinOriginZ;
          _ruinLocSeed = -1; _shLocSeed = -1; _acLocSeed = -1;
        }
        if (typeof w.weatherMode === 'string') weatherMode = w.weatherMode;
        if (typeof applyRemoteWeatherSync === 'function' && (w.weatherMode || w.activeWeatherKind)) applyRemoteWeatherSync(w);
        _clearWorldInteractiveCaches(false, false);
        const allIncomingMods = [];
        if (Array.isArray(mods)) allIncomingMods.push(...mods);
        if (_pendingWsMods.length) { allIncomingMods.push(..._pendingWsMods); _pendingWsMods.length = 0; }
        for (const [k, v] of allIncomingMods) { worldMods.set(k, v); indexWorldModKey(k, v); }
        if (typeof rebuildCurrentDimModIndex === 'function') rebuildCurrentDimModIndex();
        if (typeof restoreChestData === 'function') {
          restoreChestData({ chests: extra.chests || [], consumedLoot: extra.consumedChests || [] });
        }
        const dtVal = (typeof srvDayTime === 'number') ? srvDayTime : w.dayTime;
        if (typeof dtVal === 'number') dayTime = dtVal;

        const savedP = extra.savedPlayer || _loadLocalCoopPlayerBackup(activeRoomId);
        const restoredSelf = !!(savedP && applySavedPlayerRoomState(savedP));
        if (!restoredSelf) {
          let sx = _ruinOriginX + 0.5, sz = _ruinOriginZ + 0.5, sy = 14, targetDim = 'overworld', targetDepth = 0;
          const hostPeer = Array.isArray(peers) ? (peers.find(p => p && p.peerId === _wsRoomHostId) || peers[0]) : null;
          if (hostPeer && hostPeer.state && Number.isFinite(hostPeer.state.x) && Number.isFinite(hostPeer.state.z)) {
            targetDim = hostPeer.state.dim || 'overworld';
            targetDepth = Number(hostPeer.state.depthOffset) || 0;
            sx = hostPeer.state.x + 2.2; sz = hostPeer.state.z + 2.2;
            sy = (typeof hostPeer.state.trueY === 'number') ? (hostPeer.state.trueY + targetDepth) : (Number(hostPeer.state.y) || 14);
          } else {
            const rawSp = findSafeSpawnPoint(_ruinOriginX, _ruinOriginZ, true);
            const sp = landPlayerScenic(rawSp.x, rawSp.z, rawSp.yaw);
            sx = sp.x; sy = sp.y; sz = sp.z;
          }
          if (targetDim !== currentDimension && typeof switchDimension === 'function') switchDimension(targetDim, null, { skipSpawnMove: true });
          depthOffset = targetDepth;
          if (typeof rebuildCurrentDimModIndex === 'function') rebuildCurrentDimModIndex();
          const pcx = Math.floor(sx) >> 4, pcz = Math.floor(sz) >> 4;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(pcx + dx, pcz + dz);
          for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
          player.x = sx; player.z = sz;
          player.y = hostPeer ? sy : Math.max(sy, colGroundY(Math.floor(sx), Math.floor(sz)) + 1.05);
          player.vx = player.vy = player.vz = 0; player.fallStartY = player.y;
          schedulePlayerRoomSave(true);
        }

        if (Array.isArray(extra.drops)) _applyRemoteDropBatch(extra.drops);
        const dimMobs = (extra.mobsByDim && Array.isArray(extra.mobsByDim[currentDimension]))
          ? extra.mobsByDim[currentDimension]
          : (Array.isArray(extra.mobs) ? extra.mobs : null);
        if (dimMobs && typeof applyRemoteMobSync === 'function') applyRemoteMobSync(dimMobs, currentDimension, true);

        for (const rp of Array.from(remotePlayers.keys())) removeRemotePeer(rp);
        if (Array.isArray(peers)) {
          for (const p of peers) {
            if (!p || p.peerId === localPeerId || p.peerId === wsSelfPeerId) continue;
            const rp = ensureRemotePeer(p.peerId, p.name, p.color || '#38bdf8', false, p.skinId || null, p.playerKey || '', p.customSkin || null);
            if (p.equip) applyArmorToPlayerRig(rp.rig, p.equip);
            if (p.state) applyRemotePeerState(rp, p.state, p.equip);
          }
        }
        applyShaderPreset(currentWorldMeta.preset);
        updateRoomBadgeUI();
        showToast(restoredSelf ? `🌐 Đã quay lại phòng ${activeRoomId} tại vị trí & túi đồ cũ!` : `🌐 Đã vào phòng ${activeRoomId} thành công!`);
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
    if (wsConn && wsConn.readyState === 0) {
      if (onReady) {
        const prevSock = wsConn;
        prevSock.addEventListener('open', () => onReady(prevSock === wsConn && prevSock.readyState === 1), { once: true });
        prevSock.addEventListener('error', () => onReady(false), { once: true });
      }
      return;
    }
    try {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const sock = new WebSocket(`${wsProto}//${location.host}/ws`);
      wsConn = sock;
      sock.onopen = () => {
        if (sock !== wsConn || sock.readyState !== 1) return;
        const stEl = document.getElementById('coopServerStatus');
        if (stEl && !activeRoomId) stEl.innerHTML = `🔌 Máy chủ Co-op LAN &amp; Internet: <b style="color:#4ade80;">Đã kết nối (${escHtml(location.host)}) ✓</b>`;
        try {
          sock.send(JSON.stringify({ type: 'list_rooms' }));
          const uid = (typeof getLockedPlayerUid === 'function' && getLockedPlayerUid()) || '';
          if (uid) sock.send(JSON.stringify({ type: 'register_uid', uid }));
        } catch (_) {}
        if (onReady) onReady(true);
      };
      sock.onerror = () => {
        if (sock !== wsConn) return;
        initBroadcastChannelFallback();
        const stEl = document.getElementById('coopServerStatus');
        if (stEl && !activeRoomId) stEl.innerHTML = '🌐 Chế độ Internet Relay: <b style="color:#4ade80;">Sẵn sàng kết nối xuyên mạng Wi-Fi / 4G ✓</b>';
        if (onReady) onReady(false);
      };
      sock.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
        if (msg.type === 'room_joined') {
          if (!pendingJoinCb && activeRoomId && activeCoopTransport && activeCoopTransport !== 'ws' && activeCoopTransport !== 'host') {
            if (sock.readyState === 1) { try { sock.send(JSON.stringify({ type: 'leave' })); } catch (_) {} }
            return;
          }
          wsSelfPeerId = msg.peerId;
          _wsJoinedRoomId = msg.roomId || '';
          _wsRoomHostId = msg.hostId || (msg.isHost ? msg.peerId : '');
          const joinExtra = { hostId: _wsRoomHostId, isHost: !!msg.isHost, reusePrev: !!msg.reusePrev, chests: msg.chests, consumedChests: msg.consumedChests, drops: msg.drops, mobsByDim: msg.mobsByDim, savedPlayer: msg.savedPlayer };
          if (pendingJoinCb) {
            pendingJoinCb('ws', msg.roomId, msg.world, msg.mods, msg.peers, msg.world && msg.world.dayTime, joinExtra);
          } else if (!msg.isHost || msg.reusePrev) {
            activeRoomId = msg.roomId;
            activeCoopTransport = msg.isHost ? 'host' : 'ws';
            p2pIsHost = !!msg.isHost;
            if (!isPlaying && !msg.isHost) {
              applyJoinedWorld(msg.world, msg.mods, msg.peers, msg.world && msg.world.dayTime, joinExtra);
            } else {
              if (msg.world && typeof msg.world.dayTime === 'number') dayTime = msg.world.dayTime;
              if (msg.world && typeof applyRemoteWeatherSync === 'function' && (msg.world.weatherMode || msg.world.activeWeatherKind)) applyRemoteWeatherSync(msg.world);
              if (Array.isArray(msg.mods) && msg.mods.length && (msg.reusePrev || worldMods.size === 0)) applyModsChunkList(msg.mods);
              if (typeof restoreChestData === 'function' && msg.reusePrev) restoreChestData({ chests: msg.chests || [], consumedLoot: msg.consumedChests || [] });
              if (Array.isArray(msg.drops)) _applyRemoteDropBatch(msg.drops);
              if (msg.savedPlayer && msg.reusePrev && isPlaying && !(msg.isHost && (Date.now() - (window._justLoadedLocalSaveAt || 0)) < 6000)) applySavedPlayerRoomState(msg.savedPlayer);
              if (Array.isArray(msg.peers)) {
                for (const p of msg.peers) {
                  if (!p || p.peerId === localPeerId || p.peerId === wsSelfPeerId) continue;
                  const rp = ensureRemotePeer(p.peerId, p.name, p.color || '#38bdf8', false, p.skinId || null, p.playerKey || '', p.customSkin || null);
                  if (p.equip) applyArmorToPlayerRig(rp.rig, p.equip);
                  if (p.state) applyRemotePeerState(rp, p.state, p.equip);
                }
              }
              updateRoomBadgeUI();
              if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
            }
          } else {
            p2pIsHost = true;
            if (!activeRoomId) activeRoomId = msg.roomId;
            if (!activeCoopTransport) activeCoopTransport = 'host';
            if (Array.isArray(msg.mods) && msg.mods.length && worldMods.size === 0) applyModsChunkList(msg.mods);
            if (msg.savedPlayer && isPlaying && (Date.now() - (window._justLoadedLocalSaveAt || 0)) >= 6000) applySavedPlayerRoomState(msg.savedPlayer);
            updateRoomBadgeUI();
            if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
          }
        } else if (msg.type === 'room_roster') {
          if (activeRoomId && msg.roomId === activeRoomId && Array.isArray(msg.peers)) {
            if (msg.hostId) {
              _wsRoomHostId = msg.hostId;
              p2pIsHost = !!(wsSelfPeerId && _wsRoomHostId === wsSelfPeerId);
            }
            const liveIds = new Set(msg.peers.map(p => p && p.peerId).filter(Boolean));
            for (const c of p2pClientConns.values()) {
              if (c && c.open) { if (c._ncPeerId) liveIds.add(c._ncPeerId); liveIds.add(c.peer); }
            }
            for (const pid of mqttRoomPeers) liveIds.add(pid);
            for (const pid of bcRoomPeers) liveIds.add(pid);
            for (const [pid, rp] of Array.from(remotePlayers.entries())) {
              if (!rp.isBuddy && !liveIds.has(pid)) removeRemotePeer(pid);
            }
            for (const p of msg.peers) {
              if (!p || !p.peerId || p.peerId === wsSelfPeerId || p.peerId === localPeerId) continue;
              ensureRemotePeer(p.peerId, p.name, p.color || '#38bdf8', false, p.skinId || null, p.playerKey || '');
            }
            updateRoomBadgeUI();
            if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
          }
        } else if (msg.type === 'host_promote') {
          p2pIsHost = true;
          _wsRoomHostId = wsSelfPeerId;
          activeCoopTransport = 'host';
          if (typeof resetMobNetSyncCache === 'function') resetMobNetSyncCache();
          updateRoomBadgeUI();
          if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
          showToast('👑 Chủ phòng đã rời — bạn là Chủ Phòng mới!');
        } else if (msg.type === 'host_changed') {
          _wsRoomHostId = msg.hostId || '';
          p2pIsHost = !!(wsSelfPeerId && _wsRoomHostId === wsSelfPeerId);
          updateRoomBadgeUI();
          if (typeof inPauseMenu !== 'undefined' && inPauseMenu && typeof renderPausePlayersList === 'function') renderPausePlayersList();
        } else if (msg.type === 'ws_mods_chunk') {
          if (isWorldLoading && Array.isArray(msg.mods)) _pendingWsMods.push(...msg.mods);
          applyModsChunkList(msg.mods);
        } else if (msg.type === 'peer_join') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) {
            if (p2pIsHost && typeof resetMobNetSyncCache === 'function') resetMobNetSyncCache();
            ensureRemotePeer(msg.peerId, msg.name, msg.color || '#f472b6', false, msg.skinId || null, msg.playerKey || '', msg.customSkin || null);
            showToast(`👥 ${msg.name} đã tham gia phòng ${activeRoomId}!`);
          }
        } else if (msg.type === 'skin_sync') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId && msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) {
            ensureRemotePeer(msg.peerId, null, '#f472b6', false, msg.skinId || null, '', msg.customSkin || null);
          }
        } else if (msg.type === 'peer_leave') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) {
            const stillOnOther = bcRoomPeers.has(msg.peerId) || mqttRoomPeers.has(msg.peerId) || Array.from(p2pClientConns.values()).some(c => c && c.open && (c._ncPeerId === msg.peerId || c.peer === msg.peerId));
            if (!stillOnOther) {
              removeRemotePeer(msg.peerId);
              showToast(`👋 ${msg.name || 'Người chơi'} đã rời phòng.`);
            }
          }
        } else if (msg.type === 'peer_state' && msg.state) {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId === wsSelfPeerId || msg.peerId === localPeerId) return;
          const rp = ensureRemotePeer(msg.peerId, msg.name, msg.color || '#f472b6', false, msg.skinId || null, msg.playerKey || '', msg.customSkin || null);
          applyRemotePeerState(rp, msg.state, msg.equip);
          if (p2pIsHost) {
            const relay = { type: 'state', _from: msg.peerId, _relayBy: localPeerId, name: msg.name, skinId: msg.skinId || null, equip: msg.equip || null, state: msg.state };
            for (const c of p2pClientConns.values()) if (_canSendP2P(c, true)) { try { c.send(relay); } catch (_) {} }
            if (mqttRoomTopic && mqttRoomPeers.size > 0) {
              const nowR = performance.now();
              const prevR = _mqttRelayStateAt.get(msg.peerId) || 0;
              if ((nowR - prevR) >= 78) {
                _mqttRelayStateAt.set(msg.peerId, nowR);
                ncMqtt.publish(mqttRoomTopic, relay, false, true);
              }
            }
          }
        } else if (msg.type === 'block') {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId === wsSelfPeerId || msg.peerId === localPeerId) return;
          const bDim = msg.dim || 'overworld';
          const ty = (typeof msg.trueY === 'number') ? msg.trueY : msg.y;
          const mk = msg.key || ((typeof dimModKey === 'function') ? dimModKey(msg.x, ty + (depthOffset || 0), msg.z, bDim) : modKey(msg.x, ty, msg.z));
          worldMods.set(mk, msg.id);
          if (bDim === currentDimension) {
            isApplyingRemoteBlock = true; setBlockWorld(msg.x, ty + (depthOffset || 0), msg.z, msg.id, true); isApplyingRemoteBlock = false;
          }
          if (p2pIsHost) {
            const relay = { type: 'block', _from: msg.peerId, _relayBy: localPeerId, key: mk, dim: bDim, x: msg.x, y: msg.y, trueY: ty, z: msg.z, id: msg.id };
            for (const c of p2pClientConns.values()) if (c && c.open) { try { c.send(relay); } catch (_) {} }
            if (mqttRoomTopic && mqttRoomPeers.size > 0) ncMqtt.publish(mqttRoomTopic, relay);
          }
        } else if (msg.type === 'chest_sync') {
          _applyRemoteChestSync(msg);
        } else if (msg.type === 'chest_break') {
          _applyRemoteChestBreak(msg);
        } else if (msg.type === 'drop_batch' || msg.type === 'drop_spawn') {
          _applyRemoteDropBatch(Array.isArray(msg.drops) ? msg.drops : (msg.drop ? [msg.drop] : []));
        } else if (msg.type === 'drop_pickup_ack') {
          _roomDropsCache.delete(String(msg.dropId));
          if (typeof _completeNetworkDropPickup === 'function') _completeNetworkDropPickup(msg.dropId, msg.drop);
        } else if (msg.type === 'drop_remove') {
          const ids = Array.isArray(msg.dropIds) ? msg.dropIds : (msg.dropId ? [msg.dropId] : []);
          for (const did of ids) { _roomDropsCache.delete(String(did)); _hostAuthoritativeDrops.delete(String(did)); if (typeof removeDroppedItemById === 'function') removeDroppedItemById(did); }
        } else if (msg.type === 'mob_sync') {
          if (!isSimAuthority() && typeof applyRemoteMobSync === 'function') applyRemoteMobSync(msg.mobs, msg.dim, msg.full !== false, msg);
        } else if (msg.type === 'mob_hit') {
          if (isSimAuthority() && typeof applyRemoteMobHit === 'function') applyRemoteMobHit(msg);
        } else if (msg.type === 'mob_action') {
          if (typeof applyRemoteMobAction === 'function') applyRemoteMobAction(msg);
        } else if (msg.type === 'mob_remove') {
          if (!isSimAuthority() && typeof applyRemoteMobRemove === 'function') applyRemoteMobRemove(msg.uid);
        } else if (msg.type === 'mob_player_hit') {
          if ((!msg.dim || msg.dim === currentDimension) && !player.dead && gameMode !== 'creative' && typeof hurtPlayer === 'function') {
            hurtPlayer(Number(msg.dmg) || 2, msg.msg || 'Bạn bị quái vật tấn công!', !!msg.ignoreArmor, msg.canBlock !== false, { fromPos: { x: Number(msg.fx) || player.x, z: Number(msg.fz) || player.z }, isAxe: !!msg.isAxe });
            if (msg.kbY) { player.vy = Math.max(player.vy, Number(msg.kbY) || 0); cameraShake = Math.max(cameraShake, 0.22); }
            if (msg.disableShield) player.shieldDisableT = Math.max(player.shieldDisableT || 0, Number(msg.disableShield) || 0);
          }
        } else if (msg.type === 'door_toggle') {
          if ((!msg.dim || msg.dim === currentDimension) && typeof setDoorOpenPair === 'function') {
            const wy = (typeof msg.trueY === 'number') ? (msg.trueY + (depthOffset || 0)) : msg.y;
            setDoorOpenPair(msg.x, wy, msg.z, !!msg.open, true, true);
          }
        } else if (msg.type === 'weather_sync') {
          if (!isSimAuthority() && typeof applyRemoteWeatherSync === 'function') applyRemoteWeatherSync(msg);
        } else if (msg.type === 'ruin_origin') {
          if (typeof msg.x === 'number' && typeof msg.z === 'number') {
            _ruinOriginX = msg.x; _ruinOriginZ = msg.z; _ruinLocSeed = -1; _shLocSeed = -1; _acLocSeed = -1;
          }
        } else if (msg.type === 'chat' && msg.text) {
          if (!activeRoomId || (!p2pIsHost && activeCoopTransport !== 'ws')) return;
          if (msg.peerId !== wsSelfPeerId && msg.peerId !== localPeerId) appendChatLine(msg.name || 'Bạn Chơi', msg.text, false);
        } else if (msg.type === 'rooms_list') {
          const rList = msg.rooms || [];
          updateLiveRoomsCache(rList);
          renderOpenRoomsList(rList);
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
      const cnt = Number(r.players) || 0;
      const row = document.createElement('div');
      row.className = 'world-item';
      row.innerHTML = `<div class="world-meta"><b>Phòng ${escHtml(r.roomId)} — ${escHtml(r.worldName)}</b><small>${cnt > 0 ? `<span style="color:#4ade80;">🟢 Đang chơi: ${cnt} người</span>` : '<span style="color:#94a3b8;">⚪ Chờ người chơi (0 người)</span>'} • ${r.mode === 'creative' ? 'Sáng Tạo' : 'Sinh Tồn'}</small></div>`;
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

  function hostCoopRoom(preferredRoomId = null) {
    leaveCoopRoom();
    initBroadcastChannelFallback();
    const isFreshCreate = !!window._nextCreateRoomFresh;
    window._nextCreateRoomFresh = false;
    const rawPref = preferredRoomId || (typeof currentWorldMeta !== 'undefined' && currentWorldMeta && currentWorldMeta.roomId) || '';
    const cleanPref = String(rawPref).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const id = (cleanPref.length >= 4 && cleanPref.length <= 8) ? cleanPref : mintPermanentRoomCode();
    if (typeof currentWorldMeta !== 'undefined' && currentWorldMeta) currentWorldMeta.roomId = id;
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
            const leftId = conn._ncPeerId || conn.peer;
            removeRemotePeer(leftId);
            if (p2pIsHost) sendCoopMsg({ type: 'peer_leave', peerId: leftId });
          });
          conn.on('error', () => {
            p2pClientConns.delete(conn.peer);
            const leftId = conn._ncPeerId || conn.peer;
            removeRemotePeer(leftId);
            if (p2pIsHost) sendCoopMsg({ type: 'peer_leave', peerId: leftId });
          });
        });
        p2pPeer.on('error', () => {
          showToast(`🌐 Đã mở Phòng Relay/LAN • Mã Phòng: ${id}`);
        });
      } catch (_) {}
    });

    // 3) LAN WebSocket on server.js (pass exact same roomId + unified clientId!)
    connectCoopSocket((online) => {
      if (online && wsConn && wsConn.readyState === 1 && activeRoomId === id && p2pIsHost) {
        const allMods = Array.from(worldMods.entries());
        const cData = (typeof serializeChestData === 'function') ? serializeChestData() : { chests: [], consumedLoot: [] };
        wsConn.send(JSON.stringify({
          type: 'create_room', roomId: id, clientId: localPeerId, playerKey: getLocalPlayerSaveKey(),
          fresh: isFreshCreate,
          name: localPlayerName, skinId: selectedSkinId, customSkin: (typeof getLocalCustomSkinPayload === 'function') ? getLocalCustomSkinPayload() : null,
          seed: worldSeed, worldName: currentWorldMeta.name, mode: gameMode, biome: currentWorldMeta.biome,
          preset: shaderPreset, dayTime, weatherMode,
          ruinOriginX: _ruinOriginX, ruinOriginZ: _ruinOriginZ,
          chests: cData.chests || [], consumedChests: cData.consumedLoot || [],
          state: { dim: currentDimension, depthOffset: depthOffset || 0, x: player.x, y: player.y, trueY: player.y - (depthOffset || 0), z: player.z, yaw: player.yaw, pitch: player.pitch },
          mods: allMods.slice(0, 2500)
        }));
        for (let i = 2500; i < allMods.length; i += 2500) {
          wsConn.send(JSON.stringify({ type: 'mods_push', initSeedOnly: true, mods: allMods.slice(i, i + 2500) }));
        }
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
    let joinTimer = null, helloTimer = null, p2pRetryTimer = null, remoteDelayTimer = null, mqttDelayTimer = null;
    let guestMqttUnsub = null;
    const topic = `${MQTT_NS}/room/${roomId}`;

    const cleanupTimers = () => {
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null; }
      if (p2pRetryTimer) { clearTimeout(p2pRetryTimer); p2pRetryTimer = null; }
      if (remoteDelayTimer) { clearTimeout(remoteDelayTimer); remoteDelayTimer = null; }
      if (mqttDelayTimer) { clearTimeout(mqttDelayTimer); mqttDelayTimer = null; }
      window._triggerRemoteJoinNow = null;
    };
    _cancelActiveJoin = () => {
      closedOut = true;
      cleanupTimers();
      if (guestMqttUnsub) { try { guestMqttUnsub(); } catch (_) {} guestMqttUnsub = null; }
    };

    const completeJoinOnce = (transport, rId, world, mods, peers, srvDayTime, extra = {}) => {
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
      if (transport !== 'p2p') {
        destroyP2P();
      }
      if (transport !== 'ws' && wsConn && wsConn.readyState === 1) {
        try { wsConn.send(JSON.stringify({ type: 'leave' })); } catch (_) {}
      }
      activeRoomId = rId || roomId;
      activeCoopTransport = extra && extra.isHost ? 'host' : transport;
      setCoopStatus(`✅ Đã kết nối phòng <b>${escHtml(activeRoomId)}</b>!`, 'ok');
      applyJoinedWorld(world, mods, peers, srvDayTime, extra);
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

      // 1) Internet WSS MQTT Relay (delayed 1100ms so direct WebRTC P2P wins first on broadband/Wi-Fi)
      let mqttHelloStarted = false;
      guestMqttUnsub = ncMqtt.subscribe(topic, (m) => {
        if (!m || m._from === localPeerId || m._relayBy === localPeerId) return;
        if (m._to && m._to !== localPeerId) return;
    if (m._exclude && m._exclude === localPeerId) return;
        if (m.type === 'p2p_welcome') {
          completeJoinOnce('mqtt', m.roomId || roomId, m.world, m.mods || [], m.peers || [], m.dayTime, { hostId: m.hostId, chests: m.chests, consumedChests: m.consumedChests, drops: m.drops, mobs: m.mobs, savedPlayer: m.savedPlayer });
          return;
        }
        if (joinedOk && activeCoopTransport === 'mqtt') handleIncomingP2PData(m._from, m, null, 'mqtt');
      });
      const sendMqttHello = () => {
        if (joinedOk || closedOut) return;
        const curS = inventory[player.selectedSlot];
        ncMqtt.publish(topic, {
          type: 'p2p_hello', _from: localPeerId, playerKey: getLocalPlayerSaveKey(), name: localPlayerName,
          skinId: selectedSkinId, equip: player.equip,
          held: (curS && curS.count > 0) ? curS.id : 0
        });
      };
      const startMqttHelloLoop = () => {
        if (mqttHelloStarted || joinedOk || closedOut) return;
        mqttHelloStarted = true;
        if (mqttDelayTimer) { clearTimeout(mqttDelayTimer); mqttDelayTimer = null; }
        sendMqttHello();
        if (helloTimer) clearInterval(helloTimer);
        helloTimer = setInterval(sendMqttHello, 2500);
      };
      mqttDelayTimer = setTimeout(startMqttHelloLoop, 1100);

      // 2) WebRTC P2P via PeerJS
      ensurePeerJsLoaded((ok) => {
        if (!ok) { startMqttHelloLoop(); return; }
        if (joinedOk || closedOut) return;
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
                  type: 'p2p_hello', _from: localPeerId, playerKey: getLocalPlayerSaveKey(), name: localPlayerName,
                  skinId: selectedSkinId, equip: player.equip,
                  held: (curS && curS.count > 0) ? curS.id : 0
                });
              });
              conn.on('data', (d) => {
                if (d && d.type === 'p2p_welcome') {
                  completeJoinOnce('p2p', d.roomId || roomId, d.world, d.mods || [], d.peers || [], d.dayTime, { hostId: d.hostId, chests: d.chests, consumedChests: d.consumedChests, drops: d.drops, mobs: d.mobs, savedPlayer: d.savedPlayer });
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
            startMqttHelloLoop();
          });
        } catch (_) {
          startMqttHelloLoop();
        }
      });
    };

    // 3) Same-Browser BroadcastChannel & 4) LAN WebSocket (server.js) — prefer fast local WS before MQTT/P2P
    if (bcChannel) bcChannel.postMessage({ type: 'bc_join_req', _from: localPeerId, playerKey: getLocalPlayerSaveKey(), roomId, name: localPlayerName });
    if (bcChannel || (wsConn && (wsConn.readyState === 1 || wsConn.readyState === 0))) {
      window._triggerRemoteJoinNow = startRemoteTransports;
      remoteDelayTimer = setTimeout(startRemoteTransports, 900);
    } else {
      startRemoteTransports();
    }
    connectCoopSocket((online) => {
      if (online && !joinedOk && !closedOut && wsConn && wsConn.readyState === 1) {
        wsConn.send(JSON.stringify({ type: 'join_room', roomId, clientId: localPeerId, playerKey: getLocalPlayerSaveKey(), name: localPlayerName, skinId: selectedSkinId, customSkin: (typeof getLocalCustomSkinPayload === 'function') ? getLocalCustomSkinPayload() : null }));
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
    const clean = String(rawUid || '').trim();
    if (clean.length < 3 || clean.length > 18) {
      return { ok: false, reason: 'Tên UID phải dài từ 3 đến 18 ký tự!' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
      return { ok: false, reason: 'Tên UID chỉ gồm chữ không dấu, số, gạch dưới (_) và gạch ngang (-).' };
    }
    const prev = getLockedPlayerUid();
    try { localStorage.setItem(UID_STORAGE_KEY, clean); } catch (_) {}
    localPlayerName = clean;
    syncPlayerUidUI();
    syncAccountBadgeUI();
    if (clean !== prev) {
      initFriendNetworkPeer();
      if (typeof sendCoopMsg === 'function' && activeRoomId) {
        try { sendCoopMsg({ type: 'hello', name: clean, uid: clean }); } catch (_) {}
      }
      if (typeof scheduleAccountCloudSync === 'function') scheduleAccountCloudSync();
    }
    return { ok: true, uid: clean, changed: clean !== prev };
  }
  const setPlayerUid = setLockedPlayerUidOnce;
  if (typeof window !== 'undefined') window.setPlayerUid = setPlayerUid;
  function isShareWithFriendsEnabled() { return !!shareWithFriendsEnabled; }

  function loadFriendsList() {
    try {
      const arr = JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveFriendsList(arr) {
    try { localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(arr)); } catch (_) {}
    if (typeof window.scheduleAccountCloudSync === 'function') window.scheduleAccountCloudSync();
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
    if (inpP && dispName) { inpP.value = dispName; inpP.disabled = false; }
    const inpC = document.getElementById('inpCoopName');
    if (inpC && dispName) { inpC.value = dispName; inpC.disabled = false; }

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

  function openProfileModal(initialTab = 'uid') {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    const uid = getLockedPlayerUid();
    const inp = document.getElementById('inpProfileUid');
    const st = document.getElementById('profileUidStatus');
    const hint = document.getElementById('profileUidHint');
    const btnSave = document.getElementById('btnSaveProfileUid');
    let savedMeta = null;
    try { savedMeta = JSON.parse(localStorage.getItem(ACC_ACTIVE_KEY) || 'null'); } catch (_) {}
    const loginUser = _activeAccSession?.username || savedMeta?.username || '';
    if (st) {
      st.textContent = loginUser
        ? `Tên UID hiển thị trong game (đổi thoải mái — độc lập với tài khoản đăng nhập @${loginUser}):`
        : 'Tên UID hiển thị trong game (có thể thay đổi bất cứ lúc nào):';
    }
    if (hint) {
      hint.style.color = '';
      hint.textContent = loginUser
        ? `Tên đăng nhập tài khoản của bạn (@${loginUser}) được giữ cố định để đăng nhập, còn tên UID này dùng để hiển thị trong game & kết bạn.`
        : 'Tên UID hiển thị trên đầu nhân vật, ngoài sảnh, trong phòng Co-op và để bạn bè tìm kiếm (khác với tên đăng nhập tài khoản).';
    }
    if (inp) { inp.value = uid || localPlayerName || ''; inp.disabled = false; }
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Lưu tên UID'; btnSave.style.opacity = '1'; }
    syncAccountBadgeUI();
    if (typeof syncAllPlayerAvatarFaces === 'function') syncAllPlayerAvatarFaces();
    switchProfileModalTab(initialTab === 'auth' ? 'auth' : 'uid');
    modal.classList.remove('hidden');
  }
  function closeProfileModal() {
    document.getElementById('profileModal')?.classList.add('hidden');
  }

  // ===================== v157: E2EE TÀI KHOẢN & MẬT KHẨU ĐỒNG BỘ CHÉO THIẾT BỊ =====================
  const ACC_VAULT_KEY = 'nucraft_acc_vault_v1';
  const ACC_ACTIVE_KEY = 'nucraft_active_acc_v1';
  let _activeAccSession = null; // { username, uKey, accountId, aesKey, verifier, lastSyncAt }
  let _accSyncTimer = null;

  function _abToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function _u8ToB64Acc(u8) {
    let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function _b64ToU8Acc(b64) {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  async function _deriveAccountCrypto(rawUser, rawPass) {
    const username = String(rawUser || '').trim();
    const pass = String(rawPass || '');
    if (!/^[a-zA-Z0-9_]{3,18}$/.test(username)) {
      throw new Error('Tên tài khoản 3–18 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới (_).');
    }
    if (pass.length < 6) {
      throw new Error('Mật khẩu cần tối thiểu 6 ký tự!');
    }
    const uKey = username.toLowerCase();
    const enc = new TextEncoder();
    const idHash = await crypto.subtle.digest('SHA-256', enc.encode('nucraft-acc-id-v1:' + uKey));
    const accountId = _abToHex(idHash).slice(0, 32);
    const keyMat = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('nucraft-acc-salt-v1:' + uKey), iterations: 100000, hash: 'SHA-256' },
      keyMat, 512
    );
    const raw = new Uint8Array(bits);
    const aesKey = await crypto.subtle.importKey('raw', raw.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const verifier = _abToHex(raw.slice(32, 64));
    return { username, uKey, accountId, aesKey, verifier };
  }
  async function _encryptAccountEnvelope(cryptoInfo, snapshot) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(snapshot));
    const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoInfo.aesKey, plain);
    return {
      v: 1,
      accountId: cryptoInfo.accountId,
      verifier: cryptoInfo.verifier,
      iv: _u8ToB64Acc(iv),
      ct: _u8ToB64Acc(new Uint8Array(ctBuf)),
      updatedAt: snapshot.savedAt || Date.now()
    };
  }
  async function _decryptAccountEnvelope(cryptoInfo, envelope) {
    if (!envelope || typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
      throw new Error('Dữ liệu tài khoản không hợp lệ.');
    }
    if (envelope.verifier && envelope.verifier !== cryptoInfo.verifier) {
      throw new Error('Sai mật khẩu! Vui lòng kiểm tra lại.');
    }
    const iv = _b64ToU8Acc(envelope.iv);
    const ct = _b64ToU8Acc(envelope.ct);
    try {
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoInfo.aesKey, ct);
      return JSON.parse(new TextDecoder().decode(dec));
    } catch (_) {
      throw new Error('Sai mật khẩu hoặc dữ liệu sao lưu bị hỏng!');
    }
  }
  function _getLocalVaultMap() {
    try {
      const obj = JSON.parse(localStorage.getItem(ACC_VAULT_KEY) || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (_) { return {}; }
  }
  function _saveLocalVaultEnvelope(accountId, env) {
    try {
      const m = _getLocalVaultMap();
      m[accountId] = env;
      localStorage.setItem(ACC_VAULT_KEY, JSON.stringify(m));
    } catch (_) {}
  }
  function _canHitLocalAccountApi() {
    if (typeof location === 'undefined') return false;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return false;
    if (/\.github\.io$/i.test(location.hostname || '')) return false;
    return true;
  }
  async function _fetchCloudAccountEnvelope(accountId) {
    const localEnv = _getLocalVaultMap()[accountId] || null;
    const candidates = localEnv ? [localEnv] : [];
    const jobs = [];
    if (_canHitLocalAccountApi()) {
      jobs.push(fetch('/api/account/' + encodeURIComponent(accountId), { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (j && j.found && j.envelope) candidates.push(j.envelope); })
        .catch(() => {}));
    }
    if (typeof ncMqtt !== 'undefined' && ncMqtt && typeof ncMqtt.subscribe === 'function') {
      jobs.push(new Promise((resolve) => {
        let done = false;
        const topic = MQTT_NS + '/acc/' + accountId;
        const unsub = ncMqtt.subscribe(topic, (msg) => {
          if (msg && msg.v === 1 && msg.ct && msg.verifier) candidates.push(msg);
          if (!done) { done = true; try { unsub(); } catch (_) {} resolve(); }
        });
        setTimeout(() => { if (!done) { done = true; try { unsub(); } catch (_) {} resolve(); } }, 1650);
      }));
    }
    await Promise.all(jobs);
    if (!candidates.length) return null;
    candidates.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return candidates[0];
  }
  async function _pushCloudAccountEnvelope(accountId, envelope, mode = 'sync') {
    _saveLocalVaultEnvelope(accountId, envelope);
    if (_canHitLocalAccountApi()) {
      try {
        const res = await fetch('/api/account/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, envelope, mode })
        });
        if (res.status === 409) throw new Error('Tên tài khoản này đã tồn tại! Hãy chuyển sang Đăng nhập.');
        if (res.status === 403) throw new Error('Sai mật khẩu xác thực tài khoản!');
      } catch (err) {
        if (err && /tồn tại|Sai mật khẩu/.test(err.message || '')) throw err;
      }
    }
    if (typeof ncMqtt !== 'undefined' && ncMqtt && typeof ncMqtt.publish === 'function') {
      try { ncMqtt.publish(MQTT_NS + '/acc/' + accountId, envelope, true); } catch (_) {}
    }
  }
  function collectAccountSnapshot(username, compactForCloud = true) {
    let customSkins = [];
    try { customSkins = JSON.parse(localStorage.getItem('nucraft_custom_skins_v1') || '[]'); } catch (_) {}
    let worlds = (typeof getSavedWorldsList === 'function') ? getSavedWorldsList() : [];
    const trimWorlds = (arr, dropThumbs, maxMods) => arr.slice(0, 8).map(w => {
      const c = { ...w };
      if (dropThumbs) delete c.thumb;
      if (Array.isArray(c.mods) && c.mods.length > maxMods) c.mods = c.mods.slice(-maxMods);
      return c;
    });
    const addons = (typeof window.exportModsForAccountSync === 'function') ? window.exportModsForAccountSync() : [];
    let gfx = null;
    try { gfx = (typeof CFG !== 'undefined' && CFG.loadGfxPrefs) ? CFG.loadGfxPrefs() : null; } catch (_) {}
    const curDisplayUid = getLockedPlayerUid() || (typeof localPlayerName !== 'undefined' && localPlayerName) || username;
    const snap = {
      v: 1,
      loginUser: username,
      uid: curDisplayUid,
      displayUid: curDisplayUid,
      skinId: (typeof selectedSkinId !== 'undefined') ? selectedSkinId : 'steve',
      customSkins: Array.isArray(customSkins) ? customSkins.slice(0, 6) : [],
      worlds: trimWorlds(worlds, compactForCloud, 2200),
      friends: loadFriendsList(),
      friendReqs: loadIncomingFriendReqs(),
      outgoingReqs: loadOutgoingFriendReqs(),
      addons,
      lang: (typeof currentLang !== 'undefined') ? currentLang : 'vi',
      gfx,
      savedAt: Date.now()
    };
    if (compactForCloud && JSON.stringify(snap).length > 88000) {
      snap.worlds = trimWorlds(worlds, true, 900);
      snap.customSkins = snap.customSkins.slice(0, 2);
    }
    return snap;
  }
  async function applyAccountSnapshot(snap) {
    if (!snap) return;
    const restoredUid = snap.displayUid || snap.uid || snap.loginUser || '';
    if (!restoredUid) return;
    try { localStorage.setItem(UID_STORAGE_KEY, restoredUid); } catch (_) {}
    if (typeof localPlayerName !== 'undefined') localPlayerName = restoredUid;
    try { localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(Array.isArray(snap.friends) ? snap.friends : [])); } catch (_) {}
    try { localStorage.setItem(FRIEND_REQS_KEY, JSON.stringify(Array.isArray(snap.friendReqs) ? snap.friendReqs : [])); } catch (_) {}
    try { localStorage.setItem(OUTGOING_REQS_KEY, JSON.stringify(Array.isArray(snap.outgoingReqs) ? snap.outgoingReqs : [])); } catch (_) {}
    if (Array.isArray(snap.worlds)) {
      try { localStorage.setItem('luanti_craft_v14_worlds', JSON.stringify(snap.worlds)); } catch (_) {}
      if (typeof renderSavedWorldsList === 'function') renderSavedWorldsList();
    }
    if (Array.isArray(snap.customSkins) && snap.customSkins.length && typeof window.restoreCustomSkinsFromSync === 'function') {
      window.restoreCustomSkinsFromSync(snap.customSkins);
    }
    if (snap.skinId && typeof selectPlayerSkin === 'function') {
      try { localStorage.setItem('luanti_skin_id', snap.skinId); } catch (_) {}
      selectPlayerSkin(snap.skinId, false);
    }
    if (Array.isArray(snap.addons) && typeof window.importModsFromAccountSync === 'function') {
      await window.importModsFromAccountSync(snap.addons);
    }
    if (snap.lang && typeof applyLanguage === 'function' && typeof currentLang !== 'undefined' && snap.lang !== currentLang) {
      applyLanguage(snap.lang, false);
    }
    syncPlayerUidUI();
    initFriendNetworkPeer();
    if (typeof renderFriendsModalContent === 'function') renderFriendsModalContent();
    if (typeof renderFriendWorldsList === 'function') renderFriendWorldsList();
  }
  function switchProfileModalTab(tab = 'uid') {
    const isAuth = (tab === 'auth');
    document.getElementById('btnProfTabUid')?.classList.toggle('active', !isAuth);
    document.getElementById('btnProfTabAuth')?.classList.toggle('active', isAuth);
    document.getElementById('profPaneUid')?.classList.toggle('hidden', isAuth);
    document.getElementById('profPaneAuth')?.classList.toggle('hidden', !isAuth);
    const btnUidSave = document.getElementById('btnSaveProfileUid');
    if (btnUidSave) btnUidSave.style.display = isAuth ? 'none' : '';
    if (isAuth) setTimeout(() => document.getElementById('inpAuthUser')?.focus(), 40);
  }
  function syncAccountBadgeUI() {
    const badge = document.getElementById('profileAccBadge');
    const sub = document.getElementById('profileAccSub');
    const btnGo = document.getElementById('btnProfileGoAuth');
    const btnSync = document.getElementById('btnProfileSyncNow');
    const btnOut = document.getElementById('btnProfileLogout');
    const sideName = document.getElementById('profSideName');
    const pill = document.getElementById('profHeadStatusPill');
    const statEl = document.getElementById('profStatCounts');
    let savedMeta = null;
    try { savedMeta = JSON.parse(localStorage.getItem(ACC_ACTIVE_KEY) || 'null'); } catch (_) {}
    const uName = _activeAccSession?.username || savedMeta?.username || '';
    const hasSession = !!(_activeAccSession && _activeAccSession.aesKey);
    const dispUid = getLockedPlayerUid() || (typeof localPlayerName !== 'undefined' && localPlayerName) || uName || 'Người chơi';
    if (sideName) sideName.textContent = dispUid;
    if (pill) {
      pill.textContent = hasSession ? '🟢 Đã đồng bộ đám mây' : (uName ? '🟡 Đã lưu phiên' : '⚪ Chưa đồng bộ');
      pill.style.color = hasSession ? '#4ade80' : '#fde047';
    }
    if (statEl) {
      const wCnt = (typeof getSavedWorldsList === 'function') ? getSavedWorldsList().length : 0;
      const fCnt = loadFriendsList().length;
      statEl.textContent = `${wCnt} map · ${fCnt} bạn`;
    }
    if (badge) {
      badge.textContent = uName ? (hasSession ? `🟢 Tài khoản đăng nhập: @${uName}` : `🟡 Đã lưu phiên: @${uName} (nhập MK để đồng bộ)`) : 'Chưa đăng nhập tài khoản đồng bộ';
      badge.style.color = hasSession ? '#4ade80' : '#facc15';
    }
    if (sub) {
      const ts = _activeAccSession?.lastSyncAt || savedMeta?.lastSyncAt;
      sub.textContent = uName
        ? (ts ? `UID trong game: ${dispUid} • Đồng bộ gần nhất: ${new Date(ts).toLocaleTimeString()}` : `UID trong game: ${dispUid} • Sẵn sàng đồng bộ Skin, Map, Add-on & Bạn bè`)
        : 'Đăng nhập để mang Skin, Map, Add-on & Bạn bè sang máy/trình duyệt khác';
    }
    if (btnGo) btnGo.textContent = uName ? '🔐 Đổi tài khoản' : '🔐 Đăng nhập / Tạo acc';
    if (btnSync) btnSync.classList.toggle('hidden', !hasSession);
    if (btnOut) btnOut.classList.toggle('hidden', !uName);
    if (typeof syncAllPlayerAvatarFaces === 'function') syncAllPlayerAvatarFaces();
  }
  async function nucraftRegisterAccount(username, password, confirmPassword) {
    if (String(password) !== String(confirmPassword)) {
      throw new Error('Mật khẩu nhập lại không khớp!');
    }
    const cInfo = await _deriveAccountCrypto(username, password);
    const existing = await _fetchCloudAccountEnvelope(cInfo.accountId);
    if (existing) {
      throw new Error('Tên tài khoản này đã có người đăng ký! Hãy đăng nhập hoặc chọn tên khác.');
    }
    if (!getLockedPlayerUid()) {
      try { localStorage.setItem(UID_STORAGE_KEY, cInfo.username); } catch (_) {}
      if (typeof localPlayerName !== 'undefined') localPlayerName = cInfo.username;
    }
    const snap = collectAccountSnapshot(cInfo.username, true);
    const env = await _encryptAccountEnvelope(cInfo, snap);
    await _pushCloudAccountEnvelope(cInfo.accountId, env, 'register');
    _activeAccSession = { ...cInfo, lastSyncAt: env.updatedAt };
    try { localStorage.setItem(ACC_ACTIVE_KEY, JSON.stringify({ username: cInfo.username, accountId: cInfo.accountId, lastSyncAt: env.updatedAt })); } catch (_) {}
    syncPlayerUidUI();
    initFriendNetworkPeer();
    syncAccountBadgeUI();
    return snap;
  }
  async function nucraftLoginAccount(username, password) {
    const cInfo = await _deriveAccountCrypto(username, password);
    const env = await _fetchCloudAccountEnvelope(cInfo.accountId);
    if (!env) {
      throw new Error('Không tìm thấy tài khoản trên máy chủ hoặc trình duyệt này! Hãy kiểm tra tên hoặc dùng file sao lưu .ncacc.');
    }
    const snap = await _decryptAccountEnvelope(cInfo, env);
    _saveLocalVaultEnvelope(cInfo.accountId, env);
    const loginAccName = snap.loginUser || cInfo.username;
    _activeAccSession = { ...cInfo, username: loginAccName, lastSyncAt: snap.savedAt || env.updatedAt || Date.now() };
    try { localStorage.setItem(ACC_ACTIVE_KEY, JSON.stringify({ username: loginAccName, accountId: cInfo.accountId, lastSyncAt: _activeAccSession.lastSyncAt })); } catch (_) {}
    await applyAccountSnapshot(snap);
    syncAccountBadgeUI();
    return snap;
  }
  async function nucraftSyncActiveAccountNow() {
    if (!_activeAccSession || !_activeAccSession.aesKey) return false;
    const snap = collectAccountSnapshot(_activeAccSession.username, true);
    const env = await _encryptAccountEnvelope(_activeAccSession, snap);
    await _pushCloudAccountEnvelope(_activeAccSession.accountId, env, 'sync');
    _activeAccSession.lastSyncAt = env.updatedAt;
    try { localStorage.setItem(ACC_ACTIVE_KEY, JSON.stringify({ username: _activeAccSession.username, accountId: _activeAccSession.accountId, lastSyncAt: env.updatedAt })); } catch (_) {}
    syncAccountBadgeUI();
    return true;
  }
  function scheduleAccountCloudSync() {
    if (!_activeAccSession || !_activeAccSession.aesKey) return;
    if (_accSyncTimer) clearTimeout(_accSyncTimer);
    _accSyncTimer = setTimeout(() => { _accSyncTimer = null; nucraftSyncActiveAccountNow().catch(() => {}); }, 1200);
  }
  function nucraftLogoutAccount() {
    _activeAccSession = null;
    try { localStorage.removeItem(ACC_ACTIVE_KEY); } catch (_) {}
    syncAccountBadgeUI();
  }
  async function nucraftExportAccountFile() {
    const uid = _activeAccSession?.username || getLockedPlayerUid() || 'Player';
    let payloadStr = '';
    if (_activeAccSession && _activeAccSession.aesKey) {
      const snap = collectAccountSnapshot(uid, false);
      const env = await _encryptAccountEnvelope(_activeAccSession, snap);
      payloadStr = JSON.stringify({ type: 'nucraft_e2ee_account_v1', username: uid, envelope: env });
    } else {
      const m = _getLocalVaultMap();
      const firstEnv = Object.values(m)[0];
      if (!firstEnv) throw new Error('Hãy đăng ký hoặc đăng nhập tài khoản trước khi xuất file!');
      payloadStr = JSON.stringify({ type: 'nucraft_e2ee_account_v1', username: uid, envelope: firstEnv });
    }
    const blob = new Blob([payloadStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nucraft_${uid}.ncacc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  async function nucraftImportAccountFile(jsonText, username, password) {
    const parsed = JSON.parse(jsonText);
    const env = (parsed && parsed.envelope) ? parsed.envelope : parsed;
    const u = username || parsed.username || '';
    const cInfo = await _deriveAccountCrypto(u, password);
    const snap = await _decryptAccountEnvelope(cInfo, env);
    _saveLocalVaultEnvelope(cInfo.accountId, env);
    const loginAccName = snap.loginUser || cInfo.username;
    _activeAccSession = { ...cInfo, username: loginAccName, lastSyncAt: snap.savedAt || Date.now() };
    try { localStorage.setItem(ACC_ACTIVE_KEY, JSON.stringify({ username: loginAccName, accountId: cInfo.accountId, lastSyncAt: _activeAccSession.lastSyncAt })); } catch (_) {}
    await applyAccountSnapshot(snap);
    await _pushCloudAccountEnvelope(cInfo.accountId, env, 'sync');
    syncAccountBadgeUI();
    return snap;
  }
  window.openProfileModal = openProfileModal;
  window.switchProfileModalTab = switchProfileModalTab;
  window.syncAccountBadgeUI = syncAccountBadgeUI;
  window.nucraftRegisterAccount = nucraftRegisterAccount;
  window.nucraftLoginAccount = nucraftLoginAccount;
  window.nucraftSyncActiveAccountNow = nucraftSyncActiveAccountNow;
  window.scheduleAccountCloudSync = scheduleAccountCloudSync;
  window.nucraftLogoutAccount = nucraftLogoutAccount;
  window.nucraftExportAccountFile = nucraftExportAccountFile;
  window.nucraftImportAccountFile = nucraftImportAccountFile;

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
    const isOffline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    const isLocalWsOnly = (wsConn && wsConn.readyState === 1 && (location.hostname === '127.0.0.1' || location.hostname === 'localhost'));
    if (isOffline || isLocalWsOnly) return;
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

