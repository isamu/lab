// Seeded mistakes for cross-doc-broken-link, planted in the bench's toy docs sites: a link to a renamed file, and a link
// to a reworded heading of another page. Pure and deterministic, like scripts/bench-mutations.ts.
import type { Mutation } from "../bench-text.ts";
import { rewriteInSite, siteMutation } from "../bench-sites.ts";

const RULE = "cross-doc-broken-link";

export const MUTATIONS: readonly Mutation[] = [
  siteMutation(RULE, "link-to-renamed-file-ja", "ja", (files) => rewriteInSite(files, "setup.md", "](./pricing.md#", "](./prices.md#")),
  siteMutation(RULE, "link-to-reworded-heading-ja", "ja", (files) =>
    rewriteInSite(files, "setup.md", "./faq.md#ログインできない", "./faq.md#ログインできません"),
  ),
  siteMutation(RULE, "link-to-renamed-file-en", "en", (files) => rewriteInSite(files, "setup.md", "](./pricing.md#", "](./prices.md#")),
  siteMutation(RULE, "link-to-reworded-heading-en", "en", (files) => rewriteInSite(files, "setup.md", "./faq.md#i-cannot-sign-in", "./faq.md#cannot-sign-in")),
];
