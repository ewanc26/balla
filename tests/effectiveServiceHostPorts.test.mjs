import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  normaliseHttpsOrigin,
  plcDocumentUrl,
} from '../src/lib/serviceHosts.ts';
import { plcDirectoryUrl } from '../src/lib/identityModel.ts';
import { normaliseHostUrl } from '../src/lib/hostingModel.ts';
import {
  DEFAULT_SERVICES,
  normaliseServicesConfig,
} from '../src/lib/servicesModel.ts';
import { parseServicesImport } from '../src/lib/servicesImportModel.ts';
import {
  buildServicesExport,
  serialiseServicesExport,
} from '../src/lib/servicesExportModel.ts';
import {
  probePlcDirectory,
  probeResolver,
} from '../src/lib/servicesProbe.ts';
import { probeAccount } from '../src/lib/accountPreflight.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DID = 'did:plc:3434wfandtk52wlqq4u5g72a';
const CANARY = DEFAULT_SERVICES.labelerDid;
const FIXED_TIME = '2026-11-25T05:00:00.000Z';
const PROVIDER_PROSE = 'provider said something untrusted';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('one origin rule keeps an explicit port and rejects off-origin input', () => {
  assert.equal(normaliseHttpsOrigin('plc.example:8443'), 'https://plc.example:8443');
  assert.equal(normaliseHttpsOrigin('https://plc.example:8443/'), 'https://plc.example:8443');
  assert.equal(normaliseHttpsOrigin('https://plc.example:443'), 'https://plc.example');
  assert.equal(normaliseHostUrl('plc.example:8443'), 'https://plc.example:8443');

  for (const input of [
    'https://plc.example:8443/path',
    'https://plc.example:8443?q=1',
    'https://plc.example:8443#x',
    'https://user@plc.example:8443',
    'http://plc.example:8443',
    'https://plc.example:bad',
    'https://plc.example:99999',
    'plc example:8443',
    '',
  ]) {
    assert.equal(normaliseHttpsOrigin(input), null, input);
  }
});

test('both did:plc document builders read the port-bearing directory', () => {
  const directory = 'plc.example:8443';
  const base = 'https://plc.example:8443';
  assert.equal(plcDocumentUrl(DID, directory), `${base}/${DID}`);
  assert.equal(plcDirectoryUrl(DID, directory), `${base}/${encodeURIComponent(DID)}`);
  assert.equal(plcDocumentUrl(DID, `${base}/path`), null);
  assert.equal(plcDirectoryUrl(DID, 'http://plc.example:8443'), null);
});

test('a port-bearing service choice survives normalisation and import', () => {
  const config = normaliseServicesConfig({
    handleResolver: 'resolver.example:9443',
    plcDirectory: 'plc.example:8443',
    places: 'places.example:7443',
    placesEnabled: false,
  });
  assert.deepEqual(config, {
    handleResolver: 'https://resolver.example:9443',
    plcDirectory: 'https://plc.example:8443',
    places: 'https://places.example:7443',
    placesEnabled: false,
  });

  const record = serialiseServicesExport(buildServicesExport(config, null, FIXED_TIME));
  const parsed = parseServicesImport(record);
  assert.equal(parsed.state, 'ok');
  assert.deepEqual(parsed.config, config);

  const hostile = JSON.parse(record);
  hostile.changeable.plcDirectory = 'https://plc.example:8443/path';
  assert.equal(parseServicesImport(JSON.stringify(hostile)).state, 'invalid');
});

