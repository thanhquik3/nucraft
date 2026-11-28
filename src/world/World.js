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

  function placeTreeBaseLitter(data, lx, baseWy, lz, wx, wz, leafId = B.OAK_LEAVES) {
    // Low 1-block leaf litter + grass around tree roots (clean cathedral sightlines, no bulky bushes)
    const offs = [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1],[-2,1],[2,-1]];
    for (let k = 0; k < offs.length; k++) {
      const dx = offs[k][0], dz = offs[k][1];
      const bx = lx + dx, bz = lz + dz;
      if (bx < 0 || bx >= CHUNK_W || bz < 0 || bz >= CHUNK_W) continue;
      const rh = hash2i(wx + dx, wz + dz, worldSeed + 773);
      if (rh < 0.56) continue;
      let gy = baseWy;
      let found = false;
      for (let probe = 1; probe >= -2; probe--) {
        const py = baseWy + probe;
        if (py <= MIN_Y || py >= MAX_Y) continue;
        const below = data[((py - 1 - MIN_Y) << 8) | (bz << 4) | bx];
        const here = data[((py - MIN_Y) << 8) | (bz << 4) | bx];
        if (IS_OPAQUE[below] === 1 && below !== leafId && here === B.AIR) { gy = py; found = true; break; }
      }
      if (!found) continue;
      const placeId = rh > 0.87 ? leafId : (rh > 0.70 ? B.SHORT_GRASS : B.TALL_GRASS);
      data[((gy - MIN_Y) << 8) | (bz << 4) | bx] = placeId;
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
      // Towering Cathedral Sequoia / Redwood: thick 3x3-4x4 tapered trunk + wide stepped root buttresses + high layered dark canopy
      const th = Math.min(MAX_Y - baseWy - 7, 30 + Math.floor(r0 * 14));
      const rootFlares = [
        [-2,0],[2,0],[0,-2],[0,2],[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[1,-2],[-1,2],[1,2],
        [-2,-2],[2,-2],[-2,2],[2,2],[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0],[0,-1],[0,1]
      ];
      for (const [rx, rz] of rootFlares) {
        const dMan = Math.abs(rx) + Math.abs(rz);
        const rh = dMan >= 4
          ? (hash2i(wx + rx, wz + rz, worldSeed + 417) > 0.58 ? 1 : 0)
          : (dMan === 3
            ? (hash2i(wx + rx, wz + rz, worldSeed + 419) > 0.34 ? 1 + Math.floor(hash2i(wx + rx * 3, wz + rz * 3, worldSeed + 421) * 3) : 0)
            : (2 + Math.floor(hash2i(wx + rx, wz + rz, worldSeed + 423) * (dMan === 2 ? 4 : 5))));
        for (let ry = -2; ry < rh; ry++) setLocalSafe(data, lx + rx, baseWy + ry, lz + rz, B.SPRUCE_LOG, true);
      }
      const taperY = Math.floor(th * 0.68);
      for (let i = 0; i < th; i++) {
        if (i < taperY) {
          for (let tx = -1; tx <= 1; tx++) for (let tz = -1; tz <= 1; tz++) {
            setLocalSafe(data, lx + tx, baseWy + i, lz + tz, B.SPRUCE_LOG, true);
          }
        } else {
          setLocalSafe(data, lx, baseWy + i, lz, B.SPRUCE_LOG, true);
          setLocalSafe(data, lx + 1, baseWy + i, lz, B.SPRUCE_LOG, true);
          setLocalSafe(data, lx, baseWy + i, lz + 1, B.SPRUCE_LOG, true);
          setLocalSafe(data, lx + 1, baseWy + i, lz + 1, B.SPRUCE_LOG, true);
        }
      }
      // Dense dark layered crown strictly on the upper 32-38% (wide cathedral sightlines below)
      const crownStart = -Math.max(9, Math.floor(th * 0.35));
      for (let dy = crownStart; dy <= 5; dy++) {
        const wy = baseWy + th + dy;
        let rad = 4;
        if (dy >= 4) rad = 1;
        else if (dy >= 2) rad = 2;
        else if (dy >= -3) rad = ((dy & 1) === 0 ? 5 : 4);
        else if (dy >= crownStart + 2) rad = ((dy & 1) === 0 ? 4 : 3);
        else rad = 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.hypot(dx, dz);
          if (dist > rad + 0.35) continue;
          if (dist > rad - 0.6 && hash3i(wx + dx, wy, wz + dz, worldSeed + 431) < 0.32) continue;
          setLocalSafe(data, lx + dx, wy, lz + dz, B.SPRUCE_LEAVES, false);
        }
      }
      placeTreeBaseLitter(data, lx, baseWy, lz, wx, wz, B.SPRUCE_LEAVES);
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
      placeDreamCrystalTree(data, lx, baseWy, lz, wx, wz, 'giant');
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
    // v188: Dragon Nests, Ancient Ruins, Laboratories, Ritual Altars, Libraries & Sky Bridges across outer End islands!
    if (Math.hypot(wx0 + 8, wz0 + 8) >= 96 && typeof stampDragonWorldStructureInChunk === 'function') {
      maxLy = stampDragonWorldStructureInChunk(data, cx, cz, wx0, wz0, maxLy, true);
    }
    maxLy = applyChunkMods(cx, cz, data, maxLy);
    const chE = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chE);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chE;
  }

  // Upgraded procedural Dream Crystal Tree generator (sculpted branching trunk + drooping icicle-like teal/cyan crystal foliage)
  function placeDreamCrystalTree(data, lx, baseWy, lz, wx, wz, variant = 'tall') {
    const r0 = hash2i(wx, wz, worldSeed + 4701);
    const r1 = hash2i(wx + 19, wz - 13, worldSeed + 4717);
    const r2 = hash2i(wx - 31, wz + 23, worldSeed + 4729);
    const r3 = hash2i(wx + 47, wz + 41, worldSeed + 4751);
    const r4 = hash2i(wx - 59, wz - 37, worldSeed + 4783);
    const cfgTree = (typeof getRealmGenCfg === 'function') ? getRealmGenCfg().dreamRealm : { treeMinH: 8, treeMaxH: 22 };
    const isGiant = (variant === 'giant');
    const isMed = (variant === 'medium');
    const minH = isGiant ? Math.max(15, cfgTree.treeMaxH - 6) : (isMed ? cfgTree.treeMinH : Math.max(11, cfgTree.treeMinH + 3));
    const spanH = isGiant ? 6 : (isMed ? 4 : 6);
    const trunkH = Math.min(cfgTree.treeMaxH, minH + Math.floor(r0 * spanH));
    const frostBias = 0.25 + r1 * 0.55; // varies each tree from deep teal to frosted icy cyan (Refs 1, 3, 6)

    // 1) Flared sculpted root buttresses
    const rootDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let ri = 0; ri < 4; ri++) {
      const [rx, rz] = rootDirs[ri];
      const rh = hash2i(wx + rx * 7, wz + rz * 11, worldSeed + 4799 + ri);
      if (isGiant || rh > 0.35) {
        const rootTop = (isGiant && rh > 0.45) ? 2 : 1;
        for (let ry = -1; ry <= rootTop; ry++) setLocalSafe(data, lx + rx, baseWy + ry, lz + rz, B.SIFT_LOG, true);
      }
    }

    // 2) Tall sculpted trunk with subtle organic bend & taper
    let tx = lx, tz = lz;
    const bendDirX = r2 < 0.33 ? -1 : (r2 > 0.66 ? 1 : 0);
    const bendDirZ = r3 < 0.33 ? -1 : (r3 > 0.66 ? 1 : 0);
    const bendStart = Math.max(3, Math.floor(trunkH * 0.45));
    for (let i = 0; i < trunkH; i++) {
      if (!isGiant && i === bendStart && (bendDirX !== 0 || bendDirZ !== 0)) {
        tx = Math.max(2, Math.min(13, tx + bendDirX));
        tz = Math.max(2, Math.min(13, tz + bendDirZ));
      }
      setLocalSafe(data, tx, baseWy + i, tz, B.SIFT_LOG, true);
      if (isGiant && i < trunkH - 2) {
        setLocalSafe(data, tx + 1, baseWy + i, tz, B.SIFT_LOG, true);
        if (i < trunkH - 5) {
          setLocalSafe(data, tx, baseWy + i, tz + 1, B.SIFT_LOG, true);
          if (i < Math.floor(trunkH * 0.55)) setLocalSafe(data, tx + 1, baseWy + i, tz + 1, B.SIFT_LOG, true);
        }
      }
    }

    const pickLeaf = (dx, dy, dz, topY, extraH) => {
      const lh = hash3i(wx + dx * 3, topY + dy * 5, wz + dz * 7, worldSeed + 4813);
      const upperFactor = dy >= 1 ? 0.24 : (dy <= -2 ? -0.18 : 0.0);
      return (lh + upperFactor + extraH < frostBias) ? B.LULLABY_LEAVES : B.SIFT_LEAVES;
    };

    // Helper: layered domed crystal leaf cluster with irregular drooping icicle curtains (Refs 1, 2, 6)
    const stampDroopingCluster = (cx, cy, cz, rad, capH, maxDroop) => {
      for (let dy = -1; dy <= capH; dy++) {
        const layerR = dy === capH ? Math.max(1, rad - 1.4) : (dy === capH - 1 ? rad - 0.5 : rad);
        const rCeil = Math.ceil(layerR);
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          for (let dz = -rCeil; dz <= rCeil; dz++) {
            const d = Math.hypot(dx, dz);
            const jitter = (hash2i(wx + cx + dx, wz + cz + dz, worldSeed + 4831 + dy * 17) - 0.5) * 0.65;
            if (d > layerR + jitter) continue;
            setLocalSafe(data, cx + dx, cy + dy, cz + dz, pickLeaf(dx, dy, dz, cy, d / Math.max(1, rad) * 0.14), false);
            // Outer perimeter icicle curtains drooping asymmetrically below the canopy rim
            if (dy === 0 && d >= layerR - 1.15) {
              const dh = hash2i(wx + cx + dx * 5, wz + cz + dz * 7, worldSeed + 4861);
              const droopLen = Math.max(1, Math.floor(1 + dh * dh * maxDroop));
              for (let hh = 1; hh <= droopLen; hh++) {
                // Taper tips slightly for crisp icicle-like silhouette
                if (hh === droopLen && dh < 0.42 && ((dx + dz) & 1) === 0) break;
                setLocalSafe(data, cx + dx, cy - hh, cz + dz, pickLeaf(dx, -hh, dz, cy, 0.08), false);
              }
              // Subtle emissive cyan hanging vine accent on sparse tips (Ref 7)
              if (dh > 0.89) {
                setLocalSafe(data, cx + dx, cy - droopLen - 1, cz + dz, B.SIFT_VINE, false);
                if (dh > 0.95) setLocalSafe(data, cx + dx, cy - droopLen - 2, cz + dz, B.SIFT_VINE, false);
              }
            }
          }
        }
      }
      // Subtle emissive cyan crystal core tucked beneath the crown
      if (rad >= 2.2) {
        setLocalSafe(data, cx, cy - 1, cz, B.SIFT_CYAN_CRYSTAL, false);
      }
    };

    // 3) Sculpted branching limbs + secondary drooping sub-canopies
    const branchCount = isGiant ? (4 + (r4 > 0.5 ? 1 : 0)) : (isMed ? 2 : (3 + (r4 > 0.55 ? 1 : 0)));
    const baseAngle = r1 * Math.PI * 2.0;
    for (let bi = 0; bi < branchCount; bi++) {
      const ang = baseAngle + (bi * (Math.PI * 2.0 / branchCount)) + (hash2i(wx + bi * 13, wz - bi * 11, worldSeed + 4871) - 0.5) * 0.55;
      const bLen = isGiant ? (3 + (bi & 1)) : (isMed ? 2 : (2 + ((bi + (r0 > 0.5 ? 1 : 0)) & 1)));
      const bStartY = baseWy + Math.max(4, Math.floor(trunkH * (0.50 + 0.10 * (bi % 3))));
      let bx = tx, by = bStartY, bz = tz;
      const stepX = Math.cos(ang), stepZ = Math.sin(ang);
      for (let s = 1; s <= bLen; s++) {
        bx = Math.round(tx + stepX * s);
        bz = Math.round(tz + stepZ * s);
        by = bStartY + Math.floor(s * 0.72);
        setLocalSafe(data, bx, by, bz, B.SIFT_LOG, true);
      }
      const subRad = isGiant ? 2.5 : (isMed ? 1.8 : 2.1);
      stampDroopingCluster(bx, by + 1, bz, subRad, 2, isGiant ? 5.2 : (isMed ? 3.2 : 4.2));
    }

    // 4) Main tiered crown at top of trunk
    const crownY = baseWy + trunkH;
    const crownRad = isGiant ? 3.8 : (isMed ? 2.4 : 3.0);
    stampDroopingCluster(tx, crownY, tz, crownRad, isGiant ? 3 : 2, isGiant ? 6.2 : (isMed ? 3.8 : 5.0));
    return baseWy + trunkH + (isGiant ? 5 : 4);
  }

  // Dragon Realm pale mint/cyan blocky crystal cluster formations (Refs 9 & 10)
  function placeDragonMintCrystalCluster(data, lx, baseWy, lz, wx, wz) {
    const cfgD = (typeof getRealmGenCfg === 'function') ? getRealmGenCfg().dragonRealm : { mintCrystalMinH: 3, mintCrystalMaxH: 8 };
    const r0 = hash2i(wx, wz, worldSeed + 8901);
    const prongCount = 2 + Math.floor(hash2i(wx + 11, wz - 7, worldSeed + 8917) * 3); // 2-4 clustered prongs
    let topMax = baseWy + cfgD.mintCrystalMinH;
    for (let pi = 0; pi < prongCount; pi++) {
      const ph = hash2i(wx + pi * 17, wz - pi * 23, worldSeed + 8929);
      const pa = hash2i(wx - pi * 13, wz + pi * 19, worldSeed + 8933) * Math.PI * 2.0;
      const dist = pi === 0 ? 0 : (1.1 + ph * 1.4);
      const px = Math.round(lx + Math.cos(pa) * dist);
      const pz = Math.round(lz + Math.sin(pa) * dist);
      const h = Math.max(cfgD.mintCrystalMinH, Math.min(cfgD.mintCrystalMaxH, Math.floor(cfgD.mintCrystalMinH + (pi === 0 ? (0.45 + r0 * 0.55) : ph * 0.8) * (cfgD.mintCrystalMaxH - cfgD.mintCrystalMinH + 1))));
      const thickBase = (pi === 0 || h >= 6);
      for (let dy = -1; dy < h; dy++) {
        setLocalSafe(data, px, baseWy + dy, pz, B.DRAGON_MINT_CRYSTAL, true);
        if (thickBase && dy < Math.floor(h * 0.62)) {
          setLocalSafe(data, px + 1, baseWy + dy, pz, B.DRAGON_MINT_CRYSTAL, true);
          if (dy < Math.floor(h * 0.42)) setLocalSafe(data, px, baseWy + dy, pz + 1, B.DRAGON_MINT_CRYSTAL, true);
          if (dy < Math.floor(h * 0.30) && ph > 0.45) setLocalSafe(data, px - 1, baseWy + dy, pz, B.DRAGON_MINT_CRYSTAL, true);
        }
      }
      if (baseWy + h > topMax) topMax = baseWy + h;
    }
    return topMax;
  }

  // b) Singer's Meadow dark-teal thick-trunk flat-canopy edge trees (Ref 2/8)
  function placeMeadowFlatTree(data, lx, baseWy, lz, wx, wz) {
    const r0 = hash2i(wx, wz, worldSeed + 5201);
    const th = 7 + Math.floor(r0 * 4);
    for (let dy = -1; dy < th; dy++) {
      setLocalSafe(data, lx, baseWy + dy, lz, B.SIFT_LOG, true);
      setLocalSafe(data, lx + 1, baseWy + dy, lz, B.SIFT_LOG, true);
      setLocalSafe(data, lx, baseWy + dy, lz + 1, B.SIFT_LOG, true);
      setLocalSafe(data, lx + 1, baseWy + dy, lz + 1, B.SIFT_LOG, true);
    }
    // Broad flat-topped dark teal umbrella canopy (Ref 2/8)
    const cy = baseWy + th;
    for (let dy = 0; dy <= 2; dy++) {
      const rad = dy === 2 ? 2.8 : (dy === 1 ? 4.1 : 3.6);
      const rc = Math.ceil(rad);
      for (let dx = -rc; dx <= rc + 1; dx++) for (let dz = -rc; dz <= rc + 1; dz++) {
        if (Math.hypot(dx - 0.5, dz - 0.5) > rad) continue;
        setLocalSafe(data, lx + dx, cy + dy, lz + dz, (dy === 2 && hash2i(wx + dx, wz + dz, worldSeed + 5209) > 0.72) ? B.LULLABY_LEAVES : B.SIFT_LEAVES, false);
      }
    }
    return cy + 3;
  }

  // c) Lullaby Hills dense blocky ice-blue & white frosted hillside trees (Refs 4/6 & 7/3)
  function placeIceBlockTree(data, lx, baseWy, lz, wx, wz) {
    const r0 = hash2i(wx, wz, worldSeed + 5231);
    const th = 6 + Math.floor(r0 * 5);
    for (let dy = -1; dy < th; dy++) setLocalSafe(data, lx, baseWy + dy, lz, B.SIFT_LOG, true);
    // Blocky cubic frosted canopy draping down around trunk (exact Image 4/6 silhouette!)
    const topY = baseWy + th + 2;
    const rad = r0 > 0.55 ? 2 : 1;
    for (let dy = -Math.max(2, th - 3); dy <= 2; dy++) {
      const rLayer = (dy === 2) ? rad : (rad + (dy <= 0 ? 1 : 0));
      for (let dx = -rLayer; dx <= rLayer; dx++) for (let dz = -rLayer; dz <= rLayer; dz++) {
        if (Math.abs(dx) === rLayer && Math.abs(dz) === rLayer && dy >= 1) continue;
        const fh = hash3i(wx + dx, baseWy + th + dy, wz + dz, worldSeed + 5237);
        if (dy < -1 && Math.abs(dx) < rLayer && Math.abs(dz) < rLayer) continue; // hollow inner skirt around trunk
        if (dy < -2 && fh < 0.36) continue;
        const bid = (dy === 2 && fh > 0.58) ? B.SNOW : (fh > 0.28 ? B.LULLABY_LEAVES : B.SIFT_LEAVES);
        setLocalSafe(data, lx + dx, baseWy + th + dy, lz + dz, bid, false);
      }
    }
    return topY + 1;
  }

  // f) Fungal Sporefields towering multi-colored giant mushrooms (violet-magenta & glowing cyan-blue)
  function placeGiantSiftMushroom(data, lx, baseWy, lz, wx, wz) {
    const r0 = hash2i(wx, wz, worldSeed + 5261);
    const r1 = hash2i(wx + 17, wz - 11, worldSeed + 5273);
    const h = 7 + Math.floor(r0 * 7);
    const isBlue = (r1 > 0.52);
    const capId = isBlue ? B.SIFT_BLUE_CAP : B.SIFT_SPORE_CAP;
    const leanX = r1 < 0.33 ? -1 : (r1 > 0.66 ? 1 : 0);
    let sx = lx, sz = lz;
    for (let dy = -1; dy < h; dy++) {
      if (dy === Math.floor(h * 0.55) && leanX !== 0) sx = Math.max(2, Math.min(13, sx + leanX));
      setLocalSafe(data, sx, baseWy + dy, sz, B.MUSHROOM_STEM, true);
      if (h >= 11 && dy < Math.floor(h * 0.45)) setLocalSafe(data, sx + 1, baseWy + dy, sz, B.MUSHROOM_STEM, true);
    }
    const rad = h >= 11 ? 3 : 2;
    const cy = baseWy + h;
    for (let dy = -1; dy <= 2; dy++) {
      const rL = dy === 2 ? Math.max(1, rad - 1) : (dy === -1 ? rad : rad);
      for (let dx = -rL; dx <= rL; dx++) for (let dz = -rL; dz <= rL; dz++) {
        const d = Math.hypot(dx, dz);
        if (dy === -1 && (d < rL - 0.8 || d > rL + 0.35)) continue;
        if (d > rL + 0.35) continue;
        setLocalSafe(data, sx + dx, cy + dy, sz + dz, capId, true);
        if (dy === -1 && hash2i(wx + dx * 5, wz + dz * 7, worldSeed + 5281) > 0.80) {
          setLocalSafe(data, sx + dx, cy - 2, sz + dz, B.SIFT_VINE, false);
        }
      }
    }
    setLocalSafe(data, sx, cy - 1, sz, B.SIFT_CYAN_CRYSTAL, false);
    return cy + 3;
  }

  // e) Humbler Huskland pale blue-mint stone formations (Ref 1/9)
  function placePaleStoneCluster(data, lx, baseWy, lz, wx, wz) {
    const r0 = hash2i(wx, wz, worldSeed + 5297);
    const h = 3 + Math.floor(r0 * 4);
    for (let dy = -1; dy < h; dy++) {
      setLocalSafe(data, lx, baseWy + dy, lz, B.SIFT_PALE_STONE, true);
      if (dy < h - 1) setLocalSafe(data, lx + 1, baseWy + dy, lz, B.SIFT_PALE_STONE, true);
      if (dy < Math.max(1, h - 2)) setLocalSafe(data, lx, baseWy + dy, lz + 1, B.SIFT_PALE_STONE, true);
      if (dy === 0 && r0 > 0.45) setLocalSafe(data, lx - 1, baseWy, lz, B.SIFT_PALE_STONE, true);
    }
    return baseWy + h;
  }

  // Biome-matched structural block palettes for all 6 Sift biomes
  function getSiftStructPalette(bio) {
    if (bio === BIOMES.SIFT_MEADOW)     return { wall: B.SIFT_LOG, accent: B.LULLABY_GRASS, roof: B.SIFT_LEAVES, floor: B.HUSK_SOIL, glow: B.SIFT_CYAN_CRYSTAL, grass: B.LULLABY_GRASS };
    if (bio === BIOMES.SIFT_LULLABY)    return { wall: B.SIFT_PALE_STONE, accent: B.SIFT_LOG, roof: B.LULLABY_LEAVES, floor: B.TERRACOTTA, glow: B.SIFT_CYAN_CRYSTAL, grass: B.SIFT_GRASS };
    if (bio === BIOMES.SIFT_ICHOR_PONDS)return { wall: B.TERRACOTTA_RED, accent: B.SIFT_PINK_SAND, roof: B.TERRACOTTA, floor: B.SIFT_STONE, glow: B.MUSHROOM_GLOW, grass: B.SIFT_CRIMSON_GRASS };
    if (bio === BIOMES.SIFT_HUSKLAND)   return { wall: B.TERRACOTTA, accent: B.SIFT_PALE_STONE, roof: B.TERRACOTTA_RED, floor: B.HUSK_SOIL, glow: B.SIFT_CYAN_CRYSTAL, grass: B.SIFT_PALE_GRASS };
    if (bio === BIOMES.SIFT_SPOREFIELDS)return { wall: B.SIFT_STONE, accent: B.SIFT_SPORE_CAP, roof: B.SIFT_BLUE_CAP, floor: B.SPORE_TURF, glow: B.SPORE_SHROOM, grass: B.SPORE_TURF };
    return { wall: B.TERRACOTTA_RED, accent: B.TERRACOTTA_WHITE, roof: B.SIFT_LEAVES, floor: B.TERRACOTTA, glow: B.SIFT_CYAN_CRYSTAL, grass: B.SIFT_GRASS };
  }

  // Deterministic Sift Ground Structure regional selector (1 structure per 3x3 chunk region -> players discover landmarks every ~30s!)
  function getSiftGroundStructureForChunk(cx, cz) {
    const reg = 3;
    const rx = Math.floor(cx / reg), rz = Math.floor(cz / reg);
    const ox = Math.floor(hash2i(rx, rz, worldSeed + 5401) * reg);
    const oz = Math.floor(hash2i(rx, rz, worldSeed + 5413) * reg);
    const targetCx = rx * reg + ox, targetCz = rz * reg + oz;
    if (Math.abs(targetCx) <= 1 && Math.abs(targetCz) <= 1) return null; // keep central canyon portal at (0,0) clear
    if (cx !== targetCx || cz !== targetCz) return null;
    const roll = hash2i(rx * 7 + 3, rz * 7 - 5, worldSeed + 5419);
    if (roll > 0.72) return null; // ~72% of 48x48 regions host a biome-matched landmark!
    const kindRoll = hash2i(rx * 11 - 7, rz * 11 + 13, worldSeed + 5431);
    const kind = kindRoll < 0.24 ? 'castle' : (kindRoll < 0.52 ? 'village' : (kindRoll < 0.78 ? 'ruin' : 'den'));
    return { cx: targetCx, cz: targetCz, wx: targetCx * 16 + 8, wz: targetCz * 16 + 8, kind };
  }

  function stampSiftGroundStructureInChunk(data, cx, cz, wx0, wz0, midH, b, maxLy, forceKind = null) {
    const spec = forceKind ? { cx, cz, wx: wx0 + 8, wz: wz0 + 8, kind: forceKind } : getSiftGroundStructureForChunk(cx, cz);
    if (!spec) return maxLy;
    if (!forceKind && midH < WATER_LEVEL + 1) return maxLy;
    const pal = getSiftStructPalette(b);
    const baseY = Math.max(WATER_LEVEL + 1, midH);
    const putChest = (lx, wy, lz, chestId, tag) => {
      setLocalSafe(data, lx, wy, lz, chestId, true);
      naturalChestTags.set(modKey(wx0 + lx, wy, wz0 + lz), tag);
    };

    if (spec.kind === 'castle') {
      // 1) Biome-Matched Fortress / Castle with boss courtyard, twin battlements, vault & mini-boss guardian
      for (let dz = 1; dz <= 14; dz++) for (let dx = 1; dx <= 14; dx++) {
        const rim = (dx === 1 || dx === 14 || dz === 1 || dz === 14);
        const corner = (dx <= 2 || dx >= 13) && (dz <= 2 || dz >= 13);
        const gate = (dz === 14 && dx >= 6 && dx <= 9);
        for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, py === baseY ? pal.floor : pal.wall, true);
        for (let wy = 1; wy <= 11; wy++) setLocalSafe(data, dx, baseY + wy, dz, B.AIR, true);
        if (corner) {
          for (let wy = 1; wy <= 10; wy++) setLocalSafe(data, dx, baseY + wy, dz, (wy % 3 === 0) ? pal.accent : pal.wall, true);
          if ((dx === 1 || dx === 14) && (dz === 1 || dz === 14)) setLocalSafe(data, dx, baseY + 11, dz, pal.glow, true);
        } else if (rim && !gate) {
          for (let wy = 1; wy <= 6; wy++) setLocalSafe(data, dx, baseY + wy, dz, (wy === 6 && ((dx + dz) & 1)) ? B.AIR : ((wy === 3 && (dx === 7 || dx === 8 || dz === 7 || dz === 8)) ? B.GLASS : pal.wall), true);
        } else if (gate) {
          setLocalSafe(data, dx, baseY + 5, dz, pal.accent, true);
          setLocalSafe(data, dx, baseY + 6, dz, pal.wall, true);
        }
      }
      // Inner sanctuary dais + boss treasure vault chest
      for (let dz = 5; dz <= 10; dz++) for (let dx = 5; dx <= 10; dx++) {
        setLocalSafe(data, dx, baseY + 1, dz, pal.accent, true);
      }
      putChest(7, baseY + 2, 7, B.DREAM_BOX_CHEST || B.GOLD_CHEST, 'sift_boss');
      putChest(8, baseY + 2, 7, B.GOLD_CHEST, 'sift_rare');
      setLocalSafe(data, 6, baseY + 2, 6, pal.glow, true);
      setLocalSafe(data, 9, baseY + 2, 6, pal.glow, true);
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 13 - MIN_Y));
    }

    if (spec.kind === 'village') {
      // 2) Biome-Matched Small Village / Explorer Camp (twin cozy houses + glowing well/campfire + common chests)
      const buildHut = (ox, oz, w, d, h) => {
        for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
          const lx = ox + dx, lz = oz + dz;
          const rim = (dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1);
          const door = (dz === d - 1 && dx === Math.floor(w / 2));
          for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, lx, py, lz, py === baseY ? pal.floor : pal.wall, true);
          for (let wy = 1; wy <= h + 2; wy++) setLocalSafe(data, lx, baseY + wy, lz, B.AIR, true);
          if (rim && !(door && true)) {
            for (let wy = 1; wy <= h; wy++) {
              const isWin = (wy === 2 && (dx === Math.floor(w / 2) || dz === Math.floor(d / 2)) && !door);
              setLocalSafe(data, lx, baseY + wy, lz, isWin ? B.GLASS : ((dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1) ? pal.accent : pal.wall), true);
            }
          }
          setLocalSafe(data, lx, baseY + h + 1, lz, pal.roof, true);
          if (dx > 0 && dx < w - 1 && dz > 0 && dz < d - 1) setLocalSafe(data, lx, baseY + h + 2, lz, pal.roof, true);
        }
        setLocalSafe(data, ox + Math.floor(w / 2), baseY + 1, oz + d - 1, B.AIR, true);
        setLocalSafe(data, ox + Math.floor(w / 2), baseY + 2, oz + d - 1, B.AIR, true);
        setLocalSafe(data, ox + Math.floor(w / 2), baseY + h, oz + Math.floor(d / 2), B.LANTERN, true);
        putChest(ox + 1, baseY + 1, oz + 1, B.CHEST, 'sift_common');
      };
      buildHut(1, 2, 6, 6, 4);
      buildHut(9, 7, 6, 6, 4);
      // Center path + glowing village well
      for (let dz = 8; dz <= 11; dz++) for (let dx = 3; dx <= 6; dx++) {
        setLocalSafe(data, dx, baseY, dz, pal.accent, true);
        setLocalSafe(data, dx, baseY + 1, dz, (dx >= 4 && dx <= 5 && dz >= 9 && dz <= 10) ? B.WATER : pal.wall, true);
      }
      setLocalSafe(data, 3, baseY + 2, 8, pal.glow, true);
      setLocalSafe(data, 6, baseY + 2, 11, pal.glow, true);
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 8 - MIN_Y));
    }

    if (spec.kind === 'ruin') {
      // 3) Ancient Temple / Watchtower Ruin with weathered pillars, broken arch, hanging vines & rare chest
      for (let dz = 3; dz <= 12; dz++) for (let dx = 3; dx <= 12; dx++) {
        for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, py === baseY ? pal.floor : pal.wall, true);
        for (let wy = 1; wy <= 10; wy++) setLocalSafe(data, dx, baseY + wy, dz, B.AIR, true);
      }
      for (const [px, pz, ph] of [[3, 3, 9], [12, 3, 7], [3, 12, 8], [12, 12, 10]]) {
        for (let wy = 1; wy <= ph; wy++) setLocalSafe(data, px, baseY + wy, pz, (wy % 3 === 0) ? pal.accent : pal.wall, true);
        setLocalSafe(data, px, baseY + ph + 1, pz, pal.glow, true);
      }
      for (let dx = 3; dx <= 12; dx++) {
        if (dx !== 7) setLocalSafe(data, dx, baseY + 7, 3, pal.accent, true); // weathered broken lintel
        if (dx > 4 && dx < 11 && (dx & 1) === 0) setLocalSafe(data, dx, baseY + 6, 3, B.SIFT_VINE, false);
      }
      for (let dx = 6; dx <= 9; dx++) for (let dz = 6; dz <= 9; dz++) setLocalSafe(data, dx, baseY + 1, dz, pal.accent, true);
      putChest(7, baseY + 2, 7, B.GOLD_CHEST, 'sift_rare');
      setLocalSafe(data, 8, baseY + 2, 8, pal.glow, true);
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 12 - MIN_Y));
    }

    // 4) Monster Den / Sunken Crypt & Underground Trap Maze
    for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
      const rim = (dx === 2 || dx === 13 || dz === 2 || dz === 13);
      for (let dy = -6; dy <= 0; dy++) {
        const wy = baseY + dy;
        const isWall = rim || dy === -6 || (dy === 0 && !(dx >= 6 && dx <= 9 && dz >= 10 && dz <= 12));
        const isMaze = (!rim && dy > -6 && dy < 0 && ((dx === 6 && dz < 10) || (dx === 9 && dz > 5)));
        setLocalSafe(data, dx, wy, dz, (isWall || isMaze) ? ((dy === -6) ? pal.accent : pal.wall) : B.AIR, true);
      }
    }
    // Stone entry staircase descending into the den
    for (let s = 0; s < 5; s++) {
      setLocalSafe(data, 7, baseY - s, 12 - s, pal.accent, true);
      setLocalSafe(data, 8, baseY - s, 12 - s, pal.accent, true);
      for (let cy = 1; cy <= 3; cy++) { setLocalSafe(data, 7, baseY - s + cy, 12 - s, B.AIR, true); setLocalSafe(data, 8, baseY - s + cy, 12 - s, B.AIR, true); }
    }
    // Entrance arch + glowing crystal beacons + trap corridor loot vault
    for (let wy = 1; wy <= 4; wy++) { setLocalSafe(data, 5, baseY + wy, 13, pal.wall, true); setLocalSafe(data, 10, baseY + wy, 13, pal.wall, true); }
    for (let dx = 5; dx <= 10; dx++) setLocalSafe(data, dx, baseY + 5, 13, pal.accent, true);
    setLocalSafe(data, 5, baseY + 6, 13, pal.glow, true);
    setLocalSafe(data, 10, baseY + 6, 13, pal.glow, true);
    setLocalSafe(data, 4, baseY - 5, 4, pal.glow, true);
    setLocalSafe(data, 11, baseY - 5, 4, pal.glow, true);
    putChest(4, baseY - 5, 6, B.GOLD_CHEST, 'sift_rare');
    putChest(11, baseY - 5, 4, B.DIAMOND_CHEST || B.GOLD_CHEST, 'sift_boss');
    return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 7 - MIN_Y));
  }

  // Stamp Floating Islands across ALL 6 Sift biomes (waterfalls, bridges, towers, temples, cottages, boss vaults, ways up!)
  function stampSiftFloatingIslandsInChunk(data, wx0, wz0, maxLy) {
    const visited = new Set();
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const isl = sampleSiftFloatingIslandAt(wx, wz);
        if (!isl) continue;
        const d = isl.dist;
        const rEdge = isl.rad + (valueNoise2D(wx * 0.25, wz * 0.25, worldSeed + 5189) - 0.5) * 1.6;
        if (d > rEdge) continue;
        const pal = getSiftStructPalette(isl.bio);
        const normD = Math.min(1, d / Math.max(1, rEdge));
        const depth = Math.max(2, Math.round((1.0 - normD * normD) * (3.5 + isl.rad * 0.65)));
        for (let dy = -depth; dy <= 0; dy++) {
          const wy = isl.topY + dy;
          const bid = (dy === 0) ? pal.grass : (dy >= -2 ? pal.wall : ((dy === -depth && hash2i(wx, wz, worldSeed + 5197) > 0.72) ? pal.glow : B.SIFT_STONE));
          setLocalSafe(data, lx, wy, lz, bid, true);
        }
        // Hanging climbable cyan vines on outer rim (ways up + silhouette!)
        if (normD > 0.78 && hash2i(wx * 3, wz * 5, worldSeed + 5207) > 0.78) {
          const vLen = 5 + Math.floor(hash2i(wx, wz, worldSeed + 5211) * 18);
          for (let vy = 1; vy <= vLen; vy++) setLocalSafe(data, lx, isl.topY - depth - vy, lz, B.SIFT_VINE, false);
        }
        // Cascading waterfall pouring off one side of the floating island!
        if (isl.hasWaterfall && wx === isl.ix + Math.floor(isl.rad * 0.65) && Math.abs(wz - isl.iz) <= 1) {
          setLocalSafe(data, lx, isl.topY, lz, B.WATER, true);
          for (let wy = isl.topY - 1; wy >= Math.max(WATER_LEVEL + 1, isl.topY - 38); wy--) {
            if (getBlockWorld && false) break;
            const cLy = wy - MIN_Y;
            if (cLy <= 1) break;
            const ci = (lz << 4) | lx;
            if (data[(cLy << 8) | ci] === B.AIR) data[(cLy << 8) | ci] = B.WATER;
            else break;
          }
        }
        // Floating stepping-stone spiral access leading UP to the island!
        if (isl.hasStepSpiral) {
          const keyS = isl.gx + ',' + isl.gz;
          if (!visited.has(keyS)) {
            visited.add(keyS);
            for (let step = 1; step <= 14; step++) {
              const ang = step * 0.55;
              const sr = isl.rad + 1.5;
              const sx = Math.round(isl.ix + Math.cos(ang) * sr) - wx0;
              const sz = Math.round(isl.iz + Math.sin(ang) * sr) - wz0;
              const sy = isl.topY - step * 2;
              if (sy <= WATER_LEVEL + 2) break;
              setLocalSafe(data, sx, sy, sz, pal.accent, true);
              setLocalSafe(data, sx + 1, sy, sz, pal.wall, true);
            }
          }
        }
        // Stamp island landmark centered at (isl.ix, isl.iz) when it falls inside this chunk!
        if (wx === isl.ix && wz === isl.iz) {
          const topY = isl.topY;
          const putIslChest = (cxL, wy, czL, cid, tag) => {
            setLocalSafe(data, cxL, wy, czL, cid, true);
            naturalChestTags.set(modKey(wx0 + cxL, wy, wz0 + czL), tag);
          };
          if (isl.kind === 'boss_vault') {
            for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
              const edge = (Math.abs(dx) === 3 || Math.abs(dz) === 3);
              setLocalSafe(data, lx + dx, topY + 1, lz + dz, pal.accent, true);
              if (edge && (Math.abs(dx) === 3 && Math.abs(dz) === 3)) {
                for (let wy = 2; wy <= 7; wy++) setLocalSafe(data, lx + dx, topY + wy, lz + dz, pal.wall, true);
                setLocalSafe(data, lx + dx, topY + 8, lz + dz, pal.glow, true);
              }
              if (Math.hypot(dx, dz) <= 3.2) setLocalSafe(data, lx + dx, topY + 7, lz + dz, pal.roof, true);
            }
            putIslChest(lx, topY + 2, lz, B.DREAM_BOX_CHEST || B.DIAMOND_CHEST, 'sift_boss');
            putIslChest(lx + 1, topY + 2, lz, B.GOLD_CHEST, 'sift_floating');
            setLocalSafe(data, lx, topY + 8, lz, B.END_CRYSTAL_BLOCK, true);
          } else if (isl.kind === 'temple') {
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
              setLocalSafe(data, lx + dx, topY + 1, lz + dz, pal.accent, true);
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
                for (let wy = 2; wy <= 5; wy++) setLocalSafe(data, lx + dx, topY + wy, lz + dz, pal.wall, true);
              }
              setLocalSafe(data, lx + dx, topY + 6, lz + dz, pal.roof, true);
            }
            putIslChest(lx, topY + 2, lz, B.GOLD_CHEST, 'sift_floating');
            setLocalSafe(data, lx, topY + 7, lz, pal.glow, true);
          } else if (isl.kind === 'tower') {
            for (let wy = 1; wy <= 9; wy++) {
              for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
                const rim = (Math.abs(dx) === 1 || Math.abs(dz) === 1);
                setLocalSafe(data, lx + dx, topY + wy, lz + dz, rim ? ((wy % 3 === 0) ? pal.accent : pal.wall) : B.AIR, true);
              }
            }
            setLocalSafe(data, lx, topY + 10, lz, pal.glow, true);
            putIslChest(lx, topY + 1, lz, B.GOLD_CHEST, 'sift_floating');
          } else if (isl.kind === 'cottage') {
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
              const rim = (Math.abs(dx) === 2 || Math.abs(dz) === 2);
              for (let wy = 1; wy <= 3; wy++) {
                const door = (dz === 2 && dx === 0 && wy <= 2);
                setLocalSafe(data, lx + dx, topY + wy, lz + dz, (rim && !door) ? pal.wall : B.AIR, true);
              }
              setLocalSafe(data, lx + dx, topY + 4, lz + dz, pal.roof, true);
            }
            setLocalSafe(data, lx, topY + 3, lz, B.LANTERN, true);
            putIslChest(lx - 1, topY + 1, lz - 1, B.CHEST, 'sift_floating');
          } else {
            // Glowing crystal tree or giant mushroom island + reward chest
            if (isl.bio === BIOMES.SIFT_SPOREFIELDS) placeGiantSiftMushroom(data, lx, topY + 1, lz, wx, wz);
            else placeDreamCrystalTree(data, lx, topY + 1, lz, wx, wz, 'medium');
            putIslChest(lx + 2, topY + 1, lz, B.CHEST, 'sift_floating');
          }
          maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topY + 14 - MIN_Y));
        }
        maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, isl.topY + 2 - MIN_Y));
      }
    }
    return maxLy;
  }

  // v188: Dragon World (Dragon Realm & Outer End) Rich Structures: Dragon Nests, Vaults, Labs, Ritual Altars, Ancient Libraries & Sky Bridges!
  function getDragonStructureForChunk(cx, cz) {
    const reg = 3;
    const rx = Math.floor(cx / reg), rz = Math.floor(cz / reg);
    if (Math.abs(rx) <= 0 && Math.abs(rz) <= 0) return null;
    const ox = Math.floor(hash2i(rx, rz, worldSeed + 9103) * reg);
    const oz = Math.floor(hash2i(rx, rz, worldSeed + 9109) * reg);
    const targetCx = rx * reg + ox, targetCz = rz * reg + oz;
    if (cx !== targetCx || cz !== targetCz) return null;
    const roll = hash2i(rx * 13 + 5, rz * 13 - 7, worldSeed + 9127);
    if (roll > 0.68) return null;
    const kR = hash2i(rx * 5 - 11, rz * 5 + 17, worldSeed + 9133);
    const kind = kR < 0.28 ? 'nest' : (kR < 0.48 ? 'vault' : (kR < 0.66 ? 'lab' : (kR < 0.84 ? 'altar' : 'library')));
    return { cx: targetCx, cz: targetCz, wx: targetCx * 16 + 8, wz: targetCz * 16 + 8, kind };
  }

  function stampDragonWorldStructureInChunk(data, cx, cz, wx0, wz0, maxLy, isEndDim = false, forceKind = null) {
    const spec = forceKind ? { cx, cz, wx: wx0 + 8, wz: wz0 + 8, kind: forceKind } : getDragonStructureForChunk(cx, cz);
    if (!spec) return maxLy;
    const midWx = wx0 + 8, midWz = wz0 + 8;
    if (!forceKind && !isEndDim && (Math.hypot(midWx, midWz) < 28 || Math.hypot(midWx, midWz - 136) < 34)) return maxLy;
    const rawH = getTerrainHeight(midWx, midWz, getBiomeAt(midWx, midWz));
    if (!forceKind && isEndDim && rawH < -20) return maxLy; // skip void gaps in End
    const baseY = Math.max(isEndDim ? 6 : 14, rawH);
    const stoneA = isEndDim ? B.END_STONE_BRICKS : B.DRAGON_RED_STONE;
    const stoneB = isEndDim ? B.PURPUR_BLOCK : B.OBSIDIAN;
    const accent = isEndDim ? B.PURPUR_PILLAR : B.DRAGON_MINT_CRYSTAL;
    const putDChest = (lx, wy, lz, cid, tag) => {
      setLocalSafe(data, lx, wy, lz, cid, true);
      naturalChestTags.set(modKey(wx0 + lx, wy, wz0 + lz), tag);
    };

    if (spec.kind === 'nest') {
      // 1) Dragon Nest: spiked rock ring, curved dragon bones, glowing dragon egg centerpiece & treasure chest!
      for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
        const d = Math.hypot(dx - 7.5, dz - 7.5);
        if (d > 5.8) continue;
        for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, py === baseY ? (d > 4.2 ? B.OBSIDIAN : stoneA) : stoneA, true);
        for (let wy = 1; wy <= 8; wy++) setLocalSafe(data, dx, baseY + wy, dz, B.AIR, true);
        if (d >= 4.2 && d <= 5.5) {
          const spikeH = 2 + (((dx * 7 + dz * 11) & 3) === 0 ? 3 : (((dx + dz) & 1) ? 1 : 0));
          for (let wy = 1; wy <= spikeH; wy++) setLocalSafe(data, dx, baseY + wy, dz, (wy === spikeH && spikeH >= 4) ? accent : B.OBSIDIAN, true);
        }
      }
      // Rib-like Dragon Bone arches curving over the nest
      for (let i = 0; i < 4; i++) {
        const dy = 1 + Math.min(3, i);
        setLocalSafe(data, 4 + i, baseY + dy, 4, B.BONE_BLOCK, true);
        setLocalSafe(data, 11 - i, baseY + dy, 11, B.BONE_BLOCK, true);
      }
      const eggs = [B.DRAGON_EGG_FIRE, B.DRAGON_EGG_ICE, B.DRAGON_EGG_WATER, B.DRAGON_EGG_LEAF, B.DRAGON_EGG_EARTH, B.ENDER_DRAGON_EGG];
      const eggId = eggs[Math.floor(hash2i(cx, cz, worldSeed + 9151) * eggs.length)] || B.ENDER_DRAGON_EGG;
      setLocalSafe(data, 7, baseY + 1, 7, B.OBSIDIAN, true);
      setLocalSafe(data, 7, baseY + 2, 7, eggId, true);
      putDChest(9, baseY + 1, 7, B.GOLD_CHEST, 'dragon_nest');
      putDChest(6, baseY + 1, 9, B.CHEST, 'dragon_nest');
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 8 - MIN_Y));
    }

    if (spec.kind === 'vault') {
      // 2) Fortified Dragon Treasure Vault (Obsidian + Purpur + End Stone unusual monolith)
      for (let dz = 3; dz <= 12; dz++) for (let dx = 3; dx <= 12; dx++) {
        const rim = (dx === 3 || dx === 12 || dz === 3 || dz === 12);
        const door = (dz === 12 && (dx === 7 || dx === 8));
        for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, B.OBSIDIAN, true);
        for (let wy = 1; wy <= 8; wy++) {
          const ceil = (wy === 8);
          const wall = rim && !(door && wy <= 3);
          setLocalSafe(data, dx, baseY + wy, dz, (wall || ceil) ? ((wy % 2 === 0) ? B.PURPUR_BLOCK : B.OBSIDIAN) : B.AIR, true);
        }
      }
      setLocalSafe(data, 3, baseY + 9, 3, accent, true);
      setLocalSafe(data, 12, baseY + 9, 3, accent, true);
      setLocalSafe(data, 3, baseY + 9, 12, accent, true);
      setLocalSafe(data, 12, baseY + 9, 12, accent, true);
      setLocalSafe(data, 7, baseY + 1, 5, B.END_ROD, true);
      setLocalSafe(data, 8, baseY + 1, 5, B.END_ROD, true);
      putDChest(7, baseY + 1, 6, B.DIAMOND_CHEST || B.GOLD_CHEST, 'dragon_vault');
      putDChest(8, baseY + 1, 6, B.GOLD_CHEST, 'dragon_vault');
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 10 - MIN_Y));
    }

    if (spec.kind === 'lab') {
      // 3) Ancient Dragon Laboratory (crystal containment tubes, enchanting bench, glowing rods & lab chest)
      for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
        const rim = (dx === 2 || dx === 13 || dz === 2 || dz === 13);
        const door = (dz === 13 && (dx === 7 || dx === 8));
        for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, B.END_STONE_BRICKS, true);
        for (let wy = 1; wy <= 7; wy++) {
          const isWin = rim && wy >= 2 && wy <= 4 && (dx === 5 || dx === 10 || dz === 5 || dz === 10);
          setLocalSafe(data, dx, baseY + wy, dz, (wy === 7 || (rim && !(door && wy <= 3))) ? (isWin ? B.GLASS : ((wy === 7) ? stoneB : B.PURPUR_PILLAR)) : B.AIR, true);
        }
      }
      // Twin crystal containment vats
      for (const [vx, vz] of [[5, 5], [10, 5]]) {
        for (let wy = 1; wy <= 5; wy++) setLocalSafe(data, vx, baseY + wy, vz, (wy === 1 || wy === 5) ? B.OBSIDIAN : accent, true);
      }
      setLocalSafe(data, 7, baseY + 1, 8, B.ENCHANT_TABLE, true);
      setLocalSafe(data, 8, baseY + 6, 8, B.END_ROD, true);
      putDChest(10, baseY + 1, 10, B.GOLD_CHEST, 'dragon_lab');
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 9 - MIN_Y));
    }

    if (spec.kind === 'altar') {
      // 4) Ritual Altar + Broken Obsidian-Purpur Sky Bridge / Temple
      for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
        const d = Math.hypot(dx - 7.5, dz - 7.5);
        if (d > 6.0) continue;
        for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, py === baseY ? (d > 4.6 ? B.OBSIDIAN : B.PURPUR_BLOCK) : stoneA, true);
        for (let wy = 1; wy <= 9; wy++) setLocalSafe(data, dx, baseY + wy, dz, B.AIR, true);
        if (d <= 2.6) setLocalSafe(data, dx, baseY + 1, dz, B.END_STONE_BRICKS, true);
      }
      for (const [px, pz] of [[3, 3], [12, 3], [3, 12], [12, 12]]) {
        for (let wy = 1; wy <= 7; wy++) setLocalSafe(data, px, baseY + wy, pz, (wy % 2 === 0) ? B.PURPUR_PILLAR : B.OBSIDIAN, true);
        setLocalSafe(data, px, baseY + 8, pz, accent, true);
      }
      // Elevated obsidian-purpur bridge span across the altar
      for (let dx = 1; dx <= 14; dx++) {
        setLocalSafe(data, dx, baseY + 7, 7, B.PURPUR_BLOCK, true);
        setLocalSafe(data, dx, baseY + 7, 8, B.OBSIDIAN, true);
      }
      setLocalSafe(data, 7, baseY + 2, 7, B.END_CRYSTAL_BLOCK, true);
      putDChest(8, baseY + 2, 8, B.GOLD_CHEST, 'dragon_altar');
      return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 10 - MIN_Y));
    }

    // 5) Ancient Dragon Library (obsidian-framed bookshelf halls, enchanting table, end rods, library loot chest)
    for (let dz = 2; dz <= 13; dz++) for (let dx = 2; dx <= 13; dx++) {
      const rim = (dx === 2 || dx === 13 || dz === 2 || dz === 13);
      const door = (dz === 13 && (dx === 7 || dx === 8));
      for (let py = baseY - 3; py <= baseY; py++) setLocalSafe(data, dx, py, dz, B.PURPUR_BLOCK, true);
      for (let wy = 1; wy <= 8; wy++) {
        setLocalSafe(data, dx, baseY + wy, dz, (wy === 8 || (rim && !(door && wy <= 3))) ? ((wy === 1 || wy === 8) ? B.OBSIDIAN : B.END_STONE_BRICKS) : B.AIR, true);
      }
    }
    for (let wy = 1; wy <= 5; wy++) {
      for (let dz = 4; dz <= 10; dz += 2) {
        setLocalSafe(data, 4, baseY + wy, dz, B.BOOKSHELF, true);
        setLocalSafe(data, 11, baseY + wy, dz, B.BOOKSHELF, true);
      }
      for (let dx = 5; dx <= 10; dx++) setLocalSafe(data, dx, baseY + wy, 3, B.BOOKSHELF, true);
    }
    setLocalSafe(data, 7, baseY + 1, 7, B.ENCHANT_TABLE, true);
    setLocalSafe(data, 7, baseY + 7, 7, B.END_ROD, true);
    setLocalSafe(data, 8, baseY + 7, 7, B.END_ROD, true);
    putDChest(8, baseY + 1, 5, B.GOLD_CHEST, 'dragon_library');
    return Math.max(maxLy, Math.min(WORLD_H - 1, baseY + 10 - MIN_Y));
  }

  // Shared procedural chunk builder for BOTH Dream Biome ('sift') and Dragon Realm ('dragon_realm')
  // Terrain SHAPE & BUILD METHOD are shared; each biome has its own distinct palette, vegetation, floating islands & ground structures!
  function _buildLayeredRealmChunk(cx, cz, wx0, wz0, data, realmKind) {
    const isDream = (realmKind === 'sift');
    const cfg = (typeof getRealmGenCfg === 'function') ? getRealmGenCfg() : null;
    const sh = cfg.sharedTerrain;
    const rc = isDream ? cfg.dreamRealm : cfg.dragonRealm;
    const sOff = isDream ? 4400 : 8300;
    let maxLy = 0;
    if (!chunkWorkerPool.take(wx0, wz0, 0)) fillCoarseCaveGrid(wx0, wz0);

    const baseHeights = new Int16Array(256);
    const colIsMesa = new Uint8Array(256);
    const colIsPond = new Uint8Array(256);
    const colIsStep = new Uint8Array(256);
    const colIsTrench = new Uint8Array(256);
    const colIsIchor = new Uint8Array(256);
    const colEdgeF = new Float32Array(256);
    const colBioArr = new Array(256);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const ci = (lz << 4) | lx;
        const b = getBiomeAt(wx, wz);
        colBioArr[ci] = b;
        colBiomes[ci] = b.id;
        let baseSample = sampleSharedMesaBase(wx, wz, realmKind, b);
        let bh = baseSample.baseH;
        if (!isDream) {
          const dC = Math.hypot(wx, wz), dB = Math.hypot(wx, wz - 136);
          if (dC < 16) bh = 18;
          else if (dB < 22) bh = 20;
        }
        baseHeights[ci] = bh;
        colHeights[ci] = bh;
        colIsMesa[ci] = baseSample.isMesaPlateau ? 1 : 0;
        colIsPond[ci] = baseSample.isPondBasin ? 1 : 0;
        colIsStep[ci] = baseSample.isSteppingStone ? 1 : 0;
        colIsTrench[ci] = baseSample.isTrench ? 1 : 0;
        colIsIchor[ci] = baseSample.isIchorPit ? 1 : 0;
        colEdgeF[ci] = baseSample.edgeFactor || 0;
      }
    }

    // Per-realm stratified rock block picker (STRICT PALETTE ISOLATION!)
    const pickStrataBlock = (wx, wy, wz, b, isSpire, isSandAccent, isVolcanicCap) => {
      const warp = Math.floor(valueNoise2D(wx * 0.04, wz * 0.04, worldSeed + sOff + 911) * 3.0);
      const band = ((wy + warp) % 9 + 9) % 9;
      if (isDream) {
        if (isSandAccent) return B.SIFT_PINK_SAND;
        if (b === BIOMES.SIFT_SPOREFIELDS) return (band === 0 || band === 4) ? B.SIFT_STONE : B.HUSK_SOIL;
        if (b === BIOMES.SIFT_ICHOR_PONDS) return (band === 3 && !isSpire) ? B.SIFT_PINK_SAND : (band === 0 || band === 5 ? B.TERRACOTTA_RED : B.TERRACOTTA);
        if (band === 0 || band === 5) return B.TERRACOTTA_RED;
        if (band === 2) return B.HUSK_SOIL;
        if (band === 4 && (isSpire || b === BIOMES.SIFT_CANYON || b === BIOMES.SIFT_HUSKLAND)) return B.TERRACOTTA_WHITE;
        if (band === 7) return B.TERRACOTTA_ORANGE;
        return B.TERRACOTTA;
      }
      if (isVolcanicCap) return B.OBSIDIAN;
      if (isSandAccent) return B.DRAGON_SAND_STONE;
      if (band === 1 || band === 4 || band === 7) return B.DRAGON_RED_TERRACOTTA;
      if (band === 6 && valueNoise2D(wx * 0.055, wz * 0.055, worldSeed + sOff + 929) > 0.62) return B.DRAGON_SAND_STONE;
      return B.DRAGON_RED_STONE;
    };

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx;
        const ci = (lz << 4) | lx;
        const b = colBioArr[ci];
        const baseH = baseHeights[ci];
        const isMesa = colIsMesa[ci] === 1;
        const isPond = colIsPond[ci] === 1;
        const isStep = colIsStep[ci] === 1;
        const isTrench = colIsTrench[ci] === 1;
        const isIchor = colIsIchor[ci] === 1;
        const edgeF = colEdgeF[ci];
        const dHub = Math.hypot(wx, wz);
        const dArena = !isDream ? Math.hypot(wx, wz - 136) : 9999;
        const sp = sampleSharedSpireAt(wx, wz, realmKind);
        const sandSlopeN = !isDream ? fbm2D(wx * 0.022 + 31.1, wz * 0.022 - 17.9, 2, 0.5, 2.0, worldSeed + sOff + 937) : 0;
        const isSandSlope = (!isDream && sandSlopeN > rc.sandAccentThreshold);

        let colTopY = isDream ? Math.max(WATER_LEVEL, baseH) : baseH;
        if (sp && sp.topY > colTopY) colTopY = sp.topY;
        const archScanTop = Math.min(MAX_Y - 2, Math.max(colTopY, baseH + 16));
        const maxFillLy = Math.min(WORLD_H - 1, colTopY - MIN_Y);
        if (maxFillLy > maxLy) maxLy = maxFillLy;

        let isCliffEdge = false;
        let maxDrop = 0;
        if (baseH >= (isDream ? WATER_LEVEL + 4 : rc.baseMinY + 7)) {
          const hN = lz > 0 ? baseHeights[ci - 16] : sampleSharedMesaBase(wx, wz - 1, realmKind, b, true).baseH;
          const hS = lz < 15 ? baseHeights[ci + 16] : sampleSharedMesaBase(wx, wz + 1, realmKind, b, true).baseH;
          const hW = lx > 0 ? baseHeights[ci - 1] : sampleSharedMesaBase(wx - 1, wz, realmKind, b, true).baseH;
          const hE = lx < 15 ? baseHeights[ci + 1] : sampleSharedMesaBase(wx + 1, wz, realmKind, b, true).baseH;
          maxDrop = baseH - Math.min(hN, hS, hW, hE);
          if (isMesa && maxDrop >= 3) isCliffEdge = true;
        }
        const overhangN = isCliffEdge ? valueNoise2D(wx * sh.overhangScale, wz * sh.overhangScale, worldSeed + sOff + 947) : 0;
        const carveUndercut = isCliffEdge && overhangN > sh.overhangThreshold;

        // Per-biome surface block selection (6 completely unmistakable Sift biomes!)
        let baseTopBlock;
        if (isDream) {
          if (isIchor) {
            baseTopBlock = B.SIFT_PINK_SAND;
          } else if (isTrench) {
            baseTopBlock = B.SIFT_PINK_SAND; // Exposed pink sand in Burrows & Ichor trenches (Refs 5 & 10!)
          } else if (baseH < WATER_LEVEL) {
            baseTopBlock = (hash2i(wx, wz, worldSeed + 4511) > 0.92) ? B.SIFT_CYAN_CRYSTAL : B.HUSK_SOIL;
          } else if (isStep) {
            baseTopBlock = (b === BIOMES.SIFT_HUSKLAND) ? B.SIFT_PALE_GRASS : ((b === BIOMES.SIFT_MEADOW) ? B.LULLABY_GRASS : B.SIFT_GRASS);
          } else if (b === BIOMES.SIFT_MEADOW) {
            // b) Singer's Meadow: pure soft pink grass plains (Ref 2/8)
            baseTopBlock = B.LULLABY_GRASS;
          } else if (b === BIOMES.SIFT_LULLABY || b === BIOMES.SIFT_LULLABY_TOP) {
            // c) Lullaby Hills: teal-green grass on hills, exposed red mountain rock on steep slopes & peaks (Refs 4/6 & 7/3)
            baseTopBlock = (maxDrop >= 2 || baseH >= WATER_LEVEL + 24) ? B.TERRACOTTA_RED : B.SIFT_GRASS;
          } else if (b === BIOMES.SIFT_ICHOR_PONDS) {
            // d) Burrows & Ichor: deep crimson grass with pink sand along edges (Refs 5 & 10)
            baseTopBlock = (maxDrop >= 3) ? B.TERRACOTTA_RED : B.SIFT_CRIMSON_GRASS;
          } else if (b === BIOMES.SIFT_HUSKLAND) {
            // e) Humbler Huskland: pale sage-green grass mixed with red soil & red mountain peaks (Ref 1/9)
            const redPatch = valueNoise2D(wx * 0.08, wz * 0.08, worldSeed + 4523);
            baseTopBlock = (baseH >= WATER_LEVEL + 14 || maxDrop >= 2 || redPatch > 0.74) ? B.TERRACOTTA_RED : B.SIFT_PALE_GRASS;
          } else if (b === BIOMES.SIFT_SPOREFIELDS) {
            // f) Fungal Sporefields: spongy purple-violet fungal carpet
            baseTopBlock = B.SPORE_TURF;
          } else {
            // a) The Sift (Central Canyon): red-pink terracotta cliffs & vivid teal grass ledges (Refs 1, 2, 7)
            baseTopBlock = (isCliffEdge || maxDrop >= 3) ? B.TERRACOTTA_RED : B.SIFT_GRASS;
          }
        } else {
          if (dArena < 20) {
            baseTopBlock = (dArena > 17.5) ? B.OBSIDIAN : (((Math.abs(wx) + Math.abs(wz - 136)) % 4 === 0) ? B.DRAGON_RED_TERRACOTTA : B.DRAGON_RED_STONE);
          } else if (isSandSlope && !isCliffEdge) {
            baseTopBlock = B.DRAGON_SAND_STONE;
          } else if (isCliffEdge || b === BIOMES.DR_CAVERNS) {
            baseTopBlock = B.DRAGON_RED_TERRACOTTA;
          } else if (b === BIOMES.DR_PEAKS && baseH >= 38) {
            baseTopBlock = B.DRAGON_RED_STONE;
          } else {
            baseTopBlock = (sandSlopeN > 0.54) ? B.DRAGON_RED_TERRACOTTA : B.DRAGON_CAP_GRASS;
          }
        }

        let highestSolidY = MIN_Y;
        for (let ly = 0; ly <= maxFillLy; ly++) {
          const wy = MIN_Y + ly;
          const idx = (ly << 8) | ci;
          if (wy === MIN_Y) { data[idx] = B.BEDROCK; continue; }

          if (wy <= baseH) {
            if (carveUndercut && wy <= baseH - 2 && wy >= baseH - (1 + sh.overhangCarveDepth)) {
              data[idx] = (isDream && wy <= WATER_LEVEL && !isTrench) ? B.WATER : B.AIR;
              continue;
            }
            // Burrow cave tunnels (Burrows & Ichor) + mushroom caves (Fungal Sporefields)
            const caveThresh = isDream
              ? (b === BIOMES.SIFT_ICHOR_PONDS ? 0.58 : (b === BIOMES.SIFT_SPOREFIELDS ? 0.62 : 0.75))
              : (b === BIOMES.DR_CAVERNS ? 0.64 : 0.75);
            if (wy < baseH - 2 && wy > MIN_Y + 4 && dArena >= 24 && sampleCaveFast(lx, ly, lz) > caveThresh) {
              const cH = hash3i(wx, wy, wz, worldSeed + sOff + 777);
              if (isDream) {
                if (b === BIOMES.SIFT_ICHOR_PONDS && wy <= WATER_LEVEL - 4) data[idx] = B.LAVA; // glowing crimson ichor in deep burrow caves!
                else if (wy === MIN_Y + 5 && cH > 0.88) data[idx] = B.SPORE_SHROOM;
                else if (cH > 0.990 && wy < baseH - 5) data[idx] = B.SIFT_CYAN_CRYSTAL;
                else data[idx] = B.AIR;
              } else {
                data[idx] = (wy === MIN_Y + 5 && cH > 0.92) ? B.DRAGON_MINT_CRYSTAL : B.AIR;
              }
              continue;
            }
            if (wy === baseH) {
              data[idx] = baseTopBlock;
            } else if (wy >= baseH - 10) {
              data[idx] = pickStrataBlock(wx, wy, wz, b, false, isSandSlope || isTrench, false);
            } else {
              const oh = hash3i(wx, wy, wz, worldSeed + sOff);
              if (isDream) {
                if (wy < 2 && oh > 0.994) data[idx] = B.DREAM_PRISM_ORE;
                else if (wy < 5 && oh > 0.990) data[idx] = B.AETHERIUM_ORE;
                else if (wy < 8 && oh > 0.986) data[idx] = B.NEBULA_ORE;
                else if (wy < 12 && oh > 0.981) data[idx] = B.ICHOR_ORE;
                else if (wy < 20 && oh > 0.974) data[idx] = B.MOONSTONE_ORE;
                else data[idx] = B.SIFT_STONE;
              } else {
                if (wy < 14 && oh > 0.985) data[idx] = B.DRAGON_CRYSTAL_ORE;
                else data[idx] = pickStrataBlock(wx, wy, wz, b, false, false, false);
              }
            }
            if (wy > highestSolidY) highestSolidY = wy;
          } else if (isDream && wy <= WATER_LEVEL) {
            // Deep Burrows & Ichor pits fill with red glowing ichor (B.LAVA); lakes in all other biomes fill with 7-color Dream Water!
            if (isIchor && wy <= WATER_LEVEL - 2) data[idx] = B.LAVA;
            else if (!isTrench) data[idx] = B.WATER;
          }
        }

        // 2) Tall stacked spire pillars with flared flat overhanging grass-topped caps (per-biome customized!)
        let spireTopHitY = -9999;
        if (sp) {
          const yStart = Math.max(MIN_Y + 2, sp.anchorY - 3);
          const yEnd = Math.min(MAX_Y - 2, sp.topY);
          for (let wy = yStart; wy <= yEnd; wy++) {
            const relY = wy - sp.anchorY;
            const cxs = sp.sx + sp.leanX * Math.max(0, relY);
            const czs = sp.sz + sp.leanZ * Math.max(0, relY);
            const radY = evalSharedSpireRadiusAtY(sp, wy, wx, wz, realmKind);
            if (radY > 0 && Math.hypot(wx - cxs, wz - czs) <= radY) {
              const ly = wy - MIN_Y;
              const idx = (ly << 8) | ci;
              let sBid;
              if (wy === sp.topY && !sp.isSandSpire) {
                if (sp.hasVolcanicCap) sBid = B.OBSIDIAN;
                else if (!isDream) sBid = B.DRAGON_CAP_GRASS;
                else if (sp.isHuskland) sBid = B.SIFT_PALE_GRASS;
                else if (sp.isBurrows) sBid = B.SIFT_CRIMSON_GRASS;
                else sBid = B.SIFT_GRASS;
              } else if (sp.hasVolcanicCap && wy >= sp.topY - 2) {
                sBid = B.OBSIDIAN;
              } else {
                sBid = pickStrataBlock(wx, wy, wz, b, true, sp.isSandSpire, false);
              }
              data[idx] = sBid;
              if (ly > maxLy) maxLy = ly;
              if (wy > spireTopHitY) spireTopHitY = wy;
              if (wy > highestSolidY) highestSolidY = wy;
            }
          }
          if (spireTopHitY > colHeights[ci]) colHeights[ci] = spireTopHitY;
          // In Central The Sift, place glowing mushrooms & crystal trees ON TOP of huge rock pillars (Ref 1/9!)
          if (isDream && sp.isCentralSift && wx === Math.round(sp.sx + sp.leanX * sp.height) && wz === Math.round(sp.sz + sp.leanZ * sp.height) && spireTopHitY === sp.topY) {
            const topTr = (sp.seedH > 0.45)
              ? placeDreamCrystalTree(data, lx, sp.topY + 1, lz, wx, wz, 'medium')
              : placeGiantSiftMushroom(data, lx, sp.topY + 1, lz, wx, wz);
            maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topTr - MIN_Y));
          }
        }

        // 3) Natural voxel rock arches / stone bridges spanning canyons & valleys (Refs 1, 10, 11)
        if (!isDream || b === BIOMES.SIFT_CANYON || b === BIOMES.SIFT_HUSKLAND || b === BIOMES.SIFT_ICHOR_PONDS) {
          for (let wy = Math.max(MIN_Y + 3, baseH - 1); wy <= archScanTop; wy++) {
            const arch = sampleSharedArchAt(wx, wy, wz, realmKind);
            if (arch && arch.hit) {
              const ly = wy - MIN_Y;
              const idx = (ly << 8) | ci;
              if (data[idx] === B.AIR || data[idx] === B.WATER) {
                data[idx] = arch.isTop
                  ? (isDream ? (b === BIOMES.SIFT_HUSKLAND ? B.SIFT_PALE_GRASS : (b === BIOMES.SIFT_ICHOR_PONDS ? B.SIFT_CRIMSON_GRASS : B.SIFT_GRASS)) : B.DRAGON_CAP_GRASS)
                  : pickStrataBlock(wx, wy, wz, b, true, false, false);
                if (ly > maxLy) maxLy = ly;
                if (wy > highestSolidY) highestSolidY = wy;
              }
            }
          }
        }

        // 4) Hanging cyan vines along overhanging mesa cliff & spire rims in Dream Biome (Ref 7)
        if (isDream && (carveUndercut || spireTopHitY >= baseH + 8) && b !== BIOMES.SIFT_MEADOW) {
          const vh = hash2i(wx * 5 + 3, wz * 5 - 11, worldSeed + 4931);
          if (vh > 0.80) {
            const vineTopY = (spireTopHitY >= baseH + 8) ? (spireTopHitY - 1) : (baseH - 2);
            const vineLen = 2 + Math.floor(hash2i(wx, wz, worldSeed + 4937) * 5);
            for (let vy = 0; vy < vineLen; vy++) {
              const targetY = vineTopY - vy;
              if (targetY <= WATER_LEVEL + 1) break;
              const tLy = targetY - MIN_Y;
              if (tLy > 1 && data[(tLy << 8) | ci] === B.AIR) data[(tLy << 8) | ci] = B.SIFT_VINE;
            }
          }
        }

        // 5) Biome-specific trees, giant mushrooms, pale stone clusters & flora (100% distinct per biome!)
        const surfaceY = highestSolidY;
        const nearSpawnClear = isDream ? (Math.abs(wx) <= 11 && wz >= -17 && wz <= 9) : (dHub < 15 || dArena < 23);
        const surfaceBid = (surfaceY >= MIN_Y && surfaceY <= MAX_Y) ? data[((surfaceY - MIN_Y) << 8) | ci] : B.AIR;
        const aboveClear = (surfaceY + 1 <= MAX_Y) && data[((surfaceY + 1 - MIN_Y) << 8) | ci] === B.AIR;

        if (!nearSpawnClear && aboveClear && surfaceBid !== B.AIR && surfaceBid !== B.WATER && surfaceBid !== B.LAVA) {
          const fh = hash2i(wx * 3 + 17, wz * 3 - 29, worldSeed + sOff + 967);
          const fl = hash2i(wx * 7 + 5, wz * 7 - 13, worldSeed + sOff + 973);
          const onSpireCap = (spireTopHitY === surfaceY);
          if (isDream) {
            if (surfaceY >= WATER_LEVEL) {
              if (b === BIOMES.SIFT_MEADOW) {
                // b) Singer's Meadow: dark-teal thick-trunk flat-canopy forests ONLY along edges (Ref 2/8!), open pink plains inside!
                const edgeForestBand = (edgeF > 0.0 || valueNoise2D(wx * 0.026, wz * 0.026, worldSeed + 5501) > 0.78);
                if (edgeForestBand && !isStep && fh > 0.945 && lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12) {
                  const topT = placeMeadowFlatTree(data, lx, surfaceY + 1, lz, wx, wz);
                  maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topT - MIN_Y));
                } else if (fl > 0.64) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, B.SIFT_FLOWER, false); // lush pink grass tufts (Ref 2/8)
                }
              } else if (b === BIOMES.SIFT_LULLABY || b === BIOMES.SIFT_LULLABY_TOP) {
                // c) Lullaby Hills: dense blocky ice-blue & white frosted hillside trees (Refs 4/6 & 7/3)
                if (!onSpireCap && surfaceBid === B.SIFT_GRASS && fh > 0.942 && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13) {
                  const topT = placeIceBlockTree(data, lx, surfaceY + 1, lz, wx, wz);
                  maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topT - MIN_Y));
                } else if (surfaceBid === B.SIFT_GRASS && fl > 0.76) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, fl > 0.94 ? B.SPORE_SHROOM : B.TEAL_FERN, false);
                }
              } else if (b === BIOMES.SIFT_ICHOR_PONDS) {
                // d) Burrows & Ichor: sparse turquoise cliff corals & glowing yellow-cyan cave flora (Refs 5 & 10)
                if (fl > 0.962) setLocalSafe(data, lx, surfaceY + 1, lz, B.CORAL_BLUE, false);
                else if (fl > 0.928) setLocalSafe(data, lx, surfaceY + 1, lz, B.MUSHROOM_GLOW, false);
                else if (fl > 0.88 && surfaceBid === B.SIFT_CRIMSON_GRASS) setLocalSafe(data, lx, surfaceY + 1, lz, B.SIFT_FLOWER, false);
              } else if (b === BIOMES.SIFT_HUSKLAND) {
                // e) Humbler Huskland: scattered pale blue stone clusters + pale ferns/flowers (Ref 1/9)
                if (!onSpireCap && !isStep && surfaceBid === B.SIFT_PALE_GRASS && fh > 0.968 && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13) {
                  const topP = placePaleStoneCluster(data, lx, surfaceY + 1, lz, wx, wz);
                  maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topP - MIN_Y));
                } else if (surfaceBid === B.SIFT_PALE_GRASS && fl > 0.74) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, fl > 0.95 ? B.SIFT_BERRY_BUSH : B.TEAL_FERN, false);
                }
              } else if (b === BIOMES.SIFT_SPOREFIELDS) {
                // f) Fungal Sporefields: dense giant multi-colored mushrooms + mystic glowing spore carpet!
                if (fh > 0.948 && lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12) {
                  const topM = placeGiantSiftMushroom(data, lx, surfaceY + 1, lz, wx, wz);
                  maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topM - MIN_Y));
                } else if (fl > 0.68) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, fl > 0.86 ? B.SPORE_SHROOM : (fl > 0.78 ? B.MUSHROOM_GLOW : B.SIFT_FLOWER), false);
                }
              } else {
                // a) The Sift (Central Canyon): sculpted teal-trunk crystal trees + bioluminescent flora (Refs 1, 2, 7)
                if (!onSpireCap && !isStep && fh > (1.0 - rc.treeChance) && lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12) {
                  const vRoll = hash2i(wx - 7, wz + 13, worldSeed + 4969);
                  const topTr = placeDreamCrystalTree(data, lx, surfaceY + 1, lz, wx, wz, vRoll > 0.72 ? 'giant' : (vRoll > 0.34 ? 'tall' : 'medium'));
                  maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, topTr - MIN_Y));
                } else if (fl > 0.960) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, B.SIFT_CYAN_CRYSTAL, false);
                } else if (fl > 0.915) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, B.CORAL_BLUE, false);
                } else if (fl > 0.870) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, B.SPORE_SHROOM, false);
                } else if (fl > 0.760 && surfaceBid === B.SIFT_GRASS) {
                  setLocalSafe(data, lx, surfaceY + 1, lz, B.TEAL_FERN, false);
                }
              }
            }
          } else {
            // Dragon Realm ONLY: Pale mint crystal clusters + scattered Dragon ferns & small Dragon mushrooms
            const clusterN = fbm2D(wx * 0.042 + 13.7, wz * 0.042 - 9.3, 2, 0.5, 2.0, worldSeed + 8941);
            const crystalCut = 1.0 - (clusterN > 0.54 ? rc.mintCrystalChance * 1.8 : rc.mintCrystalChance * 0.45);
            if (!onSpireCap && !isSandSlope && fh > crystalCut && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13) {
              const cTop = placeDragonMintCrystalCluster(data, lx, surfaceY + 1, lz, wx, wz);
              maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, cTop - MIN_Y));
            } else if (surfaceBid === B.DRAGON_CAP_GRASS && fl > 0.74) {
              setLocalSafe(data, lx, surfaceY + 1, lz, fl > 0.945 ? B.DRAGON_MUSHROOM : B.DRAGON_FERN, false);
            } else if ((surfaceBid === B.DRAGON_RED_TERRACOTTA || surfaceBid === B.DRAGON_RED_STONE) && fl > 0.915) {
              setLocalSafe(data, lx, surfaceY + 1, lz, fl > 0.955 ? B.DRAGON_MUSHROOM : B.DRAGON_FERN, false);
            }
          }
        }

        // 7-color lake bed treasures (sift_lake chest + glowing crystals & corals)
        if (isDream && baseH <= WATER_LEVEL - 3 && !isTrench) {
          const shU = hash2i(wx, wz, worldSeed + 4611);
          if (lx === 8 && lz === 8 && shU > 0.86) {
            setLocalSafe(data, lx, baseH + 1, lz, B.GOLD_CHEST, true);
            naturalChestTags.set(modKey(wx, baseH + 1, wz), 'sift_lake');
          } else if (shU > 0.972) setLocalSafe(data, lx, baseH + 1, lz, B.SIFT_CYAN_CRYSTAL, false);
          else if (shU > 0.90) setLocalSafe(data, lx, baseH + 1, lz, B.CORAL_BLUE, false);
        }

        // Dragon Realm Sovereign Boss arena corner obelisks at (0, 136)
        if (!isDream && Math.abs(Math.abs(wx) - 14) <= 1 && Math.abs(Math.abs(wz - 136) - 14) <= 1) {
          for (let py = baseH + 1; py <= baseH + 12; py++) {
            const isTopCrys = (wx === 14 || wx === -14) && (wz === 150 || wz === 122) && py === baseH + 12;
            setLocalSafe(data, lx, py, lz, isTopCrys ? B.END_CRYSTAL_BLOCK : ((py % 3 === 0) ? B.DRAGON_RED_STONE : B.OBSIDIAN), true);
          }
          maxLy = Math.max(maxLy, Math.min(WORLD_H - 1, baseH + 13 - MIN_Y));
        }
      }
    }

    // 6) Biome-matched Ground Structures + Mandatory Floating Islands (The Sift) / Dragon World Structures (Dragon Realm)
    const midBio = colBioArr[(8 << 4) | 8];
    const midH = baseHeights[(8 << 4) | 8];
    if (isDream) {
      maxLy = stampSiftGroundStructureInChunk(data, cx, cz, wx0, wz0, midH, midBio, maxLy);
      maxLy = stampSiftFloatingIslandsInChunk(data, wx0, wz0, maxLy);
    } else {
      maxLy = stampDragonWorldStructureInChunk(data, cx, cz, wx0, wz0, maxLy, false);
    }

    // Clean any floating glow crystals
    for (let ly = 1; ly <= maxLy; ly++) {
      const row = ly << 8, below = (ly - 1) << 8;
      for (let i = 0; i < 256; i++) {
        if ((data[row | i] === B.GLOW_CRYSTAL || data[row | i] === B.SIFT_CYAN_CRYSTAL) && data[below | i] === B.AIR) data[row | i] = B.AIR;
      }
    }
    maxLy = applyChunkMods(cx, cz, data, Math.min(WORLD_H - 1, maxLy));
    const ch = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), ch);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return ch;
  }

  // Worldgen locator & live structure placer helpers for /locate biome, /locate structure, /place commands
  function locateNearestSiftBiome(targetBio, originX = player.x, originZ = player.z) {
    const prevDim = currentDimension;
    currentDimension = 'sift';
    const ox = Math.floor(originX), oz = Math.floor(originZ);
    const isInterior = (x, z) => (
      getBiomeAt(x, z) === targetBio &&
      getBiomeAt(x + 20, z) === targetBio && getBiomeAt(x - 20, z) === targetBio &&
      getBiomeAt(x, z + 20) === targetBio && getBiomeAt(x, z - 20) === targetBio
    );
    if (isInterior(ox, oz)) {
      currentDimension = prevDim;
      return { x: ox, z: oz, dist: 0 };
    }
    let fallback = (getBiomeAt(ox, oz) === targetBio) ? { x: ox, z: oz, dist: 0 } : null;
    for (let r = 16; r <= 640; r += 16) {
      for (let dz = -r; dz <= r; dz += 16) {
        for (let dx = -r; dx <= r; dx += 16) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const tx = ox + dx, tz = oz + dz;
          if (getBiomeAt(tx, tz) === targetBio) {
            if (isInterior(tx, tz)) {
              currentDimension = prevDim;
              return { x: tx, z: tz, dist: Math.round(Math.hypot(dx, dz)) };
            }
            if (!fallback) fallback = { x: tx, z: tz, dist: Math.round(Math.hypot(dx, dz)) };
          }
        }
      }
    }
    currentDimension = prevDim;
    return fallback;
  }

  function locateNearestRealmStructure(kind, originX = player.x, originZ = player.z) {
    const ocx = Math.floor(originX) >> 4, ocz = Math.floor(originZ) >> 4;
    if (kind === 'island' && currentDimension === 'sift') {
      let best = null;
      for (let dz = -180; dz <= 180; dz += 12) for (let dx = -180; dx <= 180; dx += 12) {
        const isl = sampleSiftFloatingIslandAt(Math.floor(originX) + dx, Math.floor(originZ) + dz);
        if (!isl) continue;
        const d = Math.hypot(isl.ix - originX, isl.iz - originZ);
        if (!best || d < best.dist) best = { x: isl.ix, y: isl.topY + 2, z: isl.iz, dist: Math.round(d), kind: isl.kind };
      }
      return best;
    }
    const isDragonKind = (kind === 'nest' || kind === 'vault' || kind === 'lab' || kind === 'altar' || kind === 'library');
    let best = null;
    for (let r = 0; r <= 24; r++) {
      for (let dcz = -r; dcz <= r; dcz++) for (let dcx = -r; dcx <= r; dcx++) {
        if (Math.abs(dcx) !== r && Math.abs(dcz) !== r) continue;
        const spec = isDragonKind ? getDragonStructureForChunk(ocx + dcx, ocz + dcz) : getSiftGroundStructureForChunk(ocx + dcx, ocz + dcz);
        if (!spec || (kind !== 'any' && spec.kind !== kind)) continue;
        const d = Math.hypot(spec.wx - originX, spec.wz - originZ);
        if (!best || d < best.dist) best = { x: spec.wx, y: getTerrainHeight(spec.wx, spec.wz, getBiomeAt(spec.wx, spec.wz)) + 2, z: spec.wz, dist: Math.round(d), kind: spec.kind };
      }
      if (best) break;
    }
    return best;
  }

  function placeStructureAtPlayer(kind) {
    const fx = Math.floor(player.x - Math.sin(player.yaw) * 14);
    const fz = Math.floor(player.z - Math.cos(player.yaw) * 14);
    const tcx = fx >> 4, tcz = fz >> 4;
    let ch = chunks.get(chunkKey(tcx, tcz));
    if (!ch) ch = generateChunk(tcx, tcz);
    const wx0 = tcx * 16, wz0 = tcz * 16;
    const midBio = getBiomeAt(wx0 + 8, wz0 + 8);
    const midH = Math.max(WATER_LEVEL + 1, getTerrainHeight(wx0 + 8, wz0 + 8, midBio));
    if (kind === 'nest' || kind === 'vault' || kind === 'lab' || kind === 'altar' || kind === 'library') {
      ch.maxLy = stampDragonWorldStructureInChunk(ch.data, tcx, tcz, wx0, wz0, ch.maxLy, currentDimension === 'end', kind);
    } else if (kind === 'castle' || kind === 'village' || kind === 'ruin' || kind === 'den') {
      ch.maxLy = stampSiftGroundStructureInChunk(ch.data, tcx, tcz, wx0, wz0, midH, midBio, ch.maxLy, kind);
    } else {
      return null;
    }
    ch.dirty = true;
    rebuildChunkMesh(ch);
    return { x: wx0 + 8, y: midH + 2, z: wz0 + 8, kind };
  }

  function _genDragonRealmChunk(cx, cz, wx0, wz0, data) {
    return _buildLayeredRealmChunk(cx, cz, wx0, wz0, data, 'dragon_realm');
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
      if (castle && castle.style === 1) {
        return h > 0.48 ? B.NETHER_WART_BLOCK : B.NETHER_BRICK;
      }
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
    const colCeilY = new Int16Array(256);
    const colShelfTop = new Int16Array(256);
    colShelfTop.fill(-999);
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, biome = getBiomeAt(wx, wz), h = getTerrainHeight(wx, wz, biome);
        const ci = (lz << 4) | lx; colHeights[ci] = h; colBiomes[ci] = biome.id;
        const locCastle = getNetherCastleAnchor(wx, wz);
        if (locCastle && !nearCastle) nearCastle = locCastle;
        const onEWBridge = (wz >= -19 && wz <= -13);
        const onNSBridge = (!onEWBridge && ((wx >= 61 && wx <= 67) || (wx >= -59 && wx <= -53)));
        const onBridge = onEWBridge || onNSBridge;
        // Dramatic multi-tier carved vaulted Nether cavern ceiling (sweeps y=24..66 w/ stepped ledges, stalactite ribs & overhangs — NEVER flat!)
        const castleBoost = locCastle ? Math.max(0, Math.round((1 - Math.hypot(wx - locCastle.x, wz - locCastle.z) / 52) * 16)) : 0;
        const vaultMacro = fbm2D(wx * 0.011, wz * 0.011, 3, 0.54, 2.05, worldSeed + 811);
        const terraceStep = Math.floor(fbm2D(wx * 0.030, wz * 0.030, 2, 0.5, 2.0, worldSeed + 823) * 5.0) * 2.5;
        const stalRib = Math.max(0, 0.38 - Math.abs(valueNoise2D(wx * 0.046, wz * 0.046, worldSeed + 829) - 0.5)) * 16.0;
        const ceilY = Math.max(24, Math.min(MAX_Y - 12, Math.floor(28 + vaultMacro * 28 + terraceStep - stalRib + castleBoost)));
        colCeilY[ci] = ceilY;

        // 3D Layered Overhanging Nether Rock Shelves (like Minecraft 1.16 Crimson/Warped/Soul overhanging cliffs!)
        let shelfBot = 999, shelfTop = -999;
        if (!locCastle && !onBridge && ceilY >= 36) {
          const shelfNoise = fbm2D(wx * 0.017 + 7.1, wz * 0.017 - 9.3, 2, 0.52, 2.0, worldSeed + 863);
          if (shelfNoise > 0.625) {
            const sEdge = Math.min(1.0, (shelfNoise - 0.625) / 0.14);
            const sMid = Math.floor(21 + valueNoise2D(wx * 0.025, wz * 0.025, worldSeed + 877) * 7);
            const sHalf = Math.max(1, Math.round(1 + sEdge * 2.6));
            const sTop = Math.min(ceilY - 8, sMid + sHalf);
            const sBot = Math.max(Math.max(WATER_LEVEL + 6, h + 6), sMid - sHalf);
            if (sTop >= sBot + 1) {
              shelfBot = sBot;
              shelfTop = sTop;
              colShelfTop[ci] = sTop;
            }
          }
        }

        const surfBlock = (wyTop) => {
          if (wyTop <= WATER_LEVEL + 2 && hash2i(wx, wz, worldSeed + 439) > 0.62) return B.MAGMA_BLOCK;
          if (biome === BIOMES.NETHER_CRIMSON) return B.CRIMSON_NYLIUM;
          if (biome === BIOMES.NETHER_WARPED) return B.WARPED_NYLIUM;
          if (biome === BIOMES.NETHER_BASALT_DELTAS) return (hash2i(wx, wz, worldSeed + 419) > 0.54 ? B.BLACKSTONE : B.BASALT);
          if (biome === BIOMES.NETHER_SOUL_VALLEY) return (hash2i(wx, wz, worldSeed + 421) > 0.22 ? B.SOUL_SAND : B.BASALT);
          return (hash2i(wx, wz, worldSeed + 413) > 0.72 ? B.SOUL_SAND : B.NETHERRACK);
        };

        for (let ly = 0; ly < WORLD_H; ly++) {
          const wy = MIN_Y + ly; let id = B.AIR;
          const trueY = wy - (depthOffset || 0);
          if (trueY <= -1001 && trueY >= -1010) id = B.BEDROCK;
          else if (trueY < -1010) id = B.AIR;
          else if (wy <= h) {
            if (wy === h && h > WATER_LEVEL) {
              id = surfBlock(wy);
            } else if (wy >= h - 1 && h <= WATER_LEVEL + 2 && hash2i(wx, wz, worldSeed + 433) > 0.68) {
              id = B.MAGMA_BLOCK;
            } else if (h > WATER_LEVEL + 2 && wy < h - 4 && wy > MIN_Y + 4 && sampleCaveFast(lx, ly, lz) > 0.75) {
              id = (wy <= MIN_Y + 6) ? B.LAVA : B.AIR;
            } else {
              const oh = hash3i(wx, wy, wz, worldSeed + 777);
              id = (oh > 0.9945) ? B.GOLD_ORE : (oh > 0.9850 ? B.QUARTZ_ORE : (biome === BIOMES.NETHER_BASALT_DELTAS && oh > 0.58 ? B.BLACKSTONE : (biome === BIOMES.NETHER_SOUL_VALLEY && wy >= h - 2 && oh > 0.42 ? B.SOUL_SAND : B.NETHERRACK)));
            }
          } else if (wy <= WATER_LEVEL) {
            id = B.LAVA;
          } else if (wy >= shelfBot && wy <= shelfTop) {
            id = (wy === shelfTop) ? surfBlock(wy) : (biome === BIOMES.NETHER_BASALT_DELTAS ? B.BLACKSTONE : B.NETHERRACK);
          } else if (wy >= ceilY) {
            // 3D Carved Upper Cavern Hollows inside Nether Ceiling (keep solid bedrock/rock upper shell above ceilY+14)
            const inUpperPocket = (wy < ceilY + 14 && wy < MAX_Y - 12 && sampleCaveFast(lx, ly, lz) > 0.68);
            if (inUpperPocket) {
              id = B.AIR;
            } else {
              const rh = hash3i(wx, wy, wz, worldSeed + 853);
              id = rh > 0.9996 ? B.ANCIENT_DEBRIS : (rh > 0.9940 ? B.GOLD_ORE : (rh > 0.9830 ? B.QUARTZ_ORE : (rh > 0.78 ? B.BLACKSTONE : (rh > 0.64 ? B.BASALT : B.NETHERRACK))));
            }
          }
          data[(ly << 8) | (lz << 4) | lx] = id;
        }
        // Only hang glowing Shroomlight clusters & Weeping Vines from VERIFIED SOLID ceiling rock (zero floating mid-air blocks!)
        const ceilLy0 = ceilY - MIN_Y;
        const ceilIsSolid = (ceilLy0 >= 2 && ceilLy0 < WORLD_H - 2)
          && IS_SOLID[data[(ceilLy0 << 8) | ci]] === 1
          && IS_SOLID[data[((ceilLy0 + 1) << 8) | ci]] === 1;
        if (ceilIsSolid && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13 && ceilY - h > 14 && hash2i(wx, wz, worldSeed + 523) > 0.9925) {
          const cLen = 1 + ((hash2i(wx, wz, worldSeed + 541) * 3) | 0);
          for (let cy = 0; cy <= cLen; cy++) {
            setLocalSafe(data, lx, ceilY - cy, lz, B.SHROOMLIGHT, true);
            if (cy >= 1 && cy <= cLen - 1) {
              if (((wx + cy) & 1) === 0) setLocalSafe(data, lx + 1, ceilY - cy, lz, B.SHROOMLIGHT, true);
              if (((wz + cy) & 1) === 0) setLocalSafe(data, lx, ceilY - cy, lz + 1, B.SHROOMLIGHT, true);
            }
          }
        }
        // Basalt Delta vertical volcanic pillars & Soul Sand Valley blue soul flames
        if (biome === BIOMES.NETHER_BASALT_DELTAS && h >= WATER_LEVEL && !locCastle && !onBridge && hash2i(wx, wz, worldSeed + 449) > 0.938) {
          const ph = 3 + Math.floor(hash2i(wx, wz, worldSeed + 457) * 6);
          for (let py = 1; py <= ph; py++) setLocalSafe(data, lx, h + py, lz, py === ph && hash2i(wx, wz, worldSeed + 461) > 0.72 ? B.MAGMA_BLOCK : B.BASALT, true);
        } else if (biome === BIOMES.NETHER_SOUL_VALLEY && h > WATER_LEVEL && !locCastle && !onBridge && hash2i(wx, wz, worldSeed + 463) > 0.962) {
          setLocalSafe(data, lx, h + 1, lz, B.SOUL_FIRE, false);
        }
        // Hanging ceiling Weeping Vines strictly anchored to solid ceiling rock or solid overhanging shelf bottom
        if (biome === BIOMES.NETHER_CRIMSON && ceilIsSolid && ceilY - h > 10 && hash2i(wx, wz, worldSeed + 479) > 0.942) {
          const vLen = 2 + Math.floor(hash2i(wx, wz, worldSeed + 487) * 5);
          for (let vy = 1; vy <= vLen; vy++) setLocalSafe(data, lx, ceilY - vy, lz, B.WEEPING_VINES, false);
        } else if (biome === BIOMES.NETHER_CRIMSON && shelfTop > -900 && shelfBot - h > 5 && hash2i(wx, wz, worldSeed + 491) > 0.925) {
          const vLen = 2 + Math.floor(hash2i(wx, wz, worldSeed + 499) * 4);
          for (let vy = 1; vy <= vLen; vy++) setLocalSafe(data, lx, shelfBot - vy, lz, B.WEEPING_VINES, false);
        }
        // Monumental Medieval Gothic Arched Nether Viaduct Bridges & Fortified Gatehouse Towers over Lava Seas (Image 1!)
        if (onBridge && !locCastle) {
          const bridgeY = 12;
          const bPerp = onEWBridge ? Math.abs(wz + 16) : Math.abs(wx - (wx >= 0 ? 64 : -56));
          const bAlong = onEWBridge ? wx : wz;
          const spanMod = ((bAlong % 10) + 10) % 10;
          const towerMod = ((bAlong % 40) + 40) % 40;
          const inGateTower = (towerMod <= 3 || towerMod >= 37);
          const isRail = (bPerp === 3);
          // Clear bridge walkway headroom
          for (let wy = bridgeY + 1; wy <= bridgeY + 7; wy++) setLocalSafe(data, lx, wy, lz, B.AIR, true);
          // Stone/Blackstone medieval deck + vaulted brick arches underneath!
          setLocalSafe(data, lx, bridgeY, lz, bPerp === 0 ? B.DEEPSLATE_TILES : (isRail ? B.BLACKSTONE_BRICKS : B.NETHER_BRICK), true);
          const archDrop = (spanMod === 0 || spanMod === 9) ? 4 : ((spanMod === 1 || spanMod === 8) ? 3 : ((spanMod === 2 || spanMod === 7) ? 2 : 1));
          for (let ay = 1; ay <= archDrop; ay++) {
            setLocalSafe(data, lx, bridgeY - ay, lz, isRail ? B.BLACKSTONE_BRICKS : B.NETHER_BRICK, true);
          }
          // Deep medieval bridge support piers plunging down into the glowing lava sea every 10 blocks
          if ((spanMod === 0 || spanMod === 9) && bPerp >= 2) {
            for (let wy = Math.max(MIN_Y + 2, Math.min(WATER_LEVEL - 4, h)); wy < bridgeY - archDrop; wy++) {
              setLocalSafe(data, lx, wy, lz, isRail ? B.BLACKSTONE_BRICKS : B.NETHER_BRICK, true);
            }
          }
          // Crenellated medieval battlements & lanterns along both parapets
          if (isRail) {
            setLocalSafe(data, lx, bridgeY + 1, lz, B.BLACKSTONE_BRICKS, true);
            if ((bAlong & 1) === 0) setLocalSafe(data, lx, bridgeY + 2, lz, B.BLACKSTONE_BRICKS, true);
            if (spanMod === 0) setLocalSafe(data, lx, bridgeY + 3, lz, B.LANTERN, true);
          }
          // Periodic Medieval Gothic Gatehouse Watchtowers (Image 1 silhouette!) every 40 blocks
          if (inGateTower) {
            const tEdge = (towerMod === 3 || towerMod === 37);
            const tSide = (bPerp >= 2);
            if (tSide) {
              for (let wy = bridgeY + 1; wy <= bridgeY + 10; wy++) {
                const isCrimsonPanel = (bPerp === 2 && !tEdge && wy >= bridgeY + 3 && wy <= bridgeY + 8);
                setLocalSafe(data, lx, wy, lz, isCrimsonPanel ? B.NETHER_WART_BLOCK : B.BLACKSTONE_BRICKS, true);
              }
              if ((bAlong + bPerp) % 2 === 0) setLocalSafe(data, lx, bridgeY + 11, lz, B.BLACKSTONE_BRICKS, true);
              if (tEdge && bPerp === 3) setLocalSafe(data, lx, bridgeY + 12, lz, B.LANTERN, true);
            } else {
              // High medieval archway lintel & crimson spire crown above the bridge road
              for (let wy = bridgeY + 7; wy <= bridgeY + 11; wy++) {
                setLocalSafe(data, lx, wy, lz, wy >= bridgeY + 10 ? B.NETHER_WART_BLOCK : B.BLACKSTONE_BRICKS, true);
              }
              if (towerMod === 0 && bPerp === 0) setLocalSafe(data, lx, bridgeY + 6, lz, B.LANTERN, true);
            }
          }
        }
      }
    }

    // Sparse, physically-anchored Nether Lavafalls: strictly at most 1 per 5x5 chunk region (~2-3 visible per vista, ZERO floating air-spawn!)
    const lrgX = Math.floor(cx / 5), lrgZ = Math.floor(cz / 5);
    const lPickCx = lrgX * 5 + Math.floor(hash2i(lrgX, lrgZ, worldSeed + 991) * 5);
    const lPickCz = lrgZ * 5 + Math.floor(hash2i(lrgX + 13, lrgZ - 7, worldSeed + 997) * 5);
    if (cx === lPickCx && cz === lPickCz && hash2i(lrgX - 5, lrgZ + 11, worldSeed + 1009) > 0.25) {
      const flx = 4 + Math.floor(hash2i(cx, cz, worldSeed + 1013) * 8);
      const flz = 4 + Math.floor(hash2i(cz, cx, worldSeed + 1019) * 8);
      const fwx = wx0 + flx, fwz = wz0 + flz;
      const fci = (flz << 4) | flx;
      const onBr = (fwz >= -21 && fwz <= -11) || (fwx >= 59 && fwx <= 69) || (fwx >= -61 && fwx <= -51);
      const farCastle = !nearCastle || Math.hypot(fwx - nearCastle.x, fwz - nearCastle.z) > 34;
      if (!onBr && farCastle && colShelfTop[fci] < -900) {
        const floorY = Math.max(WATER_LEVEL, colHeights[fci]);
        // Scan upward from colCeilY to find the FIRST true solid rock ceiling backed by solid roof & 4 solid rock sides (never pours out of air!)
        let anchorY = -1;
        const scanStart = Math.max(floorY + 14, colCeilY[fci]);
        const scanEnd = Math.min(MAX_Y - 12, scanStart + 20);
        for (let wy = scanStart; wy <= scanEnd; wy++) {
          const ly = wy - MIN_Y;
          if (ly < 3 || ly >= WORLD_H - 4) break;
          const b0 = data[(ly << 8) | fci];
          const bUp1 = data[((ly + 1) << 8) | fci];
          const bUp2 = data[((ly + 2) << 8) | fci];
          const bBelow = data[((ly - 1) << 8) | fci];
          const bXP = data[(ly << 8) | (flz << 4) | (flx + 1)];
          const bXM = data[(ly << 8) | (flz << 4) | (flx - 1)];
          const bZP = data[(ly << 8) | ((flz + 1) << 4) | flx];
          const bZM = data[(ly << 8) | ((flz - 1) << 4) | flx];
          if (bBelow === B.AIR && IS_SOLID[b0] === 1 && IS_SOLID[bUp1] === 1 && IS_SOLID[bUp2] === 1
              && IS_SOLID[bXP] === 1 && IS_SOLID[bXM] === 1 && IS_SOLID[bZP] === 1 && IS_SOLID[bZM] === 1) {
            anchorY = wy;
            break;
          }
        }
        if (anchorY > 0) {
          // Carve lava spring pocket inside solid ceiling rock and pour crisp 1x1 column down to lava sea/floor
          let botY = floorY + 1;
          for (let wy = anchorY - 1; wy >= Math.max(WATER_LEVEL + 1, floorY + 1); wy--) {
            if (IS_SOLID[data[((wy - MIN_Y) << 8) | fci]] === 1) { botY = wy + 1; break; }
          }
          for (let wy = botY; wy <= anchorY; wy++) setLocalSafe(data, flx, wy, flz, B.LAVA, true);
        }
      }
    }

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const ci = (lz << 4) | lx, h = colHeights[ci], wx = wx0 + lx, biome = BIOME_LIST[colBiomes[ci]];
        if (nearCastle && Math.hypot(wx - nearCastle.x, wz - nearCastle.z) < 28) continue;
        // Decorate BOTH main terrain surface AND overhanging upper cliffs/shelves with lush Nether fungi & flora!
        const surfYs = [];
        if (h > WATER_LEVEL) surfYs.push(h);
        if (colShelfTop[ci] > WATER_LEVEL) surfYs.push(colShelfTop[ci]);
        for (let si = 0; si < surfYs.length; si++) {
          const sy = surfYs[si];
          const rf = hash2i(wx + si * 37, wz - si * 29, worldSeed + 613);
          if (biome === BIOMES.NETHER_CRIMSON && rf > 0.46) {
            setLocalSafe(data, lx, sy + 1, lz, rf > 0.90 ? B.MUSHROOM_GLOW : (rf > 0.72 ? B.CRIMSON_FUNGUS : (rf > 0.64 ? B.WARPED_FUNGUS : B.CRIMSON_ROOTS)), false);
          } else if (biome === BIOMES.NETHER_WARPED && rf > 0.44) {
            setLocalSafe(data, lx, sy + 1, lz, rf > 0.89 ? B.TWISTING_VINES : (rf > 0.83 ? B.MUSHROOM_GLOW : (rf > 0.68 ? B.WARPED_FUNGUS : (rf > 0.60 ? B.CRIMSON_ROOTS : B.WARPED_ROOTS))), false);
          } else if (biome === BIOMES.NETHER_WASTES && rf > 0.86) {
            setLocalSafe(data, lx, sy + 1, lz, rf > 0.94 ? B.CRIMSON_FUNGUS : B.CRIMSON_ROOTS, false);
          } else if (biome === BIOMES.NETHER_SOUL_VALLEY && si === 1 && rf > 0.968) {
            setLocalSafe(data, lx, sy + 1, lz, B.SOUL_FIRE, false);
          }
          if (lx >= 4 && lx <= CHUNK_W - 5 && lz >= 4 && lz <= CHUNK_W - 5) {
            const rt = hash2i(wx + si * 53, wz + si * 41, worldSeed + 909);
            if (biome === BIOMES.NETHER_CRIMSON && rt > 0.904) {
              placeLuantiTree(data, lx, sy + 1, lz, wx, wz, rt > 0.955 ? 'crimson_spire' : 'crimson_fungus');
            } else if (biome === BIOMES.NETHER_WARPED && rt > 0.898) {
              placeLuantiTree(data, lx, sy + 1, lz, wx, wz, rt > 0.950 ? 'warped_weeping_giant' : 'warped_fungus');
            } else if (si === 0 && (biome === BIOMES.NETHER_BASALT_DELTAS || biome === BIOMES.NETHER_SOUL_VALLEY) && rt > 0.964) {
              placeLuantiTree(data, lx, sy + 1, lz, wx, wz, 'basalt_ember_tree');
            }
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
    if (farFromCastle && midNetherH > WATER_LEVEL + 1 && midNetherH <= 14 && (Math.abs(cx) > 1 || Math.abs(cz) > 1)) {
      stampNetherRoofAndCavernStructures(data, cx, cz, wx0, wz0, midNetherH, false);
    }
    // Iconic White Bone-Block Ribcage Fossils (prominent in Soul Sand Valley like Reference Images 3 & 4!)
    const midNetherBio = BIOME_LIST[colBiomes[(8 << 4) | 8]];
    const fossilThresh = (midNetherBio === BIOMES.NETHER_SOUL_VALLEY) ? 0.62 : 0.86;
    if (farFromCastle && midNetherH > WATER_LEVEL + 1 && midNetherH <= 16 && (Math.abs(cx) > 0 || Math.abs(cz) > 0) && !(wz0 <= -10 && wz0 + 15 >= -22) && hash2i(cx, cz, worldSeed + 4129) > fossilThresh) {
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
    return _buildLayeredRealmChunk(cx, cz, wx0, wz0, data, 'sift');
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
              else if (uBio === UNDERGROUND_BIOMES.SULFUR_CAVE) {
                const sb = ((trueY + Math.floor(rockH * 4)) % 6 + 6) % 6;
                id = sb === 0 ? B.SULFUR_BLOCK : (sb === 1 ? B.THERMAL_CRUST : (sb === 2 ? B.TRAVERTINE_STONE : B.CINNABAR_STONE));
              }
              else id = rockH > 0.55 ? B.STONE : B.DEEPSLATE;
              if (trueY <= -760 && oreH > 0.84) id = B.NETHERRACK;
              else if (uBio === UNDERGROUND_BIOMES.SULFUR_CAVE && oreH > 0.976) id = B.SULFUR_ORE;
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
                const tipBlk = (trueY < -35 && fh > 0.95) ? B.DEEPSLATE_STALACTITE : B.DRIPSTONE_STALACTITE;
                for (let d = 0; d < sLen && (ly + d) <= decEnd; d++) {
                  const idxS = ((ly + d) << 8) | (lz << 4) | lx;
                  if (data[idxS] !== B.AIR) break;
                  data[idxS] = d === sLen - 1 ? tipBlk : B.SMOOTH_STONE;
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
              if (fh > 0.945) data[i] = B.SEA_LANTERN;
              else if (fh > 0.905) data[i] = B.ICE_STALACTITE;
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
              const stalBlk = (trueY < -35 && ch > 0.93) ? B.DEEPSLATE_STALACTITE : B.DRIPSTONE_STALACTITE;
              for (let d = 0; d < sLen && (ly - d) >= decStart; d++) {
                const idxS = ((ly - d) << 8) | (lz << 4) | lx;
                if (data[idxS] !== B.AIR) break;
                data[idxS] = d >= sLen - 2 ? stalBlk : B.STONE;
              }
            } else if (uId === UNDERGROUND_BIOMES.ICE_CAVERN.id && ch > 0.85) {
              const iLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 647) * 4);
              for (let d = 0; d < iLen && (ly - d) >= decStart; d++) {
                const idxI = ((ly - d) << 8) | (lz << 4) | lx;
                if (data[idxI] !== B.AIR) break;
                data[idxI] = d >= iLen - 2 ? B.ICE_STALACTITE : B.ICE;
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
      maxLy = Math.min(WORLD_H - 1, (streetY + 22) - MIN_Y);
    }
    // Guarantee maxLy covers every placed city ruin tree & upper floor so nothing clips invisible
    const cityScanTop = Math.min(WORLD_H - 1, Math.max(maxLy, 118));
    for (let ly = cityScanTop; ly > maxLy; ly--) {
      const base = ly << 8;
      let any = false;
      for (let k = 0; k < 256; k++) { if (data[base | k] !== 0) { any = true; break; } }
      if (any) { maxLy = ly; break; }
    }
    const chCity = { cx, cz, data, maxLy, skyscraperSpec, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chCity);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chCity;
  }

  // Monumental 1000x1000 Underground Grand Ancient Ruins & Hero End Portal Citadel (buried deep beneath solid dry land!)
  function _genGrandRuinsChunk(cx, cz, wx0, wz0, data) {
    let maxLy = 84;
    const yShift = (typeof GRAND_RUINS_Y_SHIFT === 'number') ? GRAND_RUINS_Y_SHIFT : -34;
    const plazaY = 14; // Relative Y (maps to wy = -20 deep underground; End Portal altar at relY=16 -> wy=-18)
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
    const putAbs = (lx, wy, lz, id) => {
      const ly = wy - MIN_Y;
      if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_W && ly >= 1 && ly < WORLD_H - 1) {
        data[(ly << 8) | (lz << 4) | lx] = id;
        if (ly > maxLy) maxLy = ly;
      }
    };
    const put = (lx, relY, lz, id) => putAbs(lx, relY + yShift, lz, id);
    const pendingTrees = [];

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz, rz = wz - GRAND_RUINS_CZ;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, rx = wx - GRAND_RUINS_CX;
        const ci = (lz << 4) | lx;
        const surfY = (typeof getGrandRuinsSurfaceY === 'function') ? getGrandRuinsSurfaceY(wx, wz) : 24;
        colBiomes[ci] = BIOMES.GRAND_RUINS.id;
        colHeights[ci] = surfY;

        const ax = Math.abs(rx), az = Math.abs(rz);
        const edgeDist = Math.min(wx - GRAND_RUINS_MIN_X, GRAND_RUINS_MAX_X - wx, wz - GRAND_RUINS_MIN_Z, GRAND_RUINS_MAX_Z - wz);
        if (edgeDist < 6) {
          // Solid dry-land earth seal around outer boundary so the 1000x1000 underground ruin NEVER opens into oceans or cliffs
          for (let wy = MIN_Y; wy <= surfY; wy++) {
            const trueY = wy - (depthOffset || 0);
            let bid = wy <= MIN_Y + 1 ? B.BEDROCK : (wy < 0 ? B.DEEPSLATE : (wy <= surfY - 4 ? B.STONE : (wy < surfY ? B.DIRT : B.GRASS)));
            if (trueY <= -1001 && trueY >= -1010) bid = B.BEDROCK;
            data[((wy - MIN_Y) << 8) | ci] = bid;
          }
          if ((surfY - MIN_Y) > maxLy) maxLy = surfY - MIN_Y;
          continue;
        }
        const inZoneA = (ax <= 44 && az <= 44);
        const inZoneB = (!inZoneA && ax <= 36 && az >= 45 && az <= 144);
        const inZoneC = (!inZoneA && rx <= -45 && rx >= -144 && az <= 36);
        const inZoneD = (!inZoneA && rx >= 45 && rx <= 144 && az <= 36);
        const onCauseway = (!inZoneA && (ax <= 8 || az <= 8));

        // Base subterranean foundation beneath underground plaza (wy = MIN_Y..-23)
        const baseTopY = 11 + yShift;
        for (let wy = MIN_Y; wy <= baseTopY; wy++) {
          const trueY = wy - (depthOffset || 0);
          let bid = wy <= MIN_Y + 1 ? B.BEDROCK : B.DEEPSLATE;
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
            put(lx, archSkyH + 1, lz, B.MOSS_BLOCK);
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
            // Monumental 16-wide Grand Stone Causeways spanning all 1000x1000 w/ abundant warm Lantern posts & overgrown mossy rails!
            const alongX = (az <= 8);
            const perp = alongX ? az : ax;
            const alongCoord = alongX ? rx : rz;
            for (let wy = 12; wy <= plazaY; wy++) {
              if (perp >= 5 && perp <= 6 && wy === plazaY) put(lx, wy, lz, B.WATER);
              else if (perp === 7 && wy === plazaY) put(lx, wy, lz, B.STONE_BRICK_WALL);
              else put(lx, wy, lz, (perp <= 1 && (alongCoord & 1)) ? B.DEEPSLATE_TILES : ruinStone(wx, wy, wz));
            }
            if ((Math.abs(alongCoord) % 28) === 0 && perp === 7) {
              for (let wy = 15; wy <= 18; wy++) put(lx, wy, lz, B.STONE_BRICK_WALL);
              put(lx, 19, lz, B.LANTERN);
            } else if ((Math.abs(alongCoord) % 24) === 6 && perp === 8) {
              put(lx, 15, lz, B.BARREL);
            }
            if ((Math.abs(alongCoord) % 32) === 0 && perp === 8) {
              for (let wy = 15; wy <= 22; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
              put(lx, 23, lz, B.CAMPFIRE);
            }
          } else {
            // Repeating 48x48 Modular Architectural Ruin Districts across full 1000x1000 span (6 rich rooms/houses + corner treasure huts + 1-2 lanterns per room!)
            const bx = ((wx % 48) + 48) % 48, bz = ((wz % 48) + 48) % 48;
            const dgx = Math.floor(wx / 48), dgz = Math.floor(wz / 48);
            const distKind = Math.floor(hash2i(dgx, dgz, worldSeed + 9547) * 6);
            const bCx = bx - 24, bCz = bz - 24;
            const badx = Math.abs(bCx), badz = Math.abs(bCz);
            const surfR = hash2i(wx, wz, worldSeed + 9551);
            const baseElev = edgeDist < 16 ? Math.max(8, Math.round(8 + (edgeDist / 16) * 6)) : plazaY;
            for (let wy = 12; wy <= baseElev; wy++) {
              put(lx, wy, lz, (wy === baseElev && surfR > 0.72) ? (surfR > 0.88 ? B.MOSS_BLOCK : B.MOSSY_STONE_BRICK) : ruinStone(wx, wy, wz));
            }
            colHeights[ci] = baseElev;
            if (!isOuterWallR && edgeDist >= 12) {
              // Corner Ruined Treasure Huts & Furnished Outpost Rooms in every 48x48 district (bCx in [14..21], bCz in [14..21])
              const inCornerHut = (bCx >= 14 && bCx <= 21 && bCz >= 14 && bCz <= 21);
              if (inCornerHut) {
                const hx = bCx - 14, hz = bCz - 14;
                const hWall = (hx === 0 || hx === 7 || hz === 0 || hz === 7);
                const hDoor = (hx === 0 && hz >= 3 && hz <= 4);
                put(lx, baseElev, lz, B.SPRUCE_PLANKS);
                if (hWall) {
                  for (let wy = baseElev + 1; wy <= baseElev + 5; wy++) {
                    if (hDoor && wy <= baseElev + 3) continue;
                    const isWin = (wy === baseElev + 3 && ((hx === 7 && hz === 3) || ((hz === 0 || hz === 7) && hx === 4)));
                    put(lx, wy, lz, isWin ? B.IRON_BARS : ((hx === 0 || hx === 7) && (hz === 0 || hz === 7) ? B.DARK_OAK_LOG : ruinStone(wx, wy, wz)));
                  }
                  // Keep 1 exterior doorway lantern (2 total per hut w/ interior lantern)
                  if (hx === 0 && hz === 2) put(lx, baseElev + 4, lz, B.LANTERN);
                } else {
                  // Pitched/ruined timber roof + furnished chest room interior
                  const rH = baseElev + 5 + Math.min(hx, 7 - hx, hz, 7 - hz, 2);
                  if (hash2i(wx, wz, worldSeed + 9559) > 0.14) put(lx, rH, lz, B.SPRUCE_PLANKS);
                  if (hx === 5 && hz === 5) put(lx, baseElev + 1, lz, B.GOLD_CHEST);
                  else if (hx === 5 && hz === 2) put(lx, baseElev + 1, lz, B.CHEST);
                  else if (hx === 2 && hz === 5) put(lx, baseElev + 1, lz, B.CRAFT_TABLE);
                  else if (hx === 2 && hz === 6) put(lx, baseElev + 1, lz, B.FURNACE);
                  else if (hx === 6 && hz === 2) { put(lx, baseElev + 1, lz, B.BARREL); put(lx, baseElev + 2, lz, B.LANTERN); }
                  else if (hx === 6 && hz === 5) { put(lx, baseElev + 1, lz, B.BOOKSHELF); put(lx, baseElev + 2, lz, B.BOOKSHELF); }
                  else if (hx === 3 && hz === 1) put(lx, baseElev + 1, lz, B.ANVIL);
                }
              } else if (distKind === 0 && badx <= 11 && badz <= 11) {
                // Module 1: Ruined Citadel Tower + Emerald Moss Pool + Overgrown Leaf Vines + 2 Diagonal Lantern Posts
                if (badx <= 5 && badz <= 5) {
                  put(lx, baseElev - 2, lz, B.PRISMARINE);
                  put(lx, baseElev - 1, lz, B.WATER);
                  put(lx, baseElev, lz, B.WATER);
                } else if (badx === 11 || badz === 11) {
                  const wh = 19 + Math.floor(hash2i(wx, wz, worldSeed + 9587) * 8);
                  if (badx > 2 && badz > 2) {
                    for (let wy = baseElev + 1; wy <= wh; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
                    if (hash2i(wx, wz, worldSeed + 9589) > 0.64) put(lx, wh + 1, lz, B.OAK_LEAVES);
                  }
                } else if (bCx === -7 && bCz === -7) {
                  put(lx, baseElev + 1, lz, B.GOLD_CHEST);
                } else if (bCx === 7 && bCz === -7) {
                  put(lx, baseElev + 1, lz, B.CHEST);
                } else if ((bCx === -8 && bCz === -8) || (bCx === 8 && bCz === 8)) {
                  for (let wy = baseElev + 1; wy <= baseElev + 4; wy++) put(lx, wy, lz, B.STONE_BRICK_WALL);
                  put(lx, baseElev + 5, lz, B.LANTERN);
                }
              } else if (distKind === 1 && badx <= 13 && badz <= 13) {
                // Module 2: Terracotta & Sunken Dark Canal Hall + Ruined Library Nooks (1-2 Lanterns)
                if (bCx >= 4 && bCx <= 9) {
                  put(lx, baseElev - 2, lz, B.DEEPSLATE_TILES);
                  put(lx, baseElev - 1, lz, B.WATER);
                  put(lx, baseElev, lz, B.WATER);
                } else if (badx === 12 || badz === 12) {
                  if ((bx & 3) === 0) {
                    for (let wy = baseElev + 1; wy <= baseElev + 9; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
                    if (bCx === 0 && bCz === 12) put(lx, baseElev + 5, lz, B.LANTERN);
                  }
                } else if (bCx <= -7 && bCx >= -10 && badz <= 6 && (bz & 1) === 0) {
                  put(lx, baseElev + 1, lz, B.BOOKSHELF);
                  if (badz <= 4) put(lx, baseElev + 2, lz, B.BOOKSHELF);
                  if (badz === 0 && bCx === -8) put(lx, baseElev + 3, lz, B.LANTERN);
                } else {
                  put(lx, baseElev, lz, (bCx & 3) === 0 ? B.MOSSY_STONE_BRICK : B.TERRACOTTA_ORANGE);
                  if (bCx === 0 && bCz === 0) { put(lx, baseElev + 1, lz, B.DEEPSLATE_BRICKS); put(lx, baseElev + 2, lz, B.CAMPFIRE); }
                  else if (bCx === -4 && bCz === 0) put(lx, baseElev + 1, lz, B.CHEST);
                }
              } else if (distKind === 2 && badx <= 12 && badz <= 12) {
                // Module 3: Oxidized Copper Colonnade & Glowing Crystal Monolith Shrine (2 Lanterns)
                if (badx === 11 || badz === 11) {
                  for (let wy = baseElev + 1; wy <= baseElev + 8; wy++) {
                    if ((wy - baseElev) === 4 || (wy - baseElev) === 8) put(lx, wy, lz, oxTrim(wx, wy, wz));
                    else if ((badx > 2 || badz > 2) && ((bx + bz) & 1) === 0) put(lx, wy, lz, ruinStone(wx, wy, wz));
                  }
                  if ((bCx === -11 && bCz === -11) || (bCx === 11 && bCz === 11)) put(lx, baseElev + 9, lz, B.LANTERN);
                } else if (badx <= 2 && badz <= 2) {
                  const mh = baseElev + (badx === 0 && badz === 0 ? 7 : 4);
                  for (let wy = baseElev + 1; wy <= mh; wy++) put(lx, wy, lz, (wy === mh - 1) ? B.GLOW_CRYSTAL : B.DEEPSLATE_BRICKS);
                } else if (badx === 6 && badz === 6) {
                  put(lx, baseElev - 1, lz, B.LAVA);
                  put(lx, baseElev, lz, B.IRON_GRATE);
                } else if (bCx === 0 && bCz === 7) {
                  put(lx, baseElev + 1, lz, B.GOLD_CHEST);
                }
              } else if (distKind === 3 && badx <= 8 && badz <= 8) {
                // Module 4: Ruined Medieval Treasure House (Full Furnished Stone & Timber House w/ Chests, Barrels & 2 Lanterns!)
                const mWall = (badx === 7 || badz === 7);
                const mDoor = (bCz === 7 && badx <= 1) || (bCz === -7 && badx <= 1);
                if (badx <= 7 && badz <= 7) {
                  put(lx, baseElev, lz, ((bx + bz) & 1) ? B.SPRUCE_PLANKS : B.DEEPSLATE_TILES);
                  if (mWall) {
                    const isCorner = (badx === 7 && badz === 7);
                    for (let wy = baseElev + 1; wy <= baseElev + 6; wy++) {
                      if (mDoor && wy <= baseElev + 3) continue;
                      const isWin = (wy >= baseElev + 3 && wy <= baseElev + 4 && (badx === 3 || badz === 3));
                      put(lx, wy, lz, isCorner ? B.DARK_OAK_LOG : (isWin ? B.IRON_BARS : ruinStone(wx, wy, wz)));
                    }
                  } else {
                    const roofY = baseElev + 7 + Math.max(0, 3 - Math.floor(badx * 0.5));
                    if (hash2i(wx, wz, worldSeed + 9593) > 0.12) put(lx, roofY, lz, badx === 0 ? B.DEEPSLATE_BRICKS : B.SPRUCE_PLANKS);
                    if (bCx === 0 && bCz === 0) { put(lx, baseElev + 6, lz, B.IRON_BARS); put(lx, baseElev + 5, lz, B.LANTERN); }
                    if (bCx === -5 && bCz === -5) put(lx, baseElev + 1, lz, B.GOLD_CHEST);
                    else if (bCx === 5 && bCz === -5) put(lx, baseElev + 1, lz, B.CHEST);
                    else if (bCx === -5 && bCz === 5) { put(lx, baseElev + 1, lz, B.BARREL); put(lx, baseElev + 2, lz, B.LANTERN); }
                    else if (bCx === 5 && bCz === 5) put(lx, baseElev + 1, lz, B.CRAFT_TABLE);
                    else if (bCx === 0 && bCz === -5) put(lx, baseElev + 1, lz, B.FURNACE);
                    else if (badx === 6 && badz <= 3) { put(lx, baseElev + 1, lz, B.BOOKSHELF); put(lx, baseElev + 2, lz, B.BOOKSHELF); }
                  }
                }
              } else if (distKind === 4 && badx <= 9 && badz <= 9) {
                // Module 5: Ancient Stronghold Library & Enchanting Chamber (2 Warm Lanterns & Secret Chests!)
                const lWall = (badx === 8 || badz === 8);
                const lDoor = (badx <= 1 || badz <= 1);
                if (badx <= 8 && badz <= 8) {
                  put(lx, baseElev, lz, (badx <= 2 && badz <= 2) ? B.DEEPSLATE_TILES : B.MOSSY_STONE_BRICK);
                  if (lWall && !lDoor) {
                    for (let wy = baseElev + 1; wy <= baseElev + 7; wy++) put(lx, wy, lz, ruinStone(wx, wy, wz));
                  } else if (!lWall) {
                    if (badx === 6 && badz >= 2 && badz <= 6) {
                      for (let wy = baseElev + 1; wy <= baseElev + 4; wy++) put(lx, wy, lz, B.BOOKSHELF);
                    } else if (bCx === 0 && bCz === 0) {
                      put(lx, baseElev + 1, lz, B.ENCHANT_TABLE);
                    } else if ((bCx === -3 && bCz === -3) || (bCx === 3 && bCz === 3)) {
                      for (let wy = baseElev + 1; wy <= baseElev + 3; wy++) put(lx, wy, lz, B.STONE_BRICK_WALL);
                      put(lx, baseElev + 4, lz, B.LANTERN);
                    } else if (bCx === -4 && bCz === -4) {
                      put(lx, baseElev + 1, lz, B.GOLD_CHEST);
                    } else if (bCx === 4 && bCz === 4) {
                      put(lx, baseElev + 1, lz, B.CHEST);
                    }
                  }
                }
              } else if (bCx === 0 && bCz === 0) {
                // Module 6: Overgrown Ancient Woods, Campfire Clearing & Ruin Plaza
                pendingTrees.push({ lx, wy: baseElev + 1, lz, wx, wz, style: 'oak' });
              }
              // Wild Overgrown Subterranean Ruin Floor Decor (moss shrubs, leaf clusters, fallen pillars, barrels & sparse warm lanterns!)
              const curAbove = data[((baseElev + 1 + yShift - MIN_Y) << 8) | ci];
              if (curAbove === B.AIR && !inCornerHut) {
                const bushNoise = valueNoise2D(wx * 0.21, wz * 0.21, worldSeed + 9617);
                const decH = hash2i(wx, wz, worldSeed + 9623);
                const pillarGrid = ((wx & 15) === 5 && (wz & 15) === 5);
                const lampGrid = ((wx & 31) === 12 && (wz & 31) === 12);
                if (lampGrid && decH > 0.45) {
                  // Sparse Standing Medieval Ruin Lantern Post (1-2 per plaza/corridor)
                  put(lx, baseElev + 1, lz, B.DEEPSLATE_BRICKS);
                  put(lx, baseElev + 2, lz, B.STONE_BRICK_WALL);
                  put(lx, baseElev + 3, lz, B.STONE_BRICK_WALL);
                  put(lx, baseElev + 4, lz, B.LANTERN);
                } else if (pillarGrid && decH > 0.30) {
                  // Broken ancient mossy ruin pillar crowned with overgrown leaves
                  const pH = 3 + ((decH * 5) | 0);
                  for (let py = 1; py <= pH; py++) put(lx, baseElev + py, lz, py === pH ? B.STONE_BRICK_WALL : ruinStone(wx, baseElev + py, wz));
                  put(lx, baseElev + pH + 1, lz, B.OAK_LEAVES);
                } else if (bushNoise > 0.72 && decH > 0.40) {
                  // Overgrown wild leaf shrub / mossy thicket (1-2 blocks tall)
                  put(lx, baseElev + 1, lz, decH > 0.78 ? B.MOSS_BLOCK : B.OAK_LEAVES);
                  if (bushNoise > 0.81 && decH > 0.58) put(lx, baseElev + 2, lz, B.OAK_LEAVES);
                } else if (decH > 0.978) {
                  // Scattered supply crate / ruin barrel / mossy rubble
                  put(lx, baseElev + 1, lz, decH > 0.990 ? B.BARREL : B.MOSSY_STONE_BRICK);
                } else if (decH > 0.960 && decH <= 0.978) {
                  // Ancient lava/magma fissure under iron grate
                  put(lx, baseElev - 1, lz, B.LAVA);
                  put(lx, baseElev, lz, B.IRON_GRATE);
                } else if (decH > 0.81 && decH <= 0.94) {
                  // Wild cave ferns, tall grass & moss tufts
                  put(lx, baseElev + 1, lz, decH > 0.88 ? B.FERN : B.TALL_GRASS);
                }
              }
              if (lx >= 4 && lx <= 11 && lz >= 4 && lz <= 11 && !inCornerHut && hash2i(wx, wz, worldSeed + 9601) > 0.985) {
                pendingTrees.push({ lx, wy: baseElev + 1, lz, wx, wz, style: 'oak' });
              }
            }
          }
        }

        // ==================== SUBTERRANEAN VAULTED CAVERN ROOF + SOLID DRY LAND ABOVE ====================
        // Buries the entire 1000x1000 End Portal Ruins deep underground beneath rolling dry highland hills (NEVER ocean!)
        const ceilN = valueNoise2D(wx * 0.08, wz * 0.08, worldSeed + 9643) * 3.0 + valueNoise2D(wx * 0.22, wz * 0.22, worldSeed + 9649) * 1.5;
        let roofBotY;
        if (inZoneA) {
          roofBotY = Math.round(10 - Math.min(4.5, Math.hypot(rx, rz) * 0.10) + ceilN * 0.65);
        } else if (inZoneB || inZoneC || inZoneD) {
          roofBotY = Math.round(5 + ceilN * 0.85);
        } else {
          roofBotY = Math.round(2 + ceilN * 0.95);
        }
        if (edgeDist < 16) roofBotY = Math.round(roofBotY - (16 - edgeDist) * 0.5);
        roofBotY = Math.max(-2, Math.min(surfY - 6, roofBotY));

        const inEntryShaft = (Math.abs(rx) <= 2 && rz >= 35 && rz <= 41);
        const inEntryWall = (!inEntryShaft && Math.abs(rx) <= 3 && rz >= 34 && rz <= 42);
        if (inEntryShaft) {
          // Ancient ruined stairwell descending from dry hill surface down into the underground End Portal Sanctuary
          const stairT = Math.max(0, Math.min(1, (rz - 35) / 6));
          const stairY = Math.round((plazaY + yShift) + stairT * (surfY - (plazaY + yShift)));
          for (let wy = plazaY + yShift; wy <= surfY + 4; wy++) {
            if (wy < stairY) putAbs(lx, wy, lz, ruinStone(wx, wy, wz));
            else if (wy === stairY) putAbs(lx, wy, lz, Math.abs(rx) <= 1 ? B.STONE_STAIRS_N : ruinStone(wx, wy, wz));
            else putAbs(lx, wy, lz, B.AIR);
          }
        } else {
          for (let wy = roofBotY; wy <= surfY; wy++) {
            let bid;
            if (wy === surfY) {
              const sr = hash2i(wx, wz, worldSeed + 9661);
              bid = sr > 0.94 ? B.MOSSY_STONE_BRICK : (sr > 0.82 ? B.MOSS_BLOCK : B.GRASS);
            } else if (wy >= surfY - 3) {
              bid = B.DIRT;
            } else if (wy === roofBotY) {
              const rib = ((wx & 7) === 0 || (wz & 7) === 0);
              const ceilGlow = (((wx & 7) === 0 && (wz & 7) === 0) || hash2i(wx, wz, worldSeed + 9677) > 0.968);
              bid = ceilGlow ? (inZoneA ? B.GLOW_CRYSTAL : B.SHROOMLIGHT) : (rib ? darkTrim(wx, wy, wz) : ruinStone(wx, wy, wz));
            } else {
              bid = wy < 0 ? B.DEEPSLATE : B.STONE;
            }
            putAbs(lx, wy, lz, bid);
          }
          // Atmospheric hanging vines & mossy stalactites beneath the subterranean cavern vault
          const hCeil = hash2i(wx, wz, worldSeed + 9689);
          if (hCeil > 0.80) {
            const hangLen = 1 + Math.floor(hash2i(wx, wz, worldSeed + 9697) * 4);
            for (let d = 1; d <= hangLen; d++) {
              const hy = roofBotY - d;
              const hly = hy - MIN_Y;
              if (hly > 1 && data[(hly << 8) | ci] === B.AIR) {
                putAbs(lx, hy, lz, (d === 1 && hCeil > 0.91) ? B.MOSS_BLOCK : B.VINE);
              } else break;
            }
          }
          if (inEntryWall) {
            // Weathered mossy stone gatehouse framing the dry-land entrance down into the underground ruins
            for (let wy = roofBotY; wy <= surfY + 3; wy++) {
              const isDoor = (Math.abs(rx) <= 1 && rz === 42 && wy >= surfY + 1 && wy <= surfY + 2);
              if (!isDoor) putAbs(lx, wy, lz, (wy === surfY + 3 && Math.abs(rx) === 3 && (rz === 34 || rz === 42)) ? B.LANTERN : ruinStone(wx, wy, wz));
            }
          } else {
            // Natural highland forest covering the solid land above the buried 1000m ruins
            const fl = hash2i(wx, wz, worldSeed + 9719);
            if (fl > 0.84) putAbs(lx, surfY + 1, lz, fl > 0.94 ? B.FERN : B.TALL_GRASS);
            if (lx >= 3 && lx <= 12 && lz >= 3 && lz <= 12 && hash2i(wx, wz, worldSeed + 9733) > 0.986) {
              pendingTrees.push({ lx, wy: surfY + 1, lz, wx, wz, style: hash2i(wx, wz, worldSeed + 9743) > 0.45 ? 'pine' : 'oak', absY: true });
            }
          }
        }
        colHeights[ci] = surfY;
      }
    }

    for (let ti = 0; ti < pendingTrees.length; ti++) {
      const tr = pendingTrees[ti];
      const clx = Math.max(2, Math.min(13, tr.lx | 0));
      const clz = Math.max(2, Math.min(13, tr.lz | 0));
      const treeY = tr.absY ? tr.wy : (tr.wy + yShift);
      if (!tr.absY && treeY > -8) continue;
      placeLuantiTree(data, clx, treeY, clz, tr.wx, tr.wz, tr.absY ? tr.style : 'oak');
      const estTopLy = Math.min(WORLD_H - 1, (treeY + 26) - MIN_Y);
      if (estTopLy > maxLy) maxLy = estTopLy;
    }
    // Guarantee maxLy covers every placed ruin wall, arch, tower, and tree canopy (fixes invisible ruin trees/structures!)
    const scanTopLy = Math.min(WORLD_H - 1, Math.max(maxLy, 118));
    for (let ly = scanTopLy; ly > maxLy; ly--) {
      const base = ly << 8;
      let any = false;
      for (let k = 0; k < 256; k++) { if (data[base | k] !== 0) { any = true; break; } }
      if (any) { maxLy = ly; break; }
    }
    maxLy = applyChunkMods(cx, cz, data, Math.min(WORLD_H - 1, maxLy));
    const chGr = { cx, cz, data, maxLy, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true };
    registerChunk(chunkKey(cx, cz), chGr);
    markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
    return chGr;
  }

  // Organic Ground Patch System (3-12 block irregular secondary patches + 1-4 block tertiary micro-clusters + subtle forest decor)
  let _patchSets = null;
  function _getPatchSets() {
    if (_patchSets) return _patchSets;
    _patchSets = {
      forestDirt: new Set([
        BIOMES.FOREST.id, BIOMES.REDWOOD_ANCIENT.id, BIOMES.GIANT_TREES.id, BIOMES.TAIGA.id,
        BIOMES.PINE_VALLEY.id, BIOMES.BIRCH_ANCIENT.id, BIOMES.DARK_FOREST.id, BIOMES.SAKURA.id,
        BIOMES.WEEPING_GROVE.id, BIOMES.LUSH_GROVE.id, BIOMES.GIANT_JUNGLE.id, BIOMES.BAMBOO_JUNGLE.id
      ]),
      autumn: new Set([BIOMES.AUTUMN.id, BIOMES.AUTUMN_GOLDEN.id, BIOMES.AUTUMN_DEEP.id, BIOMES.DAPPLED_FOREST.id]),
      plains: new Set([BIOMES.PLAINS.id, BIOMES.GREEN_PLAINS.id, BIOMES.LUSH_STEPPE.id, BIOMES.HIGHLAND_PLATEAU.id, BIOMES.FLOWER_MEADOW.id, BIOMES.LAVENDER_MEADOW.id]),
      swamp: new Set([BIOMES.SWAMP.id, BIOMES.MANGROVE_SWAMP.id, BIOMES.MARSH_RUINS.id]),
      snow: new Set([BIOMES.SNOW.id, BIOMES.SNOWY_PLAINS.id, BIOMES.ALPINE_PEAKS.id, BIOMES.CLOUD_PEAKS.id, BIOMES.MEGA_SNOW_PEAKS.id]),
      badlands: new Set([BIOMES.MESA.id, BIOMES.BADLANDS_SPIRES.id, BIOMES.BADLANDS_CRATER.id]),
      rockDecor: new Set([BIOMES.REDWOOD_ANCIENT.id, BIOMES.GIANT_TREES.id, BIOMES.TAIGA.id, BIOMES.PINE_VALLEY.id, BIOMES.FOREST.id, BIOMES.DARK_FOREST.id, BIOMES.BIRCH_ANCIENT.id, BIOMES.GIANT_JUNGLE.id])
    };
    return _patchSets;
  }
  function applyOverworldGroundPatches(data, colHeights, colBiomes, wx0, wz0, maxLy) {
    const { forestDirt, autumn, plains, swamp, snow, badlands, rockDecor } = _getPatchSets();

    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const ci = (lz << 4) | lx, h = colHeights[ci];
        if (h <= WATER_LEVEL + 1 || h < MIN_Y + 2 || h >= MAX_Y - 2) continue;
        const ly = h - MIN_Y;
        const idx = (ly << 8) | ci;
        const surfId = data[idx];
        const bioId = colBiomes[ci];
        const wx = wx0 + lx;

        // Normalize speckled forest surfaces back to biome grass/snow before carving cohesive patches
        let baseId = surfId;
        const isForest = forestDirt.has(bioId);
        const isAutumn = autumn.has(bioId);
        const isPlains = plains.has(bioId);
        const isSwamp = swamp.has(bioId);
        const isSnow = snow.has(bioId);
        const isDesert = (bioId === BIOMES.DESERT.id);
        const isBadlands = badlands.has(bioId);
        const isBlueForest = (bioId === BIOMES.BLUE_FOREST.id);
        if (!isForest && !isAutumn && !isPlains && !isSwamp && !isSnow && !isDesert && !isBadlands && !isBlueForest) continue;

        if ((isForest || isAutumn || bioId === BIOMES.DARK_FOREST.id) && (baseId === B.AUTUMN_PODZOL || baseId === B.MOSS_BLOCK || baseId === B.MUD || baseId === B.DIRT)) {
          baseId = B.GRASS;
          data[idx] = baseId;
        }
        if (baseId !== B.GRASS && baseId !== B.AUTUMN_PODZOL && baseId !== B.SNOW && baseId !== B.SNOWY_DIRT && baseId !== B.SAND && baseId !== B.RED_SAND && baseId !== B.BLUE_GRASS) continue;

        const wOff = valueNoise2D(wx * 0.055, wz * 0.055, worldSeed + 1451) * 2.6;
        const pBlob = valueNoise2D((wx + wOff) * 0.095, (wz - wOff) * 0.095, worldSeed + 1459);
        const tMicro = valueNoise2D(wx * 0.24, wz * 0.24, worldSeed + 1471);
        const edgeR = hash2i(wx, wz, worldSeed + 1481);
        const checkerBias = ((wx ^ wz) & 1) ? 0.032 : -0.032;
        const patchVal = pBlob + checkerBias;

        if (isPlains) {
          if (baseId === B.GRASS) {
            if (tMicro > 0.91 && edgeR > 0.78) data[idx] = B.GRAVEL;
            else if (patchVal > 0.73 || (patchVal > 0.695 && edgeR > 0.65)) data[idx] = B.DIRT;
          }
        } else if (isForest || isAutumn) {
          const thr = isAutumn ? 0.48 : 0.56;
          if (tMicro > 0.79 && edgeR > 0.54) {
            data[idx] = edgeR > 0.80 ? B.MOSS_BLOCK : (edgeR > 0.69 ? B.STONE_BRICK : (edgeR > 0.60 ? B.STONE : B.GRAVEL));
          } else if (patchVal > thr || (patchVal > (thr - 0.055) && edgeR > 0.52)) {
            if (bioId === BIOMES.LUSH_GROVE.id || bioId === BIOMES.WEEPING_GROVE.id || bioId === BIOMES.GIANT_JUNGLE.id || bioId === BIOMES.BAMBOO_JUNGLE.id) {
              data[idx] = edgeR > 0.54 ? B.AUTUMN_PODZOL : (edgeR > 0.26 ? B.MOSS_BLOCK : B.MUD);
            } else {
              // Ragged reddish-brown podzol + dirt mix matching the diagonal patch pattern in reference images
              data[idx] = (((wx + wz) & 1) ? edgeR > 0.26 : edgeR > 0.42) ? B.AUTUMN_PODZOL : B.DIRT;
            }
          }
        } else if (isSwamp && baseId === B.GRASS) {
          if (tMicro > 0.79 && edgeR > 0.55) data[idx] = edgeR > 0.72 ? B.MOSS_BLOCK : B.STONE_BRICK;
          else if (patchVal > 0.58) data[idx] = edgeR > 0.35 ? B.MUD : B.DIRT;
        } else if (isSnow && (baseId === B.SNOW || baseId === B.SNOWY_DIRT)) {
          if (tMicro > 0.81 && edgeR > 0.55) data[idx] = edgeR > 0.80 ? B.ICE : (edgeR > 0.68 ? B.STONE : B.GRAVEL);
          else if (patchVal > 0.68) data[idx] = edgeR > 0.50 ? B.DIRT : B.AUTUMN_PODZOL;
        } else if (isDesert && baseId === B.SAND) {
          if (tMicro > 0.82 && edgeR > 0.58) data[idx] = edgeR > 0.74 ? B.SANDSTONE : B.GRAVEL;
          else if (patchVal > 0.66) data[idx] = edgeR > 0.48 ? B.RED_SAND : B.TERRACOTTA;
        } else if (isBadlands && baseId === B.RED_SAND) {
          if (tMicro > 0.81 && edgeR > 0.55) data[idx] = edgeR > 0.75 ? B.STONE : B.GRAVEL;
          else if (patchVal > 0.68) data[idx] = B.DIRT;
        } else if (isBlueForest && baseId === B.BLUE_GRASS) {
          if (tMicro > 0.80 && edgeR > 0.58) data[idx] = B.GRAVEL;
          else if (patchVal > 0.68) data[idx] = B.MOSS_BLOCK;
        }

        // Sparse weathered mossy boulders, fallen logs, short stumps & rare tiny ruin fragments (matching forest floor refs)
        if (rockDecor.has(bioId) && lx >= 2 && lx <= 12 && lz >= 2 && lz <= 12) {
          const decR = hash2i(wx, wz, worldSeed + 1493);
          if (decR > 0.9964 && data[((ly + 1) << 8) | ci] === B.AIR) {
            const bBase = decR > 0.9982 ? B.STONE_BRICK : B.STONE;
            setLocalSafe(data, lx, h + 1, lz, bBase, true);
            if (decR > 0.9974) setLocalSafe(data, lx + 1, h + 1, lz, decR > 0.9986 ? B.MOSS_BLOCK : B.STONE, true);
            if (decR > 0.9984) {
              setLocalSafe(data, lx, h + 1, lz + 1, B.MOSS_BLOCK, true);
              setLocalSafe(data, lx, h + 2, lz, B.STONE, true);
              if ((ly + 2) > maxLy) maxLy = ly + 2;
            }
            if ((ly + 1) > maxLy) maxLy = ly + 1;
          } else if (decR < 0.0020 && data[((ly + 1) << 8) | ci] === B.AIR) {
            const logB = (bioId === BIOMES.REDWOOD_ANCIENT.id || bioId === BIOMES.TAIGA.id || bioId === BIOMES.PINE_VALLEY.id || bioId === BIOMES.GIANT_TREES.id) ? B.SPRUCE_LOG : B.OAK_LOG;
            setLocalSafe(data, lx, h + 1, lz, logB, true);
            setLocalSafe(data, lx + 1, h + 1, lz, logB, true);
            setLocalSafe(data, lx + 2, h + 1, lz, decR < 0.0010 ? logB : B.MOSS_BLOCK, true);
            if ((ly + 1) > maxLy) maxLy = ly + 1;
          } else if (decR >= 0.0020 && decR < 0.0030 && data[((ly + 1) << 8) | ci] === B.AIR) {
            // Short weathered stump
            const stumpLog = (bioId === BIOMES.REDWOOD_ANCIENT.id || bioId === BIOMES.TAIGA.id || bioId === BIOMES.PINE_VALLEY.id || bioId === BIOMES.GIANT_TREES.id) ? B.SPRUCE_LOG : B.OAK_LOG;
            setLocalSafe(data, lx, h + 1, lz, stumpLog, true);
            if (decR < 0.0025) { setLocalSafe(data, lx, h + 2, lz, stumpLog, true); if ((ly + 2) > maxLy) maxLy = ly + 2; }
            if ((ly + 1) > maxLy) maxLy = ly + 1;
          } else if (decR > 0.9958 && decR <= 0.9962 && data[((ly + 1) << 8) | ci] === B.AIR) {
            // Tiny weathered stone-brick ruin wall segment (very sparse edge-of-frame detail)
            setLocalSafe(data, lx, h + 1, lz, B.STONE_BRICK, true);
            setLocalSafe(data, lx + 1, h + 1, lz, B.STONE_BRICK, true);
            setLocalSafe(data, lx + 2, h + 1, lz, B.MOSS_BLOCK, true);
            setLocalSafe(data, lx, h + 2, lz, B.STONE_BRICK, true);
            setLocalSafe(data, lx + 1, h + 2, lz, B.STONE, true);
            if ((ly + 2) > maxLy) maxLy = ly + 2;
          }
        }
      }
    }
    return maxLy;
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
    let maxLy = 0, _isUniformBiome = false, _bC0 = BIOMES.PLAINS, _baseDone = false;

    // ===================== DIMENSION 1: OVERWORLD (Worker / Rust WASM Base Terrain Fast-Path) =====================
    const wPre = (typeof chunkWorkerPool !== 'undefined' && chunkWorkerPool.takeOverworld) ? chunkWorkerPool.takeOverworld(cx, cz) : null;
    if (wPre && wPre.data) {
      data.set(wPre.data);
      if (wPre.isOceanChunk) {
        maxLy = applyChunkMods(cx, cz, data, wPre.maxLy | 0);
        const ch = { cx, cz, data, maxLy, isOceanChunk: true, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true, _meshGen: 0, _meshInFlightGen: -1 };
        registerChunk(chunkKey(cx, cz), ch);
        markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
        return ch;
      }
      colHeights.set(wPre.colHeights);
      colBiomes.set(wPre.colBiomes);
      if (wPre.caveGrid && wPre.caveGrid.length === caveGrid.length) caveGrid.set(wPre.caveGrid);
      maxLy = wPre.maxLy | 0;
      _isUniformBiome = (wPre.uniformBiome !== 255);
      if (_isUniformBiome && BIOME_LIST[wPre.uniformBiome]) _bC0 = BIOME_LIST[wPre.uniformBiome];
      _baseDone = true;
    } else if (_nwExports && _nwExports.generate_overworld_base_chunk && _syncMainWasmLuts(false)) {
      _syncWasmViews();
      const acList = getAncientCityLocations();
      for (let ai = 0; ai < 4 && ai < acList.length; ai++) {
        _nwAcCoords[ai * 2] = acList[ai].x | 0;
        _nwAcCoords[ai * 2 + 1] = acList[ai].z | 0;
      }
      _nwExports.generate_overworld_base_chunk(
        cx | 0, cz | 0, worldSeed | 0,
        seedMix.ox, seedMix.oy, seedMix.oz,
        seedMix.c1 | 0, seedMix.c2 | 0, seedMix.c3 | 0, seedMix.c4 | 0,
        seedMix.b1 | 0, seedMix.b2 | 0, seedMix.s1 | 0,
        0, MIN_Y | 0, MAX_Y | 0, WATER_LEVEL | 0
      );
      _nucraftWasmState.terrainCalls++;
      data.set(_nwChunkData);
      const wMaxLy = _nwTerrainMeta[0] | 0;
      if (_nwTerrainMeta[1] === 1) {
        maxLy = applyChunkMods(cx, cz, data, wMaxLy);
        const ch = { cx, cz, data, maxLy, isOceanChunk: true, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true, _meshGen: 0, _meshInFlightGen: -1 };
        registerChunk(chunkKey(cx, cz), ch);
        markChunkBorderDirty(cx + 1, cz); markChunkBorderDirty(cx - 1, cz); markChunkBorderDirty(cx, cz + 1); markChunkBorderDirty(cx, cz - 1);
        return ch;
      }
      colHeights.set(_nwColHeights);
      colBiomes.set(_nwColBiomes);
      caveGrid.set(_nwCoarseView);
      maxLy = wMaxLy;
      const uBio = _nwTerrainMeta[2] | 0;
      _isUniformBiome = (uBio !== 255);
      if (_isUniformBiome && BIOME_LIST[uBio]) _bC0 = BIOME_LIST[uBio];
      _baseDone = true;
    }

    if (!_baseDone) {
    _bC0 = getBiomeAt(wx0 + 8, wz0 + 8);
    _isUniformBiome = (
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
        const ch = { cx, cz, data, maxLy, isOceanChunk: true, mesh: null, leavesMesh: null, leavesCrossMesh: null, emissiveMesh: null, waterMesh: null, lavaMesh: null, plantMesh: null, dirty: true, urgentDirty: false, borderDirty: false, meshed: false, _emitDirty: true, _meshGen: 0, _meshInFlightGen: -1 };
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
              else if (biome === BIOMES.SULFUR_SPRINGS) id = ((wy & 3) === 0 ? B.CINNABAR_STONE : B.TRAVERTINE_STONE);
              else id = B.DIRT;
            } else if (wy === h) {
              if (h <= WATER_LEVEL) {
                if (biome === BIOMES.SULFUR_SPRINGS) id = hash2i(wx, wz, worldSeed + 7823) > 0.45 ? B.TRAVERTINE_STONE : B.SULFUR_BLOCK;
                else if (biome === BIOMES.MANGROVE_SWAMP || biome === BIOMES.SWAMP) id = B.MUD;
                else if (h <= -26 || biome === BIOMES.ABYSS_TRENCH) id = hash2i(wx, wz, worldSeed + 547) > 0.45 ? B.DEEPSLATE : B.BASALT;
                else if (h <= -14) id = hash2i(wx, wz, worldSeed + 549) > 0.55 ? B.STONE : B.SAND;
                else id = B.SAND;
              }
              else if (biome === BIOMES.SULFUR_SPRINGS) {
                const rimN = valueNoise2D(wx * 0.14, wz * 0.14, worldSeed + 7829);
                if (h === WATER_LEVEL + 1) id = rimN > 0.36 ? B.TRAVERTINE_STONE : B.SULFUR_BLOCK;
                else if (h <= WATER_LEVEL + 4) id = rimN > 0.62 ? B.THERMAL_CRUST : (rimN > 0.25 ? B.SULFUR_BLOCK : B.TRAVERTINE_STONE);
                else {
                  const band = (wy + Math.floor(rimN * 3)) % 5;
                  id = band === 0 ? B.SULFUR_BLOCK : (band === 1 ? B.THERMAL_CRUST : (band === 4 ? B.TRAVERTINE_STONE : B.CINNABAR_STONE));
                  if (hash2i(wx, wz, worldSeed + 7831) > 0.96) id = B.SULFUR_ORE;
                }
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
      }
    }
    }
    if (currentDimension === 'overworld' && depthOffset === 0) {
      maxLy = applyOverworldGroundPatches(data, colHeights, colBiomes, wx0, wz0, maxLy);
    }

    // Varied Subterranean Biome Caves below the surface (lazy-evaluated only when column has cave air!)
    for (let lz = 0; lz < CHUNK_W; lz++) {
      const wz = wz0 + lz;
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, ci = (lz << 4) | lx, h = colHeights[ci];
        if (h < MIN_Y) continue;
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
                  if (ly + 1 < h - MIN_Y - 6 && data[above] === B.AIR) data[above] = (wy < -35 && lh > 0.96) ? B.DEEPSLATE_STALACTITE : B.DRIPSTONE_STALACTITE;
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.GLOWSHROOM_GROTTO) {
                data[below] = B.MYCELIUM;
                if (lh > 0.86) data[i] = B.MUSHROOM_GLOW;
              } else if (uBioCol === UNDERGROUND_BIOMES.SULFUR_CAVE) {
                data[below] = lh > 0.66 ? B.THERMAL_CRUST : (lh > 0.34 ? B.SULFUR_BLOCK : B.TRAVERTINE_STONE);
                if (lh > 0.980) data[i] = B.SULFUR_VENT;
                else if (lh > 0.942) {
                  const sh = 1 + ((hash2i(wx, wz, worldSeed + 7841) * 3) | 0);
                  let topD = -1;
                  const useCin = lh > 0.968;
                  for (let d = 0; d < sh && (ly + d) < (h - MIN_Y - 4); d++) {
                    const idxC = ((ly + d) << 8) | (lz << 4) | lx;
                    if (data[idxC] !== B.AIR) break;
                    data[idxC] = useCin ? B.CINNABAR_STALACTITE : B.SULFUR_CRYSTAL;
                    topD = d;
                  }
                  if (topD >= 0 && !useCin) data[((ly + topD) << 8) | (lz << 4) | lx] = B.SULFUR_CRYSTAL;
                } else if (lh < 0.14 && data[below] !== B.AIR) {
                  data[below] = B.WATER;
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.ICE_CAVERN) {
                if (lh > 0.55) data[below] = B.PACKED_ICE;
                if (lh > 0.955) data[i] = B.SEA_LANTERN;
                else if (lh > 0.915) data[i] = B.ICE_STALACTITE;
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
                const stalB = (wy < -35 && vh > 0.94) ? B.DEEPSLATE_STALACTITE : B.DRIPSTONE_STALACTITE;
                for (let d = 0; d < sLen && (ly - d) > 5; d++) {
                  const idxS = ((ly - d) << 8) | (lz << 4) | lx;
                  if (data[idxS] !== B.AIR) break;
                  data[idxS] = d >= sLen - 2 ? stalB : B.STONE;
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.ICE_CAVERN && vh > 0.86) {
                const iLen = 2 + Math.floor(hash2i(wx, wz, seedMix.s1 + 647) * 3);
                for (let d = 0; d < iLen && (ly - d) > 5; d++) {
                  const idxI = ((ly - d) << 8) | (lz << 4) | lx;
                  if (data[idxI] !== B.AIR) break;
                  data[idxI] = d >= iLen - 2 ? B.ICE_STALACTITE : B.ICE;
                }
              } else if (uBioCol === UNDERGROUND_BIOMES.SULFUR_CAVE && vh > 0.89) {
                const sLen = 1 + Math.floor(hash2i(wx, wz, seedMix.s1 + 7853) * 3);
                const hangCin = vh > 0.955;
                for (let d = 0; d < sLen && (ly - d) > 5; d++) {
                  const idxS = ((ly - d) << 8) | (lz << 4) | lx;
                  if (data[idxS] !== B.AIR) break;
                  data[idxS] = hangCin ? B.CINNABAR_STALACTITE : (d === 0 && sLen > 1 ? B.SULFUR_BLOCK : B.SULFUR_CRYSTAL);
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
          const gClump = valueNoise2D(wx * 0.11, wz * 0.11, worldSeed + 617);
          const flPocket = valueNoise2D(wx * 0.055, wz * 0.055, worldSeed + 643);
          const isPatchSoil = (surfTopId === B.DIRT || surfTopId === B.AUTUMN_PODZOL || surfTopId === B.GRAVEL || surfTopId === B.STONE || surfTopId === B.MUD);
          const grassGate = isPatchSoil ? 0.935 : (gClump > 0.52 ? 0.72 : 0.935); // Natural clumped tufts + open floor
          if (biome === BIOMES.LAVENDER_MEADOW && rf > (gClump > 0.48 ? 0.68 : 0.90)) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.88 ? B.ALLIUM : (rf > 0.78 ? B.FLOWER_LAVENDER : (rf > 0.73 ? B.CLOVER_PATCH : B.TALL_GRASS)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.BAMBOO_JUNGLE && rf > (gClump > 0.50 ? 0.72 : 0.92)) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.986 ? B.MELON_BLOCK : (rf > 0.94 ? B.BAMBOO_SHOOT : (rf > 0.88 ? B.FERN : (rf > 0.81 ? B.TALL_GRASS : (flPocket > 0.76 && rf > 0.76 ? B.BLUE_ORCHID : B.SHORT_GRASS)))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.SAKURA && rf > grassGate) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.90 ? B.SAKURA_PETALS : (flPocket > 0.74 && rf > 0.84 ? (rf > 0.87 ? B.ALLIUM : B.OXEYE_DAISY) : (rf > 0.78 ? B.SHORT_GRASS : B.TALL_GRASS)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.BLUE_FOREST) {
            if (surfTopId === B.BLUE_GRASS) {
              if (rf > (gClump > 0.50 ? 0.72 : 0.92)) {
                setLocalSafe(data, lx, h + 1, lz, rf > 0.94 ? B.FLOWER_LAVENDER : (rf > 0.89 ? B.ALLIUM : (rf > 0.84 ? B.SAKURA_PETALS : B.TEAL_FERN)), false);
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
          } else if (biome === BIOMES.PINE_VALLEY && rf > grassGate) {
            const nearWater = h <= WATER_LEVEL + 2;
            const pid = (nearWater && rf > 0.78) ? B.CATTAIL_REED : (rf > 0.92 ? B.WILD_TALL_GRASS : (rf > 0.84 ? B.FERN : (rf > 0.77 ? B.TALL_GRASS : B.SHORT_GRASS)));
            setLocalSafe(data, lx, h + 1, lz, pid, false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.GIANT_JUNGLE && rf > grassGate) {
            const jid = rf > 0.988 ? B.MELON_BLOCK : (rf > 0.90 ? B.WILD_TALL_GRASS : (rf > 0.82 ? B.FERN : (rf > 0.76 ? B.TALL_GRASS : B.SHORT_GRASS)));
            setLocalSafe(data, lx, h + 1, lz, jid, false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.FLOWER_MEADOW && rf > (gClump > 0.48 ? 0.68 : 0.90)) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.92 ? B.FLOWER_RED : (rf > 0.86 ? B.BLUE_ORCHID : (rf > 0.80 ? B.ALLIUM : (rf > 0.74 ? B.OXEYE_DAISY : (rf > 0.70 ? B.FLOWER_YELLOW : B.SHORT_GRASS)))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if ((biome === BIOMES.LUSH_GROVE || biome === BIOMES.WEEPING_GROVE) && rf > grassGate) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.988 ? B.MELON_BLOCK : (rf > 0.95 ? B.MUSHROOM_GLOW : (rf > 0.88 ? B.FERN : (rf > 0.80 ? B.TALL_GRASS : B.SHORT_GRASS))), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if ((biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_GOLDEN || biome === BIOMES.AUTUMN_DEEP || biome === BIOMES.DAPPLED_FOREST) && rf > (gClump > 0.50 ? 0.76 : 0.93)) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.975 ? B.BLUEBERRY : (rf > 0.94 ? B.AUTUMN_BUSH : B.AUTUMN_GRASS), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.GLOWSHROOM_GROVE && rf > (gClump > 0.50 ? 0.74 : 0.92)) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.90 ? B.MUSHROOM_GLOW : (rf > 0.82 ? B.WARPED_FUNGUS : B.FERN), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.MANOR_GARDEN && rf > (gClump > 0.48 ? 0.74 : 0.92)) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.92 ? B.FLOWER_RED : (rf > 0.85 ? B.OXEYE_DAISY : (rf > 0.79 ? B.ALLIUM : B.SHORT_GRASS)), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if (biome === BIOMES.MARSH_RUINS && rf > grassGate) {
            setLocalSafe(data, lx, h + 1, lz, rf > 0.92 ? B.MUSHROOM_GLOW : (rf > 0.82 ? B.FERN : B.TALL_GRASS), false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          } else if ((biome === BIOMES.PLAINS || biome === BIOMES.GREEN_PLAINS || biome === BIOMES.LUSH_STEPPE) && surfTopId === B.GRASS) {
            const pGate = gClump > 0.53 ? 0.68 : 0.945; // Open grassy plains ("cho co, cho khong", low clutter)
            if (rf > pGate) {
              const pid = (flPocket > 0.78 && rf > 0.955)
                ? (rf > 0.980 ? B.FLOWER_RED : (rf > 0.968 ? B.FLOWER_YELLOW : B.OXEYE_DAISY))
                : (rf > 0.994 ? B.BERRY_BUSH : (rf > 0.90 ? B.WILD_TALL_GRASS : (rf > 0.76 ? B.TALL_GRASS : B.SHORT_GRASS)));
              setLocalSafe(data, lx, h + 1, lz, pid, false);
              const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
            }
          } else if (biome === BIOMES.SNOWY_PLAINS) {
            if (surfTopId === B.SNOWY_DIRT && rf > 0.88) {
              setLocalSafe(data, lx, h + 1, lz, B.SNOWY_GRASS, false);
              const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
            }
          } else if ((biome !== BIOMES.CLOUD_PEAKS && biome !== BIOMES.ALPINE_PEAKS || surfTopId === B.GRASS) && rf > (isPatchSoil ? 0.92 : (gClump > 0.48 ? 0.62 : 0.90))) {
            let pid = rf > 0.89 ? B.WILD_TALL_GRASS : (rf > 0.78 ? B.TALL_GRASS : (rf > 0.71 ? B.FERN : B.SHORT_GRASS));
            if (biome === BIOMES.TAIGA && rf > 0.986) pid = B.BLUEBERRY;
            else if (rf > 0.994) pid = B.BERRY_BUSH;
            else if (flPocket > 0.72 && rf > 0.935) pid = (rf > 0.968 ? B.FLOWER_YELLOW : B.OXEYE_DAISY);
            setLocalSafe(data, lx, h + 1, lz, pid, false);
            const ply = (h + 1) - MIN_Y; if (ply > maxLy) maxLy = ply;
          }
        }
        if (!placedSugarCane && lx >= 3 && lx <= CHUNK_W - 4 && lz >= 3 && lz <= CHUNK_W - 4) {
          const rTree = hash2i(wx, wz, worldSeed + 909);
          const inGiantSafe = (lx >= 4 && lx <= 10 && lz >= 4 && lz <= 10);
          // Cathedral spacing grid (12-block cells -> 8-16 block gap between giant redwood trunks)
          const rwCellX = Math.floor(wx / 12), rwCellZ = Math.floor(wz / 12);
          const rwAx = rwCellX * 12 + 2 + ((hash2i(rwCellX, rwCellZ, worldSeed + 1901) * 8) | 0);
          const rwAz = rwCellZ * 12 + 2 + ((hash2i(rwCellX, rwCellZ, worldSeed + 1907) * 8) | 0);
          const isRedwoodAnchor = (wx === rwAx && wz === rwAz && hash2i(rwCellX, rwCellZ, worldSeed + 1913) > 0.16);
          let placed = false;
          if (biome === BIOMES.GLOWSHROOM_GROVE && inGiantSafe && rTree > 0.84) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'giant_mushroom'); placed = true; }
          else if (biome === BIOMES.DAPPLED_FOREST && rTree > 0.946) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'autumn_maple'); placed = true; }
          else if (biome === BIOMES.MARSH_RUINS && rTree > 0.952) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 933) > 0.5 ? 'willow' : 'mangrove'); placed = true; }
          else if (biome === BIOMES.TROPICAL_COAST && rTree > 0.938) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 935) > 0.52 ? 'palm' : 'canopy_jungle'); placed = true; }
          else if (biome === BIOMES.GIANT_TREES && ((inGiantSafe && isRedwoodAnchor) || rTree > 0.986)) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && isRedwoodAnchor) ? 'giant_redwood' : 'tall_pine'); placed = true; }
          else if (biome === BIOMES.MANOR_GARDEN && rTree > 0.972) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 937) > 0.5 ? 'sculpted_birch' : 'apple'); placed = true; }
          else if (biome === BIOMES.BADLANDS_SPIRES && surfTopId === B.RED_SAND && rTree > 0.992) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'cactus'); placed = true; }
          else if (biome === BIOMES.BAMBOO_JUNGLE && rTree > 0.86) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && rTree > 0.972) ? 'canopy_jungle' : 'bamboo'); placed = true; }
          else if (biome === BIOMES.REDWOOD_ANCIENT && ((inGiantSafe && isRedwoodAnchor) || rTree > 0.985)) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && isRedwoodAnchor) ? 'giant_redwood' : 'tall_pine'); placed = true; }
          else if (biome === BIOMES.WEEPING_GROVE && inGiantSafe && rTree > 0.958) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 939) > 0.55 ? 'canopy_jungle' : 'ancient_vine_tree'); placed = true; }
          else if (biome === BIOMES.BIRCH_ANCIENT && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 941) > 0.55 ? 'birch_bent' : 'sculpted_birch'); placed = true; }
          else if (biome === BIOMES.MUSHROOM_ISLAND && inGiantSafe && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'giant_mushroom'); placed = true; }
          else if (biome === BIOMES.LAVENDER_MEADOW && rTree > 0.972) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'willow'); placed = true; }
          else if (biome === BIOMES.BEACH_PALM && h >= 1 && h <= 6 && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'palm'); placed = true; }
          else if (biome === BIOMES.MANGROVE_SWAMP && rTree > 0.952) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'mangrove'); placed = true; }
          else if ((biome === BIOMES.ALPINE_PEAKS || biome === BIOMES.CLOUD_PEAKS) && h <= 22 && surfTopId === B.GRASS && rTree > 0.968) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'pine'); placed = true; }
          else if (biome === BIOMES.HIGHLAND_PLATEAU && rTree > 0.978) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, hash2i(wx, wz, worldSeed + 913) > 0.5 ? 'baobab' : 'sculpted_birch'); placed = true; }
          else if (biome === BIOMES.FOREST && rTree > 0.956) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && rTree > 0.988) ? 'broadleaf' : (hash2i(wx, wz, worldSeed + 911) > 0.72 ? 'canopy_jungle' : (hash2i(wx, wz, worldSeed + 912) > 0.44 ? 'sculpted_birch' : 'apple'))); placed = true; }
          else if (biome === BIOMES.PLAINS && surfTopId === B.GRASS && !isGrandCitadel(wx, wz) && rTree > 0.9997) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'apple'); placed = true; }
          else if (biome === BIOMES.GREEN_PLAINS && surfTopId === B.GRASS && rTree > 0.9998) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'apple'); placed = true; }
          else if (biome === BIOMES.SAKURA && rTree > 0.946) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'sakura'); placed = true; }
          else if ((biome === BIOMES.AUTUMN || biome === BIOMES.AUTUMN_GOLDEN || biome === BIOMES.AUTUMN_DEEP) && rTree > 0.950) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, biome === BIOMES.AUTUMN_GOLDEN ? 'acacia' : (hash2i(wx, wz, worldSeed + 917) > 0.30 ? 'autumn_maple' : 'acacia')); placed = true; }
          else if (biome === BIOMES.LUSH_GROVE && rTree > 0.950) { placeLuantiTree(data, lx, h + 1, lz, wx, wz, (inGiantSafe && hash2i(wx, wz, worldSeed + 919) > 0.55) ? 'ancient_vine_tree' : 'canopy_jungle'); placed = true; }
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
          else if (biome === BIOMES.LUSH_STEPPE && surfTopId === B.GRASS && rTree > 0.998) {
            placeTreeBaseLitter(data, lx, h + 1, lz, wx, wz, B.OAK_LEAVES); placed = true;
          }
          else if (biome === BIOMES.SULFUR_SPRINGS) {
            if (h >= 7 && rTree > 0.986) {
              placeLuantiTree(data, lx, h + 1, lz, wx, wz, 'pine'); placed = true;
            } else if (h >= WATER_LEVEL + 1 && rTree > 0.962) {
              if (h <= WATER_LEVEL + 3 && rTree > 0.985) {
                setLocalSafe(data, lx, h + 1, lz, B.SULFUR_VENT, true);
              } else {
                const spH = 1 + ((hash2i(wx, wz, worldSeed + 7867) * 3) | 0);
                const useCin = rTree > 0.980;
                for (let sy = 1; sy <= spH; sy++) {
                  const sBlk = (sy === 1 && spH >= 3 && !useCin) ? B.SULFUR_BLOCK : (useCin ? B.CINNABAR_STALACTITE : B.SULFUR_CRYSTAL);
                  setLocalSafe(data, lx, h + sy, lz, sBlk, false);
                }
              }
              placed = true;
            }
          }
          else if (biome === BIOMES.GIANT_JUNGLE && rTree > 0.941 && rTree <= 0.944) {
            placeTreeBaseLitter(data, lx, h + 1, lz, wx, wz, B.JUNGLE_LEAVES); placed = true;
          }
          if (placed) {
            if (biome === BIOMES.FOREST || biome === BIOMES.AUTUMN || biome === BIOMES.SAKURA || biome === BIOMES.PINE_VALLEY || biome === BIOMES.TAIGA || biome === BIOMES.BIRCH_ANCIENT || biome === BIOMES.DARK_FOREST) {
              placeTreeBaseLitter(data, lx, h + 1, lz, wx, wz, biome === BIOMES.SAKURA ? B.SAKURA_LEAVES : (biome === BIOMES.PINE_VALLEY || biome === BIOMES.TAIGA ? B.SPRUCE_LEAVES : B.OAK_LEAVES));
            }
            const top = Math.min(WORLD_H - 1, (h + 44) - MIN_Y); if (top > maxLy) maxLy = top;
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
    if (!isGrandCitadel(wx0 + 8, wz0 + 8) && (midB === BIOMES.PLAINS || midB === BIOMES.FOREST || midB === BIOMES.FLOWER_MEADOW || midB === BIOMES.SAKURA) && midH > WATER_LEVEL + 1 && midH < 14 && (Math.abs(cx) > 2 || Math.abs(cz) > 2) && hash2i(cx, cz, worldSeed + 2477) > 0.9955) {
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
          if (topH >= WATER_LEVEL - 3 && topH <= WATER_LEVEL + 1) {
            if (fbm2(wx * 0.048 + 311, wz * 0.048 - 197, 2) > 0.68) {
              for (let dy = 0; dy <= 2; dy++) {
                const ly = (topH - dy) - MIN_Y;
                if (ly > 2 && ly < WORLD_H - 2) {
                  const idx = (ly << 8) | (lz << 4) | lx;
                  const cur = data[idx];
                  if (cur === B.SAND || cur === B.STONE) data[idx] = B.GRAVEL;
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
      c.dirty = true; c._meshGen = (c._meshGen || 0) + 1; _dirtyChunkSet.add(c);
      if (urgent) { c.urgentDirty = true; _urgentChunkSet.add(c); }
    }
  }
  function markAllLoadedChunksDirty(urgentNear = false) {
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    for (const ch of chunks.values()) {
      ch.dirty = true;
      ch._emitDirty = true;
      ch._meshGen = (ch._meshGen || 0) + 1;
      _dirtyChunkSet.add(ch);
      if (urgentNear && Math.abs(ch.cx - pcx) <= 1 && Math.abs(ch.cz - pcz) <= 1) {
        ch.urgentDirty = true;
        _urgentChunkSet.add(ch);
      }
    }
  }
  function syncLoadedChunkRenderFlags() {
    const rtOn = !!(typeof sodiumOpts !== 'undefined' && sodiumOpts.rayTracing);
    const effLow = (shaderQuality === 'low' && !rtOn);
    const isCartoon = !!window._cartoonAddonActive;
    const shPreset = (CFG.GFX_PRESETS && CFG.GFX_PRESETS[shaderQuality]) || { shadowChunkRange: 26 };
    const rawShRange = shPreset.shadowChunkRange > 0 ? shPreset.shadowChunkRange : (rtOn ? 32 : 0);
    const shChunkRad = rawShRange > 0 ? Math.min(2, Math.max(1, Math.ceil(rawShRange / CHUNK_W))) : -1;
    const pcx = (typeof player !== 'undefined' && player) ? (Math.floor(player.x) >> 4) : 0;
    const pcz = (typeof player !== 'undefined' && player) ? (Math.floor(player.z) >> 4) : 0;
    const wantLeafMat = isCartoon ? leavesMatCartoon : (effLow ? leavesMatLow : leavesMat);
    const wantDepth = (!effLow && !isCartoon) ? leavesDepthMat : undefined;
    for (const ch of chunks.values()) {
      const dCh = Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz));
      const nearSh = (shChunkRad >= 0) && (dCh <= shChunkRad);
      if (ch.mesh && ch.mesh.castShadow !== nearSh) ch.mesh.castShadow = nearSh;
      if (ch.leavesMesh) {
        if (ch.leavesMesh.material !== wantLeafMat) ch.leavesMesh.material = wantLeafMat;
        if (ch.leavesMesh.customDepthMaterial !== wantDepth) ch.leavesMesh.customDepthMaterial = wantDepth;
        const nearLeafSh = (!effLow && !isCartoon && shChunkRad >= 0 && dCh <= Math.min(shChunkRad, 1));
        if (ch.leavesMesh.castShadow !== nearLeafSh) ch.leavesMesh.castShadow = nearLeafSh;
      }
      if (ch.plantMesh && ch.plantMesh.receiveShadow !== !effLow) ch.plantMesh.receiveShadow = !effLow;
    }
  }
  function markChunkBorderDirty(cx, cz) {
    const c = chunks.get(chunkKey(cx, cz));
    if (!c) return;
    if (!c.dirty) {
      c.borderDirty = true;
      c._meshGen = (c._meshGen || 0) + 1;
      _borderChunkSet.add(c);
    } else if (c._meshInFlightGen === (c._meshGen || 0)) {
      // Neighbor arrived while worker was meshing stale border -> invalidate in-flight job so chunk remeshes with neighbor!
      c._meshGen = (c._meshGen || 0) + 1;
      c._meshInFlightGen = -1;
    }
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
    const hk = modKey(wx, wy, wz);
    if (persist) {
      recordWorldMod(wx, wy, wz, id);
      if (typeof broadcastBlockMod === 'function' && !isApplyingRemoteBlock) {
        const meta = (id === B.WATER || id === B.LAVA) ? { prevId, fl: fluidLevel.has(hk) ? fluidLevel.get(hk) : 0 } : { prevId };
        broadcastBlockMod(wx, wy, wz, id, meta);
      }
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
    const _nearLocalEdit = !window._bulkRemoteModsApplying && (!isApplyingRemoteBlock || (typeof player !== 'undefined' && player && Math.abs(cx - (Math.floor(player.x) >> 4)) <= 3 && Math.abs(cz - (Math.floor(player.z) >> 4)) <= 3));
    c.dirty = true; c._meshGen = (c._meshGen || 0) + 1; c._meshInFlightGen = -1;
    _dirtyChunkSet.add(c);
    if (_nearLocalEdit) { c.urgentDirty = true; _urgentChunkSet.add(c); }
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
    if (lx <= margin) markChunkDirty(cx - 1, cz, _nearLocalEdit); if (lx >= 15 - margin) markChunkDirty(cx + 1, cz, _nearLocalEdit);
    if (lz <= margin) markChunkDirty(cx, cz - 1, _nearLocalEdit); if (lz >= 15 - margin) markChunkDirty(cx, cz + 1, _nearLocalEdit);
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
    if (fluidLevel.has(k)) return fluidLevel.get(k);
    // Natural world-gen vertical columns above sea level (e.g. Nether lavafalls) are falling streams (8), NOT stacked sources (0)!
    if (wy > WATER_LEVEL && getBlockWorld(wx, wy + 1, wz) === id) return 8;
    return 0; // Unmapped world-gen ocean/lava sea or spring head = natural source (0)
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

  function _dropReplacedFluidBlock(wx, wy, wz, oldId) {
    if (oldId === B.AIR || oldId === B.FIRE || oldId === B.WATER || oldId === B.LAVA) return;
    if (typeof gameMode !== 'undefined' && gameMode === 'creative') return;
    if (typeof spawnDroppedItem === 'function' && (oldId === B.TORCH_BLOCK || (BLOCK_DEF[oldId] && BLOCK_DEF[oldId].cross))) {
      spawnDroppedItem(wx + 0.5, wy + 0.35, wz + 0.5, oldId, 1);
    }
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
    // FIX BUG #3: Breaking/placing ANY block wakes direct 6 neighbors + y+1 ring + 2-block ring so fluid immediately pours into newly opened gaps & cliff pits!
    const dirs = [
      [0,0,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],
      [1,1,0],[-1,1,0],[0,1,1],[0,1,-1],
      [2,0,0],[-2,0,0],[0,0,2],[0,0,-2],[1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1]
    ];
    for (let i = 0; i < dirs.length; i++) {
      const nx = wx + dirs[i][0], ny = wy + dirs[i][1], nz = wz + dirs[i][2];
      const nb = getBlockWorld(nx, ny, nz);
      if (nb === B.WATER) scheduleFluid(nx, ny, nz, (i <= 6 ? 0.08 : 0.12) * speedMul);
      else if (nb === B.LAVA) scheduleFluid(nx, ny, nz, (currentDimension === 'nether' ? 0.14 : 0.24) * speedMul);
    }
  }

  let fluidQueueHead = 0;
  function clearFluidState() { fluidLevel.clear(); pouredFluidSources.clear(); fluidQueue.length = 0; fluidQueueHead = 0; fluidQueuedSet.clear(); waterloggedBlocks.clear(); }

  function flowWaterInto(startX, startY, startZ) {
    const k = modKey(startX, startY, startZ);
    fluidLevel.delete(k);
    pouredFluidSources.delete(k);
    wakeAdjacentFluids(startX, startY, startZ, 0.75);
  }

  // Vanilla Minecraft cliff-seeking slope search (pure local state; water/Nether lava maxDist=4, Overworld lava maxDist=2).
  // Score 0 = hole directly below neighbor; 1..maxDist = steps to nearest hole; maxDist+1 = no hole within range.
  function _findFluidDropDist(x, y, z, curId, depth, fromIdx, maxDist) {
    const belowId = getBlockWorld(x, y - 1, z);
    if (y - 1 > MIN_Y && (_canFluidReplace(belowId) || (belowId === curId && getFluidLevel(x, y - 1, z, curId) > 0))) return depth;
    if (depth >= maxDist) return maxDist + 1;
    let best = maxDist + 1;
    for (let d = 0; d < 4; d++) {
      if (d === fromIdx) continue;
      const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
      const nid = getBlockWorld(nx, y, nz);
      if (!_canFluidReplace(nid) && nid !== curId) continue;
      const dist = _findFluidDropDist(nx, y, nz, curId, depth + 1, _FLUID_REV4[d], maxDist);
      if (dist < best) best = dist;
    }
    return best;
  }

  function tickFluids(dt) {
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof isDimSimAuthority === 'function' && !isDimSimAuthority()) {
      fluidQueue.length = 0; fluidQueuedSet.clear(); fluidQueueHead = 0;
      return;
    }
    if (fluidQueue.length === 0) { fluidQueueHead = 0; return; }
    const syncFluid = !!(typeof activeRoomId !== 'undefined' && activeRoomId);
    if (syncFluid && typeof beginBlockBatch === 'function') beginBlockBatch();
    try {
    let processed = 0, changedVisuals = 0;
    const maxOps = 180;
    const startLen = fluidQueue.length;
    let writeIdx = 0;
    let i = 0;
    for (; i < startLen && processed < maxOps; i++) {
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
      const isNetherLava = isLava && (currentDimension === 'nether');
      const maxSpread = isLava ? (isNetherLava ? 7 : 3) : 7;
      const slopeFindDist = isLava ? (isNetherLava ? 4 : 2) : 4;
      const delayStep = isLava ? (isNetherLava ? 0.20 : 0.42) : 0.16;
      let curLvl = fluidLevel.has(k) ? fluidLevel.get(k) : 0;

      // PHASE 1: Recompute own state from neighbors (computeNewState) + Infinite Water Spring Renewal
      if (curLvl > 0) {
        let expectedLvl = 99;
        const aboveId = getBlockWorld(x, y + 1, z);
        if (aboveId === curId) {
          expectedLvl = 8; // Falling fluid keeps full strength while fed from directly above
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
          // Authentic Minecraft Infinite Water Source: >= 2 orthogonal water sources over solid/source floor
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
            // Drain cleanly: clear fluidLevel BEFORE setBlockWorld so neighbor wakes see AIR immediately
            fluidLevel.delete(k);
            pouredFluidSources.delete(k);
            setBlockWorld(x, y, z, B.AIR, syncFluid);
            changedVisuals++;
            continue;
          }
          if (expectedLvl !== curLvl) {
            fluidLevel.set(k, expectedLvl);
            markFluidDirty(x, y, z);
            changedVisuals++;
            wakeAdjacentFluids(x, y, z, 0.72);
            scheduleFluid(x, y, z, delayStep * 0.75);
            continue;
          }
        }
      }

      // Authentic Minecraft Fluid Mixing Interactions:
      // - Falling Lava onto Water -> STONE; Horizontal Lava into Water -> COBBLESTONE (fallback STONE)
      // - Water touching Lava Source (lvl 0) -> OBSIDIAN; Water touching Flowing Lava (lvl > 0) -> COBBLESTONE
      const reactPair = (tx, ty, tz, targetId) => {
        if (isLava && targetId === B.WATER) {
          const outB = (ty < y) ? B.STONE : (B.COBBLESTONE || B.STONE);
          const rk = modKey(tx, ty, tz);
          fluidLevel.delete(rk);
          pouredFluidSources.delete(rk);
          setBlockWorld(tx, ty, tz, outB, true);
          wakeAdjacentFluids(tx, ty, tz, 0.55);
          if (typeof spawnPixelFx === 'function') spawnPixelFx('smoke_puff', tx + 0.5, ty + 0.95, tz + 0.5, { count: 2, scale: 0.72, life: 1.8 });
          if (typeof playSfx === 'function') playSfx('hiss');
          changedVisuals++;
          return true;
        }
        if (!isLava && targetId === B.LAVA) {
          const tLvl = getFluidLevel(tx, ty, tz, B.LAVA);
          const rk = modKey(tx, ty, tz);
          fluidLevel.delete(rk);
          pouredFluidSources.delete(rk);
          setBlockWorld(tx, ty, tz, tLvl === 0 ? B.OBSIDIAN : (B.COBBLESTONE || B.STONE), true);
          wakeAdjacentFluids(tx, ty, tz, 0.55);
          if (typeof spawnPixelFx === 'function') spawnPixelFx('smoke_puff', tx + 0.5, ty + 0.95, tz + 0.5, { count: 2, scale: 0.78, life: 2.0 });
          if (typeof playSfx === 'function') playSfx('hiss');
          changedVisuals++;
          return true;
        }
        return false;
      };

      // PHASE 2 (FIX BUG #2): Flow DOWN first! Create a full-strength falling column (level 8) all the way to the pit floor.
      // Do NOT spread horizontally when the cell below is open/replaceable or non-source same fluid.
      const belowId = getBlockWorld(x, y - 1, z);
      if (y - 1 > MIN_Y) {
        if (reactPair(x, y - 1, z, belowId)) continue;
        const belowLvl = (belowId === curId) ? getFluidLevel(x, y - 1, z, curId) : 99;
        const canFlowDown = _canFluidReplace(belowId) || (belowId === curId && belowLvl > 0);
        if (canFlowDown) {
          if (belowId !== curId || belowLvl !== 8) {
            if (belowId === B.FIRE && typeof playSfx === 'function') playSfx('hiss');
            else if (belowId !== B.AIR && belowId !== curId) _dropReplacedFluidBlock(x, y - 1, z, belowId);
            const bk = modKey(x, y - 1, z);
            fluidLevel.set(bk, 8); // Set falling level BEFORE setBlockWorld so dirty mesh & wakes see level 8 immediately
            if (belowId !== curId) setBlockWorld(x, y - 1, z, curId, syncFluid);
            else markFluidDirty(x, y - 1, z);
            scheduleFluid(x, y - 1, z, delayStep);
            changedVisuals++;
          }
          continue;
        }
      }

      // PHASE 3 (FIX BUG #2): Spread horizontally ONLY when resting on solid/non-replaceable floor or same-type source.
      // Falling columns (curLvl === 8) landing on solid floor reset to effLvl = 0 and spread out at full horizontal reach!
      const effLvl = (curLvl === 8) ? 0 : curLvl;
      if (effLvl < maxSpread) {
        const nextLvl = effLvl + 1;
        const noDrop = slopeFindDist + 1;
        let minDrop = noDrop;
        const dropDists = [999, 999, 999, 999];
        for (let d = 0; d < 4; d++) {
          const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
          const nbId = getBlockWorld(nx, y, nz);
          if (reactPair(nx, y, nz, nbId)) continue;
          if (_canFluidReplace(nbId) || nbId === curId) {
            const dd = _findFluidDropDist(nx, y, nz, curId, 0, _FLUID_REV4[d], slopeFindDist);
            dropDists[d] = dd;
            if (dd < minDrop) minDrop = dd;
          }
        }
        for (let d = 0; d < 4; d++) {
          if (dropDists[d] > minDrop) continue;
          const nx = x + _FLUID_DIRS4[d][0], nz = z + _FLUID_DIRS4[d][1];
          const nbId = getBlockWorld(nx, y, nz);
          if ((isLava && nbId === B.WATER) || (!isLava && nbId === B.LAVA)) continue;
          const nbLvl = (nbId === curId) ? getFluidLevel(nx, y, nz, curId) : 99;
          if (_canFluidReplace(nbId) || (nbId === curId && nbLvl > nextLvl && nbLvl !== 8)) {
            if (nbId === B.FIRE && typeof playSfx === 'function') playSfx('hiss');
            else if (nbId !== B.AIR && nbId !== curId) _dropReplacedFluidBlock(nx, y, nz, nbId);
            const nk = modKey(nx, y, nz);
            fluidLevel.set(nk, nextLvl); // Set flow level BEFORE setBlockWorld so mesh & wakes never mistake it for a source
            if (nbId !== curId) setBlockWorld(nx, y, nz, curId, syncFluid);
            else markFluidDirty(nx, y, nz);
            scheduleFluid(nx, y, nz, delayStep);
            changedVisuals++;
          }
        }
      }
    }
    // FIX BUG #1: Compact up to LIVE fluidQueue.length (NOT stale startLen!) so newly scheduled fluid ticks pushed during
    // this tick are NEVER truncated/deleted and their keys never get permanently stuck inside fluidQueuedSet!
    const liveLen = fluidQueue.length;
    if (writeIdx !== i) {
      for (let j = i; j < liveLen; j++) fluidQueue[writeIdx++] = fluidQueue[j];
      fluidQueue.length = writeIdx;
    }
    fluidQueueHead = 0;
    if (changedVisuals > 0 && typeof flushUrgentChunks === 'function') flushUrgentChunks(8, true);
    } finally {
      if (syncFluid && typeof endBlockBatch === 'function') endBlockBatch();
    }
  }


  // ===================== v23.0 ANIMATED 3D CHESTS (5 TIERS), DOORS (5 TYPES), TRAPDOORS (4 TYPES), FURNACES & WHEAT CROPS =====================
  const doorOpenState = new Map();     // 'wx,wy,wz' -> boolean
  const openBarrels = new Set();       // 'wx,wy,wz' -> barrel currently open (lid open + Redstone signal active)
  function emitBarrelRedstoneSignal(wx, wy, wz, active) {
    const adj = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    let triggered = false;
    for (const [dx, dy, dz] of adj) {
      const nx = wx + dx, ny = wy + dy, nz = wz + dz;
      const nb = getBlockWorld(nx, ny, nz);
      const nd = BLOCK_DEF[nb];
      if (!nd) continue;
      if (nb === B.NOTE_BLOCK && active) {
        triggered = true;
        spawnParticles(nx + 0.5, ny + 1.1, nz + 0.5, 0xfacc15, 6, true);
        playSfx('xp_orb');
      } else if (nd.door || nd.trapdoor) {
        triggered = true;
        setDoorOpenPair(nx, ny, nz, !!active, true);
      } else if (nb === B.TNT && active) {
        triggered = true;
        setBlockWorld(nx, ny, nz, B.AIR, true);
        spawnPrimedTnt(nx + 0.5, ny, nz + 0.5, 2.4);
      } else if (nb === B.REDSTONE_ORE) {
        triggered = true;
      }
    }
    if (active) {
      spawnParticles(wx + 0.5, wy + 0.85, wz + 0.5, 0xef4444, triggered ? 10 : 4, true);
    }
    return triggered;
  }
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
    if (typeof beginBlockBatch === 'function') beginBlockBatch();
    try {
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
    } finally {
      if (typeof endBlockBatch === 'function') endBlockBatch();
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
    if (!def || !def.chest || def.isBarrel || isEnderChestBlock(id)) return null;
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
    if (typeof openBarrels !== 'undefined') openBarrels.delete(k);
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
  function _makeDreamChestPixelTex() {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    const hasSampler = (typeof sampleDreamWaterRGB === 'function');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      // Exact 1:1 pixel match with tile 352/353 2D icon: 7-color swirling prism body + darkened 2px rainbow border!
      const [r, g, b] = hasSampler ? sampleDreamWaterRGB(x / 15, y / 15, 2.2) : [105, 184, 255];
      if (x <= 1 || x >= 14 || y <= 1 || y >= 14) {
        c.fillStyle = `rgb(${Math.round(r * 0.62)},${Math.round(g * 0.62)},${Math.round(b * 0.62)})`;
      } else {
        c.fillStyle = `rgb(${r},${g},${b})`;
      }
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
    const bodyMap = isDream ? _makeDreamChestPixelTex() : _makeChestPixelTex(tier, pal);
    const latchMap = isWood ? _makeChestLatchTex(pal) : null;
    m = {
      body: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: bodyMap,
        roughness: isWood ? 0.72 : (isDream ? 0.34 : 0.30),
        metalness: isWood ? 0.08 : (isDream ? 0.06 : 0.58),
        emissive: isDream ? 0x1e293b : 0x000000,
        emissiveIntensity: isDream ? 0.10 : 0
      }),
      rim: new THREE.MeshStandardMaterial({
        color: isWood ? 0x2c241b : (isDream ? 0x1e1b4b : pal.rim),
        roughness: isDream ? 0.42 : 0.48,
        metalness: isWood ? 0.12 : (isDream ? 0.18 : 0.65),
        emissive: isDream ? 0x2e2666 : 0x000000,
        emissiveIntensity: isDream ? 0.22 : 0
      }),
      latch: new THREE.MeshStandardMaterial({
        color: isWood ? 0xffffff : (isDream ? 0xfef9c3 : pal.latch),
        map: latchMap,
        roughness: 0.25,
        metalness: isDream ? 0.20 : 0.78,
        emissive: isDream ? 0xfef08a : 0x000000,
        emissiveIntensity: isDream ? 0.22 : 0
      })
    };
    if (isDream) {
      m.body.userData.isRainbowItem = true;
      if (typeof _rainbowMats !== 'undefined' && _rainbowMats) _rainbowMats.add(m.body);
      if (typeof applyRainbowToMat === 'function') applyRainbowToMat(m.body, typeof _dreamRainbowHue === 'number' ? _dreamRainbowHue : 0);
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
    const def = BLOCK_DEF[id]; if (!def || def.isBarrel) return;
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

  function toDimFurnaceKey(kOrWx, wy, wz, dim = currentDimension) {
    if (wy !== undefined) return (dim || 'overworld') + ':' + toTrueChestKey(kOrWx, wy, wz);
    if (!kOrWx) return '';
    if (String(kOrWx).includes(':')) return String(kOrWx);
    return (dim || 'overworld') + ':' + toTrueChestKey(kOrWx);
  }
  function packFurnaceState(fs) {
    if (!fs) return null;
    const pSlot = (s) => (s && s.id && s.count > 0) ? [s.id, s.count] : null;
    return [fs.type || 'furnace', pSlot(fs.inSlot), pSlot(fs.fuelSlot), pSlot(fs.outSlot), +fs.burnLeft.toFixed(2), +fs.burnMax.toFixed(2), +fs.cookT.toFixed(2), +fs.cookNeed.toFixed(2)];
  }
  function unpackFurnaceState(raw) {
    if (!Array.isArray(raw) || raw.length < 4) return null;
    const fType = raw[0] || 'furnace';
    const uSlot = (s) => (Array.isArray(s) && s[0] && s[1] > 0) ? { id: Number(s[0]) || 0, count: Number(s[1]) || 0 } : { id: 0, count: 0 };
    return {
      type: fType,
      inSlot: uSlot(raw[1]), fuelSlot: uSlot(raw[2]), outSlot: uSlot(raw[3]),
      burnLeft: Number(raw[4]) || 0, burnMax: Math.max(0.1, Number(raw[5]) || 1),
      cookT: Number(raw[6]) || 0, cookNeed: Math.max(0.1, Number(raw[7]) || (fType === 'furnace' ? 10.0 : 5.0)),
      _uiSig: ''
    };
  }
  function serializeFurnaceData() {
    const out = [];
    for (const [fk, fs] of furnaceStateMap.entries()) {
      if (!fs) continue;
      if (fs.inSlot.count > 0 || fs.fuelSlot.count > 0 || fs.outSlot.count > 0 || fs.burnLeft > 0) {
        out.push([toDimFurnaceKey(fk), packFurnaceState(fs)]);
      }
    }
    return out.slice(-400);
  }
  function restoreFurnaceData(list) {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const fs = unpackFurnaceState(entry[1]);
      if (fs) furnaceStateMap.set(toDimFurnaceKey(entry[0]), fs);
    }
  }
  function breakFurnaceAt(wx, wy, wz, brokenId = 0) {
    const legacyK = modKey(wx, wy, wz);
    const dk = toDimFurnaceKey(wx, wy, wz);
    const fs = furnaceStateMap.get(dk) || furnaceStateMap.get(legacyK);
    if (fs && typeof spawnDroppedItem === 'function') {
      if (fs.inSlot && fs.inSlot.id && fs.inSlot.count > 0) spawnDroppedItem(wx, wy, wz, fs.inSlot.id, { count: fs.inSlot.count });
      if (fs.fuelSlot && fs.fuelSlot.id && fs.fuelSlot.count > 0) spawnDroppedItem(wx, wy, wz, fs.fuelSlot.id, { count: fs.fuelSlot.count });
      if (fs.outSlot && fs.outSlot.id && fs.outSlot.count > 0) spawnDroppedItem(wx, wy, wz, fs.outSlot.id, { count: fs.outSlot.count });
    }
    furnaceStateMap.delete(dk);
    furnaceStateMap.delete(legacyK);
    if (activeFurnaceKey && (activeFurnaceKey === dk || activeFurnaceKey === legacyK) && typeof closeFurnaceModal === 'function') {
      closeFurnaceModal();
    }
    if (typeof broadcastFurnaceBreak === 'function') broadcastFurnaceBreak(dk);
  }

  // Active Furnace / Blast Furnace / Smoker Smelting Ticker (Authority-driven in co-op, smooth visual interpolation on guests)
  function tickFurnaces(dt) {
    if (furnaceStateMap.size <= 0) return;
    const isAuth = (!activeRoomId || typeof isDimSimAuthority !== 'function' || isDimSimAuthority());
    let activeFurnUpdated = false;
    for (const [fk, fs] of furnaceStateMap.entries()) {
      const speedMul = (fs.type === 'blast' || fs.type === 'smoker') ? 2.0 : 1.0;
      const rec = fs.inSlot.count > 0 ? SMELT_RECIPES[fs.inSlot.id] : null;
      const allowRec = rec && (fs.type === 'furnace' || (fs.type === 'blast' && rec.kind === 'ore') || (fs.type === 'smoker' && rec.kind === 'food'));
      const canOut = allowRec && (fs.outSlot.count === 0 || (fs.outSlot.id === rec.out && fs.outSlot.count < 99));
      let syncThisFurnace = false;
      if (fs.burnLeft > 0) fs.burnLeft = Math.max(0, fs.burnLeft - dt * speedMul);
      if (isAuth && canOut && fs.burnLeft <= 0 && fs.fuelSlot.count > 0 && FUEL_VALUES[fs.fuelSlot.id]) {
        const fId = fs.fuelSlot.id;
        fs.burnMax = FUEL_VALUES[fId];
        fs.burnLeft = fs.burnMax;
        if (fId === B.LAVA_BUCKET) { fs.fuelSlot.id = B.BUCKET; fs.fuelSlot.count = 1; }
        else { fs.fuelSlot.count--; if (fs.fuelSlot.count <= 0) fs.fuelSlot.id = 0; }
        syncThisFurnace = true;
        if (fk === activeFurnaceKey) activeFurnUpdated = true;
      }
      if (canOut && fs.burnLeft > 0) {
        const cookNeed = (rec.cookTime || 10.0) / speedMul;
        fs.cookNeed = cookNeed;
        fs.cookT = isAuth ? (fs.cookT + dt) : Math.min(cookNeed, fs.cookT + dt);
        if (Math.random() < dt * 2.5) {
          const fp = (typeof parseWorldModKey === 'function') ? parseWorldModKey(fk) : null;
          if (fp && fp.dim === currentDimension) spawnParticles(fp.mx + 0.5, fp.my + (depthOffset || 0) + 0.65, fp.mz + 0.5, 0xf97316, 1, true);
        }
        if (isAuth && fs.cookT >= cookNeed) {
          fs.cookT = 0;
          fs.inSlot.count--; if (fs.inSlot.count <= 0) fs.inSlot.id = 0;
          if (fs.outSlot.count === 0) { fs.outSlot.id = rec.out; fs.outSlot.count = 1; }
          else fs.outSlot.count++;
          syncThisFurnace = true;
          if (fk === activeFurnaceKey) activeFurnUpdated = true;
        }
      } else {
        fs.cookT = Math.max(0, fs.cookT - dt * 2.0);
      }
      if (isAuth && syncThisFurnace && typeof broadcastFurnaceSync === 'function') {
        broadcastFurnaceSync(toDimFurnaceKey(fk), fs);
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

    // 3) Natural Wheat Crop Growth Ticker (Authority-driven in co-op)
    const _worldSimAuth = (!activeRoomId || typeof isDimSimAuthority !== 'function' || isDimSimAuthority());
    if (_worldSimAuth) {
      cropTickAccum += dt;
      if (cropTickAccum >= 2.2) {
        cropTickAccum = 0;
        if (typeof beginBlockBatch === 'function') beginBlockBatch();
        try {
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
        } finally {
          if (typeof endBlockBatch === 'function') endBlockBatch();
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


  let _syncGenSkipFrames = 0;
  function updateChunkStreaming(rawDt = 0.016) {
    window._chunkBuiltThisFrame = false;
    const tBudgetStart = performance.now();
    const _sodiumTight = (typeof sodiumOpts === 'undefined' || sodiumOpts.sodium !== false);
    const frameBudgetMs = _sodiumTight
      ? ((rawDt && rawDt < 0.008) ? (_isMobilePerf ? 1.0 : 1.2) : ((rawDt && rawDt > 0.028) ? (_isMobilePerf ? 1.2 : 1.5) : (_isMobilePerf ? 1.6 : 2.0)))
      : ((rawDt && rawDt > 0.028) ? (_isMobilePerf ? 1.4 : 1.8) : (_isMobilePerf ? 2.5 : ((rawDt && rawDt < 0.008) ? 1.5 : 4.2)));
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    const fwdX = -Math.sin(player.yaw || 0), fwdZ = -Math.cos(player.yaw || 0);
    const isMoving = (player.curSpeed || 0) > 1.2 || !!player.sprinting || !!player.flying;
    const vLen = Math.hypot(player.vx || 0, player.vz || 0);
    const dirX = vLen > 0.5 ? player.vx / vLen : fwdX;
    const dirZ = vLen > 0.5 ? player.vz / vLen : fwdZ;
    const acx = Math.floor(player.x + dirX * 14) >> 4;
    const acz = Math.floor(player.z + dirZ * 14) >> 4;

    // Incremental deferred unloading (strictly capped while moving to prevent frame-time hitches)
    if (_chunkUnloadQueue.length > 0) {
      let disposed = 0;
      const maxUnload = isMoving ? 2 : (_chunkUnloadQueue.length > 64 ? (renderDistance > 8 ? 8 : 16) : (renderDistance > 8 ? 4 : 2));
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
      // Rust WASM zero-GC shell sort for large 32x32 chunk queues (fallback to JS sort if WASM not ready)
      const _qLen = emergeQueue.length;
      const _wCore = (_qLen > 12 && _qLen <= 2048 && typeof window._getNucraftWasmCore === 'function') ? window._getNucraftWasmCore() : null;
      if (_wCore && _wCore.exports && _wCore.exports.sort_chunk_stream_queue && _wCore.chunkQCoords && _wCore.chunkQOrder) {
        const coords = _wCore.chunkQCoords;
        for (let qi = 0; qi < _qLen; qi++) {
          coords[qi * 2] = emergeQueue[qi][0] | 0;
          coords[qi * 2 + 1] = emergeQueue[qi][1] | 0;
        }
        const sortedN = _wCore.exports.sort_chunk_stream_queue(_qLen | 0, pcx | 0, pcz | 0, fwdX, fwdZ, acx | 0, acz | 0) >>> 0;
        if (sortedN === _qLen) {
          const order = _wCore.chunkQOrder;
          const copy = emergeQueue.slice();
          for (let qi = 0; qi < _qLen; qi++) emergeQueue[qi] = copy[order[qi]];
          if (_wCore.state) _wCore.state.chunkSortCalls = (_wCore.state.chunkSortCalls || 0) + 1;
        } else {
          emergeQueue.sort((a, b) =>
            _chunkFrustumScore(b[0], b[1], pcx, pcz, fwdX, fwdZ, acx, acz) -
            _chunkFrustumScore(a[0], a[1], pcx, pcz, fwdX, fwdZ, acx, acz)
          );
        }
      } else {
        // Descending sort so highest priority (lowest score) is popped in O(1) from the tail
        emergeQueue.sort((a, b) =>
          _chunkFrustumScore(b[0], b[1], pcx, pcz, fwdX, fwdZ, acx, acz) -
          _chunkFrustumScore(a[0], a[1], pcx, pcz, fwdX, fwdZ, acx, acz)
        );
      }
    }
    if (!isWorldLoading && chunkWorkerPool.active) {
      const _hiHz = (rawDt && rawDt < 0.008);
      const drainMax = movedChunk ? 1 : (isMoving ? 2 : (_isMobilePerf ? 2 : (_hiHz ? 2 : (renderDistance > 8 ? 6 : 4))));
      const drainMs = movedChunk ? 0.8 : (isMoving ? 1.0 : (_isMobilePerf ? 1.0 : (_hiHz ? 1.0 : (renderDistance > 8 ? 1.8 : 1.5))));
      if (chunkWorkerPool.drainCompletedMeshes(drainMax, drainMs) > 0) {
        window._chunkBuiltThisFrame = true;
      }
    }
    if (chunkWorkerPool.active && currentDimension === 'overworld' && emergeQueue.length > 0) {
      const lookAhead = _isMobilePerf ? 10 : (renderDistance > 8 ? 22 : 16);
      for (let pi = emergeQueue.length - 1, lim = Math.max(0, emergeQueue.length - lookAhead); pi >= lim; pi--) {
        const ecx = emergeQueue[pi][0], ecz = emergeQueue[pi][1];
        if ((depthOffset || 0) === 0 && !isAbandonedCity(ecx * 16 + 8, ecz * 16 + 8) && !isGrandRuins(ecx * 16 + 8, ecz * 16 + 8)) {
          chunkWorkerPool.prefetchOverworld(ecx, ecz);
        } else {
          chunkWorkerPool.prefetch(ecx, ecz, depthOffset);
        }
      }
    }
    // Never stack a 16-block crossing scan+sort with synchronous chunk gen/mesh in the exact same frame
    if (movedChunk && _teleportWarmupFrames <= 0 && !isWorldLoading && _urgentChunkSet.size === 0 &&
        !document.body.classList.contains('in-lobby') && !window._isWorldPaused) {
      if (typeof farLodSystem !== 'undefined') farLodSystem.update(pcx, pcz);
      return;
    }

    // Periodic self-healing sweep (idle frames only): guarantee zero missing/unmeshed invisible chunks inside renderDistance!
    if (!movedChunk && !isMoving && emergeQueue.length === 0 && !isWorldLoading && (frameCounter % 120) === 0) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
          const cx = pcx + dx, cz = pcz + dz, k = chunkKey(cx, cz);
          const ch = chunks.get(k);
          if (!ch) {
            if (!emergeSet.has(k)) { emergeSet.add(k); emergeQueue.push([cx, cz]); }
          } else if (!ch.meshed && !ch.dirty && !ch.urgentDirty) {
            ch.dirty = true; ch._meshInFlightGen = -1; _dirtyChunkSet.add(ch);
          }
        }
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
        if (ch._meshInFlightGen === (ch._meshGen || 0)) {
          // Watchdog: if worker mesh job took >2.0s (dropped/stalled), release & fall back cleanly so chunk NEVER stays invisible!
          if ((tBudgetStart - (ch._meshInFlightAt || 0)) > 2000) {
            ch._meshInFlightGen = -1;
            ch._workerTimeouts = (ch._workerTimeouts || 0) + 1;
            if (ch._workerTimeouts >= 2) ch._skipWorkerMesh = true;
          } else {
            continue;
          }
        }
        let sc = _chunkFrustumScore(ch.cx, ch.cz, pcx, pcz, fwdX, fwdZ, acx, acz);
        if (ch._pendingSlice) sc *= 0.35;
        if (sc < dirtyScore) { dirtyScore2 = dirtyScore; dirtyCh2 = dirtyCh; dirtyScore = sc; dirtyCh = ch; }
        else if (sc < dirtyScore2) { dirtyScore2 = sc; dirtyCh2 = ch; }
      }
      if (!dirtyCh) {
        for (const ch of _borderChunkSet) {
          if (!ch.borderDirty) { _borderChunkSet.delete(ch); continue; }
          if (ch._meshInFlightGen === (ch._meshGen || 0)) {
            if ((tBudgetStart - (ch._meshInFlightAt || 0)) > 2000) {
              ch._meshInFlightGen = -1;
              ch._workerTimeouts = (ch._workerTimeouts || 0) + 1;
              if (ch._workerTimeouts >= 2) ch._skipWorkerMesh = true;
            } else {
              continue;
            }
          }
          const sc = _chunkFrustumScore(ch.cx, ch.cz, pcx, pcz, fwdX, fwdZ, acx, acz);
          if (sc < borderScore) { borderScore = sc; borderCh = ch; }
        }
      }
    }

    if (urgentCh) {
      window._chunkBuiltThisFrame = true;
      flushUrgentChunks(_isMobilePerf ? 3 : 5, false, _isMobilePerf ? 2.5 : 3.5);
      if (typeof farLodSystem !== 'undefined') farLodSystem.update(pcx, pcz);
      return;
    }

    // Horizon + Luanti-style frame-budgeted chunk streaming: parallel worker dispatch first, sync WASM for standing chunk
    if (!document.body.classList.contains('in-lobby') && !window._isWorldPaused) {
      if (chunkWorkerPool.active) {
        let preDispatched = 0;
        const maxPreDispatch = _isMobilePerf ? 2 : 4;
        for (const ch of _dirtyChunkSet) {
          if (preDispatched >= maxPreDispatch) break;
          if (!ch || !ch.dirty || ch._pendingSlice || ch._meshInFlightGen === (ch._meshGen || 0)) continue;
          const d2 = (ch.cx - pcx) * (ch.cx - pcx) + (ch.cz - pcz) * (ch.cz - pcz);
          if (d2 > 0 && _dispatchChunkMeshToWorker(ch)) {
            if (ch === dirtyCh) { dirtyCh = dirtyCh2; dirtyCh2 = null; }
            else if (ch === dirtyCh2) { dirtyCh2 = null; }
            preDispatched++;
          }
        }
      }
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
          const d2 = (dirtyCh.cx - pcx) * (dirtyCh.cx - pcx) + (dirtyCh.cz - pcz) * (dirtyCh.cz - pcz);
          if (d2 > 0 && !dirtyCh._pendingSlice && _dispatchChunkMeshToWorker(dirtyCh)) {
            dirtyCh = dirtyCh2; dirtyCh2 = null;
          } else {
            rebuildChunkMesh(dirtyCh);
            dirtyCh = dirtyCh2; dirtyCh2 = null;
            meshOps++; ops++;
          }
        } else if (canGen) {
          let generated = false, deferredToWorker = false;
          const scanLim = (chunkWorkerPool.active && currentDimension === 'overworld' && (depthOffset || 0) === 0) ? Math.min(12, emergeQueue.length) : 1;
          while (emergeQueue.length > 0) {
            let pickIdx = emergeQueue.length - 1, pickedReady = false;
            if (scanLim > 1) {
              const stopAt = Math.max(0, emergeQueue.length - scanLim);
              for (let si = emergeQueue.length - 1; si >= stopAt; si--) {
                const scx = emergeQueue[si][0], scz = emergeQueue[si][1];
                const d2 = (scx - pcx) * (scx - pcx) + (scz - pcz) * (scz - pcz);
                if (d2 <= 1 || chunkWorkerPool.hasOverworld(scx, scz)) { pickIdx = si; pickedReady = true; break; }
              }
              if (!pickedReady && isMoving && !warming && _syncGenSkipFrames < 4) {
                const tc = emergeQueue[pickIdx];
                if (!isAbandonedCity(tc[0] * 16 + 8, tc[1] * 16 + 8) && !isGrandRuins(tc[0] * 16 + 8, tc[1] * 16 + 8)) {
                  chunkWorkerPool.prefetchOverworld(tc[0], tc[1]);
                }
                _syncGenSkipFrames++;
                deferredToWorker = true;
                break;
              }
            }
            const picked = (pickIdx === emergeQueue.length - 1) ? emergeQueue.pop() : emergeQueue.splice(pickIdx, 1)[0];
            const [cx, cz] = picked, k = chunkKey(cx, cz); emergeSet.delete(k);
            if (Math.abs(cx - pcx) <= renderDistance + 1 && Math.abs(cz - pcz) <= renderDistance + 1 && !chunks.has(k)) {
              generateChunk(cx, cz);
              _syncGenSkipFrames = 0;
              generated = true;
              break;
            }
          }
          if (deferredToWorker) break;
          if (generated) ops++; else break;
        } else if (canMesh && dirtyCh) {
          const d2 = (dirtyCh.cx - pcx) * (dirtyCh.cx - pcx) + (dirtyCh.cz - pcz) * (dirtyCh.cz - pcz);
          if (d2 > 0 && !dirtyCh._pendingSlice && _dispatchChunkMeshToWorker(dirtyCh)) {
            dirtyCh = dirtyCh2; dirtyCh2 = null;
          } else {
            rebuildChunkMesh(dirtyCh);
            dirtyCh = dirtyCh2; dirtyCh2 = null;
            meshOps++; ops++;
          }
        } else if (canMesh && borderCh && (borderScore <= 4.5 || (!isMoving && (frameCounter & (_isMobilePerf ? 3 : 1)) === 0))) {
          if (_dispatchChunkMeshToWorker(borderCh)) {
            borderCh = null;
          } else {
            rebuildChunkMesh(borderCh);
            borderCh = null;
            meshOps++; ops++;
          }
        } else {
          break;
        }
      }
      if (ops > 0) window._chunkBuiltThisFrame = true;
      if (typeof farLodSystem !== 'undefined') farLodSystem.update(pcx, pcz);
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
    if (typeof farLodSystem !== 'undefined') farLodSystem.update(pcx, pcz);
  }


  function findSafeSpawnPoint(cx = 8, cz = 8, preferScenic = true) {
    if (preferScenic) {
      for (const targetB of [BIOMES.SAKURA, BIOMES.FOREST, BIOMES.PLAINS]) {
        for (let r = 4; r <= 108; r += 4) for (let dz = -r; dz <= r; dz += 4) for (let dx = -r; dx <= r; dx += 4) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const wx = cx + dx, wz = cz + dz;
          if (typeof getOceanMacro === 'function' && getOceanMacro(wx, wz).isOcean) continue;
          const b = getBiomeAt(wx, wz);
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
    for (let r = 0; r <= 32; r += (r < 12 ? 1 : 4)) for (let dz = -r; dz <= r; dz += (r < 12 ? 1 : 4)) for (let dx = -r; dx <= r; dx += (r < 12 ? 1 : 4)) {
      const wx = cx + dx, wz = cz + dz;
      if (typeof getOceanMacro === 'function' && getOceanMacro(wx, wz).isOcean) continue;
      const h = getTerrainHeight(wx, wz, getBiomeAt(wx, wz));
      if (h > WATER_LEVEL) return { x: wx + 0.5, y: h + 2, z: wz + 0.5, yaw: -0.45 };
    }
    return { x: cx + 0.5, y: Math.max(WATER_LEVEL + 2, getTerrainHeight(cx, cz, getBiomeAt(cx, cz)) + 2), z: cz + 0.5, yaw: -0.45 };
  }

  const _DIM_TO_ID = { overworld: 0, nether: 1, end: 2, sift: 3, warden: 4, dragon_realm: 5 };
  const _ID_TO_DIM = ['overworld', 'nether', 'end', 'sift', 'warden', 'dragon_realm'];
  function _jsEncodeNcw1Batch(entries) {
    const sorted = entries.slice().sort((a, b) => (a[0] - b[0]) || (a[3] - b[3]) || (a[2] - b[2]) || (a[1] - b[1]) || (a[5] - b[5]));
    const uniq = [];
    for (let i = 0; i < sorted.length; i++) {
      let keep = sorted[i];
      while (i + 1 < sorted.length && sorted[i + 1][0] === keep[0] && sorted[i + 1][1] === keep[1] && sorted[i + 1][2] === keep[2] && sorted[i + 1][3] === keep[3]) {
        keep = sorted[++i];
      }
      uniq.push(keep);
    }
    const out = [78, 67, 87, 49, 1, 0, uniq.length & 255, (uniq.length >>> 8) & 255, (uniq.length >>> 16) & 255, (uniq.length >>> 24) & 255];
    const pushV = (v) => { v >>>= 0; while (v >= 0x80) { out.push((v & 0x7f) | 0x80); v >>>= 7; } out.push(v); };
    const zz = (v) => ((v << 1) ^ (v >> 31)) >>> 0;
    let pDim = 0xff, px = 0, py = 0, pz = 0, pBid = 0xffff;
    for (let i = 0; i < uniq.length;) {
      const [dim, x, y, z, bid] = uniq[i];
      let run = 1;
      while (i + run < uniq.length && uniq[i + run][0] === dim && uniq[i + run][3] === z && uniq[i + run][2] === y && uniq[i + run][4] === bid && uniq[i + run][1] === ((x + run) | 0)) run++;
      let fl = 0;
      if (dim !== pDim) fl |= 1;
      if (z !== pz || pDim === 0xff) fl |= 2;
      if (y !== py || pDim === 0xff) fl |= 4;
      if (bid !== pBid) fl |= 8;
      if (run > 1) fl |= 16;
      out.push(fl);
      if (fl & 1) out.push(dim & 255);
      if (fl & 2) pushV(zz((z - pz) | 0));
      if (fl & 4) pushV(zz((y - py) | 0));
      pushV(zz((x - px) | 0));
      if (fl & 8) pushV(bid & 0xffff);
      if (fl & 16) pushV(run - 2);
      pDim = dim; pz = z; py = y; px = (x + run - 1) | 0; pBid = bid;
      i += run;
    }
    return new Uint8Array(out);
  }
  function _jsDecodeNcw1Batch(u8) {
    if (!u8 || u8.length < 10 || u8[0] !== 78 || u8[1] !== 67 || u8[2] !== 87 || u8[3] !== 49) return null;
    const ver = u8[4] | (u8[5] << 8);
    if (ver !== 1) return null;
    const uniq = (u8[6] | (u8[7] << 8) | (u8[8] << 16) | (u8[9] << 24)) >>> 0;
    let pos = 10;
    const readV = () => {
      let res = 0, sh = 0;
      while (pos < u8.length && sh < 35) {
        const b = u8[pos++];
        res |= (b & 0x7f) << sh;
        if ((b & 0x80) === 0) return res >>> 0;
        sh += 7;
      }
      return null;
    };
    const unzz = (v) => (v >>> 1) ^ -(v & 1);
    const res = [];
    let dim = 0, x = 0, y = 0, z = 0, bid = 0;
    while (res.length < uniq) {
      if (pos >= u8.length) return null;
      const fl = u8[pos++];
      if (fl & 0xe0) return null;
      if (fl & 1) { if (pos >= u8.length) return null; dim = u8[pos++]; }
      if (fl & 2) { const v = readV(); if (v === null) return null; z = (z + unzz(v)) | 0; }
      if (fl & 4) { const v = readV(); if (v === null) return null; y = ((y + unzz(v)) << 16) >> 16; }
      const dx = readV(); if (dx === null) return null; x = (x + unzz(dx)) | 0;
      if (fl & 8) { const b = readV(); if (b === null || b > 65535) return null; bid = b; }
      let run = 1;
      if (fl & 16) { const ex = readV(); if (ex === null) return null; run = 2 + ex; }
      if (res.length + run > uniq) return null;
      const dName = _ID_TO_DIM[dim] || 'overworld';
      for (let r = 0; r < run; r++) res.push([dimModKey((x + r) | 0, y, z, dName), bid]);
      x = (x + run - 1) | 0;
    }
    return pos === u8.length ? res : null;
  }
  function _encodeBatch(entries) {
    if (_nwExports && _nwExports.encode_world_mods_bin && entries.length <= 160000) {
      _syncWasmViews();
      if (_nwCodecIn && _nwCodecOut) {
        const dv = new DataView(_nwCodecIn.buffer, _nwCodecIn.byteOffset, entries.length * 13);
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i], off = i * 13;
          _nwCodecIn[off] = e[0] & 255;
          dv.setInt32(off + 1, e[1] | 0, true);
          dv.setInt16(off + 5, e[2] | 0, true);
          dv.setInt32(off + 7, e[3] | 0, true);
          dv.setUint16(off + 11, e[4] & 0xffff, true);
        }
        const byteLen = _nwExports.encode_world_mods_bin(entries.length >>> 0) >>> 0;
        if (byteLen >= 10) {
          _nucraftWasmState.codecCalls++;
          return _nwCodecOut.slice(0, byteLen);
        }
      }
    }
    return _jsEncodeNcw1Batch(entries);
  }
  function _decodeBatch(u8) {
    if (_nwExports && _nwExports.decode_world_mods_bin && u8.length <= 2097152) {
      _syncWasmViews();
      if (_nwCodecIn && _nwCodecOut) {
        _nwCodecIn.set(u8);
        const cnt = _nwExports.decode_world_mods_bin(u8.length >>> 0) >>> 0;
        if (cnt === 0xFFFFFFFF) return null;
        _nucraftWasmState.codecCalls++;
        const dv = new DataView(_nwCodecOut.buffer, _nwCodecOut.byteOffset, cnt * 13);
        const out = new Array(cnt);
        for (let i = 0; i < cnt; i++) {
          const off = i * 13;
          const dim = _nwCodecOut[off];
          const x = dv.getInt32(off + 1, true);
          const y = dv.getInt16(off + 5, true);
          const z = dv.getInt32(off + 7, true);
          const bid = dv.getUint16(off + 11, true);
          out[i] = [dimModKey(x, y, z, _ID_TO_DIM[dim] || 'overworld'), bid];
        }
        return out;
      }
    }
    return _jsDecodeNcw1Batch(u8);
  }
  function encodeWorldModsBinary(modsMap) {
    const entries = [];
    let idx = 0;
    for (const [mk, bid] of modsMap.entries()) {
      const p = parseWorldModKey(mk);
      if (!p || p.my < -32768 || p.my > 32767) continue;
      const dId = _DIM_TO_ID[p.dim];
      if (dId === undefined) continue;
      entries.push([dId, p.mx | 0, p.my | 0, p.mz | 0, bid & 0xffff, idx++]);
    }
    if (entries.length <= 160000) return _encodeBatch(entries);
    const parts = [];
    for (let s = 0; s < entries.length; s += 160000) parts.push(_encodeBatch(entries.slice(s, s + 160000)));
    let totalBytes = 8 + parts.length * 4;
    for (const pt of parts) totalBytes += pt.length;
    const out = new Uint8Array(totalBytes);
    out.set([78, 67, 87, 77], 0); // "NCWM"
    const dv = new DataView(out.buffer);
    dv.setUint32(4, parts.length, true);
    let pOff = 8;
    for (const pt of parts) { dv.setUint32(pOff, pt.length, true); pOff += 4; out.set(pt, pOff); pOff += pt.length; }
    return out;
  }
  function decodeWorldModsBinary(raw) {
    const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw || 0);
    if (u8.length < 10) return null;
    if (u8[0] === 78 && u8[1] === 67 && u8[2] === 87 && u8[3] === 77) {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const count = dv.getUint32(4, true);
      let pos = 8;
      const all = [];
      for (let p = 0; p < count; p++) {
        if (pos + 4 > u8.length) return null;
        const len = dv.getUint32(pos, true); pos += 4;
        if (pos + len > u8.length) return null;
        const part = _decodeBatch(u8.subarray(pos, pos + len));
        if (!part) return null;
        for (let i = 0; i < part.length; i++) all.push(part[i]);
        pos += len;
      }
      return pos === u8.length ? all : null;
    }
    return _decodeBatch(u8);
  }
  const NucraftWorldDB = (() => {
    const DB_NAME = 'nucraft_worlds_db_v1', STORE = 'world_mods';
    let _dbProm = null;
    const openDb = () => {
      if (_dbProm) return _dbProm;
      _dbProm = new Promise((resolve) => {
        try {
          if (typeof indexedDB === 'undefined') { resolve(null); return; }
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (_) { resolve(null); }
      });
      return _dbProm;
    };
    return {
      async save(worldId, modsMap) {
        try {
          const db = await openDb();
          if (!db || !worldId) return false;
          const bin = encodeWorldModsBinary(modsMap);
          return await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE, 'readwrite');
              tx.objectStore(STORE).put({ id: String(worldId), bin, count: modsMap.size, updatedAt: Date.now() });
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
            } catch (_) { resolve(false); }
          });
        } catch (_) { return false; }
      },
      async load(worldId) {
        try {
          const db = await openDb();
          if (!db || !worldId) return null;
          return await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE, 'readonly');
              const req = tx.objectStore(STORE).get(String(worldId));
              req.onsuccess = () => {
                const rec = req.result;
                if (!rec || !rec.bin) { resolve(null); return; }
                resolve(decodeWorldModsBinary(rec.bin));
              };
              req.onerror = () => resolve(null);
            } catch (_) { resolve(null); }
          });
        } catch (_) { return null; }
      },
      async remove(worldId) {
        try {
          const db = await openDb();
          if (!db || !worldId) return false;
          return await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE, 'readwrite');
              tx.objectStore(STORE).delete(String(worldId));
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
            } catch (_) { resolve(false); }
          });
        } catch (_) { return false; }
      }
    };
  })();
  function saveWorldModsIdb(worldId, modsMap) { return NucraftWorldDB.save(worldId, modsMap); }
  function loadWorldModsIdb(worldId) { return NucraftWorldDB.load(worldId); }
  function deleteWorldModsIdb(worldId) { return NucraftWorldDB.remove(worldId); }

  const SAVE_KEY = 'luanti_craft_v13_save';
  function saveWorld() {
    try {
      const modsArr = []; for (const [k, v] of worldMods.entries()) modsArr.push([k, v]);
      if (typeof currentWorldMeta !== 'undefined' && currentWorldMeta && currentWorldMeta.id) {
        saveWorldModsIdb(currentWorldMeta.id, worldMods);
      }
      saveWorldModsIdb('quick_save', worldMods);
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seed: worldSeed,
        player: { x: player.x, y: player.y, trueY: player.y - (depthOffset || 0), z: player.z, yaw: player.yaw, pitch: player.pitch, dim: currentDimension, depthOffset: depthOffset || 0, hp: player.hp, armor: player.armor, equip: player.equip, equipMeta: player.equipMeta, offhandDur: player.offhandDur || 336, offhandMaxDur: player.offhandMaxDur || 336, hunger: player.hunger, xp: player.xp, level: player.level, daysPlayed: player.daysPlayed, swiftSneak: player.swiftSneak || 0, bedSpawn: player.bedSpawn || null },
        inventory, dayTime, weatherMode, hasIdbMods: true, modsCount: worldMods.size, mods: modsArr.slice(-1500),
        savedMobs: (typeof serializeMobsForSave === 'function') ? serializeMobsForSave() : [],
        dimMobState: (typeof serializeDimMobPersistence === 'function') ? serializeDimMobPersistence() : null,
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

  // ============ HOUSE 6 (medium): MEDIEVAL TIMBER TOWNHOUSE — Nhà Phố Trung Cổ Khung Gỗ Đá ============
  function buildMedievalTimberHouse(hx, hz, fz) {
    const halfX = 6, halfZ = 5, zE = 6, eaveY = 10;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, STONE = B.STONE_BRICK, WALL = B.MARBLE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? STONE : B.PLANKS);
    }
    // Tầng 1: Tường đá gạch cổ + cửa gỗ sồi + cửa kính + bồn hoa lá
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (isFront && dx === 0 && wy <= 2) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && Math.abs(dx) === 3) || (onX && dz === 0);
      const isWin = (wy === 2 || wy === 3) && ((isFront && (Math.abs(dx) === 4 || Math.abs(dx) === 2)) || (onX && Math.abs(dz) === 2));
      if (isWin) {
        put(dx, wy, dz, B.GLASS);
        if (isFront && wy === 2) put(dx, 1, halfZ + 1, B.OAK_LEAVES);
        continue;
      }
      put(dx, wy, dz, isPost || wy === 4 ? FR : ((wy === 1 || ((dx + dz + wy) & 3) === 0) ? B.DEEPSLATE_BRICKS : STONE));
    }
    vSlab(put, halfX, halfZ, 1);
    // Tầng 2 nhô ra 1 block phía trước kiểu trung cổ + khung gỗ đậm & tường vôi trắng
    for (let wy = 6; wy <= 9; wy++) for (let dz = -halfZ; dz <= halfZ + 1; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ + 1;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5)) || (onX && dz === 0) || wy === 6 || wy === 9;
      const isWin = (wy === 7 || wy === 8) && ((isFront && (Math.abs(dx) === 1 || Math.abs(dx) === 4)) || (onX && Math.abs(dz) === 2));
      if (isWin) {
        put(dx, wy, dz, B.GLASS);
        if (isFront && wy === 7) put(dx, 6, halfZ + 2, B.OAK_LEAVES);
        continue;
      }
      put(dx, wy, dz, isPost ? FR : WALL);
    }
    vRoof(put, halfX, zE, eaveY, B.DEEPSLATE, FR, B.DEEPSLATE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : WALL));
    vDormer(put, 0, 2, halfZ + 1, 6, eaveY, WALL, FR, B.DEEPSLATE_STAIRS_N, B.DEEPSLATE);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, WALL);
    // Ống khói đá cao + tường rào đá bao sân + cây bụi lá
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE + 1; wy++) put(chX, wy, chZ, STONE);
    put(chX, eaveY + zE + 2, chZ, B.CAMPFIRE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9401, halfZ + 1);
    vDoors(put, halfZ, B.SPRUCE_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, false);
    vFurn2(put, halfX, halfZ, true, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 7);
    return baseY;
  }

  // ============ HOUSE 7 (medium): MEDIEVAL BLACKSMITH FORGE — Lò Rèn Trung Cổ Minecraft ============
  function buildMedievalBlacksmith(hx, hz, fz) {
    const halfX = 7, halfZ = 4, zE = 5, eaveY = 6;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const STONE = B.STONE_BRICK, FR = B.OAK_LOG;
    // Nền đá gạch toàn khu (bên trái = hiên lò rèn mở, bên phải = xưởng & phòng nghỉ)
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 0, dz, dx >= 0 && Math.abs(dx) < halfX && Math.abs(dz) < halfZ ? B.PLANKS : STONE);
    }
    // Phần phải (dx = 0..halfX): phòng ở & kho đồ khép kín
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = 0; dx <= halfX; dx++) {
      const onX = (dx === 0 || dx === halfX), onZ = (Math.abs(dz) === halfZ);
      if (!onX && !onZ) continue;
      if (dz === halfZ && dx === 3 && wy <= 2) continue;
      const isCorner = (onX && onZ) || wy === 4;
      const isWin = (wy === 2 || wy === 3) && ((dz === halfZ && dx === 5) || (dx === halfX && Math.abs(dz) <= 1));
      if (isWin) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isCorner ? FR : (wy === 1 ? STONE : B.PLANKS));
    }
    // Phần trái (dx = -halfX..-1): hiên lò rèn lộ thiên có mái che + cột rào + bể dung nham an toàn
    for (const [cx2, cz2] of [[-halfX, -halfZ], [-halfX, halfZ], [-1, -halfZ], [-1, halfZ]]) {
      for (let wy = 1; wy <= 4; wy++) put(cx2, wy, cz2, wy <= 2 ? B.OAK_FENCE : FR);
    }
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= -1; dx++) {
      if (dx === -halfX || dz === -halfZ) for (let wy = 1; wy <= 4; wy++) put(dx, wy, dz, STONE);
    }
    // Lò dung nham an toàn + đe + 2 lò luyện kim + rương vũ khí
    for (let dz = -2; dz <= 0; dz++) for (let dx = -5; dx <= -3; dx++) {
      put(dx, 1, dz, (dx === -4 && dz === -1) ? B.LAVA : STONE);
    }
    put(-4, 0, -1, STONE);
    put(-5, 1, -2, B.BLAST_FURNACE); put(-3, 1, -2, B.FURNACE);
    put(-2, 1, 2, B.ANVIL); put(-5, 1, 2, B.CHEST);
    put(-2, 2, 2, B.LANTERN);
    // Mái ngói đá dốc cho cả xưởng & hiên lò rèn + ống khói đá cao
    vRoof(put, halfX, zE, eaveY, STONE, B.DEEPSLATE, B.STONE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) & 1) ? FR : STONE));
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    for (let wy = 1; wy <= eaveY + zE + 3; wy++) {
      put(-5, wy, -3, STONE); put(-4, wy, -3, B.DEEPSLATE_BRICKS);
    }
    put(-5, eaveY + zE + 4, -3, B.CAMPFIRE);
    // Cửa xưởng bên phải + nội thất cơ bản + tường đá & lá trang trí quanh nhà
    put(3, 1, halfZ, B.SPRUCE_DOOR); put(3, 2, halfZ, B.AIR); put(3, 3, halfZ, FR);
    put(2, 2, halfZ + 1, B.LANTERN); put(4, 2, halfZ + 1, B.LANTERN);
    put(5, 1, -2, B.BED); put(6, 1, -2, B.BED_FOOT);
    put(2, 1, -2, B.CRAFT_TABLE); put(6, 1, 2, B.IRON_CHEST); put(3, 4, 0, B.LANTERN);
    for (let dx = -halfX - 1; dx <= halfX + 1; dx++) {
      if (Math.abs(dx - 3) <= 1) continue;
      const wz2 = hz + (halfZ + 2) * fz, gy2 = colGroundY(hx + dx, wz2);
      if (gy2 >= baseY - 1 && gy2 <= baseY + 2) {
        setBlockWorld(hx + dx, gy2 + 1, wz2, ((dx & 3) === 0) ? B.OAK_LEAVES : B.STONE_BRICK_WALL, true);
      }
    }
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 7);
    return baseY;
  }

  // ============ HOUSE 8 (large): MEDIEVAL TAVERN & INN — Quán Trọ Trung Cổ 2 Tầng ============
  function buildMedievalTavern(hx, hz, fz) {
    const halfX = 8, halfZ = 5, zE = 7, eaveY = 10;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, STONE = B.STONE_BRICK, CREAM = B.MARBLE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 0, dz, (Math.abs(dx) === halfX || Math.abs(dz) === halfZ) ? STONE : B.PLANKS);
    }
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (isFront && dx === 0 && wy <= 2) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 3 || Math.abs(dx) === 6)) || (onX && dz === 0) || wy === 4;
      const isWin = (wy === 2 || wy === 3) && ((isFront && (Math.abs(dx) === 4 || Math.abs(dx) === 5 || Math.abs(dx) === 7)) || (onX && Math.abs(dz) === 2));
      if (isWin) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isPost ? FR : STONE);
    }
    vSlab(put, halfX, halfZ, 2);
    // Ban công gỗ phía trước + cột đèn treo biển quán trọ
    for (const px of [-6, -2, 2, 6]) {
      for (let wy = 1; wy <= 5; wy++) put(px, wy, halfZ + 2, wy <= 4 ? B.OAK_FENCE : FR);
      put(px, 4, halfZ + 2, B.LANTERN);
    }
    for (let dx = -6; dx <= 6; dx++) put(dx, 6, halfZ + 2, B.OAK_FENCE);
    for (let wy = 6; wy <= 9; wy++) for (let dz = -halfZ; dz <= halfZ + 1; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ + 1;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5)) || (onX && dz === 0) || wy === 6 || wy === 9;
      const isWin = (wy === 7 || wy === 8) && ((isFront && (Math.abs(dx) === 3 || Math.abs(dx) === 4 || Math.abs(dx) === 6)) || (onX && Math.abs(dz) === 2));
      if (isWin) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isPost ? FR : CREAM);
    }
    vRoof(put, halfX, zE, eaveY, B.TERRACOTTA, FR, B.TERRACOTTA_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : CREAM));
    vDormer(put, -4, 2, halfZ + 1, 6, eaveY, CREAM, FR, B.TERRACOTTA_STAIRS_N, FR);
    vDormer(put, 4, 2, halfZ + 1, 6, eaveY, CREAM, FR, B.TERRACOTTA_STAIRS_N, FR);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);
    const chX = halfX - 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE + 1; wy++) put(chX, wy, chZ, STONE);
    put(chX, eaveY + zE + 2, chZ, B.CAMPFIRE);
    // Bàn ăn ngoài hiên + đống cỏ khô
    put(-4, 1, halfZ + 3, B.OAK_FENCE); put(-4, 2, halfZ + 3, B.OAK_TRAPDOOR);
    put(4, 1, halfZ + 3, B.OAK_FENCE); put(4, 2, halfZ + 3, B.OAK_TRAPDOOR);
    put(-7, 1, halfZ + 2, B.HAY_BALE); put(-7, 2, halfZ + 2, B.HAY_BALE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9403, halfZ + 1);
    vDoors(put, halfZ, B.OAK_DOOR, colGroundY(hx, hz - (halfZ + 1) * fz) <= baseY + 2, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, false);
    vFurn2(put, halfX, halfZ, true, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 8);
    return baseY;
  }

  // ============ HOUSE 9 (large): MEDIEVAL CHAPEL & BELL TOWER — Thánh Đường Tháp Chuông Đá Cổ ============
  function buildMedievalChapelTower(hx, hz, fz) {
    const halfX = 5, halfZ = 6, zE = 6, eaveY = 8;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const STONE = B.STONE_BRICK, MARBLE = B.MARBLE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 0, dz, ((dx + dz) & 1) === 0 ? STONE : MARBLE);
    }
    for (let wy = 1; wy <= eaveY - 1; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, onZ = Math.abs(dz) === halfZ;
      if (!onX && !onZ) continue;
      if (dz === halfZ && dx === 0 && wy <= 3) continue;
      const isPillar = (onX && onZ) || (onX && (dz % 3 === 0)) || (onZ && (dx % 2 === 0));
      const isWin = (wy >= 3 && wy <= 5) && !isPillar && ((onX && Math.abs(dz) % 3 !== 0) || (dz === -halfZ && Math.abs(dx) <= 2));
      put(dx, wy, dz, isWin ? B.GLASS : (isPillar ? B.DEEPSLATE_BRICKS : STONE));
    }
    vRoof(put, halfX, zE, eaveY, B.DEEPSLATE, STONE, B.DEEPSLATE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, MARBLE));
    // Tháp chuông cao phía trước-giữa với chóp đồng xanh cổ
    for (let wy = 1; wy <= 14; wy++) for (let dz = halfZ - 2; dz <= halfZ + 1; dz++) for (let dx = -2; dx <= 2; dx++) {
      const edge = (Math.abs(dx) === 2 || dz === halfZ - 2 || dz === halfZ + 1);
      if (!edge) continue;
      if (wy <= 3 && dx === 0 && dz === halfZ + 1) continue;
      const bellOpen = (wy >= 11 && wy <= 13) && (dx === 0 || dz === halfZ - 1);
      put(dx, wy, dz, bellOpen ? B.AIR : ((Math.abs(dx) === 2 && (dz === halfZ - 2 || dz === halfZ + 1)) ? MARBLE : STONE));
    }
    put(0, 12, halfZ - 1, B.LANTERN);
    for (let s = 0; s <= 3; s++) {
      const r = 2 - Math.floor(s * 0.7);
      for (let dz = halfZ - 2 + (2 - r); dz <= halfZ + 1 - (2 - r); dz++) {
        for (let dx = -r; dx <= r; dx++) put(dx, 15 + s, dz, B.COPPER_ROOF);
      }
    }
    put(0, 19, halfZ, B.LANTERN);
    // Nội thất bên trong thánh đường + tường rào đá & bụi lá trang trí xung quanh
    put(0, 1, halfZ + 1, B.OAK_DOOR); put(0, 2, halfZ + 1, B.AIR);
    put(0, 1, -halfZ + 2, B.ENCHANT_TABLE);
    put(-2, 1, -halfZ + 1, B.BOOKSHELF); put(2, 1, -halfZ + 1, B.BOOKSHELF);
    put(-3, 1, 0, B.OAK_STAIRS_N); put(-2, 1, 0, B.OAK_STAIRS_N);
    put(2, 1, 0, B.OAK_STAIRS_N); put(3, 1, 0, B.OAK_STAIRS_N);
    put(0, 6, 0, B.LANTERN); put(0, 6, -3, B.LANTERN);
    for (const sx of [-halfX - 2, halfX + 2]) for (let dz = -halfZ; dz <= halfZ; dz++) {
      const wx = hx + sx, wz = hz + dz * fz, gy = colGroundY(wx, wz);
      if (gy >= baseY - 1 && gy <= baseY + 2) {
        setBlockWorld(wx, gy + 1, wz, (dz & 1) ? B.STONE_BRICK_WALL : B.OAK_LEAVES, true);
      }
    }
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ + 1, baseY, 7);
    return baseY;
  }

  // ============ HOUSE 10 (small): CLASSIC MINECRAFT OAK & COBBLESTONE VILLAGE HOUSE — Nhà Gỗ Sồi Minecraft Cổ Điển ============
  function buildClassicOakVillageHouse(hx, hz, fz) {
    const halfX = 5, halfZ = 4, zE = 5, eaveY = 6;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 0, dz, (Math.abs(dx) === halfX || Math.abs(dz) === halfZ) ? B.STONE_BRICK : B.PLANKS);
    }
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      if (dz === halfZ && dx === 0 && wy <= 2) continue;
      const isCorner = (Math.abs(dx) === halfX && Math.abs(dz) === halfZ);
      const isWin = (wy === 2 || wy === 3) && ((dz === halfZ && Math.abs(dx) === 3) || (Math.abs(dx) === halfX && Math.abs(dz) <= 1));
      if (isWin) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, isCorner ? B.OAK_LOG : (wy === 1 ? B.STONE_BRICK : B.PLANKS));
    }
    vRoof(put, halfX, zE, eaveY, B.SPRUCE_LOG, B.OAK_LOG, B.OAK_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, B.PLANKS));
    vCeil(put, halfX, halfZ, eaveY - 1, B.OAK_LOG);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, B.PLANKS);
    vDoors(put, halfZ, B.OAK_DOOR, false, true);
    put(-3, 1, -2, B.BED); put(-2, 1, -2, B.BED_FOOT);
    put(3, 1, -2, B.FURNACE); put(3, 1, -1, B.CRAFT_TABLE); put(3, 1, 1, B.CHEST);
    put(0, 4, 0, B.LANTERN);
    vWheat(hx, hz, fz, halfX, halfZ, baseY, -1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 6);
    return baseY;
  }

  // ============ HOUSE 11 (medium): MEDIEVAL BAKERY & MARKET HOUSE — Tiệm Bánh & Chợ Trung Cổ ============
  function buildMedievalBakeryWindmill(hx, hz, fz) {
    const halfX = 6, halfZ = 5, zE = 6, eaveY = 9;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.OAK_LOG, WALL = B.END_STONE;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 0, dz, (Math.abs(dx) === halfX || Math.abs(dz) === halfZ) ? B.STONE_BRICK : B.PLANKS);
    }
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      if (dz === halfZ && dx === 0 && wy <= 2) continue;
      const isPost = (Math.abs(dx) === halfX && Math.abs(dz) === halfZ) || (dz === halfZ && Math.abs(dx) === 3) || wy === 4;
      const isWin = (wy === 2 || wy === 3) && ((dz === halfZ && (Math.abs(dx) === 4 || Math.abs(dx) === 2)) || (Math.abs(dx) === halfX && Math.abs(dz) === 2));
      put(dx, wy, dz, isWin ? B.GLASS : (isPost ? FR : (wy === 1 ? B.STONE_BRICK : B.PLANKS)));
    }
    vSlab(put, halfX, halfZ, 1);
    for (let wy = 6; wy <= 8; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && Math.abs(dx) === 3) || wy === 6 || wy === 8;
      const isWin = wy === 7 && ((isFront && Math.abs(dx) === 2) || (onX && Math.abs(dz) === 2));
      put(dx, wy, dz, isWin ? B.GLASS : (isPost ? FR : WALL));
    }
    vRoof(put, halfX, zE, eaveY, B.COPPER_ROOF, FR, B.TERRACOTTA_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) & 1) ? FR : WALL));
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, WALL);
    // Mái hiên sạp bánh sọc đỏ-trắng phía trước + đống rơm & lò nướng
    for (let dx = -5; dx <= -2; dx++) {
      put(dx, 3, halfZ + 1, (dx & 1) ? B.RED_WOOL : B.WHITE_WOOL);
      put(dx, 3, halfZ + 2, (dx & 1) ? B.RED_WOOL : B.WHITE_WOOL);
    }
    put(-5, 1, halfZ + 2, B.OAK_FENCE); put(-5, 2, halfZ + 2, B.OAK_FENCE);
    put(-2, 1, halfZ + 2, B.OAK_FENCE); put(-2, 2, halfZ + 2, B.OAK_FENCE);
    put(-4, 1, halfZ + 1, B.CHEST); put(-3, 1, halfZ + 1, B.SMOKER);
    put(4, 1, halfZ + 2, B.HAY_BALE); put(5, 1, halfZ + 2, B.HAY_BALE); put(4, 2, halfZ + 2, B.HAY_BALE);
    const chX = halfX - 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE + 1; wy++) put(chX, wy, chZ, B.TERRACOTTA);
    put(chX, eaveY + zE + 2, chZ, B.CAMPFIRE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9407, halfZ + 1);
    vDoors(put, halfZ, B.BIRCH_DOOR, true, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, false);
    vFurn2(put, halfX, halfZ, false, eaveY - 1);
    vWheat(hx, hz, fz, halfX, halfZ, baseY, 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 7);
    return baseY;
  }

  // ============ HOUSE 12 (large flagship): GRAND MEDIEVAL VOXEL MANOR — Biệt Thự Trung Cổ Siêu Chi Tiết ============
  function buildGrandMedievalVoxelHouse(hx, hz, fz) {
    const halfX = 8, halfZ = 7, zE = 8, eaveY = 11;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    for (let dz = -halfZ - 3; dz <= halfZ + 4; dz++) for (let dx = -halfX - 3; dx <= halfX + 3; dx++) {
      for (let wy = 1; wy <= 23; wy++) put(dx, wy, dz, B.AIR);
    }
    const FR = B.SPRUCE_LOG, CREAM = B.MARBLE_BRICK, PLASTER = B.WHITE_WOOL;
    const STONE = B.STONE_BRICK, DEEP = B.DEEPSLATE_BRICKS;

    // 1) Nền đá hộc chống ẩm + chân tường giật cấp (cellar plinth)
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const edge = (Math.abs(dx) === halfX || Math.abs(dz) === halfZ);
      put(dx, 0, dz, edge ? DEEP : (((dx + dz) & 3) === 0 ? B.SPRUCE_PLANKS : B.PLANKS));
      if (!edge && Math.abs(dx) <= 2 && Math.abs(dz) <= 2) put(dx, 0, dz, B.RED_WOOL);
    }
    for (const bx of [-halfX - 1, halfX + 1]) {
      for (const bz of [-halfZ, -2, 2, halfZ]) {
        put(bx, 1, bz, STONE); put(bx, 2, bz, B.STONE_BRICK_WALL);
      }
      for (let dz = -halfZ + 1; dz <= halfZ - 1; dz++) {
        if ((dz & 1) === 0) put(bx, 0, dz, B.STONE_STAIRS_N);
      }
    }
    for (const bz of [-halfZ - 1]) for (const bx of [-halfX, -3, 3, halfX]) {
      put(bx, 1, bz, STONE); put(bx, 2, bz, B.STONE_BRICK_WALL);
    }

    // 2) Tầng 1: Tường đá gạch + trụ cột gỗ thông lớn + cửa sổ có chớp (trapdoor) & bồn hoa
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      const onX = Math.abs(dx) === halfX, isFront = (dz === halfZ), isBack = (dz === -halfZ);
      if (isFront && Math.abs(dx) <= 0 && wy <= 2) continue;
      const isPost = (onX && (isFront || isBack)) ||
        (isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5 || Math.abs(dx) === 8)) ||
        (isBack && (Math.abs(dx) === 4 || Math.abs(dx) === 8)) ||
        (onX && (dz === -3 || dz === 0 || dz === 3)) || wy === 4;
      const isWin = (wy === 2 || wy === 3) && (
        (isFront && (Math.abs(dx) === 3 || Math.abs(dx) === 4 || Math.abs(dx) === 6 || Math.abs(dx) === 7)) ||
        (isBack && (Math.abs(dx) === 2 || Math.abs(dx) === 6)) ||
        (onX && (Math.abs(dz) === 1 || Math.abs(dz) === 2 || Math.abs(dz) === 5))
      );
      if (isWin) { put(dx, wy, dz, B.GLASS); continue; }
      const hM = hash3i(hx + dx, wy, hz + dz * fz, worldSeed + 9511);
      put(dx, wy, dz, isPost ? FR : (wy === 1 ? (hM > 0.78 ? B.MOSS_BLOCK : DEEP) : (hM > 0.65 ? DEEP : STONE)));
    }
    // Cửa chớp gỗ (shutters), bậu cửa slab & bồn hoa tầng 1
    for (const wx of [-7, -3, 3, 7]) {
      put(wx, 1, halfZ + 1, B.OAK_LEAVES);
      put(wx, 2, halfZ + 1, ((wx & 2) ? B.FLOWER_RED : B.FLOWER_LAVENDER));
    }
    for (const sx of [-5, -2, 2, 5]) {
      put(sx, 2, halfZ + 1, B.SPRUCE_TRAPDOOR); put(sx, 3, halfZ + 1, B.SPRUCE_TRAPDOOR);
    }

    // 3) Hiên cổng vòm trước nhà + bậc thang đá + lồng đèn trụ gỗ
    for (let dz = halfZ + 1; dz <= halfZ + 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      put(dx, 0, dz, STONE);
    }
    for (let dx = -2; dx <= 2; dx++) put(dx, 0, halfZ + 3, B.STONE_STAIRS_N);
    put(0, 1, halfZ, B.SPRUCE_DOOR); put(0, 2, halfZ, B.AIR); put(0, 3, halfZ, B.GLASS);
    for (const px of [-2, 2]) {
      put(px, 1, halfZ + 2, B.STONE_BRICK_WALL);
      put(px, 2, halfZ + 2, B.SPRUCE_FENCE);
      put(px, 3, halfZ + 2, B.SPRUCE_FENCE);
      put(px, 4, halfZ + 2, B.SPRUCE_SLAB_TOP);
    }
    for (let dx = -2; dx <= 2; dx++) put(dx, 4, halfZ + 1, B.SPRUCE_SLAB_TOP);
    put(-1, 4, halfZ + 2, B.SPRUCE_SLAB_TOP); put(0, 4, halfZ + 2, FR); put(1, 4, halfZ + 2, B.SPRUCE_SLAB_TOP);
    put(-1, 3, halfZ + 2, B.LANTERN); put(1, 3, halfZ + 2, B.LANTERN);
    put(-4, 1, halfZ + 2, B.HAY_BALE); put(4, 1, halfZ + 2, B.CHEST);

    // 4) Giàn hoa dây leo & kho củi bên hông Tây (dx = -halfX - 2 .. -halfX - 1)
    for (const [px, pz] of [[-halfX - 2, -2], [-halfX - 2, 2], [-halfX - 2, 5]]) {
      for (let wy = 1; wy <= 4; wy++) put(px, wy, pz, wy === 4 ? FR : B.SPRUCE_FENCE);
    }
    for (let dz = -2; dz <= 5; dz++) for (let dx = -halfX - 2; dx <= -halfX - 1; dx++) {
      put(dx, 5, dz, ((dx + dz) & 1) ? B.OAK_TRAPDOOR : B.OAK_LEAVES);
      if (dz === 5 && hash2i(hx + dx, hz + dz * fz, worldSeed + 9521) > 0.45) {
        put(dx, 4, dz, B.VINE); put(dx, 3, dz, B.VINE);
      }
    }
    put(-halfX - 1, 1, 0, B.OAK_LOG); put(-halfX - 1, 1, 1, B.OAK_LOG); put(-halfX - 1, 2, 0, B.OAK_LOG);
    put(-halfX - 2, 3, 2, B.LANTERN);

    // 5) Sàn tầng 2 nhô (+1 overhang) & đà console gỗ chịu lực
    vSlab(put, halfX, halfZ, 1);
    for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 5, halfZ + 1, (Math.abs(dx) % 3 === 0 || Math.abs(dx) === halfX) ? FR : B.SPRUCE_SLAB_TOP);
      if (Math.abs(dx) % 3 === 0) put(dx, 4, halfZ + 1, B.OAK_STAIRS_N);
    }

    // 6) Tầng 2 Tudor khung gỗ tối + tường vôi kem + Oriel Bay Window (trái) + Ban công lan can (phải)
    for (let wy = 6; wy <= 10; wy++) for (let dz = -halfZ; dz <= halfZ + 1; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = (Math.abs(dx) === halfX), isFront = (dz === halfZ + 1), isBack = (dz === -halfZ);
      if (!onX && !isFront && !isBack) continue;
      if (isFront && dx >= 3 && dx <= 5 && wy >= 7 && wy <= 8) continue; // cửa ra ban công
      const isPost = (onX && (isFront || isBack)) ||
        (isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5 || Math.abs(dx) === 8)) ||
        (isBack && (Math.abs(dx) === 4 || Math.abs(dx) === 8)) ||
        (onX && (dz === -3 || dz === 0 || dz === 4)) || wy === 6 || wy === 10;
      const isDiag = !isPost && (wy === 7 || wy === 9) && (Math.abs(dx) === 6 || Math.abs(dz) === 2 || Math.abs(dz) === 5);
      const isWin = (wy === 7 || wy === 8) && (
        (isFront && (dx === -1 || dx === 0 || dx === 1 || dx === -7)) ||
        (isBack && (Math.abs(dx) === 2 || Math.abs(dx) === 6)) ||
        (onX && (Math.abs(dz) === 1 || Math.abs(dz) === 2 || Math.abs(dz) === 5))
      );
      if (isWin) { put(dx, wy, dz, B.GLASS); continue; }
      put(dx, wy, dz, (isPost || isDiag) ? FR : (((dx + wy + dz) & 3) === 0 ? PLASTER : CREAM));
    }
    // Cửa sổ lồi mặt tiền (Oriel Bay Window tại dx = -5..-3, dz = halfZ + 2)
    for (let dx = -5; dx <= -3; dx++) {
      put(dx, 6, halfZ + 2, B.SPRUCE_SLAB_TOP);
      put(dx, 7, halfZ + 2, B.GLASS); put(dx, 8, halfZ + 2, B.GLASS);
      put(dx, 9, halfZ + 2, B.DEEPSLATE_STAIRS_N);
    }
    put(-6, 7, halfZ + 2, B.SPRUCE_TRAPDOOR); put(-6, 8, halfZ + 2, B.SPRUCE_TRAPDOOR);
    put(-2, 7, halfZ + 2, B.SPRUCE_TRAPDOOR); put(-2, 8, halfZ + 2, B.SPRUCE_TRAPDOOR);
    put(-4, 6, halfZ + 3, B.FLOWER_YELLOW); put(-3, 6, halfZ + 3, B.OAK_LEAVES);

    // Ban công tầng 2 bên phải (dx = 2..6, dz = halfZ + 2)
    for (let dx = 2; dx <= 6; dx++) {
      put(dx, 5, halfZ + 2, B.SPRUCE_SLAB_TOP);
      put(dx, 6, halfZ + 2, (dx === 2 || dx === 6) ? FR : B.SPRUCE_FENCE);
    }
    put(2, 7, halfZ + 2, B.LANTERN);
    put(4, 6, halfZ + 1, B.SPRUCE_DOOR); put(4, 7, halfZ + 1, B.AIR);

    // 7) Tháp canh & Thư viện góc Đông-Bắc tích hợp (5x5 cao 17 block, chóp đá phiến & đồng cổ!)
    const tx0 = halfX - 2, tx1 = halfX + 2, tz0 = -halfZ, tz1 = -halfZ + 4;
    for (let wy = 1; wy <= 12; wy++) for (let dz = tz0; dz <= tz1; dz++) for (let dx = tx0; dx <= tx1; dx++) {
      const edge = (dx === tx0 || dx === tx1 || dz === tz0 || dz === tz1);
      if (!edge) { if (wy === 5 || wy === 10) put(dx, wy, dz, B.PLANKS); continue; }
      const corner = (dx === tx0 || dx === tx1) && (dz === tz0 || dz === tz1);
      if (wy >= 11) {
        put(dx, wy, dz, corner ? FR : B.SPRUCE_FENCE);
      } else if ((wy === 3 || wy === 8) && (dx === halfX || dz === -halfZ + 2)) {
        put(dx, wy, dz, B.GLASS);
      } else {
        put(dx, wy, dz, corner ? FR : (wy <= 5 ? DEEP : CREAM));
      }
    }
    put(halfX, 11, -halfZ + 2, B.LANTERN);
    for (let s = 0; s <= 4; s++) {
      const rT = Math.max(0, 3 - Math.floor(s * 0.75));
      for (let dz = -rT; dz <= rT; dz++) for (let dx = -rT; dx <= rT; dx++) {
        if (rT >= 2 && Math.abs(dx) === rT && Math.abs(dz) === rT && s >= 1) continue;
        put(halfX + dx, 13 + s, -halfZ + 2 + dz, (s === 0 && (Math.abs(dx) === rT || Math.abs(dz) === rT)) ? FR : (s >= 2 ? B.COPPER_ROOF : B.DEEPSLATE_TILES));
      }
    }
    put(halfX, 18, -halfZ + 2, B.LANTERN);

    // 8) Mái ngói dốc sâu 2 tầng lớp + viền mái gỗ + chóp mái + gác mái dormer + ống khói đá cao
    vRoof(put, halfX, zE, eaveY, B.DEEPSLATE_TILES, FR, B.DEEPSLATE_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((Math.abs(zz) % 3 === 0) || (y % 4 === 0)) ? FR : CREAM));
    for (let dx = -halfX - 1; dx <= halfX + 1; dx++) {
      if ((dx & 3) === 0) put(dx, eaveY + zE + 1, 0, B.SPRUCE_FENCE);
    }
    vDormer(put, -1, 2, halfZ + 2, 7, eaveY, CREAM, FR, B.DEEPSLATE_STAIRS_N, B.COPPER_ROOF);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);

    // Ống khói đá cao có bậc giật cấp & khói lò
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE + 2; wy++) {
      put(chX, wy, chZ, (wy & 1) ? STONE : DEEP);
      if (wy <= 12) put(chX + 1, wy, chZ, DEEP);
    }
    put(chX, eaveY + zE + 3, chZ, B.STONE_BRICK_WALL);
    put(chX, eaveY + zE + 4, chZ, B.CAMPFIRE);

    // 9) Nội thất đầy đủ 2 tầng + lò sưởi phòng khách + thư viện + dây leo & sân vườn bao tường đá
    put(chX, 1, chZ + 1, B.CAMPFIRE); put(chX, 2, chZ + 1, B.AIR); put(chX, 3, chZ + 1, STONE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9547, halfZ + 1);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, false);
    vFurn2(put, halfX, halfZ, true, eaveY - 1);
    put(0, 6, 0, B.CANDLE); put(halfX - 3, 6, -halfZ + 2, B.ENCHANT_TABLE); put(halfX - 3, 6, -halfZ + 1, B.BOOKSHELF);
    put(halfX - 2, 1, 2, B.ANVIL); put(halfX - 2, 1, 1, B.IRON_CHEST);
    // Hàng rào đá & bụi hoa góc sân trước
    for (let dx = -halfX - 1; dx <= halfX + 1; dx++) {
      if (Math.abs(dx) <= 3) continue;
      const wzG = hz + (halfZ + 3) * fz, gyG = colGroundY(hx + dx, wzG);
      if (gyG >= baseY - 1 && gyG <= baseY + 2) {
        setBlockWorld(hx + dx, gyG + 1, wzG, ((dx % 4) === 0) ? B.OAK_LEAVES : (((dx & 1) === 0) ? B.STONE_BRICK_WALL : B.OAK_FENCE), true);
        if ((dx % 5) === 0) setBlockWorld(hx + dx, gyG + 2, wzG, B.LANTERN, true);
      }
    }
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 8);
    return baseY;
  }

  // ============ HOUSE 13 (medium): MEDIEVAL APOTHECARY & CONSERVATORY — Nhà Thảo Dược Trung Cổ ============
  function buildMedievalApothecaryHouse(hx, hz, fz) {
    const halfX = 6, halfZ = 5, zE = 6, eaveY = 10;
    const baseY = vBase(hx, hz, halfX, halfZ, fz);
    const put = vP(hx, hz, fz, baseY);
    const FR = B.SPRUCE_LOG, STONE = B.STONE_BRICK, CREAM = B.MARBLE_BRICK;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      put(dx, 0, dz, (Math.abs(dx) === halfX || Math.abs(dz) === halfZ) ? B.DEEPSLATE_BRICKS : B.PLANKS);
    }
    for (let wy = 1; wy <= 4; wy++) for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      if (Math.abs(dx) !== halfX && Math.abs(dz) !== halfZ) continue;
      if (dz === halfZ && dx === 0 && wy <= 2) continue;
      const isPost = (Math.abs(dx) === halfX && Math.abs(dz) === halfZ) || (dz === halfZ && Math.abs(dx) === 3) || wy === 4;
      const isWin = (wy === 2 || wy === 3) && ((dz === halfZ && Math.abs(dx) === 4) || (Math.abs(dx) === halfX && Math.abs(dz) === 2));
      put(dx, wy, dz, isWin ? B.GLASS : (isPost ? FR : STONE));
    }
    vSlab(put, halfX, halfZ, 1);
    for (let wy = 6; wy <= 9; wy++) for (let dz = -halfZ; dz <= halfZ + 1; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const onX = Math.abs(dx) === halfX, isFront = dz === halfZ + 1;
      if (!onX && !isFront && dz !== -halfZ) continue;
      const isPost = (onX && (isFront || dz === -halfZ)) || (isFront && (Math.abs(dx) === 2 || Math.abs(dx) === 5)) || wy === 6 || wy === 9;
      const isWin = (wy === 7 || wy === 8) && ((isFront && Math.abs(dx) <= 1) || (onX && Math.abs(dz) === 2));
      put(dx, wy, dz, isWin ? B.GLASS : (isPost ? FR : CREAM));
    }
    put(-2, 7, halfZ + 2, B.SPRUCE_TRAPDOOR); put(2, 7, halfZ + 2, B.SPRUCE_TRAPDOOR);
    vRoof(put, halfX, zE, eaveY, B.TERRACOTTA, FR, B.TERRACOTTA_STAIRS_N,
      (gx, y, zz) => put(gx, y, zz, ((y + zz) % 3 === 0) ? FR : CREAM));
    vDormer(put, 0, 2, halfZ + 1, 6, eaveY, CREAM, FR, B.TERRACOTTA_STAIRS_N, B.TERRACOTTA);
    vCeil(put, halfX, halfZ, eaveY - 1, FR);
    vSeal(put, hx, hz, fz, baseY, halfX, halfZ, eaveY - 1, eaveY, zE, CREAM);
    // Nhà kính thảo dược bên hông Đông (dx = halfX+1 .. halfX+3, dz = -2..2)
    for (let dz = -2; dz <= 2; dz++) for (let dx = halfX + 1; dx <= halfX + 3; dx++) {
      put(dx, 0, dz, B.MOSS_BLOCK);
      const edge = (dx === halfX + 3 || Math.abs(dz) === 2);
      for (let wy = 1; wy <= 3; wy++) put(dx, wy, dz, (edge && wy === 1) ? STONE : (edge ? B.GLASS : B.AIR));
      put(dx, 4, dz, B.GLASS);
      if (!edge) put(dx, 1, dz, ((dx + dz) & 1) ? B.FLOWER_LAVENDER : B.BERRY_BUSH);
    }
    put(halfX + 2, 3, 0, B.LANTERN);
    const chX = -halfX + 1, chZ = -halfZ + 1;
    for (let wy = 1; wy <= eaveY + zE + 1; wy++) put(chX, wy, chZ, STONE);
    put(chX, eaveY + zE + 2, chZ, B.CAMPFIRE);
    vVines(put, halfX, zE, eaveY, hx, hz, fz, B.OAK_LEAVES, 9577, halfZ + 1);
    vDoors(put, halfZ, B.SPRUCE_DOOR, false, true);
    vStairs(put, halfX, halfZ);
    vFurn1(put, halfX, halfZ, true, false);
    vFurn2(put, halfX, halfZ, true, eaveY - 1);
    vFlowers(hx, hz, fz, halfX, halfZ, baseY);
    vPath(hx, hz, fz, halfZ, baseY, 7);
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
    const stampCitadelTree = (tx, tz, baseY, kind = 0) => {
      if (tx + 3 < wx0 || tx - 3 >= wx0 + 16 || tz + 3 < wz0 || tz - 3 >= wz0 + 16) return;
      const logB = (kind === 1) ? B.SPRUCE_LOG : ((kind === 2) ? B.BIRCH_LOG : ((kind === 3) ? B.SAKURA_LOG : B.OAK_LOG));
      const leafB = (kind === 1) ? B.SPRUCE_LEAVES : ((kind === 2) ? B.BIRCH_LEAVES : ((kind === 3) ? B.SAKURA_LEAVES : B.OAK_LEAVES));
      const th = (kind === 1) ? 7 : 5;
      for (let y = 1; y <= th; y++) putL(tx, baseY + y, tz, logB);
      if (kind === 1) {
        for (let dy = 2; dy <= th + 2; dy++) {
          const r = dy >= th + 1 ? 1 : (dy >= th - 1 ? 2 : (dy === 2 ? 1 : 2));
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) === r && Math.abs(dz) === r && (dy & 1) === 0) continue;
            if (dx === 0 && dz === 0 && dy <= th) continue;
            putL(tx + dx, baseY + dy, tz + dz, leafB);
          }
        }
        putL(tx, baseY + th + 3, tz, leafB);
      } else {
        for (let dy = th - 1; dy <= th + 2; dy++) {
          const r = (dy === th + 2) ? 1 : 2;
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy !== th) continue;
            if (dx === 0 && dz === 0 && dy <= th) continue;
            putL(tx + dx, baseY + dy, tz + dz, leafB);
          }
        }
      }
    };
    const stampMiniMedievalBuilding = (ox, oz, baseY, w, d, style = 0) => {
      // style: 0=half-timber slate, 1=terracotta tavern/cottage, 2=classic oak, 3=stone blacksmith, 4=chapel tower, 5=watchtower
      if (ox + w + 1 < wx0 || ox - 1 >= wx0 + 16 || oz + d + 1 < wz0 || oz - 1 >= wz0 + 16) return;
      const xMin = Math.max(wx0, ox), xMax = Math.min(wx0 + 15, ox + w - 1);
      const zMin = Math.max(wz0, oz), zMax = Math.min(wz0 + 15, oz + d - 1);
      const frameB = (style === 2) ? B.OAK_LOG : B.SPRUCE_LOG;
      const lowerB = (style === 0 || style === 3 || style === 4 || style === 5) ? B.STONE_BRICK : B.PLANKS;
      const upperB = (style === 0) ? B.MARBLE_BRICK : ((style === 1) ? B.END_STONE : ((style === 4) ? B.MARBLE_BRICK : B.PLANKS));
      const roofStair = (style === 1) ? B.TERRACOTTA_STAIRS_N : ((style === 2) ? B.OAK_STAIRS_N : ((style === 3) ? B.STONE_STAIRS_N : B.DEEPSLATE_STAIRS_N));
      const ridgeB = (style === 1) ? B.TERRACOTTA : ((style === 2) ? B.SPRUCE_LOG : ((style === 3) ? B.STONE_BRICK : B.DEEPSLATE));
      const twoStory = (style === 0 || style === 1);
      const hWall = (style === 5) ? 11 : ((style === 4) ? 7 : (twoStory ? 8 : 4));
      const doorX = ox + (w >> 1), doorZ = oz + d - 1;

      for (let wz = zMin; wz <= zMax; wz++) {
        const lz = wz - oz;
        for (let wx = xMin; wx <= xMax; wx++) {
          const lx = wx - ox;
          const onX = (lx === 0 || lx === w - 1), onZ = (lz === 0 || lz === d - 1);
          const onPerim = onX || onZ;
          putL(wx, baseY, wz, onPerim ? B.STONE_BRICK : B.PLANKS);
          for (let wy = 1; wy <= hWall; wy++) {
            if (!onPerim) {
              if (twoStory && wy === 4) putL(wx, baseY + wy, wz, B.PLANKS);
              continue;
            }
            if (style === 5) {
              const isWin = (wy === 4 || wy === 8) && ((lx === (w >> 1)) || (lz === (d >> 1)));
              if (wx === doorX && wz === doorZ && wy <= 2) {
                putL(wx, baseY + wy, wz, wy === 1 ? B.SPRUCE_DOOR : B.AIR);
              } else {
                putL(wx, baseY + wy, wz, isWin ? B.GLASS : ((onX && onZ) ? B.MARBLE_BRICK : B.STONE_BRICK));
              }
              continue;
            }
            if (wx === doorX && wz === doorZ && wy <= 2) {
              putL(wx, baseY + wy, wz, wy === 1 ? B.OAK_DOOR : B.AIR);
              continue;
            }
            const isCorner = (onX && onZ);
            const isBeam = (twoStory && wy === 4) || wy === hWall;
            const isWin = ((wy === 2 || (twoStory && wy === 6)) && !isCorner && ((onZ && (lx === 2 || lx === w - 3)) || (onX && (lz === 2 || lz === d - 3))));
            if (isWin) {
              putL(wx, baseY + wy, wz, B.GLASS);
              if (twoStory && wy === 6 && wz === doorZ) putL(wx, baseY + wy, doorZ + 1, B.SPRUCE_TRAPDOOR);
              continue;
            }
            if (isCorner || isBeam) { putL(wx, baseY + wy, wz, (style === 4 || style === 3) ? B.DEEPSLATE_BRICKS : frameB); continue; }
            putL(wx, baseY + wy, wz, (wy <= 3) ? lowerB : upperB);
          }
          if (twoStory && onZ && wz === doorZ) {
            putL(wx, baseY + 4, doorZ + 1, onX ? frameB : B.OAK_SLAB_TOP);
          }
        }
      }
      // Steep pitched roof (with 1-block overhang) or copper watchtower spire
      if (style === 5) {
        const rxMin = Math.max(wx0, ox - 1), rxMax = Math.min(wx0 + 15, ox + w);
        const rzMin = Math.max(wz0, oz - 1), rzMax = Math.min(wz0 + 15, oz + d);
        for (let wz = rzMin; wz <= rzMax; wz++) for (let wx = rxMin; wx <= rxMax; wx++) {
          const edge = (wx === ox - 1 || wx === ox + w || wz === oz - 1 || wz === oz + d);
          putL(wx, baseY + hWall + 1, wz, edge ? B.MARBLE_BRICK : B.STONE_BRICK);
          if (edge && ((wx + wz) & 1) === 0) putL(wx, baseY + hWall + 2, wz, B.STONE_BRICK_WALL);
        }
        const cxT = ox + (w >> 1), czT = oz + (d >> 1);
        for (let s = 0; s <= 4; s++) {
          const sr = Math.max(0, 2 - Math.floor(s * 0.6));
          for (let dz = -sr; dz <= sr; dz++) for (let dx = -sr; dx <= sr; dx++) {
            putL(cxT + dx, baseY + hWall + 2 + s, czT + dz, B.COPPER_ROOF);
          }
        }
        putL(cxT, baseY + hWall + 7, czT, B.LANTERN);
      } else {
        const halfZ = (d - 1) >> 1;
        const rxMin = Math.max(wx0, ox - 1), rxMax = Math.min(wx0 + 15, ox + w);
        for (let s = 0; s <= halfZ + 1; s++) {
          const ry = baseY + hWall + 1 + s;
          const zA = oz - 1 + s, zB = oz + d - s;
          for (let wx = rxMin; wx <= rxMax; wx++) {
            const isGableTrim = (wx === ox - 1 || wx === ox + w);
            if (zA >= zB) {
              if (zA === zB) putL(wx, ry, zA, ridgeB);
            } else {
              putL(wx, ry, zA, isGableTrim ? frameB : roofStair);
              putL(wx, ry, zB, isGableTrim ? frameB : (roofStair + 1));
            }
          }
          if (zA + 1 < zB) {
            for (let wz = Math.max(wz0, zA + 1); wz <= Math.min(wz0 + 15, zB - 1); wz++) {
              putL(ox, ry, wz, upperB);
              putL(ox + w - 1, ry, wz, upperB);
            }
          }
        }
      }
      // Warm interior & porch details + leaf planter boxes + vines
      putL(doorX, baseY + 3, doorZ + 1, B.LANTERN);
      putL(ox + 1, baseY + 1, oz + 1, B.BED); putL(ox + 2, baseY + 1, oz + 1, B.BED_FOOT);
      putL(ox + w - 2, baseY + 1, oz + 1, style === 3 ? B.ANVIL : B.CHEST);
      putL(ox + w - 2, baseY + 1, oz + 2, style === 3 ? B.BLAST_FURNACE : B.CRAFT_TABLE);
      if (style === 3) { putL(ox + 2, baseY + 1, oz + d - 2, B.FURNACE); }
      putL(doorX, baseY + 3, oz + (d >> 1), B.LANTERN);
      // Leaf window boxes, chimney stack, porch posts & hanging wall vines
      putL(doorX - 1, baseY + 1, doorZ + 1, B.OAK_FENCE); putL(doorX - 1, baseY + 2, doorZ + 1, B.OAK_FENCE);
      putL(doorX + 1, baseY + 1, doorZ + 1, B.OAK_FENCE); putL(doorX + 1, baseY + 2, doorZ + 1, B.OAK_FENCE);
      for (let px = doorX - 1; px <= doorX + 1; px++) putL(px, baseY + 3, doorZ + 1, B.SPRUCE_SLAB);
      if (twoStory) {
        const chTop = baseY + hWall + ((d - 1) >> 1) + 3;
        for (let wy = baseY + 1; wy <= chTop; wy++) putL(ox + 1, wy, oz + 1, (wy & 1) ? B.STONE_BRICK : B.DEEPSLATE_BRICKS);
        putL(ox + 1, chTop + 1, oz + 1, B.STONE_BRICK_WALL);
      }
      if (w >= 7) {
        putL(ox + 2, baseY + 1, doorZ + 1, B.OAK_LEAVES);
        putL(ox + w - 3, baseY + 1, doorZ + 1, B.OAK_LEAVES);
      }
      if (hWall >= 7) {
        putL(ox - 1, baseY + 4, oz + 1, B.VINE);
        putL(ox - 1, baseY + 3, oz + 1, B.VINE);
        putL(ox + w, baseY + 5, oz + d - 2, B.VINE);
      }
    };

    // 1) 1000x1000 Grand Walled Medieval Citadel centered at (12000, -12000)
    const CIT_X = 12000, CIT_Z = -12000, CIT_R = 500;
    if (wx0 + 15 >= CIT_X - CIT_R && wx0 <= CIT_X + CIT_R && wz0 + 15 >= CIT_Z - CIT_R && wz0 <= CIT_Z + CIT_R) {
      const baseY = 6;
      const FLW_CIT = [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_LAVENDER, B.OXEYE_DAISY];
      for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = wx0 + lx, wz = wz0 + lz;
        const dx = wx - CIT_X, dz = wz - CIT_Z, adx = Math.abs(dx), adz = Math.abs(dz);
        if (adx > CIT_R || adz > CIT_R) continue;
        colHeights[(lz << 4) | lx] = baseY;
        const onOuterWall = (adx >= CIT_R - 2 || adz >= CIT_R - 2);
        const onInnerRingWall = (adx === 128 || adz === 128) && (adx <= 128 && adz <= 128);
        const isOuterGate = (adx <= 4 && adz >= CIT_R - 2) || (adz <= 4 && adx >= CIT_R - 2);
        const isMainAve = (adx <= 4 || adz <= 4);
        const bx = ((dx % 32) + 32) % 32, bz = ((dz % 32) + 32) % 32;
        const isStreet = !isMainAve && (bx <= 2 || bx >= 30 || bz <= 2 || bz >= 30);
        const hGround = hash2i(wx, wz, worldSeed + 9103);

        let topSurf = B.GRASS;
        if (onOuterWall || onInnerRingWall) {
          topSurf = B.STONE_BRICK;
        } else if (isMainAve) {
          if (adx <= 1 || adz <= 1) topSurf = B.MARBLE_BRICK;
          else if (adx <= 3 || adz <= 3) topSurf = (hGround > 0.72) ? B.SMOOTH_STONE : B.STONE_BRICK;
          else topSurf = (hGround > 0.32) ? B.GRASS : B.DIRT;
        } else if (adx <= 24 && adz <= 24) {
          topSurf = (adx <= 10 && adz <= 9) ? B.MARBLE_BRICK : ((adx <= 2 || adz <= 2) ? B.STONE_BRICK : (hGround > 0.28 ? B.GRASS : B.DIRT));
        } else if (isStreet) {
          topSurf = (hGround > 0.78) ? B.GRAVEL : ((hGround > 0.58) ? B.DIRT : B.STONE_BRICK);
        } else {
          // Lush grass & dirt ground inside city blocks
          const patchN = fbm2D(wx * 0.14, wz * 0.14, 2, 0.5, 2.0, worldSeed + 9109);
          topSurf = (patchN > 0.66) ? B.DIRT : ((hGround > 0.90) ? B.MOSS_BLOCK : B.GRASS);
        }

        for (let wy = baseY - 2; wy <= baseY + 20; wy++) {
          putL(wx, wy, wz, wy < baseY ? (topSurf === B.GRASS ? B.DIRT : B.STONE_BRICK) : (wy === baseY ? topSurf : B.AIR));
        }

        if (onOuterWall && !isOuterGate) {
          for (let wy = 1; wy <= 10; wy++) putL(wx, baseY + wy, wz, (wy === 10 && ((wx + wz) & 1)) ? B.MARBLE_BRICK : ((wy % 4 === 0) ? B.DEEPSLATE_BRICKS : B.STONE_BRICK));
          if (adx === CIT_R - 2 || adz === CIT_R - 2) {
            if (((wx + wz) & 7) === 0) putL(wx, baseY + 11, wz, B.TORCH_BLOCK);
            if (hGround > 0.74) { putL(wx, baseY + 1, wz + (dz < 0 ? 1 : -1), B.OAK_LEAVES); }
          }
        } else if (isOuterGate && (adx === 4 || adz === 4)) {
          for (let wy = 1; wy <= 13; wy++) putL(wx, baseY + wy, wz, wy >= 12 ? B.COPPER_ROOF : B.MARBLE_BRICK);
          putL(wx, baseY + 6, wz, B.LANTERN);
        } else if (onInnerRingWall && adx > 4 && adz > 4 && (bx > 2 && bx < 30) && (bz > 2 && bz < 30)) {
          for (let wy = 1; wy <= 7; wy++) putL(wx, baseY + wy, wz, (wy === 7 && ((wx + wz) & 1)) ? B.STONE_BRICK_WALL : B.STONE_BRICK);
          if (((wx + wz) & 9) === 0) putL(wx, baseY + 8, wz, B.LANTERN);
        } else if (isMainAve && (adx === 4 || adz === 4) && adx > 20 !== adz > 20) {
          // Grand Boulevard low walls, leaf hedges, flowers & street lamps
          const along = (adx === 4) ? Math.abs(dz) : Math.abs(dx);
          if ((along % 12) === 0) {
            putL(wx, baseY + 1, wz, B.STONE_BRICK_WALL);
            putL(wx, baseY + 2, wz, B.OAK_FENCE);
            putL(wx, baseY + 3, wz, B.LANTERN);
          } else if ((along % 6) === 3) {
            putL(wx, baseY + 1, wz, B.OAK_LEAVES);
          } else if ((along % 4) === 1 && hGround > 0.35) {
            putL(wx, baseY + 1, wz, FLW_CIT[(wx ^ wz) & 3]);
          } else if ((along % 8) === 2) {
            putL(wx, baseY + 1, wz, B.STONE_BRICK_WALL);
          }
        } else if (!isMainAve && !isStreet && !(adx <= 45 && adz <= 45)) {
          // City block low perimeter walls, decorative leaves, wildflowers & tall grass
          const onYardEdge = (bx === 3 || bx === 29 || bz === 3 || bz === 29);
          const isYardGate = (bx >= 14 && bx <= 17) || (bz >= 14 && bz <= 17);
          if (onYardEdge && !isYardGate) {
            putL(wx, baseY + 1, wz, ((bx + bz) % 5 === 0) ? B.OAK_LEAVES : B.STONE_WALL);
            if ((bx === 3 || bx === 29) && (bz === 3 || bz === 29)) {
              putL(wx, baseY + 2, wz, B.LANTERN);
            }
          } else if (topSurf === B.GRASS) {
            if (hGround > 0.94) putL(wx, baseY + 1, wz, FLW_CIT[(wx + wz) & 3]);
            else if (hGround > 0.89) putL(wx, baseY + 1, wz, B.OAK_LEAVES);
            else if (hGround > 0.82) putL(wx, baseY + 1, wz, B.FERN);
            else if (hGround > 0.72) putL(wx, baseY + 1, wz, B.TALL_GRASS);
          }
        }
      }

      // Boulevard Trees (planted just outside avenue verges every 24 blocks, avoiding intersections & central plaza)
      for (let d = 56; d <= CIT_R - 16; d += 24) {
        const kT = (d / 24) & 3;
        for (const sgn of [-1, 1]) {
          stampCitadelTree(CIT_X + sgn * 6, CIT_Z + d, baseY, kT);
          stampCitadelTree(CIT_X + sgn * 6, CIT_Z - d, baseY, (kT + 1) & 3);
          stampCitadelTree(CIT_X + d, CIT_Z + sgn * 6, baseY, (kT + 2) & 3);
          stampCitadelTree(CIT_X - d, CIT_Z + sgn * 6, baseY, (kT + 3) & 3);
        }
      }

      // Central Royal Keep fallback (adx <= 24 && adz <= 24) + 4 Corner Cottages at +-50 when walking into Citadel naturally
      if (wx0 + 15 >= CIT_X - 24 && wx0 <= CIT_X + 24 && wz0 + 15 >= CIT_Z - 24 && wz0 <= CIT_Z + 24) {
        for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
          const wx = wx0 + lx, wz = wz0 + lz;
          const dx = wx - CIT_X, dz = wz - CIT_Z, adx = Math.abs(dx), adz = Math.abs(dz);
          if (adx > 24 || adz > 24) continue;
          const isKeepWall = (adx === 24 || adz === 24 || adx === 10 || adz === 10);
          if (isKeepWall && !((adx <= 2 && adz === 24) || (adz <= 2 && adx === 24) || (adx <= 1 && adz === 10) || (adz <= 1 && adx === 10))) {
            const kH = (adx <= 10 && adz <= 10) ? 16 : 9;
            for (let wy = 1; wy <= kH; wy++) {
              putL(wx, baseY + wy, wz, (wy === kH) ? B.COPPER_ROOF : ((wy % 4 === 0) ? B.STONE_BRICK : B.MARBLE_BRICK));
            }
          }
        }
        for (const [sx, sz] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
          stampMiniMedievalBuilding(CIT_X + sx - 2, CIT_Z + sz - 2, baseY, 5, 5, 5);
        }
      }
      for (const [cxo, czo, cst] of [[-58, -58, 0], [48, -58, 2], [-58, 48, 1], [48, 48, 3]]) {
        stampMiniMedievalBuilding(CIT_X + cxo, CIT_Z + czo, baseY, 10, 9, cst);
      }
      for (const [txo, tzo, tko] of [[-52, -44, 0], [52, -44, 2], [-52, 44, 1], [52, 44, 3]]) {
        stampCitadelTree(CIT_X + txo, CIT_Z + tzo, baseY, tko);
      }

      // Dense 32x32 Medieval City Districts across the entire 1000x1000 Đại Thành
      const minCellX = Math.floor((wx0 - CIT_X - 4) / 32), maxCellX = Math.floor((wx0 + 19 - CIT_X) / 32);
      const minCellZ = Math.floor((wz0 - CIT_Z - 4) / 32), maxCellZ = Math.floor((wz0 + 19 - CIT_Z) / 32);
      for (let czCell = minCellZ; czCell <= maxCellZ; czCell++) {
        for (let cxCell = minCellX; cxCell <= maxCellX; cxCell++) {
          if (cxCell >= -2 && cxCell <= 1 && czCell >= -2 && czCell <= 1) continue;
          const ox = CIT_X + cxCell * 32, oz = CIT_Z + czCell * 32;
          if (Math.abs(ox + 16 - CIT_X) >= CIT_R - 10 || Math.abs(oz + 16 - CIT_Z) >= CIT_R - 10) continue;
          const arch = Math.floor(hash2i(cxCell, czCell, worldSeed + 9111) * 6);
          if (arch === 0) {
            // 2-3 Medieval Timber Townhouses + courtyard garden & oak tree
            stampMiniMedievalBuilding(ox + 4, oz + 5, baseY, 10, 9, 0);
            stampMiniMedievalBuilding(ox + 18, oz + 5, baseY, 10, 9, 2);
            stampMiniMedievalBuilding(ox + 5, oz + 18, baseY, 10, 9, 1);
            stampCitadelTree(ox + 22, oz + 22, baseY, 0);
          } else if (arch === 1) {
            // Medieval Tavern + Striped Market Stalls + Cottage + Birch Tree
            stampMiniMedievalBuilding(ox + 4, oz + 4, baseY, 13, 10, 1);
            stampMiniMedievalBuilding(ox + 4, oz + 18, baseY, 10, 9, 0);
            for (const [sx, sz, colW] of [[ox + 20, oz + 6, B.RED_WOOL], [ox + 20, oz + 18, B.BLUE_WOOL]]) {
              for (let lz2 = 0; lz2 < 6; lz2++) for (let lx2 = 0; lx2 < 6; lx2++) {
                putL(sx + lx2, baseY + 3, sz + lz2, ((lx2 & 1) === 0) ? colW : B.WHITE_WOOL);
              }
              for (const [px, pz] of [[0,0],[5,0],[0,5],[5,5]]) {
                putL(sx + px, baseY + 1, sz + pz, B.OAK_FENCE);
                putL(sx + px, baseY + 2, sz + pz, B.OAK_FENCE);
              }
              putL(sx + 2, baseY + 1, sz + 2, B.CHEST);
              putL(sx + 3, baseY + 1, sz + 2, B.HAY_BALE);
              putL(sx + 2, baseY + 2, sz + 5, B.LANTERN);
            }
            stampCitadelTree(ox + 23, oz + 15, baseY, 2);
          } else if (arch === 2) {
            // Blacksmith Forge + Classic Minecraft Houses + Wheat Plot + Oak Tree
            stampMiniMedievalBuilding(ox + 4, oz + 5, baseY, 11, 9, 3);
            stampMiniMedievalBuilding(ox + 18, oz + 5, baseY, 10, 9, 2);
            stampMiniMedievalBuilding(ox + 17, oz + 18, baseY, 10, 9, 0);
            for (let lz2 = 18; lz2 <= 25; lz2++) for (let lx2 = 5; lx2 <= 12; lx2++) {
              putL(ox + lx2, baseY, oz + lz2, lx2 === 8 ? B.WATER : B.FARMLAND);
              if (lx2 !== 8) putL(ox + lx2, baseY + 1, oz + lz2, B.WHEAT_3);
            }
            stampCitadelTree(ox + 14, oz + 22, baseY, 0);
          } else if (arch === 3) {
            // Copper-Spire Watchtower + Timber Barracks + Stone House + Spruce Trees
            stampMiniMedievalBuilding(ox + 5, oz + 5, baseY, 7, 7, 5);
            stampMiniMedievalBuilding(ox + 15, oz + 5, baseY, 13, 9, 0);
            stampMiniMedievalBuilding(ox + 15, oz + 18, baseY, 12, 9, 3);
            putL(ox + 6, baseY + 1, oz + 19, B.HAY_BALE); putL(ox + 7, baseY + 1, oz + 19, B.HAY_BALE);
            putL(ox + 6, baseY + 2, oz + 19, B.HAY_BALE);
            stampCitadelTree(ox + 8, oz + 24, baseY, 1);
            stampCitadelTree(ox + 25, oz + 15, baseY, 0);
          } else if (arch === 4) {
            // Gothic Stone Chapel + Cottage + Lush Fountain Park & Sakura Accent Tree
            stampMiniMedievalBuilding(ox + 4, oz + 4, baseY, 11, 11, 4);
            stampMiniMedievalBuilding(ox + 18, oz + 4, baseY, 10, 9, 2);
            const fx = ox + 15, fz = oz + 22;
            for (let dz2 = -2; dz2 <= 2; dz2++) for (let dx2 = -2; dx2 <= 2; dx2++) {
              const edge = (Math.abs(dx2) === 2 || Math.abs(dz2) === 2);
              putL(fx + dx2, baseY, fz + dz2, edge ? B.STONE_BRICK : B.WATER);
              if (edge) putL(fx + dx2, baseY + 1, fz + dz2, B.STONE_BRICK_WALL);
            }
            putL(fx, baseY + 1, fz, B.MARBLE_BRICK); putL(fx, baseY + 2, fz, B.MARBLE_BRICK); putL(fx, baseY + 3, fz, B.LANTERN);
            stampCitadelTree(ox + 7, oz + 22, baseY, 3);
            stampCitadelTree(ox + 24, oz + 23, baseY, 0);
          } else {
            // Noble Manor + Market House + Lush Multi-Tree Orchard
            stampMiniMedievalBuilding(ox + 4, oz + 4, baseY, 13, 10, 0);
            stampMiniMedievalBuilding(ox + 18, oz + 18, baseY, 10, 9, 1);
            stampCitadelTree(ox + 23, oz + 8, baseY, 0);
            stampCitadelTree(ox + 7, oz + 21, baseY, 2);
            stampCitadelTree(ox + 13, oz + 25, baseY, 1);
          }
          if (((cxCell + czCell) & 1) === 0 && hash2i(cxCell, czCell, worldSeed + 9133) > 0.65) {
            putL(ox + 16, baseY + 1, oz + 16, B.GOLD_CHEST);
          }
        }
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
      if (getOceanMacro(mcx, mcz).isOcean) continue;
      const b = getBiomeAt(mcx, mcz);
      if (b === BIOMES.DEEP_OCEAN || b === BIOMES.ABYSS_TRENCH || b === BIOMES.ABANDONED_CITY || b === BIOMES.BEACH_PALM || b === BIOMES.TROPICAL_COAST) continue;
      if (getOceanMacro(mcx + 24, mcz).isOcean || getOceanMacro(mcx - 24, mcz).isOcean ||
          getOceanMacro(mcx, mcz + 24).isOcean || getOceanMacro(mcx, mcz - 24).isOcean) continue;
      if (getTerrainHeight(mcx + 24, mcz, getBiomeAt(mcx + 24, mcz)) <= WATER_LEVEL ||
          getTerrainHeight(mcx - 24, mcz, getBiomeAt(mcx - 24, mcz)) <= WATER_LEVEL ||
          getTerrainHeight(mcx, mcz + 24, getBiomeAt(mcx, mcz + 24)) <= WATER_LEVEL ||
          getTerrainHeight(mcx, mcz - 24, getBiomeAt(mcx, mcz - 24)) <= WATER_LEVEL) continue;
      const kind = Math.floor(hash2i(rx - 3, rz + 5, worldSeed + 7129) * 3); // 0=Castle, 1=Colossal Ruin, 2=Watchtower Keep
      const rawH = getTerrainHeight(mcx, mcz, b);
      if (rawH <= WATER_LEVEL) continue;
      const baseY = Math.max(WATER_LEVEL + 1, Math.min(34, rawH));
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
        if (Math.hypot(vcx, vcz) < 42 || isGrandCitadel(vcx, vcz)) continue;
        if (hash2i(vx, vz, worldSeed + 2551) <= 0.55) continue;
        if (vcx + 22 < wx0 || vcx - 22 >= wx0 + 16 || vcz + 22 < wz0 || vcz - 22 >= wz0 + 16) continue;
        if (getOceanMacro(vcx, vcz).isOcean) continue;
        if (getOceanMacro(vcx + 18, vcz).isOcean || getOceanMacro(vcx - 18, vcz).isOcean ||
            getOceanMacro(vcx, vcz + 18).isOcean || getOceanMacro(vcx, vcz - 18).isOcean) continue;
        const vBio = getBiomeAt(vcx, vcz);
        if (vBio !== BIOMES.PLAINS && vBio !== BIOMES.GREEN_PLAINS && vBio !== BIOMES.FLOWER_MEADOW && vBio !== BIOMES.LUSH_STEPPE) continue;
        if (getTerrainHeight(vcx + 18, vcz, getBiomeAt(vcx + 18, vcz)) <= WATER_LEVEL ||
            getTerrainHeight(vcx - 18, vcz, getBiomeAt(vcx - 18, vcz)) <= WATER_LEVEL ||
            getTerrainHeight(vcx, vcz + 18, getBiomeAt(vcx, vcz + 18)) <= WATER_LEVEL ||
            getTerrainHeight(vcx, vcz - 18, getBiomeAt(vcx, vcz - 18)) <= WATER_LEVEL) continue;
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
        // 3 varied pitched-roof medieval/classic Minecraft village houses + community chest + leaf hedges & trees
        const huts = [[vcx - 9, vcz - 8, 1, 0], [vcx + 4, vcz - 8, 1, 1], [vcx - 9, vcz + 4, -1, 2]];
        for (let hi = 0; hi < huts.length; hi++) {
          const [hx, hz, doorDir, hStyle] = huts[hi];
          const hy = Math.max(WATER_LEVEL + 2, Math.min(18, getTerrainHeight(hx + 3, hz + 3, vBio)));
          const rStair = hStyle === 1 ? B.TERRACOTTA_STAIRS_N : (hStyle === 2 ? B.DEEPSLATE_STAIRS_N : B.OAK_STAIRS_N);
          const ridgeB = hStyle === 1 ? B.TERRACOTTA : (hStyle === 2 ? B.DEEPSLATE : B.SPRUCE_LOG);
          const wallB = hStyle === 2 ? B.MARBLE_BRICK : B.PLANKS;
          const postB = hStyle === 0 ? B.OAK_LOG : B.SPRUCE_LOG;
          for (let dz = 0; dz <= 5; dz++) for (let dx = 0; dx <= 5; dx++) {
            for (let fy = hy - 2; fy < hy; fy++) putLocal(hx + dx, fy, hz + dz, B.STONE_BRICK);
            putLocal(hx + dx, hy, hz + dz, B.PLANKS);
            for (let ay = 1; ay <= 8; ay++) putLocal(hx + dx, hy + ay, hz + dz, B.AIR);
            const isC = (dx === 0 || dx === 5) && (dz === 0 || dz === 5);
            const isW = (dx === 0 || dx === 5 || dz === 0 || dz === 5);
            if (isW) {
              for (let wy = 1; wy <= 3; wy++) {
                if (isC) putLocal(hx + dx, hy + wy, hz + dz, postB);
                else if (dx === 2 && ((doorDir === 1 && dz === 5) || (doorDir === -1 && dz === 0)) && wy <= 2) {
                  putLocal(hx + dx, hy + wy, hz + dz, wy === 1 ? B.OAK_DOOR : B.AIR);
                } else if (wy === 2 && (dx === 2 || dz === 2)) {
                  putLocal(hx + dx, hy + wy, hz + dz, B.GLASS);
                } else putLocal(hx + dx, hy + wy, hz + dz, wy === 1 ? B.STONE_BRICK : wallB);
              }
            }
          }
          for (let s = 0; s <= 3; s++) {
            const zA = s - 1, zB = 6 - s;
            for (let dx = -1; dx <= 6; dx++) {
              const isEdge = (dx === -1 || dx === 6);
              if (zA >= zB) { if (zA === zB) putLocal(hx + dx, hy + 4 + s, hz + zA, ridgeB); }
              else {
                putLocal(hx + dx, hy + 4 + s, hz + zA, isEdge ? postB : rStair);
                putLocal(hx + dx, hy + 4 + s, hz + zB, isEdge ? postB : (rStair + 1));
              }
            }
            if (zA + 1 < zB) for (let iz = zA + 1; iz < zB; iz++) {
              putLocal(hx, hy + 4 + s, hz + iz, wallB);
              putLocal(hx + 5, hy + 4 + s, hz + iz, wallB);
            }
          }
          putLocal(hx + 1, hy + 1, hz + 1, B.BED); putLocal(hx + 2, hy + 1, hz + 1, B.BED_FOOT);
          if (hi === 0) putLocal(hx + 4, hy + 1, hz + 1, B.CHEST);
          if (hi === 1) { putLocal(hx + 4, hy + 1, hz + 1, B.ANVIL); putLocal(hx + 4, hy + 1, hz + 2, B.BLAST_FURNACE); }
          putLocal(hx + 4, hy + 1, hz + 4, B.CRAFT_TABLE);
          putLocal(hx + 2, hy + 3, hz + 2, B.LANTERN);
          putLocal(hx - 1, hy + 1, hz + 5, B.OAK_LEAVES);
          putLocal(hx + 6, hy + 1, hz + 5, B.FLOWER_RED);
        }
        // Decorative village oak tree & stone wall corner
        const txV = vcx + 7, tzV = vcz + 6;
        const tyV = Math.max(WATER_LEVEL + 2, Math.min(18, getTerrainHeight(txV, tzV, vBio)));
        for (let y = 1; y <= 5; y++) putLocal(txV, tyV + y, tzV, B.OAK_LOG);
        for (let dy = 4; dy <= 6; dy++) {
          const r = dy === 6 ? 1 : 2;
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dz === 0 && dy <= 5) continue;
            putLocal(txV + dx, tyV + dy, tzV + dz, B.OAK_LEAVES);
          }
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

  // --- Dispatcher: 13 thiết kế nhà đa dạng (bao gồm mẫu Biệt Thự Trung Cổ siêu chi tiết & Thảo Dược Quán) ---
  function buildTimberManor(hx, hz, facingZ = 1, size = 'medium') {
    const fz = facingZ >= 0 ? 1 : -1;
    const r = hash2i(hx, hz, 8888);
    if (size === 'large') {
      if (r < 0.25) return buildGrandMedievalVoxelHouse(hx, hz, fz);
      if (r < 0.48) return buildTudorManorNew(hx, hz, fz);
      if (r < 0.68) return buildRedRoofCottage(hx, hz, fz);
      if (r < 0.85) return buildMedievalTavern(hx, hz, fz);
      return buildMedievalChapelTower(hx, hz, fz);
    }
    if (size === 'small') {
      return (r < 0.55) ? buildClassicOakVillageHouse(hx, hz, fz) : buildBrickCottage(hx, hz, fz);
    }
    if (r < 0.18) return buildMedievalApothecaryHouse(hx, hz, fz);
    if (r < 0.36) return buildMedievalTimberHouse(hx, hz, fz);
    if (r < 0.54) return buildMedievalBlacksmith(hx, hz, fz);
    if (r < 0.72) return buildMedievalBakeryWindmill(hx, hz, fz);
    if (r < 0.86) return buildTimberCabin(hx, hz, fz);
    return buildLakesideCottage(hx, hz, fz);
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

  // ===================== GRAND CITADEL, CASTLE & SPRAWLING MEDIEVAL CITY =====================
  function buildGrandCastleCity(cx, cz) {
    const ccx = cx >> 4, ccz = cz >> 4;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (!chunks.has(chunkKey(ccx + dx, ccz + dz))) generateChunk(ccx + dx, ccz + dz);
    }
    const baseY = isGrandCitadel(cx, cz) ? 6 : Math.max(WATER_LEVEL + 2, colGroundY(cx, cz));
    // 0) Grade & beautify surrounding outer medieval district apron (radius 46) with grass, dirt paths, stone roads & walls!
    const OA = 46;
    for (let dz = -OA; dz <= OA; dz++) for (let dx = -OA; dx <= OA; dx++) {
      const adx = Math.abs(dx), adz = Math.abs(dz);
      if (adx <= 18 && adz <= 18) continue;
      const wx = cx + dx, wz = cz + dz, gy = colGroundY(wx, wz);
      for (let wy = 1; wy <= 22; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      const isRoad = (adx <= 2 || adz <= 2 || ((adx === 21 || adx === 22) && adz <= 38) || ((adz === 24 || adz === 25) && adx <= 38));
      const hP = hash2i(wx, wz, worldSeed + 9601);
      const surfB = isRoad
        ? ((hP > 0.78) ? B.GRAVEL : ((adx <= 1 || adz <= 1) ? B.MARBLE_BRICK : B.STONE_BRICK))
        : ((hP > 0.76) ? B.DIRT : ((hP > 0.88) ? B.MOSS_BLOCK : B.GRASS));
      for (let y = Math.min(gy, baseY - 2); y <= baseY; y++) {
        setBlockWorld(wx, y, wz, y === baseY ? surfB : (surfB === B.GRASS ? B.DIRT : B.STONE_BRICK), true);
      }
      if (!isRoad && (adx === 23 || adz === 26) && (adx <= 38 && adz <= 38) && adx > 4 && adz > 4) {
        if (((dx + dz) & 3) === 0) setBlockWorld(wx, baseY + 1, wz, B.OAK_LEAVES, true);
        else if ((dx + dz) % 5 === 0) setBlockWorld(wx, baseY + 1, wz, B.STONE_BRICK_WALL, true);
      } else if (!isRoad && surfB === B.GRASS && adx > 25 && adz > 27 && hP > 0.93) {
        setBlockWorld(wx, baseY + 1, wz, hP > 0.965 ? B.FLOWER_RED : (hP > 0.95 ? B.FLOWER_LAVENDER : B.TALL_GRASS), true);
      }
    }

    // 1) Level Grand Citadel Courtyard (37x37) + Lush Grass Lawns, Stone Walkways & Fortified Curtain Walls!
    const R = 18;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const wx = cx + dx, wz = cz + dz, gy = colGroundY(wx, wz);
      for (let wy = 1; wy <= 28; wy++) setBlockWorld(wx, baseY + wy, wz, B.AIR, true);
      const isWalk = (Math.abs(dx) <= 2 || Math.abs(dz) <= 2);
      const isPlaza = (Math.abs(dx) <= 9 && Math.abs(dz) <= 8);
      const hC = hash2i(wx, wz, worldSeed + 9619);
      const cSurf = isWalk ? B.STONE_BRICK : (isPlaza ? B.MARBLE_BRICK : (hC > 0.76 ? B.DIRT : B.GRASS));
      for (let y = Math.min(gy, baseY - 3); y <= baseY; y++) setBlockWorld(wx, y, wz, y === baseY ? cSurf : B.STONE_BRICK, true);
      const onWall = (Math.abs(dx) === R || Math.abs(dz) === R);
      const isGate = ((dz === R || dz === -R) && Math.abs(dx) <= 2) || ((dx === R || dx === -R) && Math.abs(dz) <= 2);
      if (onWall && !isGate) {
        for (let wy = 1; wy <= 6; wy++) setBlockWorld(wx, baseY + wy, wz, (wy === 6 && ((dx + dz) & 1) === 0) ? B.MARBLE_BRICK : B.STONE_BRICK, true);
        if ((dx + dz) % 6 === 0) setBlockWorld(wx, baseY + 7, wz, B.TORCH_BLOCK, true);
        else if (((dx + dz) & 1) === 1) setBlockWorld(wx, baseY + 7, wz, B.STONE_BRICK_WALL, true);
        if (hC > 0.65) {
          setBlockWorld(wx, baseY + 4, wz + (dz === R ? -1 : (dz === -R ? 1 : 0)), B.VINE, true);
          setBlockWorld(wx, baseY + 1, wz + (dz === R ? -1 : (dz === -R ? 1 : 0)), B.OAK_LEAVES, true);
        }
      } else if (isGate) {
        setBlockWorld(wx, baseY + 5, wz, B.STONE_BRICK, true);
        setBlockWorld(wx, baseY + 6, wz, B.MARBLE_BRICK, true);
        if (dx === 0 || dz === 0) setBlockWorld(wx, baseY + 7, wz, B.LANTERN, true);
      } else if (cSurf === B.GRASS && Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) {
        if (Math.abs(dx) === 3 || Math.abs(dz) === 3) {
          if (((dx + dz) & 3) === 0) setBlockWorld(wx, baseY + 1, wz, B.OAK_LEAVES, true);
          else if ((dx + dz) % 5 === 0) setBlockWorld(wx, baseY + 1, wz, B.FLOWER_RED, true);
        } else if (hC > 0.88) {
          setBlockWorld(wx, baseY + 1, wz, hC > 0.94 ? B.FLOWER_YELLOW : B.TALL_GRASS, true);
        }
      }
    }
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
    buildCastleSpire(cx - kw, cz - 2 - kd, baseY, 17, 2);
    buildCastleSpire(cx + kw, cz - 2 - kd, baseY, 19, 2);
    buildCastleSpire(cx, cz - 2, baseY + kh + kd + 1, 7, 1);

    // Royal Functional Interior
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

    // Royal Courtyard Fountain + 4 Courtyard Trees
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const edge = (Math.abs(dx) === 2 || Math.abs(dz) === 2);
      setBlockWorld(cx + dx, baseY, cz + 10 + dz, edge ? B.STONE_BRICK : B.WATER, true);
      if (edge) setBlockWorld(cx + dx, baseY + 1, cz + 10 + dz, B.STONE_BRICK_WALL, true);
    }
    setBlockWorld(cx, baseY + 1, cz + 10, B.MARBLE_BRICK, true);
    setBlockWorld(cx, baseY + 2, cz + 10, B.LANTERN, true);
    const plantCityTree = (tx, tz, logB = B.OAK_LOG, leafB = B.OAK_LEAVES) => {
      const gy = Math.max(baseY, colGroundY(tx, tz));
      for (let y = 1; y <= 5; y++) setBlockWorld(tx, gy + y, tz, logB, true);
      for (let dy = 4; dy <= 6; dy++) {
        const r = dy === 6 ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy !== 5) continue;
          if (dx === 0 && dz === 0 && dy <= 5) continue;
          setBlockWorld(tx + dx, gy + dy, tz + dz, leafB, true);
        }
      }
    };
    for (const [tx, tz, lb, fb] of [
      [-13, 12, B.OAK_LOG, B.OAK_LEAVES], [13, 12, B.BIRCH_LOG, B.BIRCH_LEAVES],
      [-13, -12, B.SAKURA_LOG, B.SAKURA_LEAVES], [13, -12, B.OAK_LOG, B.OAK_LEAVES]
    ]) plantCityTree(cx + tx, cz + tz, lb, fb);

    // 4) Surrounding Medieval City Quarter: Flagship Grand Medieval Manor + Apothecary + 6 Medieval Houses + Market Stalls + Trees!
    buildGrandMedievalVoxelHouse(cx - 33, cz + 13, 1);
    buildMedievalApothecaryHouse(cx + 32, cz + 13, 1);
    buildMedievalTavern(cx - 19, cz + 36, -1);
    buildMedievalChapelTower(cx + 18, cz + 36, -1);
    buildMedievalBakeryWindmill(cx - 33, cz - 12, 1);
    buildMedievalBlacksmith(cx + 33, cz - 12, 1);
    buildRedRoofCottage(cx - 29, cz - 32, 1);
    buildBrickCottage(cx + 29, cz - 32, 1);

    // Striped South-Gate Market Stalls + Boulevard Lanterns & Trees
    for (const [mx, mz, colW] of [[cx - 6, cz + 27, B.RED_WOOL], [cx + 6, cz + 27, B.BLUE_WOOL]]) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        setBlockWorld(mx + dx, baseY + 3, mz + dz, (dx & 1) ? colW : B.WHITE_WOOL, true);
      }
      for (const [px, pz] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {
        setBlockWorld(mx + px, baseY + 1, mz + pz, B.OAK_FENCE, true);
        setBlockWorld(mx + px, baseY + 2, mz + pz, B.OAK_FENCE, true);
      }
      setBlockWorld(mx, baseY + 1, mz, B.CHEST, true);
      setBlockWorld(mx + 1, baseY + 1, mz, B.HAY_BALE, true);
      setBlockWorld(mx, baseY + 2, mz + 2, B.LANTERN, true);
    }
    for (const [tx, tz, lb, fb] of [
      [-6, 35, B.OAK_LOG, B.OAK_LEAVES], [6, 35, B.BIRCH_LOG, B.BIRCH_LEAVES],
      [-12, 27, B.OAK_LOG, B.OAK_LEAVES], [12, 27, B.SAKURA_LOG, B.SAKURA_LEAVES],
      [-43, 27, B.OAK_LOG, B.OAK_LEAVES], [43, 27, B.SPRUCE_LOG, B.SPRUCE_LEAVES],
      [-44, -22, B.SPRUCE_LOG, B.SPRUCE_LEAVES], [44, -22, B.OAK_LOG, B.OAK_LEAVES],
      [-10, -27, B.SAKURA_LOG, B.SAKURA_LEAVES], [10, -27, B.OAK_LOG, B.OAK_LEAVES]
    ]) plantCityTree(cx + tx, cz + tz, lb, fb);

    // Populate Castle City with Villagers, Iron Golems, Horses & Peacocks!
    for (const [vx, vz] of [[-5, 9], [5, 9], [0, 14], [-9, 4], [9, 4], [0, 26], [-24, 15], [24, 15]]) {
      spawnMobOfType('villager', cx + vx + 0.5, baseY + 1.2, cz + vz + 0.5);
    }
    spawnMobOfType('iron_golem', cx - 3.5, baseY + 1.2, cz + 17.5);
    spawnMobOfType('iron_golem', cx + 3.5, baseY + 1.2, cz + 17.5);
    spawnMobOfType('wild_horse', cx - 12.5, baseY + 1.2, cz + 28.5);
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
  function _runBatchedBlocks(fn) {
    if (typeof beginBlockBatch === 'function') beginBlockBatch();
    try { return fn(); }
    finally { if (typeof endBlockBatch === 'function') endBlockBatch(); }
  }
  function _findBlockInBox(cx, cy, cz, rx, ryDown, ryUp, rz, targetId) {
    for (let dy = -ryDown; dy <= ryUp; dy++) {
      const y = cy + dy;
      if (y <= MIN_Y || y > MAX_Y) continue;
      for (let dz = -rz; dz <= rz; dz++) {
        for (let dx = -rx; dx <= rx; dx++) {
          if (getBlockWorld(cx + dx, y, cz + dz) === targetId) return { x: cx + dx, y, z: cz + dz };
        }
      }
    }
    return null;
  }
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
      let dUse = dists[i];
      let rx = Math.round(_ruinOriginX + Math.cos(ang) * dUse);
      let rz = Math.round(_ruinOriginZ + Math.sin(ang) * dUse);
      if (typeof getOceanMacro === 'function' && getOceanMacro(rx, rz).isOcean) {
        for (let step = dUse - 24; step >= 24; step -= 24) {
          const tx = Math.round(_ruinOriginX + Math.cos(ang) * step);
          const tz = Math.round(_ruinOriginZ + Math.sin(ang) * step);
          if (!getOceanMacro(tx, tz).isOcean) { rx = tx; rz = tz; break; }
        }
      }
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
    if (_findBlockInBox(rn.x, baseY + 3, rn.z, 4, 2, 5, 2, B.DREAM_PORTAL)) return;
    const ctrB = getBlockWorld(rn.x, baseY, rn.z);
    if ((ctrB === B.STONE_BRICK || ctrB === B.MOSS_BLOCK) &&
        getBlockWorld(rn.x, baseY + 1, rn.z) === B.STONE_BRICK &&
        getBlockWorld(rn.x + 5, baseY + 1, rn.z + 5) === B.STONE_BRICK) return;
    _runBatchedBlocks(() => {
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
    });
    for (const _ch of chunks.values()) if (_ch.dirty) rebuildChunkMesh(_ch);
  }

  function startRisingDreamPortal(cx, baseY, cz, instant = false) {
    if (instant) {
      _runBatchedBlocks(() => {
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
          setBlockWorld(cx - 5, baseY + dy, cz, B.TERRACOTTA_RED, true);
          setBlockWorld(cx + 5, baseY + dy, cz, B.TERRACOTTA_RED, true);
        }
        setBlockWorld(cx - 5, baseY + 9, cz, B.SIFT_CYAN_CRYSTAL, true);
        setBlockWorld(cx + 5, baseY + 9, cz, B.SIFT_CYAN_CRYSTAL, true);
        setBlockWorld(cx - 4, baseY + 12, cz, B.SIFT_CYAN_CRYSTAL, true);
        setBlockWorld(cx + 4, baseY + 12, cz, B.SIFT_CYAN_CRYSTAL, true);
        setBlockWorld(cx, baseY + 12, cz, B.SIFT_CYAN_CRYSTAL, true);
      });
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
        const rcx0 = (rp.cx - 5) >> 4, rcx1 = (rp.cx + 5) >> 4, rcz = rp.cz >> 4;
        for (let c = rcx0; c <= rcx1; c++) if (!chunks.has(chunkKey(c, rcz))) generateChunk(c, rcz);
        _runBatchedBlocks(() => {
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
        });
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

    // Trigger Abandoned Ruin guardian encounter in Overworld (authority only)
    if (currentDimension !== 'overworld') return;
    if (typeof isDimSimAuthority === 'function' && !isDimSimAuthority('overworld')) return;
    const ruins = getDreamRuinLocations();
    for (const rn of ruins) {
      if (_awakenedRuins.has(rn.id)) continue;
      let dist = Math.hypot(player.x - rn.x, player.z - rn.z);
      if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof remotePlayers !== 'undefined' && remotePlayers) {
        for (const rp of remotePlayers.values()) {
          if (rp && !rp.isBuddy && (rp.dim || 'overworld') === 'overworld') {
            const rd = Math.hypot(rp.x - rn.x, rp.z - rn.z);
            if (rd < dist) dist = rd;
          }
        }
      }
      if (dist >= 36) continue;
      const rcx = rn.x >> 4, rcz = rn.z >> 4;
      if (!chunks.has(chunkKey(rcx, rcz))) generateChunk(rcx, rcz);
      const baseY = Math.max(WATER_LEVEL + 1, getTerrainHeight(rn.x, rn.z, getBiomeAt(rn.x, rn.z)));
      rn.y = baseY;
      if (_findBlockInBox(rn.x, baseY + 3, rn.z, 4, 2, 5, 2, B.DREAM_PORTAL)) {
        _awakenedRuins.add(rn.id);
        rn._stamped = true;
        continue;
      }
      if (!rn._stamped) { stampDreamRuinAltar(rn); rn._stamped = true; }
      if (!_activeRuinEncounters.has(rn.id) && dist < 24) {
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
    // Underground End Portal Strongholds: ALWAYS buried deep beneath solid dry land (NEVER in the middle of the ocean!)
    const grSurf = (typeof getGrandRuinsSurfaceY === 'function') ? getGrandRuinsSurfaceY(GRAND_RUINS_CX, GRAND_RUINS_CZ) : 24;
    const out = [{ x: GRAND_RUINS_CX, y: GRAND_RUINS_PORTAL_Y, z: GRAND_RUINS_CZ, surfY: grSurf, inGrandRuins: true }];
    const sp = (typeof getSpawnContinentAnchor === 'function') ? getSpawnContinentAnchor(s) : { x: 0, z: 0 };
    const isSolidLandStrongholdSpot = (tx, tz) => {
      if (typeof getOceanMacro === 'function') {
        if (getOceanMacro(tx, tz).isOcean) return null;
        if (getOceanMacro(tx + 24, tz).isOcean || getOceanMacro(tx - 24, tz).isOcean || getOceanMacro(tx, tz + 24).isOcean || getOceanMacro(tx, tz - 24).isOcean) return null;
      }
      const bio = (typeof getBiomeAt === 'function') ? getBiomeAt(tx, tz) : null;
      if (bio && (bio === BIOMES.DEEP_OCEAN || bio === BIOMES.ABYSS_TRENCH || bio === BIOMES.BEACH_PALM || bio === BIOMES.TROPICAL_COAST || bio === BIOMES.SWAMP || bio === BIOMES.MANGROVE_SWAMP)) return null;
      const surfH = (typeof getTerrainHeight === 'function' && bio) ? getTerrainHeight(tx, tz, bio) : 12;
      if (surfH < WATER_LEVEL + 4) return null;
      return surfH;
    };
    const baseAng = hash2i(s & 1023, (s >> 10) & 1023, s + 9137) * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const sectorAng = baseAng + i * (Math.PI * 2 / 3);
      let chosen = null;
      // Search concentric dry-land rings around spawn continent first so Strongholds are guaranteed underground on solid land
      for (let attempt = 0; attempt < 28 && !chosen; attempt++) {
        const angOff = ((attempt % 7) - 3) * 0.14 + (hash2i(i * 19 + attempt, s & 511, s + 3313) - 0.5) * 0.12;
        const rad = 240 + Math.floor(attempt / 7) * 75 + hash2i(i * 31 + attempt, (s >> 4) & 511, s + 7727) * 65;
        const cx = Math.round(sp.x + Math.cos(sectorAng + angOff) * rad);
        const cz = Math.round(sp.z + Math.sin(sectorAng + angOff) * rad);
        const surfH = isSolidLandStrongholdSpot(cx, cz);
        if (surfH !== null) {
          const buriedY = Math.max(MIN_Y + 10, Math.min(-18, Math.floor(surfH) - 26));
          chosen = { x: cx, y: buriedY, z: cz, surfY: Math.floor(surfH), inGrandRuins: false };
        }
      }
      if (!chosen) {
        // Safe land fallback inside spawn continent (guaranteed dry land!)
        const fbX = Math.round(sp.x + Math.cos(sectorAng) * 180);
        const fbZ = Math.round(sp.z + Math.sin(sectorAng) * 180);
        chosen = { x: fbX, y: -24, z: fbZ, surfY: 12, inGrandRuins: false };
      }
      out.push(chosen);
    }
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

          // 7) Underground Entry Stairwell Chamber above South Gatehouse — strictly buried beneath surfY - 4 so Strongholds NEVER poke into oceans or surface!
          if (inSouthWing && ax <= 2 && rz >= 12 && rz <= 16) {
            const maxShaftSy = Math.max(topRy + 1, Math.min(topRy + 6, ((typeof sh.surfY === 'number' ? sh.surfY : 10) - 4) - sh.y));
            for (let sy = topRy + 1; sy <= maxShaftSy; sy++) {
              const wy = baseY + sy;
              if (wy <= MIN_Y + 1 || wy >= MAX_Y - 2) continue;
              const isShaftWall = (ax === 2 || rz === 12 || rz === 16 || sy === maxShaftSy);
              if (isShaftWall) {
                put(lx, wy, lz, sy === maxShaftSy ? B.DEEPSLATE : ruinBrick(wx, sh.y + sy, wz));
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
      _runBatchedBlocks(() => {
        for (let u = 0; u < w; u++) {
          for (let v = 0; v < h; v++) {
            setBlockWorld(lx + dx * u, by + v, lz + dz * u, B.NETHER_PORTAL, true);
          }
        }
      });
      if (typeof _recordPortalPos === 'function' && (currentDimension === 'overworld' || currentDimension === 'nether')) {
        _recordPortalPos(currentDimension, lx, by, lz, B.NETHER_PORTAL, true);
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
        _runBatchedBlocks(() => {
          for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) {
            setBlockWorld(lx + dx * u, by + v, lz + dz * u, B.WARDEN_PORTAL, true);
          }
        });
        _recordPortalPos(currentDimension, lx, by, lz, B.WARDEN_PORTAL, true);
        spawnParticles(lx + dx * (w * 0.5) + 0.5, by + h * 0.5, lz + dz * (w * 0.5) + 0.5, 0x22d3ee, 32, true);
        playSfx('roar');
        showToast('🩵 CỔNG WARDEN CỔ ĐẠI ĐÃ MỞ! Bước vào để tiến tới Thế Giới Warden!');
        return true;
      }
    }
    return false;
  }

  function buildArrivalWardenPortal(cx, baseY, cz) {
    _runBatchedBlocks(() => {
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
    });
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
    if (typeof beginBlockBatch === 'function') beginBlockBatch();
    try {
      while (queue.length > 0 && seen.size < 48) {
        const [x, y, z] = queue.shift();
        setBlockWorld(x, y, z, B.AIR, true);
        for (const [dx, dy, dz] of dirs) pushIfPortal(x + dx, y + dy, z + dz);
      }
    } finally {
      if (typeof endBlockBatch === 'function') endBlockBatch();
    }
  }

  let dimensionPortals = { overworld: [], nether: [], sift: [], warden: [], dragon_realm: [] };
  let lastSiftOverworldPos = null;
  let _portalReturnLinks = { siftReturn: null, wardenReturn: null, dragonRealmReturn: null };
  function _getCanonicalPortalAnchor(sx, sy, sz, portalBlockId) {
    const ix = Math.floor(sx), iy = Math.floor(sy), iz = Math.floor(sz);
    let seed = null;
    const dirs = [[0,0,0],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
    for (let i = 0; i < dirs.length; i++) {
      const tx = ix + dirs[i][0], ty = iy + dirs[i][1], tz = iz + dirs[i][2];
      if (getBlockWorld(tx, ty, tz) === portalBlockId) { seed = [tx, ty, tz]; break; }
    }
    if (!seed) {
      const hit = _findBlockInBox(ix, iy, iz, 1, 1, 2, 1, portalBlockId);
      if (hit) seed = [hit.x, hit.y, hit.z];
    }
    if (!seed) return { x: ix, y: iy, z: iz, found: false };
    const seen = new Set([`${seed[0]},${seed[1]},${seed[2]}`]);
    const queue = [seed];
    let best = { x: seed[0], y: seed[1], z: seed[2] };
    while (queue.length > 0 && seen.size < 96) {
      const [cx, cy, cz] = queue.shift();
      if (cy < best.y || (cy === best.y && (cx < best.x || (cx === best.x && cz < best.z)))) {
        best = { x: cx, y: cy, z: cz };
      }
      for (let i = 1; i < dirs.length; i++) {
        const nx = cx + dirs[i][0], ny = cy + dirs[i][1], nz = cz + dirs[i][2];
        const k = `${nx},${ny},${nz}`;
        if (!seen.has(k) && getBlockWorld(nx, ny, nz) === portalBlockId) {
          seen.add(k);
          queue.push([nx, ny, nz]);
        }
      }
    }
    return { x: best.x, y: best.y, z: best.z, found: true };
  }
  function _recordPortalPos(dim, x, y, z, blockId = B.NETHER_PORTAL, broadcast = false) {
    const d = dim || 'overworld';
    const arr = dimensionPortals[d] || (dimensionPortals[d] = []);
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z), fb = Number(blockId) || 0;
    let matched = false;
    for (let i = 0; i < arr.length; i++) {
      if (Math.hypot(arr[i].x - fx, arr[i].z - fz) < 6 && (!arr[i].b || !fb || arr[i].b === fb)) {
        arr[i].x = fx; arr[i].y = fy; arr[i].z = fz;
        if (fb) arr[i].b = fb;
        matched = true;
        break;
      }
    }
    if (!matched) {
      arr.push({ x: fx, y: fy, z: fz, b: fb });
      if (arr.length > 32) arr.shift();
    }
    if (broadcast && typeof broadcastPortalLink === 'function') {
      broadcastPortalLink({ kind: 'portal', dim: d, x: fx, y: fy, z: fz, b: fb });
    }
  }
  function _findNearestPortal(dim, tx, tz, maxR, portalBlockId = B.NETHER_PORTAL) {
    const d = dim || 'overworld';
    const cands = [];
    const arr = dimensionPortals[d] || [];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p || (p.b && p.b !== portalBlockId)) continue;
      if (d === currentDimension && chunks.has(chunkKey(p.x >> 4, p.z >> 4))) {
        if (!_findBlockInBox(p.x, p.y, p.z, 2, 2, 2, 2, portalBlockId)) continue;
      }
      cands.push({ x: p.x, y: p.y, z: p.z });
    }
    if (typeof worldMods !== 'undefined' && worldMods && worldMods.size > 0) {
      const pref = (d === 'overworld') ? '' : (d + ':');
      const clusters = [];
      for (const [k, v] of worldMods.entries()) {
        if (v !== portalBlockId) continue;
        if (d === 'overworld') { if (k.indexOf(':') !== -1) continue; }
        else if (!k.startsWith(pref)) continue;
        const raw = pref ? k.slice(pref.length) : k;
        const parts = raw.split(',');
        if (parts.length !== 3) continue;
        const px = Number(parts[0]), py = Number(parts[1]), pz = Number(parts[2]);
        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) continue;
        if (Math.hypot(px - tx, pz - tz) > maxR) continue;
        let cl = null;
        for (let ci = 0; ci < clusters.length; ci++) {
          const c = clusters[ci];
          if (Math.abs(c.x - px) <= 4 && Math.abs(c.z - pz) <= 4 && Math.abs(c.y - py) <= 8) { cl = c; break; }
        }
        if (!cl) clusters.push({ x: px, y: py, z: pz });
        else if (py < cl.y || (py === cl.y && (px < cl.x || (px === cl.x && pz < cl.z)))) { cl.x = px; cl.y = py; cl.z = pz; }
      }
      for (let ci = 0; ci < clusters.length; ci++) {
        const cl = clusters[ci];
        if (!cands.some(c => Math.hypot(c.x - cl.x, c.z - cl.z) < 6 && Math.abs(c.y - cl.y) <= 8)) cands.push(cl);
      }
    }
    let best = null, bestD = maxR + 0.001;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      const dist = Math.hypot(c.x - tx, c.z - tz);
      if (dist <= maxR && (dist < bestD - 1e-6 || (Math.abs(dist - bestD) <= 1e-6 && best && (c.y < best.y || (c.y === best.y && (c.x < best.x || (c.x === best.x && c.z < best.z))))))) {
        bestD = dist;
        best = c;
      }
    }
    return best;
  }
  function exportPortalLinksState() {
    const portalsOut = {};
    for (const d of Object.keys(dimensionPortals)) portalsOut[d] = dimensionPortals[d].slice(-32);
    return {
      portals: portalsOut,
      siftReturn: lastSiftOverworldPos || _portalReturnLinks.siftReturn || null,
      wardenReturn: (typeof window !== 'undefined' && window.lastWardenOverworldPos) || _portalReturnLinks.wardenReturn || null,
      dragonRealmReturn: (typeof window !== 'undefined' && window.lastDragonRealmReturnPos) || _portalReturnLinks.dragonRealmReturn || null
    };
  }
  function applyRemotePortalLink(link) {
    if (!link || typeof link !== 'object') return;
    if (link.kind === 'portal') {
      if (Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.y)) && Number.isFinite(Number(link.z))) {
        _recordPortalPos(link.dim || 'overworld', link.x, link.y, link.z, link.b || B.NETHER_PORTAL, false);
      }
    } else if (link.kind === 'sift_return' && Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.z))) {
      const p = { x: Math.floor(link.x), y: Math.floor(link.y || 0), z: Math.floor(link.z) };
      _portalReturnLinks.siftReturn = p;
      lastSiftOverworldPos = { ...p };
    } else if (link.kind === 'warden_return' && Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.z))) {
      const p = { x: Math.floor(link.x), y: Math.floor(link.y || 0), z: Math.floor(link.z), depthOffset: Number(link.depthOffset) || 0 };
      _portalReturnLinks.wardenReturn = p;
      window.lastWardenOverworldPos = { ...p };
    } else if (link.kind === 'dragon_realm_return' && Number.isFinite(Number(link.x)) && Number.isFinite(Number(link.z))) {
      const p = { dim: String(link.dim || 'end'), x: Math.floor(link.x), y: Math.floor(link.y || 0), z: Math.floor(link.z), depthOffset: Number(link.depthOffset) || 0 };
      _portalReturnLinks.dragonRealmReturn = p;
      window.lastDragonRealmReturnPos = { ...p };
      window.lastDragonRealmPrevDim = p.dim;
    }
  }
  function applyPortalLinksState(pl) {
    if (!pl || typeof pl !== 'object') return;
    if (pl.portals && typeof pl.portals === 'object') {
      for (const d of Object.keys(pl.portals)) {
        if (!Array.isArray(pl.portals[d])) continue;
        for (const p of pl.portals[d]) {
          if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && Number.isFinite(Number(p.z))) {
            _recordPortalPos(d, p.x, p.y, p.z, p.b || B.NETHER_PORTAL, false);
          }
        }
      }
    }
    if (pl.siftReturn) applyRemotePortalLink({ kind: 'sift_return', ...pl.siftReturn });
    if (pl.wardenReturn) applyRemotePortalLink({ kind: 'warden_return', ...pl.wardenReturn });
    if (pl.dragonRealmReturn) applyRemotePortalLink({ kind: 'dragon_realm_return', ...pl.dragonRealmReturn });
  }

  function buildArrivalNetherPortal(px, py, pz) {
    // Build a 4x5 Obsidian frame (2x3 lit Nether Portal) with 5x5 solid safety platform even over lava/void
    _runBatchedBlocks(() => {
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
    });
  }

  function buildEndReturnPortal(px, py, pz) {
    for (let cz = (pz - 5) >> 4; cz <= (pz + 5) >> 4; cz++) {
      for (let cx = (px - 5) >> 4; cx <= (px + 5) >> 4; cx++) if (!chunks.has(chunkKey(cx, cz))) generateChunk(cx, cz);
    }
    // Classic Bedrock Exit Fountain: Bedrock rim + 3x3 B.END_PORTAL pool + central Bedrock column topped with ENDER_DRAGON_EGG!
    _runBatchedBlocks(() => {
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
    });
  }

  function buildEndGatewayPortal(px, py, pz) {
    for (let cz = (pz - 5) >> 4; cz <= (pz + 5) >> 4; cz++) {
      for (let cx = (px - 5) >> 4; cx <= (px + 5) >> 4; cx++) if (!chunks.has(chunkKey(cx, cz))) generateChunk(cx, cz);
    }
    // Ceremonial End Gateway Shrine + stepping Purpur stairs opening path to Outer End Cities & End Ships!
    const groundY = Math.max(7, getTerrainHeight(px - 5, pz, BIOMES.THE_END));
    _runBatchedBlocks(() => {
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
      for (let s = 1; s <= 5; s++) {
        const sy = Math.min(py, Math.max(groundY, py - (5 - s)));
        for (let gz = -1; gz <= 1; gz++) setBlockWorld(px - s, sy, pz + gz, s === 2 ? B.END_STONE_BRICKS : B.PURPUR_BLOCK, true, true);
      }
      setBlockWorld(px - 2, py + 1, pz - 1, B.END_ROD, true, true);
      setBlockWorld(px - 2, py + 1, pz + 1, B.END_ROD, true, true);
    });
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
    // Unbreakable Bedrock base & portal frame with End-Portal cosmic void interior
    _runBatchedBlocks(() => {
      for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) {
        setBlockWorld(px + dx, py, pz + dz, B.BEDROCK, true, true);
        for (let hy = 1; hy <= 7; hy++) setBlockWorld(px + dx, py + hy, pz + dz, B.AIR, true, true);
      }
      for (let dy = 1; dy <= 5; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const isFrame = (dx === -2 || dx === 2 || dy === 5);
          setBlockWorld(px + dx, py + dy, pz, isFrame ? B.BEDROCK : B.DRAGON_REALM_PORTAL, true, true);
        }
      }
      setBlockWorld(px - 2, py + 6, pz, B.END_ROD, true, true);
      setBlockWorld(px + 2, py + 6, pz, B.END_ROD, true, true);
      setBlockWorld(px, py + 6, pz, B.END_CRYSTAL_BLOCK, true, true);
    });
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
      _runBatchedBlocks(() => {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            setBlockWorld(cx + dx, fy, cz + dz, B.END_PORTAL, true);
          }
        }
      });
      spawnParticles(cx + 0.5, fy + 0.8, cz + 0.5, 0x34d399, 36, true);
      spawnParticles(cx + 0.5, fy + 1.0, cz + 0.5, 0x818cf8, 28, true);
      playSfx('roar');
      showToast('🌌 CỔNG KẾT THÚC (END PORTAL) ĐÃ MỞ! Nhảy vào cổng để đối đầu Rồng Ender!');
      return true;
    }
    return false;
  }

  const flyingEnderPearls = [];
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
    const diving = dist < 14;

    const grp = new THREE.Group();
    if (typeof buildUnified3DItemMesh === 'function') {
      const eyeMesh = buildUnified3DItemMesh(B.ENDER_EYE);
      eyeMesh.position.set(0, 0, 0);
      eyeMesh.rotation.set(0, 0, 0);
      eyeMesh.scale.setScalar(1.32);
      grp.add(eyeMesh);
    }
    const fwdX = -Math.sin(player.yaw || 0), fwdZ = -Math.cos(player.yaw || 0);
    const sx = player.x + fwdX * 1.15, sy = player.y + 1.38, sz = player.z + fwdZ * 1.15;
    grp.position.set(sx, sy, sz);
    scene.add(grp);

    const flyDist = Math.min(12.5, dist);
    const tx = diving ? sh.x + 0.5 : player.x + dirX * flyDist;
    const ty = diving ? (sh.inGrandRuins ? sh.y + 1.5 : Math.max(sh.y + 1, sy - 4.5)) : sy + 4.4;
    const tz = diving ? sh.z + 0.5 : player.z + dirZ * flyDist;
    const mx = sx + fwdX * 1.8 + dirX * 2.4;
    const my = sy + (diving ? 0.8 : 2.6);
    const mz = sz + fwdZ * 1.8 + dirZ * 2.4;

    flyingEnderEyes.push({
      mesh: grp, sx, sy, sz, mx, my, mz, tx, ty, tz,
      t: 0, dur: 2.35, sparkT: 0, diving
    });
    if (typeof spawnPixelFx === 'function') spawnPixelFx('ender_eye_trail', sx, sy, sz, { count: 2, scale: 0.72, life: 0.36, spread: 0.25 });
    if (typeof window !== 'undefined') window._lastEnderEyeThrow = { x: sh.x, y: sh.y, z: sh.z, dist: Math.round(dist), at: Date.now() };
    playSfx('equip');
    if (diving) {
      showToast(sh.inGrandRuins
        ? `👁️ Mắt Ender bay thẳng tới Đền Cổng The End (~${Math.round(dist)}m, y=${sh.y})!`
        : `👁️ Mắt Ender lao xuống đất! Pháo Đài (Cổng The End) ở ngay bên dưới (~${Math.round(dist)}m, y=${sh.y})!`);
    } else {
      showToast(`👁️ Mắt Ender đang bay về phía Cổng The End (~${Math.round(dist)}m)...`);
    }
    return true;
  }

  function updateFlyingEnderEyes(dt) {
    for (let i = flyingEnderEyes.length - 1; i >= 0; i--) {
      const e = flyingEnderEyes[i];
      e.t += dt;
      const p = Math.min(1, e.t / e.dur);
      const u = 1 - Math.pow(1 - p, 1.85);
      const inv = 1 - u;
      const cx = inv * inv * e.sx + 2 * inv * u * e.mx + u * u * e.tx;
      const cy = inv * inv * e.sy + 2 * inv * u * e.my + u * u * e.ty;
      const cz = inv * inv * e.sz + 2 * inv * u * e.mz + u * u * e.tz;
      e.mesh.position.set(cx, cy, cz);
      // Billboard softly toward camera with crisp floating bob so the 3D pixel Eye icon is always readable!
      e.mesh.rotation.y = Math.atan2(player.x - cx, player.z - cz);
      e.sparkT += dt;
      if (e.sparkT >= 0.055) {
        e.sparkT = 0;
        if (typeof spawnPixelFx === 'function') {
          spawnPixelFx('ender_eye_trail', cx, cy, cz, { count: 1, scale: 0.62, life: 0.42, riseV: 0.35, randV: 0.32, spread: 0.22 });
        }
      }
      if (e.t >= e.dur + 0.50) {
        scene.remove(e.mesh);
        flyingEnderEyes.splice(i, 1);
        if (Math.random() < 0.80) {
          spawnDroppedItem(Math.floor(cx), Math.floor(cy), Math.floor(cz), B.ENDER_EYE);
          if (typeof spawnPixelFx === 'function') spawnPixelFx('ender_warp', cx, cy, cz, { count: 2, scale: 0.95, life: 0.44, spread: 0.28 });
        } else {
          if (typeof spawnPixelFx === 'function') spawnPixelFx('ender_eye_shatter', cx, cy, cz, { count: 3, scale: 1.25, life: 0.52, randV: 1.4, spread: 0.35 });
          playSfx('break');
          showToast('💥 Mắt Ender đã vỡ tan thành bụi sao!');
        }
      }
    }
  }

  function throwEnderPearl(itemId, dirX, dirY, dirZ) {
    const bid = itemId || B.ENDER_PEARL;
    const grp = new THREE.Group();
    if (typeof buildUnified3DItemMesh === 'function') {
      const pMesh = buildUnified3DItemMesh(bid);
      pMesh.position.set(0, 0, 0);
      pMesh.rotation.set(0, 0, 0);
      pMesh.scale.setScalar(1.22);
      grp.add(pMesh);
    }
    const sx = player.x + dirX * 0.85, sy = player.y + 1.42 + dirY * 0.45, sz = player.z + dirZ * 0.85;
    grp.position.set(sx, sy, sz);
    scene.add(grp);
    const spd = (bid === B.VOID_PEARL) ? 26.0 : 23.0;
    flyingEnderPearls.push({
      mesh: grp, itemId: bid, x: sx, y: sy, z: sz,
      vx: dirX * spd, vy: dirY * spd + 2.2, vz: dirZ * spd,
      t: 0, sparkT: 0
    });
    if (typeof spawnPixelFx === 'function') spawnPixelFx('ender_trail', sx, sy, sz, { count: 2, scale: 0.65, life: 0.34, spread: 0.2 });
    playSfx('equip');
    return true;
  }

  function updateFlyingEnderPearls(dt) {
    for (let i = flyingEnderPearls.length - 1; i >= 0; i--) {
      const p = flyingEnderPearls[i];
      p.t += dt;
      const prevX = p.x, prevY = p.y, prevZ = p.z;
      p.vy -= 22.0 * dt;
      const steps = 3;
      let hit = false;
      for (let s = 1; s <= steps; s++) {
        const nx = prevX + p.vx * dt * (s / steps);
        const ny = prevY + p.vy * dt * (s / steps);
        const nz = prevZ + p.vz * dt * (s / steps);
        if (isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz)) || ny <= MIN_Y + 1) {
          hit = true;
          break;
        }
        p.x = nx; p.y = ny; p.z = nz;
      }
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y = Math.atan2(player.x - p.x, player.z - p.z);
      p.mesh.rotation.z += dt * 5.0;
      p.sparkT += dt;
      if (p.sparkT >= 0.045) {
        p.sparkT = 0;
        if (typeof spawnPixelFx === 'function') {
          spawnPixelFx('ender_trail', p.x, p.y, p.z, { count: 1, scale: 0.56, life: 0.36, riseV: 0.28, randV: 0.25, spread: 0.16 });
        }
      }
      if (hit || p.t >= 4.5) {
        scene.remove(p.mesh);
        flyingEnderPearls.splice(i, 1);
        if (hit && !player.dead) {
          if (typeof spawnPixelFx === 'function') spawnPixelFx('ender_warp', player.x, player.y + 1.0, player.z, { count: 2, scale: 1.1, life: 0.42, spread: 0.35 });
          let destY = Math.max(MIN_Y + 2, p.y);
          if (isSolidAt(Math.floor(p.x), Math.floor(destY), Math.floor(p.z))) destY = Math.floor(destY) + 1.05;
          player.x = p.x; player.y = destY; player.z = p.z;
          player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
          if (typeof spawnPixelFx === 'function') spawnPixelFx('ender_warp', player.x, player.y + 1.0, player.z, { count: 3, scale: 1.25, life: 0.48, spread: 0.45 });
          playSfx('warp');
          if (gameMode !== 'creative' && p.itemId === B.ENDER_PEARL) hurtPlayer(2.5, '✨ Va chạm dịch chuyển Ngọc Ender!', true, false);
        }
      }
    }
  }

  function teleportViaNetherPortal() {
    const fromOverworld = (currentDimension === 'overworld');
    const targetDim = fromOverworld ? 'nether' : 'overworld';
    const srcA = _getCanonicalPortalAnchor(player.x, player.y, player.z, B.NETHER_PORTAL);
    _recordPortalPos(currentDimension, srcA.x, srcA.y, srcA.z, B.NETHER_PORTAL, true);
    const rawX = fromOverworld ? Math.round(srcA.x / 8) : Math.round(srcA.x * 8);
    const rawZ = fromOverworld ? Math.round(srcA.z / 8) : Math.round(srcA.z * 8);
    const linked = _findNearestPortal(targetDim, rawX, rawZ, fromOverworld ? 16 : 128, B.NETHER_PORTAL);
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

  let _lastEyesInWater = false, _lastEyesInLava = false;
  function _clearWorldInteractiveCaches(alsoClearChunks = false, wipeWorldState = false) {
    if (wipeWorldState) { clearWorldModsAll(); chestStorageMap.clear(); incubatingEggs.clear(); spawnedDragonNests.clear(); plantedSaplings.clear(); saplingFertilizeCount.clear(); if (typeof resetDimMobPersistence === 'function') resetDimMobPersistence(); }
    else { worldModsByChunk.clear(); activeFires.clear(); }
    clearFluidState();
    exploredChunks.clear(); doorOpenState.clear(); torchAttachDir.clear(); dragonHeadYaw.clear(); windmillHubState.clear(); chestPairMap.clear(); furnaceStateMap.clear(); manualCraftGrid.fill(0);
    for (const v of interactiveVisuals.values()) scene.remove(v.group);
    interactiveVisuals.clear(); interactiveByChunk.clear(); endCrystalVisuals.clear(); animatedInteractiveVisuals.clear(); _hingesAnimating = false;
    activeChestKey = null; activeChestPartnerKey = null; activeFurnaceKey = null;
    if (wipeWorldState && player.ridingDragon) { player.ridingDragon = null; player.sitting = false; }
    if (typeof cancelFishingCast === 'function') cancelFishingCast(true);
    _playerCombatTarget = null; _playerCombatTargetT = 0; _dragonGrowthUiTimer = 0; _activeGrowthDragon = null;
    document.getElementById('dragonGrowthWrap')?.classList.remove('visible');
    document.getElementById('btnDragonMount')?.classList.remove('visible');
    document.getElementById('dragonFlightHud')?.classList.remove('visible');
    if (alsoClearChunks) {
      if (typeof farLodSystem !== 'undefined') farLodSystem.dispose();
      for (const ch of chunks.values()) { disposeChunkMeshes(ch, true); _freeChunkData(ch); }
      chunks.clear(); _invChunkCache(); emergeQueue.length = 0; emergeSet.clear();
      _dirtyChunkSet.clear(); _urgentChunkSet.clear(); _borderChunkSet.clear();
      _chunkUnloadQueue.length = 0; _chunkUnloadSet.clear();
      lastPlayerCx = 99999; lastPlayerCz = 99999;
      for (const m of mobs) disposeMobInstance(m); mobs.length = 0;
      if (wipeWorldState) {
        for (const it of droppedItems) { scene.remove(it.mesh); if (it.shadow) scene.remove(it.shadow); }
        droppedItems.length = 0;
        if (typeof clearClaimedDrops === 'function') clearClaimedDrops();
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
    const prevDim = currentDimension;
    if (prevDim && prevDim !== targetDim && typeof snapshotDimensionMobs === 'function') {
      snapshotDimensionMobs(prevDim);
    }
    currentDimension = targetDim;
    depthOffset = 0;
    player.inBoat = false;
    chunkWorkerPool.clear();
    window._worldWarmupUntil = performance.now() + 5500;
    window._rtVolDirty = true;
    _clearWorldInteractiveCaches(true, false);
    if (typeof rebuildCurrentDimModIndex === 'function') rebuildCurrentDimModIndex();
    if (typeof _restoreDimRoomDrops === 'function') _restoreDimRoomDrops();
    if (portalOpts && portalOpts.skipSpawnMove) return;

    const dimAuth = (typeof isDimSimAuthority === 'function') ? isDimSimAuthority(targetDim) : true;
    const _spawnArrivalMob = (tag, type, x, y, z, opts = null) => {
      if (typeof activeRoomId !== 'undefined' && activeRoomId && !dimAuth) return null;
      if (typeof isMobDefeatedTag === 'function' && isMobDefeatedTag(tag)) return null;
      if (mobs.some(mb => mb && !mb._dead && mb.spawnTag === tag)) return null;
      return spawnMobOfType(type, x, y, z, Object.assign({ spawnTag: tag }, opts || {}));
    };

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
      // v188: Central canyon portal landmark at (0,0) OR clean biome arrival + persistent per-visit mobs!
      const isSubBiomeTp = !!(portalOpts && typeof portalOpts.spawnX === 'number');
      const sx0 = isSubBiomeTp ? Math.floor(portalOpts.spawnX) : 0;
      const sz0 = isSubBiomeTp ? Math.floor(portalOpts.spawnZ) : 0;
      const targetBio = (portalOpts && portalOpts.targetBio) || BIOMES.SIFT_CANYON;
      const encKey = isSubBiomeTp ? ('sift:bio:' + targetBio.id) : 'sift:center';
      const scx = sx0 >> 4, scz = sz0 >> 4;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) generateChunk(scx + dx, scz + dz);
      const rawLy = getTerrainHeight(sx0, sz0, getBiomeAt(sx0, sz0));
      const ly = isSubBiomeTp ? Math.max(WATER_LEVEL + 2, rawLy) : Math.max(WATER_LEVEL + 5, rawLy + 2);
      if (!isSubBiomeTp) {
        // Signature Landmark: Giant glowing Dream Portal on grand stone steps in the middle of The Sift canyon (Refs 1, 2, 7)
        const hasSiftPortal = !!_findBlockInBox(sx0, ly + 4, sz0 - 10, 4, 3, 4, 2, B.DREAM_PORTAL);
        if (!hasSiftPortal) {
          _runBatchedBlocks(() => {
            for (let dz = -15; dz <= 6; dz++) for (let dx = -8; dx <= 8; dx++) {
              const edgeRim = (Math.abs(dx) === 8 || dz === 6 || dz === -15);
              const stepTier = (dz <= -8 && Math.abs(dx) <= 5) ? 2 : ((dz <= -5 && Math.abs(dx) <= 6) ? 1 : 0);
              const topY = ly + stepTier;
              for (let by = ly - 5; by <= topY; by++) {
                const bid = by === topY
                  ? (edgeRim ? B.SIFT_GRASS : (stepTier > 0 && Math.abs(dx) <= 4 ? B.HUSK_SOIL : B.SIFT_GRASS))
                  : (((by & 3) === 0) ? B.TERRACOTTA_RED : B.TERRACOTTA);
                setBlockWorld(sx0 + dx, by, sz0 + dz, bid, true);
              }
              for (let hy = 1; hy <= 15; hy++) setBlockWorld(sx0 + dx, topY + hy, sz0 + dz, B.AIR, true);
            }
            startRisingDreamPortal(sx0, ly + 2, sz0 - 10, true);
          });
        }
      } else {
        // Sub-biome teleport: preserve natural biome terrain/pillars/lakes; only ensure dry 5x5 footing!
        const pal = getSiftStructPalette(targetBio);
        _runBatchedBlocks(() => {
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            const curH = getTerrainHeight(sx0 + dx, sz0 + dz, getBiomeAt(sx0 + dx, sz0 + dz));
            if (curH < WATER_LEVEL + 1) setBlockWorld(sx0 + dx, ly, sz0 + dz, pal.grass, true);
            for (let hy = 1; hy <= 5; hy++) setBlockWorld(sx0 + dx, ly + hy, sz0 + dz, B.AIR, true);
          }
        });
      }
      const pcz = (sz0 - 10) >> 4;
      _portalCooldown = 4.5;
      _rebuildStandingOnly(scx, scz, scx, pcz);
      player.x = sx0 + 0.5; player.y = ly + 1.3; player.z = sz0 + (isSubBiomeTp ? 0.5 : 3.5); player.yaw = 0.0; player.pitch = 0.04;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      const restoredSift = (typeof restoreDimensionMobs === 'function') ? restoreDimensionMobs('sift') : false;
      const needSiftInit = (typeof hasDimVisited === 'function') ? !hasDimVisited(encKey) : !restoredSift;
      if (needSiftInit) {
        const packByBio = (targetBio === BIOMES.SIFT_MEADOW)
          ? ['blub', 'blub', 'blub', 'blub', 'blub', 'blub', 'wobble', 'wobble', 'trill', 'nuzzle']
          : (targetBio === BIOMES.SIFT_HUSKLAND)
          ? ['humbler', 'humbler', 'humbler', 'humbler', 'echo_golem', 'trill', 'wobble', 'ichor_ray', 'ichor_ray', 'blub']
          : (targetBio === BIOMES.SIFT_SPOREFIELDS)
          ? ['roamroot', 'roamroot', 'roamroot', 'roamroot', 'harmonizer', 'harmonizer', 'echo_golem', 'blub', 'wobble', 'trill']
          : (targetBio === BIOMES.SIFT_ICHOR_PONDS)
          ? ['humbler', 'humbler', 'humbler', 'harmonizer', 'harmonizer', 'nightmare_stalker', 'blub', 'blub', 'wobble', 'echo_golem']
          : (targetBio === BIOMES.SIFT_LULLABY || targetBio === BIOMES.SIFT_LULLABY_TOP)
          ? ['nuzzle', 'nuzzle', 'blub', 'blub', 'wobble', 'wobble', 'trill', 'trill', 'sky_manta', 'singer']
          : ['blub', 'blub', 'wobble', 'humbler', 'echo_golem', 'roamroot', 'singer', 'trill', 'sky_manta', 'harmonizer'];
        for (let mi = 0; mi < packByBio.length; mi++) {
          const ang = (mi / packByBio.length) * Math.PI * 2 + 0.3;
          const rad = 5.5 + (mi % 3) * 4.5;
          const mx = Math.floor(sx0 + Math.cos(ang) * rad), mz = Math.floor(sz0 + Math.sin(ang) * rad);
          const mType = packByBio[mi];
          const isFly = !!(MOB_STATS[mType] && (MOB_STATS[mType].skyBird || MOB_STATS[mType].flying));
          let my = Math.max(WATER_LEVEL + 1, getTerrainHeight(mx, mz, getBiomeAt(mx, mz))) + 1.25;
          if (isFly) my = Math.max(my + 3.0, ly + 4.0);
          else {
            for (let scanY = Math.min(MAX_Y - 3, ly + 12); scanY >= Math.max(WATER_LEVEL, ly - 10); scanY--) {
              const bF = getBlockWorld(mx, scanY, mz);
              if (IS_SOLID[bF] === 1 && getBlockWorld(mx, scanY + 1, mz) === B.AIR && getBlockWorld(mx, scanY + 2, mz) === B.AIR) { my = scanY + 1.15; break; }
            }
          }
          _spawnArrivalMob(`${encKey}:${mi}`, mType, mx + 0.5, my, mz + 0.5);
        }
      }
      if (typeof markDimVisited === 'function') { markDimVisited(encKey); markDimVisited('sift'); }
      mobSpawnTimer = restoredSift ? 4.5 : 1.0;
      playSfx('roar');
      showToast(reasonToast || "🌈 CHÀO MỪNG TỚI THE SIFT (KHU GIẤC MƠ)! Khám phá 6 quần xã, đảo bay & hồ 7 màu!");
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
        const restoredNeth = (typeof restoreDimensionMobs === 'function') ? restoreDimensionMobs('nether') : false;
        const heroKey = 'nether:castleHero';
        if (typeof hasDimVisited !== 'function' || !hasDimVisited(heroKey)) {
          _spawnArrivalMob(heroKey + ':wither_skeleton', 'wither_skeleton', 63.5, 9.2, -55.5);
          _spawnArrivalMob(heroKey + ':blaze', 'blaze', 72.5, 13.0, -64.5);
        }
        if (typeof markDimVisited === 'function') { markDimVisited(heroKey); markDimVisited('nether'); }
        mobSpawnTimer = restoredNeth ? 5.0 : 1.2;
        playSfx('roar');
        showToast(reasonToast || '🏰 Đã tới Lâu Đài Địa Ngục! Khám phá tòa thành tháp ngọc lam giữa biển dung nham!');
        cameraShake = 0.45;
        return;
      }
      let sx = 0, sz = 0, sy = 10, hasTargetCoords = false;
      if (portalOpts && portalOpts.portalCoords) {
        hasTargetCoords = true;
        sx = portalOpts.portalCoords.x;
        sz = portalOpts.portalCoords.z;
        sy = (typeof portalOpts.portalCoords.y === 'number' && Number.isFinite(portalOpts.portalCoords.y))
          ? portalOpts.portalCoords.y
          : Math.max(WATER_LEVEL + 3, Math.min(20, getTerrainHeight(sx, sz, getBiomeAt(sx, sz)) + 1));
      } else {
        const sharedNeth = _findNearestPortal('nether', 0, 0, 100000, B.NETHER_PORTAL);
        if (sharedNeth) {
          hasTargetCoords = true;
          sx = sharedNeth.x; sz = sharedNeth.z; sy = sharedNeth.y;
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
      }
      const scx = sx >> 4, scz = sz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      let lx = Math.floor(sx), lz = Math.floor(sz);
      let ly = (hasTargetCoords && portalOpts && portalOpts.portalCoords && typeof portalOpts.portalCoords.y === 'number' && Number.isFinite(portalOpts.portalCoords.y))
        ? (Math.floor(portalOpts.portalCoords.y) - 1)
        : Math.max(WATER_LEVEL + 2, Math.floor(sy) - 1);
      const existingNP = _findBlockInBox(lx, ly + 1, lz, 10, 6, 8, 10, B.NETHER_PORTAL);
      if (existingNP) {
        const anc = _getCanonicalPortalAnchor(existingNP.x, existingNP.y, existingNP.z, B.NETHER_PORTAL);
        lx = anc.x; lz = anc.z; ly = anc.y - 1;
        _runBatchedBlocks(() => {
          if (!isSolidAt(lx, ly, lz + 1)) setBlockWorld(lx, ly, lz + 1, B.OBSIDIAN, true);
          setBlockWorld(lx, ly + 1, lz + 1, B.AIR, true);
          setBlockWorld(lx, ly + 2, lz + 1, B.AIR, true);
        });
        _recordPortalPos('nether', lx, ly + 1, lz, B.NETHER_PORTAL, true);
        _portalCooldown = 4.5;
      } else if (hasTargetCoords) {
        buildArrivalNetherPortal(lx, ly + 1, lz);
        _recordPortalPos('nether', lx, ly + 1, lz, B.NETHER_PORTAL, true);
        _portalCooldown = 4.5;
      } else {
        _runBatchedBlocks(() => {
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            setBlockWorld(lx + dx, ly, lz + dz, B.CRIMSON_NYLIUM, true);
            for (let hy = 1; hy <= 4; hy++) setBlockWorld(lx + dx, ly + hy, lz + dz, B.AIR, true);
          }
          buildArrivalNetherPortal(lx, ly + 1, lz - 6);
        });
        lz = lz - 6;
        _recordPortalPos('nether', lx, ly + 1, lz, B.NETHER_PORTAL, true);
        _portalCooldown = 4.5;
      }
      _rebuildStandingOnly(lx >> 4, lz >> 4);
      player.x = lx + 0.5; player.y = ly + 1.2; player.z = lz + 1.55; player.yaw = 0.0; player.pitch = -0.05;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      const restoredNeth = (typeof restoreDimensionMobs === 'function') ? restoreDimensionMobs('nether') : false;
      if (!restoredNeth && (typeof hasDimVisited !== 'function' || !hasDimVisited('nether'))) {
        _spawnArrivalMob('nether:init:blaze', 'blaze', lx + 5.5, ly + 3.0, lz - 8.5);
        _spawnArrivalMob('nether:init:strider', 'strider', lx + 3.5, ly + 1.4, lz - 5.5);
        _spawnArrivalMob('nether:init:magma_cube', 'magma_cube', lx - 4.5, ly + 1.4, lz - 6.5);
      }
      if (typeof markDimVisited === 'function') markDimVisited('nether');
      mobSpawnTimer = restoredNeth ? 5.0 : 1.2;
      playSfx('roar');
      showToast(reasonToast || '🔥 ĐÃ XUỐNG ĐỊA NGỤC (THE NETHER)! Tiêu diệt Quỷ Lửa (Blaze) để lấy Que Lửa!');
    } else if (targetDim === 'end') {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(dx, dz);
      const landY = Math.max(8, getTerrainHeight(0, 18, BIOMES.THE_END));
      _runBatchedBlocks(() => {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          setBlockWorld(dx, landY, 18 + dz, B.END_STONE, true);
          for (let hy = 1; hy <= 4; hy++) setBlockWorld(dx, landY + hy, 18 + dz, B.AIR, true);
        }
      });
      _rebuildStandingOnly(0, 1, 0, 0);
      player.x = 0.5; player.y = landY + 1.2; player.z = 18.5; player.yaw = 0.0; player.pitch = 0.14;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      _endCrystalScanT = 0;
      const endBaseY = Math.max(8, getTerrainHeight(0, 0, BIOMES.THE_END));
      const endReturnExists = (getBlockWorld(0, endBaseY + 1, 0) === B.END_PORTAL);
      const restoredEnd = (typeof restoreDimensionMobs === 'function') ? restoreDimensionMobs('end') : false;
      if (!restoredEnd && (typeof hasDimVisited !== 'function' || !hasDimVisited('end'))) {
        // Spawn the Upgraded Boss Ender Dragon + End City Mobs only on first visit (or after crystal ritual)!
        if (!endReturnExists) {
          const _ed = _spawnArrivalMob('end:ender_dragon', 'ender_dragon', 0.5, landY + 15.0, -10.0, { homeX: 0.5, homeY: landY + 15.0, homeZ: 0.5, homeRadius: 34 });
          if (_ed) { _ed.homeX = 0.5; _ed.homeY = landY + 15.0; _ed.homeZ = 0.5; _ed.homeRadius = 34; }
        }
        _spawnArrivalMob('end:void_golem', 'void_golem', 9.5, getTerrainHeight(9, 2, BIOMES.THE_END) + 1.1, 2.5);
        _spawnArrivalMob('end:chorus_crawler', 'chorus_crawler', -8.5, getTerrainHeight(-8, 4, BIOMES.THE_END) + 1.1, 4.5);
      }
      if (typeof isMobDefeatedTag === 'function' && isMobDefeatedTag('end:ender_dragon') && typeof buildEndReturnPortal === 'function' && !endReturnExists) {
        buildEndReturnPortal(0, endBaseY + 1, 0);
      }
      if (typeof markDimVisited === 'function') markDimVisited('end');
      mobSpawnTimer = restoredEnd ? 5.5 : 1.5;
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (targetDim === 'warden') {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(dx, dz);
      const ly = Math.max(WATER_LEVEL + 3, getTerrainHeight(0, 0, BIOMES.WARDEN_CITADEL));
      if (!_findBlockInBox(0, ly + 3, -10, 4, 3, 4, 2, B.WARDEN_PORTAL)) {
        _runBatchedBlocks(() => {
          for (let dz = -15; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
            const isStep = (dz <= -8 && Math.abs(dx) <= 5);
            const topY = isStep ? ly + 1 : ly;
            for (let by = ly - 2; by <= topY; by++) setBlockWorld(dx, by, dz, by === topY ? (isStep ? B.DEEPSLATE_TILES : B.SCULK) : B.WARDEN_SCULK_STONE, true);
            for (let hy = 1; hy <= 13; hy++) setBlockWorld(dx, topY + hy, dz, B.AIR, true);
          }
          buildArrivalWardenPortal(0, ly, -10);
        });
      }
      _recordPortalPos('warden', 0, ly, -10);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(0, 0, 0, -1);
      player.x = 0.5; player.y = ly + 1.3; player.z = 4.5; player.yaw = 0.0; player.pitch = 0.06;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      const restoredWarden = (typeof restoreDimensionMobs === 'function') ? restoreDimensionMobs('warden') : false;
      if (!restoredWarden && (typeof hasDimVisited !== 'function' || !hasDimVisited('warden'))) {
        _spawnArrivalMob('warden:sculk_stalker', 'sculk_stalker', -4.5, ly + 1.3, -2.5);
        _spawnArrivalMob('warden:sculk_sentinel', 'sculk_sentinel', 5.5, ly + 1.3, -4.5);
        _spawnArrivalMob('warden:sculk_brute', 'sculk_brute', -6.5, ly + 1.3, -7.5);
        _spawnArrivalMob('warden:sculk_soul_ravager', 'sculk_soul_ravager', 8.5, ly + 1.5, -18.5);
      }
      if (typeof markDimVisited === 'function') markDimVisited('warden');
      mobSpawnTimer = restoredWarden ? 5.5 : 1.5;
      playSfx('roar');
      showToast(reasonToast || '🩵 CHÀO MỪNG TỚI THẾ GIỚI WARDEN! Săn Quặng Tier 6 & Hạ Boss Sculk 1000HP!');
    } else if (targetDim === 'dragon_realm') {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) generateChunk(dx, dz);
      generateChunk(1, 3);
      for (let dz = 7; dz <= 10; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(dx, dz);
      const ly = Math.max(16, getTerrainHeight(0, 0, BIOMES.DR_PLAINS));
      if (!_findBlockInBox(0, ly + 2, -10, 3, 2, 4, 2, B.DRAGON_REALM_PORTAL)) {
        buildDragonRealmPortal(0, ly, -10);
      }
      _recordPortalPos('dragon_realm', 0, ly, -10);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(0, 0, 0, -1);
      const _drLeftCh = chunks.get(chunkKey(-1, -1));
      if (_drLeftCh) { _drLeftCh.dirty = true; rebuildChunkMesh(_drLeftCh); }
      player.x = 0.5; player.y = ly + 1.3; player.z = 2.5; player.yaw = Math.PI; player.pitch = 0.04;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      const restoredDrg = (typeof restoreDimensionMobs === 'function') ? restoreDimensionMobs('dragon_realm') : false;
      if (!restoredDrg && (typeof hasDimVisited !== 'function' || !hasDimVisited('dragon_realm')) && typeof spawnMobOfType === 'function') {
        const safeDrgY = (wx, wz, clr = 16) => (typeof _getSafeDragonSkyY === 'function') ? _getSafeDragonSkyY(wx, wz, clr) : Math.max(ly + clr, getTerrainHeight(Math.floor(wx), Math.floor(wz), getBiomeAt(Math.floor(wx), Math.floor(wz))) + clr);
        _spawnArrivalMob('dragon_realm:void_end_dragon', 'void_end_dragon', -28, safeDrgY(-28, 42, 16), 42);
        _spawnArrivalMob('dragon_realm:amethyst_end_dragon', 'amethyst_end_dragon', 30, safeDrgY(30, 54, 16), 54);
        const sovY = safeDrgY(0.5, 136.5, 16);
        _spawnArrivalMob('dragon_realm:sovereign_end_dragon', 'sovereign_end_dragon', 0.5, sovY, 136.5, { homeX: 0.5, homeY: sovY, homeZ: 136.5, homeRadius: 52 });
      }
      if (typeof markDimVisited === 'function') markDimVisited('dragon_realm');
      mobSpawnTimer = restoredDrg ? 5.5 : 2.0;
      playSfx('roar');
      showToast(reasonToast || '🌌 CHÀO MỪNG TỚI THẾ GIỚI RỒNG THE END! Hạ Boss Tối Thượng 50 Skill tại (0, 136)!');
    } else if (portalOpts && portalOpts.returnFromDragonRealm) {
      const dp = portalOpts.portalCoords || window.lastDragonRealmReturnPos || (_portalReturnLinks && _portalReturnLinks.dragonRealmReturn) || _findNearestPortal(targetDim, 0, 0, 100000, B.DRAGON_REALM_PORTAL) || window._worldSpawnPos || { x: _ruinOriginX || 0, z: _ruinOriginZ || 0 };
      const dpDepth = Number(dp && dp.depthOffset) || 0;
      depthOffset = dpDepth;
      let lx = Math.floor(dp.x || 0), lz = Math.floor(dp.z || 0);
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      let ly = (dp && typeof dp.y === 'number') ? (dp.y + dpDepth) : Math.max(WATER_LEVEL + 2, getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      let drP = _findBlockInBox(lx, ly + 2, lz, 14, 6, 8, 14, B.DRAGON_REALM_PORTAL);
      if (!drP) {
        buildDragonRealmPortal(lx, Math.max(MIN_Y + 2, ly - 1), lz);
        drP = _findBlockInBox(lx, ly + 2, lz, 6, 4, 6, 6, B.DRAGON_REALM_PORTAL);
      }
      const anc = drP ? _getCanonicalPortalAnchor(drP.x, drP.y, drP.z, B.DRAGON_REALM_PORTAL) : { x: lx, y: ly, z: lz };
      lx = anc.x; ly = anc.y; lz = anc.z;
      _runBatchedBlocks(() => {
        if (!isSolidAt(lx, ly - 1, lz + 3)) setBlockWorld(lx, ly - 1, lz + 3, B.OBSIDIAN, true);
        setBlockWorld(lx, ly, lz + 3, B.AIR, true);
        setBlockWorld(lx, ly + 1, lz + 3, B.AIR, true);
      });
      _recordPortalPos(targetDim, lx, ly, lz, B.DRAGON_REALM_PORTAL, true);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(lx >> 4, (lz + 3) >> 4);
      player.x = lx + 0.5; player.y = ly + 0.2; player.z = lz + 3.5; player.yaw = 0.0; player.pitch = 0.02;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      if (typeof restoreDimensionMobs === 'function') restoreDimensionMobs(targetDim);
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (portalOpts && portalOpts.returnFromWarden) {
      const wp = (portalOpts && portalOpts.portalCoords) || window.lastWardenOverworldPos || (_portalReturnLinks && _portalReturnLinks.wardenReturn) || _findNearestPortal('overworld', _ruinOriginX || 0, _ruinOriginZ || 0, 100000, B.WARDEN_PORTAL) || window._worldSpawnPos || { x: _ruinOriginX || 0, z: _ruinOriginZ || 0 };
      const wpDepth = Number(wp && wp.depthOffset) || 0;
      depthOffset = wpDepth;
      let lx = Math.floor(wp.x || 0), lz = Math.floor(wp.z || 0);
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      let ly = (wp && typeof wp.y === 'number') ? (wp.y + wpDepth) : Math.max(WATER_LEVEL + 2, getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      let wpHit = _findBlockInBox(lx, ly + 2, lz, 14, 7, 8, 14, B.WARDEN_PORTAL);
      if (!wpHit) {
        _runBatchedBlocks(() => {
          for (let dz = -4; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
            setBlockWorld(lx + dx, ly - 1, lz + dz, B.DEEPSLATE_BRICKS, true);
            for (let hy = 0; hy <= 10; hy++) setBlockWorld(lx + dx, ly + hy, lz + dz, B.AIR, true);
          }
          buildArrivalWardenPortal(lx, ly - 1, lz - 2);
        });
        wpHit = _findBlockInBox(lx, ly + 2, lz - 2, 6, 4, 6, 4, B.WARDEN_PORTAL);
      }
      const anc = wpHit ? _getCanonicalPortalAnchor(wpHit.x, wpHit.y, wpHit.z, B.WARDEN_PORTAL) : { x: lx, y: ly, z: lz };
      lx = anc.x; ly = anc.y; lz = anc.z;
      _runBatchedBlocks(() => {
        if (!isSolidAt(lx, ly - 1, lz + 3)) setBlockWorld(lx, ly - 1, lz + 3, B.DEEPSLATE_BRICKS, true);
        setBlockWorld(lx, ly, lz + 3, B.AIR, true);
        setBlockWorld(lx, ly + 1, lz + 3, B.AIR, true);
      });
      _recordPortalPos('overworld', lx, ly, lz, B.WARDEN_PORTAL, true);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(lx >> 4, (lz + 3) >> 4);
      player.x = lx + 0.5; player.y = ly + 0.2; player.z = lz + 3.5; player.yaw = 0.0; player.pitch = 0.02;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      if (typeof restoreDimensionMobs === 'function') restoreDimensionMobs('overworld');
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (portalOpts && portalOpts.returnFromSift) {
      const fbSift = (portalOpts && portalOpts.portalCoords) || lastSiftOverworldPos || (_portalReturnLinks && _portalReturnLinks.siftReturn) || _findNearestPortal('overworld', _ruinOriginX || 0, _ruinOriginZ || 0, 100000, B.DREAM_PORTAL) || window._worldSpawnPos || { x: _ruinOriginX || 0, z: _ruinOriginZ || 0 };
      const lx = Math.floor(fbSift.x || 0), lz = Math.floor(fbSift.z || 0);
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      const ly = Math.max(WATER_LEVEL + 2, getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      let existingSiftOW = _findBlockInBox(lx, ly + 3, lz, 16, 6, 8, 16, B.DREAM_PORTAL);
      if (!existingSiftOW) {
        _runBatchedBlocks(() => {
          for (let dz = -6; dz <= 7; dz++) for (let dx = -6; dx <= 6; dx++) {
            setBlockWorld(lx + dx, ly, lz + dz, B.STONE_BRICK, true);
            for (let hy = 1; hy <= 13; hy++) setBlockWorld(lx + dx, ly + hy, lz + dz, B.AIR, true);
          }
          startRisingDreamPortal(lx, ly - 1, lz, true);
        });
        existingSiftOW = _findBlockInBox(lx, ly + 3, lz, 6, 4, 6, 4, B.DREAM_PORTAL);
      }
      const anc = existingSiftOW ? _getCanonicalPortalAnchor(existingSiftOW.x, existingSiftOW.y, existingSiftOW.z, B.DREAM_PORTAL) : { x: lx, y: ly + 1, z: lz };
      const sxOut = anc.x + 0.5, szOut = anc.z + 3.5;
      const syOut = Math.max(anc.y, colGroundY(anc.x, Math.floor(szOut)) + 1.15);
      _runBatchedBlocks(() => {
        const ix = Math.floor(sxOut), iy = Math.floor(syOut), iz = Math.floor(szOut);
        if (!isSolidAt(ix, iy - 1, iz)) setBlockWorld(ix, iy - 1, iz, B.STONE_BRICK, true);
        setBlockWorld(ix, iy, iz, B.AIR, true);
        setBlockWorld(ix, iy + 1, iz, B.AIR, true);
      });
      _recordPortalPos('overworld', anc.x, anc.y, anc.z, B.DREAM_PORTAL, true);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(anc.x >> 4, Math.floor(szOut) >> 4);
      player.x = sxOut; player.y = syOut; player.z = szOut; player.yaw = 0.0; player.pitch = 0.02;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      if (typeof restoreDimensionMobs === 'function') restoreDimensionMobs('overworld');
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else if (portalOpts && portalOpts.portalCoords) {
      let lx = Math.floor(portalOpts.portalCoords.x), lz = Math.floor(portalOpts.portalCoords.z);
      const scx = lx >> 4, scz = lz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
      let ly = Math.max(WATER_LEVEL + 1, (typeof portalOpts.portalCoords.y === 'number') ? (portalOpts.portalCoords.y - 1) : getTerrainHeight(lx, lz, getBiomeAt(lx, lz)));
      const existingOP = _findBlockInBox(lx, ly + 1, lz, 10, 6, 8, 10, B.NETHER_PORTAL);
      if (existingOP) {
        const anc = _getCanonicalPortalAnchor(existingOP.x, existingOP.y, existingOP.z, B.NETHER_PORTAL);
        lx = anc.x; lz = anc.z; ly = anc.y - 1;
        _runBatchedBlocks(() => {
          if (!isSolidAt(lx, ly, lz + 1)) setBlockWorld(lx, ly, lz + 1, B.OBSIDIAN, true);
          setBlockWorld(lx, ly + 1, lz + 1, B.AIR, true);
          setBlockWorld(lx, ly + 2, lz + 1, B.AIR, true);
        });
      } else {
        buildArrivalNetherPortal(lx, ly + 1, lz);
      }
      _recordPortalPos('overworld', lx, ly + 1, lz, B.NETHER_PORTAL, true);
      _portalCooldown = 4.5;
      _rebuildStandingOnly(lx >> 4, lz >> 4);
      player.x = lx + 0.5; player.y = ly + 1.2; player.z = lz + 1.55; player.yaw = 0.0; player.pitch = -0.05;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = player.y;
      if (typeof restoreDimensionMobs === 'function') restoreDimensionMobs('overworld');
      playSfx('roar');
      if (reasonToast) showToast(reasonToast);
    } else {
      let sp = null;
      const wsPos = window._worldSpawnPos;
      if (wsPos && Number.isFinite(wsPos.x) && Number.isFinite(wsPos.z)) {
        const scx = Math.floor(wsPos.x) >> 4, scz = Math.floor(wsPos.z) >> 4;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) generateChunk(scx + dx, scz + dz);
        sp = { x: wsPos.x, y: Number.isFinite(wsPos.y) ? wsPos.y : (colGroundY(Math.floor(wsPos.x), Math.floor(wsPos.z)) + 1.1), z: wsPos.z, yaw: wsPos.yaw || 0 };
      } else {
        const rawSp = findSafeSpawnPoint(8, 8, true);
        sp = landPlayerScenic(rawSp.x, rawSp.z, rawSp.yaw);
        ensureScenicSakuraAcrossLake(sp);
      }
      player.x = sp.x; player.y = sp.y; player.z = sp.z; player.yaw = sp.yaw; player.pitch = 0.0;
      player.vx = 0; player.vy = 0; player.vz = 0; player.fallStartY = sp.y;
      if (typeof restoreDimensionMobs === 'function') restoreDimensionMobs('overworld');
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
    dimensionPortals = { overworld: [], nether: [], sift: [], warden: [], dragon_realm: [] };
    lastSiftOverworldPos = null;
    _portalReturnLinks = { siftReturn: null, wardenReturn: null, dragonRealmReturn: null };
    window.lastWardenOverworldPos = null;
    window.lastDragonRealmReturnPos = null;
    window.lastDragonRealmPrevDim = null;
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
    player._burnSoul = false;
    recalcPlayerArmor();
    player.dead = false; player.fallStartY = sp.y; dayTime = 0.34;
    renderHotbar(); renderStatusBars(); renderXpBar();
  }
