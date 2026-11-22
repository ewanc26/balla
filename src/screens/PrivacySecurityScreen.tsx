import React, { useLayoutEffect, useState } from 'react';
import { Linking, ScrollView, Text } from 'react-native';
import { useSessionSummary } from '../lib/sessionInfo';
import { useProfileSelfLabel } from '../lib/profileSelfLabel';
import {
  BLUESKY_APP_PASSWORDS,
  BLUESKY_PRIVACY_SETTINGS,
  LOGGED_OUT_PRIVACY_LABEL,
  providerLinkDetail,
} from '../lib/accountSettingsModel';
import {
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingSwitch,
} from '../components/SettingControls';
import { usePalette } from '../theme';

export function PrivacySecurityScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { summary } = useSessionSummary();
  const loggedOutVisibility = useProfileSelfLabel(LOGGED_OUT_PRIVACY_LABEL);
  const [linkError, setLinkError] = useState<string | null>(null);
  const service = summary?.resourceServer || '';

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Privacy and security' });
  }, [navigation]);

  function openPrivacySettings() {
    void Linking.openURL(BLUESKY_PRIVACY_SETTINGS).catch(() => {
      setLinkError('Could not open privacy settings. Visit bsky.app/settings/privacy-and-security in a browser.');
    });
  }

  function openAppPasswords() {
    void Linking.openURL(BLUESKY_APP_PASSWORDS).catch(() => {
      setLinkError('Could not open app passwords. Visit bsky.app/settings/app-passwords in a browser.');
    });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      {linkError ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginBottom: 12 }}
        >
          {linkError}
        </Text>
      ) : null}

      <SettingSection
        title="Visibility"
        detail="Balla writes the self-label it can honour through the profile scope."
      >
        <SettingSwitch
          label="Ask apps not to show my account to logged-out users"
          detail="Bluesky honours this request. Other apps and sites may not, and it does not make the account private."
          value={loggedOutVisibility.value}
          onChange={(value) => void loggedOutVisibility.change(value)}
          busy={loggedOutVisibility.saving || !loggedOutVisibility.ready}
        />
        {loggedOutVisibility.error ? (
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginHorizontal: 14, marginBottom: 10 }}>
            {loggedOutVisibility.error}
          </Text>
        ) : null}
      </SettingSection>

      <SettingSection
        title="Notifications"
        detail="Balla saves these through app.bsky.notification.putPreferencesV2."
      >
        <SettingLinkRow
          icon="notifications-outline"
          label="Post notification settings"
          detail="Choose which replies, likes, follows and reposts notify you."
          onPress={() => navigation.navigate('NotificationSettings')}
        />
      </SettingSection>

      <SettingSection
        title="Provider account security"
        detail="OAuth does not expose these controls to Balla. They stay on your account provider."
      >
        <SettingLinkRow
          icon="shield-checkmark-outline"
          label="Two-factor authentication"
          detail="Balla cannot read or change 2FA state. Set it up with your provider."
          value="Provider-controlled"
          onPress={openPrivacySettings}
          external
        />
        <SettingLinkRow
          icon="key-outline"
          label="App passwords"
          detail="Balla signs in with OAuth and never stores a password. App passwords are not used here."
          value="Not used by Balla"
          onPress={openAppPasswords}
          external
        />
        <SettingLinkRow
          icon="people-outline"
          label="Activity privacy"
          detail="Who may be notified when you interact with posts is a provider declaration outside Balla’s OAuth grant."
          value="Provider-controlled"
          onPress={openPrivacySettings}
          external
        />
        <SettingLinkRow
          icon="sparkles-outline"
          label="Algorithmic recommendations"
          detail="The opt-out is a record write outside Balla’s current grant. Use the provider control instead."
          value="Provider-controlled"
          onPress={openPrivacySettings}
          external
        />
        <SettingLinkRow
          icon="information-circle-outline"
          label="Provider security controls"
          detail={providerLinkDetail(service, 'privacy and security')}
          onPress={openPrivacySettings}
          external
        />
      </SettingSection>

      <SettingSection title="This sign-in">
        <SettingLinkRow
          icon="finger-print-outline"
          label="Session security"
          detail="OAuth server, PDS, scope count and sign-out."
          onPress={() => navigation.navigate('SessionSecurity')}
        />
        <SettingLinkRow
          icon="document-text-outline"
          label="Privacy policy"
          detail="What stays on your device and what leaves it."
          onPress={() => navigation.navigate('Info', { topic: 'privacy', title: 'Privacy policy' })}
        />
      </SettingSection>

      <SettingNote>
        AT Protocol is a public network. A request to hide your account or posts
        asks other apps to co-operate; it cannot erase public content or stop
        every other service from keeping its own copy.
      </SettingNote>
    </ScrollView>
  );
}
