import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { readMarkdown } from "../packages/chaff/src/markdown-read.ts";
import { extractFacts } from "../packages/chaff/src/compare/extract.ts";
import { outcomeOf, type Outcome } from "../packages/chaff/src/compare/outcome.ts";
import { factKey } from "../packages/chaff/src/compare/fact-key.ts";
import { clockTimes } from "../packages/chaff/src/compare/clock-time.ts";
import type { AtomKind, Extraction } from "../packages/chaff/src/compare/atom.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// chaff compare: the facts of a rewrite against the original. Every text here is written for the test.

const lines = (...rows: string[]): string => rows.join("\n");

const factsOf = (adapter: LanguageAdapter, path: string, source: string, names: readonly string[] = []): Extraction => {
  const doc = buildDocument(path, source, adapter, { jargon: [], requiredSections: [], names });
  const root = path.endsWith(".md") ? readMarkdown(doc.source).root : undefined;
  return extractFacts({ doc, root, structure: adapter.structure, names });
};

const compare = (adapter: LanguageAdapter, beforeText: string, afterText: string, path = "a.md"): Outcome =>
  outcomeOf({ path: "before.md", extraction: factsOf(adapter, path, beforeText) }, { path: "after.md", extraction: factsOf(adapter, path, afterText) });

/** Each dropped or added fact as kind:text, the way a reader of the report sees it. */
const changes = (outcome: Outcome): { dropped: string[]; added: string[]; reformed: string[] } => ({
  dropped: outcome.dropped.map((atom) => `${atom.kind}:${atom.text}`),
  added: outcome.added.map((atom) => `${atom.kind}:${atom.text}`),
  reformed: outcome.reformed.map((pair) => `${pair.before.kind}:${pair.before.text}→${pair.after.text}`),
});

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const JA_BEFORE = lines(
  "# 料金の改定について",
  "",
  "2026年4月1日から、月額料金を1,000円から1,200円に改定します。詳しくは https://example.com/price をご覧ください。",
  "",
  "## 対象",
  "",
  "対象は約３万人の契約者です。第5条第2項により「料金表」を更新します。受付は午後3時30分までです。設定は `plan: basic` のままです。",
);

const JA_FAITHFUL = lines(
  "# 料金が変わります",
  "",
  "月額料金は 2026/4/1 から 1000円 ではなく 1,200円 になります。詳しくは [料金のページ](https://example.com/price) を見てください。",
  "",
  "## 対象となる方",
  "",
  "第5条第2項にもとづき「料金表」を更新します。対象は約３万人の契約者です。設定は `plan: basic` のまま、受付は15:30までです。",
);

const EN_BEFORE = lines(
  "# Pricing update",
  "",
  "From April 1, 2026, the monthly fee rises from $10 to $12.50, a 25% increase. Section 4.2 has the details: https://example.com/price.",
  "",
  'Questions go to Acme Corp. in Boston before 5 p.m. The "Basic" plan keeps its 30 GB and the `basic` key.[^1]',
  "",
  "[^1]: The key stays the same.",
);

const EN_FAITHFUL = lines(
  "# What changes in pricing",
  "",
  "The monthly fee goes up 25% on 2026-04-01: it was $10 and becomes $12.50. See [the pricing page](https://example.com/price) and Section 4.2.",
  "",
  "Acme Corp. in Boston answers questions until 17:00. The “Basic” plan keeps its 30GB and the `basic` key.[^1]",
  "",
  "[^1]: The key stays the same.",
);

