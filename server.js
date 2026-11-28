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
const allWsPeers = new Set();
const uidPeers = new Map(); // uidKey -> Set<peer>
const friendMailbox = new Map(); // uidKey -> Array<payload> (offline LAN friend queue)
const ACCOUNT_VAULT_FILE = path.join(__dirname, '.nucraft_accounts.json');
const accountVault = new Map(); // accountId -> opaque E2EE envelope { v, accountId, verifier, iv, ct, updatedAt }
let _accLoaded = false, _accSaveTimer = null;
function loadAccountVault() {
  if (_accLoaded) return;
  _accLoaded = true;
  try {
    if (!fs.existsSync(ACCOUNT_VAULT_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(ACCOUNT_VAULT_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (/^[a-f0-9]{16,64}$/.test(k) && v && typeof v.ct === 'string' && typeof v.verifier === 'string') {
          accountVault.set(k, v);
        }
      }
    }
  } catch (_) {}
}
function persistAccountVaultSoon() {
  if (_accSaveTimer) clearTimeout(_accSaveTimer);
  _accSaveTimer = setTimeout(() => {
    _accSaveTimer = null;
    try {
      const obj = {};
      for (const [k, v] of accountVault.entries()) obj[k] = v;
      fs.writeFile(ACCOUNT_VAULT_FILE, JSON.stringify(obj), () => {});
    } catch (_) {}
  }, 250);
}
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

function broadcastRoom(room, obj, exceptPeerId = null, isEphemeral = false) {
  const buf = encodeWsFrame(JSON.stringify(obj));
  for (const [pid, p] of room.peers.entries()) {
    if (pid === exceptPeerId || !p.socket || p.socket.destroyed) continue;
    if (isEphemeral && p.socket.writableLength > 32768) continue;
    try { p.socket.write(buf); } catch (_) {}
  }
}

const ROOM_CACHE_FILE = path.join(ROOT, '.nucraft_rooms_cache.json');
let _roomSaveTimer = null;

function sanitizePlayerKey(k) {
  return String(k || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

function _initPortalLinks(seed) {
  const out = { portals: { overworld: [], nether: [], sift: [], warden: [], dragon_realm: [] }, siftReturn: null, wardenReturn: null, dragonRealmReturn: null };
  if (!seed || typeof seed !== 'object') return out;
  if (seed.portals && typeof seed.portals === 'object') {
    for (const d of Object.keys(out.portals)) {
      if (!Array.isArray(seed.portals[d])) continue;
      for (const p of seed.portals[d]) {
        if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && Number.isFinite(Number(p.z))) {
          out.portals[d].push({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), b: Number(p.b) || 0 });
        }
      }
      if (out.portals[d].length > 32) out.portals[d] = out.portals[d].slice(-32);
    }
  }
  if (seed.siftReturn && Number.isFinite(Number(seed.siftReturn.x)) && Number.isFinite(Number(seed.siftReturn.z))) {
    out.siftReturn = { x: Math.floor(seed.siftReturn.x), y: Math.floor(seed.siftReturn.y || 0), z: Math.floor(seed.siftReturn.z) };
  }
  if (seed.wardenReturn && Number.isFinite(Number(seed.wardenReturn.x)) && Number.isFinite(Number(seed.wardenReturn.z))) {
    out.wardenReturn = { x: Math.floor(seed.wardenReturn.x), y: Math.floor(seed.wardenReturn.y || 0), z: Math.floor(seed.wardenReturn.z), depthOffset: Number(seed.wardenReturn.depthOffset) || 0 };
  }
  if (seed.dragonRealmReturn && Number.isFinite(Number(seed.dragonRealmReturn.x)) && Number.isFinite(Number(seed.dragonRealmReturn.z))) {
    out.dragonRealmReturn = { dim: String(seed.dragonRealmReturn.dim || 'end'), x: Math.floor(seed.dragonRealmReturn.x), y: Math.floor(seed.dragonRealmReturn.y || 0), z: Math.floor(seed.dragonRealmReturn.z), depthOffset: Number(seed.dragonRealmReturn.depthOffset) || 0 };
  }
  return out;
}

function _mergeServerPortalLink(room, link) {
  if (!room) return;
  if (!room.portalLinks) room.portalLinks = _initPortalLinks();
  if (!link || typeof link !== 'object') return;
  const pl = room.portalLinks;
  if (link.kind === 'portal') {
    const d = String(link.dim || '');
    if (!pl.portals[d]) return;
    const fx = Math.floor(Number(link.x)), fy = Math.floor(Number(link.y)), fz = Math.floor(Number(link.z)), fb = Number(link.b) || 0;
    if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(fz)) return;
    const arr = pl.portals[d];
    for (let i = 0; i < arr.length; i++) {
      if (Math.hypot(arr[i].x - fx, arr[i].z - fz) < 6 && (!arr[i].b || !fb || arr[i].b === fb)) {
        arr[i] = { x: fx, y: fy, z: fz, b: fb || arr[i].b || 0 };
        return;
      }
    }
    arr.push({ x: fx, y: fy, z: fz, b: fb });
    if (arr.length > 32) arr.shift();
  } else if (link.kind === 'sift_return' && Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.z))) {
    pl.siftReturn = { x: Math.floor(link.x), y: Math.floor(link.y || 0), z: Math.floor(link.z) };
  } else if (link.kind === 'warden_return' && Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.z))) {
    pl.wardenReturn = { x: Math.floor(link.x), y: Math.floor(link.y || 0), z: Math.floor(link.z), depthOffset: Number(link.depthOffset) || 0 };
  } else if (link.kind === 'dragon_realm_return' && Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.z))) {
    pl.dragonRealmReturn = { dim: String(link.dim || 'end'), x: Math.floor(link.x), y: Math.floor(link.y || 0), z: Math.floor(link.z), depthOffset: Number(link.depthOffset) || 0 };
  }
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
      spawnPos: r.spawnPos || null,
      portalLinks: r.portalLinks || null,
      modVer: r.modVer || 0,
      mods: Array.from(r.mods.entries()).slice(-120000),
      chests: Array.from(r.chests.entries()),
      consumedChests: Array.from(r.consumedChests.values()),
      furnaces: Array.from(r.furnaces ? r.furnaces.entries() : []),
      doors: Array.from(r.doors ? r.doors.entries() : []),
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
        spawnPos: (s.spawnPos && Number.isFinite(Number(s.spawnPos.x))) ? s.spawnPos : null,
        portalLinks: _initPortalLinks(s.portalLinks),
        modVer: Number(s.modVer) || 0,
        modLog: [],
        mods: new Map(Array.isArray(s.mods) ? s.mods.map(e => [String(e[0]), Number(e[1]) || 0]) : []),
        chests: new Map(Array.isArray(s.chests) ? s.chests : []),
        consumedChests: new Set(Array.isArray(s.consumedChests) ? s.consumedChests : []),
        furnaces: new Map(Array.isArray(s.furnaces) ? s.furnaces : []),
        doors: new Map(Array.isArray(s.doors) ? s.doors : []),
        drops: new Map(),
        claimedDrops: new Set(),
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

