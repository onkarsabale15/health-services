import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY, ALLOWED_TOKEN_TYPES_KEY } from '../guards/platform-auth.guard';

/** Mark an endpoint as public — skips authentication */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restrict which token types an endpoint accepts.
 *
 * @example
 * @AllowTokenTypes('session')           // admin-ui only
 * @AllowTokenTypes('session', 'api')    // admin-ui + API consumers
 * // No decorator = any valid token (session, api, internal)
 */
export const AllowTokenTypes = (...types: ('session' | 'api')[]) => SetMetadata(ALLOWED_TOKEN_TYPES_KEY, types);
