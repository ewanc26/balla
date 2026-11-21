import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';
import { MOCK_MODE } from '../lib/mock';

type Mode = 'people' | 'posts';

export function SearchScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [mode, setMode] = useState<Mode>('people');
  const [people, setPeople] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  async function runSearch(nextMode: Mode, rawQuery: string) {
    const term = rawQuery.trim();
    if (!term) return;
    const id = ++requestId.current;
    setMode(nextMode);
    setSubmitted(term);
    setLoading(true);
    setError(null);
    try {
      if (nextMode === 'people') {
        const res = await agent.searchActors({ q: term, limit: 30 });
        if (id !== requestId.current) return;
        setPeople(res.data.actors || []);
      } else {
        const res = await agent.app.bsky.feed.searchPosts({ q: term, limit: 30 });
        if (id !== requestId.current) return;
        setPosts(res.data.posts || []);
      }
    } catch {
      if (id === requestId.current) {
        setError('Could not search. Check the query and try again.');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!MOCK_MODE) return;
    setQuery('tea');
    void runSearch('people', 'tea');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    return subscribeActorHidden((did) => {
      setPeople((prev) => prev.filter((item: any) => item.did !== did));
      setPosts((prev) =>
        prev.filter((item: any) => item.author.did !== did)
      );
    });
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    if (submitted) void runSearch(next, submitted);
  }

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setPosts((prev) =>
      prev.filter((item: any) =>
        scope === 'author'
          ? item.author.did !== post.author.did
          : item.uri !== post.uri
      )
    );
  }

  const data = mode === 'people' ? people : posts;
  const canSearch = query.trim().length > 0 && !loading;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={{
          backgroundColor: p.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: p.divider,
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>Search</Text>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: p.bg, borderColor: p.divider },
            ]}
          >
            <Ionicons name="search" size={18} color={p.secondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch(mode, query)}
              placeholder="Search Bluesky"
              placeholderTextColor={p.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.input, { color: p.text }, webInputReset]}
            />
            <Pressable
              onPress={() => void runSearch(mode, query)}
              disabled={!canSearch}
              accessibilityRole="button"
              accessibilityLabel="Search Bluesky"
              style={({ pressed }) => [
                styles.searchButton,
                { opacity: !canSearch ? 0.45 : pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600' }}>
                Search
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', paddingLeft: 8 }}>
          <ModeTab label="People" selected={mode === 'people'} onPress={() => switchMode('people')} />
          <ModeTab label="Posts" selected={mode === 'posts'} onPress={() => switchMode('posts')} />
        </View>

        {submitted ? (
          <Text
            style={{
              color: p.secondary,
              fontSize: 13,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 10,
            }}
          >
            Results for “{submitted}”
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text style={{ color: p.danger, fontSize: 13, padding: 16 }}>{error}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={p.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => (mode === 'people' ? item.did : item.uri)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text
              style={{
                color: p.secondary,
                textAlign: 'center',
                marginTop: 40,
                paddingHorizontal: 24,
              }}
            >
              {submitted
                ? `No ${mode === 'people' ? 'people' : 'posts'} found for “${submitted}”.`
                : 'Search for someone or something.'}
            </Text>
          }
          renderItem={({ item }) =>
            mode === 'people' ? (
              <Pressable
                onPress={() => openProfile(item.did)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.handle}'s profile`}
                style={({ pressed }) => [
                  styles.personCard,
                  { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
                  cardShadow,
                ]}
              >
                <Avatar avatar={item.avatar} displayName={item.displayName || item.handle} size={56} />
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                    {item.displayName || item.handle}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
                    @{item.handle}
                  </Text>
                  {item.description ? (
                    <Text
                      style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 2 }}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={p.secondary} />
              </Pressable>
            ) : (
              <PostCard
                post={item}
                onOpenThread={openThread}
                onOpenProfile={openProfile}
                onPostHidden={hidePost}
              />
            )
          }
        />
      )}
    </View>
  );
}

function ModeTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 3,
        borderBottomColor: selected ? p.accent : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? p.accent : p.secondary,
          fontSize: 15,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    marginTop: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  searchButton: {
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginHorizontal: 8,
    marginBottom: 8,
    minHeight: 80,
  },
});
