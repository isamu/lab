<!-- chaff-sample
rule: title-length
genre: blog/tech
file: post.md
-->

# Title or heading too long (`title-length`)

**Where it helps:** blog posts, articles, guides. Any document whose titles and headings show up in a table of contents, a feed or search results.

## Original

```markdown chaff-before
# How we cut our test suite from forty minutes to nine without deleting a single test or buying more machines

Our test suite used to take forty minutes on every pull request.
People stopped waiting for it, merged on a hunch, and fixed whatever broke the next morning when the overnight build went red.

## What we measured first, before changing anything in the pipeline or the test code itself

We timed each test file on its own for a week.
Most of the time went to a handful of files that each started a fresh database.

## Sharing one database across a file

We now start the database once per file and empty its tables between tests.
That alone cut the run to fifteen minutes.

## Running the slow files first

The runner now starts the longest files first, so no machine sits idle at the end.
The suite finishes in nine minutes.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 1 ───────────────────────────────────────────────────

    # How we cut our test suite from forty minutes to nine without deleting a single…

  ·  Title or heading too long

     The title "How we cut our test suite from forty minutes to nine without deleting a single test or buying more machines" runs 20 words (limit 14)
     Readers scan titles and headings to decide what to read. A long one cannot be taken in at a glance, and tables of contents and search results cut it off. English is counted in words. Reports, press releases, minutes, specifications and papers carry long formal titles, so their limit is higher.

     → Keep only the name in the heading and move conditions and explanations into the first sentence below it. Put a bracketed aside (a date, an audience, a version) in a subtitle or the text. An official title with an identifier, a case number or the bodies concerned (CA 23-6: …) is cited in that form: keep it, and put the point in the first sentence under it.

     Relax this rule:  npx chaffjs relax title-length


─── line 6 ───────────────────────────────────────────────────

    ## What we measured first, before changing anything in the pipeline or the test …

  ·  Title or heading too long

     The heading "What we measured first, before changing anything in the pipeline or the test code itself" runs 15 words (limit 14)
     Readers scan titles and headings to decide what to read. A long one cannot be taken in at a glance, and tables of contents and search results cut it off. English is counted in words. Reports, press releases, minutes, specifications and papers carry long formal titles, so their limit is higher.

     → Keep only the name in the heading and move conditions and explanations into the first sentence below it. Put a bracketed aside (a date, an audience, a version) in a subtitle or the text. An official title with an identifier, a case number or the bodies concerned (CA 23-6: …) is cited in that form: keep it, and put the point in the first sentence under it.

     Relax this rule:  npx chaffjs relax title-length


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# How we cut our test suite from forty minutes to nine

We did it without deleting a single test or buying more machines.
Our test suite used to take forty minutes on every pull request.
People stopped waiting for it, merged on a hunch, and fixed whatever broke the next morning when the overnight build went red.

## What we measured first

Before changing anything, we timed each test file on its own for a week.
Most of the time went to a handful of files that each started a fresh database.

## Sharing one database across a file

We now start the database once per file and empty its tables between tests.
That alone cut the run to fifteen minutes.

## Running the slow files first

The runner now starts the longest files first, so no machine sits idle at the end.
The suite finishes in nine minutes.
```

## How it was fixed

The title runs 20 words. In a feed or a search result it is cut off after "forty minutes to nine", so the part the writer was proudest of never shows, and the whole line is too long to take in at a glance anyway.
The second heading has the same problem in a smaller way: "before changing anything in the pipeline or the test code itself" explains the heading instead of naming the section.

The fix keeps the name of the story in the title and moves the condition, "without deleting a single test or buying more machines", into the first sentence, where a reader who clicked will see it straight away.
The heading keeps "What we measured first", and "Before changing anything" opens the paragraph under it.

## Settings

English titles and headings are counted in words. For a blog post the rule reports one over 14 words; `strict` reports one over 10 and `relaxed` one over 18.
Reports, press releases, minutes, specifications and papers carry long formal titles, so their limits are higher (see the `explain` output below).

```yaml chaff-settings
rules:
  title-length: relaxed
```

The rule does not run on contracts and statutes, literature, speeches, or FAQ pages, where a heading is the reader's whole question.

```text chaff-explain
$ npx chaffjs explain title-length --genre blog/tech

  Title or heading too long   (title-length)

  Readers scan titles and headings to decide what to read. A long one cannot be taken in at a glance, and tables of contents and search results cut it off. English is counted in words. Reports, press releases, minutes, specifications and papers carry long formal titles, so their limit is higher.

  How to fix: Keep only the name in the heading and move conditions and explanations into the first sentence below it. Put a bracketed aside (a date, an audience, a version) in a subtitle or the text. An official title with an identifier, a case number or the bodies concerned (CA 23-6: …) is cited in that form: keep it, and put the point in the first sentence under it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when a title or heading runs past 10 words
  → normal   reported when a title or heading runs past 14 words
    relaxed  reported when a title or heading runs past 18 words
    off      not checked

  These numbers are the default ones, which blog/tech takes. business/report / business/press-release / business/meeting-notes / technical/spec / academic have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax title-length --why "reason"
```

[All samples](README.md)
