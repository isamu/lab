import type { Detector, Finding, Lexicon, Token } from "../plugin.ts";
import {
  contentCount,
  exampleEnd,
  firstAt,
  firstContent,
  firstNoun,
  hasAdposition,
  hasContent,
  hasDeterminer,
  hasListConjunction,
  hasParticiple,
  hasVerb,
  isClause,
  isModifiedNoun,
  isModifier,
  isParticiple,
  isPluralNounPhrase,
  itemAfter,
  lastContent,
  lastNoun,
  leadShape,
  openingKind,
  openingOf,
  participleOpening,
  shapeOf,
} from "./list-item.ts";
import { listReader, type ItemList } from "./list-items.ts";
import { APPOSITIVE_ANCHOR, isListConjunction, listSentenceOf, VERBAL, type ItemScope, type ListWords } from "./list-sentence.ts";
import {
  after,
  contentOnlyWith,
  every,
  findAfterFirst,
  findLast,
  firstOf,
  lastOf,
  sameShapes,
  secondLastOf,
  secondOf,
  sizeOf,
  some,
  wholeList,
  withoutFirst,
  type View,
} from "./list-view.ts";
import { lowerBound, type TokenRange } from "./token-column.ts";

const EMPTY: TokenRange = { start: 0, end: 0 };

const commaBefore = (scope: ItemScope, at: number): boolean => scope.sentence.tokens[at - 1]?.surface === ",";

/**
 * 導入の句（After the review, / If it fails, / Finally, / To test it, / Based on the review,）は並列の項目ではない。
 * 節の最初の項目が前置詞・接続詞・副詞・to・過去分詞で始まり、次の項目と頭の形が違えば外す。
 * Quickly, quietly and carefully は残る。For managers, engineers and designers, も外れるが、前置詞のあとの名詞を
 * 項目と読むと、Over this period, the subcommittees and the full committee ... を並びと誤る。こちらのほうが多い。
 */
const LEAD_POS = new Set(["ADP", "SCONJ", "ADV", "PART"]);

const withoutLead = (view: View): View => {
  const { scope } = view.list;
  const [first, second] = [firstOf(view), secondOf(view)];
  const opening = first === undefined ? undefined : openingOf(scope, first.item);
  if (first === undefined || second === undefined || opening === undefined) return view;
  if (!LEAD_POS.has(opening.pos) && !isParticiple(opening)) return view;
  return openingKind(scope, first.item) === openingKind(scope, second.item) ? view : withoutFirst(view);
};

/**
 * and / or で始まる項目で、前の並びは閉じている（offering, giving, or receiving, directly or indirectly）。
 * 次の並びはその項目から始まる。項目が動詞で始まれば、その目的語から（Develop, maintain, and track courses, materials and events）。
 * 項目が残らなければ、後ろは新しい句の頭。導入の句（directly or indirectly,）を外す。
 */
const afterClosedList = (view: View): View => {
  const closing = findLast(view, "closed");
  if (closing === undefined) return view;
  const { scope } = view.list;
  const conjunction = firstAt(scope, "conjunction", closing.item);
  const body = { start: conjunction === -1 ? closing.item.start : conjunction + 1, end: closing.item.end };
  const head = firstAt(scope, "content", body);
  const rest = VERBAL.has(scope.sentence.tokens[head]?.pos ?? "") ? { start: head + 1, end: body.end } : body;
  return hasContent(scope, rest) ? { ...after(view, closing), pre: rest } : withoutLead(after(view, closing));
};

/**
 * 例の句（such as / including / e.g.）のあとが並び。句の前の項目は並びではない（the screen lock on your phone, such as a PIN or
 * phone-based fingerprint は 2 つ）。句の中の項目の形が揃わなければ句で切らない（materials such as green steel, utilizing ..., and
 * adopting ... / (e.g., by location, contract type, or contract preference)）。句の中に and / or があれば句はもう閉じていて、
 * 句ごと 1 つの項目（apples, oranges such as navels and mandarins, and pears）。
 */
const fromExample = (view: View): View => {
  const phrase = findLast(view, "example");
  if (phrase === undefined) return view;
  const { scope } = view.list;
  const examples = { start: exampleEnd(scope, phrase.item), end: phrase.item.end };
  if (hasListConjunction(scope, examples)) return view;
  const inPhrase = contentOnlyWith(after(view, phrase), examples);
  return sameShapes(inPhrase) ? inPhrase : view;
};

