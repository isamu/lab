// Seeded table-of-contents entries with no heading, for `yarn bench`: a contents list of the sample's own "##" headings
// and one entry for a section that is not there, inserted after the title. Pure and deterministic, like
// scripts/bench-mutations.ts.
import { codeLines, linesOf, type Mutation, type Plant } from "../bench-text.ts";

const TOC: Readonly<Record<string, { readonly heading: string; readonly stray: string }>> = {
  ja: { heading: "## 目次", stray: "- 存在しない節" },
  en: { heading: "## Contents", stray: "- A section that is gone" },
};

/** 最低限の見出しの数。見出しが一つでは、目次の項目の半分が合わず、規則が別の章立ての目次と読む。 */
const MIN_HEADINGS = 2;

/** 題の行の後ろに、文書の「##」の見出しを並べた目次と、無い節の項目を差し込む。 */
const strayTocIn =
  (language: string) =>
  (source: string): Plant | undefined => {
    const lines = linesOf(source);
    const inCode = codeLines(lines);
    const headings = lines.filter((line, index) => line.startsWith("## ") && !inCode.has(index)).map((line) => `- ${line.slice("## ".length)}`);
    const toc = TOC[language];
    const titleAt = lines.findIndex((line) => line.startsWith("# "));
    if (toc === undefined || headings.length < MIN_HEADINGS || titleAt === -1) return undefined;
    const inserted = ["", toc.heading, "", ...headings, toc.stray, ""];
    const planted = [...lines.slice(0, titleAt + 1), ...inserted, ...lines.slice(titleAt + 1)];
    return { source: planted.join("\n"), line: titleAt + 1 + inserted.length - 1 };
  };

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `toc-stray-${language}`,
  rule: "toc-heading-mismatch",
  languages: [language],
  plant: strayTocIn(language),
}));
