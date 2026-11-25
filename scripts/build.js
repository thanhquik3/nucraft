'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const ASSETS_DIR = path.join(ROOT, 'assets');

const SRC_ORDER = [
  'data/blocks.js',
  'data/items.js',
  'audio/AudioEngine.js',
  'render/RtxEngine.js',
  'world/Chunk.js',
  'world/World.js',
  'entities/Player.js',
  'entities/Mob.js',
  'ui/Hotbar.js',
  'ui/Chat.js',
  'network/Network.js',
  'entities/RemotePlayer.js',
  'mods/ModManager.js',
  'ui/Menus.js',
  'main.js'
];

const REGEX_PREV_KEYWORDS = new Set([
  'return', 'throw', 'case', 'delete', 'void', 'typeof',
  'in', 'instanceof', 'new', 'do', 'else', 'yield', 'await'
]);

/**
 * Strip JS comments and empty/indented whitespace outside string/template/regex literals
 * while preserving newlines (safe ASI) and GLSL code inside template strings.
 */
function stripCommentsPreserveStrings(src) {
  const n = src.length;
  const out = [];
  const stack = ['code']; // 'code' | 'tpl' | 'expr'
  const braceDepthAtExpr = [];
  let braceDepth = 0;
  let prevChar = ';';
  let prevWord = '';

  const canStartRegex = () => {
    if (REGEX_PREV_KEYWORDS.has(prevWord)) return true;
    return '=([,:;!&|?{}~^+-*%<>'.includes(prevChar);
  };

  let i = 0;
  while (i < n) {
    const mode = stack[stack.length - 1];
    const ch = src[i];

    if (mode === 'tpl') {
      if (ch === '\\' && i + 1 < n) {
        out.push(ch, src[i + 1]);
        i += 2;
        continue;
      }
      if (ch === '$' && src[i + 1] === '{') {
        out.push('${');
        stack.push('expr');
        braceDepthAtExpr.push(braceDepth);
        braceDepth++;
        prevChar = '{';
        prevWord = '';
        i += 2;
        continue;
      }
      if (ch === '`') {
        out.push('`');
        stack.pop();
        prevChar = '`';
        prevWord = '';
        i++;
        continue;
      }
      out.push(ch);
      i++;
      continue;
    }

    // String literals
    if (ch === '\'' || ch === '"') {
      const q = ch;
      out.push(ch);
      i++;
      while (i < n) {
        const c = src[i];
        out.push(c);
        i++;
        if (c === '\\' && i < n) {
          out.push(src[i]);
          i++;
        } else if (c === q) {
          break;
        }
      }
      prevChar = q;
      prevWord = '';
      continue;
    }

    // Template literal open
    if (ch === '`') {
      out.push('`');
      stack.push('tpl');
      i++;
      continue;
    }

    // Comments or regex literal
    if (ch === '/') {
      const next = src[i + 1];
      if (next === '/') {
        i += 2;
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (next === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        out.push(' ');
        continue;
      }
      if (canStartRegex()) {
        out.push('/');
        i++;
        let inClass = false;
        while (i < n) {
          const c = src[i];
          out.push(c);
          i++;
          if (c === '\\' && i < n) {
            out.push(src[i]);
            i++;
          } else if (c === '[') {
            inClass = true;
          } else if (c === ']' && inClass) {
            inClass = false;
          } else if (c === '/' && !inClass) {
            break;
          }
        }
        while (i < n && /[a-z]/i.test(src[i])) {
          out.push(src[i]);
          i++;
        }
        prevChar = '/';
        prevWord = '';
        continue;
      }
    }

    if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
      if (stack[stack.length - 1] === 'expr' && braceDepth === braceDepthAtExpr[braceDepthAtExpr.length - 1]) {
        stack.pop();
        braceDepthAtExpr.pop();
        out.push('}');
        i++;
        continue;
      }
    }

    if (/[A-Za-z0-9_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out.push(word);
      prevWord = word;
      prevChar = word[word.length - 1];
      i = j;
      continue;
    }

    if (!/\s/.test(ch)) {
      prevChar = ch;
      prevWord = '';
    }
    out.push(ch);
    i++;
  }

  // Collapse leading indentation & blank lines safely without touching non-empty code lines
  return out.join('')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[ \t]+|[ \t]+$/g, ''))
    .filter((line) => line.length > 0)
    .join('\n');
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function copyEntry(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) copyEntry(path.join(src, f), path.join(dest, f));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function writeGrassBlockIco(icoPath) {
  // 16x16 voxel grass-block icon matching assets/icon-512.svg (#182230 frame, #5da642 grass, #79553a dirt)
  const palette = {
    '.': [0x30, 0x22, 0x18, 0xff], // #182230
    '#': [0x16, 0x0e, 0x09, 0xff], // #090e16
    'g': [0x42, 0xa6, 0x5d, 0xff], // #5da642
    'G': [0x35, 0x8f, 0x4e, 0xff], // #4e8f35
    'd': [0x3a, 0x55, 0x79, 0xff], // #79553a
    'D': [0x2b, 0x40, 0x5c, 0xff], // #5c402b
    's': [0x7f, 0x87, 0x8d, 0xff]  // #8d877f
  };
  const grid = [
    '................',
    '.##############.',
    '.#gggggggggggg#.',
    '.#gggggggggggg#.',
    '.#gggggggggggg#.',
    '.#gggggggggggg#.',
    '.#dggdGGGddggd#.',
    '.#ddddGGGddddd#.',
    '.#dddddddddddd#.',
    '.#ddDDdddddddd#.',
    '.#ddDDdddsssdd#.',
    '.#dddddddsssdd#.',
    '.#dddddddddddd#.',
    '.#dddddddddddd#.',
    '.##############.',
    '................'
  ];
  const sizes = [16, 32, 48];
  const images = sizes.map((sz) => {
    const scale = sz / 16;
    const andStride = Math.ceil(sz / 32) * 4;
    const xorSize = sz * sz * 4;
    const dib = Buffer.alloc(40 + xorSize + andStride * sz);
    dib.writeUInt32LE(40, 0);
    dib.writeInt32LE(sz, 4);
    dib.writeInt32LE(sz * 2, 8);
    dib.writeUInt16LE(1, 12);
    dib.writeUInt16LE(32, 14);
    dib.writeUInt32LE(0, 16);
    dib.writeUInt32LE(xorSize + andStride * sz, 20);
    let pos = 40;
    for (let y = sz - 1; y >= 0; y--) {
      const row = grid[Math.floor(y / scale)];
      for (let x = 0; x < sz; x++) {
        const bgra = palette[row[Math.floor(x / scale)]] || palette['.'];
        dib[pos++] = bgra[0];
        dib[pos++] = bgra[1];
        dib[pos++] = bgra[2];
        dib[pos++] = bgra[3];
      }
    }
    return { sz, dib };
  });

  const dirHeader = Buffer.alloc(6 + images.length * 16);
  dirHeader.writeUInt16LE(0, 0);
  dirHeader.writeUInt16LE(1, 2);
  dirHeader.writeUInt16LE(images.length, 4);
  let offset = dirHeader.length;
  images.forEach((img, idx) => {
    const off = 6 + idx * 16;
    dirHeader[off] = img.sz & 255;
    dirHeader[off + 1] = img.sz & 255;
    dirHeader[off + 2] = 0;
    dirHeader[off + 3] = 0;
    dirHeader.writeUInt16LE(1, off + 4);
    dirHeader.writeUInt16LE(32, off + 6);
    dirHeader.writeUInt32LE(img.dib.length, off + 8);
    dirHeader.writeUInt32LE(offset, off + 12);
    offset += img.dib.length;
  });

  fs.mkdirSync(path.dirname(icoPath), { recursive: true });
  fs.writeFileSync(icoPath, Buffer.concat([dirHeader].concat(images.map((i) => i.dib))));
}

