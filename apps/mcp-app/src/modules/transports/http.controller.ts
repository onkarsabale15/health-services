import { Controller, Delete, Get, HttpException, Post, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@hs/observability';
import { McpAuthService, type ResolvedSession } from './auth';
import { McpServerService } from './mcp-server.service';

const SESSION_HEADER = 'mcp-session-id';
const SITE_HEADER = 'x-site-id';
/** Evict sessions idle longer than this (no shared store yet — PR6). */
const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Hard cap on concurrent sessions — bounds memory; oldest is evicted past it. */
const MAX_SESSIONS = 1000;

interface McpSession {
  transport: StreamableHTTPServerTransport;
  /** Site this session was opened for — every later request must re-authorize for it. */
  siteId: string;
  lastSeen: number;
}

/**
 * MCP Streamable HTTP transport — the spec-compliant JSON-RPC 2.0 endpoint
 * any MCP HTTP client (Claude Code, Gemini CLI, custom agents) connects to.
 *
 * Single endpoint `/api/mcp` (the `api` global prefix is added by
 * `bootstrapNestApp`):
 *   - `POST` initialize → authenticates the request, binds a Server to the
 *     authorized `siteId`, mints an `Mcp-Session-Id`, stores the transport.
 *   - `POST` with `Mcp-Session-Id` → re-authorizes, routes to that session's
 *     transport.
 *   - `GET` with `Mcp-Session-Id` → SSE stream for server-initiated messages.
 *   - `DELETE` with `Mcp-Session-Id` → terminate the session.
 *
 * Auth mirrors bridge-api's system (client_credentials) path: a platform API
 * token in `Authorization: Bearer` (verified against the platform JWKS) plus an
 * `X-Site-Id` header naming the scope. Every request — not just initialize — is
 * re-authorized, so a leaked session id alone can't drive tool calls. Sessions
 * are evicted on idle TTL and capped; PR6 adds a shared session store for
 * horizontal scale, PR7 OAuth 2.1 / DCR for third-party clients.
 */
@Controller('mcp')
export class HttpTransportController {
  private readonly sessions = new Map<string, McpSession>();

  constructor(
    private readonly auth: McpAuthService,
    private readonly mcpServer: McpServerService,
  ) {}

  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.sweepIdle();
    const sessionId = this.sessionId(req);
    const existing = sessionId ? this.sessions.get(sessionId) : undefined;

    // Existing session → re-authorize, ensure the site still matches, then route.
    if (existing) {
      const session = await this.authenticate(req, res);
      if (!session) return;
      if (session.siteId !== existing.siteId) {
        this.rpcError(req, res, 401, -32001, 'X-Site-Id does not match the session');
        return;
      }
      existing.lastSeen = Date.now();
      await this.dispatch(req, res, () => existing.transport.handleRequest(req, res, req.body));
      return;
    }

    // Unknown / expired session id → 404 so the client starts a new session
    // (per the MCP Streamable HTTP spec — the client re-sends `initialize`).
    if (sessionId) {
      this.rpcError(req, res, 404, -32001, 'Session not found — reinitialize');
      return;
    }

    // No session id: the first request of a session must be `initialize`.
    if (!isInitializeRequest(req.body)) {
      this.rpcError(req, res, 400, -32000, 'Expected an initialize request');
      return;
    }
    const session = await this.authenticate(req, res);
    if (!session) return;
    if (this.sessions.size >= MAX_SESSIONS) this.evictOldest();

    const server = this.mcpServer.build(session);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        this.sessions.set(id, { transport, siteId: session.siteId, lastSeen: Date.now() });
        logger.info('MCP session opened', { sessionId: id, siteId: session.siteId });
      },
    });
    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) this.sessions.delete(id);
      void server.close();
      logger.info('MCP session closed', { sessionId: id });
    };

    await this.dispatch(req, res, async () => {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
  }

  @Get()
  async handleGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.routeBySession(req, res);
  }

  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.routeBySession(req, res);
  }

  /** GET (SSE) + DELETE (terminate) hand off to the session's transport. */
  private async routeBySession(req: Request, res: Response): Promise<void> {
    const sessionId = this.sessionId(req);
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session) {
      // Unknown/expired session → 404 so the client reinitializes (MCP spec).
      res.status(404).end();
      return;
    }
    const authed = await this.authenticate(req, res);
    if (!authed) return;
    if (authed.siteId !== session.siteId) {
      this.rpcError(req, res, 401, -32001, 'X-Site-Id does not match the session');
      return;
    }
    session.lastSeen = Date.now();
    await this.dispatch(req, res, () => session.transport.handleRequest(req, res));
  }

  /**
   * Verify the bearer token + X-Site-Id and resolve the authorized session.
   * On failure, emits a JSON-RPC error with the matching HTTP status and
   * returns `undefined` so the caller short-circuits.
   */
  private async authenticate(req: Request, res: Response): Promise<ResolvedSession | undefined> {
    try {
      return await this.auth.authenticate(this.bearer(req), this.siteHeader(req));
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 500;
      const message = err instanceof HttpException ? err.message : 'Authentication error';
      this.rpcError(req, res, status, status === 400 ? -32000 : -32001, message);
      return undefined;
    }
  }

  /** Normalize the session id header (Express yields string[] for duplicates). */
  private sessionId(req: Request): string | undefined {
    const raw = req.headers[SESSION_HEADER];
    return Array.isArray(raw) ? raw[0] : raw;
  }

  /** Normalize the X-Site-Id header. */
  private siteHeader(req: Request): string | undefined {
    const raw = req.headers[SITE_HEADER];
    return Array.isArray(raw) ? raw[0] : raw;
  }

  private bearer(req: Request): string | undefined {
    const auth = req.headers.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : undefined;
  }

  /** Run a transport handler; if it throws before responding, emit an error so the request never hangs. */
  private async dispatch(req: Request, res: Response, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      logger.error('MCP transport handler error', err as Error, { path: req.path });
      if (!res.headersSent) this.rpcError(req, res, 500, -32603, 'Internal error handling MCP request');
    }
  }

  private sweepIdle(): void {
    const cutoff = Date.now() - SESSION_IDLE_MS;
    const stale: string[] = [];
    for (const [id, s] of this.sessions) {
      if (s.lastSeen < cutoff) stale.push(id);
    }
    for (const id of stale) this.closeSession(id);
  }

  private evictOldest(): void {
    let oldestId: string | undefined;
    let oldest = Infinity;
    for (const [id, s] of this.sessions) {
      if (s.lastSeen < oldest) {
        oldest = s.lastSeen;
        oldestId = id;
      }
    }
    if (oldestId) this.closeSession(oldestId);
  }

  private closeSession(id: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.delete(id); // prompt removal; the onclose delete is then a no-op
    void s.transport.close(); // fires onclose → server.close()
  }

  private rpcError(req: Request, res: Response, status: number, code: number, message: string): void {
    res.status(status).json({
      jsonrpc: '2.0',
      id: (req.body as { id?: unknown } | undefined)?.id ?? null,
      error: { code, message },
    });
  }
}
