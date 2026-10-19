import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract the `If-Match` header for FHIR PUT optimistic concurrency. Vendor
 * services receive it via `WriteOptions.ifMatch`; the EHR validates the format
 * (Cerner enforces, Athena accepts but ignores). Returns `undefined` when the
 * client didn't send one — vendor services treat that as "no concurrency check".
 */
export const IfMatch = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest();
  const value = request.headers?.['if-match'];
  return typeof value === 'string' ? value : undefined;
});
