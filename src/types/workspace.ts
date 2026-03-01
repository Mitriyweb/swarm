export interface SandboxOptions {
  cpuLimit?: string;
  memoryLimit?: string;
  imageName?: string;
  dockerfilePath?: string;
}

export interface WorkspaceOptions {
  baseDir?: string;
  repoUrl?: string;
  branch?: string;
}
