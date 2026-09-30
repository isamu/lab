import type { Detector, Finding, Lexicon, Token } from "../plugin.ts";

const LIST_CONJUNCTION = new Set(["and", "or"]);

const isComma = (token: Token): boolean => token.surface === ",";

const commaBefore = (tokens: readonly Token[], at: number): boolean => tokens[at - 1]?.surface === ",";

/** 並列はこれをまたがない。セミコロンの前後は別の節。 */
const CLAUSE_BREAK = new Set([";", ":", "—"]);

/** 各 token の前で閉じていない括弧の数。括弧の中の読点（external users (e.g., guests), and ...）は外の並列を切らない。 */
const PAREN_STEP: Readonly<Record<string, number>> = { "(": 1, ")": -1 };

const depthsOf = (tokens: readonly Token[]): number[] =>
  tokens.reduce<{ depths: number[]; open: number }>(
    (acc, token) => ({ depths: [...acc.depths, acc.open], open: Math.max(0, acc.open + (PAREN_STEP[token.surface] ?? 0)) }),
    { depths: [], open: 0 },
  ).depths;

/**
 * 並びを読むための語彙表。participle は解析器が分詞と読まないが読点のあとで分詞の句を始める語（meaning）、
 * example は例を挙げる句（such as, e.g.）、pair は 2 つだけを結ぶ語（between）。
 */
type ListWords = { readonly participle: ReadonlySet<string>; readonly example: Lexicon; readonly pair: ReadonlySet<string> };

type Clause = { readonly tokens: readonly Token[]; readonly depths: readonly number[]; readonly words: ListWords };

/** 冠詞や引用符を飛ばした、項目の頭の品詞。the parser と an exporter と samples を同じ形と見る。 */
const NOMINAL = new Set(["NOUN", "PROPN", "PRON", "NUM", "ADJ"]);

const isContent = (token: Token): boolean => token.pos !== "DET" && token.pos !== "PUNCT" && token.pos !== "X";

const shapeOf = (item: readonly Token[]): string | undefined => {
  const head = item.find(isContent);
  if (head === undefined) return undefined;
  return NOMINAL.has(head.pos) ? "NOMINAL" : head.pos;
};

const VERBAL = new Set(["VERB", "AUX"]);

/** 主語と述語のある項目。the team fixed the bug / these are crucial。gets us more は述語だけ。 */
const isClause = (item: readonly Token[]): boolean => {
  const first = item.find((token) => token.pos !== "PUNCT" && token.pos !== "X");
  if (first === undefined || !(first.pos === "DET" || NOMINAL.has(first.pos))) return false;
  return item.some((token) => token !== first && VERBAL.has(token.pos));
};

/** 節の頭から and / or の手前までを、同じ深さの読点で項目に切る。Oxford comma の読点のあとは空なので項目にならない。 */
const itemsBefore = (clause: Clause, at: number): Token[][] => {
  const level = clause.depths[at] ?? 0;
  const start = clause.tokens.slice(0, at).findLastIndex((token) => CLAUSE_BREAK.has(token.surface)) + 1;
  return clause.tokens
    .slice(start, at)
    .reduce<Token[][]>(
      (items, token, offset) => {
        if (isComma(token) && clause.depths[start + offset] === level) return [...items, []];
        return [...items.slice(0, -1), [...(items.at(-1) ?? []), token]];
      },
      [[]],
    )
    .filter((item) => item.length > 0);
};

/**
 * and / or で始まる項目で、前の並びは閉じている（offering, giving, or receiving, directly or indirectly）。
 * 次の並びはその項目から始まる。項目が動詞で始まれば、その目的語から（Develop, maintain, and track courses, materials and events）。
 */
const afterClosedList = (items: readonly Token[][]): Token[][] => {
  const closed = items.findLastIndex((item) => LIST_CONJUNCTION.has(openingOf(item)?.surface.toLowerCase() ?? ""));
  const closing = items[closed];
  if (closing === undefined) return [...items];
  const body = closing.slice(closing.findIndex((token) => LIST_CONJUNCTION.has(token.surface.toLowerCase())) + 1);
  const head = body.findIndex(isContent);
  const rest = VERBAL.has(body[head]?.pos ?? "") ? body.slice(head + 1) : body;
  // 項目が残らなければ、後ろは新しい句の頭。導入の句（directly or indirectly,）を外す。
  return rest.some(isContent) ? [rest, ...items.slice(closed + 1)] : [...withoutLead(items.slice(closed + 1))];
};

