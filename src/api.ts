import { QueuedTaskStatus } from "@/types";
import type { SwarmConfig, TaskRecord } from "@/types";
import { WorkerPool } from "@/worker";

export class SwarmAPI {
  private pool: WorkerPool;

  constructor(config: SwarmConfig) {
    this.pool = new WorkerPool(config.provider, config.maxWorkers ?? 4);
  }

  /**
   * Submits a new task to the swarm.
   */
  submit(taskId: string, prompt: string, maxIterations?: number): TaskRecord {
    return this.pool.submit({ taskId, prompt, maxIterations });
  }

  /**
   * Returns the current status of a task.
   */
  getStatus(taskId: string): TaskRecord | undefined {
    return this.pool.getStatus(taskId);
  }

  /**
   * Waits for a task to complete and returns its record.
   */
  async wait(taskId: string, pollIntervalMs = 500, timeoutMs = 300_000): Promise<TaskRecord> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const record = this.getStatus(taskId);
      if (
        record &&
        (record.status === QueuedTaskStatus.DONE || record.status === QueuedTaskStatus.FAILED)
      ) {
        return record;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
  }

  get activeWorkers(): number {
    return this.pool.activeCount;
  }
}
