/**
 * Helper for working with EhrAccess records in admin-ui.
 *
 * Resolves the effective EHR app type ('system' | 'provider-ehr' | 'provider-standalone')
 * from an EhrAccess record. Prefers `ehrConfig.appType` (what the user picked in the dropdown)
 * over `ehrAppType` (DB column), since legacy records may have the DB column mis-set to 'system'
 * due to a historical bug where the UI never sent `ehrAppType` to the backend.
 */

export interface EhrAccessLike {
  ehrName: string;
  ehrAppType?: string;
  ehrConfig?: { appType?: string } & Record<string, unknown>;
}

/** Resolve the app type of an EHR access record. Prefers ehrConfig.appType over DB column. */
export function getEffectiveAppType(access: EhrAccessLike): string {
  return access.ehrConfig?.appType || access.ehrAppType || 'system';
}

/** Match an EHR access record by ehrName + appType. */
export function matchesEhrAndAppType(access: EhrAccessLike, ehrName: string, appType: string): boolean {
  return access.ehrName === ehrName && getEffectiveAppType(access) === appType;
}
