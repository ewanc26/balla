import React, { useLayoutEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSessionSummary } from '../lib/sessionInfo';
import { formatDateTime } from '../lib/time';
import {
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import { SignOutControl } from '../components/SignOutControl';
import { usePalette } from '../theme';

export function SessionSecurityScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { summary, loading, error } = useSessionSummary();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Session security' });
  }, [navigation]);

  const scopes = summary
    ? `${summary.scopeCount} granted ${summary.scopeCount === 1 ? 'scope' : 'scopes'}`
    : 'Not available';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginBottom: 12 }}
        >
          {error}
        </Text>
      ) : null}

      <SettingSection
        title="This sign-in"
        detail="Non-secret metadata from the OAuth token. Access and refresh tokens are never shown."
      >
        <SettingValueRow label="Account DID" value={summary?.did || 'Not available'} />
        <SettingValueRow label="Authorization server" value={summary?.authorizationServer || 'Not available'} />
        <SettingValueRow label="Resource server (PDS)" value={summary?.resourceServer || 'Not available'} />
        <SettingValueRow label="Access token expires" value={formatDateTime(summary?.expiresAt)} />
        <SettingValueRow label="OAuth grant" value={scopes} />
      </SettingSection>

      <SettingSection title="How Balla signs in">
        <SettingValueRow
          label="Method"
          value="OAuth with DPoP-bound tokens. Balla never sees a password."
        />
        <SettingValueRow
          label="Sign-out"
          value="Clears the local session and asks the server to revoke the grant. Your account and posts stay on your PDS."
        />
      </SettingSection>

      <SettingSection title="Account controls">
        <SettingLinkRow
          icon="archive-outline"
          label="Export, deactivate or delete"
          detail="Account lifecycle operations belong to your PDS."
          onPress={() => navigation.navigate('AccountLifecycle')}
        />
        <SettingLinkRow
          icon="shield-checkmark-outline"
          label="Privacy and security"
          detail="Provider-owned security controls and Balla’s real preference editors."
          onPress={() => navigation.navigate('PrivacySecurity')}
        />
      </SettingSection>

      <SettingNote>
        {loading
          ? 'Reading session metadata…'
          : 'An expired token is refreshed automatically. If the grant has been revoked, Balla asks you to sign in again.'}
      </SettingNote>

      <SignOutControl />
    </ScrollView>
  );
}
