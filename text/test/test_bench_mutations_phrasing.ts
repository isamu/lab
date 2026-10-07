import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Plant, PlantContext } from "../scripts/bench-text.ts";
import { MIN_DOCUMENT_LENGTH } from "../packages/chaff/src/detectors/signals.ts";
import {
  TEAM_PREFER,
  avoidedSpelling,
  chainWithConjunction,
  closeWithCliche,
  dropFirstHeading,
  intensify,
  padOpening,
  repeatOpener,
  repeatPetPhrase,
  stackHedges,
} from "../scripts/bench-mutations-phrasing.ts";

// yarn bench で植える、言い回しの誤り。どの行に何を植えるか、植えないのはどんなときかを、短い自作の文書で固定する。

const lines = (...rows: string[]): string => rows.join("\n");
const limits = (entries: Record<string, number>): { readonly limits: Readonly<Record<string, number>> } => ({ limits: entries });

/** 植えた行の中身と行番号。 */
const at = (plant: Plant | undefined): readonly [number, string] | undefined =>
  plant === undefined ? undefined : [plant.line, plant.source.split("\n")[plant.line - 1] ?? ""];

describe("dropFirstHeading", () => {
  const source = lines("# 案内", "", "前置きの文。", "", "## 背景", "", "一つ目の段落。", "", "二つ目の段落。", "", "## 詳細", "", "本文。");

  it("最初の節見出しとその後の空行を消し、前置きが上限を超えるときだけ植える", () => {
    const plant = dropFirstHeading(source, limits({ "preamble-length": 2 }));
    assert.deepEqual(plant?.source.split("\n"), ["# 案内", "", "前置きの文。", "", "一つ目の段落。", "", "二つ目の段落。", "", "## 詳細", "", "本文。"]);
    assert.equal(plant?.line, 5);
  });

  it("前置きが上限ちょうどなら、次の節見出しが無ければ、上限が分からなければ植えない", () => {
    assert.equal(dropFirstHeading(source, limits({ "preamble-length": 3 })), undefined);
    assert.equal(dropFirstHeading(lines("前置き。", "", "## 背景", "", "本文。"), limits({ "preamble-length": 0 })), undefined);
    assert.equal(dropFirstHeading(source, limits({})), undefined);
  });

  it("文で終わらない行（日付と社名）は前置きの段落に数えない", () => {
    const stamped = lines("# 案内", "", "2026年10月1日", "株式会社みなと製作所", "", "## 背景", "", "一つ目の段落。", "", "## 詳細", "", "本文。");
    assert.equal(dropFirstHeading(stamped, limits({ "preamble-length": 1 })), undefined);
  });
});

describe("closeWithCliche", () => {
  it("記事の最後に、結びの定型の一文を段落として足す", () => {
    assert.deepEqual(at(closeWithCliche(lines("# 記事", "", "本文です。", ""))), [5, "いかがでしたか。"]);
    assert.deepEqual(at(closeWithCliche(lines("# Post", "", "Body."))), [5, "Thanks for reading."]);
  });
});

describe("padOpening", () => {
  it("最初の文の後ろに、どの記事の書き出しにもなる一文を足す。文体は文書に合わせる", () => {
    assert.deepEqual(at(padOpening(lines("# 記事", "", "こんにちは、田中です。今回は予約表の話です。"))), [
      3,
      "こんにちは、田中です。近年、業務の効率化が注目されています。今回は予約表の話です。",
    ]);
    assert.deepEqual(at(padOpening(lines("# 記事", "", "表を作った。話はそれだけである。"))), [
      3,
      "表を作った。近年、業務の効率化が注目されている。話はそれだけである。",
    ]);
    assert.deepEqual(at(padOpening("Hi all. This post is short.")), [
      1,
      "Hi all. In recent years, the way teams work has changed a great deal. This post is short.",
    ]);
  });

  it("文で終わる行が無ければ植えない", () => {
    assert.equal(padOpening(lines("# 記事", "", "- 項目。", "| 表 |")), undefined);
  });
});

describe("intensify", () => {
  it("最初の節の最初の段落で、最初の文の後ろに中身の無い強調を足す", () => {
    const source = lines("# 案内", "", "前置きです。", "", "## 背景", "", "- 項目です。", "", "予約表を作りました。困っていました。");
    assert.deepEqual(at(intensify(source)), [9, "予約表を作りました。これは非常に重要です。困っていました。"]);
    assert.deepEqual(at(intensify(lines("## 背景", "", "表を作った。"))), [3, "表を作った。これは非常に重要である。"]);
    assert.deepEqual(at(intensify(lines("## Background", "", "We built a sheet. It was slow."))), [
      3,
      "We built a sheet. This is extremely important. It was slow.",
    ]);
  });

  it("節見出しの無い文書と、節の下に段落の無い文書には植えない", () => {
    assert.equal(intensify(lines("山田様", "", "いつもお世話になっております。")), undefined);
    assert.equal(intensify(lines("## 日程", "", "| 日付 | 予定 |")), undefined);
  });
});

