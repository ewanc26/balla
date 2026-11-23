import React, { useLayoutEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { networkBackend } from '../lib/networkBackend';
import { postFacets } from '../lib/facets';
import {
  measurePostText,
  POST_TEXT_MAX_GRAPHEMES,
} from '../lib/postTextLimit';
import { applyMention, type MentionActor } from '../lib/mentionSuggestions';
import { useMentionSuggestions } from '../lib/useMentionSuggestions';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { MentionSuggestions } from '../components/MentionSuggestions';
import { useViewer } from '../lib/viewer';
import { replyIndent } from '../lib/layout';
import { useViewPreferences } from '../lib/viewPreferences';
import { sortReplies, type ThreadSort } from '../lib/viewPreferencesModel';
import { isThreadRootAuthor, loadHiddenReplyUris } from '../lib/hiddenReplies';
import {
  buildWallToWall,
  wallToWallName,
} from '../lib/wallToWallModel';
import { ThreadMenuSheet } from '../components/ThreadMenuSheet';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

// Navigation over the threadViewPost tree: the ancestor chain, the highlighted
// post, then every reply branch. getPostThread returns replies as a tree, so
// render it recursively and cap the visual indentation rather than dropping
// deeper replies on the floor.

function isThreadViewPost(node: any): boolean {
  return !!node && String(node.$type || '').endsWith('threadViewPost');
}

function flattenThread(node: any): { ancestors: any[]; post: any; replies: any[] } {
  const ancestors: any[] = [];
  let current = node;
  while (current && current.parent) {
    ancestors.unshift(current.parent);
    current = current.parent;
  }
  const replies = (node.replies || []).filter(isThreadViewPost);
  return { ancestors, post: node.post, replies };
}

function countReplies(nodes: any[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countReplies((node.replies || []).filter(isThreadViewPost)),
    0
  );
}

/**
 * Split a reply tree using the root post's threadgate `hiddenReplies` list.
 * Hidden replies (and their branches) leave the normal thread and are shown in
 * one expandable section, matching the official client. The gate is the source
 * of truth; nothing is hidden from a local-only list.
 */
function partitionHiddenReplies(
  nodes: any[],
  hidden: Set<string>
): { visible: any[]; hidden: any[] } {
  const visible: any[] = [];
  const hiddenNodes: any[] = [];
  for (const node of nodes) {
    const children = partitionHiddenReplies(
      (node.replies || []).filter(isThreadViewPost),
      hidden
    );
    const pruned = { ...node, replies: children.visible };
    if (hidden.has(node.post && node.post.uri)) hiddenNodes.push(pruned);
    else visible.push(pruned);
    hiddenNodes.push(...children.hidden);
  }
  return { visible, hidden: hiddenNodes };
}

function removePost(
  nodes: any[],
  post: any,
  scope: 'post' | 'author'
): any[] {
  return nodes
    .filter((node) =>
      scope === 'author'
        ? node.post.author.did !== post.author.did
        : node.post.uri !== post.uri
    )
    .map((node) => ({
      ...node,
      replies: removePost(
        (node.replies || []).filter(isThreadViewPost),
        post,
        scope
      ),
    }));
}

/**
 * A short, visible cue for where a post sits in the conversation. It is a real
 * text node with its own label so a screen reader hears the role before the
 * card, while the card's own action buttons stay individually focusable.
 */
function ThreadRoleLabel({
  text,
  accessibilityLabel,
  focus,
}: {
  text: string;
  accessibilityLabel?: string;
  focus?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={styles.roleRow}>
      <View
        style={[
          styles.roleDot,
          { backgroundColor: focus ? p.accent : p.divider },
        ]}
      />
      <Text
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel || text}
        style={[styles.roleText, { color: focus ? p.accent : p.secondary }]}
      >
        {text}
      </Text>
    </View>
  );
}

