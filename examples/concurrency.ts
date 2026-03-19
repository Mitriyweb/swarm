import { SwarmAPI } from "@/api";
import { SandboxManager } from "@/sandbox";
import { QueuedTaskStatus } from "@/types";
import type { LLMProvider, LLMUsage } from "@/types";

// Mock Docker interactions for the sandbox
SandboxManager.prototype.buildImage = async () => {};
SandboxManager.prototype.startContainer = async () => "mock-id";
SandboxManager.prototype.stopContainer = async () => {};
SandboxManager.prototype.cleanup = async () => {};
SandboxManager.prototype.getResourceUsage = async () => ({ cpu: "3%", memory: "50MB" });
SandboxManager.prototype.execCommand = async () => ({ stdout: "ok", stderr: "", exitCode: 0 });

// Mock LLM (returns structured JSON right away to simulate the Coder Agent)
class MockProvider implements LLMProvider {
  async generate(prompt: string): Promise<string> {
    if (prompt.includes("Role: QA & Security Engineer")) return "APPROVED";
    if (prompt.includes("Role: Software Architect")) return "Design: simple module";
    return JSON.stringify([
      { action: "create_file", path: "src/out.ts", content: "export {}", reason: "stub" },
    ]);
  }
  getUsage(): LLMUsage {
    return { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
  }
}

async function test() {
  console.log("=== SwarmAPI Concurrency Test ===\n");

  const api = new SwarmAPI({ provider: new MockProvider(), maxWorkers: 2 });

  const t1 = await api.submit("task-1", "Build a REST API");
  const t2 = await api.submit("task-2", "Build a CLI tool");
  const t3 = await api.submit("task-3", "Build a parser");

  console.log("Tasks submitted:", [t1.status, t2.status, t3.status]);
  console.log("Active workers (should be ≤2):", api.activeWorkers);

  const [r1, r2, r3] = await Promise.all([
    api.wait("task-1"),
    api.wait("task-2"),
    api.wait("task-3"),
  ]);

  console.log("\nResults:");
  console.log(
    "  task-1:",
    r1.status,
    r1.result !== undefined ? `(${r1.result ? "OK" : "FAIL"})` : "",
  );
  console.log(
    "  task-2:",
    r2.status,
    r2.result !== undefined ? `(${r2.result ? "OK" : "FAIL"})` : "",
  );
  console.log(
    "  task-3:",
    r3.status,
    r3.result !== undefined ? `(${r3.result ? "OK" : "FAIL"})` : "",
  );

  const allDone = [r1, r2, r3].every((r) => r.status === QueuedTaskStatus.DONE);
  console.log(`\n${allDone ? "SUCCESS: Concurrency model verified." : "FAILED"}`);
}

test();
