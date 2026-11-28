(function (root) {
  'use strict';
  const CHUNK_W = 16;
  const MIN_Y = -48;
  const WORLD_H = 256;
  const MAX_Y = MIN_Y + WORLD_H - 1;
  const WATER_LEVEL = 0;

  const GRAVITY = 26.0;
  const JUMP_VEL = 9.0;
  const WALK_SPEED = 4.9;
  const SPRINT_SPEED = 7.4;
  const SNEAK_SPEED = 2.1;

  const BUILD_TAG = 'BUILD v197';
  const PLAYER_RADIUS = 0.30;
  const PLAYER_HEIGHT = 1.72;
  const EYE_HEIGHT = 1.54;
  const ITEM_DESPAWN_SEC = 300;
  const DAY_LENGTH_SEC = 1800;
  const DEFAULT_PORT = 4173;

  const exported = {
    CHUNK_W, MIN_Y, WORLD_H, MAX_Y, WATER_LEVEL,
    GRAVITY, JUMP_VEL, WALK_SPEED, SPRINT_SPEED, SNEAK_SPEED,
    BUILD_TAG, PLAYER_RADIUS, PLAYER_HEIGHT, EYE_HEIGHT,
    ITEM_DESPAWN_SEC, DAY_LENGTH_SEC, DEFAULT_PORT
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  if (root && typeof root === 'object') {
    root.NUCRAFT_SHARED = Object.assign(root.NUCRAFT_SHARED || {}, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
