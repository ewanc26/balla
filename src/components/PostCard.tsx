import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { describeFailure, withOptimisticRollback } from '../lib/reliability';
import { timeAgo } from '../lib/time';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { Avatar } from './Avatar';
import { ImageViewer } from './ImageViewer';
import { PostMenu } from './PostMenu';
import { usePostModeration } from '../lib/moderationContext';
import { ContentWarning } from './ContentWarning';
import { translateText } from '../lib/translate';
import { richTextSegments, type RichTextSegment } from '../lib/richtext';
import {
  QUOTE_UNAVAILABLE_COPY,
  externalFromEmbed,
  quoteFromEmbed,
  type ExternalView,
  type QuoteView,
} from '../lib/embedModel';

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return Math.round(n / 100) / 10 + 'k';
  return Math.round(n / 100000) / 10 + 'M';
}

interface PostCardProps {
  post: any;
  onOpenThread?: (uri: string) => void;
  onOpenProfile?: (did: string) => void;
  onBookmarkChange?: (bookmarked: boolean, post: any) => void;
  onPostHidden?: (post: any, scope: 'post' | 'author') => void;
  highlight?: boolean;
}

export function PostCard({
  post,
  onOpenThread,
  onOpenProfile,
  onBookmarkChange,
  onPostHidden,
  highlight,
}: PostCardProps) {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const moderation = usePostModeration(post);
  const author = post && post.author ? post.author : {};
  const record = post && post.record ? post.record : {};
  const bodySegments = richTextSegments(
    (record && record.text) || '',
    record && record.facets
  );
  const [liked, setLiked] = useState(!!(post && post.viewer && post.viewer.like));
  const [likes, setLikes] = useState(post ? post.likeCount || 0 : 0);
  const [reposted, setReposted] = useState(!!(post && post.viewer && post.viewer.repost));
  const [reposts, setReposts] = useState(post ? post.repostCount || 0 : 0);
  const [bookmarked, setBookmarked] = useState(!!(post && post.viewer && post.viewer.bookmarked));
  const [likeBusy, setLikeBusy] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<'like' | 'repost' | 'bookmark' | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [textWidth, setTextWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [mediaRevealed, setMediaRevealed] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translationVisible, setTranslationVisible] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const replies = post ? post.replyCount || 0 : 0;
  const quotes = post ? post.quoteCount || 0 : 0;
  const hasEngagement = likes > 0 || reposts > 0 || quotes > 0;
  const imgs = extractImages(post);
  const quote = quoteFromEmbed(post?.embed);
  const linkCard = externalFromEmbed(post?.embed);
  // Roughly eight lines of the body at this width. Measuring the rendered
  // text avoids showing "See more" when the whole post already fits.
  const longPost =
    !!record.text && textWidth > 0 && record.text.length > textWidth * 1.1;

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    setActionError(null);
    const wasLiked = liked;
    const previousCount = likes;
    const previousViewer = post.viewer ? { ...post.viewer } : undefined;
    try {
      await withOptimisticRollback(
        () => {
          setLiked(!wasLiked);
          setLikes(wasLiked ? Math.max(0, previousCount - 1) : previousCount + 1);
        },
        async () => {
          if (wasLiked) {
            const uri = previousViewer?.like;
            if (!uri) throw new Error('This like has no address.');
            await agent.deleteLike(uri);
            post.viewer = { ...(previousViewer || {}), like: undefined };
          } else {
            const res = await agent.like(post.uri, post.cid);
            post.viewer = { ...(post.viewer || {}), like: res.uri };
          }
        },
        () => {
          setLiked(wasLiked);
          setLikes(previousCount);
          post.viewer = previousViewer;
        }
      );
      setFailedAction(null);
    } catch (err) {
      setFailedAction('like');
      setActionError(describeFailure(err, 'Could not update this like.'));
    } finally {
      setLikeBusy(false);
    }
  }

  async function toggleRepost() {
    if (repostBusy) return;
    setRepostBusy(true);
    setActionError(null);
    const wasReposted = reposted;
    const previousCount = reposts;
    const previousViewer = post.viewer ? { ...post.viewer } : undefined;
    try {
      await withOptimisticRollback(
        () => {
          setReposted(!wasReposted);
          setReposts(wasReposted ? Math.max(0, previousCount - 1) : previousCount + 1);
        },
        async () => {
          if (wasReposted) {
            const uri = previousViewer?.repost;
            if (!uri) throw new Error('This repost has no address.');
            await agent.deleteRepost(uri);
            post.viewer = { ...(previousViewer || {}), repost: undefined };
          } else {
            const res = await agent.repost(post.uri, post.cid);
            post.viewer = { ...(post.viewer || {}), repost: res.uri };
          }
        },
        () => {
          setReposted(wasReposted);
          setReposts(previousCount);
          post.viewer = previousViewer;
        }
      );
      setFailedAction(null);
    } catch (err) {
      setFailedAction('repost');
      setActionError(describeFailure(err, 'Could not update this repost.'));
    } finally {
      setRepostBusy(false);
    }
  }

  async function toggleBookmark() {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    setActionError(null);
    const wasBookmarked = bookmarked;
    const previousViewer = post.viewer ? { ...post.viewer } : undefined;
    try {
      await withOptimisticRollback(
        () => {
          setBookmarked(!wasBookmarked);
          post.viewer = { ...(previousViewer || {}), bookmarked: !wasBookmarked };
        },
        async () => {
          if (wasBookmarked) {
            await agent.app.bsky.bookmark.deleteBookmark({ uri: post.uri });
          } else {
            await agent.app.bsky.bookmark.createBookmark({ uri: post.uri, cid: post.cid });
          }
        },
        () => {
          setBookmarked(wasBookmarked);
          post.viewer = previousViewer;
        }
      );
      setFailedAction(null);
      if (onBookmarkChange) onBookmarkChange(!wasBookmarked, post);
    } catch (err) {
      setFailedAction('bookmark');
      setActionError(describeFailure(err, 'Could not update this save.'));
    } finally {
      setBookmarkBusy(false);
    }
  }

  function retryFailedAction() {
    if (failedAction === 'like') void toggleLike();
    else if (failedAction === 'repost') void toggleRepost();
    else if (failedAction === 'bookmark') void toggleBookmark();
  }

  async function translatePost() {
    const text = (record && record.text) || '';
    if (!text.trim()) return;
    if (translation) {
      setTranslationVisible((value) => !value);
      return;
    }
    if (translating) return;
    setTranslating(true);
    setTranslationError(null);
    try {
      const result = await translateText(text);
      setTranslation(result.text);
      setTranslationVisible(true);
    } catch {
      setTranslationError('Could not translate this post.');
    } finally {
      setTranslating(false);
    }
  }

  function openThread() {
    if (onOpenThread && post && post.uri) onOpenThread(post.uri);
  }

  function openFacet(segment: RichTextSegment) {
    if (segment.kind === 'link') {
      if (/^https?:\/\//i.test(segment.uri)) {
        void Linking.openURL(segment.uri).catch(() => {});
      }
      return;
    }
    if (segment.kind === 'mention' && segment.actor) {
      navigation.navigate('UserProfile', { actor: segment.actor });
      return;
    }
    if (segment.kind === 'tag' && segment.tag) {
      navigation.navigate('Tabs', {
        screen: 'Search',
        params: {
          searchRequest: {
            q: `#${segment.tag}`,
            nonce: Date.now(),
          },
        },
      });
    }
  }

  const listUi = moderation?.ui('contentList');
  const contentUi = moderation?.ui('contentView');
  const mediaUi = moderation?.ui('contentMedia');
  const profileUi = moderation?.ui('profileView');
  const avatarUi = moderation?.ui('avatar');
  const displayNameUi = moderation?.ui('displayName');
  if (hidden || listUi?.filter) return null;
  const hideAuthor = !!(profileUi?.blur || avatarUi?.blur || displayNameUi?.blur);
  const hideBody = !!contentUi?.blur && !revealed;

  const header = (
    <>
      <Avatar
        avatar={hideAuthor ? undefined : author.avatar}
        displayName={hideAuthor ? 'Hidden account' : author.displayName || author.handle}
        size={40}
      />
      <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: p.text, fontSize: 15, fontWeight: '700' }}
          numberOfLines={1}
        >
          {hideAuthor ? 'Hidden account' : author.displayName || author.handle}
        </Text>
        {hideAuthor ? (
          <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
            Account hidden by a label
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
            <Text style={{ color: p.secondary, fontSize: 13 }}>
              {timeAgo(post.indexedAt)}
            </Text>
            <Ionicons
              name="globe-outline"
              size={12}
              color={p.secondary}
              style={{ marginLeft: 4 }}
            />
            <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
              {' · @'}
              {author.handle}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  const likeLabel = liked ? 'Liked' : likes > 0 ? formatCount(likes) : 'Like';
  const repostLabel = reposts > 0 ? formatCount(reposts) : 'Repost';
  const replyLabel = replies > 0 ? formatCount(replies) : 'Comment';

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
          highlight && { borderColor: p.accent, borderWidth: 2 },
        ]}
      >
        <View style={styles.header}>
          {onOpenProfile && author.did ? (
            <Pressable
              onPress={() => onOpenProfile(author.did)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${author.handle || author.displayName || 'author'}'s profile`}
              style={({ pressed }) => [
                styles.headerAuthor,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              {header}
            </Pressable>
          ) : (
            <View style={styles.headerAuthor}>{header}</View>
          )}
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Post options"
            accessibilityHint="Report, mute, block or delete this post"
            style={({ pressed }) => [
              styles.menuButton,
              { backgroundColor: pressed ? p.bg : 'transparent' },
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={p.secondary} />
          </Pressable>
        </View>

        {hideBody ? (
          <ContentWarning
            causes={moderation?.labelCauses || []}
            noOverride={contentUi?.noOverride}
            onReveal={() => setRevealed(true)}
          />
        ) : (
          <>
            {!!record.text && (
              <>
                <Text
                  numberOfLines={longPost && !expanded ? 8 : undefined}
                  onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
                  style={{ color: p.text, fontSize: 15, lineHeight: 20, marginTop: 12 }}
                >
                  {translationVisible && translation
                    ? translation
                    : bodySegments.map((segment, index) =>
                        segment.kind === 'text' ? (
                          <Text key={`segment-${index}`}>{segment.text}</Text>
                        ) : (
                          <Text
                            key={`segment-${index}`}
                            onPress={() => openFacet(segment)}
                            accessibilityRole="link"
                            accessibilityLabel={
                              segment.kind === 'mention'
                                ? `Open profile for ${segment.text.replace(/^@/, '')}`
                                : segment.kind === 'tag'
                                  ? `Search posts tagged ${segment.text.replace(/^#/, '')}`
                                  : `Open link ${segment.text}`
                            }
                            accessibilityHint={
                              segment.kind === 'tag'
                                ? 'Searches for this hashtag'
                                : segment.kind === 'mention'
                                  ? 'Opens this account'
                                  : 'Opens this link in your browser'
                            }
                            style={{ color: p.accent, fontWeight: '500' }}
                          >
                            {segment.text}
                          </Text>
                        )
                      )}                </Text>
                {longPost ? (
                  <Pressable
                    onPress={() => setExpanded((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={expanded ? 'Show less of this post' : 'Show more of this post'}
                    style={styles.seeMore}
                  >
                    <Text style={{ color: p.secondary, fontSize: 15, fontWeight: '600' }}>
                      {expanded ? 'See less' : 'See more'}
                    </Text>
                  </Pressable>
                ) : null}
                {translating ? (
                  <View style={styles.translationStatus}>
                    <ActivityIndicator size="small" color={p.secondary} />
                    <Text style={{ color: p.secondary, fontSize: 13, marginLeft: 6 }}>
                      Translating…
                    </Text>
                  </View>
                ) : translationError ? (
                  <Pressable
                    onPress={() => void translatePost()}
                    accessibilityRole="button"
                    accessibilityLabel="Retry translation"
                    style={styles.translationStatus}
                  >
                    <Ionicons name="alert-circle-outline" size={15} color={p.danger} />
                    <Text
                      style={{
                        color: p.danger,
                        fontSize: 13,
                        fontWeight: '600',
                        marginLeft: 5,
                      }}
                    >
                      {translationError} Try again.
                    </Text>
                  </Pressable>
                ) : translation ? (
                  <Pressable
                    onPress={() => setTranslationVisible((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      translationVisible ? 'Show the original post' : 'Show the translation'
                    }
                    style={styles.translationStatus}
                  >
                    <Ionicons name="language-outline" size={15} color={p.accent} />
                    <Text
                      style={{
                        color: p.accent,
                        fontSize: 13,
                        fontWeight: '600',
                        marginLeft: 5,
                      }}
                    >
                      {translationVisible ? 'See original' : 'See translation'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}

            {imgs.length > 0 &&
              (mediaUi?.blur && !mediaRevealed ? (
                <ContentWarning
                  compact
                  causes={moderation?.labelCauses || []}
                  noOverride={mediaUi.noOverride}
                  onReveal={() => setMediaRevealed(true)}
                />
              ) : (
                <Images images={imgs} onOpen={setViewerIndex} />
              ))}

              {quote ? (
                <QuoteCard
                  quote={quote}
                  onOpenThread={() => {
                    if (quote.kind !== 'record' || !quote.uri) return;
                    if (onOpenThread) onOpenThread(quote.uri);
                    else navigation.navigate('Thread', { uri: quote.uri });
                  }}
                  onOpenProfile={
                    quote.kind === 'record' && quote.authorDid && onOpenProfile
                      ? () => onOpenProfile(quote.authorDid)
                      : undefined
                  }
                />
              ) : null}
              {linkCard ? <LinkCard card={linkCard} /> : null}
          </>
        )}

        {hasEngagement ? (
          <View style={styles.engagement}>
            {likes > 0 ? (
              <EngagementLink
                text={`${formatCount(likes)} ${likes === 1 ? 'like' : 'likes'}`}
                accessibilityLabel={`View who liked this post (${likes})`}
                onPress={() =>
                  navigation.navigate('EngagementList', { uri: post.uri, mode: 'likes' })
                }
              />
            ) : null}
            {reposts > 0 ? (
              <EngagementLink
                text={`${formatCount(reposts)} ${reposts === 1 ? 'repost' : 'reposts'}`}
                accessibilityLabel={`View who reposted this post (${reposts})`}
                onPress={() =>
                  navigation.navigate('EngagementList', { uri: post.uri, mode: 'reposts' })
                }
              />
            ) : null}
            {quotes > 0 ? (
              <EngagementLink
                text={`${formatCount(quotes)} ${quotes === 1 ? 'quote' : 'quotes'}`}
                accessibilityLabel={`View quote posts (${quotes})`}
                onPress={() =>
                  navigation.navigate('EngagementList', { uri: post.uri, mode: 'quotes' })
                }
              />
            ) : null}
          </View>
        ) : null}

        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: p.divider,
            marginTop: hasEngagement ? 0 : 12,
          }}
        />

        <View style={styles.actions}>
          <ActionButton
            icon={liked ? 'thumbs-up' : 'thumbs-up-outline'}
            color={liked ? p.accent : p.secondary}
            label={likeLabel}
            accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
            selected={liked}
            busy={likeBusy}
            onPress={toggleLike}
          />
          <ActionButton
            icon={reposted ? 'repeat' : 'repeat-outline'}
            color={reposted ? p.green : p.secondary}
            label={repostLabel}
            accessibilityLabel={reposted ? 'Undo repost' : 'Repost post'}
            selected={reposted}
            busy={repostBusy}
            onPress={toggleRepost}
          />
          <ActionButton
            icon="chatbubble-outline"
            color={p.secondary}
            label={replyLabel}
            accessibilityLabel="Reply to post"
            onPress={openThread}
          />
          <Pressable
            onPress={toggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Save post'}
            accessibilityState={{ selected: bookmarked }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: pressed ? p.bg : 'transparent' },
            ]}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={bookmarked ? p.accent : p.secondary}
            />
          </Pressable>
        </View>
        {actionError ? (
          <View style={styles.actionError}>
            <Text style={{ color: p.danger, flex: 1, fontSize: 12 }}>{actionError}</Text>
            <Pressable
              onPress={retryFailedAction}
              accessibilityRole="button"
              accessibilityLabel="Retry the failed post action"
              style={({ pressed }) => [
                styles.actionRetry,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={{ color: p.accent, fontWeight: '700', fontSize: 13 }}>Retry</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setActionError(null);
                setFailedAction(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss the post action error"
              style={({ pressed }) => [
                styles.actionRetry,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={{ color: p.secondary, fontWeight: '600', fontSize: 13 }}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <ImageViewer
        images={imgs}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
      <PostMenu
        post={post}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onHidden={(hiddenPost, scope) => {
          setHidden(true);
          if (onPostHidden) onPostHidden(hiddenPost, scope);
        }}
        onTranslate={() => void translatePost()}
        hasTranslation={!!translation}
        translationVisible={translationVisible}
        translationBusy={translating}
      />
    </>
  );
}

/** Quoted posts are read-only previews; their own thread is one tap away. */
function QuoteCard({
  quote,
  onOpenThread,
  onOpenProfile,
}: {
  quote: QuoteView;
  onOpenThread: () => void;
  onOpenProfile?: () => void;
}) {
  const p = usePalette();
  const [quoteRevealed, setQuoteRevealed] = useState(false);
  const record = quote.kind === 'record' ? quote : null;
  const unavailable = quote.kind === 'unavailable' ? quote : null;
  // A quoted post keeps its own labels; they must not be bypassed by reading
  // it inside another person's post.
  const quoteModeration = usePostModeration(
    record
      ? {
          uri: record.uri,
          cid: record.cid,
          author: { did: record.authorDid, handle: record.authorHandle },
          labels: record.labels,
        }
      : null
  );
  const quoteUi = quoteModeration?.ui('contentView');
  return (
    <View
      style={[
        styles.embedCard,
        { backgroundColor: p.bg, borderColor: p.divider },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={{ color: p.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}
      >
        Quoted post
      </Text>
      {record ? (
        <>
          <Pressable
            onPress={onOpenProfile}
            disabled={!onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={`Open ${record.authorName}'s profile`}
            accessibilityState={{ disabled: !onOpenProfile }}
            style={({ pressed }) => [
              styles.quoteAuthor,
              { opacity: pressed && onOpenProfile ? 0.65 : 1 },
            ]}
          >
            <Avatar
              avatar={record.authorAvatar}
              displayName={record.authorName}
              size={28}
            />
            <View style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ color: p.text, fontSize: 14, fontWeight: '700' }}
              >
                {record.authorName}
              </Text>
              <Text numberOfLines={1} style={{ color: p.secondary, fontSize: 12 }}>
                @{record.authorHandle}
              </Text>
            </View>
          </Pressable>
          {quoteUi?.blur && !quoteRevealed ? (
            <ContentWarning
              compact
              causes={quoteModeration?.labelCauses || []}
              noOverride={quoteUi.noOverride}
              onReveal={() => setQuoteRevealed(true)}
            />
          ) : (
            <Pressable
              onPress={onOpenThread}
              accessibilityRole="button"
              accessibilityLabel={`Open quoted post by ${record.authorName}`}
              accessibilityHint="Opens the quoted post in its thread"
              style={({ pressed }) => [{ marginTop: 8, opacity: pressed ? 0.65 : 1 }]}
            >
              {record.text ? (
                <Text
                  numberOfLines={6}
                  style={{ color: p.text, fontSize: 14, lineHeight: 20 }}
                >
                  {record.text}
                </Text>
              ) : (
                <Text style={{ color: p.secondary, fontSize: 13 }}>
                  This quoted post has no text.
                </Text>
              )}
            </Pressable>
          )}
        </>
      ) : unavailable ? (
        <Text
          accessibilityRole="text"
          style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}
        >
          {QUOTE_UNAVAILABLE_COPY[unavailable.reason]}
        </Text>
      ) : null}
    </View>
  );
}

/** External cards show only the metadata Bluesky returned, never invented copy. */
function LinkCard({ card }: { card: ExternalView }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => void Linking.openURL(card.uri).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`Open ${card.title} on ${card.host}`}
      accessibilityHint="Opens this link in your browser"
      style={({ pressed }) => [
        styles.embedCard,
        {
          backgroundColor: p.bg,
          borderColor: p.divider,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      {card.thumb ? (
        <Image
          source={{ uri: card.thumb }}
          style={{
            width: '100%',
            height: 140,
            borderRadius: 8,
            backgroundColor: p.divider,
          }}
          resizeMode="cover"
          accessible
          accessibilityLabel={`Preview image for ${card.title}`}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{ color: p.secondary, fontSize: 11, marginTop: card.thumb ? 8 : 0 }}
      >
        {card.host}
      </Text>
      <Text
        numberOfLines={2}
        style={{ color: p.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}
      >
        {card.title}
      </Text>
      {card.description ? (
        <Text
          numberOfLines={3}
          style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}
        >
          {card.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

function extractImages(post: any): any[] {
  const embed = post && post.embed;
  if (!embed) return [];
  const type = String(embed.$type || '');
  if (type.endsWith('app.bsky.embed.images#view')) return embed.images || [];
  if (type.endsWith('app.bsky.embed.gallery#view')) {
    return (embed.items || [])
      .filter(
        (item: any) =>
          String(item?.$type || '').endsWith('app.bsky.embed.gallery#viewImage') ||
          !!item?.thumbnail ||
          !!item?.fullsize
      )
      .map((item: any) => ({
        thumb: item.thumbnail || item.thumb,
        fullsize: item.fullsize,
        alt: item.alt || '',
        aspectRatio: item.aspectRatio,
      }));
  }
  if (type.endsWith('app.bsky.embed.recordWithMedia#view')) {
    return embed.media ? extractImages({ embed: embed.media }) : [];
  }
  return [];
}

function Images({ images, onOpen }: { images: any[]; onOpen: (index: number) => void }) {
  const p = usePalette();
  const shown = images.slice(0, 4);
  const hiddenCount = Math.max(0, images.length - shown.length);
  if (shown.length === 1) {
    const i = shown[0];
    return (
      <Pressable
        onPress={() => onOpen(0)}
        accessibilityRole="button"
        accessibilityLabel={i.alt || 'Open post image'}
        style={{ marginTop: 12 }}
      >
        <Image
          source={{ uri: i.thumb || i.fullsize }}
          style={{
            width: '100%',
            aspectRatio: 1.91,
            borderRadius: CARD_RADIUS,
            backgroundColor: p.divider,
          }}
          resizeMode="cover"
        />
      </Pressable>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
        marginTop: 12,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
      }}
    >
      {shown.map((i: any, idx: number) => {
        const more = hiddenCount > 0 && idx === shown.length - 1;
        return (
          <Pressable
            key={i.thumb || i.fullsize || String(idx)}
            onPress={() => onOpen(idx)}
            accessibilityRole="button"
            accessibilityLabel={
              i.alt || `Open post image ${idx + 1} of ${images.length}`
            }
            accessibilityHint={
              more
                ? `${hiddenCount} more images are available in the viewer.`
                : undefined
            }
            style={{ width: '49.5%', position: 'relative' }}
          >
            <Image
              source={{ uri: i.thumb || i.fullsize }}
              style={{
                width: '100%',
                aspectRatio: 1,
                backgroundColor: p.divider,
              }}
              resizeMode="cover"
            />
            {more ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>
                  +{hiddenCount}
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                  more
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function EngagementLink({
  text,
  accessibilityLabel,
  onPress,
}: {
  text: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.engagementLink, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={{ color: p.secondary, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );
}

function ActionButton({
  icon,
  color,
  label,
  accessibilityLabel,
  selected,
  busy,
  onPress,
}: {
  icon: any;
  color: string;
  label?: string;
  accessibilityLabel: string;
  selected?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        ...(selected !== undefined ? { selected } : {}),
        ...(busy !== undefined ? { busy } : {}),
      }}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? p.bg : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
      {label ? (
        <Text
          numberOfLines={1}
          style={{ color, marginLeft: 5, fontSize: 13, fontWeight: '600' }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  embedCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 10,
    marginTop: 12,
  },
  quoteAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginTop: 6,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  headerAuthor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 0,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  seeMore: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionError: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingBottom: 8,
  },
  actionRetry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  engagement: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  engagementLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  translationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 2,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    borderRadius: 6,
    paddingHorizontal: 2,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
