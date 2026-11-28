// NUCRAFT Module: src/entities/Mob.js — GLB parser, lazy model fetcher, 118+ mobs, dragons, combat & projectiles

  /* ============================================================================
   * 8. BUILT-IN GLTF 2.0 BINARY (.GLB) PARSER + BLENDER MONSTER TEMPLATES + COMBAT + PROJECTILES + TNT
   * ============================================================================ */
  function parseGLB(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Invalid GLB magic');
    let off = 12, json = null, binStart = 0;
    while (off < arrayBuffer.byteLength) {
      const cLen = dv.getUint32(off, true);
      const cType = dv.getUint32(off + 4, true);
      const cDataOff = off + 8;
      if (cType === 0x4E4F534A) {
        const bytes = new Uint8Array(arrayBuffer, cDataOff, cLen);
        json = JSON.parse(new TextDecoder().decode(bytes));
      } else if (cType === 0x004E4942) {
        binStart = cDataOff;
      }
      off = cDataOff + cLen;
    }
    const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const COMP_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    const NUM_COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const readAccessor = (accIdx) => {
      const acc = json.accessors[accIdx];
      const bv = json.bufferViews[acc.bufferView];
      const Arr = COMP[acc.componentType];
      const cSize = COMP_SIZE[acc.componentType];
      const nComp = NUM_COMP[acc.type];
      const count = acc.count;
      const start = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const stride = bv.byteStride || (cSize * nComp);
      const out = new Arr(count * nComp);
      if (stride === cSize * nComp) {
        const view = new Arr(arrayBuffer, start, count * nComp);
        out.set(view);
      } else {
        for (let i = 0; i < count; i++) {
          const itemView = new Arr(arrayBuffer, start + i * stride, nComp);
          out.set(itemView, i * nComp);
        }
      }
      return { array: out, itemSize: nComp, normalized: !!acc.normalized };
    };

    // Decode embedded glTF 2.0 PNG palette textures (resolve _texReady so variant canvas recolors never race!)
    const imgCache = new Map();
    const texPromises = [];
    const getGlbImageTex = (imgIdx) => {
      if (imgCache.has(imgIdx)) return imgCache.get(imgIdx);
      const imgDef = (json.images || [])[imgIdx];
      if (!imgDef || imgDef.bufferView === undefined) return null;
      const bv = json.bufferViews[imgDef.bufferView];
      const bytes = new Uint8Array(arrayBuffer, binStart + (bv.byteOffset || 0), bv.byteLength);
      const blob = new Blob([bytes], { type: imgDef.mimeType || 'image/png' });
      const url = URL.createObjectURL(blob);
      const tex = new THREE.Texture();
      tex.flipY = false;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      const img = new Image();
      tex.image = img;
      texPromises.push(new Promise((res) => {
        img.onload = () => {
          tex.image = img;
          tex.needsUpdate = true;
          URL.revokeObjectURL(url);
          res();
        };
        img.onerror = () => { URL.revokeObjectURL(url); res(); };
      }));
      img.src = url;
      imgCache.set(imgIdx, tex);
      return tex;
    };
    const glbTextures = (json.textures || []).map((t) => (t && t.source !== undefined) ? getGlbImageTex(t.source) : null);

    const materials = (json.materials || []).map((m) => {
      const pbr = m.pbrMetallicRoughness || {};
      const bc = pbr.baseColorFactor || [1, 1, 1, 1];
      const ef = m.emissiveFactor || [0, 0, 0];
      const eStr = (m.extensions && m.extensions.KHR_materials_emissive_strength && m.extensions.KHR_materials_emissive_strength.emissiveStrength) || 1.0;
      const toSRGB = (v) => Math.pow(Math.max(0, v), 1 / 2.2);
      const baseTex = (pbr.baseColorTexture !== undefined) ? glbTextures[pbr.baseColorTexture.index] : null;
      const emitTex = (m.emissiveTexture !== undefined) ? glbTextures[m.emissiveTexture.index] : null;
      const mat = new THREE.MeshStandardMaterial({
        name: m.name || '',
        color: baseTex ? new THREE.Color(1, 1, 1) : new THREE.Color(toSRGB(bc[0]), toSRGB(bc[1]), toSRGB(bc[2])),
        map: baseTex || null,
        roughness: pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 0.75,
        metalness: pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0.0,
        transparent: (m.alphaMode === 'BLEND' || (bc[3] !== undefined && bc[3] < 0.99)),
        opacity: bc[3] !== undefined ? bc[3] : 1.0,
        emissive: new THREE.Color(toSRGB(ef[0]), toSRGB(ef[1]), toSRGB(ef[2])),
        emissiveMap: emitTex || null,
        emissiveIntensity: (ef[0] + ef[1] + ef[2]) > 0.01 ? Math.min(2.2, eStr) : 0.0,
        side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide
      });
      mat.userData.baseEmissive = mat.emissive.clone();
      mat.userData.baseEmissiveInt = mat.emissiveIntensity;
      mat.userData.sharedMat = true;
      return mat;
    });

    const skinMatCache = new Map();
    const getSkinMat = (baseMat) => {
      if (skinMatCache.has(baseMat)) return skinMatCache.get(baseMat);
      const sm = baseMat.clone();
      sm.skinning = true;
      sm.userData = {
        sharedMat: true,
        baseEmissive: baseMat.userData.baseEmissive ? baseMat.userData.baseEmissive.clone() : baseMat.emissive.clone(),
        baseEmissiveInt: baseMat.userData.baseEmissiveInt !== undefined ? baseMat.userData.baseEmissiveInt : baseMat.emissiveIntensity
      };
      skinMatCache.set(baseMat, sm);
      return sm;
    };

    const meshPrims = (json.meshes || []).map((meshDef) => (meshDef.primitives || []).map((prim) => {
      const geo = new THREE.BufferGeometry();
      if (prim.attributes.POSITION !== undefined) {
        const d = readAccessor(prim.attributes.POSITION);
        geo.setAttribute('position', new THREE.BufferAttribute(d.array, 3));
      }
      if (prim.attributes.NORMAL !== undefined) {
        const d = readAccessor(prim.attributes.NORMAL);
        geo.setAttribute('normal', new THREE.BufferAttribute(d.array, 3));
      } else geo.computeVertexNormals();
      if (prim.attributes.TEXCOORD_0 !== undefined) {
        const d = readAccessor(prim.attributes.TEXCOORD_0);
        geo.setAttribute('uv', new THREE.BufferAttribute(d.array, 2));
      }
      if (prim.attributes.COLOR_0 !== undefined) {
        const d = readAccessor(prim.attributes.COLOR_0);
        const norm = d.normalized || (d.array instanceof Uint8Array || d.array instanceof Uint16Array);
        geo.setAttribute('color', new THREE.BufferAttribute(d.array, d.itemSize, norm));
      }
      if (prim.attributes.JOINTS_0 !== undefined) {
        const d = readAccessor(prim.attributes.JOINTS_0);
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(d.array, 4));
      }
      if (prim.attributes.WEIGHTS_0 !== undefined) {
        const d = readAccessor(prim.attributes.WEIGHTS_0);
        geo.setAttribute('skinWeight', new THREE.BufferAttribute(d.array, 4, !!d.normalized));
      }
      if (prim.indices !== undefined) {
        const d = readAccessor(prim.indices);
        geo.setIndex(new THREE.BufferAttribute(d.array, 1));
      }
      const mat = prim.material !== undefined ? materials[prim.material] : new THREE.MeshStandardMaterial({ color: 0xffffff });
      if (!mat.map && geo.attributes.color) mat.vertexColors = true;
      if (!mat.userData.baseEmissive) { mat.userData.baseEmissive = mat.emissive.clone(); mat.userData.baseEmissiveInt = mat.emissiveIntensity; }
      mat.userData.sharedMat = true;
      const isGlow = (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.5;
      return { geo, mat, isGlow };
    }));

    const jointNodes = new Set();
    const jointNames = new Set();
    for (const sk of (json.skins || [])) {
      for (const ji of (sk.joints || [])) {
        jointNodes.add(ji);
        if (json.nodes[ji] && json.nodes[ji].name) jointNames.add(json.nodes[ji].name);
      }
    }

    const nodeObjs = new Array((json.nodes || []).length);
    const pendingSkins = [];
    const buildNode = (nodeIdx) => {
      const n = json.nodes[nodeIdx];
      const isBone = jointNodes.has(nodeIdx);
      const grp = isBone ? new THREE.Bone() : new THREE.Group();
      grp.name = (!isBone && n.name && jointNames.has(n.name)) ? (n.name + '__mesh') : (n.name || '');
      nodeObjs[nodeIdx] = grp;
      if (n.translation) grp.position.set(n.translation[0], n.translation[1], n.translation[2]);
      if (n.rotation) grp.quaternion.set(n.rotation[0], n.rotation[1], n.rotation[2], n.rotation[3]);
      if (n.scale) grp.scale.set(n.scale[0], n.scale[1], n.scale[2]);
      if (n.mesh !== undefined && meshPrims[n.mesh]) {
        const useSkin = (n.skin !== undefined);
        for (const pr of meshPrims[n.mesh]) {
          let m;
          if (useSkin && pr.geo.attributes.skinIndex) {
            m = new THREE.SkinnedMesh(pr.geo, getSkinMat(pr.mat));
            m.frustumCulled = false;
            pendingSkins.push({ mesh: m, skinIdx: n.skin });
          } else {
            m = new THREE.Mesh(pr.geo, pr.mat);
          }
        m.castShadow = !pr.isGlow;
        m.receiveShadow = !pr.isGlow;
        if (!pr.isGlow && m.material) m.material.shadowSide = THREE.FrontSide;
          grp.add(m);
        }
      }
      if (n.children) for (const ci of n.children) grp.add(buildNode(ci));
      return grp;
    };

    const rootScene = json.scenes[json.scene || 0];
    const sceneGroup = new THREE.Group();
    for (const ni of (rootScene.nodes || [])) sceneGroup.add(buildNode(ni));

    if (pendingSkins.length > 0 && Array.isArray(json.skins)) {
      sceneGroup.updateMatrixWorld(true);
      const skelCache = new Map();
      for (const { mesh, skinIdx } of pendingSkins) {
        let skel = skelCache.get(skinIdx);
        if (!skel) {
          const sdef = json.skins[skinIdx];
          const bones = sdef.joints.map((ji) => nodeObjs[ji]);
          const inverses = [];
          if (sdef.inverseBindMatrices !== undefined) {
            const ibm = readAccessor(sdef.inverseBindMatrices).array;
            for (let bi = 0; bi < bones.length; bi++) {
              inverses.push(new THREE.Matrix4().fromArray(ibm, bi * 16));
            }
          }
          skel = new THREE.Skeleton(bones, inverses.length ? inverses : undefined);
          skelCache.set(skinIdx, skel);
        }
        mesh.bind(skel, new THREE.Matrix4());
      }
      sceneGroup.userData.hasSkinnedMesh = true;
    }

    const clips = [];
    if (Array.isArray(json.animations)) {
      const accOutCache = new Map();
      const getAccArr = (idx) => {
        if (!accOutCache.has(idx)) accOutCache.set(idx, readAccessor(idx));
        return accOutCache.get(idx);
      };
      for (let ai = 0; ai < json.animations.length; ai++) {
        const animDef = json.animations[ai];
        const tracks = [];
        let maxDur = 0;
        let minStart = Infinity;
        const rawCh = [];
        for (const ch of (animDef.channels || [])) {
          if (!ch.target || ch.target.node === undefined) continue;
          const targetNode = nodeObjs[ch.target.node];
          if (!targetNode || !targetNode.name) continue;
          const path = ch.target.path;
          if (path !== 'translation' && path !== 'rotation' && path !== 'scale') continue;
          const samp = animDef.samplers[ch.sampler];
          const tAcc = getAccArr(samp.input);
          const vAcc = getAccArr(samp.output);
          if (tAcc.array.length > 0 && tAcc.array[0] < minStart) minStart = tAcc.array[0];
          rawCh.push({ name: targetNode.name, path, tArr: tAcc.array, vArr: vAcc.array, norm: vAcc.normalized });
        }
        const tShift = Number.isFinite(minStart) ? minStart : 0;
        for (const rc of rawCh) {
          const times = new Float32Array(rc.tArr.length);
          for (let k = 0; k < rc.tArr.length; k++) {
            const ts = Math.max(0, rc.tArr[k] - tShift);
            times[k] = ts;
            if (ts > maxDur) maxDur = ts;
          }
          let vals = rc.vArr;
          if (rc.norm) {
            const div = (vals instanceof Int8Array) ? 127 : (vals instanceof Uint8Array ? 255 : (vals instanceof Int16Array ? 32767 : 65535));
            const fVals = new Float32Array(vals.length);
            for (let k = 0; k < vals.length; k++) fVals[k] = vals[k] / div;
            vals = fVals;
          } else if (!(vals instanceof Float32Array)) {
            vals = new Float32Array(vals);
          }
          let trk = null;
          if (rc.path === 'translation') trk = new THREE.VectorKeyframeTrack(`${rc.name}.position`, times, vals);
          else if (rc.path === 'rotation') trk = new THREE.QuaternionKeyframeTrack(`${rc.name}.quaternion`, times, vals);
          else if (rc.path === 'scale') trk = new THREE.VectorKeyframeTrack(`${rc.name}.scale`, times, vals);
          if (trk) tracks.push(trk);
        }
        if (tracks.length > 0) clips.push(new THREE.AnimationClip(animDef.name || `clip_${ai}`, maxDur > 0 ? maxDur : -1, tracks));
      }
    }
    sceneGroup.userData.animations = clips;
    sceneGroup.userData._texReady = texPromises.length ? Promise.all(texPromises) : Promise.resolve();
    return sceneGroup;
  }

  const blenderMobTemplates = new Map();
  // Lazy on-demand GLB decoding: uses binary assets/models/*.glb on web (0MB startup) or embedded bundle on standalone Mobile HTML
  let _glbFetchCount = 0;
  const _glbFetching = new Map();
  const _glbRetryCount = new Map();
  const DRAGON_SHARED_GLB = 'dragon_wyvern';
  const _END_FIERCE_DRAGONS = new Set(['void_end_dragon', 'amethyst_end_dragon', 'storm_end_dragon', 'abyss_end_dragon']);
  const _MOB_BASE_GLB = {
    charged_creeper: 'creeper', icy_creeper: 'creeper', potato_creeper: 'creeper',
    nerd_creeper: 'creeper', ghost_creeper: 'creeper',
    zombified_piglin: 'piglin', zombie_horse: 'horse',
    cluckshroom: 'chicken', wooly_cow: 'cow', spider_jockey: 'spider'
  };
  const _resolveGlbKey = (type) => (IS_DRAGON_MOB.has(type) || type === 'baby_dragon') ? DRAGON_SHARED_GLB : (_MOB_BASE_GLB[type] || type);
  const _hasGlbAsset = (type) => {
    const key = _resolveGlbKey(type);
    return (window.BLENDER_MOB_GLBS && (!!window.BLENDER_MOB_GLBS[key] || !!window.BLENDER_MOB_GLBS[type]))
      || (Array.isArray(window.__NUCRAFT_MOB_KEYS__) && (window.__NUCRAFT_MOB_KEYS__.includes(key) || window.__NUCRAFT_MOB_KEYS__.includes(type)));
  };

  function _disposeMobAnim(m) {
    if (m && m.anim && m.anim.mixer) {
      m.anim.mixer.stopAllAction();
      m.anim.mixer.uncacheRoot(m.anim.armRoot || m.group);
      m.anim.mixer = null;
    }
  }

  function hotSwapMobMesh(m) {
    if (!m || m._dead || (m.fromBlender && !m.isPlaceholder)) return;
    if (m.elemDragon && m.tamed) { rebuildDragonStageMesh(m); return; }
    const sp = (typeof ANIMAL_MAP !== 'undefined') ? ANIMAL_MAP.get(m.type) : null;
    const swapOpts = m.elemDragon
      ? { dragonStage: m.dragonStage !== undefined ? m.dragonStage : 4, saddled: !!m.saddled }
      : (m.woolColor ? { woolSpec: WOOL_COLORS.find(w => w.key === m.woolColor) || null }
        : (m.villagerProf ? { profIdx: m.villagerProf.idx } : null));
    const built = sp ? buildAnimalSpeciesMesh(sp) : buildMobMesh(m.type, m.x, m.z, m.elemDragon ? Object.assign({}, swapOpts, { dragonArmor: m.dragonArmor || null }) : swapOpts);
    if (!built || !built.fromBlender || built.isPlaceholder || !built.group) return;
    _disposeMobAnim(m);
    scene.remove(m.group);
    if (m.hpBar && m.hpBar.sp) built.group.add(m.hpBar.sp);
    if (m.petTag) built.group.add(m.petTag);
    for (let i = 0; i < m.parts.length; i++) {
      const mat = m.parts[i].material;
      if (mat && !(mat.userData && mat.userData.sharedMat)) mat.dispose();
      if (!m.fromBlender && m.parts[i].userData && !m.parts[i].userData.sharedGeo && m.parts[i].geometry) m.parts[i].geometry.dispose();
    }
    m.group = built.group;
    m.parts = built.parts;
    m.flameGroup = built.flameGroup;
    m.anim = built.anim;
    m.fromBlender = true;
    m.isPlaceholder = false;
    m.pendingGlbKey = null;
    m.glbKey = built.glbKey || m.type;
    m.baseScale = built.group.scale.x || 1;
    if (IS_DRAGON_MOB.has(m.type)) {
      m.dragonScale = built.group.userData.dragonScale || m.baseScale || 4.6;
      const hb = _calcDragonHitbox(m.dragonScale);
      m.hitboxR = hb.r; m.hitboxH = hb.h;
      _syncDragonOverlayMetrics(m);
    }
    m.group.position.set(m.x, m.y, m.z);
    m.group.rotation.y = m.yaw || 0;
    scene.add(m.group);
  }
  function hotSwapMobMeshesForType(type) {
    const key = _resolveGlbKey(type);
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m || m._dead || (m.fromBlender && !m.isPlaceholder)) continue;
      if (m.type === type || _resolveGlbKey(m.type) === key || m.pendingGlbKey === key || m.pendingGlbKey === type) {
        hotSwapMobMesh(m);
      }
    }
  }
  function preloadMobGlb(type) {
    if (!type) return Promise.resolve(null);
    const key = _resolveGlbKey(type);
    if (blenderMobTemplates.has(key)) return Promise.resolve(blenderMobTemplates.get(key));
    if (window.BLENDER_MOB_GLBS && (window.BLENDER_MOB_GLBS[key] || window.BLENDER_MOB_GLBS[type])) return Promise.resolve(getBlenderMobTemplate(type));
    if (!(location.protocol === 'http:' || location.protocol === 'https:') || !_hasGlbAsset(key)) return Promise.resolve(null);
    if (_glbFetching.has(key)) return _glbFetching.get(key);
    const p = fetch('assets/models/' + encodeURIComponent(key) + '.glb')
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => {
        _glbFetchCount++;
        const tpl = parseGLB(ab);
        return Promise.resolve(tpl.userData && tpl.userData._texReady).then(() => {
          _glbRetryCount.delete(key);
          blenderMobTemplates.set(key, tpl);
          hotSwapMobMeshesForType(key);
          if (typeof drawDragonPreview === 'function' && typeof _dragonPrevRig !== 'undefined' && _dragonPrevRig && _dragonPrevRig.isPlaceholder) {
            drawDragonPreview();
          }
          return tpl;
        });
      })
      .catch((err) => {
        console.warn('Failed to fetch Blender GLB', key, err);
        const tries = (_glbRetryCount.get(key) || 0) + 1;
        if (tries <= 3) {
          _glbRetryCount.set(key, tries);
          setTimeout(() => {
            if (blenderMobTemplates.has(key)) return;
            const stillNeeded = mobs.some((mb) => mb && !mb._dead && (!mb.fromBlender || mb.isPlaceholder) && (mb.pendingGlbKey === key || _resolveGlbKey(mb.type) === key));
            if (stillNeeded) preloadMobGlb(key);
          }, tries * 1500);
        }
        return null;
      })
      .finally(() => { _glbFetching.delete(key); });
    _glbFetching.set(key, p);
    return p;
  }
  function preloadAllDragonGlbs() {
    return preloadMobGlb(DRAGON_SHARED_GLB);
  }
  let _coreGlbsPreloaded = false;
  function preloadCoreMobGlbs() {
    if (_coreGlbsPreloaded || window.BLENDER_MOB_GLBS) return;
    if (!(location.protocol === 'http:' || location.protocol === 'https:')) return;
    _coreGlbsPreloaded = true;
    const keys = ['pig', 'cow', 'sheep', 'wolf', 'creeper', 'spider', 'enderman', 'iron_golem', DRAGON_SHARED_GLB, 'sculk_stalker', 'sculk_brute', 'sculk_sentinel', 'sculk_soul_ravager'];
    let idx = 0;
    const scheduleIdle = (typeof requestIdleCallback === 'function')
      ? (cb) => requestIdleCallback(cb, { timeout: 500 })
      : (cb) => setTimeout(cb, 260);
    const step = () => {
      if (typeof isWorldLoading !== 'undefined' && isWorldLoading) {
        setTimeout(step, 400);
        return;
      }
      if (idx < keys.length) preloadMobGlb(keys[idx++]);
      if (idx < keys.length) scheduleIdle(step);
    };
    scheduleIdle(step);
  }
  function getBlenderMobTemplate(type) {
    const key = _resolveGlbKey(type);
    if (blenderMobTemplates.has(key)) return blenderMobTemplates.get(key);
    if (!window.BLENDER_MOB_GLBS || (!window.BLENDER_MOB_GLBS[key] && !window.BLENDER_MOB_GLBS[type])) {
      if (_hasGlbAsset(key)) preloadMobGlb(key);
      return null;
    }
    try {
      const b64 = window.BLENDER_MOB_GLBS[key] || window.BLENDER_MOB_GLBS[type];
      const binStr = atob(b64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      const tpl = parseGLB(bytes.buffer);
      blenderMobTemplates.set(key, tpl);
      if (typeof sodiumOpts !== 'undefined' && sodiumOpts.ferriteRam) {
        delete window.BLENDER_MOB_GLBS[key];
        delete window.BLENDER_MOB_GLBS[type];
      }
      return tpl;
    } catch (err) {
      console.warn('Failed to parse Blender GLB', key, err);
      return null;
    }
  }

  function makeMobHpBar() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 10;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    sp.scale.set(1.05, 0.17, 1); sp.visible = false;
    return { sp, ctx, tex };
  }
  function _calcDragonHitbox(sc) {
    const s = Math.max(0.28, sc || 1);
    return {
      r: Math.max(0.55, +(1.05 * s).toFixed(2)),
      h: Math.max(0.75, +(1.85 * s).toFixed(2))
    };
  }
  function _getDragonGroundSurfaceY(wx, refY, wz, sc = 1.0) {
    const startY = Math.min(MAX_Y - 1, Math.max(1, Math.floor((typeof refY === 'number' ? refY : MAX_Y - 2) + 2.2)));
    const off = Math.min(2.2, Math.max(0.4, (sc || 1) * 0.42));
    const pts = [[wx, wz], [wx + off, wz], [wx - off, wz], [wx, wz + off], [wx, wz - off]];
    let bestY = WATER_LEVEL + 1;
    let found = false;
    for (let pi = 0; pi < 5; pi++) {
      const ix = Math.floor(pts[pi][0]), iz = Math.floor(pts[pi][1]);
      for (let y = startY; y >= MIN_Y + 1; y--) {
        const b = getBlockWorld(ix, y, iz), d = BLOCK_DEF[b];
        if (b !== B.AIR && b !== B.WATER && b !== B.LAVA && d && d.solid && !(d.foliage || d.isLog || d.cross || d.hangingFruit)) {
          if (!found || y + 1 > bestY) { bestY = y + 1; found = true; }
          break;
        }
      }
    }
    return bestY;
  }
  function _getSafeDragonSkyY(wx, wz, clearance = 14) {
    const pts = [[wx, wz], [wx + 3, wz], [wx - 3, wz], [wx, wz + 3], [wx, wz - 3]];
    let maxTop = WATER_LEVEL + 2;
    for (let pi = 0; pi < 5; pi++) {
      const ix = Math.floor(pts[pi][0]), iz = Math.floor(pts[pi][1]);
      const cTop = (typeof getCanopyTopY === 'function') ? getCanopyTopY(ix, iz) : WATER_LEVEL;
      const tTop = getTerrainHeight(ix, iz, getBiomeAt(ix, iz));
      if (cTop > maxTop) maxTop = cTop;
      if (tTop > maxTop) maxTop = tTop;
    }
    let y = Math.min(MAX_Y - 6, maxTop + clearance);
    const fx = Math.floor(wx), fz = Math.floor(wz);
    while (y < MAX_Y - 6 && (isSolidAt(fx, Math.floor(y), fz) || isSolidAt(fx, Math.floor(y + 1), fz))) y += 2;
    return Math.min(MAX_Y - 6, y);
  }
  function _syncDragonOverlayMetrics(m) {
    if (!m) return;
    const sc = Math.max(0.30, m.dragonScale || m.baseScale || 1);
    const inv = 1 / sc;
    const tagWorld = Math.min(2.2, Math.max(0.75, 0.72 + sc * 0.28));
    const rel = tagWorld * inv;
    if (m.petTag) {
      m.petTag.scale.set(1.55 * rel, 0.30 * rel, 1);
      m.petTag.position.set(0, ((m.hitboxH || 1.2) + 0.55) * inv, 0);
    }
    if (m.hpBar && m.hpBar.sp) {
      m.hpBar.sp.scale.set(1.05 * rel, 0.17 * rel, 1);
      m.hpBar.sp.position.set(0, ((m.hitboxH || 1.2) + 0.32) * inv, 0);
    }
  }
  function updateMobHpBar(m, pct) {
    if (!m || m.isBoss) return;
    if (!m.hpBar) {
      m.hpBar = makeMobHpBar();
      m.hpBar.sp.position.set(0, (m.hitboxH || 1.6) + 0.42, 0);
      m.group.add(m.hpBar.sp);
      if (IS_DRAGON_MOB.has(m.type)) _syncDragonOverlayMetrics(m);
    }
    const { ctx, tex, sp } = m.hpBar;
    ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 64, 10);
    ctx.fillStyle = '#3f3f46'; ctx.fillRect(2, 2, 60, 6);
    const w = Math.max(0, Math.round(60 * Math.max(0, Math.min(1, pct))));
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#facc15' : '#ef4444');
    ctx.fillRect(2, 2, w, 6);
    tex.needsUpdate = true;
    sp.visible = true;
  }

  const mobs = [];
  function isExposedToSky(wx, wy, wz) {
    const ix = Math.floor(wx), iz = Math.floor(wz);
    for (let y = Math.floor(wy) + 1; y <= MAX_Y; y++) { const b = getBlockWorld(ix, y, iz); if (b !== B.AIR && b !== B.WATER && !(BLOCK_DEF[b] && BLOCK_DEF[b].cross)) return false; }
    return true;
  }

  const DRAGON_COLOR_PALETTES = {
    fire_dragon: null, // Uses native crimson RLCraft Dragon_Atlas & glowing #FFA818 eyes
    ice_dragon: {
      body: [0x5282aa, 0x7cb4dc, 0xa6d2f2, 0xc8e8ff],
      belly: [0x8baac4, 0xdcecf8, 0xf2faff],
      dark: [0x345068, 0x527490],
      under: [0x182838, 0x263c50],
      mem: [0x3e5c72, 0x5a7b94, 0x7298b4],
      horn: [0xcbe2f4, 0xe6f4ff, 0x7b9ab4, 0x384d62],
      eye: 0x38bdf8
    },
    water_dragon: {
      body: [0x22468a, 0x3564c0, 0x5488ec, 0x7ab0ff],
      belly: [0x5678a4, 0x9cbce4, 0xc4dcf6],
      dark: [0x1c3266, 0x2d4e94],
      under: [0x142248, 0x1e3468],
      mem: [0x224284, 0x3660b4, 0x4c7cd4],
      horn: [0xb8cae0, 0xdae6f2, 0x586a84, 0x1e2c4a],
      eye: 0x818cf8
    },
    earth_dragon: {
      body: [0x583c0e, 0x8a641e, 0xc0902e, 0xdeb042],
      belly: [0x705d3c, 0xc2ae88, 0xdcd0b0],
      dark: [0x4c3410, 0x6c4e18],
      under: [0x2e200a, 0x422e10],
      mem: [0x50380e, 0x725218, 0x8e6a22],
      horn: [0xc2b6a0, 0xdbd2c0, 0x6e6658, 0x2a231b],
      eye: 0xfbbf24
    },
    leaf_dragon: {
      body: [0x1a4c14, 0x2c7222, 0x4aa438, 0x62c24e],
      belly: [0x627a54, 0xb2cca0, 0xcfe4be],
      dark: [0x1d4a18, 0x306e28],
      under: [0x143212, 0x1e481a],
      mem: [0x1a481a, 0x2c6c2a, 0x3e8c3a],
      horn: [0xbeb8a8, 0xd8d2c2, 0x6c6b62, 0x252920],
      eye: 0xfacc15
    },
    tree_dragon: {
      body: [0x22461a, 0x386a2a, 0x5a963e, 0x78b452],
      belly: [0x70664a, 0xc0b490, 0xdad0b2],
      dark: [0x382818, 0x543e26],
      under: [0x241910, 0x342416],
      mem: [0x244a1c, 0x3b6e2e, 0x528e3e],
      horn: [0xbcb09a, 0xd6ccb6, 0x6d6556, 0x2a2018],
      eye: 0xfde047
    },
    ender_dragon: {
      body: [0x12071d, 0x240f3a, 0x411b69, 0x6b2fa4],
      belly: [0x2a1244, 0x52257e, 0x8b4cc8],
      dark: [0x150822, 0x2c1248],
      under: [0x0c0416, 0x1a092c],
      mem: [0x1a0a2a, 0x3b1760, 0x622699],
      horn: [0x4c1d95, 0xa855f7, 0xd8b4fe, 0x2e1065],
      eye: 0xf0abfc
    },
    void_end_dragon: {
      body: [0x090414, 0x1a0b33, 0x361466, 0x5b21b6],
      belly: [0x1c0d36, 0x3b1764, 0x9333ea],
      dark: [0x07020e, 0x16072b],
      under: [0x040108, 0x0e041c],
      mem: [0x140626, 0x2e1065, 0x7e22ce],
      horn: [0x3b0764, 0xc084fc, 0xf3e8ff, 0x1e0634],
      eye: 0xe879f9
    },
    sovereign_end_dragon: {
      body: [0x070412, 0x140d33, 0x261a66, 0x4338ca],
      belly: [0x171036, 0x312e81, 0x38bdf8],
      dark: [0x05020c, 0x120a2e],
      under: [0x020108, 0x0a061c],
      mem: [0x0f0b2e, 0x1e1b4b, 0x7c3aed],
      horn: [0x1e1b4b, 0x38bdf8, 0xe0f2fe, 0x581c87],
      eye: 0x38bdf8
    },
    amethyst_end_dragon: {
      body: [0x2a0845, 0x581c87, 0x86198f, 0xc026d3],
      belly: [0x4c1d95, 0x7e22ce, 0xf0abfc],
      dark: [0x1e0634, 0x3b0764],
      under: [0x120320, 0x290548],
      mem: [0x3b0764, 0x701a75, 0xa21caf],
      horn: [0x86198f, 0xf0abfc, 0xfdf4ff, 0x4c1d95],
      eye: 0xf472b6
    },
    storm_end_dragon: {
      body: [0x0f172a, 0x1e1b4b, 0x3730a3, 0x6d28d9],
      belly: [0x1e293b, 0x312e81, 0x38bdf8],
      dark: [0x090d1a, 0x17153b],
      under: [0x04060e, 0x0e0c26],
      mem: [0x172554, 0x312e81, 0x0284c7],
      horn: [0x312e81, 0x38bdf8, 0xe0f2fe, 0x1e1b4b],
      eye: 0x22d3ee
    },
    abyss_end_dragon: {
      body: [0x1a0410, 0x3f0828, 0x701048, 0x9f1239],
      belly: [0x2e0820, 0x581c87, 0xf43f5e],
      dark: [0x12020b, 0x290418],
      under: [0x080105, 0x18020f],
      mem: [0x260516, 0x500724, 0x881337],
      horn: [0x500724, 0xfb7185, 0xffe4e6, 0x3b0764],
      eye: 0xfb7185
    }
  };
  DRAGON_COLOR_PALETTES.baby_dragon = DRAGON_COLOR_PALETTES.leaf_dragon;

  const _enderSpineMatCache = new Map();
  function _getEnderSpineMat(isSkinned) {
    const k = isSkinned ? '1' : '0';
    if (_enderSpineMatCache.has(k)) return _enderSpineMatCache.get(k);
    const m = new THREE.MeshStandardMaterial({
      color: 0xf5d0fe, emissive: 0xd946ef, emissiveIntensity: 2.8,
      roughness: 0.25, metalness: 0.15, skinning: !!isSkinned
    });
    m.userData = { sharedMat: true, baseEmissive: m.emissive.clone(), baseEmissiveInt: m.emissiveIntensity };
    _enderSpineMatCache.set(k, m);
    return m;
  }

  const _dragonVariantTexCache = new Map();
  const _dragonVariantMatCache = new Map();

  function _remapRgbStops(stops, t) {
    const u = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(u));
    const f = u - idx;
    const c0 = stops[idx], c1 = stops[idx + 1];
    const r0 = (c0 >> 16) & 255, g0 = (c0 >> 8) & 255, b0 = c0 & 255;
    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    return [Math.round(r0 + (r1 - r0) * f), Math.round(g0 + (g1 - g0) * f), Math.round(b0 + (b1 - b0) * f)];
  }

  function _getDragonVariantAtlas(type, baseTex) {
    const key = type === 'baby_dragon' ? 'leaf_dragon' : type;
    if (_dragonVariantTexCache.has(key)) return _dragonVariantTexCache.get(key);
    const pal = DRAGON_COLOR_PALETTES[key];
    if (!pal || !baseTex || !baseTex.image) return baseTex;
    const img = baseTex.image;
    const w = img.naturalWidth || img.width || 256;
    const h = img.naturalHeight || img.height || 256;
    if (w < 64 || h < 64) return baseTex;

    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    for (let cy = 0; cy < h; cy++) {
      const py = 255 - Math.round((cy / h) * 255);
      for (let cx = 0; cx < w; cx++) {
        const px = Math.round((cx / w) * 255);
        const off = (cy * w + cx) * 4;
        const l = lum(d[off], d[off + 1], d[off + 2]);
        let rgb = null;
        if (px < 128 && py < 128) {
          rgb = _remapRgbStops(pal.body, (l - 0.12) / 0.34);
        } else if (px >= 128 && py < 64) {
          rgb = _remapRgbStops(pal.belly, (l - 0.35) / 0.42);
        } else if (px >= 128 && px < 192 && py >= 64 && py < 128) {
          rgb = _remapRgbStops(pal.dark, (l - 0.08) / 0.16);
        } else if (px >= 192 && py >= 64 && py < 128) {
          rgb = _remapRgbStops(pal.under, (l - 0.04) / 0.08);
        } else if (px < 128 && py >= 128) {
          rgb = _remapRgbStops(pal.mem, (l - 0.14) / 0.36);
        } else if (px >= 128 && py >= 128 && py <= 153) {
          rgb = _remapRgbStops([pal.horn[0], pal.horn[1]], (l - 0.65) / 0.22);
        } else if (px >= 128 && py >= 154 && py <= 170) {
          rgb = _remapRgbStops([pal.horn[2], pal.horn[0]], (l - 0.40) / 0.22);
        } else if (px >= 128 && py >= 171 && py < 192) {
          rgb = _remapRgbStops([pal.horn[3], pal.horn[2]], (l - 0.10) / 0.18);
        }
        if (rgb) {
          d[off] = rgb[0]; d[off + 1] = rgb[1]; d[off + 2] = rgb[2];
        }
      }
    }
    ctx.putImageData(id, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _dragonVariantTexCache.set(key, tex);
    return tex;
  }

  function _getDragonVariantMat(type, origMat, isSkinned) {
    const vKey = type === 'baby_dragon' ? 'leaf_dragon' : type;
    const matName = origMat.name || '';
    const cacheKey = `${vKey}_${matName}_${isSkinned ? 1 : 0}`;
    if (_dragonVariantMatCache.has(cacheKey)) return _dragonVariantMatCache.get(cacheKey);
    const pal = DRAGON_COLOR_PALETTES[vKey] || null;
    const m = origMat.clone();
    m.skinning = !!isSkinned;
    if (pal) {
      if (matName === 'Eye_Orange') {
        m.color.setHex(pal.eye);
        m.emissive.setHex(pal.eye);
      } else if (m.map) {
        m.map = _getDragonVariantAtlas(vKey, m.map);
      }
    }
    const isMembrane = matName.indexOf('Membrane') !== -1;
    if (isMembrane) m.side = THREE.DoubleSide;
    if (matName !== 'Eye_Orange' && m.map) {
      // Lift shadowed sky undersides slightly while preserving atlas detail
      m.emissive.setHex(0xffffff);
      m.emissiveMap = m.map;
      m.emissiveIntensity = isMembrane ? 0.30 : 0.26;
      m.needsUpdate = true;
    } else if (matName === 'Dragon_Saddle') {
      m.emissive.setHex(0x2a180c);
      m.emissiveIntensity = 0.18;
    }
    m.userData = {
      sharedMat: true,
      baseEmissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
      baseEmissiveInt: m.emissiveIntensity !== undefined ? m.emissiveIntensity : 0
    };
    _dragonVariantMatCache.set(cacheKey, m);
    return m;
  }

  const _dragonArmorTexCache = new Map();
  const _dragonArmorMatCache = new Map();
  const DRAGON_ARMOR_PALETTES = {
    gold: {
      primary: [0x8A6314, 0xC8961E, 0xF5D042, 0xFFF3A8],
      trim:    [0x6E4D0E, 0xA87B18, 0xD8AA2C, 0xF5D042],
      cushion: [0x320A0A, 0x5A1616, 0x8A2828, 0xF5D042],
      rivet:   [0xA87B18, 0xFFF3A8]
    },
    diamond: {
      primary: [0x14828E, 0x26C2D4, 0x62ECFA, 0xC6FCFF],
      trim:    [0x0E5E68, 0x1A96A6, 0x3FD2E4, 0x90F4FF],
      cushion: [0x101C3E, 0x1E346C, 0x3A58A2, 0x80F2FF],
      rivet:   [0x1A96A6, 0xC6FCFF]
    }
  };
  const DRAGON_ARMOR_SLOTS = ['head', 'neck', 'body', 'tail'];
  const DRAGON_ARMOR_DEF_PTS = {
    iron:    { head: 2, neck: 2, body: 4, tail: 2 },
    gold:    { head: 3, neck: 3, body: 5, tail: 3 },
    diamond: { head: 4, neck: 4, body: 8, tail: 4 }
  };
  function calcDragonArmorPts(m) {
    if (!m || !m.dragonArmor) return 0;
    let pts = 0;
    for (let i = 0; i < DRAGON_ARMOR_SLOTS.length; i++) {
      const sk = DRAGON_ARMOR_SLOTS[i], tier = m.dragonArmor[sk];
      if (tier && DRAGON_ARMOR_DEF_PTS[tier]) pts += DRAGON_ARMOR_DEF_PTS[tier][sk] || 0;
    }
    return pts;
  }

  function _getDragonArmorAtlas(tier, baseTex) {
    if (!tier || tier === 'iron' || !baseTex || !baseTex.image) return baseTex;
    const key = tier;
    if (_dragonArmorTexCache.has(key)) return _dragonArmorTexCache.get(key);
    const pal = DRAGON_ARMOR_PALETTES[tier];
    if (!pal) return baseTex;
    const img = baseTex.image;
    const w = img.width || 256, h = img.height || 256;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const halfX = (w >> 1), halfY = (h >> 1);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const off = (py * w + px) * 4;
        if (d[off + 3] === 0) continue;
        const l = (0.299 * d[off] + 0.587 * d[off + 1] + 0.114 * d[off + 2]) / 255;
        let rgb = null;
        if (py < halfY) {
          rgb = _remapRgbStops(px < halfX ? pal.primary : pal.trim, (l - 0.18) / 0.72);
        } else if (px < halfX) {
          rgb = _remapRgbStops(pal.cushion, (l - 0.14) / 0.62);
        } else if (l > 0.55) {
          rgb = _remapRgbStops(pal.rivet, (l - 0.55) / 0.38);
        }
        if (rgb) { d[off] = rgb[0]; d[off + 1] = rgb[1]; d[off + 2] = rgb[2]; }
      }
    }
    ctx.putImageData(id, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _dragonArmorTexCache.set(key, tex);
    return tex;
  }

  function _getDragonArmorMat(tier, origMat, isSkinned) {
    const tKey = (tier === 'gold' || tier === 'diamond') ? tier : 'iron';
    const matName = (origMat && origMat.name) || 'Armor';
    const cacheKey = `${tKey}_${matName}_${isSkinned ? 1 : 0}`;
    if (_dragonArmorMatCache.has(cacheKey)) return _dragonArmorMatCache.get(cacheKey);
    const m = origMat.clone();
    m.skinning = !!isSkinned;
    if (m.map) m.map = _getDragonArmorAtlas(tKey, m.map);
    if (m.metalness !== undefined) m.metalness = tKey === 'gold' ? 0.78 : (tKey === 'diamond' ? 0.62 : 0.72);
    if (m.roughness !== undefined) m.roughness = tKey === 'gold' ? 0.28 : (tKey === 'diamond' ? 0.22 : 0.34);
    if (m.map) {
      m.emissive.setHex(0xffffff);
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0.22;
      m.needsUpdate = true;
    }
    m.userData = {
      sharedMat: true,
      baseEmissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
      baseEmissiveInt: m.emissiveIntensity !== undefined ? m.emissiveIntensity : 0
    };
    _dragonArmorMatCache.set(cacheKey, m);
    return m;
  }

  function _applyDragonArmorToAnim(anim, dragonArmor, saddled) {
    if (!anim) return;
    if (anim.armorMeshes) {
      for (let i = 0; i < DRAGON_ARMOR_SLOTS.length; i++) {
        const sk = DRAGON_ARMOR_SLOTS[i];
        const tier = dragonArmor && dragonArmor[sk];
        const list = anim.armorMeshes[sk] || [];
        for (let j = 0; j < list.length; j++) {
          const entry = list[j];
          if (!entry || !entry.mesh) continue;
          if (tier) {
            entry.mesh.visible = true;
            entry.mesh.material = _getDragonArmorMat(tier, entry.origMat, !!entry.mesh.isSkinnedMesh);
          } else {
            entry.mesh.visible = false;
          }
        }
      }
    }
    if (anim.saddleGroup) {
      anim.saddleGroup.visible = !!(saddled && !(dragonArmor && dragonArmor.body));
    }
  }

  function instantiateBlenderMob(type) {
    const tpl = getBlenderMobTemplate(type);
    if (!tpl) return null;
    const isDragonType = IS_DRAGON_MOB.has(type) || type === 'baby_dragon';
    const isSkinnedDragon = isDragonType && !!(tpl.userData && tpl.userData.hasSkinnedMesh);
    const armRoot = tpl.clone(true);
    let g = armRoot;
    if (isSkinnedDragon) {
      const boneByName = new Map();
      armRoot.traverse((obj) => { if (obj.isBone) boneByName.set(obj.name, obj); });
      armRoot.updateMatrixWorld(true);
      armRoot.traverse((obj) => {
        if (obj.isSkinnedMesh && obj.skeleton) {
          const clonedBones = obj.skeleton.bones.map((b) => boneByName.get(b.name) || b);
          const clonedInverses = obj.skeleton.boneInverses.map((m4) => m4.clone());
          obj.bind(new THREE.Skeleton(clonedBones, clonedInverses), new THREE.Matrix4());
        }
      });
      g = new THREE.Group();
      armRoot.rotation.y = Math.PI * 0.5;
      g.add(armRoot);
    }
    const parts = [];
    const anim = {
      torso: null, neck1: null, head: null, jaw: null, core: null,
      legs: [], arms: [], wings: [], tail: null, tail2: null, tail3: null,
      saddleGroup: null, saddleSeat: null, armorMeshes: { head: [], neck: [], body: [], tail: [] },
      bodyBone: null, bodyCenter: null, bodyHalfExtents: null, headBone: null, jawBone: null, wingTipL: null, wingTipR: null,
      mixer: null, armRoot: null, actions: null, activeClip: ''
    };
    const wingMap = {};
    const foldedArmMob = (type === 'villager' || type === 'witch');
    const castSh = !_isMobilePerf || (MOB_STATS[type] && MOB_STATS[type].isBoss);
    armRoot.traverse((o) => {
      const clean = (o.name || '').replace(/\.\d+$/, '');
      const cl = clean.toLowerCase();
      if (isSkinnedDragon) {
        if (!o.isMesh && !o.isBone && cl === 'dragon_saddle_geo') {
          anim.saddleGroup = o;
          o.visible = false;
        }
        if (o.isMesh) {
          const origMat = o.material;
          const origMatName = (origMat && origMat.name) || '';
          const parentCl = (o.parent && o.parent.name ? o.parent.name.replace(/\.\d+$/, '').toLowerCase() : '');
          const nodeTag = cl || parentCl;
          const armorM = nodeTag.match(/^armor_(head|neck|body|tail)_geo$/);
          if (armorM) {
            const sk = armorM[1];
            anim.armorMeshes[sk].push({ mesh: o, origMat });
            o.material = _getDragonArmorMat('iron', origMat, !!o.isSkinnedMesh);
            o.visible = false;
            o.castShadow = castSh;
            o.receiveShadow = true;
            return;
          }
          const isEnderSpike = ((type === 'ender_dragon' || type === 'sovereign_end_dragon' || _END_FIERCE_DRAGONS.has(type)) && nodeTag.startsWith('spikes_'));
          let mat = isEnderSpike ? _getEnderSpineMat(!!o.isSkinnedMesh) : _getDragonVariantMat(type, origMat, !!o.isSkinnedMesh);
          if (!isEnderSpike && typeof sodiumOpts !== 'undefined' && !sodiumOpts.immFast) {
            mat = mat.clone();
            mat.userData = {
              sharedMat: false,
              baseEmissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
              baseEmissiveInt: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 0
            };
          }
          if (!mat.map && o.geometry && o.geometry.attributes && o.geometry.attributes.color) mat.vertexColors = true;
          o.material = mat;
          const isGlow = (origMatName === 'Eye_Orange') || isEnderSpike;
          o.castShadow = !isGlow && castSh;
          o.receiveShadow = !isGlow;
          if (!isGlow) parts.push(o);
          if ((cl === 'body_geo' || parentCl === 'body_geo') && !anim.bodyCenter && o.geometry) {
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const bb = o.geometry.boundingBox;
            if (bb) {
              const bc = new THREE.Object3D();
              bb.getCenter(bc.position);
              o.add(bc);
              anim.bodyCenter = bc;
              const sz = new THREE.Vector3();
              bb.getSize(sz);
              anim.bodyHalfExtents = sz.multiplyScalar(0.5);
            }
          }
          if (nodeTag === 'dragon_saddle_geo') {
            anim.saddleGroup = (o.parent && parentCl === 'dragon_saddle_geo') ? o.parent : o;
            anim.saddleGroup.visible = false;
          }
        } else if (o.isBone) {
          if (clean === 'Body') anim.bodyBone = o;
          else if (clean === 'Head') anim.headBone = o;
          else if (clean === 'Jaw') anim.jawBone = o;
          else if (clean === 'Wing_Near_Finger_01') anim.wingTipL = o;
          else if (clean === 'Wing_Far_Finger_01') anim.wingTipR = o;
        }
        return;
      }
      if (o.isMesh) {
        const isVcolEmit = !!(o.material && o.material.name && o.material.name.indexOf('vcol_emit') !== -1);
        if (isVcolEmit) {
          const emMap = o.material.emissiveMap || o.material.map || null;
          const useVcol = !emMap && !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
          const cacheKey = useVcol ? '_emitMatVcol' : '_emitMat';
          let emMat = o.material.userData[cacheKey];
          if (!emMat) {
            emMat = new THREE.MeshBasicMaterial({ map: emMap, color: 0xffffff, vertexColors: useVcol, side: THREE.DoubleSide });
            o.material.userData[cacheKey] = emMat;
          }
          o.material = emMat;
          o.castShadow = false; o.receiveShadow = false;
        } else {
          if (typeof sodiumOpts === 'undefined' || sodiumOpts.immFast) {
            o.material.userData.sharedMat = true;
            if (!o.material.map && o.geometry && o.geometry.attributes && o.geometry.attributes.color) o.material.vertexColors = true;
          } else {
            const clonedMat = o.material.clone();
            if (!clonedMat.map && o.geometry && o.geometry.attributes && o.geometry.attributes.color) clonedMat.vertexColors = true;
            if (clonedMat.emissive) {
              clonedMat.userData.baseEmissive = o.material.userData.baseEmissive ? o.material.userData.baseEmissive.clone() : clonedMat.emissive.clone();
              clonedMat.userData.baseEmissiveInt = o.material.userData.baseEmissiveInt !== undefined ? o.material.userData.baseEmissiveInt : clonedMat.emissiveIntensity;
            }
            clonedMat.userData.sharedMat = false;
            o.material = clonedMat;
          }
          o.castShadow = castSh && o.castShadow;
          parts.push(o);
        }
      } else if (cl === 'torso' || cl === 'body') anim.torso = o;
      else if (cl === 'neck' || cl === 'neck1') anim.neck1 = o;
      else if (cl === 'head') anim.head = o;
      else if (cl === 'jaw') anim.jaw = o;
      else if (cl === 'core') anim.core = o;
      else if (cl === 'saddle' || cl === 'saddlegroup') anim.saddleGroup = o;
      else if (cl === 'tail') anim.tail = o;
      else if (cl === 'tail2') anim.tail2 = o;
      else if (cl === 'tail3') anim.tail3 = o;
      else if (cl === 'arm_l' || cl === 'arms_folded') anim.arms.push({ p: o, dir: 1, isFolded: foldedArmMob });
      else if (cl === 'arm_r') anim.arms.push({ p: o, dir: -1, isFolded: false });
      else if (cl === 'wing_l' || cl === 'wing_r' || cl === 'wing_l_outer' || cl === 'wing_r_outer') {
        wingMap[cl] = o;
      }
      else if (cl === 'leg_l' || cl === 'leg_fl' || cl === 'leg_br' || cl === 'leg_0' || cl === 'leg_3') anim.legs.push({ p: o, dir: 1 });
      else if (cl === 'leg_r' || cl === 'leg_fr' || cl === 'leg_bl' || cl === 'leg_1' || cl === 'leg_2') anim.legs.push({ p: o, dir: -1 });
      else if (/^leg_[lr]_?[0-4]$/.test(cl)) {
        const side = cl[4] === 'l' ? 1 : -1;
        const idx = parseInt(cl[cl.length - 1], 10);
        anim.legs.push({ p: o, dir: ((idx & 1) ? 1 : -1) * side, isSpider: true });
      }
    });
    if (isSkinnedDragon) {
      if (anim.bodyBone) {
        const saddleSeat = new THREE.Group();
        saddleSeat.position.set(0, 16.82 * 0.0625, 3.2 * 0.0625);
        g.add(saddleSeat);
        g.updateMatrixWorld(true);
        anim.bodyBone.attach(saddleSeat);
        anim.saddleSeat = saddleSeat;
        if (!anim.bodyCenter) {
          const bc = new THREE.Object3D();
          bc.position.set(0, 0.568, -0.028);
          anim.bodyBone.add(bc);
          anim.bodyCenter = bc;
          anim.bodyHalfExtents = new THREE.Vector3(0.61, 0.32, 0.38);
        }
      }
      const clips = (tpl.userData && tpl.userData.animations) || [];
      if (clips.length > 0 && typeof THREE.AnimationMixer === 'function') {
        const mixer = new THREE.AnimationMixer(armRoot);
        const actions = {};
        for (let ci = 0; ci < clips.length; ci++) {
          const act = mixer.clipAction(clips[ci]);
          act.setLoop(THREE.LoopRepeat, Infinity);
          actions[clips[ci].name] = act;
        }
        anim.mixer = mixer;
        anim.armRoot = armRoot;
        anim.actions = actions;
        const defAct = actions.Idle || actions[Object.keys(actions)[0]];
        if (defAct) {
          defAct.play();
          anim.activeClip = defAct.getClip().name;
          mixer.update(0);
        }
      }
    }
    for (const [wk, side] of [['wing_l', 1], ['wing_r', -1]]) {
      const wp = wingMap[wk];
      if (!wp) continue;
      const dir = (wp.position && Math.abs(wp.position.x) > 0.01) ? (wp.position.x >= 0 ? 1 : -1) : side;
      let hangDown = false;
      wp.traverse((wc) => {
        if (!wc.isMesh || !wc.geometry) return;
        if (!wc.geometry.boundingBox) wc.geometry.computeBoundingBox();
        const bb = wc.geometry.boundingBox;
        if (bb && (bb.max.y - bb.min.y) > (bb.max.x - bb.min.x) * 1.35) hangDown = true;
      });
      anim.wings.push({ p: wp, outer: wingMap[wk + '_outer'] || null, dir, isDragonWing: isDragonType, hangDown });
    }
    if (isDragonType && !isSkinnedDragon) {
      const DRG_PAL = {
        ice_dragon:   { ridge: 0x67e8f9, horn: 0xbae6fd, glow: 0x38bdf8 },
        fire_dragon:  { ridge: 0xf97316, horn: 0xc2b29b, glow: 0xfbbf24 },
        earth_dragon: { ridge: 0x10b981, horn: 0x292524, glow: 0x34d399 },
        water_dragon: { ridge: 0x22d3ee, horn: 0x67e8f9, glow: 0x06b6d4 },
        leaf_dragon:  { ridge: 0x84cc16, horn: 0x713f12, glow: 0xbef264 },
        tree_dragon:  { ridge: 0xa3e635, horn: 0x451a03, glow: 0xfacc15 }
      };
      const dp = DRG_PAL[type] || { ridge: 0xd946ef, horn: 0x3b3348, glow: 0xf0abfc };
      const ridgeMat = _getCuteBoxMats(`drg_r_${dp.ridge.toString(16)}`, { tex: _getNoiseTex('voxel'), color: dp.ridge, rough: 0.45 });
      const hornMat = _getCuteBoxMats(`drg_h_${dp.horn.toString(16)}`, { tex: _getNoiseTex('voxel'), color: dp.horn, rough: 0.55 });
      const mkDrgAcc = (parent, w, h, d, mat, x, y, z, rx = 0, rz = 0) => {
        if (!parent) return null;
        const am = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
        am.userData.sharedGeo = true;
        am.position.set(x, y, z);
        if (rx) am.rotation.x = rx;
        if (rz) am.rotation.z = rz;
        am.castShadow = castSh;
        parent.add(am);
        parts.push(am);
        return am;
      };
      // Tapered dorsal voxel crests along spine
      const spinePar = anim.torso || g;
      for (let si = 0; si < 4; si++) {
        mkDrgAcc(spinePar, 0.08, 0.24 - si * 0.025, 0.16, ridgeMat, 0, 0.42 - si * 0.01, 0.48 - si * 0.34, -0.22);
      }
      // Twin swept brow horns, cheek spurs & mouth breath-core crystal
      if (anim.head) {
        for (const sx of [-1, 1]) {
          mkDrgAcc(anim.head, 0.09, 0.11, 0.38, hornMat, sx * 0.22, 0.34, -0.18, 0.32, sx * -0.14);
          mkDrgAcc(anim.head, 0.07, 0.08, 0.20, hornMat, sx * 0.34, 0.08, -0.04, 0.10, sx * -0.22);
        }
        const bcMat = new THREE.MeshStandardMaterial({
          color: dp.glow, emissive: dp.glow, emissiveIntensity: 0.38, roughness: 0.25, metalness: 0.15
        });
        const bcMesh = new THREE.Mesh(_getBoxGeo(0.18, 0.12, 0.22), bcMat);
        bcMesh.userData.sharedGeo = true;
        bcMesh.position.set(0, -0.05, 0.34);
        anim.head.add(bcMesh);
        anim.breathCore = bcMesh;
        anim.breathCoreMat = bcMat;
      }
      // Wing-elbow claw spurs
      for (const wg of anim.wings) {
        const elbow = wg.outer || wg.p;
        if (elbow) mkDrgAcc(elbow, 0.10, 0.08, 0.22, hornMat, wg.dir * 0.32, 0.05, 0.28, -0.35, wg.dir * -0.20);
      }
    }
    if (!isSkinnedDragon && anim.wings.length === 0 && (type === 'flamingo' || (typeof ANIMAL_MAP !== 'undefined' && ANIMAL_MAP.get(type)?.fly))) {
      const parentWing = anim.torso || g;
      const spW = (typeof ANIMAL_MAP !== 'undefined') ? ANIMAL_MAP.get(type) : null;
      const cMain = type === 'flamingo' ? 0xf472b6 : ((spW && spW.c1) || 0xf472b6);
      const cOuter = type === 'flamingo' ? 0xfbcfe8 : ((spW && spW.c2) || 0xfbcfe8);
      const addWingPart = (wp, w, h, d, col, x, y, z) => {
        const mat = _getCuteBoxMats(`pw_${col.toString(16)}`, { tex: _getNoiseTex('voxel'), color: col, rough: 0.78 });
        const m = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
        m.userData.sharedGeo = true;
        m.position.set(x, y, z);
        m.castShadow = castSh;
        m.receiveShadow = true;
        wp.add(m);
        parts.push(m);
      };
      for (const sx of [-1, 1]) {
        const wp = new THREE.Group();
        wp.position.set(sx * 0.23, anim.torso ? 0.22 : 0.86, 0.02);
        parentWing.add(wp);
        addWingPart(wp, 0.42, 0.055, 0.34, cMain, sx * 0.21, 0, -0.02);
        addWingPart(wp, 0.34, 0.045, 0.26, cOuter, sx * 0.56, 0, -0.06);
        if (type === 'flamingo') addWingPart(wp, 0.14, 0.042, 0.20, 0x18181b, sx * 0.72, -0.005, -0.10);
        anim.wings.push({ p: wp, dir: sx, isDragonWing: false, hangDown: false });
      }
    }
    if (!isSkinnedDragon && isDragonType && !anim.bodyCenter && anim.torso) {
      anim.bodyCenter = anim.torso;
      anim.bodyHalfExtents = new THREE.Vector3(0.55, 0.35, 0.75);
    }
    const flameGroup = makeSharedFlameGroup();
    g.add(flameGroup);
    return { group: g, parts, flameGroup, anim, fromBlender: true };
  }

  // === v60 Cached Pixel-Art Voxel Texture & Cute Chunky Mob Builder (Zero-Leak Shared Geo/Tex) ===
  const _cuteBoxGeoCache = new Map();
  const _cuteVoxelTexCache = new Map();
  const _cuteBoxMatCache = new Map();

  // Cached 3x2 UV-mapped BoxGeometry (48x32 atlas = six 16x16 faces: +X, -X, +Y, -Y, +Z, -Z) -> 1 draw call per box!
  function _getCuteBoxGeo(w, h, d) {
    const k = `c_${w}_${h}_${d}`;
    let g = _cuteBoxGeoCache.get(k);
    if (g) return g;
    g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const eu = 0.08 / 48, ev = 0.08 / 32; // tiny inset prevents GPU seam bleed between adjacent 16x16 tiles
    for (let f = 0; f < 6; f++) {
      const col = f % 3, row = (f / 3) | 0;
      const u0 = col / 3 + eu, u1 = (col + 1) / 3 - eu;
      const v1 = 1 - row / 2 - ev, v0 = 1 - (row + 1) / 2 + ev;
      const i = f * 4;
      uv.setXY(i, u0, v1); uv.setXY(i + 1, u1, v1); uv.setXY(i + 2, u0, v0); uv.setXY(i + 3, u1, v0);
    }
    uv.needsUpdate = true;
    _cuteBoxGeoCache.set(k, g);
    return g;
  }

  function _makeCuteVoxelTex(key, drawFn, isAtlas = false) {
    let tex = _cuteVoxelTexCache.get(key);
    if (tex) return tex;
    const cv = document.createElement('canvas');
    cv.width = isAtlas ? 48 : 16;
    cv.height = isAtlas ? 32 : 16;
    const ctx = cv.getContext('2d');
    const hash = (x, y, s = 0) => {
      let n = ((x * 374761393 + y * 668265263 + s * 1442695041) | 0);
      n = ((n ^ (n >>> 13)) * 1274126177) | 0;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const clamp = (v) => (v < 0 ? 0 : (v > 255 ? 255 : v | 0));
    const rgb = (hex, d = 0) => {
      const r = clamp(((hex >> 16) & 255) + d), g = clamp(((hex >> 8) & 255) + d), b = clamp((hex & 255) + d);
      return `rgb(${r},${g},${b})`;
    };
    const orig = (t) => isAtlas ? [(t % 3) * 16, ((t / 3) | 0) * 16] : [0, 0];
    const px = (t, x, y, w, h, hex, d = 0) => {
      const [ox, oy] = orig(t);
      ctx.fillStyle = typeof hex === 'string' ? hex : rgb(hex, d);
      ctx.fillRect(ox + x, oy + y, w, h);
    };
    const fillTile = (t, baseHex, noise = 14, mode = 'voxel') => {
      const [ox, oy] = orig(t);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let d = (hash(x + t * 17, y + t * 29, baseHex & 255) - 0.5) * noise * 2;
        if (mode === 'wool') d += (((x + y) & 1) ? 5 : -5) + (hash(x >> 1, y >> 1, t + 7) - 0.5) * 14;
        else if (mode === 'fur') d += (hash(x, y >> 2, t + 19) - 0.5) * 24 - (y > 12 ? 12 : 0);
        else if (mode === 'stone') d += ((x === 0 || y === 0 || x === 15 || y === 15) ? -14 : 0) + (hash(x >> 1, y >> 1, t + 3) - 0.5) * 16;
        else if (mode === 'crystal') d += (x === 0 || y === 0 ? 28 : (x === 15 || y === 15 ? -18 : 0)) + ((x + y) < 8 ? 16 : -6);
        else if (x === 0 || y === 0) d += 6;
        else if (x === 15 || y === 15) d -= 10;
        ctx.fillStyle = rgb(baseHex, d);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    };
    const fillAll = (baseHex, noise = 14, mode = 'voxel', topDelta = 14, botDelta = -22) => {
      if (!isAtlas) { fillTile(0, baseHex, noise, mode); return; }
      for (let t = 0; t < 6; t++) {
        const shift = t === 2 ? topDelta : (t === 3 ? botDelta : (t === 5 ? -6 : 0));
        const r = clamp(((baseHex >> 16) & 255) + shift), g = clamp(((baseHex >> 8) & 255) + shift), b = clamp((baseHex & 255) + shift);
        fillTile(t, (r << 16) | (g << 8) | b, noise, mode);
      }
    };
    const capOverhang = (t, capHex, darkHex, rows = 8, dip = 2) => {
      for (let y = 0; y < rows + dip; y++) for (let x = 0; x < 16; x++) {
        const edge = (x < 2 || x > 13);
        const midDip = (x === 2 || x === 13) ? 1 : 0;
        const limit = rows + (edge ? dip : midDip);
        if (y >= limit) continue;
        const n = (hash(x + t * 11, y + 41, 9) - 0.5) * 18;
        px(t, x, y, 1, 1, y === limit - 1 ? darkHex : capHex, n);
      }
    };
    const cuteFace = (t, o = {}) => {
      const ey = o.eyeY ?? 9, sep = o.eyeSep ?? 3, ew = o.eyeW ?? 2, eh = o.eyeH ?? 2;
      const lx = sep, rx = 16 - sep - ew;
      if (o.sclera != null) {
        px(t, lx - 1, ey, ew + 1, eh, o.sclera);
        px(t, rx, ey, ew + 1, eh, o.sclera);
      }
      px(t, lx, ey, ew, eh, o.eyeCol ?? 0x1b2434);
      px(t, rx, ey, ew, eh, o.eyeCol ?? 0x1b2434);
      if (o.sparkle) {
        px(t, lx, ey, 1, 1, 0xffffff);
        px(t, rx, ey, 1, 1, 0xffffff);
      }
      if (o.browCol != null) px(t, lx - 1, ey - 2, 16 - (lx - 1) * 2, 2, o.browCol);
      if (o.blushCol != null) {
        px(t, Math.max(1, lx - 1), ey + eh, 2, 1, o.blushCol);
        px(t, Math.min(13, rx + ew - 1), ey + eh, 2, 1, o.blushCol);
      }
      if (o.noseCol != null) {
        const nw = o.noseW ?? 2, nh = o.noseH ?? 1, ny = o.noseY ?? (ey + eh);
        px(t, (16 - nw) >> 1, ny, nw, nh, o.noseCol);
      }
    };
    const spots = (t, col, list) => { for (const [x, y, w, h] of list) px(t, x, y, w || 2, h || 2, col); };
    const runes = (t, col) => {
      const pts = [[2,2,4,1],[2,2,1,4],[4,4,2,1],[10,2,4,1],[13,2,1,4],[10,4,2,1],[3,11,4,1],[3,11,1,3],[5,13,6,1],[12,11,1,3],[9,11,4,1]];
      for (const [x, y, w, h] of pts) px(t, x, y, w, h, col);
    };
    drawFn(ctx, { px, fillTile, fillAll, capOverhang, cuteFace, spots, runes, hash, rgb });
    tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    _cuteVoxelTexCache.set(key, tex);
    return tex;
  }

  // Caches material templates (backed by cached CanvasTexture). Glowing mats are shared directly;
  // damageable body mats return a lightweight clone with isolated THREE.Color baseEmissive for hurtFlash & disposeMobInstance.
  function _getCuteBoxMats(key, cfg) {
    let tpl = _cuteBoxMatCache.get(key);
    if (!tpl) {
      const tex = cfg.tex || _makeCuteVoxelTex(key, cfg.draw, cfg.atlas !== false);
      if (cfg.glow) {
        tpl = new THREE.MeshBasicMaterial({ map: tex, color: cfg.color ?? 0xffffff, transparent: !!cfg.transparent, opacity: cfg.opacity ?? 1 });
      } else {
        tpl = new THREE.MeshStandardMaterial({
          map: tex, color: cfg.color ?? 0xffffff, roughness: cfg.rough ?? 0.80,
          transparent: !!cfg.transparent, opacity: cfg.opacity ?? 1
        });
      }
      tpl.userData = {
        sharedMat: true,
        baseEmissive: new THREE.Color(cfg.emissive || 0x000000),
        baseEmissiveInt: cfg.emissiveIntensity || 0
      };
      if (!cfg.glow && cfg.emissive) {
        tpl.emissive.setHex(cfg.emissive);
        tpl.emissiveIntensity = cfg.emissiveIntensity || 0;
      }
      _cuteBoxMatCache.set(key, tpl);
    }
    if (cfg.glow || (typeof sodiumOpts !== 'undefined' && sodiumOpts.ferriteRam)) return tpl;
    const mat = tpl.clone();
    mat.userData = { sharedMat: false, baseEmissive: new THREE.Color(cfg.emissive || 0x000000), baseEmissiveInt: cfg.emissiveIntensity || 0 };
    return mat;
  }

  // Neutral grayscale-white 16x16 pixel-noise textures shared across all tinted uniform parts (only 5 cached textures total!).
  function _getNoiseTex(mode = 'voxel') {
    return _makeCuteVoxelTex(`_noise_${mode}`, (ctx, h) => h.fillTile(0, 0xf2f2f2, mode === 'wool' ? 12 : (mode === 'stone' ? 16 : 11), mode), false);
  }

  const _sheepGlbTexCache = new Map();
  function getTintedSheepGlbTex(baseTex, woolSpec) {
    if (!baseTex || !woolSpec || woolSpec.key === 'white') return baseTex;
    const ck = woolSpec.key;
    if (_sheepGlbTexCache.has(ck)) return _sheepGlbTexCache.get(ck);
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = woolSpec.hex || '#f1f5f9';
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.flipY = false;
    tex.needsUpdate = true;
    _sheepGlbTexCache.set(ck, tex);
    const tr = (woolSpec.hexInt >> 16) & 255, tg = (woolSpec.hexInt >> 8) & 255, tb = woolSpec.hexInt & 255;
    const paint = (img) => {
      const w = img.naturalWidth || img.width || 32, h = img.naturalHeight || img.height || 32;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const id = ctx.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a <= 128) continue;
        // Exact sheep GLB palette: tint only low-saturation bright wool (preserve '253,254,255' eye sclera, pupils, beige face & hooves!)
        if (r >= 235 && (Math.max(r, g, b) - Math.min(r, g, b)) <= 20 && !(r === 253 && g === 254 && b === 255)) {
          const lum = (r + g + b) / (3 * 251);
          d[i]     = Math.max(0, Math.min(255, Math.round(tr * lum)));
          d[i + 1] = Math.max(0, Math.min(255, Math.round(tg * lum)));
          d[i + 2] = Math.max(0, Math.min(255, Math.round(tb * lum)));
        }
      }
      ctx.putImageData(id, 0, 0);
      tex.needsUpdate = true;
    };
    const img = baseTex.image;
    if (img && img.complete && (img.naturalWidth > 0 || img.width > 0)) paint(img);
    else if (img && typeof img.addEventListener === 'function') img.addEventListener('load', () => paint(img), { once: true });
    return tex;
  }

  // Clones shared template material once per mesh and preserves THREE.Color baseEmissive (Material.clone JSON-flattens Color to int).
  function _cloneMobMatIfShared(mesh) {
    let mat = mesh && mesh.material;
    if (!mat) return null;
    if (mat.userData && mat.userData.sharedMat) {
      const ud = mat.userData, be = ud.baseEmissive;
      mat = mesh.material = mat.clone();
      mat.userData = {
        sharedMat: false,
        baseEmissive: (be && be.isColor) ? be.clone() : new THREE.Color(typeof be === 'number' ? be : 0x000000),
        baseEmissiveInt: ud.baseEmissiveInt !== undefined ? ud.baseEmissiveInt : 0
      };
    }
    return mat;
  }

  function pickSeededWoolColor(wx = 0, wz = 0) {
    if (typeof WOOL_COLORS === 'undefined' || !WOOL_COLORS.length) return null;
    const h = (((typeof worldSeed === 'number' ? worldSeed : 1337) ^ Math.imul(Math.floor(wx), 73856093) ^ Math.imul(Math.floor(wz), 19349663)) >>> 0);
    const total = (typeof WOOL_COLOR_TOTAL_W === 'number' && WOOL_COLOR_TOTAL_W > 0) ? WOOL_COLOR_TOTAL_W : WOOL_COLORS.length;
    let r = (h / 4294967296) * total;
    for (let i = 0; i < WOOL_COLORS.length; i++) {
      r -= (WOOL_COLORS[i].w || 1);
      if (r <= 0) return WOOL_COLORS[i];
    }
    return WOOL_COLORS[0];
  }
  function buildMobMesh(type, wx = 0, wz = 0, opts = null) {
    const _sheepSpec = (type === 'sheep') ? ((opts && opts.woolSpec) || pickSeededWoolColor(wx, wz)) : null;
    const _directProceduralMob = (
      type === 'villager' || type === 'magma_cube' || type === 'baby_ghast' || type === 'wildfire' ||
      type === 'redstone_monstrosity' || type === 'prismarine_colossus' || type === 'abyssal_colossus' || type === 'cave_warden' || type === 'dream_warden' ||
      type === 'pillager' || type === 'pillager_raider' || type === 'vindicator' || type === 'evoker' ||
      type === 'skeleton' || type === 'stray' || type === 'desert_skeleton' || type === 'bogged' ||
      type === 'zombie' || type === 'husk' || type === 'frozen_zombie' || type === 'mossy_zombie' ||
      type === 'chicken' || type === 'chicken_jockey' || type === 'spider_jockey'
    );
    const blenderMob = _directProceduralMob ? null : instantiateBlenderMob(type);
    if (blenderMob) {
      if (_sheepSpec) {
        for (let i = 0; i < blenderMob.parts.length; i++) {
          const mat = _cloneMobMatIfShared(blenderMob.parts[i]);
          if (mat) {
            if (mat.color) mat.color.setHex(0xffffff);
            if (mat.map) { mat.map = getTintedSheepGlbTex(mat.map, _sheepSpec); mat.needsUpdate = true; }
          }
        }
      }
      if (IS_DRAGON_MOB.has(type)) {
        if (type === 'ender_dragon' || type === 'sovereign_end_dragon' || _END_FIERCE_DRAGONS.has(type)) {
          const endSc = type === 'sovereign_end_dragon' ? 6.00 : (_END_FIERCE_DRAGONS.has(type) ? (blenderMob.anim.mixer ? 4.95 : 4.25) : (blenderMob.anim.mixer ? 4.85 : 4.20));
          blenderMob.group.scale.setScalar(endSc);
          blenderMob.group.userData.dragonScale = endSc;
          _applyDragonArmorToAnim(blenderMob.anim, null, false);
        } else if (blenderMob.anim.mixer) {
          const stSc = [0.34, 0.90, 1.85, 3.20, 4.60];
          const dStage = Math.max(0, Math.min(4, (opts && typeof opts.dragonStage === 'number') ? (opts.dragonStage | 0) : 4));
          const sc = stSc[dStage];
          blenderMob.group.scale.setScalar(sc);
          blenderMob.group.userData.dragonStage = dStage;
          blenderMob.group.userData.dragonScale = sc;
          _applyDragonArmorToAnim(blenderMob.anim, opts && opts.dragonArmor, !!(opts && opts.saddled));
        } else {
          const stCfg = [
            { sc: 0.34, headMul: 1.32, wingMul: 0.40 },
            { sc: 0.90, headMul: 1.18, wingMul: 0.58 },
            { sc: 1.85, headMul: 1.08, wingMul: 0.78 },
            { sc: 3.20, headMul: 1.02, wingMul: 0.94 },
            { sc: 4.60, headMul: 1.00, wingMul: 1.06 }
          ];
          const dStage = Math.max(0, Math.min(4, (opts && typeof opts.dragonStage === 'number') ? (opts.dragonStage | 0) : 4));
          const st = stCfg[dStage];
          blenderMob.group.scale.setScalar(st.sc);
          blenderMob.group.userData.dragonStage = dStage;
          blenderMob.group.userData.dragonScale = st.sc;
          if (blenderMob.anim.head) blenderMob.anim.head.scale.setScalar(st.headMul);
          for (let wi = 0; wi < blenderMob.anim.wings.length; wi++) {
            const w = blenderMob.anim.wings[wi];
            if (w && w.p) w.p.scale.setScalar(st.wingMul);
          }
          if (blenderMob.anim.saddleGroup) blenderMob.anim.saddleGroup.visible = !!(opts && opts.saddled);
        }
      }
      return blenderMob;
    }

    const g = new THREE.Group(), parts = [];
    const anim = { torso: null, head: null, jaw: null, core: null, legs: [], arms: [], wings: [], tail: null };
    const castSh = !_isMobilePerf;

    const addBoxTo = (parent, w, h, d, col, x, y, z, emissiveEye = false, rough = 0.78, mode = 'voxel') => {
      const k = emissiveEye ? `gl_${col.toString(16)}` : `nt_${mode}_${col.toString(16)}_${Math.round(rough * 100)}`;
      const mat = _getCuteBoxMats(k, { tex: _getNoiseTex(mode), color: col, rough, glow: emissiveEye });
      const m = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
      m.userData.sharedGeo = true;
      m.position.set(x, y, z); m.castShadow = !emissiveEye && castSh; m.receiveShadow = !emissiveEye;
      parent.add(m); if (!emissiveEye) parts.push(m); return m;
    };
    const addArtBox = (parent, w, h, d, key, draw, x, y, z, opt = {}) => {
      const isAtlas = opt.atlas !== false;
      const mat = _getCuteBoxMats(key, { draw, atlas: isAtlas, rough: opt.rough ?? 0.80, glow: !!opt.glow, transparent: !!opt.transparent, opacity: opt.opacity ?? 1, emissive: opt.emissive, emissiveIntensity: opt.emissiveIntensity });
      const m = new THREE.Mesh(isAtlas ? _getCuteBoxGeo(w, h, d) : _getBoxGeo(w, h, d), mat);
      m.userData.sharedGeo = true;
      m.position.set(x, y, z); m.castShadow = !opt.glow && castSh; m.receiveShadow = !opt.glow;
      parent.add(m); if (!opt.glow) parts.push(m); return m;
    };
    const makePivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const finishMob = () => { const fg = makeSharedFlameGroup(); g.add(fg); return { group: g, parts, flameGroup: fg, anim, fromBlender: false }; };

    // === v60 Cute Chunky Voxel Models for THE SIFT (Reference-Matched Pixel Art + Pivoted Limbs + Shared Geo/Tex!) ===
    if (type === 'blub') {
      anim.torso = makePivot(g, 0, 0.41, 0);
      addArtBox(anim.torso, 0.64, 0.50, 0.64, 'sift_blub', (ctx, h) => {
        h.fillAll(0x63c5f8, 12, 'voxel', 26, -24);
        for (const t of [0, 1, 4, 5]) {
          h.px(t, 0, 0, 16, 2, 0xa8e8ff);
          h.px(t, 0, 11, 16, 5, 0x42a4e2);
          h.px(t, 1, 2, 14, 1, 0x8ad9ff);
        }
        h.px(2, 1, 1, 14, 14, 0x8be2ff); h.px(2, 3, 3, 10, 10, 0xb8f0ff);
        h.cuteFace(4, { eyeY: 10, eyeSep: 3, eyeW: 2, eyeH: 1, eyeCol: 0x3340a3, noseY: 11, noseW: 2, noseH: 1, noseCol: 0x252d7d, blushCol: 0x7ea5f8 });
      }, 0, 0, 0, { rough: 0.55 });
      for (const sx of [-1, 1]) {
        addArtBox(anim.torso, 0.14, 0.30, 0.12, 'sift_blub_ear', (ctx, h) => {
          h.fillTile(0, 0x7cd4fc, 10);
          h.px(0, 0, 0, 16, 2, 0xbef0ff);
          h.px(0, 4, 3, 8, 10, 0xdaf6ff);
          h.px(0, 0, 13, 16, 3, 0x4db3ec);
        }, sx * 0.17, 0.38, 0.08, { atlas: false, rough: 0.55 });
      }
      for (const [lx, lz, d] of [[-0.24, 0.24, 1], [0.24, 0.24, -1], [-0.24, -0.24, -1], [0.24, -0.24, 1]]) {
        const leg = makePivot(g, lx, 0.18, lz);
        addBoxTo(leg, 0.16, 0.18, 0.16, 0x57bdf5, 0, -0.09, 0, false, 0.60);
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'wobble') {
      anim.torso = makePivot(g, 0, 0.43, 0);
      addArtBox(anim.torso, 0.64, 0.54, 0.64, 'sift_wobble', (ctx, h) => {
        h.fillAll(0xf9a8d4, 12, 'wool', 16, -18);
        for (const t of [0, 1, 2, 5]) {
          h.spots(t, 0x7dd3fc, [[1, 2, 4, 4], [10, 1, 4, 3], [6, 10, 5, 4], [12, 9, 3, 4]]);
          h.spots(t, 0xfff1f2, [[6, 3, 3, 3], [2, 10, 3, 3]]);
        }
        h.spots(4, 0x7dd3fc, [[0, 0, 4, 4], [12, 0, 4, 4], [0, 12, 4, 4], [12, 12, 4, 4]]);
        h.spots(4, 0xfff1f2, [[5, 1, 6, 3], [4, 12, 8, 3]]);
        h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x1e1b4b, sparkle: true, noseY: 9, noseW: 2, noseH: 2, noseCol: 0xe11d48, blushCol: 0xf43f5e });
      }, 0, 0, 0, { rough: 0.78 });
      addBoxTo(anim.torso, 0.12, 0.09, 0.05, 0xe11d48, 0, -0.065, 0.335, false, 0.70);
      for (const sx of [-1, 1]) {
        const ear = addArtBox(anim.torso, 0.15, 0.34, 0.13, 'sift_wobble_ear', (ctx, h) => {
          h.fillTile(0, 0xf472b6, 10);
          h.px(0, 0, 0, 16, 4, 0xdb2777);
          h.px(0, 4, 5, 8, 9, 0xfce7f3);
        }, sx * 0.19, 0.40, 0.06, { atlas: false, rough: 0.78 });
        ear.rotation.z = -sx * 0.18; ear.rotation.x = 0.06;
      }
      for (const [lx, lz, d, col] of [[-0.24, 0.24, 1, 0x7dd3fc], [0.24, 0.24, -1, 0x7dd3fc], [-0.24, -0.24, -1, 0xf9a8d4], [0.24, -0.24, 1, 0xf9a8d4]]) {
        const leg = makePivot(g, lx, 0.18, lz);
        addBoxTo(leg, 0.16, 0.18, 0.16, col, 0, -0.09, 0, false, 0.78, 'wool');
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'nuzzle') {
      anim.torso = makePivot(g, 0, 0.64, 0);
      addArtBox(anim.torso, 0.72, 0.56, 0.88, 'sift_nuzzle_body', (ctx, h) => {
        h.fillAll(0xebe5fb, 14, 'wool', 14, -20);
        for (const t of [0, 1, 2, 4, 5]) h.spots(t, 0xd8caf5, [[2, 3, 3, 3], [10, 6, 3, 3], [5, 11, 4, 3]]);
      }, 0, 0, 0, { rough: 0.92 });
      addBoxTo(anim.torso, 0.18, 0.18, 0.14, 0xf3efff, 0, 0.04, -0.47, false, 0.92, 'wool');
      anim.head = makePivot(anim.torso, 0, 0.14, 0.42);
      addArtBox(anim.head, 0.42, 0.38, 0.40, 'sift_nuzzle_head', (ctx, h) => {
        h.fillAll(0x2ec4a9, 12, 'voxel', 16, -20);
        h.px(4, 0, 0, 16, 3, 0xeee8fc);
        h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, sparkle: true, noseY: 11, noseW: 2, noseH: 1, noseCol: 0x115e59, blushCol: 0x5eead4 });
      }, 0, 0, 0.14, { rough: 0.76 });
      addBoxTo(anim.head, 0.46, 0.15, 0.42, 0xf3efff, 0, 0.23, 0.12, false, 0.92, 'wool');
      for (const sx of [-1, 1]) {
        const ear = addBoxTo(anim.head, 0.18, 0.09, 0.08, 0x22a890, sx * 0.27, 0.05, 0.10, false, 0.78);
        ear.rotation.z = -sx * 0.22;
      }
      for (const [lx, lz, d] of [[-0.21, 0.26, 1], [0.21, 0.26, -1], [-0.21, -0.26, -1], [0.21, -0.26, 1]]) {
        const leg = makePivot(g, lx, 0.38, lz);
        addArtBox(leg, 0.15, 0.38, 0.15, 'sift_nuzzle_leg', (ctx, h) => {
          h.fillTile(0, 0x26b097, 10);
          h.px(0, 0, 12, 16, 4, 0x134e4a);
        }, 0, -0.19, 0, { atlas: false, rough: 0.80 });
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'trill') {
      const vi = Math.abs(Math.floor(wx * 3 + wz * 5)) % 3;
      const pal = [
        { main: 0x45c9a0, belly: 0xa7f3d0, dark: 0x237a60, beak: 0x1e293b, foot: 0x1e293b },
        { main: 0xee5896, belly: 0xfbcfe8, dark: 0xb81d60, beak: 0x3b1525, foot: 0x3b1525 },
        { main: 0xf5c71a, belly: 0xfef08a, dark: 0xb8860b, beak: 0x451a03, foot: 0x451a03 }
      ][vi];
      anim.torso = makePivot(g, 0, 0.34, 0);
      addArtBox(anim.torso, 0.40, 0.32, 0.38, `sift_trill_body_${vi}`, (ctx, h) => {
        h.fillAll(pal.main, 12, 'fur', 14, -18);
        h.px(4, 3, 2, 10, 12, pal.belly);
      }, 0, 0, 0, { rough: 0.82 });
      anim.head = makePivot(anim.torso, 0, 0.16, 0.04);
      addArtBox(anim.head, 0.42, 0.36, 0.40, `sift_trill_head_${vi}`, (ctx, h) => {
        h.fillAll(pal.main, 11, 'voxel', 16, -16);
        h.px(4, 2, 11, 12, 4, pal.belly);
        h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 3, eyeH: 3, eyeCol: 0x0f172a, sparkle: true, blushCol: pal.dark });
      }, 0, 0.16, 0.02, { rough: 0.78 });
      addBoxTo(anim.head, 0.10, 0.07, 0.10, pal.beak, 0, 0.12, 0.24, false, 0.70);
      addBoxTo(anim.head, 0.08, 0.16, 0.08, pal.main, 0, 0.40, 0.02, false, 0.80);
      addBoxTo(anim.head, 0.07, 0.12, 0.07, pal.dark, -0.08, 0.37, -0.04, false, 0.80);
      addBoxTo(anim.head, 0.07, 0.11, 0.07, pal.dark,  0.08, 0.36, -0.03, false, 0.80);
      anim.tail = makePivot(anim.torso, 0, -0.02, -0.18);
      const tf = addBoxTo(anim.tail, 0.22, 0.08, 0.22, pal.dark, 0, 0.04, -0.10, false, 0.82);
      tf.rotation.x = 0.35;
      for (const sx of [-1, 1]) {
        const wp = makePivot(anim.torso, sx * 0.21, 0.04, -0.02);
        addBoxTo(wp, 0.08, 0.24, 0.28, pal.dark, sx * 0.04, -0.06, -0.02, false, 0.82);
        anim.wings.push({ p: wp, dir: sx });
      }
      for (const [lx, d] of [[-0.10, 1], [0.10, -1]]) {
        const leg = makePivot(g, lx, 0.19, 0.02);
        addBoxTo(leg, 0.06, 0.17, 0.06, pal.foot, 0, -0.085, 0, false, 0.85);
        addBoxTo(leg, 0.11, 0.04, 0.13, pal.foot, 0, -0.17, 0.03, false, 0.85);
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'singer') {
      anim.torso = makePivot(g, 0, 0.80, 0);
      addArtBox(anim.torso, 0.72, 0.66, 0.50, 'sift_singer_body', (ctx, h) => {
        h.fillAll(0x9be5dc, 14, 'fur', 18, -24);
        for (const t of [0, 1, 4, 5]) h.px(t, 0, 11, 16, 5, 0x45757e);
        // Cute cream diamond chest motif (Ref Image 2 far right)
        h.px(4, 7, 9, 2, 6, 0xede6d6); h.px(4, 6, 10, 4, 4, 0xede6d6);
      }, 0, 0, 0, { rough: 0.88 });
      anim.head = makePivot(anim.torso, 0, 0.32, 0);
      addArtBox(anim.head, 0.44, 0.64, 0.40, 'sift_singer_head', (ctx, h) => {
        h.fillAll(0xa8ece4, 14, 'fur', 18, -18);
        // Recessed pale-cream wooden spirit mask face (Ref Image 2 & 3)
        h.px(4, 4, 3, 8, 7, 0xd4cbb8);
        h.px(4, 5, 4, 6, 5, 0xf2ede2);
        h.px(4, 6, 5, 1, 2, 0x263238);
        h.px(4, 9, 5, 1, 2, 0x263238);
        h.px(4, 7, 8, 2, 1, 0x7c7062);
      }, 0, 0.31, 0, { rough: 0.86 });
      for (const sx of [-1, 1]) {
        const beam = addBoxTo(anim.head, 0.07, 0.36, 0.07, 0xf3eee3, sx * 0.29, 0.65, 0, false, 0.72);
        beam.rotation.z = -sx * 0.45;
        addBoxTo(anim.head, 0.05, 0.16, 0.05, 0xf8fafc, sx * 0.24, 0.74, 0, false, 0.70);
        addBoxTo(anim.head, 0.05, 0.20, 0.05, 0xf8fafc, sx * 0.40, 0.78, 0, false, 0.70);
        const arm = makePivot(anim.torso, sx * 0.44, 0.18, 0);
        addArtBox(arm, 0.18, 0.46, 0.20, 'sift_singer_arm', (ctx, h) => {
          h.fillTile(0, 0x8adcd2, 14, 'fur');
          h.px(0, 0, 12, 16, 4, 0x45757e);
          h.px(0, 2, 14, 12, 2, 0xeae3d2);
        }, 0, -0.21, 0, { atlas: false, rough: 0.88 });
        anim.arms.push({ p: arm, dir: sx });
      }
      for (const [lx, d] of [[-0.18, 1], [0.18, -1]]) {
        const leg = makePivot(g, lx, 0.48, 0);
        addArtBox(leg, 0.24, 0.48, 0.26, 'sift_singer_leg', (ctx, h) => {
          h.fillTile(0, 0x4b7d86, 12, 'fur');
          h.px(0, 0, 12, 16, 4, 0xeae3d2);
          h.px(0, 5, 13, 2, 3, 0x3b636b); h.px(0, 9, 13, 2, 3, 0x3b636b);
        }, 0, -0.24, 0, { atlas: false, rough: 0.86 });
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'echo_golem') {
      anim.torso = makePivot(g, 0, 0.82, 0);
      addArtBox(anim.torso, 0.78, 0.78, 0.62, 'sift_echo_body', (ctx, h) => {
        h.fillAll(0x24627a, 16, 'stone', 14, -20);
        for (const t of [0, 1, 5]) h.runes(t, 0x67e8f9);
        // Totem face + glowing cyan spiral chest runes
        h.px(4, 2, 9, 12, 6, 0x1a485c);
        h.runes(4, 0x7ef9ff);
        h.px(4, 3, 2, 10, 6, 0x1b4c60);
        h.cuteFace(4, { eyeY: 3, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, sclera: 0xdbeeff });
      }, 0, 0, 0, { rough: 0.65 });
      addArtBox(anim.torso, 0.16, 0.14, 0.10, 'sift_echo_snout', (ctx, h) => {
        h.fillTile(0, 0xdceef5, 8, 'stone');
        h.px(0, 5, 6, 6, 4, 0x1b3b4b);
      }, 0, 0.12, 0.34, { atlas: false, rough: 0.60 });
      addArtBox(anim.torso, 0.96, 0.22, 0.72, 'sift_echo_collar', (ctx, h) => {
        h.fillAll(0x2e758f, 14, 'stone', 16, -20);
        for (const t of [0, 1, 4, 5]) { h.px(t, 1, 10, 3, 2, 0x67f5ff); h.px(t, 12, 10, 3, 2, 0x67f5ff); }
      }, 0, 0.46, 0, { rough: 0.58 });
      // Huge spinning glowing aqua-cyan crystal cube on top of pedestal (Ref Image 2 & 3)
      anim.core = addArtBox(anim.torso, 0.54, 0.54, 0.54, 'sift_echo_crystal', (ctx, h) => {
        h.fillAll(0x5ef2ea, 12, 'crystal', 24, -18);
        for (let t = 0; t < 6; t++) {
          h.px(t, 2, 2, 12, 12, 0x7afaf2);
          h.px(t, 3, 3, 4, 4, 0xd8fffc);
          h.spots(t, 0x2dd4bf, [[10, 10, 3, 3], [5, 11, 2, 2]]);
        }
      }, 0, 0.86, 0, { glow: true });
      for (const [ax, d] of [[-0.52, 1], [0.52, -1]]) {
        const arm = makePivot(anim.torso, ax, 0.24, 0);
        addArtBox(arm, 0.24, 0.56, 0.26, 'sift_echo_arm', (ctx, h) => {
          h.fillTile(0, 0x1f5368, 14, 'stone');
          h.px(0, 3, 5, 10, 2, 0x67e8f9); h.px(0, 3, 5, 2, 6, 0x67e8f9); h.px(0, 3, 9, 8, 2, 0x67e8f9);
        }, 0, -0.26, 0, { atlas: false, rough: 0.65 });
        anim.arms.push({ p: arm, dir: d });
      }
      for (const [lx, d] of [[-0.22, 1], [0.22, -1]]) {
        const leg = makePivot(g, lx, 0.44, 0);
        addBoxTo(leg, 0.28, 0.44, 0.32, 0x1b485a, 0, -0.22, 0, false, 0.68, 'stone');
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'humbler') {
      anim.torso = makePivot(g, 0, 0.44, 0);
      addArtBox(anim.torso, 0.68, 0.56, 0.68, 'sift_humbler', (ctx, h) => {
        h.fillAll(0xc98d68, 12, 'voxel', 8, -22);
        // Lush mossy teal top (+Y) with pale mint square speckles
        h.fillTile(2, 0x3b967f, 14, 'voxel');
        h.spots(2, 0x9ef2d8, [[3, 3, 2, 2], [10, 5, 2, 2], [6, 11, 2, 2], [11, 11, 2, 2]]);
        // Overhanging teal-green moss cap around front/sides/back (Ref Image 1 top-left & Image 2!)
        for (const t of [0, 1, 4, 5]) {
          h.capOverhang(t, 0x338974, 0x215c52, 8, 2);
          h.spots(t, 0x8de8cc, [[3, 4, 2, 2], [11, 6, 2, 2]]);
        }
        // Cute face on warm terracotta earth lower band right under moss overhang
        h.cuteFace(4, { eyeY: 11, eyeSep: 3, eyeW: 2, eyeH: 1, eyeCol: 0x1a2733, noseY: 12, noseW: 2, noseH: 1, noseCol: 0x1a2733 });
      }, 0, 0, 0, { rough: 0.82 });
      // 4 thin pixel grass/reed stalks sprouting from mossy top
      for (const [rx, ry, rz, rh] of [[-0.18, 0.41, 0.14, 0.28], [-0.06, 0.37, 0.18, 0.20], [0.12, 0.42, 0.08, 0.30], [0.20, 0.35, 0.16, 0.16]]) {
        addArtBox(anim.torso, 0.05, rh, 0.05, 'sift_humbler_reed', (ctx, h) => {
          h.fillTile(0, 0x1c5258, 8);
          h.px(0, 0, 0, 16, 4, 0x95dfe4);
          h.px(0, 0, 4, 16, 4, 0x3a8280);
        }, rx, ry, rz, { atlas: false, rough: 0.75 });
      }
      // Curved back dark-teal lantern stalk + glowing-cyan-eyed teal lantern cube
      const s1 = addBoxTo(anim.torso, 0.06, 0.30, 0.06, 0x1d4e5a, 0, 0.35, -0.32, false, 0.78);
      s1.rotation.x = -0.40;
      addBoxTo(anim.torso, 0.06, 0.32, 0.06, 0x1d4e5a, 0, 0.59, -0.40, false, 0.78);
      addArtBox(anim.torso, 0.28, 0.26, 0.28, 'sift_humbler_lantern', (ctx, h) => {
        h.fillAll(0x2c6475, 12, 'stone', 18, -18);
        h.px(4, 3, 7, 3, 3, 0x38f2ff); h.px(4, 10, 7, 3, 3, 0x38f2ff);
      }, 0, 0.83, -0.40, { rough: 0.65 });
      addBoxTo(anim.torso, 0.06, 0.06, 0.018, 0x38f2ff, -0.07, 0.82, -0.249, true);
      addBoxTo(anim.torso, 0.06, 0.06, 0.018, 0x38f2ff,  0.07, 0.82, -0.249, true);
      for (const [lx, lz, d] of [[-0.26, 0.26, 1], [0.26, 0.26, -1], [-0.26, -0.26, -1], [0.26, -0.26, 1]]) {
        const leg = makePivot(g, lx, 0.18, lz);
        addBoxTo(leg, 0.16, 0.18, 0.16, 0xb87a58, 0, -0.09, 0, false, 0.84);
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'roamroot') {
      anim.torso = makePivot(g, 0, 0.56, 0);
      addArtBox(anim.torso, 0.46, 0.56, 0.46, 'sift_roamroot_stem', (ctx, h) => {
        h.fillAll(0xe6dfd1, 12, 'fur', 10, -18);
        h.cuteFace(4, { eyeY: 4, eyeSep: 4, eyeW: 2, eyeH: 3, eyeCol: 0x1c1917, noseY: 8, noseW: 2, noseH: 1, noseCol: 0xd97745 });
      }, 0, 0, 0, { rough: 0.86 });
      addBoxTo(anim.torso, 0.86, 0.06, 0.86, 0xdcd0bc, 0, 0.27, 0, false, 0.90, 'wool');
      const capDraw = (ctx, h) => {
        h.fillAll(0xea6314, 14, 'voxel', 16, -24);
        for (const t of [0, 1, 2, 4, 5]) {
          h.spots(t, 0xfef3c7, [[2, 2, 4, 3], [10, 3, 4, 4], [5, 10, 4, 3], [11, 11, 3, 3]]);
          h.spots(t, 0xc2410c, [[7, 1, 2, 2], [1, 9, 3, 2]]);
        }
      };
      addArtBox(anim.torso, 0.96, 0.24, 0.96, 'sift_roamroot_cap', capDraw, 0, 0.41, 0, { rough: 0.76 });
      addArtBox(anim.torso, 0.70, 0.14, 0.70, 'sift_roamroot_cap', capDraw, 0, 0.58, 0, { rough: 0.76 });
      for (const [lx, d] of [[-0.12, 1], [0.12, -1]]) {
        const leg = makePivot(g, lx, 0.30, 0);
        addBoxTo(leg, 0.16, 0.30, 0.18, 0xd5ccbc, 0, -0.15, 0, false, 0.88);
        anim.legs.push({ p: leg, dir: d });
      }
      return finishMob();
    }

    if (type === 'ichor_ray' || type === 'sky_manta') {
      const isSkyManta = (type === 'sky_manta');
      anim.torso = makePivot(g, 0, isSkyManta ? 0.42 : 0.34, 0);
      addArtBox(anim.torso, 0.50, 0.14, 0.72, isSkyManta ? 'sift_skymanta_body' : 'sift_ichor_body', (ctx, h) => {
        h.fillAll(isSkyManta ? 0x0284c7 : 0x5b21b6, 12, 'voxel', 16, -20);
        h.spots(2, isSkyManta ? 0xf9a8d4 : 0xe879f9, [[7, 2, 2, 2], [7, 6, 2, 2], [7, 10, 2, 2]]);
        h.px(2, 1, 1, 14, 2, isSkyManta ? 0xa5f3fc : 0x38bdf8);
      }, 0, 0, 0, { rough: 0.62 });
      addBoxTo(anim.torso, 0.08, 0.05, 0.06, isSkyManta ? 0xfef08a : 0x38f2ff, -0.16, 0.06, 0.28, true);
      addBoxTo(anim.torso, 0.08, 0.05, 0.06, isSkyManta ? 0xfef08a : 0x38f2ff,  0.16, 0.06, 0.28, true);
      const wingDraw = (ctx, h) => {
        h.fillTile(0, isSkyManta ? 0x38bdf8 : 0x7c3aed, 12);
        h.px(0, 0, 0, 16, 2, isSkyManta ? 0xf0abfc : 0x38bdf8);
        h.px(0, 0, 14, 16, 2, isSkyManta ? 0xf0abfc : 0x38bdf8);
        h.spots(0, isSkyManta ? 0xe0f2fe : 0xc084fc, [[2, 5, 4, 2], [8, 7, 5, 2], [4, 10, 4, 2]]);
      };
      for (const sx of [-1, 1]) {
        const wp = makePivot(anim.torso, sx * 0.24, 0, -0.02);
        addArtBox(wp, 0.46, 0.07, 0.52, isSkyManta ? 'sift_skymanta_wing' : 'sift_ichor_wing', wingDraw, sx * 0.23, 0, -0.02, { atlas: false, rough: 0.60 });
        addArtBox(wp, 0.36, 0.05, 0.34, isSkyManta ? 'sift_skymanta_wing' : 'sift_ichor_wing', wingDraw, sx * 0.60, 0, -0.08, { atlas: false, rough: 0.60 });
        anim.wings.push({ p: wp, dir: sx });
      }
      anim.tail = makePivot(anim.torso, 0, 0, -0.35);
      addBoxTo(anim.tail, 0.10, 0.06, 0.44, isSkyManta ? 0x0ea5e9 : 0x9333ea, 0, 0, -0.22, false, 0.65);
      addBoxTo(anim.tail, 0.06, 0.05, 0.26, isSkyManta ? 0xfbbf24 : 0xf472b6, 0, 0, -0.54, true);
      if (isSkyManta) g.scale.setScalar(1.22);
      return finishMob();
    }

    if (type === 'harmonizer' || type === 'nightmare_stalker') {
      const isNight = (type === 'nightmare_stalker');
      anim.torso = makePivot(g, 0, 1.06, 0);
      addArtBox(anim.torso, 0.54, 0.60, 0.54, isNight ? 'sift_nightmare_head' : 'sift_harmonizer_head', (ctx, h) => {
        h.fillAll(isNight ? 0x26081c : 0x581c87, 16, 'crystal', 18, -22);
        for (const t of [0, 1, 2, 5]) h.spots(t, isNight ? 0xbe123c : 0xa855f7, [[2, 3, 3, 4], [10, 2, 3, 3], [6, 10, 4, 3]]);
        h.px(4, 3, 4, 10, 9, 0x0d040c); // dark obsidian resonance visor
      }, 0, 0.24, 0, { rough: 0.55 });
      addArtBox(anim.torso, 0.22, 0.22, 0.05, isNight ? 'sift_nightmare_eye' : 'sift_harmonizer_eye', (ctx, h) => {
        h.fillTile(0, isNight ? 0xf43f5e : 0x38bdf8, 8, 'crystal');
        h.px(0, 3, 3, 10, 10, isNight ? 0xfda4af : 0xa5f3fc);
        h.px(0, 6, 6, 4, 4, 0xffffff);
      }, 0, 0.22, 0.265, { atlas: false, glow: true });
      addArtBox(anim.torso, 0.58, 0.11, 0.58, isNight ? 'sift_nightmare_collar' : 'sift_harmonizer_collar', (ctx, h) => {
        h.fillAll(isNight ? 0x451a2b : 0xe2c290, 10, 'stone', 12, -16);
        for (const t of [0, 1, 4, 5]) h.spots(t, isNight ? 0xf43f5e : 0x785838, [[2, 6, 2, 4], [7, 6, 2, 4], [12, 6, 2, 4]]);
      }, 0, -0.10, 0, { rough: 0.65 });
      addArtBox(anim.torso, 0.80, 0.12, 0.80, isNight ? 'sift_nightmare_skirt' : 'sift_harmonizer_skirt', (ctx, h) => {
        h.fillAll(isNight ? 0x4c0519 : 0x7e22ce, 16, 'crystal', 16, -20);
        for (const t of [0, 1, 2, 4, 5]) h.spots(t, isNight ? 0xfb7185 : 0xc084fc, [[2, 2, 3, 3], [11, 10, 3, 3]]);
      }, 0, -0.22, 0, { rough: 0.55 });
      for (const [px, pz, rx, rz] of [[0, 0.42, 0.35, 0], [0, -0.42, -0.35, 0], [0.42, 0, 0, -0.35], [-0.42, 0, 0, 0.35]]) {
        const pt = addBoxTo(anim.torso, px ? 0.22 : 0.40, 0.07, pz ? 0.22 : 0.40, isNight ? 0x881337 : 0x9333ea, px, -0.28, pz, false, 0.55, 'crystal');
        pt.rotation.x = rx; pt.rotation.z = rz;
      }
      for (const [tx, tz] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]]) {
        addBoxTo(anim.torso, 0.06, 0.38, 0.06, isNight ? 0xbe123c : 0xa855f7, tx, -0.45, tz, false, 0.55, 'crystal');
      }
      for (const sx of [-1, 1]) {
        const ant = addBoxTo(anim.torso, 0.07, 0.36, 0.07, isNight ? 0xf43f5e : 0xc084fc, sx * 0.23, 0.66, 0, false, 0.50, 'crystal');
        ant.rotation.z = -sx * 0.26;
        addBoxTo(anim.torso, 0.05, 0.14, 0.05, isNight ? 0xfda4af : 0x67e8f9, sx * 0.32, 0.72, 0, true);
      }
      anim.core = addBoxTo(anim.torso, 0.14, 0.14, 0.14, isNight ? 0xf43f5e : 0x67e8f9, 0, 0.72, 0, true);
      if (isNight) g.scale.setScalar(1.12);
      return finishMob();
    }

    // === Overworld / Nether Procedural Fallbacks (Upgraded: Pixel-Art Faces + Subtle Voxel Noise + Shared Geo/Flame!) ===
    if (type === 'villager') {
      const profIdx = Math.abs(Math.floor(wx * 3 + wz * 7)) % 5;
      const robeCols  = [0x6b4423, 0x166534, 0x1e3a8a, 0x7c2d12, 0x581c87];
      const apronCols = [0xd97706, 0x86efac, 0x93c5fd, 0x27272a, 0xfacc15];
      const robe = robeCols[profIdx], apron = apronCols[profIdx];
      addBoxTo(g, 0.56, 0.82, 0.36, robe, 0, 1.02, 0, false, 0.84, 'wool');
      addBoxTo(g, 0.60, 0.28, 0.38, robe, 0, 0.48, 0, false, 0.84, 'wool');
      addBoxTo(g, 0.42, 0.72, 0.04, apron, 0, 0.94, 0.19, false, 0.82);
      addBoxTo(g, 0.62, 0.14, 0.40, 0x451a03, 0, 1.38, 0);
      addBoxTo(g, 0.60, 0.10, 0.38, 0x291507, 0, 0.76, 0);
      addBoxTo(g, 0.12, 0.16, 0.10, 0x78350f, 0.26, 0.72, 0.16);
      addBoxTo(g, 0.12, 0.12, 0.06, 0x22c55e, 0, 1.22, 0.20, true);
      const head = makePivot(g, 0, 1.44, 0); anim.head = head;
      addArtBox(head, 0.46, 0.56, 0.46, 'fb_villager_head', (ctx, h) => {
        h.fillAll(0xdca782, 10, 'voxel', 10, -16);
        h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x16a34a, sclera: 0xffffff, browCol: 0x3b2313, noseY: 12, noseW: 4, noseH: 1, noseCol: 0xa16244 });
      }, 0, 0.28, 0);
      addBoxTo(head, 0.12, 0.22, 0.16, 0xc48b64, 0, 0.17, 0.26);
      if (profIdx === 0) {
        addBoxTo(head, 0.68, 0.06, 0.68, 0xeab308, 0, 0.52, 0, false, 0.85, 'wool');
        addBoxTo(head, 0.48, 0.14, 0.48, 0xca8a04, 0, 0.60, 0, false, 0.85, 'wool');
        addBoxTo(head, 0.50, 0.05, 0.50, 0xdc2626, 0, 0.56, 0);
      } else {
        addBoxTo(head, 0.52, 0.14, 0.52, robe, 0, 0.54, 0, false, 0.84, 'wool');
        addBoxTo(head, 0.54, 0.05, 0.54, 0xfacc15, 0, 0.49, 0);
      }
      const armPiv = makePivot(g, 0, 1.18, 0); anim.arms.push({ p: armPiv, dir: 1, isFolded: true });
      addBoxTo(armPiv, 0.18, 0.42, 0.22, robe, -0.34, -0.12, 0.06, false, 0.84, 'wool');
      addBoxTo(armPiv, 0.18, 0.42, 0.22, robe, 0.34, -0.12, 0.06, false, 0.84, 'wool');
      addBoxTo(armPiv, 0.68, 0.22, 0.24, robe, 0, -0.22, 0.18, false, 0.84, 'wool');
      addBoxTo(armPiv, 0.22, 0.16, 0.18, 0xdca782, 0, -0.22, 0.22);
      for (const [sx, d] of [[-0.14, 1], [0.14, -1]]) {
        const leg = makePivot(g, sx, 0.64, 0); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.22, 0.54, 0.24, 0x3f2a1d, 0, -0.27, 0);
        addBoxTo(leg, 0.24, 0.12, 0.28, 0x1c130d, 0, -0.58, 0.02);
      }
    } else if (type === 'iron_golem') {
      addBoxTo(g, 1.16, 0.98, 0.66, 0xdbe4ee, 0, 1.64, 0, false, 0.52, 'stone');
      addBoxTo(g, 0.34, 0.28, 0.72, 0x94a3b8, -0.52, 1.96, 0, false, 0.48, 'stone');
      addBoxTo(g, 0.34, 0.28, 0.72, 0x94a3b8,  0.52, 1.96, 0, false, 0.48, 'stone');
      addBoxTo(g, 0.26, 0.26, 0.70, 0xf59e0b, 0, 1.66, 0, true);
      addBoxTo(g, 0.70, 0.38, 0.46, 0x94a3b8, 0, 1.04, 0, false, 0.55, 'stone');
      addBoxTo(g, 0.26, 0.64, 0.68, 0x4d7c0f, -0.34, 1.62, 0.01);
      addBoxTo(g, 0.22, 0.40, 0.68, 0x65a30d,  0.36, 1.78, 0.01);
      addBoxTo(g, 0.12, 0.14, 0.12, 0xdc2626, -0.46, 2.16, 0.14, true);
      const head = makePivot(g, 0, 2.14, 0.08); anim.head = head;
      addArtBox(head, 0.54, 0.60, 0.54, 'fb_igolem_head', (ctx, h) => {
        h.fillAll(0xe2e8f0, 14, 'stone', 12, -18);
        h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0xef4444, browCol: 0x475569 });
      }, 0, 0.30, 0, { rough: 0.52 });
      addBoxTo(head, 0.14, 0.24, 0.16, 0x94a3b8, 0, 0.15, 0.29, false, 0.52, 'stone');
      for (const [sx, d] of [[-0.74, 1], [0.74, -1]]) {
        const arm = makePivot(g, sx, 2.02, 0); anim.arms.push({ p: arm, dir: d });
        addBoxTo(arm, 0.30, 1.42, 0.34, 0xcbd5e1, 0, -0.68, 0, false, 0.52, 'stone');
        addBoxTo(arm, 0.34, 0.26, 0.38, 0x94a3b8, 0, -1.32, 0, false, 0.48, 'stone');
      }
      for (const [sx, d] of [[-0.28, 1], [0.28, -1]]) {
        const leg = makePivot(g, sx, 0.94, 0); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.36, 0.94, 0.38, 0x94a3b8, 0, -0.47, 0, false, 0.55, 'stone');
      }
    } else if (type === 'wolf') {
      addBoxTo(g, 0.46, 0.42, 0.82, 0xd6d3d1, 0, 0.48, 0, false, 0.86, 'fur');
      addBoxTo(g, 0.54, 0.50, 0.36, 0xb8b2ac, 0, 0.52, 0.26, false, 0.88, 'fur');
      addBoxTo(g, 0.38, 0.12, 0.64, 0xf5f5f4, 0, 0.32, 0.04, false, 0.86, 'fur');
      addBoxTo(g, 0.48, 0.12, 0.14, 0xdc2626, 0, 0.54, 0.40);
      const head = makePivot(g, 0, 0.58, 0.44); anim.head = head;
      addArtBox(head, 0.42, 0.38, 0.38, 'fb_wolf_head', (ctx, h) => {
        h.fillAll(0xd6d3d1, 12, 'fur', 12, -16);
        h.px(4, 2, 10, 12, 6, 0xf5f5f4);
        h.cuteFace(4, { eyeY: 6, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x18181b, sclera: 0xfef08a, sparkle: true });
      }, 0, 0.04, 0.16, { rough: 0.84 });
      addBoxTo(head, 0.22, 0.18, 0.22, 0xf5f5f4, 0, -0.04, 0.38, false, 0.84, 'fur');
      addBoxTo(head, 0.09, 0.07, 0.05, 0x18181b, 0, 0.02, 0.50);
      addBoxTo(head, 0.12, 0.16, 0.07, 0x78716c, -0.14, 0.26, 0.10, false, 0.84, 'fur');
      addBoxTo(head, 0.12, 0.16, 0.07, 0x78716c,  0.14, 0.26, 0.10, false, 0.84, 'fur');
      const tail = makePivot(g, 0, 0.54, -0.40); anim.tail = tail;
      addBoxTo(tail, 0.16, 0.16, 0.46, 0xa8a29e, 0, 0.04, -0.22, false, 0.86, 'fur');
      addBoxTo(tail, 0.14, 0.14, 0.14, 0xf5f5f4, 0, 0.04, -0.45, false, 0.86, 'fur');
      for (const [sx, sz, d] of [[-0.14, 0.28, 1], [0.14, 0.28, -1], [-0.14, -0.28, -1], [0.14, -0.28, 1]]) {
        const leg = makePivot(g, sx, 0.34, sz); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.14, 0.34, 0.14, 0xc7c2bc, 0, -0.17, 0, false, 0.86, 'fur');
      }
    } else if (type === 'husk') {
      addBoxTo(g, 0.56, 0.74, 0.30, 0x9c865b, 0, 1.06, 0, false, 0.88, 'wool');
      addBoxTo(g, 0.60, 0.22, 0.34, 0x78623d, 0, 0.80, 0, false, 0.88, 'wool');
      addBoxTo(g, 0.62, 0.16, 0.36, 0xd97706, 0, 1.36, 0);
      const head = makePivot(g, 0, 1.44, 0); anim.head = head;
      addArtBox(head, 0.48, 0.48, 0.48, 'fb_husk_head', (ctx, h) => {
        h.fillAll(0xbfa778, 14, 'stone', 10, -18);
        h.px(4, 0, 1, 16, 3, 0xca8a04);
        h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x3b2f1c, noseY: 11, noseW: 4, noseH: 1, noseCol: 0x5c4729 });
      }, 0, 0.24, 0);
      addBoxTo(head, 0.10, 0.10, 0.06, 0x38bdf8, 0, 0.42, 0.25, true);
      for (const [sx, d] of [[-0.38, 1], [0.38, -1]]) {
        const arm = makePivot(g, sx, 1.34, 0); anim.arms.push({ p: arm, dir: d });
        addBoxTo(arm, 0.20, 0.20, 0.70, 0xb29a6c, 0, 0, 0.28);
      }
      for (const [sx, d] of [[-0.14, 1], [0.14, -1]]) {
        const leg = makePivot(g, sx, 0.70, 0); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.22, 0.70, 0.24, 0x6e5936, 0, -0.35, 0);
      }
    } else if (type === 'stray') {
      addBoxTo(g, 0.48, 0.74, 0.28, 0x334155, 0, 1.06, 0, false, 0.84, 'wool');
      addBoxTo(g, 0.56, 0.28, 0.34, 0x475569, 0, 1.28, 0, false, 0.84, 'wool');
      addBoxTo(g, 0.16, 0.46, 0.16, 0x78350f, 0.22, 1.24, -0.18);
      const head = makePivot(g, 0, 1.44, 0); anim.head = head;
      addArtBox(head, 0.46, 0.46, 0.46, 'fb_stray_head', (ctx, h) => {
        h.fillAll(0xcbd5e1, 14, 'stone', 12, -16);
        h.capOverhang(4, 0x475569, 0x334155, 4, 2);
        h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, noseY: 11, noseW: 4, noseH: 1, noseCol: 0x475569 });
      }, 0, 0.23, 0);
      addBoxTo(head, 0.12, 0.18, 0.12, 0x38bdf8, 0, 0.50, 0, true);
      addBoxTo(head, 0.10, 0.06, 0.04, 0x38bdf8, -0.11, 0.22, 0.24, true);
      addBoxTo(head, 0.10, 0.06, 0.04, 0x38bdf8,  0.11, 0.22, 0.24, true);
      for (const [sx, d] of [[-0.34, 1], [0.34, -1]]) {
        const arm = makePivot(g, sx, 1.32, 0); anim.arms.push({ p: arm, dir: d });
        addBoxTo(arm, 0.14, 0.14, 0.66, 0x94a3b8, 0, 0, 0.26, false, 0.72, 'stone');
      }
      for (const [sx, d] of [[-0.12, 1], [0.12, -1]]) {
        const leg = makePivot(g, sx, 0.70, 0); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.15, 0.70, 0.15, 0x94a3b8, 0, -0.35, 0, false, 0.72, 'stone');
      }
    } else if (type === 'slime' || type === 'sulfur_slime') {
      anim.torso = makePivot(g, 0, 0, 0);
      if (type === 'sulfur_slime') {
        anim.slimeCore = makePivot(anim.torso, 0, 0.44, 0);
        addArtBox(anim.slimeCore, 0.54, 0.52, 0.54, 'fb_sulfur_slime_core_v2', (ctx, h) => {
          h.fillAll(0xeab308, 12, 'crystal', 16, -16);
          for (const t of [0, 1, 2, 5]) h.spots(t, 0xf59e0b, [[2, 2, 4, 3], [9, 6, 4, 4], [4, 10, 5, 3]]);
          h.px(4, 2, 10, 12, 3, 0xb45309);
          h.cuteFace(4, { eyeY: 5, eyeSep: 3, eyeW: 2, eyeH: 3, eyeCol: 0x3b1203, sparkle: true, noseY: 11, noseW: 4, noseH: 1, noseCol: 0x3b1203 });
        }, 0, 0, 0, { rough: 0.32, emissive: 0xd97706, emissiveIntensity: 0.42 });
        anim.slimeBubbles = [
          { m: addBoxTo(anim.slimeCore, 0.11, 0.11, 0.11, 0xfef08a, -0.22, 0.14, 0.18, true), by: 0.14 },
          { m: addBoxTo(anim.slimeCore, 0.09, 0.09, 0.09, 0xfde047,  0.24, -0.10, -0.14, true), by: -0.10 },
          { m: addBoxTo(anim.slimeCore, 0.10, 0.10, 0.10, 0xfb923c, -0.18, -0.14, -0.20, true), by: -0.14 },
          { m: addBoxTo(anim.slimeCore, 0.08, 0.08, 0.08, 0xfefce8,  0.20, 0.18, 0.16, true), by: 0.18 }
        ];
        const outerMesh = addArtBox(anim.torso, 0.94, 0.88, 0.94, 'fb_sulfur_slime_outer_v2', (ctx, h) => {
          h.fillAll(0xfacc15, 10, 'crystal', 14, -14);
          for (const t of [0, 1, 2, 4, 5]) {
            h.px(t, 0, 0, 16, 3, 0xfef08a);
            h.px(t, 0, 12, 16, 4, 0xeab308);
            h.px(t, 2, 2, 3, 3, 0xfefce8);
          }
          h.px(2, 3, 3, 10, 10, 0xfef08a);
        }, 0, 0.45, 0, { rough: 0.14, transparent: true, opacity: 0.64, emissive: 0xca8a04, emissiveIntensity: 0.28 });
        if (outerMesh && outerMesh.material) { outerMesh.material.depthWrite = false; outerMesh.renderOrder = 4; }
        const skirtMesh = addArtBox(anim.torso, 1.00, 0.12, 1.00, 'fb_sulfur_slime_skirt_v2', (ctx, h) => {
          h.fillAll(0xeab308, 10, 'crystal', 12, -12);
          for (const t of [0, 1, 4, 5]) h.px(t, 1, 0, 14, 5, 0xfde047);
        }, 0, 0.06, 0, { rough: 0.18, transparent: true, opacity: 0.54, emissive: 0xb45309, emissiveIntensity: 0.22 });
        if (skirtMesh && skirtMesh.material) { skirtMesh.material.depthWrite = false; skirtMesh.renderOrder = 3; }
        const bud1 = addBoxTo(anim.torso, 0.14, 0.18, 0.14, 0xfde047, 0.16, 0.91, -0.10, true);
        if (bud1) bud1.rotation.set(0.18, 0, -0.22);
        const bud2 = addBoxTo(anim.torso, 0.10, 0.13, 0.10, 0xfef08a, -0.18, 0.89, 0.12, true);
        if (bud2) bud2.rotation.set(-0.20, 0, 0.24);
      } else {
        const slimeOuter = addArtBox(anim.torso, 0.90, 0.90, 0.90, 'fb_slime_outer', (ctx, h) => {
          h.fillAll(0x4ade80, 12, 'crystal', 18, -18);
          h.cuteFace(4, { eyeY: 5, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x052e16, sparkle: true, noseY: 10, noseW: 2, noseH: 2, noseCol: 0x052e16 });
        }, 0, 0.45, 0, { rough: 0.22, transparent: true, opacity: 0.72, emissive: 0x064e3b, emissiveIntensity: 0.22 });
        if (slimeOuter && slimeOuter.material) { slimeOuter.material.depthWrite = false; slimeOuter.renderOrder = 4; }
        addBoxTo(anim.torso, 0.56, 0.56, 0.56, 0x16a34a, 0, 0.45, 0, false, 0.40, 'crystal');
      }
    } else if (type === 'wither_knight') {
      addBoxTo(g, 0.66, 0.90, 0.38, 0x18181b, 0, 1.24, 0, false, 0.42, 'stone');
      addBoxTo(g, 0.84, 0.26, 0.44, 0x27272a, 0, 1.58, 0, false, 0.40, 'stone');
      addBoxTo(g, 0.58, 0.92, 0.06, 0x7f1d1d, 0, 1.16, -0.22, false, 0.82, 'wool');
      addBoxTo(g, 0.18, 0.24, 0.06, 0xc026d3, 0, 1.32, 0.21, true);
      const head = makePivot(g, 0, 1.72, 0); anim.head = head;
      addArtBox(head, 0.50, 0.50, 0.50, 'fb_wknight_head', (ctx, h) => {
        h.fillAll(0x27272a, 14, 'stone', 10, -14);
        h.px(4, 2, 6, 12, 4, 0x09090b);
        h.px(4, 3, 7, 3, 2, 0xf43f5e); h.px(4, 10, 7, 3, 2, 0xf43f5e);
      }, 0, 0.25, 0, { rough: 0.42 });
      addBoxTo(head, 0.12, 0.28, 0.12, 0x18181b, -0.24, 0.56, 0.04, false, 0.45, 'stone');
      addBoxTo(head, 0.12, 0.28, 0.12, 0x18181b,  0.24, 0.56, 0.04, false, 0.45, 'stone');
      for (const [sx, d] of [[-0.46, 1], [0.46, -1]]) {
        const arm = makePivot(g, sx, 1.62, 0); anim.arms.push({ p: arm, dir: d });
        addBoxTo(arm, 0.22, 0.76, 0.24, 0x27272a, 0, -0.34, 0, false, 0.45, 'stone');
        if (sx > 0) {
          addBoxTo(arm, 0.30, 0.08, 0.16, 0xfacc15, 0, -0.34, 0.34, false, 0.35);
          addBoxTo(arm, 0.09, 0.98, 0.16, 0x9333ea, 0, -0.82, 0.36, true);
        }
      }
      for (const [sx, d] of [[-0.16, 1], [0.16, -1]]) {
        const leg = makePivot(g, sx, 0.80, 0); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.24, 0.80, 0.26, 0x18181b, 0, -0.40, 0, false, 0.45, 'stone');
      }
    } else if (type === 'fox') {
      const isArctic = getBiomeAt(wx, wz) === BIOMES.SNOW;
      const fur = isArctic ? 0xf8fafc : 0xe86b24, belly = isArctic ? 0xe2e8f0 : 0xfff7ed, dark = isArctic ? 0x94a3b8 : 0x292524;
      addBoxTo(g, 0.46, 0.38, 0.76, fur, 0, 0.42, 0, false, 0.86, 'fur');
      addBoxTo(g, 0.38, 0.14, 0.56, belly, 0, 0.28, 0.06, false, 0.86, 'fur');
      const head = makePivot(g, 0, 0.52, 0.38); anim.head = head;
      addArtBox(head, 0.40, 0.34, 0.36, isArctic ? 'fb_fox_snow' : 'fb_fox_red', (ctx, h) => {
        h.fillAll(fur, 12, 'fur', 12, -16);
        h.px(4, 0, 10, 16, 6, belly);
        h.cuteFace(4, { eyeY: 7, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x111827, sparkle: true, blushCol: isArctic ? 0xfbcfe8 : 0xfb923c });
      }, 0, 0.04, 0.16, { rough: 0.84 });
      addBoxTo(head, 0.20, 0.14, 0.18, belly, 0, -0.02, 0.36, false, 0.84, 'fur');
      addBoxTo(head, 0.07, 0.05, 0.04, 0x18181b, 0, 0.02, 0.45);
      addBoxTo(head, 0.12, 0.14, 0.06, dark, -0.13, 0.24, 0.12, false, 0.84, 'fur');
      addBoxTo(head, 0.12, 0.14, 0.06, dark,  0.13, 0.24, 0.12, false, 0.84, 'fur');
      const tail = makePivot(g, 0, 0.46, -0.38); anim.tail = tail;
      addBoxTo(tail, 0.22, 0.20, 0.44, fur, 0, 0, -0.22, false, 0.86, 'fur');
      addBoxTo(tail, 0.20, 0.18, 0.14, belly, 0, 0, -0.45, false, 0.86, 'fur');
      for (const [sx, sz, d] of [[-0.14, 0.24, 1], [0.14, 0.24, -1], [-0.14, -0.24, -1], [0.14, -0.24, 1]]) {
        const leg = makePivot(g, sx, 0.26, sz); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.12, 0.26, 0.12, dark, 0, -0.13, 0, false, 0.86);
      }
    } else if (type === 'cow') {
      addArtBox(g, 0.74, 0.62, 1.04, 'fb_cow_body', (ctx, h) => {
        h.fillAll(0x523725, 12, 'fur', 10, -16);
        for (const t of [0, 1, 2, 5]) h.spots(t, 0xf1f5f9, [[2, 2, 5, 5], [10, 7, 5, 5], [4, 11, 4, 4]]);
      }, 0, 0.72, 0, { rough: 0.84 });
      addBoxTo(g, 0.30, 0.12, 0.28, 0xf2b5c4, 0, 0.40, -0.22);
      const head = makePivot(g, 0, 0.94, 0.54); anim.head = head;
      addArtBox(head, 0.48, 0.44, 0.42, 'fb_cow_head', (ctx, h) => {
        h.fillAll(0x523725, 12, 'fur', 10, -16);
        h.px(4, 6, 1, 5, 5, 0xf1f5f9);
        h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x111111, sclera: 0xffffff, sparkle: true });
      }, 0, 0.04, 0.18, { rough: 0.82 });
      addArtBox(head, 0.36, 0.18, 0.12, 'fb_cow_snout', (ctx, h) => {
        h.fillTile(0, 0xd4b2a3, 8);
        h.px(0, 3, 5, 3, 4, 0x3b2618); h.px(0, 10, 5, 3, 4, 0x3b2618);
      }, 0, -0.07, 0.41, { atlas: false, rough: 0.80 });
      addBoxTo(head, 0.08, 0.16, 0.08, 0xe8e2d0, -0.24, 0.26, 0.18);
      addBoxTo(head, 0.08, 0.16, 0.08, 0xe8e2d0,  0.24, 0.26, 0.18);
      const tail = makePivot(g, 0, 0.86, -0.52); anim.tail = tail;
      addBoxTo(tail, 0.07, 0.34, 0.07, 0x3b2618, 0, -0.15, -0.03);
      for (const [sx, sz, d] of [[-0.22, 0.34, 1], [0.22, 0.34, -1], [-0.22, -0.34, -1], [0.22, -0.34, 1]]) {
        const leg = makePivot(g, sx, 0.44, sz); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.18, 0.34, 0.18, 0x523725, 0, -0.17, 0, false, 0.84, 'fur');
        addBoxTo(leg, 0.19, 0.10, 0.19, 0x1f1916, 0, -0.39, 0);
      }
    } else if (type === 'sheep') {
      const wHex = _sheepSpec ? _sheepSpec.hexInt : 0xf4f6f9;
      addBoxTo(g, 0.76, 0.62, 0.96, wHex, 0, 0.68, 0, false, 0.94, 'wool');
      addBoxTo(g, 0.18, 0.18, 0.14, wHex, 0, 0.72, -0.50, false, 0.94, 'wool');
      const head = makePivot(g, 0, 0.84, 0.46); anim.head = head;
      addArtBox(head, 0.42, 0.38, 0.42, `fb_sheep_head_${_sheepSpec ? _sheepSpec.key : 'white'}`, (ctx, h) => {
        h.fillAll(0xdcbba4, 10, 'voxel', 10, -14);
        h.capOverhang(4, wHex, 0xe2e8f0, 4, 2);
        h.cuteFace(4, { eyeY: 7, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x1e293b, sclera: 0xffffff, sparkle: true, noseY: 11, noseW: 4, noseH: 2, noseCol: 0xc29880, blushCol: 0xf4a3b4 });
      }, 0, 0.02, 0.18, { rough: 0.84 });
      addBoxTo(head, 0.46, 0.16, 0.38, wHex, 0, 0.20, 0.14, false, 0.94, 'wool');
      for (const [sx, sz, d] of [[-0.20, 0.28, 1], [0.20, 0.28, -1], [-0.20, -0.28, -1], [0.20, -0.28, 1]]) {
        const leg = makePivot(g, sx, 0.42, sz); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.20, 0.16, 0.20, wHex, 0, -0.06, 0, false, 0.94, 'wool');
        addBoxTo(leg, 0.15, 0.22, 0.15, 0xc9ab93, 0, -0.25, 0);
        addBoxTo(leg, 0.16, 0.08, 0.16, 0x3b302a, 0, -0.38, 0);
      }
    } else if (type === 'chicken') {
      addBoxTo(g, 0.40, 0.36, 0.48, 0xf8fafc, 0, 0.42, 0, false, 0.84, 'fur');
      addBoxTo(g, 0.26, 0.22, 0.16, 0xe2e8f0, 0, 0.50, -0.24, false, 0.84, 'fur');
      const head = makePivot(g, 0, 0.56, 0.20); anim.head = head;
      addArtBox(head, 0.26, 0.28, 0.26, 'fb_chicken_head', (ctx, h) => {
        h.fillAll(0xffffff, 8, 'fur', 6, -14);
        h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x111111, sparkle: true, blushCol: 0xfca5a5 });
      }, 0, 0.12, 0.06, { rough: 0.82 });
      addBoxTo(head, 0.08, 0.08, 0.16, 0xdc2626, 0, 0.28, 0.06);
      addBoxTo(head, 0.14, 0.08, 0.14, 0xf59e0b, 0, 0.10, 0.22);
      addBoxTo(head, 0.08, 0.10, 0.08, 0xdc2626, 0, 0.02, 0.18);
      for (const sx of [-1, 1]) {
        const wing = makePivot(g, sx * 0.21, 0.52, 0); anim.wings.push({ p: wing, dir: sx });
        addBoxTo(wing, 0.06, 0.22, 0.34, 0xe2e8f0, sx * 0.02, -0.10, 0, false, 0.84, 'fur');
        const leg = makePivot(g, sx * 0.10, 0.26, 0); anim.legs.push({ p: leg, dir: sx });
        addBoxTo(leg, 0.05, 0.22, 0.05, 0xf59e0b, 0, -0.11, 0);
        addBoxTo(leg, 0.12, 0.04, 0.14, 0xd97706, 0, -0.24, 0.04);
      }
    } else if (type === 'pig' || type === 'boar') {
      // Cute chunky Pig
      addBoxTo(g, 0.64, 0.52, 0.86, 0xf4a3b4, 0, 0.54, 0, false, 0.82);
      addBoxTo(g, 0.56, 0.08, 0.76, 0xe58ca0, 0, 0.82, 0, false, 0.82);
      const head = makePivot(g, 0, 0.66, 0.40); anim.head = head;
      addArtBox(head, 0.48, 0.44, 0.44, 'fb_pig_head', (ctx, h) => {
        h.fillAll(0xf4a3b4, 10, 'voxel', 10, -14);
        h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x18181b, sclera: 0xffffff, sparkle: true, blushCol: 0xf472b6 });
      }, 0, 0.02, 0.18, { rough: 0.80 });
      addArtBox(head, 0.24, 0.16, 0.12, 'fb_pig_snout', (ctx, h) => {
        h.fillTile(0, 0xe8879d, 8);
        h.px(0, 3, 5, 3, 5, 0x7a3444); h.px(0, 10, 5, 3, 5, 0x7a3444);
      }, 0, -0.05, 0.465, { atlas: false, rough: 0.78 });
      const tail = makePivot(g, 0, 0.62, -0.44); anim.tail = tail;
      addBoxTo(tail, 0.08, 0.08, 0.10, 0xe07a90, 0, 0, -0.05);
      for (const [sx, sz, d] of [[-0.20, 0.26, 1], [0.20, 0.26, -1], [-0.20, -0.26, -1], [0.20, -0.26, 1]]) {
        const leg = makePivot(g, sx, 0.28, sz); anim.legs.push({ p: leg, dir: d });
        addBoxTo(leg, 0.17, 0.20, 0.17, 0xeb92a6, 0, -0.10, 0, false, 0.82);
        addBoxTo(leg, 0.17, 0.08, 0.17, 0x9e5466, 0, -0.24, 0, false, 0.85);
      }
    } else {
      // Archetype-matched voxel fallback (while GLB streams or offline; never renders as a grey slime cube!)
      const stFb = (typeof MOB_STATS !== 'undefined' && MOB_STATS[type]) || {};
      const FB_PAL = {
        creeper: [0x4ade80, 0x15803d, 0x052e16], charged_creeper: [0x67e8f9, 0x0284c7, 0x0f172a],
        icy_creeper: [0x7dd3fc, 0x0369a1, 0x0f172a], potato_creeper: [0xfacc15, 0xa16207, 0x422006],
        nerd_creeper: [0x4ade80, 0xf8fafc, 0x111827], ghost_creeper: [0xd1fae5, 0x6ee7b7, 0x064e3b],
        spider: [0x292524, 0x44403c, 0xef4444], chorus_crawler: [0x6b21a8, 0xa855f7, 0xf0abfc],
        endermite: [0x4c1d95, 0x7c3aed, 0xf472b6], enderman: [0x18181b, 0x27272a, 0xd946ef],
        void_stalker: [0x1e1b4b, 0x312e81, 0xe879f9], ghast: [0xf8fafc, 0xe2e8f0, 0xef4444],
        blaze: [0xf59e0b, 0xfacc15, 0x7c2d12], wither: [0x18181b, 0x3f3f46, 0xe2e8f0],
        wither_skeleton: [0x27272a, 0x18181b, 0xe2e8f0], piglin: [0xd97757, 0x92400e, 0xfacc15],
        piglin_brute: [0x9a3412, 0x1c1917, 0xfacc15], zombified_piglin: [0x84cc16, 0x92400e, 0xfacc15],
        hoglin: [0xb45309, 0xfde68a, 0x451a03], zoglin: [0x7c2d12, 0x84cc16, 0x451a03],
        zombie_horse: [0x65a30d, 0x3f6212, 0x111827], ravager: [0x57534e, 0x292524, 0xfef3c7],
        copper_golem: [0xc2612b, 0x2dd4bf, 0x38bdf8], rascal: [0x0d9488, 0xf97316, 0x0f172a],
        glare_mob: [0x3f6212, 0x84cc16, 0xfacc15], snow_golem: [0xf8fafc, 0xf97316, 0x18181b],
        breeze: [0xa5b4fc, 0x6366f1, 0xe0e7ff], creaking: [0x44403c, 0x292524, 0xf97316],
        shulker: [0x9333ea, 0xc084fc, 0xfef08a], drowned: [0x0d9488, 0x115e59, 0x67e8f9],
        guardian: [0x0d9488, 0xf97316, 0xef4444], witch: [0x581c87, 0x3b0764, 0x22c55e],
        iceologer: [0x1d4ed8, 0x93c5fd, 0x38bdf8], ruin_stalker: [0x334155, 0x64748b, 0x38bdf8],
        gargoyle: [0x64748b, 0x475569, 0xf59e0b], phantom_drake: [0x1e3a8a, 0x3b82f6, 0x4ade80],
        end_phantom: [0x4c1d95, 0x7c3aed, 0xf0abfc], soul_wisp: [0x06b6d4, 0x67e8f9, 0xe0f2fe],
        void_golem: [0x312e81, 0x6d28d9, 0xe879f9], magma_golem: [0x44403c, 0xf97316, 0xfacc15],
        sculk_stalker: [0x0f172a, 0x0e7490, 0x22d3ee], sculk_brute: [0x0f172a, 0x155e75, 0x22d3ee],
        sculk_sentinel: [0x0f172a, 0x0891b2, 0x67e8f9], sculk_soul_ravager: [0x0f172a, 0x0e7490, 0x67e8f9]
      };
      const [cMain, cAcc, cEye] = FB_PAL[type] || [0x64748b, 0x475569, 0x38bdf8];
      if (type === 'spider' || type === 'chorus_crawler' || type === 'endermite') {
        anim.torso = makePivot(g, 0, 0.34, 0);
        addBoxTo(anim.torso, 0.56, 0.34, 0.72, cMain, 0, 0, -0.08);
        anim.head = makePivot(anim.torso, 0, 0, 0.34);
        addBoxTo(anim.head, 0.40, 0.30, 0.34, cAcc, 0, 0, 0.14);
        addBoxTo(anim.head, 0.08, 0.07, 0.04, cEye, -0.10, 0.04, 0.32, true);
        addBoxTo(anim.head, 0.08, 0.07, 0.04, cEye,  0.10, 0.04, 0.32, true);
        for (const sx of [-1, 1]) for (let li = 0; li < 3; li++) {
          const leg = makePivot(g, sx * 0.28, 0.32, (li - 1) * 0.22);
          addBoxTo(leg, 0.44, 0.09, 0.09, cMain, sx * 0.22, -0.10, 0);
          anim.legs.push({ p: leg, dir: ((li & 1) ? 1 : -1) * sx, isSpider: true });
        }
      } else if (stFb.flying || type === 'ghast' || type === 'blaze' || type === 'wither' || type === 'glare_mob' || type === 'soul_wisp') {
        anim.torso = makePivot(g, 0, 0.72, 0);
        addBoxTo(anim.torso, 0.58, 0.54, 0.58, cMain, 0, 0, 0);
        addBoxTo(anim.torso, 0.10, 0.09, 0.04, cEye, -0.14, 0.06, 0.30, true);
        addBoxTo(anim.torso, 0.10, 0.09, 0.04, cEye,  0.14, 0.06, 0.30, true);
        for (const sx of [-1, 1]) {
          const wp = makePivot(anim.torso, sx * 0.30, 0.06, 0);
          addBoxTo(wp, 0.42, 0.08, 0.32, cAcc, sx * 0.21, 0, 0);
          anim.wings.push({ p: wp, dir: sx });
        }
      } else if (type === 'ravager' || type === 'hoglin' || type === 'zoglin' || type === 'zombie_horse') {
        anim.torso = makePivot(g, 0, 0.66, 0);
        addBoxTo(anim.torso, 0.66, 0.52, 0.96, cMain, 0, 0, 0);
        anim.head = makePivot(anim.torso, 0, 0.16, 0.50);
        addBoxTo(anim.head, 0.46, 0.42, 0.44, cAcc, 0, 0.04, 0.16);
        addBoxTo(anim.head, 0.08, 0.08, 0.04, cEye, -0.12, 0.08, 0.39, true);
        addBoxTo(anim.head, 0.08, 0.08, 0.04, cEye,  0.12, 0.08, 0.39, true);
        for (const [lx, lz, d] of [[-0.22, 0.30, 1], [0.22, 0.30, -1], [-0.22, -0.30, -1], [0.22, -0.30, 1]]) {
          const leg = makePivot(g, lx, 0.42, lz);
          addBoxTo(leg, 0.16, 0.42, 0.16, cAcc, 0, -0.21, 0);
          anim.legs.push({ p: leg, dir: d });
        }
      } else if (stFb.aqua || type === 'guardian') {
        anim.torso = makePivot(g, 0, 0.45, 0);
        addBoxTo(anim.torso, 0.56, 0.52, 0.62, cMain, 0, 0, 0);
        addBoxTo(anim.torso, 0.18, 0.14, 0.04, cEye, 0, 0.02, 0.32, true);
        anim.tail = makePivot(anim.torso, 0, 0, -0.32);
        addBoxTo(anim.tail, 0.12, 0.30, 0.36, cAcc, 0, 0, -0.18);
      } else {
        const isTall = (type === 'enderman' || type === 'void_stalker' || type.startsWith('sculk_'));
        const legH = isTall ? 0.92 : 0.62, bodyH = isTall ? 0.72 : 0.62;
        anim.torso = makePivot(g, 0, legH + bodyH * 0.5, 0);
        addBoxTo(anim.torso, 0.46, bodyH, 0.28, cMain, 0, 0, 0);
        anim.head = makePivot(anim.torso, 0, bodyH * 0.5, 0);
        addBoxTo(anim.head, 0.44, 0.44, 0.44, cAcc, 0, 0.22, 0);
        addBoxTo(anim.head, 0.09, 0.07, 0.04, cEye, -0.11, 0.24, 0.23, true);
        addBoxTo(anim.head, 0.09, 0.07, 0.04, cEye,  0.11, 0.24, 0.23, true);
        for (const [sx, d] of [[-0.33, 1], [0.33, -1]]) {
          const arm = makePivot(anim.torso, sx, bodyH * 0.38, 0);
          addBoxTo(arm, 0.18, isTall ? 0.82 : 0.54, 0.18, cMain, 0, isTall ? -0.38 : -0.24, 0);
          anim.arms.push({ p: arm, dir: d });
        }
        for (const [lx, d] of [[-0.13, 1], [0.13, -1]]) {
          const leg = makePivot(g, lx, legH, 0);
          addBoxTo(leg, 0.18, legH, 0.20, cAcc, 0, -legH * 0.5, 0);
          anim.legs.push({ p: leg, dir: d });
        }
      }
      const res = finishMob();
      if (_hasGlbAsset(type)) {
        res.isPlaceholder = true;
        res.pendingGlbKey = _resolveGlbKey(type);
      }
      return res;
    }
    return finishMob();
  }

  // Shared Zero-Leak 3D Extruded Pixel-Art Minecraft Bow Geometries & Material (Idle vs Drawn w/ Arrow!)
  let _skelBowIdleGeo = null, _skelBowDrawnGeo = null, _skelBowMat = null;
  function _buildExtrudedPixelGeo(rows, pal, px, halfD, ox, oy, oz, plane = 'yx') {
    const H = rows.length, W = rows[0].length;
    const isSolid = (x, y) => (x >= 0 && x < W && y >= 0 && y < H && rows[y][x] !== '.');
    const pos = [], norm = [], cols = [], idx = [];
    let vc = 0;
    const cTmp = new THREE.Color();
    const pushQuad = (a, b, c, d, n, r, g, bl) => {
      pos.push(...a, ...b, ...c, ...d); norm.push(...n, ...n, ...n, ...n);
      cols.push(r, g, bl, r, g, bl, r, g, bl, r, g, bl);
      idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3); vc += 4;
    };
    const pt = (u, v, w) => (
      plane === 'yz' ? [-w, oy + v, oz + u]
      : (plane === 'yz_aim' ? [-w, oy - u, oz + v] : [ox + u, oy + v, oz + w])
    );
    const nVec = (nx, ny, nz) => (
      plane === 'yz' ? [-nz, ny, nx]
      : (plane === 'yz_aim' ? [-nz, -nx, ny] : [nx, ny, nz])
    );
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isSolid(x, y)) continue;
      cTmp.setHex(pal[rows[y][x]] ?? 0x6b421b);
      const r = cTmp.r, g = cTmp.g, bl = cTmp.b;
      const u0 = x * px, u1 = u0 + px, v0 = (H - y - 1) * px, v1 = v0 + px;
      const z0 = -halfD, z1 = halfD;
      pushQuad(pt(u0,v0,z1), pt(u1,v0,z1), pt(u1,v1,z1), pt(u0,v1,z1), nVec(0,0,1), r, g, bl);
      pushQuad(pt(u1,v0,z0), pt(u0,v0,z0), pt(u0,v1,z0), pt(u1,v1,z0), nVec(0,0,-1), r*0.92, g*0.92, bl*0.92);
      if (!isSolid(x, y - 1)) pushQuad(pt(u0,v1,z1), pt(u1,v1,z1), pt(u1,v1,z0), pt(u0,v1,z0), nVec(0,1,0), Math.min(1,r*1.08), Math.min(1,g*1.08), Math.min(1,bl*1.08));
      if (!isSolid(x, y + 1)) pushQuad(pt(u0,v0,z0), pt(u1,v0,z0), pt(u1,v0,z1), pt(u0,v0,z1), nVec(0,-1,0), r*0.76, g*0.76, bl*0.76);
      if (!isSolid(x + 1, y)) pushQuad(pt(u1,v0,z1), pt(u1,v0,z0), pt(u1,v1,z0), pt(u1,v1,z1), nVec(1,0,0), r*0.88, g*0.88, bl*0.88);
      if (!isSolid(x - 1, y)) pushQuad(pt(u0,v0,z0), pt(u0,v0,z1), pt(u0,v1,z1), pt(u0,v1,z0), nVec(-1,0,0), r*0.84, g*0.84, bl*0.84);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }
  function _getSkelBowMeshes() {
    if (!_skelBowMat) {
      _skelBowMat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.68, metalness: 0.05, side: THREE.FrontSide,
        emissive: new THREE.Color(0x1f140a), emissiveIntensity: 0.16
      });
      _skelBowMat.userData = { sharedMat: true, baseEmissive: new THREE.Color(0x1f140a), baseEmissiveInt: 0.16 };
    }
    const pal = {
      d: 0x422610, w: 0x6b3e19, m: 0x965b26, g: 0xc9924c, // warm deep oak outline, rich oak, mid oak, tan grip
      s: 0x94a3b8, l: 0xcbd5e1,                           // clearly visible stepped grey bowstring
      a: 0xd9a13b, q: 0xa67122, f: 0xf1f5f9, t: 0x64748b, k: 0xe2e8f0 // golden arrow, white fletching, silver-grey flint tip
    };
    if (!_skelBowIdleGeo) {
      // Relaxed held 3D Bow (Images 2, 3, 4): curved oak limb hangs below-forward of grip, diagonal grey string on top chord
      const idleRows = [
        '................',
        '..ddd...........',
        '.dmmmd..........',
        '.dwdsl..........',
        '.dwd..s.........',
        '.dwd...l........',
        '.dwmd...s.......',
        '..dwmd...l......',
        '..dwggd...s.....',
        '...dgggd...l..dd',
        '....dwmmd...sdmd',
        '.....dwmmmd..dmd',
        '......dmmmmmmmd.',
        '.......ddddddd..',
        '................',
        '................'
      ];
      _skelBowIdleGeo = _buildExtrudedPixelGeo(idleRows, pal, 0.038, 0.023, 0, -0.27, -0.22, 'yz');
    }
    if (!_skelBowDrawnGeo) {
      // Drawn 3D Bow + Nocked Pixel Arrow (Image 1): chunky oak limbs, grip (col 12) at hand, pulled V-string & golden arrow
      const drawnRows = [
        '..................',
        '......dddd........',
        '.....dmwwmd.......',
        '....s.dmwmmd......',
        '...s...dwmmmd.....',
        '..s.....dwmmmd....',
        '.s.......dwggmd...',
        '.s..fff...dgggd...',
        'lsaqaaqaqaaqggkkkt',
        '.s..fff...dgggd...',
        '.s.......dwggmd...',
        '..s.....dwmmmd....',
        '...s...dwmmmd.....',
        '....s.dmwmmd......',
        '.....dmwwmd.......',
        '......dddd........',
        '..................',
        '..................'
      ];
      _skelBowDrawnGeo = _buildExtrudedPixelGeo(drawnRows, pal, 0.042, 0.025, 0, 0.49, -0.35, 'yz_aim');
    }
    const bowIdle = new THREE.Mesh(_skelBowIdleGeo, _skelBowMat);
    bowIdle.userData.sharedGeo = true; bowIdle.castShadow = !_isMobilePerf;
    const bowAim = new THREE.Mesh(_skelBowDrawnGeo, _skelBowMat);
    bowAim.userData.sharedGeo = true; bowAim.castShadow = !_isMobilePerf; bowAim.visible = false;
    return { bowIdle, bowAim };
  }

  // v70/v92 Cute Voxel Mob, Boss & Pastel Plush Builders (wrapped cleanly around buildMobMesh with opts forwarded!)
  const _glowMatCache = new Map();
  let _chargedAuraSharedMat = null;
  const _baseBuildMobMesh = buildMobMesh;
  buildMobMesh = function(type, wx = 0, wz = 0, opts = null) {
    const tintBlenderMob = (bm, mulHex, opt = {}) => {
      if (!bm) return null;
      const mc = new THREE.Color(mulHex);
      for (let i = 0; i < bm.parts.length; i++) {
        const mat = _cloneMobMatIfShared(bm.parts[i]);
        if (!mat) continue;
        if (mat.color) mat.color.multiply(mc);
        if (opt.emissive !== undefined && mat.emissive) {
          mat.emissive.setHex(opt.emissive);
          mat.emissiveIntensity = opt.emissiveInt ?? 0.35;
          mat.userData.baseEmissive = mat.emissive.clone();
          mat.userData.baseEmissiveInt = mat.emissiveIntensity;
        }
        if (opt.opacity !== undefined) { mat.transparent = true; mat.opacity = opt.opacity; }
      }
      return bm;
    };
    const makeGlowBox = (parent, w, h, d, col, x, y, z, op = 1.0) => {
      const gk = `${col}_${op}`;
      let mat = _glowMatCache.get(gk);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op, wireframe: op < 0.5 && op > 0.22 });
        mat.userData = { sharedMat: true };
        _glowMatCache.set(gk, mat);
      }
      const m = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
      m.userData.sharedGeo = true; m.position.set(x, y, z); parent.add(m); return m;
    };
    const makePartBox = (bm, parent, w, h, d, col, x, y, z, rough = 0.78) => {
      const k = `v92_nt_voxel_${col.toString(16)}_${Math.round(rough * 100)}`;
      const mat = _getCuteBoxMats(k, { tex: _getNoiseTex('voxel'), color: col, rough, glow: false });
      const m = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
      m.userData.sharedGeo = true; m.castShadow = !_isMobilePerf; m.receiveShadow = true;
      m.position.set(x, y, z); parent.add(m); bm.parts.push(m); return m;
    };
    const localBounds = (obj) => {
      const b = new THREE.Box3();
      if (!obj) return b;
      obj.updateMatrixWorld(true);
      const inv = obj.matrixWorld.clone().invert();
      obj.traverse((ch) => {
        if (ch.isMesh && ch.geometry) {
          if (!ch.geometry.boundingBox) ch.geometry.computeBoundingBox();
          if (ch.geometry.boundingBox) {
            const tb = ch.geometry.boundingBox.clone();
            tb.applyMatrix4(ch.matrixWorld).applyMatrix4(inv);
            b.union(tb);
          }
        }
      });
      return b;
    };

    if (type === 'charged_creeper' || type === 'icy_creeper' || type === 'potato_creeper' || type === 'nerd_creeper' || type === 'ghost_creeper') {
      const tintMap = { charged_creeper: 0x99f6ff, icy_creeper: 0x67e8f9, potato_creeper: 0xfacc15, nerd_creeper: 0xffffff, ghost_creeper: 0xd1fae5 };
      const bm = tintBlenderMob(instantiateBlenderMob('creeper'), tintMap[type], type === 'ghost_creeper' ? { opacity: 0.58, emissive: 0x6ee7b7, emissiveInt: 0.35 } : (type === 'charged_creeper' ? { emissive: 0x0ea5e9, emissiveInt: 0.42 } : {}));
      if (bm) {
        if (type === 'charged_creeper') {
          const auraG = new THREE.Group();
          if (!_chargedAuraSharedMat) {
            _chargedAuraSharedMat = new THREE.MeshBasicMaterial({ map: getChargedAuraTex(), color: 0xe0f2fe, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
            _chargedAuraSharedMat.userData = { sharedMat: true };
          }
          const aBody = new THREE.Mesh(_getBoxGeo(0.78, 1.86, 0.64), _chargedAuraSharedMat); aBody.position.set(0, 0.96, 0); aBody.userData.sharedGeo = true;
          auraG.add(aBody);
          const eSheet = getPixelFxSheet('electric_coil');
          for (const [bx, by, bz] of [[-0.44, 1.32, 0.18], [0.44, 0.92, -0.18], [0, 2.02, 0.14]]) {
            const sp = new THREE.Sprite(eSheet.mats[0]); sp.position.set(bx, by, bz); sp.scale.setScalar(0.65); sp.userData.pfxSheet = eSheet;
            auraG.add(sp);
          }
          bm.group.add(auraG); bm.anim.core = auraG;
        } else if (type === 'icy_creeper') {
          const frostG = new THREE.Group();
          const fSheet = getPixelFxSheet('frost_aura');
          for (const [ix, iy, iz] of [[-0.36, 1.24, 0.24], [0.36, 0.86, 0.24], [0.12, 1.92, -0.18]]) {
            const sp = new THREE.Sprite(fSheet.mats[0]); sp.position.set(ix, iy, iz); sp.scale.setScalar(0.56); sp.userData.pfxSheet = fSheet;
            frostG.add(sp);
          }
          bm.group.add(frostG); bm.anim.core = frostG;
        } else if (type === 'potato_creeper' && bm.anim.head) {
          const hb = localBounds(bm.anim.head), hx = (hb.min.x + hb.max.x) * 0.5, hz = (hb.min.z + hb.max.z) * 0.5, hy = hb.max.y;
          makePartBox(bm, bm.anim.head, 0.10, 0.20, 0.10, 0x65a30d, hx, hy + 0.08, hz);
          makePartBox(bm, bm.anim.head, 0.22, 0.08, 0.14, 0x4d7c0f, hx + 0.08, hy + 0.16, hz);
        } else if (type === 'nerd_creeper') {
          if (bm.anim.torso) {
            const tb = localBounds(bm.anim.torso), ty = (tb.min.y + tb.max.y) * 0.5;
            makePartBox(bm, bm.anim.torso, 0.56, 0.66, 0.36, 0xf8fafc, 0, ty, 0.02);
            makePartBox(bm, bm.anim.torso, 0.12, 0.16, 0.06, 0x1e293b, 0.14, ty + 0.12, tb.max.z + 0.03);
          }
          if (bm.anim.head) {
            const hb = localBounds(bm.anim.head), ey = hb.min.y + (hb.max.y - hb.min.y) * 0.60, fz = hb.max.z;
            makePartBox(bm, bm.anim.head, 0.54, 0.12, 0.08, 0x18181b, 0, ey, fz + 0.01);
            makeGlowBox(bm.anim.head, 0.16, 0.10, 0.04, 0xf8fafc, -0.14, ey, fz + 0.04, 0.95);
            makeGlowBox(bm.anim.head, 0.16, 0.10, 0.04, 0xf8fafc,  0.14, ey, fz + 0.04, 0.95);
          }
        }
        return bm;
      }
      const fb = _baseBuildMobMesh(type, wx, wz, opts);
      if (fb) { fb.isPlaceholder = true; fb.pendingGlbKey = 'creeper'; }
      return fb;
    }

    if (type === 'zombified_piglin' || type === 'zombie_horse') {
      const cfg = (type === 'zombie_horse') ? { base: 'horse', tint: 0x6b8f5e } : { base: 'piglin', tint: 0xd9f99d };
      const bm = tintBlenderMob(instantiateBlenderMob(cfg.base), cfg.tint, cfg);
      if (bm) {
        if (type === 'zombified_piglin') {
          const armR = bm.anim.arms.find(a => a.dir < 0)?.p || bm.group;
          makePartBox(bm, armR, 0.08, 0.62, 0.14, 0xfacc15, 0, -0.52, 0.24, 0.25);
        }
        return bm;
      }
      const fb = _baseBuildMobMesh(type, wx, wz, opts);
      if (fb) { fb.isPlaceholder = true; fb.pendingGlbKey = cfg.base; }
      return fb;
    }

    const ELEMENTAL_DRAGON_CFG = {
      ice_dragon:   { el: 'ice',   body: 0x1d70b8, head: 0x38bdf8, belly: 0xdbeafe, eye: 0xfef08a, horn: 0xbae6fd, wing: 0x075985, crest: 0x67e8f9 },
      fire_dragon:  { el: 'fire',  body: 0x8f1111, head: 0xb91c1c, belly: 0xd6c7b2, eye: 0xfbbf24, horn: 0xc2b29b, wing: 0x5c0a0a, crest: 0xf97316 },
      earth_dragon: { el: 'earth', body: 0x61432d, head: 0x4a3322, belly: 0xa8a29e, eye: 0xfacc15, horn: 0x292524, wing: 0x44403c, crest: 0x10b981 },
      water_dragon: { el: 'water', body: 0x0369a1, head: 0x0284c7, belly: 0x99f6e4, eye: 0xfef9c3, horn: 0x67e8f9, wing: 0x0c4a6e, crest: 0x22d3ee },
      leaf_dragon:  { el: 'leaf',  body: 0x15803d, head: 0x16a34a, belly: 0xbef264, eye: 0xfde047, horn: 0x713f12, wing: 0x22c55e, crest: 0xf472b6 },
      tree_dragon:  { el: 'tree',  body: 0x5c3a21, head: 0x2d6a4f, belly: 0xa3b18a, eye: 0xfacc15, horn: 0x3f2314, wing: 0x3a7d34, crest: 0xf472b6 }
    };
    const _isPlush = type.startsWith('plush_');
    const _isSkelVariant = (type === 'skeleton' || type === 'stray' || type === 'desert_skeleton' || type === 'bogged');
    const _isZombieVariant = (type === 'zombie' || type === 'husk' || type === 'frozen_zombie' || type === 'mossy_zombie');
    const _hasReadyGlb = (k) => {
      const rk = _resolveGlbKey(k);
      return blenderMobTemplates.has(rk) || !!(window.BLENDER_MOB_GLBS && (window.BLENDER_MOB_GLBS[rk] || window.BLENDER_MOB_GLBS[k]));
    };
    const _usePendingCuteCustom = (type === 'blue_crab' || type === 'moobloom' || type === 'ocean_barnacle') && !_hasReadyGlb(type);
    if (_usePendingCuteCustom) preloadMobGlb(type);
    const _isCustomV92 = _isPlush || _isSkelVariant || _isZombieVariant || _usePendingCuteCustom || type === 'chicken' || type === 'chicken_jockey' || type === 'spider_jockey'
      || (!!ELEMENTAL_DRAGON_CFG[type] && !_hasReadyGlb(type)) || type === 'magma_cube' || type === 'baby_ghast' || type === 'wildfire'
      || type === 'redstone_monstrosity' || type === 'prismarine_colossus' || type === 'abyssal_colossus' || type === 'cave_warden' || type === 'dream_warden'
      || type === 'antler_deer' || type === 'tuff_golem' || type === 'cinnamon_ferret' || type === 'mini_abomination'
      || type === 'vulture' || type === 'moss_golem'
      || type === 'villager' || type === 'pillager' || type === 'pillager_raider' || type === 'vindicator' || type === 'evoker';

    if (_isCustomV92) {
      const g = new THREE.Group(), parts = [];
      const anim = { torso: null, head: null, jaw: null, core: null, legs: [], arms: [], wings: [], tail: null, slices: [] };
      const castSh = !_isMobilePerf || (MOB_STATS[type] && MOB_STATS[type].isBoss);
      const addPart = (parent, w, h, d, col, x, y, z, glow = false, rough = 0.78, mode = 'voxel') => {
        const k = glow ? `v92_gl_${col.toString(16)}` : `v92_nt_${mode}_${col.toString(16)}_${Math.round(rough * 100)}`;
        const mat = _getCuteBoxMats(k, { tex: _getNoiseTex(mode), color: col, rough, glow });
        const m = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
        m.userData.sharedGeo = true; m.position.set(x, y, z); m.castShadow = !glow && castSh; m.receiveShadow = !glow;
        parent.add(m); if (!glow) parts.push(m); return m;
      };
      const addArt = (parent, w, h, d, key, draw, x, y, z, opt = {}) => {
        const isAtlas = opt.atlas !== false;
        const mat = _getCuteBoxMats(key, { draw, atlas: isAtlas, rough: opt.rough ?? 0.80, glow: !!opt.glow, transparent: !!opt.transparent, opacity: opt.opacity ?? 1, emissive: opt.emissive, emissiveIntensity: opt.emissiveIntensity });
        const m = new THREE.Mesh(isAtlas ? _getCuteBoxGeo(w, h, d) : _getBoxGeo(w, h, d), mat);
        m.userData.sharedGeo = true; m.position.set(x, y, z); m.castShadow = !opt.glow && castSh; m.receiveShadow = !opt.glow;
        parent.add(m); if (!opt.glow) parts.push(m); return m;
      };
      const mkPiv = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
      const addBow = (parent, col, x, y, z, s = 1.0) => {
        addPart(parent, 0.14 * s, 0.10 * s, 0.06 * s, col, x - 0.10 * s, y, z, false, 0.75);
        addPart(parent, 0.14 * s, 0.10 * s, 0.06 * s, col, x + 0.10 * s, y, z, false, 0.75);
        addPart(parent, 0.08 * s, 0.08 * s, 0.08 * s, col, x, y, z + 0.015, false, 0.70);
      };
      const addFlower = (parent, petalCol, centerCol, x, y, z, s = 1.0) => {
        addPart(parent, 0.05 * s, 0.10 * s, 0.05 * s, 0x22c55e, x, y + 0.05 * s, z, false, 0.82);
        addPart(parent, 0.16 * s, 0.06 * s, 0.16 * s, petalCol, x, y + 0.13 * s, z, false, 0.76);
        addPart(parent, 0.07 * s, 0.05 * s, 0.07 * s, centerCol, x, y + 0.185 * s, z, false, 0.70);
      };
      let _villagerProfOut = null;
      const finishCustom = () => {
        const fg = makeSharedFlameGroup(); g.add(fg);
        const out = { group: g, parts, flameGroup: fg, anim, fromBlender: false, villagerProf: _villagerProfOut };
        if (_usePendingCuteCustom) { out.isPlaceholder = true; out.pendingGlbKey = type; }
        return out;
      };

      if (type === 'villager') {
        // Authentic 100% Reference-Matched Minecraft Villagers (Images 7..10):
        //   0 = Plains/Unemployed (Brown Robe, Img 7), 1 = Blacksmith (White Shoulder Shawl + Black Apron, Img 8)
        //   2 = Butcher (Red Headband + White Apron w/ Red Dots, Img 9), 3 = Farmer/Fisherman (Straw Hat + Woven Net + Fish, Img 10)
        const _profNames = ['villager', 'toolsmith', 'butcher', 'farmer'];
        const profIdx = (opts && typeof opts.profIdx === 'number')
          ? ((opts.profIdx % 4 + 4) % 4)
          : (Math.abs(Math.floor(wx * 3 + wz * 7)) % 4);
        _villagerProfOut = _profNames[profIdx];
        const isBlacksmith = (profIdx === 1), isButcher = (profIdx === 2), isFarmer = (profIdx === 3);

        anim.torso = mkPiv(g, 0, 1.02, 0);
        addArt(anim.torso, 0.46, 0.68, 0.28, `v101_vil_torso_${profIdx}`, (ctx, h) => {
          h.fillAll(0x5b3d2b, 8, 'voxel', 8, -10);
          for (const t of [0, 1, 4, 5]) h.px(t, 0, 0, 16, 16, 0x563827, 6);
          h.px(4, 6, 0, 4, 16, 0x452b1d, 4); // vertical robe crease
          if (isBlacksmith) {
            // Cream-white shoulder shawl across top collar & shoulders (Image 8)
            h.px(2, 0, 0, 16, 16, 0xe5e0d0, 5);
            for (const t of [0, 1]) h.px(t, 0, 0, 16, 4, 0xe5e0d0, 5);
            h.px(4, 0, 0, 4, 4, 0xe5e0d0); h.px(4, 12, 0, 4, 4, 0xe5e0d0);
            h.px(5, 0, 0, 16, 3, 0xd4cfc0);
            // Dark charcoal/black blacksmith leather apron + pocket/hammer badge
            h.px(4, 2, 1, 12, 15, 0x1b1c20, 4);
            h.px(4, 3, 8, 5, 4, 0x9aa0a6); // metallic pocket/plate
            h.px(4, 5, 11, 2, 4, 0x6b4226); // hammer handle
            h.px(4, 9, 10, 2, 4, 0x52575e); // pouch detail
          } else if (isButcher) {
            // Gray collar shoulder straps + bright white apron & waist tie (Image 9)
            h.px(4, 3, 0, 2, 6, 0xcbd5e1); h.px(4, 11, 0, 2, 6, 0xcbd5e1);
            for (const t of [0, 1, 5]) h.px(t, 0, 11, 16, 2, 0xbdbdbd);
            h.px(4, 2, 8, 12, 8, 0xdcdcdc, 4);
            h.px(4, 5, 9, 6, 3, 0xc2c2c2);
          } else if (isFarmer) {
            // Tan woven fisherman net/vest sides + turquoise fish & amber pouch at waist (Image 10)
            for (const t of [0, 1, 5]) {
              for (let y = 8; y < 16; y += 2) for (let x = 0; x < 16; x += 2) {
                h.px(t, x, y, 2, 2, ((x + y) & 2) ? 0xb8a37a : 0x543827);
              }
            }
            h.px(4, 1, 10, 5, 6, 0x3b7a78); h.px(4, 3, 11, 1, 1, 0x111827); // turquoise fish at waist!
            h.px(4, 7, 10, 4, 6, 0xa87624); // leather pouch
          }
        }, 0, 0, 0, { rough: 0.80 });

        // Lower robe skirt leaves legs clearly visible so alternating leg stride shows cleanly!
        addArt(anim.torso, 0.48, 0.26, 0.30, `v101_vil_skirt_${profIdx}`, (ctx, h) => {
          h.fillAll(0x543626, 8, 'voxel', 6, -10);
          h.px(4, 6, 0, 4, 16, 0x432a1c, 4);
          if (isBlacksmith) {
            h.px(4, 2, 0, 12, 13, 0x1b1c20, 4);
            h.px(4, 2, 13, 12, 3, 0xa6a298);
            for (const t of [0, 1]) { h.px(t, 8, 0, 8, 13, 0x1b1c20); h.px(t, 8, 13, 8, 3, 0xa6a298); }
          } else if (isButcher) {
            h.px(4, 2, 0, 12, 14, 0xdadada, 4);
            for (let x = 2; x < 14; x += 2) h.px(4, x, 12, 1, 2, 0x8e2424);
            h.px(4, 2, 14, 12, 2, 0xc2c2c2);
          } else if (isFarmer) {
            for (const t of [0, 1, 5]) {
              for (let y = 0; y < 12; y += 2) for (let x = 0; x < 16; x += 2) {
                h.px(t, x, y, 2, 2, ((x + y) & 2) ? 0xb8a37a : 0x543827);
              }
            }
            h.px(4, 1, 0, 5, 5, 0x3b7a78); h.px(4, 7, 0, 4, 5, 0xa87624);
          }
        }, 0, -0.47, 0, { rough: 0.80 });

        // Tall 8x10x8 Warm Tan Villager Head + Straight Unibrow + Emerald Green Eyes + 3D Nose (exact Evoker rig proportions!)
        anim.head = mkPiv(anim.torso, 0, 0.34, 0);
        addArt(anim.head, 0.46, 0.56, 0.46, `v101_vil_head_${profIdx}`, (ctx, h) => {
          h.fillAll(0xb47e60, 7, 'voxel', 10, -14);
          h.px(2, 0, 0, 16, 16, 0xc69273, 8);
          for (const t of [0, 1, 5]) h.px(t, 0, 13, 16, 3, 0x8e5d42, 4);
          // Continuous straight dark-brown unibrow (all 4 reference images!)
          h.px(4, 2, 7, 12, 2, 0x2d180c);
          // Outer white sclera + inner emerald-green pupils
          h.px(4, 2, 9, 2, 2, 0xf8fafc); h.px(4, 4, 9, 2, 2, 0x168038); h.px(4, 4, 9, 1, 1, 0x22c55e);
          h.px(4, 10, 9, 2, 2, 0x168038); h.px(4, 11, 9, 1, 1, 0x22c55e); h.px(4, 12, 9, 2, 2, 0xf8fafc);
          // Cheek crease & warm neutral mouth line
          h.px(4, 3, 12, 2, 1, 0x8c593e); h.px(4, 11, 12, 2, 1, 0x8c593e);
          h.px(4, 6, 14, 4, 1, 0x73462e);
        }, 0, 0.28, 0, { rough: 0.78 });
        // 3D Overhanging Villager Nose cleanly in front of face
        addPart(anim.head, 0.115, 0.23, 0.115, 0x9c684b, 0, 0.115, 0.265, false, 0.78);

        if (isButcher) {
          // 3D Crimson-Red Headband wrapping forehead above brow (Image 9!)
          addArt(anim.head, 0.485, 0.09, 0.485, 'v101_vil_butcher_band', (ctx, h) => {
            h.fillAll(0x8e2828, 6, 'voxel', 6, -8);
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 5, 16, 4, 0x6b1b1b);
          }, 0, 0.44, 0, { rough: 0.78 });
        } else if (isFarmer) {
          // Wide-Brimmed Woven Golden Straw Hat seated cleanly above unibrow (Image 10!)
          addArt(anim.head, 0.49, 0.15, 0.49, 'v101_vil_farmer_crown', (ctx, h) => {
            h.fillAll(0xd4a437, 8, 'wool', 12, -14);
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 11, 16, 4, 0x4d3319); // brown hatband
            h.spots(2, 0x8a6418, [[3, 3, 2, 2], [9, 4, 3, 2], [5, 10, 2, 2], [11, 11, 2, 2]]);
          }, 0, 0.485, 0, { rough: 0.84 });
          addArt(anim.head, 0.74, 0.032, 0.74, 'v101_vil_farmer_brim', (ctx, h) => {
            h.fillAll(0xdfb349, 8, 'wool', 10, -12);
            for (let t = 0; t < 6; t++) h.spots(t, 0xb58624, [[1, 1, 3, 2], [11, 2, 3, 2], [4, 12, 3, 2], [12, 12, 3, 2]]);
          }, 0, 0.40, 0, { rough: 0.84 });
        }

        // Authentic Forward-Tilted Folded Villager Sleeves (matched 100% to Evoker foldedArms!)
        const armPiv = mkPiv(anim.torso, 0, 0.22, 0.04);
        armPiv.rotation.x = -0.74;
        anim.foldedArms = armPiv;
        for (const sx of [-0.30, 0.30]) {
          addArt(armPiv, 0.18, 0.22, 0.20, `v101_vil_slv_${profIdx}`, (ctx, h) => {
            h.fillAll(0x664634, 8, 'voxel', 8, -10);
            if (isBlacksmith) {
              // White shoulder trim on top outer edges of folded sleeves matching Image 8!
              for (const t of [0, 1, 2, 4, 5]) h.px(t, 0, 0, 16, 4, 0xe5e0d0, 4);
              h.px(4, 4, 4, 8, 3, 0x8f8c82);
            }
          }, sx, -0.02, 0, { rough: 0.80 });
        }
        addArt(armPiv, 0.78, 0.20, 0.20, `v101_vil_cuff_${profIdx}`, (ctx, h) => {
          h.fillAll(0x664634, 8, 'voxel', 6, -10);
          h.px(4, 0, 0, 16, 3, 0x785540);
          h.px(4, 0, 13, 16, 3, 0x4e3426);
          if (isFarmer) { h.px(4, 2, 10, 4, 4, 0x9c8662); h.px(4, 10, 10, 4, 4, 0x9c8662); }
        }, 0, -0.23, 0, { rough: 0.80 });

        // Boots peeking cleanly below hem with distinct alternating legs (zero inner-face overlap)
        for (const [lx, d] of [[-0.12, 1], [0.12, -1]]) {
          const leg = mkPiv(g, lx, 0.68, 0); anim.legs.push({ p: leg, dir: d });
          addArt(leg, 0.20, 0.68, 0.20, `v101_vil_leg_${profIdx}`, (ctx, h) => {
            h.fillAll(isFarmer ? 0x452b1c : 0x4d5259, 6, 'voxel', 6, -8);
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 12, 16, 4, isFarmer ? 0x2e1b10 : 0x353940);
          }, 0, -0.34, 0, { rough: 0.82 });
        }
        return finishCustom();
      }


      if (type === 'magma_cube') {
        anim.torso = mkPiv(g, 0, 0.45, 0);
        addPart(anim.torso, 0.50, 0.68, 0.50, 0xff5a00, 0, 0, 0, true); // glowing inner magma core (no overlap!)
        const slY = [-0.34, -0.11, 0.12, 0.35];
        for (let si = 0; si < 4; si++) {
          const sl = mkPiv(anim.torso, 0, slY[si], 0);
          addPart(sl, 0.86, 0.17, 0.86, si % 2 === 0 ? 0x291512 : 0x3b1814, 0, 0, 0, false, 0.68, 'stone');
          if (si === 2) {
            addPart(sl, 0.13, 0.11, 0.04, 0xfacc15, -0.19, 0.01, 0.452, true);
            addPart(sl, 0.13, 0.11, 0.04, 0xfacc15,  0.19, 0.01, 0.452, true);
          }
          anim.slices.push({ p: sl, baseY: slY[si] });
        }
        return finishCustom();
      }


      if (type === 'ghast' || type === 'baby_ghast') {
        const isBaby = (type === 'baby_ghast');
        const root = mkPiv(g, 0, 0, 0);
        root.scale.setScalar(isBaby ? 0.90 : 2.15);
        anim.torso = mkPiv(root, 0, 0.78, 0);
        addArt(anim.torso, 0.96, 0.96, 0.96, isBaby ? 'v92_ghast_baby' : 'v92_ghast_adult', (ctx, h) => {
          h.fillAll(0xedf1f6, 6, 'voxel', 10, -14);
          for (const t of [0, 1, 4, 5]) {
            h.spots(t, 0xd4dbe3, [[1, 1, 2, 2], [13, 2, 2, 2], [2, 12, 2, 2], [12, 11, 2, 2]]);
          }
          // Cute arched eyebrows, closed happy crescent eyes & warm smile (Image 12!)
          h.px(4, 3, 4, 2, 1, 0xb8c2ce); h.px(4, 11, 4, 2, 1, 0xb8c2ce);
          h.px(4, 3, 7, 3, 1, 0x374151); h.px(4, 10, 7, 3, 1, 0x374151);
          h.px(4, 5, 10, 1, 1, 0x6b7280); h.px(4, 10, 10, 1, 1, 0x6b7280);
          h.px(4, 6, 11, 4, 1, 0x374151);
          h.px(4, 1, 9, 2, 1, 0xcbd5e1); h.px(4, 13, 9, 2, 1, 0xcbd5e1);
          if (isBaby) { h.px(4, 2, 8, 2, 1, 0xf472b6); h.px(4, 12, 8, 2, 1, 0xf472b6); }
          // Crimson-red gill slits on BOTH side faces (+X & -X) matching Image 12!
          for (const sideT of [0, 1]) {
            h.px(sideT, 7, 7, 2, 2, 0xdc2626);
            h.px(sideT, 9, 6, 1, 2, 0xb91c1c);
            h.px(sideT, 6, 9, 2, 2, 0x991b1b);
            h.px(sideT, 9, 9, 1, 3, 0xdc2626);
            h.px(sideT, 7, 11, 2, 1, 0xb91c1c);
          }
        }, 0, 0, 0, { rough: 0.85 });
        const tentPos = [[-0.29, 0.29, 0.42], [0.0, 0.29, 0.56], [0.29, 0.29, 0.44], [-0.29, 0.0, 0.52], [0.0, 0.0, 0.62], [0.29, 0.0, 0.50], [-0.29, -0.29, 0.44], [0.0, -0.29, 0.54], [0.29, -0.29, 0.40]];
        for (let ti = 0; ti < tentPos.length; ti++) {
          const [tx, tz, th] = tentPos[ti];
          const tp = mkPiv(anim.torso, tx, -0.49, tz);
          addPart(tp, 0.14, th, 0.14, ti % 2 === 0 ? 0xc2c8d1 : 0xadb5c0, 0, -th * 0.5, 0, false, 0.86);
          anim.legs.push({ p: tp, dir: (ti & 1) ? 1 : -1 });
        }
        return finishCustom();
      }


      if (type === 'cave_warden' || type === 'dream_warden') {
        const isDreamW = (type === 'dream_warden');
        // Reworked 1.19 Deep Dark Warden (Image 1-4): Eyeless sculpted skull, glowing curved ear tendrils, 4 bone ribs, pulsing soul-heart core & ivory shoulder chitin!
        const wDark = '#07161e', wMid = '#0b2c37', wTeal = isDreamW ? '#701a75' : '#155461', wCyan = isDreamW ? '#e879f9' : '#22d3ee', wPaleCyan = isDreamW ? '#fae8ff' : '#a5f3fc', wBone = '#d8d0b2', wBoneSh = '#9b9b82', wMouth = '#02060a';
        anim.torso = mkPiv(g, 0, 0.92, 0);
        addArt(anim.torso, 1.04, 1.12, 0.72, isDreamW ? 'dream_warden_torso' : 'warden_torso_v101', (ctx, { px, fillTile, hash }) => {
          for (let f = 0; f < 6; f++) {
            fillTile(f, 0x07161e, 10, 'voxel');
            if (f === 4) {
              // Front (+Z): 4 pairs of bone-ivory ribs framing deep sternum core cavity!
              px(f, 2, 1, 12, 14, '#040e14');
              px(f, 5, 2, 6, 12, '#02080c');
              for (const ry of [2, 5, 9, 12]) {
                px(f, 1, ry, 4, 2, wBone); px(f, 1, ry + 1, 3, 1, wBoneSh);
                px(f, 11, ry, 4, 2, wBone); px(f, 12, ry + 1, 3, 1, wBoneSh);
                px(f, 4, ry, 1, 2, wTeal); px(f, 11, ry, 1, 2, wTeal);
              }
            } else if (f === 0 || f === 1) {
              for (const ry of [2, 5, 9, 12]) px(f, 3, ry, 10, 2, wBoneSh);
              px(f, 1, 0, 14, 2, wMid);
            } else {
              for (let y = 1; y < 15; y += 3) for (let x = 2; x < 14; x += 5) {
                if (hash(x, y, 71 + f) > 0.65) px(f, x, y, 1, 1, wTeal);
              }
            }
          }
        }, 0, 0.56, 0, { rough: 0.78 });

        // Per-instance glowing soul-heart chest core (pulsing synced to heartbeat & Sonic Boom charge!)
        const coreTex = _makeCuteVoxelTex(isDreamW ? 'dream_warden_core' : 'warden_core_v101', (ctx, { px, fillTile }) => {
          fillTile(0, 0x02080c, 4, 'voxel');
          px(0, 5, 1, 6, 14, isDreamW ? '#4a044e' : '#083344');
          px(0, 3, 4, 3, 4, wCyan); px(0, 9, 3, 4, 4, wCyan);
          px(0, 6, 6, 4, 4, wPaleCyan); px(0, 7, 10, 3, 3, wCyan);
          px(0, 2, 10, 2, 2, wTeal); px(0, 11, 9, 2, 2, wTeal);
        }, false);
        const coreMat = new THREE.MeshStandardMaterial({ map: coreTex, emissive: new THREE.Color(wCyan), emissiveMap: coreTex, emissiveIntensity: 1.05, roughness: 0.45 });
        coreMat.userData.sharedMat = false;
        const coreMesh = new THREE.Mesh(_getBoxGeo(0.42, 0.58, 0.05), coreMat);
        coreMesh.userData.sharedGeo = true;
        coreMesh.position.set(0, 0.56, 0.365);
        anim.torso.add(coreMesh);
        anim.core = coreMesh; anim.coreMat = coreMat; parts.push(coreMesh);

        // Blind Sculpted Skull + Crown Plate + Recessed Gaping Mouth (NO EYES!)
        anim.head = mkPiv(anim.torso, 0, 1.12, 0.04);
        addArt(anim.head, 0.94, 0.78, 0.80, isDreamW ? 'dream_warden_head' : 'warden_head_v101', (ctx, { px, fillTile, hash }) => {
          for (let f = 0; f < 6; f++) {
            fillTile(f, 0x07161e, 10, 'voxel');
            if (f === 2) {
              // Top crown (+Y): lighter teal-blue plate with bright cyan sensor flecks
              px(f, 0, 0, 16, 16, wTeal);
              px(f, 1, 1, 14, 14, '#1b6473');
              px(f, 3, 4, 2, 2, wPaleCyan); px(f, 10, 3, 2, 2, wCyan);
              px(f, 6, 9, 2, 2, wCyan); px(f, 11, 11, 2, 2, wPaleCyan);
            } else {
              px(f, 0, 0, 16, 3, wTeal);
              if (f === 4) {
                // Front face (+Z): totally blind forehead + gaping dark mouth with teal lips
                px(f, 2, 3, 12, 3, wDark);
                px(f, 2, 6, 12, 7, '#0c3b46');
                px(f, 3, 7, 10, 5, wMouth);
                px(f, 4, 6, 8, 2, '#010408');
                px(f, 1, 13, 14, 2, wMid);
              }
            }
          }
        }, 0, 0.39, 0, { rough: 0.76 });

        // Articulated Left & Right Curved Cyan Ear Tendrils
        const tenTex = _makeCuteVoxelTex('warden_tendril_v101', (ctx, { px, fillTile }) => {
          fillTile(0, 0x0e6e7d, 10, 'crystal');
          px(0, 2, 2, 12, 4, wCyan); px(0, 4, 0, 6, 3, wPaleCyan); px(0, 5, 11, 5, 4, wCyan);
        }, false);
        const tenMat = new THREE.MeshStandardMaterial({ map: tenTex, emissive: new THREE.Color(0x06b6d4), emissiveMap: tenTex, emissiveIntensity: 0.88, roughness: 0.48 });
        tenMat.userData.sharedMat = false;
        anim.tendrilMat = tenMat;
        for (const [sx, sideKey] of [[-1, 'tendrilL'], [1, 'tendrilR']]) {
          const tp = mkPiv(anim.head, sx * 0.47, 0.42, 0.02);
          const mkSeg = (w, h, d, x, y, z) => {
            const m = new THREE.Mesh(_getBoxGeo(w, h, d), tenMat);
            m.userData.sharedGeo = true; m.position.set(x, y, z); tp.add(m); parts.push(m);
          };
          mkSeg(0.24, 0.12, 0.12, sx * 0.12, 0.00, 0);
          mkSeg(0.14, 0.34, 0.12, sx * 0.30, 0.14, 0);
          mkSeg(0.22, 0.12, 0.12, sx * 0.24, 0.36, 0);
          mkSeg(0.10, 0.16, 0.10, sx * 0.18, 0.44, 0);
          mkSeg(0.08, 0.14, 0.10, sx * 0.34, -0.09, 0);
          mkSeg(0.12, 0.08, 0.10, sx * 0.42, 0.14, 0);
          anim[sideKey] = tp;
        }

        // Massive Arms with Pale Ivory Shoulder Chitin & Cyan Forearm Specks
        for (const [sx, d] of [[-0.74, 1], [0.74, -1]]) {
          const arm = mkPiv(anim.torso, sx, 0.98, 0.02); anim.arms.push({ p: arm, dir: d });
          addArt(arm, 0.42, 1.44, 0.44, 'warden_arm_v101', (ctx, { px, fillTile, hash }) => {
            for (let f = 0; f < 6; f++) {
              fillTile(f, 0x06141d, 10, 'voxel');
              if (f !== 3) {
                px(f, 0, 0, 16, 6, wBone);
                px(f, 2, 1, 12, 4, '#e5dec4');
                for (let x = 0; x < 16; x++) {
                  px(f, x, 6 + (x & 1), 1, 2, wBoneSh);
                  px(f, x, 8, 1, 2, '#113a45');
                }
                px(f, 2, 14, 12, 2, wMid);
                px(f, 4, 11, 2, 2, wCyan);
                if (hash(f, 12, 19) > 0.3) px(f, 10, 12, 2, 2, wCyan);
              }
            }
          }, 0, -0.66, 0, { rough: 0.78 });
        }

        // Sturdy Legs with Pale Ivory Claw Toes
        for (const [lx, d] of [[-0.28, 1], [0.28, -1]]) {
          const leg = mkPiv(g, lx, 0.92, 0); anim.legs.push({ p: leg, dir: d });
          addArt(leg, 0.42, 0.92, 0.46, 'warden_leg_v101', (ctx, { px, fillTile }) => {
            for (let f = 0; f < 6; f++) {
              fillTile(f, 0x06141d, 10, 'voxel');
              px(f, 0, 13, 16, 3, wMid);
              if (f === 4) {
                px(f, 1, 13, 3, 3, wBone); px(f, 6, 13, 4, 3, wBone); px(f, 12, 13, 3, 3, wBone);
              }
            }
          }, 0, -0.46, 0, { rough: 0.82 });
        }
        return finishCustom();
      }


      if (type === 'redstone_monstrosity') {
        // Boss #1 (Image 5): Molten Redstone Monstrosity — horned bull stone colossus + glowing lava carapace + 3 amber eyes!
        anim.torso = mkPiv(g, 0, 1.56, 0);
        addPart(anim.torso, 1.60, 0.96, 1.10, 0x52525b, 0, 0, 0, false, 0.84, 'stone');
        addPart(anim.torso, 1.44, 0.22, 0.96, 0xef4444, 0, 0.59, 0, true); // fiery top magma shell seated flush ON TOP
        addPart(anim.torso, 0.62, 0.16, 0.05, 0xf97316, 0, 0.12, 0.578, true); // chest molten rune slit
        for (const sx of [-1, 1]) {
          addPart(anim.torso, 0.54, 0.64, 0.58, 0x71717a, sx * 0.96, 0.34, 0, false, 0.82, 'stone');
          addPart(anim.torso, 0.44, 0.14, 0.48, 0xf97316, sx * 0.96, 0.73, 0, true);
        }
        anim.head = mkPiv(anim.torso, 0, 0.10, 0.58);
        addPart(anim.head, 0.82, 0.70, 0.72, 0x6b7280, 0, 0, 0.36, false, 0.82, 'stone');
        addPart(anim.head, 0.86, 0.22, 0.74, 0xf97316, 0, -0.22, 0.37, true);
        addPart(anim.head, 0.16, 0.11, 0.04, 0xfacc15, -0.22, 0.06, 0.745, true);
        addPart(anim.head, 0.18, 0.12, 0.04, 0xfef08a,  0.00, 0.10, 0.745, true);
        addPart(anim.head, 0.16, 0.11, 0.04, 0xfacc15,  0.22, 0.06, 0.745, true);
        for (const sx of [-1, 1]) {
          addPart(anim.head, 0.22, 0.18, 0.22, 0x9ca3af, sx * 0.48, 0.18, 0.34, false, 0.80, 'stone');
          addPart(anim.head, 0.16, 0.42, 0.18, 0x9ca3af, sx * 0.52, 0.48, 0.34, false, 0.80, 'stone');
        }
        for (const [sx, d] of [[-1.02, 1], [1.02, -1]]) {
          const arm = mkPiv(anim.torso, sx, 0.04, 0.02); anim.arms.push({ p: arm, dir: d });
          addPart(arm, 0.38, 0.78, 0.38, 0x4b5563, 0, -0.39, 0, false, 0.82, 'stone');
          addPart(arm, 0.56, 0.58, 0.56, 0x71717a, 0, -1.07, 0.06, false, 0.84, 'stone');
          addPart(arm, 0.10, 0.24, 0.10, 0x27272a, -0.14, -1.48, 0.16, false, 0.75, 'stone');
          addPart(arm, 0.10, 0.24, 0.10, 0x27272a,  0.14, -1.48, 0.16, false, 0.75, 'stone');
        }
        for (const [lx, d] of [[-0.42, 1], [0.42, -1]]) {
          const leg = mkPiv(g, lx, 1.06, 0); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.56, 1.04, 0.62, 0x4b5563, 0, -0.52, 0, false, 0.85, 'stone');
          addPart(leg, 0.16, 0.28, 0.04, 0xf97316, 0, -0.38, 0.33, true);
        }
        return finishCustom();
      }


      if (type === 'wildfire') {
        // Boss #2 (Image 6): Hovering Inferno Wildfire — glowing golden-orange rod core + dark iron-crowned helmet + 4 orbiting shields!
        anim.torso = mkPiv(g, 0, 1.05, 0);
        addPart(anim.torso, 0.30, 0.44, 0.30, 0xfef08a, 0,  0.34, 0, true);
        addPart(anim.torso, 0.28, 0.46, 0.28, 0xf97316, 0, -0.12, 0, true);
        addPart(anim.torso, 0.26, 0.36, 0.26, 0xb91c1c, 0, -0.54, 0, true);
        anim.head = mkPiv(anim.torso, 0, 0.68, 0);
        addPart(anim.head, 0.56, 0.52, 0.56, 0x332d33, 0, 0.26, 0, false, 0.45, 'stone');
        addPart(anim.head, 0.60, 0.12, 0.60, 0x1c1917, 0, 0.54, 0, false, 0.42, 'stone');
        addPart(anim.head, 0.44, 0.10, 0.44, 0xfacc15, 0, 0.65, 0, true); // burning crown top
        addPart(anim.head, 0.12, 0.09, 0.04, 0xfef9c3, -0.14, 0.25, 0.30, true);
        addPart(anim.head, 0.12, 0.09, 0.04, 0xfef9c3,  0.14, 0.25, 0.30, true);
        for (const sx of [-1, 1]) {
          addPart(anim.head, 0.08, 0.28, 0.08, 0xfacc15, sx * 0.34, 0.38, 0, true);
          addPart(anim.head, 0.14, 0.08, 0.08, 0xfde047, sx * 0.39, 0.52, 0, true);
        }
        anim.core = mkPiv(anim.torso, 0, -0.08, 0);
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * Math.PI * 2;
          const sp = mkPiv(anim.core, Math.sin(ang) * 0.86, 0, Math.cos(ang) * 0.86);
          sp.rotation.y = ang;
          addPart(sp, 0.54, 1.08, 0.11, 0x332d33, 0, 0, 0, false, 0.48, 'stone');
          addPart(sp, 0.40, 0.88, 0.04, 0xf59e0b, 0, 0, 0.075, true);
          addPart(sp, 0.14, 0.14, 0.03, 0x44403c, 0,  0.18, 0.105, false, 0.45, 'stone');
          addPart(sp, 0.14, 0.14, 0.03, 0x44403c, 0, -0.18, 0.105, false, 0.45, 'stone');
        }
        return finishCustom();
      }


      if (type === 'prismarine_colossus') {
        // Boss #3 (Image 7): Ancient Prismarine Colossus — glowing sea-lantern chest core + 3 cyan eyes + shoulder pipes + claws!
        anim.torso = mkPiv(g, 0, 1.66, 0);
        addPart(anim.torso, 1.24, 1.02, 0.78, 0x4c7c74, 0, 0, 0, false, 0.72, 'stone');
        addPart(anim.torso, 1.10, 0.84, 0.14, 0x628c85, 0, 0.05, 0.47, false, 0.70, 'stone');
        addPart(anim.torso, 0.38, 0.38, 0.06, 0xbbf7f0, 0, 0.05, 0.56, true); // glowing sea lantern chest core!
        addPart(anim.torso, 0.84, 0.44, 0.62, 0xc2ab87, 0, -0.73, 0, false, 0.80, 'stone');
        for (const sx of [-1, 1]) {
          addPart(anim.torso, 0.54, 0.54, 0.68, 0x5c847d, sx * 0.90, 0.30, 0, false, 0.72, 'stone');
          addPart(anim.torso, 0.16, 0.56, 0.16, 0x7aa39b, sx * 0.38, 0.80, -0.26, false, 0.72, 'stone');
          addPart(anim.torso, 0.22, 0.72, 0.22, 0x8db8af, sx * 0.18, 0.88, -0.26, false, 0.72, 'stone');
        }
        anim.head = mkPiv(anim.torso, 0, 0.56, 0.28);
        addPart(anim.head, 0.84, 0.62, 0.72, 0x678f88, 0, 0.31, 0, false, 0.74, 'stone');
        for (const ex of [-0.23, 0, 0.23]) {
          addPart(anim.head, 0.14, 0.22, 0.04, 0xccfbf1, ex, 0.33, 0.38, true);
          addPart(anim.head, 0.16, 0.14, 0.06, 0xd6c09e, ex, 0.12, 0.39, false, 0.78, 'stone');
        }
        for (const [sx, d] of [[-0.90, 1], [0.90, -1]]) {
          const arm = mkPiv(anim.torso, sx, -0.02, 0); anim.arms.push({ p: arm, dir: d });
          addPart(arm, 0.38, 0.64, 0.42, 0xb8a07d, 0, -0.32, 0, false, 0.78, 'stone');
          addPart(arm, 0.48, 0.68, 0.48, 0x456e67, 0, -0.98, 0, false, 0.74, 'stone');
          addPart(arm, 0.50, 0.20, 0.50, 0xd6c09e, 0, -1.42, 0, false, 0.78, 'stone');
          for (const cx of [-0.14, 0, 0.14]) addPart(arm, 0.09, 0.22, 0.09, 0xe7dec8, cx, -1.63, 0.10, false, 0.75, 'stone');
        }
        for (const [lx, d] of [[-0.36, 1], [0.36, -1]]) {
          const leg = mkPiv(g, lx, 0.94, 0); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.44, 0.94, 0.48, 0x4f7870, 0, -0.47, 0, false, 0.75, 'stone');
          for (const tx of [-0.12, 0, 0.12]) addPart(leg, 0.10, 0.12, 0.14, 0xe7dec8, tx, -0.88, 0.31, false, 0.76, 'stone');
        }
        return finishCustom();
      }


      if (type === 'abyssal_colossus') {
        // Boss #4 (Image 8): Abyssal Angler Colossus — teal gorilla + anglerfish lantern + pink coral horns + big tusks!
        const root = mkPiv(g, 0, 0, 0);
        root.scale.setScalar(1.12);
        anim.torso = mkPiv(root, 0, 1.54, 0);
        addPart(anim.torso, 1.32, 1.06, 0.94, 0x1e6b7c, 0, 0, 0, false, 0.72, 'stone');
        for (let py = 0; py < 3; py++) addPart(anim.torso, 0.76, 0.22, 0.07, 0xa7c7c2, 0, -0.34 + py * 0.28, 0.51, false, 0.76, 'stone');
        addPart(anim.torso, 0.22, 0.38, 0.24, 0x4ea3a8, 0, 0.22, -0.59, false, 0.75);
        for (const sx of [-1, 1]) addPart(anim.torso, 0.56, 0.52, 0.58, 0x2c8396, sx * 0.95, 0.32, 0.04, false, 0.72, 'stone');
        anim.head = mkPiv(anim.torso, 0, 0.32, 0.44);
        addPart(anim.head, 0.94, 0.64, 0.78, 0x2f889c, 0, 0.20, 0.34, false, 0.72, 'stone');
        addPart(anim.head, 0.16, 0.12, 0.04, 0xfbbf24, -0.22, 0.22, 0.75, true);
        addPart(anim.head, 0.16, 0.12, 0.04, 0xfbbf24,  0.22, 0.22, 0.75, true);
        addPart(anim.head, 0.98, 0.26, 0.88, 0x247385, 0, -0.25, 0.40, false, 0.72, 'stone'); // wide underbite jaw
        for (let ti = -3; ti <= 3; ti++) addPart(anim.head, 0.09, (Math.abs(ti) === 3 ? 0.24 : 0.16), 0.09, 0xede6d3, ti * 0.13, -0.04, 0.78, false, 0.70);
        // Anglerfish glowing lure arching cleanly over forehead!
        addPart(anim.head, 0.11, 0.36, 0.11, 0x2c8396, 0, 0.70, 0.38, false, 0.72);
        addPart(anim.head, 0.11, 0.11, 0.46, 0x2c8396, 0, 0.83, 0.66, false, 0.72);
        addPart(anim.head, 0.24, 0.24, 0.24, 0xbaf8ff, 0, 0.65, 0.84, true);
        // Twin stepped pink coral horns!
        for (const sx of [-1, 1]) {
          addPart(anim.head, 0.15, 0.34, 0.15, 0xf472b6, sx * 0.54, 0.56, 0.22, false, 0.74);
          addPart(anim.head, 0.12, 0.30, 0.12, 0xfb7185, sx * 0.58, 0.88, 0.18, false, 0.74);
        }
        for (const [sx, d] of [[-0.95, 1], [0.95, -1]]) {
          const arm = mkPiv(anim.torso, sx, -0.02, 0.04); anim.arms.push({ p: arm, dir: d });
          addPart(arm, 0.42, 0.68, 0.44, 0x1b5c6b, 0, -0.34, 0, false, 0.72, 'stone');
          addPart(arm, 0.48, 0.76, 0.50, 0x2c8396, 0, -1.06, 0.06, false, 0.72, 'stone');
          for (const fx of [-0.14, 0, 0.14]) addPart(arm, 0.09, 0.18, 0.09, 0xede6d3, fx, -1.53, 0.16, false, 0.72);
        }
        for (const [lx, d] of [[-0.36, 1], [0.36, -1]]) {
          const leg = mkPiv(root, lx, 0.88, 0); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.44, 0.88, 0.48, 0x164c59, 0, -0.44, 0, false, 0.74, 'stone');
          for (const fx of [-0.12, 0, 0.12]) addPart(leg, 0.09, 0.10, 0.14, 0xede6d3, fx, -0.83, 0.31, false, 0.72);
        }
        return finishCustom();
      }


      if (type === 'tuff_golem') {
        const cBody = 0x64748b, cDark = 0x334155;
        anim.torso = mkPiv(g, 0, 0.52, 0);
        addPart(anim.torso, 0.54, 0.44, 0.40, cBody, 0, 0, 0, false, 0.85, 'stone');
        addPart(anim.torso, 0.56, 0.30, 0.04, 0xfef3c7, 0, -0.02, 0.225);
        anim.head = mkPiv(g, 0, 0.76, 0);
        addArt(anim.head, 0.50, 0.42, 0.44, 'v95_tgolem_hd', (ctx, h) => {
          h.fillAll(cBody, 12, 'stone', 10, -14);
          h.cuteFace(4, { eyeY: 6, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, sclera: 0xe2e8f0, blushCol: 0xf472b6, sparkle: true });
        }, 0, 0.21, 0, { rough: 0.85 });
        addPart(anim.head, 0.14, 0.14, 0.10, 0x475569, 0, 0.14, 0.275, false, 0.85, 'stone');
        for (const [sx, d] of [[-0.36, 1], [0.36, -1]]) {
          const arm = mkPiv(g, sx, 0.70, 0); anim.arms.push({ p: arm, dir: d });
          addPart(arm, 0.16, 0.48, 0.18, cDark, 0, -0.24, 0, false, 0.85, 'stone');
        }
        for (const [sx, d] of [[-0.14, 1], [0.14, -1]]) {
          const leg = mkPiv(g, sx, 0.30, 0); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.18, 0.30, 0.20, cDark, 0, -0.15, 0, false, 0.85, 'stone');
        }
        return finishCustom();
      }


      if (type === 'moobloom' || type === 'antler_deer') {
        const isMoo = (type === 'moobloom');
        const c1 = isMoo ? 0xfacc15 : 0x92400e, c2 = isMoo ? 0xfef9c3 : 0xfde68a;
        anim.torso = mkPiv(g, 0, 0.72, 0);
        addPart(anim.torso, 0.68, 0.56, 0.98, c1, 0, 0, 0, false, 0.82, 'fur');
        addPart(anim.torso, 0.52, 0.10, 0.74, c2, 0, -0.33, 0.04, false, 0.82, 'fur');
        if (isMoo) {
          addFlower(anim.torso, 0xfef08a, 0xf59e0b, -0.16, 0.28, -0.16, 1.1);
          addFlower(anim.torso, 0xfef08a, 0xf59e0b,  0.16, 0.28,  0.18, 1.1);
        }
        anim.head = mkPiv(g, 0, 0.90, 0.52);
        addArt(anim.head, 0.44, 0.42, 0.40, isMoo ? 'v92_moo_hd' : 'v92_deer_hd', (ctx, h) => {
          h.fillAll(c1, 10, 'fur', 12, -16);
          h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x111827, sclera: 0xffffff, sparkle: true });
        }, 0, 0.06, 0.20, { rough: 0.82 });
        addPart(anim.head, 0.28, 0.16, 0.10, c2, 0, -0.06, 0.455);
        if (isMoo) addFlower(anim.head, 0xfacc15, 0xd97706, -0.10, 0.27, 0.20, 0.95);
        else {
          for (const sx of [-1, 1]) {
            addPart(anim.head, 0.06, 0.36, 0.06, 0xf8fafc, sx * 0.15, 0.45, 0.18);
            addPart(anim.head, 0.18, 0.06, 0.06, 0xf8fafc, sx * 0.24, 0.52, 0.18);
            addPart(anim.head, 0.06, 0.22, 0.06, 0xf8fafc, sx * 0.30, 0.65, 0.18);
          }
        }
        for (const [lx, lz, d] of [[-0.20, 0.32, 1], [0.20, 0.32, -1], [-0.20, -0.32, -1], [0.20, -0.32, 1]]) {
          const leg = mkPiv(g, lx, 0.44, lz); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.16, 0.44, 0.16, isMoo ? 0xeab308 : 0x78350f, 0, -0.22, 0, false, 0.84);
        }
        return finishCustom();
      }


      if (type === 'blue_crab') {
        anim.torso = mkPiv(g, 0, 0.26, 0);
        addPart(anim.torso, 0.68, 0.24, 0.52, 0x2563eb, 0, 0, 0, false, 0.72);
        addPart(anim.torso, 0.58, 0.08, 0.44, 0x38bdf8, 0, 0.16, 0, false, 0.72);
        addPart(anim.torso, 0.07, 0.12, 0.06, 0x0f172a, -0.18, 0.22, 0.20, true);
        addPart(anim.torso, 0.07, 0.12, 0.06, 0x0f172a,  0.18, 0.22, 0.20, true);
        const armL = mkPiv(anim.torso, -0.46, 0.02, 0.28); anim.arms.push({ p: armL, dir: 1 });
        addPart(armL, 0.34, 0.26, 0.34, 0xf97316, -0.05, 0, 0.16, false, 0.72); // signature huge orange claw (Image 9)!
        const armR = mkPiv(anim.torso, 0.42, 0.00, 0.26); anim.arms.push({ p: armR, dir: -1 });
        addPart(armR, 0.16, 0.14, 0.18, 0xea580c, 0.02, 0, 0.10, false, 0.72);
        for (const [lx, lz, d] of [[-0.38, 0.12, 1], [0.38, 0.12, -1], [-0.38, -0.14, -1], [0.38, -0.14, 1]]) {
          const leg = mkPiv(g, lx, 0.18, lz); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.09, 0.18, 0.09, 0x1d4ed8, 0, -0.09, 0);
        }
        return finishCustom();
      }


      if (type === 'sniffer') {
        anim.torso = mkPiv(g, 0, 0.62, 0);
        addPart(anim.torso, 1.04, 0.56, 1.24, 0xb93829, 0, 0, 0, false, 0.86, 'wool');
        addPart(anim.torso, 1.06, 0.22, 1.26, 0x3f8f4b, 0, 0.39, 0, false, 0.86, 'wool'); // lush mossy back!
        anim.head = mkPiv(anim.torso, 0, 0.04, 0.64);
        addPart(anim.head, 0.66, 0.44, 0.42, 0xb93829, 0, 0, 0.21, false, 0.84, 'wool');
        addPart(anim.head, 0.08, 0.10, 0.03, 0x0f172a, -0.18, 0.08, 0.435, false, 0.60);
        addPart(anim.head, 0.08, 0.10, 0.03, 0x0f172a,  0.18, 0.08, 0.435, false, 0.60);
        addPart(anim.head, 0.46, 0.28, 0.26, 0xfacc15, 0, -0.06, 0.55, false, 0.80); // flat yellow snout
        for (const sx of [-1, 1]) addPart(anim.head, 0.10, 0.48, 0.34, 0x992b1e, sx * 0.39, -0.08, 0.18, false, 0.86, 'wool');
        for (const [lx, lz, d] of [[-0.36, 0.42, 1], [0.36, 0.42, -1], [-0.36, 0.0, -1], [0.36, 0.0, 1], [-0.36, -0.42, 1], [0.36, -0.42, -1]]) {
          const leg = mkPiv(g, lx, 0.34, lz); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.22, 0.34, 0.22, 0x8c291f, 0, -0.17, 0);
        }
        return finishCustom();
      }


      if (type === 'savanna_monkey' || type === 'meerkat') {
        const isMonk = (type === 'savanna_monkey');
        anim.torso = mkPiv(g, 0, isMonk ? 0.36 : 0.42, 0);
        addPart(anim.torso, 0.36, isMonk ? 0.30 : 0.48, isMonk ? 0.56 : 0.30, isMonk ? 0xe07b29 : 0xb88655, 0, 0, 0, false, 0.84, 'fur');
        if (!isMonk) addPart(anim.torso, 0.37, 0.08, 0.31, 0x785032, 0, 0.05, 0, false, 0.84, 'fur');
        anim.head = mkPiv(anim.torso, 0, isMonk ? 0.10 : 0.34, isMonk ? 0.30 : 0);
        addArt(anim.head, 0.36, 0.30, 0.32, isMonk ? 'v92_monk_hd' : 'v92_meerk_hd', (ctx, h) => {
          h.fillAll(isMonk ? 0xe07b29 : 0xd4a373, 10, 'fur', 10, -14);
          h.cuteFace(4, { eyeY: 6, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x111827, sclera: 0xffffff, sparkle: true });
        }, 0, isMonk ? 0.04 : 0.15, isMonk ? 0.16 : 0, { rough: 0.82 });
        addPart(anim.head, 0.22, 0.14, 0.09, 0xfef3c7, 0, isMonk ? -0.03 : 0.08, isMonk ? 0.365 : 0.205);
        anim.tail = mkPiv(anim.torso, 0, -0.02, isMonk ? -0.28 : -0.15);
        addPart(anim.tail, 0.10, 0.10, 0.40, isMonk ? 0xc2611b : 0x785032, 0, 0.04, -0.20);
        const legPairs = isMonk ? [[-0.12, 0.18, 1], [0.12, 0.18, -1], [-0.12, -0.18, -1], [0.12, -0.18, 1]] : [[-0.10, 0.04, 1], [0.10, 0.04, -1]];
        for (const [lx, lz, d] of legPairs) {
          const leg = mkPiv(g, lx, isMonk ? 0.22 : 0.18, lz); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.11, isMonk ? 0.22 : 0.18, 0.11, isMonk ? 0xf5f5f4 : 0x92623a, 0, -(isMonk ? 0.11 : 0.09), 0);
        }
        return finishCustom();
      }


      if (type === 'pink_dolphin' || type === 'ocean_barnacle') {
        const isBarn = (type === 'ocean_barnacle');
        anim.torso = mkPiv(g, 0, 0.42, 0);
        if (isBarn) {
          // Ocean Depth Monster / Barnacle (Image 9): 4 spiked jaw paddles around glowing cyan mouth!
          addPart(anim.torso, 0.52, 0.48, 0.72, 0x1e4d5c, 0, 0, 0, false, 0.70, 'stone');
          addPart(anim.torso, 0.28, 0.28, 0.04, 0xdc2626, 0, 0, 0.382, true);
          for (const [jx, jy, w, h] of [[-0.18, 0, 0.12, 0.38], [0.18, 0, 0.12, 0.38], [0, 0.18, 0.38, 0.12], [0, -0.18, 0.38, 0.12]]) {
            addPart(anim.torso, w, h, 0.44, 0x2c6e80, jx, jy, 0.58, false, 0.72);
          }
          anim.tail = mkPiv(anim.torso, 0, 0, -0.36);
          addPart(anim.tail, 0.44, 0.16, 0.36, 0x163844, 0, 0, -0.18);
        } else {
          addPart(anim.torso, 0.46, 0.42, 1.06, 0xf9a8d4, 0, 0, 0, false, 0.62);
          addPart(anim.torso, 0.36, 0.10, 0.86, 0xfce7f3, 0, -0.26, 0.02, false, 0.62);
          addPart(anim.torso, 0.22, 0.16, 0.30, 0xf472b6, 0, -0.05, 0.68, false, 0.62);
          addPart(anim.torso, 0.08, 0.22, 0.24, 0xf472b6, 0, 0.32, -0.05, false, 0.62);
          addPart(anim.torso, 0.05, 0.07, 0.04, 0x111827, -0.23, 0.05, 0.36, true);
          addPart(anim.torso, 0.05, 0.07, 0.04, 0x111827,  0.23, 0.05, 0.36, true);
          anim.tail = mkPiv(anim.torso, 0, 0, -0.53);
          addPart(anim.tail, 0.56, 0.10, 0.34, 0xf472b6, 0, 0, -0.17);
        }
        return finishCustom();
      }


      if (type === 'vulture' || type === 'ostrich') {
        const isVult = (type === 'vulture');
        anim.torso = mkPiv(g, 0, isVult ? 0.55 : 0.88, 0);
        addPart(anim.torso, isVult ? 0.44 : 0.58, isVult ? 0.36 : 0.50, isVult ? 0.68 : 0.78, isVult ? 0x5c2d16 : 0x18181b, 0, 0, 0, false, 0.84, 'fur');
        if (isVult) addPart(anim.torso, 0.36, 0.16, 0.32, 0xf5f5f4, 0, 0.06, 0.42, false, 0.84, 'fur');
        anim.head = mkPiv(anim.torso, 0, isVult ? 0.16 : 0.32, isVult ? 0.46 : 0.36);
        if (!isVult) addPart(anim.head, 0.18, 0.52, 0.18, 0xfca5a5, 0, 0.26, 0, false, 0.82); // tall ostrich neck
        addPart(anim.head, isVult ? 0.28 : 0.26, 0.24, isVult ? 0.30 : 0.28, isVult ? 0xfca5a5 : 0xfda4af, 0, isVult ? 0.06 : 0.64, isVult ? 0.14 : 0.04);
        addPart(anim.head, isVult ? 0.14 : 0.18, 0.09, 0.20, isVult ? 0x27272a : 0xf59e0b, 0, isVult ? 0.02 : 0.60, isVult ? 0.39 : 0.28);
        for (const sx of [-1, 1]) {
          addPart(anim.head, 0.04, 0.06, 0.04, 0x111827, sx * (isVult ? 0.15 : 0.14), isVult ? 0.09 : 0.67, isVult ? 0.18 : 0.10, true);
          const wp = mkPiv(anim.torso, sx * (isVult ? 0.24 : 0.32), 0.10, 0);
          addPart(wp, isVult ? 0.58 : 0.08, isVult ? 0.08 : 0.34, isVult ? 0.46 : 0.56, isVult ? 0x3f1d0d : 0xf8fafc, sx * (isVult ? 0.29 : 0.04), -0.08, -0.04, false, 0.84, 'fur');
          anim.wings.push({ p: wp, dir: sx });
          const leg = mkPiv(g, sx * (isVult ? 0.12 : 0.16), isVult ? 0.37 : 0.64, 0); anim.legs.push({ p: leg, dir: sx });
          addPart(leg, 0.08, isVult ? 0.35 : 0.64, 0.08, isVult ? 0xd97706 : 0xfca5a5, 0, -(isVult ? 0.175 : 0.32), 0);
        }
        return finishCustom();
      }


      if (type === 'moss_golem') {
        anim.torso = mkPiv(g, 0, 0.68, 0);
        addPart(anim.torso, 0.54, 0.54, 0.38, 0x4d7c0f, 0, 0, 0, false, 0.82, 'wool');
        anim.head = mkPiv(g, 0, 0.95, 0);
        addArt(anim.head, 0.46, 0.44, 0.44, 'v95_mgolem_hd', (ctx, h) => {
          h.fillAll(0x3f6212, 12, 'voxel', 12, -16);
          h.capOverhang(4, 0x65a30d, 0x365314, 4, 2);
          h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, sclera: 0xffffff, blushCol: 0xf472b6, sparkle: true });
        }, 0, 0.22, 0, { rough: 0.82 });
        addFlower(anim.head, 0xec4899, 0xfacc15, 0.12, 0.45, 0.06, 1.0);
        for (const [sx, d] of [[-0.36, 1], [0.36, -1]]) {
          const arm = mkPiv(anim.torso, sx, 0.20, 0); anim.arms.push({ p: arm, dir: d });
          addPart(arm, 0.16, 0.48, 0.18, 0x365314, 0, -0.24, 0);
        }
        for (const [lx, d] of [[-0.14, 1], [0.14, -1]]) {
          const leg = mkPiv(g, lx, 0.41, 0); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.18, 0.41, 0.20, 0x365314, 0, -0.205, 0);
        }
        return finishCustom();
      }


      if (type === 'pillager' || type === 'pillager_raider' || type === 'vindicator' || type === 'evoker') {
        const isPill = (type === 'pillager');
        const isRaider = (type === 'pillager_raider');
        const isVind = (type === 'vindicator');
        const isEvok = (type === 'evoker');
        // Reference-matched Illagers (Images 1..6):
        //   vindicator (Images 1 & 4): Dark charcoal vest + silver buttons, striped dark teal pants, folded arms -> 3D Iron Axe melee!
        //   evoker     (Images 3,5,6): Jet-black ankle robe + golden V-collar & center stripe, golden clasp -> skyward casting!
        //   pillager_raider (Image 2): Eyepatch slate head, bright orange fur pauldrons/vest, brown pants, crossbow!
        //   pillager                 : Checkered maroon coat, cyan shoulder pads, silver buckle, 3D crossbow!
        anim.torso = mkPiv(g, 0, 1.02, 0);
        addArt(anim.torso, 0.46, 0.68, 0.28, `v101_${type}_torso`, (ctx, h) => {
          if (isEvok) {
            h.fillAll(0x14151a, 8, 'voxel', 8, -10);
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 0, 16, 16, (t === 5 ? 0x101116 : 0x15171c), 5);
            // Golden V-collar + central vertical gold band running down chest
            h.px(2, 0, 0, 16, 2, 0xd4af37);
            h.px(4, 2, 0, 2, 2, 0xe8c758); h.px(4, 12, 0, 2, 2, 0xe8c758);
            h.px(4, 4, 1, 2, 2, 0xd4af37); h.px(4, 10, 1, 2, 2, 0xd4af37);
            h.px(4, 6, 0, 4, 16, 0xc9a02c);
            h.px(4, 7, 0, 2, 16, 0xe8c858);
            h.px(4, 5, 2, 1, 14, 0x8a6a16); h.px(4, 10, 2, 1, 14, 0x8a6a16);
          } else if (isVind) {
            h.fillAll(0x2d2725, 8, 'voxel', 8, -12);
            // Open charcoal-brown unbuttoned vest over dark inner shirt + two rows of silver buttons
            h.px(4, 5, 0, 6, 16, 0x171414);
            h.px(4, 1, 0, 4, 16, 0x352e2b, 5); h.px(4, 11, 0, 4, 16, 0x352e2b, 5);
            for (const bx of [2, 12]) {
              for (const by of [3, 8, 12]) h.px(4, bx, by, 2, 2, 0x90969c);
            }
            h.px(4, 6, 0, 4, 2, 0x737980);
          } else if (isRaider) {
            h.fillAll(0x747b83, 8, 'stone', 8, -12);
            // Iron armor chest + vivid orange fur V-collar & fur vest + brown buckle belt
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 0, 16, 5, 0xea6a15, 10);
            h.px(4, 1, 0, 5, 10, 0xf5841f, 10); h.px(4, 10, 0, 5, 10, 0xf5841f, 10);
            h.px(4, 5, 3, 6, 7, 0x5c2c12);
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 11, 16, 4, 0x261d19);
            h.px(4, 5, 11, 6, 4, 0xd1d5db); h.px(4, 7, 12, 2, 2, 0x18181b);
          } else {
            h.fillAll(0x461b28, 10, 'voxel', 10, -14);
            for (const t of [0, 1, 4, 5]) {
              for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) {
                h.px(t, x, y, 2, 2, ((x + y) & 2) ? 0x562131 : 0x32101b, 6);
              }
              h.px(t, 0, 10, 16, 4, 0x16191e);
            }
            h.px(4, 0, 0, 16, 2, 0x5c341a);
            h.px(4, 5, 0, 6, 4, 0x6f7b85); h.px(4, 6, 4, 4, 3, 0x566069);
            h.px(4, 2, 1, 3, 4, 0x5c341a); h.px(4, 11, 1, 3, 4, 0x5c341a);
            h.px(4, 4, 10, 8, 4, 0xa8cdd1);
            h.px(4, 5, 11, 6, 2, 0x7ba0a6);
            h.px(4, 6, 11, 4, 2, 0x192026);
          }
        }, 0, 0, 0, { rough: 0.78 });

        // Lower Coat / Robe Skirt positioned cleanly below Torso (no z-fighting!)
        if (isEvok) {
          addArt(anim.torso, 0.48, 0.34, 0.30, 'v101_evoker_robe_hem', (ctx, h) => {
            h.fillAll(0x14151a, 8, 'voxel', 6, -8);
            h.px(4, 6, 0, 4, 15, 0xc9a02c);
            h.px(4, 7, 0, 2, 14, 0xe8c858);
            h.px(4, 6, 14, 4, 2, 0x101116);
          }, 0, -0.51, 0, { rough: 0.80 });
        } else if (isVind) {
          // Open coat tails on left/right revealing teal pants gap down center (Images 1 & 4)
          for (const sx of [-0.155, 0.155]) {
            addPart(anim.torso, 0.17, 0.15, 0.30, 0x2b2523, sx, -0.415, 0, false, 0.80);
          }
        } else {
          addArt(anim.torso, 0.48, 0.14, 0.30, `v101_${type}_skirt`, (ctx, h) => {
            const baseC = isRaider ? 0x6b2f12 : 0x3a1420;
            h.fillAll(baseC, 10, 'voxel', 8, -12);
            for (const t of [0, 1, 4, 5]) {
              if (!isRaider) for (let x = 0; x < 16; x += 2) h.px(t, x, 0, 2, 12, (x & 2) ? 0x4b1c2a : 0x2c0e18, 5);
              h.px(t, 6, 8, 4, 8, isRaider ? 0x4a200b : 0x193538);
            }
          }, 0, -0.41, 0, { rough: 0.80 });
          if (isPill || isRaider) {
            const pCol = isRaider ? 0xea6a15 : 0x62858a;
            for (const sx of [-0.18, 0.18]) addPart(anim.torso, 0.17, 0.08, 0.30, pCol, sx, 0.38, 0, false, 0.76);
          }
        }

        // Tall 8x10x8 Cool Slate-Gray Illager Head + Stern Brows + White/Colored Eyes + Overhanging 3D Nose
        anim.head = mkPiv(anim.torso, 0, 0.34, 0);
        addArt(anim.head, 0.46, 0.56, 0.46, `v101_${type}_head`, (ctx, h) => {
          h.fillAll(0x7b8288, 7, 'stone', 10, -14);
          h.px(2, 0, 0, 16, 16, 0x8e959c, 8);
          if (isRaider) {
            // Diagonal black eyepatch strap & scarred patch over left eye + ice-blue right eye (Image 2!)
            h.px(4, 2, 0, 2, 4, 0x2a2d30); h.px(4, 3, 4, 2, 3, 0x181a1d);
            h.px(4, 1, 8, 4, 1, 0x141619); h.px(4, 2, 9, 4, 1, 0x141619);
            h.px(4, 2, 10, 2, 2, 0xf8fafc); h.px(4, 4, 10, 2, 2, 0x38bdf8);
            h.px(4, 8, 7, 8, 4, 0x141619); // eyepatch covering right-side (mob's left) eye!
            for (const t of [0, 1, 5]) h.px(t, 0, 10, 16, 2, 0x141619);
            h.px(4, 6, 14, 4, 1, 0x454c54);
          } else {
            const pupil = isVind ? 0x1d6f8a : 0x1b6e3c;
            const irisHi = isVind ? 0x38bdf8 : 0x4ade80;
            h.px(4, 1, 8, 4, 1, 0x181a1d); h.px(4, 2, 9, 4, 1, 0x181a1d);
            h.px(4, 11, 8, 4, 1, 0x181a1d); h.px(4, 10, 9, 4, 1, 0x181a1d);
            h.px(4, 2, 10, 2, 2, 0xf8fafc); h.px(4, 4, 10, 2, 2, pupil); h.px(4, 4, 10, 1, 1, irisHi);
            h.px(4, 10, 10, 2, 2, pupil); h.px(4, 11, 10, 1, 1, irisHi); h.px(4, 12, 10, 2, 2, 0xf8fafc);
            h.px(4, 6, 14, 4, 1, 0x444c54);
          }
        }, 0, 0.28, 0, { rough: 0.76 });
        addPart(anim.head, 0.115, 0.23, 0.115, 0x676f76, 0, 0.115, 0.265, false, 0.78);

        // Idle Folded Arms for Evoker (golden clasp, Images 5 & 6) and passive Vindicator (gray cuffs, Image 1)
        if (isEvok || isVind) {
          const fPiv = mkPiv(anim.torso, 0, 0.22, 0.04);
          fPiv.rotation.x = -0.74;
          anim.foldedArms = fPiv;
          const slCol = isEvok ? 0x14151a : 0x2f2826;
          for (const sx of [-0.30, 0.30]) addPart(fPiv, 0.18, 0.22, 0.20, slCol, sx, -0.02, 0, false, 0.78);
          addArt(fPiv, 0.78, 0.20, 0.20, `v101_${type}_folded`, (ctx, h) => {
            h.fillAll(slCol, 8, 'voxel', 6, -10);
            if (isEvok) {
              // Signature sleek golden lightning/zigzag clasp across folded sleeves (compensating 0.78/0.20 aspect!)
              h.px(4, 6, 0, 4, 16, 0x111217);
              h.px(4, 7, 1, 2, 4, 0xe8c858); h.px(4, 8, 4, 2, 4, 0xd4af37);
              h.px(4, 7, 8, 2, 4, 0xe8c858); h.px(4, 8, 12, 2, 4, 0xb89022);
            } else {
              // Gray inner cuff sleeves across chest (Image 1!)
              h.px(4, 4, 0, 8, 16, 0x8f959a);
              h.px(4, 7, 1, 2, 14, 0x6f757a);
            }
          }, 0, -0.23, 0, { rough: 0.78 });
        }

        // Articulated Open Arms (+X left = dir:1, -X right = dir:-1)
        let armR = null;
        for (const [sx, d] of [[0.34, 1], [-0.34, -1]]) {
          const arm = mkPiv(anim.torso, sx, 0.28, 0);
          anim.arms.push({ p: arm, dir: d });
          addArt(arm, 0.22, 0.64, 0.22, `v101_${type}_arm_${d > 0 ? 'l' : 'r'}`, (ctx, h) => {
            if (isEvok) {
              h.fillAll(0x14151a, 8, 'voxel', 6, -10);
              for (const t of [0, 1, 2, 4, 5]) {
                h.px(t, 0, 10, 16, 3, 0xd4af37); // golden robe sleeve cuffs (Image 3!)
                h.px(t, 0, 13, 16, 3, 0x7b8288); // gray checkered Illager hand
              }
            } else if (isVind) {
              h.fillAll(0x2b2524, 8, 'voxel', 8, -10);
              for (const t of [0, 1, 2, 4, 5]) {
                h.px(t, 0, 11, 16, 2, 0x8d9398); // gray sleeve cuff (Image 4!)
                h.px(t, 0, 13, 16, 3, 0x7b8288); // gray Illager fist
              }
            } else if (isRaider) {
              h.fillAll(0x787f87, 8, 'stone', 8, -12);
              for (const t of [0, 1, 2, 4, 5]) {
                h.px(t, 0, 0, 16, 4, 0xea6a15, 8); // orange fur shoulder
                h.px(t, 0, 11, 16, 2, 0x261d19);   // dark wrist bracer
                h.px(t, 0, 13, 16, 3, 0x8e959c);   // fist
              }
            } else {
              h.fillAll(0x461b28, 8, 'voxel', 8, -12);
              for (const t of [0, 1, 2, 4, 5]) {
                h.px(t, 0, 0, 16, 3, 0x89acb0);
                h.px(t, 0, 3, 16, 2, 0x284f55);
                for (let y = 5; y < 12; y += 2) for (let x = 0; x < 16; x += 2) h.px(t, x, y, 2, 2, ((x + y) & 2) ? 0x562131 : 0x32101b);
                h.px(t, 0, 11, 16, 2, 0x8eaeb3);
                h.px(t, 0, 13, 16, 3, 0x7b8288);
              }
            }
          }, 0, -0.26, 0, { rough: 0.76 });
          if (d < 0) armR = arm;
        }
        if (isEvok || isVind) {
          for (let ai = 0; ai < anim.arms.length; ai++) anim.arms[ai].p.visible = false;
        }

        // Authentic 3D Voxel Iron Axe for Vindicator (Image 4!)
        if (isVind && armR) {
          const axP = mkPiv(armR, 0.0, -0.52, 0.05);
          axP.rotation.x = 0.24;
          // Oak handle extending upward (+Z in local arm space, which points +Y when Arm_R aims forward!)
          addPart(axP, 0.055, 0.055, 0.48, 0x5c3416, 0, -0.02, 0.22, false, 0.74);
          // Stepped pixel-art silver Iron Axe blade with crisp dark border facing forward (-Y)
          addPart(axP, 0.045, 0.22, 0.20, 0xd1d5db, 0, -0.14, 0.40, false, 0.35);
          addPart(axP, 0.050, 0.14, 0.24, 0x9ca3af, 0, -0.10, 0.42, false, 0.38);
          addPart(axP, 0.040, 0.06, 0.22, 0x1e293b, 0, -0.25, 0.40, false, 0.50); // dark cutting edge outline
        }

        // Authentic 3D Wooden Crossbow for Pillager & Armored Raider (Image 2!)
        if ((isPill || isRaider) && armR) {
          const cb = mkPiv(armR, 0.16, -0.50, 0.08);
          cb.rotation.x = 0.18;
          addPart(cb, 0.08,  0.64, 0.08,  0x78431c, 0, -0.26, 0.0, false, 0.70);
          addPart(cb, 0.072, 0.16, 0.10,  0x45240e, 0,  0.02, -0.02, false, 0.74);
          addPart(cb, 0.06,  0.10, 0.095, 0x94a3b8, 0, -0.09, 0.02, false, 0.45);
          addPart(cb, 0.18,  0.09, 0.08,  0x5a3012, 0, -0.52, 0.0, false, 0.70);
          addPart(cb, 0.14,  0.07, 0.068, 0x94a3b8, 0, -0.60, 0.0, false, 0.42);
          const limbL = addPart(cb, 0.28, 0.072, 0.072, 0x874d20, -0.20, -0.48, 0.0, false, 0.70); limbL.rotation.z = -0.34;
          const tipL  = addPart(cb, 0.13, 0.062, 0.064, 0x45240e, -0.36, -0.40, 0.0, false, 0.74); tipL.rotation.z  = -0.58;
          const limbR = addPart(cb, 0.28, 0.072, 0.072, 0x874d20,  0.20, -0.48, 0.0, false, 0.70); limbR.rotation.z =  0.34;
          const tipR  = addPart(cb, 0.13, 0.062, 0.064, 0x45240e,  0.36, -0.40, 0.0, false, 0.74); tipR.rotation.z  =  0.58;
          const strL = addPart(cb, 0.022, 0.44, 0.022, 0xe2e8f0, -0.195, -0.25, 0.036, false, 0.55); strL.rotation.z = -0.84;
          const strR = addPart(cb, 0.022, 0.44, 0.022, 0xe2e8f0,  0.195, -0.25, 0.036, false, 0.55); strR.rotation.z =  0.84;
          addPart(cb, 0.04,  0.52, 0.04,  0xa67442, 0, -0.36, 0.056, false, 0.68);
          addPart(cb, 0.075, 0.09, 0.048, 0xf1f5f9, 0, -0.64, 0.056, false, 0.35);
        }

        // Legs matching Images 1..6 (Vindicator horizontal teal stripes + black boots; Evoker charcoal boots; Raider brown pants + gray iron boots)
        for (const [lx, d] of [[-0.115, 1], [0.115, -1]]) {
          const leg = mkPiv(g, lx, 0.68, 0); anim.legs.push({ p: leg, dir: d });
          addArt(leg, 0.22, 0.68, 0.22, `v101_${type}_leg`, (ctx, h) => {
            if (isVind) {
              h.fillAll(0x16444a, 6, 'voxel', 6, -8);
              for (const t of [0, 1, 2, 4, 5]) {
                for (let y = 0; y < 12; y += 2) h.px(t, 0, y, 16, 2, ((y >> 1) & 1) ? 0x16444a : 0x205d65);
                h.px(t, 0, 12, 16, 4, 0x121316); // black boots (Images 1 & 4)
              }
            } else if (isEvok) {
              h.fillAll(0x3a3d43, 6, 'voxel', 6, -8);
              for (const t of [0, 1, 2, 4, 5]) h.px(t, 0, 12, 16, 4, 0x24272c);
            } else if (isRaider) {
              h.fillAll(0x6b2f12, 8, 'voxel', 8, -10);
              for (const t of [0, 1, 2, 4, 5]) {
                h.px(t, 0, 8, 16, 2, 0xcbd5e1);
                h.px(t, 0, 10, 16, 4, 0x646b73);
                h.px(t, 0, 14, 16, 2, 0x18191c);
              }
            } else {
              h.fillAll(0x1b3a3e, 8, 'voxel', 8, -10);
              for (const t of [0, 1, 2, 4, 5]) {
                h.px(t, 0, 5, 16, 11, 0x4e2d1b);
                h.px(t, 0, 5, 16, 2, 0x663c24);
                h.px(t, 0, 13, 16, 3, 0x361e11);
              }
            }
          }, 0, -0.34, 0, { rough: 0.80 });
        }
        return finishCustom();
      }

      const buildSkeletonInto = (tGrp, tAnim, variant, isRider) => {
        const palMap = {
          skeleton:        { bone: 0xd0d0d5, dark: 0x93939a, eye: 0x1e1e22 },
          desert_skeleton: { bone: 0xd8c18e, dark: 0xa28654, eye: 0xfef3c7 },
          stray:           { bone: 0x9bb0bc, dark: 0x455863, eye: 0xe0f2fe, hood: 0x3b4f59, hoodDk: 0x26353d },
          bogged:          { bone: 0x92a380, dark: 0x566647, eye: 0x86efac, moss: 0x365314, mossHi: 0x4d7c0f }
        };
        const sk = palMap[variant] || palMap.skeleton;
        tAnim.torso = mkPiv(tGrp, 0, 0.70, 0);
        // Spine, shoulder bar, 3 open hollow rib rings & 4-wall hollow pelvis basin (Images 1 & 2!)
        addPart(tAnim.torso, 0.10, 0.62, 0.08, sk.dark, 0, 0.34, -0.06, false, 0.76, 'stone');
        addPart(tAnim.torso, 0.42, 0.08, 0.19, sk.bone, 0, 0.62, 0, false, 0.74, 'stone');
        for (const ry of [0.49, 0.36, 0.23]) {
          addPart(tAnim.torso, 0.05, 0.055, 0.16, sk.bone, -0.175, ry, 0, false, 0.74, 'stone');
          addPart(tAnim.torso, 0.05, 0.055, 0.16, sk.bone,  0.175, ry, 0, false, 0.74, 'stone');
          addPart(tAnim.torso, 0.15, 0.055, 0.05, sk.bone, -0.115, ry, 0.072, false, 0.74, 'stone');
          addPart(tAnim.torso, 0.15, 0.055, 0.05, sk.bone,  0.115, ry, 0.072, false, 0.74, 'stone');
        }
        addPart(tAnim.torso, 0.10, 0.10, 0.11, sk.dark, 0, 0.12, -0.02, false, 0.76, 'stone');
        addPart(tAnim.torso, 0.42, 0.09, 0.05, sk.bone, 0, 0.045,  0.085, false, 0.74, 'stone');
        addPart(tAnim.torso, 0.42, 0.09, 0.05, sk.bone, 0, 0.045, -0.085, false, 0.74, 'stone');
        addPart(tAnim.torso, 0.05, 0.09, 0.17, sk.bone, -0.185, 0.045, 0, false, 0.74, 'stone');
        addPart(tAnim.torso, 0.05, 0.09, 0.17, sk.bone,  0.185, 0.045, 0, false, 0.74, 'stone');
        addPart(tAnim.torso, 0.12, 0.08, 0.14, sk.dark, 0, 0.04, 0, false, 0.76, 'stone');

        if (variant === 'stray') {
          addPart(tAnim.torso, 0.46, 0.11, 0.22, sk.hood, 0, 0.61, 0, false, 0.84, 'wool');
          addPart(tAnim.torso, 0.14, 0.46, 0.22, sk.hood, -0.14, 0.35, 0.005, false, 0.84, 'wool');
          addPart(tAnim.torso, 0.14, 0.46, 0.22, sk.hood,  0.14, 0.35, 0.005, false, 0.84, 'wool');
          addPart(tAnim.torso, 0.45, 0.16, 0.22, sk.hoodDk, 0, 0.04, -0.01, false, 0.84, 'wool');
        } else if (variant === 'desert_skeleton') {
          addPart(tAnim.torso, 0.44, 0.08, 0.21, 0xc9af7c, 0, 0.50, 0.005, false, 0.84, 'wool');
          addPart(tAnim.torso, 0.44, 0.08, 0.21, 0xb2945e, 0, 0.16, 0.005, false, 0.84, 'wool');
        } else if (variant === 'bogged') {
          addPart(tAnim.torso, 0.16, 0.10, 0.22, sk.moss, -0.17, 0.63, 0, false, 0.84, 'wool');
          addPart(tAnim.torso, 0.16, 0.10, 0.22, sk.mossHi, 0.17, 0.63, 0, false, 0.84, 'wool');
          addPart(tAnim.torso, 0.10, 0.20, 0.05, sk.moss,  0.13, 0.46, 0.095, false, 0.84, 'wool');
        }

        // Skull Head
        tAnim.head = mkPiv(tAnim.torso, 0, 0.68, 0);
        addArt(tAnim.head, 0.48, 0.48, 0.48, `v107_${variant}_head`, (ctx, h) => {
          h.fillAll(sk.bone, 11, 'stone', 10, -14);
          if (variant === 'desert_skeleton') {
            for (const t of [0, 1, 2, 4, 5]) {
              h.px(t, 0, 2, 16, 2, 0xb0935d); h.px(t, 0, 11, 16, 2, 0x9c804c);
            }
          } else if (variant === 'stray') {
            for (const t of [0, 1, 4, 5]) h.capOverhang(t, sk.hood, sk.hoodDk, 5, 3);
            h.fillTile(2, sk.hood, 10, 'wool');
          } else if (variant === 'bogged') {
            h.fillTile(2, sk.moss, 12, 'wool');
            for (const t of [0, 1, 4, 5]) h.capOverhang(t, sk.moss, sk.mossHi, 4, 2);
          }
          // Eye sockets, nasal notch & classic wide skeleton mouth
          h.px(4, 2, 7, 4, 3, 0x1e2024); h.px(4, 10, 7, 4, 3, 0x1e2024);
          if (variant !== 'skeleton') {
            h.px(4, 3, 8, 2, 1, sk.eye); h.px(4, 11, 8, 2, 1, sk.eye);
          }
          h.px(4, 7, 10, 2, 1, 0x3b3d42);
          h.px(4, 3, 12, 10, 2, 0x26282c);
        }, 0, 0.24, 0, { rough: 0.76 });
        if (variant === 'bogged') {
          addPart(tAnim.head, 0.08, 0.11, 0.08, 0xe7e5e4, -0.12, 0.53,  0.04, false, 0.80);
          addPart(tAnim.head, 0.22, 0.10, 0.22, 0xdc2626, -0.12, 0.62,  0.04, false, 0.74);
          addPart(tAnim.head, 0.07, 0.09, 0.07, 0xd6d3d1,  0.14, 0.52, -0.06, false, 0.80);
          addPart(tAnim.head, 0.18, 0.08, 0.18, 0x92400e,  0.14, 0.59, -0.06, false, 0.76);
        }

        // Slender 2x12x2 Bone Arms (sx = +0.27 / dir = 1 is Mob's Right Arm holding 3D Bow!)
        let armR = null, armL = null;
        for (const [sx, d] of [[0.27, 1], [-0.27, -1]]) {
          const arm = mkPiv(tAnim.torso, sx, 0.62, 0);
          addPart(arm, 0.12, 0.66, 0.12, sk.bone, 0, -0.29, 0, false, 0.74, 'stone');
          if (variant === 'stray') addPart(arm, 0.16, 0.26, 0.16, sk.hood, 0, -0.12, 0, false, 0.84, 'wool');
          else if (variant === 'bogged') addPart(arm, 0.14, 0.16, 0.14, sk.moss, 0, -0.12, 0, false, 0.84, 'wool');
          tAnim.arms.push({ p: arm, dir: d });
          if (d > 0) armR = arm; else armL = arm;
        }
        if (armR) {
          const { bowIdle, bowAim } = _getSkelBowMeshes();
          bowIdle.rotation.order = 'YXZ';
          bowIdle.position.set(0.01, -0.52, 0.04);
          bowIdle.rotation.set(isRider ? -0.92 : 0.06, isRider ? 0.16 : 0.24, -0.05);
          bowAim.rotation.order = 'YXZ';
          bowAim.position.set(-0.08, -0.55, 0.02);
          bowAim.rotation.set(0.14, -0.52, -0.34);
          armR.add(bowIdle); armR.add(bowAim);
          parts.push(bowIdle, bowAim);
          tAnim.bowIdle = bowIdle; tAnim.bowAim = bowAim;
          armR.rotation.x = isRider ? -0.52 : -0.14; armR.rotation.z = isRider ? -0.06 : 0.05;
        }
        if (armL) { armL.rotation.x = isRider ? -0.60 : -0.08; armL.rotation.z = isRider ? 0.08 : -0.05; }

        // Slender 2x12x2 Bone Legs (standing vs straddled on Spider Jockey!)
        for (const [lx, d] of [[-0.10, -1], [0.10, 1]]) {
          if (isRider) {
            const leg = mkPiv(tGrp, lx > 0 ? 0.14 : -0.14, 0.68, 0.05);
            leg.rotation.order = 'YXZ';
            const ry = (lx > 0 ? 0.46 : -0.46);
            leg.rotation.x = -1.26; leg.rotation.y = ry;
            addPart(leg, 0.12, 0.70, 0.12, sk.bone, 0, -0.35, 0, false, 0.74, 'stone');
            tAnim.legs.push({ p: leg, dir: d, isSeatedRider: true, restX: -1.26, restY: ry });
          } else {
            const leg = mkPiv(tGrp, lx, 0.70, 0);
            addPart(leg, 0.12, 0.70, 0.12, sk.bone, 0, -0.35, 0, false, 0.74, 'stone');
            tAnim.legs.push({ p: leg, dir: d });
          }
        }
      };

      if (_isSkelVariant) {
        buildSkeletonInto(g, anim, type, false);
        return finishCustom();
      }

      if (type === 'spider_jockey') {
        const spBm = instantiateBlenderMob('spider');
        const bio = getBiomeAt(wx, wz);
        const rv = (opts && opts.riderVariant) || (
          (bio === BIOMES.SNOW || bio === BIOMES.ALPINE_PEAKS || bio === BIOMES.TAIGA) ? 'stray' :
          (bio === BIOMES.DESERT ? 'desert_skeleton' :
          ((bio === BIOMES.SWAMP || bio === BIOMES.MANGROVE_SWAMP || bio === BIOMES.LUSH_GROVE) ? 'bogged' : 'skeleton'))
        );
        const mount = spBm || _baseBuildMobMesh('spider', wx, wz, null);
        const rGrp = new THREE.Group();
        rGrp.scale.setScalar(0.90);
        rGrp.position.set(0, -0.02, 0.06);
        const rAnim = { torso: null, head: null, jaw: null, core: null, legs: [], arms: [], wings: [], tail: null, bowIdle: null, bowAim: null };
        parts.length = 0;
        buildSkeletonInto(rGrp, rAnim, rv, true);
        for (let pi = 0; pi < parts.length; pi++) mount.parts.push(parts[pi]);
        mount.group.add(rGrp);
        mount.anim.rider = rAnim;
        mount.riderVariant = rv;
        if (!spBm) { mount.isPlaceholder = true; mount.pendingGlbKey = 'spider'; }
        return mount;
      }

      if (_isZombieVariant) {
        const zMap = {
          zombie:        { skin: 0x4d7336, shirt: 0x0e8a92, pants: 0x3b2db8, shoe: 0x26262b, eye: 0x141714 },
          husk:          { skin: 0xb79f6e, shirt: 0x998055, pants: 0x5c4328, shoe: 0x362618, eye: 0x2d2416 },
          frozen_zombie: { skin: 0x7bc2d9, shirt: 0x284b66, pants: 0x4b3b2a, shoe: 0x26323d, eye: 0x162430, frost: true },
          mossy_zombie:  { skin: 0x4d7569, shirt: 0x5c4230, pants: 0x3f2e22, shoe: 0x233328, eye: 0x11241c, moss: true }
        };
        const zp = zMap[type] || zMap.zombie;
        anim.torso = mkPiv(g, 0, 1.04, 0);
        addArt(anim.torso, 0.46, 0.68, 0.24, `v107_${type}_torso`, (ctx, h) => {
          h.fillAll(zp.shirt, 9, 'voxel', 8, -12);
          if (zp.frost) { for (const t of [0, 1, 4, 5]) h.capOverhang(t, 0xdcf4fc, 0x99d6f0, 5, 2); }
          if (zp.moss) { for (const t of [0, 1, 4, 5]) h.capOverhang(t, 0x4d7c0f, 0x365314, 5, 2); }
        }, 0, 0, 0, { rough: 0.80 });
        anim.head = mkPiv(anim.torso, 0, 0.34, 0);
        addArt(anim.head, 0.48, 0.48, 0.48, `v107_${type}_head`, (ctx, h) => {
          h.fillAll(zp.skin, 11, 'voxel', 10, -14);
          if (zp.frost) { h.fillTile(2, 0xe0f2fe, 8); for (const t of [0, 1, 4, 5]) h.capOverhang(t, 0xe0f2fe, 0xbae6fd, 4, 2); }
          if (zp.moss) { h.fillTile(2, 0x4d7c0f, 12); for (const t of [0, 1, 4, 5]) h.capOverhang(t, 0x4d7c0f, 0x365314, 4, 2); }
          h.px(4, 2, 8, 3, 2, zp.eye); h.px(4, 11, 8, 3, 2, zp.eye);
          h.px(4, 6, 10, 4, 2, zp.skin, -18);
        }, 0, 0.24, 0, { rough: 0.78 });
        for (const [sx, d] of [[0.34, 1], [-0.34, -1]]) {
          const arm = mkPiv(anim.torso, sx, 0.26, 0);
          addArt(arm, 0.21, 0.64, 0.21, `v107_${type}_arm`, (ctx, h) => {
            h.fillAll(zp.skin, 9, 'voxel', 8, -12);
            for (const t of [0, 1, 2, 4, 5]) h.px(t, 0, 0, 16, 6, zp.shirt);
          }, 0, -0.25, 0, { rough: 0.78 });
          arm.rotation.x = -1.42;
          anim.arms.push({ p: arm, dir: d });
        }
        for (const [lx, d] of [[-0.12, -1], [0.12, 1]]) {
          const leg = mkPiv(g, lx, 0.70, 0);
          addArt(leg, 0.22, 0.70, 0.22, `v107_${type}_leg`, (ctx, h) => {
            h.fillAll(zp.pants, 9, 'voxel', 6, -10);
            for (const t of [0, 1, 4, 5]) h.px(t, 0, 13, 16, 3, zp.shoe);
          }, 0, -0.35, 0, { rough: 0.80 });
          anim.legs.push({ p: leg, dir: d });
        }
        return finishCustom();
      }

      if (type === 'chicken' || type === 'chicken_jockey') {
        // Authentic Pixel-Art Chicken Mount (Images 4 & 5)
        anim.torso = mkPiv(g, 0, 0.41, 0);
        addArt(anim.torso, 0.38, 0.34, 0.48, 'v107_chicken_body', (ctx, h) => {
          h.fillAll(0xf4f6f8, 8, 'fur', 8, -12);
        }, 0, 0, 0, { rough: 0.82 });
        addPart(anim.torso, 0.22, 0.16, 0.12, 0xe2e8f0, 0, 0.08, -0.25, false, 0.84, 'fur');
        anim.head = mkPiv(anim.torso, 0, 0.14, 0.20);
        addArt(anim.head, 0.24, 0.34, 0.22, 'v107_chicken_head', (ctx, h) => {
          h.fillAll(0xf8fafc, 7, 'fur', 8, -10);
          h.px(4, 2, 4, 3, 3, 0x111114); h.px(4, 11, 4, 3, 3, 0x111114);
        }, 0, 0.15, 0.02, { rough: 0.80 });
        addArt(anim.head, 0.22, 0.11, 0.14, 'v107_chicken_beak', (ctx, h) => {
          h.fillAll(0xc49546, 8, 'voxel', 10, -14);
          h.px(2, 3, 10, 2, 3, 0x6b4f20); h.px(2, 11, 10, 2, 3, 0x6b4f20);
        }, 0, 0.09, 0.18, { rough: 0.74 });
        addPart(anim.head, 0.10, 0.11, 0.08, 0xdc2626, 0, -0.01, 0.14, false, 0.72); // red wattle
        for (const sx of [-1, 1]) {
          const wg = mkPiv(anim.torso, sx * 0.20, 0.09, 0);
          addPart(wg, 0.06, 0.20, 0.34, 0xe5e7eb, sx * 0.02, -0.08, -0.02, false, 0.84, 'fur');
          anim.wings.push({ p: wg, dir: sx });
          const lg = mkPiv(g, sx * 0.09, 0.24, 0);
          addPart(lg, 0.05, 0.22, 0.05, 0xd4a438, 0, -0.11, 0, false, 0.78);
          addPart(lg, 0.14, 0.03, 0.15, 0xd4a438, 0, -0.225, 0.04, false, 0.78);
          anim.legs.push({ p: lg, dir: sx });
        }
        if (type === 'chicken_jockey') {
          // Oversized-head Baby Zombie seated squarely on the Chicken's back (Images 4 & 5!)
          const rGrp = new THREE.Group();
          rGrp.position.set(0, 0.56, -0.05);
          const rAnim = { torso: null, head: null, legs: [], arms: [] };
          rAnim.torso = mkPiv(rGrp, 0, 0.16, 0);
          addArt(rAnim.torso, 0.24, 0.32, 0.14, 'v107_bz_torso', (ctx, h) => h.fillAll(0x0f949b, 8, 'voxel', 8, -10), 0, 0, 0, { rough: 0.80 });
          rAnim.head = mkPiv(rAnim.torso, 0, 0.16, 0);
          addArt(rAnim.head, 0.38, 0.38, 0.38, 'v107_bz_head', (ctx, h) => {
            h.fillAll(0x4d7336, 11, 'voxel', 10, -14);
            h.px(4, 2, 8, 3, 2, 0x141714); h.px(4, 11, 8, 3, 2, 0x141714);
            h.px(4, 6, 10, 4, 2, 0x3b5927);
          }, 0, 0.19, 0, { rough: 0.78 });
          for (const [sx, d] of [[0.18, 1], [-0.18, -1]]) {
            const arm = mkPiv(rAnim.torso, sx, 0.11, 0);
            addArt(arm, 0.11, 0.32, 0.11, 'v107_bz_arm', (ctx, h) => {
              h.fillAll(0x4d7336, 9, 'voxel', 8, -12);
              for (const t of [0, 1, 2, 4, 5]) h.px(t, 0, 0, 16, 6, 0x0f949b);
            }, 0, -0.13, 0, { rough: 0.78 });
            arm.rotation.x = -1.48;
            rAnim.arms.push({ p: arm, dir: d });
          }
          for (const [lx, d] of [[-0.075, -1], [0.075, 1]]) {
            const leg = mkPiv(rGrp, lx, 0.03, 0.02);
            leg.rotation.order = 'YXZ';
            const ry = (lx > 0 ? 0.28 : -0.28);
            leg.rotation.x = -1.26; leg.rotation.y = ry;
            addArt(leg, 0.11, 0.32, 0.11, 'v107_bz_leg', (ctx, h) => {
              h.fillAll(0x3b2db8, 8, 'voxel', 6, -10);
              for (const t of [0, 1, 4, 5]) h.px(t, 0, 12, 16, 4, 0x22242a);
            }, 0, -0.15, 0, { rough: 0.80 });
            rAnim.legs.push({ p: leg, dir: d, isSeatedRider: true, restX: -1.26, restY: ry });
          }
          g.add(rGrp);
          anim.rider = rAnim;
        }
        return finishCustom();
      }

      if (type === 'cinnamon_ferret') {
        anim.torso = mkPiv(g, 0, 0.28, 0);
        addPart(anim.torso, 0.30, 0.24, 0.78, 0xb46b45, 0, 0, 0, false, 0.82, 'fur');
        addPart(anim.torso, 0.24, 0.08, 0.62, 0xfde68a, 0, -0.16, 0, false, 0.82, 'fur');
        anim.head = mkPiv(anim.torso, 0, 0.08, 0.39);
        addArt(anim.head, 0.28, 0.24, 0.28, 'v95_ferret_hd', (ctx, h) => {
          h.fillAll(0xc27850, 10, 'fur', 10, -14);
          h.cuteFace(4, { eyeY: 6, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x18181b, sclera: 0xffffff, blushCol: 0xf472b6, noseCol: 0xf472b6, sparkle: true });
        }, 0, 0.02, 0.14, { rough: 0.82 });
        addPart(anim.head, 0.08, 0.08, 0.04, 0xfde68a, -0.12, 0.18, 0.08);
        addPart(anim.head, 0.08, 0.08, 0.04, 0xfde68a,  0.12, 0.18, 0.08);
        anim.tail = mkPiv(anim.torso, 0, 0.02, -0.39);
        addPart(anim.tail, 0.14, 0.14, 0.56, 0x92400e, 0, 0.04, -0.28, false, 0.84, 'fur');
        for (const [sx, sz, d] of [[-0.11, 0.24, 1], [0.11, 0.24, -1], [-0.11, -0.24, -1], [0.11, -0.24, 1]]) {
          const leg = mkPiv(g, sx, 0.16, sz); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.10, 0.16, 0.10, 0x78350f, 0, -0.08, 0);
        }
        return finishCustom();
      }


      if (type === 'mini_abomination') {
        anim.torso = mkPiv(g, 0, 0.48, 0);
        addArt(anim.torso, 0.62, 0.54, 0.54, 'v95_mini_abom', (ctx, h) => {
          h.fillAll(0x1f2937, 14, 'stone', 10, -14);
          h.cuteFace(4, { eyeY: 6, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x22d3ee, noseCol: 0xf472b6, noseY: 10 });
        }, 0, 0.05, 0, { rough: 0.80 });
        addPart(anim.torso, 0.70, 0.14, 0.58, 0x365314, 0, 0.39, 0, false, 0.84, 'wool');
        addPart(anim.torso, 0.12, 0.26, 0.10, 0x4d7c0f, -0.26, 0.59, 0);
        addPart(anim.torso, 0.12, 0.26, 0.10, 0x4d7c0f,  0.26, 0.59, 0);
        for (const [sx, d] of [[-0.20, 1], [0.20, -1]]) {
          const leg = mkPiv(g, sx, 0.24, 0); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.20, 0.24, 0.22, 0x111827, 0, -0.12, 0);
        }
        return finishCustom();
      }


      const edc = ELEMENTAL_DRAGON_CFG[type];
      if (edc) {
        const DRAGON_STAGES = [
          { sc: 0.30, headMul: 1.32, wingMul: 0.40, hornMul: 0.00, crestMul: 0.40 },
          { sc: 0.48, headMul: 1.18, wingMul: 0.58, hornMul: 0.45, crestMul: 0.62 },
          { sc: 0.70, headMul: 1.08, wingMul: 0.78, hornMul: 0.75, crestMul: 0.80 },
          { sc: 0.92, headMul: 1.02, wingMul: 0.94, hornMul: 0.92, crestMul: 0.95 },
          { sc: 1.16, headMul: 1.00, wingMul: 1.06, hornMul: 1.04, crestMul: 1.04 }
        ];
        const dStage = Math.max(0, Math.min(4, (opts && typeof opts.dragonStage === 'number') ? (opts.dragonStage | 0) : 4));
        const st = DRAGON_STAGES[dStage];
        const dRoot = mkPiv(g, 0, 0, 0);
        dRoot.scale.setScalar(st.sc);
        anim.root = dRoot;
        g.userData.dragonStage = dStage;
        g.userData.dragonScale = st.sc;

        const wMul = (edc.el === 'earth') ? 1.16 : 1.0;
        const hM = st.headMul, wM = st.wingMul, hnM = st.hornMul, crM = st.crestMul;
        const roughBody = edc.el === 'ice' ? 0.36 : (edc.el === 'water' ? 0.46 : 0.74);

        anim.torso = mkPiv(dRoot, 0, 1.18, 0);
        addArt(anim.torso, 1.10 * wMul, 0.78, 1.84, `v102_${type}_torso`, (ctx, h) => {
          h.fillAll(edc.body, 11, edc.el === 'earth' ? 'stone' : 'voxel', 12, -16);
          h.px(3, 2, 2, 12, 12, edc.belly);
          h.px(2, 6, 1, 4, 14, edc.crest);
        }, 0, 0, 0, { rough: roughBody });
        addPart(anim.torso, 0.86 * wMul, 0.16, 1.62, edc.belly, 0, -0.472, 0.02, false, roughBody);
        const corePiv = mkPiv(anim.torso, 0, -0.02, 0.965);
        addPart(corePiv, 0.28, 0.28, 0.08, edc.crest, 0, 0, 0, true);
        anim.core = corePiv;

        // Toggleable 3D Dragon Riding Saddle (mounted cleanly on back between dorsal crests)
        const saddleGrp = mkPiv(anim.torso, 0, 0.394, 0.16);
        saddleGrp.visible = !!(opts && opts.saddled);
        anim.saddleGroup = saddleGrp;
        addPart(saddleGrp, 0.82 * wMul, 0.11, 0.54, 0x7f1d1d, 0, 0.055, 0, false, 0.65);
        addPart(saddleGrp, 0.56 * wMul, 0.14, 0.10, 0xf59e0b, 0, 0.18, 0.22, false, 0.35);
        addPart(saddleGrp, 0.62 * wMul, 0.12, 0.10, 0x991b1b, 0, 0.17, -0.22, false, 0.55);
        addPart(saddleGrp, 0.18, 0.10, 0.04, 0x22d3ee, 0, 0.18, 0.292, true);
        for (const sx of [-1, 1]) {
          addPart(saddleGrp, 0.06, 0.38, 0.08, 0x450a0a, sx * (0.55 * wMul + 0.032), -0.14, 0.0, false, 0.70);
          addPart(saddleGrp, 0.10, 0.08, 0.14, 0xfbbf24, sx * (0.55 * wMul + 0.032), -0.37, 0.0, false, 0.30);
        }

        if (dStage >= 1) {
          const dorsalZ = [0.68, -0.26, -0.58];
          for (let di = 0; di < dorsalZ.length; di++) {
            const sh = (0.28 - di * 0.03) * crM;
            const col = (edc.el === 'fire' && di % 2) ? 0xfacc15 : edc.crest;
            addPart(anim.torso, edc.el === 'earth' ? 0.28 : 0.12, sh, 0.20, col, 0, 0.392 + sh * 0.5, dorsalZ[di], edc.el === 'fire', 0.55);
          }
        }

        // 2-Segment Arched Neck + Sculpted Dragon Head + Snout + Articulated Jaw
        const neck1 = mkPiv(anim.torso, 0, 0.20, 0.922);
        anim.neck1 = neck1;
        addPart(neck1, 0.54, 0.46, 0.44, edc.body, 0, 0.14, 0.22, false, roughBody);
        addPart(neck1, 0.36, 0.10, 0.40, edc.belly, 0, -0.142, 0.22, false, roughBody);
        if (dStage >= 1) addPart(neck1, 0.10, 0.22 * crM, 0.16, edc.crest, 0, 0.372 + 0.11 * crM, 0.22, edc.el === 'fire', 0.55);

        const neck2 = mkPiv(neck1, 0, 0.28, 0.442);
        addPart(neck2, 0.46, 0.42, 0.44, edc.body, 0, 0.14, 0.22, false, roughBody);
        if (dStage >= 1) addPart(neck2, 0.10, 0.20 * crM, 0.16, edc.crest, 0, 0.352 + 0.10 * crM, 0.22, edc.el === 'fire', 0.55);

        anim.head = mkPiv(neck2, 0, 0.24, 0.444);
        anim.head.scale.setScalar(hM);
        addArt(anim.head, 0.88, 0.68, 0.80, `v102_${type}_head`, (ctx, h) => {
          h.fillAll(edc.head, 10, edc.el === 'earth' ? 'stone' : 'voxel', 10, -14);
          h.px(4, 3, 2, 10, 8, edc.belly);
        }, 0, 0.20, 0.40, { rough: roughBody });
        for (const sx of [-1, 1]) {
          addPart(anim.head, 0.04, 0.11, 0.18, edc.eye, sx * 0.462, 0.24, 0.56, true);
          addPart(anim.head, 0.06, 0.09, 0.34, edc.horn, sx * 0.462, 0.345, 0.52, false, 0.68);
        }
        addPart(anim.head, 0.58, 0.32, 0.52, edc.head, 0, 0.14, 1.062, false, roughBody);
        for (const sx of [-1, 1]) addPart(anim.head, 0.11, 0.08, 0.10, edc.crest, sx * 0.17, 0.342, 1.22, true);
        anim.jaw = mkPiv(anim.head, 0, -0.024, 0.72);
        addPart(anim.jaw, 0.52, 0.15, 0.58, edc.belly, 0, -0.078, 0.29, false, roughBody);
        for (const sx of [-1, 1]) addPart(anim.jaw, 0.07, 0.08, 0.07, 0xfafaf9, sx * 0.18, 0.042, 0.50, false, 0.35);

        if (hnM > 0.05) {
          if (edc.el === 'fire' || edc.el === 'earth') {
            if (edc.el === 'earth') addPart(anim.head, 0.18, 0.34 * hnM, 0.18, edc.horn, 0, 0.302 + 0.17 * hnM, 1.16, false, 0.88, 'stone');
            for (const sx of [-1, 1]) {
              const mh = addPart(anim.head, 0.14, 0.62 * hnM, 0.14, edc.horn, sx * 0.28, 0.542 + 0.24 * hnM, 0.18, false, 0.62);
              mh.rotation.x = -0.45; mh.rotation.z = sx * -0.18;
              addPart(anim.head, 0.22 * hnM, 0.10, 0.12, edc.crest, sx * (0.442 + 0.11 * hnM), 0.18, 0.20, edc.el === 'fire', 0.68);
            }
          } else if (edc.el === 'ice') {
            for (const sx of [-1, 1]) {
              const icH = addPart(anim.head, 0.13, 0.68 * hnM, 0.14, edc.horn, sx * 0.28, 0.542 + 0.26 * hnM, 0.18, false, 0.22, 'crystal');
              icH.rotation.x = -0.38;
              addPart(anim.head, 0.12, 0.30 * hnM, 0.10, 0xe0f2fe, sx * 0.50, 0.30, 0.20, true);
            }
          } else if (edc.el === 'water') {
            for (const sx of [-1, 1]) {
              const wh = addPart(anim.head, 0.10, 0.52 * hnM, 0.22, edc.crest, sx * 0.28, 0.542 + 0.20 * hnM, 0.16, false, 0.30);
              wh.rotation.x = -0.52;
              addPart(anim.head, 0.08, 0.34 * hnM, 0.26, edc.horn, sx * 0.484, 0.14, 0.26, false, 0.32);
            }
          } else {
            for (const sx of [-1, 1]) {
              const ant = addPart(anim.head, 0.12, 0.56 * hnM, 0.12, edc.horn, sx * 0.28, 0.542 + 0.24 * hnM, 0.20, false, 0.84);
              ant.rotation.z = sx * -0.18;
              addPart(anim.head, 0.32 * hnM, 0.20 * hnM, 0.28 * hnM, edc.el === 'tree' ? 0x3a7d34 : edc.belly, sx * 0.32, 0.542 + 0.54 * hnM, 0.20, false, 0.80, 'wool');
              addFlower(anim.head, edc.crest, 0xfef08a, sx * 0.32, 0.542 + 0.64 * hnM, 0.22, 0.9 * hnM);
            }
          }
        }

        // 2-Joint Articulated Ribbed Wings (zero coplanar overlap across arm spars, elbow & 3 splayed finger membranes)
        const len1 = 1.38 * wM, len2 = 1.92 * wM;
        const memCol = edc.wing, sparCol = edc.body, clawCol = edc.horn;
        const memGlow = (edc.el === 'fire' || edc.el === 'ice');
        const memRough = Math.max(0.42, roughBody - 0.14);
        for (const sx of [-1, 1]) {
          const wp = mkPiv(anim.torso, sx * (0.55 * wMul + 0.02), 0.30, 0.38);
          addPart(wp, len1, 0.14, 0.15, sparCol, sx * (len1 * 0.5), 0, 0, false, roughBody);
          addPart(wp, len1 * 0.94, 0.068, 1.18 * wM, memCol, sx * (len1 * 0.48), -0.04, -(0.08 + 0.59 * wM), memGlow, memRough);
          const outer = mkPiv(wp, sx * (len1 + 0.01), 0, 0);
          addPart(outer, 0.14, 0.18, 0.18, clawCol, 0, 0.095, 0.11, false, 0.68);
          addPart(outer, len2, 0.11, 0.12, sparCol, sx * (len2 * 0.5), 0, 0, false, roughBody);
          addPart(outer, 0.16, 0.12, 0.16, clawCol, sx * (len2 + 0.08), 0.0, 0.02, false, 0.68);
          const ribs = [
            { ang: -0.34, len: len2 * 0.92, yOff: -0.035, memD: 0.86 * wM },
            { ang: -0.74, len: len2 * 0.80, yOff: -0.090, memD: 0.76 * wM },
            { ang: -1.12, len: len2 * 0.66, yOff: -0.145, memD: 0.66 * wM }
          ];
          for (const rb of ribs) {
            const rPiv = mkPiv(outer, 0, rb.yOff, -0.065);
            rPiv.rotation.y = sx * rb.ang;
            addPart(rPiv, rb.len, 0.055, 0.075, sparCol, sx * (rb.len * 0.5), 0, 0, false, roughBody);
            addPart(rPiv, rb.len * 0.88, 0.050, rb.memD, memCol, sx * (rb.len * 0.44), 0, -(0.042 + rb.memD * 0.5), memGlow, memRough);
          }
          anim.wings.push({ p: wp, outer, dir: sx, isDragonWing: true });
        }

        // 3-Segment Articulated Tail + Elemental Fin
        anim.tail = mkPiv(anim.torso, 0, 0.06, -0.922);
        addPart(anim.tail, 0.46, 0.40, 0.96, edc.body, 0, 0, -0.48, false, roughBody);
        if (dStage >= 1) addPart(anim.tail, 0.10, 0.22 * crM, 0.18, edc.crest, 0, 0.202 + 0.11 * crM, -0.48, edc.el === 'fire', 0.55);

        const tail2 = mkPiv(anim.tail, 0, 0, -0.964);
        anim.tail2 = tail2;
        addPart(tail2, 0.34, 0.30, 0.90, edc.body, 0, 0, -0.45, false, roughBody);
        if (dStage >= 1) addPart(tail2, 0.09, 0.18 * crM, 0.16, edc.crest, 0, 0.152 + 0.09 * crM, -0.45, edc.el === 'fire', 0.55);

        const tail3 = mkPiv(tail2, 0, 0, -0.904);
        anim.tail3 = tail3;
        addPart(tail3, 0.22, 0.20, 0.72, edc.crest, 0, 0, -0.36, edc.el === 'fire', 0.60);
        if (edc.el === 'ice') addPart(tail3, 0.72, 0.12, 0.40, edc.horn, 0, 0, -0.922, false, 0.22, 'crystal');
        else if (edc.el === 'water') addPart(tail3, 1.12, 0.09, 0.48, edc.horn, 0, 0, -0.962, false, 0.30);
        else if (edc.el === 'earth') addPart(tail3, 0.56, 0.42, 0.52, edc.horn, 0, 0, -0.982, false, 0.88, 'stone');
        else if (edc.el === 'fire') { for (const sx of [-1, 1]) addPart(tail3, 0.14, 0.24, 0.44, 0xf97316, sx * 0.18, 0.02, -0.942, true); }
        else if (edc.el === 'tree') { addPart(tail3, 0.56, 0.28, 0.48, 0x3a7d34, 0, 0, -0.962, false, 0.82, 'wool'); addFlower(tail3, edc.crest, 0xfef08a, 0, 0.142, -0.962, 1.1); }
        else { for (const sx of [-1, 1]) addPart(tail3, 0.40, 0.09, 0.48, edc.wing, sx * 0.22, 0.02, -0.962, false, 0.78, 'wool'); }

        // 2 Clawed Hind Wyvern Legs ONLY (RLCraft-style bipedal Wyvern!)
        const legX = 0.55 * wMul + 0.16;
        for (const [lx, lz, d] of [[-legX, -0.34, -1], [legX, -0.34, 1]]) {
          const leg = mkPiv(anim.torso, lx, -0.20, lz);
          anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.34, 0.46, 0.40, edc.body, 0, -0.22, 0.08, false, roughBody);
          addPart(leg, 0.24, 0.42, 0.26, edc.body, 0, -0.62, -0.02, false, roughBody);
          addPart(leg, 0.34, 0.12, 0.42, edc.horn, 0, -0.92, 0.08, false, 0.72);
          for (const cx of [-0.11, 0.0, 0.11]) addPart(leg, 0.06, 0.08, 0.14, 0xe7e5e4, cx, -0.94, 0.34, false, 0.38);
        }
        return finishCustom();
      }


      // === ALL 19 Cute Pastel Voxel Plush Mobs (Image 10 — zero overlapping parts, data-driven FerriteCore!) ===
      const PLUSH_CFG = {
        plush_slime_mint:       { kind: 'slime',  c1: 0x6ee7b7, c2: 0x34d399, dec: 'leaf',   dc1: 0x22c55e, dc2: 0xfef08a },
        plush_strawberry_slime: { kind: 'slime',  c1: 0xf43f5e, c2: 0xfecdd3, dec: 'bow',    dc1: 0xfacc15, dc2: 0xfef08a },
        plush_allay_lavender:   { kind: 'chibi',  c1: 0x7c3aed, c2: 0xa78bfa, dec: 'crown',  dc1: 0xf472b6, fly: true },
        plush_zombie_chibi:     { kind: 'chibi',  c1: 0x4ade80, c2: 0x2563eb, dec: 'flower', dc1: 0xf472b6, dc2: 0xfef08a },
        plush_creeper_blossom:  { kind: 'chibi',  c1: 0x4ade80, c2: 0x16a34a, dec: 'bow',    dc1: 0xf472b6, leg4: true },
        plush_enderman_ribbon:  { kind: 'chibi',  c1: 0x1e1b2e, c2: 0xa855f7, dec: 'bowtie', dc1: 0xc084fc, eyeGlow: 0xe879f9, slim: true },
        plush_bear_teal:        { kind: 'plush2', c1: 0x2dd4bf, c2: 0x99f6e4, dec: 'flower', dc1: 0xf472b6, dc2: 0xfacc15, ears: 'round' },
        plush_panda_berry:      { kind: 'plush2', c1: 0xf8fafc, c2: 0x4f46e5, dec: 'flower', dc1: 0xa855f7, dc2: 0xfacc15, ears: 'round' },
        plush_bat_heart:        { kind: 'bat',    c1: 0x4338ca, c2: 0x818cf8, dec: 'flower', dc1: 0xfef08a, dc2: 0xffffff },
        plush_duckling_bow:     { kind: 'bird',   c1: 0xfacc15, c2: 0xf97316, dec: 'bow',    dc1: 0xef4444 },
        plush_chicken_daisy:    { kind: 'bird',   c1: 0xf8fafc, c2: 0xfacc15, dec: 'flower', dc1: 0xfacc15, dc2: 0xffffff },
        plush_pig_crown:        { kind: 'quad',   c1: 0xf9a8d4, c2: 0xf472b6, dec: 'crown',  dc1: 0xfacc15, snout: true },
        plush_cow_flower:       { kind: 'quad',   c1: 0xf5f5f4, c2: 0xb47b56, dec: 'flower', dc1: 0x60a5fa, dc2: 0xf472b6, snout: true },
        plush_sheep_sakura:     { kind: 'quad',   c1: 0xfbcfe8, c2: 0x6ee7b7, dec: 'flower', dc1: 0xf43f5e, dc2: 0xfef08a, wool: true },
        plush_fox_berry:        { kind: 'quad',   c1: 0xf97316, c2: 0xfafaf9, dec: 'leaf',   dc1: 0x14b8a6, ears: 'point' },
        plush_wolf_bow:         { kind: 'quad',   c1: 0xf8fafc, c2: 0xcbd5e1, dec: 'bow',    dc1: 0x3b82f6, ears: 'point' },
        plush_llama_bow:        { kind: 'quad',   c1: 0xfef3c7, c2: 0xe7d3a3, dec: 'bow',    dc1: 0xf59e0b, tallNeck: true },
        plush_turtle_flower:    { kind: 'turtle', c1: 0x22c55e, c2: 0x15803d, dec: 'flower', dc1: 0xec4899, dc2: 0xfef08a },
        plush_axolotl_hat:      { kind: 'axolotl',c1: 0xf472b6, c2: 0xfbcfe8, dec: 'hat',    dc1: 0xf8fafc }
      };
      const pc = PLUSH_CFG[type] || PLUSH_CFG.plush_pig_crown;
      if (pc.kind === 'slime') {
        anim.torso = mkPiv(g, 0, 0.34, 0);
        addArt(anim.torso, 0.56, 0.50, 0.56, `v92_${type}`, (ctx, h) => {
          h.fillAll(pc.c1, 8, 'crystal', 16, -14);
          h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x1e293b, sparkle: true, blushCol: pc.c2 });
        }, 0, 0, 0, { rough: 0.35 });
        if (pc.dec === 'bow') addBow(anim.torso, pc.dc1, 0.18, 0.28, 0.24, 0.9);
        else addFlower(anim.torso, pc.dc2, pc.dc1, 0, 0.25, 0.05, 0.9);
      } else if (pc.kind === 'bat') {
        anim.torso = mkPiv(g, 0, 0.45, 0);
        addArt(anim.torso, 0.46, 0.42, 0.42, `v92_${type}`, (ctx, h) => {
          h.fillAll(pc.c1, 10, 'fur', 10, -14);
          h.px(2, 4, 4, 8, 8, pc.c2);
          h.cuteFace(4, { eyeY: 6, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, sparkle: true, blushCol: 0xf472b6 });
        }, 0, 0, 0, { rough: 0.78 });
        addFlower(anim.torso, pc.dc2, pc.dc1, -0.14, 0.21, 0.14, 0.8);
        for (const sx of [-1, 1]) {
          addPart(anim.torso, 0.10, 0.14, 0.06, pc.c2, sx * 0.15, 0.28, 0);
          const wp = mkPiv(anim.torso, sx * 0.24, 0.04, 0);
          addPart(wp, 0.38, 0.06, 0.30, pc.c2, sx * 0.19, 0, 0);
          anim.wings.push({ p: wp, dir: sx });
        }
      } else if (pc.kind === 'bird') {
        anim.torso = mkPiv(g, 0, 0.34, 0);
        addPart(anim.torso, 0.42, 0.36, 0.46, pc.c1, 0, 0, 0, false, 0.82, 'fur');
        anim.head = mkPiv(anim.torso, 0, 0.22, 0.12);
        addArt(anim.head, 0.36, 0.34, 0.34, `v92_${type}_hd`, (ctx, h) => {
          h.fillAll(pc.c1, 8, 'fur', 10, -12);
          h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x111827, sparkle: true, blushCol: 0xfca5a5 });
        }, 0, 0.14, 0.04, { rough: 0.80 });
        addPart(anim.head, 0.16, 0.08, 0.12, pc.c2, 0, 0.08, 0.265);
        if (pc.dec === 'bow') addBow(anim.head, pc.dc1, 0, 0.34, 0.10, 0.9);
        else addFlower(anim.head, pc.dc2, pc.dc1, 0.16, 0.24, 0.14, 0.85);
        for (const sx of [-1, 1]) {
          const wp = mkPiv(anim.torso, sx * 0.23, 0.06, 0); anim.wings.push({ p: wp, dir: sx });
          addPart(wp, 0.06, 0.22, 0.30, pc.c1, sx * 0.03, -0.06, 0);
          const leg = mkPiv(g, sx * 0.10, 0.16, 0); anim.legs.push({ p: leg, dir: sx });
          addPart(leg, 0.08, 0.16, 0.10, 0xf97316, 0, -0.08, 0);
        }
      } else if (pc.kind === 'turtle' || pc.kind === 'axolotl') {
        anim.torso = mkPiv(g, 0, 0.24, 0);
        addPart(anim.torso, 0.56, 0.26, 0.68, pc.c2, 0, 0, 0, false, 0.78);
        anim.head = mkPiv(anim.torso, 0, 0.04, 0.36);
        addArt(anim.head, 0.44, 0.30, 0.38, `v92_${type}_hd`, (ctx, h) => {
          h.fillAll(pc.c1, 8, 'voxel', 10, -14);
          h.cuteFace(4, { eyeY: 6, eyeSep: 2, eyeW: 2, eyeH: 2, eyeCol: 0x0f172a, sparkle: true, blushCol: 0xf43f5e });
        }, 0, 0.04, 0.19, { rough: 0.78 });
        if (pc.kind === 'axolotl') {
          for (const sx of [-1, 1]) addPart(anim.head, 0.14, 0.22, 0.06, 0xe11d48, sx * 0.29, 0.06, 0.16);
          addPart(anim.head, 0.36, 0.05, 0.36, pc.dc1, 0, 0.22, 0.18);
          addPart(anim.head, 0.24, 0.10, 0.24, 0xe2e8f0, 0, 0.29, 0.18);
          anim.tail = mkPiv(anim.torso, 0, 0, -0.34); addPart(anim.tail, 0.10, 0.14, 0.34, pc.c2, 0, 0, -0.17);
        } else {
          addFlower(anim.head, pc.dc1, pc.dc2, 0, 0.19, 0.18, 0.95);
        }
        for (const [lx, lz, d] of [[-0.22, 0.24, 1], [0.22, 0.24, -1], [-0.22, -0.24, -1], [0.22, -0.24, 1]]) {
          const leg = mkPiv(g, lx, 0.14, lz); anim.legs.push({ p: leg, dir: d });
          addPart(leg, 0.12, 0.14, 0.12, pc.c1, 0, -0.07, 0);
        }
      } else if (pc.kind === 'chibi' || pc.kind === 'plush2') {
        const wB = pc.slim ? 0.36 : 0.44, hB = pc.slim ? 0.56 : 0.44;
        anim.torso = mkPiv(g, 0, 0.50, 0);
        addPart(anim.torso, wB, hB, 0.30, pc.c2, 0, 0, 0, false, 0.82);
        anim.head = mkPiv(anim.torso, 0, hB * 0.5, 0);
        addArt(anim.head, 0.50, 0.48, 0.48, `v92_${type}_hd`, (ctx, h) => {
          h.fillAll(pc.c1, 8, 'voxel', 10, -14);
          h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: pc.eyeGlow || 0x111827, sparkle: !pc.eyeGlow, blushCol: 0xf472b6 });
        }, 0, 0.25, 0, { rough: 0.78 });
        if (pc.ears === 'round') { for (const sx of [-1, 1]) addPart(anim.head, 0.14, 0.14, 0.10, pc.c2, sx * 0.22, 0.56, 0); }
        if (pc.dec === 'bow') addBow(anim.head, pc.dc1, -0.18, 0.50, 0.25, 0.9);
        else if (pc.dec === 'bowtie') addBow(anim.torso, pc.dc1, 0, 0.12, 0.18, 0.85);
        else if (pc.dec === 'flower') addFlower(anim.head, pc.dc1, pc.dc2 || 0xfef08a, 0.16, 0.49, 0.14, 0.9);
        else if (pc.dec === 'crown') addPart(anim.head, 0.28, 0.12, 0.24, pc.dc1, 0, 0.55, 0);
        if (pc.fly) { for (const sx of [-1, 1]) { const wp = mkPiv(anim.torso, sx * 0.22, 0.12, -0.14); addPart(wp, 0.26, 0.22, 0.04, 0xe9d5ff, sx * 0.14, 0, -0.04); anim.wings.push({ p: wp, dir: sx }); } }
        else if (!pc.leg4) { for (const [sx, d] of [[-(wB * 0.5 + 0.10), 1], [wB * 0.5 + 0.10, -1]]) { const ar = mkPiv(anim.torso, sx, 0.14, 0); addPart(ar, 0.14, 0.34, 0.14, pc.c1, 0, -0.17, 0); anim.arms.push({ p: ar, dir: d }); } }
        const lp = pc.leg4 ? [[-0.14, 0.10, 1], [0.14, 0.10, -1], [-0.14, -0.10, -1], [0.14, -0.10, 1]] : [[-0.12, 0, 1], [0.12, 0, -1]];
        for (const [lx, lz, d] of lp) { const leg = mkPiv(g, lx, 0.28, lz); addPart(leg, 0.15, 0.28, 0.16, pc.c2, 0, -0.14, 0); anim.legs.push({ p: leg, dir: d }); }
      } else {
        // Cute Pastel Quadrupeds (pig_crown, cow_flower, sheep_sakura, fox_berry, wolf_bow, llama_bow)
        anim.torso = mkPiv(g, 0, 0.44, 0);
        addPart(anim.torso, 0.54, 0.44, 0.68, pc.c1, 0, 0, 0, false, pc.wool ? 0.92 : 0.82, pc.wool ? 'wool' : 'voxel');
        addPart(anim.torso, 0.55, 0.14, 0.34, pc.c2, 0, 0.02, -0.05, false, 0.84);
        anim.head = mkPiv(anim.torso, 0, pc.tallNeck ? 0.34 : 0.12, 0.36);
        if (pc.tallNeck) addPart(anim.head, 0.26, 0.30, 0.26, pc.c1, 0, -0.05, -0.06);
        addArt(anim.head, 0.44, 0.40, 0.40, `v92_${type}_hd`, (ctx, h) => {
          h.fillAll(pc.c1, 8, 'voxel', 10, -14);
          h.cuteFace(4, { eyeY: 7, eyeSep: 3, eyeW: 2, eyeH: 2, eyeCol: 0x111827, sparkle: true, blushCol: 0xf472b6 });
        }, 0, 0.12, 0.14, { rough: 0.80 });
        if (pc.snout) addPart(anim.head, 0.22, 0.13, 0.09, pc.c2, 0, 0.05, 0.39);
        if (pc.ears === 'point') { for (const sx of [-1, 1]) addPart(anim.head, 0.10, 0.14, 0.07, pc.c1, sx * 0.14, 0.39, 0.10); }
        if (pc.dec === 'crown') { addPart(anim.head, 0.32, 0.09, 0.32, pc.dc1, 0, 0.37, 0.14); addFlower(anim.head, 0xf472b6, 0xfef08a, 0, 0.42, 0.22, 0.8); }
        else if (pc.dec === 'bow') addBow(anim.head, pc.dc1, 0.16, 0.34, 0.24, 0.9);
        else if (pc.dec === 'flower' || pc.dec === 'leaf') addFlower(anim.head, pc.dc1, pc.dc2 || 0xfef08a, -0.14, 0.33, 0.18, 0.9);
        anim.tail = mkPiv(anim.torso, 0, 0.04, -0.35); addPart(anim.tail, 0.14, 0.14, 0.26, pc.c2, 0, 0, -0.13);
        for (const [lx, lz, d] of [[-0.17, 0.22, 1], [0.17, 0.22, -1], [-0.17, -0.22, -1], [0.17, -0.22, 1]]) {
          const leg = mkPiv(g, lx, 0.22, lz); addPart(leg, 0.14, 0.22, 0.14, pc.c1, 0, -0.11, 0);
          anim.legs.push({ p: leg, dir: d });
        }
      }
      return finishCustom();
    }

    if (type === 'cluckshroom' || type === 'wooly_cow') {
      const mCfg = {
        cluckshroom: { base: 'chicken', tint: 0xf87171 },
        wooly_cow:   { base: 'cow',     tint: 0xfdba74 }
      }[type];
      const bm = tintBlenderMob(instantiateBlenderMob(mCfg.base), mCfg.tint, mCfg);
      if (bm) {
        if (type === 'cluckshroom' && bm.anim.head) {
          const hb = localBounds(bm.anim.head);
          makePartBox(bm, bm.anim.head, 0.07, 0.10, 0.07, 0xfef2f2, 0, hb.max.y + 0.05, 0);
          makePartBox(bm, bm.anim.head, 0.20, 0.10, 0.20, 0xdc2626, 0, hb.max.y + 0.15, 0);
        } else if (type === 'wooly_cow') {
          if (bm.anim.head) { const hb = localBounds(bm.anim.head); makePartBox(bm, bm.anim.head, 0.50, 0.14, 0.44, 0xfef3c7, 0, hb.max.y + 0.07, (hb.min.z + hb.max.z) * 0.5); }
          makePartBox(bm, bm.group, 0.80, 0.56, 1.00, 0xea8c55, 0, 0.68, -0.02);
        }
        return bm;
      }
      const fb = _baseBuildMobMesh(mCfg.base, wx, wz, opts);
      if (fb) {
        tintBlenderMob(fb, mCfg.tint, mCfg);
        fb.isPlaceholder = true;
        fb.pendingGlbKey = mCfg.base;
      }
      return fb;
    }

    return _baseBuildMobMesh(type, wx, wz, opts);
  };


  // ===================== 108 NEW WILDLIFE & AQUATIC FISH SPECIES REGISTRY =====================
  // Compact tuple format: [id, name, arch, c1, c2, c3, scale, hp, speed, biomes, flags]
  // flags: 'a'=aquatic, 'f'=skyBird/fly, 'n'=neutral, 'h'=hopper, 'g'=glow
  const ANIMAL_SPECIES = [
    // 22 Aquatic Fish & Marine Life (swim smoothly underwater in rivers, lakes & deep oceans!)
    ['fish_clown',      'Cá Hề Cam',             'fish', 0xf97316, 0xffffff, 0x18181b, 0.55, 4,  2.2, 'ocean,beach,sakura', 'a'],
    ['fish_salmon',     'Cá Hồi Đỏ',             'fish', 0xdc2626, 0x38bdf8, 0xfca5a5, 0.72, 5,  2.5, 'ocean,plains,taiga,alpine', 'a'],
    ['fish_cod',        'Cá Tuyết Biển',         'fish', 0xcbd5e1, 0x64748b, 0xf1f5f9, 0.68, 4,  2.2, 'ocean,beach,snow', 'a'],
    ['fish_puffer',     'Cá Nóc Vàng',           'fish', 0xfacc15, 0xfef9c3, 0x92400e, 0.60, 5,  1.6, 'ocean,beach', 'a'],
    ['fish_tang_blue',  'Cá Đuôi Gai Xanh',      'fish', 0x2563eb, 0xfacc15, 0x1e293b, 0.58, 4,  2.4, 'ocean,beach', 'a'],
    ['fish_tang_gold',  'Cá Bướm Vàng',          'fish', 0xfbbf24, 0x18181b, 0xffffff, 0.55, 4,  2.3, 'ocean,beach', 'a'],
    ['fish_angel',      'Cá Thần Tiên',          'fish', 0x38bdf8, 0xe0f2fe, 0x0284c7, 0.62, 4,  2.1, 'ocean,beach', 'a'],
    ['fish_tuna',       'Cá Ngừ Đại Dương',      'fish', 0x1d4ed8, 0xe2e8f0, 0x94a3b8, 0.95, 8,  3.2, 'ocean', 'a'],
    ['fish_sword',      'Cá Kiếm Đại Dương',     'fish', 0x334155, 0xbae6fd, 0x0f172a, 1.15, 10, 3.6, 'ocean', 'a'],
    ['fish_koi',        'Cá Koi Hoa Anh Đào',    'fish', 0xf43f5e, 0xffffff, 0xfb923c, 0.65, 5,  1.9, 'sakura,plains,lush', 'a'],
    ['fish_catfish',    'Cá Trê Đầm Lầy',        'fish', 0x475569, 0x94a3b8, 0x1e293b, 0.72, 6,  1.8, 'swamp,mangrove', 'a'],
    ['fish_piranha',    'Cá Piranha Răng Sắc',   'fish', 0x991b1b, 0xef4444, 0x64748b, 0.56, 6,  2.8, 'mangrove,swamp', 'an'],
    ['fish_seahorse',   'Cá Ngựa Vàng',          'fish', 0xf59e0b, 0xfde68a, 0xb45309, 0.45, 4,  1.4, 'ocean,beach', 'a'],
    ['marine_ray',      'Cá Đuối Xanh',          'ray',  0x0ea5e9, 0xe0f2fe, 0x0369a1, 1.25, 12, 2.5, 'ocean,beach', 'a'],
    ['marine_shark',    'Cá Mập Trắng',          'shark',0x64748b, 0xf8fafc, 0x1e293b, 1.55, 28, 3.4, 'ocean', 'an'],
    ['marine_hammer',   'Cá Mập Đầu Búa',        'shark',0x475569, 0xe2e8f0, 0x334155, 1.45, 24, 3.2, 'ocean', 'an'],
    ['marine_dolphin',  'Cá Heo Xanh',           'shark',0x38bdf8, 0xf0f9ff, 0x0284c7, 1.20, 18, 3.8, 'ocean,beach', 'a'],
    ['marine_whale',    'Cá Voi Xanh Khổng Lồ',  'shark',0x1e3a8a, 0x93c5fd, 0x172554, 2.35, 60, 2.2, 'ocean', 'a'],
    ['marine_turtle',   'Rùa Biển Xanh',         'reptile',0x15803d,0x86efac, 0x166534, 0.92, 14, 1.8, 'ocean,beach', 'a'],
    ['marine_jelly',    'Sứa Phát Sáng',         'jelly',0xec4899, 0xfbcfe8, 0xa855f7, 0.72, 6,  1.2, 'ocean', 'ag'],
    ['marine_octopus',  'Bạch Tuộc Đỏ',          'jelly',0xdc2626, 0xfca5a5, 0x7f1d1d, 0.88, 10, 2.0, 'ocean', 'a'],
    ['marine_orca',     'Cá Voi Sát Thủ Orca',   'shark',0x0f172a, 0xf8fafc, 0x334155, 1.85, 42, 3.3, 'ocean,snow,alpine', 'an'],
    // 21 Coastal, Swamp & Mangrove Animals
    ['crab_red',        'Cua Đỏ Bờ Biển',        'crab', 0xdc2626, 0xf97316, 0x7f1d1d, 0.55, 6,  1.5, 'beach,ocean', ''],
    ['crab_coconut',    'Cua Dừa Khổng Lồ',      'crab', 0x7c2d12, 0x1d4ed8, 0x451a03, 0.72, 10, 1.4, 'beach', 'n'],
    ['lobster',         'Tôm Hùm San Hô',        'crab', 0xb91c1c, 0xf87171, 0x450a0a, 0.52, 6,  1.4, 'beach,ocean', 'a'],
    ['seagull',         'Chim Hải Âu',           'bird', 0xf8fafc, 0x94a3b8, 0xf59e0b, 0.78, 6,  3.2, 'beach,ocean', 'f'],
    ['pelican',         'Chim Bồ Nông',          'bird', 0xf1f5f9, 0xfbbf24, 0x64748b, 1.05, 8,  2.8, 'beach,ocean', 'f'],
    ['flamingo',        'Chim Hồng Hạc',         'bird', 0xf472b6, 0xfbcfe8, 0x18181b, 1.12, 9,  2.2, 'beach,swamp,mangrove', 'f'],
    ['iguana_sea',      'Kỳ Đà Biển',            'reptile',0x3f6212,0x84cc16, 0x1a2e05, 0.85, 10, 1.7, 'beach', ''],
    ['parrot_red',      'Vẹt Đuôi Dài Đỏ',       'bird', 0xdc2626, 0xfacc15, 0x2563eb, 0.65, 6,  3.0, 'beach,lush,mangrove', 'f'],
    ['parrot_blue',     'Vẹt Xanh Nhiệt Đới',    'bird', 0x0284c7, 0xfacc15, 0x38bdf8, 0.65, 6,  3.0, 'beach,lush', 'f'],
    ['crocodile',       'Cá Sấu Đầm Lầy',        'reptile',0x365314,0x65a30d, 0x1a2e05, 1.38, 22, 2.2, 'mangrove,swamp', 'n'],
    ['alligator',       'Cá Sấu Mõm Ngắn',       'reptile',0x3f3f46,0x52525b, 0x27272a, 1.32, 20, 2.1, 'mangrove,swamp', 'n'],
    ['frog_green',      'Ếch Xanh Đầm Lầy',      'frog', 0x22c55e, 0x86efac, 0x15803d, 0.55, 6,  1.8, 'mangrove,swamp,lush', 'h'],
    ['frog_poison',     'Ếch Phi Tiêu Xanh',     'frog', 0x0ea5e9, 0x1e293b, 0x38bdf8, 0.48, 5,  1.9, 'mangrove,lush', 'h'],
    ['frog_amber',      'Ếch Vàng Ngập Mặn',     'frog', 0xf59e0b, 0xfef08a, 0xb45309, 0.52, 6,  1.8, 'mangrove,swamp', 'h'],
    ['turtle_swamp',    'Rùa Đầm Lầy',           'reptile',0x4d7c0f,0x365314, 0x713f12, 0.72, 12, 0.9, 'mangrove,swamp', ''],
    ['heron',           'Cò Trắng Ngập Mặn',     'bird', 0xf8fafc, 0xcbd5e1, 0xf59e0b, 1.05, 8,  2.4, 'mangrove,swamp', 'f'],
    ['otter',           'Rái Cá Sông',           'quad', 0x78350f, 0xd6d3d1, 0x451a03, 0.68, 10, 2.2, 'mangrove,swamp,plains', ''],
    ['beaver',          'Hải Ly Đắp Đập',        'quad', 0x6b4423, 0x451a03, 0x92400e, 0.72, 10, 1.5, 'mangrove,swamp,taiga', ''],
    ['capybara',        'Chuột Lang Capybara',   'quad', 0x92400e, 0xb45309, 0x451a03, 0.85, 14, 1.4, 'mangrove,swamp,beach', ''],
    ['hippo',           'Hà Mã Đầm Lầy',         'quad', 0x64748b, 0x94a3b8, 0x475569, 1.55, 32, 1.6, 'mangrove,swamp', 'n'],
    ['dragonfly',       'Chuồn Chuồn Kim',       'insect',0x06b6d4, 0xe0f2fe, 0x0e7490, 0.48, 4,  3.1, 'mangrove,swamp,sakura', 'f'],
    // 18 Alpine Peaks, Snow & Taiga Animals
    ['polar_bear',      'Gấu Bắc Cực',           'quad', 0xf8fafc, 0xe2e8f0, 0x1e293b, 1.45, 30, 2.0, 'alpine,snow', 'n'],
    ['snow_leopard',    'Báo Tuyết Núi Cao',     'cat',  0xe2e8f0, 0x475569, 0xf8fafc, 1.05, 20, 3.0, 'alpine,snow', 'n'],
    ['arctic_fox',      'Cáo Tuyết Trắng',       'cat',  0xf8fafc, 0xcbd5e1, 0x1e293b, 0.68, 10, 2.6, 'alpine,snow,taiga', ''],
    ['mountain_goat',   'Dê Núi Tuyết',          'horn', 0xf8fafc, 0xe2e8f0, 0x334155, 0.92, 14, 2.2, 'alpine,snow,plateau', 'n'],
    ['reindeer',        'Tuần Lộc Bắc Cực',      'horn', 0x92400e, 0xe7e5e4, 0x573b26, 1.18, 16, 2.4, 'snow,taiga,alpine', ''],
    ['moose',           'Nai Sừng Tấm',          'horn', 0x451a03, 0x78350f, 0xd6d3d1, 1.42, 26, 2.1, 'taiga,snow,alpine', 'n'],
    ['penguin',         'Chim Cánh Cụt',         'bird', 0x18181b, 0xf8fafc, 0xf97316, 0.78, 8,  1.5, 'alpine,snow', ''],
    ['penguin_king',    'Cánh Cụt Hoàng Đế',     'bird', 0x0f172a, 0xfef3c7, 0xf59e0b, 0.96, 12, 1.6, 'alpine,snow', ''],
    ['snow_owl',        'Cú Tuyết Trắng',        'bird', 0xf8fafc, 0xcbd5e1, 0xfacc15, 0.82, 8,  3.1, 'alpine,snow,taiga', 'f'],
    ['husky',           'Chó Tuyết Husky',       'cat',  0x475569, 0xf8fafc, 0x38bdf8, 0.88, 16, 2.8, 'alpine,snow,taiga', ''],
    ['ice_wolf',        'Sói Băng Tuyết',        'cat',  0xcbd5e1, 0xf8fafc, 0x64748b, 0.92, 18, 2.9, 'alpine,snow', 'n'],
    ['snow_hare',       'Thỏ Tuyết',             'frog', 0xf8fafc, 0xfbcfe8, 0xe2e8f0, 0.56, 6,  2.4, 'alpine,snow,taiga', 'h'],
    ['yak',             'Bò Yak Núi Cao',        'horn', 0x292524, 0x57534e, 0xd6d3d1, 1.35, 24, 1.6, 'alpine,plateau', ''],
    ['seal',            'Hải Cẩu Băng',          'reptile',0x94a3b8,0xe2e8f0, 0x475569, 0.95, 14, 1.4, 'snow,alpine,beach', ''],
    ['walrus',          'Hải Mã Ngà Trắng',      'reptile',0x78716c,0xf8fafc, 0x44403c, 1.30, 22, 1.2, 'snow,alpine', 'n'],
    ['lynx',            'Linh Miêu Taiga',       'cat',  0xb45309, 0xfef3c7, 0x451a03, 0.84, 14, 2.7, 'taiga,alpine', ''],
    ['wolverine',       'Chồn Gulo Băng',        'quad', 0x3b2314, 0xa16207, 0x1c1917, 0.78, 16, 2.3, 'taiga,alpine', 'n'],
    ['ram_alpine',      'Cừu Sừng Xoắn',         'horn', 0xa8a29e, 0xf5f5f4, 0x57534e, 0.95, 14, 2.0, 'alpine,plateau', 'n'],
    // 23 Highland Plateau, Savanna, Mesa & Desert Animals
    ['eagle_golden',    'Đại Bàng Vàng',         'bird', 0x78350f, 0xf59e0b, 0x451a03, 1.08, 14, 3.8, 'plateau,alpine,mesa', 'f'],
    ['falcon',          'Chim Ưng Cao Nguyên',   'bird', 0x475569, 0xf8fafc, 0xf59e0b, 0.85, 10, 4.2, 'plateau,mesa,desert', 'f'],
    ['condor',          'Thần Ưng Đỉnh Núi',     'bird', 0x18181b, 0xe2e8f0, 0xdc2626, 1.22, 16, 3.6, 'plateau,alpine,mesa', 'f'],
    ['lion',            'Sư Tử Thảo Nguyên',     'cat',  0xd97706, 0x78350f, 0xfde68a, 1.22, 26, 2.8, 'plateau,mesa,plains', 'n'],
    ['cheetah',         'Báo Gêpa Siêu Tốc',     'cat',  0xf59e0b, 0x18181b, 0xfef3c7, 0.96, 16, 3.8, 'plateau,mesa,desert', ''],
    ['leopard',         'Báo Hoa Mai',           'cat',  0xd97706, 0x292524, 0xfde68a, 1.02, 20, 3.1, 'plateau,lush,forest', 'n'],
    ['giraffe',         'Hươu Cao Cổ',           'horn', 0xf59e0b, 0x92400e, 0xfef3c7, 1.72, 24, 2.0, 'plateau,mesa,plains', ''],
    ['elephant',        'Voi Châu Phi',          'quad', 0x6b7280, 0xf8fafc, 0x4b5563, 1.95, 48, 1.5, 'plateau,plains,mesa', 'n'],
    ['rhino',           'Tê Giác Xám',           'horn', 0x52525b, 0xd4d4d8, 0x3f3f46, 1.55, 38, 1.9, 'plateau,mesa', 'n'],
    ['zebra',           'Ngựa Vằn Thảo Nguyên',  'quad', 0xf8fafc, 0x18181b, 0xe2e8f0, 1.15, 16, 2.9, 'plateau,plains,mesa', ''],
    ['gazelle',         'Linh Dương Vàng',       'horn', 0xd97706, 0xfef3c7, 0x451a03, 0.94, 12, 3.3, 'plateau,mesa,desert', ''],
    ['ostrich',         'Đà Điểu Chạy Nhanh',    'bird', 0x18181b, 0xf8fafc, 0xfca5a5, 1.32, 14, 3.4, 'plateau,desert,mesa', ''],
    ['bison',           'Bò Rừng Bison',         'horn', 0x451a03, 0x78350f, 0x292524, 1.45, 28, 1.8, 'plateau,plains', 'n'],
    ['llama',           'Lạc Đà Không Bướu',     'quad', 0xe7e5e4, 0xa8a29e, 0x78350f, 1.15, 16, 1.9, 'plateau,alpine,mesa', ''],
    ['alpaca',          'Lạc Đà Alpaca Trắng',   'quad', 0xfafaf9, 0xd6d3d1, 0x57534e, 1.05, 14, 1.8, 'plateau,meadow', ''],
    ['wild_horse',      'Ngựa Hoang Nâu',        'quad', 0x854d0e, 0x451a03, 0xfef3c7, 1.22, 18, 3.2, 'plateau,plains,meadow', ''],
    ['mustang_black',   'Hắc Mã Cao Nguyên',     'quad', 0x1c1917, 0x44403c, 0xf5f5f4, 1.24, 20, 3.4, 'plateau,plains', ''],
    ['camel',           'Lạc Đà Sa Mạc',         'camel', 0xc97834, 0xf0d7b0, 0x9f5720, 1.00, 22, 2.0, 'desert,mesa,plains', ''],
    ['caravan_camel',   'Lạc Đà Lữ Hành (Đèn)',  'caravan', 0xde8e35, 0xb91c1c, 0xfacc15, 1.00, 26, 2.0, 'desert,mesa,plains,plateau', ''],
    ['fennec_fox',      'Cáo Tai To Fennec',     'cat',  0xfde68a, 0xf59e0b, 0xfffbeb, 0.56, 8,  2.8, 'desert,mesa', ''],
    ['meerkat',         'Chồn Đất Meerkat',      'primate',0xd4a373,0x78350f, 0xfef3c7, 0.54, 6,  2.2, 'desert,mesa', ''],
    ['scorpion',        'Bọ Cạp Sa Mạc',         'crab', 0x27272a, 0xb45309, 0x18181b, 0.58, 10, 2.0, 'desert,mesa', 'n'],
    ['desert_lizard',   'Kỳ Nhông Cát Vàng',     'reptile',0xca8a04,0xfef08a, 0x854d0e, 0.65, 8,  2.3, 'desert,mesa', ''],
    ['hyena',           'Linh Cẩu Đốm',          'cat',  0xa16207, 0x292524, 0x713f12, 0.92, 16, 2.7, 'mesa,desert,plateau', 'n'],
    // 24 Forest, Sakura, Autumn, Plains, Meadow & Lush Grove Animals
    ['sika_deer',       'Hươu Sao Rừng Nắng',    'horn', 0xb45309, 0xfef3c7, 0x78350f, 1.08, 14, 2.7, 'forest,sakura,autumn,meadow', ''],
    ['stag_white',      'Bạch Lộc Thần Rừng',    'horn', 0xf8fafc, 0xfde68a, 0xe2e8f0, 1.24, 22, 2.8, 'sakura,lush,meadow', ''],
    ['brown_bear',      'Gấu Nâu Rừng Già',      'quad', 0x6b3e1e, 0x451a03, 0xa16207, 1.38, 28, 1.9, 'forest,taiga,autumn', 'n'],
    ['panda',           'Gấu Trúc Lớn',          'quad', 0xf8fafc, 0x18181b, 0xe2e8f0, 1.18, 22, 1.4, 'lush,sakura,forest', ''],
    ['red_panda',       'Gấu Trúc Đỏ',           'cat',  0xc2410c, 0xf8fafc, 0x292524, 0.68, 10, 2.1, 'sakura,autumn,lush', ''],
    ['squirrel',        'Sóc Đuôi Xù',           'cat',  0xb45309, 0xfef3c7, 0x78350f, 0.45, 5,  2.8, 'forest,autumn,sakura,taiga', ''],
    ['hedgehog',        'Nhím Gai Nhỏ',          'quad', 0x57534e, 0xd6d3d1, 0x292524, 0.46, 6,  1.4, 'forest,autumn,meadow', ''],
    ['badger',          'Lửng Rừng Sọc Trắng',   'quad', 0x3f3f46, 0xf8fafc, 0x18181b, 0.66, 10, 1.8, 'forest,autumn,plains', ''],
    ['raccoon',         'Gấu Mèo Raccoon',       'cat',  0x71717a, 0x18181b, 0xf4f4f5, 0.66, 10, 2.1, 'forest,autumn,swamp', ''],
    ['boar',            'Lợn Rừng Nanh Trắng',   'quad', 0x573b26, 0xf5f5f4, 0x3b2314, 0.96, 16, 2.3, 'forest,autumn,lush', 'n'],
    ['rabbit_brown',    'Thỏ Rừng Nâu',          'frog', 0x92400e, 0xfef3c7, 0x78350f, 0.54, 5,  2.5, 'plains,meadow,forest,sakura', 'h'],
    ['peacock',         'Chim Công Xanh',        'bird', 0x0284c7, 0x10b981, 0xfacc15, 1.05, 10, 1.7, 'sakura,meadow,lush', ''],
    ['owl_brown',       'Cú Mèo Rừng Đêm',       'bird', 0x78350f, 0xfde68a, 0x451a03, 0.78, 8,  3.0, 'forest,autumn,taiga', 'f'],
    ['woodpecker',      'Chim Gõ Kiến Đỏ',       'bird', 0x18181b, 0xdc2626, 0xf8fafc, 0.55, 5,  3.0, 'forest,autumn,taiga', 'f'],
    ['swan_white',      'Thiên Nga Trắng',       'bird', 0xffffff, 0xf97316, 0xe2e8f0, 0.96, 10, 2.2, 'sakura,plains,meadow', 'f'],
    ['duck_mallard',    'Vịt Trời Cổ Xanh',      'bird', 0x15803d, 0x92400e, 0xfacc15, 0.68, 6,  2.4, 'plains,swamp,sakura', 'f'],
    ['butterfly_sakura','Bướm Hoa Anh Đào',      'insect',0xf472b6, 0xfbcfe8, 0xdb2777, 0.45, 3,  2.4, 'sakura,meadow', 'f'],
    ['butterfly_morpho','Bướm Xanh Morpho',      'insect',0x38bdf8, 0x2563eb, 0x1e293b, 0.45, 3,  2.4, 'lush,forest,meadow', 'f'],
    ['tiger',           'Hổ Đông Dương',         'cat',  0xea580c, 0x18181b, 0xfef3c7, 1.24, 28, 3.0, 'lush,forest,mangrove', 'n'],
    ['gorilla',         'Khỉ Đột Rừng Rậm',      'primate',0x27272a,0x94a3b8, 0x18181b, 1.32, 30, 2.0, 'lush,mangrove', 'n'],
    ['monkey_palm',     'Khỉ Đuôi Dài Bờ Biển',  'primate',0x92400e,0xfde68a, 0x451a03, 0.74, 10, 2.6, 'beach,lush,mangrove', ''],
    ['black_panther',   'Báo Đen Rừng Sâu',      'cat',  0x18181b, 0xfacc15, 0x27272a, 1.06, 22, 3.3, 'lush,forest', 'n'],
    ['chameleon',       'Tắc Kè Hoa Nhiệt Đới',  'reptile',0x10b981,0xfacc15, 0xec4899, 0.56, 6,  1.2, 'lush,beach,mangrove', ''],
    ['goat_white',      'Dê Trắng Đồng Bằng',    'horn', 0xf5f5f4, 0xd6d3d1, 0x78716c, 0.88, 12, 1.9, 'plains,meadow,plateau', ''],
    // v22 10 Brand-New Dedicated Cute Tameable & Biome Animals (bringing total to 20+ dedicated new Blender cute animals!)
    ['axolotl',         'Kỳ Nhông Axolotl Hồng', 'axolotl', 0xf9a8d4, 0xec4899, 0xfce7f3, 0.85, 14, 1.8, 'lush,weeping,swamp,mangrove', ''],
    ['shiba',           'Chó Shiba Inu Vàng',    'shiba',   0xe09145, 0xfef9ec, 0xef4444, 0.92, 18, 2.7, 'sakura,autumn,plains,birch,meadow', ''],
    ['calico_cat',      'Mèo Tam Thể Dễ Thương', 'calico',  0xfafaf9, 0xea7c2f, 0x292524, 0.86, 14, 2.5, 'sakura,plains,meadow,birch', ''],
    ['cockatiel',       'Vẹt Mào Cockatiel',     'cockatiel',0xfef08a, 0x9ca3af, 0xf97316, 0.78, 10, 2.8, 'bamboo,sakura,lush,weeping', 'f'],
    ['fennec',          'Cáo Tai To Fennec',     'fennec',  0xf2c98a, 0xfef3c7, 0xf9a8d4, 0.82, 12, 2.8, 'desert,mesa', ''],
    ['allay',           'Tiên Xanh Allay',       'allay',   0x38bdf8, 0xe0f2fe, 0x0284c7, 0.85, 18, 3.0, 'lush,weeping,birch,sakura,meadow', 'fg'],
    ['baby_dragon',     'Rồng Con Thú Cưng',     'bdragon', 0x10b981, 0xfacc15, 0x047857, 0.95, 28, 2.9, 'redwood,alpine,plateau,sakura', ''],
    ['koala',           'Gấu Túi Koala Xám',     'koala',   0x94a3b8, 0xf1f5f9, 0x1e293b, 0.88, 14, 1.3, 'redwood,birch,forest,bamboo', ''],
    ['duck',            'Vịt Trời Cổ Xanh',      'duck',    0x8b5a2b, 0x059669, 0xf59e0b, 0.84, 8,  1.9, 'weeping,plains,swamp,sakura', ''],
    ['strider',         'Strider Dung Nham',     'strider', 0xc93b55, 0xe85a71, 0xd6d3d1, 0.96, 20, 2.1, 'nether', ''],
    // v23.0 8 Brand-New Cute Project-Verdant Blender Voxel Marine Animals!
    ['whale_blue',      'Cá Voi Xanh Đại Dương', 'whale',   0x3878c8, 0xddeeff, 0x1e40af, 1.55, 45, 2.0, 'ocean,beach', 'a'],
    ['shark_white',     'Cá Mập Trắng Voxel',    'shark',   0x64748b, 0xf1f5f9, 0x334155, 1.25, 32, 2.8, 'ocean,beach', 'an'],
    ['anglerfish',      'Cá Đèn Lồng Biển Sâu',  'fish',    0x4338ca, 0xfef08a, 0x1e1b4b, 1.00, 18, 1.9, 'ocean', 'ag'],
    ['orca',            'Cá Voi Sát Thủ Orca',   'whale',   0x18181b, 0xf8fafc, 0x3f3f46, 1.38, 38, 2.7, 'ocean,snow,alpine', 'an'],
    ['dolphin_cute',    'Cá Heo Xanh Đáng Yêu',  'dolphin', 0x60a5fa, 0xe0f2fe, 0x2563eb, 1.05, 18, 3.2, 'ocean,beach', 'a'],
    ['manta_ray',       'Cá Đuối Manta Ray',     'ray',     0x334155, 0xcbd5e1, 0x0f172a, 1.18, 20, 2.4, 'ocean,beach', 'a'],
    ['clownfish',       'Cá Hề Nemo Voxel',      'fish',    0xf97316, 0xffffff, 0x18181b, 0.78, 8,  2.3, 'ocean,beach', 'a'],
    ['pufferfish',      'Cá Nóc Vàng Voxel',     'fish',    0xfacc15, 0xfef9c3, 0xb45309, 0.84, 10, 1.7, 'ocean,beach', 'a'],
    // Image 9 Mob Vote & Cute Voxel Wildlife
    ['sniffer',         'Sniffer Cổ Đại Rêu Xanh','quad',   0xb93829, 0x3f8f4b, 0xfacc15, 1.00, 24, 1.4, 'lush,meadow,plains', ''],
    ['savanna_monkey',  'Khỉ Vàng Thảo Nguyên',  'primate', 0xe07b29, 0xfef3c7, 0xf5f5f4, 1.00, 14, 2.7, 'plateau,mesa,lush', ''],
    ['pink_dolphin',    'Cá Heo Hồng Đại Dương', 'dolphin', 0xf9a8d4, 0xfce7f3, 0xf472b6, 1.00, 18, 3.2, 'ocean,beach', 'a'],
    ['vulture',         'Kền Kền Hoang Mạc',     'bird',    0x5c2d16, 0xfca5a5, 0x3f1d0d, 1.00, 16, 3.3, 'mesa,desert,plateau', 'f'],
    ['armadillo',       'Tatu Giáp Đất Armadillo','quad',   0xb48a78, 0x946b5c, 0xd4a38f, 1.00, 16, 1.9, 'plateau,mesa,desert', ''],
    // Image 10 — All 19 Pastel Voxel Plush Mobs
    ['plush_slime_mint',       'Slime Bạc Hà Dễ Thương',    'slime', 0x6ee7b7, 0x34d399, 0x22c55e, 1.00, 12, 2.0, 'plains,meadow,lush', 'h'],
    ['plush_strawberry_slime', 'Slime Dâu Tây Nơ Vàng',     'slime', 0xf43f5e, 0xfecdd3, 0xfacc15, 1.00, 12, 2.0, 'sakura,meadow,plains', 'h'],
    ['plush_allay_lavender',   'Allay Tím Vương Miện',      'allay', 0x7c3aed, 0xa78bfa, 0xf472b6, 1.00, 18, 2.8, 'sakura,lush,meadow', 'fg'],
    ['plush_zombie_chibi',     'Zombie Chibi Hoa Hồng',     'quad',  0x4ade80, 0x2563eb, 0xf472b6, 1.00, 16, 1.8, 'plains,forest,meadow', ''],
    ['plush_creeper_blossom',  'Creeper Nơ Hồng Dễ Thương', 'quad',  0x4ade80, 0x16a34a, 0xf472b6, 1.00, 16, 1.8, 'sakura,plains,meadow', ''],
    ['plush_enderman_ribbon',  'Enderman Nơ Tím Dễ Thương', 'quad',  0x1e1b2e, 0xa855f7, 0xc084fc, 1.00, 22, 2.3, 'sakura,lush,forest', ''],
    ['plush_bear_teal',        'Gấu Bông Xanh Bạc Hà',      'quad',  0x2dd4bf, 0x99f6e4, 0xf472b6, 1.00, 18, 1.8, 'meadow,forest,birch', ''],
    ['plush_panda_berry',      'Gấu Trúc Dâu Tím',          'quad',  0xf8fafc, 0x4f46e5, 0xa855f7, 1.00, 20, 1.6, 'sakura,lush,bamboo', ''],
    ['plush_bat_heart',        'Dơi Chibi Hoa Vàng',        'bird',  0x4338ca, 0x818cf8, 0xfef08a, 1.00, 10, 2.9, 'forest,sakura,lush', 'f'],
    ['plush_duckling_bow',     'Vịt Vàng Nơ Đỏ',            'bird',  0xfacc15, 0xf97316, 0xef4444, 1.00, 8,  1.9, 'plains,meadow,sakura', ''],
    ['plush_chicken_daisy',    'Gà Bông Hoa Cúc',           'bird',  0xf8fafc, 0xfacc15, 0xfef08a, 1.00, 8,  1.8, 'plains,meadow,birch', ''],
    ['plush_pig_crown',        'Heo Bông Vương Miện Vàng',  'quad',  0xf9a8d4, 0xf472b6, 0xfacc15, 1.00, 12, 1.8, 'sakura,meadow,plains', ''],
    ['plush_cow_flower',       'Bò Bông Nâu Hoa Xanh',      'quad',  0xf5f5f4, 0xb47b56, 0x60a5fa, 1.00, 14, 1.7, 'plains,meadow,forest', ''],
    ['plush_sheep_sakura',     'Cừu Bông Anh Đào Bạc Hà',   'quad',  0xfbcfe8, 0x6ee7b7, 0xf43f5e, 1.00, 12, 1.7, 'sakura,meadow,plains', ''],
    ['plush_fox_berry',        'Cáo Bông Cam Lá Xanh',      'cat',   0xf97316, 0xfafaf9, 0x14b8a6, 1.00, 14, 2.4, 'autumn,sakura,forest', ''],
    ['plush_wolf_bow',         'Sói Trắng Nơ Xanh',         'cat',   0xf8fafc, 0xcbd5e1, 0x3b82f6, 1.00, 18, 2.5, 'taiga,sakura,plains', ''],
    ['plush_llama_bow',        'Lạc Đà Alpaca Nơ Cam',      'quad',  0xfef3c7, 0xe7d3a3, 0xf59e0b, 1.00, 16, 1.8, 'meadow,plateau,sakura', ''],
    ['plush_turtle_flower',    'Rùa Bông Hoa Hồng',         'reptile',0x22c55e,0x15803d, 0xec4899, 1.00, 16, 1.2, 'beach,sakura,meadow', ''],
    ['plush_axolotl_hat',      'Axolotl Đội Mũ Bếp',        'axolotl',0xf472b6,0xfbcfe8, 0xf8fafc, 1.00, 16, 1.9, 'sakura,lush,beach', ''],
    // v95 Blender Cute Voxel Animals & Marine Life
    ['bee',                    'Ong Vàng Dễ Thương',        'insect', 0xfacc15,0x27272a, 0xe0f2fe, 1.00, 10, 2.8, 'sakura,meadow,flower,plains,forest', 'f'],
    ['parrot',                 'Vẹt Cầu Vồng Nhiệt Đới',    'bird',   0xe11d48,0x2563eb, 0xfacc15, 1.00, 10, 3.0, 'lush,beach,bamboo,mangrove', 'f'],
    ['tropical_fish',          'Cá Nhiệt Đới Sắc Màu',      'fish',   0xf97316,0xffffff, 0xfacc15, 1.00, 6,  2.4, 'ocean,beach,sakura', 'a'],
    ['squid',                  'Mực Biển Xanh',             'jelly',  0x1e3a6e,0x172b52, 0xf8fafc, 1.00, 10, 2.0, 'ocean,beach', 'a'],
    ['glow_squid',             'Mực Phát Sáng Biển Sâu',    'jelly',  0x1e8f9e,0x7af8ff, 0x67e8f9, 1.00, 12, 2.1, 'ocean', 'ag']
  ];
  const ANIMAL_MAP = new Map();
  for (let i = 0; i < ANIMAL_SPECIES.length; i++) {
    const sp = ANIMAL_SPECIES[i];
    ANIMAL_MAP.set(sp[0], {
      id: sp[0], name: sp[1], arch: sp[2], c1: sp[3], c2: sp[4], c3: sp[5],
      sc: sp[6], hp: sp[7], spd: sp[8], biomes: sp[9],
      aqua: sp[10].includes('a'), fly: sp[10].includes('f'), neutral: sp[10].includes('n'),
      hopper: sp[10].includes('h'), glow: sp[10].includes('g')
    });
  }
  const FIRE_IMMUNE_MOBS = new Set(['magma_golem', 'redstone_monstrosity', 'blaze', 'wildfire', 'ghast', 'baby_ghast', 'hoglin', 'piglin', 'piglin_brute', 'zombified_piglin', 'wither_skeleton', 'wither_knight', 'wither', 'ender_dragon', 'void_end_dragon', 'amethyst_end_dragon', 'storm_end_dragon', 'abyss_end_dragon', 'sovereign_end_dragon', 'fire_dragon', 'water_dragon', 'strider', 'magma_cube', 'zoglin', 'soul_wisp', 'copper_golem', 'cave_warden', 'sculk_stalker', 'sculk_brute', 'sculk_sentinel', 'sculk_soul_ravager']);
  const IS_DRAGON_MOB = new Set(['ender_dragon', 'ice_dragon', 'fire_dragon', 'earth_dragon', 'water_dragon', 'leaf_dragon', 'tree_dragon', 'void_end_dragon', 'amethyst_end_dragon', 'storm_end_dragon', 'abyss_end_dragon', 'sovereign_end_dragon']);

  // Tameable Cute Pets (Birds, Cats, Dogs/Wolves, Foxes, Sheep & Special Companions!)
  const TAMEABLE_PETS = new Set([
    'wolf', 'shiba', 'husky', 'calico_cat', 'lynx', 'fox', 'arctic_fox', 'fennec', 'fennec_fox',
    'sheep', 'alpaca', 'parrot', 'parrot_red', 'parrot_blue', 'cockatiel', 'snow_owl', 'owl_brown', 'bee',
    'axolotl', 'capybara', 'red_panda', 'allay', 'baby_dragon', 'strider', 'rabbit_brown', 'koala', 'otter',
    'plush_allay_lavender', 'plush_bear_teal', 'plush_panda_berry', 'plush_duckling_bow', 'plush_chicken_daisy',
    'plush_pig_crown', 'plush_cow_flower', 'plush_sheep_sakura', 'plush_fox_berry', 'plush_wolf_bow',
    'plush_llama_bow', 'plush_turtle_flower', 'plush_axolotl_hat', 'plush_creeper_blossom', 'plush_zombie_chibi',
    'plush_enderman_ribbon', 'plush_bat_heart', 'plush_slime_mint', 'plush_strawberry_slime',
    'sniffer', 'armadillo', 'savanna_monkey', 'meerkat'
  ]);
  const DEFENDER_PETS = new Set(['wolf', 'shiba', 'husky', 'fox', 'fennec', 'baby_dragon', 'allay', 'plush_wolf_bow', 'plush_allay_lavender']);

  // Map ALL Wildlife Species cleanly to our 45+ Optimized Greedy-Meshed Project-Verdant Blender Voxel Animals!
  const VERDANT_PURE_PALETTE = new Set([
    'camel', 'caravan_camel', 'rabbit_brown', 'sika_deer', 'panda', 'brown_bear', 'penguin',
    'frog_green', 'turtle_swamp', 'crab_red', 'elephant', 'wild_horse', 'monkey_palm',
    'butterfly_sakura', 'fish_clown', 'marine_dolphin', 'marine_jelly', 'lion',
    // v22 20 Brand-New Pure-Palette Dedicated Blender Voxel Animals!
    'axolotl', 'capybara', 'red_panda', 'shiba', 'calico_cat', 'cockatiel', 'snow_owl',
    'fennec', 'fennec_fox', 'allay', 'baby_dragon', 'duck', 'duck_mallard', 'flamingo',
    'hedgehog', 'raccoon', 'otter', 'seal', 'koala', 'alpaca', 'squirrel', 'peacock', 'strider',
    // v23.0 + v61 Pure-Palette Dedicated Marine Blender Voxel Animals!
    'whale_blue', 'shark_white', 'anglerfish', 'orca', 'dolphin_cute', 'manta_ray', 'clownfish', 'pufferfish',
    'marine_whale', 'marine_orca', 'marine_shark', 'marine_ray', 'fish_puffer',
    // v95 Blender Cute Voxel Additions
    'bee', 'parrot', 'parrot_red', 'tropical_fish', 'squid', 'glow_squid', 'sniffer', 'armadillo', 'meerkat', 'ostrich'
  ]);
  function pickVerdantBlenderAnimal(spec) {
    const id = spec.id, a = spec.arch;
    if (id === 'bee') return { key: 'bee', sc: 1.0 };
    if (id === 'parrot' || id === 'parrot_red' || id === 'parrot_blue') return { key: 'parrot', sc: 1.04 };
    if (id === 'tropical_fish' || id === 'fish_tang_blue' || id === 'fish_tang_gold' || id === 'fish_angel') return { key: 'tropical_fish', sc: id === 'tropical_fish' ? 1.05 : 0.96 };
    if (id === 'squid') return { key: 'squid', sc: 1.0 };
    if (id === 'glow_squid') return { key: 'glow_squid', sc: 1.05 };
    if (id === 'sniffer') return { key: 'sniffer', sc: 1.0 };
    if (id === 'armadillo') return { key: 'armadillo', sc: 1.0 };
    if (id === 'meerkat') return { key: 'meerkat', sc: 1.0 };
    if (id === 'ostrich') return { key: 'ostrich', sc: 1.0 };
    // Direct 1-to-1 bespoke v23 + v61 Marine Blender models!
    if (id === 'whale_blue' || id === 'marine_whale') return { key: 'whale_blue', sc: id === 'marine_whale' ? 1.50 : 1.35 };
    if (id === 'shark_white' || id === 'marine_shark' || id === 'marine_hammer') return { key: 'shark_white', sc: id === 'marine_shark' ? 1.28 : 1.18 };
    if (id === 'anglerfish') return { key: 'anglerfish', sc: 1.02 };
    if (id === 'orca' || id === 'marine_orca') return { key: 'orca', sc: id === 'marine_orca' ? 1.34 : 1.25 };
    if (id === 'dolphin_cute' || id === 'marine_dolphin' || id === 'pink_dolphin') return { key: 'dolphin_cute', sc: id === 'pink_dolphin' ? 1.04 : 1.06 };
    if (id === 'manta_ray' || id === 'marine_ray') return { key: 'manta_ray', sc: 1.14 };
    if (id === 'clownfish' || id === 'fish_clown') return { key: 'clownfish', sc: 0.92 };
    if (id === 'pufferfish' || id === 'fish_puffer') return { key: 'pufferfish', sc: 0.96 };
    // Direct 1-to-1 bespoke v22 Blender models!
    if (id === 'axolotl') return { key: 'axolotl', sc: 1.05 };
    if (id === 'capybara') return { key: 'capybara', sc: 1.04 };
    if (id === 'red_panda') return { key: 'red_panda', sc: 1.06 };
    if (id === 'shiba') return { key: 'shiba', sc: 1.04 };
    if (id === 'calico_cat') return { key: 'calico_cat', sc: 1.04 };
    if (id === 'cockatiel') return { key: 'cockatiel', sc: 1.02 };
    if (id === 'snow_owl' || id === 'owl_brown') return { key: 'snow_owl', sc: 1.02 };
    if (id === 'fennec' || id === 'fennec_fox') return { key: 'fennec', sc: 1.04 };
    if (id === 'allay') return { key: 'allay', sc: 1.05 };
    if (id === 'baby_dragon') return { key: 'baby_dragon', sc: 0.34 };
    if (id === 'duck' || id === 'duck_mallard' || id === 'swan_white') return { key: 'duck', sc: id === 'swan_white' ? 1.14 : 1.02 };
    if (id === 'flamingo') return { key: 'flamingo', sc: 1.06 };
    if (id === 'hedgehog') return { key: 'hedgehog', sc: 1.04 };
    if (id === 'raccoon') return { key: 'raccoon', sc: 1.04 };
    if (id === 'otter') return { key: 'otter', sc: 1.04 };
    if (id === 'seal' || id === 'walrus') return { key: 'seal', sc: id === 'walrus' ? 1.26 : 1.06 };
    if (id === 'koala') return { key: 'koala', sc: 1.05 };
    if (id === 'alpaca' || id === 'llama') return { key: 'alpaca', sc: id === 'llama' ? 1.12 : 1.04 };
    if (id === 'squirrel') return { key: 'squirrel', sc: 1.08 };
    if (id === 'peacock') return { key: 'peacock', sc: 1.08 };
    if (id === 'strider') return { key: 'strider', sc: 1.05 };
    if (id === 'camel') return { key: 'camel', sc: 1.05 };
    if (id === 'caravan_camel') return { key: 'caravan_camel', sc: 1.0 };
    if (id === 'rabbit_brown' || id === 'snow_hare') return { key: 'rabbit', sc: 1.05 };
    if (id === 'wild_horse' || id === 'mustang_black' || id === 'zebra' || id === 'giraffe') return { key: 'horse', sc: id === 'giraffe' ? 1.32 : 1.04 };
    if (id === 'sika_deer' || id === 'stag_white' || id === 'reindeer' || id === 'moose' || a === 'horn') return { key: 'deer', sc: id === 'moose' ? 1.25 : 1.02 };
    if (id === 'panda') return { key: 'panda', sc: 1.05 };
    if (id === 'elephant') return { key: 'elephant', sc: 1.15 };
    if (id === 'penguin' || id === 'penguin_king') return { key: 'penguin', sc: id === 'penguin_king' ? 1.12 : 0.95 };
    if (id === 'arctic_fox') return { key: 'fox', sc: 1.0 };
    if (id === 'husky' || id === 'ice_wolf') return { key: 'wolf', sc: 1.02 };
    if (id === 'boar') return { key: 'pig', sc: 1.08 };
    if (a === 'frog') return { key: 'frog', sc: 1.0 };
    if (a === 'reptile') return { key: 'turtle', sc: Math.max(0.85, Math.min(1.25, spec.sc)) };
    if (a === 'crab') return { key: 'crab', sc: 0.95 };
    if (a === 'fish') return { key: 'fish_cute', sc: Math.max(0.85, Math.min(1.25, spec.sc * 1.25)) };
    if (a === 'shark' || a === 'ray') return { key: 'shark_cute', sc: Math.max(0.85, Math.min(1.55, spec.sc * 0.85)) };
    if (a === 'jelly') return { key: 'jelly_cute', sc: 1.0 };
    if (a === 'insect') return { key: 'butterfly', sc: 0.95 };
    if (a === 'bird') return { key: 'bird_cute', sc: Math.max(0.82, Math.min(1.25, spec.sc)) };
    if (a === 'primate') return { key: 'monkey', sc: id === 'gorilla' ? 1.35 : 0.96 };
    if (a === 'cat') return { key: 'cat_wild', sc: Math.max(0.80, Math.min(1.20, spec.sc)) };
    return { key: 'bear', sc: Math.max(0.75, Math.min(1.18, spec.sc * 0.88)) };
  }

  const CUSTOM_VOXEL_ANIMALS = new Set([
    'vulture',
    'plush_slime_mint', 'plush_strawberry_slime', 'plush_allay_lavender', 'plush_zombie_chibi',
    'plush_creeper_blossom', 'plush_enderman_ribbon', 'plush_bear_teal', 'plush_panda_berry',
    'plush_bat_heart', 'plush_duckling_bow', 'plush_chicken_daisy', 'plush_pig_crown',
    'plush_cow_flower', 'plush_sheep_sakura', 'plush_fox_berry', 'plush_wolf_bow',
    'plush_llama_bow', 'plush_turtle_flower', 'plush_axolotl_hat'
  ]);
  function buildAnimalPlaceholderMesh(spec) {
    const g = new THREE.Group(), parts = [];
    const anim = { torso: null, head: null, jaw: null, core: null, legs: [], arms: [], wings: [], tail: null };
    const addVoxel = (parent, w, h, d, col, x, y, z, opt = {}) => {
      const mat = _getCuteBoxMats(`ph_${opt.glow ? 'g' : 'n'}_${col.toString(16)}_${opt.op || 10}`, {
        tex: _getNoiseTex('voxel'), color: col, rough: 0.78, glow: !!opt.glow,
        transparent: opt.op !== undefined && opt.op < 1, opacity: opt.op ?? 1
      });
      const m = new THREE.Mesh(_getBoxGeo(w, h, d), mat);
      m.userData.sharedGeo = true;
      m.position.set(x, y, z);
      m.castShadow = !opt.glow && !_isMobilePerf;
      m.receiveShadow = !opt.glow;
      parent.add(m);
      if (!opt.glow) parts.push(m);
      return m;
    };
    const mkP = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const c1 = spec.c1 || 0xfacc15, c2 = spec.c2 || 0x27272a, c3 = spec.c3 || c2, arch = spec.arch || 'quad', id = spec.id || '';
    const addEyes = (parent, sep, ey, ez, col = 0x111827, glow = false) => {
      addVoxel(parent, 0.055, 0.055, 0.03, col, -sep, ey, ez, { glow });
      addVoxel(parent, 0.055, 0.055, 0.03, col,  sep, ey, ez, { glow });
    };
    if (id === 'bee' || arch === 'insect') {
      const torso = mkP(g, 0, 0.36, 0); anim.torso = torso;
      addVoxel(torso, 0.38, 0.36, 0.56, id === 'bee' ? 0xfacc15 : c1, 0, 0, 0);
      addVoxel(torso, 0.39, 0.37, 0.12, id === 'bee' ? 0x1c1917 : c2, 0, 0, -0.02);
      addVoxel(torso, 0.39, 0.37, 0.12, id === 'bee' ? 0x1c1917 : c2, 0, 0, -0.20);
      addEyes(torso, 0.10, 0.03, 0.29, c3 || 0x38bdf8, true);
      const wL = mkP(torso, 0.18, 0.19, 0.05), wR = mkP(torso, -0.18, 0.19, 0.05);
      addVoxel(wL, 0.36, 0.02, 0.24, 0xe0f2fe, 0.18, 0, 0, { op: 0.72 });
      addVoxel(wR, 0.36, 0.02, 0.24, 0xe0f2fe, -0.18, 0, 0, { op: 0.72 });
      anim.wings.push({ p: wL, dir: 1 }, { p: wR, dir: -1 });
    } else if (arch === 'crab') {
      const torso = mkP(g, 0, 0.24, 0); anim.torso = torso;
      addVoxel(torso, 0.62, 0.22, 0.46, c1, 0, 0, 0);
      addVoxel(torso, 0.50, 0.08, 0.36, c2, 0, 0.14, 0);
      addVoxel(torso, 0.06, 0.12, 0.06, 0x111827, -0.16, 0.20, 0.18);
      addVoxel(torso, 0.06, 0.12, 0.06, 0x111827,  0.16, 0.20, 0.18);
      for (const sx of [-1, 1]) {
        const cl = mkP(torso, sx * 0.36, 0.04, 0.24);
        addVoxel(cl, 0.22, 0.18, 0.24, c2, sx * 0.04, 0, 0.12);
        anim.arms.push({ p: cl, dir: sx });
      }
      for (const [lx, lz, d] of [[-0.34, 0.10, 1], [0.34, 0.10, -1], [-0.34, -0.12, -1], [0.34, -0.12, 1]]) {
        const lp = mkP(g, lx, 0.16, lz);
        addVoxel(lp, 0.09, 0.16, 0.09, c3, 0, -0.08, 0);
        anim.legs.push({ p: lp, dir: d });
      }
    } else if (arch === 'primate') {
      const torso = mkP(g, 0, 0.44, 0); anim.torso = torso;
      addVoxel(torso, 0.34, 0.38, 0.26, c1, 0, 0, 0);
      addVoxel(torso, 0.24, 0.26, 0.04, c2, 0, -0.02, 0.14);
      const head = mkP(torso, 0, 0.24, 0.02); anim.head = head;
      addVoxel(head, 0.32, 0.28, 0.30, c1, 0, 0.14, 0.02);
      addVoxel(head, 0.22, 0.14, 0.06, c2, 0, 0.09, 0.18);
      addEyes(head, 0.08, 0.17, 0.18);
      for (const sx of [-1, 1]) {
        addVoxel(head, 0.10, 0.10, 0.05, c2, sx * 0.20, 0.15, 0.02);
        const ar = mkP(torso, sx * 0.22, 0.12, 0);
        addVoxel(ar, 0.11, 0.34, 0.11, c1, 0, -0.16, 0);
        anim.arms.push({ p: ar, dir: sx });
        const lp = mkP(g, sx * 0.10, 0.26, 0);
        addVoxel(lp, 0.11, 0.26, 0.12, c3, 0, -0.13, 0);
        anim.legs.push({ p: lp, dir: sx });
      }
      const tail = mkP(torso, 0, -0.10, -0.14); anim.tail = tail;
      addVoxel(tail, 0.08, 0.08, 0.36, c1, 0, 0.08, -0.18);
    } else if (arch === 'bird' || arch === 'cockatiel' || arch === 'duck' || arch === 'allay') {
      const isAllay = (arch === 'allay');
      const torso = mkP(g, 0, isAllay ? 0.52 : 0.38, 0); anim.torso = torso;
      addVoxel(torso, 0.28, 0.26, 0.38, c1, 0, 0, 0);
      const head = mkP(torso, 0, 0.16, isAllay ? 0 : 0.16); anim.head = head;
      addVoxel(head, 0.26, 0.24, 0.26, isAllay ? c1 : c2, 0, 0.08, 0.02);
      addEyes(head, 0.07, 0.09, 0.16, isAllay ? 0xe0f2fe : 0x111827, isAllay);
      if (!isAllay) addVoxel(head, 0.11, 0.06, 0.13, 0xf59e0b, 0, 0.04, 0.18);
      for (const sx of [-1, 1]) {
        const wp = mkP(torso, sx * 0.16, 0.06, 0);
        addVoxel(wp, 0.30, 0.05, 0.26, c2, sx * 0.15, 0, 0, isAllay ? { op: 0.78 } : {});
        anim.wings.push({ p: wp, dir: sx });
        if (!isAllay) {
          const lp = mkP(g, sx * 0.09, 0.24, 0);
          addVoxel(lp, 0.06, 0.24, 0.06, 0xf59e0b, 0, -0.12, 0);
          anim.legs.push({ p: lp, dir: sx });
        }
      }
    } else if (arch === 'fish' || arch === 'shark' || arch === 'ray' || arch === 'jelly' || arch === 'whale' || arch === 'dolphin') {
      const torso = mkP(g, 0, 0.30, 0); anim.torso = torso;
      const bw = arch === 'ray' ? 0.86 : (arch === 'whale' ? 0.62 : (arch === 'dolphin' || arch === 'shark' ? 0.38 : 0.26));
      const bh = arch === 'ray' ? 0.12 : (arch === 'whale' ? 0.52 : 0.30);
      const bd = arch === 'whale' ? 1.12 : (arch === 'dolphin' || arch === 'shark' ? 0.84 : 0.54);
      addVoxel(torso, bw, bh, bd, c1, 0, 0, 0);
      if (arch === 'jelly') {
        for (const [tx, tz] of [[-0.08, 0.08], [0.08, 0.08], [-0.08, -0.08], [0.08, -0.08]]) {
          addVoxel(torso, 0.05, 0.32, 0.05, c2, tx, -0.26, tz, { op: 0.75 });
        }
      } else {
        addEyes(torso, bw * 0.44, 0.04, bd * 0.36);
        if (arch === 'shark' || arch === 'dolphin') addVoxel(torso, 0.06, 0.20, 0.20, c2, 0, bh * 0.5 + 0.08, -0.04);
        const tail = mkP(torso, 0, 0, -bd * 0.5); anim.tail = tail;
        addVoxel(tail, (arch === 'whale' || arch === 'dolphin') ? 0.46 : 0.07, (arch === 'whale' || arch === 'dolphin') ? 0.08 : 0.24, 0.28, c2, 0, 0, -0.14);
      }
    } else if (arch === 'bdragon') {
      const torso = mkP(g, 0, 0.42, 0); anim.torso = torso;
      addVoxel(torso, 0.44, 0.34, 0.72, c1, 0, 0, 0);
      const head = mkP(torso, 0, 0.22, 0.38); anim.head = head;
      addVoxel(head, 0.34, 0.28, 0.38, c1, 0, 0.04, 0.14);
      addEyes(head, 0.12, 0.08, 0.34, c2, true);
      for (const sx of [-1, 1]) {
        const wp = mkP(torso, sx * 0.24, 0.12, 0.06);
        addVoxel(wp, 0.56, 0.05, 0.38, c2, sx * 0.28, 0, -0.06);
        anim.wings.push({ p: wp, dir: sx });
        const lp = mkP(g, sx * 0.16, 0.26, -0.08);
        addVoxel(lp, 0.13, 0.26, 0.14, c3, 0, -0.13, 0);
        anim.legs.push({ p: lp, dir: sx });
      }
      const tail = mkP(torso, 0, 0, -0.36); anim.tail = tail;
      addVoxel(tail, 0.14, 0.14, 0.52, c1, 0, 0, -0.26);
    } else if (arch === 'axolotl' || arch === 'frog' || arch === 'reptile') {
      const isAxo = (arch === 'axolotl'), isFrog = (arch === 'frog');
      const torso = mkP(g, 0, 0.20, 0); anim.torso = torso;
      addVoxel(torso, isFrog ? 0.36 : 0.46, isFrog ? 0.22 : 0.20, isFrog ? 0.40 : 0.62, c1, 0, 0, 0);
      if (!isFrog && !isAxo) addVoxel(torso, 0.42, 0.10, 0.52, c2, 0, 0.12, 0);
      const head = mkP(torso, 0, 0.04, isFrog ? 0.16 : 0.30); anim.head = head;
      addVoxel(head, isAxo ? 0.36 : 0.30, 0.22, 0.28, isAxo ? c1 : c2, 0, 0.02, 0.10);
      addEyes(head, 0.10, 0.06, 0.25);
      if (isAxo) {
        for (const sx of [-1, 1]) addVoxel(head, 0.14, 0.18, 0.05, c2, sx * 0.24, 0.04, 0.06);
      }
      if (!isFrog) {
        const tail = mkP(torso, 0, 0, -0.32); anim.tail = tail;
        addVoxel(tail, 0.10, 0.12, 0.34, c2, 0, 0, -0.17);
      }
      for (const [lx, lz, d] of [[-0.20, 0.18, 1], [0.20, 0.18, -1], [-0.20, -0.18, -1], [0.20, -0.18, 1]]) {
        const lp = mkP(g, lx, 0.14, lz);
        addVoxel(lp, 0.10, 0.14, 0.10, c3, 0, -0.07, 0);
        anim.legs.push({ p: lp, dir: d });
      }
    } else if (arch === 'strider') {
      const torso = mkP(g, 0, 0.72, 0); anim.torso = torso;
      addVoxel(torso, 0.62, 0.52, 0.62, c1, 0, 0, 0);
      addEyes(torso, 0.16, 0.02, 0.32);
      for (const [lx, d] of [[-0.18, 1], [0.18, -1]]) {
        const lp = mkP(g, lx, 0.46, 0);
        addVoxel(lp, 0.14, 0.46, 0.14, c2, 0, -0.23, 0);
        anim.legs.push({ p: lp, dir: d });
      }
    } else {
      const tallNeck = (arch === 'camel' || arch === 'caravan' || id === 'alpaca' || id === 'llama' || id === 'giraffe');
      const torso = mkP(g, 0, 0.44, 0); anim.torso = torso;
      addVoxel(torso, 0.38, 0.32, 0.60, c1, 0, 0, 0);
      const head = mkP(torso, 0, tallNeck ? 0.36 : 0.14, 0.30); anim.head = head;
      if (tallNeck) addVoxel(head, 0.18, 0.36, 0.18, c1, 0, -0.12, -0.02);
      addVoxel(head, 0.30, 0.26, 0.28, c1, 0, 0.08, 0.08);
      addVoxel(head, 0.16, 0.10, 0.10, c2, 0, 0.02, 0.24);
      addEyes(head, 0.09, 0.11, 0.23);
      for (const sx of [-1, 1]) {
        const earH = (arch === 'fennec' || id === 'rabbit_brown' || id === 'snow_hare') ? 0.22 : (arch === 'horn' ? 0.24 : 0.11);
        addVoxel(head, 0.08, earH, 0.06, arch === 'horn' ? c3 : c2, sx * 0.11, 0.22 + earH * 0.4, 0.04);
      }
      const tail = mkP(torso, 0, 0.04, -0.31); anim.tail = tail;
      addVoxel(tail, 0.10, 0.10, 0.26, c2, 0, 0, -0.13);
      const lCoords = [[-0.13, 0.20], [0.13, 0.20], [-0.13, -0.20], [0.13, -0.20]];
      for (let li = 0; li < lCoords.length; li++) {
        const lp = mkP(g, lCoords[li][0], 0.28, lCoords[li][1]);
        addVoxel(lp, 0.11, 0.28, 0.11, c3, 0, -0.14, 0);
        anim.legs.push({ p: lp, dir: (li & 1) ? 1 : -1 });
      }
    }
    const fg = makeSharedFlameGroup();
    g.add(fg);
    return { group: g, parts, flameGroup: fg, anim, fromBlender: false, isPlaceholder: true };
  }
  function buildAnimalSpeciesMesh(spec) {
    if (CUSTOM_VOXEL_ANIMALS.has(spec.id)) return buildMobMesh(spec.id, 0, 0, null);
    const pick = pickVerdantBlenderAnimal(spec);
    const built = instantiateBlenderMob(pick.key);
    if (!built) {
      const ph = buildAnimalPlaceholderMesh(spec);
      ph.pendingGlbKey = pick.key;
      ph.glbKey = null;
      ph.group.scale.setScalar(pick.sc);
      return ph;
    }
    built.isPlaceholder = false;
    built.pendingGlbKey = null;
    built.glbKey = pick.key;
    built.group.scale.setScalar(pick.sc);
    // Keep Project-Verdant hero animals in their exact sculpted palette; softly tint color variants!
    if (!VERDANT_PURE_PALETTE.has(spec.id)) {
      const tint = new THREE.Color(spec.c1);
      const luma = tint.r * 0.299 + tint.g * 0.587 + tint.b * 0.114;
      tint.lerp(new THREE.Color(0xffffff), luma < 0.25 ? 0.56 : 0.40);
      for (let i = 0; i < built.parts.length; i++) {
        const mat = _cloneMobMatIfShared(built.parts[i]);
        if (mat && mat.color) {
          mat.color.copy(tint);
        }
      }
    }
    return built;
  }

  function pickBiomeAnimal(biomeObj, wantAqua = false) {
    const tagMap = {
      [BIOMES.PLAINS.id]: 'plains', [BIOMES.FOREST.id]: 'forest', [BIOMES.DESERT.id]: 'desert',
      [BIOMES.SNOW.id]: 'snow', [BIOMES.SAKURA.id]: 'sakura', [BIOMES.SWAMP.id]: 'swamp',
      [BIOMES.MESA.id]: 'mesa', [BIOMES.AUTUMN.id]: 'autumn', [BIOMES.LUSH_GROVE.id]: 'lush',
      [BIOMES.FLOWER_MEADOW.id]: 'meadow', [BIOMES.TAIGA.id]: 'taiga',
      [BIOMES.BEACH_PALM.id]: 'beach', [BIOMES.TROPICAL_COAST.id]: 'beach', [BIOMES.MUSHROOM_ISLAND.id]: 'lush', [BIOMES.MANGROVE_SWAMP.id]: 'mangrove',
      [BIOMES.ALPINE_PEAKS.id]: 'alpine', [BIOMES.CLOUD_PEAKS.id]: 'alpine', [BIOMES.HIGHLAND_PLATEAU.id]: 'plateau',
      [BIOMES.DEEP_OCEAN.id]: 'ocean', [BIOMES.ABYSS_TRENCH.id]: 'ocean', [BIOMES.BAMBOO_JUNGLE.id]: 'bamboo',
      [BIOMES.REDWOOD_ANCIENT.id]: 'redwood', [BIOMES.WEEPING_GROVE.id]: 'weeping',
      [BIOMES.BIRCH_ANCIENT.id]: 'birch', [BIOMES.LAVENDER_MEADOW.id]: 'meadow',
      [BIOMES.AUTUMN_GOLDEN.id]: 'autumn', [BIOMES.AUTUMN_DEEP.id]: 'autumn',
      [BIOMES.BLUE_FOREST.id]: 'lush', [BIOMES.WHEAT_VALLEY.id]: 'plains',
      [BIOMES.PINE_VALLEY.id]: 'taiga', [BIOMES.GIANT_JUNGLE.id]: 'weeping',
      [BIOMES.GREEN_PLAINS.id]: 'plains', [BIOMES.SNOWY_PLAINS.id]: 'snow'
    };
    const tag = tagMap[biomeObj.id] || 'plains';
    const pool = ANIMAL_SPECIES.filter(sp => (sp[10].includes('a') === wantAqua) && sp[9].includes(tag));
    const list = pool.length ? pool : ANIMAL_SPECIES.filter(sp => sp[10].includes('a') === wantAqua);
    return list[Math.floor(Math.random() * list.length)][0];
  }

  const MOB_STATS = {
    ender_dragon:    { hostile: true,  hp: 750, speed: 7.80, r: 2.65, h: 3.3, dmg: 18.0, isBoss: true, flying: true, bossLabel: 'RỒNG ENDER', bossGrad: 'linear-gradient(90deg, #7e22ce, #d946ef, #f0abfc)' },
    ice_dragon:      { displayName: 'Rồng Băng',     hostile: true, hp: 460, speed: 7.00, r: 2.35, h: 2.9, dmg: 14.0, isBoss: true, flying: true, elementalDragon: 'ice',   bossLabel: 'RỒNG BĂNG',     bossGrad: 'linear-gradient(180deg, #38bdf8, #0284c7, #075985)' },
    fire_dragon:     { displayName: 'Rồng Lửa',      hostile: true, hp: 490, speed: 7.40, r: 2.35, h: 2.9, dmg: 15.0, isBoss: true, flying: true, elementalDragon: 'fire',  noSunBurn: true, bossLabel: 'RỒNG LỬA', bossGrad: 'linear-gradient(180deg, #facc15, #f97316, #991b1b)' },
    earth_dragon:    { displayName: 'Rồng Đất',      hostile: true, hp: 540, speed: 6.40, r: 2.50, h: 3.0, dmg: 16.0, isBoss: true, flying: true, elementalDragon: 'earth', bossLabel: 'RỒNG ĐẤT',      bossGrad: 'linear-gradient(180deg, #f59e0b, #a16207, #44403c)' },
    water_dragon:    { displayName: 'Rồng Nước',     hostile: true, hp: 470, speed: 7.20, r: 2.35, h: 2.9, dmg: 14.0, isBoss: true, flying: true, elementalDragon: 'water', noSunBurn: true, bossLabel: 'RỒNG NƯỚC', bossGrad: 'linear-gradient(180deg, #67e8f9, #06b6d4, #1e40af)' },
    leaf_dragon:     { displayName: 'Rồng Lá',       hostile: true, hp: 440, speed: 7.10, r: 2.35, h: 2.9, dmg: 13.0, isBoss: true, flying: true, elementalDragon: 'leaf',  bossLabel: 'RỒNG LÁ',       bossGrad: 'linear-gradient(180deg, #bef264, #22c55e, #14532d)' },
    tree_dragon:     { displayName: 'Rồng Cổ Thụ',   hostile: true, hp: 500, speed: 6.70, r: 2.40, h: 3.0, dmg: 14.5, isBoss: true, flying: true, elementalDragon: 'tree',  bossLabel: 'RỒNG CỔ THỤ',   bossGrad: 'linear-gradient(180deg, #84cc16, #3f6212, #451a03)' },
    void_end_dragon:     { displayName: 'Rồng Hư Không End',   hostile: true, hp: 680,  speed: 8.60, r: 2.50, h: 3.1, dmg: 19.0, isBoss: true, flying: true, noSunBurn: true, endRealmDragon: true, bossLabel: '🌌 RỒNG HƯ KHÔNG THE END',     bossGrad: 'linear-gradient(180deg, #e879f9, #9333ea, #3b0764)' },
    amethyst_end_dragon: { displayName: 'Rồng Thạch Anh End',  hostile: true, hp: 640,  speed: 8.80, r: 2.50, h: 3.1, dmg: 18.0, isBoss: true, flying: true, noSunBurn: true, endRealmDragon: true, bossLabel: '💎 RỒNG THẠCH ANH THE END',    bossGrad: 'linear-gradient(180deg, #f472b6, #a855f7, #4c1d95)' },
    storm_end_dragon:    { displayName: 'Rồng Bão Tím End',    hostile: true, hp: 660,  speed: 9.20, r: 2.50, h: 3.1, dmg: 18.5, isBoss: true, flying: true, noSunBurn: true, endRealmDragon: true, bossLabel: '⚡ RỒNG BÃO TÍM THE END',     bossGrad: 'linear-gradient(180deg, #38bdf8, #a855f7, #312e81)' },
    abyss_end_dragon:    { displayName: 'Rồng Vực Thẳm End',   hostile: true, hp: 700,  speed: 8.40, r: 2.60, h: 3.2, dmg: 20.0, isBoss: true, flying: true, noSunBurn: true, endRealmDragon: true, bossLabel: '🌑 RỒNG VỰC THẲM THE END',    bossGrad: 'linear-gradient(180deg, #fb7185, #7e22ce, #1e0634)' },
    sovereign_end_dragon:{ displayName: 'Boss Tối Thượng Rồng End', hostile: true, hp: 2400, speed: 9.00, r: 3.20, h: 4.0, dmg: 26.0, isBoss: true, flying: true, noSunBurn: true, endRealmDragon: true, sovereignBoss: true, bossLabel: '👑 BOSS TỐI THƯỢNG RỒNG END • 50 KỸ NĂNG', bossGrad: 'linear-gradient(90deg, #38bdf8, #d946ef, #7e22ce, #1e0634)' },
    cave_warden:     { hostile: true,  hp: 500, speed: 2.85, r: 0.72, h: 2.85, dmg: 16.0, isBoss: true, noSunBurn: true, displayName: 'Warden', bossLabel: '💀 WARDEN — QUÁI THÚ DEEP DARK', bossGrad: 'linear-gradient(90deg, #064e63, #0891b2, #22d3ee)' },
    sculk_stalker:      { hostile: true, hp: 200, speed: 3.45, r: 0.56, h: 2.05, dmg: 14.0, noSunBurn: true, displayName: 'Thợ Săn Sculk Stalker' },
    sculk_brute:        { hostile: true, hp: 450, speed: 2.55, r: 0.85, h: 2.65, dmg: 20.0, noSunBurn: true, chargeKnock: true, displayName: 'Khổng Lồ Sculk Brute' },
    sculk_sentinel:     { hostile: true, hp: 320, speed: 2.35, r: 0.72, h: 2.55, dmg: 16.0, noSunBurn: true, ranged: 'sonic_boom', displayName: 'Vệ Binh Sculk Sentinel' },
    sculk_soul_ravager: { hostile: true, hp: 1000, speed: 2.80, r: 1.05, h: 3.10, dmg: 26.0, isBoss: true, chargeKnock: true, ranged: 'sonic_boom', noSunBurn: true, bossLabel: '👁️ SCULK SOUL RAVAGER • CHÚA TỂ CỔ THÀNH', bossGrad: 'linear-gradient(90deg, #064e63, #0e7490, #22d3ee)', displayName: 'Sculk Soul Ravager' },
    // v22 4 Brand-New Nether Mobs + 4 Brand-New End City Mobs (Cute Project-Verdant Blender Voxel Style!)
    strider:         { hostile: false, hp: 20,  speed: 2.15, r: 0.58, h: 1.45, dmg: 0,   noSunBurn: true, displayName: 'Strider Dung Nham' },
    magma_cube:      { hostile: true,  hp: 24,  speed: 2.20, r: 0.68, h: 1.05, dmg: 4.5, noSunBurn: true, hopper: true, displayName: 'Khối Magma Cube' },
    zoglin:          { hostile: true,  hp: 40,  speed: 3.05, r: 0.85, h: 1.45, dmg: 6.0, noSunBurn: true, chargeKnock: true, displayName: 'Lợn Địa Ngục Zoglin' },
    soul_wisp:       { hostile: true,  hp: 24,  speed: 3.30, r: 0.55, h: 1.50, dmg: 4.5, noSunBurn: true, flying: true, ranged: 'sonic_boom', displayName: 'Hồn Lửa Soul Wisp' },
    endermite:       { hostile: true,  hp: 14,  speed: 3.25, r: 0.45, h: 0.65, dmg: 3.0, noSunBurn: true, displayName: 'Bọ Hư Không Endermite' },
    void_golem:      { hostile: true,  hp: 70,  speed: 1.95, r: 0.95, h: 2.45, dmg: 7.5, noSunBurn: true, chargeKnock: true, displayName: 'Golem Thành End' },
    chorus_crawler:  { hostile: true,  hp: 22,  speed: 2.65, r: 0.62, h: 1.15, dmg: 4.0, noSunBurn: true, ranged: 'shulker_bolt', displayName: 'Nhện Hoa Chorus' },
    end_phantom:     { hostile: true,  hp: 26,  speed: 4.65, r: 0.95, h: 1.20, dmg: 5.0, noSunBurn: true, flying: true, displayName: 'Bóng Ma End Phantom' },
    hoglin:          { hostile: true,  hp: 36,  speed: 2.95, r: 0.85, h: 1.4, dmg: 5.5, noSunBurn: true, chargeKnock: true },
    piglin:          { hostile: true,  hp: 24,  speed: 2.65, r: 0.52, h: 1.9, dmg: 4.5, noSunBurn: true },
    blaze:           { hostile: true,  hp: 26,  speed: 2.40, r: 0.55, h: 2.0, dmg: 4.5, noSunBurn: true, flying: true, ranged: 'blaze_fire' },
    // v43 THE SIFT EXCLUSIVE CUTE VOXEL CREATURES (only spawn in The Sift!)
    blub:            { hostile: false, siftOnly: true, hp: 14, speed: 2.35, r: 0.42, h: 0.85, dmg: 0, noSunBurn: true, displayName: 'Blub Mộng Mơ' },
    wobble:          { hostile: false, siftOnly: true, hp: 16, speed: 2.25, r: 0.44, h: 0.90, dmg: 0, noSunBurn: true, displayName: 'Wobble Hồng' },
    nuzzle:          { hostile: false, siftOnly: true, hp: 18, speed: 1.95, r: 0.50, h: 1.15, dmg: 0, noSunBurn: true, displayName: 'Cừu Mây Nuzzle' },
    trill:           { hostile: false, siftOnly: true, skyBird: true, hp: 12, speed: 2.85, r: 0.36, h: 0.85, dmg: 0, noSunBurn: true, displayName: 'Chim Trill' },
    singer:          { hostile: false, siftOnly: true, hp: 32, speed: 2.15, r: 0.52, h: 1.85, dmg: 0, noSunBurn: true, displayName: 'Thần Rừng Singer' },
    echo_golem:      { hostile: false, neutral: true, siftOnly: true, hp: 65, speed: 1.75, r: 0.68, h: 2.05, dmg: 7.5, noSunBurn: true, displayName: 'Echo Golem Pha Lê' },
    humbler:         { hostile: false, neutral: true, siftOnly: true, hp: 22, speed: 2.05, r: 0.48, h: 1.05, dmg: 3.5, noSunBurn: true, displayName: 'Bọ Rêu Humbler' },
    roamroot:        { hostile: false, siftOnly: true, hp: 20, speed: 1.80, r: 0.52, h: 1.35, dmg: 0, noSunBurn: true, displayName: 'Nấm Đi Bộ Roamroot' },
    ichor_ray:       { hostile: false, siftOnly: true, hp: 18, speed: 2.60, r: 0.65, h: 0.60, dmg: 0, noSunBurn: true, skyBird: true, displayName: 'Cá Đuối Bay Ichor Ray' },
    harmonizer:      { hostile: true,  siftOnly: true, hp: 42, speed: 2.45, r: 0.55, h: 1.85, dmg: 6.0, noSunBurn: true, flying: true, displayName: 'Tinh Linh Harmonizer' },
    nightmare_stalker:{ hostile: true, siftOnly: true, hp: 64, speed: 2.85, r: 0.62, h: 2.05, dmg: 8.5, noSunBurn: true, flying: true, displayName: 'Ác Mộng Giấc Mơ' },
    sky_manta:       { hostile: false, siftOnly: true, skyBird: true, hp: 28, speed: 3.10, r: 0.75, h: 0.70, dmg: 0, noSunBurn: true, displayName: 'Cá Đuối Mây Sift' },
    dream_warden:    { hostile: true,  siftOnly: true, isBoss: true, hp: 420, speed: 2.75, r: 0.74, h: 2.85, dmg: 14.0, noSunBurn: true, displayName: 'Vệ Thần Giấc Mơ', bossLabel: '✨ VỆ THẦN GIẤC MƠ — BOSS THE SIFT', bossGrad: 'linear-gradient(90deg, #581c87, #a855f7, #f0abfc)' },
    ghast:           { hostile: true,  hp: 32,  speed: 2.80, r: 1.55, h: 2.8, dmg: 7.0, noSunBurn: true, flying: true, ranged: 'ghast_fire' },
    wither_skeleton: { hostile: true,  hp: 32,  speed: 2.55, r: 0.55, h: 2.3, dmg: 5.5, noSunBurn: true },
    shulker:         { hostile: true,  hp: 30,  speed: 0.0,  r: 0.65, h: 1.1, dmg: 4.5, noSunBurn: true, ranged: 'shulker_bolt', turret: true },
    zombie:          { hostile: true,  hp: 20, speed: 2.35, r: 0.52, h: 1.9, dmg: 3 },
    husk:            { hostile: true,  hp: 22, speed: 2.30, r: 0.52, h: 1.9, dmg: 3.5, noSunBurn: true },
    frozen_zombie:   { hostile: true,  hp: 22, speed: 2.15, r: 0.52, h: 1.9, dmg: 3.8, noSunBurn: true, displayName: 'Zombie Băng Tuyết' },
    mossy_zombie:    { hostile: true,  hp: 22, speed: 2.25, r: 0.52, h: 1.9, dmg: 3.6, noSunBurn: true, displayName: 'Zombie Rêu Rừng' },
    zombified_piglin:{ hostile: false, neutral: true, hp: 28, speed: 2.65, r: 0.52, h: 1.9, dmg: 5.5, noSunBurn: true, displayName: 'Piglin Thây Ma' },
    chicken_jockey:  { hostile: true,  hp: 18, speed: 3.15, r: 0.50, h: 1.45, dmg: 3.5, noSunBurn: true, displayName: 'Baby Zombie Cưỡi Gà' },
    zombie_horse:    { hostile: false, neutral: true, hp: 26, speed: 2.75, r: 0.72, h: 1.55, dmg: 3.5, noSunBurn: true, displayName: 'Ngựa Thây Ma' },
    skeleton:        { hostile: true,  hp: 20, speed: 2.20, r: 0.50, h: 1.9, dmg: 3, ranged: 'arrow' },
    stray:           { hostile: true,  hp: 20, speed: 2.20, r: 0.50, h: 1.9, dmg: 3.5, ranged: 'frost' },
    desert_skeleton: { hostile: true,  hp: 20, speed: 2.25, r: 0.50, h: 1.9, dmg: 3.5, noSunBurn: true, ranged: 'arrow', displayName: 'Skeleton Sa Mạc' },
    bogged:          { hostile: true,  hp: 20, speed: 2.15, r: 0.50, h: 1.9, dmg: 3.8, noSunBurn: true, ranged: 'poison_arrow', displayName: 'Skeleton Nấm Bogged' },
    spider:          { hostile: true,  hp: 16, speed: 3.05, r: 0.80, h: 0.9, dmg: 2 },
    spider_jockey:   { hostile: true,  hp: 30, speed: 3.05, r: 0.80, h: 2.05, dmg: 3.5, ranged: 'arrow', displayName: 'Skeleton Cưỡi Nhện' },
    slime:           { hostile: true,  hp: 16, speed: 2.05, r: 0.62, h: 0.95, dmg: 2.5, hopper: true },
    sulfur_slime:    { hostile: true,  hp: 20, speed: 2.15, r: 0.66, h: 0.98, dmg: 3.0, hopper: true, noSunBurn: true, displayName: 'Slime Lưu Huỳnh 🧪' },
    creeper:         { hostile: true,  hp: 20, speed: 2.30, r: 0.55, h: 1.8, dmg: 0 },
    charged_creeper: { hostile: true,  hp: 24, speed: 2.50, r: 0.55, h: 1.85, dmg: 0, noSunBurn: true, blastRadius: 5.0, blastDmg: 26, displayName: 'Creeper Điện ⚡' },
    icy_creeper:     { hostile: true,  hp: 22, speed: 2.35, r: 0.55, h: 1.80, dmg: 0, noSunBurn: true, blastRadius: 3.4, blastDmg: 17, frostBlast: true, displayName: 'Creeper Băng ❄️' },
    potato_creeper:  { hostile: true,  hp: 18, speed: 2.35, r: 0.55, h: 1.80, dmg: 0, blastRadius: 2.8, blastDmg: 12, displayName: 'Creeper Khoai Tây' },
    nerd_creeper:    { hostile: true,  hp: 20, speed: 2.25, r: 0.55, h: 1.80, dmg: 0, blastRadius: 3.2, blastDmg: 14, displayName: 'Creeper Mọt Sách' },
    ghost_creeper:   { hostile: true,  hp: 18, speed: 2.70, r: 0.52, h: 1.80, dmg: 0, noSunBurn: true, blastRadius: 3.2, blastDmg: 15, displayName: 'Creeper Bóng Ma' },
    moobloom:        { hostile: false, hp: 12, speed: 1.30, r: 0.65, h: 1.3, displayName: 'Bò Hoa Vàng Moobloom' },
    cluckshroom:     { hostile: false, hp: 8,  speed: 1.55, r: 0.42, h: 0.75, displayName: 'Gà Nấm Đỏ Cluckshroom' },
    wooly_cow:       { hostile: false, hp: 14, speed: 1.25, r: 0.68, h: 1.35, displayName: 'Bò Lông Xù Wooly Cow' },
    cinnamon_ferret: { hostile: false, hp: 10, speed: 2.35, r: 0.44, h: 0.58, displayName: 'Chồn Cinnamon Ferret' },
    baby_ghast:      { hostile: false, hp: 18, speed: 2.20, r: 0.62, h: 1.15, flying: true, noSunBurn: true, displayName: 'Bé Ghast Dễ Thương' },
    copper_golem:    { hostile: false, neutral: true, guardian: true, hp: 38, speed: 2.10, r: 0.55, h: 1.35, dmg: 6.5, noSunBurn: true, displayName: 'Golem Đồng Mini' },
    tuff_golem:      { hostile: false, hp: 30, speed: 1.55, r: 0.52, h: 1.25, noSunBurn: true, displayName: 'Golem Đá Tuff' },
    blue_crab:       { hostile: false, neutral: true, hp: 14, speed: 1.90, r: 0.55, h: 0.75, dmg: 3.5, displayName: 'Cua Xanh Càng Cam' },
    antler_deer:     { hostile: false, hp: 16, speed: 2.55, r: 0.62, h: 1.45, displayName: 'Hươu Sừng Trắng' },
    glare_mob:       { hostile: false, hp: 16, speed: 2.15, r: 0.52, h: 1.15, flying: true, noSunBurn: true, displayName: 'Tinh Linh Hang Glare' },
    wildfire:        { hostile: true,  hp: 160, speed: 2.40, r: 0.78, h: 2.35, dmg: 6.5, noSunBurn: true, flying: true, ranged: 'blaze_fire', isBoss: true, bossLabel: '🔥 WILDFIRE • THẦN LỬA ĐỊA NGỤC', bossGrad: 'linear-gradient(90deg, #ea580c, #facc15)', displayName: 'Thần Lửa Wildfire 🔥' },
    redstone_monstrosity: { hostile: true, hp: 240, speed: 1.75, r: 1.35, h: 2.90, dmg: 10.5, noSunBurn: true, chargeKnock: true, ranged: 'blaze_fire', isBoss: true, bossLabel: '🌋 REDSTONE MONSTROSITY • QUÁI THÚ ĐỎ', bossGrad: 'linear-gradient(90deg, #dc2626, #fb923c)', displayName: 'Quái Vật Redstone' },
    prismarine_colossus:  { hostile: true, hp: 200, speed: 1.85, r: 1.15, h: 2.85, dmg: 8.5, noSunBurn: true, chargeKnock: true, ranged: 'guardian_beam', isBoss: true, bossLabel: '🔱 PRISMARINE COLOSSUS • THỦ THẦN', bossGrad: 'linear-gradient(90deg, #0d9488, #67e8f9)', displayName: 'Thần Đá Prismarine' },
    abyssal_colossus:     { hostile: true, hp: 220, speed: 1.80, r: 1.20, h: 2.95, dmg: 9.5, noSunBurn: true, aqua: true, chargeKnock: true, isBoss: true, bossLabel: '🌊 ABYSSAL COLOSSUS • QUÁI THÚ BIỂN SÂU', bossGrad: 'linear-gradient(90deg, #0284c7, #38bdf8)', displayName: 'Khổng Lồ Biển Sâu' },
    ocean_barnacle:  { hostile: true,  hp: 36, speed: 2.40, r: 0.65, h: 1.00, dmg: 5.5, noSunBurn: true, aqua: true, displayName: 'Quái Biển Barnacle' },
    moss_golem:      { hostile: false, neutral: true, guardian: true, hp: 46, speed: 1.85, r: 0.56, h: 1.45, dmg: 6.0, noSunBurn: true, displayName: 'Golem Rêu Cổ Đại' },
    rascal:          { hostile: false, hp: 24, speed: 2.55, r: 0.48, h: 1.35, noSunBurn: true, displayName: 'Tinh Linh Mỏ Rascal' },
    mini_abomination:{ hostile: true,  hp: 28, speed: 2.45, r: 0.60, h: 1.35, dmg: 4.5, noSunBurn: true, displayName: 'Tiểu Quái Pha Lê' },
    wither_knight:   { hostile: true,  hp: 34, speed: 2.55, r: 0.58, h: 2.2, dmg: 5.5, noSunBurn: true },
    wither:          { hostile: true,  hp: 300, speed: 3.40, r: 0.90, h: 2.1, dmg: 8.5, isBoss: true, flying: true, noSunBurn: true, ranged: 'ghast_fire', bossLabel: '💀 WITHER BOSS • CHÚA TỂ HƯ VÔ', bossGrad: 'linear-gradient(90deg, #18181b, #52525b, #f472b6)', displayName: 'Chúa Tể Wither' },
    enderman:        { hostile: false, neutral: true, eyeAggro: true, hp: 40, speed: 2.85, r: 0.52, h: 2.1, dmg: 5.5, noSunBurn: true, displayName: 'Enderman' },
    breeze:          { hostile: true,  hp: 30, speed: 3.10, r: 0.55, h: 1.65, dmg: 4.5, noSunBurn: true, hopper: true, ranged: 'ice_shard', displayName: 'Tinh Linh Gió Breeze' },
    snow_golem:      { hostile: false, neutral: true, guardian: true, hp: 22, speed: 1.85, r: 0.45, h: 1.55, dmg: 3.5, noSunBurn: true, ranged: 'ice_shard', displayName: 'Người Tuyết Snow Golem' },
    creaking:        { hostile: true,  hp: 42, speed: 2.40, r: 0.52, h: 2.05, dmg: 5.5, noSunBurn: true, displayName: 'Quái Gỗ Creaking' },
    void_stalker:    { hostile: false, neutral: true, eyeAggro: true, hp: 40, speed: 2.85, r: 0.58, h: 2.9, dmg: 5 },
    magma_golem:     { hostile: true,  hp: 80, speed: 1.75, r: 1.05, h: 2.6, dmg: 7, isBoss: true, bossLabel: '🔥 GOLEM DUNG NHAM (MINI-BOSS)', bossGrad: 'linear-gradient(90deg, #ea580c, #facc15)' },
    phantom_drake:   { hostile: true,  hp: 28, speed: 4.40, r: 0.95, h: 1.2, dmg: 4, flying: true },
    // 10 Brand-New Blender 3D Monsters (v17)
    ravager:         { hostile: true,  hp: 65, speed: 2.65, r: 1.05, h: 2.2, dmg: 7.5, noSunBurn: true, chargeKnock: true, displayName: 'Quái Thú Ravager' },
    evoker:          { hostile: true,  hp: 28, speed: 2.25, r: 0.50, h: 1.95, dmg: 5.0, noSunBurn: true, ranged: 'evoker_fang', displayName: 'Cướp Dân Làng Mục Sư' },
    vindicator:      { hostile: true,  hp: 24, speed: 2.85, r: 0.48, h: 1.95, dmg: 6.5, noSunBurn: true, displayName: 'Cướp Dân Làng Cầm Rìu' },
    pillager:        { hostile: true,  hp: 24, speed: 2.40, r: 0.50, h: 1.95, dmg: 4.0, noSunBurn: true, ranged: 'arrow', displayName: 'Cướp Nỏ Pillager' },
    pillager_raider: { hostile: true,  hp: 28, speed: 2.35, r: 0.50, h: 1.95, dmg: 5.0, noSunBurn: true, ranged: 'arrow', displayName: 'Cướp Giáp Lông Cam' },
    drowned:         { hostile: true,  hp: 22, speed: 2.35, r: 0.52, h: 1.90, dmg: 4.0, noSunBurn: true, ranged: 'trident', displayName: 'Thây Ma Biển Drowned' },
    guardian:        { hostile: true,  hp: 32, speed: 2.55, r: 0.72, h: 1.15, dmg: 4.5, noSunBurn: true, aqua: true, ranged: 'guardian_beam', displayName: 'Vệ Binh Đại Dương Guardian' },
    witch:           { hostile: true,  hp: 26, speed: 2.15, r: 0.50, h: 1.95, dmg: 4.0, noSunBurn: true, ranged: 'witch_potion', displayName: 'Phù Thủy Đầm Lầy Witch' },
    iceologer:       { hostile: true,  hp: 30, speed: 2.25, r: 0.52, h: 1.95, dmg: 5.0, noSunBurn: true, ranged: 'ice_shard', displayName: 'Pháp Sư Băng Iceologer' },
    piglin_brute:    { hostile: true,  hp: 44, speed: 2.75, r: 0.56, h: 1.95, dmg: 6.5, noSunBurn: true, displayName: 'Chiến Binh Piglin Brute' },
    ruin_stalker:    { hostile: true,  hp: 36, speed: 3.05, r: 0.58, h: 2.25, dmg: 5.5, noSunBurn: true, displayName: 'Quái Tàn Tích Ruin Stalker' },
    gargoyle:        { hostile: true,  hp: 34, speed: 3.65, r: 0.80, h: 1.65, dmg: 5.0, noSunBurn: true, flying: true, displayName: 'Quỷ Đá Cao Ốc Gargoyle' },
    villager:        { hostile: false, hp: 20, speed: 1.35, r: 0.48, h: 1.95, villager: true },
    iron_golem:      { hostile: false, neutral: true, hp: 100, speed: 1.75, r: 0.90, h: 2.65, dmg: 14, guardian: true },
    wolf:            { hostile: false, neutral: true, hp: 14, speed: 2.85, r: 0.48, h: 0.85, dmg: 3, displayName: 'Sói Rừng' },
    pig:             { hostile: false, hp: 10, speed: 1.35, r: 0.55, h: 0.9, displayName: 'Lợn' },
    cow:             { hostile: false, hp: 10, speed: 1.25, r: 0.65, h: 1.3, displayName: 'Bò' },
    sheep:           { hostile: false, hp: 8,  speed: 1.30, r: 0.55, h: 1.1, displayName: 'Cừu' },
    chicken:         { hostile: false, hp: 5,  speed: 1.50, r: 0.40, h: 0.7, displayName: 'Gà' },
    fox:             { hostile: false, hp: 10, speed: 1.85, r: 0.45, h: 0.7, displayName: 'Cáo Đỏ' }
  };

  function disposeMobInstance(m) {
    if (!m || m._dead) return;
    _disposeMobAnim(m);
    if (typeof player !== 'undefined' && player.ridingDragon === m) {
      if (typeof detachRiderFromDragon === 'function') detachRiderFromDragon();
      player.ridingDragon = null;
      player.sitting = false;
    }
    m._dead = true;
    scene.remove(m.group);
    if (m.hpBar) { m.hpBar.tex.dispose(); m.hpBar.sp.material.dispose(); m.hpBar = null; }
    for (let i = 0; i < m.parts.length; i++) {
      const mat = m.parts[i].material;
      if (mat && !(mat.userData && mat.userData.sharedMat)) mat.dispose();
      if (!m.fromBlender && !m.parts[i].userData.sharedGeo && m.parts[i].geometry) m.parts[i].geometry.dispose();
    }
  }

  let _vilSpawnSeq = 0;
  function spawnMobOfType(type, wx, wy, wz, opts = null) {
    const sp = ANIMAL_MAP.get(type);
    const st = sp
      ? { hostile: false, neutral: sp.neutral, hp: sp.hp, speed: sp.spd, r: Math.max(0.35, 0.52 * sp.sc), h: Math.max(0.55, 1.05 * sp.sc), dmg: sp.neutral ? 4 : 0, flying: sp.fly, aqua: sp.aqua, hopper: sp.hopper, skyBird: sp.fly, displayName: sp.name }
      : (MOB_STATS[type] || MOB_STATS.pig);
    const woolSpec = (type === 'sheep') ? ((opts && opts.woolSpec) || pickSeededWoolColor(wx, wz)) : null;
    const mobOpts = (type === 'villager')
      ? Object.assign({ profIdx: (opts && typeof opts.profIdx === 'number') ? opts.profIdx : (_vilSpawnSeq++ % 4) }, opts || {})
      : (woolSpec ? { woolSpec } : opts);
    const built = sp ? buildAnimalSpeciesMesh(sp) : buildMobMesh(type, wx, wz, mobOpts);
    const hpBar = null; // Lazy-created in updateMobHpBar() only when mob actually takes damage!
    const _isDrgType = IS_DRAGON_MOB.has(type);
    if (_isDrgType && st.flying && !(opts && opts.tamed)) {
      if (opts && opts.fromSave) {
        if (isSolidAt(Math.floor(wx), Math.floor(wy), Math.floor(wz)) || isSolidAt(Math.floor(wx), Math.floor(wy + 1), Math.floor(wz))) {
          wy = _getSafeDragonSkyY(wx, wz, 14);
        }
      } else {
        const minAirY = _getSafeDragonSkyY(wx, wz, 8);
        if (wy < minAirY || isSolidAt(Math.floor(wx), Math.floor(wy), Math.floor(wz)) || isSolidAt(Math.floor(wx), Math.floor(wy + 1), Math.floor(wz))) {
          wy = _getSafeDragonSkyY(wx, wz, 14);
        }
      }
    }
    built.group.position.set(wx, wy, wz);
    scene.add(built.group);
    const _rvName = (type === 'spider_jockey') ? (built.riderVariant === 'stray' ? 'Stray Cưỡi Nhện' : (built.riderVariant === 'bogged' ? 'Bogged Cưỡi Nhện' : (built.riderVariant === 'desert_skeleton' ? 'Skeleton Sa Mạc Cưỡi Nhện' : 'Skeleton Cưỡi Nhện'))) : null;
    const _rvRange = (type === 'spider_jockey' && built.riderVariant === 'stray') ? 'frost' : ((type === 'spider_jockey' && built.riderVariant === 'bogged') ? 'poison_arrow' : null);
    const _drgScInit = built.group.userData.dragonScale || built.group.scale.x || 1;
    const _drgHbInit = _isDrgType ? _calcDragonHitbox(_drgScInit) : null;
    const m = {
      uid: (opts && opts.uid) || ('m_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)),
      type, displayName: woolSpec ? `Cừu ${woolSpec.vi}` : (_rvName || st.displayName || type),
      riderVariant: built.riderVariant || null,
      woolColor: woolSpec ? woolSpec.key : null,
      woolBlockId: woolSpec ? (B[woolSpec.woolKey] || B.WHITE_WOOL) : 0,
      villagerProf: built.villagerProf || null,
      hostile: !(opts && opts.tamed) && !!st.hostile, neutral: !!st.neutral, eyeAggro: !!st.eyeAggro, guardian: !!st.guardian, villager: !!st.villager,
      tamed: !!(opts && opts.tamed), sitting: !!(opts && opts.sitting),
      hopper: !!st.hopper, ranged: _rvRange || st.ranged || null, noSunBurn: !!st.noSunBurn,
      isBoss: !!st.isBoss, flying: !!st.flying, skyBird: !!st.skyBird, aqua: !!st.aqua,
      spawnTag: (opts && opts.spawnTag) || null,
      ruinId: (opts && opts.ruinId) || null,
      elemDragon: st.elementalDragon || null,
      endRealmDragon: !!st.endRealmDragon,
      sovereignBoss: !!st.sovereignBoss,
      dragonMode: st.elementalDragon ? 'fly' : null,
      dragonModeTimer: st.elementalDragon ? (8.5 + Math.random() * 2.5) : 0,
      dragonScale: _isDrgType ? _drgScInit : undefined,
      dragonArmor: (_isDrgType && opts && opts.dragonArmor) ? { ...opts.dragonArmor } : null,
      gender: _isDrgType ? ((opts && opts.gender) || (Math.random() < 0.5 ? 'M' : 'F')) : undefined,
      homeX: (opts && typeof opts.homeX === 'number') ? opts.homeX : undefined,
      homeY: (opts && typeof opts.homeY === 'number') ? opts.homeY : undefined,
      homeZ: (opts && typeof opts.homeZ === 'number') ? opts.homeZ : undefined,
      homeRadius: (opts && typeof opts.homeRadius === 'number') ? opts.homeRadius : undefined,
      nestIdx: (opts && typeof opts.nestIdx === 'number') ? opts.nestIdx : undefined,
      x: wx, y: wy, z: wz, vx: 0, vy: 0, vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: st.hp, maxHp: st.hp, speed: st.speed, hitboxR: _drgHbInit ? _drgHbInit.r : st.r, hitboxH: _drgHbInit ? _drgHbInit.h : st.h, dmg: st.dmg || 2,
      hurtFlash: 0, hpBarTimer: 0, atkCd: 0, atkAnimT: 0, voiceT: 4 + Math.random() * 9, chargeKnock: !!st.chargeKnock,
      wanderT: 1 + Math.random() * 3, fleeT: 0, provoked: 0, hopCd: 0.5,
      walkPhase: Math.random() * 6, burning: false, burnTick: 0, lavaTick: 0,
      stuckT: 0, lastX: wx, lastZ: wz,
      fuseTimer: 0, fusing: false, tpCd: 2.5, swoopT: 0,
      baseScale: built.group.scale.x || 1,
      group: built.group, parts: built.parts, flameGroup: built.flameGroup, anim: built.anim,
      fromBlender: built.fromBlender, isPlaceholder: !!built.isPlaceholder,
      pendingGlbKey: built.pendingGlbKey || (IS_DRAGON_MOB.has(type) && !built.fromBlender ? DRAGON_SHARED_GLB : null),
      glbKey: built.glbKey || (built.fromBlender ? type : null), hpBar
    };
    mobs.push(m);
    if (st.isBoss && !(opts && opts.tamed) && !(opts && opts.silent)) {
      if (IS_DRAGON_MOB.has(type) && !st.flying) m._roarT = 1.25;
      playSfx('roar');
      showToast(st.bossLabel ? `${st.bossLabel} đã xuất hiện!` : '🔥 BOSS đã xuất hiện!');
    }
    return m;
  }

  function growthToDragonStage(g) {
    return g >= 100 ? 4 : (g >= 80 ? 3 : (g >= 50 ? 2 : (g >= 20 ? 1 : 0)));
  }

  function rebuildDragonStageMesh(m) {
    if (!m || !m.elemDragon) return;
    const stage = growthToDragonStage(m.growth || 0);
    const wasRiding = (typeof player !== 'undefined' && player.ridingDragon === m);
    if (wasRiding && typeof detachRiderFromDragon === 'function') detachRiderFromDragon();
    m.dragonStage = stage;
    const built = buildMobMesh(m.type, m.x, m.z, { dragonStage: stage, saddled: !!m.saddled, dragonArmor: m.dragonArmor || null });
    if (!built || !built.group) { if (wasRiding) attachRiderToDragon(m); return; }
    _disposeMobAnim(m);
    scene.remove(m.group);
    for (let i = 0; i < m.parts.length; i++) {
      const mat = m.parts[i].material;
      if (mat && !(mat.userData && mat.userData.sharedMat)) mat.dispose();
    }
    m.group = built.group;
    m.parts = built.parts;
    m.flameGroup = built.flameGroup;
    m.anim = built.anim;
    m.fromBlender = !!built.fromBlender;
    m.pendingGlbKey = built.pendingGlbKey || (!built.fromBlender ? DRAGON_SHARED_GLB : null);
    m.baseScale = built.group.scale.x || 1;
    m.dragonScale = built.group.userData.dragonScale || m.baseScale || 1;
    const stBase = MOB_STATS[m.type] || { hp: 420, dmg: 7.5, r: 2.35, h: 2.9 };
    const ratio = (stBase.hp > 0) ? (m.hp / m.maxHp) : 1;
    const stageHpMul = [0.18, 0.34, 0.56, 0.80, 1.0][stage];
    const stageDmgMul = [0.20, 0.38, 0.62, 0.84, 1.0][stage];
    m.maxHp = Math.max(40, Math.round(stBase.hp * stageHpMul));
    m.hp = Math.max(1, Math.min(m.maxHp, Math.round(m.maxHp * ratio)));
    m.dmg = Math.max(2, +(stBase.dmg * stageDmgMul).toFixed(1));
    const hb = _calcDragonHitbox(m.dragonScale);
    m.hitboxR = hb.r;
    m.hitboxH = hb.h;
    if (m.petTag) {
      if (m.petTag.material && m.petTag.material.map) m.petTag.material.map.dispose();
      if (m.petTag.material) m.petTag.material.dispose();
    }
    const pctLbl = m.growth >= 100 ? (m.saddled ? '100% ★ Cưỡi' : '100% ★ Lớn') : `${Math.round(m.growth || 0)}%`;
    m.petTag = makeNameTagSprite(`♥ ${m.displayName} (${pctLbl})`, '#fbbf24');
    m.group.add(m.petTag);
    if (m.hpBar) { m.hpBar.tex.dispose(); m.hpBar.sp.material.dispose(); m.hpBar = null; }
    _syncDragonOverlayMetrics(m);
    _applyDragonArmorToAnim(m.anim, m.dragonArmor, !!m.saddled);
    m.group.position.set(m.x, m.y, m.z);
    m.group.rotation.y = m.yaw || 0;
    scene.add(m.group);
    if (wasRiding) attachRiderToDragon(m);
  }

  // === v111 Dragon Nest Guardians, Incubation, Ore UI HUD, Rigid Saddle Rider & Mouth Breath ===
  const incubatingEggs = new Map();
  const spawnedDragonNests = new Set();
  let _playerCombatTarget = null, _playerCombatTargetT = 0;
  let _dragonGrowthUiTimer = 0, _activeGrowthDragon = null, _lastMountBtnVis = false, _lastFlightHudVis = false;
  let _lastMountBtnTxt = '';
  const _elDgWrap = document.getElementById('dragonGrowthWrap');
  const _elDgName = document.getElementById('dgName');
  const _elDgPct = document.getElementById('dgPct');
  const _elDgFill = document.getElementById('dragonGrowthFill');
  const _elDgStage = document.getElementById('dgStage');
  const _elDragonMount = document.getElementById('btnDragonMount');
  const _elDragonEquip = document.getElementById('btnDragonEquip');
  const _elDragonFlight = document.getElementById('dragonFlightHud');
  const _elDrgBreath = document.getElementById('btnDragonBreath');
  const _elDrgSk2 = document.getElementById('btnDragonSk2');
  const _elDrgSk3 = document.getElementById('btnDragonSk3');
  const _elDrgSk4 = document.getElementById('btnDragonSk4');
  const _elDrgExit = document.getElementById('btnDragonExit');
  let _lastEquipBtnVis = false, _lastFlightElKey = '';
  const _mouthPos = new THREE.Vector3();
  const _saddleWorldPos = new THREE.Vector3();

  function _turnAngleTowards(cur, target, rate, dt) {
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + d * (1 - Math.exp(-rate * dt));
  }

  function getDragonMouthWorldPos(m, outVec = _mouthPos) {
    if (!m || !m.group) return outVec.set(0, 0, 0);
    m.group.updateMatrixWorld(true);
    if (m.anim && m.anim.jawBone) {
      outVec.set(0, 0.45, 0);
      return m.anim.jawBone.localToWorld(outVec);
    }
    if (m.anim && m.anim.jaw) {
      outVec.set(0, 0.04, 0.50);
      return m.anim.jaw.localToWorld(outVec);
    }
    if (m.anim && m.anim.head) {
      outVec.set(0, -0.10, 1.05);
      return m.anim.head.localToWorld(outVec);
    }
    const sc = m.dragonScale || m.baseScale || 1.0;
    const yaw = m.ryaw !== undefined ? m.ryaw : (m.yaw || 0);
    return outVec.set(m.x + Math.sin(yaw) * (2.6 * sc), m.y + 2.2 * sc, m.z + Math.cos(yaw) * (2.6 * sc));
  }

  function _getDragonSeatMountTarget(m) {
    if (!m || !m.group) return { parent: null, lx: 0, ly: 1.75, lz: 0.10 };
    if (m.anim && m.anim.saddleSeat) return { parent: m.anim.saddleSeat, lx: 0, ly: 0, lz: 0 };
    if (m.anim && m.anim.saddleGroup) return { parent: m.anim.saddleGroup, lx: 0, ly: 0.16, lz: -0.04 };
    if (m.anim && m.anim.torso) return { parent: m.anim.torso, lx: 0, ly: 0.65, lz: 0.06 };
    return { parent: m.group, lx: 0, ly: 1.75, lz: 0.10 };
  }

  function getDragonSaddleWorldPos(m, outVec = _saddleWorldPos) {
    if (!m || !m.group) return outVec.set(player.x, player.y, player.z);
    m.group.updateMatrixWorld(true);
    const t = _getDragonSeatMountTarget(m);
    outVec.set(t.lx, t.ly, t.lz);
    return (t.parent || m.group).localToWorld(outVec);
  }

  function attachRiderToDragon(m) {
    if (!m || !m.group || typeof playerAvatar === 'undefined' || !playerAvatar || !playerAvatar.g) return;
    const t = _getDragonSeatMountTarget(m);
    const parent = t.parent || m.group;
    if (playerAvatar.g.parent !== parent) parent.add(playerAvatar.g);
    const invS = 1 / Math.max(0.12, m.group.scale.x || 1);
    playerAvatar.g.position.set(t.lx, t.ly + 0.06 * invS, t.lz);
    playerAvatar.g.rotation.set(0, 0, 0);
    playerAvatar.g.scale.setScalar(invS);
  }

  function detachRiderFromDragon() {
    if (typeof playerAvatar === 'undefined' || !playerAvatar || !playerAvatar.g) return;
    if (playerAvatar.g.parent && playerAvatar.g.parent !== scene) {
      scene.add(playerAvatar.g);
      playerAvatar.g.scale.set(1, 1, 1);
      playerAvatar.g.rotation.set(0, 0, 0);
    }
  }

  function _getDragonStageLabel(m) {
    const pct = Math.max(0, Math.min(100, Math.round(m.growth || 0)));
    const stg = growthToDragonStage(pct);
    const stNames = [
      tr('Sơ Sinh', 'Hatchling'),
      tr('Rồng Nhỏ', 'Young Dragon'),
      tr('Chiến Đấu', 'Combat Ready'),
      tr('Thiếu Niên', 'Juvenile'),
      tr('Trưởng Thành', 'Adult')
    ];
    const mode = m.saddled ? tr('Đã Đeo Yên', 'Saddled') : (m.sitting ? tr('Đang Ngồi', 'Sitting') : tr('Đứng Yên / Bay Theo', 'Idle / Following'));
    let eqCnt = 0;
    if (m.dragonArmor) for (let i = 0; i < DRAGON_ARMOR_SLOTS.length; i++) if (m.dragonArmor[DRAGON_ARMOR_SLOTS[i]]) eqCnt++;
    return eqCnt > 0 ? `${stNames[stg]} • ${mode} • 🛡️${eqCnt}/4` : `${stNames[stg]} • ${mode}`;
  }

  function showDragonGrowthHud(m, holdSec = 3.5) {
    if (!m || !m.elemDragon) return;
    _activeGrowthDragon = m;
    _dragonGrowthUiTimer = Math.max(_dragonGrowthUiTimer, holdSec);
    if (!_elDgWrap) return;
    const pct = Math.max(0, Math.min(100, Math.round(m.growth || 0)));
    const baseName = (typeof getLocalizedMobName === 'function')
      ? getLocalizedMobName(m.type, m.displayName || 'Rồng Con')
      : (m.displayName || 'Rồng Con');
    if (_elDgName) _elDgName.textContent = baseName;
    if (_elDgPct) _elDgPct.textContent = `${pct}%`;
    if (_elDgFill) _elDgFill.style.width = `${pct}%`;
    if (_elDgStage) _elDgStage.textContent = _getDragonStageLabel(m);
    _elDgWrap.classList.add('visible');
  }

  function hatchTamedDragon(el, wx, wy, wz, saved = null) {
    const type = `${el}_dragon`;
    if (!MOB_STATS[type]) return null;
    const growth = saved && typeof saved.growth === 'number' ? Math.max(0, Math.min(100, saved.growth)) : 0;
    const stage = growthToDragonStage(growth);
    const saddled = !!(saved && saved.saddled && growth >= 100);
    const dragonArmor = (saved && saved.dragonArmor && typeof saved.dragonArmor === 'object') ? { ...saved.dragonArmor } : null;
    const gender = (saved && saved.gender) || (Math.random() < 0.5 ? 'M' : 'F');
    const m = spawnMobOfType(type, wx, wy, wz, { dragonStage: stage, saddled, tamed: true, dragonArmor, gender });
    if (!m) return null;
    m.tamed = true;
    m.hostile = false;
    m.neutral = false;
    m.isBoss = false;
    m.growth = growth;
    m.dragonStage = stage;
    m.saddled = saddled;
    m.dragonArmor = dragonArmor;
    m.gender = gender;
    m.sitting = !!(saved && saved.sitting);
    m.flying = false;
    m._landedIdle = true;
    m.elemDragon = el;
    rebuildDragonStageMesh(m);
    if (!saved) {
      spawnParticles(wx, wy + 0.6, wz, 0xfbbf24, 22, true);
      playSfx('roar');
      showDragonGrowthHud(m, 4.5);
      showToast(`🐣 Trứng nở thành ${m.displayName} (0%)! Cầm Tinh Thể Rồng bấm vào để nuôi lớn!`);
    }
    return m;
  }

  function tickIncubatingEggs(dt) {
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof isSimAuthority === 'function' && !isSimAuthority()) return;
    if (incubatingEggs.size <= 0) return;
    for (const [k, eg] of Array.from(incubatingEggs.entries())) {
      const curB = getBlockWorld(eg.x, eg.y, eg.z);
      if (curB !== eg.eggId) { incubatingEggs.delete(k); continue; }
      eg.timer -= dt;
      if (Math.random() < dt * 4.5) {
        const pal = (BLOCK_DEF[eg.eggId] && BLOCK_DEF[eg.eggId].eggPal) || { band: 0xf97316 };
        spawnParticles(eg.x + 0.5, eg.y + 0.65, eg.z + 0.5, pal.band || 0xf97316, 2, true);
      }
      if (eg.timer <= 0) {
        incubatingEggs.delete(k);
        setBlockWorld(eg.x, eg.y, eg.z, B.AIR, true);
        flushUrgentChunks(16);
        hatchTamedDragon(eg.el, eg.x + 0.5, eg.y + 0.15, eg.z + 0.5);
      }
    }
  }

  function findNearestSaddledDragon(maxD = 9.0) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const mb = mobs[i];
      if (!mb || mb._dead || !mb.tamed || !mb.elemDragon || !mb.saddled || (mb.growth || 0) < 100) continue;
      const effMax = maxD + Math.max(0, (mb.dragonScale || 1) - 1) * 3.0;
      const d = Math.hypot(mb.x - player.x, mb.y + Math.min(3.5, (mb.hitboxH || 1.6) * 0.35) - player.y, mb.z - player.z);
      if (d < effMax && d < bestD) { bestD = d; best = mb; }
    }
    return best;
  }

  function findNearestTamedDragon(maxD = 10.5) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const mb = mobs[i];
      if (!mb || mb._dead || !mb.tamed || !mb.elemDragon) continue;
      const effMax = maxD + Math.max(0, (mb.dragonScale || 1) - 1) * 3.0;
      const d = Math.hypot(mb.x - player.x, mb.y + Math.min(3.5, (mb.hitboxH || 1.6) * 0.35) - player.y, mb.z - player.z);
      if (d < effMax && d < bestD) { bestD = d; best = mb; }
    }
    return best;
  }

  function findNearestTamedPet(maxD = 9.0) {
    const drg = findNearestTamedDragon(Math.max(maxD, 10.5));
    if (drg) return drg;
    let best = null, bestD = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const mb = mobs[i];
      if (!mb || mb._dead || !mb.tamed || mb.elemDragon) continue;
      const d = Math.hypot(mb.x - player.x, mb.y + Math.min(1.5, (mb.hitboxH || 0.9) * 0.4) - player.y, mb.z - player.z);
      if (d < maxD && d < bestD) { bestD = d; best = mb; }
    }
    return best;
  }

  function mountDragon(m) {
    if (!m || m._dead || !m.tamed || !m.elemDragon || !m.saddled || (m.growth || 0) < 100) return false;
    player.ridingDragon = m;
    player.inBoat = false;
    player.flying = false;
    player.smoothMoveX = 0;
    player.smoothMoveZ = 0;
    player.vy = 0;
    m.sitting = false;
    const gSurf = _getDragonGroundSurfaceY(m.x, m.y + 2.0, m.z, m.dragonScale);
    m.flying = (m.y - gSurf) > 1.8;
    m._landedIdle = !m.flying;
    m._diveBoost = 0;
    m._drgDiving = false;
    m.vx = 0; m.vy = 0; m.vz = 0;
    m._bankRoll = 0; m._flyPitch = 0; m._roarT = 0.9;
    attachRiderToDragon(m);
    if (thirdPerson === 0) {
      player._preDragonThirdPerson = 0;
      thirdPerson = 1;
      playerAvatar.g.visible = true;
      heldPivot.visible = false;
      if (typeof offhandPivot !== 'undefined') offhandPivot.visible = false;
      applyArmorToPlayerRig(playerAvatar, player.equip, player.equipMeta);
    }
    const sw = getDragonSaddleWorldPos(m, _saddleWorldPos);
    player.x = sw.x; player.y = sw.y; player.z = sw.z;
    playSfx('roar');
    _dragonGrowthUiTimer = 0;
    _activeGrowthDragon = null;
    if (_elDgWrap) _elDgWrap.classList.remove('visible');
    _lastFlightElKey = '';
    updateDragonUiControls(0);
    if (typeof renderStatusBars === 'function') renderStatusBars();
    return true;
  }

  function dismountDragon() {
    const m = player.ridingDragon;
    player.ridingDragon = null;
    player.sitting = false;
    detachRiderFromDragon();
    if (player._preDragonThirdPerson !== undefined) {
      thirdPerson = player._preDragonThirdPerson;
      delete player._preDragonThirdPerson;
      playerAvatar.g.visible = (thirdPerson > 0);
      heldPivot.visible = (thirdPerson === 0 && !hudHidden);
      if (typeof offhandPivot !== 'undefined') offhandPivot.visible = (thirdPerson === 0 && !hudHidden && !!activeOffhandObj);
    }
    if (m && !m._dead) {
      m._diveBoost = 0; m._drgDiving = false; m._bankRoll = 0; m._flyPitch = 0;
      if (m.group) { m.group.rotation.z = 0; m.group.rotation.x = 0; }
      if (m.anim && m.anim.torso) m.anim.torso.rotation.x = 0;
      const dismOff = Math.max(1.8, (m.dragonScale || 1) * 1.1);
      player.x = m.x + Math.cos(player.yaw) * dismOff;
      player.z = m.z - Math.sin(player.yaw) * dismOff;
      const gy = colGroundY(Math.floor(player.x), Math.floor(player.z));
      if (m.y <= gy + 2.2) player.y = gy + 1.05;
      else player.y = m.y;
      player.vy = 0;
      player.fallStartY = player.y;
    }
    updateDragonUiControls(0);
    if (typeof renderStatusBars === 'function') renderStatusBars();
    playSfx('equip');
  }

  const DRAGON_SKILL_DEFS = {
    fire:  { vi: ['🔥 Phun Cầu Lửa', '[G] Mưa Thiên Thạch', '[V] Hỏa Bão Xung Kích', '[B] Siêu Tân Tinh'], en: ['🔥 Fireball', '[G] Meteor Shower', '[V] Blazing Dash', '[B] Supernova'], col: 0xf97316, kind: 'drg_fire' },
    ice:   { vi: ['❄️ Thương Băng Lớn', '[G] Bão Tuyết Hàn', '[V] Đóng Băng Nova', '[B] Sao Chổi Băng'], en: ['❄️ Ice Lance', '[G] Blizzard Volley', '[V] Glacial Nova', '[B] Frost Comets'], col: 0x38bdf8, kind: 'drg_ice' },
    water: { vi: ['🌊 Đại Bác Thủy Áp', '[G] Xoáy Nước Biển', '[V] Sóng Thần Hồi Máu', '[B] Đại Hồng Thủy'], en: ['🌊 Hydro Cannon', '[G] Tidal Vortex', '[V] Healing Surge', '[B] Deluge Tempest'], col: 0x22d3ee, kind: 'drg_water' },
    earth: { vi: ['🪨 Đá Tảng Khổng Lồ', '[G] Gai Đá Trồi Đất', '[V] Địa Chấn Nghiền', '[B] Mưa Đá Cổ Đại'], en: ['🪨 Giant Boulder', '[G] Earth Spikes', '[V] Seismic Slam', '[B] Boulder Rain'], col: 0xf59e0b, kind: 'drg_earth' },
    leaf:  { vi: ['🌿 Bão Phi Tiêu Lá', '[G] Mưa Bào Tử Độc', '[V] Lốc Xoáy Rừng', '[B] Vạn Hoa Bão'], en: ['🌿 Razor Leaves', '[G] Venom Spores', '[V] Forest Cyclone', '[B] Blossom Storm'], col: 0x4ade80, kind: 'drg_leaf' },
    tree:  { vi: ['🌳 Giáo Gỗ Cổ Thụ', '[G] Rễ Cây Trói Buộc', '[V] Hào Quang Thế Giới', '[B] Thịnh Nộ Rừng Già'], en: ['🌳 Timber Lance', '[G] World Roots', '[V] Elder Bloom Heal', '[B] Ancient Wrath'], col: 0xa3e635, kind: 'drg_tree' }
  };

  function castRiddenDragonSkill(skillIdx = 1) {
    const m = player.ridingDragon;
    if (!m || m._dead) return false;
    const el = m.elemDragon || 'fire';
    const def = DRAGON_SKILL_DEFS[el] || DRAGON_SKILL_DEFS.fire;
    const kind = def.kind, pCol = def.col;
    _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ');
    _rayDir.set(0, 0, -1).applyEuler(_rayEuler);
    const mp = getDragonMouthWorldPos(m, _mouthPos);

    if (skillIdx === 1) {
      if ((m.atkCd || 0) > 0) return false;
      m.atkCd = 0.60; m.atkAnimT = 0.45; m._roarT = 0.90; playSfx('roar');
      if (el === 'leaf') {
        for (let i = -2; i <= 2; i++) {
          const sp = i * 0.11;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, _rayDir.y, sz, 35.0, m.dmg * 0.85, kind, { friendlyDragon: true, ownerDragon: m, scale: 2.5, splashR: 4.5 });
        }
      } else if (el === 'earth') {
        fireEnergyOrb(mp.x, mp.y, mp.z, _rayDir.x, Math.min(0.65, _rayDir.y + 0.16), _rayDir.z, 26.0, m.dmg * 1.85, kind, { friendlyDragon: true, ownerDragon: m, scale: 3.6, splashR: 6.8, gravity: 13.0, effect: 'quake' });
      } else {
        const sp1 = (el === 'ice' || el === 'water') ? 37.0 : 31.0;
        const eff1 = el === 'ice' ? 'freeze' : (el === 'fire' ? 'fire' : (el === 'water' ? 'knock' : 'poison'));
        fireEnergyOrb(mp.x, mp.y, mp.z, _rayDir.x, _rayDir.y, _rayDir.z, sp1, m.dmg * 1.65, kind, { friendlyDragon: true, ownerDragon: m, scale: 3.2, splashR: 6.0, effect: eff1 });
      }
      spawnParticles(mp.x, mp.y, mp.z, pCol, 14, true);
      return true;
    }

    if (skillIdx === 2) {
      if ((m._sk2Cd || 0) > 0) return false;
      m._sk2Cd = 3.5; m.atkAnimT = 0.55; playSfx('roar');
      if (el === 'fire') {
        for (let i = -2; i <= 2; i++) {
          const sp = i * 0.14;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, Math.min(0.65, _rayDir.y + 0.18), sz, 27.0, m.dmg * 1.65, 'drg_fire_meteor', { friendlyDragon: true, ownerDragon: m, scale: 3.4, splashR: 6.4, gravity: 11.0, effect: 'fire' });
        }
      } else if (el === 'ice') {
        for (let i = 0; i < 6; i++) {
          const sp = (i - 2.5) * 0.12;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, _rayDir.y - 0.03 + (i & 1) * 0.05, sz, 32.0, m.dmg * 1.25, kind, { friendlyDragon: true, ownerDragon: m, scale: 2.9, splashR: 5.5, effect: 'freeze' });
        }
      } else if (el === 'water') {
        for (let i = -2; i <= 2; i++) {
          const sp = i * 0.13;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, _rayDir.y, sz, 28.0, m.dmg * 1.40, kind, { friendlyDragon: true, ownerDragon: m, scale: 3.3, splashR: 7.2, effect: 'vortex' });
        }
      } else if (el === 'earth' || el === 'tree') {
        const horiz = Math.hypot(_rayDir.x, _rayDir.z) || 1;
        const hx = _rayDir.x / horiz, hz = _rayDir.z / horiz;
        for (let k = 1; k <= 6; k++) {
          const rx = mp.x + hx * (k * 4.5), rz = mp.z + hz * (k * 4.5);
          const ry = colGroundY(Math.floor(rx), Math.floor(rz)) + 1.0;
          spawnPixelFx(el === 'earth' ? 'smoke_puff' : 'magic_poison', rx, ry + 1.2, rz, { count: 4, scale: 3.2, life: 0.65, spread: 1.4 });
          if (el === 'earth') _placeSafeDragonBlock(Math.floor(rx), Math.floor(ry), Math.floor(rz), B.STONE);
          else _placeSafeDragonBlock(Math.floor(rx), Math.floor(ry), Math.floor(rz), B.OAK_LOG);
          for (let mi = mobs.length - 1; mi >= 0; mi--) {
            const mb = mobs[mi];
            if (!mb || mb._dead || mb.tamed || mb === m) continue;
            if (Math.hypot(mb.x - rx, mb.z - rz) < 4.5 && Math.abs(mb.y - ry) < 6.0) {
              hurtMob(mb, m.dmg * 1.75, hx, hz, 10.5, false, false);
            }
          }
        }
        flushUrgentChunks(8);
        cameraShake = Math.max(cameraShake, 0.35);
      } else {
        for (let i = 0; i < 4; i++) {
          const sp = (i - 1.5) * 0.16;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, _rayDir.y, sz, 25.0, m.dmg * 1.50, 'drg_leaf_seed', { friendlyDragon: true, ownerDragon: m, scale: 3.4, splashR: 6.5, effect: 'poison' });
        }
      }
      spawnParticles(mp.x, mp.y, mp.z, pCol, 22, true);
      return true;
    }

    if (skillIdx === 3) {
      if ((m._sk3Cd || 0) > 0) return false;
      m._sk3Cd = 5.0; m.atkAnimT = 0.55; playSfx('roar'); cameraShake = Math.max(cameraShake, 0.36);
      if (el === 'fire' || el === 'water' || el === 'leaf') {
        player.smoothMoveX = _rayDir.x * 34.0; player.smoothMoveZ = _rayDir.z * 34.0; player.vy = _rayDir.y * 24.0 + 4.5;
      }
      if (el === 'water' || el === 'tree') {
        const healAmt = Math.round(m.maxHp * (el === 'tree' ? 0.22 : 0.12));
        m.hp = Math.min(m.maxHp, m.hp + healAmt);
        if (!player.dead) player.hp = Math.min(player.maxHp, player.hp + (el === 'tree' ? 6 : 4));
        if (el === 'water') player.burnTime = 0;
        if (typeof renderStatusBars === 'function') renderStatusBars();
      }
      const novaR = el === 'earth' ? 18.0 : 15.5;
      const fxK = el === 'ice' ? 'ice_shatter' : (el === 'fire' ? 'explosion_fire' : (el === 'water' ? 'water_splash' : (el === 'earth' ? 'smoke_puff' : 'magic_poison')));
      spawnPixelFx(fxK, m.x, m.y + 1.4, m.z, { count: 6, scale: 4.2, life: 0.65, spread: 3.8 });
      for (let mi = mobs.length - 1; mi >= 0; mi--) {
        const mb = mobs[mi];
        if (!mb || mb._dead || mb === m || mb.tamed) continue;
        const d = Math.hypot(mb.x - m.x, mb.y - m.y, mb.z - m.z);
        if (d < novaR) {
          hurtMob(mb, m.dmg * 1.95, el === 'leaf' ? (m.x - mb.x) : (mb.x - m.x), el === 'leaf' ? (m.z - mb.z) : (mb.z - m.z), el === 'earth' ? 12.0 : 8.5, el === 'fire', false);
          if (el === 'ice') mb._chilledT = 5.0;
        }
      }
      spawnParticles(m.x, m.y + 1.2, m.z, pCol, 32, true);
      return true;
    }

    if (skillIdx === 4) {
      if ((m._sk4Cd || 0) > 0) return false;
      m._sk4Cd = 8.5; m.atkAnimT = 0.70; playSfx('roar'); cameraShake = Math.max(cameraShake, 0.48);
      if (el === 'ice') {
        for (let k = -1; k <= 1; k++) {
          const sp = k * 0.22;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, _rayDir.y - 0.04, sz, 30.0, m.dmg * 2.40, kind, { friendlyDragon: true, ownerDragon: m, scale: 4.2, splashR: 8.5, effect: 'freeze' });
        }
      } else if (el === 'earth' || el === 'tree') {
        const cnt = el === 'earth' ? 7 : 8;
        const kBomb = el === 'earth' ? 'drg_earth' : 'drg_tree_root';
        for (let k = 0; k < cnt; k++) {
          const sp = (k - (cnt - 1) * 0.5) * 0.17;
          const sx = _rayDir.x * Math.cos(sp) - _rayDir.z * Math.sin(sp);
          const sz = _rayDir.x * Math.sin(sp) + _rayDir.z * Math.cos(sp);
          fireEnergyOrb(mp.x, mp.y, mp.z, sx, Math.min(0.68, _rayDir.y + 0.22), sz, 25.0 + (k & 1) * 3, m.dmg * 1.95, kBomb, { friendlyDragon: true, ownerDragon: m, scale: 3.6, splashR: 7.5, gravity: 11.5, effect: el === 'earth' ? 'quake' : 'poison' });
        }
      } else {
        const cnt = (el === 'fire' || el === 'leaf') ? 12 : 10;
        for (let k = 0; k < cnt; k++) {
          const a = (k / cnt) * Math.PI * 2;
          fireEnergyOrb(mp.x, mp.y, mp.z, Math.cos(a), -0.10 + (k & 1) * 0.08, Math.sin(a), 27.0, m.dmg * 2.15, kind, { friendlyDragon: true, ownerDragon: m, scale: 3.4, splashR: 6.8, effect: el === 'water' ? 'vortex' : (el === 'fire' ? 'fire' : 'poison') });
        }
      }
      spawnParticles(m.x, m.y + 1.2, m.z, pCol, 38, true);
      return true;
    }
    return false;
  }
  function fireRiddenDragonBreath() { return castRiddenDragonSkill(1); }

  function feedOrInteractTamedDragon(m, slot, selDef, toggleSit = true, mountIfSaddled = true) {
    if (!m || m._dead || !m.tamed || !m.elemDragon) return false;
    if (slot && slot.id === B.DRAGON_CRYSTAL) {
      if ((m.growth || 0) >= 100) {
        m.hp = m.maxHp;
        spawnParticles(m.x, m.y + 1.2, m.z, 0x4ade80, 14, true);
        playSfx('eat');
        showDragonGrowthHud(m, 3.5);
        showToast(`🐉 ${m.displayName} đã trưởng thành 100% và hồi đầy máu!`);
        return true;
      }
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
      const prevStage = m.dragonStage || 0;
      m.growth = Math.min(100, (m.growth || 0) + 10);
      const nextStage = growthToDragonStage(m.growth);
      spawnParticles(m.x, m.y + 0.9, m.z, 0xfbbf24, 16, true);
      playSfx('eat');
      rebuildDragonStageMesh(m);
      showDragonGrowthHud(m, 4.2);
      if (nextStage > prevStage) {
        playSfx('roar');
        if (m.growth >= 100) showToast(`🎉 ${m.displayName} đạt 100% TRƯỞNG THÀNH! Hãy chế Yên Cưỡi Rồng để bay cùng nó!`);
        else if (nextStage === 2) showToast(`⚔️ ${m.displayName} đạt 50%! Đã mở khóa chiến đấu bảo vệ chủ nhân!`);
        else showToast(`✨ ${m.displayName} tiến hóa lên ${m.growth}%!`);
      } else {
        showToast(`💎 Đã cho ăn Tinh Thể Rồng (+10% → ${m.growth}%)!`);
      }
      return true;
    }
    if (slot && selDef && selDef.dragonArmorSlot) {
      const aSlot = selDef.dragonArmorSlot;
      const aTier = selDef.dragonArmorTier || 'iron';
      if (!m.dragonArmor || typeof m.dragonArmor !== 'object') m.dragonArmor = {};
      const prevTier = m.dragonArmor[aSlot];
      if (prevTier === aTier) {
        showDragonGrowthHud(m, 3.5);
        showToast(`🛡️ ${m.displayName} đã mặc ${selDef.name} rồi!`);
        return true;
      }
      if (gameMode !== 'creative') {
        slot.count--; if (slot.count <= 0) slot.id = 0;
        if (prevTier) {
          const prevId = B[`DRAGON_ARMOR_${prevTier.toUpperCase()}_${aSlot.toUpperCase()}`];
          if (prevId) addItemToInventory(prevId, 1);
        }
        renderHotbar();
      }
      m.dragonArmor[aSlot] = aTier;
      _applyDragonArmorToAnim(m.anim, m.dragonArmor, !!m.saddled);
      spawnParticles(m.x, m.y + 1.2 * (m.dragonScale || 1), m.z, 0x38bdf8, 16, true);
      playSfx('equip');
      showDragonGrowthHud(m, 4.0);
      showToast(`🛡️ Đã trang bị ${selDef.name} cho ${m.displayName}!`);
      return true;
    }
    if (slot && slot.id === B.DRAGON_SADDLE) {
      if ((m.growth || 0) < 100) {
        showDragonGrowthHud(m, 3.5);
        showToast(`🔒 Rồng mới đạt ${Math.round(m.growth || 0)}% — Cần 100% mới trang bị được Yên Cưỡi Rồng!`);
        return true;
      }
      if (m.saddled) { showToast(`🐉 ${m.displayName} đã có Yên Cưỡi! Hãy bấm nút Cưỡi Rồng!`); return true; }
      if (gameMode !== 'creative') { slot.count--; if (slot.count <= 0) slot.id = 0; renderHotbar(); }
      m.saddled = true;
      _applyDragonArmorToAnim(m.anim, m.dragonArmor, true);
      rebuildDragonStageMesh(m);
      spawnParticles(m.x, m.y + 1.5, m.z, 0x22d3ee, 18, true);
      playSfx('equip');
      showDragonGrowthHud(m, 3.5);
      showToast(`✨ Đã trang bị Yên Cưỡi cho ${m.displayName}! Nhấn Cưỡi Rồng (R) để bay!`);
      return true;
    }
    if (mountIfSaddled && m.saddled && (m.growth || 0) >= 100 && !(typeof player !== 'undefined' && player.sneaking)) {
      return mountDragon(m);
    }
    if (!toggleSit) return false;
    m.sitting = !m.sitting;
    m.flying = false;
    m._landedIdle = true;
    if (m.sitting) {
      m.vx = 0; m.vy = 0; m.vz = 0; m.flyVx = 0; m.flyVy = 0; m.flyVz = 0;
      const gSit = _getDragonGroundSurfaceY(m.x, m.y + 3.0, m.z, m.dragonScale);
      if (m.y < gSit) m.y = gSit;
    }
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof broadcastMobAction === 'function' && m.uid) {
      broadcastMobAction(m.uid, 'sit', { sitting: m.sitting });
    }
    spawnParticles(m.x, m.y + 0.9, m.z, m.sitting ? 0x38bdf8 : 0x4ade80, 12, true);
    playSfx('equip');
    showDragonGrowthHud(m, 3.2);
    showToast(m.sitting ? `🐉 ${m.displayName} đang ngồi nghỉ tại chỗ.` : `🐉 ${m.displayName} đang đi theo bảo vệ bạn!`);
    return true;
  }

  function updateDragonUiControls(dt) {
    if (_playerCombatTargetT > 0) {
      _playerCombatTargetT = Math.max(0, _playerCombatTargetT - dt);
      if (_playerCombatTargetT <= 0 || !_playerCombatTarget || _playerCombatTarget._dead) _playerCombatTarget = null;
    }
    const riding = !!(isPlaying && !player.dead && player.ridingDragon && !player.ridingDragon._dead);
    const rideEl = riding ? (player.ridingDragon.elemDragon || 'fire') : '';
    const langNow = typeof currentLang === 'string' ? currentLang : 'vi';
    const flightKey = `${langNow}|${rideEl}`;
    if (flightKey !== _lastFlightElKey) {
      _lastFlightElKey = flightKey;
      const skSet = (DRAGON_SKILL_DEFS[rideEl] || DRAGON_SKILL_DEFS.fire)[langNow === 'en' ? 'en' : 'vi'];
      if (_elDrgBreath) _elDrgBreath.textContent = skSet[0];
      if (_elDrgSk2) _elDrgSk2.textContent = skSet[1];
      if (_elDrgSk3) _elDrgSk3.textContent = skSet[2];
      if (_elDrgSk4) _elDrgSk4.textContent = skSet[3];
      if (_elDrgExit) _elDrgExit.textContent = tr('Xuống (R)', 'Dismount (R)');
      if (_elDragonEquip) _elDragonEquip.textContent = tr('🛡️ Trang Bị Rồng', '🛡️ Dragon Gear');
    }
    if (_elDragonFlight && (riding !== _lastFlightHudVis || _elDragonFlight.classList.contains('visible') !== riding)) {
      _lastFlightHudVis = riding;
      _elDragonFlight.classList.toggle('visible', riding);
    }
    const nearSaddled = (!riding && isPlaying && !player.dead) ? findNearestSaddledDragon(9.0) : null;
    const nearTamed = (!riding && isPlaying && !player.dead) ? findNearestTamedPet(9.0) : null;
    const wantMountBtn = !!nearSaddled;
    const wantEquipBtn = !!nearTamed;
    if (_elDragonMount && (wantMountBtn !== _lastMountBtnVis || _elDragonMount.classList.contains('visible') !== wantMountBtn)) {
      _lastMountBtnVis = wantMountBtn;
      _elDragonMount.classList.toggle('visible', wantMountBtn);
    }
    if (_elDragonEquip && (wantEquipBtn !== _lastEquipBtnVis || _elDragonEquip.classList.contains('visible') !== wantEquipBtn)) {
      _lastEquipBtnVis = wantEquipBtn;
      _elDragonEquip.classList.toggle('visible', wantEquipBtn);
    }
    if (_elDragonMount && nearSaddled) {
      const locName = (typeof getLocalizedMobName === 'function')
        ? getLocalizedMobName(nearSaddled.type, nearSaddled.displayName)
        : nearSaddled.displayName;
      const nxtTxt = tr(`Cưỡi ${locName} (R)`, `Mount ${locName} (R)`);
      if (nxtTxt !== _lastMountBtnTxt) {
        _lastMountBtnTxt = nxtTxt;
        _elDragonMount.textContent = nxtTxt;
      }
      _elDragonMount._targetDragon = nearSaddled;
    }
    if (_elDragonEquip && nearTamed) {
      const wantEqLbl = nearTamed.elemDragon ? tr('🛡️ Trang Bị Rồng', '🛡️ Dragon Gear') : tr('🐾 Thông Tin Pet', '🐾 Pet Info');
      if (_elDragonEquip.textContent !== wantEqLbl) _elDragonEquip.textContent = wantEqLbl;
      _elDragonEquip._targetDragon = nearTamed;
    }
    if (_dragonGrowthUiTimer > 0) {
      _dragonGrowthUiTimer = Math.max(0, _dragonGrowthUiTimer - dt);
      if (_dragonGrowthUiTimer <= 0 || !_activeGrowthDragon || _activeGrowthDragon._dead) {
        if (_elDgWrap) _elDgWrap.classList.remove('visible');
        _activeGrowthDragon = null;
      }
    }
  }
  {
    const mBtn = document.getElementById('btnDragonMount');
    if (mBtn) {
      mBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); mountDragon(mBtn._targetDragon || findNearestSaddledDragon(9.0)); }, { passive: false });
      mBtn.addEventListener('click', (e) => { e.stopPropagation(); mountDragon(mBtn._targetDragon || findNearestSaddledDragon(9.0)); });
    }
    const eqBtn = document.getElementById('btnDragonEquip');
    if (eqBtn) {
      const doOpenEq = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const tgt = eqBtn._targetDragon || findNearestTamedPet(9.0);
        if (tgt && typeof openDragonModal === 'function') openDragonModal(tgt);
      };
      eqBtn.addEventListener('touchstart', doOpenEq, { passive: false });
      eqBtn.addEventListener('click', doOpenEq);
    }
    const bBr = document.getElementById('btnDragonBreath');
    if (bBr) {
      bBr.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); castRiddenDragonSkill(1); }, { passive: false });
      bBr.addEventListener('click', (e) => { e.stopPropagation(); castRiddenDragonSkill(1); });
    }
    const bindSkillBtn = (id, sk) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); castRiddenDragonSkill(sk); }, { passive: false });
      el.addEventListener('click', (e) => { e.stopPropagation(); castRiddenDragonSkill(sk); });
    };
    bindSkillBtn('btnDragonSk2', 2); bindSkillBtn('btnDragonSk3', 3); bindSkillBtn('btnDragonSk4', 4);
    const bEx = document.getElementById('btnDragonExit');
    if (bEx) {
      bEx.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); dismountDragon(); }, { passive: false });
      bEx.addEventListener('click', (e) => { e.stopPropagation(); dismountDragon(); });
    }
  }

  function mobFitsAt(x, y, z, r = 0.35, h = 1.6) {
    const rad = Math.min(0.42, r * 0.72);
    const y0 = Math.floor(y + 0.05), y1 = Math.floor(y + Math.max(0.65, h - 0.12));
    const xs = [Math.floor(x - rad), Math.floor(x + rad)];
    const zs = [Math.floor(z - rad), Math.floor(z + rad)];
    for (let by = y0; by <= y1; by++) {
      for (let xi = 0; xi < 2; xi++) for (let zi = 0; zi < 2; zi++) {
        const b = getBlockWorld(xs[xi], by, zs[zi]);
        const sl = IS_SLAB[b];
        if (sl === 1) { if (y < by + 0.5 - 0.02 && y + h > by + 0.02) return false; }
        else if (sl === 2) { if (y < by + 1.0 - 0.02 && y + h > by + 0.5 + 0.02) return false; }
        else if (IS_FENCE_WALL[b] === 1) {
          if (aabbHitsFenceOrWall(x - r, y + 0.02, z - r, x + r, y + h - 0.02, z + r, xs[xi], by, zs[zi], b)) return false;
        } else if (isSolidAt(xs[xi], by, zs[zi])) return false;
      }
    }
    return true;
  }

  // Authentic Minecraft Light-Level Evaluator (0..15): Sky Light (Sun) + Block Emitters (Torches/Lanterns/Lava/Campfires prevent hostile spawns!)
  function getLightLevelAt(wx, wy, wz) {
    let skyL = 0;
    if (currentDimension === 'overworld' && depthOffset === 0 && isExposedToSky(wx, wy, wz)) {
      const sunY = envUniforms.uSunDir.value.y;
      skyL = sunY > 0.14 ? 15 : (sunY > 0.02 ? 10 : (sunY > -0.06 ? 6 : 3));
      if (rainIntensity > 0.45) skyL = Math.max(0, skyL - 3);
    }
    let blkL = 0;
    const pcx = wx >> 4, pcz = wz >> 4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ch = chunks.get(chunkKey(pcx + dx, pcz + dz));
      if (!ch || !ch.lightNodes) continue;
      for (let i = 0; i < ch.lightNodes.length; i++) {
        const ln = ch.lightNodes[i];
        const d = Math.abs(wx + 0.5 - ln.x) + Math.abs(wy + 0.5 - ln.y) + Math.abs(wz + 0.5 - ln.z);
        const srcL = ln.lvl || 14;
        if (d < srcL) blkL = Math.max(blkL, Math.round(srcL - d));
      }
    }
    return Math.max(skyL, blkL);
  }

  function spawnMobNearPlayer() {
    if (activeRoomId && typeof isSimAuthority === 'function' && !isSimAuthority()) return;
    const coopTrim = Math.min(6, (typeof remotePlayers !== 'undefined' ? remotePlayers.size : 0) * 2);
    const isSiftDim = (currentDimension === 'sift');
    const maxCap = Math.max(8, (isSiftDim ? (_isWeakDevice ? 18 : 28) : (_isWeakDevice ? 12 : 18)) - coopTrim);
    if (mobs.length >= maxCap) return;
    let hostileCnt = 0, passiveCnt = 0, aquaCnt = 0, skyCnt = 0, hasBoss = false;
    for (let mi = 0; mi < mobs.length; mi++) {
      const mb = mobs[mi];
      if (!mb || mb._dead) continue;
      if (mb.isBoss) hasBoss = true;
      if (mb.aqua) aquaCnt++;
      if (mb.skyBird || mb.flying) skyCnt++;
      if (mb.hostile) hostileCnt++;
      else if (!mb.tamed && !mb.villager) passiveCnt++;
    }
    const hostileCap = isSiftDim ? (_isWeakDevice ? 7 : 11) : (_isWeakDevice ? 5 : 8);
    const passiveCap = isSiftDim ? (_isWeakDevice ? 11 : 17) : (_isWeakDevice ? 5 : 8);
    const aquaCap = _isWeakDevice ? 3 : 5;
    const skyCap = isSiftDim ? (_isWeakDevice ? 4 : 7) : (_isWeakDevice ? 2 : 4);

    // === v188 THE SIFT HIGH-DENSITY BIOME + FLOATING-ISLAND + STRUCTURE MOB SPAWNER (fixes post-teleport empty spawns!) ===
    if (isSiftDim) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 24;
        const wx = Math.floor(player.x + Math.cos(angle) * dist), wz = Math.floor(player.z + Math.sin(angle) * dist);
        if (!chunks.has(chunkKey(wx >> 4, wz >> 4))) continue;
        const biome = getBiomeAt(wx, wz);
        // Scan actual solid blocks top-down (supports ground, hills, burrows, structures AND floating islands!)
        const scanHigh = Math.min(MAX_Y - 3, Math.max(Math.floor(player.y) + 26, 72));
        const scanLow = Math.max(MIN_Y + 4, Math.floor(player.y) - 18);
        let sy = -999, hitWater = false;
        for (let y = scanHigh; y >= scanLow; y--) {
          const bAt = getBlockWorld(wx, y, wz);
          if (bAt === B.AIR) continue;
          if (bAt === B.WATER) { hitWater = true; break; }
          if (bAt === B.LAVA) break;
          if (IS_SOLID[bAt] === 1) {
            const dFloor = BLOCK_DEF[bAt];
            if (dFloor && !dFloor.foliage && !dFloor.isLog && getBlockWorld(wx, y + 1, wz) === B.AIR && getBlockWorld(wx, y + 2, wz) === B.AIR) {
              sy = y; break;
            }
          }
        }
        if (hitWater) {
          if (skyCnt < skyCap && Math.random() < 0.60) {
            spawnMobOfType(Math.random() < 0.7 ? 'ichor_ray' : 'sky_manta', wx + 0.5, WATER_LEVEL + 2.4, wz + 0.5);
            return;
          }
          continue;
        }
        if (sy < MIN_Y + 4) continue;
        const onFloatingIsland = (sy >= 36);
        let pool;
        if (onFloatingIsland) {
          pool = ['echo_golem', 'harmonizer', 'sky_manta', 'nightmare_stalker', 'singer'];
        } else if (biome === BIOMES.SIFT_MEADOW) {
          // Singer's Meadow pink plains: abundant small cute blue Blub creatures! (Ref 2/8)
          pool = ['blub', 'blub', 'blub', 'blub', 'wobble', 'trill', 'nuzzle'];
        } else if (biome === BIOMES.SIFT_HUSKLAND) {
          pool = ['humbler', 'humbler', 'humbler', 'echo_golem', 'trill', 'ichor_ray'];
        } else if (biome === BIOMES.SIFT_SPOREFIELDS) {
          pool = ['roamroot', 'roamroot', 'roamroot', 'harmonizer', 'echo_golem', 'blub'];
        } else if (biome === BIOMES.SIFT_LULLABY || biome === BIOMES.SIFT_LULLABY_TOP) {
          const isNight = envUniforms.uSunDir.value.y < 0.02;
          pool = isNight ? ['nightmare_stalker', 'harmonizer', 'nuzzle', 'blub', 'wobble'] : ['nuzzle', 'blub', 'wobble', 'trill', 'sky_manta'];
        } else if (biome === BIOMES.SIFT_ICHOR_PONDS) {
          pool = ['humbler', 'humbler', 'harmonizer', 'nightmare_stalker', 'blub'];
        } else {
          // Central The Sift canyon
          pool = ['echo_golem', 'singer', 'blub', 'wobble', 'harmonizer', 'sky_manta', 'roamroot'];
        }
        const nearStruct = (typeof getSiftGroundStructureForChunk === 'function') ? getSiftGroundStructureForChunk(wx >> 4, wz >> 4) : null;
        const wantMiniBoss = (!hasBoss && !isMobDefeatedTag('sift:boss:dream_warden') && (onFloatingIsland || (nearStruct && (nearStruct.kind === 'castle' || nearStruct.kind === 'den'))) && Math.random() < 0.14);
        const pick = wantMiniBoss ? 'dream_warden' : pool[(Math.random() * pool.length) | 0];
        const stM = MOB_STATS[pick];
        if (!stM) continue;
        if ((stM.skyBird || stM.flying) && skyCnt >= skyCap) continue;
        if (stM.hostile && hostileCnt >= hostileCap) continue;
        if (!stM.hostile && passiveCnt >= passiveCap) continue;
        spawnMobOfType(pick, wx + 0.5, sy + 1.15, wz + 0.5);
        return;
      }
      return;
    }

    const angle = Math.random() * Math.PI * 2, dist = 14 + Math.random() * 18;
    const wx = Math.floor(player.x + Math.cos(angle) * dist), wz = Math.floor(player.z + Math.sin(angle) * dist);
    if (!chunks.has(chunkKey(wx >> 4, wz >> 4))) return;
    const biome = getBiomeAt(wx, wz);

    // Aquatic Fish & Marine Life Spawner (rivers, lakes, shorelines & 700m deep ocean strata!)
    if (currentDimension === 'overworld') {
      const pFloorY = Math.floor(player.y);
      const inDeepAqua = (depthOffset > 0 || player.eyesInWater) && getBlockWorld(wx, pFloorY, wz) === B.WATER && getBlockWorld(wx, pFloorY - 1, wz) === B.WATER;
      const inSurfAqua = getBlockWorld(wx, WATER_LEVEL, wz) === B.WATER && getBlockWorld(wx, WATER_LEVEL - 1, wz) === B.WATER;
      if (inDeepAqua || inSurfAqua) {
        if (aquaCnt < aquaCap && Math.random() < 0.55) {
          let floorY = MIN_Y + 2;
          const startScan = inDeepAqua ? pFloorY : WATER_LEVEL - 1;
          for (let y = startScan; y >= MIN_Y + 4; y--) {
            if (isSolidAt(wx, y, wz)) { floorY = y + 1; break; }
          }
          const swimY = inDeepAqua
            ? Math.max(floorY + 1.2, Math.min(MAX_Y - 2, player.y + (Math.random() - 0.5) * 10.0))
            : Math.min(WATER_LEVEL - 0.85, floorY + 1.0 + Math.random() * Math.max(0.5, WATER_LEVEL - floorY - 2.0));
          const trueSwimY = swimY - (depthOffset || 0);
          const rAq = Math.random();
          const fishType = (trueSwimY < -14 && rAq < 0.20 && getDifficultyCfg().hostileSpawn)
            ? 'ocean_barnacle'
            : (trueSwimY < -120 && rAq < 0.65)
              ? (rAq < 0.25 ? 'glow_squid' : (rAq < 0.45 ? 'anglerfish' : 'whale_blue'))
              : (trueSwimY < -18 && rAq < 0.48)
                ? (rAq < 0.22 ? 'anglerfish' : (rAq < 0.35 ? 'glow_squid' : 'whale_blue'))
                : (rAq < 0.14 ? 'pink_dolphin' : (rAq < 0.28 ? 'squid' : (rAq < 0.44 ? 'tropical_fish' : pickBiomeAnimal(biome, true))));
          spawnMobOfType(fishType, wx + 0.5, swimY, wz + 0.5);
          return;
        }
      }
    }

    // Minecraft Rule: Mobs & Monsters NEVER spawn inside OR underneath Lava (single-pass downward column scan!)
    const scanTop = Math.min(MAX_Y - 2, Math.floor(player.y) + 28);
    const tryMaxY = Math.min(MAX_Y - 2, Math.floor(player.y) + 12);
    const tryMinY = Math.max(MIN_Y + 2, Math.floor(player.y) - 12);
    let lavaAbove = false, spawnY = -999;
    for (let y = scanTop; y >= tryMinY; y--) {
      const bFloor = getBlockWorld(wx, y, wz);
      if (bFloor === B.LAVA) { lavaAbove = true; continue; }
      if (y <= tryMaxY && !lavaAbove && IS_SOLID[bFloor] === 1) {
        const fDef = BLOCK_DEF[bFloor];
        if (fDef && !fDef.foliage && !fDef.isLog && !fDef.cactus && getBlockWorld(wx, y + 1, wz) !== B.LAVA && getBlockWorld(wx, y + 2, wz) !== B.LAVA && mobFitsAt(wx + 0.5, y + 1, wz + 0.5, 0.42, 1.85)) {
          spawnY = y + 1; break;
        }
      }
    }
    if (spawnY < MIN_Y + 3) return;
    const r = Math.random();
    let type;
    if (currentDimension === 'nether') {
      if (hostileCnt >= hostileCap && r > 0.14) return;
      if (biome === BIOMES.NETHER_BASALT_DELTAS) {
        if (r < 0.34) type = 'magma_cube';
        else if (r < 0.56) type = 'strider';
        else if (r < 0.72) type = 'piglin_brute';
        else if (r < 0.86) { type = 'blaze'; spawnY += 3.0; }
        else if (r < 0.94) { type = 'ghast'; spawnY += 8.0; }
        else type = hasBoss ? 'wither_skeleton' : 'magma_golem';
      } else if (biome === BIOMES.NETHER_SOUL_VALLEY) {
        if (r < 0.34) type = 'wither_skeleton';
        else if (r < 0.56) { type = 'soul_wisp'; spawnY += 3.0; }
        else if (r < 0.74) type = 'skeleton';
        else if (r < 0.90) { type = 'ghast'; spawnY += 8.0; }
        else type = 'strider';
      } else {
        if (r < 0.14) type = 'hoglin';
        else if (r < 0.28) type = 'zoglin';
        else if (r < 0.40) type = 'piglin';
        else if (r < 0.50) type = 'piglin_brute';
        else if (r < 0.62) type = 'magma_cube';
        else if (r < 0.72) type = 'strider';
        else if (r < 0.80) { type = 'soul_wisp'; spawnY += 3.5; }
        else if (r < 0.88) { type = 'blaze'; spawnY += 3.5; }
        else if (r < 0.90) { type = 'ghast'; spawnY += 8.5; }
        else if (r < 0.95) { type = hasBoss ? 'blaze' : 'wildfire'; spawnY += 3.5; }
        else type = hasBoss ? 'wither_skeleton' : (Math.random() < 0.5 ? 'redstone_monstrosity' : 'magma_golem');
      }
    } else if (currentDimension === 'end') {
      if (hostileCnt >= hostileCap) return;
      const isOuterEnd = Math.hypot(wx, wz) >= 180;
      if (isOuterEnd) {
        if (r < 0.45) type = 'shulker';
        else if (r < 0.78) type = 'void_stalker';
        else { type = 'end_phantom'; spawnY += 6.0; }
      } else {
        if (r < 0.30) type = 'void_stalker';
        else if (r < 0.48) type = 'shulker';
        else if (r < 0.64) type = 'endermite';
        else if (r < 0.78) type = 'chorus_crawler';
        else if (r < 0.90) type = 'void_golem';
        else { type = 'end_phantom'; spawnY += 6.0; }
      }
    } else if (currentDimension === 'warden') {
      if (hostileCnt >= hostileCap) return;
      if (!hasBoss && !isMobDefeatedTag('warden:sculk_soul_ravager') && !isMobDefeatedTag('warden:boss:sculk_soul_ravager') && r > 0.90) type = 'sculk_soul_ravager';
      else if (r < 0.36) type = 'sculk_stalker';
      else if (r < 0.70) type = 'sculk_sentinel';
      else type = 'sculk_brute';
    } else if (currentDimension === 'dragon_realm') {
      if (hostileCnt >= hostileCap) return;
      const nearDStruct = (typeof getDragonStructureForChunk === 'function') ? getDragonStructureForChunk(wx >> 4, wz >> 4) : null;
      const wildEndDrgCnt = mobs.filter(mb => mb && !mb._dead && !mb.tamed && _END_FIERCE_DRAGONS.has(mb.type)).length;
      if (wildEndDrgCnt < 4 && (r > 0.72 || (nearDStruct && nearDStruct.kind === 'nest' && r > 0.45))) {
        const pool = ['void_end_dragon', 'amethyst_end_dragon', 'storm_end_dragon', 'abyss_end_dragon'];
        type = pool[Math.floor(Math.random() * pool.length)];
        spawnY = _getSafeDragonSkyY(wx + 0.5, wz + 0.5, 16);
      } else if (nearDStruct && (nearDStruct.kind === 'vault' || nearDStruct.kind === 'altar')) {
        type = r < 0.55 ? 'void_golem' : 'shulker';
      } else if (r < 0.38) type = 'void_stalker';
      else if (r < 0.64) type = 'shulker';
      else if (r < 0.84) type = 'void_golem';
      else { type = 'end_phantom'; spawnY += 6.0; }
    } else if (biome === BIOMES.GRAND_RUINS) {
      // High-difficulty 1000m Underground End Portal Ruins: dense dangerous guardian monsters + patrolling Iron Golems!
      const dC = Math.hypot(wx - GRAND_RUINS_CX, wz - GRAND_RUINS_CZ);
      if (dC < 10) return;
      if (hostileCnt >= hostileCap + 8) return;
      if (r < 0.24) type = 'ruin_stalker';
      else if (r < 0.42) type = 'wither_skeleton';
      else if (r < 0.56) type = 'skeleton';
      else if (r < 0.68) type = 'void_stalker';
      else if (r < 0.78) type = 'vindicator';
      else if (r < 0.86) { type = 'gargoyle'; spawnY += 4.5; }
      else if (r < 0.92) type = 'pillager_raider';
      else if (r < 0.96) type = 'endermite';
      else type = 'iron_golem';
    } else if (biome === BIOMES.ABANDONED_CITY) {
      if (hostileCnt >= hostileCap) return;
      if (r < 0.40) type = 'ruin_stalker';
      else if (r < 0.64) { type = 'gargoyle'; spawnY += 6.5; }
      else if (r < 0.74) type = 'pillager';
      else if (r < 0.82) type = 'pillager_raider';
      else if (r < 0.90) type = 'vindicator';
      else type = 'ravager';
    } else {
      const spawnTrueY = spawnY - (depthOffset || 0);
      if (currentDimension === 'overworld' && getUndergroundBiomeAt(wx, spawnTrueY, wz) === UNDERGROUND_BIOMES.DEEP_DARK) return;
      const lightLvl = getLightLevelAt(wx, spawnY, wz);
      const isDark = (lightLvl <= 7);
      const isUnder = spawnY < -4;
      const inLushCave = isUnder && (getBlockWorld(wx, spawnY - 1, wz) === B.MOSS_BLOCK);
      if (inLushCave && r < 0.62) {
        if (passiveCnt >= passiveCap) return;
        type = r < 0.28 ? 'axolotl' : (r < 0.45 ? 'allay' : (r < 0.55 ? 'moss_golem' : 'glare_mob'));
        if (type === 'allay' || type === 'glare_mob') spawnY += 1.5;
      } else if (isDark) {
        // Balanced Minecraft Rule: Hostile Monsters ONLY spawn in darkness (Light Level <= 7) within balanced local cap!
        if (hostileCnt >= hostileCap) return;
        if (!hasBoss && (isUnder || r > 0.93)) {
          if (isUnder) type = r < 0.48 ? 'mini_abomination' : 'redstone_monstrosity';
          else if (biome === BIOMES.DEEP_OCEAN || biome === BIOMES.BEACH_PALM || biome === BIOMES.MANGROVE_SWAMP) type = 'abyssal_colossus';
          else if (biome === BIOMES.VOLCANIC || biome === BIOMES.CRIMSON_HIGHLAND) type = 'redstone_monstrosity';
          else type = Math.random() < 0.55 ? 'prismarine_colossus' : 'magma_golem';
        }
        else if ((biome === BIOMES.SULFUR_SPRINGS || (isUnder && getUndergroundBiomeAt(wx, Math.floor(spawnY - depthOffset), wz) === UNDERGROUND_BIOMES.SULFUR_CAVE)) && r < 0.68) type = 'sulfur_slime';
        else if (isUnder && r < 0.14) type = 'rascal';
        else if (!isUnder && r < 0.08 && skyCnt < skyCap) { type = 'phantom_drake'; spawnY += 7; }
        else if (biome === BIOMES.DESERT && r < 0.36) type = Math.random() < 0.5 ? 'husk' : 'desert_skeleton';
        else if ((biome === BIOMES.SNOW || biome === BIOMES.SNOWY_PLAINS || biome === BIOMES.TAIGA || biome === BIOMES.ALPINE_PEAKS) && r < 0.44) {
          const rs = Math.random();
          type = rs < 0.25 ? 'frozen_zombie' : (rs < 0.50 ? 'icy_creeper' : (rs < 0.72 ? 'iceologer' : (Math.random() < 0.14 ? 'spider_jockey' : 'stray')));
        }
        else if ((biome === BIOMES.SWAMP || biome === BIOMES.MANGROVE_SWAMP || biome === BIOMES.LUSH_GROVE) && r < 0.46) {
          const rm = Math.random();
          type = rm < 0.28 ? 'mossy_zombie' : (rm < 0.56 ? 'bogged' : (rm < 0.78 ? 'witch' : 'slime'));
        }
        else if ((biome === BIOMES.BEACH_PALM || biome === BIOMES.DEEP_OCEAN) && r < 0.36) type = 'drowned';
        else if (biome === BIOMES.SNOW || biome === BIOMES.SNOWY_PLAINS || biome === BIOMES.ALPINE_PEAKS) {
          if (Math.random() < 0.14) type = 'snow_golem';
        }
        if (!type && r < 0.22) type = Math.random() < 0.14 ? 'chicken_jockey' : 'zombie';
        else if (r < 0.34) type = Math.random() < 0.12 ? 'spider_jockey' : 'skeleton';
        else if (r < 0.46) {
          const rc = Math.random();
          type = (typeof rainIntensity !== 'undefined' && rainIntensity > 0.8 && rc < 0.25) ? 'charged_creeper' : (rc < 0.14 ? 'potato_creeper' : (rc < 0.24 ? 'nerd_creeper' : (rc < 0.34 ? 'ghost_creeper' : 'creeper')));
        }
        else if (r < 0.58) type = 'spider';
        else if (r < 0.66) type = Math.random() < 0.30 ? 'pillager_raider' : 'pillager';
        else if (r < 0.72) type = 'vindicator';
        else if (r < 0.78) type = Math.random() < 0.35 ? 'breeze' : 'evoker';
        else if (r < 0.82) type = 'ravager';
        else if (r < 0.90) type = Math.random() < 0.45 ? 'creaking' : 'wither_knight';
        else type = Math.random() < 0.60 ? 'enderman' : 'void_stalker';
      } else {
        if (biome === BIOMES.SULFUR_SPRINGS && r < 0.64 && (!getDifficultyCfg || getDifficultyCfg().hostileSpawn) && hostileCnt < hostileCap) {
          type = 'sulfur_slime';
        } else {
        if (spawnY <= WATER_LEVEL || passiveCnt >= passiveCap) return;
        if (r < 0.62) {
          type = pickBiomeAnimal(biome, false);
          if (ANIMAL_MAP.get(type)?.fly) {
            if (skyCnt >= skyCap) return;
            spawnY += 4.5 + Math.random() * 3.5;
          }
        } else if ((biome === BIOMES.MEADOW || biome === BIOMES.SAKURA) && r < 0.74) type = Math.random() < 0.4 ? 'moobloom' : (Math.random() < 0.5 ? 'cluckshroom' : 'sniffer');
        else if ((biome === BIOMES.FOREST || biome === BIOMES.TAIGA || biome === BIOMES.AUTUMN) && r < 0.80) type = Math.random() < 0.40 ? 'antler_deer' : (Math.random() < 0.45 ? 'cinnamon_ferret' : (Math.random() < 0.5 ? 'moss_golem' : 'wolf'));
        else if ((biome === BIOMES.BEACH_PALM) && r < 0.78) type = 'blue_crab';
        else if ((biome === BIOMES.PLATEAU || biome === BIOMES.MESA || biome === BIOMES.DESERT) && r < 0.76) { type = r < 0.68 ? 'armadillo' : 'vulture'; if (type === 'vulture') spawnY += 4.5; }
        else if ((biome === BIOMES.SAKURA || biome === BIOMES.FLOWER_MEADOW || biome === BIOMES.LAVENDER_MEADOW || biome === BIOMES.LUSH_GROVE || biome === BIOMES.PLAINS || biome === BIOMES.GREEN_PLAINS) && r < 0.84) {
          const plPool = ['plush_slime_mint', 'plush_strawberry_slime', 'plush_allay_lavender', 'plush_bear_teal', 'plush_panda_berry', 'plush_duckling_bow', 'plush_chicken_daisy', 'plush_pig_crown', 'plush_cow_flower', 'plush_sheep_sakura', 'plush_fox_berry', 'plush_wolf_bow', 'plush_llama_bow', 'plush_turtle_flower', 'plush_axolotl_hat'];
          type = plPool[(Math.random() * plPool.length) | 0];
          if (type === 'plush_allay_lavender') spawnY += 2.2;
        }
        else if (r < 0.88) type = Math.random() < 0.4 ? 'wooly_cow' : 'pig';
        else if (r < 0.92) type = 'sheep';
        else if (r < 0.95) type = 'cow';
        else if (r < 0.98) type = 'chicken';
        else type = 'fox';
        }
      }
    }
    if (!getDifficultyCfg().hostileSpawn && MOB_STATS[type] && MOB_STATS[type].hostile) return;
    if ((ANIMAL_MAP.get(type)?.fly || MOB_STATS[type]?.flying || MOB_STATS[type]?.skyBird) && skyCnt >= skyCap) return;
    spawnMobOfType(type, wx + 0.5, spawnY, wz + 0.5);
  }

  // Humanoid mobs capable of pillaring up to pursue elevated targets (like Minecraft pillaring)
  const HUMANOID_PILLAR_MOBS = new Set([
    'zombie', 'husk', 'drowned', 'frozen_zombie', 'mossy_zombie', 'ruin_stalker',
    'skeleton', 'stray', 'desert_skeleton', 'bogged', 'spider_jockey', 'wither_skeleton', 'wither_knight',
    'piglin', 'piglin_brute', 'zombified_piglin', 'pillager', 'pillager_raider', 'vindicator', 'evoker', 'iceologer', 'witch'
  ]);

  // 3D Arrow Projectiles & Explosions (Creeper + TNT)
  const projectiles = [], primedTnts = [];
  function computeSmartAimDir(ox, oy, oz, tx, ty, tz, tvx, tvy, tvz, speed, gravity = 0, spread = 0.016) {
    let px = tx, py = ty, pz = tz;
    for (let it = 0; it < 2; it++) {
      const d = Math.hypot(px - ox, py - oy, pz - oz);
      const t = Math.min(1.55, d / Math.max(4, speed));
      px = tx + tvx * t * 0.86;
      py = ty + tvy * t * 0.32;
      pz = tz + tvz * t * 0.86;
    }
    const dx = px - ox, dz = pz - oz;
    const hd = Math.hypot(dx, dz);
    const flightT = Math.min(1.55, hd / Math.max(4, speed));
    const dy = (py - oy) + 0.5 * gravity * flightT * flightT;
    const len = Math.hypot(dx, dy, dz) || 1;
    let ux = dx / len, uy = dy / len, uz = dz / len;
    if (spread > 0) {
      ux += (Math.random() - 0.5) * spread;
      uy += (Math.random() - 0.5) * spread * 0.65;
      uz += (Math.random() - 0.5) * spread;
      const nL = Math.hypot(ux, uy, uz) || 1;
      ux /= nL; uy /= nL; uz /= nL;
    }
    return { x: ux, y: uy, z: uz };
  }
  const arrowShaftGeo = new THREE.BoxGeometry(0.05, 0.05, 0.65);
  const arrowTipGeo = new THREE.BoxGeometry(0.09, 0.09, 0.12);
  const _arrowShaftMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
  const _arrowTipPlayerMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7, roughness: 0.3 });
  const _arrowTipMobMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
  function fireArrow(ox, oy, oz, dirX, dirY, dirZ, speed, fromPlayer, dmg, opts = null) {
    if (projectiles.length >= 48) { const oldP = projectiles.shift(); scene.remove(oldP.mesh); }
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(arrowShaftGeo, _arrowShaftMat);
    const tip = new THREE.Mesh(arrowTipGeo, fromPlayer ? _arrowTipPlayerMat : _arrowTipMobMat);
    tip.position.z = 0.34;
    g.add(shaft, tip);
    g.position.set(ox, oy, oz);
    scene.add(g);
    const isRemote = !!(opts && opts._remoteVisual);
    const pObj = { kind: 'arrow', x: ox, y: oy, z: oz, vx: dirX * speed, vy: dirY * speed, vz: dirZ * speed, fromPlayer, dmg, stuck: false, life: 4.5, mesh: g, _remoteVisual: isRemote };
    projectiles.push(pObj);
    playSfx('bow');
    if (activeRoomId && !isRemote && typeof broadcastProjectileSpawn === 'function') broadcastProjectileSpawn(pObj);
  }
  function spawnRemoteSnowball(ox, oy, oz, vx, vy, vz, fromPlayer = true) {
    if (projectiles.length >= 48) { const oldP = projectiles.shift(); scene.remove(oldP.mesh); }
    const sbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.7 }));
    sbMesh.position.set(ox, oy, oz); scene.add(sbMesh);
    projectiles.push({ kind: 'snowball', x: ox, y: oy, z: oz, vx, vy, vz, fromPlayer, dmg: 0.5, stuck: false, life: 4.0, mesh: sbMesh, _remoteVisual: true });
    playSfx('bow');
  }
  const _orbSheetMap = {
    sonic_boom: 'magic_sonic', blaze_fire: 'fire_flame', ghast_fire: 'explosion_fire',
    shulker_bolt: 'magic_ender', dragon_ball: 'magic_ender', evoker_fang: 'crit_star',
    guardian_beam: 'lightning_arc', witch_potion: 'magic_poison', poison_arrow: 'magic_poison',
    ice_shard: 'frost_aura', trident: 'water_splash',
    drg_ice: 'frost_aura', drg_fire: 'explosion_fire', drg_fire_meteor: 'explosion_fire',
    drg_earth: 'smoke_puff', drg_water: 'water_splash', drg_leaf: 'magic_poison', drg_leaf_seed: 'magic_poison',
    drg_tree: 'magic_poison', drg_tree_root: 'magic_poison'
  };
  function fireEnergyOrb(ox, oy, oz, dirX, dirY, dirZ, speed, dmg, kind = 'dragon_ball', opts = null) {
    if (projectiles.length >= 72) { const oldP = projectiles.shift(); scene.remove(oldP.mesh); }
    const pfxKey = (opts && opts.pfxKey) || _orbSheetMap[kind] || 'magic_ender';
    const sheet = getPixelFxSheet(pfxKey);
    const mesh = new THREE.Sprite(sheet.mats[0]);
    const defSc = (kind === 'ghast_fire') ? 1.15 : (kind === 'dragon_ball' ? 3.0 : (kind && kind.startsWith('drg_') ? 2.8 : (kind === 'sonic_boom' ? 0.88 : 0.72)));
    const sc = (opts && opts.scale) || defSc;
    mesh.scale.setScalar(sc);
    mesh.position.set(ox, oy, oz);
    scene.add(mesh);
    const isRemote = !!(opts && opts._remoteVisual);
    const pObj = {
      kind, pfxKey, pfxSheet: sheet, pfxT: 0, x: ox, y: oy, z: oz,
      vx: dirX * speed, vy: dirY * speed, vz: dirZ * speed,
      fromPlayer: false, friendlyDragon: !!(opts && opts.friendlyDragon), ownerDragon: (opts && opts.ownerDragon) || null,
      dmg, scale: sc, splashR: (opts && opts.splashR) || (sc >= 2.0 ? sc * 1.9 : 3.2),
      gravity: (opts && opts.gravity) || 0, effect: (opts && opts.effect) || null,
      vfxScale: (opts && opts.vfxScale) || Math.max(1.2, sc * 0.95), trailScale: Math.max(0.44, sc * 0.42),
      stuck: false, life: 4.2, mesh, _remoteVisual: isRemote
    };
    projectiles.push(pObj);
    playSfx(kind === 'ghast_fire' || kind === 'dragon_ball' ? 'roar' : 'burn');
    if (activeRoomId && !isRemote && typeof broadcastProjectileSpawn === 'function') broadcastProjectileSpawn(pObj);
  }

  // === v101 Sculk Vibration, Wool Muffling, Sculk Shrieker Warden Summoning & Deep Dark Synths ===
  function isVibrationBlockedByWool(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.25) return false;
    const steps = Math.min(28, Math.max(4, Math.ceil(dist * 2.0)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const bid = getBlockWorld(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t), Math.floor(z0 + dz * t));
      if (isWoolBlock(bid)) return true;
    }
    return false;
  }

  function playShriekerWailSfx() {
    if (sfxVolume <= 0.01) return;
    try {
      ensureAudio();
      if (!audioCtx || !sfxGain) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sawtooth'; osc2.type = 'triangle';
      osc.frequency.setValueAtTime(118, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.45);
      osc.frequency.exponentialRampToValueAtTime(140, now + 1.45);
      osc2.frequency.setValueAtTime(236, now);
      osc2.frequency.exponentialRampToValueAtTime(780, now + 0.55);
      osc2.frequency.exponentialRampToValueAtTime(190, now + 1.55);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
      osc.connect(g); osc2.connect(g); g.connect(sfxGain);
      osc.start(now); osc2.start(now); osc.stop(now + 1.7); osc2.stop(now + 1.7);
    } catch (_) {}
  }

  function playAncientCityDiscSfx(isDisc5 = false) {
    if (sfxVolume <= 0.01) return;
    try {
      ensureAudio();
      if (!audioCtx || !sfxGain) return;
      const now = audioCtx.currentTime;
      const notes = isDisc5 ? [146.8, 164.8, 130.8, 110.0, 146.8, 196.0] : [261.6, 329.6, 392.0, 493.9, 392.0, 329.6, 293.7];
      for (let i = 0; i < notes.length; i++) {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = isDisc5 ? 'sine' : 'triangle';
        const st = now + i * 0.24;
        osc.frequency.setValueAtTime(notes[i], st);
        g.gain.setValueAtTime(0.001, st);
        g.gain.linearRampToValueAtTime(0.14, st + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.28);
        osc.connect(g); g.connect(sfxGain);
        osc.start(st); osc.stop(st + 0.30);
      }
    } catch (_) {}
  }

  function spawnWardenEmerging(ox, oy, oz) {
    let sx = Math.floor(ox) + 0.5, sy = Math.floor(oy), sz = Math.floor(oz) + 0.5;
    let placed = false;
    for (let rad = 2; rad <= 7 && !placed; rad++) {
      for (let ang = 0; ang < 8 && !placed; ang++) {
        const a = (ang / 8) * Math.PI * 2;
        const tx = Math.floor(ox + Math.cos(a) * rad), tz = Math.floor(oz + Math.sin(a) * rad);
        for (let dy = -3; dy <= 4; dy++) {
          const ty = Math.floor(oy) + dy;
          if (isSolidAt(tx, ty - 1, tz) && mobFitsAt(tx + 0.5, ty, tz + 0.5, 0.72, 2.85)) {
            sx = tx + 0.5; sy = ty; sz = tz + 0.5; placed = true; break;
          }
        }
      }
    }
    const wm = spawnMobOfType('cave_warden', sx, sy, sz);
    if (!wm) return null;
    wm.state = 'emerging';
    wm.stateT = 3.8;
    wm._emergeBaseY = sy;
    wm.anger = 65;
    wm._calmT = 0;
    wm._sniffCd = 2.8;
    wm._sonicCd = 3.2;
    wm._sonicChargeT = 0;
    wm._heartbeatT = 0;
    wm._tendrilFlashT = 1.5;
    wm.investigateTarget = { x: player.x, y: player.y, z: player.z };
    if (wm.group) wm.group.position.y = sy - 2.6;
    player._darknessT = Math.max(player._darknessT || 0, 16.0);
    cameraShake = Math.max(cameraShake, 0.55);
    playSfx('roar');
    spawnParticles(sx, sy + 0.8, sz, 0x0e7490, 22, true);
    spawnParticles(sx, sy + 1.3, sz, 0x22d3ee, 14, true);
    showToast('💀 WARDEN ĐÃ TRỒI LÊN TỪ LÒNG ĐẤT! CẨN THẬN SÓNG ÂM XUYÊN GIÁP!');
    return wm;
  }

  function triggerSculkShrieker(sx, sy, sz) {
    if (currentDimension !== 'overworld') return false;
    const nowSec = performance.now() * 0.001;
    if (player._lastShriekerT && (nowSec - player._lastShriekerT) < 8.0) return false;
    player._lastShriekerT = nowSec;
    player._wardenWarningLevel = Math.min(4, (player._wardenWarningLevel || 0) + 1);
    player._wardenWarnDecayT = 600.0;
    player._darknessT = Math.max(player._darknessT || 0, 12.5);
    playShriekerWailSfx();
    for (let k = 0; k < 4; k++) {
      spawnParticles(sx + 0.5, sy + 0.8 + k * 0.55, sz + 0.5, 0x22d3ee, 6, true);
    }
    const lvl = player._wardenWarningLevel;
    if (lvl >= 4) {
      const hasNearbyWarden = mobs.some(mb => mb && !mb._dead && mb.type === 'cave_warden' && Math.hypot(mb.x - sx, mb.z - sz) < 48);
      if (!hasNearbyWarden) {
        spawnWardenEmerging(sx, sy + 1, sz);
        player._wardenWarningLevel = 3;
      } else {
        showToast('⚠️ Sculk Shrieker gào thét dữ dội! Warden đang tiến tới!');
      }
    } else {
      showToast(`⚠️ Sculk Shrieker gào thét! (Cảnh báo ${lvl}/4 — Hãy giữ Shift đi lén hoặc dùng Len!)`);
    }
    return true;
  }

  function emitSculkVibration(wx, wy, wz, sourceType = 'step', radius = 9) {
    if (currentDimension !== 'overworld') return;
    if ((sourceType === 'step' || sourceType === 'land') && (player.sneaking || isWoolBlock(getBlockWorld(Math.floor(wx), Math.floor(wy - 0.15), Math.floor(wz))))) return;
    const rInt = Math.min(10, Math.round(radius));
    const bx0 = Math.floor(wx), by0 = Math.floor(wy), bz0 = Math.floor(wz);
    let triggeredSensor = null, bestD2 = rInt * rInt + 1;
    for (let dy = -4; dy <= 5; dy++) {
      const yy = by0 + dy;
      if (yy < MIN_Y + 1 || yy > MAX_Y - 1) continue;
      for (let dz = -rInt; dz <= rInt; dz++) {
        for (let dx = -rInt; dx <= rInt; dx++) {
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > rInt * rInt || d2 >= bestD2) continue;
          const xx = bx0 + dx, zz = bz0 + dz;
          const bid = getBlockWorld(xx, yy, zz);
          if (bid === B.SCULK_SENSOR) {
            if (!isVibrationBlockedByWool(wx, wy + 0.4, wz, xx + 0.5, yy + 0.5, zz + 0.5)) {
              bestD2 = d2; triggeredSensor = { x: xx, y: yy, z: zz };
            }
          } else if (bid === B.SCULK_SHRIEKER && d2 <= 10 && sourceType !== 'projectile' && sourceType !== 'noteblock') {
            if (!isVibrationBlockedByWool(wx, wy + 0.4, wz, xx + 0.5, yy + 0.5, zz + 0.5)) {
              triggerSculkShrieker(xx, yy, zz);
            }
          }
        }
      }
    }
    if (triggeredSensor) {
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        spawnParticles(wx + (triggeredSensor.x + 0.5 - wx) * t, wy + 0.5 + (triggeredSensor.y + 0.5 - wy) * t, wz + (triggeredSensor.z + 0.5 - wz) * t, 0x22d3ee, 1, false);
      }
      if (sourceType !== 'projectile' && sourceType !== 'noteblock') {
        for (let dy = -5; dy <= 5; dy++) for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
          if (dx * dx + dy * dy + dz * dz > 64) continue;
          const sx = triggeredSensor.x + dx, sy = triggeredSensor.y + dy, sz = triggeredSensor.z + dz;
          if (getBlockWorld(sx, sy, sz) === B.SCULK_SHRIEKER && !isVibrationBlockedByWool(triggeredSensor.x + 0.5, triggeredSensor.y + 0.5, triggeredSensor.z + 0.5, sx + 0.5, sy + 0.5, sz + 0.5)) {
            triggerSculkShrieker(sx, sy, sz);
            dy = 99; dz = 99; break;
          }
        }
      }
    }
    const isDistraction = (sourceType === 'projectile' || sourceType === 'noteblock' || sourceType === 'explosion');
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m || m._dead || m.type !== 'cave_warden' || m.state === 'emerging' || m.state === 'digging') continue;
      const wd = Math.hypot(m.x - wx, m.y - wy, m.z - wz);
      if (wd > 26 || isVibrationBlockedByWool(wx, wy + 0.4, wz, m.x, m.y + 1.5, m.z)) continue;
      m._calmT = 0;
      m._tendrilFlashT = 1.25;
      m.anger = Math.min(150, (m.anger || 0) + (isDistraction ? 8 : 35));
      if (!isDistraction || (m.anger || 0) < 95) {
        m.investigateTarget = { x: wx, y: wy, z: wz };
        m._investigateT = 8.0;
      }
    }
  }

  function _playExplosionFxAndLocalDamage(wx, wy, wz, radius = 3.2, baseDmg = 14, reason = 'Bạn bị nổ tung!', opt = null) {
    const distToP = Math.hypot(player.x - wx, player.y - wy, player.z - wz);
    const expGain = Math.max(0.08, Math.min(0.42, (1 - distToP / 34) * 0.42));
    if (!(opt && opt.silent)) playLuantiClip('tnt_explode', expGain, 0.90, 1.05, 220, 'exp', 'mob');
    cameraShake = Math.max(cameraShake, Math.max(0, 0.72 - Math.hypot(player.x - wx, player.z - wz) * 0.038));
    const isElec = !!(opt && opt.electric), isFrost = !!(opt && opt.frost), isCrystal = !!(opt && opt.crystal);
    spawnPixelFx(isCrystal ? 'explosion_ender' : (isElec ? 'explosion_electric' : (isFrost ? 'explosion_frost' : 'explosion_fire')), wx, wy + 0.85, wz, { count: isCrystal ? 3 : 2, scale: Math.min(3.8, radius * 0.95), life: 0.56, spread: 0.9, grow: 0.35 });
    spawnPixelFx('smoke_puff', wx, wy + 1.05, wz, { count: 3, scale: 1.35, life: 0.65, riseV: 1.4, spread: 1.2 });
    if (isCrystal) spawnPixelFx('end_crystal_burst', wx, wy + 0.85, wz, { count: 4, scale: 1.85, life: 0.54, spread: 1.6 });
    else if (isElec) spawnPixelFx('lightning_arc', wx, wy + 0.95, wz, { count: 4, scale: 1.45, life: 0.42, spread: 1.8 });
    else if (isFrost) spawnPixelFx('ice_shatter', wx, wy + 0.95, wz, { count: 4, scale: 1.45, life: 0.48, spread: 1.8 });
    else spawnPixelFx('fire_flame', wx, wy + 0.7, wz, { count: 3, scale: 1.15, life: 0.46, spread: 1.4, riseV: 1.6 });
    const dp = Math.hypot(player.x - wx, player.y + 0.8 - wy, player.z - wz);
    if (dp < radius * 2.1 && !player.dead && gameMode !== 'creative') {
      const f = 1 - dp / (radius * 2.1);
      hurtPlayer(Math.max(1, Math.round(baseDmg * f)), reason);
      const inv = 1 / (dp + 0.1);
      player.vx += (player.x - wx) * inv * (isCrystal ? 12.5 : 10) * f;
      player.vy += (isCrystal ? 8.2 : 6.5) * f;
      player.vz += (player.z - wz) * inv * (isCrystal ? 12.5 : 10) * f;
    }
    emitSculkVibration(wx, wy, wz, 'explosion', 16);
  }

  function triggerExplosion(wx, wy, wz, radius = 3.2, baseDmg = 14, reason = 'Bạn bị nổ tung!', opt = null) {
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof isSimAuthority === 'function' && !isSimAuthority() && !(opt && opt._fromAuth)) {
      return;
    }
    _playExplosionFxAndLocalDamage(wx, wy, wz, radius, baseDmg, reason, opt);
    const isCrystal = !!(opt && opt.crystal);
    const destroyBlocks = !(opt && opt.destroyBlocks === false);
    const rCeil = Math.ceil(radius), cx0 = Math.floor(wx), cy0 = Math.floor(wy), cz0 = Math.floor(wz);
    const chainCrystals = [];
    if (typeof beginBlockBatch === 'function') beginBlockBatch();
    let craterBlocks = [];
    try {
      for (let dy = -rCeil; dy <= rCeil; dy++) for (let dz = -rCeil; dz <= rCeil; dz++) for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const bx = cx0 + dx, by = cy0 + dy, bz = cz0 + dz;
        const bid = getBlockWorld(bx, by, bz);
        if (bid === B.END_CRYSTAL_BLOCK) {
          if (bx !== cx0 || by !== cy0 || bz !== cz0) chainCrystals.push([bx, by, bz]);
          continue;
        }
        if (!destroyBlocks) continue;
        const bDef = BLOCK_DEF[bid];
        if (bid === B.AIR || bid === B.BEDROCK || bid === B.WATER || (bDef && (bDef.indestructible || bDef.blastResist || bDef.blastProof))) continue;
        if (bid === B.TNT) {
          setBlockWorld(bx, by, bz, B.AIR, true);
          spawnPrimedTnt(bx + 0.5, by, bz + 0.5, 0.35 + Math.random() * 0.3);
          continue;
        }
        const drop = BLOCK_DEF[bid]?.drop;
        if (bDef && bDef.chest) breakChestAt(bx, by, bz, bid);
        if (bDef && bDef.furnaceType && typeof breakFurnaceAt === 'function') breakFurnaceAt(bx, by, bz, bid);
        setBlockWorld(bx, by, bz, B.AIR, true);
        if (drop && !(bDef && (bDef.chest || bDef.furnaceType)) && Math.random() < 0.32) spawnDroppedItem(bx, by, bz, drop);
      }
    } finally {
      craterBlocks = (typeof endBlockBatch === 'function') ? endBlockBatch(true) : [];
    }
    if (craterBlocks.length > 0 && typeof flushUrgentChunks === 'function') flushUrgentChunks(32, true);
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof broadcastExplosion === 'function') {
      broadcastExplosion(wx, wy, wz, radius, baseDmg, reason, opt, craterBlocks);
    }
    for (let i = mobs.length - 1; i >= 0; i--) {
      const mb = mobs[i], dm = Math.hypot(mb.x - wx, mb.y + 0.8 - wy, mb.z - wz);
      if (mb._justCharged) { mb._justCharged = false; continue; }
      if (dm < radius * 2.1) {
        const f = 1 - dm / (radius * 2.1);
        hurtMob(mb, Math.round(baseDmg * 1.4 * f), mb.x - wx, mb.z - wz, 6 * f, true);
      }
    }
    for (let ci = 0; ci < chainCrystals.length; ci++) {
      const [cbx, cby, cbz] = chainCrystals[ci];
      if (getBlockWorld(cbx, cby, cbz) === B.END_CRYSTAL_BLOCK) detonateEndCrystalAt(cbx, cby, cbz, true);
    }
  }

  function detonateEndCrystalAt(bx, by, bz, fromChain = false) {
    if (getBlockWorld(bx, by, bz) !== B.END_CRYSTAL_BLOCK) return false;
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof isSimAuthority === 'function' && !isSimAuthority()) {
      if (typeof broadcastWorldAction === 'function') broadcastWorldAction('detonate_crystal', bx, by, bz);
      return true;
    }
    const bk = modKey(bx, by, bz);
    const wasWL = waterloggedBlocks.delete(bk);
    const inWater = wasWL ||
      getBlockWorld(bx + 1, by, bz) === B.WATER || getBlockWorld(bx - 1, by, bz) === B.WATER ||
      getBlockWorld(bx, by + 1, bz) === B.WATER || getBlockWorld(bx, by, bz + 1) === B.WATER ||
      getBlockWorld(bx, by, bz - 1) === B.WATER;
    setBlockWorld(bx, by, bz, wasWL ? B.WATER : B.AIR, true);
    if (wasWL) { fluidLevel.set(bk, 0); wakeAdjacentFluids(bx, by, bz); }
    _delInteractiveVisual(bk);
    _endCrystalScanT = 0;
    spawnParticles(bx + 0.5, by + 0.65, bz + 0.5, 0xe879f9, 26, true);
    playSfx('mob_explode');
    // If an Ender Dragon is tethered or nearby in The End, deal 25 backlash damage!
    const drg = mobs.find(mb => mb && !mb._dead && mb.type === 'ender_dragon' && Math.hypot(mb.x - bx, mb.z - bz) < 54);
    if (drg) {
      hurtMob(drg, 25, 0, 0, 0, false, true);
      showToast('💥 Pha Lê End phát nổ! Rồng Ender bị sốc năng lượng (-25 HP)!');
    } else if (inWater && !fromChain) {
      showToast('💥💧 Pha Lê End nổ trong nước: Giữ nguyên địa hình xung quanh nhưng vẫn gây sát thương nổ cực mạnh!');
    }
    triggerExplosion(bx + 0.5, by + 0.5, bz + 0.5, 6.0, 28, '💥 Bạn bị Pha Lê End phát nổ cực mạnh!', { destroyBlocks: !inWater, crystal: true });
    if (!fromChain) {
      flushUrgentChunks(32);
    }
    return true;
  }

  function tryRespawnEnderDragonWithCrystals(placedX, placedY, placedZ) {
    if (currentDimension !== 'end') return false;
    if (mobs.some(mb => mb && !mb._dead && mb.type === 'ender_dragon')) return false;
    // Scan for End Crystals placed around the central End Return Portal / Bedrock Fountain (within 16 blocks of center)
    const found = [];
    for (let wx = -14; wx <= 14; wx++) {
      for (let wz = -14; wz <= 16; wz++) {
        for (let wy = 4; wy <= 24; wy++) {
          if (getBlockWorld(wx, wy, wz) === B.END_CRYSTAL_BLOCK) {
            const below = getBlockWorld(wx, wy - 1, wz);
            if (below === B.OBSIDIAN || below === B.BEDROCK) found.push({ x: wx, y: wy, z: wz });
          }
        }
      }
    }
    if (found.length < 4) {
      if (Math.hypot(placedX, placedZ - 4) <= 14) {
        showToast(`🐉 Nghi thức Hồi Sinh Rồng Ender: Đã đặt ${found.length}/4 Pha Lê End quanh cổng thoát!`);
      }
      return false;
    }
    // Check 4 cardinal sides around the portal/fountain center (or any 4 crystals around the rim)
    let cxMid = 0, czMid = 0;
    for (let i = 0; i < found.length; i++) { cxMid += found[i].x; czMid += found[i].z; }
    cxMid /= found.length; czMid /= found.length;
    let hasN = false, hasS = false, hasW = false, hasE = false;
    for (let i = 0; i < found.length; i++) {
      const dx = found[i].x - cxMid, dz = found[i].z - czMid;
      if (dz <= -0.8 && Math.abs(dx) <= Math.abs(dz) + 1.5) hasN = true;
      if (dz >=  0.8 && Math.abs(dx) <= Math.abs(dz) + 1.5) hasS = true;
      if (dx <= -0.8 && Math.abs(dz) <= Math.abs(dx) + 1.5) hasW = true;
      if (dx >=  0.8 && Math.abs(dz) <= Math.abs(dx) + 1.5) hasE = true;
    }
    if (!(hasN && hasS && hasW && hasE) && found.length < 4) return false;
    // Consume the 4 ritual End Crystals with dramatic lightning & magenta crystal bursts!
    const ritualCrystals = found.slice(0, 4);
    for (let i = 0; i < ritualCrystals.length; i++) {
      const rc = ritualCrystals[i];
      setBlockWorld(rc.x, rc.y, rc.z, B.AIR, true);
      _delInteractiveVisual(modKey(rc.x, rc.y, rc.z));
      spawnPixelFx('end_crystal_burst', rc.x + 0.5, rc.y + 0.7, rc.z + 0.5, { count: 4, scale: 2.1, life: 0.65, spread: 0.9 });
      spawnParticles(rc.x + 0.5, rc.y + 0.8, rc.z + 0.5, 0xe879f9, 24, true);
      if (typeof spawnLightningStrike === 'function') spawnLightningStrike(rc.x + 0.5, rc.y, rc.z + 0.5, false);
    }
    // Regenerate End Crystals atop the 8 Obsidian Pillars around the main End island!
    for (let i = 0; i < 8; i++) {
      const px = Math.round(Math.cos((i / 8) * Math.PI * 2) * 26);
      const pz = Math.round(Math.sin((i / 8) * Math.PI * 2) * 26);
      const ph = 17 + (i % 4) * 4;
      const baseH = Math.max(4, getTerrainHeight(px, pz, BIOMES.THE_END));
      const topY = baseH + ph + 1;
      if (chunks.has(chunkKey(px >> 4, pz >> 4))) {
        setBlockWorld(px, topY, pz, B.END_CRYSTAL_BLOCK, true);
        spawnPixelFx('end_crystal_burst', px + 0.5, topY + 0.6, pz + 0.5, { count: 2, scale: 1.6, life: 0.5 });
      }
    }
    _endCrystalScanT = 0;
    flushUrgentChunks(32, true);
    defeatedMobTags.delete('end:ender_dragon');
    defeatedMobTags.delete('end:boss:ender_dragon');
    const drg = spawnMobOfType('ender_dragon', 0.5, 28, 0.5, { spawnTag: 'end:ender_dragon' });
    if (drg) { drg.hp = drg.maxHp = 600; }
    cameraShake = Math.max(cameraShake, 0.75);
    playSfx('roar');
    showToast('🐉 NGHI THỨC HỒI SINH HOÀN TẤT! 4 Pha Lê End đã triệu hồi lại RỒNG ENDER (600 HP)!');
    return true;
  }

  function spawnPrimedTnt(x, y, z, fuse = 2.4, opts = null) {
    const isRemote = !!(opts && opts._remoteVisual);
    const mesh = build3DTexturedBlockMesh(B.TNT);
    // Clone material so each primed TNT flashes independently without mutating cached textures
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(m => m.clone());
    else if (mesh.material) mesh.material = mesh.material.clone();
    mesh.scale.setScalar(3.65); mesh.position.set(x, y + 0.5, z); mesh.rotation.set(0, 0, 0);
    scene.add(mesh);
    primedTnts.push({ x, y, z, vy: 3.5, fuse, mesh, _remoteVisual: isRemote });
    playSfx('hiss');
    if (activeRoomId && !isRemote && typeof isSimAuthority === 'function' && isSimAuthority() && typeof broadcastTntSpawn === 'function') {
      broadcastTntSpawn(x, y, z, fuse);
    }
  }
  function igniteAdjacentTnt(wx, wy, wz) {
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof isSimAuthority === 'function' && !isSimAuthority()) {
      if (typeof broadcastWorldAction === 'function') broadcastWorldAction('ignite_adj_tnt', wx, wy, wz);
      return 0;
    }
    const dirs = [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    let lit = 0;
    if (typeof beginBlockBatch === 'function') beginBlockBatch();
    try {
      for (let i = 0; i < dirs.length; i++) {
        const nx = wx + dirs[i][0], ny = wy + dirs[i][1], nz = wz + dirs[i][2];
        if (getBlockWorld(nx, ny, nz) === B.TNT) {
          setBlockWorld(nx, ny, nz, B.AIR, true);
          spawnPrimedTnt(nx + 0.5, ny, nz + 0.5, 1.6 + lit * 0.15);
          lit++;
        }
      }
    } finally {
      if (typeof endBlockBatch === 'function') endBlockBatch();
    }
    if (lit > 0) {
      flushUrgentChunks(32);
    }
    return lit;
  }

  function hurtMob(mob, dmg, kx, kz, ky = 4.2, isFire = false, fromPlayer = true, opts = null) {
    if (!mob || mob._dead) return false;
    if (fromPlayer && mob.tamed && mob.elemDragon) return false;
    if (activeRoomId && fromPlayer && typeof isSimAuthority === 'function' && !isSimAuthority() && !(opts && opts._fromAuth)) {
      mob.hurtFlash = 0.24; mob.hpBarTimer = 4.5;
      playMobSfx(mob.type, 'hurt');
      spawnPixelFx('slash_arc', mob.x, mob.y + mob.hitboxH * 0.55, mob.z, { count: 1, scale: 1.05, life: 0.24, spread: 0.15 });
      if (typeof broadcastMobHit === 'function') broadcastMobHit(mob.uid, dmg, kx, kz, ky, isFire);
      return false;
    }
    const kd = Math.hypot(kx, kz) + 0.01;
    mob.vx = (kx / kd) * 6.5; mob.vz = (kz / kd) * 6.5; mob.vy = Math.max(mob.vy, ky);
    if (mob.dragonArmor) {
      const armorPts = calcDragonArmorPts(mob);
      if (armorPts > 0) dmg = Math.max(0.5, dmg * (1 - Math.min(0.75, armorPts * 0.035)));
    }
    mob.hp -= dmg; mob.hurtFlash = 0.24; mob.hpBarTimer = 4.5;
    if (fromPlayer && !mob.tamed && !mob.villager) { _playerCombatTarget = mob; _playerCombatTargetT = 12.0; }
    if (fromPlayer && !mob.isBoss) { lastTargetMob = mob; lastTargetMobTimer = 3.5; }
    if (fromPlayer) {
      playMobSfx(mob.type, 'hurt');
      spawnPixelFx('slash_arc', mob.x, mob.y + mob.hitboxH * 0.55, mob.z, { count: 1, scale: 1.05, life: 0.24, spread: 0.15 });
      if (dmg >= 6) spawnPixelFx('crit_star', mob.x, mob.y + mob.hitboxH * 0.75, mob.z, { count: 1, scale: 0.72, life: 0.30, spread: 0.22 });
    }
    if (isFire && !FIRE_IMMUNE_MOBS.has(mob.type)) {
      mob.burning = true; mob.burnTime = Math.max(mob.burnTime || 0, 5.5);
      spawnPixelFx('fire_flame', mob.x, mob.y + mob.hitboxH * 0.5, mob.z, { count: 2, scale: 0.78, life: 0.38, riseV: 1.0 });
    }
    if (fromPlayer && (mob.neutral || mob.type === 'spider')) mob.provoked = 28.0;
    if (fromPlayer && mob.villager) {
      for (let gi = 0; gi < mobs.length; gi++) {
        if (mobs[gi].guardian && Math.hypot(mobs[gi].x - mob.x, mobs[gi].z - mob.z) < 20) mobs[gi].provoked = 30.0;
      }
      showToast('⚠️ Đừng đánh Dân Làng! Golem Sắt sẽ bảo vệ họ!');
    }
    if (!mob.hostile && !mob.neutral) mob.fleeT = 4.0;
    if (mob.hpBar) updateMobHpBar(mob, mob.hp / mob.maxHp);
    if (mob.hp <= 0) {
      if (mob.type === 'ender_dragon' && !mob._dyingT && !mob._deathFinal) {
        mob.hp = 1;
        mob._dyingT = 4.0;
        mob.hostile = false;
        mob.flying = true;
        mob.atkCd = 99;
        _attachDragonDeathRays(mob);
        playSfx('roar');
        showToast('✨ RỒNG ENDER ĐANG TAN BIẾN!');
        return true;
      }
      spawnPixelFx('smoke_puff', mob.x, mob.y + 0.85, mob.z, { count: 3, scale: 1.0, life: 0.50, riseV: 1.1, spread: 0.45 });
      if (mob.type === 'icy_creeper') spawnPixelFx('ice_shatter', mob.x, mob.y + 0.9, mob.z, { count: 2, scale: 1.2, life: 0.46 });
      else if (mob.type === 'charged_creeper') spawnPixelFx('lightning_arc', mob.x, mob.y + 0.9, mob.z, { count: 2, scale: 1.25, life: 0.40 });
      spawnParticles(mob.x, mob.y + 0.8, mob.z, mob.hostile ? 0x4ade80 : 0xfca5a5, 8, false);
      spawnParticles(mob.x, mob.y + 0.65, mob.z, 0xa3e635, 6, true);
      spawnXpOrbs(mob.x, mob.y + 0.7, mob.z, mob.isBoss ? 35 : (mob.hostile ? 8 : 5));
      const bx = Math.floor(mob.x), by = Math.floor(mob.y), bz = Math.floor(mob.z);
      if (mob.type === 'creeper' || mob.type === 'charged_creeper' || mob.type === 'icy_creeper' || mob.type === 'potato_creeper' || mob.type === 'nerd_creeper' || mob.type === 'ghost_creeper') {
        spawnDroppedItem(bx, by, bz, mob.type === 'potato_creeper' ? B.POTATO : B.GUNPOWDER);
        if (mob.type === 'charged_creeper' || mob.type === 'nerd_creeper') spawnDroppedItem(bx, by, bz, B.GLOW_CRYSTAL);
        else if (Math.random() < 0.5) spawnDroppedItem(bx, by, bz, B.GUNPOWDER);
      }
      else if (mob.type === 'void_stalker' || mob.type === 'enderman') { spawnDroppedItem(bx, by, bz, B.ENDER_PEARL); if (Math.random() < 0.45) spawnDroppedItem(bx, by, bz, B.ENDER_PEARL); if (Math.random() < 0.35) spawnDroppedItem(bx, by, bz, B.VOID_PEARL); }
      else if (mob.type === 'wither') { spawnDroppedItem(bx, by, bz, B.DIAMOND, { count: 3 }); spawnDroppedItem(bx, by, bz, B.VOID_PEARL); spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 65); showToast('🏆 ĐÃ HẠ GỤC BOSS WITHER!'); }
      else if (mob.type === 'breeze') { spawnDroppedItem(bx, by, bz, B.GLOW_CRYSTAL); spawnDroppedItem(bx, by, bz, B.ARROW); }
      else if (mob.type === 'creaking') { spawnDroppedItem(bx, by, bz, B.OAK_LOG, { count: 2 }); spawnDroppedItem(bx, by, bz, B.MOSS_BLOCK); }
      else if (mob.type === 'snow_golem') { spawnDroppedItem(bx, by, bz, B.SNOW); }
      else if (mob.type === 'ender_dragon') {
        spawnDroppedItem(bx, by, bz, B.DIAMOND); spawnDroppedItem(bx, by, bz, B.DIAMOND);
        spawnDroppedItem(bx, by, bz, B.VOID_PEARL); spawnDroppedItem(bx, by, bz, B.GOLD_APPLE);
        spawnParticles(mob.x, mob.y + 1.8, mob.z, 0xd946ef, 36, true);
        spawnXpOrbs(mob.x, mob.y + 1.4, mob.z, 80);
        if (currentDimension === 'end' && typeof buildEndReturnPortal === 'function') {
          const endBaseY = Math.max(8, getTerrainHeight(0, 0, BIOMES.THE_END));
          buildEndReturnPortal(0, endBaseY + 1, 0);
          if (typeof buildEndGatewayPortal === 'function') {
            const gwBaseY = Math.max(7, getTerrainHeight(32, 0, BIOMES.THE_END));
            buildEndGatewayPortal(32, gwBaseY + 4, 0);
          }
          if (typeof buildDragonRealmPortal === 'function') {
            const drBaseY = Math.max(7, getTerrainHeight(12, 0, BIOMES.THE_END));
            buildDragonRealmPortal(12, drBaseY + 1, 0);
          }
          flushUrgentChunks(48, true);
        }
        showToast('🏆 CHIẾN THẮNG RỒNG ENDER! Cổng Về Nhà (0,0), End City (32,0) & Thế Giới Rồng The End (12,0) đã mở!');
      }
      else if (mob.type === 'sovereign_end_dragon') {
        spawnDroppedItem(bx, by, bz, B.SOVEREIGN_KNIGHT_HELM);
        spawnDroppedItem(bx, by, bz, B.SOVEREIGN_KNIGHT_CHEST);
        spawnDroppedItem(bx, by, bz, B.SOVEREIGN_KNIGHT_LEGS);
        spawnDroppedItem(bx, by, bz, B.SOVEREIGN_KNIGHT_BOOTS);
        spawnDroppedItem(bx, by, bz, B.END_DRAGON_SCALE, { count: 8 });
        spawnDroppedItem(bx, by, bz, B.END_DRAGON_BONE, { count: 6 });
        spawnXpOrbs(mob.x, mob.y + 1.6, mob.z, 250);
        spawnParticles(mob.x, mob.y + 2.2, mob.z, 0xf0abfc, 42, true);
        showToast('👑 CHIẾN THẮNG BOSS TỐI THƯỢNG! Đã rơi trọn bộ GIÁP HIỆP SĨ RỒNG TỐI THƯỢNG!');
      }
      else if (_END_FIERCE_DRAGONS.has(mob.type)) {
        spawnDroppedItem(bx, by, bz, B.END_DRAGON_SCALE, { count: 4 + ((Math.random() * 4) | 0) });
        spawnDroppedItem(bx, by, bz, B.END_DRAGON_BONE, { count: 3 + ((Math.random() * 3) | 0) });
        spawnDroppedItem(bx, by, bz, B.VOID_PEARL, { count: 2 });
        spawnXpOrbs(mob.x, mob.y + 1.4, mob.z, 85);
        showToast(`🏆 ĐÃ HẠ GỤC ${mob.displayName.toUpperCase()}! Nhặt Vảy Rồng & Xương Rồng The End để rèn đồ mới!`);
      }
      else if (mob.elemDragon) {
        const dLoot = {
          ice: [B.PACKED_ICE, B.SNOW, B.LAPIS_ORE || B.EMERALD],
          fire: [B.MAGMA_CORE, B.BLAZE_ROD, B.GOLD_INGOT],
          earth: [B.OBSIDIAN, B.EMERALD, B.IRON_INGOT],
          water: [B.SEA_LANTERN, B.WATER_BREATH_POTION, B.EMERALD],
          leaf: [B.MOSS_BLOCK, B.OAK_LEAVES, B.GOLD_APPLE],
          tree: [B.MOSS_BLOCK, B.OAK_LOG, B.GOLD_APPLE]
        }[mob.elemDragon] || [B.EMERALD];
        for (let di = 0; di < dLoot.length; di++) if (dLoot[di]) spawnDroppedItem(bx, by, bz, dLoot[di]);
        const scaleKey = 'DRAGON_SCALE_' + String(mob.elemDragon || 'fire').toUpperCase();
        const scaleId = B[scaleKey] || B.DRAGON_SCALE;
        spawnDroppedItem(bx, by, bz, scaleId, { count: 4 + ((Math.random() * 3) | 0) });
        spawnDroppedItem(bx, by, bz, B.DRAGON_BONE,  { count: 2 + ((Math.random() * 3) | 0) });
        spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 65);
        showToast(`🏆 ĐÃ HẠ GỤC ${mob.displayName.toUpperCase()}! Nhặt Vảy Rồng & Xương Rồng để rèn trang bị!`);
      }
      else if (mob.type === 'cave_warden' || mob.type === 'dream_warden') {
        spawnDroppedItem(bx, by, bz, mob.type === 'dream_warden' ? (B.ICHOR_CRYSTAL || B.SCULK_CATALYST) : B.SCULK_CATALYST);
        spawnDroppedItem(bx, by, bz, B.ECHO_SHARD, { count: 3 });
        spawnDroppedItem(bx, by, bz, B.DISC_FRAGMENT_5);
        spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 50);
        spawnParticles(mob.x, mob.y + 1.5, mob.z, mob.type === 'dream_warden' ? 0xe879f9 : 0x22d3ee, 24, true);
        showToast(mob.type === 'dream_warden' ? '🏆 ĐÃ HẠ GỤC VỆ THẦN GIẤC MƠ!' : '🏆 ĐÃ HẠ GỤC WARDEN THÀNH PHỐ CỔ!');
      }
      else if (mob.type === 'sculk_stalker' || mob.type === 'sculk_brute' || mob.type === 'sculk_sentinel' || mob.type === 'sculk_soul_ravager') {
        const isRav = (mob.type === 'sculk_soul_ravager');
        const dropId = (mob.type === 'sculk_stalker') ? (B.WARDEN_CHITIN || B.ECHO_SHARD)
          : ((mob.type === 'sculk_sentinel') ? (B.SOUL_RESONATOR || B.ECHO_SHARD) : (B.SCULK_HEART || B.ECHO_SHARD));
        spawnDroppedItem(bx, by, bz, dropId, { count: isRav ? 3 : (1 + ((Math.random() * 2) | 0)) });
        if (isRav && B.SCULK_RESONANT_GEM) spawnDroppedItem(bx, by, bz, B.SCULK_RESONANT_GEM, { count: 2 });
        spawnDroppedItem(bx, by, bz, B.ECHO_SHARD, { count: isRav ? 6 : 2 });
        spawnParticles(mob.x, mob.y + 1.4, mob.z, 0x22d3ee, isRav ? 28 : 12, true);
        if (isRav) { spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 90); showToast('🏆 ĐÃ HẠ GỤC BOSS SCULK SOUL RAVAGER!'); }
      }
      else if (mob.type === 'magma_golem') { spawnDroppedItem(bx, by, bz, B.MAGMA_CORE); spawnDroppedItem(bx, by, bz, B.GOLD_INGOT); spawnDroppedItem(bx, by, bz, B.DIAMOND); showToast('🏆 ĐÃ HẠ GỤC BOSS GOLEM DUNG NHAM!'); }
      else if (mob.type === 'redstone_monstrosity') { spawnDroppedItem(bx, by, bz, B.REDSTONE, { count: 6 }); spawnDroppedItem(bx, by, bz, B.DIAMOND, { count: 2 }); spawnDroppedItem(bx, by, bz, B.MAGMA_CORE); spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 45); showToast('🏆 ĐÃ HẠ GỤC BOSS REDSTONE MONSTROSITY!'); }
      else if (mob.type === 'prismarine_colossus') { spawnDroppedItem(bx, by, bz, B.SEA_LANTERN, { count: 2 }); spawnDroppedItem(bx, by, bz, B.EMERALD, { count: 2 }); spawnDroppedItem(bx, by, bz, B.DIAMOND); spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 40); showToast('🏆 ĐÃ HẠ GỤC BOSS THỦ THẦN PRISMARINE!'); }
      else if (mob.type === 'abyssal_colossus') { spawnDroppedItem(bx, by, bz, B.SEA_LANTERN, { count: 2 }); spawnDroppedItem(bx, by, bz, B.DIAMOND, { count: 2 }); spawnDroppedItem(bx, by, bz, B.WATER_BREATH_POTION); spawnXpOrbs(mob.x, mob.y + 1.2, mob.z, 42); showToast('🏆 ĐÃ HẠ GỤC BOSS KHỔNG LỒ BIỂN SÂU!'); }
      else if (mob.type === 'ocean_barnacle') { spawnDroppedItem(bx, by, bz, B.SEA_LANTERN); spawnDroppedItem(bx, by, bz, B.RAW_FISH); }
      else if (mob.type === 'moss_golem') { spawnDroppedItem(bx, by, bz, B.MOSS_BLOCK); spawnDroppedItem(bx, by, bz, B.IRON_INGOT); }
      else if (mob.type === 'rascal') { spawnDroppedItem(bx, by, bz, B.IRON_PICK); spawnDroppedItem(bx, by, bz, B.COAL, { count: 2 }); }
      else if (mob.type === 'sniffer') { spawnDroppedItem(bx, by, bz, B.MOSS_BLOCK); spawnDroppedItem(bx, by, bz, B.FLOWER_YELLOW); }
      else if (mob.type === 'armadillo') { spawnDroppedItem(bx, by, bz, B.TERRACOTTA); }
      else if (mob.type && mob.type.startsWith('plush_')) { spawnDroppedItem(bx, by, bz, B.PINK_WOOL); spawnDroppedItem(bx, by, bz, B.SWEET_BERRIES); }
      else if (mob.type === 'hoglin') { spawnDroppedItem(bx, by, bz, mob.burning ? B.COOKED_PORK : B.RAW_PORK); spawnDroppedItem(bx, by, bz, mob.burning ? B.COOKED_PORK : B.RAW_PORK); }
      else if (mob.type === 'piglin' || mob.type === 'piglin_brute') { spawnDroppedItem(bx, by, bz, B.GOLD_INGOT); if (mob.type === 'piglin_brute') spawnDroppedItem(bx, by, bz, B.IRON_AXE); }
      else if (mob.type === 'ravager') { spawnDroppedItem(bx, by, bz, B.IRON_INGOT); spawnDroppedItem(bx, by, bz, B.SHIELD); }
      else if (mob.type === 'evoker') { spawnDroppedItem(bx, by, bz, B.GOLD_APPLE); spawnDroppedItem(bx, by, bz, B.EMERALD); }
      else if (mob.type === 'vindicator') { spawnDroppedItem(bx, by, bz, B.EMERALD); if (Math.random() < 0.42) spawnDroppedItem(bx, by, bz, B.IRON_AXE); }
      else if (mob.type === 'pillager' || mob.type === 'pillager_raider') { spawnDroppedItem(bx, by, bz, B.ARROW, { count: 2 }); if (mob.type === 'pillager_raider' && Math.random() < 0.5) spawnDroppedItem(bx, by, bz, B.EMERALD); if (Math.random() < 0.35) spawnDroppedItem(bx, by, bz, B.BOW); }
      else if (mob.type === 'drowned') { spawnDroppedItem(bx, by, bz, B.RAW_FISH); spawnDroppedItem(bx, by, bz, B.IRON_INGOT); }
      else if (mob.type === 'guardian') { spawnDroppedItem(bx, by, bz, B.SEA_LANTERN); spawnDroppedItem(bx, by, bz, B.RAW_FISH); }
      else if (mob.type === 'witch') { spawnDroppedItem(bx, by, bz, B.WATER_BREATH_POTION); spawnDroppedItem(bx, by, bz, B.GLOW_CRYSTAL); }
      else if (mob.type === 'iceologer') { spawnDroppedItem(bx, by, bz, B.PACKED_ICE); spawnDroppedItem(bx, by, bz, B.EMERALD); }
      else if (mob.type === 'ruin_stalker') { spawnDroppedItem(bx, by, bz, B.RUST_STEEL); spawnDroppedItem(bx, by, bz, B.IRON_INGOT); }
      else if (mob.type === 'gargoyle') { spawnDroppedItem(bx, by, bz, B.BASALT); spawnDroppedItem(bx, by, bz, B.LANTERN); }
      else if (mob.type === 'echo_golem' || mob.type === 'harmonizer' || mob.type === 'nightmare_stalker') { spawnDroppedItem(bx, by, bz, B.ECHO_SHARD); if (Math.random() < 0.65) spawnDroppedItem(bx, by, bz, B.ICHOR_CRYSTAL); }
      else if (mob.type === 'humbler' || mob.type === 'roamroot' || mob.type === 'ichor_ray' || mob.type === 'sky_manta') { spawnDroppedItem(bx, by, bz, Math.random() < 0.5 ? B.DREAM_FRUIT : B.ECHO_SHARD); }
      else if (mob.type === 'blub' || mob.type === 'wobble' || mob.type === 'nuzzle' || mob.type === 'trill' || mob.type === 'singer') { spawnDroppedItem(bx, by, bz, B.DREAM_FRUIT); }
      else if (mob.type === 'blaze' || mob.type === 'wildfire') { spawnDroppedItem(bx, by, bz, B.BLAZE_ROD); if (Math.random() < 0.55) spawnDroppedItem(bx, by, bz, B.BLAZE_ROD); spawnDroppedItem(bx, by, bz, B.MAGMA_CORE); if (mob.type === 'wildfire') spawnDroppedItem(bx, by, bz, B.GOLD_INGOT); }
      else if (mob.type === 'ghast' || mob.type === 'baby_ghast') {
        spawnDroppedItem(bx, by, bz, B.GHAST_TEAR, { count: 1 + ((Math.random() * 2) | 0) });
        spawnDroppedItem(bx, by, bz, B.GUNPOWDER);
      }
      else if (mob.type === 'copper_golem') { spawnDroppedItem(bx, by, bz, B.COPPER_INGOT); spawnDroppedItem(bx, by, bz, B.COPPER_INGOT); }
      else if (mob.type === 'tuff_golem') { spawnDroppedItem(bx, by, bz, B.STONE); spawnDroppedItem(bx, by, bz, B.FLOWER_RED); }
      else if (mob.type === 'moobloom' || mob.type === 'wooly_cow') { const bf = mob.burning ? B.COOKED_BEEF : B.RAW_BEEF; spawnDroppedItem(bx, by, bz, bf); spawnDroppedItem(bx, by, bz, B.FLOWER_YELLOW); }
      else if (mob.type === 'cluckshroom') { spawnDroppedItem(bx, by, bz, mob.burning ? B.COOKED_CHICKEN : B.RAW_CHICKEN); }
      else if (mob.type === 'zombified_piglin') { spawnDroppedItem(bx, by, bz, B.GOLD_INGOT); }
      else if (mob.type === 'wither_skeleton') { spawnDroppedItem(bx, by, bz, B.COAL, { count: 2 }); if (Math.random() < 0.85) spawnDroppedItem(bx, by, bz, B.BONE, { count: Math.random() < 0.45 ? 2 : 1 }); }
      else if (mob.type === 'shulker') { spawnDroppedItem(bx, by, bz, B.PURPUR_BLOCK); spawnDroppedItem(bx, by, bz, B.VOID_PEARL); }
      else if (mob.type === 'wither_knight') { spawnDroppedItem(bx, by, bz, B.COAL, { count: 2 }); spawnDroppedItem(bx, by, bz, B.GOLD_INGOT); }
      else if (mob.type === 'iron_golem') { spawnDroppedItem(bx, by, bz, B.IRON_INGOT); spawnDroppedItem(bx, by, bz, B.IRON_INGOT); spawnDroppedItem(bx, by, bz, B.FLOWER_RED); }
      else if (mob.type === 'slime') { spawnDroppedItem(bx, by, bz, B.MUSHROOM_GLOW); }
      else if (mob.type === 'sulfur_slime') {
        spawnDroppedItem(bx, by, bz, B.SULFUR_SLIMEBALL, { count: 1 + (Math.random() < 0.55 ? 1 : 0) });
        if (Math.random() < 0.65) spawnDroppedItem(bx, by, bz, B.SULFUR_POWDER);
      }
      else if (mob.type === 'phantom_drake') { spawnDroppedItem(bx, by, bz, B.GLOW_CRYSTAL); spawnDroppedItem(bx, by, bz, B.ARROW); }
      else if (mob.type === 'cow' || mob.type === 'bison' || mob.type === 'yak' || mob.type === 'sika_deer' || mob.type === 'deer' || mob.type === 'antler_deer' || mob.type === 'moose') {
        const beef = mob.burning ? B.COOKED_BEEF : B.RAW_BEEF;
        spawnDroppedItem(bx, by, bz, beef); if (Math.random() < 0.7) spawnDroppedItem(bx, by, bz, beef);
      }
      else if (mob.type === 'pig' || mob.type === 'boar') {
        const pork = mob.burning ? B.COOKED_PORK : B.RAW_PORK;
        spawnDroppedItem(bx, by, bz, pork); if (Math.random() < 0.65) spawnDroppedItem(bx, by, bz, pork);
      }
      else if (mob.type === 'sheep' || mob.type === 'goat' || mob.type === 'alpaca' || mob.type === 'llama') {
        const mut = mob.burning ? B.COOKED_MUTTON : B.RAW_MUTTON;
        spawnDroppedItem(bx, by, bz, mut); if (Math.random() < 0.6) spawnDroppedItem(bx, by, bz, mut);
        if (mob.type === 'sheep') {
          const woolDrop = mob.woolBlockId || B.WHITE_WOOL;
          spawnDroppedItem(bx, by, bz, woolDrop);
          if (Math.random() < 0.45) spawnDroppedItem(bx, by, bz, woolDrop);
        }
      }
      else if (mob.type === 'chicken' || mob.type === 'duck' || mob.type === 'turkey' || mob.type === 'goose') {
        spawnDroppedItem(bx, by, bz, mob.burning ? B.COOKED_CHICKEN : B.RAW_CHICKEN);
      }
      else if (mob.type === 'rabbit_brown' || mob.type === 'snow_hare' || mob.type === 'rabbit') {
        spawnDroppedItem(bx, by, bz, mob.burning ? B.COOKED_RABBIT : B.RAW_RABBIT);
      }
      else if (mob.type === 'skeleton' || mob.type === 'stray' || mob.type === 'desert_skeleton' || mob.type === 'bogged' || mob.type === 'spider_jockey') { spawnDroppedItem(bx, by, bz, B.ARROW); if (Math.random() < 0.85) spawnDroppedItem(bx, by, bz, B.BONE, { count: Math.random() < 0.45 ? 2 : 1 }); if (Math.random() < 0.28) spawnDroppedItem(bx, by, bz, B.BOW); }
      else if ((mob.type === 'zombie' || mob.type === 'husk' || mob.type === 'frozen_zombie' || mob.type === 'mossy_zombie' || mob.type === 'chicken_jockey') && Math.random() < 0.65) spawnDroppedItem(bx, by, bz, Math.random() < 0.25 ? B.CARROT : (Math.random() < 0.35 ? B.POTATO : B.IRON_INGOT));
      else if (mob.aqua) spawnDroppedItem(bx, by, bz, mob.burning ? (Math.random() < 0.45 ? B.COOKED_SALMON : B.COOKED_FISH) : (Math.random() < 0.45 ? B.RAW_SALMON : B.RAW_FISH));
      else if (!mob.hostile && !mob.villager && !mob.guardian) spawnDroppedItem(bx, by, bz, mob.burning ? B.COOKED_PORK : B.RAW_PORK);
      markMobDefeated(mob, currentDimension);
      if (mob.uid) {
        _mobNetLastSent.delete(mob.uid);
        if (activeRoomId && typeof isSimAuthority === 'function' && isSimAuthority() && _mobNetRemQueue.length < 64) _mobNetRemQueue.push(mob.uid);
      }
      if (activeRoomId && typeof broadcastMobRemove === 'function') broadcastMobRemove(mob.uid);
      disposeMobInstance(mob);
      const idx = mobs.indexOf(mob); if (idx !== -1) { mobs[idx] = mobs[mobs.length - 1]; mobs.pop(); }
      return true;
    }
    if ((mob.type === 'void_stalker' || mob.type === 'enderman') && Math.random() < 0.6) {
      spawnParticles(mob.x, mob.y + 1.4, mob.z, 0xd946ef, 12, true);
      const ang = Math.random() * Math.PI * 2, d = 6 + Math.random() * 4;
      const nx = player.x + Math.cos(ang) * d, nz = player.z + Math.sin(ang) * d;
      for (let y = Math.floor(player.y) + 6; y >= Math.floor(player.y) - 6; y--) {
        if (isSolidAt(Math.floor(nx), y, Math.floor(nz)) && !isSolidAt(Math.floor(nx), y + 1, Math.floor(nz)) && !isSolidAt(Math.floor(nx), y + 3, Math.floor(nz))) {
          mob.x = nx; mob.y = y + 1; mob.z = nz; playSfx('warp'); spawnParticles(mob.x, mob.y + 1.4, mob.z, 0xd946ef, 12, true); break;
        }
      }
    }
    return false;
  }

  let _mobNetSyncAccum = 0;
  let _mobNetSeq = 0, _mobNetLastSyncMs = 0, _mobNetKeyframeMs = 0;
  let _mobNetLastDim = '', _mobNetLastRoom = '';
  const _mobNetLastSent = new Map();
  const _mobNetRemQueue = [];
  const _pendingRemoteMobSpawns = new Map();
  let _lastGuestMobSeq = -1;
  const _mobSampleOut = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, spd: 0 };
  function resetMobNetSyncCache() {
    _mobNetLastSent.clear();
    _mobNetKeyframeMs = 0;
    _mobNetRemQueue.length = 0;
    _pendingRemoteMobSpawns.clear();
    _lastGuestMobSeq = -1;
  }
  const _mobNetPeersScratch = [];
  const _mobNetCandsScratch = [];
  const _mobNetSeenScratch = new Set();
  const _mobNetByUidScratch = new Map();
  function _mobQ2(v) { return Math.round(v * 100) / 100; }
  function serializeMobsForNet(dim = currentDimension, opts = null) {
    const full = !(opts && opts.delta);
    const dOff = depthOffset || 0;
    _mobNetPeersScratch.length = 0;
    if (typeof remotePlayers !== 'undefined' && remotePlayers) {
      for (const rp of remotePlayers.values()) {
        if (rp && !rp.isBuddy && (rp.dim || 'overworld') === dim) _mobNetPeersScratch.push(rp);
      }
    }
    _mobNetCandsScratch.length = 0;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m || m._dead || !m.uid) continue;
      let minD2 = (m.x - player.x) * (m.x - player.x) + (m.z - player.z) * (m.z - player.z);
      for (let pi = 0; pi < _mobNetPeersScratch.length; pi++) {
        const rp = _mobNetPeersScratch[pi];
        const pd2 = (m.x - rp.x) * (m.x - rp.x) + (m.z - rp.z) * (m.z - rp.z);
        if (pd2 < minD2) minD2 = pd2;
      }
      const prio = (m.tamed || m.isBoss || IS_DRAGON_MOB.has(m.type)) ? 0 : 1;
      _mobNetCandsScratch.push({ m, prio, minD2 });
    }
    if (_mobNetCandsScratch.length > 64) _mobNetCandsScratch.sort((a, b) => (a.prio - b.prio) || (a.minD2 - b.minD2));
    const lim = Math.min(64, _mobNetCandsScratch.length);
    if (full) _mobNetSeenScratch.clear();
    const out = [];
    for (let i = 0; i < lim; i++) {
      const cand = _mobNetCandsScratch[i];
      const m = cand.m;
      if (full) _mobNetSeenScratch.add(m.uid);
      const x = _mobQ2(m.x), ty = _mobQ2(m.y - dOff), z = _mobQ2(m.z);
      const yw = Math.round((m.yaw || 0) * 1000) / 1000;
      const hp = Math.max(0, Math.ceil(m.hp));
      const vx = _mobQ2(m._netVx || 0), vy = _mobQ2(m._netVy || 0), vz = _mobQ2(m._netVz || 0);
      const og = m.onGround === false ? 0 : 1;
      const fp = (m.flying && Math.abs(m._flyPitch || 0) >= 0.02) ? _mobQ2(m._flyPitch) : 0;
      const br = m.burning ? 1 : 0, tm = m.tamed ? 1 : 0, st = m.sitting ? 1 : 0, fl = m.flying ? 1 : 0;
      const fs = m.fusing ? 1 : 0;
      const ak = _mobQ2(m.atkAnimT || 0), hf = _mobQ2(m.hurtFlash || 0);
      const sd = m.saddled ? 1 : 0;
      const ds = (m.elemDragon && m.dragonStage !== undefined && m.dragonStage !== 4) ? m.dragonStage : 4;
      const ow = (m.tamed && m.ownerPeerId) ? String(m.ownerPeerId) : '';
      const moving = (Math.abs(vx) >= 0.04 || Math.abs(vy) >= 0.04 || Math.abs(vz) >= 0.04);

      if (!full) {
        const prev = _mobNetLastSent.get(m.uid);
        if (prev) {
          let dYw = ((yw - prev.yw + Math.PI) % (Math.PI * 2)) - Math.PI;
          if (dYw < -Math.PI) dYw += Math.PI * 2;
          // Far-away mobs (>42 blocks from every player) only send coarse position deltas to keep MP bandwidth & FPS crisp
          const posEps = cand.minD2 > 1764 ? 0.35 : 0.02;
          const rotEps = cand.minD2 > 1764 ? 0.14 : 0.03;
          const changed = Math.abs(x - prev.x) > posEps || Math.abs(ty - prev.ty) > posEps || Math.abs(z - prev.z) > posEps
            || Math.abs(dYw) > rotEps || (prev.moving && !moving) || (moving && cand.minD2 <= 1764)
            || prev.hp !== hp || prev.br !== br || prev.tm !== tm || prev.st !== st || prev.fl !== fl || prev.fs !== fs
            || prev.og !== og || prev.sd !== sd || prev.ds !== ds || prev.ow !== ow
            || (ak > 0 && prev.ak !== ak) || (hf > 0 && prev.hf !== hf) || (prev.ak > 0 && ak === 0) || (prev.hf > 0 && hf === 0);
          if (!changed) continue;
        }
      }
      const prevRec = _mobNetLastSent.get(m.uid);
      if (prevRec) {
        prevRec.x = x; prevRec.ty = ty; prevRec.z = z; prevRec.yw = yw; prevRec.hp = hp;
        prevRec.br = br; prevRec.tm = tm; prevRec.st = st; prevRec.fl = fl; prevRec.fs = fs; prevRec.og = og;
        prevRec.sd = sd; prevRec.ds = ds; prevRec.ow = ow; prevRec.ak = ak; prevRec.hf = hf; prevRec.moving = moving;
      } else {
        _mobNetLastSent.set(m.uid, { x, ty, z, yw, hp, br, tm, st, fl, fs, og, sd, ds, ow, ak, hf, moving });
      }
      const item = { uid: m.uid, t: m.type, x, ty, z, yw, hp };
      const baseHp = MOB_STATS[m.type] ? MOB_STATS[m.type].hp : 0;
      if (m.maxHp && m.maxHp !== baseHp) item.mh = m.maxHp;
      if (Math.abs(vx) >= 0.04) item.vx = vx;
      if (Math.abs(vy) >= 0.04) item.vy = vy;
      if (Math.abs(vz) >= 0.04) item.vz = vz;
      if (og === 0) item.og = 0;
      if (fp !== 0) item.fp = fp;
      if (br) item.br = 1;
      if (tm) item.tm = 1;
      if (st) item.st = 1;
      if (fl) item.fl = 1;
      if (fs) item.fs = 1;
      if (ow) item.ow = ow;
      if (m.woolColor) item.wc = m.woolColor;
      if (m.villagerProf) item.vp = m.villagerProf.idx;
      if (ak > 0) item.ak = ak;
      if (hf > 0) item.hf = hf;
      if (ds !== 4) item.ds = ds;
      if (sd) item.sd = 1;
      if (m.dragonArmor) item.da = m.dragonArmor;
      out.push(item);
    }
    if (full) {
      for (const k of _mobNetLastSent.keys()) if (!_mobNetSeenScratch.has(k)) _mobNetLastSent.delete(k);
    }
    return out;
  }

  function _applySyncedRemoteMobProps(m, it, fpIn, vyIn) {
    if (!m) return;
    if (typeof it.hp === 'number') m.hp = it.hp;
    if (typeof it.mh === 'number' && it.mh > 0) m.maxHp = it.mh;
    m.burning = !!it.br; m.tamed = !!it.tm; m.sitting = !!it.st; m.flying = !!it.fl;
    const wasFusing = !!m.fusing;
    m.fusing = !!it.fs;
    if (m.fusing && !wasFusing && Math.hypot(m.x - player.x, m.z - player.z) < 22) playSfx('hiss');
    if (!m.fusing && wasFusing && m.group) { m.fuseTimer = 0; m.group.scale.set(1, 1, 1); }
    if (m.tamed) m.hostile = false;
    if (it.ow) m.ownerPeerId = String(it.ow);
    m.onGround = (it.og !== 0);
    m._flyPitch = fpIn;
    m.vy = vyIn;
    if (m.tamed && !m.elemDragon && !m.petTag && m.group) {
      const petTag = makeNameTagSprite(`♥ ${m.displayName}`, '#f472b6');
      petTag.position.set(0, m.hitboxH + 0.65, 0);
      m.group.add(petTag); m.petTag = petTag;
    }
    if (m.elemDragon) {
      m.saddled = !!it.sd;
      m.dragonArmor = it.da ? { ...it.da } : null;
      _applyDragonArmorToAnim(m.anim, m.dragonArmor, !!m.saddled);
    }
    if ((it.ak || 0) > (m.atkAnimT || 0)) m.atkAnimT = it.ak;
    if ((it.hf || 0) > (m.hurtFlash || 0)) { m.hurtFlash = it.hf; playMobSfx(m.type, 'hurt'); }
    if (m.hp < m.maxHp) { updateMobHpBar(m, m.hp / m.maxHp); m.hpBarTimer = 3.0; }
  }
  function _spawnSyncedRemoteMob(it, wy, vxIn, vyIn, vzIn, yawIn, fpIn, senderTs, pktSeq, nowMs, dOff) {
    const opts = { uid: it.uid };
    if (it.wc && typeof WOOL_COLORS !== 'undefined') opts.woolSpec = WOOL_COLORS.find(w => w.key === it.wc) || null;
    if (typeof it.vp === 'number' && it.vp >= 0) opts.profIdx = it.vp;
    if (it.tm) { opts.tamed = true; opts.ownerPeerId = it.ow || ''; opts.dragonStage = it.ds !== undefined ? it.ds : 4; opts.saddled = !!it.sd; opts.dragonArmor = it.da ? { ...it.da } : null; }
    const m = spawnMobOfType(it.t, it.x, wy, it.z, opts);
    if (!m) return null;
    if (m.tamed) _attachPetNameTag(m);
    m.yaw = yawIn; m.ryaw = yawIn;
    m.rx = it.x; m.ry = wy; m.rz = it.z;
    m._netTx = it.x; m._netTy = wy; m._netTz = it.z; m._netTyaw = yawIn;
    m._netBuf = createNetInterp(95);
    const hasTy = (typeof it.ty === 'number' && Number.isFinite(it.ty));
    pushNetSnap(m._netBuf, {
      seq: pktSeq, ts: senderTs, x: it.x, y: wy, ty: hasTy ? it.ty : undefined, z: it.z,
      vx: vxIn, vy: vyIn, vz: vzIn, yaw: yawIn, pitch: fpIn, spd: Math.hypot(vxIn, vzIn)
    }, nowMs, dOff);
    m._netBuf.lastOutX = m.x; m._netBuf.lastOutY = m.y; m._netBuf.lastOutZ = m.z;
    m._netBuf.hasOut = true;
    _applySyncedRemoteMobProps(m, it, fpIn, vyIn);
    return m;
  }

  function applyRemoteMobSync(list, dim = currentDimension, fullReset = false, meta = null) {
    if (!Array.isArray(list)) return;
    if (dim && dim !== currentDimension) { _pendingRemoteMobSpawns.clear(); return; }
    if (meta && typeof meta.seq === 'number' && !fullReset) {
      if (_lastGuestMobSeq >= 0 && meta.seq <= _lastGuestMobSeq && (_lastGuestMobSeq - meta.seq) < 1000) return;
      _lastGuestMobSeq = meta.seq;
    } else if (meta && typeof meta.seq === 'number') {
      _lastGuestMobSeq = meta.seq;
    }
    if (meta && Array.isArray(meta.rm)) {
      for (let ri = 0; ri < meta.rm.length; ri++) applyRemoteMobRemove(meta.rm[ri]);
    }
    const dOff = depthOffset || 0;
    const nowMs = performance.now();
    const senderTs = (meta && typeof meta.ts === 'number' && Number.isFinite(meta.ts)) ? meta.ts : nowMs;
    const pktSeq = (meta && typeof meta.seq === 'number') ? meta.seq : undefined;
    _mobNetByUidScratch.clear();
    for (let i = 0; i < mobs.length; i++) {
      const mb = mobs[i];
      if (mb && !mb._dead && mb.uid) _mobNetByUidScratch.set(mb.uid, mb);
    }
    if (fullReset) _mobNetSeenScratch.clear();
    const seen = fullReset ? _mobNetSeenScratch : null;
    let spawnedNow = 0;
    const spawnBudget = (typeof isWorldLoading !== 'undefined' && isWorldLoading) ? 64 : 3;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!it || !it.uid || !it.t) continue;
      if (seen) seen.add(it.uid);
      const hasTy = (typeof it.ty === 'number' && Number.isFinite(it.ty));
      const wy = hasTy ? (it.ty + dOff) : 14;
      const vxIn = typeof it.vx === 'number' ? it.vx : 0;
      const vyIn = typeof it.vy === 'number' ? it.vy : 0;
      const vzIn = typeof it.vz === 'number' ? it.vz : 0;
      const yawIn = it.yw || 0;
      const fpIn = typeof it.fp === 'number' ? it.fp : 0;
      let m = _mobNetByUidScratch.get(it.uid);
      if (!m) {
        if (spawnedNow < spawnBudget) {
          _pendingRemoteMobSpawns.delete(it.uid);
          _spawnSyncedRemoteMob(it, wy, vxIn, vyIn, vzIn, yawIn, fpIn, senderTs, pktSeq, nowMs, dOff);
          spawnedNow++;
        } else {
          _pendingRemoteMobSpawns.set(it.uid, { it, wy, vxIn, vyIn, vzIn, yawIn, fpIn, senderTs, pktSeq, nowMs });
        }
        continue;
      }
      _pendingRemoteMobSpawns.delete(it.uid);
      m._netTx = it.x; m._netTy = wy; m._netTz = it.z; m._netTyaw = yawIn;
      if (!m._netBuf) {
        m._netBuf = createNetInterp(95);
        m._netBuf.lastOutX = m.x; m._netBuf.lastOutY = m.y; m._netBuf.lastOutZ = m.z;
        m._netBuf.hasOut = true;
      }
      pushNetSnap(m._netBuf, {
        seq: pktSeq, ts: senderTs, x: it.x, y: wy, ty: hasTy ? it.ty : undefined, z: it.z,
        vx: vxIn, vy: vyIn, vz: vzIn, yaw: yawIn, pitch: fpIn, spd: Math.hypot(vxIn, vzIn)
      }, nowMs, dOff);
      _applySyncedRemoteMobProps(m, it, fpIn, vyIn);
    }
    if (fullReset && seen) {
      for (const pUid of _pendingRemoteMobSpawns.keys()) {
        if (!seen.has(pUid)) _pendingRemoteMobSpawns.delete(pUid);
      }
      for (let i = mobs.length - 1; i >= 0; i--) {
        const mb = mobs[i];
        if (!mb || mb._dead || (player.ridingDragon === mb) || mb.tamed) continue;
        if (!mb.uid || !seen.has(mb.uid)) {
          disposeMobInstance(mb);
          mobs[i] = mobs[mobs.length - 1]; mobs.pop();
        }
      }
    }
  }

  let dimSavedMobs = Object.create(null);
  const dimVisitedSpawned = new Set();
  const defeatedMobTags = new Set();

  function markMobDefeated(mob, dim = currentDimension) {
    if (!mob) return;
    if (mob.spawnTag) defeatedMobTags.add(mob.spawnTag);
    if (mob.isBoss) {
      defeatedMobTags.add(`${dim}:boss:${mob.type}`);
      if (mob.type === 'ender_dragon') defeatedMobTags.add('end:ender_dragon');
      else if (mob.type === 'sovereign_end_dragon') defeatedMobTags.add('dragon_realm:sovereign_end_dragon');
      else if (mob.type === 'sculk_soul_ravager') defeatedMobTags.add('warden:sculk_soul_ravager');
    }
    if (typeof mob.nestIdx === 'number') {
      defeatedMobTags.add('nest:' + mob.nestIdx);
      spawnedDragonNests.add(mob.nestIdx);
    }
  }
  function isMobDefeatedTag(tag) { return !!(tag && defeatedMobTags.has(tag)); }
  function hasDimVisited(key) { return !!(key && dimVisitedSpawned.has(key)); }
  function markDimVisited(key) { if (key) dimVisitedSpawned.add(key); }

  function serializeMobsForSave(maxCount = 48, opts = null) {
    const dOff = depthOffset || 0;
    const includeTamedDragons = !!(opts && opts.includeTamedDragons);
    const cands = [];
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m || m._dead || m._dyingT > 0 || m._deathFinal) continue;
      if (!includeTamedDragons && m.tamed && m.elemDragon) continue;
      const prio = (m.isBoss || IS_DRAGON_MOB.has(m.type)) ? 0 : (m.spawnTag ? 1 : (m.tamed ? 2 : ((m.villager || m.guardian) ? 3 : 4)));
      const d2 = (m.x - player.x) * (m.x - player.x) + (m.z - player.z) * (m.z - player.z);
      cands.push({ m, prio, d2 });
    }
    cands.sort((a, b) => (a.prio - b.prio) || (a.d2 - b.d2));
    const out = [];
    for (let i = 0; i < cands.length && out.length < maxCount; i++) {
      const m = cands[i].m;
      const item = {
        t: m.type,
        x: +m.x.toFixed(2),
        ty: +(m.y - dOff).toFixed(2),
        z: +m.z.toFixed(2),
        yw: +m.yaw.toFixed(3),
        hp: Math.max(1, Math.ceil(m.hp))
      };
      if (m.uid) item.uid = m.uid;
      if (m.spawnTag) item.tag = m.spawnTag;
      if (m.ruinId) item.rid = m.ruinId;
      if (m.maxHp && m.maxHp !== MOB_STATS[m.type]?.hp) item.mh = m.maxHp;
      if (m.tamed) item.tm = 1;
      if (m.sitting) item.st = 1;
      if (m.flying) item.fl = 1;
      if (m.woolColor) item.wc = m.woolColor;
      if (m.villagerProf) item.vp = m.villagerProf.idx;
      if (m.ownerPeerId) item.ow = String(m.ownerPeerId);
      if (m.saddled) item.sd = 1;
      if (typeof m.growth === 'number') item.gr = Math.round(m.growth);
      if (m.gender) item.gn = m.gender;
      if (m.dragonArmor) item.da = { ...m.dragonArmor };
      if (typeof m.homeX === 'number') {
        item.hx = +m.homeX.toFixed(2);
        item.hy = +((m.homeY !== undefined ? m.homeY : m.y) - dOff).toFixed(2);
        item.hz = +m.homeZ.toFixed(2);
        if (typeof m.homeRadius === 'number') item.hr = m.homeRadius;
      }
      if (typeof m.nestIdx === 'number') item.ni = m.nestIdx;
      if (m.dragonStage !== undefined) item.ds = m.dragonStage;
      if (m.dragonMode) item.dm = m.dragonMode;
      out.push(item);
    }
    return out;
  }

  function restoreMobsFromSave(list) {
    if (!Array.isArray(list)) return;
    const dOff = depthOffset || 0;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!it || !it.t) continue;
      if (it.tag && defeatedMobTags.has(it.tag)) continue;
      if (typeof it.ni === 'number' && defeatedMobTags.has('nest:' + it.ni)) continue;
      const known = (typeof ANIMAL_MAP !== 'undefined' && ANIMAL_MAP.has(it.t)) || !!MOB_STATS[it.t];
      if (!known) continue;
      const wx = Number.isFinite(it.x) ? it.x : player.x;
      const wz = Number.isFinite(it.z) ? it.z : player.z;
      const wy = (typeof it.ty === 'number' && Number.isFinite(it.ty)) ? (it.ty + dOff) : (player.y + 1.2);
      const opts = { silent: true, fromSave: true };
      if (it.uid) opts.uid = it.uid;
      if (it.tag) opts.spawnTag = it.tag;
      if (it.rid) opts.ruinId = it.rid;
      if (it.tm) opts.tamed = true;
      if (it.st) opts.sitting = true;
      if (it.ow) opts.ownerPeerId = String(it.ow);
      if (it.sd) opts.saddled = true;
      if (it.gn) opts.gender = it.gn;
      if (it.da && typeof it.da === 'object') opts.dragonArmor = { ...it.da };
      if (it.wc && typeof WOOL_COLORS !== 'undefined') opts.woolSpec = WOOL_COLORS.find(w => w.key === it.wc) || null;
      if (typeof it.vp === 'number' && it.vp >= 0) opts.profIdx = it.vp;
      if (typeof it.hx === 'number' && typeof it.hz === 'number') {
        opts.homeX = it.hx;
        opts.homeY = (typeof it.hy === 'number' ? it.hy : (wy - dOff)) + dOff;
        opts.homeZ = it.hz;
        if (typeof it.hr === 'number') opts.homeRadius = it.hr;
      }
      if (typeof it.ni === 'number') { opts.nestIdx = it.ni; spawnedDragonNests.add(it.ni); }
      if (it.ds !== undefined) opts.dragonStage = it.ds;
      const m = spawnMobOfType(it.t, wx, wy, wz, opts);
      if (!m) continue;
      if (typeof it.yw === 'number' && Number.isFinite(it.yw)) {
        m.yaw = it.yw;
        m.ryaw = it.yw;
        if (m.group) m.group.rotation.y = it.yw;
      }
      m.rx = m.x; m.ry = m.y; m.rz = m.z;
      if (typeof it.mh === 'number' && it.mh > 0) m.maxHp = it.mh;
      if (typeof it.hp === 'number' && it.hp > 0) m.hp = Math.min(m.maxHp, it.hp);
      if (it.dm) m.dragonMode = it.dm;
      if (it.fl !== undefined) m.flying = !!it.fl;
      if (typeof it.gr === 'number') m.growth = it.gr;
      if (m.tamed && m.elemDragon) rebuildDragonStageMesh(m);
      else if (m.tamed) _attachPetNameTag(m);
      if (m.hp < m.maxHp) { updateMobHpBar(m, m.hp / m.maxHp); m.hpBarTimer = 3.0; }
    }
    if (currentDimension === 'end') _endCrystalScanT = 0;
  }

  function snapshotDimensionMobs(dim = currentDimension) {
    if (!dim) return;
    if (typeof player !== 'undefined' && player && player.ridingDragon) {
      if (typeof detachRiderFromDragon === 'function') detachRiderFromDragon();
      player.ridingDragon = null;
      player.sitting = false;
    }
    dimSavedMobs[dim] = serializeMobsForSave(80, { includeTamedDragons: true });
    if (dim !== 'overworld') dimVisitedSpawned.add(dim);
  }

  function restoreDimensionMobs(dim = currentDimension) {
    if (!dim || !Array.isArray(dimSavedMobs[dim])) return false;
    restoreMobsFromSave(dimSavedMobs[dim]);
    return true;
  }

  function serializeDimMobPersistence() {
    const dimMobs = {};
    for (const k of Object.keys(dimSavedMobs)) {
      if (k === currentDimension) continue;
      if (Array.isArray(dimSavedMobs[k])) dimMobs[k] = dimSavedMobs[k].slice(0, 40);
    }
    return {
      dimMobs,
      visitedDims: Array.from(dimVisitedSpawned),
      defeatedTags: Array.from(defeatedMobTags)
    };
  }

  function restoreDimMobPersistence(obj) {
    dimSavedMobs = Object.create(null);
    dimVisitedSpawned.clear();
    defeatedMobTags.clear();
    if (!obj || typeof obj !== 'object') return;
    if (obj.dimMobs && typeof obj.dimMobs === 'object') {
      for (const k of Object.keys(obj.dimMobs)) {
        if (Array.isArray(obj.dimMobs[k])) dimSavedMobs[k] = obj.dimMobs[k];
      }
    }
    if (Array.isArray(obj.visitedDims)) {
      for (const v of obj.visitedDims) if (typeof v === 'string') dimVisitedSpawned.add(v);
    }
    if (Array.isArray(obj.defeatedTags)) {
      for (const t of obj.defeatedTags) if (typeof t === 'string') defeatedMobTags.add(t);
    }
  }

  function resetDimMobPersistence() {
    dimSavedMobs = Object.create(null);
    dimVisitedSpawned.clear();
    defeatedMobTags.clear();
  }

  function spawnFallbackDimMobs() {
    if (hasDimVisited(currentDimension)) return;
    if (currentDimension === 'end' && Math.hypot(player.x, player.z) < 180) {
      if (isMobDefeatedTag('end:ender_dragon') || isMobDefeatedTag('end:boss:ender_dragon')) return;
      const landY = Math.max(8, getTerrainHeight(0, 18, BIOMES.THE_END));
      const ed = spawnMobOfType('ender_dragon', 0.5, landY + 15.0, -10.0, { silent: true, spawnTag: 'end:ender_dragon' });
      if (ed) { ed.homeX = 0.5; ed.homeY = landY + 15.0; ed.homeZ = 0.5; ed.homeRadius = 34; }
    } else if (currentDimension === 'dragon_realm') {
      const safeY = (wx, wz) => (typeof _getSafeDragonSkyY === 'function') ? _getSafeDragonSkyY(wx, wz, 16) : Math.max(24, getTerrainHeight(Math.floor(wx), Math.floor(wz), getBiomeAt(Math.floor(wx), Math.floor(wz))) + 16);
      if (!isMobDefeatedTag('dragon_realm:void_end_dragon')) spawnMobOfType('void_end_dragon', -28, safeY(-28, 42), 42, { silent: true, spawnTag: 'dragon_realm:void_end_dragon' });
      if (!isMobDefeatedTag('dragon_realm:amethyst_end_dragon')) spawnMobOfType('amethyst_end_dragon', 30, safeY(30, 54), 54, { silent: true, spawnTag: 'dragon_realm:amethyst_end_dragon' });
      if (!isMobDefeatedTag('dragon_realm:sovereign_end_dragon') && !isMobDefeatedTag('dragon_realm:boss:sovereign_end_dragon')) {
        const sovY = safeY(0.5, 136.5);
        spawnMobOfType('sovereign_end_dragon', 0.5, sovY, 136.5, { homeX: 0.5, homeY: sovY, homeZ: 136.5, homeRadius: 52, silent: true, spawnTag: 'dragon_realm:sovereign_end_dragon' });
      }
    }
  }

  function applyRemoteMobHit(msg) {
    if (!msg || !msg.uid || (typeof isSimAuthority === 'function' && !isSimAuthority())) return;
    const m = mobs.find(mb => mb && !mb._dead && mb.uid === msg.uid);
    if (!m) return;
    hurtMob(m, Number(msg.dmg) || 1, Number(msg.kx) || 0, Number(msg.kz) || 0, Number(msg.ky) || 4.2, !!msg.isFire, true, { _fromAuth: true });
  }

  function _attachPetNameTag(m) {
    if (!m || m.elemDragon || m.petTag || !m.group || typeof makeNameTagSprite !== 'function') return;
    const petTag = makeNameTagSprite(`♥ ${m.displayName}`, '#f472b6');
    petTag.position.set(0, m.hitboxH + 0.65, 0);
    m.group.add(petTag); m.petTag = petTag;
  }
  function _getPetOwnerTarget(m) {
    if (m && m.ownerPeerId && typeof localPeerId !== 'undefined' && m.ownerPeerId !== localPeerId && typeof remotePlayers !== 'undefined' && remotePlayers) {
      const rp = remotePlayers.get(m.ownerPeerId);
      if (rp && !rp.isBuddy && (rp.dim || 'overworld') === currentDimension) {
        return { x: rp.x, y: rp.y, z: rp.z, dead: false, onGround: true };
      }
    }
    return player;
  }
  function applyRemoteMobAction(msg) {
    if (!msg || !msg.uid) return;
    const m = mobs.find(mb => mb && !mb._dead && mb.uid === msg.uid);
    if (!m) return;
    const p = msg.payload || {};
    if (msg.action === 'sit') {
      m.sitting = !!p.sitting;
      spawnParticles(m.x, m.y + 0.8, m.z, m.sitting ? 0x38bdf8 : 0x4ade80, 10, true);
    } else if (msg.action === 'tame') {
      m.tamed = true; m.hostile = false; m.sitting = false; m.provoked = 0;
      if (p.ownerPeerId) m.ownerPeerId = String(p.ownerPeerId);
      if (typeof p.maxHp === 'number' && p.maxHp > m.maxHp) m.maxHp = p.maxHp;
      m.hp = m.maxHp;
      _attachPetNameTag(m);
      spawnParticles(m.x, m.y + 0.85, m.z, 0xf472b6, 14, true);
    } else if (msg.action === 'heal') {
      m.hp = Math.min(m.maxHp, Number(p.hp) || m.maxHp);
      spawnParticles(m.x, m.y + 0.85, m.z, 0xf43f5e, 10, true);
    }
    _mobNetLastSent.delete(m.uid);
  }

  function applyRemoteMobRemove(uid) {
    if (!uid) return;
    _pendingRemoteMobSpawns.delete(uid);
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      if (m && m.uid === uid) {
        if (typeof m.nestIdx === 'number') spawnedDragonNests.delete(m.nestIdx);
        disposeMobInstance(m);
        mobs[i] = mobs[mobs.length - 1]; mobs.pop();
        return;
      }
    }
  }

  function getWeaponAttackCooldown(def) {
    if (!def) return 0.28; // Bare hand (fast jab)
    if (def.tool === 'sword') return 0.625;  // Authentic Minecraft 1.9+ Sword (1.6 hits/sec)
    if (def.tool === 'pick')  return 0.83;   // Authentic Minecraft Pickaxe (1.2 hits/sec)
    if (def.tool === 'shovel') return 1.00;  // Authentic Minecraft Shovel (1.0 hits/sec)
    if (def.tool === 'axe')   return 1.05;   // Authentic Minecraft Axe (heavy cleave)
    return 0.40;
  }

  function attackTargetMob(screenX = null, screenY = null) {
    if (player.ridingDragon && !player.ridingDragon._dead) {
      if (fireRiddenDragonBreath()) { startHandSwing(0.25, 'attack'); return true; }
    }
    const sel = inventory[player.selectedSlot], def = (sel && sel.count > 0) ? BLOCK_DEF[sel.id] : null;
    const cdMax = getWeaponAttackCooldown(def);
    const minSwingCdLeft = Math.max(0.08, cdMax - (def && def.tool ? 0.34 : 0.22));
    if ((player.atkCd || 0) > minSwingCdLeft) return false;
    const charge = cdMax > 0.01 ? Math.max(0.2, Math.min(1.0, 1.0 - (player.atkCd || 0) / cdMax)) : 1.0;
    player.atkCdMax = cdMax;
    player.atkCd = cdMax;
    const isSwordWpn = !!(def && def.tool === 'sword');
    if (isSwordWpn) {
      startHandSwing(0.40, 'attack');
      player.swordCombo = ((player.swordCombo || 0) % 3) + 1;
      player.comboStep = player.swordCombo - 1;
      player.swordAtkHit = ((player.swordAtkHit || 0) % 6) + 1;
      player.swordAtkSeq = (player.swordAtkSeq || 0) + 1;
      const _swClip = (typeof ROBLOX_R6_ANIMS !== 'undefined') ? ROBLOX_R6_ANIMS['rig2_sword_' + player.swordAtkHit] : null;
      player.swordAtkDur = (_swClip && _swClip.dur) ? _swClip.dur : 0.5;
      player.swordAtkT = 0;
      player.swordAtkActive = true;
      player.comboResetT = 1.40;
    } else {
      player.swordAtkActive = false;
      const _swingAct = (def && (def.tool === 'pick' || def.tool === 'axe' || def.tool === 'shovel' || def.tool === 'hoe')) ? 'mine' : 'attack';
      startHandSwing(0.36, _swingAct);
      player.comboStep = ((player.comboStep || 0) + 1) % 3;
      player.comboResetT = 0.95;
    }
    const mobHit = raycastMob(4.6, screenX, screenY);
    if (isSwordWpn) {
      playSwordSlashSfx(player.swordAtkHit || 1, !!mobHit, !!(def && def.fireDmg), !!(def && def.rainbow));
      spawnSwordSlashArc(player.swordCombo || 1, def, !!mobHit, false);
    } else if (def && (def.tool === 'axe' || def.tool === 'pick' || def.tool === 'shovel' || def.tool === 'hoe' || (B.TRIDENT && def.id === B.TRIDENT))) {
      spawnSwordSlashArc(((player.swingStep || 0) % 2) + 1, def, !!mobHit, false);
    }
    if (!mobHit) return false;
    let baseDmg = (def && def.dmg) ? def.dmg : 1.5;
    if (sel && sel.ench) baseDmg += 3.0;
    // Authentic Minecraft 1.9+ damage scaling: 0.2 + 0.8 * charge^2 (full power & crits require full recharge!)
    let dmg = Math.max(0.5, Math.round(baseDmg * (0.2 + 0.8 * charge * charge) * 10) / 10);
    const isFullCharge = charge >= 0.85;
    if (isFullCharge && !player.onGround && player.vy < -0.5) {
      dmg = Math.round(dmg * 1.4 * 10) / 10;
      spawnParticles(mobHit.x, mobHit.y + 1.2, mobHit.z, 0xfef08a, 10, true);
      playSfx('crit');
    } else {
      spawnParticles(mobHit.x, mobHit.y + 1.0, mobHit.z, (def && def.rainbow) ? 0x38e8e1 : 0xe2e8f0, 6, true);
      if (!isSwordWpn) playSfx('hurt');
    }
    if (gameMode !== 'creative') damageHeldTool(1);
    hurtMob(mobHit, dmg, mobHit.x - player.x, mobHit.z - player.z, isFullCharge ? 4.4 : 2.1, !!(def && def.fireDmg && isFullCharge), true);
    return true;
  }

  let _lastPrimaryDownMs = 0;
  function handlePrimaryActionDown() {
    const _nowMs = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (_nowMs - _lastPrimaryDownMs < 110) return;
    _lastPrimaryDownMs = _nowMs;
    if (typeof isFishingRodCast === 'function' && isFishingRodCast()) {
      if (typeof toggleFishingCast === 'function') toggleFishingCast();
      return;
    }
    if (raycastMob(4.6)) {
      attackTargetMob();
      return;
    }
    const hitB = raycastBlock();
    if (hitB && hitB.id === B.END_CRYSTAL_BLOCK) {
      startHandSwing(0.25, 'attack');
      detonateEndCrystalAt(hitB.x, hitB.y, hitB.z);
      return;
    }
    const sel = inventory[player.selectedSlot], def = (sel && sel.count > 0) ? BLOCK_DEF[sel.id] : null;
    if (hitB && def && def.tool === 'axe' && BLOCK_DEF[hitB.id]?.stripTo && typeof tryStripLogWithAxe === 'function') {
      if (tryStripLogWithAxe(hitB)) return;
    }
    if (hitB && !(gameMode === 'creative' && def && def.tool === 'sword')) {
      mining.active = true;
      mining.heldDur = 0;
      mining._didInitialSwing = false;
      return;
    }
    attackTargetMob();
  }

  // Fast voxel line-of-sight check: blocks aggro & attacks through solid walls AND closed doors!
  function hasLineOfSight(x1, y1, z1, x2, y2, z2) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.55) return true;
    const steps = Math.min(32, Math.ceil(len / 0.55));
    const ix = dx / steps, iy = dy / steps, iz = dz / steps;
    for (let s = 1; s < steps; s++) {
      const bx = Math.floor(x1 + ix * s), by = Math.floor(y1 + iy * s), bz = Math.floor(z1 + iz * s);
      const id = getBlockWorld(bx, by, bz);
      if (IS_OPAQUE[id] === 1) return false;
      // Closed doors (both lower & upper half) block mob melee/ranged line-of-sight & attacks!
      if ((BLOCK_DEF[id] && BLOCK_DEF[id].door && !doorOpenState.get(modKey(bx, by, bz))) ||
          (BLOCK_DEF[getBlockWorld(bx, by - 1, bz)] && BLOCK_DEF[getBlockWorld(bx, by - 1, bz)].door && !doorOpenState.get(modKey(bx, by - 1, bz)))) {
        return false;
      }
    }
    return true;
  }

  // Epic Ender Dragon Boss Visuals: Composite Multi-Layer Portal-Shader Healing Beam, Body-Center Glow, Death Rays, & 50-Skill Engine!
  const _bodyQ = new THREE.Quaternion();
  const _bodyInvQ = new THREE.Quaternion();
  const _bodyHitLocal = new THREE.Vector3();
  const _defBodyHalfExtents = new THREE.Vector3(0.61, 0.32, 0.38);
  function getDragonBodyCenterWorldPos(m, out) {
    if (m && m.group) m.group.updateMatrixWorld(true);
    if (m && m.anim && m.anim.bodyCenter) {
      return m.anim.bodyCenter.getWorldPosition(out);
    }
    if (m && m.anim && m.anim.bodyBone) {
      return m.anim.bodyBone.getWorldPosition(out);
    }
    return out.set(m ? m.x : 0, (m ? m.y : 0) + ((m && m.dragonScale) || 4.85) * 0.72, m ? m.z : 0);
  }
  window._getDragonBodyCenterWorldPos = getDragonBodyCenterWorldPos;

  const dragonHealBeam = (() => {
    const grp = new THREE.Group();
    const beamShaft = new THREE.Group();
    const coreU = { uTime: { value: 0 }, uLen: { value: 20 } };
    const helixU = { uTime: { value: 0 }, uLen: { value: 20 } };
    const sheathU = { uTime: { value: 0 } };
    const vShader = `varying vec2 vUv; varying vec3 vNormV, vViewDir; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vNormV = normalize(normalMatrix * normal); vViewDir = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
    const coreMat = new THREE.ShaderMaterial({
      uniforms: coreU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: vShader,
      fragmentShader: `
        uniform float uTime, uLen; varying vec2 vUv;
        void main(){
          float segs = max(8.0, floor(uLen * 2.4));
          float band = floor(vUv.y * segs - uTime * 14.0);
          float scroll = fract(vUv.y * (segs * 0.5) - uTime * 4.6);
          float px = step(0.28, scroll) * 0.65 + step(0.65, fract(vUv.x * 8.0 + band * 0.375)) * 0.35;
          vec3 c = mix(vec3(0.86, 0.34, 0.98), vec3(1.0, 0.96, 1.0), 0.55 + 0.45 * px);
          float pulse = 0.78 + 0.22 * sin(uTime * 18.0 + vUv.y * 20.0);
          gl_FragColor = vec4(c, 0.96 * pulse);
        }`
    });
    const helixMat = new THREE.ShaderMaterial({
      uniforms: helixU,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: vShader,
      fragmentShader: `
        uniform float uTime, uLen; varying vec2 vUv;
        void main(){
          float turns = max(6.0, uLen * 0.85);
          float a1 = fract(vUv.x * 2.0 + vUv.y * turns - uTime * 3.4);
          float a2 = fract(vUv.x * 2.0 - vUv.y * (turns * 0.8) + uTime * 2.7);
          float s1 = smoothstep(0.18, 0.0, abs(a1 - 0.5));
          float s2 = smoothstep(0.16, 0.0, abs(a2 - 0.5)) * 0.80;
          float strand = clamp(s1 + s2, 0.0, 1.0);
          float edge = smoothstep(0.0, 0.09, vUv.y) * smoothstep(1.0, 0.91, vUv.y);
          vec3 col = mix(vec3(0.66, 0.33, 0.97), vec3(0.98, 0.86, 1.0), strand);
          gl_FragColor = vec4(col, (0.14 + 0.82 * strand) * edge);
        }`
    });
    const sheathMat = new THREE.ShaderMaterial({
      uniforms: sheathU,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: vShader,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv; varying vec3 vNormV, vViewDir;
        void main(){
          float fres = pow(max(0.0, abs(dot(normalize(vNormV), normalize(vViewDir)))), 1.4);
          float ripple = 0.75 + 0.25 * sin(vUv.y * 22.0 - uTime * 9.0);
          float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
          vec3 col = mix(vec3(0.49, 0.13, 0.81), vec3(0.90, 0.48, 0.98), fres);
          gl_FragColor = vec4(col, 0.36 * fres * ripple * edge);
        }`
    });
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1, 10, 1, true), coreMat);
    const helixMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 1, 16, 1, true), helixMat);
    const sheathMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 1, 14, 1, true), sheathMat);
    beamShaft.add(coreMesh, helixMesh, sheathMesh);
    grp.add(beamShaft);

    const ringGeo = new THREE.TorusGeometry(0.56, 0.055, 6, 8);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf5d0fe, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
    const rings = [];
    for (let rk = 0; rk < 4; rk++) {
      const rm = new THREE.Mesh(ringGeo, ringMat);
      rm.rotation.x = Math.PI * 0.5;
      grp.add(rm);
      rings.push(rm);
    }
    const crystalFlare = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshBasicMaterial({ color: 0xfef0ff, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    grp.add(crystalFlare);
    grp.userData = { beamShaft, coreU, helixU, sheathU, rings, crystalFlare };
    grp.visible = false; grp.frustumCulled = false;
    scene.add(grp);
    return grp;
  })();

  const dragonBodyGlow = (() => {
    const grp = new THREE.Group();
    const uTime = { value: 0 }, uBoost = { value: 0.38 };
    const shellMat = new THREE.ShaderMaterial({
      uniforms: { uTime, uBoost },
      transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vN, vV, vL;
        void main() {
          vL = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime, uBoost; varying vec3 vN, vV, vL;
        void main() {
          float ndv = abs(dot(normalize(vN), normalize(vV)));
          float edgeSoft = smoothstep(0.0, 0.42, ndv);
          float fres = pow(clamp(1.0 - ndv, 0.0, 1.0), 1.35) * edgeSoft;
          float plasma = 0.5 + 0.5 * sin(vL.x * 9.0 + vL.y * 11.0 - uTime * 5.2) * cos(vL.z * 9.0 + uTime * 3.8);
          float bodyWash = (0.34 * edgeSoft + 0.92 * fres);
          vec3 c = mix(vec3(0.45, 0.14, 0.88), vec3(0.95, 0.58, 1.0), plasma * 0.65 + fres * 0.45);
          c = mix(c, vec3(1.0, 0.95, 1.0), smoothstep(0.45, 0.85, fres) * uBoost * 0.55);
          float a = clamp(bodyWash * (0.24 + 0.48 * uBoost) * (0.76 + 0.24 * plasma), 0.0, 0.78);
          gl_FragColor = vec4(c, a);
        }`
    });
    const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), shellMat);

    const coronaMat = new THREE.ShaderMaterial({
      uniforms: { uTime, uBoost },
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sx = length(vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]));
          float sy = length(vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]));
          mvCenter.xy += vec2(position.x * sx, position.y * sy);
          gl_Position = projectionMatrix * mvCenter;
        }`,
      fragmentShader: `
        uniform float uTime, uBoost; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float ang = atan(p.y, p.x);
          float rays = 0.5 + 0.5 * sin(ang * 8.0 + uTime * 2.4) * cos(ang * 4.0 - uTime * 1.7);
          float ring = exp(-pow((r - (0.48 + 0.06 * sin(uTime * 4.5))) * 8.5, 2.0));
          float core = exp(-r * 3.4);
          float halo = pow(max(0.0, 1.0 - r), 2.1);
          float lum = (core * 0.85 + halo * (0.48 + 0.34 * rays) + ring * 0.48) * (0.42 + 0.68 * uBoost);
          vec3 c = mix(vec3(0.58, 0.16, 0.94), vec3(0.96, 0.62, 1.0), clamp(core + ring * 0.5, 0.0, 1.0));
          c = mix(c, vec3(1.0, 0.96, 1.0), smoothstep(0.65, 1.0, core));
          gl_FragColor = vec4(c, clamp(lum, 0.0, 0.92));
        }`
    });
    const coronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coronaMat);
    coronaMesh.renderOrder = 6;

    const impactMat = new THREE.ShaderMaterial({
      uniforms: { uTime },
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sx = length(vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]));
          float sy = length(vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]));
          mvCenter.xy += vec2(position.x * sx, position.y * sy);
          gl_Position = projectionMatrix * mvCenter;
        }`,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float c0 = cos(uTime * 3.5), s0 = sin(uTime * 3.5);
          vec2 rp = vec2(p.x * c0 + p.y * s0, -p.x * s0 + p.y * c0);
          float star = exp(-abs(rp.x) * 14.0) * exp(-r * 2.6) + exp(-abs(rp.y) * 14.0) * exp(-r * 2.6);
          float ring = exp(-pow((r - (0.52 + 0.12 * sin(uTime * 8.0))) * 10.0, 2.0));
          float core = exp(-r * 4.8);
          float a = clamp(core * 1.15 + star * 0.85 + ring * 0.65, 0.0, 1.0);
          vec3 c = mix(vec3(0.85, 0.28, 0.96), vec3(1.0, 0.95, 1.0), clamp(core + star * 0.6, 0.0, 1.0));
          gl_FragColor = vec4(c, a);
        }`
    });
    const impactMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), impactMat);
    impactMesh.renderOrder = 7;

    grp.add(shellMesh, coronaMesh, impactMesh);
    grp.userData = { uTime, uBoost, shellMesh, coronaMesh, impactMesh };
    grp.visible = false; grp.frustumCulled = false;
    scene.add(grp);
    return grp;
  })();

  function _attachDragonDeathRays(m) {
    if (!m || !m.group || m._deathRaysGrp) return;
    const grp = new THREE.Group();
    const rayGeo = new THREE.ConeGeometry(0.55, 5.2, 6, 1, true);
    rayGeo.translate(0, 2.6, 0);
    const matA = new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const matB = new THREE.MeshBasicMaterial({ color: 0xfef0ff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 14; k++) {
      const cone = new THREE.Mesh(rayGeo, (k & 1) ? matA : matB);
      cone.rotation.set(Math.sin(k * 1.9) * 1.4, (k / 14) * Math.PI * 2, Math.cos(k * 2.3) * 1.4);
      grp.add(cone);
    }
    grp.userData = { rayGeo, matA, matB };
    const anchor = (m.anim && (m.anim.bodyCenter || m.anim.bodyBone)) || m.group;
    anchor.add(grp);
    m._deathRaysGrp = grp;
  }
  function _disposeDragonDeathRays(m) {
    if (!m || !m._deathRaysGrp) return;
    const grp = m._deathRaysGrp;
    if (grp.parent) grp.parent.remove(grp);
    if (grp.userData) {
      if (grp.userData.rayGeo) grp.userData.rayGeo.dispose();
      if (grp.userData.matA) grp.userData.matA.dispose();
      if (grp.userData.matB) grp.userData.matB.dispose();
    }
    m._deathRaysGrp = null;
  }

  const SOVEREIGN_BOSS_SKILLS = (() => {
    const archetypes = [
      { arch: 'void_beam',     col: 0xd946ef, names: ['Tia Hư Vô Khởi Nguyên', 'Chùm Tia Sụp Đổ', 'Laser Ngân Hà Tím', 'Xuyên Phá Không Gian', 'Quang Tuyến Tận Diệt'] },
      { arch: 'meteor_shower', col: 0xf43f5e, names: ['Mưa Thiên Thạch Đen', 'Thiên Thạch Purpur', 'Sao Băng Vỡ Vụn', 'Bão Đá Hư Không', 'Trời Sập Hỗn Mang'] },
      { arch: 'gravity_vortex',col: 0x8b5cf6, names: ['Hố Đen Trọng Lực', 'Vòng Xoáy Không Thời Gian', 'Lực Hút Vĩnh Hằng', 'Vực Sâu Nuốt Chửng', 'Lỗ Đen Nghịch Đảo'] },
      { arch: 'crystal_spire', col: 0xe879f9, names: ['Mũi Nhọn Pha Lê End', 'Rừng Gai Thạch Anh', 'Băng Tinh Hư Vô Trồi Lên', 'Đỉnh Nhọn Tím Biếc', 'Kết Tinh Không Gian'] },
      { arch: 'shockwave',     col: 0xc084fc, names: ['Sóng Xung Kích Long Đế', 'Cú Đập Nứt Toác', 'Gầm Vang Cửu Thiên', 'Chấn Động Hoàng Hôn End', 'Bão Áp Suất Hư Không'] },
      { arch: 'lightning_grid',col: 0x38bdf8, names: ['Thiên Lôi Phán Quyết', 'Lưới Sét Hư Vô', 'Cơn Thịnh Nộ Sấm Tím', 'Sấm Chớp Diệt Thế', 'Tia Sét Lam Tinh'] },
      { arch: 'acid_sweep',    col: 0xa855f7, names: ['Hơi Thở Axit Tối Thượng', 'Sương Mù Độc Hư Không', 'Hồ Axit Tràn Bờ', 'Hơi Thở Phân Rã', 'Cơn Mưa Độc Tố End'] },
      { arch: 'blink_dive',    col: 0xf472b6, names: ['Dịch Chuyển Bổ Nhào', 'Ảo Ảnh Đoạt Mệnh', 'Xé Rách Thực Tại Lao Xuống', 'Cú Vồ Siêu Thanh', 'Đột Kích Hư Vô'] },
      { arch: 'blade_ring',    col: 0xf0abfc, names: ['Luân Hồi Long Đao', 'Bão Kiếm Pha Lê Quay', 'Vòng Tròn Lưỡi Hái End', 'Phi Tiêu Ngân Hà', 'Mười Hai Thanh Long Kiếm'] },
      { arch: 'frost_nova',    col: 0x22d3ee, names: ['Bão Băng Hư Vô Tuyệt Đối', 'Đóng Băng Thời Không', 'Tuyết Lạnh Kết Giới', 'Hàn Khí Bất Tử', 'Vụ Nổ Băng Giá Tối Thượng'] }
    ];
    const out = [];
    let idx = 0;
    for (let a = 0; a < archetypes.length; a++) {
      for (let v = 0; v < archetypes[a].names.length; v++) {
        idx++;
        out.push({ id: idx, arch: archetypes[a].arch, col: archetypes[a].col, name: archetypes[a].names[v] });
      }
    }
    return out;
  })();
  window._NUCRAFT_SOVEREIGN_SKILLS = SOVEREIGN_BOSS_SKILLS;

  function _drawNextSovereignSkill(m) {
    if (!m._skillBag || m._skillBag.length === 0) {
      m._skillBag = [];
      for (let k = 0; k < SOVEREIGN_BOSS_SKILLS.length; k++) m._skillBag.push(k);
      for (let k = m._skillBag.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        const tmp = m._skillBag[k]; m._skillBag[k] = m._skillBag[j]; m._skillBag[j] = tmp;
      }
      if (m._lastSkillId && m._skillBag[m._skillBag.length - 1] === m._lastSkillId - 1 && m._skillBag.length > 1) {
        const tmp = m._skillBag[0]; m._skillBag[0] = m._skillBag[m._skillBag.length - 1]; m._skillBag[m._skillBag.length - 1] = tmp;
      }
    }
    const sk = SOVEREIGN_BOSS_SKILLS[m._skillBag.pop()];
    m._lastSkillId = sk.id;
    return sk;
  }

  function _execSovereignSkill(m, sk, aimX, aimY, aimZ, aimDist3D) {
    const mp = getDragonMouthWorldPos(m, _mouthPos);
    const dx = aimX - mp.x, dy = aimY - mp.y, dz = aimZ - mp.z;
    const dLen = Math.hypot(dx, dy, dz) || 1;
    m.lastSkillLabel = `👑 CHIÊU ${sk.id}/50: ${sk.name.toUpperCase()}!`;
    m.atkAnimT = 0.72; m._roarT = 1.25; playSfx('roar');
    const a = sk.arch;
    if (a === 'void_beam') {
      for (let k = -2; k <= 2; k++) {
        const sp = k * 0.08;
        const sx = (dx / dLen) * Math.cos(sp) - (dz / dLen) * Math.sin(sp);
        const sz = (dx / dLen) * Math.sin(sp) + (dz / dLen) * Math.cos(sp);
        fireEnergyOrb(mp.x, mp.y, mp.z, sx, dy / dLen, sz, 28.0, m.dmg * 0.90, 'dragon_ball', { pfxKey: 'lightning_arc', scale: 3.6, splashR: 5.5, ownerDragon: m });
      }
    } else if (a === 'meteor_shower') {
      for (let mi = 0; mi < 6; mi++) {
        const mx = aimX + (mi === 0 ? 0 : (Math.random() - 0.5) * 14);
        const mz = aimZ + (mi === 0 ? 0 : (Math.random() - 0.5) * 14);
        fireEnergyOrb(mx, aimY + 26 + mi * 2, mz, 0, -1, 0, 23.0, m.dmg * 0.95, 'dragon_ball', { pfxKey: 'explosion_ender', scale: 4.0, splashR: 7.0, gravity: 8.5, ownerDragon: m });
      }
    } else if (a === 'gravity_vortex') {
      const vxY = _getDragonGroundSurfaceY(aimX, aimY + 4, aimZ, m.dragonScale);
      spawnEnderVortex(aimX, vxY, aimZ, m.dmg * 1.15);
    } else if (a === 'crystal_spire') {
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + Math.random() * 0.4;
        const distK = 3.0 + Math.random() * 4.5;
        const sx = aimX + Math.cos(ang) * distK, sz = aimZ + Math.sin(ang) * distK;
        const sy = _getDragonGroundSurfaceY(sx, aimY + 4, sz, m.dragonScale);
        spawnPixelFx('end_crystal_burst', sx, sy + 1.4, sz, { count: 4, scale: 3.6, life: 0.65, spread: 1.4 });
        if (!player.dead && gameMode !== 'creative' && Math.hypot(player.x - sx, player.z - sz) < 4.2 && Math.abs(player.y - sy) < 6.0) {
          hurtPlayer(m.dmg * 0.85, `Bạn trúng ${sk.name} của Boss Tối Thượng!`);
        }
      }
    } else if (a === 'shockwave') {
      cameraShake = Math.max(cameraShake, 0.55);
      spawnPixelFx('explosion_ender', m.x, m.y + 1.0, m.z, { count: 7, scale: 4.4, life: 0.70, spread: 4.0 });
      if (!player.dead && gameMode !== 'creative' && aimDist3D < 20) {
        player.vy = Math.max(player.vy, 9.5);
        hurtPlayer(m.dmg * 0.95, `Bạn bị Sóng Xung Kích ${sk.name} hất văng!`);
      }
    } else if (a === 'lightning_grid') {
      for (let li = 0; li < 5; li++) {
        const lx = aimX + (li === 0 ? 0 : (Math.random() - 0.5) * 12);
        const lz = aimZ + (li === 0 ? 0 : (Math.random() - 0.5) * 12);
        const ly = _getDragonGroundSurfaceY(lx, aimY + 4, lz, m.dragonScale);
        for (let h = 0; h <= 10; h += 5) spawnPixelFx('lightning_arc', lx, ly + h + 1.2, lz, { count: 2, scale: 3.2, life: 0.52, spread: 0.5 });
        if (!player.dead && gameMode !== 'creative' && Math.hypot(player.x - lx, player.z - lz) < 4.2 && Math.abs(player.y - ly) < 6.5) {
          hurtPlayer(m.dmg * 0.80, `Bạn bị ${sk.name} giáng xuống!`);
        }
      }
    } else if (a === 'acid_sweep') {
      for (let s = -1; s <= 1; s++) {
        const cx = aimX + s * 4.5, cz = aimZ + (Math.random() - 0.5) * 4.0;
        const cy = Math.max(2, _getDragonGroundSurfaceY(cx, aimY + 4, cz, m.dragonScale));
        spawnDragonBreathCloud(cx, cy, cz, 1.55);
      }
      fireEnergyOrb(mp.x, mp.y, mp.z, dx / dLen, dy / dLen, dz / dLen, 25.0, m.dmg * 0.90, 'dragon_ball', { scale: 3.8, splashR: 6.5, effect: 'acid', ownerDragon: m });
    } else if (a === 'blink_dive') {
      m.swoopT = 2.6;
      spawnParticles(m.x, m.y + 1.8, m.z, sk.col, 28, true);
    } else if (a === 'blade_ring') {
      for (let b = 0; b < 8; b++) {
        const ang = (b / 8) * Math.PI * 2;
        fireEnergyOrb(mp.x, mp.y, mp.z, Math.cos(ang), (dy / dLen) * 0.45, Math.sin(ang), 21.0, m.dmg * 0.78, 'dragon_ball', { pfxKey: 'magic_ender', scale: 3.0, splashR: 4.8, ownerDragon: m });
      }
    } else {
      spawnPixelFx('ice_shatter', aimX, aimY + 1.0, aimZ, { count: 7, scale: 4.0, life: 0.65, spread: 3.5 });
      if (!player.dead && gameMode !== 'creative' && aimDist3D < 15) {
        player.chillT = 4.2;
        hurtPlayer(m.dmg * 0.85, `Bạn bị đóng băng bởi ${sk.name}!`);
      }
    }
    spawnParticles(mp.x, mp.y, mp.z, sk.col, 22, true);
  }
  const dragonClouds = [];
  const _cloudGeo = new THREE.CylinderGeometry(3.8, 4.1, 0.45, 12);
  const _cloudMat = new THREE.MeshBasicMaterial({ color: 0xc026d3, transparent: true, opacity: 0.36, depthWrite: false });
  function spawnDragonBreathCloud(wx, wy, wz, radScale = 1.15) {
    if (dragonClouds.length >= 6) { const old = dragonClouds.shift(); scene.remove(old.mesh); }
    const mesh = new THREE.Mesh(_cloudGeo, _cloudMat);
    mesh.position.set(wx, wy + 0.25, wz);
    mesh.scale.set(radScale, 1, radScale);
    scene.add(mesh);
    dragonClouds.push({ x: wx, y: wy, z: wz, r: 3.9 * radScale, life: 7.5, tick: 0, mesh });
  }
  const _enderVortexes = [];
  function spawnEnderVortex(wx, wy, wz, dmg = 16) {
    if (_enderVortexes.length >= 3) _enderVortexes.shift();
    _enderVortexes.push({ x: wx, y: wy, z: wz, life: 2.3, tick: 0, dmg });
    spawnPixelFx('end_crystal_burst', wx, wy + 0.8, wz, { count: 4, scale: 3.4, life: 0.60, spread: 1.8 });
  }
  const _wtL = new THREE.Vector3(), _wtR = new THREE.Vector3(), _wtFwd = new THREE.Vector3();
  const _dragonWingTrails = (() => {
    const N = 16, VERTS = (N + 1) * 2;
    const mkRibbon = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3));
      const idx = [];
      for (let i = 0; i < N; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.78, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending
      }));
      m.frustumCulled = false;
      m.visible = false;
      scene.add(m);
      return { mesh: m, pos: g.attributes.position, col: g.attributes.color, pts: Array.from({ length: N + 1 }, () => ({ x: 0, y: 0, z: 0 })) };
    };
    return { L: mkRibbon(), R: mkRibbon(), active: false, N };
  })();
  function _updateDragonWingTrails(dm, spd3D, dt) {
    const show = !!(dm && !dm._dead && dm.flying && ((dm._diveBoost || 0) > 0.10 || spd3D > 20.5));
    if (!show) {
      if (_dragonWingTrails.active) {
        _dragonWingTrails.active = false;
        _dragonWingTrails.L.mesh.visible = false;
        _dragonWingTrails.R.mesh.visible = false;
      }
      return;
    }
    dm.group.updateMatrixWorld(true);
    const sc = dm.dragonScale || 4.6;
    if (dm.anim && dm.anim.wingTipL && dm.anim.wingTipR) {
      dm.anim.wingTipL.localToWorld(_wtL.set(0, 1.55, 0));
      dm.anim.wingTipR.localToWorld(_wtR.set(0, 1.55, 0));
    } else {
      const rx = Math.cos(dm.yaw) * (2.3 * sc), rz = -Math.sin(dm.yaw) * (2.3 * sc);
      _wtL.set(dm.x + rx, dm.y + 1.2 * sc, dm.z + rz);
      _wtR.set(dm.x - rx, dm.y + 1.2 * sc, dm.z - rz);
    }
    const N = _dragonWingTrails.N;
    const boost = Math.max(0.25, dm._diveBoost || 0.35);
    const el = dm.elemDragon || 'fire';
    const tint = el === 'fire' ? [1.0, 0.62, 0.25] : (el === 'ice' ? [0.55, 0.90, 1.0] : (el === 'water' ? [0.35, 0.85, 1.0] : (el === 'earth' ? [0.98, 0.78, 0.28] : [0.58, 0.96, 0.50])));
    if (!_dragonWingTrails.active) {
      _dragonWingTrails.active = true;
      for (let i = 0; i <= N; i++) {
        _dragonWingTrails.L.pts[i].x = _wtL.x; _dragonWingTrails.L.pts[i].y = _wtL.y; _dragonWingTrails.L.pts[i].z = _wtL.z;
        _dragonWingTrails.R.pts[i].x = _wtR.x; _dragonWingTrails.R.pts[i].y = _wtR.y; _dragonWingTrails.R.pts[i].z = _wtR.z;
      }
    } else {
      for (let i = N; i >= 1; i--) {
        const pL = _dragonWingTrails.L.pts[i - 1], pR = _dragonWingTrails.R.pts[i - 1];
        _dragonWingTrails.L.pts[i].x = pL.x; _dragonWingTrails.L.pts[i].y = pL.y; _dragonWingTrails.L.pts[i].z = pL.z;
        _dragonWingTrails.R.pts[i].x = pR.x; _dragonWingTrails.R.pts[i].y = pR.y; _dragonWingTrails.R.pts[i].z = pR.z;
      }
      _dragonWingTrails.L.pts[0].x = _wtL.x; _dragonWingTrails.L.pts[0].y = _wtL.y; _dragonWingTrails.L.pts[0].z = _wtL.z;
      _dragonWingTrails.R.pts[0].x = _wtR.x; _dragonWingTrails.R.pts[0].y = _wtR.y; _dragonWingTrails.R.pts[0].z = _wtR.z;
    }
    const spanX = Math.cos(dm.yaw), spanZ = -Math.sin(dm.yaw);
    const fillRibbon = (rb) => {
      rb.mesh.visible = true;
      const pArr = rb.pos.array, cArr = rb.col.array;
      for (let i = 0; i <= N; i++) {
        const pt = rb.pts[i], t = i / N;
        const w = (1 - t) * (0.28 + 0.34 * boost);
        const fade = Math.pow(1 - t, 1.45) * Math.min(1, 0.55 + boost * 0.6);
        const sx = spanX * w, sz = spanZ * w, sy = w * 0.25;
        const vi = i * 6;
        pArr[vi] = pt.x + sx; pArr[vi + 1] = pt.y + sy; pArr[vi + 2] = pt.z + sz;
        pArr[vi + 3] = pt.x - sx; pArr[vi + 4] = pt.y - sy; pArr[vi + 5] = pt.z - sz;
        cArr[vi] = tint[0] * fade; cArr[vi + 1] = tint[1] * fade; cArr[vi + 2] = tint[2] * fade;
        cArr[vi + 3] = tint[0] * fade; cArr[vi + 4] = tint[1] * fade; cArr[vi + 5] = tint[2] * fade;
      }
      rb.pos.needsUpdate = true;
      rb.col.needsUpdate = true;
    };
    fillRibbon(_dragonWingTrails.L);
    fillRibbon(_dragonWingTrails.R);
    if ((dm._diveBoost || 0) > 0.16 && (frameCounter % 2) === 0) {
      spawnParticles(_wtL.x, _wtL.y, _wtL.z, 0xe0f2fe, 2, true);
      spawnParticles(_wtR.x, _wtR.y, _wtR.z, 0xe0f2fe, 2, true);
      spawnParticles(dm.x + (Math.random() - 0.5) * 4.5, dm.y + 1.5 + Math.random() * 2.5, dm.z + (Math.random() - 0.5) * 4.5, 0xf8fafc, 2, false);
    }
  }
  function countAndFindNearestEndCrystal(dx, dy, dz) {
    let count = endCrystalVisuals.size, best = null, bestD2 = 1e9;
    if (count === 0) return { count: 0, best: null };
    for (const v of endCrystalVisuals.values()) {
      const gp = v && v.group && v.group.position;
      if (!gp) continue;
      const cx = gp.x + 0.5, cy = gp.y + (v.floatGrp ? v.floatGrp.position.y : 0.62), cz = gp.z + 0.5;
      const d2 = (cx - dx) * (cx - dx) + (cy - dy) * (cy - dy) + (cz - dz) * (cz - dz);
      if (d2 < bestD2) { bestD2 = d2; best = { x: cx, y: cy, z: cz, d2 }; }
    }
    return { count, best };
  }
  const _elBossWrap = document.getElementById('bossBarWrap');
  const _elBossCrest = document.getElementById('bossCrest');
  const _elBossName = document.getElementById('bossName');
  const _elBossMeta = document.getElementById('bossMeta');
  const _elBossFill = document.getElementById('bossBarFill');
  const _elBossPhase = document.getElementById('bossPhaseText');
  const _elBossCrystal = document.getElementById('bossCrystalText');
  let _lastBossUiSig = '';
  const _upVec = new THREE.Vector3(0, 1, 0), _beamA = new THREE.Vector3(), _beamB = new THREE.Vector3(), _beamDir = new THREE.Vector3();
  let _endCrystalCache = { count: 0, best: null }, _endCrystalScanT = 0;

  // Smooth Ground-Height Finder for Land Animals & Mobs (Strictly IGNORES non-solid Tall Grass/Flowers/Wheat so animals NEVER jitter!)
  // (đã xoá hàm chết findMobGroundY)

  // 4-Corner Footprint Solid Check (prevents mobs from slipping/bouncing off block edges while jumping up steps!)
  function mobFootprintSolidAtY(x, by, z, r = 0.35) {
    const rad = Math.min(0.42, r * 0.72);
    return isSolidAt(Math.floor(x - rad), by, Math.floor(z - rad)) ||
           isSolidAt(Math.floor(x + rad), by, Math.floor(z - rad)) ||
           isSolidAt(Math.floor(x - rad), by, Math.floor(z + rad)) ||
           isSolidAt(Math.floor(x + rad), by, Math.floor(z + rad));
  }

  // Fences & stone walls are 1.5 blocks tall in Minecraft — mobs cannot jump over them and must steer around!
  function hasUnjumpableBarrierAt(x, by, z, r = 0.35) {
    const rad = Math.min(0.42, r * 0.72);
    const pts = [[x - rad, z - rad], [x + rad, z - rad], [x - rad, z + rad], [x + rad, z + rad]];
    for (let k = 0; k < 4; k++) {
      const id = getBlockWorld(Math.floor(pts[k][0]), by, Math.floor(pts[k][1]));
      const def = BLOCK_DEF[id];
      if (def && (def.fence || def.wall)) return true;
    }
    return false;
  }

  // Smart Voxel Step & Obstacle Probe: returns 'pass' | 'jump' (climbable 1-block ledge) | 'blocked' (wall/fence/lava/cliff/closed door)
  function probeMobStep(m, tx, baseY, tz) {
    const bx = Math.floor(tx), bz = Math.floor(tz);
    const footY = Math.floor(baseY + 0.08);
    // Avoid Lava, Fire & Campfire hazards across full 4-corner footprint for non-fire-immune mobs
    if (!FIRE_IMMUNE_MOBS.has(m.type)) {
      const rad = Math.min(0.40, m.hitboxR * 0.72);
      const cPts = [[tx - rad, tz - rad], [tx + rad, tz - rad], [tx - rad, tz + rad], [tx + rad, tz + rad]];
      for (let k = 0; k < 4; k++) {
        const cx = Math.floor(cPts[k][0]), cz = Math.floor(cPts[k][1]);
        const bFoot = getBlockWorld(cx, footY, cz);
        const bBelow = getBlockWorld(cx, footY - 1, cz);
        if (bFoot === B.LAVA || bBelow === B.LAVA || bFoot === B.FIRE || bFoot === B.CAMPFIRE) return 'blocked';
      }
    }
    // 1) Direct level path clear?
    if (mobFitsAt(tx, baseY, tz, m.hitboxR, m.hitboxH)) {
      // Avoid walking blindly off steep cliffs (>3.5 blocks drop) unless already falling
      if (m.onGround) {
        let hasLanding = false;
        for (let dy = 1; dy <= 4; dy++) {
          const checkY = footY - dy;
          const bId = getBlockWorld(bx, checkY, bz);
          if (bId === B.WATER || isSolidAt(bx, checkY, bz)) {
            if (!FIRE_IMMUNE_MOBS.has(m.type) && bId === B.LAVA) return 'blocked';
            hasLanding = true;
            break;
          }
        }
        if (!hasLanding) return 'blocked';
      }
      return 'pass';
    }
    // 2) Check if blocked by an unjumpable 1.5-block fence or stone wall
    if (hasUnjumpableBarrierAt(tx, footY, tz, m.hitboxR)) return 'blocked';
    // 3) Check if it's a clean 1-block step up (or shore bank 1..2 blocks up from water!)
    const headY = Math.floor(baseY + m.hitboxH + 0.92);
    const mobInWater = getBlockWorld(Math.floor(m.x), Math.floor(baseY + 0.35), Math.floor(m.z)) === B.WATER;
    const maxStep = mobInWater ? 2 : 1;
    const stepLeadX = m.x + (tx - m.x) * 1.28, stepLeadZ = m.z + (tz - m.z) * 1.28;
    for (let sd = 1; sd <= maxStep; sd++) {
      const stepTop = footY + sd;
      const headChkY = Math.floor(stepTop + m.hitboxH);
      const headClear = !mobFootprintSolidAtY(m.x, headY, m.z, m.hitboxR) && (sd === 1 || !mobFootprintSolidAtY(m.x, headChkY, m.z, m.hitboxR));
      if (headClear && (mobFitsAt(tx, stepTop + 0.02, tz, m.hitboxR, m.hitboxH) || mobFitsAt(stepLeadX, stepTop + 0.02, stepLeadZ, m.hitboxR, m.hitboxH))) {
        if (!FIRE_IMMUNE_MOBS.has(m.type) && getBlockWorld(bx, stepTop, bz) === B.LAVA) return 'blocked';
        return 'jump';
      }
    }
    return 'blocked';
  }

  // 7-Ray Fan Obstacle Avoidance: picks the cleanest detour direction with side hysteresis (zero wall-humping or twitching!)
  function pickMobAvoidYaw(m, desiredYaw, prefSide) {
    const s = prefSide >= 0 ? 1 : -1;
    const offsets = [s * 0.68, -s * 0.68, s * 1.32, -s * 1.32, s * 2.08, -s * 2.08, Math.PI];
    const dNear = Math.max(0.82, m.hitboxR + 0.48);
    const dMid = Math.max(1.55, m.hitboxR + 1.15);
    let bestYaw = desiredYaw + s * 1.32, bestSide = s, bestScore = -1;
    for (let k = 0; k < offsets.length; k++) {
      const off = offsets[k];
      const cy = desiredYaw + off;
      const sx = Math.sin(cy), cz = Math.cos(cy);
      const r1 = probeMobStep(m, m.x + sx * dNear, m.y, m.z + cz * dNear);
      if (r1 === 'blocked') continue;
      const r2 = probeMobStep(m, m.x + sx * dMid, m.y + (r1 === 'jump' ? 1.0 : 0), m.z + cz * dMid);
      let sc = (r1 === 'pass') ? 2.4 : 1.7;
      if (r2 === 'pass') sc += 2.0;
      else if (r2 === 'jump') sc += 1.3;
      else sc += 0.35;
      const side = off >= 0 ? 1 : -1;
      if (side === s) sc += 0.38; // Side hysteresis: stay committed around walls/trees/houses!
      sc -= Math.abs(off) * 0.24;
      if (sc > bestScore) { bestScore = sc; bestYaw = cy; bestSide = side; }
    }
    return { yaw: bestYaw, side: bestSide, score: bestScore };
  }

  function getLocalWaterSurfaceY(mx, my, mz) {
    const bx = Math.floor(mx), bz = Math.floor(mz);
    let y = Math.floor(my + 0.35), topW = -9999;
    const lim = Math.min(MAX_Y, y + 16);
    for (; y <= lim; y++) {
      const b = getBlockWorld(bx, y, bz);
      if (b === B.WATER || b === B.SEAGRASS) topW = y;
      else if (topW > -999) break;
    }
    if (topW <= -999) {
      const startY = Math.floor(my + 0.35);
      for (let d = 1; d <= 3; d++) {
        const b = getBlockWorld(bx, startY - d, bz);
        if (b === B.WATER || b === B.SEAGRASS) { topW = startY - d; break; }
      }
    }
    return (topW > -999 ? topW : WATER_LEVEL) + 0.86;
  }

  let mobSpawnTimer = 3.0, lastTargetMob = null, lastTargetMobTimer = 0;
  let _culledEntitiesCount = 0;
  const _mobSnapBuf = [], _snapHostiles = [], _snapVillagers = [];
  function _evalMobCulling(m, mdx, mdy, mdz, dist3D, lookX, lookY, lookZ, playerEyeY, idx) {
    if (!m.isBoss && !m.elemDragon && sodiumOpts.farEntities === false && dist3D > 28) return false;
    if (!sodiumOpts.entityCulling || m.isBoss || dist3D < 4.5) return true;
    if (IS_DRAGON_MOB.has(m.type) && dist3D < 80) return true;
    if (_camFrustumReady) {
      _cullSphere.center.set(m.x, m.y + (m.hitboxH || 1.5) * 0.5, m.z);
      _cullSphere.radius = Math.max(1.25, (m.hitboxR || 0.6) + (m.hitboxH || 1.5) * 0.58, (m.dragonScale || 1) * 5.2);
      if (!_camFrustum.intersectsSphere(_cullSphere)) return false;
    } else {
      const rPad = (m.hitboxR || 0.6) + 1.45;
      const camToMobY = (m.y + (m.hitboxH || 1.5) * 0.5) - playerEyeY;
      const dot = mdx * lookX + camToMobY * lookY + mdz * lookZ;
      if (dot < -rPad - dist3D * 0.16) return false;
    }
    if (dist3D > 10.5 && !m.flying && !m.skyBird) {
      if (m._occVis === undefined || ((frameCounter + idx) % 6) === 0) {
        const hMid = m.y + Math.max(0.7, (m.hitboxH || 1.4) * 0.55);
        const hTop = m.y + Math.max(1.2, (m.hitboxH || 1.4) * 0.92);
        m._occVis = hasLineOfSight(player.x, playerEyeY, player.z, m.x, hMid, m.z) ||
                    hasLineOfSight(player.x, playerEyeY, player.z, m.x, hTop, m.z);
      }
      if (!m._occVis) return false;
    }
    return true;
  }
  function updateDragonMode(m, dt, dist) {
    if (!m.elemDragon) return;
    if (!m._groundCacheT || m._groundCacheT <= 0) {
      m._groundCacheT = 0.38;
      m._groundY = _getDragonGroundSurfaceY(m.x, Math.max(m.y, 16) + 4, m.z, m.dragonScale);
    } else m._groundCacheT -= dt;
    m.dragonModeTimer -= dt;
    const isSolidNonFoliage = (wx, wy, wz) => {
      const b = getBlockWorld(wx, wy, wz), d = BLOCK_DEF[b];
      return isSolidAt(wx, wy, wz) && !(d && (d.foliage || d.isLog || d.cross));
    };
    const homeR = m.homeRadius || 100;
    if (m.dragonMode === 'fly') {
      m.flying = true;
      m._landVy = 0;
      const nearHome = (typeof m.homeX !== 'number') || Math.hypot(m.x - m.homeX, m.z - m.homeZ) <= (homeR + 2);
      if (m.dragonModeTimer <= 0 && dist < 56 && nearHome) {
        m.dragonMode = 'land'; m.dragonModeTimer = 6.0;
        m.lastSkillLabel = '🦅 HẠ CÁNH XUỐNG TỔ!';
      }
    } else if (m.dragonMode === 'land') {
      m.flying = true;
      const landY = Math.max(WATER_LEVEL + 0.6, m._groundY || 2);
      const tgtYaw = Math.atan2((typeof m.homeX === 'number' ? m.homeX : player.x) - m.x, (typeof m.homeZ === 'number' ? m.homeZ : player.z) - m.z);
      m.yaw = _turnAngleTowards(m.yaw, tgtYaw, 3.8, dt);
      const altAbove = Math.max(0, m.y - landY);
      const desSink = altAbove > 5.0 ? -4.5 : -(1.1 + altAbove * 0.55);
      m._landVy = (m._landVy || desSink) + (desSink - (m._landVy || desSink)) * Math.min(1, dt * 4.5);
      m.y = Math.max(landY, m.y + m._landVy * dt);
      m._flyPitch = Math.max(-0.22, Math.min(0.28, altAbove < 3.5 ? -0.18 : 0.14));
      const belowSolid = isSolidNonFoliage(Math.floor(m.x), Math.floor(m.y - 0.35), Math.floor(m.z));
      if (belowSolid || altAbove <= 0.35 || m.dragonModeTimer <= 0) {
        m.y = Math.max(landY, belowSolid ? Math.floor(m.y - 0.35) + 1.0 : landY);
        m.dragonMode = 'ground'; m.flying = false; m.vy = 0; m._landVy = 0; m.onGround = true;
        m.vx = 0; m.vz = 0; m.svx = 0; m.svz = 0;
        m.pauseT = 3.5 + Math.random() * 2.5;
        m.wanderT = m.pauseT + 2.5;
        m.dragonModeTimer = 9.0 + Math.random() * 2.5;
        m.atkCd = Math.min(m.atkCd || 0, 0.7);
        playSfx('roar'); cameraShake = Math.max(cameraShake, 0.25);
        spawnParticles(m.x, m.y + 0.5, m.z, 0xe2e8f0, 14, true);
      }
    } else if (m.dragonMode === 'ground') {
      m.flying = false;
      const surfG = _getDragonGroundSurfaceY(m.x, m.y + 3.0, m.z, m.dragonScale);
      if (m.y < surfG) m.y = surfG;
      const tooFarHome = (typeof m.homeX === 'number') && Math.hypot(m.x - m.homeX, m.z - m.homeZ) > (homeR + 3);
      if (m.dragonModeTimer <= 0 || tooFarHome || (m.y < WATER_LEVEL - 1.5 && m.elemDragon !== 'water')) {
        m.dragonMode = 'fly'; m.flying = true; m.y += 1.4; m.vy = 0;
        m.dragonModeTimer = 8.5 + Math.random() * 2.5;
        playSfx('roar'); m.lastSkillLabel = '🕊️ CẤT CÁNH TUẦN TRA TỔ!';
      }
    }
  }

  function _placeSafeDragonBlock(wx, wy, wz, bid, allowWaterReplace = false) {
    if (wy <= MIN_Y + 1 || wy > MAX_Y - 1 || !chunks.has(chunkKey(wx >> 4, wz >> 4))) return false;
    const cur = getBlockWorld(wx, wy, wz);
    if (cur === B.AIR || (allowWaterReplace && cur === B.WATER) || (BLOCK_DEF[cur] && BLOCK_DEF[cur].cross)) {
      setBlockWorld(wx, wy, wz, bid, true);
      return true;
    }
    return false;
  }

  function castElementalDragonAerialSkill(m, dist3D, tgtMob = null) {
    const el = m.elemDragon;
    const tx = tgtMob ? tgtMob.x : player.x;
    const ty = tgtMob ? (tgtMob.y + (tgtMob.hitboxH || 1.8) * 0.55) : (player.y + 1.0);
    const tz = tgtMob ? tgtMob.z : player.z;
    const tvx = tgtMob ? (tgtMob.flyVx || tgtMob.vx || 0) : ((player.smoothMoveX || 0) + player.vx);
    const tvy = tgtMob ? (tgtMob.flyVy || tgtMob.vy || 0) : player.vy;
    const tvz = tgtMob ? (tgtMob.flyVz || tgtMob.vz || 0) : ((player.smoothMoveZ || 0) + player.vz);
    const mp = getDragonMouthWorldPos(m, _mouthPos);
    const skPick = Math.random();
    m.atkAnimT = 0.55; m._roarT = 1.15; playSfx('roar');
    if (skPick < 0.34) {
      const cfg = {
        ice:   ['❄️ BAY 1: HƠI THỞ BĂNG HÀN!',   'drg_ice',   3, 24.5, 0.13, m.dmg * 0.85, 2.6],
        fire:  ['🔥 BAY 1: PHUN HỎA DIỆM!',      'drg_fire',  3, 25.0, 0.13, m.dmg * 0.90, 2.5],
        earth: ['🪨 BAY 1: PHÁO ĐÁ ĐỊA CHẤN!',   'drg_earth', 2, 22.0, 0.12, m.dmg * 1.10, 2.8],
        water: ['🌊 BAY 1: VÒI RỒNG THỦY ÁP!',   'drg_water', 3, 24.5, 0.13, m.dmg * 0.85, 2.5],
        leaf:  ['🌿 BAY 1: BÃO PHI TIÊU LÁ SẮC!', 'drg_leaf',  5, 24.0, 0.12, m.dmg * 0.72, 2.4],
        tree:  ['🌳 BAY 1: CƠN MƯA GAI CỔ THỤ!',  'drg_tree',  4, 23.5, 0.13, m.dmg * 0.80, 2.5]
      }[el];
      m.lastSkillLabel = cfg[0]; m.atkCd = cfg[6];
      const aim = computeSmartAimDir(mp.x, mp.y, mp.z, tx, ty, tz, tvx, tgtMob && tgtMob.elemDragon ? tvy * 2.0 : tvy, tvz, cfg[3], 0, 0.004);
      for (let si = 0; si < cfg[2]; si++) {
        const sp = (si - (cfg[2] - 1) * 0.5) * cfg[4];
        const sx = aim.x * Math.cos(sp) - aim.z * Math.sin(sp);
        const sz = aim.x * Math.sin(sp) + aim.z * Math.cos(sp);
        fireEnergyOrb(mp.x, mp.y, mp.z, sx, aim.y, sz, cfg[3], cfg[5], cfg[1], { ownerDragon: m, scale: 3.1, splashR: 5.8 });
      }
    } else if (skPick < 0.68) {
      const skyMap = {
        ice:   ['🌨️ BAY 2: MƯA BĂNG CỰC HÀN!',    'drg_ice',         5, 23.0, m.dmg * 0.82],
        fire:  ['☄️ BAY 2: THIÊN THẠCH DUNG NHAM!', 'drg_fire_meteor', 3, 24.0, m.dmg * 1.15],
        earth: ['⛰️ BAY 2: MƯA TẢNG ĐÁ TRỜI!',     'drg_earth',       4, 21.5, m.dmg * 1.05],
        water: ['🌀 BAY 2: BÃO XOÁY ĐẠI DƯƠNG!',   'drg_water',       4, 23.0, m.dmg * 0.90],
        leaf:  ['🌳 BAY 2: MƯA HẠT GIỐNG RỪNG!',   'drg_leaf_seed',   4, 22.0, m.dmg * 0.85],
        tree:  ['🌲 BAY 2: MƯA RỄ CÂY ĐẠI THỤ!',   'drg_tree_root',   4, 22.0, m.dmg * 0.95]
      }[el];
      m.lastSkillLabel = skyMap[0]; m.atkCd = 3.0;
      if (el === 'fire' || el === 'earth') m.swoopT = 1.6;
      for (let bi = 0; bi < skyMap[2]; bi++) {
        const ox = tx + (bi === 0 ? 0 : (Math.random() - 0.5) * 4.8);
        const oz = tz + (bi === 0 ? 0 : (Math.random() - 0.5) * 4.8);
        const aim = computeSmartAimDir(mp.x, mp.y, mp.z, ox, ty, oz, tvx, tgtMob && tgtMob.elemDragon ? tvy * 2.0 : tvy, tvz, skyMap[3], 0, 0.005);
        fireEnergyOrb(mp.x, mp.y, mp.z, aim.x, aim.y, aim.z, skyMap[3], skyMap[4], skyMap[1], { ownerDragon: m, scale: 3.4, splashR: 6.4 });
      }
    } else {
      const kindMap4 = { ice: 'drg_ice', fire: 'drg_fire', earth: 'drg_earth', water: 'drg_water', leaf: 'drg_leaf', tree: 'drg_tree' };
      const isBurst = (Math.random() < 0.5);
      m.lastSkillLabel = isBurst ? '💥 BAY 4: BÃO NGUYÊN TỐ VÒNG TRÒN!' : '🌪️ BAY 3: CÁNH RỒNG XUNG KÍCH!';
      m.atkCd = 3.4;
      if (isBurst) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          fireEnergyOrb(mp.x, mp.y, mp.z, Math.cos(a), -0.18, Math.sin(a), 22.0, m.dmg * 1.15, kindMap4[el] || 'drg_fire', { ownerDragon: m, scale: 3.2, splashR: 6.0 });
        }
      } else {
        m.swoopT = 2.0;
      }
    }
  }

  function castElementalDragonGroundSkill(m, dist3D, tgtMob = null) {
    const el = m.elemDragon;
    const tx = tgtMob ? tgtMob.x : player.x;
    const ty = tgtMob ? (tgtMob.y + 0.5) : player.y;
    const tz = tgtMob ? tgtMob.z : player.z;
    m.atkAnimT = 0.60; m._roarT = 1.25; m.atkCd = 3.0; playSfx('roar'); cameraShake = Math.max(cameraShake, 0.45);
    const px0 = Math.floor(tx), pz0 = Math.floor(tz);
    const applyGroundHit = (dmgMul, msg, extraFn) => {
      if (tgtMob) {
        if (dist3D < 10.5) hurtMob(tgtMob, m.dmg * dmgMul, tx - m.x, tz - m.z, 7.2, el === 'fire', false);
      } else if (dist3D < 10.0 && !player.dead && gameMode !== 'creative') {
        if (extraFn) extraFn();
        hurtPlayer(m.dmg * dmgMul, msg);
      }
    };
    if (el === 'ice') {
      m.lastSkillLabel = '❄️ ĐẤT 3: ĐỊA CHẤN ĐÓNG BĂNG!';
      spawnPixelFx('ice_shatter', m.x, m.y + 1.2, m.z, { count: 5, scale: 3.6, life: 0.60, spread: 2.8 });
      for (let k = 0; k < 5; k++) {
        const ax = px0 + (((Math.random() * 5) | 0) - 2), az = pz0 + (((Math.random() * 5) | 0) - 2);
        const gy = colGroundY(ax, az);
        if (getBlockWorld(ax, WATER_LEVEL, az) === B.WATER) setBlockWorld(ax, WATER_LEVEL, az, B.PACKED_ICE, true);
        else _placeSafeDragonBlock(ax, gy + 1, az, B.SNOW);
      }
      applyGroundHit(0.95, 'Bạn bị Địa Chấn Băng Giá của Rồng Băng đóng băng!', () => { player.chillT = 4.0; });
    } else if (el === 'fire') {
      m.lastSkillLabel = '🔥 ĐẤT 3: VÒNG LỬA ĐỊA NGỤC!';
      spawnPixelFx('explosion_fire', m.x, m.y + 1.2, m.z, { count: 5, scale: 3.6, life: 0.56, spread: 2.8 });
      for (let k = 0; k < 5; k++) {
        const ax = px0 + (((Math.random() * 5) | 0) - 2), az = pz0 + (((Math.random() * 5) | 0) - 2);
        const gy = colGroundY(ax, az), tb = getBlockWorld(ax, gy, az);
        if (tb === B.ICE || tb === B.PACKED_ICE || tb === B.SNOW) setBlockWorld(ax, gy, az, B.WATER, true);
        else _placeSafeDragonBlock(ax, gy + 1, az, B.FIRE);
      }
      applyGroundHit(1.00, 'Bạn bị Vòng Lửa Hỏa Diệm của Rồng Lửa thiêu đốt!', () => { player.burnTime = Math.max(player.burnTime || 0, 4.5); });
    } else if (el === 'earth') {
      m.lastSkillLabel = '🪨 ĐẤT 3: GAI ĐÁ TRỒI ĐẤT!';
      spawnPixelFx('smoke_puff', tx, ty + 0.5, tz, { count: 5, scale: 3.4, life: 0.60, spread: 2.4 });
      for (let k = 1; k <= 3; k++) {
        const sx = Math.floor(m.x + ((tx - m.x) * (k / 3.5))), sz = Math.floor(m.z + ((tz - m.z) * (k / 3.5)));
        const gy = colGroundY(sx, sz);
        _placeSafeDragonBlock(sx, gy + 1, sz, B.STONE);
        _placeSafeDragonBlock(sx, gy + 2, sz, B.DIRT);
      }
      applyGroundHit(1.10, 'Bạn bị Gai Đá Địa Chấn của Rồng Đất hất văng!', () => { player.vy = Math.max(player.vy, 9.5); });
    } else if (el === 'water') {
      m.lastSkillLabel = '🌊 ĐẤT 3: MẠCH NƯỚC PHUN TRÀO!';
      spawnPixelFx('water_splash', tx, ty + 0.6, tz, { count: 5, scale: 3.5, life: 0.58, spread: 2.4 });
      for (let k = 0; k < 2; k++) {
        const ax = px0 + (k === 0 ? 0 : 1), az = pz0 + (k === 0 ? 0 : -1), gy = colGroundY(ax, az);
        if (_placeSafeDragonBlock(ax, gy + 1, az, B.WATER)) {
          fluidLevel.set(modKey(ax, gy + 1, az), 4);
          scheduleFluid(ax, gy + 1, az, 0.12);
        }
      }
      applyGroundHit(0.90, 'Bạn bị Mạch Nước Phun Trào của Rồng Nước thổi bay!', () => {
        const pInv = 1 / (Math.hypot(player.x - m.x, player.z - m.z) + 0.1);
        player.vx += (player.x - m.x) * pInv * 10.5; player.vz += (player.z - m.z) * pInv * 10.5; player.vy = Math.max(player.vy, 10.0);
      });
    } else if (el === 'leaf' || el === 'tree') {
      m.lastSkillLabel = el === 'tree' ? '🌳 ĐẤT 3: RỄ CÂY CỔ THỤ TRÓI ĐẤT!' : '🌿 ĐẤT 3: RỪNG GAI TRÓI CHÂN!';
      spawnPixelFx('magic_poison', tx, ty + 0.6, tz, { count: 5, scale: 3.4, life: 0.58, spread: 2.4 });
      for (let k = 0; k < 5; k++) {
        const ax = px0 + (((Math.random() * 5) | 0) - 2), az = pz0 + (((Math.random() * 5) | 0) - 2);
        const gy = colGroundY(ax, az);
        _placeSafeDragonBlock(ax, gy + 1, az, k < 2 ? (el === 'tree' ? B.OAK_LOG : B.OAK_LEAVES) : (k === 2 ? B.FLOWER_RED : B.TALL_GRASS));
      }
      applyGroundHit(0.85, el === 'tree' ? 'Bạn bị Rễ Cây Cổ Thụ của Rồng Cây quật ngã!' : 'Bạn bị Rừng Gai của Rồng Lá trói chân & đâm thương!', () => { player.entangleT = 3.2; });
    }
    flushUrgentChunks(12);
  }

  function applyElementalDragonImpact(kind, wx, wy, wz, onPlayer) {
    const ix = Math.floor(wx), iy = Math.floor(wy), iz = Math.floor(wz);
    const gy = colGroundY(ix, iz), nearGround = Math.abs(iy - gy) <= 3;
    if (kind === 'drg_ice') {
      if (onPlayer) player.chillT = Math.max(player.chillT || 0, 3.0);
      else if (getBlockWorld(ix, WATER_LEVEL, iz) === B.WATER && Math.abs(iy - WATER_LEVEL) <= 2) setBlockWorld(ix, WATER_LEVEL, iz, B.ICE, true);
      else if (nearGround) _placeSafeDragonBlock(ix, gy + 1, iz, B.SNOW);
    } else if (kind === 'drg_fire' || kind === 'drg_fire_meteor') {
      if (onPlayer) player.burnTime = Math.max(player.burnTime || 0, kind === 'drg_fire_meteor' ? 5.5 : 3.5);
      else if (nearGround) {
        const hitB = getBlockWorld(ix, gy, iz);
        if (hitB === B.ICE || hitB === B.PACKED_ICE || hitB === B.SNOW) setBlockWorld(ix, gy, iz, B.WATER, true);
        else _placeSafeDragonBlock(ix, gy + 1, iz, B.FIRE);
      }
    } else if (kind === 'drg_earth') {
      if (onPlayer) { player.vy = Math.max(player.vy, 5.2); cameraShake = Math.max(cameraShake, 0.30); }
      else if (nearGround && Math.random() < 0.40) _placeSafeDragonBlock(ix, gy + 1, iz, Math.random() < 0.5 ? B.DIRT : B.STONE);
    } else if (kind === 'drg_water') {
      if (onPlayer) { player.burnTime = 0; player.vy = Math.max(player.vy, 4.8); }
      else if (nearGround && _placeSafeDragonBlock(ix, gy + 1, iz, B.WATER)) {
        fluidLevel.set(modKey(ix, gy + 1, iz), 5);
        scheduleFluid(ix, gy + 1, iz, 0.10);
      }
    } else if (kind === 'drg_leaf' || kind === 'drg_leaf_seed' || kind === 'drg_tree' || kind === 'drg_tree_root') {
      if (onPlayer) player.entangleT = Math.max(player.entangleT || 0, 2.4);
      else if (nearGround && (kind === 'drg_leaf_seed' || kind === 'drg_tree_root')) {
        _placeSafeDragonBlock(ix, gy + 1, iz, B.OAK_LOG);
        _placeSafeDragonBlock(ix, gy + 2, iz, B.OAK_LEAVES);
      } else if (nearGround) {
        _placeSafeDragonBlock(ix, gy + 1, iz, Math.random() < 0.6 ? B.OAK_LEAVES : B.FLOWER_YELLOW);
      }
    }
    flushUrgentChunks(8);
  }

  function updateMobs(_rawMobDt, elapsed) {
    const dt = _rawMobDt;
    const _mobNowMs = performance.now();
    const _curRoomKey = activeRoomId || '';
    if (currentDimension !== _mobNetLastDim || _curRoomKey !== _mobNetLastRoom) {
      _mobNetLastDim = currentDimension;
      _mobNetLastRoom = _curRoomKey;
      resetMobNetSyncCache();
    }
    _culledEntitiesCount = 0;
    const _mobSimAuth = (!activeRoomId || typeof isSimAuthority !== 'function' || isSimAuthority());
    if (_mobSimAuth) {
      mobSpawnTimer -= dt;
      if (mobSpawnTimer <= 0) {
        const isSiftFast = (currentDimension === 'sift' || currentDimension === 'dragon_realm');
        mobSpawnTimer = isSiftFast ? (_isWeakDevice ? 2.6 : 1.8) : (_isWeakDevice ? 7.0 : 5.5);
        spawnMobNearPlayer();
      }
    }
    if (lastTargetMobTimer > 0) { lastTargetMobTimer -= dt; if (lastTargetMobTimer <= 0) lastTargetMob = null; }
    if (isPlaying) {
      updateMobs._aimAcc = (updateMobs._aimAcc || 0) + dt;
      if (updateMobs._aimAcc >= 0.06) {
        updateMobs._aimAcc = 0;
        const aimedMob = raycastMob(12.0);
        if (aimedMob && !aimedMob.isBoss) { lastTargetMob = aimedMob; lastTargetMobTimer = 2.6; }
      }
    }
    const isDaytime = envUniforms.uSunDir.value.y > 0.12;
    const isRaining = rainIntensity > 0.20;
    let activeBoss = null, dragonBeamActive = false, dragonGlowActive = false;
    if (_mobSimAuth && currentDimension === 'overworld' && depthOffset === 0 && (frameCounter % 30) === 15) {
      const nests = getDragonNestLocations();
      for (let ni = 0; ni < nests.length; ni++) {
        const n = nests[ni];
        if (spawnedDragonNests.has(n.idx) || isMobDefeatedTag('nest:' + n.idx)) continue;
        let nearAnyPeer = Math.hypot(player.x - n.x, player.z - n.z) < 96;
        if (!nearAnyPeer && activeRoomId && typeof remotePlayers !== 'undefined') {
          for (const rp of remotePlayers.values()) {
            if (!rp.isBuddy && (rp.dim || 'overworld') === currentDimension && Math.hypot(rp.x - n.x, rp.z - n.z) < 96) { nearAnyPeer = true; break; }
          }
        }
        if (nearAnyPeer && chunks.has(chunkKey(n.x >> 4, n.z >> 4))) {
          spawnedDragonNests.add(n.idx);
          const dType = `${n.el}_dragon`;
          if (MOB_STATS[dType]) spawnMobOfType(dType, n.x + 0.5, n.y + 9.0, n.z + 0.5, { dragonStage: 4, homeX: n.x + 0.5, homeY: n.y + 9.0, homeZ: n.z + 0.5, homeRadius: 100, nestIdx: n.idx });
        }
      }
    }

    // Update lingering Dragon Breath Acid Clouds & Ender Singularity Vortexes!
    for (let ci = dragonClouds.length - 1; ci >= 0; ci--) {
      const cl = dragonClouds[ci];
      cl.life -= dt; cl.tick += dt;
      cl.mesh.rotation.y += dt * 1.4;
      const sc = (0.9 + Math.sin(elapsed * 5 + ci) * 0.14);
      cl.mesh.scale.set(sc * ((cl.r || 3.9) / 3.9), 1, sc * ((cl.r || 3.9) / 3.9));
      if (cl.tick >= 0.55) {
        cl.tick = 0;
        spawnParticles(cl.x + (Math.random() - 0.5) * (cl.r || 3.9), cl.y + 0.8, cl.z + (Math.random() - 0.5) * (cl.r || 3.9), 0xe879f9, 5, true);
        if (!player.dead && Math.hypot(player.x - cl.x, player.z - cl.z) < (cl.r || 3.9) && Math.abs(player.y - cl.y) < 3.0) {
          hurtPlayer(4.0, 'Bạn bị Hơi Thở Axit Rồng Ender thiêu đốt!');
        }
      }
      if (cl.life <= 0) { scene.remove(cl.mesh); dragonClouds[ci] = dragonClouds[dragonClouds.length - 1]; dragonClouds.pop(); }
    }
    for (let vi = _enderVortexes.length - 1; vi >= 0; vi--) {
      const vx = _enderVortexes[vi];
      vx.life -= dt; vx.tick += dt;
      if (vx.tick >= 0.15) {
        vx.tick = 0;
        spawnPixelFx('magic_ender', vx.x + (Math.random() - 0.5) * 3.0, vx.y + 1.0, vx.z + (Math.random() - 0.5) * 3.0, { count: 2, scale: 2.2, life: 0.35, spread: 0.6 });
        if (!player.dead && gameMode !== 'creative') {
          const pd = Math.hypot(player.x - vx.x, player.z - vx.z);
          if (pd > 0.6 && pd < 14.0 && Math.abs(player.y - vx.y) < 8.0) {
            player.vx += ((vx.x - player.x) / pd) * 6.5;
            player.vz += ((vx.z - player.z) / pd) * 6.5;
          }
        }
      }
      if (vx.life <= 0) {
        spawnPixelFx('explosion_ender', vx.x, vx.y + 1.0, vx.z, { count: 4, scale: 3.8, life: 0.55, spread: 2.0 });
        if (!player.dead && gameMode !== 'creative' && Math.hypot(player.x - vx.x, player.y - vx.y, player.z - vx.z) < 7.5) {
          hurtPlayer(vx.dmg || 16, 'Bạn bị Hố Đen Hư Vô của Rồng Ender nghiền nát!');
        }
        _enderVortexes.splice(vi, 1);
      }
    }

    // Player gaze vector for Minecraft Enderman eye-contact aggro!
    _rayEuler.set(player.pitch, player.yaw, 0, 'YXZ');
    const lookX = -Math.sin(player.yaw) * Math.cos(player.pitch);
    const lookY = Math.sin(player.pitch);
    const lookZ = -Math.cos(player.yaw) * Math.cos(player.pitch);
    const playerEyeY = player.y + (player.sneaking ? EYE_HEIGHT - 0.24 : EYE_HEIGHT);

    if (!_mobSimAuth && activeRoomId && _pendingRemoteMobSpawns.size > 0) {
      let drainLeft = 2;
      for (const [pUid, pEnt] of _pendingRemoteMobSpawns.entries()) {
        _pendingRemoteMobSpawns.delete(pUid);
        let exists = false;
        for (let mi = 0; mi < mobs.length; mi++) {
          if (mobs[mi] && !mobs[mi]._dead && mobs[mi].uid === pUid) { exists = true; break; }
        }
        if (!exists) {
          const wyNow = (typeof pEnt.it.ty === 'number' && Number.isFinite(pEnt.it.ty)) ? (pEnt.it.ty + (depthOffset || 0)) : pEnt.wy;
          _spawnSyncedRemoteMob(pEnt.it, wyNow, pEnt.vxIn, pEnt.vyIn, pEnt.vzIn, pEnt.yawIn, pEnt.fpIn, pEnt.senderTs, pEnt.pktSeq, _mobNowMs, depthOffset || 0);
        }
        if (--drainLeft <= 0) break;
      }
    }
    window._hasActiveNearShadowMob = false;
    window._hasActiveFlyingBoss = false;
    _mobSnapBuf.length = 0; _snapHostiles.length = 0; _snapVillagers.length = 0;
    for (let k = 0; k < mobs.length; k++) {
      const mk = mobs[k];
      _mobSnapBuf.push(mk);
      if (mk && !mk._dead) {
        if (mk.hostile || (!mk.guardian && !mk.tamed && !mk.villager && (mk.type === 'enderman' || mk.type === 'void_stalker' || mk.type === 'spider' || (mk.neutral && (mk.provoked || 0) > 0)))) _snapHostiles.push(mk);
        if (mk.villager) _snapVillagers.push(mk);
        if (!window._hasActiveFlyingBoss && (IS_DRAGON_MOB.has(mk.type) || (mk.isBoss && mk.flying))) {
          const bdx = mk.x - player.x, bdz = mk.z - player.z;
          if (bdx * bdx + bdz * bdz < 22500) window._hasActiveFlyingBoss = true;
        }
      }
    }
    // Zero-GC Rust WASM Batch Solver: strictly nearest alive player (Host + all same-dim Remote Peers, NO hard target lock) + O(M^2) ground crowd separation!
    const _aiPlayers = updateMobs._aiPlayers || (updateMobs._aiPlayers = []);
    _aiPlayers.length = 0;
    if (!player.dead && gameMode !== 'creative') {
      const pSlot = updateMobs._localPSlot || (updateMobs._localPSlot = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, isLocal: true, peerId: '', sneaking: false });
      pSlot.x = player.x; pSlot.y = player.y; pSlot.z = player.z;
      pSlot.vx = (player.smoothMoveX || 0) + (player.vx || 0); pSlot.vy = player.vy || 0; pSlot.vz = (player.smoothMoveZ || 0) + (player.vz || 0);
      pSlot.sneaking = !!player.sneaking;
      _aiPlayers.push(pSlot);
    }
    if (_mobSimAuth && activeRoomId && typeof remotePlayers !== 'undefined') {
      const rPool = updateMobs._remotePPool || (updateMobs._remotePPool = []);
      let rIdx = 0;
      for (const [rPid, rp] of remotePlayers.entries()) {
        if (!rp || rp.isBuddy || (rp.dim || 'overworld') !== currentDimension) continue;
        if (_aiPlayers.length >= 16) break;
        const rSlot = rPool[rIdx] || (rPool[rIdx] = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, isLocal: false, peerId: '', sneaking: false });
        rSlot.x = rp.x; rSlot.y = rp.y; rSlot.z = rp.z;
        rSlot.vx = 0; rSlot.vy = rp.vy || 0; rSlot.vz = 0;
        rSlot.peerId = rPid; rSlot.sneaking = !!rp.sneaking;
        _aiPlayers.push(rSlot);
        rIdx++;
      }
    }
    const _wMobCore = (typeof window._getNucraftWasmCore === 'function') ? window._getNucraftWasmCore() : null;
    const _useWasmMobAi = !!(_mobSimAuth && _wMobCore && _wMobCore.exports && _wMobCore.exports.solve_mob_targets_and_sep && _wMobCore.mobAiIn && _wMobCore.playerPosIn && _wMobCore.mobAiOut && _mobSnapBuf.length > 0 && _mobSnapBuf.length <= 128);
    if (_useWasmMobAi) {
      const mIn = _wMobCore.mobAiIn, pIn = _wMobCore.playerPosIn;
      for (let pi = 0; pi < _aiPlayers.length; pi++) {
        const ap = _aiPlayers[pi], pb = pi * 3;
        pIn[pb] = ap.x; pIn[pb + 1] = ap.y; pIn[pb + 2] = ap.z;
      }
      for (let k = 0; k < _mobSnapBuf.length; k++) {
        const mk = _mobSnapBuf[k], mb = k * 4;
        if (mk && !mk._dead) {
          mIn[mb] = mk.x; mIn[mb + 1] = mk.y; mIn[mb + 2] = mk.z;
          mIn[mb + 3] = (mk.flying || mk.aqua || mk.skyBird) ? -1.0 : (mk.hitboxR || 0.45);
        } else {
          mIn[mb] = 1e6; mIn[mb + 1] = 1e6; mIn[mb + 2] = 1e6; mIn[mb + 3] = -1.0;
        }
      }
      _wMobCore.exports.solve_mob_targets_and_sep(_mobSnapBuf.length >>> 0, _aiPlayers.length >>> 0, (_mobSnapBuf.length <= 64 ? 1 : 0));
    }
    const _damageCombatTarget = (tgt, dmgAmt, msg, mRef, opts = null) => {
      if (!tgt) return;
      if (tgt.isLocal) {
        if (player.dead || gameMode === 'creative') return;
        hurtPlayer(dmgAmt, msg, !!(opts && opts.ignoreArmor), opts ? (opts.canBlock !== false) : true, { fromPos: { x: mRef.x, z: mRef.z }, isAxe: !!(opts && opts.isAxe) });
        if (opts && opts.kbY) { player.vy = Math.max(player.vy, opts.kbY); cameraShake = Math.max(cameraShake, 0.22); }
        if (opts && opts.disableShield) player.shieldDisableT = Math.max(player.shieldDisableT || 0, opts.disableShield);
      } else if (activeRoomId && typeof sendCoopMsg === 'function' && tgt.peerId) {
        sendCoopMsg({
          type: 'mob_player_hit',
          _to: tgt.peerId,
          dim: currentDimension,
          dmg: dmgAmt,
          msg,
          fx: mRef.x,
          fz: mRef.z,
          ignoreArmor: !!(opts && opts.ignoreArmor),
          canBlock: opts ? (opts.canBlock !== false) : true,
          isAxe: !!(opts && opts.isAxe),
          kbY: (opts && opts.kbY) || 0,
          disableShield: (opts && opts.disableShield) || 0
        });
      }
    };
    for (let i = 0; i < _mobSnapBuf.length; i++) {
      const m = _mobSnapBuf[i];
      if (!m || m._dead) continue;
      if (m._dyingT > 0) {
        m._dyingT -= _rawMobDt;
        m.y += _rawMobDt * 1.45;
        m.yaw += _rawMobDt * 1.8;
        if (m.group) {
          m.group.position.set(m.x, m.y, m.z);
          m.group.rotation.y = m.yaw;
        }
        if (m._deathRaysGrp) {
          m._deathRaysGrp.rotation.y += _rawMobDt * 2.4;
          m._deathRaysGrp.rotation.z += _rawMobDt * 1.1;
          const scR = 0.65 + (4.0 - m._dyingT) * 0.55;
          m._deathRaysGrp.scale.setScalar(scR);
        }
        if (((frameCounter + i) & 3) === 0) spawnParticles(m.x, m.y + 1.5, m.z, 0xe879f9, 4, true);
        if (m._dyingT <= 0) {
          m._dyingT = 0;
          m._deathFinal = true;
          _disposeDragonDeathRays(m);
          m.hp = -1;
          hurtMob(m, 999, 0, 0, 0, false, false);
        }
        continue;
      }
      const mdx = m.x - player.x, mdy = m.y - player.y, mdz = m.z - player.z;
      const dist2 = mdx * mdx + mdz * mdz;
      const dist = Math.sqrt(dist2);
      const dyAbs = Math.abs(mdy);
      const dist3D = Math.sqrt(dist2 + mdy * mdy);
      // Never despawn mobs while player is dead; keep mobs persistent near death/active areas just like Minecraft!
      const keepDist = m.sovereignBoss
        ? Math.max((renderDistance + 2) * CHUNK_W + 24, 220)
        : ((m.isBoss || m.tamed) ? Math.max((renderDistance + 2) * CHUNK_W + 24, 96) : Math.max(renderDistance * CHUNK_W + 16, 56));
      let minPeerD = dist;
      if (_mobSimAuth && activeRoomId && typeof remotePlayers !== 'undefined') {
        for (const rp of remotePlayers.values()) {
          if (!rp.isBuddy && (rp.dim || 'overworld') === currentDimension) minPeerD = Math.min(minPeerD, Math.hypot(m.x - rp.x, m.z - rp.z));
        }
      }
      if (_mobSimAuth && !player.dead && (minPeerD > keepDist || (!m.isBoss && !m.tamed && dyAbs > 40))) {
        if (typeof m.nestIdx === 'number') spawnedDragonNests.delete(m.nestIdx);
        if (m.uid) {
          _mobNetLastSent.delete(m.uid);
          if (activeRoomId && _mobNetRemQueue.length < 64) _mobNetRemQueue.push(m.uid);
        }
        if (activeRoomId && typeof broadcastMobRemove === 'function') broadcastMobRemove(m.uid);
        disposeMobInstance(m); const mi = mobs.indexOf(m); if (mi !== -1) { mobs[mi] = mobs[mobs.length - 1]; mobs.pop(); } continue;
      }
      const isMobVis = (player.ridingDragon === m) ? true : _evalMobCulling(m, mdx, mdy, mdz, dist3D, lookX, lookY, lookZ, playerEyeY, i);
      if (m.group && m.group.visible !== isMobVis) m.group.visible = isMobVis;
      if (m.group && m.parts) {
        const wantSh = isMobVis && dist < 28 && !!sunLight.castShadow;
        if (m._shCast !== wantSh) {
          m._shCast = wantSh;
          for (let pi = 0; pi < m.parts.length; pi++) {
            m.parts[pi].castShadow = wantSh;
            if (m.parts[pi].material && m.parts[pi].material.shadowSide !== THREE.FrontSide) m.parts[pi].material.shadowSide = THREE.FrontSide;
          }
        }
      }
      if (!isMobVis) _culledEntitiesCount++;
      // Lithium: distance & visibility-tiered tick scaling; guests & near-peer mobs tick every frame for silky smoothness!
      const _isDrgTick = IS_DRAGON_MOB.has(m.type) || player.ridingDragon === m;
      const _effLitDist = _mobSimAuth ? minPeerD : dist;
      const _forceFullTick = m.tamed || (!_mobSimAuth && (isMobVis || dist < 64)) || (_mobSimAuth && !!activeRoomId && minPeerD < 40);
      const _litStep = (!_forceFullTick && !m.isBoss && !_isDrgTick)
        ? ((_effLitDist > (renderDistance * CHUNK_W + 12) || (sodiumOpts.lithiumAi && !isMobVis && _effLitDist > 10))
            ? 4
            : ((_isWeakDevice || _fpsSlow || sodiumOpts.lithiumAi) && _effLitDist > 26 ? 2 : 1))
        : 1;
      if (_litStep > 1 && ((frameCounter + i) % _litStep) !== 0) {
        if (m.isBoss && !m.tamed && m.hp > 0 && dist3D < 84 && (!activeBoss || dist3D < Math.hypot(activeBoss.x - player.x, activeBoss.y - player.y, activeBoss.z - player.z))) activeBoss = m;
        continue;
      }
      const dt = Math.min(0.12, _rawMobDt * _litStep);
      if (m.isBoss && !m.tamed && m.hp > 0 && dist3D < 84 && (!activeBoss || dist3D < Math.hypot(activeBoss.x - player.x, activeBoss.y - player.y, activeBoss.z - player.z))) activeBoss = m;
      if (m.hpBar && m.hpBarTimer > 0) { m.hpBarTimer -= dt; if (m.hpBarTimer <= 0) m.hpBar.sp.visible = false; }
      if (m.provoked > 0) m.provoked = Math.max(0, m.provoked - dt);
      if (m.atkAnimT > 0) m.atkAnimT = Math.max(0, m.atkAnimT - dt);
      if (dist3D < 15.5) {
        m.voiceT -= dt;
        if (m.voiceT <= 0) { m.voiceT = 6.5 + Math.random() * 10.5; if (Math.hypot(m.x - player.x, m.z - player.z) < 26) playMobSfx(m.type, 'idle'); }
      }
      const _isGuestMobClient = !!(activeRoomId && typeof isSimAuthority === 'function' && !isSimAuthority() && !(m.tamed && player.ridingDragon === m));

      if (!_isGuestMobClient) {
      // Mob Lava & Fire Burn Damage (Nether fire-immune mobs are immune; all others burn & take burn damage!)
      const mFeetB = getBlockWorld(Math.floor(m.x), Math.floor(m.y + 0.15), Math.floor(m.z));
      const mBodyB = getBlockWorld(Math.floor(m.x), Math.floor(m.y + 0.75), Math.floor(m.z));
      const inLava = (mFeetB === B.LAVA || mBodyB === B.LAVA);
      const inSoulFire = (mFeetB === B.SOUL_FIRE || mBodyB === B.SOUL_FIRE);
      const inFire = (mFeetB === B.FIRE || mBodyB === B.FIRE || inSoulFire);
      if (inLava && !FIRE_IMMUNE_MOBS.has(m.type)) {
        m.burning = true;
        m._burnSoul = false;
        m.burnTime = Math.max(m.burnTime || 0, 6.0);
        m.lavaTick += dt;
        if (m.lavaTick >= 0.50) {
          m.lavaTick = 0;
          spawnParticles(m.x, m.y + 0.9, m.z, 0xf97316, 5, true);
          playSfx('burn');
          if (hurtMob(m, 4.0, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 4.6, true, false)) continue;
        }
      } else {
        m.lavaTick = 0;
        if (inFire && !FIRE_IMMUNE_MOBS.has(m.type)) {
          m.burning = true;
          m._burnSoul = inSoulFire;
          m.burnTime = Math.max(m.burnTime || 0, 5.5);
          if (!m.hostile && !m.neutral) m.fleeT = Math.max(m.fleeT || 0, 3.5);
        } else if (mFeetB === B.WATER || mBodyB === B.WATER) {
          m.burning = false; m._burnSoul = false; m.burnTime = 0;
        }
      }

      // Minecraft Enderman Eye-Contact Aggro: ONLY attacks Survival players when looking straight into its eyes!
      if (m.eyeAggro && m.provoked <= 0 && !player.dead && gameMode !== 'creative' && dist3D > 1.2 && dist3D < 36) {
        const edx = m.x - player.x, edy = (m.y + 2.30) - playerEyeY, edz = m.z - player.z;
        const eLen = Math.hypot(edx, edy, edz) || 1;
        const gazeDot = (edx * lookX + edy * lookY + edz * lookZ) / eLen;
        if (gazeDot > 0.968 && hasLineOfSight(player.x, playerEyeY, player.z, m.x, m.y + 2.30, m.z)) {
          m.provoked = 35.0;
          playSfx('roar');
          spawnParticles(m.x, m.y + 2.2, m.z, 0xd946ef, 14, true);
          showToast('👁️ Bạn vừa nhìn thẳng vào mắt Enderman! Nó đang nổi điên tấn công!');
        }
      }

      let sunBurnNow = false;
      if ((m.type === 'zombie' || m.type === 'skeleton' || m.type === 'stray') && !m.noSunBurn && currentDimension === 'overworld') {
        m._sunChkT = (m._sunChkT || 0) - dt;
        if (m._sunChkT <= 0) {
          m._sunChkT = 0.35;
          const inW = getBlockWorld(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z)) === B.WATER;
          m._sunLit = !!(isDaytime && !isRaining && isExposedToSky(m.x, m.y + 1.5, m.z) && !inW);
          if (m._sunLit) { m.burning = true; m._burnSoul = false; m.burnTime = Math.max(m.burnTime || 0, 2.5); }
          else if (inW) { m.burning = false; m._burnSoul = false; m.burnTime = 0; }
        }
        sunBurnNow = !!m._sunLit;
      }
      if (m.burning) {
        if (!inLava && !inFire && !sunBurnNow && m.burnTime !== undefined) {
          m.burnTime -= dt;
          if (m.burnTime <= 0) { m.burning = false; m._burnSoul = false; m.burnTime = 0; }
        }
      }
      }
      if (m.burning) {
        if (!_isGuestMobClient && !m.hostile && !m.neutral) m.fleeT = Math.max(m.fleeT || 0, 0.6);
        if (m.flameGroup) {
          updateEntityFlameGroup(
            m.flameGroup, m.x, m.z, m.group ? m.group.rotation.y : 0,
            m.hitboxR || 0.32, m.hitboxH || 1.80, m.baseScale || 1,
            elapsed, i, !!m._burnSoul
          );
        }
        if (!_isGuestMobClient) {
          m.burnTick += dt;
          if (m.burnTick >= 0.55) {
            m.burnTick = 0; spawnParticles(m.x, m.y + 1.2, m.z, m._burnSoul ? 0x22d3ee : (Math.random() > 0.4 ? 0xff7b00 : 0xfef08a), 3, true);
            if (Math.hypot(m.x - player.x, m.z - player.z) < 14) playSfx('burn');
            if (hurtMob(m, m._burnSoul ? 1.8 : 1.2, 0, 0, 0, false, false)) continue;
          }
        }
      } else if (m.flameGroup) m.flameGroup.visible = false;

      if (m.hurtFlash > 0) m.hurtFlash -= dt;
      const isSwelling = (m.fusing && Math.sin(elapsed * 26) > 0);
      if (m.hurtFlash > 0 || isSwelling || m._hadFlash) {
        m._hadFlash = (m.hurtFlash > 0 || isSwelling);
        for (let pi = 0; pi < m.parts.length; pi++) {
          let mat = m.parts[pi].material;
          if (!mat || !mat.emissive) continue;
          if (isSwelling || m.hurtFlash > 0) mat = _cloneMobMatIfShared(m.parts[pi]);
          if (isSwelling) { mat.emissive.setHex(0xffffff); mat.emissiveIntensity = 1.4; }
          else if (m.hurtFlash > 0) { mat.emissive.setHex(0x991111); mat.emissiveIntensity = 1.0; }
          else {
            const be = mat.userData && mat.userData.baseEmissive;
            if (be && be.isColor) mat.emissive.copy(be);
            else mat.emissive.setHex(typeof be === 'number' ? be : 0x000000);
            mat.emissiveIntensity = (mat.userData && mat.userData.baseEmissiveInt !== undefined) ? mat.userData.baseEmissiveInt : 0;
          }
        }
      }

      // Strictly Nearest Alive Player Target (Host + all same-dim Remote Peers — NO hard target lock!)
      let tgtP = null;
      let tdx = mdx, tdy = mdy, tdz = mdz, tDist = dist, tDist3D = dist3D, tDyAbs = dyAbs;
      let wasmSepX = 0, wasmSepZ = 0, hasWasmSep = false;
      if (_useWasmMobAi) {
        const mobAiOut = _wMobCore.mobAiOut;
        const ob = i * 4;
        const pIdx = mobAiOut[ob] | 0;
        if (pIdx >= 0 && pIdx < _aiPlayers.length) tgtP = _aiPlayers[pIdx];
        wasmSepX = mobAiOut[ob + 2]; wasmSepZ = mobAiOut[ob + 3];
        hasWasmSep = true;
      } else if (_aiPlayers.length > 0) {
        let bestD2 = Infinity;
        for (let pi = 0; pi < _aiPlayers.length; pi++) {
          const ap = _aiPlayers[pi];
          const adx = ap.x - m.x, ady = ap.y - m.y, adz = ap.z - m.z;
          const ad2 = adx * adx + ady * ady + adz * adz;
          if (ad2 < bestD2) { bestD2 = ad2; tgtP = ap; }
        }
      }
      if (tgtP) {
        tdx = m.x - tgtP.x; tdy = m.y - tgtP.y; tdz = m.z - tgtP.z;
        const td2 = tdx * tdx + tdz * tdz;
        tDist = Math.sqrt(td2);
        tDyAbs = Math.abs(tdy);
        tDist3D = Math.sqrt(td2 + tdy * tdy);
      }

      const isSpiderAggro = (m.type === 'spider') ? (!isDaytime || isRaining || m.provoked > 0) : true;
      const isAggroToPlayer = !!tgtP && (m.type === 'spider' ? isSpiderAggro : (m.neutral ? (m.provoked > 0) : m.hostile));
      const isHumanoidPillar = HUMANOID_PILLAR_MOBS.has(m.type);
      const chaseDyLimit = isHumanoidPillar ? 13.5 : 7.5;
      let guardianTarget = null, villagerTarget = null, villagerDist = 22.0, canChasePlayer = false, preferVillager = false, villagerThreat = null;

      if (!_isGuestMobClient) {
        if (m.hopper && !m.sitting) {
          m.hopCd -= dt;
          if (m.hopCd <= 0 && (m.onGround || Math.abs(m.vy) < 0.08)) {
            m.vy = (m.type === 'sulfur_slime') ? 5.85 : 5.4;
            m.onGround = false;
            m.hopCd = 0.72 + Math.random() * 0.36;
            if (m.type === 'sulfur_slime') spawnParticles(m.x, m.y + 0.12, m.z, 0xfde047, 2, true);
          }
        }

        // 1) Iron Golem (Village Defender) & Tamed Pet Defender + 2) Hostile/Villager LOS & Threat AI (throttled ~4Hz!)
        const pElevated = !!(tgtP && isHumanoidPillar && tDist < 12.5 && (tgtP.y - m.y) > 1.4 && (tgtP.y - m.y) < 12.5);
        m._losT = (m._losT || 0) - dt;
        if (m._losT <= 0) {
          m._losT = m.guardian ? (0.14 + (i & 3) * 0.02) : (0.24 + (i & 3) * 0.03);
          m._guardTarget = null;
          if ((m.guardian || (m.tamed && DEFENDER_PETS.has(m.type) && !m.sitting)) && m.provoked <= 0) {
            let bestD2 = m.guardian ? 900 : 256;
            const maxDy = m.guardian ? 10.0 : 7.5;
            for (let hi = 0; hi < _snapHostiles.length; hi++) {
              const hm = _snapHostiles[hi];
              if (!hm || hm._dead || hm === m || Math.abs(hm.y - m.y) > maxDy) continue;
              const gx = hm.x - m.x, gz = hm.z - m.z, hd2 = gx * gx + gz * gz;
              if (hd2 < bestD2) { bestD2 = hd2; m._guardTarget = hm; }
            }
          }
          m._losPlayer = (!!tgtP && isAggroToPlayer && (m.elemDragon ? (tDist3D < 48 && tDyAbs < 24) : (tDist3D < 22 && tDyAbs < chaseDyLimit && (hasLineOfSight(m.x, m.y + 1.1, m.z, tgtP.x, tgtP.y + 1.1, tgtP.z) || pElevated))));
          m._vilTarget = null; m._vilDist = 22.0;
          if (m.hostile && !m.aqua && !m.flying && !m.skyBird && m.type !== 'creeper' && m.type !== 'void_stalker' && isSpiderAggro) {
            for (let vi = 0; vi < _snapVillagers.length; vi++) {
              const vm = _snapVillagers[vi];
              if (!vm || vm._dead || vm === m || Math.abs(vm.y - m.y) > 6.5) continue;
              const vd = Math.hypot(vm.x - m.x, vm.z - m.z);
              if (vd < m._vilDist && hasLineOfSight(m.x, m.y + 1.1, m.z, vm.x, vm.y + 1.1, vm.z)) {
                m._vilDist = vd; m._vilTarget = vm;
              }
            }
          }
          m._vilThreat = null;
          if (m.villager) {
            let nearThreatD2 = 132.25;
            for (let hi = 0; hi < _snapHostiles.length; hi++) {
              const hm = _snapHostiles[hi];
              if (!hm || hm._dead || Math.abs(hm.y - m.y) > 4.5) continue;
              const tx = hm.x - m.x, tz = hm.z - m.z, td2 = tx * tx + tz * tz;
              if (td2 < nearThreatD2) { nearThreatD2 = td2; m._vilThreat = hm; }
            }
          }
        }
        guardianTarget = (m._guardTarget && !m._guardTarget._dead && (m.guardian || (m.tamed && DEFENDER_PETS.has(m.type) && !m.sitting)) && m.provoked <= 0) ? m._guardTarget : null;
        villagerTarget = (m._vilTarget && !m._vilTarget._dead) ? m._vilTarget : null;
        villagerDist = villagerTarget ? Math.hypot(villagerTarget.x - m.x, villagerTarget.z - m.z) : 22.0;
        canChasePlayer = isAggroToPlayer && !!tgtP && (m.elemDragon ? (tDist3D < 48 && tDyAbs < 24) : (tDist3D < 22 && tDyAbs < chaseDyLimit && !!m._losPlayer));
        if (m.elemDragon && !m.tamed) updateDragonMode(m, dt, tDist);
        preferVillager = !!(villagerTarget && (!canChasePlayer || villagerDist + 1.5 < tDist));
        villagerThreat = (m.villager && m._vilThreat && !m._vilThreat._dead) ? m._vilThreat : null;
      }

      let speed = m.speed;
      if (m._chilledT > 0) { m._chilledT = Math.max(0, m._chilledT - dt); speed *= 0.52; }
      let visualTargetYaw = m.yaw;
      if (_isGuestMobClient) {
        if (m._netBuf && m._netBuf.snaps.length > 0) {
          const prevYawG = m.yaw;
          const maxTp = (m.flying || IS_DRAGON_MOB.has(m.type)) ? 24.0 : 12.0;
          const s = sampleNetInterp(m._netBuf, _mobNowMs, dt, depthOffset || 0, maxTp, _mobSampleOut);
          m.x = s.x; m.y = s.y; m.z = s.z;
          m.yaw = s.yaw;
          m.svx = s.vx; m.svz = s.vz; m.vy = s.vy;
          speed = Math.hypot(s.vx, s.vz);
          if (m.flying || IS_DRAGON_MOB.has(m.type)) {
            m.flyVx = s.vx; m.flyVy = s.vy; m.flyVz = s.vz;
            m._flyPitch = s.pitch;
          }
          m._guestTurnRate = _wrapNetAng(m.yaw - prevYawG);
          visualTargetYaw = m.yaw;
        }
        if (m.fusing && m.group) {
          m.fuseTimer = Math.min(1.45, (m.fuseTimer || 0) + dt);
          const sw = 1.0 + Math.sin(m.fuseTimer * 18) * 0.12 + m.fuseTimer * 0.16;
          m.group.scale.set(sw, 1.0 + m.fuseTimer * 0.08, sw);
        } else if (m.fuseTimer > 0 && m.group) {
          m.fuseTimer = 0;
          m.group.scale.set(1, 1, 1);
        }
      } else {
      const _simPrevX = m.x, _simPrevY = m.y, _simPrevZ = m.z;
      if (m.tamed && m.sitting && !m.elemDragon) {
        const petOwner = _getPetOwnerTarget(m);
        speed = 0;
        m.yaw = Math.atan2(petOwner.x - m.x, petOwner.z - m.z);
      } else if (m.type === 'cave_warden') {
        if (m.atkCd > 0) m.atkCd -= dt;
        if (m._sonicCd > 0) m._sonicCd -= dt;
        if (m._tendrilFlashT > 0) m._tendrilFlashT = Math.max(0, m._tendrilFlashT - dt);
        if (m.state === 'emerging') {
          m.stateT = Math.max(0, (m.stateT || 0) - dt);
          const p = 1.0 - (m.stateT / 3.8);
          m.y = m.ry = (m._emergeBaseY !== undefined ? m._emergeBaseY : m.y);
          m._emergeOffsetY = -2.6 * (1.0 - Math.min(1, p * p * (3 - 2 * p)));
          speed = 0;
          if ((frameCounter + i) % 6 === 0) spawnParticles(m.x, m.y + 0.4, m.z, 0x0e7490, 3, true);
          if (m.stateT <= 0) { m.state = 'awake'; m._emergeOffsetY = 0; }
        } else if (m.state === 'digging') {
          m.stateT = Math.max(0, (m.stateT || 0) - dt);
          const p = 1.0 - (m.stateT / 3.5);
          m._emergeOffsetY = -2.8 * (p * p);
          speed = 0;
          if ((frameCounter + i) % 6 === 0) spawnParticles(m.x, m.y + 0.4, m.z, 0x071b24, 3, false);
          if (m.stateT <= 0) {
            disposeMobInstance(m);
            const mi = mobs.indexOf(m);
            if (mi !== -1) { mobs[mi] = mobs[mobs.length - 1]; mobs.pop(); }
            continue;
          }
        } else {
          // Completely Blind Warden: Darkness aura + dynamic heartbeat + vibration/sniff tracking + Sonic Boom!
          if (!player.dead && dist3D < 26.0) {
            if ((m._darkCd = (m._darkCd || 0) - dt) <= 0) {
              m._darkCd = 5.0;
              player._darknessT = Math.max(player._darknessT || 0, 12.0);
            }
            const hbPeriod = Math.max(0.42, 1.25 - Math.min(1, (m.anger || 0) / 100) * 0.80);
            m._heartbeatT = (m._heartbeatT || 0) - dt;
            if (m._heartbeatT <= 0) {
              m._heartbeatT = hbPeriod;
              m._heartBeatFlash = 1.0;
              if (audioCtx && audioCtx.state === 'running' && sfxGain && sfxVolume > 0.01 && dist3D < 24) {
                try {
                  const now = audioCtx.currentTime, o = audioCtx.createOscillator(), gH = audioCtx.createGain();
                  o.type = 'sine'; o.frequency.setValueAtTime(52, now); o.frequency.exponentialRampToValueAtTime(30, now + 0.16);
                  const vol = Math.max(0.03, 0.24 * (1 - dist3D / 24));
                  gH.gain.setValueAtTime(vol, now); gH.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                  o.connect(gH); gH.connect(sfxGain); o.start(now); o.stop(now + 0.20);
                } catch (_) {}
              }
            }
          }
          m._heartBeatFlash = Math.max(0, (m._heartBeatFlash || 0) - dt * 3.5);
          m.anger = Math.max(0, (m.anger || 0) - dt * 3.8);
          m._sniffCd = (m._sniffCd ?? 4.5) - dt;
          if (m._sniffCd <= 0 && (m._sonicChargeT || 0) <= 0) {
            m._sniffCd = 5.2 + Math.random() * 1.8;
            m._sniffAnimT = 1.25;
            const sniffR = player.sneaking ? 10.0 : 20.0;
            if (!player.dead && gameMode !== 'creative' && dist3D <= sniffR) {
              m.anger = Math.min(150, (m.anger || 0) + 25);
              m.investigateTarget = { x: player.x, y: player.y, z: player.z };
              m._investigateT = 7.0;
              m._calmT = 0;
              m._tendrilFlashT = 0.8;
            }
          }
          if (m._sniffAnimT > 0) m._sniffAnimT = Math.max(0, m._sniffAnimT - dt);
          if (!player.dead && gameMode !== 'creative' && dist3D < 1.95) {
            m.anger = 150;
            m.investigateTarget = { x: player.x, y: player.y, z: player.z };
            m._investigateT = 8.0;
            m._calmT = 0;
          }
          if (m._sonicChargeT > 0) {
            m._sonicChargeT -= dt;
            speed = m.speed * 0.22;
            m.yaw = Math.atan2(player.x - m.x, player.z - m.z);
            if ((frameCounter + i) % 3 === 0) spawnParticles(m.x, m.y + 1.5, m.z, 0x22d3ee, 2, true);
            if (m._sonicChargeT <= 0) {
              m._sonicCd = 5.5;
              m.atkAnimT = 0.55;
              playSfx('roar');
              cameraShake = Math.max(cameraShake, 0.45);
              const sx0 = m.x, sy0 = m.y + 1.55, sz0 = m.z;
              const pxT = player.x, pyT = player.y + 1.0, pzT = player.z;
              for (let k = 1; k <= 10; k++) {
                const t = k / 10;
                spawnParticles(sx0 + (pxT - sx0) * t, sy0 + (pyT - sy0) * t, sz0 + (pzT - sz0) * t, 0x22d3ee, 4, false);
              }
              if (!player.dead && gameMode !== 'creative' && dist3D < 22.0) {
                hurtPlayer(12.0, '💥 Bạn bị Sóng Âm Sonic Boom của Warden xuyên giáp!', true, true, { fromPos: { x: m.x, z: m.z } });
                const invD = 1 / (Math.hypot(player.x - m.x, player.z - m.z) + 0.1);
                player.vx += (player.x - m.x) * invD * 9.5;
                player.vz += (player.z - m.z) * invD * 9.5;
                player.vy = Math.max(player.vy, 5.2);
              }
            }
          } else {
            const hasActiveAggro = !player.dead && gameMode !== 'creative' && (m.anger || 0) >= 80 && dist3D < 24.0;
            if (hasActiveAggro) {
              m.investigateTarget = { x: player.x, y: player.y, z: player.z };
              m._calmT = 0;
            }
            if (m.investigateTarget) {
              const tx = m.investigateTarget.x, tz = m.investigateTarget.z;
              const td = Math.hypot(tx - m.x, tz - m.z);
              m.yaw = Math.atan2(tx - m.x, tz - m.z);
              if (td < 1.35) {
                speed = 0;
                m._investigateT = (m._investigateT || 0) - dt;
                if (m._investigateT <= 0 && !hasActiveAggro) m.investigateTarget = null;
              } else {
                speed = m.anger >= 80 ? m.speed * 1.48 : m.speed * 0.92;
              }
              if (hasActiveAggro) {
                const los = hasLineOfSight(m.x, m.y + 1.6, m.z, player.x, player.y + 1.1, player.z);
                if (dist < 2.65 && dyAbs < 2.3 && m.atkCd <= 0) {
                  hurtPlayer(m.dmg, '💀 Bạn bị Warden nghiền nát!', false, true, { fromPos: { x: m.x, z: m.z }, isAxe: true });
                  player.shieldDisableT = 5.0;
                  m.atkCd = 1.35; m.atkAnimT = 0.50;
                  playMobSfx('cave_warden', 'attack');
                  cameraShake = Math.max(cameraShake, 0.34);
                  spawnParticles(m.x, m.y + 0.4, m.z, 0x22d3ee, 10, true);
                } else if (dist3D < 18.5 && (dist3D > 3.6 || dyAbs > 2.2 || !los) && (m._sonicCd || 0) <= 0) {
                  m._sonicChargeT = 1.6;
                  playSfx('roar');
                }
              }
            } else {
              m._calmT = (m._calmT || 0) + dt;
              m.wanderT -= dt;
              if (m.wanderT <= 0) { m.wanderT = 2.5 + Math.random() * 3.0; m.yaw += (Math.random() - 0.5) * 1.6; }
              speed = m.speed * 0.42;
              if (m._calmT >= 60.0) {
                m.state = 'digging'; m.stateT = 3.5;
                showToast('👁️ Warden không còn mục tiêu và đã đào đất biến mất...');
              }
            }
          }
        }
      } else if (guardianTarget) {
        m.yaw = Math.atan2(guardianTarget.x - m.x, guardianTarget.z - m.z);
        const hd = Math.hypot(guardianTarget.x - m.x, guardianTarget.z - m.z);
        const stopD = (m.hitboxR || 0.75) + (guardianTarget.hitboxR || 0.5) + 0.25;
        if (m.guardian) speed = hd > stopD ? (m.speed * 1.48) : (m.speed * 0.25);
        if (m.atkCd > 0) m.atkCd -= dt;
        const reach = m.guardian ? Math.max(3.15, (m.hitboxR || 0.9) + (guardianTarget.hitboxR || 0.5) + 1.55) : 1.95;
        const vReach = m.guardian ? 3.4 : 2.5;
        const canSeeTgt = (hd < 2.25) || hasLineOfSight(m.x, m.y + 1.5, m.z, guardianTarget.x, guardianTarget.y + 0.95, guardianTarget.z);
        if (hd < reach && Math.abs(guardianTarget.y - m.y) < vReach && m.atkCd <= 0 && canSeeTgt) {
          m.atkCd = m.guardian ? 0.95 : 0.80; m.atkAnimT = m.guardian ? 0.52 : 0.40;
          const hitDmg = m.guardian ? Math.max(14, m.dmg) : Math.max(4, m.dmg);
          hurtMob(guardianTarget, hitDmg, guardianTarget.x - m.x, guardianTarget.z - m.z, m.guardian ? 8.5 : 4.5, false, false);
          if (m.guardian) {
            // Iconic Minecraft Iron Golem uppercut launch into the air + crisp 2D PixelFX impact!
            guardianTarget.vy = Math.max(guardianTarget.vy || 0, 8.8);
            playSfx('hit');
            if (typeof spawnPixelFx === 'function') {
              spawnPixelFx('crit_star', guardianTarget.x, guardianTarget.y + 1.15, guardianTarget.z, { count: 2, scale: 1.05, life: 0.36, spread: 0.35 });
              spawnPixelFx('shield_clang', guardianTarget.x, guardianTarget.y + 1.0, guardianTarget.z, { count: 1, scale: 0.95, life: 0.32 });
            }
          } else if (typeof spawnPixelFx === 'function') {
            spawnPixelFx('crit_star', guardianTarget.x, guardianTarget.y + 1.0, guardianTarget.z, { count: 1, scale: 0.72, life: 0.30 });
          }
        }
      } else if (preferVillager) {
        m.yaw = Math.atan2(villagerTarget.x - m.x, villagerTarget.z - m.z);
        if (m.atkCd > 0) m.atkCd -= dt;
        if (m.ranged) {
          if (villagerDist < 5.0) speed = -1.2;
          else if (villagerDist < 12.0) speed = 0.4;
          if (villagerDist < 16.0 && m.atkCd <= 0) {
            m.atkCd = 2.0; m.atkAnimT = 0.45;
            const isOrb = (m.ranged === 'shulker_bolt' || m.ranged === 'evoker_fang' || m.ranged === 'witch_potion' || m.ranged === 'ice_shard' || m.ranged === 'trident');
            const pSpd = isOrb ? 16.5 : 20.0;
            const aim = computeSmartAimDir(m.x, m.y + (isOrb ? 1.15 : 1.35), m.z, villagerTarget.x, villagerTarget.y + 1.12, villagerTarget.z, villagerTarget.svx || 0, villagerTarget.vy || 0, villagerTarget.svz || 0, pSpd, isOrb ? 0 : 14.5, 0.018);
            if (isOrb) fireEnergyOrb(m.x + aim.x * 0.7, m.y + 1.15, m.z + aim.z * 0.7, aim.x, aim.y, aim.z, pSpd, m.dmg, m.ranged);
            else fireArrow(m.x + aim.x * 0.6, m.y + 1.35, m.z + aim.z * 0.6, aim.x, aim.y, aim.z, pSpd, false, m.dmg);
          }
        } else {
          const vRange = (m.isBoss || m.type === 'ravager' || m.type === 'zoglin') ? 2.4 : 1.95;
          if (villagerDist < 1.35) speed = 0;
          if (villagerDist < vRange && Math.abs(villagerTarget.y - m.y) < 2.0 && m.atkCd <= 0 && hasLineOfSight(m.x, m.y + 1.1, m.z, villagerTarget.x, villagerTarget.y + 1.1, villagerTarget.z)) {
            m.atkCd = 1.15; m.atkAnimT = 0.45;
            playMobSfx(m.type, 'attack');
            hurtMob(villagerTarget, Math.max(2.5, m.dmg), villagerTarget.x - m.x, villagerTarget.z - m.z, 4.2, false, false);
          }
        }
      } else if (m.tamed && !m.elemDragon) {
        // Loyal Tamed Companion AI (follows actual owner peer smoothly in co-op, zero overshoot on teleport!)
        const petOwner = _getPetOwnerTarget(m);
        const ownerDist = Math.hypot(petOwner.x - m.x, petOwner.z - m.z);
        if (ownerDist > 24 && !petOwner.dead && petOwner.onGround) {
          m.x = petOwner.x + (Math.random() - 0.5) * 3.0; m.y = petOwner.y + 0.5; m.z = petOwner.z + (Math.random() - 0.5) * 3.0;
          m.rx = m.x; m.ry = m.y; m.rz = m.z;
          m.svx = 0; m.svz = 0; m._netVx = 0; m._netVy = 0; m._netVz = 0;
        } else if (ownerDist > 3.2) {
          m.yaw = Math.atan2(petOwner.x - m.x, petOwner.z - m.z);
          speed = ownerDist > 8.0 ? m.speed * 1.35 : m.speed * 1.05;
        } else {
          speed = 0;
          m.yaw = Math.atan2(petOwner.x - m.x, petOwner.z - m.z);
        }
      } else if (m.aqua) {
        const _aquaFitsInWater = (qx, qy, qz, qr, qh) => {
          const x0 = Math.floor(qx - qr), x1 = Math.floor(qx + qr);
          const y0 = Math.floor(qy + 0.04), y1 = Math.floor(qy + qh);
          const z0 = Math.floor(qz - qr), z1 = Math.floor(qz + qr);
          for (let bx = x0; bx <= x1; bx++) {
            for (let by = y0; by <= y1; by++) {
              for (let bz = z0; bz <= z1; bz++) {
                const blk = getBlockWorld(bx, by, bz);
                if (blk !== B.WATER && blk !== B.SEAGRASS) return false;
              }
            }
          }
          return true;
        };
        const ar = Math.max(0.28, m.hitboxR || 0.35), ah = Math.max(0.32, (m.hitboxH || 0.52) * 0.80);
        if (m._aquaTargetYaw === undefined) m._aquaTargetYaw = m.yaw;
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = 2.0 + Math.random() * 3.5;
          m._aquaTargetYaw += (Math.random() - 0.5) * 1.45;
          m._aquaDepthPref = 0.65 + Math.random() * 2.2;
        }
        const chasingAqua = (m.hostile || (m.neutral && m.provoked > 0)) && !player.dead && gameMode !== 'creative' && dist3D < 15;
        if (chasingAqua) {
          m._aquaTargetYaw = Math.atan2(player.x - m.x, player.z - m.z);
          if (m.atkCd > 0) m.atkCd -= dt;
          if (m.ranged === 'guardian_beam' && m.atkCd <= 0 && dist3D < 14 && hasLineOfSight(m.x, m.y + 0.6, m.z, player.x, player.y + 1.0, player.z)) {
            const aim = computeSmartAimDir(m.x, m.y + 0.6, m.z, player.x, player.y + 1.0, player.z, (player.smoothMoveX || 0) + player.vx, player.vy, (player.smoothMoveZ || 0) + player.vz, 17.5, 0, 0.010);
            fireEnergyOrb(m.x + aim.x * 0.8, m.y + 0.6, m.z + aim.z * 0.8, aim.x, aim.y, aim.z, 17.5, m.dmg, 'guardian_beam');
            m.atkCd = 2.4; m.atkAnimT = 0.45;
          } else if (dist3D < 1.8 && m.atkCd <= 0) { m.atkCd = 1.2; m.atkAnimT = 0.45; hurtPlayer(m.dmg, `Bạn bị ${m.displayName} tấn công dưới nước!`); }
        }
        let aqDy = m._aquaTargetYaw - m.yaw;
        while (aqDy > Math.PI) aqDy -= Math.PI * 2;
        while (aqDy < -Math.PI) aqDy += Math.PI * 2;
        m.yaw += aqDy * (1 - Math.exp(-(chasingAqua ? 7.0 : 4.2) * dt));
        const swimSpd = speed * (chasingAqua ? 0.92 : 0.72);
        const ax = m.x + (Math.sin(m.yaw) * swimSpd + m.vx) * dt;
        const az = m.z + (Math.cos(m.yaw) * swimSpd + m.vz) * dt;
        const localSurf = getLocalWaterSurfaceY(ax, m.y, az);
        const headClear = Math.max(0.30, (m.hitboxH || 0.6) * 0.55);
        const maxAquaY = localSurf - headClear;
        const prefDepth = (m.type === 'dolphin' || m.type === 'turtle') ? 0.55 : (m._aquaDepthPref || 1.35);
        const wantSwimY = Math.min(maxAquaY, chasingAqua ? Math.min(maxAquaY, player.y + 0.5) : (localSurf - prefDepth + Math.sin(elapsed * 1.45 + i) * 0.32));
        if (m._aquaVy === undefined) m._aquaVy = 0;
        m._aquaVy += ((wantSwimY - m.y) * 3.0 - m._aquaVy * 3.8) * dt;
        const ny = Math.max(MIN_Y + 1.2, Math.min(maxAquaY + 0.08, m.y + m._aquaVy * dt));
        const fwdX = Math.sin(m.yaw) * 0.45, fwdZ = Math.cos(m.yaw) * 0.45;
        if (_aquaFitsInWater(ax, ny, az, ar, ah) && _aquaFitsInWater(ax + fwdX, ny, az + fwdZ, ar * 0.75, ah * 0.75)) {
          m.x = ax; m.z = az; m.y = ny;
        } else {
          if (_aquaFitsInWater(ax, m.y, m.z, ar, ah)) m.x = ax; else m.vx = 0;
          if (_aquaFitsInWater(m.x, m.y, az, ar, ah)) m.z = az; else m.vz = 0;
          if (_aquaFitsInWater(m.x, ny, m.z, ar, ah)) m.y = ny; else m._aquaVy = Math.max(0, -m._aquaVy * 0.3);
          const probeAngles = [0.65, -0.65, 1.35, -1.35, Math.PI];
          let steered = false;
          for (let pa = 0; pa < probeAngles.length; pa++) {
            const cYaw = m.yaw + probeAngles[pa];
            if (_aquaFitsInWater(m.x + Math.sin(cYaw) * 1.2, m.y, m.z + Math.cos(cYaw) * 1.2, ar, ah)) {
              m._aquaTargetYaw = cYaw;
              steered = true;
              break;
            }
          }
          if (!steered) m._aquaTargetYaw = m.yaw + ((i & 1) ? 2.15 : -2.15);
          m.wanderT = 1.2;
        }
        if (!_aquaFitsInWater(m.x, m.y, m.z, ar * 0.72, ah * 0.72)) {
          const dySeq = [0, 1, -1, 2];
          const hxSeq = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
          let escaped = false;
          for (let dyi = 0; dyi < dySeq.length && !escaped; dyi++) {
            const tryY = m.y + dySeq[dyi] * 0.65;
            for (let hi = 0; hi < hxSeq.length; hi++) {
              const tryX = m.x + hxSeq[hi][0] * 0.65, tryZ = m.z + hxSeq[hi][1] * 0.65;
              if (_aquaFitsInWater(tryX, tryY, tryZ, ar * 0.72, ah * 0.72)) {
                m.x = tryX; m.y = tryY; m.z = tryZ;
                escaped = true;
                break;
              }
            }
          }
        }
        m._aquaPitch = (m._aquaPitch || 0) + (Math.max(-0.38, Math.min(0.38, -m._aquaVy * 0.24)) - (m._aquaPitch || 0)) * Math.min(1, dt * 7.0);
        m.vx *= 0.86; m.vz *= 0.86;
      } else if (m.skyBird) {
        const isLowHover = (m.type === 'ichor_ray' || m.type.startsWith('butterfly') || m.type === 'dragonfly' || m.type === 'allay');
        if (m.tamed && !m.sitting) {
          m.targetYaw = Math.atan2(player.x - m.x, player.z - m.z);
          m.yaw = m.targetYaw;
          const wantY = player.y + 2.2 + Math.sin(elapsed * 2.4 + i) * 0.4;
          if (dist > 2.4) { m.x += Math.sin(m.yaw) * speed * 0.9 * dt; m.z += Math.cos(m.yaw) * speed * 0.9 * dt; }
          m._flyPitch = Math.max(-0.32, Math.min(0.32, (m.y - wantY) * 0.35));
          m._isGliding = false;
          m.y += (wantY - m.y) * Math.min(1, dt * 3.0);
        } else {
          m.wanderT -= dt;
          if (m.targetYaw === undefined) m.targetYaw = m.yaw;
          if (m._glideT === undefined) { m._glideT = 1.5 + Math.random() * 2.5; m._isGliding = false; }
          m._glideT -= dt;
          if (m._glideT <= 0) {
            m._isGliding = !m._isGliding && !isLowHover;
            m._glideT = m._isGliding ? (1.4 + Math.random() * 2.0) : (1.8 + Math.random() * 2.4);
          }
          if (m.wanderT <= 0) {
            m.wanderT = 2.6 + Math.random() * 3.6;
            m.targetYaw = m.yaw + (Math.random() - 0.5) * 1.65;
          }
          let dYawB = m.targetYaw - m.yaw;
          while (dYawB > Math.PI) dYawB -= Math.PI * 2;
          while (dYawB < -Math.PI) dYawB += Math.PI * 2;
          m.yaw += dYawB * Math.min(1, dt * 2.4);
          const airSpd = speed * (m._isGliding ? 1.04 : 0.86);
          const bx = m.x + Math.sin(m.yaw) * airSpd * dt, bz = m.z + Math.cos(m.yaw) * airSpd * dt;
          if (!m._groundCacheT || m._groundCacheT <= 0) {
            m._groundCacheT = 0.65;
            const cTop = (typeof getCanopyTopY === 'function') ? getCanopyTopY(Math.floor(bx), Math.floor(bz)) : getTerrainHeight(Math.floor(bx), Math.floor(bz), getBiomeAt(Math.floor(bx), Math.floor(bz)));
            m._groundY = Math.max(WATER_LEVEL + 2, cTop);
          } else m._groundCacheT -= dt;
          const gH = m._groundY || (WATER_LEVEL + 2);
          const soarWave = m._isGliding ? Math.sin(elapsed * 0.95 + i) * 0.7 : Math.sin(elapsed * 2.1 + i) * 1.15;
          const wantY = Math.min(MAX_Y - 4, gH + (isLowHover ? 3.2 : 6.8) + soarWave);
          const prevY = m.y;
          const ny = m.y + (wantY - m.y) * Math.min(1, dt * (m._isGliding ? 1.3 : 2.1));
          m._flyPitch = Math.max(-0.35, Math.min(0.35, (prevY - ny) / Math.max(0.01, dt * 8.0)));
          const hitB = getBlockWorld(Math.floor(bx), Math.floor(ny), Math.floor(bz));
          const inLeaf = !!(BLOCK_DEF[hitB] && BLOCK_DEF[hitB].foliage);
          if (!inLeaf && !isSolidAt(Math.floor(bx), Math.floor(ny), Math.floor(bz)) && !isSolidAt(Math.floor(bx), Math.floor(ny + 0.6), Math.floor(bz))) {
            m.x = bx; m.z = bz; m.y = ny;
          } else {
            m.targetYaw = m.yaw + Math.PI * (inLeaf ? 0.35 : 0.72);
            m.y = Math.min(MAX_Y - 4, m.y + dt * (inLeaf ? 4.8 : 2.4));
          }
        }
      } else if (m.flying || m._perchState || (m.tamed && m.elemDragon)) {
        // Flying Mobs & EPIC 600-HP ENDER DRAGON / ELEMENTAL DRAGONS!
        const isDragon = IS_DRAGON_MOB.has(m.type), isGhast = (m.type === 'ghast'), isBlaze = (m.type === 'blaze' || m.type === 'soul_wisp' || m.type === 'wildfire');
        const isPassiveFlyer = (!m.hostile && !m.neutral && !m.skyBird);
        const cruiseOffset = isDragon ? (11.5 + (m.dragonScale || 1) * 2.2) : (isGhast ? 7.5 : (isBlaze ? 3.8 : (isPassiveFlyer ? 3.6 : 6.0)));
        if (!m._groundCacheT || m._groundCacheT <= 0) {
          if (isDragon) {
            m._groundCacheT = 0.25;
            m._groundY = Math.max(_getSafeDragonSkyY(m.x, m.z, 0), _getSafeDragonSkyY(m.x + Math.sin(m.yaw) * 8, m.z + Math.cos(m.yaw) * 8, 0));
          } else {
            m._groundCacheT = 0.6;
            const cTop = (typeof getCanopyTopY === 'function') ? getCanopyTopY(Math.floor(m.x), Math.floor(m.z)) : getTerrainHeight(Math.floor(m.x), Math.floor(m.z), getBiomeAt(Math.floor(m.x), Math.floor(m.z)));
            m._groundY = Math.max(WATER_LEVEL + 1, cTop);
          }
        } else m._groundCacheT -= dt;
        const targetH = Math.min(MAX_Y - 5, Math.max(m._groundY + cruiseOffset, player.y + cruiseOffset));
        if (m.atkCd > 0) m.atkCd -= dt;
        if (m._sk2Cd > 0) m._sk2Cd = Math.max(0, m._sk2Cd - dt);
        if (m._sk3Cd > 0) m._sk3Cd = Math.max(0, m._sk3Cd - dt);
        if (m._sk4Cd > 0) m._sk4Cd = Math.max(0, m._sk4Cd - dt);
        const _drgSolidAt = (qx, qy, qz) => isSolidAt(Math.floor(qx), Math.floor(qy), Math.floor(qz)) || isSolidAt(Math.floor(qx), Math.floor(qy + 1.0), Math.floor(qz));
        const _applyDrgY = (ny) => {
          if (ny > m.y && _drgSolidAt(m.x, m.y, m.z)) {
            m.y = Math.min(MAX_Y - 5, ny);
          } else if (!_drgSolidAt(m.x, ny, m.z)) {
            m.y = ny;
          } else if (isDragon && ny > m.y) {
            m._flyAvoidT = Math.max(m._flyAvoidT || 0, 1.1);
            if (m._flyAvoidYaw === undefined) m._flyAvoidYaw = m.yaw + Math.PI * 0.75;
          }
        };

        // End Crystal Healing Beam & Exact Body-Block-Center Purple Aura/Impact for Ender Dragon!
        if (m.type === 'ender_dragon') {
          getDragonBodyCenterWorldPos(m, _beamB);
          if (isMobVis && (frameCounter + i) % 3 === 0) {
            const ang = elapsed * 2.4 + i;
            const rA = 2.6 + Math.sin(elapsed * 3.1) * 0.8;
            spawnParticles(_beamB.x + Math.cos(ang) * rA, _beamB.y + Math.sin(elapsed * 2.2) * 1.1, _beamB.z + Math.sin(ang) * rA, (frameCounter & 1) ? 0xd946ef : 0xa855f7, 2, true);
            if (((frameCounter + i) % 12) === 0) {
              spawnPixelFx('magic_ender', _beamB.x + (Math.random() - 0.5) * 3.8, _beamB.y + (Math.random() - 0.5) * 2.0, _beamB.z + (Math.random() - 0.5) * 3.8, { count: 1, scale: 2.0, life: 0.42, spread: 0.45 });
            }
          }
          _endCrystalScanT -= dt;
          if (_endCrystalScanT <= 0) {
            _endCrystalScanT = 0.75;
            _endCrystalCache = countAndFindNearestEndCrystal(_beamB.x, _beamB.y, _beamB.z);
          }
          const beamHere = !!(_endCrystalCache.best && _endCrystalCache.best.d2 < 52 * 52 && !m._dyingT);
          if (beamHere) {
            if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + dt * 3.5);
            _beamA.set(_endCrystalCache.best.x, _endCrystalCache.best.y, _endCrystalCache.best.z);
            const bLen = Math.max(0.5, _beamA.distanceTo(_beamB));
            _beamDir.subVectors(_beamB, _beamA).normalize();
            dragonHealBeam.position.copy(_beamA).add(_beamB).multiplyScalar(0.5);
            dragonHealBeam.scale.set(1, 1, 1);
            dragonHealBeam.quaternion.setFromUnitVectors(_upVec, _beamDir);
            const bRad = 1.0 + Math.sin(elapsed * 12) * 0.14;
            const bud = dragonHealBeam.userData;
            if (bud && bud.beamShaft) {
              bud.beamShaft.scale.set(bRad, bLen, bRad);
              bud.coreU.uTime.value = elapsed;
              bud.coreU.uLen.value = bLen;
              bud.helixU.uTime.value = elapsed;
              bud.helixU.uLen.value = bLen;
              bud.sheathU.uTime.value = elapsed;
              for (let rk = 0; rk < bud.rings.length; rk++) {
                const rm = bud.rings[rk];
                const u = ((elapsed * 0.62) + rk * 0.25) % 1.0;
                rm.position.y = (u - 0.5) * bLen;
                rm.rotation.z = elapsed * 2.5 + rk * 1.1;
                rm.scale.setScalar(0.95 + 0.30 * u);
              }
              bud.crystalFlare.position.y = -bLen * 0.5;
              bud.crystalFlare.rotation.y = elapsed * 3.2;
              bud.crystalFlare.rotation.x = elapsed * 1.9;
            }
            dragonHealBeam.visible = true;
            dragonBeamActive = true;
          }
          if (isMobVis && !m._dyingT) {
            const dgd = dragonBodyGlow.userData;
            const dSc = m.dragonScale || 4.85;
            const he = (m.anim && m.anim.bodyHalfExtents) || _defBodyHalfExtents;
            if (m.anim && m.anim.bodyCenter) m.anim.bodyCenter.getWorldQuaternion(_bodyQ);
            else if (m.group) m.group.getWorldQuaternion(_bodyQ);
            else _bodyQ.identity();
            dragonBodyGlow.position.copy(_beamB);
            dgd.uTime.value = elapsed;
            dgd.uBoost.value = beamHere ? 1.0 : 0.38;
            dgd.shellMesh.quaternion.copy(_bodyQ);
            dgd.shellMesh.scale.set((he.x + 0.16) * dSc, (he.y + 0.16) * dSc, (he.z + 0.16) * dSc);
            const cSz = beamHere ? (9.2 + Math.sin(elapsed * 8.0) * 0.55) : 5.8;
            dgd.coronaMesh.scale.set(cSz, cSz, 1.0);
            dgd.impactMesh.visible = beamHere;
            if (beamHere) {
              _bodyInvQ.copy(_bodyQ).invert();
              _bodyHitLocal.copy(_beamDir).negate().applyQuaternion(_bodyInvQ);
              const bx = he.x * dSc, by = he.y * dSc, bz = he.z * dSc;
              const tx = Math.abs(_bodyHitLocal.x) > 1e-4 ? bx / Math.abs(_bodyHitLocal.x) : 1e9;
              const ty = Math.abs(_bodyHitLocal.y) > 1e-4 ? by / Math.abs(_bodyHitLocal.y) : 1e9;
              const tz = Math.abs(_bodyHitLocal.z) > 1e-4 ? bz / Math.abs(_bodyHitLocal.z) : 1e9;
              const tHit = Math.min(tx, ty, tz) + 0.18;
              _bodyHitLocal.multiplyScalar(tHit).applyQuaternion(_bodyQ);
              dgd.impactMesh.position.copy(_bodyHitLocal);
              dgd.impactMesh.scale.setScalar(3.4 + Math.sin(elapsed * 16.0) * 0.45);
              if (((frameCounter + i) % 10) === 0) {
                spawnPixelFx('dragon_impact_glow', _beamB.x + _bodyHitLocal.x, _beamB.y + _bodyHitLocal.y, _beamB.z + _bodyHitLocal.z, { count: 1, scale: 2.3, life: 0.38, spread: 0.25, randV: 0.15, riseV: 0.1 });
              }
            }
            dragonBodyGlow.visible = true;
            dragonGlowActive = true;
          }
          if (currentDimension === 'end' && !m._dyingT) {
            if (m._perchCd === undefined) m._perchCd = 22 + Math.random() * 8;
            if (!m._perchState) {
              m._perchCd -= dt;
              if (m._perchCd <= 0) { m._perchState = 'approach'; m._perchT = 7.5; }
            }
            if (m._perchState === 'approach') {
              m._perchT = (m._perchT || 7.5) - dt;
              const fy = Math.max(9.5, getTerrainHeight(0, 0, BIOMES.THE_END) + 3.2);
              const pxT = 0.5, pyT = fy, pzT = 0.5;
              const pdx = pxT - m.x, pdy = pyT - m.y, pdz = pzT - m.z;
              const pDist = Math.hypot(pdx, pdy, pdz) || 1;
              m.yaw = _turnAngleTowards(m.yaw, Math.atan2(pdx, pdz), 5.0, dt);
              m.x += (pdx / pDist) * Math.min(pDist, 14.0 * dt);
              m.y += (pdy / pDist) * Math.min(pDist, 10.0 * dt);
              m.z += (pdz / pDist) * Math.min(pDist, 14.0 * dt);
              m.rx = m.x; m.ry = m.y; m.rz = m.z;
              if (pDist < 2.2) { m._perchState = 'perched'; m._perchT = 7.5; m.flying = false; m._roarT = 1.5; playSfx('roar'); m.lastSkillLabel = '⛩️ RỒNG ENDER ĐẬU ĐÀI LỆNH!'; }
              else if (m._perchT <= 0) { m._perchState = null; m._perchCd = 18; m.flying = true; }
            } else if (m._perchState === 'perched') {
              m.flying = false; m.vx = 0; m.vz = 0; m._flyPitch = 0;
              m.yaw = _turnAngleTowards(m.yaw, Math.atan2(player.x - m.x, player.z - m.z), 3.6, dt);
              m._perchT -= dt;
              if (m.atkCd <= 0) {
                m.atkCd = 1.8; m.atkAnimT = 0.65; m._roarT = 1.2;
                spawnDragonBreathCloud(player.x, colGroundY(Math.floor(player.x), Math.floor(player.z)) + 0.5, player.z, 1.35);
                spawnParticles(m.x, m.y + 2.2, m.z, 0xd946ef, 18, true);
              }
              if (m._perchT <= 0) {
                m._perchState = null; m._perchCd = 24 + Math.random() * 10;
                m.flying = true; m.vy = 6.0; playSfx('wing_flap');
                spawnPixelFx('explosion_ender', m.x, m.y + 1.0, m.z, { count: 4, scale: 3.4, life: 0.55, spread: 2.2 });
              }
            }
          }
        }

        if (m.tamed && m.elemDragon) {
          m.hostile = false; m.isBoss = false;
          const scD = m.dragonScale || 1.0;
          if (player.ridingDragon === m) {
            speed = player.curSpeed || 0;
          } else if (m.sitting) {
            m.flying = false;
            m._landedIdle = true;
            speed = 0;
            const gySit = _getDragonGroundSurfaceY(m.x, Math.max(m.y, player.y) + 2, m.z, scD);
            const targetSitY = Math.max(WATER_LEVEL + 0.02, gySit);
            m.y = Math.max(targetSitY, m.y + (targetSitY - m.y) * Math.min(1, dt * 8.0));
            m.vx = 0; m.vz = 0; m.svx = 0; m.svz = 0;
            m.flyVx = 0; m.flyVy = 0; m.flyVz = 0; m._flyPitch = 0;
            if (dist < 14 + scD * 2.0) {
              const targetYawS = Math.atan2(player.x - m.x, player.z - m.z);
              let dYS = targetYawS - m.yaw; while (dYS > Math.PI) dYS -= Math.PI * 2; while (dYS < -Math.PI) dYS += Math.PI * 2;
              m.yaw += dYS * Math.min(1, dt * 4.5);
            }
          } else {
            // Companion Tamed Dragon: Auto-Teleport when far/stuck + >=50% Combat Assist + Grounded Idle & Smooth Follow!
            m._stuckCheckT = (m._stuckCheckT || 0) + dt;
            if (m._stuckCheckT > 1.0) {
              const moved1 = Math.hypot(m.x - (m._lastCompX || m.x), m.z - (m._lastCompZ || m.z));
              m._compStuck = (dist3D > 16 && moved1 < 0.85) ? ((m._compStuck || 0) + m._stuckCheckT) : 0;
              m._lastCompX = m.x; m._lastCompZ = m.z; m._stuckCheckT = 0;
            }
            if (dist3D > (44 + scD * 3.0) || (m._compStuck || 0) > 4.0) {
              m._compStuck = 0;
              m._landedIdle = false;
              const tpAng = player.yaw + 2.2 + Math.random() * 1.4;
              const tpOff = 5.0 + scD * 1.4;
              const txP = player.x + Math.cos(tpAng) * tpOff, tzP = player.z + Math.sin(tpAng) * tpOff;
              const gyP = _getDragonGroundSurfaceY(txP, player.y + 4, tzP, scD);
              m.x = txP; m.z = tzP; m.y = Math.max(player.y + 2.4, gyP + 1.6);
              m.rx = m.x; m.ry = m.y; m.rz = m.z;
              spawnParticles(m.x, m.y + 0.8, m.z, 0xfbbf24, 14, true);
            }
            let assistTgt = ((m.growth || 0) >= 50 && _playerCombatTarget && !_playerCombatTarget._dead && !_playerCombatTarget.tamed) ? _playerCombatTarget : null;
            if (!assistTgt && (m.growth || 0) >= 50) {
              let bestD = 52;
              for (let ai = 0; ai < mobs.length; ai++) {
                const cand = mobs[ai];
                if (!cand || cand._dead || cand === m || cand.tamed) continue;
                if (!(cand.hostile || (cand.neutral && cand.provoked > 0))) continue;
                const maxR = IS_DRAGON_MOB.has(cand.type) ? 52 : 26;
                const cd = Math.hypot(cand.x - player.x, cand.y - player.y, cand.z - player.z);
                if (cd < Math.min(bestD, maxR)) { bestD = cd; assistTgt = cand; }
              }
            }
            if (assistTgt) {
              m.flying = true;
              m._landedIdle = false;
              const adx = assistTgt.x - m.x, ady = (assistTgt.y + assistTgt.hitboxH * 0.5) - (m.y + 1.0), adz = assistTgt.z - m.z;
              const ad = Math.hypot(adx, ady, adz) || 1;
              m.yaw = _turnAngleTowards(m.yaw, Math.atan2(adx, adz), 5.6, dt);
              const keepD = 7.5 + scD * 1.4;
              const mvSpd = ad > keepD + 2 ? 11.0 : (ad < keepD - 2 ? -2.0 : 3.6);
              const gyA = _getDragonGroundSurfaceY(m.x, m.y + 4, m.z, scD);
              const wantAY = Math.max(gyA + 2.0 + scD * 1.2, assistTgt.y + 3.2 + scD * 0.6);
              const desVx = (adx / ad) * mvSpd, desVz = (adz / ad) * mvSpd, desVy = (wantAY - m.y) * 2.8;
              const fk = 1 - Math.exp(-6.5 * dt);
              m.flyVx = (m.flyVx || 0) + (desVx - (m.flyVx || 0)) * fk;
              m.flyVy = (m.flyVy || 0) + (desVy - (m.flyVy || 0)) * fk;
              m.flyVz = (m.flyVz || 0) + (desVz - (m.flyVz || 0)) * fk;
              const nxD = m.x + m.flyVx * dt, nzD = m.z + m.flyVz * dt, nyD = m.y + m.flyVy * dt;
              if (!isSolidAt(Math.floor(nxD), Math.floor(nyD), Math.floor(m.z))) m.x = nxD;
              if (!isSolidAt(Math.floor(m.x), Math.floor(nyD), Math.floor(nzD))) m.z = nzD;
              if (!isSolidAt(Math.floor(m.x), Math.floor(nyD), Math.floor(m.z))) m.y = Math.max(gyA + 0.5, nyD);
              m._flyPitch = Math.max(-0.34, Math.min(0.34, -(m.flyVy || 0) * 0.045));
              if (m.atkCd <= 0 && ad < 36) {
                m.atkCd = 1.50; m.atkAnimT = 0.45;
                const kMap = { ice: 'drg_ice', fire: 'drg_fire', earth: 'drg_earth', water: 'drg_water', leaf: 'drg_leaf', tree: 'drg_tree' };
                const mp = getDragonMouthWorldPos(m, _mouthPos);
                const mdx2 = assistTgt.x - mp.x, mdy2 = (assistTgt.y + assistTgt.hitboxH * 0.55) - mp.y, mdz2 = assistTgt.z - mp.z;
                const mlen = Math.hypot(mdx2, mdy2, mdz2) || 1;
                fireEnergyOrb(mp.x, mp.y, mp.z, mdx2 / mlen, mdy2 / mlen, mdz2 / mlen, 27.0, m.dmg, kMap[m.elemDragon] || 'drg_fire', { friendlyDragon: true, ownerDragon: m, scale: 3.0, splashR: 5.5 });
              }
              speed = Math.hypot(m.flyVx || 0, m.flyVz || 0);
            } else {
              const gyF = _getDragonGroundSurfaceY(m.x, Math.max(m.y, player.y) + 2, m.z, scD);
              const wantLandY = Math.max(WATER_LEVEL + 0.02, gyF);
              const stayGroundedBand = m._landedIdle ? (11.5 + scD * 2.5) : (9.0 + scD * 2.0);
              if (player.y - gyF < 4.5 && dist < stayGroundedBand) {
                if (m.y <= wantLandY + 1.25) {
                  m.flying = false;
                  m._landedIdle = true;
                  m.y = Math.max(wantLandY, m.y + (wantLandY - m.y) * Math.min(1, dt * 7.5));
                  m.vx = 0; m.vz = 0; m.svx = 0; m.svz = 0;
                  m.flyVx = 0; m.flyVy = 0; m.flyVz = 0;
                  m._flyPitch = 0;
                  speed = 0;
                  if (dist < 16 + scD * 2.0) {
                    m.yaw = _turnAngleTowards(m.yaw, Math.atan2(player.x - m.x, player.z - m.z), 3.2, dt);
                  }
                } else {
                  m.flying = true;
                  m._landedIdle = false;
                  const ldx = (player.x + Math.cos(i * 1.9 + 0.8) * (4.0 + scD * 1.2)) - m.x;
                  const ldz = (player.z + Math.sin(i * 1.9 + 0.8) * (4.0 + scD * 1.2)) - m.z;
                  const ld = Math.hypot(ldx, ldz);
                  if (ld > 0.6) m.yaw = _turnAngleTowards(m.yaw, Math.atan2(ldx, ldz), 4.2, dt);
                  const lSpd = Math.min(9.5, ld * 1.6);
                  const fk = 1 - Math.exp(-5.5 * dt);
                  m.flyVx = (m.flyVx || 0) + ((ld > 0.4 ? (ldx / ld) * lSpd : 0) - (m.flyVx || 0)) * fk;
                  m.flyVz = (m.flyVz || 0) + ((ld > 0.4 ? (ldz / ld) * lSpd : 0) - (m.flyVz || 0)) * fk;
                  m.flyVy = (m.flyVy || 0) + (Math.max(-6.5, (wantLandY - m.y) * 2.4) - (m.flyVy || 0)) * fk;
                  const nxD = m.x + m.flyVx * dt, nzD = m.z + m.flyVz * dt, nyD = Math.max(wantLandY, m.y + m.flyVy * dt);
                  if (!isSolidAt(Math.floor(nxD), Math.floor(nyD + 0.5), Math.floor(m.z))) m.x = nxD;
                  if (!isSolidAt(Math.floor(m.x), Math.floor(nyD + 0.5), Math.floor(nzD))) m.z = nzD;
                  m.y = Math.max(wantLandY, nyD);
                  m._flyPitch = Math.max(-0.26, Math.min(0.26, -(m.flyVy || 0) * 0.04));
                  speed = Math.hypot(m.flyVx || 0, m.flyVz || 0);
                }
              } else {
                m._landedIdle = false;
                m.flying = true;
                const orbAng = elapsed * 0.62 + i;
                const orbR = 4.8 + scD * 2.2;
                const ftx = player.x + Math.cos(orbAng) * orbR, ftz = player.z + Math.sin(orbAng) * orbR;
                const fdx = ftx - m.x, fdz = ftz - m.z, fd = Math.hypot(fdx, fdz);
                if (fd > 0.6) m.yaw = _turnAngleTowards(m.yaw, Math.atan2(fdx, fdz), 4.8, dt);
                const fSpd = Math.min(13.0, Math.max(0.0, (fd - 0.5) * 2.1));
                const desVx = fd > 0.01 ? (fdx / fd) * fSpd : 0, desVz = fd > 0.01 ? (fdz / fd) * fSpd : 0;
                const wantFY = Math.max(gyF + 2.4 + scD * 1.4, player.y + 2.6 + scD * 0.7 + Math.sin(elapsed * 2.1 + i) * 0.40);
                const desVy = (wantFY - m.y) * 2.6;
                const fk = 1 - Math.exp(-5.5 * dt);
                m.flyVx = (m.flyVx || 0) + (desVx - (m.flyVx || 0)) * fk;
                m.flyVy = (m.flyVy || 0) + (desVy - (m.flyVy || 0)) * fk;
                m.flyVz = (m.flyVz || 0) + (desVz - (m.flyVz || 0)) * fk;
                const nxD = m.x + m.flyVx * dt, nzD = m.z + m.flyVz * dt, nyD = m.y + m.flyVy * dt;
                if (!isSolidAt(Math.floor(nxD), Math.floor(nyD), Math.floor(m.z))) m.x = nxD;
                if (!isSolidAt(Math.floor(m.x), Math.floor(nyD), Math.floor(nzD))) m.z = nzD;
                if (!isSolidAt(Math.floor(m.x), Math.floor(nyD), Math.floor(m.z))) m.y = Math.max(gyF + 0.5, nyD);
                else m.y = Math.min(MAX_Y - 4, m.y + dt * 3.0);
                m._flyPitch = Math.max(-0.32, Math.min(0.32, -(m.flyVy || 0) * 0.042));
                speed = Math.hypot(m.flyVx || 0, m.flyVz || 0);
              }
            }
          }
        } else {

        const engageRange = isDragon ? 96 : (isGhast ? 32 : 24);
        const canSeePlayer = isAggroToPlayer && !player.dead && gameMode !== 'creative' && dist3D < engageRange && !(currentDimension === 'overworld' && player.y < -3) && ((isDragon && dist3D < 82) || hasLineOfSight(m.x, m.y + 1.2, m.z, player.x, player.y + 1.1, player.z));
        // Wild dragons detect & attack nearby tamed player dragons too!
        let wildDrgMobTgt = null, wildDrgMobD = 88;
        if (isDragon && !m.tamed) {
          for (let ti = 0; ti < _mobSnapBuf.length; ti++) {
            const tm = _mobSnapBuf[ti];
            if (!tm || tm._dead || tm === m || !tm.tamed) continue;
            if (!tm.elemDragon && tm.type !== 'baby_dragon' && !DEFENDER_PETS.has(tm.type)) continue;
            const td = Math.hypot(tm.x - m.x, tm.y - m.y, tm.z - m.z);
            if (td < wildDrgMobD) { wildDrgMobD = td; wildDrgMobTgt = tm; }
          }
        }
        const useTamedTgt = isDragon && wildDrgMobTgt && (!canSeePlayer || wildDrgMobD <= dist3D + 4.0);
        const aimTgtMob = useTamedTgt ? wildDrgMobTgt : null;
        const aimX = aimTgtMob ? aimTgtMob.x : player.x;
        const aimY = aimTgtMob ? (aimTgtMob.y + (aimTgtMob.hitboxH || 1.8) * 0.55) : (player.y + 1.0);
        const aimZ = aimTgtMob ? aimTgtMob.z : player.z;
        const aimDist = aimTgtMob ? Math.hypot(aimX - m.x, aimZ - m.z) : dist;
        const aimDist3D = aimTgtMob ? Math.hypot(aimX - m.x, aimY - m.y, aimZ - m.z) : dist3D;
        const _drgHomeLeash = (isDragon && !m.tamed && typeof m.homeX === 'number') ? (m.type === 'ender_dragon' ? 92 : (m.homeRadius || 100)) : 0;
        const _drgAimFromHome = _drgHomeLeash > 0 ? Math.hypot(aimX - m.homeX, aimZ - m.homeZ) : 0;
        const hasTarget = (canSeePlayer || !!aimTgtMob) && (!_drgHomeLeash || _drgAimFromHome <= _drgHomeLeash + 4);
        if (_drgHomeLeash > 0 && Math.hypot(m.x - m.homeX, m.z - m.homeZ) > _drgHomeLeash + 2) m.swoopT = 0;

        if (m._perchState) {
          speed = 0; m.vx = 0; m.vz = 0;
        } else {
        if (isDragon && !m.tamed && !(m.elemDragon && (m.dragonMode === 'land' || m.dragonMode === 'ground'))) {
          m.vy *= 0.85;
          if (_drgSolidAt(m.x, m.y, m.z)) {
            m.swoopT = 0;
            m.y = Math.min(MAX_Y - 5, m.y + Math.max(12.0 * dt, 0.45));
            m.flyVy = Math.max(m.flyVy || 0, 7.5);
          }
        }
        if (m.elemDragon && (m.dragonMode === 'land' || m.dragonMode === 'ground')) {
          m.swoopT = 0;
          const landTargetX = hasTarget ? aimX : (typeof m.homeX === 'number' ? m.homeX : aimX);
          const landTargetZ = hasTarget ? aimZ : (typeof m.homeZ === 'number' ? m.homeZ : aimZ);
          m.yaw = _turnAngleTowards(m.yaw, Math.atan2(landTargetX - m.x, landTargetZ - m.z), 4.5, dt);
          speed = (hasTarget && aimDist > Math.max(6.5, (m.hitboxR || 2.0) + 2.4)) ? 3.8 : 0;
          const fnx = m.x + (Math.sin(m.yaw) * speed + m.vx) * dt, fnz = m.z + (Math.cos(m.yaw) * speed + m.vz) * dt;
          if ((!_drgHomeLeash || Math.hypot(fnx - m.homeX, fnz - m.homeZ) <= _drgHomeLeash) && !isSolidAt(Math.floor(fnx), Math.floor(m.y + 0.5), Math.floor(fnz))) { m.x = fnx; m.z = fnz; }
          m.vx *= 0.9; m.vz *= 0.9;
        } else if (hasTarget) {
          if (isGhast || isBlaze) {
            m.yaw = Math.atan2(player.x - m.x, player.z - m.z);
            const desiredD = isGhast ? 16.0 : 9.0;
            if (dist < desiredD - 3) speed = -m.speed * 0.6;
            else if (dist < desiredD + 3) speed = m.speed * 0.25;
            const nextY = m.y + (targetH - m.y) * dt * 1.5;
            if (!isSolidAt(Math.floor(m.x), Math.floor(nextY), Math.floor(m.z))) m.y = nextY;
            if (m.atkCd <= 0 && dist3D < engageRange) {
              const orbSpd = isGhast ? 15.0 : 18.5;
              const aim = computeSmartAimDir(m.x, m.y + 1.2, m.z, player.x, player.y + 1.0, player.z, (player.smoothMoveX || 0) + player.vx, player.vy, (player.smoothMoveZ || 0) + player.vz, orbSpd, 0, 0.012);
              const shots = (m.type === 'wildfire') ? 3 : 1;
              for (let si = 0; si < shots; si++) {
                const spAng = (si - (shots - 1) * 0.5) * 0.16;
                const ax = aim.x * Math.cos(spAng) - aim.z * Math.sin(spAng);
                const az = aim.x * Math.sin(spAng) + aim.z * Math.cos(spAng);
                fireEnergyOrb(m.x + ax * 1.3, m.y + 1.2, m.z + az * 1.3, ax, aim.y, az, orbSpd, m.dmg, isGhast ? 'ghast_fire' : (m.type === 'soul_wisp' ? 'sonic_boom' : 'blaze_fire'));
              }
              m.atkCd = isGhast ? 3.4 : (m.type === 'wildfire' ? 1.85 : 2.1);
            }
          } else if (m.swoopT > 0) {
            m.swoopT -= dt;
            const dYawS = Math.atan2(aimX - m.x, aimZ - m.z);
            m.yaw = isDragon ? _turnAngleTowards(m.yaw, dYawS, 5.2, dt) : dYawS;
            speed = isDragon ? m.speed * 1.65 : m.speed * 1.25;
            const fkS = 1 - Math.exp(-5.8 * dt);
            const desVyS = ((aimY + (isDragon ? 1.6 : 0.4)) - m.y) * (isDragon ? 3.2 : 3.5);
            const desVxS = Math.sin(m.yaw) * speed, desVzS = Math.cos(m.yaw) * speed;
            m.flyVx = (m.flyVx || 0) + (desVxS - (m.flyVx || 0)) * fkS;
            m.flyVy = (m.flyVy || 0) + (desVyS - (m.flyVy || 0)) * fkS;
            m.flyVz = (m.flyVz || 0) + (desVzS - (m.flyVz || 0)) * fkS;
            const nyS = m.y + m.flyVy * dt;
            if (isDragon) {
              const minSwoopY = Math.max((m._groundY || 2) + 3.2, aimY + 1.8);
              if (nyS <= minSwoopY || _drgSolidAt(m.x, nyS, m.z)) {
                m.y = Math.max(m.y, minSwoopY);
                m.swoopT = 0;
                m.flyVy = Math.max(6.5, (m.flyVy || 0) + 8.0);
              } else {
                m.y = nyS;
              }
            } else {
              if (!isSolidAt(Math.floor(m.x), Math.floor(nyS), Math.floor(m.z))) m.y = nyS;
              else m.swoopT = 0;
            }
            m._flyPitch = Math.max(-0.42, Math.min(0.42, -m.flyVy * 0.05));
            if (m.type === 'ender_dragon' && (frameCounter % 2) === 0) {
              spawnParticles(m.x, m.y + 1.5, m.z, 0xd946ef, 3, true);
            }
            const hitD = Math.hypot(aimX - m.x, aimY - m.y, aimZ - m.z);
            if (hitD < (isDragon ? 5.6 : 1.8) && m.atkCd <= 0) {
              if (m.type === 'ender_dragon') spawnPixelFx('explosion_ender', m.x, m.y + 1.4, m.z, { count: 5, scale: 3.8, life: 0.62, spread: 3.2 });
              if (aimTgtMob) {
                hurtMob(aimTgtMob, m.dmg * 1.25, aimX - m.x, aimZ - m.z, 7.2, m.elemDragon === 'fire', false);
                spawnParticles(aimX, aimY, aimZ, m.type === 'ender_dragon' ? 0xd946ef : 0xf97316, 18, true);
                m.atkCd = 1.8; m.swoopT = 0;
              } else if (!player.dead && gameMode !== 'creative' && hasLineOfSight(m.x, m.y + 0.8, m.z, player.x, player.y + 0.9, player.z)) {
                hurtPlayer(m.dmg, isDragon ? `Bạn bị ${m.displayName} bổ nhào quật ngã!` : `Bạn bị ${m.displayName} bổ nhào tấn công!`);
                if (isDragon) {
                  cameraShake = 0.54;
                  player.vy = Math.max(player.vy, 8.5);
                  spawnParticles(m.x, m.y + 1.0, m.z, 0xd946ef, 22, true);
                }
                m.atkCd = 2.0; m.swoopT = 0;
              }
            }
          } else {
            const hpPct = m.hp / m.maxHp;
            const dPhase = hpPct < 0.34 ? 3 : (hpPct < 0.67 ? 2 : 1);
            const orbitR = isDragon ? (_drgHomeLeash > 0 ? Math.min(34.0, _drgHomeLeash * 0.45) : (dPhase === 3 ? 22.0 : 28.0)) : 8.5;
            const orbitAng = elapsed * (isDragon ? (0.48 + dPhase * 0.11) : 0.92) + i;
            let tx = aimX + Math.cos(orbitAng) * orbitR, tz = aimZ + Math.sin(orbitAng) * orbitR;
            if (_drgHomeLeash > 0) {
              const hd = Math.hypot(tx - m.homeX, tz - m.homeZ);
              if (hd > _drgHomeLeash - 4) { const scH = (_drgHomeLeash - 4) / hd; tx = m.homeX + (tx - m.homeX) * scH; tz = m.homeZ + (tz - m.homeZ) * scH; }
            }
            const desYawO = Math.atan2(tx - m.x, tz - m.z);
            m.yaw = isDragon ? _turnAngleTowards(m.yaw, desYawO, 4.0, dt) : desYawO;
            const desH = isDragon ? Math.min(MAX_Y - 5, Math.max((m._groundY || 2) + 12.5, aimY + 11.5)) : targetH;
            if (isDragon) {
              const fkO = 1 - Math.exp(-4.6 * dt);
              const desVxO = Math.sin(m.yaw) * speed, desVzO = Math.cos(m.yaw) * speed, desVyO = (desH - m.y) * 2.2;
              m.flyVx = (m.flyVx || 0) + (desVxO - (m.flyVx || 0)) * fkO;
              m.flyVy = (m.flyVy || 0) + (desVyO - (m.flyVy || 0)) * fkO;
              m.flyVz = (m.flyVz || 0) + (desVzO - (m.flyVz || 0)) * fkO;
              const nyO = m.y + m.flyVy * dt;
              _applyDrgY(nyO);
              m._flyPitch = Math.max(-0.34, Math.min(0.34, -m.flyVy * 0.045));
            } else {
              const nextY = m.y + (targetH - m.y) * dt * 1.5;
              if (!isSolidAt(Math.floor(m.x), Math.floor(nextY), Math.floor(m.z))) m.y = nextY;
            }
            if (isDragon && m.sovereignBoss) {
              if (m._restT > 0) {
                m._restT -= dt;
                m.lastSkillLabel = `👑 HỒI SỨC THỞ DỐC (${Math.ceil(m._restT)}s)`;
              } else if (m._skillChargeT > 0) {
                m._skillChargeT -= dt;
                const pend = m._pendingSkill;
                if (pend) m.lastSkillLabel = `⏳ GỒNG CHIÊU ${pend.id}/50: ${pend.name.toUpperCase()}!`;
                if (m._skillChargeT <= 0 && pend) {
                  _execSovereignSkill(m, pend, aimX, aimY, aimZ, aimDist3D);
                  m._pendingSkill = null;
                  m._skillsSinceRest = (m._skillsSinceRest || 0) + 1;
                  if (m._skillsSinceRest >= 4) { m._restT = 6.5; m._skillsSinceRest = 0; m.atkCd = 1.5; }
                  else { m.atkCd = 3.8 + Math.random() * 1.2; }
                }
              } else if (m.atkCd <= 0 && aimDist3D < 82) {
                m._pendingSkill = _drawNextSovereignSkill(m);
                m._skillChargeT = 0.85;
                spawnParticles(m.x, m.y + 3.0, m.z, m._pendingSkill.col, 18, true);
              }
            } else if (isDragon && m.atkCd <= 0 && aimDist3D < 72) {
              if (m.elemDragon) {
                castElementalDragonAerialSkill(m, aimDist3D, aimTgtMob);
              } else {
                const mp = getDragonMouthWorldPos(m, _mouthPos);
                const dx = aimX - mp.x, dy = aimY - mp.y, dz = aimZ - mp.z;
                const dLen = Math.hypot(dx, dy, dz) || 1;
                m._edSkIdx = ((m._edSkIdx || 0) + 1) % 5;
                const edSk = m._edSkIdx;
                m.atkAnimT = 0.60; m._roarT = 1.25; playSfx('roar');
                if (edSk === 0) {
                  m.lastSkillLabel = '☠️ KỸ NĂNG 1: HƠI THỞ AXIT HƯ KHÔNG!';
                  for (let si = -1; si <= 1; si++) {
                    const sp = si * 0.16;
                    const sx = (dx / dLen) * Math.cos(sp) - (dz / dLen) * Math.sin(sp);
                    const sz = (dx / dLen) * Math.sin(sp) + (dz / dLen) * Math.cos(sp);
                    fireEnergyOrb(mp.x, mp.y, mp.z, sx, dy / dLen, sz, 24.0, m.dmg * 0.85, 'dragon_ball', { scale: 3.4, splashR: 6.2, effect: 'acid', ownerDragon: m });
                  }
                  const clY = Math.max(2, _getDragonGroundSurfaceY(aimX, aimY + 4, aimZ, m.dragonScale));
                  spawnDragonBreathCloud(aimX, clY, aimZ, 1.45);
                  spawnDragonBreathCloud(aimX + (Math.random() - 0.5) * 6, clY, aimZ + (Math.random() - 0.5) * 6, 1.25);
                  m.atkCd = 2.8;
                } else if (edSk === 1) {
                  m.lastSkillLabel = '☄️ KỸ NĂNG 2: MƯA THIÊN THẠCH ENDER!';
                  for (let mi = 0; mi < 5; mi++) {
                    const txM = aimX + (mi === 0 ? 0 : (Math.random() - 0.5) * 10);
                    const tzM = aimZ + (mi === 0 ? 0 : (Math.random() - 0.5) * 10);
                    fireEnergyOrb(txM, aimY + 24 + mi * 2, tzM, 0, -1, 0, 22.0, m.dmg * 1.05, 'dragon_ball', { pfxKey: 'explosion_ender', scale: 3.8, splashR: 6.8, gravity: 9.0, ownerDragon: m });
                  }
                  m.atkCd = 3.2;
                } else if (edSk === 2) {
                  m.lastSkillLabel = '🌀 KỸ NĂNG 3: HỐ ĐEN TRỌNG LỰC HƯ VÔ!';
                  const vxY = _getDragonGroundSurfaceY(aimX, aimY + 4, aimZ, m.dragonScale);
                  spawnEnderVortex(aimX, vxY, aimZ, m.dmg * 1.15);
                  m.atkCd = 3.4;
                } else if (edSk === 3) {
                  m.lastSkillLabel = '⚡ KỸ NĂNG 4: THIÊN LÔI PHÁN QUYẾT ENDER!';
                  cameraShake = Math.max(cameraShake, 0.44);
                  for (let li = 0; li < 4; li++) {
                    const lx = aimX + (li === 0 ? 0 : (Math.random() - 0.5) * 11);
                    const lz = aimZ + (li === 0 ? 0 : (Math.random() - 0.5) * 11);
                    const ly = _getDragonGroundSurfaceY(lx, aimY + 4, lz, m.dragonScale);
                    for (let h = 0; h <= 10; h += 5) spawnPixelFx('lightning_arc', lx, ly + h + 1.5, lz, { count: 2, scale: 3.0, life: 0.48, spread: 0.5 });
                    spawnPixelFx('explosion_ender', lx, ly + 1.2, lz, { count: 3, scale: 3.2, life: 0.52, spread: 1.5 });
                    if (!player.dead && gameMode !== 'creative' && Math.hypot(player.x - lx, player.z - lz) < 4.5 && Math.abs(player.y - ly) < 6.0) {
                      hurtPlayer(m.dmg * 0.75, 'Bạn bị Thiên Lôi Phán Quyết của Rồng Ender đánh trúng!');
                    }
                  }
                  m.atkCd = 3.0;
                } else {
                  m.lastSkillLabel = '🌌 KỸ NĂNG 5: XÉ RÁCH KHÔNG GIAN BỔ NHÀO!';
                  m.swoopT = 2.6;
                  spawnParticles(m.x, m.y + 1.4, m.z, 0xd946ef, 24, true);
                  m.atkCd = 1.6;
                }
              }
            } else if (!isDragon && m.atkCd <= 0 && dist3D < 16) { m.swoopT = 1.8; playSfx('roar'); }
          }
        } else {
          m.swoopT = 0;
          m.wanderT -= dt; if (m.wanderT <= 0) { m.wanderT = 3 + Math.random() * 3; m._wanderYaw = (m._wanderYaw ?? m.yaw) + (Math.random() - 0.5) * 1.8; }
          if (isDragon && !m.tamed && typeof m.homeX === 'number') {
            const orbR = Math.min(48, (m.homeRadius || 100) * 0.45);
            m._orbitAng = (m._orbitAng !== undefined ? m._orbitAng : Math.atan2(m.z - m.homeZ, m.x - m.homeX)) + dt * 0.34;
            const ox = m.homeX + Math.cos(m._orbitAng) * orbR, oz = m.homeZ + Math.sin(m._orbitAng) * orbR;
            const wantY = Math.min(MAX_Y - 5, Math.max((m._groundY || WATER_LEVEL + 2) + 10.5, m.homeY || targetH));
            const desYawO = Math.atan2(ox - m.x, oz - m.z);
            m.yaw = _turnAngleTowards(m.yaw, desYawO, 3.4, dt);
            const fkW = 1 - Math.exp(-4.0 * dt);
            const orbSpd = speed * 0.85;
            const odx = ox - m.x, odz = oz - m.z, od = Math.hypot(odx, odz) || 1;
            const desVxW = (odx / od) * orbSpd, desVzW = (odz / od) * orbSpd, desVyW = (wantY - m.y) * 2.0;
            m.flyVx = (m.flyVx || 0) + (desVxW - (m.flyVx || 0)) * fkW;
            m.flyVy = (m.flyVy || 0) + (desVyW - (m.flyVy || 0)) * fkW;
            m.flyVz = (m.flyVz || 0) + (desVzW - (m.flyVz || 0)) * fkW;
            const nyW = m.y + m.flyVy * dt;
            _applyDrgY(nyW);
            m._flyPitch = Math.max(-0.28, Math.min(0.28, -m.flyVy * 0.04));
          } else if (isDragon) {
            m.yaw = _turnAngleTowards(m.yaw, m._wanderYaw ?? m.yaw, 2.8, dt);
            const fkW = 1 - Math.exp(-3.6 * dt);
            const desVxW = Math.sin(m.yaw) * speed * 0.85, desVzW = Math.cos(m.yaw) * speed * 0.85, desVyW = (targetH - m.y) * 1.8;
            m.flyVx = (m.flyVx || 0) + (desVxW - (m.flyVx || 0)) * fkW;
            m.flyVy = (m.flyVy || 0) + (desVyW - (m.flyVy || 0)) * fkW;
            m.flyVz = (m.flyVz || 0) + (desVzW - (m.flyVz || 0)) * fkW;
            const nyW = m.y + m.flyVy * dt;
            _applyDrgY(nyW);
            m._flyPitch = Math.max(-0.28, Math.min(0.28, -m.flyVy * 0.04));
          } else {
            m.yaw = m._wanderYaw ?? m.yaw;
            const nextY = m.y + (targetH - m.y) * dt * 1.5;
            if (!isSolidAt(Math.floor(m.x), Math.floor(nextY), Math.floor(m.z))) m.y = nextY;
          }
        }
        if (!(m.elemDragon && (m.dragonMode === 'land' || m.dragonMode === 'ground'))) {
          if (isDragon && (m._flyAvoidT || 0) > 0) {
            m._flyAvoidT = Math.max(0, m._flyAvoidT - dt);
            const avYaw = (m._flyAvoidYaw !== undefined) ? m._flyAvoidYaw : (m.yaw + Math.PI * 0.75);
            m.yaw = _turnAngleTowards(m.yaw, avYaw, 6.0, dt);
            const avK = 1 - Math.exp(-6.0 * dt);
            m.flyVx = (m.flyVx || 0) + (Math.sin(avYaw) * speed - (m.flyVx || 0)) * avK;
            m.flyVz = (m.flyVz || 0) + (Math.cos(avYaw) * speed - (m.flyVz || 0)) * avK;
            m.flyVy = Math.max(m.flyVy || 0, 4.5);
          }
          const mvX = (isDragon && m.flyVx !== undefined) ? m.flyVx : Math.sin(m.yaw) * speed;
          const mvZ = (isDragon && m.flyVz !== undefined) ? m.flyVz : Math.cos(m.yaw) * speed;
          const fnx = m.x + (mvX + m.vx) * dt, fnz = m.z + (mvZ + m.vz) * dt;
          if (_drgHomeLeash > 0 && Math.hypot(fnx - m.homeX, fnz - m.homeZ) > _drgHomeLeash && Math.hypot(fnx - m.homeX, fnz - m.homeZ) > Math.hypot(m.x - m.homeX, m.z - m.homeZ)) {
            const toHYaw = Math.atan2(m.homeX - m.x, m.homeZ - m.z);
            m.yaw = _turnAngleTowards(m.yaw, toHYaw, 6.5, dt);
            m.flyVx = Math.sin(toHYaw) * speed * 0.9; m.flyVz = Math.cos(toHYaw) * speed * 0.9;
            m.x += m.flyVx * dt; m.z += m.flyVz * dt;
          } else if (isDragon) {
            if (!_drgSolidAt(fnx, m.y, fnz)) {
              m.x = fnx; m.z = fnz;
            } else {
              let hitObs = false;
              if (!_drgSolidAt(fnx, m.y, m.z)) m.x = fnx; else hitObs = true;
              if (!_drgSolidAt(m.x, m.y, fnz)) m.z = fnz; else hitObs = true;
              if (hitObs) {
                const probes = [0.8, -0.8, 1.6, -1.6, Math.PI];
                let escYaw = m.yaw + Math.PI * 0.75;
                for (let pi = 0; pi < probes.length; pi++) {
                  const cy = m.yaw + probes[pi];
                  if (!_drgSolidAt(m.x + Math.sin(cy) * 3.5, m.y + 1.5, m.z + Math.cos(cy) * 3.5)) { escYaw = cy; break; }
                }
                m.yaw = escYaw; m._wanderYaw = escYaw; m._flyAvoidYaw = escYaw; m._flyAvoidT = 1.4;
                m.flyVx = Math.sin(escYaw) * speed; m.flyVz = Math.cos(escYaw) * speed;
                m.flyVy = Math.max(m.flyVy || 0, 6.5);
                if (!_drgSolidAt(m.x, m.y + 1.5, m.z)) m.y = Math.min(MAX_Y - 5, m.y + 4.5 * dt);
              }
            }
          } else if (!isSolidAt(Math.floor(fnx), Math.floor(m.y + 0.5), Math.floor(fnz))) { m.x = fnx; m.z = fnz; }
          else {
            m.yaw += Math.PI * 0.6;
          }
          m.vx *= 0.9; m.vz *= 0.9;
          if (isDragon && !m.tamed && !m._perchState) {
            m._flyStuckCheckT = (m._flyStuckCheckT || 0) + dt;
            if (m._flyStuckCheckT >= 1.0) {
              const movedF = Math.hypot(m.x - (m._flyLastX ?? m.x), m.y - (m._flyLastY ?? m.y), m.z - (m._flyLastZ ?? m.z));
              m._flyStuckT = movedF < 1.2 ? ((m._flyStuckT || 0) + m._flyStuckCheckT) : 0;
              m._flyLastX = m.x; m._flyLastY = m.y; m._flyLastZ = m.z;
              m._flyStuckCheckT = 0;
              if (m._flyStuckT >= 1.5) {
                m._flyStuckT = 0; m.swoopT = 0;
                const safeSky = _getSafeDragonSkyY(m.x, m.z, 14);
                m.y = Math.min(MAX_Y - 6, Math.max(m.y + 4.0, safeSky));
                const escYaw = m.yaw + Math.PI * 0.75;
                m.yaw = m._wanderYaw = m._flyAvoidYaw = escYaw;
                m._flyAvoidT = 1.6;
                m.flyVx = Math.sin(escYaw) * speed; m.flyVz = Math.cos(escYaw) * speed;
                m.flyVy = 5.0;
              }
            }
          }
        }
        }
        } // end wild/hostile flyer branch
      } else if (canChasePlayer && tgtP) {
        m.yaw = Math.atan2(tgtP.x - m.x, tgtP.z - m.z);
        if (m.atkCd > 0) m.atkCd -= dt;

        const isCreeperType = (m.type === 'creeper' || m.type === 'charged_creeper' || m.type === 'icy_creeper' || m.type === 'potato_creeper' || m.type === 'nerd_creeper' || m.type === 'ghost_creeper');
        if (isCreeperType) {
          if (tDist3D < 3.2 && tDyAbs < 2.2) {
            if (!m.fusing) { m.fusing = true; playSfx('hiss'); }
            m.fuseTimer += dt;
            const sw = 1.0 + Math.sin(m.fuseTimer * 18) * 0.12 + m.fuseTimer * 0.16;
            m.group.scale.set(sw, 1.0 + m.fuseTimer * 0.08, sw);
            speed = 0.25;
            if (m.fuseTimer >= 1.45) {
              const ex = m.x, ey = m.y, ez = m.z;
              const cst = MOB_STATS[m.type] || MOB_STATS.creeper;
              const rad = cst.blastRadius || 3.2, dmg = cst.blastDmg || 16;
              const cName = m.displayName || 'Creeper';
              const isCharged = (m.type === 'charged_creeper'), isFrost = !!cst.frostBlast;
              if (activeRoomId && typeof broadcastMobRemove === 'function' && m.uid) broadcastMobRemove(m.uid);
              disposeMobInstance(m); const mi = mobs.indexOf(m); if (mi !== -1) { mobs[mi] = mobs[mobs.length - 1]; mobs.pop(); }
              triggerExplosion(ex, ey, ez, rad, dmg, `Bạn bị ${cName} phát nổ!`, { electric: isCharged, frost: isFrost });
              continue;
            }
          } else {
            if (m.fusing && tDist3D > 4.6) { m.fusing = false; m.fuseTimer = Math.max(0, m.fuseTimer - dt * 2); m.group.scale.set(1, 1, 1); }
          }
        } else if (m.ranged) {
          const isSJ = (m.type === 'spider_jockey');
          if (m.type === 'shulker') speed = 0;
          else if (isSJ) {
            if (tDist < 1.85) speed = 0;
            else if (tDist > 4.0 && tDist < 17.5) speed *= 1.16;
          }
          else if (tDist < 6.0) speed = -1.4;
          else if (tDist < 13.5) speed = 0.55;
          // Smooth tactical lateral strafing for ranged mobs
          if (m.type !== 'shulker' && !isSJ) {
            m._strafeT = (m._strafeT || 0) - dt;
            if (m._strafeT <= 0) {
              m._strafeT = 1.4 + Math.random() * 1.6;
              m._strafeDir = (Math.random() < 0.5) ? 1 : -1;
            }
          }
          if (isSJ && tDist < 2.05 && tDyAbs < 1.85 && m.atkCd <= 0) {
            _damageCombatTarget(tgtP, m.dmg, `Bạn bị ${m.displayName || 'Skeleton Cưỡi Nhện'} tấn công!`, m);
            m.atkCd = 1.15; m.atkAnimT = 0.42; playMobSfx('spider', 'attack');
          } else if (tDist3D < 17.5 && (!isSJ || tDist >= 2.2) && m.atkCd <= 0) {
            m.atkCd = m.type === 'shulker' ? 2.4 : (m.type === 'witch' || m.type === 'evoker' || m.type === 'iceologer' ? 2.1 : 1.85);
            m.atkAnimT = 0.45;
            const isOrb = (m.ranged === 'shulker_bolt' || m.ranged === 'evoker_fang' || m.ranged === 'witch_potion' || m.ranged === 'ice_shard' || m.ranged === 'trident' || m.ranged === 'blaze_fire' || m.ranged === 'poison_arrow' || m.ranged === 'sonic_boom');
            const pSpd = isOrb ? 16.5 : 20.0;
            const fireY = m.y + (isSJ ? 1.55 : (isOrb ? 1.15 : 1.35));
            const aimSpread = worldDifficulty === 'hard' ? 0.008 : (worldDifficulty === 'easy' ? 0.032 : 0.015);
            const aim = computeSmartAimDir(
              m.x, fireY, m.z,
              tgtP.x, tgtP.y + 1.05, tgtP.z,
              tgtP.vx, tgtP.vy, tgtP.vz,
              pSpd, isOrb ? 0 : 14.5, aimSpread
            );
            if (isOrb) {
              fireEnergyOrb(m.x + aim.x * 0.7, fireY, m.z + aim.z * 0.7, aim.x, aim.y, aim.z, pSpd, m.dmg, m.ranged);
            } else {
              fireArrow(m.x + aim.x * 0.6, fireY, m.z + aim.z * 0.6, aim.x, aim.y, aim.z, pSpd, false, m.dmg);
            }
          }
        } else {
          const atkRange = m.elemDragon ? Math.max(3.5, (m.hitboxR || 2.0) + 2.4) : ((m.isBoss || m.guardian || m.type === 'hoglin' || m.type === 'zoglin' || m.type === 'ravager' || m.type === 'void_golem') ? 2.55 : 1.95);
          if (m.elemDragon && !m.flying && m.atkCd <= 0 && tDist3D < Math.max(14.5, atkRange + 10.0) && tDist3D >= atkRange) {
            castElementalDragonGroundSkill(m, tDist3D);
          }
          // Hostile melee sprint pursuit + reactive dodge when player swings nearby!
          if (tDist > 4.0 && tDist < 17.5 && (isHumanoidPillar || m.type === 'void_stalker' || m.type === 'spider')) {
            speed *= 1.24;
          }
          if (m._dodgeCd > 0) m._dodgeCd -= dt;
          if (m._dodgeT > 0) m._dodgeT -= dt;
          if (tDist < 6.2 && tgtP.isLocal && player.swingT > 0.08 && (m._dodgeCd || 0) <= 0 && (isHumanoidPillar || m.type === 'void_stalker' || m.type === 'spider')) {
            m._dodgeT = 0.42;
            m._dodgeDir = Math.random() < 0.5 ? 1 : -1;
            m._dodgeCd = 2.4 + Math.random() * 1.4;
            if (m.onGround && (m.jumpCd || 0) <= 0 && Math.random() < 0.45) {
              m.vy = 6.2; m.onGround = false; m.jumpCd = 0.45;
            }
          }
          // Authentic Minecraft Melee Personal-Space Stand-Off: Stop cleanly in front of target instead of clipping inside!
          const minSep = Math.max(1.28, m.hitboxR + PLAYER_RADIUS + 0.52);
          if (tDist < minSep && tDyAbs < 2.2) {
            speed = tDist < minSep * 0.72 ? -0.9 : 0;
          }
          if (m.type === 'redstone_monstrosity' && tDist > 5.0 && tDist3D < 14.0 && m.atkCd <= 0) {
            const aim = computeSmartAimDir(m.x, m.y + 1.8, m.z, tgtP.x, tgtP.y + 1.0, tgtP.z, tgtP.vx, tgtP.vy, tgtP.vz, 17.5, 0, 0.014);
            fireEnergyOrb(m.x + aim.x * 1.4, m.y + 1.8, m.z + aim.z * 1.4, aim.x, aim.y, aim.z, 17.5, 7.5, 'blaze_fire');
            spawnParticles(m.x, m.y + 1.4, m.z, 0xef4444, 10, true);
            m.atkCd = 2.6; m.atkAnimT = 0.50;
          } else if (m.type === 'prismarine_colossus' && tDist > 4.2 && tDist3D < 15.0 && m.atkCd <= 0) {
            const aim = computeSmartAimDir(m.x, m.y + 1.8, m.z, tgtP.x, tgtP.y + 1.0, tgtP.z, tgtP.vx, tgtP.vy, tgtP.vz, 20.0, 0, 0.010);
            fireEnergyOrb(m.x + aim.x * 1.3, m.y + 1.8, m.z + aim.z * 1.3, aim.x, aim.y, aim.z, 20.0, 6.5, 'guardian_beam');
            m.atkCd = 2.5; m.atkAnimT = 0.48;
          } else if (tDist < atkRange && tDyAbs < 1.85 && m.atkCd <= 0) {
            const msgMap = {
              hoglin: 'Bạn bị Lợn Rừng Địa Ngục Hoglin húc bay!',
              zoglin: 'Bạn bị Lợn Địa Ngục Zoglin húc tung!',
              void_golem: 'Bạn bị Golem Thành End đập ngã!',
              magma_cube: 'Bạn bị Khối Magma Cube đè cháy!',
              endermite: 'Bạn bị Bọ Hư Không Endermite cắn!',
              ravager: 'Bạn bị Quái Thú Ravager húc tung!',
              piglin: 'Bạn bị Chiến Binh Piglin chém gục!',
              piglin_brute: 'Bạn bị Piglin Brute chém hạ!',
              vindicator: 'Bạn bị Cướp Dân Làng Cầm Rìu bổ hạ!',
              ruin_stalker: 'Bạn bị Quái Tàn Tích Ruin Stalker cào gục!',
              gargoyle: 'Bạn bị Quỷ Đá Cao Ốc Gargoyle tấn công!',
              wither_skeleton: 'Bạn bị Hắc Cốt Địa Ngục hạ gục!',
              cave_warden: 'Bạn bị Warden Hang Sâu nghiền nát!',
              magma_golem: 'Bạn bị Boss Golem Dung Nham nghiền nát!',
              redstone_monstrosity: 'Bạn bị Boss Quái Vật Redstone đập nát!',
              prismarine_colossus: 'Bạn bị Boss Thủ Thần Prismarine giáng đòn!',
              abyssal_colossus: 'Bạn bị Boss Khổng Lồ Biển Sâu nghiền bẹp!',
              ocean_barnacle: 'Bạn bị Quái Biển Barnacle cắn!',
              wildfire: 'Bạn bị Boss Thần Lửa Wildfire thiêu cháy!',
              iron_golem: 'Bạn bị Golem Sắt bảo vệ làng đánh gục!',
              void_stalker: 'Bạn bị Enderman tấn công!',
              wither_knight: 'Bạn bị Hiệp Sĩ Hắc Ám chém hạ!',
              husk: 'Bạn bị Xác Ướp Sa Mạc tấn công!',
              slime: 'Bạn bị Slime Ngọc đè bẹp!',
              sulfur_slime: 'Bạn bị Slime Lưu Huỳnh làm bỏng rát!',
              wolf: 'Bạn bị Sói Rừng cắn!',
              zombie: 'Bạn bị Zombie tấn công!',
              chicken_jockey: 'Bạn bị Baby Zombie Cưỡi Gà tấn công!',
              spider_jockey: 'Bạn bị Skeleton Cưỡi Nhện hạ gục!',
              spider: 'Bạn bị Nhện đêm tấn công!'
            };
            const isAxeMob = (m.type === 'piglin_brute' || m.type === 'vindicator' || m.type === 'wither_knight' || m.type === 'ravager');
            _damageCombatTarget(tgtP, m.dmg, msgMap[m.type] || `Bạn bị ${m.displayName || 'quái vật'} tấn công!`, m, { isAxe: isAxeMob, kbY: (m.type === 'hoglin' || m.chargeKnock) ? 7.2 : 0 });
            m.atkCd = (m.isBoss || m.guardian) ? 1.45 : 1.15;
            m.atkAnimT = 0.45;
            playMobSfx(m.type, 'attack');
            if (m.isBoss) { cameraShake = 0.28; spawnParticles(m.x, m.y + 0.4, m.z, m.type === 'cave_warden' ? 0x22d3ee : 0xf97316, 12, true); }
          }
        }
      } else {
        if (m.fusing) { m.fusing = false; m.fuseTimer = 0; m.group.scale.set(1, 1, 1); }
        if (villagerThreat) {
          // Villager flees away from attacking monsters (can open wooden doors to take shelter!)
          m.yaw = Math.atan2(m.x - villagerThreat.x, m.z - villagerThreat.z);
          speed = m.speed * 1.48;
          m.pauseT = 0;
        } else if (!m.hostile && !m.neutral && m.fleeT > 0) { m.fleeT -= dt; speed *= 1.65; m.yaw = Math.atan2(m.x - player.x, m.z - player.z); }
        else {
          // Graceful calm wandering + occasional natural grazing pauses (ZERO frantic spinning!)
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            if (Math.random() < (m.elemDragon ? 0.60 : 0.34)) { m.pauseT = (m.elemDragon ? 3.2 : 1.6) + Math.random() * 2.5; m.wanderT = m.pauseT + 2.5 + Math.random() * 3.0; }
            else { m.pauseT = 0; m.wanderT = 2.8 + Math.random() * 4.2; m.yaw += (Math.random() - 0.5) * 1.5; }
          }
          if (m.pauseT > 0) { m.pauseT -= dt; speed = 0; }
          else speed *= 0.58;
        }
      }

      // Authentic Minecraft Villager Wooden Door Open & Close-Behind AI (checks BOTH goal yaw & detour yaw!)
      if (m.villager) {
        if (!m.openedDoors) m.openedDoors = [];
        if (speed > 0.08 && ((frameCounter + i) % 3) === 0) {
          const hasDetourYaw = (m.avoidT > 0 && m.avoidYaw !== undefined);
          const myBase = Math.floor(m.y);
          for (let dyi = 0; dyi < (hasDetourYaw ? 2 : 1); dyi++) {
            const probeYaw = dyi === 0 ? m.yaw : m.avoidYaw;
            const sinY = Math.sin(probeYaw), cosY = Math.cos(probeYaw);
            for (let pi = 0; pi < 2; pi++) {
              const probeD = pi === 0 ? 0.72 : 1.22;
              const px = Math.floor(m.x + sinY * probeD), pz = Math.floor(m.z + cosY * probeD);
              for (let yi = -1; yi <= 1; yi++) {
                const py = Math.floor(m.y + (yi === 0 ? 0.1 : (yi < 0 ? -0.5 : 0.9)));
                const bid = getBlockWorld(px, py, pz);
                if (IS_DOOR[bid] === 1 && BLOCK_DEF[bid].doorTier !== 'iron') {
                  const dk = modKey(px, py, pz);
                  if (!doorOpenState.get(dk)) {
                    setDoorOpenPair(px, py, pz, true, dist < 20);
                    m.atkAnimT = 0.22;
                    if (!m.openedDoors.some(od => od.x === px && od.y === py && od.z === pz)) {
                      m.openedDoors.push({ x: px, y: py, z: pz, t: 0 });
                    }
                  }
                }
              }
            }
          }
        }
        // Automatically close wooden doors smoothly after Villager finishes passing through!
        for (let di = m.openedDoors.length - 1; di >= 0; di--) {
          const od = m.openedDoors[di];
          od.t += dt;
          const dDoor = Math.hypot(m.x - (od.x + 0.5), m.z - (od.z + 0.5));
          if ((dDoor > 1.45 && od.t > 0.55) || od.t > 2.8) {
            const pNear = Math.hypot(player.x - (od.x + 0.5), player.z - (od.z + 0.5)) < 0.95;
            if (!pNear) setDoorOpenPair(od.x, od.y, od.z, false, dist < 20);
            m.openedDoors.splice(di, 1);
          }
        }
      }

      visualTargetYaw = m.yaw;
      if (!m.flying && !m._perchState && !m.aqua && !m.skyBird && !(m.tamed && m.elemDragon)) {
        if (m.onGround === undefined) m.onGround = mobFootprintSolidAtY(m.x, Math.floor(m.y - 0.08), m.z, m.hitboxR);
        if (m.avoidSide === undefined) m.avoidSide = (i & 1) ? 1 : -1;
        if (m.steerYaw === undefined) m.steerYaw = m.yaw;
        if (m.jumpCd > 0) m.jumpCd = Math.max(0, m.jumpCd - dt);
        if (m.climbCommitT > 0) m.climbCommitT = Math.max(0, m.climbCommitT - dt);
        if (m.pillarCd > 0) m.pillarCd = Math.max(0, m.pillarCd - dt);
        if (m.avoidT > 0) { m.avoidT = Math.max(0, m.avoidT - dt); m.avoidElapsed = (m.avoidElapsed || 0) + dt; }

        // Execute Humanoid Block-Pillaring placement cleanly at jump apex (zero self-trapping!)
        if (m._pillarPending) {
          const pp = m._pillarPending;
          pp.t += dt;
          if (m.y >= pp.by + 0.94) {
            const pHitX = Math.floor(player.x) === pp.bx && Math.floor(player.z) === pp.bz && player.y < pp.by + 1.05;
            if (!pHitX && !isSolidAt(pp.bx, pp.by, pp.bz)) {
              setBlockWorld(pp.bx, pp.by, pp.bz, pp.blockId, true);
              m.y = Math.max(m.y, pp.by + 1.01);
              m.atkAnimT = 0.28;
              m.pillarCount = (m.pillarCount || 0) + 1;
              if (dist < 22) playSfx('place');
              spawnParticles(pp.bx + 0.5, pp.by + 0.5, pp.bz + 0.5, 0x9ca3af, 5, false);
            }
            m._pillarPending = null;
          } else if (pp.t > 0.55 || (m.onGround && pp.t > 0.14)) {
            m._pillarPending = null;
          }
        }

        const inWater = getBlockWorld(Math.floor(m.x), Math.floor(m.y + 0.32), Math.floor(m.z)) === B.WATER;
        m._inWaterBlend = (m._inWaterBlend || 0) + ((inWater ? 1 : 0) - (m._inWaterBlend || 0)) * Math.min(1, dt * 9.0);
        // Gentle anti-stuck escape if ever spawned/pushed inside solid block
        if (!mobFitsAt(m.x, m.y, m.z, m.hitboxR, m.hitboxH)) {
          let rescued = false;
          const escDirs = [[1,0],[-1,0],[0,1],[0,-1]];
          for (let ei = 0; ei < escDirs.length; ei++) {
            const tx = Math.floor(m.x) + escDirs[ei][0] + 0.5, tz = Math.floor(m.z) + escDirs[ei][1] + 0.5;
            if (mobFitsAt(tx, m.y, tz, m.hitboxR, m.hitboxH)) { m.x = tx; m.z = tz; rescued = true; break; }
            if (mobFitsAt(tx, m.y + 1, tz, m.hitboxR, m.hitboxH)) { m.x = tx; m.y += 1; m.z = tz; rescued = true; break; }
          }
          if (!rescued && !mobFootprintSolidAtY(m.x, Math.floor(m.y + 1.5), m.z, m.hitboxR)) { m.y += 1.0; m.vy = 0; }
        }

        // Persistent Multi-Ray Obstacle Avoidance AI (separates goal yaw from detour yaw so target-chase NEVER overwrites steering!)
        const hasActiveGoal = !!(guardianTarget || preferVillager || canChasePlayer || villagerThreat || m.tamed || (!m.hostile && !m.neutral && m.fleeT > 0));
        const lookNear = Math.max(0.58, m.hitboxR + 0.28);
        const lookMid = lookNear + 0.68;
        let stepAhead = 'pass';
        let targetMoveYaw = m.yaw;

        if (speed > 0.08) {
          const dSin = Math.sin(m.yaw), dCos = Math.cos(m.yaw);
          const directRes = probeMobStep(m, m.x + dSin * lookNear, m.y, m.z + dCos * lookNear);

          if (m.avoidT > 0) {
            // Release detour early once direct route to goal opens cleanly
            if (hasActiveGoal && m.avoidElapsed > 0.28 && directRes !== 'blocked') {
              const directMid = probeMobStep(m, m.x + dSin * lookMid, m.y + (directRes === 'jump' ? 1.0 : 0), m.z + dCos * lookMid);
              if (directMid !== 'blocked') m.avoidT = 0;
            }
            if (m.avoidT > 0) {
              // Ensure current detour heading is still unobstructed
              const aRes = probeMobStep(m, m.x + Math.sin(m.avoidYaw) * lookNear, m.y, m.z + Math.cos(m.avoidYaw) * lookNear);
              if (aRes === 'blocked') {
                const repick = pickMobAvoidYaw(m, m.yaw, m.avoidSide);
                m.avoidYaw = repick.yaw; m.avoidSide = repick.side;
                m.avoidT = 0.72 + Math.random() * 0.36; m.avoidElapsed = 0;
                if (!hasActiveGoal && repick.score > 0) m.yaw = repick.yaw;
              }
            }
          }

          if (m.avoidT <= 0 && directRes === 'blocked') {
            const pick = pickMobAvoidYaw(m, m.yaw, m.avoidSide);
            if (pick.score > 0) {
              m.avoidYaw = pick.yaw; m.avoidSide = pick.side;
              m.avoidT = (hasActiveGoal ? 0.75 : 0.45) + Math.random() * 0.35;
              m.avoidElapsed = 0;
              if (!hasActiveGoal) m.yaw = pick.yaw;
            } else {
              m.avoidSide = -m.avoidSide;
              m.avoidYaw = m.yaw + Math.PI * 0.85;
              m.avoidT = 0.65; m.avoidElapsed = 0;
              if (!hasActiveGoal) m.yaw = m.avoidYaw;
            }
          }

          targetMoveYaw = (m.avoidT > 0) ? m.avoidYaw : m.yaw;
          stepAhead = (m.avoidT > 0)
            ? probeMobStep(m, m.x + Math.sin(targetMoveYaw) * lookNear, m.y, m.z + Math.cos(targetMoveYaw) * lookNear)
            : directRes;
        } else {
          m.avoidT = 0;
        }

        // Smooth Steering Slew (zero sudden snaps or angular jitter!)
        let dSteer = targetMoveYaw - m.steerYaw;
        while (dSteer > Math.PI) dSteer -= Math.PI * 2;
        while (dSteer < -Math.PI) dSteer += Math.PI * 2;
        m.steerYaw += dSteer * Math.min(1, dt * (speed > 0.08 ? 9.5 : 7.0));
        const moveYaw = (speed < 0) ? m.yaw : m.steerYaw;
        visualTargetYaw = (speed > 0.08) ? m.steerYaw : m.yaw;

        // Lightweight Soft Separation (accelerated via Rust WASM batch kernel with JS fallback!)
        let sepX = 0, sepZ = 0;
        const needSep = !sodiumOpts.lithiumAi || (dist <= 24 && (speed > 0.04 || Math.abs(m.vx) > 0.04 || Math.abs(m.vz) > 0.04 || dist < 6.0));
        if (needSep) {
          if (hasWasmSep) {
            sepX = wasmSepX; sepZ = wasmSepZ;
          } else if (mobs.length <= 56 && (!_isWeakDevice || dist <= 22)) {
            const minCrowd = Math.max(0.72, m.hitboxR * 1.9);
            const minCrowd2 = minCrowd * minCrowd;
            for (let oi = 0; oi < mobs.length; oi++) {
              const om = mobs[oi];
              if (!om || om === m || om.flying || om.aqua || om.skyBird || Math.abs(om.y - m.y) > 1.4) continue;
              const sdx = m.x - om.x, sdz = m.z - om.z;
              if (Math.abs(sdx) >= minCrowd || Math.abs(sdz) >= minCrowd) continue;
              const sd2 = sdx * sdx + sdz * sdz;
              if (sd2 > 0.0004 && sd2 < minCrowd2) {
                const sd = Math.sqrt(sd2);
                const push = (minCrowd - sd) / minCrowd;
                sepX += (sdx / sd) * push * 1.55;
                sepZ += (sdz / sd) * push * 1.55;
              }
            }
          }
        }

        // Optional tactical lateral dodge / ranged strafe (lava-checked!)
        let latX = 0, latZ = 0;
        if (canChasePlayer && ((m._dodgeT || 0) > 0 || (m.ranged && m.type !== 'shulker' && m._strafeDir))) {
          const latDir = (m._dodgeT > 0) ? (m._dodgeDir || 1) : (m._strafeDir || 1);
          const latSpd = (m._dodgeT > 0) ? 2.65 : 1.15;
          const pYaw = m.yaw + Math.PI * 0.5 * latDir;
          if (probeMobStep(m, m.x + Math.sin(pYaw) * 0.85, m.y, m.z + Math.cos(pYaw) * 0.85) !== 'blocked') {
            latX = Math.sin(pYaw) * latSpd;
            latZ = Math.cos(pYaw) * latSpd;
          } else if (m.ranged) {
            m._strafeDir = -latDir;
          }
        }

        // Silky Velocity Interpolation + Smooth Physics Block Jumping (Zero Teleport Snapping!)
        const isSlimeMob = (m.type === 'slime' || m.type === 'sulfur_slime');
        const slimeDriveMul = !isSlimeMob ? 1.0 : (!m.onGround ? 1.32 : (m.hopCd < 0.24 ? 0.15 : 0.24));
        const effDriveSpd = (inWater ? speed * 0.62 : speed) * slimeDriveMul;
        const climbBoost = ((m.climbCommitT || 0) > 0 && !m.onGround) ? Math.max(effDriveSpd, 2.55) : effDriveSpd;
        const tgtVx = Math.sin(moveYaw) * climbBoost + sepX + latX;
        const tgtVz = Math.cos(moveYaw) * climbBoost + sepZ + latZ;
        if (m.svx === undefined) { m.svx = 0; m.svz = 0; }
        const accRate = isSlimeMob ? (m.onGround ? 11.0 : 6.2) : (m.onGround ? 11.5 : ((m.climbCommitT || 0) > 0 ? 9.5 : (inWater ? 7.2 : 5.8)));
        const accK = 1 - Math.exp(-accRate * dt);
        m.svx += (tgtVx - m.svx) * accK;
        m.svz += (tgtVz - m.svz) * accK;
        const dxM = (m.svx + m.vx) * dt, dzM = (m.svz + m.vz) * dt;
        const mKbDamp = Math.exp(-9.5 * dt);
        m.vx *= mKbDamp; m.vz *= mKbDamp;

        let blocked = false, hitClimbableStep = false;
        const prevX = m.x, prevZ = m.z;
        const tryMoveAxis = (nx, nz) => {
          if (mobFitsAt(nx, m.y, nz, m.hitboxR, m.hitboxH)) return { ok: true, y: m.y };
          const groundY = Math.floor(m.y + 0.08);
          // Smooth 0.5-block auto step-up onto bottom slabs (and from half-height onto next 0.5 step)
          const slabStepY = Math.round((m.y + 0.5) * 2) / 2;
          if (slabStepY > m.y + 0.02 && (slabStepY - m.y) <= 0.55) {
            const footB = getBlockWorld(Math.floor(nx), Math.floor(m.y + 0.05), Math.floor(nz));
            const onHalf = Math.abs((m.y - Math.floor(m.y)) - 0.5) < 0.08;
            if ((IS_SLAB[footB] === 1 || onHalf) && mobFitsAt(nx, slabStepY + 0.01, nz, m.hitboxR, m.hitboxH)) {
              return { ok: true, y: slabStepY };
            }
          }
          // Smooth mid-jump / water-bank ledge cresting onto 1-block higher surface
          if ((!m.onGround || inWater) && m.vy > -4.2) {
            const crestTol = inWater ? 0.78 : 0.58;
            const crestY = Math.floor(m.y + crestTol);
            if (crestY > m.y - 0.02 && (crestY - m.y) <= crestTol && !hasUnjumpableBarrierAt(nx, crestY - 1, nz, m.hitboxR) && mobFitsAt(nx, crestY + 0.02, nz, m.hitboxR, m.hitboxH)) {
              if (!(!FIRE_IMMUNE_MOBS.has(m.type) && getBlockWorld(Math.floor(nx), crestY, Math.floor(nz)) === B.LAVA)) {
                return { ok: true, y: crestY };
              }
            }
          }
          if (hasUnjumpableBarrierAt(nx, groundY, nz, m.hitboxR)) return { ok: false, y: m.y };
          // Detect climbable 1-block step (including probe slightly past block face so mobs jump cleanly!)
          const headY = Math.floor(m.y + m.hitboxH + 0.92);
          const maxStep = inWater ? 2 : 1;
          const stepProbeX = m.x + Math.sin(moveYaw) * Math.max(0.55, m.hitboxR + 0.28);
          const stepProbeZ = m.z + Math.cos(moveYaw) * Math.max(0.55, m.hitboxR + 0.28);
          for (let sd = 1; sd <= maxStep; sd++) {
            const stepTop = groundY + sd;
            if (!mobFootprintSolidAtY(m.x, headY, m.z, m.hitboxR) && (mobFitsAt(nx, stepTop + 0.02, nz, m.hitboxR, m.hitboxH) || mobFitsAt(stepProbeX, stepTop + 0.02, stepProbeZ, m.hitboxR, m.hitboxH))) {
              if (!(!FIRE_IMMUNE_MOBS.has(m.type) && getBlockWorld(Math.floor(nx), stepTop, Math.floor(nz)) === B.LAVA)) {
                hitClimbableStep = true;
                break;
              }
            }
          }
          return { ok: false, y: m.y };
        };

        const resX = tryMoveAxis(m.x + dxM, m.z);
        if (resX.ok) { m.x += dxM; if (resX.y > m.y) { m.y = resX.y; m.vy = Math.min(m.vy, 0); } } else blocked = true;
        const resZ = tryMoveAxis(m.x, m.z + dzM);
        if (resZ.ok) { m.z += dzM; if (resZ.y > m.y) { m.y = resZ.y; m.vy = Math.min(m.vy, 0); } } else blocked = true;

        // Genuine Minecraft-style Physics Jump up 1-block terrain/steps & riverbanks (peak ~1.62m, cleanly clears ledges!)
        if (speed > 0.08 && (stepAhead === 'jump' || hitClimbableStep) && (m.onGround || inWater) && m.jumpCd <= 0) {
          m.vy = inWater ? 8.85 : 8.55;
          m.onGround = false;
          m.jumpCd = inWater ? 0.28 : 0.34;
          m.climbCommitT = inWater ? 0.70 : 0.58;
          m.svx = m.svx * 0.28 + Math.sin(moveYaw) * Math.max(2.3, effDriveSpd) * 0.72;
          m.svz = m.svz * 0.28 + Math.cos(moveYaw) * Math.max(2.3, effDriveSpd) * 0.72;
        }

        // Humanoid Mob Pillaring: jump & place cobblestone/netherrack under feet to pursue elevated nearest target!
        if (canChasePlayer && tgtP && isHumanoidPillar && !m._pillarPending && (m.pillarCd || 0) <= 0 && (m.pillarCount || 0) < 6 && m.onGround && (tgtP.y - m.y) > 1.65 && (tgtP.y - m.y) < 12.0 && tDist < 8.5 && (tDist < 4.5 || blocked || stepAhead === 'blocked')) {
          const pBx = Math.floor(m.x), pBy = Math.floor(m.y + 0.08), pBz = Math.floor(m.z);
          if (!isSolidAt(pBx, pBy, pBz) && !mobFootprintSolidAtY(m.x, Math.floor(m.y + m.hitboxH + 0.95), m.z, m.hitboxR)) {
            m.svx *= 0.25; m.svz *= 0.25;
            m.vy = 8.45;
            m.onGround = false;
            m.jumpCd = 0.45;
            m.pillarCd = 1.05;
            m._pillarPending = { bx: pBx, by: pBy, bz: pBz, blockId: currentDimension === 'nether' ? B.NETHERRACK : B.STONE, t: 0 };
          }
        }

        // Smart 8-Way Anti-Stuck & Block-Jump Escape: scans 8 directions for 1-block jumpable ledges whenever blocked/stuck!
        const movedD = Math.hypot(m.x - prevX, m.z - prevZ);
        if (speed > 0.18 && (m.climbCommitT || 0) <= 0 && (blocked || movedD < speed * dt * 0.25)) {
          m.stuckT = (m.stuckT || 0) + dt;
          if (m.stuckT > 0.20) {
            if ((stepAhead === 'jump' || hitClimbableStep) && (m.onGround || inWater) && m.jumpCd <= 0) {
              m.vy = inWater ? 8.85 : 8.55; m.onGround = false; m.jumpCd = inWater ? 0.28 : 0.34; m.climbCommitT = inWater ? 0.70 : 0.58;
              m.svx = Math.sin(moveYaw) * Math.max(2.4, effDriveSpd); m.svz = Math.cos(moveYaw) * Math.max(2.4, effDriveSpd);
            } else {
              let foundPitExit = false;
              if ((m.onGround || inWater) && m.jumpCd <= 0) {
                const jumpProbeD = Math.max(0.65, m.hitboxR + 0.36);
                for (let k = 0; k < 8; k++) {
                  const ey = m.yaw + (k === 0 ? 0 : (k & 1 ? 1 : -1) * Math.ceil(k * 0.5) * (Math.PI * 0.25));
                  if (probeMobStep(m, m.x + Math.sin(ey) * jumpProbeD, m.y, m.z + Math.cos(ey) * jumpProbeD) === 'jump') {
                    m.avoidYaw = ey; m.avoidT = 0.85; m.avoidElapsed = 0;
                    if (!hasActiveGoal) m.yaw = ey;
                    m.vy = inWater ? 8.85 : 8.55; m.onGround = false; m.jumpCd = inWater ? 0.28 : 0.34; m.climbCommitT = inWater ? 0.70 : 0.58;
                    m.svx = Math.sin(ey) * Math.max(2.4, effDriveSpd); m.svz = Math.cos(ey) * Math.max(2.4, effDriveSpd);
                    foundPitExit = true;
                    break;
                  }
                }
              }
              if (!foundPitExit) {
                m.avoidSide = (m.stuckStrikes && (m.stuckStrikes & 1)) ? -m.avoidSide : m.avoidSide;
                m.stuckStrikes = (m.stuckStrikes || 0) + 1;
                const esc = pickMobAvoidYaw(m, m.yaw, m.avoidSide);
                m.avoidYaw = esc.score > 0 ? esc.yaw : (m.yaw + m.avoidSide * 1.65);
                m.avoidSide = esc.side;
                m.avoidT = 0.85 + Math.random() * 0.35;
                m.avoidElapsed = 0;
                if (!hasActiveGoal) m.yaw = m.avoidYaw;
              }
            }
            m.stuckT = 0;
          }
        } else {
          m.stuckT = Math.max(0, (m.stuckT || 0) - dt * 3.0);
          if (movedD > speed * dt * 0.55) m.stuckStrikes = 0;
        }
        m.lastX = m.x; m.lastZ = m.z;

        // Vertical Gravity / Critically-Damped Buoyancy (never clamp an active jump-to-shore leap!)
        if (inWater && !((m.climbCommitT || 0) > 0.08 && m.vy > 0)) {
          const localSurfY = getLocalWaterSurfaceY(m.x, m.y, m.z);
          const submerge = Math.min(0.62, Math.max(0.32, (m.hitboxH || 1.2) * 0.42));
          const targetFloatY = localSurfY - submerge + Math.sin(elapsed * 2.1 + i) * 0.04;
          const yErr = targetFloatY - m.y;
          m.vy += (yErr * 28.0 - m.vy * 8.5) * dt;
          m.vy = Math.max(-4.5, Math.min(5.2, m.vy));
        } else {
          m.vy = Math.max(-24, m.vy - 22 * dt);
        }
        const nextMY = m.y + m.vy * dt;
        if (m.vy > 0 && mobFootprintSolidAtY(m.x, Math.floor(nextMY + m.hitboxH), m.z, m.hitboxR)) {
          m.vy = 0;
          m.onGround = false;
        } else {
          m.y = nextMY;
          const fy = Math.floor(m.y);
          const prevVy = m.vy, wasGround = !!m.onGround;
          if (m.vy <= 0 && mobFootprintSolidAtY(m.x, fy, m.z, m.hitboxR)) {
            m.y = fy + 1;
            m.vy = 0;
            m.onGround = true;
            if (!wasGround && prevVy < -1.2) {
              m._landImpact = Math.min(1.0, Math.abs(prevVy) / 7.5);
              if (m.type === 'sulfur_slime') spawnParticles(m.x, m.y + 0.08, m.z, 0xfacc15, 3, true);
            }
          } else {
            m.onGround = mobFootprintSolidAtY(m.x, Math.floor(m.y - 0.06), m.z, m.hitboxR) && Math.abs(m.vy) < 0.25;
          }
        }
      }
      const _simSafeDt = Math.max(0.004, Math.min(0.12, dt || 0.016));
      const _sdx = m.x - _simPrevX, _sdy = m.y - _simPrevY, _sdz = m.z - _simPrevZ;
      if (Math.hypot(_sdx, _sdy, _sdz) > 8.0) {
        m._netVx = 0; m._netVy = 0; m._netVz = 0;
      } else {
        const _nvK = 1 - Math.exp(-22.0 * _simSafeDt);
        m._netVx = (m._netVx || 0) + ((_sdx / _simSafeDt) - (m._netVx || 0)) * _nvK;
        m._netVy = (m._netVy || 0) + ((_sdy / _simSafeDt) - (m._netVy || 0)) * _nvK;
        m._netVz = (m._netVz || 0) + ((_sdz / _simSafeDt) - (m._netVz || 0)) * _nvK;
      }
      } // end _isGuestMobClient else

      // Silky-Smooth Frame-Rate-Independent Interpolated Visual Position & Yaw Turning
      const isRidingThis = (player.ridingDragon === m);
      let dAng = 0;
      if (isRidingThis) {
        m.rx = m.x; m.ry = m.y; m.rz = m.z; m.ryaw = m.yaw;
      } else if (_isGuestMobClient && m._netBuf) {
        m.rx = m.x; m.ry = m.y; m.rz = m.z; m.ryaw = m.yaw;
        dAng = Math.max(-0.5, Math.min(0.5, (m._guestTurnRate || 0) * 4.0));
        m.group.position.set(m.rx, m.ry, m.rz);
        m.group.rotation.y = m.ryaw;
      } else {
        if (m.rx === undefined) { m.rx = m.x; m.ry = m.y; m.rz = m.z; m.ryaw = visualTargetYaw; }
        const posK = 1 - Math.exp(-18.0 * dt);
        const yK = 1 - Math.exp(-((!m.onGround || Math.abs(m.vy) > 0.35) ? 22.0 : 15.0) * dt);
        m.rx += (m.x - m.rx) * posK;
        m.ry += (m.y - m.ry) * yK;
        m.rz += (m.z - m.rz) * posK;
        dAng = visualTargetYaw - m.ryaw;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        m.ryaw += dAng * (1 - Math.exp(-11.0 * dt));
        m.group.position.set(m.rx, m.ry, m.rz);
        m.group.rotation.y = m.ryaw;
      }
      if (m._shCast) {
        const mMoved = m._shX === undefined
          || Math.abs(m.rx - m._shX) > 0.004 || Math.abs(m.ry - m._shY) > 0.004 || Math.abs(m.rz - m._shZ) > 0.004
          || Math.abs(m.ryaw - m._shYaw) > 0.015
          || m.atkAnimT > 0 || m.hurtFlash > 0 || (m.animMove || 0) > 0.03 || m.flying || !m.onGround || isRidingThis;
        if (mMoved) {
          window._hasActiveNearShadowMob = true;
          m._shX = m.rx; m._shY = m.ry; m._shZ = m.rz; m._shYaw = m.ryaw;
        }
      }

      // Authentic Fresh Animations + Smooth Moves + Punchy! Multi-Archetype Skeletal Animator (skipped when Entity Culled!)
      if (m._roarT > 0) m._roarT = Math.max(0, m._roarT - dt);
      const isSkinnedDragon = !!(m.anim && m.anim.mixer);
      const isDragonMob = IS_DRAGON_MOB.has(m.type) || isSkinnedDragon;
      if (m.anim && isMobVis && (typeof sodiumOpts === 'undefined' || sodiumOpts.animations !== false) && (m.isBoss || isDragonMob || isRidingThis || dist < 34 || ((frameCounter + i) & 1) === 0)) {
        const isDragon = isDragonMob;
        const isZombie = (m.type === 'zombie' || m.type === 'husk' || m.type === 'drowned' || m.type === 'ruin_stalker' || m.type === 'frozen_zombie' || m.type === 'mossy_zombie' || m.type === 'zombified_piglin');
        const isPillager = (m.type === 'pillager' || m.type === 'pillager_raider');
        const isVind = (m.type === 'vindicator');
        const isEvoker = (m.type === 'evoker' || m.type === 'iceologer');
        const isRavager = (m.type === 'ravager');
        const isArcher = (m.type === 'skeleton' || m.type === 'stray' || m.type === 'desert_skeleton' || m.type === 'bogged');
        const isEnderman = (m.type === 'void_stalker' || m.type === 'enderman');
        const isCreeper = (m.type === 'creeper' || m.type === 'charged_creeper' || m.type === 'icy_creeper' || m.type === 'potato_creeper' || m.type === 'nerd_creeper' || m.type === 'ghost_creeper');
        if (m.anim.core) {
          if (m.type === 'wildfire') m.anim.core.rotation.y += dt * 2.2;
          else if (m.type === 'charged_creeper' || m.type === 'icy_creeper') {
            m.anim.core.rotation.y += dt * (m.type === 'charged_creeper' ? 1.5 : 1.0);
            if (_chargedAuraTex && m.type === 'charged_creeper') _chargedAuraTex.offset.y = (elapsed * 0.95) % 1;
            const ch = m.anim.core.children;
            for (let ci = 0; ci < ch.length; ci++) {
              const s = ch[ci].userData && ch[ci].userData.pfxSheet;
              if (s) ch[ci].material = s.mats[((elapsed * 12 + ci * 2) | 0) % s.frames];
            }
            if (dist < 22 && ((frameCounter + i) % 18) === 0) {
              spawnPixelFx(m.type === 'charged_creeper' ? 'electric_coil' : 'frost_aura', m.x, m.y + 1.05, m.z, { count: 1, scale: 0.85, life: 0.36, spread: 0.55 });
            }
          }
        }
        const isHeavy = (m.isBoss || m.guardian || isRavager || m.type === 'void_golem' || m.type === 'elephant' || m.type === 'hippo' || m.type === 'polar_bear');
        const isQuad = (m.anim.legs.length >= 4 && !m.anim.legs[0].isSpider && !isDragon && !isCreeper);
        const isHerbivore = (!m.hostile && !m.neutral && isQuad && !m.tamed);
        const effSpeed = isRidingThis ? (player.curSpeed || 0) : ((!m.flying && !m.aqua && !m.skyBird && m.svx !== undefined) ? Math.hypot(m.svx, m.svz) : Math.abs(speed));
        const rawMoving = effSpeed > 0.14 || m.flying || m.aqua || m.skyBird;
        const isGallop = (isQuad && effSpeed > m.speed * 1.05);
        // Smooth Moves eased velocity blend (eliminates stiff instant limb snapping!)
        m.animMove = (m.animMove || 0) + ((rawMoving ? Math.min(1.0, (effSpeed + (m.flying || m.aqua || m.skyBird ? 1.2 : 0)) / Math.max(1.2, m.speed * 0.85)) : 0) - (m.animMove || 0)) * Math.min(1, dt * 8.5);
        const mv = m.animMove;
        const swimT = m._inWaterBlend || 0;
        const atkPhase = m.atkAnimT > 0 ? Math.sin((m.atkAnimT / 0.45) * Math.PI) : 0;
        const hurtPulse = m.hurtFlash > 0 ? Math.sin(Math.min(1, m.hurtFlash / 0.25) * Math.PI) : 0;
        // Bị đánh: NGẢ RA SAU (rotation.x âm) thay vì nghiêng sang một bên
        const hurtTilt = 0;
        m.group.rotation.x = -hurtPulse * 0.42;
        const turnBank = Math.max(-0.26, Math.min(0.26, -dAng * (m.flying || m.skyBird ? 0.55 : (m.aqua ? 0.42 : 0.24))));
        const walkRate = isRavager ? 3.5 : (isHeavy ? 3.3 : (isQuad ? (isGallop ? 6.0 : 5.1) : (isCreeper ? 6.2 : 4.7)));
        m.walkPhase = (m.walkPhase + dt * (effSpeed * walkRate + (rawMoving ? 1.8 : 0.7))) % (Math.PI * 2048);
        if (m.swimPhase === undefined) m.swimPhase = Math.random() * Math.PI * 2;
        if (swimT > 0.01) m.swimPhase = (m.swimPhase + dt * (3.2 + mv * 2.6)) % (Math.PI * 2048);
        const spPhase = m.swimPhase;
        const wp = m.walkPhase;
        const wpW = wp + 0.20 * Math.sin(2 * wp);   // warp pha: chân "dừng" lúc chạm đất, lướt nhanh qua giữa
        const sw = Math.sin(wpW) * (0.04 + mv * (isHeavy ? 0.64 : (isQuad ? 0.80 : 0.76)));
        const dblBounce = (!m.flying && !m.aqua && !m.skyBird) ? Math.abs(Math.sin(wp)) * mv : 0;
        const idleBreath = Math.sin(elapsed * 2.4 + i * 1.37) * 0.036;

        // Fresh Animations Periodic Curious Glance & Grazing Head-Dip for Idle Animals!
        if (m.lookT === undefined) { m.lookT = 1.5 + Math.random() * 3.0; m.lookYaw = 0; m.grazeT = 0; }
        m.lookT -= dt;
        if (m.lookT <= 0) {
          m.lookT = 2.0 + Math.random() * 3.8;
          m.lookYaw = (Math.random() < 0.35) ? 0 : (Math.random() - 0.5) * 1.05;
          if (isHerbivore && mv < 0.15 && Math.random() < 0.42) m.grazeT = 1.8 + Math.random() * 1.6;
        }
        if (m.grazeT > 0) m.grazeT = Math.max(0, m.grazeT - dt);
        const grazeDip = (m.grazeT > 0 && mv < 0.15) ? Math.sin(Math.min(1, m.grazeT) * Math.PI * 0.5) * (0.48 + Math.sin(elapsed * 7.5 + i) * 0.08) : 0;

        // Fresh Animations Enderman Provoked Rage Tremble!
        const rageJitterX = (isEnderman && m.provoked > 0) ? Math.sin(elapsed * 58 + i) * 0.032 : 0;
        const rageJitterZ = (isEnderman && m.provoked > 0) ? Math.cos(elapsed * 63 + i) * 0.032 : 0;

        // Punchy! Kinetic Hit Squash-Stretch Recoil on all non-fusing mobs!
        if (!m.fusing) {
          const bs = m.baseScale || 1;
          if (hurtPulse > 0.01) {
            const sqY = bs * (1.0 - hurtPulse * 0.14);
            const sqXZ = bs * (1.0 + hurtPulse * 0.09);
            m.group.scale.set(sqXZ, sqY, sqXZ);
          } else if (m.group.scale.y !== bs) {
            m.group.scale.set(bs, bs, bs);
          }
        }

        // Vertical Body Bounce + Asymmetric Wingbeat Heave + Aquatic Buoyancy!
        const isRay = (m.type === 'manta_ray' || m.type === 'marine_ray' || m.type === 'ichor_ray');
        const wingFreq = isRay ? 3.6 : (isDragon ? 4.8 : (m.flying ? 7.8 : (m.skyBird ? 10.5 : 8.5)));
        const wingCycle = elapsed * wingFreq + i * 1.7;
        // Authentic Fresh Animations asymmetric wingbeat: fast powerful downstroke + graceful slower upstroke!
        const wingBeat = Math.sin(wingCycle) - 0.26 * Math.sin(wingCycle * 2.0);
        if (isRidingThis) {
          // Mounted dragon transform is synced in updatePlayer with rigid saddle attachment — no lag bob!
        } else if (m.flying || m.skyBird) {
          m.group.position.y = m.ry - Math.cos(wingCycle) * (isDragon ? 0.14 : 0.10);
        } else if (m.aqua) {
          m.group.position.y = m.ry + Math.sin(elapsed * 2.2 + i) * 0.028;
        } else if (!m.hopper) {
          const bounceScale = isCreeper ? 0.095 : (isRavager ? 0.090 : (isHeavy ? 0.078 : (isQuad ? (isGallop ? 0.095 : 0.062) : 0.072)));
          m.group.position.y = m.ry + ((m.sitting && !isSkinnedDragon) ? -0.14 : dblBounce * Math.min(bounceScale, effSpeed * 0.032) * (1 - swimT * 0.85) + Math.sin(elapsed * 2.4 + i) * 0.032 * swimT) + (m._emergeOffsetY || 0);
        }
        if (!isRidingThis) {
          m.group.position.x = m.rx + rageJitterX;
          m.group.position.z = m.rz + rageJitterZ;
        }
        // Quái đang bốc cháy (zombie/skeleton cháy nắng): rung nhẹ như Minecraft
        if (m.burning) {
          m.group.position.x += Math.sin(elapsed * 46 + i) * 0.035;
          m.group.position.z += Math.cos(elapsed * 53 + i) * 0.035;
          m.group.position.y += Math.sin(elapsed * 61 + i) * 0.02;
        }

        // Smooth Moves / Fresh Animations Body Roll, Limp, Panic Wobble & Turn Banking!
        const panicRoll = (m.villager && villagerThreat) ? Math.sin(wp * 1.5) * 0.11 : 0;
        const limpRoll = isZombie ? (0.08 + Math.sin(wp) * 0.09 * mv) : (Math.cos(wp) * (isCreeper ? 0.088 : (isRavager ? 0.068 : 0.048)) * mv);
        if (!isRidingThis) m.group.rotation.z = limpRoll + panicRoll + turnBank + hurtTilt;

        if (isSkinnedDragon) {
          const actions = m.anim.actions;
          const spdDrg = isRidingThis ? (player.curSpeed || 0) : Math.hypot(m.flyVx || m.vx || 0, m.flyVz || m.vz || 0);
          const drgVy = (m.flyVy !== undefined ? m.flyVy : (m.vy || 0));
          const swooping = isRidingThis
            ? !!(m.flying && (m._drgDiving || (m._diveBoost || 0) > 0.14))
            : (m.flying && (m.swoopT > 0 || drgVy < -4.2));
          const gliding = isRidingThis
            ? swooping
            : (m.flying && !swooping && spdDrg > 3.6 && drgVy > -1.0 && atkPhase < 0.05 && Math.sin(elapsed * 0.45 + i * 1.7) > 0.25);
          m._drgSwooping = swooping;
          m._drgGliding = gliding;
          let desiredClip = 'Idle';
          let desiredScale = 1.0;
          if (!m.flying && (m.atkAnimT > 0.04 || (m._roarT || 0) > 0.02)) {
            desiredClip = 'Roar_WingSpread';
            desiredScale = 1.55;
          } else if (m.flying && !m.sitting) {
            if (swooping || gliding) {
              desiredClip = 'Glide';
              desiredScale = isRidingThis ? 1.05 : 1.0;
            } else {
              desiredClip = 'Fly_Flap';
              desiredScale = isRidingThis ? 1.15 : 1.08;
              if (isRidingThis && (m._lastFlapT || 0) < elapsed - 0.68) {
                m._lastFlapT = elapsed;
                playSfx('wing_flap');
              }
            }
          } else if (!m.sitting && effSpeed > 0.14) {
            desiredClip = 'Walk';
            desiredScale = isRidingThis ? Math.max(0.55, Math.min(1.05, effSpeed * 0.22)) : Math.max(0.65, Math.min(1.25, effSpeed * 0.28));
          }
          if (actions) {
            if (!actions[desiredClip]) desiredClip = m.anim.activeClip || Object.keys(actions)[0];
            const nextAct = actions[desiredClip];
            if (nextAct && desiredClip !== m.anim.activeClip) {
              const prevAct = actions[m.anim.activeClip];
              if (prevAct) prevAct.fadeOut(0.20);
              nextAct.reset().setEffectiveTimeScale(desiredScale).setEffectiveWeight(1).fadeIn(0.20).play();
              m.anim.activeClip = desiredClip;
            } else if (nextAct) {
              nextAct.setEffectiveTimeScale(desiredScale);
            }
            if (m._mixerTickedFrame !== frameCounter) {
              m.anim.mixer.update(Math.min(0.05, dt));
              m._mixerTickedFrame = frameCounter;
            }
          }
          m.group.rotation.x = isRidingThis
            ? (m._flyPitch || 0)
            : (swooping ? 0.28 : (m.flying ? (m._flyPitch || 0) : -hurtPulse * 0.28));
          if (!isRidingThis) m.group.rotation.z = turnBank;
        } else {
        if (m.anim.torso) {
          if (m.hopper) {
            // Spring-damped gelatinous crouch -> launch stretch -> touchdown squash + suspended sulfur bubbles
            const sdt = Math.min(0.04, dt);
            m._landImpact = (m._landImpact || 0) * Math.exp(-7.5 * sdt);
            let tgtSy = 1.0 + Math.sin(elapsed * 4.4 + i) * 0.055;
            if (!m.onGround) {
              tgtSy = 1.0 + Math.max(-0.18, Math.min(0.32, m.vy * 0.055));
            } else if (m._landImpact > 0.04) {
              tgtSy = 1.0 - 0.32 * m._landImpact;
            } else if (m.hopCd < 0.24) {
              const crouchP = 1.0 - Math.max(0, m.hopCd) / 0.24;
              tgtSy = 1.0 - 0.28 * crouchP * crouchP;
            }
            if (m._sqY === undefined) { m._sqY = 1.0; m._sqVel = 0.0; m._hopPitch = 0.0; }
            const sqAcc = (tgtSy - m._sqY) * 115.0 - m._sqVel * 12.5;
            m._sqVel += sqAcc * sdt;
            m._sqY = Math.max(0.58, Math.min(1.48, m._sqY + m._sqVel * sdt));
            const invSq = 1 / Math.sqrt(m._sqY);
            const jiggle = Math.sin(elapsed * 7.6 + i) * (0.022 + m._landImpact * 0.045);
            m.anim.torso.scale.set(invSq * (1 + jiggle), m._sqY, invSq * (1 - jiggle));
            const tgtPitch = !m.onGround ? Math.max(-0.24, Math.min(0.22, -m.vy * 0.042)) : (m.hopCd < 0.24 ? 0.08 : idleBreath * 0.6);
            m._hopPitch += (tgtPitch - m._hopPitch) * (1 - Math.exp(-12.0 * sdt));
            m.anim.torso.rotation.x = m._hopPitch;
            if (m.anim.slimeCore) {
              const coreLag = Math.max(-0.08, Math.min(0.09, -m._sqVel * 0.016));
              m.anim.slimeCore.position.y = 0.44 + coreLag + Math.sin(elapsed * 5.2 + i) * 0.018;
              m.anim.slimeCore.rotation.y = Math.sin(elapsed * 2.8 + i) * 0.08;
            }
            if (m.anim.slimeBubbles && m.anim.slimeBubbles.length) {
              for (let bi = 0; bi < m.anim.slimeBubbles.length; bi++) {
                const sb = m.anim.slimeBubbles[bi];
                sb.m.position.y = sb.by + Math.sin(elapsed * (3.6 + bi * 0.7) + i + bi * 1.4) * 0.035;
              }
            }
            if (m.anim.slices && m.anim.slices.length) {
              const lift = Math.max(0, Math.abs(m.vy) > 0.35 ? Math.min(0.18, Math.abs(m.vy) * 0.025) : 0);
              for (let si = 0; si < m.anim.slices.length; si++) {
                const sl = m.anim.slices[si];
                const slObj = sl.p || sl;
                if (slObj && slObj.position) {
                  if (sl.baseY === undefined) sl.baseY = slObj.position.y;
                  slObj.position.y = sl.baseY + lift * (si + 1);
                }
              }
            }
          } else if (m.aqua) {
            // Authentic Sinuous Aquatic Swimming S-Wave (plus pulsing bell for Jellyfish/Octopus!)
            if (m.type === 'marine_jelly' || m.type === 'marine_octopus') {
              const pulse = 1.0 + Math.sin(elapsed * 4.2 + i) * 0.16;
              m.anim.torso.scale.set(pulse, 1.0 / Math.sqrt(pulse), pulse);
              m.anim.torso.rotation.x = Math.sin(elapsed * 2.2 + i) * 0.14;
            } else {
              m.anim.torso.rotation.y = Math.sin(elapsed * 6.4 + i) * 0.16;
              m.anim.torso.rotation.z = turnBank * 0.85 + Math.cos(elapsed * 6.4 + i) * 0.06;
              m.anim.torso.rotation.x = Math.sin(elapsed * 2.2 + i) * 0.06 + atkPhase * 0.25 + (m._aquaPitch || 0);
            }
          } else {
            // Quadruped gallop/trot wave + Biped torso counter-twist + Pillager recoil + Ravager bull-charge + swim tilt!
            const quadPitch = isQuad ? Math.sin(wp * (isGallop ? 1.0 : 2.0)) * (isGallop ? 0.11 : 0.06) * mv : (isZombie ? 0.13 * mv : (isPillager ? 0.04 * mv : 0.06 * mv));
            const jumpPitch = (!m.flying && !m.skyBird && !m.aqua && swimT < 0.35 && !m.onGround && Math.abs(m.vy) > 0.6) ? Math.max(-0.22, Math.min(0.20, -m.vy * 0.028)) : 0;
            const swimPitch = swimT > 0.02 ? ((isQuad ? (0.10 + mv * 0.12) : (0.12 + mv * 0.14)) + Math.max(-0.18, Math.min(0.18, -m.vy * 0.045))) * swimT : 0;
            const atkPitch = isPillager ? (-atkPhase * 0.20) : (isRavager ? (atkPhase * 0.34) : (atkPhase * (isHeavy ? 0.48 : 0.34)));
            m.anim.torso.rotation.y = (!isQuad && !isDragon && !m.flying) ? Math.sin(wp) * (isPillager ? 0.07 : 0.16) * mv : 0;
            m.anim.torso.rotation.z = (!m.flying && !m.skyBird) ? (Math.sin(wp) * (isHeavy ? 0.098 : 0.072) * mv + idleBreath * 0.55) : (turnBank * 0.5);
            const drgTorsoP = m._drgSwooping ? 0.34 : (m._drgGliding ? ((m._flyPitch || 0) + 0.03) : (!m.flying ? (-0.12 + idleBreath * 0.8) : ((m._flyPitch || 0) + Math.sin(m._drgWingPhase || wingCycle) * 0.045)));
            m.anim.torso.rotation.x = (isDragon ? (isRidingThis ? (m._flyPitch || 0) : drgTorsoP) : (m.skyBird ? ((m._flyPitch || 0) + Math.sin(wingCycle) * 0.05) : (idleBreath + (m.sitting ? -0.24 : quadPitch + jumpPitch + swimPitch)))) + atkPitch;
          }
        }
        const isMidJump = (!m.flying && !m.skyBird && !m.aqua && swimT < 0.35 && !m.onGround && Math.abs(m.vy) > 0.65);
        for (let li = 0; li < m.anim.legs.length; li++) {
          const lg = m.anim.legs[li];
          if (!lg || !lg.p || !lg.p.rotation) continue;
          if (lg.isSpider) {
            // Fresh Animations 8-Leg Scuttle Wave!
            lg.p.rotation.y = Math.sin(wp * 1.45 + li * 0.9) * (0.10 + 0.58 * mv) * lg.dir;
            lg.p.rotation.z = Math.max(0, Math.cos(wp * 1.45 + li * 0.9)) * 0.22 * mv * (lg.dir > 0 ? 1 : -1);
          } else if (isDragon) {
            const drgLgTarget = m.flying
              ? (m._drgSwooping ? 0.82 : (0.58 + Math.sin((m._drgWingPhase || wingCycle) + li * 0.55) * 0.14))
              : (m.sitting ? -0.45 : (Math.sin(wpW) * (li % 2 === 0 ? 1 : -1) * (0.04 + mv * 0.78)));
            lg.p.rotation.x += (drgLgTarget - lg.p.rotation.x) * Math.min(1, dt * 11.0);
          } else if (m.flying || m.skyBird) {
            // Flying birds & airborne mobs tuck legs cleanly backward instead of walking in midair!
            const tuckFlight = (m.type === 'flamingo' || m.type === 'heron') ? (1.32 + Math.sin(wingCycle) * 0.05) : (0.85 + Math.sin(wingCycle) * 0.06);
            lg.p.rotation.x += (tuckFlight - lg.p.rotation.x) * Math.min(1, dt * 12.0);
          } else if (m.sitting) {
            lg.p.rotation.x = -0.78;
          } else if (m.hopper && Math.abs(m.vy) > 0.35) {
            lg.p.rotation.x = (m.vy > 0 ? -0.68 : 0.50) * lg.dir;
          } else if (isMidJump) {
            // Fresh Animations / Smooth Moves mid-air jump leg tuck & landing reach!
            const tuck = m.vy > 0 ? (isQuad ? (li < 2 ? -0.58 : 0.42) : (-0.52 * lg.dir)) : (isQuad ? (li < 2 ? 0.32 : -0.26) : (0.36 * lg.dir));
            lg.p.rotation.x += (tuck - lg.p.rotation.x) * Math.min(1, dt * 14.0);
          } else if (isQuad) {
            // Fresh Animations Diagonal Trot vs Energetic Flee/Charge Gallop + Fluid Swim Kick!
            const phaseOff = isGallop ? (li < 2 ? 0 : Math.PI * 0.85) : (li >= 2 ? 0.35 : 0);
            const legWave = isGallop ? Math.sin(wpW + phaseOff) : (Math.sin(wpW + phaseOff) * lg.dir);
            lg.p.rotation.x = legWave * (0.04 + mv * (isHeavy ? 0.64 : (isGallop ? 0.96 : 0.84)));
          } else {
            lg.p.rotation.x = sw * lg.dir;
          }
          if (swimT > 0.02 && !lg.isSpider && !m.flying && !m.skyBird && !m.sitting && !m.hopper && !isDragon) {
            // Integrate swimPhase instead of multiplying global elapsed by variable speed so underwater limbs never jump phase
            const padPhase = spPhase + (isQuad ? (li < 2 ? 0 : Math.PI * 0.72) : (li * 0.4));
            const swimKick = Math.sin(padPhase) * (0.38 + mv * 0.44) * lg.dir;
            lg.p.rotation.x = lg.p.rotation.x * (1 - swimT) + swimKick * swimT;
          }
        }
        for (let ai = 0; ai < m.anim.arms.length; ai++) {
          const ar = m.anim.arms[ai];
          if (!ar || !ar.p || !ar.p.rotation) continue;
          const isAimingBow = isArcher && (canChasePlayer || preferVillager || m.atkAnimT > 0.01);
          if (ai === 0) {
            if (m.anim.bowIdle) m.anim.bowIdle.visible = !isAimingBow;
            if (m.anim.bowAim) m.anim.bowAim.visible = isAimingBow;
          }
          if (isPillager) {
            // Authentic Fresh Animations Pillager Two-Handed Crossbow Aim + Punchy! Recoil Kick!
            // In Three.js XYZ Euler, Rz runs first on (0,-1,0): negative Z brings Arm_L(+X) inward, positive Z brings Arm_R(-X) inward!
            const isLeftArm = (ar.dir > 0);
            const recoil = atkPhase * 0.32;
            const aimBob = Math.sin(wp * 2.0) * 0.04 * mv + Math.sin(elapsed * 2.3 + i) * 0.03;
            ar.p.rotation.x = (isLeftArm ? -1.30 : -1.36) - recoil + aimBob;
            ar.p.rotation.y = 0;
            ar.p.rotation.z = isLeftArm ? -0.46 : 0.16;
          } else if (isVind) {
            // Vindicator (Images 1 & 4): Crossed sleeves when calm -> Aggressive 3D Iron Axe raise & melee chop when aggroed!
            const showAxePose = !!(canChasePlayer || preferVillager || atkPhase > 0.02);
            if (m.anim.foldedArms) {
              m.anim.foldedArms.visible = !showAxePose;
              m.anim.foldedArms.rotation.x = -0.74 + dblBounce * 0.08 + Math.sin(elapsed * 2.4 + i) * 0.035;
            }
            const isLeftArm = (ar.dir > 0);
            ar.p.visible = showAxePose;
            if (showAxePose) {
              if (!isLeftArm) {
                // Right arm raises Iron Axe forward & chops down sharply on melee strike
                ar.p.rotation.x = -1.56 + atkPhase * 0.85 + Math.sin(elapsed * 4.5 + i) * 0.04;
                ar.p.rotation.y = 0;
                ar.p.rotation.z = -0.05;
              } else {
                ar.p.rotation.x = -0.25 + sw * 0.65;
                ar.p.rotation.y = 0;
                ar.p.rotation.z = 0.08;
              }
            }
          } else if (isEvoker) {
            // Authentic Minecraft Evoker (Images 3, 5 & 6): Folded Clasp Arms at Rest -> Skyward Wiggling Spellcast + Pixel Swirls!
            const casting = (atkPhase > 0.04);
            if (m.anim.foldedArms) {
              m.anim.foldedArms.visible = !casting;
              m.anim.foldedArms.rotation.x = -0.74 + dblBounce * 0.09 + Math.sin(elapsed * 2.4 + i) * 0.035;
              ar.p.visible = casting;
            } else {
              ar.p.visible = true;
            }
            if (casting) {
              const isLeftArm = (ar.dir > 0);
              const castWiggle = Math.sin(elapsed * 28.0 + i) * 0.18 * atkPhase;
              ar.p.rotation.x = -2.42 + castWiggle;
              ar.p.rotation.y = 0;
              ar.p.rotation.z = isLeftArm ? 0.36 : -0.36;
              if (m.type === 'evoker' && dist < 24 && ((frameCounter + i + ai) % 6) === 0) {
                const handX = m.x + Math.cos(m.ryaw) * (ar.dir * 0.42);
                const handZ = m.z - Math.sin(m.ryaw) * (ar.dir * 0.42);
                spawnPixelFx('evoker_spell', handX, m.y + 1.88, handZ, { count: 1, scale: 0.68, life: 0.45, riseV: 0.55, spread: 0.18 });
              }
            } else if (!m.anim.foldedArms) {
              ar.p.rotation.x = -0.88 + dblBounce * 0.09 + Math.sin(elapsed * 2.4 + i) * 0.035;
              ar.p.rotation.y = 0;
              ar.p.rotation.z = (ar.dir > 0 ? -0.46 : 0.46) + Math.sin(wp) * 0.03 * mv;
            }
          } else if (ar.isFolded) {
            ar.p.rotation.x = -0.74 + Math.sin(elapsed * 2.4 + i) * 0.035 + dblBounce * 0.09 - atkPhase * 0.32;
            ar.p.rotation.z = Math.sin(wp) * 0.03 * mv;
          } else if (isAimingBow) {
            // Skeleton Two-Handed Drawn Bow Stance (Image 1!): Right arm (+0.27, dir>0) holds canted bow forward; Left arm (-0.27, dir<0) draws string inward!
            const isRightArm = (ar.dir > 0);
            ar.p.rotation.x = (isRightArm ? -1.48 : -1.44) - atkPhase * (isRightArm ? 0.18 : 0.28) + Math.sin(elapsed * 2.5 + i) * 0.03;
            ar.p.rotation.y = 0;
            ar.p.rotation.z = isRightArm ? -0.26 : 0.34;
          } else if (isArcher) {
            // Relaxed / Walking Skeleton (Images 2 & 3!): Right hand (dir>0) holds 3D Bow comfortably at side!
            ar.p.rotation.x = (ar.dir > 0 ? -0.14 : -0.08) + sw * 0.55 * ar.dir;
            ar.p.rotation.y = 0;
            ar.p.rotation.z = ar.dir * 0.05 + Math.sin(elapsed * 2.2 + i) * 0.03;
          } else if (m.guardian) {
            // Iron Golem Heavy Stride + Iconic Double-Arm Skyward Uppercut Launch!
            const uppercut = -atkPhase * 2.38;
            ar.p.rotation.x = uppercut + sw * 0.72 * ar.dir + Math.sin(elapsed * 2.0 + i) * 0.05;
            ar.p.rotation.y = 0;
            ar.p.rotation.z = ar.dir * (0.10 + atkPhase * 0.28);
          } else {
            const zombieHold = isZombie ? (-1.42 + (ar.dir > 0 ? 0.14 : -0.10)) : (isEnderman && m.provoked > 0 ? -1.15 : 0);
            const atkSwing = -atkPhase * (isHeavy ? 2.15 : 1.85);
            const swayPhase = elapsed * 2.7 + i + (ar.dir > 0 ? 0 : 0.85);
            const baseArmX = zombieHold + atkSwing + Math.sin(swayPhase) * 0.085 + sw * (zombieHold ? 0.28 : 0.85) * ar.dir;
            const baseArmZ = ar.dir * (0.08 + Math.sin(elapsed * 2.2 + i) * 0.05 + dblBounce * 0.08 + atkPhase * 0.32);
            if (swimT > 0.02 && !isZombie && !(isEnderman && m.provoked > 0)) {
              const pAng = spPhase * 0.88 + (ar.dir > 0 ? 0 : Math.PI * 0.85);
              ar.p.rotation.x = baseArmX * (1 - swimT) + (-0.82 + atkSwing + Math.cos(pAng) * (0.46 + mv * 0.36)) * swimT;
              ar.p.rotation.z = baseArmZ * (1 - swimT) + (ar.dir * (0.36 + 0.16 * Math.sin(pAng))) * swimT;
            } else {
              ar.p.rotation.x = baseArmX;
              ar.p.rotation.z = baseArmZ;
            }
            ar.p.rotation.y = 0;
          }
        }
        if (m.anim.foldedArms && !isVind && !isEvoker) {
          m.anim.foldedArms.visible = true;
          m.anim.foldedArms.rotation.x = -0.74 + dblBounce * 0.09 + Math.sin(elapsed * 2.4 + i) * 0.035;
          m.anim.foldedArms.rotation.z = Math.sin(wp) * 0.03 * mv;
        }
        for (let wi = 0; wi < m.anim.wings.length; wi++) {
          const wg = m.anim.wings[wi];
          if (!wg || !wg.p || !wg.p.rotation) continue;
          if (wg.isDragonWing) {
            const perched = (!m.flying || m.sitting);
            const spdDrg = isRidingThis ? (player.curSpeed || 0) : Math.hypot(m.flyVx || m.vx || 0, m.flyVz || m.vz || 0);
            const drgVy = (m.flyVy !== undefined ? m.flyVy : (m.vy || 0));
            const swooping = (m.flying && (m.swoopT > 0 || drgVy < -4.2));
            const gliding = (m.flying && !swooping && spdDrg > 3.6 && drgVy > -1.0 && atkPhase < 0.05 && Math.sin(elapsed * 0.45 + i * 1.7) > 0.25);
            if (wi === 0) {
              const drgFreq = perched ? 1.9 : (gliding ? 1.8 : (swooping ? 2.6 : 4.8));
              m._drgWingPhase = (m._drgWingPhase || (i * 1.37)) + dt * drgFreq;
              m._drgGliding = gliding;
              m._drgSwooping = swooping;
            }
            const dPhase = m._drgWingPhase || (elapsed * 4.4 + i * 1.1);
            if (perched) {
              const breathe = Math.sin(dPhase) * 0.04;
              const foldIn = wg.dir * (0.30 + breathe);
              wg.p.rotation.z += (foldIn - wg.p.rotation.z) * Math.min(1, dt * 10.0);
              wg.p.rotation.y += (wg.dir * 0.74 - wg.p.rotation.y) * Math.min(1, dt * 10.0);
              if (wg.outer) {
                wg.outer.rotation.z += (wg.dir * -0.92 - wg.outer.rotation.z) * Math.min(1, dt * 10.0);
                wg.outer.rotation.y += (wg.dir * 0.36 - wg.outer.rotation.y) * Math.min(1, dt * 10.0);
              }
            } else if (swooping) {
              const tZ = wg.dir * (0.42 + Math.sin(dPhase) * 0.08);
              const tY = wg.dir * -0.45;
              const eZ = wg.dir * (-0.58 + Math.sin(dPhase - 0.5) * 0.07);
              wg.p.rotation.z += (tZ - wg.p.rotation.z) * Math.min(1, dt * 12.0);
              wg.p.rotation.y += (tY - wg.p.rotation.y) * Math.min(1, dt * 12.0);
              if (wg.outer) {
                wg.outer.rotation.z += (eZ - wg.outer.rotation.z) * Math.min(1, dt * 12.0);
                wg.outer.rotation.y += (wg.dir * 0.28 - wg.outer.rotation.y) * Math.min(1, dt * 12.0);
              }
            } else if (gliding) {
              const glideRoll = Math.sin(dPhase) * 0.07;
              const tZ = wg.dir * (0.16 + glideRoll);
              const eZ = wg.dir * (-0.10 + Math.sin(dPhase - 0.55) * 0.09);
              wg.p.rotation.z += (tZ - wg.p.rotation.z) * Math.min(1, dt * 9.0);
              wg.p.rotation.y += (wg.dir * 0.04 - wg.p.rotation.y) * Math.min(1, dt * 9.0);
              if (wg.outer) {
                wg.outer.rotation.z += (eZ - wg.outer.rotation.z) * Math.min(1, dt * 9.0);
                wg.outer.rotation.y += (wg.dir * 0.06 - wg.outer.rotation.y) * Math.min(1, dt * 9.0);
              }
            } else {
              // Continuous 2-joint dragon figure-8 power stroke & delayed outer wing whip
              const rawWave = Math.sin(dPhase) - 0.18 * Math.sin(dPhase * 2.0);
              const elbowWave = Math.sin(dPhase - 0.78) - 0.14 * Math.sin((dPhase - 0.78) * 2.0);
              if (wi === 0 && typeof player !== 'undefined' && player.ridingDragon === m && rawWave > 0.72 && (m._lastFlapT || 0) < elapsed - 0.55) {
                m._lastFlapT = elapsed;
                playSfx('wing_flap');
              }
              const tZ = wg.dir * (0.10 + rawWave * 0.64);
              const tY = wg.dir * (0.12 + Math.cos(dPhase) * 0.17);
              const eZ = wg.dir * (-0.18 + elbowWave * 0.58);
              wg.p.rotation.z += (tZ - wg.p.rotation.z) * Math.min(1, dt * 16.0);
              wg.p.rotation.y += (tY - wg.p.rotation.y) * Math.min(1, dt * 14.0);
              if (wg.outer) {
                wg.outer.rotation.z += (eZ - wg.outer.rotation.z) * Math.min(1, dt * 16.0);
                wg.outer.rotation.y += (wg.dir * 0.08 - wg.outer.rotation.y) * Math.min(1, dt * 14.0);
              }
            }
            continue;
          }
          const wingAmp = isRay ? 0.36 : (isDragon ? 0.82 : (m.flying ? 0.72 : (m.skyBird ? 0.88 : (m.vy !== 0 ? 0.94 : (0.14 + mv * 0.24)))));
          let glidePose, flapPose;
          if (wg.hangDown) {
            const airborneBird = !!(m.skyBird || m.flying || Math.abs(m.vy || 0) > 0.25);
            glidePose = wg.dir * (1.48 + Math.sin(elapsed * 2.1 + i) * 0.07);
            flapPose = airborneBird ? (wg.dir * (1.36 + wingBeat * 0.64)) : (wg.dir * (0.05 + mv * 0.14));
          } else {
            glidePose = wg.dir * (0.14 + Math.sin(elapsed * 2.1 + i) * 0.08);
            flapPose = (isDragon && !m.flying) ? (wg.dir * (-0.34 + Math.sin(elapsed * 2.2 + i) * 0.05)) : (wg.dir * (0.10 + wingBeat * wingAmp));
          }
          const targetZ = (m.skyBird && m._isGliding) ? glidePose : flapPose;
          wg.p.rotation.z += (targetZ - wg.p.rotation.z) * Math.min(1, dt * 14.0);
          wg.p.rotation.y = wg.dir * ((isDragon && !m.flying) ? -0.26 : ((m.skyBird && m._isGliding) ? -0.10 : (-Math.cos(wingCycle) * 0.16)));
        }
        if (m.anim.tail) {
          if (m.aqua) {
            m.anim.tail.rotation.y = Math.sin(elapsed * 6.4 + i - 1.15) * 0.54;
            m.anim.tail.rotation.x = Math.cos(elapsed * 3.2 + i) * 0.08;
          } else if (isDragon) {
            const dTailPh = m._drgWingPhase || (elapsed * 4.4 + i);
            const yawMul = m._drgSwooping ? 0.45 : (m._drgGliding ? 0.68 : 1.0);
            m.anim.tail.rotation.y = Math.sin(dTailPh) * 0.24 * yawMul;
            m.anim.tail.rotation.x = Math.cos(dTailPh - 0.6) * 0.12 - (m._flyPitch || 0) * 0.35;
            if (m.anim.tail2) {
              m.anim.tail2.rotation.y = Math.sin(dTailPh - 0.68) * 0.26 * yawMul;
              m.anim.tail2.rotation.x = Math.cos(dTailPh - 1.28) * 0.13;
            }
            if (m.anim.tail3) {
              m.anim.tail3.rotation.y = Math.sin(dTailPh - 1.36) * 0.30 * yawMul;
              m.anim.tail3.rotation.x = Math.cos(dTailPh - 1.96) * 0.11;
            }
          } else {
            const tailFreq = m.tamed ? 11.5 : (mv > 0.2 ? 8.2 : 3.8);
            const tailAmp = m.tamed ? 0.58 : (mv > 0.2 ? 0.44 : 0.24);
            m.anim.tail.rotation.y = Math.sin(elapsed * tailFreq + i) * tailAmp;
            m.anim.tail.rotation.x = m.tamed ? 0.28 : -0.06 + dblBounce * 0.14;
            if (m.anim.tail2) {
              m.anim.tail2.rotation.y = Math.sin(elapsed * tailFreq + i - 0.8) * 0.24;
              m.anim.tail2.rotation.x = Math.cos(wingCycle - 1.5) * 0.12;
            }
            if (m.anim.tail3) {
              m.anim.tail3.rotation.y = Math.sin(elapsed * tailFreq + i - 1.6) * 0.28;
            }
          }
        }
        if (m.anim.neck1 && isDragon) {
          const dNeckPh = m._drgWingPhase || (elapsed * 2.4 + i);
          const torsoPitch = m.anim.torso ? m.anim.torso.rotation.x : 0;
          const targetNX = -torsoPitch * 0.55 + Math.sin(dNeckPh * 0.65) * 0.06 + (atkPhase > 0.05 ? -0.18 * atkPhase : 0) + (m.flying ? -0.06 : 0.04);
          m.anim.neck1.rotation.x += (targetNX - m.anim.neck1.rotation.x) * Math.min(1, dt * 10.0);
        }
        if (m.anim.core) {
          if (m.type === 'cave_warden') {
            const chargeGlow = (m._sonicChargeT > 0) ? 2.4 : (0.65 + (m._heartBeatFlash || 0) * 1.15);
            if (m.anim.coreMat) m.anim.coreMat.emissiveIntensity = chargeGlow;
            const tendWig = (m._tendrilFlashT > 0) ? Math.sin(elapsed * 32.0 + i) * 0.28 : Math.sin(elapsed * 4.2 + i) * 0.08;
            if (m.anim.tendrilL) m.anim.tendrilL.rotation.z = tendWig;
            if (m.anim.tendrilR) m.anim.tendrilR.rotation.z = -tendWig;
            if (m.anim.tendrilMat) m.anim.tendrilMat.emissiveIntensity = (m._tendrilFlashT > 0) ? 1.85 : 0.72;
          } else {
            m.anim.core.rotation.y += dt * 2.6;
            const cp = 1.0 + Math.sin(elapsed * 5.4 + i) * 0.12;
            m.anim.core.scale.setScalar(cp);
          }
        }
        if (m.anim.jaw) {
          const enderGape = (isEnderman && m.provoked > 0) ? (0.48 + Math.sin(elapsed * 24 + i) * 0.12) : 0;
          const ravRoar = isRavager ? (atkPhase * 0.58 + (mv > 0.3 ? Math.abs(Math.sin(wp)) * 0.18 : 0.03)) : 0;
          const jawOpen = enderGape + ravRoar + (!isRavager && atkPhase > 0.05 ? 0.60 * atkPhase : 0) + (!isRavager && m.hostile && dist < (isDragon ? 45 : 10) ? 0.12 + Math.abs(Math.sin(elapsed * 4.5 + i)) * 0.30 : 0.03);
          m.anim.jaw.rotation.x = jawOpen;
          if (isDragon && m.anim.breathCoreMat) {
            const roarGlow = (atkPhase > 0.05 || jawOpen > 0.24) ? (1.4 + Math.sin(elapsed * 16.0 + i) * 0.6 + atkPhase * 0.8) : (0.38 + Math.sin(elapsed * 3.2 + i) * 0.12);
            m.anim.breathCoreMat.emissiveIntensity = roarGlow;
            if (m.anim.breathCore) m.anim.breathCore.scale.setScalar(atkPhase > 0.05 ? 1.25 : 1.0);
          }
        }
        if (m.anim.head) {
          if (m.type === 'shulker') {
            m.anim.head.position.y = 0.88 + (dist3D < 16 ? 0.22 + Math.sin(elapsed * 4.0 + i) * 0.06 : 0.0);
            m.anim.head.rotation.y += dt * (dist3D < 16 ? 1.8 : 0.0);
          } else {
            // Head Counter-Stabilization + Grazing Dip + Ravager Bull Horn-Ram + Curious Idle Glances (Fresh Animations!)
            const headLagBob = Math.sin(wp * 2.0 - 0.8) * 0.058 * mv;
            const ravChargePitch = isRavager ? (0.28 * mv - atkPhase * 0.52) : 0;
            const targetHX = Math.sin(elapsed * 2.0 + i) * 0.06 + headLagBob + grazeDip + ravChargePitch + (!isRavager ? atkPhase * 0.24 : 0) + (isZombie ? 0.16 : 0);
            const targetHZ = Math.sin(elapsed * 1.35 + i * 2.1) * (mv > 0.2 ? 0.045 : 0.12) + (isZombie ? -0.14 : 0) - turnBank * 0.48;
            m.anim.head.rotation.x += (targetHX - m.anim.head.rotation.x) * Math.min(1, dt * 10.5);
            m.anim.head.rotation.z += (targetHZ - m.anim.head.rotation.z) * Math.min(1, dt * 10.5);
            if (dist < (isDragon ? 44 : 12.0)) {
              let relYaw = Math.atan2(player.x - m.x, player.z - m.z) - m.ryaw;
              while (relYaw > Math.PI) relYaw -= Math.PI * 2;
              while (relYaw < -Math.PI) relYaw += Math.PI * 2;
              const targetHY = Math.max(-0.82, Math.min(0.82, relYaw));
              m.anim.head.rotation.y += (targetHY - m.anim.head.rotation.y) * Math.min(1, dt * 8.5);
            } else {
              m.anim.head.rotation.y += (m.lookYaw - m.anim.head.rotation.y) * Math.min(1, dt * 3.8);
            }
          }
        }
        if (m.anim.rider) {
          const rd = m.anim.rider;
          const isSJ = (m.type === 'spider_jockey');
          const isRiderAim = isSJ && (canChasePlayer || preferVillager || m.atkAnimT > 0.01);
          if (rd.bowIdle) rd.bowIdle.visible = !isRiderAim;
          if (rd.bowAim) rd.bowAim.visible = isRiderAim;
          if (rd.torso) {
            rd.torso.rotation.y = Math.sin(wp) * 0.06 * mv;
            rd.torso.rotation.x = idleBreath * 0.6 + (isSJ ? 0.04 : 0.10) * mv + atkPhase * 0.16;
          }
          for (let ri = 0; ri < rd.legs.length; ri++) {
            const rlg = rd.legs[ri];
            if (rlg && rlg.p) {
              rlg.p.rotation.x = (rlg.restX ?? -1.25) + Math.sin(wp * 2.0) * 0.04 * mv;
              rlg.p.rotation.y = rlg.restY ?? 0;
            }
          }
          for (let ri = 0; ri < rd.arms.length; ri++) {
            const rar = rd.arms[ri];
            if (!rar || !rar.p) continue;
            const isRightArm = (rar.dir > 0);
            if (isSJ) {
              if (isRiderAim) {
                rar.p.rotation.x = (isRightArm ? -1.48 : -1.44) - atkPhase * (isRightArm ? 0.18 : 0.28) + Math.sin(elapsed * 2.5 + i) * 0.03;
                rar.p.rotation.y = 0;
                rar.p.rotation.z = isRightArm ? -0.26 : 0.34;
              } else {
                rar.p.rotation.x = (isRightArm ? -0.54 : -0.60) + Math.sin(elapsed * 2.3 + i) * 0.04 * (isRightArm ? 1 : -1);
                rar.p.rotation.y = 0;
                rar.p.rotation.z = isRightArm ? -0.06 : 0.08;
              }
            } else {
              rar.p.rotation.x = -1.48 - atkPhase * 0.55 + Math.sin(elapsed * 3.0 + i + (isRightArm ? 0 : 0.7)) * 0.06;
              rar.p.rotation.y = 0;
              rar.p.rotation.z = rar.dir * 0.06;
            }
          }
          if (rd.head) {
            let rYaw = Math.atan2(player.x - m.x, player.z - m.z) - m.ryaw;
            while (rYaw > Math.PI) rYaw -= Math.PI * 2;
            while (rYaw < -Math.PI) rYaw += Math.PI * 2;
            const tHY = (dist < 16.0) ? Math.max(-0.82, Math.min(0.82, rYaw)) : m.lookYaw;
            rd.head.rotation.y += (tHY - rd.head.rotation.y) * Math.min(1, dt * 8.5);
            rd.head.rotation.x = Math.sin(elapsed * 2.1 + i) * 0.05 + grazeDip * 0.2 + atkPhase * 0.16;
          }
        }
        }
      }
    }
    if (_mobSimAuth && activeRoomId && typeof broadcastMobSync === 'function') {
      let hasNetPeer = ((typeof bcRoomPeers !== 'undefined' && bcRoomPeers.size > 0)
        || (typeof mqttRoomPeers !== 'undefined' && mqttRoomPeers.size > 0)
        || (typeof p2pClientConns !== 'undefined' && p2pClientConns.size > 0));
      if (!hasNetPeer && typeof remotePlayers !== 'undefined' && remotePlayers) {
        for (const rp of remotePlayers.values()) {
          if (rp && !rp.isBuddy) { hasNetPeer = true; break; }
        }
      }
      const hasWs = (typeof wsConn !== 'undefined' && wsConn && wsConn.readyState === 1);
      if (hasNetPeer || hasWs) {
        const hasMqttPeer = (typeof mqttRoomPeers !== 'undefined' && mqttRoomPeers.size > 0);
        const peerCntM = (typeof remotePlayers !== 'undefined' && remotePlayers) ? remotePlayers.size : 0;
        const syncIntMs = hasNetPeer ? (hasMqttPeer ? 130 : (peerCntM >= 4 ? 95 : 75)) : 2500;
        if ((_mobNowMs - _mobNetLastSyncMs) >= syncIntMs) {
          _mobNetLastSyncMs = _mobNowMs;
          const needFull = (_mobNetKeyframeMs === 0 || (_mobNowMs - _mobNetKeyframeMs) >= 12000);
          const list = serializeMobsForNet(currentDimension, { delta: !needFull });
          if (needFull) _mobNetKeyframeMs = _mobNowMs;
          if (needFull || list.length > 0 || _mobNetRemQueue.length > 0) {
            const rm = _mobNetRemQueue.splice(0, _mobNetRemQueue.length);
            broadcastMobSync(currentDimension, list, { seq: ++_mobNetSeq, ts: Math.round(_mobNowMs), full: needFull, rm });
          }
        }
      }
    }

    _updateDragonWingTrails(player.ridingDragon || null, player.curSpeed || 0, dt);
    if (!dragonBeamActive && dragonHealBeam.visible) dragonHealBeam.visible = false;
    if (!dragonGlowActive && dragonBodyGlow.visible) dragonBodyGlow.visible = false;

    if (activeBoss) {
      const bst = MOB_STATS[activeBoss.type] || {};
      const hpCeil = Math.max(0, Math.ceil(activeBoss.hp));
      const pct = activeBoss.hp / activeBoss.maxHp;
      const isDrg = IS_DRAGON_MOB.has(activeBoss.type);
      const isEnderDrg = (activeBoss.type === 'ender_dragon');
      const modeBadge = activeBoss.elemDragon ? (activeBoss.flying ? '✈️ BAY' : '🐾 ĐI ĐẤT') : '';
      const phaseTxt = isDrg ? (activeBoss.lastSkillLabel || (pct < 0.34 ? 'PHASE III • CATACLYSM' : (pct < 0.67 ? 'PHASE II • ENRAGED' : 'PHASE I'))) : (activeBoss.hp < activeBoss.maxHp * 0.5 ? 'CUỒNG NỘ!' : '');
      const cryTxt = isEnderDrg ? `Pha Lê End: ${_endCrystalCache.count}` : modeBadge;
      const bossSig = `B|${activeBoss.type}|${hpCeil}|${activeBoss.maxHp}|${phaseTxt}|${cryTxt}`;
      if (bossSig !== _lastBossUiSig) {
        _lastBossUiSig = bossSig;
        _elBossWrap.classList.add('visible');
        _elBossWrap.classList.toggle('is-dragon', isDrg);
        _elBossWrap.classList.remove('is-mob');
        if (isDrg && _elBossCrest) {
          const crestPal = {
            ender_dragon: ['#2d1438', '#a855f7', '#f0abfc', '#581c87'],
            ice_dragon:   ['#0284c7', '#bae6fd', '#fef08a', '#075985'],
            fire_dragon:  ['#b91c1c', '#f59e0b', '#fef08a', '#7f1d1d'],
            earth_dragon: ['#7c4a26', '#a8a29e', '#34d399', '#452714'],
            water_dragon: ['#0369a1', '#67e8f9', '#fef9c3', '#0c4a6e'],
            leaf_dragon:  ['#15803d', '#86efac', '#fde047', '#14532d'],
            tree_dragon:  ['#5c3a21', '#a3e635', '#facc15', '#3f2314'],
            void_end_dragon:     ['#3b0764', '#e879f9', '#22d3ee', '#1e0634'],
            amethyst_end_dragon: ['#581c87', '#f0abfc', '#f472b6', '#2e1065'],
            storm_end_dragon:    ['#1e1b4b', '#38bdf8', '#22d3ee', '#0f172a'],
            abyss_end_dragon:    ['#500724', '#fb7185', '#f43f5e', '#1a0410'],
            sovereign_end_dragon:['#1e0b36', '#38bdf8', '#e879f9', '#0c041a']
          }[activeBoss.type] || ['#2d1438', '#a855f7', '#f0abfc', '#581c87'];
          _elBossCrest.style.setProperty('--drg-head', crestPal[0]);
          _elBossCrest.style.setProperty('--drg-horn', crestPal[1]);
          _elBossCrest.style.setProperty('--drg-eye', crestPal[2]);
          _elBossCrest.style.setProperty('--drg-snout', crestPal[3]);
        }
        _elBossName.textContent = isEnderDrg ? 'Rồng Ender' : (bst.bossLabel || activeBoss.displayName || 'BOSS');
        _elBossMeta.textContent = `${hpCeil} / ${activeBoss.maxHp}`;
        _elBossFill.style.width = `${Math.max(0, pct * 100)}%`;
        _elBossFill.style.background = isEnderDrg ? 'linear-gradient(180deg,#ef5aff,#c026d3,#86198f)' : (bst.bossGrad || 'linear-gradient(180deg,#ef4444,#b91c1c)');
        _elBossPhase.textContent = phaseTxt;
        _elBossCrystal.textContent = cryTxt;
      }
    } else if (lastTargetMob && !lastTargetMob._dead && !lastTargetMob.tamed && lastTargetMob.hp > 0) {
      const hpCeil = Math.max(0, Math.ceil(lastTargetMob.hp));
      const mobSig = `M|${lastTargetMob.displayName || lastTargetMob.type}|${hpCeil}|${lastTargetMob.maxHp}`;
      if (mobSig !== _lastBossUiSig) {
        _lastBossUiSig = mobSig;
        // Pure Minecraft Clean Red Targeted Mob HP Bar (Matches Reference images (38).jpg!)
        _elBossWrap.classList.add('visible', 'is-mob');
        _elBossWrap.classList.remove('is-dragon');
        _elBossName.textContent = lastTargetMob.displayName || lastTargetMob.type;
        _elBossMeta.textContent = `${hpCeil} / ${lastTargetMob.maxHp}`;
        _elBossFill.style.width = `${Math.max(0, (lastTargetMob.hp / lastTargetMob.maxHp) * 100)}%`;
        _elBossFill.style.background = '';
      }
    } else if (_lastBossUiSig !== '') {
      _lastBossUiSig = '';
      _elBossWrap.classList.remove('visible', 'is-dragon', 'is-mob');
    }
  }

  function updateProjectilesAndTnt(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.life -= dt;
      if (p.life <= 0) { scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); continue; }
      if (p.stuck) continue;
      if (p.kind === 'arrow' || p.kind === 'snowball') p.vy -= 14.5 * dt;
      else if (p.gravity) p.vy -= p.gravity * dt;
      const prevPx = p.x, prevPy = p.y, prevPz = p.z;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      if (sodiumOpts.entityCulling && _camFrustumReady) {
        _cullSphere.center.set(p.x, p.y, p.z);
        _cullSphere.radius = Math.max(0.85, (p.scale || 1) * 0.65);
        p.mesh.visible = _camFrustum.intersectsSphere(_cullSphere);
      } else {
        p.mesh.visible = true;
      }
      if (p.kind === 'arrow') p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      else if (p.pfxSheet) {
        p.pfxT = (p.pfxT || 0) + dt * 14.0;
        p.mesh.material = p.pfxSheet.mats[(p.pfxT | 0) % p.pfxSheet.frames];
        if (((frameCounter + i) % 3) === 0 && p.pfxKey) {
          spawnPixelFx(p.pfxKey, p.x, p.y, p.z, { count: 1, scale: p.trailScale || 0.44, life: 0.28, spread: (p.scale || 1) >= 2.0 ? 0.36 : 0.14, vx: 0, vy: 0.15, vz: 0 });
        }
      }

      if (isSolidAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
        if (p._remoteVisual) {
          if (p.kind === 'arrow') { p.stuck = true; p.life = Math.min(p.life, 1.2); playSfx('dig'); continue; }
          if (p.kind === 'snowball') { spawnParticles(p.x, p.y, p.z, 0xe0f2fe, 10, true); playSfx('dig'); }
          scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); continue;
        }
        const hitBId = getBlockWorld(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
        if (hitBId === B.END_CRYSTAL_BLOCK) {
          const cx = Math.floor(p.x), cy = Math.floor(p.y), cz = Math.floor(p.z);
          detonateEndCrystalAt(cx, cy, cz);
          scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); continue;
        }
        if (p.kind === 'snowball') {
          spawnParticles(p.x, p.y, p.z, 0xe0f2fe, 10, true);
          playSfx('dig');
          emitSculkVibration(p.x, p.y, p.z, 'projectile', 14);
          scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); continue;
        }
        if (p.kind !== 'arrow') {
          const sr = p.splashR || 3.4, vSc = p.vfxScale || 1.2, isBigDrg = (p.scale || 1) >= 2.0;
          if (p.kind === 'ghast_fire') triggerExplosion(p.x, p.y, p.z, 2.2, p.dmg, 'Bạn bị Cầu Lửa Ghast nổ trúng!');
          else if (p.kind && p.kind.startsWith('drg_')) {
            applyElementalDragonImpact(p.kind, p.x, p.y, p.z, false);
            spawnPixelFx(p.pfxKey || 'magic_ender', p.x, p.y + 0.45, p.z, { count: isBigDrg ? 4 : 2, scale: vSc, life: 0.56, spread: isBigDrg ? 1.5 : 0.4 });
            playSfx('mob_explode');
            if (p.friendlyDragon) {
              for (let mi = mobs.length - 1; mi >= 0; mi--) {
                const mb = mobs[mi];
                if (!mb || mb._dead || mb.tamed || mb === p.ownerDragon) continue;
                if (Math.hypot(mb.x - p.x, mb.y + 0.8 - p.y, mb.z - p.z) < sr) {
                  const kx = p.effect === 'vortex' ? (p.x - mb.x) : p.vx;
                  const kz = p.effect === 'vortex' ? (p.z - mb.z) : p.vz;
                  const ky = p.effect === 'quake' ? 9.5 : 4.2;
                  hurtMob(mb, p.dmg * 0.90, kx, kz, ky, p.kind === 'drg_fire' || p.kind === 'drg_fire_meteor', false);
                  if (p.effect === 'freeze') mb._chilledT = 4.0;
                }
              }
            } else {
              if (!player.dead && Math.hypot(player.x - p.x, player.y + 0.8 - p.y, player.z - p.z) < sr * 0.85) {
                applyElementalDragonImpact(p.kind, p.x, p.y, p.z, true);
                hurtPlayer(p.dmg, 'Bạn trúng đòn nguyên tố của Rồng!');
              }
              for (let mi = mobs.length - 1; mi >= 0; mi--) {
                const tm = mobs[mi];
                if (!tm || tm._dead || !tm.tamed) continue;
                if (Math.hypot(tm.x - p.x, tm.y + 0.8 - p.y, tm.z - p.z) < sr * 0.85) hurtMob(tm, p.dmg * 0.85, p.vx, p.vz, 3.8, p.kind === 'drg_fire', false);
              }
            }
          } else {
            const hitPfx = p.kind === 'ice_shard' ? 'ice_shatter' : (p.kind === 'sonic_boom' || p.kind === 'guardian_beam' ? 'lightning_arc' : (p.kind === 'blaze_fire' ? 'explosion_fire' : (p.kind === 'witch_potion' || p.kind === 'poison_arrow' ? 'magic_poison' : (p.pfxKey || 'magic_ender'))));
            spawnPixelFx(hitPfx, p.x, p.y + 0.35, p.z, { count: isBigDrg ? 4 : 2, scale: vSc, life: 0.54, spread: isBigDrg ? 1.5 : 0.35 });
            playSfx('mob_explode');
            if (p.kind === 'dragon_ball' && p.effect === 'acid') {
              spawnDragonBreathCloud(p.x, colGroundY(Math.floor(p.x), Math.floor(p.z)) + 1.0, p.z, 1.35);
            }
            if (!player.dead && Math.hypot(player.x - p.x, player.y + 0.8 - p.y, player.z - p.z) < sr) {
              hurtPlayer(p.dmg, p.kind === 'sonic_boom' ? 'Bạn trúng Sóng Âm Warden!' : (p.kind === 'blaze_fire' ? 'Bạn trúng Cầu Lửa Blaze!' : 'Bạn trúng đòn năng lượng Rồng!'));
            }
          }
          scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); continue;
        }
        p.stuck = true; p.life = Math.min(p.life, 1.5); playSfx('dig'); emitSculkVibration(p.x, p.y, p.z, 'projectile', 14); continue;
      }
      if (p._remoteVisual) continue;
      if (p.fromPlayer || p.friendlyDragon) {
        let hit = false;
        const hitPad = p.friendlyDragon ? Math.max(0.95, (p.scale || 1) * 0.45) : 0.35;
        for (let mi = mobs.length - 1; mi >= 0; mi--) {
          const m = mobs[mi];
          if (p.friendlyDragon && (m.tamed || m === p.ownerDragon)) continue;
          if (Math.hypot(m.x - p.x, m.z - p.z) < m.hitboxR + hitPad && p.y >= m.y - 0.5 && p.y <= m.y + m.hitboxH + 0.85) {
            playSfx('crit');
            spawnPixelFx(p.kind === 'snowball' ? 'ice_shatter' : (p.pfxKey || 'crit_star'), p.x, p.y, p.z, { count: (p.scale || 1) >= 2.0 ? 3 : 1, scale: p.vfxScale || 0.85, life: 0.44, spread: (p.scale || 1) >= 2.0 ? 1.1 : 0.1 });
            hurtMob(m, p.dmg, p.vx, p.vz, p.effect === 'quake' ? 9.5 : (p.kind === 'snowball' ? 2.5 : 4.2), p.kind === 'drg_fire' || p.kind === 'drg_fire_meteor', !p.friendlyDragon);
            if (!p.friendlyDragon) emitSculkVibration(p.x, p.y, p.z, 'projectile', 14);
            hit = true; break;
          }
        }
        if (hit) { scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); }
      } else {
        let hitMobOrP = false;
        const pHitR = p.kind === 'arrow' ? 0.5 : Math.max(1.1, (p.scale || 1) * 0.52);
        const hitMsgs = {
          dragon_ball: 'Bạn trúng Cầu Lửa Rồng Ender Dragon!',
          sonic_boom: 'Bạn trúng Sóng Âm của Warden!',
          blaze_fire: 'Bạn bị Quỷ Lửa / Thần Lửa Wildfire thiêu đốt!',
          ghast_fire: 'Bạn bị Hồn Ma Ghast bắn nổ!',
          shulker_bolt: 'Bạn trúng đạn Lơ Lửng của Shulker!',
          poison_arrow: 'Bạn trúng Mũi Tên Nấm Độc của Skeleton Bogged!'
        };
        if (!player.dead && Math.hypot(player.x - p.x, player.z - p.z) < pHitR && p.y >= player.y - 0.3 && p.y <= player.y + PLAYER_HEIGHT + 0.5) {
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const pHoriz = Math.hypot(p.vx, p.vz) || 1;
          const fromFront = (-(p.vx * fx + p.vz * fz)) >= -0.25 * pHoriz;
          if (isPlayerShieldBlocking() && (player.shieldRaiseT || 0) > 0.30 && fromFront) {
            playSfx('equip');
            spawnPixelFx('shield_clang', player.x + fx * 0.55, player.y + 1.15, player.z + fz * 0.55, { count: 1, scale: 1.05, life: 0.34, vx: fx * 0.5, vz: fz * 0.5 });
            damagePlayerShield(Math.max(1, Math.ceil(p.dmg)), false);
            p.vx = -p.vx * 0.35 + (Math.random() - 0.5) * 2.5;
            p.vy = 2.6;
            p.vz = -p.vz * 0.35 + (Math.random() - 0.5) * 2.5;
            p.life = Math.min(p.life, 0.55);
            p.fromPlayer = true;
            p.dmg = 0;
            continue;
          }
          hurtPlayer(p.dmg, hitMsgs[p.kind] || 'Bạn bị quái vật tấn công!', false, true, { fromPos: { x: p.x - p.vx, z: p.z - p.vz } });
          if (p.kind && p.kind.startsWith('drg_')) applyElementalDragonImpact(p.kind, p.x, p.y, p.z, true);
          if (p.kind === 'shulker_bolt') player.vy = 9.5;
        if (p.kind !== 'arrow') {
            const pImp = p.kind === 'ice_shard' ? 'ice_shatter' : (p.kind === 'sonic_boom' || p.kind === 'guardian_beam' ? 'lightning_arc' : (p.kind === 'blaze_fire' ? 'explosion_fire' : (p.kind === 'poison_arrow' || p.kind === 'witch_potion' ? 'magic_poison' : 'magic_ender')));
            spawnPixelFx(pImp, p.x, p.y, p.z, { count: 2, scale: 1.0, life: 0.38 });
          }
          hitMobOrP = true;
        } else {
            if (activeRoomId && typeof isSimAuthority === 'function' && isSimAuthority() && typeof remotePlayers !== 'undefined' && remotePlayers) {
              for (const [rpid, rp] of remotePlayers.entries()) {
                if (!rp || rp.isBuddy || (rp.dim || 'overworld') !== currentDimension) continue;
                if (Math.hypot(rp.x - p.x, rp.z - p.z) < pHitR && p.y >= rp.y - 0.3 && p.y <= rp.y + PLAYER_HEIGHT + 0.5) {
                  sendCoopMsg({ type: 'mob_player_hit', _to: rpid, dim: currentDimension, dmg: p.dmg, msg: hitMsgs[p.kind] || 'Bạn bị quái vật bắn trúng!', fx: p.x - p.vx, fz: p.z - p.vz, kbY: p.kind === 'shulker_bolt' ? 9.5 : 0 });
                  hitMobOrP = true; break;
                }
              }
            }
            if (!hitMobOrP) {
            // Hostile ranged projectiles can also strike Villagers, Iron Golems, and Tamed Companions/Dragons!
            for (let mi = mobs.length - 1; mi >= 0; mi--) {
              const vm = mobs[mi];
              if (!vm || vm._dead || (!vm.villager && !vm.guardian && !vm.tamed) || vm === p.ownerDragon) continue;
              if (p.kind !== 'arrow' && !p.kind.startsWith('drg_') && p.kind !== 'dragon_ball' && !vm.villager && !vm.guardian) continue;
              const hitR = vm.tamed ? (vm.hitboxR + (vm.elemDragon ? 1.65 : 0.95)) : (vm.hitboxR + 0.35);
              let hitDrg3D = false;
              if (vm.tamed) {
                const svx = p.x - prevPx, svy = p.y - prevPy, svz = p.z - prevPz;
                const sv2 = svx * svx + svy * svy + svz * svz;
                const cy = vm.y + vm.hitboxH * 0.55;
                const st = sv2 > 1e-6 ? Math.max(0, Math.min(1, ((vm.x - prevPx) * svx + (cy - prevPy) * svy + (vm.z - prevPz) * svz) / sv2)) : 1;
                const cpx = prevPx + svx * st, cpy = prevPy + svy * st, cpz = prevPz + svz * st;
                hitDrg3D = Math.hypot(vm.x - cpx, cy - cpy, vm.z - cpz) < hitR;
              }
              const hitBox = Math.hypot(vm.x - p.x, vm.z - p.z) < hitR && p.y >= vm.y - 0.5 && p.y <= vm.y + vm.hitboxH + 0.8;
              if (hitDrg3D || hitBox) {
                hurtMob(vm, p.dmg, p.vx, p.vz, 3.2, p.kind === 'drg_fire', false);
                hitMobOrP = true; break;
              }
            }
          }
        }
        if (hitMobOrP) { scene.remove(p.mesh); projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); }
      }
    }

    for (let i = primedTnts.length - 1; i >= 0; i--) {
      const t = primedTnts[i]; t.fuse -= dt;
      t.vy -= 18 * dt; t.y += t.vy * dt;
      if (isSolidAt(Math.floor(t.x), Math.floor(t.y), Math.floor(t.z))) { t.y = Math.floor(t.y) + 1; t.vy = 0; }
      t.mesh.position.set(t.x, t.y + 0.5, t.z);
      const flash = Math.sin(t.fuse * 24) > 0;
      const tMats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
      for (let mi = 0; mi < tMats.length; mi++) if (tMats[mi] && tMats[mi].emissive) tMats[mi].emissive.setHex(flash ? 0xffffff : 0x000000);
      const sc = 3.65 + (flash ? 0.35 : 0);
      t.mesh.scale.setScalar(sc);
      if (t.fuse <= 0) {
        scene.remove(t.mesh); primedTnts.splice(i, 1);
        if (!t._remoteVisual && (!activeRoomId || typeof isSimAuthority !== 'function' || isSimAuthority())) {
          triggerExplosion(t.x, t.y, t.z, 3.6, 18, 'Bạn bị Thuốc Nổ TNT thổi bay!');
        }
      }
    }
  }

