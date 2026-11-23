import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import { openExternalUrl } from '../lib/openLink';
import { getHandleResolverEndpoint } from '../lib/servicesConfig';
import {
  ACCOUNT_PREFLIGHT_COPY,
  probeAccount,
  type AccountPreflightResult,
  type AccountPreflightState,
} from '../lib/accountPreflight.ts';
import { IDENTITY_DOCS_URL, OPEN_PDS_DIRECTORY } from '../lib/hostingModel';
import { CARD_RADIUS, webInputReset, usePalette } from '../theme';

const ISSUE_URL = 'https://github.com/ewanc26/balla/issues/100';

const STATE_LABELS: Record<AccountPreflightState, string> = {
  invalid: 'Invalid input',
  unresolved: 'Identity not resolved',
  'no-pds': 'No PDS advertised',
  incompatible: 'Not an AT Protocol PDS',
  'no-oauth': 'No usable OAuth metadata',
  ok: 'Public checks passed',
};

/** Advanced → Account pre-flight: public facts before an OAuth sign-in. */
export function AccountPreflightScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountPreflightResult | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Account pre-flight' });
  }, [navigation]);

  async function check() {
    if (busy) return;
    setBusy(true);
    setResult(await probeAccount(input, { resolver: await getHandleResolverEndpoint() }));
    setBusy(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection title="Check an account" detail={ACCOUNT_PREFLIGHT_COPY.detail}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="alice.example.com or did:plc:…"
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Account handle or DID to check"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <View style={styles.buttonRow}>
          <SettingButton label="Check account" onPress={() => void check()} busy={busy} />
        </View>
        {result ? (
          <View>
            <SettingValueRow label="Result" value={STATE_LABELS[result.state]} />
            <SettingValueRow label="Detail" value={result.detail} />
            <SettingValueRow label="Identity source" value={result.source ?? 'Not resolved'} />
            <SettingValueRow label="DID" value={result.did ?? 'Not available'} />
            <SettingValueRow label="PDS" value={result.pds ?? 'Not available'} />
            {result.facts ? (
              <View>
                <SettingValueRow label="Server DID" value={result.facts.did ?? 'Not available'} />
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
              </View>
            ) : null}
            <SettingValueRow
              label="Authorization server"
              value={result.authorizationServer ?? 'Not available'}
            />
          </View>
        ) : null}
      </SettingSection>

      <SettingSection title="What this does not prove">
        <SettingNote>{ACCOUNT_PREFLIGHT_COPY.limits}</SettingNote>
        <SettingNote>
          A host can refuse sign-up, change its configuration or fail after this
          check. Balla never stores a password or an app password: sign-in is
          OAuth only, and the provider’s own approval page owns the grant.
        </SettingNote>
      </SettingSection>

      <SettingSection title="Documentation">
        <SettingLinkRow
          icon="book-outline"
          label="How handles resolve"
          detail="Well-known files, DNS and DID documents"
          onPress={() => void openExternalUrl(IDENTITY_DOCS_URL)}
          external
        />
        <SettingLinkRow
          icon="list-outline"
          label="Open PDS directory"
          detail="Third-party list of independent hosts"
          onPress={() => void openExternalUrl(OPEN_PDS_DIRECTORY)}
          external
        />
        <SettingLinkRow
          icon="information-circle-outline"
          label="Independent PDS sign-in"
          detail="Open issue #100 in the public tracker"
          onPress={() => void openExternalUrl(ISSUE_URL)}
          external
        />
      </SettingSection>
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
