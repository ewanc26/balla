import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  ACCENT_COLOURS,
  DEFAULT_THEME_CHOICE,
  FACEBOOK_ERAS,
  buildPalette,
  contrastRatio,
  normaliseThemeChoice,
  resolveScheme,
  scaleFontSize,
} from '../src/lib/themeModel.ts';

test('nine solid accents and four Facebook-era presets are available', () => {
  assert.equal(ACCENT_COLOURS.length, 9);
  assert.equal(FACEBOOK_ERAS.length, 4);
  assert.equal(new Set(ACCENT_COLOURS.map((colour) => colour.id)).size, 9);
  assert.equal(new Set(FACEBOOK_ERAS.map((era) => era.id)).size, 4);
  assert.equal(DEFAULT_THEME_CHOICE.accent, 'facebook');
  assert.equal(DEFAULT_THEME_CHOICE.era, 'newfacebook');
  assert.equal(DEFAULT_THEME_CHOICE.colourMode, 'system');
  assert.equal(DEFAULT_THEME_CHOICE.darkTheme, 'dim');
  assert.equal(DEFAULT_THEME_CHOICE.fontScale, 'default');
  assert.deepEqual(
    FACEBOOK_ERAS.map((era) => era.years),
    ['2004–2005', '2006–2010', '2011–2019', '2020–present']
  );
});

test('bad stored choices fall back without losing the valid half', () => {
  assert.deepEqual(normaliseThemeChoice(null), DEFAULT_THEME_CHOICE);
  assert.deepEqual(
    normaliseThemeChoice({ accent: 'orange', era: 'future' }),
    { ...DEFAULT_THEME_CHOICE, accent: 'orange' }
  );
  assert.deepEqual(
    normaliseThemeChoice({ accent: 'future', era: 'timeline' }),
    { ...DEFAULT_THEME_CHOICE, era: 'timeline' }
  );
  assert.deepEqual(
    normaliseThemeChoice({ colourMode: 'dark', fontScale: 'large' }),
    { ...DEFAULT_THEME_CHOICE, colourMode: 'dark', fontScale: 'large' }
  );
  assert.deepEqual(
    normaliseThemeChoice({ colourMode: 'auto', fontScale: 'huge' }),
    DEFAULT_THEME_CHOICE
  );
});

test('colour mode and font scale are resolved from one shared rule', () => {
  assert.equal(resolveScheme('light', 'system'), 'light');
  assert.equal(resolveScheme('dark', 'system'), 'dark');
  assert.equal(resolveScheme('light', 'dark'), 'dark');
  assert.equal(resolveScheme('dark', 'light'), 'light');
  assert.equal(scaleFontSize(15, 'small'), 13.5);
  assert.equal(scaleFontSize(15, 'default'), 15);
  assert.equal(scaleFontSize(15, 'large'), 17.3);
});

