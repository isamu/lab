<!-- chaff-sample
rule: closing-cliche
genre: blog/tech
file: build-cache.md
-->

# Cliched closing (`closing-cliche`)

**Where it helps:** blog posts, how-to articles, proposals, emails. The last lines are what the reader remembers, so a stock line there costs the most.

## Original

```markdown chaff-before
# Our CI builds now take six minutes

Until last month, every pull request waited about twenty minutes for its build.
Most of that time went on downloading the same packages again and again.

We turned on the dependency cache in the build settings and keyed it on the lockfile.
Now a build downloads packages only when the lockfile changes, and the median build takes six minutes.

The cache is kept for seven days, so the first build after a quiet week is slow again.

I hope you found this article helpful. Thanks for reading!
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech build-cache.md

build-cache.md   blog/tech · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    Thanks for reading!

  ⚠  Cliched closing

     Closes with "thanks for reading"
     A closing that only thanks the reader leaves nothing behind.

     → Name the one thing you want the reader to take away.

     Relax this rule:  npx chaffjs relax closing-cliche


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Our CI builds now take six minutes

Until last month, every pull request waited about twenty minutes for its build.
Most of that time went on downloading the same packages again and again.

We turned on the dependency cache in the build settings and keyed it on the lockfile.
Now a build downloads packages only when the lockfile changes, and the median build takes six minutes.

The cache is kept for seven days, so the first build after a quiet week is slow again.

If your builds spend most of their time downloading, key a cache on your lockfile first: it is one setting, and it was most of our gain.
```

## How it was fixed

The post ends on "I hope you found this article helpful. Thanks for reading!", a line that fits any article ever written.
The reader leaves with a courtesy instead of the point, and the point was a good one: one setting cut the build from twenty minutes to six.

The fix deletes the stock closing and ends on the one thing a reader should take away and try on their own builds.
If the body already ends on its conclusion, deleting the closing is enough.

## Settings

The rule reads the last paragraphs of the document for stock closings ("Hope this helps", "Thanks for reading", "In conclusion, we have explored…").
At `normal` and `strict` one is enough; `relaxed` waits for two.

```yaml chaff-settings
rules:
  closing-cliche: relaxed
```

It runs on blogs, emails and proposals.
It does not run on reports, notices, legal text, manuals, papers, literature or speeches, where a speech closing with thanks is its form.
List items and the opening paragraph are not read.

```text chaff-explain
$ npx chaffjs explain closing-cliche --genre blog/tech

  Cliched closing   (closing-cliche)

  A closing that only thanks the reader leaves nothing behind.

  How to fix: Name the one thing you want the reader to take away.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax closing-cliche --why "reason"
```

[All samples](README.md)
