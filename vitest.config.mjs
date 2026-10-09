import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      configPath: "./wrangler.jsonc",
      miniflare: {
        bindings: {},
        kvNamespaces: ["GALLERY_CACHE", "ARTICLE_CACHE"],
      },
    }),
  ],
});