import { Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@hs/observability';
import { allVendorTools, type EhrConfigName, type ToolDescriptor } from '@hs/ehr-data-service';

/**
 * One tool's public representation — the shape returned in `tools/list`.
 * The internal `ToolDescriptor` (validator + dispatcher) is kept separate
 * and never leaves mcp-app.
 */
export interface CatalogToolPublic {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema (draft-07), generated
}

interface CatalogTool {
  vendor: string;
  pub: CatalogToolPublic;
  descriptor: ToolDescriptor;
}

/**
 * MCP tool catalog. Loaded once at boot from the build-time generated
 * `allVendorTools` (`@hs/ehr-data-service`). The JSON Schema is shipped
 * generated — no Zod, no runtime schema conversion.
 *
 * Per-session vendor filtering happens via `listForVendor()`; the executor
 * resolves a descriptor by name for dispatch.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly catalog: CatalogTool[] = [];

  onModuleInit(): void {
    for (const [vendor, descriptors] of Object.entries(allVendorTools)) {
      for (const descriptor of descriptors) {
        this.catalog.push({
          vendor,
          descriptor,
          pub: {
            name: descriptor.name,
            description: descriptor.description,
            inputSchema: descriptor.jsonSchema,
          },
        });
      }
    }
    logger.info('MCP catalog loaded', {
      tools: this.catalog.length,
      vendors: Object.keys(allVendorTools).length,
    });
  }

  /**
   * Tools visible to a session — filtered by the session's vendor.
   *
   * Takes `EhrConfigName` (every known vendor) rather than only vendors
   * that have generated tools: callers pass `siteData.ehrName` directly,
   * and a site for a vendor with no `@mcptool` methods yet must yield an
   * empty list, not a type error.
   */
  listForVendor(vendor: EhrConfigName): CatalogToolPublic[] {
    return this.catalog.filter((t) => t.vendor === vendor).map((t) => t.pub);
  }

  /** Resolve a tool name to its descriptor (for the executor). */
  resolve(name: string): ToolDescriptor | undefined {
    return this.catalog.find((t) => t.descriptor.name === name)?.descriptor;
  }

  /** Total tool count — used by the health endpoint. */
  size(): number {
    return this.catalog.length;
  }
}
