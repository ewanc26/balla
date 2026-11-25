import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { openExternalUrl } from '../lib/openLink';
import { agent } from '../lib/agent';
import { useViewer } from '../lib/viewer';
import { useSessionSummary } from '../lib/sessionInfo';
import { useProfileSelfLabel } from '../lib/profileSelfLabel';
import {
  BLUESKY_ACCOUNT_SETTINGS,
  BOT_LABEL,
  controlPanelFailureText,
  providerControlPanelUrl,
  providerLinkDetail,
  providerOwnedPanelText,
  readBirthDate,
  validateBirthDate,
} from '../lib/accountSettingsModel';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingSwitch,
  SettingValueRow,
} from '../components/SettingControls';
import { usePalette, webInputReset } from '../theme';

export function AccountSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const { summary } = useSessionSummary();
  const automationLabel = useProfileSelfLabel(BOT_LABEL);
  const [birthday, setBirthday] = useState('');
  const [birthdaySaved, setBirthdaySaved] = useState(false);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdayLoaded, setBirthdayLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Account and security' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    agent
      .getPreferences()
      .then((prefs) => {
        if (!active) return;
        setBirthday(readBirthDate(prefs));
        setBirthdayLoaded(true);
      })
      .catch(() => {
        if (active) setLoadError('Could not load personal details from your account.');
      });
    return () => {
      active = false;
    };
  }, []);

  const service = summary?.resourceServer || '';
  const handle = profile?.handle ? `@${profile.handle}` : 'Not loaded';

  function openProviderSettings() {
    const url = providerControlPanelUrl(service, BLUESKY_ACCOUNT_SETTINGS);
    if (!url) {
      setLoadError(providerOwnedPanelText('account settings'));
      return;
    }
    void openExternalUrl(url).catch(() => {
      setLoadError(controlPanelFailureText(service, 'account settings', url));
    });
  }

  async function saveBirthday() {
    const result = validateBirthDate(birthday);
    if (!result.ok) {
      setBirthdayError(result.error);
      return;
    }
    setSavingBirthday(true);
    setBirthdayError(null);
    setBirthdaySaved(false);
    try {
      await agent.setPersonalDetails({
        birthDate: result.value ? new Date(`${result.value}T00:00:00Z`) : undefined,
      });
      setBirthday(result.value);
      setBirthdaySaved(true);
    } catch {
      setBirthdayError('Could not save your birthday. Try again.');
    } finally {
      setSavingBirthday(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      {loadError ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginBottom: 12 }}
        >
          {loadError}
        </Text>
      ) : null}

      <SettingSection
        title="Your account"
        detail="Identity Balla can read from your signed-in profile and OAuth session."
      >
        <SettingValueRow label="Display name" value={profile?.displayName || profile?.handle || 'Not loaded'} />
        <SettingValueRow label="Handle" value={handle} />
        <SettingValueRow label="DID" value={summary?.did || agent.did || 'Not available'} />
        <SettingValueRow label="PDS" value={service} />
      </SettingSection>

      <SettingSection
        title="Provider-owned fields"
        detail="Balla does not host your account. These controls live with your account provider."
      >
        <SettingLinkRow
          icon="mail-outline"
          label="Email"
          detail="OAuth clients do not receive an email address."
          value="Managed by your provider"
          onPress={openProviderSettings}
          external
        />
        <SettingLinkRow
          icon="key-outline"
          label="Password"
          detail="Balla never asks for or stores a password. OAuth signs you in through your provider."
          value="Not used by Balla"
          onPress={openProviderSettings}
          external
        />
        <SettingLinkRow
          icon="at-outline"
          label="Change handle"
          detail="Handle changes use identity endpoints outside Balla’s OAuth grant."
          value={handle}
          onPress={openProviderSettings}
          external
        />
      </SettingSection>

      <SettingSection
        title="Birthday"
        detail="Saved through your real Bluesky personal-details preference. Balla does not use it to change what you see."
      >
        <View style={{ padding: 14 }}>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>Birth date</Text>
          <TextInput
            value={birthday}
            onChangeText={(value) => {
              setBirthday(value);
              setBirthdayError(null);
              setBirthdaySaved(false);
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={p.secondary}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Birth date in YYYY-MM-DD format"
            style={{
              borderWidth: 1,
              borderColor: p.divider,
              borderRadius: 8,
              backgroundColor: p.bg,
              color: p.text,
              paddingHorizontal: 12,
              minHeight: 44,
              marginTop: 8,
              ...webInputReset,
            }}
          />
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 6 }}>
            Leave it empty to clear the preference. Your provider decides how birth dates
            and declared age are used.
          </Text>
          {birthdayError ? (
            <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 12, marginTop: 8 }}>
              {birthdayError}
            </Text>
          ) : null}
          {birthdaySaved ? (
            <Text style={{ color: p.green, fontSize: 12, marginTop: 8 }}>Birth date saved.</Text>
          ) : null}
          <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <SettingButton
              label={birthday ? 'Save birth date' : 'Clear birth date'}
              onPress={() => void saveBirthday()}
              busy={savingBirthday}
              disabled={!birthdayLoaded}
            />
          </View>
        </View>
      </SettingSection>

      <SettingSection
        title="Automation label"
        detail="A self-label on your profile record saying this account is automated."
      >
        <SettingSwitch
          label="Show automation label"
          detail="This label appears beside your name and posts. You can turn it off at any time."
          value={automationLabel.value}
          onChange={(value) => void automationLabel.change(value)}
          busy={automationLabel.saving || !automationLabel.ready}
        />
        {automationLabel.error ? (
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginHorizontal: 14, marginBottom: 10 }}>
            {automationLabel.error}
          </Text>
        ) : null}
      </SettingSection>

      <SettingSection title="Account controls">
        <SettingLinkRow
          icon="download-outline"
          label="Provider account controls"
          detail={providerLinkDetail(service, 'account')}
          onPress={openProviderSettings}
          external
        />
        <SettingLinkRow
          icon="archive-outline"
          label="Export, deactivate or delete"
          detail="What Balla can delete, and what stays on your PDS."
          onPress={() => navigation.navigate('AccountLifecycle')}
        />
        <SettingLinkRow
          icon="swap-horizontal-outline"
          label="Move to another PDS"
          detail="Read-only pre-flight and verified migration tools; Balla cannot perform the move."
          onPress={() => navigation.navigate('MigrationPreflight')}
        />
      </SettingSection>

      <SettingNote>
        Email, password, two-factor authentication, app passwords, activity
        privacy and account lifecycle are provider operations. Balla links to
        them rather than showing controls it cannot honour.
      </SettingNote>
    </ScrollView>
  );
}
