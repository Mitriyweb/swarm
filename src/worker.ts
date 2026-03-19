import { Logger } from "@/logger";
import { Orchestrator } from "@/orchestrator";
import { InMemoryQueue } from "@/queue";
import { QueuedTaskStatus } from "@/types";
import type { LLMProvider, QueueAdapter, TaskRecord, TaskRequest } from "@/types";

/**
 * Worker pool that manages concurrent Orchestrator instances.
 * Each task runs in its own isolated context — no shared state.
 * Implements magents.md §14: Concurrency Model
 */
export class WorkerPool {
  private activeWorkers = 0;
  private queue: QueueAdapter;
  private logger: Logger;

  constructor(
    private provider: LLMProvider,
    private maxWorkers = 4,
    queue?: QueueAdapter,
  ) {
    this.queue = queue ?? new InMemoryQueue();
    this.logger = new Logger();
  }

  /**
   * Submits a task to the queue. Returns the initial task record.
   */
  async submit(request: TaskRequest): Promise<TaskRecord> {
    const record = await this.queue.enqueue(request);
    this.processNext();
    return record;
  }

  /**
   * Gets the current status of a task.
   */
  async getStatus(taskId: string): Promise<TaskRecord | undefined> {
    return this.queue.getRecord(taskId);
  }

  /**
   * Processes the next task in the queue if a worker slot is available.
   */
  private async processNext(): Promise<void> {
    if (this.activeWorkers >= this.maxWorkers) return;

    const next = await this.queue.dequeue();
    if (!next) return;

    this.activeWorkers++;
    await this.queue.updateRecord(next.taskId, {
      status: QueuedTaskStatus.RUNNING,
      startedAt: Date.now(),
    });

    Orchestrator.create(this.provider, this.logger)
      .then((orchestrator) =>
        orchestrator.executeTask(next.taskId, next.prompt, next.maxIterations),
      )
      .then(async (result) => {
        await this.queue.updateRecord(next.taskId, {
          status: result ? QueuedTaskStatus.DONE : QueuedTaskStatus.FAILED,
          result,
          finishedAt: Date.now(),
        });
      })
      .catch(async (err: Error) => {
        await this.queue.updateRecord(next.taskId, {
          status: QueuedTaskStatus.FAILED,
          error: err.message,
          finishedAt: Date.now(),
        });
      })
      .finally(() => {
        this.activeWorkers--;
        this.processNext();
      });
  }

  get activeCount(): number {
    return this.activeWorkers;
  }
}
