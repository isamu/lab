import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { remarkJoinCjkLines } from "./src/lib/joinCjkLines.ts";

// Published at https://isamu.github.io/lab/. The rule reference reads ../packages/chaff (its rules and loader), outside this folder.
export default defineConfig({
  site: "https://isamu.github.io",
  base: "/lab",
  trailingSlash: "always",
  markdown: { remarkPlugins: [remarkJoinCjkLines] },
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: [".."] } },
  },
});
