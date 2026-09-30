import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGenres } from "../packages/chaff/src/genre-parse.ts";
import { suggestGenre } from "../packages/chaff/src/genre-suggest.ts";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { runCli } from "./cli-run.ts";

const localized = (text: string): { ja: string; en: string } => ({ ja: text, en: text });

const TOY = parseGenres({
  groups: [{ id: "legal", name: localized("Legal") }],
  genres: [
    {
      id: "legal/contract",
      name: localized("Contract"),
      summary: localized("Contracts"),
      suggest: { paths: ["(^|/)contracts/"], ja: { line: "本契約", min_lines: 2 }, en: { line: "\\b[Tt]his Agreement\\b", min_lines: 2 } },
    },
    { id: "legal/statute", name: localized("Statute"), summary: localized("Statutes"), profile: "statute" },
    { id: "legal/memo", name: localized("Memo"), summary: localized("Memos") },
    { id: "legal/minutes", name: localized("Minutes"), summary: localized("Minutes"), suggest: { paths: ["(^|/)minutes/"], ja: { line: "^○", min_lines: 3 } } },
    { id: "legal/letter", name: localized("Letter"), summary: localized("Letters"), suggest: { en: { opening: "^Dear " }, ja: { opening: "^拝啓" } } },
  ],
});

const suggest = (path: string, source: string, language = "ja"): string | undefined => suggestGenre({ path, source, language }, TOY, loadProfiles())?.id;

