import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CdsSession } from '../services/session.service';

/**
 * Gate for the care plan approval action — `POST /care-plans/:id/approve`.
 *
 * Reads `providerCapabilities.canApproveCarePlan` from the session. The
 * capability flag is computed at launch from the descriptive role
 * (physician / NP / PA / system → true; nurse / MA / support → false),
 * so this guard is intentionally trivial — the policy lives in
 * `provider-role.ts:computeProviderCapabilities`, not here.
 *
 * Must be applied AFTER `CdsSessionGuard` — it reads the session that
 * guard attaches to `request.cdsSession`. NestJS evaluates `@UseGuards`
 * in declaration order, so the standard pattern is:
 *
 *   @Controller('care-plans')
 *   @UseGuards(CdsSessionGuard)              // class-level: runs first
 *   class CarePlanController {
 *     @Post(':id/approve')
 *     @UseGuards(CarePlanApprovalGuard)      // method-level: runs after
 *     approve(...) { ... }
 *   }
 */
@Injectable()
export class CarePlanApprovalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ cdsSession?: CdsSession }>();
    const session = request.cdsSession;

    if (!session) {
      // CdsSessionGuard should have run first and either populated this or
      // thrown. If we get here without a session, something upstream is
      // misconfigured — fail closed, surface as forbidden rather than
      // attempting silent recovery.
      throw new ForbiddenException('Session not available — re-launch from your EHR');
    }

    if (!session.providerSession.providerCapabilities.canApproveCarePlan) {
      throw new ForbiddenException(
        'Only licensed prescribers (MD/DO/NP/PA) can approve care plans. Authoring and editing remain available.',
      );
    }

    return true;
  }
}
