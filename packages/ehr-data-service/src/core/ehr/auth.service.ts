// Auth types - shared across vendor services.
// Token logic has been moved into each vendor's getToken() method.
// JWK helpers and URL resolvers live in BaseEhrService.

export { TokenResult, JwkSet, JwkKey } from '../interfaces/ehr-service.interface';
