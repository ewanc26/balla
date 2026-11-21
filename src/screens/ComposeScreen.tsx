import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { countGraphemes } from 'unicode-segmenter/grapheme';
import { agent } from '../lib/agent';
import { describeFailure } from '../lib/reliability';
import { Avatar } from '../components/Avatar';
import { useViewer } from '../lib/viewer';
import { usePreferences } from '../lib/preferences';
import { base64ToBytes, formatBytes } from '../lib/imageBytes';
import {
  MAX_ALT_TEXT,
  MAX_COMPOSER_IMAGES,
  MAX_POST_IMAGE_BYTES,
  altTextTooLongCount,
  buildPostEmbed,
  canPublishPost,
  missingAltTextCount,
} from '../lib/composerPost';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

// Bluesky caps posts at 300 graphemes; the counter is honest and always
// visible rather than a colour shift you have to notice.
const LIMIT = 300;
const MAX_LONG_EDGE = 2048;

type ComposerImage = {
  key: string;
  uri: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  byteSize: number;
  alt: string;
};

type UploadProgress = { current: number; total: number };

let imageSequence = 0;

function newImageKey(): string {
  imageSequence += 1;
  return `compose-image-${imageSequence}-${Date.now()}`;
}

function abortError(): Error {
  const error = new Error('Upload cancelled');
  error.name = 'AbortError';
  return error;
}

function longEdge(width: number, height: number): number {
  return Math.max(width || 0, height || 0);
}

