import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { speakerLabels } from "../packages/chaff/src/speaker-labels.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const lines = (...rows: string[]): string => rows.join("\n");
const labelTexts = (text: string): string[] => speakerLabels(text).map((span) => text.slice(span.start, span.end));
/** 抜き出しを 2 度並べる。対話と読むのに要る行の数（MIN_DIALOGUE_TURNS）を、短い抜き出しで満たす。 */
const twice = (text: string): string => `${text}\n\n${text}`;
const doubled = (items: readonly string[]): string[] => [...items, ...items];

/** Oscar Wilde, The Importance of Being Earnest (Project Gutenberg #844, public domain). The speaker's name is its own line. */
const EARNEST = lines(
  "LANE.",
  "I believe it _is_ a very pleasant state, sir. I have had very little",
  "experience of it myself up to the present.",
  "",
  "ALGERNON.",
  "[Languidly_._] I don’t know that I am much interested in your family",
  "life, Lane.",
  "",
  "LANE.",
  "No, sir; it is not a very interesting subject. I never think of it",
  "myself.",
  "",
  "ALGERNON.",
  "Very natural, I am sure. That will do, Lane, thank you.",
  "",
  "LANE.",
  "Thank you, sir. [Lane goes out.]",
  "",
  "ALGERNON.",
  "Lane’s views on marriage seem somewhat lax.",
  "",
  "JACK.",
  "Oh, pleasure, pleasure! What else should bring one anywhere?",
);

/** 岸田國士「紙風船」（青空文庫、著作権の切れた作品）。行頭の名前と全角空白の後に台詞が続く。 */
const KAMIFUSEN = lines(
  "夫　　（縁側の籐椅子に倚り、新聞を読んでゐる）",
  "",
  "妻　　（縁側近く座蒲団を敷き、編物をしてゐる）なに、それは。",
  "",
  "妻　　いゝから、川上さんとこへ行つてらつしやいよ。",
  "",
  "夫　　是非行かなくつてもいゝんだよ。",
  "",
  "妻　　あたしは、思ひ立つた時すぐでなけれやいやなの。",
  "",
  "夫　　散歩か。",
  "",
  "妻　　散歩でもなんでも……。",
  "",
  "夫　　散歩でもなんでもつたつて、ほかに何かすることがあるかい。",
);

/** 議事録の形（自作）。発言者の行の次の行から発言が続く。 */
const MINUTES = lines(
  "○事務局",
  "では、これより委員会を開催いたします。",
  "○事務局",
  "続きまして、資料の確認をいたします。",
  "○山田委員",
  "山田でございます。よろしくお願いいたします。",
  "○事務局",
  "ありがとうございました。",
  "○佐藤委員",
  "佐藤です。一点、質問があります。",
  "○山田委員",
  "補足いたします。",
  "○山田委員",
  "以上です。",
);

