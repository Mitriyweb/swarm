import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { WorkspaceOptions } from "@/types";
import { $ } from "bun";

export class WorkspaceManager {
  private baseDir: string;

  constructor(options: WorkspaceOptions = {}) {
    this.baseDir = options.baseDir || join(process.cwd(), ".workspaces");
  }

  /**
   * Creates a workspace for a specific task.
   * @param taskId Unique identifier for the task.
   * @param repoUrl Git repository URL to clone (optional).
   * @returns The absolute path to the workspace directory.
   */
  async createWorkspace(taskId: string, repoUrl?: string): Promise<string> {
    const workspacePath = join(this.baseDir, taskId);

    await mkdir(this.baseDir, { recursive: true });
    await rm(workspacePath, { recursive: true, force: true });
    await mkdir(workspacePath, { recursive: true });

    if (repoUrl) {
      try {
        await $`git clone ${repoUrl} ${workspacePath}`.quiet();

        const branchName = `task-${taskId}`;
        await $`git -C ${workspacePath} checkout -b ${branchName}`.quiet();
      } catch (error) {
        console.error(`Failed to setup git repo in ${workspacePath}:`, error);
        throw new Error(`Workspace setup failed: ${error}`);
      }
    }

    return workspacePath;
  }

  /**
   * Deletes a workspace directory.
   * @param taskId Unique identifier for the task.
   */
  async deleteWorkspace(taskId: string): Promise<void> {
    const workspacePath = join(this.baseDir, taskId);
    await rm(workspacePath, { recursive: true, force: true });
  }

  /**
   * Cleans up all workspaces in the base directory.
   */
  async cleanupAll(): Promise<void> {
    await rm(this.baseDir, { recursive: true, force: true });
    await mkdir(this.baseDir, { recursive: true });
  }
}
