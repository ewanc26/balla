import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import { checkChatService } from '../lib/chatService';
import { readChatDidAdvertises } from '../lib/chatServiceRead.ts';
import {
  CHAT_AUDIENCE,
  CHAT_SERVICE_DOCS_URL,
  CHAT_SERVICE_DID,
  CHAT_SERVICE_TYPE,
  chatServiceCopy,
  type ChatServiceState,
} from '../lib/chatServiceModel';
import { openExternalUrl } from '../lib/openLink';
import { usePalette } from '../theme';

const STATUS_LABELS: Record<ChatServiceState, string> = {
  checking: 'Checking…',
  reachable: 'Reachable',
  unreachable: 'Unreachable',
  'not-advertised': 'Not advertised by this host',
  unauthorised: 'Not authorised',
  disabled: 'Disabled for this account',
  limited: 'Rate limited',
  unknown: 'Unknown',
};

/** Advanced → Chat: a real proxy probe plus honest service facts. */
export function ChatServiceScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const [state, setState] = useState<ChatServiceState>('checking');
  const [advertised, setAdvertised] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Chat service' });
  }, [navigation]);

  const check = useCallback(async () => {
    setBusy(true);
    setState('checking');
    const [result, docAdvertised] = await Promise.all([
      checkChatService(),
      readChatDidAdvertises(),
    ]);
    setState(result);
    setAdvertised(docAdvertised);
    setBusy(false);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection
        title="Availability"
        detail="A real read through this account’s chat service proxy. No message content is read or stored."
      >
        <SettingValueRow label="Status" value={STATUS_LABELS[state]} />
        <SettingValueRow label="What this means" value={chatServiceCopy(state)} />
        <SettingButton label="Check chat service" onPress={() => void check()} busy={busy} />
      </SettingSection>

      <SettingSection title="Service facts">
        <SettingValueRow label="Proxy type" value={CHAT_SERVICE_TYPE} />
        <SettingValueRow label="Service DID" value={CHAT_SERVICE_DID} />
        <SettingValueRow label="Granted audience" value={CHAT_AUDIENCE} />
        <SettingValueRow
          label="Chat DID document"
          value={
            advertised === null
              ? 'Not available'
              : advertised
                ? 'Advertises chat'
                : 'No chat service listed'
          }
        />
      </SettingSection>

      <SettingSection title="Documentation">
        <SettingLinkRow
          icon="book-outline"
          label="Chat services and proxies"
          detail="How a service token reaches a side-car chat service"
          onPress={() => void openExternalUrl(CHAT_SERVICE_DOCS_URL)}
          external
        />
      </SettingSection>

      <SettingNote>
        Direct messages are not part of app.bsky or your repository: a separate
        chat service serves them through a service proxy. This session’s chat
        permission is granted for {CHAT_AUDIENCE}, so pointing chat at a
        different DID would need a new authorisation with different scopes —
        Balla does not show an override that cannot work. When your host does
        not run chat, Messages shows an honest explanation and every other
        screen keeps working.
      </SettingNote>
    </ScrollView>
  );
}
