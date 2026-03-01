# Swarm: Secure Multi-Agent Orchestration Sandbox

Swarm is a secure, isolated sandbox execution environment for multi-agent AI workflows. AI agents autonomously plan, code, and review tasks within strictly controlled Docker containers, with zero impact on the host system.

## Key Features

- **Multi-Agent Orchestration**: Specialized agent roles (`architect`, `coder`, `reviewer`) executing in a continuous improvement loop.
- **Declarative Agent & Tool Config**: Agent skills and tool metadata live in Markdown files (`src/configs/agents/`). Add a `.md` file to introduce a new agent role or tool — no TypeScript changes required.
- **Secure Docker Sandbox**: Zero network access (`--network none`), read-only root filesystem, restricted privileges (`--security-opt no-new-privileges`), strict CPU/Memory limits.
- **Structured Tool Execution**: Agents interact exclusively via a structured JSON protocol and a whitelisted set of shell commands.
- **Safety First**: Built-in path traversal safeguards and prompt injection detection.
- **Concurrency & Queuing**: `SwarmAPI` worker pool manages multiple concurrent orchestrators with an in-memory task queue. No shared state between tasks.
- **LLM Agnostic**: Abstracted `LLMProvider` interface (currently Anthropic). Token usage tracked automatically.
- **Per-Task Workspaces**: Automatic Git branch per task workspace.
- **JSONL Audit Logging**: Every agent action and tool execution is logged for complete observability.

---

## Architecture

The system is divided into two strictly separated layers:

### 1. Intelligence Layer (Agents)

| Component                   | Responsibility                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Orchestrator`              | Manages state transitions and iteration loops; instantiated via `Orchestrator.create()`                |
| `DynamicAgent`              | Generic agent loaded at runtime from a skill config file                                               |
| `ConfigLoader`              | Reads `skills/*.md` and `tools/*.md` — no code changes needed to add new roles                         |
| `parseStructuredResponse`   | Parses and retries raw LLM output as a `ToolCall[]` JSON array                                         |

### 2. Deterministic Execution Layer (Sandbox)

| Component         | Responsibility                                                          |
| ----------------- | ----------------------------------------------------------------------- |
| `ToolExecutor`    | Validates and maps JSON tool calls to hardcoded shell commands          |
| `TaskRunner`      | State machine: `CREATED → RUNNING → FINALIZING → DESTROYED`             |
| `SandboxManager`  | Docker daemon interaction with security boundaries                      |

### Config file format

**Skill** (`src/configs/agents/skills/<name>.md`):
```markdown
---
name: architect
role: Software Architect
description: Designs the technical structure of requested changes
color: blue
structured: false
---
Your goal is to design the technical structure of the requested change.
```

**Tool** (`src/configs/agents/tools/<name>.md`):
```markdown
---
name: create_file
description: Create a new file at the given path with the given content
timeout: 30000
requiresPathValidation: true
args: path, content
---
Creates a file in the sandbox workspace.
```

### Types

All types, interfaces, and enums live in `src/types/` and are split by domain:

```
src/types/
  agent.ts      AgentConfig, ToolCall
  api.ts        SwarmConfig
  config.ts     AgentSkillConfig, ToolConfig
  executor.ts   ToolCommandName (enum), ToolCommand, ToolResult
  logger.ts     LogLevel (enum), LogEntry
  llm.ts        LLMConfig, LLMUsage, LLMProvider
  queue.ts      QueuedTaskStatus (enum), TaskRequest
  task.ts       TaskStatus (enum), OrchestrationState (enum), TaskContext, TaskRecord
  workspace.ts  SandboxOptions, WorkspaceOptions
```

---

## Installation

```bash
git clone <repository-url>
cd swarm
bun install
```

---

## Usage

### Basic Example

```typescript
import { AnthropicProvider, SwarmAPI } from ".";

const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! });
const swarm = new SwarmAPI({ provider, maxWorkers: 2 });

swarm.submit("task-123", "Write a Python script that prints 'Hello World'");

const result = await swarm.wait("task-123");
console.log("Status:", result.status);
```

```bash
bun run examples/basic.ts
```

### Concurrency Test (no LLM required)

```bash
bun run examples/concurrency.ts
```

---

## Development

```bash
bun run lint          # Biome lint check
bun run lint:fix      # Biome lint + auto-fix
bun run format        # Biome format
bun run typecheck     # tsc --noEmit
bun test              # run tests
bun run build         # build to dist/
bun run knip          # detect unused exports/files
```

---

## License & Safety Disclaimer

This project is built for **sandbox execution**. While extensive security flags are passed to Docker, always exercise caution when executing AI-generated code. Do not run the host application as root.
