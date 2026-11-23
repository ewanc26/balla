import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const profileScreen = read('../src/screens/ProfileScreen.tsx');

test('the Profile tab label stays "Profile" even after the header title updates', () => {
  // ProfileScreen sets the stack header title to the profile handle, and the
  // bottom bar uses options.title as the tabBarLabel fallback. The tab pins
  // its own label so the handle never becomes the tab text.
  assert.match(
    profileScreen,
    /navigation\.setOptions\(\{ title: profile \? `@\$\{profile\.handle\}` : 'Profile' \}\)/
  );
  const registration = app.match(/<Tab\.Screen\s+name="Profile"[\s\S]*?\/>/);
  assert.ok(registration, 'the Profile tab registration is missing');
  assert.match(registration[0], /component=\{ProfileScreen\}/);
  assert.match(registration[0], /options=\{\{ tabBarLabel: 'Profile' \}\}/);
});

test('every profile stat renders in the same 44pt centred frame', () => {
  // The posts count has no onPress, but a bare Text otherwise sits higher
  // in the row than its Pressable neighbours, which reads as misalignment.
  assert.match(
    profileScreen,
    /if \(!onPress\) \{\s*return <View style=\{styles\.statFrame\}>\{text\}<\/View>;\s*\}/
  );
  assert.match(
    profileScreen,
    /style=\{\(\{ pressed \}\) => \[styles\.statFrame, \{ opacity: pressed \? 0\.6 : 1 \}\]\}/
  );
  assert.match(
    profileScreen,
    /statFrame: \{\s*minHeight: 44,\s*justifyContent: 'center',\s*\},/
  );
});