describe("stackHedges", () => {
  it("最初の節の最初の段落で、最初の文の後ろに逃げを重ねた一文を足す。文体は文書に合わせる", () => {
    const source = lines("# 案内", "", "前置きです。", "", "## 背景", "", "予約表を作りました。困っていました。");
    assert.deepEqual(at(stackHedges(source)), [7, "予約表を作りました。これで遅れは減るかもしれないと思われます。困っていました。"]);
    assert.deepEqual(at(stackHedges(lines("## 背景", "", "表を作った。"))), [3, "表を作った。これで遅れは減るかもしれないと思われる。"]);
    assert.deepEqual(at(stackHedges(lines("## Background", "", "We built a sheet. It was slow."))), [
      3,
      "We built a sheet. This may possibly cut the delays. It was slow.",
    ]);
  });

  it("節見出しの無い文書には植えない", () => {
    assert.equal(stackHedges(lines("山田様", "", "いつもお世話になっております。")), undefined);
  });
});

describe("repeatOpener", () => {
  const source = lines(
    "# 案内",
    "",
    "最初の段落です。",
    "",
    "## 背景",
    "",
    "表を作りました。",
    "",
    "部屋が増えました。",
    "",
    "## 対策",
    "",
    "表示板を足しました。",
  );

  it("見出しだけを挟んで続く段落の、上限より一つ多い数を同じ接続詞で始める。文書の最初の段落には足さない", () => {
    const plant = repeatOpener(source, limits({ "repeated-conjunction": 2 }));
    assert.deepEqual(
      plant?.source.split("\n").filter((line) => line.startsWith("また、")),
      ["また、表を作りました。", "また、部屋が増えました。", "また、表示板を足しました。"],
    );
    assert.equal(plant?.line, 7);
  });

  it("続く段落が足りなければ、すでに接続詞で始まる段落や挨拶や箇条書きで切れれば、植えない", () => {
    assert.equal(repeatOpener(source, limits({ "repeated-conjunction": 3 })), undefined);
    assert.equal(repeatOpener(source.replace("部屋が増えました。", "一方で、部屋が増えました。"), limits({ "repeated-conjunction": 2 })), undefined);
    assert.equal(repeatOpener(source.replace("部屋が増えました。", "- 部屋が増えました。"), limits({ "repeated-conjunction": 2 })), undefined);
    assert.equal(repeatOpener(source, limits({})), undefined);
  });

  it("英語は小文字にしてよい語で始まる段落にだけ足す。人名で始まる段落で切れる", () => {
    const english = lines("# Note", "", "First.", "", "We built it.", "", "The room filled.", "", "It worked.");
    assert.deepEqual(
      repeatOpener(english, limits({ "repeated-conjunction": 2 }))
        ?.source.split("\n")
        .filter((line) => line.startsWith("Also, ")),
      ["Also, we built it.", "Also, the room filled.", "Also, it worked."],
    );
    assert.equal(repeatOpener(english.replace("The room filled.", "Ito filled the room."), limits({ "repeated-conjunction": 2 })), undefined);
  });
});

describe("chainWithConjunction", () => {
  it("段落の二文目から、上限より一つ多い文を And で始める", () => {
    const plant = chainWithConjunction(
      lines("# Note", "", "Roomly is new. It is fast. The panel is small. We like it. Done."),
      limits({ "sentence-initial-conjunction-run": 2 }),
    );
    assert.deepEqual(at(plant), [3, "Roomly is new. And it is fast. And the panel is small. And we like it. Done."]);
  });

  it("文が足りなければ、足せない語（人名）で始まる文があれば、上限が分からなければ植えない", () => {
    const rule = limits({ "sentence-initial-conjunction-run": 2 });
    assert.equal(chainWithConjunction("Roomly is new. It is fast. The panel is small.", rule), undefined);
    assert.equal(chainWithConjunction("Roomly is new. It is fast. Ito likes it. We agree.", rule), undefined);
    assert.equal(chainWithConjunction("Roomly is new. It is fast. The panel is small. We like it.", limits({})), undefined);
  });

  it("日本語の段落では、二文目から上限より一つ多い文を「そして、」で始める", () => {
    const plant = chainWithConjunction(
      lines("# メモ", "", "会議室を予約しました。資料を配りました。議事録を残しました。結果を共有しました。以上です。"),
      limits({ "sentence-initial-conjunction-run": 2 }),
    );
    assert.deepEqual(at(plant), [3, "会議室を予約しました。そして、資料を配りました。そして、議事録を残しました。そして、結果を共有しました。以上です。"]);
  });
});

