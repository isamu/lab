// Seeded mistakes for cross-doc-term-variant, planted in the bench's toy docs sites: one page that writes a word the
// other way from the rest of the site. Pure and deterministic, like scripts/bench-mutations.ts.
import type { Mutation } from "../bench-text.ts";
import { rewriteInSite, siteMutation } from "../bench-sites.ts";

const RULE = "cross-doc-term-variant";

export const MUTATIONS: readonly Mutation[] = [
  siteMutation(RULE, "one-page-long-vowel-ja", "ja", (files) => rewriteInSite(files, "setup.md", "サーバー", "サーバ")),
  siteMutation(RULE, "one-page-hyphen-en", "en", (files) => rewriteInSite(files, "setup.md", "email", "e-mail")),
];