describe("ジャンルの見当", () => {
  it("パスが当たれば、その種類を挙げる（大文字小文字は問わない）", () => {
    assert.equal(suggest("docs/contracts/a.md", "本文。"), "legal/contract");
    assert.equal(suggest("Contracts/a.md", "本文。"), "legal/contract");
  });

  it("その言語の行の形が、決めた行数あれば挙げる", () => {
    assert.equal(suggest("a.md", "本契約は、甲と乙の間の契約である。\n本契約の期間は一年とする。\n"), "legal/contract");
    assert.equal(suggest("a.md", "This Agreement starts today.\nThis Agreement ends in a year.\n", "en"), "legal/contract");
  });

  it("その言語の行の形が無いジャンルは、行では挙げない", () => {
    const speakers = "○山田君、質問です。\n○鈴木君、答えます。\n○佐藤君、続けます。\n";
    assert.equal(suggest("a.md", speakers, "ja"), "legal/minutes");
    assert.equal(suggest("a.md", speakers, "en"), undefined);
  });

  it("行数が足りなければ挙げない", () => assert.equal(suggest("a.md", "本契約は、甲と乙の間の契約である。\n"), undefined));

  it("行の形はその言語のものだけを見る", () => {
    assert.equal(suggest("a.md", "本契約は、甲と乙の間の契約である。\n本契約の期間は一年とする。\n", "en"), undefined);
    assert.equal(suggest("a.md", "This Agreement starts.\nThis Agreement ends.\n", "ja"), undefined);
  });

  it("profile を持つジャンルは、内容がその profile の形なら挙げる", () => {
    const statute = "第一条　この法律は、…。\n第二条　この法律において、…。\n第三条　国は、…。\n";
    assert.equal(suggest("a.txt", statute), "legal/statute");
    assert.equal(suggest("a.txt", "第一条　この法律は、…。\n"), undefined);
  });

  it("手がかりの無いジャンルは挙げない", () => assert.equal(suggest("memo/a.md", "メモです。"), undefined));

  it("何にも当たらなければ挙げない", () => {
    assert.equal(suggest("a.md", ""), undefined);
    assert.equal(suggest("", "本文。"), undefined);
  });

  it("同じ強さで当たれば、先に書いたジャンルが勝つ", () => {
    const both = "本契約は、…。\n本契約は、…。\n第一条　この法律は、…。\n第二条　…。\n第三条　…。\n";
    assert.equal(suggest("a.md", both), "legal/contract");
  });

  it("より多く当たるジャンルが勝つ（契約を論じる会議録は会議録）", () => {
    const minutes = [
      "○山田君　本契約について伺います。",
      "○鈴木君　本契約は妥当です。",
      ...Array.from({ length: 7 }, (_, index) => `○委員${String(index)}君、意見です。`),
    ].join("\n");
    assert.equal(suggest("a.md", minutes), "legal/minutes");
    const contract = ["本契約は、…。", "本契約は、…。", "本契約は、…。", "本契約は、…。", "○山田君　…。", "○鈴木君　…。", "○佐藤君　…。"].join("\n");
    assert.equal(suggest("a.md", contract), "legal/contract");
  });

  it("パスの手がかりは、行の数より強い", () => {
    const contract = "本契約は、…。\n本契約は、…。\n本契約は、…。\n本契約は、…。\n";
    assert.equal(suggest("minutes/a.md", contract), "legal/minutes");
  });

  describe("書き出しの手がかり", () => {
    const enclosed = "Dear Ms. Rivera,\n\nThis Agreement starts.\nThis Agreement ends.\nThis Agreement binds.\nThis Agreement holds.\n";

    it("本文の最初の行がその形なら、行の数より強い（契約を同封した手紙は手紙）", () => {
      assert.equal(suggest("a.md", enclosed, "en"), "legal/letter");
      assert.equal(suggest("a.md", "拝啓　本契約は、…。\n本契約は、…。\n本契約は、…。\n"), "legal/letter");
    });

    it("空行、見出し、front matter は飛ばして最初の行を見る", () => {
      assert.equal(suggest("a.md", "\n# Offer\n\nDear Ms. Rivera,\n", "en"), "legal/letter");
      assert.equal(suggest("a.md", "---\ntitle: Offer\n---\n\nDear Ms. Rivera,\n", "en"), "legal/letter");
      assert.equal(suggest("a.md", "\r\n## Offer\r\n\r\nDear Ms. Rivera,\r\n", "en"), "legal/letter");
      assert.equal(suggest("a.md", "---\r\ntitle: Offer\r\n---\r\nDear Ms. Rivera,\r\n", "en"), "legal/letter");
    });

    it("行の前後の空白は見ない（Markdown の改行の空白二つ）", () => {
      assert.equal(suggest("a.md", "Dear Ms. Rivera,  \nWe are pleased.\n", "en"), "legal/letter");
      assert.equal(suggest("a.txt", "    Dear Ms. Rivera,\n", "en"), "legal/letter");
    });

    it("四つ字下げした # はコードの行で、見出しではない", () => {
      assert.equal(suggest("a.md", "   # Offer\nDear Ms. Rivera,\n", "en"), "legal/letter");
      assert.equal(suggest("a.md", "    # a comment in code\nDear Ms. Rivera,\n", "en"), undefined);
    });

    it("最初の行でなければ見ない", () => {
      assert.equal(suggest("a.md", "Hello.\nDear Ms. Rivera,\n", "en"), undefined);
      assert.equal(suggest("a.md", "Summary\n\nDear Ms. Rivera,\nThis Agreement starts.\nThis Agreement ends.\n", "en"), "legal/contract");
    });

    it("その言語の書き出しだけを見る", () => {
      assert.equal(suggest("a.md", "Dear Ms. Rivera,\n", "ja"), undefined);
      assert.equal(suggest("a.md", "拝啓\n", "en"), undefined);
    });

    it("パスの手がかりは、書き出しより強い", () => assert.equal(suggest("contracts/a.md", enclosed, "en"), "legal/contract"));

    it("空の文書や、front matter だけの文書には書き出しが無い", () => {
      assert.equal(suggest("a.md", "", "en"), undefined);
      assert.equal(suggest("a.md", "---\ntitle: x\n---\n", "en"), undefined);
      assert.equal(suggest("a.md", "---\nDear Ms. Rivera,\n", "en"), undefined);
    });
  });
});

