import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-mixed-desumasu: 地の文ではない文（札を付けて引いた言葉、記入欄の値、問い合わせ先の段落、引いた問いの並び）は数えず、
// 意図した声の形（丁寧にしか言わない挨拶、相手への願い、演説の決意の言い切り、場面を差し出す書き出し、条件だけの問い）は指さない。
// どれも、形が外れれば今までどおり指すことを一緒に確かめる。例文は自作と、首相官邸の式辞・特許庁と気象庁のページを縮めたもの。

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", genre).findings;

const polite = ["新しい制度は来月から始まります。", "申請の窓口は区役所です。", "受付は平日の九時からです。", "必要な書類は三つあります。"].join("");
const plain = ["新しい制度は来月から始まる。", "申請の窓口は区役所である。", "受付は平日の九時からである。", "必要な書類は三つある。"].join("");
const address = [
  "本日、ここに式典を挙行いたします。",
  "多くの方が犠牲となられました。",
  "私たちは決して忘れません。",
  "平和への歩みを進めてまいりました。",
].join("");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("no-mixed-desumasu: 札を付けて引いた言葉", () => {
  it("「例：」で始まる文、札だけの段落（用例）の下の段落、「Q:」の問いを数えない", () => {
    assert.deepEqual(findingsOf(`# 記載方法\n\n${polite}\n\n例：旧氏を併記した氏名を記載する。\n`), []);
    assert.deepEqual(findingsOf(`# 強い雨\n\n${plain}\n\n用例\n\n○○地方では１時間に20mmの強い雨が降っています。\n`, "docs/glossary"), []);
    assert.deepEqual(findingsOf(`# よくある問い\n\n${polite}\n\nQ: このコードってなんで古臭いの？\n`, "blog/tech"), []);
  });

  it("札の無い文、札の後ろに区切りが無い文は今までどおり指す", () => {
    assert.equal(findingsOf(`# 記載方法\n\n${polite}\n\n旧氏を併記した氏名を記載する。\n`).length, 1);
    assert.equal(findingsOf(`# 記載方法\n\n${polite}\n\n例えば、旧氏を併記した氏名を記載する。\n`).length, 1);
    assert.equal(findingsOf(`# 強い雨\n\n${plain}\n\n○○地方では１時間に20mmの強い雨が降っています。\n`, "docs/glossary").length, 1);
  });
});

describe("no-mixed-desumasu: 印を付けた札の行の下の記入欄", () => {
  it("「■ 調査目的」の行の下の値を数えない", () =>
    assert.deepEqual(findingsOf(`# 調査結果の公表\n\n${polite}\n\n■ 調査目的\n国民の意識を把握し、今後の施策の参考とする。\n`, "business/press-release"), []));

  it("札の行が無い段落と、段落の頭の行が文で終わる段落は今までどおり指す", () => {
    assert.equal(findingsOf(`# 調査結果の公表\n\n${polite}\n\n国民の意識を把握し、今後の施策の参考とする。\n`, "business/press-release").length, 1);
    assert.equal(findingsOf(`# 調査結果の公表\n\n${polite}\n\n■ 調査を終えた。\n今後の施策の参考とする。\n`, "business/press-release").length, 2);
  });
});

describe("no-mixed-desumasu: 問い合わせ先の段落", () => {
  it("〒や電話の行のある段落の文を数えない", () =>
    assert.deepEqual(
      findingsOf(
        `# 会議録\n\n${plain}\n\n政策企画課\n〒100-0001\u3000東京都千代田区一丁目1番1号\n電話：03-0000-0000\n政策企画課へのお問い合わせは専用フォームをご利用ください。\n`,
      ),
      [],
    ));

  it("番号の行の無い段落と、札の後ろに番号も「：」も無い行の段落は今までどおり指す", () => {
    assert.equal(findingsOf(`# 会議録\n\n${plain}\n\n政策企画課\n政策企画課へのお問い合わせは専用フォームをご利用ください。\n`).length, 1);
    assert.equal(findingsOf(`# 会議録\n\n${plain}\n\n電話番号の書き方\n番号は市外局番から書いてください。\n`).length, 1);
  });
});

