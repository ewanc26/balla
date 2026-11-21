import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import {
  getInboxAccountStatus,
  listInboxActionedSubjects,
  listInboxReports,
  markInboxSeen,
  describeInboxError,
  useModerationInboxUnread,
} from '../lib/moderationInbox';
import {
  actionLabel,
  appealSummary,
  enforcementLabel,
  formatModerationDate,
  formatModerationDateTime,
  reportActionLabel,
  reportReasonLabel,
  standingLabel,
  subjectLabel,
  type InboxFilter,
} from '../lib/moderationInboxModel';
import {
  InboxCard,
  InboxEmpty,
  InboxError,
  StatusPill,
} from '../components/ModerationInboxParts';
import { timeAgo } from '../lib/time';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Tab = 'reports' | 'account';

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'unread', label: 'Unread' },
];

export function ModerationInboxScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const [tab, setTab] = useState<Tab>('reports');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [status, setStatus] = useState<any | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);

  const requestRef = useRef(0);
  const { unreadCounts, refresh: refreshUnread } = useModerationInboxUnread();
  const reportUnread = Number(unreadCounts?.reports || 0);
  const accountUnread =
    Number(unreadCounts?.subjects || 0) +
    Number(unreadCounts?.accountStatus || 0);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Moderation inbox' });
  }, [navigation]);

  const loadFirst = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const request = ++requestRef.current;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const page: any =
          tab === 'reports'
            ? await listInboxReports({ filter, limit: 50 })
            : await listInboxActionedSubjects({ filter, limit: 50 });
        if (request !== requestRef.current) return;
        setRows(
          tab === 'reports' ? page.reports || [] : page.subjects || []
        );
        setCursor(page.cursor);
      } catch (err) {
        if (request !== requestRef.current) return;
        setError(
          describeInboxError(
            err,
            `Could not load your moderation ${tab === 'reports' ? 'reports' : 'account activity'}. Your text and settings are unchanged.`
          )
        );
        setRows([]);
        setCursor(undefined);
      } finally {
        if (request === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter, tab]
  );

  useEffect(() => {
    void loadFirst('initial');
  }, [tab, filter]);

  useEffect(() => {
    if (tab !== 'account') return;
    let active = true;
    setStatusLoading(true);
    setStatusError(null);
    getInboxAccountStatus()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch((err) => {
        if (!active) return;
        setStatus(null);
        setStatusError(
          describeInboxError(
            err,
            'Account standing is unavailable. Balla will not guess a status.'
          )
        );
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, statusVersion]);

  async function loadMore() {
    if (!cursor || loading || loadingMore || refreshing) return;
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const page: any =
        tab === 'reports'
          ? await listInboxReports({ filter, cursor, limit: 50 })
          : await listInboxActionedSubjects({ filter, cursor, limit: 50 });
      if (request !== requestRef.current) return;
      setRows((prev) => [
        ...prev,
        ...(tab === 'reports' ? page.reports || [] : page.subjects || []),
      ]);
      setCursor(page.cursor);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(
        describeInboxError(err, 'Could not load more moderation activity.')
      );
    } finally {
      setLoadingMore(false);
    }
  }

  function refresh() {
    void loadFirst('refresh');
    void refreshUnread();
    if (tab === 'account') setStatusVersion((value) => value + 1);
  }

  async function markAllRead() {
    if (marking) return;
    setMarking(true);
    setError(null);
    try {
      await markInboxSeen(
        tab === 'reports' ? ['reports'] : ['subjects', 'accountStatus']
      );
      await Promise.all([loadFirst('refresh'), refreshUnread()]);
    } catch (err) {
      setError(
        describeInboxError(
          err,
          'Could not mark this section as read. Nothing was hidden; try again.'
        )
      );
    } finally {
      setMarking(false);
    }
  }

  function markRowRead(item: any) {
    setRows((prev) =>
      prev.map((row) =>
        row === item || (row.src === item.src && row.id === item.id)
          ? { ...row, isRead: true }
          : row
      )
    );
  }

  function openReport(item: any) {
    markRowRead(item);
    navigation.navigate('ModerationReport', {
      moderationService: item.src,
      id: String(item.id),
    });
  }

  function openNotice(item: any) {
    const did =
      item.subject && typeof item.subject.did === 'string'
        ? item.subject.did
        : item.subject && typeof item.subject.uri === 'string'
          ? item.subject.uri
          : '';
    if (!item.src || !did) return;
    markRowRead(item);
    navigation.navigate('ModerationNotice', {
      moderationService: item.src,
      subject: did,
    });
  }

  const hasUnread = tab === 'reports' ? reportUnread > 0 : accountUnread > 0;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={[
          styles.tabs,
          { backgroundColor: p.card, borderBottomColor: p.divider },
        ]}
      >
        <TabButton
          label="Your reports"
          count={reportUnread}
          active={tab === 'reports'}
          onPress={() => {
            setTab('reports');
            setFilter('all');
          }}
        />
        <TabButton
          label="Your account"
          count={accountUnread}
          active={tab === 'account'}
          onPress={() => {
            setTab('account');
            setFilter('all');
          }}
        />
      </View>

      <View
        style={[
          styles.toolbar,
          { backgroundColor: p.card, borderBottomColor: p.divider },
        ]}
      >
        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const selected = filter === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setFilter(item.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${item.label.toLowerCase()} moderation activity`}
                style={({ pressed }) => [
                  styles.filter,
                  {
                    borderColor: selected ? p.accent : p.divider,
                    backgroundColor: selected ? p.accentSoft : p.card,
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? p.accent : p.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {hasUnread ? (
          <Pressable
            onPress={() => void markAllRead()}
            disabled={marking}
            accessibilityRole="button"
            accessibilityLabel="Mark all activity in this section as read"
            style={({ pressed }) => [
              styles.markAll,
              { opacity: marking ? 0.5 : pressed ? 0.65 : 1 },
            ]}
          >
            {marking ? (
              <ActivityIndicator size="small" color={p.accent} />
            ) : (
              <Text style={{ color: p.accent, fontSize: 12, fontWeight: '700' }}>
                Mark all as read
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <FlashList
        data={rows}
        keyExtractor={(item: any) =>
          tab === 'reports'
            ? `report-${item.src}-${item.id}`
            : `subject-${item.src}-${
                item.subject?.did || item.subject?.uri || item.updatedAt
              }`
        }
        renderItem={({ item }: any) =>
          tab === 'reports' ? (
            <ReportRow item={item} onPress={() => openReport(item)} />
          ) : (
            <AccountRow item={item} onPress={() => openNotice(item)} />
          )
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        ListHeaderComponent={
          tab === 'account' ? (
            <AccountStatusCard
              status={status}
              loading={statusLoading}
              error={statusError}
              onRetry={() => setStatusVersion((value) => value + 1)}
            />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 48, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={p.accent} />
            </View>
          ) : error ? (
            <View style={{ paddingTop: 8 }}>
              <InboxError message={error} onRetry={refresh} />
            </View>
          ) : (
            <InboxEmpty
              icon={tab === 'reports' ? 'document-text-outline' : 'shield-checkmark-outline'}
              title={
                filter === 'all'
                  ? tab === 'reports'
                    ? 'No reports yet'
                    : 'No actions against you'
                  : 'Nothing matches this filter'
              }
              detail={
                filter === 'all'
                  ? tab === 'reports'
                    ? 'When you report a post or account, its progress will appear here.'
                    : 'Moderation decisions, notices and appeals will appear here.'
                  : 'Try All or Unread to see the rest of this section.'
              }
            />
          )
        }
        ListFooterComponent={
          <View>
            {loadingMore ? (
              <ActivityIndicator color={p.accent} style={{ marginVertical: 16 }} />
            ) : null}
            {error && rows.length > 0 ? (
              <InboxError message={error} onRetry={loadMore} />
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={p.accent}
          />
        }
        onEndReached={() => {
          if (cursor && !loading && !loadingMore) void loadMore();
        }}
        onEndReachedThreshold={0.6}
      />
    </View>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${count > 0 ? `, ${count} unread` : ''}`}
      style={({ pressed }) => [
        styles.tab,
        {
          borderBottomColor: active ? p.accent : 'transparent',
          backgroundColor: pressed ? p.bg : 'transparent',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            color: active ? p.accent : p.secondary,
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          {label}
        </Text>
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: p.accent }]}>
            <Text style={{ color: p.onAccent, fontSize: 10, fontWeight: '800' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ReportRow({ item, onPress }: { item: any; onPress: () => void }) {
  const p = usePalette();
  const action = reportActionLabel({
    status: item.status,
    lastActionTaken: item.lastActionTaken,
  });
  const subtitle = [reportReasonLabel(item.reasonType), action]
    .filter(Boolean)
    .join(' · ');
  return (
    <InboxRow
      icon="document-text-outline"
      title={subjectLabel(item.subject)}
      subtitle={subtitle}
      date={item.updatedAt || item.createdAt}
      unread={!item.isRead}
      onPress={onPress}
      accessibilityLabel={`Open moderation report. ${subjectLabel(
        item.subject
      )}. ${subtitle}. ${item.isRead ? 'Read' : 'Unread'}.`}
    />
  );
}

function AccountRow({ item, onPress }: { item: any; onPress: () => void }) {
  const isAccount = item.subject && typeof item.subject.did === 'string';
  const action = item.latestAction ? actionLabel(item.latestAction.type) : null;
  const appeal = appealSummary(item);
  const title =
    isAccount && item.enforcement?.state === 'takendown'
      ? 'Your account is suspended'
      : isAccount && item.enforcement?.state === 'suspended'
        ? 'Your account is temporarily suspended'
        : action || 'Moderation action';
  const subtitle =
    appeal?.label ||
    enforcementLabel(item.enforcement?.state) ||
    'Moderation notice';
  return (
    <InboxRow
      icon={
        isAccount ? 'person-circle-outline' : 'shield-half-outline'
      }
      title={title}
      subtitle={subtitle}
      date={item.updatedAt || item.createdAt}
      unread={!item.isRead}
      onPress={onPress}
      accessibilityLabel={`Open moderation notice. ${title}. ${subtitle}. ${
        item.isRead ? 'Read' : 'Unread'
      }.`}
    />
  );
}

function InboxRow({
  icon,
  title,
  subtitle,
  date,
  unread,
  onPress,
  accessibilityLabel,
}: {
  icon: any;
  title: string;
  subtitle: string;
  date?: string;
  unread: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the full moderation record"
      style={({ pressed }) => [
        styles.rowCard,
        {
          backgroundColor: unread ? p.accentSoft : p.card,
          borderColor: unread ? p.accent : p.divider,
        },
        cardShadow,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: unread ? p.card : p.accentSoft },
        ]}
      >
        <Ionicons name={icon} size={20} color={p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              color: p.text,
              fontSize: 15,
              fontWeight: unread ? '700' : '600',
              flexShrink: 1,
            }}
            numberOfLines={2}
          >
            {title}
          </Text>
          {unread ? (
            <View style={[styles.unreadDot, { backgroundColor: p.accent }]} />
          ) : null}
        </View>
        <Text
          style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
        {date ? (
          <Text style={{ color: p.secondary, fontSize: 11, marginTop: 3 }}>
            {timeAgo(date)}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.secondary} />
    </Pressable>
  );
}

function AccountStatusCard({
  status,
  loading,
  error,
  onRetry,
}: {
  status: any | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const p = usePalette();
  if (loading && !status) {
    return (
      <InboxCard title="Account standing">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 13 }}>
            Checking Bluesky moderation…
          </Text>
        </View>
      </InboxCard>
    );
  }
  if (error || !status) {
    return (
      <InboxError
        message={
          error ||
          'Account standing is unavailable. Balla will not guess a status.'
        }
        onRetry={onRetry}
      />
    );
  }

  const standing = standingLabel(status.standing);
  const strikeText =
    typeof status.hasActiveStrikes === 'boolean'
      ? status.hasActiveStrikes
        ? 'Yes'
        : 'No'
      : undefined;
  return (
    <InboxCard title="Account standing">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons
          name={
            standing?.tone === 'danger'
              ? 'alert-circle-outline'
              : standing?.tone === 'warning'
                ? 'warning-outline'
                : 'shield-checkmark-outline'
          }
          size={22}
          color={
            standing?.tone === 'danger'
              ? p.danger
              : standing?.tone === 'warning'
                ? '#B26A00'
                : p.green
          }
        />
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
          {standing?.label || 'Account standing returned by Bluesky'}
        </Text>
      </View>
      {standing ? <StatusPill label={standing.label} tone={standing.tone} /> : null}
      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
        Enforcement: {enforcementLabel(status.enforcement?.state)}
        {status.enforcement?.scope
          ? ` · ${status.enforcement.scope}`
          : ''}
      </Text>
      {strikeText ? (
        <Text style={{ color: p.secondary, fontSize: 12 }}>
          Active strikes: {strikeText}
        </Text>
      ) : null}
      {status.expiresAt ? (
        <Text style={{ color: p.secondary, fontSize: 12 }}>
          Suspension ends: {formatModerationDateTime(status.expiresAt)}
        </Text>
      ) : null}
      {status.updatedAt ? (
        <Text style={{ color: p.secondary, fontSize: 11 }}>
          Status updated {formatModerationDate(status.updatedAt)}
        </Text>
      ) : null}
      <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16 }}>
        This is the status returned by Bluesky moderation. Balla does not infer a
        different standing.
      </Text>
    </InboxCard>
  );
}

const styles = StyleSheet.create({
  tabs: {
    height: 52,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    minHeight: 48,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filters: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filter: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAll: {
    minHeight: 44,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 12,
    minHeight: 76,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
