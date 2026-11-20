import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { agent, DEFAULT_SERVICE, login } from '../lib/agent';
import { usePalette } from '../theme';

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const p = usePalette();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [service, setService] = useState(DEFAULT_SERVICE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password, service.trim() || DEFAULT_SERVICE);
      onLoggedIn();
    } catch {
      setError('That did not work. Check the handle, the app password, and the service URL.');
    }
    setBusy(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 24, justifyContent: 'center', flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={{ color: p.accent, fontSize: 48, fontWeight: '800' }}>balla</Text>
        <Text style={{ color: p.text, fontSize: 18, fontWeight: '600', marginTop: 8 }}>
          Your people, in order.
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          balla (n.) — Gàidhlig for wall.
        </Text>
      </View>

      <View style={[styles.field, { backgroundColor: p.card }]}>
        <TextInput
          placeholder="Handle or email"
          placeholderTextColor={p.secondary}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ color: p.text, minHeight: 44, paddingHorizontal: 12 }}
        />
      </View>
      <View style={[styles.field, { backgroundColor: p.card }]}>
        <TextInput
          placeholder="App password"
          placeholderTextColor={p.secondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{ color: p.text, minHeight: 44, paddingHorizontal: 12 }}
        />
      </View>
      <View style={[styles.field, { backgroundColor: p.card }]}>
        <TextInput
          placeholder="Service (default https://bsky.social)"
          placeholderTextColor={p.secondary}
          value={service}
          onChangeText={setService}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ color: p.text, minHeight: 44, paddingHorizontal: 12 }}
        />
      </View>

      {error ? (
        <Text style={{ color: p.danger, marginTop: 8, marginBottom: 8 }}>{error}</Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={busy || identifier.length === 0 || password.length === 0}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: p.accent,
            opacity: pressed ? 0.85 : busy || identifier.length === 0 || password.length === 0 ? 0.5 : 1,
          },
        ]}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
          {busy ? 'Signing in…' : 'Log in'}
        </Text>
      </Pressable>

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 16, textAlign: 'center' }}>
        Balla signs in with an app password, never your main password. Create one in Bluesky under
        Settings, Privacy and security, App passwords.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 10,
    marginBottom: 10,
  },
  button: {
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});
