import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "run-flightpath-python",
      configureServer(server) {
        server.middlewares.use("/api/run-conflict-analysis", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
            return;
          }

          const scriptPath = path.resolve("src/db/FlightPath.py");
          const conflictsPath = path.resolve("src/db/conflicts.json");

          execFile("python3", [scriptPath], { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "Python execution failed",
                  details: String(stderr || err.message),
                })
              );
              return;
            }

            try {
              const raw = fs.readFileSync(conflictsPath, "utf8");
              const conflicts = JSON.parse(raw);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, conflicts, stdout: String(stdout || "") }));
            } catch (readErr) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "Failed to read/parse conflicts.json",
                  details: String(readErr.message),
                })
              );
            }
          });
        });
      },
    },
  ],
})
