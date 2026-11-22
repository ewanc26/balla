import React, { useLayoutEffect } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { APP_VERSION } from '../lib/version';

const GITHUB = 'https://github.com/ewanc26/balla';
const ISSUES = 'https://github.com/ewanc26/balla/issues';
const ADVISORY = 'https://github.com/ewanc26/balla/security/advisories/new';
const PRIVACY = 'https://balla.croft.click/privacy';
const TERMS = 'https://balla.croft.click/terms';
const GUIDELINES = 'https://balla.croft.click/guidelines';
const COPYRIGHT = 'https://balla.croft.click/copyright';
const SUPPORT = 'https://ewancroft.uk/support';

type Topic = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  link?: { label: string; url: string };
  links?: { label: string; url: string }[];
};

const TOPICS: Record<string, Topic> = {
  privacy: {
    title: 'Privacy policy',
    paragraphs: [
      'Balla is a client for the AT Protocol. It does not run a server that stores your posts, profile or social graph. Your content remains on your PDS and is shown through Bluesky’s AppView.',
      'Your OAuth session, including DPoP keys and tokens, stays in the app’s local storage. The last signed-in DID is kept only so the app can restore the session.',
      'Balla does not ask for or store your password. Signing out removes the local DID and asks your server to revoke the OAuth session.',
      'Balla adds no analytics, advertising or tracking SDK. Requests go to your PDS, Bluesky’s AppView and the labeler used for reports.',
    ],
    link: { label: 'Open the full privacy page', url: PRIVACY },
  },
  security: {
    title: 'Account and security',
    paragraphs: [
      'Balla uses OAuth only. It does not support app passwords, so there is no password-equivalent secret stored in the app.',
      'The Account and security screen shows the identity Balla can read and writes birthday, automation and visibility self-labels through real profile and personal-details APIs.',
      'The app refreshes the session at startup so a revoked grant is noticed early. A failed refresh removes the remembered DID rather than silently keeping a dead session.',
      'Email, password, two-factor authentication and app passwords are not available through Balla. Settings links to the provider controls instead of showing toggles Balla cannot honour. Export, deactivate or delete explains the PDS-owned account lifecycle.',
    ],
  },
  session: {
    title: 'Session security',
    paragraphs: [
      'Signing in opens your server’s OAuth page. Balla never sees your password.',
      'Settings → Session security shows non-secret token metadata: your DID, authorization server, PDS, expiry and scope count. Access and refresh tokens are never displayed.',
      'The client requests only the record collections and AppView endpoints it uses, plus the report audience for Bluesky’s labeler. Sessions authorised before the granular scope was introduced need one fresh sign-in to receive it.',
      'Signing out revokes the OAuth session where the server allows it and always clears the local session. It does not delete your account or posts.',
    ],
  },
  moderation: {
    title: 'Moderation tools',
    paragraphs: [
      'Balla applies Bluesky labels before content is shown. `!hide` content is removed with no reveal, `!warn` content is covered by a warning, and media or profile labels can blur independently.',
      'Reports from posts and profiles go to Bluesky’s labeler through `com.atproto.moderation.createReport`. Reports are not stored in Balla.',
      'Blocking and muting are server-side actions. Balla removes the affected account from the current feed, search, saved posts, threads and notifications immediately.',
    ],
    bullets: [
      'Use the overflow menu on a post for report, mute, block, share, quote and delete.',
      'Use the overflow menu on a profile for report, mute, block, unblock and unmute.',
      'Settings → Content filters lists the Bluesky labeler and any custom labelers, with per-label Show, Warn and Hide controls.',
    ],
  },
  accounts: {
    title: 'Blocked and muted accounts',
    paragraphs: [
      'Balla does not keep a separate local block list. The server’s viewer state is the source of truth.',
      'Open a profile’s overflow menu to block, unblock, mute or unmute that account. Blocked profiles cannot be followed from Balla.',
      'A dedicated list for reviewing every blocked and muted account is still to come; until then, manage them from their profiles.',
    ],
  },
  notifications: {
    title: 'Notification settings',
    paragraphs: [
      'The Notifications screen has All, People I follow, Replies, Follows and Post alerts tabs. It shows a real unread count and can mark everything seen through Bluesky’s API.',
      'Repeated likes, reposts and follows are grouped while retaining the names of the people involved.',
      'Settings → Notification settings edits per-category in-app and server-side push preferences, including whether everyone or only people you follow can trigger them. Balla does not register this device for push yet; notification permissions are controlled by your operating system or browser.',
    ],
  },
  content: {
    title: 'Content filters',
    paragraphs: [
      'Balla reads the label preferences and adult-content setting already stored in your Bluesky account. It does not maintain a second set of filters.',
      'The default Bluesky labeler supplies the built-in labels and their definitions. Custom labels from subscribed labelers are loaded at sign-in.',
      'Settings → Content filters edits these preferences in Balla, including labeler subscriptions, per-label behaviour, adult content and muted words.',
    ],
  },
  accessibility: {
    title: 'Accessibility',
    paragraphs: [
      'Visible controls are at least 44 points, with screen-reader labels on the post, profile and settings actions.',
      'Text scaling, reduced motion and focus behaviour follow the platform where the app can inherit them. A full accessibility audit and explicit font-size controls remain open work.',
    ],
  },
  help: {
    title: 'Help',
    paragraphs: [
      'To report a post, open its overflow menu and choose Report post. To report an account, open the profile menu and choose Report account.',
      'To stop seeing an account, mute it. To stop it interacting with you, block it. Both actions are reversible from the same menu.',
      'If something is broken, use the public issue tracker. For a security or privacy problem that should not be public, use the private advisory form.',
    ],
    link: { label: 'Report a problem', url: ISSUES },
  },
  reporting: {
    title: 'How reports work',
    paragraphs: [
      'Reports are sent directly to Bluesky’s moderation labeler with the post strongRef or account repoRef. Balla does not operate a moderation queue and does not store a local report receipt.',
      'The labeler decides what happens next. Balla does not invent a decision, account standing or appeal state.',
      'Report handling and retention are documented in the repository. Use the issue tracker for project contact and the private advisory form for security or privacy reports.',
    ],
    link: { label: 'Contact the project', url: ISSUES },
  },
  terms: {
    title: 'Terms',
    paragraphs: [
      'Balla is free, independent software for using the AT Protocol. It is provided as-is, without a warranty that it will be uninterrupted or error-free.',
      'Your account, posts and social graph are governed by your PDS and Bluesky’s terms. Balla does not grant you rights to other people’s content.',
      'Do not use Balla to harass people, evade blocks, spam, scrape at scale or break the law. The source is licensed under AGPL-3.0.',
    ],
    link: { label: 'Read the full terms', url: TERMS },
  },
  guidelines: {
    title: 'Community guidelines',
    paragraphs: [
      'Treat people as people. Harassment, threats, targeted abuse, spam and evading blocks are not acceptable.',
      'Use content labels honestly, especially for adult or graphic media. Report content rather than reposting it to shame someone.',
      'Balla does not employ moderators and does not host your posts. Bluesky and labelers make moderation decisions; Balla gives you the controls to report, block and mute.',
    ],
    link: { label: 'Read the full guidelines', url: GUIDELINES },
  },
  copyright: {
    title: 'Copyright',
    paragraphs: [
      'Balla does not host posts, images or other user content. That content lives on the author’s PDS and is displayed through Bluesky.',
      'To report allegedly infringing content, use Bluesky’s reporting tools or contact the hosting PDS. Balla cannot remove another account’s records.',
      'For a copyright concern about Balla’s own code or site, use the public issue tracker. Include the relevant URL and enough detail to identify the work.',
    ],
    link: { label: 'Open copyright page', url: COPYRIGHT },
  },
  contact: {
    title: 'Contact and security',
    paragraphs: [
      'The public contact route is the Balla issue tracker. It is also the place for bugs, feature requests and general project questions.',
      'For a security or privacy report that should not be public, use GitHub’s private security advisory form.',
      'Balla is independent software. References to Bluesky identify the network Balla connects to; they do not imply affiliation, endorsement, official status or partnership. Facebook-era styling is a visual reference only. Balla is not affiliated with Bluesky Social PBC or Meta Platforms, Inc.',
    ],
    link: { label: 'Open the issue tracker', url: ISSUES },
  },
  about: {
    title: 'About Balla',
    paragraphs: [
      'Balla is a chronological, Facebook-inspired client for Bluesky and the AT Protocol. Facebook-era styling is a visual reference, not a claim of affiliation. Balla is independent software, not an official Bluesky client or a Meta product.',
      'References to Bluesky identify the open network and protocol Balla uses. They do not make Balla official or endorsed. All product names and marks belong to their owners.',
      `Version ${APP_VERSION}. The client is built with Expo and React Native, with OAuth and DPoP handled by @atproto/oauth-client-expo.`,
      'No ranking, ads, suggested posts or injected content. The Following timeline stays newest-first.',
      'Balla is independent software supported by readers. One-off and recurring support is handled at ewancroft.uk/support.',
    ],
    link: { label: 'View the source', url: GITHUB },
    links: [{ label: 'Support Balla', url: SUPPORT }],
  },
};