function findCscExe() {
  const candidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('csc.exe (.NET Framework v4.0.30319) not found to build NUCRAFT.exe');
}

function buildStandaloneExe(zipPath, outExePath) {
  const csc = findCscExe();
  const fwDir = path.dirname(csc);
  const icoPath = path.join(ROOT, 'launcher', 'nucraft.ico');
  const csPath = path.join(ROOT, 'launcher', 'NucraftLauncher.cs');
  writeGrassBlockIco(icoPath);

  const absOut = path.resolve(outExePath);
  const args = [
    '/nologo',
    '/target:winexe',
    '/optimize+',
    '/platform:anycpu',
    `/r:${path.join(fwDir, 'System.Windows.Forms.dll')}`,
    `/r:${path.join(fwDir, 'System.IO.Compression.dll')}`,
    `/r:${path.join(fwDir, 'System.IO.Compression.FileSystem.dll')}`,
    `/win32icon:${icoPath}`,
    `/resource:${path.resolve(zipPath)},NUCRAFT_Web_Host.zip`,
    `/resource:${icoPath},nucraft.ico`,
    `/out:${absOut}`,
    csPath
  ];
  execFileSync(csc, args, { stdio: 'inherit' });
  const exeSize = fs.existsSync(absOut) ? fs.statSync(absOut).size : 0;
  if (exeSize < 1024 * 1024) {
    throw new Error(`Built NUCRAFT.exe too small (${exeSize} bytes) — embedded bundle missing!`);
  }
  return absOut;
}

