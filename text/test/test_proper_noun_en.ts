import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  capitalisedGuessedVerbsAsNames,
  isOrdinaryWord,
  lowercasedAt,
  properNounChecked,
  rereadAt,
  sentenceInitialCommonWord,
} from "../packages/lang-en/src/proper-noun.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

// 解析器が固有名詞と付けた語を、表記で確かめる。例文はすべて自作。

describe("properNounChecked", () => {
  it("大文字を含む語は固有名詞のまま（Chicago、HTTP、McDonald）", () => {
    ["Chicago", "HTTP", "McDonald", "iPhone"].forEach((word) => assert.equal(properNounChecked(word, "PROPN"), "PROPN"));
  });

  it("大文字の無い語は普通名詞（linters、json、e.g. の e）", () => {
    ["linters", "json", "e", "offline", "café"].forEach((word) => assert.equal(properNounChecked(word, "PROPN"), "NOUN"));
  });

  it("大文字と小文字の無い文字の語は、解析器の判断のまま（東京、עברית）", () => {
    ["東京", "עברית", "東京Tower"].forEach((word) => assert.equal(properNounChecked(word, "PROPN"), "PROPN"));
    assert.equal(properNounChecked("東京tower", "PROPN"), "NOUN");
  });

  it("文字の無い語は、数字なら数、通貨や数学の記号なら記号、ほかは句読点", () => {
    assert.equal(properNounChecked("2026", "PROPN"), "NUM");
    assert.equal(properNounChecked("$", "PROPN"), "SYM");
    assert.equal(properNounChecked("+", "PROPN"), "SYM");
    assert.equal(properNounChecked("—", "PROPN"), "PUNCT");
    assert.equal(properNounChecked("", "PROPN"), "PUNCT");
  });

  it("固有名詞でない品詞には触れない", () => {
    assert.equal(properNounChecked("linters", "NOUN"), "NOUN");
    assert.equal(properNounChecked("—", "PUNCT"), "PUNCT");
    assert.equal(properNounChecked("Run", "VERB"), "VERB");
  });
});

describe("英語の文書で、大文字の無い語は固有名詞に数えない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const propernouns = (source: string): string[] =>
    buildDocument("t.md", source, en)
      .sentences.flatMap((sentence) => sentence.tokens ?? [])
      .filter((token) => token.pos === "PROPN")
      .map((token) => token.surface);

  it("小文字の語と記号は外れ、大文字の名前は残る", () => {
    const found = propernouns("We ran the linters — offline, e.g. on json files in Chicago.");
    assert.ok(found.includes("Chicago"));
    ["linters", "—", "offline", "json", "e", "g"].forEach((word) => assert.ok(!found.includes(word), word));
  });
});

describe("sentenceInitialCommonWord", () => {
  const VOCABULARY: Readonly<Record<string, readonly string[]>> = {
    containers: ["NNS"],
    such: ["JJ", "PDT", "DT"],
    may: ["MD", "NNP"],
    use: ["NN", "VB"],
    a: ["DT"],
  };
  const tagsOf = (word: string): readonly string[] | undefined => VOCABULARY[word];
  const words = (...pairs: readonly (readonly [string, string])[]): { value: string; pos: string }[] => pairs.map(([value, pos]) => ({ value, pos }));

  it("文頭で大文字になっただけの、語彙にある普通の語を指す", () => {
    assert.equal(sentenceInitialCommonWord(words(["Containers", "NNP"], ["start", "VBP"]), tagsOf), 0);
    assert.equal(sentenceInitialCommonWord(words(["Such", "NNP"], ["tools", "NNS"]), tagsOf), 0);
    assert.equal(sentenceInitialCommonWord(words(["Containers", "NNPS"]), tagsOf), 0);
  });

  it("前に立つ記号や番号は飛ばし、最初の語を見る", () => {
    assert.equal(sentenceInitialCommonWord(words(["(", "("], ["Use", "NNP"], ["it", "PRP"]), tagsOf), 1);
    assert.equal(sentenceInitialCommonWord(words(["1", "CD"], [".", "."], ["Use", "NNP"]), tagsOf), 2);
  });

  it("文の途中の大文字の語は名前のまま", () => {
    assert.equal(sentenceInitialCommonWord(words(["We", "PRP"], ["use", "VBP"], ["Containers", "NNP"]), tagsOf), -1);
  });

  it("語彙に無い語、固有名詞としても載っている語は名前のまま（Kubernetes、May）", () => {
    assert.equal(sentenceInitialCommonWord(words(["Kubernetes", "NNP"], ["restarts", "VBZ"]), tagsOf), -1);
    assert.equal(sentenceInitialCommonWord(words(["May", "NNP"], ["joined", "VBD"]), tagsOf), -1);
  });

  it("頭の一字だけが大文字の形でなければ触れない（API、USE、iPhone、A）", () => {
    ["API", "USE", "CONTAINERS", "iPhone", "A", "ContainerS"].forEach((value) =>
      assert.equal(sentenceInitialCommonWord(words([value, "NNP"]), tagsOf), -1, value),
    );
  });

  it("解析器が固有名詞としなかった語、空の文、語の無い文には触れない", () => {
    assert.equal(sentenceInitialCommonWord(words(["Use", "VB"]), tagsOf), -1);
    assert.equal(sentenceInitialCommonWord([], tagsOf), -1);
    assert.equal(sentenceInitialCommonWord(words(["—", ":"], ["2026", "CD"]), tagsOf), -1);
  });

  it("語彙が空の品詞の並びを返しても、普通の語とは言わない", () => {
    assert.equal(
      sentenceInitialCommonWord(words(["Containers", "NNP"]), () => []),
      -1,
    );
  });
});

