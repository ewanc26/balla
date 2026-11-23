import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../.github/workflows/ci.yml');

test('CI installs from the committed lockfile and runs every local check', () => {
  const installs = [...workflow.matchAll(/run: npm ci --no-audit --no-fund/g)];
  assert.equal(installs.length, 3, 'typecheck, tests and site jobs must install from package-lock.json');
  assert.doesNotMatch(workflow, /run: npm install/, 'an unpinned install would make CI drift from the lockfile');

  for (const command of [
    'npx tsc --noEmit',
    'npx expo install --check',
    'npm audit --audit-level=moderate',
    'npm test',
    'npm run site:build',
    'python3 scripts/gen-icons.py --check',
  ]) {
    assert.ok(workflow.includes(command), `CI must run: ${command}`);
  }
});

test('the CI gate waits for every job', () => {
  for (const job of ['typecheck', 'tests', 'site', 'icons']) {
    assert.match(workflow, new RegExp(`^  ${job}:$`, 'm'), `${job} job is missing`);
  }

  const gate = workflow.slice(workflow.indexOf('  gate:'));
  assert.match(gate, /needs: \[typecheck, tests, site, icons\]/);
});

test('contributor docs and release notes describe the enforced checks', () => {
  const contributing = read('../CONTRIBUTING.md');
  const readme = read('../README.md');
  const changelog = read('../CHANGELOG.md');
  const pkg = JSON.parse(read('../package.json'));
  const app = JSON.parse(read('../app.json'));

  assert.match(contributing, /deterministic test\s+suite/);
  assert.match(contributing, /static-site build/);
  assert.match(contributing, /npm audit --audit-level=moderate/);
  assert.match(contributing, /npm test/);
  assert.match(contributing, /npm run site:build/);
  assert.match(
    readme,
    /typecheck, dependency\s+audit[^,]*,\s+deterministic test suite,\s+static-site build and icon sync/,
  );
  assert.match(readme, /npm audit --audit-level=moderate/);
  assert.match(changelog, new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')}$`, 'm'));
  assert.match(changelog, /CI now runs the deterministic test suite/);
  assert.equal(app.expo.version, pkg.version);
});
