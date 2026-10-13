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
import { isLabelledIn, isTitledIn, withOrdinaryWords } from "../packages/chaff/src/name-ordinary-word.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { spacedPersonNamesIn } from "../packages/chaff/src/spaced-person-name.ts";
import { isLineBlock, tokensByLine } from "../packages/chaff/src/name-line-block.ts";
import { isInPersonField } from "../packages/chaff/src/person-field.ts";
import { heavierFirst, outweighs, type NameWeight } from "../packages/chaff/src/name-weight.ts";
import { isLookalikeApart, lookalikeSlipsIn } from "../packages/chaff/src/name-lookalike-chars.ts";

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

  it("a given name after to (returned to Helen) is read as a name, not as a verb", () => {
    assert.deepEqual(variants("Customer: Helen Marsh\n\nThe keys were handed to Helen Marsh. The parts were returned to Helen Marhs.\n"), [
      '"Helen Marhs" is one letter away from "Helen Marsh", which the document uses more than once',
    ]);
    assert.deepEqual(variants("The car belongs to Sarah Brennan. Sarah Brennan paid. The receipt went to Sarah Brenann.\n"), [
      '"Sarah Brenann" is one letter away from "Sarah Brennan", which the document uses more than once',
    ]);
  });

  it("a street, a road or an office after to is not compared with a person's name", () => {
    assert.deepEqual(variants("The shop moved to Helen Street. Helen Marsh runs it. Helen Marsh opens it daily.\n"), []);
    assert.deepEqual(variants("Turn left to Marsh Road. Helen Marsh lives on Marsh Road. Send forms to Main Office. Helen Marsh works at Main Office.\n"), []);
    assert.deepEqual(variants("Questions go to Helen Marsh. Helen Marsh answers them. Rent is paid to Helen Mars Ltd.\n"), []);
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

  it("一度ずつ書いた名前は、人を書く欄の形を正しい形と見る（氏名：山下 美咲 と 本文の 山下 未咲）", () => {
    assert.deepEqual(variants("# 勤務表\n\n氏名：山下 美咲\n\nこの勤務表は、山下 未咲 さんの打刻記録をもとに作成しました。\n", ja), [
      "「山下 未咲」は、人の名前を書く欄（氏名：など）では「山下 美咲」と書いています",
    ]);
    assert.deepEqual(variants("# 作業報告書\n\n受託者：西村 亮\n\n本報告書の作業は、すべて西邑 亮が担当しました。\n", ja), [
      "「西邑 亮」は、ほかの所では同じ読みの「西村 亮」と書いています",
    ]);
    assert.deepEqual(variants("# Work report\n\nContractor: Priya Raman\n\nAll work in this report was performed by Priya Rahman.\n"), [
      '"Priya Rahman" is written "Priya Raman" in the field that names the person (Name:, Employee: and the like)',
    ]);
    assert.deepEqual(variants("All work in this report was performed by Priya Rahman.\n\nSigned by: Priya Raman\n"), [
      '"Priya Rahman" is written "Priya Raman" in the field that names the person (Name:, Employee: and the like)',
    ]);
  });

  it("両方が欄にあるか、どちらも欄に無いか、字の遠い二人なら、一度ずつの名前は比べない", () => {
    assert.deepEqual(variants("氏名：山下 美咲\n\n確認者：山下 未咲\n", ja), []);
    assert.deepEqual(variants("山下 美咲 さんが申請し、山下 未咲 さんが確認しました。\n", ja), []);
    assert.deepEqual(variants("氏名：山下 美咲\n\n山下 千咲 さんが確認しました。\n", ja), []);
    assert.deepEqual(variants("Contractor: Priya Raman\n\nSigned by: Priya Rahman\n"), []);
    assert.deepEqual(variants("Priya Raman wrote it. Priya Rahman approved it.\n"), []);
    assert.deepEqual(variants("Employee: Daniel Reyes\n\nThe records of Daniel Reys were used.\n"), []);
    assert.deepEqual(variants("Contractor: Priya Raman\n\nThe work was checked by Priya Ramirez.\n"), []);
  });
});

