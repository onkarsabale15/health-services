// ─── Per-vendor EHR services (raw API + auth, no mapping) ────────────────────
export { epic } from './vendors/epic';
export { cerner } from './vendors/cerner';
export { athena } from './vendors/athenanet';
export { nextgen } from './vendors/nextgen';
export { ecw } from './vendors/eclinicalworks';
export { drchrono } from './vendors/drchrono';
export { elation } from './vendors/elation';
export { meditech } from './vendors/meditech';
export { medent } from './vendors/medent';
export { greenways } from './vendors/greenways';

// ─── Initialization ─────────────────────────────────────────────────────────
export { initEhr } from './init';
export { ehrFactory } from './core';

// ─── Types ───────────────────────────────────────────────────────────────────
export * from './vendors/athenanet/athena.types';
export * from './vendors/drchrono/drchrono.types';
export * from './vendors/elation/elation.types';
export { type SiteData, toEhrConfig } from './ehr-data.types';
export type { ConnectionData } from './core/interfaces/connection-data.interface';
export type { EhrClientConfig } from './core/interfaces/ehr-client-config.interface';
export type {
  EhrConfig,
  EhrConfigName,
  CernerEhrConfig,
  EpicEhrConfig,
  AthenaEhrConfig,
  DrChronoEhrConfig,
  EclinicalworksEhrConfig,
  ElationEhrConfig,
  MeditechEhrConfig,
  NextgenEhrConfig,
  GreenwaysEhrConfig,
  MedentEhrConfig,
} from './core/interfaces/ehr-config.interface';

// ─── Generated tool catalog (consumed by mcp-app + workflow-app DAG) ─────────
export { allVendorTools } from './tools';
export type { ToolDescriptor } from './tools/types';

// ─── Errors (used by bridge-api exception filter + mappers) ──────────────────
export { AppError } from './core/errors/app.error';
export { EhrError } from './core/errors/ehr.error';

// ─── Constants (used by bridge mappers) ──────────────────────────────────────
export { CODING_URLS } from './core/constants';
