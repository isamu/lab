import type { Line } from "./lines.ts";

// The lines of a GitHub alert (`> [!NOTE]`, `> [!IMPORTANT]`): an editorial note set apart from the text around it.
// Pure: reads the document's lines only.

const QUOTED = /^[ \t]*>/u;
const ALERT_OPENER = /^[ \t]*>[ \t]*\[![A-Za-z]+\][ \t]*$/u;

/** The numbers of the lines inside an alert, its opening `> [!NOTE]` line included. */
export const alertLineNumbers = (lines: readonly Line[]): Set<number> => {
  const numbers = new Set<number>();
  const open = { alert: false };
  lines.forEach((line) => {
    if (!QUOTED.test(line.text)) open.alert = false;
    else if (ALERT_OPENER.test(line.text)) open.alert = true;
    if (open.alert) numbers.add(line.number);
  });
  return numbers;
};
