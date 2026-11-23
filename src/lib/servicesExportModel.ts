/**
 * Build an exportable snapshot of this device's service configuration (#97,
 * partial). Only non-secret facts are included: the persisted pre-auth
 * resolver choice, the default service identities, and the non-secret metadata
 * of the active OAuth session. Access tokens, refresh tokens and provider
 * message text are never read or written.
 *
 * Grant-bound audiences are exported as facts, not preferences: changing one
 * needs a fresh authorisation, so the document says so in its own notes.
 */

import type { ServicesConfig } from './servicesModel.ts';
import {
  DEFAULT_SERVICES,
  effectivePlcDirectory,
  effectiveResolver,
  isDefaultPlcDirectory,
  isDefaultResolver,
} from './servicesModel.ts';

export const SERVICES_EXPORT_SCHEMA = 'balla.services.v1';

export const SERVICES_EXPORT_NOTES = [
  'The handle resolver is read before sign-in and takes effect on the next sign-in. The did:plc directory is used for public identity reads and pre-flight checks and takes effect on the next read. Both are token-free and reversible.',
  'AppView, chat, video and labeler DIDs and audiences are written into this sign-in’s OAuth grant. They are facts here, not editable settings; changing one needs a new authorisation.',
  'The account PDS is discovered from the account’s DID document, not configured.',
  'This file contains no access token, refresh token, password or provider error text. It is a configuration record, not a credential or a backup.',
] as const;

export type SessionFacts = {
  did: string | null;
  authorizationServer: string | null;
  resourceServer: string | null;
  scopeCount: number | null;
};

export type ServicesExport = {
  schema: string;
  exportedAt: string;
  notes: string[];
  changeable: {
    handleResolver: string;
    usingDefaultResolver: boolean;
    plcDirectory: string;
    usingDefaultPlcDirectory: boolean;
  };
  defaults: typeof DEFAULT_SERVICES;
  session: {
    did: string | null;
    authorizationServer: string | null;
    resourceServer: string | null;
    scopeCount: number | null;
  };
};

function nullableText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Pure, deterministic builder. The screen injects the current time. */
export function buildServicesExport(
  config: ServicesConfig,
  session: SessionFacts | null,
  exportedAt: string,
): ServicesExport {
  return {
    schema: SERVICES_EXPORT_SCHEMA,
    exportedAt,
    notes: [...SERVICES_EXPORT_NOTES],
    changeable: {
      handleResolver: effectiveResolver(config),
      usingDefaultResolver: isDefaultResolver(config),
      plcDirectory: effectivePlcDirectory(config),
      usingDefaultPlcDirectory: isDefaultPlcDirectory(config),
    },
    defaults: { ...DEFAULT_SERVICES },
    session: {
      did: nullableText(session?.did),
      authorizationServer: nullableText(session?.authorizationServer),
      resourceServer: nullableText(session?.resourceServer),
      scopeCount:
        typeof session?.scopeCount === 'number' && Number.isSafeInteger(session.scopeCount)
          ? session.scopeCount
          : null,
    },
  };
}

/** Stable filename that never contains a DID, token or provider message. */
export function servicesExportName(): string {
  return 'balla-services-config.json';
}

/** Serialise with stable key order so the export is reproducible and diffable. */
export function serialiseServicesExport(value: ServicesExport): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
