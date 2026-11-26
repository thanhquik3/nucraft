// NUCRAFT Module: src/audio/AudioEngine.js — WebAudio synth, lazy OGG audio fetcher & procedural piano BGM

  /* ============================================================================
   * 4. OFFICIAL LUANTI OGG AUDIO ENGINE + CHILL MINECRAFT FELT-PIANO AMBIENT BGM!
   *    Separate Master / Music / SFX / Mob-Explosion buses — zero loud harsh noise!
   * ============================================================================ */
  let audioCtx = null, noiseBuf = null;
  let masterGain = null, musicGain = null, sfxGain = null, mobGain = null;
  let masterVolume = 0.78, musicVolume = 0.55, sfxVolume = 0.85, mobVolume = 0.42;
  const luantiBuffers = new Map();
  let luantiDecodeStarted = false, chillBgmStarted = false, bgmTimerId = null;
  const sfxCooldowns = Object.create(null);

  let _audioFetchCount = 0;
  const _luantiDecoding = new Set();
  function _decodeSingleLuantiKey(key) {
    if (!audioCtx || !key || luantiBuffers.has(key) || _luantiDecoding.has(key)) return;
    const srcMap = window.LUANTI_SOUNDS_OGG;
    if (srcMap && srcMap[key]) {
      _luantiDecoding.add(key);
      try {
        const bin = atob(srcMap[key]);
        const bytes = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
        audioCtx.decodeAudioData(bytes.buffer.slice(0), (buf) => {
          luantiBuffers.set(key, buf);
          _luantiDecoding.delete(key);
          if (typeof sodiumOpts === 'undefined' || sodiumOpts.modernFix) {
            try { delete window.LUANTI_SOUNDS_OGG[key]; } catch (_) {}
          }
        }, () => { _luantiDecoding.delete(key); });
      } catch (_) { _luantiDecoding.delete(key); }
      return;
    }
    const allowList = window.__NUCRAFT_SOUND_KEYS__;
    if ((location.protocol === 'http:' || location.protocol === 'https:') && (!Array.isArray(allowList) || allowList.includes(key))) {
      _luantiDecoding.add(key);
      fetch('assets/luanti_sounds/' + encodeURIComponent(key) + '.ogg')
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); _audioFetchCount++; return r.arrayBuffer(); })
        .then((ab) => new Promise((res, rej) => audioCtx.decodeAudioData(ab, res, rej)))
        .then((buf) => { luantiBuffers.set(key, buf); _luantiDecoding.delete(key); })
        .catch(() => { _luantiDecoding.delete(key); });
    }
  }
  function decodeLuantiSounds() {
    if (!audioCtx || luantiDecodeStarted) return;
    const srcMap = window.LUANTI_SOUNDS_OGG;
    if (srcMap) {
      luantiDecodeStarted = true;
      const keys = Object.keys(srcMap);
      if (typeof sodiumOpts !== 'undefined' && !sodiumOpts.modernFix) {
        for (let i = 0; i < keys.length; i++) _decodeSingleLuantiKey(keys[i]);
        return;
      }
      let idx = 0;
      const stepDecode = () => {
        if (!audioCtx || !window.LUANTI_SOUNDS_OGG) return;
        let batch = 0;
        while (idx < keys.length && batch < 3) {
          _decodeSingleLuantiKey(keys[idx++]);
          batch++;
        }
        if (idx < keys.length) setTimeout(stepDecode, 65);
      };
      setTimeout(stepDecode, 40);
      return;
    }
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      luantiDecodeStarted = true;
      const coreKeys = [
        'default_grass_footstep.1', 'default_hard_footstep.1', 'default_dig_crumbly',
        'default_dig_cracky', 'default_place_node.1', 'default_place_node_hard.1',
        'default_water_footstep.1', 'mobs_punch', 'player_damage_alt', 'tnt_explode'
      ];
      let idx = 0;
      const stepWarm = () => {
        if (!audioCtx) return;
        let batch = 0;
        while (idx < coreKeys.length && batch < 2) {
          _decodeSingleLuantiKey(coreKeys[idx++]);
          batch++;
        }
        if (idx < coreKeys.length) setTimeout(stepWarm, 90);
      };
      setTimeout(stepWarm, 80);
    }
  }

  // Warm Chill Minecraft-Style Ambient Felt-Piano Synthesizer (Biome & Dimension Adaptive Themes!)
  let musicEchoNode = null;
  function playChillPianoNote(freq, startT, dur = 3.6, vel = 0.14, timbre = 'piano') {
    if (!audioCtx || !musicGain || musicVolume <= 0.001) return;
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    const cutHi = timbre === 'celesta' ? 3200 : (timbre === 'marimba' ? 1450 : 2100);
    lpf.frequency.setValueAtTime(Math.min(cutHi, freq * (timbre === 'pad' ? 2.4 : 3.6)), startT);
    lpf.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.35), startT + dur);

    const env = audioCtx.createGain();
    const atk = timbre === 'pad' ? 0.35 : 0.032;
    env.gain.setValueAtTime(0.0001, startT);
    env.gain.linearRampToValueAtTime(vel, startT + atk);
    env.gain.exponentialRampToValueAtTime(vel * 0.40, startT + Math.min(dur * 0.45, 0.70));
    env.gain.exponentialRampToValueAtTime(0.0001, startT + dur);

    const osc1 = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
    osc1.type = (timbre === 'celesta' || timbre === 'pad') ? 'sine' : 'triangle';
    osc1.frequency.setValueAtTime(freq, startT);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * (timbre === 'marimba' ? 3.0 : (timbre === 'pad' ? 0.5 : 2.0)), startT);
    const g2 = audioCtx.createGain();
    g2.gain.value = timbre === 'celesta' ? 0.24 : (timbre === 'marimba' ? 0.09 : (timbre === 'pad' ? 0.28 : 0.16));

    osc1.connect(lpf); osc2.connect(g2); g2.connect(lpf);
    lpf.connect(env); env.connect(musicGain);
    if (musicEchoNode) env.connect(musicEchoNode);
    osc1.start(startT); osc2.start(startT);
    osc1.stop(startT + dur + 0.08); osc2.stop(startT + dur + 0.08);
  }

  function startChillMinecraftBGM() {
    if (chillBgmStarted || !audioCtx || !musicGain) return;
    chillBgmStarted = true;
    // Biome & Dimension Mapped Chill Minecraft Themes (stepSec, timbre, phrases)
    const BIOME_BGM_THEMES = {
      sakura:   { step: 1.05, timbre: 'celesta', phrases: [[[349.23,523.25],[440.00],[587.33],[659.25],[523.25]], [[293.66,440.00],[523.25],[659.25],[783.99],[659.25]], [[261.63,392.00],[440.00],[523.25],[587.33],[440.00]]] },
      mangrove: { step: 1.15, timbre: 'marimba', phrases: [[[293.66,440.00],[329.63],[392.00],[523.25],[440.00]], [[220.00,349.23],[392.00],[440.00],[523.25],[392.00]], [[261.63,392.00],[440.00],[493.88],[392.00]]] },
      desert:   { step: 1.28, timbre: 'pad',     phrases: [[[164.81,246.94],[329.63],[493.88],[415.30],[329.63]], [[146.83,220.00],[293.66],[440.00],[369.99],[293.66]], [[164.81,246.94],[369.99],[415.30],[329.63]]] },
      meadow:   { step: 1.18, timbre: 'piano',   phrases: [[[261.63,392.00],[329.63],[392.00],[493.88],[440.00]], [[220.00,329.63],[261.63],[392.00],[329.63],[293.66]], [[174.61,261.63,329.63],[392.00],[440.00],[523.25],[392.00]]] },
      snow:     { step: 1.32, timbre: 'celesta', phrases: [[[220.00,329.63],[523.25],[659.25],[783.99],[659.25]], [[174.61,261.63],[440.00],[523.25],[659.25],[440.00]], [[196.00,293.66],[392.00],[587.33],[493.88],[392.00]]] },
      cave:     { step: 1.42, timbre: 'celesta', phrases: [[[196.00,293.66],[440.00],[587.33],[523.25]], [[164.81,246.94],[392.00],[493.88],[440.00]], [[146.83,220.00],[329.63],[440.00],[392.00]]] },
      autumn:   { step: 1.08, timbre: 'piano',   phrases: [[[196.00,293.66,369.99],[440.00],[493.88],[587.33],[440.00]], [[164.81,246.94,329.63],[392.00],[440.00],[493.88],[369.99]], [[130.81,196.00,246.94],[329.63],[392.00],[293.66]]] },
      bamboo:   { step: 1.00, timbre: 'marimba', phrases: [[[293.66,440.00],[493.88],[587.33],[659.25],[587.33]], [[220.00,329.63],[392.00],[440.00],[587.33],[493.88]], [[196.00,293.66],[329.63],[440.00],[392.00]]] },
      beach:    { step: 1.12, timbre: 'piano',   phrases: [[[261.63,329.63,493.88],[587.33],[659.25],[523.25],[392.00]], [[220.00,293.66,440.00],[523.25],[587.33],[493.88],[392.00]], [[174.61,261.63,392.00],[440.00],[523.25],[392.00]]] },
      city:     { step: 1.24, timbre: 'piano',   phrases: [[[220.00,329.63],[392.00],[440.00],[523.25],[440.00]], [[174.61,261.63],[349.23],[440.00],[523.25],[392.00]], [[196.00,293.66],[392.00],[493.88],[440.00]]] },
      sift:     { step: 1.22, timbre: 'celesta', phrases: [[[329.63,493.88],[622.25],[739.99],[880.00],[739.99]], [[293.66,440.00],[554.37],[659.25],[783.99],[659.25]], [[261.63,392.00],[493.88],[587.33],[659.25]]] },
      nether:   { step: 1.55, timbre: 'pad',     phrases: [[[98.00,146.83],[174.61],[220.00],[196.00]], [[87.31,130.81],[164.81],[196.00],[174.61]], [[82.41,123.47],[146.83],[174.61],[130.81]]] },
      end:      { step: 1.48, timbre: 'celesta', phrases: [[[130.81,311.13],[466.16],[622.25],[587.33]], [[116.54,293.66],[440.00],[523.25],[466.16]], [[103.83,261.63],[392.00],[466.16],[392.00]]] },
      water:    { step: 1.38, timbre: 'celesta', phrases: [[[293.66,440.00],[523.25],[587.33],[659.25],[523.25]], [[261.63,392.00],[493.88],[523.25],[659.25],[440.00]], [[220.00,329.63],[440.00],[523.25],[587.33],[392.00]]] },
      night:    { step: 1.30, timbre: 'piano',   phrases: [[[164.81,246.94],[293.66],[329.63],[392.00],[329.63]], [[130.81,196.00,293.66],[329.63],[493.88],[392.00]], [[196.00,293.66],[329.63],[392.00],[293.66]]] }
    };
    let pIdx = 0;
    const pickBiomeThemeKey = () => {
      const dim = typeof currentDimension !== 'undefined' ? currentDimension : 'overworld';
      if (dim === 'nether') return 'nether';
      if (dim === 'end') return 'end';
      if (dim === 'sift') return 'sift';
      if (typeof player !== 'undefined' && player.eyesInWater) return 'water';
      const px = typeof player !== 'undefined' ? Math.floor(player.x) : 0;
      const pz = typeof player !== 'undefined' ? Math.floor(player.z) : 0;
      const trueY = typeof player !== 'undefined' ? Math.floor(player.y) - (typeof depthOffset === 'number' ? depthOffset : 0) : 20;
      if (trueY <= -8) return 'cave';
      const bio = (typeof getBiomeAt === 'function') ? getBiomeAt(px, pz) : null;
      if (bio === BIOMES.BLUE_FOREST) return 'sift';
      if (bio === BIOMES.WHEAT_VALLEY || bio === BIOMES.PINE_VALLEY) return 'meadow';
      if (bio === BIOMES.GIANT_JUNGLE) return 'mangrove';
      const bid = (bio && bio.id) || (typeof currentWorldMeta !== 'undefined' && currentWorldMeta.biome) || 'sakura';
      if (bid === 'sakura') return 'sakura';
      if (bid === 'mangrove') return 'mangrove';
      if (bid === 'desert' || bid === 'mesa' || bid === 'savanna') return 'desert';
      if (bid === 'snow' || bid === 'alpine' || bid === 'ice_peaks') return 'snow';
      if (bid === 'lush_cave') return 'cave';
      if (bid === 'autumn') return 'autumn';
      if (bid === 'bamboo') return 'bamboo';
      if (bid === 'beach_palm') return 'beach';
      if (bid === 'castle_city' || bid === 'seaport' || bid === 'modern_city' || bid === 'ruin') return 'city';
      if (typeof envUniforms !== 'undefined' && envUniforms.uSunDir && envUniforms.uSunDir.value.y < 0.02) return 'night';
      return 'meadow';
    };
    const scheduleNextPhrase = () => {
      if (!audioCtx) return;
      if (audioCtx.state === 'running' && musicVolume > 0.01) {
        const theme = BIOME_BGM_THEMES[pickBiomeThemeKey()] || BIOME_BGM_THEMES.meadow;
        const phrase = theme.phrases[pIdx % theme.phrases.length];
        pIdx++;
        let t = audioCtx.currentTime + 0.25;
        const stepSec = theme.step + Math.random() * 0.28;
        for (let i = 0; i < phrase.length; i++) {
          const chord = phrase[i];
          for (let c = 0; c < chord.length; c++) {
            playChillPianoNote(chord[c], t + c * 0.055, (theme.step * 3.4) + Math.random() * 0.9, c === 0 ? 0.115 : 0.082, theme.timbre);
          }
          t += stepSec * (i === phrase.length - 1 ? 1.80 : (0.9 + Math.random() * 0.28));
        }
        const waitMs = Math.round((t - audioCtx.currentTime + 2.4 + Math.random() * 2.6) * 1000);
        bgmTimerId = setTimeout(scheduleNextPhrase, waitMs);
      } else {
        bgmTimerId = setTimeout(scheduleNextPhrase, 2200);
      }
    };
    bgmTimerId = setTimeout(scheduleNextPhrase, 1000);
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        masterGain = audioCtx.createGain(); masterGain.gain.value = masterVolume; masterGain.connect(audioCtx.destination);
        musicGain  = audioCtx.createGain(); musicGain.gain.value  = musicVolume;  musicGain.connect(masterGain);
        try {
          const dly = audioCtx.createDelay(1.0); dly.delayTime.value = 0.36;
          const fb = audioCtx.createGain(); fb.gain.value = 0.24;
          const lpf = audioCtx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1450;
          const wet = audioCtx.createGain(); wet.gain.value = 0.28;
          dly.connect(lpf); lpf.connect(fb); fb.connect(dly);
          lpf.connect(wet); wet.connect(musicGain);
          musicEchoNode = dly;
        } catch (_) {}
        sfxGain    = audioCtx.createGain(); sfxGain.gain.value    = sfxVolume;    sfxGain.connect(masterGain);
        mobGain    = audioCtx.createGain(); mobGain.gain.value    = mobVolume;    mobGain.connect(masterGain);
        noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.0, audioCtx.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        decodeLuantiSounds();
        startChillMinecraftBGM();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  function playLuantiClip(keys, vol = 0.48, pitchMin = 0.92, pitchMax = 1.08, cdMs = 0, cdTag = '', bus = 'sfx') {
    if (!audioCtx || audioCtx.state !== 'running' || !masterGain) return false;
    if (cdMs > 0) {
      const tag = cdTag || (Array.isArray(keys) ? keys[0] : keys);
      const nowMs = performance.now();
      if (nowMs - (sfxCooldowns[tag] || 0) < cdMs) return true;
      sfxCooldowns[tag] = nowMs;
    }
    const list = Array.isArray(keys) ? keys : [keys];
    const ready = list.filter(k => luantiBuffers.has(k));
    if (!ready.length) {
      for (let i = 0; i < list.length; i++) _decodeSingleLuantiKey(list[i]);
      return false;
    }
    const pick = ready[Math.floor(Math.random() * ready.length)];
    const src = audioCtx.createBufferSource();
    src.buffer = luantiBuffers.get(pick);
    src.playbackRate.value = pitchMin + Math.random() * (pitchMax - pitchMin);
    const g = audioCtx.createGain();
    g.gain.value = Math.min(1.0, vol);
    src.connect(g);
    g.connect(bus === 'mob' ? (mobGain || masterGain) : (sfxGain || masterGain));
    src.start(audioCtx.currentTime);
    return true;
  }

  function playSoftFallback(f0, f1, dur, gainVal, bus = 'sfx') {
    if (!audioCtx || audioCtx.state !== 'running' || !masterGain) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + dur);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(gainVal, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g); g.connect(bus === 'mob' ? (mobGain || masterGain) : (sfxGain || masterGain));
    osc.start(now); osc.stop(now + dur + 0.02);
  }

  function getMaterialSoundClass(blockId) {
    const d = BLOCK_DEF[blockId]; if (!d) return 'grass';
    if (blockId === B.WATER || blockId === B.LAVA) return 'water';
    if (blockId === B.GLASS || blockId === B.BROKEN_GLASS || blockId === B.ICE || blockId === B.PACKED_ICE || blockId === B.GLOW_CRYSTAL) return 'glass';
    if (blockId === B.SNOW) return 'snow';
    if (blockId === B.SAND || blockId === B.SOUL_SAND) return 'sand';
    if (blockId === B.RUST_STEEL || blockId === B.ANVIL || blockId === B.ELEVATOR_BLOCK || blockId === B.IRON_ORE || blockId === B.GOLD_ORE || blockId === B.COPPER_ORE || blockId === B.TIN_ORE) return 'metal';
    if (d.wood || d.isLog) return 'wood';
    if (d.rock) return 'stone';
    if (d.foliage || d.cross || blockId === B.GRASS || blockId === B.MYCELIUM) return 'grass';
    return 'dirt';
  }

  function playFootstep(blockId, isLand = false) {
    const cls = getMaterialSoundClass(blockId);
    const v = isLand ? 0.56 : 0.34;
    const map = {
      grass: ['default_grass_footstep.1', 'default_grass_footstep.2'],
      dirt:  ['default_dirt_footstep.1', 'default_gravel_footstep.1'],
      sand:  ['default_sand_footstep.1'],
      snow:  ['default_snow_footstep.1'],
      stone: ['default_hard_footstep.1', 'default_hard_footstep.2'],
      wood:  ['default_wood_footstep.1', 'default_wood_footstep.2'],
      metal: ['default_metal_footstep.1'],
      glass: ['default_glass_footstep'],
      water: ['default_water_footstep.1', 'default_water_footstep.2']
    };
    playLuantiClip(map[cls] || map.grass, v, 0.92, 1.08, 120, 'foot');
  }

  function playBlockSfx(blockId, isBreak = false) {
    const cls = getMaterialSoundClass(blockId);
    if (isBreak) {
      if (cls === 'glass') { playLuantiClip('default_break_glass.1', 0.55, 0.94, 1.08); return; }
      if (cls === 'metal') { playLuantiClip('default_dug_metal.1', 0.52, 0.92, 1.08); return; }
      if (cls === 'wood')  { playLuantiClip(['default_dig_choppy', 'default_dug_node.1'], 0.54, 0.85, 1.02); return; }
      playLuantiClip('default_dug_node.1', 0.54, 0.90, 1.08);
      return;
    }
    const digMap = {
      wood:  'default_dig_choppy',
      stone: 'default_dig_cracky',
      metal: 'default_dig_metal',
      glass: 'default_glass_footstep',
      grass: 'default_dig_snappy',
      dirt:  'default_dig_crumbly',
      sand:  'default_dig_crumbly',
      snow:  'default_dig_crumbly'
    };
    playLuantiClip(digMap[cls] || 'default_dig_hand', 0.36, 0.90, 1.12, 130, 'dig');
  }

  function playMobSfx(mobType, kind = 'idle') {
    if (kind === 'attack') { playLuantiClip('mobs_swing', 0.28, 0.88, 1.10, 260, 'mob_atk', 'mob'); return; }
    if (kind === 'hurt') { playLuantiClip('mobs_punch', 0.34, 0.92, 1.12, 140, 'mob_hurt', 'mob'); return; }
    if (mobType === 'cow' || mobType === 'ravager') { playLuantiClip('mobs_cow', 0.25, mobType === 'ravager' ? 0.62 : 0.92, mobType === 'ravager' ? 0.74 : 1.08, 1800, 'm_cow', 'mob'); return; }
    if (mobType === 'sheep') { playLuantiClip('mobs_sheep', 0.24, 0.92, 1.08, 1800, 'm_sheep', 'mob'); return; }
    if (mobType === 'pig' || mobType === 'hoglin' || mobType === 'piglin' || mobType === 'piglin_brute') { playLuantiClip('mobs_pig', 0.24, mobType === 'pig' ? 0.95 : 0.68, mobType === 'pig' ? 1.10 : 0.82, 1800, 'm_pig', 'mob'); return; }
    if (mobType === 'chicken') { playLuantiClip('mobs_chicken', 0.22, 0.95, 1.12, 1800, 'm_chk', 'mob'); return; }
    if (mobType === 'spider') { playLuantiClip('mobs_spider', 0.22, 0.92, 1.08, 1800, 'm_spd', 'mob'); return; }
    if (mobType === 'void_stalker' || mobType === 'evoker' || mobType === 'witch' || mobType === 'iceologer') { playLuantiClip('mobs_oerkki', 0.22, 0.85, 1.05, 2200, 'm_oerk', 'mob'); return; }
    if (mobType === 'zombie' || mobType === 'husk' || mobType === 'drowned' || mobType === 'ruin_stalker') { playLuantiClip('mobs_dirtmonster', 0.24, 0.82, 1.02, 2200, 'm_zmb', 'mob'); return; }
    if (mobType === 'skeleton' || mobType === 'stray' || mobType === 'desert_skeleton' || mobType === 'bogged' || mobType === 'spider_jockey' || mobType === 'wither_skeleton' || mobType === 'gargoyle' || mobType === 'magma_golem') { playLuantiClip('mobs_stonemonster', 0.24, 0.82, 1.05, 2200, 'm_stn', 'mob'); return; }
    if (mobType === 'villager') { playSoftFallback(235, 195, 0.16, 0.08, 'mob'); }
  }

  function playSwordSlashSfx(comboHit = 1, didHit = false, isFire = false, isRainbow = false) {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const pMul = 0.94 + ((comboHit - 1) % 3) * 0.08;
    playLuantiClip('mobs_swing', 0.34, pMul, pMul + 0.12, 40, 'sw_s', 'sfx');
    try {
      const t = audioCtx.currentTime;
      const dest = sfxGain || masterGain || audioCtx.destination;
      // Air blade whoosh (noise sweep)
      const nSrc = audioCtx.createBufferSource();
      nSrc.buffer = noiseBuf;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1450 * pMul, t);
      bp.frequency.exponentialRampToValueAtTime(240, t + 0.13);
      bp.Q.value = 1.9;
      const nGain = audioCtx.createGain();
      nGain.gain.setValueAtTime(0.001, t);
      nGain.gain.linearRampToValueAtTime(0.32 * sfxVolume, t + 0.014);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      nSrc.connect(bp); bp.connect(nGain); nGain.connect(dest);
      nSrc.start(t, Math.random() * 0.3, 0.15);

      // Steel blade shimmer (and elemental accent for fire/prism)
      const osc = audioCtx.createOscillator();
      osc.type = isFire ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime((isRainbow ? 1760 : (isFire ? 920 : 1420)) * pMul, t);
      osc.frequency.exponentialRampToValueAtTime(isFire ? 260 : 580, t + 0.095);
      const oGain = audioCtx.createGain();
      oGain.gain.setValueAtTime(0.001, t);
      oGain.gain.linearRampToValueAtTime((didHit ? 0.17 : 0.11) * sfxVolume, t + 0.008);
      oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
      osc.connect(oGain); oGain.connect(dest);
      osc.start(t); osc.stop(t + 0.105);

      if (didHit) {
        // Sharp blade impact slice
        const hitOsc = audioCtx.createOscillator();
        hitOsc.type = 'square';
        hitOsc.frequency.setValueAtTime(2200 * pMul, t);
        hitOsc.frequency.exponentialRampToValueAtTime(420, t + 0.075);
        const hGain = audioCtx.createGain();
        hGain.gain.setValueAtTime(0.001, t);
        hGain.gain.linearRampToValueAtTime(0.15 * sfxVolume, t + 0.006);
        hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        hitOsc.connect(hGain); hGain.connect(dest);
        hitOsc.start(t); hitOsc.stop(t + 0.085);
      }
    } catch (_) {}
  }

  function playEatChompSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    try {
      const t = audioCtx.currentTime;
      const srcN = audioCtx.createBufferSource();
      srcN.buffer = noiseBuf;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(750 + Math.random() * 550, t);
      bp.Q.value = 1.6;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.28 * sfxVolume, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      srcN.connect(bp); bp.connect(g); g.connect(sfxGain || masterGain || audioCtx.destination);
      srcN.start(t, Math.random() * 0.4, 0.11);
    } catch (_) {}
  }
  function playEatBurpSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 40, t);
      osc.frequency.exponentialRampToValueAtTime(95, t + 0.18);
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18 * sfxVolume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.connect(g); g.connect(sfxGain || masterGain || audioCtx.destination);
      osc.start(t); osc.stop(t + 0.21);
    } catch (_) {}
  }
  const _crumbFwd = new THREE.Vector3(), _crumbEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  function spawnFoodCrumbs(hexCol) {
    try {
      _crumbEuler.set(player.pitch, player.yaw, 0, 'YXZ');
      const fwd = _crumbFwd.set(0, 0, -1).applyEuler(_crumbEuler);
      const eyeY = player.y + (player.sneaking ? EYE_HEIGHT - 0.24 : EYE_HEIGHT) - 0.16;
      const cx = player.x + fwd.x * 0.55;
      const cy = eyeY + fwd.y * 0.45;
      const cz = player.z + fwd.z * 0.55;
      spawnParticles(cx, cy, cz, hexCol || 0xd97706, 6, false);
    } catch (_) {}
  }

  let thunderNoiseBuf = null;
  function playThunderSfx(dist = 16) {
    if (!audioCtx || audioCtx.state !== 'running' || !masterGain || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.thund || 0) < 1600) return;
    sfxCooldowns.thund = nowMs;
    try {
      if (!thunderNoiseBuf) {
        const sr = audioCtx.sampleRate || 44100;
        const len = Math.floor(sr * 3.2);
        thunderNoiseBuf = audioCtx.createBuffer(1, len, sr);
        const ch = thunderNoiseBuf.getChannelData(0);
        let b = 0, peak = 0;
        for (let i = 0; i < len; i++) {
          b = (b + 0.032 * (Math.random() * 2 - 1)) / 1.032;
          ch[i] = b;
          const a = Math.abs(b);
          if (a > peak) peak = a;
        }
        const norm = peak > 1e-4 ? (0.85 / peak) : 1;
        for (let i = 0; i < len; i++) ch[i] *= norm;
      }
      const dNorm = Math.max(0, Math.min(1, 1 - (Math.max(0, dist) - 6) / 38));
      const vol = 0.14 + dNorm * 0.14;
      const t0 = audioCtx.currentTime + Math.min(0.24, Math.max(0.02, dist * 0.007));
      const dest = sfxGain || masterGain;

      // 1. Soft atmospheric sky clap (zero harsh high-frequency transient)
      const clapSrc = audioCtx.createBufferSource();
      clapSrc.buffer = thunderNoiseBuf;
      const clapBp = audioCtx.createBiquadFilter();
      clapBp.type = 'bandpass';
      clapBp.frequency.setValueAtTime(310 + Math.random() * 70, t0);
      clapBp.Q.value = 0.65;
      const clapLp = audioCtx.createBiquadFilter();
      clapLp.type = 'lowpass';
      clapLp.frequency.setValueAtTime(560, t0);
      clapLp.frequency.exponentialRampToValueAtTime(150, t0 + 0.44);
      clapLp.Q.value = 0.7;
      const clapG = audioCtx.createGain();
      clapG.gain.setValueAtTime(0.0005, t0);
      clapG.gain.linearRampToValueAtTime(vol * 0.52, t0 + 0.035);
      clapG.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.56);
      clapSrc.connect(clapBp); clapBp.connect(clapLp); clapLp.connect(clapG); clapG.connect(dest);
      clapSrc.start(t0, Math.random() * 0.6);
      clapSrc.stop(t0 + 0.62);

      // 2. Deep rolling multi-swell cloud rumble
      const rollSrc = audioCtx.createBufferSource();
      rollSrc.buffer = thunderNoiseBuf;
      rollSrc.loop = true;
      const lp1 = audioCtx.createBiquadFilter();
      lp1.type = 'lowpass';
      lp1.frequency.setValueAtTime(260, t0 + 0.03);
      lp1.frequency.exponentialRampToValueAtTime(85, t0 + 2.93);
      lp1.Q.value = 0.7;
      const lp2 = audioCtx.createBiquadFilter();
      lp2.type = 'lowpass';
      lp2.frequency.setValueAtTime(380, t0 + 0.03);
      lp2.frequency.exponentialRampToValueAtTime(125, t0 + 2.93);
      lp2.Q.value = 0.7;
      const rollG = audioCtx.createGain();
      rollG.gain.setValueAtTime(0.0005, t0 + 0.03);
      rollG.gain.linearRampToValueAtTime(vol * 0.92, t0 + 0.22);
      rollG.gain.linearRampToValueAtTime(vol * 0.48, t0 + 0.62);
      rollG.gain.linearRampToValueAtTime(vol * 0.68, t0 + 1.02);
      rollG.gain.linearRampToValueAtTime(vol * 0.30, t0 + 1.55);
      rollG.gain.linearRampToValueAtTime(vol * 0.36, t0 + 1.92);
      rollG.gain.exponentialRampToValueAtTime(0.0005, t0 + 3.05);
      rollSrc.connect(lp1); lp1.connect(lp2); lp2.connect(rollG); rollG.connect(dest);
      rollSrc.start(t0 + 0.03, Math.random() * 1.2);
      rollSrc.stop(t0 + 3.12);

      // 3. Warm sub-bass depth bed
      const subOsc = audioCtx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(60 + Math.random() * 10, t0 + 0.04);
      subOsc.frequency.exponentialRampToValueAtTime(35, t0 + 1.49);
      const subG = audioCtx.createGain();
      subG.gain.setValueAtTime(0.0005, t0 + 0.04);
      subG.gain.linearRampToValueAtTime(vol * 0.28, t0 + 0.09);
      subG.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.50);
      subOsc.connect(subG); subG.connect(dest);
      subOsc.start(t0 + 0.04);
      subOsc.stop(t0 + 1.55);
    } catch (_) {}
  }

  let _ambientAudioReady = false, _cicadaGain = null, _windGain = null, _windFilter = null;
  function _ensureAmbientSoundRig() {
    if (_ambientAudioReady || !audioCtx || !masterGain || !noiseBuf) return;
    _ambientAudioReady = true;
    try {
      const dest = sfxGain || masterGain;
      // 1. Summer Wheat Field Cicadas ("ve keu" bandpass shimmer + soft triangle modulation)
      const cNoise = audioCtx.createBufferSource();
      cNoise.buffer = noiseBuf;
      cNoise.loop = true;
      const cBp = audioCtx.createBiquadFilter();
      cBp.type = 'bandpass';
      cBp.frequency.value = 3920;
      cBp.Q.value = 6.2;
      const cOsc = audioCtx.createOscillator();
      cOsc.type = 'triangle';
      cOsc.frequency.value = 4180;
      const cOscGain = audioCtx.createGain();
      cOscGain.gain.value = 0.08;
      _cicadaGain = audioCtx.createGain();
      _cicadaGain.gain.value = 0.0001;
      cNoise.connect(cBp); cBp.connect(_cicadaGain);
      cOsc.connect(cOscGain); cOscGain.connect(_cicadaGain);
      _cicadaGain.connect(dest);
      cNoise.start(); cOsc.start();

      // 2. Smooth Weather Wind Bed (blizzard, sandstorm, storm, rain breeze)
      const wSrc = audioCtx.createBufferSource();
      wSrc.buffer = noiseBuf;
      wSrc.loop = true;
      _windFilter = audioCtx.createBiquadFilter();
      _windFilter.type = 'bandpass';
      _windFilter.frequency.value = 380;
      _windFilter.Q.value = 1.1;
      _windGain = audioCtx.createGain();
      _windGain.gain.value = 0.0001;
      wSrc.connect(_windFilter); _windFilter.connect(_windGain); _windGain.connect(dest);
      wSrc.start();
    } catch (_) {}
  }

  function updateAmbientSoundscape() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    _ensureAmbientSoundRig();
    const now = audioCtx.currentTime;
    const playingNow = (typeof isPlaying !== 'undefined' && isPlaying);
    const inOverworld = (typeof currentDimension === 'undefined' || currentDimension === 'overworld') && (typeof depthOffset !== 'number' || depthOffset === 0);
    const inWater = (typeof player !== 'undefined' && !!player.eyesInWater);
    const bio = (playingNow && inOverworld && typeof getPlayerBiome === 'function') ? getPlayerBiome() : null;
    const wKind = (typeof activeWeatherKind !== 'undefined') ? activeWeatherKind : 'clear';
    const sunY = (typeof envUniforms !== 'undefined' && envUniforms.uSunDir) ? envUniforms.uSunDir.value.y : 0.4;

    if (_cicadaGain) {
      const inWheatDay = playingNow && inOverworld && !inWater && (typeof BIOMES !== 'undefined' && bio === BIOMES.WHEAT_VALLEY) && sunY > -0.05 && wKind !== 'storm' && wKind !== 'blizzard';
      let targetC = 0.0001;
      if (inWheatDay) {
        const pulse = (0.55 + 0.45 * Math.sin(now * 0.52)) * (0.74 + 0.26 * Math.sin(now * 17.2));
        targetC = Math.max(0.0001, 0.036 * pulse);
      }
      _cicadaGain.gain.setTargetAtTime(targetC, now, 0.25);
    }
    if (_windGain && _windFilter) {
      let targetW = 0.0001;
      let freqW = 360;
      if (playingNow && inOverworld && !inWater) {
        const gust = 0.78 + 0.22 * Math.sin(now * 0.65);
        if (wKind === 'blizzard') { targetW = 0.072 * gust; freqW = 540 + 140 * Math.sin(now * 0.9); }
        else if (wKind === 'sandstorm') { targetW = 0.068 * gust; freqW = 620 + 160 * Math.sin(now * 1.1); }
        else if (wKind === 'storm') { targetW = 0.048 * gust; freqW = 420 + 90 * Math.sin(now * 0.8); }
        else if (wKind === 'rain') { targetW = 0.022 * gust; freqW = 320; }
      }
      _windFilter.frequency.setTargetAtTime(freqW, now, 0.35);
      _windGain.gain.setTargetAtTime(targetW, now, 0.35);
    }
  }

  function playLevelUpSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    try {
      const now = audioCtx.currentTime;
      const dest = sfxGain || masterGain;
      // Authentic Minecraft crystalline rising chime arpeggio (F#5 - A5 - C#6 - F#6)
      const notes = [739.99, 880.00, 1108.73, 1479.98];
      for (let i = 0; i < notes.length; i++) {
        const t = now + i * 0.068;
        const dur = i === notes.length - 1 ? 0.62 : 0.28;
        const osc = audioCtx.createOscillator(), oscH = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(notes[i], t);
        oscH.type = 'triangle'; oscH.frequency.setValueAtTime(notes[i] * 2.0, t);
        const hg = audioCtx.createGain(); hg.gain.value = 0.22;
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(0.15 * sfxVolume, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        osc.connect(g); oscH.connect(hg); hg.connect(g);
        g.connect(dest);
        if (musicEchoNode) g.connect(musicEchoNode);
        osc.start(t); oscH.start(t);
        osc.stop(t + dur + 0.03); oscH.stop(t + dur + 0.03);
      }
    } catch (_) {}
  }

  function playXpOrbSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.xp || 0) < 55) return;
    sfxCooldowns.xp = nowMs;
    const f = 760 + Math.random() * 440;
    playSoftFallback(f, f * 1.18, 0.12, 0.08 * sfxVolume, 'sfx');
  }

  function playUiHoverSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.ui_hov || 0) < 62) return;
    sfxCooldowns.ui_hov = nowMs;
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.030);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.135 * sfxVolume, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.034);
      osc.connect(g); g.connect(sfxGain || masterGain);
      osc.start(t); osc.stop(t + 0.040);
    } catch (_) {}
  }

  function playUiClickSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.ui_clk || 0) < 35) return;
    sfxCooldowns.ui_clk = nowMs;
    try {
      const t = audioCtx.currentTime;
      const dest = sfxGain || masterGain;
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, t);
      osc.frequency.exponentialRampToValueAtTime(330, t + 0.052);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.28 * sfxVolume, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.058);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.064);

      const tick = audioCtx.createOscillator(), tg = audioCtx.createGain();
      tick.type = 'sine';
      tick.frequency.setValueAtTime(1220, t);
      tg.gain.setValueAtTime(0.001, t);
      tg.gain.linearRampToValueAtTime(0.17 * sfxVolume, t + 0.003);
      tg.gain.exponentialRampToValueAtTime(0.0005, t + 0.026);
      tick.connect(tg); tg.connect(dest);
      tick.start(t); tick.stop(t + 0.030);
    } catch (_) {}
  }

  function playUiLockedSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.ui_lck || 0) < 120) return;
    sfxCooldowns.ui_lck = nowMs;
    playSoftFallback(185, 120, 0.085, 0.20 * sfxVolume, 'sfx');
  }

  function playItemSwitchSfx(itemId = 0) {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.itm_sw || 0) < 42) return;
    sfxCooldowns.itm_sw = nowMs;
    try {
      const def = (itemId && typeof BLOCK_DEF !== 'undefined') ? BLOCK_DEF[itemId] : null;
      const isGear = !!(def && (def.tool || def.armorSlot || def.shield));
      const t = audioCtx.currentTime;
      const dest = sfxGain || masterGain;
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = isGear ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isGear ? 980 : 460, t);
      osc.frequency.exponentialRampToValueAtTime(isGear ? 1420 : 640, t + 0.042);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime((isGear ? 0.26 : 0.22) * sfxVolume, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.052);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.058);

      const overtone = audioCtx.createOscillator(), og = audioCtx.createGain();
      overtone.type = isGear ? 'sine' : 'triangle';
      overtone.frequency.setValueAtTime(isGear ? 1650 : 760, t);
      overtone.frequency.exponentialRampToValueAtTime(isGear ? 2150 : 520, t + 0.026);
      og.gain.setValueAtTime(0.001, t);
      og.gain.linearRampToValueAtTime(0.14 * sfxVolume, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0005, t + 0.032);
      overtone.connect(og); og.connect(dest);
      overtone.start(t); overtone.stop(t + 0.036);
    } catch (_) {}
  }

  let _bowDrawHandle = null;
  function stopBowDrawSfx() {
    const h = _bowDrawHandle;
    if (!h) return;
    _bowDrawHandle = null;
    try {
      const ctx = audioCtx;
      if (ctx) {
        const t = ctx.currentTime;
        h.gain.gain.cancelScheduledValues(t);
        h.gain.gain.setTargetAtTime(0.0001, t, 0.015);
      }
      setTimeout(() => {
        for (const n of h.nodes) { try { n.stop(); } catch (_) {} }
      }, 60);
    } catch (_) {}
  }

  function playBowDrawSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01 || !noiseBuf) return;
    stopBowDrawSfx();
    try {
      const t = audioCtx.currentTime;
      const dest = sfxGain || masterGain;
      const drawG = audioCtx.createGain();
      drawG.gain.setValueAtTime(1.0, t);
      drawG.connect(dest);

      // Layer 1: taut bowstring pull friction sweep
      const nSrc = audioCtx.createBufferSource();
      nSrc.buffer = noiseBuf; nSrc.loop = true;
      const strBp = audioCtx.createBiquadFilter();
      strBp.type = 'bandpass';
      strBp.frequency.setValueAtTime(680, t);
      strBp.frequency.exponentialRampToValueAtTime(1680, t + 0.74);
      strBp.Q.value = 3.2;
      const gStr = audioCtx.createGain();
      gStr.gain.setValueAtTime(0.0005, t);
      gStr.gain.linearRampToValueAtTime(0.15 * sfxVolume, t + 0.09);
      gStr.gain.linearRampToValueAtTime(0.22 * sfxVolume, t + 0.62);
      gStr.gain.exponentialRampToValueAtTime(0.0005, t + 0.79);
      nSrc.connect(strBp); strBp.connect(gStr); gStr.connect(drawG);

      // Layer 2: wooden bow stave bending/creak under tension
      const wOsc = audioCtx.createOscillator();
      wOsc.type = 'triangle';
      wOsc.frequency.setValueAtTime(138, t);
      wOsc.frequency.exponentialRampToValueAtTime(208, t + 0.74);
      const lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(24, t);
      lfo.frequency.linearRampToValueAtTime(38, t + 0.74);
      const lfoG = audioCtx.createGain();
      lfoG.gain.value = 18;
      lfo.connect(lfoG); lfoG.connect(wOsc.frequency);
      const wBp = audioCtx.createBiquadFilter();
      wBp.type = 'bandpass';
      wBp.frequency.setValueAtTime(340, t);
      wBp.frequency.exponentialRampToValueAtTime(540, t + 0.74);
      wBp.Q.value = 2.2;
      const gWood = audioCtx.createGain();
      gWood.gain.setValueAtTime(0.0005, t);
      gWood.gain.linearRampToValueAtTime(0.09 * sfxVolume, t + 0.14);
      gWood.gain.linearRampToValueAtTime(0.13 * sfxVolume, t + 0.60);
      gWood.gain.exponentialRampToValueAtTime(0.0005, t + 0.78);
      wOsc.connect(wBp); wBp.connect(gWood); gWood.connect(drawG);

      // Layer 3: crisp arrow-nock tap at draw start
      const tapOsc = audioCtx.createOscillator();
      tapOsc.type = 'triangle';
      tapOsc.frequency.setValueAtTime(980, t);
      tapOsc.frequency.exponentialRampToValueAtTime(460, t + 0.028);
      const gTap = audioCtx.createGain();
      gTap.gain.setValueAtTime(0.0005, t);
      gTap.gain.linearRampToValueAtTime(0.085 * sfxVolume, t + 0.004);
      gTap.gain.exponentialRampToValueAtTime(0.0005, t + 0.032);
      tapOsc.connect(gTap); gTap.connect(drawG);

      const handle = { gain: drawG, nodes: [nSrc, wOsc, lfo, tapOsc] };
      _bowDrawHandle = handle;
      nSrc.onended = () => { if (_bowDrawHandle === handle) _bowDrawHandle = null; };
      nSrc.start(t, Math.random() * 0.4);
      wOsc.start(t); lfo.start(t); tapOsc.start(t);
      nSrc.stop(t + 0.82); wOsc.stop(t + 0.82); lfo.stop(t + 0.82); tapOsc.stop(t + 0.04);
    } catch (_) {}
  }

  function playBowFullSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    try {
      const t = audioCtx.currentTime;
      const dest = sfxGain || masterGain;
      const wOsc = audioCtx.createOscillator(), wG = audioCtx.createGain();
      wOsc.type = 'triangle';
      wOsc.frequency.setValueAtTime(420, t);
      wOsc.frequency.exponentialRampToValueAtTime(590, t + 0.065);
      wG.gain.setValueAtTime(0.0005, t);
      wG.gain.linearRampToValueAtTime(0.095 * sfxVolume, t + 0.008);
      wG.gain.exponentialRampToValueAtTime(0.0005, t + 0.068);
      wOsc.connect(wG); wG.connect(dest);
      wOsc.start(t); wOsc.stop(t + 0.075);

      const sOsc = audioCtx.createOscillator(), sG = audioCtx.createGain();
      sOsc.type = 'sine';
      sOsc.frequency.setValueAtTime(1820, t);
      sOsc.frequency.exponentialRampToValueAtTime(1480, t + 0.055);
      sG.gain.setValueAtTime(0.0005, t);
      sG.gain.linearRampToValueAtTime(0.045 * sfxVolume, t + 0.005);
      sG.gain.exponentialRampToValueAtTime(0.0005, t + 0.058);
      sOsc.connect(sG); sG.connect(dest);
      sOsc.start(t); sOsc.stop(t + 0.064);
    } catch (_) {}
  }

  function playBowReleaseSfx() {
    if (!audioCtx || audioCtx.state !== 'running' || sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - (sfxCooldowns.bow || 0) < 80) return;
    sfxCooldowns.bow = nowMs;
    stopBowDrawSfx();
    try {
      const t = audioCtx.currentTime;
      const dest = sfxGain || masterGain;
      const pMul = 0.94 + Math.random() * 0.12;

      // Crisp bowstring twang
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1850, t);
      lp.frequency.exponentialRampToValueAtTime(310, t + 0.15);
      lp.Q.value = 1.4;
      const o1 = audioCtx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(235 * pMul, t);
      o1.frequency.exponentialRampToValueAtTime(88, t + 0.15);
      const o2 = audioCtx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.setValueAtTime(470 * pMul, t);
      o2.frequency.exponentialRampToValueAtTime(150, t + 0.15);
      const o2G = audioCtx.createGain(); o2G.gain.value = 0.35;
      const twG = audioCtx.createGain();
      twG.gain.setValueAtTime(0.001, t);
      twG.gain.linearRampToValueAtTime(0.24 * sfxVolume, t + 0.005);
      twG.gain.exponentialRampToValueAtTime(0.0005, t + 0.165);
      o1.connect(lp); o2.connect(o2G); o2G.connect(lp); lp.connect(twG); twG.connect(dest);
      o1.start(t); o2.start(t); o1.stop(t + 0.175); o2.stop(t + 0.175);

      // Arrow air-whoosh
      if (noiseBuf) {
        const wSrc = audioCtx.createBufferSource(); wSrc.buffer = noiseBuf;
        const wBp = audioCtx.createBiquadFilter(); wBp.type = 'bandpass';
        wBp.frequency.setValueAtTime(1350, t);
        wBp.frequency.exponentialRampToValueAtTime(2500, t + 0.035);
        wBp.frequency.exponentialRampToValueAtTime(850, t + 0.14);
        wBp.Q.value = 1.8;
        const wG = audioCtx.createGain();
        wG.gain.setValueAtTime(0.001, t);
        wG.gain.linearRampToValueAtTime(0.20 * sfxVolume, t + 0.012);
        wG.gain.exponentialRampToValueAtTime(0.0005, t + 0.145);
        wSrc.connect(wBp); wBp.connect(wG); wG.connect(dest);
        wSrc.start(t, Math.random() * 0.4, 0.16);
      }
    } catch (_) {}
  }

  function playSfx(type) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    if (type === 'levelup') { playLevelUpSfx(); return; }
    if (type === 'xp_orb') { playXpOrbSfx(); return; }
    if (type === 'ui_open') { playSoftFallback(340, 560, 0.080, 0.20 * sfxVolume); return; }
    if (type === 'ui_close') { playSoftFallback(500, 290, 0.075, 0.18 * sfxVolume); return; }
    if (type === 'meteor') { playSoftFallback(1760, 2349, 0.22, 0.032 * sfxVolume); return; }
    if (type === 'wing_flap') {
      const nowMs = performance.now();
      if (nowMs - (sfxCooldowns.wflap || 0) < 480 || !noiseBuf) return;
      sfxCooldowns.wflap = nowMs;
      try {
        const t = audioCtx.currentTime;
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(110, t + 0.21);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0005, t); g.gain.linearRampToValueAtTime(0.11 * sfxVolume, t + 0.045);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
        src.connect(lp); lp.connect(g); g.connect(sfxGain || masterGain);
        src.start(t, Math.random() * 0.4, 0.24);
      } catch (_) {}
      return;
    }
    if (type === 'explode') { playLuantiClip('tnt_explode', 0.36, 0.90, 1.05, 220, 'exp', 'mob'); return; }
    if (type === 'mob_explode') { playLuantiClip(['mobs_spell', 'tnt_explode'], 0.22, 0.95, 1.15, 280, 'm_exp', 'mob'); return; }
    if (type === 'thunder') { playThunderSfx(16); return; }
    if (type === 'hiss') { playLuantiClip('tnt_ignite', 0.32, 0.95, 1.08, 300, 'hiss', 'sfx'); return; }
    if (type === 'dig') { playBlockSfx(B.STONE, false); return; }
    if (type === 'break') { playBlockSfx(B.STONE, true); return; }
    if (type === 'place') { playLuantiClip(['default_place_node.1', 'default_place_node_hard.1'], 0.45, 0.94, 1.08, 60, 'plc', 'sfx'); return; }
    if (type === 'jump') { playLuantiClip('default_grass_footstep.1', 0.24, 1.18, 1.32, 160, 'jmp', 'sfx'); return; }
    if (type === 'pickup') { if (!playLuantiClip('default_item_smoke', 0.28, 1.35, 1.55, 50, 'pk', 'sfx')) playSoftFallback(580, 920, 0.08, 0.07); return; }
    if (type === 'craft') { playLuantiClip('default_place_node_hard.1', 0.48, 1.15, 1.25, 0, '', 'sfx'); return; }
    if (type === 'hurt') {
      if (!playLuantiClip(['player_damage_alt', 'mobs_punch'], 0.38, 0.92, 1.06, 240, 'p_hurt', 'sfx')) playSoftFallback(150, 72, 0.13, 0.10);
      return;
    }
    if (type === 'crit') { playLuantiClip('mobs_punch', 0.46, 1.12, 1.26, 120, 'crit', 'sfx'); return; }
    if (type === 'eat') { playLuantiClip('default_dig_crumbly', 0.36, 1.15, 1.35, 120, 'eat', 'sfx'); return; }
    if (type === 'splash') { playLuantiClip(['default_water_footstep.1', 'default_water_footstep.2'], 0.46, 0.85, 1.05, 180, 'spl', 'sfx'); return; }
    if (type === 'burn') { playLuantiClip(['default_cool_lava.1', 'fire_flint_and_steel'], 0.25, 0.90, 1.10, 350, 'brn', 'sfx'); return; }
    if (type === 'bow_draw') { playBowDrawSfx(); return; }
    if (type === 'bow_full') { playBowFullSfx(); return; }
    if (type === 'bow') { playBowReleaseSfx(); return; }
    if (type === 'warp') { playLuantiClip('mobs_spell', 0.34, 0.95, 1.12, 220, 'wrp', 'sfx'); return; }
    if (type === 'equip') { playLuantiClip('default_place_node_metal.1', 0.40, 1.02, 1.15, 100, 'eq', 'sfx'); return; }
    if (type === 'roar') { playLuantiClip('mobs_stonemonster', 0.30, 0.55, 0.72, 850, 'roar', 'mob'); return; }
  }

  if (typeof document !== 'undefined') {
    const _uiSoundSel = 'button, .seg-btn, .mc-btn, .mc-java-btn, .mc-bedrock-btn, .spawn-btn, .lobby-tab, .gm-tab, .ore-side-item, .df-btn, .ore-back-btn, .ore-dialog-close, #btnDragonMount, .hb-slot';
    let _lastHoverBtn = null;
    document.addEventListener('pointerover', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(_uiSoundSel) : null;
      if (!btn || btn === _lastHoverBtn) return;
      _lastHoverBtn = btn;
      if (btn.disabled || btn.closest('.admin-locked')) return;
      playUiHoverSfx();
    }, true);
    document.addEventListener('pointerout', (e) => {
      if (_lastHoverBtn && e.target && e.target.closest && e.target.closest(_uiSoundSel) === _lastHoverBtn) {
        if (!e.relatedTarget || !e.relatedTarget.closest || e.relatedTarget.closest(_uiSoundSel) !== _lastHoverBtn) _lastHoverBtn = null;
      }
    }, true);
    document.addEventListener('pointerdown', (e) => {
      ensureAudio();
      const btn = e.target && e.target.closest ? e.target.closest(_uiSoundSel) : null;
      if (!btn || btn.disabled || btn.classList.contains('hb-slot') || btn.closest('.admin-locked')) return;
      playUiClickSfx();
    }, true);
  }