describe("a faithful rewrite passes", () => {
  it("in Japanese: the same facts in other words, other places and other forms", () => {
    const outcome = compare(ja, JA_BEFORE, JA_FAITHFUL);
    assert.deepEqual(changes(outcome).dropped, []);
    assert.deepEqual(changes(outcome).added, []);
    assert.equal(outcome.ok, true);
  });

  it("in English", () => {
    const outcome = compare(en, EN_BEFORE, EN_FAITHFUL);
    assert.deepEqual(changes(outcome).dropped, []);
    assert.deepEqual(changes(outcome).added, []);
    assert.equal(outcome.ok, true);
  });

  it("reports a change of form as information, not as a dropped fact", () => {
    const { reformed } = changes(compare(ja, JA_BEFORE, JA_FAITHFUL));
    assert.ok(reformed.includes("number:1,000円→1000円"), reformed.join(" | "));
    assert.ok(reformed.includes("date:2026年4月1日→2026/4/1"), reformed.join(" | "));
    assert.ok(reformed.includes("time:午後3時30分→15:30"), reformed.join(" | "));
    assert.ok(reformed.includes("heading:料金の改定について→料金が変わります"), reformed.join(" | "));
    const english = changes(compare(en, EN_BEFORE, EN_FAITHFUL)).reformed;
    assert.ok(english.includes("time:5 p.m.→17:00"), english.join(" | "));
    assert.ok(english.includes('quote:"Basic"→“Basic”'), english.join(" | "));
  });

  it("reads full-width and half-width figures as one number", () => {
    assert.deepEqual(changes(compare(ja, "会員は５名です。", "会員は5名です。")).reformed, ["number:５名→5名"]);
    assert.deepEqual(changes(compare(ja, "番号は５です。", "番号は 5 です。")).reformed, ["number:５→5"]);
  });
});

describe("a rewrite that loses or invents a fact fails", () => {
  const cases: readonly (readonly [string, LanguageAdapter, string, string, readonly string[], readonly string[]])[] = [
    ["drops a number", ja, JA_BEFORE, JA_FAITHFUL.replace("1000円 ではなく ", ""), ["number:1,000円"], []],
    ["changes a date", ja, JA_BEFORE, JA_FAITHFUL.replace("2026/4/1", "2026/4/2"), ["date:2026年4月1日"], ["date:2026/4/2"]],
    [
      "loses a URL",
      ja,
      JA_BEFORE,
      JA_FAITHFUL.replace(" [料金のページ](https://example.com/price) を見てください", "料金のページを見てください"),
      ["url:https://example.com/price"],
      [],
    ],
    ["adds a figure", ja, JA_BEFORE, JA_FAITHFUL.replace("になります。", "になります。値上げ幅は 20% です。"), [], ["number:20%"]],
    ["changes a time", ja, JA_BEFORE, JA_FAITHFUL.replace("15:30", "16:00"), ["time:午後3時30分"], ["time:16:00"]],
    ["drops a reference", ja, JA_BEFORE, JA_FAITHFUL.replace("第5条第2項にもとづき", ""), ["reference:第5条第2項"], []],
    ["changes a quotation", ja, JA_BEFORE, JA_FAITHFUL.replace("「料金表」", "「料金一覧」"), ["quote:「料金表」"], ["quote:「料金一覧」"]],
    ["changes code", ja, JA_BEFORE, JA_FAITHFUL.replace("`plan: basic`", "`plan: pro`"), ["code:plan: basic"], ["code:plan: pro"]],
    ["drops a number", en, EN_BEFORE, EN_FAITHFUL.replace(" up 25%", " up"), ["number:25%"], []],
    ["changes a date", en, EN_BEFORE, EN_FAITHFUL.replace("2026-04-01", "2026-04-02"), ["date:April 1, 2026"], ["date:2026-04-02"]],
    [
      "loses a URL",
      en,
      EN_BEFORE,
      EN_FAITHFUL.replace("[the pricing page](https://example.com/price)", "the pricing page"),
      ["url:https://example.com/price"],
      [],
    ],
    ["adds a figure", en, EN_BEFORE, EN_FAITHFUL.replace("answers questions", "answers 200 questions a day"), [], ["number:200"]],
    ["drops a name", en, EN_BEFORE, EN_FAITHFUL.replace(" in Boston", ""), ["name:Boston"], []],
    ["drops a footnote", en, EN_BEFORE, EN_FAITHFUL.replace(" key.[^1]", " key."), ["footnote:[^1]"], []],
    ["changes a reference", en, EN_BEFORE, EN_FAITHFUL.replace("Section 4.2", "Section 4.3"), ["reference:Section 4.2"], ["reference:Section 4.3"]],
  ];
  cases.forEach(([what, adapter, original, rewrite, dropped, added]) => {
    it(`${adapter.id}: ${what}`, () => {
      const outcome = compare(adapter, original, rewrite);
      assert.deepEqual(changes(outcome).dropped, dropped);
      assert.deepEqual(changes(outcome).added, added);
      assert.equal(outcome.ok, false);
    });
  });

  it("a number with another unit is another fact; one whose unit was not read is the same number", () => {
    assert.deepEqual(changes(compare(ja, "5件です。", "5人です。")).dropped, ["number:5件"]);
    assert.deepEqual(changes(compare(ja, "容量は30GBです。", "容量は３０ＧＢです。")).dropped, []);
  });

  it("counts a fact as often as it is stated: a fact said twice and then once has lost one", () => {
    assert.deepEqual(changes(compare(ja, "料金は1,200円です。改定後も1,200円です。", "料金は1,200円です。")).dropped, ["number:1,200円"]);
  });

  it("a removed heading fails; a reworded one does not", () => {
    assert.deepEqual(changes(compare(en, "# A\n\ntext\n\n## B\n\nmore\n", "# A\n\ntext more\n")).dropped, ["heading:B"]);
    assert.deepEqual(changes(compare(en, "# A\n\n## B\n", "# A\n\n## Bee\n")).dropped, []);
  });
});

