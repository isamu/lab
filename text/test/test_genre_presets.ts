import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGenres, presetLevelsOf, presetProfileOf, type GenreData } from "../packages/chaff/src/genre-parse.ts";
import { loadGenres, presetLevels } from "../packages/chaff/src/genre-load.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { chooseProfile } from "../packages/chaff/src/profile/select.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { resolve } from "../packages/chaff/src/levels.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { neededBy, runRules, wantsTags, type RunResult } from "../packages/chaff/src/run.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { renderGenres } from "../packages/chaff/src/render/genres.ts";
import { rulesJson } from "../packages/chaff/src/render/rules-json.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { asExperimental, firedRules, namedRuleRun } from "./rule-run.ts";
import { withMeasuredOffs } from "../scripts/rules-apply.ts";
import { parse } from "yaml";

const localized = (text: string): { ja: string; en: string } => ({ ja: `${text}（ja）`, en: text });

const TOY = {
  groups: [
    { id: "legal", name: localized("Legal"), rules: { "ngram-repetition": "off", "numbering-gap": "normal" } },
    { id: "blog", name: localized("Blog") },
  ],
  genres: [
    { id: "legal/contract", name: localized("Contract"), summary: localized("Contracts"), rules: { "ngram-repetition": "relaxed" } },
    { id: "legal/statute", name: localized("Statute"), summary: localized("Statutes"), profile: "statute" },
    { id: "blog/tech", name: localized("Tech"), summary: localized("Articles") },
  ],
};

describe("genres.yaml を読む", () => {
  it("群とジャンルを、書いた順に読む", () => {
    const data = parseGenres(TOY);
    assert.deepEqual(
      data.genres.map((genre) => genre.id),
      ["legal/contract", "legal/statute", "blog/tech"],
    );
    assert.deepEqual(
      data.groups.map((group) => group.id),
      ["legal", "blog"],
    );
    assert.equal(data.genres[1]?.profile, "statute");
    assert.deepEqual(data.groups[1]?.rules, {});
  });

  const broken: readonly (readonly [string, unknown, RegExp])[] = [
    ["map でない", [], /groups and genres/u],
    ["groups が無い", { genres: [] }, /under groups/u],
    ["genres が無い", { groups: [] }, /under genres/u],
    ["id が無い", { groups: [], genres: [{ name: localized("x"), summary: localized("x") }] }, /no id/u],
    ["id が空", { groups: [{ id: "", name: localized("x") }], genres: [] }, /no id/u],
    ["en が無い名前", { groups: [{ id: "a", name: { ja: "あ" } }], genres: [] }, /a: name needs a ja and an en/u],
    [
      "空の説明",
      { groups: [{ id: "a", name: localized("a") }], genres: [{ id: "a/b", name: localized("b"), summary: { ja: "", en: "b" } }] },
      /a\/b: summary/u,
    ],
    ["4 語でない段", { groups: [{ id: "a", name: localized("a"), rules: { x: "loose" } }], genres: [] }, /x has the level loose/u],
    ["数の段", { groups: [{ id: "a", name: localized("a"), rules: { x: 3 } }], genres: [] }, /x has the level 3/u],
    ["rules が map でない", { groups: [{ id: "a", name: localized("a"), rules: ["x"] }], genres: [] }, /a: rules must be a map/u],
    [
      "空の profile",
      { groups: [{ id: "a", name: localized("a") }], genres: [{ id: "a/b", name: localized("b"), summary: localized("b"), profile: "" }] },
      /profile/u,
    ],
    [
      "群の無いジャンル",
      { groups: [{ id: "a", name: localized("a") }], genres: [{ id: "ab/c", name: localized("c"), summary: localized("c") }] },
      /ab\/c: no group/u,
    ],
  ];
  broken.forEach(([label, raw, message]) => {
    it(`読めないものは止める: ${label}`, () => assert.throws(() => parseGenres(raw), message));
  });
});

