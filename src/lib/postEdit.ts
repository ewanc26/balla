import { agent } from './agent';
import { buildEditWrites } from './postEditModel';

/**
 * Writes the one allowed edit as a single atomic applyWrites: delete the old
 * record and create the replacement at the same rkey. The existing grant
 * already carries repo:app.bsky.feed.post?action=create&action=delete, so this
 * path adds no OAuth scope and no stored permission.
 */
export async function savePostEdit(
  uri: string,
  record: any,
  text: string,
  facets: any[] | undefined
): Promise<Record<string, any>> {
  if (!agent.did) throw new Error('Sign in to edit a post.');
  const updatedAt = new Date().toISOString();
  const { record: replacement, writes } = buildEditWrites(
    uri,
    record,
    text,
    facets,
    updatedAt
  );
  await agent.com.atproto.repo.applyWrites({
    repo: agent.did,
    validate: true,
    writes: writes as any,
  });
  return replacement;
}
