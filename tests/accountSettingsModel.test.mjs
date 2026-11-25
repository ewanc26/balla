import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLUESKY_ACCOUNT_SETTINGS,
  BLUESKY_APP_PASSWORDS,
  BLUESKY_PRIVACY_SETTINGS,
  BOT_LABEL,
  LOGGED_OUT_PRIVACY_LABEL,
  SELF_LABELS_TYPE,
  controlPanelFailureText,
  isBlueskyService,
  profileHasSelfLabel,
  profileViewWithSelfLabel,
  providerControlPanelUrl,
  providerLinkDetail,
  providerOwnedPanelText,
  readBirthDate,
  readSessionSummary,
  validateBirthDate,
  withSelfLabel,
} from '../src/lib/accountSettingsModel.ts';

test('session summary exposes only non-secret OAuth metadata', () => {
  const summary = readSessionSummary({
    sub: 'did:plc:example',
    iss: 'https://bsky.social',
    aud: 'https://bsky.social',
    scope: 'atproto rpc:app.bsky.actor.getPreferences',
    expiresAt: new Date('2026-11-22T12:00:00.000Z'),
    access_token: 'do-not-show',
    refresh_token: 'do-not-show',
  });
  assert.deepEqual(summary, {
    did: 'did:plc:example',
    authorizationServer: 'https://bsky.social',
    resourceServer: 'https://bsky.social',
    expiresAt: '2026-11-22T12:00:00.000Z',
    scopeCount: 2,
  });
  assert.equal(JSON.stringify(summary).includes('do-not-show'), false);
  assert.equal(readSessionSummary(null), null);
});

test('self labels toggle without dropping unrelated labels or writing moderation labels', () => {
  const record = {
    $type: 'app.bsky.actor.profile',
    displayName: 'Balla',
    labels: {
      $type: SELF_LABELS_TYPE,
      values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'other' }],
    },
  };
  const added = withSelfLabel(record, BOT_LABEL, true);
  assert.deepEqual(
    added.labels.values.map((item) => item.val),
    ['other', 'bot']
  );
  assert.equal(record.labels.values.length, 1);

  const removed = withSelfLabel(added, BOT_LABEL, false);
  assert.deepEqual(
    removed.labels.values.map((item) => item.val),
    ['other']
  );
  assert.equal(withSelfLabel({}, LOGGED_OUT_PRIVACY_LABEL, false).labels, undefined);
});

test('self-label state reads only labels owned by the account', () => {
  const profile = {
    did: 'did:plc:me',
    labels: [
      { val: 'bot', src: 'did:plc:me' },
      { val: 'spam', src: 'did:plc:labeler' },
    ],
  };
  assert.equal(profileHasSelfLabel(profile, BOT_LABEL), true);
  assert.equal(profileHasSelfLabel(profile, LOGGED_OUT_PRIVACY_LABEL), false);
  assert.equal(profileHasSelfLabel(profile, 'spam'), false);
  assert.equal(profileHasSelfLabel(null, BOT_LABEL), false);
});

test('optimistic profile state keeps third-party labels intact', () => {
  const profile = {
    did: 'did:plc:me',
    labels: [
      { val: 'bot', src: 'did:plc:me' },
      { val: 'spam', src: 'did:plc:labeler' },
    ],
  };
  const next = profileViewWithSelfLabel(profile, BOT_LABEL, false);
  assert.deepEqual(next.labels, [{ val: 'spam', src: 'did:plc:labeler' }]);

  const added = profileViewWithSelfLabel(profile, LOGGED_OUT_PRIVACY_LABEL, true);
  assert.deepEqual(added.labels, [
    { val: 'bot', src: 'did:plc:me' },
    { val: 'spam', src: 'did:plc:labeler' },
    { $type: 'com.atproto.label.defs#selfLabel', val: LOGGED_OUT_PRIVACY_LABEL, src: 'did:plc:me' },
  ]);
});

test('birthdays are real, past calendar dates and can be cleared', () => {
  assert.equal(readBirthDate({ birthDate: new Date('1990-05-02T00:00:00Z') }), '1990-05-02');
  assert.equal(readBirthDate({ birthDate: 'not-a-date' }), '');
  assert.deepEqual(validateBirthDate(' 1990-05-02 '), { ok: true, value: '1990-05-02' });
  assert.deepEqual(validateBirthDate(''), { ok: true, value: '' });
  assert.deepEqual(validateBirthDate('02/05/1990'), {
    ok: false,
    error: 'Use a date in YYYY-MM-DD format.',
  });
  assert.deepEqual(validateBirthDate('2026-02-30'), {
    ok: false,
    error: 'Enter a real date that is not in the future.',
  });
  assert.equal(validateBirthDate('2999-01-01').ok, false);
});

test('provider links are only described as authoritative for bsky.social', () => {
  assert.equal(isBlueskyService('https://bsky.social'), true);
  assert.equal(isBlueskyService('https://api.eurosky.network'), false);
  assert.equal(isBlueskyService('https://pds.example.com'), false);
  assert.match(providerLinkDetail('https://bsky.social', 'account'), /correct/);
  assert.match(providerLinkDetail('https://pds.example.com', 'account'), /another provider/);
  assert.match(BLUESKY_ACCOUNT_SETTINGS, /bsky\.app\/settings\/account/);
  assert.match(BLUESKY_PRIVACY_SETTINGS, /privacy-and-security/);
  assert.match(BLUESKY_APP_PASSWORDS, /app-passwords/);
});

test('provider-owned panels stay closed unless the session proves bsky.social', () => {
  assert.equal(
    providerControlPanelUrl('https://bsky.social', BLUESKY_ACCOUNT_SETTINGS),
    BLUESKY_ACCOUNT_SETTINGS
  );
  assert.equal(providerControlPanelUrl('https://alice.bsky.social', BLUESKY_ACCOUNT_SETTINGS), BLUESKY_ACCOUNT_SETTINGS);
  assert.equal(providerControlPanelUrl('https://pds.example.com', BLUESKY_ACCOUNT_SETTINGS), null);
  assert.equal(providerControlPanelUrl('https://api.eurosky.network', BLUESKY_ACCOUNT_SETTINGS), null);
  assert.equal(providerControlPanelUrl('', BLUESKY_ACCOUNT_SETTINGS), null);

  const blueskyFailure = controlPanelFailureText(
    'https://bsky.social',
    'account settings',
    BLUESKY_ACCOUNT_SETTINGS
  );
  assert.equal(blueskyFailure, 'Could not open account settings. Visit bsky.app/settings/account in a browser.');

  const otherFailure = controlPanelFailureText(
    'https://pds.example.com',
    'account settings',
    BLUESKY_ACCOUNT_SETTINGS
  );
  assert.doesNotMatch(otherFailure, /bsky/);
  assert.match(otherFailure, /provider’s control panel/);
  assert.match(otherFailure, /cannot infer its address/);

  assert.match(providerOwnedPanelText('account settings'), /another provider/);
  assert.match(providerOwnedPanelText('account settings'), /cannot infer its address/);
  assert.doesNotMatch(providerOwnedPanelText('account settings'), /bsky/);
});