describe("speakerLabels: 戯曲・議事録の話し手の名前", () => {
  it("大文字の名前だけの行（Gutenberg の戯曲）", () => {
    assert.deepEqual(labelTexts(twice(EARNEST)), doubled(["LANE.", "ALGERNON.", "LANE.", "ALGERNON.", "LANE.", "ALGERNON.", "JACK."]));
  });

  it("行頭の名前と全角空白（紙風船）。台詞は残す", () => {
    assert.deepEqual(labelTexts(twice(KAMIFUSEN)), doubled(["夫　　", "妻　　", "妻　　", "夫　　", "妻　　", "夫　　", "妻　　", "夫　　"]));
  });

  it("○で始まる発言者の行（議事録）。1 度しか話さない人も、同じ形なら話し手", () => {
    assert.deepEqual(labelTexts(twice(MINUTES)), doubled(["○事務局", "○事務局", "○山田委員", "○事務局", "○佐藤委員", "○山田委員", "○山田委員"]));
  });

  it("○と名前と括弧の後に全角空白、同じ行に発言（会議録の形、自作）", () => {
    const text = lines(
      "○委員長（山田太郎君）　ただいまから委員会を開会いたします。",
      "○参考人（佐藤花子君）　佐藤でございます。",
      "○委員長（山田太郎君）　ありがとうございました。",
      "○参考人（佐藤花子君）　補足いたします。",
      "○委員長（山田太郎君）　以上で終わります。",
      "○参考人（佐藤花子君）　ありがとうございました。",
    );
    assert.deepEqual(
      labelTexts(twice(text)),
      doubled([
        "○委員長（山田太郎君）　",
        "○参考人（佐藤花子君）　",
        "○委員長（山田太郎君）　",
        "○参考人（佐藤花子君）　",
        "○委員長（山田太郎君）　",
        "○参考人（佐藤花子君）　",
      ]),
    );
  });

  it("長い発言が何段落も続く会議録でも、発言者の行が段落の 1 割を始めれば読む", () => {
    const speech = ["一つ目の段落です。", "二つ目の段落です。", "三つ目の段落です。", "四つ目の段落です。"].join("\n\n");
    const text = Array.from({ length: 10 }, (_, index) => `○${index % 2 === 0 ? "委員長" : "参考人"}\u3000はい。\n\n${speech}`).join("\n\n");
    assert.equal(labelTexts(text).length, 10);
  });

  it("段落は行ではなく空行で数える（長い台詞を何行にも折り返した戯曲）", () => {
    const speech = Array.from({ length: 10 }, (_, index) => `line ${String(index)} of a long speech`).join("\n");
    const text = Array.from({ length: 10 }, (_, index) => `${index % 2 === 0 ? "JACK" : "ALGERNON"}.\n${speech}`).join("\n\n");
    assert.equal(labelTexts(text).length, 10);
  });

  it("名前の直後の「（台本の形、自作）", () => {
    const text = lines(
      "ゆかり「おはよう」",
      "",
      "健太「おはよう。早いね」",
      "",
      "ゆかり「今日は当番なの」",
      "",
      "健太「そうか」",
      "",
      "ゆかり「うん」",
      "",
      "健太「じゃあ後で」",
    );
    assert.deepEqual(labelTexts(twice(text)), doubled(["ゆかり", "健太", "ゆかり", "健太", "ゆかり", "健太"]));
  });

  it("大文字の名前とコロン、敬称つきの大文字の名前（書き起こし、自作）", () => {
    const text = lines(
      "INTERVIEWER: Thank you for coming in today.",
      "Ms. JONES. Happy to be here.",
      "INTERVIEWER: How did the project start?",
      "Ms. JONES. It started with a single question.",
      "INTERVIEWER: And then?",
      "Ms. JONES. Then it grew.",
    );
    assert.deepEqual(labelTexts(twice(text)), doubled(["INTERVIEWER:", "Ms. JONES.", "INTERVIEWER:", "Ms. JONES.", "INTERVIEWER:", "Ms. JONES."]));
  });

  it("大文字の名前とピリオドの後に同じ行の台詞", () => {
    const text = lines("HAMLET. To be.", "HORATIO. My lord.", "HAMLET. Not to be.", "HORATIO. Indeed.", "HAMLET. Well.", "HORATIO. Good night.");
    assert.deepEqual(labelTexts(twice(text)), doubled(["HAMLET.", "HORATIO.", "HAMLET.", "HORATIO.", "HAMLET.", "HORATIO."]));
  });

  const none: readonly (readonly [string, string])[] = [
    ["話し手が 1 人（同じ見出しの繰り返し）", lines("○　注意事項", "本文。", "○　注意事項", "本文。", "○　注意事項", "本文。")],
    ["名前が繰り返されない", lines(..."甲乙丙丁戊己庚辛壬癸".split("").flatMap((name) => [`○${name}委員`, "発言です。"]))],
    ["2 回ずつでは足りない", lines(..."甲乙丙丁戊".split("").flatMap((name) => [`○${name}委員`, "一。", `○${name}委員`, "二。"]))],
    [
      "大文字の行の後が空行（テキストの見出し）",
      twice(
        lines(
          "NOTES",
          "",
          "Body.",
          "",
          "INDEX",
          "",
          "Body.",
          "",
          "NOTES",
          "",
          "Body.",
          "",
          "INDEX",
          "",
          "Body.",
          "",
          "NOTES",
          "",
          "Body.",
          "",
          "INDEX",
          "",
          "Body.",
        ),
      ),
    ],
    ["漢数字の項目（一　二）", twice(lines("一　甲のこと", "二　乙のこと", "一　丙のこと", "二　丁のこと", "一　戊のこと", "二　己のこと"))],
    [
      "数字とローマ数字の番号",
      twice(lines("II. Two.", "IV. Four.", "II. Two.", "IV. Four.", "II. Two.", "IV. Four.", "1: one", "2: two", "1: one", "2: two", "1: one", "2: two")),
    ],
    ["「第」で始まる序数の見出し", twice(lines("第一節　甲", "第二節　乙", "第一節　丙", "第二節　丁", "第一節　戊", "第二節　己"))],
    ["の で繋いだ番号", twice(lines("三の二　甲", "四の二　乙", "三の二　丙", "四の二　丁", "三の二　戊", "四の二　己"))],
    ["数字を含む名前", twice(lines("案1　甲", "案2　乙", "案1　丙", "案2　丁", "案1　戊", "案2　己"))],
    ["英字 1 字の選択肢", twice(lines("A. One.", "B. Two.", "A. Three.", "B. Four.", "A. Five.", "B. Six."))],
    ["文字の無い印", twice(lines("※　甲", "＊　乙", "※　丙", "＊　丁", "※　戊", "＊　己"))],
    ["繰り返す名前が 1 つだけ", twice(lines("NOTE.", "Keep the lid closed.", "NOTE.", "Wash your hands.", "NOTE.", "Store it cold."))],
    ["同じ名前でも形が違えば別に数える", lines("夫「おい」", "夫　　一つ目。", "夫　　二つ目。", ...Array.from({ length: 8 }, () => "妻　　三つ目。"))],
    ["注記が数回だけ（NOTE: と WARNING: が 3 回ずつ）", lines(...Array.from({ length: 3 }, () => ["NOTE: Keep it closed.", "WARNING: Hot surface."]).flat())],
    [
      "話し手の形の行が段落の 1 割に届かない",
      [...Array.from({ length: 5 }, () => "NOTE: Keep it closed.\n\nWARNING: Hot surface."), ...Array.from({ length: 91 }, () => "Body.")].join("\n\n"),
    ],
    ["片仮名 1 字の項目（イ　ロ）", twice(lines("イ　甲", "ロ　乙", "イ　丙", "ロ　丁", "イ　戊", "ロ　己"))],
    [
      "大文字小文字まじりの名前とコロン（記録の項目と同じ形）",
      lines("Title: One.", "Notes: Two.", "Source: Three.", "Title: Four.", "Notes: Five.", "Source: Six.", "Title: Seven.", "Notes: Eight.", "Source: Nine."),
    ],
    [
      "地の文の「",
      twice(
        lines(
          "私は「はい」と答えた。",
          "彼は「いいえ」と言った。",
          "私は「なぜ」と聞いた。",
          "彼は「さあ」と言った。",
          "私は「そう」と言った。",
          "彼は「うん」と言った。",
        ),
      ),
    ],
    ["名前だけの行の後が空行", twice(lines("○事務局", "", "○委員長", "", "○事務局", "", "○委員長", "", "○事務局", "", "○委員長"))],
  ];
  none.forEach(([label, text]) => {
    it(`話し手の名前と読まない: ${label}`, () => assert.deepEqual(labelTexts(text), []));
  });

  it("CRLF の行も読む。改行は範囲に入れない", () => {
    assert.deepEqual(labelTexts(twice(EARNEST).replaceAll("\n", "\r\n")), labelTexts(twice(EARNEST)));
    assert.deepEqual(labelTexts(twice(MINUTES).replaceAll("\n", "\r\n")), labelTexts(twice(MINUTES)));
    assert.equal(labelTexts(twice(MINUTES)).length, 14);
  });

  it("空の文書", () => assert.deepEqual(speakerLabels(""), []));
});

