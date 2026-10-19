import OpenAI from 'openai';
import type { ILlmProvider, LlmConfig, LlmMessage, LlmResponse, LlmStreamChunk } from '../interfaces';
import { LLM_DEFAULTS } from '../constants';

export class OpenAIProvider implements ILlmProvider {
  private client: OpenAI;
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
  }

  async chat(messages: LlmMessage[], overrides?: Partial<LlmConfig>): Promise<LlmResponse> {
    const cfg = { ...this.config, ...overrides };

    const response = await this.client.chat.completions.create({
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? '',
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
      model: response.model,
      finishReason: choice?.finish_reason ?? 'unknown',
    };
  }

  async *stream(messages: LlmMessage[], overrides?: Partial<LlmConfig>): AsyncIterable<LlmStreamChunk> {
    const cfg = { ...this.config, ...overrides };

    const stream = await this.client.chat.completions.create({
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { content: delta, done: false };
      }
    }
    yield { content: '', done: true };
  }
}
