import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  useColorScheme,
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
import { ComposeScreen } from './src/screens/ComposeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { InfoScreen } from './src/screens/InfoScreen';
import { PeopleListScreen } from './src/screens/PeopleListScreen';
import { EngagementListScreen } from './src/screens/EngagementListScreen';
import { ContentFiltersScreen } from './src/screens/ContentFiltersScreen';
import { AccountLifecycleScreen } from './src/screens/AccountLifecycleScreen';
import { NotificationSettingsScreen } from './src/screens/NotificationSettingsScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { ModerationInboxScreen } from './src/screens/ModerationInboxScreen';
import { ModerationReportScreen } from './src/screens/ModerationReportScreen';
import { ModerationNoticeScreen } from './src/screens/ModerationNoticeScreen';
import { FeedGeneratorScreen } from './src/screens/FeedGeneratorScreen';
import { FeedsScreen } from './src/screens/FeedsScreen';
import { AppearanceScreen } from './src/screens/AppearanceScreen';
import { StarterPackScreen } from './src/screens/StarterPackScreen';
import { ListsScreen } from './src/screens/ListsScreen';
import { ListDetailScreen } from './src/screens/ListDetailScreen';
import { ListEditScreen } from './src/screens/ListEditScreen';
import { ListMembersScreen } from './src/screens/ListMembersScreen';
import { AppHeader, type TabName } from './src/components/AppHeader';
import { LeftRail, RightRail } from './src/components/AppRail';
import { ViewerProvider } from './src/lib/viewer';
import { ModerationProvider } from './src/lib/moderationContext';
import { FeedsProvider } from './src/lib/feedsContext';
import { PreferencesProvider } from './src/lib/preferences';
import { restore, setOnLoggedOut } from './src/lib/agent';
import { palettes, usePalette } from './src/theme';
import { DESKTOP_MIN_WIDTH, RIGHT_RAIL_MIN_WIDTH } from './src/lib/layout';
import {
  MOCK_MODE,
  MOCK_OTHER_ACTOR,
  MOCK_THREAD_URI,
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
  const wide = width >= DESKTOP_MIN_WIDTH;
  const initialTab = (MOCK_MODE ? mockInitialTab() : 'Home') as TabName;

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: p.chromeAction,
        tabBarInactiveTintColor: p.chromeMuted,
        tabBarStyle: wide
          ? { display: 'none' }
          : {
              backgroundColor: p.chrome,
              borderTopColor: p.chromeBorder,
              borderTopWidth: StyleSheet.hairlineWidth,
              height: 64 + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom + 10,
            },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 14,
          height: 14,
          flexShrink: 0,
          fontWeight: '600',
          marginTop: 2,
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
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Saved" component={BookmarksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const p = usePalette();
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const initialTab = (MOCK_MODE ? mockInitialTab() : 'Home') as TabName;
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>(initialTab);
  const [routeName, setRouteName] = useState<string>(initialTab);

  const showLeft = width >= DESKTOP_MIN_WIDTH;
  const showRight = width >= RIGHT_RAIL_MIN_WIDTH;

  useEffect(() => {
    setOnLoggedOut(() => setLoggedIn(false));
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
    return <View style={{ flex: 1, backgroundColor: palettes.light.accent }} />;
  }
  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
      <ViewerProvider>
        <ModerationProvider>
          <FeedsProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={customNavTheme as any}
          onReady={handleReady}
          onStateChange={syncActiveTab}
        >
          <View style={{ flex: 1, backgroundColor: p.bg }}>
            <StatusBar style={p.chromeIsDark ? 'light' : 'dark'} />
            {showChrome ? (
              <AppHeader
                wide={showLeft}
                activeTab={activeTab}
                onNavigate={navigateToTab}
                onOpenSettings={openSettings}
              />
            ) : null}
            {MOCK_MODE ? (
              <View
                style={{
                  backgroundColor: '#F7B125',
                  paddingVertical: 4,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#1C1E21', fontSize: 11, fontWeight: '700' }}>
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
                />
              ) : null}
              <View style={{ flex: 1, maxWidth: width >= DESKTOP_MIN_WIDTH ? 680 : undefined }}>
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
                  <Stack.Screen name="Compose" component={ComposeScreen} />
                  <Stack.Screen name="UserProfile" component={ProfileScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen name="Appearance" component={AppearanceScreen} />
                  <Stack.Screen name="Info" component={InfoScreen} />
                  <Stack.Screen name="PeopleList" component={PeopleListScreen} />
                  <Stack.Screen name="EngagementList" component={EngagementListScreen} />
                  <Stack.Screen name="ContentFilters" component={ContentFiltersScreen} />
                  <Stack.Screen name="AccountLifecycle" component={AccountLifecycleScreen} />
                  <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
                  <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                  <Stack.Screen name="ModerationInbox" component={ModerationInboxScreen} />
                  <Stack.Screen name="ModerationReport" component={ModerationReportScreen} />
                  <Stack.Screen name="ModerationNotice" component={ModerationNoticeScreen} />
                  <Stack.Screen name="FeedGenerator" component={FeedGeneratorScreen} />
                  <Stack.Screen name="Feeds" component={FeedsScreen} />
                  <Stack.Screen name="StarterPack" component={StarterPackScreen} />
                  <Stack.Screen name="Lists" component={ListsScreen} />
                  <Stack.Screen name="ListDetail" component={ListDetailScreen} />
                  <Stack.Screen name="ListEdit" component={ListEditScreen} />
                  <Stack.Screen name="ListMembers" component={ListMembersScreen} />
                </Stack.Navigator>
              </View>
              {showChrome && showRight ? <RightRail onNavigate={navigateToTab} /> : null}
            </View>
          </View>
        </NavigationContainer>
          </FeedsProvider>
        </ModerationProvider>
      </ViewerProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