describe("what is read once, and what is not a fact", () => {
  const kindsOf = (adapter: LanguageAdapter, source: string, kind: AtomKind): string[] =>
    factsOf(adapter, "a.md", source)
      .atoms.filter((atom) => atom.kind === kind)
      .map((atom) => atom.key);

  it("an autolink is one URL, not a link and a bare URL", () => {
    assert.deepEqual(kindsOf(en, "See <https://example.com/a> and https://example.com/b.", "url"), ["https://example.com/a", "https://example.com/b"]);
  });

  it("an ordered list's markers are not numbers; a list turned into prose loses none", () => {
    assert.deepEqual(kindsOf(en, "1. Apples\n2. Pears\n", "number"), []);
    assert.equal(compare(en, "Steps:\n\n1. Build it\n2. Ship it\n", "Steps: build it, then ship it.\n").ok, true);
  });

  it("a quotation wrapped over two lines is the same quotation", () => {
    assert.deepEqual(changes(compare(en, 'He said "keep the\nsame key" twice.', 'He said "keep the same key" twice.')).dropped, []);
  });

  it("a Japanese quotation wrapped between two wide characters is the same quotation, written another way", () => {
    const wrapped = changes(compare(ja, "依頼は「`mc-` 系の\nシステムスキルにしたい」でした。", "依頼は「`mc-` 系のシステムスキルにしたい」でした。"));
    assert.deepEqual([wrapped.dropped, wrapped.added], [[], []]);
    assert.deepEqual(wrapped.reformed, ["quote:「`mc-` 系の\nシステムスキルにしたい」→「`mc-` 系のシステムスキルにしたい」"]);
  });

  it("a line break next to a Latin letter reads as a space, so it is the same as a space", () => {
    assert.deepEqual(changes(compare(ja, "彼は「MulmoClaude\nに入れる」と言った。", "彼は「MulmoClaude に入れる」と言った。")).dropped, []);
  });

  it("bold inside a quotation is how it is written, not what it says", () => {
    const bold = changes(compare(ja, "僕は「**終わったな**」と思った。", "僕は「終わったな」と思った。"));
    assert.deepEqual([bold.dropped, bold.added], [[], []]);
    assert.deepEqual(bold.reformed, ["quote:「**終わったな**」→「終わったな」"]);
    assert.equal(compare(ja, "彼は「とても**大事**です」と言った。", "彼は「とても大事です」と言った。").ok, true);
  });

  it("a line break next to inline code is read as the rules read it, so text moved out of a quotation is not hidden", () => {
    const moved = changes(compare(ja, "依頼は「系の\n`x`システム」でした。", "依頼は「系のシステム」でした。`x`"));
    assert.deepEqual([moved.dropped, moved.added], [["quote:「系の\n`x`システム」"], ["quote:「系のシステム」"]]);
  });

  it("a plain-text document shows its line breaks, so a joined line there is another quotation", () => {
    const plain = changes(compare(ja, "依頼は「系の\nシステム」でした。", "依頼は「系のシステム」でした。", "a.txt"));
    assert.deepEqual([plain.dropped, plain.added], [["quote:「系の\nシステム」"], ["quote:「系のシステム」"]]);
  });

  it("a hard line break inside a quotation is a visible break, read as a space", () => {
    assert.equal(compare(ja, "依頼は「系の  \nシステム」でした。", "依頼は「系の システム」でした。").ok, true);
  });

  it("a space written inside a Japanese quotation is still another quotation", () => {
    const spaced = changes(compare(ja, "依頼は「系の システムにしたい」でした。", "依頼は「系のシステムにしたい」でした。"));
    assert.deepEqual([spaced.dropped, spaced.added], [["quote:「系の システムにしたい」"], ["quote:「系のシステムにしたい」"]]);
  });

  it("a heading moved to another level is dropped at one level and added at the other", () => {
    const outcome = changes(compare(en, "# A\n\n## B\n\ntext\n", "# A\n\n### B\n\ntext\n"));
    assert.deepEqual([outcome.dropped, outcome.added], [["heading:B"], ["heading:B"]]);
  });

  it("a capitalised word the document also writes in lower case is not a name; a name of two words is one name", () => {
    assert.deepEqual(kindsOf(en, "Scammers lie. The scammers called New York twice.", "name"), ["New York"]);
  });

  it("a unit is one unit however wide its letters", () => {
    assert.deepEqual(changes(compare(ja, "増加は25%です。", "増加は25％です。")).reformed, ["number:25%→25％"]);
  });

  it("a number with a thousands separator is read by its value", () => {
    assert.deepEqual(changes(compare(en, "We have 1,000 users.", "We have 1,001 users.")).dropped, ["number:1,000"]);
  });

  it("numbers that are no time of day are not read as a time", () => {
    assert.deepEqual(kindsOf(en, "The vote was 24:30, at 13 p.m. or 3:75; the day ended at 24:00.", "time"), ["24:00"]);
  });

  it("a URL keeps a path in kanji, and stops where a Japanese sentence goes on", () => {
    assert.deepEqual(changes(compare(ja, "https://example.com/東京 を見る。", "https://example.com/大阪 を見る。")).dropped, ["url:https://example.com/東京"]);
    assert.deepEqual(kindsOf(ja, "詳しくは https://example.jp/資料をご覧ください。", "url"), ["https://example.jp/資料"]);
  });

  it("10時半 is half past ten", () => {
    assert.equal(compare(ja, "開始は10時半です。", "開始は10:30です。").ok, true);
  });

  it("the numbered articles of a plain-text contract are headings", () => {
    const contract = "第1条（目的）\n甲は乙に委託する。\n第2条（支払）\n甲は支払う。\n";
    const facts = factsOf(ja, "a.txt", contract).atoms.filter((atom) => atom.kind === "heading");
    assert.deepEqual(
      facts.map((atom) => atom.key),
      ["article 1", "article 2"],
    );
  });

  it("digits in code and URLs are not read again as numbers", () => {
    assert.deepEqual(kindsOf(en, "Run `sleep 30` and open https://example.com/2026/7.", "number"), []);
  });
});

