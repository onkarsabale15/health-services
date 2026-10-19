// Generated types from OpenAPI spec
export type { paths, components, operations } from './generated/api-types';

// Client
export { BridgeClient } from './client/bridge-client';
export type {
  BridgeClientConfig,
  FhirResourceType,
  SearchParamsFor,
  FhirBundle,
  FhirResource,
  ConnectionResponse,
} from './client/client.types';

// Spec loader (for workflow-ui runtime discovery)
export {
  getBridgeSpec,
  getFhirResourceTypes,
  getSearchParams,
  getResourceOperations,
  getAllOperations,
} from './spec/spec-loader';
export type { OpenApiSpec, SpecParameter, SpecOperation } from './spec/spec-loader';

// FHIR operations registry (auto-derived from OpenAPI spec)
export { FHIR_RESOURCES, EHR_VENDORS, getFhirResource, getFhirOperation, getAllFhirOperations } from './fhir';
export type { FhirResourceDef, FhirOperationDef, FhirParamDef } from './fhir';