describe("ジャンルの既定の段", () => {
  const data = parseGenres(TOY);

  it("群の段に、ジャンル自身の段を重ねる", () => {
    assert.deepEqual(presetLevelsOf(data, "legal/contract"), { "ngram-repetition": "relaxed", "numbering-gap": "normal" });
    assert.deepEqual(presetLevelsOf(data, "legal/statute"), { "ngram-repetition": "off", "numbering-gap": "normal" });
  });

  it("知らないジャンルや群の名前だけには何も付けない", () => {
    assert.deepEqual(presetLevelsOf(data, "legal"), {});
    assert.deepEqual(presetLevelsOf(data, "legal/other"), {});
    assert.deepEqual(presetLevelsOf(data, "legalese/contract"), {});
    assert.deepEqual(presetLevelsOf(data, ""), {});
  });

  it("群は / までの名前で当てる（legal は legalese の群ではない）", () => {
    const both = parseGenres({
      groups: [
        { id: "legal", name: localized("Legal"), rules: { "ngram-repetition": "off" } },
        { id: "legalese", name: localized("Legalese"), rules: { "heading-echo": "off" } },
      ],
      genres: [{ id: "legalese/memo", name: localized("Memo"), summary: localized("Memos") }],
    });
    assert.deepEqual(presetLevelsOf(both, "legalese/memo"), { "heading-echo": "off" });
  });

  it("profile はそのジャンルが書いたときだけ", () => {
    assert.equal(presetProfileOf(data, "legal/statute"), "statute");
    assert.equal(presetProfileOf(data, "legal/contract"), undefined);
    assert.equal(presetProfileOf(data, "missing"), undefined);
  });
});

describe("同梱の genres.yaml", () => {
  const data: GenreData = loadGenres();
  const rules = { ja: loadRules("ja"), en: loadRules("en") };
  const ids = new Set([...rules.ja, ...rules.en].map((rule) => rule.id));
  const ORIGINAL = [
    "technical/spec",
    "technical/readme",
    "blog/tech",
    "blog/essay",
    "blog/owned-media",
    "business/proposal",
    "business/report",
    "business/email",
    "business/press-release",
    "business/meeting-notes",
  ];

  it("前からあるジャンルは、同じ名前と並びのまま先頭にある", () => assert.deepEqual(GENRES.slice(0, ORIGINAL.length), ORIGINAL));

  // 前からあるジャンルの段は、rule を止めることしかしない（手で止めたものと、測って止めたもの。spec §21.1）。
  it("前からあるジャンルは profile を持たず、段は rule を止めることだけ", () => {
    ORIGINAL.forEach((genre) => {
      const levels = Object.entries(presetLevels(genre));
      assert.deepEqual(
        levels.filter(([, level]) => level !== "off"),
        [],
        genre,
      );
      assert.equal(presetProfileOf(data, genre), undefined, genre);
    });
  });

  it("書いた rule はどれも実在する", () => {
    const named = [...data.groups, ...data.genres].flatMap((entry) => Object.keys(entry.rules).map((rule) => `${entry.id}: ${rule}`));
    assert.deepEqual(
      named.filter((entry) => !ids.has(entry.split(": ")[1] ?? "")),
      [],
    );
  });

  const outsideUseFor = (genre: string): string[] => {
    const all = [...rules.en, ...rules.ja];
    return Object.keys(presetLevels(genre))
      .map((id) => all.find((entry) => entry.id === id))
      .filter((rule) => rule !== undefined && !rule.use_for.some((target) => genre.startsWith(target)))
      .map((rule) => `${genre}: ${rule?.id ?? ""}`);
  };

  it("既定の段で止めた rule は、そのジャンルの use_for に入っている（入っていなければ止めたと言えず、一覧からも消える）", () => {
    assert.deepEqual(GENRES.flatMap(outsideUseFor), []);
  });

  it("手で段を書いた群には、意味を読む検査を除くどの rule も当たる（止めるなら段で止め、一覧に出す）", () => {
    // 測って止めた行（# measured）は、use_for の決めごととは別のもの。
    const handWritten = parseGenres(parse(withMeasuredOffs(readFileSync(new URL("../packages/chaff/genres.yaml", import.meta.url), "utf8"), [])));
    const presetGroups = handWritten.groups.filter((group) => Object.keys(group.rules).length > 0).map((group) => group.id);
    const missing = rules.en
      .filter((rule) => rule.layer !== "L4")
      .flatMap((rule) => presetGroups.filter((group) => !rule.use_for.includes(group)).map((group) => `${rule.id}: ${group}`));
    assert.deepEqual(missing, []);
  });

  it("書いた profile はどれも実在する", () => {
    const known = new Set(loadProfiles().map((profile) => profile.id));
    data.genres.forEach((genre) => assert.ok(genre.profile === undefined || known.has(genre.profile), genre.id));
  });

  it("ジャンルの名前は重ならない", () => assert.equal(new Set(GENRES).size, GENRES.length));

  it("法令のジャンルは法令の profile で読む", () => assert.equal(presetProfileOf(data, "legal/statute"), "statute"));
});