describe("factKey: a fact's text as one spelling", () => {
  const whole = (text: string): { start: number; end: number } => ({ start: 0, end: text.length });

  it("removes what a reader never sees, and makes any other white space one space", () => {
    assert.equal(factKey("系の\nシステム", whole("系の\nシステム"), [{ start: 2, end: 3 }]), "系のシステム");
    assert.equal(
      factKey("**終わった**", whole("**終わった**"), [
        { start: 0, end: 2 },
        { start: 6, end: 8 },
      ]),
      "終わった",
    );
    assert.equal(factKey("keep the\nsame key", whole("keep the\nsame key"), []), "keep the same key");
    assert.equal(factKey("ＡＢＣ１２３", whole("ＡＢＣ１２３"), []), "ABC123");
    assert.equal(factKey("", whole(""), []), "");
  });

  it("reads only the unseen parts inside the span, on the span's own positions", () => {
    const text = "前\n後の「系の\nシステム」";
    const quote = { start: 5, end: 12 };
    assert.equal(
      factKey(text, quote, [
        { start: 1, end: 2 },
        { start: 7, end: 8 },
      ]),
      "系のシステム",
    );
    assert.equal(factKey(text, quote, [{ start: 1, end: 2 }]), "系の システム");
  });
});

describe("--distinct: facts compared as sets", () => {
  const distinct = (beforeText: string, afterText: string): Outcome =>
    outcomeOf(
      { path: "before.md", extraction: factsOf(ja, "a.md", beforeText) },
      { path: "after.md", extraction: factsOf(ja, "a.md", afterText) },
      undefined,
      "distinct",
    );
  const body = "# 料金\n\n新しい価格は1,200円で、Acme が販売します。\n";
  const summary = "\nまとめると、価格は1,200円で、Acme が販売します。\n";

  it("a summary that repeated the body can be cut: each fact is still stated once", () => {
    assert.deepEqual(changes(compare(ja, body + summary, body)).dropped, ["number:1,200円", "name:Acme"]);
    assert.deepEqual(changes(distinct(body + summary, body)), { dropped: [], added: [], reformed: [] });
    assert.equal(distinct(body + summary, body).ok, true);
  });

  it("a repeat added is not a new fact either", () => {
    assert.deepEqual(changes(distinct(body, body + summary)).added, []);
  });

  it("a fact the other document never states is still dropped or added", () => {
    const outcome = changes(distinct(body + summary, "# 料金\n\n新しい価格は1,300円です。\n"));
    assert.deepEqual(outcome.dropped, ["number:1,200円", "name:Acme", "number:1,200円", "name:Acme"]);
    assert.deepEqual(outcome.added, ["number:1,300円"]);
  });
});

