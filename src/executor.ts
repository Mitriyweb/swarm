import type { Logger } from "@/logger";
import { validateFilePath } from "@/safety";
import type { SandboxManager } from "@/sandbox";
import { ToolCommandName } from "@/types";
import type { ToolCommand, ToolResult } from "@/types";
import type { ToolConfig } from "@/types/config";

export class ToolExecutor {
  private timeouts: Record<string, number>;
  private pathValidatedCommands: Set<string>;

  constructor(
    private sandbox: SandboxManager,
    private logger?: Logger,
    toolConfigs: ToolConfig[] = [],
  ) {
    // Build timeout map from configs; fall back to 30s default
    this.timeouts = { default: 30000 };
    this.pathValidatedCommands = new Set();

    for (const cfg of toolConfigs) {
      if (cfg.timeout !== undefined) {
        this.timeouts[cfg.name] = cfg.timeout;
      }
      if (cfg.requiresPathValidation) {
        this.pathValidatedCommands.add(cfg.name);
      }
    }

    // Ensure built-in defaults when no configs provided
    if (toolConfigs.length === 0) {
      this.timeouts[ToolCommandName.INSTALL_DEPENDENCIES] = 300000;
      this.timeouts[ToolCommandName.RUN_TESTS] = 60000;
      this.timeouts[ToolCommandName.BUILD_PROJECT] = 120000;

      this.pathValidatedCommands.add(ToolCommandName.READ_FILE);
      this.pathValidatedCommands.add(ToolCommandName.CREATE_FILE);
      this.pathValidatedCommands.add(ToolCommandName.DELETE_FILE);
      this.pathValidatedCommands.add(ToolCommandName.MODIFY_FILE);
      this.pathValidatedCommands.add(ToolCommandName.LIST_DIR);
    }
  }

  /**
   * Executes a whitelisted tool command inside a sandbox container.
   */
  async execute(taskId: string, command: ToolCommand): Promise<ToolResult> {
    let shellCmd: string[] = [];

    if (this.pathValidatedCommands.has(command.name) && command.args.path) {
      const { valid, reason } = validateFilePath(command.args.path);
      if (!valid) {
        return { stdout: "", stderr: `Security violation: ${reason}`, exitCode: 1, success: false };
      }
    }

    switch (command.name) {
      case ToolCommandName.READ_FILE:
        if (!command.args.path) throw new Error("Missing path argument for read_file");
        shellCmd = ["cat", command.args.path];
        break;

      case ToolCommandName.LIST_DIR:
        shellCmd = ["ls", "-laR", command.args.path || "."];
        break;

      case ToolCommandName.CREATE_FILE:
        if (!command.args.path || command.args.content === undefined) {
          throw new Error("Missing path or content for create_file");
        }
        shellCmd = [
          "sh",
          "-c",
          `printf "%s" "${command.args.content.replace(/"/g, '\\"')}" > "${command.args.path}"`,
        ];
        break;

      case ToolCommandName.DELETE_FILE:
        if (!command.args.path) throw new Error("Missing path for delete_file");
        shellCmd = ["rm", "-f", command.args.path];
        break;

      case ToolCommandName.INSTALL_DEPENDENCIES:
        shellCmd = ["npm", "install"];
        break;

      case ToolCommandName.RUN_TESTS:
        shellCmd = ["npm", "test"];
        break;

      case ToolCommandName.BUILD_PROJECT:
        shellCmd = ["npm", "run", "build"];
        break;

      case ToolCommandName.GIT_ADD:
        shellCmd = ["git", "add", command.args.path || "."];
        break;

      case ToolCommandName.GIT_COMMIT:
        if (!command.args.message) throw new Error("Missing message for git_commit");
        shellCmd = ["git", "commit", "-m", command.args.message];
        break;

      case ToolCommandName.MODIFY_FILE:
        if (!command.args.path || command.args.content === undefined) {
          throw new Error("Missing path or content for modify_file");
        }
        shellCmd = [
          "sh",
          "-c",
          `printf "%s" "${command.args.content.replace(/"/g, '\\"')}" > "${command.args.path}"`,
        ];
        break;

      default:
        throw new Error(`Command ${command.name} is not whitelisted or implemented.`);
    }

    const timeout = this.timeouts[command.name] ?? this.timeouts.default;
    const result = await this.sandbox.execCommand(taskId, shellCmd, timeout);

    const toolResult: ToolResult = {
      ...result,
      success: result.exitCode === 0,
    };

    if (this.logger) {
      await this.logger.logToolResult(taskId, command.name, { ...toolResult });
    }

    return toolResult;
  }
}
