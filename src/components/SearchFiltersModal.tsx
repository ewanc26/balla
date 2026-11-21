import React, { useEffect, useState } from 'react';
import {
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
import {
  cleanSearchFilters,
  EMPTY_SEARCH_FILTERS,
  validateSearchFilters,
  type SearchFilters,
} from '../lib/searchModel';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

export function SearchFiltersModal({
  visible,
  initialFilters,
  onClose,
  onApply,
}: {
  visible: boolean;
  initialFilters: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilters>(initialFilters);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(cleanSearchFilters(initialFilters));
      setError(null);
    }
  }, [visible, initialFilters]);

  if (!visible) return null;

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function apply() {
    const clean = cleanSearchFilters(draft);
    const problem = validateSearchFilters(clean);
    if (problem) {
      setError(problem);
      return;
    }
    onApply(clean);
  }

  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close advanced search"
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>
                Advanced search
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                These filters apply to Top and Latest posts.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close advanced search"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={23} color={p.secondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <SectionTitle title="From and mentioning" />
            <FilterInput
              label="From these accounts"
              hint="Handles or DIDs, separated by spaces or commas."
              value={draft.authors}
              onChangeText={(value) => set('authors', value)}
              placeholder="alice.bsky.social, bob.bsky.social"
            />
            <FilterInput
              label="Mentioning these accounts"
              hint="Only posts with a real rich-text mention."
              value={draft.mentions}
              onChangeText={(value) => set('mentions', value)}
              placeholder="jay.bsky.team"
            />
            <Segment
              label="Limit to"
              value={draft.from}
              options={[
                { value: 'anyone', label: 'Anyone' },
                { value: 'following', label: 'Following' },
                { value: 'me', label: 'Me' },
              ]}
              onChange={(value) => set('from', value)}
            />

            <SectionTitle title="Links and tags" />
            <FilterInput
              label="Linking to these domains"
              hint="Domain only. A pasted https:// address is reduced to its host."
              value={draft.domains}
              onChangeText={(value) => set('domains', value)}
              placeholder="bsky.app, example.com"
              keyboardType="url"
            />
            <FilterInput
              label="Linking to these URLs"
              hint="Full http:// or https:// addresses."
              value={draft.urls}
              onChangeText={(value) => set('urls', value)}
              placeholder="https://bsky.app/about"
              keyboardType="url"
            />
            <FilterInput
              label="Hashtags"
              hint="Do not include the # prefix. Spaces separate several tags."
              value={draft.hashtags}
              onChangeText={(value) => set('hashtags', value)}
              placeholder="scotland photography"
            />

            <SectionTitle title="Exclude" />
            <FilterInput
              label="Exclude authors"
              hint="Remove posts from these handles or DIDs."
              value={draft.excludeAuthors}
              onChangeText={(value) => set('excludeAuthors', value)}
              placeholder="spam.example.com"
            />
            <FilterInput
              label="Exclude mentions"
              hint="Remove posts mentioning these accounts."
              value={draft.excludeMentions}
              onChangeText={(value) => set('excludeMentions', value)}
              placeholder="account.bsky.social"
            />
            <FilterInput
              label="Exclude domains"
              hint="Remove posts linking to these domains."
              value={draft.excludeDomains}
              onChangeText={(value) => set('excludeDomains', value)}
              placeholder="example.com"
              keyboardType="url"
            />
            <FilterInput
              label="Exclude URLs"
              hint="Remove posts linking to these exact addresses."
              value={draft.excludeUrls}
              onChangeText={(value) => set('excludeUrls', value)}
              placeholder="https://example.com/page"
              keyboardType="url"
            />
            <FilterInput
              label="Exclude hashtags"
              hint="Remove posts carrying these tags."
              value={draft.excludeHashtags}
              onChangeText={(value) => set('excludeHashtags', value)}
              placeholder="spoilers"
            />

            <SectionTitle title="Language and dates" />
            <FilterInput
              label="Languages"
              hint="Language codes such as en, gd or pt-BR."
              value={draft.languages}
              onChangeText={(value) => set('languages', value)}
              placeholder="en gd"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FilterInput
                  label="After"
                  hint="YYYY-MM-DD"
                  value={draft.since}
                  onChangeText={(value) => set('since', value)}
                  placeholder="2026-01-01"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FilterInput
                  label="Before"
                  hint="YYYY-MM-DD"
                  value={draft.until}
                  onChangeText={(value) => set('until', value)}
                  placeholder="2026-12-31"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <SectionTitle title="Replies and media" />
            <Segment
              label="Replies"
              value={draft.replies}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'none', label: 'No replies' },
                { value: 'only', label: 'Replies only' },
              ]}
              onChange={(value) => set('replies', value)}
            />
            <Segment
              label="Media"
              value={draft.media}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'media', label: 'With media' },
                { value: 'video', label: 'With video' },
              ]}
              onChange={(value) => set('media', value)}
            />
          </ScrollView>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: p.danger, fontSize: 13, lineHeight: 18, marginBottom: 8 }}
            >
              {error}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                setDraft({ ...EMPTY_SEARCH_FILTERS });
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear all search filters"
              style={({ pressed }) => [
                styles.footerButton,
                {
                  backgroundColor: p.bg,
                  borderColor: p.divider,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
                Clear all
              </Text>
            </Pressable>
            <Pressable
              onPress={apply}
              accessibilityRole="button"
              accessibilityLabel="Apply search filters"
              style={({ pressed }) => [
                styles.footerButton,
                {
                  backgroundColor: p.accent,
                  borderColor: p.accent,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                Show results
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionTitle({ title }: { title: string }) {
  const p = usePalette();
  return (
    <Text
      style={{
        color: p.secondary,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginTop: 14,
        marginBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}

function FilterInput({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'url' | 'numbers-and-punctuation';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 1 }}>
        {hint}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.secondary}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: p.text,
            backgroundColor: p.bg,
            borderColor: p.divider,
          },
          webInputReset,
        ]}
      />
    </View>
  );
}

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: CARD_RADIUS,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.divider,
          overflow: 'hidden',
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
                backgroundColor: selected ? p.accentSoft : pressed ? p.bg : p.card,
                borderLeftWidth: option === options[0] ? 0 : StyleSheet.hairlineWidth,
                borderLeftColor: p.divider,
              })}
            >
              <Text
                style={{
                  color: selected ? p.accent : p.text,
                  fontSize: 13,
                  fontWeight: selected ? '700' : '500',
                  textAlign: 'center',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 2,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginRight: -8,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginTop: 5,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
  },
  footerButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