describe("a duration is not a time of day", () => {
  it("「8時間」「1.2時間」「24時間」 are lengths of time; 「8時」「午後3時半」 are times", () => {
    const keys = (text: string): string[] => clockTimes(text).map((time) => time.key);
    assert.deepEqual(keys("8時間ノンストップで進めた。中央値1.2時間。24時間営業。123時。"), []);
    assert.deepEqual(keys("8時に始め、午後3時半に終えた。10時30分に集合。"), ["08:00", "15:30", "10:30"]);
  });

  it("chaff facts does not list 「8時間」 as a time", () => {
    assert.deepEqual(
      factsOf(ja, "a.md", "寝る前に「8時間ノンストップで進めておいて」と頼みます。").atoms.filter((atom) => atom.kind === "time"),
      [],
    );
  });
});

describe("the tagger's reading of a word is not a fact", () => {
  it("a word read as a name in one document and as a common word in the other is not dropped", () => {
    const original = "Scammers could reach you by phone. The scammers lie.";
    const rewrite = "Scammers may reach you by phone. The scammers lie.";
    assert.deepEqual(changes(compare(en, original, rewrite)).dropped, []);
    assert.deepEqual(changes(compare(en, original, rewrite)).added, []);
  });

  it("a name the rewrite no longer writes is dropped", () => {
    const original = "（左から塩崎副大臣、古川大臣、今枝前副大臣）";
    assert.deepEqual(changes(compare(ja, original, "（左から塩崎副大臣、古川大臣）")).dropped, ["name:今枝"]);
  });

  it("the team's names (chaff.yaml names:) are read as written", () => {
    const outcome = outcomeOf(
      { path: "a", extraction: factsOf(en, "a.md", "We use Acme Cloud and Acme.", ["Acme Cloud", "Acme"]) },
      { path: "b", extraction: factsOf(en, "a.md", "We use Acme.", ["Acme Cloud", "Acme"]) },
    );
    assert.deepEqual(changes(outcome).dropped, ["name:Acme Cloud"]);
  });
});

describe("what could not be read is said", () => {
  const withoutStructure = ({ structure: __structure, ...rest }: LanguageAdapter): LanguageAdapter => rest;
  const structureless = withoutStructure(en);
  const untagged: LanguageAdapter = {
    ...en,
    segment: (text) => ({ sentences: en.segment(text).sentences.map((sentence) => ({ span: sentence.span, text: sentence.text })) }),
  };
  const kinds = (extraction: Extraction): string[] => extraction.unread.map((unread) => `${unread.kind}:${unread.reason}`);

  it("a language package with no structure reader reads no units, dates or references", () => {
    const doc = buildDocument("a.md", "It costs $10 on April 1, 2026.", structureless);
    const extraction = extractFacts({ doc, root: readMarkdown(doc.source).root, structure: undefined, names: [] });
    assert.deepEqual(kinds(extraction), ["number:no-structure", "date:no-structure", "reference:no-structure"]);
    assert.deepEqual(
      extraction.atoms.filter((atom) => atom.kind === "number").map((atom) => atom.text),
      ["10", "1", "2026"],
    );
  });

  it("no part-of-speech tags: names are not read, and the report says so", () => {
    assert.deepEqual(kinds(factsOf(untagged, "a.md", "Acme Corp. is in Boston.")), ["name:no-pos"]);
  });

  it("a plain-text document has no code markup", () => {
    assert.deepEqual(kinds(factsOf(en, "a.txt", "Run `make` first.")), ["code:plain-text"]);
  });
});

