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

test('a stats row that would overflow the screen fuzzes its widest count', () => {
  // The Header asks the model for all three counts at once with the live
  // window width: exact figures stay while the row fits, and the widest
  // count fuzzes first (1.2M-style) once it would spill off the screen.
  assert.match(
    profileScreen,
    /import \{ statCountsForRow \} from '..\/lib\/statCountModel';/
  );
  assert.match(
    profileScreen,
    /const \{ width: windowWidth \} = useWindowDimensions\(\);/
  );
  assert.match(profileScreen, /const statCounts = statCountsForRow\(/);
  assert.match(profileScreen, /<Stat\s+count=\{statCounts\.posts\}/);
  assert.match(profileScreen, /count=\{statCounts\.following\}/);
  assert.match(profileScreen, /count=\{statCounts\.followers\}/);
  // Fuzzing is visual only; the screen reader label keeps the exact figure.
  assert.match(
    profileScreen,
    /accessibilityLabel=\{`View \$\{value\} \$\{label\}`\}/
  );
});
