(function (root) {
  'use strict';

  const GFX_PREFS_KEY = 'nucraft_gfx_prefs_v1';
  const CRASH_GUARD_KEY = 'nucraft_crash_guard_v2';
  const LEGACY_CRASH_KEY = 'nucraft_crash_guard';

  const GFX_PRESETS = {
    low: {
      id: 'low',
      label: 'Nhẹ',
      maxPixelRatio: 1.0,
      shadowSize: 0,
      shadowIntervalMs: 0,
      reflW: 0,
      reflH: 0,
      reflIntervalMs: 0,
      fxIntervalMs: 0,
      shadowChunkRange: 0,
      grassCullExtra: false
    },
    high: {
      id: 'high',
      label: 'RTX Chuẩn',
      maxPixelRatio: 1.0,
      shadowSize: 2048,
      shadowIntervalMs: 0,
      reflW: 512,
      reflH: 288,
      reflIntervalMs: 0,
      fxIntervalMs: 56,
      shadowChunkRange: 24,
      grassCullExtra: false
    },
    ultra: {
      id: 'ultra',
      label: 'RTX Ultra',
      maxPixelRatio: 1.25,
      shadowSize: 2048,
      shadowIntervalMs: 0,
      reflW: 640,
      reflH: 360,
      reflIntervalMs: 0,
      fxIntervalMs: 44,
      shadowChunkRange: 32,
      grassCullExtra: true
    },
    extreme: {
      id: 'extreme',
      label: 'Siêu Thực',
      maxPixelRatio: 1.5,
      shadowSize: 4096,
      shadowIntervalMs: 0,
      reflW: 768,
      reflH: 432,
      reflIntervalMs: 0,
      fxIntervalMs: 32,
      shadowChunkRange: 36,
      grassCullExtra: true
    }
  };

  function detectGpuTier(gl) {
    let rendererStr = '';
    try {
      if (gl) {
        const dbg = gl.getExtension && gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) rendererStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
        if (!rendererStr) rendererStr = String(gl.getParameter(gl.RENDERER) || '');
      }
    } catch (_) {}
    const isSoftware = /swiftshader|llvmpipe|software|microsoft basic render|mali-4|adreno\s*\(tm\)\s*[34]\b/i.test(rendererStr);
    const isDedicated = /nvidia|geforce|rtx|gtx|radeon|rx\s*\d|amd\s|arc\s*a|apple\s*m[1-9]|adreno\s*\(tm\)\s*[678]/i.test(rendererStr);
    return { renderer: rendererStr || 'WebGL', isSoftware, isDedicated };
  }

  function detectHardwareProfile(gl) {
    const isTouchInitial = !!(
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test((typeof navigator !== 'undefined' && navigator.userAgent) || '')
    );
    const cores = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0)
      ? navigator.hardwareConcurrency
      : 8;
    const mem = (typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0)
      ? navigator.deviceMemory
      : 8;
    const gpu = detectGpuTier(gl);
    const isExe = (typeof location !== 'undefined' && /[?&]exe=1\b/.test(location.search || ''));
    // Only flag true mobile devices, software renderers, <=2 CPU threads, or <=2GB explicit memory
    const isWeakDevice = !!(isTouchInitial || gpu.isSoftware || cores <= 2 || mem <= 2);
    return {
      isMobile: isTouchInitial,
      isMobilePerf: isTouchInitial,
      isWeakDevice,
      isExe,
      cores,
      mem,
      gpu
    };
  }

  function normalizeQuality(q, fallback = 'high') {
    if (q === 'low' || q === 'high' || q === 'ultra' || q === 'extreme') return q;
    if (q === 'medium') return 'high';
    return fallback;
  }

  function loadGfxPrefs(hw) {
    const isMaxDesktop = !(hw && (hw.isMobile || (hw.gpu && hw.gpu.isSoftware)));
    const defaultQuality = isMaxDesktop ? 'ultra' : ((hw && (hw.isMobile || (hw.gpu && hw.gpu.isSoftware))) ? 'low' : 'high');
    const base = {
      shaderQuality: defaultQuality,
      renderDistance: 4,
      shaderPreset: 'eclipse',
      bumpEnabled: !(hw && hw.isMobile),
      volumetricClouds: true
    };
    try {
      const raw = JSON.parse(localStorage.getItem(GFX_PREFS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (raw.shaderQuality !== undefined) base.shaderQuality = normalizeQuality(raw.shaderQuality, defaultQuality);
        if (typeof raw.renderDistance === 'number' && raw.renderDistance >= 3 && raw.renderDistance <= 8) {
          base.renderDistance = raw.renderDistance | 0;
        } else if (typeof raw.renderDistance === 'number' && raw.renderDistance === 2) {
          base.renderDistance = 3;
        }
        if (raw.shaderPreset === 'eclipse' || raw.shaderPreset === 'bsl' || raw.shaderPreset === 'bliss' || raw.shaderPreset === 'moonlit' || raw.shaderPreset === 'chill_sunset' || raw.shaderPreset === 'verdant_fresh' || raw.shaderPreset === 'dlss_ultra') {
          base.shaderPreset = raw.shaderPreset;
        }
        if (!raw.eclipseMaxMigrated) {
          base.shaderPreset = 'eclipse';
          if (isMaxDesktop) {
            base.shaderQuality = 'ultra';
            base.volumetricClouds = true;
            base.bumpEnabled = true;
          }
          try {
            localStorage.setItem(GFX_PREFS_KEY, JSON.stringify(Object.assign({}, raw, {
              shaderPreset: base.shaderPreset,
              shaderQuality: base.shaderQuality,
              volumetricClouds: base.volumetricClouds,
              bumpEnabled: base.bumpEnabled,
              eclipseV2Migrated: 1,
              eclipseMaxMigrated: 1
            })));
          } catch (_) {}
        }
        if (typeof raw.bumpEnabled === 'boolean') base.bumpEnabled = raw.bumpEnabled;
        if (typeof raw.volumetricClouds === 'boolean') base.volumetricClouds = raw.volumetricClouds;
      }
    } catch (_) {}
    return base;
  }

  function saveGfxPrefs(patch) {
    try {
      const prev = JSON.parse(localStorage.getItem(GFX_PREFS_KEY) || '{}') || {};
      const next = Object.assign({}, prev, patch || {});
      if (next.shaderQuality !== undefined) next.shaderQuality = normalizeQuality(next.shaderQuality, 'high');
      localStorage.setItem(GFX_PREFS_KEY, JSON.stringify(next));
      return next;
    } catch (_) {
      return patch || {};
    }
  }

  function initSafeCrashGuard(canvasEl, onFallbackLow) {
    try { localStorage.removeItem(LEGACY_CRASH_KEY); } catch (_) {}
    let bootSettled = false;
    const recordCrash = () => {
      try {
        const now = Date.now();
        const cg = JSON.parse(localStorage.getItem(CRASH_GUARD_KEY) || '{"t":[]}');
        const list = Array.isArray(cg.t) ? cg.t.filter(ts => (now - ts) < 60000) : [];
        list.push(now);
        localStorage.setItem(CRASH_GUARD_KEY, JSON.stringify({ t: list }));
        if (list.length >= 2 && typeof onFallbackLow === 'function') onFallbackLow();
      } catch (_) {}
    };
    try {
      const cg = JSON.parse(localStorage.getItem(CRASH_GUARD_KEY) || '{"t":[]}');
      const now = Date.now();
      const recent = Array.isArray(cg.t) ? cg.t.filter(ts => (now - ts) < 60000) : [];
      if (recent.length >= 3 && typeof onFallbackLow === 'function') {
        setTimeout(() => { try { onFallbackLow(); } catch (_) {} }, 500);
      }
    } catch (_) {}
    if (canvasEl && canvasEl.addEventListener) {
      canvasEl.addEventListener('webglcontextlost', () => recordCrash(), false);
    }
    const onBootErr = () => { if (!bootSettled) recordCrash(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', onBootErr);
      setTimeout(() => {
        bootSettled = true;
        window.removeEventListener('error', onBootErr);
        try { localStorage.removeItem(CRASH_GUARD_KEY); } catch (_) {}
      }, 4000);
    }
  }

  root.NUCRAFT_CONFIG = {
    GFX_PREFS_KEY,
    CRASH_GUARD_KEY,
    GFX_PRESETS,
    detectGpuTier,
    detectHardwareProfile,
    normalizeQuality,
    loadGfxPrefs,
    saveGfxPrefs,
    initSafeCrashGuard
  };
})(typeof window !== 'undefined' ? window : globalThis);
