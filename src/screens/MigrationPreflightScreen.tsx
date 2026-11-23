import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import { agent } from '../lib/agent';
import { normaliseHostUrl, type HostProbeState } from '../lib/hostingModel';
import { probeHost, type HostProbeResult } from '../lib/hostingProbe';
import {
  ATPROTO_MIGRATION_GUIDE,
  buildPreferenceExport,
  GOAT_MIGRATION_TOOL,
  MIGRATION_OUTSIDE_GRANT,
  MIGRATION_WALKTHROUGH,
  PDS_MIGRATION_GUIDE,
  PDS_MOOVER_TOOL,
  preferenceExportName,
  preferenceInventoryText,
  readPreferenceInventory,
  type PreferenceInventory,
} from '../lib/migrationPreflightModel.ts';
import {
  exportPreferencesJson,
  preferenceExportAction,
} from '../lib/preferenceExport.ts';
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
import { useSessionSummary } from '../lib/sessionInfo';
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
 * Advanced → Migration pre-flight. Every control here performs a real read or
 * opens a real external tool. There is deliberately no move button: Balla's
 * OAuth grant cannot create a destination account, import a repo, change a DID
 * document or activate/deactivate an account.
 */
export function MigrationPreflightScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { summary, loading } = useSessionSummary();
  const [directoryState, setDirectoryState] = useState<DirectoryState>('idle');
  const [directory, setDirectory] = useState<PdsDirectory | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [probe, setProbe] = useState<HostProbeResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [customHost, setCustomHost] = useState('');
  const [customProbe, setCustomProbe] = useState<HostProbeResult | null>(null);
  const [customChecking, setCustomChecking] = useState(false);
  const [preferences, setPreferences] = useState<unknown[] | null>(null);
  const [inventory, setInventory] = useState<PreferenceInventory | null>(null);
  const [readingPreferences, setReadingPreferences] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Move account — pre-flight' });
  }, [navigation]);

  const load = useCallback(async (fresh: boolean) => {
    setDirectoryState('loading');
    const result = await loadPdsDirectory(fetch, fresh);
    setDirectoryState(result.state);
    if (result.directory) setDirectory(result.directory);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const entries = useMemo(
    () => filterPdsEntries(directory?.entries ?? [], query).slice(0, 25),
    [directory, query],
  );
  const chosen = useMemo(
    () => directory?.entries.find((entry) => entry.url === selected) ?? null,
    [directory, selected],
  );
  const customUrl = useMemo(() => normaliseHostUrl(customHost), [customHost]);

  async function checkHost() {
    if (!chosen || checking) return;
    setChecking(true);
    setProbe(null);
    setProbe(await probeHost(chosen.url));
    setChecking(false);
  }

  async function checkCustomHost() {
    if (!customUrl || customChecking) return;
    setCustomChecking(true);
    setCustomProbe(null);
    setCustomProbe(await probeHost(customUrl));
    setCustomChecking(false);
  }

  async function readPreferences() {
    if (readingPreferences) return;
    setReadingPreferences(true);
    setPreferenceError(null);
    setExportMessage(null);
    setPreferences(null);
    setInventory(null);
    try {
      const response = await agent.app.bsky.actor.getPreferences({});
      const raw = response?.data?.preferences;
      const next = readPreferenceInventory(raw);
      if (!next) {
        setPreferenceError('The preferences response had no usable preference list.');
        return;
      }
      setPreferences(raw as unknown[]);
      setInventory(next);
    } catch {
      setPreferenceError('Could not read preferences from this sign-in.');
    } finally {
      setReadingPreferences(false);
    }
  }

  async function exportPreferences() {
    if (!preferences || exporting) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const did = summary?.did || agent.did || '';
      const json = buildPreferenceExport(preferences, did, new Date().toISOString());
      if (!json) throw new Error('preferences are unavailable');
      setExportMessage(await exportPreferencesJson(preferenceExportName(did), json));
    } catch {
      setExportMessage('Could not export preferences on this device.');
    } finally {
      setExporting(false);
    }
  }

  function openLink(url: string) {
    void openExternalUrl(url).catch(() => setLinkError('Could not open that link. Copy the address into a browser instead.'));
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.warning,
          { backgroundColor: p.card, borderColor: p.danger },
        ]}
      >
        <Text style={{ color: p.danger, fontSize: 16, fontWeight: '700' }}>
          Balla cannot move your account
        </Text>
        <Text style={{ color: p.text, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          This screen is a read-only pre-flight. A real move changes your account,
          repository, blobs and identity, then activates the destination. Balla’s
          OAuth grant does not include those operations, so it offers no move button
          and will not pretend a migration happened.
        </Text>
      </View>

      <SettingSection
        title="Current account"
        detail="Non-secret facts from this sign-in. No token or key is shown."
      >
        <SettingValueRow label="DID" value={summary?.did || agent.did || 'Not available'} />
        <SettingValueRow
          label="Current PDS"
          value={loading ? 'Reading…' : summary?.resourceServer || 'Not available'}
        />
        <SettingValueRow
          label="Authorization server"
          value={loading ? 'Reading…' : summary?.authorizationServer || 'Not available'}
        />
        <SettingValueRow
          label="Granted scopes"
          value={summary ? String(summary.scopeCount) : 'Not available'}
        />
      </SettingSection>

      <SettingSection
        title="What a full move needs"
        detail="These are the operations in the public AT Protocol migration guide. Balla is not granted any of them."
      >
        {MIGRATION_OUTSIDE_GRANT.map((item) => (
          <SettingValueRow key={item.method} label={item.method} value={item.purpose} />
        ))}
      </SettingSection>

      <SettingSection
        title="Destination host"
        detail={`Open-registration hosts from the public OpenPDS index (${PDS_DIRECTORY_API}). A third-party list, not a sign-up promise.`}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter by host, country, DID or software"
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Filter destination hosts"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, paddingHorizontal: 18 }}>
          {directoryState === 'ok' && directory
            ? `${entries.length} shown · index reports ${directory.totalOpen ?? 'unknown'} open · updated ${formatUpdated(directory.updatedAt)}`
            : directoryCopy(directoryState)}
        </Text>
        <View style={styles.list}>
          {entries.map((entry) => (
            <SettingLinkRow
              key={entry.url}
              icon={entry.url === selected ? 'checkmark-circle-outline' : 'server-outline'}
              label={entry.host}
              detail={entryDetail(entry)}
              value={entry.did ?? undefined}
              onPress={() => {
                setSelected(entry.url);
                setProbe(null);
              }}
            />
          ))}
        </View>
        <SettingButton label="Refresh list" onPress={() => void load(true)} busy={directoryState === 'loading'} />

        {chosen ? (
          <View>
            <SettingValueRow label="Selected host" value={chosen.host} />
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
            <View style={styles.actions}>
              <SettingButton label="Check destination host" onPress={() => void checkHost()} busy={checking} />
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
          </View>
        ) : null}
      </SettingSection>

      <SettingSection
        title="Custom destination"
        detail="Read the public com.atproto.server.describeServer response for a host you already trust. Nothing is written."
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
          accessibilityLabel="Custom destination host"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <View style={styles.actions}>
          <SettingButton
            label="Check custom destination"
            onPress={() => void checkCustomHost()}
            busy={customChecking}
            disabled={!customUrl}
          />
        </View>
        {customHost && !customUrl ? (
          <SettingValueRow label="Input" value="Enter an https host without a path, query or credentials." />
        ) : null}
        {customProbe ? (
          <View>
            <SettingValueRow label="Check result" value={PROBE_LABELS[customProbe.state]} />
            <SettingValueRow label="Checked host" value={customProbe.host ?? 'Invalid address'} />
          </View>
        ) : null}
      </SettingSection>

      <SettingSection
        title="Preferences export"
        detail="Reads app.bsky.actor.getPreferences through this sign-in’s granted AppView scope. The export stays on this device."
      >
        <View style={styles.actions}>
          <SettingButton
            label="Read preferences"
            onPress={() => void readPreferences()}
            busy={readingPreferences}
          />
        </View>
        <SettingValueRow label="Inventory" value={preferenceInventoryText(inventory)} />
        {inventory?.kinds.length ? (
          <SettingValueRow label="Types" value={inventory.kinds.join(', ')} />
        ) : null}
        {preferenceError ? (
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 12, paddingHorizontal: 14, marginBottom: 8 }}>
            {preferenceError}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <SettingButton
            label={preferenceExportAction()}
            onPress={() => void exportPreferences()}
            busy={exporting}
            disabled={!preferences}
          />
        </View>
        {exportMessage ? (
          <SettingValueRow label="Export" value={exportMessage} />
        ) : null}
      </SettingSection>

      <SettingSection
        title="Assisted migration"
        detail="These tools can do what Balla cannot. Their pages and approval steps belong to their operators."
      >
        <SettingLinkRow
          icon="book-outline"
          label="AT Protocol migration guide"
          detail="Authoritative sequence: account, repo, blobs, preferences, identity, activation"
          onPress={() => openLink(ATPROTO_MIGRATION_GUIDE)}
          external
        />
        <SettingLinkRow
          icon="warning-outline"
          label="PDS migration safety notes"
          detail="Why a wrong step can permanently lock an account out"
          onPress={() => openLink(PDS_MIGRATION_GUIDE)}
          external
        />
        <SettingLinkRow
          icon="terminal-outline"
          label="goat account migration"
          detail="Bluesky’s reference command-line tooling"
          onPress={() => openLink(GOAT_MIGRATION_TOOL)}
          external
        />
        <SettingLinkRow
          icon="swap-horizontal-outline"
          label="PDS MOOVER"
          detail="Community host directory and migration tooling"
          onPress={() => openLink(PDS_MOOVER_TOOL)}
          external
        />
        <SettingLinkRow
          icon="document-text-outline"
          label="First-person migration walkthrough"
          detail="A detailed account of the rough edges"
          onPress={() => openLink(MIGRATION_WALKTHROUGH)}
          external
        />
        {linkError ? (
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 12, paddingHorizontal: 14, paddingBottom: 10 }}>
            {linkError}
          </Text>
        ) : null}
      </SettingSection>

      <SettingNote>
        Balla reads public host descriptions and the preferences scope you already
        granted. It does not request a broader grant, copy blobs, change your DID
        document or sign in to your destination. After a migration elsewhere, sign
        in again from scratch so the OAuth session binds to the new PDS.
      </SettingNote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  warning: {
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 16,
    marginHorizontal: 14,
    marginTop: 8,
  },
  list: {
    maxHeight: 360,
    overflow: 'hidden',
  },
  actions: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
