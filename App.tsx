import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { BookmarksScreen } from './src/screens/BookmarksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ThreadScreen } from './src/screens/ThreadScreen';
import { StandardSiteScreen } from './src/screens/StandardSiteScreen';
import { ComposeScreen } from './src/screens/ComposeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AdvancedScreen } from './src/screens/AdvancedScreen';
import { BackendScreen } from './src/screens/BackendScreen';
import { MediaOriginScreen } from './src/screens/MediaOriginScreen';
import { IdentitySettingsScreen } from './src/screens/IdentitySettingsScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { AddAccountScreen } from './src/screens/AddAccountScreen';
import { InfoScreen } from './src/screens/InfoScreen';
import { PeopleListScreen } from './src/screens/PeopleListScreen';
import { EngagementListScreen } from './src/screens/EngagementListScreen';
import { ContentFiltersScreen } from './src/screens/ContentFiltersScreen';
import { ContentAndMediaSettingsScreen } from './src/screens/ContentAndMediaSettingsScreen';
import { AccountLifecycleScreen } from './src/screens/AccountLifecycleScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { MigrationPreflightScreen } from './src/screens/MigrationPreflightScreen';
import { PrivacySecurityScreen } from './src/screens/PrivacySecurityScreen';
import { ActivityPrivacyScreen } from './src/screens/ActivityPrivacyScreen';
import { SessionSecurityScreen } from './src/screens/SessionSecurityScreen';
import { NotificationSettingsScreen } from './src/screens/NotificationSettingsScreen';
import { ActivityNotificationsScreen } from './src/screens/ActivityNotificationsScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { ModerationInboxScreen } from './src/screens/ModerationInboxScreen';
import { ModerationReportScreen } from './src/screens/ModerationReportScreen';
import { ModerationNoticeScreen } from './src/screens/ModerationNoticeScreen';
import { ReportReceiptsScreen } from './src/screens/ReportReceiptsScreen';
import { FeedGeneratorScreen } from './src/screens/FeedGeneratorScreen';
import { FeedsScreen } from './src/screens/FeedsScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { AppearanceScreen } from './src/screens/AppearanceScreen';
import { AccessibilitySettingsScreen } from './src/screens/AccessibilitySettingsScreen';
import { AppIconSettingsScreen } from './src/screens/AppIconSettingsScreen';
import { LanguageSettingsScreen } from './src/screens/LanguageSettingsScreen';
import { FeedPreferencesScreen } from './src/screens/FeedPreferencesScreen';
import { ThreadPreferencesScreen } from './src/screens/ThreadPreferencesScreen';
import { StarterPackScreen } from './src/screens/StarterPackScreen';
import { StarterPackEditScreen } from './src/screens/StarterPackEditScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { ChatSettingsScreen } from './src/screens/ChatSettingsScreen';
import { ChatServiceScreen } from './src/screens/ChatServiceScreen';
import { HostingScreen } from './src/screens/HostingScreen';
import { PdsDirectoryScreen } from './src/screens/PdsDirectoryScreen';
import { ServicesScreen } from './src/screens/ServicesScreen';
import { AppViewScreen } from './src/screens/AppViewScreen';
import { AccountPreflightScreen } from './src/screens/AccountPreflightScreen';
import { ChatNotificationSettingsScreen } from './src/screens/ChatNotificationSettingsScreen';
import { CreateGroupScreen } from './src/screens/CreateGroupScreen';
import { JoinGroupScreen } from './src/screens/JoinGroupScreen';
import { JoinRequestsScreen } from './src/screens/JoinRequestsScreen';
import { ConversationSettingsScreen } from './src/screens/ConversationSettingsScreen';
import { ListsScreen } from './src/screens/ListsScreen';
import { ListDetailScreen } from './src/screens/ListDetailScreen';
import { ListEditScreen } from './src/screens/ListEditScreen';
import { ListMembersScreen } from './src/screens/ListMembersScreen';
import { InteractionSettingsScreen } from './src/screens/InteractionSettingsScreen';
import { VerificationSettingsScreen } from './src/screens/VerificationSettingsScreen';
import { InterestsSettingsScreen } from './src/screens/InterestsSettingsScreen';
import { DefaultInteractionSettingsScreen } from './src/screens/DefaultInteractionSettingsScreen';
import { BlockedAccountsScreen } from './src/screens/BlockedAccountsScreen';
import { AppHeader, type TabName } from './src/components/AppHeader';
import { LeftRail, RightRail } from './src/components/AppRail';
import { ViewerProvider } from './src/lib/viewer';
import { ModerationProvider } from './src/lib/moderationContext';
import { FeedsProvider } from './src/lib/feedsContext';
import { PreferencesProvider } from './src/lib/preferences';
import { OpenLinkProvider } from './src/lib/openLink';
import { ViewPreferencesProvider } from './src/lib/viewPreferences';
import { AccountPreferencesProvider } from './src/lib/accountPreferences';
import { restore, setOnAccountChanged, setOnLoggedOut } from './src/lib/agent';
import { invalidateIdentity } from './src/lib/identityCache';
import { installWebAccessibility } from './src/lib/accessibility';
import { webLinking } from './src/lib/webLinking';
import { PREVIEW_WARNING, usePalette, useResolvedScheme } from './src/theme';
import {
  COMPACT_TAB_LABEL_MAX_WIDTH,
  HEADER_SEARCH_MIN_WIDTH,
  READING_COLUMN_MAX_WIDTH,
  navigationLayout,
} from './src/lib/layout';
import {
  MOCK_MODE,
  MOCK_OTHER_ACTOR,
  MOCK_THREAD_URI,
  MOCK_CONVO_ID,
  MOCK_GROUP_CONVO_ID,
  installMockAgent,
  mockInitialScreen,
  mockInitialTab,
} from './src/lib/mock';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

