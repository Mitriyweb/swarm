import { readdir, watch } from "node:fs";
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
            // Send initial history from existing log files
            try {
              const entries = await new Promise<string[]>((resolve) => {
                readdir(logDir, { recursive: true }, (err, files) => {
                  if (err) return resolve([]);
                  resolve(files as string[]);
                });
              });

              for (const file of entries) {
                if (file.endsWith("events.jsonl")) {
                  const fullPath = join(logDir, file);
                  try {
                    const content = await readFile(fullPath, "utf-8");
                    for (const line of content.trim().split("\n")) {
                      if (line) controller.enqueue(`data: ${line}\n\n`);
                    }
                  } catch (e) {}
                }
              }

              const filePositions = new Map<string, number>();
              // Initialize positions for existing files to avoid double-sending during history load
              for (const file of entries) {
                if (file.endsWith("events.jsonl")) {
                  const fullPath = join(logDir, file);
                  try {
                    const s = await stat(fullPath);
                    filePositions.set(fullPath, s.size);
                  } catch (e) {}
                }
              }

              const watcher = watch(logDir, { recursive: true }, async (event, filename) => {
                if (filename?.endsWith("events.jsonl")) {
                  const fullPath = join(logDir, filename);
                  try {
                    const s = await stat(fullPath);
                    const prevPos = filePositions.get(fullPath) || 0;
                    if (s.size > prevPos) {
                      const buffer = Buffer.alloc(s.size - prevPos);
                      const fd = await Bun.file(fullPath).arrayBuffer();
                      const newContent = new TextDecoder().decode(fd.slice(prevPos));
                      filePositions.set(fullPath, s.size);

                      for (const line of newContent.trim().split("\n")) {
                        if (line) controller.enqueue(`data: ${line}\n\n`);
                      }
                    }
                  } catch (e) {
                    // Ignore read errors
                  }
                }
              });

              req.signal.addEventListener("abort", () => {
                watcher.close();
              });
            } catch (e) {
              controller.close();
            }
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

            const timestamp = document.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = data.timestamp;

            const taskId = document.createElement('span');
            taskId.className = 'task-id';
            taskId.textContent = '[' + data.taskId + ']';

            const level = document.createElement('span');
            level.className = 'level-' + data.level;
            level.textContent = '[' + data.level + ']';

            const message = document.createElement('span');
            message.textContent = data.message;

            entry.appendChild(timestamp);
            entry.appendChild(document.createTextNode(' '));
            entry.appendChild(taskId);
            entry.appendChild(document.createTextNode(' '));
            entry.appendChild(level);
            entry.appendChild(document.createTextNode(' '));
            entry.appendChild(message);
            logsDiv.appendChild(entry);
            logsDiv.scrollTop = logsDiv.scrollHeight;
        };
    </script>
</body>
</html>
`;
