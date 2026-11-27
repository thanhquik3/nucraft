'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CRATE_DIR = path.join(ROOT, 'rust', 'nucraft_core');
const OUT_WASM = path.join(ROOT, 'assets', 'nucraft_core.wasm');

function resolveCargoBin() {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const cargoBin = path.join(userProfile, '.cargo', 'bin');
  const cargoExe = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  const direct = path.join(cargoBin, cargoExe);
  if (fs.existsSync(direct)) {
    return { cmd: direct, env: Object.assign({}, process.env, { PATH: `${cargoBin}${path.delimiter}${process.env.PATH || ''}` }) };
  }
  return { cmd: 'cargo', env: process.env };
}

function main() {
  const t0 = Date.now();
  const { cmd, env } = resolveCargoBin();
  execFileSync(cmd, ['build', '--release', '--target', 'wasm32-unknown-unknown'], {
    cwd: CRATE_DIR,
    env,
    stdio: 'inherit'
  });

  const builtWasm = path.join(CRATE_DIR, 'target', 'wasm32-unknown-unknown', 'release', 'nucraft_core.wasm');
  if (!fs.existsSync(builtWasm)) {
    throw new Error(`Compiled WASM binary missing: ${builtWasm}`);
  }
  const bytes = fs.readFileSync(builtWasm);
  if (bytes.length < 16 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error(`Invalid WASM magic header in ${builtWasm}`);
  }
  fs.mkdirSync(path.dirname(OUT_WASM), { recursive: true });
  fs.writeFileSync(OUT_WASM, bytes);
  console.log(`[NUCRAFT wasm] Built ${path.relative(ROOT, OUT_WASM)} (${(bytes.length / 1024).toFixed(2)} KB) in ${Date.now() - t0}ms`);
}

main();
