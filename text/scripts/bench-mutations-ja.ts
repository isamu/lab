// Seeded mistakes of Japanese wording for `yarn bench`: kanji adverbs, doubled honorifics, overused humble forms,
// glued kanji, middle-dot lists, agentless passives and a doubled particle. Pure and deterministic, like scripts/bench-mutations.ts.
import { isProse, linesOf, proseAt, rewriteFirst, type Plant, type PlantContext } from "./bench-text.ts";

type Swap = readonly [string, string];

/** 表の最初の対のうち、行にあるものを一か所だけ書き換える。 */
const swapFirst = (line: string, swaps: readonly Swap[]): string | undefined => {
  const pair = swaps.find(([from]) => line.includes(from));
  return pair === undefined ? undefined : line.replace(pair[0], pair[1]);
};

const plantSwap = (source: string, swaps: readonly Swap[]): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && swapFirst(line, swaps) !== undefined,
    (line) => swapFirst(line, swaps),
  );

// --- hiragana-fukushi ---

const KANA_ADVERBS: readonly Swap[] = [
  ["ほとんど", "殆ど"],
  ["もちろん", "勿論"],
  ["あらかじめ", "予め"],
  ["ちょうど", "丁度"],
  ["たくさん", "沢山"],
  ["しばらく", "暫く"],
];

/** ひらがなで書いた副詞を、表外の漢字にする。 */
export const kanjiAdverb = (source: string): Plant | undefined => plantSwap(source, KANA_ADVERBS);

// --- double-keigo ---

const HONORIFICS: readonly Swap[] = [
  ["おっしゃいま", "おっしゃられま"],
  ["ご覧になりま", "ご覧になられま"],
  ["拝見します", "拝見させていただきます"],
  ["伺います", "お伺いさせていただきます"],
];

/** 敬語を一つ重ねる。「伺います」を「お伺いさせていただきます」に。 */
export const doubleHonorific = (source: string): Plant | undefined => plantSwap(source, HONORIFICS);

// --- sasete-itadaku ---

// 漢語に続く「します」。「いたします」「ございます」は替えない。
const KANGO_VERB = /(?<=[一-龠々]{2})(します|しました)。/u;
const HUMBLE: Readonly<Record<string, string>> = { します: "させていただきます", しました: "させていただきました" };

const humble = (line: string): string => line.replace(KANGO_VERB, (_, ending: string) => `${HUMBLE[ending] ?? ending}。`);

/** 「漢語＋します」の文を、上限の数だけ「させていただきます」にする。上限に届く数が無ければ植えない。 */
export const humbleForms = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["sasete-itadaku"];
  if (limit === undefined) return undefined;
  const lines = linesOf(source);
  const isProseLine = proseAt(lines);
  const targets = lines.flatMap((line, index) => (isProseLine(index) && KANGO_VERB.test(line) ? [index] : [])).slice(0, limit);
  const first = targets[0];
  if (first === undefined || targets.length < limit) return undefined;
  return { source: lines.map((line, index) => (targets.includes(index) ? humble(line) : line)).join("\n"), line: first + 1 };
};

// --- max-kanji-continuous ---

// chaff の漢字の連なりと同じ範囲。「々」は連なりを切る。
const KANJI_RUN = /[一-鿿]+/gu;

type Glue = { readonly at: number; readonly text: string };

/** 「の」一字だけを挟んで並ぶ二つの漢字の連なりのうち、「の」を抜くと上限より長くなる最初のもの。 */
const gluedAt = (line: string, limit: number): Glue | undefined => {
  const runs = [...line.matchAll(KANJI_RUN)];
  const pairs = runs.slice(1).flatMap((next, index) => {
    const run = runs[index];
    const end = run === undefined ? -1 : run.index + run[0].length;
    return run !== undefined && line.charAt(end) === "の" && next.index === end + 1 ? [{ at: run.index, text: `${run[0]}の${next[0]}` }] : [];
  });
  return pairs.find((pair) => pair.text.length - 1 > limit);
};

/** 「品質管理部門の担当者」の「の」を抜いて、上限より長い漢字の連なりにする。 */
export const glueKanji = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["max-kanji-continuous"];
  if (limit === undefined) return undefined;
  return rewriteFirst(
    source,
    (line) => isProse(line) && gluedAt(line, limit) !== undefined,
    (line) => {
      const match = gluedAt(line, limit);
      return match === undefined ? undefined : `${line.slice(0, match.at)}${match.text.replace("の", "")}${line.slice(match.at + match.text.length)}`;
    },
  );
};

// --- no-nakaguro-parallel ---

const commaCount = (sentence: string): number => [...sentence.matchAll(/、/gu)].length;

/** 読点が上限より多い文の読点を、すべて中黒にする。七つを並べた文が「A・B・C・D・E・F・G」になる。 */
export const dotList = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["no-nakaguro-parallel"];
  if (limit === undefined) return undefined;
  const isList = (sentence: string): boolean => commaCount(sentence) > limit;
  return rewriteFirst(
    source,
    (line) => isProse(line) && line.split(/(?<=。)/u).some(isList),
    (line) =>
      line
        .split(/(?<=。)/u)
        .map((sentence) => (isList(sentence) ? sentence.replaceAll("、", "・") : sentence))
        .join(""),
  );
};

// --- agentless-passive ---

// 「資料を共有しました」を「資料が共有されました」に。を の前に は・が があれば主語が書いてあるので替えない。
const ACTIVE = /^([^。はが]*?)を([一-龠々]{2,})(しました|した)。/u;
const TO_PASSIVE: Readonly<Record<string, string>> = { しました: "されました", した: "された" };
const AGENT = /によって|により|による|から/u;

const passiveOf = (sentence: string): string | undefined => {
  if (AGENT.test(sentence)) return undefined;
  const match = ACTIVE.exec(sentence);
  const [, before, stem, ending] = match ?? [];
  if (match === null || before === undefined || stem === undefined || ending === undefined) return undefined;
  return `${before}が${stem}${TO_PASSIVE[ending] ?? ending}。${sentence.slice(match[0].length)}`;
};

const passiveLine = (line: string): string | undefined => {
  const sentences = line.split(/(?<=。)/u);
  const at = sentences.findIndex((sentence) => passiveOf(sentence) !== undefined);
  return at < 0 ? undefined : sentences.map((sentence, index) => (index === at ? (passiveOf(sentence) ?? sentence) : sentence)).join("");
};

/** 「〜を〇〇した」の文を、動作主の無い受け身「〜が〇〇された」にする。 */
export const passiveJa = (source: string): Plant | undefined => rewriteFirst(source, (line) => isProse(line) && passiveLine(line) !== undefined, passiveLine);

// --- doubled-word ---

const NOUN_THEN_WO = /([一-龠々ァ-ヶー])を/u;

/** 名詞の後ろの最初の「を」を「をを」にする。打ち直したときに残った助詞。 */
export const doubleParticle = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && NOUN_THEN_WO.test(line),
    (line) => line.replace(NOUN_THEN_WO, "$1をを"),
  );
