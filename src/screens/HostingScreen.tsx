import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import { getAccounts, getActiveDid } from '../lib/agent';
import {
  IDENTITY_DOCS_URL,
  OPEN_PDS_DIRECTORY,
  type HostProbeState,
} from '../lib/hostingModel';
import { probeHost, type HostProbeResult } from '../lib/hostingProbe';
import { useSessionSummary } from '../lib/sessionInfo';
import { openExternalUrl } from '../lib/openLink';
import { CARD_RADIUS, webInputReset, usePalette } from '../theme';

const STATUS_LABELS: Record<HostProbeState, string> = {
  idle: 'Not checked',
  checking: 'Checking…',
  reachable: 'Reachable AT Protocol host',
  'not-atproto': 'Not an AT Protocol host',
  unreachable: 'Unreachable',
  invalid: 'Invalid address',
};

/** Advanced → Hosting: real account facts and a read-only PDS host check. */
export function HostingScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const { summary, loading } = useSessionSummary();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HostProbeResult | null>(null);
  const [handle, setHandle] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Account hosting' });
    const did = getActiveDid();
    if (did) void getAccounts().then((entries) => setHandle(entries.find((e) => e.did === did)?.handle ?? null));
  }, [navigation]);

  async function check() {
    if (busy) return;
    setBusy(true);
    setResult(await probeHost(input));
    setBusy(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection
        title="This account"
        detail="Non-secret facts from the current OAuth grant. Tokens and keys stay in the OAuth client’s own store."
      >
        <SettingValueRow label="Handle" value={handle ?? 'Not stored'} />
        <SettingValueRow label="DID" value={getActiveDid() ?? 'Not available'} />
        <SettingValueRow
          label="Resource server (PDS)"
          value={loading ? 'Reading…' : summary?.resourceServer ?? 'Not available'}
        />
        <SettingValueRow
          label="Authorization server"
          value={loading ? 'Reading…' : summary?.authorizationServer ?? 'Not available'}
        />
        <SettingValueRow
          label="Granted tokens"
          value={summary ? String(summary.scopeCount) : 'Not available'}
        />
      </SettingSection>

      <SettingSection
        title="Check a host"
        detail="Reads the public com.atproto.server.describeServer response. Nothing is written; no message text is stored."
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="alice.example.com or https://pds.example.com"
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Host or handle to check"
          style={[
            styles.input,
            {
              color: p.text,
              backgroundColor: p.bg,
              borderColor: p.divider,
            },
            webInputReset,
          ]}
        />
        <View style={styles.buttonRow}>
          <SettingButton label="Check host" onPress={() => void check()} busy={busy} />
        </View>
        {result ? (
          <View>
            <SettingValueRow label="Result" value={STATUS_LABELS[result.state]} />
            <SettingValueRow label="Detail" value={result.detail} />
            <SettingValueRow label="Checked" value={result.host ?? 'Invalid address'} />
            {result.facts ? (
              <View>
                <SettingValueRow label="Server DID" value={result.facts.did ?? 'Not available'} />
                <SettingValueRow
                  label="User domains"
                  value={result.facts.domains.length ? result.facts.domains.join(', ') : 'None advertised'}
                />
                <SettingValueRow
                  label="Invite codes"
                  value={
                    result.facts.inviteRequired === null
                      ? 'Not stated'
                      : result.facts.inviteRequired
                        ? 'Required'
                        : 'Not required'
                  }
                />
                <SettingValueRow
                  label="Phone verification"
                  value={
                    result.facts.phoneRequired === null
                      ? 'Not stated'
                      : result.facts.phoneRequired
                        ? 'Required'
                        : 'Not required'
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </SettingSection>

      <SettingSection title="Choose a provider">
        <SettingLinkRow
          icon="earth-outline"
          label="Open PDS directory"
          detail="Independent hosts with open registration"
          onPress={() => void openExternalUrl(OPEN_PDS_DIRECTORY)}
          external
        />
        <SettingLinkRow
          icon="book-outline"
          label="How handles resolve"
          detail="Well-known files, DNS and DID documents"
          onPress={() => void openExternalUrl(IDENTITY_DOCS_URL)}
          external
        />
      </SettingSection>

      <SettingNote>
        Sign-in accepts any handle, DID or PDS host. Balla resolves the handle
        from that host’s own well-known file first and falls back to the
        configured resolver, then reads the DID document to find the account’s
        PDS — a handle suffix never implies a Bluesky host. AppView, chat and
        video service audiences are part of the OAuth grant, so changing those
        DIDs needs a new authorisation rather than an inert override here.
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
    marginTop: 8,
  },
  buttonRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
