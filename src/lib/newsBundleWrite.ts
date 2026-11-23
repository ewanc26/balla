import { TID } from '@atproto/common-web';
import { agent } from './agent';
import { CURATE_LIST } from './listModel';
import type { NewsPublisher } from './newsBundles';

/**
 * One bundle is one atomic applyWrites: the curation list record and every
 * list-item record are created together, so a failed write cannot leave a
 * half-filled bundle on the account. The existing grant already carries
 * repo:app.bsky.graph.list and repo:app.bsky.graph.listitem create
 * permissions, so this path adds no OAuth scope.
 *
 * The bundle is a list, not a follow. No follow, like, block or mute record is
 * written here, and no feed preference changes.
 */
export async function createNewsBundle(
  name: string,
  description: string,
  publishers: NewsPublisher[]
): Promise<string> {
  if (!agent.did) throw new Error('Sign in to add a news bundle.');
  if (!name.trim()) throw new Error('This bundle has no name.');
  if (publishers.length === 0) {
    throw new Error('This bundle has no publisher accounts yet.');
  }
  // applyWrites allows 200 records per call. The published pack is far below
  // it, but fail honestly rather than sending a truncated roster.
  if (publishers.length > 199) {
    throw new Error('This bundle is too large to add in one write.');
  }

  const createdAt = new Date().toISOString();
  const listRkey = TID.nextStr();
  const listUri = `at://${agent.did}/app.bsky.graph.list/${listRkey}`;

  const writes = [
    {
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.list',
      rkey: listRkey,
      value: {
        $type: 'app.bsky.graph.list',
        purpose: CURATE_LIST,
        name: name.trim(),
        description: description.trim(),
        createdAt,
      },
    },
    ...publishers.map((publisher) => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.listitem',
      rkey: TID.nextStr(),
      value: {
        $type: 'app.bsky.graph.listitem',
        subject: publisher.did,
        list: listUri,
        createdAt,
      },
    })),
  ];

  await agent.com.atproto.repo.applyWrites({
    repo: agent.did,
    validate: true,
    writes: writes as any,
  });

  return listUri;
}
