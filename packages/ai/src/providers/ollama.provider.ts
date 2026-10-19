import { OpenAIProvider } from './openai.provider';
import type { LlmConfig } from '../interfaces';

/**
 * Ollama provider — uses OpenAI-compatible API with custom baseUrl.
 * Ollama exposes an OpenAI-compatible chat completions endpoint.
 */
export class OllamaProvider extends OpenAIProvider {
  constructor(config: LlmConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:11434/v1',
      apiKey: config.apiKey || 'ollama', // Ollama doesn't require a real key
    });
  }
}
