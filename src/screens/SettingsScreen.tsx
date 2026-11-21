import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../lib/agent';
import { useViewer } from '../lib/viewer';
import { usePreferences } from '../lib/preferences';
import { useModerationInboxUnread } from '../lib/moderationInbox';
import { useFeeds } from '../lib/feedsContext';
import { accentFor, eraFor } from '../lib/themeModel';
import { Avatar } from '../components/Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

const VERSION = '0.1.0';
const GITHUB = 'https://github.com/ewanc26/balla';
const ISSUES = 'https://github.com/ewanc26/balla/issues';
const ADVISORY = 'https://github.com/ewanc26/balla/security/advisories/new';
const SUPPORT = 'https://ewancroft.uk/support';

export function SettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const { preferences, setRequireAltText } = usePreferences();
  const selectedEra = eraFor(preferences.era);
  const selectedAccent = accentFor(preferences.accent);
  const { unreadCounts } = useModerationInboxUnread();
  const { pinnedFeeds } = useFeeds();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Settings & privacy' });
  }, [navigation]);

  function openInfo(topic: string, title: string) {
    navigation.navigate('Info', { topic, title });
  }

  function openTab(screen: string) {
    navigation.navigate('Tabs', { screen });
  }

  function openUrl(url: string) {
    void Linking.openURL(url).catch(() => {
      // If the platform cannot open the link, leave the settings screen intact.
    });
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Pressable
          onPress={() => openTab('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          style={({ pressed }) => [
            styles.profileRow,
            { backgroundColor: pressed ? p.bg : 'transparent' },
          ]}
        >
          <Avatar
            avatar={profile && profile.avatar}
            displayName={(profile && (profile.displayName || profile.handle)) || 'You'}
            size={52}
          />
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
              {(profile && (profile.displayName || profile.handle)) || 'Your account'}
            </Text>
            <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {profile && profile.handle ? `@${profile.handle}` : 'AT Protocol account'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.secondary} />
        </Pressable>
      </View>

      <Section title="Account">
        <Row
          icon="person-outline"
          label="Your profile"
          detail="Posts, replies and account information"
          onPress={() => openTab('Profile')}
        />
        <Row
          icon="create-outline"
          label="Edit profile"
          detail="Name, bio, pronouns, links, photo and banner"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <Row
          icon="at-outline"
          label="Handle"
          value={profile && profile.handle ? `@${profile.handle}` : 'Not loaded'}
        />
        <Row
          icon="shield-checkmark-outline"
          label="Account and security"
          detail="OAuth sessions and sign-in"
          onPress={() => openInfo('security', 'Account and security')}
        />
        <Row
          icon="download-outline"
          label="Export, deactivate or delete"
          detail="Account lifecycle and what stays on your PDS"
          onPress={() => navigation.navigate('AccountLifecycle')}
        />
      </Section>

      <Section title="Privacy and security">
        <Row
          icon="lock-closed-outline"
          label="Privacy policy"
          detail="What stays on your device and what leaves it"
          onPress={() => openInfo('privacy', 'Privacy policy')}
        />
        <Row
          icon="key-outline"
          label="Session security"
          detail="No app passwords; DPoP-bound OAuth tokens"
          onPress={() => openInfo('session', 'Session security')}
        />
      </Section>

      <Section title="Moderation">
        <Row
          icon="mail-unread-outline"
          label="Moderation inbox"
          detail="Reports, decisions, notices, appeals and account standing"
          value={
            unreadCounts
              ? `${unreadCounts.total || 0} unread`
              : undefined
          }
          onPress={() => navigation.navigate('ModerationInbox')}
        />
        <Row
          icon="flag-outline"
          label="Moderation tools"
          detail="Labels, warnings, reporting, blocks and mutes"
          onPress={() => openInfo('moderation', 'Moderation tools')}
        />
        <Row
          icon="ban-outline"
          label="Blocked and muted accounts"
          detail="Manage accounts from their profile menus"
          onPress={() => openInfo('accounts', 'Blocked and muted accounts')}
        />
      </Section>

      <Section title="Notifications">
        <Row
          icon="notifications-outline"
          label="Notification settings"
          detail="Likes, follows, replies, mentions and who can notify you"
          onPress={() => navigation.navigate('NotificationSettings')}
        />
        <Row
          icon="list-outline"
          label="Open notifications"
          detail="All, people you follow, replies, follows and alerts"
          onPress={() => openTab('Notifications')}
        />
      </Section>

      <Section title="Content and media">
        <Row
          icon="eye-off-outline"
          label="Content filters"
          detail="Labelers, adult content, label behaviour and muted words"
          onPress={() => navigation.navigate('ContentFilters')}
        />
        <Row
          icon="images-outline"
          label="Media"
          detail="Post up to 10 photos with descriptions; images open full-screen"
        />
      </Section>

      <Section title="Feeds">
        <Row
          icon="albums-outline"
          label="Saved feeds"
          detail="Pin custom feeds to Home, reorder them or discover new ones"
          value={`${pinnedFeeds.length} pinned`}
          onPress={() => navigation.navigate('Feeds')}
        />
        <Row
          icon="list-outline"
          label="Lists"
          detail="Curate people, read list feeds and manage moderation lists"
          onPress={() => navigation.navigate('Lists')}
        />
      </Section>

      <Section title="Appearance and accessibility">
        <Row
          icon="color-palette-outline"
          label="Appearance"
          detail={`${selectedEra.label} era · ${selectedAccent.label} accent`}
          value="Change"
          onPress={() => navigation.navigate('Appearance')}
        />
        <Row icon="contrast-outline" label="Theme" value="Follow system" />
        <Row icon="text-outline" label="Text size" value="Device setting" />
        <Row
          icon="accessibility-outline"
          label="Accessibility"
          detail="Touch targets, screen-reader labels and motion"
          onPress={() => openInfo('accessibility', 'Accessibility')}
        />
        <PreferenceRow
          icon="text-outline"
          label="Require alt text before posting"
          detail="Do not publish photos without a description"
          value={preferences.requireAltText}
          onValueChange={setRequireAltText}
        />
      </Section>

      <Section title="Languages">
        <Row icon="language-outline" label="App language" value="English (UK)" />
        <Row
          icon="chatbubble-ellipses-outline"
          label="Post languages"
          detail="Language controls in the composer are still to come"
        />
      </Section>

      <Section title="Help and support">
        <Row
          icon="heart-outline"
          label="Support Balla"
          detail="One-off or recurring support for independent software"
          onPress={() => openUrl(SUPPORT)}
        />
        <Row
          icon="help-circle-outline"
          label="Help"
          detail="Reporting, blocking and finding your way"
          onPress={() => openInfo('help', 'Help')}
        />
        <Row
          icon="document-text-outline"
          label="How reports work"
          detail="Where reports go and what Balla stores"
          onPress={() => openInfo('reporting', 'How reports work')}
        />
        <Row
          icon="bug-outline"
          label="Report a problem"
          detail="Public issue tracker"
          onPress={() => openUrl(ISSUES)}
        />
        <Row
          icon="terms-outline"
          label="Terms"
          onPress={() => openInfo('terms', 'Terms')}
        />
        <Row
          icon="people-outline"
          label="Community guidelines"
          onPress={() => openInfo('guidelines', 'Community guidelines')}
        />
        <Row
          icon="copyright-outline"
          label="Copyright"
          onPress={() => openInfo('copyright', 'Copyright')}
        />
        <Row
          icon="mail-outline"
          label="Contact and security"
          detail="Monitored project contact routes"
          onPress={() => openInfo('contact', 'Contact and security')}
        />
      </Section>

      <Section title="About">
        <Row icon="information-circle-outline" label="About Balla" value={`Version ${VERSION}`} />
        <Row
          icon="code-slash-outline"
          label="Source code"
          detail="Independent AT Protocol software"
          onPress={() => openUrl(GITHUB)}
        />
        <Row
          icon="shield-outline"
          label="Security advisory"
          detail="Private route for security and privacy reports"
          onPress={() => openUrl(ADVISORY)}
        />
      </Section>

      {confirmSignOut ? (
        <View
          style={[
            styles.confirmCard,
            { backgroundColor: p.card, borderColor: p.danger },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
            Sign out of Balla?
          </Text>
          <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
            The local OAuth session will be removed and Balla will ask your server to
            revoke it. Your posts and account stay on your PDS.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={() => setConfirmSignOut(false)}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Cancel sign out"
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: p.bg,
                  borderColor: p.divider,
                  opacity: pressed || signingOut ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void signOut()}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Balla"
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: p.danger,
                  borderColor: p.danger,
                  opacity: pressed || signingOut ? 0.6 : 1,
                },
              ]}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                  Sign out
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirmSignOut(true)}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.signOut,
            {
              backgroundColor: p.card,
              borderColor: p.divider,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={p.danger} />
          <Text style={{ color: p.danger, fontSize: 15, fontWeight: '600', marginLeft: 10 }}>
            Sign out
          </Text>
        </Pressable>
      )}

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 24, marginTop: 18 }}>
        Balla is independent software. Facebook-era styling is a design reference only, and Bluesky references identify the network Balla uses. Balla is not affiliated with, endorsed by or sponsored by Meta or Bluesky Social PBC.
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: p.secondary,
          fontSize: 13,
          fontWeight: '700',
          paddingHorizontal: 18,
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  value,
  danger,
  onPress,
}: {
  icon: any;
  label: string;
  detail?: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const p = usePalette();
  const content = (
    <>
      <View style={[styles.iconBubble, { backgroundColor: danger ? 'rgba(228, 30, 63, 0.1)' : p.accentSoft }]}>
        <Ionicons name={icon} size={19} color={danger ? p.danger : p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: danger ? p.danger : p.text, fontSize: 15, fontWeight: '600' }}>
          {label}
        </Text>
        {detail ? (
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ color: p.secondary, fontSize: 13, marginLeft: 8 }} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={17} color={p.secondary} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, { borderBottomColor: p.divider }]}>{content}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: p.divider, backgroundColor: pressed ? p.bg : 'transparent' },
      ]}
    >
      {content}
    </Pressable>
  );
}

function PreferenceRow({
  icon,
  label,
  detail,
  value,
  onValueChange,
}: {
  icon: any;
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const p = usePalette();
  return (
    <View style={[styles.row, { borderBottomColor: p.divider }]}>
      <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
        <Ionicons name={icon} size={19} color={p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
          {label}
        </Text>
        <Text
          style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 }}
        >
          {detail}
        </Text>
      </View>
      <Pressable
        onPress={() => onValueChange(!value)}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={({ pressed }) => [
          styles.prefToggle,
          {
            backgroundColor: value ? p.accent : p.soft,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.prefKnob,
            {
              backgroundColor: p.card,
              alignSelf: value ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginHorizontal: 8,
    padding: 16,
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    minHeight: 56,
    marginHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  prefToggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  prefKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
