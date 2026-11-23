import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingChoice,
  SettingNote,
  SettingSection,
  SettingValueRow,
  type ChoiceOption,
} from '../components/SettingControls';
import {
  clearIdentityCache,
  getIdentityStrategy,
  identityCacheStats,
  subscribeIdentityCache,
} from '../lib/identityCache';
import {
  lastIdentitySource,
  subscribeIdentitySource,
} from '../lib/identityResolver';
import { IDENTITY_STRATEGIES, type IdentityStrategy } from '../lib/identityModel';
import { usePalette } from '../theme';

const STRATEGIES: readonly ChoiceOption<IdentityStrategy>[] = [
  {
    value: 'auto',
    label: 'Auto',
    detail: 'Use the DID’s own method, with cached identities first.',
  },
  {
    value: 'registry-first',
    label: 'Registry first',
    detail: 'Read plc.directory before did:web documents.',
  },
  {
    value: 'web-first',
    label: 'Web first',
    detail: 'Read did:web documents before the registry.',
  },
  {
    value: 'local-only',
    label: 'Local cache only',
    detail: 'Never contact a directory; read only saved identities.',
  },
];

const SOURCE_LABELS: Record<string, string> = {
  cache: 'From this device’s cache',
  network: 'From the network',
  none: 'Not checked yet',
};

/** Device-local identity strategy with real cache state, never a fake control. */
export function IdentitySettingsScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const [strategy, setStrategy] = useState<IdentityStrategy>('auto');
  const [source, setSource] = useState(() => lastIdentitySource());
  const [stats, setStats] = useState(() => identityCacheStats());

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Identity' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    void getIdentityStrategy().then((value) => {
      if (active) setStrategy(value);
    });
    const unsubscribe = subscribeIdentityCache(() => {
      if (active) setStats(identityCacheStats());
    });
    const unsubscribeSource = subscribeIdentitySource(() => {
      if (active) setSource(lastIdentitySource());
    });
    return () => {
      active = false;
      unsubscribe();
      unsubscribeSource();
    };
  }, []);

  const choose = (value: IdentityStrategy) => {
    setStrategy(value);
    void import('../lib/identityCache').then((module) => module.setIdentityStrategy(value));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection title="Resolution">
        <SettingChoice
          label="Identity strategy"
          options={STRATEGIES}
          value={IDENTITY_STRATEGIES.includes(strategy) ? strategy : 'auto'}
          onChange={choose}
        />
      </SettingSection>

      <SettingSection title="On-device cache">
        <SettingValueRow label="Last lookup" value={SOURCE_LABELS[source] || SOURCE_LABELS.none} />
        <SettingValueRow label="Saved identities" value={`${stats.entries} of ${stats.limit}`} />
        <SettingButton
          label="Clear identity cache"
          onPress={() => void clearIdentityCache()}
          disabled={stats.entries === 0}
        />
      </SettingSection>

      <SettingNote>
        A DID document is the source of truth for where an account lives and
        which services serve it; Balla never assumes a Bluesky host from a
        handle suffix. Saved identities are public directory data on this device
        only, so profiles you have seen keep resolving when a directory is
        unreachable. These reads add no OAuth scope.
      </SettingNote>
    </ScrollView>
  );
}
