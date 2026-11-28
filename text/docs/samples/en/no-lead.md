<!-- chaff-sample
rule: no-lead
genre: blog/owned-media
file: post.md
-->

# The lead only restates the title (`no-lead`)

**Where it helps:** blog posts, company news, newsletters, announcements. Any article whose reader decides from the first paragraph whether to read on.

## Original

```markdown chaff-before
# Our new parental leave policy

In this post we look at the new parental leave policy.

## Who it covers

Every employee who has been with us for at least three months.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media post.md

post.md   blog/owned-media · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    In this post we look at the new parental leave policy.

  ·  The lead only restates the title

     The paragraph after the title "Our new parental leave policy" adds only 2 words the title does not have
     The paragraph right under the title (the lead) is where a reader decides whether to read on. When it only restates the title ("This article explains X"), the reader gets nothing before the body starts. chaff reports a lead that repeats at least half of the title's character sequence and adds only a few content words (nouns, verbs, adjectives, adverbs, numbers) the title does not have. A line with only a date or a byline does not repeat the title, so it is not reported.

     → Put in the lead what the title alone does not say (the conclusion, a figure, who it affects, from when). If there is nothing to add, drop the lead and start with the body.

     Relax this rule:  npx chaffjs relax no-lead


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Our new parental leave policy

From January 1, 2027, every parent at the company can take 20 weeks of paid leave, whoever gave birth.

## Who it covers

Every employee who has been with us for at least three months.
```

## How it was fixed

The first paragraph only says that the post is about the policy in the title.
A reader who stops there, as most do, learns nothing they had not read in the title: not how long the leave is, not who gets it, not when it starts.

The fix puts the news in the first sentence: 20 weeks of paid leave from January 1, 2027, for every parent.
A reader who stops there has the point; one who reads on gets the details.
If there is nothing to add to the title, drop the lead and start with the body.

## Settings

The level is how few new content words a lead may add before it is reported: fewer than 5 at the default level, fewer than 6 at `strict`, fewer than 3 at `relaxed`.

If your posts open with a short line on purpose, relax it:

```yaml chaff-settings
rules:
  no-lead: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for legal, literature and speech genres.

```text chaff-explain
$ npx chaffjs explain no-lead --genre blog/owned-media

  The lead only restates the title   (no-lead)

  The paragraph right under the title (the lead) is where a reader decides whether to read on. When it only restates the title ("This article explains X"), the reader gets nothing before the body starts. chaff reports a lead that repeats at least half of the title's character sequence and adds only a few content words (nouns, verbs, adjectives, adverbs, numbers) the title does not have. A line with only a date or a byline does not repeat the title, so it is not reported.

  How to fix: Put in the lead what the title alone does not say (the conclusion, a figure, who it affects, from when). If there is nothing to add, drop the lead and start with the body.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the lead adds fewer than 6 content words the title does not have
  → normal   reported when the lead adds fewer than 5 content words the title does not have
    relaxed  reported when the lead adds fewer than 3 content words the title does not have
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax no-lead --why "reason"
```

[All samples](README.md)
