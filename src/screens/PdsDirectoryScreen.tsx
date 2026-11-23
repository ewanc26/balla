import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import {
  normaliseHostUrl,
  OPEN_PDS_DIRECTORY,
  type HostProbeState,
} from '../lib/hostingModel';
import { probeHost, type HostProbeResult } from '../lib/hostingProbe';
import { loadPdsDirectory } from '../lib/pdsDirectory';
import {
  directoryCopy,
  filterPdsEntries,
  PDS_DIRECTORY_API,
  type DirectoryState,
  type PdsDirectory,
  type PdsDirectoryEntry,
} from '../lib/pdsDirectoryModel';
import { openExternalUrl } from '../lib/openLink';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

const PROBE_LABELS: Record<HostProbeState, string> = {
  idle: 'Not checked',
  checking: 'Checking…',
  reachable: 'Reachable AT Protocol host',
  'not-atproto': 'Not an AT Protocol host',
  unreachable: 'Unreachable',
  invalid: 'Invalid address',
};

function entryDetail(entry: PdsDirectoryEntry): string {
  const parts = [entry.country, entry.software ?? entry.version].filter(Boolean);
  if (entry.userCount !== null) parts.push(`${entry.userCount} users`);
  return parts.length ? parts.join(' · ') : 'No directory detail published';
}

