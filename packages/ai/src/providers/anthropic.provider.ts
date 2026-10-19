import Anthropic from '@anthropic-ai/sdk';
import type { ILlmProvider, LlmConfig, LlmMessage, LlmResponse, LlmStreamChunk } from '../interfaces';
import { LLM_DEFAULTS } from '../constants';

export class AnthropicProvider implements ILlmProvider {
  private client: Anthropic;
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async chat(messages: LlmMessage[], overrides?: Partial<LlmConfig>): Promise<LlmResponse> {
    const cfg = { ...this.config, ...overrides };
    const { systemPrompt, chatMessages } = this.splitMessages(messages);

    const response = await this.client.messages.create({
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: chatMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
      finishReason: response.stop_reason ?? 'unknown',
    };
  }

  async *stream(messages: LlmMessage[], overrides?: Partial<LlmConfig>): AsyncIterable<LlmStreamChunk> {
    const cfg = { ...this.config, ...overrides };
    const { systemPrompt, chatMessages } = this.splitMessages(messages);

    const stream = this.client.messages.stream({
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: chatMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { content: event.delta.text, done: false };
      }
    }
    yield { content: '', done: true };
  }

  private splitMessages(messages: LlmMessage[]): {
    systemPrompt: string | undefined;
    chatMessages: LlmMessage[];
  } {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');
    return { systemPrompt: systemMsg?.content, chatMessages };
  }
}
