import type { ICache } from '@hs/infra';
import { ehrFactory } from './core/domain/ehr-factory.service';
import { epic } from './vendors/epic';
import { cerner } from './vendors/cerner';
import { athena } from './vendors/athenanet';
import { nextgen } from './vendors/nextgen';
import { ecw } from './vendors/eclinicalworks';
import { drchrono } from './vendors/drchrono';
import { elation } from './vendors/elation';
import { meditech } from './vendors/meditech';
import { medent } from './vendors/medent';
import { greenways } from './vendors/greenways';

// Lazy initialization flag
let initialized = false;

/** Initialize all EHR vendor services: register with factory + inject cache. */
export function initEhr(cache: ICache): void {
  if (initialized) return;

  const vendors = [
    ['epic', epic],
    ['cerner', cerner],
    ['athenanet', athena],
    ['nextgen', nextgen],
    ['eclinicalworks', ecw],
    ['drchrono', drchrono],
    ['elation', elation],
    ['meditech', meditech],
    ['medent', medent],
    ['greenways', greenways],
  ] as const;

  for (const [name, service] of vendors) {
    ehrFactory.register(name, service as any);
    if ('setCache' in service && typeof (service as any).setCache === 'function') {
      (service as any).setCache(cache);
    }
  }

  initialized = true;
}
