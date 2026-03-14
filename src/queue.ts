import { QueuedTaskStatus } from "@/types";
import type { QueueAdapter, TaskRecord, TaskRequest } from "@/types";

/**
 * In-memory task queue. No shared state between tasks.
 * Implements magents.md §14: Concurrency Model
 */
export class InMemoryQueue implements QueueAdapter {
  private queue: TaskRequest[] = [];
  private records: Map<string, TaskRecord> = new Map();

  async enqueue(request: TaskRequest): Promise<TaskRecord> {
    const record: TaskRecord = {
      request,
      status: QueuedTaskStatus.QUEUED,
      enqueuedAt: Date.now(),
    };
    this.queue.push(request);
    this.records.set(request.taskId, record);
    return record;
  }

  async dequeue(): Promise<TaskRequest | undefined> {
    return this.queue.shift();
  }

  async getRecord(taskId: string): Promise<TaskRecord | undefined> {
    return this.records.get(taskId);
  }

  async updateRecord(taskId: string, update: Partial<TaskRecord>): Promise<void> {
    const record = this.records.get(taskId);
    if (record) {
      Object.assign(record, update);
    }
  }

  async getSize(): Promise<number> {
    return this.queue.length;
  }
}
