import { OpenAIProvider } from './openai.provider';
import type { LlmConfig } from '../interfaces';

/**
 * vLLM provider — uses OpenAI-compatible API with custom baseUrl.
 * vLLM exposes an OpenAI-compatible chat completions endpoint.
 */
export class VllmProvider extends OpenAIProvider {
  constructor(config: LlmConfig) {
    if (!config.baseUrl) {
      throw new Error('vLLM provider requires a baseUrl (e.g. http://localhost:8000/v1)');
    }
    super({
      ...config,
      apiKey: config.apiKey || 'vllm', // vLLM may not require a key
    });
  }
}
