// Pure rules for the sideload releases. No file or process access here, so the
// tests can check exactly what the packaging script publishes.

export const BUNDLE_ID = 'click.croft.balla';
export const SITE = 'https://balla.croft.click';
export const REPOSITORY = 'https://github.com/ewanc26/balla';

/**
 * One increasing integer for Android's versionCode and iOS's CFBundleVersion.
 * Minor and patch get three digits each, so it rises with every SemVer release.
 */
export function buildNumber(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`not a release version: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 999 || patch > 999) throw new Error(`version out of range: ${version}`);
  return major * 1_000_000 + minor * 1_000 + patch;
}

export const ipaName = (version) => `Balla-${version}.ipa`;
export const apkName = (version) => `balla-${version}.apk`;
export const assetUrl = (version, name) =>
  `${REPOSITORY}/releases/download/v${version}/${name}`;

/** The changelog section for a version, as the plain text a store listing shows. */
export function releaseNotes(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.indexOf(`## ${version}`);
  if (start < 0) throw new Error(`no changelog entry for ${version}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return rest
    .slice(0, end < 0 ? rest.length : end)
    .join('\n')
    .replace(/\*\*|`/g, '')
    .trim();
}

/** The APKs a repository index lists, with the facts a download must match. */
export function repositoryApks(index) {
  return Object.values(index.packages ?? {}).flatMap((pkg) =>
    Object.values(pkg.versions).map(({ file }) => {
      const match = /^\/balla-(\d+\.\d+\.\d+)\.apk$/.exec(file.name);
      if (!match) throw new Error(`unexpected repository file ${file.name}`);
      return {
        name: apkName(match[1]),
        url: assetUrl(match[1], apkName(match[1])),
        sha256: file.sha256,
        size: file.size,
      };
    }),
  );
}

/** Every privacy usage description the built app declares. */
export function privacyPermissions(plist) {
  return Object.fromEntries(
    Object.entries(plist)
      .filter(([key]) => /^NS\w+UsageDescription$/.test(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * The AltStore Classic source. AltStore refuses to install an app whose
 * permissions differ from its listing, so they come from the built Info.plist.
 * Earlier versions stay listed, newest first.
 */
export function altstoreSource({ plist, size, date, notes, previous }) {
  const version = plist.CFBundleShortVersionString;
  if (plist.CFBundleIdentifier !== BUNDLE_ID) {
    throw new Error(`unexpected bundle identifier ${plist.CFBundleIdentifier}`);
  }
  if (plist.CFBundleVersion !== String(buildNumber(version))) {
    throw new Error(`build number ${plist.CFBundleVersion} does not match ${version}`);
  }
  const entry = {
    version,
    buildVersion: plist.CFBundleVersion,
    date,
    localizedDescription: notes,
    downloadURL: assetUrl(version, ipaName(version)),
    size,
    minOSVersion: plist.MinimumOSVersion,
  };
  const older = (previous?.apps?.[0]?.versions ?? []).filter(
    (item) => item.version !== version,
  );
  return {
    name: 'Balla',
    subtitle: 'Your people, in order.',
    website: SITE,
    iconURL: `${SITE}/icon.png`,
    tintColor: '#0866FF',
    apps: [
      {
        name: 'Balla',
        bundleIdentifier: BUNDLE_ID,
        developerName: 'Ewan Croft',
        subtitle: 'A chronological Bluesky client',
        localizedDescription:
          'The people you follow on Bluesky, newest first, as cards. No ranking, ' +
          'suggested posts or ads. Balla is independent software, not an official ' +
          'Bluesky client, and is not affiliated with Meta or Bluesky Social PBC.',
        iconURL: `${SITE}/icon.png`,
        tintColor: '#0866FF',
        category: 'social',
        // The package is unsigned and carries no entitlements.
        appPermissions: { entitlements: [], privacy: privacyPermissions(plist) },
        versions: [entry, ...older],
      },
    ],
  };
}
