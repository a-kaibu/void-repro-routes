import { defineConfig } from "void/config";

export default defineConfig({
  target: "cloudflare",
  cloudflare: {
    name: "void-repro-routes",
    workers_dev: true,
    preview_urls: true,
    // routes is omitted: the Worker is served only on workers.dev
  },
});