describe("spacedPersonNamesIn: 空白を挟んだ姓と名", () => {
  const cues = { suffixes: ["様", "さん"], titles: ["部長"], labels: ["氏名", "承認者", "承認", "受託者"] };
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

  it("欄に書いた名と同じ名を空白の後ろに書いたものは、敬称が無くても名前と読む", () => {
    assert.deepEqual(names("受託者：西村 亮\n\n作業は、すべて西邑 亮が担当しました。"), ["西村|亮", "西邑|亮"]);
    assert.deepEqual(names("氏名：森川 大輔\n\n森川 大輔の記録"), ["森川|大輔", "森川|大輔"]);
  });

  it("欄に無い名や、欄の無い文書の、敬称の無い空白は名前と読まない", () => {
    assert.deepEqual(names("作業は、すべて西邑 亮が担当しました。"), []);
    assert.deepEqual(names("受託者：西村 亮\n\n東京 大阪が会場です。"), ["西村|亮"]);
    assert.deepEqual(names("受託者：西村 亮\n\n西邑 亮介が担当しました。"), ["西村|亮"]);
  });
});

describe("name-weight: どちらの書き方を正しい形と見るか", () => {
  const weight = (count: number, labelled = false): NameWeight => ({ count, labelled });

  it("outweighs: 相手が二度以上か、どちらも一度だけで相手だけが欄にある", () => {
    assert.equal(outweighs(weight(2), weight(1)), true);
    assert.equal(outweighs(weight(2), weight(1, true)), true);
    assert.equal(outweighs(weight(1, true), weight(1)), true);
  });

  it("outweighs: 一度ずつで両方が欄にあるか、どちらも無いか、こちらが欄にあるか、こちらが二度以上なら重くない", () => {
    assert.equal(outweighs(weight(1, true), weight(1, true)), false);
    assert.equal(outweighs(weight(1), weight(1)), false);
    assert.equal(outweighs(weight(1), weight(1, true)), false);
    assert.equal(outweighs(weight(3, true), weight(2)), false);
    assert.equal(outweighs(weight(0, true), weight(1)), false);
  });

  it("heavierFirst: 数の多いほう、同数なら欄に書いたほうが先", () => {
    assert.ok(heavierFirst(weight(2), weight(1, true)) < 0);
    assert.ok(heavierFirst(weight(1, true), weight(1)) < 0);
    assert.ok(heavierFirst(weight(1), weight(1, true)) > 0);
    assert.equal(heavierFirst(weight(1), weight(1)), 0);
    assert.equal(heavierFirst(weight(1, true), weight(1, true)), 0);
  });
});

