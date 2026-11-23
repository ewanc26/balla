import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { describeFailure } from '../lib/reliability';
import { postFacets } from '../lib/facets';
import { networkBackend } from '../lib/networkBackend';
import {
  measurePostText,
  POST_TEXT_MAX_GRAPHEMES,
} from '../lib/postTextLimit';
import {
  EDIT_DISCLOSURE,
  postEditState,
  type PostEditState,
} from '../lib/postEditModel';
import { savePostEdit } from '../lib/postEdit';
import { notePostEdit } from '../lib/postEditStore';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';
import { touchTargetStyle } from '../lib/accessibilityModel';

/**
 * The whole edit surface. It owns the guards (own post, one edit, five-minute
 * window, seven-day account age), shows the engagement reset before the write,
 * and performs one atomic delete-and-create at the same rkey. Media, quotes and
 * interaction gates are deliberately untouched.
 */
export function EditPostScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const uri = route?.params?.uri;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm' | 'saved'>('edit');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Edit post' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    if (!uri) {
      setLoadError('This edit link is missing a post address.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        if (!agent.did) throw new Error('Sign in to edit a post.');
        const [thread, profile] = await Promise.allSettled([
          networkBackend.thread.getPostThread({ uri, depth: 0 }),
          agent.getProfile({ actor: agent.did }),
        ]);
        if (!active) return;
        if (thread.status !== 'fulfilled') throw thread.reason;
        const node: any = thread.value.data.thread;
        const found = node && node.post;
        if (!found || typeof found.uri !== 'string') {
          throw new Error('This post is no longer available.');
        }
        setPost(found);
        setText(
          typeof found.record?.text === 'string' ? found.record.text : ''
        );
        setAccountCreatedAt(
          profile.status === 'fulfilled'
            ? (profile.value.data as any).createdAt || null
            : null
        );
      } catch (err) {
        if (active) {
          setLoadError(
            describeFailure(err, 'Could not load this post for editing.')
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [uri]);

  const state: PostEditState | null = post
    ? postEditState({
        record: post.record,
        authorDid: post.author?.did,
        viewerDid: agent.did,
        accountCreatedAt,
      })
    : null;
  const measure = measurePostText(text);
  const original = typeof post?.record?.text === 'string' ? post.record.text : '';
  const unchanged = measure.text === original.trim();
  const hasEmbed = !!post?.record?.embed;
  const canSave =
    state?.kind === 'editable' &&
    !measure.over &&
    !unchanged &&
    !saving &&
    (measure.text.length > 0 || hasEmbed);

  async function save() {
    if (!post || !state || state.kind !== 'editable' || saving) return;
    if (measure.over) {
      setSaveError(measure.message);
      return;
    }
    if (!measure.text && !hasEmbed) {
      setSaveError('A post needs text or an embed. Add some text before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const facets = await postFacets(measure.text, agent);
      const next = await savePostEdit(post.uri, post.record, measure.text, facets);
      notePostEdit(post.uri, next);
      setPost({ ...post, record: next });
      setStep('saved');
    } catch (err) {
      setSaveError(
        describeFailure(
          err,
          'Could not save the edit. Your text is still here; try again.'
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: p.bg }]}>
        <ActivityIndicator size="large" color={p.accent} />
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
          Loading the post…
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={styles.page}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.danger },
            cardShadow,
          ]}
        >
          <Ionicons name="alert-circle-outline" size={22} color={p.danger} />
          <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
            This post cannot be edited
          </Text>
          <Text style={[styles.body, { color: p.secondary }]}>{loadError}</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to the post"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: p.divider,
                opacity: pressed ? 0.65 : 1,
                marginTop: 10,
              },
            ]}
          >
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
              Back
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (step === 'saved') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={styles.page}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={26} color={p.green} />
          <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
            Edit saved
          </Text>
          <Text style={[styles.body, { color: p.text }]}>
            This post keeps its address. Likes, reposts and replies now start
            again at zero, and the Edited badge shows both versions.
          </Text>
          <Text style={[styles.body, { color: p.secondary }]}>
            The AppView may take a moment to show the new text elsewhere. The
            edit used one atomic delete-and-create at the same rkey; nothing
            else on the post changed.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Done editing"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: p.onAccent, fontSize: 14, fontWeight: '700' }}>
              Done
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (state && state.kind === 'blocked') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={styles.page}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Ionicons name="lock-closed-outline" size={24} color={p.secondary} />
          <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
            Editing is not available for this post
          </Text>
          <Text style={[styles.body, { color: p.secondary }]}>
            {state.message}
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to the post"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: p.divider,
                opacity: pressed ? 0.65 : 1,
                marginTop: 10,
              },
            ]}
          >
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
              Back
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={styles.page}
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
          <Ionicons name="create-outline" size={20} color={p.accent} />
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: p.text, marginLeft: 8 }]}
          >
            {step === 'confirm' ? 'Review this edit' : 'Change the post text'}
          </Text>
        </View>
        <Text style={[styles.body, { color: p.secondary }]}>
          You can change the text once, within five minutes of posting.
          Everything else about the post stays as it was: replies, quotes,
          media, languages and interaction settings.
        </Text>

        {step === 'edit' ? (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              placeholder="What's on your mind?"
              placeholderTextColor={p.secondary}
              accessibilityLabel="Post text to edit"
              style={[
                styles.input,
                webInputReset,
                {
                  color: p.text,
                  backgroundColor: p.bg,
                  borderColor: measure.over ? p.danger : p.divider,
                },
              ]}
            />
            <View style={styles.counterRow}>
              <Text
                style={{
                  color: measure.over ? p.danger : p.secondary,
                  fontSize: 12,
                }}
              >
                {measure.graphemes}/{POST_TEXT_MAX_GRAPHEMES} ·{' '}
                {measure.bytes}/3,000 bytes
              </Text>
              {unchanged ? (
                <Text style={{ color: p.secondary, fontSize: 12 }}>
                  Change something to enable the edit.
                </Text>
              ) : null}
            </View>
            {measure.message ? (
              <Text
                accessibilityRole="alert"
                style={{ color: p.danger, fontSize: 12, lineHeight: 18, marginTop: 4 }}
              >
                {measure.message}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSaveError(null);
                  setStep('confirm');
                }}
                disabled={!canSave && !saving}
                accessibilityRole="button"
                accessibilityLabel="Review the edit before saving"
                accessibilityState={{ disabled: !canSave && !saving }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: p.accent,
                    opacity: pressed || (!canSave && !saving) ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={{ color: p.onAccent, fontSize: 14, fontWeight: '700' }}>
                  Review edit
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.version, { borderColor: p.divider, backgroundColor: p.bg }]}>
              <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '700' }}>
                ORIGINAL
              </Text>
              <Text
                selectable
                style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 5 }}
              >
                {original || 'No text in this version.'}
              </Text>
            </View>
            <View style={[styles.version, { borderColor: p.divider, backgroundColor: p.bg }]}>
              <Text style={{ color: p.accent, fontSize: 12, fontWeight: '700' }}>
                EDITED
              </Text>
              <Text
                selectable
                style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: 5 }}
              >
                {measure.text || 'No text in this version.'}
              </Text>
            </View>

            <View
              style={[
                styles.disclosure,
                { borderColor: p.danger, backgroundColor: p.bg },
              ]}
            >
              <Ionicons name="information-circle-outline" size={18} color={p.danger} />
              <Text
                style={{
                  color: p.text,
                  fontSize: 12,
                  lineHeight: 18,
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                {EDIT_DISCLOSURE}
              </Text>
            </View>

            {saveError ? (
              <Text
                accessibilityRole="alert"
                style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginTop: 8 }}
              >
                {saveError}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => setStep('edit')}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Keep editing"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: p.divider, opacity: pressed || saving ? 0.65 : 1 },
                ]}
              >
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
                  Keep editing
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void save()}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Save this edit"
                accessibilityState={{ disabled: saving, busy: saving }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: p.accent,
                    opacity: pressed || saving ? 0.65 : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={p.onAccent} />
                ) : (
                  <Text style={{ color: p.onAccent, fontSize: 14, fontWeight: '700' }}>
                    Save edit
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 8,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  input: {
    minHeight: 170,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 12,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 12,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  primaryButton: {
    ...touchTargetStyle,
    paddingHorizontal: 16,
    borderRadius: CARD_RADIUS,
  },
  secondaryButton: {
    ...touchTargetStyle,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
  },
  version: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginTop: 10,
  },
  disclosure: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
});
