import { ToolExecutor } from "@/executor";
import { Logger } from "@/logger";
import { SandboxManager } from "@/sandbox";
import { LogLevel, TaskStatus } from "@/types";
import type { TaskContext, ToolCommand, ToolResult } from "@/types";
import { WorkspaceManager } from "@/workspace";

export class TaskRunner {
  private workspace: WorkspaceManager;
  private sandbox: SandboxManager;
  private executor: ToolExecutor;
  private logger: Logger;
  private context: TaskContext;

  constructor(taskId: string, repoUrl?: string) {
    this.workspace = new WorkspaceManager();
    this.sandbox = new SandboxManager();
    this.logger = new Logger();
    this.executor = new ToolExecutor(this.sandbox, this.logger);

    this.context = {
      taskId,
      repoUrl,
      status: TaskStatus.CREATED,
    };
  }

  private async updateStatus(status: TaskStatus, message?: string): Promise<void> {
    this.context.status = status;
    await this.logger.log(
      this.context.taskId,
      status === TaskStatus.FAILED ? LogLevel.ERROR : LogLevel.INFO,
      message || `Task status changed to ${status}`,
    );
  }

  /**
   * Initializes the task workspace and sandbox.
   */
  async initialize(): Promise<void> {
    try {
      await this.updateStatus(TaskStatus.INITIALIZED, "Starting task initialization");

      await this.sandbox.buildImage();

      this.context.workspacePath = await this.workspace.createWorkspace(
        this.context.taskId,
        this.context.repoUrl,
      );

      this.context.containerId = await this.sandbox.startContainer(
        this.context.taskId,
        this.context.workspacePath,
      );

      await this.updateStatus(TaskStatus.RUNNING, "Sandbox ready for execution");
    } catch (error: unknown) {
      this.context.error = (error as Error).message;
      await this.updateStatus(
        TaskStatus.FAILED,
        `Initialization failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Executes a tool command.
   */
  async runTool(command: ToolCommand): Promise<ToolResult> {
    if (
      this.context.status !== TaskStatus.RUNNING &&
      this.context.status !== TaskStatus.APPLYING_CHANGES
    ) {
      throw new Error(`Cannot run tool in state: ${this.context.status}`);
    }

    try {
      await this.updateStatus(TaskStatus.APPLYING_CHANGES, `Executing tool: ${command.name}`);
      const result = await this.executor.execute(this.context.taskId, command);

      const usage = await this.sandbox.getResourceUsage(this.context.taskId);
      await this.logger.log(this.context.taskId, LogLevel.DEBUG, "Resource usage", usage);

      await this.updateStatus(TaskStatus.RUNNING);
      return result;
    } catch (error: unknown) {
      await this.logger.log(
        this.context.taskId,
        LogLevel.ERROR,
        `Tool execution failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Finalizes the task and cleans up resources.
   */
  async finalize(): Promise<void> {
    try {
      await this.updateStatus(TaskStatus.FINALIZING);

      await this.sandbox.cleanup(this.context.taskId);
      await this.workspace.deleteWorkspace(this.context.taskId);

      await this.updateStatus(TaskStatus.DESTROYED);
    } catch (error: unknown) {
      await this.updateStatus(TaskStatus.FAILED, `Cleanup failed: ${(error as Error).message}`);
      throw error;
    }
  }

  getContext(): TaskContext {
    return { ...this.context };
  }
}
