import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { openExternalUrl } from '../lib/openLink';
import { Ionicons } from '@expo/vector-icons';
import {
  describeInboxError,
  getInboxReport,
  markInboxSeen,
} from '../lib/moderationInbox';
import {
  actionLabel,
  describeSubject,
  formatModerationDate,
  formatModerationDateTime,
  reportActionLabel,
  reportReasonLabel,
  scopeLabel,
  subjectLabel,
  subjectWebUrl,
} from '../lib/moderationInboxModel';
import {
  DetailLine,
  InboxCard,
  InboxError,
  StatusPill,
  SubjectLink,
} from '../components/ModerationInboxParts';
import { usePalette } from '../theme';

const COMMUNITY_GUIDELINES =
  'https://bsky.social/about/support/community-guidelines';

export function ModerationReportScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const service: string = route.params?.moderationService || '';
  const parsedId = Number(route.params?.id);
  const id = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Your report' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!service || !id) {
      setLoading(false);
      setError('This report link is incomplete.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getInboxReport(service, id);
      setData(next);
      markInboxSeen(['reports']).catch(() => {
        // The report is still readable if the watermark update fails.
      });
    } catch (err) {
      setData(null);
      setError(
        describeInboxError(
          err,
          'Could not load this report. Its status has not been guessed.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [id, service]);

  useEffect(() => {
    void load();
  }, [load]);

  function openSubject(subject: any) {
    const descriptor = describeSubject(subject);
    if (descriptor.kind === 'post' && descriptor.uri) {
      navigation.navigate('Thread', { uri: descriptor.uri });
      return;
    }
    if (descriptor.kind === 'account' && descriptor.did) {
      navigation.navigate('UserProfile', { actor: descriptor.did });
      return;
    }
    const web = subjectWebUrl(subject);
    if (web) {
      void openExternalUrl(web).catch(() => {
        // Leave the report readable if the browser cannot open.
      });
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
          Loading your report…
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
          message={error || 'This report is unavailable.'}
          onRetry={load}
        />
      </ScrollView>
    );
  }

  const { report, resolution } = data;
  const action = reportActionLabel({
    status: report.status,
    lastActionTaken: resolution?.actionTaken,
    resolutionOutcome: resolution?.outcome,
  });
  const statusTone =
    report.status === 'pending'
      ? 'pending'
      : resolution?.outcome === 'actionTaken'
        ? 'warning'
        : 'muted';
  const descriptor = describeSubject(report.subject);
  const subjectCanOpen =
    descriptor.kind === 'post' || descriptor.kind === 'account';
  const decisionDescription =
    report.status === 'pending' && !resolution
      ? 'Bluesky moderation has not recorded a public decision yet.'
      : resolution?.outcome === 'noAction'
        ? 'Bluesky moderation reviewed this report and recorded that no action was taken.'
        : resolution?.outcome === 'actionTaken' || resolution?.actionTaken
          ? 'Bluesky moderation recorded an action for this report.'
          : report.status === 'resolved'
            ? 'This report is resolved. The moderation service did not return a public resolution detail.'
            : `The service returned the status “${report.status}”. Balla has not translated it into a different outcome.`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <InboxCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons
            name={
              report.status === 'pending'
                ? 'time-outline'
                : 'checkmark-circle-outline'
            }
            size={24}
            color={report.status === 'pending' ? p.accent : p.secondary}
          />
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
            {action || 'Moderation report'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <StatusPill
            label={
              report.status === 'pending'
                ? 'Pending review'
                : report.status === 'resolved'
                  ? 'Resolved'
                  : `Status: ${report.status}`
            }
            tone={statusTone}
          />
          {resolution?.scope ? (
            <StatusPill
              label={scopeLabel(resolution.scope) || resolution.scope}
              tone="muted"
            />
          ) : null}
        </View>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
          {decisionDescription}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 11 }}>
          Updated {formatModerationDateTime(report.updatedAt)}
        </Text>
      </InboxCard>

      <InboxCard title="What you reported">
        <SubjectLink
          subject={report.subject}
          record={report.record}
          onOpen={subjectCanOpen ? () => openSubject(report.subject) : undefined}
        />
        <DetailLine label="Reason" value={reportReasonLabel(report.reasonType)} />
        {report.reason ? (
          <DetailLine label="Your note" value={`“${report.reason}”`} />
        ) : null}
        <DetailLine
          label="Reported"
          value={formatModerationDateTime(report.createdAt)}
        />
        {report.accountStatus ? (
          <DetailLine
            label="Reported account"
            value={`Enforcement: ${report.accountStatus.enforcement}${
              report.accountStatus.hosting
                ? ` · Hosting: ${report.accountStatus.hosting}`
                : ''
            }`}
          />
        ) : null}
        {report.subjectStatus ? (
          <DetailLine
            label="Reported content"
            value={`${
              report.subjectStatus.takendown ? 'Taken down' : 'Not taken down'
            }${
              typeof report.subjectStatus.deleted === 'boolean'
                ? report.subjectStatus.deleted
                  ? ' · Deleted by its repository'
                  : ' · Still present in its repository'
                : ''
            }`}
          />
        ) : null}
      </InboxCard>

      <InboxCard title="Decision">
        {resolution ? (
          <>
            <DetailLine
              label="Outcome"
              value={
                resolution.outcome === 'noAction'
                  ? 'No action taken'
                  : resolution.outcome === 'actionTaken'
                    ? 'Action taken'
                    : resolution.outcome === 'other'
                      ? 'Other outcome'
                      : resolution.outcome
              }
            />
            {resolution.actionTaken ? (
              <DetailLine
                label="Action"
                value={actionLabel(resolution.actionTaken)}
              />
            ) : null}
            {resolution.scope ? (
              <DetailLine
                label="Scope"
                value={scopeLabel(resolution.scope) || resolution.scope}
              />
            ) : null}
            <DetailLine
              label="Resolved"
              value={formatModerationDateTime(resolution.resolvedAt)}
            />
          </>
        ) : report.status === 'pending' ? (
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
            No decision is available yet. Pull the inbox to refresh, or open this
            report again later.
          </Text>
        ) : (
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
            The report is marked resolved, but the service did not return a
            decision type or action. Balla will not fill that gap.
          </Text>
        )}
      </InboxCard>

      <InboxCard title="Moderation service">
        <Text style={{ color: p.text, fontSize: 13 }} selectable>
          {report.src || service}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
          Reports are stored and decided by the moderation service, not by
          Balla. Report details come from that service.
        </Text>
        <Pressable
          onPress={() =>
            void openExternalUrl(COMMUNITY_GUIDELINES).catch(() => {})
          }
          accessibilityRole="link"
          accessibilityLabel="Read the Bluesky Community Guidelines"
          style={({ pressed }) => [
            styles.linkButton,
            { borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
            Bluesky Community Guidelines
          </Text>
          <Ionicons name="open-outline" size={15} color={p.accent} />
        </Pressable>
      </InboxCard>

      <Text
        style={{
          color: p.secondary,
          fontSize: 11,
          lineHeight: 17,
          paddingHorizontal: 18,
        }}
      >
        Report ID {report.id} · {subjectLabel(report.subject)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  linkButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
