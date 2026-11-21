<!-- chaff-sample
rule: unrendered-emphasis
genre: business/email
file: email.md
-->

# Unrendered emphasis marks (`unrendered-emphasis`)

**Where it helps:** emails written in Markdown, chat announcements, help pages. Any text whose bold is typed by hand.

## Original

```markdown chaff-before
Subject: Fire drill on Tuesday

Dear all,

There will be a fire drill on Tuesday, December 1, at 11:00.
When the alarm sounds, leave by the nearest stairs and meet at the car park on Mill Road.
**Do not use the lifts. They stop at the ground floor during the drill.

Best regards,
Facilities team
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    **

  ⚠  Unrendered emphasis marks

     "**" is not turned into bold and shows as written
     "**" and "__" turn into bold only when Markdown can pair them; otherwise they show as written. Besides one left open ("**important"), a mark with punctuation inside and a letter outside (Japanese "**「重要」**です") cannot close under CommonMark's rules, and the reader sees the "**".

     → If it was left open, add the closing "**". If punctuation sits inside the mark, move the mark outside the punctuation, or put a space outside it.

     Relax this rule:  npx chaffjs relax unrendered-emphasis


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Fire drill on Tuesday

Dear all,

There will be a fire drill on Tuesday, December 1, at 11:00.
When the alarm sounds, leave by the nearest stairs and meet at the car park on Mill Road.
**Do not use the lifts.** They stop at the ground floor during the drill.

Best regards,
Facilities team
```

## How it was fixed

The safety line opens bold with `**` and never closes it.
Markdown cannot pair the mark, so the reader sees the two asterisks in front of "Do not use the lifts", and no bold at all. The one line meant to stand out looks like a typing slip.

The fix closes the bold after the sentence that must stand out.
chaff also reports a mark that cannot close because punctuation sits inside it and a letter outside.

## Settings

Emphasis that does not render is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your text is never shown as Markdown, relax it:

```yaml chaff-settings
rules:
  unrendered-emphasis: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain unrendered-emphasis --genre business/email

  Unrendered emphasis marks   (unrendered-emphasis)

  "**" and "__" turn into bold only when Markdown can pair them; otherwise they show as written. Besides one left open ("**important"), a mark with punctuation inside and a letter outside (Japanese "**「重要」**です") cannot close under CommonMark's rules, and the reader sees the "**".

  How to fix: If it was left open, add the closing "**". If punctuation sits inside the mark, move the mark outside the punctuation, or put a space outside it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unrendered-emphasis --why "reason"
```

[All samples](README.md)
