import { Database } from "bun:sqlite";
import { QueuedTaskStatus } from "@/types";
import type { QueueAdapter, TaskRecord, TaskRequest } from "@/types";

export class SQLiteQueue implements QueueAdapter {
  private db: Database;

  constructor(filename = "tasks.db") {
    this.db = new Database(filename);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        taskId TEXT PRIMARY KEY,
        request TEXT NOT NULL,
        status TEXT NOT NULL,
        result INTEGER,
        error TEXT,
        enqueuedAt INTEGER NOT NULL,
        startedAt INTEGER,
        finishedAt INTEGER
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL UNIQUE
      )
    `);
  }

  async enqueue(request: TaskRequest): Promise<TaskRecord> {
    const record: TaskRecord = {
      request,
      status: QueuedTaskStatus.QUEUED,
      enqueuedAt: Date.now(),
    };

    this.db.run("INSERT INTO tasks (taskId, request, status, enqueuedAt) VALUES (?, ?, ?, ?)", [
      request.taskId,
      JSON.stringify(request),
      record.status,
      record.enqueuedAt,
    ]);
    this.db.run("INSERT INTO queue (taskId) VALUES (?)", [request.taskId]);

    return record;
  }

  async dequeue(): Promise<TaskRequest | undefined> {
    const row = this.db.query("SELECT taskId FROM queue ORDER BY id ASC LIMIT 1").get() as {
      taskId: string;
    } | null;
    if (!row) return undefined;

    this.db.run("DELETE FROM queue WHERE taskId = ?", [row.taskId]);

    const taskRow = this.db.query("SELECT request FROM tasks WHERE taskId = ?").get(row.taskId) as {
      request: string;
    } | null;
    return taskRow ? JSON.parse(taskRow.request) : undefined;
  }

  async getRecord(taskId: string): Promise<TaskRecord | undefined> {
    const row = this.db.query("SELECT * FROM tasks WHERE taskId = ?").get(taskId) as {
      request: string;
      status: string;
      result: number | null;
      error: string | null;
      enqueuedAt: number;
      startedAt: number | null;
      finishedAt: number | null;
    } | null;
    if (!row) return undefined;

    return {
      request: JSON.parse(row.request),
      status: row.status as QueuedTaskStatus,
      result: row.result === null ? undefined : Boolean(row.result),
      error: row.error || undefined,
      enqueuedAt: row.enqueuedAt,
      startedAt: row.startedAt || undefined,
      finishedAt: row.finishedAt || undefined,
    };
  }

  async updateRecord(taskId: string, update: Partial<TaskRecord>): Promise<void> {
    const sets: string[] = [];
    const params: (string | number)[] = [];

    if (update.status) {
      sets.push("status = ?");
      params.push(update.status);
    }
    if (update.result !== undefined) {
      sets.push("result = ?");
      params.push(update.result ? 1 : 0);
    }
    if (update.error !== undefined) {
      sets.push("error = ?");
      params.push(update.error);
    }
    if (update.startedAt !== undefined) {
      sets.push("startedAt = ?");
      params.push(update.startedAt);
    }
    if (update.finishedAt !== undefined) {
      sets.push("finishedAt = ?");
      params.push(update.finishedAt);
    }

    if (sets.length === 0) return;

    params.push(taskId);
    this.db.run(`UPDATE tasks SET ${sets.join(", ")} WHERE taskId = ?`, params);
  }

  async getSize(): Promise<number> {
    const row = this.db.query("SELECT COUNT(*) as count FROM queue").get() as { count: number };
    return row.count;
  }
}
