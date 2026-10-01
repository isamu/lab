import type { Texts } from "../ui.ts";
import type { FixMode, ModeReason } from "./mode.ts";

export type FixPlanText = {
  readonly usage: string;
  readonly title: (path: string) => string;
  readonly about: (language: string, genre: string) => string;
  readonly intro: string;
  readonly constraintsHeading: string;
  readonly constraints: readonly string[];
  readonly modeHeading: string;
  readonly modeName: Readonly<Record<FixMode, string>>;
  readonly modeReason: Readonly<Record<ModeReason, string>>;
  readonly modeWays: readonly string[];
  readonly signalsHeading: string;
  readonly noSignals: string;
  readonly outlineLine: (measures: string) => string;
  readonly rulesHeading: string;
  readonly direction: string;
  readonly keep: string;
  readonly avoid: string;
  readonly example: string;
  readonly before: string;
  readonly after: string;
  readonly phrases: string;
  readonly spots: string;
  readonly at: (line: number) => string;
  readonly notRunHeading: string;
  readonly notExperimental: string;
  readonly checksHeading: string;
  readonly saveAs: (path: string) => string;
  readonly checksNote: string;
};

export const FIX_PLAN_TEXT: Texts<FixPlanText> = {
  ja: {
    usage: "使い方: chaff fix-plan <file> [--experimental] [--genre <ジャンル>] [--json] [--language ja|en|…]",
    title: (path) => `直す計画: ${path}`,
    about: (language, genre) => `言語 ${language}、ジャンル ${genre}`,
    intro:
      "chaff が機械で見つけた箇所と、それぞれの直す方向です。chaff は書き直しません。書き直すのは、この計画を読む人か AI です。直したら、最後の確かめのコマンドを実行してください。",
    constraintsHeading: "守ること",
    constraints: [
      "事実、数、日付、条件、名前を変えない。",
      "元の文書に無い事実、人、数、原因、例を足さない。",
      "直すのに文書に無い具体（誰が、いつ、どれだけ）が要るときは、作らずに［ ］で空けて書き手に聞く。",
      "書き直しは 2 回まで。指摘を消すためだけに書き直しを繰り返さない。",
    ],
    modeHeading: "勧める直し方",
    modeName: { none: "直すところなし", light: "軽く直す（Light）", bold: "大胆に直す（Bold）", full: "全面書き直し（Full）" },
    modeReason: {
      "nothing-found": "chaff は何も見つけませんでした。",
      composite: "ai-generated-composite が出ています。文の言い回しを直しても、生成文の骨組みが残ります。",
      genre: "ブログやエッセイは、構成から書き直すほうが書き手の望みに合います。",
      signals: "文書全体を測るルールが 2 つ以上出ています。見出しの構成は残し、節ごとに文を書き直します。",
      spots: "指摘は箇所ごとです。指摘された所だけを直します。",
    },
    modeWays: [
      "軽く直す: 指摘された箇所だけ。",
      "大胆に直す: 見出しの構成は残し、節ごとに文を書き直す。",
      "全面書き直し: 事実と主張を控えてから、構成から書き直す。頼まれた内容が「全面的に」「一から」なら、これを選ぶ。",
    ],
    signalsHeading: "文書全体の目印",
    noSignals: "文書全体を測るルールは、何も言っていません。",
    outlineLine: (measures) => `構成: ${measures}`,
    rulesHeading: "ルールごとの直し方",
    direction: "直す方向",
    keep: "変えないもの",
    avoid: "やりがちな間違い",
    example: "例",
    before: "前",
    after: "後",
    phrases: "言い回しごとの手がかり",
    spots: "見つけた箇所",
    at: (line) => `${String(line)} 行目`,
    notRunHeading: "動かなかったルール",
    notExperimental: "試験中のルールは動かしていません。AIっぽさのルールの多くは試験中です。--experimental を付けると見ます。",
    checksHeading: "直したあとの確かめ",
    saveAs: (path) => `書き直したものを ${path} に保存して、次を実行します。`,
    checksNote:
      "1 つめは書き直した文書の指摘、2 つめは事実が落ちていないか・足されていないか、3 つめは構成の変化です。数は chaff の出力から取り、形容詞で言わないでください。",
  },
  en: {
    usage: "usage: chaff fix-plan <file> [--experimental] [--genre <genre>] [--json] [--language ja|en|…]",
    title: (path) => `Fix plan: ${path}`,
    about: (language, genre) => `language ${language}, genre ${genre}`,
    intro:
      "What chaff found by machine, and how to rewrite each kind of spot. chaff does not rewrite; whoever reads this plan does, a person or an AI. When done, run the checks at the end.",
    constraintsHeading: "Constraints",
    constraints: [
      "Keep every fact, number, date, condition and name.",
      "Add no fact, person, number, cause or example the original does not have.",
      "Where a fix needs a specific the text does not give (who, when, how much), do not invent it: leave [ ] and ask the writer.",
      "At most two passes. Do not rewrite again just to silence a finding.",
    ],
    modeHeading: "Recommended way",
    modeName: { none: "Nothing to fix", light: "Light", bold: "Bold", full: "Full rewrite" },
    modeReason: {
      "nothing-found": "chaff found nothing.",
      composite: "ai-generated-composite fires. Fixing the wording would leave the skeleton of generated text.",
      genre: "For a blog post or an essay, what the writer wants changed is usually the structure.",
      signals: "Two or more rules that measure the whole document fire. Keep the outline and rewrite the prose section by section.",
      spots: "The findings are single spots. Rewrite only those.",
    },
    modeWays: [
      "Light: only the flagged spots.",
      "Bold: keep the outline, rewrite the prose of each section.",
      'Full: take an inventory of the facts and claims, then rewrite from the structure up. If the request says "from scratch", choose this.',
    ],
    signalsHeading: "Document-level signals",
    noSignals: "None of the rules that measure the whole document said anything.",
    outlineLine: (measures) => `Outline: ${measures}`,
    rulesHeading: "How to rewrite, rule by rule",
    direction: "Direction",
    keep: "Keep",
    avoid: "Avoid",
    example: "Example",
    before: "before",
    after: "after",
    phrases: "Hints for the phrases found",
    spots: "Spots",
    at: (line) => `line ${String(line)}`,
    notRunHeading: "Rules that did not run",
    notExperimental: "The experimental rules did not run, and most rules for generated text are experimental. Add --experimental to run them.",
    checksHeading: "Check after rewriting",
    saveAs: (path) => `Save the rewrite as ${path} and run:`,
    checksNote:
      "The first lists the rewrite's findings, the second checks that no fact was dropped or added, the third shows how the outline moved. Take the numbers from chaff's output, not adjectives.",
  },
};
