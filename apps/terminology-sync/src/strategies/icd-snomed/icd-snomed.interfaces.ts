// ─── Snowstorm API Types ──────────────────────────────────────────────────────
// Types for the SNOMED CT Snowstorm terminology server.
// These map directly to the Snowstorm REST API response shapes.

/** Paginated response from GET /{branch}/members */
export interface SnowstormMemberResponse {
  items: SnowstormMember[];
  total: number;
  limit: number;
  offset: number;
  searchAfter: string | string[];
  searchAfterArray: string[];
}

/** A single reference set member record */
export interface SnowstormMember {
  memberId: string;
  active: boolean;
  moduleId: string;
  effectiveTime: string;
  released: boolean;
  releasedEffectiveTime: number;
  refsetId: string;
  referencedComponentId: string;
  referencedComponent: SnowstormReferencedComponent;
  additionalFields: SnowstormAdditionalFields;
}

/** SNOMED concept referenced by a map member */
export interface SnowstormReferencedComponent {
  conceptId: string;
  active: boolean;
  definitionStatus: string;
  moduleId: string;
  effectiveTime: string;
  pt: SnowstormTerm;
  fsn: SnowstormTerm;
}

/** Preferred/FSN term descriptor */
export interface SnowstormTerm {
  term: string;
  lang: string;
}

/** Extended map additional fields (ICD-10 refset 447562003) */
export interface SnowstormAdditionalFields {
  mapTarget: string;
  mapGroup: string;
  mapPriority: string;
  mapRule: string;
  mapAdvice: string;
  mapCategoryId: string;
  correlationId: string;
}
