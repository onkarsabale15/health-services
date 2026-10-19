import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createStorage, type IStorage } from '@hs/infra';
import { BridgeClientService } from './bridge-client.service';
import { FhirCodingEnricher } from './fhir-coding-enricher';
import { PlatformTokenService } from './platform-token.service';
import { SessionService } from './session.service';
import { TerminologyClient } from './terminology.client';

export const STORAGE_TOKEN = 'CDS_STORAGE';

@Global()
@Module({
  providers: [
    PlatformTokenService,
    BridgeClientService,
    TerminologyClient,
    FhirCodingEnricher,
    SessionService,
    {
      provide: STORAGE_TOKEN,
      useFactory: (config: ConfigService): IStorage => {
        const endpoint = config.get<string>('app.supabaseStorageEndpoint');
        if (!endpoint) {
          // Return a no-op storage for local dev without Supabase configured
          return {
            async upload() {
              return '';
            },
            async download() {
              return Buffer.alloc(0);
            },
            async delete() {},
            async getSignedUrl() {
              return '';
            },
          };
        }
        return createStorage({
          endpoint,
          bucket: config.get('app.supabaseStorageBucket'),
          region: config.get('app.supabaseStorageRegion'),
          accessKeyId: config.get('app.supabaseStorageAccessKey'),
          secretAccessKey: config.get('app.supabaseStorageSecretKey'),
          forcePathStyle: true,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    PlatformTokenService,
    BridgeClientService,
    TerminologyClient,
    FhirCodingEnricher,
    SessionService,
    STORAGE_TOKEN,
  ],
})
export class ServicesModule {}
