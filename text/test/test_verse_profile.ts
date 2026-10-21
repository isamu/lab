import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { parseProfile } from "../packages/chaff/src/profile/parse.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { DocumentProfile, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 詩（profiles/verse.yaml）。段落の中の行の終わりで文を切り、句点の無い連を一つの文として読まない。

// 宮沢賢治「春と修羅」序（公共の著作物）。
const PREFACE = [
  "わたくしといふ現象は",
  "仮定された有機交流電燈の",
  "ひとつの青い照明です",
  "（あらゆる透明な幽霊の複合体）",
  "風景やみんなといつしよに",
  "せはしくせはしく明滅しながら",
  "いかにもたしかにともりつづける",
  "因果交流電燈の",
  "ひとつの青い照明です",
  "（ひかりはたもち　その電燈は失はれ）",
].join("\n");

// 中原中也「山羊の歌」（公共の著作物）。読点で終わる行が続く連。
const COMMA_LINES = ["頑なの心は、理解に欠けて、", "なすべきをしらず、ただ利に走り、", "意気銷沈して、怒りやすく、", "人に嫌はれて、自らも悲しい。"].join("\n");

// 八木重吉「貧しき信徒」赤い寝衣（公共の著作物）。主題「桃子は」の述語は連の最後の行。
const RED_NIGHTWEAR = [
  "湯あがりの桃子は赤いねまきを着て",
  "おしゃべりしながら",
  "ふとんのあたりを跳ねまわっていた",
  "まっ赤なからだの上したへ手と足とがとびだして",
  "くるっときりょうのいい顔をのせ",
  "ひょこひょこおどっていたが",
  "もうしずかな障子のそばへねむっている",
].join("\n");

const POETRY = "literature/poetry";

const profileOf = (source: string, adapter: LanguageAdapter, genre: string): DocumentProfile | undefined =>
  profileFor(EMPTY, "poem.md", source, adapter.id, genre);

const sentences = (source: string, profile: DocumentProfile | undefined, path = "poem.md", adapter: LanguageAdapter = ja): string[] =>
  buildDocument(path, source, adapter, undefined, profile).sentences.map((sentence) => sentence.text);

const verse = profileOf(PREFACE, ja, POETRY);

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("the verse profile", () => {
  it("literature/poetry reads Japanese with it, whatever the content", () => {
    assert.equal(verse?.id, "verse");
    assert.equal(verse?.lineBreaksEndSentences, true);
    assert.equal(profileOf("一行だけの詩", ja, POETRY)?.id, "verse");
  });

  it("other genres, and English poetry, do not", () => {
    ["literature/fiction", "literature/play", "literature/essay", "business/report"].forEach((genre) =>
      assert.equal(profileOf(PREFACE, ja, genre), undefined, genre),
    );
    assert.equal(profileOf("Because I could not stop for Death,\nHe kindly stopped for me;", en, POETRY), undefined);
  });

  it("reads line_breaks_end_sentences only when it is true", () => {
    const flag = (value: unknown): unknown => parseProfile({ id: "t", ja: { line_breaks_end_sentences: value } })?.languages["ja"]?.lineBreaksEndSentences;
    assert.equal(flag(true), true);
    [false, "true", 1, null, undefined, {}].forEach((value) => assert.equal(flag(value), undefined, JSON.stringify(value) ?? "undefined"));
  });
});

describe("a stanza under the verse profile", () => {
  it("each line is a sentence", () => {
    assert.deepEqual(sentences(PREFACE, verse), PREFACE.split("\n"));
  });

  it("without the profile the stanza is joined (the control)", () => {
    assert.ok(sentences(PREFACE, undefined).length < PREFACE.split("\n").length);
  });

  it("a line ending in 、 does not run into the next", () => {
    assert.deepEqual(sentences(COMMA_LINES, verse), COMMA_LINES.split("\n"));
  });

  it("a line with 。 inside still splits there", () => {
    assert.deepEqual(sentences("雨が降る。風が吹く\n夜が来る", verse), ["雨が降る。", "風が吹く", "夜が来る"]);
  });

  it("stanzas stay apart, and a one-line paragraph is unchanged", () => {
    assert.deepEqual(sentences("一の行\n二の行\n\n三の行", verse), ["一の行", "二の行", "三の行"]);
    assert.deepEqual(sentences("一行だけ。", verse), ["一行だけ。"]);
  });

  it("CRLF and a plain-text file split the same way", () => {
    assert.deepEqual(sentences("一の行\r\n二の行", verse), ["一の行", "二の行"]);
    assert.deepEqual(sentences("一の行\n二の行", verse, "poem.txt"), ["一の行", "二の行"]);
  });

  it("the sentence positions are the lines' own", () => {
    const doc = buildDocument("poem.md", PREFACE, ja, undefined, verse);
    doc.sentences.forEach((sentence) => assert.equal(doc.source.slice(sentence.span.start, sentence.span.end), sentence.text));
  });
});

describe("verse findings", () => {
  const ruleFindings = (source: string, profile: DocumentProfile | undefined, rule: string): number =>
    runRules(buildDocument("poem.md", source, ja, undefined, profile), loadRules("ja"), { [rule]: "normal" }, true, POETRY).findings.filter(
      (finding) => finding.rule === rule,
    ).length;

  it("a topic is not measured across the lines of a stanza", () => {
    assert.ok(ruleFindings(RED_NIGHTWEAR, undefined, "topic-predicate-distance") > 0);
    assert.equal(ruleFindings(RED_NIGHTWEAR, verse, "topic-predicate-distance"), 0);
  });

  it("commas are not counted across the lines of a stanza", () => {
    assert.ok(ruleFindings(COMMA_LINES, undefined, "max-ten") > 0);
    assert.equal(ruleFindings(COMMA_LINES, verse, "max-ten"), 0);
  });
});
