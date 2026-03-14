import { describe, expect, it, mock } from "bun:test";
import { ToolExecutor } from "@/executor";
import type { SandboxManager } from "@/sandbox";
import { ToolCommandName } from "@/types";

describe("ToolExecutor", () => {
  const mockSandbox = {
    execCommand: mock(() => Promise.resolve({ stdout: "ok", stderr: "", exitCode: 0 })),
  } as unknown as SandboxManager;

  it("should execute read_file command", async () => {
    const executor = new ToolExecutor(mockSandbox);
    const result = await executor.execute("test-task", {
      name: ToolCommandName.READ_FILE,
      args: { path: "test.txt" },
    });

    expect(result.success).toBe(true);
    expect(mockSandbox.execCommand).toHaveBeenCalledWith(
      "test-task",
      ["cat", "test.txt"],
      expect.any(Number),
    );
  });

  it("should fail for security violation", async () => {
    const executor = new ToolExecutor(mockSandbox);
    const result = await executor.execute("test-task", {
      name: ToolCommandName.READ_FILE,
      args: { path: "/etc/passwd" },
    });

    expect(result.success).toBe(false);
    expect(result.stderr).toContain("Security violation");
  });
});
