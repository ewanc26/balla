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
import {
  getHandleResolverEndpoint,
  getServicesConfig,
  resetServicesConfig,
  setHandleResolverEndpoint,
  subscribeServicesConfig,
} from '../lib/servicesConfig';
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
import { probeAppView, probeChat, probeResolver, type ServiceProbe } from '../lib/servicesProbe.ts';
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
  const [busy, setBusy] = useState(false);
  const [resolverProbe, setResolverProbe] = useState<ServiceProbe | null>(null);
  const [appviewProbe, setAppviewProbe] = useState<ServiceProbe | null>(null);
  const [chatProbe, setChatProbe] = useState<ServiceProbe | null>(null);
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

  async function checkResolver() {
    if (busy) return;
    setBusy(true);
    setResolverProbe({ state: 'checking', status: null, latencyMs: null, endpoint, detail: 'Checking…' });
    setResolverProbe(await probeResolver(await getHandleResolverEndpoint()));
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
        <SettingValueRow label={SERVICE_SLOT_COPY.labeler.label} value={DEFAULT_SERVICES.labelerAudience} />
      </SettingSection>

      <SettingSection title="Discovered from your account">
        <SettingValueRow label={SERVICE_SLOT_COPY.pds.label} value="From this account’s DID document" />
        <SettingValueRow label="Identity directory" value={DEFAULT_SERVICES.plcDirectory} />
        <SettingNote>
          Advanced → Hosting shows the actual PDS and authorization server for
          the active account, and can read any host’s server description.
        </SettingNote>
      </SettingSection>

      <SettingSection
        title="Configuration record"
        detail="Export the resolver choice, the grant-bound service facts and this session's non-secret metadata. The file contains no token, password or provider message text."
      >
        <SettingButton
          label={servicesExportAction()}
          onPress={() => void exportConfiguration()}
          busy={exporting}
        />
        {exportMessage ? <SettingValueRow label="Export" value={exportMessage} /> : null}
        <SettingNote>
          The export is a record, not an import: only the handle resolver can be
          changed here, and grant-bound services need a new authorisation.
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
        {SERVICE_SLOT_COPY.resolver.detail} {SERVICE_SLOT_COPY.appview.detail}{' '}
        {SERVICE_SLOT_COPY.chat.detail} {SERVICE_SLOT_COPY.pds.detail}
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
