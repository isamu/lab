<!-- chaff-sample
rule: unprompted-denial
genre: blog/tech
file: post.md
-->

# Too many denials of a premise nobody stated (`unprompted-denial`)

**Where it helps:** engineering blog posts, retrospectives, opinion pieces.

## Original

```markdown chaff-before
# What the move to weekly releases taught us

In March our team of nine moved from a release every month to a release every week.
Eight months on, we have shipped thirty-four releases and rolled back two.

This isn't a post about tooling.
Our build and deploy steps stayed exactly as they were, and so did the test suite.

That's not the interesting part.
What changed was who decided a release was ready.
Under the monthly plan, one release manager read every change and signed off on the whole release, often late on a Thursday night.
Now the engineer who wrote a change signs it off, together with one reviewer who knows that part of the code.

It's not a question of speed either.
Our releases got smaller: the median release in October touched four files, against thirty in February.
Smaller releases were easier to check, and when something broke, we found the cause within the hour instead of the next morning.

The release manager did not lose a job.
She now spends that time on the checklist we run before each release, which has grown from six items to eleven.
The two rollbacks both came from changes that skipped the checklist, so in November we made it a required step in the pull request.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    This isn't a post about tooling.

  ·  Too many denials of a premise nobody stated

     "this isn't" and other denials of a premise nobody stated: 21.4% of sentences (limit 3%)
     "This isn't about tooling." "That's not the point." Such a sentence knocks down a belief the reader never held, and what the thing is goes unsaid. One or two move an argument along; piled up, they read like generated text.

     → Drop the denial and say what the thing is ("Parameters are the number of weights inside the model.").

     Relax this rule:  npx chaffjs relax unprompted-denial


─── line 9 ───────────────────────────────────────────────────

    That's not the interesting part.

  ·  Too many denials of a premise nobody stated

     "that's not" and other denials of a premise nobody stated: 21.4% of sentences (limit 3%)
     "This isn't about tooling." "That's not the point." Such a sentence knocks down a belief the reader never held, and what the thing is goes unsaid. One or two move an argument along; piled up, they read like generated text.

     → Drop the denial and say what the thing is ("Parameters are the number of weights inside the model.").

     Relax this rule:  npx chaffjs relax unprompted-denial


─── line 14 ──────────────────────────────────────────────────

    It's not a question of speed either.

  ·  Too many denials of a premise nobody stated

     "it's not" and other denials of a premise nobody stated: 21.4% of sentences (limit 3%)
     "This isn't about tooling." "That's not the point." Such a sentence knocks down a belief the reader never held, and what the thing is goes unsaid. One or two move an argument along; piled up, they read like generated text.

     → Drop the denial and say what the thing is ("Parameters are the number of weights inside the model.").

     Relax this rule:  npx chaffjs relax unprompted-denial


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# What the move to weekly releases taught us

In March our team of nine moved from a release every month to a release every week.
Eight months on, we have shipped thirty-four releases and rolled back two.

Our build and deploy steps stayed exactly as they were, and so did the test suite.
What changed was who decided a release was ready.
Under the monthly plan, one release manager read every change and signed off on the whole release, often late on a Thursday night.
Now the engineer who wrote a change signs it off, together with one reviewer who knows that part of the code.

Releases also got smaller.
The median release in October touched four files, against thirty in February.
Smaller releases were easier to check, and when something broke, we found the cause within the hour instead of the next morning.

The release manager now spends that time on the checklist we run before each release.
It has grown from six items to eleven.
The two rollbacks both came from changes that skipped the checklist, so in November we made it a required step in the pull request.
```

## How it was fixed

"This isn't a post about tooling." "That's not the interesting part." "It's not a question of speed either."
No reader had said it was about tooling or speed. Each denial knocks down a belief nobody held, and the reader has to read what the post is not about before reading what it is about.

The corrected post deletes the three denials and keeps what came after them.
The facts were already there: the build stayed the same, the sign-off moved to the engineer, and the releases got smaller. They read more directly without a "not" in front of them.

## Settings

The rule measures the share of sentences that deny a premise nobody stated. It reports above 3% of sentences; `strict` above 2% and `relaxed` above 5%:

```yaml chaff-settings
rules:
  unprompted-denial: relaxed
```

One or two denials, a denial with its reason ("because …"), a denial that answers the previous sentence's question, and a plain negated fact ("It's not ready.") are not counted. Short documents are not measured, and the rule does not run on legal, documentation, literature or speech genres.

```text chaff-explain
$ npx chaffjs explain unprompted-denial --genre blog/tech

  Too many denials of a premise nobody stated   (unprompted-denial)

  "This isn't about tooling." "That's not the point." Such a sentence knocks down a belief the reader never held, and what the thing is goes unsaid. One or two move an argument along; piled up, they read like generated text.

  How to fix: Drop the denial and say what the thing is ("Parameters are the number of weights inside the model.").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 2% of sentences deny a premise nobody stated
  → normal   up to 3% of sentences deny a premise nobody stated
    relaxed  up to 5% of sentences deny a premise nobody stated
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unprompted-denial --why "reason"
```

[All samples](README.md)
