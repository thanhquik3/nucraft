# NUCRAFT (BUILD v124)

[![CI Policy & Security](https://github.com/thanhquik3/nucraft/actions/workflows/ci.yml/badge.svg)](https://github.com/thanhquik3/nucraft/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/thanhquik3/nucraft/actions/workflows/deploy.yml/badge.svg)](https://github.com/thanhquik3/nucraft/actions/workflows/deploy.yml)

An open-source, non-commercial **personal hobby 3D voxel sandbox game** playable directly in web browsers (PC & Mobile).

> **Source-Only GitHub Repository & Compliance Statement:**  
> This GitHub repository hosts **readable source code and the static GitHub Pages web app only — no prebuilt `.exe` or archive binaries are hosted or distributed on GitHub** (`main`, Pages, or Releases).  
> This is an independent, non-commercial personal educational/hobby project by `thanhquik3`, published under the [MIT License](LICENSE) in full compliance with [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), [Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies), and [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).
>
> *(Tiếng Việt: Kho lưu trữ này chỉ chứa mã nguồn mở dễ đọc và ứng dụng web tĩnh trên GitHub Pages — **không chứa hoặc phát hành file `.exe` dựng sẵn trên GitHub**.)*
>
> **Non-Affiliation Disclaimer:**  
> NUCRAFT is an independent fanmade project. It is **not** affiliated with, endorsed by, sponsored by, or associated with Mojang AB or Microsoft Corporation.

---

## Play Online / Chơi Trực Tiếp Trên Web (PC & Mobile)
- **Web App (GitHub Pages):** **https://thanhquik3.github.io/nucraft/**

---

## Build & Run Locally From Source / Tự Chạy & Biên Dịch Từ Mã Nguồn

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (zero npm dependencies required for core build, tests, and dev server)
- Windows only (optional, for compiling the local PC launcher from `launcher/NucraftLauncher.cs` on your own machine): .NET Framework 4.x `csc.exe`

### Run Local Dev Server (Web + Co-op LAN Relay)
```bash
npm run build
npm test
npm run dev
# Open http://127.0.0.1:4173/
```

### Build Web Bundle Only (Linux / macOS / Windows)
```bash
node scripts/build.js --no-exe
node scripts/ci-check.js --with-build
```

### Optional Local Windows Desktop Wrapper (Local PC Only)
On your own Windows PC, `node scripts/build.js` builds the local web bundle and optionally compiles `launcher/NucraftLauncher.cs` into a local loopback app wrapper (`NUCRAFT.exe`) for personal offline play. Prebuilt `.exe` binaries are excluded by `.gitignore` and never uploaded to GitHub.

---

## Project Architecture / Cấu Trúc Mã Nguồn
- `src/` — Modular Three.js voxel engine, world generation, mobs, audio, P2P/MQTT networking, and Ore UI menus.
- `css/` — HUD and lobby/menu stylesheets.
- `shared/` — Shared block definitions and world constants used by both client and chunk workers.
- `scripts/` — Zero-dependency bundler (`build.js`) and CI policy/security audit (`ci-check.js`).
- `launcher/NucraftLauncher.cs` — Open-source C# loopback HTTP/1.1 app wrapper source for optional local Windows builds (see [SECURITY.md](SECURITY.md)).
- `server.js` & `sw.js` — Optional local static/WebSocket dev server and offline web Service Worker.

## Governance & Legal
- [LICENSE](LICENSE) — MIT License & Third-Party Notices
- [SECURITY.md](SECURITY.md) — Source Transparency & Security Reporting
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community Code of Conduct
