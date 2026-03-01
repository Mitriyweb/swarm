import { QueuedTaskStatus } from "@/types";
import type { TaskRecord, TaskRequest } from "@/types";

/**
 * In-memory task queue. No shared state between tasks.
 * Implements magents.md §14: Concurrency Model
 */
export class TaskQueue {
  private queue: TaskRequest[] = [];
  private records: Map<string, TaskRecord> = new Map();

  enqueue(request: TaskRequest): TaskRecord {
    const record: TaskRecord = {
      request,
      status: QueuedTaskStatus.QUEUED,
      enqueuedAt: Date.now(),
    };
    this.queue.push(request);
    this.records.set(request.taskId, record);
    return record;
  }

  dequeue(): TaskRequest | undefined {
    return this.queue.shift();
  }

  getRecord(taskId: string): TaskRecord | undefined {
    return this.records.get(taskId);
  }

  updateRecord(taskId: string, update: Partial<TaskRecord>): void {
    const record = this.records.get(taskId);
    if (record) {
      Object.assign(record, update);
    }
  }

  get size(): number {
    return this.queue.length;
  }
}
