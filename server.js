'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const SHARED = require('./shared/constants.js');
const GZIP_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
const gzCache = new Map(); // fullPath -> { etag, buf } (bounded to 64 entries)
const binCache = new Map(); // fullPath -> { etag, buf } (bounded binary asset RAM cache)
let binCacheBytes = 0;
const BIN_CACHE_MAX_BYTES = 24 * 1024 * 1024;

const PORT = parseInt(process.env.PORT || String(SHARED.DEFAULT_PORT || 4173), 10);
const ROOT = __dirname;
const DEFAULT_HTML = 'NUCRAFT.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.ogg':  'audio/ogg',
  '.mp3':  'audio/mpeg',
  '.webp': 'image/webp',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.wasm': 'application/wasm',
  '.ico':  'image/x-icon',
  '.exe':  'application/octet-stream',
  '.webmanifest': 'application/manifest+json'
};

// In-memory multiplayer rooms: roomId -> { seed, name, mode, biome, preset, mods: Map, peers: Map }
const rooms = new Map();
const uidPeers = new Map(); // uidKey -> Set<peer>
const friendMailbox = new Map(); // uidKey -> Array<payload> (offline LAN friend queue)
const PEER_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#c084fc', '#2dd4bf', '#f87171'];

function sanitizeUidKey(uid) {
  return String(uid || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 18);
}

function unregisterUidPeer(peer) {
  if (!peer || !peer.uidKey) return;
  const set = uidPeers.get(peer.uidKey);
  if (set) {
    set.delete(peer);
    if (set.size === 0) uidPeers.delete(peer.uidKey);
  }
  peer.uidKey = null;
}

function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  do {
    id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(id));
  return id;
}

// Minimal RFC-6455 WebSocket frame encoder/decoder (zero dependencies)
function encodeWsFrame(str, opcode = 0x1) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  return Buffer.concat([header, payload]);
}

function sendJson(peer, obj) {
  if (!peer || !peer.socket || peer.socket.destroyed) return;
  try { peer.socket.write(encodeWsFrame(JSON.stringify(obj))); } catch (_) {}
}

function broadcastRoom(room, obj, exceptPeerId = null) {
  const buf = encodeWsFrame(JSON.stringify(obj));
  for (const [pid, p] of room.peers.entries()) {
    if (pid === exceptPeerId || !p.socket || p.socket.destroyed) continue;
    try { p.socket.write(buf); } catch (_) {}
  }
}

const ROOM_CACHE_FILE = path.join(ROOT, '.nucraft_rooms_cache.json');
let _roomSaveTimer = null;

