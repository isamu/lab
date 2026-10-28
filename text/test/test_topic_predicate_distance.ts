import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// topic-predicate-distance: 主題（〜は）の述語が先の節にある文、条文の引用、一行に詰まった箇条。
// 例文は政府の文書（高齢社会白書、防災白書、政府広報オンライン、首相官邸、特許庁）の抜粋と自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const RULE = "topic-predicate-distance";

const RULES = loadRules("ja");

/** The distances the rule reports, as the CLI runs it: the document read with the profile its genre or its lines choose. */
const distances = (source: string, genre = "business/report"): readonly number[] =>
  runRules(buildDocument("a.md", `${source}\n`, ja, undefined, profileFor(EMPTY, "a.md", source, "ja", genre)), RULES, { [RULE]: "normal" }, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => Number(finding.values["count"]));

describe("topic-predicate-distance: 述語のすぐ後ろで閉じる節（topic-clause-close）", () => {
  it("「〜ことから、」の前に主題の述語がある文は、その節までを数える（高齢社会白書）", () => {
    const school =
      "学校は地域コミュニティの核となることから、児童生徒が地域住民とともに創造的な活動を企画・立案したり交流したりするための「共創空間」を生み出す必要があることや、他の公共施設との複合化等を通じて、児童生徒や地域住民にとって多様な学習環境を創出する必要があることなどを周知している。";
    assert.deepEqual(distances(school), []);
    const research =
      "科学技術の研究開発は、高齢化に伴う課題の解決に大きく寄与するものであることから、高齢者に特有の疾病及び健康増進に関する調査研究、高齢者の利用に配慮した福祉用具、生活用品、情報通信機器等の研究開発等を推進するとともに、そのために必要な基盤の整備を図る。";
    assert.deepEqual(distances(research), []);
  });

  it("主題と「〜ことから、」の間に別の主語（〜ことは、〜が）があれば、主題の述語はまだ先にあるので数え続ける（防災白書・自作）", () => {
    const disaster =
      "また、被災地方公共団体は、自らの体制だけで膨大な災害対応業務を行うことは困難であることから、国や他の地方公共団体等からの応援職員等を迅速・的確に受け入れて情報共有や各種調整等を行うための受援体制を整備することが重要である。";
    assert.equal(distances(disaster).length, 1);
    const meeting =
      "来月の定例会議は、本社の会場が改修工事で使えない状況であることから、近くの貸会議室を借りるか、オンラインで開くか、日程そのものを再来月にずらすかを各部の意見を聞いたうえで決めて、来週中に改めてお知らせします。";
    assert.equal(distances(meeting).length, 1);
  });

  it("「〜つつ、」「〜としても、」「〜こととし、」も同じ（政府広報オンライン・高齢社会白書・首相官邸）", () => {
    const feelings =
      "こどもの気持ちはしっかり受け止めつつ、被害の内容や状況などの事実関係については、質問を重ねたり、話を誘導したりすることのないようにして、できるだけ早く警察、ワンストップ支援センター、児童相談所などの専門機関や専門家に相談しましょう。";
    assert.deepEqual(distances(feelings), []);
    const hotline =
      "消費者がトラブルに見舞われたとしても、相談窓口の存在に気付かないことや、相談窓口があることは知っていたとしても、その連絡先が分からないことがあるため、全国どこからでも身近な消費生活相談窓口につながる共通の電話番号である「消費者ホットライン」の事業を平成22年1月から実施（平成27年7月から「188」番へ3桁化）している。";
    assert.deepEqual(distances(hotline), []);
    const dispatch =
      "我が国はイラクの復興支援のため自衛隊の部隊を派遣することとし、その年の１２月２４日、クリスマスイブの日に、当時の小泉純一郎内閣総理大臣臨席の下、愛知県の航空自衛隊小牧基地で航空自衛隊輸送機部隊の編成完結式が行われました。";
    assert.deepEqual(distances(dispatch), []);
  });

  it("読点で区切った主題は、繋辞の後ろでなければ「〜つつ、」で閉じず、文末まで数える（情報通信白書）", () => {
    const aisi =
      "AISIは、英国・米国等の同様の機関とも連携しつつ、AIの開発・提供・利用の安全性向上に資する基準・ガイダンス等の検討、AIの安全性評価方法等の調査、AIの安全性に関する技術・事例の調査などを行っていくこととしている。";
    assert.equal(distances(aisi).length, 1);
  });

  it("「〜ましたが、」の後ろに続く文は、これまでどおり主題から文末までを数える（政府広報オンライン）", () => {
    const stalker =
      "これまで、GPS機器を悪用した行為は規制されていましたが、紛失防止タグを悪用した行為は規制対象となっていなかったことから、令和7年（2025年）のストーカー規制法改正により、相手に無断で、紛失防止タグを取り付けたり、紛失防止タグを使って位置情報を取得したりする行為が規制対象行為に加わりました。";
    assert.equal(distances(stalker).length, 1);
  });

  it("「〜ますが、」の後ろが別の主語（〜が）の節と新しい主題に移る文は、「〜ますが」までを数える（自作）", () => {
    const business =
      "当社は、首都圏を中心に家庭用の調理器具と収納用品の製造及び販売並びにこれらに付随する保守点検の業務を営んでおりますが、調理器具以外の製品の売上の割合が小さいため、製品区分別の生産実績及び販売実績の記載は省略しております。";
    assert.deepEqual(distances(business), []);
    const past =
      "当社は、昨年度まで家庭用の調理器具と収納用品の製造及び販売並びにこれらに付随する保守点検の業務を営んでおりましたが、収納用品の事業の採算が悪化したため、同事業の製造部門は本年四月に他社へ譲渡いたしました。";
    assert.deepEqual(distances(past), []);
  });

  it("「〜ますが、」の後ろも同じ主題の話が続く文、別の主語の無い文は、文末まで数える（自作）", () => {
    const continues =
      "当社は、首都圏を中心に家庭用の調理器具と収納用品の製造及び販売並びにこれらに付随する保守点検の業務を営んでおりますが、今後は地方の販売店とも取引を広げ、海外の展示会にも出品して新しい顧客を開拓していく計画です。";
    assert.equal(distances(continues).length, 1);
    const noTopicAfter =
      "当社は、首都圏を中心に家庭用の調理器具と収納用品の製造及び販売並びにこれらに付随する保守点検の業務を営んでおりますが、調理器具以外の製品の売上の割合が小さいため、製品区分別の生産実績及び販売実績を記載しておりません。";
    assert.equal(distances(noTopicAfter).length, 1);
    const sameTopicGoesOn =
      "当社は、首都圏を中心に家庭用の調理器具と収納用品の製造及び販売並びにこれらに付随する保守点検の業務を営んでおりますが、地方の販売店とも取引を広げ、新しい顧客を開拓する計画は来期に策定する予定です。";
    assert.equal(distances(sameTopicGoesOn).length, 1);
  });

  it("「〜ましたが、」の直後に名前の新しい主題（〜大臣は）が立ち、文末までその主題の話なら、「〜ましたが」までを数える（内閣府の記者会見）", () => {
    const press =
      "また、石破総理大臣は、昨日25日に、アメリカ軍の艦船の日本での修理や、砕氷船に関する協力の推進を検討していく考えを明らかにしましたが、赤澤大臣は造船分野でのアメリカとの協力の在り方や必要性についてどのように考えているかお願いします。";
    assert.deepEqual(distances(press, "speech/transcript"), []);
  });

  it("名前の新しい主題の後ろに別の主語（〜が）が続く文は、文末まで数える（自作）", () => {
    const later =
      "当社の社長は、昨年の株主総会で、首都圏の物流拠点の再編と海外の販売網の拡充と新しい製品群の開発を三年で進める計画を明らかにしましたが、営業部長は、その後の需要の落ち込みを受けて、計画の一部の見直しが必要だと述べています。";
    assert.equal(distances(later).length, 1);
  });

  it("主題と「〜ましたが、」の間に別の主語（〜が）があれば、その述語は主題のものではないので文末まで数える（自作）", () => {
    const results =
      "当期の業績は、東北と北陸の一部の地域で長雨と天候不順による季節商品の需要の落ち込みがありましたが、首都圏の新しい店舗の売上が大きく伸びたことにより、売上高と営業利益はいずれも前期を上回る水準となりました。";
    assert.equal(distances(results).length, 1);
  });
});

