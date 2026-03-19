export enum QueuedTaskStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  DONE = "DONE",
  FAILED = "FAILED",
}

export interface TaskRequest {
  taskId: string;
  prompt: string;
  maxIterations?: number;
}

export interface TaskRecord {
  request: TaskRequest;
  status: QueuedTaskStatus;
  result?: boolean;
  error?: string;
  enqueuedAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface QueueAdapter {
  enqueue(request: TaskRequest): Promise<TaskRecord>;
  dequeue(): Promise<TaskRequest | undefined>;
  getRecord(taskId: string): Promise<TaskRecord | undefined>;
  updateRecord(taskId: string, update: Partial<TaskRecord>): Promise<void>;
  getSize(): Promise<number>;
}
