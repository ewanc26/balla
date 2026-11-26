import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import { isAuthFailure } from '../lib/failureCopyModel.ts';
import { useViewer } from '../lib/viewer';
import { Avatar } from '../components/Avatar';
import {
  MAX_PROFILE_LINKS,
  MAX_PROFILE_LINK_TITLE,
  normalizeProfileLinkUrl,
  profileLinkHost,
  validateProfileLinkDraft,
  validateProfileLinkTitle,
  type ProfileLinkDraft,
} from '../lib/profileLinks';
import { base64ToBytes } from '../lib/imageBytes';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

const MAX_DISPLAY_NAME = 64;
const MAX_DESCRIPTION = 256;
const MAX_PRONOUNS = 20;
const MAX_PROFILE_IMAGE_BYTES = 1_000_000;
const LINK_COLLECTION = 'app.bsky.actor.link';
const PRONOUN_SUGGESTIONS = ['she/her', 'he/him', 'they/them'];

type LocalImage = {
  uri: string;
  bytes: Uint8Array;
  mime: 'image/jpeg';
};

type InitialProfile = {
  profile: any;
  displayName: string;
  description: string;
  pronouns: string;
  avatar?: string;
  banner?: string;
  links: ProfileLinkDraft[];
};

type LinkWrite = {
  refs: { uri: string; cid: string }[];
  deleteRemoved: () => Promise<void>;
  rollback: () => Promise<void>;
};

let nextLinkKey = 0;
function newLinkKey() {
  nextLinkKey += 1;
  return `new-link-${nextLinkKey}`;
}

function rkeyFromUri(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length ? parts[parts.length - 1] : null;
}

function linksSignature(links: ProfileLinkDraft[]): string {
  return JSON.stringify(
    links.map((link) => [
      normalizeProfileLinkUrl(link.url) || link.url.trim(),
      link.title.trim(),
    ])
  );
}

async function loadOwnProfileLinks(
  did: string,
  profile: any
): Promise<ProfileLinkDraft[]> {
  let refs: any[] = [];
  try {
    const record = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    });
    refs = ((record.data.value as any).links || []) as any[];
  } catch {
    // A profile view still gives us the public links; the raw records only
    // matter when editing (they hold the icon blobs and original labels).
  }

  refs = refs.slice(0, MAX_PROFILE_LINKS);
  const views = new Map<string, any>(
    (profile.links || []).map((view: any) => [view.uri, view])
  );

  if (!refs.length) {
    return (profile.links || []).slice(0, MAX_PROFILE_LINKS).map((view: any) => ({
      key: view.uri,
      url: view.url || '',
      title: view.title || '',
      uri: view.uri,
      cid: view.cid,
    }));
  }

  const drafts: ProfileLinkDraft[] = [];
  for (const ref of refs) {
    const view = views.get(ref.uri);
    const rkey = rkeyFromUri(ref.uri);
    let raw: any;
    if (rkey) {
      try {
        const record = await agent.com.atproto.repo.getRecord({
          repo: did,
          collection: LINK_COLLECTION,
          rkey,
        });
        raw = record.data.value;
      } catch {
        // The profile can point at a record that has since gone; the view is
        // still enough to show and replace it.
      }
    }
    if (!raw && !view) continue;
    drafts.push({
      key: ref.uri,
      url: raw?.url || view?.url || '',
      title: raw?.title || view?.title || '',
      uri: ref.uri,
      cid: ref.cid || view?.cid,
      icon: raw?.icon,
      createdAt: raw?.createdAt,
      raw,
    });
  }
  return drafts;
}

