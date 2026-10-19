import { Module, Global } from '@nestjs/common';
import { logger } from '@hs/observability';
import { cache } from '@hs/infra';
import { httpClient } from '@hs/infra';
import { secrets } from '@hs/infra';
import { storage } from '@hs/infra';
import { INJECTION_TOKENS } from './injection-tokens';

@Global()
@Module({
  providers: [
    { provide: INJECTION_TOKENS.LOGGER, useValue: logger },
    { provide: INJECTION_TOKENS.CACHE, useValue: cache },
    { provide: INJECTION_TOKENS.HTTP_CLIENT, useValue: httpClient },
    { provide: INJECTION_TOKENS.SECRETS_PROVIDER, useValue: secrets },
    { provide: INJECTION_TOKENS.STORAGE, useValue: storage },
  ],
  exports: [
    INJECTION_TOKENS.LOGGER,
    INJECTION_TOKENS.CACHE,
    INJECTION_TOKENS.HTTP_CLIENT,
    INJECTION_TOKENS.SECRETS_PROVIDER,
    INJECTION_TOKENS.STORAGE,
  ],
})
export class CoreProvidersModule {}
