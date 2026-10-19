import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { logger } from '@hs/observability';
import { CdsResourceProviderBase } from './base/cds-resource-provider-base';
import type { CdsResourceProvider } from './cds-resource-provider.interface';

/**
 * Resolves a `CdsResourceProvider` for a given EHR name.
 *
 * Discovers every registered provider via NestJS `DiscoveryService` —
 * any class extending `CdsResourceProviderBase` registered in
 * `ProvidersModule` is picked up automatically. Adding a new EHR is
 * literally "add the class line to ProvidersModule.providers"; the
 * factory never needs to change.
 */
@Injectable()
export class CdsResourceProviderFactory implements OnModuleInit {
  private readonly providers = new Map<string, CdsResourceProvider>();

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit() {
    const wrappers = this.discovery.getProviders();
    for (const wrapper of wrappers) {
      const instance = wrapper.instance;
      if (!instance || !(instance instanceof CdsResourceProviderBase)) continue;
      // The abstract base + the FHIR R4 default both extend
      // `CdsResourceProviderBase` but aren't EHRs themselves. Skip them.
      if (!instance.ehrName || instance.ehrName === 'standard-fhir-r4') continue;
      if (this.providers.has(instance.ehrName)) {
        throw new Error(
          `CdsResourceProviderFactory: duplicate registration for EHR '${instance.ehrName}' — check ProvidersModule`,
        );
      }
      this.providers.set(instance.ehrName, instance as unknown as CdsResourceProvider);
    }
    logger.info('CDS resource providers registered', {
      ehrs: Array.from(this.providers.keys()),
    });
  }

  /** Returns the provider, or throws `NotFoundException` if no provider is registered for the EHR. */
  get(ehrName: string): CdsResourceProvider {
    const provider = this.providers.get(ehrName);
    if (!provider) {
      throw new NotFoundException(`No CDS provider registered for EHR '${ehrName}'`);
    }
    return provider;
  }

  /** Returns the provider, or `null` if none is registered. Used by surfaces that want a graceful fallback. */
  tryGet(ehrName: string): CdsResourceProvider | null {
    return this.providers.get(ehrName) ?? null;
  }

  /** Returns every registered provider — for capability-matrix introspection (admin dashboard, ops tooling). */
  getAll(): CdsResourceProvider[] {
    return Array.from(this.providers.values());
  }
}
