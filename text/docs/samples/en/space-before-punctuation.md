<!-- chaff-sample
rule: space-before-punctuation
genre: business/email
file: garden-quote.md
-->

# Space before punctuation (`space-before-punctuation`)

**Where it helps:** letters, emails, quotes for customers. The space often comes from typing habits carried over from another language.

## Original

```markdown chaff-before
Subject: Quote for the garden wall

Dear Mr Patel,

Thank you for showing us the garden on Tuesday .
We can rebuild the wall in the same brick , and it will take four days .

The written quote is attached. If you are happy with it, we can start in the first week of April.

Kind regards,
Dana
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email garden-quote.md

garden-quote.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    he garden on Tuesday . We can rebuild the

  ⚠  Space before punctuation

     A space before "."
     English attaches punctuation to the word before it. A space before it ("word .", "(word) ,") can leave the mark alone at the start of the next line, and reads as a space left over from an edit. Periods, commas, semicolons, question marks and exclamation marks are checked. A colon ("Note : "), dots spaced out as an ellipsis or a leader in a table of contents (". . .", also when a line break falls between the dots), a dot that starts the next word (".NET", ".5"), a mark after a number ("[ 1 , N ]" in a formula), code and URLs are not counted, nor are two or more spaces before the mark (a line laid out like a table).

     → Delete the space and attach the mark to the word before it.

     Relax this rule:  npx chaffjs relax space-before-punctuation


─── line 6 ───────────────────────────────────────────────────

    ll in the same brick , and it will take fo

  ⚠  Space before punctuation

     A space before ","
     English attaches punctuation to the word before it. A space before it ("word .", "(word) ,") can leave the mark alone at the start of the next line, and reads as a space left over from an edit. Periods, commas, semicolons, question marks and exclamation marks are checked. A colon ("Note : "), dots spaced out as an ellipsis or a leader in a table of contents (". . .", also when a line break falls between the dots), a dot that starts the next word (".NET", ".5"), a mark after a number ("[ 1 , N ]" in a formula), code and URLs are not counted, nor are two or more spaces before the mark (a line laid out like a table).

     → Delete the space and attach the mark to the word before it.

     Relax this rule:  npx chaffjs relax space-before-punctuation


─── line 6 ───────────────────────────────────────────────────

    will take four days . The written quote

  ⚠  Space before punctuation

     A space before "."
     English attaches punctuation to the word before it. A space before it ("word .", "(word) ,") can leave the mark alone at the start of the next line, and reads as a space left over from an edit. Periods, commas, semicolons, question marks and exclamation marks are checked. A colon ("Note : "), dots spaced out as an ellipsis or a leader in a table of contents (". . .", also when a line break falls between the dots), a dot that starts the next word (".NET", ".5"), a mark after a number ("[ 1 , N ]" in a formula), code and URLs are not counted, nor are two or more spaces before the mark (a line laid out like a table).

     → Delete the space and attach the mark to the word before it.

     Relax this rule:  npx chaffjs relax space-before-punctuation


────────────────────────────────────────────────────────────

  3 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Quote for the garden wall

Dear Mr Patel,

Thank you for showing us the garden on Tuesday.
We can rebuild the wall in the same brick, and it will take four days.

The written quote is attached. If you are happy with it, we can start in the first week of April.

Kind regards,
Dana
```

## How it was fixed

English attaches a period or a comma to the word before it.
A space in front ("Tuesday .", "brick ,") reads as a space left over from an edit, and on a narrow screen the mark can drop to the start of the next line on its own.

The fix deletes the three spaces.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

Periods, commas, semicolons, question marks and exclamation marks are checked.
A colon, dots spaced out as an ellipsis, a dot that starts a word (".NET"), a mark after a number, two or more spaces (a line laid out like a table), code and URLs are not.

```yaml chaff-settings
rules:
  space-before-punctuation: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain space-before-punctuation --genre business/email

  Space before punctuation   (space-before-punctuation)

  English attaches punctuation to the word before it. A space before it ("word .", "(word) ,") can leave the mark alone at the start of the next line, and reads as a space left over from an edit. Periods, commas, semicolons, question marks and exclamation marks are checked. A colon ("Note : "), dots spaced out as an ellipsis or a leader in a table of contents (". . .", also when a line break falls between the dots), a dot that starts the next word (".NET", ".5"), a mark after a number ("[ 1 , N ]" in a formula), code and URLs are not counted, nor are two or more spaces before the mark (a line laid out like a table).

  How to fix: Delete the space and attach the mark to the word before it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax space-before-punctuation --why "reason"
```

[All samples](README.md)
