import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  NEWS_CURATION_ERROR,
  NEWS_INTRO,
  NEWS_NO_RANKING,
  NEWS_REGIONS,
  NEWS_TRANSPARENCY,
  loadNewsCuration,
  publishersForBundle,
  type NewsRegionId,
} from '../lib/newsBundles';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * The News section of Discover (#159). Curation is compiled data, so opening
 * this screen performs no network read and writes nothing. Tapping a topic
 * only opens a roster preview; the write happens on the bundle screen after
 * the accounts are named.
 */
export function NewsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const state = useMemo(() => loadNewsCuration(), []);
  const [region, setRegion] = useState<NewsRegionId>('global');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'News bundles' });
  }, [navigation]);

  if (!state.ok) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={styles.noticeRow}>
            <Ionicons name="alert-circle-outline" size={20} color={p.danger} />
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
              News bundles are unavailable
            </Text>
          </View>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            {state.error}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
            {NEWS_CURATION_ERROR} The rest of Discover is unchanged.
          </Text>
        </View>
      </View>
    );
  }

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
          <Ionicons name="newspaper-outline" size={20} color={p.accent} />
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '700', marginLeft: 8 }}>
            News bundles
          </Text>
        </View>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          {NEWS_INTRO}
        </Text>
        <View
          style={[
            styles.transparency,
            { backgroundColor: p.bg, borderColor: p.divider },
          ]}
        >
          <Ionicons name="information-circle-outline" size={17} color={p.secondary} />
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, flex: 1 }}>
            {NEWS_TRANSPARENCY}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: p.text }]}>Region</Text>
      <View style={styles.regionRow}>
        {NEWS_REGIONS.map((item) => {
          const selected = region === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setRegion(item.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Show ${item.label} news bundles`}
              style={({ pressed }) => [
                styles.regionChip,
                {
                  backgroundColor: selected ? p.accent : p.card,
                  borderColor: selected ? p.accent : p.divider,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? p.onAccent : p.text,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: p.text }]}>Topics</Text>
      {state.curation.topics.map((topic) => {
        const publishers = publishersForBundle(
          state.curation,
          topic.id,
          region
        );
        const empty = publishers.length === 0;
        return (
          <Pressable
            key={topic.id}
            onPress={() =>
              navigation.navigate('NewsBundle', {
                topic: topic.id,
                region,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={
              empty
                ? `Open the ${topic.name} bundle for this region; no publishers are listed yet`
                : `Review the ${topic.name} bundle: ${publishers.length} publisher accounts`
            }
            style={({ pressed }) => [
              styles.topicRow,
              {
                backgroundColor: p.card,
                borderColor: p.divider,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                {topic.name}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
                {topic.summary}
              </Text>
              <Text
                style={{
                  color: empty ? p.secondary : p.accent,
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 6,
                }}
              >
                {empty
                  ? 'No publishers listed for this region yet'
                  : `${publishers.length} publisher ${publishers.length === 1 ? 'account' : 'accounts'}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.secondary} />
          </Pressable>
        );
      })}

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
          How these bundles are chosen
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
          The publisher pack is maintained in the Balla repository, not chosen by
          an algorithm and not filled from engagement data. Every roster names its
          accounts before anything is written.
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {NEWS_NO_RANKING}
        </Text>
      </View>
    </ScrollView>
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
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transparency: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
  },
  regionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 8,
    marginBottom: 10,
  },
  regionChip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicRow: {
    minHeight: 64,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
