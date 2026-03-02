#!/usr/bin/env bun
import { runInitWizard } from "./src/cli/init";

// Injected at compile time via --define; falls back to "dev" in local runs
const VERSION: string = process.env.SWARM_VERSION ?? "dev";

const HELP = `\
Usage: swarm <command> [options]

Commands:
  init        Configure a new multi-agent project (default)

Options:
  -v, --version   Print version and exit
  -h, --help      Show this help message
`;

const [, , arg = "init"] = process.argv;

if (arg === "--version" || arg === "-v") {
  console.log(`swarm ${VERSION}`);
  process.exit(0);
}

if (arg === "--help" || arg === "-h") {
  process.stdout.write(HELP);
  process.exit(0);
}

const commands: Record<string, () => Promise<void>> = {
  init: runInitWizard,
};

const handler = commands[arg];

if (!handler) {
  process.stderr.write(`Unknown command: ${arg}\n\n${HELP}`);
  process.exit(1);
}

await handler();
