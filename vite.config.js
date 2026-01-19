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
      name: 'iterative-conflict-resolver',
      configureServer(server) {
        server.middlewares.use('/api/resolve-conflicts', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
            return
          }

          const scriptPath = path.resolve('src/db/iterative_resolve.py')
          const conflictsPath = path.resolve('src/db/conflicts.json')
          const scriptDir = path.resolve('src/db')

          try {
            // Run iterative resolver (must run from src/db directory)
            execFile(
              'python',
              [scriptPath],
              { cwd: scriptDir, maxBuffer: 50 * 1024 * 1024 },
              (err, stdout, stderr) => {
                if (err) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'Python execution failed',
                      details: String(stderr || err.message),
                    })
                  )
                  return
                }

                try {
                  // Read updated conflicts
                  const raw = fs.readFileSync(conflictsPath, 'utf8')
                  const conflicts = JSON.parse(raw)
                  
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      ok: true,
                      conflicts,
                      stdout: String(stdout || ''),
                    })
                  )
                } catch (readErr) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'Failed to read/parse conflicts.json',
                      details: String(readErr.message),
                    })
                  )
                }
              }
            )
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Server error',
                details: String(e.message),
              })
            )
          }
        })

        // Add endpoint to get simulation state
        server.middlewares.use('/api/get-simulation-state', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
            return
          }

          const statePath = path.resolve('src/db/simulation_state.json')

          try {
            const raw = fs.readFileSync(statePath, 'utf8')
            const state = JSON.parse(raw)
            
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: true,
                state,
              })
            )
          } catch (readErr) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Failed to read/parse simulation_state.json',
                details: String(readErr.message),
              })
            )
          }
        })
      },
    },
  ],
})