/** and / or の後ろの項目。次の読点か節の切れ目まで。 */
const itemAfter = (tokens: readonly Token[], at: number): Token[] => {
  const end = tokens.findIndex((token, index) => index > at && (isComma(token) || CLAUSE_BREAK.has(token.surface)));
  return tokens.slice(at + 1, end === -1 ? undefined : end);
};

/**
 * 導入の句（After the review, / If it fails, / Finally, / To test it, / Based on the review,）は並列の項目ではない。
 * 節の最初の項目が前置詞・接続詞・副詞・to・過去分詞で始まり、次の項目と頭の形が違えば外す。
 * Quickly, quietly and carefully は残る。For managers, engineers and designers, も外れるが、前置詞のあとの名詞を
 * 項目と読むと、Over this period, the subcommittees and the full committee ... を並びと誤る。こちらのほうが多い。
 */
const LEAD_POS = new Set(["ADP", "SCONJ", "ADV", "PART"]);

const isParticiple = (token: Token): boolean => token.features?.["VerbForm"] === "Part";

const openingOf = (item: readonly Token[]): Token | undefined => item.find((token) => token.pos !== "PUNCT" && token.pos !== "X");

const openingKind = (item: readonly Token[]): string | undefined => {
  const opening = openingOf(item);
  return opening !== undefined && isParticiple(opening) ? "PARTICIPLE" : shapeOf(item);
};

const withoutLead = (items: readonly Token[][]): readonly Token[][] => {
  const [first, second] = items;
  const opening = first === undefined ? undefined : openingOf(first);
  if (first === undefined || second === undefined || opening === undefined) return items;
  if (!LEAD_POS.has(opening.pos) && !isParticiple(opening)) return items;
  return openingKind(first) === openingKind(second) ? items : items.slice(1);
};

/**
 * 形容詞のあとの読点は、名詞の前で形容詞を重ねているだけのことが多い（the long, winding bridge）。
 * 次の項目が名詞で終わるならつなげ直す。形容詞そのものの並び（quick, cheap and reliable）は切ったまま。
 */
const lastContent = (item: readonly Token[]): Token | undefined => item.findLast(isContent);

const joinAdjectives = (items: readonly Token[][]): Token[][] =>
  items.reduce<Token[][]>((joined, item) => {
    const previous = joined.at(-1);
    const stacked = previous !== undefined && lastContent(previous)?.pos === "ADJ" && lastContent(item)?.pos !== "ADJ";
    if (stacked) joined[joined.length - 1] = [...previous, ...item];
    else joined.push(item);
    return joined;
  }, []);

/**
 * 節を並べるなら、どの項目も節。Additionally, others can learn, and the mistake is rarer. の
 * Additionally は項目ではなく、and の前の読点は節をつなぐ読点。名詞の並びは最初の項目に前置き
 * （We shipped the parser）を抱えるので、この確かめは節の並びだけにする。
 * and の後ろだけが節なのは主語の並び（The parser, the renderer and the exporter shipped.）なので外さない。
 */
const clausesAgree = (items: readonly Token[][], after: readonly Token[]): boolean => {
  const last = items.at(-1);
  if (last === undefined || !isClause(last)) return true;
  return isClause(after) && items.every(isClause);
};

/**
 * 動詞で始まる項目を並べるなら、どの項目にも動詞がある。The scope, in contrast, is larger, and covers ... の
 * The scope は項目ではなく、後ろの述語の主語。
 */
const hasVerb = (item: readonly Token[]): boolean => item.some((token) => VERBAL.has(token.pos));

const predicatesAgree = (items: readonly Token[][], shape: string): boolean => !VERBAL.has(shape) || items.every(hasVerb);

/** -ing 形（VerbForm=Ger）と過去分詞（Part）。filling the gaps と sentenced to prison は並べても並列にならない。 */
const VERB_FORMS = new Set(["Ger", "Part"]);

const verbFormOf = (token: Token): string | undefined => {
  const form = token.features?.["VerbForm"];
  return form !== undefined && VERB_FORMS.has(form) ? form : undefined;
};

/** 項目の頭の分詞とその形。副詞は飛ばす（originally written）。引用符の中の語（‘modelling’）は語の例なので分詞と読まない。 */
const participleOpening = (item: readonly Token[], words: ReadonlySet<string>): { readonly at: number; readonly form: string } | undefined => {
  const at = item.findIndex((token) => token.pos !== "PUNCT" && token.pos !== "ADV");
  const opening = item[at];
  if (opening === undefined) return undefined;
  const form = words.has(opening.surface.toLowerCase()) ? "Ger" : verbFormOf(opening);
  return form === undefined ? undefined : { at, form };
};

