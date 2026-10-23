import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^monaco-editor-codicon\.css$/,
        replacement: path.resolve(
          __dirname,
          "node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css",
        ),
      },
    ],
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8555",
        changeOrigin: true,
        rewriteWsOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
