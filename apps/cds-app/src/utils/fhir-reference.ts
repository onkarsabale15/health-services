/**
 * Normalize an identifier into a FHIR `Reference.reference` value. Accepts
 * either a full reference (`Practitioner/12345`, returned as-is) or a bare
 * id (`12345`, prefixed with `defaultResourceType`).
 *
 * Why both shapes happen: `ProviderSession.providerFhirId` carries the full
 * reference per the SMART id_token `fhirUser` contract, but DTO inputs and
 * patient/encounter ids on `PatientContext` are bare. Without this helper,
 * call sites that prepend `Practitioner/${...}` produce
 * `Practitioner/Practitioner/12345` for session-sourced values, which Cerner
 * (and any spec-conformant validator) rejects on FHIR write.
 */
export function toFhirReference(idOrRef: string, defaultResourceType: string): string {
  return idOrRef.includes('/') ? idOrRef : `${defaultResourceType}/${idOrRef}`;
}
