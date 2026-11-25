'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const CHECK_BUILD = args.has('--with-build');
const CHECK_GIT_TRACKED = args.has('--git-tracked');

const REQUIRED_FILES = [
  'LICENSE',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'README.md',
  '.gitignore',
  'package.json',
  'manifest.json',
  'launcher/NucraftLauncher.cs'
];

const BANNED_EXTS = new Set(['.exe', '.dll', '.msi', '.bat', '.ps1', '.zip', '.rar', '.7z']);
const BANNED_TRACKED = new Set([
  'agents.md',
  'assets/nucraft_app.min.js',
  'nucraft.html',
  'index.html',
  '.github/workflows/release-pc.yml'
]);

const SECRET_REGEXES = [
  new RegExp('\\b(gh' + 'o_[A-Za-z0-9_]{20,}|gh' + 'p_[A-Za-z0-9_]{20,}|github_' + 'pat_[A-Za-z0-9_]{20,}|AK' + 'IA[0-9A-Z]{16})\\b'),
  new RegExp('-----BEGIN [A-Z ]*PRI' + 'VATE KEY-----')
];

const LAUNCHER_BANNED = [
  ['DllImport', /\bDllImport\b/],
  ['Microsoft.Win32.Registry', /\bMicrosoft\.Win32\.Registry\b/],
  ['RegistryKey', /\bRegistryKey\b/],
  ['VirtualAlloc', /\bVirtualAlloc\b/],
  ['CreateRemoteThread', /\bCreateRemoteThread\b/],
  ['WebClient', /\bWebClient\b/],
  ['HttpClient', /\bHttpClient\b/],
  ['DownloadFile', /\bDownloadFile\b/],
  ['DownloadString', /\bDownloadString\b/],
  ['cmd.exe', /cmd\.exe/i],
  ['powershell', /powershell/i],
  ['schtasks', /\bschtasks\b/i],
  ['Verb="runas"', /Verb\s*=\s*"runas"/i],
  ['IPAddress.Any', /\bIPAddress\.Any\b/],
  ['0.0.0.0', /0\.0\.0\.0/]
];

function fail(msg) {
  console.error(`[NUCRAFT CI] FAIL: ${msg}`);
  process.exit(1);
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

function main() {
  // 1) Required governance & config files
  for (const rel of REQUIRED_FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p) || fs.statSync(p).size === 0) fail(`Missing or empty required file: ${rel}`);
  }
  for (const jsonRel of ['package.json', 'manifest.json']) {
    try {
      JSON.parse(fs.readFileSync(path.join(ROOT, jsonRel), 'utf8'));
    } catch (err) {
      fail(`Invalid JSON in ${jsonRel}: ${err.message}`);
    }
  }

  // 2) Git-tracked binary/artifact policy gate
  if (CHECK_GIT_TRACKED) {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, '/'));
    if (tracked.length === 0) fail('git ls-files returned 0 tracked files');
    for (const rel of tracked) {
      const ext = path.extname(rel).toLowerCase();
      if (BANNED_EXTS.has(ext)) fail(`Forbidden binary/script tracked in git: ${rel}`);
      if (BANNED_TRACKED.has(rel.toLowerCase())) fail(`Forbidden generated/internal file tracked in git: ${rel}`);
    }
  }

  // 3) JS syntax validation across all source & runtime scripts
  const jsFiles = [
    ...walkFiles(path.join(ROOT, 'src')).filter((p) => p.endsWith('.js')),
    ...walkFiles(path.join(ROOT, 'shared')).filter((p) => p.endsWith('.js')),
    ...walkFiles(path.join(ROOT, 'scripts')).filter((p) => p.endsWith('.js')),
    path.join(ROOT, 'server.js'),
    path.join(ROOT, 'sw.js')
  ];
  for (const full of jsFiles) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    try {
      new vm.Script(fs.readFileSync(full, 'utf8'), { filename: rel });
    } catch (err) {
      fail(`JS syntax error in ${rel}: ${err.message}`);
    }
  }

  // 4) Secret/token leak scan across readable text sources
  const textFiles = [
    ...jsFiles,
    path.join(ROOT, 'launcher', 'NucraftLauncher.cs'),
    path.join(ROOT, 'src', 'body.html'),
    path.join(ROOT, 'package.json'),
    path.join(ROOT, 'manifest.json'),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'SECURITY.md')
  ];
  let secretsFound = 0;
  for (const full of textFiles) {
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const re of SECRET_REGEXES) {
      if (re.test(content)) {
        secretsFound++;
        fail(`Potential secret/token matched in ${path.relative(ROOT, full)}`);
      }
    }
  }
  for (const noExeLinkRel of ['src/body.html', 'README.md']) {
    const content = fs.readFileSync(path.join(ROOT, noExeLinkRel), 'utf8');
    if (/releases\/latest\/download\/[^"'\s]*\.exe/i.test(content)) {
      fail(`Prohibited GitHub EXE release link found in ${noExeLinkRel}`);
    }
  }

  // 5) Static security audit on Windows C# launcher
  const cs = fs.readFileSync(path.join(ROOT, 'launcher', 'NucraftLauncher.cs'), 'utf8');
  for (const [label, re] of LAUNCHER_BANNED) {
    if (re.test(cs)) fail(`Launcher static audit hit banned API/pattern: ${label}`);
  }
  if (!/\bIPAddress\.Loopback\b/.test(cs)) {
    fail('Launcher static audit failed: IPAddress.Loopback binding is required');
  }

  // 6) Optional web build output integrity checks
  if (CHECK_BUILD) {
    const constJs = fs.readFileSync(path.join(ROOT, 'shared', 'constants.js'), 'utf8');
    const m = constJs.match(/BUILD_TAG\s*=\s*'([^']+)'/);
    if (!m) fail('BUILD_TAG missing from shared/constants.js');
    const buildTag = m[1];
    const nuHtmlPath = path.join(ROOT, 'NUCRAFT.html');
    const idxHtmlPath = path.join(ROOT, 'index.html');
    const appMinPath = path.join(ROOT, 'assets', 'nucraft_app.min.js');
    for (const reqBuilt of [nuHtmlPath, idxHtmlPath, appMinPath]) {
      if (!fs.existsSync(reqBuilt) || fs.statSync(reqBuilt).size === 0) {
        fail(`Missing built artifact: ${path.relative(ROOT, reqBuilt)}`);
      }
    }
    const nuHtml = fs.readFileSync(nuHtmlPath, 'utf8');
    const idxHtml = fs.readFileSync(idxHtmlPath, 'utf8');
    if (nuHtml !== idxHtml) fail('NUCRAFT.html and index.html differ');
    if (!nuHtml.includes(buildTag)) fail(`NUCRAFT.html missing expected ${buildTag}`);
    if (/mob_models_bundle\.js|luanti_sounds_bundle\.js/.test(nuHtml)) {
      fail('NUCRAFT.html references prohibited Base64 bundle');
    }
  }

  console.log(
    `[NUCRAFT CI] PASS | jsFiles=${jsFiles.length} | launcherAudit=PASS | secrets=${secretsFound} | ` +
    `gitGate=${CHECK_GIT_TRACKED ? 'PASS' : 'skipped'} | buildGate=${CHECK_BUILD ? 'PASS' : 'skipped'}`
  );
}

main();