describe("isInPersonField: 人を書く欄の名前", () => {
  const labels = ["氏名", "受託者", "Name", "Employee", "Contractor", "Signed by"];
  const inField = (source: string, name: string): boolean => isInPersonField(source, source.indexOf(name), name.length, labels);

  it("欄の語と「：」の後ろにあり、名前で行が終わる", () => {
    assert.equal(inField("氏名：山下 美咲\n", "山下 美咲"), true);
    assert.equal(inField("患者氏名：山下 美咲", "山下 美咲"), true);
    assert.equal(inField("受託者：西村 亮（2026年10月1日）\n", "西村 亮"), true);
    assert.equal(inField("Contractor: Priya Raman\n", "Priya Raman"), true);
    assert.equal(inField("- **Employee:** Daniel Reyes\n", "Daniel Reyes"), true);
    assert.equal(inField("**Contractor**: Priya Raman (2026-10-01)\r\n", "Priya Raman"), true);
    assert.equal(inField("Name: **Priya Raman**\n", "Priya Raman"), true);
    assert.equal(inField("signed by: Ellen Marsh", "Ellen Marsh"), true);
    assert.equal(inField("Intro.\nName: Ellen Marsh\n", "Ellen Marsh"), true);
    assert.equal(isInPersonField("氏名：中村 健太 様\n", 3, 5, labels, ["様"]), true);
  });

  it("欄でない語、文の中の「：」、名前の後ろに続く文、語の途中で照らした欄の語は欄でない", () => {
    assert.equal(inField("Company name: Ellen Marsh\n", "Ellen Marsh"), false);
    assert.equal(inField("Location: Ellen Marsh\n", "Ellen Marsh"), false);
    assert.equal(inField("Note: the report, by Ellen Marsh\n", "Ellen Marsh"), false);
    assert.equal(inField("Contractor: Priya Raman did the work.\n", "Priya Raman"), false);
    assert.equal(inField("この勤務表は、山下 美咲 さんの記録です。\n", "山下 美咲"), false);
    assert.equal(inField("備考：氏名は山下 美咲\n", "山下 美咲"), false);
    assert.equal(inField("Priya Raman\n", "Priya Raman"), false);
    assert.equal(inField("Contractor: Priya Raman, and Priya Rahman will review.\n", "Priya Raman"), false);
    assert.equal(inField("氏名：森下 千尋 様\n", "千尋 様"), false);
    assert.equal(inField("Name: Dr. Ellen Marsh\n", "Ellen Marsh"), false);
    assert.equal(isInPersonField("氏名：中村 健太 様\n", 3, 5, labels), false);
    assert.equal(isInPersonField("Name: Ellen Marsh", 6, 11, []), false);
    assert.equal(isInPersonField("", 0, 0, labels), false);
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

  it("two ordinary words one letter apart (Course and Curse) are two words, not one name written two ways", () => {
    const ordinary = (surface: string, offset: number): NameMention => ({ ...mention(surface, offset), ordinary: true });
    assert.deepEqual(nameVariants([ordinary("Course", 0), ordinary("Course", 10), ordinary("Curse", 20)]), []);
    assert.equal(nameVariants([ordinary("Marsh", 0), ordinary("Marsh", 10), mention("Marhs", 20)]).length, 1);
    assert.equal(nameVariants([mention("Okafor", 0), mention("Okafor", 10), ordinary("Okafur", 20)]).length, 1);
    assert.equal(nameVariants([mention("Marsh", 0), ordinary("Marsh", 10), ordinary("March", 20)]).length, 1);
  });

  it("isTitledIn: a word the document writes after a title is used as a person's name", () => {
    const titles = ["Mr.", "Ms.", "Dr", "Senator"];
    assert.equal(isTitledIn("Then Mr. Marsh signed.", titles, "Marsh"), true);
    assert.equal(isTitledIn("Ask Senator\nMarsh.", titles, "Marsh"), true);
    assert.equal(isTitledIn("Dr Marsh left.", titles, "Marsh"), true);
    assert.equal(isTitledIn("The marsh flooded. Mr. Marshall came.", titles, "Marsh"), false);
    assert.equal(isTitledIn("Mr. Green left. Marsh stayed.", titles, "Marsh"), false);
    assert.equal(isTitledIn("DMr. Marsh", ["Mr."], "Marsh"), false);
    assert.equal(isTitledIn("Mr. Marsh", [], "Marsh"), false);
    assert.equal(isTitledIn("", titles, "Marsh"), false);
  });

  it("isLabelledIn: a word the document writes as the surname after a person label is used as a person's name", () => {
    const labels = ["Name", "Customer", "Client", "Patient name", "Signed by"];
    assert.equal(isLabelledIn("Customer: Ellen Marsh\n", labels, "Marsh"), true);
    assert.equal(isLabelledIn("Intro.\nclient: Marsh", labels, "Marsh"), true);
    assert.equal(isLabelledIn("- **Patient name:** Tom Green\n", labels, "Green"), true);
    assert.equal(isLabelledIn("Signed by: Ellen J. Marsh, Director\n", labels, "Marsh"), true);
    assert.equal(isLabelledIn("Client: Marsh.\n", labels, "Marsh"), true);
    assert.equal(isLabelledIn("Customer：Ellen Marsh (2026-10-01)\r\n", labels, "Marsh"), true);
    assert.equal(isLabelledIn("Customer: Ellen Marsh\n", labels, "Ellen"), false);
    assert.equal(isLabelledIn("Name: Green Valley Farm\n", labels, "Green"), false);
    assert.equal(isLabelledIn("Company name: Ellen Marsh\n", labels, "Marsh"), false);
    assert.equal(isLabelledIn("Location: Marsh\n", labels, "Marsh"), false);
    assert.equal(isLabelledIn("The customer: Marsh\n", labels, "Marsh"), false);
    assert.equal(isLabelledIn("Customer: the Marsh account\n", labels, "Marsh"), false);
    assert.equal(isLabelledIn("Customer: Ellen Marsh pays the rent on time.\n", labels, "Marsh"), false);
    assert.equal(isLabelledIn("Customer: Ellen Marshall\n", labels, "Marsh"), false);
    assert.equal(isLabelledIn("Customer: Ellen Marsh\n", [], "Marsh"), false);
    assert.equal(isLabelledIn("", labels, "Marsh"), false);
  });

  it("withOrdinaryWords marks one-word names on an ordinary word that no title precedes", () => {
    const source = "Green won. Mr. Marsh paid. Marsh left. Helen Green came.";
    const mentions = [mention("Green", 0), mention("Marsh", 15), mention("Marsh", 27), mention("Helen Green", 39), mention("Okafor", 60)];
    const starts = new Set([0, 15, 27, 39, 60]);
    const marked = withOrdinaryWords(mentions, starts, source, ["Mr."]).map((found) => found.ordinary === true);
    assert.deepEqual(marked, [true, false, false, false, true]);
    assert.deepEqual(
      withOrdinaryWords(mentions, new Set(), source, ["Mr."]).map((found) => found.ordinary === true),
      [false, false, false, false, false],
    );
    assert.deepEqual(withOrdinaryWords([], starts, source, ["Mr."]), []);
    const mixed = withOrdinaryWords([mention("Marsh", 0), mention("Marsh", 20)], new Set([0]), "Marsh signed. Later, Marsh paid.", []);
    assert.deepEqual(
      mixed.map((found) => found.ordinary === true),
      [false, false],
    );
  });

  it("capitalised ordinary words one letter apart are not reported; a name on an ordinary word still is", () => {
    assert.deepEqual(variants("The menu was in Greek. The sign was in Greek. The door was painted Green.\n"), []);
    assert.deepEqual(variants("Then Marsh pays. Then Marsh leaves. Later March files it.\n"), []);
    assert.deepEqual(variants("Ask Marsh first. Then Marsh signs. Later Marhs files it.\n"), [
      '"Marhs" is one letter away from "Marsh", which the document uses more than once',
    ]);
    assert.deepEqual(variants("Mr. Marsh signs the lease. Then Marsh pays. Then Marsh leaves. Later March files it.\n"), [
      '"March" is one letter away from "Marsh", which the document uses more than once',
    ]);
    assert.deepEqual(variants("| Tenant |\n| --- |\n| Mr. Marsh |\n\nThen Marsh pays. Then Marsh leaves. Later March files it.\n"), [
      '"March" is one letter away from "Marsh", which the document uses more than once',
    ]);
    assert.deepEqual(variants("Customer: Ellen Marsh\n\nThen Marsh pays. Then Marsh leaves. Later March files it.\n"), [
      '"March" is one letter away from "Marsh", which the document uses more than once',
    ]);
    assert.deepEqual(variants("- **Client:** Marsh\n\nThen Marsh pays. Then Marsh leaves. Later March files it.\n"), [
      '"March" is one letter away from "Marsh", which the document uses more than once',
    ]);
    assert.deepEqual(variants("Ellen Marsh\n\nThen Marsh pays. Then Marsh leaves. Later March files it.\n"), []);
    assert.deepEqual(variants("Location: Marsh\n\nThen Marsh pays. Then Marsh leaves. Later March files it.\n"), []);
    assert.deepEqual(variants("Name: Green Valley Farm\n\nThe menu was in Greek. The sign was in Greek. The door was painted Green.\n"), []);
    assert.deepEqual(
      variants("Name: Green Valley Farm\n\nName: Greek Valley Farm\n\nThe door was painted Green. The menu was in Greek. The sign was in Greek.\n"),
      [],
    );
    assert.deepEqual(variants("Kenji Okafor sent it. Okafor called. Okafor paid. Okafur left.\n"), [
      '"Okafur" is one letter away from "Okafor", which the document uses more than once',
    ]);
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

describe("name-variant: カタカナか英字の名前に付く 社", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("one katakana company written two ways with 社", () => {
    assert.deepEqual(
      variants(
        "荷受人は、サウスベイ・インポート社の購買課です。\n請求書はサウスベイ・インポート社へ送ります。\n品物はサウスベイ・インポーツ社に届けます。\n",
        ja,
      ),
      ["「サウスベイ・インポーツ社」は、ほかの所で書いた会社名「サウスベイ・インポート社」と一字違いです"],
    );
  });

  it("one Latin company written two ways with 社", () => {
    assert.deepEqual(variants("発注先はNorthwind Traders社です。\n見積はNorthwind Traders社から届きます。\n納品はNorthwind Trader社が行います。\n", ja), [
      "「Northwind Trader社」は、ほかの所で書いた会社名「Northwind Traders社」と一字違いです",
    ]);
  });

  it("a well-known company named once is not reported", () => {
    assert.deepEqual(variants("アップル社の製品を使っています。\n", ja), []);
  });

  it("社 inside a kanji word is not a company form", () => {
    assert.deepEqual(variants("当社と貴社と御社は、本社と支社で会社の商社と神社の話をします。弊社も同社も各社も他社も自社も同じです。\n", ja), []);
  });

  it("a word that begins with 社 after a katakana name is not a company form", () => {
    assert.deepEqual(variants("サウスベイ・インポート社の担当です。\nサウスベイ・インポーツ社員が来ます。\nサウスベイ・インポート社に送ります。\n", ja), []);
  });

  it("placeholder companies with a letter label are not one name", () => {
    assert.deepEqual(variants("クラウドベンダーA社とクラウドベンダーB社を比べました。\nクラウドベンダーA社は価格が低いです。\n", ja), []);
  });

  it("a Latin name ending in a period before 社", () => {
    assert.deepEqual(
      variants("取引先はBlue Harbor Trading Co.社です。\n請求はBlue Harbor Trading Co.社へ送ります。\n納品はBlue Harbor Tradin Co.社が行います。\n", ja),
      ["「Blue Harbor Tradin Co.社」は、ほかの所で書いた会社名「Blue Harbor Trading Co.社」と一字違いです"],
    );
  });

  it("社 is not compared with 株式会社 for the same name", () => {
    assert.deepEqual(
      variants("サウスベイ・インポート株式会社（以下「サウスベイ・インポート社」）と契約します。\nサウスベイ・インポート社が支払います。\n", ja),
      [],
    );
  });
});

describe("name-variant: a signature or address written one item to a line", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const letter = (leader: string): string =>
    [
      "# Trip to the Coast",
      "",
      `Trip leader: Mr Owen ${leader} (Head of Year 8)`,
      "",
      "If you have questions, please contact Mr Owen Prestwick by email.",
      "",
      "Yours faithfully,",
      "",
      "Mr Owen Prestwick",
      "Head of Year 8",
      "Harrowgate College",
      "",
    ].join("\n");

  it("each line of a signature is read on its own, so the name on its first line is counted", () => {
    assert.deepEqual(variants(letter("Prestwich")), [
      '"Mr Owen Prestwich" is one letter away from "Mr Owen Prestwick", which the document uses more than once',
    ]);
  });

  it("a letter that writes the name one way throughout is not reported", () => {
    assert.deepEqual(variants(letter("Prestwick")), []);
  });

  it("a name wrapped across the lines of an ordinary sentence is still one name", () => {
    const source = [
      "Please send the signed form to Mr Owen",
      "Prestwick before the end of the week, so that the coach can be booked.",
      "",
      "Questions about the coach go to Mr Owen",
      "Prestwick at the school office, which is open every morning.",
      "",
      "The trip is led by Mr Owen Prestwich this year.",
      "",
    ].join("\n");
    assert.deepEqual(variants(source), ['"Mr Owen Prestwich" is one letter away from "Mr Owen Prestwick", which the document uses more than once']);
  });
});

describe("isLineBlock and tokensByLine: short lines read one at a time", () => {
  it("a signature or an address is a line block", () => {
    assert.equal(isLineBlock("Mr Owen Prestwick\nHead of Year 8\nHarrowgate College"), true);
    assert.equal(isLineBlock("Harrowgate College,\n14 Mill Lane\nHarrowgate HG1 2AB\n"), true);
  });

  it("a sentence wrapped across lines, a single line and an empty text are not", () => {
    assert.equal(isLineBlock("Please send the signed form to Mr Owen\nPrestwick before the end of the week."), false);
    assert.equal(isLineBlock("Mr Owen Prestwick"), false);
    assert.equal(isLineBlock(""), false);
    assert.equal(isLineBlock("\n\n"), false);
  });

  it("long lines, a line ending a sentence, a blank line or a long list are not", () => {
    assert.equal(isLineBlock("Please send the signed form to Mr Owen\nPrestwick before Friday"), false);
    assert.equal(isLineBlock("Send it to Mr Owen\nby Friday"), false);
    assert.equal(isLineBlock("Trip leader:\nMr Owen Prestwick"), false);
    assert.equal(isLineBlock("Mr Owen Prestwick\n\nHead of Year 8"), false);
    assert.equal(isLineBlock(Array.from({ length: 12 }, (_unused, index) => `Town ${String(index)}, ST`).join("\n")), false);
  });

  it("tokensByLine splits where a line break falls between two words", () => {
    const text = "Mr Owen\nHead of\nCollege";
    const token = (surface: string, start: number): Token => ({ surface, pos: "PROPN", span: { start, end: start + surface.length } });
    const tokens = [token("Mr", 100), token("Owen", 103), token("Head", 108), token("of", 113), token("College", 116)];
    assert.deepEqual(
      tokensByLine(tokens, text, 100).map((line) => line.map((found) => found.surface)),
      [["Mr", "Owen"], ["Head", "of"], ["College"]],
    );
    assert.deepEqual(tokensByLine([], text, 100), []);
  });
});

describe("name-variant: 形の似た別の字で書いた人の名前（健太 と 健大）", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const lookalikes = new Map([
    ["太", "太"],
    ["大", "太"],
    ["未", "未"],
    ["末", "未"],
  ]);
  const doc = (names: readonly string[]): string => names.map((name) => `ご担当：${name} 様\n\n${name} 様にご確認ください。\n`).join("\n");

  it("isLookalikeApart: 同じ位置の一字だけが、同じ組の字で違う", () => {
    assert.equal(isLookalikeApart("山本 健太", "山本 健大", lookalikes), true);
    assert.equal(isLookalikeApart("末松 一郎", "未松 一郎", lookalikes), true);
  });

  it("isLookalikeApart: 組に無い字、二字の違い、字数の違い、同じ形は違うと見ない", () => {
    assert.equal(isLookalikeApart("山本 健太", "山本 健一", lookalikes), false);
    assert.equal(isLookalikeApart("山本 健太", "山田 健大", lookalikes), false);
    assert.equal(isLookalikeApart("山本 健太", "山本 健太郎", lookalikes), false);
    assert.equal(isLookalikeApart("山本 健太", "山本 健太", lookalikes), false);
    assert.equal(isLookalikeApart("太未", "大末", lookalikes), false);
    assert.equal(isLookalikeApart("", "", lookalikes), false);
    assert.equal(isLookalikeApart("山本 健太", "山本 健大", new Map()), false);
  });

  const person = (surface: string, offset: number, words = surface.split(" ")): NameMention => ({ ...mention(surface, offset), words, person: true });
  const slips = (mentions: readonly NameMention[]): string[] => lookalikeSlipsIn(mentions, lookalikes).map((slip) => `${slip.mention.surface}→${slip.usual}`);

  it("lookalikeSlipsIn: 一度だけの名前を、二度以上書いた形の似た名前と比べる", () => {
    assert.deepEqual(slips([person("山本 健太", 0), person("山本 健太", 10), person("山本 健大", 20)]), ["山本 健大→山本 健太"]);
    assert.deepEqual(slips([person("山本 健大", 0), person("山本 健太", 10), person("山本 健太", 20)]), ["山本 健大→山本 健太"]);
  });

  it("lookalikeSlipsIn: 両方二度以上、両方一度、人でない名前、一語の名前、空は比べない", () => {
    assert.deepEqual(slips([person("山本 健太", 0), person("山本 健太", 5), person("山本 健大", 10), person("山本 健大", 15)]), []);
    assert.deepEqual(slips([person("山本 健太", 0), person("山本 健大", 10)]), []);
    assert.deepEqual(slips([mention("山本 健太", 0), mention("山本 健太", 10), mention("山本 健大", 20)]), []);
    assert.deepEqual(slips([person("健太", 0, ["健太"]), person("健太", 10, ["健太"]), person("健大", 20, ["健大"])]), []);
    assert.deepEqual(slips([]), []);
    assert.deepEqual(lookalikeSlipsIn([person("山本 健太", 0), person("山本 健太", 10), person("山本 健大", 20)], new Map()), []);
  });

  it("姓と名のそろった名前の一字が形の似た字。多いほうが二度以上、少ないほうが一度だけ", () => {
    const source = "ご担当：山本 健太 様\n\n変更は山本 健太 様からお知らせください。\n\n内容は山本 健大 様にご確認いただきます。\n";
    assert.deepEqual(variants(source, ja), ["「山本 健大」は、ほかの所で何度も書いた「山本 健太」と、形の似た字一字だけが違います"]);
  });

  it("どちらも二度以上書いた名前は別の二人（兄弟の 健太 と 健大）", () => {
    assert.deepEqual(variants(doc(["山本 健太", "山本 健大"]), ja), []);
  });

  it("多いほうが一度だけなら、どちらが正しいとも言えない", () => {
    const source = "ご担当：山本 健太 様\n\n内容は山本 健大 様にご確認いただきます。\n";
    assert.deepEqual(variants(source, ja), []);
  });

  it("組に無い字の一字違い、姓も違う名前は指さない", () => {
    const once = (name: string): string => `\n内容は${name} 様にご確認いただきます。\n`;
    assert.deepEqual(variants(doc(["山本 健太"]) + once("山本 健一"), ja), []);
    assert.deepEqual(variants(doc(["山本 健太"]) + once("山田 健大"), ja), []);
  });

  it("名だけの名前は比べない", () => {
    assert.deepEqual(variants("健太さんに渡します。健太さんが受け取ります。健大さんにも伝えます。\n", ja), []);
  });
});