function applyServerBlockMod(room, dimIn, x, trueY, z, id, keyOpt = null, fl = undefined) {
  const dim = String(dimIn || 'overworld');
  const ix = Math.floor(Number(x));
  const iy = Math.floor(Number(trueY));
  const iz = Math.floor(Number(z));
  const bid = Number(id) || 0;
  if (!Number.isFinite(ix) || !Number.isFinite(iy) || !Number.isFinite(iz) || bid < 0 || bid > 65535) return null;
  const key = keyOpt ? String(keyOpt) : ((dim !== 'overworld') ? `${dim}:${ix},${iy},${iz}` : `${ix},${iy},${iz}`);
  room.mods.set(key, bid);
  if (room.mods.size > 120000) {
    const firstKey = room.mods.keys().next().value;
    room.mods.delete(firstKey);
  }
  room.modVer = (room.modVer || 0) + 1;
  if (!room.modLog) room.modLog = [];
  room.modLog.push({ ver: room.modVer, dim, entry: (typeof fl === 'number') ? [ix, iy, iz, bid, fl] : [ix, iy, iz, bid] });
  if (room.modLog.length > 4000) room.modLog.splice(0, room.modLog.length - 4000);
  return key;
}

let _srvClockTick = 0;
setInterval(() => {
  _srvClockTick++;
  const stepDay = 1.0 / (SHARED.DAY_LENGTH_SEC || 1800);
  const broadcastNow = (_srvClockTick % 10) === 0;
  for (const room of rooms.values()) {
    if (!room.peers || room.peers.size === 0) continue;
    room.dayTime = (((Number(room.dayTime) || 0) + stepDay) % 1.0 + 1.0) % 1.0;
    if (broadcastNow) broadcastRoom(room, { type: 'time_sync', dayTime: room.dayTime });
  }
}, 1000);

function sendWsModsInChunks(peer, entries, msgType = 'ws_mods_chunk') {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const CHUNK_SZ = 2500;
  for (let i = 0; i < entries.length; i += CHUNK_SZ) {
    sendJson(peer, { type: msgType, mods: entries.slice(i, i + CHUNK_SZ) });
  }
}

