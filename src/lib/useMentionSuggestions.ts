import { useEffect, useRef, useState } from 'react';
import { agent } from './agent';
import {
  activeMentionQuery,
  mentionActors,
  type ActiveMention,
  type MentionActor,
  type MentionStatus,
  type TextSelection,
} from './mentionSuggestions';

export type MentionSuggestionsState = {
  activeMention: ActiveMention | null;
  query: string;
  status: MentionStatus;
  results: MentionActor[];
};

/**
 * Shared mention search for the post and reply composers. The screen owns the
 * text and selection; this hook owns debouncing, request ordering and the
 * visible loading, empty and failure states.
 */
export function useMentionSuggestions(
  text: string,
  selection: TextSelection,
  enabled = true
): MentionSuggestionsState {
  const [status, setStatus] = useState<MentionStatus>('loading');
  const [results, setResults] = useState<MentionActor[]>([]);
  const request = useRef(0);

  const activeMention = activeMentionQuery(text, selection);
  const query =
    activeMention && activeMention.query.trim().length >= 2
      ? activeMention.query.trim()
      : '';
  const key = activeMention
    ? `${activeMention.start}:${activeMention.end}:${activeMention.query}`
    : '';

  useEffect(() => {
    // Search only after a short pause, and ignore any response that belongs to
    // an older query. A stale result must never replace the current token.
    const mention = activeMentionQuery(text, selection);
    const requestId = request.current + 1;
    request.current = requestId;

    if (!enabled || !mention || mention.query.trim().length < 2) {
      setResults([]);
      setStatus('loading');
      return;
    }

    setResults([]);
    setStatus('loading');
    const timer = setTimeout(() => {
      void agent
        .searchActors({ q: mention.query.trim(), limit: 6 })
        .then((response) => {
          if (request.current !== requestId) return;
          setResults(mentionActors(response?.data?.actors));
          setStatus('ready');
        })
        .catch(() => {
          if (request.current !== requestId) return;
          setResults([]);
          setStatus('error');
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      if (request.current === requestId) request.current += 1;
    };
  }, [key, enabled]);

  return { activeMention, query, status, results };
}
