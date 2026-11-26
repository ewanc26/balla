# Phone releases

Balla ships outside the app stores: an unsigned iOS package listed in an
AltStore Classic source, and a signed Android APK listed in Balla's own F-Droid
repository. It is not in the official F-Droid catalogue.

## Keys

Both live outside the repository, in `~/.balla-release`, with their passwords in
the macOS login Keychain.

| File | Keychain service | Signs |
| --- | --- | --- |
| `android-signing.p12` | `balla-android-signing` | the APK |
| `fdroid-repo.p12` | `balla-fdroid-repo` | the repository index |

Back up both files and both passwords somewhere other than this Mac. Without the
Android key, installed copies cannot be updated; without the repository key,
everyone has to add the repository again. Their public certificate fingerprints
are in `distribution/fingerprints.json` and on `/install`.

## Releasing

Needs Xcode, CocoaPods, JDK 17, the Android SDK and `fdroidserver`.

1. Bump the version. Set `ios.buildNumber` and `android.versionCode` to
   `major × 1000000 + minor × 1000 + patch`; the tests check this.
2. Add the changelog entry and commit.
3. Run `node scripts/package-release.mjs`. It builds from the commit in a
   temporary worktree and writes the files to `~/.balla-release/out/vX.Y.Z`.
   It publishes nothing.
4. Review and commit `site/altstore.json` and `site/fdroid/repo/`.
5. Merge, tag, and attach `balla-X.Y.Z.apk`, `Balla-X.Y.Z.ipa` and `SHA256SUMS`
   to the GitHub release **before** the site deploys, so no listing points at a
   missing file.

The listings record the exact size and hash of those files. Do not rebuild a
version after its listings are written; release a new patch instead.

## Hosting

The site serves `/altstore.json` and the repository index and images.
`vercel.json` redirects `/fdroid/repo/balla-X.Y.Z.apk` to the GitHub release
asset of the same name, so binaries never enter git history. An index lists
only the APKs present in `~/.balla-release/fdroid/repo`, so keep that directory.
