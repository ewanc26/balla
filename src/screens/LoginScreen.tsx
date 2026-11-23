import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_SERVICE, login } from '../lib/agent';
import {
  ACCOUNT_PREFLIGHT_COPY,
  ACCOUNT_PREFLIGHT_STATE_LABELS,
  probeAccount,
  type AccountPreflightResult,
} from '../lib/accountPreflight.ts';
import { getHandleResolverEndpoint } from '../lib/servicesConfig';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';
import { BrandMark } from '../components/BrandMark';

function normaliseIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(/^@/, '');
}

export function LoginScreen({
  onLoggedIn,
  initialIdentifier = '',
}: {
  onLoggedIn: () => void;
  initialIdentifier?: string;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState(() => normaliseIdentifier(initialIdentifier));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<AccountPreflightResult | null>(null);

  async function signInWith(value: string) {
    if (busy) return;
    const input = normaliseIdentifier(value);
    if (!input) return;

    setBusy(true);
    setError(null);
    try {
      await login(input);
      onLoggedIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Balla OAuth sign-in failed', err);
      if (!/cancel/i.test(message)) {
        setError('Could not sign in. Check the handle and try again.');
      }
      setBusy(false);
    }
  }

  async function checkAccount() {
    if (busy || checking) return;
    const input = normaliseIdentifier(identifier);
    if (!input) return;

    setChecking(true);
    setCheckResult(null);
    try {
      const result = await probeAccount(input, {
        resolver: await getHandleResolverEndpoint(),
      });
      setCheckResult(result);
    } catch {
      setCheckResult({
        state: 'unresolved',
        source: null,
        did: null,
        pds: null,
        authorizationServer: null,
        facts: null,
        detail: 'The public check could not complete on this device.',
      });
    } finally {
      setChecking(false);
    }
  }

  const canSubmit = !busy && normaliseIdentifier(identifier).length > 0;
  const canCheck = !busy && !checking && normaliseIdentifier(identifier).length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: 40 + insets.top,
          paddingBottom: 40 + insets.bottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <BrandMark size={56} background={p.accent} foreground={p.onAccent} />
          <Text style={[styles.wordmark, { color: p.accent }]}>balla</Text>
        </View>

        <Text
          style={{
            color: p.text,
            fontSize: 24,
            fontWeight: '700',
            marginTop: 18,
            textAlign: 'center',
          }}
        >
          Your people. In order.
        </Text>
        <Text
          style={{
            color: p.secondary,
            fontSize: 15,
            lineHeight: 21,
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          Bluesky, in the order your people posted it. No ranking, no suggested
          posts, no ads.
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
            Sign in with Bluesky
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            Enter your handle, DID, or server. Your server will ask you to approve
            access; Balla never sees your password.
          </Text>

          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you.bsky.social"
            placeholderTextColor={p.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={() => void signInWith(identifier)}
            style={[
              {
                color: p.text,
                backgroundColor: p.bg,
                borderColor: p.divider,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: CARD_RADIUS,
                paddingHorizontal: 12,
                minHeight: 48,
                fontSize: 16,
                marginTop: 14,
              },
              webInputReset,
            ]}
          />

          {error ? (
            <Text style={{ color: p.danger, fontSize: 13, lineHeight: 18, marginTop: 10 }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void signInWith(identifier)}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Continue with Bluesky"
            style={({ pressed }) => ({
              backgroundColor: p.accent,
              borderRadius: CARD_RADIUS,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 14,
              opacity: canSubmit && !pressed ? 1 : 0.55,
            })}
          >
            {busy ? (
              <ActivityIndicator color={p.onAccent} />
            ) : (
              <Text style={{ color: p.onAccent, fontSize: 16, fontWeight: '700' }}>
                Continue
              </Text>
            )}
          </Pressable>

          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: p.divider,
              marginVertical: 12,
            }}
          />

          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            Check before you sign in
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {ACCOUNT_PREFLIGHT_COPY.detail}
          </Text>
          <Pressable
            onPress={() => void checkAccount()}
            disabled={!canCheck}
            accessibilityRole="button"
            accessibilityLabel="Check this account"
            style={({ pressed }) => ({
              borderColor: p.divider,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: CARD_RADIUS,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 12,
              opacity: canCheck && !pressed ? 1 : 0.55,
            })}
          >
            {checking ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600' }}>
                Check this account
              </Text>
            )}
          </Pressable>

          {checkResult ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
                {ACCOUNT_PREFLIGHT_STATE_LABELS[checkResult.state]}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 3 }}>
                {checkResult.detail}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                Identity source: {checkResult.source ?? 'Not resolved'}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                DID: {checkResult.did ?? 'Not available'}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                PDS: {checkResult.pds ?? 'Not available'}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                Authorization server: {checkResult.authorizationServer ?? 'Not available'}
              </Text>
            </View>
          ) : null}

          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
            {ACCOUNT_PREFLIGHT_COPY.limits}
          </Text>

          <Pressable
            onPress={() => void signInWith(DEFAULT_SERVICE)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Create a Bluesky account"
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.5 : pressed ? 0.65 : 1,
            })}
          >
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600' }}>
              Create a Bluesky account
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            color: p.secondary,
            fontSize: 12,
            lineHeight: 18,
            marginTop: 18,
            textAlign: 'center',
          }}
        >
          Balla uses AT Protocol OAuth. The approval page belongs to your server,
          not to Balla. Balla is independent software; references to Bluesky
          identify the network, not an affiliation or official status.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  shell: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.6,
    marginLeft: 10,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginTop: 24,
  },
});
