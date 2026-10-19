import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type Message as BedrockMessage,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { ILlmProvider, LlmConfig, LlmMessage, LlmResponse, LlmStreamChunk } from '../interfaces';
import { LLM_DEFAULTS } from '../constants';

/**
 * AWS Bedrock provider — uses the Converse API (unified across all Bedrock models).
 * Auth via IAM role or AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
 * No API key needed — uses standard AWS credential chain.
 */
export class BedrockProvider implements ILlmProvider {
  private client: BedrockRuntimeClient;
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
    this.client = new BedrockRuntimeClient({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  async chat(messages: LlmMessage[], overrides?: Partial<LlmConfig>): Promise<LlmResponse> {
    const cfg = { ...this.config, ...overrides };
    const { system, bedrockMessages } = this.buildBedrockMessages(messages);

    const command = new ConverseCommand({
      modelId: cfg.model,
      messages: bedrockMessages,
      ...(system.length > 0 ? { system } : {}),
      inferenceConfig: {
        temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
        maxTokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      },
    });

    const response = await this.client.send(command);
    const textContent = response.output?.message?.content?.find((c) => 'text' in c);

    return {
      content: textContent && 'text' in textContent ? (textContent.text ?? '') : '',
      usage: response.usage
        ? {
            inputTokens: response.usage.inputTokens ?? 0,
            outputTokens: response.usage.outputTokens ?? 0,
          }
        : undefined,
      model: cfg.model,
      finishReason: response.stopReason ?? 'unknown',
    };
  }

  async *stream(messages: LlmMessage[], overrides?: Partial<LlmConfig>): AsyncIterable<LlmStreamChunk> {
    const cfg = { ...this.config, ...overrides };
    const { system, bedrockMessages } = this.buildBedrockMessages(messages);

    const command = new ConverseStreamCommand({
      modelId: cfg.model,
      messages: bedrockMessages,
      ...(system.length > 0 ? { system } : {}),
      inferenceConfig: {
        temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
        maxTokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      },
    });

    const response = await this.client.send(command);

    if (response.stream) {
      for await (const event of response.stream) {
        if (event.contentBlockDelta && event.contentBlockDelta.delta && 'text' in event.contentBlockDelta.delta) {
          yield { content: event.contentBlockDelta.delta.text ?? '', done: false };
        }
      }
    }
    yield { content: '', done: true };
  }

  private buildBedrockMessages(messages: LlmMessage[]): {
    system: SystemContentBlock[];
    bedrockMessages: BedrockMessage[];
  } {
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    const system: SystemContentBlock[] = systemMsgs.map((m) => ({ text: m.content }));

    const bedrockMessages: BedrockMessage[] = chatMsgs.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }],
    }));

    return { system, bedrockMessages };
  }
}
