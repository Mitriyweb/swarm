export interface AgentConfig {
  name: string;
  role: string;
  instructions: string;
}

export interface ToolCall {
  action: string;
  path?: string;
  content?: string;
  message?: string;
  reason?: string;
}
