import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import {
  cuedNamesIn,
  isCharacterPair,
  isNearWord,
  mentionsIn,
  nameKey,
  nameVariants,
  suffixedNamesIn,
  type NameEvidence,
  type NameMention,
} from "../packages/chaff/src/name-variants.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { spacedPersonNamesIn } from "../packages/chaff/src/spaced-person-name.ts";

// 同じ名前の書き分け（name-variant）。例文はすべて自作。

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const mention = (surface: string, offset: number, reading?: string, words: readonly string[] = surface.split(" ")): NameMention => ({
  surface,
  offset,
  reading,
  words,
});

describe("name-variant: 同じ名前の書き分け", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("a brand written with other capitals", () => {
    assert.deepEqual(variants("The code lives on GitHub. Reviews happen on GitHub, and releases are tagged on Github.\n"), [
      '"Github" is written "GitHub" elsewhere in the document (case, width or punctuation)',
    ]);
  });

  it("a name with a letter dropped, when the usual form appears twice", () => {
    assert.deepEqual(variants("Microsoft builds the tool. Microsoft sells it. Microsft ships it.\n"), [
      '"Microsft" is one letter away from "Microsoft", which the document uses more than once',
    ]);
  });

  it("consistent names, and different short names, are not reported", () => {
    assert.deepEqual(variants("Microsoft builds the tool. Microsoft sells it to Contoso.\n"), []);
    assert.deepEqual(variants("Iran and Iraq signed. Iran and Iraq met again.\n"), []);
  });

  it("a plural or a label is not a misspelt name", () => {
    assert.deepEqual(variants("Send it to the Service. The Service replies. Other Services wait.\n"), []);
    assert.deepEqual(variants("See Appendix B. Appendix B lists fees. Appendix C lists dates.\n"), []);
  });

  it("人の名前を、字体の違う同じ字で書き分ける（斎藤様 と 斉藤様）", () => {
    assert.deepEqual(
      variants("斎藤様\n\nいつもお世話になっております。斉藤様と松本様にお目にかかれるのを楽しみにしております。斎藤様には、よろしくお願いいたします。\n", ja),
      ["「斉藤」は、ほかの所では字体の違う同じ字で「斎藤」と書いています"],
    );
  });

  it("読みが同じ一語の人の名前が一字違い。多いほうが二度以上、少ないほうが一度だけ", () => {
    assert.deepEqual(variants("出席者は高橋、松本、斎藤。\n\n松元は文言案を出す。斎藤は写真を松本へ渡す。\n", ja), [
      "「松元」は、ほかの所では同じ読みの「松本」と書いています",
    ]);
  });

  it("解析器が名前と読めない字体の字（髙）は、敬称の前の漢字を名前と読む", () => {
    assert.deepEqual(variants("高橋様\n\n高橋様から回答をいただきました。髙橋様からも回答をいただきました。\n", ja), [
      "「髙橋」は、ほかの所では字体の違う同じ字で「高橋」と書いています",
    ]);
  });

  it("敬称の前の漢字が名前より長い（株式会社髙橋様）か、字体の字を含まないなら、名前と読まない", () => {
    const chars = new Map([
      ["高", "高"],
      ["髙", "高"],
    ]);
    const names = (source: string): string[] => suffixedNamesIn(source, ["様"], chars, []).map((found) => `${found.surface}@${String(found.offset)}`);
    assert.deepEqual(names("髙橋様と𠮷髙様"), ["髙橋@0", "𠮷髙@4"]);
    assert.deepEqual(names("株式会社髙橋様"), []);
    assert.deepEqual(names("鈴木様と髙様"), []);
    assert.deepEqual(suffixedNamesIn("髙橋様", ["様"], chars, [{ ...mention("髙橋", 0), person: true }]), []);
  });

  it("敬称の無い名前も、片方に「担当の」などが付き、もう片方が名前の来る場所にあれば言う", () => {
    assert.deepEqual(variants("担当の斎藤です。費用は25万円です。斉藤まで連絡ください。\n", ja), [
      "「斉藤」は、ほかの所では字体の違う同じ字で「斎藤」と書いています",
    ]);
    assert.deepEqual(variants("担当の髙橋です。資料の件は高橋までご連絡ください。\n", ja), [
      "「高橋」は、ほかの所では字体の違う同じ字で「髙橋」と書いています",
    ]);
    assert.deepEqual(variants("斎藤様\n\nご不明な点は、斉藤までお尋ねください。\n", ja), ["「斉藤」は、ほかの所では字体の違う同じ字で「斎藤」と書いています"]);
  });

  it("地名やふつうの語は、敬称の無い名前と読まない（鹿島 と 鹿嶋、沢山 と 澤山）", () => {
    assert.deepEqual(variants("鹿島から鹿嶋まで車で行きます。\n", ja), []);
    assert.deepEqual(variants("担当の鹿島です。明日は鹿嶋まで伺います。鹿嶋へ参ります。\n", ja), []);
    assert.deepEqual(variants("担当の澤山です。資料は沢山あります。沢山の資料を送ります。\n", ja), []);
    assert.deepEqual(variants("鹿嶋市の鹿島神宮へ参ります。担当の鹿嶋です。\n", ja), []);
    assert.deepEqual(variants("高い山と髙い山。高橋さんは来ます。\n", ja), []);
  });

  it("名前を一つの書き方でだけ書いた文書は言わない", () => {
    assert.deepEqual(variants("斎藤様\n\n斎藤様と松本様に、よろしくお伝えください。\n", ja), []);
  });

  it("名前の読みが同じで、一語だけ字が違う", () => {
    assert.deepEqual(variants("担当は山田太郎です。見積もりは山田太郎が作り、請求書は山田太朗が送ります。\n", ja), [
      "「山田太朗」は、ほかの所では同じ読みの「山田太郎」と書いています",
    ]);
  });

  it("解析器が読めない名前の字（汰）は、語彙表の読みで読む", () => {
    const letter = "患者氏名：中村 健太 様\n\n中村 健太 様の結果をお知らせします。\n\n中村 健汰 様の次回の予約は、受付でお取りください。\n";
    assert.deepEqual(variants(letter, ja), ["「中村 健汰」は、ほかの所では同じ読みの「中村 健太」と書いています"]);
    assert.deepEqual(variants("中村健太様の結果です。中村健太様にお送りします。中村健汰様の予約です。\n", ja), [
      "「中村健汰」は、ほかの所では同じ読みの「中村健太」と書いています",
    ]);
  });

  it("読みの違う名、同じ姓の別の人、一度ずつの名は言わない", () => {
    assert.deepEqual(variants("佐藤 美咲 様\n\n佐藤 美咲 様の結果です。佐藤 美沙 様の予約です。\n", ja), []);
    assert.deepEqual(variants("中村 健太 様と中村 健太 様の兄、中村 莉子 様の結果です。\n", ja), []);
    assert.deepEqual(variants("中村 健太 様の結果です。中村 健汰 様の予約です。\n", ja), []);
  });

  it("表の升の名前も、語彙表の読みで読む", () => {
    const table = "中村 健太 様の結果です。中村 健太 様にお送りします。\n\n| 氏名 | 区分 |\n| --- | --- |\n| 中村 健汰 | 予約 |\n";
    assert.deepEqual(variants(table, ja), ["「中村 健汰」は、ほかの所では同じ読みの「中村 健太」と書いています"]);
  });

  it("解析器が地名と読む名（千尋）も、空白を挟んだ敬称があれば姓と合わせて人の名前と読む", () => {
    const usual = "「森下 千裕」は、ほかの所では同じ読みの「森下 千尋」と書いています";
    const table = "ご宿泊者：森下 千尋 様\n\n| 項目 | 内容 |\n| --- | --- |\n| ご代表者 | 森下 千尋 様 |\n\n森下 千裕 様のお越しをお待ちしております。\n";
    assert.deepEqual(variants(table, ja), [usual]);
    const wide = (text: string): string => text.replaceAll(" ", "　");
    assert.deepEqual(variants(wide("ご宿泊者：森下 千尋 様\n\n森下 千裕 様のお越しです。\n"), ja), [usual]);
  });

  it("読みの違う名（千尋 と 千里）、姓の違う二人、姓の無い一度ずつの名は言わない", () => {
    assert.deepEqual(variants("ご宿泊者：森下 千尋 様\n\n森下 千尋 様のご予約です。\n\n森下 千里 様のお越しです。\n", ja), []);
    assert.deepEqual(variants("ご宿泊者：森下 千尋 様\n\n森下 千尋 様のご予約です。\n\n大西 千裕 様のお越しです。\n", ja), []);
    assert.deepEqual(variants("千尋 様のご予約です。千裕 様のお越しです。\n", ja), []);
  });
  it("人を書く欄（氏名：）の名前も、その名前の現れに数える。正しく書いた所を指さない", () => {
    const certificate = "氏名：小野 大輔\n\n小野 大介 さんは、本校の課程を修了しました。\n\n証明書の追加は、小野 大輔 さんご本人がお申し込みください。\n";
    assert.deepEqual(variants(certificate, ja), ["「小野 大介」は、ほかの所では同じ読みの「小野 大輔」と書いています"]);
  });

  it("役割の欄（承認者：、承認：）と肩書き（部長）の付く、空白を挟んだ姓と名を人の名前と読む", () => {
    const claim = "承認者：経理部長 高瀬 誠\n\n交通費は、高瀬 誠部長の承認の後に支給します。\n\n承認：髙瀬 誠（2026年4月1日）\n";
    assert.deepEqual(variants(claim, ja), ["「髙瀬 誠」は、ほかの所では字体の違う同じ字で「高瀬 誠」と書いています"]);
  });

  it("解析器が名を二語に切り（未 咲）、姓を所によって別に読んでも（サイキ、サエキ）、名前まるごとの読みで比べる", () => {
    const certificate = "氏名：佐伯 美咲\n\n佐伯 未咲 さんの成績を証明します。\n\nお問い合わせの際は、佐伯 美咲 さんご本人の同意書を添えてください。\n";
    assert.deepEqual(variants(certificate, ja), ["「佐伯 未咲」は、ほかの所では同じ読みの「佐伯 美咲」と書いています"]);
  });

  it("欄に書いた、読みの違う別の人の名前は言わない", () => {
    assert.deepEqual(variants("申請者：佐伯 拓海\n\n承認者：佐伯 拓也\n\n佐伯 拓海 さんの申請を承認します。\n", ja), []);
    assert.deepEqual(variants("承認者：経理部長 高瀬 誠\n\n高瀬 誠部長が承認します。\n", ja), []);
  });
});

