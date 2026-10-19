import { Injectable } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@hs/observability';
import { CatalogService } from '../catalog/catalog.service';
import { ExecutorService } from '../executor/executor.service';
import { SessionContextService } from '../executor/session-context.service';
import type { ResolvedSession } from './auth';

/**
 * Builds an `@modelcontextprotocol/sdk` MCP `Server` wired to a single
 * authenticated session. The `tools/list` + `tools/call` handler logic
 * lives here in ONE place (consumed by the Streamable HTTP transport).
 *
 * Tools are filtered by the session's vendor — `ehrName` is resolved from
 * SiteData (token carries `siteId` only). The resolve is memoized in
 * `SessionContextService`, so calling it per `tools/list` is cheap.
 */
@Injectable()
export class McpServerService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly executor: ExecutorService,
    private readonly sessionContext: SessionContextService,
  ) {}

  build(session: ResolvedSession): Server {
    const server = new Server(
      { name: 'hs-mcp-server', version: '0.1.0' },
      { capabilities: { tools: { listChanged: false } } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const { ehrName } = await this.sessionContext.resolve(session.siteId);
      return { tools: this.catalog.listForVendor(ehrName) };
    });

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      try {
        const result = await this.executor.call(
          { siteId: session.siteId, applicationId: session.applicationId, organizationId: session.organizationId },
          name,
          args ?? {},
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        // Surface tool failures (unknown tool, input validation, EHR errors)
        // as an MCP tool error the LLM can read + retry — not a collapsed
        // JSON-RPC protocol error.
        const message = describeToolError(err);
        logger.warn('MCP tool call failed', { tool: name, siteId: session.siteId, message });
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    });

    return server;
  }
}

/**
 * Render an error as a single LLM-readable line. For `AppError`/`EhrError`
 * (which carry the vendor's status + response body) include the status and a
 * truncated body so the client sees the EHR's actual `OperationOutcome`
 * instead of a bare "Request failed with status code 400".
 */
function describeToolError(err: unknown): string {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const e = err as { statusCode?: number; body?: unknown; message?: string };
    const base = `EHR error ${e.statusCode ?? ''}: ${e.message ?? ''}`.trim();
    const detail = typeof e.body === 'string' ? e.body : e.body ? JSON.stringify(e.body) : '';
    return detail && detail !== '{}' && detail !== `{"message":"${e.message}"}`
      ? `${base} — ${detail.slice(0, 800)}`
      : base;
  }
  return err instanceof Error ? err.message : String(err);
}
