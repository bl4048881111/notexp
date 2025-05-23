import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { Plugin } from 'vite';

export default defineConfig(async () => {
  const plugins: any[] = [
    react(),
  ];
  
  try {
    const errorOverlayModule = await import("@replit/vite-plugin-runtime-error-modal");
    plugins.push(errorOverlayModule.default());
  } catch (error) {
    console.error("Errore durante il caricamento del plugin runtime-error-modal:", error);
  }
  
  try {
    const themePluginModule = await import("@replit/vite-plugin-shadcn-theme-json");
    plugins.push(themePluginModule.default());
  } catch (error) {
    console.error("Errore durante il caricamento del plugin theme-json:", error);
  }
  
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    const cartographerModule = await import("@replit/vite-plugin-cartographer");
    plugins.push(cartographerModule.cartographer());
  }
  
  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
  };
});
