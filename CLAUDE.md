# Swarm — Claude Code Instructions

## Runtime

Default to using **Bun** instead of Node.js.

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun install` instead of `npm install` / `yarn` / `pnpm`
- `bun run <script>` instead of `npm run <script>`
- `bunx <package>` instead of `npx <package>`
- Bun automatically loads `.env` — don't use `dotenv`

## Project structure

```
index.ts                  # entry point
src/
  configs/
    agents/
      skills/             # one .md file per agent role (YAML frontmatter + instructions)
        architect.md
        coder.md
        reviewer.md
      tools/              # one .md file per tool (timeout, path validation, args)
        create_file.md
        modify_file.md
        read_file.md
        delete_file.md
        list_dir.md
        git_add.md
        git_commit.md
        install_dependencies.md
        run_tests.md
        build_project.md
    loader.ts             # ConfigLoader — reads skill/tool .md files at runtime
  types/
    index.ts              # barrel re-export
    agent.ts              # AgentConfig, ToolCall
    api.ts                # SwarmConfig
    config.ts             # AgentSkillConfig, ToolConfig
    executor.ts           # ToolCommandName, ToolCommand, ToolResult
    llm.ts                # LLMConfig, LLMUsage, LLMProvider
    logger.ts             # LogLevel, LogEntry
    queue.ts              # QueuedTaskStatus, TaskRequest
    task.ts               # TaskStatus, OrchestrationState, TaskContext, TaskRecord
    workspace.ts          # SandboxOptions, WorkspaceOptions
  agents/
    index.ts              # barrel re-export
    base.ts               # abstract Agent class
    dynamic.ts            # DynamicAgent — loaded from AgentSkillConfig
    parser.ts             # parseStructuredResponse
  orchestrator.ts         # Orchestrator.create() — multi-agent loop
  executor.ts             # ToolExecutor — tool whitelist + sandbox dispatch
  llm.ts                  # AnthropicProvider
  task.ts                 # TaskRunner state machine
  workspace.ts            # workspace management
  sandbox.ts              # SandboxManager (Docker)
  safety.ts               # validateFilePath, detectPromptInjection
  logger.ts               # JSONL audit logger
  queue.ts                # TaskQueue
  worker.ts               # WorkerPool
  api.ts                  # SwarmAPI
test/
  sandbox.test.ts
  workspace.test.ts
```

## Scripts

```bash
bun run lint              # Biome lint check
bun run lint:fix          # Biome lint + auto-fix
bun run format            # Biome format
bun run typecheck         # tsc --noEmit
bun test                  # run tests
bun run build             # build to dist/
bun run knip              # detect unused exports/files
bun run knip:production   # detect unused code in production
```

## Bun APIs — use these instead of third-party packages

- `Bun.serve()` — HTTP server with WebSockets, routes, HTTPS. Don't use `express`
- `Bun.file()` — file I/O. Don't use `fs.readFile` / `fs.writeFile`
- `bun:sqlite` — SQLite. Don't use `better-sqlite3`
- `Bun.redis` — Redis. Don't use `ioredis`
- `Bun.sql` — Postgres. Don't use `pg` / `postgres.js`
- `Bun.$\`cmd\`` — shell commands. Don't use `execa`
- `WebSocket` is built-in. Don't use `ws`

## Testing

```bash
bun test                  # run all tests
bun test test/foo.test.ts # run specific file
```

Tests use `bun:test`:

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

## Linting & formatting

**Biome** handles both linting and formatting. Config: `biome.json`.

```bash
bun run lint:fix   # fix lint issues
bun run format     # format code
```

Don't configure ESLint or Prettier — Biome replaces both.

## Pre-commit hooks (prek)

Config: `.pre-commit-config.yaml`. Installed via:

```bash
bunx prek install
```

Hooks:

- **pre-commit**: Biome check, markdownlint
- **pre-push**: TypeScript typecheck, build check

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`:

1. Lint (Biome)
2. Type check
3. Knip (unused code)
4. Knip production mode
5. Security audit (`bun audit --audit-level=high`)
6. Tests
7. Build
8. Pre-commit hooks via `j178/prek-action`
