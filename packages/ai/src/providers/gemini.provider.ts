import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ILlmProvider, LlmConfig, LlmMessage, LlmResponse, LlmStreamChunk } from '../interfaces';
import { LLM_DEFAULTS } from '../constants';

export class GeminiProvider implements ILlmProvider {
  private genAI: GoogleGenerativeAI;
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey ?? '');
  }

  async chat(messages: LlmMessage[], overrides?: Partial<LlmConfig>): Promise<LlmResponse> {
    const cfg = { ...this.config, ...overrides };
    const { systemPrompt, history, lastUserMessage } = this.buildGeminiMessages(messages);

    const model = this.genAI.getGenerativeModel({
      model: cfg.model,
      generationConfig: {
        temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
        maxOutputTokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
        ...(cfg.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
      },
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastUserMessage);
    const response = result.response;

    return {
      content: response.text(),
      usage: response.usageMetadata
        ? {
            inputTokens: response.usageMetadata.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
      model: cfg.model,
      finishReason: response.candidates?.[0]?.finishReason ?? 'unknown',
    };
  }

  async *stream(messages: LlmMessage[], overrides?: Partial<LlmConfig>): AsyncIterable<LlmStreamChunk> {
    const cfg = { ...this.config, ...overrides };
    const { systemPrompt, history, lastUserMessage } = this.buildGeminiMessages(messages);

    const model = this.genAI.getGenerativeModel({
      model: cfg.model,
      generationConfig: {
        temperature: cfg.temperature ?? LLM_DEFAULTS.temperature,
        maxOutputTokens: cfg.maxTokens ?? LLM_DEFAULTS.maxTokens,
      },
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastUserMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { content: text, done: false };
      }
    }
    yield { content: '', done: true };
  }

  private buildGeminiMessages(messages: LlmMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    // Gemini expects alternating user/model messages. Last message must be user.
    const history = nonSystem.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMsg = nonSystem[nonSystem.length - 1];
    return {
      systemPrompt: systemMsg?.content,
      history,
      lastUserMessage: lastMsg?.content ?? '',
    };
  }
}
