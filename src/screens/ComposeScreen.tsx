import React, { useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { agent } from '../lib/agent';
import { usePalette } from '../theme';

// Bluesky caps posts at 300 graphemes; the counter is honest and always
// visible rather than a colour shift you have to notice.
const LIMIT = 300;

export function ComposeScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New post' });
  }, [navigation]);

  const trimmed = text.trim();
  const over = trimmed.length > LIMIT;
  const blocked = sending || trimmed.length === 0 || over;

  async function send() {
    if (blocked) return;
    setSending(true);
    setError(false);
    try {
      await agent.post({ text: trimmed });
      navigation.goBack();
    } catch {
      // keep the text; a failed send should never eat the post
      setError(true);
    }
    setSending(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TextInput
        autoFocus
        multiline
        placeholder="What's on your mind?"
        placeholderTextColor={p.secondary}
        value={text}
        onChangeText={setText}
        style={{ color: p.text, fontSize: 16, lineHeight: 22, padding: 16, minHeight: 160, textAlignVertical: 'top' }}
      />
      {error && (
        <Text style={{ color: p.danger, paddingHorizontal: 16 }}>
          Could not post. Your text is safe here; try again.
        </Text>
      )}
      <View style={styles.footer}>
        <Text style={{ color: over ? p.danger : p.secondary, fontSize: 13 }}>
          {trimmed.length}/{LIMIT}
        </Text>
        <Pressable
          onPress={send}
          disabled={blocked}
          accessibilityRole="button"
          accessibilityLabel="Post"
          style={({ pressed }) => ({
            backgroundColor: p.accent,
            opacity: pressed || blocked ? 0.5 : 1,
            borderRadius: 8,
            minHeight: 44,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Post</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