async function writeProfileLinks(
  did: string,
  drafts: ProfileLinkDraft[],
  existing: ProfileLinkDraft[]
): Promise<LinkWrite> {
  const originalByUri = new Map(
    existing.flatMap((link) => (link.uri ? [[link.uri, link] as const] : []))
  );
  const refs: { uri: string; cid: string }[] = [];
  const createdUris: string[] = [];
  const restored: { uri: string; value: any }[] = [];

  try {
    for (const draft of drafts) {
      const url = normalizeProfileLinkUrl(draft.url);
      if (!url) throw new Error('Invalid profile link');
      const title = draft.title.trim() || undefined;
      const original = draft.uri ? originalByUri.get(draft.uri) : undefined;

      if (
        original?.uri &&
        original.cid &&
        normalizeProfileLinkUrl(original.url) === url &&
        (original.title || '').trim() === (title || '')
      ) {
        refs.push({ uri: original.uri, cid: original.cid });
        continue;
      }

      const base = original?.raw || {};
      const record: any = {
        ...base,
        $type: LINK_COLLECTION,
        url,
        createdAt: base.createdAt || new Date().toISOString(),
      };
      if (title) record.title = title;
      else delete record.title;

      if (draft.uri && original?.raw) {
        const rkey = rkeyFromUri(draft.uri);
        if (!rkey) throw new Error('Invalid link record');
        const res = await agent.com.atproto.repo.putRecord({
          repo: did,
          collection: LINK_COLLECTION,
          rkey,
          record,
        });
        restored.push({ uri: draft.uri, value: original.raw });
        refs.push({ uri: res.data.uri, cid: res.data.cid });
      } else {
        const res = await agent.com.atproto.repo.createRecord({
          repo: did,
          collection: LINK_COLLECTION,
          record,
        });
        createdUris.push(res.data.uri);
        refs.push({ uri: res.data.uri, cid: res.data.cid });
      }
    }
  } catch (err) {
    await rollbackLinkWrites(createdUris, restored);
    throw err;
  }

  const kept = new Set(refs.map((ref) => ref.uri));
  const removed = existing.filter(
    (link) => link.uri && !kept.has(link.uri)
  );

  return {
    refs,
    deleteRemoved: async () => {
      await Promise.all(
        removed.map(async (link) => {
          const rkey = link.uri ? rkeyFromUri(link.uri) : null;
          if (!rkey) return;
          try {
            await agent.com.atproto.repo.deleteRecord({
              repo: did,
              collection: LINK_COLLECTION,
              rkey,
            });
          } catch {
            // Unreferenced link records are invisible; cleanup can wait.
          }
        })
      );
    },
    rollback: async () => {
      await rollbackLinkWrites(createdUris, restored);
    },
  };
}

async function rollbackLinkWrites(
  createdUris: string[],
  restored: { uri: string; value: any }[]
) {
  await Promise.all(
    createdUris.map(async (uri) => {
      const rkey = rkeyFromUri(uri);
      if (!rkey) return;
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: agent.did!,
          collection: LINK_COLLECTION,
          rkey,
        });
      } catch {
        // Best effort: the profile does not point at this record.
      }
    })
  );
  await Promise.all(
    restored.map(async (item) => {
      const rkey = rkeyFromUri(item.uri);
      if (!rkey || !item.value) return;
      try {
        await agent.com.atproto.repo.putRecord({
          repo: agent.did!,
          collection: LINK_COLLECTION,
          rkey,
          record: item.value,
        });
      } catch {
        // Best effort: the profile was not updated if we are rolling back.
      }
    })
  );
}