/** A small deterministic generator, so a failing case can be rebuilt from its seed. */
const generator = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

const PARAGRAPHS: Readonly<Record<string, readonly string[]>> = {
  ja: [
    "2026年4月1日から月額1,200円になります。",
    "第3条により「規約」を改めます。詳しくは https://example.com/terms を見てください。",
    "受付は午前9時から午後5時30分までです。`npm run build` を実行します。",
    "東京と大阪の会場で、約３万人が参加しました。脚注を付けます。[^a]",
    "## 補足\n\n容量は30GBで、5件まで登録できます。",
    "[^a]: 2025年の数です。",
    "対象は12.5%の契約者で、「プレミアム」の方です。",
  ],
  en: [
    "From April 1, 2026, the fee is $12.50 a month.",
    'Section 3 changes the "Terms". See https://example.com/terms for details.',
    "The desk is open from 9 a.m. to 5:30 p.m. Run `npm run build` first.",
    "About 30,000 people in New York and London took part.[^a]",
    "## Notes\n\nEach account has 30 GB and up to 5 projects.",
    "[^a]: Counted in 2025.",
    "It applies to 12.5% of accounts on the “Premium” plan.",
  ],
};

const documentOf = (random: () => number, language: string): string[] => {
  const pool = PARAGRAPHS[language] ?? [];
  return Array.from({ length: 3 + Math.floor(random() * 6) }, () => pool[Math.floor(random() * pool.length)] ?? "");
};

const shuffled = (items: readonly string[], random: () => number): string[] =>
  items
    .map((item) => ({ item, order: random() }))
    .toSorted((left, right) => left.order - right.order)
    .map(({ item }) => item);

describe("properties over generated documents", () => {
  const SEED = Number(process.env["CHAFF_SEED"] ?? 20_261_001);
  const RUNS = 25;
  const adapters: readonly LanguageAdapter[] = [ja, en];

  adapters.forEach((adapter) => {
    it(`${adapter.id}: a document compared with itself is clean (seed ${String(SEED)})`, () => {
      const random = generator(SEED);
      Array.from({ length: RUNS }).forEach(() => {
        const text = documentOf(random, adapter.id).join("\n\n");
        const outcome = compare(adapter, text, text);
        assert.equal(outcome.ok, true, text);
        assert.deepEqual(outcome.reformed, [], text);
      });
    });

    it(`${adapter.id}: shuffling the paragraphs drops and adds nothing (seed ${String(SEED)})`, () => {
      const random = generator(SEED + 1);
      Array.from({ length: RUNS }).forEach(() => {
        const paragraphs = documentOf(random, adapter.id);
        const outcome = compare(adapter, paragraphs.join("\n\n"), shuffled(paragraphs, random).join("\n\n"));
        assert.deepEqual(changes(outcome).dropped, [], paragraphs.join(" / "));
        assert.deepEqual(changes(outcome).added, [], paragraphs.join(" / "));
      });
    });

    it(`${adapter.id}: removing a paragraph drops its facts, even one said again elsewhere (seed ${String(SEED)})`, () => {
      const random = generator(SEED + 2);
      Array.from({ length: RUNS }).forEach(() => {
        const paragraphs = documentOf(random, adapter.id);
        const shorter = paragraphs.slice(1);
        const removed = compare(adapter, paragraphs.join("\n\n"), shorter.join("\n\n"));
        const restored = compare(adapter, shorter.join("\n\n"), paragraphs.join("\n\n"));
        assert.equal(removed.ok, false, paragraphs.join(" / "));
        const alphabetical = (left: string, right: string): number => left.localeCompare(right);
        assert.deepEqual(changes(removed).dropped.toSorted(alphabetical), changes(restored).added.toSorted(alphabetical));
      });
    });
  });
});

