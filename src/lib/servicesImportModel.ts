/**
 * Restore the non-secret service configuration record exported by
 * Advanced → Services (#97, partial). The importer is deliberately strict: it
 * reads only the schema marker and the three changeable public hosts plus the
 * places switch. Session facts, grant-bound service facts, notes and any other
 * text in the record are ignored, and a bad record changes nothing.
 *
 * Provider prose is never surfaced: one fixed Balla message covers every
 * rejection, so a hostile or broken record cannot inject wording into the UI.
 */

import { normaliseHostUrl } from './hostingModel.ts';
import { SERVICES_EXPORT_SCHEMA } from './servicesExportModel.ts';
import {
  DEFAULT_SERVICES,
  effectivePlaces,
  effectivePlcDirectory,
  effectiveResolver,
  isPlacesEnabled,
  type ServicesConfig,
} from './servicesModel.ts';

/** Fixed, provider-neutral copy for every rejected record. */
export const SERVICES_IMPORT_INVALID_DETAIL =
  'This record is not a valid Balla service configuration. Nothing changed.';

export const SERVICES_IMPORT_MAX_CHARS = 64_000;

export type ServicesImportResult =
  | { state: 'ok'; config: ServicesConfig }
  | { state: 'invalid'; detail: string };

type HostParse =
  | { ok: true; value: string | null }
  | { ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The export stores effective hosts plus a default marker. Treat the marker as
 * authoritative so a stale host cannot masquerade as the compiled default, and
 * reject a custom marker paired with the default host (which the exporter never
 * produces).
 */
function parseHost(
  value: unknown,
  fallback: string,
  usingDefault: unknown,
): HostParse {
  if (typeof usingDefault !== 'boolean') return { ok: false };
  if (usingDefault) {
    return typeof value === 'string' && normaliseHostUrl(value) === fallback
      ? { ok: true, value: null }
      : { ok: false };
  }
  if (typeof value !== 'string') return { ok: false };
  const host = normaliseHostUrl(value);
  if (!host || host === fallback) return { ok: false };
  return { ok: true, value: host };
}

/** Pure, deterministic parse. It performs no I/O and returns no input prose. */
export function parseServicesImport(text: string): ServicesImportResult {
  if (typeof text !== 'string' || !text.trim() || text.length > SERVICES_IMPORT_MAX_CHARS) {
    return { state: 'invalid', detail: SERVICES_IMPORT_INVALID_DETAIL };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: 'invalid', detail: SERVICES_IMPORT_INVALID_DETAIL };
  }
  if (!isRecord(parsed) || parsed.schema !== SERVICES_EXPORT_SCHEMA) {
    return { state: 'invalid', detail: SERVICES_IMPORT_INVALID_DETAIL };
  }

  const changeable = parsed.changeable;
  if (!isRecord(changeable)) {
    return { state: 'invalid', detail: SERVICES_IMPORT_INVALID_DETAIL };
  }
  const resolver = parseHost(
    changeable.handleResolver,
    DEFAULT_SERVICES.handleResolver,
    changeable.usingDefaultResolver,
  );
  const directory = parseHost(
    changeable.plcDirectory,
    DEFAULT_SERVICES.plcDirectory,
    changeable.usingDefaultPlcDirectory,
  );
  const places = parseHost(
    changeable.places,
    DEFAULT_SERVICES.places,
    changeable.usingDefaultPlaces,
  );
  if (!resolver.ok || !directory.ok || !places.ok || typeof changeable.placesEnabled !== 'boolean') {
    return { state: 'invalid', detail: SERVICES_IMPORT_INVALID_DETAIL };
  }

  return {
    state: 'ok',
    config: {
      handleResolver: resolver.value,
      plcDirectory: directory.value,
      places: places.value,
      placesEnabled: changeable.placesEnabled,
    },
  };
}

export type ServicesImportChange = {
  label: string;
  from: string;
  to: string;
};

export type ServicesImportPreview = {
  config: ServicesConfig;
  changes: ServicesImportChange[];
};

const PREVIEW_LABELS = {
  handleResolver: 'Handle resolver',
  plcDirectory: 'PLC directory',
  places: 'Places provider',
  placesEnabled: 'Places search',
} as const;

/**
 * Compare two validated configurations using only effective, already-normalised
 * values. This function never sees the exported record, so notes or hostile
 * provider text cannot reach the preview.
 */
export function previewServicesImport(
  current: ServicesConfig,
  next: ServicesConfig,
): ServicesImportPreview {
  const candidate: ServicesImportChange[] = [
    {
      label: PREVIEW_LABELS.handleResolver,
      from: effectiveResolver(current),
      to: effectiveResolver(next),
    },
    {
      label: PREVIEW_LABELS.plcDirectory,
      from: effectivePlcDirectory(current),
      to: effectivePlcDirectory(next),
    },
    {
      label: PREVIEW_LABELS.places,
      from: effectivePlaces(current),
      to: effectivePlaces(next),
    },
    {
      label: PREVIEW_LABELS.placesEnabled,
      from: isPlacesEnabled(current) ? 'On' : 'Off',
      to: isPlacesEnabled(next) ? 'On' : 'Off',
    },
  ];
  return {
    config: next,
    changes: candidate.filter((change) => change.from !== change.to),
  };
}
