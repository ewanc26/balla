import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exactStatCount,
  fuzzedStatCount,
  statCountsForRow,
} from '../src/lib/statCountModel.ts';

test('exact counts are non-negative integers grouped with commas', () => {
  assert.equal(exactStatCount(0), '0');
  assert.equal(exactStatCount(999), '999');
  assert.equal(exactStatCount(1234), '1,234');
  assert.equal(exactStatCount(1234567), '1,234,567');
  assert.equal(exactStatCount(12.9), '12');
  assert.equal(exactStatCount(-5), '0');
});

test('fuzzed counts keep at most three significant characters', () => {
  assert.equal(fuzzedStatCount(0), '0');
  assert.equal(fuzzedStatCount(999), '999');
  assert.equal(fuzzedStatCount(1000), '1k');
  assert.equal(fuzzedStatCount(1234), '1.2k');
  assert.equal(fuzzedStatCount(12349), '12k');
  assert.equal(fuzzedStatCount(999999), '1M');
  assert.equal(fuzzedStatCount(1500000), '1.5M');
  assert.equal(fuzzedStatCount(12345678), '12M');
  assert.equal(fuzzedStatCount(999999999), '1B');
});

test('a roomy window keeps every count exactly as written', () => {
  assert.deepEqual(
    statCountsForRow({ posts: 9665, following: 123, followers: 1234567 }, 800),
    { posts: '9,665', following: '123', followers: '1,234,567' }
  );
});

test('the widest count fuzzes first and leaves smaller neighbours exact', () => {
  assert.deepEqual(
    statCountsForRow({ posts: 9665, following: 123, followers: 1234567 }, 390),
    { posts: '9,665', following: '123', followers: '1.2M' }
  );
});

test('when one fuzz is not enough, the next widest follows', () => {
  assert.deepEqual(
    statCountsForRow({ posts: 9665, following: 12345, followers: 123456 }, 320),
    { posts: '9.7k', following: '12k', followers: '123k' }
  );
});

test('a small profile keeps plain digits on a phone window', () => {
  assert.deepEqual(
    statCountsForRow({ posts: 4, following: 12, followers: 174 }, 390),
    { posts: '4', following: '12', followers: '174' }
  );
});
