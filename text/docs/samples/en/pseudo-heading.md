<!-- chaff-sample
rule: pseudo-heading
genre: docs/manual
file: expenses.md
-->

# A bold line used as a heading (`pseudo-heading`)

**Where it helps:** handbooks, manuals, and documents pasted from a chat or from an AI's answer. Among real headings, one "heading" is only a bold line.

## Original

```markdown chaff-before
# Expenses guide

## Making a claim

Upload a photo of the receipt, enter the amount and what it was for, and submit.

**Travel expenses**

Claim fares and hotels with the trip's approval number.

## Approval

Your manager checks the claim and passes it to finance.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual expenses.md

expenses.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    **Travel expenses**

  ·  A bold line used as a heading

     The bold line "Travel expenses" stands in for a heading
     In a document whose sections have headings, a bold line on its own ("**Next steps**") stands where a heading would. It looks like a heading on screen, but Markdown reads it as a plain paragraph: it is missing from the table of contents and from what a screen reader announces, no link can point at it, and the checks for required sections and for the table of contents do not see the section. Generated text and documents pasted from a chat do this often (markdownlint's MD036).

     → Make it a heading ("**Next steps**" becomes "### Next steps", one level below the heading above it). If it is not a section of its own, drop the bold and write it into the text.

     Relax this rule:  npx chaffjs relax pseudo-heading


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Expenses guide

## Making a claim

Upload a photo of the receipt, enter the amount and what it was for, and submit.

### Travel expenses

Claim fares and hotels with the trip's approval number.

## Approval

Your manager checks the claim and passes it to finance.
```

## How it was fixed

The guide divides its sections with `##` headings, but "Travel expenses" is a bold line.
It looks like a small heading on screen, but Markdown reads it as a plain paragraph: it is not in the table of contents, a screen reader does not announce it as a heading, and no link can point at it.

The fix makes "Travel expenses" a `###` heading, one level below the heading above it.
If it is not a section of its own, drop the bold and write it into the text instead.

## Settings

Only the weight of the finding changes: a note at the default level and a warning at `strict`.

```yaml chaff-settings
rules:
  pseudo-heading: strict
```

A document with no headings, or with only its title, is not checked: there the bold lines are how the writer divides it.
A bold line ending in punctuation or a colon ("**Note:**"), bold followed by more text in the same paragraph, and a bold line right over a heading are not reported either.

```text chaff-explain
$ npx chaffjs explain pseudo-heading --genre docs/manual

  A bold line used as a heading   (pseudo-heading)

  In a document whose sections have headings, a bold line on its own ("**Next steps**") stands where a heading would. It looks like a heading on screen, but Markdown reads it as a plain paragraph: it is missing from the table of contents and from what a screen reader announces, no link can point at it, and the checks for required sections and for the table of contents do not see the section. Generated text and documents pasted from a chat do this often (markdownlint's MD036).

  How to fix: Make it a heading ("**Next steps**" becomes "### Next steps", one level below the heading above it). If it is not a section of its own, drop the bold and write it into the text.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax pseudo-heading --why "reason"
```

[All samples](README.md)
