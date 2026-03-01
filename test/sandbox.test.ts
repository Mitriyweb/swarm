import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { SandboxManager } from "@/sandbox.ts";
import { WorkspaceManager } from "@/workspace.ts";
import { $ } from "bun";

const dockerAvailable = await (async () => {
  try {
    await $`docker info`.quiet();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!dockerAvailable)("SandboxManager", () => {
  const testBaseDir = join(process.cwd(), ".test-sandbox-workspaces");
  const workspaceManager = new WorkspaceManager({ baseDir: testBaseDir });
  const sandboxManager = new SandboxManager();
  const taskId = "sandbox-test-task";
  let workspacePath: string;

  beforeAll(async () => {
    // Build the image first
    await sandboxManager.buildImage();
    workspacePath = await workspaceManager.createWorkspace(taskId);
  });

  afterAll(async () => {
    await sandboxManager.stopContainer(taskId);
    await workspaceManager.cleanupAll();
    await rm(testBaseDir, { recursive: true, force: true });
  });

  test("should start a container", async () => {
    const containerId = await sandboxManager.startContainer(taskId, workspacePath);
    expect(containerId).toBeDefined();
    expect(containerId.length).toBeGreaterThan(0);
  });

  test("should execute a command inside the container", async () => {
    const result = await sandboxManager.execCommand(taskId, ["node", "-v"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("v20");
  });

  test("should see workspace files inside the container", async () => {
    // Create a file in the workspace
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(workspacePath, "test.txt"), "hello from host");

    const result = await sandboxManager.execCommand(taskId, ["cat", "/workspace/test.txt"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello from host");
  });

  test("should enforce resource limits (informative)", async () => {
    // This is hard to test deterministically without external tools,
    // but we can check if the container has the expected limits.
    const { $ } = await import("bun");
    const containerName = `swarm-task-${taskId}`;
    const inspectOutput =
      await $`docker inspect ${containerName} --format '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}'`.text();
    const [memory, cpu] = inspectOutput.trim().split(" ");

    // 2g = 2147483648, 1 cpu = 1000000000
    expect(memory).toBe("2147483648");
    expect(cpu).toBe("1000000000");
  });
});
