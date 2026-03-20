import { readFileSync, readdirSync, watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { SwarmAPI } from "@/api";
import { serve } from "bun";

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
          async start(controller) {
            // 1. Send historical events first
            try {
              const files = readdirSync(logDir).filter((f) => f.endsWith(".jsonl"));
              for (const file of files) {
                const content = readFileSync(join(logDir, file), "utf-8");
                const lines = content.trim().split("\n").filter(Boolean);
                const last50 = lines.slice(-50);
                for (const line of last50) {
                  controller.enqueue(`data: ${line}\n\n`);
                }
              }
            } catch {
              /* logs dir may not exist yet */
            }

            // 2. Then stream new events via fs.watch
            const watcher = watch(logDir, { recursive: true }, async (event, filename) => {
              if (filename?.endsWith(".jsonl")) {
                const fullPath = join(logDir, filename);
                try {
                  const content = await readFile(fullPath, "utf-8");
                  const lines = content.trim().split("\n").filter(Boolean);
                  const lastLine = lines[lines.length - 1];
                  if (lastLine) {
                    controller.enqueue(`data: ${lastLine}\n\n`);
                  }
                } catch (e) {
                  // Ignore read errors
                }
              }
            });

            req.signal.addEventListener("abort", () => watcher.close());
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

          const ts = document.createElement('span');
          ts.className = 'timestamp';
          ts.textContent = data.timestamp;

          const taskId = document.createElement('span');
          taskId.className = 'task-id';
          taskId.textContent = '[' + data.taskId + ']';

          const level = document.createElement('span');
          // Only allow known CSS class names — never interpolate data into className
          const allowedLevels = ['INFO', 'WARN', 'ERROR'];
          level.className = allowedLevels.includes(data.level)
            ? 'level-' + data.level
            : 'level-INFO';
          level.textContent = '[' + data.level + ']';

          const msg = document.createElement('span');
          msg.textContent = data.message;

          entry.append(ts, taskId, level, msg);
          logsDiv.appendChild(entry);
          logsDiv.scrollTop = logsDiv.scrollHeight;
        };
    </script>
</body>
</html>
`;