test('public resolver and directory checks use the saved explicit port', async () => {
  const resolverCalls = [];
  const resolver = await probeResolver('resolver.example:9443', {
    fetchImpl: async (url, init) => {
      resolverCalls.push({ url, init });
      return jsonResponse({ did: DID, message: PROVIDER_PROSE });
    },
  });
  assert.equal(resolver.state, 'ok');
  assert.equal(resolver.endpoint, 'https://resolver.example:9443');
  assert.equal(resolverCalls.length, 1);
  assert.match(
    resolverCalls[0].url,
    /^https:\/\/resolver\.example:9443\/xrpc\/com\.atproto\.identity\.resolveHandle\?handle=/
  );
  assert.doesNotMatch(JSON.stringify(resolver), /untrusted/i, 'provider prose is not copied into probe state');

  const directoryCalls = [];
  const directory = await probePlcDirectory('plc.example:8443', {
    fetchImpl: async (url, init) => {
      directoryCalls.push({ url, init });
      return jsonResponse({ id: CANARY, message: PROVIDER_PROSE });
    },
  });
  assert.equal(directory.state, 'ok');
  assert.equal(directory.endpoint, 'https://plc.example:8443');
  assert.equal(directoryCalls.length, 1);
  assert.equal(directoryCalls[0].url, `https://plc.example:8443/${CANARY}`);
  assert.doesNotMatch(JSON.stringify(directory), /untrusted/i, 'provider prose is not copied into probe state');
});

test('account pre-flight reads the DID document from a port-bearing directory', async () => {
  const PDS = 'https://selfhosted.social';
  const calls = [];
  const routes = {
    [`https://plc.example:8443/${DID}`]: JSON.stringify({
      service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }],
      message: PROVIDER_PROSE,
    }),
    [`${PDS}/xrpc/com.atproto.server.describeServer`]: JSON.stringify({ did: 'did:web:selfhosted.social' }),
    [`${PDS}/.well-known/oauth-protected-resource`]: JSON.stringify({
      resource: PDS,
      authorization_servers: [PDS],
    }),
    [`${PDS}/.well-known/oauth-authorization-server`]: JSON.stringify({
      issuer: PDS,
      authorization_endpoint: `${PDS}/oauth/authorize`,
      token_endpoint: `${PDS}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['atproto'],
      authorization_response_iss_parameter_supported: true,
      pushed_authorization_request_endpoint: `${PDS}/oauth/par`,
      dpop_signing_alg_values_supported: ['ES256'],
      client_id_metadata_document_supported: true,
    }),
  };
  const result = await probeAccount(DID, {
    plcDirectory: 'plc.example:8443',
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(routes[url] ?? '{}', { status: routes[url] ? 200 : 404 });
    },
  });

  assert.equal(result.state, 'ok');
  assert.equal(result.did, DID);
  assert.equal(calls[0], `https://plc.example:8443/${DID}`);
  assert.ok(!calls.some((url) => url.startsWith(DEFAULT_SERVICES.plcDirectory)), 'the compiled default is not read');
  assert.doesNotMatch(JSON.stringify(result), /untrusted/i, 'provider prose is not copied into pre-flight state');
});

test('one origin validator is shared by settings, identity reads and checks', () => {
  const hosts = read('../src/lib/serviceHosts.ts');
  const hosting = read('../src/lib/hostingModel.ts');
  const identity = read('../src/lib/identityModel.ts');
  const probe = read('../src/lib/servicesProbe.ts');
  const services = read('../src/lib/servicesModel.ts');
  const importer = read('../src/lib/servicesImportModel.ts');

  assert.match(hosts, /export function normaliseHttpsOrigin/);
  assert.match(hosts, /new URL\(withScheme\)/);
  assert.match(hosting, /import \{ normaliseHttpsOrigin \} from '\.\/serviceHosts\.ts'/);
  assert.match(hosting, /return normaliseHttpsOrigin\(input\);/);
  assert.doesNotMatch(hosting, /new URL\(withScheme\)/, 'the settings validator is not duplicated');
  assert.match(identity, /normaliseHttpsOrigin\(directory\)/);
  assert.match(probe, /normaliseHttpsOrigin\(endpoint\)/);
  assert.match(probe, /normaliseHttpsOrigin\(directory\)/);
  assert.match(services, /normaliseHostUrl\(value\)/);
  assert.match(importer, /normaliseHostUrl\(value\)/);
});

test('release documents the port fix honestly without changing the grant', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.88.0');
  assert.equal(appJson.expo.version, '0.88.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.88\.0<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /^## 0\.88\.0$/m);
  assert.match(changelog, /explicit HTTPS port/);
  assert.match(changelog, /#97\/#100, partial/);
  assert.match(read('../docs/bluesky-compliance.md'), /explicit HTTPS port/);
  assert.match(read('../site/features.html'), /explicit HTTPS port/);

  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
