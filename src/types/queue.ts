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