describe("chaff compare on the command line", () => {
  const files = { "before.md": EN_BEFORE, "after.md": EN_FAITHFUL.replace(" in Boston", "") };

  it("ends with 0 for a faithful rewrite and counts what it checked", async () => {
    const run = await runCli({ "before.md": EN_BEFORE, "after.md": EN_FAITHFUL }, ["compare", "before.md", "after.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /Facts checked: \d+ → \d+: numbers \d+→\d+, dates/u);
    assert.match(run.out, /No fact dropped or added/u);
  });

  it("ends with 1 and shows the dropped fact with its line", async () => {
    const run = await runCli(files, ["compare", "before.md", "after.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /✗ 1 fact dropped/u);
    assert.match(run.out, /name: Boston {2}\(before\.md:5\)/u);
  });

  it("--allow-dropped lets an intended cut through, and still lists it", async () => {
    const run = await runCli(files, ["compare", "before.md", "after.md", "--allow-dropped", "name"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.out);
    assert.match(run.out, /name: Boston {2}\(before\.md:5\) \(allowed by --allow-dropped\)/u);
  });

  it("--allow-added does not excuse a dropped fact", async () => {
    const run = await runCli(files, ["compare", "before.md", "after.md", "--allow-added", "name"], "en_US.UTF-8");
    assert.equal(run.code, 1);
  });

  it("--compact gives one line per fact; --json is for an AI to act on", async () => {
    const compact = await runCli(files, ["compare", "before.md", "after.md", "--compact"], "en_US.UTF-8");
    assert.match(compact.out, /^before\.md:5: dropped name Boston$/mu);
    const json = await runCli(files, ["compare", "before.md", "after.md", "--json"], "en_US.UTF-8");
    const parsed: unknown = JSON.parse(json.out);
    assert.ok(typeof parsed === "object" && parsed !== null && "dropped" in parsed && "ok" in parsed);
    assert.deepEqual(parsed.dropped, [{ kind: "name", key: "Boston", text: "Boston", line: 5, allowed: false }]);
    assert.equal(parsed.ok, false);
  });

  it("passes a Japanese quotation joined across a line break, as written another way", async () => {
    const wrapped = { "a.md": "# 試し\n\n依頼は「系の\nシステムにしたい」でした。\n", "b.md": "# 試し\n\n依頼は「系のシステムにしたい」でした。\n" };
    const run = await runCli(wrapped, ["compare", "a.md", "b.md"], "ja_JP.UTF-8");
    assert.equal(run.code, 0, run.out);
    assert.match(run.out, /書き方だけ変わった事実 1 件/u);
  });

  it("--distinct passes a cut summary that only repeated the body", async () => {
    const body = "# 料金\n\n新しい価格は1,200円です。\n";
    const files = { "a.md": `${body}\nまとめると、価格は1,200円です。\n`, "b.md": body };
    assert.equal((await runCli(files, ["compare", "a.md", "b.md"], "ja_JP.UTF-8")).code, 1);
    const run = await runCli(files, ["compare", "a.md", "b.md", "--distinct"], "ja_JP.UTF-8");
    assert.equal(run.code, 0, run.out);
  });

  it("speaks the document's language", async () => {
    const run = await runCli({ "a.md": JA_BEFORE, "b.md": JA_FAITHFUL }, ["compare", "a.md", "b.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.out);
    assert.match(run.out, /照合した事実 \d+ 件 → \d+ 件: 数 \d+→\d+、日付/u);
    assert.match(run.out, /落ちた事実も足された事実もありません/u);
  });

  it("refuses an unknown kind and a missing file, and says how to use it", async () => {
    const unknown = await runCli(files, ["compare", "before.md", "after.md", "--allow-dropped", "colour"], "en_US.UTF-8");
    assert.equal(unknown.code, 1);
    assert.match(unknown.err, /Unknown kind: colour/u);
    const missing = await runCli(files, ["compare", "before.md"], "en_US.UTF-8");
    assert.equal(missing.code, 1);
    assert.match(missing.err, /usage: chaff compare/u);
  });

  it("every kind can be named to --allow-dropped", async () => {
    const all: readonly AtomKind[] = ["number", "date", "time", "url", "code", "name", "quote", "heading", "reference", "footnote"];
    const run = await runCli(files, ["compare", "before.md", "after.md", "--allow-dropped", all.join(",")], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
  });
});
