import type { Amount } from "./total.ts";
import type { TimeLength } from "../derived/time-lengths.ts";

/**
 * 時間と分を続けて書いた長さ（9時間30分、7 hours 30 minutes、7時間半）を、一つの時間の量（9.5時間）として足す。
 * 木は 9時間 と 30分 を別の量に読むので、そのままでは 30分 が落ちた和を合計と比べてしまう。Pure.
 */

const MINUTES_PER_HOUR = 60;
const HUNDREDTHS = 100;

/** 足さない長さの単位に付ける印。どの量とも同じ単位にならないので、その長さがある列の和は取らない。 */
const UNSUMMABLE = "?";

/** 時間の百分の一で割り切れる長さか（15分、30分、45分）。20分は割り切れず、丸めの差が書き誤りに見える。 */
const exactInHundredths = (minutes: number): boolean => Number.isInteger((minutes * HUNDREDTHS) / MINUTES_PER_HOUR);

const unsummable = (length: TimeLength, unit: string): Amount => ({
  offset: length.start,
  end: length.end,
  value: length.minutes / MINUTES_PER_HOUR,
  unit: `${unit}${UNSUMMABLE}${String(length.start)}`,
});

/**
 * 長さ一つを足す量に直す。時間の量の後ろに分か半を続けた長さは時間の量に、分が 60 以上か百分の一で割り切れなければ足さない量に、
 * 木が量と読まなかった長さ（8 h）も足さない量にする。時間だけの長さ（8時間、木が数だけを量と読む 8 hours も）と、分から始まる長さ（90分）は、木の量のまま（undefined）。
 */
const compoundOf = (length: TimeLength, amounts: readonly Amount[], hourUnits: ReadonlySet<string>): Amount | undefined => {
  const first = amounts.find((amount) => amount.offset === length.start);
  if (first === undefined) return unsummable(length, "");
  if (!hourUnits.has(first.unit)) return undefined;
  const extraMinutes = length.minutes - first.value * MINUTES_PER_HOUR;
  if (extraMinutes === 0) return undefined;
  const readable = extraMinutes > 0 && extraMinutes < MINUTES_PER_HOUR && exactInHundredths(length.minutes);
  if (!readable) return unsummable(length, first.unit);
  return { offset: length.start, end: length.end, value: length.minutes / MINUTES_PER_HOUR, unit: first.unit };
};

/** amounts の中の、時間と分を続けて書いた長さを、一つの量に置き換える。hourUnits は時間の単位（時間、hours）。 */
export const withCompoundHours = (amounts: readonly Amount[], lengths: readonly TimeLength[], hourUnits: readonly string[]): Amount[] => {
  const units = new Set(hourUnits);
  const compounds = lengths.flatMap((length) => {
    const compound = compoundOf(length, amounts, units);
    return compound === undefined ? [] : [compound];
  });
  const covered = (amount: Amount): boolean => compounds.some((compound) => amount.offset >= compound.offset && amount.offset < compound.end);
  return [...amounts.filter((amount) => !covered(amount)), ...compounds].toSorted((left, right) => left.offset - right.offset);
};
