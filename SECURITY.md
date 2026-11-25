# Security Policy & Binary Transparency / Chính Sách Bảo Mật & Minh Bạch

## 1. Personal Open-Source Project Transparency
NUCRAFT is a non-commercial, personal hobby voxel sandbox project maintained at [`quythanhdz374-spec/nucraft`](https://github.com/quythanhdz374-spec/nucraft). All source code — including the browser game engine (`src/`, `css/`, `shared/`, `scripts/`) and the Windows desktop launcher (`launcher/NucraftLauncher.cs`) — is published in full, human-readable form in this repository.

## 2. How `NUCRAFT.exe` Works (Windows PC App)
For complete transparency for users and automated security scanners:
- **100% Built From Public Source in GitHub Actions:** Official `NUCRAFT.exe` releases are compiled directly from `launcher/NucraftLauncher.cs` and the static web bundle on GitHub's hosted `windows-latest` runner via [`.github/workflows/release-pc.yml`](.github/workflows/release-pc.yml), accompanied by `SHA256SUMS.txt` and GitHub **Build Provenance Attestation**.
- **Pure Local Loopback Wrapper:** `NUCRAFT.exe` embeds the game's static HTML/CSS/JS/3D/audio bundle as a compressed resource, serves it strictly on loopback `127.0.0.1` (default port `4173`) without opening external listening sockets (`IPAddress.Loopback`), and opens Microsoft Edge, Google Chrome, or Brave in standalone `--app` window mode.
- **Zero Privilege Escalation & Zero Telemetry:** Requires **no administrator/UAC rights**, installs no background services or drivers, writes no registry keys, collects no personal data, and sends zero telemetry or credentials anywhere.
- **Local Save Storage & Clean Exit:** Player saves and browser profile data reside solely inside `%LOCALAPPDATA%\NUCRAFT\AppProfile`. The embedded loopback HTTP server terminates automatically when the game window closes.

*(Tiếng Việt)*  
`NUCRAFT.exe` được biên dịch công khai trực tiếp từ mã nguồn [`launcher/NucraftLauncher.cs`](launcher/NucraftLauncher.cs) trên máy chủ GitHub Actions (`windows-latest`), chỉ chạy server nội bộ cục bộ `127.0.0.1`, không cần quyền Admin, không thu thập dữ liệu hay gửi thông tin người dùng, lưu thế giới cục bộ trong `%LOCALAPPDATA%\NUCRAFT\AppProfile` và tự tắt khi đóng cửa sổ game.

## 3. Verifying Releases / Xác Minh Bản Tải
After downloading `NUCRAFT.exe` and `SHA256SUMS.txt` from [GitHub Releases](https://github.com/quythanhdz374-spec/nucraft/releases/latest):
```powershell
Get-FileHash .\NUCRAFT.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```
You can also verify GitHub Build Provenance Attestation using GitHub CLI:
```powershell
gh attestation verify .\NUCRAFT.exe --owner quythanhdz374-spec
```
Or build `NUCRAFT.exe` locally yourself from source:
```powershell
node scripts/build.js
```

## 4. Reporting a Vulnerability / Báo Lỗi Bảo Mật
If you discover a security bug or compliance concern in this repository:
- Do **not** publish exploit details publicly first.
- Please report it via **GitHub Security Advisories** (`Security` tab → `Report a vulnerability`) or open a non-sensitive issue in [`quythanhdz374-spec/nucraft/issues`](https://github.com/quythanhdz374-spec/nucraft/issues).
