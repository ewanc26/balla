import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ImageViewerImage {
  thumb?: string;
  fullsize?: string;
  alt?: string;
}

interface ImageViewerProps {
  /** Image views from a post embed, in order; fullsize is preferred for viewing. */
  images: ImageViewerImage[];
  /** The image to open at, or null while the viewer is closed. */
  index: number | null;
  onClose: () => void;
}

export function ImageViewer({ images, index, onClose }: ImageViewerProps) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // One viewer per card, reused across taps; resync when it opens on a new image.
    if (index !== null) setCurrent(index);
  }, [index]);

  if (index === null || images.length === 0) return null;

  const image = images[Math.min(current, images.length - 1)];
  const uri = image.fullsize || image.thumb || '';

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {images.length > 1 && (
            <Text style={styles.counter}>
              {current + 1} of {images.length}
            </Text>
          )}
          {/* Spacer keeps the counter centred without a second control. */}
          <View style={styles.closeButton} />
        </View>

        <View style={styles.stage}>
          {loading && (
            <View style={styles.spinner}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
          <Image
            source={{ uri }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Stepping is always a visible button, never a swipe-only gesture. */}
        {current > 0 && (
          <Pressable
            onPress={() => setCurrent(current - 1)}
            accessibilityRole="button"
            accessibilityLabel="Previous image"
            style={[styles.stepButton, styles.prev]}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
        )}
        {current < images.length - 1 && (
          <Pressable
            onPress={() => setCurrent(current + 1)}
            accessibilityRole="button"
            accessibilityLabel="Next image"
            style={[styles.stepButton, styles.next]}
          >
            <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
          </Pressable>
        )}

        {!!image.alt && (
          <Text style={styles.alt} numberOfLines={2}>
            {image.alt}
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.96)' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 52,
  },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  stage: { flex: 1 },
  // Written out rather than StyleSheet.absoluteFillObject, which RN 0.88's
  // generated StyleSheet types no longer export.
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { flex: 1 },
  stepButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prev: { left: 8 },
  next: { right: 8 },
  alt: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlign: 'center',
  },
});
