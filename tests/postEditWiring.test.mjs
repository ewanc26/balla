import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/EditPostScreen.tsx');
const model = read('../src/lib/postEditModel.ts');
const helper = read('../src/lib/postEdit.ts');
const card = read('../src/components/PostCard.tsx');
const badge = read('../src/components/EditedBadge.tsx');
const menu = read('../src/components/PostMenu.tsx');
const app = read('../App.tsx');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('the edit screen is registered and has a stable web path', () => {
  assert.match(app, /import \{ EditPostScreen \} from '\.\/src\/screens\/EditPostScreen'/);
  assert.match(
    app,
    /<Stack\.Screen\s+name="EditPost"\s+component=\{EditPostScreen\}/
  );
  assert.equal(WEB_LINKING_CONFIG.screens.EditPost, 'post/:uri/edit');
});

test('the edit path needs no new scope and uses delete plus create', () => {
  assert.match(
    metadata.scope,
    /repo:app\.bsky\.feed\.post\?action=create&action=delete/
  );
  assert.doesNotMatch(metadata.scope, /app\.bsky\.feed\.post\?action=update/);
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
  assert.match(helper, /applyWrites\(/);
  assert.match(helper, /buildEditWrites\(/);
  assert.doesNotMatch(helper, /putRecord|\.post\(/);
});

test('the read paths are already authorised feeds and profiles', () => {
  assert.match(
    screen,
    /networkBackend\.thread\.getPostThread\(\{ uri, depth: 0 \}\)/
  );
  assert.match(screen, /agent\.getProfile\(\{ actor: agent\.did \}\)/);
  assert.doesNotMatch(screen, /getPosts\(/);
});

test('the guard and disclosure run before the write', () => {
  assert.match(screen, /postEditState\(/);
  assert.match(screen, /EDIT_DISCLOSURE/);
  assert.match(screen, /Review edit/);
  assert.match(screen, /Save edit/);
  assert.match(screen, /measurePostText\(text\)/);
  assert.match(screen, /postFacets\(measure\.text, agent\)/);
  assert.match(screen, /savePostEdit\(/);
  assert.match(screen, /notePostEdit\(/);
});

test('the card shows the badge and history, and the menu offers the edit', () => {
  assert.match(card, /isEdited\(record\)/);
  assert.match(card, /<EditedBadge record=\{record\}/);
  assert.match(card, /subscribePostEdits/);
  assert.match(card, /postEditRecord/);
  assert.match(badge, /editHistory\(record\)/);
  assert.match(badge, /entry\.label/);
  assert.match(model, /label: 'Original'/);
  assert.match(model, /label: 'Current'/);
  assert.match(menu, /canOfferEdit\(/);
  assert.match(menu, /navigation\.navigate\('EditPost', \{ uri: post\.uri \}\)/);
});

test('the model keeps the one-edit rule and never invents a second version', () => {
  assert.match(model, /EDIT_WINDOW_MS = 5 \* 60 \* 1000/);
  assert.match(model, /MIN_ACCOUNT_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(model, /originalText/);
  assert.match(model, /applyWrites#delete/);
  assert.match(model, /applyWrites#create/);
  assert.doesNotMatch(model, /putRecord|updateRecord/);
});