export function EditProfileScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { profile: viewerProfile, refreshProfile, updateProfile } = useViewer();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [initial, setInitial] = useState<InitialProfile | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [links, setLinks] = useState<ProfileLinkDraft[]>([]);
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});

  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();
  const [bannerPreview, setBannerPreview] = useState<string | undefined>();
  const [avatarPicked, setAvatarPicked] = useState<LocalImage | null>(null);
  const [bannerPicked, setBannerPicked] = useState<LocalImage | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [bannerRemoved, setBannerRemoved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState<'avatar' | 'banner' | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Edit profile' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setSaveError(null);

    const did = agent.did;
    if (!did) {
      setLoadError(true);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    agent
      .getProfile({ actor: did })
      .then(async (res) => {
        const profile = res.data;
        const drafts = await loadOwnProfileLinks(did, profile);
        if (!active) return;
        const base: InitialProfile = {
          profile,
          displayName: profile.displayName || '',
          description: profile.description || '',
          pronouns: profile.pronouns || '',
          avatar: profile.avatar || undefined,
          banner: profile.banner || undefined,
          links: drafts,
        };
        setInitial(base);
        setDisplayName(base.displayName);
        setDescription(base.description);
        setPronouns(base.pronouns);
        setLinks(drafts);
        setLinkErrors({});
        setAvatarPreview(base.avatar);
        setBannerPreview(base.banner);
        setAvatarPicked(null);
        setBannerPicked(null);
        setAvatarRemoved(false);
        setBannerRemoved(false);
        setImageError(null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const displayNameCount = countGraphemes(displayName);
  const descriptionCount = countGraphemes(description);
  const pronounsCount = countGraphemes(pronouns);
  const overLimit =
    displayNameCount > MAX_DISPLAY_NAME ||
    descriptionCount > MAX_DESCRIPTION ||
    pronounsCount > MAX_PRONOUNS;

  const avatarDirty =
    avatarPicked !== null ||
    (!!initial && avatarRemoved && !!initial.avatar) ||
    (!!initial && !avatarRemoved && avatarPreview !== initial.avatar);
  const bannerDirty =
    bannerPicked !== null ||
    (!!initial && bannerRemoved && !!initial.banner) ||
    (!!initial && !bannerRemoved && bannerPreview !== initial.banner);
  const linksDirty =
    !!initial && linksSignature(links) !== linksSignature(initial.links);
  const dirty =
    !!initial &&
    (displayName !== initial.displayName ||
      description !== initial.description ||
      pronouns !== initial.pronouns ||
      avatarDirty ||
      bannerDirty ||
      linksDirty);

  async function chooseImage(kind: 'avatar' | 'banner') {
    if (imageBusy || saving) return;
    setImageError(null);
    setImageBusy(kind);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setImageError(
            'Photo access is needed to choose a profile picture or banner. You can allow it in your device settings.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: kind === 'avatar',
        aspect: kind === 'avatar' ? [1, 1] : [3, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      const manipulator = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: kind === 'avatar' ? 400 : 1500 } }],
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!manipulator.base64) {
        setImageError('That image could not be prepared. Try another one.');
        return;
      }
      const bytes = base64ToBytes(manipulator.base64);
      if (bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) {
        setImageError(
          'That image is still over 1 MB after compression. Choose a smaller image.'
        );
        return;
      }

      const image: LocalImage = {
        uri: manipulator.uri,
        bytes,
        mime: 'image/jpeg',
      };
      if (kind === 'avatar') {
        setAvatarPicked(image);
        setAvatarPreview(image.uri);
        setAvatarRemoved(false);
      } else {
        setBannerPicked(image);
        setBannerPreview(image.uri);
        setBannerRemoved(false);
      }
    } catch {
      setImageError(
        'Could not open that image. If the picker did not appear, check photo permissions.'
      );
    } finally {
      setImageBusy(null);
    }
  }

  function removeImage(kind: 'avatar' | 'banner') {
    if (saving) return;
    if (kind === 'avatar') {
      setAvatarPicked(null);
      setAvatarPreview(undefined);
      setAvatarRemoved(true);
    } else {
      setBannerPicked(null);
      setBannerPreview(undefined);
      setBannerRemoved(true);
    }
  }

  function addLink() {
    if (links.length >= MAX_PROFILE_LINKS || saving) return;
    setLinks((prev) => [...prev, { key: newLinkKey(), url: '', title: '' }]);
  }

  function updateLink(key: string, patch: Partial<ProfileLinkDraft>) {
    setLinks((prev) =>
      prev.map((link) => (link.key === key ? { ...link, ...patch } : link))
    );
    setLinkErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function removeLink(key: string) {
    if (saving) return;
    setLinks((prev) => prev.filter((link) => link.key !== key));
    setLinkErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function moveLink(index: number, offset: number) {
    if (saving) return;
    const to = index + offset;
    setLinks((prev) => {
      if (index < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function save() {
    if (!initial || !dirty || saving) return;
    setSaveError(null);

    if (overLimit) {
      setSaveError('Shorten the highlighted profile fields before saving.');
      return;
    }

    const errors: Record<string, string> = {};
    links.forEach((link) => {
      const others = links.filter((item) => item.key !== link.key).map((item) => item.url);
      const error = validateProfileLinkDraft(link, others);
      if (error) errors[link.key] = error;
    });
    if (Object.keys(errors).length) {
      setLinkErrors(errors);
      setSaveError('Fix the highlighted links before saving.');
      return;
    }

    setSaving(true);
    const previousViewerProfile = viewerProfile;
    const finalLinks = links.map((link) => ({
      uri: link.uri,
      cid: link.cid,
      url: normalizeProfileLinkUrl(link.url)!,
      title: link.title.trim() || undefined,
    }));
    const optimistic = {
      ...initial.profile,
      displayName: displayName.trim() || undefined,
      description: description.trim() || undefined,
      pronouns: pronouns.trim() || undefined,
      avatar: avatarPreview,
      banner: bannerPreview,
      links: finalLinks,
    };
    updateProfile(optimistic);

    let linkWrite: LinkWrite | null = null;
    try {
      const [uploadedAvatar, uploadedBanner] = await Promise.all([
        avatarPicked
          ? agent
              .uploadBlob(avatarPicked.bytes, { encoding: avatarPicked.mime })
              .then((res) => res.data.blob)
          : Promise.resolve(undefined),
        bannerPicked
          ? agent
              .uploadBlob(bannerPicked.bytes, { encoding: bannerPicked.mime })
              .then((res) => res.data.blob)
          : Promise.resolve(undefined),
      ]);

      linkWrite = await writeProfileLinks(agent.did!, links, initial.links);

      await agent.upsertProfile((existing) => {
        const next: any = { ...(existing || {}) };
        next.displayName = displayName.trim() || undefined;
        next.description = description.trim() || undefined;
        next.pronouns = pronouns.trim() || undefined;
        next.links = linkWrite!.refs.length ? linkWrite!.refs : undefined;
        if (uploadedAvatar) next.avatar = uploadedAvatar;
        else if (avatarRemoved) next.avatar = undefined;
        if (uploadedBanner) next.banner = uploadedBanner;
        else if (bannerRemoved) next.banner = undefined;
        return next;
      });

      await linkWrite.deleteRemoved();
      updateProfile(optimistic);
      setSaving(false);
      navigation.goBack();
      // The AppView indexes profile writes asynchronously. Keep the optimistic
      // profile on screen, then reconcile once it has had time to catch up.
      setTimeout(() => {
        void refreshProfile();
      }, 1800);
    } catch (err) {
      if (linkWrite) await linkWrite.rollback();
      updateProfile(previousViewerProfile || initial.profile);
      const permissionIssue = isAuthFailure(err);
      setSaveError(
        permissionIssue
          ? 'Your session needs renewing before it can save profile changes. Sign out, sign in again, and retry. Your edits are still here.'
          : 'Could not save your profile. Your previous profile has been restored; your edits are still here.'
      );
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
        <Text style={{ color: p.secondary, fontSize: 14, marginTop: 10 }}>
          Loading your profile…
        </Text>
      </View>
    );
  }

  if (loadError || !initial) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="cloud-offline-outline" size={38} color={p.secondary} />
        <Text style={{ color: p.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>
          Could not load your profile
        </Text>
        <Text style={{ color: p.secondary, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
          Check your connection and try again. Nothing has been changed.
        </Text>
        <Pressable
          onPress={() => setReloadToken((value) => value + 1)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading your profile"
          style={({ pressed }) => ({
            backgroundColor: p.accent,
            borderRadius: CARD_RADIUS,
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 22,
            marginTop: 16,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 8, paddingBottom: 112 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={{ height: 170, backgroundColor: p.accent, overflow: 'hidden' }}>
            {bannerPreview ? (
              <Image
                source={{ uri: bannerPreview }}
                style={{ width: '100%', height: 170 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.22)', fontSize: 96, fontWeight: '800' }}>
                  b
                </Text>
              </View>
            )}
            <View style={styles.bannerActions}>
              <PhotoButton
                icon="image-outline"
                label={imageBusy === 'banner' ? 'Preparing…' : 'Change banner'}
                onPress={() => void chooseImage('banner')}
                disabled={!!imageBusy || saving}
                dark
              />
              {bannerPreview ? (
                <PhotoButton
                  icon="trash-outline"
                  label="Remove banner"
                  onPress={() => removeImage('banner')}
                  disabled={!!imageBusy || saving}
                  dark
                />
              ) : null}
            </View>
          </View>

          <View style={styles.identityRow}>
            <View style={{ borderRadius: 60, borderWidth: 4, borderColor: p.card, marginTop: -46 }}>
              <Avatar
                avatar={avatarPreview}
                displayName={displayName || initial.profile.handle}
                size={92}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 14, marginTop: 10, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
                Profile picture
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                JPEG or PNG, up to 1 MB. Balla crops and compresses before upload.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <PhotoButton
                  icon="camera-outline"
                  label={imageBusy === 'avatar' ? 'Preparing…' : 'Change photo'}
                  onPress={() => void chooseImage('avatar')}
                  disabled={!!imageBusy || saving}
                />
                {avatarPreview ? (
                  <PhotoButton
                    icon="trash-outline"
                    label="Remove"
                    onPress={() => removeImage('avatar')}
                    disabled={!!imageBusy || saving}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {imageError ? <ErrorNote message={imageError} /> : null}

        <View
          style={[
            styles.card,
            styles.formCard,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Field
            label="Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            max={MAX_DISPLAY_NAME}
            count={displayNameCount}
            editable={!saving}
          />

          <Field
            label="Bio"
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people a little about yourself"
            max={MAX_DESCRIPTION}
            count={descriptionCount}
            editable={!saving}
            multiline
          />

          <View>
            <View style={styles.labelRow}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>Pronouns</Text>
              <Text style={{ color: pronounsCount > MAX_PRONOUNS ? p.danger : p.secondary, fontSize: 12 }}>
                {pronounsCount}/{MAX_PRONOUNS}
              </Text>
            </View>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginBottom: 7 }}>
              Optional. These show next to your handle.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {PRONOUN_SUGGESTIONS.map((suggestion) => {
                const selected = pronouns.trim() === suggestion;
                return (
                  <Pressable
                    key={suggestion}
                    onPress={() => {
                      setPronouns(selected ? '' : suggestion);
                    }}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Use ${suggestion} pronouns`}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      borderRadius: 22,
                      paddingHorizontal: 13,
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: selected ? p.accent : p.divider,
                      backgroundColor: selected ? p.accentSoft : p.bg,
                      opacity: pressed || saving ? 0.65 : 1,
                    })}
                  >
                    <Text style={{ color: selected ? p.accent : p.text, fontSize: 13, fontWeight: '600' }}>
                      {suggestion}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={pronouns}
              onChangeText={setPronouns}
              editable={!saving}
              placeholder="e.g. they/them"
              placeholderTextColor={p.secondary}
              accessibilityLabel="Pronouns"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: p.text,
                  backgroundColor: p.bg,
                  borderColor: pronounsCount > MAX_PRONOUNS ? p.danger : p.divider,
                },
                webInputReset,
              ]}
            />
            {pronounsCount > MAX_PRONOUNS ? (
              <Text style={styles.limitError}>
                Pronouns can be up to {MAX_PRONOUNS} characters.
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.card,
            styles.formCard,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={styles.labelRow}>
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Links</Text>
            <Text style={{ color: p.secondary, fontSize: 12 }}>
              {links.length}/{MAX_PROFILE_LINKS}
            </Text>
          </View>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 10 }}>
            Buttons shown under your bio. Only secure https links are accepted. Titles are optional and can be up to{' '}
            {MAX_PROFILE_LINK_TITLE} characters.
          </Text>

          {links.map((link, index) => {
            const error = linkErrors[link.key];
            return (
              <View
                key={link.key}
                style={[styles.linkCard, { backgroundColor: p.bg, borderColor: error ? p.danger : p.divider }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="link-outline" size={16} color={p.accent} />
                  <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '700', flex: 1 }}>
                    Link {index + 1}
                  </Text>
                  <IconButton
                    icon="arrow-up"
                    label={`Move link ${index + 1} earlier`}
                    disabled={index === 0 || saving}
                    onPress={() => moveLink(index, -1)}
                  />
                  <IconButton
                    icon="arrow-down"
                    label={`Move link ${index + 1} later`}
                    disabled={index === links.length - 1 || saving}
                    onPress={() => moveLink(index, 1)}
                  />
                  <IconButton
                    icon="trash-outline"
                    label={`Remove link ${index + 1}`}
                    disabled={saving}
                    danger
                    onPress={() => removeLink(link.key)}
                  />
                </View>
                <TextInput
                  value={link.url}
                  onChangeText={(value) => updateLink(link.key, { url: value })}
                  editable={!saving}
                  placeholder="https://example.com"
                  placeholderTextColor={p.secondary}
                  accessibilityLabel={`Link ${index + 1} URL`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  autoComplete="url"
                  style={[
                    styles.input,
                    {
                      color: p.text,
                      backgroundColor: p.card,
                      borderColor: p.divider,
                      marginTop: 6,
                    },
                    webInputReset,
                  ]}
                />
                <TextInput
                  value={link.title}
                  onChangeText={(value) => updateLink(link.key, { title: value })}
                  editable={!saving}
                  placeholder={profileLinkHost(link.url) || 'Title (optional)'}
                  placeholderTextColor={p.secondary}
                  accessibilityLabel={`Link ${index + 1} title`}
                  style={[
                    styles.input,
                    {
                      color: p.text,
                      backgroundColor: p.card,
                      borderColor: p.divider,
                      marginTop: 6,
                    },
                    webInputReset,
                  ]}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                  <Text style={{ color: error ? p.danger : p.secondary, fontSize: 11, flex: 1 }}>
                    {error || (link.uri ? 'Saved link' : 'New link')}
                  </Text>
                  {countGraphemes(link.title.trim()) > MAX_PROFILE_LINK_TITLE ? (
                    <Text style={{ color: p.danger, fontSize: 11 }}>
                      {countGraphemes(link.title.trim())}/{MAX_PROFILE_LINK_TITLE} title
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}

          {links.length < MAX_PROFILE_LINKS ? (
            <Pressable
              onPress={addLink}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Add a profile link"
              style={({ pressed }) => [
                styles.addLink,
                {
                  borderColor: p.divider,
                  backgroundColor: pressed ? p.bg : 'transparent',
                  opacity: saving ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={18} color={p.accent} />
              <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600', marginLeft: 4 }}>
                Add link
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: p.secondary, fontSize: 12, marginTop: 8 }}>
              You have reached the maximum of {MAX_PROFILE_LINKS} links.
            </Text>
          )}
        </View>

        {saveError ? <ErrorNote message={saveError} /> : null}

        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 8, marginBottom: 8 }}>
          Your name, bio, pronouns, links, photo and banner are public. Changes are saved to your own PDS.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: p.card,
            borderTopColor: p.divider,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>
            {dirty ? 'Unsaved changes' : 'Profile up to date'}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 11, marginTop: 1 }}>
            Saving keeps everything else on your profile record.
          </Text>
        </View>
        <Pressable
          onPress={() => void save()}
          disabled={!dirty || saving}
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          accessibilityState={{ disabled: !dirty || saving, busy: saving }}
          style={({ pressed }) => ({
            backgroundColor: p.accent,
            borderRadius: CARD_RADIUS,
            minHeight: 44,
            minWidth: 132,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !dirty || saving ? 0.5 : pressed ? 0.75 : 1,
          })}
        >
          {saving ? <ActivityIndicator size="small" color={p.onAccent} /> : null}
          <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700', marginLeft: saving ? 7 : 0 }}>
            Save changes
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  max,
  count,
  editable,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  max: number;
  count: number;
  editable: boolean;
  multiline?: boolean;
}) {
  const p = usePalette();
  const over = count > max;
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: over ? p.danger : p.secondary, fontSize: 12 }}>
          {count}/{max}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={p.secondary}
        accessibilityLabel={label}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && { minHeight: 104, paddingTop: 10 },
          {
            color: p.text,
            backgroundColor: p.bg,
            borderColor: over ? p.danger : p.divider,
          },
          webInputReset,
        ]}
      />
      {over ? (
        <Text style={styles.limitError}>
          {label} can be up to {max} characters.
        </Text>
      ) : null}
    </View>
  );
}

function PhotoButton({
  icon,
  label,
  onPress,
  disabled,
  dark,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        borderRadius: CARD_RADIUS,
        borderWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.45)' : p.divider,
        backgroundColor: dark ? 'rgba(0,0,0,0.45)' : p.bg,
        paddingHorizontal: 11,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color={dark ? '#FFFFFF' : p.text} />
      <Text
        style={{
          color: dark ? '#FFFFFF' : p.text,
          fontSize: 12,
          fontWeight: '600',
          marginLeft: 5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? p.danger : p.secondary} />
    </Pressable>
  );
}

function ErrorNote({ message }: { message: string }) {
  const p = usePalette();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(228, 30, 63, 0.08)',
        borderColor: 'rgba(228, 30, 63, 0.28)',
        borderWidth: 1,
        borderRadius: CARD_RADIUS,
        padding: 12,
        marginHorizontal: 8,
        marginBottom: 10,
      }}
    >
      <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
      <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  formCard: {
    padding: 16,
    gap: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexWrap: 'wrap',
  },
  bannerActions: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: '88%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    lineHeight: 20,
  },
  limitError: {
    color: '#E41E3F',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  linkCard: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 10,
    marginBottom: 8,
  },
  addLink: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