describe("lowercasedAt", () => {
  it("最初に現れた語だけを小文字にする", () => {
    assert.equal(lowercasedAt("- Containers hold Containers.", "Containers"), "- containers hold Containers.");
  });

  it("語が無い、または文に無ければ undefined", () => {
    assert.equal(lowercasedAt("Containers start.", undefined), undefined);
    assert.equal(lowercasedAt("Containers start.", "Pods"), undefined);
    assert.equal(lowercasedAt("", "Pods"), undefined);
  });
});

describe("rereadAt", () => {
  const original = [
    { value: "Containers", pos: "NNP", lemma: "containers" },
    { value: "start", pos: "VBP" },
  ];

  it("その位置の品詞と原形だけを読み直した結果から取り、表層は元のまま", () => {
    const again = [
      { value: "containers", pos: "NNS", lemma: "container" },
      { value: "start", pos: "VB" },
    ];
    assert.deepEqual(rereadAt(original, 0, again), [{ value: "Containers", pos: "NNS", lemma: "container" }, original[1]]);
  });

  it("読み直した語に原形が無ければ、元の原形も持ち越さない", () => {
    assert.deepEqual(rereadAt(original, 0, [{ value: "containers", pos: "NNS" }]), [{ value: "Containers", pos: "NNS" }, original[1]]);
  });

  it("同じ位置に同じ語の小文字が無ければ（語の切り方が変わった）元のまま", () => {
    assert.deepEqual(rereadAt(original, 0, [{ value: "contain", pos: "VB" }]), original);
    assert.deepEqual(rereadAt(original, 0, [{ value: "Containers", pos: "NNS" }]), original);
    assert.deepEqual(rereadAt(original, 0, []), original);
  });

  it("位置が文の外（-1 や長さ以上）なら元のまま", () => {
    assert.deepEqual(rereadAt(original, -1, [{ value: "containers", pos: "NNS" }]), original);
    assert.deepEqual(rereadAt(original, 5, [{ value: "containers", pos: "NNS" }]), original);
  });
});

describe("capitalisedGuessedVerbsAsNames", () => {
  const VOCABULARY: Readonly<Record<string, readonly string[]>> = { change: ["VB", "NN"], to: ["TO"], returned: ["VBD"] };
  const tagsOf = (word: string): readonly string[] | undefined => VOCABULARY[word];
  // WordNet の語義の分類: 18 は noun.person、10 は noun.communication、30 は verb.change、35 は verb.contact。
  const SENSES: Readonly<Record<string, readonly number[]>> = { helen: [18], sarah: [18], greek: [10, 18], detach: [35], endeavor: [4, 30] };
  const sensesOf = (word: string): readonly number[] => SENSES[word] ?? [];
  const words = (...pairs: readonly (readonly [string, string])[]): { value: string; pos: string }[] => pairs.map(([value, pos]) => ({ value, pos }));
  const reread = (tagged: readonly { value: string; pos: string }[]): readonly { value: string; pos: string }[] =>
    capitalisedGuessedVerbsAsNames(tagged, tagsOf, sensesOf);

  it("文の途中で頭だけ大文字の、語彙に無く WordNet に動詞の語義も無い語を原形の動詞と当てたものは固有名詞（returned to Helen）", () => {
    assert.deepEqual(
      reread(words(["returned", "VBD"], ["to", "TO"], ["Helen", "VB"], ["Marsh", "NNP"])),
      words(["returned", "VBD"], ["to", "TO"], ["Helen", "NNP"], ["Marsh", "NNP"]),
    );
    assert.deepEqual(reread(words(["we", "PRP"], ["Sarah", "VBP"])), words(["we", "PRP"], ["Sarah", "NNP"]));
    assert.deepEqual(reread(words(["write", "VB"], ["Greek", "VB"])), words(["write", "VB"], ["Greek", "NNP"]));
  });

  it("WordNet が動詞として知る語（to Detach、to Endeavor）は動詞のまま", () => {
    [words(["to", "TO"], ["Detach", "VB"]), words(["to", "TO"], ["Endeavor", "VB"])].forEach((tagged) => assert.deepEqual(reread(tagged), tagged));
  });

  it("語彙に載っている語（How to Change）、文頭の語、小文字や全部大文字の語、動詞でない語は解析器の読みのまま", () => {
    const kept = [
      words(["How", "WRB"], ["to", "TO"], ["Change", "VB"]),
      words(["Helen", "VB"], ["it", "PRP"]),
      words(["(", "("], ["Helen", "VB"]),
      words(["to", "TO"], ["helen", "VB"]),
      words(["to", "TO"], ["HELEN", "VB"]),
      words(["to", "TO"], ["Helen", "NN"]),
      words(["to", "TO"], ["Helen", "VBD"]),
      [],
    ];
    kept.forEach((tagged) => assert.deepEqual(reread(tagged), tagged));
  });
});

