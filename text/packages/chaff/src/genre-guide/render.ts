import type { Texts, UiLanguage } from "../ui.ts";
import type { ReportedGuide } from "./report.ts";
import { BUNDLED_GUIDES } from "./resolve.ts";

const TEXT: Texts<{
  readonly heading: (name: string, genre: string) => string;
  readonly lead: string;
  readonly rules: (ids: string) => string;
  readonly from: (places: string) => string;
  readonly change: string;
}> = {
  ja: {
    heading: (name, genre) => `指針: ${name}（${genre}）`,
    lead: "下の指摘より先に、原稿がこれを満たしているかを確かめてください。",
    rules: (ids) => `このジャンルで特に効く rule: ${ids}`,
    from: (places) => `書いたところ: ${places}`,
    change: "chaff.yaml の guide: で書き換えられます。出さないときは --no-guide。",
  },
  en: {
    heading: (name, genre) => `Guide: ${name} (${genre})`,
    lead: "Before the findings below, check the draft against these.",
    rules: (ids) => `Rules that matter most for this genre: ${ids}`,
    from: (places) => `Written in: ${places}`,
    change: "Change it with guide: in chaff.yaml; leave it out with --no-guide.",
  },
};

const RULE = 60;

/** Who wrote the guide, said only when a team changed it: the bundled text alone needs no source line. */
const fromLines = (guide: ReportedGuide, ui: UiLanguage): string[] =>
  guide.from.length === 1 && guide.from[0] === BUNDLED_GUIDES ? [] : [`  ${TEXT[ui].from(guide.from.join(" → "))}`];

/** The guide as the text report opens with it, in the document's language: read first, as the instruction to write against. */
export const renderGuideBlock = (guide: ReportedGuide, ui: UiLanguage): string[] => {
  const text = TEXT[ui];
  return [
    "",
    text.heading(guide.name, guide.genre),
    "",
    `  ${text.lead}`,
    "",
    ...guide.lines.map((line) => `  - ${line}`),
    ...(guide.rules.length === 0 ? [] : ["", `  ${text.rules(guide.rules.join(", "))}`]),
    ...fromLines(guide, ui),
    `  ${text.change}`,
    "",
    "═".repeat(RULE),
  ];
};
