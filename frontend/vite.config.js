import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],

  server: {
    headers: isolationHeaders,
  },

  preview: {
    headers: isolationHeaders,
  },
});
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8000" }, // порт твоего FastAPI
  },
  build: {
    outDir: "../static", // FastAPI уже раздаёт эту папку
    emptyOutDir: true,   // ВНИМАНИЕ: очищает static/, сделай бэкап старого index.html
  },
});
