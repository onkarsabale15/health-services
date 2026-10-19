export * from './connection.dto';
export * from './health.dto';

// Re-export FHIR response types for non-FHIR modules (e.g. connection controller)
export { OperationOutcomeResponse, FhirBundleResponse, FhirResourceResponse } from '../modules/fhir/dto';