describe("avoidedSpelling / TEAM_PREFER", () => {
  it("チームの書き方の一つを、使わない書き方にする。見出しには植えない", () => {
    assert.deepEqual(at(avoidedSpelling(lines("## 打ち合わせ", "", "打ち合わせは一時間です。"))), [3, "打合せは一時間です。"]);
    assert.deepEqual(at(avoidedSpelling("We send an email.")), [1, "We send an e-mail."]);
  });

  it("チームの書き方が無ければ植えない", () => {
    assert.equal(avoidedSpelling(lines("## 打ち合わせ", "", "会議は一時間です。")), undefined);
  });

  it("使わない書き方から使う書き方への対を、chaff.yaml の prefer として渡す", () => {
    assert.equal(TEAM_PREFER["打合せ"], "打ち合わせ");
    assert.equal(TEAM_PREFER["e-mail"], "email");
    assert.equal(TEAM_PREFER["打ち合わせ"], undefined);
  });
});

describe("repeatPetPhrase", () => {
  /** chaff が数えるちょうどの長さ（床）と測る文書。 */
  const counted = (unit: "char" | "word", entries: Record<string, number>): PlantContext => ({
    limits: entries,
    lengthUnit: unit,
    documentLength: () => MIN_DOCUMENT_LENGTH[unit],
  });
  const rule = counted("char", { "ngram-repetition": 2 });
  const polite = lines(
    "# 案内",
    "",
    "こんにちは、田中です。表を作りました。",
    "",
    "- 箇条書きの項目です。",
    "",
    "部屋が増えました。予約も増えました。",
    "",
    "```",
    "コードの中です。",
    "```",
    "",
    "表示板を足しました。",
  );

  it("上限より一つ多い段落で、足せる最初の文の頭に同じ前置きを足す。一つの段落には一度だけ", () => {
    const plant = repeatPetPhrase(polite, rule);
    assert.deepEqual(plant?.source.split("\n"), [
      "# 案内",
      "",
      "こんにちは、田中です。言うまでもないことですが、表を作りました。",
      "",
      "- 箇条書きの項目です。",
      "",
      "言うまでもないことですが、部屋が増えました。予約も増えました。",
      "",
      "```",
      "コードの中です。",
      "```",
      "",
      "言うまでもないことですが、表示板を足しました。",
    ]);
    assert.equal(plant?.line, 3);
  });

  it("である調の文書には、である調の前置きを足す", () => {
    const plain = lines("表を作った。", "", "部屋が増えた。", "", "表示板を足した。");
    assert.deepEqual(
      repeatPetPhrase(plain, rule)
        ?.source.split("\n")
        .filter((line) => line !== ""),
      ["言うまでもないことだが、表を作った。", "言うまでもないことだが、部屋が増えた。", "言うまでもないことだが、表示板を足した。"],
    );
  });

  it("英語は小文字にしてよい語で始まる文にだけ足す。人名で始まる文は飛ばして、同じ段落の次の文に足す", () => {
    const english = lines("# Note", "", "Ito made a table. We shared it.", "", "The room filled.", "", "It worked.");
    const plant = repeatPetPhrase(english, counted("word", { "ngram-repetition": 2 }));
    assert.deepEqual(
      plant?.source.split("\n").filter((line) => line !== "" && !line.startsWith("#")),
      ["Ito made a table. It goes without saying that we shared it.", "It goes without saying that the room filled.", "It goes without saying that it worked."],
    );
    assert.equal(plant?.line, 3);
  });

  it("足せる段落が上限より一つ多くなければ、上限が分からなければ、植えない。文で終わらない行（社名）は段落に数えない", () => {
    assert.equal(repeatPetPhrase(polite, counted("char", { "ngram-repetition": 3 })), undefined);
    assert.equal(repeatPetPhrase(lines(polite, "", "株式会社みなと製作所"), counted("char", { "ngram-repetition": 3 })), undefined);
    assert.equal(repeatPetPhrase(polite.replace("部屋が増えました。予約も増えました。", "- 部屋が増えました。"), rule), undefined);
    assert.equal(repeatPetPhrase(lines("Ito came.", "", "Sato came.", "", "Kato came."), counted("word", { "ngram-repetition": 2 })), undefined);
    assert.equal(repeatPetPhrase(polite, counted("char", {})), undefined);
  });

  it("足した後の文書が chaff の数える長さに届かなければ、長さを測れなければ、植えない。長さは足した後で測る", () => {
    const floor = MIN_DOCUMENT_LENGTH.char;
    assert.equal(repeatPetPhrase(polite, { ...rule, documentLength: () => floor - 1 }), undefined);
    assert.equal(repeatPetPhrase(polite, { limits: rule.limits, lengthUnit: "char" }), undefined);
    assert.equal(repeatPetPhrase(polite, { limits: rule.limits, documentLength: () => floor }), undefined);
    const grown = (source: string): number => (source.includes("言うまでもない") ? floor : floor - 1);
    assert.equal(repeatPetPhrase(polite, { ...rule, documentLength: grown })?.line, 3);
  });
});
