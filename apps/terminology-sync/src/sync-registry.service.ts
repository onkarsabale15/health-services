import { Injectable } from '@nestjs/common';
import { SyncStrategy, SyncResult } from './sync-strategy.interface';

/**
 * Registry that maps CLI type names → SyncStrategy instances.
 * Strategies self-register via constructor injection.
 */
@Injectable()
export class SyncRegistry {
  private readonly strategies = new Map<string, SyncStrategy>();

  register(strategy: SyncStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  get(type: string): SyncStrategy | undefined {
    return this.strategies.get(type);
  }

  getAvailableTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  getDescriptions(): Array<{ type: string; description: string }> {
    return Array.from(this.strategies.values()).map((s) => ({
      type: s.type,
      description: s.description,
    }));
  }

  async run(type: string): Promise<SyncResult> {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      const available = this.getAvailableTypes().join(', ');
      throw new Error(`Unknown sync type "${type}". Available types: ${available}`);
    }
    return strategy.syncAll();
  }
}
