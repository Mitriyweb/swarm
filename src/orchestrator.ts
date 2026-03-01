import { DynamicAgent } from "@/agents/dynamic";
import { ConfigLoader } from "@/configs/loader";
import { Logger } from "@/logger";
import { detectPromptInjection } from "@/safety";
import { TaskRunner } from "@/task";
import { LogLevel } from "@/types";
import type { LLMProvider, ToolCall, ToolCommandName } from "@/types";

export class Orchestrator {
  private architect: DynamicAgent;
  private coder: DynamicAgent;
  private reviewer: DynamicAgent;
  private logger: Logger;

  private constructor(
    architect: DynamicAgent,
    coder: DynamicAgent,
    reviewer: DynamicAgent,
    logger: Logger,
  ) {
    this.architect = architect;
    this.coder = coder;
    this.reviewer = reviewer;
    this.logger = logger;
  }

  static async create(provider: LLMProvider, logger?: Logger): Promise<Orchestrator> {
    const loader = new ConfigLoader();
    const [architectSkill, coderSkill, reviewerSkill] = await Promise.all([
      loader.loadSkill("architect"),
      loader.loadSkill("coder"),
      loader.loadSkill("reviewer"),
    ]);

    return new Orchestrator(
      new DynamicAgent(architectSkill, provider),
      new DynamicAgent(coderSkill, provider),
      new DynamicAgent(reviewerSkill, provider),
      logger ?? new Logger(),
    );
  }

  /**
   * Orchestrates a multi-agent task with iteration control.
   * Section 6: Iteration Control, Section 9: Structured JSON, Section 11: Error Handling, Section 16: Safety.
   */
  async executeTask(taskId: string, userPrompt: string, maxIterations = 3): Promise<boolean> {
    if (detectPromptInjection(userPrompt)) {
      await this.logger.log(
        taskId,
        LogLevel.ERROR,
        "Prompt injection detected in user input. Aborting.",
      );
      return false;
    }

    const taskRunner = new TaskRunner(taskId);

    try {
      await taskRunner.initialize();

      await this.logger.log(taskId, LogLevel.INFO, "Agent: Architecting...");
      const design = await this.architect.run(userPrompt);
      await this.logger.log(taskId, LogLevel.INFO, "Architecture design complete.");

      let currentIteration = 0;
      let lastChanges = "";
      let feedback = "";

      while (currentIteration < maxIterations) {
        currentIteration++;
        await this.logger.log(
          taskId,
          LogLevel.INFO,
          `Iteration ${currentIteration}/${maxIterations} starting...`,
        );

        await this.logger.log(taskId, LogLevel.INFO, "Agent: Coding...");
        const coderInput = feedback
          ? `Design: ${design}\nPrevious effort failed. Feedback: ${feedback}\nPlease fix and try again.`
          : design;

        let toolCalls: ToolCall[];
        try {
          toolCalls = await this.coder.runStructured(coderInput);
        } catch (parseError: unknown) {
          await this.logger.log(
            taskId,
            LogLevel.WARN,
            `JSON parse failed after retries: ${(parseError as Error).message}.`,
          );
          feedback = "Your output was not valid JSON. Please return ONLY a JSON array.";
          continue;
        }

        await this.logger.log(
          taskId,
          LogLevel.INFO,
          `Coder generated ${toolCalls.length} tool call(s).`,
        );
        lastChanges = JSON.stringify(toolCalls);

        for (const call of toolCalls) {
          const name = call.action as ToolCommandName;
          await taskRunner.runTool({
            name,
            args: { path: call.path, content: call.content, message: call.message },
          });
        }

        await this.logger.log(taskId, LogLevel.INFO, "Agent: Reviewing...");
        const review = await this.reviewer.run(
          `Architecture Design: ${design}\n\nChanges Implemented: ${lastChanges}\n\nTest Results: Tests ran in sandbox (simulated)`,
        );

        if (review.includes("APPROVED")) {
          await this.logger.log(
            taskId,
            LogLevel.INFO,
            `Task APPROVED on iteration ${currentIteration}.`,
          );
          await taskRunner.finalize();
          return true;
        }
        feedback = review;
        await this.logger.log(taskId, LogLevel.WARN, `Task REJECTED. Feedback: ${feedback}`);
      }

      await this.logger.log(
        taskId,
        LogLevel.ERROR,
        `Max iterations (${maxIterations}) reached. Task failed.`,
      );
      await taskRunner.finalize();
      return false;
    } catch (error: unknown) {
      await this.logger.log(
        taskId,
        LogLevel.ERROR,
        `Orchestration failed: ${(error as Error).message}`,
      );
      await taskRunner.finalize();
      return false;
    }
  }
}