const JA_REPORT = "# 報告\n\n今月の件数は 412 件でした。前月の 356 件から増えました。\n";

type Settings = Readonly<Record<string, "strict" | "normal" | "relaxed" | "off">>;

const runJa = (source: string, genre: string, settings: Settings, experimental: boolean): RunResult =>
  runRules(buildDocument("t.md", source, ja), loadRules("ja"), settings, experimental, genre);

/** The structure rules legal/contract and legal/statute name at normal. */
const STRUCTURE_PRESET = [
  "dangling-figure-reference",
  "dangling-reference",
  "date-range-reversed",
  "date-weekday-mismatch",
  "defined-name-repeated",
  "defined-term-form",
  "duplicate-definition",
  "numbering-gap",
  "total-mismatch",
];

/** As runJa, with the structure rules and latin-spacing marked experimental: how a genre's preset treats an experimental rule. */
const runJaExperimental = (source: string, genre: string, settings: Settings): RunResult =>
  runRules(buildDocument("t.md", source, ja), asExperimental(loadRules("ja"), [...STRUCTURE_PRESET, "latin-spacing"]), settings, false, genre);

const why = (result: RunResult, rule: string): string | undefined => result.skipped.find((entry) => entry.rule === rule)?.why;

const LONG = `# 章\n\n${"とても長い文を書き続けています、".repeat(20)}。\n`;

