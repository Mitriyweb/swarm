import type { AgentConfig, LLMProvider } from "@/types";

export abstract class Agent {
  protected name: string;
  protected role: string;
  protected instructions: string;

  constructor(
    config: AgentConfig,
    protected provider: LLMProvider,
  ) {
    this.name = config.name;
    this.role = config.role;
    this.instructions = config.instructions;
  }

  /**
   * Formats the prompt based on the specific agent's input.
   */
  protected abstract formatPrompt(input: unknown): string;

  /**
   * Runs the agent with the given input and returns the LLM response.
   */
  async run(input: unknown): Promise<string> {
    const taskContent = this.formatPrompt(input);
    const fullPrompt = `Role: ${this.role}\nInstructions: ${this.instructions}\n\nTask:\n${taskContent}`;

    return await this.provider.generate(fullPrompt);
  }
}