export function InfoScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const topicKey = String((route.params && route.params.topic) || 'help');
  const topic = TOPICS[topicKey] || TOPICS.help;
  const title = (route.params && route.params.title) || topic.title;

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 24, fontWeight: '700' }}>{topic.title}</Text>
        {topic.paragraphs.map((paragraph) => (
          <Text
            key={paragraph}
            style={{ color: p.text, fontSize: 15, lineHeight: 23, marginTop: 12 }}
          >
            {paragraph}
          </Text>
        ))}
        {topic.bullets ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {topic.bullets.map((bullet) => (
              <View key={bullet} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ color: p.accent, fontSize: 16, lineHeight: 21 }}>•</Text>
                <Text
                  style={{
                    color: p.text,
                    fontSize: 14,
                    lineHeight: 21,
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  {bullet}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {topic.link ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(topic.link!.url).catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel={topic.link.label}
            style={({ pressed }) => [
              styles.linkButton,
              { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              {topic.link.label}
            </Text>
            <Ionicons name="open-outline" size={18} color={p.accent} style={{ marginLeft: 6 }} />
          </Pressable>
        ) : null}
        {topic.links?.map((link) => (
          <Pressable
            key={link.label}
            onPress={() => {
              void Linking.openURL(link.url).catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel={link.label}
            style={({ pressed }) => [
              styles.linkButton,
              { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              {link.label}
            </Text>
            <Ionicons name="open-outline" size={18} color={p.accent} style={{ marginLeft: 6 }} />
          </Pressable>
        ))}
        <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 18 }}>
          Plain-language project policy, not legal advice. Last updated 21 November 2026.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  linkButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
});
