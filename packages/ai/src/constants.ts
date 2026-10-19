// ─── Available Models Per Provider ───────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  default?: boolean;
}

export interface ProviderInfo {
  name: string;
  models: ModelInfo[];
  requiresBaseUrl?: boolean;
  requiresRegion?: boolean;
  noKeyRequired?: boolean;
}

export const LLM_PROVIDERS: Record<string, ProviderInfo> = {
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ],
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', default: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', default: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  ollama: {
    name: 'Ollama (Self-hosted)',
    models: [
      { id: 'llama3', name: 'Llama 3' },
      { id: 'mistral', name: 'Mistral' },
    ],
    requiresBaseUrl: true,
    noKeyRequired: true,
  },
  bedrock: {
    name: 'AWS Bedrock',
    models: [
      { id: 'anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4 (Bedrock)', default: true },
      { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5 (Bedrock)' },
      { id: 'amazon.nova-pro-v1:0', name: 'Amazon Nova Pro' },
      { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite' },
      { id: 'meta.llama3-70b-instruct-v1:0', name: 'Llama 3 70B (Bedrock)' },
    ],
    noKeyRequired: true,
    requiresRegion: true,
  },
  vllm: {
    name: 'vLLM (Self-hosted)',
    models: [{ id: 'custom', name: 'Custom Model (specify in model field)' }],
    requiresBaseUrl: true,
    noKeyRequired: true,
  },
};

// ─── Default Config ─────────────────────────────────────────────────────────

export const LLM_DEFAULTS = {
  temperature: 0.3,
  maxTokens: 4096,
  provider: 'anthropic' as const,
  model: 'claude-sonnet-4-20250514',
};
