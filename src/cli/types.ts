export interface RoleDefinition {
  name: string;
  role: string;
  description: string;
  color: string;
  structured: boolean;
  llmProvider?: string;
  llmModel?: string;
  llmEndpoint?: string;
}

export interface InitConfig {
  roles: RoleDefinition[];
  cycle: string[];
  maxIterations: number;
  maxWorkers: number;
  defaultProvider: string;
  defaultModel: string;
  ollamaEndpoint?: string;
  skillsDir?: string;
}
