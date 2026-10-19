import type { EhrClientConfig } from '../core/interfaces/ehr-client-config.interface';

/**
 * Stable, hand-written contract for one MCP tool. Concrete values are
 * produced at build time by `scripts/gen-tools.ts` (ts-morph scan of
 * `@mcptool` methods → ts-json-schema-generator → ajv) and emitted into
 * `tools.generated.ts`. Nothing here is Zod; nothing is hand-authored
 * per tool.
 *
 * Consumed by mcp-app (MCP `tools/list` + `tools/call`) and, post-PR5,
 * workflow-app's `raw-ehr` node. NestJS-free by constraint.
 */
export interface ToolDescriptor {
  /** `${ehrName}_${methodName}` — e.g. `cerner_getPatient`. */
  name: string;

  /** LLM-facing description — the method's TSDoc summary. */
  description: string;

  /** JSON Schema (draft-07) for the tool input — sent verbatim in `tools/list`. */
  jsonSchema: Record<string, unknown>;

  /**
   * Runtime input validation (generated Ajv validator). Returns a tagged
   * result rather than throwing — the executor maps a failure to a 400
   * before any EHR call is made.
   */
  validate: (input: unknown) => { ok: true } | { ok: false; errors: string };

  /** Underlying vendor service method name — for audit/debug logging. */
  vendorMethod: string;

  /**
   * Generated dispatcher. Maps the validated input object onto the vendor
   * method's positional arguments and unwraps `EhrResponse<T>.data`. Vendor
   * service signatures are NOT changed by the tool layer — this thunk
   * adapts to them.
   */
  invoke: (service: unknown, config: EhrClientConfig, input: unknown) => Promise<unknown>;
}
