-- PR2.5: extend AppType enum with MCP for MCP-server applications
-- (system/client_credentials apps consumed by the MCP Streamable HTTP server).
-- Non-destructive: existing rows keep their values.

ALTER TYPE "AppType" ADD VALUE IF NOT EXISTS 'MCP';
