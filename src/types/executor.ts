export enum ToolCommandName {
  CREATE_FILE = "create_file",
  MODIFY_FILE = "modify_file",
  READ_FILE = "read_file",
  DELETE_FILE = "delete_file",
  LIST_DIR = "list_dir",
  GIT_ADD = "git_add",
  GIT_COMMIT = "git_commit",
  INSTALL_DEPENDENCIES = "install_dependencies",
  RUN_TESTS = "run_tests",
  BUILD_PROJECT = "build_project",
}

export interface ToolCommand {
  name: ToolCommandName;
  args: Record<string, string | undefined>;
}

export interface ToolResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}
