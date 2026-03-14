import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { SQLiteQueue } from "@/queue_sqlite";
import { QueuedTaskStatus } from "@/types";
import { unlinkSync, existsSync } from "node:fs";

describe("SQLiteQueue", () => {
  const dbFile = "test-tasks.db";

  beforeAll(() => {
    if (existsSync(dbFile)) unlinkSync(dbFile);
  });

  afterAll(() => {
    if (existsSync(dbFile)) unlinkSync(dbFile);
  });

  it("should enqueue and dequeue tasks", async () => {
    const queue = new SQLiteQueue(dbFile);
    const request = { taskId: "task-1", prompt: "hello" };

    await queue.enqueue(request);
    expect(await queue.getSize()).toBe(1);

    const dequeued = await queue.dequeue();
    expect(dequeued).toEqual(request);
    expect(await queue.getSize()).toBe(0);
  });

  it("should update and retrieve task records", async () => {
    const queue = new SQLiteQueue(dbFile);
    const request = { taskId: "task-2", prompt: "world" };

    await queue.enqueue(request);
    await queue.updateRecord("task-2", { status: QueuedTaskStatus.RUNNING, startedAt: 123 });

    const record = await queue.getRecord("task-2");
    expect(record?.status).toBe(QueuedTaskStatus.RUNNING);
    expect(record?.startedAt).toBe(123);
    expect(record?.request).toEqual(request);
  });
});
