<!-- chaff-sample
rule: heading-marker-no-space
genre: docs/manual
file: expenses.md
-->

# No space after the heading marks (`heading-marker-no-space`)

**Where it helps:** handbooks, manuals, READMEs. Any Markdown typed quickly, or converted from a tool that drops the space.

## Original

```markdown chaff-before
# Expenses guide

## Making a claim

Upload a photo of the receipt, enter the amount and what it was for, and submit.

##Approval

Your manager checks the claim and passes it to finance.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual expenses.md

expenses.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    ##Approval

  ⚠  No space after the heading marks

     "##Approval" has no space after "##" and is not a heading
     A Markdown heading needs a space between its "#" marks and its words. Without it ("#Overview", "##Steps"), the line is not a heading: it shows as a line of text with the marks in it, missing from the table of contents and from what a screen reader announces, and no link can point at it (markdownlint's MD018 and MD020).

     → Put one space after the marks ("##Steps" becomes "## Steps"). If the line is a tag or a number rather than a heading, move it off the start of the line.

     Relax this rule:  npx chaffjs relax heading-marker-no-space


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Expenses guide

## Making a claim

Upload a photo of the receipt, enter the amount and what it was for, and submit.

## Approval

Your manager checks the claim and passes it to finance.
```

## How it was fixed

A Markdown heading needs a space between its marks and its words.
"##Approval" has none, so it is not a heading: it shows as a line of text reading "##Approval", missing from the table of contents and from what a screen reader announces, and no link can point at it.

The fix puts one space after the marks: "## Approval".

## Settings

Only the weight of the finding changes: a warning at the default level and an error at `strict`.

```yaml chaff-settings
rules:
  heading-marker-no-space: strict
```

A line where no letter follows the marks ("#123", "#!") is not reported.
One mark is also how a tag is written ("#chaff"), so a one-mark line is reported only when it is a paragraph on its own and the document writes headings elsewhere.

```text chaff-explain
$ npx chaffjs explain heading-marker-no-space --genre docs/manual

  No space after the heading marks   (heading-marker-no-space)

  A Markdown heading needs a space between its "#" marks and its words. Without it ("#Overview", "##Steps"), the line is not a heading: it shows as a line of text with the marks in it, missing from the table of contents and from what a screen reader announces, and no link can point at it (markdownlint's MD018 and MD020).

  How to fix: Put one space after the marks ("##Steps" becomes "## Steps"). If the line is a tag or a number rather than a heading, move it off the start of the line.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax heading-marker-no-space --why "reason"
```

[All samples](README.md)