describe("suggest の読み込み", () => {
  const genre = (suggestField: unknown): unknown => ({
    groups: [{ id: "a", name: localized("a") }],
    genres: [{ id: "a/b", name: localized("b"), summary: localized("b"), suggest: suggestField }],
  });
  const broken: readonly (readonly [string, unknown, RegExp])[] = [
    ["map でない", "x", /suggest must be a map/u],
    ["paths が list でない", { paths: "x" }, /suggest.paths must be a list/u],
    ["壊れた正規表現", { paths: ["("] }, /a\/b suggest.paths/u],
    ["空のパターン", { paths: [""] }, /non-empty/u],
    ["min_lines が無い", { ja: { line: "x" } }, /min_lines/u],
    ["min_lines が 0", { ja: { line: "x", min_lines: 0 } }, /min_lines/u],
    ["min_lines が小数", { ja: { line: "x", min_lines: 1.5 } }, /min_lines/u],
    ["line が無い", { ja: { min_lines: 1 } }, /a\/b suggest.ja/u],
    ["壊れた行の正規表現", { en: { line: "[", min_lines: 1 } }, /a\/b suggest.en/u],
    ["壊れた書き出しの正規表現", { en: { opening: "[" } }, /a\/b suggest.en/u],
    ["空の書き出し", { en: { opening: "" } }, /non-empty/u],
    ["行も書き出しも無い", { en: {} }, /a\/b suggest.en/u],
    ["書き出しと min_lines だけ", { en: { opening: "^Dear ", min_lines: 1 } }, /a\/b suggest.en/u],
  ];
  broken.forEach(([label, raw, message]) => {
    it(`読めないものは止める: ${label}`, () => assert.throws(() => parseGenres(genre(raw)), message));
  });

  it("書かなければ手がかりは無い", () => {
    const data = parseGenres(genre(undefined));
    assert.deepEqual(data.genres[0]?.suggest, { paths: [], lines: {}, openings: {} });
  });

  it("書き出しだけでも、行と書き出しの両方でも書ける", () => {
    const data = parseGenres(genre({ en: { opening: "^Dear " }, ja: { opening: "^拝啓", line: "敬具", min_lines: 1 } }));
    assert.deepEqual(Object.keys(data.genres[0]?.suggest.openings ?? {}), ["en", "ja"]);
    assert.deepEqual(Object.keys(data.genres[0]?.suggest.lines ?? {}), ["ja"]);
  });
});

type BundledCase = readonly [label: string, path: string, language: string, source: string, expected: string | undefined];

const times = (count: number, text: string): string => Array.from({ length: count }, () => text).join("\n");

const OFFER_LETTER = [
  "Dear Ms. Rivera,",
  "",
  "We are delighted to offer you the position of editor. Please sign and return this letter.",
  "",
  "## Proprietary Information Agreement",
  "",
  "1. I will not enter into any agreement in conflict with this Agreement.",
  "2. This Agreement survives the end of my employment.",
  "3. Any dispute about this Agreement is resolved under the laws of California.",
  "4. This Agreement may be executed in counterparts.",
].join("\n");

const LETTERS: readonly BundledCase[] = [
  ["契約を同封した採用通知", "a.md", "en", OFFER_LETTER, "business/email"],
  ["契約の置き場所にある手紙の形の文書は、パスに従う", "contracts/offer.md", "en", OFFER_LETTER, "legal/contract"],
  ["見出しの下から始まる手紙", "a.md", "en", "# Offer\n\nDear Ms. Rivera,\n\nWe are pleased to offer you the role.\n", "business/email"],
  ["拝啓で始まる手紙", "a.md", "ja", "拝啓　時下ますますご清栄のこととお慶び申し上げます。\n\n敬具\n", "business/email"],
  ["件名で始まるメール", "a.md", "ja", "件名: 打ち合わせについて\n\n株式会社北浜商事\n総務部 山田様\n\nいつもお世話になっております。\n", "business/email"],
  ["Subject で始まるメール", "a.md", "en", "Subject: Meeting about the booking service\n\nDear facilities team,\n\nThank you.\n", "business/email"],
  ["途中に宛名がある案内", "a.md", "en", "Here is a template.\n\nDear [name],\n\nYou are invited.\n", undefined],
  // 見積書や提案書も宛名から始まる。
  ["御中で始まる見積書", "a.md", "ja", "# 御見積書\n\n株式会社北浜商事 御中\n発行日: 2026年10月5日（月）\n\n下記のとおりお見積りいたします。\n", undefined],
  ["To で始まる提案書", "a.md", "en", "# Proposal\n\nTo: Kitahama Trading, facilities team\n\nWe propose a visitor log.\n", undefined],
];

