import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingSwitch,
  SettingValueRow,
} from '../components/SettingControls';
import { getActiveDid } from '../lib/agent';
import { resolveDidDocument } from '../lib/identityResolver';
import {
  checkingLabelerProbe,
  labelerProbeText,
  probeLabeler,
  type LabelerProbe,
} from '../lib/labelerProbe.ts';
import {
  getHandleResolverEndpoint,
  getPlacesEnabled,
  getPlacesEndpoint,
  getPlcDirectoryEndpoint,
  getServicesConfig,
  replaceServicesConfig,
  resetServicesConfig,
  setHandleResolverEndpoint,
  setPlacesEnabled,
  setPlacesEndpoint,
  setPlcDirectoryEndpoint,
  subscribeServicesConfig,
} from '../lib/servicesConfig';
import { probePlaces } from '../lib/placesProbe.ts';
import { placesHostLabel } from '../lib/placesModel.ts';
import {
  DEFAULT_SERVICES,
  SERVICE_SLOT_COPY,
  normaliseServicesConfig,
  type ServicesConfig,
} from '../lib/servicesModel.ts';
import {
  buildServicesExport,
  serialiseServicesExport,
  servicesExportName,
} from '../lib/servicesExportModel.ts';
import {
  parseServicesImport,
  previewServicesImport,
  SERVICES_IMPORT_INVALID_DETAIL,
  type ServicesImportChange,
} from '../lib/servicesImportModel.ts';
import {
  exportServicesJson,
  servicesExportAction,
} from '../lib/preferenceExport.ts';
import {
  probeAppView,
  probeChat,
  probePlcDirectory,
  probeResolver,
  probeVideoEndpoint,
  type ServiceProbe,
} from '../lib/servicesProbe.ts';
import { useSessionSummary } from '../lib/sessionInfo';
import { openExternalUrl } from '../lib/openLink';
import { CARD_RADIUS, webInputReset, usePalette } from '../theme';

const PROBE_DOCS = 'https://atproto.com/guides/self-hosting';

function probeValue(probe: ServiceProbe | null): string {
  if (!probe) return 'Not checked';
  if (probe.state === 'ok') return `OK · ${probe.latencyMs ?? 0} ms · HTTP ${probe.status ?? 200}`;
  if (probe.state === 'invalid') return probe.detail;
  return probe.status === null ? probe.detail : `HTTP ${probe.status} · ${probe.detail}`;
}