function serializeRoomListEntry(r) {
  return { roomId: r.id, worldName: r.worldName, players: r.peers.size, mode: r.mode, biome: r.biome, seed: r.seed };
}

function getAllRoomsSummary() {
  return Array.from(rooms.values()).map(serializeRoomListEntry);
}

function clearStaleRooms() {
  for (const [rid, r] of Array.from(rooms.entries())) {
    for (const [pid, p] of Array.from(r.peers.entries())) {
      if (!p || !p.socket || p.socket.destroyed) r.peers.delete(pid);
    }
    if (r.peers.size === 0) rooms.delete(rid);
  }
  saveRoomsToDiskSync();
  broadcastRoomsList();
}

function broadcastRoomsList() {
  if (allWsPeers.size === 0) return;
  const buf = encodeWsFrame(JSON.stringify({ type: 'rooms_list', rooms: getAllRoomsSummary() }));
  for (const p of allWsPeers) {
    if (p && p.socket && !p.socket.destroyed) { try { p.socket.write(buf); } catch (_) {} }
  }
}

function sanitizeCustomSkin(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = typeof raw.dataUrl === 'string' ? raw.dataUrl.trim() : '';
  if (!d || d.length > 42000 || !/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(d)) return null;
  return { dataUrl: d, slim: !!raw.slim };
}

function broadcastRoomRoster(room) {
  if (!room) return;
  const peers = [];
  for (const p of room.peers.values()) {
    peers.push({ peerId: p.id, name: p.name, color: p.color, skinId: p.skinId || null, playerKey: p.playerKey || '' });
  }
  broadcastRoom(room, { type: 'room_roster', roomId: room.id, hostId: room.hostId || '', peers });
}

