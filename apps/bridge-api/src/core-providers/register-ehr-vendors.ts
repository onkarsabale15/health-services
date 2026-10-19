import { initEhr as initEhrService } from '@hs/ehr-data-service';
import type { ICache } from '@hs/infra';

/** Initialize EHR data service — register all vendors and inject cache. */
export function initEhr(cacheInstance: ICache): void {
  initEhrService(cacheInstance);
}
