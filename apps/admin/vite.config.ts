import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
})
