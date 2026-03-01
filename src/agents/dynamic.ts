import { Agent } from "@/agents/base";
import { parseStructuredResponse } from "@/agents/parser";
import type { LLMProvider, ToolCall } from "@/types";
import type { AgentSkillConfig } from "@/types/config";

export class DynamicAgent extends Agent {
  private skill: AgentSkillConfig;

  constructor(skill: AgentSkillConfig, provider: LLMProvider) {
    super({ name: skill.name, role: skill.role, instructions: skill.instructions }, provider);
    this.skill = skill;
  }

  protected formatPrompt(input: unknown): string {
    return String(input);
  }

  /**
   * Runs the agent and returns structured tool calls.
   * Only meaningful when skill.structured is true.
   */
  async runStructured(input: string): Promise<ToolCall[]> {
    const rawResponse = await this.run(input);
    return parseStructuredResponse(this.provider, rawResponse);
  }

  get config(): AgentSkillConfig {
    return this.skill;
  }
}