describe("topic-predicate-distance: 後ろの節の主語", () => {
  it("「〜の大半は」「〜のほとんどは」も後ろの節の主語として読む（自作）", () => {
    const narrowed =
      "この装置は古い型であるため、これらの部品のほとんどはもう製造元では作られておらず、修理のたびに中古の市場で探すか、同じ働きをする別の部品を取り寄せて、一つずつ合うかどうかを確かめながら長く使い続けています。";
    assert.deepEqual(distances(narrowed), []);
    const same =
      "この装置は古い型であるため、部品を取り寄せるたびに、製造元に在庫を問い合わせたり、中古の市場で探したり、同じ働きをする別の部品を取り寄せたりして、合うかどうかを一つずつ確かめながら長い時間をかけて修理しています。";
    assert.equal(distances(same).length, 1);
  });
});

describe("topic-predicate-distance: 書き手の文でないもの", () => {
  it("法令でも契約でもない文書が引いた条文は数えない（特許庁）", () => {
    const article =
      "第9条 特許庁長官は、その登録を受けた者（以下「登録情報処理機関」という。）に、第6条第3項若しくは前条第1項の規定によるファイルへの記録、第7条第1項の規定による磁気ディスクへの記録又はこれらの記録に必要な情報の入力（入力のための準備作業を含む。）、編集若しくはこれらに類する処理（以下「情報処理業務」という。）の全部又は一部を行わせることができる。";
    assert.deepEqual(distances(article, "docs/manual"), []);
    assert.equal(distances(article.replace("第9条 ", ""), "docs/manual").length, 1);
  });

  it("法令の文書では条文がその文書の文なので、法令の上限で数える（自作）", () => {
    const long = `第三条\u3000事業者は、${"利用者から求めがあったときは、その求めに係る記録を確認し、".repeat(7)}遅滞なく、その結果を通知しなければならない。`;
    assert.equal(distances(long, "legal/statute").length, 1);
  });

  it("条の行が続いて法令として読む文書は、ジャンルが法令でなくても条文を数える（自作）", () => {
    const article = `事業者は、${"利用者から求めがあったときは、その求めに係る記録を確認し、".repeat(3)}遅滞なく、その結果を通知しなければならない。`;
    const statute = ["第一条\u3000この規則は、記録の扱いを定める。", "第二条\u3000記録は、五年間保存する。", `第三条\u3000${article}`].join("\n\n");
    assert.equal(distances(statute, "docs/manual").length, 1);
  });

  it("一行に詰まった箇条（〜させる ③ 次の項目）は、述語の後ろの番号で項目が終わる（自作）", () => {
    const run =
      "・通信関連は製品開発、工法改善を通じ、生産効率を向上させる ③\u3000自動車関連既存事業（産業構造の変化に対応・収益力改善）\u3000電動車の需要増加が予想される中で、当社の自動車関連既存事業のうちエンジンやミッション系精密機能部品は、二〇三〇年以降の減少を見据える必要があります。";
    assert.deepEqual(distances(run), []);
    const numbered =
      "当社は、③の項目に挙げた自動車関連既存事業について、電動車の需要増加が予想される中で、エンジンやミッション系の精密機能部品の生産を段階的に縮小しながら、新しい製品の開発と生産の体制を二〇三〇年までに整える計画です。";
    assert.equal(distances(numbered).length, 1);
  });
});
