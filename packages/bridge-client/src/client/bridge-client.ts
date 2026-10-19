import { httpClient } from '@hs/infra';
import type {
  BridgeClientConfig,
  FhirResourceType,
  SearchParamsFor,
  FhirBundle,
  FhirResource,
  ConnectionResponse,
} from './client.types';

/**
 * Typed client for Bridge API.
 *
 * Wraps @hs/http-client with type-safe methods derived from the OpenAPI spec.
 * Auth is injected via getToken (DIP) — each consumer provides its own strategy.
 *
 * Two FHIR call patterns:
 * - X-Session-Id: SMART-launched apps (session from Redis)
 * - X-Site-Id: system apps (site from admin-api)
 */
export class BridgeClient {
  constructor(private readonly config: BridgeClientConfig) {}

  // ── Connection ──────────────────────────────────────────────

  /** Create an OAuth connection to an EHR */
  async createConnection(body: { ehrName: string; code?: string }): Promise<ConnectionResponse> {
    return this.request<ConnectionResponse>({
      method: 'post',
      path: '/v1/Connection',
      data: body,
    });
  }

  /** Get connection details */
  async getConnection(connectionId: string): Promise<ConnectionResponse> {
    return this.request<ConnectionResponse>({
      method: 'get',
      path: '/v1/Connection',
      headers: { connectionid: connectionId },
    });
  }

  /** Delete/revoke a connection */
  async deleteConnection(connectionId: string): Promise<void> {
    await this.request({
      method: 'delete',
      path: '/v1/Connection',
      headers: { connectionid: connectionId },
    });
  }

  // ── FHIR (X-Session-Id — SMART launched apps) ───────────────

  /** Search FHIR resources using a SMART session */
  async searchFhir<R extends FhirResourceType>(
    sessionId: string,
    resourceType: R,
    params?: SearchParamsFor<R>,
  ): Promise<FhirBundle> {
    if (!sessionId) throw new Error('sessionId is required for FHIR search');
    return this.request<FhirBundle>({
      method: 'get',
      path: `/fhir/r4/v1/${resourceType}`,
      params: params as Record<string, string> | undefined,
      headers: { 'X-Session-Id': sessionId },
    });
  }

  /**
   * Read a single FHIR resource by ID using a SMART session.
   *
   * Pass `options.headers` to opt into bridge's HTTP cache layer:
   *   `Cache-Control: max-age=N` → cache for N seconds (cache key is
   *   `app:{clientId}:ehr:{ehrName}:site:{siteId}:{resourceType}:{id}` —
   *   site-scoped, won't poison across sites under the same app).
   *   `If-None-Match: "<etag>"` → conditional request, 304 on match.
   * Default (no headers) = no caching, every call hits the EHR.
   */
  async readFhir(
    sessionId: string,
    resourceType: FhirResourceType,
    id: string,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    if (!sessionId) throw new Error('sessionId is required for FHIR read');
    return this.request<FhirResource>({
      method: 'get',
      path: `/fhir/r4/v1/${resourceType}/${id}`,
      headers: { 'X-Session-Id': sessionId, ...(options?.headers ?? {}) },
    });
  }

  /** Create a FHIR resource using a SMART session */
  async createFhir(
    sessionId: string,
    resourceType: FhirResourceType,
    body: Record<string, unknown>,
  ): Promise<FhirResource> {
    if (!sessionId) throw new Error('sessionId is required for FHIR create');
    return this.request<FhirResource>({
      method: 'post',
      path: `/fhir/r4/v1/${resourceType}`,
      data: body,
      headers: { 'X-Session-Id': sessionId },
    });
  }

  /**
   * Update a FHIR resource using a SMART session.
   *
   * Pass `options.headers.If-Match: W/"<versionId>"` for optimistic
   * concurrency — required by Cerner Millennium per its R4 docs;
   * other vendors are typically permissive but it's good practice.
   */
  async updateFhir(
    sessionId: string,
    resourceType: FhirResourceType,
    id: string,
    body: Record<string, unknown>,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    if (!sessionId) throw new Error('sessionId is required for FHIR update');
    return this.request<FhirResource>({
      method: 'put',
      path: `/fhir/r4/v1/${resourceType}/${id}`,
      data: body,
      headers: { 'X-Session-Id': sessionId, ...(options?.headers ?? {}) },
    });
  }

