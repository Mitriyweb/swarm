import { Logger } from "@/logger";
import { Orchestrator } from "@/orchestrator";
import { TaskQueue } from "@/queue";
import { QueuedTaskStatus } from "@/types";
import type { LLMProvider, TaskRecord, TaskRequest } from "@/types";

/**
 * Worker pool that manages concurrent Orchestrator instances.
 * Each task runs in its own isolated context — no shared state.
 * Implements magents.md §14: Concurrency Model
 */
export class WorkerPool {
  private activeWorkers = 0;
  private queue: TaskQueue;
  private logger: Logger;

  constructor(
    private provider: LLMProvider,
    private maxWorkers = 4,
  ) {
    this.queue = new TaskQueue();
    this.logger = new Logger();
  }

  /**
   * Submits a task to the queue. Returns the initial task record.
   */
  submit(request: TaskRequest): TaskRecord {
    const record = this.queue.enqueue(request);
    this.processNext();
    return record;
  }

  /**
   * Gets the current status of a task.
   */
  getStatus(taskId: string): TaskRecord | undefined {
    return this.queue.getRecord(taskId);
  }

  /**
   * Processes the next task in the queue if a worker slot is available.
   */
  private processNext(): void {
    if (this.activeWorkers >= this.maxWorkers) return;

    const next = this.queue.dequeue();
    if (!next) return;

    this.activeWorkers++;
    this.queue.updateRecord(next.taskId, {
      status: QueuedTaskStatus.RUNNING,
      startedAt: Date.now(),
    });

    Orchestrator.create(this.provider, this.logger)
      .then((orchestrator) =>
        orchestrator.executeTask(next.taskId, next.prompt, next.maxIterations),
      )
      .then((result) => {
        this.queue.updateRecord(next.taskId, {
          status: result ? QueuedTaskStatus.DONE : QueuedTaskStatus.FAILED,
          result,
          finishedAt: Date.now(),
        });
      })
      .catch((err: Error) => {
        this.queue.updateRecord(next.taskId, {
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
