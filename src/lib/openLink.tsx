/**
 * Central external-link opener. It reads the device-local `useInAppBrowser`
 * preference, asks once when the choice is still unset (the official client's
 * default), then remembers the answer. All content links in Balla go through
 * this hook so the setting has a real, consistent effect.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { usePreferences } from './preferences';
import { needsBrowserConsent, shouldUseInAppBrowser } from './openLinkModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { useDialogFocus, useReducedMotion } from './accessibility';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  touchTargetStyle,
} from './accessibilityModel';

type OpenLinkFn = (url: string) => Promise<void>;

/**
 * Module-level opener so non-component call sites (press handlers in sheets,
 * settings rows, etc.) share the same browser preference without each needing
 * a hook. The provider registers itself on mount. Returns a Promise so existing
 * `.catch()` / `await` call sites keep working.
 */
let registeredOpener: OpenLinkFn | null = null;

export function openExternalUrl(url: string): Promise<void> {
  if (registeredOpener) return registeredOpener(url);
  return Linking.openURL(url);
}

const OpenLinkContext = createContext<OpenLinkFn>(openExternalUrl);

function browserOpen(url: string): Promise<void> {
  return WebBrowser.openBrowserAsync(url).then(() => undefined);
}

export function OpenLinkProvider({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  const reducedMotion = useReducedMotion();
  const { preferences, setUseInAppBrowser } = usePreferences();
  const choice = preferences.useInAppBrowser;
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const openLink = useCallback<OpenLinkFn>(
    (url) => {
      if (!url) return Promise.resolve();
      if (needsBrowserConsent(url, choice)) {
        setPendingUrl(url);
        return Promise.resolve();
      }
      if (shouldUseInAppBrowser(url, choice)) return browserOpen(url);
      return Linking.openURL(url);
    },
    [choice]
  );

  const decide = useCallback(
    (useInApp: boolean) => {
      setUseInAppBrowser(useInApp);
      const url = pendingUrl;
      setPendingUrl(null);
      if (!url) return;
      void (useInApp ? browserOpen(url) : Linking.openURL(url)).catch(() => {});
    },
    [pendingUrl, setUseInAppBrowser]
  );

  const value = useMemo(() => openLink, [openLink]);

  const dialogRef = useRef<any>(null);
  const firstChoiceRef = useRef<any>(null);
  const dismiss = () => setPendingUrl(null);
  useDialogFocus({
    visible: pendingUrl !== null,
    onClose: dismiss,
    containerRef: dialogRef,
    initialFocusRef: firstChoiceRef,
  });

  useEffect(() => {
    registeredOpener = openLink;
    return () => {
      if (registeredOpener === openLink) registeredOpener = null;
    };
  }, [openLink]);

  return (
    <OpenLinkContext.Provider value={value}>
      {children}
      <Modal
        visible={pendingUrl !== null}
        transparent
        animationType={dialogAnimation(reducedMotion)}
        accessibilityViewIsModal
        onRequestClose={dismiss}
      >
        <View style={[styles.backdrop, { backgroundColor: p.overlay }]}>
          {/* A pointer shortcut only: Cancel is the labelled way out. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            focusable={false}
            tabIndex={-1}
            onPress={dismiss}
          />
          <View
            ref={dialogRef}
            {...dialogAccessibilityProps('How should links open?')}
            accessibilityViewIsModal
            style={[
              styles.card,
              { backgroundColor: p.card, borderColor: p.divider, ...cardShadow },
            ]}
          >
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
              How should links open?
            </Text>
            <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
              Choose once. You can change this any time in Settings → Content and media.
            </Text>
            <Pressable
              ref={firstChoiceRef}
              accessibilityRole="button"
              onPress={() => decide(true)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: pressed ? p.accentSoft : p.accent },
              ]}
            >
              <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '600' }}>
                Use in-app browser
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => decide(false)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: pressed ? p.bg : 'transparent', borderColor: p.divider },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
                Open in system browser
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel browser choice"
              onPress={dismiss}
              style={{ ...touchTargetStyle, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
            >
              <Text style={{ color: p.secondary, fontSize: 14 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </OpenLinkContext.Provider>
  );
}

export function useOpenLink(): OpenLinkFn {
  return useContext(OpenLinkContext);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 20,
  },
  button: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