async function prepareImage(
  asset: ImagePicker.ImagePickerAsset
): Promise<ComposerImage> {
  const sourceWidth = Math.max(1, Math.round(asset.width || 0));
  const sourceHeight = Math.max(1, Math.round(asset.height || 0));
  const sourceEdge = longEdge(sourceWidth, sourceHeight);
  const targets = Array.from(
    new Set(
      [MAX_LONG_EDGE, 1600, 1200, 800]
        .map((target) => Math.min(target, sourceEdge || target))
        .filter((target) => target >= 320)
    )
  ).sort((a, b) => b - a);

  let lastSize = 0;
  for (const edge of targets.length ? targets : [MAX_LONG_EDGE]) {
    const resize =
      sourceEdge > edge && sourceWidth > 0 && sourceHeight > 0
        ? [
            sourceWidth >= sourceHeight
              ? { resize: { width: edge } }
              : { resize: { height: edge } },
          ]
        : [];
    const result = await manipulateAsync(asset.uri, resize, {
      compress: 0.82,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) throw new Error('Image preparation failed');
    const bytes = base64ToBytes(result.base64);
    lastSize = bytes.byteLength;
    if (lastSize <= MAX_POST_IMAGE_BYTES) {
      return {
        key: newImageKey(),
        uri: result.uri,
        width: Math.max(1, result.width),
        height: Math.max(1, result.height),
        bytes,
        byteSize: lastSize,
        alt: '',
      };
    }
  }

  if (lastSize > 0) {
    throw new Error(
      `That photo is still ${formatBytes(
        lastSize
      )} after compression; the limit is ${formatBytes(MAX_POST_IMAGE_BYTES)}.`
    );
  }
  throw new Error('That photo could not be prepared.');
}

export function ComposeScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const { preferences } = usePreferences();
  const quote = route && route.params ? route.params.quote : null;

  const [text, setText] = useState('');
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState<'library' | 'camera' | null>(null);
  const [confirmWithoutAlt, setConfirmWithoutAlt] = useState(false);

  const uploadedRef = useRef<Map<string, unknown>>(new Map());
  const uploadAbortRef = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Create post' });
  }, [navigation]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event: any) => {
      if (!sending) return;
      event.preventDefault();
      setError(
        uploadProgress
          ? 'Cancel the photo upload before leaving. Your text and photos will stay here.'
          : 'This post is being published. Wait for it to finish before leaving.'
      );
    });
  }, [navigation, sending, uploadProgress]);

  const trimmed = text.trim();
  const count = countGraphemes(trimmed);
  const over = count > LIMIT;
  const missingAlt = missingAltTextCount(images);
  const tooLongAlt = altTextTooLongCount(images);
  const canPost = canPublishPost({
    text: trimmed,
    imageCount: images.length,
    hasQuote: !!quote,
  });
  const blocked = sending || !canPost || over;
  const editingImage = editingKey
    ? images.find((image) => image.key === editingKey) || null
    : null;

  async function addAssets(
    assets: ImagePicker.ImagePickerAsset[],
    remaining: number,
    overflowed: boolean
  ) {
    const selected = assets.slice(0, remaining);
    const prepared: ComposerImage[] = [];
    let failures = 0;

    for (const asset of selected) {
      try {
        prepared.push(await prepareImage(asset));
      } catch {
        failures += 1;
      }
    }

    if (prepared.length) {
      setImages((prev) => [...prev, ...prepared].slice(0, MAX_COMPOSER_IMAGES));
    }

    if (failures) {
      setError(
        `${failures} photo${failures === 1 ? '' : 's'} could not be prepared. Try a smaller image, or a different file.`
      );
    } else {
      setError(null);
    }

    if (overflowed) {
      setNotice(
        `You can attach up to ${MAX_COMPOSER_IMAGES} photos. Only the first ${remaining} selected here were added.`
      );
    } else if (prepared.length) {
      setNotice(null);
    }
  }

  async function pickFromLibrary() {
    if (mediaBusy || sending) return;
    const remaining = MAX_COMPOSER_IMAGES - images.length;
    if (remaining <= 0) return;

    setError(null);
    setNotice(null);
    setMediaBusy('library');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(
            'Photo access is needed to choose images for a post. You can allow it in your device settings.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      await addAssets(
        result.assets,
        remaining,
        result.assets.length > remaining
      );
    } catch {
      setError(
        'Could not open your photos. If the picker did not appear, check photo permissions and try again.'
      );
    } finally {
      setMediaBusy(null);
    }
  }

  async function takePhoto() {
    if (mediaBusy || sending) return;
    const remaining = MAX_COMPOSER_IMAGES - images.length;
    if (remaining <= 0) return;

    setError(null);
    setNotice(null);
    setMediaBusy('camera');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(
            'Camera access is needed to take a photo for a post. You can allow it in your device settings.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      await addAssets(result.assets.slice(0, 1), remaining, false);
    } catch {
      setError(
        'Could not open the camera. Check camera permissions or choose a photo instead.'
      );
    } finally {
      setMediaBusy(null);
    }
  }

  function removeImage(key: string) {
    if (sending) return;
    uploadedRef.current.delete(key);
    setImages((prev) => prev.filter((image) => image.key !== key));
    if (editingKey === key) setEditingKey(null);
    setConfirmWithoutAlt(false);
    setError(null);
  }

  function openAltText(key: string) {
    if (sending) return;
    const image = images.find((item) => item.key === key);
    if (!image) return;
    setAltDraft(image.alt);
    setEditingKey(key);
  }

  function openFirstMissingAlt() {
    const image = images.find((item) => !item.alt.trim());
    if (!image) return;
    setConfirmWithoutAlt(false);
    openAltText(image.key);
  }

  function saveAltText() {
    if (!editingKey) return;
    if (countGraphemes(altDraft.trim()) > MAX_ALT_TEXT) return;
    const value = altDraft.trim();
    setImages((prev) =>
      prev.map((image) =>
        image.key === editingKey ? { ...image, alt: value } : image
      )
    );
    setEditingKey(null);
    setError(null);
    setNotice(null);
    const everyImageDescribed = images.every(
      (image) => image.key === editingKey || !!image.alt.trim()
    );
    if (everyImageDescribed) setConfirmWithoutAlt(false);
  }

  function cancelUpload() {
    uploadAbortRef.current?.abort();
  }

  async function send(withoutAltPrompt = false) {
    if (sending || over || !canPost) return;

    if (tooLongAlt > 0) {
      setError(
        `Alt text is limited to ${MAX_ALT_TEXT} characters. Shorten the highlighted photo description.`
      );
      const image = images.find(
        (item) => countGraphemes(item.alt.trim()) > MAX_ALT_TEXT
      );
      if (image) openAltText(image.key);
      return;
    }

    if (missingAlt > 0) {
      if (preferences.requireAltText) {
        setError(
          `Add alt text to ${missingAlt === 1 ? 'the photo' : `all ${missingAlt} photos`} before posting. You can turn off “Require alt text” in Settings.`
        );
        openFirstMissingAlt();
        return;
      }
      if (!withoutAltPrompt) {
        setConfirmWithoutAlt(true);
        return;
      }
    }

    setConfirmWithoutAlt(false);
    setError(null);
    setNotice(null);
    setSending(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const attachments = [];
      for (let index = 0; index < images.length; index += 1) {
        if (controller.signal.aborted) throw abortError();
        const image = images[index];
        setUploadProgress({ current: index + 1, total: images.length });

        let blob = uploadedRef.current.get(image.key);
        if (!blob) {
          if (controller.signal.aborted) throw abortError();
          const uploaded = await agent.uploadBlob(image.bytes, {
            encoding: 'image/jpeg',
            signal: controller.signal,
          });
          blob = uploaded.data.blob;
          uploadedRef.current.set(image.key, blob);
        }

        attachments.push({
          alt: image.alt,
          blob,
          width: image.width,
          height: image.height,
        });
      }

      setUploadProgress(null);
      if (controller.signal.aborted) throw abortError();
      const embed = buildPostEmbed(attachments, quote);

      await agent.post({
        text: trimmed,
        ...(embed ? { embed } : {}),
      });
      uploadedRef.current.clear();
      setSending(false);
      setUploadProgress(null);
      navigation.goBack();
      return;
    } catch (err) {
      if (controller.signal.aborted) {
        setError(
          'Upload cancelled. Your text and photos are still here; tap Post to try again.'
        );
      } else {
        setError(
          `${describeFailure(err, 'Could not publish this post.')} Your text and photos are safe here; tap Post to retry.`
        );
      }
    } finally {
      uploadAbortRef.current = null;
      setSending(false);
      setUploadProgress(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 8, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar
              avatar={profile && profile.avatar}
              displayName={
                (profile && (profile.displayName || profile.handle)) || 'You'
              }
              size={40}
            />
            <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: p.text, fontSize: 15, fontWeight: '700' }}
                numberOfLines={1}
              >
                {(profile && (profile.displayName || profile.handle)) || 'You'}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
              >
                <Text style={{ color: p.secondary, fontSize: 13 }}>Public</Text>
                <Ionicons
                  name="globe-outline"
                  size={12}
                  color={p.secondary}
                  style={{ marginLeft: 4 }}
                />
                <Text style={{ color: p.secondary, fontSize: 13 }}>
                  {' · Anyone on Bluesky'}
                </Text>
              </View>
            </View>
          </View>

          <TextInput
            autoFocus
            multiline
            editable={!sending}
            placeholder="What's on your mind?"
            placeholderTextColor={p.secondary}
            value={text}
            onChangeText={setText}
            style={[
              {
                color: p.text,
                fontSize: 17,
                lineHeight: 24,
                paddingVertical: 14,
                minHeight: 140,
                marginTop: 4,
                textAlignVertical: 'top',
              },
              webInputReset,
            ]}
          />

          {images.length > 0 ? (
            <View style={styles.gallery}>
              {images.map((image, index) => (
                <PhotoTile
                  key={image.key}
                  image={image}
                  index={index}
                  count={images.length}
                  disabled={sending}
                  onEditAlt={() => openAltText(image.key)}
                  onRemove={() => removeImage(image.key)}
                />
              ))}
            </View>
          ) : null}

          {images.length > 0 && missingAlt > 0 ? (
            <View
              style={[
                styles.infoNote,
                { backgroundColor: p.accentSoft, borderColor: p.divider },
              ]}
            >
              <Ionicons
                name="accessibility-outline"
                size={18}
                color={p.accent}
              />
              <Text
                style={{
                  color: p.text,
                  fontSize: 12,
                  lineHeight: 18,
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                Alt text describes photos for blind and low-vision people.{' '}
                {missingAlt === 1
                  ? 'One photo is missing a description.'
                  : `${missingAlt} photos are missing descriptions.`}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.mediaBar,
              { borderTopColor: p.divider, borderBottomColor: p.divider },
            ]}
          >
            <Text style={{ color: p.secondary, fontSize: 12, flex: 1 }}>
              {mediaBusy
                ? 'Preparing photos…'
                : `${images.length}/${MAX_COMPOSER_IMAGES} photos`}
            </Text>
            {mediaBusy ? (
              <ActivityIndicator
                size="small"
                color={p.accent}
                style={{ marginRight: 10 }}
              />
            ) : null}
            <MediaButton
              icon="images-outline"
              label="Photo"
              accessibilityLabel="Add photos to this post"
              onPress={() => void pickFromLibrary()}
              disabled={!!mediaBusy || sending || images.length >= MAX_COMPOSER_IMAGES}
            />
            <MediaButton
              icon="camera-outline"
              label="Camera"
              accessibilityLabel="Take a photo for this post"
              onPress={() => void takePhoto()}
              disabled={!!mediaBusy || sending || images.length >= MAX_COMPOSER_IMAGES}
            />
          </View>

          {quote ? (
            <View
              style={[
                styles.quote,
                { borderColor: p.divider, backgroundColor: p.bg },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar
                  avatar={quote.author && quote.author.avatar}
                  displayName={
                    (quote.author &&
                      (quote.author.displayName || quote.author.handle)) ||
                    'Quoted post'
                  }
                  size={28}
                />
                <Text
                  style={{
                    color: p.text,
                    fontSize: 13,
                    fontWeight: '700',
                    marginLeft: 8,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {(quote.author &&
                    (quote.author.displayName || quote.author.handle)) ||
                    'Quoted post'}
                </Text>
              </View>
              {quote.record && quote.record.text ? (
                <Text
                  style={{
                    color: p.text,
                    fontSize: 14,
                    lineHeight: 20,
                    marginTop: 8,
                  }}
                  numberOfLines={4}
                >
                  {quote.record.text}
                </Text>
              ) : null}
            </View>
          ) : null}

          {confirmWithoutAlt && missingAlt > 0 ? (
            <View
              accessibilityRole="alert"
              style={[
                styles.warning,
                { borderColor: p.danger, backgroundColor: p.card },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                Post without alt text?
              </Text>
              <Text
                style={{
                  color: p.secondary,
                  fontSize: 13,
                  lineHeight: 19,
                  marginTop: 4,
                }}
              >
                {missingAlt === 1
                  ? 'One photo has no description.'
                  : `${missingAlt} photos have no descriptions.`}{' '}
                Blind and low-vision people will not know what they show.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable
                  onPress={openFirstMissingAlt}
                  accessibilityRole="button"
                  accessibilityLabel="Add photo descriptions"
                  style={({ pressed }) => [
                    styles.promptButton,
                    {
                      backgroundColor: p.accent,
                      borderColor: p.accent,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{ color: p.onAccent, fontSize: 13, fontWeight: '700' }}
                  >
                    Add descriptions
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void send(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Post without alt text"
                  style={({ pressed }) => [
                    styles.promptButton,
                    {
                      backgroundColor: p.bg,
                      borderColor: p.divider,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>
                    Post anyway
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {error ? (
            <View
              accessibilityRole="alert"
              style={[
                styles.error,
                { borderColor: 'rgba(228, 30, 63, 0.3)' },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={p.danger}
              />
              <Text
                style={{
                  color: p.danger,
                  fontSize: 13,
                  lineHeight: 19,
                  flex: 1,
                  marginLeft: 7,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {notice ? (
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
              {notice}
            </Text>
          ) : null}

          <View
            style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.divider }}
          />

          <View style={styles.footer}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: over ? p.danger : p.secondary, fontSize: 13 }}
              >
                {count}/{LIMIT}
              </Text>
              {over ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: p.danger, fontSize: 12, marginTop: 2 }}
                >
                  {count - LIMIT} grapheme{count - LIMIT === 1 ? '' : 's'} over the
                  limit.
                </Text>
              ) : sending ? (
                <Text
                  style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {uploadProgress
                    ? `Uploading photo ${uploadProgress.current} of ${uploadProgress.total}…`
                    : 'Publishing…'}
                </Text>
              ) : null}
            </View>
            {sending && uploadProgress ? (
              <Pressable
                onPress={cancelUpload}
                accessibilityRole="button"
                accessibilityLabel="Cancel photo upload"
                style={({ pressed }) => [
                  styles.cancelUpload,
                  {
                    borderColor: p.divider,
                    backgroundColor: p.bg,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void send(false)}
                disabled={blocked}
                accessibilityRole="button"
                accessibilityLabel="Post"
                accessibilityState={{ disabled: blocked, busy: sending }}
                style={({ pressed }) => ({
                  backgroundColor: p.accent,
                  opacity: pressed || blocked ? 0.5 : 1,
                  borderRadius: CARD_RADIUS,
                  minHeight: 44,
                  minWidth: 96,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {sending ? (
                  <ActivityIndicator color={p.onAccent} />
                ) : (
                  <Text
                    style={{ color: p.onAccent, fontWeight: '700', fontSize: 15 }}
                  >
                    Post
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {editingImage ? (
        <AltTextSheet
          image={editingImage}
          altText={altDraft}
          onChangeAltText={setAltDraft}
          onClose={() => setEditingKey(null)}
          onSave={saveAltText}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function PhotoTile({
  image,
  index,
  count,
  disabled,
  onEditAlt,
  onRemove,
}: {
  image: ComposerImage;
  index: number;
  count: number;
  disabled: boolean;
  onEditAlt: () => void;
  onRemove: () => void;
}) {
  const p = usePalette();
  const columns = count === 1 ? 1 : count > 4 ? 3 : 2;
  const ratio =
    columns === 1
      ? Math.max(0.75, Math.min(1.91, image.width / image.height))
      : 1;
  const shownAlt = image.alt.trim();

  return (
    <View
      style={[
        styles.photoTile,
        {
          width: columns === 1 ? '100%' : columns === 3 ? '32.2%' : '49.4%',
          aspectRatio: ratio,
          backgroundColor: p.soft,
        },
      ]}
    >
      <Image
        source={{ uri: image.uri }}
        style={styles.photo}
        resizeMode="cover"
        accessible
        accessibilityLabel={
          shownAlt || `Selected photo ${index + 1} of ${count}`
        }
      />
      <Pressable
        onPress={onEditAlt}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          shownAlt
            ? `Edit alt text for photo ${index + 1}. Description added.`
            : `Add alt text for photo ${index + 1}. No description yet.`
        }
        style={({ pressed }) => [
          styles.altButton,
          {
            backgroundColor: shownAlt
              ? 'rgba(24, 119, 242, 0.94)'
              : 'rgba(0, 0, 0, 0.76)',
            opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Ionicons
          name={shownAlt ? 'checkmark' : 'add'}
          size={13}
          color="#FFFFFF"
        />
        <Text style={styles.altButtonText}>ALT</Text>
      </Pressable>
      <Pressable
        onPress={onRemove}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Remove photo ${index + 1}`}
        style={({ pressed }) => [
          styles.removeHit,
          { opacity: disabled ? 0.55 : pressed ? 0.65 : 1 },
        ]}
      >
        <View style={styles.removeCircle}>
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

function MediaButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  icon: any;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.mediaButton,
        {
          backgroundColor: pressed ? p.bg : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={p.green} />
      <Text
        style={{
          color: p.text,
          fontSize: 13,
          fontWeight: '600',
          marginLeft: 5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AltTextSheet({
  image,
  altText,
  onChangeAltText,
  onClose,
  onSave,
}: {
  image: ComposerImage;
  altText: string;
  onChangeAltText: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const altCount = countGraphemes(altText.trim());
  const over = altCount > MAX_ALT_TEXT;

  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close alt text editor"
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Alt text
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close alt text editor"
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>

          <Image
            source={{ uri: image.uri }}
            style={[styles.altPreview, { backgroundColor: p.bg }]}
            resizeMode="contain"
            accessible
            accessibilityLabel={altText || 'Photo being described'}
          />
          <Text style={{ color: p.secondary, fontSize: 11, marginTop: 5 }}>
            {image.width} × {image.height} · {formatBytes(image.byteSize)} · JPEG
          </Text>

          <Text
            style={{
              color: p.text,
              fontSize: 14,
              fontWeight: '700',
              marginTop: 12,
            }}
          >
            Describe this photo
          </Text>
          <Text
            style={{
              color: p.secondary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: 2,
              marginBottom: 6,
            }}
          >
            Say what matters in the image, not just that it is a photo. Leave it
            blank if the image is purely decorative.
          </Text>
          <TextInput
            autoFocus
            multiline
            value={altText}
            onChangeText={onChangeAltText}
            placeholder="e.g. A black cat asleep on a blue armchair"
            placeholderTextColor={p.secondary}
            accessibilityLabel="Descriptive alt text"
            textAlignVertical="top"
            style={[
              styles.altInput,
              {
                color: p.text,
                backgroundColor: p.bg,
                borderColor: over ? p.danger : p.divider,
              },
              webInputReset,
            ]}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 6,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: over ? p.danger : p.secondary,
                fontSize: 12,
                flex: 1,
              }}
            >
              {over
                ? `Shorten this by ${altCount - MAX_ALT_TEXT} character${
                    altCount - MAX_ALT_TEXT === 1 ? '' : 's'
                  }.`
                : 'Descriptions are public and shown with the photo.'}
            </Text>
            <Text
              style={{ color: over ? p.danger : p.secondary, fontSize: 12 }}
            >
              {altCount}/{MAX_ALT_TEXT}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel alt text changes"
              style={({ pressed }) => [
                styles.sheetButton,
                {
                  backgroundColor: p.bg,
                  borderColor: p.divider,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={over}
              accessibilityRole="button"
              accessibilityLabel="Save alt text"
              accessibilityState={{ disabled: over }}
              style={({ pressed }) => [
                styles.sheetButton,
                {
                  backgroundColor: p.accent,
                  borderColor: p.accent,
                  opacity: over ? 0.45 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  photoTile: {
    position: 'relative',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  altButton: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    minHeight: 44,
    borderRadius: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  altButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginLeft: 3,
  },
  removeHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 10,
    marginBottom: 10,
  },
  mediaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    marginTop: 2,
  },
  mediaButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quote: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginTop: 10,
  },
  warning: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginTop: 10,
  },
  promptButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    backgroundColor: 'rgba(228, 30, 63, 0.08)',
    padding: 10,
    marginTop: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    gap: 10,
  },
  cancelUpload: {
    minHeight: 44,
    minWidth: 88,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '94%',
    alignSelf: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altPreview: {
    width: '100%',
    height: 170,
    borderRadius: CARD_RADIUS,
    marginTop: 4,
  },
  altInput: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
  },
  sheetButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