// 手順の見出しは、技術ブログにも仕様書にもある。
const NOT_MANUALS: readonly BundledCase[] = [
  [
    "手順を見出しにした技術ブログ",
    "a.md",
    "en",
    "# Migrating origins\n\n### Step 1: Declare the old origin\n\nAdd a field.\n\n### Step 2: Confirm\n\nServe a file.\n\n### Step 3: Redirect\n\nRedirect.\n",
    undefined,
  ],
  [
    "作成手順を見出しにした仕様書",
    "a.md",
    "ja",
    "# データマップ\n\n## 作成手順と留意点\n\n### サービス側の作成手順\n\n表を作る。\n\n### データセット側の作成手順\n\n表を作る。\n",
    undefined,
  ],
];

// 石川啄木「一握の砂」、Robert Frost "Ghost House"、岸田國士「紙風船」、夏目漱石「夢十夜」（いずれも著作権の切れた作品）。
const TANKA =
  "東海の小島の磯の白砂に\nわれ泣きぬれて\n蟹とたはむる\n\n頬につたふ\nなみだのごはず\n一握の砂を示しし人を忘れず\n\nいたく錆びしピストル出でぬ\n砂山の\n砂を指もて掘りてありしに\n";
const GHOST_HOUSE = [
  "I dwell in a lonely house I know",
  "That vanished many a summer ago,",
  "And left no trace but the cellar walls,",
  "And a cellar in which the daylight falls,",
  "O'er ruined fences the grape-vines shield",
  "The woods come back to the mowing field;",
  "The orchard tree has grown one copse",
  "Of new wood and old where the woodpecker chops;",
  "I dwell with a strangely aching heart",
  "In that vanished abode there far apart",
  "On that disused and forgotten road",
  "Night comes; the black bats tumble and dart;",
  "The whippoorwill is coming to shout",
  "Full many a time to say his say",
  "",
].join("\n");
const KAMIFUSEN = "妻　　あたしは、思ひ立つた時すぐでなけれやいやなの。\n\n夫　　散歩か。\n\n妻　　散歩でもなんでも……。\n\n（間）\n\n夫　　あ。\n";
const YUME =
  "「田圃へかかったね」と背中で云った。\n「どうして解る」と顔を後ろへ振り向けるようにして聞いたら、\n「だって鷺が鳴くじゃないか」と答えた。\n「御父さん、重いかい」と聞いた。\n「重かあない」と答えると\n「今に重くなるよ」と云った。\n自分は我子ながら少し怖くなった。\n";

const LITERATURE: readonly BundledCase[] = [
  ["短歌の集", "a.md", "ja", times(5, TANKA), "literature/poetry"],
  ["英語の詩", "a.txt", "en", times(6, GHOST_HOUSE), "literature/poetry"],
  ["台詞の前に役名を置いた戯曲", "a.md", "ja", times(6, KAMIFUSEN), "literature/play"],
  ["会話の多い小説", "a.md", "ja", `こんな夢を見た。\n${times(2, YUME)}`, "literature/fiction"],
  ["短い詩ひとつは挙げない", "a.md", "ja", TANKA, undefined],
];

