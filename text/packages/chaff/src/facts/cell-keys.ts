import { keyOfParts, type QualifierWords } from "./qualified-labels.ts";
import type { TableFact } from "./table-facts.ts";

/**
 * 行と列で名前の決まる表の升（| 主回線 | … | 13.6GB | の、列 データ利用量）を、同じ範囲の文が条件を付けて書いた同じ名前（主回線の
 * データ利用量、data used (primary line)）と同じ key にする。列が名前で行が条件の読み（データ利用量 (主回線)）と、行が名前で列が条件の
 * 読み（売上高 (当期)）のうち、同じ範囲の表の外の値の key にあるものがちょうど一つのときだけ。どちらも無いか両方あれば、升の key は
 * 書いたまま。行の条件が key に入るので、別の行（副回線）の値とは比べない。
 */
export const withCellKeys = <T extends TableFact & { readonly scope: string }>(facts: readonly T[], words: QualifierWords): T[] => {
  const written = new Set(facts.filter((fact) => fact.table !== true).map((fact) => `${fact.scope}\n${fact.key}`));
  return facts.map((fact) => {
    if (fact.cell === undefined) return fact;
    const { row, column } = fact.cell;
    const keys = [keyOfParts(column, row, words), keyOfParts(row, column, words)].filter(
      (key): key is string => key !== undefined && written.has(`${fact.scope}\n${key}`),
    );
    const [key, ...others] = keys;
    return key === undefined || others.length > 0 ? fact : { ...fact, key };
  });
};
