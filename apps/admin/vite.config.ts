import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      treeshake: {
        // firebase/*'s package.json declares "sideEffects": false, which tells
        // the bundler it may drop unused-looking top-level calls as dead code.
        // @firebase/auth relies on one such call (registerAuth(...)) actually
        // running at module-eval time to populate the component registry that
        // getAuth() reads from -- dropping it throws "Component auth has not
        // been registered yet". Whether it gets dropped is bundler/environment
        // -sensitive (observed: fine on Windows, silently broken in the
        // Docker/Alpine build), so force every firebase module to keep its
        // side effects rather than relying on tree-shaking heuristics.
        moduleSideEffects(id: string) {
          if (id.includes('@firebase') || id.includes('/firebase/')) return true
          return undefined
        },
      },
    },
  },
  resolve: {
    // Monorepo workspaces pin different React versions (RN apps need 19.2.3,
    // this app needs 19.2.7). npm's hoisting can land a mismatched react/react-dom
    // pair at the repo root, which crashes at runtime (React error #527).
    // Force every 'react'/'react-dom' resolution to the same copy.
    dedupe: ['react', 'react-dom'],
  },
})
