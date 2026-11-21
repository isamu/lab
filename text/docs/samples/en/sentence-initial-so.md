<!-- chaff-sample
rule: sentence-initial-so
genre: blog/tech
file: dark-mode.md
-->

# Sentence opening with "So," (`sentence-initial-so`)

**Where it helps:** blog posts, release notes, emails. Text drafted the way it would be said, or transcribed from a talk.

## Original

```markdown chaff-before
# Why the app now follows your system theme

Until this release, the app had its own light and dark setting, separate from your phone's.
Many of you asked why the app stayed bright at night when everything else had gone dark.

So, from version 6 the app follows the system theme by default.
If you prefer the old behaviour, you can still choose light or dark in the display settings.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech dark-mode.md

dark-mode.md   blog/tech · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    So, from version 6 the app follows the system theme by default.

  ·  Sentence opening with "So,"

     1 sentence opens with "So," (1 needed)
     "So," at the head of a sentence carries a spoken pause into writing. It joins the sentence to the last without saying how (a reason, a result, a change of topic). "So far" and "So that", without the comma, open a sentence on their own terms and are not counted.

     → Delete "So," and reread. If the link is needed, use a word that says what it is ("Therefore", "As a result").

     Relax this rule:  npx chaffjs relax sentence-initial-so


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why the app now follows your system theme

Until this release, the app had its own light and dark setting, separate from your phone's.
Many of you asked why the app stayed bright at night when everything else had gone dark.

From version 6 the app follows the system theme by default.
If you prefer the old behaviour, you can still choose light or dark in the display settings.
```

## How it was fixed

"So," at the head of a sentence is a spoken pause: the breath a speaker takes before the point.
On the page it joins the sentence to the one before without saying how, and makes a release note sound like the opening of a talk.

The fix deletes it and reads the sentence again.
The link to the paragraph before is still clear; if it were not, a word that says what the link is ("As a result", "Therefore") would be the better choice.

## Settings

The rule counts sentences that open with "So," and its comma.
At `normal` and `strict` one is enough; `relaxed` waits for three:

```yaml chaff-settings
rules:
  sentence-initial-so: relaxed
```

"So far", "So that" and "So the board decided" are not counted.
It reads English only, and does not run on literature, speech or legal text.

```text chaff-explain
$ npx chaffjs explain sentence-initial-so --genre blog/tech

  Sentence opening with "So,"   (sentence-initial-so)

  "So," at the head of a sentence carries a spoken pause into writing. It joins the sentence to the last without saying how (a reason, a result, a change of topic). "So far" and "So that", without the comma, open a sentence on their own terms and are not counted.

  How to fix: Delete "So," and reread. If the link is needed, use a word that says what it is ("Therefore", "As a result").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 1 sentences open with "So,"
  → normal   reported once 1 sentences open with "So,"
    relaxed  reported once 3 sentences open with "So,"
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax sentence-initial-so --why "reason"
```

[All samples](README.md)
