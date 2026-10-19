/**
 * Hierarchical cache key builder for the Health Services FHIR Bridge API.
 *
 * Keys follow the pattern:  app:{clientId}:ehr:{ehrName}:site:{siteId}:{resourceType}:{id}
 *
 * This enables pattern-based bulk invalidation via Redis SCAN:
 *   app:{clientId}:*                                          → everything for an app
 *   app:{clientId}:ehr:{ehrName}:site:{siteId}:*             → everything for an app + EHR + site
 *   app:{clientId}:ehr:{ehrName}:site:{siteId}:patient:*     → all patient data for an app + EHR + site
 *
 * These keys are an application-layer concern — they are NOT shared with other
 * packages or apps. Each app owns its own cache key strategy.
 */

export const CacheKeys = {
  appEhrConfig: (clientId: string, ehrName: string) => `app:${clientId}:ehr:${ehrName}:config`,

  platformJwks: () => 'platform:jwks:public',

  fhirResource: (clientId: string, ehrName: string, siteId: string, resourceType: string, resourceId: string) =>
    `app:${clientId}:ehr:${ehrName}:site:${siteId}:${resourceType.toLowerCase()}:${resourceId}`,

  fhirSearch: (clientId: string, ehrName: string, siteId: string, resourceType: string, queryHash: string) =>
    `app:${clientId}:ehr:${ehrName}:site:${siteId}:${resourceType.toLowerCase()}:search:${queryHash}`,

  appPattern: (clientId: string) => `app:${clientId}:*`,

  appEhrPattern: (clientId: string, ehrName: string) => `app:${clientId}:ehr:${ehrName}:*`,

  appEhrSitePattern: (clientId: string, ehrName: string, siteId: string) =>
    `app:${clientId}:ehr:${ehrName}:site:${siteId}:*`,

  appEhrSiteResourcePattern: (clientId: string, ehrName: string, siteId: string, resourceType: string) =>
    `app:${clientId}:ehr:${ehrName}:site:${siteId}:${resourceType.toLowerCase()}:*`,
} as const;
