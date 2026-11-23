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
import { usePreferences } from '../lib/preferences';
import {
  blobCacheInfo,
  clearBlobCache,
  subscribeBlobCache,
} from '../lib/blobOrigin';
import { formatBytes } from '../lib/imageBytes';
import { MAX_BLOB_CACHE_BYTES, type BlobOriginStrategy } from '../lib/blobOriginModel';
import { usePalette } from '../theme';

const STRATEGIES: readonly ChoiceOption<BlobOriginStrategy>[] = [
  {
    value: 'follow-url',
    label: 'Follow URL',
    detail: 'Use the AppView image URL. If it fails, retry from the author’s PDS.',
  },
  {
    value: 'pds-first',
    label: 'PDS origin first',
    detail: 'Read the blob from the author’s PDS first, falling back to the URL on failure.',
  },
];

/**
 * Media origin is a device-local choice over real behaviour. Both strategies
 * use the same PDS fallback; neither invents a blob ref from an AppView URL.
 * Metered-network routing is deliberately not offered: the platform does not
 * expose a reliable "metered" signal, so such a control would be inert.
 */
export function MediaOriginScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const { preferences, setBlobOriginStrategy } = usePreferences();
  const [info, setInfo] = useState(() => blobCacheInfo());

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Media origin' });
  }, [navigation]);

  useEffect(() => subscribeBlobCache(() => setInfo(blobCacheInfo())), []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection title="Blob origin">
        <SettingChoice
          label="Image origin strategy"
          options={STRATEGIES}
          value={preferences.blobOriginStrategy}
          onChange={setBlobOriginStrategy}
        />
      </SettingSection>

      <SettingSection title="Image cache">
        <SettingValueRow
          label="Used / limit"
          value={`${formatBytes(info.bytes)} of ${formatBytes(MAX_BLOB_CACHE_BYTES)} (${info.entries} images)`}
        />
        <SettingButton
          label="Clear image cache"
          onPress={() => clearBlobCache()}
          disabled={info.entries === 0}
        />
      </SettingSection>

      <SettingNote>
        Blobs are content-addressed and served by the author’s personal data
        server. Balla caches only the decoded images, up to the visible limit;
        this choice is stored on this device only. Link-card thumbnails and
        profile link icons are third-party URLs and cannot use PDS fallback.
      </SettingNote>
    </ScrollView>
  );
}
