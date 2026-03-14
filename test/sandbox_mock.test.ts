import { describe, expect, it, mock } from "bun:test";
import { SandboxManager } from "@/sandbox";

// We can mock the Bun shell ($) by overriding it or using a wrapper
// For now, let's just test the configuration logic of SandboxManager

describe("SandboxManager", () => {
  it("should initialize with default options", () => {
    const sandbox = new SandboxManager() as any;
    expect(sandbox.cpuLimit).toBe("1");
    expect(sandbox.memoryLimit).toBe("2g");
  });

  it("should initialize with custom options", () => {
    const sandbox = new SandboxManager({ cpuLimit: "2", memoryLimit: "4g" }) as any;
    expect(sandbox.cpuLimit).toBe("2");
    expect(sandbox.memoryLimit).toBe("4g");
  });
});
