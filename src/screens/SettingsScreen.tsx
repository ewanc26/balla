import React, { useLayoutEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { openExternalUrl } from '../lib/openLink';
import { Ionicons } from '@expo/vector-icons';
import { useViewer } from '../lib/viewer';
import { usePreferences } from '../lib/preferences';
import { useModerationInboxUnread } from '../lib/moderationInbox';
import { useFeeds } from '../lib/feedsContext';
import { accentFor, eraFor } from '../lib/themeModel';
import { Avatar } from '../components/Avatar';
import { SignOutControl } from '../components/SignOutControl';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { APP_VERSION } from '../lib/version';
const GITHUB = 'https://github.com/ewanc26/balla';
const ISSUES = 'https://github.com/ewanc26/balla/issues';
const ADVISORY = 'https://github.com/ewanc26/balla/security/advisories/new';
const SUPPORT = 'https://ewancroft.uk/support';

export function SettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const { preferences } = usePreferences();
  const selectedEra = eraFor(preferences.era);
  const selectedAccent = accentFor(preferences.accent);
  const { unreadCounts } = useModerationInboxUnread();
  const { pinnedFeeds } = useFeeds();

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
    void openExternalUrl(url).catch(() => {
      // If the platform cannot open the link, leave the settings screen intact.
    });
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
          icon="people-outline"
          label="Accounts"
          detail="Switch, add or remove accounts on this device"
          onPress={() => navigation.navigate('Accounts')}
        />
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
          onPress={() => navigation.navigate('AccountSettings')}
        />
        <Row
          icon="shield-checkmark-outline"
          label="Account and security"
          detail="Identity, birthday, automation label and provider controls"
          onPress={() => navigation.navigate('AccountSettings')}
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
          icon="eye-off-outline"
          label="Privacy and security controls"
          detail="2FA, app passwords, activity privacy and notifications"
          onPress={() => navigation.navigate('PrivacySecurity')}
        />
        <Row
          icon="lock-closed-outline"
          label="Privacy policy"
          detail="What stays on your device and what leaves it"
          onPress={() => openInfo('privacy', 'Privacy policy')}
        />
        <Row
          icon="key-outline"
          label="Session security"
          detail="OAuth session facts, scope count and sign-out"
          onPress={() => navigation.navigate('SessionSecurity')}
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
          icon="receipt-outline"
          label="Your report receipts"
          detail="Local reminders of reports sent from this device"
          onPress={() => navigation.navigate('ReportReceipts')}
        />
        <Row
          icon="ban-outline"
          label="Blocked and muted accounts"
          detail="Review and remove blocked or muted accounts"
          onPress={() => navigation.navigate('BlockedAccounts')}
        />
        <Row
          icon="options-outline"
          label="Default interaction settings"
          detail="Who can reply and quote your new posts"
          onPress={() => navigation.navigate('DefaultInteractionSettings')}
        />
        <Row
          icon="shield-checkmark-outline"
          label="Verification settings"
          detail="Choose whether verification badges appear"
          onPress={() => navigation.navigate('VerificationSettings')}
        />
        <Row
          icon="bulb-outline"
          label="Your interests"
          detail="Topics that help Bluesky choose what to show you"
          onPress={() => navigation.navigate('InterestsSettings')}
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
          icon="options-outline"
          label="Content and media"
          detail="Saved feeds, thread and Following preferences, interests, links and autoplay"
          onPress={() => navigation.navigate('ContentAndMediaSettings')}
        />
        <Row
          icon="eye-off-outline"
          label="Content filters"
          detail="Labelers, adult content, label behaviour and muted words"
          onPress={() => navigation.navigate('ContentFilters')}
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
        <Row
          icon="accessibility-outline"
          label="Accessibility"
          detail="Description badges, alt text requirements and motion"
          onPress={() => navigation.navigate('AccessibilitySettings')}
        />
        <Row
          icon="apps-outline"
          label="App Icon"
          detail="Choose the default or dark app icon on this device"
          onPress={() => navigation.navigate('AppIconSettings')}
        />
      </Section>

      <Section title="Languages">
        <Row
          icon="language-outline"
          label="Languages"
          detail="Primary language for new posts and translation; languages to keep in Following"
          onPress={() => navigation.navigate('LanguageSettings')}
        />
      </Section>

      <Section title="Reading">
        <Row
          icon="swap-horizontal-outline"
          label="Following feed"
          detail="Hide replies, reposts or quote posts without changing the order"
          onPress={() => navigation.navigate('FeedPreferences')}
        />
        <Row
          icon="chatbubble-outline"
          label="Thread order"
          detail="Oldest, newest or most liked replies"
          onPress={() => navigation.navigate('ThreadPreferences')}
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
        <Row
          icon="information-circle-outline"
          label="About Balla"
          value={`Version ${APP_VERSION}`}
          onPress={() => openInfo('about', 'About Balla')}
        />
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

      <SignOutControl />

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
});
