import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIGN_IN_FALLBACK,
  LABELER_FALLBACK,
  classifyStructuredFailure,
  hasErrorCode,
  isAuthFailure,
  isExpoOAuthCancellation,
  isInvalidSwapError,
  isRecordNotFoundError,
  labelerFailureCopy,
  labelerInputError,
  signInFailureCopy,
  structuredFailureCopy,
} from '../src/lib/failureCopyModel.ts';
import { listActionError } from '../src/lib/listModel.ts';
import { starterPackActionError } from '../src/lib/starterPackModel.ts';
import { chatErrorCopy, chatFailureFrom } from '../src/lib/chatModel.ts';
import {
  VIDEO_JOB_FAILURE,
  videoJobFailureCopy,
  videoUploadErrorCopy,
} from '../src/lib/videoFailureModel.ts';
import {
  describeVideoJob,
  normaliseVideoJobStatus,
  videoStatusFromUpload,
} from '../src/lib/videoModel.ts';
import { classifyFailure, describeFailure } from '../src/lib/reliability.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const HOSTILE = 'Provider prose: use card 4111111111111111 at evil.example or trust our message';

test('sign-in copy uses only local cancellation sentinels and structured fields', () => {
  assert.equal(isExpoOAuthCancellation(new Error('Authentication cancelled: cancel')), true);
  assert.equal(isExpoOAuthCancellation(new Error('Authentication cancelled: dismiss')), true);
  assert.equal(isExpoOAuthCancellation(new Error('Authentication cancelled: locked')), true);
  assert.equal(signInFailureCopy(new Error('Authentication cancelled: cancel')), null);
  assert.equal(signInFailureCopy(new Error(HOSTILE)), SIGN_IN_FALLBACK);
  assert.equal(
    signInFailureCopy(new Error(`Authentication cancelled: cancel ${HOSTILE}`)),
    SIGN_IN_FALLBACK
  );
  assert.equal(
    signInFailureCopy({ status: 401, message: HOSTILE }),
    'Your session needs renewing. Sign out, sign in again, then retry.'
  );
});

test('structured failure copy never echoes hostile provider prose', () => {
  assert.match(structuredFailureCopy({ status: 429 }, 'fallback'), /limiting requests/);
  assert.match(structuredFailureCopy({ error: 'TooManyRequests' }, 'fallback'), /limiting requests/);
  assert.match(structuredFailureCopy({ status: 1 }, 'fallback'), /reach the service/);
  assert.match(structuredFailureCopy({ error: 'NetworkError' }, 'fallback'), /reach the service/);
  assert.match(
    structuredFailureCopy({ status: 403 }, 'fallback'),
    /session needs renewing/
  );
  assert.match(structuredFailureCopy({ status: 502 }, 'fallback'), /having trouble/);
  for (const err of [{ message: HOSTILE }, new Error(HOSTILE), { error: HOSTILE }]) {
    const copy = structuredFailureCopy(err, 'fallback');
    assert.equal(copy.includes(HOSTILE), false);
    assert.equal(copy === 'fallback' || copy.length < 100, true);
  }
});

test('reliability classification reads codes, not provider prose', () => {
  assert.equal(classifyFailure({ error: 'RateLimitExceeded' }), 'rate-limited');
  assert.equal(classifyFailure({ error: 'NetworkError' }), 'offline');
  assert.equal(classifyFailure({ code: 'InsufficientScope' }), 'auth-expired');
  assert.equal(classifyFailure({ error: 'ServiceUnavailable' }), 'server');
  assert.equal(classifyFailure(new Error(HOSTILE)), 'unknown');
  assert.equal(classifyFailure({ message: HOSTILE }), 'unknown');
  assert.equal(describeFailure(new Error(HOSTILE), 'fallback'), 'fallback');
});

test('auth classification is structured-only for profile and report errors', () => {
  assert.equal(isAuthFailure({ status: 401 }), true);
  assert.equal(isAuthFailure({ error: 'AuthRequired' }), true);
  assert.equal(isAuthFailure({ code: 'InsufficientScope' }), true);
  assert.equal(isAuthFailure(new Error(HOSTILE)), false);
  assert.equal(isAuthFailure({ message: HOSTILE }), false);
  assert.equal(isAuthFailure({ error: `${HOSTILE} insufficient scope` }), false);
});

