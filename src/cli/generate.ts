import { join } from "node:path";
import type { InitConfig, RoleDefinition } from "./types";

const IMPLEMENTER_TOOLS = [
  "create_file: Create a new file (requires path, content)",
  "modify_file: Modify an existing file (requires path, content)",
  "read_file: Read a file (requires path)",
  "delete_file: Delete a file (requires path)",
  "list_dir: List directory contents (requires path)",
  "git_add: Stage files (requires path)",
  "git_commit: Commit changes (requires message)",
  "install_dependencies: Install packages (requires reason)",
  "run_tests: Run the test suite (requires reason)",
  "build_project: Build the project (requires reason)",
].join("\n- ");

function plannerBody(role: RoleDefinition): string {
  return `\
Your goal is to design the technical structure of the requested change.
Analyze the task and provide a clear plan: which files need to be created or modified,
what architectural patterns should be used, and what the implementation steps are.
Be concise and specific — the next agent will implement based on your output.`;
}

function implementerBody(role: RoleDefinition): string {
  return `\
Your goal is to implement the requested changes.
You MUST return ONLY a valid JSON array of tool calls. No explanation or extra text.
Each tool call: {"action": "tool_name", "path": "...", "content": "...", "message": "...", "reason": "..."}

Available tools:
- ${IMPLEMENTER_TOOLS}`;
}

function reviewerBody(role: RoleDefinition): string {
  return `\
Your goal is to review the implemented changes.
Verify correctness, code quality, security, and adherence to the original plan.
Return APPROVED if everything is correct, or provide specific feedback if revisions are needed.`;
}

function genericBody(role: RoleDefinition): string {
  return `\
Your goal is to fulfill your role as ${role.role}.
${role.description}.
Process the input you receive and produce high-quality, precise output.`;
}

function skillBody(role: RoleDefinition, cycleIdx: number, total: number): string {
  if (role.structured) return implementerBody(role);
  if (cycleIdx === 0) return plannerBody(role);
  if (cycleIdx === total - 1) return reviewerBody(role);
  return genericBody(role);
}

function skillMd(role: RoleDefinition, cycleIdx: number, total: number): string {
  const front = [
    "---",
    `name: ${role.name}`,
    `role: ${role.role}`,
    `description: ${role.description}`,
    `color: ${role.color}`,
    `structured: ${role.structured}`,
    "---",
  ].join("\n");

  return `${front}\n${skillBody(role, cycleIdx, total)}\n`;
}

function swarmConfigJson(config: InitConfig): string {
  const llmDefault: Record<string, unknown> = {
    provider: config.defaultProvider,
    model: config.defaultModel,
    maxTokens: 1024,
  };
  if (config.defaultProvider === "ollama") {
    llmDefault.endpoint = config.ollamaEndpoint ?? "http://localhost:11434";
  }

  const roleOverrides: Record<string, unknown> = {};
  for (const role of config.roles) {
    if (role.llmProvider) {
      const override: Record<string, unknown> = {
        provider: role.llmProvider,
        model: role.llmModel ?? config.defaultModel,
      };
      if (role.llmProvider === "ollama") {
        override.endpoint = role.llmEndpoint ?? config.ollamaEndpoint ?? "http://localhost:11434";
      }
      roleOverrides[role.name] = override;
    }
  }

  const out: Record<string, unknown> = {
    skillsDir: config.skillsDir ?? ".swarm/skills",
    cycle: config.cycle,
    maxIterations: config.maxIterations,
    maxWorkers: config.maxWorkers,
    llm: {
      default: llmDefault,
      ...(Object.keys(roleOverrides).length ? { roles: roleOverrides } : {}),
    },
  };

  return `${JSON.stringify(out, null, 2)}\n`;
}

function envExample(config: InitConfig): string {
  const usesAnthropic =
    config.defaultProvider === "anthropic" ||
    config.roles.some((r) => r.llmProvider === "anthropic");
  const usesOllama =
    config.defaultProvider === "ollama" || config.roles.some((r) => r.llmProvider === "ollama");

  const lines: string[] = ["# Swarm Environment Variables", ""];

  if (usesAnthropic) {
    lines.push("# Anthropic API key (required for remote models)");
    lines.push("ANTHROPIC_API_KEY=insert-your-own-key");
    lines.push("");
    lines.push("# Optional: Override the Anthropic base URL");
    lines.push(
      "# ANTHROPIC_BASE_URL=https://apim-multimodel-common.azure-api.net/anthropic-model/anthropic",
    );
    lines.push("");
  }

  if (usesOllama) {
    lines.push("# Ollama endpoint (required for local models)");
    lines.push(`OLLAMA_ENDPOINT=${config.ollamaEndpoint ?? "http://localhost:11434"}`);
    lines.push("");
  }

  return lines.join("\n");
}

export async function writeConfigs(config: InitConfig): Promise<string[]> {
  const skillsDir = config.skillsDir ?? ".swarm/skills";
  await Bun.$`mkdir -p ${skillsDir}`.quiet();

  const created: string[] = [];

  for (const [i, role] of config.roles.entries()) {
    const cycleIdx = config.cycle.indexOf(role.name);
    const effective = cycleIdx >= 0 ? cycleIdx : i;
    const path = join(skillsDir, `${role.name}.md`);
    await Bun.write(path, skillMd(role, effective, config.cycle.length));
    created.push(path);
  }

  await Bun.write("swarm.config.json", swarmConfigJson(config));
  created.push("swarm.config.json");

  await Bun.write(".env.example", envExample(config));
  created.push(".env.example");

  return created;
}

/** Write only swarm.config.json and .env.example (skills were already downloaded remotely). */
export async function writeRemoteSkills(config: InitConfig): Promise<string[]> {
  const created: string[] = [];
  await Bun.write("swarm.config.json", swarmConfigJson(config));
  created.push("swarm.config.json");
  await Bun.write(".env.example", envExample(config));
  created.push(".env.example");
  return created;
}
