import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addReleaseFiles } from './fetch-releases.mjs';

const root = process.cwd();
const siteDir = join(root, 'site');
const outDir = join(root, 'dist-site');
const metadataPath = join(root, 'oauth-client-metadata.json');
const expectedClientId = 'https://balla.croft.click/oauth-client-metadata.json';

if (!existsSync(metadataPath)) {
  throw new Error('oauth-client-metadata.json is missing');
}

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
if (metadata.client_id !== expectedClientId) {
  throw new Error(`client_id must be ${expectedClientId}, found ${metadata.client_id}`);
}
if (!Array.isArray(metadata.redirect_uris) || !metadata.redirect_uris.includes('click.croft.balla:/oauth-callback')) {
  throw new Error('native OAuth callback is missing from redirect_uris');
}
if (!Array.isArray(metadata.redirect_uris) || !metadata.redirect_uris.includes('https://balla.croft.click/app')) {
  throw new Error('web OAuth callback is missing from redirect_uris');
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(siteDir, outDir, { recursive: true });
writeFileSync(join(outDir, 'oauth-client-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

// Export the Expo app into dist-site/app. experiments.baseUrl in app.json
// prefixes the bundle and asset URLs with /app so everything stays in scope.
const appOutDir = join(outDir, 'app');
const exportDir = join(root, 'dist-app');
rmSync(exportDir, { recursive: true, force: true });
const expoCli = join(root, 'node_modules', 'expo', 'bin', 'cli');
const exportResult = spawnSync(
  process.execPath,
  [expoCli, 'export', '--platform', 'web', '--output-dir', exportDir],
  { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } },
);
if (exportResult.status !== 0) {
  throw new Error(`expo export failed with status ${exportResult.status ?? 'unknown'}`);
}
const appIndexPath = join(exportDir, 'index.html');
if (!existsSync(appIndexPath)) {
  throw new Error('expo export did not produce an index.html');
}
const appIndex = readFileSync(appIndexPath, 'utf8');
if (!appIndex.includes('/app/_expo/')) {
  throw new Error('web build is missing the /app base URL; check experiments.baseUrl in app.json');
}
cpSync(exportDir, appOutDir, { recursive: true });
rmSync(exportDir, { recursive: true, force: true });

const iconPath = join(root, 'assets', 'icon.png');
if (existsSync(iconPath)) {
  copyFileSync(iconPath, join(outDir, 'icon.png'));
} else {
  throw new Error('assets/icon.png is missing; run scripts/gen-icons.py first');
}

await addReleaseFiles(outDir);

console.log(`Static site built in ${outDir}`);
console.log(`Web client: https://balla.croft.click/app`);
console.log(`OAuth client: ${metadata.client_id}`);
