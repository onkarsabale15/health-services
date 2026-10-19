import type { CdsSession, LaunchMode as SessionLaunchMode } from '../../../services/session.service';
import type { LaunchMode } from '../capabilities/capability.types';

/**
 * Per-call context handed to a provider. Carries the session plus the resolved
 * launch mode (in capability-matrix form) so providers don't have to re-map.
 *
 * Providers should NOT reach into NestJS DI — every dependency they need
 * (bridge client, coding enricher, etc.) is provided in the constructor of
 * `BaseFhirProvider` or its subclasses.
 */
export interface ProviderContext {
  session: CdsSession;
  /** Mode in capability-matrix form ('provider-ehr' / 'provider-standalone' / 'system'). */
  mode: LaunchMode;
}

const SESSION_TO_MATRIX_MODE: Record<SessionLaunchMode, LaunchMode> = {
  ehr: 'provider-ehr',
  standalone: 'provider-standalone',
  system: 'system',
};

export function buildProviderContext(session: CdsSession): ProviderContext {
  return {
    session,
    mode: SESSION_TO_MATRIX_MODE[session.providerSession.launchMode],
  };
}
