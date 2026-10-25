import { defineConfig, lazyPlugins } from "vite-plus";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

const root = resolve(__dirname, "src");

export default defineConfig({
  // The code is not formatter-managed; these options mirror the existing style.
  fmt: { semi: true, singleQuote: false, printWidth: 100 },
  lint: {
    ignorePatterns: ["dist/**", "src-tauri/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  root,
  plugins: lazyPlugins(() => [solid()]),
  base: "./",
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: ["es2022", "safari16", "chrome108", "firefox110"],
    rolldownOptions: {
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