const NOT_LITERATURE: readonly BundledCase[] = [
  ["短い名詞の行が並ぶ用語の表", "a.md", "ja", times(15, "最大風速\n\n平均風速\n\n海上風警報に相当\n"), undefined],
  [
    "定義した語を括弧で示すガイドライン",
    "a.md",
    "ja",
    times(12, "「本人に対して医師等により指導が行われたこと」とは、医師が指導することをいう。\n"),
    undefined,
  ],
  ["全角空白一つで条見出しを続ける法令", "a.txt", "ja", times(30, "第一条　国は、…。\n第二条　市町村は、…。\n"), "legal/statute"],
  ["定義した語だけを括弧に入れた行", "a.md", "ja", times(12, "「平成27年改正法」\n"), undefined],
  [
    "括弧の語を定める行",
    "a.md",
    "ja",
    times(4, "「管理者」とする。\n「本サービス」という。\n「甲」と定める。\n「乙」と称する。\n「丙」と呼ぶ。\n「丁」といい、\n"),
    undefined,
  ],
  ["名前の行が並ぶ議事録", "a.md", "en", times(30, "      Shane Curcuru\n      Craig L Russell\n"), undefined],
];

describe("同梱のジャンルの見当", () => {
  const data = loadGenres();
  const guess = (path: string, source: string, language: string): string | undefined => suggestGenre({ path, source, language }, data, loadProfiles())?.id;

  const cases: readonly (readonly [string, string, string, string, string | undefined])[] = [
    [
      "契約書",
      "a.md",
      "ja",
      "株式会社アルファ（以下「甲」という）と株式会社ベータ（以下「乙」という）は、本契約を締結する。\n第1条（目的）\n本契約は、業務の委託について定める。\n",
      "legal/contract",
    ],
    [
      "利用規約",
      "a.md",
      "ja",
      "# 利用規約\n\n本規約は、本サービスの利用条件を定める。\n\n## 第1条（適用）\n\n本規約は、利用者に適用される。\n",
      "legal/contract",
    ],
    [
      "英文の契約",
      "a.md",
      "en",
      "This Agreement is made between the Parties.\n\n1. Term. This Agreement starts on the Effective Date.\n\n2. Fees. The Parties agree to the fees in this Agreement.\n",
      "legal/contract",
    ],
    ["法令", "a.txt", "ja", "第一条　この法律は、…。\n第二条　この法律において、…。\n第三条　国は、…。\n", "legal/statute"],
    ["社内規程", "a.md", "ja", "第1条（目的）\nこの規程は、出張の手続を定める。\n第2条（適用）\nこの規程は、全ての従業員に適用する。\n", "legal/statute"],
    ["特許", "a.md", "ja", "【課題】 雨を防ぐ。\n【解決手段】 傘に膜を張る。\n【選択図】 図１\n", "legal/patent"],
    [
      "よくある質問",
      "a.md",
      "ja",
      "# よくある質問\n\n## Q1. 申し込みはいつまでですか？\n\n3月末までです。\n\n## Q2. 費用はかかりますか？\n\nかかりません。\n\n## Q3. 途中でやめられますか？\n\nやめられます。\n",
      "docs/faq",
    ],
    ["英語の FAQ", "a.md", "en", "# FAQ\n\nQ: Can I cancel?\n\nYes.\n\nQ: Is there a fee?\n\nNo.\n", "docs/faq"],
    ["見出しが問いなだけの記事", "a.md", "en", "# Notes\n\n## Why now?\n\nBecause.\n\n## What next?\n\nMore.\n\n## Who pays?\n\nUs.\n", undefined],
    [
      "論文",
      "a.md",
      "en",
      "# A study\n\n## Abstract\n\nWe study rain.\n\n## Methods\n\nWe count drops.\n\n## Results\n\nMany.\n\n## References\n\n1. Smith.\n",
      "academic/paper",
    ],
    ["要旨と参考文献だけの仕様書", "a.md", "en", "# RFC\n\n## Abstract\n\nA header.\n\n## References\n\n1. RFC 9110.\n", undefined],
    [
      "国会の会議録",
      "a.md",
      "ja",
      "○委員長（山田太郎君）　ただいまから会議を開きます。\n○山本一郎君　質問します。\n○国務大臣（鈴木花子君）　お答えします。\n",
      "speech/transcript",
    ],
    ["ブログ記事", "a.md", "ja", "# 旅行記\n\n先週、京都に行きました。紅葉がきれいでした。\n\n## 一日目\n\n寺を回りました。\n", undefined],
    ["英語のブログ記事", "a.md", "en", "# Our trip\n\nWe went to Kyoto last week.\n\n## Day one\n\nWe saw the temples.\n", undefined],
    ["README", "README.md", "en", "# tool\n\n## Install\n\nRun npm install.\n\n## Usage\n\nRun tool.\n", undefined],
    ...LETTERS,
    ...NOT_MANUALS,
    ...LITERATURE,
    ...NOT_LITERATURE,
  ];
  cases.forEach(([label, path, language, source, expected]) => {
    it(`${label} → ${expected ?? "挙げない"}`, () => assert.equal(guess(path, source, language), expected));
  });
});

