# AI Agent Guidelines (AGENT.md)

Welcome, AI Developer. If you are reading this file, you have been tasked with maintaining, extending, or debugging the `Swarm` multi-agent sandbox repository.

This document outlines the strict architectural rules, constraints, and patterns you **must** follow when writing code for this project.

---

## 1. Core Principles

- **Security Override Everything**: This is a sandbox execution system. Your code must assume that the LLM output is inherently untrusted, malicious, and error-prone.
- **Separation of Concerns**: *Intelligence* (LLMs/Agents) must never mix with *Execution* (Docker/Host Shell). The Orchestrator is the only bridge, communicating strictly via whitelisted JSON tool calls.
- **No Shared State**: Ensure every task runs in complete isolation. The `WorkerPool` processes tasks concurrently; global state variables or singletons tracking task state are strictly prohibited.
- **English Only**: All code comments, logs, and documentation within the codebase MUST be written in English.
- **Directory Roles**: Place executable examples or demonstrations in the `examples/` directory. Place unit/integration tests in the `test/` directory. Do not clutter the project root with scripts.
- **Strict Verification**: NEVER bypass pre-commit hooks. The use of `--no-verify` when committing code is strictly forbidden. All code must pass Biome formatting, linting, and tests.

---

## 2. Directory Structure & Conventions

```
index.ts                  # public entry point (barrel)
src/
  configs/
    agents/
      skills/             # one .md file per agent role
        architect.md      # YAML frontmatter + instructions body
        coder.md
        reviewer.md
      tools/              # one .md file per tool
        create_file.md    # YAML frontmatter + description body
        modify_file.md
        ...
    loader.ts             # ConfigLoader — reads skill/tool .md files at runtime
  types/                  # all types, interfaces, and enums — no runtime code
    index.ts              # barrel re-export
    api.ts                # SwarmConfig
    agent.ts              # AgentConfig, ToolCall
    config.ts             # AgentSkillConfig, ToolConfig
    executor.ts           # ToolCommandName, ToolCommand, ToolResult
    logger.ts             # LogLevel, LogEntry
    llm.ts                # LLMConfig, LLMUsage, LLMProvider
    queue.ts              # QueuedTaskStatus, TaskRequest, QueueAdapter
    task.ts               # TaskStatus, OrchestrationState, TaskContext, TaskRecord
    workspace.ts          # SandboxOptions, WorkspaceOptions
  agents/
    index.ts              # barrel re-export
    base.ts               # abstract Agent class — all agents must extend this
    dynamic.ts            # DynamicAgent — generic agent loaded from AgentSkillConfig
    parser.ts             # parseStructuredResponse
  api.ts                  # SwarmAPI
  chaseai.ts              # ChaseAI integration for human-in-the-loop
  dashboard.ts            # SSE-based web dashboard for log streaming
  executor.ts             # ToolExecutor (tool whitelist)
  llm.ts                  # AnthropicProvider
  logger.ts               # Logger (JSONL audit trail)
  orchestrator.ts         # Orchestrator (multi-agent loop) — use Orchestrator.create()
  queue.ts                # InMemoryQueue
  queue_sqlite.ts         # SQLiteQueue (persistent task queue)
  retry.ts                # Retry logic for API calls
  safety.ts               # validateFilePath, detectPromptInjection
  sandbox.ts              # SandboxManager (Docker)
  task.ts                 # TaskRunner (state machine)
  worker.ts               # WorkerPool
  workspace.ts            # WorkspaceManager
test/
  sandbox.test.ts
  workspace.test.ts
examples/
  basic.ts
  concurrency.ts
```

### Import rules

- **Use `@/` path alias** for all cross-module imports (e.g. `import { Logger } from "@/logger"`).
- `@/` maps to `src/` — configured in `tsconfig.json`.
- Within the same directory (e.g. inside `src/agents/`), relative imports (`@/agents/base`) are acceptable.
- **Use `import type`** for type-only imports to keep the emit clean.

### Type rules

- **All types live in `src/types/`** — no type or interface declarations in implementation files.
- **Use enums** for finite string/number sets — never string literal unions.
- **No `any`** — use `unknown` and narrow explicitly.

---

## 3. Extending the Swarm

### Adding a New Agent Role

1. Create `src/configs/agents/skills/<name>.md` with YAML frontmatter and instructions body:
   ```markdown
   ---
   name: <name>
   role: <Role Title>
   description: Short description
   color: blue
   structured: false
   ---
   System instructions here.
   ```
2. `ConfigLoader.loadSkill("<name>")` will read this file automatically.
3. If `structured: true`, the agent's `runStructured()` method parses its output as a JSON array of `ToolCall` objects (see `parseStructuredResponse` in `src/agents/parser.ts`).
4. Add any new types to the appropriate file in `src/types/`.

### Adding a New Tool

1. Add the new command to `ToolCommandName` enum in `src/types/executor.ts`.
2. Add path and safety checks in `src/executor.ts` → `execute()` switch.
3. Implement the hardcoded shell translation — never pass agent-provided strings directly to `sh -c`.
4. Create `src/configs/agents/tools/<name>.md` with frontmatter (`timeout`, `requiresPathValidation`, `args`) so `ToolExecutor` picks up the correct timeout and path-validation flag.
5. Update the coder skill's instructions in `src/configs/agents/skills/coder.md` so the Coder knows the tool is available.

---

## 4. Code Style & TypeScript Rules

- **Language**: TypeScript exclusively. Use modern ESM syntax.
- **Runtime**: Bun (`Bun.file()` for I/O, `Bun.Glob` for directory scanning, etc.). See `CLAUDE.md` for the full list.
- **Async construction**: Classes that require async initialisation (e.g. loading config files) MUST expose a `static async create()` factory — never do async work in a constructor. See `Orchestrator.create()`.
- **Error Handling**: Catch errors at boundaries; transition `TaskRunner` to `FAILED` state gracefully. Never let errors crash the main host process.
- **Typing**: Explicit return types on all public methods. No `any` — catch blocks use `error: unknown`, cast with `(error as Error).message`.
- **Imports**: `import type` for type-only imports.

---

## 5. Testing Policy

Before completing your task:

1. `bun run typecheck` — must pass with zero errors.
2. `bun run knip` — must pass with zero unused exports or files.
3. `bun run lint` — must pass Biome checks.
4. If you added a new flow, verify it using Mock implementations in `examples/concurrency.ts` without requiring a live LLM key.

*Remember: You are writing code that orchestrates other AI agents. Robustness and determinism in the host application are paramount.*
