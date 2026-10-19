import { Injectable } from '@nestjs/common';
import { db } from '@hs/infra';

@Injectable()
export class ConsentService {
  /** Find an active (not revoked, not expired) consent grant. */
  async findActive(endUserId: string, clientId: string) {
    const prisma = db.getClient();
    const grant = await prisma.consentGrant.findUnique({
      where: { endUserId_clientId: { endUserId, clientId } },
    });
    if (!grant || grant.revokedAt) return null;
    if (grant.expiresAt && grant.expiresAt < new Date()) return null;
    return grant;
  }

  /**
   * Returns true when `requestedScopes` is fully covered by `existingScopes`.
   * Re-consent is required when the RP requests a scope the user hasn't seen before.
   */
  satisfiesScopes(existingScopes: string[], requestedScopes: string[]): boolean {
    const have = new Set(existingScopes);
    return requestedScopes.every((s) => have.has(s));
  }

  /**
   * Persist a consent decision. Upserts the grant and updates lastUsedAt.
   * Existing scopes are unioned with the newly granted ones — re-consent
   * for an additional scope keeps the original grants intact.
   */
  async grant(endUserId: string, clientId: string, newScopes: string[]) {
    const prisma = db.getClient();
    const existing = await prisma.consentGrant.findUnique({
      where: { endUserId_clientId: { endUserId, clientId } },
    });
    const merged = existing ? Array.from(new Set([...existing.scopes, ...newScopes])) : Array.from(new Set(newScopes));

    return prisma.consentGrant.upsert({
      where: { endUserId_clientId: { endUserId, clientId } },
      create: {
        endUserId,
        clientId,
        scopes: merged,
        lastUsedAt: new Date(),
      },
      update: {
        scopes: merged,
        revokedAt: null,
        lastUsedAt: new Date(),
      },
    });
  }

  /** Mark a grant revoked. Returns count of rows updated (0 = nothing active). */
  async revoke(endUserId: string, clientId: string): Promise<{ count: number }> {
    const prisma = db.getClient();
    const result = await prisma.consentGrant.updateMany({
      where: { endUserId, clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { count: result.count };
  }

  async listForUser(endUserId: string) {
    const prisma = db.getClient();
    return prisma.consentGrant.findMany({
      where: { endUserId, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /** Touch lastUsedAt — fire-and-forget pattern matches @hs/infra.cache.set. */
  async touch(endUserId: string, clientId: string) {
    const prisma = db.getClient();
    await prisma.consentGrant
      .updateMany({
        where: { endUserId, clientId, revokedAt: null },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});
  }
}