describe("画面の見当", () => {
  const CONTRACT =
    "業務委託契約書\n\n株式会社アルファ（以下「甲」という）と株式会社ベータ（以下「乙」という）は、本契約を締結する。\n\n第1条（目的）\n本契約は、業務の委託について定める。\n";

  it("ジャンルを決めていない文書には、見出しの下と最後に見当を出す", async () => {
    const run = await runCli({ "a.md": CONTRACT }, ["a.md"]);
    const lines = run.out.split("\n");
    const header = lines.findIndex((line) => line.startsWith("a.md   blog/tech"));
    assert.equal(lines[header + 1], "   契約書・規約のようです。--genre legal/contract を試せます");
    assert.match(run.out, /ジャンルを決めていないので、blog\/tech として見ました。契約書・規約なら、--genre legal\/contract で/u);
  });

  it("英語の文書には英語で出す", async () => {
    const english = "This Agreement is made between the Parties.\n\nThis Agreement starts today.\n\nThe Parties sign this Agreement.\n";
    const run = await runCli({ "a.md": english }, ["a.md"], "ja_JP.UTF-8");
    assert.match(run.out, /^ {3}Looks like: Contract and terms\. Try --genre legal\/contract$/mu);
    assert.match(run.out, /No genre was set, so this was checked as blog\/tech\. If it is Contract and terms, --genre legal\/contract/u);
  });

  it("--compact では見出しの下だけに出す", async () => {
    const run = await runCli({ "a.md": CONTRACT }, ["a.md", "--compact"]);
    assert.match(run.out, /のようです。--genre legal\/contract を試せます/u);
    assert.doesNotMatch(run.out, /ジャンルを決めていないので/u);
  });

  it("見当は出すだけで、検査のジャンルは変えない", async () => {
    const run = await runCli({ "a.md": CONTRACT }, ["a.md"]);
    assert.match(run.out, /a\.md {3}blog\/tech · 日本語 {3}ジャンルは既定から/u);
  });

  const decided: readonly (readonly [string, Readonly<Record<string, string>>, readonly string[]])[] = [
    ["--genre", { "a.md": CONTRACT }, ["a.md", "--genre", "business/report"]],
    ["chaff.yaml の genre", { "a.md": CONTRACT, "chaff.yaml": "genre: business/report\n" }, ["a.md"]],
    ["by_path の genre", { "a.md": CONTRACT, "chaff.yaml": 'by_path:\n  - files: ["*.md"]\n    genre: business/report\n' }, ["a.md"]],
    ["front matter の genre", { "a.md": `---\ngenre: business/report\n---\n${CONTRACT}` }, ["a.md"]],
    // 書いたが読めなかったジャンルも、書いた人が決めたもの。「ジャンルを決めていないので」とは言えない。
    ["front matter の知らない genre", { "a.md": `---\ngenre: contract\n---\n${CONTRACT}` }, ["a.md"]],
  ];
  decided.forEach(([label, files, args]) => {
    it(`ジャンルが決まっていれば出さない: ${label}`, async () => {
      const run = await runCli(files, args);
      assert.doesNotMatch(run.out, /のようです|ジャンルを決めていないので/u);
    });
  });
});
