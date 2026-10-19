import type { LlmProviderType } from './interfaces';

/**
 * Resolve LLM API key: user's custom key first, then platform fallback.
 *
 * Resolution order:
 *   1. User's custom key from Secrets Manager: LLM_KEY__{APP_ID}__{PROVIDER}
 *   2. Platform fallback key from environment variables
 *
 * Bedrock and vLLM don't always require API keys:
 *   - Bedrock uses IAM role or AWS credentials
 *   - vLLM may run without authentication
 *
 * @param applicationId - The application ID (UUID) owning the workflow/CDS
 * @param provider - The LLM provider name
 * @param secretsProvider - Optional injected secrets provider (DIP — avoids importing @hs/secrets directly)
 */
export async function resolveApiKey(
  applicationId: string,
  provider: LlmProviderType,
  secretsProvider?: { getSecretValue<T>(name: string): Promise<T> },
): Promise<string> {
  const safeAppId = applicationId.replace(/-/g, '_').toUpperCase();
  const safeProvider = provider.toUpperCase();

  // 1. User's custom key from Secrets Manager
  if (secretsProvider) {
    try {
      const customKey = await secretsProvider.getSecretValue<string>(`LLM_KEY__${safeAppId}__${safeProvider}`);
      if (customKey) return customKey;
    } catch {
      // No custom key — fall through to platform key
    }
  }

  // 2. Bedrock + vLLM don't always require API keys
  if (provider === 'bedrock' || provider === 'vllm' || provider === 'ollama') {
    return '';
  }

  // 3. Platform fallback key from env
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
  };

  const envKey = process.env[envMap[provider] ?? ''];
  if (envKey) return envKey;

  throw new Error(`No API key available for LLM provider: ${provider}`);
}
