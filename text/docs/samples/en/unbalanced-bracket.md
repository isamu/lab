<!-- chaff-sample
rule: unbalanced-bracket
genre: docs/manual
file: return-laptop.md
-->

# Unbalanced bracket (`unbalanced-bracket`)

**Where it helps:** manuals, help pages, reports. Any text with asides in brackets, edited a few times.

## Original

```markdown chaff-before
# Returning a laptop

When you leave, or when your laptop is replaced, return it to the IT desk on the second floor (next to the lifts.
Bring the charger and any adapter you were given.

Back up your files first. Anything left on the laptop is deleted when it is reset (this cannot be undone).
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual return-laptop.md

return-laptop.md   docs/manual · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    on the second floor (next to the lifts. B

  ·  Unbalanced bracket

     "(" is never closed
     A "(" never closed, or a ")" never opened, leaves the reader unsure where the aside ends. A full-width "（" closed by a half-width ")" is left over from an edit too. Brackets are paired within each section under a heading ((), [], “”, and the Japanese 「」『』（）［］【】〔〕〈〉《》), across paragraphs, since a stanza or a long quotation may span several. A short label of up to three characters such as "1)", "a)" or "iv)" at the start of a line or after a space, a ")" right after a number, a numbered label inside an aside ("A3)" in "(see the notes; A3) and more)", when the same label is used at the start of a line and later closes on the same line still close the aside), code, URLs, and an opening bracket quoted as the last character of a quotation (「取締役（」, as statutes quote the text they amend) are not counted. An opening quotation mark carried into a paragraph that opens with the same mark, as in fiction, is not counted, nor is a quotation of verse that reopens with the same mark at the start of two or more lines in a row and closes once at the end.

     → Add the missing bracket or remove the extra one. Make the opening and closing marks the same width.

     Relax this rule:  npx chaffjs relax unbalanced-bracket


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Returning a laptop

When you leave, or when your laptop is replaced, return it to the IT desk on the second floor (next to the lifts).
Bring the charger and any adapter you were given.

Back up your files first. Anything left on the laptop is deleted when it is reset (this cannot be undone).
```

## How it was fixed

The bracket that opens "(next to the lifts" is never closed, so the reader does not know where the aside ends.
Does "Bring the charger" belong to it? Probably not, but the reader has to stop and decide.

The fix closes the bracket after "lifts".
The second aside, "(this cannot be undone)", was already closed, and chaff does not report it.

## Settings

This rule is a note at `normal` and `relaxed`; `strict` makes it a warning.

Brackets are paired within each section, so an aside that runs across paragraphs still pairs.
Short labels such as "1)" or "a)" at the start of a line, a ")" right after a number, code and URLs are not counted.

```yaml chaff-settings
rules:
  unbalanced-bracket: off
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain unbalanced-bracket --genre docs/manual

  Unbalanced bracket   (unbalanced-bracket)

  A "(" never closed, or a ")" never opened, leaves the reader unsure where the aside ends. A full-width "（" closed by a half-width ")" is left over from an edit too. Brackets are paired within each section under a heading ((), [], “”, and the Japanese 「」『』（）［］【】〔〕〈〉《》), across paragraphs, since a stanza or a long quotation may span several. A short label of up to three characters such as "1)", "a)" or "iv)" at the start of a line or after a space, a ")" right after a number, a numbered label inside an aside ("A3)" in "(see the notes; A3) and more)", when the same label is used at the start of a line and later closes on the same line still close the aside), code, URLs, and an opening bracket quoted as the last character of a quotation (「取締役（」, as statutes quote the text they amend) are not counted. An opening quotation mark carried into a paragraph that opens with the same mark, as in fiction, is not counted, nor is a quotation of verse that reopens with the same mark at the start of two or more lines in a row and closes once at the end.

  How to fix: Add the missing bracket or remove the extra one. Make the opening and closing marks the same width.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unbalanced-bracket --why "reason"
```

[All samples](README.md)
