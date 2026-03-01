import { join } from "node:path";
import type { SandboxOptions } from "@/types";
import { $ } from "bun";

export class SandboxManager {
  private cpuLimit: string;
  private memoryLimit: string;
  private imageName: string;
  private dockerfilePath: string;

  constructor(options: SandboxOptions = {}) {
    this.cpuLimit = options.cpuLimit || "1";
    this.memoryLimit = options.memoryLimit || "2g";
    this.imageName = options.imageName || "swarm-sandbox";
    this.dockerfilePath =
      options.dockerfilePath || join(process.cwd(), "docker", "sandbox.Dockerfile");
  }

  /**
   * Builds the sandbox image.
   */
  async buildImage(): Promise<void> {
    try {
      console.log(`Building sandbox image: ${this.imageName}...`);
      await $`docker build -t ${this.imageName} -f ${this.dockerfilePath} .`.quiet();
    } catch (error) {
      console.error("Failed to build docker image:", error);
      throw new Error(`Docker build failed: ${error}`);
    }
  }

  /**
   * Starts a container for a task.
   * @param taskId Unique identifier for the task.
   * @param workspacePath Absolute path to the workspace directory.
   * @returns The container ID.
   */
  async startContainer(taskId: string, workspacePath: string): Promise<string> {
    const containerName = `swarm-task-${taskId}`;

    try {
      const result = await $`docker run -d \
        --name ${containerName} \
        --cpus ${this.cpuLimit} \
        --memory ${this.memoryLimit} \
        --pids-limit 100 \
        --network none \
        --security-opt no-new-privileges \
        --read-only \
        --tmpfs /tmp \
        -v ${workspacePath}:/workspace \
        ${this.imageName} \
        tail -f /dev/null`
        .quiet()
        .text();

      return result.trim();
    } catch (error) {
      console.error(`Failed to start container for task ${taskId}:`, error);
      throw new Error(`Container startup failed: ${error}`);
    }
  }

  /**
   * Executes a command inside the container.
   * @param taskId Unique identifier for the task.
   * @param command Command to execute.
   * @param timeoutMs Maximum time to wait for the command.
   * @returns Exec result object.
   */
  async execCommand(
    taskId: string,
    command: string[],
    timeoutMs?: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerName = `swarm-task-${taskId}`;

    try {
      const shellPromise = $`docker exec ${containerName} ${command}`.quiet();

      const rawResult = await (timeoutMs
        ? Promise.race([
            shellPromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    Object.assign(new Error(`Command timed out after ${timeoutMs}ms`), {
                      isTimeout: true,
                    }),
                  ),
                timeoutMs,
              ),
            ),
          ])
        : shellPromise);

      const { stdout, stderr, exitCode } = rawResult;

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode,
      };
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      const isTimeout = err.isTimeout === true;
      return {
        stdout: "",
        stderr: isTimeout
          ? `Command timed out after ${timeoutMs}ms`
          : (err.message as string) || String(error),
        exitCode: isTimeout ? 124 : (err.exitCode as number) || 1,
      };
    }
  }

  /**
   * Stops and removes the container for a task.
   * @param taskId Unique identifier for the task.
   */
  async stopContainer(taskId: string): Promise<void> {
    const containerName = `swarm-task-${taskId}`;
    try {
      await $`docker rm -f ${containerName}`.quiet();
    } catch (error) {
      console.warn(`Failed to stop container ${containerName}:`, error);
    }
  }

  /**
   * Gets resource usage for a task container.
   * @param taskId Unique identifier for the task.
   */
  async getResourceUsage(taskId: string): Promise<{ cpu: string; memory: string }> {
    const containerName = `swarm-task-${taskId}`;
    try {
      const stats =
        await $`docker stats ${containerName} --no-stream --format "{{.CPUPerc}},{{.MemUsage}}"`
          .quiet()
          .text();
      const [cpu, mem] = stats.trim().split(",");
      return { cpu: cpu || "0%", memory: mem || "0/0" };
    } catch {
      return { cpu: "unknown", memory: "unknown" };
    }
  }

  /**
   * Complete cleanup for a task.
   */
  async cleanup(taskId: string): Promise<void> {
    await this.stopContainer(taskId);
  }
}