test('structured codes are exact allowlisted fields, not hostile prose', () => {
  assert.equal(hasErrorCode({ error: 'InvalidSwap', message: HOSTILE }, ['InvalidSwap']), true);
  assert.equal(hasErrorCode({ code: 'invalid swap', message: HOSTILE }, ['InvalidSwap']), false);
  assert.equal(hasErrorCode({ message: 'InvalidSwap' }, ['InvalidSwap']), false);
  assert.equal(hasErrorCode(new Error('InvalidSwap'), ['InvalidSwap']), false);
  assert.equal(classifyStructuredFailure({ error: 'TooManyRequests', message: HOSTILE }), 'rate-limited');
  assert.equal(classifyStructuredFailure({ message: `${HOSTILE} network` }), 'unknown');
});

test('list and starter-pack auth copy ignores provider prose', () => {
  const listCopy = listActionError({ code: 'InsufficientScope', message: HOSTILE }, 'Try again.');
  assert.match(listCopy, /Sign out, sign in again/);
  assert.equal(listCopy.includes(HOSTILE), false);
  assert.equal(listActionError({ message: `${HOSTILE} insufficient scope` }, 'Try again.'), 'Try again.');
  assert.equal(listActionError(new Error('insufficient scope'), 'Try again.'), 'Try again.');

  const packCopy = starterPackActionError(
    { status: 403, message: `${HOSTILE} forbidden` },
    'Fallback'
  );
  assert.match(packCopy, /Sign out, sign in again/);
  assert.equal(packCopy.includes(HOSTILE), false);
  assert.equal(
    starterPackActionError({ message: `${HOSTILE} forbidden` }, 'Fallback'),
    'Fallback'
  );
});

test('record-not-found retry control uses only status and structured codes', () => {
  assert.equal(
    isRecordNotFoundError({ status: 400, error: 'RecordNotFound', message: HOSTILE }),
    true
  );
  assert.equal(isRecordNotFoundError({ status: 404, code: 'NotFound', message: HOSTILE }), true);
  assert.equal(isRecordNotFoundError({ status: 404, message: 'RecordNotFound' }), false);
  assert.equal(isRecordNotFoundError({ status: 400, error: `${HOSTILE} RecordNotFound` }), false);
  assert.equal(isRecordNotFoundError({ error: 'RecordNotFound' }), false);
  assert.equal(isRecordNotFoundError(new Error('RecordNotFound')), false);
});

test('chat failure copy ignores messages and classifies only published codes', () => {
  assert.equal(chatFailureFrom({ error: 'MessagesDisabled', message: HOSTILE }), 'disabled');
  assert.equal(chatFailureFrom({ error: 'BlockedActor', message: HOSTILE }), 'blocked');
  assert.equal(chatFailureFrom({ error: 'RecipientNotFound', message: HOSTILE }), 'not-found');
  assert.equal(chatFailureFrom({ error: 'ConvoLockedByModeration', message: HOSTILE }), 'locked');
  assert.equal(chatFailureFrom({ error: 'NetworkError', message: HOSTILE }), 'offline');
  assert.equal(chatFailureFrom({ message: 'offline' }), 'unknown');
  assert.equal(chatFailureFrom(new Error('offline')), 'unknown');
  assert.equal(chatFailureFrom({ error: `${HOSTILE} blocked` }), 'unknown');
  const copy = chatErrorCopy({ error: 'BlockedActor', message: HOSTILE });
  assert.match(copy, /block/);
  assert.equal(copy.includes(HOSTILE), false);
});

test('live-status compare-and-swap and deletion use exact structured codes', () => {
  assert.equal(isInvalidSwapError({ error: 'InvalidSwap', message: HOSTILE }), true);
  assert.equal(isInvalidSwapError({ status: 400, code: 'InvalidSwap', message: HOSTILE }), true);
  assert.equal(isInvalidSwapError({ message: 'InvalidSwap' }), false);
  assert.equal(isInvalidSwapError({ error: `${HOSTILE} InvalidSwap` }), false);
  assert.equal(isRecordNotFoundError({ status: 404, error: 'RecordNotFound', message: HOSTILE }), true);
  assert.equal(isRecordNotFoundError({ status: 404, message: 'Could not find record' }), false);
});

test('labeler failures use fixed copy for allowlisted codes and hostile prose falls back', () => {
  assert.equal(
    labelerFailureCopy(labelerInputError('default_subscribed')),
    'The moderation service is already subscribed.'
  );
  assert.equal(
    labelerFailureCopy(labelerInputError('already_subscribed')),
    'That labeler is already subscribed.'
  );
  assert.equal(
    labelerFailureCopy(labelerInputError('unreachable')),
    'Could not verify that DID as a reachable labeler.'
  );
  assert.equal(
    labelerFailureCopy({ error: 'Already_Subscribed', message: HOSTILE }),
    'That labeler is already subscribed.'
  );
  assert.equal(labelerFailureCopy(new Error(HOSTILE)), LABELER_FALLBACK);
});

