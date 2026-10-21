import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { bracketDepth, clauseCount, topicDistance } from "../packages/chaff/src/sentence-load.ts";

// 一文の負荷（bracket-nesting、clause-chain、topic-predicate-distance）。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, adapter = ja): readonly string[] => namedRuleRun(rule, source, adapter).findings;

const tokensOf = (text: string) => ja.segment(text).sentences[0]?.tokens ?? [];

describe("bracketDepth: 括弧の重なり", () => {
  it("重なった深さを数える", () => {
    assert.equal(bracketDepth("費用は本部が負担します。"), 0);
    assert.equal(bracketDepth("計画（案）を出す。"), 1);
    assert.equal(bracketDepth("（注（a）を参照）"), 2);
    assert.equal(bracketDepth("（ただし、出張費（交通費（特急料金を除く）を含む）は各部）"), 3);
    assert.equal(bracketDepth("「彼は『はい（たぶん）』と言った」"), 3);
  });

  it("二重の丸括弧（((題))）は一つの印。中に括弧がある二重や、閉じが離れた二重は重なりとして数える", () => {
    assert.equal(bracketDepth("〔規程第3条((届出の期限))関係〕のうち3－1((提出先))を改める。"), 2);
    assert.equal(bracketDepth("別表（（注））を見る。"), 1);
    assert.equal(bracketDepth("((a)と(b))を比べる。"), 2);
    assert.equal(bracketDepth("（（注）の内容）を見る。"), 2);
    assert.equal(bracketDepth("((届出の(期限)))を見る。"), 3);
  });

  it("並んだ括弧は重ならない。いちばん深い所を覚えておく", () => {
    assert.equal(bracketDepth("（a）と（b）と（c）"), 1);
    assert.equal(bracketDepth("（注（a（b）））と（c）"), 3);
  });

  it("いちばん内側の括弧を閉じない閉じ括弧は、紛れこんだ字として読む", () => {
    assert.equal(bracketDepth("（a「b）（c）」"), 3);
  });

  it("幅の違う閉じ括弧も、いちばん内側の開きを閉じる", () => {
    assert.equal(bracketDepth("(1）方針は「品質第一」です。"), 1);
    assert.equal(bracketDepth("（△)減少、[注］概算"), 1);
    assert.equal(bracketDepth("（詳細は(2）を参照）"), 2);
    assert.equal(bracketDepth("(1）「a」(2）「b」"), 1);
  });

  it("幅が違っても種類の違う閉じは閉じない", () => {
    assert.equal(bracketDepth("(1］「a」"), 2);
    assert.equal(bracketDepth("「a）"), 1);
  });

  it("開きの無い閉じ括弧、閉じない開き括弧、数式、波括弧", () => {
    assert.equal(bracketDepth("1) 準備 2) 実行"), 0);
    assert.equal(bracketDepth("（閉じない（まま"), 2);
    assert.equal(bracketDepth("式は $f(g(h(x)))$ です。"), 0);
    assert.equal(bracketDepth("設定は {a: {b: {c: 1}}} です。"), 0);
  });
});

describe("clauseCount: 節のつながり", () => {
  it("接続助詞と、読点で止めた動詞を数える", () => {
    assert.equal(clauseCount(tokensOf("報告した。")), 1);
    assert.equal(clauseCount(tokensOf("資料を調べて、内容をまとめ、課長に報告したが、返事がないので、もう一度送った。")), 5);
  });

  it("文の終わりの助詞（返信して。）は次の節をつないでいない", () => {
    assert.equal(clauseCount(tokensOf("内容を整理して、返信して。")), 2);
  });

  it("補助動詞へのつなぎは一つの述語", () => {
    assert.equal(clauseCount(tokensOf("資料を調べている。")), 1);
    assert.equal(clauseCount(tokensOf("課長に読んでもらった。")), 1);
  });
});