/** 解析器は過去形と過去分詞（fixed）を見分けられない。動詞のある項目のあとの「過去分詞」の並びは、述語の並びと読む。 */
const pastPredicates = (scope: ItemScope, first: TokenRange, form: string, afterItem: TokenRange): boolean =>
  form === "Part" && participleOpening(scope, afterItem)?.form === "Part" && hasVerb(scope, first);

/**
 * 最初より後ろの項目が分詞で始まるとき。最初の項目にも同じ形の分詞があれば分詞の並び
 * （are hiring engineers, buying laptops and renting desks / Tested, reviewed and approved）。後ろの項目が動詞で始まれば述語の並びで、
 * 分詞は解析器の読み違い（the jury, cross-examined the witnesses, presented witnesses, and made）。そうでなければ分詞の句
 * （from Latin, meaning ship or boat / the judge, sitting without a jury, and sentenced）で、並びがあるならその句の中から始まる。
 * 分詞より前の項目と分詞そのものは項目ではない（programs, including the office, the desk and the team）。句の中の項目の形が揃わなければ
 * 句は挿入で、並びは句の後ろだけ（relief, including an injunction, in any court ... and without / including before the date, to a
 * Recipient ... “confidential”, “proprietary”, or the like）。
 */
const fromParticiplePhrase = (view: View, afterItem: TokenRange): View => {
  const { scope } = view.list;
  const [first, phrase] = [firstOf(view), findAfterFirst(view, "participle")];
  const opening = phrase === undefined ? undefined : participleOpening(scope, phrase.item);
  if (first === undefined || phrase === undefined || opening === undefined) return view;
  const rest = after(view, phrase);
  const predicates = some(rest, "verbalShape") || pastPredicates(scope, first.item, opening.form, afterItem);
  if (hasParticiple(scope, first.item, opening.form) || predicates) return view;
  const inPhrase = withoutLead(contentOnlyWith(rest, { start: opening.at + 1, end: phrase.item.end }));
  return sameShapes(inPhrase) ? inPhrase : rest;
};

/**
 * 名詞のすぐ後ろの、読点で挟まれた X and Y は同格（two HPV types, HPV16 and HPV18, that account / Governments, both state and
 * federal, spend）。項目が 2 つに見え、and の前に読点が無く、and の後ろの項目が読点で閉じ、後ろの 2 つに動詞が無いときに同格と読む。
 * 2 つを結ぶ同格に Oxford comma は打たないので、and の前に読点があれば 3 つの並び（the subcommittee, full committee, and
 * chamber levels, as well as）。読点の無い本当の並び（apples, pears and plums, then ...）はこの形と見分けられず、判定から外れる。
 * 閉じた読点のあとに and / or が続くなら、並びのあとに節をつないでいる（apples, pears and plums, and went home）。
 */
const isAppositive = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean => {
  const [anchor, head] = [firstOf(view), secondOf(view)];
  if (sizeOf(view) !== 2 || anchor === undefined || head === undefined || commaBefore(scope, at)) return false;
  const end = afterItem.end;
  const joinsClause = isListConjunction(scope.sentence.tokens[end + 1]);
  const closed = scope.sentence.tokens[end]?.surface === "," && scope.sentence.depths[end] === scope.sentence.depths[at] && !joinsClause;
  return closed && APPOSITIVE_ANCHOR.has(lastContent(scope, anchor.item)?.pos ?? "") && !hasVerb(scope, head.item) && !hasVerb(scope, afterItem);
};

/**
 * and の後ろの項目に読点と、同じ形の項目を連れた and / or が続くなら、この and は項目の中にある（searches and seizures, and
 * the Eighth's ban）。頭の形か、節かどうかが違えば別の節をつなぐ and で、この and までが並び（apples, pears and plums, and went home / and figs fell）。
 */
const listContinues = (scope: ItemScope, afterItem: TokenRange): boolean => {
  const next = afterItem.end;
  if (scope.sentence.tokens[next]?.surface !== "," || !isListConjunction(scope.sentence.tokens[next + 1])) return false;
  const following = itemAfter(scope, next + 1);
  const shape = leadShape(scope, following);
  return shape !== undefined && shape === leadShape(scope, afterItem) && isClause(scope, following) === isClause(scope, afterItem);
};