const RULES_JA = loadRules("ja");
const RULES_EN = loadRules("en");

const findingsOf = (source: string, adapter: LanguageAdapter, path = "t.txt"): string[] =>
  runRules(buildDocument(path, source, adapter), adapter.id === "en" ? RULES_EN : RULES_JA, {}, true, "blog/essay").findings.map((finding) => finding.rule);

const sentenceTexts = (source: string, adapter: LanguageAdapter, path = "t.txt"): string[] =>
  buildDocument(path, source, adapter).sentences.map((sentence) => sentence.text.trim());

/** 同じ場面を何度も繰り返して、密度を見る rule の床（英語 200 語）を越える。 */
const repeated = (text: string, times: number): string => Array.from({ length: times }, () => text).join("\n\n");

describe("話し手の名前は文でも本文でもない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("大文字の名前の行は文として数えない。台詞は文のまま", () => {
    const sentences = sentenceTexts(twice(EARNEST), en);
    assert.ok(!sentences.some((sentence) => /^(?:LANE|ALGERNON|JACK)\.$/u.test(sentence)));
    assert.ok(sentences.some((sentence) => sentence.startsWith("Very natural, I am sure.")));
  });

  it("Markdown: 太字の名前も読む。コードの中の名前は数えない", () => {
    const bold = twice(EARNEST).replace(/^([A-Z]+\.)$/gmu, "**$1**");
    assert.ok(!sentenceTexts(bold, en, "t.md").some((sentence) => /^(?:LANE|ALGERNON|JACK)\.$/u.test(sentence)));
    const coded = `\`\`\`\n${twice(EARNEST)}\n\`\`\`\n\nJACK.\nOh, pleasure, pleasure!`;
    assert.ok(sentenceTexts(coded, en, "t.md").includes("JACK."));
  });

  it("既定の種類でも、名前を固有名詞として数えない（proper-noun-density）", () => {
    assert.ok(!findingsOf(repeated(EARNEST, 4), en).includes("proper-noun-density"));
  });

  it("台詞の固有名詞は数える", () => {
    const names = "Lane met Jack and Algernon near Shropshire with Gwendolen, Cecily, Chasuble and Prism.";
    assert.ok(findingsOf(repeated(`${EARNEST}\n\nJACK.\n${Array.from({ length: 6 }, () => names).join(" ")}`, 4), en).includes("proper-noun-density"));
  });

  /** 台詞は毎回違う。同じなのは話し手の名前と、台詞の頭の短い「I think the」だけ。 */
  const NOUNS =
    "river field tower garden bridge market harbour meadow castle forest valley orchard chapel mill quarry lantern ledger kettle anchor saddle barrel wagon ribbon candle mirror carpet ladder basket compass hammer pillow shovel spindle trumpet cellar attic".split(
      " ",
    );
  const VERBS =
    "needed held lost found kept moved broke fixed hid shook warmed cooled filled emptied lifted dropped turned carried painted cleaned sold bought tied opened closed marked counted weighed wrapped sealed guarded watched raised lowered burned soaked".split(
      " ",
    );
  const debate = (speech: (index: number) => string): string =>
    lines(...NOUNS.map((_, index) => `${index % 2 === 0 ? "JOHN OF GAUNT" : "DUKE OF YORK"}: ${speech(index)}`));
  const plain = (index: number): string => `I think the ${NOUNS[index] ?? ""} ${VERBS[index] ?? ""} every ${NOUNS[(index + 5) % NOUNS.length] ?? ""} here.`;

  it("名前を言い回しの繰り返しとして数えない（ngram-repetition）", () => {
    assert.ok(!findingsOf(debate(plain), en).includes("ngram-repetition"));
  });

  it("台詞の中の繰り返しは数える", () => {
    assert.ok(
      findingsOf(
        debate((index) => `As far as I can tell, ${plain(index)}`),
        en,
      ).includes("ngram-repetition"),
    );
  });

  it("会議録の形: 括弧の中の氏名を固有名詞として数えない（proper-noun-density）", () => {
    const turns = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0
        ? `○委員長（山田太郎君）\u3000本日の議題${String(index)}について、資料に基づき御説明をお願いいたします。`
        : `○参考人（佐藤花子君）\u3000議題${String(index)}について、お手元の資料に沿って御説明いたします。`,
    );
    const source = lines(...turns);
    assert.ok(!findingsOf(source, ja).includes("proper-noun-density"));
    assert.ok(findingsOf(source.replaceAll("○", "◎"), ja).includes("proper-noun-density"));
  });

  it("紙風船: 名前を文から外し、台詞は文として残す", () => {
    const sentences = sentenceTexts(twice(KAMIFUSEN), ja);
    assert.ok(!sentences.some((sentence) => /^[夫妻]/u.test(sentence)));
    assert.ok(sentences.includes("散歩か。"));
  });

  it("議事録: 発言者の名前を文から外し、発言は文として残す", () => {
    const doc = buildDocument("t.md", twice(MINUTES), ja);
    assert.ok(!doc.sentences.some((sentence) => sentence.text.includes("○")));
    assert.ok(doc.sentences.some((sentence) => sentence.text.trim() === "では、これより委員会を開催いたします。"));
  });

  it("議事録: 1 行 1 段落に割っても、発言者の行は続く発言と同じ段落。文の無い段落を作らない", () => {
    const turn = (speaker: string, index: number): string[] => [
      `○${speaker}`,
      `${String(index)}件目の説明です。資料を御覧ください。`,
      "続けて補足します。以上です。",
    ];
    const minutes = lines(
      ...Array.from({ length: 6 }, () => ["事務局", "山田委員"])
        .flat()
        .flatMap(turn),
    );
    const doc = buildDocument("t.md", minutes, ja);
    const texts = doc.paragraphs.map((paragraph) => minutes.slice(paragraph.span.start, paragraph.span.end));
    assert.equal(texts.length, 24);
    assert.ok(texts[0]?.startsWith("○事務局\n0件目"));
    assert.ok(doc.paragraphs.every((paragraph) => paragraph.sentences.length > 0));
    assert.equal(
      doc.paragraphs.reduce((sum, paragraph) => sum + paragraph.sentences.length, 0),
      doc.sentences.length,
    );
  });
});
