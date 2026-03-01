export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMProvider {
  generate(prompt: string, options?: Record<string, unknown>): Promise<string>;
  getUsage(): LLMUsage;
}
