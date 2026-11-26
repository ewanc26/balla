// Puts the APKs the F-Droid index lists beside it in the built site. The
// F-Droid client refuses redirects, so the site has to serve them itself; they
// come from the GitHub release so that binaries never enter git history.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryApks } from './distribution.mjs';

/**
 * Returns false, having removed both listings, when a release is not published
 * yet: a listing must never point at a missing file. A file that does not match
 * its index stops the build.
 */
export async function addReleaseFiles(outDir, download = fetch) {
  const repo = join(outDir, 'fdroid/repo');
  const indexPath = join(repo, 'index-v2.json');
  if (!existsSync(indexPath)) return true;
  for (const apk of repositoryApks(JSON.parse(readFileSync(indexPath, 'utf8')))) {
    const response = await download(apk.url);
    if (response.status === 404) {
      rmSync(join(outDir, 'fdroid'), { recursive: true, force: true });
      rmSync(join(outDir, 'altstore.json'), { force: true });
      console.warn(
        `WARNING: ${apk.url} is not published. The AltStore and F-Droid ` +
          'listings are left out of this build; publish the release and redeploy.',
      );
      return false;
    }
    if (!response.ok) throw new Error(`${apk.url} answered ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== apk.size || digest !== apk.sha256) {
      throw new Error(`${apk.name} does not match the repository index`);
    }
    writeFileSync(join(repo, apk.name), bytes);
  }
  return true;
}
