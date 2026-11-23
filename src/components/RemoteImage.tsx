import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme';
import { usePreferences } from '../lib/preferences';
import { resolveBlobUri } from '../lib/blobOrigin';
import type { BlobFallback } from '../lib/blobOriginModel';

type Props = {
  uri?: string;
  /** Raw-record blob descriptor, only present when a CID can be trusted. */
  fallback?: BlobFallback | null;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  accessibilityRole?: 'image' | 'none';
  accessibilityLabel?: string;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
};

/**
 * One remote-image seam for post media. The AppView URL is tried first; if it
 * fails and the raw record gives us a DID + CID, the blob is read from the
 * author's PDS. If both fail we show an honest unavailable tile, never a blank
 * rectangle that looks like a broken image.
 */
export function RemoteImage({
  uri,
  fallback,
  style,
  resizeMode = 'cover',
  accessibilityRole,
  accessibilityLabel,
  onLoadStart,
  onLoadEnd,
}: Props) {
  const p = usePalette();
  const { preferences } = usePreferences();
  const pdsFirst = preferences.blobOriginStrategy === 'pds-first';
  const [source, setSource] = useState(uri || '');
  const [failed, setFailed] = useState(false);
  const tries = useRef(0);
  const alive = useRef(true);

  const did = fallback?.did;
  const cid = fallback?.cid;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    tries.current = 0;
    setFailed(false);
    setSource(uri || '');
  }, [uri, did, cid]);

  // "PDS origin first" is a genuine behaviour change: resolve the blob up
  // front, and keep the AppView URL only as the retry if that read fails.
  useEffect(() => {
    if (!pdsFirst || !fallback) return;
    let cancelled = false;
    void resolveBlobUri(fallback).then((blobUri) => {
      if (cancelled || !blobUri) return;
      setSource(blobUri);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdsFirst, did, cid]);

  const handleError = () => {
    if (!fallback || !did || !cid || tries.current >= 1) {
      if (alive.current) setFailed(true);
      return;
    }
    tries.current += 1;
    void resolveBlobUri(fallback).then((blobUri) => {
      if (!alive.current) return;
      if (blobUri) setSource(blobUri);
      else setFailed(true);
    });
  };

  if (failed) {
    return (
      <View
        style={[style, styles.failed, { backgroundColor: p.divider }]}
        accessibilityRole={accessibilityRole || 'image'}
        accessibilityLabel={
          accessibilityLabel ? `${accessibilityLabel}, unavailable` : 'Image unavailable'
        }
      >
        <Ionicons name="image-outline" size={26} color={p.secondary} />
        <Text style={{ color: p.secondary, fontSize: 11, marginTop: 4 }}>Image unavailable</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: source }}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
      onLoadStart={onLoadStart}
      onLoadEnd={onLoadEnd}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  failed: { alignItems: 'center', justifyContent: 'center' },
});
