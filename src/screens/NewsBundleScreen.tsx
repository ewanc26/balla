import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { listActionError } from '../lib/listModel';
import { deleteList, loadLists } from '../lib/lists';
import {
  NEWS_NO_RANKING,
  NEWS_TRANSPARENCY,
  bundleDescription,
  bundleName,
  findNewsTopic,
  loadNewsCuration,
  newsRegionLabel,
  publishersForBundle,
  validateNewsBundleSelection,
} from '../lib/newsBundles';
import { createNewsBundle } from '../lib/newsBundleWrite';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * The roster preview for one topic and region. Nothing is written until the
 * visible Create bundle button is pressed, and the only write is one curation
 * list plus its list items.
 */
export function NewsBundleScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const topicId = route?.params?.topic;
  const regionId = route?.params?.region;
  const selectionError = validateNewsBundleSelection(topicId, regionId);
  const state = useMemo(() => loadNewsCuration(), []);
  const topic = state.ok ? findNewsTopic(state.curation, topicId) : undefined;
  const publishers = useMemo(
    () =>
      state.ok && topic
        ? publishersForBundle(state.curation, topic.id, regionId)
        : [],
    [state, topic, regionId]
  );
  const name = topic ? bundleName(topic.name, regionId) : 'News bundle';
  const regionLabel = newsRegionLabel(regionId);

  const [ownLists, setOwnLists] = useState<any[]>([]);
  const [listsStatus, setListsStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUri, setCreatedUri] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const existing = useMemo(
    () =>
      ownLists.find(
        (list) =>
          list?.name === name && list?.creator?.did === agent.did
      ) || null,
    [ownLists, name]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: topic ? `${topic.name} bundle` : 'News bundle',
    });
  }, [navigation, topic]);

  const loadOwned = useCallback(async () => {
    setListsStatus('loading');
    setListError(null);
    if (!agent.did) {
      setListsStatus('error');
      setListError('Sign in before adding a news bundle.');
      return;
    }
    try {
      const lists = await readWithRetry(() => loadLists(agent.did as string));
      setOwnLists(lists || []);
      setListsStatus('ready');
    } catch (cause) {
      setListsStatus('error');
      setListError(
        describeFailure(
          cause,
          'Could not check your lists. Balla checks first so it never adds a second copy of the same bundle.'
        )
      );
    }
  }, []);

  useEffect(() => {
    void loadOwned();
  }, [loadOwned]);

  const canCreate =
    !!topic &&
    publishers.length > 0 &&
    listsStatus === 'ready' &&
    !existing &&
    !saving &&
    !removing &&
    !createdUri &&
    !removed;

  async function create() {
    if (!topic || !canCreate) return;
    setSaving(true);
    setError(null);
    try {
      const uri = await createNewsBundle(
        name,
        bundleDescription(topic),
        publishers
      );
      setCreatedUri(uri);
    } catch (cause) {
      setError(
        listActionError(
          cause,
          'Could not add this bundle. Check your connection and try again.'
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing || removing) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteList(existing.uri);
      setOwnLists((prev) => prev.filter((list) => list.uri !== existing.uri));
      setConfirmRemove(false);
      setRemoved(true);
    } catch (cause) {
      setError(
        listActionError(
          cause,
          'Could not remove this bundle. Check your connection and try again.'
        )
      );
    } finally {
      setRemoving(false);
    }
  }

  if (selectionError) {
    return (
      <EmptyState
        title="Bundle not found"
        body={selectionError}
        actionLabel="Back to news bundles"
        onAction={() => navigation.goBack()}
      />
    );
  }

  if (!state.ok || !topic) {
    return (
      <EmptyState
        title="News bundles are unavailable"
        body={
          state.ok
            ? 'This bundle is not part of the published news pack. Nothing has been added.'
            : state.error
        }
        actionLabel="Back"
        onAction={() => navigation.goBack()}
      />
    );
  }

  const created = !!createdUri;
  const removedNow = removed;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 36 }}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
            {topic.name}
          </Text>
          <Text
            style={{
              color: p.accent,
              fontSize: 11,
              fontWeight: '700',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.accent,
              borderRadius: CARD_RADIUS,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            {regionLabel.toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
          {topic.summary}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          The bundle becomes one curation list named “{name}”. Its feed shows the
          publishers’ posts newest-first.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={styles.rosterHeader}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
            Publisher accounts
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '600' }}>
            {publishers.length}
          </Text>
        </View>

        {publishers.length === 0 ? (
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            No publisher accounts are listed for this topic and region yet. The
            news pack is maintained in the Balla repository; nothing has been
            added to your account.
          </Text>
        ) : (
          <>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
              These are the exact accounts that will be put on the list. Nothing
              is followed or subscribed by creating it.
            </Text>
            {publishers.map((publisher, index) => (
              <View
                key={publisher.did}
                style={[
                  styles.publisherRow,
                  {
                    borderTopColor: p.divider,
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
                    {publisher.name}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
                    @{publisher.handle}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
          What this writes
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
          {NEWS_TRANSPARENCY}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
          The list is a public AT Protocol record. Its name and every member are
          visible to anyone who can see your profile, and you can edit or delete
          it from Lists at any time.
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
          {NEWS_NO_RANKING}
        </Text>
      </View>

      {error ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.bg, borderColor: p.danger },
          ]}
        >
          <View style={styles.inline}>
            <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
            <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>
              {error}
            </Text>
          </View>
        </View>
      ) : null}

      {listsStatus === 'error' ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
            Your lists could not be checked
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            {listError} Nothing has been added.
          </Text>
          <Pressable
            onPress={() => void loadOwned()}
            accessibilityRole="button"
            accessibilityLabel="Check my lists again"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: p.divider,
                backgroundColor: pressed ? p.bg : p.card,
              },
            ]}
          >
            <Text style={{ color: p.accent, fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {created ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            Bundle added
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            “{name}” is now one of your lists. Open it to read the newest posts,
            pin it to Home or remove it.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() =>
                createdUri &&
                navigation.navigate('ListDetail', { uri: createdUri })
              }
              accessibilityRole="button"
              accessibilityLabel="Open the new list"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                Open list
              </Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Done adding this bundle"
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: p.divider,
                  backgroundColor: pressed ? p.bg : p.card,
                },
              ]}
            >
              <Text style={{ color: p.text, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {removedNow ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            Bundle removed
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            The list and its membership records are gone. The publisher accounts
            themselves are unchanged.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to news bundles"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: p.divider,
                backgroundColor: pressed ? p.bg : p.card,
              },
            ]}
          >
            <Text style={{ color: p.text, fontWeight: '700' }}>Back</Text>
          </Pressable>
        </View>
      ) : null}

      {existing && !created && !removedNow ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            Already in your lists
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            This bundle already exists as “{name}”. Balla will not add a second
            copy. Renaming that list makes it stop matching this bundle; the list
            itself is unchanged.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() =>
                navigation.navigate('ListDetail', { uri: existing.uri })
              }
              accessibilityRole="button"
              accessibilityLabel="Open the existing bundle list"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                Open list
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmRemove(true)}
              disabled={removing}
              accessibilityRole="button"
              accessibilityLabel="Remove this bundle"
              accessibilityState={{ disabled: removing }}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: p.danger,
                  backgroundColor: pressed ? p.bg : p.card,
                  opacity: removing ? 0.5 : 1,
                },
              ]}
            >
              <Text style={{ color: p.danger, fontWeight: '700' }}>
                Remove bundle
              </Text>
            </Pressable>
          </View>

          {confirmRemove ? (
            <View
              style={[
                styles.confirmBox,
                { backgroundColor: p.bg, borderColor: p.danger },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
                Remove “{name}”?
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                Balla deletes the list and its membership records from your PDS.
                This cannot be undone, and the publisher accounts are not
                unfollowed or changed.
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => setConfirmRemove(false)}
                  disabled={removing}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel removing the bundle"
                  accessibilityState={{ disabled: removing }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      borderColor: p.divider,
                      backgroundColor: pressed ? p.bg : p.card,
                    },
                  ]}
                >
                  <Text style={{ color: p.text, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void remove()}
                  disabled={removing}
                  accessibilityRole="button"
                  accessibilityLabel="Delete the bundle list"
                  accessibilityState={{ disabled: removing, busy: removing }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: p.danger,
                      opacity: pressed || removing ? 0.7 : 1,
                    },
                  ]}
                >
                  {removing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                      Remove list
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {!existing && !created && !removedNow && publishers.length > 0 ? (
        <View style={{ marginHorizontal: 8 }}>
          <Pressable
            onPress={() => void create()}
            disabled={!canCreate}
            accessibilityRole="button"
            accessibilityLabel={`Create the ${topic.name} bundle for ${regionLabel}`}
            accessibilityState={{ disabled: !canCreate, busy: saving }}
            style={({ pressed }) => [
              styles.createButton,
              {
                backgroundColor: p.accent,
                opacity: !canCreate ? 0.45 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={p.onAccent} />
            ) : (
              <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>
                Create bundle
              </Text>
            )}
          </Pressable>
          {listsStatus === 'loading' ? (
            <Text
              style={{
                color: p.secondary,
                fontSize: 11,
                lineHeight: 16,
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              Checking your lists first, so no second copy is created.
            </Text>
          ) : null}
          {listsStatus === 'error' ? (
            <Text
              style={{
                color: p.secondary,
                fontSize: 11,
                lineHeight: 16,
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              Creation stays off until Balla can check your lists.
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          {title}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
          {body}
        </Text>
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: p.divider,
              backgroundColor: pressed ? p.bg : p.card,
              marginTop: 14,
            },
          ]}
        >
          <Text style={{ color: p.accent, fontWeight: '700' }}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginBottom: 10,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  publisherRow: {
    minHeight: 48,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
