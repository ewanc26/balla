import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  actionLabel,
  appealReference,
  appealSummary,
  describeSubject,
  enforcementLabel,
  formatModerationDate,
  isSafeHttpUrl,
  noticeTitle,
  reportActionLabel,
  reportReasonLabel,
  standingLabel,
  subjectLabel,
  subjectWebUrl,
} from '../src/lib/moderationInboxModel.ts';

const POST = {
  uri: 'at://did:plc:alice/app.bsky.feed.post/3kabc',
  cid: 'bafy-post',
};

test('subject parsing distinguishes posts, accounts and lists', () => {
  assert.equal(describeSubject(POST).kind, 'post');
  assert.equal(describeSubject(POST).did, 'did:plc:alice');
  assert.equal(describeSubject({ did: 'did:plc:alice' }).kind, 'account');
  assert.equal(
    describeSubject({ uri: 'at://did:plc:alice/app.bsky.graph.list/3klist' })
      .kind,
    'list'
  );
  assert.equal(subjectLabel(POST, 'notice'), 'Your post');
  assert.equal(subjectLabel({ did: 'did:plc:alice' }, 'report'), 'Account');
});

test('subject links use the public Bluesky paths', () => {
  assert.equal(
    subjectWebUrl(POST),
    'https://bsky.app/profile/did:plc:alice/post/3kabc'
  );
  assert.equal(
    subjectWebUrl({ did: 'did:plc:alice' }),
    'https://bsky.app/profile/did:plc:alice'
  );
  assert.equal(subjectWebUrl({ convoId: 'convo-1' }), undefined);
});

test('known report reasons and actions are translated, unknown values are not invented', () => {
  assert.equal(
    reportReasonLabel('com.atproto.moderation.defs#reasonSpam'),
    'Spam'
  );
  assert.equal(reportReasonLabel('example.unknown#reason'), 'Unknown report reason');
  assert.equal(actionLabel('contentRemoved'), 'Content removed');
  assert.equal(actionLabel('futureAction'), 'Moderation action');
});

test('report status labels follow service state and resolution', () => {
  assert.equal(
    reportActionLabel({ status: 'pending' }),
    'Awaiting review'
  );
  assert.equal(
    reportActionLabel({ status: 'resolved', resolutionOutcome: 'noAction' }),
    'Reviewed, no action taken'
  );
  assert.equal(
    reportActionLabel({
      status: 'resolved',
      lastActionTaken: 'contentRemoved',
    }),
    'Content removed'
  );
});

test('appeal references use an action, or a takedown for suspended accounts', () => {
  const action = {
    id: 41,
    type: 'contentRemoved',
    createdAt: '2026-11-20T10:00:00.000Z',
  };
  assert.deepEqual(appealReference({ subject: POST }, action), {
    $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
    id: 41,
  });
  assert.deepEqual(
    appealReference(
      {
        subject: { did: 'did:plc:alice' },
        enforcement: { state: 'suspended' },
      },
      undefined
    ),
    {
      $type: 'tools.ozone.inbox.appealActionedSubject#takedownRef',
    }
  );
});

test('a newer action supersedes an older appeal label', () => {
  const data = {
    subject: POST,
    appeal: {
      state: 'resolved',
      outcome: 'approved',
      resolvedAt: '2026-11-20T10:00:00.000Z',
    },
    actions: [
      {
        id: 8,
        type: 'contentRemoved',
        createdAt: '2026-11-21T10:00:00.000Z',
      },
    ],
  };
  assert.equal(appealSummary(data).label, 'Previous appeal approved');
  assert.equal(noticeTitle(data), 'Your post was removed');
});

test('notice titles reflect appeals, suspensions and removed posts', () => {
  assert.equal(
    noticeTitle({
      subject: POST,
      appeal: { state: 'pending' },
      actions: [],
    }),
    'Appeal under review'
  );
  assert.equal(
    noticeTitle({
      subject: POST,
      appeal: { state: 'resolved', outcome: 'approved' },
      actions: [],
    }),
    'Appeal approved'
  );
  assert.equal(
    noticeTitle({
      subject: { did: 'did:plc:alice' },
      enforcement: { state: 'takendown' },
      actions: [],
    }),
    'Your account is suspended'
  );
  assert.equal(
    noticeTitle({
      subject: POST,
      actions: [{ type: 'contentRemoved', createdAt: '2026-11-20T10:00:00Z' }],
    }),
    'Your post was removed'
  );
});

test('standing and enforcement never turn unknown API values into a clean bill', () => {
  assert.equal(standingLabel('good').label, 'Account in good standing');
  assert.equal(standingLabel('atRisk').tone, 'danger');
  assert.equal(standingLabel('futureStanding').label, 'Account standing: futureStanding');
  assert.equal(enforcementLabel(undefined), 'Enforcement not supplied');
  assert.equal(enforcementLabel('futureState'), 'Enforcement: futureState');
});

test('formatting and policy-link checks reject invalid values', () => {
  assert.equal(formatModerationDate('not-a-date'), '');
  assert.equal(isSafeHttpUrl('https://bsky.social/about/support/community-guidelines'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
});

test('the moderation inbox scope is exact and contains no wildcards', () => {
  const metadata = JSON.parse(
    readFileSync(new URL('../oauth-client-metadata.json', import.meta.url), 'utf8')
  );
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 98);
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
  for (const method of [
    'listReports',
    'getReport',
    'listActionedSubjects',
    'getActionedSubject',
    'getUnreadCount',
    'getAccountStatus',
    'updateSeen',
    'appealActionedSubject',
  ]) {
    assert.equal(
      tokens.includes(
        `rpc:tools.ozone.inbox.${method}?aud=did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler`
      ),
      true,
      method
    );
  }
});
