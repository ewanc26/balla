import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  describeInboxError,
  getInboxActionedSubject,
  markInboxSeen,
} from '../lib/moderationInbox';
import {
  appealSummary,
  canAppeal,
  describeSubject,
  enforcementLabel,
  formatModerationDate,
  formatModerationDateTime,
  noticeTitle,
  reportReasonLabel,
  scopeLabel,
  subjectWebUrl,
} from '../lib/moderationInboxModel';
import {
  ActionHistory,
  AppealModal,
  DetailLine,
  InboxCard,
  InboxError,
  StatusPill,
  SubjectLink,
} from '../components/ModerationInboxParts';
import { usePalette } from '../theme';

export function ModerationNoticeScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const service: string = route.params?.moderationService || '';
  const subject: string = route.params?.subject || '';
  const [data, setData] = useState<any | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Notice' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!service || !subject) {
      setLoading(false);
      setError('This notice link is incomplete.');
      return;
    }
    setLoading(true);
    setError(null);
    setOlderError(null);
    try {
      const next = await getInboxActionedSubject(service, subject, { limit: 50 });
      setData(next);
      setActions(next.actions || []);
      setCursor(next.cursor);
      markInboxSeen(['subjects']).catch(() => {
        // The notice is still readable if the watermark update fails.
      });
    } catch (err) {
      setData(null);
      setError(
        describeInboxError(
          err,
          'Could not load this notice. Its moderation status has not been guessed.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [service, subject]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const next = await getInboxActionedSubject(service, subject, {
        cursor,
        limit: 50,
      });
      setData((prev: any) => ({
        ...prev,
        ...next,
        actions: prev?.actions || [],
      }));
      setActions((prev) => {
        const seen = new Set(prev.map((action) => action.id));
        return [
          ...prev,
          ...(next.actions || []).filter((action: any) => !seen.has(action.id)),
        ];
      });
      setCursor(next.cursor);
    } catch (err) {
      setOlderError(
        describeInboxError(err, 'Could not load older moderation actions.')
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  function openSubject() {
    const descriptor = describeSubject(data?.subject);
    if (descriptor.kind === 'post' && descriptor.uri) {
      navigation.navigate('Thread', { uri: descriptor.uri });
      return;
    }
    if (descriptor.kind === 'account' && descriptor.did) {
      navigation.navigate('UserProfile', { actor: descriptor.did });
      return;
    }
    const web = subjectWebUrl(data?.subject);
    if (web) {
      void Linking.openURL(web).catch(() => {});
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: p.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={p.accent} />
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
          Loading this notice…
        </Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ paddingTop: 12 }}
      >
        <InboxError
          message={error || 'This notice is unavailable.'}
          onRetry={load}
        />
      </ScrollView>
    );
  }

  const descriptor = describeSubject(data.subject);
  const subjectCanOpen =
    descriptor.kind === 'post' ||
    descriptor.kind === 'account' ||
    !!subjectWebUrl(data.subject);
  const appeal = appealSummary(data);
  const primaryAction = actions[0];
  const title = noticeTitle(data);
  const enforcement = data.enforcement;
  const reportReasons = Array.isArray(data.reports?.reasonTypes)
    ? data.reports.reasonTypes.map((reason: string) => reportReasonLabel(reason))
    : [];
  const appealDecision = data.appeal?.state === 'resolved';
  const appealPending = data.appeal?.state === 'pending';
  const date =
    appealPending
      ? data.appeal?.appealedAt
      : appealDecision
        ? data.appeal?.resolvedAt
        : primaryAction?.reversedAt || primaryAction?.createdAt || data.updatedAt;

  const summary = appealPending
    ? 'Your appeal has been submitted and is awaiting review by a moderator.'
    : appealDecision
      ? data.appeal?.outcome === 'approved'
        ? 'Bluesky moderation approved your appeal. The current enforcement state is shown below.'
        : data.appeal?.outcome === 'denied'
          ? 'Bluesky moderation denied your appeal. The current enforcement state remains in place.'
          : 'Bluesky moderation resolved your appeal. The current enforcement state is shown below.'
      : data.appeal?.state === 'expired'
        ? 'The appeal window for this decision has closed.'
        : enforcement?.state === 'takendown' || enforcement?.state === 'suspended'
          ? 'Bluesky moderation reports the account restriction below. Review the available appeal option before it expires.'
          : primaryAction?.type === 'contentRemoved'
            ? 'Bluesky moderation removed this content. The recorded actions and any appeal option are shown below.'
            : primaryAction?.type === 'labelApplied'
              ? 'Bluesky moderation applied a label. The label is public and may affect how clients display this content.'
              : 'The moderation service recorded the decision and action history below.';

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
      >
        <InboxCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={
                enforcement?.state === 'takendown' ||
                enforcement?.state === 'suspended'
                  ? 'alert-circle-outline'
                  : 'shield-outline'
              }
              size={24}
              color={
                enforcement?.state === 'takendown' ||
                enforcement?.state === 'suspended'
                  ? p.danger
                  : p.accent
              }
            />
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
              {title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {appeal ? <StatusPill label={appeal.label} tone={appeal.tone} /> : null}
            {enforcement?.state ? (
              <StatusPill
                label={enforcementLabel(enforcement.state)}
                tone={
                  enforcement.state === 'takendown' ||
                  enforcement.state === 'suspended'
                    ? 'danger'
                    : 'muted'
                }
              />
            ) : null}
          </View>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
            {summary}
          </Text>
          {date ? (
            <Text style={{ color: p.secondary, fontSize: 11 }}>
              {appealPending ? 'Appealed' : appealDecision ? 'Resolved' : 'Updated'}{' '}
              {formatModerationDateTime(date)}
            </Text>
          ) : null}
        </InboxCard>

        <InboxCard title={descriptor.kind === 'account' ? 'Your account' : 'Your content'}>
          <SubjectLink
            subject={data.subject}
            record={data.record}
            account={data.account}
            perspective="notice"
            onOpen={subjectCanOpen ? openSubject : undefined}
          />
          {enforcement?.expiresAt ? (
            <DetailLine
              label="Scheduled end"
              value={formatModerationDateTime(enforcement.expiresAt)}
            />
          ) : null}
          {data.reports ? (
            <>
              <DetailLine
                label="Reports against this subject"
                value={
                  reportReasons.length
                    ? Array.from(new Set(reportReasons)).join(' · ')
                    : 'The service did not list report reasons.'
                }
              />
              <DetailLine
                label="Reported between"
                value={`${formatModerationDate(
                  data.reports.firstReportedOn
                )} and ${formatModerationDate(data.reports.lastReportedOn)}`}
              />
            </>
          ) : null}
          {data.account?.handle ? (
            <DetailLine label="Current handle" value={`@${data.account.handle}`} />
          ) : null}
        </InboxCard>

        <InboxCard title="Enforcement">
          <DetailLine
            label="State"
            value={enforcementLabel(enforcement?.state)}
          />
          {enforcement?.scope ? (
            <DetailLine
              label="Scope"
              value={scopeLabel(enforcement.scope) || enforcement.scope}
            />
          ) : null}
          {enforcement?.labels?.length ? (
            <DetailLine label="Active labels" value={enforcement.labels.join(', ')} />
          ) : null}
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
            Enforcement state is returned by {data.src || service}. Balla does not
            infer a removal, suspension or label when the service omits it.
          </Text>
        </InboxCard>

        {appeal || canAppeal(data) ? (
          <InboxCard title="Appeal">
            {appeal ? (
              <>
                <View style={{ flexDirection: 'row' }}>
                  <StatusPill label={appeal.label} tone={appeal.tone} />
                </View>
                <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                  {data.appeal?.state === 'pending'
                    ? 'A different moderator will review the explanation already submitted.'
                    : data.appeal?.state === 'resolved'
                      ? `Appeal recorded ${formatModerationDate(
                          data.appeal?.resolvedAt
                        )}.${
                          data.appeal?.outcome
                            ? ` Outcome: ${data.appeal.outcome}.`
                            : ''
                        }`
                      : 'This appeal is no longer open.'}
                </Text>
              </>
            ) : null}
            {canAppeal(data) ? (
              <>
                <Text style={{ color: p.text, fontSize: 13, lineHeight: 19 }}>
                  You can submit one appeal for this decision. A different
                  moderator will review it.
                </Text>
                <Pressable
                  onPress={() => setAppealOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Appeal this moderation decision"
                  style={({ pressed }) => [
                    styles.appealButton,
                    {
                      backgroundColor: p.accent,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>
                    Appeal this decision
                  </Text>
                </Pressable>
              </>
            ) : null}
            {data.appeal?.state === 'expired' ? (
              <Text style={{ color: p.secondary, fontSize: 12 }}>
                The appeal window has closed.
              </Text>
            ) : null}
          </InboxCard>
        ) : null}

        {submitted ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.success,
              { backgroundColor: p.card, borderColor: p.green },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color={p.green} />
            <Text style={{ color: p.text, fontSize: 13, flex: 1, marginLeft: 8 }}>
              Appeal submitted. It now appears as pending in this notice.
            </Text>
          </View>
        ) : null}

        <InboxCard title="Action history">
          <ActionHistory
            actions={actions}
            onOpenPolicy={(url) => void Linking.openURL(url).catch(() => {})}
          />
          {cursor ? (
            <Pressable
              onPress={() => void loadOlder()}
              disabled={loadingOlder}
              accessibilityRole="button"
              accessibilityLabel="Load older moderation actions"
              style={({ pressed }) => [
                styles.olderButton,
                {
                  borderColor: p.divider,
                  opacity: loadingOlder ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              {loadingOlder ? (
                <ActivityIndicator size="small" color={p.accent} />
              ) : (
                <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
                  Load older actions
                </Text>
              )}
            </Pressable>
          ) : null}
          {olderError ? <InboxError message={olderError} onRetry={loadOlder} /> : null}
        </InboxCard>

        <Text
          style={{
            color: p.secondary,
            fontSize: 11,
            lineHeight: 17,
            paddingHorizontal: 18,
          }}
        >
          Notice source: {data.src || service}. The service decides moderation
          outcomes; Balla only displays the records it returns.
        </Text>
      </ScrollView>

      <AppealModal
        visible={appealOpen}
        data={data}
        actions={actions}
        onClose={() => setAppealOpen(false)}
        onSubmitted={() => {
          setSubmitted(true);
          void load();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  appealButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  olderButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 10,
    padding: 12,
  },
});
