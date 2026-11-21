import { agent } from './agent';
import {
  isCreatableListPurpose,
  recordKey,
  validateListDraft,
} from './listModel';

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

export type ListDraft = {
  name: string;
  description: string;
  purpose: string;
};

export async function loadLists(actor: string) {
  const response = await agent.app.bsky.graph.getLists({
    actor,
    limit: 100,
  });
  return response.data.lists || [];
}

export async function loadSubscribedLists() {
  const response = await agent.app.bsky.graph.getListMutes({ limit: 100 });
  return response.data.lists || [];
}

export async function loadBlockedLists() {
  const response = await agent.app.bsky.graph.getListBlocks({ limit: 100 });
  return response.data.lists || [];
}

export async function loadListPage(list: string, cursor?: string) {
  const response = await agent.app.bsky.graph.getList({
    list,
    limit: 50,
    ...(cursor ? { cursor } : {}),
  });
  return response.data;
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function waitForList(
  uri: string,
  matches: (list: any) => boolean
): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const page = await loadListPage(uri);
      if (matches(page.list)) return true;
    } catch {
      // The AppView may not have indexed the record yet.
    }
    await delay(500);
  }
  return false;
}

async function waitForListGone(uri: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await loadListPage(uri);
    } catch {
      return;
    }
    await delay(500);
  }
}

export async function loadListFeedPage(list: string, cursor?: string) {
  const response = await agent.app.bsky.feed.getListFeed({
    list,
    limit: 30,
    ...(cursor ? { cursor } : {}),
  });
  return response.data;
}

export async function loadAllListMembers(list: string) {
  const items: any[] = [];
  let cursor: string | undefined;
  do {
    const response = await agent.app.bsky.graph.getList({
      list,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...(response.data.items || []));
    const next = response.data.cursor;
    if (next === cursor) break;
    cursor = next;
  } while (cursor);
  return items;
}

export async function loadListRecord(uri: string) {
  const response = await agent.com.atproto.repo.getRecord({
    repo: signedInDid(),
    collection: 'app.bsky.graph.list',
    rkey: recordKey(uri),
  });
  return response.data.value as any;
}

export async function createList(draft: ListDraft): Promise<string> {
  const validation = validateListDraft(draft.name, draft.description);
  if (validation) throw new Error(validation);
  if (!isCreatableListPurpose(draft.purpose)) {
    throw new Error('Choose a curation or moderation list.');
  }
  const description = draft.description.trim();
  const response = await agent.com.atproto.repo.createRecord({
    repo: signedInDid(),
    collection: 'app.bsky.graph.list',
    record: {
      $type: 'app.bsky.graph.list',
      purpose: draft.purpose,
      name: draft.name.trim(),
      ...(description ? { description } : {}),
      createdAt: new Date().toISOString(),
    },
  });
  await waitForList(response.data.uri, () => true);
  return response.data.uri;
}

export async function updateListRecord(
  uri: string,
  draft: Omit<ListDraft, 'purpose'>
): Promise<void> {
  const validation = validateListDraft(draft.name, draft.description);
  if (validation) throw new Error(validation);
  const repo = signedInDid();
  const rkey = recordKey(uri);
  const existing = await loadListRecord(uri);
  const description = draft.description.trim();

  await agent.com.atproto.repo.putRecord({
    repo,
    collection: 'app.bsky.graph.list',
    rkey,
    record: {
      ...existing,
      $type: 'app.bsky.graph.list',
      name: draft.name.trim(),
      ...(description ? { description } : { description: undefined }),
    },
  });
  await waitForList(
    uri,
    (list) =>
      list?.name === draft.name.trim() &&
      (typeof list?.description === 'string' ? list.description.trim() : '') ===
        description
  );
}

async function deleteListItems(uri: string) {
  const repo = signedInDid();
  const itemUris: string[] = [];
  let cursor: string | undefined;
  do {
    const response = await agent.com.atproto.repo.listRecords({
      repo,
      collection: 'app.bsky.graph.listitem',
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const record of response.data.records || []) {
      if ((record.value as any)?.list === uri) itemUris.push(record.uri);
    }
    const next = response.data.cursor;
    if (next === cursor) break;
    cursor = next;
  } while (cursor);

  for (const itemUri of itemUris) {
    await agent.com.atproto.repo.deleteRecord({
      repo,
      collection: 'app.bsky.graph.listitem',
      rkey: recordKey(itemUri),
    });
  }
}

export async function deleteList(uri: string): Promise<void> {
  const repo = signedInDid();
  await deleteListItems(uri);
  await agent.com.atproto.repo.deleteRecord({
    repo,
    collection: 'app.bsky.graph.list',
    rkey: recordKey(uri),
  });
  await waitForListGone(uri);
}

export async function addListMember(
  list: string,
  subject: string
): Promise<string> {
  const response = await agent.com.atproto.repo.createRecord({
    repo: signedInDid(),
    collection: 'app.bsky.graph.listitem',
    record: {
      $type: 'app.bsky.graph.listitem',
      subject,
      list,
      createdAt: new Date().toISOString(),
    },
  });
  return response.data.uri;
}

export async function removeListMember(itemUri: string): Promise<void> {
  await agent.com.atproto.repo.deleteRecord({
    repo: signedInDid(),
    collection: 'app.bsky.graph.listitem',
    rkey: recordKey(itemUri),
  });
}

export async function setListSubscribed(
  list: string,
  subscribed: boolean
): Promise<void> {
  if (subscribed) {
    await agent.app.bsky.graph.muteActorList({ list });
  } else {
    await agent.app.bsky.graph.unmuteActorList({ list });
  }
}

export async function setListBlocked(
  list: string,
  blocked: boolean,
  blockedUri?: string
): Promise<string | undefined> {
  const repo = signedInDid();
  if (blocked) {
    const response = await agent.com.atproto.repo.createRecord({
      repo,
      collection: 'app.bsky.graph.listblock',
      record: {
        $type: 'app.bsky.graph.listblock',
        subject: list,
        createdAt: new Date().toISOString(),
      },
    });
    return response.data.uri;
  }

  let uri = blockedUri;
  if (!uri) {
    const response = await agent.app.bsky.graph.getListBlocks({ limit: 100 });
    uri = response.data.lists.find((item) => item.uri === list)?.viewer
      ?.blocked;
  }
  if (!uri) return undefined;

  await agent.com.atproto.repo.deleteRecord({
    repo,
    collection: 'app.bsky.graph.listblock',
    rkey: recordKey(uri),
  });
  return undefined;
}

