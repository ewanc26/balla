/**
 * Web-only deep links for the exported client. Native navigation stays exactly
 * as it is: App.tsx passes this to NavigationContainer only on the web.
 *
 * The client is served under /app, so every prefix keeps that base. React
 * Navigation encodes each param as a single URI segment, which keeps AT URIs
 * (with ':' and '/') intact through a share, a refresh or browser history
 * without inventing a second encoding here.
 */

import { SERVICE_HOSTS } from './serviceHosts.ts';

export const WEB_BASE_PATH = '/app';

export const WEB_PREFIXES: string[] = [
  `https://balla.croft.click${WEB_BASE_PATH}`,
  WEB_BASE_PATH,
];

/**
 * Never written to the address, and ignored if a link carries it. The library
 * types serialisers as returning a string, but it omits an undefined one.
 */
const memoryOnly = () => undefined as unknown as string;

/** A label that sits beside an identifier comes from the app, never a link. */
const appOnly = (name: string) => ({
  parse: { [name]: memoryOnly },
  stringify: { [name]: memoryOnly },
});

/** The grant names one moderation service, so a link may not name another. */
const MODERATION_ADDRESS = {
  parse: {
    moderationService: (value: string) =>
      value === SERVICE_HOSTS.labelerDid ? value : '',
  },
};

/**
 * Every Stack and tab screen has an explicit path so no screen silently stays
 * at /app. Identifier params live in the path; descriptive params (titles,
 * quote objects, purposes) fall through to the query string as React
 * Navigation already does.
 */
export const WEB_LINKING_CONFIG = {
  // On the web React Navigation parses location.pathname and ignores
  // `prefixes`, so the base has to be declared here too.
  path: WEB_BASE_PATH,
  // A deep-linked screen sits on top of Home, so it always has a back button.
  initialRouteName: 'Tabs',
  screens: {
    Tabs: {
      screens: {
        Home: '',
        Search: 'search',
        Notifications: 'notifications',
        Saved: 'saved',
        Profile: 'profile',
      },
    },
    EditPost: 'post/:uri/edit',
    Thread: 'post/:uri',
    Memories: 'memories',
    StandardSite: 'standard-site/:uri',
    InteractionSettings: 'post/:uri/interaction',
    VerificationSettings: 'settings/verification',
    InterestsSettings: 'settings/interests',
    DefaultInteractionSettings: 'settings/interaction-defaults',
    BlockedAccounts: 'settings/blocked-accounts',
    UserProfile: 'profile/:actor',
    // A quote is a whole post view, which a single URL segment cannot carry.
    Compose: { path: 'compose', ...appOnly('quote') },
    Settings: 'settings',
    Advanced: 'settings/advanced',
    Backend: 'settings/advanced/backend',
    MediaOrigin: 'settings/advanced/media',
    IdentitySettings: 'settings/advanced/identity',
    ChatService: 'settings/advanced/chat',
    Hosting: 'settings/advanced/hosting',
    MigrationPreflight: 'settings/advanced/migration-preflight',
    PdsDirectory: 'settings/advanced/pds-directory',
    Services: 'settings/advanced/services',
    AppView: 'settings/advanced/appview',
    AccountPreflight: 'settings/advanced/account-preflight',
    Accounts: 'settings/accounts',
    AddAccount: 'settings/accounts/add',
    Appearance: 'appearance',
    AccessibilitySettings: 'settings/accessibility',
    AppIconSettings: 'settings/app-icon',
    LanguageSettings: 'settings/languages',
    FeedPreferences: 'settings/following',
    ThreadPreferences: 'settings/threads',
    // The topic supplies the title; a link must not be able to word a header.
    Info: { path: 'info/:topic', ...appOnly('title') },
    PeopleList: 'people/:mode/:actor',
    EngagementList: 'engagement/:mode/:uri',
    ContentFilters: 'content-filters',
    AccountLifecycle: 'account',
    AccountSettings: 'settings/account',
    PrivacySecurity: 'settings/privacy-security',
    ContentAndMediaSettings: 'settings/content-and-media',
    ActivityPrivacy: 'settings/activity-privacy',
    SessionSecurity: 'settings/session',
    NotificationSettings: 'notification-settings',
    ActivityNotifications: 'notification-settings/activity',
    EditProfile: 'edit-profile',
    ModerationInbox: 'moderation',
    ModerationReport: { path: 'moderation/report', ...MODERATION_ADDRESS },
    ModerationNotice: { path: 'moderation/notice', ...MODERATION_ADDRESS },
    ReportReceipts: 'report-receipts',
    FeedGenerator: 'feed/:feed',
    Feeds: 'feeds',
    Hashtag: 'hashtag/:tag',
    Topic: 'topic/:topic',
    VideoFeed: 'video',
    Discover: 'discover',
    News: 'news',
    NewsBundle: 'news/:topic/:region',
    StarterPack: 'starter-pack/:uri',
    StarterPackEdit: 'starter-pack-edit/:uri',
    Lists: { path: 'lists', ...appOnly('handle') },
    ListDetail: 'list/:uri',
    // Optional: a new list has no URI yet.
    ListEdit: 'list/:uri?/edit',
    ListMembers: { path: 'list/:uri/members', ...appOnly('name') },
    Chat: 'messages',
    Conversation: 'messages/:convoId',
    ChatSettings: 'messages/settings',
    ChatNotificationSettings: 'messages/settings/notifications',
    CreateGroup: 'messages/new-group',
    JoinGroup: 'messages/join',
    JoinRequests: 'messages/:convoId/requests',
    ConversationSettings: 'messages/:convoId/settings',
  },
};

export const webLinking = {
  prefixes: WEB_PREFIXES,
  config: WEB_LINKING_CONFIG,
};
