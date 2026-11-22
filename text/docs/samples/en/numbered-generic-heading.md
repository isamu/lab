<!-- chaff-sample
rule: numbered-generic-heading
genre: blog/owned-media
file: post.md
-->

# Headings that are only a label and a number (`numbered-generic-heading`)

**Where it helps:** blog posts, company news, proposals, slide notes. Any document written to a template of points or benefits.

## Original

```markdown chaff-before
# Why we moved our support team to a four-day week

## Point 1

Response times stayed the same: the median first reply took 2 hours before the change and after it.

## Point 2

Sick days fell from 41 to 23 in the first six months.

## Point 3

Two people who had planned to leave told us they would stay.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media post.md

post.md   blog/owned-media · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    ## Point 1

  ·  Headings that are only a label and a number

     The heading "Point 1" is only a label and a number and says nothing about the section (3 such headings)
     Headings such as "Benefit 1", "Benefit 2" and "Tip 3" say nothing about their sections. A reader scanning the table of contents learns nothing until they open each one, and cannot find a section again later. Documents written to a template are full of them. The labels are in the lexicon generic-heading-label; step labels ("Step 1") are left out, since in a procedure the order is the content.

     → Say what the section says ("Benefit 1" becomes "Benefit 1: no setup" or simply "No setup needed").

     Relax this rule:  npx chaffjs relax numbered-generic-heading


─── line 7 ───────────────────────────────────────────────────

    ## Point 2

  ·  Headings that are only a label and a number

     The heading "Point 2" is only a label and a number and says nothing about the section (3 such headings)
     Headings such as "Benefit 1", "Benefit 2" and "Tip 3" say nothing about their sections. A reader scanning the table of contents learns nothing until they open each one, and cannot find a section again later. Documents written to a template are full of them. The labels are in the lexicon generic-heading-label; step labels ("Step 1") are left out, since in a procedure the order is the content.

     → Say what the section says ("Benefit 1" becomes "Benefit 1: no setup" or simply "No setup needed").

     Relax this rule:  npx chaffjs relax numbered-generic-heading


─── line 11 ──────────────────────────────────────────────────

    ## Point 3

  ·  Headings that are only a label and a number

     The heading "Point 3" is only a label and a number and says nothing about the section (3 such headings)
     Headings such as "Benefit 1", "Benefit 2" and "Tip 3" say nothing about their sections. A reader scanning the table of contents learns nothing until they open each one, and cannot find a section again later. Documents written to a template are full of them. The labels are in the lexicon generic-heading-label; step labels ("Step 1") are left out, since in a procedure the order is the content.

     → Say what the section says ("Benefit 1" becomes "Benefit 1: no setup" or simply "No setup needed").

     Relax this rule:  npx chaffjs relax numbered-generic-heading


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why we moved our support team to a four-day week

## Customers waited no longer

Response times stayed the same: the median first reply took 2 hours before the change and after it.

## Fewer sick days

Sick days fell from 41 to 23 in the first six months.

## People stayed

Two people who had planned to leave told us they would stay.
```

## How it was fixed

The headings "Point 1", "Point 2" and "Point 3" say nothing about their sections.
A reader scanning the post, or its table of contents, has to open each one to learn what the four-day week did. Each section has a real finding, and the headings hide all of them.

The fix makes each heading say its finding.
A heading that keeps its label and adds a title ("Point 1: no slower replies") is not reported either.
"Step 1", "Chapter 1" and the like are not reported, since there the number is the content.

## Settings

The level is how many such headings a document may have before it is reported: from two at the default level, from one at `strict`, from three at `relaxed`.

If your documents follow a template that numbers its points on purpose, relax it:

```yaml chaff-settings
rules:
  numbered-generic-heading: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature and speech genres.

```text chaff-explain
$ npx chaffjs explain numbered-generic-heading --genre blog/owned-media

  Headings that are only a label and a number   (numbered-generic-heading)

  Headings such as "Benefit 1", "Benefit 2" and "Tip 3" say nothing about their sections. A reader scanning the table of contents learns nothing until they open each one, and cannot find a section again later. Documents written to a template are full of them. The labels are in the lexicon generic-heading-label; step labels ("Step 1") are left out, since in a procedure the order is the content.

  How to fix: Say what the section says ("Benefit 1" becomes "Benefit 1: no setup" or simply "No setup needed").

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported from 1 such heading
  → normal   reported from 2 such headings
    relaxed  reported from 3 such headings
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax numbered-generic-heading --why "reason"
```

[All samples](README.md)
