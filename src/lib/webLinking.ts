/**
 * Web-only deep links for the exported client. Native navigation stays exactly
 * as it is: App.tsx passes this to NavigationContainer only on the web.
 *
 * The client is served under /app, so every prefix keeps that base. React
 * Navigation encodes each param as a single URI segment, which keeps AT URIs
 * (with ':' and '/') intact through a share, a refresh or browser history
 * without inventing a second encoding here.
 */

export const WEB_BASE_PATH = '/app';

export const WEB_PREFIXES: string[] = [
  `https://balla.croft.click${WEB_BASE_PATH}`,
  WEB_BASE_PATH,
];

/**
 * Every Stack and tab screen has an explicit path so no screen silently stays
 * at /app. Identifier params live in the path; descriptive params (titles,
 * quote objects, purposes) fall through to the query string as React
 * Navigation already does.
 */
export const WEB_LINKING_CONFIG = {
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
    Thread: 'post/:uri',
    InteractionSettings: 'post/:uri/interaction',
    UserProfile: 'profile/:actor',
    Compose: 'compose',
    Settings: 'settings',
    Accounts: 'settings/accounts',
    AddAccount: 'settings/accounts/add',
    Appearance: 'appearance',
    AccessibilitySettings: 'settings/accessibility',
    LanguageSettings: 'settings/languages',
    FeedPreferences: 'settings/following',
    ThreadPreferences: 'settings/threads',
    Info: 'info/:topic',
    PeopleList: 'people/:mode/:actor',
    EngagementList: 'engagement/:mode/:uri',
    ContentFilters: 'content-filters',
    AccountLifecycle: 'account',
    AccountSettings: 'settings/account',
    PrivacySecurity: 'settings/privacy-security',
    SessionSecurity: 'settings/session',
    NotificationSettings: 'notification-settings',
    EditProfile: 'edit-profile',
    ModerationInbox: 'moderation',
    ModerationReport: 'moderation/report',
    ModerationNotice: 'moderation/notice',
    ReportReceipts: 'report-receipts',
    FeedGenerator: 'feed/:feed',
    Feeds: 'feeds',
    StarterPack: 'starter-pack/:uri',
    StarterPackEdit: 'starter-pack-edit/:uri',
    Lists: 'lists',
    ListDetail: 'list/:uri',
    ListEdit: 'list/:uri/edit',
    ListMembers: 'list/:uri/members',
  },
};

export const webLinking = {
  prefixes: WEB_PREFIXES,
  config: WEB_LINKING_CONFIG,
};
