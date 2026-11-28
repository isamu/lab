<!-- chaff-sample
rule: repeated-sentence-head
genre: docs/manual
file: welcome.md
-->

# Repeated sentence opening (`repeated-sentence-head`)

**Where it helps:** welcome pages, product descriptions, help pages. Paragraphs that list what something can do.

## Original

```markdown chaff-before
# Your new shared drive

Every new starter gets a shared drive account on their first day.

Your account lets you upload files up to 2 GB from the web page or the desktop app.
Your account lets you share a folder with anyone in the company by entering their name.
Your account lets you restore a deleted file from the bin for 30 days.
Your account lets you see who changed a file last from its history.

If you run out of space, ask the help desk for more.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual welcome.md

welcome.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Your account lets you upload files up to 2 GB from the web page or the desktop app. Your account lets you share a folder…

  ⚠  Repeated sentence opening

     4 sentences in a row open with "Your account lets" (limit 3)
     Identical openings blur the boundary between sentences. A sentence counts when its first three words (six characters in Japanese) match the sentence before it.

     → Reorder, or fold one sentence into the one before it.

     Relax this rule:  npx chaffjs relax repeated-sentence-head


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your new shared drive

Every new starter gets a shared drive account on their first day.

You can upload files up to 2 GB from the web page or the desktop app.
To share a folder with anyone in the company, enter their name.
A deleted file stays in the bin for 30 days, and you can restore it from there.
Each file's history shows who changed it last.

If you run out of space, ask the help desk for more.
```

## How it was fixed

Four sentences in a row open with "Your account lets you".
Read aloud, it sounds like a recording; read on a screen, the identical openings make the four sentences run together, and the eye has to skip the same three words each time to find what is different.

The fix opens each sentence with what it is about: the upload, the sharing, the deleted file, the history.
If the four really are a list of features, a bulleted list is another good fix: list items that open the same way are a format, and chaff does not count them.

## Settings

chaff compares the first three words of each sentence (in Japanese, the first six characters). At the default level it reports more than three sentences in a row with the same opening; `strict` allows two and `relaxed` four.
A run does not continue across a heading or across list items.

```yaml chaff-settings
rules:
  repeated-sentence-head: relaxed
```

The rule does not run on contracts and statutes, literature, or verbatim transcripts, which repeat their sentence heads on purpose.

```text chaff-explain
$ npx chaffjs explain repeated-sentence-head --genre docs/manual

  Repeated sentence opening   (repeated-sentence-head)

  Identical openings blur the boundary between sentences. A sentence counts when its first three words (six characters in Japanese) match the sentence before it.

  How to fix: Reorder, or fold one sentence into the one before it.

  Levels:
    strict   up to 2 sentences in a row with the same opening
  → normal   up to 3 sentences in a row with the same opening
    relaxed  up to 4 sentences in a row with the same opening
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax repeated-sentence-head --why "reason"
```

[All samples](README.md)
