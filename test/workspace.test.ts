import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "@/workspace.ts";

describe("WorkspaceManager", () => {
  const testBaseDir = join(process.cwd(), ".test-workspaces");
  const manager = new WorkspaceManager({ baseDir: testBaseDir });

  beforeAll(async () => {
    // Ensure test base directory is clean
    await rm(testBaseDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    // Cleanup after all tests
    await rm(testBaseDir, { recursive: true, force: true });
  });

  test("should create a workspace directory", async () => {
    const taskId = "test-task-1";
    const workspacePath = await manager.createWorkspace(taskId);

    expect(workspacePath).toContain(taskId);
    expect(existsSync(workspacePath)).toBe(true);
  });

  test("should delete a workspace directory", async () => {
    const taskId = "test-task-deletable";
    const workspacePath = await manager.createWorkspace(taskId);
    expect(existsSync(workspacePath)).toBe(true);

    await manager.deleteWorkspace(taskId);
    expect(existsSync(workspacePath)).toBe(false);
  });

  test(
    "should setup git repository and create a branch",
    async () => {
      // Using a local git repo for faster/more reliable testing
      const localRepoDir = join(testBaseDir, "local-repo");
      const taskId = "git-test-task";

      await rm(localRepoDir, { recursive: true, force: true });
      await mkdir(localRepoDir, { recursive: true });
      const { $ } = await import("bun");
      await $`git init ${localRepoDir}`.quiet();
      await $`git -C ${localRepoDir} config user.email "test@example.com"`.quiet();
      await $`git -C ${localRepoDir} config user.name "Test User"`.quiet();
      await $`touch ${localRepoDir}/README.md`.quiet();
      await $`git -C ${localRepoDir} add README.md`.quiet();
      await $`git -C ${localRepoDir} commit -m "initial commit"`.quiet();

      const workspacePath = await manager.createWorkspace(taskId, localRepoDir);

      expect(existsSync(join(workspacePath, ".git"))).toBe(true);

      // Check if branch was created
      const branchOutput = await $`git -C ${workspacePath} branch --show-current`.text();
      expect(branchOutput.trim()).toBe(`task-${taskId}`);
    },
    { timeout: 30000 },
  );

  test("should cleanup all workspaces", async () => {
    await manager.createWorkspace("cleanup-1");
    await manager.createWorkspace("cleanup-2");

    await manager.cleanupAll();

    expect(existsSync(join(testBaseDir, "cleanup-1"))).toBe(false);
    expect(existsSync(join(testBaseDir, "cleanup-2"))).toBe(false);
    expect(existsSync(testBaseDir)).toBe(true);
  });
});