function formatUpdated(value: string | null): string {
  if (!value) return 'Not stated';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

/**
 * Advanced → Hosting → PDS directory: a real read of the public OpenPDS index,
 * a real describeServer check on a chosen host, and the existing OAuth sign-in
 * hand-off. The index is third-party metadata, never a promise of sign-up.
 */
export function PdsDirectoryScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const [state, setState] = useState<DirectoryState>('idle');
  const [directory, setDirectory] = useState<PdsDirectory | null>(null);
  const [query, setQuery] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [probe, setProbe] = useState<HostProbeResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [customProbe, setCustomProbe] = useState<HostProbeResult | null>(null);
  const [customChecking, setCustomChecking] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'PDS directory' });
  }, [navigation]);

  const load = useCallback(async (fresh: boolean) => {
    setLoading(true);
    const result = await loadPdsDirectory(fetch, fresh);
    setState(result.state);
    if (result.directory) setDirectory(result.directory);
    setLoading(false);
  }, []);

  useLayoutEffect(() => {
    void load(false);
  }, [load]);

  const entries = useMemo(
    () => filterPdsEntries(directory?.entries ?? [], query),
    [directory, query],
  );
  const chosen = useMemo(
    () => directory?.entries.find((entry) => entry.url === selected) ?? null,
    [directory, selected],
  );
  const customUrl = useMemo(() => normaliseHostUrl(customHost), [customHost]);

  async function checkCustomHost() {
    if (!customUrl || customChecking) return;
    setCustomChecking(true);
    setCustomProbe(null);
    setCustomProbe(await probeHost(customUrl));
    setCustomChecking(false);
  }

  async function checkHost() {
    if (!chosen || checking) return;
    setChecking(true);
    setProbe(null);
    setProbe(await probeHost(chosen.url));
    setChecking(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.url}
        renderItem={({ item }) => (
          <SettingLinkRow
            icon={item.url === selected ? 'checkmark-circle-outline' : 'server-outline'}
            label={item.host}
            detail={entryDetail(item)}
            value={item.did ?? 'DID not published'}
            onPress={() => {
              setSelected(item.url);
              setProbe(null);
            }}
          />
        )}
        ListHeaderComponent={
          <View>
            <SettingSection
              title="Open registration hosts"
              detail={`From the public OpenPDS index (${PDS_DIRECTORY_API}). A third-party list, not a health check or a sign-up promise.`}
            >
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Filter by host, country, DID or software"
                placeholderTextColor={p.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Filter PDS hosts"
                style={[
                  styles.input,
                  { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
                  webInputReset,
                ]}
              />
              <View style={styles.meta}>
                <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17 }}>
                  {state === 'ok' && directory
                    ? `${directory.entries.length} usable hosts · index reports ${directory.totalOpen ?? 'unknown'} open · updated ${formatUpdated(directory.updatedAt)}`
                    : directoryCopy(state)}
                </Text>
              </View>
              <SettingButton label="Refresh list" onPress={() => void load(true)} busy={loading} />
            </SettingSection>

            {chosen ? (
              <SettingSection
                title={chosen.host}
                detail="Check the host before signing in. Only structured fields are shown; no provider message text is read or stored."
              >
                <SettingValueRow label="Server DID" value={chosen.did ?? 'Not published'} />
                <SettingValueRow
                  label="User domains"
                  value={chosen.userDomains.length ? chosen.userDomains.join(', ') : 'None published'}
                />
                <SettingValueRow
                  label="Invite codes"
                  value={
                    chosen.inviteRequired === null
                      ? 'Not stated'
                      : chosen.inviteRequired
                        ? 'Required'
                        : 'Not required'
                  }
                />
                <SettingValueRow
                  label="Phone verification"
                  value={
                    chosen.phoneRequired === null
                      ? 'Not stated'
                      : chosen.phoneRequired
                        ? 'Required'
                        : 'Not required'
                  }
                />
                <SettingValueRow label="Last listed" value={formatUpdated(chosen.lastSeen)} />
                <View style={styles.actions}>
                  <SettingButton
                    label="Check host compatibility"
                    onPress={() => void checkHost()}
                    busy={checking}
                    disabled={loading}
                  />
                  <SettingButton
                    label="Sign in with this host"
                    onPress={() => navigation.navigate('AddAccount', { identifier: chosen.url })}
                    disabled={checking}
                  />
                </View>
                {probe ? (
                  <View>
                    <SettingValueRow label="Check result" value={PROBE_LABELS[probe.state]} />
                    <SettingValueRow label="Checked host" value={probe.host ?? 'Invalid address'} />
                    {probe.facts ? (
                      <SettingValueRow label="Server DID" value={probe.facts.did ?? 'Not available'} />
                    ) : null}
                  </View>
                ) : null}
              </SettingSection>
            ) : null}

            <SettingSection
              title="Use a custom host"
              detail="Sign in with a host that is not listed here. Balla uses the same OAuth flow; the approval page belongs to that server."
            >
              <TextInput
                value={customHost}
                onChangeText={(value) => {
                  setCustomHost(value);
                  setCustomProbe(null);
                }}
                placeholder="https://pds.example.com"
                placeholderTextColor={p.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Custom PDS host"
                style={[
                  styles.input,
                  { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
                  webInputReset,
                ]}
              />
              <View style={styles.meta}>
                <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17 }}>
                  {customHost && !customUrl
                    ? 'Enter an https host without a path, query or credentials.'
                    : 'Only an HTTPS origin is accepted; no message text is stored.'}
                </Text>
              </View>
              <View style={styles.actions}>
                <SettingButton
                  label="Check custom host"
                  onPress={() => void checkCustomHost()}
                  busy={customChecking}
                  disabled={!customUrl || loading}
                />
                <SettingButton
                  label="Sign in with custom host"
                  onPress={() => navigation.navigate('AddAccount', { identifier: customUrl })}
                  disabled={!customUrl || customChecking}
                />
              </View>
              {customProbe ? (
                <View>
                  <SettingValueRow label="Check result" value={PROBE_LABELS[customProbe.state]} />
                  <SettingValueRow
                    label="Checked host"
                    value={customProbe.host ?? 'Invalid address'}
                  />
                  {customProbe.facts ? (
                    <SettingValueRow label="Server DID" value={customProbe.facts.did ?? 'Not available'} />
                  ) : null}
                </View>
              ) : null}
            </SettingSection>
          </View>
        }
        ListFooterComponent={
          <View>
            <SettingSection title="Directory source">
              <SettingLinkRow
                icon="earth-outline"
                label="Open PDS directory on the web"
                detail="The same third-party index, outside Balla"
                onPress={() => void openExternalUrl(OPEN_PDS_DIRECTORY)}
                external
              />
            </SettingSection>
            <SettingNote>
              OpenPDS reports which hosts advertise open registration. Balla checks a host with a live, unauthenticated com.atproto.server.describeServer read and signs in through the normal OAuth flow: the approval page belongs to your server. No new scope or permission is requested here.
            </SettingNote>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load(true)}
            tintColor={p.accent}
          />
        }
        style={{ backgroundColor: p.bg }}
      />
    </View>
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
    marginTop: 4,
  },
  meta: { paddingHorizontal: 18, paddingVertical: 12 },
  actions: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
});
