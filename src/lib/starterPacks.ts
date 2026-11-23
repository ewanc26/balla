import { agent } from './agent';
import { deleteListItems } from './lists';
import { recordKey } from './listModel';
import {
  diffStarterPackMembers,
  isRecordNotFoundError,
  parseStarterPackListUri,
  parseStarterPackUri,
  starterPackListItemRecord,
  starterPackListRecord,
  starterPackRecord,
  validateStarterPackDraft,
} from './starterPackModel';

export type StarterPackDraft = {
  name: string;
  description: string;
  members: string[];
  feeds: string[];
};

export type EditableStarterPack = {
  uri: string;
  record: any;
  listUri: string;
  members: Array<{ did: string; uri: string; profile: any }>;
  feeds: string[];
};

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

/** Loads every followed account for the member picker, following real cursors. */
export async function loadFollowsForPicker() {
  const repo = signedInDid();
  const actors: any[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  do {
    const response = await agent.app.bsky.graph.getFollows({
      actor: repo,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    actors.push(...(response.data.follows || []));
    const next = response.data.cursor;
    if (!next || seenCursors.has(next)) break;
    seenCursors.add(next);
    cursor = next;
  } while (cursor);

  return actors;
}

async function loadStarterPackMembers(
  list: string
): Promise<EditableStarterPack['members']> {
  const members: EditableStarterPack['members'] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  do {
    const response = await agent.app.bsky.graph.getList({
      list,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const item of response.data.items || []) {
      if (!item?.subject?.did || !item?.uri) continue;
      members.push({
        did: item.subject.did,
        uri: item.uri,
        profile: item.subject,
      });
    }
    const next = response.data.cursor;
    if (!next || seenCursors.has(next)) break;
    seenCursors.add(next);
    cursor = next;
  } while (cursor);

  return members;
}

/**
 * Reads both the AppView view and the owner's records. The view supplies the
 * creator and list reference; the PDS records supply the exact original record
 * and createdAt needed for a put.
 */
export async function loadEditableStarterPack(
  uri: string
): Promise<EditableStarterPack> {
  const parsed = parseStarterPackUri(uri);
  if (!parsed) throw new Error('This starter pack has no valid address.');
  const repo = signedInDid();

  const view = await agent.app.bsky.graph.getStarterPack({ starterPack: uri });
  const pack = view.data.starterPack;
  if (pack?.creator?.did !== repo) {
    throw new Error('You can only edit a starter pack you created.');
  }

  const stored = await agent.app.bsky.graph.starterpack.get({
    repo,
    rkey: parsed.rkey,
  });
  const record = stored.value as any;
  const listUri =
    typeof record?.list === 'string' ? record.list : pack?.list?.uri;
  if (typeof listUri !== 'string' || !listUri) {
    throw new Error('This starter pack has no member list.');
  }

  const members = await loadStarterPackMembers(listUri);
  const feeds = Array.isArray(record?.feeds)
    ? record.feeds
        .map((item: any) => (typeof item?.uri === 'string' ? item.uri : ''))
        .filter(Boolean)
    : [];

  return { uri, record, listUri, members, feeds };
}

async function writeListItems(
  repo: string,
  list: string,
  current: EditableStarterPack['members'],
  nextMembers: string[]
) {
  const { added, removed } = diffStarterPackMembers(
    current.map((member) => member.did),
    nextMembers
  );

  for (const did of removed) {
    const item = current.find((member) => member.did === did);
    if (!item) continue;
    await agent.app.bsky.graph.listitem.delete({
      repo,
      rkey: recordKey(item.uri),
    });
  }

  const createdAt = new Date().toISOString();
  for (const did of added) {
    await agent.app.bsky.graph.listitem.create(
      { repo },
      starterPackListItemRecord(did, list, createdAt)
    );
  }
}

export async function createStarterPack(
  draft: StarterPackDraft
): Promise<string> {
  const validation = validateStarterPackDraft(draft.name, draft.description);
  if (validation) throw new Error(validation);
  const repo = signedInDid();
  const createdAt = new Date().toISOString();

  const list = await agent.app.bsky.graph.list.create(
    { repo },
    starterPackListRecord(draft.name, draft.description, createdAt)
  );

  for (const member of draft.members) {
    await agent.app.bsky.graph.listitem.create(
      { repo },
      starterPackListItemRecord(member, list.uri, createdAt)
    );
  }

  const starterPack = await agent.app.bsky.graph.starterpack.create(
    { repo },
    starterPackRecord({
      name: draft.name,
      description: draft.description,
      list: list.uri,
      feeds: draft.feeds,
      createdAt,
    })
  );
  return starterPack.uri;
}

export async function updateStarterPack(
  existing: EditableStarterPack,
  draft: StarterPackDraft
): Promise<string> {
  const validation = validateStarterPackDraft(draft.name, draft.description);
  if (validation) throw new Error(validation);
  const repo = signedInDid();
  const parsed = parseStarterPackUri(existing.uri);
  if (!parsed) throw new Error('This starter pack has no valid address.');

  const listStored = await agent.app.bsky.graph.list.get({
    repo,
    rkey: recordKey(existing.listUri),
  });
  const listRecord = listStored.value as any;

  await agent.app.bsky.graph.list.put(
    { repo, rkey: recordKey(existing.listUri) },
    {
      ...listRecord,
      ...starterPackListRecord(
        draft.name,
        draft.description,
        typeof listRecord?.createdAt === 'string'
          ? listRecord.createdAt
          : new Date().toISOString()
      ),
    }
  );

  await writeListItems(repo, existing.listUri, existing.members, draft.members);

  await agent.app.bsky.graph.starterpack.put(
    { repo, rkey: parsed.rkey },
    starterPackRecord({
      name: draft.name,
      description: draft.description,
      list: existing.listUri,
      feeds: draft.feeds,
      createdAt:
        typeof existing.record?.createdAt === 'string'
          ? existing.record.createdAt
          : new Date().toISOString(),
    })
  );

  return existing.uri;
}

/**
 * Deletes a pack the signed-in account owns, then its private reference list.
 * The list goes first, matching Bluesky's official client; a retry after a
 * partial failure tolerates the list already being gone.
 */
export async function deleteStarterPack(
  uri: string,
  listUri?: string | null
): Promise<void> {
  const parsed = parseStarterPackUri(uri);
  if (!parsed) throw new Error('This starter pack has no valid address.');
  const repo = signedInDid();
  if (parsed.did !== repo) {
    throw new Error('You can only delete a starter pack you created.');
  }

  if (listUri) {
    const list = parseStarterPackListUri(listUri);
    if (!list || list.did !== repo) {
      throw new Error('This starter pack has no removable reference list.');
    }
    await deleteListItems(listUri);
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo,
        collection: 'app.bsky.graph.list',
        rkey: list.rkey,
      });
    } catch (error) {
      if (!isRecordNotFoundError(error)) throw error;
    }
  }

  await agent.com.atproto.repo.deleteRecord({
    repo,
    collection: 'app.bsky.graph.starterpack',
    rkey: parsed.rkey,
  });
}
