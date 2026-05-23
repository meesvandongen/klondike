import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

const root = resolve(__dirname, "src");

export default defineConfig({
  root,
  plugins: [solid()],
  base: "./",
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: ["es2022", "safari16", "chrome108", "firefox110"],
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        klondike: resolve(root, "klondike/index.html"),
        freecell: resolve(root, "freecell/index.html"),
        spider: resolve(root, "spider/index.html"),
        tripeaks: resolve(root, "tripeaks/index.html"),
        pyramid: resolve(root, "pyramid/index.html"),
        hearts: resolve(root, "hearts/index.html"),
      },
    },
  },
});
