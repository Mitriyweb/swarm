import { writeConfigs, writeRemoteSkills } from "./generate";
import { createPrompt, fmt } from "./prompt";
import { REMOTE_SOURCES, downloadSource } from "./remote";
import type { InitConfig, RoleDefinition } from "./types";

const ROLE_COLORS = ["blue", "green", "yellow", "cyan", "magenta", "red", "white"];

const PROVIDERS = ["Anthropic (remote)", "Ollama (local)"] as const;

const SKILLS_DIR = ".swarm/skills";

function providerKey(choice: string): string {
  return choice.startsWith("Anthropic") ? "anthropic" : "ollama";
}

export async function runInitWizard(): Promise<void> {
  const p = createPrompt();

  try {
    console.log(fmt.header("Swarm Setup Wizard"));
    console.log("Configure your multi-agent project in a few steps.\n");

    // ── Step 0: Agent source ───────────────────────────────────────────────────
    console.log(fmt.header("Step 0 · Agent Skills Source"));
    console.log(
      fmt.hint("  Skills will be stored in .swarm/skills/ (gitignored) — not in the repo.\n"),
    );

    const SOURCE_OPTIONS = [
      ...REMOTE_SOURCES.map((s) => `${s.label}\n    ${fmt.hint(s.description)}`),
      "Configure manually",
    ];

    const sourceChoice = await p.askChoice("Where should agent skills come from?", SOURCE_OPTIONS);
    const sourceIdx = SOURCE_OPTIONS.indexOf(sourceChoice);
    const isManual = sourceIdx === REMOTE_SOURCES.length;

    let roles: RoleDefinition[] = [];

    if (!isManual) {
      const source = REMOTE_SOURCES[sourceIdx];
      if (!source) throw new Error(`Invalid source index: ${sourceIdx}`);
      console.log(`\n  Downloading from ${source.repo}...`);
      await Bun.$`mkdir -p ${SKILLS_DIR}`.quiet();
      const downloaded = await downloadSource(source, SKILLS_DIR);
      for (const f of downloaded) {
        console.log(fmt.success(f));
      }

      // Infer role list from downloaded files (exclude PROTOCOL)
      roles = source.files
        .filter((f) => f.name !== "PROTOCOL")
        .map((f, i) => ({
          name: f.name,
          role: f.name.charAt(0).toUpperCase() + f.name.slice(1),
          description: `${f.name} agent`,
          color: ROLE_COLORS[i % ROLE_COLORS.length] ?? "blue",
          structured: f.name === "developer" || f.name === "coder",
        }));
    } else {
      // ── Manual role definition ───────────────────────────────────────────────
      console.log(fmt.header("Step 1 · Roles"));
      const roleCount = await p.askNumber("How many agent roles do you need?", 3);

      for (let i = 0; i < roleCount; i++) {
        console.log(`\n  Role ${i + 1} of ${roleCount}:`);

        const name = await p.ask("  Name (e.g. architect, coder, reviewer)");
        const role = await p.ask("  Display title (e.g. Software Architect)", name);
        const description = await p.ask("  Short description", `Handles the ${name} phase`);
        const color = ROLE_COLORS[i % ROLE_COLORS.length] ?? "blue";
        const structured = await p.askBoolean(
          "  Outputs structured JSON (ToolCall[])? Use for implementation roles",
          false,
        );

        let llmProvider: string | undefined;
        let llmModel: string | undefined;
        let llmEndpoint: string | undefined;

        const customLLM = await p.askBoolean("  Override LLM for this role?", false);
        if (customLLM) {
          const choice = await p.askChoice("  LLM provider for this role:", [...PROVIDERS]);
          llmProvider = providerKey(choice);
          llmModel = await p.ask("  Model name");
          if (llmProvider === "ollama") {
            llmEndpoint = await p.ask("  Ollama endpoint", "http://localhost:11434");
          }
        }

        roles.push({
          name,
          role,
          description,
          color,
          structured,
          llmProvider,
          llmModel,
          llmEndpoint,
        });
      }
    }

    // ── Step 2: Cycle ──────────────────────────────────────────────────────────
    console.log(fmt.header("Step 2 · Execution Cycle"));

    const defaultCycle = roles.map((r) => r.name).join(", ");
    console.log(`  Defined roles: ${defaultCycle}`);

    const cycleInput = await p.ask(
      "  Execution order (comma-separated)",
      roles.map((r) => r.name).join(","),
    );
    const cycle = cycleInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const unknown = cycle.filter((n) => !roles.find((r) => r.name === n));
    if (unknown.length) {
      console.log(fmt.error(`  Warning: unknown roles in cycle: ${unknown.join(", ")}`));
    }

    const maxIterations = await p.askNumber("  Max coding iterations per task", 3);
    const maxWorkers = await p.askNumber("  Max parallel workers", 4);

    // ── Step 3: LLM ────────────────────────────────────────────────────────────
    console.log(fmt.header("Step 3 · LLM Configuration"));

    const providerChoice = await p.askChoice("Default LLM provider:", [...PROVIDERS]);
    const defaultProvider = providerKey(providerChoice);

    let defaultModel: string;
    let ollamaEndpoint: string | undefined;

    if (defaultProvider === "anthropic") {
      defaultModel = await p.ask("  Default model", "claude-sonnet-4-5");
    } else {
      ollamaEndpoint = await p.ask("  Ollama endpoint", "http://localhost:11434");
      defaultModel = await p.ask("  Default model", "llama3.2");
    }

    const config: InitConfig = {
      roles,
      cycle,
      maxIterations,
      maxWorkers,
      defaultProvider,
      defaultModel,
      ollamaEndpoint,
      skillsDir: SKILLS_DIR,
    };

    // ── Step 4: Preview & confirm ──────────────────────────────────────────────
    console.log(fmt.header("Files to be created:"));
    if (isManual) {
      for (const role of roles) {
        console.log(`  ${SKILLS_DIR}/${role.name}.md`);
      }
    }
    console.log("  swarm.config.json");
    console.log("  .env.example");

    const confirm = await p.askBoolean("\nCreate these files?", true);
    if (!confirm) {
      console.log("\nAborted.");
      return;
    }

    const created = isManual ? await writeConfigs(config) : await writeRemoteSkills(config);

    console.log();
    for (const f of created) {
      console.log(fmt.success(f));
    }

    console.log(fmt.header("Done! Next steps:"));
    if (defaultProvider === "anthropic" || roles.some((r) => r.llmProvider === "anthropic")) {
      console.log("  1. Copy .env.example → .env and set ANTHROPIC_API_KEY");
    } else {
      console.log(`  1. Ensure Ollama is running at ${ollamaEndpoint ?? "http://localhost:11434"}`);
    }
    console.log(`  2. Agent skills are in ${SKILLS_DIR}/ (not committed to git)`);
    console.log("  3. Use SwarmAPI to submit tasks\n");
  } finally {
    p.close();
  }
}
