import type { LLMProvider } from "@/types/llm";
import type { QueueAdapter } from "@/types/queue";

export interface SwarmConfig {
  provider: LLMProvider;
  maxWorkers?: number;
  queue?: QueueAdapter;
  enableDashboard?: boolean;
  dashboardPort?: number;
}
