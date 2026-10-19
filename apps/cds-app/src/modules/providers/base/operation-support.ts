import type { OperationSupport } from '../capabilities/capability.types';

/**
 * Marks a write operation as "supported by the EHR but not yet declared in
 * this provider" — i.e. the write surface exists at the bridge / FHIR layer
 * but the per-vendor capability rules and FE form haven't been wired up yet.
 *
 * Used by Phase-0 baseline providers (Athena / DrChrono / Elation) so the FE
 * sees a consistent "not yet" reason instead of a vendor-specific limitation.
 * Cerner does NOT use this helper — its `condition.write` is fully shipped
 * and `allergy.write` / `observation.write` have different reasons (FE form
 * stub vs. EHR limitation).
 */
export function notReadyForVendor(resource: string, vendorName: string): OperationSupport {
  return {
    supported: false,
    reason: `${resource} write surface not yet declared for ${vendorName}`,
  };
}
