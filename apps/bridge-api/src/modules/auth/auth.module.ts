import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DualAuthGuard } from './guards/dual-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ScopeGuard } from './guards/scope.guard';
import { PlatformJwksService } from './services/platform-jwks.service';

@Module({
  providers: [
    PlatformJwksService,
    {
      provide: APP_GUARD,
      useClass: DualAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ScopeGuard,
    },
  ],
  exports: [PlatformJwksService],
})
export class AuthModule {}
