import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPVIEW_DID_DOCUMENT_URL,
  CHAT_DID_DOCUMENT_URL,
  SERVICE_HOSTS,
  plcDocumentUrl,
} from '../src/lib/serviceHosts.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';
import { CHAT_AUDIENCE, CHAT_SERVICE_DID } from '../src/lib/chatModel.ts';
import { plcDirectoryUrl } from '../src/lib/identityModel.ts';
import { VIDEO_SERVICE_DID, VIDEO_SERVICE_ENDPOINT } from '../src/lib/videoServiceProbe.ts';

test('one module owns every default AT Protocol host', () => {
  assert.equal(SERVICE_HOSTS.handleResolver, 'https://bsky.social');
  assert.equal(SERVICE_HOSTS.appviewAudience, 'did:web:api.bsky.app#bsky_appview');
  assert.equal(SERVICE_HOSTS.chatAudience, 'did:web:api.bsky.chat#bsky_chat');
  assert.equal(SERVICE_HOSTS.videoService, 'https://video.bsky.app');
  assert.equal(SERVICE_HOSTS.plcDirectory, 'https://plc.directory');
  assert.equal(APPVIEW_DID_DOCUMENT_URL, 'https://api.bsky.app/.well-known/did.json');
  assert.equal(CHAT_DID_DOCUMENT_URL, 'https://api.bsky.chat/.well-known/did.json');
});

test('every service default derives from the host module', () => {
  for (const key of Object.keys(SERVICE_HOSTS)) {
    assert.equal(DEFAULT_SERVICES[key], SERVICE_HOSTS[key], key);
  }
  assert.equal(CHAT_SERVICE_DID, SERVICE_HOSTS.chatDid);
  assert.equal(CHAT_AUDIENCE, SERVICE_HOSTS.chatAudience);
  assert.equal(VIDEO_SERVICE_ENDPOINT, SERVICE_HOSTS.videoService);
  assert.equal(VIDEO_SERVICE_DID, SERVICE_HOSTS.videoAudience);
});

test('the public directory helpers derive from the same host', () => {
  const did = 'did:plc:abc123';
  assert.equal(plcDocumentUrl(did), `https://plc.directory/${did}`);
  assert.equal(plcDirectoryUrl(did), 'https://plc.directory/did%3Aplc%3Aabc123');
  assert.equal(plcDocumentUrl('https://example.com'), null);
  assert.equal(plcDirectoryUrl('did:web:example.com'), null);
});
