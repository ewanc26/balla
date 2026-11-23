import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CARD_RADIUS, cardShadow, useFontScale, usePalette } from '../theme';
import { openExternalUrl } from '../lib/openLink';
import { touchTargetStyle } from '../lib/accessibilityModel';
import { formatDate } from '../lib/time';
import { getBlobUrl } from '../lib/blobOriginModel';
import { resolveDidDocument } from '../lib/identityResolver';
import { atprotoPdsEndpoint } from '../lib/tealModel';
import { parseAtUri, STANDARD_SITE_COPY, type DocumentBlock, type TextSegment } from '../lib/standardSiteModel';
import {
  loadStandardSiteDocument,
  type StandardSiteLoad,
} from '../lib/standardSite';

/**
 * Read-only Standard.site article view. Records come from the author's PDS via
 * public unauthenticated reads; nothing here writes a record or asks for a new
 * scope. Publication colours are shown as swatches only, never as app text or
 * background colours, so dark mode and text scaling stay under user control.
 */
export function StandardSiteScreen({ route }: { route: any }) {
  const p = usePalette();
  const font = useFontScale();
  const navigation = useNavigation<any>();
  const uri = typeof route.params?.uri === 'string' ? route.params.uri : '';
  const [result, setResult] = useState<StandardSiteLoad | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uri) {
      setResult({ state: 'invalid' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setResult(
      await loadStandardSiteDocument(uri, {
        resolveEndpoint: async (did) => atprotoPdsEndpoint(await resolveDidDocument(did)),
      }),
    );
    setLoading(false);
  }, [uri]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: result?.state === 'ok' ? result.document.title : 'Article' });
  }, [navigation, result]);

  if (loading) {
    return (
      <View style={[styles.centre, { backgroundColor: p.bg }]} accessible accessibilityLabel="Loading article">
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }
  if (!result || result.state !== 'ok') {
    const message =
      result?.state === 'not-found'
        ? 'This document is no longer on its server.'
        : 'Could not load this document. The server may be unreachable.';
    return (
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={styles.pad}>
        <Text style={{ color: p.text, fontSize: font(16), fontWeight: '700' }}>{message}</Text>
        <Pressable
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [
            styles.button,
            { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: font(15), fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const { document, publication, pds, publicationPds, verification } = result;
  const publicationDid = publication ? parseAtUri(publication.uri)?.did ?? null : null;
  const documentDid = parseAtUri(document.uri)?.did ?? null;
  const iconUrl =
    publication && publicationPds && publicationDid && publication.iconCid
      ? getBlobUrl(publicationPds, publicationDid, publication.iconCid)
      : null;
  const coverUrl =
    pds && documentDid && document.coverCid
      ? getBlobUrl(pds, documentDid, document.coverCid)
      : null;
  const theme = publication?.theme;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
    >
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {iconUrl || publication?.iconCid ? (
          iconUrl ? (
            <Image
              source={{ uri: iconUrl }}
              style={styles.publicationIcon}
              accessible
              accessibilityLabel={`${publication!.name} icon`}
            />
          ) : null
        ) : null}
        <Text style={{ color: p.text, fontSize: font(21), fontWeight: '700' }}>
          {publication?.name ?? 'Independent document'}
        </Text>
        {publication?.description ? (
          <Text style={{ color: p.secondary, fontSize: font(13), lineHeight: font(19), marginTop: 4 }}>
            {publication.description}
          </Text>
        ) : null}
        {theme ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: p.secondary, fontSize: font(11), lineHeight: font(16) }}>
              {STANDARD_SITE_COPY.theme}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {[
                { label: 'Background', hex: theme.background },
                { label: 'Text', hex: theme.foreground },
                { label: 'Accent', hex: theme.accent },
                { label: 'Accent text', hex: theme.accentForeground },
              ].map((swatch) => (
                <View key={swatch.label} style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      backgroundColor: swatch.hex,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: p.divider,
                    }}
                    accessible
                    accessibilityLabel={`${swatch.label}: ${swatch.hex}`}
                  />
                  <Text style={{ color: p.secondary, fontSize: font(10), marginTop: 3 }}>
                    {swatch.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <Text style={{ color: p.secondary, fontSize: font(11), lineHeight: font(16), marginTop: 12 }}>
          {STANDARD_SITE_COPY.source}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            resizeMode="cover"
            accessible
            accessibilityLabel={`Cover image for ${document.title}`}
          />
        ) : null}
        <Text style={{ color: p.text, fontSize: font(25), fontWeight: '700', marginTop: coverUrl ? 12 : 0 }}>
          {document.title}
        </Text>
        <Text style={{ color: p.secondary, fontSize: font(12), marginTop: 6 }}>
          {document.publishedAt ? formatDate(document.publishedAt) : ''}
          {document.updatedAt && document.updatedAt !== document.publishedAt
            ? ` · updated ${formatDate(document.updatedAt)}`
            : ''}
        </Text>
        {document.description ? (
          <Text style={{ color: p.text, fontSize: font(15), lineHeight: font(22), marginTop: 12 }}>
            {document.description}
          </Text>
        ) : null}
        {document.tags.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {document.tags.map((tag) => (
              <View
                key={tag}
                style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: p.soft }}
              >
                <Text style={{ color: p.secondary, fontSize: font(11) }}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {document.blocks.length ? (
          document.blocks.map((block, index) => (
            <BlockView
              key={index}
              block={block}
              font={font}
              palette={p}
              blobEndpoint={pds}
              blobDid={documentDid}
              onPost={() => {
                if (block.kind === 'embed' && block.uri.startsWith('at:')) {
                  navigation.navigate('Thread', { uri: block.uri });
                }
              }}
            />
          ))
        ) : (
          <Text style={{ color: p.secondary, fontSize: font(14), lineHeight: font(21) }}>
            This record has no article body.
          </Text>
        )}
        {document.truncated ? (
          <Text style={{ color: p.secondary, fontSize: font(11), marginTop: 12 }}>
            {STANDARD_SITE_COPY.shortened}
          </Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <Text style={{ color: p.text, fontSize: font(14), fontWeight: '700' }}>
          {STANDARD_SITE_COPY.verification[verification]}
        </Text>
        {publication ? (
          <Text style={{ color: p.secondary, fontSize: font(11), lineHeight: font(16), marginTop: 5 }}>
            {publication.uri}
          </Text>
        ) : null}
        <Text style={{ color: p.secondary, fontSize: font(11), lineHeight: font(16), marginTop: 10 }}>
          {STANDARD_SITE_COPY.readLimit}
        </Text>
        {document.bskyPostRefUri ? (
          <Pressable
            onPress={() => navigation.navigate('Thread', { uri: document.bskyPostRefUri })}
            accessibilityRole="button"
            accessibilityLabel="Read comments"
            style={({ pressed }) => [
              styles.button,
              { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: font(14), fontWeight: '700' }}>Read comments</Text>
          </Pressable>
        ) : null}
        {document.bskyPostRefUri ? (
          <Text style={{ color: p.secondary, fontSize: font(11), lineHeight: font(16), marginTop: 5 }}>
            {STANDARD_SITE_COPY.discussion}
          </Text>
        ) : null}
        {document.canonicalUrl ? (
          <Pressable
            onPress={() => void openExternalUrl(document.canonicalUrl!).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel="Open the original article on the web"
            style={({ pressed }) => [
              styles.button,
              { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: font(14), fontWeight: '700' }}>
              Open the original
            </Text>
            <Ionicons name="open-outline" size={16} color={p.accent} style={{ marginLeft: 6 }} />
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SegmentText({
  segments,
  fontSize,
  lineHeight,
  colour,
  palette,
}: {
  segments: TextSegment[];
  fontSize: number;
  lineHeight: number;
  colour: string;
  palette: ReturnType<typeof usePalette>;
}) {
  return (
    <Text style={{ color: colour, fontSize, lineHeight }}>
      {segments.map((segment, index) =>
        segment.kind === 'link' ? (
          <Text
            key={index}
            onPress={() => void openExternalUrl(segment.uri).catch(() => {})}
            accessibilityRole="link"
            style={{ color: palette.accent, textDecorationLine: 'underline' }}
          >
            {segment.text}
          </Text>
        ) : (
          <Text key={index}>{segment.text}</Text>
        ),
      )}
    </Text>
  );
}

function BlockView({
  block,
  font,
  palette,
  blobEndpoint,
  blobDid,
  onPost,
}: {
  block: DocumentBlock;
  font: (size: number) => number;
  palette: ReturnType<typeof usePalette>;
  blobEndpoint: string | null;
  blobDid: string | null;
  onPost: () => void;
}) {
  if (block.kind === 'rule') {
    return (
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: palette.divider,
          marginVertical: 12,
        }}
      />
    );
  }
  if (block.kind === 'unsupported') {
    return (
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: palette.secondary, fontSize: font(12), lineHeight: font(17) }}>
          {block.label}: {STANDARD_SITE_COPY.notRendered}
        </Text>
      </View>
    );
  }
  if (block.kind === 'image') {
    if (!blobEndpoint || !blobDid) return null;
    const url = getBlobUrl(blobEndpoint, blobDid, block.cid);
    return (
      <Image
        source={{ uri: url }}
        style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 10 }}
        resizeMode="contain"
        accessible
        accessibilityLabel={block.alt ? `Article image: ${block.alt}` : 'Article image'}
      />
    );
  }
  if (block.kind === 'embed') {
    const isPost = block.uri.startsWith('at:');
    return (
      <Pressable
        onPress={isPost ? onPost : () => void openExternalUrl(block.uri).catch(() => {})}
        accessibilityRole={isPost ? 'button' : 'link'}
        accessibilityLabel={
          isPost ? `Open ${block.title} in Balla` : `Open ${block.title} in your browser`
        }
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', marginTop: 10, opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Ionicons name="link-outline" size={15} color={palette.accent} />
        <Text style={{ color: palette.accent, fontSize: font(13), marginLeft: 6, flex: 1 }}>
          {block.title}
        </Text>
      </Pressable>
    );
  }
  const heading = block.kind === 'heading';
  const size = heading ? (block.level <= 2 ? 19 : 16) : 15;
  const marginTop = heading ? 16 : 9;
  const left =
    block.kind === 'quote' ? 12 : block.kind === 'bullet' || block.kind === 'ordered' ? 8 : 0;
  return (
    <View style={{ marginTop, marginLeft: left }}>
      <SegmentText
        segments={block.segments}
        fontSize={font(size)}
        lineHeight={font(heading ? 26 : 22)}
        colour={block.kind === 'quote' ? palette.secondary : palette.text}
        palette={palette}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 12, paddingBottom: 32 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  publicationIcon: { width: 44, height: 44, borderRadius: 8, marginBottom: 10 },
  cover: { width: '100%', height: 180, borderRadius: 8 },
  button: {
    ...touchTargetStyle,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    marginTop: 14,
  },
});
