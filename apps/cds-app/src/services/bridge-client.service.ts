import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BridgeClient,
  type FhirBundle,
  type FhirResource,
  type FhirResourceType,
  type SearchParamsFor,
} from '@hs/bridge-client';
import { PlatformTokenService } from './platform-token.service';

// ─── Bridge FHIR Client ──────────────────────────────────────────────────────
//
// Thin wrapper around `@hs/bridge-client`'s `BridgeClient` for FHIR operations.
// Strictly scoped to FHIR — non-FHIR bridge endpoints (terminology, admin)
// live in their own dedicated services so this class stays focused on one
// concern.
//
// The wrapper accepts a string `resourceType` for ergonomic CDS usage —
// downstream providers build it dynamically. The single narrowing point is
// here: we cast once to `FhirResourceType` and once to `SearchParamsFor<R>`,
// trading the strict per-resource-param type for a uniform `Record<string,
// string>`. Bridge re-validates at call time, so invalid resource types are
// caught as runtime FHIR errors rather than silently accepted.

type SearchParams = Record<string, string>;

@Injectable()
export class BridgeClientService {
  private client: BridgeClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: PlatformTokenService,
  ) {}

  // ── Session-based (X-Session-Id — EHR launch / provider standalone) ────

  searchFhir(bridgeSessionId: string, resourceType: string, params: SearchParams): Promise<FhirBundle> {
    return this.client$.searchFhir(
      bridgeSessionId,
      resourceType as FhirResourceType,
      params as SearchParamsFor<FhirResourceType>,
    );
  }

  readFhir(
    bridgeSessionId: string,
    resourceType: string,
    id: string,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    return this.client$.readFhir(bridgeSessionId, resourceType as FhirResourceType, id, options);
  }

  createFhir(bridgeSessionId: string, resourceType: string, body: Record<string, unknown>): Promise<FhirResource> {
    return this.client$.createFhir(bridgeSessionId, resourceType as FhirResourceType, body);
  }

  updateFhir(
    bridgeSessionId: string,
    resourceType: string,
    id: string,
    body: Record<string, unknown>,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    return this.client$.updateFhir(bridgeSessionId, resourceType as FhirResourceType, id, body, options);
  }

  // ── Site-based (X-Site-Id — system mode) ───────────────────────────────

  searchFhirBySite(siteId: string, resourceType: string, params: SearchParams): Promise<FhirBundle> {
    return this.client$.searchFhirBySite(
      siteId,
      resourceType as FhirResourceType,
      params as SearchParamsFor<FhirResourceType>,
    );
  }

  readFhirBySite(
    siteId: string,
    resourceType: string,
    id: string,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    return this.client$.readFhirBySite(siteId, resourceType as FhirResourceType, id, options);
  }

  createFhirBySite(siteId: string, resourceType: string, body: Record<string, unknown>): Promise<FhirResource> {
    return this.client$.createFhirBySite(siteId, resourceType as FhirResourceType, body);
  }

  updateFhirBySite(
    siteId: string,
    resourceType: string,
    id: string,
    body: Record<string, unknown>,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    return this.client$.updateFhirBySite(siteId, resourceType as FhirResourceType, id, body, options);
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private get client$(): BridgeClient {
    if (!this.client) {
      this.client = new BridgeClient({
        baseUrl: this.config.get<string>('app.bridgeApiUrl')!,
        getToken: () => this.tokens.getToken(),
      });
    }
    return this.client;
  }
}
