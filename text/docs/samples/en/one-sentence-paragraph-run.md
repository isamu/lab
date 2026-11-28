<!-- chaff-sample
rule: one-sentence-paragraph-run
genre: blog/owned-media
file: post.md
-->

# Run of one-sentence paragraphs (`one-sentence-paragraph-run`)

**Where it helps:** company blog posts, social media posts turned into articles, newsletters. Writing that sets every sentence apart for effect.

## Original

```markdown chaff-before
# What we learned from our first open day

Last Saturday we opened the bakery kitchen to the public for the first time.

We expected about forty visitors.

More than two hundred came.

The bread ran out by eleven.

Children loved shaping their own rolls.

Several parents asked whether we run classes.

We will hold the next open day in spring, with tickets so that we can plan the baking.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media post.md

post.md   blog/owned-media · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Last Saturday we opened the bakery kitchen to the public for the first time.

  ·  Run of one-sentence paragraphs

     7 one-sentence paragraphs in a row (limit 4)
     A paragraph groups the sentences that belong to one point. Setting every sentence apart as its own paragraph hides which sentences go together, and leaves the reader to work out how they relate. A one-sentence paragraph works as emphasis; a run of them does not. A heading, a list, a table or code between paragraphs starts the count again.

     → Join the sentences that make one point into one paragraph. If they are items, make them a list.

     Relax this rule:  npx chaffjs relax one-sentence-paragraph-run


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# What we learned from our first open day

Last Saturday we opened the bakery kitchen to the public for the first time.

We expected about forty visitors, and more than two hundred came. The bread ran out by eleven.

Children loved shaping their own rolls, and several parents asked whether we run classes.

We will hold the next open day in spring, with tickets so that we can plan the baking.
```

## How it was fixed

Every sentence of the post is a paragraph of its own.
Set apart like that, each line asks to be read as a punchline, and the reader cannot see which ones belong together: the crowd and the empty shelves are one story, the children and the parents' question another.

The fix groups the sentences by what they are about.
The surprise (forty expected, two hundred came, the bread gone by eleven) is one paragraph, the children and the classes another.
The opening and the plan for spring still stand alone, and now they read as the start and the end.

## Settings

At the default level, a run of more than four one-sentence paragraphs is reported; `strict` reports four and `relaxed` waits for seven.
A heading, a list, a table or code between paragraphs starts the count again, and so do lines joined by a single line break.
If the sentences really are separate items, a list is the better fix.

```yaml chaff-settings
rules:
  one-sentence-paragraph-run: relaxed
```

The rule does not run on contracts and statutes, where a clause is a paragraph by form, on literature, or on verbatim transcripts.

```text chaff-explain
$ npx chaffjs explain one-sentence-paragraph-run --genre blog/owned-media

  Run of one-sentence paragraphs   (one-sentence-paragraph-run)

  A paragraph groups the sentences that belong to one point. Setting every sentence apart as its own paragraph hides which sentences go together, and leaves the reader to work out how they relate. A one-sentence paragraph works as emphasis; a run of them does not. A heading, a list, a table or code between paragraphs starts the count again.

  How to fix: Join the sentences that make one point into one paragraph. If they are items, make them a list.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 3 one-sentence paragraphs in a row
  → normal   up to 4 one-sentence paragraphs in a row
    relaxed  up to 6 one-sentence paragraphs in a row
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax one-sentence-paragraph-run --why "reason"
```

[All samples](README.md)
