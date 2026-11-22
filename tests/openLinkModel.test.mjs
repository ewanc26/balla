import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isHttpUrl,
  isSystemOnlyUrl,
  needsBrowserConsent,
  shouldUseInAppBrowser,
} from '../src/lib/openLinkModel.ts';

test('mailto, tel and sms always bypass the in-app browser', () => {
  for (const url of ['mailto:a@example.com', 'tel:+123', 'sms:+123']) {
    assert.equal(isSystemOnlyUrl(url), true);
    assert.equal(shouldUseInAppBrowser(url, true), false);
    assert.equal(needsBrowserConsent(url, undefined), false);
  }
});

test('an unset preference asks once for http links', () => {
  assert.equal(needsBrowserConsent('https://example.com', undefined), true);
  assert.equal(needsBrowserConsent('https://example.com', true), false);
  assert.equal(needsBrowserConsent('https://example.com', false), false);
  assert.equal(shouldUseInAppBrowser('https://example.com', undefined), false);
});

test('a true preference opens http links in-app, false uses the system', () => {
  assert.equal(shouldUseInAppBrowser('http://example.com/x', true), true);
  assert.equal(shouldUseInAppBrowser('http://example.com/x', false), false);
  assert.equal(shouldUseInAppBrowser('http://example.com/x', undefined), false);
});

test('only http(s) urls are eligible for the in-app browser', () => {
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('  HTTPS://example.com'), true);
  assert.equal(isHttpUrl('mailto:a@example.com'), false);
  assert.equal(isHttpUrl('bsky://profile'), false);
});
