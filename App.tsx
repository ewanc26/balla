import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, useTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ThreadScreen } from './src/screens/ThreadScreen';
import { ComposeScreen } from './src/screens/ComposeScreen';
import { restore, setOnLoggedOut } from './src/lib/agent';
import { palettes, usePalette } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const p = usePalette();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.secondary,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.divider },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const map: Record<string, [string, string]> = {
            Home: ['home', 'home-outline'],
            Notifications: ['notifications', 'notifications-outline'],
            Profile: ['person', 'person-outline'],
          };
          const pair = map[route.name] || ['ellipse', 'ellipse-outline'];
          const name = focused ? pair[0] : pair[1];
          return <Ionicons name={name as any} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const p = usePalette();
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setOnLoggedOut(() => setLoggedIn(false));
    restore()
      .then((ok) => setLoggedIn(ok))
      .catch(() => setLoggedIn(false))
      .finally(() => setReady(true));
  }, []);

  const navTheme = useTheme();
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
      <NavigationContainer theme={customNavTheme as any}>
        <StatusBar style="auto" />
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Thread" component={ThreadScreen} />
          <Stack.Screen name="Compose" component={ComposeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
