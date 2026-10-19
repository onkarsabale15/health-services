/**
 * Auth context shape — identity claims used by EHR data-service callers.
 *
 * Historically a Zod schema; in practice no consumer in the monorepo
 * runtime-validates against it, so the type alone is the contract. Kept
 * as a plain interface to drop this package's `zod` runtime dependency.
 * If a caller ever needs runtime validation, add it at that call site
 * (Ajv is already a runtime dep of this package).
 */
export interface AuthContextDto {
  organizationId: string;
  networkId: string;
  organizationType: string;
  role: string;
  email: string;
  userId: string;
  expiresAt: string;
}
