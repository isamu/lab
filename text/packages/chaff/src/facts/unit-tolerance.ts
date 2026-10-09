import type { Tolerance } from "./measures.ts";

/** 丸めた書き方（1 mile と 1.6 km、300 kPa と 44 psi）を合うとみなす差。大きいほうの値の 2%。 */
const ROUNDING_SHARE = 0.02;

/**
 * 温度は割合では比べられない（0 ℃ の 2% は 0）。オーブンの換算表は 25 °F 刻みの目盛りに丸める（170 ℃ と 325 °F は 13 °F 違う）ので、
 * 一目盛りより小さい 15 °F までの差は合うとみなす。
 */
const OVEN_ROUNDING_FAHRENHEIT = 15;
const CELSIUS_PER_FAHRENHEIT_DEGREE = 5 / 9;

const DEFAULT_TOLERANCE: Tolerance = { relative: ROUNDING_SHARE, absolute: 0 };
const TEMPERATURE_TOLERANCE: Tolerance = { relative: 0, absolute: OVEN_ROUNDING_FAHRENHEIT * CELSIUS_PER_FAHRENHEIT_DEGREE };

/** 量の種類（語彙表の id）ごとの、換算して合うとみなす差。 */
export const toleranceOf = (dimension: string): Tolerance => (dimension === "unit-temperature" ? TEMPERATURE_TOLERANCE : DEFAULT_TOLERANCE);
