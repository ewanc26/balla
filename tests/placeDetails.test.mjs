import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { placeDetailFields } from '../src/lib/placesModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sheet = read('../src/components/PlacePickerSheet.tsx');
const model = read('../src/lib/placesModel.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');
const metadataRaw = read('../oauth-client-metadata.json');

const URN = 'urn:atgeo:openstreetmap.org:node:30353086';

function hit(overrides = {}) {
  return {
    kind: 'place',
    origin: URN,
    name: 'Olympiastadion',
    category: 'Stadium',
    group: 'Sport',
    subtype: null,
    cityState: false,
    country: 'DE',
    match: 'start',
    matched: 'Olympia',
    ...overrides,
  };
}

test('detail fields come only from published structured facts', () => {
  assert.deepEqual(placeDetailFields(hit()), [
    { label: 'Type', value: 'Place' },
    { label: 'Category', value: 'Stadium' },
    { label: 'Group', value: 'Sport' },
    { label: 'Country', value: 'DE' },
    { label: 'Matched name', value: 'Olympia' },
    { label: 'Match', value: 'Start of name' },
    { label: 'Place ID', value: URN },
  ]);
  const serialised = JSON.stringify(placeDetailFields(hit()));
  assert.doesNotMatch(serialised, /lat|lng|position|accuracy|checkin|rating|rank/i);
});

test('city-state and match labels stay honest, and missing fields are omitted', () => {
  assert.deepEqual(
    placeDetailFields(
      hit({
        kind: 'area',
        name: 'Berlin',
        category: null,
        group: null,
        subtype: 'region',
        cityState: true,
        country: null,
        match: 'approximate',
        matched: null,
      }),
    ),
    [
      { label: 'Type', value: 'Area' },
      { label: 'Subtype', value: 'region' },
      { label: 'Provider class', value: 'City' },
      { label: 'Match', value: 'Approximate match' },
      { label: 'Place ID', value: URN },
    ],
  );
  assert.deepEqual(
    placeDetailFields(
      hit({
        origin: null,
        name: 'Somewhere',
        category: null,
        group: null,
        country: null,
        match: null,
        matched: null,
      }),
    ),
    [{ label: 'Type', value: 'Place' }],
  );
});

test('a malformed place ID or unknown match kind is dropped', () => {
  const fields = placeDetailFields(
    hit({
      origin: 'urn:atgeo:openstreetmap.org:node:1 secret',
      match: 'unpublished',
      matched: 'Olympiastadion',
    }),
  );
  assert.equal(fields.some((field) => field.label === 'Place ID'), false);
  assert.equal(fields.some((field) => field.label === 'Match'), false);
  assert.equal(fields.some((field) => field.label === 'Matched name'), false);
});