test('video upload errors never return the provider message field', () => {
  assert.equal(videoUploadErrorCopy({ error: 'other', message: HOSTILE }, 400, 'fallback'), 'fallback');
  assert.equal(
    videoUploadErrorCopy({ error: 'Unconfirmed_Email', message: HOSTILE }, 400, 'fallback'),
    'The video service needs a verified email address before this account can upload video.'
  );
  assert.equal(
    videoUploadErrorCopy({ error: 'already_exists', blob: { $link: 'bafy' }, message: HOSTILE }, 409, 'fallback'),
    'This video was uploaded before. Balla is using its existing result.'
  );
  assert.equal(videoJobFailureCopy(), VIDEO_JOB_FAILURE);
});

test('video job status is allowlisted, so hostile messages reach neither state nor copy', () => {
  const status = normaliseVideoJobStatus({
    jobId: 'job-1',
    state: 'JOB_STATE_FAILED',
    progress: 0.4,
    failureCode: 'BAD_CODEC',
    message: HOSTILE,
    secret: 'must not travel',
  });
  assert.deepEqual(status, {
    jobId: 'job-1',
    state: 'JOB_STATE_FAILED',
    progress: 0.4,
    failureCode: 'BAD_CODEC',
  });
  assert.equal(JSON.stringify(status).includes(HOSTILE), false);
  const copy = describeVideoJob(status);
  assert.equal(copy, VIDEO_JOB_FAILURE);
  assert.equal(copy.includes(HOSTILE), false);

  const reused = videoStatusFromUpload({
    jobStatus: { error: 'already_exists', blob: { $link: 'bafy' }, message: HOSTILE },
  });
  assert.deepEqual(reused, { state: 'JOB_STATE_COMPLETED', blob: { $link: 'bafy' } });
  assert.equal(JSON.stringify(reused).includes(HOSTILE), false);
  assert.equal(videoStatusFromUpload({ message: 'already_exists' }), null);
});

test('no audited source reads, logs or stores provider error prose', () => {
  const reliability = read('../src/lib/reliability.ts');
  const moderation = read('../src/lib/moderationInbox.ts');
  const editProfile = read('../src/screens/EditProfileScreen.tsx');
  const profileMenu = read('../src/components/ProfileMenu.tsx');
  const login = read('../src/screens/LoginScreen.tsx');
  const agent = read('../src/lib/agent.ts');
  const contentFilters = read('../src/screens/ContentFiltersScreen.tsx');
  const videoUpload = read('../src/lib/videoUpload.ts');
  const listModel = read('../src/lib/listModel.ts');
  const starterPackModel = read('../src/lib/starterPackModel.ts');
  const chatModel = read('../src/lib/chatModel.ts');
  const liveStatus = read('../src/lib/liveStatus.ts');

  assert.doesNotMatch(reliability, /messageOf|err\.message|String\(err\)/);
  assert.doesNotMatch(moderation, /err\.message|String\(err\)/);
  assert.doesNotMatch(editProfile, /err\.message|String\(err\)/);
  assert.doesNotMatch(profileMenu, /err\.message|String\(err\)/);
  assert.doesNotMatch(login, /console\.(warn|error|log)\([^\n]*err/);
  assert.match(login, /signInFailureCopy\(err\)/);
  assert.match(agent, /console\.warn\('Balla OAuth callback failed'\)/);
  assert.doesNotMatch(agent, /console\.(warn|error|log)\([^\n]*err/);
  assert.doesNotMatch(contentFilters, /err\.message/);
  assert.match(contentFilters, /labelerFailureCopy\(err\)/);
  assert.doesNotMatch(videoUpload, /body\.message|status\.message|\.message \|\|/);
  assert.match(videoUpload, /videoUploadErrorCopy\(body, response\.status, fallback\)/);

  assert.doesNotMatch(listModel, /cause\.message|String\(cause/);
  assert.match(listModel, /isAuthFailure\(cause\)/);
  assert.doesNotMatch(starterPackModel, /\.message|String\(cause/);
  assert.match(starterPackModel, /isRecordNotFoundError/);
  assert.match(starterPackModel, /isAuthFailure\(cause\)/);
  assert.doesNotMatch(chatModel, /err as any|\?\.message|String\(raw/);
  assert.match(chatModel, /hasErrorCode\(err/);
  assert.doesNotMatch(liveStatus, /err\?\.message|String\(err/);
  assert.match(liveStatus, /isInvalidSwapError\(err\)/);
  assert.match(liveStatus, /isRecordNotFoundError\(err\)/);
});
