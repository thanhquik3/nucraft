// NUCRAFT Module: src/world/World.js — Biomes, dimension generators, structures, streaming & interactive blocks

  function setLocalSafe(data, lx, wy, lz, id, overwriteLeaves = false) {
    const ly = wy - MIN_Y;
    if (lx < 0 || lx >= CHUNK_W || lz < 0 || lz >= CHUNK_W || ly <= 0 || ly >= WORLD_H) return;
    const i = (ly << 8) | (lz << 4) | lx, cur = data[i];
    if (cur === B.SUGAR_CANE && id !== B.SUGAR_CANE && BLOCK_DEF[id] && BLOCK_DEF[id].cross) return;
    if (cur === B.AIR || (BLOCK_DEF[cur] && BLOCK_DEF[cur].cross) || (overwriteLeaves && BLOCK_DEF[cur] && BLOCK_DEF[cur].foliage)) data[i] = id;
  }
  function setLocalForce(data, lx, wy, lz, id) {
    const ly = wy - MIN_Y;
    if (lx < 0 || lx >= CHUNK_W || lz < 0 || lz >= CHUNK_W || ly <= 1 || ly >= WORLD_H - 2) return;
    const trueY = wy - (depthOffset || 0);
    if (trueY <= -1001 && trueY >= -1010) return;
    data[(ly << 8) | (lz << 4) | lx] = id;
  }
  function getLocalSafe(data, lx, wy, lz) {
    const ly = wy - MIN_Y;
    if (lx < 0 || lx >= CHUNK_W || lz < 0 || lz >= CHUNK_W || ly < 0 || ly >= WORLD_H) return B.STONE;
    return data[(ly << 8) | (lz << 4) | lx];
  }

  // Seed-deterministic, non-repeating procedural underground structures (Mineshafts, Dungeons, Crystal Geodes, Ancient Ruins, Fossils, Miner Camps)
  function generateUndergroundStructures(data, cx, cz, wx0, wz0, dOff, maxCeilingWy, lyStart = 0, lyEnd = WORLD_H - 1) {
    const midTrueY = (MIN_Y + ((lyStart + lyEnd) >> 1)) - dOff;
    const stratum = Math.floor(Math.max(0, -midTrueY) / 40);
    // Avoid spawning right on top of world spawn (0,0) at surface stratum
    if (stratum === 0 && Math.abs(cx) <= 1 && Math.abs(cz) <= 1) return;

    // 1) Region-hashed primary underground structure (one candidate per 3x3 chunk region per stratum)
    const rx = Math.floor(cx / 3), rz = Math.floor(cz / 3);
    const regHash = hash3i(rx, stratum * 13 + 7, rz, seedMix.s1 + 101);
    const pickCx = rx * 3 + Math.floor(hash3i(rx, stratum, rz, seedMix.s1 + 211) * 3);
    const pickCz = rz * 3 + Math.floor(hash3i(rx, stratum, rz, seedMix.s1 + 307) * 3);

    if (cx === pickCx && cz === pickCz && regHash > 0.28) {
      const sRoll = hash3i(cx, stratum * 19 + 3, cz, seedMix.s1 + 409);
      const minYAllowed = Math.max(MIN_Y + 6, MIN_Y + lyStart);
      const maxYAllowed = Math.min(maxCeilingWy - 9, MIN_Y + lyEnd - 6, dOff > 0 ? MAX_Y - 12 : -14);
      if (maxYAllowed > minYAllowed + 4) {
        const baseY = minYAllowed + Math.floor(hash3i(cx, stratum, cz, seedMix.s1 + 521) * (maxYAllowed - minYAllowed));

        if (sRoll < 0.22) {
          // STRUCTURE A: Underground Dungeon / Treasure Vault (Phòng Kho Báu Ngầm)
          const x0 = 3, x1 = 12, z0 = 3, z1 = 12, hRoom = 5;
          for (let dy = 0; dy <= hRoom; dy++) {
            for (let lz = z0; lz <= z1; lz++) {
              for (let lx = x0; lx <= x1; lx++) {
                const isEdge = (lx === x0 || lx === x1 || lz === z0 || lz === z1);
                const isCorner = ((lx === x0 || lx === x1) && (lz === z0 || lz === z1));
                if (dy === 0) {
                  setLocalForce(data, lx, baseY, lz, hash2i(wx0 + lx, wz0 + lz, seedMix.s1 + 613) > 0.35 ? B.STONE_BRICK : B.MOSS_BLOCK);
                } else if (dy === hRoom) {
                  setLocalForce(data, lx, baseY + dy, lz, isEdge ? B.DEEPSLATE : B.STONE_BRICK);
                } else if (isEdge) {
                  // Open archways on two sides
                  const isDoor = (dy <= 3 && ((lx === 7 || lx === 8) && (lz === z0 || lz === z1)));
                  if (isDoor) setLocalForce(data, lx, baseY + dy, lz, B.AIR);
                  else setLocalForce(data, lx, baseY + dy, lz, isCorner ? B.DEEPSLATE : (hash3i(wx0 + lx, baseY + dy, wz0 + lz, seedMix.s1 + 619) > 0.78 ? B.MOSS_BLOCK : B.STONE_BRICK));
                } else {
                  setLocalForce(data, lx, baseY + dy, lz, B.AIR);
                }
              }
            }
          }
          // Vault treasures & lanterns
          setLocalForce(data, 7, baseY + 1, 7, dOff >= 120 ? B.GOLD_CHEST : B.IRON_CHEST);
          setLocalForce(data, 8, baseY + 1, 7, B.CHEST);
          setLocalForce(data, 5, baseY + 1, 5, B.DEEPSLATE_WALL); setLocalForce(data, 5, baseY + 2, 5, B.LANTERN);
          setLocalForce(data, 10, baseY + 1, 10, B.DEEPSLATE_WALL); setLocalForce(data, 10, baseY + 2, 10, B.LANTERN);
          setLocalForce(data, 7, baseY + hRoom - 1, 7, B.LANTERN);
        } else if (sRoll < 0.34) {
          // STRUCTURE B: Giant Crystal / Amethyst Geode (Hốc Pha Lê Hiếm)
          const cxL = 8, czL = 8, cyL = baseY + 4;
          const rad = 4.2 + hash3i(cx, stratum, cz, seedMix.s1 + 701) * 1.1;
          for (let dy = -6; dy <= 6; dy++) {
            for (let dz = -6; dz <= 6; dz++) {
              for (let dx = -6; dx <= 6; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy * 1.15 + dz * dz);
                if (dist > rad + 1.1) continue;
                const lx = cxL + dx, lz = czL + dz, wy = cyL + dy;
                if (dist > rad - 0.1) setLocalForce(data, lx, wy, lz, B.BASALT);
                else if (dist > rad - 1.15) setLocalForce(data, lx, wy, lz, hash3i(wx0 + lx, wy, wz0 + lz, seedMix.s1 + 709) > 0.35 ? B.MARBLE_BRICK : B.PRISMARINE);
                else if (dist > rad - 2.05) {
                  const gh = hash3i(wx0 + lx, wy, wz0 + lz, seedMix.s1 + 719);
                  setLocalForce(data, lx, wy, lz, gh > 0.88 ? B.DIAMOND_ORE : (gh > 0.82 ? B.REDSTONE_ORE : (gh > 0.76 ? B.GLOW_CRYSTAL : B.PRISMARINE)));
                } else {
                  setLocalForce(data, lx, wy, lz, B.AIR);
                }
              }
            }
          }
          // Glowing crystal spire in center + small crack opening
          setLocalForce(data, cxL, cyL - 2, czL, B.GLOW_CRYSTAL);
          setLocalForce(data, cxL, cyL - 1, czL, B.GLOW_CRYSTAL);
          for (let dx = 1; dx <= 6; dx++) { setLocalForce(data, cxL + dx, cyL - 1, czL, B.AIR); setLocalForce(data, cxL + dx, cyL, czL, B.AIR); }
        } else if (sRoll < 0.60) {
          // STRUCTURE C: Ancient Underground Ruin / Shrine (Di Tích Cổ Đại Ngầm)
          const x0 = 2, x1 = 13, z0 = 2, z1 = 13, hH = 6;
          for (let dy = 0; dy <= hH; dy++) {
            for (let lz = z0; lz <= z1; lz++) {
              for (let lx = x0; lx <= x1; lx++) {
                const border = (lx === x0 || lx === x1 || lz === z0 || lz === z1);
                if (dy === 0) {
                  setLocalForce(data, lx, baseY, lz, ((lx + lz) & 1) ? B.DEEPSLATE : B.STONE_BRICK);
                } else if (dy === hH) {
                  if (hash2i(wx0 + lx, wz0 + lz, seedMix.s1 + 809) > 0.25) setLocalForce(data, lx, baseY + dy, lz, B.DEEPSLATE);
                } else if (border) {
                  const keepWall = ((lx - x0) % 3 === 0 || (lz - z0) % 3 === 0) && hash3i(wx0 + lx, baseY + dy, wz0 + lz, seedMix.s1 + 811) > 0.22;
                  setLocalForce(data, lx, baseY + dy, lz, keepWall ? B.STONE_BRICK : B.AIR);
                } else {
                  setLocalForce(data, lx, baseY + dy, lz, B.AIR);
                }
              }
            }
          }
          // Central altar with Enchanting Table, Bookshelves, Obsidian & Rare Chest
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setLocalForce(data, 7 + dx, baseY + 1, 7 + dz, B.OBSIDIAN);
          setLocalForce(data, 7, baseY + 2, 7, B.ENCHANT_TABLE);
          setLocalForce(data, 5, baseY + 1, 7, B.BOOKSHELF); setLocalForce(data, 5, baseY + 2, 7, B.BOOKSHELF);
          setLocalForce(data, 9, baseY + 1, 7, B.BOOKSHELF); setLocalForce(data, 9, baseY + 2, 7, B.BOOKSHELF);
          setLocalForce(data, 7, baseY + 1, 4, dOff >= 160 ? B.DIAMOND_CHEST : B.GOLD_CHEST);
          setLocalForce(data, 4, baseY + 1, 4, B.SEA_LANTERN);
          setLocalForce(data, 10, baseY + 1, 10, B.SEA_LANTERN);
        } else if (sRoll < 0.78) {
          // STRUCTURE D: Giant Subterranean Fossil (Hóa Thạch Khổng Lồ)
          for (let dy = 0; dy <= 6; dy++) {
            for (let lz = 3; lz <= 12; lz++) {
              for (let lx = 3; lx <= 12; lx++) {
                if (dy === 0) { if (getLocalSafe(data, lx, baseY, lz) === B.AIR) setLocalForce(data, lx, baseY, lz, B.DEEPSLATE); }
                else setLocalForce(data, lx, baseY + dy, lz, B.AIR);
              }
            }
          }
          // Spine + 4 curved rib arches of Marble/Quartz with embedded Coal & Diamond ore
          for (let lx = 4; lx <= 11; lx++) {
            setLocalForce(data, lx, baseY + 5, 7, B.MARBLE_BRICK);
            setLocalForce(data, lx, baseY + 5, 8, (lx === 6 || lx === 9) ? B.COAL_ORE : B.QUARTZ_ORE);
            if ((lx & 1) === 0) {
              for (let ry = 1; ry <= 4; ry++) {
                setLocalForce(data, lx, baseY + ry, 5, ry === 2 && lx === 8 ? B.DIAMOND_ORE : B.MARBLE_BRICK);
                setLocalForce(data, lx, baseY + ry, 10, ry === 3 && lx === 6 ? B.DIAMOND_ORE : B.MARBLE_BRICK);
              }
              setLocalForce(data, lx, baseY + 5, 6, B.MARBLE_BRICK);
              setLocalForce(data, lx, baseY + 5, 9, B.MARBLE_BRICK);
            }
          }
          setLocalForce(data, 7, baseY + 1, 7, B.GLOW_CRYSTAL);
        } else if (sRoll < 0.88) {
          // STRUCTURE F: Stronghold Underground Library (Thư Viện Ngầm Cổ Đại)
          const x0 = 2, x1 = 13, z0 = 2, z1 = 13, hLib = 6;
          for (let dy = 0; dy <= hLib; dy++) {
            for (let lz = z0; lz <= z1; lz++) {
              for (let lx = x0; lx <= x1; lx++) {
                const isEdge = (lx === x0 || lx === x1 || lz === z0 || lz === z1);
                if (dy === 0) setLocalForce(data, lx, baseY, lz, B.STONE_BRICK);
                else if (dy === hLib) setLocalForce(data, lx, baseY + dy, lz, B.DEEPSLATE);
                else if (isEdge) {
                  const isDoor = (dy <= 3 && (lx === 7 || lx === 8) && (lz === z0 || lz === z1));
                  setLocalForce(data, lx, baseY + dy, lz, isDoor ? B.AIR : B.STONE_BRICK);
                } else setLocalForce(data, lx, baseY + dy, lz, B.AIR);
              }
            }
          }
          for (let dy = 1; dy <= 3; dy++) {
            for (let lz = 4; lz <= 11; lz += 3) {
              setLocalForce(data, 4, baseY + dy, lz, B.BOOKSHELF);
              setLocalForce(data, 11, baseY + dy, lz, B.BOOKSHELF);
            }
          }
          setLocalForce(data, 7, baseY + 1, 7, B.GOLD_CHEST);
          setLocalForce(data, 7, baseY + hLib - 1, 7, B.LANTERN);
          setLocalForce(data, 4, baseY + 4, 4, B.TORCH_BLOCK);
          setLocalForce(data, 11, baseY + 4, 11, B.TORCH_BLOCK);
        } else if (sRoll < 0.94) {
          // STRUCTURE G: Subterranean Ruined Nether Portal (Cổng Địa Ngục Đổ Nát Ngầm)
          for (let dy = 0; dy <= 6; dy++) for (let lz = 4; lz <= 11; lz++) for (let lx = 4; lx <= 11; lx++) {
            if (dy === 0) setLocalForce(data, lx, baseY, lz, ((lx + lz) & 1) ? B.NETHERRACK : B.NETHERRACK);
            else setLocalForce(data, lx, baseY + dy, lz, B.AIR);
          }
          for (let py = 1; py <= 5; py++) {
            setLocalForce(data, 6, baseY + py, 7, B.OBSIDIAN);
            setLocalForce(data, 9, baseY + py, 7, B.OBSIDIAN);
          }
          setLocalForce(data, 7, baseY + 1, 7, B.OBSIDIAN); setLocalForce(data, 8, baseY + 1, 7, B.OBSIDIAN);
          setLocalForce(data, 7, baseY + 5, 7, B.OBSIDIAN);
          setLocalForce(data, 5, baseY + 1, 8, B.IRON_CHEST);
          setLocalForce(data, 10, baseY + 1, 8, B.LANTERN);
        } else {
          // STRUCTURE E: Subterranean Miner Camp & Forge (Trại Thợ Mỏ & Lò Rèn Ngầm)
          for (let dy = 0; dy <= 4; dy++) {
            for (let lz = 4; lz <= 11; lz++) {
              for (let lx = 4; lx <= 11; lx++) {
                if (dy === 0) setLocalForce(data, lx, baseY, lz, B.PLANKS);
                else setLocalForce(data, lx, baseY + dy, lz, B.AIR);
              }
            }
          }
          // Support pillars + wool tent canopy + forge stations + chest
          for (const [px, pz] of [[4, 4], [11, 4], [4, 11], [11, 11]]) {
            for (let dy = 1; dy <= 3; dy++) setLocalForce(data, px, baseY + dy, pz, B.OAK_FENCE);
          }
          for (let lx = 4; lx <= 7; lx++) for (let lz = 4; lz <= 7; lz++) setLocalForce(data, lx, baseY + 3, lz, B.WHITE_WOOL);
          setLocalForce(data, 5, baseY + 1, 5, B.CHEST);
          setLocalForce(data, 9, baseY + 1, 5, B.BLAST_FURNACE);
          setLocalForce(data, 10, baseY + 1, 5, B.FURNACE);
          setLocalForce(data, 10, baseY + 1, 6, B.CRAFT_TABLE);
          setLocalForce(data, 10, baseY + 1, 8, B.ANVIL);
          setLocalForce(data, 7, baseY + 1, 8, B.CAMPFIRE);
          setLocalForce(data, 8, baseY + 1, 10, B.LANTERN);
        }
      }
    }

    // 2) Non-repeating, seed-randomized Abandoned Mineshaft networks (scattered per 4x4 region with varied Y levels & directions)
    const mRx = Math.floor(cx / 4), mRz = Math.floor(cz / 4);
    const mHash = hash3i(mRx, stratum * 29 + 5, mRz, seedMix.s1 + 911);
    if (mHash > 0.62) {
      const mYMin = Math.max(MIN_Y + 6, MIN_Y + lyStart);
      const mYMax = Math.min(maxCeilingWy - 5, MIN_Y + lyEnd - 4);
      const mYBase = mYMin + Math.floor(hash3i(mRx, stratum, mRz, seedMix.s1 + 919) * Math.max(1, mYMax - mYMin));
      if (mYMax > mYMin && mYBase + 4 <= MIN_Y + lyEnd) {
        const mainRow = mRz * 4 + Math.floor(hash3i(mRx, stratum, mRz, seedMix.s1 + 929) * 4);
        const mainCol = mRx * 4 + Math.floor(hash3i(mRx, stratum, mRz, seedMix.s1 + 937) * 4);
        const runX = (cz === mainRow);
        const runZ = (cx === mainCol);
        if (runX || runZ) {
          const carveShaft = (lx, wzLocal, isCross) => {
            for (let dy = 0; dy <= 3; dy++) {
              const wy = mYBase + dy;
              const cur = getLocalSafe(data, lx, wy, wzLocal);
              if (dy === 0) {
                if (cur === B.AIR || cur === B.WATER || cur === B.LAVA) setLocalForce(data, lx, wy, wzLocal, B.PLANKS);
              } else {
                setLocalForce(data, lx, wy, wzLocal, B.AIR);
              }
            }
            if (isCross) setLocalSafe(data, lx, mYBase + 1, wzLocal, B.RAIL, false);
          };
          if (runX) {
            for (let lx = 0; lx < 16; lx++) {
              for (let lz = 6; lz <= 8; lz++) carveShaft(lx, lz, lz === 7);
              if ((lx & 3) === 0) {
                setLocalSafe(data, lx, mYBase + 1, 6, B.OAK_FENCE, true); setLocalSafe(data, lx, mYBase + 2, 6, B.OAK_FENCE, true);
                setLocalSafe(data, lx, mYBase + 1, 8, B.OAK_FENCE, true); setLocalSafe(data, lx, mYBase + 2, 8, B.OAK_FENCE, true);
                setLocalSafe(data, lx, mYBase + 3, 6, B.PLANKS, true); setLocalSafe(data, lx, mYBase + 3, 7, B.PLANKS, true); setLocalSafe(data, lx, mYBase + 3, 8, B.PLANKS, true);
              } else if ((lx & 7) === 2) {
                const wallN = IS_OPAQUE[getLocalSafe(data, lx, mYBase + 2, 5)] === 1;
                const wallS = IS_OPAQUE[getLocalSafe(data, lx, mYBase + 2, 9)] === 1;
                if (wallN) setLocalSafe(data, lx, mYBase + 2, 6, B.TORCH_BLOCK, true);
                else if (wallS) setLocalSafe(data, lx, mYBase + 2, 8, B.TORCH_BLOCK, true);
                else setLocalSafe(data, lx, mYBase + 1, 6, B.TORCH_BLOCK, true);
              } else if (hash3i(wx0 + lx, mYBase - dOff, wz0 + 6, seedMix.s1 + 947) > 0.85) {
                setLocalSafe(data, lx, mYBase + 3, 6, B.COBWEB, false);
              }
            }
          }
          if (runZ) {
            for (let lz = 0; lz < 16; lz++) {
              for (let lx = 6; lx <= 8; lx++) carveShaft(lx, lz, lx === 7);
              if ((lz & 3) === 0) {
                setLocalSafe(data, 6, mYBase + 1, lz, B.OAK_FENCE, true); setLocalSafe(data, 6, mYBase + 2, lz, B.OAK_FENCE, true);
                setLocalSafe(data, 8, mYBase + 1, lz, B.OAK_FENCE, true); setLocalSafe(data, 8, mYBase + 2, lz, B.OAK_FENCE, true);
                setLocalSafe(data, 6, mYBase + 3, lz, B.PLANKS, true); setLocalSafe(data, 7, mYBase + 3, lz, B.PLANKS, true); setLocalSafe(data, 8, mYBase + 3, lz, B.PLANKS, true);
              } else if ((lz & 7) === 2) {
                const wallW = IS_OPAQUE[getLocalSafe(data, 5, mYBase + 2, lz)] === 1;
                const wallE = IS_OPAQUE[getLocalSafe(data, 9, mYBase + 2, lz)] === 1;
                if (wallW) setLocalSafe(data, 6, mYBase + 2, lz, B.TORCH_BLOCK, true);
                else if (wallE) setLocalSafe(data, 8, mYBase + 2, lz, B.TORCH_BLOCK, true);
                else setLocalSafe(data, 6, mYBase + 1, lz, B.TORCH_BLOCK, true);
              } else if (hash3i(wx0 + 8, mYBase - dOff, wz0 + lz, seedMix.s1 + 953) > 0.85) {
                setLocalSafe(data, 8, mYBase + 3, lz, B.COBWEB, false);
              }
            }
          }
          if (runX && runZ) {
            setLocalForce(data, 6, mYBase + 1, 6, dOff >= 80 ? B.IRON_CHEST : B.CHEST);
            setLocalForce(data, 8, mYBase + 1, 8, B.LANTERN);
          }
        }
      }
    }
  }

  function placeLeafBushCluster(data, bx, baseWy, bz, wx, wz, leafId = B.OAK_LEAVES) {
    if (bx < 1 || bx > CHUNK_W - 2 || bz < 1 || bz > CHUNK_W - 2 || baseWy <= MIN_Y + 1 || baseWy >= MAX_Y - 3) return;
    // Settle onto solid ground near baseWy so ground bushes hug hills cleanly
    let gy = baseWy;
    for (let probe = 2; probe >= -2; probe--) {
      const py = baseWy + probe;
      if (py <= MIN_Y || py >= MAX_Y) continue;
      const below = data[((py - 1 - MIN_Y) << 8) | (bz << 4) | bx];
      const here = data[((py - MIN_Y) << 8) | (bz << 4) | bx];
      if (IS_OPAQUE[below] === 1 && !IS_OPAQUE[here]) { gy = py; break; }
    }
    const r = hash2i(wx, wz, worldSeed + 751);
    const rad = r > 0.45 ? 1 : 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && hash2i(wx + dx, wz + dz, worldSeed + 761) < 0.42) continue;
      setLocalSafe(data, bx + dx, gy, bz + dz, leafId, false);
    }
    if (rad > 0) {
      setLocalSafe(data, bx, gy + 1, bz, leafId, false);
      if (r > 0.68) setLocalSafe(data, bx + 1, gy + 1, bz, leafId, false);
      if (r > 0.78) setLocalSafe(data, bx, gy + 1, bz + 1, leafId, false);
    }
  }

  function placeLuantiTree(data, lx, baseWy, lz, wx, wz, style) {
    const r0 = hash2i(wx, wz, worldSeed + 515), r1 = hash2i(wx + 19, wz - 13, worldSeed + 619);
    if (style === 'apple') {
      const trunkH = 5 + (r0 > 0.45 ? 1 : 0);
      for (let i = 0; i < trunkH; i++) setLocalSafe(data, lx, baseWy + i, lz, B.OAK_LOG, true);
      if (r1 > 0.4) setLocalSafe(data, lx + 1, baseWy + trunkH - 1, lz, B.OAK_LOG, true);
      if (r0 > 0.5) setLocalSafe(data, lx, baseWy + trunkH - 1, lz - 1, B.OAK_LOG, true);
      const cy = baseWy + trunkH - 2;
      for (let dy = 0; dy <= 4; dy++) {
        const rad = (dy === 1 || dy === 2) ? 3 : (dy === 0 || dy === 3 ? 2 : 1);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz), n = hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 41);
          if ((rad === 3 && (dist > 4 || (dist === 4 && n < 0.55))) || (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && (dy === 3 || n < 0.45)) || (dy === 4 && dist > 1)) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.OAK_LEAVES, false);
        }
      }
      // Hang small 3D Red Apples cleanly UNDER outer oak leaves (never a solid green cube!)
      for (const [hx, hz] of [[2,0],[-2,0],[0,2],[0,-2],[2,1],[-2,-1],[1,-2],[-1,2]]) {
        const ha = hash2i(wx + hx, wz + hz, worldSeed + 83);
        if (ha > 0.62) setLocalSafe(data, lx + hx, cy - 1, lz + hz, B.APPLE, false);
        else if (ha > 0.36) setLocalSafe(data, lx + hx, cy - 1, lz + hz, B.OAK_LEAVES, false);
      }
    } else if (style === 'pine') {
      const totalH = 9 + Math.floor(r0 * 3);
      for (let i = 0; i < totalH - 1; i++) setLocalSafe(data, lx, baseWy + i, lz, B.SPRUCE_LOG, true);
      const startY = baseWy + 2, canopyH = totalH - 2;
      for (let step = 0; step <= canopyH; step++) {
        const wy = startY + step, fromTop = canopyH - step;
        let rad = fromTop === 0 ? 0 : (fromTop <= 2 ? 1 : (fromTop % 2 === 1 ? (fromTop >= 5 ? 3 : 2) : (fromTop >= 6 ? 2 : 1)));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if ((rad === 3 && dist > 3) || (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) || (rad === 1 && fromTop === 1 && dist > 1)) continue;
          setLocalSafe(data, lx + dx, wy, lz + dz, B.SPRUCE_LEAVES, false);
        }
      }
      setLocalSafe(data, lx, baseWy + totalH + 1, lz, B.SPRUCE_LEAVES, false);
    } else if (style === 'aspen') {
      const trunkH = 7 + Math.floor(r0 * 3);
      for (let i = 0; i < trunkH; i++) setLocalSafe(data, lx, baseWy + i, lz, B.BIRCH_LOG, true);
      const startY = baseWy + trunkH - 4;
      for (let dy = 0; dy <= 5; dy++) {
        const rad = (dy === 0 || dy >= 4) ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if ((rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) || (dy === 5 && Math.abs(dx) + Math.abs(dz) > 1)) continue;
          setLocalSafe(data, lx + dx, startY + dy, lz + dz, B.BIRCH_LEAVES, false);
        }
      }
      setLocalSafe(data, lx, startY + 6, lz, B.BIRCH_LEAVES, false);
    } else if (style === 'acacia') {
      // Majestic Sculpted Autumn Maple Tree (flared roots, tall dark trunk, spreading boughs, lush layered orange-gold dome + drooping drapes!)
      const trunkH = 6 + (r0 > 0.45 ? 2 : 0);
      for (let i = 0; i < trunkH; i++) setLocalSafe(data, lx, baseWy + i, lz, B.OAK_LOG, true);
      for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (hash2i(wx + rx, wz + rz, worldSeed + 123) > 0.45) setLocalSafe(data, lx + rx, baseWy, lz + rz, B.OAK_LOG, true);
        setLocalSafe(data, lx + rx, baseWy + trunkH - 2, lz + rz, B.OAK_LOG, true);
        setLocalSafe(data, lx + rx * 2, baseWy + trunkH - 1, lz + rz * 2, B.OAK_LOG, true);
      }
      const cy = baseWy + trunkH - 2;
      for (let dy = 0; dy <= 4; dy++) {
        const rad = (dy === 1 || dy === 2) ? 4 : (dy === 0 || dy === 3 ? 3 : 2);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.hypot(dx, dz);
          const n = hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 412);
          if (dist > rad + 0.15 || (dist > rad - 0.5 && n < 0.32)) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.ACACIA_LEAVES, false);
        }
      }
      for (const [hx, hz] of [[3,0],[-3,0],[0,3],[0,-3],[2,2],[-2,2],[2,-2],[-2,-2]]) {
        if (hash2i(wx + hx, wz + hz, worldSeed + 419) > 0.35) setLocalSafe(data, lx + hx, cy - 1, lz + hz, B.ACACIA_LEAVES, false);
      }
    } else if (style === 'sakura') {
      // Authentic Minecraft Cherry Blossom Tree: curved diagonal trunk + dual wide flat pink layered canopies!
      const dirX = r0 > 0.5 ? 1 : -1, dirZ = r1 > 0.5 ? 1 : -1;
      const trunkH = 5 + (r0 > 0.45 ? 1 : 0);
      for (let i = 0; i < 3; i++) setLocalSafe(data, lx, baseWy + i, lz, B.SAKURA_LOG, true);
      // Curved diagonal main branch + counter-branch (iconic Minecraft Cherry silhouette!)
      setLocalSafe(data, lx + dirX, baseWy + 3, lz, B.SAKURA_LOG, true);
      setLocalSafe(data, lx + dirX * 2, baseWy + 4, lz, B.SAKURA_LOG, true);
      setLocalSafe(data, lx + dirX * 2, baseWy + 5, lz, B.SAKURA_LOG, true);
      setLocalSafe(data, lx - dirX, baseWy + 3, lz + dirZ, B.SAKURA_LOG, true);
      setLocalSafe(data, lx - dirX, baseWy + 4, lz + dirZ, B.SAKURA_LOG, true);
      const drawCherryCrown = (cx0, cy0, cz0, rMax) => {
        for (let dy = 0; dy <= 3; dy++) {
          const rad = (dy === 0 || dy === 1) ? rMax : (dy === 2 ? Math.max(1, rMax - 1) : 1);
          for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
            const dist = Math.abs(dx) + Math.abs(dz);
            if ((rad >= 3 && dist > rad + 1) || (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy >= 2) || (dy === 3 && dist > 1)) continue;
            setLocalSafe(data, cx0 + dx, cy0 + dy, cz0 + dz, B.SAKURA_LEAVES, false);
          }
        }
        // Drooping pink cherry curtains along canopy rim
        for (const [hx, hz] of [[rMax,0],[-rMax,0],[0,rMax],[0,-rMax],[rMax-1,1],[-(rMax-1),-1],[1,rMax-1],[-1,-(rMax-1)]]) {
          if (hash2i(wx + cx0 + hx, wz + cz0 + hz, worldSeed + 91) > 0.34) {
            setLocalSafe(data, cx0 + hx, cy0 - 1, cz0 + hz, B.SAKURA_LEAVES, false);
            if (hash2i(wx + cx0 + hx, wz + cz0 + hz, worldSeed + 93) > 0.68) setLocalSafe(data, cx0 + hx, cy0 - 2, cz0 + hz, B.SAKURA_LEAVES, false);
          }
        }
      };
      drawCherryCrown(lx + dirX * 2, baseWy + trunkH, lz, 3);
      drawCherryCrown(lx - dirX, baseWy + trunkH - 1, lz + dirZ, 2);
      // Hang sweet Peaches gently under Cherry blossoms!
      for (const [px2, pz2] of [[dirX * 2 + 1, 1], [dirX * 2 - 1, -1]]) {
        if (hash2i(wx + px2, wz + pz2, worldSeed + 195) > 0.58) setLocalSafe(data, lx + px2, baseWy + trunkH - 1, lz + pz2, B.PEACH, false);
      }
    } else if (style === 'palm') {
      // Tropical Beach Coconut Palm: graceful leaning trunk + arching fronds + hanging 3D coconuts!
      const leanX = r0 > 0.5 ? 1 : -1, leanZ = r1 > 0.65 ? 1 : (r1 < 0.35 ? -1 : 0);
      const hP = 7 + Math.floor(r0 * 3);
      let cxp = lx, czp = lz;
      for (let i = 0; i < hP; i++) {
        if (i === 3) cxp += leanX;
        if (i === 5) { cxp += leanX; czp += leanZ; }
        setLocalSafe(data, cxp, baseWy + i, czp, B.PALM_LOG, true);
      }
      const topY = baseWy + hP;
      setLocalSafe(data, cxp, topY, czp, B.PALM_LEAVES, false);
      for (const [fx, fz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
        const isDiag = (fx !== 0 && fz !== 0);
        const len = isDiag ? 2 : 3;
        for (let s = 1; s <= len; s++) {
          const drop = s === len ? -1 : 0;
          setLocalSafe(data, cxp + fx * s, topY + drop, czp + fz * s, B.PALM_LEAVES, false);
        }
      }
      // Hang 3D Coconuts cleanly underneath the palm crown!
      for (const [cxo, czo] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (hash2i(wx + cxo, wz + czo, worldSeed + 317) > 0.38) setLocalSafe(data, cxp + cxo, topY - 1, czp + czo, B.COCONUT, false);
      }
    } else if (style === 'mangrove') {
      // Swamp Mangrove Tree: arched 3D prop roots anchored into mud/water + wide flat canopy + VINE & propagules!
      const rootH = 3;
      const rootCols = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2],[1,1],[-1,-1],[1,-1],[-1,1]];
      for (const [rx, rz] of rootCols) {
        const d = Math.abs(rx) + Math.abs(rz);
        const topR = d === 0 ? rootH - 1 : (d === 1 ? rootH : 1);
        const botR = (d === 2 && hash2i(wx + rx, wz + rz, worldSeed + 412) < 0.35) ? -1 : -3;
        for (let ry = botR; ry <= topR; ry++) {
          const idRoot = (d === 0 && ry >= rootH - 2) ? B.MANGROVE_LOG : B.MANGROVE_ROOTS;
          setLocalSafe(data, lx + rx, baseWy + ry, lz + rz, idRoot, true);
        }
      }
      const trunkH = 4 + Math.floor(r0 * 2);
      for (let i = rootH; i < rootH + trunkH; i++) setLocalSafe(data, lx, baseWy + i, lz, B.MANGROVE_LOG, true);
      setLocalSafe(data, lx + 1, baseWy + rootH + trunkH - 1, lz, B.MANGROVE_LOG, true);
      setLocalSafe(data, lx - 1, baseWy + rootH + trunkH - 1, lz + 1, B.MANGROVE_LOG, true);
      const cy = baseWy + rootH + trunkH - 1;
      for (let dy = 0; dy <= 3; dy++) {
        const rad = (dy === 0 || dy === 1) ? 4 : (dy === 2 ? 3 : 1);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx, dz) > rad + 0.35) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.MANGROVE_LEAVES, false);
        }
      }
      for (const [vx, vz] of [[3,1],[-3,-1],[1,3],[-1,-3],[3,-2],[-3,2],[2,3],[-2,-3]]) {
        const vh = hash2i(wx + vx, wz + vz, worldSeed + 443);
        if (vh > 0.34) {
          setLocalSafe(data, lx + vx, cy - 1, lz + vz, vh > 0.68 ? B.MANGROVE_PROPAGULE : B.VINE, false);
          if (vh > 0.50) setLocalSafe(data, lx + vx, cy - 2, lz + vz, B.VINE, false);
        }
      }
    } else if (style === 'jungle' || style === 'canopy_jungle') {
      const isTower = (style === 'canopy_jungle');
      const trunkH = isTower ? (12 + Math.floor(r0 * 6)) : (7 + Math.floor(r0 * 3));
      for (let i = 0; i < trunkH; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.JUNGLE_LOG, true);
        if (isTower && i < trunkH - 1) setLocalSafe(data, lx + 1, baseWy + i, lz, B.JUNGLE_LOG, true);
      }
      setLocalSafe(data, lx + 1, baseWy, lz, B.JUNGLE_LOG, true); setLocalSafe(data, lx - 1, baseWy, lz, B.JUNGLE_LOG, true);
      setLocalSafe(data, lx, baseWy, lz + 1, B.JUNGLE_LOG, true); setLocalSafe(data, lx, baseWy, lz - 1, B.JUNGLE_LOG, true);
      if (isTower) {
        // Mid-trunk side leaf shelf matching tall jungle canopy trees in Images 2 & 3
        const midY = baseWy + Math.floor(trunkH * 0.56);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if (Math.hypot(dx, dz) <= 2.2) setLocalSafe(data, lx + dx, midY, lz + dz, B.JUNGLE_LEAVES, false);
        }
      }
      const cy = baseWy + trunkH - 2;
      const rCrown = isTower ? 4 : 3;
      for (let dy = 0; dy <= 4; dy++) {
        const rad = (dy === 1 || dy === 2) ? rCrown : (dy === 4 ? 1 : Math.max(2, rCrown - 1));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if ((rad >= rCrown && dist > rCrown + 1) || (dy === 4 && dist > 1)) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.JUNGLE_LEAVES, false);
        }
      }
      // Long draping lush B.VINE curtains hanging under canopy rims (4..9 blocks) + trunk vines!
      for (const [vx, vz] of [[rCrown,0],[-rCrown,0],[0,rCrown],[0,-rCrown],[rCrown-1,rCrown-1],[-(rCrown-1),-(rCrown-1)],[rCrown-1,-(rCrown-1)],[-(rCrown-1),rCrown-1]]) {
        if (hash2i(wx + vx, wz + vz, worldSeed + 99) > 0.30) {
          setLocalSafe(data, lx + vx, cy, lz + vz, B.JUNGLE_LEAVES, false);
          if (!isTower && hash2i(wx + vx, wz + vz, worldSeed + 109) > 0.68) setLocalSafe(data, lx + vx, cy - 1, lz + vz, B.MANGO, false);
          const vLen = (isTower ? 5 : 3) + Math.floor(hash2i(wx + vx, wz + vz, worldSeed + 107) * (isTower ? 5 : 4));
          for (let vd = 1; vd <= vLen; vd++) setLocalSafe(data, lx + vx, cy - vd, lz + vz, B.VINE, false);
        }
      }
      // Ground leaf-block bushes clustered naturally around the tree trunk (Images 2 & 3!)
      for (const [bxOff, bzOff] of [[2,2],[-2,-2],[2,-2]]) {
        if (hash2i(wx + bxOff, wz + bzOff, worldSeed + 149) > 0.38) placeLeafBushCluster(data, lx + bxOff, baseWy, lz + bzOff, wx + bxOff, wz + bzOff, B.JUNGLE_LEAVES);
      }
    } else if (style === 'autumn_maple') {
      // Vivid Crimson, Orange & Golden Ancient Maple Trees
      const trunkH = 6 + Math.floor(r0 * 4);
      for (let i = 0; i < trunkH; i++) setLocalSafe(data, lx, baseWy + i, lz, B.OAK_LOG, true);
      for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (hash2i(wx + rx, wz + rz, worldSeed + 211) > 0.45) setLocalSafe(data, lx + rx, baseWy, lz + rz, B.OAK_LOG, true);
        setLocalSafe(data, lx + rx, baseWy + trunkH - 2, lz + rz, B.OAK_LOG, true);
      }
      const treePal = hash2i(wx, wz, worldSeed + 217);
      const primLeaf = treePal > 0.62 ? B.CRIMSON_MAPLE_LEAVES : (treePal > 0.30 ? B.ORANGE_MAPLE_LEAVES : B.GOLDEN_MAPLE_LEAVES);
      const altLeaf = treePal > 0.62 ? B.ORANGE_MAPLE_LEAVES : (treePal > 0.30 ? B.GOLDEN_MAPLE_LEAVES : B.ACACIA_LEAVES);
      const cy = baseWy + trunkH - 2;
      for (let dy = 0; dy <= 5; dy++) {
        const rad = (dy === 1 || dy === 2 || dy === 3) ? 3 : (dy === 5 ? 1 : 2);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if ((rad === 3 && dist > 4) || (dy === 5 && dist > 1) || (dy === 0 && Math.abs(dx) === 2 && Math.abs(dz) === 2)) continue;
          const leafId = hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 219) > 0.26 ? primLeaf : altLeaf;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, leafId, false);
        }
      }
    } else if (style === 'cactus') {
      const ch = 1 + Math.floor(r0 * 4); // Authentic 1-4 block straight cactus column
      for (let i = 0; i < ch; i++) setLocalSafe(data, lx, baseWy + i, lz, B.CACTUS, true);
      if (hash2i(wx + 19, wz - 23, worldSeed + 79) > 0.74) {
        setLocalSafe(data, lx, baseWy + ch, lz, B.CACTUS_FLOWER, false);
      }
    } else if (style === 'crimson_fungus' || style === 'warped_fungus' || style === 'crimson_spire' || style === 'warped_weeping_giant') {
      // Multi-tier sculpted Nether giant fungi (chunky overhanging wart caps, shroomlight clusters, weeping & twisting vines)
      const isWarped = (style === 'warped_fungus' || style === 'warped_weeping_giant');
      const isGiant = (style === 'crimson_spire' || style === 'warped_weeping_giant');
      const stemB = isWarped ? B.WARPED_STEM : B.CRIMSON_STEM;
      const capB  = isWarped ? B.WARPED_WART_BLOCK : B.NETHER_WART_BLOCK;
      const vineB = isWarped ? B.TWISTING_VINES : B.WEEPING_VINES;
      const trunkH = (isGiant ? 9 : 7) + Math.floor(r0 * 5);
      const bendX = r1 > 0.6 ? 1 : (r1 < 0.3 ? -1 : 0);
      for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (hash2i(wx + rx, wz + rz, worldSeed + 73) > 0.32) setLocalSafe(data, lx + rx, baseWy, lz + rz, stemB, true);
      }
      let tx = lx;
      for (let i = 0; i < trunkH; i++) {
        if (i === 4) tx += bendX;
        setLocalSafe(data, tx, baseWy + i, lz, stemB, true);
        if (i < (isGiant ? 4 : 2)) setLocalSafe(data, tx + 1, baseWy + i, lz, stemB, true);
      }
      const cy = baseWy + trunkH - 2;
      const topR = isGiant ? 4 : 3;
      for (let dy = 0; dy <= (isGiant ? 5 : 4); dy++) {
        const rad = (dy <= 2) ? topR : (dy >= (isGiant ? 4 : 4) ? 1 : 2);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if ((rad === 4 && dist > 6) || (rad === 3 && dist > 4) || (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy >= 3) || (dy >= 4 && dist > 1)) continue;
          const isShroom = (dy <= 2 && dist >= 2 && hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 71) > 0.84);
          setLocalSafe(data, tx + dx, cy + dy, lz + dz, isShroom ? B.SHROOMLIGHT : capB, false);
        }
      }
      if (isGiant) {
        // Second lower tier overhang for dramatic multi-canopy silhouette (Images 6 & 7)
        const subY = cy - 3;
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 4 || (dx === 0 && dz === 0)) continue;
          const isShr = (Math.abs(dx) + Math.abs(dz) === 3 && hash3i(wx + dx, subY, wz + dz, worldSeed + 141) > 0.78);
          setLocalSafe(data, tx + dx, subY, lz + dz, isShr ? B.SHROOMLIGHT : capB, false);
        }
      }
      for (const [hx, hz] of [[topR,0],[-topR,0],[0,topR],[0,-topR],[2,2],[-2,-2],[2,-2],[-2,2],[3,1],[-3,-1]]) {
        if (hash2i(wx + hx, wz + hz, worldSeed + 123) > 0.34) {
          setLocalSafe(data, tx + hx, cy - 1, lz + hz, capB, false);
          if (hash2i(wx + hx, wz + hz, worldSeed + 129) > 0.50) setLocalSafe(data, tx + hx, cy - 2, lz + hz, capB, false);
          if (hash2i(wx + hx, wz + hz, worldSeed + 131) > 0.84) setLocalSafe(data, tx + hx, cy - 3, lz + hz, B.SHROOMLIGHT, false);
          if (!isWarped && hash2i(wx + hx, wz + hz, worldSeed + 137) > 0.45) {
            const vLen = 2 + Math.floor(hash2i(wx + hx, wz + hz, worldSeed + 139) * 3);
            for (let v = 1; v <= vLen; v++) setLocalSafe(data, tx + hx, cy - 2 - v, lz + hz, vineB, false);
          }
        }
      }
      if (isWarped) {
        for (const [vx, vz] of [[2,1],[-2,1],[1,-2],[-1,-2]]) {
          if (hash2i(wx + vx, wz + vz, worldSeed + 149) > 0.45) {
            const vLen = 2 + Math.floor(hash2i(wx + vx, wz + vz, worldSeed + 151) * 3);
            for (let v = 0; v < vLen; v++) setLocalSafe(data, lx + vx, baseWy + v, lz + vz, vineB, false);
          }
        }
      }
    } else if (style === 'basalt_ember_tree') {
      // Gnarled Basalt / Soul Ash Nether tree with glowing magma or soul-lantern ember boughs
      const th = 5 + Math.floor(r0 * 4);
      const isSoul = (r1 > 0.52);
      const woodB = isSoul ? B.BLACKSTONE : B.BASALT;
      const emberB = isSoul ? B.SOUL_LANTERN : B.MAGMA_BLOCK;
      for (let i = 0; i < th; i++) setLocalSafe(data, lx, baseWy + i, lz, woodB, true);
      for (const [bx, bz, bh] of [[1, 0, th - 2], [-1, 1, th - 1], [0, -1, th - 2], [-2, -1, th]]) {
        if (hash2i(wx + bx, wz + bz, worldSeed + 163) < 0.35) continue;
        setLocalSafe(data, lx + Math.sign(bx), baseWy + bh, lz + Math.sign(bz), B.BLACKSTONE_BRICKS, true);
        setLocalSafe(data, lx + bx, baseWy + bh + 1, lz + bz, woodB, true);
        if (hash2i(wx + bx * 3, wz + bz * 3, worldSeed + 167) > 0.42) {
          setLocalSafe(data, lx + bx, baseWy + bh + 2, lz + bz, emberB, false);
        }
      }
      setLocalSafe(data, lx, baseWy + th, lz, emberB, false);
    } else if (style === 'chorus') {
      // Detailed Branching Tall End Chorus Tree w/ Multiple Glowing Purpur Flower Crowns!
      const ch = 5 + Math.floor(r0 * 5);
      for (let i = 0; i < ch; i++) setLocalSafe(data, lx, baseWy + i, lz, B.CHORUS_PLANT, true);
      const branches = [[1, 0, ch - 3], [-1, 0, ch - 2], [0, 1, ch - 2], [0, -1, ch - 3]];
      for (let bi = 0; bi < branches.length; bi++) {
        const [bx, bz, by] = branches[bi];
        if (hash2i(wx + bx * 5, wz + bz * 5, worldSeed + 957 + bi) < 0.35) continue;
        setLocalSafe(data, lx + bx, baseWy + by, lz + bz, B.CHORUS_PLANT, true);
        setLocalSafe(data, lx + bx * 2, baseWy + by, lz + bz * 2, B.CHORUS_PLANT, true);
        setLocalSafe(data, lx + bx * 2, baseWy + by + 1, lz + bz * 2, B.CHORUS_PLANT, true);
        setLocalSafe(data, lx + bx * 2, baseWy + by + 2, lz + bz * 2, B.CHORUS_PLANT, true);
        setLocalSafe(data, lx + bx * 2, baseWy + by + 3, lz + bz * 2, B.PURPUR_BLOCK, true);
      }
      setLocalSafe(data, lx, baseWy + ch, lz, B.PURPUR_BLOCK, true);
      setLocalSafe(data, lx, baseWy + ch + 1, lz, B.GLOW_CRYSTAL, true);
    } else if (style === 'bamboo') {
      // Authentic Tall Slender Bamboo Stalks (top blocks render lush leafy crowns automatically!) + nearby Bamboo Shoots!
      const bh = 6 + Math.floor(r0 * 8);
      for (let i = 0; i < bh; i++) setLocalSafe(data, lx, baseWy + i, lz, B.BAMBOO, true);
      if (hash2i(wx + 3, wz - 5, worldSeed + 713) > 0.62) setLocalSafe(data, lx + 1, baseWy, lz, B.BAMBOO_SHOOT, false);
    } else if (style === 'giant_mushroom') {
      const mh = 6 + Math.floor(r0 * 4);
      for (let i = 0; i < mh; i++) setLocalSafe(data, lx, baseWy + i, lz, B.MUSHROOM_STEM, true);
      const cy = baseWy + mh;
      for (let dy = -1; dy <= 2; dy++) {
        const rad = dy === 2 ? 1 : (dy === 1 ? 2 : 3);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const d = Math.hypot(dx, dz);
          if (dy === -1 && (d < 1.9 || d > 3.2)) continue;
          if (dy === 0 && d > 3.3) continue;
          if (dy === 1 && d > 2.3) continue;
          if (dy === 2 && d > 1.2) continue;
          const gill = (dy <= 0 && (Math.abs(dx) === 1 || Math.abs(dz) === 1 || (Math.abs(dx) === 2 && Math.abs(dz) === 2)) && hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 417) > 0.42);
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, gill ? B.SHROOMLIGHT : B.MUSHROOM_RED_CAP, false);
        }
      }
      if (hash2i(wx + 2, wz - 2, worldSeed + 418) > 0.5) setLocalSafe(data, lx, cy - 2, lz, B.SHROOMLIGHT, false);
    } else if (style === 'willow' || style === 'ancient_vine_tree') {
      // Grand Ancient Vine & Weeping Willow Tree matching D:\mine2\image\images (2).jpg & images (7).jpg!
      const isTall = (style === 'ancient_vine_tree');
      const th = isTall ? (11 + Math.floor(r0 * 5)) : (7 + Math.floor(r0 * 3));
      // Flared buttress roots around thick trunk!
      for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        const d = Math.abs(rx) + Math.abs(rz);
        const rh = d === 1 ? 4 : (d === 2 ? 2 : 1);
        for (let ry = 0; ry < rh; ry++) if (d === 1 || hash2i(wx + rx, wz + rz, worldSeed + 311 + ry) > 0.35) setLocalSafe(data, lx + rx, baseWy + ry, lz + rz, B.OAK_LOG, true);
      }
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.OAK_LOG, true);
        if (isTall && i < th - 2) { setLocalSafe(data, lx + 1, baseWy + i, lz, B.OAK_LOG, true); setLocalSafe(data, lx, baseWy + i, lz + 1, B.OAK_LOG, true); }
      }
      // Sculpted tiered canopy domes + long hanging emerald/glow vines!
      const crowns = isTall ? [[0, th, 0, 4], [-3, th - 3, 1, 3], [3, th - 4, -1, 3]] : [[0, th, 0, 4], [2, th - 1, 2, 2]];
      for (let ci = 0; ci < crowns.length; ci++) {
        const [ox, oy, oz, rMax] = crowns[ci];
        for (let dy = 0; dy <= 3; dy++) {
          const rad = dy === 3 ? Math.max(1, rMax - 2) : (dy === 2 ? Math.max(2, rMax - 1) : rMax);
          for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
            if (Math.hypot(dx, dz) > rad + 0.35) continue;
            setLocalSafe(data, lx + ox + dx, baseWy + oy + dy, lz + oz + dz, (isTall ? B.OAK_LEAVES : B.MANGROVE_LEAVES), false);
          }
        }
        // Long draping vines hanging cleanly under the outer canopy rim + leafy ground bushes at base!
        for (const [vx, vz] of [[rMax,0],[-rMax,0],[0,rMax],[0,-rMax],[rMax-1,rMax-1],[-(rMax-1),-(rMax-1)],[rMax-1,-(rMax-1)],[-(rMax-1),rMax-1]]) {
          const vLen = 3 + Math.floor(hash2i(wx + ox + vx, wz + oz + vz, worldSeed + 389) * (isTall ? 6 : 4));
          for (let d = 1; d <= vLen; d++) setLocalSafe(data, lx + ox + vx, baseWy + oy - d, lz + oz + vz, B.VINE, false);
        }
      }
      for (const [bxOff, bzOff] of [[-2, 2], [3, -1]]) {
        if (hash2i(wx + bxOff, wz + bzOff, worldSeed + 397) > 0.42) placeLeafBushCluster(data, lx + bxOff, baseWy, lz + bzOff, wx + bxOff, wz + bzOff, isTall ? B.OAK_LEAVES : B.MANGROVE_LEAVES);
      }
    } else if (style === 'giant_redwood') {
      // Towering Ancient Sequoia / Redwood Huge Trees
      const th = Math.min(MAX_Y - baseWy - 7, 20 + Math.floor(r0 * 7));
      for (const [rx, rz] of [[-1,0],[2,0],[0,-1],[0,2],[1,-1],[1,2],[-1,1],[2,1]]) {
        const rh = 2 + Math.floor(hash2i(wx + rx, wz + rz, worldSeed + 419) * 4);
        for (let ry = 0; ry < rh; ry++) setLocalSafe(data, lx + rx, baseWy + ry, lz + rz, B.SPRUCE_LOG, true);
      }
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.SPRUCE_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.SPRUCE_LOG, true);
        setLocalSafe(data, lx, baseWy + i, lz + 1, B.SPRUCE_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.SPRUCE_LOG, true);
      }
      for (let dy = -9; dy <= 5; dy++) {
        const wy = baseWy + th + dy;
        const rad = dy >= 4 ? 1 : (dy >= 2 ? 2 : (dy >= -5 ? 4 : 3));
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
          const dist = Math.hypot(dx - 0.5, dz - 0.5);
          if (dist > rad + 0.45) continue;
          if (dy < -4 && ((dy & 1) === 0) && dist > 2.6) continue;
          setLocalSafe(data, lx + dx, wy, lz + dz, B.SPRUCE_LEAVES, false);
        }
      }
    } else if (style === 'sculpted_birch') {
      // Tall Sculpted Birch Tree matching D:\mine2\image\images (3).jpg!
      const th = 10 + Math.floor(r0 * 4);
      for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1]]) setLocalSafe(data, lx + rx, baseWy, lz + rz, B.BIRCH_LOG, true);
      for (let i = 0; i < th; i++) setLocalSafe(data, lx, baseWy + i, lz, B.BIRCH_LOG, true);
      // Asymmetric lower side branches w/ cute leaf puffs!
      const brY = baseWy + Math.floor(th * 0.52);
      setLocalSafe(data, lx - 1, brY, lz, B.BIRCH_LOG, true); setLocalSafe(data, lx - 2, brY, lz, B.BIRCH_LOG, true);
      setLocalSafe(data, lx + 1, brY - 1, lz, B.BIRCH_LOG, true); setLocalSafe(data, lx + 2, brY - 1, lz, B.BIRCH_LOG, true);
      for (const [bx, by] of [[-2, brY], [2, brY - 1]]) {
        for (let dy = 0; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (dy === 2 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          setLocalSafe(data, lx + bx + dx, by + dy, lz + dz, B.BIRCH_LEAVES, false);
        }
      }
      // Full high sculpted birch crown!
      const cy = baseWy + th - 2;
      for (let dy = 0; dy <= 5; dy++) {
        const rad = (dy === 1 || dy === 2 || dy === 3) ? 3 : (dy === 5 ? 1 : 2);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx, dz) > rad + 0.25) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.BIRCH_LEAVES, false);
        }
      }
    } else if (style === 'baobab') {
      const th = 6 + Math.floor(r0 * 2);
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.ACACIA_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.ACACIA_LOG, true);
        setLocalSafe(data, lx, baseWy + i, lz + 1, B.ACACIA_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.ACACIA_LOG, true);
      }
      for (let dy = 0; dy <= 2; dy++) {
        const rad = dy === 2 ? 2 : 3;
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
          if (Math.abs(dx - 0.5) + Math.abs(dz - 0.5) > rad + 1.5) continue;
          setLocalSafe(data, lx + dx, baseWy + th + dy, lz + dz, B.ACACIA_LEAVES, false);
        }
      }
    } else if (style === 'broadleaf') {
      // Đại thụ tán rộng kiểu "Custom Tree Tutorial" (tree/images (2).jpg): thân 2x2, rễ nổi, tán nhiều lớp tròn
      const trunkH = 9 + Math.floor(r0 * 4);
      for (let i = 0; i < trunkH; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.OAK_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.OAK_LOG, true);
        setLocalSafe(data, lx, baseWy + i, lz + 1, B.OAK_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.OAK_LOG, true);
      }
      // Rễ nổi quanh gốc
      for (const [dx, dz] of [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [1, -1], [-1, -1], [2, 2]]) {
        if (hash2i(wx + dx, wz + dz, worldSeed + 611) > 0.42) setLocalSafe(data, lx + dx, baseWy, lz + dz, B.OAK_LOG, true);
      }
      // Tán: 6 lớp bán kính 3-5-5-4-2-1, viền lá thưa tự nhiên
      const cy = baseWy + trunkH - 5;
      const rads = [3, 5, 5, 4, 2, 1];
      for (let dy = 0; dy < rads.length; dy++) {
        const rad = rads[dy];
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
          const nx = dx - 0.5, nz = dz - 0.5;
          const d = Math.sqrt(nx * nx + nz * nz);
          if (d > rad + 0.3) continue;
          if (d > rad - 0.7 && hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 43) < 0.32) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.OAK_LEAVES, false);
        }
      }
      for (const [vx, vz] of [[4,0],[-3,0],[0,4],[0,-3],[3,3],[-2,-2]]) {
        if (hash2i(wx + vx, wz + vz, worldSeed + 617) > 0.38) {
          const vLen = 3 + Math.floor(hash2i(wx + vx, wz + vz, worldSeed + 619) * 5);
          for (let vd = 1; vd <= vLen; vd++) setLocalSafe(data, lx + vx, cy - vd, lz + vz, B.VINE, false);
        }
      }
      for (const [bxOff, bzOff] of [[-2, 2], [3, -2]]) {
        if (hash2i(wx + bxOff, wz + bzOff, worldSeed + 621) > 0.36) placeLeafBushCluster(data, lx + bxOff, baseWy, lz + bzOff, wx + bxOff, wz + bzOff, B.OAK_LEAVES);
      }
    } else if (style === 'birch_bent') {
      // Bạch dương thân cong (tree/images (1).jpg — cây bên phải)
      const trunkH = 7 + Math.floor(r0 * 3);
      let bend = 0;
      for (let i = 0; i < trunkH; i++) {
        if (i > 2 && i % 3 === 0) bend += (r0 > 0.5 ? 1 : -1);
        setLocalSafe(data, lx + bend, baseWy + i, lz, B.BIRCH_LOG, true);
      }
      const topY = baseWy + trunkH - 3;
      for (let dy = 0; dy <= 4; dy++) {
        const rad = dy === 0 ? 1 : (dy === 1 || dy === 2 ? 2 : 1);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && hash3i(wx + dx, topY + dy, wz + dz, worldSeed + 47) < 0.5) continue;
          setLocalSafe(data, lx + bend + dx, topY + dy, lz + dz, B.BIRCH_LEAVES, false);
        }
      }
    } else if (style === 'azure_tree') {
      // Puffy Azure Canopy Tree (matching blue forest photos: slender pale slate-blue trunk + stacked rounded blue foliage crowns!)
      const trunkH = 6 + Math.floor(r0 * 4);
      for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (hash2i(wx + rx, wz + rz, worldSeed + 641) > 0.55) setLocalSafe(data, lx + rx, baseWy, lz + rz, B.AZURE_LOG, true);
      }
      for (let i = 0; i < trunkH; i++) setLocalSafe(data, lx, baseWy + i, lz, B.AZURE_LOG, true);
      const puffs = [[0, trunkH - 1, 0, 3], [0, trunkH + 3, 0, 2]];
      if (r1 > 0.45) puffs.push([r0 > 0.5 ? 2 : -2, trunkH - 2, r1 > 0.7 ? 1 : -1, 2]);
      for (let pi = 0; pi < puffs.length; pi++) {
        const [ox, oy, oz, rMax] = puffs[pi];
        for (let dy = -1; dy <= 2; dy++) {
          const rad = (dy === -1 || dy === 2) ? Math.max(1, rMax - 1) : rMax;
          for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
            const d = Math.hypot(dx, dz);
            if (d > rad + 0.25) continue;
            if (d > rad - 0.4 && hash3i(wx + ox + dx, baseWy + oy + dy, wz + oz + dz, worldSeed + 643) < 0.28) continue;
            const lid = (dy < 0 || (d < 1.2 && dy === 0)) ? B.COBALT_LEAVES : B.AZURE_LEAVES;
            setLocalSafe(data, lx + ox + dx, baseWy + oy + dy, lz + oz + dz, lid, false);
          }
        }
      }
      setLocalSafe(data, lx, baseWy + trunkH + 5, lz, B.AZURE_LEAVES, false);
    } else if (style === 'azure_pine') {
      // Slender Conical Sapphire Spruce (matching blue forest spires in photos 7 & 13!)
      const totalH = 10 + Math.floor(r0 * 5);
      for (let i = 0; i < totalH - 1; i++) setLocalSafe(data, lx, baseWy + i, lz, B.AZURE_LOG, true);
      const startY = baseWy + 3, canopyH = totalH - 3;
      for (let step = 0; step <= canopyH; step++) {
        const wy = startY + step, fromTop = canopyH - step;
        const rad = fromTop === 0 ? 0 : (fromTop <= 2 ? 1 : (fromTop % 2 === 1 ? (fromTop >= 6 ? 3 : 2) : (fromTop >= 7 ? 2 : 1)));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if ((rad === 3 && dist > 3) || (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) || (rad === 1 && fromTop === 1 && dist > 1)) continue;
          const lid = (fromTop <= 2 || dist >= rad) ? B.AZURE_LEAVES : B.COBALT_LEAVES;
          setLocalSafe(data, lx + dx, wy, lz + dz, lid, false);
        }
      }
      setLocalSafe(data, lx, baseWy + totalH + 1, lz, B.AZURE_LEAVES, false);
    } else if (style === 'cobalt_willow') {
      // Grand 2x2 Cobalt Broadleaf Tree w/ multi-lobe azure crowns & hanging cobalt leaf drapes!
      const th = 8 + Math.floor(r0 * 4);
      for (const [rx, rz] of [[-1,0],[2,0],[0,-1],[1,2]]) {
        if (hash2i(wx + rx, wz + rz, worldSeed + 653) > 0.42) setLocalSafe(data, lx + rx, baseWy, lz + rz, B.AZURE_LOG, true);
      }
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.AZURE_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.AZURE_LOG, true);
        setLocalSafe(data, lx, baseWy + i, lz + 1, B.AZURE_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.AZURE_LOG, true);
      }
      const cy = baseWy + th - 2;
      for (let dy = 0; dy <= 5; dy++) {
        const rad = (dy === 1 || dy === 2) ? 4 : (dy === 5 ? 1 : (dy === 4 ? 2 : 3));
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
          const d = Math.hypot(dx - 0.5, dz - 0.5);
          if (d > rad + 0.4) continue;
          if (d > rad - 0.5 && hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 659) < 0.25) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, (dy <= 1 && d < 2.2) ? B.COBALT_LEAVES : B.AZURE_LEAVES, false);
        }
      }
      for (const [vx, vz] of [[4,0],[-3,0],[0,4],[0,-3],[3,3],[-2,-2]]) {
        const dLen = 1 + Math.floor(hash2i(wx + vx, wz + vz, worldSeed + 661) * 3);
        for (let vd = 1; vd <= dLen; vd++) setLocalSafe(data, lx + vx, cy - vd, lz + vz, vd === 1 ? B.AZURE_LEAVES : B.COBALT_LEAVES, false);
      }
    } else if (style === 'tall_pine') {
      // Majestic Dense Conical Nordic Spruce (matching photo 1 & 11!)
      const totalH = Math.min(MAX_Y - baseWy - 3, 14 + Math.floor(r0 * 5));
      for (let i = 0; i < totalH - 1; i++) setLocalSafe(data, lx, baseWy + i, lz, B.SPRUCE_LOG, true);
      const startY = baseWy + 2, canopyH = Math.max(6, totalH - 2);
      for (let step = 0; step <= canopyH; step++) {
        const wy = startY + step, fromTop = canopyH - step;
        const maxR = Math.min(4, 1 + Math.floor(fromTop / 4));
        const rad = fromTop === 0 ? 0 : (fromTop <= 2 ? 1 : ((step & 1) === 0 ? maxR : Math.max(1, maxR - 1)));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const d = Math.hypot(dx, dz);
          if (d > rad + 0.35) continue;
          if (rad >= 3 && d > rad - 0.2 && hash3i(wx + dx, wy, wz + dz, worldSeed + 673) < 0.30) continue;
          setLocalSafe(data, lx + dx, wy, lz + dz, B.SPRUCE_LEAVES, false);
        }
      }
      setLocalSafe(data, lx, baseWy + totalH + 1, lz, B.SPRUCE_LEAVES, false);
    } else if (style === 'mega_jungle') {
      // Towering Tropical Umbrella Canopy Giant w/ Long Hanging Vine Curtains (matching photos 5 & 9!)
      const th = Math.min(MAX_Y - baseWy - 5, 14 + Math.floor(r0 * 6));
      for (const [rx, rz] of [[-1,0],[2,0],[0,-1],[1,2],[-1,1],[2,1]]) {
        const rh = 2 + Math.floor(hash2i(wx + rx, wz + rz, worldSeed + 683) * 3);
        for (let ry = 0; ry < rh; ry++) setLocalSafe(data, lx + rx, baseWy + ry, lz + rz, B.JUNGLE_LOG, true);
      }
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.JUNGLE_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.JUNGLE_LOG, true);
        setLocalSafe(data, lx, baseWy + i, lz + 1, B.JUNGLE_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.JUNGLE_LOG, true);
      }
      // Mid-trunk horizontal limb + leaf shelf
      const midY = baseWy + Math.floor(th * 0.55);
      for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 3; dz++) {
        if (Math.hypot(dx - 0.5, dz - 0.5) <= 2.4) setLocalSafe(data, lx + dx, midY, lz + dz, B.JUNGLE_LEAVES, false);
      }
      // Flat wide multi-tiered umbrella crown
      const cy = baseWy + th - 2;
      for (let dy = 0; dy <= 3; dy++) {
        const rad = dy === 0 ? 4 : (dy === 1 || dy === 2 ? 5 : 3);
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
          const d = Math.hypot(dx - 0.5, dz - 0.5);
          if (d > rad + 0.35) continue;
          if (dy === 2 && d > rad - 0.6 && hash3i(wx + dx, cy + dy, wz + dz, worldSeed + 691) < 0.25) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.JUNGLE_LEAVES, false);
        }
      }
      // Long lush vertical vine curtains (8..14 blocks) hanging around perimeter!
      for (const [vx, vz] of [[5,0],[5,2],[-4,0],[-4,1],[0,5],[2,5],[0,-4],[1,-4],[4,4],[-3,4],[4,-3],[-3,-3]]) {
        if (hash2i(wx + vx, wz + vz, worldSeed + 701) > 0.22) {
          setLocalSafe(data, lx + vx, cy, lz + vz, B.JUNGLE_LEAVES, false);
          const vLen = Math.min(th - 2, 7 + Math.floor(hash2i(wx + vx, wz + vz, worldSeed + 709) * 7));
          for (let vd = 1; vd <= vLen; vd++) setLocalSafe(data, lx + vx, cy - vd, lz + vz, B.VINE, false);
        }
      }
      for (const [bxOff, bzOff] of [[3,3],[-2,-2],[3,-2]]) {
        if (hash2i(wx + bxOff, wz + bzOff, worldSeed + 719) > 0.35) placeLeafBushCluster(data, lx + bxOff, baseWy, lz + bzOff, wx + bxOff, wz + bzOff, B.JUNGLE_LEAVES);
      }
    } else if (style === 'dark_oak') {
      const th = 5 + Math.floor(r0 * 3);
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.DARK_OAK_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.DARK_OAK_LOG, true);
        setLocalSafe(data, lx, baseWy + i, lz + 1, B.DARK_OAK_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.DARK_OAK_LOG, true);
      }
      const cy = baseWy + th - 1;
      for (let dy = 0; dy <= 3; dy++) {
        const rad = (dy === 0 || dy === 3) ? 2 : 3;
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
          if (Math.hypot(dx - 0.5, dz - 0.5) > rad + 0.45) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.DARK_OAK_LEAVES, false);
        }
      }
      placeLeafBushCluster(data, lx + 2, baseWy, lz + 2, wx + 2, wz + 2, B.DARK_OAK_LEAVES);
    } else if (style === 'pale_oak') {
      const th = 6 + Math.floor(r0 * 4);
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.PALE_LOG, true);
        if (i < th - 1) setLocalSafe(data, lx + 1, baseWy + i, lz, B.PALE_LOG, true);
      }
      const cy = baseWy + th - 1;
      for (let dy = 0; dy <= 3; dy++) {
        const rad = dy === 3 ? 1 : (dy === 0 ? 3 : 2);
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx - 0.5, dz) > rad + 0.4) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.PALE_LEAVES, false);
        }
      }
      placeLeafBushCluster(data, lx - 1, baseWy, lz + 2, wx - 1, wz + 2, B.PALE_LEAVES);
    } else if (style === 'nightmare_tree') {
      const th = 7 + Math.floor(r0 * 5);
      let bx = lx, bz = lz;
      for (let i = 0; i < th; i++) {
        if (i > 2 && (i & 1) === 0) bx += (hash2i(wx, i, worldSeed + 757) > 0.5 ? 1 : -1);
        if (i > 3 && (i % 3) === 0) bz += (hash2i(wz, i, worldSeed + 761) > 0.5 ? 1 : -1);
        setLocalSafe(data, bx, baseWy + i, bz, B.NIGHTMARE_LOG, true);
      }
      for (let dy = -1; dy <= 2; dy++) {
        const rad = dy === 2 ? 1 : 3;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx, dz) > rad + 0.3) continue;
          setLocalSafe(data, bx + dx, baseWy + th + dy, bz + dz, B.NIGHTMARE_LEAVES, false);
        }
      }
      if (r1 > 0.45) setLocalSafe(data, bx, baseWy + th - 1, bz + 1, B.GLOW_CRYSTAL, false);
    } else if (style === 'sift_giant') {
      const th = 11 + Math.floor(r0 * 6);
      for (let i = 0; i < th; i++) {
        setLocalSafe(data, lx, baseWy + i, lz, B.SIFT_LOG, true);
        setLocalSafe(data, lx + 1, baseWy + i, lz, B.SIFT_LOG, true);
      }
      const cy = baseWy + th - 1;
      const capLeaf = r1 > 0.48 ? B.LULLABY_LEAVES : B.SIFT_LEAVES;
      for (let dy = 0; dy <= 3; dy++) {
        const rad = (dy === 1) ? 4 : (dy === 3 ? 2 : 3);
        for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx - 0.5, dz) > rad + 0.4) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, capLeaf, false);
        }
      }
      for (const [vx, vz] of [[3, 0], [-2, 0], [0, 3], [0, -3]]) {
        for (let d = 1; d <= 3; d++) setLocalSafe(data, lx + vx, cy - d, lz + vz, B.GLOW_VINES, false);
      }
    } else if (style === 'sculk_tree') {
      const th = 7 + Math.floor(r0 * 4);
      for (let i = 0; i < th; i++) setLocalSafe(data, lx, baseWy + i, lz, B.SCULK_LOG, true);
      const cy = baseWy + th - 2;
      for (let dy = 0; dy <= 3; dy++) {
        const rad = dy === 3 ? 1 : (dy === 1 ? 3 : 2);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx, dz) > rad + 0.35) continue;
          setLocalSafe(data, lx + dx, cy + dy, lz + dz, B.SCULK_LEAVES, false);
        }
      }
    }
  }

  function applyChunkMods(cx, cz, data, maxLy) {
    const cMods = worldModsByChunk.get(chunkKey(cx, cz));
    if (cMods && cMods.size > 0) {
      const dOff = depthOffset || 0;
      for (const [mKey, id] of cMods.entries()) {
        const trueY = (mKey >> 8) - 2048;
        if (trueY <= -1001 && trueY >= -1010) continue;
        if (id === B.BEDROCK && trueY >= -1000 && trueY <= -980) continue;
        const wy = trueY + dOff;
        if (wy < MIN_Y || wy > MAX_Y) continue;
        const ly = wy - MIN_Y;
        data[(ly << 8) | (mKey & 255)] = id;
        if (ly > maxLy) maxLy = ly;
      }
    }
    return maxLy;
  }


  const END_CITY_HERO = { cx: 1032, cz: 0, baseY: 8, towerW: 6, towerH: 24, hasShip: true, shipX: 1032, shipY: 22, shipZ: -28 };

  function getEndCityForRegion(rx, rz) {
    // Keep hero gateway & hero city sector (x~990..1080, z~-70..70) dedicated cleanly
    if ((rx === 7 || rx === 8) && (rz === -1 || rz === 0)) return null;
    if (Math.hypot(rx * 128 + 64, rz * 128 + 64) < 210) return null;
    if (hash2i(rx, rz, worldSeed + 971) <= 0.35) return null;
    const cx = rx * 128 + 36 + Math.floor(hash2i(rx, rz, worldSeed + 973) * 56);
    const cz = rz * 128 + 36 + Math.floor(hash2i(rx, rz, worldSeed + 977) * 56);
    const baseY = 7 + Math.floor(hash2i(rx, rz, worldSeed + 979) * 3);
    const towerW = 5 + (hash2i(rx, rz, worldSeed + 981) > 0.5 ? 1 : 0);
    const towerH = 20 + Math.floor(hash2i(rx, rz, worldSeed + 983) * 8);
    const hasShip = hash2i(rx, rz, worldSeed + 989) > 0.30;
    return { cx, cz, baseY, towerW, towerH, hasShip, shipX: cx, shipY: baseY + 14, shipZ: cz - 26 };
  }

  function getEndCityPlateauHeight(wx, wz) {
    // Arrival Gateway Island at (1004, 0) + bridge into Hero City at (1032, 0)
    if (Math.hypot(wx - 1004, wz) <= 13.5) return 8;
    if (Math.hypot(wx - END_CITY_HERO.cx, wz - END_CITY_HERO.cz) <= 21) return END_CITY_HERO.baseY;
    const rx = Math.floor(wx / 128), rz = Math.floor(wz / 128);
    const c = getEndCityForRegion(rx, rz);
    if (c && Math.hypot(wx - c.cx, wz - c.cz) <= 20) return c.baseY;
    return -99;
  }

  function stampEndShipInChunk(data, wx0, wz0, ship, maxLy) {
    if (!ship || !ship.hasShip) return maxLy;
    const sx = ship.shipX, sy = ship.shipY, sz = ship.shipZ;
    if (sx + 7 < wx0 || sx - 7 > wx0 + 15 || sz + 14 < wz0 || sz - 14 > wz0 + 15) return maxLy;
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz, dz = wz - sz;
      if (dz < -12 || dz > 10) continue;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, dx = wx - sx, adx = Math.abs(dx);
        if (adx > 5) continue;
        // Sculpted End Ship hull (prow -> -Z, broad midship, raised quarterdeck -> +Z)
        const maxW = dz < -8 ? 0 : (dz < -5 ? 1 : (dz < -1 ? 3 : (dz > 7 ? 3 : 4)));
        const keelDrop = (dz >= -5 && dz <= 7) ? 2 : 1;
        if (adx <= maxW) {
          for (let ky = -keelDrop; ky <= -1; ky++) {
            setLocalSafe(data, lx, sy + ky, lz, ky === -keelDrop ? B.OBSIDIAN : B.PURPUR_BLOCK, true);
          }
          setLocalSafe(data, lx, sy, lz, adx === maxW ? B.PURPUR_PILLAR : B.END_STONE_BRICKS, true);
          if (adx === maxW || dz === 9 || dz === -8) {
            setLocalSafe(data, lx, sy + 1, lz, B.PURPUR_BLOCK, true);
            if (dz >= 4 && adx === maxW) setLocalSafe(data, lx, sy + 2, lz, B.PURPUR_BLOCK, true);
            if (adx === maxW && Math.abs(dz) % 3 === 0) setLocalSafe(data, lx, sy + (dz >= 4 ? 3 : 2), lz, B.END_ROD, true);
          }
        }
        // Slender Purpur bowsprit & Dragon Head figurehead at dz = -11
        if (dx === 0 && dz >= -11 && dz <= -8) {
          setLocalSafe(data, lx, sy + 2, lz, B.PURPUR_BLOCK, true);
          if (dz === -11) {
            setLocalSafe(data, lx, sy + 3, lz, B.DRAGON_HEAD, true);
            dragonHeadYaw.set(modKey(wx, sy + 3, wz), Math.PI);
          }
        }
        // Aft Treasury Cabin housing Elytra Chest, Enchant Table & Shulker Watch
        if (dz >= 3 && dz <= 8 && adx <= 3) {
          const isWall = (adx === 3 || dz === 3 || dz === 8);
          const isDoor = (dz === 3 && Math.abs(dx) <= 0);
          for (let hy = 1; hy <= 5; hy++) {
            if (hy === 5) {
              setLocalSafe(data, lx, sy + hy, lz, adx <= 2 ? B.PURPUR_PILLAR : B.END_STONE_BRICKS, true);
            } else if (isWall && !isDoor) {
              const win = ((hy === 2 || hy === 3) && adx === 3 && (dz === 5 || dz === 6));
              setLocalSafe(data, lx, sy + hy, lz, win ? B.GLASS : B.PURPUR_BLOCK, true);
            } else {
              setLocalSafe(data, lx, sy + hy, lz, B.AIR, true);
            }
          }
          if (dx === 0 && dz === 6) {
            setLocalSafe(data, lx, sy + 1, lz, B.GOLD_CHEST, true);
            naturalChestTags.set(modKey(wx, sy + 1, wz), 'end_ship');
          }
          if (dx === -2 && dz === 7) setLocalSafe(data, lx, sy + 1, lz, B.ENCHANT_TABLE, true);
          if (dx === 2 && dz === 7) setLocalSafe(data, lx, sy + 1, lz, B.ENDER_CHEST_BLOCK, true);
        }
        // Towering Obsidian/Purpur Mast + Dual Yardarms + Striped End Sail
        if (dx === 0 && dz === -1) {
          for (let my = 1; my <= 16; my++) setLocalSafe(data, lx, sy + my, lz, my > 12 ? B.OBSIDIAN : B.PURPUR_PILLAR, true);
          setLocalSafe(data, lx, sy + 17, lz, B.END_ROD, true);
        }
        if (dz === -1 && adx <= 4) {
          for (let my = 5; my <= 13; my++) {
            const band = (my === 5 || my === 13) ? B.PURPUR_PILLAR : (((adx + my) & 1) ? B.MAGENTA_WOOL : B.WHITE_WOOL);
            setLocalSafe(data, lx, sy + my, lz, band, true);
          }
        }
        if (dx === 0 && dz >= 9 && dz <= 11) setLocalSafe(data, lx, sy, lz, B.PURPUR_BLOCK, true);
        maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, (sy + 18) - MIN_Y));
      }
    }
    return maxLy;
  }

  function stampEndCityInChunk(data, wx0, wz0, city, maxLy) {
    if (!city) return maxLy;
    const hw = city.towerW, bY = city.baseY, topY = bY + city.towerH;
    if (city.cx + hw + 18 < wx0 || city.cx - hw - 18 > wx0 + 15 || city.cz + hw + 22 < wz0 || city.cz - hw - 22 > wz0 + 15) {
      return stampEndShipInChunk(data, wx0, wz0, city, maxLy);
    }
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz, dz = wz - city.cz, adz = Math.abs(dz);
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, dx = wx - city.cx, adx = Math.abs(dx);
        // Purpur Skybridge up to docked End Ship
        if (city.hasShip && Math.abs(dx) <= 1 && dz >= -(city.cz - (city.shipZ + 9)) && dz <= -hw) {
          const bridgeLen = (city.cz - hw) - (city.shipZ + 10);
          const prog = bridgeLen > 0 ? Math.max(0, Math.min(1, (-dz - hw) / bridgeLen)) : 0;
          const bBridgeY = Math.round(bY + 1 + prog * (city.shipY - (bY + 1)));
          setLocalSafe(data, lx, bBridgeY, lz, Math.abs(dx) === 1 ? B.PURPUR_PILLAR : B.END_STONE_BRICKS, true);
          if (Math.abs(dz) % 4 === 0 && Math.abs(dx) === 1) setLocalSafe(data, lx, bBridgeY + 1, lz, B.END_ROD, true);
        }
        // Twin East/West Cantilevered Side Towers + Connecting Walkways
        for (const sideSgn of [-1, 1]) {
          const sxC = sideSgn * (hw + 6), bxS = dx - sxC, axS = Math.abs(bxS);
          if (adx > hw && Math.abs(dx) <= hw + 3 && adz <= 1) {
            setLocalSafe(data, lx, bY + 8, lz, B.END_STONE_BRICKS, true);
            if (adz === 1) setLocalSafe(data, lx, bY + 9, lz, B.PURPUR_PILLAR, true);
          }
          if (axS <= 3 && adz <= 3) {
            const subTop = bY + 16;
            for (let wy = bY + 7; wy <= subTop; wy++) {
              const sWall = (axS === 3 || adz === 3), sFl = (wy === bY + 7 || wy === subTop);
              if (sWall || sFl) setLocalSafe(data, lx, wy, lz, (axS === 3 && adz === 3) ? B.PURPUR_PILLAR : (sFl ? B.END_STONE_BRICKS : B.PURPUR_BLOCK), true);
              else setLocalSafe(data, lx, wy, lz, B.AIR, true);
            }
            if (bxS === 0 && dz === 0) {
              setLocalSafe(data, lx, bY + 8, lz, B.CHEST, true);
              naturalChestTags.set(modKey(wx, bY + 8, wz), 'end_city');
              setLocalSafe(data, lx, subTop + 1, lz, B.END_ROD, true);
            }
          }
        }
        // Main Multi-Tiered Central End Citadel Tower (flares wider near the crown!)
        const activeW = (topY > bY + 16) ? hw : hw;
        if (adx <= activeW && adz <= activeW) {
          const isCorner = (adx === activeW && adz === activeW);
          const isWall = (adx === activeW || adz === activeW);
          const isDoor = ((adx <= 1 && adz === activeW) || (adz <= 1 && adx === activeW));
          for (let wy = bY; wy <= topY; wy++) {
            const relY = wy - bY;
            if (isDoor && relY >= 1 && relY <= 4) {
              setLocalSafe(data, lx, wy, lz, B.AIR, true);
              continue;
            }
            const isFloor = (relY === 0 || relY === 8 || relY === 16 || wy === topY);
            if (isCorner) {
              setLocalSafe(data, lx, wy, lz, B.PURPUR_PILLAR, true);
            } else if (isWall) {
              const win = (relY === 4 || relY === 12 || relY === 20) && (dx === 0 || dz === 0 || adx === 2 || adz === 2);
              setLocalSafe(data, lx, wy, lz, win ? B.GLASS : (isFloor ? B.END_STONE_BRICKS : B.PURPUR_BLOCK), true);
            } else if (isFloor) {
              setLocalSafe(data, lx, wy, lz, ((wx + wz) & 1) ? B.END_STONE_BRICKS : B.PURPUR_BLOCK, true);
            } else {
              setLocalSafe(data, lx, wy, lz, B.AIR, true);
            }
          }
          for (let fBase = 0; fBase <= 16; fBase += 8) {
            const stOff = (dx === -activeW + 2 && dz >= -2 && dz <= 4);
            if (stOff) setLocalSafe(data, lx, bY + fBase + 1 + (dz + 2), lz, B.PURPUR_BLOCK, true);
          }
          if (isCorner) setLocalSafe(data, lx, topY + 1, lz, B.END_ROD, true);
          if (dx === 0 && dz === 0) {
            setLocalSafe(data, lx, bY + 9, lz, B.CHEST, true);
            naturalChestTags.set(modKey(wx, bY + 9, wz), 'end_city');
            setLocalSafe(data, lx, bY + 17, lz, B.ENDER_CHEST_BLOCK, true);
            setLocalSafe(data, lx, topY + 1, lz, B.END_CRYSTAL_BLOCK, true);
          }
          if (adx === activeW - 1 && adz === activeW - 1) setLocalSafe(data, lx, bY + 1, lz, B.END_ROD, true);
          maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, (topY + 3) - MIN_Y));
        } else if (Math.abs(adx - (hw + 1)) === 0 && adz <= hw + 1 && hash2i(wx, wz, worldSeed + 991) > 0.94) {
          setLocalSafe(data, lx, bY + 1, lz, B.CHORUS_PLANT, true);
        }
      }
    }
    return stampEndShipInChunk(data, wx0, wz0, city, maxLy);
  }

  function _genEndChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 0;
    const pillarAngles = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
      px: Math.round(Math.cos((i / 8) * Math.PI * 2) * 26),
      pz: Math.round(Math.sin((i / 8) * Math.PI * 2) * 26),
      h: 17 + (i % 4) * 4,
      caged: (i === 1 || i === 5)
    }));
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, h = getTerrainHeight(wx, wz, BIOMES.THE_END);
        const ci = (lz << 4) | lx; colHeights[ci] = h; colBiomes[ci] = BIOMES.THE_END.id;
        if (h > -50) {
          const bot = Math.max(MIN_Y + 4, h - Math.floor(6 + valueNoise2D(wx * 0.08, wz * 0.08, worldSeed + 911) * 8));
          const topLy = h - MIN_Y; if (topLy > maxLy) maxLy = topLy;
          for (let wy = bot; wy <= h; wy++) data[((wy - MIN_Y) << 8) | (lz << 4) | lx] = B.END_STONE;
          const dc = Math.hypot(wx, wz);
          if (dc <= 4.6) {
            const pY = Math.max(9, h);
            if (dc >= 2.6) setLocalSafe(data, lx, pY + 1, lz, B.BEDROCK, true);
            else if (dc <= 0.8) {
              for (let py = pY; py <= pY + 4; py++) setLocalSafe(data, lx, py, lz, B.BEDROCK, true);
            }
            setLocalSafe(data, lx, pY, lz, B.BEDROCK, true);
            const mTop = Math.min(WORLD_H - 1, (pY + 6) - MIN_Y); if (mTop > maxLy) maxLy = mTop;
          }
          // Arrival Return End Gateway shrine at (998, 9, 0) + Walkway bridge to Hero End City
          if (wx >= 996 && wx <= 1000 && Math.abs(wz) <= 2) {
            const gd = Math.abs(wx - 998) + Math.abs(wz);
            if (gd <= 2) {
              setLocalSafe(data, lx, 9, lz, B.BEDROCK, true);
              setLocalSafe(data, lx, 14, lz, B.BEDROCK, true);
              if (Math.abs(wx - 998) <= 1 && Math.abs(wz) <= 1 && gd <= 1) {
                for (let gy = 10; gy <= 12; gy++) setLocalSafe(data, lx, gy, lz, B.END_GATEWAY, true);
              }
              if (gd === 2) setLocalSafe(data, lx, 15, lz, B.END_ROD, true);
              maxLy = Math.max(maxLy, 16 - MIN_Y);
            }
          }
          if (wx >= 1014 && wx <= 1025 && Math.abs(wz) <= 1) {
            setLocalSafe(data, lx, 8, lz, Math.abs(wz) === 1 ? B.PURPUR_PILLAR : B.END_STONE_BRICKS, true);
            if (wx % 4 === 0 && Math.abs(wz) === 1) setLocalSafe(data, lx, 9, lz, B.END_ROD, true);
            maxLy = Math.max(maxLy, 10 - MIN_Y);
          }
          if (lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13 && dc > 34 && hash2i(wx, wz, worldSeed + 955) > 0.968) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'chorus');
            const cTop = Math.min(WORLD_H - 1, (h + 9) - MIN_Y); if (cTop > maxLy) maxLy = cTop;
          }
        }
        for (let pi = 0; pi < pillarAngles.length; pi++) {
          const p = pillarAngles[pi];
          const dxp = Math.abs(wx - p.px), dzp = Math.abs(wz - p.pz);
          if (dxp <= 2 && dzp <= 2 && (dxp + dzp <= 3)) {
            const baseY = Math.max(4, h);
            for (let wy = baseY; wy <= baseY + p.h; wy++) setLocalSafe(data, lx, wy, lz, B.OBSIDIAN, true);
            if (wx === p.px && wz === p.pz) setLocalSafe(data, lx, baseY + p.h + 1, lz, B.END_CRYSTAL_BLOCK, true);
            else if (p.caged && (dxp === 2 || dzp === 2)) {
              setLocalSafe(data, lx, baseY + p.h + 1, lz, B.RUST_STEEL, true);
              setLocalSafe(data, lx, baseY + p.h + 2, lz, B.RUST_STEEL, true);
            }
            const pTop = Math.min(WORLD_H - 1, (baseY + p.h + 4) - MIN_Y); if (pTop > maxLy) maxLy = pTop;
          }
        }
      }
    }
    if (Math.hypot(wx0 + 8, wz0 + 8) >= 180) {
      maxLy = stampEndCityInChunk(data, wx0, wz0, END_CITY_HERO, maxLy);
      const cMid = getEndCityForRegion(Math.floor((wx0 + 8) / 128), Math.floor((wz0 + 8) / 128));
      if (cMid && cMid !== END_CITY_HERO) maxLy = stampEndCityInChunk(data, wx0, wz0, cMid, maxLy);
    }
    maxLy = applyChunkMods(cx, cz, data, maxLy);
    const chE = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chE);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chE;
  }

  function _genDragonRealmChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 0;
    if (!chunkWorkerPool.take(wx0, wz0, 0)) fillCoarseCaveGrid(wx0, wz0);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const b = getBiomeAt(wx, wz);
        const topH = getTerrainHeight(wx, wz, b);
        const ci = (lz << 4) | lx; colHeights[ci] = topH; colBiomes[ci] = b.id;
        const maxFillLy = Math.min(WORLD_H - 1, topH - MIN_Y);
        if (maxFillLy > maxLy) maxLy = maxFillLy;
        const dArena = Math.hypot(wx, wz - 136);
        const pondN = valueNoise2D(wx * 0.085, wz * 0.085, worldSeed + 8609);
        const isJunglePond = (b === BIOMES.DR_JUNGLE && dArena >= 30 && Math.hypot(wx, wz) >= 28 && pondN < 0.24 && topH <= 19);
        for (let ly = 0; ly <= maxFillLy; ly++) {
          const wy = MIN_Y + ly;
          const idx = (ly << 8) | (lz << 4) | lx;
          if (wy === MIN_Y) { data[idx] = B.BEDROCK; continue; }
          if (isJunglePond && wy >= topH - 1) { data[idx] = B.WATER; continue; }
          const caveThresh = (b === BIOMES.DR_CAVERNS) ? 0.60 : 0.75;
          if (wy < topH - 2 && wy > MIN_Y + 4 && dArena >= 28 && sampleCaveFast(lx, ly, lz) > caveThresh) {
            const cH = hash3i(wx, wy, wz, worldSeed + 8707);
            data[idx] = (wy === MIN_Y + 5 && cH > 0.90) ? B.GLOW_CRYSTAL : ((cH > 0.985 && wy < topH - 5) ? B.AMETHYST : B.AIR);
            continue;
          }
          if (wy === topH) {
            if (dArena < 22) data[idx] = (dArena > 19.5) ? B.PURPUR_BLOCK : (((Math.abs(wx) + Math.abs(wz - 136)) % 4 === 0) ? B.END_STONE_BRICKS : B.OBSIDIAN);
            else if (b === BIOMES.DR_JUNGLE) data[idx] = pondN > 0.56 ? B.END_MOSS : B.END_CRYSTAL_STONE;
            else if (b === BIOMES.DR_PLATEAU) data[idx] = ((wx ^ wz) & 3) === 0 ? B.PURPUR_BLOCK : B.END_STONE_BRICKS;
            else if (b === BIOMES.DR_PEAKS) data[idx] = wy >= 42 ? B.OBSIDIAN : (pondN > 0.58 ? B.AMETHYST : B.END_CRYSTAL_STONE);
            else if (b === BIOMES.DR_CAVERNS) data[idx] = pondN > 0.52 ? B.AMETHYST : B.END_CRYSTAL_STONE;
            else data[idx] = pondN > 0.45 ? B.END_MOSS : B.END_STONE;
          } else {
            const oh = hash3i(wx, wy, wz, worldSeed + 8819);
            if (wy < 12 && oh > 0.986) data[idx] = B.VOID_ORE;
            else if (wy < 22 && oh > 0.980) data[idx] = B.DIAMOND_ORE;
            else if (oh > 0.968) data[idx] = B.AMETHYST;
            else data[idx] = (wy >= topH - 3) ? B.END_CRYSTAL_STONE : B.END_STONE;
          }
        }
        // Arena corner obelisks around (0, 136)
        if (Math.abs(Math.abs(wx) - 14) <= 1 && Math.abs(Math.abs(wz - 136) - 14) <= 1) {
          for (let py = topH + 1; py <= topH + 12; py++) {
            setLocalSafe(data, lx, py, lz, (wx === 14 || wx === -14) && (wz === 150 || wz === 122) && py === topH + 12 ? B.END_CRYSTAL_BLOCK : ((py % 3 === 0) ? B.AMETHYST : B.OBSIDIAN), true);
          }
          const aTop = Math.min(WORLD_H - 1, topH + 13 - MIN_Y);
          if (aTop > maxLy) maxLy = aTop;
        }
        // Biome trees / crystal spires outside central hub & arena
        if (Math.hypot(wx, wz) > 16 && dArena > 25 && !isJunglePond) {
          const fh = hash2i(wx * 3 + 11, wz * 3 - 17, worldSeed + 8923);
          if (b === BIOMES.DR_JUNGLE && fh > 0.958 && lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12) {
            const tH = 6 + (Math.abs(wx * 7 + wz * 13) % 5);
            for (let ty = 1; ty <= tH; ty++) setLocalSafe(data, lx, topH + ty, lz, B.VOID_LOG, true);
            for (let dy = -1; dy <= 2; dy++) {
              const rad = dy === 2 ? 1 : (dy <= 0 ? 3 : 2);
              for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
                if (Math.abs(dx) + Math.abs(dz) <= rad + 1) setLocalSafe(data, lx + dx, topH + tH + dy, lz + dz, B.VOID_LEAVES, false);
              }
            }
            const topT = Math.min(WORLD_H - 1, topH + tH + 3 - MIN_Y);
            if (topT > maxLy) maxLy = topT;
          } else if ((b === BIOMES.DR_PEAKS || b === BIOMES.DR_CAVERNS) && fh > 0.978) {
            const spH = 3 + (Math.abs(wx + wz) % 4);
            for (let sy = 1; sy <= spH; sy++) setLocalSafe(data, lx, topH + sy, lz, sy === spH ? B.GLOW_CRYSTAL : B.AMETHYST, true);
            const spTop = Math.min(WORLD_H - 1, topH + spH + 1 - MIN_Y);
            if (spTop > maxLy) maxLy = spTop;
          } else if (b === BIOMES.DR_PLAINS && fh > 0.985) {
            setLocalSafe(data, lx, topH + 1, lz, B.END_ROD, true);
          }
        }
      }
    }
    // End-City style Structures (Dragon Citadels, Purpur Sky Bridges, Void Crystal Shrines, Wild Dragon Nests)
    const dHub = Math.hypot(wx0 + 8, wz0 + 8), dBoss = Math.hypot(wx0 + 8, wz0 + 8 - 136);
    const sRoll = hash2i(cx * 5 + 17, cz * 5 - 29, worldSeed + 8999);
    if (dHub > 34 && dBoss > 34 && sRoll > 0.62) {
      const sKind = Math.floor(hash2i(cx, cz, worldSeed + 9011) * 4);
      const baseY = Math.max(15, getTerrainHeight(wx0 + 8, wz0 + 8, getBiomeAt(wx0 + 8, wz0 + 8)));
      if (sKind === 0) {
        // 1) Dragon Citadel Tower
        for (let dx = 4; dx <= 11; dx++) for (let dz = 4; dz <= 11; dz++) {
          setLocalSafe(data, dx, baseY, dz, B.END_STONE_BRICKS, true);
          const edge = (dx === 4 || dx === 11 || dz === 4 || dz === 11);
          const door = (dz === 4 && dx >= 7 && dx <= 8);
          for (let dy = 1; dy <= 11; dy++) {
            if (door && dy <= 3) { setLocalSafe(data, dx, baseY + dy, dz, B.AIR, true); continue; }
            if (edge || dy === 6 || dy === 11) setLocalSafe(data, dx, baseY + dy, dz, (dy % 4 === 0) ? B.PURPUR_BLOCK : B.END_STONE_BRICKS, true);
            else setLocalSafe(data, dx, baseY + dy, dz, B.AIR, true);
          }
        }
        setLocalSafe(data, 7, baseY + 1, 9, B.DIAMOND_CHEST, true);
        setLocalSafe(data, 5, baseY + 12, 5, B.END_ROD, true);
        setLocalSafe(data, 10, baseY + 12, 10, B.END_ROD, true);
        maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 13 - MIN_Y));
      } else if (sKind === 1) {
        // 2) Purpur Sky Arch Bridge
        const archY = baseY + 6;
        for (let dx = 2; dx <= 13; dx++) for (let dz = 6; dz <= 9; dz++) {
          const arcLift = Math.round(Math.sin(((dx - 2) / 11) * Math.PI) * 3);
          setLocalSafe(data, dx, archY + arcLift, dz, (dz === 6 || dz === 9) ? B.END_STONE_BRICKS : B.PURPUR_BLOCK, true);
          if ((dx === 2 || dx === 13) && (dz === 6 || dz === 9)) {
            for (let py = baseY; py <= archY + 2; py++) setLocalSafe(data, dx, py, dz, B.OBSIDIAN, true);
            setLocalSafe(data, dx, archY + 3, dz, B.END_ROD, true);
          }
        }
        maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, archY + 6 - MIN_Y));
      } else if (sKind === 2) {
        // 3) Crystal Void Sanctuary
        for (let dx = 5; dx <= 10; dx++) for (let dz = 5; dz <= 10; dz++) {
          setLocalSafe(data, dx, baseY, dz, (dx === 5 || dx === 10 || dz === 5 || dz === 10) ? B.OBSIDIAN : B.PURPUR_BLOCK, true);
        }
        for (let dy = 1; dy <= 5; dy++) setLocalSafe(data, 7, baseY + dy, 7, B.OBSIDIAN, true);
        setLocalSafe(data, 7, baseY + 6, 7, B.END_CRYSTAL_BLOCK, true);
        setLocalSafe(data, 8, baseY + 1, 7, B.GOLD_CHEST, true);
        maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 7 - MIN_Y));
      } else {
        // 4) End Dragon Nest
        for (let dx = 3; dx <= 12; dx++) for (let dz = 3; dz <= 12; dz++) {
          const r = Math.hypot(dx - 7.5, dz - 7.5);
          if (r <= 4.6) setLocalSafe(data, dx, baseY + (r > 3.1 ? 1 : 0), dz, r > 3.1 ? B.OBSIDIAN : B.END_CRYSTAL_STONE, true);
        }
        setLocalSafe(data, 7, baseY + 1, 7, B.AMETHYST, true);
        setLocalSafe(data, 8, baseY + 1, 8, B.GOLD_CHEST, true);
        maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 3 - MIN_Y));
      }
    }
    maxLy = applyChunkMods(cx, cz, data, Math.min(WORLD_H - 1, maxLy));
    const chD = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chD);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chD;
  }

  // v86: Exciting Upper-Nether Roof & Main-Cavern Structures (Bastion Citadels, Obsidian End-Crystal Obelisks, Soul-Fire Portal Shrines, Ancient Debris Vaults & Fungus Sanctuaries!)
  function stampNetherRoofAndCavernStructures(data, cx, cz, wx0, wz0, baseWy, isUpperRoof = false) {
    if (baseWy < MIN_Y + 3 || baseWy > MAX_Y - 13) return;
    const roll = hash2i(cx * 3 + (isUpperRoof ? 71 : 0), cz * 3 - (isUpperRoof ? 37 : 0), worldSeed + (isUpperRoof ? 1877 : 1831));
    // Guarantee dense, exciting landmarks across the Upper Nether Roof (~45% of chunks!) & frequent structures in the Nether Cavern
    if (roll < (isUpperRoof ? 0.54 : 0.80)) return;
    const kind = Math.floor(hash2i(cx, cz, worldSeed + (isUpperRoof ? 1889 : 1847)) * 5);
    if (kind === 0) {
      // 1) Pháo Đài Piglin Cổ Đại (Ancient Piglin Bastion Citadel w/ Gold Altar & Netherite/Gold Chest)
      for (let dz = 3; dz <= 12; dz++) for (let dx = 3; dx <= 12; dx++) {
        setLocalSafe(data, dx, baseWy, dz, ((dx + dz) & 1) ? B.DEEPSLATE : B.NETHER_BRICK, true);
        for (let dy = 1; dy <= 8; dy++) setLocalSafe(data, dx, baseWy + dy, dz, B.AIR, true);
        const edge = (dx === 3 || dx === 12 || dz === 3 || dz === 12);
        const corner = (dx <= 4 || dx >= 11) && (dz <= 4 || dz >= 11);
        const door = (dz === 3 && dx >= 7 && dx <= 8);
        if (edge) {
          for (let dy = 1; dy <= (corner ? 7 : 5); dy++) {
            if (door && dy <= 3) continue;
            if (!corner && dy === 5 && ((dx + dz) & 1)) continue; // crenellations
            setLocalSafe(data, dx, baseWy + dy, dz, corner ? B.BASALT : (dy === 3 ? B.GOLD_ORE : B.DEEPSLATE), true);
          }
        }
      }
      setLocalSafe(data, 7, baseWy + 1, 8, B.GOLD_ORE, true);
      setLocalSafe(data, 8, baseWy + 1, 8, B.GOLD_ORE, true);
      setLocalSafe(data, 7, baseWy + 2, 8, isUpperRoof ? B.NETHERITE_CHEST : B.GOLD_CHEST, true);
      setLocalSafe(data, 8, baseWy + 2, 8, B.ANCIENT_DEBRIS, true);
      setLocalSafe(data, 4, baseWy + 1, 4, B.SHROOMLIGHT, true);
      setLocalSafe(data, 11, baseWy + 1, 4, B.SHROOMLIGHT, true);
      setLocalSafe(data, 4, baseWy + 1, 11, B.CAMPFIRE, true);
      setLocalSafe(data, 11, baseWy + 1, 11, B.CAMPFIRE, true);
    } else if (kind === 1) {
      // 2) Đài Hắc Diện Thạch & Pha Lê End (Obsidian Obelisk Sanctum w/ End Crystal on top!)
      for (let dz = 4; dz <= 11; dz++) for (let dx = 4; dx <= 11; dx++) {
        setLocalSafe(data, dx, baseWy, dz, (dx === 4 || dx === 11 || dz === 4 || dz === 11) ? B.OBSIDIAN : B.SOUL_SAND, true);
        for (let dy = 1; dy <= 9; dy++) setLocalSafe(data, dx, baseWy + dy, dz, B.AIR, true);
      }
      for (const [px, pz] of [[4, 4], [11, 4], [4, 11], [11, 11]]) {
        for (let dy = 1; dy <= 5; dy++) setLocalSafe(data, px, baseWy + dy, pz, dy === 3 ? B.GLOW_CRYSTAL : B.OBSIDIAN, true);
        setLocalSafe(data, px, baseWy + 6, pz, B.FIRE, true);
      }
      for (let dy = 1; dy <= 6; dy++) {
        setLocalSafe(data, 7, baseWy + dy, 7, B.OBSIDIAN, true);
        setLocalSafe(data, 8, baseWy + dy, 7, B.OBSIDIAN, true);
        setLocalSafe(data, 7, baseWy + dy, 8, B.OBSIDIAN, true);
        setLocalSafe(data, 8, baseWy + dy, 8, B.OBSIDIAN, true);
      }
      setLocalSafe(data, 7, baseWy + 7, 7, B.END_CRYSTAL_BLOCK, true);
      setLocalSafe(data, 8, baseWy + 1, 6, B.GOLD_CHEST, true);
    } else if (kind === 2) {
      // 3) Đền Thờ Cổng Cổ Đại Bỏ Hoang (Ruined Giant Nether Portal & Lava Braziers)
      for (let dz = 4; dz <= 11; dz++) for (let dx = 4; dx <= 11; dx++) {
        setLocalSafe(data, dx, baseWy, dz, B.NETHER_BRICK, true);
        for (let dy = 1; dy <= 8; dy++) setLocalSafe(data, dx, baseWy + dy, dz, B.AIR, true);
      }
      for (let dx = 5; dx <= 10; dx++) {
        setLocalSafe(data, dx, baseWy + 1, 8, B.OBSIDIAN, true);
        if (dx >= 6 && dx <= 9) setLocalSafe(data, dx, baseWy + 7, 8, dx === 7 ? B.GLOW_CRYSTAL : B.OBSIDIAN, true);
      }
      for (let dy = 1; dy <= 7; dy++) {
        setLocalSafe(data, 5, baseWy + dy, 8, dy === 4 ? B.GLOW_CRYSTAL : B.OBSIDIAN, true);
        setLocalSafe(data, 10, baseWy + dy, 8, dy === 6 ? B.GOLD_ORE : B.OBSIDIAN, true);
      }
      setLocalSafe(data, 7, baseWy + 1, 6, B.GOLD_CHEST, true);
      setLocalSafe(data, 5, baseWy + 1, 5, B.CAMPFIRE, true);
      setLocalSafe(data, 10, baseWy + 1, 5, B.CAMPFIRE, true);
    } else if (kind === 3) {
      // 4) Tháp Rèn & Hầm Mỏ Netherite Tầng Thượng (Basalt Smithing Spire & Ancient Debris Vault)
      for (let dz = 5; dz <= 10; dz++) for (let dx = 5; dx <= 10; dx++) {
        const edge = (dx === 5 || dx === 10 || dz === 5 || dz === 10);
        setLocalSafe(data, dx, baseWy, dz, B.BASALT, true);
        for (let dy = 1; dy <= 9; dy++) {
          if (dz === 5 && (dx === 7 || dx === 8) && dy <= 3) { setLocalSafe(data, dx, baseWy + dy, dz, B.AIR, true); continue; }
          if (edge && dy <= 7) setLocalSafe(data, dx, baseWy + dy, dz, (dy === 4 || dy === 7) ? B.NETHER_BRICK : B.BASALT, true);
          else if (dy === 7) setLocalSafe(data, dx, baseWy + dy, dz, B.NETHER_BRICK, true);
          else setLocalSafe(data, dx, baseWy + dy, dz, B.AIR, true);
        }
      }
      setLocalSafe(data, 7, baseWy + 1, 8, B.SMITHING_TABLE, true);
      setLocalSafe(data, 8, baseWy + 1, 8, B.BLAST_FURNACE, true);
      setLocalSafe(data, 7, baseWy + 1, 9, B.NETHERITE_CHEST, true);
      setLocalSafe(data, 8, baseWy + 1, 9, B.ANCIENT_DEBRIS, true);
      setLocalSafe(data, 7, baseWy + 8, 7, B.SHROOMLIGHT, true);
    } else {
      // 5) Ốc Đảo Rừng Nấm Phát Sáng Tầng Thượng (Crimson & Warped Sanctuary Oasis)
      const isWarped = ((cx + cz) & 1) === 0;
      const turfId = isWarped ? B.WARPED_NYLIUM : B.CRIMSON_NYLIUM;
      const fungId = isWarped ? B.WARPED_FUNGUS : B.CRIMSON_FUNGUS;
      const rootId = isWarped ? B.WARPED_ROOTS : B.CRIMSON_ROOTS;
      for (let dz = 3; dz <= 12; dz++) for (let dx = 3; dx <= 12; dx++) {
        if (Math.hypot(dx - 7.5, dz - 7.5) > 5.2) continue;
        setLocalSafe(data, dx, baseWy, dz, turfId, true);
        for (let dy = 1; dy <= 9; dy++) setLocalSafe(data, dx, baseWy + dy, dz, B.AIR, true);
        const fh = hash2i(wx0 + dx, wz0 + dz, worldSeed + 1907);
        if (fh > 0.78) setLocalSafe(data, dx, baseWy + 1, dz, fh > 0.90 ? B.SHROOMLIGHT : fungId, false);
        else if (fh > 0.55) setLocalSafe(data, dx, baseWy + 1, dz, rootId, false);
      }
      placeLuantiTree(data, 8, baseWy + 1, 8, wx0 + 8, wz0 + 8, isWarped ? 'warped_fungus' : 'crimson_fungus');
    }
  }

  function stampNetherDinosaurFossil(data, cx, cz, wx0, wz0, baseH) {
    const kind = Math.floor(hash2i(cx, cz, worldSeed + 4139) * 3);
    const rot = Math.floor(hash2i(cz, cx, worldSeed + 4153) * 2); // 0 = X axis, 1 = Z axis
    const putBone = (rx, ry, rz) => {
      const lx = rot ? (7 + rz) : (7 + rx), lz = rot ? (7 + rx) : (7 + rz), wy = baseH + ry;
      if (lx < 1 || lx > 14 || lz < 1 || lz > 14 || wy <= WATER_LEVEL || wy >= 22) return 0;
      setLocalSafe(data, lx, wy, lz, B.BONE_BLOCK, true);
      return wy;
    };
    let topY = baseH + 4;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -3; dz <= 3; dz++) {
      if (dx * dx + dz * dz <= 20) setLocalSafe(data, 7 + dx, baseH, 7 + dz, B.SOUL_SAND, true);
    }
    if (kind === 0) {
      // Giant Dinosaur Ribcage
      for (let i = -4; i <= 4; i++) topY = Math.max(topY, putBone(i, 1, 0));
      for (const rx of [-3, -1, 1, 3]) {
        for (const s of [-1, 1]) {
          topY = Math.max(topY, putBone(rx, 1, s), putBone(rx, 2, s * 2), putBone(rx, 3, s * 2), putBone(rx, 4, s));
        }
        topY = Math.max(topY, putBone(rx, 5, 0));
      }
    } else if (kind === 1) {
      // Colossal Dinosaur Skull w/ eye sockets & snout
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        putBone(x, 1, z);
        if (Math.abs(x) <= 1 || Math.abs(z) <= 1) topY = Math.max(topY, putBone(x, 4, z));
      }
      for (const [sx, sz] of [[-2,-2],[2,-2],[-2,2],[2,2],[0,-2],[0,2]]) putBone(sx, 2, sz), putBone(sx, 3, sz);
      putBone(3, 2, 0); putBone(4, 2, 0); putBone(3, 1, -1); putBone(3, 1, 1); putBone(4, 1, 0);
      putBone(-3, 2, 0); putBone(-4, 2, 0);
    } else {
      // Half-buried Full Dinosaur Skeleton (skull + spine + 3 rib arches + tail)
      for (let i = -5; i <= 4; i++) topY = Math.max(topY, putBone(i, 1, 0));
      for (const rx of [-2, 0, 2]) {
        for (const s of [-1, 1]) topY = Math.max(topY, putBone(rx, 2, s * 2), putBone(rx, 3, s * 2), putBone(rx, 4, s));
      }
      for (let y = 1; y <= 3; y++) for (let z = -1; z <= 1; z++) topY = Math.max(topY, putBone(4, y, z));
      putBone(5, 1, 0); putBone(5, 2, 0);
    }
    return Math.min(WORLD_H - 1, topY - MIN_Y);
  }

  // Gothic Nether Castle (Lâu Đài Địa Ngục trên đảo đá Bazan/Crimson & cầu đá đen gãy bắc qua biển dung nham!)
  function stampNetherCastleInChunk(data, wx0, wz0, castle, maxLy) {
    if (!castle) return maxLy;
    const baseY = castle.baseY;
    const put = (lx, wy, lz, id) => {
      const ly = wy - MIN_Y;
      if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_W && ly >= 1 && ly < WORLD_H - 1) {
        data[(ly << 8) | (lz << 4) | lx] = id;
        if (ly > maxLy) maxLy = ly;
      }
    };
    const darkBrick = (wx, wy, wz) => {
      const h = hash3i(wx, wy, wz, worldSeed + 8901);
      return h > 0.76 ? B.BLACKSTONE : (h > 0.52 ? B.DEEPSLATE_BRICKS : B.BLACKSTONE_BRICKS);
    };
    const tealSpire = (wx, wy, wz) => {
      const h = hash3i(wx, wy, wz, worldSeed + 8917);
      return h > 0.58 ? B.COPPER_ROOF : (h > 0.25 ? B.WARPED_WART_BLOCK : B.WARPED_PLANKS);
    };
    const turrets = [
      { cx: -9, cz: 5, rad: 3, h: 14, spireH: 9 },
      { cx:  9, cz: 5, rad: 3, h: 14, spireH: 9 },
      { cx: -8, cz: -7, rad: 3, h: 16, spireH: 10 },
      { cx:  8, cz: -7, rad: 3, h: 16, spireH: 10 }
    ];

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz, dz = wz - castle.z;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, dx = wx - castle.x;
        const ax = Math.abs(dx), az = Math.abs(dz);

        // 1) Crag island rocky skirt & Crimson rim around keep (dz in [-16..14], ax <= 17)
        const islandD = Math.hypot(dx / 17.5, dz / 15.5);
        if (islandD <= 1.04) {
          const topC = colHeights[(lz << 4) | lx];
          for (let wy = MIN_Y + 3; wy <= topC; wy++) {
            const isRim = (wy === topC && islandD > 0.55);
            put(lx, wy, lz, isRim ? B.CRIMSON_NYLIUM : (wy >= topC - 2 ? B.BLACKSTONE : B.BASALT));
          }
          for (let wy = topC + 1; wy <= baseY + 28; wy++) put(lx, wy, lz, B.AIR);
        }

        // 2) Broken Blackstone Causeway Bridge jutting south over molten lava sea (dx in [-3..3], dz in [10..34])
        if (dz >= 10 && dz <= 34 && ax <= 3) {
          const breakNoise = hash2i(wx, wz, worldSeed + 8929);
          const brokenTip = (dz >= 29 && ((dz === 34 && ax < 2) ? false : (breakNoise > (34 - dz) * 0.16)));
          if (!brokenTip) {
            const brY = baseY + 1;
            for (let wy = brY + 1; wy <= brY + 8; wy++) put(lx, wy, lz, B.AIR);
            if (dz <= 30 || ax <= 1) {
              put(lx, brY, lz, ax === 0 ? B.DEEPSLATE_TILES : darkBrick(wx, brY, wz));
              put(lx, brY - 1, lz, B.BLACKSTONE);
            }
            if (ax === 3 && dz <= 31 && ((dz & 1) === 0 || dz < 26)) {
              put(lx, brY + 1, lz, (dz % 6 === 0) ? B.DEEPSLATE_BRICKS : B.DEEPSLATE_WALL);
              if (dz % 6 === 0) put(lx, brY + 2, lz, B.SOUL_LANTERN);
            }
            if (ax === 2 && (dz === 17 || dz === 25)) {
              for (let wy = MIN_Y + 2; wy < brY; wy++) put(lx, wy, lz, B.BASALT);
            }
          }
        }

        // 3) Main Gothic Fortress Keep (dx in [-11..11], dz in [-10..9])
        if (ax <= 11 && dz >= -10 && dz <= 9) {
          const inGate = (dz >= 8 && ax <= 2);
          const inHall = (ax <= 10 && dz >= -9 && dz <= 8);
          const isKeepWall = (ax === 11 || dz === -10 || dz === 9);
          put(lx, baseY, lz, ((dx + dz) & 3) === 0 ? B.BLACKSTONE : B.BLACKSTONE_BRICKS);
          put(lx, baseY - 1, lz, B.BASALT);

          if (isKeepWall) {
            const wallH = (ax === 0 || dz === -10) ? 12 : 10;
            for (let ry = 1; ry <= wallH; ry++) {
              if (inGate && ry <= 5 && !(ry === 5 && ax === 2)) continue;
              const isSlit = (ry >= 4 && ry <= 7 && ry !== 6 && ((ax === 11 && (dz & 3) === 0) || ((dz === -10 || dz === 9) && (ax === 5 || ax === 7))));
              if (isSlit) {
                put(lx, baseY + ry, lz, (ry === 5) ? B.SOUL_LANTERN : B.NETHER_FENCE);
              } else if (ry === wallH && ((dx + dz) & 1) === 0) {
                put(lx, baseY + ry, lz, B.BLACKSTONE_BRICKS);
              } else {
                put(lx, baseY + ry, lz, darkBrick(wx, baseY + ry, wz));
              }
            }
          } else if (inHall) {
            // Steep Gothic Warped-Teal Gable Roof over central hall
            const ridgeY = baseY + 11 + Math.max(0, 6 - Math.floor(ax * 0.65));
            for (let ry = 1; ry <= 19; ry++) put(lx, baseY + ry, lz, B.AIR);
            if (ax <= 9 && dz >= -9 && dz <= 7) {
              put(lx, ridgeY, lz, tealSpire(wx, ridgeY, wz));
              if (ax === 0 && (dz & 3) === 0) put(lx, baseY + 9, lz, B.SOUL_LANTERN);
            }
            // Throne dais, braziers & loot chests inside Keep
            if (ax === 4 && (dz === -4 || dz === 2)) {
              put(lx, baseY + 1, lz, B.SOUL_SAND);
              put(lx, baseY + 2, lz, B.SOUL_FIRE);
            }
            if (dz === -7 && ax <= 2) put(lx, baseY + 1, lz, B.DEEPSLATE_BRICKS);
            if (dz === -7 && dx === 0) put(lx, baseY + 2, lz, B.NETHERITE_CHEST);
            if (dz === -7 && dx === -2) put(lx, baseY + 2, lz, B.GOLD_CHEST);
            if (dz === -7 && dx === 2) put(lx, baseY + 2, lz, B.ANCIENT_DEBRIS);
          }
        }

        // 4) Four Soaring Corner Spires w/ Steep Turquoise Gothic Roofs!
        for (let ti = 0; ti < turrets.length; ti++) {
          const t = turrets[ti];
          const tdx = Math.abs(dx - t.cx), tdz = Math.abs(dz - t.cz);
          const td = Math.max(tdx, tdz);
          if (td > t.rad || (tdx === t.rad && tdz === t.rad && td >= 3)) continue;
          const tWall = (tdx === t.rad || tdz === t.rad);
          for (let ry = 1; ry <= t.h; ry++) {
            const wy = baseY + ry;
            if (wy >= MAX_Y - 1) continue;
            if (tWall) {
              const slit = (ry >= 5 && ry <= 11 && (ry % 3 !== 0) && (tdx === 0 || tdz === 0));
              put(lx, wy, lz, slit ? (ry === 8 ? B.SOUL_LANTERN : B.NETHER_FENCE) : darkBrick(wx, wy, wz));
            } else {
              put(lx, wy, lz, (ry === 6 || ry === 12) ? B.WARPED_PLANKS : B.AIR);
            }
          }
          // Pointed Steep Warped-Teal Spire Cone
          for (let sy = 0; sy < t.spireH; sy++) {
            const wy = baseY + t.h + 1 + sy;
            if (wy >= MAX_Y - 1) break;
            const sRad = Math.max(0, t.rad - Math.floor(sy / 2.2));
            if (tdx <= sRad && tdz <= sRad) {
              const isTip = (sy === t.spireH - 1 && tdx === 0 && tdz === 0);
              put(lx, wy, lz, isTip ? B.SOUL_LANTERN : tealSpire(wx, wy, wz));
            }
          }
        }
      }
    }
    return maxLy;
  }

  function _genNetherChunk(cx, cz, wx0, wz0, data) {
    if ((depthOffset || 0) !== 0) return _genDeepUndergroundChunk(cx, cz, wx0, wz0, data);
    let maxLy = WORLD_H - 1;
    if (!chunkWorkerPool.take(wx0, wz0, depthOffset || 0)) fillCoarseCaveGrid(wx0, wz0);
    let nearCastle = null;
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, biome = getBiomeAt(wx, wz), h = getTerrainHeight(wx, wz, biome);
        const ci = (lz << 4) | lx; colHeights[ci] = h; colBiomes[ci] = biome.id;
        const locCastle = getNetherCastleAnchor(wx, wz);
        if (locCastle && !nearCastle) nearCastle = locCastle;
        // Raise Nether cavern roof cleanly around castles so gothic turquoise spires stand out dramatically!
        const castleBoost = locCastle ? Math.max(0, Math.round((1 - Math.hypot(wx - locCastle.x, wz - locCastle.z) / 48) * 10)) : 0;
        const ceilY = Math.min(MAX_Y - 10, Math.floor(25 + castleBoost + valueNoise2D(wx * 0.05, wz * 0.05, worldSeed + 811) * 5));
        for (let ly = 0; ly < WORLD_H; ly++) {
          const wy = MIN_Y + ly; let id = B.AIR;
          const trueY = wy - (depthOffset || 0);
          if (trueY <= -1001 && trueY >= -1010) id = B.BEDROCK;
          else if (trueY < -1010) id = B.AIR;
          else if (wy <= h) {
            if (wy === h && h > WATER_LEVEL) {
              if (biome === BIOMES.NETHER_CRIMSON) id = B.CRIMSON_NYLIUM;
              else if (biome === BIOMES.NETHER_WARPED) id = B.WARPED_NYLIUM;
              else if (biome === BIOMES.NETHER_BASALT_DELTAS) id = (hash2i(wx, wz, worldSeed + 419) > 0.56 ? B.BLACKSTONE : B.BASALT);
              else if (biome === BIOMES.NETHER_SOUL_VALLEY) id = (hash2i(wx, wz, worldSeed + 421) > 0.25 ? B.SOUL_SAND : B.BASALT);
              else id = (hash2i(wx, wz, worldSeed + 413) > 0.68 ? B.SOUL_SAND : B.NETHERRACK);
            } else if (wy >= h - 1 && biome === BIOMES.NETHER_BASALT_DELTAS && h <= WATER_LEVEL + 1 && hash2i(wx, wz, worldSeed + 433) > 0.62) {
              id = B.MAGMA_BLOCK;
            } else if (h > WATER_LEVEL + 2 && wy < h - 5 && wy > MIN_Y + 4 && sampleCaveFast(lx, ly, lz) > 0.78) {
              id = (wy <= MIN_Y + 6) ? B.LAVA : B.AIR;
            } else {
              const oh = hash3i(wx, wy, wz, worldSeed + 777);
              id = (oh > 0.9945) ? B.GOLD_ORE : (oh > 0.9850 ? B.QUARTZ_ORE : (biome === BIOMES.NETHER_BASALT_DELTAS && oh > 0.62 ? B.BLACKSTONE : B.NETHERRACK));
            }
          } else if (wy <= WATER_LEVEL) {
            id = B.LAVA;
          } else if (wy >= ceilY) {
            if (wy === ceilY && hash2i(wx, wz, worldSeed + 515) > 0.955) id = B.SHROOMLIGHT;
            else {
              const rh = hash3i(wx, wy, wz, worldSeed + 853);
              id = rh > 0.9996 ? B.ANCIENT_DEBRIS : (rh > 0.9940 ? B.GOLD_ORE : (rh > 0.9830 ? B.QUARTZ_ORE : (rh > 0.72 ? B.BASALT : B.NETHERRACK)));
            }
          }
          data[(ly << 8) | (lz << 4) | lx] = id;
        }
        // Basalt Delta vertical volcanic pillars & Soul Sand Valley soul flames
        if (biome === BIOMES.NETHER_BASALT_DELTAS && h >= WATER_LEVEL && !locCastle && hash2i(wx, wz, worldSeed + 449) > 0.942) {
          const ph = 3 + Math.floor(hash2i(wx, wz, worldSeed + 457) * 5);
          for (let py = 1; py <= ph; py++) setLocalSafe(data, lx, h + py, lz, py === ph && hash2i(wx, wz, worldSeed + 461) > 0.7 ? B.MAGMA_BLOCK : B.BASALT, true);
        } else if (biome === BIOMES.NETHER_SOUL_VALLEY && h > WATER_LEVEL && !locCastle && hash2i(wx, wz, worldSeed + 463) > 0.972) {
          setLocalSafe(data, lx, h + 1, lz, B.SOUL_FIRE, false);
        }
        // Hanging ceiling Weeping Vines in Crimson canyons (matching Image 7)
        if (biome === BIOMES.NETHER_CRIMSON && ceilY - h > 8 && hash2i(wx, wz, worldSeed + 479) > 0.935) {
          const vLen = 2 + Math.floor(hash2i(wx, wz, worldSeed + 487) * 4);
          for (let vy = 1; vy <= vLen; vy++) setLocalSafe(data, lx, ceilY - vy, lz, B.WEEPING_VINES, false);
        }
        if (!locCastle && hash2i(wx, wz, worldSeed + 997) > 0.9974) {
          for (let wy = Math.max(WATER_LEVEL + 1, h + 1); wy <= ceilY; wy++) setLocalSafe(data, lx, wy, lz, B.LAVA, true);
        }
        if (wz >= -18 && wz <= -14) {
          const bridgeY = 12;
          const isRail = (wz === -18 || wz === -14);
          setLocalSafe(data, lx, bridgeY, lz, B.NETHER_BRICK, true);
          if (isRail) setLocalSafe(data, lx, bridgeY + 1, lz, B.NETHER_BRICK, true);
          if ((wx & 7) === 0 && isRail) {
            for (let wy = Math.max(MIN_Y + 2, h); wy < bridgeY; wy++) setLocalSafe(data, lx, wy, lz, B.NETHER_BRICK, true);
            setLocalSafe(data, lx, bridgeY + 2, lz, B.SHROOMLIGHT, true);
          }
        }
      }
    }
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const ci = (lz << 4) | lx, h = colHeights[ci], wx = wx0 + lx, biome = BIOME_LIST[colBiomes[ci]];
        if (h <= WATER_LEVEL) continue;
        if (nearCastle && Math.hypot(wx - nearCastle.x, wz - nearCastle.z) < 28) continue;
        const rf = hash2i(wx, wz, worldSeed + 613);
        if (biome === BIOMES.NETHER_CRIMSON && rf > 0.50) {
          setLocalSafe(data, lx, h + 1, lz, rf > 0.91 ? B.MUSHROOM_GLOW : (rf > 0.74 ? B.CRIMSON_FUNGUS : (rf > 0.66 ? B.WARPED_FUNGUS : B.CRIMSON_ROOTS)), false);
        } else if (biome === BIOMES.NETHER_WARPED && rf > 0.48) {
          setLocalSafe(data, lx, h + 1, lz, rf > 0.90 ? B.TWISTING_VINES : (rf > 0.84 ? B.MUSHROOM_GLOW : (rf > 0.70 ? B.WARPED_FUNGUS : (rf > 0.62 ? B.CRIMSON_ROOTS : B.WARPED_ROOTS))), false);
        } else if (biome === BIOMES.NETHER_WASTES && rf > 0.88) {
          setLocalSafe(data, lx, h + 1, lz, rf > 0.95 ? B.CRIMSON_FUNGUS : B.CRIMSON_ROOTS, false);
        }
        if (lx >= 4 && lx <= CHUNK_W - 5 && lz >= 4 && lz <= CHUNK_W - 5) {
          const rt = hash2i(wx, wz, worldSeed + 909);
          if (biome === BIOMES.NETHER_CRIMSON && rt > 0.924) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, rt > 0.962 ? 'crimson_spire' : 'crimson_fungus');
          } else if (biome === BIOMES.NETHER_WARPED && rt > 0.918) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, rt > 0.956 ? 'warped_weeping_giant' : 'warped_fungus');
          } else if ((biome === BIOMES.NETHER_BASALT_DELTAS || biome === BIOMES.NETHER_SOUL_VALLEY) && rt > 0.962) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'basalt_ember_tree');
          }
        }
      }
    }
    if (nearCastle) {
      maxLy = stampNetherCastleInChunk(data, wx0, wz0, nearCastle, maxLy);
    }
    // Stamp Nether Cavern structures on solid terrain islands away from spawn portal & castles
    const midNetherH = colHeights[(8 << 4) | 8];
    const farFromCastle = !nearCastle || Math.hypot(wx0 + 8 - nearCastle.x, wz0 + 8 - nearCastle.z) > 36;
    if (farFromCastle && midNetherH > WATER_LEVEL + 1 && midNetherH <= 13 && (Math.abs(cx) > 1 || Math.abs(cz) > 1)) {
      stampNetherRoofAndCavernStructures(data, cx, cz, wx0, wz0, midNetherH, false);
    }
    // Nether Dinosaur Fossils built out of Bone Blocks (more frequent in Soul Sand Valley!)
    const midNetherBio = BIOME_LIST[colBiomes[(8 << 4) | 8]];
    const fossilThresh = (midNetherBio === BIOMES.NETHER_SOUL_VALLEY) ? 0.74 : 0.855;
    if (farFromCastle && midNetherH > WATER_LEVEL + 1 && midNetherH <= 15 && (Math.abs(cx) > 0 || Math.abs(cz) > 0) && !(wz0 <= -10 && wz0 + 15 >= -22) && hash2i(cx, cz, worldSeed + 4129) > fossilThresh) {
      const fTop = stampNetherDinosaurFossil(data, cx, cz, wx0, wz0, midNetherH);
      if (fTop > maxLy) maxLy = fTop;
    }
    // Ancient Debris veins in Nether: ultra-rare (Minecraft Wiki), strictly buried in Netherrack at Y=8..22
    for (let v = 0; v < 2; v++) {
      if (hash2i(cx + v * 17, cz - v * 31, worldSeed + 1501) > 0.72) continue;
      const vx0 = 2 + ((hash2i(cx, v, worldSeed + 1511) * 12) | 0);
      const vz0 = 2 + ((hash2i(cz, v, worldSeed + 1523) * 12) | 0);
      const tri = (hash2i(cx + v, cz + v, worldSeed + 1531) + hash2i(cz - v, cx + v, worldSeed + 1543)) * 0.5;
      const vy0 = Math.max(8, Math.min(22, Math.round(8 + tri * 14))); // peaks around ly = 15
      const vLen = 1 + ((hash2i(vx0, vz0 + v, worldSeed + 1559) * 1.6) | 0);
      for (let s = 0; s < vLen; s++) {
        const ax = vx0 + (s === 1 ? 1 : 0), ay = vy0 + (s === 2 ? 1 : 0), az = vz0 + (s === 2 ? 1 : 0);
        if (ax < 1 || ax > 14 || az < 1 || az > 14 || ay < 6 || ay > 24) continue;
        const idx = (ay << 8) | (az << 4) | ax;
        if (data[idx] !== B.NETHERRACK) continue;
        if (IS_SOLID[data[idx + 1]] && IS_SOLID[data[idx - 1]] && IS_SOLID[data[idx + 16]] && IS_SOLID[data[idx - 16]] && IS_SOLID[data[idx + 256]] && IS_SOLID[data[idx - 256]]) {
          data[idx] = B.ANCIENT_DEBRIS;
        }
      }
    }
    maxLy = applyChunkMods(cx, cz, data, maxLy);
    const chN = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chN);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chN;
  }

  function _genWardenChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 0;
    if (!chunkWorkerPool.take(wx0, wz0, 0)) fillCoarseCaveGrid(wx0, wz0);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const b = getBiomeAt(wx, wz);
        const topH = getTerrainHeight(wx, wz, b);
        const ci = (lz << 4) | lx; colHeights[ci] = topH; colBiomes[ci] = b.id;
        const maxFillLy = Math.min(WORLD_H - 1, topH - MIN_Y);
        if (maxFillLy > maxLy) maxLy = maxFillLy;
        const sculkPatch = fbm2D(wx * 0.085, wz * 0.085, 2, 0.5, 2.0, worldSeed + 7303);
        const surfB = (b === BIOMES.WARDEN_CITADEL && sculkPatch < 0.36) ? B.DEEPSLATE_TILES : (sculkPatch > 0.44 ? B.SCULK : B.WARDEN_SCULK_STONE);
        for (let ly = 0; ly <= maxFillLy; ly++) {
          const wy = MIN_Y + ly;
          const idx = (ly << 8) | (lz << 4) | lx;
          if (wy === MIN_Y) { data[idx] = B.BEDROCK; continue; }
          if (wy < topH - 3 && wy > MIN_Y + 3 && sampleCaveFast(lx, ly, lz) > 0.72) {
            const cH = hash3i(wx, wy, wz, worldSeed + 7701);
            data[idx] = (wy === MIN_Y + 4 && cH > 0.90) ? B.SOUL_LANTERN : ((cH > 0.988 && wy < topH - 6) ? B.MUSHROOM_GLOW : B.AIR);
            continue;
          }
          if (wy === topH) {
            data[idx] = surfB;
          } else {
            const oh = hash3i(wx, wy, wz, worldSeed + 7801);
            if (wy < 10 && oh > 0.990) data[idx] = B.SOULFORGED_ORE;
            else if (wy < 16 && oh > 0.985) data[idx] = B.RESONANT_ORE;
            else if (wy < 26 && oh > 0.978) data[idx] = B.UMBRA_ORE;
            else if (wy >= topH - 2 && oh > 0.972) data[idx] = oh > 0.992 ? B.SOULFORGED_ORE : (oh > 0.984 ? B.RESONANT_ORE : B.UMBRA_ORE);
            else data[idx] = wy >= topH - 5 ? B.WARDEN_SCULK_STONE : B.DEEPSLATE;
          }
        }
        const nearPortalClear = (Math.abs(wx) <= 9 && wz >= -16 && wz <= 7);
        if (!nearPortalClear) {
          const fh = hash2i(wx * 3 + 19, wz * 3 - 23, worldSeed + 7907);
          const isForest = (b === BIOMES.WARDEN_FOREST);
          if ((isForest ? fh > 0.966 : fh > 0.988) && lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12) {
            const tH = 6 + (Math.abs(wx * 5 + wz * 11) % 5);
            for (let ty = 1; ty <= tH; ty++) setLocalSafe(data, lx, topH + ty, lz, B.SCULK_LOG, true);
            for (const [rx, rz] of [[1,0],[-1,0],[0,1],[0,-1]]) setLocalSafe(data, lx + rx, topH + 1, lz + rz, B.SCULK_LOG, true);
            for (let dy = -1; dy <= 2; dy++) {
              const rad = dy === 2 ? 1 : (dy <= 0 ? 3 : 2);
              for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
                if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue;
                setLocalSafe(data, lx + dx, topH + tH + dy, lz + dz, B.SCULK_LEAVES, false);
              }
            }
            if (fh > 0.978) setLocalSafe(data, lx + 2, topH + tH - 2, lz, B.SOUL_LANTERN, true);
            const topT = Math.min(WORLD_H - 1, (topH + tH + 3) - MIN_Y);
            if (topT > maxLy) maxLy = topT;
          } else if (fh > 0.948) setLocalSafe(data, lx, topH + 1, lz, B.SCULK_SHRIEKER, true);
          else if (fh > 0.936) setLocalSafe(data, lx, topH + 1, lz, B.SCULK_SENSOR, true);
          else if (fh > 0.928) setLocalSafe(data, lx, topH + 1, lz, B.SCULK_CATALYST, true);
          else if (fh > 0.916) setLocalSafe(data, lx, topH + 1, lz, B.MUSHROOM_GLOW, false);
        }
      }
    }
    const midH = colHeights[(8 << 4) | 8];
    const sr = hash2i(cx, cz, worldSeed + 7993);
    if (sr > 0.972 && (Math.abs(cx) > 1 || Math.abs(cz) > 1)) {
      for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
        const isWall = (dx === 2 || dx === 13 || dz === 2 || dz === 13);
        const corner = (dx === 2 || dx === 13) && (dz === 2 || dz === 13);
        setLocalSafe(data, dx, midH, dz, B.DEEPSLATE_TILES, true);
        for (let wy = 1; wy <= 9; wy++) setLocalSafe(data, dx, midH + wy, dz, B.AIR, true);
        if (isWall && !(dz === 13 && dx >= 6 && dx <= 9)) {
          for (let wy = 1; wy <= (corner ? 8 : 5); wy++) {
            setLocalSafe(data, dx, midH + wy, dz, corner ? B.REINFORCED_DEEPSLATE : B.DEEPSLATE_BRICKS, true);
          }
          if (corner) setLocalSafe(data, dx, midH + 9, dz, B.SOUL_LANTERN, true);
        }
      }
      setLocalSafe(data, 5, midH + 1, 5, B.SOUL_SAND, true); setLocalSafe(data, 5, midH + 2, 5, B.SOUL_FIRE, true);
      setLocalSafe(data, 10, midH + 1, 5, B.SOUL_SAND, true); setLocalSafe(data, 10, midH + 2, 5, B.SOUL_FIRE, true);
      setLocalSafe(data, 7, midH + 1, 8, B.GOLD_CHEST, true);
      naturalChestTags.set(modKey(wx0 + 7, midH + 1, wz0 + 8), 'ancient_city');
      const topC = Math.min(WORLD_H - 1, (midH + 10) - MIN_Y);
      if (topC > maxLy) maxLy = topC;
    }
    maxLy = applyChunkMods(cx, cz, data, maxLy);
    const chW = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chW);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chW;
  }

  function _genSiftChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 0;
    if (!chunkWorkerPool.take(wx0, wz0, 0)) fillCoarseCaveGrid(wx0, wz0);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const b = getBiomeAt(wx, wz);
        const topH = getTerrainHeight(wx, wz, b);
        const ci = (lz << 4) | lx; colHeights[ci] = topH; colBiomes[ci] = b.id;
        const isMesaPillar = (topH >= WATER_LEVEL + 9) && (b === BIOMES.SIFT_HUSKLAND || b === BIOMES.SIFT_MEADOW || b === BIOMES.SIFT_CANYON);
        const topBlock = isMesaPillar ? B.TERRACOTTA
          : (b === BIOMES.SIFT_PEAKS) ? (topH >= WATER_LEVEL + 38 ? B.SNOW : B.SIFT_STONE)
          : (b === BIOMES.SIFT_LULLABY || b === BIOMES.SIFT_LULLABY_TOP) ? B.LULLABY_GRASS
          : (b === BIOMES.SIFT_HUSKLAND || b === BIOMES.SIFT_CANYON) ? B.TERRACOTTA
          : (b === BIOMES.SIFT_SPOREFIELDS) ? B.SPORE_TURF
          : B.SIFT_GRASS;
        const cliffBlock = (isMesaPillar ? B.TERRACOTTA : ((b === BIOMES.SIFT_SPOREFIELDS || b === BIOMES.SIFT_PEAKS) ? B.SIFT_STONE : B.HUSK_SOIL));
        const maxFillLy = Math.min(WORLD_H - 1, Math.max(WATER_LEVEL, topH) - MIN_Y);
        if (maxFillLy > maxLy) maxLy = maxFillLy;
        for (let ly = 0; ly <= maxFillLy; ly++) {
          const wy = MIN_Y + ly;
          const idx = (ly << 8) | (lz << 4) | lx;
          if (wy === MIN_Y) { data[idx] = B.BEDROCK; continue; }
          if (wy > topH) { data[idx] = (wy <= WATER_LEVEL) ? B.WATER : B.AIR; continue; }
          if (wy < topH - 2 && wy > MIN_Y + 3 && sampleCaveFast(lx, ly, lz) > 0.74) {
            const caveCh = hash3i(wx, wy, wz, worldSeed + 4545);
            if (wy === MIN_Y + 4 && hash2i(wx * 5 + 3, wz * 5 - 7, worldSeed) > 0.86) data[idx] = B.SPORE_SHROOM;
            else if (caveCh > 0.992 && wy < topH - 6) data[idx] = B.GLOW_CRYSTAL;
            else if (caveCh > 0.985 && caveCh <= 0.992) data[idx] = B.MUSHROOM_GLOW;
            else data[idx] = B.AIR;
            continue;
          }
          if (wy === topH) data[idx] = (topH < WATER_LEVEL) ? (b === BIOMES.SIFT_OCEAN && hash2i(wx, wz, worldSeed + 4511) > 0.94 ? B.PRISMARINE : B.HUSK_SOIL) : topBlock;
          else if (isMesaPillar && wy >= WATER_LEVEL) data[idx] = ((wy & 3) === 0) ? B.HUSK_SOIL : B.TERRACOTTA;
          else if (wy >= topH - 3) data[idx] = cliffBlock;
          else {
            const oh = hash3i(wx, wy, wz, worldSeed);
            if (wy < 2 && oh > 0.994) data[idx] = B.DREAM_PRISM_ORE;
            else if (wy < 5 && oh > 0.990) data[idx] = B.AETHERIUM_ORE;
            else if (wy < 8 && oh > 0.986) data[idx] = B.NEBULA_ORE;
            else if (wy < 12 && oh > 0.981) data[idx] = B.ICHOR_ORE;
            else if (wy < 20 && oh > 0.974) data[idx] = B.MOONSTONE_ORE;
            else data[idx] = B.SIFT_STONE;
          }
        }
        if ((b === BIOMES.SIFT_OCEAN || b === BIOMES.SIFT_ICHOR_PONDS) && topH <= WATER_LEVEL - 4) {
          const sh = hash2i(wx, wz, worldSeed + 4611);
          if (sh > 0.975) setLocalSafe(data, lx, topH + 1, lz, B.SEA_LANTERN, false);
          else if (sh > 0.86) setLocalSafe(data, lx, topH + 1, lz, B.SEAGRASS, false);
        }
        if (topH >= WATER_LEVEL) {
          const fh = hash2i(wx * 3 + 17, wz * 3 - 29, worldSeed);
          const nearPortalClear = (Math.abs(wx) <= 9 && wz >= -16 && wz <= 7);
          const isGiantBiome = (b === BIOMES.SIFT_GIANT_FOREST);
          if (!nearPortalClear && !isMesaPillar && b !== BIOMES.SIFT_PEAKS && (fh > (isGiantBiome ? 0.964 : (b === BIOMES.SIFT_PLAINS ? 0.993 : 0.962))) && lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12) {
            if (isGiantBiome && fh > 0.982) {
              placeLuantiTree(data, lx, topH + 1, lz, wx, wz, 'sift_giant');
              const topTrG = Math.min(WORLD_H - 1, (topH + 22) - MIN_Y);
              if (topTrG > maxLy) maxLy = topTrG;
            } else {
              const isSpore = (b === BIOMES.SIFT_SPOREFIELDS);
              const isLullaby = (b === BIOMES.SIFT_LULLABY || b === BIOMES.SIFT_LULLABY_TOP);
              const treeLeaf = isSpore ? B.SPORE_TURF : (isLullaby ? B.LULLABY_LEAVES : B.SIFT_LEAVES);
              const trunkH = 5 + ((Math.abs(wx * 7 + wz * 13)) % 4);
              for (let ty = 1; ty <= trunkH; ty++) setLocalSafe(data, lx, topH + ty, lz, B.SIFT_LOG);
              for (let dy = 0; dy <= 2; dy++) {
                const rad = dy === 2 ? 1 : 2;
                for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
                  if (Math.abs(dx) === rad && Math.abs(dz) === rad && dy > 0) continue;
                  setLocalSafe(data, lx + dx, topH + trunkH + dy, lz + dz, treeLeaf);
                  if (dy === 0 && (Math.abs(dx) === rad || Math.abs(dz) === rad)) {
                    const hang = 1 + (Math.abs(wx + dx * 3 + wz + dz * 5) % 2);
                    for (let hh = 1; hh <= hang; hh++) setLocalSafe(data, lx + dx, topH + trunkH - hh, lz + dz, treeLeaf);
                  }
                }
              }
              const topTr = Math.min(WORLD_H - 1, (topH + trunkH + 3) - MIN_Y);
              if (topTr > maxLy) maxLy = topTr;
            }
          } else if (!nearPortalClear) {
            if ((b === BIOMES.SIFT_LULLABY || b === BIOMES.SIFT_LULLABY_TOP) && fh > 0.68) setLocalSafe(data, lx, topH + 1, lz, B.SIFT_FLOWER);
            else if (fh > 0.87) setLocalSafe(data, lx, topH + 1, lz, B.SIFT_FLOWER);
            else if (fh > 0.83) setLocalSafe(data, lx, topH + 1, lz, B.SIFT_BERRY_BUSH);
            else if ((b === BIOMES.SIFT_SPOREFIELDS && fh > 0.76) || fh > 0.942) setLocalSafe(data, lx, topH + 1, lz, B.SPORE_SHROOM);
          }
        }
        // Floating Sky Islands in SIFT_SKY_ISLANDS (and high Sift regions)
        const skyN = fbm2D(wx * 0.022, wz * 0.022, 2, 0.5, 2.0, worldSeed + 4977);
        const skyThresh = (b === BIOMES.SIFT_SKY_ISLANDS) ? 0.54 : 0.72;
        if (skyN > skyThresh) {
          const islY = 48 + Math.floor(hash2i(cx >> 1, cz >> 1, worldSeed + 4981) * 26);
          const depth = Math.min(9, Math.max(2, Math.round((skyN - skyThresh) * 38)));
          for (let dy = -depth; dy <= 0; dy++) {
            const bid = dy === 0 ? B.SIFT_GRASS : (dy >= -2 ? B.HUSK_SOIL : ((skyN > skyThresh + 0.14 && dy === -3 && hash2i(wx, wz, worldSeed + 4987) > 0.93) ? B.AETHERIUM_ORE : B.SIFT_STONE));
            setLocalSafe(data, lx, islY + dy, lz, bid, true);
          }
          if (hash2i(wx, wz, worldSeed + 4993) > 0.88) setLocalSafe(data, lx, islY + 1, lz, B.SIFT_FLOWER, false);
          if (skyN > skyThresh + 0.16 && lx === 8 && lz === 8) placeLuantiTree(data, 8, islY + 1, 8, wx, wz, 'sift_giant');
          const topSky = Math.min(WORLD_H - 1, (islY + 16) - MIN_Y);
          if (topSky > maxLy) maxLy = topSky;
        }
      }
    }
    // Dream Houses, Crystal Arches & Dream Boss Sanctuaries across flat Sift lands
    const midH = colHeights[(8 << 4) | 8];
    const sr = hash2i(cx, cz, worldSeed + 4909);
    if (midH >= WATER_LEVEL + 1 && midH < WATER_LEVEL + 10 && (Math.abs(cx) > 1 || Math.abs(cz) > 1)) {
      if (sr > 0.992) {
        // Grand Dream Citadel Keep (2-tier Purpur + Marble Bastion with Glowing Crystal Crown)
        for (let dz = 1; dz <= 14; dz++) for (let dx = 1; dx <= 14; dx++) {
          const isRim = (dx === 1 || dx === 14 || dz === 1 || dz === 14);
          const isGate = (dz === 14 && dx >= 6 && dx <= 9);
          setLocalSafe(data, dx, midH, dz, isRim ? B.PURPUR_PILLAR : B.MARBLE_BRICK, true);
          for (let wy = 1; wy <= 10; wy++) setLocalSafe(data, dx, midH + wy, dz, B.AIR, true);
          if (isRim && !(isGate && true)) {
            const corner = (dx === 1 || dx === 14) && (dz === 1 || dz === 14);
            for (let wy = 1; wy <= (corner ? 10 : 7); wy++) {
              const win = (!corner && wy >= 3 && wy <= 4 && (dx === 7 || dx === 8 || dz === 7 || dz === 8));
              setLocalSafe(data, dx, midH + wy, dz, win ? B.GLASS : (corner ? B.PURPUR_PILLAR : B.MARBLE_BRICK), true);
            }
            if (corner) setLocalSafe(data, dx, midH + 11, dz, B.GLOW_CRYSTAL, true);
          }
          if (dx >= 4 && dx <= 11 && dz >= 4 && dz <= 11) {
            setLocalSafe(data, dx, midH + 5, dz, B.PURPUR_BLOCK, true);
            if ((dx === 4 || dx === 11) && (dz === 4 || dz === 11)) {
              for (let wy = 6; wy <= 9; wy++) setLocalSafe(data, dx, midH + wy, dz, B.PURPUR_PILLAR, true);
              setLocalSafe(data, dx, midH + 10, dz, B.GLOW_CRYSTAL, true);
            }
          }
        }
        for (let wy = 1; wy <= 4; wy++) for (let gx = 6; gx <= 9; gx++) setLocalSafe(data, gx, midH + wy, 14, B.AIR, true);
        setLocalSafe(data, 7, midH + 1, 7, B.GOLD_CHEST, true);
        naturalChestTags.set(modKey(wx0 + 7, midH + 1, wz0 + 7), 'end_city');
        setLocalSafe(data, 8, midH + 6, 8, B.ENCHANT_TABLE, true);
        setLocalSafe(data, 7, midH + 6, 7, B.END_CRYSTAL_BLOCK, true);
        const topCit = Math.min(WORLD_H - 1, (midH + 12) - MIN_Y); if (topCit > maxLy) maxLy = topCit;
      } else if (sr > 0.985) {
        // Dream Sanctuary Arena w/ Purpur Ring, Crystal Beacon & Chest
        for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
          const d = Math.hypot(dx - 7.5, dz - 7.5);
          if (d > 6.2) continue;
          setLocalSafe(data, dx, midH, dz, d > 5.0 ? B.PURPUR_PILLAR : B.MARBLE_BRICK, true);
          for (let wy = 1; wy <= 6; wy++) setLocalSafe(data, dx, midH + wy, dz, B.AIR, true);
        }
        for (const [px, pz] of [[3, 3], [12, 3], [3, 12], [12, 12]]) {
          for (let py = 1; py <= 5; py++) setLocalSafe(data, px, midH + py, pz, py === 5 ? B.GLOW_CRYSTAL : B.PURPUR_PILLAR, true);
        }
        setLocalSafe(data, 7, midH + 1, 7, B.GOLD_CHEST, true);
        setLocalSafe(data, 8, midH + 1, 8, B.END_CRYSTAL_BLOCK, true);
        const topAr = Math.min(WORLD_H - 1, (midH + 7) - MIN_Y); if (topAr > maxLy) maxLy = topAr;
      } else if (sr > 0.968) {
        // Dream Villa Cottage
        for (let dz = 4; dz <= 11; dz++) for (let dx = 4; dx <= 11; dx++) {
          setLocalSafe(data, dx, midH, dz, B.PURPUR_BLOCK, true);
          for (let wy = 1; wy <= 6; wy++) setLocalSafe(data, dx, midH + wy, dz, B.AIR, true);
          const isW = (dx === 4 || dx === 11 || dz === 4 || dz === 11);
          if (isW && !(dx === 7 && dz === 11)) {
            for (let wy = 1; wy <= 4; wy++) setLocalSafe(data, dx, midH + wy, dz, wy === 2 && (dx === 7 || dz === 7) ? B.GLASS : (wy === 4 ? B.PURPUR_PILLAR : B.SIFT_LOG), true);
          }
          setLocalSafe(data, dx, midH + 5, dz, B.LULLABY_LEAVES, false);
        }
        setLocalSafe(data, 7, midH + 1, 11, B.BIRCH_DOOR, true);
        setLocalSafe(data, 6, midH + 1, 6, B.CHEST, true);
        setLocalSafe(data, 9, midH + 1, 6, B.ENCHANT_TABLE, true);
        setLocalSafe(data, 7, midH + 4, 7, B.SEA_LANTERN, true);
        const topDh = Math.min(WORLD_H - 1, (midH + 6) - MIN_Y); if (topDh > maxLy) maxLy = topDh;
      } else if (sr > 0.87) {
        for (let py = 1; py <= 5; py++) {
          setLocalSafe(data, 5, midH + py, 8, B.MOSS_BLOCK, true);
          setLocalSafe(data, 10, midH + py, 8, B.MOSS_BLOCK, true);
        }
        for (let px = 5; px <= 10; px++) setLocalSafe(data, px, midH + 6, 8, (px === 7 || px === 8) ? (hash2i(cx, cz, worldSeed + 71) > 0.72 ? B.DREAM_PRISM_ORE : B.GLOW_CRYSTAL) : B.SIFT_STONE, true);
        const rTop = Math.min(WORLD_H - 1, (midH + 7) - MIN_Y); if (rTop > maxLy) maxLy = rTop;
      }
    }
    maxLy = applyChunkMods(cx, cz, data, maxLy);
    const chS = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chS);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chS;
  }

  function _fillDeepUndergroundSlice(cx, cz, wx0, wz0, data, lyStart = 0, lyEnd = WORLD_H - 1) {
    const isNetherDeep = (currentDimension === 'nether');
    const sliceMinTrueY = (MIN_Y + lyStart) - depthOffset;
    const sliceMaxTrueY = (MIN_Y + lyEnd) - depthOffset;
    const _oceanFloors = new Int16Array(256);
    _oceanFloors.fill(999);
    let _allOceanCols = !isNetherDeep, _maxOceanFloor = -999;
    if (!isNetherDeep) {
      for (let lz = 0; lz < CHUNK_W; lz++) {
        const wz = wz0 + lz;
        for (let lx = 0; lx < CHUNK_W; lx++) {
          const wx = wx0 + lx, ci = (lz << 4) | lx;
          const om = getOceanMacro(wx, wz);
          if (om.isOcean) {
            const ofY = getOceanFloorTrueY(wx, wz);
            _oceanFloors[ci] = ofY;
            if (ofY > _maxOceanFloor) _maxOceanFloor = ofY;
          } else {
            _allOceanCols = false;
          }
        }
      }
      if (_allOceanCols && sliceMinTrueY > _maxOceanFloor && sliceMaxTrueY <= WATER_LEVEL) {
        data.fill(B.WATER, lyStart << 8, (lyEnd + 1) << 8);
        applyChunkMods(cx, cz, data, WORLD_H - 1);
        for (let ly = lyStart; ly <= lyEnd; ly++) {
          const trueY = (MIN_Y + ly) - depthOffset;
          if (trueY <= -1001 && trueY >= -1010) {
            const base = ly << 8;
            for (let i = 0; i < 256; i++) data[base | i] = B.BEDROCK;
          }
        }
        return true;
      }
    }
    if (!chunkWorkerPool.take(wx0, wz0, depthOffset || 0)) fillCoarseCaveGrid(wx0, wz0);
    const ugColBiomes = new Uint8Array(256);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const ci = (lz << 4) | lx;
        const oFloor = _oceanFloors[ci];
        colHeights[ci] = MAX_Y - 2; colBiomes[ci] = isNetherDeep ? BIOMES.NETHER_WASTES.id : (oFloor < 0 ? BIOMES.ABYSS_TRENCH.id : BIOMES.LUSH_GROVE.id);
        const uMid = isNetherDeep ? UNDERGROUND_BIOMES.MAGMA_CAVERN : getUndergroundBiomeAt(wx, -depthOffset, wz);
        const uTop = isNetherDeep ? UNDERGROUND_BIOMES.MAGMA_CAVERN : getUndergroundBiomeAt(wx, 24 - depthOffset, wz);
        const uBot = isNetherDeep ? UNDERGROUND_BIOMES.MAGMA_CAVERN : getUndergroundBiomeAt(wx, -28 - depthOffset, wz);
        ugColBiomes[ci] = uMid.id;
        for (let ly = lyStart; ly <= lyEnd; ly++) {
          const wy = MIN_Y + ly;
          const trueY = wy - depthOffset;
          if (!isNetherDeep && oFloor < 0) {
            if (trueY <= -1001 && trueY >= -1010) { data[(ly << 8) | ci] = B.BEDROCK; continue; }
            if (trueY > WATER_LEVEL) { data[(ly << 8) | ci] = B.AIR; continue; }
            if (trueY > oFloor) { data[(ly << 8) | ci] = B.WATER; continue; }
            if (trueY === oFloor) {
              data[(ly << 8) | ci] = oFloor > -110
                ? (hash2i(wx, wz, worldSeed + 547) > 0.45 ? B.SAND : B.STONE)
                : (oFloor > -420 ? (hash2i(wx, wz, worldSeed + 549) > 0.35 ? B.DEEPSLATE : B.PRISMARINE)
                                 : (hash2i(wx, wz, worldSeed + 557) > 0.35 ? B.BASALT : B.OBSIDIAN));
              continue;
            }
          }
          // v86: 200-block thick Nether Roof (trueY = 24..226) -> Upper Nether Roof World above trueY = 226!
          if (isNetherDeep && (trueY >= 24 || (trueY >= MIN_Y && depthOffset !== 0))) {
            if (trueY < 24) {
              const nBio = getBiomeAt(wx, wz), nh = getTerrainHeight(wx, wz, nBio);
              const ceilY = Math.floor(24 + valueNoise2D(wx * 0.05, wz * 0.05, worldSeed + 811) * 5);
              let cId = B.AIR;
              if (trueY <= MIN_Y) cId = B.BEDROCK;
              else if (trueY <= nh) {
                if (trueY === nh && nh > WATER_LEVEL) cId = nBio === BIOMES.NETHER_CRIMSON ? B.CRIMSON_NYLIUM : (nBio === BIOMES.NETHER_WARPED ? B.WARPED_NYLIUM : B.NETHERRACK);
                else cId = B.NETHERRACK;
              } else if (trueY <= WATER_LEVEL) cId = B.LAVA;
              else if (trueY >= ceilY) cId = B.NETHERRACK;
              data[(ly << 8) | (lz << 4) | lx] = cId;
              continue;
            }
            const roofSurfY = 226 + Math.floor(valueNoise2D(wx * 0.04, wz * 0.04, worldSeed + 881) * 3);
            let nId = B.AIR;
            if (trueY > roofSurfY) {
              nId = B.AIR;
            } else if (trueY === roofSurfY) {
              const nBio = getBiomeAt(wx, wz);
              nId = nBio === BIOMES.NETHER_CRIMSON ? B.CRIMSON_NYLIUM : (nBio === BIOMES.NETHER_WARPED ? B.WARPED_NYLIUM : ((hash2i(wx, wz, worldSeed + 883) > 0.45) ? B.BASALT : B.NETHERRACK));
            } else if (trueY < roofSurfY - 3 && trueY > 32 && sampleCaveFast(lx, ly, lz) > 0.83) {
              nId = B.AIR;
            } else {
              const oreH = hash3i(wx, trueY, wz, seedMix.s1 + 777);
              const rockH = hash3i(wx, trueY, wz, seedMix.s1 + 353);
              nId = rockH > 0.68 ? B.BASALT : (rockH > 0.54 ? B.DEEPSLATE : B.NETHERRACK);
              if (oreH > 0.9994) nId = B.ANCIENT_DEBRIS;
              else if (oreH > 0.9942) nId = B.GOLD_ORE;
              else if (oreH > 0.9850) nId = B.QUARTZ_ORE;
            }
            data[(ly << 8) | (lz << 4) | lx] = nId;
            continue;
          }
          const uBio = isNetherDeep ? UNDERGROUND_BIOMES.MAGMA_CAVERN : (wy > 8 ? uTop : (wy < -16 ? uBot : uMid));
          const caveThresh = uBio === UNDERGROUND_BIOMES.CRYSTAL_CAVERN ? 0.66
            : (uBio === UNDERGROUND_BIOMES.LUSH_CAVE ? 0.67
            : (uBio === UNDERGROUND_BIOMES.MAGMA_CAVERN ? 0.68
            : (uBio === UNDERGROUND_BIOMES.DRIPSTONE_CAVE ? 0.70 : 0.69)));
          let id = isNetherDeep ? B.NETHERRACK : B.DEEPSLATE;
          if (trueY <= -1001 && trueY >= -1010) {
            id = B.BEDROCK;
          } else if (trueY < -1010) {
            id = B.AIR;
          } else if (trueY <= -999 && trueY > -1001) {
            id = uBio === UNDERGROUND_BIOMES.MAGMA_CAVERN ? B.BASALT : (uBio === UNDERGROUND_BIOMES.LUSH_CAVE ? B.MOSS_BLOCK : B.DEEPSLATE);
          } else if (trueY > -998 && sampleCaveFast(lx, ly, lz) > caveThresh) {
            // Solid-bottomed cave pools resting on trueY bedrock floor (NEVER modular fake sheets!)
            if (uBio === UNDERGROUND_BIOMES.MAGMA_CAVERN && trueY <= -940) id = B.LAVA;
            else if (uBio === UNDERGROUND_BIOMES.ICE_CAVERN && trueY <= -960 && hash3i(wx, trueY, wz, seedMix.s1 + 613) > 0.72) id = B.ICE;
            else id = B.AIR;
          } else {
            const oreH = hash3i(wx, trueY, wz, seedMix.s1 + 777);
            const rockH = hash3i(wx, trueY, wz, seedMix.s1 + 353);
            if (isNetherDeep) {
              id = rockH > 0.72 ? B.BASALT : (rockH > 0.56 ? B.SOUL_SAND : B.NETHERRACK);
              if (oreH > 0.9994) id = B.ANCIENT_DEBRIS;
              else if (oreH > 0.9945) id = B.GOLD_ORE;
              else if (oreH > 0.9855) id = B.QUARTZ_ORE;
            } else {
              if (uBio === UNDERGROUND_BIOMES.MAGMA_CAVERN) id = rockH > 0.52 ? B.BASALT : (rockH > 0.22 ? B.NETHERRACK : B.DEEPSLATE);
              else if (uBio === UNDERGROUND_BIOMES.ICE_CAVERN) id = rockH > 0.58 ? B.PACKED_ICE : (rockH > 0.36 ? B.STONE : B.DEEPSLATE);
              else if (uBio === UNDERGROUND_BIOMES.CRYSTAL_CAVERN) id = rockH > 0.72 ? B.PRISMARINE : (rockH > 0.48 ? B.BASALT : B.DEEPSLATE);
              else if (uBio === UNDERGROUND_BIOMES.DRIPSTONE_CAVE) id = rockH > 0.55 ? B.STONE : (rockH > 0.30 ? B.SMOOTH_STONE : B.TERRACOTTA);
              else if (uBio === UNDERGROUND_BIOMES.DEEP_DARK) id = rockH > 0.80 ? B.OBSIDIAN : (rockH > 0.64 ? B.BASALT : B.DEEPSLATE);
              else if (uBio === UNDERGROUND_BIOMES.GLOWSHROOM_GROTTO) id = rockH > 0.65 ? B.MUD : B.DEEPSLATE;
              else id = rockH > 0.55 ? B.STONE : B.DEEPSLATE;
              if (trueY <= -760 && oreH > 0.84) id = B.NETHERRACK;
              else if (oreH > 0.9982) id = B.DIAMOND_ORE;
              else if (oreH > 0.9970) id = (uBio === UNDERGROUND_BIOMES.MAGMA_CAVERN || uBio === UNDERGROUND_BIOMES.DEEP_DARK) ? B.RUBY_ORE : B.DEEPSLATE;
              else if (oreH > 0.9950) id = uBio === UNDERGROUND_BIOMES.CRYSTAL_CAVERN ? B.LAPIS_ORE : (uBio === UNDERGROUND_BIOMES.LUSH_CAVE ? B.EMERALD_ORE : B.GOLD_ORE);
              else if (oreH > 0.9922) id = uBio === UNDERGROUND_BIOMES.DRIPSTONE_CAVE ? B.COPPER_ORE : B.REDSTONE_ORE;
              else if (oreH > 0.9912 && uBio === UNDERGROUND_BIOMES.CRYSTAL_CAVERN) id = B.GLOW_CRYSTAL;
              else if (oreH > 0.9825) id = uBio === UNDERGROUND_BIOMES.ICE_CAVERN ? B.TIN_ORE : B.IRON_ORE;
              else if (oreH > 0.9735) id = B.COAL_ORE;
            }
          }
          data[(ly << 8) | (lz << 4) | lx] = id;
        }
      }
    }
    const decStart = Math.max(2, lyStart), decEnd = Math.min(WORLD_H - 3, lyEnd);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const ci = (lz << 4) | lx;
        const uId = isNetherDeep ? UNDERGROUND_BIOMES.MAGMA_CAVERN.id : ugColBiomes[ci];
        const oFloor = _oceanFloors[ci];
        if (!isNetherDeep && oFloor < 0 && oFloor >= ((MIN_Y + decStart) - depthOffset) - 2 && oFloor <= ((MIN_Y + decEnd) - depthOffset)) {
          const sly = (oFloor + 1 + depthOffset) - MIN_Y;
          if (sly >= decStart && sly <= decEnd - 5 && data[(sly << 8) | ci] === B.WATER) {
            const rc = hash2i(wx, wz, worldSeed + 787);
            if (oFloor <= -450) {
              if (rc > 0.985) { data[(sly << 8) | ci] = B.BASALT; data[((sly + 1) << 8) | ci] = rc > 0.992 ? B.LAVA : B.SEA_LANTERN; }
              else if (rc > 0.990) data[(sly << 8) | ci] = B.GLOW_CRYSTAL;
            } else if (oFloor <= -160) {
              if (rc > 0.986) data[(sly << 8) | ci] = rc > 0.992 ? B.SEA_LANTERN : B.GLOW_CRYSTAL;
            } else if (rc > 0.89) {
              const cId = rc > 0.96 ? B.CORAL_GOLD : (rc > 0.92 ? B.CORAL_PINK : B.CORAL_BLUE);
              data[(sly << 8) | ci] = cId;
            } else if (rc > 0.72) {
              const kH = 2 + ((hash2i(wx + 3, wz + 9, worldSeed + 793) * 5) | 0);
              for (let ky = 0; ky < kH && (sly + ky) < decEnd; ky++) {
                const kIdx = ((sly + ky) << 8) | ci;
                if (data[kIdx] === B.WATER) data[kIdx] = B.SEAGRASS;
              }
            }
          }
        }
        for (let ly = decStart; ly <= decEnd; ly++) {
          const wy = MIN_Y + ly;
          const trueY = wy - depthOffset;
          if (!isNetherDeep && oFloor < 0 && trueY > oFloor) continue;
          const i = (ly << 8) | ci;
          if (data[i] !== B.AIR) continue;
          const below = ((ly - 1) << 8) | (lz << 4) | lx;
          const above = ((ly + 1) << 8) | (lz << 4) | lx;
          const solidBelow = IS_SOLID[data[below]] === 1 && data[below] !== B.BEDROCK;
          const solidAbove = IS_SOLID[data[above]] === 1 && data[above] !== B.BEDROCK;
          if (solidBelow) {
            const fh = hash3i(wx, trueY, wz, seedMix.s1 + 419);
            if (uId === UNDERGROUND_BIOMES.LUSH_CAVE.id) {
              data[below] = B.MOSS_BLOCK;
              if (fh > 0.90) data[i] = B.MUSHROOM_GLOW;
              else if (fh > 0.72) data[i] = B.FERN;
              else if (fh > 0.65) data[i] = B.FLOWER_YELLOW;
              else if (fh < 0.14 && ly >= 4 && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
                const subBelow = ((ly - 2) << 8) | (lz << 4) | lx;
                if (IS_SOLID[data[subBelow]] === 1 && IS_SOLID[data[below + 1]] === 1 && IS_SOLID[data[below - 1]] === 1 && IS_SOLID[data[below + 16]] === 1 && IS_SOLID[data[below - 16]] === 1) {
                  data[below] = B.WATER; data[i] = B.LILY_PAD;
                }
              }
            } else if (uId === UNDERGROUND_BIOMES.CRYSTAL_CAVERN.id) {
              if (fh > 0.968) {
                data[i] = B.GLOW_CRYSTAL;
                if (fh > 0.990 && ly + 1 <= decEnd && data[above] === B.AIR) data[above] = B.GLOW_CRYSTAL;
              } else if (fh < 0.06) data[below] = B.SEA_LANTERN;
            } else if (uId === UNDERGROUND_BIOMES.DRIPSTONE_CAVE.id) {
              if (fh > 0.90) {
                const sLen = 1 + Math.floor(hash2i(wx, wz, seedMix.s1 + 431) * 3);
                for (let d = 0; d < sLen && (ly + d) <= decEnd; d++) {
                  const idxS = ((ly + d) << 8) | (lz << 4) | lx;
                  if (data[idxS] !== B.AIR) break;
                  data[idxS] = d === sLen - 1 ? B.STONE_WALL : B.SMOOTH_STONE;
                }
              }
            } else if (uId === UNDERGROUND_BIOMES.GLOWSHROOM_GROTTO.id) {
              data[below] = B.MYCELIUM;
              if (fh > 0.86) data[i] = B.MUSHROOM_GLOW;
              else if (fh < 0.025 && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13 && ly + 5 <= decEnd) {
                for (let mh = 0; mh < 4; mh++) setLocalSafe(data, lx, wy + mh, lz, B.MUSHROOM_STEM, true);
                for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) setLocalSafe(data, lx + dx, wy + 4, lz + dz, (dx === 0 && dz === 0) ? B.SHROOMLIGHT : B.MUSHROOM_RED_CAP, true);
              }
            } else if (uId === UNDERGROUND_BIOMES.ICE_CAVERN.id) {
              if (fh > 0.55) data[below] = B.PACKED_ICE;
              else if (fh < 0.16) data[below] = B.SNOW;
              if (fh > 0.94) data[i] = B.SEA_LANTERN;
            } else if (uId === UNDERGROUND_BIOMES.DEEP_DARK.id) {
              data[below] = B.SCULK;
              if (fh > 0.968) data[i] = B.SCULK_SHRIEKER;
              else if (fh > 0.935) data[i] = B.SCULK_SENSOR;
              else if (fh > 0.895) data[below] = B.SCULK_CATALYST;
              else if (fh > 0.62) data[i] = B.SCULK_VEIN;
            } else if (uId === UNDERGROUND_BIOMES.MAGMA_CAVERN.id) {
              if (fh > 0.93) data[below] = B.SHROOMLIGHT;
              else if (fh < 0.12) data[below] = B.OBSIDIAN;
            }
          } else if (solidAbove) {
            const ch = hash3i(wx, trueY, wz, seedMix.s1 + 617);
            if (uId === UNDERGROUND_BIOMES.LUSH_CAVE.id && ch > 0.78) {
              data[above] = B.MOSS_BLOCK;
              const vLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 619) * 5);
              for (let d = 0; d < vLen && (ly - d) >= decStart; d++) {
                const idxV = ((ly - d) << 8) | (lz << 4) | lx;
                if (data[idxV] !== B.AIR) break;
                data[idxV] = B.GLOW_VINES;
              }
            } else if (uId === UNDERGROUND_BIOMES.CRYSTAL_CAVERN.id && ch > 0.974) {
              const cLen = 1 + Math.floor(hash2i(wx, wz, seedMix.s1 + 631) * 2);
              for (let d = 0; d < cLen && (ly - d) >= decStart; d++) {
                const idxC = ((ly - d) << 8) | (lz << 4) | lx;
                if (data[idxC] !== B.AIR) break;
                data[idxC] = B.GLOW_CRYSTAL;
              }
            } else if (uId === UNDERGROUND_BIOMES.DRIPSTONE_CAVE.id && ch > 0.87) {
              const sLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 641) * 4);
              for (let d = 0; d < sLen && (ly - d) >= decStart; d++) {
                const idxS = ((ly - d) << 8) | (lz << 4) | lx;
                if (data[idxS] !== B.AIR) break;
                data[idxS] = d >= sLen - 2 ? B.STONE_WALL : B.STONE;
              }
            } else if (uId === UNDERGROUND_BIOMES.ICE_CAVERN.id && ch > 0.85) {
              const iLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 647) * 4);
              for (let d = 0; d < iLen && (ly - d) >= decStart; d++) {
                const idxI = ((ly - d) << 8) | (lz << 4) | lx;
                if (data[idxI] !== B.AIR) break;
                data[idxI] = B.ICE;
              }
            } else if (uId === UNDERGROUND_BIOMES.MAGMA_CAVERN.id && ch > 0.94) {
              data[i] = B.SHROOMLIGHT;
            }
          }
        }
      }
    }
    if (!isNetherDeep && !(_allOceanCols && (MAX_Y - depthOffset) > _maxOceanFloor - 8)) {
      generateUndergroundStructures(data, cx, cz, wx0, wz0, depthOffset, MAX_Y - 2, lyStart, lyEnd);
    }
    if (!isNetherDeep && typeof stampStrongholdCitadelInChunk === 'function') {
      stampStrongholdCitadelInChunk(data, wx0, wz0, depthOffset || 0, WORLD_H - 1);
    }
    if (!isNetherDeep && typeof stampAncientCityInChunk === 'function') {
      stampAncientCityInChunk(data, wx0, wz0, depthOffset || 0, WORLD_H - 1);
    }
    if (isNetherDeep && depthOffset <= -160) {
      const roofMidTrueY = 226 + Math.floor(valueNoise2D((wx0 + 8) * 0.04, (wz0 + 8) * 0.04, worldSeed + 881) * 3);
      const roofWy = roofMidTrueY + depthOffset;
      const roofLy = roofWy - MIN_Y;
      if (roofLy >= lyStart && roofLy <= lyEnd) {
        // Populate Upper Nether Roof flora & structures!
        for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
          const wx = wx0 + lx, wz = wz0 + lz;
          const rTrueY = 226 + Math.floor(valueNoise2D(wx * 0.04, wz * 0.04, worldSeed + 881) * 3);
          const rWy = rTrueY + depthOffset;
          const rf = hash2i(wx, wz, worldSeed + 1913);
          if (rf > 0.80) setLocalSafe(data, lx, rWy + 1, lz, rf > 0.94 ? B.WARPED_FUNGUS : (rf > 0.87 ? B.CRIMSON_FUNGUS : B.CRIMSON_ROOTS), false);
        }
        stampNetherRoofAndCavernStructures(data, cx, cz, wx0, wz0, roofWy, true);
      }
    }
    applyChunkMods(cx, cz, data, WORLD_H - 1);
    for (let ly = lyStart; ly <= lyEnd; ly++) {
      const trueY = (MIN_Y + ly) - depthOffset;
      if (trueY <= -1001 && trueY >= -1010) {
        const base = ly << 8;
        for (let i = 0; i < 256; i++) data[base | i] = B.BEDROCK;
      } else if (trueY >= -1000 && trueY <= -980) {
        const base = ly << 8, repId = isNetherDeep ? B.NETHERRACK : B.DEEPSLATE;
        for (let i = 0; i < 256; i++) if (data[base | i] === B.BEDROCK) data[base | i] = repId;
      }
    }
    return _allOceanCols && (sliceMinTrueY > _maxOceanFloor);
  }

  function _genDeepUndergroundChunk(cx, cz, wx0, wz0, data) {
    const _pureOcean = !!_fillDeepUndergroundSlice(cx, cz, wx0, wz0, data, 0, WORLD_H - 1);
    const chD = { cx, cz, data, maxLy: WORLD_H - 1, isOceanChunk: _pureOcean, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chD);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chD;
  }

  function _genCityChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 0;
    const streetY = 2;
    const gx = ((cx % 3) + 3) % 3, gz = ((cz % 3) + 3) % 3;
    const isRoadX = (gx === 0), isRoadZ = (gz === 0);
    const isBoulevard = (isRoadX || isRoadZ);
    const lotR = hash2i(cx, cz, worldSeed + 2025);
    const facadeR = hash2i(cx + 7, cz - 11, worldSeed + 2099);
    let skyscraperSpec = null;

    // 1) Base Foundation & Street Grid (3x3 super-block boulevards + sidewalks + overgrown cracks)
    for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
      const wx = wx0 + lx, wz = wz0 + lz;
      colHeights[(lz << 4) | lx] = streetY; colBiomes[(lz << 4) | lx] = BIOMES.ABANDONED_CITY.id;
      for (let wy = MIN_Y; wy <= streetY; wy++) {
        let bid = B.STONE;
        const trueY = wy - (depthOffset || 0);
        if (trueY <= -1001 && trueY >= -1010) bid = B.BEDROCK;
        else if (wy === streetY) {
          if (isBoulevard) {
            const sideX = isRoadX && (lx <= 1 || lx >= 14);
            const sideZ = isRoadZ && (lz <= 1 || lz >= 14);
            const onSidewalk = (isRoadX && isRoadZ) ? (sideX && sideZ) : (sideX || sideZ);
            if (onSidewalk) {
              const rSw = hash2i(wx, wz, worldSeed + 2027);
              bid = rSw > 0.86 ? B.GRASS : (rSw > 0.65 ? B.CRACKED_CONCRETE : (rSw > 0.35 ? B.SMOOTH_STONE : B.CONCRETE));
            } else {
              const onMedian = ((isRoadX && !isRoadZ && lx >= 7 && lx <= 8 && lz >= 2 && lz <= 13)
                || (isRoadZ && !isRoadX && lz >= 7 && lz <= 8 && lx >= 2 && lx <= 13));
              if (onMedian) {
                bid = hash2i(wx, wz, worldSeed + 2028) > 0.35 ? B.GRASS : B.MOSS_BLOCK;
              } else {
                const isLaneMark = (isRoadX && !isRoadZ && (lx === 4 || lx === 11) && (wz & 3) < 2)
                  || (isRoadZ && !isRoadX && (lz === 4 || lz === 11) && (wx & 3) < 2);
                const crack = hash2i(wx, wz, worldSeed + 2029);
                if (crack > 0.89) bid = B.CRACKED_CONCRETE;
                else if (crack > 0.83) bid = B.GRAVEL;
                else if (crack > 0.78) bid = B.AUTUMN_PODZOL;
                else bid = isLaneMark ? B.ROAD_LINE : B.ASPHALT;
              }
            }
          } else {
            const isPlotWalk = (lx === 0 || lx === 15 || lz === 0 || lz === 15);
            if (isPlotWalk) bid = hash2i(wx, wz, worldSeed + 2030) > 0.75 ? B.CRACKED_CONCRETE : B.SMOOTH_STONE;
            else if (lotR >= 0.74 && lotR < 0.88) bid = hash2i(wx, wz, worldSeed + 2031) > 0.32 ? B.GRASS : B.STONE_BRICK;
            else bid = hash2i(wx, wz, worldSeed + 2032) > 0.72 ? B.STONE_BRICK : B.CONCRETE;
          }
        }
        data[((wy - MIN_Y) << 8) | (lz << 4) | lx] = bid;
      }
      if (isBoulevard) {
        const rf = hash2i(wx, wz, worldSeed + 2033);
        const surfB = data[((streetY - MIN_Y) << 8) | (lz << 4) | lx];
        if ((surfB === B.GRASS || surfB === B.MOSS_BLOCK) && rf > 0.45) {
          setLocalSafe(data, lx, streetY + 1, lz, rf > 0.82 ? B.WILD_TALL_GRASS : (rf > 0.65 ? B.FERN : B.TALL_GRASS), false);
        } else if ((surfB === B.CRACKED_CONCRETE || surfB === B.AUTUMN_PODZOL) && rf > 0.74) {
          setLocalSafe(data, lx, streetY + 1, lz, rf > 0.88 ? B.FERN : B.TALL_GRASS, false);
        }
      }
    }

    if (isBoulevard) {
      // 2A) Boulevard Overgrown Median Trees, Modern White L-Streetlamps & Wrecked Abandoned Cars!
      const isCross = (isRoadX && isRoadZ);
      if (!isCross) {
        // Tall weeping boulevard tree anchored in central green median
        if (isRoadX) {
          placeLuantiTree(data, 7, streetY + 1, 7, wx0 + 7, wz0 + 7, lotR > 0.45 ? 'canopy_jungle' : 'ancient_vine_tree');
        } else {
          placeLuantiTree(data, 7, streetY + 1, 7, wx0 + 7, wz0 + 7, lotR > 0.45 ? 'canopy_jungle' : 'ancient_vine_tree');
        }
        // Modern White/Pale L-Shaped Streetlamps on both sidewalks (Images 3 & 6!)
        const lampPos = isRoadX ? [[1, 4, 1], [14, 11, -1]] : [[4, 1, 1], [11, 14, -1]];
        for (const [sx, sz, dir] of lampPos) {
          for (let wy = 1; wy <= 6; wy++) setLocalSafe(data, sx, streetY + wy, sz, wy <= 4 ? B.STONE_WALL : B.CONCRETE, true);
          const armX = isRoadX ? sx + dir : sx, armZ = isRoadX ? sz : sz + dir;
          const tipX = isRoadX ? sx + dir * 2 : sx, tipZ = isRoadX ? sz : sz + dir * 2;
          setLocalSafe(data, armX, streetY + 6, armZ, B.CONCRETE, true);
          setLocalSafe(data, tipX, streetY + 6, tipZ, B.CONCRETE, true);
          setLocalSafe(data, tipX, streetY + 5, tipZ, B.SEA_LANTERN, true);
        }
        // Wrecked Abandoned Car on side lane (only when lotR > 0.34 so lanes stay navigable)
        if (lotR > 0.34) {
          const carPal = [B.RED_WOOL, B.BLUE_WOOL, B.GRAY_WOOL, B.CONCRETE];
          const bodyB = carPal[Math.floor(facadeR * carPal.length) % carPal.length];
          if (isRoadX) {
            const cx0 = 3, cz0 = 3;
            for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 2; dx++) {
              setLocalSafe(data, cx0 + dx, streetY + 1, cz0 + dz, (dz === 0 || dz === 3) ? B.DEEPSLATE : bodyB, true);
              if (dz === 1 || dz === 2) setLocalSafe(data, cx0 + dx, streetY + 2, cz0 + dz, B.GLASS, true);
            }
            setLocalSafe(data, cx0, streetY + 2, cz0, B.OAK_LEAVES, false);
          } else {
            const cx0 = 3, cz0 = 11;
            for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 2; dz++) {
              setLocalSafe(data, cx0 + dx, streetY + 1, cz0 + dz, (dx === 0 || dx === 3) ? B.DEEPSLATE : bodyB, true);
              if (dx === 1 || dx === 2) setLocalSafe(data, cx0 + dx, streetY + 2, cz0 + dz, B.GLASS, true);
            }
            setLocalSafe(data, cx0, streetY + 2, cz0, B.OAK_LEAVES, false);
          }
        }
      }
      maxLy = Math.min(WORLD_H - 1, (streetY + 20) - MIN_Y);
    } else if (lotR < 0.76) {
      // 2B) 100% Real Collidable Voxel Modern Skyscrapers & Non-Repeating Architectural Styles (WORLD_H = 256, MAX_Y = 207)
      const bHash = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ worldSeed) >>> 0;
      const archType = bHash % 8;
      const isSkyscraper = (archType < 5);
      const wallMats = [B.CONCRETE, B.DEEPSLATE, B.MARBLE_BRICK, B.TERRACOTTA, B.SMOOTH_STONE];
      const wallB = wallMats[(bHash >> 3) % wallMats.length];
      const slabB = (archType & 1) ? B.CONCRETE : B.SMOOTH_STONE;
      const trimB = (archType === 3) ? B.MUD_BRICK : B.CRACKED_CONCRETE;
      const baseSpan = isSkyscraper ? (44 + (bHash % 136)) : (18 + (bHash % 24));
      const topH = Math.min(MAX_Y - 12, streetY + baseSpan);
      const stepY1 = streetY + Math.floor(baseSpan * 0.55);
      const stepY2 = streetY + Math.floor(baseSpan * 0.80);

      for (let wy = streetY + 1; wy <= topH; wy++) {
        const fl = (wy - streetY) % 4;
        const inset = (archType === 0 && wy > stepY2) ? 2 : ((archType === 1 && wy > stepY1) ? 1 : 0);
        const aLo = 1 + inset, aHi = 14 - inset;
        const isRoof = (wy === topH);
        for (let lz = aLo; lz <= aHi; lz++) for (let lx = aLo; lx <= aHi; lx++) {
          const isEdge = (lx === aLo || lx === aHi || lz === aLo || lz === aHi);
          const isCorner = (lx === aLo || lx === aHi) && (lz === aLo || lz === aHi);
          if (archType === 2 && isCorner) continue; // Chamfered diagonal modern tower
          if (archType === 5 && lx > 9 && lz > 9) continue; // L-wing apartment
          const isDoor = (wy <= streetY + 3 && (((lz === aLo || lz === aHi) && lx >= 7 && lx <= 8) || ((lx === aLo || lx === aHi) && lz >= 7 && lz <= 8)));
          if (isDoor) continue;
          const dmg = hash3i(wx0 + lx, wy, wz0 + lz, worldSeed + 2051);
          if (!isRoof && !isCorner && dmg > 0.93) continue;
          let bid = B.AIR;
          if (isRoof) {
            if (isEdge) bid = B.STONE_WALL;
            else if (archType === 2 && ((lx >= 6 && lx <= 9) && (lz === 6 || lz === 9) || ((lx === 6 || lx === 9) && lz >= 6 && lz <= 9))) bid = B.ROAD_LINE;
            else bid = (dmg > 0.82 && archType === 7) ? B.MOSS_BLOCK : slabB;
          } else if (isCorner) {
            bid = wallB;
          } else if (isEdge) {
            const onMullion = ((lx === aLo || lx === aHi) ? ((lz - aLo) % 3 === 0) : ((lx - aLo) % 3 === 0));
            if (fl === 0) bid = (archType === 7 && dmg > 0.55) ? trimB : slabB;
            else if (onMullion) bid = wallB;
            else bid = (archType === 7 && dmg > 0.55) ? B.BROKEN_GLASS : B.GLASS;
          } else if (fl === 0) {
            const nearWall = (lx <= aLo + 2 || lx >= aHi - 2 || lz <= aLo + 2 || lz >= aHi - 2);
            if ((!isSkyscraper || nearWall) || (wy === stepY1 || wy === stepY2)) bid = slabB;
          }
          if (bid !== B.AIR) data[((wy - MIN_Y) << 8) | (lz << 4) | lx] = bid;
        }
      }
      // Solid Rooftop Details (Parapet Lanterns, AC Units/Water Tank, Spire or Rooftop Trees!)
      setLocalSafe(data, 6, topH + 1, 6, B.IRON_CHEST, true);
      setLocalSafe(data, 9, topH + 1, 9, B.SEA_LANTERN, true);
      if (isSkyscraper && archType <= 2) {
        for (let ay = 1; ay <= 6; ay++) setLocalSafe(data, 7, topH + ay, 7, ay === 6 ? B.SEA_LANTERN : B.RUST_STEEL, true);
      } else {
        placeLuantiTree(data, 8, topH + 1, 8, wx0 + 8, wz0 + 8, archType === 4 ? 'sakura' : 'apple');
      }

      // Ground lobby details + working Express Elevator Shaft up to real solid topH!
      setLocalSafe(data, 4, streetY + 1, 4, B.PLANKS, true);
      setLocalSafe(data, 3, streetY + 1, 11, B.CHEST, true);
      setLocalSafe(data, 11, streetY + 1, 4, B.LANTERN, true);
      if (isSkyscraper) {
        setLocalSafe(data, 12, streetY + 1, 12, B.ELEVATOR_BLOCK, true);
        setLocalSafe(data, 12, topH, 12, B.ELEVATOR_BLOCK, true);
        skyscraperSpec = { wx0: wx0 + 1, wz0: wz0 + 1, w: 14, d: 14, topH };
      }

      // Cascading green foliage rivers on overgrown ruin lots
      if (archType >= 6) {
        for (let wy = streetY + 3; wy <= topH; wy++) {
          for (const [lx, lz] of [[1, 3], [14, 5], [4, 1], [11, 14]]) {
            if (Math.sin(wy * 0.24 + (lx + lz) * 0.45 + facadeR * 6.0) > 0.34) {
              data[((wy - MIN_Y) << 8) | (lz << 4) | lx] = hash3i(wx0 + lx, wy, wz0 + lz, worldSeed + 2059) > 0.45 ? B.OAK_LEAVES : B.MANGROVE_LEAVES;
            }
          }
        }
      }
      maxLy = Math.min(WORLD_H - 1, (topH + 9) - MIN_Y);
    } else if (lotR < 0.88) {
      // 2C) Overgrown Urban Park / Plaza
      placeLuantiTree(data, 6, streetY + 1, 6, wx0 + 6, wz0 + 6, 'ancient_vine_tree');
      placeLuantiTree(data, 11, streetY + 1, 11, wx0 + 11, wz0 + 11, 'apple');
      for (let lz = 2; lz <= 13; lz++) for (let lx = 2; lx <= 13; lx++) {
        const rf = hash2i(wx0 + lx, wz0 + lz, worldSeed + 2061);
        if (rf > 0.56) setLocalSafe(data, lx, streetY + 1, lz, rf > 0.90 ? B.FLOWER_YELLOW : (rf > 0.78 ? B.WILD_TALL_GRASS : (rf > 0.66 ? B.FERN : B.TALL_GRASS)), false);
      }
      setLocalSafe(data, 4, streetY + 1, 12, B.OAK_FENCE, true); setLocalSafe(data, 4, streetY + 2, 12, B.LANTERN, true);
      setLocalSafe(data, 9, streetY + 1, 4, B.CHEST, true);
      maxLy = Math.min(WORLD_H - 1, (streetY + 18) - MIN_Y);
    } else {
      // 2D) Collapsed Concrete & Rust-Steel Ruin Shell
      for (let wy = streetY + 1; wy <= streetY + 12; wy++) for (let lz = 3; lz <= 12; lz++) for (let lx = 3; lx <= 12; lx++) {
        const edge = (lx === 3 || lx === 12 || lz === 3 || lz === 12);
        if (lz === 3 && lx >= 7 && lx <= 8 && wy <= streetY + 3) continue;
        const dH = hash3i(wx0 + lx, wy, wz0 + lz, worldSeed + 2071);
        if (edge && dH < 0.64) data[((wy - MIN_Y) << 8) | (lz << 4) | lx] = (wy >= streetY + 8 || dH > 0.46) ? B.RUST_STEEL : B.CRACKED_CONCRETE;
      }
      placeLuantiTree(data, 8, streetY + 1, 8, wx0 + 8, wz0 + 8, 'willow');
      setLocalSafe(data, 10, streetY + 1, 10, B.ANVIL, true);
      setLocalSafe(data, 5, streetY + 1, 10, B.CHEST, true);
      maxLy = Math.min(WORLD_H - 1, (streetY + 14) - MIN_Y);
    }
    const chCity = { cx, cz, data, maxLy, skyscraperSpec, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chCity);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chCity;
  }

  // Monumental 1000x1000 Grand Ancient Ruins & Hero End Portal Citadel Shrine (Images 3, 8, 9, 10)
  function _genGrandRuinsChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 38;
    const plazaY = 14;
    const ruinStone = (wx, wy, wz) => {
      const clump = valueNoise2D(wx * 0.24, wz * 0.24, worldSeed + 9307);
      const h = hash3i(wx, wy, wz, worldSeed + 9311);
      if (clump > 0.78) return h > 0.65 ? B.MOSS_BLOCK : B.MOSSY_STONE_BRICK;
      if (clump > 0.58 || h > 0.72) return B.MOSSY_STONE_BRICK;
      if (clump < 0.22 && h > 0.55) return B.DEEPSLATE_BRICKS;
      return B.STONE_BRICK;
    };
    const darkTrim = (wx, wy, wz) => {
      const h = hash3i(wx, wy, wz, worldSeed + 9323);
      return h > 0.65 ? B.DEEPSLATE_TILES : (h > 0.30 ? B.DEEPSLATE_BRICKS : B.BLACKSTONE_BRICKS);
    };
    const oxTrim = (wx, wy, wz) => ((wx + wy + wz) & 3) === 0 ? B.PRISMARINE : B.COPPER_ROOF;
    const put = (lx, wy, lz, id) => {
      const ly = wy - MIN_Y;
      if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_W && ly >= 1 && ly < WORLD_H - 1) {
        data[(ly << 8) | (lz << 4) | lx] = id;
        if (ly > maxLy) maxLy = ly;
      }
    };
    const pendingTrees = [];

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz, rz = wz - GRAND_RUINS_CZ;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, rx = wx - GRAND_RUINS_CX;
        const ci = (lz << 4) | lx;
        colBiomes[ci] = BIOMES.GRAND_RUINS.id;
        colHeights[ci] = plazaY;

        const ax = Math.abs(rx), az = Math.abs(rz);
        const edgeDist = Math.min(wx - GRAND_RUINS_MIN_X, GRAND_RUINS_MAX_X - wx, wz - GRAND_RUINS_MIN_Z, GRAND_RUINS_MAX_Z - wz);
        const inZoneA = (ax <= 44 && az <= 44);
        const inZoneB = (!inZoneA && ax <= 36 && az >= 45 && az <= 144);
        const inZoneC = (!inZoneA && rx <= -45 && rx >= -144 && az <= 36);
        const inZoneD = (!inZoneA && rx >= 45 && rx <= 144 && az <= 36);
        const onCauseway = (!inZoneA && (ax <= 8 || az <= 8));

        // Base subterranean foundation up to y = 11
        for (let wy = MIN_Y; wy <= 11; wy++) {
          const trueY = wy - (depthOffset || 0);
          let bid = wy < 0 ? B.DEEPSLATE : B.STONE;
          if (trueY <= -1001 && trueY >= -1010) bid = B.BEDROCK;
          data[((wy - MIN_Y) << 8) | ci] = bid;
        }

        // ==================== ZONE A: HERO END PORTAL CITADEL SHRINE (IMAGE 8) ====================
        if (inZoneA) {
          const inChasm = (rx >= -4 && rx <= 18 && rz >= 11 && rz <= 29);
          const inChannel = (rz >= -4 && rz <= -2 && ax <= 24);
          const overChannelBridge = (ax <= 3 || (rx >= 10 && rx <= 14));
          const inPortalDais = (ax <= 3 && az <= 3);
          const inPortalPit = (ax <= 1 && az <= 1);
          const inGrate = ((Math.abs(ax - 7) <= 1 && az <= 1) || (Math.abs(ax - 6) <= 1 && Math.abs(rz + 6) <= 1));

          // 1) Sub-floor / Plaza deck (y = 12..14) or Deep Lower Void Chasm (y = -10..13)
          if (inChasm) {
            for (let wy = -10; wy <= 13; wy++) {
              if (wy === -10) {
                const vc = hash2i(wx, wz, worldSeed + 9341);
                put(lx, wy, lz, vc > 0.88 ? B.END_CRYSTAL_BLOCK : (vc > 0.66 ? B.GLOW_CRYSTAL : (vc > 0.35 ? B.PURPUR_BLOCK : B.OBSIDIAN)));
              } else {
                put(lx, wy, lz, B.AIR);
              }
            }
            // Twin Lava Falls cascading down chasm north cliff wall (rz = 11..12) into End Void!
            if (rz <= 12 && ((rx >= 1 && rx <= 2) || (rx >= 6 && rx <= 8))) {
              for (let wy = -8; wy <= 13; wy++) put(lx, wy, lz, B.LAVA);
            } else if (rz === 11 || rx === -4 || rx === 18) {
              for (let wy = -9; wy <= 13; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
            }
            colHeights[ci] = -9;
          } else {
            for (let wy = 12; wy <= plazaY; wy++) put(lx, wy, lz, wy < 14 ? B.STONE : ruinStone(wx, wy, wz));
            if (inPortalDais) {
              if (inPortalPit) {
                put(lx, 13, lz, B.DEEPSLATE_BRICKS);
                put(lx, 14, lz, B.LAVA);
                put(lx, 15, lz, B.LAVA);
              } else {
                put(lx, 15, lz, (ax === 2 || az === 2) ? B.DEEPSLATE_BRICKS : B.MOSSY_STONE_BRICK);
              }
              if ((ax === 2 && az <= 1) || (az === 2 && ax <= 1)) {
                const preEye = (rx === -2 && rz === 0) || (rx === 2 && rz === -1);
                put(lx, 16, lz, preEye ? B.END_PORTAL_FRAME_EYE : B.END_PORTAL_FRAME);
              }
            } else if (rz >= 3 && rz <= 4 && ax <= 2) {
              if (rz === 3) put(lx, 15, lz, B.STONE_STAIRS_N);
              else put(lx, 14, lz, B.STONE_STAIRS_N);
            } else if (inGrate) {
              put(lx, 12, lz, B.DEEPSLATE_BRICKS);
              put(lx, 13, lz, ((wx + wz) & 1) ? B.LAVA : B.MAGMA_BLOCK);
              put(lx, 14, lz, B.IRON_GRATE);
            } else if (inChannel && !overChannelBridge) {
              put(lx, 12, lz, B.STONE_BRICK);
              put(lx, 13, lz, B.WATER);
              put(lx, 14, lz, B.WATER);
            } else if (inChannel && overChannelBridge) {
              put(lx, 13, lz, B.WATER);
              put(lx, 14, lz, B.MOSSY_STONE_BRICK);
              if (rz === -4 || rz === -2) put(lx, 15, lz, B.STONE_BRICK_WALL);
            }
          }

          // 2) Twin Monumental Arched Stone-Brick Gateways w/ Diamond Wall Cutouts behind Altar (rz in [-11..-8], ax <= 12)
          if (rz >= -11 && rz <= -8 && ax <= 12) {
            const isFrontArch = (rz >= -10 && rz <= -8);
            const archCenter = rx < 0 ? -6 : 6;
            const adx = rx - archCenter;
            const isPier = (ax >= 9 || ax <= 1);
            if (isFrontArch) {
              const archCeiling = 20 + Math.round(Math.sqrt(Math.max(0, 22 - adx * adx * 0.85)));
              const topArchY = isPier ? 25 : 26;
              for (let wy = 15; wy <= topArchY; wy++) {
                if (isPier) {
                  const isFlute = (ax === 10 && rz === -9) ? false : true;
                  if (isFlute) put(lx, wy, lz, wy >= 24 ? darkTrim(wx, wy, wz) : ruinStone(wx, wy, wz));
                } else if (wy >= archCeiling && Math.abs(adx) <= 5) {
                  put(lx, wy, lz, wy >= archCeiling + 1 ? darkTrim(wx, wy, wz) : B.STONE_BRICK);
                } else if (wy === 15 && rz === -10) {
                  put(lx, wy, lz, B.STONE_BRICK_WALL);
                }
              }
              if (rz === -8 && !isPier && hash2i(wx, wz, worldSeed + 9349) > 0.62) {
                for (let vy = 1; vy <= 3; vy++) put(lx, archCeiling - vy, lz, B.VINE);
              }
            } else if (rz === -11 && rx < -1 && !isPier) {
              // Iconic Recessed Backdrop Wall w/ 3 Diamond Cutouts behind Left Arch (right arch opens to NE waterfall!)
              for (let wy = 15; wy <= 22; wy++) {
                const dTop = Math.abs(adx) + Math.abs(wy - 21) <= 1;
                const dL = Math.abs(adx + 2) + Math.abs(wy - 19) <= 1;
                const dR = Math.abs(adx - 2) + Math.abs(wy - 19) <= 1;
                if (!dTop && !dL && !dR) put(lx, wy, lz, ruinStone(wx, wy, wz));
              }
            }
          }

          // 3) Cascading Rear Waterfall (rx in [8..12], rz in [-26..-18])
          if (rx >= 8 && rx <= 12 && rz >= -26 && rz <= -18) {
            if (rz === -26) {
              for (let wy = 14; wy <= 35; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
            } else if (rz === -25 && rx >= 9 && rx <= 11) {
              for (let wy = 14; wy <= 34; wy++) put(lx, wy, lz, B.WATER);
            } else if (rz >= -25 && rz <= -20 && rx >= 9 && rx <= 11) {
              put(lx, 13, lz, B.PRISMARINE);
              put(lx, 14, lz, B.WATER);
            }
          }

          // 4) Ascending NE Sanctuary Staircase & Braziers (rx in [12..15], rz in [-16..-5])
          if (rx >= 12 && rx <= 15 && rz >= -16 && rz <= -5) {
            const stepTop = 15 + (-5 - rz);
            for (let wy = 14; wy <= stepTop; wy++) {
              put(lx, wy, lz, (wy === stepTop && (rx === 12 || rx === 15)) ? B.STONE_BRICK_WALL : (wy === stepTop ? B.STONE_STAIRS_N : ruinStone(wx, wy, wz)));
            }
          }

          // 5) Right Foreground Watchtower (rx in [16..27], rz in [5..17])
          if (rx >= 16 && rx <= 27 && rz >= 5 && rz <= 17) {
            const twWall = (rx === 16 || rx === 27 || rz === 5 || rz === 17);
            const twDoor = (rx === 16 && rz >= 10 && rz <= 12);
            for (let wy = 15; wy <= 29; wy++) {
              if (twDoor && wy <= 18) continue;
              if (twWall) {
                const notch = (wy === 29 && ((rx + rz) & 1) === 1);
                const slit = (wy >= 24 && wy <= 26 && (rx === 21 || rz === 11));
                if (!notch) put(lx, wy, lz, slit ? B.LANTERN : (wy >= 27 ? darkTrim(wx, wy, wz) : ruinStone(wx, wy, wz)));
              } else if (wy === 22 || wy === 27) {
                put(lx, wy, lz, B.SPRUCE_PLANKS);
              }
            }
            if (rx === 24 && rz === 11) put(lx, 23, lz, B.GOLD_CHEST);
          }

          // 6) Left Overgrown Cliff Terrace & Foreground Trees (rx in [-25..-11], rz in [1..18])
          if (rx >= -25 && rx <= -11 && rz >= 1 && rz <= 18) {
            const cliffH = 16 + Math.max(0, Math.floor((-11 - rx) * 0.55));
            for (let wy = 14; wy <= cliffH; wy++) {
              put(lx, wy, lz, wy === cliffH ? (hash2i(wx, wz, worldSeed + 9371) > 0.28 ? B.GRASS : B.MOSS_BLOCK) : ruinStone(wx, wy, wz));
            }
            const rf = hash2i(wx, wz, worldSeed + 9377);
            if (rf > 0.52) put(lx, cliffH + 1, lz, rf > 0.85 ? B.FERN : (rf > 0.72 ? B.FLOWER_POPPY : B.TALL_GRASS));
            if (rx === -11 && hash2i(wx, wz, worldSeed + 9391) > 0.40) {
              for (let vy = 1; vy <= 4; vy++) put(lx, cliffH - vy, lz, B.VINE);
            }
            if ((rx === -18 && rz === 8) || (rx === -21 && rz === 13) || (rx === -15 && rz === 14)) {
              pendingTrees.push({ lx, wy: cliffH + 1, lz, wx, wz, style: rz === 8 ? 'pine' : 'oak' });
            }
          }

          // 7) Perimeter Canyon Sanctuary Walls, Pillars, Fire Braziers & Hilltop Trees
          const inPerimeterWall = (ax >= 28 || az >= 28) && !(ax <= 8 || az <= 8);
          if (inPerimeterWall) {
            const ringD = Math.max(ax, az) - 27;
            const wallH = Math.min(37, 23 + Math.floor(ringD * 0.9) + Math.floor(valueNoise2D(wx * 0.14, wz * 0.14, worldSeed + 9403) * 5));
            for (let wy = 15; wy <= wallH; wy++) {
              put(lx, wy, lz, wy === wallH ? B.GRASS : (wy >= wallH - 1 ? B.MOSS_BLOCK : ruinStone(wx, wy, wz)));
            }
            if (ax === 28 || az === 28) {
              if (((rx + rz) % 7) === 0) {
                for (let wy = 15; wy <= 31; wy++) put(lx, wy, lz, darkTrim(wx, wy, wz));
              } else if (hash2i(wx, wz, worldSeed + 9413) > 0.52) {
                for (let vy = 0; vy < 4; vy++) put(lx, wallH - 1 - vy, lz, B.VINE);
              }
            }
            if (ringD >= 6 && ringD <= 13 && hash2i(wx, wz, worldSeed + 9419) > 0.962) {
              pendingTrees.push({ lx, wy: wallH + 1, lz, wx, wz, style: 'pine' });
            }
            colHeights[ci] = wallH;
          }
          // 4 Monumental Corner Fire Brazier Pillars framing the End Portal Plaza
          if ((ax === 13 || ax === 14) && (az === 13 || az === 14)) {
            if (!inChasm) {
              const pH = (ax === 14 && az === 14) ? 23 : 22;
              for (let wy = 15; wy <= pH; wy++) put(lx, wy, lz, wy >= pH - 1 ? darkTrim(wx, wy, wz) : ruinStone(wx, wy, wz));
              if (ax === 14 && az === 14) put(lx, pH + 1, lz, B.CAMPFIRE);
            }
          }
          // NE cliff trees above waterfall (like Image 8 top backdrop!)
          if ((rx === -4 && rz === -32) || (rx === 4 && rz === -34)) {
            pendingTrees.push({ lx, wy: 26, lz, wx, wz, style: 'pine' });
          }

        // ==================== ZONE B: VAULTED SUNKEN CANAL HALLS (IMAGE 3) ====================
        } else if (inZoneB) {
          const isCanal = (rx >= 8 && rx <= 22);
          const isAlcove = (rx >= -32 && rx <= -24);
          const isVaultArch = ((Math.abs(rz) % 12) <= 1);
          const isFluteCol = ((Math.abs(rz) % 12) === 0 && (rx === -12 || rx === -11 || rx === 2 || rx === 3));
          if (isCanal) {
            for (let wy = 6; wy <= 12; wy++) put(lx, wy, lz, wy === 6 ? B.DEEPSLATE_TILES : (wy <= 12 ? B.WATER : B.AIR));
            if (rx === 8 || rx === 22) {
              for (let wy = 6; wy <= 15; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
            }
          } else {
            // Terracotta walkways framed by mossy stone brick seams (Image 3 palette!)
            const onPath = (rx >= -20 && rx <= 7);
            for (let wy = 12; wy <= 14; wy++) {
              if (wy === 14 && onPath) {
                const border = (rx === -20 || rx === 7 || (Math.abs(rz) & 7) === 0);
                put(lx, wy, lz, border ? B.MOSSY_STONE_BRICK : (hash2i(wx, wz, worldSeed + 9431) > 0.25 ? B.TERRACOTTA_ORANGE : B.MUD_BRICK));
              } else {
                put(lx, wy, lz, ruinStone(wx, wy, wz));
              }
            }
          }
          // Outer gallery walls + lit alcoves + vaulted ceiling arches w/ skylights & hanging foliage
          const isOuterWallB = (ax >= 33);
          const archSkyH = 30 - Math.floor((ax * ax) / 160);
          if (isOuterWallB) {
            for (let wy = 15; wy <= 31; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
          } else if (isAlcove) {
            for (let wy = 15; wy <= 24; wy++) {
              const alWall = (rx === -32 || (Math.abs(rz) % 8 === 0 && wy <= 21));
              if (alWall) put(lx, wy, lz, ruinStone(wx, wy, wz));
              else if (rx === -26 && wy === 18 && (Math.abs(rz) % 8 === 4)) put(lx, wy, lz, B.LANTERN);
            }
          }
          if (isFluteCol) {
            for (let wy = 15; wy <= archSkyH; wy++) put(lx, wy, lz, (wy === 15 || wy >= archSkyH - 1) ? darkTrim(wx, wy, wz) : ruinStone(wx, wy, wz));
          }
          // Warm glowing Campfire Braziers along terracotta hall
          if (rx === -14 && (Math.abs(rz) % 12) === 6) {
            put(lx, 15, lz, B.TERRACOTTA_YELLOW);
            put(lx, 16, lz, B.CAMPFIRE);
          }
          // Vaulted ceiling + open sky strips for god-rays + lush hanging vine & leaf curtains
          const skylight = (!isVaultArch && ax <= 6 && (Math.abs(rz) % 12) >= 4 && (Math.abs(rz) % 12) <= 8);
          if (!skylight && archSkyH >= 20) {
            put(lx, archSkyH, lz, isVaultArch ? darkTrim(wx, archSkyH, wz) : ruinStone(wx, archSkyH, wz));
            put(lx, archSkyH + 1, lz, B.GRASS);
            if (hash2i(wx, wz, worldSeed + 9439) > 0.68) {
              const hangD = 2 + Math.floor(hash2i(wx, wz, worldSeed + 9461) * 5);
              for (let d = 1; d <= hangD; d++) put(lx, archSkyH - d, lz, d <= 2 ? B.OAK_LEAVES : B.VINE);
            }
          }

        // ==================== ZONE C: COLOSSAL GUARDIAN STATUE COURTYARD (IMAGE 9) ====================
        } else if (inZoneC) {
          const floorY = 12;
          for (let wy = 11; wy <= floorY; wy++) {
            const cr = hash2i(wx, wz, worldSeed + 9473);
            put(lx, wy, lz, cr > 0.80 ? B.MOSS_BLOCK : (cr > 0.62 ? B.GRAVEL : ruinStone(wx, wy, wz)));
          }
          colHeights[ci] = floorY;
          if (az <= 15 && hash2i(wx, wz, worldSeed + 9479) > 0.968 && rx > -115) {
            put(lx, floorY + 1, lz, B.OAK_FENCE);
            if (((wx + wz) & 3) === 0) put(lx, floorY + 2, lz, B.TORCH_BLOCK);
          }
          // North & South Oxidized-Copper & Prismarine Trimmed Multi-Tier Colonnade Alcoves (Image 9!)
          if (az >= 18) {
            const tier = az >= 27 ? 2 : 1;
            const colH = tier === 1 ? 21 : 30;
            for (let wy = 13; wy <= colH; wy++) {
              const isTrim = (wy === 16 || wy === 20 || wy === 25 || wy === 29);
              const isArchOpen = (tier === 1 && wy >= 14 && wy <= 18 && (Math.abs(rx) % 8 >= 2 && Math.abs(rx) % 8 <= 5) && az <= 22);
              const isUpperOpen = (tier === 2 && wy >= 22 && wy <= 26 && (Math.abs(rx) % 8 >= 2 && Math.abs(rx) % 8 <= 5) && az <= 31);
              if (isArchOpen || isUpperOpen) {
                if (wy === 14 && (Math.abs(rx) % 8 === 3)) put(lx, wy, lz, B.TORCH_BLOCK);
                continue;
              }
              put(lx, wy, lz, isTrim ? oxTrim(wx, wy, wz) : ruinStone(wx, wy, wz));
            }
          }
          // Colossal Moss & Terracotta Guardian Statue against western rear cliff (rx in [-138..-118], |rz| <= 12)
          if (rx <= -118 && rx >= -138 && az <= 12) {
            const backWall = (rx <= -133);
            const torso = (rx >= -132 && rx <= -123 && az <= 7);
            const armReach = (rx >= -124 && rx <= -119 && az >= 5 && az <= 9);
            const headBox = (rx >= -130 && rx <= -122 && az <= 4);
            const sMat = (wy) => (hash3i(wx, wy, wz, worldSeed + 9491) > 0.72 ? B.MOSS_BLOCK : (hash3i(wx, wy, wz, worldSeed + 9497) > 0.38 ? B.TERRACOTTA_ORANGE : B.MUD_BRICK));
            if (backWall) {
              for (let wy = 13; wy <= 35; wy++) put(lx, wy, lz, darkTrim(wx, wy, wz));
            }
            if (torso) {
              for (let wy = 13; wy <= 26; wy++) put(lx, wy, lz, sMat(wy));
            }
            if (armReach) {
              for (let wy = 13; wy <= 22; wy++) put(lx, wy, lz, sMat(wy));
            }
            if (headBox) {
              for (let wy = 26; wy <= 33; wy++) {
                const eye = (rx === -122 && wy === 29 && (az === 2 || az === 3));
                const horn = (wy >= 31 && az >= 3);
                put(lx, wy, lz, eye ? B.SHROOMLIGHT : (horn ? B.TERRACOTTA_YELLOW : sMat(wy)));
              }
            }
            if (rx === -120 && rz === 0) put(lx, 13, lz, B.GOLD_CHEST);
          }

        // ==================== ZONE D: OVERGROWN CITADEL & EMERALD POOL (IMAGE 10) ====================
        } else if (inZoneD) {
          const inPool = (rx >= 84 && rx <= 108 && az <= 12);
          if (inPool) {
            const pd = Math.max(Math.abs(rx - 96), az);
            const stepY = pd >= 11 ? 13 : (pd >= 9 ? 11 : 9);
            for (let wy = 8; wy <= stepY; wy++) {
              put(lx, wy, lz, wy === stepY ? ((pd & 1) ? B.MOSS_BLOCK : B.PRISMARINE) : B.MOSSY_STONE_BRICK);
            }
            for (let wy = stepY + 1; wy <= 13; wy++) put(lx, wy, lz, B.WATER);
          } else {
            for (let wy = 12; wy <= plazaY; wy++) put(lx, wy, lz, hash2i(wx, wz, worldSeed + 9511) > 0.78 ? B.MOSS_BLOCK : ruinStone(wx, wy, wz));
            // 4 Multi-Tier Sunlit Ruined Citadel Watchtowers at corners of East Quarter
            const twCx = (rx < 96) ? 66 : 124;
            const twCz = (rz < 0) ? -24 : 24;
            const tdx = Math.abs(rx - twCx), tdz = Math.abs(rz - twCz);
            if (tdx <= 6 && tdz <= 6) {
              const tEdge = (tdx === 6 || tdz === 6);
              const crumble = (hash2i(wx, wz, worldSeed + 9521) > 0.65) ? 4 : 0;
              const twH = 31 - crumble;
              if (tEdge) {
                for (let wy = 15; wy <= twH; wy++) {
                  if ((tdx <= 1 || tdz <= 1) && wy <= 18) continue;
                  put(lx, wy, lz, ruinStone(wx, wy, wz));
                }
              } else {
                put(lx, 21, lz, B.SPRUCE_PLANKS);
                if (tdx === 0 && tdz === 0) put(lx, 22, lz, B.GOLD_CHEST);
              }
            }
            // Ruined Courtyard Trees & Crackling Campfire Braziers (Image 10!)
            if ((rx === 76 && rz === -11) || (rx === 115 && rz === 11) || (rx === 96 && rz === -20)) {
              pendingTrees.push({ lx, wy: 15, lz, wx, wz, style: 'canopy_jungle' });
            }
            if ((rx === 76 && rz === 10) || (rx === 115 && rz === -10)) {
              put(lx, 15, lz, B.DEEPSLATE_BRICKS);
              put(lx, 16, lz, B.CAMPFIRE);
            }
          }

        // ==================== ZONE E: OUTER 1000x1000 RUINS & GRAND CAUSEWAYS ====================
        } else {
          const isOuterWallR = (edgeDist < 4);
          if (onCauseway) {
            // Monumental 16-wide Grand Stone Causeways spanning all 1000x1000!
            const alongX = (az <= 8);
            const perp = alongX ? az : ax;
            const alongCoord = alongX ? rx : rz;
            for (let wy = 12; wy <= plazaY; wy++) {
              if (perp >= 5 && perp <= 6 && wy === plazaY) put(lx, wy, lz, B.WATER);
              else if (perp === 7 && wy === plazaY) put(lx, wy, lz, B.STONE_BRICK_WALL);
              else put(lx, wy, lz, (perp <= 1 && (alongCoord & 1)) ? B.DEEPSLATE_TILES : ruinStone(wx, wy, wz));
            }
            if ((Math.abs(alongCoord) % 24) === 0 && perp >= 7) {
              for (let wy = 15; wy <= 22; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
              put(lx, 23, lz, B.CAMPFIRE);
            }
            if (perp >= 7 && (Math.abs(alongCoord) % 24) === 0) put(lx, 15, lz, B.LANTERN);
          } else {
            // Repeating 48x48 Modular Architectural Ruin Districts across full 1000x1000 span
            const bx = ((wx % 48) + 48) % 48, bz = ((wz % 48) + 48) % 48;
            const dgx = Math.floor(wx / 48), dgz = Math.floor(wz / 48);
            const distKind = Math.floor(hash2i(dgx, dgz, worldSeed + 9547) * 5);
            const bCx = bx - 24, bCz = bz - 24;
            const badx = Math.abs(bCx), badz = Math.abs(bCz);
            const surfR = hash2i(wx, wz, worldSeed + 9551);
            const baseElev = edgeDist < 16 ? Math.max(8, Math.round(8 + (edgeDist / 16) * 6)) : plazaY;
            for (let wy = 12; wy <= baseElev; wy++) {
              put(lx, wy, lz, (wy === baseElev && surfR > 0.72) ? (surfR > 0.88 ? B.GRASS : B.MOSS_BLOCK) : ruinStone(wx, wy, wz));
            }
            colHeights[ci] = baseElev;
            if (!isOuterWallR && edgeDist >= 12) {
              if (distKind === 0 && badx <= 11 && badz <= 11) {
                // Module 1: Ruined Citadel Tower + Emerald Moss Pool (Image 10 motif)
                if (badx <= 5 && badz <= 5) {
                  put(lx, baseElev - 2, lz, B.PRISMARINE);
                  put(lx, baseElev - 1, lz, B.WATER);
                  put(lx, baseElev, lz, B.WATER);
                } else if (badx === 11 || badz === 11) {
                  const wh = 19 + Math.floor(hash2i(wx, wz, worldSeed + 9587) * 8);
                  if (badx > 2 && badz > 2) for (let wy = baseElev + 1; wy <= wh; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
                } else if (bCx === -7 && bCz === -7) {
                  put(lx, baseElev + 1, lz, B.GOLD_CHEST);
                }
              } else if (distKind === 1 && badx <= 13 && badz <= 13) {
                // Module 2: Terracotta & Sunken Dark Canal Hall (Image 3 motif)
                if (bCx >= 4 && bCx <= 9) {
                  put(lx, baseElev - 2, lz, B.DEEPSLATE_TILES);
                  put(lx, baseElev - 1, lz, B.WATER);
                  put(lx, baseElev, lz, B.WATER);
                } else if (badx === 12 || badz === 12) {
                  if ((bx & 3) === 0) for (let wy = baseElev + 1; wy <= baseElev + 9; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
                } else {
                  put(lx, baseElev, lz, (bCx & 3) === 0 ? B.MOSSY_STONE_BRICK : B.TERRACOTTA_ORANGE);
                  if (bCx === 0 && bCz === 0) { put(lx, baseElev + 1, lz, B.DEEPSLATE_BRICKS); put(lx, baseElev + 2, lz, B.CAMPFIRE); }
                }
              } else if (distKind === 2 && badx <= 12 && badz <= 12) {
                // Module 3: Oxidized Copper Colonnade & Monolith Shrine (Image 9 motif)
                if (badx === 11 || badz === 11) {
                  for (let wy = baseElev + 1; wy <= baseElev + 8; wy++) {
                    if ((wy - baseElev) === 4 || (wy - baseElev) === 8) put(lx, wy, lz, oxTrim(wx, wy, wz));
                    else if ((badx > 2 || badz > 2) && ((bx + bz) & 1) === 0) put(lx, wy, lz, ruinStone(wx, wy, wz));
                  }
                } else if (badx <= 2 && badz <= 2) {
                  const mh = baseElev + (badx === 0 && badz === 0 ? 7 : 4);
                  for (let wy = baseElev + 1; wy <= mh; wy++) put(lx, wy, lz, (wy === mh - 1) ? B.SHROOMLIGHT : B.TERRACOTTA_ORANGE);
                }
              } else if (distKind === 3 && (badx <= 3 || badz <= 3)) {
                // Module 4: Overgrown Aqueduct Arches & Torch Courtyard
                if (badx === 3 || badz === 3) {
                  const ah = baseElev + ((bx + bz) % 6 === 0 ? 7 : 3);
                  for (let wy = baseElev + 1; wy <= ah; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
                } else if (bCx === 0 && bCz === 0) {
                  put(lx, baseElev + 1, lz, B.CHEST);
                }
              } else if (bCx === 0 && bCz === 0) {
                // Module 5: Overgrown Ancient Woods & Ruin Plaza
                pendingTrees.push({ lx, wy: baseElev + 1, lz, wx, wz, style: 'oak' });
              }
              if (lx >= 4 && lx <= 11 && lz >= 4 && lz <= 11 && hash2i(wx, wz, worldSeed + 9601) > 0.992) {
                pendingTrees.push({ lx, wy: baseElev + 1, lz, wx, wz, style: hash2i(wx, wz, worldSeed + 9613) > 0.5 ? 'pine' : 'oak' });
              }
            }
          }
        }
      }
    }

    for (let ti = 0; ti < pendingTrees.length; ti++) {
      const tr = pendingTrees[ti];
      if (tr.lx >= 2 && tr.lx <= 13 && tr.lz >= 2 && tr.lz <= 13) {
        placeLuantiTree(data, tr.lx, tr.wy, tr.lz, tr.wx, tr.wz, tr.style);
      }
    }
    maxLy = applyChunkMods(cx, cz, data, Math.min(WORLD_H - 1, maxLy));
    const chGr = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chGr);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chGr;
  }

  function generateChunk(cx, cz) {
    const data = _allocChunkData();
    const wx0 = cx * CHUNK_W, wz0 = cz * CHUNK_W;
    if (currentDimension === 'dragon_realm') return _genDragonRealmChunk(cx, cz, wx0, wz0, data);
    if (currentDimension === 'end') return _genEndChunk(cx, cz, wx0, wz0, data);
    if (currentDimension === 'warden') return _genWardenChunk(cx, cz, wx0, wz0, data);
    if (currentDimension === 'sift') return _genSiftChunk(cx, cz, wx0, wz0, data);
    if (depthOffset !== 0) return _genDeepUndergroundChunk(cx, cz, wx0, wz0, data);
    if (currentDimension === 'nether') return _genNetherChunk(cx, cz, wx0, wz0, data);
    if (currentDimension === 'overworld' && isAbandonedCity(wx0 + 8, wz0 + 8)) return _genCityChunk(cx, cz, wx0, wz0, data);
    if (currentDimension === 'overworld' && isGrandRuins(wx0 + 8, wz0 + 8)) return _genGrandRuinsChunk(cx, cz, wx0, wz0, data);
    let maxLy = 0;

    // ===================== DIMENSION 1: OVERWORLD (THẾ GIỚI CHÍNH) =====================
    const _bC0 = getBiomeAt(wx0 + 8, wz0 + 8);
    const _isUniformBiome = (
      getBiomeAt(wx0 - 12, wz0 - 12) === _bC0 && getBiomeAt(wx0 + 28, wz0 - 12) === _bC0 &&
      getBiomeAt(wx0 - 12, wz0 + 28) === _bC0 && getBiomeAt(wx0 + 28, wz0 + 28) === _bC0 &&
      getBiomeAt(wx0 + 8, wz0 - 12) === _bC0 && getBiomeAt(wx0 + 8, wz0 + 28) === _bC0 &&
      getBiomeAt(wx0 - 12, wz0 + 8) === _bC0 && getBiomeAt(wx0 + 28, wz0 + 8) === _bC0
    );
    if (_isUniformBiome && (_bC0 === BIOMES.ABYSS_TRENCH || _bC0 === BIOMES.DEEP_OCEAN)) {
      const fMax = Math.max(
        getOceanFloorTrueY(wx0 + 8, wz0 + 8, _bC0),
        getOceanFloorTrueY(wx0, wz0, _bC0), getOceanFloorTrueY(wx0 + 15, wz0, _bC0),
        getOceanFloorTrueY(wx0, wz0 + 15, _bC0), getOceanFloorTrueY(wx0 + 15, wz0 + 15, _bC0)
      );
      if (fMax < MIN_Y - 3) {
        const wTopLy = WATER_LEVEL - MIN_Y;
        data.fill(B.WATER, 0, (wTopLy + 1) << 8);
        maxLy = applyChunkMods(cx, cz, data, wTopLy);
        const ch = { cx, cz, data, maxLy, isOceanChunk: true, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
        registerChunk(chunkKey(cx, cz), ch);
        markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
        return ch;
      }
    }

    if (!chunkWorkerPool.take(wx0, wz0, depthOffset || 0)) fillCoarseCaveGrid(wx0, wz0);

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const biome = _isUniformBiome ? _bC0 : getBiomeAt(wx, wz);
        const isSeaCol = (biome === BIOMES.ABYSS_TRENCH || biome === BIOMES.DEEP_OCEAN);
        const rawSeaH = isSeaCol ? getOceanFloorTrueY(wx, wz, biome) : null;
        const ci = (lz << 4) | lx;
        if (rawSeaH !== null && rawSeaH < MIN_Y) {
          colHeights[ci] = rawSeaH; colBiomes[ci] = biome.id;
          const wTopLy = WATER_LEVEL - MIN_Y; if (wTopLy > maxLy) maxLy = wTopLy;
          for (let ly = 0; ly <= wTopLy; ly++) data[(ly << 8) | ci] = B.WATER;
          continue;
        }
        const h = rawSeaH !== null
          ? Math.min(MAX_Y - 8, rawSeaH)
          : (_isUniformBiome
              ? Math.max(MIN_Y + 4, Math.min(MAX_Y - 8, Math.floor(getRawBiomeHeight(wx, wz, biome))))
              : getTerrainHeight(wx, wz, biome));
        colHeights[ci] = h; colBiomes[ci] = biome.id;
        const topLy = Math.max(h, WATER_LEVEL) - MIN_Y; if (topLy > maxLy) maxLy = topLy;
        const _MESA_STRATA = [
          B.TERRACOTTA, B.TERRACOTTA_ORANGE, B.TERRACOTTA_WHITE, B.TERRACOTTA,
          B.TERRACOTTA_YELLOW, B.TERRACOTTA_BROWN, B.TERRACOTTA_ORANGE, B.TERRACOTTA_RED,
          B.TERRACOTTA, B.TERRACOTTA_WHITE, B.TERRACOTTA_ORANGE, B.TERRACOTTA_BROWN,
          B.TERRACOTTA_YELLOW, B.TERRACOTTA_RED, B.TERRACOTTA_ORANGE, B.TERRACOTTA
        ];
        const canSurfaceCave = (h >= WATER_LEVEL + 4 && !isWheatMegaPlain(wx, wz) &&
          biome !== BIOMES.PLAINS && biome !== BIOMES.GREEN_PLAINS && biome !== BIOMES.SNOWY_PLAINS && biome !== BIOMES.WHEAT_VALLEY &&
          biome !== BIOMES.BEACH_PALM && biome !== BIOMES.TROPICAL_COAST &&
          biome !== BIOMES.MANGROVE_SWAMP && biome !== BIOMES.SWAMP &&
          (Math.abs(wx) > 20 || Math.abs(wz) > 20));
        for (let ly = 0; ly <= topLy; ly++) {
          const wy = MIN_Y + ly; let id = B.AIR;
          const trueY = wy - (depthOffset || 0);
          if (trueY <= -1001 && trueY >= -1010) id = B.BEDROCK;
          else if (wy < h - 3 || (canSurfaceCave && wy <= h)) {
            const _cRaw = sampleCaveFast(lx, ly, lz);
            let _cThresh = (wy >= h - 3) ? 0.785 : (wy < -16 ? 0.68 : (wy > 6 ? 0.74 : 0.755));
            if (wy < -16 && _cRaw > 0.65) {
              const ub = getUndergroundBiomeAt(wx, trueY, wz);
              _cThresh = ub === UNDERGROUND_BIOMES.CRYSTAL_CAVERN ? 0.66 : (ub === UNDERGROUND_BIOMES.LUSH_CAVE ? 0.67 : (ub === UNDERGROUND_BIOMES.MAGMA_CAVERN ? 0.68 : (ub === UNDERGROUND_BIOMES.DRIPSTONE_CAVE ? 0.70 : 0.68)));
            }
            if (wy > MIN_Y + 3 && (h > WATER_LEVEL + 2 || wy < Math.min(h - 5, WATER_LEVEL - 8)) && _cRaw > _cThresh) {
              id = (trueY <= -940) ? B.LAVA : B.AIR;
            } else if (wy < h - 3) {
              const oreH = hash3i(wx, wy, wz, worldSeed + 777);
              const isMountainBio = (biome === BIOMES.CLOUD_PEAKS || biome === BIOMES.ALPINE_PEAKS || biome === BIOMES.HIGHLAND_PLATEAU || biome === BIOMES.SNOW || biome === BIOMES.BADLANDS_SPIRES);
              const isBadlandsBio = (biome === BIOMES.MESA || biome === BIOMES.BADLANDS_SPIRES || biome === BIOMES.BADLANDS_CRATER);
              if (wy <= -16) {
                if (wy <= -32 && oreH > 0.9986) id = B.DIAMOND_ORE;
                else if (wy <= -24 && oreH > 0.9993) id = B.DIAMOND_ORE;
                else if (wy <= -28 && oreH > 0.9978 && oreH <= 0.9986) id = B.RUBY_ORE;
                else if (isMountainBio && oreH > 0.9968 && oreH <= 0.9978) id = B.EMERALD_ORE;
                else if (oreH > 0.9950 && oreH <= 0.9968) id = B.REDSTONE_ORE;
                else if (oreH > 0.9946 && oreH <= 0.9950) id = B.GLOW_CRYSTAL;
                else if (oreH > 0.9935 && oreH <= 0.9946) id = B.GOLD_ORE;
                else if (oreH > 0.9917 && oreH <= 0.9935) id = B.LAPIS_ORE;
                else if (oreH > 0.9852 && oreH <= 0.9917) id = B.IRON_ORE;
                else id = B.DEEPSLATE;
              } else {
                if (isBadlandsBio && wy >= h - 18 && h > WATER_LEVEL + 4) id = _MESA_STRATA[((wy % 16) + 16) & 15];
                else if (isMountainBio && oreH > 0.9988) id = B.EMERALD_ORE;
                else if ((isBadlandsBio && wy <= 24 && oreH > 0.9945) || (wy <= -6 && oreH > 0.9974)) id = B.GOLD_ORE;
                else if (wy <= 4 && oreH > 0.9956 && oreH <= 0.9974) id = B.LAPIS_ORE;
                else if (wy <= 2 && oreH > 0.9942 && oreH <= 0.9956) id = B.REDSTONE_ORE;
                else if ((wy <= 18 || isMountainBio) && oreH > 0.9888 && oreH <= 0.9956) id = B.IRON_ORE;
                else if (wy >= -8 && wy <= 24 && oreH > 0.9818 && oreH <= 0.9888) id = B.COPPER_ORE;
                else if (wy >= -10 && wy <= 14 && oreH > 0.9773 && oreH <= 0.9818) id = B.TIN_ORE;
                else if (wy >= -8 && oreH > 0.9678 && oreH <= 0.9773) id = B.COAL_ORE;
                else id = B.STONE;
              }
            } else {
              // Non-carved upper 3 blocks (wy in [h-3..h]) fall through to soil/surface layer assignment
              id = -1;
            }
          } else {
            id = -1;
          }
          if (id === -1) {
            if (wy < h) {
              if (biome === BIOMES.DESERT || biome === BIOMES.BEACH_PALM || biome === BIOMES.TROPICAL_COAST) id = B.SANDSTONE;
              else if (biome === BIOMES.MESA || biome === BIOMES.BADLANDS_SPIRES || biome === BIOMES.BADLANDS_CRATER) {
                id = (h <= WATER_LEVEL + 4 && wy >= h - 1) ? B.RED_SAND : _MESA_STRATA[((wy % 16) + 16) & 15];
              }
              else if (biome === BIOMES.MARSH_RUINS || biome === BIOMES.MANGROVE_SWAMP) id = B.MUD;
              else if ((biome === BIOMES.ALPINE_PEAKS || biome === BIOMES.CLOUD_PEAKS || biome === BIOMES.MEGA_SNOW_PEAKS) && wy >= 14) id = ((wy & 3) === 0 ? B.PACKED_ICE : B.STONE);
              else if (biome === BIOMES.HIGHLAND_PLATEAU && wy < h - 1) id = B.STONE;
              else if (biome === BIOMES.NIGHTMARE_WOODS) id = B.DEEPSLATE;
              else id = B.DIRT;
            } else if (wy === h) {
              if (h <= WATER_LEVEL) {
                if (biome === BIOMES.MANGROVE_SWAMP || biome === BIOMES.SWAMP) id = B.MUD;
                else if (h <= -26 || biome === BIOMES.ABYSS_TRENCH) id = hash2i(wx, wz, worldSeed + 547) > 0.45 ? B.DEEPSLATE : B.BASALT;
                else if (h <= -14) id = hash2i(wx, wz, worldSeed + 549) > 0.55 ? B.STONE : B.SAND;
                else id = B.SAND;
              }
              else if (biome === BIOMES.DESERT || biome === BIOMES.BEACH_PALM) id = B.SAND;
              else if (biome === BIOMES.MUSHROOM_ISLAND) id = B.MYCELIUM;
              else if (biome === BIOMES.VOLCANIC_BASALT) id = (hash2i(wx, wz, worldSeed + 527) > 0.96 ? B.LAVA : B.BASALT);
              else if (biome === BIOMES.MANGROVE_SWAMP) id = (hash2i(wx, wz, worldSeed + 521) > 0.42 ? B.MUD : B.GRASS);
              else if (biome === BIOMES.MEGA_SNOW_PEAKS) id = h >= 62 ? ((hash2i(wx, wz, worldSeed + 523) > 0.72) ? B.PACKED_ICE : B.SNOW) : (h >= 34 ? (hash2i(wx, wz, worldSeed + 529) > 0.35 ? B.SNOW : B.STONE) : B.GRASS);
              else if (biome === BIOMES.CLOUD_PEAKS) id = h >= 44 ? ((hash2i(wx, wz, worldSeed + 523) > 0.72) ? B.PACKED_ICE : B.SNOW) : (h >= 24 ? (hash2i(wx, wz, worldSeed + 529) > 0.40 ? B.STONE : B.SNOW) : B.GRASS);
              else if (biome === BIOMES.ALPINE_PEAKS) id = (h >= 28 && hash2i(wx, wz, worldSeed + 523) > 0.72) ? B.PACKED_ICE : (h >= 20 ? B.SNOW : B.GRASS);
              else if (biome === BIOMES.SNOW) id = B.SNOW;
              else if (biome === BIOMES.SNOWY_PLAINS) id = B.SNOWY_DIRT;
              else if (biome === BIOMES.GREEN_PLAINS) id = B.GRASS;
              else if (biome === BIOMES.PALE_GARDEN) id = B.PALE_MOSS;
              else if (biome === BIOMES.NIGHTMARE_WOODS) id = (hash2i(wx, wz, worldSeed + 531) > 0.85 ? B.SCULK : B.NIGHTMARE_MOSS);
              else if (biome === BIOMES.DARK_FOREST) id = (hash2i(wx, wz, worldSeed + 533) > 0.56 ? B.AUTUMN_PODZOL : B.GRASS);
              else if (biome === BIOMES.LUSH_STEPPE) id = B.GRASS;
              else if (biome === BIOMES.MESA || biome === BIOMES.BADLANDS_SPIRES || biome === BIOMES.BADLANDS_CRATER) {
                id = (h <= WATER_LEVEL + 4) ? B.RED_SAND : _MESA_STRATA[((wy % 16) + 16) & 15];
              }
              else if (biome === BIOMES.GLOWSHROOM_GROVE) id = B.MYCELIUM;
              else if (biome === BIOMES.MARSH_RUINS) id = (hash2i(wx, wz, worldSeed + 611) > 0.42 ? B.MUD : B.GRASS);
              else if (biome === BIOMES.TROPICAL_COAST) id = (h <= WATER_LEVEL + 2 ? B.SAND : B.GRASS);
              else if (biome === BIOMES.DAPPLED_FOREST) id = (hash2i(wx, wz, worldSeed + 613) > 0.25 ? B.AUTUMN_PODZOL : B.GRASS);
              else if (biome === BIOMES.REDWOOD_ANCIENT || biome === BIOMES.GIANT_TREES) id = (hash2i(wx, wz, worldSeed + 617) > 0.76 ? B.MOSS_BLOCK : (hash2i(wx, wz, worldSeed + 618) > 0.65 ? B.AUTUMN_PODZOL : B.GRASS));
              else if (biome === BIOMES.MANOR_GARDEN) id = (hash2i(wx, wz, worldSeed + 619) > 0.90 ? B.STONE_BRICK : B.GRASS);
              else if (biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_DEEP || biome === BIOMES.AUTUMN_GOLDEN) id = hash2i(wx, wz, worldSeed + 539) > 0.25 ? B.AUTUMN_PODZOL : B.GRASS;
              else if (biome === BIOMES.BLUE_FOREST) {
                const trailN = Math.abs(fbm2D(wx * 0.045, wz * 0.045, 2, 0.5, 2.0, worldSeed + 811) - 0.5);
                if (trailN < 0.042) id = hash2i(wx, wz, worldSeed + 813) > 0.52 ? B.SAND : (hash2i(wx, wz, worldSeed + 815) > 0.45 ? B.STONE : B.AUTUMN_PODZOL);
                else id = B.BLUE_GRASS;
              }
              else if (biome === BIOMES.WHEAT_VALLEY) {
                const inMega = isWheatMegaPlain(wx, wz);
                const isHeroPath = inMega && (Math.abs(wx - WHEAT_PLAIN_CX) <= 1 && wz >= WHEAT_PLAIN_CZ - 30 && wz <= WHEAT_PLAIN_CZ + 8);
                const wTrail = Math.abs(fbm2D(wx * 0.022, wz * 0.022, 2, 0.5, 2.0, worldSeed + 823) - 0.5) < 0.028;
                const isCanal = !isHeroPath && !wTrail && ((wx & 31) === 15) && ((wz & 7) !== 0) && h <= WATER_LEVEL + 3;
                id = (isHeroPath || wTrail) ? (hash2i(wx, wz, worldSeed + 821) > 0.38 ? B.DIRT : B.STONE_BRICK) : (isCanal ? B.WATER : B.FARMLAND);
              }
              else if (biome === BIOMES.PINE_VALLEY) {
                const pTrail = Math.abs(fbm2D(wx * 0.042, wz * 0.042, 2, 0.5, 2.0, worldSeed + 831) - 0.5);
                id = pTrail < 0.042 ? (hash2i(wx, wz, worldSeed + 833) > 0.50 ? B.AUTUMN_PODZOL : B.GRAVEL) : (hash2i(wx, wz, worldSeed + 835) > 0.86 ? B.MUD : B.GRASS);
              }
              else if (biome === BIOMES.GIANT_JUNGLE) id = (h <= WATER_LEVEL + 1 && hash2i(wx, wz, worldSeed + 841) > 0.52) ? B.SAND : B.GRASS;
              else id = B.GRASS;
            }
          }
          if (wy > h && wy <= WATER_LEVEL) id = ((biome === BIOMES.SNOW || biome === BIOMES.SNOWY_PLAINS || biome === BIOMES.ALPINE_PEAKS || biome === BIOMES.CLOUD_PEAKS) && wy === WATER_LEVEL) ? B.ICE : B.WATER;
          data[(ly << 8) | (lz << 4) | lx] = id;
        }
        // Varied Subterranean Biome Caves below the surface (lazy-evaluated only when column has cave air!)
        let uBioCol = null;
        for (let ly = 5; ly < h - MIN_Y - 2; ly++) {
          const wy = MIN_Y + ly;
          if (wy > h - 3) continue;
          const i = (ly << 8) | (lz << 4) | lx, below = ((ly - 1) << 8) | (lz << 4) | lx, above = ((ly + 1) << 8) | (lz << 4) | lx;
          if (data[i] === B.AIR) {
            if (data[below] === B.STONE || data[below] === B.DEEPSLATE) {
              if (!uBioCol) uBioCol = getUndergroundBiomeAt(wx, -24, wz);
              const lh = hash3i(wx, wy, wz, seedMix.s1 + 419);
              if (uBioCol === UNDERGROUND_BIOMES.LUSH_CAVE) {
                data[below] = B.MOSS_BLOCK;
                if (lh > 0.90) data[i] = B.MUSHROOM_GLOW;
                else if (lh > 0.72) data[i] = B.FERN;
                else if (lh > 0.64) data[i] = B.FLOWER_YELLOW;
                else if (lh < 0.14 && wy <= -10 && ly >= 4 && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
                  const subBelow = ((ly - 2) << 8) | (lz << 4) | lx;
                  if (IS_SOLID[data[subBelow]] === 1 && IS_SOLID[data[below + 1]] === 1 && IS_SOLID[data[below - 1]] === 1 && IS_SOLID[data[below + 16]] === 1 && IS_SOLID[data[below - 16]] === 1) {
                    data[below] = B.WATER; data[i] = B.LILY_PAD;
                  }
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.CRYSTAL_CAVERN) {
                if (lh > 0.972) data[i] = B.GLOW_CRYSTAL;
                else if (lh < 0.10) data[below] = B.PRISMARINE;
              } else if (uBioCol === UNDERGROUND_BIOMES.DRIPSTONE_CAVE) {
                if (lh > 0.91) {
                  data[i] = B.SMOOTH_STONE;
                  if (ly + 1 < h - MIN_Y - 6 && data[above] === B.AIR) data[above] = B.STONE_WALL;
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.GLOWSHROOM_GROTTO) {
                data[below] = B.MYCELIUM;
                if (lh > 0.86) data[i] = B.MUSHROOM_GLOW;
              } else if (uBioCol === UNDERGROUND_BIOMES.ICE_CAVERN) {
                if (lh > 0.55) data[below] = B.PACKED_ICE;
                if (lh > 0.95) data[i] = B.SEA_LANTERN;
              } else if (lh > 0.962) {
                data[i] = B.MUSHROOM_GLOW;
              }
            } else if (ly + 1 < h - MIN_Y - 4 && (data[above] === B.STONE || data[above] === B.DIRT || data[above] === B.DEEPSLATE)) {
              if (!uBioCol) uBioCol = getUndergroundBiomeAt(wx, -24, wz);
              const vh = hash3i(wx, wy, wz, seedMix.s1 + 617);
              if (uBioCol === UNDERGROUND_BIOMES.LUSH_CAVE && vh > 0.80) {
                if (vh > 0.992) { data[i] = B.GLOW_CRYSTAL; }
                else {
                  data[above] = B.MOSS_BLOCK;
                  const vLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 619) * 4);
                  for (let d = 0; d < vLen && (ly - d) > 5; d++) {
                    const idxV = ((ly - d) << 8) | (lz << 4) | lx;
                    if (data[idxV] !== B.AIR) break;
                    data[idxV] = B.GLOW_VINES;
                  }
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.CRYSTAL_CAVERN && vh > 0.974) {
                data[i] = B.GLOW_CRYSTAL;
              } else if (uBioCol === UNDERGROUND_BIOMES.DRIPSTONE_CAVE && vh > 0.88) {
                const sLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 641) * 3);
                for (let d = 0; d < sLen && (ly - d) > 5; d++) {
                  const idxS = ((ly - d) << 8) | (lz << 4) | lx;
                  if (data[idxS] !== B.AIR) break;
                  data[idxS] = d === sLen - 1 ? B.STONE_WALL : B.STONE;
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.ICE_CAVERN && vh > 0.86) {
                const iLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 647) * 3);
                for (let d = 0; d < iLen && (ly - d) > 5; d++) {
                  const idxI = ((ly - d) << 8) | (lz << 4) | lx;
                  if (data[idxI] !== B.AIR) break;
                  data[idxI] = B.ICE;
                }
              }
            }
          }
        }
      }
    }

    // ===================== SEED-RANDOMIZED UNDERGROUND STRUCTURES (Mineshafts, Dungeons, Geodes, Ruins, Fossils, Camps) =====================
    let minSurfH = MAX_Y;
    for (let ci = 0; ci < 256; ci++) if (colHeights[ci] < minSurfH) minSurfH = colHeights[ci];
    if (minSurfH > MIN_Y + 18) {
      generateUndergroundStructures(data, cx, cz, wx0, wz0, 0, minSurfH - 4);
    }

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const ci = (lz << 4) | lx, h = colHeights[ci], wx = wx0 + lx, biome = BIOME_LIST[colBiomes[ci]];
        if (h <= WATER_LEVEL) {
          if (h < MIN_Y) continue;
          // Deep Ocean Coral Reefs, Towering Swaying Kelp Cliffs & Ultra-Deep Abyss Trench Hydrothermal Vents!
          if ((biome === BIOMES.DEEP_OCEAN || biome === BIOMES.ABYSS_TRENCH) && h <= WATER_LEVEL - 4) {
            const rc = hash2i(wx, wz, worldSeed + 787);
            const sly = (h + 1) - MIN_Y;
            if (h <= -28) {
              // Ultra-Deep Abyss Trench Floor: Hydrothermal Basalt Magma Vents & Bioluminescent Abyssal Crystals!
              if (rc > 0.986 && sly > 0 && sly < WORLD_H - 5) {
                data[(sly << 8) | (lz << 4) | lx] = B.BASALT;
                data[((sly + 1) << 8) | (lz << 4) | lx] = B.LAVA;
              } else if (rc > 0.990 && sly > 0 && sly < WORLD_H - 3) {
                data[(sly << 8) | (lz << 4) | lx] = rc > 0.994 ? B.GLOW_CRYSTAL : B.SEA_LANTERN;
              } else if (rc > 0.89 && sly > 0 && sly < WORLD_H - 8) {
                const kH = 3 + ((hash2i(wx + 7, wz - 5, worldSeed + 791) * 5) | 0);
                for (let ky = 0; ky < kH && (h + 1 + ky) < WATER_LEVEL - 2; ky++) {
                  const kly = sly + ky;
                  if (data[(kly << 8) | (lz << 4) | lx] === B.WATER) data[(kly << 8) | (lz << 4) | lx] = B.SEAGRASS;
                }
              }
            } else if (rc > 0.89 && sly > 0 && sly < WORLD_H - 3) {
              const cId = rc > 0.96 ? B.CORAL_GOLD : (rc > 0.92 ? B.CORAL_PINK : B.CORAL_BLUE);
              data[(sly << 8) | (lz << 4) | lx] = cId;
              if (rc > 0.945) data[((sly + 1) << 8) | (lz << 4) | lx] = (rc > 0.988 ? B.SEA_LANTERN : cId);
            } else if (rc > 0.72 && sly > 0 && sly < WORLD_H - 7 && data[(sly << 8) | (lz << 4) | lx] === B.WATER) {
              // Multi-block swaying kelp stalks rising gracefully off ocean shelves & cliffs!
              const kH = rc > 0.82 ? (2 + ((hash2i(wx + 3, wz + 9, worldSeed + 793) * 5) | 0)) : 1;
              for (let ky = 0; ky < kH && (h + 1 + ky) < WATER_LEVEL - 1; ky++) {
                const kly = sly + ky;
                if (data[(kly << 8) | (lz << 4) | lx] === B.WATER) data[(kly << 8) | (lz << 4) | lx] = B.SEAGRASS;
              }
            }
          } else if (h >= WATER_LEVEL - 5 && h <= WATER_LEVEL - 2 && hash2i(wx, wz, worldSeed + 733) > 0.76) {
            const sly = (h + 1) - MIN_Y;
            if (sly > 0 && sly < WORLD_H && data[(sly << 8) | (lz << 4) | lx] === B.WATER) data[(sly << 8) | (lz << 4) | lx] = B.SEAGRASS;
          }
          // Mangrove Trees can root directly in shallow swamp water!
          if (biome === BIOMES.MANGROVE_SWAMP && h >= WATER_LEVEL - 2 && lx >= 3 && lx <= CHUNK_W - 4 && lz >= 3 && lz <= CHUNK_W - 4 && hash2i(wx, wz, worldSeed + 909) > 0.956) {
            placeLuantiTree(data, lx, WATER_LEVEL + 1, lz, wx, wz, 'mangrove');
            const top = Math.min(WORLD_H - 1, (WATER_LEVEL + 13) - MIN_Y); if (top > maxLy) maxLy = top;
          }
          // Water surface Lily Pads & Pink Lotus Flowers in Swamps, Mangroves, Lush Groves & calm Plains coves
          if ((biome === BIOMES.SWAMP || biome === BIOMES.MANGROVE_SWAMP || biome === BIOMES.LUSH_GROVE || biome === BIOMES.PLAINS || biome === BIOMES.BLUE_FOREST || biome === BIOMES.PINE_VALLEY || biome === BIOMES.GIANT_JUNGLE) && h < WATER_LEVEL && hash2i(wx, wz, worldSeed + 511) > (biome === BIOMES.MANGROVE_SWAMP ? 0.84 : (biome === BIOMES.SWAMP ? 0.90 : (biome === BIOMES.LUSH_GROVE || biome === BIOMES.BLUE_FOREST ? 0.88 : 0.96)))) {
            const wly = WATER_LEVEL - MIN_Y, aly = (WATER_LEVEL + 1) - MIN_Y;
            if (data[(wly << 8) | (lz << 4) | lx] === B.WATER && data[(aly << 8) | (lz << 4) | lx] === B.AIR) {
              data[(aly << 8) | (lz << 4) | lx] = hash2i(wx + 9, wz - 3, worldSeed + 517) > 0.72 ? B.LOTUS : B.LILY_PAD;
              if (aly > maxLy) maxLy = aly;
            }
          }
          continue;
        }
        const surfTopId = data[((h - MIN_Y) << 8) | ci];
        if (!surfTopId || IS_SOLID[surfTopId] !== 1) continue;
        // Natural Sugar Cane growing 2-4 blocks tall right along sunlit rivers, lakes & shorelines (Image 2!)
        let placedSugarCane = false;
        if (h === WATER_LEVEL + 1 && biome !== BIOMES.WHEAT_VALLEY && hash2i(wx + 31, wz - 17, worldSeed + 701) > 0.78) {
          const nearW = !_isUniformBiome
            ? ((lx < 15 ? colHeights[ci + 1] : getTerrainHeight(wx + 1, wz, getBiomeAt(wx + 1, wz))) <= WATER_LEVEL ||
               (lx > 0 ? colHeights[ci - 1] : getTerrainHeight(wx - 1, wz, getBiomeAt(wx - 1, wz))) <= WATER_LEVEL ||
               (lz < 15 ? colHeights[ci + 16] : getTerrainHeight(wx, wz + 1, getBiomeAt(wx, wz + 1))) <= WATER_LEVEL ||
               (lz > 0 ? colHeights[ci - 16] : getTerrainHeight(wx, wz - 1, getBiomeAt(wx, wz - 1))) <= WATER_LEVEL)
            : (getTerrainHeight(wx + 1, wz, getBiomeAt(wx + 1, wz)) <= WATER_LEVEL || getTerrainHeight(wx - 1, wz, getBiomeAt(wx - 1, wz)) <= WATER_LEVEL || getTerrainHeight(wx, wz + 1, getBiomeAt(wx, wz + 1)) <= WATER_LEVEL || getTerrainHeight(wx, wz - 1, getBiomeAt(wx, wz - 1)) <= WATER_LEVEL);
          if (nearW) {
            const caneH = 2 + Math.floor(hash2i(wx, wz, worldSeed + 709) * 3);
            for (let ch = 1; ch <= caneH; ch++) setLocalSafe(data, lx, h + ch, lz, B.SUGAR_CANE, false);
            const cly = (h + caneH) - MIN_Y; if (cly > maxLy) maxLy = cly;
            placedSugarCane = true;
          }
        }
        if (!placedSugarCane && (biome === BIOMES.MESA || biome === BIOMES.BADLANDS_SPIRES || biome === BIOMES.BADLANDS_CRATER || biome === BIOMES.DESERT) && surfTopId === B.RED_SAND) {
          if (hash2i(wx, wz, worldSeed + 649) > 0.945) {
            setLocalSafe(data, lx, h + 1, lz, B.DEAD_BUSH, false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          }
        }
        if (!placedSugarCane && (biome === BIOMES.PLAINS || biome === BIOMES.GREEN_PLAINS || biome === BIOMES.SNOWY_PLAINS || biome === BIOMES.FOREST || biome === BIOMES.SAKURA || biome === BIOMES.SWAMP || biome === BIOMES.MANGROVE_SWAMP || biome === BIOMES.HIGHLAND_PLATEAU || biome === BIOMES.CLOUD_PEAKS || biome === BIOMES.ALPINE_PEAKS || biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_GOLDEN || biome === BIOMES.AUTUMN_DEEP || biome === BIOMES.LUSH_GROVE || biome === BIOMES.FLOWER_MEADOW || biome === BIOMES.LAVENDER_MEADOW || biome === BIOMES.BAMBOO_JUNGLE || biome === BIOMES.TAIGA || biome === BIOMES.REDWOOD_ANCIENT || biome === BIOMES.WEEPING_GROVE || biome === BIOMES.BIRCH_ANCIENT
            || biome === BIOMES.GLOWSHROOM_GROVE || biome === BIOMES.DAPPLED_FOREST || biome === BIOMES.MARSH_RUINS || biome === BIOMES.TROPICAL_COAST || biome === BIOMES.GIANT_TREES || biome === BIOMES.MANOR_GARDEN
            || biome === BIOMES.BLUE_FOREST || biome === BIOMES.WHEAT_VALLEY || biome === BIOMES.PINE_VALLEY || biome === BIOMES.GIANT_JUNGLE)) {
          const rf = hash2i(wx, wz, worldSeed + 613);
          const gClump = valueNoise2D(wx * 0.16, wz * 0.16, worldSeed + 617);
          const grassGate = gClump > 0.42 ? 0.56 : 0.72; // Scenic sunlit clumps instead of noisy uniform carpet (~40% faster GPU!)
          if (biome === BIOMES.LAVENDER_MEADOW && rf > 0.48) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.78 ? B.ALLIUM : (rf > 0.62 ? B.FLOWER_LAVENDER : (rf > 0.54 ? B.CLOVER_PATCH : B.TALL_GRASS)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.BAMBOO_JUNGLE && rf > 0.50) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.965 ? B.MELON_BLOCK : (rf > 0.88 ? B.BAMBOO_SHOOT : (rf > 0.79 ? B.WILD_TALL_GRASS : (rf > 0.70 ? B.BUSH_GRASS : (rf > 0.62 ? B.SHORT_GRASS : (rf > 0.56 ? B.FERN : B.BLUE_ORCHID))))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.SAKURA && rf > 0.54) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.78 ? B.SAKURA_PETALS : (rf > 0.71 ? B.ALLIUM : (rf > 0.65 ? B.BLUE_ORCHID : (rf > 0.59 ? B.FLOWER_RED : (rf > 0.56 ? B.OXEYE_DAISY : B.CLOVER_PATCH)))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.BLUE_FOREST) {
            if (surfTopId === B.BLUE_GRASS) {
              if (rf > 0.44) {
                setLocalSafe(data, lx, h + 1, lz, rf > 0.88 ? B.FLOWER_LAVENDER : (rf > 0.78 ? B.ALLIUM : (rf > 0.70 ? B.SAKURA_PETALS : B.TEAL_FERN)), false);
                const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
              }
            } else if (surfTopId === B.AUTUMN_PODZOL && hash2i(wx, wz, worldSeed + 819) > 0.972 && lx > 1 && lx < 14 && lz > 1 && lz < 14) {
              setLocalSafe(data, lx, h + 1, lz, B.OAK_FENCE, true);
              setLocalSafe(data, lx, h + 2, lz, B.OAK_FENCE, true);
              setLocalSafe(data, lx, h + 3, lz, B.LANTERN, true);
              const ply = (h + 3) - MIN_Y; if (ply > maxLy) maxLy = ply;
            }
          } else if (biome === BIOMES.WHEAT_VALLEY) {
            if (surfTopId === B.FARMLAND) {
              setLocalSafe(data, lx, h + 1, lz, B.WHEAT_3, false);
            } else if (surfTopId === B.STONE_BRICK || surfTopId === B.DIRT) {
              const inMega = isWheatMegaPlain(wx, wz);
              const isPost = inMega
                ? ((Math.abs(wx - WHEAT_PLAIN_CX) === 1 && wz >= WHEAT_PLAIN_CZ - 28 && wz <= WHEAT_PLAIN_CZ + 6 && ((wz - WHEAT_PLAIN_CZ) % 8 === 0)) || ((wx & 31) === 0 && (wz & 31) === 0))
                : ((wx & 15) === 0 && (wz & 15) === 0);
              if (isPost) {
                setLocalSafe(data, lx, h + 1, lz, B.OAK_FENCE, true);
                setLocalSafe(data, lx, h + 2, lz, B.TORCH_BLOCK, true);
                const postLy = (h + 2) - MIN_Y; if (postLy > maxLy) maxLy = postLy;
              } else if (rf > 0.92 && surfTopId === B.DIRT) {
                setLocalSafe(data, lx, h + 1, lz, B.HAY_BALE, true);
              }
            }
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.PINE_VALLEY && rf > 0.46) {
            const nearWater = h <= WATER_LEVEL + 2;
            const pid = (nearWater && rf > 0.68) ? B.CATTAIL_REED : (rf > 0.86 ? B.WILD_TALL_GRASS : (rf > 0.72 ? B.BUSH_GRASS : (rf > 0.58 ? B.FERN : B.SHORT_GRASS)));
            setLocalSafe(data, lx, h + 1, lz, pid, false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.GIANT_JUNGLE && rf > 0.44) {
            const jid = rf > 0.968 ? B.MELON_BLOCK : (rf > 0.82 ? B.WILD_TALL_GRASS : (rf > 0.68 ? B.BUSH_GRASS : (rf > 0.56 ? B.FERN : B.SHORT_GRASS)));
            setLocalSafe(data, lx, h + 1, lz, jid, false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.FLOWER_MEADOW && rf > 0.48) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.88 ? B.FLOWER_RED : (rf > 0.78 ? B.BLUE_ORCHID : (rf > 0.68 ? B.ALLIUM : (rf > 0.58 ? B.OXEYE_DAISY : (rf > 0.52 ? B.FLOWER_YELLOW : B.CLOVER_PATCH)))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if ((biome === BIOMES.LUSH_GROVE || biome === BIOMES.WEEPING_GROVE) && rf > 0.48) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.968 ? B.MELON_BLOCK : (rf > 0.91 ? B.MUSHROOM_GLOW : (rf > 0.83 ? B.WILD_TALL_GRASS : (rf > 0.72 ? B.BUSH_GRASS : (rf > 0.62 ? B.SHORT_GRASS : (rf > 0.54 ? B.BLUE_ORCHID : B.FERN))))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if ((biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_GOLDEN || biome === BIOMES.AUTUMN_DEEP) && rf > 0.52) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.90 ? B.BLUEBERRY : (rf > 0.76 ? B.AUTUMN_BUSH : (rf > 0.62 ? B.AUTUMN_GRASS : B.CLOVER_PATCH)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.GLOWSHROOM_GROVE && rf > 0.48) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.86 ? B.MUSHROOM_GLOW : (rf > 0.72 ? B.WARPED_FUNGUS : (rf > 0.60 ? B.FERN : B.CLOVER_PATCH)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.MANOR_GARDEN && rf > 0.44) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.82 ? B.FLOWER_RED : (rf > 0.70 ? B.OXEYE_DAISY : (rf > 0.58 ? B.ALLIUM : (rf > 0.50 ? B.BLUE_ORCHID : B.CLOVER_PATCH))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.MARSH_RUINS && rf > 0.50) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.84 ? B.MUSHROOM_GLOW : (rf > 0.72 ? B.BLUE_ORCHID : (rf > 0.60 ? B.FERN : B.TALL_GRASS)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.DAPPLED_FOREST && rf > 0.52) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.88 ? B.BLUEBERRY : (rf > 0.72 ? B.AUTUMN_BUSH : (rf > 0.60 ? B.AUTUMN_GRASS : B.CLOVER_PATCH)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.GREEN_PLAINS) {
            if (surfTopId === B.GRASS && rf > 0.24) {
              setLocalSafe(data, lx, h + 1, lz, rf > 0.96 ? B.FLOWER_YELLOW : (rf > 0.92 ? B.OXEYE_DAISY : (rf > 0.88 ? B.FLOWER_RED : (rf > 0.72 ? B.WILD_TALL_GRASS : (rf > 0.52 ? B.BUSH_GRASS : (rf > 0.38 ? B.SHORT_GRASS : B.TALL_GRASS))))), false);
              const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
            }
          } else if (biome === BIOMES.SNOWY_PLAINS) {
            if (surfTopId === B.SNOWY_DIRT && rf > 0.82) {
              setLocalSafe(data, lx, h + 1, lz, B.SNOWY_GRASS, false);
              const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
            }
          } else if ((biome !== BIOMES.CLOUD_PEAKS && biome !== BIOMES.ALPINE_PEAKS || surfTopId === B.GRASS) && rf > grassGate) {
            setLocalSafe(data, lx, h + 1, lz, (biome === BIOMES.FOREST && rf > 0.982) ? B.MELON_BLOCK : ((biome === BIOMES.TAIGA && rf > 0.95) ? B.BLUEBERRY : (rf > 0.96 ? B.BERRY_BUSH : (rf > 0.90 ? B.WILD_TALL_GRASS : (rf > 0.83 ? B.BUSH_GRASS : (rf > 0.77 ? B.SHORT_GRASS : (rf > 0.72 ? B.FERN : (rf > 0.67 ? B.OXEYE_DAISY : (rf > 0.63 ? B.BLUE_ORCHID : (rf > 0.59 ? B.CLOVER_PATCH : B.TALL_GRASS))))))))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          }
        }
        if (!placedSugarCane && lx >= 3 && lx <= CHUNK_W - 4 && lz >= 3 && lz <= CHUNK_W - 4) {
          const rTree = hash2i(wx, wz, worldSeed + 909);
          const inGiantSafe = (lx >= 4 && lx <= 10 && lz >= 4 && lz <= 10);
          let placed = false;
          if (biome === BIOMES.GLOWSHROOM_GROVE && inGiantSafe && rTree > 0.84) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'giant_mushroom'); placed = true; }
          else if (biome === BIOMES.DAPPLED_FOREST && rTree > 0.946) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'autumn_maple'); placed = true; }
          else if (biome === BIOMES.MARSH_RUINS && rTree > 0.952) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 933) > 0.5 ? 'willow' : 'mangrove'); placed = true; }
          else if (biome === BIOMES.TROPICAL_COAST && rTree > 0.938) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 935) > 0.52 ? 'palm' : 'canopy_jungle'); placed = true; }
          else if (biome === BIOMES.GIANT_TREES && inGiantSafe && rTree > 0.962) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, rTree > 0.985 ? 'giant_mushroom' : 'giant_redwood'); placed = true; }
          else if (biome === BIOMES.MANOR_GARDEN && rTree > 0.972) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 937) > 0.5 ? 'sculpted_birch' : 'apple'); placed = true; }
          else if (biome === BIOMES.BADLANDS_SPIRES && surfTopId === B.RED_SAND && rTree > 0.992) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'cactus'); placed = true; }
          else if (biome === BIOMES.BAMBOO_JUNGLE && rTree > 0.86) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && rTree > 0.972) ? 'canopy_jungle' : 'bamboo'); placed = true; }
          else if (biome === BIOMES.REDWOOD_ANCIENT && inGiantSafe && rTree > 0.968) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, rTree > 0.988 ? 'giant_mushroom' : 'giant_redwood'); placed = true; }
          else if (biome === BIOMES.WEEPING_GROVE && inGiantSafe && rTree > 0.958) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 939) > 0.55 ? 'canopy_jungle' : 'ancient_vine_tree'); placed = true; }
          else if (biome === BIOMES.BIRCH_ANCIENT && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 941) > 0.55 ? 'birch_bent' : 'sculpted_birch'); placed = true; }
          else if (biome === BIOMES.MUSHROOM_ISLAND && inGiantSafe && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'giant_mushroom'); placed = true; }
          else if (biome === BIOMES.LAVENDER_MEADOW && rTree > 0.972) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'willow'); placed = true; }
          else if (biome === BIOMES.BEACH_PALM && h >= 1 && h <= 6 && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'palm'); placed = true; }
          else if (biome === BIOMES.MANGROVE_SWAMP && rTree > 0.952) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'mangrove'); placed = true; }
          else if ((biome === BIOMES.ALPINE_PEAKS || biome === BIOMES.CLOUD_PEAKS) && h <= 22 && surfTopId === B.GRASS && rTree > 0.968) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'pine'); placed = true; }
          else if (biome === BIOMES.HIGHLAND_PLATEAU && rTree > 0.978) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 913) > 0.5 ? 'baobab' : 'sculpted_birch'); placed = true; }
          else if (biome === BIOMES.FOREST && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && rTree > 0.988) ? 'broadleaf' : (hash2i(wx, wz, worldSeed + 911) > 0.72 ? 'canopy_jungle' : (hash2i(wx, wz, worldSeed + 912) > 0.44 ? 'sculpted_birch' : 'apple'))); placed = true; }
          else if (biome === BIOMES.PLAINS && surfTopId === B.GRASS && rTree > 0.996) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'apple'); placed = true; }
          else if (biome === BIOMES.GREEN_PLAINS && surfTopId === B.GRASS && rTree > 0.9988) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'apple'); placed = true; }
          else if (biome === BIOMES.SAKURA && rTree > 0.942) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'sakura'); placed = true; }
          else if ((biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_GOLDEN || biome === BIOMES.AUTUMN_DEEP) && rTree > 0.950) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, biome === BIOMES.AUTUMN_GOLDEN ? 'acacia' : (hash2i(wx, wz, worldSeed + 917) > 0.30 ? 'autumn_maple' : 'acacia')); placed = true; }
          else if (biome === BIOMES.LUSH_GROVE && rTree > 0.950) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && hash2i(wx, wz, worldSeed + 919) > 0.55) ? 'ancient_vine_tree' : 'canopy_jungle'); placed = true; }
          else if ((biome === BIOMES.FOREST || biome === BIOMES.LUSH_GROVE) && rTree > 0.938 && rTree <= 0.946) { placeLeafBushCluster(data, lx, h + 1, lz, wx, wz, B.OAK_LEAVES); placed = true; }
          else if (biome === BIOMES.FLOWER_MEADOW && rTree > 0.980) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 921) > 0.50 ? 'sakura' : 'sculpted_birch'); placed = true; }
          else if ((biome === BIOMES.SNOW || biome === BIOMES.SNOWY_PLAINS || biome === BIOMES.TAIGA) && rTree > (biome === BIOMES.SNOWY_PLAINS ? 0.990 : (biome === BIOMES.TAIGA ? 0.950 : 0.964))) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && biome === BIOMES.TAIGA && rTree > 0.978) ? 'giant_redwood' : 'pine'); placed = true; }
          else if (biome === BIOMES.SWAMP && rTree > 0.972) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 925) > 0.5 ? 'willow' : 'mangrove'); placed = true; }
          else if (biome === BIOMES.DESERT && rTree > 0.984) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'cactus'); placed = true; }
          else if (biome === BIOMES.BLUE_FOREST && surfTopId === B.BLUE_GRASS && rTree > 0.940) {
            const bt = hash2i(wx, wz, worldSeed + 951);
            const st = bt > 0.89 ? 'giant_mushroom' : (bt > 0.60 ? 'azure_pine' : (bt > 0.40 ? 'cobalt_willow' : 'azure_tree'));
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, st); placed = true;
          }
          else if (biome === BIOMES.PINE_VALLEY && surfTopId === B.GRASS && rTree > 0.942) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && rTree > 0.986) ? 'giant_redwood' : 'tall_pine'); placed = true;
          }
          else if (biome === BIOMES.GIANT_JUNGLE && rTree > 0.952) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && rTree > 0.972) ? 'mega_jungle' : 'canopy_jungle'); placed = true;
          }
          else if (biome === BIOMES.DARK_FOREST && rTree > 0.946) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, rTree > 0.976 ? 'dark_oak' : 'giant_mushroom'); placed = true;
          }
          else if (biome === BIOMES.PALE_GARDEN && rTree > 0.952) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'pale_oak'); placed = true;
          }
          else if (biome === BIOMES.NIGHTMARE_WOODS && rTree > 0.954) {
            placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'nightmare_tree'); placed = true;
          }
          else if (biome === BIOMES.LUSH_STEPPE && surfTopId === B.GRASS && rTree > 0.992) {
            placeLeafBushCluster(data, lx, h + 1, lz, wx, wz, B.OAK_LEAVES); placed = true;
          }
          else if (biome === BIOMES.GIANT_JUNGLE && rTree > 0.934 && rTree <= 0.944) {
            placeLeafBushCluster(data, lx, h + 1, lz, wx, wz, B.JUNGLE_LEAVES); placed = true;
          }
          if (placed) {
            if (biome === BIOMES.FOREST || biome === BIOMES.AUTUMN || biome === BIOMES.SAKURA || biome === BIOMES.PINE_VALLEY) {
              if (lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13 && hash2i(wx + 5, wz - 5, worldSeed + 997) > 0.52) {
                placeLeafBushCluster(data, lx + (rTree > 0.97 ? 1 : -1), h + 1, lz + 1, wx + 1, wz + 1, biome === BIOMES.SAKURA ? B.SAKURA_LEAVES : B.OAK_LEAVES);
              }
            }
            const top = Math.min(WORLD_H - 1, (h + 30) - MIN_Y); if (top > maxLy) maxLy = top;
          }
        }
      }
    }

    // Abandoned Explorer Autumn Campsite (rarer so world isn't littered with huts)
    const midB = BIOME_LIST[colBiomes[(8 << 4) | 8]];
    const midH = colHeights[(8 << 4) | 8];
    if ((midB === BIOMES.AUTUMN_DEEP || midB === BIOMES.AUTUMN) && midH > WATER_LEVEL + 1 && (Math.abs(cx) > 2 || Math.abs(cz) > 2) && hash2i(cx, cz, worldSeed + 2309) > 0.978) {
      const cy = midH;
      for (let dz = 4; dz <= 11; dz++) for (let dx = 4; dx <= 11; dx++) {
        for (let wy = cy - 2; wy <= cy; wy++) setLocalSafe(data, dx, wy, dz, wy === cy ? B.AUTUMN_PODZOL : B.DIRT, true);
        for (let wy = cy + 1; wy <= cy + 6; wy++) data[((wy - MIN_Y) << 8) | (dz << 4) | dx] = B.AIR;
      }
      // White Wool A-Frame Tent (lx 4..8, lz 4..8) — v29: NÂNG CAO 1 block để người chơi đi vào được
      for (let tz = 4; tz <= 8; tz++) {
        setLocalSafe(data, 4, cy + 2, tz, B.WHITE_WOOL, true); setLocalSafe(data, 8, cy + 2, tz, B.WHITE_WOOL, true);
        setLocalSafe(data, 5, cy + 3, tz, B.WHITE_WOOL, true); setLocalSafe(data, 7, cy + 3, tz, B.WHITE_WOOL, true);
        setLocalSafe(data, 6, cy + 4, tz, B.WHITE_WOOL, true);
      }
      // Cửa lều mở thông 3×3 ở CẢ HAI ĐẦU (không còn cọc chắn lối vào)
      for (const tz of [4, 8]) for (let ty = cy + 1; ty <= cy + 3; ty++) {
        setLocalSafe(data, 6, ty, tz, B.AIR, true);
        setLocalSafe(data, 5, ty, tz, B.AIR, true);
        setLocalSafe(data, 7, ty, tz, B.AIR, true);
      }
      // Cọc đèn đặt NGOÀI lối đi hai bên cửa
      setLocalSafe(data, 4, cy + 1, 4, B.OAK_FENCE, true); setLocalSafe(data, 4, cy + 2, 4, B.LANTERN, true);
      setLocalSafe(data, 8, cy + 1, 8, B.OAK_FENCE, true); setLocalSafe(data, 8, cy + 2, 8, B.LANTERN, true);
      setLocalSafe(data, 5, cy + 1, 6, B.BED_FOOT, true); setLocalSafe(data, 5, cy + 1, 5, B.BED, true);
      setLocalSafe(data, 7, cy + 1, 5, B.CHEST, true);
      setLocalSafe(data, 7, cy + 2, 7, B.COBWEB, true);
      // Campfire + Oak Log Seats + Crafting Table + Lantern Pole!
      setLocalSafe(data, 9, cy + 1, 9, B.CAMPFIRE, true);
      setLocalSafe(data, 11, cy + 1, 9, B.OAK_LOG, true); setLocalSafe(data, 9, cy + 1, 11, B.OAK_LOG, true);
      setLocalSafe(data, 10, cy + 1, 6, B.CRAFT_TABLE, true); setLocalSafe(data, 11, cy + 1, 6, B.FURNACE, true);
      setLocalSafe(data, 4, cy + 1, 10, B.OAK_FENCE, true); setLocalSafe(data, 4, cy + 2, 10, B.OAK_FENCE, true); setLocalSafe(data, 4, cy + 3, 10, B.LANTERN, true);
      const topCamp = Math.min(WORLD_H - 1, (cy + 6) - MIN_Y); if (topCamp > maxLy) maxLy = topCamp;
    }

    // Open-World Starter Meadow/Forest Cottage w/ Working Oak Door & Warm Porch Lantern (significantly rarer!)
    if ((midB === BIOMES.PLAINS || midB === BIOMES.FOREST || midB === BIOMES.FLOWER_MEADOW || midB === BIOMES.SAKURA) && midH > WATER_LEVEL + 1 && midH < 14 && (Math.abs(cx) > 2 || Math.abs(cz) > 2) && hash2i(cx, cz, worldSeed + 2477) > 0.9955) {
      const cy = midH;
      for (let dz = 3; dz <= 12; dz++) for (let dx = 3; dx <= 12; dx++) {
        // Móng bám theo địa hình thật của từng cột: đắp đá xuống tới mặt đất, không tạo sân phẳng lơ lửng
        let gy = cy - 6;
        for (let wy = Math.min(MAX_Y - 1, cy + 2); wy >= Math.max(MIN_Y + 1, cy - 8); wy--) {
          const bid = data[((wy - MIN_Y) << 8) | (dz << 4) | dx];
          const bd = BLOCK_DEF[bid];
          if (bid !== B.AIR && bid !== B.WATER && bd && bd.solid && !bd.foliage) { gy = wy; break; }
        }
        for (let wy = gy + 1; wy < cy; wy++) setLocalSafe(data, dx, wy, dz, B.STONE_BRICK, true);
        setLocalSafe(data, dx, cy, dz, (dx === 3 || dx === 12 || dz === 3 || dz === 11) ? B.STONE_BRICK : B.PLANKS, true);
        for (let wy = cy + 1; wy <= cy + 9; wy++) data[((wy - MIN_Y) << 8) | (dz << 4) | dx] = B.AIR;
      }
      const wallLog = midB === BIOMES.SAKURA ? B.SAKURA_LOG : B.OAK_LOG;
      const doorType = midB === BIOMES.SAKURA ? B.SAKURA_DOOR : B.OAK_DOOR;
      for (let dz = 4; dz <= 10; dz++) for (let dx = 4; dx <= 11; dx++) {
        const isC = ((dx === 4 || dx === 11) && (dz === 4 || dz === 10));
        const isW = (dx === 4 || dx === 11 || dz === 4 || dz === 10);
        for (let wy = 1; wy <= 3; wy++) {
          if (isC) setLocalSafe(data, dx, cy + wy, dz, wallLog, true);
          else if (dx === 7 && dz === 10 && wy === 1) setLocalSafe(data, dx, cy + wy, dz, doorType, true);
          else if (dx === 7 && dz === 10 && wy === 2) setLocalSafe(data, dx, cy + wy, dz, B.AIR, true);
          else if (wy === 2 && ((dz === 10 && (dx === 5 || dx === 9)) || ((dx === 4 || dx === 11) && dz === 7))) setLocalSafe(data, dx, cy + wy, dz, B.GLASS, true);
          else if (isW) setLocalSafe(data, dx, cy + wy, dz, wy === 1 ? B.STONE_BRICK : B.PLANKS, true);
        }
      }
      // Pitched Roof + Front Porch w/ Fence Rail & Hanging Lantern above Door!
      for (let s = 0; s <= 4; s++) {
        for (let dx = 3; dx <= 12; dx++) {
          const rm = (dx === 3 || dx === 12 || s === 4) ? B.SPRUCE_LOG : B.PLANKS;
          setLocalSafe(data, dx, cy + 4 + s, 3 + s, rm, true);
          setLocalSafe(data, dx, cy + 4 + s, 11 - s, rm, true);
          if ((dx === 4 || dx === 11) && s < 4) {
            for (let iz = 4 + s; iz <= 10 - s; iz++) setLocalSafe(data, dx, cy + 4 + s, iz, B.PLANKS, true);
          }
        }
      }
      setLocalSafe(data, 5, cy + 1, 11, B.OAK_FENCE, true); setLocalSafe(data, 6, cy + 1, 11, B.OAK_FENCE, true);
      setLocalSafe(data, 8, cy + 1, 11, B.OAK_FENCE, true); setLocalSafe(data, 9, cy + 1, 11, B.OAK_FENCE, true);
      setLocalSafe(data, 7, cy + 3, 11, B.LANTERN, true);
      setLocalSafe(data, 5, cy + 1, 5, B.BED, true); setLocalSafe(data, 6, cy + 1, 5, B.BED_FOOT, true);
      setLocalSafe(data, 10, cy + 1, 5, B.CHEST, true); setLocalSafe(data, 9, cy + 1, 5, B.CRAFT_TABLE, true);
      setLocalSafe(data, 10, cy + 1, 6, B.FURNACE, true); setLocalSafe(data, 7, cy + 3, 7, B.LANTERN, true);
      const topCot = Math.min(WORLD_H - 1, (cy + 9) - MIN_Y); if (topCot > maxLy) maxLy = topCot;
    }

    // === v42 Natural Gravel (Đá Sỏi) Patches & Underground Stronghold (Pháo Đài Cổng Kết Thúc) ===
    if (currentDimension === 'overworld') {
      // 0) Abandoned Ruins (Tàn Tích Bỏ Hoang) where Dream Portal awakens after clearing guardians!
      const dreamRuins = getDreamRuinLocations();
      for (let ri = 0; ri < dreamRuins.length; ri++) {
        const rn = dreamRuins[ri];
        if (Math.abs(wx0 + 8 - rn.x) <= 18 && Math.abs(wz0 + 8 - rn.z) <= 18) {
          const baseY = Math.max(WATER_LEVEL + 1, getTerrainHeight(rn.x, rn.z, getBiomeAt(rn.x, rn.z)));
          rn.y = baseY;
          for (let rz = -7; rz <= 7; rz++) {
            for (let rx = -7; rx <= 7; rx++) {
              const lx = (rn.x + rx) - wx0, lz = (rn.z + rz) - wz0;
              if (lx < 0 || lx >= CHUNK_W || lz < 0 || lz >= CHUNK_W) continue;
              const dist = Math.hypot(rx, rz);
              if (dist > 7.4) continue;
              // Stone plaza floor + clear air above
              setLocalSafe(data, lx, baseY - 1, lz, B.STONE_BRICK);
              setLocalSafe(data, lx, baseY, lz, ((Math.abs(rx) + Math.abs(rz)) % 3 === 0) ? B.MOSS_BLOCK : B.STONE_BRICK);
              for (let ay = 1; ay <= 8; ay++) setLocalSafe(data, lx, baseY + ay, lz, B.AIR);
              // 4 weathered corner ruin pillars + glowing lanterns
              if (Math.abs(rx) === 5 && Math.abs(rz) === 5) {
                const ph = 4 + ((rx + rz) & 1);
                for (let py = 1; py <= ph; py++) setLocalSafe(data, lx, baseY + py, lz, B.STONE_BRICK);
                setLocalSafe(data, lx, baseY + ph + 1, lz, B.LANTERN);
              }
              // Central dormant altar pedestal (Dream Portal rises right here once cleared!)
              if (Math.abs(rx) <= 2 && Math.abs(rz) <= 1) {
                setLocalSafe(data, lx, baseY + 1, lz, B.STONE_BRICK);
              }
            }
          }
          const topRn = Math.min(WORLD_H - 1, (baseY + 9) - MIN_Y);
          if (topRn > maxLy) maxLy = topRn;
        }
      }

      // 1) Gravel patches near beaches/water & underground pockets
      for (let lz = 0; lz < CHUNK_W; lz++) {
        for (let lx = 0; lx < CHUNK_W; lx++) {
          const wx = wx0 + lx, wz = wz0 + lz;
          const topH = colHeights[(lz << 4) | lx];
          if (topH >= WATER_LEVEL - 3 && topH <= WATER_LEVEL + 4) {
            if (fbm2(wx * 0.048 + 311, wz * 0.048 - 197, 2) > 0.66) {
              for (let dy = 0; dy <= 2; dy++) {
                const ly = (topH - dy) - MIN_Y;
                if (ly > 2 && ly < WORLD_H - 2) {
                  const idx = (ly << 8) | (lz << 4) | lx;
                  const cur = data[idx];
                  if (cur === B.SAND || cur === B.DIRT || cur === B.GRASS || cur === B.STONE) data[idx] = B.GRAVEL;
                }
              }
            }
          }
          // Underground gravel pockets (y = -24 .. 16)
          const gUg = hash3(wx >> 2, 17, wz >> 2);
          if (gUg > 0.89) {
            const pocketY = Math.floor(-20 + hash2(wx >> 2, wz >> 2) * 34);
            for (let dy = -1; dy <= 1; dy++) {
              const ly = (pocketY + dy) - MIN_Y;
              if (ly > 2 && ly < WORLD_H - 4) {
                const idx = (ly << 8) | (lz << 4) | lx;
                if (data[idx] === B.STONE) data[idx] = B.GRAVEL;
              }
            }
          }
        }
      }

      // 2) Deterministic Underground Stronghold Ruined Castle (3 Strongholds buried at y=-26 in a ring around spawn)
      maxLy = stampStrongholdCitadelInChunk(data, wx0, wz0, depthOffset || 0, maxLy);
      if (typeof stampAncientCityInChunk === 'function') {
        maxLy = stampAncientCityInChunk(data, wx0, wz0, depthOffset || 0, maxLy);
      }
      if (typeof stampDragonNestInChunk === 'function') {
        maxLy = stampDragonNestInChunk(data, wx0, wz0, depthOffset || 0, maxLy);
      }
      if ((depthOffset || 0) === 0) {
        if (isWheatMegaPlain(wx0 + 8, wz0 + 8) || getBiomeAt(wx0 + 8, wz0 + 8) === BIOMES.WHEAT_VALLEY) {
          maxLy = stampWheatPlainWindmills(data, wx0, wz0, maxLy);
        }
        maxLy = stampPlainsVillageInChunk(data, cx, cz, wx0, wz0, maxLy);
        if (typeof stampOverworldMegaStructures === 'function') maxLy = stampOverworldMegaStructures(data, cx, cz, wx0, wz0, maxLy);
      }
    }

    maxLy = applyChunkMods(cx, cz, data, maxLy);

    const ch = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), ch);
    // Mark already-meshed neighbors as low-priority borderDirty (avoids 4x redundant stutter rebuilds while sprinting!)
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return ch;
  }

  function markChunkDirty(cx, cz, urgent = false) {
    const c = chunks.get(chunkKey(cx, cz));
    if (c) {
      c.dirty = true; _dirtyChunkSet.add(c);
      if (urgent) { c.urgentDirty = true; _urgentChunkSet.add(c); }
    }
  }
  function markAllLoadedChunksDirty(urgentNear = false) {
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    for (const ch of chunks.values()) {
      ch.dirty = true;
      ch._emitDirty = true;
      _dirtyChunkSet.add(ch);
      if (urgentNear && Math.abs(ch.cx - pcx) <= 1 && Math.abs(ch.cz - pcz) <= 1) {
        ch.urgentDirty = true;
        _urgentChunkSet.add(ch);
      }
    }
  }
  function markChunkBorderDirty(cx, cz) {
    const c = chunks.get(chunkKey(cx, cz));
    if (c && !c.dirty) { c.borderDirty = true; _borderChunkSet.add(c); }
  }
  function getBlockWorld(wx, wy, wz) {
    if (wy < MIN_Y) return currentDimension === 'end' ? B.AIR : B.BEDROCK; if (wy > MAX_Y) return B.AIR;
    const c = _getChunkFast(wx >> 4, wz >> 4);
    return c ? c.data[((wy - MIN_Y) << 8) | ((wz & 15) << 4) | (wx & 15)] : B.AIR;
  }
  function isSolidAt(wx, wy, wz) {
    if (wy < MIN_Y) return currentDimension !== 'end';
    if (wy > MAX_Y) return false;
    const c = _getChunkFast(wx >> 4, wz >> 4);
    if (!c) return false;
    const idx = ((wy - MIN_Y) << 8) | ((wz & 15) << 4) | (wx & 15);
    const id = c.data[idx];
    if (IS_SOLID[id] !== 1) {
      if (wy > MIN_Y) {
        const belowId = c.data[idx - 256];
        if (IS_DOOR[belowId] === 1) return !doorOpenState.get(modKey(wx, wy - 1, wz));
      }
      return false;
    }
    if (IS_DOOR_OR_TRAP[id] === 1) return !doorOpenState.get(modKey(wx, wy, wz));
    return true;
  }
  const _fwBoxBuf = new Float32Array(30);
  function _fenceWallCanConnect(nb) {
    const d = BLOCK_DEF_ARR[nb];
    return !!(d && (d.fence || d.wall || IS_OPAQUE[nb] === 1));
  }
  function _fillFenceWallBoxes(wx, wy, wz, id) {
    const def = BLOCK_DEF_ARR[id];
    if (!def) return 0;
    const cPX = _fenceWallCanConnect(getBlockWorld(wx + 1, wy, wz));
    const cNX = _fenceWallCanConnect(getBlockWorld(wx - 1, wy, wz));
    const cPZ = _fenceWallCanConnect(getBlockWorld(wx, wy, wz + 1));
    const cNZ = _fenceWallCanConnect(getBlockWorld(wx, wy, wz - 1));
    let n = 0;
    const pushBox = (x0, y0, z0, x1, y1, z1) => {
      const o = n * 6;
      _fwBoxBuf[o] = x0; _fwBoxBuf[o + 1] = y0; _fwBoxBuf[o + 2] = z0;
      _fwBoxBuf[o + 3] = x1; _fwBoxBuf[o + 4] = y1; _fwBoxBuf[o + 5] = z1;
      n++;
    };
    if (def.fence) {
      pushBox(0.375, 0.0, 0.375, 0.625, 1.0, 0.625);
      if (cPX) pushBox(0.625, 0.0, 0.4375, 1.0, 1.0, 0.5625);
      if (cNX) pushBox(0.0, 0.0, 0.4375, 0.375, 1.0, 0.5625);
      if (cPZ) pushBox(0.4375, 0.0, 0.625, 0.5625, 1.0, 1.0);
      if (cNZ) pushBox(0.4375, 0.0, 0.0, 0.5625, 1.0, 0.375);
    } else if (def.wall) {
      const above = getBlockWorld(wx, wy + 1, wz);
      const straightX = (cPX && cNX && !cPZ && !cNZ);
      const straightZ = (cPZ && cNZ && !cPX && !cNX);
      const needPost = (!straightX && !straightZ) || above !== B.AIR;
      const wh = (above !== B.AIR && (BLOCK_DEF_ARR[above]?.wall || IS_OPAQUE[above] === 1)) ? 1.0 : 0.8125;
      if (needPost) {
        pushBox(0.25, 0.0, 0.25, 0.75, 1.0, 0.75);
        if (cPX) pushBox(0.75, 0.0, 0.3125, 1.0, wh, 0.6875);
        if (cNX) pushBox(0.0, 0.0, 0.3125, 0.25, wh, 0.6875);
        if (cPZ) pushBox(0.3125, 0.0, 0.75, 0.6875, wh, 1.0);
        if (cNZ) pushBox(0.3125, 0.0, 0.0, 0.6875, wh, 0.25);
      } else if (straightX) {
        pushBox(0.0, 0.0, 0.3125, 1.0, wh, 0.6875);
      } else {
        pushBox(0.3125, 0.0, 0.0, 0.6875, wh, 1.0);
      }
    }
    return n;
  }
  function getFenceWallBoxes(wx, wy, wz, id) {
    const n = _fillFenceWallBoxes(wx, wy, wz, id);
    const out = [];
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      out.push([_fwBoxBuf[o], _fwBoxBuf[o + 1], _fwBoxBuf[o + 2], _fwBoxBuf[o + 3], _fwBoxBuf[o + 4], _fwBoxBuf[o + 5]]);
    }
    return out;
  }
  function aabbHitsFenceOrWall(minX, minY, minZ, maxX, maxY, maxZ, wx, wy, wz, id) {
    const n = _fillFenceWallBoxes(wx, wy, wz, id);
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      if (maxX > wx + _fwBoxBuf[o] && minX < wx + _fwBoxBuf[o + 3] &&
          maxY > wy + _fwBoxBuf[o + 1] && minY < wy + _fwBoxBuf[o + 4] &&
          maxZ > wz + _fwBoxBuf[o + 2] && minZ < wz + _fwBoxBuf[o + 5]) return true;
    }
    return false;
  }
  function pointInFenceOrWall(px, py, pz, wx, wy, wz, id) {
    const n = _fillFenceWallBoxes(wx, wy, wz, id);
    const lx = px - wx, ly = py - wy, lz = pz - wz;
    const pad = 0.025;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      if (lx >= Math.max(0, _fwBoxBuf[o] - pad) && lx <= Math.min(1, _fwBoxBuf[o + 3] + pad) &&
          ly >= Math.max(0, _fwBoxBuf[o + 1] - pad) && ly <= Math.min(1, _fwBoxBuf[o + 4] + pad) &&
          lz >= Math.max(0, _fwBoxBuf[o + 2] - pad) && lz <= Math.min(1, _fwBoxBuf[o + 5] + pad)) return true;
    }
    return false;
  }
  function getFenceWallUnionBounds(wx, wy, wz, id) {
    const n = _fillFenceWallBoxes(wx, wy, wz, id);
    if (n === 0) return { cx: 0.5, cy: 0.5, cz: 0.5, sx: 1, sy: 1, sz: 1 };
    let x0 = 1, y0 = 1, z0 = 1, x1 = 0, y1 = 0, z1 = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      if (_fwBoxBuf[o] < x0) x0 = _fwBoxBuf[o];
      if (_fwBoxBuf[o + 1] < y0) y0 = _fwBoxBuf[o + 1];
      if (_fwBoxBuf[o + 2] < z0) z0 = _fwBoxBuf[o + 2];
      if (_fwBoxBuf[o + 3] > x1) x1 = _fwBoxBuf[o + 3];
      if (_fwBoxBuf[o + 4] > y1) y1 = _fwBoxBuf[o + 4];
      if (_fwBoxBuf[o + 5] > z1) z1 = _fwBoxBuf[o + 5];
    }
    return { cx: (x0 + x1) * 0.5, cy: (y0 + y1) * 0.5, cz: (z0 + z1) * 0.5, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0 };
  }
  function setBlockWorld(wx, wy, wz, id, persist = true, force = false) {
    if (wy <= MIN_Y || wy > MAX_Y) return;
    const cx = wx >> 4, cz = wz >> 4, c = _getChunkFast(cx, cz); if (!c) return;
    const lx = wx & 15, lz = wz & 15, ly = wy - MIN_Y;
    const prevId = c.data[(ly << 8) | (lz << 4) | lx];
    if (!force && prevId === B.BEDROCK && id !== B.BEDROCK) return;
    if (prevId === id) return;
    c.data[(ly << 8) | (lz << 4) | lx] = id;
    if (typeof player !== 'undefined' && player && Math.abs(wx - player.x) <= 36 && Math.abs(wz - player.z) <= 36) window._rtVolDirty = true;
    if (c.topMap) c.topMap[(lz << 4) | lx] = -1;   // minimap: cột này đổi khối cao nhất
    c.mapDirty = true;
    if (typeof _mmTerrainVer === 'number') _mmTerrainVer++;
    if (ly > c.maxLy) c.maxLy = ly;
    if (persist) {
      recordWorldMod(wx, wy, wz, id);
      if (typeof broadcastBlockMod === 'function' && !isApplyingRemoteBlock) broadcastBlockMod(wx, wy, wz, id);
    }
    if ((prevId === B.BED || prevId === B.BED_FOOT) && id !== B.BED && id !== B.BED_FOOT && player.bedSpawn) {
      const bs = player.bedSpawn;
      const bDim = bs.dim || 'overworld';
      const bTrueY = (typeof bs.trueY === 'number') ? bs.trueY : (bs.y - 1.2 - (bs.depthOffset || 0));
      const wTrueY = wy - depthOffset;
      if (bDim === currentDimension && Math.abs(wx + 0.5 - bs.x) <= 2.2 && Math.abs(wTrueY - bTrueY) <= 2.0 && Math.abs(wz + 0.5 - bs.z) <= 2.2) {
        player.bedSpawn = null;
        if (typeof showToast === 'function') showToast('🛏️ Giường hồi sinh đã bị phá! Điểm hồi sinh đặt lại.');
      }
    }
    c.dirty = true; c.urgentDirty = true;
    _dirtyChunkSet.add(c); _urgentChunkSet.add(c);
    const hk = modKey(wx, wy, wz);
    if ((prevId === B.WATER || prevId === B.LAVA) && id !== prevId) {
      fluidLevel.delete(hk);
      pouredFluidSources.delete(hk);
    }
    if (waterloggedBlocks.size > 0 && IS_SLAB[prevId] > 0 && IS_SLAB[id] === 0) waterloggedBlocks.delete(hk);
    if (prevId === B.TORCH_BLOCK && id !== B.TORCH_BLOCK) torchAttachDir.delete(hk);
    if (prevId === B.DRAGON_HEAD && id !== B.DRAGON_HEAD) dragonHeadYaw.delete(hk);
    if (prevId === B.WINDMILL_HUB && id !== B.WINDMILL_HUB) windmillHubState.delete(hk);
    if (id === B.FIRE) registerFireBlock(wx, wy, wz);
    else if (prevId === B.FIRE) activeFires.delete(hk);
    const isLightChange = !!((BLOCK_DEF[id] && BLOCK_DEF[id].emissive) || (BLOCK_DEF[prevId] && BLOCK_DEF[prevId].emissive));
    if (isLightChange) c._emitDirty = true;
    const margin = !isLightChange ? 0
      : ((id === B.LANTERN || prevId === B.LANTERN) ? 20
        : ((id === B.TORCH_BLOCK || prevId === B.TORCH_BLOCK || id === B.SOUL_LANTERN || prevId === B.SOUL_LANTERN) ? 18 : 14));
    if (lx <= margin) markChunkDirty(cx - 1, cz, true); if (lx >= 15 - margin) markChunkDirty(cx + 1, cz, true);
    if (lz <= margin) markChunkDirty(cx, cz - 1, true); if (lz >= 15 - margin) markChunkDirty(cx, cz + 1, true);
    if (isLightChange) {
      if (lx <= margin && lz <= margin) markChunkDirty(cx - 1, cz - 1);
      if (lx >= 15 - margin && lz <= margin) markChunkDirty(cx + 1, cz - 1);
      if (lx <= margin && lz >= 15 - margin) markChunkDirty(cx - 1, cz + 1);
      if (lx >= 15 - margin && lz >= 15 - margin) markChunkDirty(cx + 1, cz + 1);
      if (margin > 16) {
        const m2 = margin - 16;
        if (lx <= m2) markChunkDirty(cx - 2, cz);
        if (lx >= 15 - m2) markChunkDirty(cx + 2, cz);
        if (lz <= m2) markChunkDirty(cx, cz - 2);
        if (lz >= 15 - m2) markChunkDirty(cx, cz + 2);
      }
    }
    wakeAdjacentFluids(wx, wy, wz);
    window._fgForceNative = true;
  }

  // Real Minecraft + Luanti Cellular Automata Fluid Engine (Water max 7, Lava max 3 Overworld / 7 Nether + Infinite Springs + Poured-Bucket Pickup!)
  // Level encoding in fluidLevel Map:
  //   0 = SOURCE block (placed by bucket, infinite renewal, or natural ocean/lake when absent from map)
  //   1..maxSpread = FLOWING horizontal block (finite distance from source)
  //   8 = FALLING stream block (fed strictly by same fluid directly above — NEVER a source)
  const fluidLevel = new Map();
  const pouredFluidSources = new Set();
  const fluidQueue = [];
  const fluidQueuedSet = new Set();
  const waterloggedBlocks = new Set();
  const _FLUID_DIRS4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const _FLUID_REV4 = [1, 0, 3, 2];

  function getFluidLevel(wx, wy, wz, id) {
    if (getBlockWorld(wx, wy, wz) !== id) return 99;
    const k = modKey(wx, wy, wz);
    return fluidLevel.has(k) ? fluidLevel.get(k) : 0; // Unmapped world-gen ocean/lava sea = natural source (0)
  }

  function markFluidDirty(wx, wy, wz) {
    const cx = wx >> 4, cz = wz >> 4, lx = wx & 15, lz = wz & 15;
    markChunkDirty(cx, cz, true);
    if (lx === 0) markChunkDirty(cx - 1, cz, true);
    if (lx === 15) markChunkDirty(cx + 1, cz, true);
    if (lz === 0) markChunkDirty(cx, cz - 1, true);
    if (lz === 15) markChunkDirty(cx, cz + 1, true);
  }

  function _canFluidReplace(bid) {
    if (bid === B.AIR || bid === B.FIRE) return true;
    const d = BLOCK_DEF[bid];
    return !!(d && (d.cross || bid === B.TORCH_BLOCK) && bid !== B.SEAGRASS && bid !== B.LILY_PAD);
  }

  function scheduleFluid(wx, wy, wz, delay = 0.12) {
    if (wy <= MIN_Y || wy >= MAX_Y) return;
    const id = getBlockWorld(wx, wy, wz);
    if (id !== B.WATER && id !== B.LAVA) return;
    const k = modKey(wx, wy, wz);
    if (fluidQueuedSet.has(k)) return;
    fluidQueuedSet.add(k);
    fluidQueue.push({ x: wx, y: wy, z: wz, id, t: delay });
  }

  function wakeAdjacentFluids(wx, wy, wz, speedMul = 1.0) {
    const dirs = [[0,0,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
    for (let i = 0; i < dirs.length; i++) {
      const nx = wx + dirs[i][0], ny = wy + dirs[i][1], nz = wz + dirs[i][2];
      const nb = getBlockWorld(nx, ny, nz);
      if (nb === B.WATER) scheduleFluid(nx, ny, nz, 0.11 * speedMul);
      else if (nb === B.LAVA) scheduleFluid(nx, ny, nz, (currentDimension === 'nether' ? 0.16 : 0.28) * speedMul);
    }
  }

  let fluidQueueHead = 0;
  function clearFluidState() { fluidLevel.clear(); pouredFluidSources.clear(); fluidQueue.length = 0; fluidQueueHead = 0; fluidQueuedSet.clear(); waterloggedBlocks.clear(); }

  function flowWaterInto(startX, startY, startZ) {
    const k = modKey(startX, startY, startZ);
    fluidLevel.delete(k);
    pouredFluidSources.delete(k);
    wakeAdjacentFluids(startX, startY, startZ);
  }

  function _findFluidDropDist(x, y, z, curId, depth, fromIdx) {
    const belowId = getBlockWorld(x, y - 1, z);
    if (_canFluidReplace(belowId) || (belowId === curId && getFluidLevel(x, y - 1, z, curId) > 0)) return depth;
    if (depth >= 4) return 5;
    let best = 5;
    for (let d = 0; d < 4; d++) {
      if (d === fromIdx) continue;
      const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
      const nid = getBlockWorld(nx, y, nz);
      if (!_canFluidReplace(nid) && nid !== curId) continue;
      const dist = _findFluidDropDist(nx, y, nz, curId, depth + 1, _FLUID_REV4[d]);
      if (dist < best) best = dist;
    }
    return best;
  }

  function tickFluids(dt) {
    if (fluidQueueHead >= fluidQueue.length) {
      if (fluidQueue.length > 0) { fluidQueue.length = 0; fluidQueueHead = 0; }
      return;
    }
    let processed = 0, changedVisuals = 0;
    const maxOps = 120;
    const len = fluidQueue.length;
    let writeIdx = fluidQueueHead;
    let i = fluidQueueHead;
    for (; i < len && processed < maxOps; i++) {
      const item = fluidQueue[i];
      item.t -= dt;
      if (item.t > 0) {
        if (writeIdx !== i) fluidQueue[writeIdx] = item;
        writeIdx++;
        continue;
      }
      const x = item.x, y = item.y, z = item.z;
      const k = modKey(x, y, z);
      fluidQueuedSet.delete(k);
      const curId = getBlockWorld(x, y, z);
      if (curId !== B.WATER && curId !== B.LAVA) { fluidLevel.delete(k); pouredFluidSources.delete(k); continue; }
      processed++;

      const isLava = (curId === B.LAVA);
      const maxSpread = isLava ? (currentDimension === 'nether' ? 7 : 3) : 7;
      const delayStep = isLava ? (currentDimension === 'nether' ? 0.18 : 0.30) : 0.12;
      let curLvl = fluidLevel.has(k) ? fluidLevel.get(k) : 0;

      // PHASE 1: Validate Flowing Blocks (curLvl > 0) + Infinite Water Spring Renewal (2+ source neighbors)
      if (curLvl > 0) {
        let expectedLvl = 99;
        const aboveId = getBlockWorld(x, y + 1, z);
        if (aboveId === curId) {
          expectedLvl = 8;
        } else {
          let minNb = 99, srcCount = 0;
          for (let d = 0; d < 4; d++) {
            const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
            if (getBlockWorld(nx, y, nz) !== curId) continue;
            let nl = getFluidLevel(nx, y, nz, curId);
            if (nl === 0) srcCount++;
            if (nl === 8) nl = (getBlockWorld(nx, y + 1, nz) === curId) ? 0 : 99;
            if (nl < minNb) minNb = nl;
          }
          // Authentic Minecraft Infinite Water Spring: >= 2 orthogonal water sources over solid/source water create a full source!
          if (!isLava && srcCount >= 2) {
            const bBelow = getBlockWorld(x, y - 1, z);
            if (IS_SOLID[bBelow] === 1 || (bBelow === B.WATER && getFluidLevel(x, y - 1, z, B.WATER) === 0)) {
              fluidLevel.delete(k);
              pouredFluidSources.delete(k);
              markFluidDirty(x, y, z);
              changedVisuals++;
              curLvl = 0;
              expectedLvl = 0;
              wakeAdjacentFluids(x, y, z, 0.72);
            }
          }
          if (expectedLvl === 99 && minNb < maxSpread) expectedLvl = minNb + 1;
        }

        if (curLvl > 0) {
          if (expectedLvl > maxSpread && expectedLvl !== 8) {
            setBlockWorld(x, y, z, B.AIR, false);
            fluidLevel.delete(k);
            pouredFluidSources.delete(k);
            changedVisuals++;
            continue;
          }
          if (expectedLvl !== curLvl) {
            fluidLevel.set(k, expectedLvl);
            markFluidDirty(x, y, z);
            changedVisuals++;
            wakeAdjacentFluids(x, y, z, 0.72);
            scheduleFluid(x, y, z, delayStep * 0.72);
            continue;
          }
        }
      }

      const reactPair = (tx, ty, tz, targetId) => {
        if (isLava && targetId === B.WATER) {
          const outB = B.STONE;
          setBlockWorld(tx, ty, tz, outB, true);
          spawnParticles(tx + 0.5, ty + 0.9, tz + 0.5, 0xe2e8f0, 5, false);
          playSfx('hiss');
          changedVisuals++;
          return true;
        }
        if (!isLava && targetId === B.LAVA) {
          const tLvl = getFluidLevel(tx, ty, tz, B.LAVA);
          setBlockWorld(tx, ty, tz, tLvl === 0 ? B.OBSIDIAN : B.STONE, true);
          spawnParticles(tx + 0.5, ty + 0.9, tz + 0.5, 0xcbd5e1, 6, false);
          playSfx('hiss');
          changedVisuals++;
          return true;
        }
        return false;
      };

      // PHASE 2: Gravity Fall Straight Downward (Falling block gets level = 8, NEVER 0)
      const belowId = getBlockWorld(x, y - 1, z);
      if (y - 1 > MIN_Y) {
        if (reactPair(x, y - 1, z, belowId)) continue;
        if (_canFluidReplace(belowId) || (belowId === curId && getFluidLevel(x, y - 1, z, curId) > 0 && getFluidLevel(x, y - 1, z, curId) !== 8)) {
          if (belowId === B.FIRE) playSfx('hiss');
          const bk = modKey(x, y - 1, z);
          if (belowId !== curId) setBlockWorld(x, y - 1, z, curId, false);
          else markFluidDirty(x, y - 1, z);
          fluidLevel.set(bk, 8);
          scheduleFluid(x, y - 1, z, delayStep);
          changedVisuals++;
          if (curLvl !== 0) continue;
        }
      }

      // PHASE 3: Horizontal Flow w/ 4-Block Downhill Slope Seeking (Minecraft / Luanti standard)
      const isSupported = (IS_SOLID[belowId] === 1) || (belowId === curId && getFluidLevel(x, y - 1, z, curId) === 0);
      const effLvl = (curLvl === 8) ? 0 : curLvl;
      if (isSupported && effLvl < maxSpread) {
        const nextLvl = effLvl + 1;
        let minDrop = 5;
        const dropDists = [5, 5, 5, 5];
        for (let d = 0; d < 4; d++) {
          const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
          const nbId = getBlockWorld(nx, y, nz);
          if (reactPair(nx, y, nz, nbId)) continue;
          if (_canFluidReplace(nbId) || nbId === curId) {
            const dd = _findFluidDropDist(nx, y, nz, curId, 1, _FLUID_REV4[d]);
            dropDists[d] = dd;
            if (dd < minDrop) minDrop = dd;
          }
        }
        for (let d = 0; d < 4; d++) {
          if (minDrop <= 4 && dropDists[d] > minDrop) continue;
          const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
          const nbId = getBlockWorld(nx, y, nz);
          if ((isLava && nbId === B.WATER) || (!isLava && nbId === B.LAVA)) continue;
          const nbLvl = (nbId === curId) ? getFluidLevel(nx, y, nz, curId) : 99;
          if (_canFluidReplace(nbId) || (nbId === curId && nbLvl > nextLvl && nbLvl !== 8)) {
            if (nbId === B.FIRE) playSfx('hiss');
            const nk = modKey(nx, y, nz);
            if (nbId !== curId) setBlockWorld(nx, y, nz, curId, false);
            else markFluidDirty(nx, y, nz);
            fluidLevel.set(nk, nextLvl);
            scheduleFluid(nx, y, nz, delayStep);
            changedVisuals++;
          }
        }
      }
    }
    if (i > writeIdx) {
      for (let j = i; j < len; j++) fluidQueue[writeIdx++] = fluidQueue[j];
      fluidQueue.length = writeIdx;
    }
    fluidQueueHead = 0;
    if (changedVisuals > 0 && typeof flushUrgentChunks === 'function') flushUrgentChunks(5, true);
  }


  // ===================== v23.0 ANIMATED 3D CHESTS (5 TIERS), DOORS (5 TYPES), TRAPDOORS (4 TYPES), FURNACES & WHEAT CROPS =====================
  const doorOpenState = new Map();     // 'wx,wy,wz' -> boolean
  const plantedSaplings = new Map();   // 'wx,wy,wz' -> { x, y, z, id, age, targetAge }
  const saplingFertilizeCount = new Map();
  let _sapScratch = null;
  function growSaplingAt(wx, wy, wz, saplingId) {
    const sDef = BLOCK_DEF[saplingId];
    if (!sDef || !sDef.isSapling) return false;
    const style = sDef.saplingStyle || 'apple';
    for (let dy = 1; dy <= 5; dy++) {
      if (IS_OPAQUE[getBlockWorld(wx, wy + dy, wz)] === 1) return false;
    }
    const minLy = Math.max(0, wy - 4 - MIN_Y), maxLy = Math.min(WORLD_H - 1, wy + 28 - MIN_Y);
    if (!_sapScratch) _sapScratch = new Uint16Array(16 * WORLD_H * 16);
    _sapScratch.fill(0, minLy << 8, (maxLy + 1) << 8);
    setBlockWorld(wx, wy, wz, B.AIR, true);
    placeLuantiTree(_sapScratch, 8, wy, 8, wx, wz, style);
    for (let ly = minLy; ly <= maxLy; ly++) {
      const py = MIN_Y + ly;
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const bid = _sapScratch[(ly << 8) | (lz << 4) | lx];
        if (!bid) continue;
        const px = wx - 8 + lx, pz = wz - 8 + lz;
        if (lx === 8 && lz === 8 && py >= wy && py <= wy + 4) { setBlockWorld(px, py, pz, bid, true); continue; }
        const cur = getBlockWorld(px, py, pz);
        if (cur === B.AIR || IS_OPAQUE[cur] !== 1) setBlockWorld(px, py, pz, bid, true);
      }
    }
    const sk = modKey(wx, wy, wz);
    plantedSaplings.delete(sk); saplingFertilizeCount.delete(sk);
    flushUrgentChunks(48);
    spawnParticles(wx + 0.5, wy + 1.4, wz + 0.5, sDef.mapColor || 0x4ade80, 14, true);
    playSfx('place');
    return true;
  }
  const torchAttachDir = new Map();    // 'wx,wy,wz' -> 'nx'|'px'|'nz'|'pz'|'floor'
  const dragonHeadYaw = new Map();     // 'wx,wy,wz' -> facing yaw in radians
  const windmillHubState = new Map();  // 'wx,wy,wz' -> { yaw, speed }
  const chestStorageMap = new Map();   // canonical trueKey ('wx,trueY,wz') -> Array<{id,count,dur,maxDur}>
  const consumedLootChests = new Set();// dim:trueKey whose natural loot was generated/emptied/placed
  const naturalChestTags = new Map();  // trueKey -> structure tag ('ancient_city', ...)
  let enderChestSlots = Array.from({ length: 27 }, () => ({ id: 0, count: 0, dur: 0, maxDur: 0 }));
  function createEmptyChestSlots(cap = 27) {
    return Array.from({ length: cap }, () => ({ id: 0, count: 0, dur: 0, maxDur: 0 }));
  }
  function isEnderChestBlock(id) {
    return !!(typeof B !== 'undefined' && B.ENDER_CHEST_BLOCK && id === B.ENDER_CHEST_BLOCK);
  }
  function toTrueChestKey(kOrWx, wy, wz) {
    const off = depthOffset || 0;
    if (wy !== undefined) return modKey(kOrWx, wy - off, wz);
    if (!off) return kOrWx;
    const c1 = kOrWx.indexOf(','), c2 = kOrWx.indexOf(',', c1 + 1);
    if (c1 < 0 || c2 < 0) return kOrWx;
    return kOrWx.slice(0, c1) + ',' + (parseInt(kOrWx.slice(c1 + 1, c2), 10) - off) + ',' + kOrWx.slice(c2 + 1);
  }
  function resetPersistentChestState() {
    consumedLootChests.clear();
    naturalChestTags.clear();
    enderChestSlots = createEmptyChestSlots(27);
  }
  const chestPairMap = new Map();      // 'wx,wy,wz' -> { pk, sk, px, py, pz, sx, sy, sz, axis }
  const furnaceStateMap = new Map();   // 'wx,wy,wz' -> { type, inSlot, fuelSlot, outSlot, burnLeft, burnMax, cookT, cookNeed }
  const interactiveVisuals = new Map();// 'wx,wy,wz' -> { kind, id, group, pivot, curAng, targetAng, chKey }
  const interactiveByChunk = new Map(); // chunkKey -> Set<'wx,wy,wz'>
  const endCrystalVisuals = new Map(); // 'wx,wy,wz' -> entry for 60 FPS floating crystal rotation
  const animatedInteractiveVisuals = new Map(); // 'wx,wy,wz' -> dragon_head / windmill_hub entries
  let _hingesAnimating = false;
  function _delInteractiveVisual(k) {
    const old = interactiveVisuals.get(k);
    if (!old) return;
    scene.remove(old.group);
    interactiveVisuals.delete(k);
    endCrystalVisuals.delete(k);
    animatedInteractiveVisuals.delete(k);
    const set = interactiveByChunk.get(old.chKey);
    if (set) { set.delete(k); if (set.size === 0) interactiveByChunk.delete(old.chKey); }
  }
  function _setInteractiveVisual(k, entry) {
    interactiveVisuals.set(k, entry);
    if (entry.kind === 'end_crystal') endCrystalVisuals.set(k, entry);
    else if (entry.kind === 'dragon_head' || entry.kind === 'windmill_hub') animatedInteractiveVisuals.set(k, entry);
    let set = interactiveByChunk.get(entry.chKey);
    if (!set) { set = new Set(); interactiveByChunk.set(entry.chKey, set); }
    set.add(k);
    _hingesAnimating = true;
  }
  let activeChestKey = null, activeChestPartnerKey = null, activeFurnaceKey = null, cropTickAccum = 0;

  const CHEST_MAT_PAL = {
    oak:       { body: 0xb07634, rim: 0x5c3a18, latch: 0xe2e8f0 },
    copper:    { body: 0xd97745, rim: 0x8a3b1b, latch: 0xd6d3d1 },
    iron:      { body: 0xcbd5e1, rim: 0x64748b, latch: 0x1e293b },
    gold:      { body: 0xfacc15, rim: 0xa16207, latch: 0x78350f },
    diamond:   { body: 0x22d3ee, rim: 0x0e7490, latch: 0xfef08a },
    emerald:   { body: 0x10b981, rim: 0x065f46, latch: 0xfef08a },
    ruby:      { body: 0xe11d48, rim: 0x881337, latch: 0xfde68a },
    netherite: { body: 0x4c3a5d, rim: 0x1e1b2e, latch: 0xf59e0b },
    dream:     { body: 0xffffff, rim: 0x67e8f9, latch: 0xfef9c3 },
    ender:     { body: 0x0f2728, rim: 0x1e1b2e, latch: 0x5eead4 }
  };

  function findDoubleChestPartner(wx, wy, wz, id) {
    if (!id) id = getBlockWorld(wx, wy, wz);
    const def = BLOCK_DEF[id];
    if (!def || !def.chest || isEnderChestBlock(id)) return null;
    const k = modKey(wx, wy, wz);
    let pair = chestPairMap.get(k);
    if (pair) {
      if (getBlockWorld(pair.px, pair.py, pair.pz) === id && getBlockWorld(pair.sx, pair.sy, pair.sz) === id) {
        return pair;
      }
      chestPairMap.delete(pair.pk);
      chestPairMap.delete(pair.sk);
    }
    const dirs = [[-1, 0, 'X'], [1, 0, 'X'], [0, -1, 'Z'], [0, 1, 'Z']];
    for (let i = 0; i < dirs.length; i++) {
      const [dx, dz, axis] = dirs[i];
      const nx = wx + dx, nz = wz + dz;
      if (getBlockWorld(nx, wy, nz) !== id) continue;
      const nk = modKey(nx, wy, nz);
      const ex = chestPairMap.get(nk);
      if (ex && ex.pk !== k && ex.sk !== k) continue;
      const meFirst = (axis === 'X') ? (wx < nx) : (wz < nz);
      const px = meFirst ? wx : nx, pz = meFirst ? wz : nz;
      const sx = meFirst ? nx : wx, sz = meFirst ? nz : wz;
      pair = { pk: modKey(px, wy, pz), sk: modKey(sx, wy, sz), px, py: wy, pz, sx, sy: wy, sz, axis };
      chestPairMap.set(pair.pk, pair);
      chestPairMap.set(pair.sk, pair);
      return pair;
    }
    return null;
  }

  function refreshChestVisualAt(wx, wy, wz) {
    _delInteractiveVisual(modKey(wx, wy, wz));
    const id = getBlockWorld(wx, wy, wz);
    if (id && BLOCK_DEF[id] && BLOCK_DEF[id].chest) {
      createAnimatedBlockVisual(wx, wy, wz, id, chunkKey(wx >> 4, wz >> 4));
    }
  }

  function tryPairChestAt(wx, wy, wz, id) {
    const pair = findDoubleChestPartner(wx, wy, wz, id);
    if (pair) {
      refreshChestVisualAt(pair.px, pair.py, pair.pz);
      refreshChestVisualAt(pair.sx, pair.sy, pair.sz);
      return pair;
    }
    return null;
  }

  function breakChestAt(wx, wy, wz, brokenId) {
    const k = modKey(wx, wy, wz);
    if (!isEnderChestBlock(brokenId)) {
      const tk = toTrueChestKey(wx, wy, wz);
      const dimTk = toDimChestKey(tk);
      let arr = chestStorageMap.get(dimTk) || chestStorageMap.get(tk);
      if (!arr && !consumedLootChests.has(dimTk) && !worldMods.has(dimModKey(tk))) {
        const bdef = BLOCK_DEF[brokenId];
        arr = createEmptyChestSlots((bdef && bdef.chestSlots) || 27);
        _fillNaturalChestLoot(arr, brokenId, tk);
      }
      consumedLootChests.add(dimTk);
      naturalChestTags.delete(dimTk); naturalChestTags.delete(tk);
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (s && s.id && s.count > 0) spawnDroppedItem(wx, wy, wz, s.id, { count: s.count, dur: s.dur || 0, maxDur: s.maxDur || 0, ench: !!s.ench, trim: s.trim ? { ...s.trim } : null });
        }
        chestStorageMap.delete(dimTk); chestStorageMap.delete(tk);
      }
      if (typeof broadcastChestBreak === 'function') broadcastChestBreak(dimTk);
    }
    const pair = chestPairMap.get(k);
    if (pair) {
      chestPairMap.delete(pair.pk);
      chestPairMap.delete(pair.sk);
    }
    _delInteractiveVisual(k);
    if (activeChestKey === k || activeChestPartnerKey === k) closeChestModal();
    if (pair) {
      const ox = (pair.pk === k) ? pair.sx : pair.px;
      const oy = (pair.pk === k) ? pair.sy : pair.py;
      const oz = (pair.pk === k) ? pair.sz : pair.pz;
      refreshChestVisualAt(ox, oy, oz);
    }
  }
  const DOOR_MAT_PAL = {
    iron:   { frame: 0xaeb4ba, panel: 0xd5d9dd, dark: 0x858b92, hi: 0xe8ebee, knob: 0x3a3f46, win: true,  mode: 'open' }
  };
  for (const wf of WOOD_FAMILIES) DOOR_MAT_PAL[wf.tier] = wf.doorPal;

  // Shared Paired Door Open/Close Helper (syncs Double Doors + authentic wood/iron SFX for Player & Villagers!)
  function setDoorOpenPair(wx, wy, wz, openBool, playSound = true, fromRemote = false) {
    const id = getBlockWorld(wx, wy, wz);
    const hDef = BLOCK_DEF[id];
    if (!hDef || (!hDef.door && !hDef.trapdoor)) return false;
    const dk = modKey(wx, wy, wz);
    const prev = !!doorOpenState.get(dk);
    if (prev === !!openBool) return false;
    doorOpenState.set(dk, !!openBool);
    _hingesAnimating = true;
    if (hDef.door) {
      for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nbId = getBlockWorld(wx + ox, wy, wz + oz);
        if (BLOCK_DEF[nbId] && BLOCK_DEF[nbId].door) doorOpenState.set(modKey(wx + ox, wy, wz + oz), !!openBool);
      }
    }
    if (playSound) playSfx(hDef.doorTier === 'iron' ? 'equip' : (openBool ? 'place' : 'break'));
    if (!fromRemote && typeof broadcastDoorToggle === 'function') broadcastDoorToggle(wx, wy, wz, !!openBool);
    return true;
  }

  // Authentic 16x32 Minecraft Pixel-Art Voxel Door Texture Cache (exact style of image/images (24)-(30).jpg!)
  const _doorMatCache = new Map();
  function getDoorVoxelMatSet(tier) {
    if (_doorMatCache.has(tier)) return _doorMatCache.get(tier);
    const pal = DOOR_MAT_PAL[tier] || DOOR_MAT_PAL.oak;
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const cRgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const tint = (n, d) => {
      const [r, g, b] = cRgb(n);
      const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
      return `rgb(${cl(r + d)},${cl(g + d)},${cl(b + d)})`;
    };
    const pxHash = (x, y) => (((x * 374761393 + y * 668265263) ^ (x * 1274126177)) >>> 0) % 256 / 255;

    // 16x32 Front/Back Pixel-Art Texture (y=0 top -> y=31 bottom)
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 32;
    const ctx = cv.getContext('2d');
    const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };

    if (pal.mode === 'spruce') {
      // Exact Minecraft Spruce Door (image/images (26).jpg): 4 vertical walnut planks + 3 dark studded iron bands + silver square ring handle!
      for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        const n = (pxHash(x, y) - 0.5) * 16;
        const seam = (x === 0 || x === 4 || x === 8 || x === 12 || x === 15);
        const colIdx = (x >> 2) & 1;
        let c = seam ? tint(pal.dark, n * 0.5) : tint(colIdx ? pal.panel : pal.frame + 0x120d06, n + ((x % 4 === 1) ? 8 : -4));
        if (y === 0 || y === 31) c = tint(pal.dark, -6);
        put(x, y, c);
      }
      // 3 dark iron studded horizontal straps (rows 4-5, 15-16, 26-27)
      for (const sy of [4, 15, 26]) {
        for (let x = 0; x < 16; x++) {
          const isRivet = (x === 1 || x === 2 || x === 6 || x === 10 || x === 14);
          put(x, sy, isRivet ? '#1f2328' : '#353a42');
          put(x, sy + 1, isRivet ? '#2b3038' : '#252930');
        }
      }
      // Iconic silver-grey square iron ring pull on latch side (x=10..13, y=18..21 — matches images (26).jpg!)
      for (let y = 18; y <= 21; y++) for (let x = 10; x <= 13; x++) {
        if (x === 10 || x === 13 || y === 18 || y === 21) {
          put(x, y, (y === 18 || x === 10) ? '#d1d5db' : '#8b929c');
        }
      }
      put(11, 18, '#6b7280');
    } else if (pal.mode === 'birch') {
      // Exact Minecraft Birch Door (images (28)/(29).jpg): Pale creamy wood frame + bright white shoji lattice upper half + clean pale lower wood!
      for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        const n = (pxHash(x, y) - 0.5) * 10;
        const isBorder = (x <= 2 || x >= 13 || y <= 2 || y >= 29);
        const isLower = (y >= 17);
        if (isBorder) put(x, y, (x === 0 || x === 15 || y === 0 || y === 31) ? tint(pal.dark, n * 0.5) : tint(pal.panel, n));
        else if (!isLower) {
          const grid = (x === 7 || x === 8 || y === 7 || y === 12);
          put(x, y, grid ? '#dbd6c7' : ((pxHash(x, y) > 0.5) ? '#f3f1e7' : '#ece9dc'));
        } else {
          const grove = (y === 17 || y === 18 || x === 3 || x === 12);
          put(x, y, grove ? tint(pal.frame, n) : tint(pal.hi, n * 0.7));
        }
      }
      for (const hy of [5, 15, 25]) { put(0, hy, '#474c54'); put(0, hy + 1, '#686e78'); }
      put(13, 16, '#363b42'); put(14, 16, '#363b42'); put(13, 17, '#1f2328');
    } else if (pal.mode === 'dark_oak') {
      // Solid 6-panel dark chocolate door w/ brass knob (Image 3)
      for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        const n = (pxHash(x, y) - 0.5) * 12;
        const outerEdge = (x === 0 || x === 15 || y === 0 || y === 31);
        const inPanelX = (x >= 3 && x <= 6) || (x >= 9 && x <= 12);
        const inPanelY = (y >= 3 && y <= 7) || (y >= 10 && y <= 14) || (y >= 18 && y <= 22) || (y >= 24 && y <= 28);
        if (outerEdge) put(x, y, tint(pal.dark, n * 0.5));
        else if (inPanelX && inPanelY) {
          const rim = (x === 3 || x === 9 || y === 3 || y === 10 || y === 18 || y === 24);
          put(x, y, rim ? tint(pal.dark, n * 0.6) : tint(pal.panel, n));
        } else put(x, y, tint(pal.frame, n));
      }
      for (const hy of [5, 15, 25]) { put(0, hy, '#4b5058'); put(1, hy, '#6b7280'); }
      put(12, 16, hex(pal.knob)); put(13, 16, hex(pal.knob));
    } else {
      // Open-window / slat / oval / sakura lattice doors matching reference Image 3!
      const m = pal.mode;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        const n = (pxHash(x, y) - 0.5) * (tier === 'iron' ? 8 : 14);
        const outerEdge = (x === 0 || x === 15 || y === 0 || y === 31);
        const frameBar  = (x <= 2 || x >= 13 || y <= 2 || y >= 29 || y === 14 || y === 15);
        if (m === 'acacia' && y >= 3 && y <= 13 && (x === 4 || x === 5 || x === 7 || x === 8 || x === 10 || x === 11)) continue;
        if (m === 'slat_h' && x >= 3 && x <= 12 && ((y >= 4 && y <= 6) || (y >= 9 && y <= 11) || (y >= 18 && y <= 20) || (y >= 23 && y <= 25))) continue;
        if (m === 'mangrove' && y >= 4 && y <= 12 && x >= 4 && x <= 11 && !((x === 4 || x === 11) && (y === 4 || y === 12))) continue;
        if (m === 'sakura' && y >= 3 && y <= 13 && x >= 3 && x <= 12) {
          const lat = (x === 3 || x === 12 || y === 3 || y === 13 || (x >= 5 && x <= 10 && y >= 6 && y <= 10 && ((x + y) & 1) === 0));
          if (!lat) continue;
        }
        if ((m === 'open' || m === 'bamboo' || m === 'jungle') && y >= 3 && y <= 12 && ((x >= 3 && x <= 6) || (x >= 9 && x <= 12))) {
          if (y !== 7 && !(m === 'bamboo' && (x === 5 || x === 10)) && !(m === 'jungle' && y === 8)) continue;
        }
        let c = tint(pal.panel, n);
        if (outerEdge) c = tint(pal.dark, n * 0.5);
        else if (frameBar) c = (x === 1 || y === 1) ? tint(pal.hi, n * 0.7) : tint(pal.frame, n);
        else if (y >= 16 && y <= 28) {
          const rowMod = (y - 16) % 5, isDivH = (rowMod === 4);
          const colIn = (x >= 3 && x <= 6) ? (x - 3) : (x - 9);
          if (isDivH) c = tint(pal.frame, n);
          else if (rowMod === 0 || colIn === 0) c = tint(pal.dark, n * 0.6);
          else if (rowMod === 3 || colIn === 3) c = tint(pal.hi, n * 0.6);
          else c = tint(pal.panel, n);
        }
        put(x, y, c);
      }
      for (const hy of [5, 15, 25]) {
        put(0, hy, '#4b5058'); put(1, hy, '#6b7280');
        put(0, hy + 1, '#7c838f'); put(1, hy + 1, '#9ca3af');
      }
      put(11, 15, hex(pal.knob)); put(12, 15, hex(pal.knob)); put(13, 15, '#252930');
      put(11, 16, '#252930');
    }

    // Matching 16x16 Trapdoor Texture (with authentic holes/slats/lattice per wood tier matching Image 3!)
    const tcv = document.createElement('canvas'); tcv.width = 16; tcv.height = 16;
    const tctx = tcv.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const m = pal.mode, n = (pxHash(x + 9, y + 5) - 0.5) * 10;
      if (x === 0 || x === 15 || y === 0 || y === 15) { tctx.fillStyle = tint(pal.dark, n * 0.5); tctx.fillRect(x, y, 1, 1); continue; }
      if (x === 1 || x === 14 || y === 1 || y === 14) { tctx.fillStyle = tint(pal.frame, n * 0.8); tctx.fillRect(x, y, 1, 1); continue; }
      if ((m === 'open') && ((x >= 3 && x <= 6) || (x >= 9 && x <= 12)) && ((y >= 3 && y <= 6) || (y >= 9 && y <= 12))) continue;
      if (m === 'birch' && x >= 3 && x <= 12 && y >= 3 && y <= 12) {
        tctx.fillStyle = (x === 7 || x === 8 || y === 7 || y === 8) ? '#dbd6c6' : '#f4f2e8'; tctx.fillRect(x, y, 1, 1); continue;
      }
      if ((m === 'jungle' || m === 'acacia') && ((x >= 3 && x <= 5) || (x >= 7 && x <= 8) || (x >= 10 && x <= 12)) && y >= 3 && y <= 12 && !(m === 'jungle' && (y === 7 || y === 8))) continue;
      if (m === 'mangrove' && x >= 5 && x <= 10 && y >= 5 && y <= 10 && !((x === 5 || x === 10) && (y === 5 || y === 10))) continue;
      if ((m === 'sakura' || m === 'bamboo') && ((x >= 3 && x <= 4) || (x >= 7 && x <= 8) || (x >= 11 && x <= 12)) && ((y >= 3 && y <= 4) || (y >= 7 && y <= 8) || (y >= 11 && y <= 12))) continue;
      if (m === 'slat_h' && ((y >= 3 && y <= 5) || (y >= 10 && y <= 12)) && x >= 3 && x <= 12) continue;
      let col = tint(pal.panel, n);
      if ((m === 'dark_oak' || m === 'spruce') && (x === 7 || x === 8 || y === 7 || y === 8)) col = tint(pal.dark, -6);
      if (m === 'spruce' && (y === 3 || y === 12)) col = '#353a42';
      tctx.fillStyle = col; tctx.fillRect(x, y, 1, 1);
    }
    const trapTex = new THREE.CanvasTexture(tcv);
    trapTex.magFilter = THREE.NearestFilter; trapTex.minFilter = THREE.NearestFilter; trapTex.generateMipmaps = false;

    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;

    const texMirror = new THREE.CanvasTexture(cv);
    texMirror.magFilter = THREE.NearestFilter; texMirror.minFilter = THREE.NearestFilter;
    texMirror.generateMipmaps = false;
    texMirror.wrapS = THREE.RepeatWrapping; texMirror.repeat.x = -1; texMirror.offset.x = 1;

    const ecv = document.createElement('canvas'); ecv.width = 16; ecv.height = 16;
    const ectx = ecv.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const n = (pxHash(x + 31, y + 17) - 0.5) * 14;
      ectx.fillStyle = (x === 0 || x === 15) ? tint(pal.dark, n * 0.5) : tint(pal.frame, n);
      ectx.fillRect(x, y, 1, 1);
    }
    const edgeTex = new THREE.CanvasTexture(ecv);
    edgeTex.magFilter = THREE.NearestFilter; edgeTex.minFilter = THREE.NearestFilter;
    edgeTex.generateMipmaps = false;

    const isIron = (tier === 'iron');
    const faceMat  = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: isIron ? 0.34 : 0.78, metalness: isIron ? 0.62 : 0.04 });
    const faceMatM = new THREE.MeshStandardMaterial({ map: texMirror, alphaTest: 0.5, side: THREE.DoubleSide, roughness: isIron ? 0.34 : 0.78, metalness: isIron ? 0.62 : 0.04 });
    const trapMat  = new THREE.MeshStandardMaterial({ map: trapTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: isIron ? 0.34 : 0.78, metalness: isIron ? 0.62 : 0.04 });
    const edgeMat  = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: isIron ? 0.36 : 0.80, metalness: isIron ? 0.58 : 0.04 });
    const res = { faceMat, faceMatM, trapMat, edgeMat, mode: pal.mode, pal };
    _doorMatCache.set(tier, res);
    return res;
  }

  const _animGeoCache = new Map();
  const _animChestMatCache = new Map();
  const _animTrapMatCache = new Map();
  function _getBoxGeo(w, h, d) {
    const k = `${w}_${h}_${d}`;
    let g = _animGeoCache.get(k);
    if (!g) { g = new THREE.BoxGeometry(w, h, d); _animGeoCache.set(k, g); }
    return g;
  }
  const _doorPlaneGeo = new THREE.PlaneGeometry(1.0, 2.0);
  function _makeChestPixelTex(tier, pal) {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    const hexRgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
    const [bR, bG, bB] = hexRgb(tier === 'oak' ? 0xa87532 : pal.body);
    const [rR, rG, rB] = hexRgb(tier === 'oak' ? 0x2c241b : pal.rim);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const rgb = (r, g, b, d = 0) => `rgb(${clamp(r + d)},${clamp(g + d)},${clamp(b + d)})`;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      // Exact Image 6 Chest Texture: 1px dark charcoal-brown outer frame + 1px inner bevel + horizontal wood plank grain!
      if (x === 0 || x === 15 || y === 0 || y === 15) {
        c.fillStyle = rgb(rR, rG, rB, ((x + y) & 1) ? -6 : 4);
      } else if (x === 1 || x === 14 || y === 1 || y === 14) {
        c.fillStyle = tier === 'oak' ? rgb(118, 82, 34, ((x * 3 + y) % 3 - 1) * 5) : rgb(bR * 0.72, bG * 0.72, bB * 0.72);
      } else {
        const h = (((x * 374761393 + y * 668265263) ^ (y * 1274126177)) >>> 0) % 19 - 9;
        const plankDelta = (y === 5 || y === 10) ? -14 : ((y === 3 || y === 8 || y === 12) ? 10 : (((x + y * 2) % 5 === 0) ? -8 : 0));
        c.fillStyle = rgb(bR, bG, bB, plankDelta + h * 0.65);
      }
      c.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    return tex;
  }
  function _makeChestLatchTex(pal) {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
    const c = cv.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const isEdge = (x === 0 || x === 7 || y === 0 || y === 7);
      const isHi = (x <= 3 && y <= 5 && !isEdge);
      c.fillStyle = isEdge ? '#475569' : (isHi ? '#e8eef5' : '#94a3b8');
      c.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    return tex;
  }
  function _getChestMats(tier) {
    let m = _animChestMatCache.get(tier);
    if (m) return m;
    const pal = CHEST_MAT_PAL[tier] || CHEST_MAT_PAL.oak;
    const isWood = (tier === 'oak');
    const isDream = (tier === 'dream');
    const bodyMap = isDream && typeof getDreamWaterSwatchTex === 'function'
      ? getDreamWaterSwatchTex(2.2)
      : _makeChestPixelTex(tier, pal);
    const latchMap = isWood ? _makeChestLatchTex(pal) : null;
    m = {
      body: new THREE.MeshStandardMaterial({ color: isDream ? pal.body : 0xffffff, map: bodyMap, roughness: isWood ? 0.72 : (isDream ? 0.24 : 0.30), metalness: isWood ? 0.08 : 0.58, emissive: isDream ? 0x1e293b : 0x000000, emissiveIntensity: isDream ? 0.35 : 0 }),
      rim:  new THREE.MeshStandardMaterial({ color: isWood ? 0x2c241b : pal.rim, roughness: 0.48, metalness: isWood ? 0.12 : 0.65 }),
      latch:new THREE.MeshStandardMaterial({ color: isWood ? 0xffffff : pal.latch, map: latchMap, roughness: 0.25, metalness: 0.78 })
    };
    if (isDream && typeof applyRainbowToMat === 'function') {
      applyRainbowToMat(m.body);
      applyRainbowToMat(m.rim);
    }
    _animChestMatCache.set(tier, m);
    return m;
  }
  function _getTrapMat(tier, pal) {
    let m = _animTrapMatCache.get(tier);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: pal.panel, roughness: tier === 'iron' ? 0.32 : 0.78, metalness: tier === 'iron' ? 0.62 : 0.04 });
      _animTrapMatCache.set(tier, m);
    }
    return m;
  }

  function createAnimatedBlockVisual(wx, wy, wz, id, chKey) {
    const def = BLOCK_DEF[id]; if (!def) return;
    const k = modKey(wx, wy, wz);
    const old = interactiveVisuals.get(k);
    let doorSig = '', chestSig = '';
    let chestPair = null;
    if (def.chest) {
      chestPair = findDoubleChestPartner(wx, wy, wz, id);
      chestSig = chestPair ? ('D' + chestPair.axis + (chestPair.pk === k ? '1' : '2')) : 'S';
    }
    if (def.door) {
      const sN = IS_SOLID[getBlockWorld(wx, wy, wz - 1)] === 1, sS = IS_SOLID[getBlockWorld(wx, wy, wz + 1)] === 1;
      const sW = IS_SOLID[getBlockWorld(wx - 1, wy, wz)] === 1, sE = IS_SOLID[getBlockWorld(wx + 1, wy, wz)] === 1;
      const aZ = (sN || sS) && !(sW || sE);
      const nbP = aZ ? getBlockWorld(wx, wy, wz - 1) : getBlockWorld(wx - 1, wy, wz);
      doorSig = (aZ ? 'Z' : 'X') + ((BLOCK_DEF[nbP] && BLOCK_DEF[nbP].door) ? 'R' : 'L');
    }
    if (old && old.id === id && (!def.door || old.doorSig === doorSig) && (!def.chest || old.chestSig === chestSig)) return;
    if (old) _delInteractiveVisual(k);

    const g = new THREE.Group();
    g.position.set(wx, wy, wz);
    let pivot = null, kind = '', targetAng = 0;

    if (def.chest) {
      kind = 'chest';
      if (chestPair && chestPair.sk === k) {
        // Secondary half shares the primary half's seamless 2-block wide Double Chest mesh!
        scene.add(g);
        _setInteractiveVisual(k, { kind, id, group: g, pivot: null, curAng: 0, targetAng: 0, openSign: -1.42, doorSig, chestSig, chKey });
        return;
      }
      const isDouble = !!chestPair;
      const bodyW = isDouble ? 1.875 : 0.875;
      const rimW  = isDouble ? 1.895 : 0.895;
      const cx    = isDouble ? 1.0 : 0.5;
      const cm = _getChestMats(def.chestTier || 'oak');
      const wrap = new THREE.Group();
      if (isDouble && chestPair.axis === 'Z') {
        wrap.rotation.y = Math.PI * 0.5;
        wrap.position.set(0, 0, 2.0);
      }
      const base = new THREE.Mesh(_getBoxGeo(bodyW, 0.620, 0.875), cm.body);
      base.position.set(cx, 0.310, 0.5); base.castShadow = !_isMobilePerf; base.receiveShadow = true;
      const band = new THREE.Mesh(_getBoxGeo(rimW, 0.065, 0.895), cm.rim);
      band.position.set(cx, 0.580, 0.5);
      const baseInner = new THREE.Mesh(_getBoxGeo(bodyW - 0.10, 0.006, 0.775), cm.rim);
      baseInner.position.set(cx, 0.623, 0.5);
      wrap.add(base, band, baseInner);
      pivot = new THREE.Group();
      pivot.position.set(cx, 0.625, 0.0625);
      const lidRim = new THREE.Mesh(_getBoxGeo(rimW, 0.056, 0.895), cm.rim);
      lidRim.position.set(0, 0.029, 0.4375);
      const lid = new THREE.Mesh(_getBoxGeo(bodyW, 0.224, 0.875), cm.body);
      lid.position.set(0, 0.169, 0.4375); lid.castShadow = !_isMobilePerf;
      const lidInner = new THREE.Mesh(_getBoxGeo(bodyW - 0.10, 0.006, 0.775), cm.rim);
      lidInner.position.set(0, -0.002, 0.4375);
      const latch = new THREE.Mesh(_getBoxGeo(isDouble ? 0.18 : 0.14, 0.20, 0.06), cm.latch);
      latch.position.set(0, -0.02, 0.916);
      pivot.add(lidRim, lid, lidInner, latch);
      wrap.add(pivot);
      g.add(wrap);
      targetAng = (activeChestKey === k || activeChestPartnerKey === k) ? -1.42 : 0;
    } else if (def.door) {
      kind = 'door';
      const tier = def.doorTier || 'oak';
      const dm = getDoorVoxelMatSet(tier);

      const solidN = IS_SOLID[getBlockWorld(wx, wy, wz - 1)] === 1, solidS = IS_SOLID[getBlockWorld(wx, wy, wz + 1)] === 1;
      const solidW = IS_SOLID[getBlockWorld(wx - 1, wy, wz)] === 1, solidE = IS_SOLID[getBlockWorld(wx + 1, wy, wz)] === 1;
      const axisZ = (solidN || solidS) && !(solidW || solidE);
      const nbPrevId = axisZ ? getBlockWorld(wx, wy, wz - 1) : getBlockWorld(wx - 1, wy, wz);
      const isMirrorRight = !!(BLOCK_DEF[nbPrevId] && BLOCK_DEF[nbPrevId].door);
      const openSign = isMirrorRight ? 1.52 : -1.52;

      const wrap = new THREE.Group();
      wrap.position.set(0.5, 0, 0.5);
      if (axisZ) wrap.rotation.y = Math.PI * 0.5;

      pivot = new THREE.Group();
      pivot.position.set(isMirrorRight ? 0.50 : -0.50, 0.0, 0.0);
      const dirX = isMirrorRight ? -1 : 1;
      const cxLeaf = dirX * 0.50;
      const dThick = 0.1875;

      const fPlane = new THREE.Mesh(_doorPlaneGeo, isMirrorRight ? dm.faceMatM : dm.faceMat);
      fPlane.position.set(cxLeaf, 1.0, dThick * 0.5); fPlane.castShadow = !_isMobilePerf; fPlane.receiveShadow = true;
      const bPlane = new THREE.Mesh(_doorPlaneGeo, isMirrorRight ? dm.faceMat : dm.faceMatM);
      bPlane.position.set(cxLeaf, 1.0, -dThick * 0.5); bPlane.rotation.y = Math.PI; bPlane.castShadow = !_isMobilePerf; bPlane.receiveShadow = true;
      pivot.add(fPlane, bPlane);

      const topE = new THREE.Mesh(_getBoxGeo(1.0, 0.01, dThick), dm.edgeMat); topE.position.set(cxLeaf, 1.995, 0);
      const botE = new THREE.Mesh(_getBoxGeo(1.0, 0.01, dThick), dm.edgeMat); botE.position.set(cxLeaf, 0.005, 0);
      const stL  = new THREE.Mesh(_getBoxGeo(0.01, 2.0, dThick), dm.edgeMat); stL.position.set(cxLeaf - 0.495, 1.0, 0);
      const stR  = new THREE.Mesh(_getBoxGeo(0.01, 2.0, dThick), dm.edgeMat); stR.position.set(cxLeaf + 0.495, 1.0, 0);
      pivot.add(topE, botE, stL, stR);

      // 3D Protruding Doorknob + Hinge Brackets on both faces for authentic 3D depth!
      const knobMat = _getChestMats(tier === 'iron' ? 'iron' : 'gold').latch;
      const knobX = cxLeaf + dirX * 0.30;
      const knobBox = new THREE.Mesh(_getBoxGeo(0.11, 0.09, dThick + 0.055), knobMat);
      knobBox.position.set(knobX, 0.96, 0);
      pivot.add(knobBox);
      const hingeMat = _getChestMats('iron').rim;
      for (const hy of [0.34, 1.00, 1.66]) {
        const hBr = new THREE.Mesh(_getBoxGeo(0.09, 0.14, dThick + 0.018), hingeMat);
        hBr.position.set(cxLeaf - dirX * 0.46, hy, 0);
        pivot.add(hBr);
      }

      if (dm.mode === 'open') {
        const inBarV = new THREE.Mesh(_getBoxGeo(0.125, 0.5625, dThick - 0.004), dm.edgeMat); inBarV.position.set(cxLeaf, 1.53125, 0);
        const inBarH = new THREE.Mesh(_getBoxGeo(0.625, 0.0625, dThick - 0.004), dm.edgeMat); inBarH.position.set(cxLeaf, 1.53125, 0);
        const winTop = new THREE.Mesh(_getBoxGeo(0.625, 0.01, dThick - 0.004), dm.edgeMat); winTop.position.set(cxLeaf, 1.8125, 0);
        const winBot = new THREE.Mesh(_getBoxGeo(0.625, 0.01, dThick - 0.004), dm.edgeMat); winBot.position.set(cxLeaf, 1.25, 0);
        const winL   = new THREE.Mesh(_getBoxGeo(0.01, 0.5625, dThick - 0.004), dm.edgeMat); winL.position.set(cxLeaf - 0.3125, 1.53125, 0);
        const winR   = new THREE.Mesh(_getBoxGeo(0.01, 0.5625, dThick - 0.004), dm.edgeMat); winR.position.set(cxLeaf + 0.3125, 1.53125, 0);
        pivot.add(inBarV, inBarH, winTop, winBot, winL, winR);
      }

      wrap.add(pivot);
      g.add(wrap);
      targetAng = doorOpenState.get(k) ? openSign : 0;
      g.userData.openSign = openSign;
    } else if (def.trapdoor) {
      kind = 'trapdoor';
      const tier = def.doorTier || 'oak';
      const dm = getDoorVoxelMatSet(tier);
      pivot = new THREE.Group();
      pivot.position.set(0.5, 0.09, 0.09);
      const tMesh = new THREE.Mesh(_getBoxGeo(0.96, 0.18, 0.96), [dm.edgeMat, dm.edgeMat, dm.trapMat, dm.trapMat, dm.edgeMat, dm.edgeMat]);
      tMesh.position.set(0, 0, 0.41);
      tMesh.castShadow = !_isMobilePerf; tMesh.receiveShadow = true;
      pivot.add(tMesh);
      g.add(pivot);
      targetAng = doorOpenState.get(k) ? -1.52 : 0;
    } else if (def.dragonEgg) {
      kind = 'dragon_egg';
      const eggMesh = _buildDragonEggMesh(def.eggPal, 1.0);
      eggMesh.position.set(0.5, 0, 0.5);
      g.add(eggMesh);
      scene.add(g);
      _setInteractiveVisual(k, { kind, id, group: g, pivot: null, curAng: 0, targetAng: 0, openSign: 0, doorSig, chestSig, chKey });
      return;
    } else if (def.dragonHead) {
      kind = 'dragon_head';
      const headG = build3DDragonHeadMesh(0.88);
      headG.position.set(0.5, 0.04, 0.5);
      headG.rotation.y = dragonHeadYaw.has(k) ? dragonHeadYaw.get(k) : 0;
      g.add(headG);
      scene.add(g);
      _setInteractiveVisual(k, { kind, id, group: g, pivot: headG.userData.jawPivot || null, curAng: 0, targetAng: 0, openSign: 0, phase: (wx * 0.63 + wz * 0.91), doorSig, chestSig, chKey });
      return;
    } else if (def.windmillHub) {
      kind = 'windmill_hub';
      const st = windmillHubState.get(k);
      const hubG = build3DWindmillRotorMesh(1.0);
      hubG.position.set(0.5, 0.5, 0.5);
      hubG.rotation.y = st ? st.yaw : 0;
      g.add(hubG);
      scene.add(g);
      _setInteractiveVisual(k, { kind, id, key: k, group: g, pivot: hubG.userData.rotorPivot || null, curAng: 0, targetAng: 0, openSign: 0, phase: (wx * 0.37 + wz * 0.53), doorSig, chestSig, chKey });
      return;
    } else if (def.endCrystal) {
      kind = 'end_crystal';
      const M = _getEndCrystalMats();
      const base = new THREE.Mesh(_getBoxGeo(0.88, 0.14, 0.88), M.baseMat);
      base.position.set(0.5, 0.07, 0.5);
      base.castShadow = !_isMobilePerf;
      base.receiveShadow = true;
      g.add(base);
      const floatGrp = new THREE.Group();
      floatGrp.position.set(0.5, 0.58, 0.5);
      const cage1 = new THREE.Mesh(_getBoxGeo(0.68, 0.68, 0.68), M.cageMat);
      cage1.rotation.set(0.7854, 0.0, 0.7854);
      const cage2 = new THREE.Mesh(_getBoxGeo(0.58, 0.58, 0.58), M.cageMat);
      cage2.rotation.set(-0.7854, 0.7854, 0.0);
      const core = new THREE.Mesh(_getBoxGeo(0.44, 0.44, 0.44), M.coreMat);
      floatGrp.add(cage1, cage2, core);
      g.add(floatGrp);
      scene.add(g);
      _setInteractiveVisual(k, { kind, id, group: g, pivot: null, floatGrp, cage1, cage2, core, phase: (wx * 0.73 + wz * 1.19), curAng: 0, targetAng: 0, openSign: 0, doorSig, chestSig, chKey });
      return;
    }
    if (pivot) {
      if (kind === 'door') pivot.rotation.y = targetAng;
      else pivot.rotation.x = targetAng;
    }
    scene.add(g);
    _setInteractiveVisual(k, { kind, id, group: g, pivot, curAng: targetAng, targetAng, openSign: g.userData.openSign || -1.52, doorSig, chestSig, chKey });
  }

  function clearChunkInteractiveVisuals(chKey) {
    const set = interactiveByChunk.get(chKey);
    if (!set) return;
    for (const k of set) {
      const v = interactiveVisuals.get(k);
      if (v) { scene.remove(v.group); interactiveVisuals.delete(k); endCrystalVisuals.delete(k); animatedInteractiveVisuals.delete(k); }
    }
    interactiveByChunk.delete(chKey);
  }

  // Active Furnace / Blast Furnace / Smoker Smelting Ticker (runs continuously on real wall-clock dt while in-world)
  function tickFurnaces(dt) {
    if (furnaceStateMap.size <= 0) return;
    let activeFurnUpdated = false;
    for (const [fk, fs] of furnaceStateMap.entries()) {
      const speedMul = (fs.type === 'blast' || fs.type === 'smoker') ? 2.0 : 1.0;
      const rec = fs.inSlot.count > 0 ? SMELT_RECIPES[fs.inSlot.id] : null;
      const allowRec = rec && (fs.type === 'furnace' || (fs.type === 'blast' && rec.kind === 'ore') || (fs.type === 'smoker' && rec.kind === 'food'));
      const canOut = allowRec && (fs.outSlot.count === 0 || (fs.outSlot.id === rec.out && fs.outSlot.count < 99));
      if (fs.burnLeft > 0) fs.burnLeft = Math.max(0, fs.burnLeft - dt * speedMul);
      if (canOut && fs.burnLeft <= 0 && fs.fuelSlot.count > 0 && FUEL_VALUES[fs.fuelSlot.id]) {
        const fId = fs.fuelSlot.id;
        fs.burnMax = FUEL_VALUES[fId];
        fs.burnLeft = fs.burnMax;
        if (fId === B.LAVA_BUCKET) { fs.fuelSlot.id = B.BUCKET; fs.fuelSlot.count = 1; }
        else { fs.fuelSlot.count--; if (fs.fuelSlot.count <= 0) fs.fuelSlot.id = 0; }
        if (fk === activeFurnaceKey) activeFurnUpdated = true;
      }
      if (canOut && fs.burnLeft > 0) {
        const cookNeed = (rec.cookTime || 10.0) / speedMul;
        fs.cookNeed = cookNeed;
        fs.cookT += dt;
        if (Math.random() < dt * 2.5) {
          const pts = fk.split(',');
          spawnParticles(+pts[0] + 0.5, +pts[1] + 0.65, +pts[2] + 0.5, 0xf97316, 1, true);
        }
        if (fs.cookT >= cookNeed) {
          fs.cookT = 0;
          fs.inSlot.count--; if (fs.inSlot.count <= 0) fs.inSlot.id = 0;
          if (fs.outSlot.count === 0) { fs.outSlot.id = rec.out; fs.outSlot.count = 1; }
          else fs.outSlot.count++;
          if (fk === activeFurnaceKey) activeFurnUpdated = true;
        }
      } else {
        fs.cookT = Math.max(0, fs.cookT - dt * 2.0);
      }
    }
    if (activeFurnaceKey) updateFurnaceModalLiveBars(activeFurnUpdated);
  }


  function updateInteractiveHinges(dt) {
    // 1) Smooth 60 FPS hinged animation for all 3D Chests, Doors (Single & Mirrored Double!) & Trapdoors!
    if (_hingesAnimating && interactiveVisuals.size > 0) {
      let anyMoved = false;
      const stepK = Math.min(1, dt * 11.5);
      for (const [k, v] of interactiveVisuals.entries()) {
        if (!v.pivot) continue;
        if (v.kind === 'chest') v.targetAng = (activeChestKey === k || activeChestPartnerKey === k) ? -1.42 : 0;
        else v.targetAng = doorOpenState.get(k) ? (v.openSign || -1.52) : 0;
        const diff = v.targetAng - v.curAng;
        if (v.group && !v.group.visible && (activeChestKey === k || activeChestPartnerKey === k || Math.abs(diff) > 0.004)) v.group.visible = true;
        if (Math.abs(diff) > 0.004) {
          v.curAng += diff * stepK;
          if (v.kind === 'door') v.pivot.rotation.y = v.curAng;
          else v.pivot.rotation.x = v.curAng;
          anyMoved = true;
        } else if (diff !== 0) {
          v.curAng = v.targetAng;
          if (v.kind === 'door') v.pivot.rotation.y = v.curAng;
          else v.pivot.rotation.x = v.curAng;
        }
      }
      _hingesAnimating = anyMoved;
    } else if (_hingesAnimating) {
      _hingesAnimating = false;
    }
  }

  const _nearLavaCells = [];
  let _lavaScanAcc = 0, _lavaFxAcc = 0, _lavaLastDim = '';
  function updateInteractiveBlocksAndWorldTicks(dt) {
    if (_hingesAnimating && interactiveVisuals.size > 0) {
      updateInteractiveHinges(dt);
    } else {
      _hingesAnimating = false;
      // More Culling: 6-plane camera frustum + distance culling for 3D sub-block models (chests, doors, trapdoors, crystals)
      if ((frameCounter & 3) === 0 && interactiveVisuals.size > 0) {
        const useMoreCull = !(typeof sodiumOpts !== 'undefined' && !sodiumOpts.moreCulling);
        const px = player.x, py = player.y + EYE_HEIGHT, pz = player.z;
        const maxSubD2 = ((renderDistance || 3) * CHUNK_W + 6) * ((renderDistance || 3) * CHUNK_W + 6);
        for (const v of interactiveVisuals.values()) {
          if (!v || !v.group) continue;
          if (!useMoreCull) { v.group.visible = true; continue; }
          const gp = v.group.position;
          const dx = gp.x + 0.5 - px, dy = gp.y + 0.5 - py, dz = gp.z + 0.5 - pz;
          const d2 = dx * dx + dy * dy + dz * dz;
          const isMill = (v.kind === 'windmill_hub');
          if (d2 <= (isMill ? 144.0 : 36.0)) { v.group.visible = true; continue; }
          if (d2 > (isMill ? maxSubD2 * 1.44 : maxSubD2)) { v.group.visible = false; continue; }
          if (_camFrustumReady) {
            _cullSphere.center.set(gp.x + 0.5, gp.y + 0.5, gp.z + 0.5);
            _cullSphere.radius = isMill ? 9.5 : 1.65;
            v.group.visible = _camFrustum.intersectsSphere(_cullSphere);
          } else {
            v.group.visible = true;
          }
        }
      }
    }

    // 2) Authentic 60 FPS 3D End Crystal Floating & Triple-Axis Counter-Rotation Animation!
    if (endCrystalVisuals.size > 0 && (typeof sodiumOpts === 'undefined' || sodiumOpts.animations !== false)) {
      for (const v of endCrystalVisuals.values()) {
        if (!v || !v.group || !v.group.visible || !v.floatGrp) continue;
        const t = elapsed * 2.2 + (v.phase || 0);
        v.floatGrp.position.y = 0.58 + Math.sin(t) * 0.085;
        v.cage1.rotation.y += dt * 1.45;
        v.cage1.rotation.x += dt * 0.72;
        v.cage2.rotation.y -= dt * 1.85;
        v.cage2.rotation.z += dt * 1.10;
        v.core.rotation.x += dt * 2.20;
        v.core.rotation.y += dt * 1.95;
      }
    }
    if (animatedInteractiveVisuals.size > 0 && (typeof sodiumOpts === 'undefined' || sodiumOpts.animations !== false)) {
      for (const v of animatedInteractiveVisuals.values()) {
        if (v && v.kind === 'dragon_head' && v.pivot && v.group && v.group.visible) {
          v.pivot.rotation.x = Math.max(0, Math.sin(elapsed * 2.4 + (v.phase || 0)) * 0.24);
        } else if (v && v.kind === 'windmill_hub' && v.pivot && v.group && v.group.visible) {
          const st = windmillHubState.get(v.key);
          const targetSpd = st ? st.speed : 1;
          if (v._curSpd === undefined) v._curSpd = targetSpd;
          v._curSpd += (targetSpd - v._curSpd) * Math.min(1, dt * 4.5);
          if (v._curSpd > 0.005) {
            const windBoost = (typeof activeWeatherKind !== 'undefined' && activeWeatherKind !== 'clear') ? 1.45 : 1.0;
            v.pivot.rotation.z -= Math.min(0.06, dt) * 0.62 * v._curSpd * windBoost;
          }
        }
      }
    }

    // 3) Natural Wheat Crop Growth Ticker (WHEAT_0 -> WHEAT_1 -> WHEAT_2 -> WHEAT_3 golden ripe!)
    cropTickAccum += dt;
    if (cropTickAccum >= 2.2) {
      cropTickAccum = 0;
      const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ch = chunks.get(chunkKey(pcx + dx, pcz + dz));
        if (!ch || (sodiumOpts.lithiumAi && ch.isOceanChunk)) continue;
        const d = ch.data, wx0 = ch.cx * CHUNK_W, wz0 = ch.cz * CHUNK_W;
        for (let tries = 0; tries < 28; tries++) {
          const lx = (Math.random() * 16) | 0, lz = (Math.random() * 16) | 0;
          const ly = Math.min(ch.maxLy, Math.max(2, (Math.floor(player.y) - MIN_Y) + ((Math.random() * 14 - 7) | 0)));
          const id = d[(ly << 8) | (lz << 4) | lx];
          if (id === B.WHEAT_0 || id === B.WHEAT_1 || id === B.WHEAT_2) {
            setBlockWorld(wx0 + lx, MIN_Y + ly, wz0 + lz, id + 1, true);
            spawnParticles(wx0 + lx + 0.5, MIN_Y + ly + 0.4, wz0 + lz + 0.5, 0x86efac, 3, true);
          } else if (BLOCK_DEF[id]?.isSapling && Math.random() < 0.08) {
            growSaplingAt(wx0 + lx, MIN_Y + ly, wz0 + lz, id);
          }
        }
      }
    }

    // 3b) Planted Sapling Growth Timer (grows naturally after targetAge seconds!)
    if (plantedSaplings.size > 0) {
      for (const [sk, sap] of plantedSaplings) {
        if (getBlockWorld(sap.x, sap.y, sap.z) !== sap.id) { plantedSaplings.delete(sk); saplingFertilizeCount.delete(sk); continue; }
        sap.age += dt;
        if (sap.age >= sap.targetAge) {
          if (!growSaplingAt(sap.x, sap.y, sap.z, sap.id)) sap.age = sap.targetAge - 6.0;
        }
      }
    }

    // 4) Tick Active Voxel Fires (Animation-synced spread, burnout & rain extinguish)
    if (activeFires.size > 0) tickActiveFires(dt);

    // 5) Lava Surface Fire/Ember/Bubble Particle Emitter + Proximity Audio Signal
    _lavaScanAcc += dt;
    if (window._rtVolDirty || currentDimension !== _lavaLastDim || _lavaScanAcc >= 0.25) {
      _lavaScanAcc = 0;
      _lavaLastDim = currentDimension;
      _nearLavaCells.length = 0;
      const pFx = Math.floor(player.x), pFy = Math.floor(player.y), pFz = Math.floor(player.z);
      const pcxL = pFx >> 4, pczL = pFz >> 4;
      let minD2 = 1e9, seenL = 0;
      const yLo = Math.max(MIN_Y + 1, pFy - 9), yHi = Math.min(MAX_Y - 1, pFy + 9);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ch = chunks.get(chunkKey(pcxL + dx, pczL + dz));
          if (!ch || !ch.lavaMesh || !ch.data) continue;
          const d = ch.data, wx0 = ch.cx * CHUNK_W, wz0 = ch.cz * CHUNK_W;
          const chTop = Math.min(yHi, MIN_Y + (ch.maxLy || (WORLD_H - 1)) - 1);
          for (let wy = yLo; wy <= chTop; wy++) {
            const ly = wy - MIN_Y, dyL = wy - pFy;
            const rowOff = ly << 8, aboveOff = (ly + 1) << 8;
            for (let lz = 0; lz < 16; lz++) {
              const wz = wz0 + lz, dzL = wz + 0.5 - player.z;
              if (dzL < -18 || dzL > 18) continue;
              const zOff = lz << 4;
              for (let lx = 0; lx < 16; lx++) {
                const idxL = rowOff | zOff | lx;
                if (d[idxL] !== B.LAVA || d[aboveOff | zOff | lx] !== B.AIR) continue;
                const wx = wx0 + lx, dxL = wx + 0.5 - player.x;
                const d2 = dxL * dxL + dyL * dyL + dzL * dzL;
                if (d2 > 324) continue;
                if (d2 < minD2) minD2 = d2;
                seenL++;
                if (_nearLavaCells.length < 48) {
                  _nearLavaCells.push({ x: wx, y: wy, z: wz });
                } else if (Math.random() < 48 / seenL) {
                  _nearLavaCells[(Math.random() * 48) | 0] = { x: wx, y: wy, z: wz };
                }
              }
            }
          }
        }
      }
      const minDist = minD2 < 1e8 ? Math.sqrt(minD2) : 99;
      window._nearbyLavaProx = (player.inLava || player.eyesInLava)
        ? 1.0
        : (minDist < 16.0 ? Math.pow(Math.max(0, 1.0 - minDist / 16.0), 1.35) : 0.0);
    }

    _lavaFxAcc += dt;
    const _lavaEmitInterval = _isMobilePerf ? 0.14 : 0.09;
    if (_lavaFxAcc >= _lavaEmitInterval) {
      _lavaFxAcc = 0;
      if (_nearLavaCells.length > 0 && !player.eyesInLava && (typeof sodiumOpts === 'undefined' || sodiumOpts.particles !== false)) {
        const nEmit = _isMobilePerf ? 1 : Math.min(3, Math.max(1, Math.ceil(_nearLavaCells.length / 8)));
        for (let ei = 0; ei < nEmit; ei++) {
          const cell = _nearLavaCells[(Math.random() * _nearLavaCells.length) | 0];
          const fx = cell.x + 0.15 + Math.random() * 0.70;
          const fy = cell.y + 0.90;
          const fz = cell.z + 0.15 + Math.random() * 0.70;
          const roll = Math.random();
          if (roll < 0.50) {
            if (typeof spawnVoxelFx === 'function') spawnVoxelFx('ember', fx, fy, fz, 2);
          } else if (roll < 0.72) {
            if (typeof spawnPixelFx === 'function') spawnPixelFx('fire_flame', fx, fy + 0.04, fz, { count: 1, scale: 0.62 + Math.random() * 0.25, life: 0.36 + Math.random() * 0.16, riseV: 1.05, randV: 0.35, spread: 0.22 });
          } else if (roll < 0.90) {
            if (typeof spawnVoxelFx === 'function') spawnVoxelFx('lava_pop', fx, fy, fz, 1);
            if (typeof _spawnOneParticle === 'function') _spawnOneParticle(fx, fy + 0.05, fz, 0xff6b00, { kind: 'lava_drop', rise: false, scale: 0.48, vx: (Math.random() - 0.5) * 1.4, vy: 2.8 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.4, life: 0.65, grav: 11.5 });
          } else {
            if (typeof spawnPixelFx === 'function') spawnPixelFx('smoke_puff', fx, fy + 0.08, fz, { count: 1, scale: 0.68, life: 0.58, riseV: 0.72, randV: 0.22, spread: 0.20 });
          }
          window._lavaParticleSpawns = (window._lavaParticleSpawns || 0) + 1;
        }
      }
    }
  }


  function updateChunkStreaming(rawDt = 0.016) {
    window._chunkBuiltThisFrame = false;
    const tBudgetStart = performance.now();
    const _sodiumTight = (typeof sodiumOpts === 'undefined' || sodiumOpts.sodium !== false);
    const frameBudgetMs = _sodiumTight
      ? ((rawDt && rawDt > 0.028) ? (_isMobilePerf ? 1.2 : 1.5) : (_isMobilePerf ? 1.8 : 2.2))
      : ((rawDt && rawDt > 0.028) ? (_isMobilePerf ? 1.4 : 1.8) : (_isMobilePerf ? 2.5 : ((rawDt && rawDt < 0.008) ? 2.2 : 4.2)));
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    const fwdX = -Math.sin(player.yaw || 0), fwdZ = -Math.cos(player.yaw || 0);
    const isMoving = (player.curSpeed || 0) > 1.2 || !!player.sprinting || !!player.flying;
    const vLen = Math.hypot(player.vx || 0, player.vz || 0);
    const dirX = vLen > 0.5 ? player.vx / vLen : fwdX;
    const dirZ = vLen > 0.5 ? player.vz / vLen : fwdZ;
    const acx = Math.floor(player.x + dirX * 14) >> 4;
    const acz = Math.floor(player.z + dirZ * 14) >> 4;

    // Incremental deferred unloading (max 2 chunks/frame during movement, faster catch-up after large teleports)
    if (_chunkUnloadQueue.length > 0) {
      let disposed = 0;
      const maxUnload = _chunkUnloadQueue.length > 64 ? 32 : 2;
      while (_chunkUnloadQueue.length > 0 && disposed < maxUnload) {
        const uk = _chunkUnloadQueue.pop();
        _chunkUnloadSet.delete(uk);
        const uch = chunks.get(uk);
        if (uch && (Math.abs(uch.cx - pcx) > renderDistance + 1 || Math.abs(uch.cz - pcz) > renderDistance + 1)) {
          _dirtyChunkSet.delete(uch); _urgentChunkSet.delete(uch); _borderChunkSet.delete(uch);
          disposeChunkMeshes(uch);
          _freeChunkData(uch);
          chunks.delete(uk); _invChunkCache();
          disposed++;
        }
      }
    }

    const movedChunk = (pcx !== lastPlayerCx || pcz !== lastPlayerCz);
    const turnedEnough = Math.abs(player.yaw - _lastChunkSortYaw) > 0.55;
    if (movedChunk) {
      lastPlayerCx = pcx; lastPlayerCz = pcz;
      for (let r = 0; r <= renderDistance; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = pcx + dx, cz = pcz + dz, k = chunkKey(cx, cz);
        if (!chunks.has(k) && !emergeSet.has(k)) { emergeSet.add(k); emergeQueue.push([cx, cz]); }
      }
      const unloadDist = renderDistance + 1;
      for (const [k, ch] of chunks.entries()) {
        if ((Math.abs(ch.cx - pcx) > unloadDist || Math.abs(ch.cz - pcz) > unloadDist) && !_chunkUnloadSet.has(k)) {
          _chunkUnloadSet.add(k);
          _chunkUnloadQueue.push(k);
        }
      }
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const nch = chunks.get(chunkKey(pcx + dx, pcz + dz));
        if (nch && nch._pendingSlice) { nch.urgentDirty = true; _urgentChunkSet.add(nch); }
      }
    }
    if ((movedChunk || turnedEnough) && emergeQueue.length > 1) {
      _lastChunkSortYaw = player.yaw || 0;
      // Descending sort so highest priority (lowest score) is popped in O(1) from the tail
      emergeQueue.sort((a, b) =>
        _chunkFrustumScore(b[0], b[1], pcx, pcz, fwdX, fwdZ, acx, acz) -
        _chunkFrustumScore(a[0], a[1], pcx, pcz, fwdX, fwdZ, acx, acz)
      );
    }
    if (chunkWorkerPool.active && currentDimension === 'overworld' && emergeQueue.length > 0) {
      const lookAhead = _isMobilePerf ? 6 : 10;
      for (let pi = emergeQueue.length - 1, lim = Math.max(0, emergeQueue.length - lookAhead); pi >= lim; pi--) {
        chunkWorkerPool.prefetch(emergeQueue[pi][0], emergeQueue[pi][1], depthOffset);
      }
    }

    // O(D) scan over dirty/urgent/border chunk sets only (never scans untouched loaded chunks!)
    let urgentCh = null, dirtyCh = null, dirtyScore = 1e9, dirtyCh2 = null, dirtyScore2 = 1e9, borderCh = null, borderScore = 1e9;
    for (const ch of _urgentChunkSet) {
      if (ch.urgentDirty) { urgentCh = ch; break; }
      else _urgentChunkSet.delete(ch);
    }
    if (!urgentCh) {
      for (const ch of _dirtyChunkSet) {
        if (!ch.dirty) { _dirtyChunkSet.delete(ch); continue; }
        let sc = _chunkFrustumScore(ch.cx, ch.cz, pcx, pcz, fwdX, fwdZ, acx, acz);
        if (ch._pendingSlice) sc *= 0.35;
        if (sc < dirtyScore) { dirtyScore2 = dirtyScore; dirtyCh2 = dirtyCh; dirtyScore = sc; dirtyCh = ch; }
        else if (sc < dirtyScore2) { dirtyScore2 = sc; dirtyCh2 = ch; }
      }
      if (!dirtyCh) {
        for (const ch of _borderChunkSet) {
          if (!ch.borderDirty) { _borderChunkSet.delete(ch); continue; }
          const sc = _chunkFrustumScore(ch.cx, ch.cz, pcx, pcz, fwdX, fwdZ, acx, acz);
          if (sc < borderScore) { borderScore = sc; borderCh = ch; }
        }
      }
    }

    if (urgentCh) {
      window._chunkBuiltThisFrame = true;
      flushUrgentChunks(_isMobilePerf ? 3 : 6);
      return;
    }

    // Luanti-style frame-budgeted chunk streaming: keep normal movement stutter-free while allowing near seam fixes
    if (!document.body.classList.contains('in-lobby') && !window._isWorldPaused) {
      let ops = 0, meshOps = 0;
      const warming = _teleportWarmupFrames > 0;
      if (warming) _teleportWarmupFrames--;
      const maxOps = warming ? (_isMobilePerf ? 3 : 4) : (_isMobilePerf ? 2 : 3);
      const maxMeshOps = warming ? (_isMobilePerf ? 2 : 3) : (isMoving ? 1 : (_isMobilePerf ? 1 : 2));
      const effBudget = warming ? (_isMobilePerf ? 6.5 : 9.5) : frameBudgetMs;
      while (ops < maxOps && (performance.now() - tBudgetStart) < effBudget) {
        if (!warming && ops > 0 && (performance.now() - tBudgetStart) >= 1.8) break;
        _chunkPaceFlip ^= 1;
        const canGen = emergeQueue.length > 0;
        const canMesh = (meshOps < maxMeshOps);
        if (canMesh && dirtyCh && (!canGen || _chunkPaceFlip === 0 || (dirtyCh._pendingSlice && dirtyScore <= 4.5))) {
          rebuildChunkMesh(dirtyCh);
          dirtyCh = dirtyCh2; dirtyCh2 = null;
          meshOps++; ops++;
        } else if (canGen) {
          let generated = false;
          while (emergeQueue.length > 0) {
            const [cx, cz] = emergeQueue.pop(), k = chunkKey(cx, cz); emergeSet.delete(k);
            if (Math.abs(cx - pcx) <= renderDistance + 1 && Math.abs(cz - pcz) <= renderDistance + 1 && !chunks.has(k)) {
              generateChunk(cx, cz);
              generated = true;
              break;
            }
          }
          if (generated) ops++; else break;
        } else if (canMesh && dirtyCh) {
          rebuildChunkMesh(dirtyCh);
          dirtyCh = dirtyCh2; dirtyCh2 = null;
          meshOps++; ops++;
        } else if (canMesh && borderCh && (borderScore <= 4.5 || (!isMoving && (frameCounter & (_isMobilePerf ? 3 : 1)) === 0))) {
          rebuildChunkMesh(borderCh);
          borderCh = null;
          meshOps++; ops++;
        } else {
          break;
        }
      }
      window._chunkBuiltThisFrame = (ops > 0);
      return;
    }

    // Lobby / Title Screen fast initial load (time-budgeted to 5ms/frame)
    const tStart = performance.now();
    if (emergeQueue.length > 0) {
      const [cx, cz] = emergeQueue.pop(), k = chunkKey(cx, cz); emergeSet.delete(k);
      if (Math.abs(cx - pcx) <= renderDistance + 1 && Math.abs(cz - pcz) <= renderDistance + 1 && !chunks.has(k)) generateChunk(cx, cz);
    }
    let rebuilt = 0;
    while (rebuilt < 2 && performance.now() - tStart < 5.0) {
      let bestCh = null, bestD2 = 1e9;
      for (const ch of _dirtyChunkSet) {
        if (!ch || (!ch.dirty && !ch.borderDirty)) { _dirtyChunkSet.delete(ch); continue; }
        const d2 = (ch.cx - pcx) * (ch.cx - pcx) + (ch.cz - pcz) * (ch.cz - pcz);
        if (d2 < bestD2) { bestD2 = d2; bestCh = ch; }
      }
      if (!bestCh) {
        for (const ch of _borderChunkSet) {
          if (!ch || (!ch.dirty && !ch.borderDirty)) { _borderChunkSet.delete(ch); continue; }
          const d2 = (ch.cx - pcx) * (ch.cx - pcx) + (ch.cz - pcz) * (ch.cz - pcz);
          if (d2 < bestD2) { bestD2 = d2; bestCh = ch; }
        }
      }
      if (!bestCh) break;
      rebuildChunkMesh(bestCh);
      rebuilt++;
    }
  }


  function findSafeSpawnPoint(cx = 8, cz = 8, preferScenic = true) {
    if (preferScenic) {
      for (const targetB of [BIOMES.SAKURA, BIOMES.FOREST, BIOMES.PLAINS]) {
        for (let r = 4; r <= 108; r += 4) for (let dz = -r; dz <= r; dz += 4) for (let dx = -r; dx <= r; dx += 4) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const wx = cx + dx, wz = cz + dz, b = getBiomeAt(wx, wz);
          if (b !== targetB) continue;
          const h = getTerrainHeight(wx, wz, b);
          if (h >= WATER_LEVEL + 1 && h <= WATER_LEVEL + 7) {
            for (const [ox, oz] of [[6,0],[-6,0],[0,6],[0,-6],[8,8],[-8,-8]]) {
              const wh = getTerrainHeight(wx + ox, wz + oz, getBiomeAt(wx + ox, wz + oz));
              if (wh <= WATER_LEVEL - 1) {
                return { x: wx + 0.5, y: h + 2, z: wz + 0.5, yaw: Math.atan2(-ox, -oz) };
              }
            }
          }
        }
      }
    }
    for (let r = 0; r <= 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const wx = cx + dx, wz = cz + dz, h = getTerrainHeight(wx, wz, getBiomeAt(wx, wz));
      if (h > WATER_LEVEL) return { x: wx + 0.5, y: h + 2, z: wz + 0.5, yaw: -0.45 };
    }
    return { x: cx + 0.5, y: Math.max(WATER_LEVEL + 2, getTerrainHeight(cx, cz, getBiomeAt(cx, cz)) + 2), z: cz + 0.5, yaw: -0.45 };
  }

  const SAVE_KEY = 'luanti_craft_v13_save';
  function saveWorld() {
    try {
      const modsArr = []; for (const [k, v] of worldMods.entries()) modsArr.push([k, v]);
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seed: worldSeed,
        player: { x: player.x, y: player.y, trueY: player.y - (depthOffset || 0), z: player.z, yaw: player.yaw, pitch: player.pitch, dim: currentDimension, depthOffset: depthOffset || 0, hp: player.hp, armor: player.armor, equip: player.equip, equipMeta: player.equipMeta, offhandDur: player.offhandDur || 336, offhandMaxDur: player.offhandMaxDur || 336, hunger: player.hunger, xp: player.xp, level: player.level, daysPlayed: player.daysPlayed, swiftSneak: player.swiftSneak || 0, bedSpawn: player.bedSpawn || null },
        inventory, dayTime, weatherMode, mods: modsArr.slice(-12000),
        ...serializeChestData()
      }));
      showToast('Đã lưu thế giới v17 thành công!');
    } catch (_) { showToast('Trình duyệt chặn bộ nhớ lưu trữ.'); }
  }
  function findSurfaceTopY(wx, wz) {
    for (let y = MAX_Y - 1; y >= MIN_Y + 1; y--) {
      const id = getBlockWorld(wx, y, wz);
      const def = BLOCK_DEF[id];
      if (id !== B.AIR && id !== B.WATER && !(def && (def.cross || def.foliage))) return { y, id };
    }
    return { y: WATER_LEVEL, id: B.AIR };
  }

  function plantCenterpieceSakuraTree(cx, cz) {
    const top = findSurfaceTopY(cx, cz);
    let baseY = Math.max(WATER_LEVEL + 1, top.y);
    if (top.y <= WATER_LEVEL) {
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        for (let y = top.y + 1; y <= WATER_LEVEL; y++) setBlockWorld(cx + ox, y, cz + oz, B.DIRT, true);
        setBlockWorld(cx + ox, WATER_LEVEL + 1, cz + oz, B.GRASS, true);
      }
      baseY = WATER_LEVEL + 1;
    }
    // Authentic Minecraft Diagonal Cherry Blossom Centerpiece Tree!
    for (let i = 1; i <= 3; i++) setBlockWorld(cx, baseY + i, cz, B.SAKURA_LOG, true);
    setBlockWorld(cx + 1, baseY + 4, cz, B.SAKURA_LOG, true);
    setBlockWorld(cx + 2, baseY + 5, cz, B.SAKURA_LOG, true);
    setBlockWorld(cx + 2, baseY + 6, cz, B.SAKURA_LOG, true);
    setBlockWorld(cx - 1, baseY + 4, cz + 1, B.SAKURA_LOG, true);
    setBlockWorld(cx - 2, baseY + 5, cz + 1, B.SAKURA_LOG, true);
    const drawCrownW = (ox, oy, oz, rMax) => {
      for (let dy = 0; dy <= 3; dy++) {
        const rad = (dy === 0 || dy === 1) ? rMax : (dy === 2 ? Math.max(1, rMax - 1) : 1);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if ((rad >= 3 && dist > rad + 1) || (dy === 3 && dist > 1)) continue;
          if (getBlockWorld(ox + dx, oy + dy, oz + dz) === B.AIR) setBlockWorld(ox + dx, oy + dy, oz + dz, B.SAKURA_LEAVES, true);
        }
      }
      for (const [hx, hz] of [[rMax,0],[-rMax,0],[0,rMax],[0,-rMax],[rMax-1,1],[-(rMax-1),-1]]) {
        if (getBlockWorld(ox + hx, oy - 1, oz + hz) === B.AIR) setBlockWorld(ox + hx, oy - 1, oz + hz, B.SAKURA_LEAVES, true);
      }
    };
    drawCrownW(cx + 2, baseY + 6, cz, 3);
    drawCrownW(cx - 2, baseY + 5, cz + 1, 2);
    for (const [px, pz] of [[2,1],[-2,1],[1,-2],[-1,2],[2,-2]]) {
      const py = findSurfaceTopY(cx + px, cz + pz).y;
      if (py > WATER_LEVEL && getBlockWorld(cx + px, py + 1, cz + pz) === B.AIR) setBlockWorld(cx + px, py + 1, cz + pz, B.SAKURA_PETALS, true);
    }
  }

  function ensureScenicSakuraAcrossLake(spot) {
    const fx = -Math.sin(spot.yaw), fz = -Math.cos(spot.yaw);
    let hasSakura = false;
    for (let d = 6; d <= 20 && !hasSakura; d += 2) {
      const sx = Math.round(spot.x + fx * d), sz = Math.round(spot.z + fz * d);
      for (let oy = 2; oy <= 12; oy++) {
        if (getBlockWorld(sx, oy, sz) === B.SAKURA_LEAVES) { hasSakura = true; break; }
      }
    }
    if (!hasSakura) {
      const tx = Math.round(spot.x + fx * 15), tz = Math.round(spot.z + fz * 15);
      plantCenterpieceSakuraTree(tx, tz);
      if (!isWorldLoading && !window._isWorldPaused && !document.body.classList.contains('in-lobby')) { for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch); }
    }
  }

  function colGroundY(wx, wz) {
    for (let y = MAX_Y - 1; y >= 1; y--) {
      const id = getBlockWorld(wx, y, wz);
      const def = BLOCK_DEF[id];
      if (id === B.AIR || id === B.WATER || id === B.LAVA || !def || def.foliage || def.isLog || def.cross || def.hangingFruit) continue;
      return y;
    }
    return WATER_LEVEL;
  }

  function getCanopyTopY(wx, wz) {
    for (let y = MAX_Y - 1; y >= 1; y--) {
      const id = getBlockWorld(wx, y, wz);
      if (id === B.AIR || id === B.WATER || id === B.LAVA) continue;
      const def = BLOCK_DEF[id];
      if (!def || def.cross) continue;
      return y;
    }
    return WATER_LEVEL;
  }

  // Nền nhà = mặt đất NGAY TRƯỚC CỬA (để cửa không cao chót vót), chỉ nhích lên tối đa 2 block nếu sau nhà dốc cao
  function houseGroundY(hx, hz, r, fz = 1) {
    const frontY = Math.max(WATER_LEVEL + 1, colGroundY(hx, hz + Math.round(r * 0.9) * fz));
    let maxY = frontY;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const gy = colGroundY(hx + dx, hz + dz * fz);
        if (gy > maxY) maxY = gy;
      }
    }
    return Math.max(WATER_LEVEL + 1, Math.min(maxY, frontY + 1));
  }

  function buildDoorAccessStairs(dx, floorY, dz, outX, outZ, mat = B.STONE_BRICK, halfW = 1) {
    const px = -outZ, pz = outX;
    let curY = floorY;
    for (let step = 1; step <= 8; step++) {
      const sx = dx + outX * step, sz = dz + outZ * step;
      let anyBelow = false;
      for (let w = -halfW; w <= halfW; w++) {
        const wx = sx + px * w, wz = sz + pz * w;
        const gy = colGroundY(wx, wz);
        if (step === 1) {
          // Flat welcome threshold right outside the doorway!
          for (let y = gy; y <= floorY; y++) setBlockWorld(wx, y, wz, mat, true);
          for (let hy = 1; hy <= 4; hy++) setBlockWorld(wx, floorY + hy, wz, B.AIR, true);
          if (gy < floorY) anyBelow = true;
        } else if (gy < curY) {
          const stepY = Math.max(gy, curY - 1);
          for (let y = gy; y <= stepY; y++) setBlockWorld(wx, y, wz, mat, true);
          for (let hy = 1; hy <= 4; hy++) setBlockWorld(wx, stepY + hy, wz, B.AIR, true);
          if (gy < stepY) anyBelow = true;
        } else if (gy > floorY && step <= 3) {
          // Carve clear walkway if hill is slightly above doorway!
          for (let hy = 1; hy <= 4; hy++) setBlockWorld(wx, floorY + hy, wz, B.AIR, true);
        }
      }
      if (step > 1) curY--;
      if (!anyBelow && step >= 2) break;
    }
  }



  // ===================== 3 BRAND-NEW HANDCRAFTED VOXEL HOUSE MODELS (Cottage, Medieval Mansion w/ Double Doors & Turret, Garden Vine Villa!) =====================






  // ===================== NEW HOUSE MODELS FROM house/ REFERENCE IMAGES (Tudor Estate, Grand Tudor Manor, Winter Cabin, Starter House & Forest Cabin) =====================










  // ===================== HỆ THỐNG NHÀ v31 — WIPE SẠCH v30, 5 THIẾT KẾ MỚI THEO 5 ẢNH THAM KHẢO =====================
  // Quy trình layer-by-layer (theo prompt AI-builder): nền → khung → tường/cửa → mái → khói/hiên/ban công
  // → dây leo/hoa/đèn → cảnh quan (đường, ruộng lúa, mê cung hàng rào) → nội thất mới.
  //   House 1 — RED-BROWN ROOF COTTAGE (ảnh images - Copy / images.jpg): 2 tầng, mái ngói đỏ nâu dốc,
  //             tường kem, cửa kính khung gỗ đậm, ống khói gạch + khói, dây leo phủ mái, bậc đá, ruộng lúa 2 bên.
  //   House 2 — TUDOR MANOR (ảnh images (4)/(59)): khung gỗ cam-nâu + tường kem, mái phiến xám nhiều tầng,
  //             tháp đá góc, hiên vòm cột, bậc đá, ống khói gạch, MÊ CUNG HÀNG RÀO trước nhà, đường đá cuội.
  //   House 3 — SMALL BRICK COTTAGE (ảnh images (5)): nửa trái gạch đỏ + khói gạch, nửa phải tường kem cửa lớn,
  //             mái xám phủ dây leo, hoa bụi quanh nhà.
  //   House 4 — TIMBER CABIN (ảnh images (6)): khung gỗ, mái xám đậm, ống khói đá cao + hoa đỏ trên đỉnh,
  //             hiên phải + bậc đá, cửa gỗ đậm, đèn treo, đống gỗ + thùng bên hông.
  //   House 5 — LAKESIDE COTTAGE (ảnh images (7)): 2 tầng, mái ngói cam + rêu/lá, tường sáng, ban công rào,
  //             hoa tím/xanh cửa sổ, ống khói, ruộng lúa bên hông.
  // Luật giữ: cửa ngang mặt đất, sân phẳng, cầu thang nội bộ rộng 3 block, sàn 2 = baseY+6, trần kín + bịt khe mái.

  function vStone(wx, wz, s) { return B.SMOOTH_STONE; }

  // NỀN: dọn đất + móng đá + sân trước phẳng
  function vBase(hx, hz, halfX, halfZ, fz) {
    const baseY = Math.max(WATER_LEVEL, houseGroundY(hx, hz, halfX + 1, fz) - 1);
    for (let dz = -halfZ - 2; dz <= halfZ + 2; dz++) for (let dx = -halfX - 2; dx <= halfX + 2; dx++) {
      const inside = (Math.abs(dx) <= halfX && Math.abs(dz) <= halfZ);
      const wx = hx + dx, wz = hz + dz * fz, gy = colGroundY(wx, wz);
      for (let wy = (inside ? 1 : 4); wy <= 28; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      if (inside) for (let y = Math.min(gy, baseY); y < baseY; y++) setBlockWorld(wx, y, wz, vStone(wx, wz), true);
    }
    for (let dz = halfZ + 1; dz <= halfZ + 4; dz++) for (let dx = -3; dx <= 3; dx++) {
      const wx = hx + dx, wz = hz + dz * fz;
      for (let wy = baseY + 1; wy <= baseY + 18; wy++) setBlockWorld(wx, wy, wz, B.AIR, true);
      const g = colGroundY(wx, wz);
      if (g < baseY) for (let y = g + 1; y <= baseY; y++) setBlockWorld(wx, y, wz, y === baseY ? B.GRASS : B.DIRT, true);
    }
    return baseY;
  }
  function vP(hx, hz, fz, baseY) { return (dx, y, dz, id) => setBlockWorld(hx + dx, baseY + y, hz + dz * fz, id, true); }

  // MÁI: 2 dốc bằng block cầu thang 45° + diềm gỗ full-block + tam giác đầu hồi + diềm che gầm
  function vRoof(put, halfX, zE, eaveY, ridgeMat, edgeMat, stairBase, gableFn) {
    for (let s = 0; s <= zE; s++) {
      const y = eaveY + s, z = zE - s;
      for (let dx = -halfX - 1; dx <= halfX + 1; dx++) {
        const edge = Math.abs(dx) === halfX + 1;
        if (z === 0) put(dx, y, 0, ridgeMat);
        else if (edge) { put(dx, y, z, edgeMat); put(dx, y, -z, edgeMat); }
        else { put(dx, y, z, stairBase); put(dx, y, -z, stairBase + 1); }
      }
      if (gableFn) for (const gx of [-halfX, halfX]) for (let zz = -(z - 1); zz <= z - 1; zz++) gableFn(gx, y, zz);
    }
    for (let dx = -halfX - 1; dx <= halfX + 1; dx++) { put(dx, eaveY - 1, zE, edgeMat); put(dx, eaveY - 1, -zE, edgeMat); }
    for (let z = -zE; z <= zE; z++) { put(halfX + 1, eaveY - 1, z, edgeMat); put(-halfX - 1, eaveY - 1, z, edgeMat); }
  }
  // HỒI PHỤ MẶT TIỀN (dormer): hộp tường nhô 1 block + nón mái cầu thang
  function vDormer(put, gxC, halfW, zFront, y0, capBaseY, wallMat, frameMat, roofStair, roofEdge) {
    for (let w = -halfW; w <= halfW; w++) {
      const dx = gxC + w;
      for (let wy = y0; wy < capBaseY; wy++) {
        const isGlass = (wy === capBaseY - 3 || wy === capBaseY - 2) && Math.abs(w) <= halfW - 1;
        put(dx, wy, zFront, isGlass ? B.GLASS : (Math.abs(w) === halfW ? frameMat : wallMat));
      }
    }
    for (let w = -halfW; w <= halfW; w++) {
      const yTop = capBaseY + halfW - Math.abs(w);
      for (let y = capBaseY; y <= yTop; y++) put(gxC + w, y, zFront, Math.abs(w) === halfW ? roofEdge : roofStair);
    }
    for (let z = zFront - 1; z >= zFront - 2; z--) put(gxC, capBaseY + halfW, z, roofStair);
  }
  // TRẦN PHẲNG (không xà ngang theo yêu cầu)
  function vCeil(put, halfX, halfZ, y, beamMat) {
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) put(dx, y, dz, B.PLANKS);
  }
  // BỊT KHE MÁI: chỉ lấp ô khí NẰM DƯỚI mặt mái dốc (không tràn lên trên mái)
  function vSeal(put, hx, hz, fz, baseY, halfX, halfZ, ceilY, eaveY, zE, mat) {
    for (let wy = ceilY + 1; wy <= eaveY + zE; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, onZ = Math.abs(dz) === halfZ;
      if (!onX && !onZ) continue;
      const maxY = onZ ? (eaveY + (zE - Math.abs(dz)) - 1) : (eaveY - 1);
      if (wy > maxY) continue;
      const wx = hx + dx, wy2 = baseY + wy, wz = hz + dz * fz;
      if (getBlockWorld(wx, wy2, wz) === B.AIR) setBlockWorld(wx, wy2, wz, mat, true);
    }
  }
  // CẦU THANG NỘI BỘ rộng 3 block — CHÂN THANG QUAY RA GIỮA PHÒNG (đi xuống không chạm tường)
  // Leo về phía -X (tường trái): bậc thấp ở dx=-halfX+6 (giữa phòng), bậc cao ở dx=-halfX+3 (sát tường)
  function vStairs(put, halfX, halfZ) {
    for (let st = 0; st < 4; st++) {
      const sx = -halfX + 6 - st, sy = 1 + st;
      for (let sz = -halfZ + 1; sz <= -halfZ + 3; sz++) {
        put(sx, sy, sz, B.OAK_STAIRS_W);
        put(sx, sy + 1, sz, B.AIR); put(sx, sy + 2, sz, B.AIR);
        if (st < 3) put(sx, sy - 1, sz, B.PLANKS);
      }
    }
  }
  // CỬA TRƯỚC + SAU + khung lồi + đèn + bậc đá
  function vDoors(put, halfZ, doorId, hasBack, steps) {
    const zf = halfZ + 1;
    put(0, 1, halfZ, doorId); put(0, 2, halfZ, B.AIR); put(0, 3, halfZ, B.SPRUCE_LOG);
    for (const dx of [-1, 1]) { put(dx, 1, zf, B.BIRCH_LOG); put(dx, 2, zf, B.BIRCH_LOG); put(dx, 3, zf, B.LANTERN); }
    for (let dx = -1; dx <= 1; dx++) { put(dx, 4, zf, B.SPRUCE_LOG); put(dx, 0, halfZ, B.SMOOTH_STONE); }
    if (steps) for (let dx = -2; dx <= 2; dx++) put(dx, 0, halfZ + 2, B.STONE_STAIRS_N);
    if (hasBack) {
      const bz = -halfZ;
      put(0, 1, bz, doorId); put(0, 2, bz, B.AIR); put(0, 3, bz, B.SPRUCE_LOG);
      for (let dx = -1; dx <= 1; dx++) {
        put(dx, 0, bz - 1, B.SMOOTH_STONE);
        for (let wy = 1; wy <= 3; wy++) put(dx, wy, bz - 1, B.AIR);
      }
    }
  }
  // SÀN TẦNG 2 + lỗ thông tầng 4×3
  function vSlab(put, halfX, halfZ, fe) {
    for (let dz = -halfZ; dz <= halfZ + fe; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || dz === -halfZ || dz === halfZ + fe);
      const hole = (dz >= -halfZ + 1 && dz <= -halfZ + 3 && dx >= -halfX + 3 && dx <= -halfX + 6);
      put(dx, 5, dz, hole ? B.AIR : (edge ? B.SPRUCE_LOG : B.PLANKS));
    }
  }
  // NỘI THẤT TẦNG 1 (mới): bếp dọc tường sau PHẢI, bàn ăn giữa phòng, kệ + rương tường trái (xa cầu thang)
  function vFurn1(put, halfX, halfZ, big, kitchenLeft) {
    const rX = halfX - 1, fZ = halfZ - 1;
    const kX = rX, inw = -1;                  // bếp luôn bên PHẢI, quầy quay vào trong
    const sX = -rX;                           // tường đối diện (trái)
    put(kX, 1, -fZ, B.FURNACE); put(kX, 1, -fZ + 1, B.SMOKER);
    put(kX + inw, 1, -fZ, B.PLANKS); put(kX + inw, 2, -fZ, B.OAK_TRAPDOOR); put(kX + inw, 3, -fZ, B.FERN);
    for (let i = 0; i < 3; i++) for (let rz = -fZ; rz <= -fZ + 1; rz++) {
      const rx = kX + i * inw;
      put(rx, 0, rz, ((rx + rz) & 1) ? B.SMOOTH_STONE : B.DEEPSLATE);
    }
    // bàn ăn 1 cái giữa phòng bên trái (KHÔNG sát cửa, KHÔNG gần cầu thang)
    put(-2, 1, 0, B.OAK_FENCE); put(-2, 2, 0, B.OAK_TRAPDOOR);
    // kệ sách + rương dọc tường trái, cách cầu thang 2 block
    put(sX, 1, 0, B.BOOKSHELF); put(sX, 2, 0, B.BOOKSHELF);
    put(sX, 1, -1, B.CHEST);
    // bàn chế tạo góc trước-trái
    put(sX, 1, fZ, B.CRAFT_TABLE); put(sX, 1, fZ - 1, B.CHEST);
    // thảm rêu giữa phòng + đèn trần
    for (let rx = -1; rx <= 1; rx++) for (let rz = 1; rz <= 2; rz++) put(rx, 0, rz, B.MOSS_BLOCK);
    put(0, 4, 0, B.LANTERN); put(-2, 4, 1, B.LANTERN);
    if (big) put(2, 4, -1, B.LANTERN);
  }
  // NỘI THẤT TẦNG 2 (mới): giường phải, tủ trái, bàn học, thảm, đèn treo trần (không xà)
  function vFurn2(put, halfX, halfZ, big, ceilY) {
    const rX = halfX - 1, fZ = halfZ - 1;
    put(rX - 1, 6, fZ, B.BED); put(rX, 6, fZ, B.BED_FOOT);
    put(rX, 6, fZ - 1, B.CHEST); put(rX, 7, fZ - 1, B.LANTERN);
    put(-rX, 6, fZ, B.SPRUCE_TRAPDOOR); put(-rX, 7, fZ, B.SPRUCE_TRAPDOOR);
    put(-rX, 6, fZ - 1, B.BOOKSHELF);
    put(1, 6, -fZ + 1, B.OAK_FENCE); put(1, 7, -fZ + 1, B.OAK_TRAPDOOR);
    for (let rx = -1; rx <= 1; rx++) for (let rz = 0; rz <= 1; rz++) put(rx, 5, rz, B.WHITE_WOOL);
    const by = ceilY - 1;
    put(-2, by, 1, B.LANTERN); put(2, by, -1, B.LANTERN);
    if (big) put(-2, by, -1, B.LANTERN);
  }
  // CẢNH QUAN: đường vàng + đèn dọc đường
  function vPath(hx, hz, fz, halfZ, baseY, len) {
    for (let d = 1; d <= (len || 8); d++) for (let dx = -1; dx <= 1; dx++) {
      const wx = hx + dx, wz = hz + (halfZ + d) * fz, gy = colGroundY(wx, wz);
      setBlockWorld(wx, Math.min(gy, baseY), wz, dx === 0 ? B.SAND : B.SMOOTH_STONE, true);
      for (let wy = Math.min(gy, baseY) + 1; wy <= baseY + 3; wy++) setBlockWorld(wx, wy, wz, B.AIR, true);
    }
    for (const d of [4, 7]) for (const sx of [-2, 2]) {
      const wx = hx + sx, wz = hz + (halfZ + d) * fz, gy = colGroundY(wx, wz);
      setBlockWorld(wx, gy + 1, wz, B.OAK_FENCE, true);
      setBlockWorld(wx, gy + 2, wz, B.LANTERN, true);
    }
  }
  // CẢNH QUAN: ruộng lúa 2 bên
  function vWheat(hx, hz, fz, halfX, halfZ, baseY, side) {
    for (let dz = -2; dz <= 3; dz++) for (let dx = 3; dx <= 7; dx++) {
      const wx = hx + side * (halfX + dx), wz = hz + (halfZ + dz - 1) * fz, gy = colGroundY(wx, wz);
      if (gy <= baseY + 2 && gy >= baseY - 2 && getBlockWorld(wx, gy + 1, wz) === B.AIR) setBlockWorld(wx, gy + 1, wz, B.WHEAT, true);
    }
  }
  // CẢNH QUAN: mê cung hàng rào lá trước nhà + đường đá cuội
  function vHedge(hx, hz, fz, halfZ, baseY) {
    for (let row = 0; row < 3; row++) {
      const dz = 8 + row * 2;
      for (let dx = -8; dx <= 8; dx++) {
        if (row > 0 && (dx + 8) % 7 < 2) continue;
        const wx = hx + dx, wz = hz + (halfZ + dz - 5) * fz, gy = colGroundY(wx, wz);
        if (gy < baseY - 2 || gy > baseY + 3) continue;
        setBlockWorld(wx, gy + 1, wz, B.OAK_LEAVES, true);
        setBlockWorld(wx, gy + 2, wz, B.OAK_LEAVES, true);
      }
    }
    for (let dz = halfZ + 5; dz <= halfZ + 12; dz++) {
      const wx = hx, wz = hz + dz * fz, gy = colGroundY(wx, wz);
      setBlockWorld(wx, Math.min(gy, baseY), wz, B.SMOOTH_STONE, true);
      setBlockWorld(wx, Math.min(gy, baseY) + 1, wz, B.AIR, true);
    }
  }
  // CẢNH QUAN: hoa + bụi lá góc nhà
  function vFlowers(hx, hz, fz, halfX, halfZ, baseY) {
    const FLW = [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_LAVENDER];
    // Luống hoa THƯA: 2 bông mỗi bên, cách nhau 2 block; chỉ trồng trên cỏ/đất trống, KHÔNG chồng lên block khác
    const spots = [[-2, 1], [-2, 3], [2, 1], [2, 3]];
    const OK_GROUND = [B.GRASS, B.DIRT, B.SNOW, B.SAND, B.AUTUMN_PODZOL, B.MOSS_BLOCK, B.FARMLAND];
    let i = 0;
    for (const [fx, d] of spots) {
      const wx = hx + fx, wz = hz + (halfZ + d) * fz;
      if (!OK_GROUND.includes(getBlockWorld(wx, baseY, wz))) continue;
      if (getBlockWorld(wx, baseY + 1, wz) !== B.AIR) continue;
      setBlockWorld(wx, baseY + 1, wz, FLW[i++ % FLW.length], true);
    }
    for (const [cx2, cz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const wx2 = hx + cx2 * (halfX + 1), wz2 = hz + cz2 * (halfZ + 1) * fz, gy2 = colGroundY(wx2, wz2);
      if (gy2 >= baseY && gy2 <= baseY + 3 && getBlockWorld(wx2, gy2 + 1, wz2) === B.AIR) setBlockWorld(wx2, gy2 + 1, wz2, B.OAK_LEAVES, true);
    }
  }
  // Dây leo rủ + chùm lá/rêu trên mái
  function vVines(put, halfX, zE, eaveY, hx, hz, fz, leaf, seed, frontDz) {
    for (let s = 1; s < zE; s++) for (let dx = -halfX + 1; dx <= halfX - 1; dx += 2) {
      const zz = zE - s;
      if (hash2i(hx + dx, hz + zz * fz, seed) > 0.9) { put(dx, eaveY + s + 1, zz, leaf); put(dx, eaveY + s + 1, -zz, leaf); }
    }
    for (const vx of [-halfX + 2, 0, halfX - 2]) {
      if (hash2i(hx + vx, hz + frontDz * fz, seed + 7) > 0.55) {
        put(vx, eaveY - 1, frontDz, B.VINE); put(vx, eaveY - 2, frontDz, B.VINE);
      }
    }
  }

  // ============ HOUSE 1 (large): RED-BROWN ROOF COTTAGE — ảnh images - Copy / images.jpg ============
  function buildRedRoofCottage(hx, hz, fz) {
    const halfX = 7, halfZ = 5, zE = 7, eaveY = 10;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, CREAM = B.MARBLE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? vStone(hx + dx, hz + dz * fz) : B.PLANKS);
    }
    // Tầng 1: tường kem + khung gỗ đậm + cửa kính lớn khung gỗ
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      const onX = Math.abs(dx) === halfX, onZ = Math.abs(dz) === halfZ;
      const isFront = onZ && dz === halfZ;
      if (isFront && dx === 0) continue;
      const isPost = (onX && onZ) || (isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 4 || Math.abs(dx) === 7)) || (onX && dz === 0) || wy === 4;
      const bigWin = (wy === 2 || wy === 3) && ((isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 3 || Math.abs(dx) === 5 || Math.abs(dx) === 6)) || (onX && Math.abs(dz) === 2));
      if (bigWin) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isPost ? FR : CREAM);
    }
    vSlab(put, halfX, halfZ, 1);
    // Tầng 2: kem + khung, cửa sổ + hộp hoa
    for (let wy = 6; wy <= 9; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 4 || Math.abs(dx) === 7)) || (onX && dz === 0);
      const win = (wy === 7 || wy === 8) && ((isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5)) || (onX && Math.abs(dz) === 3));
      if (win) {
        put(dx, wy, dz, B.GLASS);
        if (isFront) put(dx, 6, halfZ + 1, B.OAK_LEAVES);
        continue;
      }
      put(dx, wy, dz, isPost || wy === 6 || wy === 9 ? FR : CREAM);
    }
    // Mái ngói đỏ nâu + viền gỗ đậm + dormer giữa
    vRoof(put, halfX, zE, eaveY, B.TERRACOTTA, FR, B.TERRACOTTA_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : CREAM));
    vDormer(put, 0, 2, halfZ + 1, 6, eaveY, CREAM, FR, B.TERRACOTTA_STAIRS_N, FR);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);
    // Ống khói gạch + khói + dây leo phủ mái
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE; wy++) put(chX, wy, chZ, B.TERRACOTTA);
    put(chX, eaveY + zE + 1, chZ, B.CAMPFIRE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9301, halfZ + 1);
    vDoors(put, halfZ, B.OAK_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, true);
    vFurn2(put, halfX, halfZ, true, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 9);
    vWheat(hx, hz, fz, halfX, halfZ, baseY, -1);
    vWheat(hx, hz, fz, halfX, halfZ, baseY, 1);
    return baseY;
  }

  // ============ HOUSE 2 (large): TUDOR MANOR + MÊ CUNG HÀNG RÀO — ảnh images (4)/(59) ============
  function buildTudorManorNew(hx, hz, fz) {
    const halfX = 9, halfZ = 6, zE = 8, eaveY = 11;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, CREAM = B.END_STONE, STONE = B.STONE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? STONE : B.PLANKS);
    }
    // Tầng trệt đá gạch + hiên vòm 2 block sâu
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (isFront && dx === 0) continue;
      if (wy === 3 && ((isFront && (Math.abs(dx) === 3 || Math.abs(dx) === 6)) || (onX && Math.abs(dz) === 4))) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, B.STONE);
    }
    // sàn hiên đá + cột + dầm
    for (let dz = halfZ + 1; dz <= halfZ + 2; dz++) for (let dx = -halfX + 1; dx <= halfX - 1; dx++) {
      const wx = hx + dx, wz = hz + dz * fz, gy = colGroundY(wx, wz);
      for (let y = Math.min(gy, baseY); y <= baseY; y++) setBlockWorld(wx, y, wz, B.SMOOTH_STONE, true);
      for (let wy = 1; wy <= 5; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      setBlockWorld(wx, baseY, wz, B.SMOOTH_STONE, true);
    }
    for (const px of [-8, -4, 4, 8]) for (let wy = 1; wy <= 4; wy++) put(px, wy, halfZ + 2, STONE);
    vSlab(put, halfX, halfZ, 2);
    // Tầng 2 khung gỗ + vôi kem
    for (let wy = 6; wy <= 10; wy++) for (let dz = -halfZ; dz <= halfZ + 1; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ + 1;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 4 || Math.abs(dx) === 7)) || (onX && dz === 0);
      const win = (wy === 7 || wy === 8) && ((isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5 || Math.abs(dx) === 8)) || (onX && Math.abs(dz) === 3));
      if (win) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isPost || wy === 6 || wy === 10 ? FR : CREAM);
    }
    // mái phiến xám nhiều tầng + 2 dormer
    vRoof(put, halfX, zE, eaveY, B.DEEPSLATE, B.DEEPSLATE, B.DEEPSLATE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : CREAM));
    vDormer(put, -4, 2, halfZ + 2, 6, eaveY, CREAM, FR, B.DEEPSLATE_STAIRS_N, B.DEEPSLATE);
    vDormer(put, 4, 2, halfZ + 2, 6, eaveY, CREAM, FR, B.DEEPSLATE_STAIRS_N, B.DEEPSLATE);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);
    // THÁP ĐÁ GÓC phải-trước + chóp
    const tX0 = halfX - 2, tZ0 = halfZ - 2, tTop = eaveY + 4;
    for (let ty = 1; ty <= tTop; ty++) for (let tdz = tZ0; tdz <= tZ0 + 2; tdz++) for (let tdx = tX0; tdx <= tX0 + 2; tdx++) {
      if (!(tdx === tX0 || tdx === tX0 + 2 || tdz === tZ0 || tdz === tZ0 + 2)) continue;
      const isGlass = (ty === 8 || ty === 9) && (tdx === tX0 + 1 && tdz === tZ0 + 2);
      put(tdx, ty, tdz, isGlass ? B.GLASS : (ty <= 4 ? STONE : FR));
    }
    for (let tdx = tX0; tdx <= tX0 + 2; tdx++) for (let tdz = tZ0; tdz <= tZ0 + 2; tdz++) put(tdx, tTop + 1, tdz, B.DEEPSLATE);
    put(tX0 + 1, tTop + 2, tZ0 + 1, B.DEEPSLATE);
    put(tX0 + 1, tTop + 3, tZ0 + 1, B.LANTERN);
    // ống khói gạch sau-trái
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE; wy++) put(chX, wy, chZ, B.TERRACOTTA);
    put(chX, eaveY + zE + 1, chZ, B.CAMPFIRE);
    vDoors(put, halfZ, B.OAK_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, false);
    vFurn2(put, halfX, halfZ, true, eaveY - 1);
    // cảnh quan: mê cung hàng rào + đường đá + hoa
    vHedge(hx, hz, fz, halfZ, baseY);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    for (const px of [-7, 7]) {
      const wz2 = hz + (halfZ + 4) * fz, gy2 = colGroundY(hx + px, wz2);
      setBlockWorld(hx + px, gy2 + 1, wz2, B.OAK_FENCE, true);
      setBlockWorld(hx + px, gy2 + 2, wz2, B.LANTERN, true);
    }
    return baseY;
  }

  // ============ HOUSE 3 (small): SMALL BRICK COTTAGE — ảnh images (5) ============
  function buildBrickCottage(hx, hz, fz) {
    const halfX = 5, halfZ = 4, zE = 5, eaveY = 9;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const BRICK = B.TERRACOTTA, CREAM = B.MARBLE_BRICK, FR = B.SPRUCE_LOG;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? B.STONE : B.PLANKS);
    }
    // nửa trái gạch đỏ, nửa phải tường kem
    for (let wy = 1; wy <= 8; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (!onX && !isFront && dz !== -halfZ) continue;
      if (isFront && dx === 0) continue;
      const isLeft = dx < 0;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && Math.abs(dx) === 1) || (onX && dz === 0) || wy === 4 || wy === 8;
      const win = (wy === 3 && !isLeft && isFront && Math.abs(dx) >= 2 && Math.abs(dx) <= 3) || (wy === 3 && onX && Math.abs(dz) === 1);
      if (win) { put(dx, wy, dz, B.GLASS); continue; }
      if (isPost) { put(dx, wy, dz, FR); continue; }
      put(dx, wy, dz, isLeft ? BRICK : CREAM);
    }
    vSlab(put, halfX, halfZ, 1);
    vRoof(put, halfX, zE, eaveY, B.STONE_BRICK, B.DEEPSLATE, B.STONE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : CREAM));
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);
    // ống khói gạch đỏ cao bên trái + khói
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE + 2; wy++) put(chX, wy, chZ, BRICK);
    put(chX, eaveY + zE + 3, chZ, B.CAMPFIRE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9303, halfZ + 1);
    vDoors(put, halfZ, B.OAK_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, false);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, false, true);
    vFurn2(put, halfX, halfZ, false, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 6);
    return baseY;
  }

  // ============ HOUSE 4 (medium): TIMBER CABIN + ỐNG KHÓI ĐÁ — ảnh images (6) ============
  function buildTimberCabin(hx, hz, fz) {
    const halfX = 6, halfZ = 5, zE = 6, eaveY = 9;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, WALL = B.PLANKS;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? B.STONE : B.PLANKS);
    }
    for (let wy = 1; wy <= 8; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (!onX && !isFront && dz !== -halfZ) continue;
      if (isFront && dx === 0) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 5)) || (onX && dz === 0) || wy === 1 || wy === 4 || wy === 8;
      const win = (wy === 3 || wy === 7) && ((isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 4)) || (onX && Math.abs(dz) === 3));
      if (win) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isPost ? FR : WALL);
    }
    vSlab(put, halfX, halfZ, 1);
    // mái xám đậm dốc
    vRoof(put, halfX, zE, eaveY, B.DEEPSLATE, FR, B.DEEPSLATE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : WALL));
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, WALL);
    // ỐNG KHÓI ĐÁ 2×2 + nắp 4×4 vuông + lửa giữa (KHÔNG còn hình thập giá, hoa dời xuống chân khói)
    const chX = -halfX + 1, chZ = 2, chTop = eaveY + zE + 3;
    for (let wy = 1; wy <= chTop; wy++) {
      for (const ddx of [0, 1]) for (const ddz of [0, 1]) put(chX + ddx, wy, chZ + ddz, B.SMOOTH_STONE);
    }
    for (let ddx = -1; ddx <= 2; ddx++) for (let ddz = -1; ddz <= 2; ddz++) put(chX + ddx, chTop + 1, chZ + ddz, B.STONE_BRICK);
    put(chX, chTop + 2, chZ, B.CAMPFIRE);
    for (const [fx2, fz2] of [[-1, 2], [2, 2], [-1, -1], [2, -1]]) {
      const wz2 = hz + (chZ + fz2) * fz, gy2 = colGroundY(hx + chX + fx2, wz2);
      if (gy2 >= baseY - 2 && gy2 <= baseY + 2 && getBlockWorld(hx + chX + fx2, gy2 + 1, wz2) === B.AIR) setBlockWorld(hx + chX + fx2, gy2 + 1, wz2, B.FLOWER_RED, true);
    }
    // hiên phải + bậc đá + lan can
    for (let dz = halfZ + 1; dz <= halfZ + 2; dz++) for (let dx = 3; dx <= 6; dx++) {
      const wx = hx + dx, wz = hz + dz * fz, gy = colGroundY(wx, wz);
      for (let y = Math.min(gy, baseY); y <= baseY; y++) setBlockWorld(wx, y, wz, B.SMOOTH_STONE, true);
      for (let wy = 1; wy <= 4; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
    }
    for (const px of [3, 6]) { for (let wy = 1; wy <= 3; wy++) put(px, wy, halfZ + 2, FR); put(px, 3, halfZ + 2, B.LANTERN); }
    for (let dx = 3; dx <= 6; dx++) put(dx, 4, halfZ + 2, B.PLANKS);
    for (const px of [3, 6]) put(px, 1, halfZ + 2, B.OAK_FENCE);
    // cửa gỗ đậm + đèn treo
    vDoors(put, halfZ, B.SPRUCE_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, false);
    // đống gỗ + thùng bên hông
    put(5, 1, halfZ + 3, B.OAK_LOG); put(5, 2, halfZ + 3, B.OAK_LOG); put(4, 1, halfZ + 3, B.OAK_LOG);
    put(6, 1, halfZ + 3, B.CHEST);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, false, true);
    vFurn2(put, halfX, halfZ, false, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 7);
    return baseY;
  }

  // ============ HOUSE 5 (medium): LAKESIDE COTTAGE — ảnh images (7) ============
  function buildLakesideCottage(hx, hz, fz) {
    const halfX = 6, halfZ = 5, zE = 7, eaveY = 10;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, CREAM = B.MARBLE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? vStone(hx + dx, hz + dz * fz, 9105) : B.PLANKS);
    }
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (isFront && dx === 0) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 5)) || (onX && dz === 0);
      const win = (wy === 3) && ((isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 4)) || (onX && Math.abs(dz) === 2));
      if (win) {
        put(dx, wy, dz, B.GLASS);
        if (isFront) put(dx, 2, halfZ + 1, B.OAK_LEAVES);
        continue;
      }
      put(dx, wy, dz, isPost || wy === 4 ? FR : CREAM);
    }
    vSlab(put, halfX, halfZ, 1);
    for (let wy = 6; wy <= 9; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 5)) || (onX && dz === 0);
      const win = (wy === 7) && ((isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 4)) || (onX && Math.abs(dz) === 2));
      if (win) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isPost || wy === 6 || wy === 9 ? FR : CREAM);
    }
    // mái ngói cam + rêu/lá phủ
    vRoof(put, halfX, zE, eaveY, B.TERRACOTTA, FR, B.TERRACOTTA_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : CREAM));
    vDormer(put, 0, 2, halfZ + 1, 6, eaveY, CREAM, FR, B.TERRACOTTA_STAIRS_N, FR);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);
    // ban công tầng 2: rào + hoa tím/xanh
    for (const bx of [-5, -4, 4, 5]) put(bx, 6, halfZ + 1, B.OAK_FENCE);
    for (const bx of [-2, 2]) put(bx, 6, halfZ + 1, B.FLOWER_LAVENDER);
    // ống khói đá sau-TRÁI (tránh bếp bên phải)
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE; wy++) put(chX, wy, chZ, B.SMOOTH_STONE);
    put(chX, eaveY + zE + 1, chZ, B.CAMPFIRE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9305, halfZ + 1);
    vDoors(put, halfZ, B.OAK_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, false, false);
    vFurn2(put, halfX, halfZ, false, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 8);
    vWheat(hx, hz, fz, halfX, halfZ, baseY, 1);
    return baseY;
  }

  // --- Handcrafted Landmark Builders for New Reference Biomes (Nordic Smithy Cottage & Golden Wheat Windmill) ---
  function buildNordicSmithyCottage(hx, hz) {
    const rcx = hx >> 4, rcz = hz >> 4;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (!chunks.has(chunkKey(rcx + dx, rcz + dz))) generateChunk(rcx + dx, rcz + dz);
    }
    const baseY = Math.max(WATER_LEVEL + 1, Math.min(20, colGroundY(hx, hz + 6)));
    const put = (dx, y, dz, id) => setBlockWorld(hx + dx, baseY + y, hz + dz, id, true);
    // Clear & ground pad (extra front yard clearance so stray pines never block the forge porch)
    for (let dz = -8; dz <= 20; dz++) for (let dx = -9; dx <= 9; dx++) {
      const gy = colGroundY(hx + dx, hz + dz);
      for (let wy = 1; wy <= 22; wy++) setBlockWorld(hx + dx, Math.min(gy, baseY) + wy, hz + dz, B.AIR, true);
      if (dx >= -6 && dx <= 7 && dz >= -5 && dz <= 6) {
        for (let y = gy + 1; y < baseY; y++) setBlockWorld(hx + dx, y, hz + dz, B.STONE_BRICK, true);
        put(dx, 0, dz, (dx >= -1 && dx <= 6 && dz >= -4 && dz <= 4) ? B.PLANKS : (hash2i(hx + dx, hz + dz, worldSeed + 961) > 0.35 ? B.GRASS : B.SAND));
      }
    }
    // 1) Main 2-Story Timber-Framed Hall (dx: -1..6, dz: -4..4)
    for (let wy = 1; wy <= 8; wy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -1; dx <= 6; dx++) {
      const onX = (dx === -1 || dx === 6), onZ = (dz === -4 || dz === 4);
      if (!onX && !onZ) {
        if (wy === 4) put(dx, wy, dz, B.PLANKS);
        continue;
      }
      const isBeam = (dx === -1 || dx === 2 || dx === 6) && (dz === -4 || dz === 0 || dz === 4);
      if (wy <= 3) {
        if (dz === 4 && dx === 4 && wy <= 2) { put(dx, wy, dz, wy === 1 ? B.SPRUCE_DOOR : B.AIR); continue; }
        if (wy === 2 && ((dz === 4 && (dx === 1 || dx === 5)) || (dx === 6 && Math.abs(dz) === 2))) { put(dx, wy, dz, B.GLASS); continue; }
        put(dx, wy, dz, isBeam ? B.SPRUCE_LOG : (wy <= 2 ? (hash2i(hx + dx, hz + dz + wy, worldSeed + 963) > 0.78 ? B.MOSS_BLOCK : B.STONE_BRICK) : B.PLANKS));
      } else if (wy === 4 || wy === 8) {
        put(dx, wy, dz, B.SPRUCE_LOG);
      } else {
        if (wy === 6 && ((dz === 4 && (dx === 1 || dx === 4)) || (dx === 6 && Math.abs(dz) === 2))) { put(dx, wy, dz, B.GLASS); continue; }
        put(dx, wy, dz, isBeam ? B.SPRUCE_LOG : B.PLANKS);
      }
    }
    // Steep Dark Slate Gable Roof (ridge along X at dz=0, peaking at wy=13) + Roof Dormer + Ridge Spikes!
    for (let s = 0; s <= 4; s++) {
      const y = 9 + s, z = 4 - s;
      for (let dx = -2; dx <= 7; dx++) {
        const edge = (dx === -2 || dx === 7);
        if (z === 0) {
          put(dx, y, 0, B.DARK_SLATE_ROOF);
          if ((dx & 1) === 0 && dx >= -1 && dx <= 6) put(dx, y + 1, 0, B.SPRUCE_FENCE);
        } else {
          const rid = edge ? B.SPRUCE_LOG : B.DARK_SLATE_ROOF;
          put(dx, y, z, rid); put(dx, y, -z, rid);
        }
      }
      for (let zz = -(z - 1); zz <= z - 1; zz++) {
        const isTimber = (zz === 0 || s === 0);
        put(-1, y, zz, isTimber ? B.SPRUCE_LOG : B.PLANKS);
        put(6, y, zz, isTimber ? B.SPRUCE_LOG : B.PLANKS);
      }
    }
    put(6, 10, 0, B.GLASS);
    // Front Dormer Window on roof slope
    put(2, 10, 3, B.SPRUCE_LOG); put(3, 10, 3, B.GLASS); put(4, 10, 3, B.SPRUCE_LOG);
    put(2, 11, 3, B.DARK_SLATE_ROOF); put(3, 11, 3, B.DARK_SLATE_ROOF); put(4, 11, 3, B.DARK_SLATE_ROOF);
    // 2) Signature Tall Mossy Stone Chimney Tower w/ Upper Timber Gallery & Terracotta Spire (left: dx=-5..-3, dz=-1..1)
    for (let wy = 1; wy <= 13; wy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -5; dx <= -3; dx++) {
      if (wy >= 11 && wy <= 12) {
        const rim = (Math.abs(dx + 4) === 1 || Math.abs(dz) === 1);
        put(dx, wy, dz, wy === 11 ? B.SPRUCE_LOG : (rim ? B.PLANKS : B.LANTERN));
      } else {
        const moss = wy <= 8 && hash3i(hx + dx, wy, hz + dz, worldSeed + 967) > 0.72;
        put(dx, wy, dz, moss ? B.MOSS_BLOCK : B.STONE_BRICK);
      }
    }
    // Overhanging wooden gallery collar & steep Terracotta Spire Roof (wy=13..16)
    for (let dz = -2; dz <= 2; dz++) for (let dx = -6; dx <= -2; dx++) put(dx, 13, dz, B.TERRACOTTA);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -5; dx <= -3; dx++) put(dx, 14, dz, B.TERRACOTTA);
    put(-4, 15, 0, B.TERRACOTTA); put(-4, 16, 0, B.TERRACOTTA);
    // Secondary tall stone chimney flue beside spire
    for (let wy = 1; wy <= 17; wy++) put(-5, wy, -1, wy === 17 ? B.TERRACOTTA : B.STONE_BRICK);
    // 3) Covered Front-Left Smithy Porch (dx: -6..-2, dz: 1..5) w/ Forge, Anvil & Stairs
    for (let dz = 1; dz <= 5; dz++) for (let dx = -6; dx <= -2; dx++) {
      put(dx, 0, dz, B.STONE_BRICK);
      if (dz === 5 && (dx === -6 || dx === -2)) { put(dx, 1, dz, B.SPRUCE_LOG); put(dx, 2, dz, B.SPRUCE_LOG); put(dx, 3, dz, B.SPRUCE_LOG); }
      else if ((dz === 5 && dx === -5) || (dx === -6 && dz >= 2 && dz <= 4)) put(dx, 1, dz, B.OAK_FENCE);
      put(dx, 4, dz, dz <= 3 ? B.DARK_SLATE_ROOF : B.AIR);
      if (dz >= 3) put(dx, 3, dz, B.DARK_SLATE_ROOF);
    }
    put(-4, 0, 6, B.STONE_STAIRS_N); put(-3, 0, 6, B.STONE_STAIRS_N);
    put(-4, 1, 2, B.CAMPFIRE); put(-3, 1, 2, B.FURNACE); put(-5, 1, 3, B.ANVIL); put(-4, 3, 4, B.LANTERN);
    // Cozy interior + exterior Hay Bales & Garden Path
    put(1, 1, -2, B.BED); put(2, 1, -2, B.BED_FOOT); put(4, 1, -2, B.CHEST); put(5, 1, -2, B.CRAFT_TABLE); put(2, 3, 0, B.LANTERN);
    put(7, 1, 2, B.HAY_BALE); put(7, 1, 3, B.HAY_BALE); put(7, 2, 2, B.HAY_BALE);
    for (let pz = 5; pz <= 13; pz++) {
      const px = Math.round(Math.sin(pz * 0.35) * 1.5);
      for (let wx2 = px - 1; wx2 <= px + 1; wx2++) {
        const gy = colGroundY(hx + wx2, hz + pz);
        if (gy > WATER_LEVEL) setBlockWorld(hx + wx2, gy, hz + pz, ((wx2 + pz) & 1) ? B.SAND : B.AUTUMN_PODZOL, true);
      }
    }
    // Tall Conical Pines framing the cottage behind & beside (Image 1!)
    for (const [px, pz, ph] of [[-9, -6, 15], [9, -5, 16], [0, -9, 14], [10, 4, 13]]) {
      const gy = colGroundY(hx + px, hz + pz);
      if (gy <= WATER_LEVEL) continue;
      for (let y = 1; y <= ph; y++) setBlockWorld(hx + px, gy + y, hz + pz, B.SPRUCE_LOG, true);
      for (let step = 3; step <= ph; step++) {
        const ft = ph - step, rad = ft === 0 ? 0 : (ft <= 2 ? 1 : (step % 2 === 0 ? Math.min(3, 1 + Math.floor(ft / 4)) : 2));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.hypot(dx, dz) <= rad + 0.35 && getBlockWorld(hx + px + dx, gy + step, hz + pz + dz) === B.AIR) {
            setBlockWorld(hx + px + dx, gy + step, hz + pz + dz, B.SPRUCE_LEAVES, true);
          }
        }
      }
      setBlockWorld(hx + px, gy + ph + 1, hz + pz, B.SPRUCE_LEAVES, true);
    }
    return baseY;
  }

  function stampOverworldMegaStructures(data, cx, cz, wx0, wz0, maxLy) {
    if (currentDimension !== 'overworld' || (depthOffset || 0) !== 0) return maxLy;
    const putL = (wx, wy, wz, id) => {
      const lx = wx - wx0, lz = wz - wz0, ly = wy - MIN_Y;
      if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly <= 0 || ly >= WORLD_H) return;
      data[(ly << 8) | (lz << 4) | lx] = id;
      if (ly > maxLy) maxLy = ly;
    };
    // 1) 1000x1000 Grand Walled Royal Citadel centered at (12000, -12000)
    const CIT_X = 12000, CIT_Z = -12000, CIT_R = 500;
    if (wx0 + 15 >= CIT_X - CIT_R && wx0 <= CIT_X + CIT_R && wz0 + 15 >= CIT_Z - CIT_R && wz0 <= CIT_Z + CIT_R) {
      const baseY = 6;
      for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, wz = wz0 + lz;
        const dx = wx - CIT_X, dz = wz - CIT_Z, adx = Math.abs(dx), adz = Math.abs(dz);
        if (adx > CIT_R || adz > CIT_R) continue;
        colHeights[(lz << 4) | lx] = baseY;
        const onOuterWall = (adx >= CIT_R - 2 || adz >= CIT_R - 2);
        const isGate = (adx <= 4 && adz >= CIT_R - 2) || (adz <= 4 && adx >= CIT_R - 2);
        const onAve = (adx <= 4 || adz <= 4 || (adx % 64) <= 2 || (adz % 64) <= 2);
        for (let wy = baseY - 2; wy <= baseY + 14; wy++) {
          putL(wx, wy, wz, wy <= baseY ? (onAve ? B.MARBLE_BRICK : B.STONE_BRICK) : B.AIR);
        }
        if (onOuterWall && !isGate) {
          for (let wy = 1; wy <= 10; wy++) putL(wx, baseY + wy, wz, (wy === 10 && ((wx + wz) & 1)) ? B.MARBLE_BRICK : B.STONE_BRICK);
        } else if (isGate && (adx === 4 || adz === 4)) {
          for (let wy = 1; wy <= 12; wy++) putL(wx, baseY + wy, wz, wy === 12 ? B.COPPER_ROOF : B.MARBLE_BRICK);
        } else if (!onAve) {
          // District Watchtowers & Houses inside 64x64 city blocks
          const bx = ((dx % 64) + 64) % 64, bz = ((dz % 64) + 64) % 64;
          const bSeed = hash2i(Math.floor(dx / 64), Math.floor(dz / 64), worldSeed + 9111);
          if (adx <= 24 && adz <= 24) {
            const isKeepWall = (adx === 24 || adz === 24 || adx === 10 || adz === 10);
            if (isKeepWall && !((dx === 0 || dz === 0) && (adx === 24 || adz === 24))) {
              for (let wy = 1; wy <= (adx <= 10 && adz <= 10 ? 18 : 11); wy++) putL(wx, baseY + wy, wz, wy % 5 === 0 ? B.COPPER_ROOF : B.MARBLE_BRICK);
            }
          } else if (bx >= 14 && bx <= 26 && bz >= 14 && bz <= 26 && bSeed > 0.35) {
            const wall = (bx === 14 || bx === 26 || bz === 14 || bz === 26), hH = bSeed > 0.72 ? 12 : 6;
            for (let wy = 1; wy <= hH; wy++) {
              if (wy === hH) putL(wx, baseY + wy, wz, B.COPPER_ROOF);
              else if (wall && !(bx === 20 && bz === 26 && wy <= 2)) putL(wx, baseY + wy, wz, (wy === 3 && (bx === 20 || bz === 20)) ? B.GLASS : (bSeed > 0.65 ? B.MARBLE_BRICK : B.PLANKS));
            }
          }
        }
      }
      if ((Math.floor(wx0 / 64) + Math.floor(wz0 / 64)) % 2 === 0 && hash2i(cx, cz, worldSeed + 9133) > 0.65) {
        putL(wx0 + 8, baseY + 1, wz0 + 8, B.GOLD_CHEST);
      }
      return maxLy;
    }

    // 2) Regional Castles, Watchtowers & Colossal Ruin Complexes (512x512 regions)
    const RSEC = 512;
    const minRx = Math.floor((wx0 - 24) / RSEC), maxRx = Math.floor((wx0 + 39) / RSEC);
    const minRz = Math.floor((wz0 - 24) / RSEC), maxRz = Math.floor((wz0 + 39) / RSEC);
    for (let rz = minRz; rz <= maxRz; rz++) for (let rx = minRx; rx <= maxRx; rx++) {
      const mcx = rx * RSEC + 180 + Math.floor(hash2i(rx, rz, worldSeed + 7111) * 160);
      const mcz = rz * RSEC + 180 + Math.floor(hash2i(rx + 9, rz - 7, worldSeed + 7117) * 160);
      if (Math.hypot(mcx, mcz) < 120) continue;
      if (mcx + 22 < wx0 || mcx - 22 >= wx0 + 16 || mcz + 22 < wz0 || mcz - 22 >= wz0 + 16) continue;
      const b = getBiomeAt(mcx, mcz);
      if (b === BIOMES.DEEP_OCEAN || b === BIOMES.ABYSS_TRENCH || b === BIOMES.ABANDONED_CITY) continue;
      const kind = Math.floor(hash2i(rx - 3, rz + 5, worldSeed + 7129) * 3); // 0=Castle, 1=Colossal Ruin, 2=Watchtower Keep
      const baseY = Math.max(WATER_LEVEL + 1, Math.min(34, getTerrainHeight(mcx, mcz, b)));
      const rad = kind === 1 ? 18 : (kind === 0 ? 15 : 8);
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const wx = mcx + dx, wz = mcz + dz;
        if (wx < wx0 || wx >= wx0 + 16 || wz < wz0 || wz >= wz0 + 16) continue;
        const adx = Math.abs(dx), adz = Math.abs(dz);
        putL(wx, baseY, wz, kind === 1 && hash2i(wx, wz, worldSeed + 7141) > 0.72 ? B.MOSS_BLOCK : B.STONE_BRICK);
        for (let wy = 1; wy <= 20; wy++) putL(wx, baseY + wy, wz, B.AIR);
        const onPerim = (adx === rad || adz === rad);
        const onInner = (kind <= 1 && (adx === 6 || adz === 6) && adx <= 6 && adz <= 6);
        if (onPerim && !(dz === rad && adx <= 1)) {
          const wH = kind === 1 ? (3 + ((adx + adz) % 6)) : (kind === 2 ? 15 : 8);
          for (let wy = 1; wy <= wH; wy++) putL(wx, baseY + wy, wz, (wy === wH && kind === 2) ? B.COPPER_ROOF : B.STONE_BRICK);
          if (adx === rad && adz === rad) {
            for (let ty = wH + 1; ty <= wH + 5; ty++) putL(wx, baseY + ty, wz, ty === wH + 5 ? B.LANTERN : B.MARBLE_BRICK);
          }
        } else if (onInner && !(dz === 6 && dx === 0)) {
          const iH = kind === 1 ? (5 + ((wx ^ wz) & 3)) : 12;
          for (let wy = 1; wy <= iH; wy++) putL(wx, baseY + wy, wz, wy === iH && kind === 0 ? B.COPPER_ROOF : B.MARBLE_BRICK);
        }
      }
      putL(mcx, baseY + 1, mcz - 2, kind === 0 ? B.GOLD_CHEST : B.IRON_CHEST);
      putL(mcx, baseY + 1, mcz, B.ENCHANT_TABLE);
      putL(mcx + 2, baseY + 1, mcz, B.LANTERN);
    }
    return maxLy;
  }

  function stampPlainsVillageInChunk(data, cx, cz, wx0, wz0, maxLy) {
    const VSEC = 144;
    const minVx = Math.floor((wx0 - 20) / VSEC), maxVx = Math.floor((wx0 + 35) / VSEC);
    const minVz = Math.floor((wz0 - 20) / VSEC), maxVz = Math.floor((wz0 + 35) / VSEC);
    const putLocal = (wx, wy, wz, id) => {
      const lx = wx - wx0, lz = wz - wz0, ly = wy - MIN_Y;
      if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly <= 0 || ly >= WORLD_H) return;
      data[(ly << 8) | (lz << 4) | lx] = id;
      if (ly > maxLy) maxLy = ly;
    };
    for (let vz = minVz; vz <= maxVz; vz++) {
      for (let vx = minVx; vx <= maxVx; vx++) {
        const vcx = vx * VSEC + 48 + Math.floor(hash2i(vx, vz, worldSeed + 2553) * 48);
        const vcz = vz * VSEC + 48 + Math.floor(hash2i(vx - 7, vz + 11, worldSeed + 2557) * 48);
        if (Math.hypot(vcx, vcz) < 42) continue;
        if (hash2i(vx, vz, worldSeed + 2551) <= 0.64) continue;
        if (vcx + 22 < wx0 || vcx - 22 >= wx0 + 16 || vcz + 22 < wz0 || vcz - 22 >= wz0 + 16) continue;
        const vBio = getBiomeAt(vcx, vcz);
        if (vBio !== BIOMES.PLAINS && vBio !== BIOMES.GREEN_PLAINS) continue;
        const baseY = Math.max(WATER_LEVEL + 2, Math.min(18, getTerrainHeight(vcx, vcz, vBio)));
        // Central stone well + gravel cross-roads
        for (let r = -12; r <= 12; r++) {
          putLocal(vcx + r, baseY, vcz, (Math.abs(r) & 1) ? B.GRAVEL : B.DIRT);
          putLocal(vcx + r, baseY, vcz + 1, B.DIRT);
          putLocal(vcx, baseY, vcz + r, (Math.abs(r) & 1) ? B.GRAVEL : B.DIRT);
          putLocal(vcx + 1, baseY, vcz + r, B.DIRT);
        }
        for (let dx = -1; dx <= 2; dx++) for (let dz = -1; dz <= 2; dz++) {
          const edge = (dx === -1 || dx === 2 || dz === -1 || dz === 2);
          putLocal(vcx + dx, baseY, vcz + dz, edge ? B.STONE_BRICK : B.WATER);
          if (edge) {
            putLocal(vcx + dx, baseY + 1, vcz + dz, B.STONE_BRICK);
            if ((dx === -1 || dx === 2) && (dz === -1 || dz === 2)) {
              putLocal(vcx + dx, baseY + 2, vcz + dz, B.OAK_FENCE);
              putLocal(vcx + dx, baseY + 3, vcz + dz, B.OAK_FENCE);
            }
            putLocal(vcx + dx, baseY + 4, vcz + dz, B.PLANKS);
          }
        }
        putLocal(vcx, baseY + 4, vcz, B.PLANKS); putLocal(vcx + 1, baseY + 4, vcz, B.PLANKS);
        putLocal(vcx, baseY + 4, vcz + 1, B.PLANKS); putLocal(vcx + 1, baseY + 4, vcz + 1, B.PLANKS);
        putLocal(vcx + 3, baseY + 1, vcz + 3, B.OAK_FENCE); putLocal(vcx + 3, baseY + 2, vcz + 3, B.TORCH_BLOCK);
        // 3 compact plains cottages + community chest
        const huts = [[vcx - 9, vcz - 8, 1], [vcx + 4, vcz - 8, 1], [vcx - 9, vcz + 4, -1]];
        for (let hi = 0; hi < huts.length; hi++) {
          const [hx, hz, doorDir] = huts[hi];
          const hy = Math.max(WATER_LEVEL + 2, Math.min(18, getTerrainHeight(hx + 3, hz + 3, vBio)));
          for (let dz = 0; dz <= 5; dz++) for (let dx = 0; dx <= 5; dx++) {
            for (let fy = hy - 2; fy < hy; fy++) putLocal(hx + dx, fy, hz + dz, B.STONE_BRICK);
            putLocal(hx + dx, hy, hz + dz, B.PLANKS);
            for (let ay = 1; ay <= 5; ay++) putLocal(hx + dx, hy + ay, hz + dz, B.AIR);
            const isC = (dx === 0 || dx === 5) && (dz === 0 || dz === 5);
            const isW = (dx === 0 || dx === 5 || dz === 0 || dz === 5);
            if (isW) {
              for (let wy = 1; wy <= 3; wy++) {
                if (isC) putLocal(hx + dx, hy + wy, hz + dz, B.OAK_LOG);
                else if (dx === 2 && ((doorDir === 1 && dz === 5) || (doorDir === -1 && dz === 0)) && wy <= 2) {
                  putLocal(hx + dx, hy + wy, hz + dz, wy === 1 ? B.OAK_DOOR : B.AIR);
                } else if (wy === 2 && (dx === 2 || dz === 2)) {
                  putLocal(hx + dx, hy + wy, hz + dz, B.GLASS);
                } else putLocal(hx + dx, hy + wy, hz + dz, wy === 1 ? B.STONE_BRICK : B.PLANKS);
              }
            }
            putLocal(hx + dx, hy + 4, hz + dz, isW ? B.SPRUCE_LOG : B.PLANKS);
            if (dx >= 1 && dx <= 4 && dz >= 1 && dz <= 4) putLocal(hx + dx, hy + 5, hz + dz, B.PLANKS);
          }
          putLocal(hx + 1, hy + 1, hz + 1, B.BED); putLocal(hx + 2, hy + 1, hz + 1, B.BED_FOOT);
          if (hi === 0) putLocal(hx + 4, hy + 1, hz + 1, B.CHEST);
          putLocal(hx + 4, hy + 1, hz + 4, B.CRAFT_TABLE);
          putLocal(hx + 2, hy + 3, hz + 2, B.TORCH_BLOCK);
        }
      }
    }
    return maxLy;
  }

  function stampWheatPlainWindmills(data, wx0, wz0, maxLy) {
    // Deterministic 112x112 windmill grid + guaranteed hero windmill + natural WHEAT_VALLEY sectors
    const SECTOR = 112;
    const minSx = Math.floor((wx0 - 12 - WHEAT_PLAIN_MIN_X) / SECTOR);
    const maxSx = Math.floor((wx0 + 27 - WHEAT_PLAIN_MIN_X) / SECTOR);
    const minSz = Math.floor((wz0 - 12 - WHEAT_PLAIN_MIN_Z) / SECTOR);
    const maxSz = Math.floor((wz0 + 27 - WHEAT_PLAIN_MIN_Z) / SECTOR);
    const mills = [];
    if (Math.abs(wx0 + 8 - WHEAT_PLAIN_CX) <= 22 && Math.abs(wz0 + 8 - (WHEAT_PLAIN_CZ - 34)) <= 22) {
      mills.push([WHEAT_PLAIN_CX, WHEAT_PLAIN_CZ - 34]);
    }
    for (let sz = minSz; sz <= maxSz; sz++) {
      for (let sx = minSx; sx <= maxSx; sx++) {
        const cxCell = WHEAT_PLAIN_MIN_X + sx * SECTOR + 56;
        const czCell = WHEAT_PLAIN_MIN_Z + sz * SECTOR + 56;
        const inMega = isWheatMegaPlain(cxCell, czCell);
        const jx = Math.floor((hash2i(sx, sz, worldSeed + 887) - 0.5) * 28);
        const jz = Math.floor((hash2i(sx + 17, sz - 9, worldSeed + 889) - 0.5) * 28);
        const mx = cxCell + jx, mz = czCell + jz;
        if (!inMega && getBiomeAt(mx, mz) !== BIOMES.WHEAT_VALLEY) continue;
        if (inMega && Math.hypot(mx - WHEAT_PLAIN_CX, mz - (WHEAT_PLAIN_CZ - 34)) < 58) continue;
        if (inMega && Math.hypot(mx - WHEAT_PLAIN_CX, mz - WHEAT_PLAIN_CZ) < 28) continue;
        mills.push([mx, mz]);
      }
    }
    const putLocal = (wx, wy, wz, id) => {
      const lx = wx - wx0, lz = wz - wz0, ly = wy - MIN_Y;
      if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly <= 0 || ly >= WORLD_H) return;
      data[(ly << 8) | (lz << 4) | lx] = id;
      if (ly > maxLy) maxLy = ly;
    };
    for (let mi = 0; mi < mills.length; mi++) {
      const [mx0, mz0] = mills[mi];
      if (mx0 + 9 < wx0 || mx0 - 9 >= wx0 + 16 || mz0 + 9 < wz0 || mz0 - 9 >= wz0 + 16) continue;
      const baseY = Math.max(WATER_LEVEL + 1, Math.min(20, Math.round(getRawBiomeHeight(mx0, mz0, BIOMES.WHEAT_VALLEY))));
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        if (Math.hypot(dx, dz) <= 3.5) {
          for (let y = baseY - 2; y <= baseY; y++) putLocal(mx0 + dx, y, mz0 + dz, B.STONE_BRICK);
          for (let wy = 1; wy <= 18; wy++) putLocal(mx0 + dx, baseY + wy, mz0 + dz, B.AIR);
        }
      }
      for (let wy = 1; wy <= 13; wy++) {
        const r = wy <= 5 ? 3.2 : (wy <= 9 ? 2.6 : 2.2);
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
          const d = Math.hypot(dx, dz);
          if (d > r || d < r - 1.15) continue;
          if (wy <= 2 && dz >= 2 && dx === 0) { putLocal(mx0 + dx, baseY + wy, mz0 + dz, wy === 1 ? B.OAK_DOOR : B.AIR); continue; }
          if ((wy === 7 || wy === 10) && (dx === 0 || dz === 0)) { putLocal(mx0 + dx, baseY + wy, mz0 + dz, B.GLASS); continue; }
          const beam = (Math.abs(dx) === Math.abs(dz) || wy === 5 || wy === 9);
          putLocal(mx0 + dx, baseY + wy, mz0 + dz, wy <= 5 ? B.STONE_BRICK : (beam ? B.SPRUCE_LOG : B.PLANKS));
        }
      }
      putLocal(mx0, baseY + 7, mz0, B.LANTERN); putLocal(mx0, baseY + 10, mz0, B.LANTERN);
      for (let ry = 14; ry <= 17; ry++) {
        const r = 17.5 - ry;
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
          if (Math.hypot(dx, dz) <= r) putLocal(mx0 + dx, baseY + ry, mz0 + dz, B.DARK_SLATE_ROOF);
        }
      }
      const ay = baseY + 11;
      putLocal(mx0, ay, mz0 + 3, B.SPRUCE_LOG); putLocal(mx0, ay, mz0 + 4, B.WINDMILL_HUB);
    }
    return maxLy;
  }

  function ensureScenicBlueForestView(spot) {
    const fx = -Math.sin(spot.yaw), fz = -Math.cos(spot.yaw);
    const tx = Math.round(spot.x + fx * 11), tz = Math.round(spot.z + fz * 11);
    const gy = Math.max(WATER_LEVEL + 1, colGroundY(tx, tz));
    let hasBlue = false;
    for (let oy = 2; oy <= 12 && !hasBlue; oy++) {
      const b = getBlockWorld(tx, gy + oy, tz);
      if (b === B.AZURE_LEAVES || b === B.COBALT_LEAVES) hasBlue = true;
    }
    if (!hasBlue) {
      for (let i = 1; i <= 7; i++) setBlockWorld(tx, gy + i, tz, B.AZURE_LOG, true);
      for (let dy = 6; dy <= 10; dy++) {
        const r = dy === 10 ? 1 : (dy === 6 || dy === 9 ? 2 : 3);
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.hypot(dx, dz) <= r + 0.3 && getBlockWorld(tx + dx, gy + dy, tz + dz) === B.AIR) {
            setBlockWorld(tx + dx, gy + dy, tz + dz, dy === 6 ? B.COBALT_LEAVES : B.AZURE_LEAVES, true);
          }
        }
      }
    }
    // Giant Red Spotted Mushroom + Warm Trail Lantern in scenic foreground (Image 7 & 13!)
    const rx = -fz, rz = fx;
    const mx = Math.round(spot.x + fx * 9 + rx * 4), mz = Math.round(spot.z + fz * 9 + rz * 4);
    const mgy = Math.max(WATER_LEVEL + 1, colGroundY(mx, mz));
    for (let i = 1; i <= 5; i++) setBlockWorld(mx, mgy + i, mz, B.MUSHROOM_STEM, true);
    for (let dy = 5; dy <= 6; dy++) {
      const r = dy === 6 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        setBlockWorld(mx + dx, mgy + dy, mz + dz, B.MUSHROOM_RED_CAP, true);
      }
    }
    const lx2 = Math.round(spot.x + fx * 6 - rx * 3), lz2 = Math.round(spot.z + fz * 6 - rz * 3);
    const lgy = Math.max(WATER_LEVEL + 1, colGroundY(lx2, lz2));
    setBlockWorld(lx2, lgy + 1, lz2, B.OAK_FENCE, true);
    setBlockWorld(lx2, lgy + 2, lz2, B.OAK_FENCE, true);
    setBlockWorld(lx2, lgy + 3, lz2, B.LANTERN, true);
  }

  function ensureScenicGiantJungleView(spot) {
    const fx = -Math.sin(spot.yaw), fz = -Math.cos(spot.yaw), rx = -fz, rz = fx;
    // Purge any adjacent biome pink sakura spillover within scenic view so jungle reads purely tropical
    const sx0 = Math.round(spot.x), sz0 = Math.round(spot.z);
    for (let dz = -16; dz <= 16; dz++) for (let dx = -16; dx <= 16; dx++) {
      const wx = sx0 + dx, wz = sz0 + dz;
      for (let y = WATER_LEVEL + 1; y <= MAX_Y - 1; y++) {
        const b = getBlockWorld(wx, y, wz);
        if (b === B.SAKURA_LEAVES) setBlockWorld(wx, y, wz, B.OAK_LEAVES, true);
        else if (b === B.SAKURA_LOG) setBlockWorld(wx, y, wz, B.OAK_LOG, true);
        else if (b === B.SAKURA_PETALS) setBlockWorld(wx, y, wz, B.TALL_GRASS, true);
      }
    }
    const plantMega = (tx, tz, rad) => {
      const gy = Math.max(WATER_LEVEL + 1, colGroundY(tx, tz));
      const th = Math.min(MAX_Y - gy - 5, 15);
      for (let i = 1; i <= th; i++) {
        setBlockWorld(tx, gy + i, tz, B.OAK_LOG, true);
        setBlockWorld(tx + 1, gy + i, tz, B.OAK_LOG, true);
      }
      for (let dy = th - 1; dy <= th + 2; dy++) {
        const r = dy === th + 2 ? rad - 2 : rad;
        for (let dx = -r; dx <= r + 1; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.hypot(dx - 0.5, dz) <= r + 0.3 && getBlockWorld(tx + dx, gy + dy, tz + dz) === B.AIR) {
            setBlockWorld(tx + dx, gy + dy, tz + dz, B.OAK_LEAVES, true);
          }
        }
      }
      for (const [vx, vz] of [[rad, 0], [-rad + 1, 1], [1, rad], [0, -rad + 1], [rad - 1, -2], [-2, rad - 1]]) {
        const vgy = Math.max(WATER_LEVEL + 1, colGroundY(tx + vx, tz + vz));
        for (let y = gy + th - 2; y >= vgy + 1; y--) {
          if (getBlockWorld(tx + vx, y, tz + vz) === B.AIR) setBlockWorld(tx + vx, y, tz + vz, B.VINE, true);
        }
      }
    };
    const tx = Math.round(spot.x + fx * 15), tz = Math.round(spot.z + fz * 15);
    const gy = Math.max(WATER_LEVEL + 1, colGroundY(tx, tz));
    let hasCanopy = false;
    for (let oy = 8; oy <= 20 && !hasCanopy; oy++) {
      if (getBlockWorld(tx, gy + oy, tz) === B.OAK_LEAVES) hasCanopy = true;
    }
    if (!hasCanopy) plantMega(tx, tz, 4);
    plantMega(Math.round(spot.x + fx * 11 - rx * 8), Math.round(spot.z + fz * 11 - rz * 8), 4);
  }

  // --- Dispatcher: giữ chữ ký cũ, chọn 5 thiết kế mới theo size + hash tọa độ ---
  function buildTimberManor(hx, hz, facingZ = 1, size = 'medium') {
    const fz = facingZ >= 0 ? 1 : -1;
    const r = hash2i(hx, hz, 8888);
    if (size === 'large') return (r < 0.5) ? buildTudorManorNew(hx, hz, fz) : buildRedRoofCottage(hx, hz, fz);
    if (size === 'small') return buildBrickCottage(hx, hz, fz);
    return (r < 0.5) ? buildTimberCabin(hx, hz, fz) : buildLakesideCottage(hx, hz, fz);
  }
  function buildVillageHouse(hx, hz, facingZ = 1, style = 'timber') {
    return buildTimberManor(hx, hz, facingZ, style === 'large' ? 'large' : 'medium');
  }

  // ===================== MYSTERIOUS ANCIENT SHADOW RUINS (CRAWLING WITH BLENDER MONSTERS & RARE LOOT!) =====================
  function buildMysteriousRuins(rx, rz) {
    const rcx = rx >> 4, rcz = rz >> 4;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (!chunks.has(chunkKey(rcx + dx, rcz + dz))) generateChunk(rcx + dx, rcz + dz);
    }
    const baseY = Math.max(WATER_LEVEL + 1, colGroundY(rx, rz + 10));
    const R = 10;
    // 1) Weathered Mossy Stone-Brick Courtyard & Broken Obsidian Ritual Floor + Hidden Subterranean Loot Vault!
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const wx = rx + dx, wz = rz + dz, gy = colGroundY(wx, wz);
      for (let wy = 1; wy <= 16; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      for (let y = Math.min(gy, baseY - 2); y <= baseY; y++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        let floorB = B.STONE_BRICK;
        if (y === baseY) {
          if (ring <= 2) floorB = ((dx + dz) & 1) ? B.OBSIDIAN : B.DEEPSLATE;
          else if (ring === 6 || ring === R) floorB = B.BASALT;
          else floorB = hash2i(wx, wz, worldSeed + 4401) > 0.72 ? B.CRACKED_CONCRETE : B.STONE_BRICK;
        }
        setBlockWorld(wx, y, wz, floorB, true);
      }
      // Crumbling Perimeter Ruin Walls (broken jagged height + open South Archway!)
      if (Math.abs(dx) === R || Math.abs(dz) === R) {
        if (dz === R && Math.abs(dx) <= 2) continue;
        const hW = 2 + Math.floor(hash2i(wx, wz, worldSeed + 4409) * 5);
        for (let wy = 1; wy <= hW; wy++) {
          setBlockWorld(wx, baseY + wy, wz, (wy === hW && hash2i(wx + wy, wz, worldSeed + 4411) > 0.6) ? B.BASALT : B.STONE_BRICK, true);
        }
        if (hash2i(wx, wz, worldSeed + 4415) > 0.72) setBlockWorld(wx, baseY + 1, wz + (dz === -R ? 1 : 0), B.VINE, true);
      }
    }
    // 2) 8 Towering Broken Arcane Colonnade Pillars + Draped Vines + Glowing Lanterns!
    for (const [px, pz] of [[-7,-7],[0,-8],[7,-7],[-8,0],[8,0],[-7,7],[7,7],[-4,-4],[4,-4],[-4,4],[4,4]]) {
      const pH = 7 + Math.floor(hash2i(rx + px, rz + pz, worldSeed + 4421) * 6);
      for (let wy = 1; wy <= pH; wy++) {
        setBlockWorld(rx + px, baseY + wy, rz + pz, (wy === 1 || wy === pH) ? B.OBSIDIAN : (wy % 3 === 0 ? B.BASALT : B.STONE_BRICK), true);
      }
      if (Math.abs(px) === 4) setBlockWorld(rx + px, baseY + pH + 1, rz + pz, B.GLOW_CRYSTAL, true);
      else if (pH >= 9) setBlockWorld(rx + px, baseY + pH + 1, rz + pz, B.LANTERN, true);
    }
    // Broken overhead arch lintels connecting back pillars
    for (let dx = -7; dx <= 7; dx++) {
      if (hash2i(rx + dx, rz - 7, worldSeed + 4433) > 0.25) setBlockWorld(rx + dx, baseY + 8, rz - 7, B.STONE_BRICK, true);
    }
    // 3) Central Glowing Arcane Obelisk Altar + Enchanting Table + 3 Rare Treasure Chests + Rare Ore Veins!
    for (let wy = 1; wy <= 7; wy++) setBlockWorld(rx, baseY + wy, rz - 2, wy >= 5 ? B.GLOW_CRYSTAL : B.OBSIDIAN, true);
    setBlockWorld(rx, baseY + 1, rz, B.ENCHANT_TABLE, true);
    setBlockWorld(rx - 2, baseY + 1, rz - 1, B.CHEST, true);
    setBlockWorld(rx + 2, baseY + 1, rz - 1, B.CHEST, true);
    setBlockWorld(rx, baseY + 1, rz - 5, B.CHEST, true);
    setBlockWorld(rx - 3, baseY + 1, rz - 4, B.IRON_ORE, true);
    setBlockWorld(rx + 3, baseY + 1, rz - 4, B.EMERALD_ORE, true);
    setBlockWorld(rx, baseY + 1, rz - 6, B.OBSIDIAN, true);
    buildDoorAccessStairs(rx, baseY, rz + R, 0, 1, B.STONE_BRICK, 2);

    // 4) Heavy Monster Garrison Guarding the Mysterious Ruins — clearing all raises the Dream Portal!
    const ruinId = 'ancient_ruin_' + rx + '_' + rz;
    const spawned = [];
    const garrison = [
      ['ravager', 0, -4], ['evoker', -4, -3], ['wither_knight', 4, -3],
      ['ruin_stalker', -5, 3], ['ruin_stalker', 5, 3], ['pillager', -3, 6], ['skeleton', 3, 6]
    ];
    for (const [mType, ox, oz] of garrison) {
      const m = spawnMobOfType(mType, rx + ox + 0.5, baseY + 1.2, rz + oz + 0.5);
      if (m) { m.ruinId = ruinId; spawned.push(m); }
    }
    const g1 = spawnMobOfType('gargoyle', rx - 4, baseY + 8.5, rz - 4);
    const g2 = spawnMobOfType('gargoyle', rx + 4, baseY + 9.0, rz - 4);
    if (g1) { g1.ruinId = ruinId; spawned.push(g1); }
    if (g2) { g2.ruinId = ruinId; spawned.push(g2); }
    if (spawned.length) {
      _activeRuinEncounters.set(ruinId, { rn: { id: ruinId, x: rx, y: baseY, z: rz + 3 }, count: spawned.length });
    }
    return baseY;
  }

  function buildVillageWatchtower(tx, tz, baseY) {
    const towerBaseY = Math.max(WATER_LEVEL + 1, colGroundY(tx, tz + 2));
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const wx = tx + dx, wz = tz + dz, gy = colGroundY(wx, wz);
      for (let y = gy; y <= towerBaseY; y++) setBlockWorld(wx, y, wz, B.STONE_BRICK, true);
      for (let wy = 1; wy <= 16; wy++) setBlockWorld(wx, towerBaseY + wy, wz, B.AIR, true);
    }
    for (let wy = 1; wy <= 11; wy++) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const isCorner = (Math.abs(dx) === 2 && Math.abs(dz) === 2);
        const isEdge = (Math.abs(dx) === 2 || Math.abs(dz) === 2);
        if (!isEdge) continue;
        if (dx === 0 && dz === 2 && wy === 1) { setBlockWorld(tx + dx, towerBaseY + wy, tz + dz, B.SPRUCE_DOOR, true); continue; }
        if (dx === 0 && dz === 2 && wy === 2) continue;
        if (wy === 6 && (dx === 0 || dz === 0)) setBlockWorld(tx + dx, towerBaseY + wy, tz + dz, B.GLASS, true);
        else setBlockWorld(tx + dx, towerBaseY + wy, tz + dz, isCorner ? B.OAK_LOG : B.STONE_BRICK, true);
      }
    }
    setBlockWorld(tx, towerBaseY + 3, tz + 3, B.LANTERN, true);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const isOuter = (Math.abs(dx) === 3 || Math.abs(dz) === 3);
      setBlockWorld(tx + dx, towerBaseY + 12, tz + dz, isOuter ? B.SPRUCE_LOG : B.PLANKS, true);
      if (isOuter && ((dx + dz) & 1) === 0) setBlockWorld(tx + dx, towerBaseY + 13, tz + dz, B.STONE_BRICK, true);
    }
    for (const [cx, cz] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {
      for (let wy = 13; wy <= 15; wy++) setBlockWorld(tx + cx, towerBaseY + wy, tz + cz, B.SPRUCE_LOG, true);
    }
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) setBlockWorld(tx + dx, towerBaseY + 16, tz + dz, B.PLANKS, true);
    setBlockWorld(tx, towerBaseY + 17, tz, B.SPRUCE_LOG, true);
    setBlockWorld(tx, towerBaseY + 14, tz, B.TORCH_BLOCK, true);
    setBlockWorld(tx, towerBaseY + 18, tz, B.LANTERN, true);
    buildDoorAccessStairs(tx, towerBaseY, tz + 2, 0, 1, B.STONE_BRICK, 1);
  }

  function buildVillage(vx, vz) {
    const vcx = vx >> 4, vcz = vz >> 4;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (!chunks.has(chunkKey(vcx + dx, vcz + dz))) generateChunk(vcx + dx, vcz + dz);
    }
    const baseY = Math.max(WATER_LEVEL + 1, colGroundY(vx, vz));
    // Grand Octagonal Cobbled Town Plaza (11x11) + Tiered Fountain Pavilion!
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > 8) continue;
      const wx = vx + dx, wz = vz + dz, gy = colGroundY(wx, wz);
      for (let y = gy + 1; y <= baseY; y++) setBlockWorld(wx, y, wz, B.DIRT, true);
      for (let wy = 1; wy <= 10; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      const isPool = (Math.abs(dx) <= 1 && Math.abs(dz) <= 1);
      const isRim  = (Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && !isPool);
      const isPath = ((Math.abs(dx) + Math.abs(dz)) % 2 === 0);
      setBlockWorld(wx, baseY, wz, isPool ? B.WATER : (isRim ? B.STONE_BRICK : (isPath ? B.SANDSTONE : B.STONE_BRICK)), true);
      if (isRim && (Math.abs(dx) === 2 && Math.abs(dz) === 2)) {
        for (let wy = 1; wy <= 4; wy++) setBlockWorld(wx, baseY + wy, wz, B.OAK_LOG, true);
        setBlockWorld(wx, baseY + 4, wz + (dz > 0 ? 1 : -1), B.TORCH_BLOCK, true);
      }
    }
    // Fountain Center Crystal Spire + Pavilion Roof
    setBlockWorld(vx, baseY, vz, B.STONE_BRICK, true);
    setBlockWorld(vx, baseY + 1, vz, B.STONE_BRICK, true);
    setBlockWorld(vx, baseY + 2, vz, B.GLOW_CRYSTAL, true);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (Math.abs(dx) + Math.abs(dz) <= 4) setBlockWorld(vx + dx, baseY + 5, vz + dz, (Math.abs(dx) === 3 || Math.abs(dz) === 3) ? B.SPRUCE_LOG : B.PLANKS, true);
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) setBlockWorld(vx + dx, baseY + 6, vz + dz, B.SPRUCE_LOG, true);
    }
    setBlockWorld(vx, baseY + 7, vz, B.TORCH_BLOCK, true);
    // Cobblestone Roads & Street Lamps radiating from Plaza
    for (let d = 5; d <= 13; d++) {
      for (const [rx, rz] of [[vx - d, vz], [vx + d, vz], [vx, vz - d], [vx, vz + d]]) {
        const gy = colGroundY(rx, rz);
        setBlockWorld(rx, gy, rz, B.STONE_BRICK, true);
        if (d === 9) {
          setBlockWorld(rx + 2, gy + 1, rz, B.OAK_LOG, true);
          setBlockWorld(rx + 2, gy + 2, rz, B.OAK_LOG, true);
          setBlockWorld(rx + 2, gy + 3, rz, B.TORCH_BLOCK, true);
        }
      }
    }
    // Showcase ALL 3 Brand-New Handcrafted House Models (Cozy Porch Cottage, Garden Vine Villa & Grand Medieval Mansion w/ Double Doors + Turret!)
    const h1 = buildVillageHouse(vx - 14, vz - 10, 1, 'timber');
    const h2 = buildVillageHouse(vx + 14, vz - 10, 1, 'timber');
    const h3 = buildVillageHouse(vx, vz - 21, 1, 'timber');
    buildVillageWatchtower(vx + 14, vz + 6, baseY);
    // Authentic Minecraft Oak-Fenced Village Wheat Farm Plot (Image 3!) + Stone Wall Road Borders!
    const fx0 = vx - 13, fz0 = vz + 5;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -4; dx <= 4; dx++) {
      const wx = fx0 + dx, wz = fz0 + dz, gy = colGroundY(wx, wz);
      const isBorder = (Math.abs(dx) === 4 || Math.abs(dz) === 3);
      const isGate = (dx === 0 && dz === -3);
      for (let y = gy; y < baseY; y++) setBlockWorld(wx, y, wz, B.DIRT, true);
      setBlockWorld(wx, baseY, wz, isBorder ? B.GRASS : (dx === 0 ? B.WATER : B.DIRT), true);
      setBlockWorld(wx, baseY + 1, wz, (isBorder && !isGate) ? B.OAK_FENCE : (dx === 0 ? B.AIR : B.HAY_BALE), true);
      if (isBorder && Math.abs(dx) === 4 && Math.abs(dz) === 3) setBlockWorld(wx, baseY + 2, wz, B.TORCH_BLOCK, true);
    }
    for (let d = 5; d <= 11; d += 1) {
      const gyL = colGroundY(vx - 2, vz + d), gyR = colGroundY(vx + 2, vz + d);
      setBlockWorld(vx - 2, gyL + 1, vz + d, B.STONE_WALL, true);
      setBlockWorld(vx + 2, gyR + 1, vz + d, B.STONE_WALL, true);
    }
    // Spawn 5 Blender Villagers & 2 Blender Iron Golem Protectors!
    const vSpots = [[vx - 4.5, vz + 4.5], [vx + 4.5, vz + 4.5], [vx - 5.5, vz - 3.5], [vx + 5.5, vz - 3.5], [vx, vz - 7.5]];
    for (const [sx, sz] of vSpots) spawnMobOfType('villager', sx, colGroundY(Math.floor(sx), Math.floor(sz)) + 1.1, sz);
    spawnMobOfType('iron_golem', vx - 2.5, baseY + 1.2, vz + 6.5);
    spawnMobOfType('iron_golem', vx + 6.5, baseY + 1.2, vz + 2.5);
    return Math.max(baseY, h1, h2, h3);
  }

  // ===================== GRAND CITADEL, CASTLE & SPRAWLING CITY (Inspired by Reference Image 3!) =====================
  function buildGrandCastleCity(cx, cz) {
    const ccx = cx >> 4, ccz = cz >> 4;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (!chunks.has(chunkKey(ccx + dx, ccz + dz))) generateChunk(ccx + dx, ccz + dz);
    }
    const baseY = Math.max(WATER_LEVEL + 2, colGroundY(cx, cz));
    // 1) Level Grand Citadel Plateau (35x35) + Golden Hay/Wheat Terraces + Fortified Curtain Walls!
    const R = 18;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const wx = cx + dx, wz = cz + dz, gy = colGroundY(wx, wz);
      for (let wy = 1; wy <= 28; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      for (let y = Math.min(gy, baseY - 3); y <= baseY; y++) setBlockWorld(wx, y, wz, y === baseY ? (((Math.abs(dx) <= 2 || Math.abs(dz) <= 2) ? B.STONE_BRICK : (Math.abs(dx) <= 10 && Math.abs(dz) <= 9 ? B.MARBLE_BRICK : B.GRASS))) : B.STONE_BRICK, true);
      // Outer Fortified City Curtain Wall + Battlements + Gatehouse Arch at south (+Z)
      const onWall = (Math.abs(dx) === R || Math.abs(dz) === R);
      const isGate = (dz === R && Math.abs(dx) <= 2);
      if (onWall && !isGate) {
        for (let wy = 1; wy <= 6; wy++) setBlockWorld(wx, baseY + wy, wz, (wy === 6 && ((dx + dz) & 1) === 0) ? B.MARBLE_BRICK : B.STONE_BRICK, true);
        if ((dx + dz) % 6 === 0) setBlockWorld(wx, baseY + 7, wz, B.TORCH_BLOCK, true);
        else if (((dx + dz) & 1) === 1) setBlockWorld(wx, baseY + 7, wz, B.STONE_BRICK_WALL, true);
      } else if (isGate) {
        setBlockWorld(wx, baseY + 5, wz, B.STONE_BRICK, true);
        setBlockWorld(wx, baseY + 6, wz, B.MARBLE_BRICK, true);
        if (dx === 0) setBlockWorld(wx, baseY + 7, wz, B.LANTERN, true);
      }
    }
    // Ceremonial 5-wide South Gate Grand Staircase connecting castle floor flush down to terrain!
    buildDoorAccessStairs(cx, baseY, cz + R, 0, 1, B.STONE_BRICK, 2);

    // 2) 4 Monumental Corner Watchtowers with Steep Oxidized Emerald-Copper Roof Spires!
    const buildCastleSpire = (tx, tz, baseH, towerH, rad) => {
      for (let wy = 1; wy <= towerH; wy++) {
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          const edge = (Math.abs(dx) === rad || Math.abs(dz) === rad);
          if (!edge && wy > 1 && wy < towerH) continue;
          const isWin = (wy === Math.floor(towerH * 0.5) || wy === towerH - 2) && (dx === 0 || dz === 0);
          const isCorner = (Math.abs(dx) === rad && Math.abs(dz) === rad);
          setBlockWorld(tx + dx, baseH + wy, tz + dz, isWin ? B.GLASS : (isCorner ? B.STONE_BRICK : B.MARBLE_BRICK), true);
        }
      }
      // Steep Emerald-Copper Spire Roof!
      for (let s = 0; s <= rad + 4; s++) {
        const sr = Math.max(0, rad + 1 - Math.floor(s * 0.65));
        for (let dz = -sr; dz <= sr; dz++) for (let dx = -sr; dx <= sr; dx++) {
          if (sr > 0 && Math.abs(dx) === sr && Math.abs(dz) === sr && s >= 2) continue;
          setBlockWorld(tx + dx, baseH + towerH + 1 + s, tz + dz, (s === 0 && (Math.abs(dx) === sr || Math.abs(dz) === sr)) ? B.MARBLE_BRICK : B.COPPER_ROOF, true);
        }
      }
      setBlockWorld(tx, baseH + towerH + rad + 6, tz, B.TORCH_BLOCK, true);
    };
    for (const [sx, sz] of [[-R, -R], [R, -R], [-R, R], [R, R]]) buildCastleSpire(cx + sx, cz + sz, baseY, 13, 2);

    // 3) Central Royal Gothic Castle Keep (15x13 Marble Palace + Steep Twin Emerald-Copper Gables + Functional Royal Hall!)
    const kw = 7, kd = 6, kh = 11;
    for (let dz = -kd; dz <= kd; dz++) for (let dx = -kw; dx <= kw; dx++) {
      const wx = cx + dx, wz = cz - 2 + dz;
      const isEdge = (Math.abs(dx) === kw || Math.abs(dz) === kd);
      const isPillar = (Math.abs(dx) === kw && (dz % 3 === 0)) || (Math.abs(dz) === kd && (dx % 3 === 0));
      for (let wy = 1; wy <= kh; wy++) {
        if (dz === kd && Math.abs(dx) <= 1 && wy <= 4) {
          // Royal Castle Keep Grand Framed Entrance w/ Working Spruce Door + Stone Arch + Lantern Transom!
          if (dx === 0 && wy === 1) setBlockWorld(wx, baseY + wy, wz, B.SPRUCE_DOOR, true);
          else if (dx === 0 && wy === 2) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
          else if (dx === 0 && wy === 3) setBlockWorld(wx, baseY + wy, wz, B.SPRUCE_LOG, true);
          else if (dx === 0 && wy === 4) setBlockWorld(wx, baseY + wy, wz, B.GLASS, true);
          else if (Math.abs(dx) === 1 && wy <= 3) setBlockWorld(wx, baseY + wy, wz, wy === 2 ? B.GLASS : B.STONE_BRICK, true);
          else setBlockWorld(wx, baseY + wy, wz, B.STONE_BRICK, true);
          continue;
        }
        if (isEdge) {
          const isGothicWin = ((wy >= 3 && wy <= 5) || (wy >= 8 && wy <= 9)) && !isPillar && ((Math.abs(dx) % 3 !== 0 && Math.abs(dz) === kd) || (Math.abs(dz) % 3 !== 0 && Math.abs(dx) === kw));
          setBlockWorld(wx, baseY + wy, wz, isGothicWin ? B.GLASS : (isPillar ? B.STONE_BRICK : B.MARBLE_BRICK), true);
        } else if (wy === 6) {
          setBlockWorld(wx, baseY + wy, wz, B.PLANKS, true);
        }
      }
    }
    setBlockWorld(cx, baseY + 3, cz - 2 + kd + 1, B.LANTERN, true);
    setBlockWorld(cx - 2, baseY + 3, cz - 2 + kd + 1, B.LANTERN, true);
    setBlockWorld(cx + 2, baseY + 3, cz - 2 + kd + 1, B.LANTERN, true);
    // Steep Emerald-Copper Gabled Palace Roof + Tall Central Spire (matches Reference Image 3!)
    for (let step = 0; step <= kd + 1; step++) {
      const zA = cz - 2 - (kd + 1 - step), zB = cz - 2 + (kd + 1 - step), ry = baseY + kh + 1 + step;
      for (let dx = -kw - 1; dx <= kw + 1; dx++) {
        const isTrim = (Math.abs(dx) === kw + 1);
        setBlockWorld(cx + dx, ry, zA, isTrim ? B.MARBLE_BRICK : B.COPPER_ROOF, true);
        setBlockWorld(cx + dx, ry, zB, isTrim ? B.MARBLE_BRICK : B.COPPER_ROOF, true);
      }
      if (step < kd) {
        for (let iz = zA + 1; iz < zB; iz++) {
          setBlockWorld(cx - kw, ry, iz, B.MARBLE_BRICK, true);
          setBlockWorld(cx + kw, ry, iz, B.MARBLE_BRICK, true);
        }
      }
    }
    // Twin Royal Castle Keep Spires!
    buildCastleSpire(cx - kw, cz - 2 - kd, baseY, 17, 2);
    buildCastleSpire(cx + kw, cz - 2 - kd, baseY, 19, 2);
    buildCastleSpire(cx, cz - 2, baseY + kh + kd + 1, 7, 1);

    // Royal Functional Interior (Bookshelves, Enchanting Table, Anvil, Beds, Treasure Chests, Chandeliers!)
    for (let dx = -4; dx <= -2; dx++) { setBlockWorld(cx + dx, baseY + 1, cz - 6, B.BOOKSHELF, true); setBlockWorld(cx + dx, baseY + 2, cz - 6, B.BOOKSHELF, true); }
    setBlockWorld(cx - 3, baseY + 1, cz - 4, B.ENCHANT_TABLE, true);
    setBlockWorld(cx + 3, baseY + 1, cz - 5, B.ANVIL, true);
    setBlockWorld(cx + 4, baseY + 1, cz - 5, B.FURNACE, true);
    setBlockWorld(cx, baseY + 1, cz - 6, B.CHEST, true);
    setBlockWorld(cx + 1, baseY + 1, cz - 6, B.CHEST, true);
    setBlockWorld(cx - 4, baseY + 1, cz + 1, B.BED, true);
    setBlockWorld(cx - 3, baseY + 1, cz + 1, B.BED_FOOT, true);
    setBlockWorld(cx, baseY + 5, cz - 2, B.TORCH_BLOCK, true);
    setBlockWorld(cx - 4, baseY + 5, cz - 2, B.TORCH_BLOCK, true);
    setBlockWorld(cx + 4, baseY + 5, cz - 2, B.TORCH_BLOCK, true);

    // 4) Sprawling Outer City District: Golden Hay Bale Farms, Market Campfires & 3 Grand Builder Houses!
    for (let dz = 8; dz <= 14; dz++) for (let dx = -14; dx <= -6; dx++) {
      setBlockWorld(cx + dx, baseY + 1, cz + dz, ((dx + dz) % 3 === 0) ? B.HAY_BALE : B.TALL_GRASS, true);
    }
    setBlockWorld(cx + 8, baseY + 1, cz + 10, B.CAMPFIRE, true);
    setBlockWorld(cx + 10, baseY + 1, cz + 10, B.CHEST, true);
    buildVillageHouse(cx - 25, cz + 4, 1, 'timber');
    buildVillageHouse(cx + 25, cz + 4, 1, 'timber');
    buildVillageHouse(cx + 12, cz + 27, 1, 'timber');
    buildVillageWatchtower(cx - 24, cz - 14, baseY);

    // Populate Castle City with Villagers, Iron Golems, Horses & Peacocks!
    for (const [vx, vz] of [[-5, 9], [5, 9], [0, 12], [-9, 4], [9, 4], [0, -1]]) spawnMobOfType('villager', cx + vx + 0.5, baseY + 1.2, cz + vz + 0.5);
    spawnMobOfType('iron_golem', cx - 3.5, baseY + 1.2, cz + 16.5);
    spawnMobOfType('iron_golem', cx + 3.5, baseY + 1.2, cz + 16.5);
    spawnMobOfType('wild_horse', cx - 12.5, baseY + 1.2, cz + 12.5);
    spawnMobOfType('peacock', cx + 8.5, baseY + 1.2, cz + 13.5);
    return baseY;
  }

  // ===================== SEAPORT, LIGHTHOUSE & SAILING SHIPS (Cảng Biển & Thuyền Buồm!) =====================
  function buildSailingShip(sx, sz, facingZ = -1) {
    const sy = WATER_LEVEL;
    // Curved Wooden Hull (length 15, width 7) floating cleanly on ocean surface!
    for (let dz = -7; dz <= 7; dz++) {
      const wMax = Math.abs(dz) >= 6 ? 1 : (Math.abs(dz) >= 4 ? 2 : 3);
      for (let dx = -wMax; dx <= wMax; dx++) {
        setBlockWorld(sx + dx, sy - 1, sz + dz, B.SPRUCE_LOG, true);
        const isRail = (Math.abs(dx) === wMax || Math.abs(dz) === 7);
        setBlockWorld(sx + dx, sy, sz + dz, isRail ? B.SPRUCE_LOG : B.PLANKS, true);
        setBlockWorld(sx + dx, sy + 1, sz + dz, isRail ? B.PLANKS : B.AIR, true);
        for (let cy = 2; cy <= 16; cy++) setBlockWorld(sx + dx, sy + cy, sz + dz, B.AIR, true);
      }
    }
    // Raised Stern Captain Quarters + Chest + Bed + Lantern!
    for (let dz = 4; dz <= 7; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (dz === 7 && Math.abs(dx) > 1) continue;
      setBlockWorld(sx + dx, sy + 2, sz + dz, B.PLANKS, true);
      if (Math.abs(dx) === 2 || dz === 7) setBlockWorld(sx + dx, sy + 3, sz + dz, B.SPRUCE_LOG, true);
    }
    setBlockWorld(sx, sy + 3, sz + 5, B.CHEST, true);
    setBlockWorld(sx - 1, sy + 3, sz + 6, B.BED, true);
    setBlockWorld(sx, sy + 3, sz + 6, B.BED_FOOT, true);
    setBlockWorld(sx, sy + 4, sz + 7, B.TORCH_BLOCK, true);
    // Bowsprit at front (-Z)
    for (let i = 1; i <= 3; i++) setBlockWorld(sx, sy + 1 + Math.floor(i / 2), sz - 7 - i, B.OAK_LOG, true);
    // Tall Central Mast + Billowing White Sails!
    for (let my = 1; my <= 13; my++) setBlockWorld(sx, sy + my, sz - 1, B.SPRUCE_LOG, true);
    for (let sySail = 4; sySail <= 10; sySail++) {
      const belly = (sySail >= 6 && sySail <= 8) ? -1 : 0;
      for (let dx = -4; dx <= 4; dx++) setBlockWorld(sx + dx, sy + sySail, sz - 1 + belly, B.MARBLE_BRICK, true);
    }
    setBlockWorld(sx, sy + 14, sz - 1, B.TORCH_BLOCK, true);
  }

  function buildSeaportAndShips(px, pz) {
    const pcx = px >> 4, pcz = pz >> 4;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (!chunks.has(chunkKey(pcx + dx, pcz + dz))) generateChunk(pcx + dx, pcz + dz);
    }
    // Sculpt Sandy Palm Beach on South (+Z >= 2) and Deep Turquoise Harbor Basin on North (-Z <= 1)!
    for (let dz = -28; dz <= 10; dz++) for (let dx = -18; dx <= 18; dx++) {
      const wx = px + dx, wz = pz + dz;
      for (let wy = WATER_LEVEL + 1; wy <= WATER_LEVEL + 22; wy++) setBlockWorld(wx, wy, wz, B.AIR, true);
      if (dz <= 1) {
        const depth = Math.min(8, 2 + Math.floor((2 - dz) * 0.45));
        for (let wy = WATER_LEVEL; wy >= WATER_LEVEL - depth; wy--) setBlockWorld(wx, wy, wz, B.WATER, true);
        setBlockWorld(wx, WATER_LEVEL - depth - 1, wz, B.SAND, true);
      } else {
        const bh = WATER_LEVEL + Math.min(3, Math.floor(dz * 0.45));
        for (let wy = WATER_LEVEL - 4; wy <= bh; wy++) setBlockWorld(wx, wy, wz, B.SAND, true);
      }
    }
    // Main Wooden Seaport Pier extending 20 blocks into ocean + Side Mooring Docks!
    for (let dz = -18; dz <= 4; dz++) for (let dx = -2; dx <= 2; dx++) {
      setBlockWorld(px + dx, WATER_LEVEL + 1, pz + dz, (Math.abs(dx) === 2) ? B.SPRUCE_LOG : B.PLANKS, true);
      if (dz % 5 === 0 && Math.abs(dx) === 2) {
        for (let py = WATER_LEVEL - 6; py <= WATER_LEVEL + 2; py++) setBlockWorld(px + dx, py, pz + dz, B.OAK_LOG, true);
        setBlockWorld(px + dx, WATER_LEVEL + 3, pz + dz, B.TORCH_BLOCK, true);
      }
    }
    // Harbor Cottage w/ Working Door + Crates + Campfire + Tall Glowing Striped Lighthouse!
    buildVillageHouse(px - 10, pz + 7, 1, 'timber');
    setBlockWorld(px - 2, WATER_LEVEL + 2, pz + 1, B.CHEST, true);
    setBlockWorld(px + 2, WATER_LEVEL + 2, pz + 1, B.HAY_BALE, true);
    setBlockWorld(px + 4, WATER_LEVEL + 2, pz + 4, B.CAMPFIRE, true);
    const lhx = px + 11, lhz = pz + 3;
    for (let wy = 1; wy <= 16; wy++) {
      const rad = wy <= 12 ? 2 : 1;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && wy > 1) continue;
        const isLight = (wy >= 13 && wy <= 15);
        setBlockWorld(lhx + dx, WATER_LEVEL + wy, lhz + dz, isLight ? (Math.abs(dx) === 0 && Math.abs(dz) === 0 ? B.SEA_LANTERN : B.GLASS) : ((Math.floor(wy / 3) & 1) === 0 ? B.MARBLE_BRICK : B.TERRACOTTA), true);
      }
    }
    setBlockWorld(lhx, WATER_LEVEL + 17, lhz, B.COPPER_ROOF, true);
    setBlockWorld(lhx, WATER_LEVEL + 18, lhz, B.SEA_LANTERN, true);
    // 2 Full 3D Floating Sailing Ships moored beside pier & out at sea!
    buildSailingShip(px + 8, pz - 12);
    buildSailingShip(px - 9, pz - 18);
    // Tropical Coconut Palms along the Harbor Beach!
    for (const [plx, plz] of [[px - 5, pz + 4], [px + 6, pz + 5], [px + 15, pz + 6]]) {
      const baseP = colGroundY(plx, plz);
      for (let i = 1; i <= 7; i++) setBlockWorld(plx + (i > 4 ? 1 : 0), baseP + i, plz, B.PALM_LOG, true);
      const tx = plx + 1, ty = baseP + 8;
      setBlockWorld(tx, ty, plz, B.PALM_LEAVES, true);
      for (const [fx, fz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
        for (let s = 1; s <= (fx && fz ? 2 : 3); s++) setBlockWorld(tx + fx * s, ty - (s === (fx && fz ? 2 : 3) ? 1 : 0), plz + fz * s, B.PALM_LEAVES, true);
      }
      setBlockWorld(tx + 1, ty - 1, plz, B.COCONUT, true);
      setBlockWorld(tx - 1, ty - 1, plz, B.COCONUT, true);
    }
    // Spawn Harbor Villagers, Seagulls, Dolphins & Tropical Fish!
    spawnMobOfType('villager', px - 1.5, WATER_LEVEL + 2.2, pz + 2.5);
    spawnMobOfType('villager', px + 1.5, WATER_LEVEL + 2.2, pz - 4.5);
    spawnMobOfType('seagull', px + 3.5, WATER_LEVEL + 8.5, pz - 10.5);
    spawnMobOfType('marine_dolphin', px + 2.5, WATER_LEVEL - 1.5, pz - 22.5);
    spawnMobOfType('fish_clown', px - 3.5, WATER_LEVEL - 1.5, pz - 8.5);
    spawnMobOfType('fish_tang_blue', px + 4.5, WATER_LEVEL - 1.8, pz - 6.5);
    return WATER_LEVEL + 2;
  }

  // ===================== DEEP OCEAN MONUMENT, CORAL REEF & SUNKEN SHIPWRECK (Công Trình Dưới Biển & Thuyền Đắm!) =====================
  function buildUnderwaterRuinsAndShipwreck(ox, oz) {
    const ocx = ox >> 4, ocz = oz >> 4;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (!chunks.has(chunkKey(ocx + dx, ocz + dz))) generateChunk(ocx + dx, ocz + dz);
    }
    const bedY = WATER_LEVEL - 11;
    // Clear & fill Deep Blue Ocean Basin (36x36) + Vibrant Coral Reefs!
    for (let dz = -18; dz <= 18; dz++) for (let dx = -18; dx <= 18; dx++) {
      const wx = ox + dx, wz = oz + dz;
      for (let wy = WATER_LEVEL + 1; wy <= WATER_LEVEL + 10; wy++) setBlockWorld(wx, wy, wz, B.AIR, true);
      for (let wy = WATER_LEVEL; wy > bedY; wy--) setBlockWorld(wx, wy, wz, B.WATER, true);
      setBlockWorld(wx, bedY, wz, B.SAND, true);
      setBlockWorld(wx, bedY - 1, wz, B.SANDSTONE, true);
      const rc = hash2i(wx, wz, worldSeed + 881);
      if (Math.abs(dx) > 7 || Math.abs(dz) > 7) {
        if (rc > 0.90) {
          const cid = rc > 0.96 ? B.CORAL_GOLD : (rc > 0.93 ? B.CORAL_PINK : B.CORAL_BLUE);
          setBlockWorld(wx, bedY + 1, wz, cid, true);
          if (rc > 0.95) setBlockWorld(wx, bedY + 2, wz, cid, true);
        } else if (rc > 0.78) setBlockWorld(wx, bedY + 1, wz, B.SEAGRASS, true);
      }
    }
    // 1) Glowing Prismarine Ocean Monument Temple (13x13 Stepped Pyramid + Sea Lantern Colonnade + Gold Vault!)
    for (let step = 0; step < 6; step++) {
      const rad = 6 - step;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const isEdge = (Math.abs(dx) === rad || Math.abs(dz) === rad);
        const isGate = (dz === rad && Math.abs(dx) <= 1 && step <= 2);
        if (isGate) continue;
        if (isEdge || step === 5) {
          const isLantern = (Math.abs(dx) === rad && Math.abs(dz) === rad) || (step === 5 && dx === 0 && dz === 0);
          setBlockWorld(ox + dx, bedY + 1 + step, oz - 6 + dz, isLantern ? B.SEA_LANTERN : B.PRISMARINE, true);
        }
      }
    }
    // Monument Vault Treasure (Gold Blocks + Chest + Sea Lanterns!)
    setBlockWorld(ox, bedY + 1, oz - 6, B.GOLD_ORE, true);
    setBlockWorld(ox + 1, bedY + 1, oz - 6, B.CHEST, true);
    setBlockWorld(ox - 1, bedY + 1, oz - 6, B.DIAMOND_ORE, true);
    setBlockWorld(ox, bedY + 3, oz - 6, B.SEA_LANTERN, true);

    // 2) Sunken Tilted Shipwreck (Thuyền Đắm Dưới Đáy Biển!) with Broken Mast & Treasure Chest!
    const wx0 = ox + 8, wz0 = oz + 6;
    for (let dz = -5; dz <= 5; dz++) {
      const tiltY = bedY + 1 + (dz > 1 ? 1 : 0);
      const wMax = Math.abs(dz) >= 4 ? 1 : 2;
      for (let dx = -wMax; dx <= wMax; dx++) {
        if (dz === 2 && dx === 1) continue; // Hull breach hole!
        setBlockWorld(wx0 + dx, tiltY, wz0 + dz, B.SPRUCE_LOG, true);
        if (Math.abs(dx) === wMax && dz !== 1) setBlockWorld(wx0 + dx, tiltY + 1, wz0 + dz, (dx + dz) % 3 === 0 ? B.PRISMARINE : B.PLANKS, true);
      }
    }
    for (let m = 1; m <= 5; m++) setBlockWorld(wx0 + Math.floor(m / 2), bedY + 1 + m, wz0, B.OAK_LOG, true); // Tilted snapped mast!
    setBlockWorld(wx0, bedY + 2, wz0 - 2, B.CHEST, true);
    setBlockWorld(wx0, bedY + 2, wz0 + 3, B.SEA_LANTERN, true);

    // Spawn Rich Marine Ecosystem (Sharks, Rays, Dolphins, Sea Turtles, Glowing Jellyfish & Tropical Fish Schools!)
    for (const [spId, dx, dy, dz] of [
      ['marine_shark', -6, -4, 4], ['marine_ray', 4, -5, -2], ['marine_dolphin', -2, -2, 8],
      ['marine_turtle', 6, -6, 2], ['marine_jelly', -5, -6, -3], ['marine_octopus', 7, -8, 6],
      ['fish_clown', 1, -7, 2], ['fish_tang_blue', -2, -7, 3], ['fish_tang_gold', 3, -6, 4],
      ['fish_sword', -8, -4, -8], ['fish_puffer', 5, -7, -5]
    ]) {
      spawnMobOfType(spId, ox + dx + 0.5, WATER_LEVEL + dy, oz + dz + 0.5);
    }
    return bedY;
  }

  function buildMossyPondRuins(rx, rz) {
    const baseY = Math.max(WATER_LEVEL, colGroundY(rx, rz));
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const wx = rx + dx, wz = rz + dz;
      for (let wy = 1; wy <= 9; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      for (let y = colGroundY(wx, wz); y <= baseY; y++) setBlockWorld(wx, y, wz, B.STONE_BRICK, true);
      const isCorner = (Math.abs(dx) === 4 && Math.abs(dz) === 4);
      const isCol = (Math.abs(dx) === 3 && Math.abs(dz) === 3);
      if (isCorner || isCol) {
        const h = isCol ? 6 : 3;
        for (let wy = 1; wy <= h; wy++) setBlockWorld(wx, baseY + wy, wz, B.STONE_BRICK, true);
        setBlockWorld(wx, baseY + h + 1, wz, B.OAK_LEAVES, true);
      } else if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) {
        setBlockWorld(wx, baseY, wz, (dx === 0 && dz === 0) ? B.STONE_BRICK : B.WATER, true);
        if ((Math.abs(dx) === 1 && Math.abs(dz) === 2)) setBlockWorld(wx, baseY + 1, wz, B.LILY_PAD, true);
      }
    }
    // Ancient Broken Stone Archway + Hanging Vines + Sanctuary Crystal
    for (let dx = -3; dx <= 3; dx++) {
      setBlockWorld(rx + dx, baseY + 7, rz - 3, B.STONE_BRICK, true);
      if (Math.abs(dx) <= 2) setBlockWorld(rx + dx, baseY + 6, rz - 3, B.OAK_LEAVES, true);
    }
    setBlockWorld(rx, baseY + 1, rz, B.GLOW_CRYSTAL, true);
    setBlockWorld(rx, baseY + 2, rz, B.MUSHROOM_GLOW, true);
    setBlockWorld(rx - 3, baseY + 4, rz + 3, B.TORCH_BLOCK, true);
    setBlockWorld(rx + 3, baseY + 4, rz + 3, B.TORCH_BLOCK, true);
  }

  function buildDesertTemple(tx, tz) {
    const baseY = Math.max(WATER_LEVEL + 1, colGroundY(tx, tz + 7));
    for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
      for (let wy = 1; wy <= 13; wy++) setBlockWorld(tx + dx, baseY + wy, tz + dz, B.AIR, true);
      for (let y = colGroundY(tx + dx, tz + dz); y <= baseY; y++) setBlockWorld(tx + dx, y, tz + dz, B.SANDSTONE, true);
    }
    // Monumental Stepped Sandstone Pyramid w/ Terracotta Inlays
    for (let step = 0; step < 7; step++) {
      const r = 6 - step;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const edge = (Math.abs(dx) === r || Math.abs(dz) === r);
        if (edge || step === 6) {
          const isBand = (step === 2 || step === 4) && ((dx + dz) & 1) === 0;
          setBlockWorld(tx + dx, baseY + 1 + step, tz + dz, isBand ? B.TERRACOTTA : B.SANDSTONE, true);
        }
      }
    }
    // Twin Flanking Obelisk Guardian Towers!
    for (const sx of [-6, 6]) {
      for (let wy = 1; wy <= 9; wy++) for (let dz = 4; dz <= 6; dz++) for (let dx = sx - 1; dx <= sx + 1; dx++) {
        const isEdge = (dx === sx - 1 || dx === sx + 1 || dz === 4 || dz === 6);
        if (isEdge || wy === 9) setBlockWorld(tx + dx, baseY + wy, tz + dz, (wy === 4 || wy === 7) ? B.TERRACOTTA : B.SANDSTONE, true);
      }
      setBlockWorld(tx + sx, baseY + 10, tz + 5, B.TORCH_BLOCK, true);
    }
    // Grand Entry Portal + Interior Shrine
    for (let wy = 1; wy <= 4; wy++) for (let dx = -1; dx <= 1; dx++) setBlockWorld(tx + dx, baseY + wy, tz + 6, B.AIR, true);
    for (let wy = 1; wy <= 4; wy++) for (let dx = -1; dx <= 1; dx++) setBlockWorld(tx + dx, baseY + wy, tz + 5, B.AIR, true);
    setBlockWorld(tx, baseY + 8, tz, B.GLOW_CRYSTAL, true);
    setBlockWorld(tx, baseY + 9, tz, B.TORCH_BLOCK, true);
    setBlockWorld(tx, baseY + 2, tz, B.GOLD_ORE, true);
    setBlockWorld(tx, baseY + 3, tz, B.TORCH_BLOCK, true);
    buildDoorAccessStairs(tx, baseY, tz + 6, 0, 1, B.SANDSTONE, 1);
  }

  function buildLushCaveGrotto(gx, gz) {
    const gcx = gx >> 4, gcz = gz >> 4;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (!chunks.has(chunkKey(gcx + dx, gcz + dz))) generateChunk(gcx + dx, gcz + dz);
    }
    const floorY = -14, radX = 9, radZ = 9, ceilH = 9;
    for (let dz = -radZ; dz <= radZ; dz++) for (let dx = -radX; dx <= radX; dx++) {
      const dist = Math.hypot(dx / radX, dz / radZ);
      if (dist > 1.05) continue;
      const wx = gx + dx, wz = gz + dz;
      const localH = Math.max(3, Math.round(ceilH * (1.0 - dist * dist * 0.65)));
      // Carve vaulted lush grotto chamber
      for (let dy = 0; dy <= localH; dy++) setBlockWorld(wx, floorY + dy, wz, B.AIR, true);
      // Mossy floor & central glowing underground pool
      if (dist < 0.42) {
        setBlockWorld(wx, floorY - 2, wz, B.STONE_BRICK, true);
        setBlockWorld(wx, floorY - 1, wz, B.WATER, true);
        if (((dx * 7 + dz * 13) & 3) === 0) setBlockWorld(wx, floorY, wz, B.LILY_PAD, true);
      } else {
        setBlockWorld(wx, floorY - 1, wz, B.GRASS, true);
        const r = hash2i(wx, wz, worldSeed + 881);
        if (r > 0.88) setBlockWorld(wx, floorY, wz, B.MUSHROOM_GLOW, true);
        else if (r > 0.72) setBlockWorld(wx, floorY, wz, B.TALL_GRASS, true);
        else if (r > 0.64) setBlockWorld(wx, floorY, wz, B.FLOWER_YELLOW, true);
        else if (r > 0.58) setBlockWorld(wx, floorY, wz, B.SAKURA_PETALS, true);
      }
      // Hanging leaf vines & glowing crystal stalactites from ceiling!
      const vc = hash2i(wx + 11, wz - 17, worldSeed + 991);
      if (dist > 0.25 && vc > 0.78) {
        const vLen = 1 + Math.floor((vc - 0.78) * 18);
        for (let k = 0; k < Math.min(vLen, localH - 2); k++) {
          setBlockWorld(wx, floorY + localH - k, wz, (k === 0 && vc > 0.93) ? B.GLOW_CRYSTAL : B.OAK_LEAVES, true);
        }
      }
    }
    // Natural sunlight skylight shaft & mossy stepping bridge + perimeter warm cave lanterns
    const surfY = Math.max(WATER_LEVEL + 2, colGroundY(gx, gz));
    for (let y = floorY + ceilH; y <= surfY + 2; y++) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setBlockWorld(gx + dx, y, gz + dz, B.AIR, true);
    }
    for (const [lx, lz] of [[-5,-4],[5,-4],[-5,4],[5,4]]) {
      setBlockWorld(gx + lx, floorY, gz + lz, B.STONE_BRICK, true);
      setBlockWorld(gx + lx, floorY + 1, gz + lz, B.TORCH_BLOCK, true);
    }
    // Gentle Moss Golem guardian in peaceful skylight Lush Cave (Wardens only spawn in Deep Dark via Sculk Shriekers!)
    spawnMobOfType('moss_golem', gx, floorY + 1.0, gz - 5.5);
    return floorY;
  }

  function landPlayerScenic(targetX, targetZ, preferYaw = null) {
    const scx = Math.floor(targetX) >> 4, scz = Math.floor(targetZ) >> 4;
    const radGen = isWorldLoading ? 1 : 2;
    for (let dz = -radGen; dz <= radGen; dz++) for (let dx = -radGen; dx <= radGen; dx++) {
      const k = chunkKey(scx + dx, scz + dz);
      if (!chunks.has(k)) generateChunk(scx + dx, scz + dz);
    }
    const yawCands = preferYaw !== null ? [preferYaw] : [];
    for (let a = 0; a < 12; a++) yawCands.push((a / 12) * Math.PI * 2);
    let bestSpot = null, bestScore = -1e9;
    for (let rad = 0; rad <= 6 && bestScore < 95; rad++) {
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) !== rad && Math.abs(dz) !== rad) continue;
        const wx = Math.floor(targetX) + dx, wz = Math.floor(targetZ) + dz;
        const top = findSurfaceTopY(wx, wz);
        const def = BLOCK_DEF[top.id];
        if (top.y <= WATER_LEVEL || !def || !def.solid || def.foliage || top.id === B.CACTUS || top.id === B.OAK_LOG || top.id === B.SAKURA_LOG || top.id === B.SPRUCE_LOG) continue;
        // Require full 3x3 open sky headroom (hy = 1..5) so zero overhanging leaves/branches clip top edge
        let fullHeadroom = true;
        for (let oz = -1; oz <= 1 && fullHeadroom; oz++) for (let ox = -1; ox <= 1 && fullHeadroom; ox++) {
          for (let hy = 1; hy <= 5; hy++) {
            if (isSolidAt(wx + ox, top.y + hy, wz + oz)) { fullHeadroom = false; break; }
          }
        }
        if (!fullHeadroom) continue;
        const eyeY = top.y + 1.1 + EYE_HEIGHT;
        for (const yaw of yawCands) {
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
          let clearDist = 0;
          for (let d = 1; d <= 22; d++) {
            const sx = Math.floor(wx + 0.5 + fx * d), sz = Math.floor(wz + 0.5 + fz * d);
            if (isSolidAt(sx, Math.floor(eyeY), sz) || isSolidAt(sx, Math.floor(eyeY + 1.5), sz)) break;
            clearDist = d;
          }
          if (clearDist < 7) continue;
          let sc = clearDist * 3.5 - rad * 1.5;
          for (let d = 3; d <= 12; d += 3) {
            const sx = Math.floor(wx + 0.5 + fx * d), sz = Math.floor(wz + 0.5 + fz * d);
            if (getBlockWorld(sx, WATER_LEVEL, sz) === B.WATER) sc += 14;
          }
          if (preferYaw !== null) {
            const diff = Math.abs(Math.atan2(Math.sin(yaw - preferYaw), Math.cos(yaw - preferYaw)));
            sc += Math.max(0, 1 - diff / Math.PI) * 32;
          }
          if (sc > bestScore) { bestScore = sc; bestSpot = { x: wx + 0.5, y: top.y + 1.1, z: wz + 0.5, yaw }; }
        }
      }
    }
    if (!bestSpot) {
      const tTop = findSurfaceTopY(Math.floor(targetX), Math.floor(targetZ));
      bestSpot = { x: Math.floor(targetX) + 0.5, y: Math.max(WATER_LEVEL + 2, tTop.y + 1.2), z: Math.floor(targetZ) + 0.5, yaw: preferYaw || -0.45 };
    }
    if (!isWorldLoading) {
      // Quick Pack + ModernFix: during initial lobby title-screen boot, mesh only the central chunk synchronously and stream panorama rings in background!
      if (!isPlaying && document.body.classList.contains('in-lobby')) {
        const c0 = chunks.get(chunkKey(Math.floor(bestSpot.x) >> 4, Math.floor(bestSpot.z) >> 4));
        if (c0 && c0.dirty) rebuildChunkMesh(c0);
      } else {
        for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
      }
    }
    return bestSpot;
  }

  // =========================================================================
  // v42 PORTAL ENGINE: Strongholds, Nether Portal (8x travel), End Portal & Eye of Ender
  // =========================================================================
  let _portalCooldown = 0;
  const _elNetherPortalOv = document.getElementById('netherPortalOverlay');
  const flyingEnderEyes = [];

  // === v43 Abandoned Ruins & Rising Indestructible Dream Portal (Cổng Giấc Mơ) ===
  const _elDreamPortalOv = document.getElementById('dreamPortalOverlay');
  const _awakenedRuins = new Set();
  const _activeRuinEncounters = new Map();
  const _risingDreamPortals = [];

  let _ruinLocSeed = -1, _ruinLocCache = null, _ruinOriginX = 0, _ruinOriginZ = 0;
  function getDreamRuinLocations() {
    const s = (typeof worldSeed === 'number' ? worldSeed : 1337);
    if (_ruinLocCache && _ruinLocSeed === s) return _ruinLocCache;
    const out = [];
    const dists = [48, 145, 235, 310];
    for (let i = 0; i < dists.length; i++) {
      const ang = ((s * 0.0029 + i * 1.570796 + 0.45) % (Math.PI * 2));
      const rx = Math.round(_ruinOriginX + Math.cos(ang) * dists[i]);
      const rz = Math.round(_ruinOriginZ + Math.sin(ang) * dists[i]);
      out.push({ id: `ruin_${i}`, x: rx, y: 12, z: rz });
    }
    _ruinLocSeed = s; _ruinLocCache = out;
    return out;
  }
  function stampDreamRuinAltar(rn) {
    if (!rn || currentDimension !== 'overworld') return;
    const rcx0 = (rn.x - 8) >> 4, rcx1 = (rn.x + 8) >> 4;
    const rcz0 = (rn.z - 8) >> 4, rcz1 = (rn.z + 8) >> 4;
    for (let cz = rcz0; cz <= rcz1; cz++) for (let cx = rcx0; cx <= rcx1; cx++) {
      if (!chunks.has(chunkKey(cx, cz))) generateChunk(cx, cz);
    }
    const baseY = Math.max(WATER_LEVEL + 1, getTerrainHeight(rn.x, rn.z, getBiomeAt(rn.x, rn.z)));
    rn.y = baseY;
    for (let rz = -7; rz <= 7; rz++) {
      for (let rx = -7; rx <= 7; rx++) {
        if (Math.hypot(rx, rz) > 7.4) continue;
        const wx = rn.x + rx, wz = rn.z + rz;
        setBlockWorld(wx, baseY - 1, wz, B.STONE_BRICK, true);
        setBlockWorld(wx, baseY, wz, ((Math.abs(rx) + Math.abs(rz)) % 3 === 0) ? B.MOSS_BLOCK : B.STONE_BRICK, true);
        for (let ay = 1; ay <= 8; ay++) setBlockWorld(wx, baseY + ay, wz, B.AIR, true);
        if (Math.abs(rx) === 5 && Math.abs(rz) === 5) {
          const ph = 4 + ((rx + rz) & 1);
          for (let py = 1; py <= ph; py++) setBlockWorld(wx, baseY + py, wz, B.STONE_BRICK, true);
          setBlockWorld(wx, baseY + ph + 1, wz, B.LANTERN, true);
        }
        if (Math.abs(rx) <= 2 && Math.abs(rz) <= 1) {
          setBlockWorld(wx, baseY + 1, wz, B.STONE_BRICK, true);
        }
      }
    }
    for (const _ch of chunks.values()) if (_ch.dirty) rebuildChunkMesh(_ch);
  }

  function startRisingDreamPortal(cx, baseY, cz, instant = false) {
    if (instant) {
      for (let dx = -4; dx <= 4; dx++) {
        setBlockWorld(cx + dx, baseY + 1, cz, B.DREAM_PORTAL_FRAME, true);
        setBlockWorld(cx + dx, baseY + 11, cz, B.DREAM_PORTAL_FRAME, true);
      }
      for (let dy = 2; dy <= 10; dy++) {
        setBlockWorld(cx - 4, baseY + dy, cz, B.DREAM_PORTAL_FRAME, true);
        setBlockWorld(cx + 4, baseY + dy, cz, B.DREAM_PORTAL_FRAME, true);
        for (let dx = -3; dx <= 3; dx++) setBlockWorld(cx + dx, baseY + dy, cz, B.DREAM_PORTAL, true);
      }
      for (let dy = 1; dy <= 8; dy++) {
        setBlockWorld(cx - 5, baseY + dy, cz, B.PURPUR_PILLAR, true);
        setBlockWorld(cx + 5, baseY + dy, cz, B.PURPUR_PILLAR, true);
      }
      setBlockWorld(cx - 5, baseY + 9, cz, B.GLOW_CRYSTAL, true);
      setBlockWorld(cx + 5, baseY + 9, cz, B.GLOW_CRYSTAL, true);
      setBlockWorld(cx - 4, baseY + 12, cz, B.GLOW_CRYSTAL, true);
      setBlockWorld(cx + 4, baseY + 12, cz, B.GLOW_CRYSTAL, true);
      setBlockWorld(cx, baseY + 12, cz, B.GLOW_CRYSTAL, true);
      return;
    }
    _risingDreamPortals.push({ cx, baseY, cz, step: 0, timer: 0 });
    playSfx('roar');
    showToast("🌈 TÀN TÍCH ĐÃ SẠCH QUÁI! ĐẠI CỔNG GIẤC MƠ (GIANT SIFT PORTAL) ĐANG TRỒI LÊN!");
  }

  function updateDreamRuinsAndPortals(dt) {
    // Animate rising Giant 9x11 Dream Portal layer-by-layer!
    for (let i = _risingDreamPortals.length - 1; i >= 0; i--) {
      const rp = _risingDreamPortals[i];
      rp.timer += dt;
      if (rp.timer >= 0.14) {
        rp.timer = 0;
        const dy = rp.step + 1;
        if (dy === 1 || dy === 11) {
          for (let dx = -4; dx <= 4; dx++) setBlockWorld(rp.cx + dx, rp.baseY + dy, rp.cz, B.DREAM_PORTAL_FRAME, true);
          if (dy === 1) {
            setBlockWorld(rp.cx - 5, rp.baseY + 1, rp.cz, B.PURPUR_PILLAR, true);
            setBlockWorld(rp.cx + 5, rp.baseY + 1, rp.cz, B.PURPUR_PILLAR, true);
          } else {
            setBlockWorld(rp.cx - 4, rp.baseY + 12, rp.cz, B.GLOW_CRYSTAL, true);
            setBlockWorld(rp.cx + 4, rp.baseY + 12, rp.cz, B.GLOW_CRYSTAL, true);
            setBlockWorld(rp.cx, rp.baseY + 12, rp.cz, B.GLOW_CRYSTAL, true);
          }
        } else if (dy >= 2 && dy <= 10) {
          setBlockWorld(rp.cx - 4, rp.baseY + dy, rp.cz, B.DREAM_PORTAL_FRAME, true);
          setBlockWorld(rp.cx + 4, rp.baseY + dy, rp.cz, B.DREAM_PORTAL_FRAME, true);
          if (dy <= 8) {
            setBlockWorld(rp.cx - 5, rp.baseY + dy, rp.cz, B.PURPUR_PILLAR, true);
            setBlockWorld(rp.cx + 5, rp.baseY + dy, rp.cz, B.PURPUR_PILLAR, true);
          } else if (dy === 9) {
            setBlockWorld(rp.cx - 5, rp.baseY + 9, rp.cz, B.GLOW_CRYSTAL, true);
            setBlockWorld(rp.cx + 5, rp.baseY + 9, rp.cz, B.GLOW_CRYSTAL, true);
          }
          for (let dx = -3; dx <= 3; dx++) setBlockWorld(rp.cx + dx, rp.baseY + dy, rp.cz, B.DREAM_PORTAL, true);
        }
        spawnParticles(rp.cx + 0.5, rp.baseY + dy + 0.5, rp.cz + 0.5, 0x67e8f9, 14, true);
        spawnParticles(rp.cx + 0.5, rp.baseY + dy + 0.5, rp.cz + 0.5, 0xf472b6, 14, true);
        playSfx('equip');
        rp.step++;
        if (rp.step >= 11) {
          _risingDreamPortals.splice(i, 1);
          showToast('✨ ĐẠI CỔNG GIẤC MƠ ĐÃ MỞ! Bước vào màn sáng cầu vồng để tới THE SIFT!');
        }
      }
    }

    // Trigger Abandoned Ruin guardian encounter in Overworld
    if (currentDimension !== 'overworld') return;
    const ruins = getDreamRuinLocations();
    for (const rn of ruins) {
      if (_awakenedRuins.has(rn.id)) continue;
      const dist = Math.hypot(player.x - rn.x, player.z - rn.z);
      if (dist < 36 && !rn._stamped) { stampDreamRuinAltar(rn); rn._stamped = true; }
      if (!_activeRuinEncounters.has(rn.id) && dist < 24) {
        const baseY = Math.max(WATER_LEVEL + 1, getTerrainHeight(rn.x, rn.z, getBiomeAt(rn.x, rn.z)));
        rn.y = baseY;
        const gTypes = ['ruin_stalker', 'gargoyle', 'skeleton', 'pillager'];
        const spawned = [];
        for (let k = 0; k < gTypes.length; k++) {
          const a = (k / gTypes.length) * Math.PI * 2;
          const m = spawnMobOfType(gTypes[k], rn.x + Math.cos(a) * 4.5, baseY + 1.5, rn.z + Math.sin(a) * 4.5);
          if (m) { m.ruinId = rn.id; spawned.push(m); }
        }
        _activeRuinEncounters.set(rn.id, { rn, count: spawned.length });
        showToast(`🏛️ TÀN TÍCH BỎ HOANG! Hạ gục ${spawned.length} quái bảo vệ để đánh thức Cổng Giấc Mơ!`);
      } else if (_activeRuinEncounters.has(rn.id)) {
        let alive = 0;
        for (let mi = 0; mi < mobs.length; mi++) if (mobs[mi].ruinId === rn.id && mobs[mi].hp > 0) alive++;
        const enc = _activeRuinEncounters.get(rn.id);
        if (alive < enc.count) {
          enc.count = alive;
          if (alive > 0) showToast(`⚔️ Còn ${alive} quái bảo vệ tại Tàn Tích Bỏ Hoang...`);
        }
        if (alive === 0) {
          _activeRuinEncounters.delete(rn.id);
          _awakenedRuins.add(rn.id);
          startRisingDreamPortal(enc.rn.x, enc.rn.y, enc.rn.z, false);
        }
      }
    }
  }

  function stampAncientCityInChunk(data, wx0, wz0, dOff = 0, maxLy = 0) {
    if (currentDimension !== 'overworld') return maxLy;
    const cities = getAncientCityLocations();
    const put = (lx, wy, lz, id) => {
      const ly = wy - MIN_Y;
      if (lx < 0 || lx >= CHUNK_W || lz < 0 || lz >= CHUNK_W || ly < 1 || ly >= WORLD_H - 1) return;
      const trueY = wy - dOff;
      if (trueY <= -1001 && trueY >= -1010) return;
      data[(ly << 8) | (lz << 4) | lx] = id;
      if (ly > maxLy) maxLy = ly;
    };
    const putChest = (lx, wy, lz, wx, wz) => {
      put(lx, wy, lz, B.CHEST);
      naturalChestTags.set(modKey(wx, wy - dOff, wz), 'ancient_city');
    };
    for (let ci = 0; ci < cities.length; ci++) {
      const ac = cities[ci];
      if (Math.abs(wx0 + 8 - ac.x) > 46 || Math.abs(wz0 + 8 - ac.z) > 46) continue;
      const baseY = ac.y + dOff; // Local Y corresponding to trueY = -52
      if (baseY + 35 < MIN_Y + 2 || baseY - 8 > MAX_Y - 2) continue;

      for (let rz = -34; rz <= 34; rz++) {
        const wz = ac.z + rz, lz = wz - wz0;
        if (lz < 0 || lz >= CHUNK_W) continue;
        for (let rx = -34; rx <= 34; rx++) {
          const wx = ac.x + rx, lx = wx - wx0;
          if (lx < 0 || lx >= CHUNK_W) continue;
          const ax = Math.abs(rx), az = Math.abs(rz);
          const domeR = Math.hypot(rx / 35, rz / 35);
          if (domeR >= 1.0) continue;

          const ceilRy = Math.max(12, Math.round(33 - domeR * domeR * 18 - (hash2i(wx, wz, worldSeed + 701) * 4 | 0)));
          const slopeRy = domeR > 0.72 ? Math.round((domeR - 0.72) * 14) : 0;
          const patchNoise = fbm2D(wx * 0.14, wz * 0.14, 2, 0.5, 2.0, worldSeed + 911);
          const inPlaza = (ax <= 24 && az <= 24 && domeR < 0.78);
          const inAvenueWool = (ax <= 1 && rz >= -1 && rz <= 26);
          const inVault = (ax <= 5 && rz >= -15 && rz <= -8);
          const inVaultStair = (rx === 0 && rz >= -18 && rz <= -16);

          // 1) Cavern Carving & Floor/Roof + Secret Basement Vault beneath Citadel
          for (let ry = -7; ry <= ceilRy + 2; ry++) {
            const wy = baseY + ry;
            if (wy <= MIN_Y || wy >= MAX_Y) continue;
            if (ry <= -1) {
              if (inVault && ry >= -6 && ry <= -2) {
                if (ry === -6) put(lx, wy, lz, (ax <= 1 && az <= 12) ? B.CYAN_WOOL : B.GRAY_WOOL);
                else if (ry === -2 || ax === 5 || rz === -15 || rz === -8) put(lx, wy, lz, ((rx + rz) & 1) ? B.DEEPSLATE_TILES : B.DEEPSLATE_BRICKS);
                else put(lx, wy, lz, B.AIR);
              } else if (inVaultStair && ry >= -6 + ((-rz - 15) * 1.5 | 0) && ry <= -1) {
                put(lx, wy, lz, ry === -1 ? B.DEEPSLATE_BRICKS : B.AIR);
              } else {
                put(lx, wy, lz, ry <= -4 ? B.DEEPSLATE : ((patchNoise > 0.66 && !inPlaza) ? B.SCULK : B.DEEPSLATE));
              }
              continue;
            }
            if (ry >= ceilRy) {
              put(lx, wy, lz, patchNoise > 0.62 ? B.SCULK : B.DEEPSLATE);
              continue;
            }
            if (ry === ceilRy - 1 && hash2i(wx * 3, wz * 5, worldSeed + 709) > 0.90 && domeR > 0.35) {
              put(lx, wy, lz, B.DEEPSLATE_WALL);
              continue;
            }
            if (ry < slopeRy) {
              put(lx, wy, lz, (ry === slopeRy - 1 && patchNoise > 0.50) ? B.SCULK : B.DEEPSLATE);
              continue;
            }
            if (ry === slopeRy) {
              if (inAvenueWool) put(lx, wy, lz, rx === 0 ? B.CYAN_WOOL : B.GRAY_WOOL);
              else if (ax <= 2 && rz >= -1 && rz <= 26) put(lx, wy, lz, B.DEEPSLATE_BRICKS);
              else if (Math.abs(rz - 7) <= 1 && ax <= 24 && Math.abs(rx) > 2) put(lx, wy, lz, rz === 7 ? B.GRAY_WOOL : B.DEEPSLATE_BRICKS);
              else if (inPlaza) {
                put(lx, wy, lz, patchNoise > 0.66 ? B.SCULK : (((ax + az) & 2) === 0 ? B.DEEPSLATE_TILES : B.DEEPSLATE_BRICKS));
              } else {
                put(lx, wy, lz, patchNoise > 0.44 ? B.SCULK : B.DEEPSLATE);
              }
              continue;
            }
            put(lx, wy, lz, B.AIR);
          }

          // Secret Vault Props (2 guarded loot chests + sculk sensor & redstone circuit hint)
          if (inVault && ryCheckInRange(baseY - 5)) {
            if ((rx === -2 || rx === 2) && rz === -11) putChest(lx, baseY - 5, lz, wx, wz);
            if (rx === 0 && rz === -10) put(lx, baseY - 5, lz, B.REDSTONE);
            if (rx === 0 && rz === -12) put(lx, baseY - 5, lz, B.SCULK_SENSOR);
            if ((rx === -4 || rx === 4) && rz === -14) put(lx, baseY - 5, lz, B.CANDLE);
            if (rx === 0 && rz === -13) put(lx, baseY - 3, lz, B.SOUL_LANTERN);
          }

          // 2) Central Monument Citadel: Podium, Soul Fire Trench, Giant Reinforced Deepslate Portal & Warden Head Crown
          if (rz >= -6 && rz <= -2 && ax <= 12) {
            if (rz <= -3 && ax <= 11) put(lx, baseY + 1, lz, B.DEEPSLATE_BRICKS);
            if (rz <= -5 && ax <= 10) put(lx, baseY + 2, lz, B.DEEPSLATE_TILES);
            if (rz === -3 && (ax === 4 || ax === 8)) put(lx, baseY + 2, lz, B.CANDLE);
            if (rz === -5 && (ax === 3 || ax === 7)) put(lx, baseY + 3, lz, B.CANDLE);
          }
          if (rz === -7 && ax <= 9) {
            put(lx, baseY + 2, lz, B.SOUL_SAND);
            put(lx, baseY + 3, lz, B.SOUL_FIRE);
          }
          if (rz >= -11 && rz <= -8 && ax <= 13) {
            // Base bastion wall supporting portal citadel
            for (let ry = 1; ry <= 3; ry++) {
              if (ax <= 11 && (rz >= -10 || ry <= 2)) put(lx, baseY + ry, lz, ry === 3 ? B.DEEPSLATE_TILES : B.DEEPSLATE_BRICKS);
            }
            if (rz === -9 && ax <= 10) {
              for (let ry = 4; ry <= 12; ry++) {
                const isFrame = (ry === 4 || ry === 12 || ax === 10);
                put(lx, baseY + ry, lz, isFrame ? B.REINFORCED_DEEPSLATE : B.AIR);
              }
            } else if ((rz === -10 || rz === -8) && ax >= 10 && ax <= 12) {
              for (let ry = 4; ry <= 13; ry++) {
                if (rz === -8 && (ry & 3) === 0 && ax === 11) put(lx, baseY + ry, lz, B.DEEPSLATE_TILES);
                else if (rz === -10) put(lx, baseY + ry, lz, B.DEEPSLATE_BRICKS);
              }
            }
            // Warden Head Arch above Portal (ry = 13..21)
            if (rz === -9 && ax <= 9) {
              for (let ry = 13; ry <= 20; ry++) {
                const isMouthVoid = (ax <= 4 && ry >= 14 && ry <= 16);
                if (isMouthVoid) put(lx, baseY + ry, lz, B.AIR);
                else if (ry === 13 || ry === 20 || ax >= 8) put(lx, baseY + ry, lz, B.DEEPSLATE_TILES);
                else put(lx, baseY + ry, lz, (ry === 17 && ax <= 5) ? B.DEEPSLATE_BRICKS : B.SCULK);
              }
            } else if (rz === -10 && ax <= 8) {
              for (let ry = 13; ry <= 19; ry++) put(lx, baseY + ry, lz, B.SCULK);
            }
            // Iconic Warden Cyan Ear Tendrils flanking citadel head
            if (rz === -9 && ax >= 11 && ax <= 13) {
              for (let ry = 16; ry <= 22; ry++) {
                const isHorn = (ax === 11 && (ry === 17 || ry === 18)) || (ax === 12 && (ry >= 18 && ry <= 21)) || (ax === 13 && (ry === 16 || ry === 19 || ry === 22));
                if (isHorn) put(lx, baseY + ry, lz, ry >= 21 ? B.SOUL_LANTERN : B.SCULK_SENSOR);
              }
            }
          }

          // 3) Grand Avenue Soul-Lantern Pillars & Elevated Viaduct Bridge
          if (ax === 3 && (rz === 2 || rz === 10 || rz === 20 || rz === 26)) {
            for (let ry = 1; ry <= 5; ry++) put(lx, baseY + ry, lz, ry === 5 ? B.DEEPSLATE_TILES : B.DEEPSLATE_BRICKS);
          } else if (ax === 2 && (rz === 2 || rz === 10 || rz === 20 || rz === 26)) {
            put(lx, baseY + 5, lz, B.DEEPSLATE_TILES);
            put(lx, baseY + 4, lz, B.SOUL_LANTERN);
          }
          if (rz >= 12 && rz <= 15 && ax <= 20) {
            const isRail = (rz === 12 || rz === 15);
            const isPillar = isRail && ((rx + 20) % 8 === 0);
            if (isPillar) {
              for (let ry = 1; ry <= 8; ry++) put(lx, baseY + ry, lz, B.DEEPSLATE_BRICKS);
            }
            put(lx, baseY + 9, lz, isRail ? B.DEEPSLATE_TILES : (ax <= 18 ? B.GRAY_WOOL : B.DEEPSLATE_BRICKS));
            if (isRail && ((rx + 20) & 3) === 0) put(lx, baseY + 10, lz, B.DEEPSLATE_WALL);
            if (isRail && ((rx + 20) % 8 === 4)) put(lx, baseY + 8, lz, B.SOUL_LANTERN);
          }

          // 4) Flanking Watchtowers at (-19, -8) & (19, -8)
          for (const twx of [-19, 19]) {
            const tx = rx - twx, tz = rz - (-8);
            if (Math.abs(tx) <= 2 && Math.abs(tz) <= 2) {
              const isWall = (Math.abs(tx) === 2 || Math.abs(tz) === 2);
              const isDoor = (tz === 2 && tx === 0);
              for (let ry = 1; ry <= 22; ry++) {
                if (isWall && !(isDoor && ry <= 3) && (ry < 22 || ((tx + tz) & 1) === 0)) {
                  put(lx, baseY + ry, lz, (ry & 3) === 0 ? B.DEEPSLATE_BRICKS : B.DEEPSLATE_TILES);
                } else if (ry === 8 || ry === 15) {
                  put(lx, baseY + ry, lz, B.DEEPSLATE_BRICKS);
                }
              }
              if (tx === 0 && tz === 0) {
                putChest(lx, baseY + 1, lz, wx, wz);
                put(lx, baseY + 21, lz, B.SOUL_LANTERN);
              } else if (Math.abs(tx) === 2 && Math.abs(tz) === 2) {
                put(lx, baseY + 18, lz, B.SOUL_LANTERN);
              }
            }
          }

          // 5) Ice Box (-14, 18) & Loot Shrines ((14, 17), (-15, 2), (15, 2))
          if (rx >= -16 && rx <= -12 && rz >= 16 && rz <= 20) {
            const isRim = (rx === -16 || rx === -12 || rz === 16 || rz === 20);
            for (let ry = 1; ry <= 4; ry++) {
              if (ry === 4) put(lx, baseY + ry, lz, B.DEEPSLATE_TILES);
              else if (isRim && !(rz === 16 && rx === -14 && ry <= 2)) put(lx, baseY + ry, lz, B.DEEPSLATE_BRICKS);
            }
            if (!isRim) {
              put(lx, baseY, lz, B.PACKED_ICE);
              if (rx === -13 && rz === 18) put(lx, baseY + 1, lz, B.SNOW);
              if (rx === -14 && rz === 18) putChest(lx, baseY + 1, lz, wx, wz);
            }
          }
          for (const [sx, sz] of [[14, 17], [-15, 2], [15, 2]]) {
            const dx = rx - sx, dz = rz - sz;
            if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
                for (let ry = 1; ry <= 4; ry++) put(lx, baseY + ry, lz, B.DEEPSLATE_BRICKS);
                put(lx, baseY + 5, lz, B.CANDLE);
              }
              if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) put(lx, baseY, lz, B.DEEPSLATE_TILES);
              if (dx === 0 && dz === 0) putChest(lx, baseY + 1, lz, wx, wz);
              if (dx === 1 && dz === -1) put(lx, baseY + 1, lz, B.SCULK_SHRIEKER);
              if (dx === -1 && dz === 1) put(lx, baseY + 1, lz, B.SCULK_SENSOR);
            }
          }

          // 6) Subterranean Waterfall at (17, -19) cascading from high cavern roof into glowing pool
          const wfDist = Math.hypot(rx - 17, rz + 19);
          if (wfDist <= 3.3 && ceilRy > 10) {
            if (wfDist <= 1.2) {
              for (let ry = 0; ry <= Math.min(28, ceilRy - 1); ry++) put(lx, baseY + ry, lz, B.WATER);
              put(lx, baseY - 1, lz, (rx === 17 && rz === -19) ? B.SEA_LANTERN : B.PRISMARINE);
            } else {
              put(lx, baseY - 1, lz, B.DEEPSLATE);
              put(lx, baseY, lz, B.WATER);
            }
          }

          // 7) Organic Sculk Catalyst / Sensor / Shrieker / Vein Scatter across ruined margins
          if (slopeRy === 0 && !inAvenueWool && ax > 3 && !(rz >= -11 && rz <= -2 && ax <= 13) && !(rz >= 12 && rz <= 15 && ax <= 20)) {
            const sh = hash3i(wx, baseY, wz, worldSeed + 977);
            const curFloor = (baseY - MIN_Y >= 1 && baseY - MIN_Y < WORLD_H - 2) ? data[((baseY - MIN_Y) << 8) | (lz << 4) | lx] : 0;
            if (curFloor === B.SCULK) {
              const aboveLy = (baseY + 1) - MIN_Y;
              if (aboveLy > 1 && aboveLy < WORLD_H - 1 && data[(aboveLy << 8) | (lz << 4) | lx] === B.AIR) {
                if (sh > 0.986) put(lx, baseY + 1, lz, B.SCULK_SHRIEKER);
                else if (sh > 0.962) put(lx, baseY + 1, lz, B.SCULK_SENSOR);
                else if (sh > 0.944) put(lx, baseY, lz, B.SCULK_CATALYST);
                else if (sh > 0.78) put(lx, baseY + 1, lz, B.SCULK_VEIN);
              }
            }
          }
        }
      }
    }
    return maxLy;
    function ryCheckInRange(wy) { return wy > MIN_Y && wy < MAX_Y; }
  }

  let _shLocSeed = -1, _shLocCache = null;
  function getStrongholdLocations() {
    const s = (typeof worldSeed === 'number' ? worldSeed : 1337);
    if (_shLocCache && _shLocSeed === s) return _shLocCache;
    const out = [{ x: GRAND_RUINS_CX, y: GRAND_RUINS_PORTAL_Y, z: GRAND_RUINS_CZ, inGrandRuins: true }];
    _shLocSeed = s; _shLocCache = out;
    return out;
  }

  function stampStrongholdCitadelInChunk(data, wx0, wz0, dOff = 0, maxLy = 0) {
    const strongholds = getStrongholdLocations();
    const put = (lx, wy, lz, id) => {
      const ly = wy - MIN_Y;
      if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_W && ly >= 1 && ly < WORLD_H - 1) {
        data[(ly << 8) | (lz << 4) | lx] = id;
      }
    };
    const ruinBrick = (wx, wy, wz) => {
      const h = hash3i(wx, wy, wz, worldSeed + 4903);
      return h > 0.84 ? B.MOSS_BLOCK : (h > 0.68 ? B.DEEPSLATE : B.STONE_BRICK);
    };
    for (let si = 0; si < strongholds.length; si++) {
      const sh = strongholds[si];
      if (sh.inGrandRuins) continue;
      if (Math.abs(wx0 + 8 - sh.x) > 26 || Math.abs(wz0 + 8 - sh.z) > 26) continue;
      const baseY = sh.y + dOff; // Local wy corresponding to trueY = sh.y (-26)
      if (baseY + 13 < MIN_Y + 2 || baseY - 3 > MAX_Y - 2) continue;

      for (let rz = -16; rz <= 16; rz++) {
        const wz = sh.z + rz, lz = wz - wz0;
        if (lz < 0 || lz >= CHUNK_W) continue;
        for (let rx = -16; rx <= 16; rx++) {
          const wx = sh.x + rx, lx = wx - wx0;
          if (lx < 0 || lx >= CHUNK_W) continue;
          const ax = Math.abs(rx), az = Math.abs(rz);

          // Determine which wing/hall of the 33x33 Underground Ruined Stronghold Castle this column belongs to:
          const inKeep = (ax <= 7 && az <= 7);
          const inNorthWing = (ax <= 5 && rz >= -16 && rz <= -7);
          const inSouthWing = (ax <= 5 && rz >= 7 && rz <= 16);
          const inWestWing = (az <= 5 && rx >= -16 && rx <= -7);
          const inEastWing = (az <= 5 && rx >= 7 && rx <= 16);
          const inCornerTurret = (ax >= 6 && ax <= 9 && az >= 6 && az <= 9);
          if (!inKeep && !inNorthWing && !inSouthWing && !inWestWing && !inEastWing && !inCornerTurret) continue;

          const topRy = inKeep ? 8 : (inCornerTurret ? 9 : 6);
          const isKeepDoor = ((ax === 7 && az <= 1) || (az === 7 && ax <= 1));
          const isOuterWall = inCornerTurret
            ? (ax === 9 || az === 9 || ((ax === 6 || az === 6) && !inKeep))
            : (inKeep ? ((ax === 7 || az === 7) && !isKeepDoor)
              : ((inNorthWing && (ax === 5 || rz === -16)) ||
                 (inSouthWing && (ax === 5 || rz === 16)) ||
                 (inWestWing && (az === 5 || rx === -16)) ||
                 (inEastWing && (az === 5 || rx === 16))));

          // 1) Solid underground foundation & roof vault (prevents floating in caverns/ravines)
          for (let ry = -3; ry <= topRy + 1; ry++) {
            const wy = baseY + ry;
            if (wy <= MIN_Y + 1 || wy >= MAX_Y - 1) continue;
            const trueWy = sh.y + ry;
            let bid = B.AIR;

            if (ry <= -2) {
              bid = (ry === -3) ? B.DEEPSLATE : ruinBrick(wx, trueWy, wz);
            } else if (ry >= topRy) {
              // Vaulted castle ceiling + crenellated battlements on corner turrets
              if (inCornerTurret && ry === topRy + 1) {
                if ((ax === 9 || az === 9) && ((rx + rz) & 1) === 0) bid = ruinBrick(wx, trueWy, wz);
                else continue;
              } else {
                bid = (ry === topRy + 1) ? B.DEEPSLATE : ruinBrick(wx, trueWy, wz);
              }
            } else if (ry === -1) {
              // Floor level (ry = -1): Lava pit under 3x3 End Portal, side lava braziers, North fountain basin, and patterned floor!
              if (inKeep && ax <= 1 && az <= 1) bid = B.LAVA;
              else if (inKeep && ax === 4 && az <= 2) bid = B.LAVA;
              else if (inNorthWing && ax <= 1 && Math.abs(rz + 12) <= 1) bid = (ax === 0 && rz === -12) ? B.SEA_LANTERN : B.WATER;
              else if ((ax + az) % 4 === 0 && hash2i(wx, wz, worldSeed + 4919) > 0.55) bid = B.MOSS_BLOCK;
              else bid = ruinBrick(wx, trueWy, wz);
            } else if (isOuterWall) {
              // Gothic arched doorways & barred castle embrasures
              const isSouthGate = (inSouthWing && rz === 16 && ax <= 1 && ry <= 3);
              const isBarWindow = (ry >= 2 && ry <= 3 && ((ax === 5 && (rz === -12 || rz === 12)) || (az === 5 && (rx === -12 || rx === 12))));
              if (isSouthGate) bid = B.AIR;
              else if (isBarWindow) bid = B.STONE_WALL;
              else bid = ruinBrick(wx, trueWy, wz);
            } else if (isKeepDoor && ry >= 4) {
              // Arched stone lintel above the 4 cardinal Keep doorways
              bid = (ry === 4 && (ax === 1 || az === 1)) ? B.STONE_WALL : ruinBrick(wx, trueWy, wz);
            }

            // 2) Central Sanctum Portal Keep interior details (End Portal 12 frames, steps, 4 corner towers, chandelier)
            if (inKeep && !isOuterWall && ry >= 0 && ry < topRy) {
              if (ax === 5 && az === 5) {
                bid = ruinBrick(wx, trueWy, wz);
              } else if ((ax === 4 && az === 5 || ax === 5 && az === 4) && ry === 4) {
                bid = B.LANTERN;
              } else if (ry === 0) {
                if (ax <= 1 && az <= 1) bid = B.AIR;
                else if ((ax === 2 && az <= 1) || (az === 2 && ax <= 1)) {
                  const slotHash = hash3(wx, trueWy, wz);
                  bid = (slotHash < 0.15) ? B.END_PORTAL_FRAME_EYE : B.END_PORTAL_FRAME;
                } else if (rz === 3 && ax <= 1) {
                  bid = B.STONE_STAIRS_N;
                } else if (ax === 4 && az <= 2) {
                  bid = B.STONE_WALL; // Brazier guard rails
                }
              } else if (ry === 7 && ax <= 1 && az <= 1) {
                bid = (ax === 0 && az === 0) ? B.SEA_LANTERN : ((ax + az === 1) ? B.LANTERN : B.AIR);
              } else if (ry === 6 && ax === 0 && az === 0) {
                bid = B.LANTERN;
              }
            }

            // 3) West Wing: Two-Tier Ancient Stronghold Library & Gold Treasure Chest
            if (inWestWing && !isOuterWall && ry >= 0 && ry < topRy) {
              if (az === 4 && rx <= -9 && rx >= -15) {
                if (ry === 0 || ry === 1 || ry === 4) bid = (rx === -12 && ry === 1) ? B.LANTERN : B.BOOKSHELF;
                else if (ry === 3) bid = B.PLANKS;
              } else if (az === 3 && rx <= -9 && rx >= -15 && ry === 3) {
                bid = B.PLANKS;
              } else if (az === 3 && rx <= -9 && rx >= -15 && ry === 4) {
                bid = B.OAK_FENCE;
              } else if (rx === -14 && rz === 0 && ry === 0) {
                bid = B.GOLD_CHEST;
              } else if (rx === -11 && rz === 0 && ry === 4) {
                bid = B.LANTERN;
              } else if (ry === 5 && ((rx + rz) & 3) === 0 && hash2i(wx, wz, worldSeed + 4931) > 0.72) {
                bid = B.COBWEB;
              }
            }

            // 4) East Wing: Royal Armory, Forge & Barred Dungeon Alcoves
            if (inEastWing && !isOuterWall && ry >= 0 && ry < topRy) {
              if (az === 3 && rx >= 9 && rx <= 14 && ry <= 3) {
                bid = (rx === 11 && ry <= 1) ? B.AIR : B.STONE_WALL;
              } else if (ry === 0) {
                if (rx === 14 && rz === -2) bid = B.ANVIL;
                else if (rx === 14 && rz === 2) bid = B.SMITHING_TABLE;
                else if (rx === 15 && rz === 0) bid = B.BLAST_FURNACE;
                else if (rx === 12 && rz === 0) bid = B.IRON_CHEST;
              } else if (rx === 11 && rz === 0 && ry === 4) {
                bid = B.LANTERN;
              }
            }

            // 5) North Wing: Sunken Fountain Cloister & Colonnade Pillars
            if (inNorthWing && !isOuterWall && ry >= 0 && ry < topRy) {
              if (ax === 3 && (rz === -10 || rz === -14)) {
                bid = ruinBrick(wx, trueWy, wz);
              } else if (rx === 0 && rz === -12 && ry <= 2) {
                bid = (ry === 2) ? B.SEA_LANTERN : B.STONE_BRICK;
              } else if (rx === 0 && rz === -12 && ry === 5) {
                bid = B.LANTERN;
              }
            }

            // 6) South Wing: Grand Entrance Gatehouse & Ruined Stairwell Pillars
            if (inSouthWing && !isOuterWall && ry >= 0 && ry < topRy) {
              if (ax === 3 && (rz === 10 || rz === 14)) {
                bid = ruinBrick(wx, trueWy, wz);
              } else if (ax === 2 && (rz === 10 || rz === 14) && ry === 3) {
                bid = B.LANTERN;
              }
            }

            put(lx, wy, lz, bid);
          }

          // 7) Ruined Vertical Watchtower Entry Shaft above South Gatehouse (rz 13..15, rx -2..2) so players digging down enter the castle!
          if (inSouthWing && ax <= 2 && rz >= 12 && rz <= 16) {
            for (let sy = topRy + 1; sy <= topRy + 8; sy++) {
              const wy = baseY + sy;
              if (wy <= MIN_Y + 1 || wy >= MAX_Y - 2) continue;
              const isShaftWall = (ax === 2 || rz === 12 || rz === 16);
              if (isShaftWall) {
                put(lx, wy, lz, ruinBrick(wx, sh.y + sy, wz));
              } else {
                // Spiral stone step ledges around the 3x3 vertical shaft
                const stepPhase = (sy - topRy) & 3;
                const isStep = (stepPhase === 0 && rx === -1 && rz === 13) ||
                               (stepPhase === 1 && rx === 1 && rz === 13) ||
                               (stepPhase === 2 && rx === 1 && rz === 15) ||
                               (stepPhase === 3 && rx === -1 && rz === 15);
                put(lx, wy, lz, isStep ? B.STONE_BRICK : ((sy === topRy + 4 && rx === 0 && rz === 14) ? B.LANTERN : B.AIR));
              }
            }
          }
        }
      }
      const topSh = Math.min(WORLD_H - 1, (baseY + 16) - MIN_Y);
      if (topSh > maxLy) maxLy = topSh;
    }
    return maxLy;
  }

  function getNearestStronghold(px, pz) {
    const list = getStrongholdLocations();
    let best = list[0], bestD = Infinity;
    for (const sh of list) {
      const d = Math.hypot(sh.x - px, sh.z - pz);
      if (d < bestD) { bestD = d; best = sh; }
    }
    return best;
  }

  function tryIgniteNetherPortal(ix, iy, iz) {
    const isEmpty = (b) => (b === B.AIR || b === B.FIRE);
    // Try both orientations: axis='x' (width along X, height along Y) and axis='z' (width along Z, height along Y)
    for (const axis of ['x', 'z']) {
      const dx = axis === 'x' ? 1 : 0;
      const dz = axis === 'z' ? 1 : 0;
      // Find bottom inner air/fire block (walk down up to 10 blocks)
      let by = iy;
      let steps = 0;
      while (steps < 11 && isEmpty(getBlockWorld(ix, by - 1, iz))) { by--; steps++; }
      if (getBlockWorld(ix, by - 1, iz) !== B.OBSIDIAN) continue;

      // Find left-most inner air/fire block on this row
      let lx = ix, lz = iz;
      steps = 0;
      while (steps < 11 && isEmpty(getBlockWorld(lx - dx, by, lz - dz))) { lx -= dx; lz -= dz; steps++; }
      if (getBlockWorld(lx - dx, by, lz - dz) !== B.OBSIDIAN) continue;

      // Measure inner width (must be 2..10)
      let w = 0;
      while (w < 11 && isEmpty(getBlockWorld(lx + dx * w, by, lz + dz * w))) w++;
      if (w < 2 || w > 10) continue;
      if (getBlockWorld(lx + dx * w, by, lz + dz * w) !== B.OBSIDIAN) continue;

      // Measure inner height (must be 3..10)
      let h = 0;
      while (h < 11 && isEmpty(getBlockWorld(lx, by + h, lz))) h++;
      if (h < 3 || h > 10) continue;

      // Validate entire interior is AIR/FIRE and all 4 frame borders are OBSIDIAN (corners optional => 10..14+ obsidian!)
      let valid = true;
      for (let u = 0; u < w && valid; u++) {
        const cx = lx + dx * u, cz = lz + dz * u;
        if (getBlockWorld(cx, by - 1, cz) !== B.OBSIDIAN) valid = false;
        if (getBlockWorld(cx, by + h, cz) !== B.OBSIDIAN) valid = false;
        for (let v = 0; v < h && valid; v++) {
          if (!isEmpty(getBlockWorld(cx, by + v, cz))) valid = false;
        }
      }
      for (let v = 0; v < h && valid; v++) {
        if (getBlockWorld(lx - dx, by + v, lz - dz) !== B.OBSIDIAN) valid = false;
        if (getBlockWorld(lx + dx * w, by + v, lz + dz * w) !== B.OBSIDIAN) valid = false;
      }
      if (!valid) continue;

      // Ignite! Fill inner rectangle with B.NETHER_PORTAL
      for (let u = 0; u < w; u++) {
        for (let v = 0; v < h; v++) {
          setBlockWorld(lx + dx * u, by + v, lz + dz * u, B.NETHER_PORTAL, true);
        }
      }
      if (typeof _recordPortalPos === 'function' && (currentDimension === 'overworld' || currentDimension === 'nether')) {
        _recordPortalPos(currentDimension, lx, by, lz);
      }
      spawnParticles(lx + dx * (w * 0.5) + 0.5, by + h * 0.5, lz + dz * (w * 0.5) + 0.5, 0xc084fc, 28, true);
      playSfx('roar');
      showToast('🔥 CỔNG ĐỊA NGỤC (NETHER PORTAL) ĐÃ KÍCH HOẠT! Chạm vào cổng để dịch chuyển ngay lập tức!');
      return true;
    }
    return false;
  }

  function tryIgniteWardenPortal(hx, hy, hz, ix, iy, iz) {
    const isEmpty = (b) => (b === B.AIR || b === B.FIRE || b === B.SOUL_FIRE);
    const seedPts = [[ix, iy, iz]];
    if (getBlockWorld(hx, hy, hz) === B.REINFORCED_DEEPSLATE) {
      seedPts.push([hx, hy + 1, hz], [hx + 1, hy, hz], [hx - 1, hy, hz], [hx, hy, hz + 1], [hx, hy, hz - 1]);
    }
    for (const [sx, sy, sz] of seedPts) {
      if (!isEmpty(getBlockWorld(sx, sy, sz))) continue;
      for (const axis of ['x', 'z']) {
        const dx = axis === 'x' ? 1 : 0;
        const dz = axis === 'z' ? 1 : 0;
        let by = sy, steps = 0;
        while (steps < 16 && isEmpty(getBlockWorld(sx, by - 1, sz))) { by--; steps++; }
        if (getBlockWorld(sx, by - 1, sz) !== B.REINFORCED_DEEPSLATE) continue;
        let lx = sx, lz = sz; steps = 0;
        while (steps < 25 && isEmpty(getBlockWorld(lx - dx, by, lz - dz))) { lx -= dx; lz -= dz; steps++; }
        if (getBlockWorld(lx - dx, by, lz - dz) !== B.REINFORCED_DEEPSLATE) continue;
        let w = 0;
        while (w < 25 && isEmpty(getBlockWorld(lx + dx * w, by, lz + dz * w))) w++;
        if (w < 2 || w > 24 || getBlockWorld(lx + dx * w, by, lz + dz * w) !== B.REINFORCED_DEEPSLATE) continue;
        let h = 0;
        while (h < 15 && isEmpty(getBlockWorld(lx, by + h, lz))) h++;
        if (h < 3 || h > 14) continue;
        let valid = true;
        for (let u = 0; u < w && valid; u++) {
          const cx = lx + dx * u, cz = lz + dz * u;
          if (getBlockWorld(cx, by - 1, cz) !== B.REINFORCED_DEEPSLATE) valid = false;
          if (getBlockWorld(cx, by + h, cz) !== B.REINFORCED_DEEPSLATE) valid = false;
          for (let v = 0; v < h && valid; v++) {
            if (!isEmpty(getBlockWorld(cx, by + v, cz))) valid = false;
          }
        }
        for (let v = 0; v < h && valid; v++) {
          if (getBlockWorld(lx - dx, by + v, lz - dz) !== B.REINFORCED_DEEPSLATE) valid = false;
          if (getBlockWorld(lx + dx * w, by + v, lz + dz * w) !== B.REINFORCED_DEEPSLATE) valid = false;
        }
        if (!valid) continue;
        for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) {
          setBlockWorld(lx + dx * u, by + v, lz + dz * u, B.WARDEN_PORTAL, true);
        }
        _recordPortalPos(currentDimension, lx, by, lz);
        spawnParticles(lx + dx * (w * 0.5) + 0.5, by + h * 0.5, lz + dz * (w * 0.5) + 0.5, 0x22d3ee, 32, true);
        playSfx('roar');
        showToast('🩵 CỔNG WARDEN CỔ ĐẠI ĐÃ MỞ! Bước vào để tiến tới Thế Giới Warden!');
        return true;
      }
    }
    return false;
  }

  function buildArrivalWardenPortal(cx, baseY, cz) {
    for (let dx = -4; dx <= 4; dx++) {
      setBlockWorld(cx + dx, baseY + 1, cz, B.REINFORCED_DEEPSLATE, true);
      setBlockWorld(cx + dx, baseY + 9, cz, B.REINFORCED_DEEPSLATE, true);
    }
    for (let dy = 2; dy <= 8; dy++) {
      setBlockWorld(cx - 4, baseY + dy, cz, B.REINFORCED_DEEPSLATE, true);
      setBlockWorld(cx + 4, baseY + dy, cz, B.REINFORCED_DEEPSLATE, true);
      for (let dx = -3; dx <= 3; dx++) setBlockWorld(cx + dx, baseY + dy, cz, B.WARDEN_PORTAL, true);
    }
    setBlockWorld(cx - 5, baseY + 1, cz, B.SOUL_SAND, true);
    setBlockWorld(cx - 5, baseY + 2, cz, B.SOUL_FIRE, true);
    setBlockWorld(cx + 5, baseY + 1, cz, B.SOUL_SAND, true);
    setBlockWorld(cx + 5, baseY + 2, cz, B.SOUL_FIRE, true);
    setBlockWorld(cx - 4, baseY + 10, cz, B.SOUL_LANTERN, true);
    setBlockWorld(cx + 4, baseY + 10, cz, B.SOUL_LANTERN, true);
  }

  function extinguishConnectedNetherPortal(sx, sy, sz) {
    const queue = [];
    const seen = new Set();
    const pushIfPortal = (x, y, z) => {
      const k = `${x},${y},${z}`;
      if (seen.has(k)) return;
      if (getBlockWorld(x, y, z) === B.NETHER_PORTAL) { seen.add(k); queue.push([x, y, z]); }
    };
    pushIfPortal(sx, sy, sz);
    const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of dirs) pushIfPortal(sx + dx, sy + dy, sz + dz);
    while (queue.length > 0 && seen.size < 48) {
      const [x, y, z] = queue.shift();
      setBlockWorld(x, y, z, B.AIR, true);
      for (const [dx, dy, dz] of dirs) pushIfPortal(x + dx, y + dy, z + dz);
    }
  }

  let dimensionPortals = { overworld: [], nether: [], sift: [], warden: [] };
  let lastSiftOverworldPos = null;
  function _recordPortalPos(dim, x, y, z) {
    const arr = dimensionPortals[dim]; if (!arr) return;
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    for (let i = 0; i < arr.length; i++) {
      if (Math.hypot(arr[i].x - fx, arr[i].z - fz) < 8) { arr[i].y = fy; return; }
    }
    arr.push({ x: fx, y: fy, z: fz });
  }
  function _findNearestPortal(dim, tx, tz, maxR) {
    const arr = dimensionPortals[dim] || [];
    let best = null, bestD = maxR + 0.001;
    for (let i = 0; i < arr.length; i++) {
      const d = Math.hypot(arr[i].x - tx, arr[i].z - tz);
      if (d <= bestD) { bestD = d; best = arr[i]; }
    }
    return best;
  }

  function buildArrivalNetherPortal(px, py, pz) {
    // Build a 4x5 Obsidian frame (2x3 lit Nether Portal) with 5x5 solid safety platform even over lava/void
    for (let dx = -2; dx <= 3; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        setBlockWorld(px + dx, py - 2, pz + dz, B.NETHERRACK, true);
        setBlockWorld(px + dx, py - 1, pz + dz, B.OBSIDIAN, true);
        for (let dy = 0; dy <= 4; dy++) setBlockWorld(px + dx, py + dy, pz + dz, B.AIR, true);
      }
    }
    for (let dx = -1; dx <= 2; dx++) {
      setBlockWorld(px + dx, py - 1, pz, B.OBSIDIAN, true);
      setBlockWorld(px + dx, py + 3, pz, B.OBSIDIAN, true);
    }
    for (let dy = 0; dy <= 2; dy++) {
      setBlockWorld(px - 1, py + dy, pz, B.OBSIDIAN, true);
      setBlockWorld(px + 2, py + dy, pz, B.OBSIDIAN, true);
      setBlockWorld(px,     py + dy, pz, B.NETHER_PORTAL, true);
      setBlockWorld(px + 1, py + dy, pz, B.NETHER_PORTAL, true);
    }
  }

  function buildEndReturnPortal(px, py, pz) {
    for (let cz = (pz - 5) >> 4; cz <= (pz + 5) >> 4; cz++) {
      for (let cx = (px - 5) >> 4; cx <= (px + 5) >> 4; cx++) if (!chunks.has(chunkKey(cx, cz))) generateChunk(cx, cz);
    }
    // Classic Bedrock Exit Fountain: Bedrock rim + 3x3 B.END_PORTAL pool + central Bedrock column topped with ENDER_DRAGON_EGG!
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > 4.2) continue;
        setBlockWorld(px + dx, py - 1, pz + dz, B.BEDROCK, true, true);
        for (let hy = 0; hy <= 5; hy++) setBlockWorld(px + dx, py + hy, pz + dz, B.AIR, true, true);
        if (d >= 2.6 && d <= 4.0) setBlockWorld(px + dx, py, pz + dz, B.BEDROCK, true, true);
        else if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && !(dx === 0 && dz === 0)) setBlockWorld(px + dx, py, pz + dz, B.END_PORTAL, true, true);
      }
    }
    for (let dy = 0; dy <= 3; dy++) setBlockWorld(px, py + dy, pz, B.BEDROCK, true, true);
    setBlockWorld(px + 1, py + 2, pz, B.TORCH_BLOCK, true, true);
    setBlockWorld(px - 1, py + 2, pz, B.TORCH_BLOCK, true, true);
    setBlockWorld(px, py + 2, pz + 1, B.TORCH_BLOCK, true, true);
    setBlockWorld(px, py + 2, pz - 1, B.TORCH_BLOCK, true, true);
    setBlockWorld(px, py + 4, pz, B.ENDER_DRAGON_EGG, true, true);
  }

  function buildEndGatewayPortal(px, py, pz) {
    for (let cz = (pz - 5) >> 4; cz <= (pz + 5) >> 4; cz++) {
      for (let cx = (px - 5) >> 4; cx <= (px + 5) >> 4; cx++) if (!chunks.has(chunkKey(cx, cz))) generateChunk(cx, cz);
    }
    // Ceremonial End Gateway Shrine + stepping Purpur stairs opening path to Outer End Cities & End Ships!
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const gd = Math.abs(dx) + Math.abs(dz);
        if (gd <= 2) {
          for (let hy = 0; hy <= 5; hy++) setBlockWorld(px + dx, py + hy, pz + dz, B.AIR, true, true);
          setBlockWorld(px + dx, py, pz + dz, B.BEDROCK, true, true);
          setBlockWorld(px + dx, py + 4, pz + dz, B.BEDROCK, true, true);
          if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && gd <= 1) {
            for (let gy = 1; gy <= 3; gy++) setBlockWorld(px + dx, py + gy, pz + dz, B.END_GATEWAY, true, true);
          }
          if (gd === 2) setBlockWorld(px + dx, py + 5, pz + dz, B.END_ROD, true, true);
        }
      }
    }
    const groundY = Math.max(7, getTerrainHeight(px - 5, pz, BIOMES.THE_END));
    for (let s = 1; s <= 5; s++) {
      const sy = Math.min(py, Math.max(groundY, py - (5 - s)));
      for (let gz = -1; gz <= 1; gz++) setBlockWorld(px - s, sy, pz + gz, s === 2 ? B.END_STONE_BRICKS : B.PURPUR_BLOCK, true, true);
    }
    setBlockWorld(px - 2, py + 1, pz - 1, B.END_ROD, true, true);
    setBlockWorld(px - 2, py + 1, pz + 1, B.END_ROD, true, true);
  }

  function teleportViaEndGateway(toOuter = true) {
    const tx = toOuter ? 1004 : 26;
    const tz = 0;
    const scx = tx >> 4, scz = tz >> 4;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (!chunks.has(chunkKey(scx + dx, scz + dz))) generateChunk(scx + dx, scz + dz);
    }
    const landY = Math.max(8, getTerrainHeight(tx, tz + 4, BIOMES.THE_END));
    player.x = tx + 0.5; player.y = landY + 1.25; player.z = tz + 4.5;
    player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
    player.yaw = toOuter ? -Math.PI * 0.5 : 0; player.pitch = 0.05;
    _portalCooldown = 3.5;
    _teleportWarmupFrames = 24;
    flushUrgentChunks(48, true);
    if (toOuter) {
      if (mobs.filter(m => m.type === 'shulker' && Math.hypot(m.x - 1032, m.z) < 40).length < 2) {
        spawnMobOfType('shulker', 1029, 9.2, -3);
        spawnMobOfType('shulker', 1032, 23.2, -26);
      }
      showToast('🌌 ĐÃ DỊCH CHUYỂN TỚI END CITY! Khám phá Thuyền Bay để lấy Đầu Rồng & Cánh Cứng Elytra!');
    } else {
      showToast('🌌 Đã trở về Đảo Chính The End!');
    }
    playSfx('warp');
    spawnParticles(player.x, player.y + 1.0, player.z, 0xc084fc, 18, true);
  }

  function buildDragonRealmPortal(px, py, pz) {
    for (let cz = (pz - 5) >> 4; cz <= (pz + 5) >> 4; cz++) {
      for (let cx = (px - 5) >> 4; cx <= (px + 5) >> 4; cx++) if (!chunks.has(chunkKey(cx, cz))) generateChunk(cx, cz);
    }
    for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) {
      setBlockWorld(px + dx, py, pz + dz, (Math.abs(dx) === 3 || Math.abs(dz) === 2) ? B.PURPUR_BLOCK : B.OBSIDIAN, true, true);
      for (let hy = 1; hy <= 7; hy++) setBlockWorld(px + dx, py + hy, pz + dz, B.AIR, true, true);
    }
    for (let dy = 1; dy <= 5; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const isFrame = (dx === -2 || dx === 2 || dy === 5);
        setBlockWorld(px + dx, py + dy, pz, isFrame ? (dy === 5 && Math.abs(dx) === 2 ? B.AMETHYST : B.OBSIDIAN) : B.DRAGON_REALM_PORTAL, true, true);
      }
    }
    setBlockWorld(px - 2, py + 6, pz, B.END_ROD, true, true);
    setBlockWorld(px + 2, py + 6, pz, B.END_ROD, true, true);
    setBlockWorld(px, py + 6, pz, B.END_CRYSTAL_BLOCK, true, true);
  }

  function tryActivateEndPortalAround(fx, fy, fz) {
    // Search possible 3x3 center offsets relative to a filled frame block
    const offsets = [
      [-2, -1], [-2, 0], [-2, 1],
      [ 2, -1], [ 2, 0], [ 2, 1],
      [-1, -2], [ 0, -2], [ 1, -2],
      [-1,  2], [ 0,  2], [ 1,  2]
    ];
    for (const [ox, oz] of offsets) {
      const cx = fx + ox, cz = fz + oz;
      let all12 = true;
      for (let i = -1; i <= 1 && all12; i++) {
        if (getBlockWorld(cx - 2, fy, cz + i) !== B.END_PORTAL_FRAME_EYE) all12 = false;
        if (getBlockWorld(cx + 2, fy, cz + i) !== B.END_PORTAL_FRAME_EYE) all12 = false;
        if (getBlockWorld(cx + i, fy, cz - 2) !== B.END_PORTAL_FRAME_EYE) all12 = false;
        if (getBlockWorld(cx + i, fy, cz + 2) !== B.END_PORTAL_FRAME_EYE) all12 = false;
      }
      if (!all12) continue;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          setBlockWorld(cx + dx, fy, cz + dz, B.END_PORTAL, true);
        }
      }
      spawnParticles(cx + 0.5, fy + 0.8, cz + 0.5, 0x34d399, 36, true);
      spawnParticles(cx + 0.5, fy + 1.0, cz + 0.5, 0x818cf8, 28, true);
      playSfx('roar');
      showToast('🌌 CỔNG KẾT THÚC (END PORTAL) ĐÃ MỞ! Nhảy vào cổng để đối đầu Rồng Ender!');
      return true;
    }
    return false;
  }

  const _enderEyeOrbGeo = new THREE.SphereGeometry(0.18, 10, 10);
  const _enderEyeOrbMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const _enderEyePupilGeo = new THREE.BoxGeometry(0.06, 0.22, 0.24);
  const _enderEyePupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
  const _enderEyeHaloGeo = new THREE.SphereGeometry(0.26, 8, 8);
  const _enderEyeHaloMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.35 });
  function throwEnderEye() {
    if (currentDimension !== 'overworld') {
      showToast('👁️ Mắt Ender chỉ hoạt động tìm Pháo Đài ở Thế Giới Chính (Overworld)!');
      return false;
    }
    const sh = getNearestStronghold(player.x, player.z);
    const dx = sh.x - player.x, dz = sh.z - player.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 0.5 ? dx / dist : 0;
    const dirZ = dist > 0.5 ? dz / dist : 0;
    const diving = dist < 16;

    const grp = new THREE.Group();
    const orb = new THREE.Mesh(_enderEyeOrbGeo, _enderEyeOrbMat);
    const pupil = new THREE.Mesh(_enderEyePupilGeo, _enderEyePupilMat);
    const halo = new THREE.Mesh(_enderEyeHaloGeo, _enderEyeHaloMat);
    grp.add(orb, pupil, halo);
    const sx = player.x, sy = player.y + 1.5, sz = player.z;
    grp.position.set(sx, sy, sz);
    scene.add(grp);

    const tx = diving ? sh.x + 0.5 : sx + dirX * Math.min(13, dist);
    const ty = diving ? (sh.inGrandRuins ? sh.y + 1.5 : Math.max(sh.y + 1, sy - 4.0)) : sy + 3.6;
    const tz = diving ? sh.z + 0.5 : sz + dirZ * Math.min(13, dist);

    flyingEnderEyes.push({
      mesh: grp, sx, sy, sz, tx, ty, tz,
      t: 0, dur: 2.2, sparkT: 0, diving
    });
    playSfx('equip');
    if (diving) {
      showToast(sh.inGrandRuins
        ? `👁️ Mắt Ender bay thẳng tới Đền Cổng The End trong Khu Tàn Tích 1000×1000 (~${Math.round(dist)}m, y=${sh.y})!`
        : `👁️ Mắt Ender lao xuống đất! Pháo Đài (Cổng End) ở ngay bên dưới (~${Math.round(dist)}m, y=${sh.y})!`);
    } else {
      showToast(sh.inGrandRuins
        ? `👁️ Mắt Ender đang dẫn lối tới Khu Tàn Tích Cổng The End 1000×1000 (cách khoảng ${Math.round(dist)}m)...`
        : `👁️ Mắt Ender đang bay về phía Pháo Đài (cách khoảng ${Math.round(dist)}m)...`);
    }
    return true;
  }

  function updateFlyingEnderEyes(dt) {
    for (let i = flyingEnderEyes.length - 1; i >= 0; i--) {
      const e = flyingEnderEyes[i];
      e.t += dt;
      const p = Math.min(1, e.t / e.dur);
      const ease = 1 - Math.pow(1 - p, 2);
      const cx = e.sx + (e.tx - e.sx) * ease;
      const cy = e.sy + (e.ty - e.sy) * ease + Math.sin(p * Math.PI) * (e.diving ? 0.6 : 1.5);
      const cz = e.sz + (e.tz - e.sz) * ease;
      e.mesh.position.set(cx, cy, cz);
      e.mesh.rotation.y += dt * 6;
      e.sparkT += dt;
      if (e.sparkT >= 0.09) {
        e.sparkT = 0;
        spawnParticles(cx, cy, cz, 0x34d399, 2, true);
      }
      if (e.t >= e.dur + 0.45) {
        scene.remove(e.mesh);
        flyingEnderEyes.splice(i, 1);
        if (Math.random() < 0.80) {
          spawnDroppedItem(Math.floor(cx), Math.floor(cy), Math.floor(cz), B.ENDER_EYE);
          spawnParticles(cx, cy, cz, 0x67e8f9, 8, true);
        } else {
          spawnParticles(cx, cy, cz, 0xc084fc, 16, true);
          playSfx('break');
          showToast('💥 Mắt Ender đã vỡ tan thành bụi sao!');
        }
      }
    }
  }

  function teleportViaNetherPortal() {
    const fromOverworld = (currentDimension === 'overworld');
    const targetDim = fromOverworld ? 'nether' : 'overworld';
    _recordPortalPos(currentDimension, player.x, player.y, player.z);
    const rawX = fromOverworld ? Math.round(player.x / 8) : Math.round(player.x * 8);
    const rawZ = fromOverworld ? Math.round(player.z / 8) : Math.round(player.z * 8);
    const linked = _findNearestPortal(targetDim, rawX, rawZ, fromOverworld ? 16 : 128);
    const destX = linked ? linked.x : rawX;
    const destZ = linked ? linked.z : rawZ;
    const msg = fromOverworld
      ? `🔥 Đã qua Cổng Địa Ngục tới The Nether (${destX}, ${destZ}) — tỷ lệ 1:8!`
      : `🌿 Đã quay về Overworld (${destX}, ${destZ}) — 1 block Nether = 8 block Overworld!`;
    showWorldLoadingOverlay(
      'Đang tải thế giới',
      fromOverworld ? 'Đang dịch chuyển tới Địa Ngục (Tỷ lệ 1:8)...' : 'Đang quay về Thế Giới Chính (x8)...',
      () => switchDimension(targetDim, msg, { portalCoords: { x: destX, z: destZ, y: linked ? linked.y : null } }),
      { badge: fromOverworld ? 'THE NETHER' : 'OVERWORLD' }
    );
  }

  let _lastEyesInWater = false, _lastEyesInLava = false, _lastFireHudOn = false;
  function _clearWorldInteractiveCaches(alsoClearChunks = false, wipeWorldState = false) {
    if (wipeWorldState) { clearWorldModsAll(); chestStorageMap.clear(); incubatingEggs.clear(); spawnedDragonNests.clear(); plantedSaplings.clear(); saplingFertilizeCount.clear(); }
    else { worldModsByChunk.clear(); activeFires.clear(); }
    clearFluidState();
    exploredChunks.clear(); doorOpenState.clear(); torchAttachDir.clear(); dragonHeadYaw.clear(); windmillHubState.clear(); chestPairMap.clear(); furnaceStateMap.clear(); manualCraftGrid.fill(0);
    for (const v of interactiveVisuals.values()) scene.remove(v.group);
    interactiveVisuals.clear(); interactiveByChunk.clear(); endCrystalVisuals.clear(); animatedInteractiveVisuals.clear(); _hingesAnimating = false;
    activeChestKey = null; activeChestPartnerKey = null; activeFurnaceKey = null;
    if (wipeWorldState && player.ridingDragon) { player.ridingDragon = null; player.sitting = false; }
    _playerCombatTarget = null; _playerCombatTargetT = 0; _dragonGrowthUiTimer = 0; _activeGrowthDragon = null;
    document.getElementById('dragonGrowthWrap')?.classList.remove('visible');
    document.getElementById('btnDragonMount')?.classList.remove('visible');
    document.getElementById('dragonFlightHud')?.classList.remove('visible');
    if (alsoClearChunks) {
      for (const ch of chunks.values()) { disposeChunkMeshes(ch, true); _freeChunkData(ch); }
      chunks.clear(); _invChunkCache(); emergeQueue.length = 0; emergeSet.clear();
      _dirtyChunkSet.clear(); _urgentChunkSet.clear(); _borderChunkSet.clear();
      _chunkUnloadQueue.length = 0; _chunkUnloadSet.clear();
      lastPlayerCx = 99999; lastPlayerCz = 99999;
      for (const m of mobs) disposeMobInstance(m); mobs.length = 0;
      if (wipeWorldState) {
        for (const it of droppedItems) { scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow); }
        droppedItems.length = 0;
      } else {
        for (const it of droppedItems) { if (it.mesh) it.mesh.visible = false; if (it.shadow) it.shadow.visible = false; }
      }
      if (typeof xpOrbs !== 'undefined') { for (const xo of xpOrbs) scene.remove(xo.mesh); xpOrbs.length = 0; }
      for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0;
      for (const t of primedTnts) scene.remove(t.mesh); primedTnts.length = 0;
      for (const dc of dragonClouds) scene.remove(dc.mesh); dragonClouds.length = 0;
      dragonHealBeam.visible = false;
    }
  }

  function switchDimension(targetDim, reasonToast = null, portalOpts = null) {
    currentDimension = targetDim;
    depthOffset = 0;
    chunkWorkerPool.clear();
    window._worldWarmupUntil = performance.now() + 5500;
    window._rtVolDirty = true;
    _clearWorldInteractiveCaches(true, false);
    if (typeof rebuildCurrentDimModIndex === 'function') rebuildCurrentDimModIndex();
    if (portalOpts && portalOpts.skipSpawnMove) return;

    const _rebuildStandingOnly = (cx, cz, extraCx, extraCz) => {
      if (isWorldLoading) { _teleportWarmupFrames = 24; return; }
      const c0 = chunks.get(chunkKey(cx, cz));
      if (c0 && c0.dirty) rebuildChunkMesh(c0);
      if (extraCx !== undefined && (extraCx !== cx || extraCz !== cz)) {
        const c1 = chunks.get(chunkKey(extraCx, extraCz));
        if (c1 && c1.dirty) rebuildChunkMesh(c1);
      }
      _teleportWarmupFrames = 24;
    };

    if (targetDim === 'sift') {
      // v60: Đồng bộ chuẩn như Nether/End + khung cảnh Singer's Portal thoáng đẹp, mob Sift dễ thương đứng ngay tầm mắt!
      const sx0 = (portalOpts && typeof portalOpts.spawnX === 'number') ? Math.floor(portalOpts.spawnX) : 0;
      const sz0 = (portalOpts && typeof portalOpts.spawnZ === 'number') ? Math.floor(portalOpts.spawnZ) : 0;
      const targetBio = (portalOpts && portalOpts.targetBio) || BIOMES.SIFT_MEADOW;
      const scx = sx0 >> 4, scz = sz0 >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      const ly = Math.max(WATER_LEVEL + 2, getTerrainHeight(sx0, sz0, targetBio));
      // Bãi đáp đá cổ & cỏ xanh ngọc thoáng tầm nhìn hướng thẳng tới Đại Cổng Giấc Mơ phía xa (-Z)
      for (let dz = -15; dz <= 6; dz++) for (let dx = -7; dx <= 7; dx++) {
        const isStep = (dz <= -8 && Math.abs(dx) <= 5);
        const topY = isStep ? ly + 1 : ly;
        for (let by = ly - 2; by <= topY; by++) setBlockWorld(sx0 + dx, by, sz0 + dz, by === topY ? (isStep ? B.HUSK_SOIL : B.SIFT_GRASS) : B.HUSK_SOIL, true);
        for (let hy = 1; hy <= 14; hy++) setBlockWorld(sx0 + dx, topY + hy, sz0 + dz, B.AIR, true);
      }
      const pcz = (sz0 - 10) >> 4;
      startRisingDreamPortal(sx0, ly, sz0 - 10, true);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(scx, scz, scx, pcz);
      player.x = sx0 + 0.5; player.y = ly + 1.3; player.z = sz0 + 3.5; player.yaw = 0.0; player.pitch = 0.04;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      // Spawn 5 mob Sift voxel dễ thương ngay bãi đáp trước cổng (0 GLB overhead!)
      spawnMobOfType('blub', sx0 - 2.3, ly + 1.3, sz0 - 1.2);
      spawnMobOfType('wobble', sx0 + 2.3, ly + 1.3, sz0 - 1.2);
      spawnMobOfType('humbler', sx0 - 3.6, ly + 1.3, sz0 - 4.2);
      spawnMobOfType('echo_golem', sx0 + 3.8, ly + 1.3, sz0 - 5.2);
      spawnMobOfType('roamroot', sx0 + 0.4, ly + 1.3, sz0 - 4.5);
      mobSpawnTimer = 1.2;
      playSfx('roar');
      showToast(reasonToast || "🌈 CHÀO MỪNG TỚI THE SIFT (KHU GIẤC MƠ)! Khám phá nước cầu vồng Ichor & quặng Aetherium!");
    } else if (targetDim === 'nether') {
      if (portalOpts && portalOpts.castleHero) {
        const scx = 64 >> 4, scz = -48 >> 4;
        for (let dz = -3; dz <= 0; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
        if (!isWorldLoading) {
          for (const ch of chunks.values()) if (ch.dirty) rebuildChunkMesh(ch);
          _teleportWarmupFrames = 24;
        }
        player.x = 64.5; player.y = 9.2; player.z = -46.5; player.yaw = 0.0; player.pitch = 0.14;
        player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
        spawnMobOfType('wither_skeleton', 63.5, 9.2, -55.5);
        spawnMobOfType('blaze', 72.5, 13.0, -64.5);
        mobSpawnTimer = 1.2;
        playSfx('roar');
        showToast(reasonToast || '🏰 Đã tới Lâu Đài Địa Ngục! Khám phá tòa thành tháp ngọc lam giữa biển dung nham!');
        cameraShake = 0.45;
        return;
      }
      let sx = 0, sz = 0, sy = 10;
      if (portalOpts && portalOpts.portalCoords) {
        sx = portalOpts.portalCoords.x;
        sz = portalOpts.portalCoords.z;
        sy = Math.max(WATER_LEVEL + 3, Math.min(20, getTerrainHeight(sx, sz, getBiomeAt(sx, sz)) + 1));
      } else {
        for (let r = 0; r <= 96; r += 4) {
          let found = false;
          for (let dz = -r; dz <= r && !found; dz += 4) for (let dx = -r; dx <= r && !found; dx += 4) {
            const b = getBiomeAt(dx, dz);
            const h = getTerrainHeight(dx, dz, b);
            if ((b === BIOMES.NETHER_CRIMSON || b === BIOMES.NETHER_WARPED) && h >= 4 && h <= 16) { sx = dx; sz = dz; sy = h + 1.5; found = true; }
          }
          if (found) break;
        }
      }
      const scx = sx >> 4, scz = sz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      const lx = Math.floor(sx), lz = Math.floor(sz), ly = Math.max(WATER_LEVEL + 2, Math.floor(sy) - 1);
      if (portalOpts && portalOpts.portalCoords) {
        buildArrivalNetherPortal(lx, ly + 1, lz);
        _recordPortalPos('nether', lx, ly + 1, lz);
        _portalCooldown = 4.5;
      } else {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          setBlockWorld(lx + dx, ly, lz + dz, B.CRIMSON_NYLIUM, true);
          for (let hy = 1; hy <= 4; hy++) setBlockWorld(lx + dx, ly + hy, lz + dz, B.AIR, true);
        }
        buildArrivalNetherPortal(lx, ly + 1, lz - 6);
        _recordPortalPos('nether', lx, ly + 1, lz - 6);
      }
      _rebuildStandingOnly(scx, scz);
      player.x = lx + 0.5; player.y = ly + 1.2; player.z = lz + (portalOpts && portalOpts.portalCoords ? 1.55 : 0.5); player.yaw = 0.0; player.pitch = -0.05;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      spawnMobOfType('blaze', lx + 5.5, ly + 3.0, lz - 8.5);
      spawnMobOfType('strider', lx + 3.5, ly + 1.4, lz - 5.5);
      spawnMobOfType('magma_cube', lx - 4.5, ly + 1.4, lz - 6.5);
      mobSpawnTimer = 1.2;
      playSfx('roar');
      showToast(reasonToast || '🔥 ĐÃ XUỐNG ĐỊA NGỤC (THE NETHER)! Tiêu diệt Quỷ Lửa (Blaze) để lấy Que Lửa!');
    } else if (targetDim === 'end') {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(dx, dz);
      const landY = Math.max(8, getTerrainHeight(0, 18, BIOMES.THE_END));
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        setBlockWorld(dx, landY, 18 + dz, B.END_STONE, true);
        for (let hy = 1; hy <= 4; hy++) setBlockWorld(dx, landY + hy, 18 + dz, B.AIR, true);
      }
      _rebuildStandingOnly(0, 1, 0, 0);
      player.x = 0.5; player.y = landY + 1.2; player.z = 18.5; player.yaw = 0.0; player.pitch = 0.14;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      _endCrystalScanT = 0;
      // Spawn the Upgraded 600-HP Boss Ender Dragon + End City Mobs
      const _ed = spawnMobOfType('ender_dragon', 0.5, landY + 15.0, -10.0);
      if (_ed) { _ed.homeX = 0.5; _ed.homeY = landY + 15.0; _ed.homeZ = 0.5; _ed.homeRadius = 34; }
      spawnMobOfType('void_golem', 9.5, getTerrainHeight(9, 2, BIOMES.THE_END) + 1.1, 2.5);
      spawnMobOfType('chorus_crawler', -8.5, getTerrainHeight(-8, 4, BIOMES.THE_END) + 1.1, 4.5);
      mobSpawnTimer = 1.5;
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (targetDim === 'warden') {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(dx, dz);
      const ly = Math.max(WATER_LEVEL + 3, getTerrainHeight(0, 0, BIOMES.WARDEN_CITADEL));
      for (let dz = -15; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
        const isStep = (dz <= -8 && Math.abs(dx) <= 5);
        const topY = isStep ? ly + 1 : ly;
        for (let by = ly - 2; by <= topY; by++) setBlockWorld(dx, by, dz, by === topY ? (isStep ? B.DEEPSLATE_TILES : B.SCULK) : B.WARDEN_SCULK_STONE, true);
        for (let hy = 1; hy <= 13; hy++) setBlockWorld(dx, topY + hy, dz, B.AIR, true);
      }
      buildArrivalWardenPortal(0, ly, -10);
      _recordPortalPos('warden', 0, ly, -10);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(0, 0, 0, -1);
      player.x = 0.5; player.y = ly + 1.3; player.z = 4.5; player.yaw = 0.0; player.pitch = 0.06;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      spawnMobOfType('sculk_stalker', -4.5, ly + 1.3, -2.5);
      spawnMobOfType('sculk_sentinel', 5.5, ly + 1.3, -4.5);
      spawnMobOfType('sculk_brute', -6.5, ly + 1.3, -7.5);
      spawnMobOfType('sculk_soul_ravager', 8.5, ly + 1.5, -18.5);
      mobSpawnTimer = 1.5;
      playSfx('roar');
      showToast(reasonToast || '🩵 CHÀO MỪNG TỚI THẾ GIỚI WARDEN! Săn Quặng Tier 6 & Hạ Boss Sculk 1000HP!');
    } else if (targetDim === 'dragon_realm') {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) generateChunk(dx, dz);
      for (let dz = 7; dz <= 10; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(dx, dz);
      const ly = Math.max(16, getTerrainHeight(0, 0, BIOMES.DR_PLAINS));
      buildDragonRealmPortal(0, ly, -10);
      _recordPortalPos('dragon_realm', 0, ly, -10);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(0, 0, 0, -1);
      player.x = 0.5; player.y = ly + 1.3; player.z = 2.5; player.yaw = Math.PI; player.pitch = 0.04;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      if (typeof spawnMobOfType === 'function') {
        spawnMobOfType('void_end_dragon', -28, ly + 8, 42);
        spawnMobOfType('amethyst_end_dragon', 30, ly + 9, 54);
        spawnMobOfType('sovereign_end_dragon', 0.5, 22.0, 136.5);
      }
      mobSpawnTimer = 2.0;
      playSfx('roar');
      showToast(reasonToast || '🌌 CHÀO MỪNG TỚI THẾ GIỚI RỒNG THE END! Hạ Boss Tối Thượng 50 Skill tại (0, 136)!');
    } else if (portalOpts && portalOpts.returnFromWarden) {
      const wp = window.lastWardenOverworldPos;
      const lx = wp ? Math.floor(wp.x) : 0;
      const lz = wp ? Math.floor(wp.z) : 0;
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      const ly = wp && typeof wp.y === 'number' ? wp.y : Math.max(WATER_LEVEL + 2, getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      let hasNearby = false;
      for (let oy = -5; oy <= 6 && !hasNearby; oy++) for (let oz = -14; oz <= 14 && !hasNearby; oz++) for (let ox = -14; ox <= 14 && !hasNearby; ox++) {
        if (getBlockWorld(lx + ox, ly + oy, lz + oz) === B.WARDEN_PORTAL) hasNearby = true;
      }
      if (!hasNearby) {
        for (let dz = -4; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
          setBlockWorld(lx + dx, ly - 1, lz + dz, B.DEEPSLATE_BRICKS, true);
          for (let hy = 0; hy <= 10; hy++) setBlockWorld(lx + dx, ly + hy, lz + dz, B.AIR, true);
        }
        buildArrivalWardenPortal(lx, ly - 1, lz - 2);
      }
      _portalCooldown = 4.5;
      _rebuildStandingOnly(scx, scz);
      player.x = lx + 0.5; player.y = ly + 1.2; player.z = lz + 3.5; player.yaw = 0.0; player.pitch = 0.02;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (portalOpts && portalOpts.returnFromSift) {
      const lx = Math.floor((portalOpts.portalCoords && portalOpts.portalCoords.x) || 0);
      const lz = Math.floor((portalOpts.portalCoords && portalOpts.portalCoords.z) || 0);
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      const ly = Math.max(WATER_LEVEL + 2, getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      for (let dz = -6; dz <= 7; dz++) for (let dx = -6; dx <= 6; dx++) {
        setBlockWorld(lx + dx, ly, lz + dz, B.STONE_BRICK, true);
        for (let hy = 1; hy <= 13; hy++) setBlockWorld(lx + dx, ly + hy, lz + dz, B.AIR, true);
      }
      startRisingDreamPortal(lx, ly - 1, lz, true);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(scx, scz);
      player.x = lx + 0.5; player.y = ly + 1.3; player.z = lz + 4.5; player.yaw = 0.0; player.pitch = 0.02;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (portalOpts && portalOpts.portalCoords) {
      const lx = Math.floor(portalOpts.portalCoords.x), lz = Math.floor(portalOpts.portalCoords.z);
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      const ly = Math.max(WATER_LEVEL + 1, (typeof portalOpts.portalCoords.y === 'number') ? (portalOpts.portalCoords.y - 1) : getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      buildArrivalNetherPortal(lx, ly + 1, lz);
      _recordPortalPos('overworld', lx, ly + 1, lz);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(scx, scz);
      player.x = lx + 0.5; player.y = ly + 1.2; player.z = lz + 1.55; player.yaw = 0.0; player.pitch = -0.05;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else {
      const rawSp = findSafeSpawnPoint(8, 8, true);
      const sp = landPlayerScenic(rawSp.x, rawSp.z, rawSp.yaw);
      ensureScenicSakuraAcrossLake(sp);
      player.x = sp.x; player.y = sp.y; player.z = sp.z; player.yaw = sp.yaw; player.pitch = 0.0;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = sp.y;
      if (reasonToast) showToast(reasonToast);
    }
    cameraShake = 0.45;
  }

  function resetWorld(newSeed, opts = null) {
    worldSeed = (typeof newSeed === 'number' && !isNaN(newSeed) && newSeed > 0) ? newSeed : generateUniqueRandomSeed();
    initSeedMix(worldSeed);
    chunkWorkerPool.clear();
    window._worldWarmupUntil = performance.now() + 5500;
    window._rtVolDirty = true;
    currentDimension = 'overworld'; depthOffset = 0;
    dimensionPortals = { overworld: [], nether: [], sift: [], warden: [] };
    lastSiftOverworldPos = null;
    _awakenedRuins.clear(); _activeRuinEncounters.clear(); _risingDreamPortals.length = 0; _ruinLocSeed = -1;
    resetPersistentChestState();
    _clearWorldInteractiveCaches(true, true);
    player.bedSpawn = null;
    initStarterInventory();
    // v45: Mỗi seed có tọa độ khởi đầu riêng biệt trong bán kính ±1800 block (không lặp lại vị trí cố định!)
    const _spSeedA = Math.imul(worldSeed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    const _spSeedB = Math.imul(worldSeed ^ 0xc2b2ae35, 0x27d4eb2f) >>> 0;
    const _spOriginX = ((_spSeedA % 3600) - 1800);
    const _spOriginZ = ((_spSeedB % 3600) - 1800);
    _ruinOriginX = _spOriginX; _ruinOriginZ = _spOriginZ; _ruinLocSeed = -1; _shLocSeed = -1;
    let sp;
    if (opts && opts.deferSpawnChunks) {
      sp = { x: _spOriginX + 0.5, y: 12, z: _spOriginZ + 0.5, yaw: 0 };
    } else {
      const rawSp = findSafeSpawnPoint(_spOriginX, _spOriginZ, true);
      sp = landPlayerScenic(rawSp.x, rawSp.z, rawSp.yaw);
      ensureScenicSakuraAcrossLake(sp);
    }
    _ruinOriginX = Math.round(sp.x); _ruinOriginZ = Math.round(sp.z); _ruinLocSeed = -1; _shLocSeed = -1; _acLocSeed = -1;
    window._worldSpawnPos = { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw };
    player.x = sp.x; player.y = sp.y; player.z = sp.z; player.yaw = sp.yaw; player.pitch = 0.0;
    player.vx = 0; player.vy = 0; player.vz = 0; player.flying = false; player.swiftSneak = 0;
    player._darknessT = 0; player._nightVisionT = 0; player._wardenWarningLevel = 0; player._wardenWarnDecayT = 0;
    if (typeof _elDarknessOv !== 'undefined' && _elDarknessOv) _elDarknessOv.style.opacity = '0';
    player.hp = 20; player.hunger = 20; player.air = player.maxAir; player.xp = 0; player.level = 0; player.daysPlayed = 1;
    player.eyesInWater = false; player.inWater = false; player.eyesInLava = false; player.inLava = false; player.deepWater = false; drownTick = 0; player.burnTime = 0; player._stepCamOff = 0;
    if (typeof _elUnderwater !== 'undefined' && _elUnderwater) { _elUnderwater.classList.remove('active'); _lastEyesInWater = false; }
    if (typeof _elLava !== 'undefined' && _elLava) { _elLava.classList.remove('active'); _lastEyesInLava = false; }
    if (typeof _elFireHud !== 'undefined' && _elFireHud) { _elFireHud.classList.remove('active'); _lastFireHudOn = false; }
    recalcPlayerArmor();
    player.dead = false; player.fallStartY = sp.y; dayTime = 0.34;
    renderHotbar(); renderStatusBars(); renderXpBar();
  }
