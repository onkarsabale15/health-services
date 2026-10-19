import type { IVendorDataService } from './vendor-data-service.interface';

const registry = new Map<string, IVendorDataService>();

/** Register a vendor data service for routing. Called at app startup. */
export function registerVendorDataService(ehrName: string, service: IVendorDataService): void {
  registry.set(ehrName.toLowerCase(), service);
}

/** Get the vendor data service for routing from FHIR controllers. */
export function getVendorService(ehrName: string): IVendorDataService {
  const service = registry.get(ehrName.toLowerCase());
  if (!service) {
    throw new Error(`No vendor data service registered for: ${ehrName}`);
  }
  return service;
}
