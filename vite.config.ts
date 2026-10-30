import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The site's own config. analysis/preview keeps its separate one — the asset
// harness and the site are built independently and must not share a root.
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    dedupe: ['three', 'react', 'react-dom'],
  },
  server: { port: 5180, strictPort: true },
});
