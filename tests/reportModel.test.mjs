import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_REPORT_RECEIPTS,
  REPORT_REASONS,
  appendReceipt,
  normaliseReceipts,
  reasonLabel,
} from '../src/lib/reportModel.ts';

const receipt = (id, subjectKind = 'list') => ({
  id,
  createdAt: '2026-11-21T12:00:00.000Z',
  reasonType: 'com.atproto.moderation.defs#reasonSpam',
  subjectKind,
  subjectLabel: `List ${id}`,
  subjectUri: `at://did:plc:example/app.bsky.graph.list/${id}`,
});

test('report categories are the published Bluesky reason types', () => {
  const values = REPORT_REASONS.map((item) => item.value);
  assert.equal(values.length, 6);
  assert.ok(values.every((value) => value.startsWith('com.atproto.moderation.defs#reason')));
  assert.equal(new Set(values).size, values.length);
  assert.ok(REPORT_REASONS.every((item) => item.label && item.detail));
  assert.equal(reasonLabel(values[0]), REPORT_REASONS[0].label);
  assert.equal(reasonLabel('made.up#reason'), 'Report');
});

test('malformed and duplicate stored receipts are discarded', () => {
  assert.deepEqual(normaliseReceipts(null), []);
  assert.deepEqual(normaliseReceipts({ id: 1 }), []);
  const mixed = [
    receipt(1),
    { ...receipt(1), subjectLabel: 'Duplicate' },
    { ...receipt(2), id: 'two' },
    { ...receipt(3), subjectKind: 'unknown' },
    { ...receipt(4), subjectLabel: '   ' },
    { ...receipt(5), subjectLabel: '  Trimmed  ' },
  ];
  const result = normaliseReceipts(mixed);
  assert.deepEqual(result.map((item) => item.id), [1, 5]);
  assert.equal(result[1].subjectLabel, 'Trimmed');
});

test('new receipts go first and the local history stays bounded', () => {
  const many = Array.from({ length: MAX_REPORT_RECEIPTS }, (_, i) => receipt(i));
  const next = appendReceipt(many, receipt(999, 'post'));
  assert.equal(next.length, MAX_REPORT_RECEIPTS);
  assert.equal(next[0].id, 999);
  assert.equal(next[0].subjectKind, 'post');
  assert.ok(!next.some((item) => item.id === MAX_REPORT_RECEIPTS - 1));
});

test('feed receipts are accepted with the same strong-ref rules as list receipts', () => {
  const stored = normaliseReceipts([receipt(11, 'feed')]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].subjectKind, 'feed');
  assert.deepEqual(normaliseReceipts([{ ...receipt(12), subjectKind: 'feed-generator' }]), []);
});

test('chat report kinds are accepted and normalised like any other receipt', () => {
  for (const kind of ['chat-message', 'chat-convo']) {
    const stored = normaliseReceipts([receipt(10, kind)]);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].subjectKind, kind);
    assert.ok(!('text' in stored[0]));
  }
  const mixed = normaliseReceipts([
    receipt(11, 'chat-message'),
    receipt(12, 'chat-convo'),
  ]);
  assert.deepEqual(mixed.map((item) => item.subjectKind), ['chat-message', 'chat-convo']);
});
