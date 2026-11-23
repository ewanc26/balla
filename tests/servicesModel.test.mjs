import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SERVICES,
  DEFAULT_SERVICES_CONFIG,
  SERVICE_SLOT_COPY,
  advertisedEndpoint,
  didWebUrl,
  effectivePlcDirectory,
  effectiveResolver,
  isDefaultPlcDirectory,
  isDefaultResolver,
  normaliseServicesConfig,
} from '../src/lib/servicesModel.ts';
import { probeResolver } from '../src/lib/servicesProbe.ts';

test('service defaults are the single source of truth for runtime hosts', () => {
  assert.equal(DEFAULT_SERVICES.handleResolver, 'https://bsky.social');
  assert.equal(DEFAULT_SERVICES.appviewAudience, 'did:web:api.bsky.app#bsky_appview');
  assert.equal(DEFAULT_SERVICES.chatAudience, 'did:web:api.bsky.chat#bsky_chat');
  assert.equal(DEFAULT_SERVICES.videoAudience, 'did:web:video.bsky.app');
  assert.equal(DEFAULT_SERVICES.plcDirectory, 'https://plc.directory');
  assert.deepEqual(DEFAULT_SERVICES_CONFIG, { handleResolver: null, plcDirectory: null });
});

test('only a non-default https host is persisted as an override', () => {
  assert.deepEqual(normaliseServicesConfig(null), { handleResolver: null, plcDirectory: null });
  assert.deepEqual(normaliseServicesConfig({ handleResolver: 'https://bsky.social' }), {
    handleResolver: null,
    plcDirectory: null,
  });
  assert.deepEqual(normaliseServicesConfig({ handleResolver: 'selfhosted.social' }), {
    handleResolver: 'https://selfhosted.social',
    plcDirectory: null,
  });
  assert.deepEqual(normaliseServicesConfig({ handleResolver: 'http://bad.example' }), {
    handleResolver: null,
    plcDirectory: null,
  });
  assert.deepEqual(normaliseServicesConfig({ handleResolver: 'https://bad.example/path' }), {
    handleResolver: null,
    plcDirectory: null,
  });
  assert.equal(effectiveResolver({ handleResolver: null }), 'https://bsky.social');
  assert.equal(effectiveResolver({ handleResolver: 'https://other.example' }), 'https://other.example');
  assert.equal(isDefaultResolver({ handleResolver: null }), true);
  assert.equal(isDefaultResolver({ handleResolver: 'https://other.example' }), false);
});

test('only a non-default https PLC directory is persisted as an override', () => {
  assert.deepEqual(normaliseServicesConfig({ plcDirectory: 'https://plc.directory' }), {
    handleResolver: null,
    plcDirectory: null,
  });
  assert.deepEqual(normaliseServicesConfig({ plcDirectory: 'plc.example' }), {
    handleResolver: null,
    plcDirectory: 'https://plc.example',
  });
  assert.deepEqual(normaliseServicesConfig({ plcDirectory: 'http://plc.example' }), {
    handleResolver: null,
    plcDirectory: null,
  });
  assert.deepEqual(normaliseServicesConfig({ plcDirectory: 'https://plc.example/path' }), {
    handleResolver: null,
    plcDirectory: null,
  });
  assert.equal(effectivePlcDirectory({ plcDirectory: null }), 'https://plc.directory');
  assert.equal(effectivePlcDirectory({ plcDirectory: 'https://plc.example' }), 'https://plc.example');
  assert.equal(isDefaultPlcDirectory({ plcDirectory: null }), true);
  assert.equal(isDefaultPlcDirectory({ plcDirectory: undefined }), true);
  assert.equal(isDefaultPlcDirectory({ plcDirectory: 'https://plc.example' }), false);
});

test('did:web maps to a hostname and optional path segments', () => {
  assert.equal(didWebUrl('did:web:api.bsky.app'), 'https://api.bsky.app');
  assert.equal(didWebUrl('did:web:example.com:user'), 'https://example.com/user');
  assert.equal(didWebUrl('did:web:selfhosted.social'), 'https://selfhosted.social');
  assert.equal(didWebUrl('did:plc:abc123'), null);
  assert.equal(didWebUrl('did:web: bad'), null);
});

test('service endpoints come from DID document structured fields', () => {
  const document = {
    service: [
      { id: '#other', type: 'OtherService', serviceEndpoint: 'https://other.test' },
      {
        id: '#bsky_appview',
        type: 'BskyAppView',
        serviceEndpoint: 'https://api.bsky.app',
      },
    ],
  };
  assert.equal(advertisedEndpoint(document, '#bsky_appview'), 'https://api.bsky.app');
  assert.equal(advertisedEndpoint(document, '#bsky_chat'), null);
  assert.equal(advertisedEndpoint(null, '#bsky_appview'), null);
});

test('every service slot is labelled with an honest constraint', () => {
  for (const [slot, copy] of Object.entries(SERVICE_SLOT_COPY)) {
    assert.ok(copy.label.length > 2, slot);
    assert.ok(copy.detail.length > 20, slot);
  }
  assert.match(SERVICE_SLOT_COPY.resolver.detail, /Changeable now/);
  assert.match(SERVICE_SLOT_COPY.plcDirectory.detail, /Changeable now/);
  assert.match(SERVICE_SLOT_COPY.plcDirectory.detail, /did:plc/);
  assert.match(SERVICE_SLOT_COPY.appview.detail, /Grant-bound/);
  assert.match(SERVICE_SLOT_COPY.pds.detail, /DID document/);
});

test('resolver probe rejects invalid endpoints without a network call', async () => {
  const result = await probeResolver('http://insecure.example');
  assert.equal(result.state, 'invalid');
  assert.equal(result.status, null);
  assert.match(result.detail, /https host/);
});
