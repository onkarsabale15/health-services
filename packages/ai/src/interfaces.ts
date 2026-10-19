// ─── LLM Provider Types ─────────────────────────────────────────────────────

export type LlmProviderType = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'bedrock' | 'vllm';

// ─── LLM Configuration ─────────────────────────────────────────────────────

export interface LlmConfig {
  provider: LlmProviderType;
  model: string;
  temperature?: number; // default 0.3
  maxTokens?: number; // default 4096
  baseUrl?: string; // for ollama, vLLM, or custom endpoints
  apiKey?: string; // injected at runtime, never stored in config
  region?: string; // for bedrock (e.g. 'us-east-1')
  responseFormat?: 'text' | 'json'; // force structured JSON output (supported by Gemini, OpenAI)
}

// ─── Messages ───────────────────────────────────────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Response ───────────────────────────────────────────────────────────────

export interface LlmResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
  finishReason: string;
}

// ─── Streaming ──────────────────────────────────────────────────────────────

export interface LlmStreamChunk {
  content: string;
  done: boolean;
}

// ─── Provider Interface ─────────────────────────────────────────────────────

export interface ILlmProvider {
  chat(messages: LlmMessage[], config?: Partial<LlmConfig>): Promise<LlmResponse>;
  stream(messages: LlmMessage[], config?: Partial<LlmConfig>): AsyncIterable<LlmStreamChunk>;
}
