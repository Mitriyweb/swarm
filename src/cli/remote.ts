interface RemoteFile {
  name: string;
  path: string;
}

interface RemoteSource {
  id: string;
  label: string;
  description: string;
  repo: string;
  branch: string;
  dir: string;
  files: RemoteFile[];
}

export const REMOTE_SOURCES: RemoteSource[] = [
  {
    id: "agent-team-swdev",
    label: "Mitriyweb/agent-team — Software Development Team",
    description: "Team-lead, Architect, Developer, Reviewer, QA",
    repo: "Mitriyweb/agent-team",
    branch: "main",
    dir: "agents/software",
    files: [
      { name: "PROTOCOL", path: "sw-PROTOCOL.md" },
      { name: "team-lead", path: "sw-team-lead.md" },
      { name: "architect", path: "sw-architect.md" },
      { name: "developer", path: "sw-developer.md" },
      { name: "reviewer", path: "sw-reviewer.md" },
      { name: "qa", path: "sw-qa.md" },
    ],
  },
  {
    id: "ecc-tdd",
    label: "affaan-m/everything-claude-code — TDD Workflow",
    description: "Test-driven development workflow skill",
    repo: "affaan-m/everything-claude-code",
    branch: "main",
    dir: ".agents/skills/tdd-workflow",
    files: [{ name: "tdd-workflow", path: "SKILL.md" }],
  },
  {
    id: "ecc-coding-standards",
    label: "affaan-m/everything-claude-code — Coding Standards",
    description: "Coding standards and best practices skill",
    repo: "affaan-m/everything-claude-code",
    branch: "main",
    dir: ".agents/skills/coding-standards",
    files: [{ name: "coding-standards", path: "SKILL.md" }],
  },
  {
    id: "ecc-security-review",
    label: "affaan-m/everything-claude-code — Security Review",
    description: "Security review skill",
    repo: "affaan-m/everything-claude-code",
    branch: "main",
    dir: ".agents/skills/security-review",
    files: [{ name: "security-review", path: "SKILL.md" }],
  },
  {
    id: "ecc-backend-patterns",
    label: "affaan-m/everything-claude-code — Backend Patterns",
    description: "Backend architecture patterns skill",
    repo: "affaan-m/everything-claude-code",
    branch: "main",
    dir: ".agents/skills/backend-patterns",
    files: [{ name: "backend-patterns", path: "SKILL.md" }],
  },
];

async function fetchRemoteFile(repo: string, branch: string, filePath: string): Promise<string> {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${encoded}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function downloadSource(source: RemoteSource, destDir: string): Promise<string[]> {
  const downloaded: string[] = [];
  for (const file of source.files) {
    const remotePath = `${source.dir}/${file.path}`;
    const content = await fetchRemoteFile(source.repo, source.branch, remotePath);
    const localPath = `${destDir}/${file.name}.md`;
    await Bun.write(localPath, content);
    downloaded.push(localPath);
  }
  return downloaded;
}
