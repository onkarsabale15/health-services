/**
 * Shared SSO/IdP types — backend, frontend, and SDK consumers all use these.
 * Single source of truth so the DTO union, the admin-ui radio, and the bridge
 * client method don't drift apart.
 */

export const AUTO_PROVISIONING_POLICIES = ['closed', 'open', 'domain-locked'] as const;
export type AutoProvisioningPolicy = (typeof AUTO_PROVISIONING_POLICIES)[number];

export const RESOLVE_ACTIONS = ['matched', 'auto-created-open', 'auto-created-domain'] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export const ACCESS_LEVELS = ['READONLY', 'FULL'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const END_USER_STATUSES = ['PENDING', 'ACTIVE', 'DISABLED'] as const;
export type EndUserStatus = (typeof END_USER_STATUSES)[number];