function evictSamePlayerKey(room, pKey, keepPeerId) {
  if (!room || !pKey) return;
  for (const [oldId, oldPeer] of Array.from(room.peers.entries())) {
    if (oldId === keepPeerId || oldPeer.playerKey !== pKey) continue;
    room.peers.delete(oldId);
    oldPeer.roomId = null;
    broadcastRoom(room, { type: 'peer_leave', peerId: oldId, name: oldPeer.name });
    if (room.hostId === oldId) room.hostId = keepPeerId || null;
    try { oldPeer.socket.end(); } catch (_) {}
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
  broadcastRoomRoster(room);
  broadcastRoomsList();
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
    if (reusePrev) evictSamePlayerKey(prev, peer.playerKey, peer.id);
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
      spawnPos: (msg.spawnPos && Number.isFinite(Number(msg.spawnPos.x)) && Number.isFinite(Number(msg.spawnPos.z)))
        ? { x: Number(msg.spawnPos.x), y: Number(msg.spawnPos.y) || 14, z: Number(msg.spawnPos.z), yaw: Number(msg.spawnPos.yaw) || 0 }
        : null,
      portalLinks: (!reusePrev && msg.portalLinks) ? _initPortalLinks(msg.portalLinks) : _initPortalLinks(),
      modVer: 0,
      modLog: [],
      mods: new Map(),
      chests: new Map(),
      consumedChests: new Set(),
      furnaces: new Map(),
      doors: new Map(),
      drops: new Map(),
      claimedDrops: new Set(),
      mobsByDim: {},
      playersData: new Map(),
      peers: new Map()
    };
    if (!room.furnaces) room.furnaces = new Map();
    if (!room.doors) room.doors = new Map();
    if (!room.modLog) room.modLog = [];
    if (!room.portalLinks) room.portalLinks = _initPortalLinks(msg.portalLinks);
    if (!room.spawnPos && msg.spawnPos && Number.isFinite(Number(msg.spawnPos.x)) && Number.isFinite(Number(msg.spawnPos.z))) {
      room.spawnPos = { x: Number(msg.spawnPos.x), y: Number(msg.spawnPos.y) || 14, z: Number(msg.spawnPos.z), yaw: Number(msg.spawnPos.yaw) || 0 };
    }
    const hasServerState = !!(reusePrev && (room.peers.size > 0 || room.mods.size > 0 || room.chests.size > 0 || room.consumedChests.size > 0 || room.furnaces.size > 0));
    peer._skipInitModsPush = hasServerState;
    const hasLiveHost = !!(reusePrev && room.hostId && room.hostId !== peer.id && room.peers.has(room.hostId));
    if (!hasLiveHost) room.hostId = peer.id;
    if (typeof msg.ruinOriginX === 'number' && !reusePrev) room.ruinOriginX = msg.ruinOriginX;
    if (typeof msg.ruinOriginZ === 'number' && !reusePrev) room.ruinOriginZ = msg.ruinOriginZ;
    if (!hasServerState) {
      if (Array.isArray(msg.mods)) {
        for (const [k, v] of msg.mods.slice(-120000)) room.mods.set(String(k), Number(v) || 0);
      }
      if (Array.isArray(msg.chests)) {
        for (const entry of msg.chests) if (Array.isArray(entry) && entry.length >= 2) room.chests.set(String(entry[0]), entry[1]);
      }
      if (Array.isArray(msg.consumedChests)) {
        for (const ck of msg.consumedChests) room.consumedChests.add(String(ck));
      }
      if (Array.isArray(msg.furnaces)) {
        for (const entry of msg.furnaces) if (Array.isArray(entry) && entry.length >= 2) room.furnaces.set(String(entry[0]), entry[1]);
      }
      if (Array.isArray(msg.doors)) {
        for (const entry of msg.doors) if (Array.isArray(entry) && entry.length >= 2 && entry[1]) room.doors.set(String(entry[0]), 1);
      }
    }
    rooms.set(roomId, room);
    peer.name = String(msg.name || 'Người Chơi').slice(0, 20);
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 48);
    if (msg.customSkin !== undefined) peer.customSkin = sanitizeCustomSkin(msg.customSkin);
    if (msg.state) peer.state = msg.state;
    peer.color = PEER_COLORS[room.peers.size % PEER_COLORS.length];
    peer.roomId = roomId;
    const existingPeers = [];
    for (const p of room.peers.values()) {
      if (p.id !== peer.id) existingPeers.push({ peerId: p.id, name: p.name, color: p.color, skinId: p.skinId || null, customSkin: p.customSkin || null, playerKey: p.playerKey || '', equip: p.equip || null, state: p.state });
    }
    room.peers.set(peer.id, peer);
    const allMods = Array.from(room.mods.entries());
    const inlineMods = allMods.slice(0, 2500);
    const amHost = (room.hostId === peer.id);
    sendJson(peer, {
      type: 'room_joined',
      roomId,
      peerId: peer.id,
      color: peer.color,
      isHost: amHost,
      rejoin: !!msg.rejoin,
      reusePrev: hasServerState,
      modVer: room.modVer || 0,
      hostId: room.hostId,
      world: { seed: room.seed, worldName: room.worldName, mode: room.mode, biome: room.biome, preset: room.preset, dayTime: room.dayTime, weatherMode: room.weatherMode, activeWeatherKind: room.activeWeatherKind, ruinOriginX: room.ruinOriginX, ruinOriginZ: room.ruinOriginZ, spawnPos: room.spawnPos || null },
      portalLinks: room.portalLinks || null,
      mods: inlineMods,
      modsTotal: allMods.length,
      chests: Array.from(room.chests.entries()),
      consumedChests: Array.from(room.consumedChests.values()),
      furnaces: Array.from(room.furnaces.entries()),
      doors: Array.from(room.doors.entries()),
      drops: Array.from(room.drops.values()),
      mobsByDim: room.mobsByDim,
      savedPlayer: room.playersData.get(peer.playerKey) || null,
      peers: existingPeers
    });
    if (allMods.length > inlineMods.length) sendWsModsInChunks(peer, allMods.slice(inlineMods.length));
    if (existingPeers.length > 0) {
      broadcastRoom(room, { type: 'peer_join', peerId: peer.id, name: peer.name, color: peer.color, skinId: peer.skinId || null, customSkin: peer.customSkin || null, playerKey: peer.playerKey || '', state: peer.state }, peer.id);
    }
    broadcastRoomRoster(room);
    broadcastRoomsList();
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
    const liveHost = room.hostId ? room.peers.get(room.hostId) : null;
    if (liveHost && liveHost.id !== peer.id && liveHost.playerKey === peer.playerKey) {
      peer.playerKey = peer.id;
    } else {
      evictSamePlayerKey(room, peer.playerKey, peer.id);
    }
    peer.name = String(msg.name || 'Bạn Chơi').slice(0, 20);
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 48);
    if (msg.customSkin !== undefined) peer.customSkin = sanitizeCustomSkin(msg.customSkin);
    peer.color = PEER_COLORS[room.peers.size % PEER_COLORS.length];
    peer.roomId = roomId;
    const becomeHost = (!room.hostId || !room.peers.has(room.hostId));
    if (becomeHost) room.hostId = peer.id;
    const existingPeers = [];
    for (const p of room.peers.values()) {
      existingPeers.push({ peerId: p.id, name: p.name, color: p.color, skinId: p.skinId || null, customSkin: p.customSkin || null, playerKey: p.playerKey || '', equip: p.equip || null, state: p.state });
    }
    room.peers.set(peer.id, peer);
    if (!room.furnaces) room.furnaces = new Map();
    if (!room.doors) room.doors = new Map();
    const isRejoin = !!msg.rejoin;
    const canCatchupOnly = isRejoin && typeof msg.sinceVer === 'number' && room.modLog && (msg.sinceVer >= (room.modVer || 0) || (room.modLog.length > 0 && msg.sinceVer >= room.modLog[0].ver - 1));
    const allMods = canCatchupOnly ? [] : Array.from(room.mods.entries());
    const inlineMods = allMods.slice(0, 2500);
    sendJson(peer, {
      type: 'room_joined',
      roomId,
      peerId: peer.id,
      color: peer.color,
      isHost: becomeHost,
      rejoin: isRejoin,
      modVer: room.modVer || 0,
      hostId: room.hostId,
      world: { seed: room.seed, worldName: room.worldName, mode: room.mode, biome: room.biome, preset: room.preset, dayTime: room.dayTime, weatherMode: room.weatherMode, activeWeatherKind: room.activeWeatherKind, ruinOriginX: room.ruinOriginX, ruinOriginZ: room.ruinOriginZ, spawnPos: room.spawnPos || null },
      portalLinks: room.portalLinks || null,
      mods: inlineMods,
      modsTotal: allMods.length,
      chests: Array.from(room.chests.entries()),
      consumedChests: Array.from(room.consumedChests.values()),
      furnaces: Array.from(room.furnaces.entries()),
      doors: Array.from(room.doors.entries()),
      drops: Array.from(room.drops.values()),
      mobsByDim: room.mobsByDim,
      savedPlayer: room.playersData.get(peer.playerKey) || null,
      peers: existingPeers
    });
    if (canCatchupOnly && msg.sinceVer < (room.modVer || 0)) {
      const byDim = new Map();
      for (const item of room.modLog) {
        if (item.ver > msg.sinceVer) {
          if (!byDim.has(item.dim)) byDim.set(item.dim, []);
          byDim.get(item.dim).push(item.entry);
        }
      }
      for (const [dKey, entries] of byDim.entries()) {
        for (let i = 0; i < entries.length; i += 240) {
          sendJson(peer, { type: 'ws_mods_catchup', modVer: room.modVer, dim: dKey, blocks: entries.slice(i, i + 240) });
        }
      }
    } else if (allMods.length > inlineMods.length) {
      sendWsModsInChunks(peer, allMods.slice(inlineMods.length));
    }
    broadcastRoom(room, { type: 'peer_join', peerId: peer.id, name: peer.name, color: peer.color, skinId: peer.skinId || null, customSkin: peer.customSkin || null, playerKey: peer.playerKey || '', state: peer.state }, peer.id);
    broadcastRoomRoster(room);
    broadcastRoomsList();
    scheduleRoomsSave();
  } else if (msg.type === 'mods_push' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !Array.isArray(msg.mods)) return;
    if (msg.initSeedOnly && peer._skipInitModsPush) return;
    for (const [k, v] of msg.mods) room.mods.set(String(k), Number(v) || 0);
    while (room.mods.size > 120000) room.mods.delete(room.mods.keys().next().value);
    scheduleRoomsSave();
  } else if (msg.type === 'skin_sync' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 48);
    if (msg.customSkin !== undefined) peer.customSkin = sanitizeCustomSkin(msg.customSkin);
    broadcastRoom(room, { type: 'skin_sync', peerId: peer.id, skinId: peer.skinId || null, customSkin: peer.customSkin || null }, peer.id);
  } else if (msg.type === 'state' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (msg.skinId) peer.skinId = String(msg.skinId).slice(0, 48);
    if (msg.customSkin !== undefined) peer.customSkin = sanitizeCustomSkin(msg.customSkin);
    if (msg.equip) peer.equip = msg.equip;
    peer.state = msg.state || peer.state;
    if (peer.id === room.hostId && typeof msg.dayTime === 'number' && Number.isFinite(msg.dayTime)) room.dayTime = ((msg.dayTime % 1.0) + 1.0) % 1.0;
    const out = { type: 'peer_state', peerId: peer.id, name: peer.name, color: peer.color, skinId: peer.skinId || null, state: peer.state };
    if (msg.equip) out.equip = msg.equip;
    broadcastRoom(room, out, peer.id, true);
  } else if (msg.type === 'block' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    const ty = msg.trueY !== undefined ? msg.trueY : msg.y;
    const key = applyServerBlockMod(room, msg.dim || 'overworld', msg.x, ty, msg.z, msg.id, msg.key || null, msg.fl);
    if (!key) return;
    broadcastRoom(room, { type: 'block', peerId: peer.id, ver: room.modVer, key, dim: msg.dim || 'overworld', x: msg.x, y: msg.y, trueY: ty, z: msg.z, id: msg.id, prevId: msg.prevId, fl: msg.fl }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'block_batch' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !Array.isArray(msg.blocks)) return;
    const bDim = String(msg.dim || 'overworld');
    const batch = msg.blocks.slice(0, 512);
    for (let i = 0; i < batch.length; i++) {
      const b = batch[i];
      if (!Array.isArray(b) || b.length < 4) continue;
      applyServerBlockMod(room, bDim, b[0], b[1], b[2], b[3], null, b.length >= 5 ? b[4] : undefined);
    }
    broadcastRoom(room, { type: 'block_batch', peerId: peer.id, ver: room.modVer, dim: bDim, blocks: batch }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'sync_mods_since' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    const sinceVer = Number(msg.sinceVer) || 0;
    if (room.modLog && (sinceVer >= (room.modVer || 0) || (room.modLog.length > 0 && sinceVer >= room.modLog[0].ver - 1))) {
      const byDim = new Map();
      for (const item of room.modLog) {
        if (item.ver > sinceVer) {
          if (!byDim.has(item.dim)) byDim.set(item.dim, []);
          byDim.get(item.dim).push(item.entry);
        }
      }
      for (const [dKey, entries] of byDim.entries()) {
        for (let i = 0; i < entries.length; i += 240) {
          sendJson(peer, { type: 'ws_mods_catchup', modVer: room.modVer, dim: dKey, blocks: entries.slice(i, i + 240) });
        }
      }
    } else {
      sendWsModsInChunks(peer, Array.from(room.mods.entries()));
    }
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
  } else if (msg.type === 'drop_pickup_req') {
    if (!msg.dropId) return;
    const did = String(msg.dropId);
    const room = peer.roomId ? rooms.get(peer.roomId) : null;
    if (!room) {
      if (msg.drop && msg.drop.id) sendJson(peer, { type: 'drop_pickup_ack', dropId: did, drop: msg.drop });
      else sendJson(peer, { type: 'drop_remove', dropId: did });
      return;
    }
    if (!room.claimedDrops) room.claimedDrops = new Set();
    if (room.drops.has(did)) {
      const d = room.drops.get(did);
      room.drops.delete(did);
      room.claimedDrops.add(did);
      if (room.claimedDrops.size > 1000) room.claimedDrops.delete(room.claimedDrops.values().next().value);
      sendJson(peer, { type: 'drop_pickup_ack', dropId: did, drop: d });
      broadcastRoom(room, { type: 'drop_remove', dropId: did }, peer.id);
      scheduleRoomsSave();
    } else if (room.claimedDrops.has(did)) {
      sendJson(peer, { type: 'drop_remove', dropId: did });
    } else if (msg.drop && msg.drop.id) {
      room.claimedDrops.add(did);
      if (room.claimedDrops.size > 1000) room.claimedDrops.delete(room.claimedDrops.values().next().value);
      sendJson(peer, { type: 'drop_pickup_ack', dropId: did, drop: msg.drop });
      broadcastRoom(room, { type: 'drop_remove', dropId: did }, peer.id);
      scheduleRoomsSave();
    } else {
      sendJson(peer, { type: 'drop_remove', dropId: did });
    }
  } else if (msg.type === 'drop_remove' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (!room.claimedDrops) room.claimedDrops = new Set();
    const ids = Array.isArray(msg.dropIds) ? msg.dropIds : (msg.dropId ? [msg.dropId] : []);
    for (const rawId of ids) {
      const did = String(rawId);
      room.drops.delete(did);
      room.claimedDrops.add(did);
      if (room.claimedDrops.size > 1000) room.claimedDrops.delete(room.claimedDrops.values().next().value);
    }
    if (ids.length) broadcastRoom(room, { type: 'drop_remove', dropIds: ids }, peer.id);
  } else if (msg.type === 'mob_sync' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !Array.isArray(msg.mobs)) return;
    const dKey = String(msg.dim || 'overworld');
    const isFull = (msg.full !== false);
    const incoming = msg.mobs.slice(0, 120);
    if (isFull) {
      room.mobsByDim[dKey] = incoming;
    } else {
      const curList = Array.isArray(room.mobsByDim[dKey]) ? room.mobsByDim[dKey] : [];
      const byUid = new Map();
      for (let i = 0; i < curList.length; i++) {
        const it = curList[i];
        if (it && it.uid) byUid.set(it.uid, it);
      }
      if (Array.isArray(msg.rm)) {
        for (let i = 0; i < msg.rm.length; i++) byUid.delete(msg.rm[i]);
      }
      for (let i = 0; i < incoming.length; i++) {
        const it = incoming[i];
        if (it && it.uid) byUid.set(it.uid, it);
      }
      room.mobsByDim[dKey] = Array.from(byUid.values()).slice(-120);
    }
    const outPkt = { type: 'mob_sync', peerId: peer.id, dim: dKey, full: isFull, mobs: incoming };
    if (typeof msg.seq === 'number') outPkt.seq = msg.seq;
    if (typeof msg.ts === 'number') outPkt.ts = msg.ts;
    if (Array.isArray(msg.rm) && msg.rm.length) outPkt.rm = msg.rm;
    broadcastRoom(room, outPkt, peer.id, !isFull);
  } else if ((msg.type === 'mob_hit' || msg.type === 'mob_action' || msg.type === 'mob_remove' || msg.type === 'mob_player_hit') && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (msg.type === 'mob_remove' && msg.uid && room.mobsByDim) {
      for (const dKey of Object.keys(room.mobsByDim)) {
        const arr = room.mobsByDim[dKey];
        if (Array.isArray(arr)) room.mobsByDim[dKey] = arr.filter(m => m && m.uid !== msg.uid);
      }
    }
    if (msg.type === 'mob_player_hit' && msg._to && room.peers.has(msg._to)) {
      sendJson(room.peers.get(msg._to), { ...msg, peerId: peer.id });
      return;
    }
    broadcastRoom(room, { ...msg, peerId: peer.id }, peer.id);
  } else if (msg.type === 'furnace_sync' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !msg.key || !msg.state) return;
    if (!room.furnaces) room.furnaces = new Map();
    const fk = String(msg.key);
    room.furnaces.set(fk, msg.state);
    broadcastRoom(room, { type: 'furnace_sync', peerId: peer.id, key: fk, state: msg.state }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'furnace_break' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room || !msg.key) return;
    const fk = String(msg.key);
    if (room.furnaces) room.furnaces.delete(fk);
    broadcastRoom(room, { type: 'furnace_break', peerId: peer.id, key: fk }, peer.id);
    scheduleRoomsSave();
  } else if ((msg.type === 'door_toggle' || msg.type === 'weather_sync' || msg.type === 'explosion' || msg.type === 'tnt_spawn' || msg.type === 'projectile_spawn' || msg.type === 'lightning_fx' || msg.type === 'time_sync' || msg.type === 'world_action' || msg.type === 'ruin_origin' || msg.type === 'portal_link') && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    if (msg.type === 'portal_link') {
      _mergeServerPortalLink(room, msg.link || msg);
      broadcastRoom(room, { ...msg, peerId: peer.id, ver: room.modVer }, peer.id);
      scheduleRoomsSave();
      return;
    }
    if (msg.type === 'world_action') {
      if (msg.action === 'sleep_dawn') {
        room.dayTime = 0.28;
        broadcastRoom(room, { type: 'time_sync', dayTime: 0.28, snap: true, by: peer.name });
        scheduleRoomsSave();
      } else {
        const hostPeer = room.hostId ? room.peers.get(room.hostId) : null;
        const actDim = String(msg.dim || 'overworld');
        const hostDim = (hostPeer && hostPeer.state && hostPeer.state.dim) ? String(hostPeer.state.dim) : 'overworld';
        if (hostPeer && hostDim === actDim) {
          sendJson(hostPeer, { ...msg, peerId: hostPeer.id !== peer.id ? peer.id : '__srv__', fromPeerId: peer.id });
        } else {
          let hasOtherInDim = false;
          for (const [pid, p] of room.peers.entries()) {
            if (pid !== peer.id && p.state && String(p.state.dim || 'overworld') === actDim) { hasOtherInDim = true; break; }
          }
          const outAct = { ...msg, peerId: peer.id, fromPeerId: peer.id };
          if (hasOtherInDim) broadcastRoom(room, outAct, peer.id);
          else broadcastRoom(room, { ...outAct, peerId: '__srv__' }, null);
        }
      }
      return;
    }
    if (msg.type === 'time_sync') {
      if (peer.id !== room.hostId || typeof msg.dayTime !== 'number' || !Number.isFinite(msg.dayTime)) return;
      room.dayTime = ((msg.dayTime % 1.0) + 1.0) % 1.0;
    } else if (msg.type === 'door_toggle') {
      if (!room.doors) room.doors = new Map();
      const ty = msg.trueY !== undefined ? msg.trueY : msg.y;
      const dKey = msg.key ? String(msg.key) : `${msg.dim || 'overworld'}:${msg.x},${ty},${msg.z}`;
      if (msg.open) room.doors.set(dKey, 1);
      else room.doors.delete(dKey);
    } else if (msg.type === 'explosion' && Array.isArray(msg.blocks)) {
      const eDim = String(msg.dim || 'overworld');
      const blk = msg.blocks.slice(0, 512);
      for (let i = 0; i < blk.length; i++) {
        const b = blk[i];
        if (!Array.isArray(b) || b.length < 4) continue;
        applyServerBlockMod(room, eDim, b[0], b[1], b[2], b[3]);
      }
    } else if (msg.type === 'weather_sync') {
      if (msg.weatherMode) room.weatherMode = msg.weatherMode;
      if (msg.activeWeatherKind) room.activeWeatherKind = msg.activeWeatherKind;
    } else if (msg.type === 'ruin_origin') {
      room.ruinOriginX = Number(msg.x) || 0; room.ruinOriginZ = Number(msg.z) || 0;
    }
    broadcastRoom(room, { ...msg, peerId: peer.id, ver: room.modVer }, peer.id);
    scheduleRoomsSave();
  } else if (msg.type === 'chat' && peer.roomId) {
    const room = rooms.get(peer.roomId);
    if (!room) return;
    broadcastRoom(room, { type: 'chat', peerId: peer.id, name: peer.name, text: String(msg.text || '').slice(0, 140) });
  } else if (msg.type === 'leave') {
    removePeerFromRoom(peer);
  } else if (msg.type === 'list_rooms') {
    sendJson(peer, { type: 'rooms_list', rooms: getAllRoomsSummary() });
  } else if (msg.type === 'clear_rooms') {
    clearStaleRooms();
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
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: getAllRoomsSummary() }));
    return;
  }
  if (urlPath === '/api/rooms/clear' && req.method === 'POST') {
    clearStaleRooms();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: getAllRoomsSummary() }));
    return;
  }
  if (urlPath.startsWith('/api/account/')) {
    loadAccountVault();
    const sendApiJson = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(obj));
    };
    if (req.method === 'GET') {
      const id = urlPath.slice('/api/account/'.length).trim().toLowerCase();
      if (!/^[a-f0-9]{16,64}$/.test(id)) { sendApiJson(400, { ok: false, code: 'BAD_ID' }); return; }
      const env = accountVault.get(id) || null;
      sendApiJson(200, env ? { ok: true, found: true, envelope: env } : { ok: true, found: false });
      return;
    }
    if (req.method === 'POST' && urlPath === '/api/account/save') {
      let body = '', tooBig = false;
      req.on('data', (chunk) => {
        if (tooBig) return;
        body += chunk;
        if (body.length > 524288) { tooBig = true; sendApiJson(413, { ok: false, code: 'TOO_LARGE' }); req.destroy(); }
      });
      req.on('end', () => {
        if (tooBig) return;
        try {
          const parsed = JSON.parse(body || '{}');
          const id = String(parsed.accountId || '').toLowerCase();
          const env = parsed.envelope;
          if (!/^[a-f0-9]{16,64}$/.test(id) || !env || typeof env.verifier !== 'string' || typeof env.iv !== 'string' || typeof env.ct !== 'string' || typeof env.updatedAt !== 'number') {
            sendApiJson(400, { ok: false, code: 'INVALID_ENVELOPE' }); return;
          }
          const existing = accountVault.get(id);
          if (parsed.mode === 'register' && existing) {
            sendApiJson(409, { ok: false, code: 'EXISTS' }); return;
          }
          if (existing && existing.verifier !== env.verifier) {
            sendApiJson(403, { ok: false, code: 'WRONG_PASSWORD' }); return;
          }
          if (accountVault.size > 4000 && !existing) accountVault.delete(accountVault.keys().next().value);
          accountVault.set(id, {
            v: 1, accountId: id, verifier: env.verifier.slice(0, 128),
            iv: env.iv.slice(0, 64), ct: env.ct, updatedAt: env.updatedAt
          });
          persistAccountVaultSoon();
          sendApiJson(200, { ok: true, savedAt: env.updatedAt });
        } catch (_) {
          sendApiJson(400, { ok: false, code: 'BAD_JSON' });
        }
      });
      return;
    }
    sendApiJson(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
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
    const cacheHdr = isImmutableBinary ? 'public, max-age=0, must-revalidate' : 'no-cache';
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
  try { socket.setNoDelay(true); } catch (_) {}
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
  allWsPeers.add(peer);
  const cleanupPeer = () => {
    allWsPeers.delete(peer);
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