test('accent and era are independent', () => {
  const blue = buildPalette('light', { accent: 'facebook', era: 'timeline' });
  const red = buildPalette('light', { accent: 'red', era: 'timeline' });
  const modern = buildPalette('light', { accent: 'facebook', era: 'newfacebook' });

  assert.equal(blue.chrome, red.chrome);
  assert.notEqual(blue.accent, red.accent);
  assert.notEqual(blue.chrome, modern.chrome);
  assert.equal(blue.chromeAction, '#FFFFFF');
  assert.equal(modern.chromeAction, modern.accent);
  for (const colour of ACCENT_COLOURS) {
    assert.match(colour.light, /^#[0-9A-F]{6}$/i);
    assert.match(colour.dark, /^#[0-9A-F]{6}$/i);
  }
});

test('every era and accent pair keeps readable text and controls', () => {
  for (const scheme of ['light', 'dark']) {
    for (const era of FACEBOOK_ERAS) {
      for (const colour of ACCENT_COLOURS) {
        const p = buildPalette(scheme, { accent: colour.id, era: era.id });
        const checks = [
          ['accent on card', p.accent, p.card, 4.5],
          ['accent on soft', p.accent, p.accentSoft, 4.5],
          ['button label', p.onAccent, p.accent, 4.5],
          ['body text', p.text, p.card, 4.5],
          ['secondary text', p.secondary, p.card, 4.5],
          ['chrome title', p.chromeText, p.chrome, 4.5],
          ['chrome action', p.chromeAction, p.chrome, 4.5],
          ['chrome muted icon', p.chromeMuted, p.chrome, 3],
        ];
        for (const [label, foreground, background, minimum] of checks) {
          const ratio = contrastRatio(foreground, background);
          assert.ok(
            ratio >= minimum,
            `${scheme}/${era.id}/${colour.id} ${label}: ${ratio.toFixed(2)}`
          );
        }
      }
    }
  }
});

test('dark accents choose a dark label when white would fail', () => {
  const p = buildPalette('dark', {
    accent: 'orange',
    era: 'newfacebook',
    darkTheme: 'dark',
  });
  assert.equal(p.accent, '#FFB74D');
  assert.equal(p.onAccent, '#111827');
  assert.ok(contrastRatio(p.onAccent, p.accent) >= 4.5);
});

test('dim is the default dark theme and invalid stored values fall back', () => {
  assert.equal(DEFAULT_THEME_CHOICE.darkTheme, 'dim');
  assert.deepEqual(
    normaliseThemeChoice({ darkTheme: 'dark', colourMode: 'dark' }),
    { ...DEFAULT_THEME_CHOICE, darkTheme: 'dark', colourMode: 'dark' }
  );
  assert.deepEqual(normaliseThemeChoice({ darkTheme: 'black' }), DEFAULT_THEME_CHOICE);
});

test('dim lifts dark surfaces but never changes light mode', () => {
  const dark = buildPalette('dark', { darkTheme: 'dark' });
  const dim = buildPalette('dark', { darkTheme: 'dim' });
  const light = buildPalette('light', { darkTheme: 'dark' });
  const lightDim = buildPalette('light', { darkTheme: 'dim' });

  assert.deepEqual(light, lightDim);
  assert.notEqual(dim.bg, dark.bg);
  assert.notEqual(dim.card, dark.card);
  assert.notEqual(dim.accent, dark.accent);
  assert.equal(dim.text, dark.text);
  assert.equal(dim.accentSoft, dark.accentSoft);
  assert.equal(dim.darkTheme, 'dim');
  assert.equal(dark.darkTheme, 'dark');
});

test('every era and accent pair stays readable in both dark themes', () => {
  for (const era of FACEBOOK_ERAS) {
    for (const colour of ACCENT_COLOURS) {
      for (const darkTheme of ['dim', 'dark']) {
        const p = buildPalette('dark', {
          era: era.id,
          accent: colour.id,
          darkTheme,
        });
        for (const [label, foreground, background, minimum] of [
          ['accent on card', p.accent, p.card, 4.5],
          ['accent on soft', p.accent, p.accentSoft, 4.5],
          ['button label', p.onAccent, p.accent, 4.5],
          ['body text', p.text, p.card, 4.5],
          ['secondary text', p.secondary, p.card, 4.5],
          ['chrome title', p.chromeText, p.chrome, 4.5],
          ['chrome action', p.chromeAction, p.chrome, 4.5],
          ['chrome muted icon', p.chromeMuted, p.chrome, 3],
        ]) {
          const ratio = contrastRatio(foreground, background);
          assert.ok(
            ratio >= minimum,
            `${darkTheme}/${era.id}/${colour.id} ${label}: ${ratio.toFixed(2)}`
          );
        }
      }
    }
  }
});

test('accent, status and secondary text read on cards and on the page behind them', () => {
  for (const [scheme, darkTheme] of [['light', 'dim'], ['dark', 'dim'], ['dark', 'dark']]) {
    for (const era of FACEBOOK_ERAS) {
      for (const colour of ACCENT_COLOURS) {
        const p = buildPalette(scheme, { accent: colour.id, era: era.id, darkTheme });
        const pairs = [
          ...['secondary', 'accent', 'danger', 'green', 'warning'].flatMap((name) =>
            ['card', 'bg'].map((surface) => [`${name} on ${surface}`, p[name], p[surface]]),
          ),
          ['secondary on soft', p.secondary, p.soft],
          ['label on accent', p.onAccent, p.accent],
          ['label on danger', p.onDanger, p.danger],
          ['label on green', p.onGreen, p.green],
        ];
        for (const [label, foreground, background] of pairs) {
          const ratio = contrastRatio(foreground, background);
          assert.ok(
            ratio >= 4.5,
            `${scheme}/${darkTheme}/${era.id}/${colour.id} ${label}: ${ratio.toFixed(2)}`,
          );
        }
      }
    }
  }
});

test('a colour that already reads is published unchanged', () => {
  const p = buildPalette('light', { accent: 'purple', era: 'newfacebook' });
  assert.equal(p.accent, '#6A1B9A');
  assert.equal(p.text, '#050505');
});

test('screens do not hardcode the status colours or a white label on danger', () => {
  const root = new URL('../src/', import.meta.url);
  const files = readdirSync(root, { recursive: true }).filter(
    (file) => file.endsWith('.tsx'),
  );
  assert.ok(files.length > 100);
  for (const file of files) {
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /'#(E41E3F|B26A00|31A24C)'/i, file);
    assert.doesNotMatch(
      source,
      /backgroundColor: p\.danger,(?:(?!<\/Pressable>)[\s\S])*?(color: '#fff(fff)?'|p\.onAccent)/i,
      file,
    );
    // A button with a danger variant needs the danger ink for it.
    if (/variant === 'danger' \? p\.danger/.test(source)) {
      assert.match(source, /variant === 'danger' \? p\.onDanger/, file);
    }
  }
});
