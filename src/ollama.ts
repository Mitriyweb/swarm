import type { LLMProvider, LLMUsage } from "@/types";

export interface OllamaConfig {
  endpoint?: string;
  model: string;
  maxTokens?: number;
}

interface OllamaResponse {
  response: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements LLMProvider {
  private endpoint: string;
  private model: string;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(config: OllamaConfig) {
    this.endpoint = (config.endpoint ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = config.model;
  }

  async generate(prompt: string): Promise<string> {
    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt, stream: false }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as OllamaResponse;

    const promptTokens = data.prompt_eval_count ?? 0;
    const completionTokens = data.eval_count ?? 0;
    this.usage.promptTokens += promptTokens;
    this.usage.completionTokens += completionTokens;
    this.usage.totalTokens += promptTokens + completionTokens;

    return data.response;
  }

  getUsage(): LLMUsage {
    return { ...this.usage };
  }
}