describe("no-mixed-desumasu: 一つの文の中に並べて引いた問い", () => {
  it("「？」で切れた問いが間を置かずに並び、助詞で始まる文へ続くなら数えない", () =>
    assert.deepEqual(findingsOf(`# 要素の選び方\n\n${polite}例えば、これは一覧か？順序付きか順序なしか？図に説明が要るか？などです。\n`), []));

  it("並びが助詞で始まる文へ続かなければ、問いは今までどおり数える", () =>
    assert.equal(findingsOf(`# 要素の選び方\n\n${polite}図に説明が要るか？順序が付いているか？\n`).length, 2));
});

describe("no-mixed-desumasu: 意図した声の形", () => {
  it("である調の文書の、丁寧にしか言わない挨拶を指さない", () =>
    assert.deepEqual(findingsOf(`# 報告\n\n${plain}農業まつり、お疲れ様でした。\n`, "business/meeting-notes"), []));

  it("挨拶でない丁寧な文と、本文の中の依頼は今までどおり指す", () => {
    assert.equal(findingsOf(`# 概要\n\n${plain}詳しい資料はこちらにあります。\n`).length, 1);
    assert.equal(findingsOf(`# 概要\n\n${plain}詳しくは、こちらをご覧ください。\n`).length, 1);
  });

  it("ですます調の文書の「〜てほしい。」と、条件だけで問う「〜だったら？」を指さない", () => {
    assert.deepEqual(findingsOf(`# 年頭所感\n\n${polite}若い世代に、未来を信じてほしい。\n`, "speech/address"), []);
    assert.deepEqual(findingsOf(`# 性能\n\n${polite}しかし、これが数万行のコードの一部だったら？\n`, "blog/tech"), []);
  });

  it("願いの過去形と、条件の後に文末がある文は今までどおり指す", () => {
    assert.equal(findingsOf(`# 年頭所感\n\n${polite}若い世代に、未来を信じてほしかった。\n`, "speech/address").length, 1);
    assert.equal(findingsOf(`# 性能\n\n${polite}これが数万行のコードの一部だったら困る。\n`, "blog/tech").length, 1);
  });

  it("演説の、主語を言わない決意の言い切り（〜を、二度と繰り返さない。）を指さない", () =>
    assert.deepEqual(findingsOf(`# 式辞\n\n${address}戦争の惨禍を、二度と繰り返さない。\n`, "speech/address"), []));

  it("演説でない文書の同じ文と、演説でも主語のある文・過去の文は今までどおり指す", () => {
    assert.equal(findingsOf(`# 報告\n\n${polite}報告書を、来週提出する。\n`, "business/email").length, 1);
    assert.equal(findingsOf(`# 式辞\n\n${address}海上警備行動が発令された。\n`, "speech/address").length, 1);
    assert.equal(findingsOf(`# 式辞\n\n${address}諸官は任務を遂行する。\n`, "speech/address").length, 1);
    assert.equal(findingsOf(`# 式辞\n\n${address}戦争の惨禍を、二度と繰り返さなかった。\n`, "speech/address").length, 1);
  });

  it("次の文が「そんな」で受ける、場面を差し出す常体の書き出しを指さない", () =>
    assert.deepEqual(findingsOf(`# 対処法\n\nPDFが重くて送れない。そんなときの対処法を、手軽なものから順に書いていきます。${polite}\n`, "blog/tech"), []));

  it("次の文が「その」で始まる常体の文と、段落を変えて「そんな」で受ける文は今までどおり指す", () => {
    assert.equal(findingsOf(`# 対処法\n\nPDFが重くて送れない。その原因を、順に書いていきます。${polite}\n`, "blog/tech").length, 1);
    assert.equal(findingsOf(`# 対処法\n\nPDFが重くて送れない。\n\nそんなときの対処法を、順に書いていきます。${polite}\n`, "blog/tech").length, 1);
  });
});
