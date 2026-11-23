import React, { useLayoutEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
} from '../components/SettingControls';
import { getActiveDid } from '../lib/agent';
import {
  APPVIEW_HEALTH_AUDIENCE,
  APPVIEW_HEALTH_COPY,
  APPVIEW_HEALTH_DID,
  appViewHealthText,
  probeAppViewHealth,
  type AppViewHealthProbe,
} from '../lib/appViewHealth.ts';
import { openExternalUrl } from '../lib/openLink';
import { usePalette } from '../theme';

const ISSUE_URL = 'https://github.com/ewanc26/balla/issues/99';
const SERVICE_DOCS = 'https://atproto.com/guides/self-hosting';

/** Advanced → AppView: real public health facts, no provider switch. */
export function AppViewScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<AppViewHealthProbe | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'AppView' });
  }, [navigation]);

  async function check() {
    if (busy) return;
    setBusy(true);
    setProbe({
      state: 'checking',
      status: null,
      latencyMs: null,
      endpoint: null,
      documentLatencyMs: null,
      profileLatencyMs: null,
      detail: 'Checking…',
    });
    setProbe(await probeAppViewHealth({ actorDid: getActiveDid() }));
    setBusy(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection title="Grant-bound facts" detail={APPVIEW_HEALTH_COPY.grant}>
        <SettingValueRow label="AppView DID" value={APPVIEW_HEALTH_DID} />
        <SettingValueRow label="OAuth audience" value={APPVIEW_HEALTH_AUDIENCE} />
        <SettingValueRow
          label="Advertised endpoint"
          value={probe?.endpoint ?? 'Not checked'}
        />
      </SettingSection>

      <SettingSection title="Public health check" detail={APPVIEW_HEALTH_COPY.measures}>
        <SettingButton label="Check AppView health" onPress={() => void check()} busy={busy} />
        <SettingValueRow label="Result" value={appViewHealthText(probe)} />
        {probe?.detail && probe.state !== 'checking'
          ? <SettingValueRow label="Detail" value={probe.detail} />
          : null}
      </SettingSection>

      <SettingSection title="What this does not do">
        <SettingNote>{APPVIEW_HEALTH_COPY.limits}</SettingNote>
        <SettingNote>
          No picker, mirror, failover or per-function routing is offered here.
          Those need a different OAuth audience and a new authorisation; this
          screen only measures the current grant. The feed’s hydration-source
          label names that same grant-bound AppView; it is a fact, not a switch
          or a live measurement of one response.
        </SettingNote>
      </SettingSection>

      <SettingSection title="Documentation">
        <SettingLinkRow
          icon="book-outline"
          label="AT Protocol self-hosting guide"
          detail="How AppViews and other service roles are advertised"
          onPress={() => void openExternalUrl(SERVICE_DOCS)}
          external
        />
        <SettingLinkRow
          icon="information-circle-outline"
          label="AppView choice and failover"
          detail="Open issue #99 in the public tracker"
          onPress={() => void openExternalUrl(ISSUE_URL)}
          external
        />
      </SettingSection>
    </ScrollView>
  );
}
