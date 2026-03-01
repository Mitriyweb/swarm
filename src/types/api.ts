import type { LLMProvider } from "@/types/llm";

export interface SwarmConfig {
  provider: LLMProvider;
  maxWorkers?: number;
}
