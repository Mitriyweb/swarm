import type { QueuedTaskStatus, TaskRequest } from "@/types/queue";

export enum TaskStatus {
  CREATED = "CREATED",
  INITIALIZED = "INITIALIZED",
  RUNNING = "RUNNING",
  APPLYING_CHANGES = "APPLYING_CHANGES",
  FINALIZING = "FINALIZING",
  DESTROYED = "DESTROYED",
  FAILED = "FAILED",
}

export enum OrchestrationState {
  PLANNING = "PLANNING",
  ARCHITECTING = "ARCHITECTING",
  CODING = "CODING",
  REVIEWING = "REVIEWING",
  COMMITTED = "COMMITTED",
  FAILED = "FAILED",
}

export interface TaskContext {
  taskId: string;
  repoUrl?: string;
  workspacePath?: string;
  containerId?: string;
  status: TaskStatus;
  error?: string;
}

