import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const SiteConfig = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return data ? request.siteData?.[data] : request.siteData;
});

/** @deprecated Use SiteConfig instead */
export const IntegrationConfig = SiteConfig;
