import type { StructureIssue } from "./issues.ts";

/**
 * 書いた距離と合わない徒歩の分数（駅 徒歩3分（約600m）、a 3-minute walk (600 m)）。徒歩の語に付いた分数と、そのすぐ前かすぐ後ろの
 * 距離だけを組にし、文書の速さで歩いた分数と比べる。速さは文書に書いたもの（道路距離80mを1分、80 m per minute、5 km/h）を使い、
 * 書いていなければ言語パッケージの既定（日本語の不動産広告の 80m で1分、端数切り上げ）を使う。既定の無い言語は速さを推し量らない。
 * 約の付いた距離は、書いた一番下の桁の半分だけ幅を持たせる（約1.2km は 1.15〜1.25km）。小数の距離は書いた桁の半分の幅を持つ。
 * 範囲（5〜7分）、上限（10分以内）、約の付いた分数は比べない。語は言語パッケージの語彙表から受け取る。
 */

/** 語彙表の一語。position は数のどちら側に書くか。weight は単位の倍率（長さは m、時間は秒）。 */
export type WalkMark = {
  readonly pattern: string;
  readonly position?: "before" | "after" | undefined;
  readonly weight?: number | undefined;
};

export type WalkWords = {
  /** 分数を徒歩の時間にする語（徒歩、walk）。position は分数のどちら側か。 */
  readonly walks: readonly WalkMark[];
  /** 徒歩の語と分数の間に挟んでよい語（徒歩で5分の で）。 */
  readonly gaps: readonly string[];
  /** 分数を上限にする語（以内、within）。position は分数のどちら側か。 */
  readonly bounds: readonly WalkMark[];
  /** 二つの数を範囲にする語（5から7分、8 to 10 minutes）。〜 や - の記号は語彙表に書かなくても読む。 */
  readonly ranges: readonly string[];
  /** 約や上限の語と数の間で読み飛ばす語（about a 5-minute walk の a）。 */
  readonly fillers: readonly string[];
  /** 長さの単位。weight は m への倍率。 */
  readonly lengths: readonly WalkMark[];
  /** 時間の単位。weight は秒への倍率。分より短い単位は分数に使わない。 */
  readonly times: readonly WalkMark[];
  /** 数を概数にする語（約、about）。 */
  readonly hedges: readonly string[];
  /** 長さを速さにする語（を1分、per minute、/h、分速）。weight はその時間の秒。 */
  readonly perTimes: readonly WalkMark[];
  /** 速さの行にあれば、端数を切り上げると言う語（切り上げ、rounded up）。 */
  readonly roundUps: readonly string[];
  /** 速さの行にあれば、切り上げの語があっても切り上げではないと言う語（切り上げません、not rounded up）。 */
  readonly notRoundUps: readonly string[];
  /** 文書に速さが無いときの既定の速さ（m/分）。端数は切り上げる。無ければ比べない。 */
  readonly defaultRate: number | undefined;
};

/** 1分に歩く m と、端数の扱い。up は切り上げだけ、any は切り上げでも切り捨てでも合う。 */
export type WalkRate = { readonly metresPerMinute: number; readonly rounding: "up" | "any" };

/** 読んだ距離。metres は書いた値、margin は書いた桁から来る幅の半分（m）。 */
export type Distance = { readonly start: number; readonly end: number; readonly metres: number; readonly margin: number };

/** 徒歩の分数。lead は前に書いた徒歩の語の始まり（徒歩5分 の 徒歩）、後ろに書くなら数の始まり。 */
type Minutes = { readonly start: number; readonly end: number; readonly lead: number; readonly value: number };

type Reading = { readonly start: number; readonly end: number; readonly digits: string; readonly unit: WalkMark; readonly unitEnd: number };

