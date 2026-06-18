#!/usr/bin/env bun
/**
 * Assemble a portable release for one compiled js_unshroud binary.
 *
 * playwright-core cannot be embedded in a Bun --compile binary (it reads browser
 * registry data files from disk at runtime), so it is shipped alongside the binary
 * and resolved relative to the executable's own location at runtime
 * (see loadPlaywrightChromium in src/cli/runner.ts). This script produces:
 *
 *   dist/<name>/
 *     |-- <binary>
 *     |-- node_modules/playwright-core/    (vendored dependency)
 *     `-- instrumentation/                 (browser-context hook scripts)
 *
 * and packs it to dist/<name>.tar.gz.
 *
 * Browsers are NOT bundled; supply them at runtime via PLAYWRIGHT_BROWSERS_PATH.
 *
 * Usage: bun scripts/package-release.ts <binary-filename>
 *   e.g. bun scripts/package-release.ts js_unshroud-linux-x64
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const binaryName = process.argv[2];
if (!binaryName) {
  console.error('Usage: bun scripts/package-release.ts <binary-filename>');
  process.exit(1);
}

const root = process.cwd();
const distDir = join(root, 'dist');
const binaryPath = join(distDir, binaryName);
if (!existsSync(binaryPath)) {
  console.error(`Binary not found: ${binaryPath}. Build it first (e.g. bun run build:linux).`);
  process.exit(1);
}

const pwSource = join(root, 'node_modules', 'playwright-core');
if (!existsSync(pwSource)) {
  console.error(`playwright-core not found at ${pwSource}. Run \`bun install\` first.`);
  process.exit(1);
}

// Release directory name = binary name without any .exe extension. Stage under
// dist/pkg/ so the staging directory never collides with the binary at dist/<name>.
const releaseName = binaryName.replace(/\.exe$/, '');
const stageRoot = join(distDir, 'pkg');
const stageDir = join(stageRoot, releaseName);
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, 'node_modules'), { recursive: true });

// Copy the binary (cpSync preserves the executable mode).
cpSync(binaryPath, join(stageDir, binaryName));

// Vendor playwright-core next to the binary.
cpSync(pwSource, join(stageDir, 'node_modules', 'playwright-core'), { recursive: true });

// Ship the instrumentation scripts next to the binary; runner.ts resolves them
// relative to the executable at runtime (see resolveInstrumentationDir).
const instrSource = join(root, 'src', 'instrumentation');
if (!existsSync(instrSource)) {
  console.error(`instrumentation scripts not found at ${instrSource}.`);
  process.exit(1);
}
cpSync(instrSource, join(stageDir, 'instrumentation'), { recursive: true });

// Pack so the archive root is the release directory.
const tarball = `${releaseName}.tar.gz`;
const tar = spawnSync('tar', ['-czf', join(distDir, tarball), '-C', stageRoot, releaseName], { stdio: 'inherit' });
if (tar.status !== 0) {
  console.error('tar failed');
  process.exit(1);
}

console.log(`\nPackaged: dist/${tarball}`);
console.log(`Layout:   ${releaseName}/${binaryName} + ${releaseName}/node_modules/playwright-core + ${releaseName}/instrumentation`);
