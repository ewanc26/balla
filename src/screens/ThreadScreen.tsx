import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { agent } from '../lib/agent';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { useViewer } from '../lib/viewer';
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

function ReplyBranch({
  node,
  depth,
  onOpenThread,
  onOpenProfile,
  onPostHidden,
}: {
  node: any;
  depth: number;
  onOpenThread?: (uri: string) => void;
  onOpenProfile: (did: string) => void;
  onPostHidden?: (post: any, scope: 'post' | 'author') => void;
}) {
  const p = usePalette();
  const replies = (node.replies || []).filter(isThreadViewPost);
  const indented = depth > 0 && depth <= 3;
  return (
    <View
      style={
        indented
          ? {
              marginLeft: 12,
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: p.divider,
              paddingLeft: 8,
            }
          : undefined
      }
    >
      <PostCard
        post={node.post}
        onOpenThread={onOpenThread}
        onOpenProfile={onOpenProfile}
        onPostHidden={onPostHidden}
      />
      {replies.map((child: any) => (
        <ReplyBranch
          key={child.post.uri}
          node={child}
          depth={depth + 1}
          onOpenThread={onOpenThread}
          onOpenProfile={onOpenProfile}
          onPostHidden={onPostHidden}
        />
      ))}
    </View>
  );
}

export function ThreadScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const { profile: me } = useViewer();
  const uri = route.params && route.params.uri;
  const [thread, setThread] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const replyInput = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
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
    try {
      const res = await agent.getPostThread({ uri, depth: 10 });
      const t = res.data.thread;
      if (isThreadViewPost(t)) {
        setThread(flattenThread(t));
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
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

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Post' });
  }, [navigation]);

  async function sendReply() {
    if (sending || replyText.trim().length === 0) return;
    setSending(true);
    try {
      const post = thread.post;
      // A reply addresses the post itself; if the post is itself a reply,
      // the root travels up so the whole conversation stays one tree.
      const record = post.record || {};
      let root = { uri: post.uri, cid: post.cid };
      if (record.reply && record.reply.root) {
        root = record.reply.root;
      }
      await agent.post({
        text: replyText.trim(),
        reply: {
          root,
          parent: { uri: post.uri, cid: post.cid },
        },
      });
      setReplyText('');
      await load();
    } catch {
      // keep the text; a failed send should never eat the reply
    }
    setSending(false);
  }

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.secondary }}>Could not load this post. Pull down to retry.</Text>
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

  const replyCount = countReplies(thread.replies);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
        {thread.ancestors.map((a: any) => (
          <PostCard
            key={a.post.uri}
            post={a.post}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
          />
        ))}
        <PostCard
          post={thread.post}
          highlight
          onOpenThread={() => replyInput.current?.focus()}
          onOpenProfile={openProfile}
          onPostHidden={hidePost}
        />
        {replyCount > 0 && (
          <Text
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
        {thread.replies.map((r: any) => (
          <ReplyBranch
            key={r.post.uri}
            node={r}
            depth={0}
            onOpenThread={(replyUri: string) => navigation.push('Thread', { uri: replyUri })}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
          />
        ))}
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: p.card, borderTopColor: p.divider }]}>
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
            value={replyText}
            onChangeText={setReplyText}
            multiline
            style={[
              {
                color: p.text,
                flex: 1,
                minHeight: 40,
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
          disabled={sending || replyText.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Reply"
          style={({ pressed }) => ({
            backgroundColor: p.accent,
            opacity: pressed || sending || replyText.trim().length === 0 ? 0.5 : 1,
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 8,
    overflow: 'hidden',
  },
});
