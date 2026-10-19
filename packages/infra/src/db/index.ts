export { db, DatabaseConfig } from './database';
// Re-export Prisma types/enums/client so consumers don't have to import
// @prisma/client directly — keeps "apps depend on @hs/infra, not raw deps".
// Type-only generated artifacts (model types, enum values, Prisma namespace)
// flow through here.
export * from '@prisma/client';
