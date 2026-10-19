import type { Bundle, Resource } from '@medplum/fhirtypes';

/**
 * Rewrites bundle pagination links and entry fullUrls so
 * they point at the internal API gateway instead of Epic's host.
 */
export function convertLinkToIb<T extends Resource>(fhirObj: Bundle<T>): Bundle<T> {
  if (fhirObj.link) {
    fhirObj.link = fhirObj.link.map((link) => ({
      ...link,
      url: getIbUrl(link.url),
    }));
  }

  if (fhirObj.entry) {
    fhirObj.entry = fhirObj.entry.map((entry) => {
      if (!entry.fullUrl || !entry.resource) return entry;
      const resourceType = entry.resource.resourceType;
      const resourceId = entry.resource.id;
      return {
        ...entry,
        fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/${resourceType}/${resourceId}`,
      };
    });
  }

  return fhirObj;
}

export function getIbUrl(upstreamUrl: string): string {
  const parts = upstreamUrl.split('/');
  const lastPart = parts.pop();
  return `${process.env.ENVIRONMENT}/api/fhir/r4/v1/${lastPart}`;
}