/** Advanced → Services: one genuinely editable endpoint, honest facts elsewhere. */
export function ServicesScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const [endpoint, setEndpoint] = useState<string>(DEFAULT_SERVICES.handleResolver);
  const [input, setInput] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [plcEndpoint, setPlcEndpoint] = useState<string>(DEFAULT_SERVICES.plcDirectory);
  const [plcInput, setPlcInput] = useState('');
  const [plcIsDefault, setPlcIsDefault] = useState(true);
  const [placesEndpoint, setPlacesEndpointView] = useState<string>(DEFAULT_SERVICES.places);
  const [placesInput, setPlacesInput] = useState('');
  const [placesIsDefault, setPlacesIsDefault] = useState(true);
  const [placesEnabled, setPlacesEnabledView] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resolverProbe, setResolverProbe] = useState<ServiceProbe | null>(null);
  const [plcProbe, setPlcProbe] = useState<ServiceProbe | null>(null);
  const [placesProbe, setPlacesProbe] = useState<ServiceProbe | null>(null);
  const [appviewProbe, setAppviewProbe] = useState<ServiceProbe | null>(null);
  const [chatProbe, setChatProbe] = useState<ServiceProbe | null>(null);
  const [videoProbe, setVideoProbe] = useState<ServiceProbe | null>(null);
  const [labelerProbe, setLabelerProbe] = useState<LabelerProbe | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    config: ServicesConfig;
    changes: ServicesImportChange[];
  } | null>(null);
  const [importPreviewSource, setImportPreviewSource] = useState('');
  const { summary } = useSessionSummary();

  const refresh = useCallback(async () => {
    const config = await getServicesConfig();
    const effective = await getHandleResolverEndpoint();
    setEndpoint(effective);
    setInput(config.handleResolver ?? '');
    setIsDefault(config.handleResolver === null);
    setPlcEndpoint(await getPlcDirectoryEndpoint());
    setPlcInput(config.plcDirectory ?? '');
    setPlcIsDefault(config.plcDirectory === null);
    setPlacesEndpointView(await getPlacesEndpoint());
    setPlacesInput(config.places ?? '');
    setPlacesIsDefault(config.places == null);
    setPlacesEnabledView(await getPlacesEnabled());
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeServicesConfig(() => void refresh());
  }, [refresh]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Services' });
  }, [navigation]);

  async function save() {
    if (busy) return;
    const trimmed = input.trim();
    const valid = normaliseServicesConfig({ handleResolver: trimmed || null }).handleResolver;
    if (trimmed && !valid) {
      setMessage('Enter an https host without a path, query or credentials.');
      return;
    }
    setBusy(true);
    await setHandleResolverEndpoint(valid);
    setResolverProbe(null);
    setMessage(valid ? 'Handle resolver updated. The next sign-in uses it.' : 'Default handle resolver restored.');
    setBusy(false);
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    await resetServicesConfig();
    setResolverProbe(null);
    setMessage('Default handle resolver restored.');
    setBusy(false);
  }

  async function savePlc() {
    if (busy) return;
    const trimmed = plcInput.trim();
    const valid = normaliseServicesConfig({ plcDirectory: trimmed || null }).plcDirectory;
    if (trimmed && !valid) {
      setMessage('Enter an https host without a path, query or credentials.');
      return;
    }
    setBusy(true);
    await setPlcDirectoryEndpoint(valid);
    setPlcProbe(null);
    setMessage(valid ? 'PLC directory updated for identity reads and pre-flight checks.' : 'Default PLC directory restored.');
    setBusy(false);
  }

  async function resetPlc() {
    if (busy) return;
    setBusy(true);
    await setPlcDirectoryEndpoint(null);
    setPlcProbe(null);
    setMessage('Default PLC directory restored.');
    setBusy(false);
  }

  async function checkResolver() {
    if (busy) return;
    setBusy(true);
    setResolverProbe({ state: 'checking', status: null, latencyMs: null, endpoint, detail: 'Checking…' });
    setResolverProbe(await probeResolver(await getHandleResolverEndpoint()));
    setBusy(false);
  }

  async function checkPlc() {
    if (busy) return;
    setBusy(true);
    setPlcProbe({ state: 'checking', status: null, latencyMs: null, endpoint: null, detail: 'Checking…' });
    setPlcProbe(await probePlcDirectory(await getPlcDirectoryEndpoint()));
    setBusy(false);
  }

  async function savePlaces() {
    if (busy) return;
    const trimmed = placesInput.trim();
    const valid = normaliseServicesConfig({ places: trimmed || null }).places;
    if (trimmed && !valid) {
      setMessage('Enter an https host without a path, query or credentials.');
      return;
    }
    setBusy(true);
    await setPlacesEndpoint(valid);
    setPlacesProbe(null);
    setMessage(valid ? 'Places provider updated for typed search.' : 'Default places provider restored.');
    setBusy(false);
  }

  async function resetPlaces() {
    if (busy) return;
    setBusy(true);
    await setPlacesEndpoint(null);
    setPlacesProbe(null);
    setMessage('Default places provider restored.');
    setBusy(false);
  }

  async function togglePlaces(next: boolean) {
    if (busy) return;
    setBusy(true);
    await setPlacesEnabled(next);
    setPlacesEnabledView(next);
    setPlacesProbe(null);
    setMessage(
      next
        ? 'Places search turned on. The configured provider is used again.'
        : 'Places search turned off. No place request will be made.',
    );
    setBusy(false);
  }

  async function checkPlaces() {
    if (busy) return;
    // Read the persisted switch again: a just-toggled state must not race a tap.
    const allowed = await getPlacesEnabled();
    setPlacesEnabledView(allowed);
    if (!allowed) {
      setPlacesProbe(null);
      setMessage('Places search is off. Turn it on before testing typed search.');
      return;
    }
    setBusy(true);
    setPlacesProbe({ state: 'checking', status: null, latencyMs: null, endpoint: null, detail: 'Checking…' });
    setPlacesProbe(await probePlaces(await getPlacesEndpoint()));
    setBusy(false);
  }

  async function checkAppview() {
    if (busy) return;
    setBusy(true);
    setAppviewProbe({ state: 'checking', status: null, latencyMs: null, endpoint: null, detail: 'Checking…' });
    setAppviewProbe(await probeAppView(getActiveDid()));
    setBusy(false);
  }

  async function checkChat() {
    if (busy) return;
    setBusy(true);
    setChatProbe({ state: 'checking', status: null, latencyMs: null, endpoint: null, detail: 'Checking…' });
    setChatProbe(await probeChat());
    setBusy(false);
  }

  async function checkVideo() {
    if (busy) return;
    setBusy(true);
    setVideoProbe({ state: 'checking', status: null, latencyMs: null, endpoint: null, detail: 'Checking…' });
    setVideoProbe(await probeVideoEndpoint());
    setBusy(false);
  }

  async function checkLabeler() {
    if (busy) return;
    setBusy(true);
    setLabelerProbe(checkingLabelerProbe());
    setLabelerProbe(
      await probeLabeler(DEFAULT_SERVICES.labelerDid, { resolveDocument: resolveDidDocument }),
    );
    setBusy(false);
  }

  async function exportConfiguration() {
    if (exporting) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const config = await getServicesConfig();
      const json = serialiseServicesExport(
        buildServicesExport(
          config,
          summary
            ? {
                did: summary.did,
                authorizationServer: summary.authorizationServer,
                resourceServer: summary.resourceServer,
                scopeCount: summary.scopeCount,
              }
            : null,
          new Date().toISOString(),
        ),
      );
      setExportMessage(await exportServicesJson(servicesExportName(), json));
    } catch {
      setExportMessage('Could not export the configuration on this device.');
    } finally {
      setExporting(false);
    }
  }

  function updateImportText(value: string) {
    setImportText(value);
    if (importPreview) {
      setImportPreview(null);
      setImportPreviewSource('');
      setImportMessage('The record changed. Preview it again before applying.');
    }
  }

  async function previewConfiguration() {
    if (importing) return;
    setImporting(true);
    setImportMessage(null);
    setImportPreview(null);
    setImportPreviewSource('');
    try {
      const parsed = parseServicesImport(importText);
      if (parsed.state === 'invalid') {
        setImportMessage(parsed.detail);
        return;
      }
      const current = await getServicesConfig();
      const preview = previewServicesImport(current, parsed.config);
      setImportPreview(preview);
      setImportPreviewSource(importText);
      setImportMessage(
        preview.changes.length
          ? 'Preview ready. Review the changes below, then apply.'
          : 'This record already matches the saved settings. No changes to apply.',
      );
    } catch {
      setImportMessage('Could not preview the configuration on this device.');
    } finally {
      setImporting(false);
    }
  }

  async function importConfiguration() {
    if (importing) return;
    if (!importPreview || importText !== importPreviewSource) {
      setImportPreview(null);
      setImportPreviewSource('');
      setImportMessage('The record changed. Preview it again before applying.');
      return;
    }
    setImporting(true);
    setImportMessage(null);
    try {
      await replaceServicesConfig(importPreview.config);
      setImportText('');
      setImportPreview(null);
      setImportPreviewSource('');
      setResolverProbe(null);
      setPlcProbe(null);
      setPlacesProbe(null);
      setImportMessage('Changeable public hosts restored. Session facts and grant-bound services were ignored.');
    } catch {
      setImportMessage('Could not apply the configuration on this device.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection
        title="Changeable now"
        detail="This endpoint is read before sign-in, with no OAuth token. Changing it takes effect on the next sign-in and never alters an existing grant."
      >
        <SettingValueRow label={SERVICE_SLOT_COPY.resolver.label} value={endpoint} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={DEFAULT_SERVICES.handleResolver}
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="XRPC handle resolver host"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <View style={styles.buttonRow}>
          <SettingButton label="Save resolver" onPress={() => void save()} busy={busy} />
          <SettingButton label="Use default" onPress={() => void reset()} busy={busy} disabled={isDefault} />
        </View>
        <SettingButton label="Test resolver" onPress={() => void checkResolver()} busy={busy} />
        <SettingValueRow label="Resolver result" value={probeValue(resolverProbe)} />
        {resolverProbe?.detail && resolverProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={resolverProbe.detail} />
          : null}
        {message ? <SettingValueRow label="Saved" value={message} /> : null}
      </SettingSection>

      <SettingSection
        title="Public identity directory"
        detail="The did:plc directory is a public, token-free read used to resolve did:plc identities and in pre-flight checks. Changing it takes effect on the next read, without a restart, and never alters an existing grant."
      >
        <SettingValueRow label={SERVICE_SLOT_COPY.plcDirectory.label} value={plcEndpoint} />
        <TextInput
          value={plcInput}
          onChangeText={setPlcInput}
          placeholder={DEFAULT_SERVICES.plcDirectory}
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="did:plc directory host"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <View style={styles.buttonRow}>
          <SettingButton label="Save directory" onPress={() => void savePlc()} busy={busy} />
          <SettingButton label="Use default" onPress={() => void resetPlc()} busy={busy} disabled={plcIsDefault} />
        </View>
        <SettingButton label="Test directory" onPress={() => void checkPlc()} busy={busy} />
        <SettingValueRow label="Directory result" value={probeValue(plcProbe)} />
        {plcProbe?.detail && plcProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={plcProbe.detail} />
          : null}
        <SettingNote>
          Only an https origin is accepted. The test reads one public DID
          document and checks its structured id field. A directory that cannot
          serve known identities will make did:plc lookups and pre-flight checks
          fail until you restore the default; did:web identities are unaffected.
        </SettingNote>
      </SettingSection>

      <SettingSection
        title="Places provider"
        detail="A public, token-free typed place search that can be switched off. When it is on, Balla sends only the words you type: no device position, no nearby lookup, no OAuth scope. Changing the host takes effect on the next search."
      >
        <SettingSwitch
          label="Places search"
          detail="Off: no typed search request leaves this device and the composer says the search is off. The name you type still works as plain text."
          value={placesEnabled}
          onChange={(value) => void togglePlaces(value)}
          busy={busy}
        />
        <SettingValueRow
          label={SERVICE_SLOT_COPY.places.label}
          value={placesHostLabel(placesEndpoint, placesEnabled)}
        />
        <TextInput
          value={placesInput}
          onChangeText={setPlacesInput}
          placeholder={DEFAULT_SERVICES.places}
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          editable={placesEnabled}
          accessibilityLabel="Places provider host"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
            !placesEnabled && { opacity: 0.5 },
          ]}
        />
        <View style={styles.buttonRow}>
          <SettingButton label="Save places" onPress={() => void savePlaces()} busy={busy} disabled={!placesEnabled} />
          <SettingButton
            label="Use default"
            onPress={() => void resetPlaces()}
            busy={busy}
            disabled={!placesEnabled || placesIsDefault}
          />
        </View>
        <SettingButton
          label="Test typed search"
          onPress={() => void checkPlaces()}
          busy={busy}
          disabled={!placesEnabled}
        />
        <SettingValueRow label="Places result" value={placesEnabled ? probeValue(placesProbe) : 'Off — no request was made'} />
        {placesEnabled && placesProbe?.detail && placesProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={placesProbe.detail} />
          : null}
        <SettingNote>
          Turning search off stops every typed place request, including this
          check and the composer. The configured host is kept, and turning
          search on restores it. No check-in record is written either way: the
          pin lexicon is still a draft whose name can change, so Balla writes no
          place records and renders no place chips yet.
        </SettingNote>
      </SettingSection>

      <SettingSection
        title="Grant-bound services"
        detail="These DIDs and audiences are written into this sign-in’s OAuth scope. They are shown as facts: Balla cannot honestly repoint them without asking you to authorise again."
      >
        <SettingValueRow label={SERVICE_SLOT_COPY.appview.label} value={DEFAULT_SERVICES.appviewAudience} />
        <SettingButton label="Test AppView" onPress={() => void checkAppview()} busy={busy} />
        <SettingValueRow label="AppView result" value={probeValue(appviewProbe)} />
        {appviewProbe?.detail && appviewProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={appviewProbe.detail} />
          : null}
        <SettingValueRow label={SERVICE_SLOT_COPY.chat.label} value={DEFAULT_SERVICES.chatAudience} />
        <SettingButton label="Test chat service" onPress={() => void checkChat()} busy={busy} />
        <SettingValueRow label="Chat result" value={probeValue(chatProbe)} />
        {chatProbe?.detail && chatProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={chatProbe.detail} />
          : null}
        <SettingValueRow label={SERVICE_SLOT_COPY.video.label} value={DEFAULT_SERVICES.videoAudience} />
        <SettingButton label="Test video endpoint" onPress={() => void checkVideo()} busy={busy} />
        <SettingValueRow label="Video result" value={probeValue(videoProbe)} />
        {videoProbe?.detail && videoProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={videoProbe.detail} />
          : null}
        <SettingValueRow label={SERVICE_SLOT_COPY.labeler.label} value={DEFAULT_SERVICES.labelerAudience} />
        <SettingButton label="Test labeler" onPress={() => void checkLabeler()} busy={busy} />
        <SettingValueRow label="Labeler result" value={labelerProbeText(labelerProbe)} />
        <SettingNote>
          The labeler check reads the DID document, then makes one public label
          query. It proves the advertised endpoint answers from this device; it
          does not change which labels Balla applies or grant any scope. The
          labelers you subscribe to are managed in Content filters.
        </SettingNote>
      </SettingSection>

      <SettingSection title="Discovered from your account">
        <SettingValueRow label={SERVICE_SLOT_COPY.pds.label} value="From this account’s DID document" />
        <SettingNote>
          Advanced → Hosting shows the actual PDS and authorization server for
          the active account, and can read any host’s server description.
        </SettingNote>
      </SettingSection>

      <SettingSection
        title="Configuration record"
        detail="Export the three changeable public hosts, the grant-bound service facts and this session's non-secret metadata. You can paste a Balla export back here to restore only the changeable hosts and the places switch. The record contains no token, password or provider message text."
      >
        <SettingButton
          label={servicesExportAction()}
          onPress={() => void exportConfiguration()}
          busy={exporting}
        />
        {exportMessage ? <SettingValueRow label="Export" value={exportMessage} /> : null}
        <TextInput
          value={importText}
          onChangeText={updateImportText}
          placeholder="Paste a Balla service configuration record"
          placeholderTextColor={p.secondary}
          multiline
          numberOfLines={6}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Exported service configuration JSON"
          style={[
            styles.input,
            styles.importInput,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <SettingButton
          label="Preview configuration"
          onPress={() => void previewConfiguration()}
          busy={importing}
          disabled={!importText.trim()}
        />
        {importPreview ? (
          importPreview.changes.length ? (
            importPreview.changes.map((change) => (
              <SettingValueRow
                key={change.label}
                label={`${change.label}: ${change.from}`}
                value={`→ ${change.to}`}
              />
            ))
          ) : (
            <SettingValueRow label="Preview" value="No changes from this record." />
          )
        ) : null}
        <SettingButton
          label="Apply previewed configuration"
          onPress={() => void importConfiguration()}
          busy={importing}
          disabled={!importPreview || importText !== importPreviewSource}
        />
        {importMessage ? <SettingValueRow label="Import" value={importMessage} /> : null}
        <SettingNote>
          Preview reads only the resolver, did:plc directory, places host and
          places switch from a valid Balla record. Nothing is written until you
          apply that preview. Editing the record clears the preview; session
          facts, grant-bound services and every other field are ignored, and a
          malformed record changes nothing behind fixed Balla copy.
        </SettingNote>
      </SettingSection>

      <SettingSection title="Documentation">
        <SettingLinkRow
          icon="book-outline"
          label="AT Protocol self-hosting guide"
          detail="What each service role does and who can run it"
          onPress={() => void openExternalUrl(PROBE_DOCS)}
          external
        />
      </SettingSection>

      <SettingNote>
        {SERVICE_SLOT_COPY.resolver.detail} {SERVICE_SLOT_COPY.places.detail}{' '}
        {SERVICE_SLOT_COPY.appview.detail} {SERVICE_SLOT_COPY.chat.detail}{' '}
        {SERVICE_SLOT_COPY.pds.detail}
      </SettingNote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 16,
    marginHorizontal: 14,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  importInput: {
    minHeight: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