function sanitizePlayerKey(k) {
  return String(k || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

function serializeRoomsSnapshot() {
  const out = [];
  for (const r of rooms.values()) {
    out.push({
      id: r.id,
      seed: r.seed,
      worldName: r.worldName,
      mode: r.mode,
      biome: r.biome,
      preset: r.preset,
      dayTime: r.dayTime,
      weatherMode: r.weatherMode || 'auto',
      activeWeatherKind: r.activeWeatherKind || 'clear',
      ruinOriginX: r.ruinOriginX || 0,
      ruinOriginZ: r.ruinOriginZ || 0,
      mods: Array.from(r.mods.entries()).slice(-120000),
      chests: Array.from(r.chests.entries()),
      consumedChests: Array.from(r.consumedChests.values()),
      drops: Array.from(r.drops.values()).slice(-600),
      playersData: Array.from(r.playersData.entries())
    });
  }
  return out;
}

function saveRoomsToDiskSync() {
  try {
    fs.writeFileSync(ROOM_CACHE_FILE, JSON.stringify({ v: 1, savedAt: Date.now(), rooms: serializeRoomsSnapshot() }));
  } catch (_) {}
}

function scheduleRoomsSave() {
  if (_roomSaveTimer) return;
  _roomSaveTimer = setTimeout(() => {
    _roomSaveTimer = null;
    try {
      fs.writeFile(ROOM_CACHE_FILE, JSON.stringify({ v: 1, savedAt: Date.now(), rooms: serializeRoomsSnapshot() }), () => {});
    } catch (_) {}
  }, 2200);
}

(function loadRoomsFromDisk() {
  try {
    if (!fs.existsSync(ROOM_CACHE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(ROOM_CACHE_FILE, 'utf8'));
    if (!raw || !Array.isArray(raw.rooms)) return;
    for (const s of raw.rooms) {
      if (!s || !s.id) continue;
      const room = {
        id: String(s.id),
        hostId: null,
        seed: Number(s.seed) || 133742,
        worldName: String(s.worldName || 'Thế Giới Mới').slice(0, 32),
        mode: s.mode === 'creative' ? 'creative' : 'survival',
        biome: String(s.biome || 'sakura'),
        preset: String(s.preset || 'bsl'),
        dayTime: typeof s.dayTime === 'number' ? s.dayTime : 0.31,
        weatherMode: s.weatherMode || 'auto',
        activeWeatherKind: s.activeWeatherKind || 'clear',
        ruinOriginX: Number(s.ruinOriginX) || 0,
        ruinOriginZ: Number(s.ruinOriginZ) || 0,
        mods: new Map(Array.isArray(s.mods) ? s.mods.map(e => [String(e[0]), Number(e[1]) || 0]) : []),
        chests: new Map(Array.isArray(s.chests) ? s.chests : []),
        consumedChests: new Set(Array.isArray(s.consumedChests) ? s.consumedChests : []),
        drops: new Map(),
        mobsByDim: {},
        playersData: new Map(Array.isArray(s.playersData) ? s.playersData : []),
        peers: new Map()
      };
      if (Array.isArray(s.drops)) {
        for (const d of s.drops) if (d && d.dropId) room.drops.set(String(d.dropId), d);
      }
      rooms.set(room.id, room);
    }
  } catch (_) {}
})();

function sendWsModsInChunks(peer, entries, msgType = 'ws_mods_chunk') {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const CHUNK_SZ = 2500;
  for (let i = 0; i < entries.length; i += CHUNK_SZ) {
    sendJson(peer, { type: msgType, mods: entries.slice(i, i + CHUNK_SZ) });
  }
}

function removePeerFromRoom(peer) {
  if (!peer.roomId) return;
  const room = rooms.get(peer.roomId);
  if (!room) { peer.roomId = null; return; }
  room.peers.delete(peer.id);
  broadcastRoom(room, { type: 'peer_leave', peerId: peer.id, name: peer.name });
  if (room.hostId === peer.id) {
    const nextPeer = room.peers.values().next().value || null;
    room.hostId = nextPeer ? nextPeer.id : null;
    if (nextPeer) {
      sendJson(nextPeer, { type: 'host_promote', peerId: nextPeer.id });
      broadcastRoom(room, { type: 'host_changed', hostId: nextPeer.id }, nextPeer.id);
    }
  }
  scheduleRoomsSave();
  peer.roomId = null;
}

function handleMessage(peer, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'create_room') {
    removePeerFromRoom(peer);
    const cid = (msg.clientId && /^[A-Za-z0-9_-]{4,24}$/.test(String(msg.clientId))) ? String(msg.clientId) : '';
    if (cid) peer.id = cid;
    peer.playerKey = sanitizePlayerKey(msg.playerKey || msg.clientId || peer.id) || peer.id;
    const roomId = (msg.roomId && /^[A-Z0-9]{4,8}$/.test(String(msg.roomId).toUpperCase()))
      ? String(msg.roomId).toUpperCase()
      : genRoomId();
    const prev = rooms.get(roomId);
    const seedNum = Number(msg.seed) || 133742;
    const reusePrev = !!(prev && !msg.fresh && prev.seed === seedNum);
    const room = reusePrev ? prev : {
      id: roomId,
      hostId: peer.id,
      seed: seedNum,
      worldName: String(msg.worldName || 'Thế Giới Mới').slice(0, 32),
      mode: msg.mode === 'creative' ? 'creative' : 'survival',
      biome: String(msg.biome || 'sakura'),
      preset: String(msg.preset || 'bsl'),
      dayTime: typeof msg.dayTime === 'number' ? msg.dayTime : 0.31,
      weatherMode: msg.weatherMode || 'auto',
      activeWeatherKind: msg.activeWeatherKind || 'clear',
      ruinOriginX: Number(msg.ruinOriginX) || 0,
      ruinOriginZ: Number(msg.ruinOriginZ) || 0,
      mods: new Map(),
      chests: new Map(),
      consumedChests: new Set(),
      drops: new Map(),
      mobsByDim: {},
      playersData: new Map(),
      peers: new Map()
    };
    room.hostId = peer.id;
    if (typeof msg.ruinOriginX === 'number' && !reusePrev) room.ruinOriginX = msg.ruinOriginX;
    if (typeof msg.ruinOriginZ === 'number' && !reusePrev) room.ruinOriginZ = msg.ruinOriginZ;
    if (Array.isArray(msg.mods)) {
      for (const [k, v] of msg.mods.slice(-120000)) room.mods.set(String(k), Number(v) || 0);
    }
    if (Array.isArray(msg.chests)) {
      for (const entry of msg.chests) if (Array.isArray(entry) && entry.length >= 2) room.chests.set(String(entry[0]), entry[1]);
    }
    if (Array.isArray(msg.consumedChests)) {
      for (const ck of msg.consumedChests) room.consumedChests.add(String(ck));
    }
    rooms.set(roomId, room);
    peer.name = String(msg.name || 'Người Chơi').slice(0, 20);
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 24);
    if (msg.state) peer.state = msg.state;
    peer.color = PEER_COLORS[0];
    peer.roomId = roomId;
    room.peers.set(peer.id, peer);
    const allMods = Array.from(room.mods.entries());
    const inlineMods = allMods.slice(0, 2500);
    const existingPeers = [];
    for (const p of room.peers.values()) {
      if (p.id !== peer.id) existingPeers.push({ peerId: p.id, name: p.name, color: p.color, skinId: p.skinId || null, equip: p.equip || null, state: p.state });
    }
    sendJson(peer, {
      type: 'room_joined',
      roomId,
      peerId: peer.id,
      color: peer.color,
      isHost: true,
      hostId: room.hostId,
      world: { seed: room.seed, worldName: room.worldName, mode: room.mode, biome: room.biome, preset: room.preset, dayTime: room.dayTime, weatherMode: room.weatherMode, activeWeatherKind: room.activeWeatherKind, ruinOriginX: room.ruinOriginX, ruinOriginZ: room.ruinOriginZ },
      mods: inlineMods,
      modsTotal: allMods.length,
      chests: Array.from(room.chests.entries()),
      consumedChests: Array.from(room.consumedChests.values()),
      drops: Array.from(room.drops.values()),
      mobsByDim: room.mobsByDim,
      savedPlayer: room.playersData.get(peer.playerKey) || null,
      peers: existingPeers
    });
    if (allMods.length > inlineMods.length) sendWsModsInChunks(peer, allMods.slice(inlineMods.length));
    scheduleRoomsSave();
  } else if (msg.type === 'join_room') {
    const roomId = String(msg.roomId || '').trim().toUpperCase();
    const room = rooms.get(roomId);
    if (!room) {
      sendJson(peer, { type: 'error', message: `Không tìm thấy phòng "${roomId}"!` });
      return;
    }
    removePeerFromRoom(peer);
    const cid = (msg.clientId && /^[A-Za-z0-9_-]{4,24}$/.test(String(msg.clientId))) ? String(msg.clientId) : '';
    if (cid && !room.peers.has(cid)) peer.id = cid;
    peer.playerKey = sanitizePlayerKey(msg.playerKey || msg.clientId || peer.id) || peer.id;
    peer.name = String(msg.name || 'Bạn Chơi').slice(0, 20);
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 24);
    peer.color = PEER_COLORS[room.peers.size % PEER_COLORS.length];
    peer.roomId = roomId;
    const becomeHost = (!room.hostId || !room.peers.has(room.hostId));
    if (becomeHost) room.hostId = peer.id;
    const existingPeers = [];
    for (const p of room.peers.values()) {
      existingPeers.push({ peerId: p.id, name: p.name, color: p.color, skinId: p.skinId || null, equip: p.equip || null, state: p.state });
    }
    room.peers.set(peer.id, peer);
    const allMods = Array.from(room.mods.entries());
    const inlineMods = allMods.slice(0, 2500);
    sendJson(peer, {
      type: 'room_joined',
      roomId,
      peerId: peer.id,
      color: peer.color,
      isHost: becomeHost,
      hostId: room.hostId,
      world: { seed: room.seed, worldName: room.worldName, mode: room.mode, biome: room.biome, preset: room.preset, dayTime: room.dayTime, weatherMode: room.weatherMode, activeWeatherKind: room.activeWeatherKind, ruinOriginX: room.ruinOriginX, ruinOriginZ: room.ruinOriginZ },
      mods: inlineMods,
      modsTotal: allMods.length,
      chests: Array.from(room.chests.entries()),
      consumedChests: Array.from(room.consumedChests.values()),
      drops: Array.from(room.drops.values()),
      mobsByDim: room.mobsByDim,
      savedPlayer: room.playersData.get(peer.playerKey) || null,
      peers: existingPeers
    });
    if (allMods.length > inlineMods.length) sendWsModsInChunks(peer, allMods.slice(inlineMods.length));
    broadcastRoom(room, { type: 'peer_join', peerId: peer.id, name: peer.name, color: peer.color, skinId: peer.skinId || null, state: peer.state }, peer.id);
  } else if (msg.type === 'mods_push' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !Array.isArray(msg.mods)) return;
    for (const [k, v] of msg.mods) room.mods.set(String(k), Number(v) || 0);
    while (room.mods.size > 120000) room.mods.delete(room.mods.keys().next().value);
    scheduleRoomsSave();
  } else if (msg.type === 'state' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 24);
    if (msg.equip) peer.equip = msg.equip;
    peer.state = msg.state || peer.state;
    if (typeof msg.dayTime === 'number') room.dayTime = msg.dayTime;
    const out = { type: 'peer_state', peerId: peer.id, name: peer.name, color: peer.color, skinId: peer.skinId || null, state: peer.state };
    if (msg.equip) out.equip = msg.equip;
    broadcastRoom(room, out, peer.id);
  } else if (msg.type === 'block' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    const key = msg.key ? String(msg.key) : ((msg.dim && msg.dim !== 'overworld') ? `${msg.dim}:${msg.x},${msg.trueY !== undefined ? msg.trueY : msg.y},${msg.z}` : `${msg.x},${msg.trueY !== undefined ? msg.trueY : msg.y},${msg.z}`);
    room.mods.set(key, Number(msg.id) || 0);
    if (room.mods.size > 120000) {
      const firstKey = room.mods.keys().next().value;
      room.mods.delete(firstKey);
    }
    broadcastRoom(room, { type: 'block', peerId: peer.id, key, dim: msg.dim || 'overworld', x: msg.x, y: msg.y, trueY: msg.trueY, z: msg.z, id: msg.id }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'player_save' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    const pPayload = (msg.data && typeof msg.data === 'object') ? msg.data : ((msg.playerState && typeof msg.playerState === 'object') ? msg.playerState : null);
    if (!room || !pPayload) return;
    const pKey = sanitizePlayerKey(msg.playerKey || peer.playerKey || peer.id) || peer.id;
    room.playersData.set(pKey, pPayload);
    scheduleRoomsSave();
  } else if (msg.type === 'chest_sync' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !msg.key) return;
    const ck = String(msg.key);
    if (Array.isArray(msg.slots)) room.chests.set(ck, msg.slots);
    room.consumedChests.add(ck);
    broadcastRoom(room, { type: 'chest_sync', peerId: peer.id, key: ck, blockId: msg.blockId, slots: msg.slots }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'chest_break' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !msg.key) return;
    const ck = String(msg.key);
    room.chests.delete(ck);
    room.consumedChests.add(ck);
    broadcastRoom(room, { type: 'chest_break', peerId: peer.id, key: ck }, peer.id);
    scheduleRoomsSave();
  } else if ((msg.type === 'drop_batch' || msg.type === 'drop_spawn') && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    const list = Array.isArray(msg.drops) ? msg.drops : (msg.drop ? [msg.drop] : []);
    if (!list.length) return;
    for (const d of list) {
      if (!d || !d.dropId) continue;
      room.drops.set(String(d.dropId), d);
    }
    while (room.drops.size > 800) {
      let delK = null;
      for (const [dk, dv] of room.drops.entries()) { if (!dv.fromDeath) { delK = dk; break; } }
      if (!delK) delK = room.drops.keys().next().value;
      room.drops.delete(delK);
    }
    broadcastRoom(room, { type: 'drop_batch', peerId: peer.id, drops: list }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'drop_pickup_req' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !msg.dropId) return;
    const did = String(msg.dropId);
    if (!room.drops.has(did)) return;
    const d = room.drops.get(did);
    room.drops.delete(did);
    sendJson(peer, { type: 'drop_pickup_ack', dropId: did, drop: d });
    broadcastRoom(room, { type: 'drop_remove', dropId: did }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'drop_remove' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    const ids = Array.isArray(msg.dropIds) ? msg.dropIds : (msg.dropId ? [msg.dropId] : []);
    for (const did of ids) room.drops.delete(String(did));
    if (ids.length) broadcastRoom(room, { type: 'drop_remove', dropIds: ids }, peer.id);
  } else if (msg.type === 'mob_sync' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !Array.isArray(msg.mobs)) return;
    const dKey = String(msg.dim || 'overworld');
    room.mobsByDim[dKey] = msg.mobs.slice(0, 120);
    broadcastRoom(room, { type: 'mob_sync', peerId: peer.id, dim: dKey, mobs: room.mobsByDim[dKey] }, peer.id);
  } else if ((msg.type === 'mob_hit' || msg.type === 'mob_action' || msg.type === 'mob_remove') && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    broadcastRoom(room, { ...msg, peerId: peer.id }, peer.id);
  } else if ((msg.type === 'door_toggle' || msg.type === 'weather_sync' || msg.type === 'explosion' || msg.type === 'ruin_origin') && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (msg.type === 'weather_sync') {
      if (msg.weatherMode) room.weatherMode = msg.weatherMode;
      if (msg.activeWeatherKind) room.activeWeatherKind = msg.activeWeatherKind;
    } else if (msg.type === 'ruin_origin') {
      room.ruinOriginX = Number(msg.x) || 0; room.ruinOriginZ = Number(msg.z) || 0;
    }
    broadcastRoom(room, { ...msg, peerId: peer.id }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'chat' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    broadcastRoom(room, { type: 'chat', peerId: peer.id, name: peer.name, text: String(msg.text || '').slice(0, 140) });
  } else if (msg.type === 'leave') {
    removePeerFromRoom(peer);
  } else if (msg.type === 'list_rooms') {
    const list = [];
    for (const r of rooms.values()) {
      if (r.peers.size > 0) list.push({ roomId: r.id, worldName: r.worldName, players: r.peers.size, mode: r.mode });
    }
    sendJson(peer, { type: 'rooms_list', rooms: list });
  } else if (msg.type === 'register_uid') {
    const uidKey = sanitizeUidKey(msg.uid);
    if (!uidKey) return;
    if (peer.uidKey && peer.uidKey !== uidKey) unregisterUidPeer(peer);
    peer.uidKey = uidKey;
    if (!uidPeers.has(uidKey)) uidPeers.set(uidKey, new Set());
    uidPeers.get(uidKey).add(peer);
    const queued = friendMailbox.get(uidKey);
    if (queued && queued.length) {
      friendMailbox.delete(uidKey);
      for (const pkt of queued) sendJson(peer, { type: 'friend_packet', payload: pkt });
    }
  } else if (msg.type === 'friend_packet') {
    const targetKey = sanitizeUidKey(msg.targetKey || (msg.payload && msg.payload.toUid));
    const payload = msg.payload;
    if (!targetKey || !payload || typeof payload !== 'object' || !payload.type) return;
    const targets = uidPeers.get(targetKey);
    let delivered = 0;
    if (targets && targets.size > 0) {
      for (const tp of targets) {
        if (tp.socket && !tp.socket.destroyed) {
          sendJson(tp, { type: 'friend_packet', payload });
          delivered++;
        }
      }
    }
    if (delivered === 0 && (payload.type === 'friend_req' || payload.type === 'friend_accept')) {
      const fromKey = sanitizeUidKey(payload.fromUid);
      let box = friendMailbox.get(targetKey);
      if (!box) { box = []; friendMailbox.set(targetKey, box); }
      const idx = box.findIndex(x => x.type === payload.type && sanitizeUidKey(x.fromUid) === fromKey);
      if (idx >= 0) box[idx] = payload;
      else {
        if (box.length >= 50) box.shift();
        box.push(payload);
      }
    }
  }
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (_) { res.writeHead(400); res.end('Bad Request'); return; }
  if (urlPath === '/__nucraft_ping' || urlPath === '/__nucraft_bye') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  if (urlPath === '/api/rooms') {
    const list = Array.from(rooms.values()).map(r => ({ roomId: r.id, worldName: r.worldName, players: r.peers.size, mode: r.mode }));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: list }));
    return;
  }
  const rel = urlPath === '/' ? DEFAULT_HTML : urlPath.replace(/^\/+/, '');
  const fullPath = path.resolve(ROOT, rel);
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(fullPath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    const etag = `W/"${st.size}-${Math.trunc(st.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      res.end();
      return;
    }
    const ct = MIME[ext] || 'application/octet-stream';
    const isImmutableBinary = (/^(assets\/(?:models|luanti_sounds)\/|skin\/)/i.test(rel) && (ext === '.glb' || ext === '.ogg' || ext === '.png' || ext === '.webp' || ext === '.mp3'));
    const cacheHdr = isImmutableBinary ? 'public, max-age=604800, immutable' : 'no-cache';
    const extraHdrs = ext === '.exe' ? { 'Content-Disposition': 'attachment; filename="NUCRAFT.exe"' } : null;
    const wantGzip = GZIP_EXTS.has(ext) && /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
    if (wantGzip) {
      const cached = gzCache.get(fullPath);
      if (cached && cached.etag === etag) {
        res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'gzip', 'Content-Length': cached.buf.length, Vary: 'Accept-Encoding', ETag: etag, 'Cache-Control': cacheHdr });
        res.end(cached.buf);
        return;
      }
      fs.readFile(fullPath, (rErr, raw) => {
        if (rErr) { res.writeHead(500); res.end('Read error'); return; }
        zlib.gzip(raw, { level: 1 }, (zErr, gz) => {
          if (zErr) { res.writeHead(200, { 'Content-Type': ct, 'Content-Length': raw.length, ETag: etag, 'Cache-Control': cacheHdr }); res.end(raw); return; }
          if (gzCache.size >= 64) gzCache.delete(gzCache.keys().next().value);
          gzCache.set(fullPath, { etag, buf: gz });
          res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'gzip', 'Content-Length': gz.length, Vary: 'Accept-Encoding', ETag: etag, 'Cache-Control': cacheHdr });
          res.end(gz);
        });
      });
      return;
    }
    if (isImmutableBinary && st.size <= 2 * 1024 * 1024) {
      const bc = binCache.get(fullPath);
      if (bc && bc.etag === etag) {
        res.writeHead(200, { 'Content-Type': ct, 'Content-Length': bc.buf.length, ETag: etag, 'Cache-Control': cacheHdr });
        res.end(bc.buf);
        return;
      }
      fs.readFile(fullPath, (rErr, raw) => {
        if (rErr) { res.writeHead(500); res.end('Read error'); return; }
        while (binCache.size > 0 && binCacheBytes + raw.length > BIN_CACHE_MAX_BYTES) {
          const oldK = binCache.keys().next().value;
          const oldV = binCache.get(oldK);
          if (oldV) binCacheBytes -= oldV.buf.length;
          binCache.delete(oldK);
        }
        if (bc) binCacheBytes -= bc.buf.length;
        binCache.set(fullPath, { etag, buf: raw });
        binCacheBytes += raw.length;
        res.writeHead(200, { 'Content-Type': ct, 'Content-Length': raw.length, ETag: etag, 'Cache-Control': cacheHdr });
        res.end(raw);
      });
      return;
    }
    res.writeHead(200, Object.assign({ 'Content-Type': ct, 'Content-Length': st.size, ETag: etag, 'Cache-Control': cacheHdr }, extraHdrs));
    fs.createReadStream(fullPath).pipe(res);
  });
});

let nextPeerNum = 1;
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  const peer = {
    id: `P${nextPeerNum++}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Người Chơi',
    color: PEER_COLORS[0],
    roomId: null,
    uidKey: null,
    state: null,
    socket
  };
  const cleanupPeer = () => {
    removePeerFromRoom(peer);
    unregisterUidPeer(peer);
  };
  let buf = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const b0 = buf[0], b1 = buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (buf.length < 4) return;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buf.length < 10) return;
        payloadLen = buf.readUInt32BE(6);
        offset = 10;
      }
      const totalLen = offset + (masked ? 4 : 0) + payloadLen;
      if (buf.length < totalLen) return;
      let payload;
      if (masked) {
        const mask = buf.subarray(offset, offset + 4);
        payload = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) payload[i] = buf[offset + 4 + i] ^ mask[i & 3];
      } else {
        payload = buf.subarray(offset, offset + payloadLen);
      }
      buf = buf.subarray(totalLen);

      if (opcode === 0x8) {
        cleanupPeer();
        try { socket.end(); } catch (_) {}
        return;
      } else if (opcode === 0x9) {
        try { socket.write(encodeWsFrame(payload.toString('utf8'), 0xA)); } catch (_) {}
      } else if (opcode === 0x1) {
        try { handleMessage(peer, JSON.parse(payload.toString('utf8'))); } catch (_) {}
      }
    }
  });
  socket.on('close', cleanupPeer);
  socket.on('error', cleanupPeer);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`NUCRAFT Server & Co-op Room Relay running on http://127.0.0.1:${PORT}/`);
});
