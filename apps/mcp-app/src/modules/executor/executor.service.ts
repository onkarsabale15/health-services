import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ehrFactory } from '@hs/ehr-data-service';
import { logger } from '@hs/observability';
import { CatalogService } from '../catalog/catalog.service';
import { SessionContextService } from './session-context.service';

/**
 * Per-session context for a tool call.
 * Built by the transport layer (stdio runner / HTTP controller) from the
 * authenticated session — the LLM does not supply these fields.
 *
 * Note: `ehrName` is NOT in this shape. It's resolved from `siteId` at
 * request time via `SessionContextService.resolve` — single source of
 * truth lives on the EhrSiteConfig row, not in the token.
 */
export interface McpSession {
  /** EhrSiteConfig.id — selects the EHR tenant. From JWT claim or stdio env. */
  siteId: string;
  /** For audit / structured logging. */
  applicationId?: string;
  /** For audit / structured logging. */
  organizationId?: string;
}

/**
 * Executes an MCP `tools/call` request end-to-end:
 *   1. Resolve the tool descriptor from the catalog
 *   2. Validate LLM input via the tool's generated Ajv validator
 *   3. Resolve the site's EhrClientConfig + ehrName via SessionContextService
 *   4. Get the vendor service via ehrFactory
 *   5. Invoke the generated dispatcher (positional-arg map + `.data` unwrap)
 *   6. Return the raw vendor payload (transport serializes it)
 *
 * Error mapping: NotFound (tool / site missing), BadRequest (input
 * validation), Unauthorized (cross-tenant violation propagated from
 * admin-client), and EhrError from the vendor service pass through.
 */
@Injectable()
export class ExecutorService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly sessionContext: SessionContextService,
  ) {}

  async call(session: McpSession, toolName: string, rawInput: unknown): Promise<unknown> {
    const descriptor = this.catalog.resolve(toolName);
    if (!descriptor) {
      throw new NotFoundException(`Tool not found: ${toolName}`);
    }

    // Reject malformed LLM input before any EHR call (generated validator).
    const result = descriptor.validate(rawInput);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'Tool input validation failed',
        tool: toolName,
        errors: result.errors,
      });
    }

    // Resolve site → { config, ehrName }. AdminClient throws on missing
    // site / cross-tenant violations; let it propagate.
    const { config, ehrName } = await this.sessionContext.resolve(session.siteId);
    const svc = ehrFactory.getService(ehrName);

    logger.debug('MCP tool call', {
      tool: toolName,
      siteId: session.siteId,
      ehrName,
      vendorMethod: descriptor.vendorMethod,
      applicationId: session.applicationId,
    });

    // The generated dispatcher maps the validated input onto the vendor
    // method's positional args and unwraps `EhrResponse.data`.
    return descriptor.invoke(svc, config, rawInput);
  }
}
