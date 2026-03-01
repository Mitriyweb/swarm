export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

export interface LogEntry {
  timestamp: string;
  taskId: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}
