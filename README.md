# NUCRAFT (BUILD v124)

[![CI Policy & Security](https://github.com/thanhquik3/nucraft/actions/workflows/ci.yml/badge.svg)](https://github.com/thanhquik3/nucraft/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/thanhquik3/nucraft/actions/workflows/deploy.yml/badge.svg)](https://github.com/thanhquik3/nucraft/actions/workflows/deploy.yml)
[![Release Windows PC App](https://github.com/thanhquik3/nucraft/actions/workflows/release-pc.yml/badge.svg)](https://github.com/thanhquik3/nucraft/actions/workflows/release-pc.yml)

An open-source, non-commercial **personal hobby 3D voxel sandbox game** playable directly in web browsers (PC & Mobile) or as a standalone Windows desktop app compiled transparently from source via GitHub Actions.

> **Personal Project & Compliance Statement:**  
> This is an independent, non-commercial personal educational/hobby project by `thanhquik3`, published in full source-code form under the [MIT License](LICENSE) and adhering to all [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), [Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies), and [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).
>
> **Non-Affiliation Disclaimer:**  
> NUCRAFT is an independent fanmade project. It is **not** affiliated with, endorsed by, sponsored by, or associated with Mojang AB or Microsoft Corporation.

---

## Play Online / Chơi Trực Tiếp Trên Web (PC & Mobile)
- **Web App (GitHub Pages):** **https://thanhquik3.github.io/nucraft/**

## Windows PC App (`.EXE`) / Tải App PC
- **Official GitHub Release (Built by GitHub Actions):** [NUCRAFT.exe (Latest)](https://github.com/thanhquik3/nucraft/releases/latest/download/NUCRAFT.exe)
- **Checksums (`SHA256SUMS.txt`):** [SHA256SUMS.txt](https://github.com/thanhquik3/nucraft/releases/latest/download/SHA256SUMS.txt)

### Cách sử dụng App PC (Windows)
1. Tải file `NUCRAFT.exe` (~2.3 MB) từ trang [GitHub Releases](https://github.com/thanhquik3/nucraft/releases/latest) (tạo trực tiếp từ mã nguồn bởi GitHub Actions kèm chứng thực Build Provenance).
2. Nháy đúp chuột vào `NUCRAFT.exe` để mở cửa sổ game — **không cần cài đặt, không cần Node.js hay giải nén file đi kèm**. Thế giới đã lưu được giữ cục bộ trong `%LOCALAPPDATA%\NUCRAFT\AppProfile`.
3. *Lưu ý SmartScreen:* Vì đây là dự án cá nhân phi thương mại chưa mua chứng chỉ ký số thương mại (Authenticode EV), lần mở đầu tiên Windows SmartScreen có thể hiển thị cảnh báo ứng dụng chưa rõ nhà phát hành — bạn có thể kiểm tra mã SHA-256 đối chiếu với `SHA256SUMS.txt` và chọn **More info → Run anyway** (hoặc tự biên dịch trực tiếp từ mã nguồn bên dưới).

---

## Build & Run From Source / Tự Biên Dịch Từ Mã Nguồn

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (zero npm dependencies required for core build & dev server)
- Windows only (for `.exe` launcher): .NET Framework 4.x `csc.exe` (included with Windows)

### Run Local Dev Server (Web + Co-op LAN Relay)
```bash
npm run build
npm run dev
# Open http://127.0.0.1:4173/
```

### Build Web Bundle Only (Linux / macOS / Windows)
```bash
node scripts/build.js --no-exe
```

### Build Standalone Windows `NUCRAFT.exe` + Self-Test + CI Verification
```powershell
node scripts/build.js
.\NUCRAFT.exe --self-test
npm test
```
Every commit and release automatically runs GitHub Actions CI (`.github/workflows/ci.yml` & `.github/workflows/release-pc.yml`) including `scripts/ci-check.js` policy/security checks, isolated `--self-test`, **Microsoft Defender Antivirus scan (`MpCmdRun.exe`)**, `SHA256SUMS.txt`, and cryptographic GitHub Build Provenance Attestation.

---

## Project Architecture / Cấu Trúc Mã Nguồn
- `src/` — Modular Three.js voxel engine, world generation, mobs, audio, P2P/MQTT networking, and Ore UI menus.
- `css/` — HUD and lobby/menu stylesheets.
- `shared/` — Shared block definitions and world constants used by both client and chunk workers.
- `scripts/build.js` — Zero-dependency bundler that validates JS syntax, builds `NUCRAFT.html` / `index.html`, generates `launcher/nucraft.ico`, and optionally compiles `NUCRAFT.exe`.
- `launcher/NucraftLauncher.cs` — Transparent C# loopback HTTP/1.1 app wrapper (read full security details in [SECURITY.md](SECURITY.md)).
- `server.js` & `sw.js` — Optional local static/WebSocket dev server and offline web Service Worker.

## Governance & Legal
- [LICENSE](LICENSE) — MIT License & Third-Party Notices
- [SECURITY.md](SECURITY.md) — Binary Transparency, Build Provenance & Security Reporting
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community Code of Conduct