describe("topicDistance: 主題から述語まで", () => {
  it("文の最初の「名詞＋は」から終わりまでの字数", () => {
    assert.equal(topicDistance(tokensOf("会議は延期します。")), 3);
    assert.equal(topicDistance(tokensOf("報告します。")), undefined);
    assert.equal(topicDistance(tokensOf("延期ではなく中止にします。")), undefined);
  });

  it("主題の述語が先の節で閉じるなら、その節の終わりまで（〜ではありませんが、〜でございますが、〜であって）", () => {
    assert.equal(topicDistance(tokensOf("この計画は簡単なものではありませんが、来年の春までに必ず終えます。")), 12);
    assert.equal(topicDistance(tokensOf("本日の議題は、お配りした資料のとおりでございますが、最初に予算をお諮りします。")), 18);
    assert.equal(topicDistance(tokensOf("この提案は来年の計画につながるものであって、大変ありがたいと受け止めています。")), 15);
    assert.equal(topicDistance(tokensOf("この計画は重要なものであって、担当者は来年に実施する。")), 8);
  });

  it("〜ではなく、〜であるため、〜であるならば、〜ところ、〜ており、は、後ろの節に別の主語があるときだけ節の終わりで切る", () => {
    assert.equal(topicDistance(tokensOf("この申請は、当課の受付ではなく、窓口は別の課にあります。")), 8);
    assert.equal(topicDistance(tokensOf("この保険は、事故の相手に払う保険であるため、自分のけがは対象になりません。")), 14);
    assert.equal(topicDistance(tokensOf("売上は順調に伸びており、新しい店の計画が動き始めている。")), 6);
    assert.equal(topicDistance(tokensOf("この土地は，事業の地区内にあるところ，その施行者である市は，所有者に通知した。")), 10);
    assert.equal(topicDistance(tokensOf("守るのは役所の仕事であるならば、それは、議論が続いております。")), 10);
    assert.equal(topicDistance(tokensOf("当社は、価格ではなく、品質で勝負します。")), 14);
    assert.equal(topicDistance(tokensOf("売上は順調に伸びており、来年も増える見込みです。")), 18);
  });

  it("名詞＋「で、」は、後ろに別の主語があるときだけ閉じる", () => {
    assert.equal(topicDistance(tokensOf("この建物は古い倉庫で、私はそこに一人で住んでいた。")), 4);
    assert.equal(topicDistance(tokensOf("この建物は古い倉庫で、来年の春に取り壊す予定です。")), 17);
    const manner = "この行為は禁じられていましたが、新しい道具は対象外だったため、昨年の改正で、相手に無断で、道具を付ける行為が対象に加わりました。";
    assert.equal(topicDistance(tokensOf(manner)), 57);
    assert.equal(topicDistance(tokensOf("彼女は、真剣な目で、相手の顔を見ると、私はすぐに部屋を出た。")), 25);
    const means = "当社は本件を電子メールで、相手方が指定した担当者に説明を行う。";
    assert.equal(topicDistance(tokensOf(means)), [...means].length - 6);
  });

  it("受け身で伝える引用（〜だと言われているが）の中の主題は、引用の中で閉じる。自分で考える引用は文の述語まで", () => {
    assert.equal(topicDistance(tokensOf("世間では、この計画は無理だと言われているが、実際は順調に進んでいる。")), 3);
    assert.equal(topicDistance(tokensOf("当社は、今後も需要が拡大すると考えております。")), 17);
  });

  it("文の述語まで数えるもの: 絞り込む「〜であって、〜者」、条件の中の主語、こと＋が、「〜とされていて」", () => {
    const whole = (text: string): number | undefined => topicDistance(tokensOf(text));
    assert.equal(whole("この制度は、仕事を探している人であって、支援が必要な者の就職を助けるものです。"), 31);
    assert.equal(whole("業者は、帳簿を保存することが義務付けられており、客が閲覧を求めた場合、これに応じなければなりません。"), 45);
    assert.equal(whole("人材の確保は、喫緊の課題となっており、仕組みを作ることが急務となっています。"), 29);
    assert.equal(whole("大臣は、事務を機構に行わせることとされていて、機構は、基準を公表している。"), 31);
  });

  it("時や量を言う「は」（今夜は、当日は、その日は、午前中は）は、後ろに別の主題があれば譲る", () => {
    const fromLater = "今夜は、駅で古い友人に会って、長い話をしたが、とにかく、あの男の話は嘘ばかりだった。";
    assert.equal(topicDistance(tokensOf(fromLater)), 6);
    assert.equal(topicDistance(tokensOf("その日は朝から雨で、店の主人は客が来ないと嘆いた。")), 8);
    assert.equal(topicDistance(tokensOf("午前中は会議が続き、部長は昼に戻った。")), 4);
  });

  it("時の「は」しか主題が無ければ、その「は」から数える。名詞・接頭辞・「の」の付いた語、連体詞の付いた自立の名詞（翌年度以降は、大多数は、利用者の多くは、その多くは）は時ではない", () => {
    const only = "現在は計算の費用より保存の費用が高く、結果を残すより入力から計算し直すほうが安いことが多い。";
    assert.equal(topicDistance(tokensOf(only)), 40);
    const narrowed = "利用者の多くは、新しい料金は高いと感じている。";
    assert.equal(topicDistance(tokensOf(narrowed)), 13);
    assert.equal(topicDistance(tokensOf("翌年度以降は、物価が上がる中、店の需要は続く。")), 14);
    assert.equal(topicDistance(tokensOf("大多数は反対したが、委員長は賛成した。")), 13);
    assert.equal(topicDistance(tokensOf("その多くは反対したが、委員長は賛成した。")), 13);
  });

  it("空白は数えない", () => {
    assert.equal(topicDistance(tokensOf("会議は 明日に 延期します。")), topicDistance(tokensOf("会議は明日に延期します。")));
  });
});

