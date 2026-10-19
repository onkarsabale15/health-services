import { Injectable } from '@nestjs/common';
import { createLlmProvider, resolveApiKey, type LlmProviderType } from '@hs/ai';
import { secrets } from '@hs/infra';
import { logger } from '@hs/observability';

/**
 * Wraps @hs/ai with key resolution via @hs/secrets.
 * Resolves the API key for the provider, then creates a provider and calls chat.
 */
@Injectable()
export class LlmClientService {
  async chat(
    applicationId: string,
    provider: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number; baseUrl?: string; region?: string },
  ): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const apiKey = await resolveApiKey(applicationId, provider as LlmProviderType, secrets);

    const llm = createLlmProvider({
      provider: provider as LlmProviderType,
      model,
      apiKey,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      baseUrl: options?.baseUrl,
      region: options?.region,
    });

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const response = await llm.chat(messages);

    logger.debug('LLM call completed', {
      applicationId,
      provider,
      model,
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
    });

    return {
      content: response.content,
      usage: response.usage,
    };
  }
}