describe("spacedPersonNamesIn: 空白を挟んだ姓と名", () => {
  const cues = { suffixes: ["様", "さん"], titles: ["部長"], labels: ["氏名", "承認者", "承認"] };
  const names = (source: string): string[] =>
    spacedPersonNamesIn(source, cues).map(({ surname, given }) => `${source.slice(surname.start, surname.end)}|${source.slice(given.start, given.end)}`);

  it("敬称か肩書きが付くか、人を書く欄の行の終わりにある", () => {
    assert.deepEqual(names("藤井 健太 様の口座"), ["藤井|健太"]);
    assert.deepEqual(names("藤井 健太様名義"), ["藤井|健太"]);
    assert.deepEqual(names("高瀬 誠部長の承認"), ["高瀬|誠"]);
    assert.deepEqual(names("承認者：経理部長 高瀬 誠"), ["高瀬|誠"]);
    assert.deepEqual(names("- 氏名：森川 大輔\n"), ["森川|大輔"]);
    assert.deepEqual(names("承認：髙瀬 誠（2026年4月1日）"), ["髙瀬|誠"]);
    assert.deepEqual(names("𠮷田 一郎 様"), ["𠮷田|一郎"]);
    assert.deepEqual(names("承認：佐藤 太郎（代理）と田中 一郎"), ["田中|一郎"]);
  });

  it("欄でない行、行の途中、長い漢字の連なり、肩書きの後ろは名前と読まない", () => {
    assert.deepEqual(names("期間：令和 六年"), []);
    assert.deepEqual(names("承認者：高瀬 誠、田中 一郎"), []);
    assert.deepEqual(names("氏名：高瀬 誠 の欄"), []);
    assert.deepEqual(names("株式会社高瀬 誠様"), []);
    assert.deepEqual(names("部長 高瀬様"), []);
    assert.deepEqual(names("第1条 目的"), []);
    assert.deepEqual(names("高瀬 誠部品"), []);
    assert.deepEqual(names(""), []);
  });
});

