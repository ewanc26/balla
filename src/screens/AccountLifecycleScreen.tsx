import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { openExternalUrl } from '../lib/openLink';
import { BLUESKY_WEB } from '../lib/serviceHosts.ts';
import { Ionicons } from '@expo/vector-icons';
import { useSessionSummary } from '../lib/sessionInfo';
import { useViewer } from '../lib/viewer';
import {
  controlPanelFailureText,
  providerControlPanelUrl,
  providerLinkDetail,
  providerOwnedPanelText,
} from '../lib/accountSettingsModel';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

// Bluesky's account panel contains data export, deactivation and permanent
// deletion. Balla cannot perform account-level lifecycle operations: those are
// PDS account controls, not AT Protocol record writes. The screen links out and
// says exactly that instead of implying a local deletion did more than it did.
const ACCOUNT_SETTINGS = BLUESKY_WEB.accountSettings;

type ConfirmKind = 'deactivate' | 'delete' | null;

export function AccountLifecycleScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const { summary } = useSessionSummary();
  const service = summary?.resourceServer || '';
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<any>(null);
  const cancelRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible: !!confirm,
    onClose: () => setConfirm(null),
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Account and data' });
  }, [navigation]);

  async function openAccountSettings() {
    if (opening) return;
    const url = providerControlPanelUrl(service, ACCOUNT_SETTINGS);
    if (!url) {
      setConfirm(null);
      setError(providerOwnedPanelText('account settings'));
      return;
    }
    setOpening(true);
    setError(null);
    try {
      await openExternalUrl(url);
      setConfirm(null);
    } catch {
      setError(controlPanelFailureText(service, 'account settings', url));
    } finally {
      setOpening(false);
    }
  }

  const isDelete = confirm === 'delete';
  const handle = profile?.handle ? `@${profile.handle}` : 'your account';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="person-circle-outline" size={24} color={p.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
              {handle}
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
              Account controls live on your PDS, not in Balla
            </Text>
          </View>
        </View>
      </View>

      <Section title="Data export">
        <ActionRow
          icon="download-outline"
          label="Export my data"
          detail={providerLinkDetail(service, 'account data export')}
          onPress={() => void openAccountSettings()}
        />
      </Section>

      <Section title="Account lifecycle">
        <ActionRow
          icon="pause-circle-outline"
          label="Deactivate account"
          detail="Hides your account until you sign in again. Balla asks for confirmation; the account control stays with your provider."
          onPress={() => setConfirm('deactivate')}
        />
        <ActionRow
          icon="trash-outline"
          label="Delete account permanently"
          detail="Irreversible account deletion. Balla cannot perform it and will never claim that it did."
          danger
          onPress={() => setConfirm('delete')}
        />
      </Section>

      <Section title="What Balla can and cannot delete">
        <View style={{ padding: 14, gap: 10 }}>
          {[
            'Balla can delete individual posts, likes, reposts and follows from your PDS.',
            'Signing out clears the local OAuth session and asks your server to revoke the grant.',
            'Your account, profile, avatar and banner blobs, and the AppView’s index are not removed by uninstalling Balla or signing out.',
            'Permanent account deletion and deactivation are PDS account operations. Use your provider’s account settings; for bsky.social, that is the link in this screen.',
            'Other clients, AppViews and labelers may keep their own copies for their retention periods. Balla cannot delete data it does not host.',
          ].map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={p.secondary}
                style={{ marginTop: 2 }}
              />
              <Text
                style={{
                  color: p.secondary,
                  fontSize: 13,
                  lineHeight: 19,
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {line}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginTop: 4 }}
        >
          {error}
        </Text>
      ) : null}

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 18, marginTop: 6 }}>
        Balla is an AT Protocol client. It does not host your account and cannot
        complete account deletion on your behalf.
      </Text>

      <Modal
        visible={!!confirm}
        transparent
        animationType={dialogAnimation(reducedMotion)}
        accessibilityViewIsModal
        onRequestClose={() => setConfirm(null)}
      >
        <View style={styles.overlay}>
          <Pressable
            onPress={() => setConfirm(null)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.backdrop}
          />
          <View
            ref={dialogRef}
            {...dialogAccessibilityProps(
              isDelete ? 'Delete account permanently?' : 'Deactivate account?'
            )}
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: p.card }]}
          >
            <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>
              {isDelete ? 'Delete account permanently?' : 'Deactivate account?'}
            </Text>
            <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: 10 }}>
              {providerLinkDetail(service, 'account')}{' '}
              {isDelete
                ? 'Deleting an account in that control is permanent and removes the account from its PDS. Balla cannot undo it or perform it for you.'
                : 'Deactivation in that control hides the account until you sign in again. Balla cannot deactivate or reactivate it for you.'}
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
              Nothing changes until you complete the step on your PDS. If your account
              is on another provider, use that provider’s control panel instead.
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 12, marginTop: 8 }}>
                {error}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                ref={cancelRef}
                onPress={() => setConfirm(null)}
                disabled={opening}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [
                  styles.button,
                  {
                    borderColor: p.divider,
                    backgroundColor: p.bg,
                    opacity: pressed || opening ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void openAccountSettings()}
                disabled={opening}
                accessibilityRole="button"
                accessibilityLabel="Open account settings"
                style={({ pressed }) => [
                  styles.button,
                  {
                    borderColor: isDelete ? p.danger : p.accent,
                    backgroundColor: isDelete ? p.danger : p.accent,
                    opacity: pressed || opening ? 0.6 : 1,
                  },
                ]}
              >
                {opening ? (
                  <ActivityIndicator size="small" color={isDelete ? p.onDanger : p.onAccent} />
                ) : (
                  <Text style={{ color: isDelete ? p.onDanger : p.onAccent, fontWeight: '700' }}>
                    Open account settings
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: p.secondary, fontSize: 13, fontWeight: '700', paddingHorizontal: 18, marginBottom: 6 }}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {children}
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  danger,
  onPress,
}: {
  icon: any;
  label: string;
  detail: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: p.divider,
          backgroundColor: pressed ? p.bg : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.iconBubble,
          { backgroundColor: danger ? 'rgba(228, 30, 63, 0.1)' : p.accentSoft },
        ]}
      >
        <Ionicons name={icon} size={20} color={danger ? p.danger : p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: danger ? p.danger : p.text, fontSize: 15, fontWeight: '600' }}>
          {label}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={p.secondary} />
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
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 12,
    padding: 18,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