const hasParticiple = (item: readonly Token[], form: string): boolean => item.some((token) => verbFormOf(token) === form);

/**
 * 最初より後ろの項目が分詞で始まるとき。最初の項目にも同じ形の分詞があれば分詞の並び
 * （are hiring engineers, buying laptops and renting desks / Tested, reviewed and approved）。後ろの項目が動詞で始まれば述語の並びで、
 * 分詞は解析器の読み違い（the jury, cross-examined the witnesses, presented witnesses, and made）。そうでなければ分詞の句
 * （from Latin, meaning ship or boat / the judge, sitting without a jury, and sentenced）で、並びがあるならその句の中から始まる。
 * 分詞より前の項目と分詞そのものは項目ではない（programs, including the office, the desk and the team）。句の中の項目の形が揃わなければ
 * 句は挿入で、並びは句の後ろだけ（relief, including an injunction, in any court ... and without / including before the date, to a
 * Recipient ... “confidential”, “proprietary”, or the like）。
 */
/** 解析器は過去形と過去分詞（fixed）を見分けられない。動詞のある項目のあとの「過去分詞」の並びは、述語の並びと読む。 */
const pastPredicates = (first: readonly Token[], form: string, after: readonly Token[], words: ReadonlySet<string>): boolean =>
  form === "Part" && participleOpening(after, words)?.form === "Part" && hasVerb(first);

const fromParticiplePhrase = (items: readonly Token[][], after: readonly Token[], words: ReadonlySet<string>): readonly Token[][] => {
  const at = items.findIndex((item, index) => index > 0 && participleOpening(item, words) !== undefined);
  const phrase = items[at];
  const first = items[0];
  const opening = phrase === undefined ? undefined : participleOpening(phrase, words);
  if (first === undefined || phrase === undefined || opening === undefined) return items;
  const rest = items.slice(at + 1);
  const predicates = rest.some((item) => VERBAL.has(shapeOf(item) ?? "")) || pastPredicates(first, opening.form, after, words);
  if (hasParticiple(first, opening.form) || predicates) return items;
  const inPhrase = withoutLead([phrase.slice(opening.at + 1), ...rest].filter((item) => item.some(isContent)));
  return new Set(inPhrase.map(shapeOf)).size > 1 ? rest : inPhrase;
};

/** 大文字小文字も比べる。頭文字の E.G. Evans / I.E. Evans は e.g. / i.e. ではない。文頭の句の前には項目が無いので、大文字で始まる句は要らない。 */
const sameSurfaces = (tokens: readonly Token[], words: readonly Token[]): boolean =>
  tokens.length === words.length && words.every((word, index) => tokens[index]?.surface === word.surface);

/** 項目の中で、and / or と同じ深さにある最後の例の句（such as / e.g.）の直後の位置。無ければ -1。 */
const exampleEnd = (clause: Clause, level: number, item: readonly Token[]): number =>
  item.reduce((end, token, at) => {
    const words = clause.words.example.find(({ tokens = [] }) => tokens.length > 0 && sameSurfaces(item.slice(at, at + tokens.length), tokens))?.tokens ?? [];
    return words.length > 0 && clause.depths[clause.tokens.indexOf(token)] === level ? at + words.length : end;
  }, -1);

/**
 * 例の句（such as / including / e.g.）のあとが並び。句の前の項目は並びではない（the screen lock on your phone, such as a PIN or
 * phone-based fingerprint は 2 つ）。句の中の項目の形が揃わなければ句で切らない（materials such as green steel, utilizing ..., and
 * adopting ... / (e.g., by location, contract type, or contract preference)）。
 */
const fromExample = (clause: Clause, at: number, items: readonly Token[][]): readonly Token[][] => {
  const level = clause.depths[at] ?? 0;
  const phraseAt = items.findLastIndex((item) => exampleEnd(clause, level, item) !== -1);
  const phrase = items[phraseAt];
  if (phrase === undefined) return items;
  const rest = items.slice(phraseAt + 1);
  const inPhrase = [phrase.slice(exampleEnd(clause, level, phrase)), ...rest].filter((item) => item.some(isContent));
  return new Set(inPhrase.map(shapeOf)).size > 1 ? items : inPhrase;
};

const APPOSITIVE_ANCHOR = new Set(["NOUN", "PROPN"]);

