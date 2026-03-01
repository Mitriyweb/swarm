import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { LogLevel } from "@/types";
import type { LogEntry } from "@/types";

export class Logger {
  private logDir: string;

  constructor(logDir?: string) {
    this.logDir = logDir || join(process.cwd(), "logs");
  }

  private async ensureLogDir(taskId: string): Promise<string> {
    const taskLogDir = join(this.logDir, taskId);
    await mkdir(taskLogDir, { recursive: true });
    return taskLogDir;
  }

  async log(taskId: string, level: LogLevel, message: string, data?: unknown): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      taskId,
      message,
      data,
    };

    const taskLogDir = await this.ensureLogDir(taskId);
    const logFile = join(taskLogDir, "events.jsonl");

    await appendFile(logFile, `${JSON.stringify(entry)}\n`);

    if (level === LogLevel.ERROR) {
      console.error(`[${level}] [${taskId}] ${message}`, data || "");
    } else {
      console.log(`[${level}] [${taskId}] ${message}`);
    }
  }

  async logToolResult(
    taskId: string,
    tool: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    await this.log(
      taskId,
      result.success ? LogLevel.INFO : LogLevel.ERROR,
      `Tool executed: ${tool}`,
      {
        tool,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    );
  }
}
