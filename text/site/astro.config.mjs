import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { remarkJoinCjkLines } from "./src/lib/joinCjkLines.ts";
import { remarkGuideLinks } from "./src/lib/guideLinks.ts";
import { remarkScreenFills } from "./src/lib/screenFills.ts";

// Published at https://isamu.github.io/lab/. The rule reference reads ../packages/chaff (its rules and loader), outside this folder.
export default defineConfig({
  site: "https://isamu.github.io",
  base: "/lab",
  trailingSlash: "always",
  // /lab/ itself only sends the reader on to a language, so it is left out of the sitemap.
  integrations: [sitemap({ filter: (page) => page !== "https://isamu.github.io/lab/" })],
  markdown: { remarkPlugins: [remarkJoinCjkLines, remarkGuideLinks, remarkScreenFills] },
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: [".."] } },
  },
});
