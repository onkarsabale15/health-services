/**
 * MCP tool catalog — generated at build time from `@mcptool`-tagged vendor
 * service methods (see `scripts/gen-tools.ts`). `allVendorTools` is keyed by
 * the runtime `ehrName` the factory registers each vendor under.
 *
 * mcp-app's catalog loads this directly; post-PR5 workflow-app's `raw-ehr`
 * node consumes the same map. There is no hand-written registry and no Zod.
 */
export { allVendorTools } from './tools.generated';
export type { ToolDescriptor } from './types';
