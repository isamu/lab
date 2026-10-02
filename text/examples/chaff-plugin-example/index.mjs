// @ts-check
// chaff-plugin-example: a rule written in code, a rule driven by a word list, and a house style that sets both.
// chaff.yaml loads it with plugins: [chaff-plugin-example]; every id it ships is prefixed with its name, example/.

import { definePlugin } from "chaffjs/api";
import { NO_TBD_DATES } from "./rules/no-tbd-dates.mjs";
import { WEASEL, WEASEL_WORDS } from "./rules/weasel-words.mjs";

export default definePlugin({
  name: "example",
  rules: [NO_TBD_DATES, WEASEL_WORDS],
  lexicons: { weasel: WEASEL },
  styles: [
    {
      id: "careful",
      name: { ja: "日付と出典に厳しく", en: "Careful with dates and sources" },
      summary: {
        ja: "未定の日付を誤りとして、誰の言葉か分からない主張を注意として出します",
        en: "An undecided date is an error, and a claim with nobody behind it a warning",
      },
      source: { title: "chaff-plugin-example", url: "https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-example" },
      rules: { "example/no-tbd-dates": "strict", "example/weasel-words": "strict" },
    },
  ],
});
