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
  for (const issue of [34, 35, 14, 15, 16, 25, 26, 28, 20, 27, 37]) {
    assert.ok(features.includes(`https://github.com/ewanc26/balla/issues/${issue}"`), `issue ${issue} is linked`);
  }
  assert.ok(features.includes('docs/bluesky-compliance.md'), 'the compliance note is linked');
});

test('the shared stylesheet handles reduced motion and focus', () => {
  const css = readFileSync(join(new URL('site/', root).pathname, 'styles.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