describe("bracket-nesting", () => {
  it("三重の括弧を指し、二重までは指さない", () => {
    assert.deepEqual(findingsOf("bracket-nesting", "費用は本部が負担します（ただし、出張費（交通費（特急料金を除く）を含む）は各部の負担）。\n"), [
      "括弧が 3 重になっています（2 重まで）",
    ]);
    assert.deepEqual(findingsOf("bracket-nesting", "費用は本部が負担します（ただし、出張費（交通費を含む）は各部の負担）。\n"), []);
  });

  it("英語の文書でも数える", () => {
    assert.deepEqual(findingsOf("bracket-nesting", "The fee is waived (for members (including students (under 25))).\n", en), [
      "Brackets nested 3 deep (limit 2)",
    ]);
  });
});

describe("clause-chain", () => {
  it("六つの節を指し、五つまでは指さない", () => {
    assert.deepEqual(
      findingsOf(
        "clause-chain",
        "資料を調べて、内容をまとめ、課長に報告したが、返事がないので、もう一度送ってみたところ、翌日に返事が来て、修正を頼まれた。\n",
      ),
      ["一文に節が 6 つつながっています（5 つまで）"],
    );
    assert.deepEqual(findingsOf("clause-chain", "資料を調べて、内容をまとめ、課長に報告したが、返事がないので、もう一度送った。\n"), []);
  });

  it("鉤括弧で引いたものの中は数えない", () => {
    assert.deepEqual(findingsOf("clause-chain", "彼は「調べて、まとめ、報告したが、返事がないので、送り直して、待った」と書いた。\n"), []);
  });
});

describe("topic-predicate-distance", () => {
  it("主題から述語まで遠い文を指し、近い文は指さない", () => {
    const far =
      "来週の定例会議は、新しい担当者の紹介と、先月から続いている予算の見直しと、春に予定している本社の移転の準備と、秋の採用計画の確認と、年末の懇親会の段取りについて話し合う必要があるため、二時間に延長します。\n";
    assert.deepEqual(findingsOf("topic-predicate-distance", far), ["「は」で出した主題から述語まで 91 字あります（80 字まで）"]);
    assert.deepEqual(findingsOf("topic-predicate-distance", "そのため定例会議は二時間に延長します。\n"), []);
  });

  it("主題の述語が先の節で閉じる文は、その節が長いときだけ指す", () => {
    const own =
      "この道行きは安易なものではありませんが、先日の会見で、いわゆる緩和政策が必要な局面ではないと考えている旨を申し上げたのは、こうした賃金と物価の循環的な動きを踏まえた現状の認識に基づくものであります。\n";
    assert.deepEqual(findingsOf("topic-predicate-distance", own), []);
    const long =
      "来週の定例会議は、新しい担当者の紹介と、先月から続いている予算の見直しと、春に予定している本社の移転の準備と、秋の採用計画の確認と、年末の懇親会の段取りについて話し合うための長い会議ではありませんが、資料は前日までに配ります。\n";
    assert.equal(findingsOf("topic-predicate-distance", long).length, 1);
  });

  it("主題が「名詞＋で、」ですぐ述語を得て、別の主語の節が長く続く文は指さない（宮沢賢治「セロ弾きのゴーシュ」）", () => {
    const named =
      "家といってもそれは町はずれの川ばたにあるこわれた水車小屋で、ゴーシュはそこにたった一人ですんでいて午前は小屋のまわりの小さな畑でトマトの枝をきったり甘藍の虫をひろったりしてひるすぎになるといつも出て行っていたのです。\n";
    assert.deepEqual(findingsOf("topic-predicate-distance", named), []);
  });

  it("主題の無い文は見ない", () => {
    assert.deepEqual(
      findingsOf(
        "topic-predicate-distance",
        "新しい担当者の紹介と、先月から続いている予算の見直しと、春に予定している移転の準備について話し合う必要があるため、二時間に延長します。\n",
      ),
      [],
    );
  });
});
