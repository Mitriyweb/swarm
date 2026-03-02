import { writeConfigs } from "./generate";
import { createPrompt, fmt } from "./prompt";
import type { InitConfig, RoleDefinition } from "./types";

const ROLE_COLORS = ["blue", "green", "yellow", "cyan", "magenta", "red", "white"];

const PROVIDERS = ["Anthropic (remote)", "Ollama (local)"] as const;

function providerKey(choice: string): string {
  return choice.startsWith("Anthropic") ? "anthropic" : "ollama";
}

export async function runInitWizard(): Promise<void> {
  const p = createPrompt();

  try {
    console.log(fmt.header("Swarm Setup Wizard"));
    console.log("Configure your multi-agent project in a few steps.\n");

    // ── Step 1: Roles ──────────────────────────────────────────────────────────
    console.log(fmt.header("Step 1 · Roles"));
    const roleCount = await p.askNumber("How many agent roles do you need?", 3);

    const roles: RoleDefinition[] = [];

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
    };

    // ── Step 4: Preview & confirm ──────────────────────────────────────────────
    console.log(fmt.header("Files to be created:"));
    for (const role of roles) {
      console.log(`  src/configs/agents/skills/${role.name}.md`);
    }
    console.log("  swarm.config.json");
    console.log("  .env.example");

    const confirm = await p.askBoolean("\nCreate these files?", true);
    if (!confirm) {
      console.log("\nAborted.");
      return;
    }

    const created = await writeConfigs(config);

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
    console.log("  2. Review generated skill files in src/configs/agents/skills/");
    console.log("  3. Adjust role instructions as needed");
    console.log("  4. Use SwarmAPI to submit tasks\n");
  } finally {
    p.close();
  }
}
