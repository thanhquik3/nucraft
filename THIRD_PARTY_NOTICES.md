# Third-Party Notices & Attributions

NUCRAFT includes or interacts with open-source components under their respective licenses:

1. **Three.js (`assets/three.min.js`)**  
   Copyright (c) 2010-2024 three.js authors — **MIT License**  
   Used as the 3D WebGL scene graph and rendering library.

2. **PeerJS (loaded dynamically at runtime via jsDelivr / unpkg CDN)**  
   Copyright (c) Michelle Bu and Eric Zhang — **MIT License**  
   Used optionally at runtime for peer-to-peer WebRTC co-op multiplayer rooms.

3. **Open-Source Voxel Sound Effects (`assets/luanti_sounds/`)**  
   Sourced from open-source Luanti / Minetest community sound packs under permissive / CC-BY-SA open-source licenses.

4. **3D Voxel Mob Models (`assets/models/`)**  
   Original clean-room procedural `.glb` voxel models generated via Blender Python scripts specifically for NUCRAFT.

5. **Rust / WebAssembly Terrain & Lighting Core (`rust/nucraft_core`, `assets/nucraft_core.wasm`)**  
   Original zero-dependency Rust (`#no_std`-compatible `cdylib`, MIT License) implementation of NUCRAFT's deterministic cave-noise grid and voxel emitter light evaluator compiled cleanly to `wasm32-unknown-unknown`. Zero third-party Rust crates are bundled.

6. **Visual & Shader Design Inspirations**  
   Bushy-leaf foliage silhouettes and real-time ray-traced lighting concepts are inspired by community voxel shader/resource-pack conventions (e.g., Motschen's Better Leaves concept) and implemented 100% from scratch in clean-room JavaScript/GLSL without copying any third-party files or textures.

## Trademark & Non-Affiliation Disclaimer

NUCRAFT is an independent, non-commercial personal hobby project maintained by `thanhquik3`.  
It is **not** an official Minecraft product and is **not** affiliated with, endorsed by, sponsored by, or associated with Mojang AB or Microsoft Corporation.
