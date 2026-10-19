import { Injectable, BadRequestException } from '@nestjs/common';

const JWKS_FETCH_TIMEOUT_MS = 5000;
const ALLOWED_JWKS_KEY_TYPES = ['RSA', 'EC', 'OKP'];

@Injectable()
export class JwksService {
  /**
   * Fetches JWKS from a URL with strict security:
   * - HTTPS only
   * - No redirects followed
   * - Timeout enforced
   * - Response validated as proper JWKS
   */
  async fetchJwksFromUri(jwksUri: string): Promise<{ uri: string; keys: any[] }> {
    // Validate URL scheme
    let parsed: URL;
    try {
      parsed = new URL(jwksUri);
    } catch {
      throw new BadRequestException('Invalid JWKS URI format');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('JWKS URI must use HTTPS');
    }

    // Block private/internal IPs (SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === '169.254.169.254' // AWS metadata
    ) {
      throw new BadRequestException('JWKS URI must not point to private/internal addresses');
    }

    // Fetch with no redirects + timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(jwksUri, {
        method: 'GET',
        redirect: 'error', // reject any redirect
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new BadRequestException('JWKS URI fetch timed out');
      }
      if (err.message?.includes('redirect')) {
        throw new BadRequestException('JWKS URI returned a redirect, which is not allowed');
      }
      throw new BadRequestException(`Failed to fetch JWKS URI: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new BadRequestException(`JWKS URI returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      throw new BadRequestException(`JWKS URI returned unexpected content-type: ${contentType}`);
    }

    let body: any;
    try {
      body = await response.json();
    } catch {
      throw new BadRequestException('JWKS URI returned invalid JSON');
    }

    // Validate JWKS structure
    if (!body || !Array.isArray(body.keys) || body.keys.length === 0) {
      throw new BadRequestException('JWKS must contain a non-empty "keys" array');
    }

    for (let i = 0; i < body.keys.length; i++) {
      const key = body.keys[i];
      if (!key.kty || !ALLOWED_JWKS_KEY_TYPES.includes(key.kty)) {
        throw new BadRequestException(
          `Key ${i}: invalid or unsupported key type "${key.kty}". Allowed: ${ALLOWED_JWKS_KEY_TYPES.join(', ')}`,
        );
      }
      // Allow "sig" (JWT verification), "enc" (JWE encryption), or no "use" (general purpose)
      if (key.use && key.use !== 'sig' && key.use !== 'enc') {
        throw new BadRequestException(`Key ${i}: key use must be "sig" or "enc"`);
      }
      // Reject private key material
      if (key.d || key.p || key.q || key.dp || key.dq || key.qi) {
        throw new BadRequestException(`Key ${i}: JWKS must contain only public keys, not private keys`);
      }
    }

    return { uri: jwksUri, keys: body.keys };
  }
}
