import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SettingButton,
  SettingChoice,
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingValueRow,
  type ChoiceOption,
} from '../components/SettingControls';
import { agent } from '../lib/agent';
import { openExternalUrl } from '../lib/openLink';
import { usePreferences } from '../lib/preferences';
import {
  blobCacheInfo,
  clearBlobCache,
  subscribeBlobCache,
} from '../lib/blobOrigin';
import { formatBytes } from '../lib/imageBytes';
import {
  checkingVideoQuota,
  idleVideoQuota,
  probeVideoQuota,
  videoQuotaText,
  VIDEO_SERVICE_DID,
  VIDEO_SERVICE_ENDPOINT,
  type VideoQuotaProbe,
} from '../lib/videoServiceProbe';
import { MAX_BLOB_CACHE_BYTES, type BlobOriginStrategy } from '../lib/blobOriginModel';
import { usePalette } from '../theme';

const VIDEO_DOCS = 'https://atproto.com/guides/video-handling';
const ALTERNATIVE_VIDEO = 'https://stream.place';

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
  const [videoQuota, setVideoQuota] = useState<VideoQuotaProbe>(() => idleVideoQuota());

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Media origin' });
  }, [navigation]);

  useEffect(() => subscribeBlobCache(() => setInfo(blobCacheInfo())), []);

  const checkVideoQuota = useCallback(async () => {
    setVideoQuota(checkingVideoQuota());
    const result = await probeVideoQuota({
      serviceToken: async (aud, lxm) => {
        const { data } = await agent.com.atproto.server.getServiceAuth({
          aud,
          lxm,
          exp: Math.floor(Date.now() / 1000) + 300,
        });
        return data.token;
      },
    });
    setVideoQuota(result);
  }, []);

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

      <SettingSection
        title="Video service"
        detail="The side-car named in this app's OAuth grant. Quota is read live from that service; it is not a local guess."
      >
        <SettingValueRow label="Service DID" value={VIDEO_SERVICE_DID} />
        <SettingValueRow label="Endpoint" value={VIDEO_SERVICE_ENDPOINT} />
        <SettingValueRow label="Quota" value={videoQuotaText(videoQuota)} />
        <SettingButton
          label="Check video quota"
          onPress={() => void checkVideoQuota()}
          busy={videoQuota.state === 'checking'}
        />
        <SettingLinkRow
          icon="book-outline"
          label="Video handling guide"
          detail="Read how side-car services process AT Protocol video."
          external
          onPress={() => void openExternalUrl(VIDEO_DOCS)}
        />
        <SettingLinkRow
          icon="play-circle-outline"
          label="Alternative video hosts"
          detail="Streamplace is an open-source AT Protocol video service."
          external
          onPress={() => void openExternalUrl(ALTERNATIVE_VIDEO)}
        />
      </SettingSection>

      <SettingNote>
        The video endpoint and audience are fixed when you authorise Balla.
        Changing them needs a new grant, so Balla does not offer a settings field
        that would only look configurable. MP4/GIF and caption limits remain
        local checks; the daily quota above comes from the service. A failed or
        CORS-blocked quota read is reported as unreadable, never as zero quota.
      </SettingNote>

      <SettingNote>
        Blobs are content-addressed and served by the author’s personal data
        server. Balla caches only the decoded images, up to the visible limit;
        this choice is stored on this device only. Link-card thumbnails and
        profile link icons are third-party URLs and cannot use PDS fallback.
      </SettingNote>
    </ScrollView>
  );
}
