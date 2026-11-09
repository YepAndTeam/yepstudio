import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
