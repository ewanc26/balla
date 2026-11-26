import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../lib/agent';
import { touchTargetStyle } from '../lib/accessibility';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/** One explicit sign-out flow for Settings and Session security. */
export function SignOutControl() {
  const p = usePalette();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  if (confirming) {
    return (
      <View
        style={[
          styles.confirmCard,
          { backgroundColor: p.card, borderColor: p.danger },
          cardShadow,
        ]}
      >
        <Text accessibilityRole="header" style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          Sign out of Balla?
        </Text>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
          Every account on this device will be removed and Balla will ask those
          servers to revoke the grants. Your posts and accounts stay on your PDS.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Pressable
            onPress={() => setConfirming(false)}
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
              <Text style={{ color: p.onDanger, fontSize: 15, fontWeight: '700' }}>
                Sign out
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setConfirming(true)}
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
  );
}

const styles = StyleSheet.create({
  confirmCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 8,
    marginTop: 8,
  },
  confirmButton: {
    ...touchTargetStyle,
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    ...touchTargetStyle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
});