const TAB_NAMES: TabName[] = ['Home', 'Search', 'Notifications', 'Saved', 'Profile'];

function Tabs() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showBottomTabs = navigationLayout(width).bottomTabs;
  // Five equal slots leave too little room for the full word on a phone, and
  // React Navigation truncates a single-line tab label rather than wrapping it.
  const compactLabels = width < COMPACT_TAB_LABEL_MAX_WIDTH;
  const initialTab = (MOCK_MODE ? mockInitialTab() : 'Home') as TabName;

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: p.chromeAction,
        tabBarInactiveTintColor: p.chromeMuted,
        tabBarStyle: showBottomTabs
          ? {
              backgroundColor: p.chrome,
              borderTopColor: p.chromeBorder,
              borderTopWidth: StyleSheet.hairlineWidth,
              height: 64 + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom + 10,
            }
          : { display: 'none' },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
          flexShrink: 1,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color }) => {
          const map: Record<string, [string, string]> = {
            Home: ['home', 'home-outline'],
            Search: ['search', 'search-outline'],
            Notifications: ['notifications', 'notifications-outline'],
            Saved: ['bookmark', 'bookmark-outline'],
            Profile: ['person', 'person-outline'],
          };
          const pair = map[route.name] || ['ellipse', 'ellipse-outline'];
          const name = focused ? pair[0] : pair[1];
          return <Ionicons name={name as any} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: compactLabels ? 'Alerts' : 'Notifications' }}
      />
      <Tab.Screen name="Saved" component={BookmarksScreen} />
      {/* ProfileScreen sets the stack header title to the profile handle, and
          the bottom bar falls back to options.title for a label. Pin the
          label so the tab keeps reading "Profile" instead of the handle. */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const p = usePalette();
  const scheme = useResolvedScheme();
  const { width } = useWindowDimensions();
  const initialTab = (MOCK_MODE ? mockInitialTab() : 'Home') as TabName;
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  // Keying the authenticated tree by account forces every provider, screen and
  // cached list to be rebuilt on a switch, so no session data crosses accounts.
  const [activeDid, setActiveDid] = useState<string | null>(MOCK_MODE ? 'mock' : null);
  const [activeTab, setActiveTab] = useState<TabName>(initialTab);
  const [routeName, setRouteName] = useState<string>(initialTab);

  // Keep the web keyboard focus ring in step with the palette accent. On
  // native this is a no-op; RN's own focus and screen-reader APIs handle it.
  useEffect(() => {
    installWebAccessibility(p.accent);
  }, [p.accent]);

  const layout = navigationLayout(width);
  const showLeft = layout.leftRail;
  const showRight = layout.rightRail;

  useEffect(() => {
    setOnLoggedOut(() => setLoggedIn(false));
    setOnAccountChanged((did) => {
      if (did) {
        // A re-signed-in account may have migrated to a new PDS. Force its DID
        // document to resolve again so stale service endpoints are not reused.
        void invalidateIdentity(did);
        setLoggedIn(true);
        setActiveDid(did);
      } else {
        setLoggedIn(false);
        setActiveDid(null);
      }
    });
    if (MOCK_MODE) {
      installMockAgent();
      setLoggedIn(true);
      setReady(true);
      return;
    }
    restore()
      .then((ok) => setLoggedIn(ok))
      .catch(() => setLoggedIn(false))
      .finally(() => setReady(true));
  }, []);

  const navigateToTab = useCallback((tab: TabName) => {
    setActiveTab(tab);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Tabs', { screen: tab });
    }
  }, []);

  const openSettings = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate('Settings');
  }, []);

  const openLists = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate('Lists');
  }, []);

  const openFeeds = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate('Feeds');
  }, []);

  const openMessages = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate('Chat');
  }, []);

  const syncActiveTab = useCallback(() => {
    const name = navigationRef.getCurrentRoute()?.name || 'Home';
    setRouteName(name);
    if ((TAB_NAMES as string[]).includes(name)) {
      setActiveTab(name as TabName);
    }
  }, []);

  // Mock detail screens are pushed on top of the tabs so their back buttons
  // behave exactly as they do in a real session.
  const openMockScreen = useCallback(() => {
    if (!MOCK_MODE) return;
    const screen = mockInitialScreen();
    if (screen === 'Thread') {
      navigationRef.navigate('Thread', { uri: MOCK_THREAD_URI });
    } else if (screen === 'UserProfile') {
      navigationRef.navigate('UserProfile', { actor: MOCK_OTHER_ACTOR });
    } else if (screen === 'Compose') {
      navigationRef.navigate('Compose');
    } else if (screen === 'Conversation') {
      navigationRef.navigate('Conversation', { convoId: MOCK_CONVO_ID });
    } else if (screen === 'ConversationSettings' || screen === 'JoinRequests') {
      navigationRef.navigate(screen, { convoId: MOCK_GROUP_CONVO_ID });
    } else if (screen === 'Hashtag') {
      navigationRef.navigate('Hashtag', { tag: 'tea' });
    } else if (screen === 'Topic') {
      navigationRef.navigate('Topic', { topic: 'book fair' });
    } else if (screen !== 'Tabs') {
      navigationRef.navigate(screen as any);
    }
  }, []);

  const handleReady = useCallback(() => {
    syncActiveTab();
    if (MOCK_MODE) setTimeout(openMockScreen, 0);
  }, [syncActiveTab, openMockScreen]);

  // Detail screens own their back header; showing the chrome as well would
  // stack two bars on mobile, which Facebook never does.
  const showChrome = (TAB_NAMES as string[]).includes(routeName);

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const customNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: p.bg,
      card: p.card,
      border: p.divider,
      text: p.text,
      primary: p.accent,
    },
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: p.accent }} />;
  }
  if (!loggedIn) {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoggedIn={() => setLoggedIn(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PreferencesProvider key={activeDid ?? 'none'}>
        <OpenLinkProvider>
        <ViewerProvider>
          <ViewPreferencesProvider>
            <AccountPreferencesProvider>
              <ModerationProvider>
                <FeedsProvider>
                  <NavigationContainer
                  ref={navigationRef}
                  linking={Platform.OS === 'web' ? webLinking : undefined}
                  theme={customNavTheme as any}
                  onReady={handleReady}
                  onStateChange={syncActiveTab}
                >
                  <View style={{ flex: 1, backgroundColor: p.bg }}>
                    <StatusBar style={p.chromeIsDark ? 'light' : 'dark'} />
                    {showChrome ? (
                      <AppHeader
                        wide={showLeft}
                        onNavigate={navigateToTab}
                        onOpenSettings={openSettings}
                        onOpenLists={openLists}
                        onOpenFeeds={openFeeds}
                        onOpenMessages={openMessages}
                      />
                    ) : null}
                    {MOCK_MODE ? (
                      <View
                        style={{
                          backgroundColor: PREVIEW_WARNING.background,
                          paddingVertical: 4,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: PREVIEW_WARNING.text, fontSize: 11, fontWeight: '700' }}>
                          Preview · mock data
                        </Text>
                      </View>
                    ) : null}
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
                      {showChrome && showLeft ? (
                        <LeftRail
                          activeTab={activeTab}
                          onNavigate={navigateToTab}
                          onOpenSettings={openSettings}
                          onOpenLists={openLists}
                          onOpenFeeds={openFeeds}
                          onOpenMessages={openMessages}
                        />
                      ) : null}
                      <View style={{ flex: 1, maxWidth: READING_COLUMN_MAX_WIDTH }}>
                        <Stack.Navigator
                          screenOptions={{
                            headerStyle: { backgroundColor: p.chrome },
                            headerTintColor: p.chromeAction,
                            headerTitleStyle: {
                              color: p.chromeText,
                              fontSize: 17,
                              fontWeight: '600',
                            },
                            headerTitleAlign: 'center',
                            headerShadowVisible: false,
                            contentStyle: { backgroundColor: p.bg },
                          }}
                        >
                          <Stack.Screen
                            name="Tabs"
                            component={Tabs}
                            options={{ headerShown: false }}
                          />
                          <Stack.Screen name="Thread" component={ThreadScreen} />
                          <Stack.Screen name="StandardSite" component={StandardSiteScreen} />
                          <Stack.Screen
                            name="InteractionSettings"
                            component={InteractionSettingsScreen}
                          />
                          <Stack.Screen
                            name="VerificationSettings"
                            component={VerificationSettingsScreen}
                          />
                          <Stack.Screen
                            name="InterestsSettings"
                            component={InterestsSettingsScreen}
                          />
                          <Stack.Screen
                            name="DefaultInteractionSettings"
                            component={DefaultInteractionSettingsScreen}
                          />
                          <Stack.Screen
                            name="BlockedAccounts"
                            component={BlockedAccountsScreen}
                          />
                          <Stack.Screen name="Compose" component={ComposeScreen} />
                          <Stack.Screen name="UserProfile" component={ProfileScreen} />
                          <Stack.Screen name="Settings" component={SettingsScreen} />
                          <Stack.Screen name="Advanced" component={AdvancedScreen} />
                          <Stack.Screen name="Backend" component={BackendScreen} />
                          <Stack.Screen name="MediaOrigin" component={MediaOriginScreen} />
                          <Stack.Screen name="IdentitySettings" component={IdentitySettingsScreen} />
                          <Stack.Screen name="ChatService" component={ChatServiceScreen} />
                          <Stack.Screen name="Hosting" component={HostingScreen} />
                          <Stack.Screen name="PdsDirectory" component={PdsDirectoryScreen} />
                          <Stack.Screen name="Services" component={ServicesScreen} />
                          <Stack.Screen name="AppView" component={AppViewScreen} />
                          <Stack.Screen name="AccountPreflight" component={AccountPreflightScreen} />
                          <Stack.Screen name="Accounts" component={AccountsScreen} />
                          <Stack.Screen name="AddAccount" component={AddAccountScreen} />
                          <Stack.Screen name="Appearance" component={AppearanceScreen} />
                          <Stack.Screen name="AccessibilitySettings" component={AccessibilitySettingsScreen} />
                          <Stack.Screen name="AppIconSettings" component={AppIconSettingsScreen} />
                          <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
                          <Stack.Screen name="FeedPreferences" component={FeedPreferencesScreen} />
                          <Stack.Screen name="ThreadPreferences" component={ThreadPreferencesScreen} />
                          <Stack.Screen name="Info" component={InfoScreen} />
                          <Stack.Screen name="PeopleList" component={PeopleListScreen} />
                          <Stack.Screen name="EngagementList" component={EngagementListScreen} />
                          <Stack.Screen name="ContentFilters" component={ContentFiltersScreen} />
                          <Stack.Screen name="ContentAndMediaSettings" component={ContentAndMediaSettingsScreen} />
                          <Stack.Screen name="AccountLifecycle" component={AccountLifecycleScreen} />
                          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
                          <Stack.Screen name="MigrationPreflight" component={MigrationPreflightScreen} />
                          <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
                          <Stack.Screen name="ActivityPrivacy" component={ActivityPrivacyScreen} />
                          <Stack.Screen name="SessionSecurity" component={SessionSecurityScreen} />
                          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
                          <Stack.Screen name="ActivityNotifications" component={ActivityNotificationsScreen} />
                          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                          <Stack.Screen name="ModerationInbox" component={ModerationInboxScreen} />
                          <Stack.Screen name="ModerationReport" component={ModerationReportScreen} />
                          <Stack.Screen name="ModerationNotice" component={ModerationNoticeScreen} />
                          <Stack.Screen name="ReportReceipts" component={ReportReceiptsScreen} />
                          <Stack.Screen name="FeedGenerator" component={FeedGeneratorScreen} />
                          <Stack.Screen name="Feeds" component={FeedsScreen} />
                          <Stack.Screen name="Hashtag" component={DiscoveryScreen} />
                          <Stack.Screen name="Topic" component={DiscoveryScreen} />
                          <Stack.Screen name="VideoFeed" component={DiscoveryScreen} />
                          <Stack.Screen name="Discover" component={DiscoveryScreen} />
                          <Stack.Screen name="StarterPack" component={StarterPackScreen} />
                          <Stack.Screen name="StarterPackEdit" component={StarterPackEditScreen} />
                          <Stack.Screen name="Lists" component={ListsScreen} />
                          <Stack.Screen name="ListDetail" component={ListDetailScreen} />
                          <Stack.Screen name="ListEdit" component={ListEditScreen} />
                          <Stack.Screen name="ListMembers" component={ListMembersScreen} />
                          <Stack.Screen name="Chat" component={ChatScreen} />
                          <Stack.Screen name="Conversation" component={ConversationScreen} />
                          <Stack.Screen
                            name="ChatSettings"
                            component={ChatSettingsScreen}
                            options={{ title: 'Chat settings' }}
                          />
                          <Stack.Screen
                            name="ChatNotificationSettings"
                            component={ChatNotificationSettingsScreen}
                          />
                          <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
                          <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
                          <Stack.Screen name="JoinRequests" component={JoinRequestsScreen} />
                          <Stack.Screen
                            name="ConversationSettings"
                            component={ConversationSettingsScreen}
                          />
                        </Stack.Navigator>
                      </View>
                      {showChrome && showRight ? <RightRail onNavigate={navigateToTab} /> : null}
                    </View>
                  </View>
                  </NavigationContainer>
                </FeedsProvider>
              </ModerationProvider>
            </AccountPreferencesProvider>
          </ViewPreferencesProvider>
        </ViewerProvider>
        </OpenLinkProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
