import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { Logger } from "@/logger";
import { LogLevel } from "@/types";

describe("Logger", () => {
  const testLogDir = join(process.cwd(), "test-logs");

  beforeAll(async () => {
    // Clean up before tests
    await rm(testLogDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    // Clean up after tests
    await rm(testLogDir, { recursive: true, force: true });
  });

  it("should log entries to a JSONL file", async () => {
    const logger = new Logger(testLogDir);
    const taskId = "task-123";
    const message = "Test message";

    await logger.log(taskId, LogLevel.INFO, message, { key: "value" });

    const logFile = join(testLogDir, taskId, "events.jsonl");
    const content = await readFile(logFile, "utf-8");
    const entry = JSON.parse(content.trim());

    expect(entry.taskId).toBe(taskId);
    expect(entry.level).toBe(LogLevel.INFO);
    expect(entry.message).toBe(message);
    expect(entry.data.key).toBe("value");
    expect(entry.timestamp).toBeDefined();
  });

  it("should log errors to console and file", async () => {
    const logger = new Logger(testLogDir);
    const taskId = "task-456";
    const message = "Error message";

    // Spy on console.error
    const consoleSpy = console.error;
    let intercepted = "";
    console.error = (...args: any[]) => {
      intercepted += args.join(" ");
    };

    await logger.log(taskId, LogLevel.ERROR, message);

    console.error = consoleSpy;

    expect(intercepted).toContain(message);
    expect(intercepted).toContain(taskId);

    const logFile = join(testLogDir, taskId, "events.jsonl");
    const content = await readFile(logFile, "utf-8");
    expect(content).toContain(message);
  });

  it("should log tool results", async () => {
    const logger = new Logger(testLogDir);
    const taskId = "task-789";

    await logger.logToolResult(taskId, "read_file", {
      success: true,
      exitCode: 0,
      stdout: "content",
      stderr: "",
    });

    const logFile = join(testLogDir, taskId, "events.jsonl");
    const content = await readFile(logFile, "utf-8");
    const entry = JSON.parse(content.trim());

    expect(entry.message).toBe("Tool executed: read_file");
    expect(entry.level).toBe(LogLevel.INFO);
    expect(entry.data.tool).toBe("read_file");
    expect(entry.data.stdout).toBe("content");
  });

  it("should use default log directory if none provided", async () => {
    const logger = new Logger();
    expect((logger as any).logDir).toBe(join(process.cwd(), "logs"));
  });
});
