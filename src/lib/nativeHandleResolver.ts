import {
  XrpcHandleResolver,
  isResolvedHandle,
  type HandleResolver,
  type ResolveHandleOptions,
  type ResolvedHandle,
} from '@atproto/oauth-client-expo';
import { getHandleResolverEndpoint } from './servicesConfig.ts';
import { didFromWellKnown, wellKnownUrl } from './hostingModel.ts';

/**
 * Protocol-native handle resolution for sign-in. The AT Protocol resolves a
 * handle from its own host (`/.well-known/atproto-did`) or DNS, not from one
 * operator's XRPC server. Try the host's well-known file first so an account
 * on an independent PDS resolves without asking Bluesky, then fall back to
 * the configured XRPC resolver for handles published only through DNS or a
 * directory. No new scope or dependency: these are public, unauthenticated
 * reads and the resolver classes ship with the installed OAuth client.
 *
 * The fallback is created per resolution from the persisted endpoint, so a
 * change in Advanced → Services takes effect on the very next sign-in without
 * a restart and without touching a signed-in OAuth session.
 */
export type HandleResolverFactory = () => Promise<HandleResolver>;

export class NativeFirstHandleResolver implements HandleResolver {
  constructor(private readonly fallback: HandleResolverFactory) {}

  async resolve(handle: string, options?: ResolveHandleOptions): Promise<ResolvedHandle> {
    const url = wellKnownUrl(handle);
    if (url) {
      try {
        const response = await fetch(url, {
          cache: options?.noCache ? 'no-cache' : undefined,
          signal: options?.signal,
          redirect: 'error',
        });
        if (response.ok) {
          const did = didFromWellKnown(await response.text());
          // isResolvedHandle(null) is true in the SDK (null is a valid "not
          // found" result), so check for a DID explicitly before returning:
          // a host serving HTML here must still fall back to the resolver.
          if (did !== null && isResolvedHandle(did)) return did;
        }
      } catch (err) {
        // An aborted sign-in must stay aborted rather than silently falling
        // through to a second network path.
        if (options?.signal?.aborted) throw err;
        // Any other failure is an ordinary "no well-known file here" case:
        // let the configured resolver try its own strategies.
      }
    }
    const resolver = await this.fallback();
    return resolver.resolve(handle, options);
  }
}

/** Compose the native-first resolver over the configurable XRPC fallback. */
export function createNativeFirstHandleResolver(service: string): HandleResolver {
  return new NativeFirstHandleResolver(async () => {
    const endpoint = await getHandleResolverEndpoint(service);
    return new XrpcHandleResolver(endpoint);
  });
}
