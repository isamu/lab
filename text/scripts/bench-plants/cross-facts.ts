// Seeded mistakes for cross-doc-fact-conflict and cross-doc-duplicate-definition, planted in the bench's toy docs sites:
// one page with a fee the other pages do not give, and one page that defines a term in other words than the glossary.
// Pure and deterministic, like scripts/bench-mutations.ts.
import type { Mutation } from "../bench-text.ts";
import { rewriteInSite, siteMutation } from "../bench-sites.ts";

const FACT = "cross-doc-fact-conflict";
const DEFINITION = "cross-doc-duplicate-definition";

export const MUTATIONS: readonly Mutation[] = [
  siteMutation(FACT, "one-page-fee-ja", "ja", (files) => rewriteInSite(files, "faq.md", "月額料金：1,200円", "月額料金：1,500円")),
  siteMutation(FACT, "one-page-fee-en", "en", (files) => rewriteInSite(files, "faq.md", "Monthly fee: $12", "Monthly fee: $15")),
  siteMutation(DEFINITION, "one-page-definition-ja", "ja", (files) =>
    rewriteInSite(files, "setup.md", "とは、チームの書類をまとめて置く場所のことです。", "とは、一人で使う下書きの置き場のことです。"),
  ),
  siteMutation(DEFINITION, "one-page-definition-en", "en", (files) =>
    rewriteInSite(files, "setup.md", "means the place where a team keeps its documents.", "means a private folder for drafts."),
  ),
];