describe("既定の段で動かす", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("ジャンルが止めた rule は、ジャンルを理由に動いていない一覧に出る", () => {
    const result = runJa(LONG, "literature/fiction", {}, false);
    assert.equal(why(result, "max-sentence-length"), REASONS.ja.presetOff("literature/fiction"));
    assert.ok(!result.findings.some((finding) => finding.rule === "max-sentence-length"));
  });

  it("群の段は群の中のどのジャンルにも効く", () => {
    ["literature/essay", "literature/poetry", "literature/play"].forEach((genre) => {
      assert.equal(why(runJa(LONG, genre, {}, false), "max-sentence-length"), REASONS.ja.presetOff(genre), genre);
    });
  });

  it("chaff.yaml の段はジャンルの段に勝つ", () => {
    const result = runJa(LONG, "literature/fiction", { "max-sentence-length": "strict" }, false);
    assert.equal(why(result, "max-sentence-length"), undefined);
    assert.ok(result.findings.some((finding) => finding.rule === "max-sentence-length"));
  });

  it("chaff.yaml で止めたものは、設定を理由に出る", () => {
    const result = runJa(JA_REPORT, "legal/contract", { "numbering-gap": "off" }, false);
    assert.equal(why(result, "numbering-gap"), REASONS.ja.turnedOff);
  });

  it("--experimental でも、ジャンルが止めたものは止めたまま", () => {
    const result = runJa(JA_REPORT, "literature/fiction", {}, true);
    assert.equal(why(result, "doubled-word"), REASONS.ja.presetOff("literature/fiction"));
  });

  it("ジャンルが試験中の rule を入れたら動かし、設定で入れたものとは別に知らせる", () => {
    const result = runJaExperimental(JA_REPORT, "legal/contract", { "latin-spacing": "normal" });
    assert.equal(why(result, "numbering-gap"), undefined);
    assert.deepEqual(
      result.presetExperimental.toSorted((left, right) => left.localeCompare(right)),
      STRUCTURE_PRESET,
    );
    assert.deepEqual(result.forcedExperimental, ["latin-spacing"]);
  });

  it("chaff.yaml で名指ししたものは、ジャンルが入れたものとして数えない", () => {
    const result = runJaExperimental(JA_REPORT, "legal/contract", { "numbering-gap": "strict" });
    assert.ok(!result.presetExperimental.includes("numbering-gap"));
    assert.deepEqual(result.forcedExperimental, ["numbering-gap"]);
  });

  it("品詞を使う rule がジャンルと設定ですべて止まれば、品詞解析を読み込まない", () => {
    const literature = presetLevels("literature/fiction");
    const posStillOn = loadRules("ja").filter((rule) => wantsTags(rule) && literature[rule.id] !== "off" && rule.id !== "taigen-dome-in-prose");
    const rest: Settings = Object.fromEntries(posStillOn.map((rule) => [rule.id, "off"]));
    assert.equal(neededBy(loadRules("ja"), rest, false, "literature/fiction", "ja").pos, false);
    assert.equal(neededBy(loadRules("ja"), {}, false, "blog/tech", "ja").pos, true);
    assert.equal(neededBy(loadRules("ja"), { ...rest, "taigen-dome-in-prose": "normal" }, false, "literature/fiction", "ja").pos, true);
  });

  it("ジャンルが入れていない試験中の rule は、試験中を理由に止まる", () => {
    const result = runJaExperimental(JA_REPORT, "business/report", {});
    assert.equal(why(result, "numbering-gap"), REASONS.ja.experimental);
    assert.deepEqual(result.presetExperimental, []);
  });

  it("法令・規程のジャンルは、契約書と同じ構造の rule を入れる", () => {
    assert.deepEqual(
      runJaExperimental(JA_REPORT, "legal/statute", {}).presetExperimental.toSorted((left, right) => left.localeCompare(right)),
      STRUCTURE_PRESET,
    );
  });

  it("法令・規程のジャンルは、条の抜けと無い条への参照を既定で見つける", () => {
    const source = [
      "# 備品管理規程",
      "## 第1条（目的）",
      "この規程は、会社の備品の貸出と返却の手続きを定める。",
      "## 第2条（貸出）",
      "社員は、第9条に定める台帳に記入して、備品を借りることができる。",
      "## 第4条（返却）",
      "借りた備品は、借りた日から7日以内に返さなければならない。",
      "",
    ].join("\n");
    const document = buildDocument("kitei.md", source, ja, undefined, profileFor(EMPTY, "kitei.md", source, "ja", "legal/statute"));
    const found = runRules(document, loadRules("ja"), {}, false, "legal/statute").findings.map((finding) => `${String(finding.line)} ${finding.rule}`);
    assert.deepEqual(found, ["5 dangling-reference", "6 numbering-gap"]);
  });

  it("契約書のジャンルは、無い条項への参照を既定で見つける", () => {
    const path = new URL("./fixtures/structure/en/contract.txt", import.meta.url);
    const source = readFileSync(path, "utf8");
    const result = runRules(buildDocument("contract.txt", source, en), loadRules("en"), {}, false, "legal/contract");
    assert.ok(result.findings.some((finding) => finding.rule === "dangling-reference"));
    // While the rule was experimental, the contract genre was what turned it on.
    const experimental = asExperimental(loadRules("en"), ["dangling-reference"]);
    const asContract = runRules(buildDocument("contract.txt", source, en), experimental, {}, false, "legal/contract");
    assert.ok(asContract.findings.some((finding) => finding.rule === "dangling-reference"));
    const asReport = runRules(buildDocument("contract.txt", source, en), experimental, {}, false, "business/report");
    assert.ok(!asReport.findings.some((finding) => finding.rule === "dangling-reference"));
  });
});

describe("ジャンル別の上限", () => {
  const sentence = (language: "ja" | "en"): RuleDefinition => {
    const rule = loadRules(language).find((entry) => entry.id === "max-sentence-length");
    if (rule === undefined) throw new Error("no max-sentence-length");
    return rule;
  };

  it("法務の文は長さの上限が広く、法令と判決はさらに広い", () => {
    const [jaRule, enRule] = [sentence("ja"), sentence("en")];
    const normal = (rule: RuleDefinition, genre: string): number => resolve(rule, "normal", genre).limit;
    assert.ok(normal(jaRule, "legal/contract") > normal(jaRule, "blog/tech"));
    assert.ok(normal(jaRule, "legal/statute") > normal(jaRule, "legal/contract"));
    assert.ok(normal(jaRule, "legal/judgment") > normal(jaRule, "legal/contract"));
    assert.ok(normal(enRule, "legal/contract") > normal(enRule, "blog/tech"));
    // 判決の英語は群の数字に落ちる。
    assert.equal(normal(enRule, "legal/judgment"), normal(enRule, "legal/contract"));
    assert.ok(normal(enRule, "academic/paper") > normal(enRule, "blog/tech"));
  });
});

