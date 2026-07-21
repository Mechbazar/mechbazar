import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const certFile = path.resolve(__dirname, '.cert/localhost.pem')
const keyFile = path.resolve(__dirname, '.cert/localhost-key.pem')
const hasHttpsCerts = fs.existsSync(certFile) && fs.existsSync(keyFile)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Monorepo workspaces pin different React versions (RN apps need 19.2.3,
    // this app needs 19.2.7). npm's hoisting can land a mismatched react/react-dom
    // pair at the repo root, which crashes at runtime (React error #527).
    // Force every 'react'/'react-dom' resolution to the same copy.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    https: hasHttpsCerts
      ? {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFile),
        }
      : undefined,
  },
})