describe("英語の文書で、to の後ろの名は固有名詞", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const tagOf = (source: string, word: string): string | undefined =>
    buildDocument("t.md", source, en)
      .sentences.flatMap((sentence) => sentence.tokens ?? [])
      .find((token) => token.surface === word)?.pos;

  it("returned to Helen の Helen は名前、how to Change の Change は動詞のまま", () => {
    assert.equal(tagOf("The parts were returned to Helen Marsh.", "Helen"), "PROPN");
    assert.equal(tagOf("We spoke to Sarah Lee.", "Sarah"), "PROPN");
    assert.equal(tagOf("Learn how to Change a tire.", "Change"), "VERB");
    assert.equal(tagOf("We need to Detach the cable.", "Detach"), "VERB");
  });
});

describe("isOrdinaryWord", () => {
  const VOCABULARY: Readonly<Record<string, readonly string[]>> = { course: ["NN", "RB"], mature: ["JJ", "NNP"], may: ["MD", "NNP"] };
  const tagsOf = (word: string): readonly string[] | undefined => VOCABULARY[word];
  // WordNet の語義の分類: 0 は adj.all、1 は adj.pert、10 は noun.communication、15 は noun.location、17 は noun.object、18 は noun.person。
  const SENSES: Readonly<Record<string, readonly number[]>> = { greek: [10, 18, 1], mature: [0], marsh: [17, 18], helen: [18], paris: [15, 18] };
  const sensesOf = (word: string): readonly number[] => SENSES[word] ?? [];
  const ordinary = (surface: string): boolean => isOrdinaryWord(surface, tagsOf, sensesOf);

  it("語彙が普通の語として知る語（Course）と、WordNet が人や場所でない語義を知る語（Greek、Mature、Marsh）はふつうの語", () => {
    ["Course", "Greek", "Mature", "Marsh"].forEach((surface) => assert.equal(ordinary(surface), true, surface));
  });

  it("人や場所の語義しか無い語（Helen、Paris）、どちらにも無い語（Okafor）、固有名詞にもなる語彙の語（May）は名前の語", () => {
    ["Helen", "Paris", "Okafor", "May"].forEach((surface) => assert.equal(ordinary(surface), false, surface));
  });

  it("頭だけ大文字でない語（course、COURSE、McCourse）と、空の語は見ない", () => {
    ["course", "COURSE", "McCourse", "", "C"].forEach((surface) => assert.equal(ordinary(surface), false, surface));
  });
});

describe("英語の文書で、名前と読んだふつうの語には OrdinaryWord=Yes", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const featureOf = (source: string, word: string): string | undefined =>
    buildDocument("t.md", source, en)
      .sentences.flatMap((sentence) => sentence.tokens ?? [])
      .find((token) => token.surface === word && token.pos === "PROPN")?.features?.["OrdinaryWord"];

  it("Greek はふつうの語、Okafor と Helen は名前の語", () => {
    assert.equal(featureOf("The menu was printed in Greek for the guests.", "Greek"), "Yes");
    assert.equal(featureOf("Kenji Okafor sent the file.", "Okafor"), undefined);
    assert.equal(featureOf("The keys were handed to Helen Marsh.", "Helen"), undefined);
  });
});

