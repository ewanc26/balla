import test from 'node:test';
import assert from 'node:assert/strict';
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
  const p = buildPalette('dark', { accent: 'orange', era: 'newfacebook' });
  assert.equal(p.accent, '#FFB74D');
  assert.equal(p.onAccent, '#111827');
  assert.ok(contrastRatio(p.onAccent, p.accent) >= 4.5);
});