/**
 * 語のあとが複数形の名詞句なら、語は名詞にかかる語で、2 つはもう揃っている（the renderer in both modes and the exporter）。
 * and の後ろも冠詞の無い複数形の名詞句なら、2 つを結ぶ語（both project goals and business goals）。
 */
const pairComplete = (scope: ItemScope, member: TokenRange, afterItem: TokenRange): boolean => {
  const end = firstAt(scope, "conjunction", afterItem);
  const partner = end === -1 ? afterItem : { start: afterItem.start, end };
  return isPluralNounPhrase(scope, member) && !(isPluralNounPhrase(scope, partner) && !hasDeterminer(scope, partner));
};

/**
 * 最後の項目に 2 つだけを結ぶ語（between / either）があり、この接続詞がその語の相手で（between … and / either … or）、そのあとに
 * and / or がまだ無く、読点も無ければ、この and / or はその 2 つを結ぶ（the Key Terms between Provider and Customer, and any policies）。
 * 相手でなければ語は名詞にかかるだけ（the impact of either option and implementation）。括弧の中の語は外の接続詞と組まない。
 */
const pairsInLastItem = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean => {
  const last = lastOf(view)?.item ?? EMPTY;
  const conjunction = scope.sentence.tokens[at]?.surface.toLowerCase() ?? "";
  const openers = scope.sentence.pairOpeners.get(conjunction)?.get(scope.sentence.depths[at] ?? 0) ?? [];
  const opener = openers[lowerBound(openers, last.end) - 1] ?? -1;
  if (opener < last.start || commaBefore(scope, at)) return false;
  const member = { start: opener + 1, end: last.end };
  return !pairComplete(scope, member, afterItem) && !hasListConjunction(scope, member);
};

/**
 * 修飾語 1 つだけの項目と、修飾語で始まる名詞句を結ぶ and / or は、2 つの修飾語が名詞を共有している（natural and artificial flavor /
 * registered or certified mail）。前の項目も修飾語で終われば、修飾語の並び（red, white and blue flags）。and / or の前に読点があれば、
 * 項目の区切り（Federal government, military, and agricultural workers）。
 */
const sharesNoun = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean => {
  const [previous, last] = [secondLastOf(view), lastOf(view)];
  if (commaBefore(scope, at) || previous === undefined || last === undefined || contentCount(scope, last.item) !== 1) return false;
  return isModifier(firstContent(scope, last.item)) && !isModifier(lastContent(scope, previous.item)) && isModifiedNoun(scope, afterItem);
};

/**
 * and / or の後ろの最初の名詞が、最後の項目の前置詞の目的語と同じ品詞で、どの項目の頭とも違う（chat in Slack or Google Hangouts /
 * Teams (beta): 固有名詞どうし）。頭と同じ品詞なら項目とも読める（petitions for waivers and appeals）ので、並びのまま。
 */
const likeLastObject = (scope: ItemScope, view: View, afterItem: TokenRange): boolean => {
  const kind = firstNoun(scope, afterItem)?.pos;
  if (kind === undefined) return false;
  return lastNoun(scope, lastOf(view)?.item ?? EMPTY)?.pos === kind && every(view, kind === "NOUN" ? "notNounHead" : "notProperNounHead");
};

/**
 * どの項目も前置詞の句を連れ、and / or の後ろだけが連れておらず、その目的語に似ていれば、and / or は最後の項目の前置詞の目的語を結ぶ
 * （updates on the Google Doc, chat in Slack or Google Hangouts は 2 つ）。and / or の前に読点があれば、項目の区切りなので並び。
 */
const joinsObjects = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean =>
  !commaBefore(scope, at) &&
  every(view, "prepositionalTail") &&
  !hasAdposition(scope, afterItem) &&
  !hasVerb(scope, afterItem) &&
  likeLastObject(scope, view, afterItem);

/** and / or が並びの最後の継ぎ目ではなく、最後の項目の中にある。 */
const insideLastItem = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean =>
  pairsInLastItem(scope, at, view, afterItem) || sharesNoun(scope, at, view, afterItem) || joinsObjects(scope, at, view, afterItem);