  // ── FHIR (X-Site-Id — system apps) ─────────────────────────

  /** Search FHIR resources using a site ID */
  async searchFhirBySite<R extends FhirResourceType>(
    siteId: string,
    resourceType: R,
    params?: SearchParamsFor<R>,
  ): Promise<FhirBundle> {
    if (!siteId) throw new Error('siteId is required for FHIR search');
    return this.request<FhirBundle>({
      method: 'get',
      path: `/fhir/r4/v1/${resourceType}`,
      params: params as Record<string, string> | undefined,
      headers: { 'X-Site-Id': siteId },
    });
  }

  /**
   * Read a single FHIR resource by ID using a site ID.
   *
   * Pass `options.headers` to opt into bridge's HTTP cache layer — see
   * `readFhir` for cache-key details.
   */
  async readFhirBySite(
    siteId: string,
    resourceType: FhirResourceType,
    id: string,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    if (!siteId) throw new Error('siteId is required for FHIR read');
    return this.request<FhirResource>({
      method: 'get',
      path: `/fhir/r4/v1/${resourceType}/${id}`,
      headers: { 'X-Site-Id': siteId, ...(options?.headers ?? {}) },
    });
  }

  /** Create a FHIR resource using a site ID (system apps) */
  async createFhirBySite(
    siteId: string,
    resourceType: FhirResourceType,
    body: Record<string, unknown>,
  ): Promise<FhirResource> {
    if (!siteId) throw new Error('siteId is required for FHIR create');
    return this.request<FhirResource>({
      method: 'post',
      path: `/fhir/r4/v1/${resourceType}`,
      data: body,
      headers: { 'X-Site-Id': siteId },
    });
  }

  /** Update a FHIR resource using a site ID (system apps). See `updateFhir` for `options.headers`. */
  async updateFhirBySite(
    siteId: string,
    resourceType: FhirResourceType,
    id: string,
    body: Record<string, unknown>,
    options?: { headers?: Record<string, string> },
  ): Promise<FhirResource> {
    if (!siteId) throw new Error('siteId is required for FHIR update');
    return this.request<FhirResource>({
      method: 'put',
      path: `/fhir/r4/v1/${resourceType}/${id}`,
      data: body,
      headers: { 'X-Site-Id': siteId, ...(options?.headers ?? {}) },
    });
  }

  // ── SMART Launch ────────────────────────────────────────────

  /** Exchange a one-time SMART launch code for connection data */
  async exchangeSmartCode(code: string): Promise<ConnectionResponse> {
    return this.request<ConnectionResponse>({
      method: 'post',
      path: '/v1/smart/token',
      data: { code },
    });
  }

  // ── Metadata ────────────────────────────────────────────────

  /** Get FHIR CapabilityStatement */
  async getMetadata(sessionOrSiteId: string, useSiteId = false): Promise<FhirResource> {
    return this.request<FhirResource>({
      method: 'get',
      path: '/fhir/r4/v1/metadata',
      headers: useSiteId ? { 'X-Site-Id': sessionOrSiteId } : { 'X-Session-Id': sessionOrSiteId },
    });
  }

  // ── Internal ────────────────────────────────────────────────

  private async request<T = unknown>(options: {
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    params?: Record<string, string>;
    data?: unknown;
    headers?: Record<string, string>;
  }): Promise<T> {
    const token = await this.config.getToken();

    const response = await httpClient.request<T>({
      url: `${this.config.baseUrl}${options.path}`,
      method: options.method,
      params: options.params,
      data: options.data,
      headers: options.headers,
      authType: 'Bearer',
      authToken: token,
    });

    return response.data;
  }
}
