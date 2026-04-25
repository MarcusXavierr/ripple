import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
  resolve: {
    alias: {
      "@extension": new URL("./src", import.meta.url).pathname,
      "@shared": new URL("../shared", import.meta.url).pathname,
    },
  },
})
