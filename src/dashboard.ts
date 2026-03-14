import { serve } from "bun";
import { join } from "node:path";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import type { SwarmAPI } from "@/api";

export function startDashboard(api: SwarmAPI, port = 3000) {
  const logDir = join(process.cwd(), "logs");

  return serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        return new Response(DASHBOARD_HTML, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/events") {
        const stream = new ReadableStream({
          start(controller) {
            const watcher = watch(logDir, { recursive: true }, async (event, filename) => {
              if (filename?.endsWith("events.jsonl")) {
                const fullPath = join(logDir, filename);
                try {
                  const content = await readFile(fullPath, "utf-8");
                  const lines = content.trim().split("\n");
                  const lastLine = lines[lines.length - 1];
                  controller.enqueue(`data: ${lastLine}\n\n`);
                } catch (e) {
                  // Ignore read errors (e.g. if file is being written)
                }
              }
            });

            req.signal.addEventListener("abort", () => {
              watcher.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}

const DASHBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Swarm Dashboard</title>
    <style>
        body { font-family: sans-serif; background: #1a1a1a; color: #eee; margin: 0; padding: 20px; }
        .log-container { background: #000; padding: 10px; height: 500px; overflow-y: scroll; border: 1px solid #444; border-radius: 4px; font-family: monospace; }
        .log-entry { margin-bottom: 5px; border-bottom: 1px solid #222; padding-bottom: 5px; }
        .level-INFO { color: #4caf50; }
        .level-WARN { color: #ff9800; }
        .level-ERROR { color: #f44336; }
        .timestamp { color: #888; font-size: 0.8em; margin-right: 10px; }
        .task-id { color: #2196f3; font-weight: bold; margin-right: 10px; }
    </style>
</head>
<body>
    <h1>Swarm Real-time Logs</h1>
    <div id="logs" class="log-container"></div>
    <script>
        const logsDiv = document.getElementById('logs');
        const evtSource = new EventSource("/events");
        evtSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = \`
                <span class="timestamp">\${data.timestamp}</span>
                <span class="task-id">[\${data.taskId}]</span>
                <span class="level-\${data.level}">[\${data.level}]</span>
                <span>\${data.message}</span>
            \`;
            logsDiv.appendChild(entry);
            logsDiv.scrollTop = logsDiv.scrollHeight;
        };
    </script>
</body>
</html>
`;
