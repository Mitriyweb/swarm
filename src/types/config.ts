export interface AgentSkillConfig {
  name: string;
  role: string;
  instructions: string;
  description?: string;
  color?: string;
  structured?: boolean;
}

export interface ToolConfig {
  name: string;
  description: string;
  timeout?: number;
  requiresPathValidation?: boolean;
  args?: string[];
}