test('the details view reuses the one field builder and both verified link-outs', () => {
  assert.match(model, /export function placeDetailFields\(hit: PlaceHit\)/);
  assert.match(sheet, /import \{[\s\S]*placeDetailFields,[\s\S]*\} from '\.\.\/lib\/placesModel\.ts'/);
  assert.match(sheet, /const \[detailHit, setDetailHit\] = useState<PlaceHit \| null>\(null\)/);
  assert.match(sheet, /const \[linkError, setLinkError\] = useState<string \| null>\(null\)/);
  assert.match(sheet, /const detailFields = detailHit \? placeDetailFields\(detailHit\) : \[\]/);
  assert.match(sheet, /const detailRecordUrl = detailHit \? placeRecordUrl\(placesEndpoint, detailHit\.origin\) : null/);
  assert.match(sheet, /const detailMapUrl = detailHit \? openStreetMapSearchUrl\(detailHit\.name\) : null/);
  assert.match(sheet, /onPress=\{\(\) => openDetails\(hit\)\}/);
  assert.match(sheet, /accessibilityLabel=\{`Show details for \$\{hit\.name\}`\}/);
  assert.match(sheet, /\{detailFields\.map\(\(field\) => \(/);
  assert.match(sheet, /\{field\.label\}/);
  assert.match(sheet, /\{field\.value\}/);
  assert.match(sheet, /openLink\(detailRecordUrl\)/);
  assert.match(sheet, /openLink\(detailMapUrl\)/);
  assert.match(sheet, /accessibilityLabel="Open the public gazetteer record"/);
  assert.match(sheet, /accessibilityLabel="Search OpenStreetMap for this place by name"/);
  assert.match(sheet, /Name search only, not an exact place match\. No position is sent\./);
  assert.doesNotMatch(sheet, /\{placesEndpoint\}/, 'the raw saved host is never rendered');
  assert.doesNotMatch(sheet, /normalisePlacesEndpoint/);
  assert.equal((sheet.match(/<Modal\b/g) || []).length, 1, 'one modal, no nested detail dialog');
});

test('Escape steps back from details before closing the picker', () => {
  const accessibility = read('../src/lib/accessibility.ts');
  assert.match(
    sheet,
    /useDialogFocus\(\{\s*visible,\s*onClose: dismissDetailsOrPicker,/,
  );
  assert.match(sheet, /function closeDetails\(\)/);
  // The shared hook always calls the latest handler, so the detail-state
  // change takes effect without remounting the dialog or losing focus.
  assert.match(accessibility, /const closeRef = useRef\(onClose\);\s*closeRef\.current = onClose;/);
  assert.match(accessibility, /closeRef\.current\(\)/);
  assert.match(sheet, /accessibilityLabel="Back to place results"/);
  assert.match(changelog, /Escape now steps back from a result's detail view/);
  assert.match(compliance, /Escape and the visible Back to results control step back/);
  assert.match(features, /Escape or the Back to results control returns to the result list/);
});

test('every dismissal path steps back from details through one handler', () => {
  assert.match(sheet, /function dismissDetailsOrPicker\(\) \{[\s\S]*if \(detailHit\) closeDetails\(\);[\s\S]*else onClose\(\);/);
  assert.match(sheet, /useDialogFocus\(\{\s*visible,\s*onClose: dismissDetailsOrPicker,/);
  assert.match(sheet, /onRequestClose=\{dismissDetailsOrPicker\}/);
  assert.match(sheet, /<Pressable\s+onPress=\{dismissDetailsOrPicker\}\s+accessibilityElementsHidden/);
  assert.match(sheet, /ref=\{closeRef\}\s+onPress=\{dismissDetailsOrPicker\}/);
  assert.doesNotMatch(sheet, /onRequestClose=\{detailHit \? closeDetails : onClose\}/);
  assert.doesNotMatch(sheet, /onPress=\{onClose\}/);
  assert.match(changelog, /^## 0\.78\.0$/m);
  assert.match(changelog, /backdrop and the header close control step back/);
  assert.match(compliance, /backdrop taps and the header close control use the same step-back handler/);
  assert.match(features, /backdrop or the header close control returns to the result list/);
  assert.match(changelog, /Android hardware back steps back from place details/);
  assert.match(compliance, /Android hardware back and the Apple TV menu button use the same step-back handler/);
  assert.match(features, /Android's hardware back button does the same/);
});

test('the validated place ID is copyable with fixed feedback', () => {
  assert.match(sheet, /import \* as Clipboard from 'expo-clipboard'/);
  assert.match(sheet, /import \{[\s\S]*atgeoUrn,[\s\S]*placeDetailFields,/);
  assert.match(sheet, /const \[copyNotice, setCopyNotice\] = useState<string \| null>\(null\)/);
  assert.match(sheet, /const \[copyError, setCopyError\] = useState<string \| null>\(null\)/);
  assert.match(sheet, /const detailPlaceId = detailHit \? atgeoUrn\(detailHit\.origin\) : null/);
  assert.match(sheet, /if \(!detailPlaceId\) \{[\s\S]*No valid place ID is published for this result\./);
  assert.match(sheet, /await Clipboard\.setStringAsync\(detailPlaceId\)/);
  assert.match(sheet, /Place ID copied to the clipboard\./);
  assert.match(sheet, /Could not copy the place ID\. Check your device settings; Balla has not changed the ID\./);
  assert.match(sheet, /accessibilityLabel="Copy the place ID shown above"/);
  assert.match(sheet, /styles\.copyButton/);
  assert.match(sheet, /copyButton: \{[\s\S]*minHeight: 44/);
  assert.doesNotMatch(sheet, /Clipboard\.setStringAsync\(detailHit\.origin\)/);
  assert.doesNotMatch(sheet, /Clipboard\.setStringAsync\(detailFields/);
  assert.match(changelog, /validated place ID is now copyable/);
  assert.match(compliance, /Copy place ID control writes only the already-validated ATGeo URN/);
  assert.match(features, /Copy place ID control copies only the validated ID already shown/);
});

test('details fail closed with fixed copy and no writes', () => {
  assert.match(sheet, /No further place fields are published for this result\./);
  assert.match(sheet, /No public gazetteer record is available for this result\./);
  assert.match(sheet, /No map search is available because this result has no name\./);
  assert.match(sheet, /Could not open your browser\. Check your device settings; Balla has not changed the link\./);
  assert.match(sheet, /Balla[\s\S]*makes no request to open either link, sends no position and writes[\s\S]*no place record\./);
  assert.match(sheet, /accessibilityRole="alert"/);
  assert.match(sheet, /accessibilityLabel="Back to place results"/);
  assert.match(sheet, /minHeight: 44/);
  assert.doesNotMatch(sheet, /createRecord|putRecord|setCheckin|writePlace|checkinRecord/);
  assert.doesNotMatch(sheet, /provider secret|error\.message|err\.message/);
});

test('docs, release copy and OAuth facts match the details slice', () => {
  assert.match(changelog, /^## 0\.77\.0$/m);
  assert.match(changelog, /inspectable detail view/);
  assert.match(changelog, /scope count stays 112/);
  assert.match(compliance, /detail view inside the same sheet/);
  assert.match(compliance, /Absent fields are omitted/);
  assert.match(features, /detail view inside the same sheet/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.4');
  assert.equal(appJson.expo.version, '0.97.4');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.4<\/string>/);
  }
  assert.equal(
    createHash('sha256').update(metadataRaw).digest('hex'),
    '62ed29fa0518cce5ba4fc6290459cde40e4e2b7bf81250216a8c2b48a671eb29',
  );
  assert.equal(JSON.parse(metadataRaw).scope.split(/\s+/).filter(Boolean).length, 112);
});
