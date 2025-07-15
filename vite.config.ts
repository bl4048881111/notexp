import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

// Compatibilità per __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // Blocca richieste a New Relic
      '/bam.nr-data.net': {
        target: 'http://localhost:5173',
        changeOrigin: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            // console.log('Blocked New Relic request');
            res.writeHead(204);
            res.end();
          });
        }
      }
    }
  }
});
