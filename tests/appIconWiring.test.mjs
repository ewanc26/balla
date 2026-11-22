import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const projectPath = (path) => new URL(path, import.meta.url).pathname;

test('the app icon screen is reachable from settings, navigation and the web', () => {
  const settings = read('../src/screens/SettingsScreen.tsx');
  const app = read('../App.tsx');
  const linking = read('../src/lib/webLinking.ts');

  assert.match(settings, /label="App Icon"/);
  assert.match(settings, /navigate\('AppIconSettings'\)/);
  assert.match(app, /import \{ AppIconSettingsScreen \}/);
  assert.match(app, /<Stack\.Screen name="AppIconSettings"/);
  assert.match(linking, /AppIconSettings: 'settings\/app-icon'/);
});

test('the native module is compatible with Expo 58 and has real baked assets', () => {
  const pkg = JSON.parse(read('../package.json'));
  const config = JSON.parse(read('../app.json'));
  const generator = read('../scripts/gen-icons.py');

  assert.equal(pkg.dependencies['expo-alternate-app-icons'], '^11.0.0');
  const plugin = config.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'expo-alternate-app-icons',
  );
  assert.ok(plugin, 'missing alternate app icon config plugin');
  const dark = plugin[1][0];
  assert.equal(dark.name, 'Dark');
  for (const path of [dark.ios, dark.android.foregroundImage]) {
    assert.equal(existsSync(projectPath(`..${path.slice(1)}`)), true, `missing ${path}`);
  }
  assert.equal(dark.android.backgroundColor, '#0E1420');

  for (const asset of [
    'ios_icon_legacy_light.png',
    'android_icon_legacy_light.png',
    'ios_icon_legacy_dark.png',
    'android_icon_legacy_dark.png',
  ]) {
    assert.match(generator, new RegExp(`assets/app-icons/${asset}`));
  }
});

test('the screen uses the OS icon state and stays safe on web', () => {
  const screen = read('../src/screens/AppIconSettingsScreen.tsx');
  const wrapper = read('../src/lib/appIcon.ts');

  assert.match(screen, /readAppIconChoice\(\)/);
  assert.match(screen, /writeAppIconChoice\(next\)/);
  assert.match(screen, /The app will be restarted\./);
  assert.match(screen, /native iOS or Android app/);
  assert.doesNotMatch(screen, /core_[a-z_]+/);
  assert.match(wrapper, /Platform\.OS === 'web'/);
  assert.match(wrapper, /require\('expo-alternate-app-icons'\)/);
  assert.doesNotMatch(wrapper, /^import .*expo-alternate-app-icons/m);
  assert.match(wrapper, /setAlternateAppIcon\(nativeNameForChoice\(choice\)\)/);
  assert.doesNotMatch(wrapper, /throw new Error/);
});
