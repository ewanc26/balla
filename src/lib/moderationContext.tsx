import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LABEL_SETTINGS,
  moderatePost,
  type InterpretedLabelValueDefinition,
  type ModerationDecision,
  type ModerationOpts,
  type ModerationPrefs,
} from '@atproto/api';
import { agent } from './agent';
import { BSKY_LABELER_DID } from './moderation';

// This is deliberately the same preference shape the official client feeds
// into @atproto/api. The API's moderation helpers understand the built-in
// labels even before the labeler definitions have loaded.
const FALLBACK_PREFS: ModerationPrefs = {
  adultContentEnabled: false,
  labels: { ...DEFAULT_LABEL_SETTINGS },
  labelers: [{ did: BSKY_LABELER_DID, labels: {} }],
  mutedWords: [],
  hiddenPosts: [],
};

type ModerationContextValue = {
  opts: ModerationOpts;
  ready: boolean;
  reload: () => void;
  labelers: Record<string, string>;
};

const ModerationContext = createContext<ModerationContextValue>({
  opts: { userDid: undefined, prefs: FALLBACK_PREFS },
  ready: false,
  reload: () => {},
  labelers: {},
});

export function ModerationProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ModerationOpts>({
    userDid: agent.did,
    prefs: FALLBACK_PREFS,
  });
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [labelers, setLabelers] = useState<Record<string, string>>({});

  useEffect(() => {
    const did = agent.did;
    if (!did) return;
    let active = true;

    (async () => {
      try {
        const prefs = await agent.getPreferences();
        let labelDefs: Record<string, InterpretedLabelValueDefinition[]> = {};
        try {
          labelDefs = await agent.getLabelDefinitions(prefs);
        } catch {
          // A labeler outage must not make the timeline unreadable. Built-in
          // labels still work with the fallback definitions.
        }
        if (!active) return;

        // Agent already sends the Bluesky labeler with `;redact`. Add the
        // account's subscribed labelers here so the AppView hydrates their
        // labels as well.
        agent.configureLabelers(
          prefs.moderationPrefs.labelers
            .map((labeler) => labeler.did)
            .filter((labelerDid) => labelerDid !== BSKY_LABELER_DID)
        );

        // Human-readable labeler names for warning cards. A service outage
        // falls back to the Bluesky name or a generic source line.
        const names: Record<string, string> = {};
        try {
          const services = await agent.getLabelers({
            dids: prefs.moderationPrefs.labelers.map((labeler) => labeler.did),
            detailed: true,
          });
          for (const item of services.data.views || []) {
            const view: any = item;
            const did = view.creator?.did;
            if (did) {
              names[did] =
                view.creator?.displayName || view.creator?.handle || did;
            }
          }
        } catch {
          // Names are optional; labels still render.
        }
        names[BSKY_LABELER_DID] = names[BSKY_LABELER_DID] || 'Bluesky moderation';
        if (active) setLabelers(names);
        setOpts({
          userDid: did,
          prefs: prefs.moderationPrefs,
          labelDefs,
        });
      } catch {
        // Keep the built-in label settings; the user can still browse.
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return (
    <ModerationContext.Provider value={{ opts, ready, reload, labelers }}>
      {children}
    </ModerationContext.Provider>
  );
}

export function useModeration(): ModerationContextValue {
  return useContext(ModerationContext);
}

export function usePostModeration(post: any): ModerationDecision | null {
  const { opts } = useModeration();
  return useMemo(() => {
    if (!post) return null;
    try {
      return moderatePost(post, opts);
    } catch {
      return null;
    }
  }, [post, opts]);
}