describe("the reading behind name-variant", () => {
  it("nameKey ignores width, case, spaces and marks", () => {
    assert.equal(nameKey("ＡＷＳ"), nameKey("AWS"));
    assert.equal(nameKey("Mac OS"), nameKey("macOS"));
    assert.equal(nameKey("ダイアン・津田"), nameKey("ダイアン津田"));
    assert.notEqual(nameKey("Acme"), nameKey("Acne"));
  });

  it("isNearWord: one replacement, a swap, or a letter dropped inside the word", () => {
    assert.equal(isNearWord("microsoft", "microsft"), true);
    assert.equal(isNearWord("microsoft", "microsfot"), true);
    assert.equal(isNearWord("walker", "waller"), true);
    assert.equal(isNearWord("service", "services"), false);
    assert.equal(isNearWord("state", "xstate"), false);
    assert.equal(isNearWord("iran", "iraq"), false);
    assert.equal(isNearWord("microsoft", "microsoft"), false);
    assert.equal(isNearWord("microsoft", "macrosaft"), false);
  });

  it("the usual form is the more frequent one, then the earlier one", () => {
    const found = nameVariants([mention("Github", 0), mention("GitHub", 10), mention("GitHub", 20)]);
    assert.deepEqual(
      found.map((variant) => `${variant.mention.surface}<${variant.usual}`),
      ["Github<GitHub"],
    );
    const tie = nameVariants([mention("GitHub", 0), mention("Github", 10)]);
    assert.deepEqual(
      tie.map((variant) => variant.mention.surface),
      ["Github"],
    );
  });

  it("names one letter apart need the usual form twice and the other once", () => {
    assert.deepEqual(nameVariants([mention("Walker", 0), mention("Waller", 10)]), []);
    assert.deepEqual(nameVariants([mention("Walker", 0), mention("Walker", 5), mention("Waller", 10), mention("Waller", 15)]), []);
    assert.equal(nameVariants([mention("Walker", 0), mention("Walker", 5), mention("Waller", 10)]).length, 1);
  });

  it("a more frequent unrelated name in the same group does not hide the pair", () => {
    const near = nameVariants([
      mention("Microsoft Foo", 0),
      mention("Microsoft Foo", 5),
      mention("Microsft Foo", 10),
      mention("Alphabet Foo", 15),
      mention("Alphabet Foo", 20),
      mention("Alphabet Foo", 25),
    ]);
    assert.deepEqual(
      near.map((variant) => `${variant.mention.surface}<${variant.usual}`),
      ["Microsft Foo<Microsoft Foo"],
    );
    const reading = (surface: string, offset: number, words: readonly string[]): NameMention => mention(surface, offset, "ヤマダタロウ", words);
    const homophones = nameVariants([
      reading("山田太郎", 0, ["山田", "太郎"]),
      reading("山田太郎", 5, ["山田", "太郎"]),
      reading("山田太朗", 10, ["山田", "太朗"]),
      reading("矢間田多労", 15, ["矢間田", "多労"]),
      reading("矢間田多労", 20, ["矢間田", "多労"]),
      reading("矢間田多労", 25, ["矢間田", "多労"]),
    ]);
    assert.deepEqual(
      homophones.map((variant) => `${variant.mention.surface}<${variant.usual}`),
      ["山田太朗<山田太郎"],
    );
  });

  it("字体の違う同じ字は、人の名前どうしで、語彙表の字の違いだけのとき", () => {
    const chars = new Map([
      ["斎", "斎"],
      ["斉", "斎"],
      ["島", "島"],
      ["嶋", "島"],
    ]);
    const person = (surface: string, offset: number): NameMention => ({ ...mention(surface, offset), person: true });
    const pairOf = (mentions: readonly NameMention[]): string[] =>
      nameVariants(mentions, chars).map((variant) => `${variant.mention.surface}<${variant.usual}`);
    assert.deepEqual(pairOf([person("斎藤", 0), person("斉藤", 5)]), ["斉藤<斎藤"]);
    assert.deepEqual(pairOf([person("斉藤", 0), person("斎藤", 5), person("斎藤", 9)]), ["斉藤<斎藤"]);
    assert.deepEqual(pairOf([mention("鹿島", 0), mention("鹿嶋", 5)]), []);
    assert.deepEqual(pairOf([person("斎藤", 0), person("斉木", 5)]), []);
    assert.deepEqual(nameVariants([person("斎藤", 0), person("斉藤", 5)]), []);
  });

  it("読みが同じ一語の人の名前は、一字違いで、多いほうが二度以上、少ないほうが一度だけのとき", () => {
    const person = (surface: string, offset: number, reading: string, isPerson = true): NameMention => ({
      ...mention(surface, offset, reading, [surface]),
      person: isPerson,
    });
    const pairOf = (mentions: readonly NameMention[]): string[] => nameVariants(mentions).map((variant) => `${variant.mention.surface}<${variant.usual}`);
    assert.deepEqual(pairOf([person("松本", 0, "マツモト"), person("松本", 3, "マツモト"), person("松元", 6, "マツモト")]), ["松元<松本"]);
    assert.deepEqual(pairOf([person("伊藤", 0, "イトウ"), person("伊東", 3, "イトウ")]), []);
    assert.deepEqual(pairOf([person("松本", 0, "マツモト"), person("松本", 3, "マツモト"), person("松元", 6, "マツモト", false)]), []);
    assert.deepEqual(pairOf([person("毅", 0, "ツヨシ"), person("毅", 3, "ツヨシ"), person("剛史", 6, "ツヨシ")]), []);
    assert.deepEqual(pairOf([person("松本子", 0, "マツモト"), person("松本子", 3, "マツモト"), person("松元", 6, "マツモト")]), []);
    assert.deepEqual(pairOf([person("剛史", 0, "ツヨシ"), person("剛史", 3, "ツヨシ"), person("強志", 6, "ツヨシ")]), []);
    assert.deepEqual(pairOf([person("松本", 0, "マツモト", false), person("松本", 3, "マツモト"), person("松元", 6, "マツモト")]), ["松元<松本"]);
  });

  it("人の名前と読むのは、解析器が人名と読む語か、敬称の付いた名前", () => {
    const token = (surface: string, start: number, pos: string, nameType?: string): Token => ({
      surface,
      pos,
      span: { start, end: start + surface.length },
      ...(nameType === undefined ? {} : { features: { NameType: nameType } }),
    });
    const placeThenSuffix = [token("松本", 0, "PROPN", "Geo"), token("様", 2, "NOUN")];
    const personOf = (tokens: readonly Token[], suffixes: readonly string[] = []): (boolean | undefined)[] =>
      mentionsIn(tokens, "松本様", suffixes).map((found) => found.person);
    assert.deepEqual(personOf(placeThenSuffix, ["様"]), [true]);
    assert.deepEqual(personOf(placeThenSuffix), [false]);
    assert.deepEqual(personOf([token("松本", 0, "PROPN", "Sur")]), [true]);
    const spaced = (blank: string): (boolean | undefined)[] =>
      mentionsIn([token("千尋", 0, "PROPN", "Geo"), token(blank, 2, "PUNCT"), token("様", 2 + blank.length, "NOUN")], `千尋${blank}様`, ["様"]).map(
        (found) => found.person,
      );
    assert.deepEqual(spaced(" "), [true]);
    assert.deepEqual(spaced("　"), [true]);
    assert.deepEqual(spaced("\n"), [false]);
    assert.deepEqual(spaced("、"), [false]);
  });

  it("解析器が読めない字の読みは、人の名前と読める現れにだけ足す", () => {
    const readings = new Map([["汰", "タ"]]);
    const read = (surface: string, reading: string | undefined): Token => ({
      surface,
      pos: "PROPN",
      ...(reading === undefined ? {} : { reading }),
      span: { start: 0, end: surface.length },
    });
    const kenta = (nameType: string): Token[] => [
      { ...read("健", "ケン"), features: { NameType: "Giv" } },
      { ...read("汰", undefined), span: { start: 1, end: 2 }, features: { NameType: nameType } },
    ];
    const readingOf = (tokens: readonly Token[], suffixes: readonly string[] = []): (string | undefined)[] =>
      mentionsIn(tokens, "健汰様", suffixes, readings).map((found) => found.reading);
    assert.deepEqual(readingOf(kenta("Com")), ["ケンタ"]);
    const notPerson = [read("健", "ケン"), { ...read("汰", undefined), span: { start: 1, end: 2 } }];
    assert.deepEqual(readingOf(notPerson), [undefined]);
    assert.deepEqual(
      mentionsIn(kenta("Com"), "健汰様", []).map((found) => found.reading),
      [undefined],
    );
  });

  it("字体の違う二つを同じ人と見るのは、どちらも人の名前か、片方に前置きか敬称があり、もう片方が名前の来る場所にあるとき", () => {
    const evidence = (person: boolean, named: boolean, nameLike: boolean): NameEvidence => ({ person, named, nameLike });
    const tagged = evidence(true, false, false);
    const named = evidence(false, true, true);
    const slot = evidence(false, false, true);
    const none = evidence(false, false, false);
    assert.equal(isCharacterPair(tagged, tagged), true);
    assert.equal(isCharacterPair(named, slot), true);
    assert.equal(isCharacterPair(slot, named), true);
    assert.equal(isCharacterPair(named, named), true);
    assert.equal(isCharacterPair(slot, slot), false);
    assert.equal(isCharacterPair(tagged, slot), false);
    assert.equal(isCharacterPair(named, none), false);
    assert.equal(isCharacterPair(none, none), false);
  });

  it("敬称の無い名前の候補は、字体の字を含み、名前の来る場所にあり、ほかの現れと重ならない漢字", () => {
    const chars = new Map([
      ["高", "高"],
      ["髙", "高"],
    ]);
    const cues = { leads: ["担当の"], suffixes: ["様"], particles: ["まで"] };
    const names = (source: string, taken: readonly NameMention[] = []): string[] =>
      cuedNamesIn(source, cues, chars, taken).map((found) => `${found.surface}@${String(found.offset)}:${found.cue ?? ""}`);
    assert.deepEqual(names("担当の髙橋です。髙橋まで。"), ["髙橋@3:person", "髙橋@8:slot"]);
    assert.deepEqual(names("髙橋と申します。鈴木まで。"), []);
    assert.deepEqual(names("髙橋製作所まで"), []);
    assert.deepEqual(names("髙橋まで", [{ ...mention("髙橋", 0), person: true }]), []);
    assert.deepEqual(names(""), []);
  });

  it("a same-reading pair must share all but one word", () => {
    assert.deepEqual(nameVariants([mention("毅", 0, "ツヨシ", ["毅"]), mention("剛", 5, "ツヨシ", ["剛"])]), []);
    assert.equal(nameVariants([mention("山田太郎", 0, "ヤマダタロウ", ["山田", "太郎"]), mention("山田太朗", 9, "ヤマダタロウ", ["山田", "太朗"])]).length, 1);
  });
});