describe("ジャンルの profile", () => {
  const definitions = loadProfiles();
  const request = { byPath: undefined, config: undefined, source: "", language: "ja" };

  it("ジャンルが profile を持てば、内容に形が無くてもそれで読む", () => {
    assert.equal(chooseProfile(definitions, { ...request, genre: "statute" })?.from, "genre");
    assert.equal(profileFor(EMPTY, "a.md", "第一条　この法律は、…。", "ja", "legal/statute")?.id, "statute");
    assert.equal(profileFor(EMPTY, "a.md", "第一条　この法律は、…。", "ja", "business/report"), undefined);
  });

  it("chaff.yaml と by_path はジャンルに勝ち、none は止める", () => {
    assert.equal(chooseProfile(definitions, { ...request, config: "none", genre: "statute" }), undefined);
    assert.equal(chooseProfile(definitions, { ...request, byPath: "none", genre: "statute" }), undefined);
    assert.equal(chooseProfile(definitions, { ...request, config: "statute", genre: "missing" })?.from, "config");
  });

  it("ジャンルの profile にその言語が無ければ選ばない（内容からも選ばない）", () => {
    assert.equal(chooseProfile(definitions, { ...request, language: "en", genre: "statute" }), undefined);
  });
});

describe("chaff genres", () => {
  const data = loadGenres();

  (["ja", "en"] as const).forEach((ui) => {
    it(`${ui}: すべてのジャンルを、群の名前の下に、その言語の説明と並べる`, () => {
      const text = renderGenres(data, ui);
      data.genres.forEach((genre) => assert.ok(text.includes(`${genre.id}`) && text.includes(genre.summary[ui] ?? "missing"), genre.id));
      data.groups.forEach((group) => assert.ok(text.includes(`  ${group.name[ui] ?? "missing"}\n`), group.id));
      assert.ok(text.includes("--genre legal/contract"));
      assert.ok(text.includes("init --genre"));
    });
  });

  it("ジャンルの無い群は出さない", () => {
    const text = renderGenres(parseGenres({ ...TOY, groups: [...TOY.groups, { id: "empty", name: localized("Nothing here") }] }), "en");
    assert.ok(!text.includes("Nothing here"));
  });
});

describe("rules --json のいまの段", () => {
  const rules = loadRules("en");
  const nowOf = (genre: string, config = EMPTY): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(rulesJson(rules, config, "en", genre));
    if (typeof parsed !== "object" || parsed === null || !("rules" in parsed) || !Array.isArray(parsed.rules)) throw new Error("no rules");
    const entry: unknown = parsed.rules.find(
      (candidate: unknown) => typeof candidate === "object" && candidate !== null && "id" in candidate && candidate.id === "ngram-repetition",
    );
    if (typeof entry !== "object" || entry === null || !("now" in entry) || typeof entry.now !== "object" || entry.now === null) throw new Error("no now");
    return { ...entry.now };
  };

  it("ジャンルが止めた rule は、ジャンルを理由に off", () =>
    assert.deepEqual(nowOf("legal/contract"), { level: "off", why_off: "the legal/contract genre does not check it" }));
  it("前からあるジャンルは変わらない", () => assert.equal(nowOf("blog/tech")["level"], "normal"));
  it("chaff.yaml の段が勝つ", () => assert.equal(nowOf("legal/contract", { ...EMPTY, rules: { "ngram-repetition": "strict" } })["level"], "strict"));
});

