import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WEB_BASE_PATH,
  WEB_LINKING_CONFIG,
  WEB_PREFIXES,
  webLinking,
} from '../src/lib/webLinking.ts';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

function declaredScreens(block) {
  return [...block.matchAll(/<Stack\.Screen\s+name="([A-Za-z]+)"/g)].map((match) => match[1]);
}

const stackBlock = appSource.slice(appSource.indexOf('<Stack.Navigator'), appSource.indexOf('</Stack.Navigator>'));
const tabBlock = appSource.slice(appSource.indexOf('<Tab.Navigator'), appSource.indexOf('</Tab.Navigator>'));
const stackScreens = declaredScreens(stackBlock);
const tabScreens = [...tabBlock.matchAll(/<Tab\.Screen\s+name="([A-Za-z]+)"/g)].map((match) => match[1]);

test('prefixes keep the /app base for both production and local web', () => {
  assert.equal(WEB_BASE_PATH, '/app');
  assert.deepEqual(WEB_PREFIXES, [
    'https://balla.croft.click/app',
    '/app',
  ]);
  assert.deepEqual(webLinking.prefixes, WEB_PREFIXES);
  assert.equal(webLinking.config, WEB_LINKING_CONFIG);
});

test('every stack screen has a web path, so none stays silently at /app', () => {
  const paths = WEB_LINKING_CONFIG.screens;
  assert.ok(stackScreens.length >= 20, `expected the full stack, found ${stackScreens.length} screens`);
  for (const name of stackScreens.filter((name) => name !== 'Tabs')) {
    assert.ok(Object.hasOwn(paths, name), `${name} is missing from the linking config`);
    assert.equal(typeof paths[name], 'string', `${name} has a path`);
    assert.ok(paths[name].length > 0, `${name} is not an empty path`);
  }
  assert.equal(typeof paths.Tabs, 'object', 'Tabs holds the nested tab paths');
});

test('every tab screen has a web path under Tabs', () => {
  const tabs = WEB_LINKING_CONFIG.screens.Tabs.screens;
  assert.deepEqual(Object.keys(tabs), tabScreens);
  assert.equal(tabs.Home, '');
  for (const name of tabScreens.filter((name) => name !== 'Home')) {
    assert.ok(tabs[name].length > 0, `${name} has a path`);
  }
});

test('no two screens claim the same path', () => {
  const paths = [
    ...Object.values(WEB_LINKING_CONFIG.screens).filter((value) => typeof value === 'string'),
    ...Object.values(WEB_LINKING_CONFIG.screens.Tabs.screens),
  ];
  assert.equal(new Set(paths).size, paths.length);
});

test('the address bar follows navigation on web only', () => {
  assert.match(appSource, /linking=\{Platform\.OS === 'web' \? webLinking : undefined\}/);
});

test('the host serves the SPA for nested /app paths', () => {
  const rewrites = vercel.rewrites || [];
  assert.ok(
    rewrites.some((rule) => rule.source === '/app/(.*)' && rule.destination === '/app'),
    'nested web routes must fall back to the app shell'
  );
  if (vercel.cleanUrls) {
    for (const rule of rewrites) {
      assert.doesNotMatch(rule.destination, /\.html$/, 'cleanUrls rewrites must not name an .html file');
    }
  }
});
