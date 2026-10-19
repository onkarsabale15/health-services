import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CdsSession } from '../services/session.service';

/** Extract the full CDS session (providerSession + patientContext) from the request */
export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): CdsSession => {
  return ctx.switchToHttp().getRequest().cdsSession;
});