// 用語集は、用語を引いてその項だけを読む。定義は名詞で終わるのが普通の形で、並んだ項が同じ型の説明を持つのは揃えた結果。
describe("用語集のジャンル", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  const runEn = (source: string, genre: string, settings: Settings = {}): RunResult =>
    runRules(buildDocument("t.md", source, en), loadRules("en"), settings, false, genre);
  const flagged = (result: RunResult, rule: string): boolean => result.findings.some((finding) => finding.rule === rule);

  const JA_GLOSSARY = [
    "# 天気の用語",
    "",
    ...[
      ["晴れ", "雲が空の一部だけを覆っている空の様子。"],
      ["曇り", "雲が空のほとんどを覆っている空の様子。"],
      ["霧雨", "とても細かい雨粒が、ゆっくり落ちてくる雨。"],
      ["にわか雨", "急に降り出して、すぐにやむ雨。"],
      ["雷雨", "雷を伴って降る強い雨。"],
      ["小春日和", "晩秋から初冬にかけての、穏やかで暖かい晴れの日。"],
    ].flatMap(([term, definition]) => [term ?? "", "", definition ?? "", ""]),
  ].join("\n");

  it("名詞で終わる定義は、用語集では数えない（ほかの説明書では数える）", () => {
    assert.equal(why(runJa(JA_GLOSSARY, "docs/glossary", {}, false), "taigen-dome-in-prose"), REASONS.ja.presetOff("docs/glossary"));
    assert.ok(flagged(runJa(JA_GLOSSARY, "docs/manual", {}, false), "taigen-dome-in-prose"));
  });

  const template = (input: string): string => `Share of output growth that comes from the change in the use of ${input} over the year.`;
  const EN_GLOSSARY = [
    "# Glossary",
    "",
    ...["buildings", "machinery", "vehicles", "software", "land", "research", "energy", "materials"].flatMap((input) => [
      `- Contribution of ${input}`,
      "",
      `${template(input)} It is measured for each industry and reported as a share of the total, so that the parts add up to the whole.`,
      "",
    ]),
  ].join("\n");

  it("並んだ項が同じ型の定義を持っても、用語集では言い回しの繰り返しとして数えない（ほかの説明書では数える）", () => {
    assert.equal(why(runEn(EN_GLOSSARY, "docs/glossary"), "ngram-repetition"), REASONS.en.presetOff("docs/glossary"));
    assert.ok(flagged(runEn(EN_GLOSSARY, "docs/manual"), "ngram-repetition"));
  });

  const FILLER = ["payment", "made", "to", "a", "worker", "for", "time", "spent"];
  const definitionOf = (wordCount: number): string =>
    `# Glossary\n\n- Pay\n\n${Array.from({ length: wordCount - 1 }, (_, index) => FILLER[index % FILLER.length]).join(" ")} working.\n`;

  it("英語の定義の一文は、ほかの説明書より長くてよい。それでも長すぎる一文は指す", () => {
    const named: Settings = { "max-sentence-length": "normal" };
    assert.ok(!flagged(runEn(definitionOf(35), "docs/glossary", named), "max-sentence-length"));
    assert.ok(flagged(runEn(definitionOf(35), "docs/manual", named), "max-sentence-length"));
    assert.ok(flagged(runEn(definitionOf(45), "docs/glossary", named), "max-sentence-length"));
  });

  it("日本語の用語集の文の長さは、説明書と同じ上限（測って変える理由が無かった）", () => {
    const rule = loadRules("ja").find((entry) => entry.id === "max-sentence-length");
    if (rule === undefined) throw new Error("no max-sentence-length");
    (["strict", "normal", "relaxed"] as const).forEach((level) =>
      assert.equal(resolve(rule, level, "docs/glossary").limit, resolve(rule, level, "docs/manual").limit, level),
    );
  });
});

describe("議事録とプレスリリースの段（corpus の実文書から）", () => {
  const MINUTES = "# Minutes\n\nThe budget was approved. The plan was reviewed. The date was moved.\n";
  const NAMES = "Alice and Bob from Contoso met Carol from Fabrikam in Seattle, then Dave from Northwind joined Erin at Tailspin.";
  const RELEASE = `# Release\n\n${Array.from({ length: 12 }, () => NAMES).join(" ")}\n`;

  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("議事録は agentless-passive を見ない。報告書では見る。chaff.yaml で入れれば議事録でも見る", () => {
    assert.ok(!firedRules(en, MINUTES, "business/meeting-notes").includes("agentless-passive"));
    assert.ok(firedRules(en, MINUTES, "business/report").includes("agentless-passive"));
    assert.ok(namedRuleRun("agentless-passive", MINUTES, en, "a.md", "business/meeting-notes").findings.length > 0);
  });

  it("プレスリリースは proper-noun-density を見ない。報告書では見る。chaff.yaml で入れればリリースでも見る", () => {
    assert.ok(!firedRules(en, RELEASE, "business/press-release").includes("proper-noun-density"));
    assert.ok(firedRules(en, RELEASE, "business/report").includes("proper-noun-density"));
    assert.ok(namedRuleRun("proper-noun-density", RELEASE, en, "a.md", "business/press-release").findings.length > 0);
  });
});