/**
 * 名詞のすぐ後ろの、読点で挟まれた X and Y は同格（two HPV types, HPV16 and HPV18, that account / Governments, both state and
 * federal, spend）。項目が 2 つに見え、and の前に読点が無く、and の後ろの項目が読点で閉じ、後ろの 2 つに動詞が無いときに同格と読む。
 * 2 つを結ぶ同格に Oxford comma は打たないので、and の前に読点があれば 3 つの並び（the subcommittee, full committee, and
 * chamber levels, as well as）。読点の無い本当の並び（apples, pears and plums, then ...）はこの形と見分けられず、判定から外れる。
 */
const isAppositive = (clause: Clause, at: number, items: readonly Token[][], after: readonly Token[]): boolean => {
  const [anchor, head] = items;
  if (items.length !== 2 || anchor === undefined || head === undefined || commaBefore(clause.tokens, at)) return false;
  const end = at + 1 + after.length;
  // 閉じた読点のあとに and / or が続くなら、並びのあとに節をつないでいる（apples, pears and plums, and went home）。
  const joinsClause = LIST_CONJUNCTION.has(clause.tokens[end + 1]?.surface.toLowerCase() ?? "");
  const closed = clause.tokens[end]?.surface === "," && clause.depths[end] === clause.depths[at] && !joinsClause;
  return closed && APPOSITIVE_ANCHOR.has(lastContent(anchor)?.pos ?? "") && !hasVerb(head) && !hasVerb(after);
};

/** 副詞を飛ばした頭の形。explain and justify と ultimately ensure は同じ動詞の項目。 */
const leadShape = (item: readonly Token[]): string | undefined => shapeOf(item.filter((token) => token.pos !== "ADV"));

/**
 * and の後ろの項目に読点と、同じ形の項目を連れた and / or が続くなら、この and は項目の中にある（searches and seizures, and
 * the Eighth's ban）。頭の形か、節かどうかが違えば別の節をつなぐ and で、この and までが並び（apples, pears and plums, and went home / and figs fell）。
 */
const listContinues = (clause: Clause, at: number, after: readonly Token[]): boolean => {
  const next = at + 1 + after.length;
  if (clause.tokens[next]?.surface !== "," || !LIST_CONJUNCTION.has(clause.tokens[next + 1]?.surface.toLowerCase() ?? "")) return false;
  const following = itemAfter(clause.tokens, next + 1);
  const shape = leadShape(following);
  return shape !== undefined && shape === leadShape(after) && isClause(following) === isClause(after);
};

/**
 * 最後の項目に 2 つだけを結ぶ語（between / both）があり、そのあとに and / or がまだ無ければ、この and / or はその 2 つを結ぶ
 * （the Key Terms between Provider and Customer, and any policies）。
 */
const pairsInLastItem = (clause: Clause, items: readonly Token[][]): boolean => {
  const last = items.at(-1) ?? [];
  const opener = last.findLastIndex((token) => clause.words.pair.has(token.surface.toLowerCase()));
  return opener !== -1 && !last.slice(opener).some((token) => LIST_CONJUNCTION.has(token.surface.toLowerCase()));
};

/** 名詞にかかる語。解析器は分詞を過去形とも読む（registered or certified mail の certified）ので、動詞も数える。 */
const MODIFIER = new Set(["ADJ", "VERB"]);

const isModifier = (token: Token | undefined): boolean => token?.pos === "ADJ" || (token !== undefined && isParticiple(token));

const NOUN_PHRASE_TAIL = new Set(["ADJ", "NOUN", "PROPN"]);

/** 修飾語と名詞だけの句（certified mail / artificial flavor）。冠詞や目的語を連れた動詞（adopt their resources）は違う。 */
const isModifiedNoun = (item: readonly Token[]): boolean => {
  const [head, ...tail] = item.filter((token) => token.pos !== "PUNCT" && token.pos !== "X");
  return (
    MODIFIER.has(head?.pos ?? "") && tail.length > 0 && tail.every((token) => NOUN_PHRASE_TAIL.has(token.pos)) && APPOSITIVE_ANCHOR.has(tail.at(-1)?.pos ?? "")
  );
};

/**
 * 修飾語 1 つだけの項目と、修飾語で始まる名詞句を結ぶ and / or は、2 つの修飾語が名詞を共有している（natural and artificial flavor /
 * registered or certified mail）。前の項目も修飾語で終われば、修飾語の並び（red, white and blue flags）。and / or の前に読点があれば、
 * 項目の区切り（Federal government, military, and agricultural workers）。
 */
const sharesNoun = (clause: Clause, at: number, items: readonly Token[][], after: readonly Token[]): boolean => {
  const [previous, last] = items.slice(-2);
  const lone = (last ?? []).filter(isContent);
  if (commaBefore(clause.tokens, at) || previous === undefined || lone.length !== 1) return false;
  return isModifier(lone[0]) && !isModifier(lastContent(previous)) && isModifiedNoun(after);
};

