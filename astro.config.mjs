// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://cyberpsychlab.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  // Keep normal whitespace between inline elements (Astro 7 strips it by default).
  compressHTML: true,
});
