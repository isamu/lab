<!-- chaff-sample
rule: heading-numbering-mix
genre: business/report
file: incident-report.md
-->

# Heading numbering mixed (`heading-numbering-mix`)

**Where it helps:** reports, specifications, policies. Any document whose section headings carry numbers.

## Original

```markdown chaff-before
# Incident report: payroll file sent late

## 1. Summary

The October payroll file reached the bank two hours after the cut-off.

## Timeline

The export started at 15:10 and failed twice before it finished at 17:05.

## 2. Cause

The export ran on the old server, which was being backed up at the same time.

## 3. Actions

The export now runs on the new server, at 13:00.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report incident-report.md

incident-report.md   business/report · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    ## Timeline

  ·  Heading numbering mixed

     The heading "Timeline" has no number, while 3 of its siblings do ("1. Summary")
     An unnumbered "Steps" between a numbered "1. Overview" and "3. Costs", or "1." and "2." next to "3)" or "Chapter 4", leave the reader unsure whether the odd one is meant to be different or lost its number, and the numbers stop matching the table of contents and cross-references. chaff does not pick a style; among headings with the same parent and depth (siblings) it points at the minority. Words that carry a number (Chapter 1, 第1章) and front and back matter that is never numbered (Contents, References) are in each language's lexicon.

     → Number sibling headings the same way. If the unnumbered one is meant to sit outside the numbered body, give it a different parent.

     Relax this rule:  npx chaffjs relax heading-numbering-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Incident report: payroll file sent late

## 1. Summary

The October payroll file reached the bank two hours after the cut-off.

## 2. Timeline

The export started at 15:10 and failed twice before it finished at 17:05.

## 3. Cause

The export ran on the old server, which was being backed up at the same time.

## 4. Actions

The export now runs on the new server, at 13:00.
```

## How it was fixed

Every section of the report is numbered except "Timeline", which was added between "1. Summary" and the old "2. Cause".
A reader cannot tell whether "Timeline" is meant to sit outside the numbered sections, or lost its number.
When someone writes "see section 2" in a reply, it is no longer clear which section they mean.

The fix numbers the new section and renumbers the ones after it.
chaff does not decide whether headings should be numbered. Among headings at the same level under the same parent it points at the minority.
Front and back matter that is never numbered, such as Contents or References, is not counted.

## Settings

A heading numbered differently from its siblings is a note at the default level and a warning at `strict`; `relaxed` keeps it a note.

If your documents mix numbered and unnumbered sections on purpose, turn it off:

```yaml chaff-settings
rules:
  heading-numbering-mix: off
```

```text chaff-explain
$ npx chaffjs explain heading-numbering-mix --genre business/report

  Heading numbering mixed   (heading-numbering-mix)

  An unnumbered "Steps" between a numbered "1. Overview" and "3. Costs", or "1." and "2." next to "3)" or "Chapter 4", leave the reader unsure whether the odd one is meant to be different or lost its number, and the numbers stop matching the table of contents and cross-references. chaff does not pick a style; among headings with the same parent and depth (siblings) it points at the minority. Words that carry a number (Chapter 1, 第1章) and front and back matter that is never numbered (Contents, References) are in each language's lexicon.

  How to fix: Number sibling headings the same way. If the unnumbered one is meant to sit outside the numbered body, give it a different parent.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax heading-numbering-mix --why "reason"
```

[All samples](README.md)
