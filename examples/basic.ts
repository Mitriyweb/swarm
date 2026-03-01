import { SwarmAPI } from "@/api";
import { AnthropicProvider } from "@/llm";

async function run() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Please set ANTHROPIC_API_KEY environment variable. Example:");
    console.error("export ANTHROPIC_API_KEY=your-api-key");
    process.exit(1);
  }

  const provider = new AnthropicProvider({ apiKey });
  const swarm = new SwarmAPI({ provider, maxWorkers: 2 });

  console.log("Swarm initialized. Submitting task...");

  const taskId = `demo-task-${Date.now()}`;
  const taskPrompt =
    "Create a simple Python script called `hello.py` that prints 'Hello from Swarm!'.";

  swarm.submit(taskId, taskPrompt);

  try {
    console.log(`Task ${taskId} submitted. Waiting for completion...`);
    const result = await swarm.wait(taskId, 1000, 300_000);

    console.log("\nTask result:", result.status);
    console.log("Tokens used:", provider.getUsage());
    console.log("\nCheck results in:");
    console.log(`- Workspace: .workspaces/${taskId}`);
    console.log(`- Logs: logs/${taskId}`);
  } catch (error) {
    console.error("\nTask failed:", error);
  }
}

run();