/** 頭の語のあとに前置詞の句を連れた項目（updates on the Google Doc）。 */
const hasPrepositionalTail = (item: readonly Token[]): boolean => {
  const head = item.findIndex(isContent);
  return item.some((token, index) => index > head && token.pos === "ADP");
};

/**
 * and / or の後ろの最初の名詞が、最後の項目の前置詞の目的語と同じ品詞で、どの項目の頭とも違う（chat in Slack or Google Hangouts /
 * Teams (beta): 固有名詞どうし）。頭と同じ品詞なら項目とも読める（petitions for waivers and appeals）ので、並びのまま。
 */
const isNoun = (token: Token): boolean => APPOSITIVE_ANCHOR.has(token.pos);

const lastNoun = (item: readonly Token[]): Token | undefined => item.findLast(isNoun);

const likeLastObject = (items: readonly Token[][], after: readonly Token[]): boolean => {
  const kind = after.find(isNoun)?.pos;
  return kind !== undefined && lastNoun(items.at(-1) ?? [])?.pos === kind && items.every((item) => item.find(isContent)?.pos !== kind);
};

/**
 * どの項目も前置詞の句を連れ、and / or の後ろだけが連れておらず、その目的語に似ていれば、and / or は最後の項目の前置詞の目的語を結ぶ
 * （updates on the Google Doc, chat in Slack or Google Hangouts は 2 つ）。and / or の前に読点があれば、項目の区切りなので並び。
 */
const joinsObjects = (clause: Clause, at: number, items: readonly Token[][], after: readonly Token[]): boolean =>
  !commaBefore(clause.tokens, at) &&
  items.every(hasPrepositionalTail) &&
  !after.some((token) => token.pos === "ADP") &&
  !hasVerb(after) &&
  likeLastObject(items, after);

/** and / or が並びの最後の継ぎ目ではなく、最後の項目の中にある。 */
const insideLastItem = (clause: Clause, at: number, items: readonly Token[][], after: readonly Token[]): boolean =>
  pairsInLastItem(clause, items) || sharesNoun(clause, at, items, after) || joinsObjects(clause, at, items, after);

/**
 * 読点で区切った項目が and / or の前に 2 つ以上あり、最後の項目と and の後ろが同じ形のときだけ並列。
 * 導入の読点（After the review, the team fixed the bug and shipped it.）や、節をつなぐ読点
 * （We tested it, and the team shipped it.）は、Oxford comma を打つかどうかの選択を見せない。
 */
const listAt = (clause: Clause, at: number): boolean | undefined => {
  const after = itemAfter(clause.tokens, at);
  const listed = fromExample(clause, at, afterClosedList(withoutLead(joinAdjectives(itemsBefore(clause, at)))));
  const items = fromParticiplePhrase(listed, after, clause.words.participle);
  if (listContinues(clause, at, after) || isAppositive(clause, at, items, after) || insideLastItem(clause, at, items, after)) return undefined;
  const last = items.at(-1);
  const shape = last === undefined ? undefined : shapeOf(last);
  if (items.length < 2 || shape === undefined || shape !== shapeOf(after)) return undefined;
  if (!clausesAgree(items, after) || !predicatesAgree(items, shape)) return undefined;
  return commaBefore(clause.tokens, at);
};

/**
 * 3 つ以上の並列の最後の and / or の前に読点を打つか。Oxford comma。
 *
 * どちらが正しいかは決めない。スタイルガイドで割れる論点に立場を取ると rule ごと無視される。
 * 見るのは 1 つの文書で揃っているかだけ。spec §12.3。
 */
const oxfordIn = (tokens: readonly Token[], words: ListWords): boolean | undefined => {
  const clause = { tokens, depths: depthsOf(tokens), words };
  return tokens.reduce<boolean | undefined>(
    (found, token, at) => found ?? (at > 0 && LIST_CONJUNCTION.has(token.surface.toLowerCase()) ? listAt(clause, at) : undefined),
    undefined,
  );
};

const patternsOf = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern.toLowerCase()));

export const oxfordComma: Detector = (doc, options): Finding[] => {
  const words = {
    participle: patternsOf(doc.lexicons["participle-word"]),
    example: doc.lexicons["example-marker"] ?? [],
    pair: patternsOf(doc.lexicons["pair-opener"]),
  };
  const judged = doc.sentences.flatMap((sentence) => {
    const oxford = oxfordIn(sentence.tokens ?? [], words);
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