/**
 * 節を並べるなら、どの項目も節。Additionally, others can learn, and the mistake is rarer. の Additionally は項目ではなく、
 * and の前の読点は節をつなぐ読点。名詞の並びは最初の項目に前置き（We shipped the parser）を抱えるので、この確かめは節の並びだけにする。
 * and の後ろだけが節なのは主語の並び（The parser, the renderer and the exporter shipped.）なので外さない。
 * 動詞で始まる項目を並べるなら、どの項目にも動詞がある。The scope, in contrast, is larger, and covers ... の The scope は項目ではない。
 */
const itemsAgree = (scope: ItemScope, view: View, afterItem: TokenRange, shape: string): boolean => {
  const last = lastOf(view);
  const clausesAgree = last === undefined || !isClause(scope, last.item) || (isClause(scope, afterItem) && every(view, "isClause"));
  return clausesAgree && (!VERBAL.has(shape) || every(view, "hasVerb"));
};

/**
 * 読点で区切った項目が and / or の前に 2 つ以上あり、最後の項目と and の後ろが同じ形のときだけ並列。
 * 導入の読点（After the review, the team fixed the bug and shipped it.）や、節をつなぐ読点
 * （We tested it, and the team shipped it.）は、Oxford comma を打つかどうかの選択を見せない。
 * 題名の読点は題名を付けた人のもの。書き手の流儀の票にしない。
 */
const listAt = (list: ItemList, at: number): boolean | undefined => {
  const { scope } = list;
  const afterItem = itemAfter(scope, at);
  const items = fromParticiplePhrase(fromExample(afterClosedList(withoutLead(wholeList(list)))), afterItem);
  if (listContinues(scope, afterItem) || isAppositive(scope, at, items, afterItem) || insideLastItem(scope, at, items, afterItem)) return undefined;
  const last = lastOf(items);
  const shape = last === undefined ? undefined : shapeOf(scope, last.item);
  if (sizeOf(items) < 2 || shape === undefined || shape !== shapeOf(scope, afterItem)) return undefined;
  return itemsAgree(scope, items, afterItem, shape) ? commaBefore(scope, at) : undefined;
};

const isJudgedConjunction = (token: Token, at: number): boolean => at > 0 && isListConjunction(token);

/**
 * 文の and / or ごとの、並びの判定（読点を打てば true、打たなければ false、並びでなければ undefined）。文は一度だけ読み、
 * 項目は and / or の位置まで読み進めた並びから取る。
 */
export const listVerdicts = (tokens: readonly Token[], words: ListWords, source: string): (boolean | undefined)[] => {
  if (!tokens.some(isJudgedConjunction)) return [];
  const sentence = listSentenceOf(tokens, words, source);
  const readItems = listReader(sentence);
  return tokens.flatMap((token, at) => {
    if (!isJudgedConjunction(token, at)) return [];
    return [sentence.inCitedTitle(at) ? undefined : listAt(readItems(at), at)];
  });
};

/**
 * 3 つ以上の並列の最後の and / or の前に読点を打つか。Oxford comma。
 *
 * どちらが正しいかは決めない。スタイルガイドで割れる論点に立場を取ると rule ごと無視される。
 * 見るのは 1 つの文書で揃っているかだけ。spec §12.3。最初に判定できた並びで決める。
 */
const oxfordIn = (tokens: readonly Token[], words: ListWords, source: string): boolean | undefined =>
  listVerdicts(tokens, words, source).find((verdict) => verdict !== undefined);

const patternsOf = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern.toLowerCase()));

export const oxfordComma: Detector = (doc, options): Finding[] => {
  const words = {
    participle: patternsOf(doc.lexicons["participle-word"]),
    example: doc.lexicons["example-marker"] ?? [],
    pair: patternsOf(doc.lexicons["pair-opener"]),
    region: doc.lexicons["place-region"] ?? [],
  };
  const judged = doc.sentences.flatMap((sentence) => {
    const oxford = oxfordIn(sentence.tokens ?? [], words, doc.source);
    return oxford === undefined ? [] : [{ sentence, oxford }];
  });
  const withComma = judged.filter((entry) => entry.oxford).length;
  const minorityUsesComma = withComma <= judged.length - withComma;
  const few = minorityUsesComma ? withComma : judged.length - withComma;
  // 同数なら少数派は無い。
  if (few === 0 || few * 2 === judged.length || few > options.limit) return [];
  return judged
    .filter((entry) => entry.oxford === minorityUsesComma)
    .map(({ sentence }) => ({
      rule: "oxford-comma-consistency",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count: few, limit: options.limit, offset: sentence.span.start },
    }));
};
