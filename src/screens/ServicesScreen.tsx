import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
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
  getPlacesEndpoint,
  getPlcDirectoryEndpoint,
  getServicesConfig,
  resetServicesConfig,
  setHandleResolverEndpoint,
  setPlacesEndpoint,
  setPlcDirectoryEndpoint,
  subscribeServicesConfig,
} from '../lib/servicesConfig';
import { probePlaces } from '../lib/placesProbe.ts';
import {
  DEFAULT_SERVICES,
  SERVICE_SLOT_COPY,
  normaliseServicesConfig,
} from '../lib/servicesModel.ts';
import {
  buildServicesExport,
  serialiseServicesExport,
  servicesExportName,
} from '../lib/servicesExportModel.ts';
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

  async function checkPlaces() {
    if (busy) return;
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
        detail="A public, token-free typed place search. Balla sends only the words you type: no device position, no nearby lookup, no OAuth scope. Changing the host takes effect on the next search."
      >
        <SettingValueRow label={SERVICE_SLOT_COPY.places.label} value={placesEndpoint} />
        <TextInput
          value={placesInput}
          onChangeText={setPlacesInput}
          placeholder={DEFAULT_SERVICES.places}
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Places provider host"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <View style={styles.buttonRow}>
          <SettingButton label="Save places" onPress={() => void savePlaces()} busy={busy} />
          <SettingButton label="Use default" onPress={() => void resetPlaces()} busy={busy} disabled={placesIsDefault} />
        </View>
        <SettingButton label="Test typed search" onPress={() => void checkPlaces()} busy={busy} />
        <SettingValueRow label="Places result" value={probeValue(placesProbe)} />
        {placesProbe?.detail && placesProbe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={placesProbe.detail} />
          : null}
        <SettingNote>
          The test searches a fixed word and checks the structured results. No
          check-in record is written: the pin lexicon is still a draft whose
          name can change, so Balla writes no place records and renders no place
          chips yet.
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
        detail="Export the three changeable public hosts, the grant-bound service facts and this session's non-secret metadata. The file contains no token, password or provider message text."
      >
        <SettingButton
          label={servicesExportAction()}
          onPress={() => void exportConfiguration()}
          busy={exporting}
        />
        {exportMessage ? <SettingValueRow label="Export" value={exportMessage} /> : null}
        <SettingNote>
          The export is a record, not an import: the resolver, did:plc directory
          and places host can be changed here, and grant-bound services need a
          new authorisation.
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
});
