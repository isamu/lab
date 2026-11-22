<!-- chaff-sample
rule: hyphen-as-dash
genre: blog/owned-media
file: opening-hours.md
-->

# Hyphen used as a dash (`hyphen-as-dash`)

**Where it helps:** shop news, blog posts, newsletters. Anywhere a dash was typed on a keyboard that has no dash key.

## Original

```markdown chaff-before
# Our new opening hours

From 1 September the shop opens on Sundays - the day you asked for most in our survey.
We will open from 10 am to 4 pm, and the café will serve breakfast until noon.

Weekday hours do not change. The late opening on Thursdays - until 8 pm - stays too.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media opening-hours.md

opening-hours.md   blog/owned-media · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    From 1 September the shop opens on Sundays - the day you asked for most in our survey.

  ·  Hyphen used as a dash

     "-" stands in for a dash
     A spaced hyphen ("late - very late") or a double hyphen ("late--very late") stands in for a dash (— or –). A hyphen joins words, so the reader stops for a moment to see whether it is part of one.

     → Use a dash (— or –), or rewrite with a comma or a colon.

     Relax this rule:  npx chaffjs relax hyphen-as-dash


─── line 6 ───────────────────────────────────────────────────

    The late opening on Thursdays - until 8 pm - stays too.

  ·  Hyphen used as a dash

     "-" stands in for a dash
     A spaced hyphen ("late - very late") or a double hyphen ("late--very late") stands in for a dash (— or –). A hyphen joins words, so the reader stops for a moment to see whether it is part of one.

     → Use a dash (— or –), or rewrite with a comma or a colon.

     Relax this rule:  npx chaffjs relax hyphen-as-dash


─── line 6 ───────────────────────────────────────────────────

    The late opening on Thursdays - until 8 pm - stays too.

  ·  Hyphen used as a dash

     "-" stands in for a dash
     A spaced hyphen ("late - very late") or a double hyphen ("late--very late") stands in for a dash (— or –). A hyphen joins words, so the reader stops for a moment to see whether it is part of one.

     → Use a dash (— or –), or rewrite with a comma or a colon.

     Relax this rule:  npx chaffjs relax hyphen-as-dash


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Our new opening hours

From 1 September the shop opens on Sundays, the day you asked for most in our survey.
We will open from 10 am to 4 pm, and the café will serve breakfast until noon.

Weekday hours do not change. The late opening on Thursdays (until 8 pm) stays too.
```

## How it was fixed

A keyboard has a hyphen key and no dash key, so a spaced hyphen stands in for a dash.
A hyphen joins words ("well-known"), and for a moment the reader cannot tell whether "Sundays - the day" is one phrase or two.

There are two ways to fix it: type a real dash (— or –), or rewrite with ordinary punctuation.
This post now uses a comma for the first and brackets for the aside about Thursdays, which needs no special character at all.

## Settings

At `strict` and `normal` the first one is reported; `relaxed` waits until there are 3.

A list marker ("- "), a number range ("1 - 2"), a hyphen inside a word and code are not reported.
"--" is not reported in a document that never uses a real dash, since that is how the document types its dash.

```yaml chaff-settings
rules:
  hyphen-as-dash: relaxed
```

The rule does not run on fiction, poetry or plays, because older printed texts set the dash as "--".

```text chaff-explain
$ npx chaffjs explain hyphen-as-dash --genre blog/owned-media

  Hyphen used as a dash   (hyphen-as-dash)

  A spaced hyphen ("late - very late") or a double hyphen ("late--very late") stands in for a dash (— or –). A hyphen joins words, so the reader stops for a moment to see whether it is part of one.

  How to fix: Use a dash (— or –), or rewrite with a comma or a colon.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 3
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax hyphen-as-dash --why "reason"
```

[All samples](README.md)