function createPagesZip(outZipPath) {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nucraft-pages-'));
  try {
    const webFiles = [
      'index.html', 'NUCRAFT.html', 'manifest.json', 'sw.js',
      'css/hud.css', 'css/menus.css', 'shared/constants.js', 'shared/blocks.js',
      'src/config.js', 'src/world/chunkWorker.js',
      'assets/nucraft_app.min.js', 'assets/three.min.js',
      'assets/player_skins_bundle.js', 'assets/mc_icons_bundle.js',
      'assets/nucraft_logo.png', 'assets/icon-512.svg'
    ];
    for (const rel of webFiles) copyEntry(path.join(ROOT, rel), path.join(stageRoot, rel));
    copyEntry(path.join(ASSETS_DIR, 'models'), path.join(stageRoot, 'assets/models'));
    copyEntry(path.join(ASSETS_DIR, 'luanti_sounds'), path.join(stageRoot, 'assets/luanti_sounds'));

    const absOut = path.resolve(outZipPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    if (fs.existsSync(absOut)) fs.unlinkSync(absOut);
    const realStage = fs.realpathSync(stageRoot);
    const ps = `
      $ErrorActionPreference = 'Stop'
      Add-Type -AssemblyName System.IO.Compression
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $src = [System.IO.Path]::GetFullPath($env:NC_ZIP_SRC).TrimEnd('\\','/')
      $zip = [System.IO.Compression.ZipFile]::Open($env:NC_ZIP_DST, [System.IO.Compression.ZipArchiveMode]::Create)
      try {
        Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
          $rel = $_.FullName.Substring($src.Length).Replace('\\', '/').TrimStart('/')
          [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal
          ) | Out-Null
        }
      } finally { $zip.Dispose() }
    `;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      stdio: 'inherit',
      env: Object.assign({}, process.env, { NC_ZIP_SRC: realStage, NC_ZIP_DST: absOut })
    });
    return absOut;
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

function main() {
  const t0 = Date.now();

  // Discover exact binary model & sound manifests so web builds fetch only existing immutable assets
  const mobKeys = fs.readdirSync(path.join(ASSETS_DIR, 'models'))
    .filter((f) => f.endsWith('.glb'))
    .map((f) => f.slice(0, -4))
    .sort();
  const soundKeys = fs.readdirSync(path.join(ASSETS_DIR, 'luanti_sounds'))
    .filter((f) => f.endsWith('.ogg'))
    .map((f) => f.slice(0, -4))
    .sort();

  const manifestPreamble =
    `window.__NUCRAFT_MOB_KEYS__ = ${JSON.stringify(mobKeys)};\n` +
    `window.__NUCRAFT_SOUND_KEYS__ = ${JSON.stringify(soundKeys)};\n`;

  // Validate worker & shared scripts
  const constantsJs = readUtf8('shared/constants.js');
  const blocksJs = readUtf8('shared/blocks.js');
  const configJs = readUtf8('src/config.js');
  const workerSrc = readUtf8('src/world/chunkWorker.js');
  new vm.Script(constantsJs, { filename: 'shared/constants.js' });
  new vm.Script(blocksJs, { filename: 'shared/blocks.js' });
  new vm.Script(configJs, { filename: 'src/config.js' });
  new vm.Script(workerSrc, { filename: 'src/world/chunkWorker.js' });

  // Build minified engine bundle from modular src/ files
  let rawSrcConcat = "(() => {\n  'use strict';\n" + manifestPreamble;
  for (const rel of SRC_ORDER) {
    const fileCode = fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');
    new vm.Script(fileCode, { filename: `src/${rel}` });
    rawSrcConcat += '\n' + fileCode;
  }
  rawSrcConcat += '\n})();\n';

  // Keep GLSL shader blocks untouched inside template literals while stripping JS comments & blank whitespace
  const minAppJs = stripCommentsPreserveStrings(rawSrcConcat) + '\n';
  new vm.Script(minAppJs, { filename: 'assets/nucraft_app.min.js' });
  fs.writeFileSync(path.join(ASSETS_DIR, 'nucraft_app.min.js'), minAppJs, 'utf8');

  const bodyHtml = readUtf8('src/body.html').trim();
  const buildMatch = constantsJs.match(/BUILD_TAG\s*=\s*'([^']+)'/);
  const buildTag = buildMatch ? buildMatch[1] : 'BUILD';

  const headMeta = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#182230" />
<meta name="nucraft-build" content="${buildTag}" />
<link rel="manifest" href="manifest.json" />
<link rel="icon" type="image/svg+xml" href="assets/icon-512.svg" />
<title>NUCRAFT — game fanmade chơi giải trí</title>`;

  // 1) Lean NUCRAFT.html (zero Base64 mob/sound bundles; external CSS + cached JS)
  const leanHtml = `${headMeta}
<link rel="stylesheet" href="css/hud.css" />
<link rel="stylesheet" href="css/menus.css" />
<script src="shared/constants.js"></script>
<script src="shared/blocks.js"></script>
<script src="src/config.js"></script>
<script src="assets/player_skins_bundle.js"></script>
<script src="assets/mc_icons_bundle.js"></script>
<script src="assets/three.min.js"></script>
<script async defer src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
</head>
<body>
${bodyHtml}
<script src="assets/nucraft_app.min.js"></script>
</body>
</html>
`;
  if (/mob_models_bundle\.js|luanti_sounds_bundle\.js/.test(leanHtml)) {
    throw new Error('Lean NUCRAFT.html must NOT reference mob_models_bundle.js or luanti_sounds_bundle.js!');
  }
  fs.writeFileSync(path.join(ROOT, 'NUCRAFT.html'), leanHtml, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'index.html'), leanHtml, 'utf8');

  const zipFlagIdx = process.argv.indexOf('--pages-zip');
  const pagesZipArg = zipFlagIdx >= 0 ? process.argv[zipFlagIdx + 1] : '';
  const noExe = process.argv.includes('--no-exe');
  let zipNote = '';
  let exeNote = '';
  let tempZipDir = null;
  try {
    let bundleZipPath = '';
    if (pagesZipArg) {
      bundleZipPath = createPagesZip(pagesZipArg);
      zipNote = ` | pagesZip=${(fs.statSync(bundleZipPath).size / 1048576).toFixed(2)}MB`;
    } else if (!noExe) {
      tempZipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nucraft-exe-zip-'));
      bundleZipPath = createPagesZip(path.join(tempZipDir, 'NUCRAFT_Web_Host.zip'));
    }

    if (!noExe) {
      const outExe = buildStandaloneExe(bundleZipPath, path.join(ROOT, 'NUCRAFT.exe'));
      exeNote = ` | NUCRAFT.exe=${(fs.statSync(outExe).size / 1048576).toFixed(2)}MB`;
    }
  } finally {
    if (tempZipDir) fs.rmSync(tempZipDir, { recursive: true, force: true });
  }

  console.log(
    `[NUCRAFT build] ${buildTag} done in ${Date.now() - t0}ms | ` +
    `app.min=${(minAppJs.length / 1024).toFixed(1)}KB (from ${(rawSrcConcat.length / 1024).toFixed(1)}KB) | ` +
    `NUCRAFT.html=${(leanHtml.length / 1024).toFixed(1)}KB | ` +
    `index.html=${(leanHtml.length / 1024).toFixed(1)}KB | ` +
    `manifests=${mobKeys.length} glb, ${soundKeys.length} ogg${zipNote}${exeNote}`
  );
}

main();
