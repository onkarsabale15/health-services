import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ModelConfig } from '../cds-engine.types';

const DEFAULTS: ModelConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  temperature: 0.1,
  maxTokens: 4096,
};

/**
 * Create a LangChain-compatible model for CDS agent orchestration.
 *
 * CDS engine uses LangChain for agent tool-calling + orchestration.
 * For simple chat/stream without LangChain, use @hs/ai directly.
 *
 * Supports: anthropic, openai, gemini (via openai-compat), ollama, bedrock, vllm
 */
export function createModel(config: Partial<ModelConfig> = {}): BaseChatModel {
  const merged = { ...DEFAULTS, ...config };

  switch (merged.provider) {
    case 'anthropic':
      return new ChatAnthropic({
        model: merged.model,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        ...(merged.apiKey ? { anthropicApiKey: merged.apiKey } : {}),
      });

    case 'openai':
      // ChatOpenAI has excessively deep type instantiation — cast to suppress
      return new (ChatOpenAI as any)({
        model: merged.model,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        ...(merged.apiKey ? { openAIApiKey: merged.apiKey } : {}),
      }) as BaseChatModel;

    case 'gemini':
      return new (ChatOpenAI as any)({
        model: merged.model,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        apiKey: merged.apiKey || process.env.GEMINI_API_KEY,
        configuration: {
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        },
      }) as BaseChatModel;

    case 'ollama':
      return new (ChatOpenAI as any)({
        model: merged.model,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        configuration: {
          baseURL: merged.baseUrl || 'http://localhost:11434/v1',
          apiKey: 'ollama',
        },
      }) as BaseChatModel;

    case 'vllm':
      return new (ChatOpenAI as any)({
        model: merged.model,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        configuration: {
          baseURL: merged.baseUrl || 'http://localhost:8000/v1',
          apiKey: merged.apiKey || 'vllm',
        },
      }) as BaseChatModel;

    case 'bedrock':
      return new ChatAnthropic({
        model: merged.model,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
      });

    default:
      throw new Error(`Unsupported LLM provider: ${merged.provider}`);
  }
}