describe("英語の文書で、文頭の大文字だけでは固有名詞に数えない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const posOf = (source: string, surface: string): string[] =>
    buildDocument("t.md", source, en)
      .sentences.flatMap((sentence) => sentence.tokens ?? [])
      .filter((token) => token.surface === surface)
      .map((token) => token.pos);

  it("文頭の普通の名詞と形容詞は、普通の品詞になる", () => {
    assert.deepEqual(posOf("Containers start in seconds.", "Containers"), ["NOUN"]);
    assert.deepEqual(posOf("Traditional servers were slow.", "Traditional"), ["ADJ"]);
    assert.deepEqual(posOf("- Something broke overnight.", "Something"), ["NOUN"]);
  });

  it("名前は文頭でも文の途中でも固有名詞のまま", () => {
    assert.deepEqual(posOf("Kubernetes restarts them.", "Kubernetes"), ["PROPN"]);
    assert.deepEqual(posOf("Congress passed the bill.", "Congress"), ["PROPN"]);
    assert.deepEqual(posOf("API calls are slow.", "API"), ["PROPN"]);
    assert.deepEqual(posOf("We moved the Containers team to Chicago.", "Containers"), ["PROPN"]);
  });

  it("文頭の語を読み直しても、後ろの語の品詞と位置は変わらない", () => {
    const tokens = buildDocument("t.md", "Containers were restarted by Kubernetes.", en).sentences.flatMap((sentence) => sentence.tokens ?? []);
    assert.deepEqual(
      tokens.map((token) => [token.surface, token.pos, token.span.start]),
      [
        ["Containers", "NOUN", 0],
        ["were", "VERB", 11],
        ["restarted", "VERB", 16],
        ["by", "ADP", 26],
        ["Kubernetes", "PROPN", 29],
        [".", "PUNCT", 39],
      ],
    );
  });
});

describe("proper-noun-density は、文頭の大文字の語を名前に数えない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const densityFindings = (source: string): number =>
    runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "business/report").findings.filter(
      (finding) => finding.rule === "proper-noun-density",
    ).length;

  // 文頭の語が毎回大文字になる、名前の無い文章。20 文 × 12 語で 200 語を超える。
  const PLAIN = Array.from({ length: 20 }, () => "Teams review changes before they ship. Meetings stay short when notes come first.").join("\n\n");
  // 名前が続く文章。文頭の語を読み直しても、本物の名前が多ければ指摘は残る。
  const NAMED = Array.from({ length: 20 }, () => "Alice Moreno met Bob Tanaka in Chicago. Kubernetes runs on Azure and Google Cloud.").join("\n\n");

  it("valid: 名前の無い文章は、文頭が大文字でも指摘しない", () => {
    assert.equal(densityFindings(PLAIN), 0);
  });

  it("invalid: 名前が続く文章は指摘する", () => {
    assert.equal(densityFindings(NAMED), 1);
  });
});

describe("proper-noun-density の英語の上限は、人の書いた文書の分布から決めた", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const densityAt = (source: string, level: "strict" | "normal" | "relaxed"): number =>
    runRules(buildDocument("t.md", source, en), loadRules("en"), { "proper-noun-density": level }, true, "business/report").findings.filter(
      (finding) => finding.rule === "proper-noun-density",
    ).length;

  const NAMED_SENTENCE = "Alice Moreno from Contoso met Bob Tanaka in Seattle.";
  const PLAIN_SENTENCES = [
    "The team reviewed the plan and agreed on the next steps.",
    "The budget stayed within the limit set last spring.",
    "Everyone left with a clear list of tasks for the month.",
    "Nobody asked for more time.",
  ];
  const repeated = (sentences: readonly string[]): string => Array.from({ length: 8 }, () => sentences.join(" ")).join("\n\n");
  // 名前の文 1 つに名前の無い文 4 つ。人の書いた報告書ではふつうの多さ（コーパスの中ほど）。
  const REPORT = repeated([NAMED_SENTENCE, ...PLAIN_SENTENCES]);
  // 名前の文 1 つに短い名前の無い文 3 つ。strict と normal の上限のあいだ。
  const NAME_HEAVY = repeated([NAMED_SENTENCE, PLAIN_SENTENCES[0] ?? "", PLAIN_SENTENCES[1] ?? "", "Everyone left with a clear list."]);
  // 名前ばかりの文章（著者の並んだ抄録のページ）。
  const NAMES = Array.from({ length: 20 }, () => "Alice Moreno met Bob Tanaka in Chicago. Kubernetes runs on Azure and Google Cloud.").join("\n\n");

  it("valid: ふつうの多さの名前は、strict でも指摘しない", () => {
    assert.equal(densityAt(REPORT, "strict"), 0);
    assert.equal(densityAt(REPORT, "normal"), 0);
  });

  it("名前の多い文章は strict だけが指摘し、名前ばかりの文章はどの段でも指摘する", () => {
    assert.equal(densityAt(NAME_HEAVY, "strict"), 1);
    assert.equal(densityAt(NAME_HEAVY, "normal"), 0);
    assert.equal(densityAt(NAMES, "normal"), 1);
    assert.equal(densityAt(NAMES, "relaxed"), 1);
  });
});
