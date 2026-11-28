<!-- chaff-sample
rule: bold-emphasis
genre: blog/tech
file: stock-count.md
-->

# Bold emphasis scattered through the text (`bold-emphasis`)

**Where it helps:** staff notices, guides, blog posts. Any text where several things feel important at once.

## Original

```markdown chaff-before
# How we handle the end-of-year stock count

Every year on the last working day of December, the warehouse closes for the stock count.
This year that day is Wednesday 30 December, and the count starts at 7 am.

Each team counts the aisles on its sheet, and a second person checks **every tenth shelf** against the first count.
If the two counts differ, the shelf is counted again by both people together, and the **final number** goes on the sheet.

The scanners are charged in the office the night before.
Please take only the scanner with your team's number on it, because the counts are **matched to the scanner**, not to the person holding it.

Orders that come in on the 30th are **not picked until the next working day**.
The customer service team has already told our larger customers, and the website shows the later dispatch date from the 28th.

Sheets go back to the office by **3 pm**.
The office enters them the same afternoon and sends the totals to finance before 6 pm, so the numbers are in the year's accounts.
If your team finishes early, help the aisle next to yours rather than going home; the count is only done when every sheet is in.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech stock-count.md

stock-count.md   blog/tech · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Each team counts the aisles on its sheet, and a second person checks every tenth shelf against the first count.

  ·  Bold emphasis scattered through the text

     5 bold spans of emphasis: 24.4 per 1000 words (limit 4)
     Words and phrases set in bold mid-sentence, paragraph after paragraph. Human documents mostly use no bold at all, or keep it for the one or two things a reader must not miss, such as a deadline. Scattered through the text, bold stops marking anything. A shape common in generated text.

     → Unbold everything, then bold again only the one or two places a reader must not miss.

     Relax this rule:  npx chaffjs relax bold-emphasis


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# How we handle the end-of-year stock count

Every year on the last working day of December, the warehouse closes for the stock count.
This year that day is Wednesday 30 December, and the count starts at 7 am.

Each team counts the aisles on its sheet, and a second person checks every tenth shelf against the first count.
If the two counts differ, the shelf is counted again by both people together, and the final number goes on the sheet.

The scanners are charged in the office the night before.
Please take only the scanner with your team's number on it, because the counts are matched to the scanner, not to the person holding it.

Orders that come in on the 30th are not picked until the next working day.
The customer service team has already told our larger customers, and the website shows the later dispatch date from the 28th.

Sheets go back to the office by **3 pm**.
The office enters them the same afternoon and sends the totals to finance before 6 pm, so the numbers are in the year's accounts.
If your team finishes early, help the aisle next to yours rather than going home; the count is only done when every sheet is in.
```

## How it was fixed

Five phrases are in bold, one in almost every paragraph: "every tenth shelf", "final number", "matched to the scanner", the rule about orders, and the 3 pm deadline.
When everything is bold, a reader skimming the notice cannot tell which of them is the one they must not miss.

The fix takes the bold off everything, then puts it back on the one thing a late reader most needs: the time the sheets are due.
The other four still say what they said; they are ordinary sentences in a short notice, and people read them.

## Settings

The rule counts bold phrases in the middle of sentences, per 1000 words. Bold that opens a line (a label such as **Pros:**) and a capitalised bold name (**Add Printer**) are not counted.

At `normal` it allows four spans per 1000 words; `strict` allows two and `relaxed` seven:

```yaml chaff-settings
rules:
  bold-emphasis: relaxed
```

A document with two bold spans or fewer is not measured. The rule does not run on READMEs, meeting notes, legal, documentation, academic, literature or speech genres, which bold their field names as layout. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score stock-count.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain bold-emphasis --genre blog/tech

  Bold emphasis scattered through the text   (bold-emphasis)

  Words and phrases set in bold mid-sentence, paragraph after paragraph. Human documents mostly use no bold at all, or keep it for the one or two things a reader must not miss, such as a deadline. Scattered through the text, bold stops marking anything. A shape common in generated text.

  How to fix: Unbold everything, then bold again only the one or two places a reader must not miss.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 2 bold spans of emphasis per 1000 words
  → normal   up to 4 bold spans of emphasis per 1000 words
    relaxed  up to 7 bold spans of emphasis per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax bold-emphasis --why "reason"
```

[All samples](README.md)