function ReplyBranch({
  node,
  depth,
  onOpenThread,
  onOpenProfile,
  onPostHidden,
  onHiddenReplyChange,
  sort,
}: {
  node: any;
  depth: number;
  onOpenThread?: (uri: string) => void;
  onOpenProfile: (did: string) => void;
  onPostHidden?: (post: any, scope: 'post' | 'author') => void;
  onHiddenReplyChange?: (post: any, hidden: boolean) => void;
  sort: ThreadSort;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const indent = replyIndent(width);
  const replies = sortReplies(
    (node.replies || []).filter(isThreadViewPost),
    sort
  );
  // Every reply carries a connector, including top-level ones, so the chain
  // back to the focused post is visible rather than a stack of loose cards.
  const indented = depth <= indent.maxDepth;
  return (
    <View
      style={
        indented
          ? {
              marginLeft: indent.marginLeft,
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: p.divider,
              paddingLeft: indent.paddingLeft,
            }
          : { marginLeft: indent.marginLeft, paddingLeft: indent.paddingLeft }
      }
    >
      <ThreadRoleLabel
        text="Reply"
        accessibilityLabel={
          depth > 0
            ? `Reply, nested ${depth} level${depth === 1 ? '' : 's'} deep in this thread`
            : 'Reply in this thread'
        }
      />
      <PostCard
        post={node.post}
        showReplyContext={false}
        onOpenThread={onOpenThread}
        onOpenProfile={onOpenProfile}
        onPostHidden={onPostHidden}
        onHiddenReplyChange={onHiddenReplyChange}
      />
      {replies.map((child: any) => (
        <ReplyBranch
          key={child.post.uri}
          node={child}
          depth={depth + 1}
          onOpenThread={onOpenThread}
          onOpenProfile={onOpenProfile}
          onPostHidden={onPostHidden}
          onHiddenReplyChange={onHiddenReplyChange}
          sort={sort}
        />
      ))}
    </View>
  );
}

export function ThreadScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { profile: me } = useViewer();
  const { threadSort } = useViewPreferences();
  const uri = route.params && route.params.uri;
  const [thread, setThread] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySelection, setReplySelection] = useState({ start: 0, end: 0 });
  const [hiddenUris, setHiddenUris] = useState<string[]>([]);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lensDid, setLensDid] = useState<string | null>(null);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const replyInput = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const scrollRef = React.useRef<any>(null);
  const {
    activeMention: replyActiveMention,
    query: replyMentionQuery,
    status: replyMentionStatus,
    results: replyMentionResults,
  } = useMentionSuggestions(replyText, replySelection, !sending);
  const replyLimit = measurePostText(replyText);
  const canSendReply = replyLimit.text.length > 0 && !replyLimit.over;

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function onHiddenReplyChange(_post: any, _hidden: boolean) {
    // The threadgate is the source of truth. Refetch both the tree and its
    // hidden-reply list so the expander, counts and menu labels stay in sync.
    void load();
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    if (
      thread &&
      (scope === 'author'
        ? thread.post.author.did === post.author.did
        : thread.post.uri === post.uri)
    ) {
      navigation.goBack();
      return;
    }
    setThread((prev: any) =>
      prev
        ? {
            ...prev,
            ancestors: removePost(prev.ancestors, post, scope),
            replies: removePost(prev.replies, post, scope),
          }
        : prev
    );
  }

  async function load() {
    setFailed(false);
    setFailureMessage(null);
    try {
      const res = await readWithRetry(() =>
        networkBackend.thread.getPostThread({ uri, depth: 10 })
      );
      const t = res.data.thread;
      if (isThreadViewPost(t)) {
        const flat = flattenThread(t);
        setThread(flat);
        if (isThreadRootAuthor(flat.post)) {
          loadHiddenReplyUris(flat.post)
            .then(setHiddenUris)
            .catch(() => setHiddenUris([]));
        } else {
          setHiddenUris([]);
        }
      } else {
        setFailed(true);
        setFailureMessage('This post is no longer available.');
      }
    } catch (err) {
      setFailed(true);
      setFailureMessage(describeFailure(err, 'Could not load this post.'));
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  React.useEffect(() => {
    return subscribeActorHidden((did) => {
      setThread((prev: any) =>
        prev
          ? {
              ...prev,
              ancestors: removePost(
                prev.ancestors,
                { author: { did } },
                'author'
              ),
              replies: removePost(prev.replies, { author: { did } }, 'author'),
            }
          : prev
      );
    });
  }, []);

  // A pure lens over the visible thread. The hidden-reply gate is already
  // applied before the model sees the tree, so wall-to-wall cannot reveal a
  // reply the full thread keeps hidden.
  const wallToWall = React.useMemo(() => {
    if (!thread) return null;
    const partitioned = partitionHiddenReplies(
      thread.replies,
      new Set(hiddenUris)
    );
    return buildWallToWall(
      {
        ancestors: thread.ancestors,
        post: thread.post,
        replies: partitioned.visible,
      },
      { viewerDid: me?.did, sort: threadSort }
    );
  }, [hiddenUris, me?.did, thread, threadSort]);

  const activeLens = lensDid
    ? wallToWall?.partners.find((partner) => partner.did === lensDid) || null
    : null;
  const lensName = activeLens ? wallToWallName(activeLens) : '';
  const lensAnnouncement = activeLens
    ? `Showing only you and ${lensName}`
    : '';
  const partnerCount = wallToWall?.partners.length || 0;

  React.useEffect(() => {
    if (lensDid && wallToWall && !activeLens) setLensDid(null);
  }, [activeLens, lensDid, wallToWall]);

  React.useEffect(() => {
    if (!partnerCount) setThreadMenuOpen(false);
  }, [partnerCount]);

  React.useEffect(() => {
    if (!activeLens || Platform.OS === 'web') return;
    AccessibilityInfo.announceForAccessibility(lensAnnouncement);
  }, [activeLens, lensAnnouncement]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Thread',
      headerRight: partnerCount
        ? () => (
            <Pressable
              onPress={() => setThreadMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Thread menu"
              accessibilityHint="Open the wall-to-wall view"
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={p.text}
              />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, partnerCount, p.text]);

  function openWallToWall(did: string) {
    setLensDid(did);
    setThreadMenuOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function viewFullThread() {
    setLensDid(null);
    setThreadMenuOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function chooseReplyMention(actor: MentionActor) {
    if (!replyActiveMention || !actor.handle) return;
    const next = applyMention(replyText, replyActiveMention, actor.handle);
    setReplyText(next.text);
    setReplySelection({ start: next.cursor, end: next.cursor });
    replyInput.current?.focus();
  }

  async function sendReply() {
    if (sending || !canSendReply) return;
    setSending(true);
    setReplyError(null);
    try {
      const post = thread.post;
      // A reply addresses the post itself; if the post is itself a reply,
      // the root travels up so the whole conversation stays one tree.
      const record = post.record || {};
      let root = { uri: post.uri, cid: post.cid };
      if (record.reply && record.reply.root) {
        root = record.reply.root;
      }
      const text = replyLimit.text;
      const facets = await postFacets(text, agent);
      await agent.post({
        text,
        ...(facets ? { facets } : {}),
        reply: {
          root,
          parent: { uri: post.uri, cid: post.cid },
        },
      });
      setReplyText('');
      setReplySelection({ start: 0, end: 0 });
      await load();
    } catch (err) {
      // Keep the text: a failed send should never eat the reply.
      setReplyError(describeFailure(err, 'Could not publish this reply. Your text is still here; tap Reply to retry.'));
    }
    setSending(false);
  }

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: p.secondary, textAlign: 'center' }}>
          {failureMessage || 'Could not load this post.'}
        </Text>
        <Pressable
          onPress={load}
          accessibilityRole="button"
          accessibilityLabel="Retry loading the post"
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 120,
            paddingHorizontal: 18,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: p.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (!thread) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  const hiddenSet = new Set(hiddenUris);
  const partitioned = partitionHiddenReplies(thread.replies, hiddenSet);
  const replyCount = countReplies(partitioned.visible);
  const hiddenCount = countReplies(partitioned.hidden);
  const canManageHidden = isThreadRootAuthor(thread.post);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      >
        {activeLens ? (
          <>
            <View
              style={[
                styles.lensHeader,
                { backgroundColor: p.card, borderColor: p.divider },
              ]}
            >
              <View
                accessibilityRole="header"
                accessibilityLabel={lensAnnouncement}
                accessibilityLiveRegion={
                  Platform.OS === 'web' ? 'polite' : undefined
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={18} color={p.accent} />
                  <Text
                    style={{
                      color: p.text,
                      fontSize: 16,
                      fontWeight: '700',
                      marginLeft: 8,
                    }}
                  >
                    Wall-to-wall
                  </Text>
                </View>
                <Text
                  style={{
                    color: p.text,
                    fontSize: 14,
                    fontWeight: '600',
                    marginTop: 6,
                  }}
                >
                  {lensAnnouncement}
                </Text>
                <Text
                  style={{
                    color: p.secondary,
                    fontSize: 12,
                    lineHeight: 17,
                    marginTop: 3,
                  }}
                >
                  Third-party replies are left out by author, not by ranking.
                  Your replies here are still public.
                </Text>
              </View>
              <Pressable
                onPress={viewFullThread}
                accessibilityRole="button"
                accessibilityLabel="View full thread"
                accessibilityHint="Leaves wall-to-wall and shows everyone"
                style={({ pressed }) => [
                  styles.viewFullButton,
                  {
                    borderColor: p.divider,
                    backgroundColor: pressed ? p.bg : 'transparent',
                  },
                ]}
              >
                <Ionicons name="arrow-back-outline" size={17} color={p.accent} />
                <Text
                  style={{
                    color: p.accent,
                    fontSize: 13,
                    fontWeight: '700',
                    marginLeft: 7,
                  }}
                >
                  View full thread
                </Text>
              </Pressable>
            </View>

            {activeLens.items.length === 0 ? (
              <View
                style={[
                  styles.lensEmpty,
                  { backgroundColor: p.card, borderColor: p.divider },
                ]}
              >
                <Ionicons name="people-outline" size={22} color={p.secondary} />
                <Text
                  style={{
                    color: p.text,
                    fontSize: 14,
                    fontWeight: '600',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  No two-person exchange in this thread yet.
                </Text>
                <Text
                  style={{
                    color: p.secondary,
                    fontSize: 12,
                    lineHeight: 17,
                    marginTop: 3,
                    textAlign: 'center',
                  }}
                >
                  View the full thread to see everyone.
                </Text>
              </View>
            ) : (
              activeLens.items.map((item) => (
                <View key={item.uri}>
                  <ThreadRoleLabel
                    text={
                      item.role === 'focus'
                        ? 'This post'
                        : item.role === 'ancestor'
                          ? 'Earlier in thread'
                          : 'Reply'
                    }
                    focus={item.role === 'focus'}
                    accessibilityLabel={
                      item.role === 'focus'
                        ? 'The post you opened'
                        : item.role === 'ancestor'
                          ? 'Earlier post in this two-person view'
                          : 'Reply in this two-person view'
                    }
                  />
                  <PostCard
                    post={item.post}
                    showReplyContext={false}
                    highlight={item.role === 'focus'}
                    onOpenThread={
                      item.role === 'focus'
                        ? () => replyInput.current?.focus()
                        : item.role === 'reply'
                          ? () => navigation.push('Thread', { uri: item.uri })
                          : undefined
                    }
                    onOpenProfile={openProfile}
                    onPostHidden={hidePost}
                    onHiddenReplyChange={
                      item.role === 'reply' ? onHiddenReplyChange : undefined
                    }
                  />
                </View>
              ))
            )}
          </>
        ) : (
        <>
        <View
          accessibilityRole="header"
          accessibilityLabel="Thread: a conversation in order, oldest first"
          style={styles.threadHeading}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={p.accent} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
              Thread
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
              A conversation in order, oldest first
            </Text>
          </View>
        </View>

        {thread.ancestors.map((a: any, index: number) => (
          <View key={a.post.uri}>
            <ThreadRoleLabel
              text={index === thread.ancestors.length - 1 ? 'Replying to' : 'Earlier in thread'}
              accessibilityLabel={
                index === thread.ancestors.length - 1
                  ? 'This post is a reply to the one above'
                  : 'Earlier post in this thread'
              }
            />
            <PostCard
              post={a.post}
              showReplyContext={false}
              onOpenProfile={openProfile}
              onPostHidden={hidePost}
            />
          </View>
        ))}
        <ThreadRoleLabel text="This post" focus accessibilityLabel="The post you opened" />
        <PostCard
          post={thread.post}
          showReplyContext={false}
          highlight
          onOpenThread={() => replyInput.current?.focus()}
          onOpenProfile={openProfile}
          onPostHidden={hidePost}
        />
        {replyCount > 0 && (
          <Text
            accessibilityRole="header"
            style={{
              color: p.secondary,
              fontSize: 13,
              fontWeight: '600',
              marginTop: 4,
              marginBottom: 8,
              paddingHorizontal: 16,
            }}
          >
            {replyCount === 1 ? '1 reply' : replyCount + ' replies'}
          </Text>
        )}
        {sortReplies(partitioned.visible, threadSort).map((r: any) => (
          <ReplyBranch
            key={r.post.uri}
            node={r}
            depth={0}
            onOpenThread={(replyUri: string) => navigation.push('Thread', { uri: replyUri })}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
            onHiddenReplyChange={onHiddenReplyChange}
            sort={threadSort}
          />
        ))}
        {hiddenCount > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Pressable
              onPress={() => setHiddenOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                hiddenOpen ? 'Hide the hidden replies section' : 'Show hidden replies'
              }
              accessibilityState={{ expanded: hiddenOpen }}
              style={({ pressed }) => [
                styles.hiddenToggle,
                { borderColor: p.divider, backgroundColor: p.card, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="eye-off-outline" size={18} color={p.secondary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
                  {hiddenCount === 1 ? '1 hidden reply' : `${hiddenCount} hidden replies`}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
                  {canManageHidden
                    ? 'You hid these from everyone in this thread.'
                    : 'Hidden by the author of this thread.'}
                </Text>
              </View>
              <Ionicons
                name={hiddenOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={p.secondary}
              />
            </Pressable>
            {hiddenOpen
              ? sortReplies(partitioned.hidden, threadSort).map((r: any) => (
                  <ReplyBranch
                    key={r.post.uri}
                    node={r}
                    depth={0}
                    onOpenThread={(replyUri: string) =>
                      navigation.push('Thread', { uri: replyUri })
                    }
                    onOpenProfile={openProfile}
                    onPostHidden={hidePost}
                    onHiddenReplyChange={onHiddenReplyChange}
                    sort={threadSort}
                  />
                ))
              : null}
          </View>
        ) : null}
        </>
        )}
      </ScrollView>

      <ThreadMenuSheet
        visible={threadMenuOpen}
        partners={wallToWall?.partners || []}
        activeDid={activeLens?.did || null}
        onClose={() => setThreadMenuOpen(false)}
        onSelect={openWallToWall}
        onViewFull={viewFullThread}
      />

      {replyError ? (
        <Text style={{ color: p.danger, paddingHorizontal: 16, paddingBottom: 6 }}>
          {replyError}
        </Text>
      ) : null}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: p.card,
            borderTopColor: p.divider,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {replyMentionQuery && !sending ? (
          <MentionSuggestions
            query={replyMentionQuery}
            status={replyMentionStatus}
            results={replyMentionResults}
            onSelect={chooseReplyMention}
          />
        ) : null}
        <View style={styles.composerRow}>
          <Avatar
            avatar={me && me.avatar}
            displayName={(me && (me.displayName || me.handle)) || 'You'}
            size={36}
          />
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: p.bg, borderColor: p.divider },
            ]}
          >
            <TextInput
              ref={replyInput}
              placeholder="Write a reply…"
              placeholderTextColor={p.secondary}
              accessibilityLabel="Write a reply to this thread"
              value={replyText}
              onChangeText={setReplyText}
              editable={!sending}
              selection={replySelection}
              onSelectionChange={(event) =>
                setReplySelection(event.nativeEvent.selection)
              }
              multiline
              style={[
                {
                  color: p.text,
                  flex: 1,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  maxHeight: 120,
                  fontSize: 15,
                },
                webInputReset,
              ]}
            />
          </View>
          <Pressable
            onPress={sendReply}
            disabled={sending || !canSendReply}
            accessibilityRole="button"
            accessibilityLabel="Reply"
            accessibilityState={{ disabled: sending || !canSendReply, busy: sending }}
            style={({ pressed }) => ({
              backgroundColor: p.accent,
              opacity: pressed || sending || !canSendReply ? 0.5 : 1,
              borderRadius: CARD_RADIUS,
              minHeight: 44,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            })}
          >
            <Text style={{ color: p.onAccent, fontWeight: '700', fontSize: 15 }}>Reply</Text>
          </Pressable>
        </View>
        <View style={styles.composerMeta}>
          <Text
            style={{
              color: replyLimit.over ? p.danger : p.secondary,
              fontSize: 12,
            }}
          >
            {replyLimit.graphemes}/{POST_TEXT_MAX_GRAPHEMES}
          </Text>
          {replyLimit.over ? (
            <Text
              accessibilityRole="alert"
              numberOfLines={2}
              style={{
                color: p.danger,
                fontSize: 12,
                marginLeft: 8,
                flex: 1,
              }}
            >
              {replyLimit.message}
            </Text>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  threadHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  lensHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
  },
  viewFullButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  lensEmpty: {
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },
  hiddenToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  composerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
    paddingTop: 4,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 8,
    overflow: 'hidden',
  },
});
