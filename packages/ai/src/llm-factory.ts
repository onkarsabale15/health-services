import type { ILlmProvider, LlmConfig } from './interfaces';
import { LLM_DEFAULTS } from './constants';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { BedrockProvider } from './providers/bedrock.provider';
import { VllmProvider } from './providers/vllm.provider';

/**
 * Create an LLM provider instance from configuration.
 * Follows the factory pattern (OCP) — new providers = new class, no changes to existing.
 */
export function createLlmProvider(config: Partial<LlmConfig> = {}): ILlmProvider {
  const merged: LlmConfig = {
    provider: config.provider ?? LLM_DEFAULTS.provider,
    model: config.model ?? LLM_DEFAULTS.model,
    temperature: config.temperature ?? LLM_DEFAULTS.temperature,
    maxTokens: config.maxTokens ?? LLM_DEFAULTS.maxTokens,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    region: config.region,
  };

  switch (merged.provider) {
    case 'anthropic':
      return new AnthropicProvider(merged);
    case 'openai':
      return new OpenAIProvider(merged);
    case 'gemini':
      return new GeminiProvider(merged);
    case 'ollama':
      return new OllamaProvider(merged);
    case 'bedrock':
      return new BedrockProvider(merged);
    case 'vllm':
      return new VllmProvider(merged);
    default:
      throw new Error(`Unsupported LLM provider: ${merged.provider}`);
  }
}
