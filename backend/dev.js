import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'backend/server.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'], {
    cwd: path.join(root, 'frontend'),
    stdio: 'inherit',
  }),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  process.exitCode = code
}

for (const child of children) child.on('exit', (code) => stop(code || 0))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
