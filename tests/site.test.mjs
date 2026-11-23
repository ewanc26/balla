import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const siteDir = new URL('site/', root);
const pages = readdirSync(siteDir).filter((name) => name.endsWith('.html'));
const read = (name) => readFileSync(new URL(name, siteDir), 'utf8');
const sitemap = readFileSync(new URL('sitemap.xml', siteDir), 'utf8');

test('every public page has the shared accessible shell', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /class="skip-link" href="#main"/, `${page} has a skip link`);
    assert.match(html, /<main id="main"/, `${page} has the main landmark`);
    assert.match(html, /<link rel="stylesheet" href="\/styles\.css" \/>/, `${page} loads the shared stylesheet`);
    assert.match(html, /<nav aria-label="Main">/, `${page} has a labelled nav`);
    assert.match(html, /href="\/features"/, `${page} links to Features`);
    assert.match(html, /href="\/privacy"/, `${page} links to Privacy`);
    assert.match(html, /security\/advisories\/new"/, `${page} offers a private contact route`);
  }
});

test('the sitemap lists every public page with clean URLs', () => {
  for (const page of pages) {
    const path = page === 'index.html' ? '/' : `/${page.replace(/\.html$/, '')}`;
    assert.ok(sitemap.includes(`https://balla.croft.click${path}`), `${path} is in the sitemap`);
  }
});

test('the site loads no analytics, ads or tracking scripts', () => {
  for (const page of pages) {
    const html = read(page);
    assert.doesNotMatch(html, /<script\b/i, `${page} has no scripts`);
    assert.doesNotMatch(html, /googletagmanager|google-analytics|plausible|umami|adsbygoogle/i, `${page} has no tracking hooks`);
  }
});

test('the roadmap page links to the open issues it names', () => {
  const features = read('features.html');
  for (const issue of [34, 35, 14, 15, 16, 25, 26, 28, 20, 27, 37, 76, 79, 81, 83]) {
    assert.ok(features.includes(`https://github.com/ewanc26/balla/issues/${issue}"`), `issue ${issue} is linked`);
  }
  assert.ok(features.includes('docs/bluesky-compliance.md'), 'the compliance note is linked');
});

test('the shared stylesheet handles reduced motion and focus', () => {
  const css = readFileSync(join(new URL('site/', root).pathname, 'styles.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('one brand blue is shared by the site, mark, icons, config and accent', () => {
  const brand = '#0866FF';
  const css = readFileSync(join(new URL('site/', root).pathname, 'styles.css'), 'utf8');
  const generator = readFileSync(new URL('scripts/gen-icons.py', root), 'utf8');
  const appConfig = JSON.parse(readFileSync(new URL('app.json', root), 'utf8'));
  const theme = readFileSync(new URL('src/lib/themeModel.ts', root), 'utf8');

  assert.match(css, /--blue:\s*#0866ff\b/i, 'the site uses the brand blue');
  assert.ok(read('mark.svg').includes(brand), 'the mark uses the brand blue');
  assert.match(generator, /BLUE = \(8, 102, 255, 255\)/, 'the icons use the brand blue');
  assert.equal(appConfig.expo.web.themeColor, brand);
  assert.equal(appConfig.expo.splash.backgroundColor, brand);
  assert.match(theme, /light:\s*'#0866FF'/, 'the default accent is the brand blue');
  for (const page of pages) {
    assert.ok(read(page).includes(`content="${brand}"`), `${page} uses the brand theme colour`);
  }
});

test('every page shares the same social metadata', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<meta property="og:site_name" content="Balla" \/>/, `${page} names the site`);
    assert.match(
      html,
      /<meta property="og:image" content="https:\/\/balla\.croft\.click\/icon\.png" \/>/,
      `${page} uses the one brand image`
    );
  }
});

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function tokens(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [match[1], match[2]]),
  );
}

test('text meets WCAG AA contrast in both colour schemes', () => {
  const css = readFileSync(join(new URL('site/', root).pathname, 'styles.css'), 'utf8');
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const light = tokens(css.slice(0, darkStart));
  const dark = { ...light, ...tokens(css.slice(darkStart)) };

  for (const [name, theme] of [['light', light], ['dark', dark]]) {
    const pairs = [
      ['body text', theme['--text'], theme['--bg']],
      ['muted text', theme['--muted'], theme['--bg']],
      ['links', theme['--blue-ink'], theme['--bg']],
      ['soft badges', theme['--blue-ink'], theme['--blue-soft']],
      ['success badges', theme['--green-ink'], theme['--green-soft']],
      ['warning badges', theme['--amber-ink'], theme['--amber-soft']],
      ['white buttons', '#ffffff', theme['--blue-deep']],
      ['panel text', '#f5f6f8', '#101114'],
      ['panel accent', '#8bb9ff', '#101114'],
      ['panel success', '#9be6ab', '#101114'],
    ];
    for (const [label, foreground, background] of pairs) {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= 4.5, `${name}: ${label} is ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
    }
  }
});
