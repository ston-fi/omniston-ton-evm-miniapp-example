import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/omniston-ton-evm-miniapp-example/",
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "node:buffer": "buffer",
    },
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), viteReact()],
});
