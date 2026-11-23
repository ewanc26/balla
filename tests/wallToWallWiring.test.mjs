import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the thread menu appears only when the model has a partner', () => {
  const screen = read('../src/screens/ThreadScreen.tsx');
  const sheet = read('../src/components/ThreadMenuSheet.tsx');

  assert.match(screen, /const partnerCount = wallToWall\?\.partners\.length \|\| 0/);
  assert.match(screen, /headerRight: partnerCount/);
  assert.match(screen, /replies: partitioned\.visible/);
  assert.match(screen, /viewerDid: me\?\.did/);
  assert.match(screen, /<ThreadMenuSheet/);
  assert.match(sheet, /Wall-to-wall with \{name\}/);
  assert.match(sheet, /accessibilityRole="menuitemradio"/);
  assert.match(sheet, /useDialogFocus/);
});

test('the lens states the filter, keeps a visible exit and announces it', () => {
  const screen = read('../src/screens/ThreadScreen.tsx');

  assert.match(screen, /Showing only you and \$\{lensName\}/);
  assert.match(screen, /View full thread/);
  assert.match(screen, /accessibilityLabel="View full thread"/);
  assert.match(screen, /No two-person exchange in this thread yet\./);
  assert.match(screen, /announceForAccessibility\(lensAnnouncement\)/);
  assert.match(screen, /accessibilityLiveRegion=/);
  assert.match(screen, /activeLens\.items\.map/);
  assert.match(screen, /Third-party replies are left out by author/);
});

test('wall-to-wall adds no request, route or write and leaves the composer intact', () => {
  const screen = read('../src/screens/ThreadScreen.tsx');
  const model = read('../src/lib/wallToWallModel.ts');
  const sheet = read('../src/components/ThreadMenuSheet.tsx');
  const app = read('../App.tsx');

  assert.doesNotMatch(
    model + sheet,
    /networkBackend|getPostThread|fetch\(|XMLHttpRequest|putRecord|createRecord|deleteRecord|agent\./
  );
  assert.doesNotMatch(app, /WallToWall/);
  assert.doesNotMatch(app, /Wall-to-wall/);

  const openLens = screen.slice(
    screen.indexOf('function openWallToWall'),
    screen.indexOf('function viewFullThread')
  );
  assert.doesNotMatch(openLens, /load\(|networkBackend|agent\.|fetch\(/);
  assert.match(screen, /placeholder="Write a reply…"/);
  assert.match(screen, /onPress=\{sendReply\}/);
});

test('third parties are excluded by author, not a ranking pass', () => {
  const model = read('../src/lib/wallToWallModel.ts');
  assert.match(model, /candidateDid === viewerDid \|\| candidateDid === did/);
  assert.match(model, /items: items\.filter/);
  assert.doesNotMatch(model, /likeCount|ranking|ranked|score/);
});