const DIGIT = "[0-9０-９]";
const NUMBER = new RegExp(`(?<!${DIGIT}|[.,，．])${DIGIT}+(?:[,，]${DIGIT}{3})*(?:[.．]${DIGIT}+)?(?!${DIGIT}|[.．,，]${DIGIT})`, "gu");
const LETTER = /[A-Za-z]/u;
/** 単位のすぐ後ろにあれば、その単位ではない（m のあとの in、㎡ の 2、m² の ²）。 */
const UNIT_CONTINUES = /^[A-Za-z0-9０-９²³]/u;
/** 数と単位の間に置けるもの（1.2 km、5-minute）。 */
const NUMBER_UNIT_GAP = /^[ \u00a0-]?/u;
/** 分数と後ろの徒歩の語の間に置けるもの（5 minutes' walk、5 min. walk）。 */
const MINUTES_WALK_GAP = /^[\s'’.]*/u;
/**
 * 分数と距離の間に置けるもの。開き括弧か・か / の一つだけ（徒歩5分（400m）、400m（徒歩5分）、徒歩5分・400m）。
 * 読点では組にしない（標高600m、徒歩3分 の 600m は道のりではない）。
 */
const PAIR_GAP = /^\s*[(（[［【・/／]\s*$/u;
const RANGE_MARKS: readonly string[] = ["〜", "~", "～", "–", "—", "-"];
const DIGIT_START = new RegExp(`^${DIGIT}`, "u");
const DIGIT_END = new RegExp(`${DIGIT}$`, "u");
/** 浮動小数の誤差（1150 / 80 など）で切り上げが一つずれないための小さな数。 */
const EPSILON = 1e-9;
const MINUTE_SECONDS = 60;
/** 時速から出した速さ（4km/h は 66.66…m/分）を、言うときに小数一桁にする。 */
const RATE_DECIMALS = 10;

const normal = (text: string): string => text.normalize("NFKC").toLowerCase();

const valueOf = (digits: string): number => Number(digits.normalize("NFKC").replaceAll(",", ""));

const isWordEdge = (text: string, at: number): boolean => !(LETTER.test(text.charAt(at - 1)) && LETTER.test(text.charAt(at)));

const startsWithWord = (text: string, word: string): boolean => normal(text.slice(0, word.length)) === normal(word) && isWordEdge(text, word.length);

const endsWithWord = (text: string, word: string): boolean =>
  text.length >= word.length && normal(text.slice(-word.length)) === normal(word) && isWordEdge(text, text.length - word.length);

/** 末尾の空白と、読み飛ばす語を除く（about a の a）。 */
const trimFillers = (text: string, fillers: readonly string[]): string => {
  const trimmed = text.trimEnd();
  const filler = fillers.find((word) => endsWithWord(trimmed, word));
  return filler === undefined ? trimmed : trimFillers(trimmed.slice(0, -filler.length), fillers);
};

/** 位置 at から始まる単位。㎞ のような一字の単位も NFKC で照らす。長い語から。 */
const unitAt = (line: string, at: number, units: readonly WalkMark[]): { readonly unit: WalkMark; readonly end: number } | undefined =>
  units
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .flatMap((unit) =>
      Array.from({ length: unit.pattern.length }, (_, index) => at + index + 1)
        .filter((end) => normal(line.slice(at, end)) === normal(unit.pattern) && !UNIT_CONTINUES.test(line.slice(end)))
        .map((end) => ({ unit, end })),
    )[0];

/** 一行の中の、単位の付いた数。 */
const readingsIn = (line: string, units: readonly WalkMark[]): Reading[] =>
  [...line.matchAll(NUMBER)].flatMap((match) => {
    const numberEnd = match.index + match[0].length;
    const unitStart = numberEnd + (NUMBER_UNIT_GAP.exec(line.slice(numberEnd))?.[0].length ?? 0);
    const found = unitAt(line, unitStart, units);
    return found === undefined ? [] : [{ start: match.index, end: numberEnd, digits: match[0], unit: found.unit, unitEnd: found.end }];
  });

const endsWithAny = (text: string, words: readonly string[]): boolean => words.some((word) => endsWithWord(text, word));

/** 範囲の片側の数か（5〜7分 の 7、5分から10分 の 5分、400m〜600m の 400m、8 to 10 minutes の 10）。 */
const isRangeEnd = (line: string, reading: Reading, units: readonly WalkMark[], rangeWords: readonly string[]): boolean => {
  const joins = [...RANGE_MARKS, ...rangeWords];
  const after = line.slice(reading.unitEnd).trimStart();
  const next = joins.find((word) => startsWithWord(after, word));
  if (next !== undefined && DIGIT_START.test(after.slice(next.length).trimStart())) return true;
  const before = line.slice(0, reading.start).trimEnd();
  const previous = joins.find((word) => endsWithWord(before, word));
  if (previous === undefined) return false;
  const left = before.slice(0, -previous.length).trimEnd();
  const unit = units.find((mark) => endsWithWord(left, mark.pattern));
  return DIGIT_END.test(unit === undefined ? left : left.slice(0, -unit.pattern.length).trimEnd());
};

/** 数のすぐ前（読み飛ばす語の後ろ）に約の語があるか。 */
const isHedged = (line: string, start: number, words: WalkWords): boolean =>
  endsWithAny(trimFillers(line.slice(0, start).replace(/[(（[［]$/u, ""), words.fillers), words.hedges);

const boundBefore = (prefix: string, words: WalkWords): boolean =>
  endsWithAny(
    trimFillers(prefix, words.fillers),
    words.bounds.filter((bound) => bound.position === "before").map((bound) => bound.pattern),
  );

const boundAfter = (rest: string, words: WalkWords): boolean =>
  words.bounds.filter((bound) => bound.position !== "before").some((bound) => startsWithWord(rest.trimStart(), bound.pattern));

/** 前に書く徒歩の語（徒歩5分、徒歩で5分）。あれば、その語の始まりの位置。 */
const walkBeforeStart = (prefix: string, words: WalkWords): number | undefined => {
  const trimmed = prefix.trimEnd();
  const gap = words.gaps.find((word) => trimmed.endsWith(word));
  const head = gap === undefined ? trimmed : trimmed.slice(0, -gap.length).trimEnd();
  const walk = words.walks.find((mark) => mark.position === "before" && endsWithWord(head, mark.pattern));
  return walk === undefined ? undefined : head.length - walk.pattern.length;
};

/** 後ろに書く徒歩の語（a 5-minute walk）。あれば、その語の終わりの位置。 */
const walkAfterEnd = (line: string, from: number, words: WalkWords): number | undefined => {
  const at = from + (MINUTES_WALK_GAP.exec(line.slice(from))?.[0].length ?? 0);
  const walk = words.walks.find((mark) => mark.position === "after" && startsWithWord(line.slice(at), mark.pattern));
  return walk === undefined ? undefined : at + walk.pattern.length;
};

const minuteUnits = (words: WalkWords): WalkMark[] => words.times.filter((unit) => (unit.weight ?? 0) >= MINUTE_SECONDS);

/** 一行の中の、徒歩の分数。範囲、上限、約の付いた分数は読まない。 */
export const walkMinutesIn = (line: string, words: WalkWords): Minutes[] =>
  readingsIn(line, minuteUnits(words)).flatMap((reading) => {
    const prefix = line.slice(0, reading.start);
    const leadStart = walkBeforeStart(prefix, words);
    const afterEnd = walkAfterEnd(line, reading.unitEnd, words);
    if (leadStart === undefined && afterEnd === undefined) return [];
    if (isRangeEnd(line, reading, words.times, words.ranges) || isHedged(line, reading.start, words)) return [];
    if (boundBefore(prefix, words) || boundAfter(line.slice(afterEnd ?? reading.unitEnd), words)) return [];
    const value = (valueOf(reading.digits) * (reading.unit.weight ?? 0)) / MINUTE_SECONDS;
    if (!Number.isInteger(value) || value <= 0) return [];
    return [{ start: reading.start, end: afterEnd ?? reading.unitEnd, lead: leadStart ?? reading.start, value }];
  });

/** 書いた数の桁から来る幅の半分（書いた単位で）。小数は最後の桁、約の付いた整数は最後の 0 でない桁。それ以外は 0。 */
export const marginOf = (digits: string, hedged: boolean): number => {
  const plain = digits.normalize("NFKC").replaceAll(",", "");
  const point = plain.indexOf(".");
  if (point !== -1) return 10 ** -(plain.length - point - 1) / 2;
  if (!hedged) return 0;
  const lastNonZero = [...plain].findLastIndex((digit) => digit !== "0");
  const zeros = plain.length - 1 - lastNonZero;
  return 10 ** zeros / 2;
};

/** 一行の中の距離。範囲の片側は読まない。 */
export const distancesIn = (line: string, words: WalkWords): Distance[] =>
  readingsIn(line, words.lengths)
    .filter((reading) => !isRangeEnd(line, reading, words.lengths, words.ranges))
    .flatMap((reading) => {
      const weight = reading.unit.weight ?? 0;
      const metres = valueOf(reading.digits) * weight;
      const margin = marginOf(reading.digits, isHedged(line, reading.start, words)) * weight;
      return metres > 0 ? [{ start: reading.start, end: reading.unitEnd, metres, margin }] : [];
    });

/**
 * 分数と組になる距離。すぐ後ろ（徒歩5分（400m））を先に、無ければすぐ前（400m（徒歩5分））を見る。間に置けるのは記号と約の語だけ。
 * 一つの距離は一つの分数とだけ組にする。
 */
export const walkPairs = (line: string, words: WalkWords): { readonly minutes: Minutes; readonly distance: Distance }[] => {
  const distances = distancesIn(line, words);
  const between = (from: number, to: number): boolean => from <= to && PAIR_GAP.test(trimFillers(line.slice(from, to), [...words.hedges, ...words.fillers]));
  const used = new Set<Distance>();
  return walkMinutesIn(line, words).flatMap((minutes) => {
    const after = distances.find((distance) => !used.has(distance) && between(minutes.end, distance.start));
    const before = after ?? distances.findLast((distance) => !used.has(distance) && between(distance.end, minutes.lead));
    if (before === undefined) return [];
    used.add(before);
    return [{ minutes, distance: before }];
  });
};

/** 一行に書いた速さ（m/分）。距離のすぐ後ろ（80mを1分、80 m per minute）かすぐ前（分速80m）に時間の語がある距離。 */
export const ratesIn = (line: string, words: WalkWords): number[] =>
  distancesIn(line, words).flatMap((distance) => {
    const rest = line.slice(distance.end).trimStart();
    const head = line.slice(0, distance.start).trimEnd();
    const per =
      words.perTimes.find((mark) => mark.position !== "before" && startsWithWord(rest, mark.pattern)) ??
      words.perTimes.find((mark) => mark.position === "before" && endsWithWord(head, mark.pattern));
    return per === undefined ? [] : [distance.metres / ((per.weight ?? MINUTE_SECONDS) / MINUTE_SECONDS)];
  });

const containsAny = (text: string, words: readonly string[]): boolean => words.some((word) => normal(text).includes(normal(word)));

/** 速さを読む行。徒歩の語（Walking も walk の語として）を含む行。 */
const hasWalkWord = (line: string, words: WalkWords): boolean =>
  containsAny(
    line,
    words.walks.map((walk) => walk.pattern),
  );

const linesOf = (source: string): { readonly text: string; readonly start: number }[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1), start }));
};

/**
 * 文書の速さ。徒歩の語のある行に書いた速さが一つ（一つの値）だけなら、それを使う。端数は、その行に切り上げの語があれば切り上げだけ、
 * 無ければどちらでもよい。二つ以上の値があれば、どの分数がどれで計ったか決められないので比べない。書いていなければ既定（切り上げ）。
 */
export const statedRate = (source: string, words: WalkWords): WalkRate | undefined => {
  const stated = linesOf(source)
    .filter((line) => hasWalkWord(line.text, words))
    .flatMap((line) =>
      ratesIn(line.text, words).map((rate) => ({ rate, up: containsAny(line.text, words.roundUps) && !containsAny(line.text, words.notRoundUps) })),
    );
  const first = stated[0];
  if (first === undefined) return words.defaultRate === undefined ? undefined : { metresPerMinute: words.defaultRate, rounding: "up" };
  if (stated.some((other) => other.rate !== first.rate)) return undefined;
  return { metresPerMinute: first.rate, rounding: stated.some((other) => other.up) ? "up" : "any" };
};

/** その距離を歩いて合う分数の幅。margin の幅の上の端は含まない（1.25km は 1.3km と書く）。 */
export const expectedMinutes = (distance: Pick<Distance, "metres" | "margin">, rate: WalkRate): { readonly low: number; readonly high: number } => {
  const low = (distance.metres - distance.margin) / rate.metresPerMinute;
  const high = (distance.metres + distance.margin) / rate.metresPerMinute;
  return { low: rate.rounding === "up" ? Math.ceil(low - EPSILON) : Math.floor(low + EPSILON), high: Math.ceil(high - EPSILON) };
};

const rangeText = (low: number, high: number): string => (low === high ? String(low) : `${String(low)}–${String(high)}`);

/** 距離と合わない徒歩の分数。分数の位置を指す。 */
export const walkTimeMismatches = (source: string, words: WalkWords): StructureIssue[] => {
  const rate = statedRate(source, words);
  if (rate === undefined) return [];
  return linesOf(source).flatMap((line) =>
    walkPairs(line.text, words).flatMap(({ minutes, distance }) => {
      const { low, high } = expectedMinutes(distance, rate);
      if (minutes.value >= low && minutes.value <= high) return [];
      return [
        {
          offset: line.start + minutes.lead,
          values: {
            minutes: line.text.slice(minutes.lead, minutes.end),
            distance: line.text.slice(distance.start, distance.end),
            expected: rangeText(Math.max(low, 1), Math.max(high, 1)),
            rate: Math.round(rate.metresPerMinute * RATE_DECIMALS) / RATE_DECIMALS,
          },
        },
      ];
    }),
  );
};
