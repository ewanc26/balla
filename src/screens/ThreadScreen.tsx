import React, { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { agent } from '../lib/agent';
import { PostCard } from '../components/PostCard';
import { usePalette } from '../theme';

// Minimal navigation over the threadViewPost tree: the ancestor chain, the
// highlighted post, then the immediate replies. Deeper branches stay behind
// their own comment buttons when we grow trees; for now one level reads like
// Facebook's comment list.

function flattenThread(node: any): { ancestors: any[]; post: any; replies: any[] } {
  const ancestors: any[] = [];
  let current = node;
  while (current && current.parent) {
    ancestors.unshift(current.parent);
    current = current.parent;
  }
  const replies = (node.replies || []).map((r: any) => r.post);
  return { ancestors, post: node.post, replies };
}

export function ThreadScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const uri = route.params && route.params.uri;
  const [thread, setThread] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    setFailed(false);
    try {
      const res = await agent.getPostThread({ uri });
      const t = res.data.thread;
      if (String(t.$type || '').endsWith('threadViewPost')) {
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

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 24 }}>
        {thread.ancestors.map((a: any) => (
          <PostCard key={a.post.uri} post={a.post} />
        ))}
        <PostCard post={thread.post} highlight onOpenThread={() => load()} />
        {thread.replies.length > 0 && (
          <Text style={{ color: p.secondary, fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4, paddingHorizontal: 4 }}>
            {thread.replies.length === 1 ? '1 reply' : thread.replies.length + ' replies'}
          </Text>
        )}
        {thread.replies.map((r: any) => (
          <PostCard key={r.uri} post={r} />
        ))}
      </ScrollView>
      <View style={[styles.composer, { backgroundColor: p.card, borderTopColor: p.divider }]}>
        <TextInput
          placeholder="Write a reply…"
          placeholderTextColor={p.secondary}
          value={replyText}
          onChangeText={setReplyText}
          multiline
          style={{ color: p.text, flex: 1, minHeight: 44, paddingHorizontal: 12, maxHeight: 120 }}
        />
        <Pressable
          onPress={sendReply}
          disabled={sending || replyText.trim().length === 0}
          style={({ pressed }) => ({
            backgroundColor: p.accent,
            opacity: pressed || sending || replyText.trim().length === 0 ? 0.5 : 1,
            borderRadius: 8,
            minHeight: 44,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
          })}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reply</Text>
        </Pressable>
      </View>
    </View>
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
});
