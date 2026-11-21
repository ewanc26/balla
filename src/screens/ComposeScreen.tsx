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
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
  webCheckedProps,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
import {
  clearStoredDraft,
  loadStoredDraft,
  saveStoredDraft,
} from '../lib/draftStorage';
import { describeDraft, type StoredDraft } from '../lib/draftModel';
import { firstWebUrl, type ExternalView } from '../lib/embedModel';
import { resolveExternalLink } from '../lib/externalLink';
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
  threadReply,
  type StrongRef,
} from '../lib/composerPost';
import {
  LANGUAGE_OPTIONS,
  MAX_POST_LANGUAGES,
  SELF_LABEL_OPTIONS,
  buildSelfLabels,
  languageSummary,
  normaliseLanguages,
  normaliseSelfLabels,
} from '../lib/postOptions';
import {
  DEFAULT_INTERACTION_GATES,
  describeGates,
  gatesEqual,
  normaliseGates,
  postgateWrite,
  threadgateWrite,
  type InteractionGates,
  type QuoteAccess,
  type ReplyAccess,
} from '../lib/interactionGates';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

// Bluesky caps posts at 300 graphemes; the counter is honest and always
// visible rather than a colour shift you have to notice.
const LIMIT = 300;
const MAX_LONG_EDGE = 2048;

const REPLY_OPTIONS: Array<{ value: ReplyAccess; label: string; detail: string }> = [
  { value: 'everyone', label: 'Everyone', detail: 'Anyone on Bluesky can reply' },
  { value: 'mentioned', label: 'Mentioned accounts', detail: 'Only people named in the post' },
  { value: 'following', label: 'People you follow', detail: 'Anyone in your following list' },
  { value: 'followers', label: 'People who follow you', detail: 'Anyone following your account' },
  { value: 'nobody', label: 'Nobody', detail: 'Close replies on this post' },
];

const QUOTE_OPTIONS: Array<{ value: QuoteAccess; label: string; detail: string }> = [
  { value: 'everyone', label: 'Anyone', detail: 'This post can be quoted' },
  { value: 'nobody', label: 'Nobody', detail: 'Disable quotes of this post' },
];

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
type PendingPost = {
  key: string;
  text: string;
  images: ComposerImage[];
  quote: any;
  linkCard: ExternalView | null;
  selfLabels: string[];
  languages: string[];
  gates: InteractionGates;
};

let imageSequence = 0;
let draftSequence = 0;

