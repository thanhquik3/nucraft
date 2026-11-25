# Security Policy & Source Transparency / Chính Sách Bảo Mật & Minh Bạch

## 1. Personal Open-Source Project Transparency
NUCRAFT is a non-commercial, personal hobby voxel sandbox project maintained at [`thanhquik3/nucraft`](https://github.com/thanhquik3/nucraft). All source code — including the browser game engine (`src/`, `css/`, `shared/`, `scripts/`) and the optional local Windows wrapper source (`launcher/NucraftLauncher.cs`) — is published in full, human-readable form in this repository.

## 2. Source-Code-Only Distribution on GitHub
- **No Prebuilt `.exe` Binaries on GitHub:** This repository hosts source code and the static GitHub Pages web app (`deploy.yml`) **only**. No `.exe`, `.dll`, `.msi`, or pre-packaged `.zip` binaries are hosted in git commits, GitHub Pages, or GitHub Releases.
- **Optional Local Windows Compilation:** Users who want to run a standalone local Windows app on their own PC may inspect [`launcher/NucraftLauncher.cs`](launcher/NucraftLauncher.cs) and compile it locally via `node scripts/build.js`.
- **Loopback-Only Design:** `launcher/NucraftLauncher.cs` binds strictly to `IPAddress.Loopback` (`127.0.0.1`), serves bundled static assets from RAM, launches Microsoft Edge/Chrome/Brave in `--app` mode, requires no administrator privileges, sends zero telemetry, and stores local saves in `%LOCALAPPDATA%\NUCRAFT\AppProfile`.

*(Tiếng Việt)*  
Kho mã nguồn này **chỉ lưu mã nguồn đọc được và bản web tĩnh GitHub Pages** — không phát hành hay lưu trữ bất kỳ file `.exe` dựng sẵn nào trên GitHub. Mã nguồn [`launcher/NucraftLauncher.cs`](launcher/NucraftLauncher.cs) được công khai hoàn toàn để người dùng tự kiểm tra hoặc tự biên dịch cục bộ trên máy Windows cá nhân nếu muốn.

## 3. Automated CI Policy & Security Checks
Every push and pull request runs `.github/workflows/ci.yml` (`ubuntu-latest`), executing `node scripts/ci-check.js --with-build --git-tracked`:
- Rejects any binary/executable/archive files tracked in git (`.exe`, `.dll`, `.msi`, `.bat`, `.ps1`, `.zip`, `.rar`, `.7z`).
- Validates syntax across all JS files and scans for secrets/tokens.
- Runs a static security audit on `launcher/NucraftLauncher.cs` enforcing loopback-only networking and banning unsafe Win32/registry/shell APIs.

## 4. Reporting a Vulnerability / Báo Lỗi Bảo Mật
If you discover a security bug or compliance concern in this repository:
- Do **not** publish exploit details publicly first.
- Please report it via **GitHub Security Advisories** (`Security` tab → `Report a vulnerability`) or open a non-sensitive issue in [`thanhquik3/nucraft/issues`](https://github.com/thanhquik3/nucraft/issues).