function newDraftKey(): string {
  draftSequence += 1;
  return `compose-post-${draftSequence}-${Date.now()}`;
}

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
  const [quote, setQuote] = useState(
    route && route.params ? route.params.quote : null
  );

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
  const [linkCard, setLinkCard] = useState<ExternalView | null>(null);
  const [selfLabels, setSelfLabels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [gates, setGates] = useState<InteractionGates>(DEFAULT_INTERACTION_GATES);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [resolvingLink, setResolvingLink] = useState(false);
  const [pending, setPending] = useState<PendingPost[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<PendingPost | null>(null);
  const [threadRoot, setThreadRoot] = useState<StrongRef | null>(null);
  const [threadParent, setThreadParent] = useState<StrongRef | null>(null);
  const [postProgress, setPostProgress] = useState<UploadProgress | null>(null);
  const [publishedDone, setPublishedDone] = useState(false);
  const [altAction, setAltAction] = useState<'send' | 'add'>('send');
  const [recoverDraft, setRecoverDraft] = useState<StoredDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const editorRef = useRef<any>(null);

  const uploadedRef = useRef<Map<string, unknown>>(new Map());
  const uploadAbortRef = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Create post' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    void loadStoredDraft().then((draft) => {
      if (!active) return;
      if (draft) setRecoverDraft(draft);
      setDraftChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Save the unfinished post so it survives an app restart. Wait until the
    // recovery prompt is resolved, or an empty editor would overwrite the very
    // draft we are asking to restore. Photos and quotes are not persisted.
    if (!draftChecked || recoverDraft || sending || publishedDone) return;
    const timer = setTimeout(() => {
      void saveStoredDraft({
        text,
        selfLabels: normaliseSelfLabels(selfLabels),
        languages: normaliseLanguages(languages),
        gates: normaliseGates(gates),
        savedAt: new Date().toISOString(),
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [text, selfLabels, languages, gates, draftChecked, recoverDraft, sending, publishedDone]);

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
    hasLink: !!linkCard,
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
      // A post may carry one media embed. Photos win, so drop the link card
      // visibly rather than silently deciding which one to keep.
      if (linkCard) setLinkCard(null);
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
    } else if (prepared.length && linkCard) {
      setNotice('Photos and link cards cannot share a post. The link card was removed.');
    } else if (prepared.length) {
      setNotice(null);
    }
  }

  async function addLinkCard() {
    if (resolvingLink || sending) return;
    setError(null);
    const candidate = firstWebUrl(text);
    if (!candidate) {
      setError('Add a complete web link to your post, then tap Link card.');
      return;
    }
    setResolvingLink(true);
    try {
      setLinkCard(await resolveExternalLink(candidate));
      setNotice(null);
    } catch (err) {
      setLinkCard(null);
      setError(describeFailure(err, 'Could not build a link card for that URL.'));
    } finally {
      setResolvingLink(false);
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

  function snapshot(key = newDraftKey()): PendingPost {
    return {
      key,
      text: trimmed,
      images,
      quote,
      linkCard,
      selfLabels: normaliseSelfLabels(selfLabels),
      languages: normaliseLanguages(languages),
      gates: normaliseGates(gates),
    };
  }

  function resetEditor() {
    setText('');
    setImages([]);
    setQuote(null);
    setLinkCard(null);
    setSelfLabels([]);
    setLanguages([]);
    setGates(DEFAULT_INTERACTION_GATES);
    setEditingKey(null);
    setConfirmWithoutAlt(false);
    setNotice(null);
  }

  function recoverStoredDraft() {
    if (!recoverDraft) return;
    // Only the text and simple choices are saved. A quote passed in from
    // another screen stays in place, and photos must be added again.
    setText(recoverDraft.text);
    setSelfLabels(normaliseSelfLabels(recoverDraft.selfLabels));
    setLanguages(normaliseLanguages(recoverDraft.languages));
    setGates(normaliseGates(recoverDraft.gates));
    setRecoverDraft(null);
    setNotice('Draft restored. Photos and quoted posts need adding again.');
    editorRef.current?.focus();
  }

  function discardStoredDraft() {
    void clearStoredDraft();
    setRecoverDraft(null);
  }

  function loadDraft(draft: PendingPost) {
    setText(draft.text);
    setImages(draft.images);
    setQuote(draft.quote);
    setLinkCard(draft.linkCard);
    setSelfLabels(normaliseSelfLabels(draft.selfLabels || []));
    setLanguages(normaliseLanguages(draft.languages || []));
    setGates(normaliseGates(draft.gates));
    setEditingKey(null);
    editorRef.current?.focus();
  }

  /** Shared preflight for publishing and for queueing a post in a thread. */
  function ready(withoutAltPrompt: boolean, action: 'send' | 'add'): boolean {
    if (sending || over || !canPost) return false;
    if (tooLongAlt > 0) {
      setError(
        `Alt text is limited to ${MAX_ALT_TEXT} characters. Shorten the highlighted photo description.`
      );
      const image = images.find(
        (item) => countGraphemes(item.alt.trim()) > MAX_ALT_TEXT
      );
      if (image) openAltText(image.key);
      return false;
    }
    if (missingAlt > 0) {
      if (preferences.requireAltText) {
        setError(
          `Add alt text to ${missingAlt === 1 ? 'the photo' : `all ${missingAlt} photos`} before ${pending.length ? 'adding another post' : 'posting'}. You can turn off “Require alt text” in Settings.`
        );
        openFirstMissingAlt();
        return false;
      }
      if (!withoutAltPrompt) {
        setAltAction(action);
        setConfirmWithoutAlt(true);
        return false;
      }
    }
    return true;
  }

  function addAnother(withoutAltPrompt = false) {
    if (!ready(withoutAltPrompt, 'add')) return;
    const draft = snapshot(
      editingIndex !== null && editingOriginal ? editingOriginal.key : newDraftKey()
    );
    if (editingIndex !== null) {
      setPending((prev) => [
        ...prev.slice(0, editingIndex),
        draft,
        ...prev.slice(editingIndex),
      ]);
    } else {
      setPending((prev) => [...prev, draft]);
    }
    setEditingIndex(null);
    setEditingOriginal(null);
    resetEditor();
    setError(null);
    const position = editingIndex !== null ? editingIndex + 1 : pending.length + 1;
    setNotice(`Post ${position} added to the thread. Write the next one.`);
    editorRef.current?.focus();
  }

  function editPending(index: number) {
    const original = pending[index];
    if (!original) return;
    setPending((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(index);
    setEditingOriginal(original);
    setError(null);
    loadDraft(original);
    setNotice(`Editing post ${index + 1}. Add it back with Add to thread.`);
  }

  function cancelEdit() {
    if (editingIndex !== null && editingOriginal) {
      setPending((prev) => [
        ...prev.slice(0, editingIndex),
        editingOriginal,
        ...prev.slice(editingIndex),
      ]);
    }
    setEditingIndex(null);
    setEditingOriginal(null);
    resetEditor();
  }

  function removePending(index: number) {
    setPending((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
    setNotice('Post removed from the thread.');
  }

  async function send(withoutAltPrompt = false) {
    if (!ready(withoutAltPrompt, 'send')) return;

    const drafts = [...pending, snapshot()];
    const total = drafts.length;
    setConfirmWithoutAlt(false);
    setError(null);
    setNotice(null);
    setSending(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    let published = 0;
    let root = threadRoot;
    let parent = threadParent;

    try {
      for (let index = 0; index < drafts.length; index += 1) {
        if (controller.signal.aborted) throw abortError();
        const draft = drafts[index];
        setPostProgress({ current: index + 1, total });
        const attachments = [];
        for (let imageIndex = 0; imageIndex < draft.images.length; imageIndex += 1) {
          if (controller.signal.aborted) throw abortError();
          const image = draft.images[imageIndex];
          setUploadProgress({
            current: imageIndex + 1,
            total: draft.images.length,
          });
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

        if (controller.signal.aborted) throw abortError();
        setUploadProgress(null);
        const embed = buildPostEmbed(attachments, draft.quote, draft.linkCard);
        const labels = buildSelfLabels(draft.selfLabels);
        const langs = normaliseLanguages(draft.languages);
        const created = await agent.post({
          text: draft.text.trim(),
          ...(embed ? { embed } : {}),
          ...(labels ? { labels } : {}),
          ...(langs.length ? { langs } : {}),
          ...threadReply(root, parent),
        });
        // The first post is the root; every later post replies to the one
        // before it, so a thread stays one conversation.
        root = root || created;
        parent = created;
        published = index + 1;
      }

      uploadedRef.current.clear();
      setPending([]);
      setEditingIndex(null);
      setEditingOriginal(null);
      setThreadRoot(null);
      setThreadParent(null);
      resetEditor();
      // The post is already live, so keep its local draft cleared even if a
      // gate write fails. A retry here would publish the post a second time.
      void clearStoredDraft();
      setPublishedDone(true);

      let gateFailed = false;
      if (root) {
        const rootGates = normaliseGates(drafts[0].gates);
        const createdAt = new Date().toISOString();
        const writes = [
          threadgateWrite(root.uri, rootGates, createdAt),
          postgateWrite(root.uri, rootGates, createdAt),
        ];
        for (const write of writes) {
          if (!write) continue;
          try {
            await agent.com.atproto.repo.putRecord({
              repo: agent.did!,
              collection: write.collection,
              rkey: write.rkey,
              record: write.record,
              validate: true,
            });
          } catch (err) {
            gateFailed = true;
            setError(
              `${describeFailure(err, 'Could not write the interaction record.')} Your post is published; you can change who can reply and quote from its options.`
            );
            break;
          }
        }
      }
      if (!gateFailed) navigation.goBack();
      return;
    } catch (err) {
      const failure = controller.signal.aborted
        ? 'Upload cancelled. Your text and photos are still here; tap Post to try again.'
        : `${describeFailure(err, 'Could not publish this post.')} Your text and photos are safe here; tap Post to retry.`;
      if (published > 0) {
        const remaining = drafts.slice(published);
        setThreadRoot(root);
        setThreadParent(parent);
        setPending(remaining.slice(0, -1));
        loadDraft(remaining[remaining.length - 1]);
        setEditingIndex(null);
        setEditingOriginal(null);
        setNotice(
          `${published} of ${total} posts published. The remaining ${remaining.length} are still here and will continue the thread.`
        );
      }
      setError(failure);
    } finally {
      uploadAbortRef.current = null;
      setSending(false);
      setUploadProgress(null);
      setPostProgress(null);
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
        {pending.length > 0 || editingIndex !== null ? (
          <View
            style={[
              styles.card,
              { backgroundColor: p.card, borderColor: p.divider },
              cardShadow,
            ]}
          >
            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 16, fontWeight: '700' }}
            >
              Thread · {pending.length + (editingIndex !== null ? 1 : 0)} posts
            </Text>
            <Text
              style={{
                color: p.secondary,
                fontSize: 12,
                lineHeight: 18,
                marginTop: 4,
              }}
            >
              Posts publish in order as one conversation. Nothing is published
              until you tap Post all.
            </Text>
            {pending.map((draft, index) => {
              const position =
                editingIndex !== null && index >= editingIndex ? index + 2 : index + 1;
              return (
                <View
                  key={draft.key}
                  style={[
                    styles.queued,
                    { backgroundColor: p.bg, borderColor: p.divider },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: p.accent,
                        fontSize: 11,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                      }}
                    >
                      Post {position}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ color: p.text, fontSize: 14, marginTop: 2 }}
                    >
                      {draft.text.trim() || 'No text'}
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 11, marginTop: 2 }}>
                      {draft.images.length
                        ? `${draft.images.length} photo${draft.images.length === 1 ? '' : 's'}`
                        : draft.linkCard
                          ? 'Link card'
                          : draft.quote
                            ? 'Quoted post'
                            : 'Text only'}
                    </Text>
                    {draft.selfLabels?.length ||
                    draft.languages?.length ||
                    (draft.gates && !gatesEqual(draft.gates, DEFAULT_INTERACTION_GATES)) ? (
                      <Text style={{ color: p.accent, fontSize: 11, marginTop: 2 }}>
                        {[
                          draft.selfLabels?.length
                            ? `${draft.selfLabels.length} content warning${draft.selfLabels.length === 1 ? '' : 's'}`
                            : null,
                          draft.languages?.length
                            ? languageSummary(draft.languages)
                            : null,
                          draft.gates && !gatesEqual(draft.gates, DEFAULT_INTERACTION_GATES)
                            ? describeGates(draft.gates)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => editPending(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit post ${position}`}
                    style={({ pressed }) => [
                      styles.queuedButton,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="create-outline" size={20} color={p.secondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => removePending(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove post ${position} from thread`}
                    style={({ pressed }) => [
                      styles.queuedButton,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color={p.danger} />
                  </Pressable>
                </View>
              );
            })}
            {editingIndex !== null ? (
              <Pressable
                onPress={cancelEdit}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing and restore this post"
                style={({ pressed }) => [
                  styles.textButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: p.secondary, fontSize: 13 }}>
                  Cancel editing post {editingIndex + 1}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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
            ref={editorRef}
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
            <View style={styles.mediaBarTop}>
              <Text style={{ color: p.secondary, fontSize: 12, flexShrink: 1 }}>
                {mediaBusy
                  ? 'Preparing photos…'
                  : `${images.length}/${MAX_COMPOSER_IMAGES} photos`}
              </Text>
              {mediaBusy ? (
                <ActivityIndicator size="small" color={p.accent} />
              ) : null}
            </View>
            <View style={styles.mediaButtons}>
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
              <MediaButton
                icon="link-outline"
                label="Link card"
                accessibilityLabel="Build a link card from the first web link in your post"
                onPress={() => void addLinkCard()}
                disabled={resolvingLink || sending || images.length > 0}
              />
            </View>
          </View>
          {images.length > 0 ? (
            <Text style={{ color: p.secondary, fontSize: 11, marginTop: 4 }}>
              Link cards are unavailable while photos are attached.
            </Text>
          ) : null}

          <View
            style={[
              styles.optionsRow,
              { borderTopColor: p.divider, borderBottomColor: p.divider },
            ]}
          >
            <Pressable
              onPress={() => setOptionsOpen(true)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Content warning and post options"
              accessibilityHint="Opens options for content warnings, languages, replies and quotes"
              accessibilityState={{ disabled: sending }}
              style={({ pressed }) => [
                styles.optionsButton,
                { opacity: sending ? 0.5 : pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={selfLabels.length ? 'shield' : 'shield-outline'}
                size={18}
                color={selfLabels.length ? p.accent : p.secondary}
              />
              <Text
                numberOfLines={1}
                style={{
                  color: selfLabels.length ? p.accent : p.secondary,
                  fontSize: 13,
                  fontWeight: selfLabels.length ? '700' : '500',
                  marginLeft: 6,
                  flexShrink: 1,
                }}
              >
                {selfLabels.length
                  ? `${selfLabels.length} warning${selfLabels.length === 1 ? '' : 's'}`
                  : 'Content warning'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={15}
                color={p.secondary}
                style={{ marginLeft: 2 }}
              />
            </Pressable>
            <View style={[styles.optionsDivider, { backgroundColor: p.divider }]} />
            <Pressable
              onPress={() => setOptionsOpen(true)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Language and interaction options"
              accessibilityHint="Opens options for languages, replies and quotes"
              accessibilityState={{ disabled: sending }}
              style={({ pressed }) => [
                styles.optionsButton,
                { opacity: sending ? 0.5 : pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name="language-outline"
                size={18}
                color={languages.length ? p.accent : p.secondary}
              />
              <Text
                numberOfLines={1}
                style={{
                  color: languages.length ? p.accent : p.secondary,
                  fontSize: 13,
                  fontWeight: languages.length ? '700' : '500',
                  marginLeft: 6,
                  flexShrink: 1,
                }}
              >
                {languageSummary(languages)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={15}
                color={p.secondary}
                style={{ marginLeft: 2 }}
              />
            </Pressable>
          </View>

          {linkCard ? (
            <View
              style={[
                styles.quote,
                { borderColor: p.divider, backgroundColor: p.bg },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      color: p.secondary,
                      fontSize: 11,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}
                  >
                    Link card
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: p.secondary, fontSize: 12, marginTop: 4 }}
                  >
                    {linkCard.host}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: p.text,
                      fontSize: 14,
                      fontWeight: '700',
                      marginTop: 2,
                    }}
                  >
                    {linkCard.title}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setLinkCard(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove link card"
                  accessibilityHint="The link stays in your post text"
                  style={({ pressed }) => [
                    styles.removeLink,
                    { backgroundColor: pressed ? p.divider : 'transparent' },
                  ]}
                >
                  <Ionicons name="close" size={20} color={p.secondary} />
                </Pressable>
              </View>
            </View>
          ) : null}

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
                  onPress={() =>
                    void (altAction === 'add' ? addAnother(true) : send(true))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    altAction === 'add'
                      ? 'Add post without alt text'
                      : 'Post without alt text'
                  }
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
                    {altAction === 'add' ? 'Add anyway' : 'Post anyway'}
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

          {publishedDone ? (
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Done after publishing"
              style={({ pressed }) => [
                styles.sheetButton,
                {
                  backgroundColor: p.accent,
                  borderColor: p.accent,
                  marginTop: 10,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: p.onAccent, fontWeight: '700', fontSize: 14 }}>
                Done
              </Text>
            </Pressable>
          ) : null}

          {notice ? (
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
              {notice}
            </Text>
          ) : null}

          <View
            style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.divider }}
          />

          <Pressable
            onPress={() => void addAnother(false)}
            accessibilityRole="button"
            accessibilityLabel={
              editingIndex !== null
                ? 'Add changes to thread'
                : 'Add another post to this thread'
            }
            accessibilityHint="Queues this post; nothing is published until you tap Post all"
            accessibilityState={{ disabled: blocked }}
            disabled={blocked}
            style={({ pressed }) => [
              styles.addThread,
              { backgroundColor: p.accentSoft, opacity: blocked || pressed ? 0.5 : 1 },
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={p.accent}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
              {editingIndex !== null ? 'Add changes to thread' : 'Add another post'}
            </Text>
          </Pressable>

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
                  {postProgress
                    ? `Publishing post ${postProgress.current} of ${postProgress.total}…`
                    : uploadProgress
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
                accessibilityLabel={
                  pending.length || editingIndex !== null
                    ? `Post all ${pending.length + 1} posts as one thread`
                    : 'Post'
                }
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
                    {pending.length || editingIndex !== null ? 'Post all' : 'Post'}
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

      {optionsOpen ? (
        <PostOptionsSheet
          selfLabels={selfLabels}
          languages={languages}
          gates={gates}
          onChangeSelfLabels={setSelfLabels}
          onChangeLanguages={setLanguages}
          onChangeGates={setGates}
          onClose={() => setOptionsOpen(false)}
        />
      ) : null}

      {recoverDraft ? (
        <DraftRecoverySheet
          draft={recoverDraft}
          onRecover={recoverStoredDraft}
          onDiscard={discardStoredDraft}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function DraftRecoverySheet({
  draft,
  onRecover,
  onDiscard,
}: {
  draft: StoredDraft;
  onRecover: () => void;
  onDiscard: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const recoverRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible: true,
    onClose: onDiscard,
    containerRef,
    initialFocusRef: recoverRef,
  });
  const preview = describeDraft(draft);

  return (
    <Modal
      transparent
      visible
      animationType={sheetAnimation(reducedMotion)}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDiscard}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onDiscard}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Restore draft')}
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
            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 18, fontWeight: '700' }}
            >
              Restore your last post?
            </Text>
            <Ionicons name="create-outline" size={20} color={p.accent} />
          </View>
          <Text
            style={{
              color: p.secondary,
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 10,
            }}
          >
            Balla kept an unfinished post on this device. Restoring brings back
            the text, content warnings, languages and interaction settings.
            Photos and quoted posts are not stored; add them again if you need
            them.
          </Text>
          {preview ? (
            <View
              style={[
                styles.draftPreview,
                { backgroundColor: p.bg, borderColor: p.divider },
              ]}
            >
              <Text
                accessibilityLabel={`Saved draft preview: ${preview}`}
                numberOfLines={3}
                style={{ color: p.text, fontSize: 14, lineHeight: 20 }}
              >
                {preview}
              </Text>
            </View>
          ) : null}
          <Pressable
            ref={recoverRef}
            onPress={onRecover}
            accessibilityRole="button"
            accessibilityLabel="Restore this draft"
            style={({ pressed }) => [
              styles.sheetButton,
              {
                backgroundColor: p.accent,
                borderColor: p.accent,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={{ color: p.onAccent, fontWeight: '700', fontSize: 14 }}>
              Restore draft
            </Text>
          </Pressable>
          <Pressable
            onPress={onDiscard}
            accessibilityRole="button"
            accessibilityLabel="Discard saved draft"
            style={({ pressed }) => [
              styles.sheetButton,
              {
                backgroundColor: p.bg,
                borderColor: p.divider,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={{ color: p.text, fontWeight: '600', fontSize: 14 }}>
              Discard and start fresh
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
            backgroundColor: shownAlt ? p.accent : 'rgba(0, 0, 0, 0.76)',
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
  const containerRef = useRef<any>(null);
  const closeButtonRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible: true,
    onClose,
    containerRef,
    initialFocusRef: closeButtonRef,
  });

  return (
    <Modal
      transparent
      visible
      animationType={sheetAnimation(reducedMotion)}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Alt text')}
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
              ref={closeButtonRef}
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

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 4 }}
          >
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GateChoiceRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.optionRow,
        {
          borderBottomColor: p.divider,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? p.accent : p.secondary}
      />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function PostOptionsSheet({
  selfLabels,
  languages,
  gates,
  onChangeSelfLabels,
  onChangeLanguages,
  onChangeGates,
  onClose,
}: {
  selfLabels: string[];
  languages: string[];
  gates: InteractionGates;
  onChangeSelfLabels: (values: string[]) => void;
  onChangeLanguages: (codes: string[]) => void;
  onChangeGates: (gates: InteractionGates) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeButtonRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible: true,
    onClose,
    containerRef,
    initialFocusRef: closeButtonRef,
  });

  function toggleLabel(value: string) {
    onChangeSelfLabels(
      selfLabels.includes(value)
        ? selfLabels.filter((item) => item !== value)
        : [...selfLabels, value]
    );
  }

  function toggleLanguage(code: string) {
    if (languages.includes(code)) {
      onChangeLanguages(languages.filter((item) => item !== code));
    } else if (languages.length < MAX_POST_LANGUAGES) {
      onChangeLanguages([...languages, code]);
    }
  }

  const atLanguageCap = languages.length >= MAX_POST_LANGUAGES;

  return (
    <Modal
      transparent
      visible
      animationType={sheetAnimation(reducedMotion)}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Post options')}
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
              Post options
            </Text>
            <Pressable
              ref={closeButtonRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close post options"
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 15, fontWeight: '700', marginTop: 6 }}
            >
              Content warnings
            </Text>
            <Text
              style={{
                color: p.secondary,
                fontSize: 12,
                lineHeight: 17,
                marginTop: 2,
                marginBottom: 8,
              }}
            >
              Label what your post shows. These warnings publish with the post
              and are visible to everyone who sees it.
            </Text>
            {SELF_LABEL_OPTIONS.map((option) => {
              const selected = selfLabels.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => toggleLabel(option.value)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.detail}
                  {...webCheckedProps(selected)}
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      borderBottomColor: p.divider,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: selected ? p.accent : p.secondary,
                        backgroundColor: selected ? p.accent : 'transparent',
                      },
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={15} color={p.onAccent} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
                        {option.label}
                      </Text>
                      {option.adult ? (
                        <View
                          style={[
                            styles.adultTag,
                            { backgroundColor: p.accentSoft },
                          ]}
                        >
                          <Text style={{ color: p.accent, fontSize: 10, fontWeight: '700' }}>
                            ADULT
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
                      {option.detail}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <View
              style={[
                styles.optionsDivider,
                { backgroundColor: p.divider, marginVertical: 14 },
              ]}
            />

            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 15, fontWeight: '700' }}
            >
              Who can reply
            </Text>
            <Text
              style={{
                color: p.secondary,
                fontSize: 12,
                lineHeight: 17,
                marginTop: 2,
                marginBottom: 8,
              }}
            >
              Written to a Bluesky reply gate after the post is published. Choose Everyone to leave replies open.
            </Text>
            {REPLY_OPTIONS.map((option) => (
              <GateChoiceRow
                key={option.value}
                label={option.label}
                detail={option.detail}
                selected={gates.reply === option.value}
                onPress={() => onChangeGates({ ...gates, reply: option.value })}
              />
            ))}

            <View
              style={[
                styles.optionsDivider,
                { backgroundColor: p.divider, marginVertical: 14 },
              ]}
            />

            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 15, fontWeight: '700' }}
            >
              Quotes
            </Text>
            <Text
              style={{
                color: p.secondary,
                fontSize: 12,
                lineHeight: 17,
                marginTop: 2,
                marginBottom: 8,
              }}
            >
              Disabling quotes writes a Bluesky post gate after publishing. Existing quotes stay where they are.
            </Text>
            {QUOTE_OPTIONS.map((option) => (
              <GateChoiceRow
                key={option.value}
                label={option.label}
                detail={option.detail}
                selected={gates.quote === option.value}
                onPress={() => onChangeGates({ ...gates, quote: option.value })}
              />
            ))}

            <View
              style={[
                styles.optionsDivider,
                { backgroundColor: p.divider, marginVertical: 14 },
              ]}
            />

            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 15, fontWeight: '700' }}
            >
              Post language
            </Text>
            <Text
              style={{
                color: p.secondary,
                fontSize: 12,
                lineHeight: 17,
                marginTop: 2,
                marginBottom: 8,
              }}
            >
              Choose up to {MAX_POST_LANGUAGES} languages used in this post. Leave
              none selected to let Bluesky detect the language.
            </Text>
            <View style={styles.languageGrid}>
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = languages.includes(option.code);
                const disabled = !selected && atLanguageCap;
                return (
                  <Pressable
                    key={option.code}
                    onPress={() => toggleLanguage(option.code)}
                    disabled={disabled}
                    accessibilityRole="checkbox"
                    accessibilityLabel={option.label}
                    {...webCheckedProps(selected)}
                    accessibilityState={{ checked: selected, disabled }}
                    style={({ pressed }) => [
                      styles.languageChip,
                      {
                        borderColor: selected ? p.accent : p.divider,
                        backgroundColor: selected
                          ? p.accent
                          : pressed
                            ? p.soft
                            : p.bg,
                        opacity: disabled ? 0.45 : 1,
                      },
                    ]}
                  >
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={p.onAccent}
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <Text
                      style={{
                        color: selected ? p.onAccent : p.text,
                        fontSize: 13,
                        fontWeight: selected ? '700' : '500',
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done with post options"
            style={({ pressed }) => [
              styles.sheetButton,
              {
                backgroundColor: p.accent,
                borderColor: p.accent,
                marginTop: 12,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>
              Done
            </Text>
          </Pressable>
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    marginTop: 2,
  },
  mediaBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  mediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  optionsButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  optionsDivider: {
    width: StyleSheet.hairlineWidth,
    minHeight: 26,
  },
  optionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adultTag: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 8,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
  },
  quote: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginTop: 10,
  },
  removeLink: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  queued: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 10,
    marginTop: 10,
  },
  queuedButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 4,
  },
  addThread: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 10,
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
  draftPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
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
